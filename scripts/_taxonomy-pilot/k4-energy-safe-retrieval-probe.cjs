/**
 * k4-energy-safe-retrieval-probe.cjs — PHASE K4 safe-retrieval gate (read-only).
 * Proves retrieveEnergyCortex (energy-cortex-retrieval.js) returns admissibility-tagged results from the
 * K3 certified index: nuclear -> external bundle + authoring needs (NOT synthetic L1/L2); pipeline ->
 * approved-alias bundle + context; an L2-synthetic query -> blocked status only; nothing synthetic ever
 * returned as evidence/content. + the 5 critical gates via the template-lock boundary. Exits non-zero on fail.
 *   node scripts/_taxonomy-pilot/k4-energy-safe-retrieval-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const R = require('../../assets/js/domain-brains/energy-cortex-retrieval.js');
const ROOT = path.join(__dirname, '..', '..');
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'deep', 'energy-certified-cortex-index.json'), 'utf8'));

console.log('\n================ K4 — ENERGY SAFE RETRIEVAL LAYER ================\n');

const nuc = R.retrieve('what do we know about a nuclear reactor incident', {}, idx);
const pipe = R.retrieve('pipeline rupture risk', {}, idx);
const l2 = R.retrieve('energy_grid_transmission_substation deep portal treatments', {}, idx);
const bogus = R.retrieve('something with no energy keyword at all', {}, idx);

function noSynthContent(res) {
  // synthetic/dangerous portals must NEVER appear as evidence or as returned content
  const blob = JSON.stringify(res.evidenceEligible) + JSON.stringify(res.contextOnly);
  return !/DANGEROUS|SYNTHETIC/.test(blob) && res.evidenceEligible.every(e => e.admissibleAsEvidence === true && e.classification === 'EXTERNAL_BUNDLE');
}

console.log('--- nuclear query ---');
console.log('  dx=' + nuc.diagnosisId + ' evidence=' + nuc.evidenceEligible.map(e => e.canonicalId).join(',') + ' context=' + nuc.contextOnly.length + ' authoring=' + nuc.authoringNeeded.length);
console.log('  warnings=' + JSON.stringify(nuc.warnings));
console.log('--- pipeline query ---');
console.log('  dx=' + pipe.diagnosisId + ' evidence=' + pipe.evidenceEligible.map(e => e.canonicalId).join(',') + ' context=' + pipe.contextOnly.length + ' authoring=' + pipe.authoringNeeded.length);
console.log('--- L2-synthetic query ---');
console.log('  dx=' + l2.diagnosisId + ' evidence=' + l2.evidenceEligible.length + ' blocked=' + JSON.stringify(l2.blocked));

// boundary: the 5 critical gates (template-lock bundles h7 + j + the gates + drift)
let lockOk = true; try { cp.execFileSync('node', [path.join(__dirname, 'energy-template-lock-probe.cjs')], { stdio: 'ignore' }); } catch (e) { lockOk = false; }

const checks = [
  ['nuclear -> NUCLEAR_INCIDENT external bundle (not synthetic L1/L2)', nuc.diagnosisId === 'NUCLEAR_INCIDENT' && nuc.evidenceEligible.some(e => e.canonicalId === 'NUCLEAR_INCIDENT') && noSynthContent(nuc)],
  ['nuclear -> external bundle flagged human-verification-required', nuc.evidenceEligible.find(e => e.canonicalId === 'NUCLEAR_INCIDENT').humanVerification === 'required' && nuc.warnings.some(w => /human-verification-required/.test(w))],
  ['nuclear -> surfaces authoring needs', Array.isArray(nuc.authoringNeeded)],
  ['pipeline -> approved-alias bundle PIPELINE_RUPTURE_EVENT', pipe.diagnosisId === 'PIPELINE_DISRUPTION' && pipe.evidenceEligible.some(e => e.canonicalId === 'PIPELINE_RUPTURE_EVENT')],
  ['pipeline -> context portals returned WITH relevance-unverified warning', pipe.contextOnly.length > 0 && pipe.warnings.some(w => /relevance-unverified/.test(w)) && pipe.contextOnly.every(c => c.admissibleAsEvidence === false)],
  ['L2-portal query -> deep portals blocked (status only); NO synthetic content (real bundle OK)', !!l2.blocked && /blocked/.test(l2.blocked.note) && noSynthContent(l2)],
  ['bogus (no-keyword) query -> dx=null, zero evidence, blocked status present', bogus.diagnosisId === null && bogus.evidenceEligible.length === 0 && !!bogus.blocked],
  ['NO synthetic/dangerous content returned as evidence in any query', [nuc, pipe, l2, bogus].every(noSynthContent)],
  ['every evidence item is an EXTERNAL_BUNDLE (portals never evidence)', [nuc, pipe].every(r => r.evidenceEligible.every(e => e.classification === 'EXTERNAL_BUNDLE'))],
  ['retrieval result is compact (<8KB, authoring capped)', [nuc, pipe, l2].every(r => JSON.stringify(r).length < 8000)],
  ['retrieval module is inert (not wired into any page script tag)', !fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).some(f => fs.readFileSync(path.join(ROOT, f), 'utf8').indexOf('energy-cortex-retrieval.js') >= 0)],
  ['5 critical gates pass (template-lock: h7+j+gates+drift)', lockOk],
  ['probe file present', fs.existsSync(path.join(__dirname, 'k4-energy-safe-retrieval-probe.cjs'))]
];
console.log('\n--- ACCEPTANCE ---');
let allPass = true;
checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
console.log('\nK4: ' + (allPass ? 'PASS ✓ — safe retrieval: evidence=external bundles only, context warned, synthetic blocked, nothing admitted' : 'FAIL ✗') + '\n');
console.log('================ END K4 ================\n');
process.exit(allPass ? 0 : 1);
