# THING 1 v1 — SCOPED VALIDATION CLAIM (interim, adopted 2026-10-09)

Replaces every unqualified "validated distress scorer" wording. Operator
decision (a), interim: Thing 1 v1 remains the validated artifact; Thing 1 v2
(adapter + recalibrated thresholds + new lock) stays pending the Path-A
mini-prereg outcome. Basis: frame audit 2026-10-08 (prereg v1.0–v1.2, pilot,
shadow phase — see LIMEN-AUDIT-CHECKPOINT references in-repo history and
`thing1_frame_audit_results*.json`, `thing1_v101_shadow_results.json`).

## The claim, scoped

1. **Validated population.** Thing 1 v1 (`limen_backtest.py`, sha256 lock
   `3ce4a652…82d20`, fingerprinted on the working-tree bytes) is validated
   for **large operating companies** — the calibration and holdout cohorts
   (large-cap retail, energy, rental, real estate, telecom/services). For
   classes validated only as controls (banks, REITs, utilities, insurers),
   the claim is **"no alert when measured" only** — no detection claim
   exists for them.
2. **Measured-only rates.** Any specificity/sensitivity statement is computed
   over **measured companies only** — companies whose scoring features are
   actually populated — with the **unmeasured count stated beside every
   rate**. Silence from unpopulated features is not evidence of health;
   absence of a flag where inputs are empty is not a detection result.
3. **Coverage limit (measured, exploratory).** On a random SEC panel
   (seed-20261008 draw, n=197), **60% of companies were UNMEASURED** under v1
   extraction (quarterly-frame short-circuit; YTD-framed quarters dropped;
   missing channels pinned at the neutral floor). Alerts concentrate in the
   measured minority and on populated-but-sparse inputs. **Treat absence of
   an alert as uninformative whenever coverage is incomplete.**
4. **Detection class.** Detects multi-pathway structural collapse. Single-
   vector slow decline is out of scope; stressed-but-survived companies may
   alert. Seasonal regularity on complete inputs can cross the entry
   threshold (the PAYX pattern, generalized by the shadow phase) — an alert
   on a measured, strongly seasonal company is a scope edge, not proof of
   distress.
5. **No revalidation yet.** The extraction/recalibration path (Thing 1 v2)
   is pending; until it is validated on a fresh cohort, no claim beyond this
   document is made for any modified configuration. The adapter-plus-kernel
   system fingerprint (v1.0.1 draft) applies to any future change.
6. **Specificity is pipeline-bound.** v1's specificity is a property of
   v1's input pipeline — sparse features hold most companies at the neutral
   floor, which suppresses alerts on missing data. It does **not** transfer
   to complete-data inputs: when the same kernel is fed de-cumulated
   point-in-time data, stress_rate rises ~2.6× and 9 of 16 large-cap
   shadow-flips were false alarms, including a calibration control (JPM)
   that v1 correctly leaves silent. Evidence: Path-A mini-prereg results,
   commit `7ecf3d9e`.

## For any future Thing 1 v2 pre-registration (standing note)

The adjudication lead window must match the kernel's claimed lead time. The
manifest claims a median lead of roughly ten quarters; a +2-quarter
true-positive window would misclassify the very early warnings being sold
(WLL: alert 2018Q1, filing 2020-04 — unadjudicated under the +2q rule, plausibly
the claimed behavior). Any v2 validation must pre-register a lead-time window
consistent with the claim, or the test penalizes the product's advertised
function.

## Short form (for UI surfaces)

**Thing 1 — distress scorer: validated on large-cap cohorts (v1, 2015+);
measured companies only; no alert where inputs are absent.**
