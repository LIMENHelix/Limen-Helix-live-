/**
 * h7-energy-functioning-brain-final-audit.cjs — PHASE H7 final acceptance audit.
 * Scores Energy against the 20-point functioning-brain standard in ONE run: sensing, recurrence,
 * prediction error, plasticity, regulation, 6/6 source grounding, finalizer survival, prompt
 * trimming, immune, awareness, conscience, intuition, simulation, executive report, portal-cortex
 * limits, L2 block, no-fabrication, human-verification + alias-risk survival, non-energy unchanged.
 * Read-only. Exits non-zero if any item fails. node scripts/_taxonomy-pilot/h7-...-final-audit.cjs
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
  console.log('\n================ H7 — ENERGY FUNCTIONING-BRAIN FINAL AUDIT ================\n');
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle(); await brain._loadDiagnosisBundles(); brain._updateEnergyModel();
  const priorBefore = JSON.stringify(brain.state.energyModel.prior);
  await brain.cycle(); brain._updateEnergyModel();
  const priorAfter = JSON.stringify(brain.state.energyModel.prior);

  const st = brain.state, em = st.energyModel;
  const packets = JSON.parse(JSON.stringify(st.energyDomainDiagnosisPackets || []));
  const byId = {}; packets.forEach(p => byId[p.identity.diagnosisId] = p);
  const allFound = packets.length === 6 && packets.every(p => p.evidence.bundleStatus === 'found');
  const oilPkt = byId['OIL_SHOCK'] || {};
  const oilNoFakeCandidates = oilPkt.treatmentContext && (oilPkt.treatmentContext.methodCandidates.length + oilPkt.treatmentContext.embodimentCandidates.length + oilPkt.treatmentContext.figurePlaceholders.length === 0);
  const pipePkt = byId['PIPELINE_DISRUPTION'] || {};
  const aliasWarnSurvives = pipePkt.audit && pipePkt.audit.warnings.some(w => w.indexOf('alias-resolved') >= 0);
  // stored bundle files carry no fabricated candidate arrays (external-source ones)
  const storedNoFake = ['OIL_SHOCK', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'].every(id => { const l = JSON.parse(fs.readFileSync(path.join(BD, id + '.json'), 'utf8')).byLane.patents; return (l.methodCandidates || []).length === 0 && (l.embodimentCandidates || []).length === 0 && (l.figurePlaceholders || []).length === 0; });

  const ext = threadToFinalizer(brain, 'OIL_SHOCK');
  const finPkt = ext.finPkt, fpv = (finPkt && finPkt.promptView) || {};

  const checklist = [
    ['1. Sensory input present', typeof st.stress === 'number' && Array.isArray(st.diagnoses)],
    ['2. Recurrent prior present', !!em.prior && typeof em.prior === 'object'],
    ['3. Prediction error present', typeof (em.predictionError || {}).total === 'number'],
    ['4. Plasticity/update present (prior changes across cycles)', priorBefore !== priorAfter],
    ['5. Regulation present', !!em.regulation && typeof em.regulation.state === 'string'],
    ['6. Source grounding 6/6 present', allFound],
    ['7. Downstream finalizer survival present', !!finPkt && !!finPkt.identity.diagnosisId],
    ['8. Prompt trimming present (compact + caps)', fpv.compact === true && !!fpv.caps],
    ['9. Formal immune system present', !!st.energyImmune && st.energyImmune.version === 1],
    ['10. Awareness/metacognition present', !!st.energyAwareness && Array.isArray(st.energyAwareness.knowns)],
    ['11. Conscience/veto present', !!st.energyConscience && (st.energyConscience.vetoes || []).length > 0],
    ['12. Intuition/hunch layer present', !!st.energyIntuition && st.energyIntuition.version === 1],
    ['13. Simulation/counterfactual layer present', !!st.energySimulation && (st.energySimulation.scenarios || []).length >= 3],
    ['14. Executive self-report present', !!st.energyExecutiveReport && typeof st.energyExecutiveReport.brainStatus === 'string'],
    ['15. Portal cortex limits known + respected', (st.energyImmune.quarantines || []).some(q => /mad-lib/i.test(q))],
    ['16. L2 synthetic content blocked', (st.energyImmune.blockedFromTraversal || []).indexOf('L2') >= 0],
    ['17. No fake evidence/candidates (packet + stored bundles)', oilNoFakeCandidates && storedNoFake],
    ['18. Human-verification warnings survive to finalizer', finPkt.bundle.humanVerificationRequired === 'required' && (fpv.retainedWarnings || []).some(w => /human-verification|external-source/.test(w))],
    ['19. Alias-risk warnings survive', !!aliasWarnSurvives],
    ['20. Non-energy behavior unchanged (null deepBrain)', ext.nonEnergyClean === true]
  ];

  console.log('--- FINAL BRAIN SCORECARD ---');
  let pass = 0;
  checklist.forEach(c => { if (c[1]) pass++; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  // finalizer carries all 7 compact bundles
  const carries = ['promptView', 'immuneSummary', 'awarenessSummary', 'conscienceDecision', 'intuitionSummary', 'scenarioSummary', 'executiveReport'];
  const finalizerCarriesAll = !!finPkt && !!fpv && carries.slice(1).every(k => fpv[k] !== undefined) && fpv.compact === true;
  const bounded = JSON.stringify(finPkt).length < 12000;
  console.log('\n  finalizer carries promptView + 6 layer summaries:', finalizerCarriesAll, '| packet', JSON.stringify(finPkt).length + 'B (bounded ' + bounded + ')');
  console.log('  brainStatus:', st.energyExecutiveReport.brainStatus, '| six diagnoses emit:', packets.length === 6);

  const allPass = pass === checklist.length && finalizerCarriesAll && bounded && packets.length === 6;
  console.log('\nH7: ' + pass + '/' + checklist.length + ' checklist + finalizer-carries-all=' + finalizerCarriesAll + ' + bounded=' + bounded);
  console.log('H7: ' + (allPass ? 'PASS ✓ — Energy qualifies as functioning recurrent, source-grounded, immune, aware, conscience-gated, intuition-capable, simulation-capable domain brain v1' : 'FAIL ✗') + '\n');
  console.log('================ END H7 AUDIT ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
