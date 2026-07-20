/**
 * lib/phase-estimator.js — SHARED CORE (step 1 of PHASE_ESTIMATOR_SPEC.md).
 *
 * One precision-weighted recursive Bayesian filter over 11 latent LIMEN phases (P0..P10). Pure: no
 * Redis, no Date, no I/O. State (corrState) goes in and comes back out; the caller persists it. The
 * core knows nothing about brains or markets — two thin adapters (A: human sensory, B: grounded-stress
 * generalized) feed it a ChannelBundle. Making this rigorous once makes both substrates defensible.
 *
 * Provenance is in PHASE_ESTIMATOR_SPEC.md; the load-bearing lines are cited inline. The fusion step
 * (§2.2) is inverse-variance / precision-weighted cue combination — the same operation as the brain's
 * multisensory integration (Ernst & Banks 2002, Nature 415:429, DOI 10.1038/415429a, verified vs
 * primary PDF; NEURO_LEARNING_REFERENCE.md Creator 13.5) and the single-step form of Kalman filtering.
 *
 * HONESTY INVARIANTS (enforced here, not just documented):
 *  - Output is a BELIEF (distribution + confidence), never a bare label. phaseMAP is display only.
 *  - Abstain on thin/low-reliability coverage rather than emit a false number.
 *  - Precision self-consistency is a PRIOR, subject to correlated-channel groupthink; mitigated by
 *    decorrelation (eff_c) and superseded by an independently-measured precisionHint when present.
 *  - Staleness factor (rec_c) closes the acquisition-without-removal gap: a silent channel stops voting.
 *  - `stuck` (distress) is ORTHOGONAL to the phase number — being stuck is not a high P.
 *  - The 11-state taxonomy and transition matrix A are STATED priors [mark: prior]; the fusion
 *    mechanics are well-evidenced, the state space is not — do not let one launder the other.
 */

var NUM_PHASES = 11;                 // P0..P10 (canonical Light->Resurrection register; P0 = Null/Void)
var EWMA_LAMBDA = 0.93;              // CISS decay (Holló/Kremer/Lo Duca 2012), shared with grounded-stress
var CDF_MIN_SAMPLE = 8;             // below this a CDF rank is too coarse — value passes through, flagged
var PRECISION_FLOOR = 0.5;          // total precision below this => abstain
var STUCK_ALPHA = 0.5;              // blend of transition-blockage vs external distress composite [mark: prior]
var EPS = 1e-9;

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function r3(x) { return Math.round(x * 1000) / 1000; }

function uniform() { var v = new Array(NUM_PHASES); for (var i = 0; i < NUM_PHASES; i++) v[i] = 1 / NUM_PHASES; return v; }

function normalize(v) {
  var s = 0, i;
  for (i = 0; i < v.length; i++) s += (v[i] > 0 ? v[i] : 0);
  if (s <= 0) return uniform();
  var out = new Array(v.length);
  for (i = 0; i < v.length; i++) out[i] = (v[i] > 0 ? v[i] : 0) / s;
  return out;
}

function softmax(logv) {
  var m = -Infinity, i;
  for (i = 0; i < logv.length; i++) if (logv[i] > m) m = logv[i];
  var out = new Array(logv.length), s = 0;
  for (i = 0; i < logv.length; i++) { out[i] = Math.exp(logv[i] - m); s += out[i]; }
  for (i = 0; i < logv.length; i++) out[i] /= s;
  return out;
}

function argmax(v) { var mi = 0, i; for (i = 1; i < v.length; i++) if (v[i] > v[mi]) mi = i; return mi; }

// Histogram intersection — how much two distributions overlap (1 = identical, 0 = disjoint).
function overlap(a, b) { var s = 0, i; for (i = 0; i < a.length; i++) s += Math.min(a[i], b[i]); return s; }

// KL(P||Q), guarded.
function kl(p, q) {
  var s = 0, i;
  for (i = 0; i < p.length; i++) { if (p[i] > EPS) s += p[i] * Math.log((p[i] + EPS) / (q[i] + EPS)); }
  return s < 0 ? 0 : s;
}

// Empirical CDF / order-statistic rank (CISS Eq.1a). Returns null on thin sample so the caller decides.
function empiricalCdf(x, sample) {
  if (typeof x !== 'number' || !isFinite(x)) return null;
  if (!sample || sample.length < CDF_MIN_SAMPLE) return null;
  var s = sample.filter(function (v) { return typeof v === 'number' && isFinite(v); }).slice().sort(function (a, b) { return a - b; });
  if (s.length < CDF_MIN_SAMPLE) return null;
  var below = 0, equal = 0, i;
  for (i = 0; i < s.length; i++) { if (s[i] < x) below++; else if (s[i] === x) equal++; }
  var rank = below + (equal > 0 ? (equal + 1) / 2 : 0.5);
  return clamp01(Math.max(rank, 1) / s.length);
}

/**
 * Transition model A (§2.1). Developmental cycle: mostly stay + advance, small regress, small spread
 * for spiral re-entry ("use the spiral, not the ladder"). A[i][j] = P(next=Pj | now=Pi). STATED prior
 * [mark: prior] — do not tune against outcomes until the §7 labeled benchmark exists.
 */
function makeTransition(opts) {
  opts = opts || {};
  var STAY = opts.stay != null ? opts.stay : 0.55;
  var ADV = opts.advance != null ? opts.advance : 0.30;
  var REG = opts.regress != null ? opts.regress : 0.08;
  var A = [], i, j;
  for (i = 0; i < NUM_PHASES; i++) {
    var row = new Array(NUM_PHASES);
    for (j = 0; j < NUM_PHASES; j++) row[j] = 0;
    row[i] += STAY;
    row[(i + 1) % NUM_PHASES] += ADV;
    row[(i + NUM_PHASES - 1) % NUM_PHASES] += REG;
    // spread the remainder uniformly over the non-{stay,adv,reg} states (spiral re-entry)
    var used = { }; used[i] = 1; used[(i + 1) % NUM_PHASES] = 1; used[(i + NUM_PHASES - 1) % NUM_PHASES] = 1;
    var rest = [];
    for (j = 0; j < NUM_PHASES; j++) if (!used[j]) rest.push(j);
    var tail = Math.max(0, 1 - (STAY + ADV + REG));
    for (j = 0; j < rest.length; j++) row[rest[j]] += tail / rest.length;
    // normalize (guards param choices that don't sum to 1)
    var sum = 0; for (j = 0; j < NUM_PHASES; j++) sum += row[j];
    for (j = 0; j < NUM_PHASES; j++) row[j] /= sum;
    A.push(row);
  }
  return A;
}

// beliefPred[j] = Σ_i beliefPrev[i]·A[i][j]  (§2.1)
function predict(beliefPrev, A) {
  var out = new Array(NUM_PHASES), i, j;
  for (j = 0; j < NUM_PHASES; j++) { var s = 0; for (i = 0; i < NUM_PHASES; i++) s += beliefPrev[i] * A[i][j]; out[j] = s; }
  return normalize(out);
}

// EWMA rank-correlation over channel z-values (CISS Eq.4), demeaned by the theoretical median 0.5.
// Used only for the decorrelation discount eff_c (§2.3). Returns { state, C } where C[a][b] in [-1,1].
function updateCorrelation(keys, z, prior) {
  var state = { var: {}, cov: {} }, i, j, a, b, key;
  for (i = 0; i < keys.length; i++) {
    a = keys[i];
    var da = z[a] - 0.5;
    var pv = (prior && prior.var && typeof prior.var[a] === 'number') ? prior.var[a] : da * da;
    state.var[a] = EWMA_LAMBDA * pv + (1 - EWMA_LAMBDA) * da * da;
    for (j = i + 1; j < keys.length; j++) {
      b = keys[j]; key = a + '|' + b;
      var db = z[b] - 0.5;
      var pc = (prior && prior.cov && typeof prior.cov[key] === 'number') ? prior.cov[key] : da * db;
      state.cov[key] = EWMA_LAMBDA * pc + (1 - EWMA_LAMBDA) * da * db;
    }
  }
  var C = {};
  for (i = 0; i < keys.length; i++) {
    a = keys[i]; C[a] = {};
    for (j = 0; j < keys.length; j++) {
      b = keys[j];
      if (i === j) { C[a][b] = 1; continue; }
      key = (i < j) ? (a + '|' + b) : (b + '|' + a);
      var sa = Math.sqrt(state.var[a]), sb = Math.sqrt(state.var[b]);
      var rho = (sa > 1e-12 && sb > 1e-12) ? (state.cov[key] / (sa * sb)) : 0;
      C[a][b] = Math.max(-1, Math.min(1, rho));
    }
  }
  return { state: state, C: C };
}

/**
 * estimate(bundle, opts)
 *
 * bundle = { substrate, subjectId, readings: [ { key, value, likelihood:float[11]|null, precisionHint?, age? } ] }
 * opts:
 *   corrState          — state returned by a previous call (persist + feed back); null on cold start
 *   history            — { key: [prior raw values] } for the empirical-CDF transform
 *   transition         — override makeTransition params
 *   recencyHalflife    — number|null. null => rec_c = 1 (abstain on unknown cadence, per spec §2.3)
 *   precisionFloor     — override PRECISION_FLOOR
 *   distressComposite  — [0,1] external within-phase severity (e.g. Adapter B CISS composite); blended into stuck
 *
 * returns { belief, phaseMAP, confidence, stuck, grounded, degraded, corrState }
 */
function estimate(bundle, opts) {
  opts = opts || {};
  var floor = opts.precisionFloor != null ? opts.precisionFloor : PRECISION_FLOOR;
  var history = opts.history || {};
  var prev = opts.corrState || {};
  var readings = (bundle && bundle.readings ? bundle.readings : []).filter(function (rd) {
    return rd && typeof rd.key === 'string' && (Array.isArray(rd.likelihood) || typeof rd.value === 'number');
  });

  var A = makeTransition(opts.transition);
  var beliefPrev = opts.beliefPrev || prev.beliefPrev || uniform();
  var beliefPred = predict(beliefPrev, A);

  if (readings.length === 0) {
    return {
      grounded: false, belief: beliefPred, phaseMAP: argmax(beliefPred), confidence: 0, stuck: null,
      degraded: { reason: 'no channels — abstain' },
      corrState: { var: prev.var || {}, cov: prev.cov || {}, resVar: prev.resVar || {}, beliefPrev: beliefPred, mapPhase: argmax(beliefPred), stuckAcc: prev.stuckAcc || 0, seenTicks: (prev.seenTicks || 0) + 1 }
    };
  }

  // ── Per-channel: transform value, normalize likelihood, raw precision ────────────────────────────
  var keys = [], z = {}, L = {}, rcRaw = {}, usedHint = {}, anyUntransformed = false, anySelfConsistency = false;
  for (var i = 0; i < readings.length; i++) {
    var rd = readings[i], k = rd.key;
    keys.push(k);

    // value -> empirical-CDF rank (for decorrelation + honesty flag); pass raw if history thin
    var zc = (typeof rd.value === 'number') ? empiricalCdf(rd.value, history[k]) : null;
    if (zc === null) { zc = (typeof rd.value === 'number') ? clamp01(rd.value) : 0.5; if (typeof rd.value === 'number' && !(history[k] && history[k].length >= CDF_MIN_SAMPLE)) anyUntransformed = true; }
    z[k] = zc;

    // likelihood: provided phase-signature, else flat (uninformative for phase)
    L[k] = Array.isArray(rd.likelihood) && rd.likelihood.length === NUM_PHASES ? normalize(rd.likelihood) : uniform();

    // raw precision: independent precisionHint preferred (true inverse-variance), else self-consistency
    if (typeof rd.precisionHint === 'number' && rd.precisionHint > 0) { rcRaw[k] = rd.precisionHint; usedHint[k] = true; }
    else {
      var pv = (prev.resVar && typeof prev.resVar[k] === 'number') ? prev.resVar[k] : null;
      rcRaw[k] = (pv != null) ? (1 / (pv + EPS)) : 1;    // neutral prior on cold start
      anySelfConsistency = true;
    }
  }

  // ── Decorrelation (eff_c) + staleness (rec_c) => final precision rc ───────────────────────────────
  var corr = updateCorrelation(keys, z, prev);
  var rc = {}, totalPrecision = 0;
  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var absSum = 0; for (var j2 = 0; j2 < keys.length; j2++) absSum += Math.abs(corr.C[key][keys[j2]]);
    var effc = absSum > 0 ? (1 / absSum) : 1;                       // effective-independence discount
    var age = readings[i].age;
    var recc = (opts.recencyHalflife != null && typeof age === 'number') ? Math.exp(-Math.max(0, age) / opts.recencyHalflife) : 1;
    rc[key] = rcRaw[key] * effc * recc;
    totalPrecision += rc[key];
  }

  // ── Abstain on thin/low-reliability coverage ─────────────────────────────────────────────────────
  if (totalPrecision < floor) {
    return {
      grounded: false, belief: beliefPred, phaseMAP: argmax(beliefPred), confidence: 0, stuck: null,
      degraded: { reason: 'total precision ' + r3(totalPrecision) + ' < floor ' + floor + ' — abstain', untransformedChannels: anyUntransformed },
      corrState: { var: corr.state.var, cov: corr.state.cov, resVar: prev.resVar || {}, beliefPrev: beliefPred, mapPhase: argmax(beliefPred), stuckAcc: prev.stuckAcc || 0, seenTicks: (prev.seenTicks || 0) + 1 }
    };
  }

  // ── Fusion (§2.2): logpost[p] = log(beliefPred[p]) + Σ_c (rc/Σrk)·log(Lc[p]) ─────────────────────
  var logpost = new Array(NUM_PHASES);
  for (var p = 0; p < NUM_PHASES; p++) logpost[p] = Math.log(beliefPred[p] + EPS);
  for (i = 0; i < keys.length; i++) {
    var kk = keys[i], w = rc[kk] / totalPrecision;
    for (p = 0; p < NUM_PHASES; p++) logpost[p] += w * Math.log(L[kk][p] + EPS);
  }
  var belief = softmax(logpost);

  // ── Update self-consistency variance for NEXT tick (residual = KL(channel, fused belief)) ────────
  var resVar = {};
  for (i = 0; i < keys.length; i++) {
    var kn = keys[i];
    var residual = kl(L[kn], belief);
    var pvOld = (prev.resVar && typeof prev.resVar[kn] === 'number') ? prev.resVar[kn] : residual * residual;
    resVar[kn] = EWMA_LAMBDA * pvOld + (1 - EWMA_LAMBDA) * residual * residual;
  }

  // ── Stuck / distress (§2.5): transition-blockage (wanted to move, didn't) + external composite ────
  var expectedShift = 1 - overlap(beliefPred, beliefPrev);   // how far A tried to move
  var actualShift = 1 - overlap(belief, beliefPrev);         // how far belief actually moved
  var blockage = clamp01(expectedShift - actualShift);
  var stuckAcc = EWMA_LAMBDA * (prev.stuckAcc || 0) + (1 - EWMA_LAMBDA) * blockage;
  var extDistress = (typeof opts.distressComposite === 'number') ? clamp01(opts.distressComposite) : 0;
  var stuck = clamp01(STUCK_ALPHA * stuckAcc + (1 - STUCK_ALPHA) * extDistress);

  var confidence = clamp01(totalPrecision / (totalPrecision + keys.length));

  return {
    grounded: true,
    belief: belief,                           // full-precision distribution (sums to 1); round only at display
    phaseMAP: argmax(belief),                 // display only — the belief is the answer
    confidence: r3(confidence),
    stuck: r3(stuck),                         // orthogonal to phaseMAP
    channels: keys.map(function (k) { return { key: k, precision: r3(rc[k]), fromHint: usedHint[k] === true }; }),
    degraded: (anyUntransformed || anySelfConsistency) ? {
      untransformedChannels: anyUntransformed,           // history too thin for a CDF rank
      selfConsistencyPrecision: anySelfConsistency,      // [mark: prior] correlated-channel groupthink risk
      note: 'Untransformed channels are on a different scale until history fills. Self-consistency precision is a prior (groupthink-prone), decorrelated by eff_c; independent precisionHint preferred. Taxonomy + transition A are STATED priors.'
    } : null,
    corrState: {
      var: corr.state.var, cov: corr.state.cov, resVar: resVar,
      beliefPrev: belief, mapPhase: argmax(belief), stuckAcc: stuckAcc, seenTicks: (prev.seenTicks || 0) + 1
    }
  };
}

module.exports = {
  estimate: estimate,
  NUM_PHASES: NUM_PHASES,
  EWMA_LAMBDA: EWMA_LAMBDA,
  PRECISION_FLOOR: PRECISION_FLOOR,
  // exported for testing
  makeTransition: makeTransition,
  predict: predict,
  empiricalCdf: empiricalCdf,
  updateCorrelation: updateCorrelation,
  softmax: softmax,
  normalize: normalize,
  overlap: overlap,
  kl: kl,
  uniform: uniform
};
