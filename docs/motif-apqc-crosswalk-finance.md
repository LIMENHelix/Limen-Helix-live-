# Motif × APQC Crosswalk — Finance domain execution

**Compiled 2026-07-12.** First domain executed against the reusable engine in
`assets/data/motif-apqc-crosswalk.json`, instantiated on the Finance domain data in
`assets/data/business-operations-atlas.json`.

## What this is (and the stance it was built under)

The neurology doc gives the control structures + failure modes on the **brain** side (12 motifs).
The business atlas gives the control structures on the **org** side (NAICS business types, SOC roles,
APQC processes), grounded in the real taxonomies. This document performs the **join** the motif
crosswalk deferred to a domain expert, at the **function** level only — never node→company.

Built **affirmatively**: each row is constructed, evidenced against the role's actual mechanism
(the atlas `positions[].duties`, which are O*NET-grade task descriptions), and tiered. The crosswalk
doc's refutation step — handing each mapping to a domain professional as a held-out validator who
tries to break it — is a **separate, later** pass. It is not run here, because you cannot refute a
mapping before it exists. What follows is the thing to hand them.

**Why Finance first:** Finance is the domain where the isomorphism is tightest, because a financial
firm *is* a control system — leverage, risk limits, feedback loops, and precision-weighting are its
literal machinery, not a metaphor. It is the strongest proof case and aligns with where the LIMEN
kernel is already validated.

## The join, motif by motif

| Motif | APQC process (universal) | Finance function / SOC role (atlas) | Failure poles, in Finance's real pathology | Tier |
|---|---|---|---|---|
| **M1** Top-down inhibitory brake | 11.0 Manage enterprise risk & compliance | **Chief Risk Officer**, 2nd line of defense (11-3031); Board Risk Committee; Fed/FINRA as external brake | **Over-grip:** risk so tight the desk can't take risk → franchise atrophy (over-conservative post-2008 lending). **Brake-failure:** risk overridden, reactive unit runs unchecked → London Whale, 2008 | **STRONG** |
| **M2** Gain / broadcast modulation | 1.0 Set risk-appetite/threshold policy; 9.0 hurdle rate | **Cost-of-capital / risk-appetite broadcast** (CFO); the **Fed funds rate** as the exogenous LC-of-the-economy gain | **High:** hypervigilant capital rationing → credit crunch. **Low:** complacency, over-lending before a crash | **STRONG** |
| **M3** Homeostatic negative feedback | 9.0 Financial control / variance correction | **ALCO** (asset-liability management); internal-audit three-lines loop; CCAR capital auto-correction | **Broken:** unchecked leverage spiral (pre-2008). **Over-aggressive/delayed:** credit-cycle oscillation (bullwhip) | **STRONG** |
| **M4** Gating relay (adjustable throughput) | 9.0 Capital-release gate; 10.0 approval workflow | **Credit committee / underwriting gate** (Credit Analyst 13-2041 → approval memo, covenants); CFO capital release | **Open:** uncontrolled lending (subprime). **Closed:** credit freeze, project starvation (liquidity crisis) | **STRONG** |
| **M5** Switching / reallocation | 1.0 Portfolio reallocation | **Portfolio Manager** rotating defensive↔growth (13-2051); ALCO shifting balance-sheet posture; liquidity-contingency activation | **Thrashing:** over-trading, strategy whiplash. **Stuck:** rigid book misses a regime shift | **STRONG** |
| **M6** Feedforward prediction + error | 9.0 Forecasting + variance analysis | **Actuary** pricing/reserving updated by loss experience (15-2011); **Quant** model (13-2051); FP&A forecast-vs-actual | **Priors too strong:** model ignores emerging loss data → reserve inadequacy. **No stable model:** over-reacts to noise | **STRONG** |
| **M7** Sustained vs phasic threat | 11.0 monitoring (tonic) vs incident response (phasic) | **AML/transaction-monitoring surveillance** (Compliance Analyst 13-2061, tonic) vs **Fraud & Disputes** desk (13-2099, phasic) | **Tonic stuck on:** alert fatigue, SAR over-filing. **Phasic hair-trigger:** false-positive card blocks | **MODERATE-STRONG** |
| **M8** Anti-reward brake (KILLSWITCH) | 11.0 stop-loss/drawdown; strategy kill | **VaR / stop-loss / drawdown limits** on a desk; risk committee cutting a profitable-but-dangerous strategy | **Too strong:** no risk appetite, dead desk (anhedonia). **Too weak:** doubling down, loss escalation (Barings, Archegos) | **MODERATE-STRONG** |
| **M9** Local E/I balance | 13.0 internal controls within a unit | **Desk-level risk limits**; first-line "own your risk" controls per business unit | **Too little:** desk destabilizes (unchecked position). **Too much:** over-controlled paralysis | **PARAMETER** |
| **M10** Interoceptive aggregation → salience | 9.0 management reporting; 8.0 telemetry | **Risk dashboard / management reporting** aggregating desk P&L, VaR utilization, liquidity; daily marks | **Poor:** flying blind, no consolidated risk view (a real 2008 failure). **Over-weighted:** metric obsession | **MODERATE-STRONG** |
| **M11** Reward / motivation drive | 7.0 comp/incentive design; 9.0 capital allocation | **Compensation / bonus structure**; capital flowing to expected return; incentive salience driving desk behavior | **Too high:** bubble-chasing, excessive risk. **Too low:** stagnation | **MODERATE** |
| **M12** Rhythm / entrainment | 9.0 reporting cadence | **Quarterly reporting; FOMC calendar; daily mark-to-market and margin cycles; T+1 settlement** | **Desync:** settlement fails, coordination collapse. **Over-rigid:** quarterly-earnings myopia | **MODERATE** |

## What the proof shows

1. **The join runs.** All 12 motifs land on a real Finance function with a named SOC role and an APQC
   process, and both failure poles map onto a documented Finance pathology (not a vibe). The failure-mode
   column is the load-bearing part: e.g., M1's two poles are literally the London Whale (brake-failure)
   and post-crisis over-tightening (over-grip).

2. **Finance is unusually clean because it is a control system by construction.** Six of twelve motifs
   score STRONG. That is expected and is *why* it is the right first proof — it is the easy case, and it
   passes. The harder cases (a domain like Culture or Religion, where control structures are looser) are
   the real test of whether the method discriminates, and should be run next.

3. **Two structural findings fell out, not forced:**
   - **M8 (anti-reward / KILLSWITCH) has no standing APQC process** — it is a *structure invoked on a
     negative signal* (a stop-loss, a kill decision), not a permanent function. The atlas correctly has
     no single role for it. That absence is a finding: killswitch behavior is architectural, which is
     exactly the thesis behind the operator's `killswitch.domains` mechanic.
   - **M11's regulatory intervention is a motif-gain tuning.** The deferred-compensation rule that
     regulators imposed post-2008 is, in this frame, an explicit turning-down of M11's gain to stop
     bubble-chasing. The regulation is legible as control on the motif, which is a strong sign the
     mapping is real rather than decorative.

4. **This is the fix for the audit's central failure.** The system audit found the business layer
   bypasses the crosswalk and fabricates node→company confidence floats. This document *is* the
   replacement: motif → APQC process → real function, grounded in taxonomy, zero fabricated floats,
   node→company deliberately out of scope.

## Next steps (not done here)

- **Run a hard case** (Culture or Religion) to test whether the method discriminates where control
  structures are loose — the real falsification opportunity, once there is something built to falsify.
- **Import the remaining 19 domains** into `business-operations-atlas.json` (currently seeded with
  universal + finance; manifest lists the 19 pending).
- **Hand the Finance rows to a finance professional** as the held-out validator — the crosswalk doc's
  own refutation step, now that the mapping exists to be tested.
