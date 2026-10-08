# THING 1 FRAME AUDIT — PRE-REGISTRATION v1.1 (2026-10-08)

**Addendum to v1.0 (d1543ae5), which stays frozen and unchanged.** This file
adds operator corrections and new frozen material. **Status: FROZEN, pending
operator signature. No company data may be pulled before signature; the v1.1
analysis itself consumes ONLY the already-cached panel data
(`shadow_cache_frame_audit/`) — no new pulls are required for it.**

## 0. Operator corrections accepted (dated, report fixed)

1. **Cohort label fix.** The 2026-10-08 report's phrase "calibration controls
   (M, CSX, NCLH, UAL, YELL, MNK)" was WRONG. Per the code: only **M** is a
   calibration control (`lb.CONTROLS`). **CSX** is in `held_out_test.py`'s
   healthy list. **YELL and MNK are on `held_out_test.py`'s BANKRUPT list —
   positives**, and their degenerate silence is therefore an **unmeasured
   miss**, not a clean control: empty features can never alert, so some
   sensitivity misses are extraction failures, not detector failures
   (consistent with D29). **NCLH and UAL** are in no Thing 1 validation list;
   their actual source list is the v1.3 shadow prereg's COVID hard-negative
   cohort (a different test's list — tagged as such, never merged).
2. **No post-hoc outcome relabeling.** M's counterfactual flip is classified
   ONLY by the frozen rule in §C below — not by narrative.
3. **The two holdout lists are different tests, never merged:** the Feb v1
   manifest (10+10, produced holdout PR-AUC 0.8288) and `held_out_test.py`
   (12+12, pre-registered 2026-06-12). The dependence check is reported for
   each separately (§E).

## A. Seasonality variable (defined now)

- **Input**: research-frame decumulated revenue (`flows.decumulate`,
  `lb.TAG_MAP["Revenue"]`, PIT at cutoff), 2015+ elapsed quarters; requires
  ≥12 measured quarters else None (prove_p2 gate).
- **seasonal_strength** = lag-4 Pearson correlation of the log-detrended
  residuals — exactly `financial_phase_map.temporal_dyad` (itself the
  prove_p2.py:53-67 port); **seasonal_amplitude** = the same function's
  amplitude term.
- **Pre-committed test**: among companies with complete coverage
  (rev_coverage ≥ 0.8), compare flagged vs unflagged on seasonal_strength:
  difference of means with 95% CI. CI entirely > 0 → seasonality hypothesis
  SUPPORTED (Thing 1 responds to the predictable pattern itself); CI entirely
  ≤ 0 → REJECTED; CI contains 0, or either group n < 5 → inconclusive,
  counts and CI reported, no verdict. Same test on seasonal_amplitude.
- **Basis**: operator hypothesis (2026-10-08): PAYX-type alerts = full
  coverage + strong annual cycle straddling the 0.59 entry; Thing 1 lacks
  adaptation to predictable input (no suppression of expected stimuli).
  Mechanism inferred, not yet tested — this is the test.

## B. Neutral floor = UNMEASURED

Any company with neutral_floor_share ≥ 0.5 (all six p3 channels pinned at
sigmoid(0)=0.5) is reported as **UNMEASURED**. UNMEASURED companies are
excluded from every rate (false-alarm, sensitivity, specificity) and their
count is stated beside each rate. Silence from an empty feature set earns
nothing; a miss from an empty feature set explains nothing. The two failure
directions are reported separately: EMPTY (can never alert — structural) vs
COMPLETE (alerts on rhythm — scope gap). **Post-panel claim restatement
(pre-committed): any "FPR 0.00"-class claim is restated as a rate over
measured companies only, with the unmeasured count stated beside it.**

## C. Stressed-but-survived rule (frozen now; filings only, never Thing 1 output)

A flagged company (alert at cutoff) is classified **STRESSED-SURVIVED** if ≥
2 of the following hold, computed from research-frame decumulated facts over
the last 8 elapsed quarters before cutoff:

- **S1** — NetIncomeLoss < 0 in ≥ 2 of the last 8 quarters (quarterly values,
  de-cumulated);
- **S2** — TTM OCF < 70% of the company's max TTM OCF over its 2015+ window
  (>30% decline from own peak);
- **S3** — total Debt > 130% of total Debt 8 quarters earlier.

Otherwise the flag is **UNEXPLAINED**. Accounting (pre-committed):
false-alarm accounting uses flagged = STRESSED-SURVIVED + UNEXPLAINED only;
UNMEASURED companies never enter any denominator. This rule classifies M's
flip and every other flagged survivor — mechanically, before outcomes are
known per company.

## D. Source-list tag on every company (fix applied)

Every company in every table carries a `source_lists` tag drawn ONLY from:
`calibration-distress`, `calibration-control` (lb.DISTRESS/CONTROLS);
`v1-manifest-distress`, `v1-manifest-healthy` (operator record 2026-10-08:
FYBR WLL DNR SN GYMB PIR SHLDQ BRS MCKPQ WMPVQ / PG KO HD NEE RTX JNJ MCD
BRK-B UNH LMT — the manifest document itself is pending attachment, tagged
[DOC-pending]); `heldout_test-bankrupt`, `heldout_test-healthy`
(held_out_test.py 2026-06-12); `v13-prereg-bankrupt/healthy/hardneg`
(shadow_prereg_v13.py); `panel-draw` (this audit). Multi-tag where true
(HTZ = calibration-distress + heldout_test-bankrupt + v13). The v1.0-run
label error (§0.1) is corrected in the v1.1 results output.

## E. Separate dependence reporting (never merged)

The §7 dependence check is reported separately per list: (1) calibration
16; (2) v1-manifest holdout 10+10; (3) held_out_test.py 12+12; plus v13-prereg
cohorts as their own test. No pooled validation numbers anywhere.

## F. What the v1.1 run does (after signature, cache-only)

1. Recompute panel records from the existing cache: add `source_lists`,
   `seasonal_strength`, `seasonal_amplitude`, `feature_class` per §B, and the
   §C classification for every flagged company.
2. Produce Tables 1 and 2 unchanged (definitions frozen in v1.0) PLUS the
   Table 2b restatement excluding UNMEASURED from all rates.
3. Run the §A seasonality test; report per the pre-committed reading.
4. Report the §E separate dependence checks, with M's flip classified by §C.
5. Write `thing1_frame_audit_results_v11.json` (new file; v1.0 results file
   is never overwritten).

No metric, threshold, list membership, or reading in v1.0 or v1.1 changes
after signature. The panel companies, seed, and cutoff are unchanged.

Signature: ______________________  Date: ____________
