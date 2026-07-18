/**
 * scripts/test-energy-plasticity-wiring.js — dry-run the ACTUAL energy-brain
 * wiring (not just the modules) in Node with a stubbed page environment
 * (run: node scripts/test-energy-plasticity-wiring.js).
 *
 *   T1  _initEnergyPlasticity builds all 8 K-layer vectors seeded from the live constants
 *   T2  _computeEnergyPlasticity runs a full shadow cycle: layers tick, modulator
 *       reads the REAL LIMENK4 gate on fixture state, honest labels present
 *   T3  new resolved outcome ⇒ modulator fresh + weights move; same ledger ⇒ no re-teach
 *   T4  _computeEnergyActiveInference: beliefs update from state.stress, an action
 *       is selected, agreement vs actual behavior computed, all shadow-labeled
 *   T5  serialize what the brain would persist and hydrate a fresh layer set from
 *       it (the in-process restart proof at the wiring level)
 */
var fs = require('fs');
var path = require('path');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) { console.log('  PASS ' + name); }
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

// ── stub page environment ────────────────────────────────────────────
var win = {
  location: { pathname: '/', search: '' },
  LIMENDomainBrains: { register: function () {} },
  addEventListener: function () {}
};
global.window = win;

// stub base class (the real one wires timers/fetch loops we don't want here)
function BaseStub(cfg) {
  this.config = cfg || {};
  this.state = { stress: 0.6, diagnoses: [], opportunities: [], companies: [], memory: { stressHistory: [] }, confidence: 0.8 };
  this._externalSignals = [];
}
BaseStub.prototype.init = function () {};
BaseStub.prototype.start = function () {};
BaseStub.prototype.getExternalPressure = function () { return 0.1; };
win.LIMENDomainBrainBase = BaseStub;

// neutralize network + heavy loaders during the file's self-instantiation
global.fetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };

// load the real gate + modules onto window (same order as the HTML pages)
function loadScript(rel) {
  var src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  eval(src);   // classic scripts; they attach to global.window
}
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
assert('gate + modules attached to window', !!(win.LIMENK4 && win.LIMENPLASTICITY && win.LIMENACTIVEINFERENCE));

var loaded = true, loadErr = null;
try { loadScript('assets/js/domain-brains/energy-brain.js'); }
catch (e) { loaded = false; loadErr = e; }
assert('energy-brain.js loads + self-instantiates against stubs', loaded && !!win.LIMENEnergyBrain, loadErr && (loadErr.message + '\n' + (loadErr.stack || '').split('\n').slice(0, 4).join('\n')));
if (!loaded || !win.LIMENEnergyBrain) { console.error('\ncannot continue'); process.exit(1); }

var brain = win.LIMENEnergyBrain;

// ── fixture state (the fields the wiring actually reads) ────────────
function fixture(resolvedSamples, hitRate) {
  var s = brain.state;
  s.stress = 0.6;
  s.diagnoses = [{ id: 'OIL_SHOCK', label: 'Oil Shock', active: true, relevance: 0.6 }];
  s.energyModel = {
    cycle: (s.energyModel && s.energyModel.cycle || 0) + 1,
    observation: { stress: 0.6, signal: 0.5, diagnosisCount: 1, opportunityCount: 2, timestamp: Date.now() },
    predictionError: { stressError: 0.1, signalError: 0.05, diagnosisError: 0.2, opportunityError: 0.1, portalError: 0.05, total: 0.12 },
    regulation: { inhibition: 0.4, outputScale: 0.8 },
    _effectiveLearningRate: 0.2, _effectiveFloor: 0.35, updated: Date.now()
  };
  s.energyOutcomeLedger = { callHitRate: hitRate, resolvedSamples: resolvedSamples };
  s.energyOutcomeModel = { hitRate: 0.8, samples: 10 };
  s.energyHomeostasis = { adaptiveBaseline: 0.45 };
  s.energyAttention = { focus: [{ id: 'OIL_SHOCK', salience: 0.7 }], broadenUnderSurprise: false };
  s.energyInhibition = { competitors: [{ id: 'x', relevance: 0.3, suppressBy: 0.1 }] };
  s.energyAfferent = { externalPressure: 0.1, appliedStressDelta: 0.1 };
  s.energySlowModel = { slow: { expectedStress: 0.5 } };
  s.energyEmissionQueue = { packages: [] };
  s.energyBrake = { halt: false };
  brain._actuation = brain._actuation || {};
  brain._actuation.phase = false;
}

// T1 — init
console.log('T1: plasticity init');
brain._initEnergyPlasticity();
assert('plasticity box created', !!brain._plasticity);
var expected = ['K1_pressure', 'K2_gain', 'K3_slow', 'K4_lr', 'K5_pe', 'K6_attention', 'K7_inhib', 'K8_floor'];
assert('all 8 K-layers present', expected.every(function (k) { return !!brain._plasticity.layers[k]; }),
  Object.keys(brain._plasticity ? brain._plasticity.layers : {}).join(','));
assert('K5 seeded from the live static constants', String(brain._plasticity.layers.K5_pe.seed) === '0.35,0.2,0.25,0.15,0.05');

// T2 — one shadow cycle
console.log('T2: shadow cycle through the real wiring + real LIMENK4 gate');
fixture(4, 0.75);
var out = brain._computeEnergyPlasticity();
assert('shadow readout produced', !!out && out.mode === 'shadow');
assert('modulator used the honest gate (call-consistency tier 2)', out.creditSource === 'call-consistency' && out.creditTier === 2, out.creditSource + '/' + out.creditTier);
assert('isReward honestly false for energy', out.isReward === false);
assert('all 8 layers report shadow vs static output', expected.every(function (k) {
  var L = out.layers[k]; return L && typeof L.shadowOutput === 'number' && typeof L.staticOutput === 'number';
}));
assert('first resolved batch taught (fresh, rpe seeded at 0)', out.modulator.fresh === true && out.modulator.rpe === 0, JSON.stringify(out.modulator));

// T3 — freshness discipline + weight movement
console.log('T3: new outcomes teach, stale ledgers do not');
fixture(4, 0.75);                                        // SAME resolvedSamples
var out2 = brain._computeEnergyPlasticity();
assert('same ledger ⇒ modulator not fresh', out2.modulator.fresh === false);
var wBefore = brain._plasticity.layers.K5_pe.w.slice();
fixture(5, 0.95);                                        // NEW resolved outcome, better than baseline
var out3 = brain._computeEnergyPlasticity();
assert('new resolved outcome ⇒ fresh, positive rpe', out3.modulator.fresh === true && out3.modulator.rpe > 0, JSON.stringify(out3.modulator));
var moved = brain._plasticity.layers.K5_pe.w.some(function (w, i) { return Math.abs(w - wBefore[i]) > 1e-7; });
assert('K5 weights moved on the fresh outcome (before/after)', moved, wBefore + ' -> ' + brain._plasticity.layers.K5_pe.w);
assert('convergence block present with self-arm gate', !!out3.convergence && /self|drift|reversible/i.test(out3.convergence.armGate));

// T4 — active inference wiring
console.log('T4: active inference shadow wiring');
brain._initEnergyActiveInference();
assert('active-inference box created', !!brain._activeInference);
var ai1 = brain._computeEnergyActiveInference();
for (var i = 0; i < 10; i++) { brain.state.stress = 0.6 + i * 0.01; ai1 = brain._computeEnergyActiveInference(); }
assert('shadow mode + selection made', ai1.mode === 'shadow' && ['observe', 'broaden-attention', 'emit-call', 'hold-emission'].indexOf(ai1.selected) !== -1, ai1.selected);
assert('beliefs track the stress trajectory', typeof ai1.beliefs.level === 'number' && Math.abs(ai1.beliefs.level - brain.state.stress) < 0.15, JSON.stringify(ai1.beliefs));
assert('actual behavior compared (agreement metric)', typeof ai1.agreement === 'boolean' && typeof ai1.actualBehavior === 'string');
assert('preference = homeostatic set-point', ai1.preference.setpoint === 0.35, JSON.stringify(ai1.preference));

// T5 — wiring-level restart proof
console.log('T5: persist format round-trip at the wiring level');
var P = win.LIMENPLASTICITY;
var snap = P.serialize(brain._plasticity.layers, brain._plasticity.mod, { domain: 'energy' });
assert('snapshot has all 8 layers + shadow labels', expected.every(function (k) { return !!snap.layers[k]; }) && snap.mode === 'shadow' && snap.isReward === false);
brain._plasticity = null;
brain._initEnergyPlasticity();                            // "restart": fresh box at seeds
var res = P.hydrate(brain._plasticity.layers, snap);
P.hydrateModulator(brain._plasticity.mod, snap);
assert('all 8 layers restored after re-init (none reset to defaults)', res.restored.length === 8 && res.reset.length === 0, JSON.stringify(res));
assert('learned K5 weights survive the restart', String(brain._plasticity.layers.K5_pe.w.map(function (x) { return Math.round(x * 10000) / 10000; })) === String(snap.layers.K5_pe.w));
assert('modulator baseline survives the restart', brain._plasticity.mod.baseline === snap.modulator.baseline && brain._plasticity.mod.lastResolvedSamples === snap.modulator.lastResolvedSamples);

// T6 — the SELF-GATE: learned weights drive the live path ONLY when the layer earned it
console.log('T6: _learnedVec self-gate (stable + external reward + drift-bounded)');
brain._initEnergyPlasticity();
var seed5 = [0.35, 0.2, 0.25, 0.15, 0.05];
var K5 = brain._plasticity.layers.K5_pe;
K5.w = [0.4, 0.18, 0.22, 0.15, 0.05];                    // pretend it learned something
brain._actuation = brain._actuation || {}; brain._actuation.plasticityLive = true;

K5.diag = { stable: false, driftFromSeed: 0.1 }; brain._plasticityRewardActive = true;
assert('unstable ⇒ seed (not consumed)', brain._learnedVec('K5_pe', seed5) === seed5);

K5.diag = { stable: true, driftFromSeed: 0.1 }; brain._plasticityRewardActive = false;
assert('stable but self-consistency (no external reward) ⇒ seed', brain._learnedVec('K5_pe', seed5) === seed5);

K5.diag = { stable: true, driftFromSeed: 0.9 }; brain._plasticityRewardActive = true;
assert('stable + reward but drift>0.5 ⇒ seed (runaway guard)', brain._learnedVec('K5_pe', seed5) === seed5);

K5.diag = { stable: true, driftFromSeed: 0 }; brain._plasticityRewardActive = true;
assert('stable + external reward + drift 0 ⇒ FULLY learned weights (w=1)', brain._learnedVec('K5_pe', seed5) === K5.w);

// GRADED gate: at drift 0.25 the arm weight is 0.5 → element-wise halfway between seed and learned
K5.diag = { stable: true, driftFromSeed: 0.25 };
var gradedVec = brain._learnedVec('K5_pe', seed5);
assert('graded arm: drift 0.25 ⇒ halfway blend seed<->learned',
  gradedVec !== seed5 && gradedVec !== K5.w && Math.abs(gradedVec[0] - (0.5 * seed5[0] + 0.5 * K5.w[0])) < 1e-9,
  JSON.stringify(gradedVec));

K5.diag = { stable: true, driftFromSeed: 0.1 };
brain._actuation.plasticityLive = false;
assert('reversible: plasticityLive=false ⇒ seed even when all gates pass', brain._learnedVec('K5_pe', seed5) === seed5);
brain._actuation.plasticityLive = true;

// T7 — the LIVE prediction error actually consumes the armed weights
console.log('T7: _computePredictionError uses learned K5 weights once armed');
K5.diag = { stable: true, driftFromSeed: 0 }; brain._plasticityRewardActive = true;   // drift 0 ⇒ full arm
K5.w = [1.0, 0, 0, 0, 0];                                // extreme: total should track stressError alone
var prior = { expectedStress: 0.2, expectedSignal: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0 };
var obs = { stress: 0.9, signal: 0.5, activeDiagnoses: ['X'], diagnosisCount: 1, opportunityCount: 0 };
var peArmed = brain._computePredictionError(prior, obs);
assert('armed: total ≈ stressError (0.7) via learned K5=[1,0,0,0,0]', Math.abs(peArmed.total - 0.7) < 0.02, 'total=' + peArmed.total);
brain._actuation.plasticityLive = false;
var peSeed = brain._computePredictionError(prior, obs);
assert('disarmed: total reverts to the seed-weighted value (< armed)', peSeed.total < peArmed.total, 'seed total=' + peSeed.total);

// T8 — a SECOND wired layer (K6 attention) consumes learned weights through its live function
console.log('T8: K6 attention live path uses learned weights once armed (all-layer wiring)');
brain._actuation.plasticityLive = true;
brain.state.energyModel = { predictionError: { total: 0.3 }, regulation: { state: 'calm' } };
brain.state.diagnoses = [{ id: 'X', label: 'x', active: true, relevance: 0.5 }];
var K6 = brain._plasticity.layers.K6_attention;
K6.w = [1.0, 0, 0, 0]; K6.diag = { stable: true, driftFromSeed: 0 }; brain._plasticityRewardActive = true;   // drift 0 ⇒ full arm
var atArmed = brain._computeEnergyAttention();
assert('armed: salience ≈ activeBase 1.0 (relevance/pe weights learned to 0)', Math.abs(atArmed.focus[0].salience - 1.0) < 0.02, JSON.stringify(atArmed.focus[0]));
brain._plasticityRewardActive = false;                   // disarm this layer
var atSeed = brain._computeEnergyAttention();
assert('disarmed: salience reverts to seed formula (0.5 + 0.5*0.4 + 0.3*0.1 = 0.73)', Math.abs(atSeed.focus[0].salience - 0.73) < 0.02, JSON.stringify(atSeed.focus[0]));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
