/**
 * g1c-energy-bundle-build-probe.cjs — proves G1c:
 *  Part A: PIPELINE_DISRUPTION -> PIPELINE_RUPTURE_EVENT (human-approved alias), real bundle found+enriched.
 *  Part B: OIL_SHOCK/NUCLEAR_INCIDENT/SYSTEMIC_ENERGY_STRESS NOT built (no verified source) -> stay missing.
 * Read-only. Run: node scripts/_taxonomy-pilot/g1c-energy-bundle-build-probe.cjs
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
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && !/(OIL_SHOCK|NUCLEAR_INCIDENT|SYSTEMIC_ENERGY_STRESS)\.json$/.test(rel) && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };  // isolate from G1d external bundles (this probe tests the G1c phase)
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }
const MISSING = ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'];

(async function () {
  console.log('\n================ G1c — ALIAS APPROVAL + BUILD REPORT ================\n');
  const files = fs.existsSync(BD) ? fs.readdirSync(BD).filter(f => f.endsWith('.json')) : [];
  console.log('live bundle files (' + files.length + '):', files.join(', '));

  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  await brain._loadDiagnosisBundles();
  brain._updateEnergyModel();
  const packets = JSON.parse(JSON.stringify(brain.state.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(p => byId[p.identity.diagnosisId] = p);

  console.log('\n--- BUNDLE PRESENCE TABLE (all six) ---');
  ['GRID_COLLAPSE', 'RENEWABLE_INTERMITTENCY', 'PIPELINE_DISRUPTION'].concat(MISSING).forEach(function (id) {
    var p = byId[id], i = p.identity;
    console.log('  ' + id.padEnd(24) + ' -> ' + String(i.canonicalDiagnosisId).padEnd(26) + ' | ' + p.evidence.bundleStatus.padEnd(7) + ' | alias=' + i.aliasUsed + ' review=' + (i.aliasReviewStatus || '-') + ' risk=' + (i.aliasRisk || '-'));
  });

  const pd = byId['PIPELINE_DISRUPTION'], gc = byId['GRID_COLLAPSE'], ri = byId['RENEWABLE_INTERMITTENCY'];
  console.log('\n--- PIPELINE_DISRUPTION packet (Part A) ---');
  console.log('  canonical=' + pd.identity.canonicalDiagnosisId + ' aliasUsed=' + pd.identity.aliasUsed + ' reviewStatus=' + pd.identity.aliasReviewStatus + ' risk=' + pd.identity.aliasRisk);
  console.log('  aliasNote=' + JSON.stringify(pd.identity.aliasNote));
  console.log('  bundleStatus=' + pd.evidence.bundleStatus + ' evidenceAnchors=' + pd.evidence.evidenceAnchors.length + ' mech=' + pd.treatmentContext.mechanismCandidates.length);
  console.log('  warnings=' + JSON.stringify(pd.audit.warnings));

  // thread PIPELINE (Part A, found) to finalizer
  brain.state.diagnoses.forEach(d => d.active = (d.id === 'PIPELINE_DISRUPTION'));
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

  console.log('\n--- ACCEPTANCE ---');
  const checks = [
    ['PIPELINE_RUPTURE_EVENT.json shipped (real file)', fs.existsSync(path.join(BD, 'PIPELINE_RUPTURE_EVENT.json'))],
    ['PIPELINE_DISRUPTION -> PIPELINE_RUPTURE_EVENT, aliasUsed true', pd.identity.canonicalDiagnosisId === 'PIPELINE_RUPTURE_EVENT' && pd.identity.aliasUsed === true],
    ['PIPELINE aliasReviewStatus=human-approved, risk=medium, note present', pd.identity.aliasReviewStatus === 'human-approved' && pd.identity.aliasRisk === 'medium' && !!pd.identity.aliasNote],
    ['PIPELINE bundleStatus=found + real enrichment', pd.evidence.bundleStatus === 'found' && pd.evidence.evidenceAnchors.length === 32],
    ['PIPELINE retains alias-resolved + source-bundle-root-only warnings', pd.audit.warnings.some(w => w.indexOf('alias-resolved') >= 0) && pd.audit.warnings.some(w => w.indexOf('source-bundle-root-only') >= 0)],
    ['GRID + RENEWABLE unchanged (found, corpus-aliased)', gc.evidence.bundleStatus === 'found' && gc.identity.aliasReviewStatus === 'corpus-aliased' && ri.evidence.bundleStatus === 'found'],
    ['G1/alias bundle files present (GRID/INTERMITTENCY/PIPELINE)', files.indexOf('GRID_FREQUENCY_INSTABILITY.json') >= 0 && files.indexOf('INTERMITTENCY_SPIKE.json') >= 0 && files.indexOf('PIPELINE_RUPTURE_EVENT.json') >= 0],
    ['3 remaining missing in this phase-isolated probe (no fabrication at G1c)', MISSING.every(id => byId[id].evidence.bundleStatus === 'missing')],
    ['3 remaining stay missing + build-required + empty candidates', MISSING.every(function (id) { var p = byId[id], t = p.treatmentContext; return p.evidence.bundleStatus === 'missing' && p.artifactContext.blockers.indexOf('source-bundle-build-required') >= 0 && (t.methodCandidates.length + t.mechanismCandidates.length + t.embodimentCandidates.length + t.figurePlaceholders.length + p.evidence.evidenceAnchors.length === 0); })],
    ['build report doc exists', fs.existsSync(path.join(ROOT, 'docs', 'audits', 'energy-g1c-bundle-build-report.md'))],
    ['finalizer safeInput shows PIPELINE canonical + alias metadata + found', !!finPkt && finPkt.identity.canonicalDiagnosisId === 'PIPELINE_RUPTURE_EVENT' && finPkt.identity.aliasReviewStatus === 'human-approved' && finPkt.bundle.bundleStatus === 'found'],
    ['non-energy domain stays null', nonEnergyClean],
    ['six diagnoses still emit', (brain.state.diagnoses || []).length === 6 && packets.length === 6]
  ];
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nG1c: ' + (allPass ? 'PASS ✓ — PIPELINE alias approved+imported; 3 stay honestly build-required' : 'FAIL ✗') + '\n');
  console.log('================ END G1c PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
