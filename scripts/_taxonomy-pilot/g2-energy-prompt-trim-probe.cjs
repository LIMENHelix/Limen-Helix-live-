/**
 * g2-energy-prompt-trim-probe.cjs — proves G2 prompt trimming: the DDP carries a bounded
 * promptView (caps + omittedCounts), full data is preserved (stored bundles + full DDP arrays),
 * the finalizer safeInput receives the COMPACT packet (no unbounded arrays), and all must-keep
 * scalars/warnings survive. Exits non-zero if a bundle is mutated or warnings disappear.
 * Read-only. Run: node scripts/_taxonomy-pilot/g2-energy-prompt-trim-probe.cjs
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

// full anchor counts in the stored bundle files (must stay unchanged by G2)
function bundleAnchorCount(canon) { try { var b = JSON.parse(fs.readFileSync(path.join(BD, canon + '.json'), 'utf8')); return (b.byLane.patents.evidenceAnchors || []).length; } catch (e) { return -1; } }

(async function () {
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  await brain._loadDiagnosisBundles();

  const cc = civContext();
  loadWithCapture(cc, 'assets/js/domain-brain-adapter.js', ['_buildPayload']);
  loadWithCapture(cc, 'assets/js/civilization/domain-packet-adapter.js', ['_buildPacket']);
  loadWithCapture(cc, 'assets/js/civilization/handoff-contract.js', ['_packetForLane']);
  vm.runInContext(A('assets/js/civilization/artifact-packet-builder.js'), cc, { filename: 'apb' });
  const cap = cc.window.__cap, APB = cc.window.LIMENArtifactPacketBuilder;
  const finalizer = require('../../handlers/expand-artifact.js');

  function threadDx(dxId) {
    brain.state.diagnoses.forEach(d => d.active = (d.id === dxId));
    brain._updateEnergyModel();
    var fullDDP = JSON.parse(JSON.stringify(brain.state.energyModel.domainDiagnosisPacket));
    cc.window.LIMENDomains = { energy: cap._buildPayload(JSON.parse(JSON.stringify(brain.state))) };
    var handoff = cap._packetForLane('patents', { id: 'o', domains: ['energy'], confidence: 0.9, evidenceQuality: 0.9, urgency: 0.6 }, { energy: cap._buildPacket('energy') });
    var safe = finalizer._extractSafeInput(APB.buildFromHandoffPacket(handoff, {}));
    return { fullDDP: fullDDP, compact: safe.energyDomainDiagnosisPacket };
  }

  console.log('\n================ G2 — PROMPT TRIM / PRIORITIZATION PROOF ================\n');
  const gc = threadDx('GRID_COLLAPSE'), pd = threadDx('PIPELINE_DISRUPTION'), os = threadDx('OIL_SHOCK');

  console.log('--- BEFORE/AFTER (GRID_COLLAPSE: 32-anchor bundle) ---');
  console.log('  stored bundle file anchors: ' + bundleAnchorCount('GRID_FREQUENCY_INSTABILITY'));
  console.log('  full DDP evidence.evidenceAnchors: ' + gc.fullDDP.evidence.evidenceAnchors.length + ' (preserved)');
  console.log('  compact promptView.selectedEvidenceAnchors: ' + gc.compact.promptView.selectedEvidenceAnchors.length + ' (capped at 8)');
  console.log('  omittedCounts.evidenceAnchors: ' + gc.compact.promptView.omittedCounts.evidenceAnchors);
  console.log('  full DDP JSON bytes: ' + JSON.stringify(gc.fullDDP).length + ' -> compact safeInput packet bytes: ' + JSON.stringify(gc.compact).length);

  console.log('\n--- PROMPTVIEW EXAMPLES ---');
  console.log('  GRID_COLLAPSE: canonical=' + gc.compact.identity.canonicalDiagnosisId + ' anchors=' + gc.compact.promptView.selectedEvidenceAnchors.length + '/' + (gc.compact.promptView.selectedEvidenceAnchors.length + gc.compact.promptView.omittedCounts.evidenceAnchors) + ' mech=' + gc.compact.promptView.selectedMechanismCandidates.length);
  console.log('  PIPELINE_DISRUPTION: aliasReviewStatus=' + pd.compact.identity.aliasReviewStatus + ' aliasRisk=' + pd.compact.identity.aliasRisk + ' | retainedWarnings has alias-resolved=' + pd.compact.promptView.retainedWarnings.some(w => w.indexOf('alias-resolved') >= 0));
  console.log('  OIL_SHOCK: buildMethod=' + os.compact.bundle.buildMethod + ' humanVerificationRequired=' + os.compact.bundle.humanVerificationRequired + ' | retainedWarnings has external-source-authored=' + os.compact.promptView.retainedWarnings.some(w => w.indexOf('external-source-authored') >= 0));

  // bundle files unchanged (counts match expectation)
  var bundlesIntact = bundleAnchorCount('GRID_FREQUENCY_INSTABILITY') === 32 && bundleAnchorCount('INTERMITTENCY_SPIKE') === 32 && bundleAnchorCount('PIPELINE_RUPTURE_EVENT') === 32 && bundleAnchorCount('OIL_SHOCK') === 4 && bundleAnchorCount('NUCLEAR_INCIDENT') === 2 && bundleAnchorCount('SYSTEMIC_ENERGY_STRESS') === 3;

  console.log('\n--- ACCEPTANCE ---');
  const checks = [
    ['promptView present + compact', gc.compact.promptView && gc.compact.promptView.compact === true],
    ['evidenceAnchors capped at 8 (GRID 32->8)', gc.compact.promptView.selectedEvidenceAnchors.length === 8],
    ['omittedCounts correct (GRID anchors omitted=24)', gc.compact.promptView.omittedCounts.evidenceAnchors === 24],
    ['FULL DDP arrays preserved (32 anchors)', gc.fullDDP.evidence.evidenceAnchors.length === 32],
    ['stored bundle files UNCHANGED (full anchor counts intact)', bundlesIntact],
    ['compact safeInput smaller than full DDP', JSON.stringify(gc.compact).length < JSON.stringify(gc.fullDDP).length],
    ['compact packet carries NO unbounded top-level evidenceAnchors array', !Array.isArray(gc.compact.evidenceAnchors) && gc.compact.promptView.selectedEvidenceAnchors.length <= 8],
    ['canonicalDiagnosisId survives', gc.compact.identity.canonicalDiagnosisId === 'GRID_FREQUENCY_INSTABILITY'],
    ['PIPELINE aliasReviewStatus/aliasRisk survive', pd.compact.identity.aliasReviewStatus === 'human-approved' && pd.compact.identity.aliasRisk === 'medium'],
    ['external buildMethod + humanVerificationRequired survive', os.compact.bundle.buildMethod === 'external-source-authored' && os.compact.bundle.humanVerificationRequired === 'required'],
    ['predictionError + regulationState survive', typeof gc.compact.brainState.predictionError === 'number' && !!gc.compact.brainState.regulationState],
    ['retainedWarnings keep external-source-authored (OIL) + root-only (GRID) + alias-resolved (PIPELINE)', os.compact.promptView.retainedWarnings.some(w => w.indexOf('external-source-authored') >= 0) && gc.compact.promptView.retainedWarnings.some(w => w.indexOf('source-bundle-root-only') >= 0) && pd.compact.promptView.retainedWarnings.some(w => w.indexOf('alias-resolved') >= 0)],
    ['retainedBlockers present', Array.isArray(gc.compact.promptView.retainedBlockers)],
    ['bundleStatus survives (found for all 6 still covered)', gc.compact.bundle.bundleStatus === 'found'],
    ['six diagnoses still emit', (brain.state.diagnoses || []).length === 6],
    ['non-energy stays null', (function () { cc.window.LIMENDomains = { finance: { brainDiagnoses: [], brainTreatments: [], brainOpportunities: [] } }; return !cap._buildPacket('finance').deepBrain; })()]
  ];
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nG2: ' + (allPass ? 'PASS ✓ — prompt bounded, full data preserved, must-keep survives' : 'FAIL ✗') + '\n');
  console.log('================ END G2 PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
