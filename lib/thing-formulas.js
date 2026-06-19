/**
 * lib/thing-formulas.js — THE SWAPPABLE FORMULA LAYER for the Thing pipeline.
 *
 * This is the ONE place the per-company scoring formulas live. The wiring around
 * it (the publish gate handlers/brain-signals.js, and eventually each domain brain)
 * does NOT change — to upgrade the math, replace the function BODIES below and bump
 * FORMULA_VERSION. Same contract, every domain, one swap.
 *
 * Pipeline (see memory thing-taxonomy-t0-t3):
 *   Thing 0  eligibility gate  → can this company get a validated verdict?
 *   Thing 1  validated distress → {ds,band,validated} or null (ABSTAIN — no fake scores)
 *   Thing 2  interpretive phase → {phase,...} (NEVER validated, NEVER alerts)
 *
 * HONEST DEFAULT (2026-06-19): command-board-data `ds` is currently a per-domain
 * DEFAULT (degenerate), so Thing 1 ABSTAINS rather than publish a fake per-company
 * score. When real per-company scoring lands (rescoring project), swap thing1Distress
 * to read the real validated output — nothing else changes, and the gate opens itself.
 */

var FORMULA_VERSION = '2026-06-19-live-kernel';

// Financial-institution SIC range — Altman Z'' does NOT transfer (banks/insurers/brokers).
function isFinancialSIC(sic) { var n = parseInt(sic, 10); return n >= 6000 && n < 6800; }

// ═══════════════════════════════════════════════════════════════════════════
// FORMULA BLOCK — swap these three bodies when a better/validated formula exists.
// Inputs: c = a company row {t,d,hist,q,vs,ds,a,p,tr,sic?}; domainStats = {degenerate}.
// ═══════════════════════════════════════════════════════════════════════════

// ── THING 0 — eligibility / envelope (mirror of the kernel's assess_envelope) ──
function thing0Eligible(c) {
  if (!c || !c.t) return { eligible: false, reason: 'no-ticker' };
  // REAL live-kernel score present → trust its envelope verdict.
  if (c.real) {
    if (c.real.error) return { eligible: false, reason: 'scoring-error' };
    if (c.real.isFinancial) return { eligible: false, reason: 'financial-institution' };
    if (!c.real.inEnvelope) return { eligible: false, reason: 'out-of-envelope' };
    return { eligible: true, reason: 'ok' };
  }
  // Fallback (no real score): coarse command-board envelope check.
  if (c.vs === 'error') return { eligible: false, reason: 'scoring-error' };
  if (!(c.hist >= 8)) return { eligible: false, reason: 'insufficient-history' };
  if (c.sic && isFinancialSIC(c.sic)) return { eligible: false, reason: 'financial-institution' };
  return { eligible: true, reason: 'ok' };
}

// ── THING 1 — validated distress. Returns a signal, or null to ABSTAIN. ──
function thing1Distress(c, domainStats) {
  // PREFER the real live-kernel score (api/limen/score). alert is the validated
  // classification; composite is descriptive. Only publish in-envelope + validated.
  if (c.real && typeof c.real.composite === 'number') {
    if (c.real.error || c.real.isFinancial || !c.real.inEnvelope || !c.real.validated) return null;
    var rband = c.real.alert ? 'elevated' : c.real.composite >= 0.66 ? 'moderate' : 'low';
    return { score: Math.round(c.real.composite * 1000) / 1000, band: rband, alert: !!c.real.alert, validated: true, asOf: c.real.firstAlertQuarter || null };
  }
  // No real score: never fabricate from the degenerate command-board ds → abstain.
  if (domainStats && domainStats.degenerate) return null;
  if (typeof c.ds !== 'number' || c.vs !== 'validated') return null;
  var band = c.ds >= 0.66 ? 'elevated' : c.ds >= 0.40 ? 'moderate' : 'low';
  return { score: Math.round(c.ds * 100) / 100, band: band, alert: !!c.a, validated: true, asOf: c.q };
}

// ── THING 2 — interpretive phase. NEVER validated, NEVER alerts. ──
function thing2Phase(c) {
  if (!c || !c.p) return null;
  return { phase: c.p, trend: c.tr || null, interpretiveOnly: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// END FORMULA BLOCK
// ═══════════════════════════════════════════════════════════════════════════

// Degeneracy detector (a domain-level default ⇒ not a real per-company score).
function isDegenerate(dsValues) {
  var ds = dsValues.filter(function (x) { return typeof x === 'number'; });
  if (ds.length <= 2) return false;
  var uniq = {}; ds.forEach(function (x) { uniq[x.toFixed(3)] = 1; });
  var n = Object.keys(uniq).length;
  return n <= 2 || (n / ds.length) < 0.15;
}

module.exports = {
  FORMULA_VERSION: FORMULA_VERSION,
  thing0Eligible: thing0Eligible,
  thing1Distress: thing1Distress,
  thing2Phase: thing2Phase,
  isDegenerate: isDegenerate
};
