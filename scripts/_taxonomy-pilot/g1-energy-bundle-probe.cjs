/**
 * g1-energy-bundle-probe.cjs — proves G1 source-bundle presence + honest enrichment:
 *  - the 2 real bundles are FOUND (and shipped in the live repo), the 4 others MISSING
 *  - enrichment counts EQUAL the real bundle file (no fabrication)
 *  - missing-bundle diagnoses keep ALL candidate arrays empty (no fake)
 *  - enriched packet survives to finalizer safeInput
 * Read-only. Run: node scripts/_taxonomy-pilot/g1-energy-bundle-probe.cjs
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
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && !/(OIL_SHOCK|NUCLEAR_INCIDENT|SYSTEMIC_ENERGY_STRESS)\.json$/.test(rel) && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };  // isolate from G1d external bundles (this probe tests the G1 phase)
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }
function realCounts(canonId) { try { var b = JSON.parse(fs.readFileSync(path.join(BD, canonId + '.json'), 'utf8')); var p = (b.byLane && b.byLane.patents) || {}; var n = function (k) { return Array.isArray(p[k]) ? p[k].length : 0; }; return { evidenceAnchors: n('evidenceAnchors'), mechanismCandidates: n('mechanismCandidates'), embodimentCandidates: n('embodimentCandidates'), figurePlaceholders: n('figurePlaceholders'), methodCandidates: n('methodCandidates') }; } catch (e) { return null; } }

(async function () {
  console.log('\n================ G1 — ENERGY SOURCE-BUNDLE PRESENCE / ENRICHMENT ================\n');
  console.log('live repo bundle dir exists:', fs.existsSync(BD), '| files:', fs.existsSync(BD) ? fs.readdirSync(BD).join(', ') : 'none');

  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  await brain._loadDiagnosisBundles();      // ensure bundles are loaded before building
  brain._updateEnergyModel();
  const packets = JSON.parse(JSON.stringify(brain.state.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(function (p) { byId[p.identity.diagnosisId] = p; });

  console.log('\n--- BUNDLE PRESENCE TABLE (all six) ---');
  console.log('dx -> canonical | bundleStatus | resolution | evAnchors | mech | embod | figs | method');
  ['GRID_COLLAPSE', 'RENEWABLE_INTERMITTENCY', 'OIL_SHOCK', 'PIPELINE_DISRUPTION', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'].forEach(function (id) {
    var p = byId[id]; var e = p.evidence, t = p.treatmentContext;
    console.log('  ' + id.padEnd(24) + ' -> ' + String(p.identity.canonicalDiagnosisId).padEnd(26) + ' | ' + e.bundleStatus.padEnd(7) + ' | ' + e.bundleResolution.padEnd(33) + ' | ' + e.evidenceAnchors.length + ' | ' + t.mechanismCandidates.length + ' | ' + t.embodimentCandidates.length + ' | ' + t.figurePlaceholders.length + ' | ' + t.methodCandidates.length);
  });

  const gc = byId['GRID_COLLAPSE'], ri = byId['RENEWABLE_INTERMITTENCY'], os = byId['OIL_SHOCK'];
  const realGC = realCounts('GRID_FREQUENCY_INSTABILITY'), realRI = realCounts('INTERMITTENCY_SPIKE');
  console.log('\n--- ENRICHMENT MATCHES REAL BUNDLE (no fabrication) ---');
  console.log('  GRID_COLLAPSE evAnchors: packet=' + gc.evidence.evidenceAnchors.length + ' bundle=' + realGC.evidenceAnchors + ' | figs packet=' + gc.treatmentContext.figurePlaceholders.length + ' bundle=' + realGC.figurePlaceholders + ' | method packet=' + gc.treatmentContext.methodCandidates.length + ' bundle=' + realGC.methodCandidates);
  console.log('  GRID_COLLAPSE completeness: ' + gc.audit.fieldCompleteness.overallPct + '% (treatmentContext=' + gc.audit.fieldCompleteness.sections.treatmentContext.pct + '%, evidence=' + gc.audit.fieldCompleteness.sections.evidence.pct + '%)');
  console.log('  OIL_SHOCK (no bundle) completeness: ' + os.audit.fieldCompleteness.overallPct + '% | candidate arrays all empty: ' + (os.treatmentContext.methodCandidates.length + os.treatmentContext.mechanismCandidates.length + os.treatmentContext.embodimentCandidates.length + os.treatmentContext.figurePlaceholders.length === 0));
  console.log('  GRID warnings:', JSON.stringify(gc.audit.warnings));

  // thread primary (GRID_COLLAPSE, found) to finalizer
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

  const fourMissing = ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'];  // PIPELINE_DISRUPTION now aliased+found (G1c)
  console.log('\n--- ACCEPTANCE ---');
  const checks = [
    ['live repo ships the 2 real bundles', fs.existsSync(path.join(BD, 'GRID_FREQUENCY_INSTABILITY.json')) && fs.existsSync(path.join(BD, 'INTERMITTENCY_SPIKE.json'))],
    ['GRID_COLLAPSE bundle found + alias-resolved-and-bundle-found', gc.evidence.bundleStatus === 'found' && gc.evidence.bundleResolution === 'alias-resolved-and-bundle-found'],
    ['RENEWABLE_INTERMITTENCY bundle found', ri.evidence.bundleStatus === 'found'],
    ['3 self-canonical bundles MISSING (no fake)', fourMissing.every(function (id) { return byId[id].evidence.bundleStatus === 'missing'; })],
    ['evidenceAnchors EQUAL real bundle (GRID)', gc.evidence.evidenceAnchors.length === realGC.evidenceAnchors && realGC.evidenceAnchors > 0],
    ['mechanism/embodiment/figure EQUAL real bundle (GRID)', gc.treatmentContext.mechanismCandidates.length === realGC.mechanismCandidates && gc.treatmentContext.figurePlaceholders.length === realGC.figurePlaceholders],
    ['empty bundle field stays empty (GRID method=0)', gc.treatmentContext.methodCandidates.length === 0 && realGC.methodCandidates === 0],
    ['missing-bundle diagnoses keep ALL candidate arrays empty (no fake)', fourMissing.every(function (id) { var t = byId[id].treatmentContext; return t.methodCandidates.length + t.mechanismCandidates.length + t.embodimentCandidates.length + t.figurePlaceholders.length === 0; })],
    ['shallow bundle flagged (source-bundle-root-only warning)', gc.audit.warnings.some(function (w) { return w.indexOf('source-bundle-root-only') >= 0; })],
    ['found-bundle completeness > missing-bundle completeness', gc.audit.fieldCompleteness.overallPct > os.audit.fieldCompleteness.overallPct],
    ['finalizer safeInput shows bundleStatus=found', !!finPkt && finPkt.evidence.bundleStatus === 'found' && finPkt.evidence.evidenceAnchors.length > 0],
    ['bundle path exists when bundleStatus=found', fs.existsSync(path.join(BD, gc.identity.canonicalDiagnosisId + '.json'))],
    ['non-energy domain stays null', nonEnergyClean],
    ['six diagnoses still emit', (brain.state.diagnoses || []).length === 6 && packets.length === 6]
  ];
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nG1: ' + (allPass ? 'PASS ✓ — real bundles shipped + enrichment matches source, missing stays missing' : 'FAIL ✗') + '\n');
  console.log('================ END G1 PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
