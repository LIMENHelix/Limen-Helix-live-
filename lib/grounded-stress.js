/**
 * lib/grounded-stress.js — SHADOW candidate: derive a domain's stress from the actual node/business
 * state (kernel-scored company phases), NOT from feed activity/article counts.
 *
 * Rationale (operator, 2026-07-18): feeds are reference + opportunity-discovery, NOT the stress creator.
 * Stress/distress should be a read of the real businesses/nodes — exactly how `phase` is already grounded
 * in the worker (limen-worker-snapshot). This computes the missing grounded STRESS magnitude the same way.
 *
 * Source = domainCompanyJoin (already built by lib/company-phase-scorer): per-domain kernel aggregates
 * (p7a/p7b/p3 counts, scored_count) + per-company { phase, trajectory, alert }. The kernel's own `alert`
 * flag and distress trajectories (UNRECOVERED_P3, RUPTURE) are the distress markers — a high phase number
 * alone is NOT distress (p8-RECOVERED is fine; p8-UNRECOVERED_P3 is not).
 *
 * ABSTAINS on thin coverage (like the phase percept), so a domain with few scored companies is never
 * given a false grounded number. Pure: no Redis/Date. The weights are a STATED first-pass, not derived.
 */

function r3(x) { return Math.round(x * 1000) / 1000; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// Distress trajectories the kernel emits (besides the explicit alert flag).
var DISTRESS_TRAJ = { UNRECOVERED_P3: 1, RUPTURE: 1, UNRECOVERED: 0.8, STUCK: 0.8 };

function compute(join, opts) {
  opts = opts || {};
  var minScored = opts.minScored || 4;
  var scored = (join && join.scored_count) || 0;
  if (!join || scored < minScored) {
    return { grounded: false, stress: null, scored: scored, reason: 'thin coverage (' + scored + ' scored < ' + minScored + ') — abstain (feed-stress fallback)' };
  }
  var companies = (join.companies || []).filter(function (c) { return c && c.scored; });
  // per-company distress in [0,1]: kernel alert flag OR a distress trajectory
  var sum = 0, alerts = 0;
  companies.forEach(function (c) {
    var d = 0;
    if (c.alert === true) { d = 1; alerts++; }
    else if (c.trajectory && DISTRESS_TRAJ[String(c.trajectory).toUpperCase()]) d = DISTRESS_TRAJ[String(c.trajectory).toUpperCase()];
    sum += d;
  });
  var alertShare = companies.length ? sum / companies.length : 0;

  // structural distress from the kernel's phase-count aggregates (terminal weighted over instability)
  var p7a = join.p7a_count || 0, p7b = join.p7b_count || 0, p3 = join.p3_count || 0;
  var structural = clamp01((p7a * 1.0 + p7b * 1.0 + p3 * 0.6) / scored);

  // blend: the direct alert share and the structural phase-count read agree in the clear cases
  var stress = clamp01(0.6 * alertShare + 0.4 * structural);

  return {
    grounded: true, stress: r3(stress), scored: scored,
    alerts: alerts, alertShare: r3(alertShare), structural: r3(structural),
    p7a: p7a, p7b: p7b, p3: p3, coverage: (typeof join.coverage === 'number') ? r3(join.coverage) : null,
    note: 'node-grounded from kernel-scored companies (alert flag + distress trajectories + p7a/p7b/p3 counts); weights are a stated first-pass'
  };
}

module.exports = { compute: compute, DISTRESS_TRAJ: DISTRESS_TRAJ };
