# BRAIN-V2 vs THE COMPLETENESS CHECKLIST

Scored against **`SPEC.md` Part 8** (LIMEN Helix — The Complete Working Brain v1.0).

| date | score | what existed |
|---|---|---|
| 2026-08-01 (morning) | **3 / 28** | afferent layer only: `core/brain.js`, `core/channel.js` |
| 2026-08-01 (closed loop) | **23 / 28** | the closed loop: `kernel/` + 20 executed acceptance tests |
| 2026-08-01 (rows 10/22/27) | ~~26 / 28~~ **withdrawn** | overstated: rows 10 and 22 were scored as passes while partly built |
| 2026-08-01 (rescored) | **24 / 28 complete, 2 partial, 2 not built** | rows 10 and 22 honestly partial; row 27 completed |
| 2026-08-01 | ~~25 / 28~~ **withdrawn** | row 10 called complete; review found the restart claim untested on the real path |
| 2026-08-02 | **24 / 28 complete, 2 partial, 2 not built** | row 10 back to partial: uncalibrated statistic, unexercised on real data |
| 2026-08-03 (current) | **24 / 28 complete, 4 partial, 0 not built** | rows 24 and 25 built and PARTIAL, row 22 narrowed, row 10's six dead letters measured and named. Nothing moved to complete: every one of the four is blocked on data, not on code |

Reproduce every number with `node brain-v2/test/loop-acceptance.js`. The checklist rows are
evaluated from live runtime state, not from a table someone maintains by hand — a row passes
because a measurement said so in that run, or it does not.

**THE 26/28 WAS WRONG, and the way it went wrong is worth keeping.** The checklist scored each
row `true|false`, so a partly-built row had to be called done or nothing, and the pressure ran
one way. Row 22's own description ended with the word PARTIAL while the row scored `true`. Row
10 was scored on detection alone when SPEC B5 asks for direction, magnitude *and* resolution
outcome. Scoring now has three states and a row cannot contradict its own text.

**FOUR DEFECTS THIS PASS SHIPPED AND REVIEW CAUGHT.** Recorded because three of the four
had passing tests over them, which is the failure mode worth remembering.

1. **Lateral echo protection was advisory.** `publish` read `contributors` off the object
   the caller handed back, so any caller could pass a copy with the list emptied and relay
   a signal to its own originator. Its adversarial test *asserted the forged relay reached
   the origin and called that a pass* — the test documented the hole instead of closing
   it. Lineage is now owned by the bus and keyed by an id the bus issued; a parent id the
   bus never issued is refused rather than assumed clean.
2. **The declared latent did not gate delivery.** The check was guarded on an
   `observation.latentScope` flag nothing ever set, so the second half never evaluated and
   traffic about any latent crossed every link. That made "name what both domains observe"
   decorative.
3. **Topology rollback restored state but not `mark`.** The edge looked identical and
   behaved differently: `utilitySince` kept measuring from the undone decision. Measured —
   an edge weakened at n=60, given 20 more outcomes, demoted and rolled back, then read a
   12-outcome fresh window where an edge that never transitioned read 32, and the two
   reached opposite decisions. The first regression test written for this passed with the
   fix removed, because it had no outcomes between the two transitions; a test that cannot
   fail is not one.
4. **Noise derivation folded attention into `rBase`.** The estimate was made under the
   effective r and stored as the base, so `applyR` multiplied the gain a second time and it
   compounded. The first fix — dividing by the mean gain — was also wrong: `var(v) -
   mean(P_prior)` estimates the *world's* noise, not the configured one, so dividing
   biased it as far low at gain 4 as it biased high at gain 0.25. The bias is not
   arithmetic and cannot be recovered from inside the window: attention runs the filter at
   a noise level it does not believe, so `P_prior` stops being the true prior variance. The
   estimator now **abstains** outside a narrow gain band. On a signal with a known true r
   of 0.25, gain 1.0 recovers 0.28 while gains 0.25 and 4.0 hold the prior exactly.

Each fix is now covered by a test verified to fail when the fix is removed.

**WHAT THE 2026-08-03 PASS DID AND DID NOT MOVE.** Four rows were worked; none became
complete. Rows 24 and 25 went from *not built* to *partial* because their mechanisms now
exist and are adversarially tested; row 22 narrowed from one node to two node classes with
a held-out control behind it; row 10's six dead-letter declarations were measured, named,
and marked at the source. Every remaining gap in all four is blocked on **data, not code**:
row 24 needs a real second domain, row 25 needs an edge-level credit signal that only a
second domain makes possible, row 10 needs a fixture in which its dead channels move, and
row 22's last three constants need control comparisons of their own. That is the honest
shape of the work, and it is why the headline number did not move.

**ROW 22 TOOK TWO WRONG ANSWERS BEFORE THE RIGHT ONE, both caught by the control run.**

The `q` estimator first used lag-1 autocorrelation alone. Autocorrelation says which WAY `q`
is wrong; it does not say whether `q` is wrong at all. A slowly drifting channel has
correlated innovations whatever `q` is, because a first-order filter cannot track a trend, so
"correlated, raise q" fired on every derivation and walked seven near-constant channels from a
declared 0.02 to 0.806. The second attempt scaled the adjustment by the variance mismatch but
still took its SIGN from the autocorrelation, which meant a channel whose innovations were far
SMALLER than its stated uncertainty read as maximally mismatched and had `q` raised anyway. An
over-cautious filter needs less process noise, not more. The variance ratio now sets the
direction and the autocorrelation only sets how much of a real gap is state motion.

Worth recording that the verdict flipped from "does not help" to "helps" across those fixes.
Both were corrections of defects identifiable without looking at the score — one contradicted
its own header, the other was incoherent in sign — but they were made after seeing it, and the
result moved.

**TWO THINGS ROW 25 FOUND BY BEING RUN, both of which looked fine until measured.**

First, the mechanism was one-way. Dormancy was reversible only by an explicit caller, so no
rule ever traversed `dormant -> reactivated` and on evidence alone the graph could only
shrink — the exact mirror of the "the graph can only grow" problem the row exists to fix. On
the recorded corpus an integration edge went dormant at utility -0.500, took six further
outcomes, all of them useful, ended at +0.143 and stayed suppressed. `evaluate()` now
reactivates on evidence recorded AFTER the suppression (`utilitySince`), never on the lifetime
record that caused it: a long bad run can otherwise never be outvoted by the trickle of
outcomes a dormant edge is able to receive.

Second, a healthy-looking result is not evidence. With trace-level credit enabled the corpus
produces a textbook trajectory — dip, recover, pass probation, end active at 0.380 over 332
outcomes. It is still the wrong signal, and nothing in that trajectory says so. The tell is in
the counters, not the shape: the two edges it moved are identical at every step.

---

## Where each incomplete row actually stands

| # | Test | Status |
|---|---|---|
| **10** | Divergence between channels logged as a first-class signal | **PARTIAL.** A claim now opens once when a declared pair clears threshold, carries a stable id, and closes exactly once as `converged`, `sensor_failure`, `persistent`, `extreme_persistent`, or `declaration_withdrawn`. The grader's job is to keep an outage apart from a regime split — without it both enter downstream reasoning as the same fact. Both `persistent` and `extreme_persistent` declare the two hypotheses they *cannot* separate (real separation vs a mis-declared relationship) rather than picking the flattering one — an earlier `implausible_declaration` outcome asserted the declaration was at fault, which significance cannot establish, since a genuine structural break can violate a correct relationship by any margin. Persistence also requires a minimum number of actual observations, not merely an elapsed horizon: a process down for 12h returning one reading was resolving `persistent` from two observations. The horizon is derived, not set: 12 periods of the slower channel, reusing `channel.js`'s own `LIVENESS_WINDOW`, and **null** rather than invented when neither channel states a cadence — a claim with no horizon never becomes `persistent`, because "we waited long enough" is meaningless without knowing how fast the slow side can speak. Statistics corrected: the gap is tested against its own standard error, since two already-standardised quantities differ by ~1.41 from their own noise alone. A raw 3.0 sd gap at n=12 is 1.88 se and correctly no longer fires; the old flat threshold was too lax by ~1.4x. Covariance is assumed zero, which is conservative — positive correlation would shrink the spread, so the error points at silence rather than false alarms. Open claims survive `LOOP.serialize`/`restore`, the path the application actually uses. 144 assertions plus a separate calibration suite. **WHY STILL PARTIAL:** (1) the statistic is *not calibrated* — measured false-positive rate under a simulated shared latent is 0.76% (equal noise) and 1.34% (6x uneven), against the 5% the threshold was originally justified as, so it is conservative in the documented direction but the p-value labels have been withdrawn from the code; (2) it remains **unexercised on real data**, and as of 2026-08-03 that is measured and named rather than silent. The ledger now tracks testability per declaration and `report().deadLetters` reports **6 of the 7 declared energy relationships as never once comparable across 347 cycles**, each with its failing side: `eiaPetro` and `massiveOil` are ABSENT (no reading at all), and `natGas`/`lng`, `solar`/`wind`, `nuclear`/`fedRegNrc`, `coal`/`solar` are DEAD (constant across their liveness window). This was worth building because the failure mode is silence that reads as agreement: a declaration that cannot fire produces no divergences, and an empty outcome distribution looks exactly like one where everything agreed. **None of the six is repairable in code.** An absent feed needs a feed; a constant channel needs a period in which its value moves. Re-pointing them at channels that happen to be live would be inventing a latent to fit the available data, which is precisely what the latent requirement exists to prevent. They are marked `[DEAD LETTER ...]` at the declaration site in `bind/energy.js` and left declared, because deleting them would destroy six real hypotheses to make a report look clean. The one testable declaration, `gridRel`/`electricity`, was comparable on 140 cycles and cleared threshold on none. |
| **22** | Learning rates derived per-node from own statistics | **PARTIAL, narrowed from one node to two node classes.** (1) `core/metaplasticity.js` derives the forward-model rate per model key from that key's own prior errors, bounded, abstaining below n=8, taken strictly before the current error is recorded, and surviving both rollback and restart. (2) **Every channel now derives its own Kalman `q` and `r` from its own innovation sequence.** `r = var(innovation) - mean(P_prior)`; `q` from the lag-1 whiteness of the same sequence. `r` is split into `rBase * rGain` because measurement and attention were writing to one field, so each derivation silently erased every attention change since the last one — an efference copy would then be scored against a variable something else had already reset. **VALIDATED ON HELD-OUT DATA:** `test/noise-control.js` adapts on the first 60% of the recorded corpus, freezes the parameters, and scores the remaining 40% on normalised innovation squared. Derived beats declared on **4 of 5 live channels**, summed miscalibration **-6.74**. It is on by default because that measurement says so, not because "derived" sounds better than "set". **WHY STILL PARTIAL:** the six critic weights, the trust gate (`trustN: 8`) and the accumulator bound (`evidenceBound: 0.35`) are still SET, and none of them has a control comparison yet. |
| **24** | Lateral connectivity between peer domains | **PARTIAL — and read the first sentence before the rest. ZERO PEER DOMAINS EXIST.** One domain is bound, so connectivity between peers has never once occurred, and nothing below changes that. What is built is `kernel/lateral.js`, a bounded peer bus with four separate bounds, verified by 35 assertions against **synthetic** peers. (1) **Echo suppression**, the load-bearing one: every message carries the set of domains that contributed to it, and a domain refuses any message its own id appears in. This is reafference cancellation at the domain level — without it A informs B, B's state moves, B publishes, and A receives its own signal back wearing a different name and counts it as independent corroboration. Two domains then converge on whatever A believed first and report high agreement, which is the most convincing possible way to be wrong. A relayer cannot erase itself from the chain it relays. (2) **Influence cap:** total admitted foreign precision is capped at 50% of the receiver's own, so a chorus of weak peers cannot outvote an instrument, and a domain that has measured nothing admits *nothing* — corroboration cannot substitute for an instrument. (3) **Hop bound** with per-hop precision decay, so a closed cycle in the peer graph terminates rather than being forbidden; real domains are not a tree. (4) **Declared links only,** each naming the latent both domains observe, the same commitment `divergence.relate` requires. Peers carry evidence, never commands: there is no `set`/`write`/`force`/`actuate` verb in the API and a received message stays labelled `foreign`. It is deliberately **not wired into the loop** — with one domain that would be a no-op presented as integration — and `report()` carries `satisfiesRow24: false` so runtime output says so too. **Copying energy into a fake finance domain would make every cross-domain agreement an artefact of the copy**, which is worse than no peer, because no peer is visibly missing. |
| **25** | Topology-editing mechanism (pruning) | **PARTIAL.** `kernel/topology.js` (97 assertions) edits the GRAPH, not weights: `candidate -> active -> weakened -> dormant -> reactivated`, driven by resolved utility `(useful-harmful)/total` and never by traffic, so an edge that fires twice a year is not pruned for being rare. Separate promote/demote thresholds plus a dwell time stop boundary oscillation. A suppressed edge is RETAINED with its history and reason; retirement is reviewer-only, because automatic suppression and permanent removal are different classes of decision. Wired into the live loop and consulted by `route()` **last and only subtractively**, which is the structural guarantee that an edit cannot smuggle a packet past a type, domain or provenance rule. Round-trips through `LOOP.serialize`/`restore` on the real path. **WHY PARTIAL: no edge-level credit signal exists in this build, so the mechanism has never taken a decision from real observations.** Two defects in the only signal available (prediction hits, attributed to whichever edges carried the trace): it measures the forward model and the channel rather than the edge, and it is trace-level, so co-firing edges are graded identically — measured, `integration:ascending` and `integration:descending` finish byte-identical on every counter over 332 real outcomes. Credit is therefore REFUSED in `loop.js` and the refusal is written to the log, rather than approximated. A valid signal needs a counterfactual against a target that does something observable, which is the same missing peer **row 24** is blocked on. |
| **27** | Cadence derived from each domain's own event spacing | **COMPLETE**, as of the liveness fix. `inferCadence` measures the median interval between VALUE CHANGES rather than between polls, and abstains to the declared prior below 6 changes. Both consumers now use the measured period. It shipped half-applied: `predict()` grew uncertainty against the measured value while `observe()` still sampled at the declared one, so the three channels found to change every 1-4h while declared 24h kept discarding 23 of every 24 liveness samples — 2 retained of 48, against 43 now. **Open modelling question:** the interval between value changes is a process timescale, not necessarily a reporting cadence, and with `CHANGE_EPS` at 1e-9 a noisy continuous feed will "change" every poll and collapse the estimate back to the poll rate. Arrival cadence and state-change timescale should eventually be tracked separately. |

---

## A finding the divergence lifecycle produced on its first real run

Replaying all 362 hours with the lifecycle wired in, **it fired nothing** — and the reason
is a defect in the energy binding rather than in divergence:

- **6 of the 7 declared energy relationships are dead letters.** `fredCrude/eiaPetro`,
  `fredCrude/massiveOil`, `natGas/lng`, `solar/wind`, `nuclear/fedRegNrc` and `coal/solar`
  were skipped on **every one of 362 cycles**, because one side is permanently non-fusable
  — 11 of 18 energy channels are dead. Those six declarations cannot produce a divergence
  in either direction no matter what the world does.
- The seventh, `gridRel/electricity`, was comparable in **140 of 362** cycles and never
  cleared 2 se.

So the lifecycle is proven on constructed fixtures and has never run in anger. Both facts
are asserted in `test/divergence.js` T21, so reviving those channels will fail the test and
force the numbers to be re-read rather than letting a stale "0 divergences" pass as calm.

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
