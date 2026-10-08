# THING 1 FRAME AUDIT — PRE-REGISTRATION v1.0 (2026-10-08)

**Status: FROZEN, pending operator signature. No company data beyond what is
already cached may be pulled before signature. No number, rule, or variable in
this document changes after the first new data is read.**

Companion: SHADOW_PREREGISTRATION v1.3 (P3 validation), which stays separate —
this audit does not re-open any P3 verdict.

## 1. Question

Is the production extraction pattern (quarterly-frame short-circuit at
`len(frame_entries) >= 4`, YTD entries dropped, missing → `_sig` fillna(0))
a PAYX-specific exception, or a class-of-filers property that affects Thing 1
alerting? Preliminary cached evidence (27 companies, all cached facts, run
2026-10-08, scripts in /tmp only): the short-circuit pattern is present in
**27 of 27** cached companies, but alerts are rare (3/27: PAYX, EXPR, TUEM —
the latter two are distress cohort members). Preliminary classification:
**the pattern is a class property; whether it alerts depends on feature
coverage and level, which is company-specific.** This audit tests that on a
pre-registered panel.

## 2. Preliminary findings already on record (cached data, not panel results)

- D31/PAYX: path A 1.371 = 2.5·(21/47) + 0.150 + 0.104. Alert persists with
  research-frame OCF backfill (1.371 → 1.433): the OCF zero-fill is NOT the
  driver. Driver: near-complete quarterly-frame Revenue coverage → real
  seasonal z-scores → p3 mean 0.599 vs entry 0.59.
- ADP (same business, same off-calendar FYE, same YTD pattern): no alert.
  Cause: sparse recent Revenue frame coverage → all six p3 channels at the
  sigmoid(0)=0.5 neutral → p3 ≈ 0.5, never crosses. Its "no alert" is
  uninformative for recent quarters, not a validated health read.
- Several calibration controls (M, CSX, NCLH, UAL, YELL on cache) show the
  same neutral-floor shape (Revenue coverage 2–34 accepted quarters) — their
  no-false-alarm record is partly degenerate, not earned.
- Counterfactual OCF backfill on cache flips three current readings
  (DO, M, VAL False→True). DO/VAL are post-emergence entities (thin current
  meaning); M is a calibration control — flagged as UNVALIDATED until the
  fiscal-calendar bucketing of the backfill is checked per company.
- Hysteresis: the 2026-03-10 kernel document states "2 consecutive quarters
  required before alert"; `compute_trajectory_alert` has none (grep
  HYSTERESIS: 0 hits). Validated results (lock 2026-05-08) came from the
  code as-is: no hysteresis. Document overstates the artifact — dated
  erratum recorded in the checkpoint.

## 3. Panel (fixed before any new data is read)

1. Fetch fresh `company_tickers.json` (public frame file; this is the
   sampling frame, not company data). Draw order: tickers shuffled with
   **seed = 20261008** (Python `random.Random(20261008).shuffle`), iterated in
   that fixed order.
2. For each ticker: fetch `submissions/CIK##########.json` → SIC, fiscalYearEnd,
   name. Apply the financial-SIC exclusion **SIC 6000–6999 excluded** (widest
   variant; the three-variant discrepancy D21 is noted, not resolved here).
   Non-excluded companies are ACCEPTED into the panel.
3. Stop when **200 accepted** companies are reached, or the frame is
   exhausted. Extensions (pre-committed): if the accepted 200 contain **fewer
   than 30 off-calendar filers (FYE ≠ 1231)**, continue drawing in batches of
   100 until ≥30 off-calendar accepted or 3 extensions are used, whichever
   comes first. Cap: ≤500 accepted total.
4. **Exclude nothing after the draw.** Every failure is logged with reason:
   unresolved CIK, no submissions, no facts, SIC-excluded (counted separately,
   not in panel), fetch failure.
5. For each accepted company: fetch `companyfacts` (cache + SHA-256 manifest
   under `shadow_cache_frame_audit/`). SEC identity: limenhelix@gmail.com.
   Rate limit ≤ 10 req/s with backoff.

## 4. Variables (defined now, not after looking)

Per company, at cutoff = run date (recorded):
- Identity: ticker, CIK, name, FYE (calendar 1231 vs off-calendar), SIC.
- **Framing** (per metric Revenue / OCF / Cash / DebtCurrent / DebtLong):
  n quarterly-framed entries; n YTD-or-frameless entries; n quarters accepted
  by `extract_quarterly_series`; short-circuit flag (accepted ≥ 4 AND YTD
  dropped > 0); fiscal-quarter distribution of accepted quarters.
- **Coverage** (eval window = 2015+ per START_YEAR): rev_coverage =
  accepted-revenue quarters / eval quarters; ocf_coverage likewise;
  zero_fill = eval quarters with OCF missing; neutral_floor_share = share of
  eval quarters where all six p3 channels equal 0.5 (features empty).
- **Thing 1 output**: alert (any path), path_a, path_b, path_c, stress_rate,
  n_stressed, max_consec, max_p3, sustained_bonus, first_alert_q — computed
  exactly as `shadow_prereg_v13.t1_detection` (locked code, PIT at cutoff).
- **Channel attribution**: the six p3 channel values per eval quarter
  (risk_var_rev, risk_ac_rev, risk_slope_rev, risk_accel_rev, risk_var_ocf,
  risk_ac_ocf), so every stressed quarter's driver is attributable.
- **Counterfactual**: same scoring with OCF backfilled from
  `flows.decumulate` (research frame). Recorded before/after. Descriptive
  only; not a verdict. Fiscal-calendar bucketing caveat recorded per company
  (FYE ≠ 1231 → fiscal quarters land in shifted calendar buckets).
- **Thing 2 reading**: `sec_adapter.evaluate_company` status/phase/mode on the
  same facts (cross-check only).

## 5. Tables and required explanations

**Table 1 (the 2×2 the operator asked for).** Rows: OCF short-circuit pattern
present vs absent. Columns: Thing 1 flagged vs not. For EVERY cell with the
pattern, one line from the math explaining the outcome — pattern-but-NOT-
flagged companies especially (expected mechanism: neutral-floor or
below-threshold real channels).

**Table 2 (refined).** Rows: feature class — REAL (rev_coverage ≥ 0.8 and
neutral_floor_share < 0.2) vs DEGENERATE (neutral_floor_share ≥ 0.5) vs
MIXED (neither). Columns: flagged vs not. This separates "alerted on real
features", "alerted on empty features", "silent because empty", "silent on
real features".

**Cell math**: every flagged company's stress_rate decomposition
(2.5·rate + 0.05·consec + 0.5·(max_p3−0.59) + bonus) and the flagged-quarter
channel means.

## 6. Pre-committed readings (frozen)

1. If zero-fill/pattern companies are flagged at about the same rate as clean
   ones → the pattern isn't driving alerts; PAYX is an exception. Log it;
   Thing 1 stands. Statistic: difference in flagged proportions
   (pattern − clean) with Wilson 95% CI; "about the same" = CI contains 0.
2. If pattern companies are flagged much more often → class-of-filers issue;
   Thing 1 gets a stated scope limit (erratum, not a patch). "Much more" =
   CI entirely above 0.
3. If too few companies have the pattern (or any cell n < 5) → say so;
   report counts and intervals, no verdict.
   (Preliminary cache data predicts reading-2 cells will be nearly empty
   because the pattern is ~universal; if so, Table 2 carries the analysis
   and these readings apply to Table 2's feature-class rows instead —
   THIS substitution is itself pre-committed here, before data.)

## 7. Validation-set dependence check

Run §4 variables + counterfactual on ALL of Thing 1's validation record:
calibration DISTRESS+CONTROLS (16 entities, 3 Regime-2 banks noted) and BOTH
holdout lists (held_out_test.py HELDOUT_* and the KERNEL_P3/March-record
list — the two lists disagree; both are checked and the discrepancy is
reported). Question: did any validated outcome (alert or no-alert) depend on
the framing pattern, zero-fill, or the neutral floor? Fetching these public
facts is part of this audit, after signature.

## 8. Discipline

- Read-only. Thing 1 stays locked (sha256 3ce4a652…82d20). No code changes to
  any kernel or production file. Analysis scripts live outside the repo or in
  scripts/kernel-validation/ as data-free tooling; the only writes are the
  new cache directory, this document's results file, and the manifest.
- Operator's revised eligibility table (2026-10-08) is PENDING RATIFICATION;
  this audit does not implement it. Sector class is recorded per §4 so the
  eligibility rules can be applied to the results later.
- Results file: `thing1_frame_audit_results.json` next to this document,
  written once, never overwritten (dated suffix if re-run).

Signature: ______________________  Date: ____________
