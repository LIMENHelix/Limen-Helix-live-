/**
 * scripts/test-phase-estimator.js — proves the properties lib/phase-estimator.js claims.
 * Run: node scripts/test-phase-estimator.js
 *
 * Behavioural assertions, each mapped to a spec claim (PHASE_ESTIMATOR_SPEC.md §2), so a claim going
 * stale fails the build instead of the comment quietly becoming a lie. Mirrors the grounded-stress suite.
 */

var E = require('../lib/phase-estimator.js');
var N = E.NUM_PHASES;

var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

// likelihood vector that spikes on one phase p (peak) over a flat floor
function spike(p, peak) {
  peak = peak || 0.9;
  var v = new Array(N); var floor = (1 - peak) / (N - 1);
  for (var i = 0; i < N; i++) v[i] = (i === p) ? peak : floor;
  return v;
}
function bundle(readings, substrate) { return { substrate: substrate || 'test', subjectId: 's1', readings: readings }; }
function sum(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s; }

// ── 1. Abstention ────────────────────────────────────────────────────────────────────────────────
section('1. Abstains rather than inventing a belief on thin/low-reliability coverage');
var empty = E.estimate(bundle([]));
ok('no channels => grounded:false', empty.grounded === false && empty.stuck === null);
ok('abstention still returns a valid belief (the prior)', Math.abs(sum(empty.belief) - 1) < 1e-6);
var lowP = E.estimate(bundle([{ key: 'a', likelihood: spike(3), precisionHint: 0.01 }]), { precisionFloor: 0.5 });
ok('total precision below floor => abstain', lowP.grounded === false, JSON.stringify(lowP.degraded));

// ── 2. Output contract ─────────────────────────────────────────────────────────────────────────
section('2. Output is a BELIEF (distribution + confidence), never a bare label');
var r = E.estimate(bundle([
  { key: 'hrv', likelihood: spike(3), precisionHint: 3 },
  { key: 'scent', likelihood: spike(3), precisionHint: 1 }
]));
ok('belief sums to 1', Math.abs(sum(r.belief) - 1) < 1e-6, 'sum=' + sum(r.belief));
ok('belief length = 11 phases', r.belief.length === N);
ok('phaseMAP present (display only)', typeof r.phaseMAP === 'number' && r.phaseMAP >= 0 && r.phaseMAP < N);
ok('confidence in [0,1]', r.confidence >= 0 && r.confidence <= 1);
ok('stuck present and in [0,1]', r.stuck >= 0 && r.stuck <= 1);

// ── 3. THE CORE CLAIM: precision-weighted fusion — the reliable channel wins ─────────────────────
section('3. CORE: a high-precision channel outweighs a conflicting low-precision one');
var conflict = E.estimate(bundle([
  { key: 'hrv',    likelihood: spike(3), precisionHint: 5 },   // reliable, says P3
  { key: 'selfrep', likelihood: spike(7), precisionHint: 0.6 } // noisy, says P7
]));
ok('belief resolves toward the reliable channel (P3 > P7)',
   conflict.belief[3] > conflict.belief[7], 'P3=' + conflict.belief[3] + ' P7=' + conflict.belief[7]);
ok('phaseMAP = P3', conflict.phaseMAP === 3, 'got ' + conflict.phaseMAP);

section('   Inverse-variance: against a fixed anchor, raising the target channel precision pulls harder');
// (with a single channel the weight normalizes to 1, so precision only matters RELATIVE to other channels)
var a = E.estimate(bundle([{ key: 't', likelihood: spike(2), precisionHint: 4 }, { key: 'anchor', likelihood: spike(8), precisionHint: 1 }]));
var b = E.estimate(bundle([{ key: 't', likelihood: spike(2), precisionHint: 0.6 }, { key: 'anchor', likelihood: spike(8), precisionHint: 1 }]));
ok('higher precision on the target puts more belief mass on its phase (P2)',
   a.belief[2] > b.belief[2], 'high=' + a.belief[2] + ' low=' + b.belief[2]);
ok('and higher total precision => higher confidence', a.confidence > b.confidence, 'high=' + a.confidence + ' low=' + b.confidence);

// ── 4. Groupthink protection: HRV not outvoted by a correlated self-report cluster ───────────────
section('4. GROUPTHINK: one independent high-precision channel resists a cluster of agreeing low ones');
var groupthink = E.estimate(bundle([
  { key: 'hrv', likelihood: spike(4), precisionHint: 6 },    // independent, validated, says P4
  { key: 'sr1', likelihood: spike(8), precisionHint: 0.5 },  // self-report cluster, all say P8
  { key: 'sr2', likelihood: spike(8), precisionHint: 0.5 },
  { key: 'sr3', likelihood: spike(8), precisionHint: 0.5 }
]));
ok('validated HRV is not outvoted by 3 agreeing low-precision channels (P4 >= P8)',
   groupthink.belief[4] >= groupthink.belief[8], 'P4=' + groupthink.belief[4] + ' P8=' + groupthink.belief[8]);

// ── 5. Staleness (rec_c): a stale channel loses influence ────────────────────────────────────────
section('5. STALENESS: a silent (aged) channel stops voting even with high raw precision');
var fresh = E.estimate(bundle([
  { key: 'stale', likelihood: spike(9), precisionHint: 5, age: 0 },
  { key: 'live',  likelihood: spike(1), precisionHint: 2, age: 0 }
]), { recencyHalflife: 3 });
var aged = E.estimate(bundle([
  { key: 'stale', likelihood: spike(9), precisionHint: 5, age: 30 },  // very stale
  { key: 'live',  likelihood: spike(1), precisionHint: 2, age: 0 }
]), { recencyHalflife: 3 });
ok('when fresh, the high-precision stale-slot channel dominates (P9)', fresh.phaseMAP === 9, 'got ' + fresh.phaseMAP);
ok('once aged out, its vote collapses and the live channel wins (P1)', aged.phaseMAP === 1, 'got ' + aged.phaseMAP);
ok('no recencyHalflife => rec_c=1 (age ignored, conservative default)',
   E.estimate(bundle([{ key: 'x', likelihood: spike(5), precisionHint: 3, age: 99 }])).phaseMAP === 5);

// ── 5b. REGRESSION (2026-07-20 production bug): uninformative channels cannot run away and silence real evidence
section('5b. REGRESSION: a null-likelihood (uninformative) channel cannot accumulate runaway precision');
// Reproduce the exact production failure: run MANY ticks with only uninformative (structural) channels
// present (mirrors unison/granularity with no distress/market/feed signal). A uniform likelihood
// trivially "agrees" with any belief, so pre-fix this drove its self-consistency precision toward
// infinity over time via the shared corrState.
var uninfState = null;
for (var t = 0; t < 50; t++) {
  var r = E.estimate(bundle([{ key: 'context', value: 0.5, likelihood: null }]), { corrState: uninfState });
  uninfState = r.corrState;
}
ok('50 ticks of ONLY an uninformative channel => still abstains (no real precision was ever earned)',
   E.estimate(bundle([{ key: 'context', value: 0.5, likelihood: null }]), { corrState: uninfState }).grounded === false,
   'an uninformative-only bundle must never ground the estimator, no matter how long it runs');

// Now the actual bug scenario: an uninformative channel accumulates state for many ticks ALONGSIDE a
// calm informative channel (so the bundle grounds normally throughout) — then a NEW, dramatic,
// real-evidence channel (a live crisis signal) arrives. Pre-fix, the long-run uninformative channel's
// runaway precision diluted the new evidence to near-zero, freezing the belief and reporting false-high
// confidence. Post-fix, the new evidence must still be able to move the belief.
var mixState = null;
for (t = 0; t < 60; t++) {   // 60 ticks of calm agreement — long enough to have caused runaway precision pre-fix
  var mr = E.estimate(bundle([
    { key: 'context', value: 0.5, likelihood: null },              // structural, uninformative (e.g. unison/granularity)
    { key: 'baseline', likelihood: spike(4), precisionHint: 1 }    // calm, informative, steady P4
  ]), { corrState: mixState });
  mixState = mr.corrState;
}
var preCrisis = E.estimate(bundle([
  { key: 'context', value: 0.5, likelihood: null },
  { key: 'baseline', likelihood: spike(4), precisionHint: 1 }
]), { corrState: mixState });
ok('after 60 calm ticks, belief still sits at the calm phase (P4)', preCrisis.phaseMAP === 4, 'got P' + preCrisis.phaseMAP);

var crisis = E.estimate(bundle([
  { key: 'context', value: 0.5, likelihood: null },
  { key: 'baseline', likelihood: spike(4), precisionHint: 1 },
  { key: 'feed_supply', likelihood: spike(3), precisionHint: 3 }   // a NEW, real, high-precision crisis signal
]), { corrState: mixState });
ok('a new real crisis signal CAN move the belief off P4 despite 60 ticks of uninformative-channel history',
   crisis.belief[3] > preCrisis.belief[3], 'preCrisis P3=' + preCrisis.belief[3] + ' crisis P3=' + crisis.belief[3]);
ok('the uninformative channel is excluded from precision and flagged as such', (function () {
  var ctxChan = crisis.channels.filter(function (c) { return c.key === 'context'; })[0];
  return ctxChan && ctxChan.informative === false && ctxChan.precision === 0;
})());
ok('degraded.uninformativeChannels reports the count for transparency', crisis.degraded && crisis.degraded.uninformativeChannels === 1);
console.log('        preCrisis: P4=' + preCrisis.belief[4].toFixed(3) + ' P3=' + preCrisis.belief[3].toFixed(3)
  + '  |  crisis: P4=' + crisis.belief[4].toFixed(3) + ' P3=' + crisis.belief[3].toFixed(3) + ' MAP=P' + crisis.phaseMAP);

// The mathematical claim underlying the fix, checked directly: an uninformative channel's precision
// (rc) is 0 / excluded regardless of how "self-consistent" it has been — confidence must reflect only
// informative-channel evidence.
ok('confidence is computed relative to INFORMATIVE channel count, not diluted by structural channels',
   (function () {
     var onlyInformative = E.estimate(bundle([{ key: 'baseline', likelihood: spike(4), precisionHint: 1 }]));
     var withContext = E.estimate(bundle([{ key: 'context', value: 0.5, likelihood: null }, { key: 'baseline', likelihood: spike(4), precisionHint: 1 }]));
     return Math.abs(onlyInformative.confidence - withContext.confidence) < 1e-6;
   })(), 'adding a null-likelihood channel must not change confidence at all');

// ── 6. Uninformative channel does not move the belief ────────────────────────────────────────────
section('6. A null-likelihood channel is flat (uninformative) and leaves the prior belief unmoved');
var flat = E.estimate(bundle([{ key: 'noL', value: 0.7, likelihood: null, precisionHint: 3 }]));
var pred0 = E.predict(E.uniform(), E.makeTransition());
ok('flat channel keeps belief ~ prediction', E.overlap(flat.belief, pred0) > 0.999,
   'overlap=' + E.overlap(flat.belief, pred0));

// ── 7. Stuck is orthogonal to the phase number ───────────────────────────────────────────────────
section('7. `stuck` is orthogonal to phaseMAP — a high phase can be low-stuck');
var highPhaseCalm = E.estimate(bundle([{ key: 'a', likelihood: spike(10), precisionHint: 3 }]));
ok('P10 belief with a defined, bounded stuck (not forced high by the phase number)',
   highPhaseCalm.phaseMAP === 10 && highPhaseCalm.stuck >= 0 && highPhaseCalm.stuck <= 1,
   'phase=' + highPhaseCalm.phaseMAP + ' stuck=' + highPhaseCalm.stuck);
section('   External distress composite blends into stuck');
var withDistress = E.estimate(bundle([{ key: 'a', likelihood: spike(3), precisionHint: 3 }]), { distressComposite: 1 });
var without = E.estimate(bundle([{ key: 'a', likelihood: spike(3), precisionHint: 3 }]), { distressComposite: 0 });
ok('distressComposite raises stuck', withDistress.stuck > without.stuck, 'with=' + withDistress.stuck + ' without=' + without.stuck);

// ── 8. Transition matrix + prediction are proper ─────────────────────────────────────────────────
section('8. Transition matrix rows sum to 1; prediction preserves probability mass');
var A = E.makeTransition();
var rowsOk = true; for (var i = 0; i < N; i++) { if (Math.abs(sum(A[i]) - 1) > 1e-9) rowsOk = false; }
ok('every A row sums to 1', rowsOk);
ok('predict preserves sum-to-1', Math.abs(sum(E.predict(E.uniform(), A)) - 1) < 1e-9);
var peaked = spike(3, 0.99);
ok('prediction from a peaked belief advances mass forward (P3 -> P4 gains)',
   E.predict(peaked, A)[4] > E.predict(peaked, A)[6], 'P4=' + E.predict(peaked, A)[4] + ' P6=' + E.predict(peaked, A)[6]);

// ── 9. Empirical CDF (reuse) ─────────────────────────────────────────────────────────────────────
section('9. Empirical-CDF transform bounded (0,1], rank-correct, abstains on thin sample');
var sample = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
ok('low ranks low', E.empiricalCdf(0.05, sample) < 0.25);
ok('high ranks at top', E.empiricalCdf(0.95, sample) === 1);
ok('thin sample => null', E.empiricalCdf(0.5, [1, 2, 3]) === null);

// ── 10. corrState round-trips (caller persists it) ───────────────────────────────────────────────
section('10. corrState round-trips through JSON and carries the belief forward');
var t1 = E.estimate(bundle([{ key: 'a', likelihood: spike(3), precisionHint: 3 }]));
var revived = JSON.parse(JSON.stringify(t1.corrState));
var t2 = E.estimate(bundle([{ key: 'a', likelihood: spike(4), precisionHint: 3 }]), { corrState: revived });
ok('state survives JSON round-trip', t2.grounded === true && Math.abs(sum(t2.belief) - 1) < 1e-6);
ok('beliefPrev carried forward (t2 predicted from t1 belief, not uniform)', !!(revived.beliefPrev && revived.beliefPrev.length === N));
ok('seenTicks increments', t2.corrState.seenTicks === 2, 'got ' + t2.corrState.seenTicks);

// ── 11. Degraded modes surfaced, not hidden ──────────────────────────────────────────────────────
section('11. Degraded modes are reported, not silently absorbed');
var selfConsist = E.estimate(bundle([{ key: 'a', likelihood: spike(3) }, { key: 'b', likelihood: spike(3) }, { key: 'c', likelihood: spike(3) }]));
ok('self-consistency precision flagged degraded', !!(selfConsist.degraded && selfConsist.degraded.selfConsistencyPrecision === true),
   JSON.stringify(selfConsist.degraded));
ok('precisionHint channels are NOT flagged self-consistency', E.estimate(bundle([{ key: 'a', likelihood: spike(3), precisionHint: 3 }])).degraded === null);

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
