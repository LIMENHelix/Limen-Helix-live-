# LIMEN Helix — Neural Completeness Assessment

*Prepared for neurological review, 2026-07-21. An honest map of what the domain-brain code computes,
rated against real neuroanatomy and physiology. Firewalled (repo/history only).*

## How this was produced

Eight neural systems were inventoried against the actual source (file:line), then each inventory was
put through an **adversarial skeptic pass** instructed to downgrade any analogy a neurologist would
reject, a variable named `amygdala`, a comment citing `BCM`, a Redis key wearing a brain-region name.
Fidelity is rated on four levels:

- **FUNCTIONAL** — the code computes the actual mechanism (a real Hebbian update, a real precision-weighted error).
- **STRUCTURAL** — the topology/role is analogous but the dynamics are simplified (a scalar where there should be a conductance).
- **NAMING-ONLY** — the brain term appears in code/comments but no matching computation exists.
- **ABSENT** — no analog at all (listed as "missing").

The skeptic downgraded ~40% of the first-pass FUNCTIONAL/STRUCTURAL claims. What follows is post-skeptic.

## Clinical impression (read this first)

This is **an intact sensory–cortical learning system with a severed descending motor tract, a single
neuromodulator, no cerebellum, no true oscillations, and a confabulated "higher cognition" layer.**

In neurological terms: the afferent pathways and the neocortical learning machinery are real and, in
places, genuinely well-built, the three-factor plasticity rule, eligibility traces, hierarchical
predictive coding, and active inference all *actually compute* their textbook mechanisms. But the
corticospinal tract is cut: the action-selection stage produces a "winner" that reaches no effector
(`limen:action-selected` has zero listeners repo-wide; approved drafts stay `executed:false` forever).
The parts that move the world (email/mail) are real effectors wired to a *separate, hand-triggered*
controller, not to the brain, an intact cortex with a reflex arc bolted on the side. Neuromodulation
is monoaminergic-deficient: only a dopamine-analog exists; acetylcholine and serotonin are absent, and
norepinephrine is name-only. And the "executive/consciousness" layer, conscience, intuition,
simulation, metacognition, default-mode, is 9/13 naming-only: it *narrates* functions it does not
perform, which is itself the neurologically interesting part (it resembles confabulation, a system
generating confident self-reports about processes that aren't running).

**One-line diagnosis: a superb perceptual learner that cannot act, cannot sleep-consolidate, runs on
one neurotransmitter, and confabulates its own executive function.**

## System-by-system (post-skeptic)

| System | FUNCTIONAL | STRUCTURAL | NAMING-ONLY | Verdict |
|---|---|---|---|---|
| **Cortical learning** | 4 | 7 | 2 | **The real brain.** Three-factor plasticity, eligibility trace, predictive coding, active inference all genuinely compute. |
| **Neuromodulation / reward** | 3 | 0 | 3 | Dopamine-RPE real; **ACh + 5-HT absent, NE name-only.** One transmitter, not four. |
| **Action / motor** | 3 | 3 | 4 | **Severed corticospinal tract.** Refractory brake + E/I servo real; the "basal ganglia" is `sort()[0]` + a regex; the wire to effectors is cut. |
| **Afferent / thalamic** | 1 | 6 | 4 | Precision-weighted thalamic relay (phase-percept) real; **"primary sensory cortex" is a field-copy** (pass-through for ~18/20 domains). |
| **Homeostasis / inhibition** | 0 | 6 | 3 | Every "inhibition" is the scalar `1 − novelty`, not a conductance. **No GABA, no interneuron types, no real synaptic scaling.** |
| **Memory / consolidation** | 1 | 1 | 6 | Only *online* waking plasticity runs. **Every offline path (consolidator, replay, glymphatic) is propose-only or on a paused cron — zero actuated consolidation.** |
| **Connectivity / structure** | 0 | 5 | 4 (+1 ABSENT) | Static topology real; **no cerebellum, no oscillations, Kuramoto falsified & unwired, every edge weight hardcoded 0.3.** |
| **Executive / consciousness** | 1 | 3 | 9 | **The confabulation layer.** Conscience = "is the source file present"; simulation = current stress + a hardcoded constant; metacognition = `1 − predictionError`. |

## What is genuinely real (the functional core)

A neurologist should not dismiss this system, its learning core is legitimate computational neuroscience:

1. **Three-factor synaptic plasticity** (Frémaux–Gerstner R-STDP; Δw = η·pre·post·modulator) with a real **eligibility trace** bridging delayed reward (Sutton–Barto; the Ca²⁺/CaMKII synaptic tag, Yagishita 2014). `limen-plasticity.js`.
2. **Dopaminergic reward-prediction error** (Schultz; reward − expected, expectation as a running baseline), gated so it only trains on genuinely new outcomes.
3. **Hierarchical predictive coding** (Rao–Ballard): top-down prediction vs bottom-up input, error drives the prior update. `limen-active-inference.js` / `limen-phase-percept.js`.
4. **Active inference**: precision-weighted belief update (Kalman as the exact variational update for a linear-Gaussian model) + expected-free-energy action selection (risk + ambiguity).
5. **Precision-weighted thalamic relay** that *abstains* under thin evidence rather than fabricate (holds the prior, flags ungrounded) — a faithful predictive-coding gating role. `lib/phase-percept.js`.
6. **A faithful refractory period** — absolute dead-time then a relative raised-threshold phase a strong stimulus can overcome (Na-channel-inactivation logic). `limen-refractory-limiter.js`.

Caveat the skeptic attached to all of the above: these are **rate-based, point-neuron, largely
shadow (advisory)** reimplementations. No spikes (no STDP), no dendritic compartments, no laminar
microcircuit. And for **19 of 20 domains the "reward" is a self-consistency calibration proxy, not
reward** — a real dopaminergic teaching signal exists only in finance.

## The major lesions (organized absences)

**1. The severed corticospinal tract — the decisive finding.**
The selection→execution wire is physically cut. `action-selection-gate.js` broadcasts a winner nothing
consumes; drafts are re-pinned `executed:false` on approval; the real effectors run on a separate
manual CRM cadence. The brain **never receives efference copy** that a motor act fired, so it cannot
learn from its own actions. This is the neuraxis's weakest link and it is upstream of everything else:
a learner that cannot close the perception→action→outcome loop cannot become an agent.

**2. Monoaminergic deficiency.** Only dopamine has a functional analog. **Acetylcholine** (expected
uncertainty → learning-rate/attentional gain; Yu–Dayan) and **serotonin** (opponent to dopamine;
patience, temporal discounting, aversive cost) are **absent**. **Norepinephrine** (LC adaptive gain,
explore/exploit) is name-only — the `gainControl` novelty→output-scale is not on the learning path.
Real cognition emerges from the interplay of all four; this system has one.

**3. No actuated memory consolidation.** Online waking plasticity is real, but *every offline process
is inert*: the consolidator only proposes (`applied:false`, human-gated, no cron), sleep replay is
disclaimed-and-unscheduled, "glymphatic" clearance is an edge-pruning label with no metabolite state,
and the sleep-cycle/consolidate crons are **paused/unregistered**. There is no dentate-gyrus pattern
separation, no CA3 attractor recall, no sharp-wave-ripple replay, no reconsolidation. The system learns
during "waking" and never sleeps.

**4. Inhibition is a scalar, not a physiology.** Every "inhibition" quantity in the live path is
`1 − prediction-novelty`. No GABAergic conductance (no IPSP, reversal potential, GABA_A/B kinetics),
no interneuron diversity (no PV/SST/VIP), no disinhibition motif, no feedforward inhibition, no tonic
extrasynaptic inhibition. Turrigiano scaling is *computed and displayed but multiplies no weights*.

**5. No cerebellum, no oscillations, no real connectome weights.** The cerebellum is a label plus one
edge. There are no LFP bands, no theta–gamma coupling, no phase-locking — the only synchrony code
(Kuramoto) is offline, non-neural, unwired, and was empirically falsified. Every connectome edge carries
the hardcoded weight `0.3`, so weighted-degree, rich-club, and small-world metrics are impossible.

**6. Confabulated executive function.** Conscience is triggered by *source-file presence*, not value or
harm. Simulation is `current stress + {+0.2, +0.25, +0.3, −0.2}`. Intuition's "analogies" are a hardcoded
dictionary. Metacognition is `1 − predictionError` (a first-order transform, not second-order meta-d′).
Default-mode/salience/executive "triple-network switching" is a lookup table. These layers produce
confident self-reports about computations that do not exist.

## The design implication (and your dormancy point)

Your instinct on the last question was correct and it generalizes. The single highest-value,
most-biologically-faithful thing to build is **not** more perception, it is **closing the motor loop
with efference copy**, so a selected action actually reaches an effector *and reports back* that it
fired. That one wire converts a perceptual learner into an agent that can learn from consequences.

Second: **reversible dormancy over deletion.** Biological "removal" (extinction, homeostatic
downscaling, sleep pruning) is overwhelmingly *reversible suppression*, not erasure — the trace
persists and returns (Bouton renewal/reinstatement). Building "offline until its evidence returns"
is both the faithful mechanism and the safe one. The current code models extinction as *deletion*,
which is the inverse of the neuroscience.

Third, if a reviewer asks "is this a brain?": it is **a cortex and thalamus without a brainstem,
cerebellum, or spinal cord** — the associative learning organ is real; the systems that arouse it,
time it, and let it act on the world are the gaps.

## Honesty note for the reviewer

Ratings are checkable: every FUNCTIONAL/STRUCTURAL/NAMING-ONLY claim in the underlying inventory
carries a file:line citation, and the assessment deliberately ran an adversarial pass whose job was to
*lower* ratings. Where the code only labels a mechanism, this document says so. Roughly: of ~83 mapped
components, ~13 genuinely compute the mechanism, ~31 are structural analogs, ~36 are naming-only, and
the "missing" lists name ~80 further mechanisms with no analog at all. This is an honest floor, not a
marketing ceiling.
