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
    /**
     * TIER 4 — TRUE external reward. The ONLY path that is reward / ground-truth.
     *
     * THE ELIGIBILITY LIST IS ENFORCED HERE NOW. It used to be a comment below
     * ("a domain not in this set MUST pass externalOutcome:null") that trusted the
     * caller, and the caller did not comply: domain-brain-base.js granted tier 4 to
     * any domain whose resolver returned a numeric hit, so 13 ineligible domains were
     * receiving "external ground-truth reward" and ten of them at exactly 1.0,
     * because a stress scalar that never moves makes "stable" correct on every row.
     * A guard that lives only in the caller is not a guard.
     *
     * Fails CLOSED on the domain: if `domain` is supplied and is not eligible, tier 4
     * is refused and the signal falls through to self-consistency. `domain` is
     * optional only so that existing callers which already pass externalOutcome:null
     * keep working unchanged; every caller that supplies a real outcome passes it.
     */
    if (ext && typeof ext.hit === 'number') {
      if (sig.domain != null && !externalRewardEligible(sig.domain)) {
        ext = null;   // ineligible: refuse reward, fall through to self-consistency
      } else {
        return { credit: clamp01(ext.hit), creditSource: 'external-reward', isReward: true, tier: 4,
          label: 'external ground-truth reward' };
      }
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
  // Conservative + honest:
  //   finance: Thing1's validated distress outcome.
  //   energy:  the RESOLVER (/api/feed-resolve) grades the brain's forecast against RECORDED realized
  //            feed values (forward-only, independent of the trained weights) — a genuine external
  //            outcome, though external CALIBRATION (feed truth), not a "validated" distress event.
  // Everything else = self-consistency only. A domain not in this set MUST pass externalOutcome:null.
  var EXTERNAL_REWARD_DOMAINS = { finance: true, energy: true };
  function externalRewardEligible(domain) { return !!EXTERNAL_REWARD_DOMAINS[String(domain || '').toLowerCase()]; }

  var API = { credit: credit, stressConsistency: stressConsistency,
    externalRewardEligible: externalRewardEligible, EXTERNAL_REWARD_DOMAINS: EXTERNAL_REWARD_DOMAINS, version: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LIMENK4 = API;
})(typeof window !== 'undefined' ? window : this);
