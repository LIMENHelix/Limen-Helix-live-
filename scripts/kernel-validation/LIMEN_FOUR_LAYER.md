# LIMEN HELIX — The Four-Layer Phase Architecture (Financial Substrate)

**Canonical technical record. Status: Is-layer = 4 kernels validated; Was-layer = live, all 5 modes firing; Going/Why = spec.**
Derived 2026-06-08/09. The locked Thing 1 kernel (`api/helix_app/thing1/limen_backtest.py`, sha256 3ce4a652…82d20) was **never modified**; all work is read-only harness in `scripts/kernel-validation/`.

---

## 0. The thesis

A system does not *sit* in a phase. It moves recursively through phases under internal state + external forcing. To regulate it you need four things — **where it was, where it is, where it's going, and why.** This came from the operator regulating his daughter through dysregulation; the financial substrate is where it's testable with dense, labeled data. The same architecture appears in the NSF "Relapse Operating Model" grant (organizational substrate).

| Layer | Question | Produces | Status |
|---|---|---|---|
| **WAS** | where has it been? | path history H(t): phase sequence, dwell, prior-distress | **LIVE** |
| **IS** | where is it now? | phase posterior (ensemble of per-phase binary kernels) | **4/~12 validated** |
| **GOING** | where is it heading? | transition projection under forcing | **hard — naive approach refuted** |
| **WHY** | what's driving it? | causal attribution (internal / external / capacity) | spec |

---

## 1. The operator algebra (the phase grammar, discrete form)

Book I cites continuous dynamics per phase (Kuramoto, Hopf, symmetry-breaking, critical slowing down). **TESTED: those continuous formulas do NOT transfer to quarterly EDGAR data** (Kuramoto r healthy 0.43/distress 0.34; critical-slowing-down 0.06/−0.02 — both fail; quarterly data too coarse, bankruptcy is a discrete event). **The operator's DISCRETE operator algebra DOES transfer.** Build kernels from these, grounded in (not transcribing) the dynamics:

| Phase | Operator form | Financial signature | Kernel status |
|---|---|---|---|
| P0 Source | `S₀, ∄R` | flat, low-variance, solvent | built / face-valid |
| P1 Collapse | `R(Σ)→R(L), Σ̇≈0` | acute recent single-quarter rupture | built / face-valid (CCL COVID) |
| P2 Rhythm | `xₙ=f(xₙ₋₁,xₙ₋₂)` | **AR(2) coherence** (healthy 0.61 / distress 0.39) | directional |
| P3 Fracture | `\|R\|>θ → decoherence` | rising variance/slope — masking signal | **✅ validated** |
| P4 Scaffolding | `R_int=∫Rᵢ` | survival on **raised** capital (CFF plugs OCF burn) | **✅ validated** |
| P5 Endurance | `Δ=R_new−R_old` | recovered on **own** operating cash | **✅ validated** |
| P6 Order | `x(t)→ω-lock` | strong solvency + AR(2) coherence + growth | built / face-valid (WMT) |
| P7 Shear/fork | `R→R₁∨R₂` | liquidate (7a) ∨ restructure (7b) | **✅ validated** |
| P8 Reflection | `R(R)` | proactive deleveraging after stress | built — not yet firing (tuning) |
| P9 Threshold | `R_syn=∪Rᵢ` | grey solvency + elevated composite + high leverage | built — not yet firing (tuning) |
| P10 Return | `R→S₀` | solvent/stable/own-cash (Was separates from P0) | built / face-valid (WMT/KO) |

**All 11 Is kernels now built.** With 11 kernels every company multi-fires (WMT → P0+P2+P5+P6+P10) → **the Is-posterior arbitration is now the critical next piece** (resolve the multi-fire to a dominant phase / ranked posterior). P8/P9 need signature tuning against their intended cases (AT&T deleveraging, WBD leveraged cliff).

**Why one kernel per phase (not one monolith):** the monolithic `score_all_phases` is decoration — it collapses to "flat→P4" because it scores 11 phases from one shared feature set (measured: `phase_walk.py`; bankrupts and healthy both pool in P4/P6). A dedicated binary kernel per phase, each in its OWN feature space, dissolves the feature-underdetermination (and the §112(a) gap): each only answers "am I in *this* phase?"

---

## 2. The validated Is kernels

| Kernel | Rule (point-in-time) | Validation |
|---|---|---|
| **P3** masking/instability | trajectory composite ≥ 1.1, solvency eroding | fused P~0.80 / R~0.55 out-of-sample; rescues masking cases (BBBY/JCP/PIR/PRTY) Altman rates solvent |
| **P7** fork | OCF/assets > 0 → 7b restructure; ≤ 0 → 7a liquidate | **77% (17/22)** labeled outcomes; discriminator = viable core (OCF), NOT equity |
| **P4** scaffolding | annual/TTM OCF < 0 AND CFF > 0.5·\|OCF\| | **6/6** (COVID cruises/airlines) |
| **P5** endurance | OCF > 0 AND CFF < OCF (own cash dominates) | **6/6** (COVID oil majors); **needs Was** (see §3) |

Supporting (validated): SOLVENCY (Altman Z″ < 1.1, market-equity veto), LIQUIDITY (burning + runway<4q + current-ratio<1.05). The 3-signal fused distress kernel (KERNEL_P3.md) = precision ~0.80, recall ~0.55 out-of-sample, point-in-time. Mechanism = **temporal process detection** (NOT restatement-robustness, which was disproven by direct test).

---

## 3. The Was layer + the regulation-mode triad

P5 proved Was is **necessary**: `Δ=R_new−R_old` only means *endurance* if the prior state was distressed. P5 over-fires on never-distressed companies (WMT fires P5 every quarter) — only Was (prior P3 OR P4) separates "recovered" from "never fell."

`was.py` replays the Is-kernels point-in-time per quarter → phase walk H(t) → path features → **regulation MODE** = Was (prior distress?) × Is (current kernel):

| Mode | Was | Is | Demo |
|---|---|---|---|
| **GENUINE-BASELINE** | never distressed | P0/P2/P5 | WMT |
| **MASKING** | (any) | P3 firing WHILE surface-solvent | BBBY @2022 |
| **OVERT-DISTRESS** | (any) | P3 + insolvent | — |
| **SCAFFOLDING** | prior distress | P4 (on raised capital) | CCL @2021 |
| **ENDURANCE** | prior distress | P5 (own cash) | AAL, CCL now |

**Proof it's real: Carnival reads SCAFFOLDING during COVID and ENDURANCE now — same surface, opposite mode, difference = history/time.** The masking/scaffolding/endurance distinction is a computed system output, not a framing claim.

**VALIDATED AT SCALE (`mode_validate.py`, 20 company-scorings): 18/20 = 0.90** — BASELINE 6/6, SCAFFOLDING 4/5, ENDURANCE 5/5, MASKING 3/4. **Temporal test 5/5: every COVID survivor (CCL/AAL/NCLH/RCL/UAL) reads a DISTINCT mode at the 2021 trough vs now** (scaffolding→endurance). The market-equity veto is now wired into the P3 kernel (`k_p3_fracture`, ticker param): COST/PEP clear (their market caps far exceed liabilities → buyback noise vetoed) while real distress (BBBY/JCP/PIR, collapsed market caps) is NOT vetoed. 2 remaining misses are edges: RCL@2021 P3-vs-P4 sub-mode; PIR@2019-09 timing.

---

## 4. Key findings (this session)

1. **Continuous dynamics formulas (Kuramoto, critical slowing down) do NOT transfer to quarterly EDGAR; the discrete operator algebra does.** Build empirical signatures grounded in (not transcribing) the theory.
2. **One kernel per phase, not one monolith** — dissolves feature-underdetermination and the §112(a) gap.
3. **P5 (and masking/scaffolding) are undefinable without the Was layer** — proves the four-layer architecture is necessary, not decorative.
4. **The P7 bifurcation fork is a genuine cross-substrate convergence** — Book I predicted a fork at P7 from polyvagal theory; the kernel found it independently in SEC XBRL (viability breach → liquidate vs restructure).
5. **Mechanism = temporal process detection, NOT restatement-robustness** (disproven by direct test, `restatement_test.py`).
6. **A pervasive data bug fixed:** `extract_pit` returned the first revenue tag (truncated at the ASC-606 switch year) and dropped cumulative-YTD flows; fixed by merging tags + de-cumulating. Unblocked the live triad and improved P3 recall.
7. **The GOING layer is the hard frontier — the naive approach is REFUTED** (`going.py`, 3/14 = 0.21, anti-correlated). Forecasting ≠ detection: the momentary viable-core derivative (OCF trend) is fooled by turning points — a company at its trough (about to recover) shows the worst trend; a slow-decliner with a seasonal uptick looks like it's recovering right before filing. Miss pattern shows the real discriminators are STRUCTURAL and PEER-RELATIVE: capital access + shock type (exogenous/sector-wide & temporary → recover; idiosyncratic/secular → terminal). This is "Amazon ≠ Burger King" resurfacing as the binding constraint for projection — NOT computable from one company's filings in isolation; needs cross-sectional/sector context.

---

## 5. Validation numbers (point-in-time, out-of-sample where noted)

- 3-signal fused distress (KERNEL_P3): **P~0.80 / R~0.55** (fresh holdout, market-veto'd).
- P7 fork: **77%** (22 labeled liquidate/emerge outcomes).
- P4/P5: **12/12** (COVID scaffolding-vs-endurance cohort).
- P2 AR(2) coherence: directional (healthy 0.61 / distress 0.39).
- Refuted: monolithic phase grammar (validate_v3 F1 0.33; phase_walk = decoration); restatement-robustness; litigation tier (redundant); Kuramoto/CSD direct transfer.

---

## 6. File manifest (`scripts/kernel-validation/`)

**Is kernels:** `phase_kernels.py` (P0/P2/P3/P4/P5/P7 ensemble) · `altman.py` (solvency) · `liquidity.py` · `dyadic.py` (P2 AR(2)) · `flows.py` (de-cumulated quarterly flows).
**P3/fusion:** `pit_trajectory.py` (point-in-time-clean trajectory; merged-tag + de-cumulated extractor) · `fusion_pit.py` · `fusion3.py` · `fusion4.py` (market veto) · `marketcap.py`.
**Validation:** `validate_kernel.py` · `validate_holdout.py` · `post_design_holdout.py` · `p7_validate.py` · `p45_validate.py`.
**Was layer:** `was.py` (path history + regulation mode).
**Experiments / refutations:** `validate_v3.py` (pure-phase, refuted) · `phase_walk.py` (monolith = decoration) · `kuramoto.py` / `critical_slowing.py` (continuous formulas don't transfer) · `restatement_test.py` (mechanism).
**Records:** `KERNEL_P3.md` (the distress kernel) · `LIMEN_FOUR_LAYER.md` (this file).

---

## 7. Open work

- ✅ **Validated the Was triad at scale** — `mode_validate.py`, 16/20 = 0.80, temporal test 5/5 distinct.
- ✅ Wired the market-equity veto into the P3 kernel (Was path) → triad 0.80 → 0.90, BASELINE 6/6.
- Build remaining Is kernels: P1, P6, P8, P9, P10.
- **Going** layer: naive viable-core-derivative refuted (`going.py`). Next attempt must be PEER-RELATIVE — distress shared by the sector (exogenous/temporary → recover) vs idiosyncratic (secular → terminal) + capital-access features. Needs cross-sectional/sector data, not single-company filings.
- **Why** layer (causal attribution: internal accumulation vs external forcing vs capacity loss) — note the Going miss pattern already implicates the same internal-vs-external decomposition.
- Larger stratified cohorts; financial-institution model for banks (Altman doesn't transfer).
- Patent framing per layer (4 independently-claimable layers) — when/if pursued.
