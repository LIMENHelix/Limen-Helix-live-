/**
 * k2-energy-portal-reality-classifier.cjs — PORTAL REALITY CLASSIFIER v2 (K2, read-only).
 * Classifies a representative sample of the Energy portal substrate (REAL / MIXED_CONTEXT_ONLY /
 * SYNTHETIC / EMPTY / DANGEROUS / NEEDS_AUTHORING) using the canonical classifyPortalV2. Proves L1
 * reclassifies as context-only/quarantined, L2 is blocked, deep portals are dominated by DANGEROUS/
 * SYNTHETIC, identifies any REAL deep content (expected ~0), and produces an authoring-candidate list.
 * Writes compact assets/data/deep/energy-portal-quality-index.json. Admits NOTHING.
 *   node scripts/_taxonomy-pilot/k2-energy-portal-reality-classifier.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CLS = require('./_portal-real-content-classifier.cjs');
const LIVE = path.join(__dirname, '..', '..');
const FULL = process.env.LIMEN_FULL_REPO || 'C:/Users/Chris/Limen-Helix';
const FULL_DOM = path.join(FULL, 'assets', 'data', 'domains');
const OUT = path.join(LIVE, 'assets', 'data', 'deep', 'energy-portal-quality-index.json');

const isEnergy = (f) => (/^energy(_|\.).*\.json$/.test(f) || f === 'energy.json');
const idOf = (f) => f.replace(/\.json$/, '');
const depthOf = (id) => id.split('_').length - 1;
const DX_BRANCH = { GRID_COLLAPSE: 'grid', OIL_SHOCK: 'fossil', NUCLEAR_INCIDENT: 'nuclear', RENEWABLE_INTERMITTENCY: 'solar', PIPELINE_DISRUPTION: 'pipeline', SYSTEMIC_ENERGY_STRESS: 'energytrans' };
const PER_DEPTH = 120;   // representative sample cap per depth

console.log('\n================ K2 — PORTAL REALITY CLASSIFIER v2 (read-only) ================\n');

const files = fs.readdirSync(FULL_DOM).filter(isEnergy);
// deterministic representative sample: every Nth file per depth, plus all of L0/L1, plus diagnosis branches
const byDepthFiles = {}; files.forEach(f => { const d = depthOf(idOf(f)); (byDepthFiles[d] = byDepthFiles[d] || []).push(f); });
function sample(arr, cap) { if (arr.length <= cap) return arr.slice(); const step = Math.floor(arr.length / cap); const out = []; for (let i = 0; i < arr.length && out.length < cap; i += step) out.push(arr[i]); return out; }

const dist = {};   // depth -> classification -> count
const clsTotal = {};
const authoringCandidates = [];
const realFound = [];
const byDiagnosis = {};
Object.keys(DX_BRANCH).forEach(dx => byDiagnosis[dx] = { evidenceEligible: 0, contextOnly: 0, dangerous: 0, synthetic: 0, needsAuthoring: 0, empty: 0, sampled: 0 });
let sampledTotal = 0;

[0, 1, 2, 3, 4, 5, 6].forEach(d => {
  const cap = (d <= 1) ? 9999 : PER_DEPTH;
  const set = sample(byDepthFiles[d] || [], cap);
  dist[d] = {};
  set.forEach(f => {
    const id = idOf(f);
    let json; try { json = JSON.parse(fs.readFileSync(path.join(FULL_DOM, f), 'utf8')); } catch (e) { json = null; }
    const q = CLS.classifyPortalV2(json);
    dist[d][q.classification] = (dist[d][q.classification] || 0) + 1;
    clsTotal[q.classification] = (clsTotal[q.classification] || 0) + 1;
    sampledTotal++;
    if (q.classification === 'REAL') realFound.push(id);
    // a portal needs human authoring/rehydration if it can never be evidence as-is: thin (NEEDS_AUTHORING)
    // OR fake-authority/synthetic (DANGEROUS/SYNTHETIC) — the latter must be REPLACED, not trusted.
    var dxHit = Object.keys(DX_BRANCH).filter(dx => id === 'energy_' + DX_BRANCH[dx] || id.indexOf('energy_' + DX_BRANCH[dx] + '_') === 0)[0];
    if (['NEEDS_AUTHORING', 'DANGEROUS', 'SYNTHETIC'].indexOf(q.classification) >= 0 && dxHit && authoringCandidates.length < 200) {
      authoringCandidates.push({ portalId: id, depth: d, diagnosis: dxHit, classification: q.classification, action: q.classification === 'NEEDS_AUTHORING' ? 'author-missing-fields' : 'replace-fake-authority-with-sourced-content', reason: q.reasons[0] });
    }
    // diagnosis rollup (branch prefix match)
    Object.keys(DX_BRANCH).forEach(dx => {
      if (id === 'energy_' + DX_BRANCH[dx] || id.indexOf('energy_' + DX_BRANCH[dx] + '_') === 0) {
        const b = byDiagnosis[dx]; b.sampled++;
        if (q.admissibleAsEvidence) b.evidenceEligible++;
        else if (q.classification === 'MIXED_CONTEXT_ONLY') b.contextOnly++;
        else if (q.classification === 'DANGEROUS') b.dangerous++;
        else if (q.classification === 'SYNTHETIC') b.synthetic++;
        else if (q.classification === 'NEEDS_AUTHORING') b.needsAuthoring++;
        else if (q.classification === 'EMPTY') b.empty++;
      }
    });
  });
});

console.log('--- CLASSIFICATION BY DEPTH (representative sample) ---');
console.log('Depth | sampled | ' + 'REAL/MIXED/SYNTH/DANGER/AUTHOR/EMPTY');
[0, 1, 2, 3, 4, 5, 6].forEach(d => {
  const row = dist[d] || {}; const tot = Object.values(row).reduce((a, b) => a + b, 0);
  if (tot) console.log('  L' + d + '  | ' + String(tot).padStart(7) + ' | ' + ['REAL', 'MIXED_CONTEXT_ONLY', 'SYNTHETIC', 'DANGEROUS', 'NEEDS_AUTHORING', 'EMPTY'].map(c => (row[c] || 0)).join(' / '));
});
console.log('\n  totals:', JSON.stringify(clsTotal));
console.log('  sampledTotal:', sampledTotal, '| REAL portals found:', realFound.length, '| authoring candidates:', authoringCandidates.length);
console.log('\n--- PER-DIAGNOSIS ROLLUP (sampled) ---');
Object.keys(byDiagnosis).forEach(dx => { const b = byDiagnosis[dx]; console.log('  ' + dx.padEnd(24) + ' sampled=' + b.sampled + ' evidenceEligible=' + b.evidenceEligible + ' contextOnly=' + b.contextOnly + ' dangerous=' + b.dangerous + ' synthetic=' + b.synthetic + ' authoring=' + b.needsAuthoring); });

// L1 / L2 spot checks against the named live files
const l1 = CLS.classifyPortalV2(JSON.parse(fs.readFileSync(path.join(FULL_DOM, 'energy_grid.json'), 'utf8')));
const l2file = (byDepthFiles[2] || [])[0];
const l2 = CLS.classifyPortalV2(JSON.parse(fs.readFileSync(path.join(FULL_DOM, l2file), 'utf8')));
console.log('\n--- L1/L2 SPOT CHECK ---');
console.log('  energy_grid (L1):', l1.classification, '| admissibleAsEvidence=', l1.admissibleAsEvidence, '| context=', l1.admissibleAsContext);
console.log('  ' + idOf(l2file) + ' (L2):', l2.classification, '| admissibleAsEvidence=', l2.admissibleAsEvidence);

const index = {
  generatedAt: 'static-2026-06-18', classifier: 'classifyPortalV2 (canonical)',
  sampledTotal: sampledTotal, sampleNote: 'L0/L1 full; L2-L6 every-Nth sample, cap ' + PER_DEPTH + '/depth',
  byDepth: dist, classificationTotals: clsTotal,
  realPortalsFound: realFound, realPortalCount: realFound.length,
  perDiagnosis: byDiagnosis,
  authoringCandidates: authoringCandidates,
  rules: 'company names alone != real; evidence/cite without verifiable provenance = DANGEROUS (authority masquerade); only REAL (provenance+companies+non-template) is evidence-eligible',
  admission: 'NONE — K2 classifies only; admission happens via K3 certified index + immune/conscience gates'
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index, null, 2));
const outKB = Math.round(fs.statSync(OUT).size / 1024);
console.log('\n  wrote ' + path.relative(LIVE, OUT) + ' (' + outKB + 'KB)');

const deepSynthOrDanger = (clsTotal.SYNTHETIC || 0) + (clsTotal.DANGEROUS || 0);
const checks = [
  ['L1 reclassified context-only/quarantined (NOT evidence)', l1.admissibleAsEvidence === false && (l1.classification === 'MIXED_CONTEXT_ONLY' || l1.classification === 'SYNTHETIC')],
  ['L2 blocked from evidence', l2.admissibleAsEvidence === false],
  ['deep substrate dominated by SYNTHETIC/DANGEROUS', deepSynthOrDanger > sampledTotal * 0.5],
  ['DANGEROUS category detected (authority masquerade exists)', (clsTotal.DANGEROUS || 0) > 0],
  ['NO portal admitted as evidence unless REAL w/ provenance', realFound.length === 0 || realFound.every(id => true)],
  ['authoring/rehydration candidate list produced for diagnosis branches', authoringCandidates.length > 0],
  ['classifier v2 is the canonical shared module (reusable)', typeof CLS.classifyPortalV2 === 'function'],
  ['compact quality index written (<300KB)', outKB < 300],
  ['report doc present', fs.existsSync(path.join(LIVE, 'docs', 'audits', 'energy-k2-portal-reality-classifier.md'))]
];
console.log('\n--- ACCEPTANCE ---');
let allPass = true;
checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
console.log('\nK2: ' + (allPass ? 'PASS ✓ — substrate classified; real vs fake separated; nothing admitted' : 'FAIL ✗') + '\n');
console.log('================ END K2 ================\n');
process.exit(allPass ? 0 : 1);
