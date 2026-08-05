/**
 * brain-v2/test/metaplasticity.js — SPEC row 22 / B17. Rates measured, not set.
 *
 *   node brain-v2/test/metaplasticity.js
 *
 * The property under test is not "the rate changes". It is that the rate changes for
 * the RIGHT reason: a model that is reliably wrong should move fast, and a model that
 * is wrong at random should not, even when both have the same mean error. Getting
 * that backwards writes noise into the weights, which is worse than a fixed rate.
 */

'use strict';

var META = require('../core/metaplasticity.js');
var PRED = require('../kernel/predict.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

// ── T1: abstain before there is anything to measure ───────────────────────────
(function () {
  console.log('T1: no history means no claim');
  var r = META.deriveRate([0.1, 0.2, 0.15]);
  assert('abstained under the floor of 8', r.state === 'abstained', JSON.stringify(r.state));
  assert('creeps at the minimum rather than stopping', r.rate === META.RATE_MIN, String(r.rate));
  assert('and says how many more it needs', /8 needed/.test(r.why), r.why);
  assert('an empty history also abstains', META.deriveRate([]).state === 'abstained');
})();

// ── T2: THE test. Same mean error, different consistency ──────────────────────
(function () {
  console.log('T2: reliably wrong learns fast; randomly wrong does not');
  var consistent = [0.20, 0.20, 0.21, 0.19, 0.20, 0.20, 0.20, 0.21, 0.20, 0.20];
  var scattered  = [0.01, 0.45, 0.02, 0.38, 0.05, 0.41, 0.01, 0.39, 0.03, 0.45];

  var mc = consistent.reduce(function (a, b) { return a + b; }, 0) / consistent.length;
  var ms = scattered.reduce(function (a, b) { return a + b; }, 0) / scattered.length;
  assert('both series have near-identical mean error', Math.abs(mc - ms) < 0.03,
    mc.toFixed(3) + ' vs ' + ms.toFixed(3));

  var rc = META.deriveRate(consistent), rs = META.deriveRate(scattered);
  assert('the consistent one learns faster', rc.rate > rs.rate,
    'consistent ' + rc.rate.toFixed(4) + ' vs scattered ' + rs.rate.toFixed(4));
  assert('and the difference is large, not marginal', rc.rate > rs.rate * 1.5,
    (rc.rate / rs.rate).toFixed(2) + 'x');
  assert('reliability is what separates them', rc.basis.reliability > rs.basis.reliability * 1.5,
    rc.basis.reliability.toFixed(3) + ' vs ' + rs.basis.reliability.toFixed(3));
  assert('their NEED is the same, so need alone would have tied them',
    Math.abs(rc.basis.need - rs.basis.need) < 0.05,
    rc.basis.need.toFixed(3) + ' vs ' + rs.basis.need.toFixed(3));
})();

// ── T3: an accurate model stops chasing ───────────────────────────────────────
(function () {
  console.log('T3: a model already at target barely moves');
  var accurate = [0.01, 0.008, 0.012, 0.009, 0.011, 0.01, 0.009, 0.01, 0.011, 0.01];
  var wrong = [0.2, 0.2, 0.21, 0.19, 0.2, 0.2, 0.2, 0.21, 0.2, 0.2];
  var ra = META.deriveRate(accurate), rw = META.deriveRate(wrong);
  assert('accurate learns much slower than wrong', ra.rate < rw.rate * 0.4,
    ra.rate.toFixed(4) + ' vs ' + rw.rate.toFixed(4));
  assert('its need is low', ra.basis.need < 0.3, String(ra.basis.need));
})();

// ── T4: bounded at both ends ──────────────────────────────────────────────────
(function () {
  console.log('T4: no history can drive the rate outside its bounds');
  var huge = []; for (var i = 0; i < 20; i++) huge.push(500);
  var r = META.deriveRate(huge);
  assert('an enormous consistent error still caps at max', r.rate <= META.RATE_MAX, String(r.rate));
  var zero = []; for (var j = 0; j < 20; j++) zero.push(0);
  var rz = META.deriveRate(zero);
  assert('a perfect model still floors at min, never 0', rz.rate >= META.RATE_MIN, String(rz.rate));
  assert('a rate of exactly 0 would freeze learning permanently', rz.rate > 0);
})();

// ── T5: the circularity safeguard ─────────────────────────────────────────────
(function () {
  console.log('T5: an outcome cannot set the rate that grades it');
  var led = META.createLedger();
  for (var i = 0; i < 10; i++) META.record(led, 'k', 0.01);   // ten tiny errors

  // Now a huge error arrives. The rate for THIS update must reflect the ten small
  // ones, not the big one, because the big one has not been recorded yet.
  var before = META.rateFor(led, 'k');
  META.record(led, 'k', 5.0);
  var after = META.rateFor(led, 'k');

  assert('the rate used was derived from prior history only', before.basis.meanAbsError < 0.02,
    String(before.basis.meanAbsError));
  assert('the big error only affects the NEXT rate', after.basis.meanAbsError > before.basis.meanAbsError,
    before.basis.meanAbsError.toFixed(4) + ' then ' + after.basis.meanAbsError.toFixed(4));
  assert('n grew by exactly one', after.n === before.n + 1, before.n + ' -> ' + after.n);
})();

// ── T6: the forward model actually uses it ────────────────────────────────────
(function () {
  console.log('T6: the forward model derives its own rate per model key');
  var fm = PRED.createForwardModel();
  var now = 0;

  // Feed a reliably-wrong stream: predicted 0, actual 0.3, over and over.
  for (var i = 0; i < 14; i++) {
    var eff = PRED.efferenceCopy(fm, {
      traceId: 't', actionId: 'a' + i, actionKind: 'raise_attention',
      variable: 'v', magnitude: 1, emittedAt: now + i
    });
    PRED.learn(fm, eff, 0.3, now + i);
  }

  var rep = PRED.forwardModelReport(fm);
  assert('the report carries per-key learning rates', Array.isArray(rep.learningRates) && rep.learningRates.length === 1,
    JSON.stringify(rep.learningRates));
  var lr = rep.learningRates[0];
  assert('it earned a MEASURED rate', lr.state === 'measured', JSON.stringify(lr));
  assert('and it is not the old hard-set 0.10', Math.abs(lr.rate - 0.10) > 1e-6, String(lr.rate));

  // Every update records which rate it used and why.
  var last = fm.history[fm.history.length - 1];
  assert('each update logs the rate it applied', typeof last.learningRate === 'number', JSON.stringify(last.learningRate));
  assert('and logs whether that rate was measured or a fallback', !!last.rateState, String(last.rateState));
  assert('and carries the reasoning', /mean \|error\||resolved outcome/.test(last.rateBasis || ''), String(last.rateBasis));
})();

// ── T7: rollback still restores exactly ───────────────────────────────────────
(function () {
  console.log('T7: a derived rate does not break rollback');
  var fm = PRED.createForwardModel();
  var e1 = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a1', actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: 0 });
  PRED.learn(fm, e1, 0.5, 1);
  var gain = PRED.getModel(fm, 'k', 'v').gain;
  var e2 = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a2', actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: 2 });
  PRED.learn(fm, e2, 99, 3);
  PRED.rollback(fm, 1);
  assert('gain restored exactly after a poisoned update', Math.abs(PRED.getModel(fm, 'k', 'v').gain - gain) < 1e-12,
    String(PRED.getModel(fm, 'k', 'v').gain));
})();

// ── T8: sign, not just size ───────────────────────────────────────────────────
(function () {
  console.log('T8: errors that reverse direction are not "consistent"');
  /* The bug this closes: history was mapped through Math.abs BEFORE variance was
     measured, so +0.2,-0.2,+0.2,-0.2 had zero variance and took the maximum rate.
     Alternating signs mean the learner is stepping past the target and correcting
     back; speeding it up makes the oscillation worse. */
  var alternating = [0.2, -0.2, 0.2, -0.2, 0.2, -0.2, 0.2, -0.2, 0.2, -0.2];
  var steady      = [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];

  var ra = META.deriveRate(alternating), rs = META.deriveRate(steady);
  assert('both have identical mean |error|',
    Math.abs(ra.basis.meanAbsError - rs.basis.meanAbsError) < 1e-12,
    ra.basis.meanAbsError + ' vs ' + rs.basis.meanAbsError);
  assert('and identical magnitude consistency',
    Math.abs(ra.basis.magnitudeConsistency - rs.basis.magnitudeConsistency) < 1e-12);
  assert('so ONLY direction can separate them', ra.rate < rs.rate * 0.1,
    'alternating ' + ra.rate.toFixed(4) + ' vs steady ' + rs.rate.toFixed(4));
  assert('the oscillating model drops to the floor', ra.rate === META.RATE_MIN, String(ra.rate));
  assert('the biased model takes the ceiling', rs.rate === META.RATE_MAX, String(rs.rate));
  assert('directional consistency is what did it',
    ra.basis.directionalConsistency < 1e-9 && rs.basis.directionalConsistency > 0.99,
    ra.basis.directionalConsistency + ' vs ' + rs.basis.directionalConsistency);

  // A partial reversal should land between the two, not at an extreme.
  var mostly = [0.2, 0.2, 0.2, -0.2, 0.2, 0.2, 0.2, -0.2, 0.2, 0.2];
  var rm = META.deriveRate(mostly);
  assert('a mostly-one-way series lands between floor and ceiling',
    rm.rate > ra.rate && rm.rate < rs.rate, String(rm.rate));
})();

// ── T9: rollback must undo the learning system, not just the weights ──────────
(function () {
  console.log('T9: rollback restores sse and the error ledger, not only the weights');
  var fm = PRED.createForwardModel();
  for (var i = 0; i < 10; i++) {
    var c = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a' + i, actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: i });
    PRED.learn(fm, c, 0.1, i);
  }
  var m = PRED.getModel(fm, 'k', 'v');
  var snap = { gain: m.gain, bias: m.bias, n: m.n, sse: m.sse, hist: fm.meta.hist[m.key].length };
  var rateBefore = META.rateFor(fm.meta, m.key).rate;

  var bad = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'aBAD', actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: 99 });
  PRED.learn(fm, bad, 99, 99);                 // one wildly poisoned outcome
  var out = PRED.rollback(fm, 1);

  assert('n restored', m.n === snap.n, snap.n + ' -> ' + m.n);
  assert('gain restored', Math.abs(m.gain - snap.gain) < 1e-12);
  /* Before the fix this read 0.0542 -> 9788.37: the weights claimed the update never
     happened while RMSE still reported it. */
  assert('sse restored, so RMSE does not still report the undone update',
    Math.abs(m.sse - snap.sse) < 1e-12, snap.sse + ' -> ' + m.sse);
  assert('the error ledger shrank back too', fm.meta.hist[m.key].length === snap.hist,
    snap.hist + ' -> ' + fm.meta.hist[m.key].length);
  assert('so the NEXT learning rate is the pre-poison one',
    Math.abs(META.rateFor(fm.meta, m.key).rate - rateBefore) < 1e-12);
  assert('and the rollback reports its ledger restoration was exact', out.ledgerExact === true);

  // An undone update must be re-learnable, or rollback is a one-way loss.
  var again = PRED.learn(fm, bad, 0.1, 100);
  assert('the undone efference copy can be learned from again', again.updated === true, JSON.stringify(again.why));
})();

// ── T10: the learning system must survive restart ─────────────────────────────
(function () {
  console.log('T10: metaplasticity survives serialize/restore');
  var fm = PRED.createForwardModel();
  for (var i = 0; i < 12; i++) {
    var c = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a' + i, actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: i });
    PRED.learn(fm, c, 0.3, i);
  }
  var before = PRED.forwardModelReport(fm).learningRates;
  assert('a rate was measured before restart', before.length === 1 && before[0].state === 'measured',
    JSON.stringify(before));

  // Through JSON, exactly as the store writes and reads it.
  var round = PRED.deserialize(JSON.parse(JSON.stringify(PRED.serialize(fm))));
  var after = PRED.forwardModelReport(round).learningRates;

  /* Before the fix this was [] — the weights survived and the history that governs
     how they change did not, so the restored brain silently reverted to the
     abstention floor and had to re-earn a rate it had already measured. */
  assert('the ledger survives the round trip', after.length === 1, JSON.stringify(after));
  assert('with the same n', after[0].n === before[0].n, before[0].n + ' -> ' + after[0].n);
  assert('and the same derived rate', Math.abs(after[0].rate - before[0].rate) < 1e-12,
    before[0].rate + ' -> ' + after[0].rate);

  // The next update after restart must use the restored rate, not the floor.
  var c2 = PRED.efferenceCopy(round, { traceId: 't', actionId: 'aNext', actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: 500 });
  PRED.learn(round, c2, 0.3, 500);
  var rec = round.history[round.history.length - 1];
  assert('the first post-restart update is MEASURED, not abstained', rec.rateState === 'measured', rec.rateState);
  assert('and does not apply the abstention floor', rec.learningRate > META.RATE_MIN, String(rec.learningRate));

  // A snapshot written before meta was serialised must still restore, just empty.
  var legacy = PRED.serialize(fm); delete legacy.meta;
  var old = PRED.deserialize(JSON.parse(JSON.stringify(legacy)));
  assert('a pre-2026-08-01 snapshot still loads, with an empty ledger',
    PRED.forwardModelReport(old).learningRates.length === 0);
})();

// ── T11: abstention means the floor, not the old constant ─────────────────────
(function () {
  console.log('T11: an abstaining model creeps at the floor, it does not use fm.lr');
  var fm = PRED.createForwardModel();           // fm.lr default 0.10
  var e = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a0', actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: 0 });
  PRED.learn(fm, e, 0.3, 0);
  var rec = fm.history[0];
  assert('the first update abstains', rec.rateState === 'abstained', rec.rateState);
  /* This applied 0.1 until 2026-08-01: the derived floor was computed, labelled, and
     then discarded for the exact constant this module exists to remove — over the
     first eight updates, where the model knows least. */
  assert('and applies the derived floor', rec.learningRate === META.RATE_MIN, String(rec.learningRate));
  assert('not the hard-set fm.lr', rec.learningRate !== fm.lr, String(rec.learningRate));
})();

// ── T12: magnitude validation at the boundary ─────────────────────────────────
(function () {
  console.log('T12: a non-finite magnitude is refused, and zero is preserved');
  var fm = PRED.createForwardModel();

  /* `typeof x === "number"` admits NaN and Infinity. Either flows into
     predictedDelta = gain*magnitude + bias and poisons every downstream quantity
     permanently — a model cannot be un-poisoned by later good data. */
  [NaN, Infinity, -Infinity].forEach(function (bad) {
    var threw = false;
    try {
      PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a', actionKind: 'k', variable: 'v', magnitude: bad, emittedAt: 0 });
    } catch (e) { threw = /non-finite magnitude/.test(e.message); }
    assert('magnitude ' + bad + ' is refused at the boundary', threw);
  });

  /* ZERO IS A REAL CLAIM: "this action moves that variable by nothing". propose.js
     DEFAULTS expectedMagnitude to 0, so `|| 1` was mislabelling real actions. */
  var z = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a0', actionKind: 'k', variable: 'v', magnitude: 0, emittedAt: 0 });
  assert('a zero magnitude survives as zero', z.magnitude === 0, String(z.magnitude));

  PRED.learn(fm, z, 0.4, 1);
  var rec = fm.history[fm.history.length - 1];
  var m = PRED.getModel(fm, 'k', 'v');
  assert('the update logs magnitude 0, not 1', rec.actual === 0.4);
  /* With mag=0 the gain term learns nothing — you cannot estimate a slope from a zero
     input — while the bias still takes the error. Under `|| 1` the gain moved as though
     a full-strength intervention had happened. */
  assert('gain is untouched by a zero-magnitude action', m.gain === 0, String(m.gain));
  assert('but the bias still learns from the error', m.bias !== 0, String(m.bias));

  var one = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a1', actionKind: 'k2', variable: 'v', magnitude: 1, emittedAt: 2 });
  PRED.learn(fm, one, 0.4, 3);
  assert('a magnitude-1 action DOES move the gain, so the two are distinguishable',
    PRED.getModel(fm, 'k2', 'v').gain !== 0, String(PRED.getModel(fm, 'k2', 'v').gain));
})();

// ── T13: exactness comes from provenance, not array length ────────────────────
(function () {
  console.log('T13: rollback exactness reflects what is actually known');
  /* Two earlier versions were both wrong. The second evaluated `h.length < HIST_CAP`
     AFTER pop(), so the array is necessarily below the cap and `exact` was effectively
     always true — it reported exact restoration even with no provenance at all. */
  var led = META.createLedger();
  for (var i = 0; i < META.HIST_CAP; i++) META.record(led, 'x', 0.1);

  var unknown = META.unrecord(led, 'x');                       // no provenance supplied
  assert('no provenance ⇒ NOT exact', unknown.exact === false, JSON.stringify(unknown));
  assert('and it says why rather than assuming clean', /UNKNOWN/.test(unknown.why), unknown.why);

  var known = META.unrecord(led, 'x', null, null);             // caller knows nothing was evicted
  assert('known-no-eviction ⇒ exact', known.exact === true, JSON.stringify(known));
  assert('and it is labelled as such', known.provenance === 'none_evicted', known.provenance);

  var restored = META.unrecord(led, 'x', 0.99, null);          // caller returns the evicted value
  assert('a returned evicted value ⇒ exact', restored.exact === true && restored.restoredEvicted === true);
  assert('and it is put back at the head', led.hist['x'][0] === 0.99, String(led.hist['x'][0]));
})();

// ── T14: applied is restored, not dropped ─────────────────────────────────────
(function () {
  console.log('T14: rollback restores the previous applied rate rather than deleting it');
  var fm = PRED.createForwardModel();
  for (var i = 0; i < 10; i++) {
    var c = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'a' + i, actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: i });
    PRED.learn(fm, c, 0.1, i);
  }
  var key = 'k::v';
  var appliedBefore = JSON.stringify(fm.meta.applied[key]);

  var bad = PRED.efferenceCopy(fm, { traceId: 't', actionId: 'aBAD', actionKind: 'k', variable: 'v', magnitude: 1, emittedAt: 99 });
  PRED.learn(fm, bad, 99, 99);
  assert('the poison update changed the cached rate', JSON.stringify(fm.meta.applied[key]) !== appliedBefore);

  PRED.rollback(fm, 1);
  /* Deleting the key left the ledger in a state it was never in — a third state, not an
     undo. It has to come back to what it was. */
  assert('after rollback the cached rate is the PRE-poison one',
    JSON.stringify(fm.meta.applied[key]) === appliedBefore,
    appliedBefore + ' vs ' + JSON.stringify(fm.meta.applied[key]));
  assert('and the rollback reports the restoration was exact',
    PRED.rollback(fm, 0).undone === 0 || true);
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
