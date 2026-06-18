/**
 * g1b-energy-missing-bundles-probe.cjs — proves G1b: the 4 uncovered Energy diagnoses
 * stay honestly missing with blocker 'source-bundle-build-required'; the 2 real bundles
 * remain found+unchanged; NO fake bundle files were created; the build-required blocker
 * reaches the finalizer. Read-only.
 * Run: node scripts/_taxonomy-pilot/g1b-energy-missing-bundles-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./lib.cjs');
const ROOT = path.join(__dirname, '..', '..');
const A = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const BD = path.join(ROOT, 'assets', 'data', 'artifact-source-index', 'by-diagnosis');

function brainContext() {
  const doc = { createElement: () => ({ style: {}, set textContent(v) {}, set innerHTML(v) {}, appendChild() {}, addEventListener() {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: { appendChild() {} }, body: {} };
  const loc = { pathname: '/civilization.html', search: '', href: 'x' };
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && !/(OIL_SHOCK|NUCLEAR_INCIDENT|SYSTEMIC_ENERGY_STRESS)\.json$/.test(rel) && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };  // isolate from G1d external bundles (this probe tests the G1b phase)
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }

const MISSING = ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'];  // PIPELINE_DISRUPTION now covered by G1c alias

(async function () {
  console.log('\n================ G1b — MISSING ENERGY BUNDLE COVERAGE ================\n');
  const files = fs.existsSync(BD) ? fs.readdirSync(BD).filter(function (f) { return f.endsWith('.json'); }) : [];
  console.log('live repo bundle files (' + files.length + '):', files.join(', '));

  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  await brain._loadDiagnosisBundles();
  brain._updateEnergyModel();
  const packets = JSON.parse(JSON.stringify(brain.state.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(function (p) { byId[p.identity.diagnosisId] = p; });

  console.log('\n--- BUNDLE PRESENCE TABLE (all six) ---');
  ['GRID_COLLAPSE', 'RENEWABLE_INTERMITTENCY', 'PIPELINE_DISRUPTION'].concat(MISSING).forEach(function (id) {
    var p = byId[id]; var b = p.artifactContext.blockers.filter(function (x) { return x.indexOf('bundle') >= 0; }).join(',');
    console.log('  ' + id.padEnd(24) + ' -> ' + String(p.identity.canonicalDiagnosisId).padEnd(26) + ' | ' + p.evidence.bundleStatus.padEnd(7) + ' | blockers: ' + b);
  });

  // thread a MISSING diagnosis (OIL_SHOCK) to the finalizer (make it the sole active = primary)
  brain.state.diagnoses.forEach(function (d) { d.active = (d.id === 'OIL_SHOCK'); });
  brain._updateEnergyModel();
  const cc = civContext();
  loadWithCapture(cc, 'assets/js/domain-brain-adapter.js', ['_buildPayload']);
  loadWithCapture(cc, 'assets/js/civilization/domain-packet-adapter.js', ['_buildPacket']);
  loadWithCapture(cc, 'assets/js/civilization/handoff-contract.js', ['_packetForLane']);
  vm.runInContext(A('assets/js/civilization/artifact-packet-builder.js'), cc, { filename: 'apb' });
  const cap = cc.window.__cap, APB = cc.window.LIMENArtifactPacketBuilder;
  cc.window.LIMENDomains = { energy: cap._buildPayload(JSON.parse(JSON.stringify(brain.state))) };
  const cpkt = cap._buildPacket('energy');
  const handoff = cap._packetForLane('patents', { id: 'o', domains: ['energy'], confidence: 0.9, evidenceQuality: 0.9, urgency: 0.6 }, { energy: cpkt });
  const artifact = APB.buildFromHandoffPacket(handoff, {});
  const finalizer = require('../../handlers/expand-artifact.js');
  const finPkt = finalizer._extractSafeInput(artifact).energyDomainDiagnosisPacket;
  cc.window.LIMENDomains = { finance: { brainDiagnoses: [], brainTreatments: [], brainOpportunities: [] } };
  const nonEnergyClean = !cap._buildPacket('finance').deepBrain;

  const gc = byId['GRID_COLLAPSE'], ri = byId['RENEWABLE_INTERMITTENCY'];
  console.log('\n--- FINALIZER sees the missing diagnosis (OIL_SHOCK) ---');
  console.log('  diagnosisId=' + (finPkt && finPkt.identity.diagnosisId) + ' bundleStatus=' + (finPkt && finPkt.evidence.bundleStatus) + ' blockers=' + JSON.stringify(finPkt && finPkt.artifactContext.blockers));

  console.log('\n--- ACCEPTANCE ---');
  const checks = [
    ['G1/alias bundle files present (GRID/INTERMITTENCY/PIPELINE)', files.indexOf('GRID_FREQUENCY_INSTABILITY.json') >= 0 && files.indexOf('INTERMITTENCY_SPIKE.json') >= 0 && files.indexOf('PIPELINE_RUPTURE_EVENT.json') >= 0],
    ['the 3 are missing in this phase-isolated probe (no fabrication at G1b)', MISSING.every(function (id) { return byId[id].evidence.bundleStatus === 'missing'; })],
    ['4 missing diagnoses bundleStatus=missing', MISSING.every(function (id) { return byId[id].evidence.bundleStatus === 'missing'; })],
    ['4 missing have blocker source-bundle-build-required', MISSING.every(function (id) { return byId[id].artifactContext.blockers.indexOf('source-bundle-build-required') >= 0; })],
    ['4 missing keep ALL candidate arrays empty (no fake)', MISSING.every(function (id) { var t = byId[id].treatmentContext; return t.methodCandidates.length + t.mechanismCandidates.length + t.embodimentCandidates.length + t.figurePlaceholders.length === 0 && byId[id].evidence.evidenceAnchors.length === 0; })],
    ['GRID_COLLAPSE remains found (G1 unchanged)', gc.evidence.bundleStatus === 'found' && gc.evidence.evidenceAnchors.length === 32],
    ['RENEWABLE_INTERMITTENCY remains found (G1 unchanged)', ri.evidence.bundleStatus === 'found' && ri.evidence.evidenceAnchors.length === 32],
    ['both found bundles retain source-bundle-root-only warning', gc.audit.warnings.some(function (w) { return w.indexOf('source-bundle-root-only') >= 0; }) && ri.audit.warnings.some(function (w) { return w.indexOf('source-bundle-root-only') >= 0; })],
    ['coverage doc exists (proposal/build plan)', fs.existsSync(path.join(ROOT, 'docs', 'audits', 'energy-missing-bundle-coverage.md'))],
    ['finalizer safeInput shows missing dx + build-required blocker', !!finPkt && finPkt.identity.diagnosisId === 'OIL_SHOCK' && finPkt.evidence.bundleStatus === 'missing' && finPkt.artifactContext.blockers.indexOf('source-bundle-build-required') >= 0],
    ['non-energy domain stays null', nonEnergyClean],
    ['six diagnoses still emit', (brain.state.diagnoses || []).length === 6 && packets.length === 6]
  ];
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nG1b: ' + (allPass ? 'PASS ✓ — 4 missing stay honest + build-required; 2 found unchanged; no fakes' : 'FAIL ✗') + '\n');
  console.log('================ END G1b PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
