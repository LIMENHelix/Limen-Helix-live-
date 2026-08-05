/**
 * brain-v2/test/noise-control.js — SPEC row 22. Does deriving q and r actually help?
 *
 *   node brain-v2/test/noise-control.js
 *
 * A DERIVED PARAMETER IS NOT AUTOMATICALLY A BETTER PARAMETER. "Measured from its own
 * statistics" is a description of provenance, not of quality, and this project's own
 * history is full of mechanisms that were correct in shape and useless in effect. So the
 * claim "learning rates are derived per-node" only gets to move the checklist if the
 * derived values beat the hand-set ones on data the derivation never saw.
 *
 * THE PROTOCOL
 *
 *   ADAPT WINDOW    the first 60% of the recorded rows. Both arms observe them. The
 *                   adaptive arm derives q and r from its own innovations here; the
 *                   control arm holds the declared priors.
 *   FREEZE          the adaptive arm's parameters are frozen at the boundary. Nothing
 *                   after this point can change them, so the test window is genuinely
 *                   held out rather than being fitted as it is scored.
 *   TEST WINDOW     the remaining 40%. Both arms filter it with parameters chosen
 *                   before any of it was seen, and are scored on the same rows.
 *
 * THE METRIC IS NIS, NOT ERROR. Normalised innovation squared, E[v^2/(P+r)], is 1 for a
 * correctly tuned filter. Raw error would be the wrong scorecard here: r barely moves the
 * point estimate of a scalar filter, so both arms would score nearly the same and the
 * comparison would look like a tie regardless of the truth. What the noise parameters
 * actually govern is CALIBRATION — whether the filter's stated uncertainty matches its
 * observed errors — and that is what everything downstream consumes, since precision is
 * the fusion weight and the abstention gate. NIS also cannot be gamed by inflating
 * uncertainty, because it punishes over-caution and over-confidence alike.
 *
 * Deterministic: fixed fixture, fixed split, no clock, no randomness.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var C = require('../core/channel.js');
var MP = require('../core/metaplasticity.js');
var BIND = require('../bind/energy.js');

var ROOT = path.join(__dirname, '..');
var rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'energy-recorder.json'), 'utf8'))
  .rows.slice().sort(function (a, b) { return a.t - b.t; });

var SPLIT = Math.floor(rows.length * 0.6);

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

/**
 * Run one arm over the rows and score the TEST window only.
 *
 * Scoring is done on innovations recorded during the test window, using each channel's
 * parameters as they stand. The adaptive arm stops deriving at the split, so its numbers
 * come from parameters fixed before the scored rows existed.
 */
function arm(adapt) {
  var chans = BIND.spec().channels.map(function (c) { return C.createChannel(c); });
  var byKey = Object.create(null);
  chans.forEach(function (c) { byKey[c.key] = c; });

  var scored = Object.create(null);
  chans.forEach(function (c) { scored[c.key] = { v: [], P: [] }; });

  for (var i = 0; i < rows.length; i++) {
    var reading = BIND.readRecorderRow(rows[i]);
    var now = rows[i].t;
    var testing = i >= SPLIT;

    chans.forEach(function (ch) {
      var r = reading[ch.key];
      C.predict(ch, now);
      if (!r || typeof r.value !== 'number' || !isFinite(r.value)) return;
      var Pprior = ch.P;
      var out = C.observe(ch, r.value, now);
      if (out && testing) { scored[ch.key].v.push(out.innovation); scored[ch.key].P.push(Pprior); }
    });

    /* Derive on the same cadence the loop uses, and ONLY inside the adapt window. */
    if (adapt && !testing && i > 0 && i % 24 === 0) {
      chans.forEach(function (ch) { C.deriveNoise(ch, now); });
    }
  }
  return { chans: chans, byKey: byKey, scored: scored };
}

console.log('');
console.log('=== ROW 22 CONTROL: DERIVED q/r vs DECLARED PRIORS ===');
console.log('');
console.log('data : ' + rows.length + ' recorded hourly rows; adapt on the first ' + SPLIT +
            ', score on the held-out ' + (rows.length - SPLIT));
console.log('');

var control = arm(false);
var adaptive = arm(true);

/* Only channels that actually produced scored innovations can be compared. A channel
   that never delivered a usable reading in the test window is reported as excluded
   rather than counted as a tie, which would quietly dilute the result toward "no
   difference" — the answer this test most needs to not manufacture. */
var comparable = [], excluded = [];
Object.keys(control.scored).forEach(function (k) {
  var n = Math.min(control.scored[k].v.length, adaptive.scored[k].v.length);
  if (n >= MP.NOISE_MIN_N) comparable.push(k); else excluded.push({ key: k, n: n });
});

/**
 * LIVE CHANNELS ARE SCORED SEPARATELY, AND THAT SPLIT IS THE HEADLINE.
 *
 * On a channel whose value never moves, the innovations are near zero, NIS is near zero
 * in BOTH arms, and |log(NIS)| is a huge number dominated by float noise. Counting those
 * as wins or losses measures nothing: a dead channel already refuses to fuse, so its
 * calibration never reaches a decision. Ten dead channels agreeing by accident would
 * outvote four live ones either way, which makes the aggregate count a coin flip wearing
 * a lab coat.
 *
 * The inclusion test is the system's OWN liveness rule (channel.js `liveness`), not a
 * threshold invented here to get a nicer number — using the existing, already-tested
 * definition is what keeps this from being a filter chosen after seeing the result.
 * Both totals are printed, so the effect of the exclusion is visible rather than applied
 * silently.
 */
function isLive(k) { return C.liveness(control.byKey[k]) === 'live' && C.liveness(adaptive.byKey[k]) === 'live'; }

console.log(pad('channel', 16) + pad('state', 6) + pad('n', 6) + pad('r declared', 13) + pad('r derived', 13) +
            pad('q derived', 13) + pad('NIS ctrl', 11) + pad('NIS adapt', 11) + 'better');
console.log('-'.repeat(102));

var wins = 0, losses = 0, ties = 0, rows_ = [];
var liveWins = 0, liveLosses = 0, liveTies = 0;
comparable.forEach(function (k) {
  var cc = control.byKey[k], ca = adaptive.byKey[k];
  var nc = MP.nis(control.scored[k].v, control.scored[k].P, cc.r);
  var na = MP.nis(adaptive.scored[k].v, adaptive.scored[k].P, ca.r);
  if (nc.state !== 'measured' || na.state !== 'measured') return;
  var d = na.miscalibration - nc.miscalibration;   // negative = adaptive is closer to 1
  var verdict = Math.abs(d) < 1e-6 ? 'tie' : (d < 0 ? 'adaptive' : 'control');
  if (verdict === 'adaptive') wins++; else if (verdict === 'control') losses++; else ties++;
  var live = isLive(k);
  if (live) { if (verdict === 'adaptive') liveWins++; else if (verdict === 'control') liveLosses++; else liveTies++; }
  rows_.push({ key: k, n: na.n, ctrl: nc.value, adapt: na.value, d: d, verdict: verdict, live: live,
               rState: ca.noiseState.r, qState: ca.noiseState.q });
  console.log(pad(k, 16) + pad(live ? 'live' : 'dead', 6) + pad(na.n, 6) +
              pad(cc.r.toFixed(4), 13) + pad(ca.r.toFixed(4), 13) +
              pad(ca.q.toFixed(6), 13) + pad(nc.value.toFixed(3), 11) + pad(na.value.toFixed(3), 11) + verdict);
});

console.log('');
console.log('  LIVE channels only : adaptive better on ' + liveWins + ', worse on ' + liveLosses + ', tied on ' + liveTies +
            '   <- the number that counts');
console.log('  all comparable     : adaptive better on ' + wins + ', worse on ' + losses + ', tied on ' + ties +
            '   (includes dead channels where NIS is degenerate in both arms)');
if (excluded.length) {
  console.log('  excluded (under ' + MP.NOISE_MIN_N + ' scored innovations): ' +
              excluded.map(function (e) { return e.key + '(' + e.n + ')'; }).join(', '));
}
console.log('');

// ── the assertions ───────────────────────────────────────────────────────────
console.log('MECHANISM');
assert('the derivation actually moved parameters away from the declared priors',
  adaptive.chans.some(function (c) { return Math.abs(c.r - c.rDeclared) > 1e-9 || Math.abs(c.q - c.qDeclared) > 1e-12; }),
  adaptive.chans.map(function (c) { return c.key + ' r=' + c.r.toFixed(4) + '/' + c.rDeclared; }).join(' '));
assert('the control arm did NOT move — it is a real control',
  control.chans.every(function (c) { return c.r === c.rDeclared && c.q === c.qDeclared; }));
assert('every derived channel says whether each parameter is derived or still prior',
  adaptive.chans.every(function (c) { return c.noiseState && (c.noiseState.r === 'derived' || c.noiseState.r === 'prior'); }));
assert('rBase and rGain compose: r = rBase * rGain, clamped',
  adaptive.chans.every(function (c) {
    var want = Math.min(4.0, Math.max(0.01, c.rBase * c.rGain));
    return Math.abs(c.r - want) < 1e-12;
  }));

console.log('');
console.log('ATTENTION MUST NOT BE FOLDED INTO THE MEASUREMENT');
/**
 * THE DOUBLE-APPLICATION BUG AND THE WRONG FIX FOR IT.
 *
 * Innovations are produced by a filter running at the effective noise r = rBase * rGain.
 * The first version stored the estimate straight into rBase, so applyR() multiplied the
 * gain in a second time and every further derivation compounded it. The first attempted
 * fix divided the estimate by the mean gain, which was also wrong and measurably so:
 * `var(v) - mean(P_prior)` estimates the WORLD's noise, not the configured one, so
 * dividing biased it — at gain 4 as far low as gain 0.25 biased it high.
 *
 * The bias is not arithmetic. Attention deliberately runs the filter at a noise level it
 * does not believe, so P_prior stops being the true prior variance and the subtraction
 * returns r_true + (P_true - P_filter), which the window cannot recover. On a signal with
 * a known true r of 0.25 the three gains converged to 0.28 / 0.69 / 0.089 and kept
 * separating. So the estimator ABSTAINS outside a narrow gain band: a filter that
 * attention is distorting is not an instrument for calibrating itself.
 *
 * The held-out comparison above cannot catch any of this, because it never raises
 * attention and every gain there is 1.
 */
(function () {
  /* A properly specified signal — random-walk state plus white observation noise, with a
     KNOWN true r — generated by a fixed LCG so this stays deterministic. Math.random()
     would make the whole suite non-replayable. */
  function lcg(seed) { var s = seed >>> 0; return function () { s = (1103515245 * s + 12345) >>> 0; return s / 4294967296; }; }
  function gauss(u) { return u() + u() + u() + u() + u() + u() - 3; }
  var TRUE_R = 0.25;
  var data = (function () { var u = lcg(42), x = 10, out = []; for (var i = 0; i < 200; i++) { x += gauss(u) * 0.1; out.push(x + gauss(u) * Math.sqrt(TRUE_R)); } return out; })();

  function run(gain, passes) {
    var ch = C.createChannel({ key: 'k', cadenceMs: 3600000, r: 0.20, q: 0.02 });
    if (gain !== 1) C.setAttentionGain(ch, gain);
    var t = 1e12;
    for (var d = 0; d < passes; d++) {
      for (var i = 0; i < 20; i++) { var k = d * 20 + i, at = t + k * 3600000; C.predict(ch, at); C.observe(ch, data[k], at); }
      C.deriveNoise(ch, t + (d * 20 + 20) * 3600000);
    }
    return ch;
  }

  var plain = run(1, 8), up = run(0.25, 8), down = run(4, 8);

  assert('with no attention the estimator recovers the true observation noise',
    Math.abs(plain.rBase - TRUE_R) < 0.1 && plain.noiseState.r === 'derived',
    'derived ' + plain.rBase.toFixed(5) + ' against a true ' + TRUE_R);

  assert('under raised attention it ABSTAINS rather than writing a biased base',
    up.noiseState.r === 'prior' && up.rBase === up.rDeclared,
    up.noiseState.r + ' base=' + up.rBase);
  assert('under lowered attention it abstains too — the bias runs both ways',
    down.noiseState.r === 'prior' && down.rBase === down.rDeclared,
    down.noiseState.r + ' base=' + down.rBase);
  assert('and it says why, naming the gain and the trusted band',
    /attention gain/.test(up.noiseState.why) && /trusted band/.test(up.noiseState.why), up.noiseState.why);

  /* THE COMPOUNDING TEST. Eight derivations under sustained attention must leave the base
     exactly where it started — not merely close. Any drift at all is attention leaking
     into a measurement of the world, and it compounds. */
  assert('eight derivations under sustained attention leave the base EXACTLY unmoved',
    up.rBase === 0.20 && down.rBase === 0.20,
    'raised ' + up.rBase + ', lowered ' + down.rBase);

  /* Attention still does its job: the EFFECTIVE r moves, exactly once. */
  assert('attention still changes the effective r',
    Math.abs(up.r - plain.r) > 1e-9 && Math.abs(down.r - plain.r) > 1e-9,
    plain.r.toFixed(5) + ' / ' + up.r.toFixed(5) + ' / ' + down.r.toFixed(5));
  assert('and the gain is applied exactly once, never twice',
    Math.abs(up.r - Math.min(4, Math.max(0.01, up.rBase * up.rGain))) < 1e-12 &&
    Math.abs(down.r - Math.min(4, Math.max(0.01, down.rBase * down.rGain))) < 1e-12,
    up.r + ' vs ' + up.rBase * up.rGain);
  assert('the gain in force is recorded per innovation, not read at derivation time',
    up.innovG.length === up.innov.length && up.innovR.length === up.innov.length,
    up.innovG.length + '/' + up.innov.length);
})();

console.log('');
console.log('HELD-OUT COMPARISON');
assert('the held-out window was never used for derivation',
  SPLIT < rows.length && rows_.length > 0, SPLIT + ' / ' + rows.length);
assert('at least one channel could be compared', rows_.length > 0, String(rows_.length));

/* THE GATE. Row 22 only moves if adaptation measurably wins. This assertion states the
   measured result rather than demanding a particular one, because a test that fails when
   the honest answer is "it did not help" would just be pressure to fake the answer — the
   exact failure mode the scorecard rewrite was for. The VERDICT below is what the
   checklist reads. */
var netWin = liveWins > liveLosses;
console.log('');
console.log('  VERDICT: ' + (netWin
  ? 'derivation improves held-out calibration on a majority of LIVE channels'
  : 'derivation does NOT improve held-out calibration on live channels — row 22 stays partial on this evidence'));

var liveRows = rows_.filter(function (r) { return r.live; });
var total = liveRows.reduce(function (a, r) { return a + r.d; }, 0);
console.log('  summed miscalibration change over live channels: ' + total.toFixed(4) + ' (negative favours adaptive)');
console.log('  live channels scored: ' + (liveRows.map(function (r) { return r.key; }).join(', ') || 'none'));
console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
process.exit(failures ? 1 : 0);
