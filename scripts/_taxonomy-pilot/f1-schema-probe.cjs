/**
 * f1-schema-probe.cjs — proves the Energy DomainDiagnosisPacket schema (F1):
 *  - exists on brain state (energyModel.domainDiagnosisPacket + energyDomainDiagnosisPackets)
 *  - has all 8 sections with every field EXPLICIT (missing = null/[]/'missing', not omitted)
 *  - survives HOP0→HOP3 to the active investment artifact packet
 *  - non-energy domains get no packet
 * Read-only. Run: node scripts/_taxonomy-pilot/f1-schema-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./lib.cjs');
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
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }

const SECTIONS = {
  identity: ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'aliasUsed', 'label', 'phase', 'confidence'],
  brainState: ['energyModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity', 'readyForHandoff'],
  portalContext: ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath', 'portalStatus', 'sourceCompleteness'],
  evidence: ['sourceFeeds', 'evidenceAnchors', 'citationHints', 'bundleStatus', 'missingEvidence'],
  treatmentContext: ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders'],
  operatorContext: ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep'],
  artifactContext: ['artifactLanes', 'patentReady', 'grantReady', 'sbaReady', 'investmentReady', 'researchReady', 'readinessReasons', 'blockers'],
  audit: ['generatedAt', 'schemaVersion', 'fieldCompleteness', 'missingFields', 'warnings', 'proofTier']
};
function validateSchema(pkt) {
  var missing = [];
  for (var sec in SECTIONS) { if (!(sec in pkt)) { missing.push('SECTION:' + sec); continue; } for (var i = 0; i < SECTIONS[sec].length; i++) { var k = SECTIONS[sec][i]; if (!(k in pkt[sec])) missing.push(sec + '.' + k); } }
  return missing;
}

(async function () {
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  brain.state.stress = 0.7; if ((brain.state.diagnoses || [])[0]) brain.state.diagnoses[0].active = true;
  brain._updateEnergyModel();
  const realState = JSON.parse(JSON.stringify(brain.state));
  const pkt = realState.energyModel && realState.energyModel.domainDiagnosisPacket;
  const allPkts = realState.energyDomainDiagnosisPackets || [];

  console.log('\n================ F1 — ENERGY DomainDiagnosisPacket SCHEMA PROOF ================\n');
  console.log('packet on brain state:', !!pkt, '| packets per diagnosis:', allPkts.length, '| diagnoses:', (realState.diagnoses || []).length);

  const schemaMissing = pkt ? validateSchema(pkt) : ['NO PACKET'];
  console.log('schema: all 8 sections + every field explicitly present:', schemaMissing.length === 0 ? 'YES ✓' : 'NO ✗ ' + schemaMissing.join(','));

  if (pkt) {
    console.log('\n--- PACKET EXAMPLE (primary diagnosis: ' + pkt.identity.diagnosisId + ') ---');
    console.log(JSON.stringify(pkt, null, 1).split('\n').slice(0, 60).join('\n'));
    console.log('\n--- FIELD COMPLETENESS ---');
    var c = pkt.audit.fieldCompleteness;
    for (var s in c.sections) console.log('  ' + s + ': ' + c.sections[s].have + '/' + c.sections[s].total + ' (' + c.sections[s].pct + '%)');
    console.log('  OVERALL: ' + c.overallPct + '% | proofTier: ' + pkt.audit.proofTier);
    console.log('  missingFields (' + pkt.audit.missingFields.length + '): ' + pkt.audit.missingFields.join(', '));
    console.log('  warnings (' + pkt.audit.warnings.length + '): ' + pkt.audit.warnings.join(' | '));
  }

  // thread to finalizer
  const cc = civContext();
  loadWithCapture(cc, 'assets/js/domain-brain-adapter.js', ['_buildPayload']);
  loadWithCapture(cc, 'assets/js/civilization/domain-packet-adapter.js', ['_buildPacket']);
  loadWithCapture(cc, 'assets/js/civilization/handoff-contract.js', ['_packetForLane']);
  vm.runInContext(A('assets/js/civilization/artifact-packet-builder.js'), cc, { filename: 'apb' });
  const cap = cc.window.__cap, APB = cc.window.LIMENArtifactPacketBuilder;
  const payload = cap._buildPayload(realState);
  cc.window.LIMENDomains = { energy: payload };
  const packet = cap._buildPacket('energy');
  const opp = { id: 'opp_e', domains: ['energy'], confidence: 0.9, evidenceQuality: 0.9, urgency: 0.6, rationale: 'r', summary: 's', type: 'diagnosis', provenance: 'p' };
  const handoff = cap._packetForLane('investments', opp, { energy: packet });
  const artifact = APB.buildFromHandoffPacket(handoff, {});
  const fin = artifact && artifact.deepBrain;
  const finSchemaOk = fin ? fin.cycle === realState.energyModel.cycle && fin.regulationState != null : false;

  // non-energy
  cc.window.LIMENDomains = { finance: { brainDiagnoses: [], brainTreatments: [], brainOpportunities: [] } };
  const finPkt = cap._buildPacket('finance');
  const nonEnergyClean = !finPkt.deepBrain;

  console.log('\n--- SURVIVAL + ACCEPTANCE ---');
  var checks = [
    ['packet exists on brain state', !!pkt],
    ['all 8 sections, every field explicit (none hidden)', schemaMissing.length === 0],
    ['one packet per diagnosis (6)', allPkts.length === (realState.diagnoses || []).length && allPkts.length === 6],
    ['active investment artifact retains deepBrain', !!fin],
    ['active artifact retains recurrent state fields', finSchemaOk],
    ['missing fields visible (not hidden)', pkt && pkt.audit.missingFields.length > 0],
    ['warnings emitted (root-only / no-canonical / no-bundle)', pkt && pkt.audit.warnings.length >= 3],
    ['six diagnoses still emit', (realState.diagnoses || []).length === 6],
    ['non-energy domain gets no packet', nonEnergyClean]
  ];
  var allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nF1: ' + (allPass ? 'PASS ✓ — schema defined, explicit, and survives to the active artifact boundary' : 'FAIL ✗') + '\n');
  console.log('================ END F1 PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
