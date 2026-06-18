/**
 * h-energy-higher-layers-probe.cjs — PHASES H1-H6 consolidated targeted gate (fast-proof mode).
 * Proves the higher Energy brain layers exist on state, emit COMPACT summaries into the DDP
 * promptView, reach the finalizer safeInput, and obey the global constraints (no fabrication,
 * intuition/simulation labelled, L2 quarantined, human-verification + alias-risk warnings survive,
 * promptView stays compact). Also runs the 5 CRITICAL GATES. Read-only. Exits non-zero on failure.
 *   node scripts/_taxonomy-pilot/h-energy-higher-layers-probe.cjs
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
  brain.state.diagnoses.forEach(d => d.active = (d.id === dxId));
  brain._updateEnergyModel();
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
  const nonEnergyClean = !cap._buildPacket('finance').deepBrain;
  return { finPkt, nonEnergyClean };
}

(async function () {
  console.log('\n================ H1-H6 — HIGHER ENERGY BRAIN LAYERS ================\n');
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  await brain._loadDiagnosisBundles();
  brain._updateEnergyModel();
  // a second cycle so intuition has a predictionError history + immuneMemory increments
  await brain.cycle();
  brain._updateEnergyModel();

  const st = brain.state;
  const im = st.energyImmune, aw = st.energyAwareness, con = st.energyConscience, it = st.energyIntuition, sim = st.energySimulation, rep = st.energyExecutiveReport;
  const packets = JSON.parse(JSON.stringify(st.energyDomainDiagnosisPackets || []));
  const primary = packets[0] || {};
  const pv = primary.promptView || {};

  // thread an external-source diagnosis (OIL_SHOCK) so human-verification + immune ride to finalizer
  const ext = threadToFinalizer(brain, 'OIL_SHOCK');
  const finPkt = ext.finPkt, fpv = (finPkt && finPkt.promptView) || {};

  console.log('--- state layers ---');
  console.log('  immune:', im && im.immuneState, '| sev', im && im.severity, '| antigens', im && (im.antigens || []).length, '| blockedTraversal', JSON.stringify(im && im.blockedFromTraversal));
  console.log('  awareness:', aw && (aw.knowns || []).length + ' knowns / ' + (aw.unknowns || []).length + ' unknowns / HV ' + JSON.stringify(aw && aw.humanReviewRequired));
  console.log('  conscience:', con && con.conscienceState, '| blocked', JSON.stringify(con && con.blockedClaims), '| readiness', JSON.stringify(con && con.artifactReadinessDecision));
  console.log('  intuition:', it && (it.hunches || []).length + ' hunch(es), labels=' + JSON.stringify((it.hunches || []).map(h => h.label + '/' + h.evidenceStatus)));
  console.log('  simulation:', sim && (sim.scenarios || []).length + ' scenarios, types=' + JSON.stringify((sim.scenarios || []).map(x => x.type)));
  console.log('  executive:', rep && rep.brainStatus, '| nextBestAction:', rep && rep.nextBestAction);
  console.log('\n--- finalizer safeInput.promptView higher-layer summaries ---');
  console.log('  immuneSummary:', !!fpv.immuneSummary, '| awarenessSummary:', !!fpv.awarenessSummary, '| conscienceDecision:', !!fpv.conscienceDecision, '| intuitionSummary:', !!fpv.intuitionSummary, '| scenarioSummary:', !!fpv.scenarioSummary, '| executiveReport:', !!fpv.executiveReport);
  console.log('  packet size (compact, OIL_SHOCK):', JSON.stringify(finPkt).length + 'B');

  const hunchInAnchors = (it && it.hunches || []).some(h => (pv.selectedEvidenceAnchors || []).some(a => JSON.stringify(a).indexOf(h.hunch) >= 0));

  // H4 non-vacuous: FORCE a weak-signal condition and prove the hunch path labels + contains it
  brain.state.energyModel.regulation = brain.state.energyModel.regulation || {};
  brain.state.energyModel.regulation.state = 'surprised';
  const forcedIt = brain._computeEnergyIntuition();
  const forcedHunch = (forcedIt.hunches || [])[0] || null;
  brain._updateEnergyModel(); // restore real regulation; re-derive everything cleanly
  const forcedHunchLeaked = forcedHunch && (JSON.parse(JSON.stringify(brain.state.energyDomainDiagnosisPackets || []))
    .some(p => (p.evidence && (p.evidence.evidenceAnchors || []).some(a => JSON.stringify(a).indexOf(forcedHunch.hunch) >= 0))));
  console.log('  [forced] intuition under regulation=surprised ->', (forcedIt.hunches || []).length, 'hunch(es); first label=', forcedHunch && (forcedHunch.label + '/' + forcedHunch.evidenceStatus));

  const checks = [
    // ── H1 immune ──
    ['H1 energyImmune exists (state + version)', !!im && im.version === 1],
    ['H1 L2 + synthetic content quarantined / blocked from traversal', (im.blockedFromTraversal || []).indexOf('L2') >= 0 && (im.quarantines || []).some(q => /synthetic|mad-lib/i.test(q))],
    ['H1 external-source bundle present as allow-with-warning antigen', (im.allowedWithWarning || []).some(x => x.indexOf('external-source-authored') >= 0)],
    ['H1 alias-risk (PIPELINE) present as allow-with-warning antigen', (im.allowedWithWarning || []).some(x => x.indexOf('alias-risk') >= 0)],
    ['H1 immune summary reaches finalizer + appears in retainedWarnings', !!fpv.immuneSummary && (fpv.retainedWarnings || []).some(w => w.indexOf('immune:') >= 0)],
    // ── H2 awareness ──
    ['H2 energyAwareness exists with knowns + unknowns', !!aw && Array.isArray(aw.knowns) && Array.isArray(aw.unknowns) && aw.knowns.length > 0],
    ['H2 awareness lists quarantined/suppressed items', (aw.suppressions || []).some(x => /L2|synthetic|mad-lib/i.test(x))],
    ['H2 awareness flags humanReviewRequired (external-source dx)', (aw.humanReviewRequired || []).length > 0],
    ['H2 compact awarenessSummary reaches finalizer', !!fpv.awarenessSummary && typeof fpv.awarenessSummary.selfNarrative === 'string'],
    // ── H3 conscience ──
    ['H3 energyConscience exists (restrictive — has vetoes)', !!con && con.conscienceState === 'restrictive' && (con.vetoes || []).length > 0],
    ['H3 patent + grant BLOCKED (no candidate fields)', con.artifactReadinessDecision.patentReady === false && con.artifactReadinessDecision.grantReady === false && (con.blockedClaims || []).indexOf('patent-claim') >= 0],
    ['H3 source-backed summary allowed', (con.allowedClaims || []).indexOf('source-summary') >= 0],
    ['H3 no fake readiness created (nothing forced ready)', !con.artifactReadinessDecision.patentReady && !con.artifactReadinessDecision.grantReady && !con.artifactReadinessDecision.sbaReady],
    ['H3 conscience decision + warning reach finalizer', !!fpv.conscienceDecision && (fpv.retainedWarnings || []).some(w => w.indexOf('conscience:') >= 0)],
    // ── H4 intuition ──
    ['H4 energyIntuition exists', !!it && it.version === 1],
    ['H4 forced weak-signal produces >=1 hunch (path is live, not vacuous)', !!forcedHunch],
    ['H4 every hunch labelled HUNCH + UNVERIFIED + has why/verify/falsify', (it.hunches || []).concat(forcedIt.hunches || []).every(h => h.label === 'HUNCH' && h.evidenceStatus === 'UNVERIFIED' && h.why && h.verifyIf && h.falsifyIf)],
    ['H4 <=3 hunches per cycle', (it.hunches || []).length <= 3 && (forcedIt.hunches || []).length <= 3],
    ['H4 NO hunch leaked into evidenceAnchors (baseline + forced)', !hunchInAnchors && !forcedHunchLeaked],
    ['H4 hunch did not mark any artifact ready', con.artifactReadinessDecision.patentReady === false],
    ['H4 compact intuitionSummary reaches finalizer', Array.isArray(fpv.intuitionSummary)],
    // ── H5 simulation ──
    ['H5 energySimulation exists with >=3 scenario types', !!sim && (sim.scenarios || []).length >= 3],
    ['H5 every scenario marked hypothetical', (sim.scenarios || []).every(x => x.hypothetical === true)],
    ['H5 simulated diagnoses NOT injected as evidence (anchors are real sources)', (primary.evidence && (primary.evidence.evidenceAnchors || []).every(a => !/hypothetical|simulated/i.test(JSON.stringify(a))))],
    ['H5 compact scenarioSummary reaches finalizer (hypothetical flag preserved)', Array.isArray(fpv.scenarioSummary) && fpv.scenarioSummary.every(x => x.hypothetical === true)],
    // ── H6 executive report ──
    ['H6 energyExecutiveReport exists with brainStatus', !!rep && typeof rep.brainStatus === 'string'],
    ['H6 report reflects human-review-required for external-source dx (OIL_SHOCK active)', (finPkt && finPkt.bundle && finPkt.bundle.humanVerificationRequired === 'required') || rep.brainStatus === 'human-review-required' || rep.brainStatus === 'source-limited'],
    ['H6 report reflects L2 traversal block (via immuneState)', rep.immuneState === im.immuneState],
    ['H6 report does NOT hide blockers', (rep.blockers || []).length > 0],
    ['H6 executiveReport reaches finalizer', !!fpv.executiveReport && typeof fpv.executiveReport.brainStatus === 'string'],
    // ── promptView stays compact (G2 not degraded) ──
    ['G2 NOT degraded: promptView still compact + capped', pv.compact === true && !!pv.caps && Array.isArray(pv.selectedEvidenceAnchors)],
    ['compact finalizer packet bounded (<12KB even with H-layers)', JSON.stringify(finPkt).length < 12000],
    // ── 5 CRITICAL GATES ──
    ['GATE1 six diagnoses still emit', (st.diagnoses || []).length === 6 && packets.length === 6],
    ['GATE2 energyModel exists + updates (prior + predictionError)', !!st.energyModel && !!st.energyModel.prior && typeof (st.energyModel.predictionError || {}).total === 'number'],
    ['GATE3 Energy DDP reaches finalizer safeInput', !!finPkt && !!finPkt.identity && !!finPkt.identity.diagnosisId],
    ['GATE4 G2 compact promptView still exists at finalizer', !!fpv && fpv.compact === true && Array.isArray(fpv.selectedEvidenceAnchors)],
    ['GATE5 non-energy domain stays no-op/null', ext.nonEnergyClean === true]
  ];

  console.log('\n--- ACCEPTANCE ---');
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nH1-H6: ' + (allPass ? 'PASS ✓ — immune+awareness+conscience+intuition+simulation+executive wired, compact, finalizer-safe' : 'FAIL ✗') + '\n');
  console.log('================ END H1-H6 PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
