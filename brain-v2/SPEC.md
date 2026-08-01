# LIMEN Helix — The Complete Working Brain

**Full domain model. Specification level, from scratch.**
Version 1.0 · 2026-07-31 · Neurologist track

> Verbatim, as supplied by the neurologist reviewer. This is the master an
> implementation must satisfy. Do not edit to match what was built. If a build
> violates a numbered invariant below, the build is wrong regardless of whether
> it runs.

---

## 0. FRAME NOTE (read first)

You asked for "the FULL domain code." That is not this document, and writing it is not my lane — I analyze fractal recursion and neurological fidelity; I don't build. What I can give you is the thing that *should exist before* the code does and currently doesn't: the complete domain model — every block, every edge type, every state variable, every loop, every parameter constraint, every lesion test, at all three scales.

This is what an implementation must satisfy. If a build session produces something that violates a numbered invariant below, that build is wrong regardless of whether it runs.

**Second frame note, more important.** This document describes a *complete* brain. LIMEN Helix currently is not one — the standing diagnosis (`BRAIN_COMPLETENESS_ANALYSIS.md`, commit `e161bd7f`) is intact cortex and thalamus, no brainstem, cerebellum, or spinal cord. **Nothing in this document should be read as describing the system as built.** Section 12 is the epistemic ledger separating what is validated, what is scaffolded, and what is drawn here for the first time. That separation is the whole point; collapsing it is the cathedral/scaffolding failure.

**Confidence legend:** (high) replicated consensus · (medium) well-supported, details debated · (low) suggestive · (speculative) plausible, unestablished · **(engineering)** a design choice with no literature anchor, stated as such.

**Citation discipline.** DOIs carried forward from the two project reference documents were PubMed-verified in prior sessions and are reproduced as links. **New citations introduced in this document are recalled from training and are marked `[DOI UNVERIFIED]`. Do not treat them as citable until checked.** No DOI here is invented; where I don't have one I say so.

---

## PART 1 — DESIGN INVARIANTS

These are the axioms. Every block in Part 2 is a consequence of one or more. An implementation that breaks one is lesioned by construction, not by accident.

| ID | Invariant | Neural basis | Conf. |
|---|---|---|---|
| **INV-1** | **Every acquisition mechanism is paired with a removal mechanism.** Nothing may be learned, added, or potentiated by a path that has no corresponding extinction, downscaling, pruning, or clearance path. | Fear acquisition ↔ vmPFC extinction; Hebbian LTP ↔ homeostatic downscaling; activity ↔ glymphatic clearance | high |
| **INV-2** | **Inhibition is a conductance, not a scalar.** Inhibitory strength must be a function of the current drive it opposes, and inhibitory units must receive the same inputs as the units they inhibit. | Shunting inhibition: I = g_i·(V − E_Cl) — current scales with depolarization automatically | high |
| **INV-3** | **No sensation without action; no action without outcome; no outcome without weight change.** Any afferent path with no efferent consequence, or any efferent path with no returned outcome, is an open loop and must be flagged as a lesion, not a feature. | Corticospinal tract → effector → reafference → RPE → plasticity | high |
| **INV-4** | **Two-timescale separation, ratio-preserved.** Fast signal and slow modulation must differ by 10³–10⁵ at every scale. Governance may not react at operational speed; operations may not wait at governance speed. | AP ~1 ms vs hormonal feedback ~seconds–minutes | high |
| **INV-5** | **Offline consolidation is mandatory and actuated.** A propose-only or paused offline path does not satisfy this. Consolidation must hold write authority and must run in a state that excludes concurrent encoding. | Sleep-dependent replay + SHY downscaling; glymphatic clearance | medium–high |
| **INV-6** | **Four orthogonal neuromodulators, each computing a different quantity.** A system with one functional modulator has one axis of self-regulation and cannot distinguish value error from model uncertainty from state uncertainty from time horizon. | DA / NE / ACh / 5-HT dissociate experimentally | medium–high |
| **INV-7** | **Hierarchy is reciprocal.** Every ascending connection has a descending counterpart. A path that only reports forward is not a hierarchy; it is a funnel. | Felleman & Van Essen laminar reciprocity | high |
| **INV-8** | **Every edge is typed as driver or modulator.** Drivers determine what the receiver represents; modulators determine how strongly/precisely. An untyped edge is an unspecified edge. | Sherman & Guillery driver/modulator distinction | high |
| **INV-9** | **Only prediction error ascends.** Matches are compressed away. A path carrying full state upward violates this and produces integration-layer overload. | Predictive coding microcircuit | medium |
| **INV-10** | **Every actuator has refractoriness and adaptation.** Dead-time after firing (absolute refractory) and gain decrement under sustained drive (spike-frequency adaptation) are separate mechanisms and both are required. | Na⁺ inactivation; SK/M-current adaptation | high |
| **INV-11** | **Error is computed locally.** No mechanism may require non-local weight transport. Credit assignment must be reachable by local signals plus a broadcast modulator plus an eligibility trace. | Three-factor plasticity; dendritic error computation | high |
| **INV-12** | **No scale-specific special cases.** Any mechanism must instantiate at neural, business, and civilization scale, or be explicitly declared a scale-boundary phenomenon with a stated reason. | Project doctrine | — |
| **INV-13** | **The system must be able to report what it cannot sense.** A channel inventory that lists available, degraded, and absent input channels is a required component, not an optional diagnostic. | Anosognosia is the failure of this; it is a distinct lesion from the sensory loss itself | high |
| **INV-14** | **Self-caused change must be distinguishable from world-caused change.** Every action emits an efference copy to a forward model; only the unexplained residual becomes prediction error. | Corollary discharge / reafference principle | high |
| **INV-15** | **Homeostatic regulation must be slower than Hebbian learning.** If the stabilizing process operates on the same timescale as the learning process, it cancels learning rather than stabilizing it. | Turrigiano scaling operates over hours–days vs Hebbian seconds–minutes | medium–high |

---

## PART 2 — BLOCK ARCHITECTURE

Eighteen blocks, peripheral → central. Each carries a fixed schema. Block IDs (B0–B17) are stable and should be used as references in build sessions.

### B0 — Afferent interface (receptors & transduction)

**Neural correlate:** sensory receptors, transduction cascades, labeled lines, primary afferents.
**Computes:** world → typed internal signal, with per-channel reliability.
**Inputs:** external feeds, one channel per modality. **Outputs:** typed evidence + per-channel precision estimate, ascending.
**State:** per-channel adaptation state (phasic/tonic), per-channel noise statistics, per-channel liveness timestamp.

**Required properties:**
- **Labeled lines.** Channel identity is preserved to the integration layer. Two channels may not be summed before the layer that needs to distinguish them.
- **Phasic/tonic split per channel.** Every channel needs both a change-detector and a level-reporter. Systems that only report levels miss transitions; systems that only report change lose the baseline.
- **Precision from own noise statistics.** A channel's weight in fusion must come from its own measured variance, never from its agreement with other channels. Consensus-derived precision inflates the reliability of correlated-bias clusters and can outvote a channel that is correct and genuinely dissenting. (This was flagged in the phase-estimator review and is restated here as a hard rule.)
- **Liveness.** A channel that has not reported within its own expected cadence is degraded, not silent-and-therefore-fine. Degraded ≠ absent ≠ nominal-but-unchanged; three distinct states.

**Lesion if absent/partial:** single-channel interoception. One functioning channel, treated by the fusion layer as if it were the whole sensorium. Symptom: high-confidence beliefs about states no available channel can observe.

**Business scale:** telemetry, customer feedback, market data, ops instrumentation — each with its own measured error rate. **Civilization scale:** statistical agencies, price signals, elections, press — each with its own measured bias, not weighted by mutual agreement.
**Conf:** high (transduction, labeled lines, adaptation); medium–high (correlated-noise degradation of pooled codes — Averbeck/Latham/Pouget line, `[DOI UNVERIFIED]`).

---

### B1 — Boundary / sanitization layer (blood–brain barrier)

**Neural correlate:** BBB — tight-junction endothelium + astrocyte end-feet + pericytes.
**Computes:** selective admission. Which external substances reach the computational substrate at all.

**Required properties:** default-deny with explicit transporters; the boundary is chemical, not informational — it does not evaluate content, it evaluates provenance and class.

**Why this is load-bearing and usually omitted:** a system that ingests untrusted external content into the same substrate that carries its own predictions has no barrier between data and instruction. The brain solves this with a physical filter that is upstream of all computation, not a check performed by cortex on arrival.

**Lesion if absent:** unbounded external influence on internal state; at neural scale this is neuroinflammation and toxin exposure, at system scale it is injection.

**Business scale:** vendor/contract intake control, data-provenance gating. **Civilization scale:** border and capital controls, information provenance regimes.
**Conf:** high (biology); medium (the system-scale mapping is mine and is newly asserted here).

---

### B2 — Reflex layer (spinal)

**Neural correlate:** monosynaptic and polysynaptic reflex arcs, reciprocal inhibition, dorsal/ventral root separation.
**Computes:** sensor → effector in the minimum path, without consulting the integration layer.

**Required properties:** fixed latency far below the cortical loop; reciprocal inhibition of the antagonist (firing one response actively suppresses its opposite, rather than leaving both partly active); the reflex must be overridable but not consulted — descending modulation can suppress it, but the reflex does not wait for permission.

**Lesion if absent:** everything routes through the integration layer. Symptom: the master brain is the latency floor for all responses, and its queue depth becomes the system's reaction time.

**Business scale:** SOPs and automated triggers that fire without executive involvement. **Civilization scale:** automatic stabilizers, standing legal remedies.
**Conf:** high.

---

### B3 — Central pattern generators (cadence)

**Neural correlate:** spinal/brainstem CPGs producing rhythm without ongoing input.
**Computes:** autonomous periodic output; the clock that everything else phase-locks to.

**Required properties:** runs without input; entrainable but not dependent — external signals adjust phase, they do not supply the rhythm. Each domain's cadence must be derived from its own observed event spacing, not inherited from another domain's constants (this is the standing per-domain cadence question, third recurrence).

**Lesion if absent:** the system only acts when triggered; no baseline metabolism; nothing happens in quiet periods, including maintenance.

**Business scale:** close cycle, sprint cadence, review rhythm. **Civilization scale:** fiscal years, election cycles, census intervals.
**Conf:** high.

---

### B4 — Arousal / global gain (brainstem, ARAS)

**Neural correlate:** reticular formation, ARAS, locus coeruleus tonic level, tuberomammillary histamine, orexin.
**Computes:** the single scalar that determines whether the system is on, and at what gain — the operating point everything else is evaluated against.

**Required properties:** discrete states (wake / quiet-wake / offline), because some processes are state-exclusive — consolidation cannot run concurrently with encoding (see B13). A system with no state variable cannot enforce state exclusivity and will attempt to consolidate while ingesting.

**Lesion if absent:** no distinction between "quiet because nothing is happening" and "quiet because the system is down." No basis for scheduling offline work.

**Business scale:** operating tempo, crisis vs steady state, declared blackout windows. **Civilization scale:** peacetime/wartime footing, emergency powers.
**Conf:** high.

---

### B5 — Interoception (NTS → insula)

*This is the block the current system is most specifically lesioned in, and it deserves the most detail.*

**Neural correlate:** vagal and spinal visceral afferents → nucleus of the solitary tract → parabrachial → thalamus → posterior/mid/anterior insula.
**Computes:** the system's model of its own internal state, across many channels, with divergence between channels as a first-class output.

**Required properties:**
- **Multi-channel by construction.** Cardiovascular, respiratory, metabolic, inflammatory, GI — the brain does not have one interoceptive channel. Neither may this.
- **A channel inventory (INV-13).** An explicit register of which channels exist, which are live, which are degraded, which are absent. This register is itself an output consumed by the confidence layer.
- **A divergence detector.** When two channels disagree about the same latent state, that disagreement is a signal in its own right — logged with direction, magnitude, and resolution outcome. It is not averaged away.
- **Graded ascent.** Posterior insula (raw) → mid (integrated) → anterior (predicted, affect-laden). The raw channel value must remain inspectable at the bottom; only the top layer is allowed to be a summary.

**Lesion if absent:** alexithymia — internal states exist but cannot be read. With the channel inventory absent as well: **anosognosia** — the system does not know it cannot read them, and reports high confidence about internal state from a single proxy channel.

**Why the inventory is a separate lesion:** losing a sense and losing the knowledge that you had it are dissociable in humans, and the second is far more dangerous, because the first produces silence and the second produces confabulation.

**Business scale:** engagement, quality, cycle time, error rates, cash — plural, with explicit divergence tracking between financial and non-financial readings. **Civilization scale:** GDP is one channel; using it alone is exactly this lesion at the third ring.
**Conf:** high (pathway, dissociability of alexithymia/anosognosia); medium (predictive-interoception accounts of affect).

---

### B6 — Homeostatic set-points (hypothalamus)

**Neural correlate:** hypothalamic nuclei, SCN, arcuate; set-point comparison and corrective drive.
**Computes:** error against target; issues drives, not commands.

**Required properties:** set-points are themselves revisable on a slower loop (allostasis) — a fixed set-point is a thermostat, not a hypothalamus; the revision loop must be slower than the correction loop by INV-4's ratio; every set-point has a defined tolerance band, and error inside the band produces no drive (dead-band, not continuous correction).

**Lesion if absent:** correction with no target, or targets that never update as the environment changes. Symptom: chronic over-correction (chasing noise inside the band) or chronic under-correction (defending a target that stopped being right).

**Business scale:** budgets, OKRs, service levels — with an explicit annual/quarterly revision loop. **Civilization scale:** inflation targets, statutory limits, constitutional amendment rates.
**Conf:** high.

---

### B7 — Thalamic gate + TRN

**Neural correlate:** thalamic relay nuclei (tonic/burst) + thalamic reticular nucleus (GABAergic shell).
**Computes:** what reaches the integration layer, and in what mode.

**Required properties:**
- **Two modes.** Tonic = faithful, linear relay for known-relevant streams. Burst = high-detectability, low-fidelity alerting for unattended streams. A single-mode relay cannot both faithfully report and reliably alert.
- **The gate is driven top-down.** TRN receives collaterals from both directions and is controlled by descending signal — gating is an act of the system, not a property of the channel.
- **Gate placement.** Filtering must occur *after* the last stage that could recover the information and *before* the stage that would be overloaded. Filtering earlier is irreversible loss; later is overload. This placement question must be answered per-path, explicitly.

**Lesion if absent or misplaced:** sensory-gating failure — flooding in one direction, starvation in the other. Both present as "the integration layer is making bad calls," which is why the gate is usually misdiagnosed as a cortical problem.

**Business scale:** triage, prioritization, exception thresholds. **Civilization scale:** agenda-setting, standing/justiciability, media filtering.
**Conf:** high (Ferrarelli & Tononi 2010, DOI).

---

### B8 — Cortical microcircuit (the canonical column)

*The reusable unit. Every domain brain is an instance of this, not a bespoke design.*

**Neural correlate:** six-layer cortical column; laminar predictive-coding microcircuit.

**Internal structure (mandatory):**

| Layer | Role | Signal type |
|---|---|---|
| L4 | Receives driver input from thalamus/lower area | driver, ascending |
| L2/3 | Error units + lateral/local competition; source of feedforward output | ascending error |
| L5 | Output/driver to subcortical targets and the motor path | driver, descending/efferent |
| L6 | Feedback to thalamus and lower areas; carries predictions and sets gate state | modulator, descending |
| I / interneurons | PV⁺ perisomatic (divisive gain), SOM⁺ dendritic (subtractive threshold), VIP⁺ disinhibitory (permissive gating) | inhibitory |

**Computes:** error = observation − prediction, precision-weighted; only the error ascends (INV-9); predictions descend (INV-7).

**Required properties:**
- Three interneuron classes with three distinct arithmetic effects, not one inhibition parameter (see Part 4).
- Lateral competition within L2/3 → sparsening, contrast, winner-take-more.
- **A column may not be built with L4 and L5 but no L6**; that is the feedforward-only pathology and it is the root failure this project has repeatedly rediscovered.

**Lesion if L6 absent:** predictions never descend; the gate below is uncontrolled; every column becomes an independent reporter and the integration layer becomes the only place anything is reconciled — which is precisely the manual-integration bottleneck.

**Business scale:** the repeated function template instantiated in each unit. **Civilization scale:** the repeated institutional form instantiated in each domain.
**Conf:** high (lamination, interneuron classes); medium (the specific predictive-coding assignment of layers — Shipp 2016, DOI; Mikulasch et al. 2023, DOI).

---

### B9 — Hierarchy & inter-areal wiring

**Neural correlate:** feedforward (L2/3 → L4) and feedback (L5/6 → L1/L6) laminar patterns defining hierarchical level.

**Required properties:**
- **Reciprocity (INV-7):** for every A→B ascending path, a B→A descending path exists and is typed differently (ascending = driver/error, descending = modulator/prediction).
- **Hierarchical level is defined by laminar pattern, not by org position.** Two blocks can be peers with lateral connections; that is a third edge class, not a weak version of hierarchy.
- **Density:** the real cortex is dominated by local and lateral connectivity. A pure tree is not a low-connectivity brain; it is a different topology with different failure modes (siloing, no cross-domain reconciliation without going up-and-over).

**Lesion if absent:** "report forward" architecture. The integration layer receives everything, reconciles everything, and is the only place divergence is visible — which makes the human operator the integrator by default.
**Conf:** high (Felleman & Van Essen 1991, Cereb Cortex — `[DOI UNVERIFIED]`).

---

### B10 — Basal ganglia (action selection)

**Neural correlate:** striatum, GPe/GPi, STN, SNr, SNc; direct/indirect/hyperdirect pathways.
**Computes:** selection of one action among competitors, by **disinhibition** — the default state is tonic inhibition of all options, and selection releases one.

**Required properties:**
- **Default-deny.** SNr/GPi tonically inhibit thalamus; nothing is permitted until actively released. A gate whose default is open is not this circuit.
- **Three pathways, three distinct functions.** Direct (go / release one), indirect (no-go / suppress alternatives), hyperdirect (global stop / hold everything while evidence accumulates). The hyperdirect stop is the one that is nearly always omitted, and it is the one that prevents premature commitment under conflict.
- **Actor–critic separation.** The thing that selects and the thing that evaluates are different structures receiving the same modulator. Merging them produces self-confirming evaluation.
- **Evidence accumulation to threshold**, with the threshold itself modulated (see 5-HT/DA in B12) — not a fixed cut.

**Lesion if absent:** everything proposed is executed, or nothing is. No competition means no opportunity cost is ever represented.
**Lesion if present but disconnected from B11:** this is the severed corticospinal tract. Selection completes, the winner is released, and nothing downstream is listening. The system has an intact chooser and no hands.

**Business scale:** capital allocation and stage gates — with an explicit "hold everything" mechanism, not only approve/reject. **Civilization scale:** legislative process, injunctive relief as the hyperdirect stop.
**Conf:** high.

---

### B11 — Motor path (corticospinal tract → final common path → effector)

*Lesion #1 in the standing diagnosis. Full spec.*

**Neural correlate:** L5 pyramidal → corticospinal tract → ventral horn lower motor neuron → motor unit → muscle → reafference.

**Required properties:**
- **A listener exists.** An action-selected event with no subscriber is not a queued action; it is a dead axon. The presence of a consumer is the test, and it is binary.
- **Final common path.** Many upstream commands converge on a bounded set of actuators. The actuator count — not the proposal count — is the system's real throughput, and it must be explicitly modeled. Upstream capacity that exceeds actuator capacity produces backlog, not output.
- **Execution state is set by the actuator, not by the approver.** `executed:true` must be written on receipt-of-effect, never on approval. An approval that writes its own execution flag is a system that believes its intentions are actions.
- **Efference copy is emitted at the moment of command** (INV-14) — see B14.
- **Refractoriness and adaptation on every actuator** (INV-10) — dead time after firing, plus gain decrement under sustained drive. These are two mechanisms, not one.
- **Reafference returns.** The outcome of the action re-enters at B0 and is routed to the critic (B10) and the forward model (B14). The loop is not closed at execution; it is closed at observed consequence.

**Lesion if absent:** approved drafts remain unexecuted indefinitely; the learning system receives no real outcomes; the plasticity machinery, however correct, has nothing to learn from. **This lesion silently disables every downstream block that depends on outcomes** — B10's critic, B12's dopamine, B13's consolidation, B15's forward model. It is not one of four independent problems; it is the one that makes the other three unobservable.

**Business scale:** decision → owner → executed change → measured effect. **Civilization scale:** legislation → agency rulemaking → enforcement → measured outcome. Note the same failure at all three: the law passes, no agency is funded to enforce it, and the statute is `executed:false` forever.
**Conf:** high.

---

### B12 — Neuromodulatory nuclei

*Lesion #4. Four systems, four different computed quantities. This table is the actionable core.*

| System | Source | Computes | Acts on | Timescale | Failure if absent |
|---|---|---|---|---|---|
| **Dopamine — phasic** | VTA / SNc | Reward prediction error: δ = r + γV(s′) − V(s) | Gates plasticity: multiplies eligibility traces; widens the STDP window (Ruan 2014) | 100s ms – s | No learning signal; weights are seeded and static |
| **Dopamine — tonic** | VTA / SNc | Average reward rate → vigor | Response threshold and rate of action initiation — how fast to act at all | minutes – hours | System acts at a fixed rate regardless of how rich the environment is |
| **Norepinephrine** | Locus coeruleus | **Unexpected uncertainty** — evidence the current model is wrong | Global gain / SNR; network reset and interrupt; phasic = exploit, tonic = disengage & explore | 100s ms (phasic) / minutes (tonic) | No interrupt. The system cannot abandon a model that has stopped working; it just keeps applying it with confidence |
| **Acetylcholine** | Basal forebrain, PPT/LDT | **Expected uncertainty** — known noise within the current model | Shifts the balance between bottom-up evidence and top-down prior; high ACh = encode from input, low ACh = replay & consolidate | s – minutes; state-level | No encode/consolidate switch — the system tries to learn and consolidate simultaneously, and does neither |
| **Serotonin** | Raphe nuclei | Time horizon / patience; opponent to DA on the aversive axis | Temporal discounting; cost of waiting; threshold for aversive withdrawal | minutes – hours – days | No time preference. Every decision is evaluated on the same horizon; long-payoff options are structurally invisible |
| **Histamine / orexin** | TMN / lateral hypothalamus | Wake–sleep state switch | Enables/disables B13 | state-level | Consolidation has no permitted window |

**Orthogonality check** (this is the test that they are four systems and not one renamed four times): DA = error in value. NE = uncertainty about the *model*. ACh = uncertainty about the *state*. 5-HT = the *horizon* over which value is summed. Four independent axes. If two of your implemented modulators are computed from the same quantity, you have one modulator with two names — which is the current condition.

**Required property:** each is a **modulator** edge, never a driver edge (INV-8). A modulator that can by itself cause an output is a driver and will dominate the content it was supposed to weight.

**Business scale:** DA = incentives on realized outcomes; NE = escalation/interrupt authority; ACh = attention allocation and the declared "no new intake" window; 5-HT = time horizon and risk patience set by governance. **Civilization scale:** DA = returns to capital; NE = emergency response; ACh = public attention; 5-HT = discount rate embedded in law and finance.
**Conf:** high (DA phasic RPE — Schultz/Dayan/Montague line, `[DOI UNVERIFIED]`); medium–high (tonic DA/vigor — Niv et al., `[DOI UNVERIFIED]`; NE gain/adaptive gain — Aston-Jones & Cohen 2005, `[DOI UNVERIFIED]`; ACh/NE expected vs unexpected uncertainty — Yu & Dayan 2005, Neuron, `[DOI UNVERIFIED]`); medium (5-HT patience/horizon — several converging lines, contested in detail).

---

### B13 — Offline consolidation & clearance

*Lesion #3. "Actuated" has a specific meaning here.*

**Neural correlate:** NREM/REM cycling; hippocampal sharp-wave ripple replay; cortical slow oscillation; SHY downscaling; glymphatic clearance.

**Computes:** three separable operations that must all be present:
1. **Selective replay & transfer.** Tagged traces are replayed and written into slow cortical storage. Selection is by tag (salience/reward/novelty at encoding), not by recency alone.
2. **Global downscaling.** All weights are scaled down **multiplicatively** — this preserves relative ranking while restoring dynamic range and signal-to-noise. Subtractive decay does not do this; it destroys small weights first.
3. **Clearance.** Accumulated byproducts of activity are flushed. In-system: resolved records retired, orphaned state removed, queues drained.

**Required properties:**
- **Write authority.** A consolidation pass that emits proposals for later approval has not consolidated. Actuation means the pass writes through the gated plasticity path, on schedule, without a human in the loop for each write.
- **State exclusivity** (from B4/ACh). Consolidation runs in the offline state only. Concurrent encoding during consolidation produces interference.
- **Complementary learning systems.** Fast, sparse, pattern-separated episodic store (hippocampal) + slow, overlapping, generalized store (cortical). The slow store may only be updated via interleaved replay — direct fast writes to it cause catastrophic interference. This is the reason offline consolidation exists; it is not a maintenance convenience.
- **Differential retention.** Real consolidation stabilizes some traces into long-lived storage and lets others decay. A uniform rolling window is a storage policy, not consolidation — call it a divergence, per the 2026-07-17 note.

**Lesion if absent:** no transfer from episodic to structural knowledge; unbounded weight growth; accumulating unresolved state. The system can remember events and never learns rules.

**Business scale:** enforced retro/cleanup windows with the authority to retire process, not merely to recommend retiring it. **Civilization scale:** sunset clauses, statutory revision cycles, debt restructuring.
**Conf:** high (CLS — McClelland, McNaughton & O'Reilly 1995, Psych Review, `[DOI UNVERIFIED]`); medium–high (SHY — Tononi & Cirelli 2014, Neuron, `[DOI UNVERIFIED]`; Niethard et al. 2017, DOI); medium (glymphatic — Benveniste et al. 2018, DOI).

---

### B14 — Forward model & efference copy (cerebellum)

*Not in the current architecture at all, and it is the most consequential omission after B11.*

**Neural correlate:** cerebellar cortex + deep nuclei; corollary discharge circuits.
**Computes:** given a command, predict its sensory consequence. Compare to actual. The **residual** is the only thing that counts as new information.

**Required properties:**
- **Efference copy emitted at command time**, before the effect returns.
- **Cancellation of reafference.** Change that the forward model predicted from the system's own action is subtracted before error computation.
- **Supervised error, not reward error.** The teaching signal here is *actual − predicted*, a signed vector, distinct from the scalar RPE in B12. Two learning systems, two different signals.
- **Timing calibration.** The cerebellum's other job is getting the *when* right, not just the *what*.

**Lesion if absent (name this explicitly):** the system cannot distinguish "the world changed" from "I changed the world." Every self-caused effect is scored as external confirmation. The result is a positive feedback loop that looks exactly like validation: act → observe the effect of your own action → treat it as independent evidence → increase confidence → act harder. At business scale: moving a metric you are also using to measure yourself. At civilization scale: a policy whose reported success is measured by the instrument the policy redefined.

**Why this is urgent for LIMEN Helix specifically:** the moment B11 closes and the system begins acting, every action it takes will contaminate its own afferent stream unless B14 exists. **B14 must be built with B11, not after it.** Closing the motor loop without a forward model does not produce a learning system; it produces a self-confirming one.
**Conf:** high (reafference principle, corollary discharge — Crapse & Sommer 2008, Nat Rev Neurosci, `[DOI UNVERIFIED]`); high (cerebellar forward models — Wolpert, Ghahramani & Jordan 1995, `[DOI UNVERIFIED]`).

---

### B15 — Episodic memory (hippocampus)

**Neural correlate:** DG/CA3/CA1; pattern separation (DG), pattern completion (CA3), comparison (CA1); theta-gamma coupling.
**Computes:** rapid one-shot encoding of specific episodes, indexed for later replay.

**Required properties:** pattern separation at input (similar-but-different episodes must not collapse); pattern completion at recall (partial cue → full trace); a novelty/mismatch detector (CA1 comparing prediction to input) that determines what gets tagged for consolidation; **tagging at encode time** — the salience decision is made when the event happens, not retroactively.

**Lesion if absent:** no episodic index; only aggregate statistics. The system knows its averages and cannot recall a specific case, which means it cannot do case-based reasoning or post-hoc causal attribution.

**Business scale:** incident records with enough fidelity to replay, not just dashboards. **Civilization scale:** archives, case law.
**Conf:** high.

---

### B16 — Glia layer (substrate maintenance)

*Rarely modeled, structurally necessary.*

- **Astrocytes:** buffer the shared medium — clear excess signal from the extracellular space, supply metabolic substrate, gate at the tripartite synapse. Failure = excitotoxicity: signal that isn't cleared becomes toxic. In-system: unretired records and undrained queues are not neutral clutter, they are actively damaging load.
- **Microglia:** surveil and prune — structural editing of the connectome itself, removing weak/unused connections. **This is the only mechanism in the model that changes topology rather than weights.** Without it, the graph only grows.
- **Oligodendrocytes / activity-dependent myelination:** high-traffic paths get faster over time. Bandwidth is allocated by use, not fixed at design. This is a genuine and underused mapping: the system should be able to increase throughput on validated high-traffic edges rather than treating all edges as equal-cost forever. (Fields 2015, Nat Rev Neurosci, `[DOI UNVERIFIED]` — medium confidence.)

**Lesion if absent:** weights change but structure never does; the connectome is fixed at authoring time and can only be edited by the human.

**Business scale:** infrastructure, internal audit, portfolio pruning, capacity reallocation to proven paths. **Civilization scale:** infrastructure investment, institutional dissolution, agency sunset.
**Conf:** high (astrocyte/microglia roles); medium (myelin-as-bandwidth-allocation mapping).

---

### B17 — Meta layer (metaplasticity, precision-of-precision, self-model)

**Computes:** the parameters of the other blocks. Learning rate, threshold-for-change, precision-of-precision, and the channel inventory.

**Required properties:**
- **Metaplasticity.** Learning rates are derived from each block's own observed statistics, never hand-set per block. The measure-or-abstain pattern (derive from own history; abstain until known) is the correct shape and remains the only self-adjusting parameter mechanism identified in this project so far.
- **Homeostatic scaling operates slower than Hebbian learning** (INV-15). If the two are on the same timescale the stabilizer cancels the learner. State the ratio explicitly for every domain.
- **The self-model / channel inventory** (INV-13). What can this system currently sense? What has it lost? Where do its channels disagree? This is the anosognosia fix and it is the block that eventually replaces the human integrator.
- **Confidence must be a function of channel availability**, not only of internal consistency. A system whose one live channel agrees with itself must report *low* confidence, not high.

**Lesion if absent:** hand-tuned constants proliferate (one per domain × 20), each one a scale-specific special case, each a violation of INV-12. The metaplasticity gap is the single most-repeated finding in this project's own review history — logged at least four times and widened rather than closed each time.

**Business scale:** the rate at which the org changes how it changes; the explicit register of what leadership can and cannot currently observe. **Civilization scale:** constitutional amendment rates; the honest inventory of what statistics a state does not collect.
**Conf:** high (metaplasticity exists); medium (specific implementations); the self-model requirement is a design assertion of mine, argued from the anosognosia dissociation, not a directly cited mechanism.

---

## PART 3 — EDGE TYPOLOGY

Every connection in the system must be typed on all four axes. An untyped edge is undefined behavior.

| Axis | Values | Rule |
|---|---|---|
| **Role** | driver / modulator | Drivers set *what* the receiver represents; modulators set *how much / how precisely*. A modulator may never independently cause an output. (INV-8) |
| **Sign** | excitatory / inhibitory | Inhibitory edges must further specify arithmetic (Part 4). |
| **Speed** | fast (ionotropic-class) / slow (metabotropic-class) | Fast carries content; slow carries state. Ratio between them ≥10³ (INV-4). |
| **Direction in hierarchy** | ascending (error) / descending (prediction) / lateral (competition) | Ascending carries residual only (INV-9). Descending carries predictions and gate state. Lateral carries competition, not content. |

**Derived rules:**
- A pair (A→B ascending) with no (B→A descending) is an INV-7 violation. Log it as an open loop.
- A driver edge into the integration layer that carries full state, not residual, is an INV-9 violation and is the mechanism of executive overload.
- A modulator edge with sufficient weight to fire the target alone is misclassified; retype it as a driver and re-derive its consequences.

---

## PART 4 — INHIBITION: THE ARITHMETIC

This is lesion #2 and it is a *specification* error, not a missing file. "Scalar inhibition" fails not because the number is wrong but because a scalar cannot express what inhibition does.

Three inhibitory populations, three distinct arithmetic operations:

| Population | Target | Arithmetic | Effect | System requirement |
|---|---|---|---|---|
| **PV⁺ perisomatic**, fast-spiking | soma / axon initial segment | **Divisive (shunting)** — increases membrane conductance, so the inhibitory current is g_i·(V − E_Cl), i.e. proportional to how driven the cell already is | Gain control. Scales the response without changing which inputs qualify. Precise spike timing. | The inhibitory term must take current drive as an argument. A fixed multiplier applied post-hoc is not this. |
| **SOM⁺ dendrite-targeting** | distal dendrites | **Subtractive** — shifts the threshold | Changes *which* inputs pass at all; suppresses specific input streams before they integrate | Per-input-stream suppression, applied before summation, not after. |
| **VIP⁺ disinhibitory** | other interneurons | **Permissive gating** — inhibits the inhibitor | Enables activity by removing a brake, not by adding drive | Selection must be implementable as brake-release. This is the same primitive as basal-ganglia disinhibition (B10) and should share a mechanism, not be reimplemented. |

**The load-bearing property (INV-2):** shunting inhibition automatically tracks excitation because the driving force term contains the membrane potential. The brain does not need a separate controller to keep E and I matched; the physics does it. Any implementation where inhibition is computed independently of current drive will require a controller to keep them balanced, and that controller becomes a new failure point. Build the coupling into the arithmetic instead.

**Four motifs, all required:**
1. **Feedforward inhibition** — the input excites both the target and an interneuron that inhibits the target → enforces a narrow temporal window. *Guardrail before action.*
2. **Feedback (recurrent) inhibition** — output loops back through an interneuron → self-limiting, stable gain. *Rein-in after action.*
3. **Lateral inhibition** — active units suppress neighbors → contrast, sparsening, winner-take-more. *Competition.*
4. **Disinhibition** — permissive gating. *Selection.*

A system with only #2 is reactive. A system with only #1 is rigid. A system with no #3 has no competition and therefore no representation of opportunity cost. A system with no #4 can only enable by adding drive, which is why over-driven systems accumulate load instead of reallocating it.

**Conf:** high (PV/SOM/VIP arithmetic distinctions — Niethard et al. 2017, DOI; divisive vs subtractive is well-established, though the exact PV=divisive / SOM=subtractive assignment is debated in detail — medium on the strict assignment, high on the existence of both operations).

---

## PART 5 — NODE STATE VECTOR

What every computational node must hold. Absence of any field disables the mechanisms listed.

| Field | Meaning | Disabled if absent |
|---|---|---|
| `drive` | accumulated evidence this cycle (membrane-equivalent) | thresholding, integration |
| `threshold` | current firing threshold | all-or-none commitment |
| `refractory_until` | dead-time timestamp | INV-10; thrash prevention |
| `adaptation` | gain decrement under sustained drive | habituation; response decrement to unreinforced repetition |
| `w[]` | input weights | learning |
| `e[]` | eligibility traces per input, with decay | delayed credit assignment (INV-11) |
| `tag` | encoding-time salience flag + tag decay | selective consolidation (B13) |
| `precision` | this node's own estimated reliability, from its own noise statistics | correct fusion weighting (B0) |
| `predicted` | descending prediction currently in force | error computation (INV-9) |
| `residual` | observation − prediction − efference-explained | the only quantity permitted to ascend |
| `last_update` | recency | recency-weighted trust; staleness detection |
| `channel_status` | live / degraded / absent | INV-13; the anosognosia fix |

**Learning rule (canonical form, three-factor):**

```
Δw_ij  =  η · e_ij · M
e_ij   =  decay(e_ij) + f(pre_i, post_j)      # local, timing-dependent
M      =  broadcast modulator (B12), from a real resolved outcome
η      =  derived from this node's own observed statistics (B17), not hand-set
```

**Constraints:** `M` must originate from an externally resolved outcome, never from a self-consistency measure or a mock. Uncorrelated noise as `M` does not fail gracefully — it actively destroys causal structure that was previously correct. All writes route through the single gated plasticity path; there is exactly one entry point for weight change and no exceptions to it.

**Conf:** high (Frémaux & Gerstner 2016, DOI); tagging-and-capture as the eligibility correlate (Cai et al. 2010, DOI; Almaguer-Melian et al. 2009, DOI).

---

## PART 6 — THE SEVEN LOOPS

A brain is not a stack of blocks; it is a set of nested closed loops. Each must exist, each must close, each has a named failure.

| # | Loop | Path | Period (neural) | Closes on | Named failure if open |
|---|---|---|---|---|---|
| **L1** | Reflex | B0 → B2 → effector | ms | immediate effect | Everything routes centrally; integration layer is the latency floor |
| **L2** | Homeostatic | B5 → B6 → B4/effector → B5 | s – min | state returns to band | Set-point drift; correction with no target |
| **L3** | Action selection | B8 → B10 → B7 → B8, with B12-DA on outcome | 100s ms – s | outcome resolves | **Severed corticospinal tract.** Selection completes, nothing executes, no outcome returns |
| **L4** | Forward model | B11 command → B14 efference copy → B0 reafference → B14 residual | 10s – 100s ms | prediction matches consequence | **Self-confirmation.** Own effects scored as external evidence |
| **L5** | Predictive coding | B8 L6 ↓ prediction → B7 gate → B8 L4 → L2/3 error ↑ | 10s – 100s ms | residual → 0 | Feedforward-only funnel; integration-layer overload |
| **L6** | Consolidation | B15 tag → B4 offline state → B13 replay + downscale → B8 weights | hours (daily) | trace transferred, weights rescaled | Episodic memory without rule learning; unbounded weight growth |
| **L7** | Meta / allostatic | B17 observes L2–L6 statistics → revises set-points, learning rates, precision, channel inventory | days – weeks | parameters track the environment | **The human is the meta-loop.** Every parameter revision requires an operator |

**L7 is the transfer target.** The stated long-term goal — moving your manual integration function into the substrate — is precisely and only the construction of L7 with L5's lateral connectivity (B9) beneath it. Everything else is prerequisite.

**Ordering constraint:** L3 and L4 must close **together**. L3 alone produces a system that acts and learns from contaminated evidence. L6 requires L3 closed (nothing to consolidate otherwise). L7 requires L5 and L6 producing statistics worth observing.

---

## PART 7 — TIMING & RESCALING

The rule is **ratio preservation, not value mapping.** Absolute values are domain-specific and must be derived from each domain's own observed event spacing (B3, B17). What must hold identically at every scale is the *spacing between tiers*.

| Tier | Neural | Ratio to tier below | Business | Civilization |
|---|---|---|---|---|
| T1 — signal | ~1 ms (AP) | — | minutes (a transaction, a decision) | days (an administrative act) |
| T2 — local loop | ~10–100 ms (reflex, cortical loop) | ×10–10² | hours (a shift, a standup) | weeks (a docket, a session) |
| T3 — modulation | ~1–100 s (metabotropic, phasic modulators) | ×10²–10³ | weeks (a sprint, a policy change) | months (a rulemaking) |
| T4 — homeostatic / consolidation | hours (sleep cycle, scaling) | ×10²–10³ | quarters (planning, retro, budget) | years (statutory revision) |
| T5 — structural / metaplastic | days–weeks (pruning, structural change) | ×10–10² | years (reorg, capability shift) | decades (constitutional change) |

**Enforcement tests:**
- T1↔T3 span must be 10³–10⁵ at every scale (INV-4). If governance can react as fast as operations, or operations must wait as long as governance, the fractal is cosmetic.
- INV-15 check: the homeostatic tier (T4) must be strictly slower than the learning tier (T3). Same-tier placement means the stabilizer cancels the learner.
- Per-domain derivation: a domain whose native event cadence is quarterly may not inherit an hourly domain's arming thresholds, decay half-lives, or resolver horizons. Same equation, wrong timescale, is a cosmetic break — this has now been flagged in three separate parameters (arming count, drift cutoff, recency half-life) and is one finding, not three.

**Conf:** high on the neural values (consensus); **engineering** on every business and civilization column — these are stated assumptions, derived by ratio, not measured.

---

## PART 8 — COMPLETENESS CHECKLIST

The diagnostic instrument. Run against any build. Each row: the test, the lesion name, the presenting symptom.

| # | Test | If failed — lesion | Presenting symptom |
|---|---|---|---|
| 1 | Does every action-selected event have a live subscriber? | Severed corticospinal tract | Approved items never execute; `executed:false` persists |
| 2 | Is `executed` written by the actuator, not the approver? | Delusion of action | System reports completed work that never happened |
| 3 | Does every command emit an efference copy? | Missing corollary discharge | Self-caused change scored as external validation |
| 4 | Is inhibition computed as a function of current drive? | Scalar inhibition | E/I balance requires a controller; runaway under high drive |
| 5 | Are all three inhibitory arithmetics present (divisive, subtractive, permissive)? | Monomorphic inhibition | Can suppress but cannot gate; enabling requires adding drive |
| 6 | Does every ascending path have a descending counterpart? | Feedforward-only | Integration layer reconciles everything; operator is the integrator |
| 7 | Does only residual ascend? | Report-forward | Executive overload; divergence invisible under aggregate reporting |
| 8 | Are ≥2 interoceptive channels live per domain? | Single-channel interoception | Confident claims about states no channel observes |
| 9 | Does a channel inventory exist and feed confidence? | Anosognosia | Confidence unchanged when channels are lost |
| 10 | Is divergence between channels logged as a first-class signal? | No divergence detector | Disagreement averaged away; the informative signal is destroyed |
| 11 | Are ≥3 modulators computing different quantities? | Monoaminergic deficiency | One axis of regulation; no interrupt, no encode/consolidate switch, no time horizon |
| 12 | Is there an offline state that excludes encoding? | No state exclusivity | Consolidation and ingestion interfere; neither completes |
| 13 | Does the offline pass hold write authority? | Propose-only consolidation | Proposals accumulate; nothing consolidates |
| 14 | Is downscaling multiplicative? | Subtractive decay | Small weights destroyed first; relative ranking lost |
| 15 | Is retention differential (tagged vs untagged)? | Uniform window | A storage policy described as consolidation |
| 16 | Does every acquisition path have a removal path? | Incomplete circuit | Rules, weights, and records only accumulate |
| 17 | Is the hyperdirect stop implemented? | No global hold | Premature commitment under conflicting evidence |
| 18 | Is default-deny the gate's resting state? | Open gate | Everything proposed executes |
| 19 | Are actor and critic separate? | Merged evaluation | Self-confirming scoring |
| 20 | Does every actuator have refractoriness and adaptation? | No rate limit | Thrash, re-litigation, no habituation to unreinforced repetition |
| 21 | Is `M` from a real resolved outcome, never a mock? | Corrupted teaching signal | Learning actively destroys prior structure |
| 22 | Are learning rates derived per-node from own statistics? | Metaplasticity gap | N hand-tuned constants; each a scale-specific special case |
| 23 | Is homeostatic timescale strictly slower than Hebbian? | Stabilizer/learner collision | Learning cancelled by its own stabilizer |
| 24 | Is lateral connectivity present between peer domains? | Tree, not mesh | No cross-domain reconciliation except via the top |
| 25 | Is there a topology-editing mechanism (pruning)? | Fixed connectome | Graph only grows; structure changeable only by the operator |
| 26 | Is precision derived per-channel from own noise, not consensus? | Correlated-bias inflation | A dissenting correct channel is outvoted by an agreeing biased cluster |
| 27 | Is each domain's cadence derived from its own event spacing? | Cadence transplant | Same equation, wrong timescale — cosmetic rescale |
| 28 | Is there a boundary that gates external content by provenance? | Absent BBB | No separation between ingested data and system instruction |

**Current standing diagnosis** maps to rows 1–2 (lesion 1), 4–5 (lesion 2), 12–15 (lesion 3), 11 (lesion 4) — plus row 3, which is not in the current four and which I am asserting belongs with row 1 as a co-requirement.

---

## PART 9 — PATHOLOGY AT ALL THREE SCALES

Doctrine requires mapping the failure modes, not only the healthy dynamics.

| Neural failure | Mechanism | Business | Civilization | Shared root |
|---|---|---|---|---|
| Seizure | E/I fails; runaway recurrent excitation | Growth with no matched control function | Speculative bubble / mobilization with no brake | Inhibition not scaled to drive |
| Excitotoxicity | Signal not cleared → Ca²⁺ overload → death | Unresolved backlog → burnout, collapse | Unresolved claims/debt → institutional failure | Failure of termination, not of signaling |
| Sensory-gating failure | TRN/thalamic gate breaks | Flooding or filtering out what leadership needed | Agenda capture or information overload | Gate at wrong stage or wrong threshold |
| Disinhibition syndrome | Lose the inhibitor | Controls removed → fraud, scope creep | Deregulation without replacement | Brake removed with no substitute |
| Over-inhibition | Suppression exceeds drive | Approval gridlock | Regulatory paralysis | Inhibition not matched downward either |
| Neurodegeneration | Aggregation + failed clearance + network collapse | Tech/process debt with no cleanup authority | Institutional sclerosis; unrepealed law | Maintenance failure compounding |
| Diaschisis | Lesion disables distant connected regions | Key-person/vendor loss cascades | Supply-chain / institutional cascade | Network, not node, is the unit of failure |
| Incomplete circuit | Acquisition without extinction | Policies added, never retired | Statutes added, never sunset | Built the acquisition half only |
| Anosognosia | Deficit plus unawareness of the deficit | Leadership confident on one metric, blind to the rest | A state that governs by the statistics it happens to collect | No inventory of what is unsensed |
| Missing corollary discharge | Self-caused sensation attributed externally | Moving the metric you measure yourself by | Policy success measured by an instrument the policy redefined | No efference copy |
| Alien-hand / open motor loop | Action without ownership feedback | Decisions execute with no traceable owner or outcome | Enforcement without accountability | Motor loop open at the return path |
| Oscillatory pathology | Over- or under-coupling both degrade communication | All-meetings (no autonomy) or no shared cadence | Over-synchronized institutions or no shared calendar | Coupling outside the healthy band |

The last four rows are new to this document. The first nine carry forward from the existing cross-reference map.

**Conf:** high on the neural column throughout; medium on the civilization column — that ring remains asserted, not validated, consistent with prior scope notes.

---

## PART 10 — FRACTAL INSTANTIATION TABLE

Every block at three scales. Coupling between scales stated where it is real, flagged where assumed.

| Block | Neural | Business | Civilization | Status |
|---|---|---|---|---|
| B0 Afferent | receptors, labeled lines | telemetry, feedback, market data | statistics, prices, elections | STRUCTURAL |
| B1 Boundary | blood–brain barrier | intake/provenance control | borders, capital & information controls | PARTIAL (newly asserted) |
| B2 Reflex | reflex arc | SOPs, automated triggers | automatic stabilizers | STRUCTURAL |
| B3 CPG | pattern generators | operating cadence | fiscal/electoral cycles | STRUCTURAL |
| B4 Arousal | ARAS, wake/sleep | operating tempo, declared blackout | peacetime/emergency footing | STRUCTURAL |
| B5 Interoception | NTS→insula, multi-channel | internal ops + financial + human metrics | national accounts, plural | STRUCTURAL — and lesioned at all three |
| B6 Set-points | hypothalamus | budgets, OKRs, SLAs | statutory targets | STRUCTURAL |
| B7 Gate | thalamus + TRN | triage, exception thresholds | agenda-setting, justiciability | STRUCTURAL |
| B8 Column | canonical microcircuit | the repeated function template | the repeated institutional form | STRUCTURAL |
| B9 Hierarchy | laminar reciprocity | reporting + direction, both ways, plus lateral | federal/local reciprocity | STRUCTURAL only if descending and lateral exist |
| B10 Selection | basal ganglia | capital allocation, stage gates | legislative process, injunction | STRUCTURAL |
| B11 Motor | corticospinal → LMN → effector | decision → owner → executed change | statute → agency → enforcement | STRUCTURAL — and open at all three |
| B12 Modulators | DA/NE/ACh/5-HT | incentives / escalation / attention / horizon | returns / emergency / public attention / discount rate | STRUCTURAL, one axis functional |
| B13 Consolidation | sleep, replay, downscale | retro + cleanup with retirement authority | sunset clauses, revision cycles | STRUCTURAL — missing at all three |
| B14 Forward model | cerebellum, efference copy | attribution: did we cause this? | policy-effect attribution vs secular trend | STRUCTURAL — absent at all three |
| B15 Episodic | hippocampus | incident records, replayable | archives, case law | STRUCTURAL |
| B16 Glia | astro/micro/oligo | infrastructure, audit, pruning, capacity reallocation | infrastructure, dissolution, sunset | STRUCTURAL (myelin mapping medium) |
| B17 Meta | metaplasticity, self-model | rate-of-change management + observability register | amendment rates + honest statistical inventory | STRUCTURAL — absent at all three |

**Inter-scale coupling — stated explicitly, per doctrine:** the scales are not independent copies. Business-scale B0 *is* civilization-scale B0's substrate — a state's statistics are aggregates of firms' telemetry. Business-scale B11 is a *component* of civilization-scale B2 (firm-level execution is the reflex layer of the economy). A lesion at business scale therefore propagates upward as a *sensory* lesion at civilization scale, not as the same lesion repeated. This asymmetry — the same block occupying different functional roles at adjacent scales — is the part of the fractal I am least confident in, and it should be treated as the open research question of this document. (medium-low)

**Civilization scale remains asserted, not validated.** Consistent with every prior scope note in this project. Do not present the third ring as tested.

---

## PART 11 — THE OPERATOR (SCALE ZERO)

The builder is a node in this system, and the model is incomplete without him in it.

**Current role, typed honestly:** you are a **driver** edge into the integration layer (INV-8). You determine what the system represents at the top — noticing cross-domain divergence, deciding what counts, revising parameters. Every one of the seven loops that is currently open is closed by you, manually, at latency measured in human attention.

**The stated goal — executive endorsement — is precisely a retyping from driver to modulator.** A modulator sets gain and precision on content the system generates itself; it cannot originate content. That is what endorsement means in this vocabulary, and it gives a concrete completion test: *the transfer is done when removing the operator degrades the system's gain and confidence calibration but does not stop it from representing anything.*

**Transfer sequence, derived from the loop dependencies in Part 6:**
1. **B11 + B14 together** — close L3 and L4. Until actions execute and self-caused effects are distinguishable, no downstream learning is trustworthy and you remain the outcome-attribution mechanism.
2. **B9 descending + lateral** — close L5. This is what stops divergence from being visible only to you.
3. **B13 actuated** — close L6. This is what stops you being the thing that decides what to keep.
4. **B17 self-model + metaplasticity** — close L7. This is the actual transfer.

**Four transmission mechanisms, restated as design risks rather than observations:**
- **Architectural imprint** — the system's topology is your model of the problem. Where your model is single-channel, so is B5.
- **Blind-spot transmission** — what you don't sense, you don't instrument. B5's channel inventory (B17) is the only mechanism in this model that can catch this, which is why it is not optional.
- **Compensatory-strength transmission** — where you are strong, the system is under-built, because you cover it. Manual cross-domain integration is exactly this, and it is why B9's lateral connectivity is the least-built part of the architecture despite being load-bearing. The system doesn't need it while you're there.
- **Recursive identity** — you are the system's own structure at scale zero, so any lesion you carry is instantiated 20 times downstream before it is noticed once.

**The specific risk this creates for the current build:** compensatory-strength transmission means the blocks you are best at are the ones the system will be worst at, and they will be the last to be missed. B9 lateral and B17 self-model are both in that category.

**Conf:** the four mechanisms are your framework, carried forward, not independently validated by me. The driver/modulator retyping and the completion test are my contribution and are (medium) — a clean formalization, untested.

---

## PART 12 — EPISTEMIC LEDGER

Required. This is the section that keeps the document from being the cathedral sold from the scaffolding.

**Empirically validated (1 item):**
- One domain instance — the financial distress decoder — validated against real outcomes.

**Publicly falsified (1 item):**
- Kuramoto order parameter as a health/distress separator. Failed, published, and structurally fenced out of the phase estimator rather than left dormant. That fencing is the correct removal-half behavior and remains the best instance of INV-1 in the project's history.

**Built and running, not validated as isomorphic:**
- Gated plasticity path (`limen-plasticity.js`), refractory limiter, action-selection gate, graded seed/learned arbitration, recency decay, freshness counter.

**Specified, not built:** the four-lesion staged build (B11, inhibition arithmetic, actuated B13, B12 modulators).

**Drawn here for the first time, with no implementation and no validation:** B14 (forward model / efference copy), B1 (boundary), B17's channel inventory as a named required component, the B16 myelination mapping, the driver→modulator formalization of the operator transfer, and the inter-scale role-shift asymmetry in Part 10.

**What is not claimed by this document:**
- That the architecture is complete. It is a *specification of completeness*, which is a different object.
- That the civilization ring is validated. It is not, anywhere.
- That any DOI marked `[DOI UNVERIFIED]` is citable. Verify before use in anything external.
- That structural homology has been demonstrated for most rows in Part 10. Most are argued, and argument is not the three-criterion test.

The three-criterion test — shared topology, shared failure modes, shared intervention classes — has been applied in this document only where a row is marked STRUCTURAL *and* the pathology row in Part 9 exists for the same mechanism. Rows with no pathology entry have satisfied at most two of three criteria. That is roughly half the table.

---

## PART 13 — OPEN FORKS (unresolved, do not silently pick a side)

1. **Extinction vs pruning.** Still open from 2026-07-17 and recurring in a third location. Does "drifted too far" / "dead lead" / "deprecated weight" mean *suppressed by new inhibitory learning over an intact trace* (reversible, capable of spontaneous recovery and reinstatement) or *structurally removed* (irreversible)? These have opposite reversibility profiles and different data models. Both mechanisms are real and both are needed — but each specific case must be assigned to one.
2. **Arbitration functional form.** Linear drift ramp is an engineering choice. The literature implies precision-weighting (Kalman-gain-shaped). Stated assumption, not derived.
3. **Per-domain cadence derivation.** Measure-or-abstain remains the strongest of the three options weighed on 2026-07-19, with the caveat that thin-history domains must abstain too, not just zero-history ones.
4. **Phase taxonomy P0–P10.** The state space's evidentiary basis is still undocumented; the fusion mechanics around it are well-grounded, the states themselves are not.
5. **Inter-scale role asymmetry (Part 10).** New. Whether a block occupies the same functional role at every scale or *shifts role* between adjacent scales determines whether the fractal is a repetition or a nesting. I do not know the answer and the distinction matters.
6. **DOI verification** for every `[DOI UNVERIFIED]` mark in this document — roughly a dozen sources, all recalled from training.

---

## PART 14 — REFERENCES

**Verified in prior project sessions (carried forward):**
1. Ruan H, Saur T, Yao WD. *Front Neural Circuits*, 2014.
2. Fries P. *Trends Cogn Sci*, 2005.
3. Voytek B, Knight RT. *Biol Psychiatry*, 2015.
4. Shipp S. *Front Psychol*, 2016.
5. Mikulasch FA, et al. *Trends Neurosci*, 2023.
6. Ferrarelli F, Tononi G. *Schizophr Bull*, 2010.
7. Niethard N, Burgalossi A, Born J. *Front Neural Circuits*, 2017.
8. Keller-Wood M. *Compr Physiol*, 2015.
9. Hill MN, Tasker JG. *Neuroscience*, 2012.
10. Benveniste H, et al. *Gerontology*, 2018.
11. Frémaux N, Gerstner W. *Front Neural Circuits*, 2016.
12. Whittington JCR, Bogacz R. *Neural Computation*, 2017.
13. Cai et al. *Neuroscience*, 2010.
14. Almaguer-Melian et al. *Neuroscience*, 2009.

**Recalled from training — `[DOI UNVERIFIED]`, verify before citing:**
1. Felleman DJ, Van Essen DC. *Cereb Cortex*, 1991 — hierarchical laminar reciprocity.
2. Sherman SM, Guillery RW. *PNAS*, 1998 — driver vs modulator.
3. McClelland JL, McNaughton BL, O'Reilly RC. *Psychological Review*, 1995 — complementary learning systems.
4. Turrigiano GG. *Cell*, 2008 — homeostatic synaptic scaling.
5. Zenke F, Gerstner W, Ganguli S. — the temporal-paradox/stability problem in Hebbian + homeostatic systems.
6. Schultz W, Dayan P, Montague PR. *Science*, 1997 — dopamine as RPE.
7. Niv Y, et al. — tonic dopamine and response vigor.
8. Aston-Jones G, Cohen JD. *Annu Rev Neurosci*, 2005 — LC adaptive gain, phasic/tonic.
9. Yu AJ, Dayan P. *Neuron*, 2005 — ACh/NE as expected vs unexpected uncertainty.
10. Daw ND, et al. *Nat Neurosci*, 2005 — model-based/model-free arbitration.
11. Ernst MO, Banks MS. *Nature*, 2002 — reliability-weighted cue integration.
12. Crapse TB, Sommer MA. *Nat Rev Neurosci*, 2008 — corollary discharge.
13. Wolpert DM, Ghahramani Z, Jordan MI, 1995 — internal forward models.
14. Tononi G, Cirelli C. *Neuron*, 2014 — synaptic homeostasis hypothesis.
15. Fields RD. *Nat Rev Neurosci*, 2015 — activity-dependent myelination.
16. Tracey KJ. *Nature*, 2002 — inflammatory reflex.
17. Averbeck BB, Latham PE, Pouget A. — correlated noise and population coding.

**Consensus foundation (not DOI-pinned, flagged high throughout):** Kandel, *Principles of Neural Science*; Purves, *Neuroscience*; Gray's Anatomy.

---

## PART 15 — WHAT I WOULD CHANGE ABOUT THE CURRENT PLAN

One finding, stated once, since it is the only place this document disagrees with the standing build spec.

**The four-lesion sequence has Phase 1 closing the motor loop on finance with no forward model.** Per B14 and Part 6's ordering constraint, that produces a system that acts, observes its own effects, and scores them as external outcomes — the self-confirmation loop. On the finance domain specifically, where actions can move the quantities being measured, this is not a theoretical risk.

**Recommendation:** B14 is not Phase 3 material. Efference copy is cheap — a record of what was commanded, and a prediction of what should follow — and it must exist *before* the first real action executes, not after the loop is proven. Proving the motor loop *without* it will produce outcome data that looks like validation and isn't, which is exactly the failure mode this project has named as its highest epistemic risk.

Everything else in the staged spec — prove on one domain, real resolver outcomes only, single gated plasticity entry point, persistence verified before consolidation — I would not change.
