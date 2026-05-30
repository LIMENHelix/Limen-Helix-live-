#!/usr/bin/env node
/**
 * scripts/portal-create-multipass.mjs
 *
 * Multi-pass portal-creation orchestrator for DENSE multi-segment
 * companies that blow the single-call enricher's 14K-token JSON
 * budget (Cardinal Health, Cigna, Celanese, Carlisle, CGI, etc.).
 *
 * Strategy: call /api/enrich-portal-claude 5x with focused
 * instructions, each producing one slice of the portal. Stitch
 * client-side. Each slice ~3-4K output tokens → comfortably
 * under the per-call cap.
 *
 *   Pass 1: META   — schema fields, financialHealth, intelligenceCycle,
 *                    domainRelevance + portalRelevance prose
 *   Pass 2: SUPPLY — functionalNetwork.suppliers + logisticsPartners
 *   Pass 3: DEMAND — functionalNetwork.customers + competitors
 *   Pass 4: CTRL   — regulators + capitalProviders + executiveTeam +
 *                    marketSignals + auditor
 *   Pass 5: STITCH — local merge + validation (no LLM call)
 *
 * Usage:
 *   node scripts/portal-create-multipass.mjs --slug bristol_myers_squibb --cik 0000014272 --ticker BMY --name "Bristol-Myers Squibb Company" --domain medicine
 *
 *   Optional:
 *     --industry "..."
 *     --hints "..."  (added to every pass's instructions for context)
 *     --base-url <url>  (defaults https://limenhelix.com)
 *     --dry-run         (don't write portal; print combined JSON to stdout)
 *
 * Total cost ~5x single-call: ~$0.10 per portal in Haiku tokens.
 * Total wall: ~8-10 minutes (90s spacing between calls + 60-90s per call).
 *
 * IP note: orchestrator only assembles the model's output. No
 * copyrighted material reproduced. Federal forms + public 10-K
 * facts only.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}
function hasArg(name) { return args.indexOf('--' + name) !== -1; }

const SLUG = arg('slug');
const CIK = arg('cik');
const TICKER = arg('ticker');
const NAME = arg('name');
const DOMAIN = arg('domain');
const INDUSTRY = arg('industry', '');
const HINTS = arg('hints', '');
const BASE = arg('base-url', process.env.LIMEN_BASE_URL || 'https://limenhelix.com');
const TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const DRY = hasArg('dry-run');

if (!SLUG || !CIK || !NAME) {
  console.error('Usage: --slug X --cik X --name X [--ticker X --domain X --industry X --hints X --base-url X --dry-run]');
  process.exit(1);
}

function headers() {
  const h = { 'content-type': 'application/json' };
  if (TOKEN) h.authorization = 'Bearer ' + TOKEN;
  return h;
}

const BASE_TARGET = {
  slug: SLUG, cik: CIK, ticker: TICKER || null, name: NAME,
  domainId: DOMAIN || null, industry: INDUSTRY || null
};

const PASS_INSTRUCTIONS = {
  pass1_meta: (
    'MULTI-PASS PORTAL CREATION — PASS 1 OF 5 (META + INTELLIGENCE CYCLE).\n' +
    'Return a complete v2.0.1 portal JSON shell. POPULATE: schemaVersion, type, companyId, slug, cik, ticker, sic (current NAICS 2022 6-digit code), industry, domainId, portalAttachment, brainNodeId, neuralRole, brainNodeRole, intelligenceCycle (all 7 layers with 3-4 specific items each), kernelTwoPeerCohort fields (cohort + sicCode + peerNotes), fredSeries (6-10 entries with id + label + relevance), commodityExposure (3-7 entries), domainRelevance + portalRelevance + helixReportMode + helixReportUrl prose (2-3 sentences each), financialHealth (latestQuarter + revenueLast4Q OR equivalent + historyQuarters + opportunitySignals + warningSignals + commercializationStatus). LEAVE ALL functionalNetwork CATEGORIES AS EMPTY ARRAYS — they will be populated in later passes. KEEP TOTAL OUTPUT under 9000 tokens. ' + HINTS
  ),
  pass2_supply: (
    'MULTI-PASS PORTAL CREATION — PASS 2 OF 5 (SUPPLY SIDE).\n' +
    'Return a portal JSON with ONLY functionalNetwork.suppliers (8-12 entries) + functionalNetwork.logisticsPartners (3-5 entries) populated. ALL OTHER fields and functionalNetwork categories should be empty / null / DATA_NEEDED — they are populated in other passes. Each entry must have name + slug + ticker + cik (if public) + brainNodeId + brainNodeRole + neuralRole + relationshipNote (50-70 words with specific named programs, contracts, dollar amounts, dates per existing portal rules). KEEP TOTAL OUTPUT under 9000 tokens. ' + HINTS
  ),
  pass3_demand: (
    'MULTI-PASS PORTAL CREATION — PASS 3 OF 5 (DEMAND SIDE).\n' +
    'Return a portal JSON with ONLY functionalNetwork.customers (3-5 entries) + functionalNetwork.competitors (4-6 entries) populated. ALL OTHER categories empty. Each entry: name + slug + ticker + cik + brainNodeId + brainNodeRole + neuralRole + relationshipNote (50-70 words). KEEP UNDER 9000 tokens. ' + HINTS
  ),
  pass4_ctrl: (
    'MULTI-PASS PORTAL CREATION — PASS 4 OF 5 (CONTROL / CAPITAL).\n' +
    'Return a portal JSON with ONLY functionalNetwork.regulators (4-6 entries) + functionalNetwork.capitalProviders (3-5 entries) + functionalNetwork.executiveTeam (3-5 entries) + functionalNetwork.marketSignals (2-4 entries) + functionalNetwork.auditor (single object) populated. ALL OTHER functionalNetwork categories empty. Each entry: name + slug + ticker + cik + brainNodeId + brainNodeRole + neuralRole + relationshipNote (50-70w). KEEP UNDER 11000 tokens. ' + HINTS
  )
};

async function callPass(passKey) {
  console.log('-- ' + passKey + ' --');
  const target = Object.assign({}, BASE_TARGET, { instructions: PASS_INSTRUCTIONS[passKey] });
  const t0 = Date.now();
  const r = await fetch(BASE + '/api/enrich-portal-claude', {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ target, maxTokens: 12000 })
  });
  const j = await r.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  if (!j.ok) {
    console.log('  FAIL after ' + elapsed + 's: ' + (j.error || '?') + (j.parseError ? ' :: ' + j.parseError : ''));
    return null;
  }
  const dr = j.densityReport || {};
  console.log('  OK in ' + elapsed + 's — entries ' + dr.functionalNetworkTotal + ' anchored=' + dr.anchoredRate);
  return j.portal;
}

function stitch(p1, p2, p3, p4) {
  if (!p1) throw new Error('pass 1 missing — cannot stitch');
  const out = Object.assign({}, p1);
  out.functionalNetwork = out.functionalNetwork || {};
  const fn = {};

  function pickArr(p, key) {
    if (!p) return [];
    const v = (p.functionalNetwork || {})[key];
    return Array.isArray(v) ? v : [];
  }

  fn.suppliers         = pickArr(p2, 'suppliers');
  fn.logisticsPartners = pickArr(p2, 'logisticsPartners');
  fn.customers         = pickArr(p3, 'customers');
  fn.competitors       = pickArr(p3, 'competitors');
  fn.regulators        = pickArr(p4, 'regulators');
  fn.capitalProviders  = pickArr(p4, 'capitalProviders');
  fn.executiveTeam     = pickArr(p4, 'executiveTeam');
  fn.marketSignals     = pickArr(p4, 'marketSignals');

  // auditor is singular object
  if (p4 && p4.functionalNetwork && p4.functionalNetwork.auditor && typeof p4.functionalNetwork.auditor === 'object' && !Array.isArray(p4.functionalNetwork.auditor)) {
    fn.auditor = p4.functionalNetwork.auditor;
  }

  // dedupe by slug to handle accidental overlap between passes
  function dedupe(arr) {
    if (!Array.isArray(arr)) return arr;
    const seen = new Set();
    return arr.filter(e => {
      if (!e || typeof e !== 'object') return false;
      const k = (e.slug || '') + '|' + (e.cik || '') + '|' + (e.name || '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  for (const key of ['suppliers', 'logisticsPartners', 'customers', 'competitors', 'regulators', 'capitalProviders', 'executiveTeam', 'marketSignals']) {
    fn[key] = dedupe(fn[key]);
  }

  out.functionalNetwork = fn;

  // Recompute density
  let total = 0;
  for (const key of ['suppliers', 'logisticsPartners', 'customers', 'competitors', 'regulators', 'capitalProviders', 'executiveTeam', 'marketSignals']) {
    total += (fn[key] || []).length;
  }
  if (fn.auditor) total += 1;
  return { portal: out, total };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== multi-pass portal creation ===');
  console.log('  slug:    ' + SLUG);
  console.log('  cik:     ' + CIK);
  console.log('  name:    ' + NAME);
  console.log('  domain:  ' + (DOMAIN || 'n/a'));
  console.log('  base:    ' + BASE);
  console.log('  dryRun:  ' + DRY);
  console.log('');

  // Fire passes serially with 90s spacing to respect TPM caps
  const p1 = await callPass('pass1_meta');
  await sleep(90000);
  const p2 = await callPass('pass2_supply');
  await sleep(90000);
  const p3 = await callPass('pass3_demand');
  await sleep(90000);
  const p4 = await callPass('pass4_ctrl');

  console.log('');
  console.log('-- stitch --');
  const failures = [['pass1_meta', p1], ['pass2_supply', p2], ['pass3_demand', p3], ['pass4_ctrl', p4]].filter(([k, v]) => !v).map(([k]) => k);
  if (failures.length) {
    console.log('  some passes failed: ' + failures.join(', '));
    console.log('  will stitch what we have');
  }
  if (!p1) {
    console.log('  CRITICAL: pass1 meta failed; cannot stitch. Aborting.');
    process.exit(2);
  }

  const { portal, total } = stitch(p1, p2, p3, p4);
  console.log('  stitched: ' + total + ' total entries across functionalNetwork');

  // Override any meta fields the user supplied
  if (CIK) portal.cik = CIK.padStart(10, '0');
  if (NAME) portal.name = NAME;
  if (TICKER) portal.ticker = TICKER;
  if (DOMAIN) portal.domainId = DOMAIN;
  if (SLUG) portal.slug = SLUG;

  if (DRY) {
    console.log('');
    console.log(JSON.stringify(portal, null, 2));
  } else {
    const outPath = path.resolve('assets/data/companies/' + SLUG + '.json');
    await fs.writeFile(outPath, JSON.stringify(portal, null, 2), 'utf8');
    console.log('  WROTE: ' + outPath);
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log('  passes succeeded: ' + (4 - failures.length) + ' / 4');
  console.log('  total fn entries: ' + total);
  if (failures.length) console.log('  failed passes: ' + failures.join(', '));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
