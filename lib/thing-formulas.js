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

// Legacy financial-institution classifier for the old command-board row shape.
// DISPLAY/DIAGNOSTIC ONLY. It is not Thing 0 qualification evidence and must
// not grant or remove Thing 1 authority (see thing0Eligible).
function isFinancialSIC(sic) { var n = parseInt(sic, 10); return n >= 6000 && n < 6800; }

// ═══════════════════════════════════════════════════════════════════════════
// FORMULA BLOCK — swap these three bodies when a better/validated formula exists.
// Inputs: c = a company row {t,d,hist,q,vs,ds,a,p,tr,sic?}; domainStats = {degenerate}.
// ═══════════════════════════════════════════════════════════════════════════

function _thing0Evidence(c) {
  // A refreshed scorer snapshot carries the authoritative Thing 0 object.
  // Accept both the API's snake_case object and a camelCase snapshot alias.
  if (!c) return null;
  var t0 = c.thing0 || c.thing0Eligibility
    || (c.real && (c.real.thing0 || c.real.thing0Eligibility))
    || null;
  return (t0 && typeof t0 === 'object') ? t0 : null;
}

function _thing0Status(t0) {
  return t0.qualification_status || t0.qualificationStatus || null;
}

// ── THING 0 — qualification. Must run before Thing 1. ──────────────────────
// Qualification comes ONLY from a scorer-produced Thing 0 object. Legacy
// c.real fields — including c.real.inEnvelope — are Thing 1 output and are
// NOT qualification evidence. Without Thing 0 evidence a row stays visible as
// legacy/interpretive but is not eligible for Thing 1 or action authority.
function thing0Eligible(c) {
  if (!c || !c.t) return { eligible: false, reason: 'no-ticker' };
  var t0 = _thing0Evidence(c);
  if (t0) {
    var permits = t0.permits_thing1_use === true || t0.permitsThing1Use === true;
    var status = _thing0Status(t0);
    if (permits && status === 'qualified') {
      return {
        eligible: true,
        reason: 'thing0-qualified',
        qualification_status: status,
        sector_rule: t0.sector_rule || t0.sectorRule || null
      };
    }
    return {
      eligible: false,
      reason: status || 'thing0-not-qualified',
      qualification_status: status || 'not_qualified',
      sector_rule: t0.sector_rule || t0.sectorRule || null
    };
  }
  return {
    eligible: false,
    reason: 'thing0-evidence-unavailable',
    qualification_status: 'unavailable',
    // Legacy fields remain visible for diagnosis, without authority.
    legacy: {
      thing1_snapshot_present: !!c.real,
      thing1_snapshot_in_envelope: !!(c.real && c.real.inEnvelope),
      command_board_history: (c.hist === undefined ? null : c.hist),
      command_board_validation: c.vs || null,
      legacy_financial_sic: isFinancialSIC(c.sic)
    }
  };
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
