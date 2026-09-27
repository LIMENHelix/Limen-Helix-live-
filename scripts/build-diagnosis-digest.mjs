#!/usr/bin/env node
/**
 * build-diagnosis-digest.mjs — Track 1 of the Capital Conversion opportunity work.
 *
 * The domain brains' per-cycle deriveDiagnoses() reads ONLY the L1 root portal
 * file (/assets/data/domains/{portalKey}.json, ~5 issues). The deep subportal
 * tree (L2-L7, hundreds of files per domain) already carries thousands of
 * authored issues + treatments that the brain never consumes.
 *
 * This script pre-aggregates that deep tree into ONE lean per-domain digest the
 * base brain can fetch once (no 200-file-per-cycle fetch flood). Each digest
 * diagnosis arrives with its treatments already resolved (circuit nodeId ->
 * activation brainNodeId, within the same portal file), so the brain can inject
 * stress-gated deep diagnoses straight into state.diagnoses and let each
 * domain's existing opportunity generator surface them.
 *
 * Pure data transform — NO Anthropic / API calls, no new content authored.
 * That (authoring genuinely-missing diagnoses) is Track 2, separately gated.
 *
 *   node scripts/build-diagnosis-digest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// Full L1-L7 tree lives in the sibling repo (24 GB, 465k files); the live repo
// only carries the deployable L1-L3 slice. Resolution order (first hit wins):
//   1. LIMEN_FULL_DOMAINS_DIR env var (configurable/discoverable for CI + other machines)
//   2. the default sibling-repo path (same convention as build-cumulative-fold.mjs:33-35)
// FAIL CLOSED: if no full-tree source exists, the build aborts rather than
// silently regenerating a materially smaller artifact from the shallow corpus.
// Explicit opt-out: --allow-shallow or LIMEN_ALLOW_SHALLOW=1 (recorded in output).
// portalKey == file prefix for all 20 brains (verified): most = domainId,
// plus medicine='medicine', science='science', trade='trade'.
const PORTAL_KEYS = [
  'p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
];

const FULL_DOMAINS = process.env.LIMEN_FULL_DOMAINS_DIR || 'C:\\Users\\Chris\\Limen-Helix\\assets\\data\\domains';
const LIVE_DOMAINS = path.join(ROOT, 'assets', 'data', 'domains');
const ALLOW_SHALLOW = process.env.LIMEN_ALLOW_SHALLOW === '1' || process.argv.indexOf('--allow-shallow') !== -1;
// Sentinel v2 — canonical per-domain invariant, measured against the real corpus
// (2026-09-26): all 20 portal roots present; every domain carries >=1000 subtree
// files (real minimum 17,059; the deployed shallow corpus has ~190/domain);
// every domain represents depths 2-6 (some reach 7-8; p2_agri/governance/
// population top out at 6). Rejects empty, shallow, partial, single-domain, and
// missing-depth sources instead of stamping them 'full-tree'. Non-key trees
// (legal, psychedelic, …) are tolerated — the build only reads the 20 keys.
function fullTreeReport(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch (e) { return { ok: false, reason: 'unreadable: ' + e.message }; }
  const byKey = {};
  const keySeg = {};
  PORTAL_KEYS.forEach(k => { byKey[k] = { root: false, files: 0, depths: new Set() }; keySeg[k] = k.split('_').length; });
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    const slug = n.replace(/\.json$/, '');
    for (const k of PORTAL_KEYS) {
      if (slug === k) { byKey[k].root = true; break; }
      if (slug.startsWith(k + '_')) {
        byKey[k].files++;
        byKey[k].depths.add(slug.split('_').length - (keySeg[k] - 1));
        break;
      }
    }
  }
  const missing = PORTAL_KEYS.filter(k => !byKey[k].root);
  if (missing.length) return { ok: false, reason: 'missing portal roots: ' + missing.join(', ') };
  const small = PORTAL_KEYS.filter(k => byKey[k].files < 1000);
  if (small.length) return { ok: false, reason: 'domains below full-tree size (<1000 files): ' + small.join(', ') };
  const REQ_DEPTHS = [2, 3, 4, 5, 6];
  const missingDepth = PORTAL_KEYS.filter(k => !REQ_DEPTHS.every(d => byKey[k].depths.has(d)));
  if (missingDepth.length) return { ok: false, reason: 'domains missing depths 2-6: ' + missingDepth.join(', ') };
  return { ok: true };
}
// Corpus discovery/validation is DEFERRED to the executable main path so the
// module can be imported for its pure functions (stratifiedPick) without the
// external corpus — BUILD_DIGEST_SKIP_MAIN=1 must work in a clean checkout.
let FULL_REPORT = { ok: false, reason: 'not evaluated (import-only mode)' };
let HAS_FULL = false;
let DOMAINS_DIR = null;
const OUT_DIR = path.join(ROOT, 'assets', 'data', 'deep');

const MAX_TX_PER_DX_DEFAULT = 2;
const MAX_TX_PER_DX_BY_DOMAIN = { finance: 6 };
const MAX_DX_PER_DOMAIN = 180; // brain injects only ~8 stress-gated per cycle; keep the richest + urgent

// Exported for tests (import with BUILD_DIGEST_SKIP_MAIN=1). Input is the
// globally ranked deduped diagnosis list; output is the stratified window.
// See the reserve-first comment at the call site for the selection rule.
export function stratifiedPick(sortedDeduped, maxPick) {
  const RESERVE_PER_DEPTH = 5;
  const buckets = {};
  sortedDeduped.forEach(d => { (buckets[d.depth] = buckets[d.depth] || []).push(d); });
  const picked = [];
  const contributed = {};
  for (const dep of Object.keys(buckets).map(Number).sort((a, b) => a - b)) {
    const seatsLeft = maxPick - picked.length;
    if (seatsLeft <= 0) break;   // more depths than seats: ascending-depth priority
    const take = buckets[dep].splice(0, Math.min(RESERVE_PER_DEPTH, seatsLeft));
    picked.push(...take);
    contributed[dep] = take.length;
  }
  for (const dep in DEPTH_QUOTA) {
    if (picked.length >= maxPick) break;
    const remaining = Math.max(0, Math.min(DEPTH_QUOTA[dep] - (contributed[dep] || 0), maxPick - picked.length));
    if (buckets[dep] && remaining > 0) picked.push(...buckets[dep].slice(0, remaining));
  }
  if (picked.length < maxPick) {
    const chosen = new Set(picked);
    for (const d of sortedDeduped) {
      if (picked.length >= maxPick) break;
      if (!chosen.has(d)) { picked.push(d); chosen.add(d); }
    }
  }
  return picked;
}
// Depth-stratified slots (sums to MAX_DX_PER_DOMAIN). With the full L2-L7 tree as
// input a single global top-180 is swallowed by L6 (30k+ issues); quotas keep every
// level represented. Unspent quota redistributes into the global ranking.
const DEPTH_QUOTA = { 2: 30, 3: 40, 4: 40, 5: 35, 6: 25, 7: 10 };
// Synthetic-content marker. Repo audits (docs/audits/energy-portal-cortex-quality-c1.md)
// found deep-tree treatments are procedurally generated from a fixed verb family
// (same classifier the brains carry inline, ENERGY_REFERENCE.md:4117). Tagged, NOT
// removed — CONTRACT doctrine is honest provenance, not hiding scaffold.
const MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
const SUMMARY_MAX = 160;
const EV_RANK = { Strong: 4, A: 4, Moderate: 3, B: 3, C: 2, Emerging: 1 };

// Urgent current-situation themes (grounded in June 2026 news: Colorado/Lake
// Powell drought emergency, $72B migration enforcement + TPS rulings, etc.).
// Diagnoses matching these float to the TOP of the digest so the brain's
// stress-gated top-N pick always includes the current-relevant ones instead of
// only the treatment-richest. Pure ranking bias — no content is added.
const URGENT_THEMES = {
  water:      /water|drought|aquifer|reservoir|potable|sewer|wastewater|scarcity|hydropower/i,
  migration:  /migrat|refugee|asylum|\bborder\b|displace|immigr|deportation/i,
  weather:    /\bweather\b|storm|hurricane|flood|wildfire|\bheat\b|heatwave|extreme|climate/i,
  population: /population|demograph|aging|fertility|housing|birth rate|depopulat/i,
  economy:    /inflation|recession|interest rate|unemploy|tariff|\bdebt\b|deficit|fiscal|cost of living/i,
  grid:       /\bgrid\b|blackout|\bpower\b|electric|outage|capacity overload/i,
  food:       /\bfood\b|famine|crop|harvest|agricultur|supply shortage/i,
  health:     /outbreak|epidemic|pandemic|disease|shortage|overdose/i,
  conflict:   /conflict|\bwar\b|security threat|cyberattack|terror|sanction/i
};

function matchThemes(text) {
  const t = [];
  for (const k in URGENT_THEMES) if (URGENT_THEMES[k].test(text)) t.push(k);
  return t;
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function bestCircuitEvidence(circuits) {
  let best = '', bestRank = -1;
  (circuits || []).forEach(c => {
    const r = EV_RANK[c.evidence] || 0;
    if (r > bestRank) { bestRank = r; best = c.evidence || ''; }
  });
  return best;
}

function buildDigest(pk) {
  const files = fs.readdirSync(DOMAINS_DIR)
    .filter(f => f.endsWith('.json') && (f === pk + '.json' || f.startsWith(pk + '_')));

  const diagnoses = [];
  let portalCount = 0;

  files.forEach(file => {
    const slug = file.replace(/\.json$/, '');
    // Depth relative to the portal key — the key itself may contain underscores
    // (p2_agri): without normalization every level shifted by one (root counted
    // as depth 2, real L7 as depth 8, breaking the stratified quotas).
    const depth = slug.split('_').length - (pk.split('_').length - 1);
    if (depth < 2) return;                        // skip the L1 root — brain already reads it
    const j = readJSON(path.join(DOMAINS_DIR, file));
    if (!j || !Array.isArray(j.issues) || !j.issues.length) return;
    portalCount++;

    // Resolve activation node -> treatments within THIS portal file.
    const byNode = {};
    (j.activations || []).forEach(a => {
      if (!a || !a.brainNodeId) return;
      byNode[a.brainNodeId] = (byNode[a.brainNodeId] || []).concat(a.treatments || []);
    });

    j.issues.forEach(iss => {
      if (!iss || !iss.id) return;
      const circuits = iss.circuits || [];
      // `circuits` is the canonical runtime representation and may contain only the
      // resolved primary node. The authored circuit list is retained alongside it and
      // carries the full set of functional nodes whose activation records own the
      // treatments. Reading only `circuits` silently dropped most treatment links after
      // canonicalisation (for example Communication's 5,230 opportunities collapsed
      // to 366). Use the union for treatment lookup, but keep the canonical list in the
      // digest so diagnosis identity remains stable.
      const treatmentNodeIds = [];
      const treatmentNodeSeen = new Set();
      const addTreatmentNode = (c) => {
        if (!c || !c.nodeId || treatmentNodeSeen.has(c.nodeId)) return;
        treatmentNodeSeen.add(c.nodeId);
        treatmentNodeIds.push(c.nodeId);
      };
      circuits.forEach(addTreatmentNode);
      (iss._authored || []).forEach(addTreatmentNode);

      // Collect this diagnosis's treatments via the union of canonical and authored
      // circuit node ids.
      let tx = [];
      treatmentNodeIds.forEach(nodeId => {
        (byNode[nodeId] || []).forEach(t => {
          if (!t || !t.label) return;
          // Explicit THREE-STATE classification on every treatment:
          //   1 = scaffold (mad-lib verb family)
          //   0 = verified-eligible (AFFIRMATIVE provenance: non-empty citation
          //       AND implementation steps present in the source portal record)
          //   2 = unknown (regex miss WITHOUT affirmative provenance — a regex
          //       miss is not evidence of authorship; never verified-eligible)
          const _madlib = MADLIB_VERB.test(String(t.label));
          const _prov = !!(t.cite && String(t.cite).length > 3 && Array.isArray(t.steps) && t.steps.length > 0);
          const rec = { l: t.label, t: t.type || '', e: t.evidence || '', syn: _madlib ? 1 : (_prov ? 0 : 2) };
          tx.push(rec);
        });
      });
      const txCount = tx.length;
      // Keep the strongest-evidence treatments, capped.
      tx.sort((a, b) => (EV_RANK[b.e] || 0) - (EV_RANK[a.e] || 0));
      tx = tx.slice(0, MAX_TX_PER_DX_BY_DOMAIN[pk] || MAX_TX_PER_DX_DEFAULT);

      const themes = matchThemes(
        (iss.label || '') + ' ' + (iss.summary || '') + ' ' + (iss.id || '') + ' ' + slug
      );
      diagnoses.push({
        id: iss.id,
        label: iss.label || iss.id,
        summary: (iss.summary || '').slice(0, SUMMARY_MAX),
        slug: slug,
        sub: slug.split('_').slice(1).join('_') || '',
        depth: depth,
        circuits: circuits.map(c => c.nodeId).filter(Boolean),
        evidence: bestCircuitEvidence(circuits),
        themes: themes,
        tx: tx,
        txCount: txCount
      });
    });
  });

  // De-dup identical diagnosis ids across sibling portals — keep the richest.
  const byId = {};
  diagnoses.forEach(d => {
    const prev = byId[d.id];
    if (!prev || d.txCount > prev.txCount) byId[d.id] = d;
  });
  let deduped = Object.keys(byId).map(k => byId[k]);

  // Rank: urgent current-theme diagnoses FIRST (so the brain's stress-gated
  // top-N pick always includes them), then by treatment richness + evidence.
  // The brain only surfaces a handful per cycle, so the thin non-urgent tail
  // just bloats the fetch; it stays in the portal tree (reachable via eager
  // drill). The digest is the brain's working set.
  const totalBeforeCap = deduped.length;
  deduped.sort((a, b) =>
    ((b.themes.length ? 1 : 0) - (a.themes.length ? 1 : 0)) ||
    (b.txCount - a.txCount) ||
    ((EV_RANK[b.evidence] || 0) - (EV_RANK[a.evidence] || 0))
  );
  const urgentCount = deduped.filter(d => d.themes.length).length;

  // Complete identity/route manifest — EVERY deduped source diagnosis, sorted
  // by id (deterministic pagination). The stratified pick below is only the
  // ACTIVE WINDOW (180); the manifest keeps source IDs == reachable IDs exactly.
  // Retrieval route for any entry: /api/fetch-portal?domainId=<pk>_<slugSuffix>
  // (GitHub-backed, proven live). Manifest files are repo-side audit artifacts
  // (fleet ~886k entries; too heavy for the deploy bundle — see .vercelignore).
  const manifestEntries = deduped
    .map(d => [d.id, d.slug.slice(pk.length + 1), d.depth])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  // Stratified pick: buckets inherit the global sort order, so each depth keeps
  // its own richest/urgent entries; leftover slots fill from the global ranking.
  // RESERVE-FIRST (2026-09-27): every represented depth gets up to 5 seats before
  // the weighted table runs — a fixed 2..7 quota table shut deeper levels out of
  // the window entirely (education's 3 L8 diagnoses were unreachable). With >=5
  // entries per depth this lands on exactly the weighted quotas, so distributions
  // for depths that already had seats are unchanged. When MORE depths are
  // represented than the window can seat, reserves are assigned in ascending
  // depth order until the window is full (deterministic; documented rule — deep
  // overflow depths get zero seats that build, they are not silently dropped
  // from the manifest).
  deduped = stratifiedPick(deduped, MAX_DX_PER_DOMAIN);

  return {
    domain: pk,
    source: HAS_FULL ? 'full-tree' : 'live-shallow-authorized',
    portalCount: portalCount,
    diagnosisCount: deduped.length,
    diagnosisTotalAvailable: totalBeforeCap,
    manifestCount: manifestEntries.length,
    manifestFile: 'assets/data/deep/' + pk + '-diagnosis-manifest.json',
    urgentThemeCount: deduped.filter(d => d.themes.length).length,
    urgentThemeAvailable: urgentCount,
    treatmentTotal: deduped.reduce((s, d) => s + d.txCount, 0),
    // Only syn===1 is scaffold. syn===2 is UNKNOWN — counting truthy conflated
    // unknown with generated content (environment: 360 reported vs 359 actual).
    syntheticTreatments: deduped.reduce((s, d) => s + d.tx.filter(t => t.syn === 1).length, 0),
    unknownTreatments: deduped.reduce((s, d) => s + d.tx.filter(t => t.syn === 2).length, 0),
    diagnoses: deduped,
    _manifest: manifestEntries
  };
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN && process.env.BUILD_DIGEST_SKIP_MAIN !== '1') {
FULL_REPORT = fs.existsSync(FULL_DOMAINS) ? fullTreeReport(FULL_DOMAINS) : { ok: false, reason: 'path does not exist' };
HAS_FULL = FULL_REPORT.ok;
if (!HAS_FULL && !ALLOW_SHALLOW) {
  console.error('FAIL-CLOSED: no full-tree domain source at: ' + FULL_DOMAINS);
  console.error('  reason: ' + FULL_REPORT.reason);
  console.error('  Set LIMEN_FULL_DOMAINS_DIR to the full L1-L7 tree, or explicitly');
  console.error('  authorize the shallow deployed corpus (L1-L3 only, materially smaller');
  console.error('  artifact) with --allow-shallow or LIMEN_ALLOW_SHALLOW=1.');
  process.exit(1);
}
DOMAINS_DIR = HAS_FULL ? FULL_DOMAINS : LIVE_DOMAINS;

let grand = { domains: 0, diagnoses: 0, treatments: 0 };
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Optional CLI filter: `node scripts/build-diagnosis-digest.mjs finance` builds
// only the named portal keys (full-tree runs are heavy; proof first, fleet later).
// FAIL CLOSED on unknown targets — a typo must not exit 0 having written nothing
// and left stale artifacts behind.
const onlyKeys = process.argv.slice(2).filter(a => a.charAt(0) !== '-');
const unknownKeys = onlyKeys.filter(k => PORTAL_KEYS.indexOf(k) === -1);
if (unknownKeys.length) {
  console.error('FAIL-CLOSED: unknown portal key(s): ' + unknownKeys.join(', '));
  console.error('  Valid keys: ' + PORTAL_KEYS.join(', '));
  process.exit(1);
}
const KEYS = onlyKeys.length ? PORTAL_KEYS.filter(k => onlyKeys.indexOf(k) !== -1) : PORTAL_KEYS;
console.log('source:', DOMAINS_DIR, ' domains:', KEYS.join(','));

KEYS.forEach(pk => {
  const dg = buildDigest(pk);
  const out = path.join(OUT_DIR, pk + '-diagnosis-digest.json');
  // Complete identity/route manifest (see buildDigest): repo-side audit artifact.
  const manifest = {
    domain: pk,
    source: dg.source,
    count: dg._manifest.length,
    note: 'Every deduped source diagnosis, sorted by id. The 180-entry digest is only the ACTIVE WINDOW. Retrieve any entry: /api/fetch-portal?domainId=' + pk + '_<slugSuffix>',
    entries: dg._manifest
  };
  delete dg._manifest;
  fs.writeFileSync(out, JSON.stringify(dg));
  fs.writeFileSync(path.join(OUT_DIR, pk + '-diagnosis-manifest.json'), JSON.stringify(manifest));
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(
    pk.padEnd(15),
    'portals=' + String(dg.portalCount).padStart(3),
    'dx=' + String(dg.diagnosisCount).padStart(4),
    'urgent=' + String(dg.urgentThemeCount).padStart(3) + '/' + String(dg.urgentThemeAvailable).padStart(3),
    'tx=' + String(dg.treatmentTotal).padStart(5),
    '(' + kb + 'KB)'
  );
  grand.domains++; grand.diagnoses += dg.diagnosisCount; grand.treatments += dg.treatmentTotal;
});

console.log('---');
console.log('TOTAL', grand.domains, 'domains  ', grand.diagnoses, 'deep diagnoses  ', grand.treatments, 'treatment links');
}
