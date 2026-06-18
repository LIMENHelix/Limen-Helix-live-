/**
 * g1d-energy-external-bundles-probe.cjs — proves the 3 external-source bundles are honest:
 *  real source provenance (sources[]+evidenceAnchors with URLs), NO fabricated candidate arrays
 *  (method/embodiment/figure empty), marked external-source-authored + human-verification-required,
 *  enriched into the DDP, and surviving to the finalizer. Exits non-zero on empty provenance/fakes.
 * Read-only. Run: node scripts/_taxonomy-pilot/g1d-energy-external-bundles-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./lib.cjs');
const ROOT = path.join(__dirname, '..', '..');
const A = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const BD = path.join(ROOT, 'assets', 'data', 'artifact-source-index', 'by-diagnosis');
const NEW = ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'];

function brainContext() {
  const doc = { createElement: () => ({ style: {}, set textContent(v) {}, set innerHTML(v) {}, appendChild() {}, addEventListener() {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: { appendChild() {} }, body: {} };
  const loc = { pathname: '/civilization.html', search: '', href: 'x' };
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }

(async function () {
  console.log('\n================ G1d — EXTERNAL-SOURCE BUNDLES PROOF ================\n');
  // ── static bundle-file validation ──
  var fileChecks = [];
  NEW.forEach(function (id) {
    var p = path.join(BD, id + '.json');
    if (!fs.existsSync(p)) { fileChecks.push({ id: id, ok: false, why: 'missing file' }); return; }
    var b = JSON.parse(fs.readFileSync(p, 'utf8'));
    var lane = (b.byLane && b.byLane.patents) || {};
    var anchors = lane.evidenceAnchors || [];
    var anchorsReal = anchors.length > 0 && anchors.every(function (a) { return a.url && /^https:\/\//.test(a.url) && a.source; });
    var sourcesReal = Array.isArray(b.sources) && b.sources.length > 0 && b.sources.every(function (s) { return s.org && s.url && s.provides; });
    var noFake = (lane.methodCandidates || []).length === 0 && (lane.embodimentCandidates || []).length === 0 && (lane.figurePlaceholders || []).length === 0;
    var treatSourced = (lane.treatments || []).length > 0 && (lane.treatments || []).every(function (t) { return t.sourceBacked === true && t.source; });
    var mechSourced = (lane.mechanismCandidates || []).every(function (m) { return m.source && m.basis; });
    var marked = b.buildMethod === 'external-source-authored' && b.humanVerification === 'required';
    var provenance = !!b.provenanceNote && sourcesReal;
    var ok = anchorsReal && sourcesReal && noFake && treatSourced && mechSourced && marked && provenance;
    fileChecks.push({ id: id, ok: ok, anchors: anchors.length, sources: (b.sources || []).length, treat: (lane.treatments || []).length, mech: (lane.mechanismCandidates || []).length, noFake: noFake, marked: marked, treatSourced: treatSourced });
    console.log('  ' + id + ': anchors=' + anchors.length + ' sources=' + (b.sources || []).length + ' treat=' + (lane.treatments || []).length + ' mech=' + (lane.mechanismCandidates || []).length
      + ' | noFakeCandidates=' + noFake + ' anchorsHaveURLs=' + anchorsReal + ' treatSourceBacked=' + treatSourced + ' marked=' + marked);
  });

  // ── runtime: brain enriches the DDP from the new bundles ──
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  await brain._loadDiagnosisBundles();
  brain._updateEnergyModel();
  const packets = JSON.parse(JSON.stringify(brain.state.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(p => byId[p.identity.diagnosisId] = p);

  console.log('\n--- BUNDLE PRESENCE TABLE (newly built 3) ---');
  NEW.forEach(function (id) {
    var p = byId[id], e = p.evidence;
    console.log('  ' + id.padEnd(24) + ' bundleStatus=' + e.bundleStatus + ' anchors=' + e.evidenceAnchors.length + ' mech=' + p.treatmentContext.mechanismCandidates.length
      + ' method/embod/fig=' + [p.treatmentContext.methodCandidates.length, p.treatmentContext.embodimentCandidates.length, p.treatmentContext.figurePlaceholders.length].join('/')
      + ' provenance=' + (e.bundle && e.bundle.buildMethod));
  });
  var os = byId['OIL_SHOCK'];
  console.log('\n  OIL_SHOCK warnings:', JSON.stringify(os.audit.warnings));

  // ── finalizer survival (thread OIL_SHOCK) ──
  brain.state.diagnoses.forEach(d => d.active = (d.id === 'OIL_SHOCK'));
  brain._updateEnergyModel();
  const cc = civContext();
  loadWithCapture(cc, 'assets/js/domain-brain-adapter.js', ['_buildPayload']);
  loadWithCapture(cc, 'assets/js/civilization/domain-packet-adapter.js', ['_buildPacket']);
  loadWithCapture(cc, 'assets/js/civilization/handoff-contract.js', ['_packetForLane']);
  vm.runInContext(A('assets/js/civilization/artifact-packet-builder.js'), cc, { filename: 'apb' });
  const cap = cc.window.__cap, APB = cc.window.LIMENArtifactPacketBuilder;
  cc.window.LIMENDomains = { energy: cap._buildPayload(JSON.parse(JSON.stringify(brain.state))) };
  const handoff = cap._packetForLane('patents', { id: 'o', domains: ['energy'], confidence: 0.9, evidenceQuality: 0.9, urgency: 0.6 }, { energy: cap._buildPacket('energy') });
  const finalizer = require('../../handlers/expand-artifact.js');
  const finPkt = finalizer._extractSafeInput(APB.buildFromHandoffPacket(handoff, {})).energyDomainDiagnosisPacket;
  cc.window.LIMENDomains = { finance: { brainDiagnoses: [], brainTreatments: [], brainOpportunities: [] } };
  const nonEnergyClean = !cap._buildPacket('finance').deepBrain;

  console.log('\n--- ACCEPTANCE ---');
  const checks = [
    ['all 3 bundle files valid + real provenance + no fake candidates', fileChecks.every(c => c.ok)],
    ['3 bundles now bundleStatus=found', NEW.every(id => byId[id].evidence.bundleStatus === 'found')],
    ['evidenceAnchors enriched (real source pointers)', NEW.every(id => byId[id].evidence.evidenceAnchors.length >= 2)],
    ['mechanismCandidates enriched (established, source-attributed)', NEW.every(id => byId[id].treatmentContext.mechanismCandidates.length >= 1)],
    ['NO fabricated method/embodiment/figure candidates', NEW.every(id => { var t = byId[id].treatmentContext; return t.methodCandidates.length + t.embodimentCandidates.length + t.figurePlaceholders.length === 0; })],
    ['treatments are source-backed (not L1/L2 mad-lib)', NEW.every(id => { var p = path.join(BD, id + '.json'); var l = JSON.parse(fs.readFileSync(p, 'utf8')).byLane.patents; return l.treatments.every(t => t.sourceBacked === true); })],
    ['marked external-source-authored + human-verification-required', NEW.every(id => byId[id].evidence.bundle.buildMethod === 'external-source-authored' && byId[id].evidence.bundle.humanVerification === 'required')],
    ['external-source warning surfaced (not misleading root-only)', os.audit.warnings.some(w => w.indexOf('external-source-authored') >= 0)],
    ['finalizer safeInput shows OIL_SHOCK found + anchors', !!finPkt && finPkt.identity.diagnosisId === 'OIL_SHOCK' && finPkt.evidence.bundleStatus === 'found' && finPkt.evidence.evidenceAnchors.length >= 2],
    ['report doc exists', fs.existsSync(path.join(ROOT, 'docs', 'audits', 'energy-g1d-external-source-bundles.md'))],
    ['non-energy domain stays null', nonEnergyClean],
    ['six diagnoses still emit', (brain.state.diagnoses || []).length === 6 && packets.length === 6]
  ];
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nG1d: ' + (allPass ? 'PASS ✓ — 3 external-source bundles, real provenance, no fakes, source-covered 6/6' : 'FAIL ✗') + '\n');
  console.log('================ END G1d PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
