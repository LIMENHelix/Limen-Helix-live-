/**
 * brain-v2/kernel/modulators.js — BLOCK_B12. Four control signals computing four quantities.
 *
 * SPEC B12, INV-6, row 11. MASTER_PROMPT §8.15, §6 (prohibited neuromyths). Fidelity: F1.
 *
 * THE NEUROMYTH RULE IS ENFORCED HERE, NOT JUST OBEYED.
 *
 * MASTER_PROMPT §6 forbids `dopamine = reward`, `serotonin = happiness`,
 * `norepinephrine = attention`. §8.15 says a transmitter label may be used ONLY when the
 * implemented control effect and its limits are explicit. So each function below states the
 * quantity it computes, the parameter it acts on, and what it is NOT.
 *
 * The four axes, and why four rather than one scaled differently:
 *
 *   DA phasic  — error in VALUE.               acts on: plasticity gating (eligibility x M)
 *   DA tonic   — average reward RATE.          acts on: vigor, i.e. the action threshold
 *   NE         — UNEXPECTED uncertainty.       acts on: global gain, interrupt, model abandonment
 *   ACh        — EXPECTED uncertainty.         acts on: prior-vs-evidence balance, encode/consolidate
 *   5-HT       — the HORIZON value is summed over. acts on: discounting, patience
 *
 * NE and ACh are the pair that is most often collapsed into one "uncertainty" number, and the
 * distinction is the whole reason both exist. ACh is noise the model already knows about — a
 * channel that is simply noisy. NE is evidence the model itself is wrong — a channel behaving
 * in a way the model has no room for. High ACh means "trust the data less, this is a noisy
 * regime"; high NE means "stop using this model". Opposite responses to superficially similar
 * readings.
 *
 * ORTHOGONALITY IS TESTED, NOT ASSERTED. `orthogonalityCheck()` correlates the realised
 * modulator series over the run. If any two exceed the threshold, that is one modulator with
 * two names and the report says so. SPEC row 11's actual test is not "are there four
 * variables" but "do four different quantities get computed", and only a correlation over real
 * traffic can answer that.
 *
 * EVERY MODULATOR IS A MODULATOR EDGE (INV-8). None of these can cause an output by itself.
 * They scale, threshold, and gate signals that already exist. select.js reads them to shift a
 * threshold; it never receives an action from them.
 */

'use strict';

var DEFAULTS = {
  gamma: 0.9,                // temporal discount base, modulated by 5-HT
  valueLr: 0.10,             // [mark: prior] critic value learning rate
  tonicWindow: 24,           // cycles over which average reward rate is computed
  surpriseWindow: 24,        // cycles for the NE surprise baseline
  orthogonalityThreshold: 0.95
};

function create(opts) {
  return {
    opts: Object.assign({}, DEFAULTS, opts || {}),
    values: Object.create(null),   // state -> V(s), the critic's value estimates
    rewardHistory: [],
    surpriseHistory: [],
    // Realised series, for the orthogonality test. These are the actual emitted values.
    series: { daPhasic: [], daTonic: [], ne: [], ach: [], fiveHT: [] },
    version: 0
  };
}

/**
 * DOPAMINE, PHASIC — REWARD PREDICTION ERROR.  delta = r + gamma*V(s') - V(s)
 *
 * COMPUTES: error in value. NOT pleasure, NOT reward itself, NOT salience.
 * ACTS ON: the plasticity gate. It multiplies eligibility traces (SPEC Part 5, three-factor
 *          rule). It cannot write a weight on its own — that is what "modulator" means.
 * LIMIT: this is a scalar. It cannot say WHICH part of the model was wrong, only that value
 *        was mispredicted. The signed per-variable answer is the forward model's job
 *        (predict.js), and merging the two is the shortcut that destroys the distinction.
 */
function daPhasic(m, spec) {
  var s = spec.state, sNext = spec.nextState;
  var r = numOr(spec.reward, 0);
  var gamma = effectiveGamma(m, spec.patience);
  var v = numOr(m.values[s], 0);
  var vNext = numOr(m.values[sNext], 0);
  var delta = r + gamma * vNext - v;

  // The critic's value update. This is the ONLY place V changes.
  m.values[s] = v + m.opts.valueLr * delta;
  m.rewardHistory.push(r);
  if (m.rewardHistory.length > m.opts.tonicWindow * 4) m.rewardHistory.shift();
  m.series.daPhasic.push(delta);
  m.version++;

  return {
    signal: 'da_phasic',
    computes: 'reward prediction error (error in value)',
    isNot: 'pleasure, reward magnitude, or salience',
    actsOn: 'plasticity gating — multiplies eligibility traces; cannot write a weight alone (INV-8)',
    value: delta,
    terms: { reward: r, gamma: gamma, vState: v, vNext: vNext },
    valueAfter: m.values[s]
  };
}

/**
 * DOPAMINE, TONIC — AVERAGE REWARD RATE -> VIGOR.
 *
 * COMPUTES: how rich the current environment is.
 * ACTS ON: the response threshold in select.js. A rich environment justifies acting sooner
 *          because the opportunity cost of waiting is higher.
 * LIMIT: a rate over a window. With a short history it is an ESTIMATE and says so.
 */
function daTonic(m) {
  var h = m.rewardHistory.slice(-m.opts.tonicWindow);
  if (!h.length) {
    m.series.daTonic.push(0);
    return { signal: 'da_tonic', value: 0, status: 'UNMEASURED', why: 'no resolved rewards yet — vigor is unknown, held at neutral' };
  }
  var rate = h.reduce(function (a, b) { return a + b; }, 0) / h.length;
  var vigor = Math.tanh(rate);      // bounded [-1,1]
  m.series.daTonic.push(vigor);
  m.version++;
  return {
    signal: 'da_tonic',
    computes: 'average reward rate over the last ' + h.length + ' resolved outcomes',
    isNot: 'motivation, mood, or the value of any single action',
    actsOn: 'action initiation threshold (vigor) in select.js',
    value: vigor,
    rate: rate,
    n: h.length,
    status: h.length >= 10 ? 'MEASURED' : 'ESTIMATED'
  };
}

/**
 * NOREPINEPHRINE — UNEXPECTED UNCERTAINTY. Evidence the current MODEL is wrong.
 *
 * COMPUTES: how far current surprise exceeds the surprise this model normally produces.
 *           Not surprise itself — surprise relative to habitual surprise. A regime that is
 *           always surprising is a noisy regime (that is ACh's business); a regime that has
 *           become surprising is a broken model.
 * ACTS ON: global gain, the hyperdirect stop, and model abandonment.
 * LIMIT: needs a baseline. Below `surpriseWindow` observations it reports UNMEASURED rather
 *        than a number, because "unusually surprising" is meaningless without "usually".
 */
function ne(m, spec) {
  var surprise = Math.abs(numOr(spec.surprise, 0));
  var h = m.surpriseHistory.slice(-m.opts.surpriseWindow);
  m.surpriseHistory.push(surprise);
  if (m.surpriseHistory.length > m.opts.surpriseWindow * 4) m.surpriseHistory.shift();

  if (h.length < 8) {
    m.series.ne.push(0);
    return {
      signal: 'ne', value: 0, status: 'UNMEASURED',
      computes: 'unexpected uncertainty (evidence the model is wrong)',
      why: 'only ' + h.length + ' surprise observations; cannot yet say what surprise is normal for this model'
    };
  }
  var mean = h.reduce(function (a, b) { return a + b; }, 0) / h.length;
  var sd = Math.sqrt(h.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / h.length);
  var z = sd > 1e-9 ? (surprise - mean) / sd : 0;
  var val = clamp01(sigmoid(z - 1));      // only clearly-above-normal surprise counts
  m.series.ne.push(val);
  m.version++;
  return {
    signal: 'ne',
    computes: 'unexpected uncertainty — surprise relative to this model own habitual surprise',
    isNot: 'attention, arousal, or stress',
    actsOn: 'global gain; the hyperdirect stop in select.js; the decision to abandon a model',
    value: val,
    terms: { surprise: surprise, habitualMean: mean, habitualSd: sd, z: z },
    n: h.length,
    status: 'MEASURED'
  };
}

/**
 * ACETYLCHOLINE — EXPECTED UNCERTAINTY. Known noise WITHIN the current model.
 *
 * COMPUTES: the measured noise level of the live channels. High = the data is noisy but the
 *           model is fine.
 * ACTS ON: the balance between bottom-up evidence and top-down prior, and the encode/
 *          consolidate switch (high ACh = encode from input; low ACh = replay and consolidate).
 * LIMIT: derived from channel variances that are themselves partly SET, not fitted. Labelled
 *        ESTIMATED accordingly.
 *
 * WHY THIS IS NOT THE SAME NUMBER AS NE. ACh rises when channels are noisy. NE rises when
 * channels behave in a way the model has no room for. A permanently noisy but well-modelled
 * channel drives ACh high and NE low — and the correct responses are opposite: weight the
 * prior more (ACh) versus throw the model away (NE).
 */
function ach(m, spec) {
  var variances = spec.channelVariances || [];
  if (!variances.length) {
    m.series.ach.push(0.5);
    return { signal: 'ach', value: 0.5, status: 'UNMEASURED', why: 'no live channel variances this cycle; held at neutral' };
  }
  var mean = variances.reduce(function (a, b) { return a + b; }, 0) / variances.length;
  var val = clamp01(mean / (mean + 1));    // bounded, monotone in measured noise
  m.series.ach.push(val);
  m.version++;
  return {
    signal: 'ach',
    computes: 'expected uncertainty — the measured noise level of live channels within the current model',
    isNot: 'learning rate, memory strength, or attention',
    actsOn: 'prior-vs-evidence weighting; the encode/consolidate state switch (BLOCK_B13)',
    value: val,
    meanVariance: mean,
    n: variances.length,
    status: 'ESTIMATED',
    statusWhy: 'channel observation noise r is SET, not fitted (see core/channel.js); this is derived from partly-prior quantities'
  };
}

/**
 * SEROTONIN — TIME HORIZON / PATIENCE.
 *
 * COMPUTES: how far ahead value is summed. Sets the effective discount factor.
 * ACTS ON: temporal discounting in daPhasic (via gamma) and the release threshold in select.js.
 * LIMIT: here it is driven by the ratio of open-to-resolved predictions — a system with many
 *        unresolved commitments should get MORE patient, not less. That link is an ENGINEERING
 *        choice (E5) with no literature anchor, and is marked as such.
 */
function fiveHT(m, spec) {
  var open = numOr(spec.openPredictions, 0);
  var resolved = numOr(spec.resolvedPredictions, 0);
  var total = open + resolved;
  var val;
  if (total === 0) {
    val = 0.5;
  } else {
    // More outstanding commitments -> longer horizon -> wait for them before acting again.
    val = clamp01(0.3 + 0.5 * (open / total));
  }
  m.series.fiveHT.push(val);
  m.version++;
  return {
    signal: '5ht',
    computes: 'time horizon / patience — the span over which value is summed',
    isNot: 'happiness, mood, or wellbeing',
    actsOn: 'discount factor gamma; the release threshold in select.js',
    value: val,
    terms: { openPredictions: open, resolvedPredictions: resolved },
    status: 'ESTIMATED',
    statusWhy: 'the open/resolved driver is an ENGINEERING abstraction (E5) with no literature anchor'
  };
}

function effectiveGamma(m, patience) {
  var p = numOr(patience, 0.5);
  // patience 0 -> myopic, 1 -> far-sighted. Bounded well below 1 so value stays finite.
  return clamp(m.opts.gamma * (0.6 + 0.4 * p), 0.1, 0.98);
}

/**
 * Compute all five for one cycle, and return the modulation bundle select.js consumes.
 * Order matters: 5-HT sets patience, which sets gamma, which daPhasic needs.
 */
function cycle(m, spec) {
  var ht = fiveHT(m, spec);
  var tonic = daTonic(m);
  var noise = ach(m, spec);
  var surprise = ne(m, spec);
  var phasic = spec.hasReward
    ? daPhasic(m, { state: spec.state, nextState: spec.nextState, reward: spec.reward, patience: ht.value })
    : { signal: 'da_phasic', value: 0, status: 'UNMEASURED', why: 'no resolved outcome this cycle — there is no value error to compute, and 0 here means "not computed", not "no error"' };

  return {
    daPhasic: phasic,
    daTonic: tonic,
    ne: surprise,
    ach: noise,
    fiveHT: ht,
    // The flattened view select.js reads. Every field names its source signal.
    vigor: tonic.value,
    patience: ht.value,
    unexpectedUncertainty: surprise.value,
    expectedUncertainty: noise.value,
    plasticityGate: phasic.value
  };
}

/**
 * ORTHOGONALITY CHECK — SPEC row 11's real test.
 *
 * "Are there four variables" is trivially satisfiable. "Do four different quantities get
 * computed" is not, and the only way to answer it is to correlate what the modulators actually
 * emitted over real traffic. Any pair above threshold is one modulator with two names.
 */
function orthogonalityCheck(m) {
  var names = Object.keys(m.series);
  var pairs = [], collapsed = [];
  for (var i = 0; i < names.length; i++) {
    for (var j = i + 1; j < names.length; j++) {
      var a = m.series[names[i]], b = m.series[names[j]];
      var n = Math.min(a.length, b.length);
      if (n < 8) { pairs.push({ pair: names[i] + '/' + names[j], n: n, r: null, status: 'UNMEASURED' }); continue; }
      var r = pearson(a.slice(-n), b.slice(-n));
      var entry = { pair: names[i] + '/' + names[j], n: n, r: r, status: 'MEASURED' };
      pairs.push(entry);
      if (r !== null && Math.abs(r) >= m.opts.orthogonalityThreshold) {
        collapsed.push(entry);
        entry.verdict = 'COLLAPSED — these two are computing the same quantity under different names';
      }
    }
  }
  var measured = pairs.filter(function (p) { return p.status === 'MEASURED'; });
  return {
    pairs: pairs,
    collapsed: collapsed,
    distinctAxes: collapsed.length === 0 ? names.length : names.length - collapsed.length,
    satisfiesRow11: measured.length > 0 && collapsed.length === 0,
    status: measured.length === 0 ? 'UNMEASURED' : 'MEASURED',
    why: measured.length === 0
      ? 'fewer than 8 cycles of modulator traffic; orthogonality is untested, not proven'
      : collapsed.length === 0
        ? measured.length + ' pairs correlated over real traffic, none above ' + m.opts.orthogonalityThreshold
        : collapsed.length + ' pair(s) collapsed'
  };
}

function pearson(a, b) {
  var n = a.length;
  if (n < 2) return null;
  var ma = a.reduce(function (x, y) { return x + y; }, 0) / n;
  var mb = b.reduce(function (x, y) { return x + y; }, 0) / n;
  var num = 0, da = 0, db = 0;
  for (var i = 0; i < n; i++) {
    var xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  if (da < 1e-12 || db < 1e-12) return null;   // a constant series has no correlation, not r=0
  return num / Math.sqrt(da * db);
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function clamp01(v) { return clamp(v, 0, 1); }
function clamp(v, lo, hi) { return (typeof v !== 'number' || !isFinite(v)) ? lo : (v < lo ? lo : (v > hi ? hi : v)); }
function numOr(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

function serialize(m) { return { opts: m.opts, values: m.values, rewardHistory: m.rewardHistory.slice(-256), surpriseHistory: m.surpriseHistory.slice(-256), series: trimSeries(m.series), version: m.version }; }
function trimSeries(s) { var o = {}; Object.keys(s).forEach(function (k) { o[k] = s[k].slice(-256); }); return o; }
function deserialize(o) {
  var m = create(o.opts);
  m.values = o.values || Object.create(null);
  m.rewardHistory = o.rewardHistory || [];
  m.surpriseHistory = o.surpriseHistory || [];
  m.series = o.series || m.series;
  m.version = o.version || 0;
  return m;
}

module.exports = {
  DEFAULTS: DEFAULTS,
  create: create,
  daPhasic: daPhasic, daTonic: daTonic, ne: ne, ach: ach, fiveHT: fiveHT,
  cycle: cycle,
  orthogonalityCheck: orthogonalityCheck,
  serialize: serialize, deserialize: deserialize
};
