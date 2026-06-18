/**
 * energy-template-lock-probe.cjs — ENERGY BRAIN v1 TEMPLATE LOCK (meta-gate, fast-proof).
 * Freezes the reusable domain-brain standard. Asserts the 18-point template standard against the live
 * Energy brain, guards the runtime mad-lib detector against drift from the canonical classifier, and
 * re-runs j-energy-real-depth-probe + h7-final-audit as child processes (must exit 0). Read-only.
 *   node scripts/_taxonomy-pilot/energy-template-lock-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const L = require('./lib.cjs');
const CLS = require('./_portal-real-content-classifier.cjs');
const ROOT = path.join(__dirname, '..', '..');
const A = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

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
function thread(brain, dxId) {
  brain.state.diagnoses.forEach(d => d.active = (d.id === dxId)); brain._updateEnergyModel();
  const cc = civContext();
  loadWithCapture(cc, 'assets/js/domain-brain-adapter.js', ['_buildPayload']);
  loadWithCapture(cc, 'assets/js/civilization/domain-packet-adapter.js', ['_buildPacket']);
  loadWithCapture(cc, 'assets/js/civilization/handoff-contract.js', ['_packetForLane']);
  vm.runInContext(A('assets/js/civilization/artifact-packet-builder.js'), cc, { filename: 'apb' });
  const cap = cc.window.__cap, APB = cc.window.LIMENArtifactPacketBuilder;
  cc.window.LIMENDomains = { energy: cap._buildPayload(JSON.parse(JSON.stringify(brain.state))) };
  const handoff = cap._packetForLane('patents', { id: 'o', domains: ['energy'], confidence: 0.9, evidenceQuality: 0.9, urgency: 0.6 }, { energy: cap._buildPacket('energy') });
  const finPkt = require('../../handlers/expand-artifact.js')._extractSafeInput(APB.buildFromHandoffPacket(handoff, {})).energyDomainDiagnosisPacket;
  cc.window.LIMENDomains = { finance: { brainDiagnoses: [], brainTreatments: [], brainOpportunities: [] } };
  return { finPkt, nonEnergyClean: !cap._buildPacket('finance').deepBrain };
}
function runChild(name) { try { cp.execFileSync('node', [path.join(__dirname, name)], { stdio: 'ignore' }); return true; } catch (e) { return false; } }

(async function () {
  console.log('\n================ ENERGY BRAIN v1 — TEMPLATE LOCK ================\n');

  // ── drift guard: runtime inline mad-lib verbs must contain the canonical set ──
  const ebSrc = A('assets/js/domain-brains/energy-brain.js');
  const m = ebSrc.match(/var MADLIB_VERB = \/\^\(([^)]+)\)/);
  const runtimeVerbs = m ? m[1].split('|') : [];
  const driftOk = CLS.MADLIB_VERBS.every(v => runtimeVerbs.indexOf(v) >= 0);
  console.log('runtime mad-lib verbs:', runtimeVerbs.length, '| canonical:', CLS.MADLIB_VERBS.length, '| drift-free:', driftOk);

  // ── classifier sanity on real L1 files (MIXED must NOT qualify as depth) ──
  const grid = CLS.classifyPortalFile(JSON.parse(A('assets/data/domains/energy_grid.json')));
  const root = CLS.classifyPortalFile(JSON.parse(A('assets/data/domains/energy.json')));
  console.log('classifier: energy_grid =', grid.cls, '(tmplRatio ' + grid.tmplRatio + ', qualifiesAsDepth ' + CLS.qualifiesAsRealDepth(grid) + ')  | energy(root) =', root.cls, '(qualifies ' + CLS.qualifiesAsRealDepth(root) + ')');

  // ── load brain ──
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle(); await brain._loadDiagnosisBundles(); await brain._loadL1PortalDepth(); brain._updateEnergyModel();
  const priorBefore = JSON.stringify(brain.state.energyModel.prior);
  await brain.cycle(); brain._updateEnergyModel();
  const priorAfter = JSON.stringify(brain.state.energyModel.prior);

  const st = brain.state, em = st.energyModel;
  const packets = JSON.parse(JSON.stringify(st.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(p => byId[p.identity.diagnosisId] = p);
  const ext = thread(brain, 'OIL_SHOCK'); const finPkt = ext.finPkt, fpv = (finPkt && finPkt.promptView) || {};
  const oil = byId['OIL_SHOCK'], pipe = byId['PIPELINE_DISRUPTION'];
  let itF; st.energyModel.regulation = st.energyModel.regulation || {}; st.energyModel.regulation.state = 'surprised'; st.memory.outcomeLog = [{ regulation: 'surprised' }, { regulation: 'surprised' }, { regulation: 'surprised' }]; for (let i = 0; i < 3; i++) itF = brain._computeEnergyIntuition();

  const std = [
    ['1. Recurrent model exists', !!em.prior],
    ['2. Prediction error updates prior (changes across cycles)', priorBefore !== priorAfter && typeof (em.predictionError || {}).total === 'number'],
    ['3. DomainDiagnosisPacket survives to finalizer', !!finPkt && !!finPkt.identity.diagnosisId],
    ['4. PromptView is compact', fpv.compact === true && !!fpv.caps],
    ['5. Source coverage is explicit', packets.every(p => ['found', 'missing', 'unknown'].indexOf(p.evidence.bundleStatus) >= 0)],
    ['6. External-source bundles marked human-verification-required', oil.evidence.bundle && oil.evidence.bundle.humanVerification === 'required'],
    ['7. Alias mappings preserve aliasRisk + aliasReviewStatus', !!pipe.identity.aliasReviewStatus && !!pipe.identity.aliasRisk],
    ['8. Immune quarantines synthetic portal material (L1 treat + L2)', (st.energyImmune.quarantines || []).some(q => /L1-portal-treatments/.test(q)) && (st.energyImmune.blockedFromTraversal || []).indexOf('L2') >= 0],
    ['9. Awareness reports knowns/unknowns/suppressions', Array.isArray(st.energyAwareness.knowns) && Array.isArray(st.energyAwareness.unknowns) && Array.isArray(st.energyAwareness.suppressions)],
    ['10. Conscience blocks unsupported artifact readiness', st.energyConscience.artifactReadinessDecision.patentReady === false && st.energyConscience.artifactReadinessDecision.grantReady === false],
    ['11. Intuition cannot become evidence or diagnosis', itF.promotedToDiagnosis.length === 0 && (oil.evidence.evidenceAnchors || []).every(a => !/hunch|HUNCH/.test(JSON.stringify(a)))],
    ['12. Simulation is hypothetical only', (st.energySimulation.scenarios || []).every(x => x.hypothetical === true)],
    ['13. Executive report is compact', !!st.energyExecutiveReport && JSON.stringify(st.energyExecutiveReport).length < 1500],
    ['14. Portal cortex depth must be proven before traversal (L1 not admitted)', oil.portalContext.l1Depth.admitted === false && CLS.qualifiesAsRealDepth(grid) === false],
    ['15. Company names alone do NOT qualify portal as real (MIXED != depth; tickers relevanceUnverified)', grid.cls === 'MIXED' && !CLS.qualifiesAsRealDepth(grid) && (oil.portalContext.l1Depth.realCompanyTickers || []).every(t => t.relevanceUnverified === true)],
    ['16. Template/mad-lib treatments are quarantined', (st.energyImmune.antigens || []).some(a => a.type === 'l1-synthetic-treatments') && CLS.isTemplate('Calibrate Foo Bar') === true && CLS.isTemplate('Diversified Generation Portfolio') === false],
    ['17. Missing candidate fields route to human-authoring intake', Array.isArray(oil.treatmentContext.authoringIntake) && oil.treatmentContext.authoringIntake.length === 3 && oil.treatmentContext.authoringIntake.every(s => s.status === 'needs-human-input')],
    ['18. Non-energy domains remain unchanged', ext.nonEnergyClean === true]
  ];

  console.log('\n--- TEMPLATE STANDARD (18) ---');
  let stdPass = true;
  std.forEach(c => { stdPass = stdPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });

  console.log('\n--- ACCEPTANCE (child re-runs + guards) ---');
  const jOk = runChild('j-energy-real-depth-probe.cjs');
  const h7Ok = runChild('h7-energy-functioning-brain-final-audit.cjs');
  const acc = [
    ['j-energy-real-depth-probe exits 0', jOk],
    ['h7-energy-functioning-brain-final-audit exits 0', h7Ok],
    ['runtime mad-lib detector matches canonical classifier (no drift)', driftOk],
    ['L1 treatments quarantined (immune + classifier agree)', grid.realTreatments === 0 || !CLS.qualifiesAsRealDepth(grid)],
    ['L1 tickers relevanceUnverified only', (oil.portalContext.l1Depth.realCompanyTickers || []).every(t => t.relevanceUnverified === true)],
    ['J2 intake emits empty method/embodiment/figure slots', oil.treatmentContext.authoringIntake.map(s => s.field).sort().join(',') === 'embodimentCandidates,figurePlaceholders,methodCandidates'],
    ['promotedToMonitoring exists, promotedToDiagnosis empty', itF.promotedToMonitoring.length >= 1 && itF.promotedToDiagnosis.length === 0],
    ['no fabricated candidates (external bundle method/embodiment/figure empty)', oil.treatmentContext.methodCandidates.length + oil.treatmentContext.embodimentCandidates.length + oil.treatmentContext.figurePlaceholders.length === 0]
  ];
  let accPass = true;
  acc.forEach(c => { accPass = accPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });

  const lockDoc = fs.existsSync(path.join(ROOT, 'docs', 'audits', 'energy-brain-v1-template-lock.md'));
  console.log('\n  template-lock doc present:', lockDoc);

  const allPass = stdPass && accPass && lockDoc;
  console.log('\nTEMPLATE LOCK: ' + (allPass ? 'PASS ✓ — Energy Brain v1 frozen as the reusable domain-brain standard (cortex-depth honesty enforced)' : 'FAIL ✗') + '\n');
  console.log('================ END TEMPLATE LOCK ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
