#!/usr/bin/env node
/**
 * build-fractal-portals.mjs — paced, resumable, depth-gated portal generator.
 *
 * Generates Stryker-grade v2.0.1 portals (deep, company-specific
 * functionalNetwork — NOT cookie-cutter) via POST /api/enrich-portal-claude,
 * for the fractal-web buildout:
 *   --tier 1  : command-board companies that have no portal yet (55)
 *   --tier 2  : orphan vendor counterparties that are real companies
 *               (densifyCandidate), ranked by reference count (completes the
 *               most fractal cycles first). Leaf-nodes (regulators / indices /
 *               auditors / executives / market-signals) are NEVER generated as
 *               companies — they stay structural registry nodes.
 *
 * Design for a months-long run:
 *   - IDEMPOTENT: skips any target whose portal file already exists, so
 *     re-running continues where it stopped.
 *   - DEPTH-GATED: rejects output that trips the endpoint's genericity guard
 *     (genericityWarning / anchoredRate < MIN_ANCHORED); retries once with a
 *     conglomerate/depth hint, then logs + skips rather than writing filler.
 *   - PACED: sequential — Anthropic's Haiku ~10K-tok/min limit self-paces;
 *     never run this concurrently with another enrich batch.
 *   - LOGGED: appends one JSON line per attempt to scripts/_fractal-build-log.jsonl
 *     (audit + resumability signal).
 *
 *   node scripts/build-fractal-portals.mjs --tier 1 --limit 5
 *   node scripts/build-fractal-portals.mjs --tier 2 --limit 10 --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const CB_DATA_PATH = path.join(ROOT, 'assets', 'data', 'command-board-data.json');
const CB_ELIGIBLE_PATH = path.join(ROOT, 'assets', 'data', 'command-board-eligible.json');
const ORPHAN_PATH = path.join(ROOT, 'assets', 'data', 'orphan-stakeholders.json');
const OVERRIDES_PATH = path.join(__dirname, '_fractal-overrides.json');
const ALIAS_PATH = path.join(ROOT, 'assets', 'data', 'company-aliases.json');
const LOG_PATH = path.join(__dirname, '_fractal-build-log.jsonl');
let ALIAS = {};
try { ALIAS = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8')).aliases || {}; } catch (e) {}
const BASE_URL = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';
const MIN_ANCHORED = 0.85;   // depth gate — reject filler
const MAX_DATA_NEEDED = 5;   // placeholder gate — reject portals where the model said "DATA_NEEDED" too often (signals the model didn't have real info to anchor on; passes depth gate by stuffing structured placeholders but operator sees gibberish)
// Fractal-brain fidelity gate. Each portal must mirror the brain: every
// functionalNetwork entry tagged with brainNodeId + neuralRole + brainNodeRole.
// This is the CORE goal — every portal is a mini-brain, the network is the
// spider-web. A portal lacking the brain tagging is just a list, not a brain.
const MIN_BRAIN_TAGGED = 0.90;
const MIN_NEURAL_ROLES_PRESENT = 5;

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const TIER = String(getArg('tier', '1'));
const LIMIT = parseInt(getArg('limit', '5'), 10);
const DRY = args.includes('--dry-run');
// --source data (default) -> command-board-data.json (the curated 506)
// --source eligible        -> command-board-eligible.json (the kernel-eligible 302)
const SOURCE = String(getArg('source', 'data')).toLowerCase();
const CB_PATH = SOURCE === 'eligible' ? CB_ELIGIBLE_PATH : CB_DATA_PATH;

const SUBCAT = { neurology:'medicine', addiction:'medicine', psychedelic:'medicine', metabolic:'medicine', pediatric:'medicine', health:'medicine', contemplative:'religion', p2_agri:'agriculture', legal:'law', research:'science', supplyChain:'trade' };
const canonDomain = d => SUBCAT[d] || d || 'economy';
const normCik = c => String(c == null ? '' : c).replace(/^0+/, '') || '0';
const nameSlug = n => String(n || '').replace(/\([^)]*\)/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
// strip trailing corporate-suffix tokens (corning_inc -> corning) for intra-queue
// and against-portal dedup. Keeps the fractal web from generating the same
// entity under suffix variants in one batch.
const SLUG_SUFFIX = new Set(['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'companies', 'ltd', 'limited', 'plc', 'llc', 'lp', 'sa', 'ag', 'nv', 'se', 'kgaa', 'holdings', 'holding', 'group', 'the', 'of']);
const baseSlug = slug => { const p = String(slug || '').split('_'); while (p.length > 1 && SLUG_SUFFIX.has(p[p.length - 1])) p.pop(); return p.join('_'); };
// name fingerprint: squash to alphanumerics after stripping ONLY corporate-form
// words. Parentheticals are KEPT on purpose: an exact same-name pair is a true
// dup (shell + shell_global both "Shell plc"), but a parenthetical qualifier
// marks a legitimate segment node (abbott_metabolic = "Abbott Laboratories
// (Metabolic Division)") that must NOT be collapsed into its parent. Do not add
// global/international here — they're part of real legal names (Anixter Intl).
const NAME_STOP = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|sa|ag|nv|se|kgaa|holdings?|group|the)\b/gi;
const nameKey = n => String(n || '').replace(NAME_STOP, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function portalNameKeys() {
  const s = new Set();
  for (const f of fs.readdirSync(DIR)) { if (!f.endsWith('.json') || f.startsWith('_')) continue; try { const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); const k = nameKey(p.name); if (k) s.add(k); } catch (e) {} }
  return s;
}

function existingSlugs() {
  return new Set(fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => f.replace(/\.json$/, '')));
}
function cikToSlugMap(slugSet) {
  const m = {};
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    try { const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); if (p.cik) m[normCik(p.cik)] = p.slug || f.replace(/\.json$/, ''); } catch (e) {}
  }
  return m;
}

function loadOverrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8')); } catch (e) { return { skip: {}, fields: {} }; }
}

// Count prior failures per slug from the build log. Persistent rejects (obscure
// firms that can't clear the depth gate) otherwise sit at the top of the
// refCount-sorted remaining queue and get re-attempted — and re-rejected —
// every batch, burning calls and blocking progress. Skip after MAX_FAILS so
// batches spend calls on generatable companies; these stay orphan hub-nodes and
// can be revisited later (e.g. with inbound-reference context seeding).
const MAX_FAILS = 3;
function loadFailCounts() {
  const m = {};
  try {
    for (const line of fs.readFileSync(LOG_PATH, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const o = JSON.parse(line); if (o.slug && o.status && o.status !== 'ok') m[o.slug] = (m[o.slug] || 0) + 1; } catch (e) {}
    }
  } catch (e) {}
  return m;
}

function buildQueue() {
  const slugSet = existingSlugs();
  const c2s = cikToSlugMap(slugSet);
  const ov = loadOverrides();
  const fails = loadFailCounts();
  const q = [];
  if (TIER === '1') {
    const cb = JSON.parse(fs.readFileSync(CB_PATH, 'utf8')).companies || [];
    const seen = new Set();
    // Name fingerprint of every existing portal — catches Tier-2 portals whose
    // cik is null (so c2s misses) but whose name matches a CB row (e.g. eligible
    // "Compass Pathways plc" vs existing cik-null "Compass Pathways"). Prevents
    // recurring name-variant dup generation across eligible batches.
    const pNames = portalNameKeys();
    for (const c of cb) {
      const hasPortal = (c.s && slugSet.has(c.s)) || c2s[normCik(c.c)] || pNames.has(nameKey(c.n));
      if (hasPortal) continue;
      const slug = nameSlug(c.n) || c.s;
      if (slugSet.has(slug) || seen.has(slug)) continue;       // dedup CB rows that collapse to one slug (e.g. NICE x2)
      if (ov.skip && ov.skip[slug]) continue;                  // junk/duplicate identity rows
      if ((fails[slug] || 0) >= MAX_FAILS) continue;           // persistent depth-gate rejects
      seen.add(slug);
      const t = { slug, name: c.n, ticker: c.t || null, cik: c.c || null, domainId: canonDomain(c.d), _cbSlug: c.s };
      if (ov.fields && ov.fields[slug]) Object.assign(t, ov.fields[slug]);
      q.push(t);
    }
  } else {
    const reg = JSON.parse(fs.readFileSync(ORPHAN_PATH, 'utf8')).orphans || {};
    const rows = Object.entries(reg).filter(([s, o]) => o.densifyCandidate && o.archetype === 'company' && !slugSet.has(s) && !(ov.skip && ov.skip[s]) && !ALIAS[s] && (fails[s] || 0) < MAX_FAILS);
    // intra-queue dedup by baseSlug: a portal already covering a base (incl.
    // suffixed forms like stride_inc -> base stride) skips the whole group; else
    // pick one canonical per base (bare-base preferred, else highest refCount).
    // Prevents generating the same entity twice in one batch (unitedhealth +
    // unitedhealth_group). Abbreviation/separator dups (tsmc, lyondellbasell) are
    // handled by the alias map (!ALIAS[s]) via _alias-manual.json.
    const portalBases = new Set([...slugSet].map(baseSlug));
    const groups = new Map();
    for (const [slug, o] of rows) { const b = baseSlug(slug); if (!groups.has(b)) groups.set(b, []); groups.get(b).push([slug, o]); }
    const picks = [];
    for (const [b, grp] of groups) {
      if (portalBases.has(b)) continue;                                  // a portal already exists for this base
      const bare = grp.find(([s]) => s === b);
      const canon = bare || grp.reduce((m, c) => (c[1].refCount > m[1].refCount ? c : m), grp[0]);
      picks.push(canon);
    }
    picks.sort((a, b) => b[1].refCount - a[1].refCount);
    // second dedup pass by name fingerprint: skip if an existing portal already
    // has this name, or if an earlier (higher-refCount) pick already claimed it.
    const pNames = portalNameKeys();
    const seenName = new Set();
    for (const [slug, o] of picks) {
      const nk = nameKey(o.name);
      if (nk && (pNames.has(nk) || seenName.has(nk))) continue;
      if (nk) seenName.add(nk);
      const t = { slug, name: o.name, ticker: null, cik: null, domainId: canonDomain((o.domains && o.domains[0]) || 'economy'), _refCount: o.refCount };
      if (ov.fields && ov.fields[slug]) Object.assign(t, ov.fields[slug]);
      q.push(t);
    }
  }
  return q;
}

function logLine(obj) { try { fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n'); } catch (e) {} }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function enrichOne(target, hint) {
  const body = { target: hint ? { ...target, instructions: hint } : target, currentPortal: null };
  const t0 = Date.now();
  // transient network errors (ECONNRESET / fetch failed) must NOT abort the
  // whole batch — retry a few times with backoff, then report a soft failure.
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(BASE_URL + '/api/enrich-portal-claude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok && j && j.ok, j, elapsedS: ((Date.now() - t0) / 1000).toFixed(0) };
    } catch (e) {
      lastErr = e;
      const wait = attempt * 8000;
      console.log(`    (network error attempt ${attempt}/4: ${e && e.message || e} — retry in ${wait / 1000}s)`);
      await sleep(wait);
    }
  }
  return { ok: false, j: { error: 'network: ' + (lastErr && lastErr.message || String(lastErr)) }, elapsedS: ((Date.now() - t0) / 1000).toFixed(0), networkError: true };
}

const errStr = j => { const e = j && j.error; if (e == null) return j ? JSON.stringify(j).slice(0, 160) : 'no response'; return typeof e === 'string' ? e : JSON.stringify(e).slice(0, 160); };

async function main() {
  const queue = buildQueue();
  console.log(`=== fractal portal build — tier ${TIER} ===`);
  console.log(`base: ${BASE_URL}  queue: ${queue.length}  limit: ${LIMIT}  dryRun: ${DRY}`);
  let done = 0, failed = 0, skipped = 0;
  for (const t of queue) {
    if (done + failed >= LIMIT) break;
    const fp = path.join(DIR, t.slug + '.json');
    if (fs.existsSync(fp)) { skipped++; continue; }
    if (DRY) { console.log(`  DRY would generate: ${t.slug}  (${t.name})`); done++; continue; }
    try {
      let res = await enrichOne(t);
      let dr = (res.j && res.j.densityReport) || {};
      // depth + placeholder + brain-fidelity gate
      function countDN(p) { let n = 0; const w = v => { if (v == null) return; if (typeof v === 'string') n += (v.match(/DATA_NEEDED/g) || []).length; else if (Array.isArray(v)) v.forEach(w); else if (typeof v === 'object') Object.values(v).forEach(w); }; w(p); return n; }
      function brainFidelity(p) {
        const fn = (p && p.functionalNetwork) || {};
        let total = 0, tagged = 0;
        const roles = new Set();
        for (const c in fn) { const a = Array.isArray(fn[c]) ? fn[c] : (fn[c] ? [fn[c]] : []); for (const e of a) { if (!e || typeof e !== 'object') continue; total++; if (e.brainNodeId && e.neuralRole && e.brainNodeRole) tagged++; if (e.neuralRole) roles.add(e.neuralRole); } }
        return { total, tagged, rate: total ? tagged / total : 0, roles: roles.size };
      }
      let dnCount = res.j && res.j.portal ? countDN(res.j.portal) : 0;
      let bf = res.j && res.j.portal ? brainFidelity(res.j.portal) : { rate: 0, roles: 0 };
      const needsRetry = res.ok && (dr.genericityWarning || (typeof dr.anchoredRate === 'number' && dr.anchoredRate < MIN_ANCHORED) || dnCount > MAX_DATA_NEEDED || bf.rate < MIN_BRAIN_TAGGED || bf.roles < MIN_NEURAL_ROLES_PRESENT);
      if (needsRetry) {
        console.log(`  ${t.slug}: gate (anchored ${dr.anchoredRate}, DATA_NEEDED ${dnCount}, brain-tagged ${(bf.rate * 100).toFixed(0)}%, roles ${bf.roles}) — retry with hint`);
        res = await enrichOne(t, 'Be maximally specific with REAL details — and every functionalNetwork entry must mirror the brain: assign brainNodeId, neuralRole (Sensory/Motor/Peer/DMN/Salience/PFC/Limbic), and brainNodeRole. If you do not know a specific detail (e.g. CEO name, exact $ amount), OMIT the entry or the sentence — DO NOT write "[DATA_NEEDED: ...]" placeholders. The operator must see only verified specifics, fully brain-tagged, no placeholders.');
        dr = (res.j && res.j.densityReport) || {};
        dnCount = res.j && res.j.portal ? countDN(res.j.portal) : 0;
        bf = res.j && res.j.portal ? brainFidelity(res.j.portal) : bf;
      }
      if (!res.ok || !res.j.portal) { failed++; console.log(`  ${t.slug}: FAIL ${errStr(res.j)}`); logLine({ tier: TIER, slug: t.slug, name: t.name, status: res.networkError ? 'fail-network' : 'fail', detail: errStr(res.j) }); continue; }
      if (dr.genericityWarning || (typeof dr.anchoredRate === 'number' && dr.anchoredRate < MIN_ANCHORED) || dnCount > MAX_DATA_NEEDED || bf.rate < MIN_BRAIN_TAGGED || bf.roles < MIN_NEURAL_ROLES_PRESENT) { failed++; console.log(`  ${t.slug}: REJECT (anchored ${dr.anchoredRate}, DATA_NEEDED ${dnCount}, brain-tagged ${(bf.rate * 100).toFixed(0)}%, roles ${bf.roles})`); logLine({ tier: TIER, slug: t.slug, name: t.name, status: 'reject-generic', anchoredRate: dr.anchoredRate, dataNeeded: dnCount, brainTagRate: bf.rate, neuralRoles: bf.roles }); continue; }
      const portal = res.j.portal;
      portal.slug = t.slug;
      // NEVER keep a model-fabricated cik. When we didn't pass one (Tier-2
      // orphans), the model invents a cik that collides with real companies
      // (flowserve got Equifax's, 6 cos shared 1616707). null = honest unknown.
      portal.cik = t.cik ? String(t.cik) : null;
      if (t.domainId) portal.domainId = portal.domainId || t.domainId;
      fs.writeFileSync(fp, JSON.stringify(portal, null, 2));
      done++;
      console.log(`  ${t.slug}: OK ${dr.functionalNetworkTotal} entries, anchored ${dr.anchoredRate}, ${res.elapsedS}s  (${t.name})`);
      logLine({ tier: TIER, slug: t.slug, name: t.name, status: 'ok', entries: dr.functionalNetworkTotal, anchoredRate: dr.anchoredRate, elapsedS: res.elapsedS, cbSlug: t._cbSlug || null });
    } catch (e) {
      failed++;
      console.log(`  ${t.slug}: ERROR ${e && e.message || e} — continuing`);
      logLine({ tier: TIER, slug: t.slug, name: t.name, status: 'error', detail: String(e && e.message || e) });
    }
  }
  console.log(`\nbatch done: generated ${done}, failed ${failed}, skipped(existing) ${skipped}, queue remaining ~${queue.length - skipped - done - failed}`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
