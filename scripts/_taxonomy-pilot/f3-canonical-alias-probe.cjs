/**
 * f3-canonical-alias-probe.cjs — proves F3 canonical-diagnosis/alias resolution:
 *  - the 2 known aliases resolve, the other 4 are canonical-to-self
 *  - bundleStatus stays honest ('missing' — live repo ships none)
 *  - blockers/warnings reflect canonical-resolved-but-bundle-missing / alias-used
 *  - canonicalDiagnosisId + aliasUsed survive to finalizer safeInput
 * Read-only. Run: node scripts/_taxonomy-pilot/f3-canonical-alias-probe.cjs
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
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && rel.indexOf('artifact-source-index') < 0 && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };  // bundles isolated: F3 tests canonical, not G1 bundles
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }

(async function () {
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  brain._updateEnergyModel();
  const packets = JSON.parse(JSON.stringify(brain.state.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(function (p) { byId[p.identity.diagnosisId] = p; });

  console.log('\n================ F3 — CANONICAL DIAGNOSIS / ALIAS PROOF ================\n');
  console.log('dx -> canonicalDiagnosisId | aliasUsed | bundleStatus | source-blocker');
  ['GRID_COLLAPSE', 'RENEWABLE_INTERMITTENCY', 'OIL_SHOCK', 'PIPELINE_DISRUPTION', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'].forEach(function (id) {
    var p = byId[id]; if (!p) { console.log('  ' + id + ' -> (no packet)'); return; }
    var srcBlock = p.artifactContext.blockers.filter(function (b) { return b.indexOf('bundle') >= 0; }).join(',');
    console.log('  ' + id.padEnd(24) + ' -> ' + String(p.identity.canonicalDiagnosisId).padEnd(26) + ' | alias=' + p.identity.aliasUsed + ' | ' + p.evidence.bundleStatus + ' | ' + srcBlock);
  });

  const gc = byId['GRID_COLLAPSE'], ri = byId['RENEWABLE_INTERMITTENCY'], os = byId['OIL_SHOCK'];
  console.log('\n--- BEFORE/AFTER (F2 had canonicalDiagnosisId=null, aliasUsed=false) ---');
  console.log('  GRID_COLLAPSE:           canonical=' + gc.identity.canonicalDiagnosisId + ' aliasUsed=' + gc.identity.aliasUsed + ' | identity completeness=' + gc.audit.fieldCompleteness.sections.identity.pct + '% (was 83%) | overall=' + gc.audit.fieldCompleteness.overallPct + '%');
  console.log('  RENEWABLE_INTERMITTENCY: canonical=' + ri.identity.canonicalDiagnosisId + ' aliasUsed=' + ri.identity.aliasUsed);
  console.log('  OIL_SHOCK (no alias):    canonical=' + os.identity.canonicalDiagnosisId + ' aliasUsed=' + os.identity.aliasUsed + ' (canonical-to-self)');
  console.log('  GRID_COLLAPSE warnings:', JSON.stringify(gc.audit.warnings));

  // thread the primary packet (GRID_COLLAPSE, aliased) to finalizer
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
  const safe = finalizer._extractSafeInput(artifact);
  const finId = safe && safe.energyDomainDiagnosisPacket && safe.energyDomainDiagnosisPacket.identity;
  cc.window.LIMENDomains = { finance: { brainDiagnoses: [], brainTreatments: [], brainOpportunities: [] } };
  const nonEnergyClean = !cap._buildPacket('finance').deepBrain;

  console.log('\n--- ACCEPTANCE ---');
  const aliasedBlockerOk = function (p) { return p.artifactContext.blockers.indexOf('canonical-id-resolved-but-bundle-missing') >= 0; };
  const selfBlockerOk = function (p) { return p.artifactContext.blockers.indexOf('no-source-bundle') >= 0; };
  const checks = [
    ['RENEWABLE_INTERMITTENCY -> INTERMITTENCY_SPIKE, aliasUsed=true', ri.identity.canonicalDiagnosisId === 'INTERMITTENCY_SPIKE' && ri.identity.aliasUsed === true],
    ['GRID_COLLAPSE -> GRID_FREQUENCY_INSTABILITY, aliasUsed=true', gc.identity.canonicalDiagnosisId === 'GRID_FREQUENCY_INSTABILITY' && gc.identity.aliasUsed === true],
    ['OIL_SHOCK canonical-to-self, aliasUsed=false', os.identity.canonicalDiagnosisId === 'OIL_SHOCK' && os.identity.aliasUsed === false],
    ['3 non-aliased all canonical-to-self (PIPELINE now aliased by G1c)', ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'].every(function (id) { return byId[id].identity.canonicalDiagnosisId === id && byId[id].identity.aliasUsed === false; })],
    ['no fake bundle (status not "found" without an explicit G1 load)', packets.every(function (p) { return p.evidence.bundleStatus !== 'found'; })],
    ['aliased -> blocker canonical-id-resolved-but-bundle-missing', aliasedBlockerOk(gc) && aliasedBlockerOk(ri)],
    ['non-aliased -> blocker no-source-bundle', selfBlockerOk(os)],
    ['aliased -> warning alias-resolved', gc.audit.warnings.some(function (w) { return w.indexOf('alias-resolved') >= 0; })],
    ['identity completeness now 100% (was 83%)', gc.audit.fieldCompleteness.sections.identity.pct === 100],
    ['completeness does not regress (overall >= 50)', gc.audit.fieldCompleteness.overallPct >= 50],
    ['finalizer safeInput has canonicalDiagnosisId + aliasUsed', !!finId && finId.canonicalDiagnosisId === 'GRID_FREQUENCY_INSTABILITY' && finId.aliasUsed === true],
    ['non-energy domain stays null', nonEnergyClean],
    ['six diagnoses still emit', (brain.state.diagnoses || []).length === 6 && packets.length === 6]
  ];
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nF3: ' + (allPass ? 'PASS ✓ — canonical identity resolved, bundles stay honest' : 'FAIL ✗') + '\n');
  console.log('================ END F3 PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
