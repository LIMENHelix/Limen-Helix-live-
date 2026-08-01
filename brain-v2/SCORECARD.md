# BRAIN-V2 vs THE COMPLETENESS CHECKLIST

Scored against **`SPEC.md` Part 8** (LIMEN Helix — The Complete Working Brain v1.0).

| date | score | what existed |
|---|---|---|
| 2026-08-01 (morning) | **3 / 28** | afferent layer only: `core/brain.js`, `core/channel.js` |
| 2026-08-01 (closed loop) | **23 / 28** | the closed loop: `kernel/` + 20 executed acceptance tests |
| 2026-08-01 (rows 10/22/27) | ~~26 / 28~~ **withdrawn** | overstated: rows 10 and 22 were scored as passes while partly built |
| 2026-08-01 (current) | **24 / 28 complete, 2 partial, 2 not built** | rows 10 and 22 honestly partial; row 27 completed |

Reproduce every number with `node brain-v2/test/loop-acceptance.js`. The checklist rows are
evaluated from live runtime state, not from a table someone maintains by hand — a row passes
because a measurement said so in that run, or it does not.

**THE 26/28 WAS WRONG, and the way it went wrong is worth keeping.** The checklist scored each
row `true|false`, so a partly-built row had to be called done or nothing, and the pressure ran
one way. Row 22's own description ended with the word PARTIAL while the row scored `true`. Row
10 was scored on detection alone when SPEC B5 asks for direction, magnitude *and* resolution
outcome. Scoring now has three states and a row cannot contradict its own text.

---

## Where each incomplete row actually stands

| # | Test | Status |
|---|---|---|
| **10** | Divergence between channels logged as a first-class signal | **PARTIAL.** `core/divergence.js` runs beside fusion on declared channel pairs and reports the full gap instead of the mean it would fuse to — a -1.8/+2.4 pair yields 4.2 sd, not 0.3. Direction and magnitude are logged. **The resolution outcome SPEC B5 asks for is not:** a divergence has no id, no open/resolved status, no evaluation horizon and no grader, so it can never close as sensor failure vs genuine regime split vs a wrong relationship declaration. The statistics also need work — the gap is a raw difference of two per-channel z-scores against a flat 2 sd threshold, which ignores the variance of that difference. |
| **22** | Learning rates derived per-node from own statistics | **PARTIAL.** `core/metaplasticity.js` derives the forward-model rate per model key from that key's own prior errors, bounded, abstaining below n=8, taken strictly before the current error is recorded, and surviving both rollback and restart. **That is ONE node.** Per-channel `q`/`r`, all six critic weights, the trust gate and the accumulator bound are still SET and still marked `[mark: prior]`. The finding this project's review history has logged four times is narrowed, not closed. |
| **24** | Lateral connectivity between peer domains | **NOT BUILT.** One domain is bound. A lateral edge *type* exists in `packet.js` and is exercised by `connectome.js`, but there is no peer to connect to, so the property is untested rather than satisfied. |
| **25** | Topology-editing mechanism (pruning) | **NOT BUILT.** Weights change and episodes retire, but nothing edits the graph structure. Per SPEC B16 this is the only mechanism that changes topology rather than weights; without it the graph can only grow. |
| **27** | Cadence derived from each domain's own event spacing | **COMPLETE**, as of the liveness fix. `inferCadence` measures the median interval between VALUE CHANGES rather than between polls, and abstains to the declared prior below 6 changes. Both consumers now use the measured period. It shipped half-applied: `predict()` grew uncertainty against the measured value while `observe()` still sampled at the declared one, so the three channels found to change every 1-4h while declared 24h kept discarding 23 of every 24 liveness samples — 2 retained of 48, against 43 now. **Open modelling question:** the interval between value changes is a process timescale, not necessarily a reporting cadence, and with `CHANGE_EPS` at 1e-9 a noisy continuous feed will "change" every poll and collapse the estimate back to the poll rate. Arrival cadence and state-change timescale should eventually be tracked separately. |

---

## What the run actually measured, on 362 recorded hours of real energy data

Everything below is a number from `node brain-v2/run.js 362 --fresh`, not an estimate.

- **18 channels declared, 6 live, 10 dead (constant across their liveness window), 2 absent.**
  Confidence 0.71, computed as `coverage(6 live) x consistency`, so it falls when channels are
  lost. One live channel at perfect self-agreement caps at 0.33.
- **Prediction hit rate 0.736 over n=307, with 81 genuine misses.** The first version of this
  loop scored 1.000 over 314, which was not a good system but an unfalsifiable band; the
  interval is now derived from each variable's own observed sd and the registry refuses a band
  it cannot be wrong about.
- **255 actions released, 77 held, 253 executed, 0 dead axons.**
- **Deterministic replay verified:** two independent runs over the same 120 rows produced
  identical state hashes and an identical ordered sequence of 2,790 trace records.
- **Restart verified across a real process boundary:** one OS process ran 80 ticks and exited,
  a second restored at tick 80 and continued to 160, carrying episodes, resolved predictions,
  forward-model weights and per-channel observation noise.

---

## The one thing this build does NOT prove, stated plainly

**Reafference cancellation is wired, invoked, and returned zero every time.**

`B14` exists: efference copies are emitted at command time, `actuate.js` throws without one,
and the residual arithmetic (`observed − predicted − efferenceExplained`) runs on every
resolution. The forward model learns from supervised error and survives restart.

But the forward model refuses to subtract until it has `trustN = 8` independent observations,
and across 362 recorded hours the action that moves a measured variable (`raise_attention`) won
selection rarely enough that the model reached **n = 2**. So the subtracted term was 0 on
**0 of 338** resolutions.

That is the intended behaviour — subtracting an unmeasured quantity would itself be a
fabrication, and an inflated `n` is worse than a small one because the small one abstains. It
is also the honest limit of the claim: **the cancellation path is T5 (runtime output observed),
not T8.** Nothing here demonstrates that self-caused change was successfully separated from
world-caused change on real data. It demonstrates that the machinery to do so exists, runs, and
correctly declines to guess.

A defect found while measuring this: the same efference copy was originally learned from once
per prediction in its window, so 2 copies produced 15 "observations" and pushed the model past
its trust gate on the strength of one event. Fixed — one claim, one comparison
(`predict.js`, `fm.consumed`).

---

## Truth ladder (MASTER_PROMPT §16), per block

| block | level | basis |
|---|---|---|
| B0 afferent, B5 interoception | **T7** | runs, changes state, survives restart |
| B1 boundary | **T6** | denies 4 attack classes; quarantine file written |
| B7/B9 connectome | **T6** | bounded routing, INV-7 reciprocity satisfied |
| B8 prediction | **T8** | full predict → resolve → error loop, 307 resolutions |
| B10 selection | **T8** | released, held, and suppressed with recorded reasons |
| B11 motor | **T8** | 253 executions, `executed` written by the actuator |
| B12 modulators | **T6** | four axes, orthogonality measured over real traffic |
| B13 consolidation | **T6** | 14 passes, write authority, multiplicative downscale verified |
| B14 forward model | **T5** | emitted, learned, persisted — **cancellation unexercised** |
| B15 episodic | **T7** | 332 episodes, retrievable by trace, survives restart |
| B17 self-model | **T7** | channel inventory drives confidence |
| B2 reflex, B3 CPG, B6 set-points, B16 glia | **T0–T1** | B3 and B6 partial inside `vitals.js`; B2 and B16 absent |

**Brain maturity (MASTER_PROMPT §19): B5.** Action selection with measured outcome feedback is
demonstrated. B6 is not — there is no second domain, so cross-domain coordination is untested.
B7 is not — learning happens (forward model, critic history) but is not validated under
controlled conditions.
