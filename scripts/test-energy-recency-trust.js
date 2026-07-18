/**
 * scripts/test-energy-recency-trust.js — Fix 3: continuous recency decay of learned-weight trust
 * (run: node scripts/test-energy-recency-trust.js).
 *
 * The staleness gap: the monotonic resolvedTotal never decays, so a long-stale resolver would keep the
 * modulator willing to trust old learning indefinitely. Fix = discount trust by how long ago the last
 * REAL resolution landed, folded into the SAME graded w (NOT a second on/off gate). This proves:
 *   T1  recency factor is exposed every cycle (shadow) and decays SMOOTHLY with age — no step/cutoff
 *   T5  exponential half-life: at age == halflife (40), recency ~= 0.5
 *   T2  in SHADOW (recencyTrustLive=false) the live blend is UNCHANGED (wDrift alone)
 *   T3  when ARMED (recencyTrustLive=true) the live blend = wDrift * wRecency, decaying with staleness
 *   T4  a fresh resolution resets age -> recency returns to ~1 (trust restored, no stored suppression)
 */
var fs = require('fs');
var path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

// ── stub page environment (same harness as test-energy-plasticity-wiring) ──
var win = { location: { pathname: '/', search: '' }, LIMENDomainBrains: { register: function () {} }, addEventListener: function () {} };
global.window = win;
function BaseStub(cfg) { this.config = cfg || {}; this.state = { stress: 0.6, diagnoses: [], opportunities: [], companies: [], memory: { stressHistory: [] }, confidence: 0.8 }; this._externalSignals = []; }
BaseStub.prototype.init = function () {}; BaseStub.prototype.start = function () {}; BaseStub.prototype.getExternalPressure = function () { return 0.1; };
win.LIMENDomainBrainBase = BaseStub;
global.fetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };
function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
loadScript('assets/js/domain-brains/energy-brain.js');
var brain = win.LIMENEnergyBrain;
assert('energy brain self-instantiated', !!brain);

// arm a layer: stable + reward + drift 0 (wDrift = 1) so only the recency factor moves the blend
brain._initEnergyPlasticity();
brain._actuation = brain._actuation || {};
brain._actuation.plasticityLive = true;
brain._plasticityRewardActive = true;
var K5 = brain._plasticity.layers.K5_pe;
K5.w = [0.7, 0.1, 0.1, 0.05, 0.05];
var SEED = [0.35, 0.2, 0.25, 0.15, 0.05];
K5.seed = SEED;
K5.diag = { stable: true, driftFromSeed: 0 };

function recencyAt(age) { brain._cycleCount = 1000; brain._energyLastResolveCycle = 1000 - age; brain._learnedVec('K5_pe', SEED); return K5._recency; }
function blendAt(age) { brain._cycleCount = 1000; brain._energyLastResolveCycle = 1000 - age; brain._learnedVec('K5_pe', SEED); return K5._blend; }

console.log('T1: recency decays smoothly with age (no step)');
brain._actuation.recencyTrustLive = false;   // recency exposed in shadow
var ages = [0, 5, 10, 20, 40, 80, 160];
var prev = 1.0001, monotone = true, maxJump = 0;
for (var i = 0; i < ages.length; i++) { var r = recencyAt(ages[i]); if (r > prev + 1e-9) monotone = false; maxJump = Math.max(maxJump, Math.abs(prev - r)); prev = r; }
assert('recency at age 0 == 1 (just resolved ⇒ full trust)', Math.abs(recencyAt(0) - 1) < 1e-9);
assert('recency monotonically non-increasing with age', monotone);
assert('recency in (0,1) and tends toward 0 for large age', recencyAt(160) > 0 && recencyAt(160) < 0.1, 'age160=' + recencyAt(160));
assert('no discontinuous jump (continuous decay, not a cutoff)', maxJump < 0.5, 'maxJump=' + maxJump);

console.log('T5: exponential half-life ⇒ recency ~= 0.5 at age == halflife (40)');
assert('recency(40) ≈ 0.5', Math.abs(recencyAt(40) - 0.5) < 1e-6, 'r40=' + recencyAt(40));
assert('recency(80) ≈ 0.25 (two half-lives)', Math.abs(recencyAt(80) - 0.25) < 1e-6, 'r80=' + recencyAt(80));

console.log('T2: SHADOW (recencyTrustLive=false) ⇒ live blend UNCHANGED (wDrift alone)');
brain._actuation.recencyTrustLive = false;
var vecShadow = (brain._cycleCount = 1000, brain._energyLastResolveCycle = 920, brain._learnedVec('K5_pe', SEED));   // age 80, very stale
assert('shadow: recency computed + exposed (~0.25)', Math.abs(K5._recency - 0.25) < 1e-6, 'recency=' + K5._recency);
assert('shadow: blend still full (recency NOT applied)', Math.abs(K5._blend - 1) < 1e-9, 'blend=' + K5._blend);
assert('shadow: returns fully learned weights (unchanged live behavior)', vecShadow === K5.w);

console.log('T3: ARMED (recencyTrustLive=true) ⇒ live blend = wDrift * wRecency');
brain._actuation.recencyTrustLive = true;
var vecArmed = (brain._cycleCount = 1000, brain._energyLastResolveCycle = 960, brain._learnedVec('K5_pe', SEED));    // age 40 = one half-life
assert('armed: blend = 1 * 0.5 = 0.5', Math.abs(K5._blend - 0.5) < 1e-6, 'blend=' + K5._blend);
assert('armed: output is halfway seed<->learned', Math.abs(vecArmed[0] - (0.5 * SEED[0] + 0.5 * 0.7)) < 1e-9, JSON.stringify(vecArmed));

console.log('T4: a fresh resolution restores trust (age→0 ⇒ recency→1, no stored suppression)');
brain._actuation.recencyTrustLive = true;
brain._cycleCount = 1000; brain._energyLastResolveCycle = 880; brain._learnedVec('K5_pe', SEED);   // age 120, stale
var staleR = K5._recency;
brain._energyLastResolveCycle = 1000; brain._learnedVec('K5_pe', SEED);                            // fresh resolution
var freshR = K5._recency;
assert('stale trust was low', staleR < 0.15, 'staleR=' + staleR);
assert('fresh resolution restores trust to ~1 (smooth, no memory of suppression)', Math.abs(freshR - 1) < 1e-9, 'freshR=' + freshR);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
