/**
 * scripts/test-domain-recency-trust.js — per-domain recency trust in DomainBrainBase (Option 2:
 * measure-cadence-or-abstain). Run: node scripts/test-domain-recency-trust.js
 *
 * The halflife is DERIVED from each domain's OWN measured resolve cadence — never energy's constant,
 * never one shared number. Abstain (wRecency=1, no decay) until the cadence is CONFIDENTLY known,
 * including sparse history, so a noisy early estimate is not treated as confirmed. Proves:
 *   T1  zero history ⇒ ABSTAIN (halflife null, recency 1)
 *   T2  sparse history (< min samples) ⇒ still ABSTAIN (the sparse-history guard, not just zero)
 *   T3  enough measured gaps ⇒ halflife = MULT x observed cadence (derived from THIS domain)
 *   T4  two domains with different cadences ⇒ different halflives (no shared constant)
 *   T5  once known, recency decays 0.5^(age/halflife); a fresh resolution restores trust to ~1
 *   T6  SHADOW (recencyTrustLive=false) ⇒ recency exposed but live blend unchanged
 */
var fs = require('fs');
var path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var win = { location: { pathname: '/', search: '' }, addEventListener: function () {}, dispatchEvent: function () {}, CustomEvent: function () {} };
global.window = win;
global.fetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };   // external refresh stubbed to fail ⇒ preset _externalOutcome survives
function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/domain-brains/domain-brain-base.js');
var Base = win.LIMENDomainBrainBase;
assert('base + modules loaded', !!(Base && win.LIMENPLASTICITY && win.LIMENK4));

function mkBrain(domainId) {
  var b = new Base({ domainId: domainId, label: domainId, snapshotKey: domainId, cycleInterval: 30000 });
  b.state.stress = 0.6;
  b.state.diagnoses = [{ id: 'A', active: true, relevance: 0.6 }];
  b.state.cognition = { model: { predictionError: { total: 0.2 }, predictedStress: 0.55 },
    neuro: { gainControl: { inhibition: 0.4, outputScale: 0.8 }, attention: { focus: [{ id: 'A', salience: 0.7 }] },
      slowModel: { expectedStress: 0.5, fastSlowDivergence: 0.1 }, homeostasis: { baseline: 0.45, adaptiveThreshold: 0.11 },
      outcomeLedger: { hitRate: 0.6, samples: 8, resolvedTotal: 12 } } };
  b._cycleCount = 200;
  b._initDomainPlasticity();
  return b;
}

// drive N external resolutions spaced `spacing` cycles apart through the real cadence path
function drive(b, n, spacing, startCyc) {
  for (var e = 0; e < n; e++) {
    b._cycleCount = startCyc + e * spacing;
    b._externalOutcome = { hit: 0.6, resolvedCount: e + 1 };
    b._computeDomainPlasticity();
  }
}

console.log('T1: zero history ⇒ ABSTAIN (armed layer, but no cadence ⇒ no decay)');
var z = mkBrain('finance');
assert('halflife null with no resolutions', z._domainRecencyHalflife() === null);
var KZ = z._plasticity.layers.K_gain;
KZ.w = [0.9]; KZ.seed = [0.5]; KZ.diag = { stable: true, driftFromSeed: 0 };   // arm so recency is computed
z._plasticityRewardActive = true; z._actuation.recencyTrustLive = true;
var vecZ = z._learnedVec('K_gain', [0.5]);
assert('recency exposed = 1 (abstaining ⇒ no decay)', KZ._recency === 1, 'recency=' + KZ._recency);
assert('blend full (armed, recency abstains) ⇒ learned weights', vecZ === KZ.w);

console.log('T2: sparse history (< min samples) ⇒ still ABSTAIN (sparse-history guard)');
var sp = mkBrain('finance');
drive(sp, 3, 30, 300);   // 3 resolutions ⇒ only 2 measured gaps (< GP_RECENCY_MIN_SAMPLES=5)
assert('2 gaps measured', sp._extCadenceSamples === 2, 'samples=' + sp._extCadenceSamples);
assert('still abstaining (halflife null) on a shaky early estimate', sp._domainRecencyHalflife() === null);

console.log('T3: enough gaps ⇒ halflife = 2 x observed cadence (derived from THIS domain)');
var f = mkBrain('finance');
drive(f, 7, 30, 300);    // 7 resolutions ⇒ 6 gaps of 30 ⇒ EMA≈30, samples 6 >= 5
assert('>=5 gaps measured', f._extCadenceSamples >= 5, 'samples=' + f._extCadenceSamples);
assert('cadence EMA ≈ 30', Math.abs(f._extCadenceEMA - 30) < 1e-6, 'ema=' + f._extCadenceEMA);
assert('halflife = MULT(2) x cadence(30) = 60', Math.abs(f._domainRecencyHalflife() - 60) < 1e-6, 'hl=' + f._domainRecencyHalflife());

console.log('T4: two domains, different cadences ⇒ different halflives (no shared constant)');
var slow = mkBrain('finance');
drive(slow, 7, 90, 300);   // spacing 90 ⇒ EMA≈90 ⇒ halflife≈180
assert('slow-cadence domain halflife ≈ 180 (its own, not 60)', Math.abs(slow._domainRecencyHalflife() - 180) < 1e-6, 'hl=' + slow._domainRecencyHalflife());
assert('the two derived halflives differ', Math.abs(f._domainRecencyHalflife() - slow._domainRecencyHalflife()) > 1e-6);

console.log('T5: recency decays 0.5^(age/halflife); fresh resolution restores trust');
// f has halflife 60, last resolve at cycle 300 + 6*30 = 480
var K = f._plasticity.layers.K_gain;
K.w = [0.9]; K.seed = [0.5]; K.diag = { stable: true, driftFromSeed: 0 };   // arm: wDrift=1
f._plasticityRewardActive = true; f._actuation.recencyTrustLive = true;
f._cycleCount = 480 + 60;   // one half-life stale
f._learnedVec('K_gain', [0.5]);
assert('recency ≈ 0.5 at age == halflife', Math.abs(K._recency - 0.5) < 1e-6, 'recency=' + K._recency);
assert('blend = wDrift(1) * recency(0.5) = 0.5', Math.abs(K._blend - 0.5) < 1e-6, 'blend=' + K._blend);
f._cycleCount = 480 + 240;  // 4 half-lives stale
f._learnedVec('K_gain', [0.5]);
assert('recency ≈ 0.063 (=0.0625) when very stale', Math.abs(K._recency - 0.063) < 1e-9, 'recency=' + K._recency);
// a fresh resolution lands (resolvedCount advances) — _computeDomainPlasticity stamps a new resolve cycle.
f._externalOutcome = { hit: 0.6, resolvedCount: 8 }; f._computeDomainPlasticity();
// _computeDomainPlasticity recomputes diag/reward from live data, so re-assert the manual arm before reading.
K.w = [0.9]; K.diag = { stable: true, driftFromSeed: 0 }; f._plasticityRewardActive = true;
f._learnedVec('K_gain', [0.5]);   // _cycleCount still 720 == the freshly-stamped resolve cycle ⇒ age 0
assert('fresh resolution restored the resolve clock (age 0)', f._extLastResolveCycle === 720, 'last=' + f._extLastResolveCycle);
assert('fresh resolution restores trust to ~1', Math.abs(K._recency - 1) < 1e-6, 'recency=' + K._recency);

console.log('T6: SHADOW (recencyTrustLive=false) ⇒ recency exposed but live unchanged');
var sh = mkBrain('finance');
drive(sh, 7, 30, 300);
var KS = sh._plasticity.layers.K_gain;
KS.w = [0.9]; KS.seed = [0.5]; KS.diag = { stable: true, driftFromSeed: 0 };
sh._plasticityRewardActive = true; sh._actuation.recencyTrustLive = false;
sh._cycleCount = 480 + 60;   // one half-life stale
var vec = sh._learnedVec('K_gain', [0.5]);
assert('shadow: recency computed (~0.5)', Math.abs(KS._recency - 0.5) < 1e-6, 'recency=' + KS._recency);
assert('shadow: blend unchanged (recency not applied)', Math.abs(KS._blend - 1) < 1e-9, 'blend=' + KS._blend);
assert('shadow: returns fully learned weights', vec === KS.w);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
