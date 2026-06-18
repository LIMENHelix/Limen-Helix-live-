# Energy — Functioning Brain v1: Final Acceptance Audit (Phase H7)

**Date:** 2026-06-18  **Probe:** `scripts/_taxonomy-pilot/h7-energy-functioning-brain-final-audit.cjs` (non-zero-exit gate)
**Result:** **20/20 + finalizer-carries-all + bounded — PASS**

## Verdict

Energy qualifies as a **functioning recurrent, source-grounded, immune, aware, conscience-gated,
intuition-capable, simulation-capable domain brain v1.** This is the completed pilot template; the
H1–H7 sequence is now part of the reusable per-domain recipe.

## Build path

Phase A audit → B recurrent loop → F0 finalizer-survival shim → F1 DDP schema → F2 population →
F3 canonical aliasing → G1/G1b/G1c/G1d source coverage (6/6) → C1 portal-cortex audit → G2 prompt
trimming → **H1 immune → H2 awareness → H3 conscience/veto → H4 intuition → H5 simulation →
H6 executive self-report → H7 final audit.**

## What Energy now has

| Layer | State key | Reaches finalizer via |
|---|---|---|
| Recurrent prior / prediction error / plasticity / regulation | `state.energyModel` | `brainState` |
| Source grounding 6/6 + canonical aliasing | bundle cache + `_resolveCanonicalDiagnosis` | `bundle`, `promptView` |
| Prompt trimming (compact, capped) | DDP `promptView` (G2) | `promptView` |
| **H1 Formal immune system** | `state.energyImmune` | `promptView.immuneSummary` + `retainedWarnings` |
| **H2 Awareness / metacognition** | `state.energyAwareness` | `promptView.awarenessSummary` |
| **H3 Conscience / veto** | `state.energyConscience` | `promptView.conscienceDecision` + `retainedWarnings` |
| **H4 Intuition / weak-signal** | `state.energyIntuition` | `promptView.intuitionSummary` |
| **H5 Simulation / counterfactual** | `state.energySimulation` | `promptView.scenarioSummary` |
| **H6 Executive self-report** | `state.energyExecutiveReport` | `promptView.executiveReport` |

The full H-layer objects also live in `DDP.audit.{immune,awareness,conscience,intuition,simulation,executiveReport}`
(audit only — **not** forwarded to the prompt, so the compact finalizer packet stays bounded ≈7 KB).

## Integrity properties proven

- **No fabrication.** Missing diagnoses keep empty candidate arrays; external-source bundles carry empty
  method/embodiment/figure; intuition + simulation outputs never enter `evidenceAnchors`.
- **Intuition is labelled, not evidence.** Every hunch is `HUNCH / LOW / UNVERIFIED` with why/verify/falsify,
  ≤3 per cycle; proven non-vacuously by forcing a weak-signal condition.
- **Simulation is hypothetical.** Every scenario carries `hypothetical: true`; the flag survives to the finalizer.
- **Conscience is conservative.** Patent/grant vetoed (no candidate fields); investment/research allowed
  only for source-backed diagnoses, always with warnings. No fake readiness is ever created.
- **Portal cortex limits respected.** L2 synthetic content blocked from traversal; L1/L2 mad-lib treatments
  quarantined (per C1).
- **Warnings survive.** Human-verification (external-source) and alias-risk (PIPELINE) warnings reach the finalizer.
- **Non-energy unchanged.** Other domains return `null` deepBrain — no Energy-specific fields leak.

## What Energy still does NOT have (honest gaps)

- **Real depth below L1.** Portal cortex stays root-only/L0; L1 mixed, L2 synthetic. Deeper traversal remains
  blocked — Energy is source-*grounded* but not source-*deep*.
- **Method/embodiment/figure candidates** for the 3 external-source diagnoses (OIL_SHOCK / NUCLEAR_INCIDENT /
  SYSTEMIC_ENERGY_STRESS) — intentionally empty; require human authoring from primary documents.
- **Operator/directive modules** remain dormant (not ungated this phase, per constraints).
- **Intuition pattern-matching / analogies / promotion** are stubs (`[]`) — the hunch path is live but shallow.

## Remaining blockers before applying the template to Finance

None blocking. Two carry-forward notes:
1. The H-layers are **domain-level** (one immune/awareness/conscience/etc. per cycle), embedded into each
   per-diagnosis packet. Finance should keep this shape unless per-line conscience is needed.
2. The per-phase probes were **consolidated** into one layered gate (`h-energy-higher-layers-probe.cjs`)
   plus this final audit, per the fast-proof directive — one targeted gate covers H1–H6 + the 5 critical gates.

## Critical gates (run after every phase; all green)

1. Six Energy diagnoses still emit. 2. `energyModel` exists + updates. 3. DDP reaches finalizer safeInput.
4. G2 compact `promptView` still exists. 5. Non-energy domain stays no-op/null.
