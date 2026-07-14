// ═══════════════════════════════════════════════════════════════════
// limen-k4-selfconsistency.js — the ONE honest K4 credit-assignment rule.
//
// THE PROBLEM IT FIXES: the domains had no external ground-truth reward
// (no dopaminergic outcome label). A thing2 P3/P7 phase transition is
// INTERPRETIVE (validated:false), so treating it as "ground-truth reward"
// is an overclaim. Only a genuine EXTERNAL realized outcome (e.g. Thing1's
// validated distress for Finance) is true reward.
//
// THE RULE (central, so it cannot be re-overclaimed inconsistently):
//   - isReward = true ONLY when a real external realized-outcome label is
//     supplied (externalOutcome). That is the only path labeled 'reward'.
//   - EVERYTHING else — phase-transition consistency, call hit-rate, stress
//     self-prediction — is SELF-CONSISTENCY CALIBRATION (interpretive). It
//     can modulate K4 learning, but it is NEVER reward and NEVER ground-truth.
//
// PREEMPTION ORDER (which signal teaches K4): external-reward (tier 4) >
//   phase-consistency (3) > call-consistency (2) > stress-consistency (1) > none.
//   Tiers 1-3 are all self-consistency; only tier 4 is external reward.
//
// Pure deterministic math. No network, no AI. Dual export: window.LIMENK4
// (classic script, synchronous) + module.exports (node tests).
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';
  function clamp01(x) { x = Number(x); return isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; }

  // sig fields (all optional):
  //   externalOutcome:  { hit: 0..1 } | null   — a REAL external realized outcome (Finance/Thing1). ONLY this is reward.
  //   phaseValidated:   bool                    — the phase transition is in the P3/P7 family (necessary for tier 3, not sufficient for reward)
  //   phaseTransitionHit: 0..1 | null           — did a predicted thing2 phase transition realize (self-consistency, through time)
  //   callHitRate/callSamples:                  — TRUTH BRAKE: fraction of surfaced calls that resolved as predicted
  //   stressSelfPred/stressSamples:             — raw predicted-stress vs realized-stress agreement
  //   minCalls (default 3), minStress (default 5)
  function credit(sig) {
    sig = sig || {};
    var ext = sig.externalOutcome;
    // TIER 4 — TRUE external reward. The ONLY path that is reward / ground-truth.
    if (ext && typeof ext.hit === 'number') {
      return { credit: clamp01(ext.hit), creditSource: 'external-reward', isReward: true, tier: 4,
        label: 'external ground-truth reward' };
    }
    // ── everything below is SELF-CONSISTENCY calibration (interpretive), NEVER reward ──
    // TIER 3 — thing2 realized phase-transition consistency (through-time self-prediction).
    if (sig.phaseValidated && sig.phaseTransitionHit != null) {
      return { credit: clamp01(sig.phaseTransitionHit), creditSource: 'phase-consistency', isReward: false, tier: 3,
        label: 'self-consistency calibration (phase, interpretive)' };
    }
    // TIER 2 — TRUTH BRAKE: realized call hit-rate over resolved calls.
    if (typeof sig.callHitRate === 'number' && (sig.callSamples || 0) >= (sig.minCalls || 3)) {
      return { credit: clamp01(sig.callHitRate), creditSource: 'call-consistency', isReward: false, tier: 2,
        label: 'self-consistency calibration (calls)' };
    }
    // TIER 1 — raw stress self-prediction.
    if (typeof sig.stressSelfPred === 'number' && (sig.stressSamples || 0) >= (sig.minStress || 5)) {
      return { credit: clamp01(sig.stressSelfPred), creditSource: 'stress-consistency', isReward: false, tier: 1,
        label: 'self-consistency calibration (stress)' };
    }
    return { credit: null, creditSource: 'none', isReward: false, tier: 0, label: 'insufficient-history' };
  }

  // Score stress self-prediction from a predicted vs realized pair (helper): 1 - |err|, floored at 0.
  function stressConsistency(predicted, realized) {
    var p = Number(predicted), r = Number(realized);
    if (!isFinite(p) || !isFinite(r)) return null;
    return clamp01(1 - Math.abs(p - r));
  }

  // Which domains may EVER supply an external reward (have a real external realized-outcome label).
  // Conservative + honest: Finance has Thing1's validated distress outcome. Everything else = self-consistency only.
  // A domain not in this set MUST pass externalOutcome:null (its credit stays calibration, never reward).
  var EXTERNAL_REWARD_DOMAINS = { finance: true };
  function externalRewardEligible(domain) { return !!EXTERNAL_REWARD_DOMAINS[String(domain || '').toLowerCase()]; }

  var API = { credit: credit, stressConsistency: stressConsistency,
    externalRewardEligible: externalRewardEligible, EXTERNAL_REWARD_DOMAINS: EXTERNAL_REWARD_DOMAINS, version: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LIMENK4 = API;
})(typeof window !== 'undefined' ? window : this);
