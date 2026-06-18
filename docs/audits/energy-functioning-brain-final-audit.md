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

## Phase J update (2026-06-18) — L1 reality, authoring intake, deeper intuition

**Critical finding (J1):** the C1 classifier had undercounted the mad-lib verb family — it missed
6 verbs (Calibrate/Evaluate/Streamline/Institutionalize/Configure/Monitor). With those added,
**100% of L1 portal treatments classify as template** (678/678; L1 avgTmplRatio = 1.00). So the
earlier "L1 is mixed / admit real L1 as depth" plan was based on a false premise. **L1 treatments are
NOT admitted as evidence.** Only the real company tickers (9–14 per diagnosis) are surfaced in
`portalContext.l1Depth`, marked `relevanceUnverified` (their node-bindings are templated, e.g. First
Solar→"battery storage"), and they never enter `evidenceAnchors`. The immune system now raises an
`l1-synthetic-treatments` antigen and quarantines L1 treatments — the brain's self-model is accurate.

**J2 — human-authoring intake:** external-source bundles emit `treatmentContext.authoringIntake` —
structured empty slots (method/embodiment/figure) marked `needs-human-input` with a real source hint,
**not fabricated**. Conscience still vetoes patent/grant. Intake reaches the finalizer.

**J3 — intuition deepened:** `patternMatches` (recurring regulation / phase oscillation from real
memory), `analogies` (structural failure-families, e.g. OIL_SHOCK~PIPELINE_DISRUPTION), and
`promotedToMonitoring` (a hunch recurring ≥3 cycles becomes a monitoring target **only**).
`promotedToDiagnosis` stays permanently `[]` — nothing is auto-promoted to evidence or diagnosis.

Proof: `j-energy-real-depth-probe.cjs` 25/25 + the 5 critical gates; full regression all 14 probes pass.

## Deliberate boundaries (NOT gaps — do not "fix" by removing)

- **L2 stays blocked.** L2 is ~98% synthetic (C1); admitting it would inject garbage into evidence.
  Blocking it is correct behavior.
- **Operator/directive modules stay gated.** Operator decision (2026-06-18): keep dormant. They change
  runtime behavior and warrant a separate, separately-proven phase when ungated.

## What Energy still does NOT have (honest, residual)

- **Real source *depth*.** The portal cortex contains no real treatment depth (L1 + L2 are synthetic).
  Genuine depth must come from the **external institutional bundles via human authoring (J2 intake)**,
  not the cortex. Energy is source-*grounded*, not source-*deep* — and now correctly knows it.
- **Method/embodiment/figure candidates** for the 3 external-source diagnoses remain empty by design
  until a human authors them from primary documents (the J2 intake is the channel).

## Remaining blockers before applying the template to Finance

None blocking. Two carry-forward notes:
1. The H-layers are **domain-level** (one immune/awareness/conscience/etc. per cycle), embedded into each
   per-diagnosis packet. Finance should keep this shape unless per-line conscience is needed.
2. The per-phase probes were **consolidated** into one layered gate (`h-energy-higher-layers-probe.cjs`)
   plus this final audit, per the fast-proof directive — one targeted gate covers H1–H6 + the 5 critical gates.

## Critical gates (run after every phase; all green)

1. Six Energy diagnoses still emit. 2. `energyModel` exists + updates. 3. DDP reaches finalizer safeInput.
4. G2 compact `promptView` still exists. 5. Non-energy domain stays no-op/null.
