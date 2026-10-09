# THING1 v1.0.1 NAMED-DELTA PROPOSAL — EXTRACTION ADAPTER (DRAFT v2, NOT AUTHORIZED)

Draft date 2026-10-08. **REVISED DRAFT v2 (2026-10-08) per operator review:**
(1) the validation lock must fingerprint adapter + kernel TOGETHER (the
validated system is the combination — this is the gap that produced the frame
audit's findings); (2) pass criteria are sensitivity and specificity
separately, each with its own Wilson bound — no accuracy criterion; (3) cohorts
≥30 per side, per-class recall reported, PR-AUC judged by a pre-specified
paired non-inferiority margin against the v1 extraction on the SAME fresh
cohorts (the recorded 0.8143/0.8288 came from the old extraction and cannot
anchor). Status: **DRAFT for operator review. Nothing has been run, pulled, or
implemented. Shadow phase and pulls are HELD until the operator signs.** Companion record: frame audit
(prereg v1.0–v1.2, pilot results, checkpoint §30–§33).

## 1. Delta scope (named, minimal)

- **`python_runtime/helix_app/thing1/limen_backtest.py` — UNCHANGED, byte for
  byte. The sha256 lock `3ce4a652…82d20` stays valid throughout.**
- The delta lives in the **ingestion adapter only**: the score path's data
  acquisition (`fetch_company_data` / `extract_quarterly_series` usage in
  `limen_app.py`) is switched from the quarterly-frame short-circuit rule to
  the **research point-in-time de-cumulation** (`scripts/kernel-validation/
  flows.decumulate`, as already wrapped by `sec_adapter.build_inputs` and
  shared with Thing 2). Output contract unchanged: `{metric: {(y,q): value}}`
  for Revenue/OCF/Cash/DebtCurrent/DebtLong.
- Untouched: all scoring math, Path A/B/C formulas, thresholds (1.1/1.5/1.5),
  P3_ENTRY (0.59), START_YEAR, absence of hysteresis, envelope gates.
- Rollback: env flag `LIMEN_EXTRACTION=v1|research`, default v1 until shadow
  sign-off. No data migration.
- **Fingerprint (revised, operator-mandated):** the validation lock covers the
  ADAPTER + KERNEL TOGETHER. `VALIDATION_LOCK.json` gains a
  `system_sha256` = hash over (locked `limen_backtest.py` bytes, adapter
  module bytes, extraction-mode identifier). "Validated" applies to the
  combination, never to the kernel alone — an input change without re-validation
  can no longer ride on the kernel fingerprint. (This is the gap that let the
  extraction frame issue go unnoticed: the lock certified a kernel whose
  inputs the lock did not cover.)

## 2. Motivation (from the frame audit, all exploratory)

1. The short-circuit rule drops YTD-framed quarters whenever ≥4 quarterly
   frames exist — present in 27/27 cached companies and, on the panel draw,
   leaving **60% of companies UNMEASURED** (neutral floor; p3 pinned at 0.5).
2. The validated "no false alarms" record is therefore partly unearned:
   unmeasured controls cannot alert (structural silence), and unmeasured
   distress companies cannot be caught (extraction misses, not detector
   misses — consistent with v1.3 sensitivity results).
3. Counterfactual re-scoring with de-cumulated OCF moved ~5% of outcomes in
   both directions (incl. GM, PYPL False→True) — the extraction frame is a
   material input to the validated artifact.
4. Out of scope for this delta, stated honestly: **Path B (first-vs-last
   cash) alerts on sparse cash series are NOT fixed by de-cumulation** (Cash
   is an instant metric; its extraction does not change). PAYX-type
   seasonality straddles need their own treatment (scope statement, not a
   kernel patch).

## 3. Risk register

- **Fiscal-calendar bucketing**: de-cumulation maps periods by end date;
  off-calendar filers land in shifted calendar buckets. Mitigation: per-company
  as-of checks in shadow phase; z-scores are within-company so the shift is
  internally consistent, but flagged for review on FYE≠1231 names.
- **Entity stability** (D29/D32): CIK+entityName frozen at fetch time.
- **Prereg interplay**: P3 stays UNKNOWN_ABSTAINED under 9.14(c); this delta
  does not touch any P3 verdict or the v1.3 record.

## 4. Fresh-cohort validation plan (per the iteration rules)

1. **Shadow-first (no new data)**: v1.0.1 runs as shadow over the existing
   cached panel + v1.3 cache; per-company alert deltas with attributed
   reasons (path-level). Report-only.
2. **Fresh cohorts (new pulls, after operator sign-off of THIS plan and a
   versioned prereg)**: new distress/control draws **disjoint from every
   prior design panel** (held_out_test.py exclusion lists, the frame-audit
   panel, the v1.3 cohorts, and all calibration/holdout names are excluded),
   **≥30 companies per side** (the 8+8/10+10 sizes cannot distinguish success
   from luck: at n=8 a 0.60 Wilson LB requires a perfect 8/8; at n=10 it
   requires 10/10). Lists frozen before any scoring; PIT cutoffs pre-filing.
   **Per-class recall is reported** (operational / leverage / liquidity),
   per the KERNEL_P3 open-work list.
3. **Pre-committed pass criteria (revised, operator-mandated):**
   - **Sensitivity: Wilson LB ≥ 0.60** on the distress side.
   - **Specificity: Wilson LB ≥ 0.60** on the measured-controls side
     (unmeasured count stated beside; UNMEASURED never enters a rate).
   - **No accuracy criterion** — accuracy pools the two questions and can
     pass by being good at one and useless at the other.
   - **PR-AUC: paired non-inferiority only** — v1 and research extractions
     scored on the SAME fresh cohorts; adopt requires research sensitivity ≥
     v1 sensitivity − 0.10 AND research specificity ≥ v1 specificity − 0.10
     (**margins are assumptions, not derived**). The recorded 0.8143/0.8288
     came from the old extraction and cannot anchor a fresh claim.
4. **Freeze protocol**: a new versioned prereg file is written and signed
   BEFORE any new pull; no number changes after first results are read.
5. **Re-lock**: not required if the kernel file stays byte-identical (the
   preferred shape above). If any change to `limen_backtest.py` proves
   necessary, that is a NEW lock — operator-signed re-validation, third-party
   witness, coordinated VALIDATION_LOCK.json update. Never edit to pass.
6. **Decision rule (pre-committed)**: adopt the adapter only if sensitivity
   AND specificity Wilson LBs both clear 0.60 on the fresh cohorts AND the
   paired non-inferiority margins hold; otherwise log as a scoped limit
   (erratum) and revert to v1 extraction.

## 5. Explicit non-goals

- No change to Path B/C construction (sparse-cash and rupture behavior).
- No change to thresholds, entry, or hysteresis policy (the hysteresis
  document-vs-code erratum is a separate record).
- No production cutover; shadow until signed.

Signature: ______________________  Date: ____________
