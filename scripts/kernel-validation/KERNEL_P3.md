# KERNEL P3 — Point-in-Time Fused Distress Kernel

**Status: Validated *directionally*. Not commercial-grade. Locked record of the 2026-06-08/09 validation arc.**
Canonical appendix for the master document and the Arthur claim-scope conversation.
The locked Thing 1 kernel (`api/helix_app/thing1/limen_backtest.py`, sha256 3ce4a652…82d20) was **never modified** in any of this work. All artifacts are read-only harness + wrapper candidates in `scripts/kernel-validation/`.

---

## 1. The claim (narrowed, defensible, endorsed by 2 independent engineers)

> **The LIMEN phase trajectory detects operational erosion in companies that still appear solvent on point-in-time balance-sheet ratios. The solvency-vs-trajectory divergence is the masking signal.**

NOT a standalone bankruptcy predictor. NOT final IP proof. NOT validated outside finance (cross-domain claim is gone). Recall is not yet commercial-grade.

---

## 2. The mechanism (CORRECTED — and this matters for the patent)

The load-bearing wall is **temporal process detection**, *not* restatement-robustness.

- A balance-sheet solvency ratio reflects only the **latest state**, which stays healthy until the **terminal balance sheet** — and that terminal filing lands *at/after* bankruptcy. Point-in-time discipline correctly excludes it, so the ratio falls back to an earlier, healthy snapshot.
- The phase trajectory measures the **decline process** across many quarters, each **filed as it happened**. Its lead time comes from watching the process unfold.

**Restatement-robustness was DISPROVEN by direct test** (`restatement_test.py`): under restatement the ratio moves 0.03, the trajectory moves 0.15 — the trajectory is *more* restatement-sensitive, not less. Do **not** put restatement-robustness in the patent application.

---

## 3. The architecture — 3 signals, each a defined job

| Signal | Rule (point-in-time, filed≤cutoff) | Job |
|---|---|---|
| **SOLVENCY** | Altman Z″ < 1.1, **vetoed** if market value of equity > 1.2× total liabilities | structural insolvency |
| **LIQUIDITY** | OCF burning AND runway < 4q AND current ratio < 1.05 | near-term cash death (WE, BBBY) |
| **TRAJECTORY** | phase composite ≥ 1.1 AND solvency eroding (Z″ < 2.6 or falling), market-veto'd | masking / operational erosion |

**Market-equity veto** (`marketcap.py`): fixes the negative-book-equity-from-buybacks false positives (O'Reilly, Yum, McDonald's, Starbucks, Home Depot) — Altman's book-equity ratios misread aggressive-buyback cash machines as distressed; the market clearly values their equity above their liabilities.

**Rejected 4th signal — LITIGATION** (`litigation.py`): built, tested, **redundant.** Booked liability (Endo) already tanks Altman → solvency catches it; unbooked liability (Mallinckrodt) is invisible to all financial statements. Zero net catches. Keep the 3-signal kernel.

---

## 4. The honest numbers

| Test | n | precision | recall | FPR | note |
|---|---|---|---|---|---|
| Altman-alone, point-in-time | 82 | 1.00 | **0.44** | 0.00 | solvency snapshot; misses masking cases |
| Trajectory-alone, out-of-sample | — | — | **0.00** | — | fails as standalone classifier |
| Fused, design cohort | 113 | 1.00 | 0.67 | 0.00 | **precision 1.00 was partly luck** |
| Fused, holdout (no veto) | 30 | 0.67 | 0.67 | 0.08 | exposed buyback FPs |
| **Fused, fresh holdout + veto** | **31** | **0.80** | **0.55** | **0.045** | **the honest out-of-sample number** |

**Operating point to quote: precision ~0.80, recall ~0.55 on truly-fresh, point-in-time, out-of-sample data.** An early-warning *screen*, not a classifier. The inflated 0.91/1.00 figures were lookahead + design-cohort luck, both corrected.

The trajectory's contribution is mechanistic and real: it **rescued masking cases the solvency snapshot rated SAFE** — BBBY (Z″ 6.65), JCP (2.52), Pier 1 (2.05) — flagged 1–3 years early.

---

## 5. Scope boundaries (named failure classes the kernel does NOT catch)

- **Structured-finance liquidity** (Hertz) — fleet-ABS margin call; positive OCF, solvent balance sheet; invisible to operating-liquidity ratios.
- **Unbooked litigation** (Mallinckrodt) — settlement flowed through the bankruptcy; never a recognized liability; needs non-financial (legal-docket) data.
- **Fast LBO collapse** (Avaya) — too fast for a multi-quarter trajectory.
- **Levered telecom / retail-lender hybrids / slow retail** (Intelsat, Conn's, LL Flooring) — point-in-time ratios stay grey.
- **Banks / brokers / insurers** — Altman Z″ does not transfer; need financial-institution-specific ratios. Keep separate.

---

## 6. IP framing for Arthur (3-claim decision tree)

| Claim | Scope | Prior-art density | Defensibility |
|---|---|---|---|
| Trajectory as restatement-robust detector | narrow | sparse | **VOID — disproven** |
| **Trajectory as temporal-process / masking detector** | narrow, mechanism-specific | sparse | **HIGH — load-bearing wall** |
| Fusion (solvency anchor + trajectory + divergence gate) | broader | dense (Altman hybrids) | medium |
| Phase grammar P0–P10 as engine | original | §112(a) gap remains | low until grammar produces coherent trajectories |

Walk in knowing the load-bearing wall is the **temporal-process / masking detector**, not the fusion (dense prior art) and not restatement-robustness (disproven). Altman is prior art and unpatentable alone.

---

## 7. Open work before any filing / commercial claim

1. **Data hygiene** — entity-verify all cohort CIKs (known bad: VAL→Seadrill, DBD→Stanley Black, FTCHQ→Arlo, AUD→Broadridge, DO 404, MNK→renamed).
2. **Larger stratified cohort** (150+) across operational / leverage / liquidity / litigation / fast-LBO / fraud, with explicit per-class recall.
3. **Lock the masking-class operational definition** (Z″ ≥ threshold within k quarters of event) so it can't be retro-adjusted.
4. **Fresh post-design holdout** after every rule freeze; document seed + freeze date.
5. **Financial-institution model** for banks/brokers/insurers.
6. Then Arthur, under the narrowed claim.

---

## 8. Harness (all read-only; locked kernel untouched)

`validate_kernel.py` (labeled cohort + v1 baseline) · `kernel_v2.py` (discriminator candidates) · `validate_v3.py` (pure-phase, refuted) · `altman.py` (ratio anchor, point-in-time) · `lead_time.py` · `pit_trajectory.py` (point-in-time-clean trajectory) · `fusion_pit.py` (2-signal clean) · `liquidity.py` · `fusion3.py` (3-signal + expanded cohort) · `validate_holdout.py` / `post_design_holdout.py` (holdouts) · `marketcap.py` (market-equity veto) · `fusion4.py` (veto + fresh holdout) · `litigation.py` / `fusion5.py` (rejected 4th signal) · `restatement_test.py` (mechanism test).

*The kernel survived because it was tested honestly. Every refutation (pure-phase, restatement-robustness, litigation tier, inflated precision) is preserved here as evidence.*
