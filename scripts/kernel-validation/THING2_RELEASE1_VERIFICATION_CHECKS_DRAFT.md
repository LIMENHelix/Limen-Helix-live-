# THING 2 RELEASE-1 PER-PHASE VERIFICATION CHECKS — DRAFT v0.1 (2026-10-09)

**DRAFT for operator review — NOT frozen.** Operator instruction: per-phase
checks as VERIFICATION — code computes the definition from filings; the
release claim per phase is **"definitional reading, verified."** Nothing in
this file is executed against company data until signed.

## Principle

A verification check does not ask "is this phase a good predictor?" (that is
the separate predictive-validity track). It asks: **"did the pipeline compute
exactly the frozen definition from the filings, with the stated inputs?"** A
phase reading ships with the claim "definional reading, verified" when its
verification check passes; the check is re-runnable by anyone with the
cached facts and the pinned code.

**Independence requirement (operator 2026-10-09, BEFORE freeze):** the
verification code must be an **independent reference implementation** — a
separate code path written directly from the frozen definitions and the
cited research sources (prove_p2.py, LIMEN_FOUR_LAYER.md). It must NOT call
the production functions (`sec_adapter.evaluate_company`,
`financial_phase_map.evaluate`) — checking code by calling the same code
proves nothing. Divergence between the two implementations is either a
pipeline defect or a definition ambiguity; both get reported, not smoothed.

## V-P0 — Source (baseline / positive flatness)

- **Definition (frozen formula, fpm-r2):** seasonal amplitude below the P2
  floor (amp < 0.03) + measured solvency (Altman Z″ > 1.1) + ≥8 elapsed
  quarters + zero interior gaps + no P4/P5/P2 gate fired.
- **Verification computation:** from the company's cached companyfacts,
  recompute the trailing revenue series (research-frame de-cumulation),
  the detrended-residual amplitude, and the Altman Z″ exactly as
  `sec_adapter` + `financial_phase_map` do; assert equality of the emitted
  P0 verdict with the independently recomputed value.
- **Pass criterion:** emitted reading == recomputed definition on 100% of
  rows that emit P0 (per-board, per-run). Any divergence = pipeline defect,
  block publish of that row.
- **Availability flags emitted:** MEASURED / MEASURED_ZERO / MISSING /
  STALE / UNSUPPORTED for revenue, OCF, CFF, solvency.

## V-P2 — Rhythm (lag-4 coherence / margin lock)

- **Definition:** temporal dyad — lag-4 autocorrelation of log-detrended
  residuals ≥ 0.5 with amplitude ≥ 0.03 over ≥12 measured positive revenue
  quarters (prove_p2.py:53-67,81); OR relational dyad — margin lock
  1−min(cv/0.15,1) ≥ 0.6 over ≥8 cost quarters (:70-78,82).
- **Verification computation:** recompute both dyads from raw filings;
  assert which branch fired, with the measured constants (0.5 / 0.03 / 0.6)
  restated in the output. The lock-only path must cite "margin lock …;
  temporal dyad not measurable" (regression-tested, fpm-r2).
- **Pass criterion:** 100% agreement on emitted P2 rows; branch attribution
  correct; the <12-quarter temporal gate yields
  UNKNOWN_INSUFFICIENT_HISTORY, never a silent downgrade.

## V-P4 — Scaffolding (financing plugs burn)

- **Definition:** TTM OCF < 0 AND TTM CFF > 0.5·|OCF|
  (LIMEN_FOUR_LAYER.md:67), measured — never variance-shape.
- **Verification computation:** recompute TTM OCF/CFF from de-cumulated
  quarterly flows with the 4-quarter contiguity rule (missing slot →
  MISSING, never zero); assert the inequality on measured values only.
- **Pass criterion:** 100% agreement on emitted P4 rows; MEASURED_ZERO burn
  quarters never treated as negative OCF.

## V-P5 — Endurance (own cash after scaffold)

- **Definition:** TTM OCF > 0 AND TTM CFF < OCF, plus prior-P4 within the
  16-quarter window (decision 9.12a: prior-P4-ONLY). Never-self-funded
  companies do not emit P5 (fall through to rhythm/baseline).
- **Verification computation:** recompute both the current TTM gate and the
  prior-P4 window scan (boundary quarters skipped, not aborted); assert the
  window verdict (ever-P4 True/False/not-computable) is reported.
- **Pass criterion:** 100% agreement on emitted P5 rows; a
  not-computable window yields UNKNOWN, never P5.

## Cross-phase invariants (re-asserted every run)

1. UNKNOWN never promotes into P0 or GENUINE_BASELINE (T-BIND suite).
2. Three reason codes only: UNKNOWN_ABSTAINED / UNKNOWN_NOT_BUILT /
   UNKNOWN_INSUFFICIENT_HISTORY.
3. Interpretive only: no payload carries `validated: true`.
4. Frozen titles only (Source / Rhythm / Scaffolding / Endurance); no
   alternates on any released surface.
5. Formula version pinned (fpm-r2) printed on every payload.

## Operational shape

- One script (`verify_release1.py`) runs all four checks against the board
  cache and prints a per-phase pass table + divergence list. It implements
  the definitions from scratch (research-frame de-cumulation, Altman Z″,
  dyads) as an independent reference — importing production scoring
  functions is a review-blocking violation.
- Runtime: local, cache-only, seconds.
- On any divergence: rows affected flip to UNKNOWN (data-error), never to a
  guessed phase.

Signature: ______________________  Date: ____________
