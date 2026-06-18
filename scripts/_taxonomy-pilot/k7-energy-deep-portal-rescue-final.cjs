/**
 * k7-energy-deep-portal-rescue-final.cjs — PHASE K7 final rescue audit (read-only capstone).
 * Confirms K0-K6 are complete and coherent, the critical gates + H7 still pass, no synthetic content is
 * admitted as evidence, and the four rescue artifacts (certified index, safe retrieval, authoring queue,
 * rehydration plan) exist. Answers "why have deep portals if we can't get there?" operationally.
 *   node scripts/_taxonomy-pilot/k7-energy-deep-portal-rescue-final.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const DEEP = path.join(ROOT, 'assets', 'data', 'deep');
const DOCS = path.join(ROOT, 'docs', 'audits');
const SC = __dirname;
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const has = (p) => fs.existsSync(p);
const R = require('../../assets/js/domain-brains/energy-cortex-retrieval.js');

console.log('\n================ K7 — ENERGY DEEP PORTAL RESCUE FINAL AUDIT ================\n');

// ── K0-K6 artifact presence ──
const artifacts = {
  K0: has(path.join(DOCS, 'energy-k0-substrate-location.md')) && has(path.join(SC, 'k0-energy-substrate-location-audit.cjs')),
  K1: has(path.join(DEEP, 'energy-portal-access-map.json')) && has(path.join(DOCS, 'energy-k1-access-map.md')),
  K2: has(path.join(DEEP, 'energy-portal-quality-index.json')) && has(path.join(DOCS, 'energy-k2-portal-reality-classifier.md')),
  K3: has(path.join(DEEP, 'energy-certified-cortex-index.json')) && has(path.join(DOCS, 'energy-k3-certified-cortex-index.md')),
  K4: has(path.join(ROOT, 'assets', 'js', 'domain-brains', 'energy-cortex-retrieval.js')) && has(path.join(SC, 'k4-energy-safe-retrieval-probe.cjs')),
  K5: has(path.join(DEEP, 'energy-authoring-queue.json')) && has(path.join(DOCS, 'energy-k5-authoring-queue.md')),
  K6: has(path.join(DOCS, 'energy-k6-cortex-rehydration-plan.md'))
};
console.log('--- K0-K6 artifacts ---');
Object.keys(artifacts).forEach(k => console.log('  ' + k + ': ' + (artifacts[k] ? 'present ✓' : 'MISSING ✗')));

// ── invariants from the data ──
const k3 = rd(path.join(DEEP, 'energy-certified-cortex-index.json'));
const k5 = rd(path.join(DEEP, 'energy-authoring-queue.json'));
const evPortals = (k3.evidenceEligible.portals || []).length;
const evBundles = (k3.evidenceEligible.externalBundles || []).length;
const nuc = R.retrieve('nuclear reactor incident', {}, k3);
const noSynthEvidence = nuc.evidenceEligible.every(e => e.classification === 'EXTERNAL_BUNDLE' && e.admissibleAsEvidence === true);

// ── gates: template-lock (bundles H7 + J + the 5 critical gates + drift) + K4 ──
function child(n) { try { cp.execFileSync('node', [path.join(SC, n)], { stdio: 'ignore' }); return true; } catch (e) { return false; } }
const lockOk = child('energy-template-lock-probe.cjs');
const k4Ok = child('k4-energy-safe-retrieval-probe.cjs');

console.log('\n--- invariants ---');
console.log('  evidenceEligible portals:', evPortals, '(must be 0) | external bundles:', evBundles);
console.log('  K4 nuclear retrieval evidence is external-bundle-only:', noSynthEvidence);
console.log('  authoring queue tasks:', k5.totalTasks);
console.log('  template-lock (H7+J+5 gates):', lockOk, '| K4 gate:', k4Ok);

const checks = [
  ['K0 complete (substrate located)', artifacts.K0],
  ['K1 complete (access map)', artifacts.K1],
  ['K2 complete (reality classifier)', artifacts.K2],
  ['K3 complete (certified index)', artifacts.K3],
  ['K4 complete (safe retrieval)', artifacts.K4],
  ['K5 complete (authoring queue)', artifacts.K5],
  ['K6 complete (rehydration plan)', artifacts.K6],
  ['ZERO portals admitted as evidence (K3)', evPortals === 0],
  ['evidence layer = curated external bundles only', evBundles === 6],
  ['safe retrieval returns NO synthetic as evidence', noSynthEvidence],
  ['authoring queue carries the real gaps', k5.totalTasks > 0 && !!k5.byType['methodCandidate needed']],
  ['critical gates + H7 still pass (template-lock)', lockOk],
  ['K4 safe-retrieval gate passes', k4Ok],
  ['final rescue doc present', has(path.join(DOCS, 'energy-deep-portal-rescue-final.md'))]
];
console.log('\n--- ACCEPTANCE ---');
let allPass = true;
checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
console.log('\n--- OPERATIONAL ANSWER: "why have deep portals if we cannot get there?" ---');
console.log('  We CAN get there (reachable via /api/fetch-portal). They are NOT evidence (0/27,160 real).');
console.log('  KEEP them as navigation/context/authoring substrate; the authoring queue (K5) + rehydration');
console.log('  plan (K6) convert select branches into real evidence on demand. No live deep traversal until');
console.log('  a branch passes classifyPortalV2 as REAL. Prune only if a branch is abandoned.');
console.log('\nK7: ' + (allPass ? 'PASS ✓ — Energy deep-portal rescue COMPLETE (K0-K7); truth layer operational, nothing admitted' : 'FAIL ✗') + '\n');
console.log('================ END K7 ================\n');
process.exit(allPass ? 0 : 1);
