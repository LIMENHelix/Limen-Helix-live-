/**
 * f2-populate-ddp-probe.cjs — proves F2 populates the Energy DomainDiagnosisPacket from
 * REAL state only (no invention), raising completeness above F1's 34%, while keeping
 * genuinely-absent fields explicit. Shows offline baseline vs a populated console-like state.
 * Read-only. Run: node scripts/_taxonomy-pilot/f2-populate-ddp-probe.cjs
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
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && rel.indexOf('artifact-source-index') < 0 && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };  // bundles isolated: F2 tests population, not G1 bundles
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}
function civContext() { const sb = L.makeContext({ seed: 7 }); sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); sb.window.fetch = sb.fetch; sb.window.LIMENDomains = {}; sb.window.__cap = {}; return sb; }
function loadWithCapture(ctx, file, names) { let src = A(file); const m = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}'; const i = src.lastIndexOf('})()'); src = src.slice(0, i) + m + src.slice(i); vm.runInContext(src, ctx, { filename: file }); }
function pct(p) { return p && p.audit && p.audit.fieldCompleteness ? p.audit.fieldCompleteness.overallPct : -1; }
function sectionPcts(p) { var o = {}, c = p.audit.fieldCompleteness.sections; for (var k in c) o[k] = c[k].pct; return o; }

(async function () {
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();

  // ── BASELINE (offline, no feeds/treatments/opps) ──
  brain.state.stress = 0; brain._updateEnergyModel();
  const baseline = JSON.parse(JSON.stringify(brain.state.energyModel.domainDiagnosisPacket));

  // ── POPULATED (inject a realistic console-like state with REAL-shaped data) ──
  const dxId = (brain.state.diagnoses[0] || {}).id;
  if (brain.state.diagnoses[0]) brain.state.diagnoses[0].active = true;
  brain.state.stress = 0.72;
  brain.state.confidence = 0.66;
  brain.state._primarySource = 'EIA crude spot';
  brain.state.feeds = { oilPrice: { updated: 1781700000000, source: 'EIA' }, gridFreq: { updated: 1781700000000, source: 'EIRGRID' } };
  brain.state._portalCache = JSON.parse(A('assets/data/domains/energy.json'));
  brain.state.treatments = [{ diagnosisId: dxId, label: 'Diversified Generation Portfolio', steps: ['Audit generation mix', 'Model contingency reserve'], monitoring: 'Daily reserve margin', escalation: 'NERC notification', source: 'canonical_deep' }];
  brain.state.opportunities = [{ diagnosisId: dxId, path: 'INVESTABLE', steps: ['Set entry band', 'Size position'], fastPath: ['Pull DUK chart'], compensation: { type: 'carry' }, moneyChain: { target: 'Grid utilities (DUK, NEE)', invalidIf: 'Reserve margin normalizes', nextStep: 'Open investment console' } }];
  brain._updateEnergyModel();
  const populated = JSON.parse(JSON.stringify(brain.state.energyModel.domainDiagnosisPacket));

  console.log('\n================ F2 — POPULATE DomainDiagnosisPacket PROOF ================\n');
  console.log('completeness  BEFORE(F1-era)=34%   BASELINE(F2 offline)=' + pct(baseline) + '%   POPULATED=' + pct(populated) + '%');
  console.log('section %  baseline :', JSON.stringify(sectionPcts(baseline)));
  console.log('section %  populated:', JSON.stringify(sectionPcts(populated)));
  console.log('\n--- which fields populated (populated packet) ---');
  console.log('  identity.confidence      =', populated.identity.confidence);
  console.log('  portalContext            = domain=' + populated.portalContext.portalDomain + ' status=' + populated.portalContext.portalStatus + ' depth=' + populated.portalContext.depth + ' ancestry=' + JSON.stringify(populated.portalContext.ancestryPath));
  console.log('  evidence.sourceFeeds     =', JSON.stringify(populated.evidence.sourceFeeds.map(function (f) { return f.name + ':' + f.source; })));
  console.log('  evidence.citationHints   =', JSON.stringify(populated.evidence.citationHints));
  console.log('  treatmentContext.treatments=' + populated.treatmentContext.treatments.length + '  implementationSteps=' + populated.treatmentContext.implementationSteps.length);
  console.log('  operatorContext          = target=' + JSON.stringify(populated.operatorContext.targets) + ' invalidIf=' + JSON.stringify(populated.operatorContext.invalidIf) + ' nextStep=' + JSON.stringify(populated.operatorContext.nextStep) + ' monitoring=' + JSON.stringify(populated.operatorContext.monitoring));
  console.log('  artifactContext.artifactLanes=', JSON.stringify(populated.artifactContext.artifactLanes), 'reasons=', JSON.stringify(populated.artifactContext.readinessReasons));
  console.log('\n--- which fields STILL empty + why ---');
  console.log('  canonicalDiagnosisId =', populated.identity.canonicalDiagnosisId, '(F3)');
  console.log('  evidence.evidenceAnchors =', JSON.stringify(populated.evidence.evidenceAnchors), '| bundleStatus =', populated.evidence.bundleStatus, '(no source bundle in live repo)');
  console.log('  method/mechanism/embodiment/figure =', [populated.treatmentContext.methodCandidates.length, populated.treatmentContext.mechanismCandidates.length, populated.treatmentContext.embodimentCandidates.length, populated.treatmentContext.figurePlaceholders.length].join('/'), '(require source bundle — not invented)');
  console.log('  baseline warnings:', JSON.stringify(baseline.audit.warnings));

  // thread populated packet to finalizer
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
  const finPkt = safe && safe.energyDomainDiagnosisPacket;

  // non-energy
  cc.window.LIMENDomains = { finance: { brainDiagnoses: [], brainTreatments: [], brainOpportunities: [] } };
  const nonEnergyClean = !cap._buildPacket('finance').deepBrain;

  const noFakeCandidates = populated.treatmentContext.methodCandidates.length === 0 && populated.treatmentContext.mechanismCandidates.length === 0 && populated.treatmentContext.embodimentCandidates.length === 0 && populated.treatmentContext.figurePlaceholders.length === 0;

  console.log('\n--- ACCEPTANCE ---');
  const checks = [
    ['baseline completeness > 34% (real domain facts only)', pct(baseline) > 34],
    ['populated completeness > baseline', pct(populated) > pct(baseline)],
    ['brainState stays 100%', sectionPcts(populated).brainState === 100],
    ['identity.confidence populated', populated.identity.confidence != null],
    ['portalContext root-only/identity populated (not empty)', populated.portalContext.portalDomain === 'energy' && populated.portalContext.depth === 0 && populated.portalContext.ancestryPath.length > 0],
    ['evidence.sourceFeeds populated from real feeds', populated.evidence.sourceFeeds.length >= 1],
    ['treatmentContext populated from state.treatments', populated.treatmentContext.treatments.length >= 1 && populated.treatmentContext.implementationSteps.length >= 1],
    ['operatorContext populated from moneyChain', populated.operatorContext.targets.length >= 1 && populated.operatorContext.invalidIf && populated.operatorContext.nextStep],
    ['artifactLanes from real opportunity path', populated.artifactContext.artifactLanes.indexOf('INVESTABLE') >= 0],
    ['NO fake method/mechanism/embodiment/figure candidates', noFakeCandidates],
    ['no fake bundle (status not "found" without an explicit G1 load)', populated.evidence.bundleStatus !== 'found'],
    ['offline baseline forces NO opportunities (operator empty)', baseline.operatorContext.targets.length === 0 && baseline.operatorContext.nextStep === null],
    ['finalizer safeInput includes populated packet', !!finPkt && finPkt.operatorContext && finPkt.operatorContext.targets.length >= 1],
    ['non-energy domain stays null', nonEnergyClean],
    ['six diagnoses still emit', brain.state.diagnoses.length === 6]
  ];
  let allPass = true;
  checks.forEach(function (c) { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
  console.log('\nF2: ' + (allPass ? 'PASS ✓ — real fields populated, fakes refused, survives to finalizer' : 'FAIL ✗') + '\n');
  console.log('================ END F2 PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
