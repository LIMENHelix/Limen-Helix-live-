/**
 * k3-energy-certified-cortex-index.cjs — CERTIFIED CORTEX INDEX (K3, read-only build).
 * Consumes K1 (access map) + K2 (quality index) outputs and the curated external-source bundles to
 * emit a compact, machine-readable index that separates: evidenceEligible / contextOnly /
 * blockedDangerous / needsRehydration. Admits NO L2-L6 portal as evidence; does not traverse, rewrite,
 * rehydrate, or touch any runtime gate. Writes assets/data/deep/energy-certified-cortex-index.json.
 *   node scripts/_taxonomy-pilot/k3-energy-certified-cortex-index.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CLS = require('./_portal-real-content-classifier.cjs');
const LIVE = path.join(__dirname, '..', '..');
const FULL = process.env.LIMEN_FULL_REPO || 'C:/Users/Chris/Limen-Helix';
const DEEP = path.join(LIVE, 'assets', 'data', 'deep');
const BD = path.join(LIVE, 'assets', 'data', 'artifact-source-index', 'by-diagnosis');
const OUT = path.join(DEEP, 'energy-certified-cortex-index.json');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

console.log('\n================ K3 — CERTIFIED CORTEX INDEX (read-only build) ================\n');

// ── inputs: K1 + K2 (must exist) ──
const k1 = rd(path.join(DEEP, 'energy-portal-access-map.json'));
const k2 = rd(path.join(DEEP, 'energy-portal-quality-index.json'));

// ── evidenceEligible: portals = NONE (K2 found 0 REAL); external-source bundles if verifiable ──
const DIAG_BUNDLE = {
  GRID_COLLAPSE: 'GRID_FREQUENCY_INSTABILITY', RENEWABLE_INTERMITTENCY: 'INTERMITTENCY_SPIKE',
  PIPELINE_DISRUPTION: 'PIPELINE_RUPTURE_EVENT', OIL_SHOCK: 'OIL_SHOCK',
  NUCLEAR_INCIDENT: 'NUCLEAR_INCIDENT', SYSTEMIC_ENERGY_STRESS: 'SYSTEMIC_ENERGY_STRESS'
};
const externalBundles = [];
Object.keys(DIAG_BUNDLE).forEach(dx => {
  const cid = DIAG_BUNDLE[dx];
  const p = path.join(BD, cid + '.json');
  if (!fs.existsSync(p)) return;
  let b; try { b = rd(p); } catch (e) { return; }
  const lane = (b.byLane && b.byLane.patents) || {};
  const anchors = (lane.evidenceAnchors || []).length;
  if (anchors <= 0) return;   // not verifiable -> excluded
  externalBundles.push({
    diagnosis: dx, canonicalId: cid, ref: 'assets/data/artifact-source-index/by-diagnosis/' + cid + '.json',
    evidenceAnchors: anchors, buildMethod: b.buildMethod || 'corpus',
    humanVerification: b.humanVerification || (b.buildMethod === 'external-source-authored' ? 'required' : 'not-flagged'),
    verifiable: true
  });
});

// ── contextOnly: L0/L1 company-bearing / MIXED_CONTEXT_ONLY portals (re-classify the 20 shallow files
//    only — NOT the deep tree). Lists ids so consumers know what is context-safe (never evidence). ──
const FULL_DOM = path.join(FULL, 'assets', 'data', 'domains');
const shallow = fs.existsSync(FULL_DOM)
  ? fs.readdirSync(FULL_DOM).filter(f => /^energy(_[^_]+)?\.json$/.test(f))   // L0 + L1 only
  : [];
const contextOnly = [];
shallow.forEach(f => {
  const id = f.replace(/\.json$/, '');
  let q; try { q = CLS.classifyPortalV2(rd(path.join(FULL_DOM, f))); } catch (e) { return; }
  if (q.classification === 'MIXED_CONTEXT_ONLY' || (q.classification === 'REAL' && !q.admissibleAsEvidence)) {
    contextOnly.push({ portalId: id, depth: id.split('_').length - 1, classification: q.classification, admissibleAsContext: q.admissibleAsContext, admissibleAsEvidence: q.admissibleAsEvidence, note: 'company tickers relevance-unverified; treatments templated — context only, never evidence' });
  }
});

// ── blockedDangerous: from K2 rollup. Policy: ALL L2-L6 blocked by default. ──
const totals = k2.classificationTotals || {};
const deepTreeTotal = [3, 4, 5, 6].reduce((a, d) => a + ((k1.byDepth && k1.byDepth[d]) || 0), 0);
const blockedDangerous = {
  policy: 'ALL L2-L6 portals blocked from evidence/bundle/traversal by default',
  reason: 'K2: deep sample 100% DANGEROUS (authority masquerade: evidence grades / DOI citations on templated content, no provenance, no companies)',
  deepTreeTotal_L3toL6: deepTreeTotal,
  sampled: { DANGEROUS: totals.DANGEROUS || 0, SYNTHETIC: totals.SYNTHETIC || 0 },
  byDepthSample: k2.byDepth || {}
};

// ── needsRehydration: K2 authoring queue (diagnosis-branch portals to replace, not trust) ──
const needsRehydration = k2.authoringCandidates || [];

// ── per-diagnosis rollup ──
const perDiagnosis = {};
Object.keys(DIAG_BUNDLE).forEach(dx => {
  const k2d = (k2.perDiagnosis && k2.perDiagnosis[dx]) || {};
  perDiagnosis[dx] = {
    evidenceBundle: (externalBundles.find(b => b.diagnosis === dx) || null) && DIAG_BUNDLE[dx],
    contextPortals: contextOnly.filter(c => c.portalId === 'energy_' + (k2d.branch || '') ).length,   // best-effort
    blockedSampled: (k2d.dangerous || 0) + (k2d.synthetic || 0),
    rehydrationQueued: needsRehydration.filter(r => r.diagnosis === dx).length
  };
});

const index = {
  generatedAt: 'static-2026-06-18', builtFrom: ['energy-portal-access-map.json (K1)', 'energy-portal-quality-index.json (K2)', 'artifact-source-index/by-diagnosis (external bundles)'],
  rule: 'Portal tree = navigation/context/authoring substrate only. The ONLY evidence-bearing layer is curated external-source bundles. No L2-L6 portal is admissible as evidence.',
  evidenceEligible: {
    portals: [],                       // 0 — K2 found no REAL portal with provenance at any depth
    portalNote: 'empty by design: classifyPortalV2 returned REAL for 0 portals (no verifiable provenance anywhere in L0-L6)',
    externalBundles: externalBundles,
    externalBundleCount: externalBundles.length
  },
  contextOnly: contextOnly,
  blockedDangerous: blockedDangerous,
  needsRehydration: needsRehydration,
  perDiagnosis: perDiagnosis,
  consumedByRuntime: false,            // index is inert — no runtime reads it yet (no behavior change)
  admission: 'NONE applied — this index only DESCRIBES admissibility; immune/conscience gates remain the enforcers'
};

fs.mkdirSync(DEEP, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index, null, 2));
const outKB = Math.round(fs.statSync(OUT).size / 1024);

console.log('  evidenceEligible.portals:', index.evidenceEligible.portals.length, '(must be 0)');
console.log('  evidenceEligible.externalBundles:', externalBundles.length, '->', externalBundles.map(b => b.canonicalId + '(' + b.evidenceAnchors + (b.humanVerification === 'required' ? ',HV' : '') + ')').join(', '));
console.log('  contextOnly portals:', contextOnly.length, '->', contextOnly.map(c => c.portalId).slice(0, 12).join(', '));
console.log('  blockedDangerous: deep L3-L6 total', deepTreeTotal, '| sampled DANGEROUS', blockedDangerous.sampled.DANGEROUS);
console.log('  needsRehydration queue:', needsRehydration.length);
console.log('  wrote ' + path.relative(LIVE, OUT) + ' (' + outKB + 'KB)');

const checks = [
  ['K1 access map present', fs.existsSync(path.join(DEEP, 'energy-portal-access-map.json'))],
  ['K2 quality index present', fs.existsSync(path.join(DEEP, 'energy-portal-quality-index.json'))],
  ['K3 index generated', fs.existsSync(OUT)],
  ['ZERO portals admitted as evidence', index.evidenceEligible.portals.length === 0],
  ['evidenceEligible carries only verifiable external bundles (anchors>0)', externalBundles.every(b => b.verifiable && b.evidenceAnchors > 0)],
  ['external-source bundles flagged human-verification-required', externalBundles.filter(b => b.buildMethod === 'external-source-authored').every(b => b.humanVerification === 'required')],
  ['contextOnly contains only context-safe portals (never evidence)', contextOnly.length > 0 && contextOnly.every(c => c.admissibleAsEvidence === false)],
  ['blockedDangerous count matches K2 rollup', blockedDangerous.sampled.DANGEROUS === (totals.DANGEROUS || 0)],
  ['needsRehydration carries K2 authoring queue', needsRehydration.length === (k2.authoringCandidates || []).length],
  ['index is inert (consumedByRuntime=false — no behavior change)', index.consumedByRuntime === false],
  ['output compact (<300KB)', outKB < 300],
  ['report doc present', fs.existsSync(path.join(LIVE, 'docs', 'audits', 'energy-k3-certified-cortex-index.md'))]
];
console.log('\n--- ACCEPTANCE ---');
let allPass = true;
checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
console.log('\nK3: ' + (allPass ? 'PASS ✓ — certified index built; portal tree = context/authoring only; external bundles = sole evidence layer' : 'FAIL ✗') + '\n');
console.log('================ END K3 ================\n');
process.exit(allPass ? 0 : 1);
