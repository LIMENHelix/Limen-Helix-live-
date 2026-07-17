/**
 * lib/phase-percept.js — server-side canonical of the node-grounded phase percept.
 *
 * VENDORED into lib/ (not required from assets/**) per the standing rule: a bad
 * top-level require in a handler crashes all /api/* at cold start. This is pure
 * math, no browser globals, no network. It MIRRORS assets/js/limen-phase-percept.js
 * (the browser copy the domain brains use); scripts/test-phase-percept-mirror.js
 * asserts the two produce identical output so they cannot drift.
 *
 * The domain phase as an INFERENCE: prior (top-down expectation) corrected by
 * evidence (the domain's kernel-scored company-node phases) in proportion to
 * precision (how much real evidence exists). Under thin evidence it ABSTAINS
 * (holds the prior, grounded:false) rather than fabricate. Evidence flows
 * nodes -> brain only. See the browser copy's header for the full rationale.
 */

var VERSION = 1;
var K_SAT = 3;
var W_FLOOR = 0.15;
var MIN_SCORED = 2;

var PHASE_ORDER = { p0: 0, p1: 1, p2: 2, p3: 3, p4: 4, p5: 5, p6: 6, p7: 7, p7a: 7, p7b: 7.5, p8: 8, p9: 9, p10: 10 };
var ORDER_SPAN = 10;
var VALID_PHASE = /^p(10|[0-9])(a|b)?$/;

// Canonical P0–P10 recursion-arc register (matches domain-console-brain.js + energy-brain.js).
var PHASE_LABELS = { p0: 'SOURCE', p1: 'RUPTURE', p2: 'RHYTHM', p3: 'INSTABILITY', p4: 'STABILISATION',
  p5: 'ENDURANCE', p6: 'ORDER', p7: 'DIVERGENCE', p7a: 'TERMINAL', p7b: 'SEPARATION', p8: 'PIVOT', p9: 'COLLAPSE', p10: 'RESURRECTION' };

function clamp01(x) { x = Number(x); return isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; }
function r4(x) { return Math.round(x * 10000) / 10000; }
function norm(p) { return String(p == null ? '' : p).toLowerCase(); }
function isValidPhase(p) { return VALID_PHASE.test(norm(p)); }
function labelFor(p) { return PHASE_LABELS[norm(p)] || null; }

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
    if (typeof PHASE_ORDER[k] !== 'number') return null;
    num += PHASE_ORDER[k] * dist[k]; den += dist[k];
  }
  return den > 0 ? num / den : null;
}

// prior: { phase, source }  companies: [{ phase, scored }]
function computePercept(prior, companies) {
  prior = prior || {};
  var priorPhase = norm(prior.phase) || 'p0';
  var list = Array.isArray(companies) ? companies : [];

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

  var w = clamp01(coverage * (scored / (scored + K_SAT)));

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

  var evExpOrder = expectedOrder(likelihood);
  var priorOrder = (typeof PHASE_ORDER[priorPhase] === 'number') ? PHASE_ORDER[priorPhase] : null;
  var errorMagnitude = null;
  if (scored > 0) {
    if (evExpOrder !== null && priorOrder !== null) errorMagnitude = clamp01(Math.abs(evExpOrder - priorOrder) / ORDER_SPAN);
    else errorMagnitude = clamp01(1 - (likelihood[priorPhase] || 0));
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
    groundedPhase: groundedPhase,
    divergent: divergent,
    salience: salience,
    note: grounded
      ? 'GROUNDED: domain phase inferred from ' + scored + ' kernel-scored node(s), precision ' + r4(w) + (divergent ? ' — DIVERGES from prior (prediction error)' : ' — aligns with prior')
      : 'UNGROUNDED: only ' + scored + ' scored node(s) (precision ' + r4(w) + ' < floor) — percept abstains, holds the prior; NOT a fabricated phase'
  };
}

module.exports = { computePercept: computePercept, labelFor: labelFor, PHASE_LABELS: PHASE_LABELS,
  PHASE_ORDER: PHASE_ORDER, W_FLOOR: W_FLOOR, MIN_SCORED: MIN_SCORED, K_SAT: K_SAT, version: VERSION };
