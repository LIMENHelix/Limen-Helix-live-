#!/usr/bin/env node
/**
 * Phase 2: Claude prose rewrite for reciprocity-resolved stubs.
 *
 * For each portal that contains reciprocity-resolved stubs (entries with
 * `_reciprocityResolvedAt`), collects the stubs, gathers partner
 * context, and POSTs to /api/limen-reciprocity-prose-rewrite. Writes
 * the rewritten relationshipNote back into each stub and tags
 * `_proseRewrittenAt`. Phase 1 metadata (sourceType, brainNodeId,
 * brainNodeRole, neuralRole, confidence, _reciprocityResolvedAt,
 * _resolvedFromPartnerEntry) is preserved.
 *
 *   node scripts/portal-reciprocity-phase2.mjs --dry-run
 *   node scripts/portal-reciprocity-phase2.mjs --dry-run --sample 1
 *   node scripts/portal-reciprocity-phase2.mjs --apply --sample 5
 *   node scripts/portal-reciprocity-phase2.mjs --apply
 *
 * Required env: LIMEN_OPERATOR_TOKEN (if API auth is enabled remotely).
 * Optional env: LIMEN_BASE_URL (default https://limenhelix.com).
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}
function flag(name) { return args.indexOf('--' + name) !== -1; }

const DRY = flag('dry-run') || !flag('apply');
const APPLY = flag('apply') && !flag('dry-run');
const SAMPLE = parseInt(arg('sample', '0'), 10) || 0;
const ONLY = arg('only', '');
const BASE = arg('base-url', process.env.LIMEN_BASE_URL || 'https://limenhelix.com');
const TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const DIR = path.resolve('assets/data/companies');
const SPACING_MS = parseInt(arg('spacing-ms', '2000'), 10);

// Cap stubs per call to keep latency + retry granularity reasonable.
// Override via --chunk-size N (default 20). Lower if the endpoint or
// Vercel function is timing out on dense portals.
const MAX_STUBS_PER_CALL = parseInt(arg('chunk-size', '20'), 10);

function headers() {
  const h = { 'content-type': 'application/json' };
  if (TOKEN) h.authorization = 'Bearer ' + TOKEN;
  return h;
}

function readPortal(slug) {
  const p = path.join(DIR, slug + '.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

function writePortal(slug, data) {
  const p = path.join(DIR, slug + '.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Pattern that identifies boilerplate notes still in need of rewrite.
const BOILERPLATE_RE = /per reciprocity audit|structural reciprocity fill|See \w+ portal for canonical narrative/i;

function isBoilerplate(note) {
  return typeof note === 'string' && BOILERPLATE_RE.test(note);
}

function extractStubsForPortal(portal) {
  const stubs = [];
  const fn = portal.functionalNetwork || {};
  for (const category of Object.keys(fn)) {
    const arr = fn[category];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (!e || typeof e !== 'object') continue;
      if (!e._reciprocityResolvedAt) continue;        // phase 1 must have run
      if (e._proseRewrittenAt) continue;              // already rewritten
      if (e._orphanedStub) continue;                  // no partner data — skip
      if (!isBoilerplate(e.relationshipNote)) continue; // only target boilerplate
      stubs.push({
        category,
        index: i,
        slug: e.slug,
        name: e.name,
        ticker: e.ticker || null,
        brainNodeId: e.brainNodeId || null,
        brainNodeRole: e.brainNodeRole || null,
        neuralRole: e.neuralRole || null
      });
    }
  }
  return stubs;
}

function shortBusinessSummary(portal) {
  // Prefer portalRelevance, fall back to domainRelevance, then a name+industry line.
  const pr = portal.portalRelevance;
  if (typeof pr === 'string' && pr.length > 50) return pr.slice(0, 600);
  if (pr && typeof pr.text === 'string' && pr.text.length > 50) return pr.text.slice(0, 600);
  const dr = portal.domainRelevance;
  if (typeof dr === 'string' && dr.length > 50) return dr.slice(0, 600);
  if (dr && typeof dr.text === 'string' && dr.text.length > 50) return dr.text.slice(0, 600);
  const intel = portal.intelligenceCycle && portal.intelligenceCycle.sensing;
  if (Array.isArray(intel) && intel.length) return intel.slice(0, 4).join(' · ').slice(0, 600);
  return `${portal.name || portal.slug} — ${portal.industry || 'industry not specified'}`;
}

// Find the partner's reciprocal entry pointing back at this host, to
// give the model 'their view of host' context. Looks across all
// functionalNetwork categories on the partner.
function findPartnerView(partnerPortal, hostSlug, hostCik, hostName) {
  if (!partnerPortal || !partnerPortal.functionalNetwork) return null;
  const fn = partnerPortal.functionalNetwork;
  for (const cat of Object.keys(fn)) {
    const arr = fn[cat];
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      if (e.slug === hostSlug) return e.relationshipNote || null;
      if (hostCik && e.cik && String(e.cik).replace(/^0+/, '') === String(hostCik).replace(/^0+/, '')) {
        return e.relationshipNote || null;
      }
    }
  }
  return null;
}

function buildPartnerSummaries(stubs, hostPortal, cache) {
  const out = {};
  for (const s of stubs) {
    const partner = cache.get(s.slug) !== undefined ? cache.get(s.slug) : (() => {
      const p = readPortal(s.slug);
      cache.set(s.slug, p);
      return p;
    })();
    if (!partner) {
      out[s.slug] = {
        name: s.name, industry: null, businessSummary: null, theirView: null
      };
      continue;
    }
    out[s.slug] = {
      name: partner.name || s.name,
      industry: partner.industry || null,
      businessSummary: shortBusinessSummary(partner).slice(0, 400),
      theirView: findPartnerView(partner, hostPortal.slug, hostPortal.cik, hostPortal.name)
    };
  }
  return out;
}

async function callRewriteEndpoint(hostPortal, stubs, partnerSummaries) {
  const body = {
    hostPortal: {
      slug: hostPortal.slug,
      name: hostPortal.name,
      industry: hostPortal.industry,
      domainId: hostPortal.domainId,
      businessSummary: shortBusinessSummary(hostPortal)
    },
    stubs,
    partnerSummaries
  };
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + '/api/limen-reciprocity-prose-rewrite', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    const j = await r.json();
    const elapsed = Date.now() - t0;
    return { ok: r.ok, status: r.status, json: j, elapsedMs: elapsed };
  } catch (e) {
    return { ok: false, status: 0, json: { error: 'fetch-error', detail: String(e.message || e) }, elapsedMs: Date.now() - t0 };
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main ───
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));

let targets = files;
if (ONLY) {
  const wanted = new Set(ONLY.split(',').map(s => s.trim() + '.json'));
  targets = files.filter(f => wanted.has(f));
}

// Build a queue of {slug, stubCount} sorted by stub count ascending (easier first)
const queue = [];
for (const f of targets) {
  const portal = readPortal(f.replace('.json', ''));
  if (!portal) continue;
  const stubs = extractStubsForPortal(portal);
  if (stubs.length === 0) continue;
  queue.push({ slug: portal.slug, stubCount: stubs.length });
}
queue.sort((a, b) => a.stubCount - b.stubCount);

console.log('═══ phase 2: reciprocity prose rewrite ═══');
console.log('  mode:        ' + (APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'));
console.log('  base url:    ' + BASE);
console.log('  auth:        ' + (TOKEN ? 'bearer present' : 'no token'));
console.log('  total portals with stubs: ' + queue.length);
console.log('  total stubs:              ' + queue.reduce((a, b) => a + b.stubCount, 0));
console.log('  scope:       ' + (SAMPLE > 0 ? 'first ' + SAMPLE + ' portals (smallest first)' : 'all'));
console.log('');

const partnerCache = new Map();
let portalsProcessed = 0;
let portalsWritten = 0;
let stubsRewritten = 0;
let stubsFailed = 0;
let totalCost = 0;
const errors = [];

const scope = SAMPLE > 0 ? queue.slice(0, SAMPLE) : queue;

for (let q = 0; q < scope.length; q++) {
  const { slug } = scope[q];
  const portal = readPortal(slug);
  if (!portal) continue;
  const stubs = extractStubsForPortal(portal);
  if (stubs.length === 0) continue;

  portalsProcessed++;
  console.log('[' + (q + 1) + '/' + scope.length + '] ' + slug + ' — ' + stubs.length + ' stubs');

  // Chunk if more than MAX_STUBS_PER_CALL
  const chunks = [];
  for (let i = 0; i < stubs.length; i += MAX_STUBS_PER_CALL) {
    chunks.push(stubs.slice(i, i + MAX_STUBS_PER_CALL));
  }

  const allRewrites = {}; // slug -> note
  let portalFailed = false;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    if (chunks.length > 1) console.log('   chunk ' + (c + 1) + '/' + chunks.length + ' (' + chunk.length + ' stubs)');
    const partnerSummaries = buildPartnerSummaries(chunk, portal, partnerCache);
    const resp = await callRewriteEndpoint(portal, chunk, partnerSummaries);

    if (!resp.ok) {
      console.log('   FAIL http=' + resp.status + ' ' + JSON.stringify(resp.json).slice(0, 200));
      errors.push({ slug, chunkIndex: c, status: resp.status, json: resp.json });
      portalFailed = true;
      stubsFailed += chunk.length;
      continue;
    }
    const j = resp.json;
    if (!j.ok || !Array.isArray(j.rewrites)) {
      console.log('   FAIL response not ok: ' + JSON.stringify(j).slice(0, 200));
      errors.push({ slug, chunkIndex: c, json: j });
      portalFailed = true;
      stubsFailed += chunk.length;
      continue;
    }

    for (const r of j.rewrites) allRewrites[r.slug] = r.relationshipNote;
    if (j.usage) {
      const inTokens = j.usage.input_tokens || 0;
      const outTokens = j.usage.output_tokens || 0;
      // Haiku 4.5: $1.00/MT in, $5.00/MT out (current pricing)
      totalCost += (inTokens / 1e6) * 1.00 + (outTokens / 1e6) * 5.00;
    }
    console.log('   ok ' + resp.elapsedMs + 'ms — ' + j.rewrites.length + '/' + chunk.length + ' rewrites'
      + (j.missing ? ' (missing: ' + j.missing.join(',') + ')' : '')
      + (j.errors ? ' (errors: ' + j.errors.length + ')' : ''));

    if (c < chunks.length - 1) await sleep(SPACING_MS);
  }

  // Apply rewrites back into portal
  const fn = portal.functionalNetwork || {};
  let written = 0;
  for (const category of Object.keys(fn)) {
    const arr = fn[category];
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      if (!e || !e._reciprocityResolvedAt || e._proseRewrittenAt) continue;
      const newNote = allRewrites[e.slug];
      if (!newNote) continue;
      e.relationshipNote = newNote;
      e._proseRewrittenAt = new Date().toISOString();
      written++;
    }
  }

  if (written > 0 && APPLY) {
    writePortal(slug, portal);
    portalsWritten++;
  }
  stubsRewritten += written;
  console.log('   ' + (APPLY ? 'WROTE' : 'WOULD WRITE') + ' ' + written + ' rewrites' + (portalFailed ? ' (partial — some chunks failed)' : ''));

  if (q < scope.length - 1) await sleep(SPACING_MS);
}

console.log('');
console.log('═══ SUMMARY ═══');
console.log('  portals processed:  ' + portalsProcessed);
console.log('  portals written:    ' + portalsWritten + (DRY ? ' (dry run — nothing written)' : ''));
console.log('  stubs rewritten:    ' + stubsRewritten);
console.log('  stubs failed:       ' + stubsFailed);
console.log('  estimated cost:     $' + totalCost.toFixed(3));
if (errors.length) {
  console.log('  errors (' + errors.length + '):');
  for (const e of errors.slice(0, 10)) {
    console.log('    ' + e.slug + (e.chunkIndex !== undefined ? ' chunk=' + e.chunkIndex : '') + ' — ' + JSON.stringify(e.json).slice(0, 150));
  }
}

process.exit(0);
