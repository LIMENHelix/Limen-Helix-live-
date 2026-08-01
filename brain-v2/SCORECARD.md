# BRAIN-V2 vs THE COMPLETENESS CHECKLIST

Scored 2026-08-01 against **LIMEN Helix — The Complete Working Brain v1.0**, Part 8.
Honest score: **3 pass, 1 partial, 24 fail.**

That is not a bad result for one day. It is a precise one, and it is the first time this
project has had a number instead of an impression.

---

## PASS (3)

| # | Test | Evidence |
|---|---|---|
| **8** | ≥2 interoceptive channels live per domain | 18 declared in `bind/energy.js`; **6 live** on 361 hours of real replay (fredCrude, nwsAlerts, cisaKev, gridRel, petroStatus, electricity) |
| **9** | A channel inventory exists and feeds confidence | `sensors[]` carries `state ∈ {measured, absent, dead, unknown}` per channel; `blind[]` is mandatory; `state.confidence = totalPrecision/(totalPrecision+1)` is computed **only from channels that passed the liveness gate**. Lose channels → confidence falls. **This is INV-13 / the anosognosia fix, and it is the first thing that got built.** |
| **26** | Precision derived per-channel from own noise, never consensus | `precision = 1/P`, where `P` is that channel's own Kalman covariance. Agreement between channels contributes **nothing** to weight. B0's hard rule, satisfied by construction rather than by discipline |

---

## PARTIAL (1)

| # | Test | Where it stands |
|---|---|---|
| **27** | Each domain's cadence derived from its own event spacing | Cadence is **declared** per channel and liveness/baseline sampling now happens at that cadence — fixed today after the replay flagged `fredCrude` DEAD for the crime of being a daily series read hourly. But cadence is still *asserted in the manifest*, not *derived from observed spacing* (B3/B17). Half the requirement |

---

## FAIL (24)

Grouped by what is actually missing, not row order.

**No motor path at all — B11, B14 (rows 1, 2, 3, 20)**
Nothing executes. No subscriber, no `executed` flag, no efference copy, no refractoriness or
adaptation. `efferent.declaredNone = true` — the brain says so rather than implying otherwise,
which satisfies R7 of my own contract but satisfies **none** of B11.

**No inhibition (rows 4, 5)**
There is no inhibitory mechanism of any kind — not scalar, not shunting. The precision floor is
a threshold, not inhibition. Rows 4 and 5 are not "partially met by the gate"; they are absent.

**Feedforward-only — INV-7 violation (rows 6, 7, 24)**
No descending path. No L6 equivalent. No lateral connectivity between domains. Every channel
reports up; nothing predicts down. **This is the pathology the document names as the root
failure the project keeps rediscovering, and I rebuilt it.** Partial credit on row 7 only: the
quantity that ascends *is* a residual (departure from the channel's own baseline), so it is a
local prediction error — but there is no top-down prediction to subtract, so it is not L5.

**No selection (rows 17, 18, 19)**
No basal ganglia. No default-deny, no hyperdirect stop, no actor/critic separation.

**One modulator, and it isn't one (row 11)**
Zero neuromodulators. Precision is a weight, not a modulator — it cannot gate plasticity,
interrupt, switch encode/consolidate, or set a horizon.

**No consolidation (rows 12, 13, 14, 15)**
No offline state, no write authority, no downscaling, no differential retention.

**No removal (rows 16, 25)**
INV-1 violated wholesale. Channels can be added; nothing prunes. No topology editing.

**No learning (rows 21, 22, 23)**
No `M`, because there are no resolved outcomes to derive one from. `q` and `r` are hand-set
`[mark: prior]` per channel — **this is precisely the metaplasticity gap the document names as
the most-repeated finding in the project's history, and I widened it by 18 constants.**

**No boundary (row 28)**
No B1. External content enters the same substrate as internal state.

---

## WHERE brain-v2 SITS IN THE BLOCK MODEL

**B0 (afferent interface) + the channel-inventory half of B17 + the inventory requirement of B5.**

One block of eighteen, plus one requirement borrowed from a second.

It is, however, the correct first block by the document's own argument: B5 is named as *"the
block the current system is most specifically lesioned in"*, and the channel inventory is
described as the thing that separates alexithymia from **anosognosia** — losing a sense versus
not knowing you lost it, where the second *"produces confabulation"*.

Today's replay is that inventory doing its job: energy declares 18 channels, and **10 of them
have not moved in two weeks**. Nothing in the system said so before.

---

## THE ORDERING CONSTRAINT I NOW HAVE TO RESPECT

Part 15 says B14 is not Phase 3 material — efference copy must exist **before the first real
action executes**, or the system scores its own effects as external validation.

That is not hypothetical here. `lib/limen-policy.js` `recommendLane()` already applies
propagator network stress to lane salience, and `limen-worker-autoqueue` is the consumer —
**paused since 2026-06-01 pending Gate A.** That paused handler *is* B11 for the opportunity
path. When it unpauses, the system will change which companies surface, then read the changed
surfacing as evidence, with no efference copy anywhere in the stack.

**Gate A should not open without B14.** That is a concrete, dated consequence of Part 15, not a
restatement of it.

---

## THE ONE THING I WOULD ADD TO THE SPEC

The document is right about *what* is required. It is silent on *what can be validated versus
merely instantiated*, and at this data budget that distinction bites.

Measured: ~250 resolved observations per domain, ~14 nominal sensors, **6 that actually move**.
At a ~10% event rate that is under 2 events per variable, against a literature floor of 10
(Peduzzi 1996) and ~20 for stable held-out estimates (Austin & Steyerberg 2017).

Consequence for the build: **B12's modulators, B10's critic, B13's tagging thresholds and
B17's learning rates cannot be fitted. They can only be set.** That is not an argument against
building them — INV-6 and INV-11 stand — but every parameter in those blocks must ship marked
`[mark: prior]` and stay marked until outcomes accumulate. Blocks that *require* fitted
parameters to be meaningful should be built last, not first, regardless of where they sit in
the anatomy.

This is the same failure class as 180 diagnoses against 14 conditions: an architecture whose
resolution exceeds its evidence. The spec's own INV-13 and B17 confidence rule are the guard;
this note just names the budget explicitly.

---

## NEXT, GIVEN THE SPEC

Not more B0. The honest order from Part 6's loop dependencies:

1. **B14 first, alone.** Efference copy is cheap — a record of what was commanded and a
   prediction of what should follow. It has no dependencies and it is the precondition for
   every outcome-based block being trustworthy. It can be built before B11 exists.
2. **B11 immediately after, with B14 already in place.** Close L3 and L4 together.
3. **B9 descending** — the L6 equivalent. Fixes the INV-7 violation I just rebuilt.
4. Everything else in loop order.
