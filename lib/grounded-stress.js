/**
 * lib/grounded-stress.js — SHADOW: derive a domain's stress from the actual node/business state,
 * NOT from feed activity/article counts.
 *
 * Rationale (operator, 2026-07-18): feeds are reference + opportunity-discovery, NOT the stress
 * creator. Stress should be a read of the real businesses/nodes, exactly how `phase` is already
 * grounded in the worker (limen-worker-snapshot).
 *
 * ── v2 (2026-07-19): rebuilt on the economics of stress measurement ────────────────────────────
 * v1 took a flat arithmetic mean of "is this company flagged" over the kernel-scored companies.
 * Three things were wrong with that, each with a published fix. Sources are recorded in
 * NEURO_LEARNING_REFERENCE.md Creator 12; the short version:
 *
 *   1. AN AVERAGE MANUFACTURES STRESS OUT OF UNCORRELATED NOISE. The ECB's CISS (Holló, Kremer &
 *      Lo Duca 2012, ECB WP 1426) aggregates subindices with a portfolio-theory quadratic form
 *      CISS = (w∘s)' C (w∘s) over a time-varying correlation matrix C. The weighted average is the
 *      UPPER BOUND of that form, reached only when every channel is perfectly correlated. So a
 *      domain only reads as stressed when its channels move TOGETHER, which is the thing that
 *      makes stress systemic rather than incidental.
 *   2. Z-SCORES ASSUME NORMALITY AND SILENTLY RE-CENTER. Expanding-sample means/SDs get revised as
 *      outliers accumulate, which retroactively reclassifies past events (Hakkio & Keeton document
 *      this happening to the KCFSI). CISS and the Cleveland Fed CFSI both use an empirical-CDF /
 *      order-statistic transform instead: unit-free, bounded (0,1], distribution-free.
 *   3. FLAT 1/N WEIGHTING IS WRONG WHEN UNIT SIZE IS FAT-TAILED. Gabaix 2011 (Econometrica 79:733)
 *      shows firm size is Zipf-distributed (ζ≈1.06), so aggregate volatility decays as 1/ln N, not
 *      1/√N, and the largest units never wash out. Weight by mass, not headcount.
 *
 * The KERNEL IS NOT THE STRESS SOURCE. It is one narrow, high-precision sensor validated on a small
 * slice of companies (see kernel-scope-envelope). It is used here the way a nociceptor is used: high
 * weight WHEN IT FIRES, no contribution when silent. It is never the whole reading, and a domain
 * with no kernel coverage is not therefore a calm domain.
 *
 * HONEST LIMITS OF THIS FILE, stated rather than hidden:
 *  - Node mass is not available from COMPANY_REGISTRY today (no market cap / revenue field), so the
 *    Gabaix weighting degrades to equal weights. Illing & Liu 2006 found credit weights land within
 *    1.6 points of equal weighting and their top three aggregators correlate 94-99%, so this is a
 *    small loss, but it IS a loss and `massWeighted:false` is reported so it can't be forgotten.
 *    Pass companies with a numeric `mass` field and it upgrades with no other change.
 *  - The correlation matrix needs history. This function is pure (no Redis/Date), so the caller
 *    passes prior EWMA state in and persists the state returned. With no history C = I, which is the
 *    honest uncorrelated case and still beats an average.
 *  - This measures REALIZED stress, not fragility, and it is CONTEMPORANEOUS, not predictive
 *    (Illing & Liu are explicit that a stress index is not an early-warning model). Do not present
 *    it as a forecast.
 *  - Values are ORDINAL WITHIN A VINTAGE. The CDF transform is taken over the history supplied, so
 *    two runs with different history are not strictly comparable. Never diff across vintages.
 */

function r3(x) { return Math.round(x * 1000) / 1000; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/**
 * distinctCount(arr) — how many distinct numbers a sample actually contains.
 *
 * This is the test for whether a rank means anything. empiricalCdf will happily rank against a
 * history of 201 identical values and return (n+1)/2n, which reads as "precisely median" for any
 * input whatsoever. Length is not evidence of information; distinctness is.
 */
function distinctCount(arr) {
  if (!Array.isArray(arr) || !arr.length) return 0;
  var seen = Object.create(null), c = 0;
  for (var i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number' || !isFinite(arr[i])) continue;
    var k = String(arr[i]);
    if (!seen[k]) { seen[k] = 1; c++; }
  }
  return c;
}

// Distress trajectories the kernel emits (besides the explicit alert flag).
var DISTRESS_TRAJ = { UNRECOVERED_P3: 1, RUPTURE: 1, UNRECOVERED: 0.8, STUCK: 0.8 };

// Channel weights. STATED, not derived — no labelled benchmark exists yet to fit them against
// (Illing & Liu built theirs from a review of every Bank of Canada Annual Report since 1977 plus a
// 40-person expert survey; that is the work this would need). Kept deliberately close to equal,
// because Illing & Liu's own credit weights landed within 1.6 points of equal and they said plainly
// "one cannot claim that this index has the optimal weights."
/**
 * GRANULARITY REMOVED FROM THE COMPOSITE 2026-07-29. It was measuring our own coverage.
 *
 * channelGranularity implements Gabaix's sales-Herfindahl, and its own comment already said that
 * without mass data it "reduces to 1/sqrt(N), i.e. pure node count ... is NOT the real measure",
 * flagging the degraded form as massWeighted:false. We have never had mass data, nothing
 * downstream checked the flag, and the degraded form carried 25% of composite weight.
 *
 * Measured across all 20 domains: granularity equals 1/sqrt(scored_count) EXACTLY, 20 of 20,
 * correlation 1.0000. Economy reads 0.408 because we scored 6 companies; health reads 0.130
 * because we scored 59. That is arithmetic on our own sampling, published as a property of the
 * world. Same lesion class as the circular inference already cut: the system measuring itself.
 *
 * It was also numerically corrosive. updateCorrelation takes deviations from 0.5, so a frozen
 * channel has sd ~0.004, and every correlation involving it divides by that. It clears the 1e-12
 * guard, so nothing caught it.
 *
 * Weights renormalised 0.45/0.30 -> 0.60/0.40. Measured by replaying the full 201-sample history
 * per domain with the EWMA correlation threaded exactly as the worker threads it: mean delta
 * -0.0027, max |delta| 0.0550, and cross-domain rank churn IMPROVES from 6.0% to 5.5% per step.
 * An earlier estimate that used a fresh correlation matrix reported max 0.251 and a near-total
 * reshuffle; that was an artefact of not threading the state, and it was wrong.
 *
 * Granularity is still COMPUTED and still REPORTED under channels.granularity, now labelled as
 * the coverage statistic it is. Removing the number would hide it; removing its WEIGHT is the fix.
 */
/**
 * marketScore ADDED 2026-07-29. The two company channels are quarterly and the composite built
 * from them alone does not move: replayed against the forecaster's own 0.02 dead-band, 0% of
 * domains changed between consecutive samples. With marketScore in, 90% do. It is the only
 * channel in the system with both a real temporal history and a live daily update, and it is
 * supplied by the caller via opts.fastChannels since this module is pure over a company join.
 *
 * Weight 0.25 rather than more: it is one instrument among several and the company channels still
 * carry the kernel-scored distress this system exists to measure. A domain without it (religion,
 * whose basket is too thin) simply renormalises over what computed, as it always has.
 */
var CHANNEL_WEIGHTS = { distress: 0.45, unison: 0.30, marketScore: 0.25 };

var EWMA_LAMBDA = 0.93;      // CISS uses 0.93, fitted to a 5-dim IGARCH on the demeaned subindices.
var CDF_MIN_SAMPLE = 8;      // below this the CDF rank is too coarse to mean anything.

/**
 * Empirical CDF / order-statistic transform. Holló et al. Eq. (1a):
 *   z = r/n  for x_[r] <= x < x_[r+1];  z = 1 for x >= x_[n]
 * Ties take the average of the involved ranks. Output is unit-free, ordinal, bounded (0,1].
 * Returns null when the sample is too thin to rank against, so the caller can decide.
 */
function empiricalCdf(x, sample) {
  if (typeof x !== 'number' || !isFinite(x)) return null;
  if (!sample || sample.length < CDF_MIN_SAMPLE) return null;
  var s = sample.filter(function (v) { return typeof v === 'number' && isFinite(v); }).slice().sort(function (a, b) { return a - b; });
  if (s.length < CDF_MIN_SAMPLE) return null;
  var below = 0, equal = 0;
  for (var i = 0; i < s.length; i++) {
    if (s[i] < x) below++;
    else if (s[i] === x) equal++;
  }
  // Average rank across ties, then normalise. Floor at 1/n so the range is (0,1], never 0.
  var rank = below + (equal > 0 ? (equal + 1) / 2 : 0.5);
  return clamp01(Math.max(rank, 1) / s.length);
}

/**
 * CHANNEL 1 — LOW-SIDE DISTRESS. Mass-weighted share of the domain's scored nodes the kernel flags
 * STUCK. Phase-number-agnostic: P0-P10 is a developmental life-cycle where every phase is equal.
 * This channel records only failure-to-transition / perseveration. High-side runaway or premature
 * transition is a separate failure direction and is not represented by this channel.
 */
function channelDistress(companies) {
  var sum = 0, massTotal = 0, alerts = 0, stuck = 0, massWeighted = false;
  for (var i = 0; i < companies.length; i++) {
    var c = companies[i];
    var m = (typeof c.mass === 'number' && isFinite(c.mass) && c.mass > 0) ? c.mass : 1;
    if (m !== 1) massWeighted = true;
    var d = 0;
    if (c.alert === true) { d = 1; alerts++; }
    else if (c.trajectory && DISTRESS_TRAJ[String(c.trajectory).toUpperCase()]) {
      d = DISTRESS_TRAJ[String(c.trajectory).toUpperCase()];
      stuck++;
    }
    sum += d * m;
    massTotal += m;
  }
  return {
    value: massTotal > 0 ? clamp01(sum / massTotal) : 0,
    alerts: alerts, stuck: stuck, massWeighted: massWeighted
  };
}

/**
 * CHANNEL 2 — UNISON (the coupling channel). Herfindahl of the phase distribution: how far the
 * domain's nodes have collapsed into a single phase.
 *
 * This is the absorption-ratio idea (Kritzman, Li, Page & Rigobon 2011) in the only form the
 * available data supports. Their finding: a high absorption ratio means "the sources of risk are
 * more unified," which is market FRAGILITY — a shock propagates further when units are tightly
 * coupled. Every one of the 1% worst monthly drawdowns in their sample was preceded by an
 * absorption-ratio spike, and they are careful that this is a NEAR-NECESSARY, NOT SUFFICIENT
 * condition. Same caveat holds here.
 *
 * Normalised against the 1/k floor (perfectly dispersed across k observed phases) so the channel
 * reads 0 when nodes are maximally spread and 1 when they have all collapsed together.
 */
function channelUnison(companies) {
  var counts = {}, n = 0;
  for (var i = 0; i < companies.length; i++) {
    var p = companies[i].phase;
    if (!p) continue;
    counts[p] = (counts[p] || 0) + 1;
    n++;
  }
  var keys = Object.keys(counts);
  if (n === 0 || keys.length === 0) return { value: null, phases: 0 };
  if (keys.length === 1) return { value: 1, phases: 1, herfindahl: 1 };
  var h = 0;
  for (var k = 0; k < keys.length; k++) {
    var share = counts[keys[k]] / n;
    h += share * share;
  }
  var floor = 1 / keys.length;                       // maximally dispersed across observed phases
  return {
    value: clamp01((h - floor) / (1 - floor)),
    phases: keys.length, herfindahl: r3(h)
  };
}

/**
 * CHANNEL 3 — GRANULARITY. Gabaix's h = sqrt( Σ_i (S_i / ΣS)² ), the square root of the sales
 * Herfindahl (Gabaix 2011 eq. 5). A domain whose mass sits in a few nodes cannot diversify away
 * their idiosyncratic shocks — that is the granular-origins result, and it is a standing structural
 * fragility of the domain independent of whether anything is currently going wrong.
 *
 * With no mass data this reduces to 1/sqrt(N), i.e. pure node count, which is still meaningful (a
 * 4-node domain is granular-fragile against a 40-node one) but is NOT the real measure. Reported as
 * massWeighted:false so the degraded form is never mistaken for the real one.
 */
function channelGranularity(companies) {
  var masses = [], total = 0, massWeighted = false;
  for (var i = 0; i < companies.length; i++) {
    var m = (typeof companies[i].mass === 'number' && isFinite(companies[i].mass) && companies[i].mass > 0) ? companies[i].mass : 1;
    if (m !== 1) massWeighted = true;
    masses.push(m); total += m;
  }
  if (total <= 0 || masses.length === 0) return { value: null, massWeighted: false };
  var hh = 0;
  for (var j = 0; j < masses.length; j++) { var s = masses[j] / total; hh += s * s; }
  return { value: clamp01(Math.sqrt(hh)), herfindahl: r3(hh), n: masses.length, massWeighted: massWeighted };
}

/**
 * EWMA update of the channel correlation matrix. CISS Eq. (4), with subindices demeaned by their
 * THEORETICAL median of 0.5 rather than a sample mean (the inputs are CDF ranks, so 0.5 is the
 * known centre and no sample estimate is needed). The result is read as a time-varying rank
 * correlation: does channel i sit high in its own history at the same times channel j does.
 *
 * `prior` is the state returned by a previous call; pass null on cold start.
 */
function updateCorrelation(channelNames, values, prior) {
  var state = { cov: {}, var: {} };
  var i, j, a, b, key;
  for (i = 0; i < channelNames.length; i++) {
    a = channelNames[i];
    var da = values[a] - 0.5;
    var priorVar = (prior && prior.var && typeof prior.var[a] === 'number') ? prior.var[a] : da * da;
    state.var[a] = EWMA_LAMBDA * priorVar + (1 - EWMA_LAMBDA) * da * da;
    for (j = i + 1; j < channelNames.length; j++) {
      b = channelNames[j];
      key = a + '|' + b;
      var db = values[b] - 0.5;
      var priorCov = (prior && prior.cov && typeof prior.cov[key] === 'number') ? prior.cov[key] : da * db;
      state.cov[key] = EWMA_LAMBDA * priorCov + (1 - EWMA_LAMBDA) * da * db;
    }
  }
  // Build the correlation matrix from the updated moments.
  var C = {};
  for (i = 0; i < channelNames.length; i++) {
    a = channelNames[i];
    for (j = 0; j < channelNames.length; j++) {
      b = channelNames[j];
      if (i === j) { C[a + '|' + b] = 1; continue; }
      key = (i < j) ? (a + '|' + b) : (b + '|' + a);
      var sa = Math.sqrt(state.var[a]), sb = Math.sqrt(state.var[b]);
      var rho = (sa > 1e-12 && sb > 1e-12) ? (state.cov[key] / (sa * sb)) : 0;
      C[a + '|' + b] = Math.max(-1, Math.min(1, rho));
    }
  }
  return { state: state, C: C };
}

/**
 * compute(join, opts)
 *
 * opts.minScored   — abstain below this many kernel-scored companies (default 4)
 * opts.history     — { channelName: [prior raw values...] } for the CDF transform
 * opts.corrState   — EWMA state returned by a previous call (persist and pass back)
 * opts.weights     — override CHANNEL_WEIGHTS
 *
 * Returns { grounded, stress, stressVolEquivalent, channels, correlationLift, corrState, ... }.
 * `corrState` MUST be persisted by the caller and fed back in, or C stays at identity forever.
 */
function compute(join, opts) {
  opts = opts || {};
  var minScored = opts.minScored || 4;
  var weights = opts.weights || CHANNEL_WEIGHTS;
  var history = opts.history || {};
  var scored = (join && join.scored_count) || 0;

  if (!join || scored < minScored) {
    return {
      grounded: false, stress: null, scored: scored,
      reason: 'thin coverage (' + scored + ' scored < ' + minScored + ') — abstain (feed-stress fallback)'
    };
  }

  var companies = (join.companies || []).filter(function (c) { return c && c.scored; });
  if (companies.length === 0) {
    return { grounded: false, stress: null, scored: scored, reason: 'no scored companies in join — abstain' };
  }

  // ── 1. Raw channels ──────────────────────────────────────────────────────────────────────────
  var dist = channelDistress(companies);
  var uni = channelUnison(companies);
  var gran = channelGranularity(companies);

  // granularity is deliberately NOT in `raw`: it is a coverage statistic (1/sqrt(scored)), not a
  // reading about the domain, so it must not enter the weighted composite. It is still computed
  // and reported below. See CHANNEL_WEIGHTS above for the measurement.
  var raw = {};
  if (dist.value !== null) raw.distress = dist.value;
  if (uni.value !== null) raw.unison = uni.value;

  /**
   * FAST CHANNELS, passed in by the caller. THIS IS WHAT UNFREEZES THE COMPOSITE.
   *
   * distress and unison both derive from company fundamentals that update QUARTERLY. Measured
   * over the live store: distress changed 2 times in 4,380 samples, unison 42. The composite was
   * therefore built entirely out of channels that do not move, and every channel that does move
   * (marketScore 185 changes in 785, feed_* 910 in 1,991) sat outside it feeding only the phase
   * estimator.
   *
   * The consequence was not obvious because the composite has ~190 distinct values per domain: it
   * DRIFTS, just far too slowly. Replayed against the dead-band the forecaster actually uses,
   * ZERO PERCENT of domains moved more than 0.02 between consecutive samples. A slow drift and a
   * frozen line are the same thing to anything downstream that has a threshold.
   *
   * Adding marketScore takes that from 0% to 90% of domains moving. Note it also REDUCES distinct
   * values, 190 to 32 — which is why distinct-count was a misleading metric and movement past the
   * threshold is the honest one.
   *
   * Passed in rather than computed here because this module is pure over a company join and knows
   * nothing about market feeds; the worker already fetches them. Unknown keys are ignored, so a
   * caller cannot inject an arbitrary channel into the weighting by accident.
   */
  var extra = opts.fastChannels || null;
  if (extra) {
    for (var fk in CHANNEL_WEIGHTS) {
      if (!Object.prototype.hasOwnProperty.call(CHANNEL_WEIGHTS, fk)) continue;
      if (raw[fk] !== undefined) continue;                       // company channels win their own name
      var fv = extra[fk];
      if (typeof fv === 'number' && isFinite(fv)) raw[fk] = clamp01(fv);
    }
  }

  var names = Object.keys(raw);
  if (names.length === 0) {
    return { grounded: false, stress: null, scored: scored, reason: 'no computable channels — abstain' };
  }

  // ── 2. Empirical-CDF transform against each channel's own history ────────────────────────────
  // Where history is too thin to rank against, the raw value passes through UNTRANSFORMED and the
  // channel is flagged. This is the honest degradation: an untransformed channel is on a different
  // scale from a transformed one, and pretending otherwise is how a stress index lies.
  //
  // CROSS-SECTIONAL FALLBACK (2026-07-29). A temporal rank against a history that never moves is
  // not a rank, it is the constant (n+1)/2n. Measured: distress and unison record ONE distinct
  // value across 201 hourly samples in every domain, because they derive from company
  // fundamentals that update quarterly. Seven domains therefore published exactly 0.2524 forever,
  // and infrastructure at raw 0.000 and agriculture at raw 0.231 both reported "precisely median".
  //
  // The information was never missing. It is in the CROSS-SECTION: at this instant distress has
  // 17 distinct values across the 20 domains (range 0.000-0.231) and unison has 16. So when a
  // channel's own history is degenerate, rank it against its SIBLINGS instead of against itself.
  //
  // Deliberately a fallback, not a replacement. Where temporal history genuinely varies, temporal
  // ranking answers "is this domain unusual FOR ITSELF", which is the better question and the one
  // the CISS design intends. Cross-sectional answers "is this domain unusual FOR A DOMAIN", which
  // is only reached for when the first is unanswerable.
  //
  // KNOWN LIMIT, stated because it is real: scored_count ranges 6 to 59 across domains, a 9.8x
  // spread, so the siblings are not perfectly comparable. Measured corr(scored_count, distress)
  // = -0.338 and unison -0.348, i.e. modest, and the cross-domain spread exceeds two binomial
  // standard errors for 17 of 20 domains. It is defensible, not clean. `crossSectional:true` is
  // reported per channel so a consumer can tell which question was answered, and `smallSample`
  // marks the domains where the sibling comparison is weakest rather than hiding them.
  // BOTH RANKS ARE COMPUTED AND BOTH ARE REPORTED. The composite consumes one of them; a reader
  // can always see the other, and can see which question was answered.
  //
  //   zTemporal — "is this domain unusual FOR ITSELF." Absolute-ish: it detects a domain moving
  //               away from its own baseline, so it can register a system-wide crisis.
  //   zCross    — "is this domain unusual FOR A DOMAIN." Purely relative: someone is always near
  //               1.0 and someone always near 0.0, by construction. It discriminates ordering
  //               precisely and CANNOT tell a calm world from a burning one.
  //
  // Neither is correct in general and the composite does not pretend to settle it. The policy
  // here is narrow and defensible: prefer temporal, fall back to cross-sectional ONLY when the
  // domain's own history is degenerate and a temporal rank is therefore not a rank at all. Where
  // the fallback fires, crossSectional:true says so, so nothing downstream has to guess.
  //
  // The absolute signal is not lost by this. toBundle sends the estimator `companyDistress` built
  // from the RAW value with a phase likelihood, while the composite arrives separately as
  // distressComposite. Those are two paths carrying the two questions, and they already exist;
  // adding a third reading for the rank would double-count the same evidence.
  var xs = opts.crossSection || null;
  var s = {}, transformed = {}, crossSectional = {}, zTemporal = {}, zCross = {}, anyUntransformed = false;
  for (var n = 0; n < names.length; n++) {
    var nm = names[n];
    var z = empiricalCdf(raw[nm], history[nm]);
    var degenerate = distinctCount(history[nm]) < 2;      // a flat history cannot rank anything
    var zx = (xs && Array.isArray(xs[nm]) && distinctCount(xs[nm]) >= 2) ? empiricalCdf(raw[nm], xs[nm]) : null;
    zTemporal[nm] = z;
    zCross[nm] = zx;
    if (z !== null && !degenerate) {
      s[nm] = z; transformed[nm] = true; crossSectional[nm] = false;
    } else if (zx !== null) {
      s[nm] = zx; transformed[nm] = true; crossSectional[nm] = true;
    } else if (z !== null) {
      s[nm] = z; transformed[nm] = true; crossSectional[nm] = false;   // degenerate, no siblings: unchanged
    } else {
      s[nm] = raw[nm]; transformed[nm] = false; crossSectional[nm] = false; anyUntransformed = true;
    }
  }

  // ── 3. Correlation matrix (EWMA, CISS Eq. 4) ─────────────────────────────────────────────────
  var corr = updateCorrelation(names, s, opts.corrState);

  // ── 4. CISS aggregation: CISS = (w∘s)' C (w∘s) ───────────────────────────────────────────────
  // Weights renormalised over the channels that actually computed, so an absent channel does not
  // silently deflate the composite.
  var wsum = 0;
  for (var wi = 0; wi < names.length; wi++) wsum += (weights[names[wi]] || 0);
  if (wsum <= 0) wsum = 1;

  var ws = {};
  for (var k = 0; k < names.length; k++) {
    ws[names[k]] = ((weights[names[k]] || 0) / wsum) * s[names[k]];   // Hadamard product w∘s
  }

  var quad = 0, plainSum = 0;
  for (var a = 0; a < names.length; a++) {
    plainSum += ws[names[a]];
    for (var b = 0; b < names.length; b++) {
      quad += ws[names[a]] * (corr.C[names[a] + '|' + names[b]] || 0) * ws[names[b]];
    }
  }
  quad = Math.max(0, quad);                       // C can be indefinite from EWMA; stress is >= 0

  // The squared weighted average is the CISS upper bound, attained only at perfect correlation.
  // Reporting the gap makes the correlation's contribution legible instead of buried in one scalar.
  var upperBound = plainSum * plainSum;
  var correlationLift = upperBound > 1e-12 ? r3(quad / upperBound) : null;

  // Variance-equivalent (CISS's own preferred form — "more strongly differentiates between episodes
  // of stress and calmer periods") plus the volatility-equivalent square root, which is on the same
  // 0-1 footing as the feed-derived dsum.stress it is being compared against.
  var stressVar = clamp01(quad);
  var stressVol = clamp01(Math.sqrt(quad));

  return {
    grounded: true,
    stress: r3(stressVol),                        // 0-1, comparable to the feed-derived scale
    stressVarianceEquivalent: r3(stressVar),      // CISS's preferred, sharper form
    scored: scored,
    channels: {
      // crossSectional says WHICH question this channel's rank answered: false = "unusual for
      // itself" (temporal), true = "unusual for a domain" (ranked against siblings because its own
      // history was flat). A consumer that cannot tell the two apart cannot interpret the number.
      // raw = the absolute reading. rankTemporal = "unusual for itself" (null when its own history
      // cannot rank). rankCross = "unusual for a domain". `used` names which one the composite
      // consumed. Reporting all three is the point: the relative-vs-absolute question is answered
      // by whoever reads this, not silently by whichever transform happened to fire.
      distress: dist.value === null ? null : { raw: r3(dist.value), transformed: transformed.distress === true,
        rankTemporal: zTemporal.distress === null ? null : r3(zTemporal.distress),
        rankCross: zCross.distress === null ? null : r3(zCross.distress),
        used: crossSectional.distress === true ? 'cross-sectional' : 'temporal',
        crossSectional: crossSectional.distress === true, alerts: dist.alerts, stuck: dist.stuck },
      unison: uni.value === null ? null : { raw: r3(uni.value), transformed: transformed.unison === true,
        rankTemporal: zTemporal.unison === null ? null : r3(zTemporal.unison),
        rankCross: zCross.unison === null ? null : r3(zCross.unison),
        used: crossSectional.unison === true ? 'cross-sectional' : 'temporal',
        crossSectional: crossSectional.unison === true, phases: uni.phases, herfindahl: uni.herfindahl },
      // REPORTED BUT NOT WEIGHTED since 2026-07-29. Labelled for what it is: without mass data
      // this is 1/sqrt(scored), a coverage statistic, and it is kept visible rather than deleted
      // so its absence from the composite is auditable instead of silent.
      granularity: gran.value === null ? null : { raw: r3(gran.value), weighted: false, role: 'coverage', massWeighted: gran.massWeighted === true, n: gran.n, herfindahl: gran.herfindahl },
      // The fast channel, reported like any other. Without this the composite would move for a
      // reason the payload never states, which is the failure this file keeps correcting.
      marketScore: (raw.marketScore === undefined) ? null : { raw: r3(raw.marketScore), weighted: true,
        role: 'fast', supplied: true, transformed: transformed.marketScore === true,
        rankTemporal: zTemporal.marketScore === null || zTemporal.marketScore === undefined ? null : r3(zTemporal.marketScore),
        used: crossSectional.marketScore === true ? 'cross-sectional' : 'temporal' }
    },
    correlationLift: correlationLift,             // quad / upperBound — 1.0 means fully co-moving
    corrState: corr.state,                        // PERSIST THIS and pass back as opts.corrState
    massWeighted: dist.massWeighted || gran.massWeighted,
    // Legacy fields kept so existing consoles reading v1 output do not break.
    alerts: dist.alerts, stuckTrajectory: dist.stuck, distressed: dist.alerts + dist.stuck,
    coverage: (typeof join.coverage === 'number') ? r3(join.coverage) : null,
    degraded: (anyUntransformed || !(dist.massWeighted || gran.massWeighted)) ? {
      untransformedChannels: anyUntransformed,    // history too thin for a CDF rank
      massWeighted: dist.massWeighted || gran.massWeighted,
      note: 'Channels without sufficient history pass through raw (different scale). Mass weighting is off until COMPANY_REGISTRY carries a size field; equal weights are a documented ~1.6pt approximation (Illing & Liu 2006), not a free pass.'
    } : null,
    note: 'CISS-style composite (Holló/Kremer/Lo Duca 2012 ECB WP 1426): channels -> empirical-CDF -> (w∘s)\' C (w∘s) with EWMA(0.93) correlation. Only reads as stressed when channels CO-MOVE; a plain average is the upper bound, hit only at perfect correlation. Kernel distress is ONE channel, weighted when it fires, never the whole read. Contemporaneous, not predictive; ordinal within a vintage.'
  };
}

// ── ADAPTER B (PHASE_ESTIMATOR_SPEC.md §5) ──────────────────────────────────────────────────────
// Turn the domain's node state into a ChannelBundle for lib/phase-estimator.js. The CISS composite
// computed above becomes the estimator's within-phase SEVERITY (distressComposite → stuck); the
// distress channel additionally carries a PHASE-SIGNATURE (which phases its reading is consistent
// with). Person and market thereby become two channel-sets on the same estimator core.

// Map a domain distress reading d∈[0,1] to a phase likelihood over P0..P10. The "rupture band"
// (P3 Darkness, P7 Separation, P9 Threshold) gains mass as distress rises; the constructive band
// (P1 Light, P2 Rhythm, P4 Peace, P6 Order, P10 Resurrection) holds it when distress is low.
// STATED PRIOR [mark: prior] — the band assignment is convention (canonical Light→Resurrection
// register), NOT validated against a labeled benchmark. Do not present as derived.
function distressBandLikelihood(d) {
  d = clamp01(d);
  //             P0    P1    P2   P3   P4    P5   P6   P7   P8   P9   P10
  var calm =    [0,   0.20, 0.20, 0,  0.25,  0,  0.20, 0,   0,   0,  0.15];
  var rupture = [0,    0,    0,  0.40, 0,    0,   0,  0.30, 0,  0.30, 0  ];
  var L = new Array(11), s = 0, floor = 0.01, i;
  for (i = 0; i < 11; i++) { L[i] = (1 - d) * calm[i] + d * rupture[i] + floor; s += L[i]; }
  for (i = 0; i < 11; i++) L[i] /= s;
  return L;
}

// toBundle(join, opts) → ChannelBundle consumable by phase-estimator.estimate(). Reuses compute();
// abstains exactly when compute() abstains (thin coverage), so the estimator inherits the same
// no-false-number contract. unison/granularity are emitted as structural context channels with a
// NULL likelihood — they are coupling/fragility signals, not phase detectors, so they must not
// claim phase content they do not carry; their severity flows through distressComposite instead.
/**
 * rawChannels(join) — the untransformed distress/unison for ONE domain, or null if it would
 * abstain. Exists so a caller can take a cheap first pass over every domain and assemble the
 * sibling sample the cross-sectional fallback ranks against, without running the whole composite
 * twice. Same abstain rules as compute(), so a domain that cannot be scored also cannot pollute
 * the cross-section with a fabricated value.
 */
function rawChannels(join) {
  var minScored = 4;
  var scored = (join && join.scored_count) || 0;
  if (!join || scored < minScored) return null;
  var companies = (join.companies || []).filter(function (c) { return c && c.scored; });
  if (companies.length === 0) return null;
  var d = channelDistress(companies), u = channelUnison(companies);
  var out = {};
  if (d.value !== null) out.distress = d.value;
  if (u.value !== null) out.unison = u.value;
  out.scored = scored;
  return out;
}

/**
 * buildCrossSection(joinsByDomain) — { distress: [...], unison: [...] }, one entry per domain
 * that can be scored. This is the sibling sample. Note it is deliberately UNWEIGHTED by
 * scored_count: a domain with 6 companies and one with 59 each contribute exactly one value,
 * which is the honest treatment given corr(scored_count, distress) is only -0.338. Weighting by
 * coverage would reintroduce the very artefact granularity was removed for.
 */
function buildCrossSection(joinsByDomain) {
  var xs = { distress: [], unison: [] };
  for (var d in joinsByDomain) {
    if (!Object.prototype.hasOwnProperty.call(joinsByDomain, d)) continue;
    var rc = rawChannels(joinsByDomain[d]);
    if (!rc) continue;
    if (typeof rc.distress === 'number') xs.distress.push(rc.distress);
    if (typeof rc.unison === 'number') xs.unison.push(rc.unison);
  }
  return xs;
}

function toBundle(join, opts) {
  opts = opts || {};
  var gs = compute(join, opts);
  if (!gs.grounded) {
    return { substrate: 'domain', subjectId: opts.subjectId || null, grounded: false, reason: gs.reason, readings: [] };
  }
  var dRaw = gs.channels.distress ? gs.channels.distress.raw : 0;
  var readings = [
    { key: 'companyDistress', value: dRaw, likelihood: distressBandLikelihood(dRaw) }
  ];
  if (gs.channels.unison) readings.push({ key: 'unison', value: gs.channels.unison.raw, likelihood: null });
  // granularity is NOT sent to the estimator any more. It is a coverage statistic, not a reading
  // about the domain. It was already inert there (likelihood:null is a no-op after softmax, and
  // null-likelihood channels are excluded from the precision machinery by the 2026-07-20 fix), so
  // dropping it changes no belief; it removes a coverage number from a list of world-observations
  // where it never belonged.
  return {
    substrate: 'domain',
    subjectId: opts.subjectId || null,
    grounded: true,
    readings: readings,
    distressComposite: gs.stressVarianceEquivalent,   // CISS variance-equivalent = within-phase severity
    composite: gs                                     // full CISS output, for reference/consoles
  };
}

module.exports = {
  compute: compute,
  toBundle: toBundle,
  distressBandLikelihood: distressBandLikelihood,
  DISTRESS_TRAJ: DISTRESS_TRAJ,
  CHANNEL_WEIGHTS: CHANNEL_WEIGHTS,
  EWMA_LAMBDA: EWMA_LAMBDA,
  // exported for testing
  empiricalCdf: empiricalCdf,
  distinctCount: distinctCount,
  rawChannels: rawChannels,
  buildCrossSection: buildCrossSection,
  channelDistress: channelDistress,
  channelUnison: channelUnison,
  channelGranularity: channelGranularity,
  updateCorrelation: updateCorrelation
};
