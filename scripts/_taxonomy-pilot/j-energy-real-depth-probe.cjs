/**
 * j-energy-real-depth-probe.cjs — PHASES J1/J2/J3 (fast-proof gate). Proves:
 *  J1 L1 portal scan: treatments are 100% mad-lib -> NOT admitted; only real tickers surfaced
 *     (relevance-unverified, never in evidenceAnchors); immune quarantines L1 treatments.
 *  J2 human-authoring intake: external-source bundles emit empty method/embodiment/figure slots
 *     marked needs-human-input (NOT fabricated); intake reaches the finalizer.
 *  J3 intuition deepened: real patternMatches + analogies + promotion-to-MONITORING (never diagnosis).
 *  + the 5 critical gates. Read-only. Exits non-zero on failure.
 *    node scripts/_taxonomy-pilot/j-energy-real-depth-probe.cjs
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
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }
function threadToFinalizer(brain, dxId) {
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

(async function () {
  console.log('\n================ J1/J2/J3 — REAL DEPTH, AUTHORING INTAKE, DEEPER INTUITION ================\n');
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle(); await brain._loadDiagnosisBundles(); await brain._loadL1PortalDepth(); brain._updateEnergyModel();

  const st = brain.state, l1 = st._l1DepthCache, im = st.energyImmune;
  const grid = l1.byDiagnosis['GRID_COLLAPSE'];
  console.log('--- J1 L1 scan ---');
  Object.keys(l1.byDiagnosis).forEach(dx => { const d = l1.byDiagnosis[dx]; console.log('  ' + dx.padEnd(24) + ' tickers=' + String(d.realCompanyTickers.length).padStart(3) + ' realTreat=' + d.realTreatments + ' madLib=' + String(d.madLibTreatments).padStart(4) + ' admitted=' + d.admitted); });

  // J1: prove no L1 treatment text leaked into any packet's evidenceAnchors
  brain._updateEnergyModel();
  const packets = JSON.parse(JSON.stringify(st.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(p => byId[p.identity.diagnosisId] = p);
  const MADLIB = /^(Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Develop|Establish|Implement|Build)\b/;
  const noMadlibInEvidence = packets.every(p => (p.evidence.evidenceAnchors || []).every(a => !MADLIB.test(String(a.title || a.label || a.text || ''))));

  // J2: external-source diagnosis -> authoring intake
  const ext = threadToFinalizer(brain, 'OIL_SHOCK');
  const finPkt = ext.finPkt, fpv = (finPkt && finPkt.promptView) || {};
  const oil = byId['OIL_SHOCK'];
  const intake = (oil.treatmentContext.authoringIntake) || [];
  console.log('\n--- J2 authoring intake (OIL_SHOCK) ---');
  intake.forEach(s => console.log('  ' + s.field.padEnd(22) + ' status=' + s.status + ' count=' + s.count + ' src=' + s.sourceHint));

  // J3: force pattern + analogy + promotion conditions, then recompute intuition
  st.memory.outcomeLog = [{ regulation: 'surprised' }, { regulation: 'surprised' }, { regulation: 'surprised' }, { regulation: 'baseline' }];
  st.energyModel.regulation = st.energyModel.regulation || {}; st.energyModel.regulation.state = 'surprised';
  st.diagnoses.forEach(d => d.active = (d.id === 'OIL_SHOCK'));
  let it;
  for (let i = 0; i < 3; i++) it = brain._computeEnergyIntuition();  // recur a hunch 3 cycles -> promotion
  console.log('\n--- J3 intuition ---');
  console.log('  hunches=' + it.hunches.length + ' patternMatches=' + it.patternMatches.length + ' analogies=' + it.analogies.length + ' promotedToMonitoring=' + it.promotedToMonitoring.length + ' promotedToDiagnosis=' + it.promotedToDiagnosis.length);
  console.log('  analogy sample:', JSON.stringify(it.analogies[0] || null));
  console.log('  promotion sample:', JSON.stringify(it.promotedToMonitoring[0] || null));
  const promotedLeaked = it.promotedToMonitoring.some(pm => (byId['OIL_SHOCK'].evidence.evidenceAnchors || []).some(a => JSON.stringify(a).indexOf(pm.target) >= 0));

  const checks = [
    // J1
    ['J1 _l1DepthCache exists + scanned all 6 diagnoses', !!l1 && Object.keys(l1.byDiagnosis).length === 6],
    ['J1 L1 treatments are 100% mad-lib (realTreatments===0 everywhere)', Object.keys(l1.byDiagnosis).every(dx => l1.byDiagnosis[dx].realTreatments === 0 && l1.byDiagnosis[dx].madLibTreatments > 0)],
    ['J1 real company tickers ARE surfaced (relevance-unverified)', grid.realCompanyTickers.length > 0 && grid.realCompanyTickers.every(t => t.relevanceUnverified === true)],
    ['J1 L1 NOT admitted as evidence (admitted=false)', Object.keys(l1.byDiagnosis).every(dx => l1.byDiagnosis[dx].admitted === false)],
    ['J1 immune raises l1-synthetic-treatments antigen', (im.antigens || []).some(a => a.type === 'l1-synthetic-treatments')],
    ['J1 immune quarantines L1 portal treatments', (im.quarantines || []).some(q => /L1-portal-treatments/.test(q))],
    ['J1 portalContext.l1Depth present on packet', !!oil.portalContext.l1Depth && oil.portalContext.l1Depth.admitted === false],
    ['J1 NO mad-lib treatment leaked into evidenceAnchors', noMadlibInEvidence],
    ['J1 l1DepthSummary reaches finalizer', !!fpv.l1DepthSummary && fpv.l1DepthSummary.admitted === false],
    // J2
    ['J2 OIL_SHOCK emits 3 authoring-intake slots (method/embodiment/figure)', intake.length === 3 && intake.every(s => s.status === 'needs-human-input' && s.count === 0)],
    ['J2 intake carries a real source hint (not fabricated content)', intake.every(s => !!s.sourceHint && /NOT fabricated/.test(s.note))],
    ['J2 method/embodiment/figure STILL empty (nothing fabricated)', oil.treatmentContext.methodCandidates.length + oil.treatmentContext.embodimentCandidates.length + oil.treatmentContext.figurePlaceholders.length === 0],
    ['J2 authoringIntake reaches finalizer safeInput', Array.isArray(fpv.authoringIntake) && fpv.authoringIntake.length === 3],
    ['J2 conscience STILL vetoes patent/grant (intake != readiness)', byId['OIL_SHOCK'].promptView.conscienceDecision.artifactReadinessDecision.patentReady === false],
    // J3
    ['J3 patternMatches populated from real memory (recurring regulation)', it.patternMatches.some(p => /recurring regulation/.test(p.pattern))],
    ['J3 analogies populated (OIL_SHOCK ~ PIPELINE_DISRUPTION, supply-disruption)', it.analogies.some(a => /PIPELINE_DISRUPTION/.test(a.analogy) && a.label === 'ANALOGY')],
    ['J3 promotion to MONITORING after 3 recurrences', it.promotedToMonitoring.length >= 1 && /monitoring target ONLY/.test(it.promotedToMonitoring[0].note)],
    ['J3 promotedToDiagnosis stays EMPTY (never auto-promoted)', it.promotedToDiagnosis.length === 0],
    ['J3 patterns/analogies/promotion all labelled UNVERIFIED/ANALOGY (not evidence)', it.patternMatches.every(p => p.evidenceStatus === 'UNVERIFIED') && it.analogies.every(a => a.evidenceStatus === 'UNVERIFIED')],
    ['J3 nothing promoted leaked into evidenceAnchors', !promotedLeaked],
    // 5 CRITICAL GATES
    ['GATE1 six diagnoses still emit', (st.diagnoses || []).length === 6 && packets.length === 6],
    ['GATE2 energyModel exists + updates', !!st.energyModel && !!st.energyModel.prior && typeof (st.energyModel.predictionError || {}).total === 'number'],
    ['GATE3 Energy DDP reaches finalizer safeInput', !!finPkt && !!finPkt.identity.diagnosisId],
    ['GATE4 G2 compact promptView still exists', !!fpv && fpv.compact === true && Array.isArray(fpv.selectedEvidenceAnchors)],
    ['GATE5 non-energy domain stays no-op/null', ext.nonEnergyClean === true]
  ];

  console.log('\n--- ACCEPTANCE ---');
  let allPass = true;
  checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nJ1/J2/J3: ' + (allPass ? 'PASS ✓ — L1 honestly quarantined, authoring intake live, intuition deepened, no fabrication' : 'FAIL ✗') + '\n');
  console.log('================ END J PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
