# THING 1 FRAME AUDIT — PRE-REGISTRATION v1.2 (2026-10-08)

**Addendum to v1.0 (d1543ae5) and v1.1 (412f7991); both stay frozen. Two
operator changes, then the cache pilot is authorized by the operator's
"run the cache pilot" instruction.**

## 1. EXPLORATORY / PILOT designation (supersedes v1.1 §F framing)

The seasonality hypothesis was formed from companies the engineer had already
examined (PAYX, ADP, M — v1.3 cache). Therefore:
- **The cache re-analysis (v1.1/v1.2 run) is EXPLORATORY / PILOT**, labeled as
  such in its config, results file, and every table it produces. It answers
  "is the seasonality signal even present, and are the counts large enough to
  justify a confirmatory pull" — nothing it produces is a confirmatory verdict.
- **The only confirmatory test is a FRESH seed draw** (defined in §3 below).
  It has NOT been authorized. It executes only on the operator's separate SEC
  pull approval, after the pilot is seen.

## 2. Stressed-but-survived rule, v2 (supersedes v1.1 §C)

Rationale: S2 (OCF <70% of peak) and S3 (debt >130%) read the same raw series
Thing 1 scores. No Thing 1 OUTPUT is used, but flagged companies would tend to
meet S2/S3 by construction — false alarms could be absorbed into
"stressed-survived". Fix, frozen:

**STRESSED-SURVIVED requires S1 OR an external event. S2/S3 corroborate but
can NEVER classify alone.**

- **S1 (independent)**: NetIncomeLoss < 0 in ≥2 of the last 8 elapsed quarters
  (decumulated quarterly values).
- **External events (outside Thing 1's channels)** — any one suffices:
  - **E1 dividend cut/suspension** (computable from companyfacts; ASSUMPTION:
    TTM dividends < 50% of the company's own max TTM over 2015+, or zero in
    the last 4 quarters after having paid within the prior 8);
  - **E2 restructuring/impairment charge** (computable; any of
    RestructuringCharges / RestructuringAndRelatedCostIncurredCosts /
    ImpairmentCharges / GoodwillImpairmentLosses > 0 in the last 8 quarters);
  - **E3 going-concern note, E4 covenant amendment/waiver (8-K), E5 credit
    downgrade** — NOT computable from structured companyfacts; reported as a
    **manual-review queue** (company list + count beside every rate). They can
    upgrade a classification only after human confirmation.
- **S2 / S3 (corroborating only; ASSUMPTIONS — 70% and 130% are labeled as
  assumptions, not derived values)**: OCF <70% of own 2015+ peak TTM; debt
  >130% of 8 quarters earlier. A company meeting ONLY S2+S3 is reported as
  **S2S3-ONLY** and counted in a dedicated line: "would have reclassified on
  S2+S3 alone."
- Classification for flagged companies: STRESSED-SURVIVED (S1 or E1/E2, or
  E3-E5 after manual confirmation) / S2S3-ONLY / UNEXPLAINED. UNMEASURED
  companies never enter any denominator (v1.1 §B stands).

## 3. Confirmatory draw (defined NOW, NOT authorized, NO pulls until approved)

- Same frame file and panel rules as v1.0 §3, **new seed 20261009**, target
  200 accepted, off-calendar augmentation ≥30, cap 500, failures logged.
- New cache dir `shadow_cache_frame_audit_confirmatory/`, own manifest.
- Executes only on operator's explicit SEC-pull approval after the pilot.

## 4. Source correction (supersedes v1.1 §D pending-note)

- **Calibration cohort: VERIFIED from the locked kernel** — `limen_backtest.py`
  DISTRESS/CONTROLS, lines 53–71, sha256 3ce4a652…82d20. Not operator-recalled;
  read from code.
- **Holdout lists (both): DOC-PENDING** until `v1_manifest.json` and the
  held_out_test.py provenance document are attached. The Feb v1 manifest
  company table currently in use is the operator's 2026-10-08 record, tagged
  [DOC-pending] everywhere it appears.
- Source-list tags otherwise per v1.1 §D.

## 5. Pilot deliverable (authorized now, cache-only)

`thing1_frame_audit_results_v12_pilot.json`: config labeled
`"designation": "EXPLORATORY_PILOT"`, v1.0 panel records + new fields
(source_lists with corrected calibration tagging, seasonal_strength,
seasonal_amplitude, S1/E1/E2/S2/S3 for flagged companies, S2S3-ONLY count,
manual-review queue), Table 2b (UNMEASURED excluded), the §A seasonality test
reported as exploratory, per-list validation dependence per v1.1 §E.
No v1.0/v1.1 file is overwritten. No new data is pulled.

Signature: operator instruction "run the cache pilot" (2026-10-08).
