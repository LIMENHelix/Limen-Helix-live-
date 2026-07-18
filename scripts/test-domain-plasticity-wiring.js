/**
 * scripts/test-domain-plasticity-wiring.js — the PORT: generic plasticity in DomainBrainBase
 * (run: node scripts/test-domain-plasticity-wiring.js).
 *
 *   T1  base loads; a non-energy domain (finance) inits 4 generic learnable layers on demand
 *   T2  _computeDomainPlasticity computes a shadow readout wired to cog.neuro, keyed by domainId
 *   T3  modulator uses the K4 gate; abstains to self-consistency when the resolver is absent
 *   T4  self-gate: _learnedVec holds the seed in shadow (nothing armed yet)
 *   T5  a fresh outcome moves the weights (real learning), then self-gate arms when stable+reward
 *   T6  ENERGY self-skips the generic substrate (it has its own richer version)
 */
var fs = require('fs');
var path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var win = { location: { pathname: '/', search: '' }, addEventListener: function () {}, dispatchEvent: function () {}, CustomEvent: function () {} };
global.window = win;
global.fetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };
function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/domain-brains/domain-brain-base.js');
assert('base + modules loaded', !!(win.LIMENDomainBrainBase && win.LIMENPLASTICITY && win.LIMENK4));
var Base = win.LIMENDomainBrainBase;

// minimal non-energy domain brain
function mkBrain(domainId) {
  var b = new Base({ domainId: domainId, label: domainId, snapshotKey: domainId, cycleInterval: 30000 });
  b.state.stress = 0.6;
  b.state.diagnoses = [{ id: 'A', active: true, relevance: 0.6 }, { id: 'B', active: false, relevance: 0.2 }];
  b.state.cognition = {
    model: { predictionError: { total: 0.2 }, predictedStress: 0.55 },
    neuro: {
      gainControl: { inhibition: 0.4, outputScale: 0.8 },
      attention: { focus: [{ id: 'A', salience: 0.7 }] },
      slowModel: { expectedStress: 0.5, fastSlowDivergence: 0.1 },
      homeostasis: { baseline: 0.45, adaptiveThreshold: 0.11 },
      outcomeLedger: { hitRate: 0.6, samples: 8 }
    }
  };
  b._cycleCount = 200;   // past the resolver-throttle first-call
  return b;
}

// T1/T2/T3 — finance
console.log('T1-T3: generic plasticity on a non-energy domain (finance)');
var fin = mkBrain('finance');
var o = fin._computeDomainPlasticity();
assert('4 generic layers present', o && ['K_gain', 'K_attention', 'K_slow', 'K_homeo'].every(function (k) { return !!o.layers[k]; }), JSON.stringify(o && Object.keys(o.layers || {})));
assert('shadow mode, keyed by domainId', o.mode === 'shadow' && o.domain === 'finance');
assert('modulator via K4 gate (self-consistency: call-consistency tier 2, isReward false)', o.creditSource === 'call-consistency' && o.isReward === false, o.creditSource + '/' + o.creditTier);
assert('external outcome abstaining (no resolver)', o.externalOutcome.active === false);
assert('K_attention seeded [0.5,0.4,0.1] from the generic K-stack literals', String(fin._plasticity.layers.K_attention.seed) === '0.5,0.4,0.1');

// T4 — self-gate holds seed in shadow
console.log('T4: _learnedVec holds the seed in shadow (nothing armed)');
assert('K_gain learnedVec returns seed (not stable / not rewarded)', fin._learnedVec('K_gain', [0.5]) === (function () { return [0.5]; })() || fin._learnedVec('K_gain', [0.5])[0] === 0.5);
assert('liveLayers empty in shadow', o.liveLayers.length === 0);

// T5 — real learning + arm when earned
console.log('T5: fresh outcome moves weights; self-gate arms when stable+reward');
var g = fin._plasticity.layers.K_gain;
var before = g.w.slice();
win.LIMENPLASTICITY.tick(g, [0.5], 0.3); win.LIMENPLASTICITY.applyModulator(g, 0.4);
assert('weights moved on modulator', g.w.some(function (w, i) { return Math.abs(w - before[i]) > 1e-9; }));
g.w = [0.7]; g.diag = { stable: true, driftFromSeed: 0.1 }; fin._plasticityRewardActive = true; fin._actuation = { plasticityLive: true };
assert('stable + reward + bounded ⇒ learned weights', fin._learnedVec('K_gain', [0.5]) === g.w);
fin._plasticityRewardActive = false;
assert('self-consistency (no external reward) ⇒ seed', fin._learnedVec('K_gain', [0.5])[0] === 0.5);

// T7 — the generic K-STACK consumes learned weights once a layer is armed
console.log('T7: _computeGenericKStack uses learned K_attention weights when armed');
var fin2 = mkBrain('finance');
fin2._computeDomainPlasticity();                          // inits _plasticity + _actuation.plasticityLive
var KA = fin2._plasticity.layers.K_attention;
KA.w = [1.0, 0, 0]; KA.diag = { stable: true, driftFromSeed: 0.1 }; fin2._plasticityRewardActive = true;
var neuroArmed = fin2._computeGenericKStack();
// active dx 'A': armed salience = active(1.0) + relevance*0 + pe*0 = 1.0 ; seed = 0.5 + 0.6*0.4 + 0.2*0.1 = 0.76
assert('armed: attention salience ≈ 1.0 via learned [1,0,0]', Math.abs(neuroArmed.attention.focus[0].salience - 1.0) < 0.02, JSON.stringify(neuroArmed.attention.focus[0]));
fin2._actuation.plasticityLive = false;
var neuroSeed = fin2._computeGenericKStack();
assert('disarmed: salience reverts to seed formula (~0.76)', Math.abs(neuroSeed.attention.focus[0].salience - 0.76) < 0.02, JSON.stringify(neuroSeed.attention.focus[0]));

// T8 — energy self-skips
console.log('T8: energy self-skips the generic substrate');
var en = mkBrain('energy');
en._runEnergyAutonomousEmission = function () {};   // mark it as energy
var eo = en._computeDomainPlasticity();
assert('energy returns null (uses its own)', eo === null);
assert('energy did not get a domainPlasticity readout', !en.state.domainPlasticity);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
