# PATH-A-ON-COMPLETE-DATA — MINI-PREREG (2026-10-08)

**Status: FROZEN, pending operator signature. Cache-only; EXPLORATORY label on
every output. No company data beyond the existing caches will be pulled.
Nothing runs until signed.**

Context: the v1.0.1 shadow phase (44efbd13) showed the research-frame adapter
unmasks many new alerts on healthy-looking large caps. Two interpretation
corrections are pre-committed before any analysis: (1) "shadow-refuted
specificity" is a HYPOTHESIS, not a finding — several flipped companies are
known-stress cases whose alerts may be correctly timed (HTZ = calibration
distress; CCL/CAR/M = 2020-shock companies); (2) the deeper finding is the
COUPLING: P3_ENTRY (0.55 swept / 0.59 frozen) and the path weights were
calibrated on v1's SPARSE feature distributions; feeding the same kernel
complete data shifts those distributions, so frozen thresholds misbehave as
an expected consequence. Sensor-gain/threshold analogy recorded. An
adapter-only delta is therefore not coherent.

## Q1 — Timing adjudication of the >=$1B v1→shadow flips (n=17)

Population (frozen, from thing1_v101_shadow_results.json): CAR, CCL, CNX,
DO, FRPT, GM, HTZ, JPM, M, MCD, NFE, PYPL, RCL, RTX, RYAM, WHR, WLL.
**JPM is reported separately**: it is a calibration control AND a bank
(controls-only validation class) — its flip is a validity event for the
"no false alarms on banks" record regardless of outcome.

For each company, the SHADOW alert quarter(s) (first_alert_q from the shadow
score) are compared against externally sourced stress events:
- 8-K Item 1.03 (bankruptcy/receivership), covenant waiver/relief,
  dividend cut/suspension, credit downgrade — each event CITED (filing date +
  accession or news URL). Instruments: cached submissions JSONs, EDGAR
  full-text (instrument-quality caveat recorded: raw efts name queries are
  noisy; document-level grep only), and web news. A documented search with
  no event found is reported as such.
- Pre-declared 2020-shock window: 2020Q1–2021Q2 (assumption-labeled). The
  window is a PRIORITIZER, not evidence: an in-window alert still needs a
  sourced event to leave FALSE-ALARM.

Frozen classification:
- **TRUE-POSITIVE-TIMING**: alert within 2 quarters AFTER a sourced distress
  event (or at/before an Item 1.03 for the distress cohort).
- **STRESSED-SURVIVED**: sourced stress event exists; alert timing outside
  the +2q window.
- **FALSE-ALARM**: documented search finds no sourced event in the lookback
  (2015→cutoff).
- **UNADJUDICATED**: search inconclusive or instruments inadequate.

Pre-committed reading: the adapter question is settled only by the
TRUE+STRESSED vs FALSE split among non-JPM names, reported with counts and
per-name evidence — no pooled rate without the split.

## Q2 — Feature-distribution shift (calibration cohort, n=16)

Descriptive only: for each calibration company, v1 vs research-frame inputs
side by side — coverage (rev/ocf), and the distributions of z_var_Revenue,
z_ac_Revenue, z_slope_Revenue, stress_rate, and path_a; cohort-level summary
(mean/std/quantiles) plus per-company table. No hypothesis test. Purpose:
measure the SIZE of the gain change the thresholds would have to absorb
(operator: "the size of the shift is for the mini-prereg to measure").

## Q3 — Seasonality variables on the 17 flips (exploratory)

seasonal_strength / seasonal_amplitude (temporal_dyad port, research frame)
for the 17 companies; reported with the alert classifications. Exploratory —
cache-generated hypothesis, not a confirmatory test.

## Discipline

- Read-only w.r.t. all kernels and production files. No writes outside a new
  results JSON (`thing1_pathA_miniprereg_results.json`) and this document's
  companion outputs.
- EXPLORATORY label on every table and number.
- No numbers, definitions, or populations change after signature.

## Standing records tied to this prereg

- **Coupling finding (recorded)**: thresholds calibrated on v1 sparse
  features; adapter-only delta incoherent. v1.0.1 draft PARKED.
- **Decision pending (operator)**: (a) keep Thing 1 v1 as the validated
  artifact with a scoped coverage claim; or (b) Thing 1 v2 = new adapter +
  thresholds recalibrated on calibration data only + new lock + ONE
  fresh-pool validation. Mini-prereg result feeds this choice.
- **Pool reservation**: eligible distress pool (~50, estimate, method in
  checkpoint §36) is reserved for a single final validation. 2020 vintage
  clustering recorded as a pre-declared regime confound.

Signature: ______________________  Date: ____________
