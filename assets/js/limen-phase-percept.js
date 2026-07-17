// ═══════════════════════════════════════════════════════════════════
// limen-phase-percept.js — the domain phase as an INFERENCE, not a guess.
//
// Predictive coding, one layer up from the stress trajectory: the domain's
// reported phase is a PERCEPT = a generative model's PRIOR (what the brain
// expects the phase to be) corrected by EVIDENCE (the kernel-scored phases
// of the domain's own company nodes) in proportion to PRECISION (how much
// real evidence actually exists).
//
//   posterior ∝ prior corrected by precision·(evidence − prior)
//
// CAUSAL DIRECTION (load-bearing, per the active-inference resolution):
//   The companies' kernel-scored phases are the mind-independent external
//   world here — audited financials the brain does NOT invent. Evidence
//   flows UP (nodes → brain) to GROUND the percept. The prior is top-down
//   expectation and, in a fuller build, would also set PRECISION (how much
//   to trust the evidence) — but it NEVER originates a node's phase. The
//   real financial state stays upstream of the brain's belief about it.
//
// THE HONEST PAYOFF (why this fixes the "says nothing" problem without
// re-introducing confabulation): under weak evidence precision → 0, so the
// posterior stays at the prior but is flagged UNGROUNDED — the percept
// abstains instead of fabricating. A domain with scored nodes speaks with
// grounded confidence; a domain with none stays honestly silent. That kills
// "SOURCE everywhere" without minting "confident everywhere".
//
// THE SIGNAL: when grounded node evidence DISAGREES with the prior, that is
// prediction error — the one genuinely informative event. It is surfaced
// explicitly (salience:'grounded-divergent') so the reader can act on the
// mismatch, not on the agreement.
//
// SHADOW: this only computes a would-be phase next to the live one. It
// returns a reading; it changes no live path. Pure deterministic math, no
// network, no AI, no Date.now in the core. Dual export: window.LIMENPHASE +
// module.exports.
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  var VERSION = 1;
  var K_SAT = 3;        // half-saturation: precision from count reaches 0.5 at K_SAT scored nodes
  var W_FLOOR = 0.15;   // precision below this ⇒ ungrounded (percept abstains)
  var MIN_SCORED = 2;   // fewer than this many scored nodes ⇒ ungrounded regardless of peakedness

  // Ordinal position of each phase on the P0–P10 arc (p7 splits a/b). Used ONLY
  // to give prediction-error a magnitude ("evidence says p3, prior said p2" is a
  // small error; "p3 vs p9" is large). Unknown labels fall back to categorical.
  var PHASE_ORDER = { p0: 0, p1: 1, p2: 2, p3: 3, p4: 4, p5: 5, p6: 6, p7: 7, p7a: 7, p7b: 7.5, p8: 8, p9: 9, p10: 10 };
  var ORDER_SPAN = 10;

  var VALID_PHASE = /^p(10|[0-9])(a|b)?$/;   // real P0–P10 tokens only (p7a/p7b allowed)

  function clamp01(x) { x = Number(x); return isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function norm(p) { return String(p == null ? '' : p).toLowerCase(); }
  function isValidPhase(p) { return VALID_PHASE.test(norm(p)); }   // excludes 'ERROR','UNKNOWN', empty, etc.

  // Build a normalized categorical distribution from a list of phase labels.
  function histogram(phases) {
    var d = {}, n = phases.length;
    for (var i = 0; i < n; i++) { var p = norm(phases[i]); if (!p) continue; d[p] = (d[p] || 0) + 1; }
    var tot = 0, k; for (k in d) if (d.hasOwnProperty(k)) tot += d[k];
    if (tot > 0) for (k in d) if (d.hasOwnProperty(k)) d[k] = d[k] / tot;
    return d;
  }

  function argmax(dist) {
    var best = null, bv = -Infinity;
    for (var k in dist) if (dist.hasOwnProperty(k) && dist[k] > bv) { bv = dist[k]; best = k; }
    return best;
  }

  function expectedOrder(dist) {
    var num = 0, den = 0;
    for (var k in dist) {
      if (!dist.hasOwnProperty(k)) continue;
      if (typeof PHASE_ORDER[k] !== 'number') return null;   // any unknown label ⇒ ordinal undefined
      num += PHASE_ORDER[k] * dist[k]; den += dist[k];
    }
    return den > 0 ? num / den : null;
  }

  // companies: [{ phase, scored }]  (state.companies as populated from domainCompanyJoin)
  // prior:     { phase, source }    (the brain's expected phase = top-down generative model)
  function computePercept(prior, companies) {
    prior = prior || {};
    var priorPhase = norm(prior.phase) || 'p0';
    var list = Array.isArray(companies) ? companies : [];

    // EVIDENCE — only genuinely kernel-scored nodes with a REAL phase token count.
    // A scored node whose phase is 'ERROR'/'UNKNOWN' is a scoring failure, not
    // evidence; it is excluded (counted separately for transparency) so a broken
    // score never pollutes the percept.
    var scoredPhases = [], invalid = 0;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || c.scored !== true || typeof c.phase !== 'string' || !c.phase) continue;
      if (isValidPhase(c.phase)) scoredPhases.push(c.phase);
      else invalid++;
    }
    var scored = scoredPhases.length;
    var mapped = list.length;
    var coverage = mapped > 0 ? scored / mapped : 0;
    var likelihood = histogram(scoredPhases);

    // PRECISION — how much to let evidence move the percept off the prior.
    // Saturating in count (Hill, K_SAT) × coverage. Zero scored ⇒ w=0 ⇒ pure prior.
    var w = clamp01(coverage * (scored / (scored + K_SAT)));

    // POSTERIOR — precision-weighted blend of prior (delta on priorPhase) and evidence.
    var support = {}; support[priorPhase] = true;
    for (var k in likelihood) if (likelihood.hasOwnProperty(k)) support[k] = true;
    var posterior = {};
    for (var p in support) {
      if (!support.hasOwnProperty(p)) continue;
      var pr = (p === priorPhase) ? 1 : 0;
      posterior[p] = (1 - w) * pr + w * (likelihood[p] || 0);
    }
    var winner = argmax(posterior) || priorPhase;
    var confidence = clamp01(posterior[winner] || 0);

    // PREDICTION ERROR — evidence-vs-prior mismatch, with an ordinal magnitude
    // when phases are known. This is the signal; precision-weighted, it is how
    // far the percept SHOULD move.
    var evExpOrder = expectedOrder(likelihood);
    var priorOrder = (typeof PHASE_ORDER[priorPhase] === 'number') ? PHASE_ORDER[priorPhase] : null;
    var errorMagnitude = null;
    if (scored > 0) {
      if (evExpOrder !== null && priorOrder !== null) errorMagnitude = clamp01(Math.abs(evExpOrder - priorOrder) / ORDER_SPAN);
      else errorMagnitude = clamp01(1 - (likelihood[priorPhase] || 0));   // categorical fallback: mass off the prior
    }
    var weightedError = (errorMagnitude === null) ? null : r4(w * errorMagnitude);

    var grounded = (w >= W_FLOOR) && (scored >= MIN_SCORED);
    var groundedPhase = grounded ? winner : priorPhase;
    var divergent = grounded && (winner !== priorPhase);
    var salience = !grounded ? 'prior-only (ungrounded)' : (divergent ? 'grounded-divergent' : 'grounded-aligned');

    return {
      version: VERSION,
      mode: 'shadow',
      prior: { phase: priorPhase, source: prior.source || 'unknown' },
      evidence: {
        scored: scored, mapped: mapped, coverage: r4(coverage), invalidScored: invalid,
        distribution: (function () { var o = {}; for (var kk in likelihood) o[kk] = r4(likelihood[kk]); return o; })(),
        topPhase: scored ? argmax(likelihood) : null
      },
      precision: r4(w),
      posterior: { distribution: (function () { var o = {}; for (var kk in posterior) o[kk] = r4(posterior[kk]); return o; })(), phase: winner, confidence: r4(confidence) },
      predictionError: { magnitude: (errorMagnitude === null ? null : r4(errorMagnitude)), weighted: weightedError,
        note: 'evidence-vs-prior mismatch; precision-weighted = how far the percept should move' },
      grounded: grounded,
      groundedPhase: groundedPhase,     // what the domain phase WOULD be, grounded in node evidence
      divergent: divergent,             // grounded evidence disagrees with the prior = the informative case
      salience: salience,
      note: grounded
        ? 'GROUNDED: domain phase inferred from ' + scored + ' kernel-scored node(s), precision ' + r4(w) + (divergent ? ' — DIVERGES from prior (prediction error)' : ' — aligns with prior')
        : 'UNGROUNDED: only ' + scored + ' scored node(s) (precision ' + r4(w) + ' < floor) — percept abstains, holds the prior; NOT a fabricated phase'
    };
  }

  var API = { computePercept: computePercept, PHASE_ORDER: PHASE_ORDER,
    W_FLOOR: W_FLOOR, MIN_SCORED: MIN_SCORED, K_SAT: K_SAT, version: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LIMENPHASE = API;
})(typeof window !== 'undefined' ? window : this);
