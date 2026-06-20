/**
 * dc-energy-datacenter-diagnoses-probe.cjs — proves the Data-Center diagnosis LAYER:
 *  - the 2 data-center diagnoses (GRID_STRAIN, WATER_STRESS) load as a SEPARATE layer
 *  - the validated 6-diagnosis spine (state.diagnoses) is UNTOUCHED (no contamination)
 *  - each DC diagnosis gets a DDP (canonical-to-self, bundleStatus missing = honest)
 *  - real (non-mad-lib, citation-backed) DC treatments are pulled from the DC nodes
 *  - activation works off the same condition map
 *  - the primary DDP promptView advertises datacenterSummary
 * Read-only. Run: node scripts/_taxonomy-pilot/dc-energy-datacenter-diagnoses-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const A = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function brainContext() {
  const doc = { createElement: () => ({ style: {}, set textContent(v) {}, set innerHTML(v) {}, appendChild() {}, addEventListener() {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: { appendChild() {} }, body: {} };
  const loc = { pathname: '/civilization.html', search: '', href: 'x' };
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}

(async function () {
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;

  await brain.cycle();                         // first cycle (init's async loaders resolve)
  await brain._loadDatacenterDiagnoses();      // ensure the DC sub-portal is cached
  await brain._loadDiagnosisBundles();         // ensure bundle status map populated
  brain._buildDatacenterLayer();               // rebuild now that _dcPortal is guaranteed present

  const st = brain.state;
  const dcDiags = st.datacenterDiagnoses || [];
  const dcLayer = st.datacenterLayer || {};
  const dcPkts = st.datacenterDomainDiagnosisPackets || [];
  const dcTreats = st.datacenterTreatments || [];
  const spineIds = (st.diagnoses || []).map(d => d.id);

  // activation check — force grid_stress condition and rebuild
  brain._activeConditions = ['grid_stress', 'energy_high_stress'];
  brain._buildDatacenterLayer();
  const gridStrain = (brain.state.datacenterDiagnoses || []).find(d => d.id === 'ENERGY_DATACENTER_GRID_STRAIN');

  const primaryDDP = st.energyModel && st.energyModel.domainDiagnosisPacket;
  const dcSummary = primaryDDP && primaryDDP.promptView && primaryDDP.promptView.datacenterSummary;

  const ids = dcDiags.map(d => d.id).sort();
  const realTreats = dcTreats.filter(t => !t.madLib);

  console.log('\n================ DC — DATA-CENTER DIAGNOSIS LAYER PROOF ================\n');
  console.log('spine (state.diagnoses):', spineIds.length, spineIds.join(', '));
  console.log('DC diagnoses:', ids.join(', '));
  console.log('DC treatments:', dcTreats.length, '| real (non-mad-lib):', realTreats.length);
  console.log('DC packets:', dcPkts.length, '| primary promptView.datacenterSummary:', !!dcSummary);
  if (dcPkts[0]) console.log('DC packet[0]: canonical=', dcPkts[0].identity.canonicalDiagnosisId, '| bundleStatus=', dcPkts[0].evidence.bundleStatus);

  const checks = [
    ['validated spine UNTOUCHED (exactly 6)', spineIds.length === 6],
    ['DC diagnoses NEVER contaminate the spine', !spineIds.some(id => /DATACENTER/.test(id))],
    ['both DC diagnoses load', ids.length === 2 && ids[0] === 'ENERGY_DATACENTER_GRID_STRAIN' && ids[1] === 'ENERGY_DATACENTER_WATER_STRESS'],
    ['DC layer marked loaded + count 2', dcLayer.loaded === true && dcLayer.count === 2],
    ['DC diagnoses tier-tagged real-content-unbundled', dcDiags.every(d => d.tier === 'real-content-unbundled' && d.source === 'datacenter')],
    ['real (citation-backed, non-mad-lib) DC treatments pulled', realTreats.length >= 3],
    ['one DDP per DC diagnosis', dcPkts.length === 2],
    ['DC DDPs canonical-to-self', dcPkts.every(p => p.identity.canonicalDiagnosisId === p.identity.diagnosisId)],
    ['DC DDPs now source-covered (external bundle found + evidenceAnchors populated)', dcPkts.every(p => p.evidence.bundleStatus === 'found' && (p.evidence.evidenceAnchors || []).length >= 1)],
    ['primary DDP promptView advertises datacenterSummary (count 2)', !!dcSummary && dcSummary.count === 2],
    ['activation works (grid_stress -> GRID_STRAIN active)', !!gridStrain && gridStrain.active === true],
    ['DC treatments never enter evidenceAnchors of spine packets', (st.energyDomainDiagnosisPackets || []).every(p => (p.evidence.evidenceAnchors || []).every(a => !/datacenter/i.test(JSON.stringify(a))))]
  ];
  let allPass = true;
  checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nDC: ' + (allPass ? 'PASS ✓ — data-center diagnoses wired as a layer, spine intact' : 'FAIL ✗') + '\n');
  process.exit(allPass ? 0 : 1);
})();
