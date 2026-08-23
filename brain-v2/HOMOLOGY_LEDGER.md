# LIMEN B0–B17 Homology Ledger

**Status:** leading conceptual-to-engineering ledger  
**Version:** 1.0  
**Date:** 2026-08-23

This ledger is a build map, not a claim that LIMEN is a biological brain or that the
neurology/business/civilization correspondences are scientifically established. The P0–P10
and B0–B17 language is the project's conceptual design language. The implementation state is
reported separately from the conceptual mapping.

## Classification

- **Conceptual:** useful design correspondence; not yet represented by a specific runtime contract.
- **Structurally supported:** the repository has a corresponding mechanism or topology, but the complete loop or production behavior is incomplete.
- **Measured in software:** tests or production reads exercise the named behavior; this does not validate the neuroscience analogy.
- **Unresolved:** the mapping or implementation location is not specific enough to build safely.

## Ledger

| Block | Neural function | Business equivalent | Civilization equivalent | Shared failure mode | Intervention/control class | Intended invariant | Implementation location | Current classification |
|---|---|---|---|---|---|---|---|---|
| B0 | Receptors, transduction, labeled afferents | Telemetry, customer feedback, market and operations data | Statistical agencies, prices, elections, press | One proxy treated as the whole sensorium; provenance or cadence lost | Add typed channels, preserve identity, derive precision from own history | Every signal retains channel identity, units, freshness and liveness | `brain-v2/core/channel.js`, `brain-v2/core/brain.js`, recorder handlers | Measured in software; all-20-domain sensory completeness remains Job 3 |
| B1 | Blood–brain barrier and selective transport | Vendor/data intake and provenance boundary | Border, capital and information controls | Untrusted data becomes an instruction or contaminates state | Default-deny admission with explicit provenance and quarantine | External material is admitted by class and provenance, not by content authority | `brain-v2/kernel/barrier.js`, source-identity and corpus quarantine tests | Structurally supported |
| B2 | Spinal reflex arcs and reciprocal inhibition | SOPs and automatic triggers | Automatic stabilizers and standing remedies | Every response waits for the master integration loop | Fixed-latency reflex with override and antagonist suppression | Reflexes are bounded, reversible and do not require cortical approval | No complete brain-v2 B2 runtime path identified | Unresolved |
| B3 | Central pattern generators and autonomous cadence | Close/review/sprint cadence | Fiscal, election and census cycles | System only acts when externally triggered | Per-domain scheduler derived from observed event spacing | Cadence is autonomous and domain-specific; inputs entrain but do not create the clock | Cron handlers, recorder cadence, `brain-v2/core/reference-time.js` | Structurally supported |
| B4 | Arousal, wake/quiet/offline gain | Operating tempo and crisis footing | Peacetime/emergency footing | Quiet is indistinguishable from down or from an unavailable provider | Explicit state machine and offline window | Encoding and consolidation cannot run concurrently without a declared state | `brain-v2/kernel/vitals.js`, `brain-v2/kernel/loop.js` | Structurally supported |
| B5 | Multi-channel interoception and divergence | Cash, quality, engagement, cycle-time and error readings together | Plural national accounts and public indicators | Internal state inferred from one agreeing proxy | Channel inventory plus divergence and resolution records | Availability and disagreement are first-class outputs, not averaged away | `brain-v2/core/divergence.js`, `brain-v2/kernel/vitals.js`, shadow runtime | Measured in software; grounding and domain coverage remain Job 3 |
| B6 | Homeostatic set-points and allostatic revision | Budgets, OKRs and service levels | Inflation targets and statutory limits | Correction has no target or protects a stale target | Dead-band drives plus slower set-point revision | Error inside tolerance produces no drive; revision is slower than correction | `brain-v2/kernel/vitals.js` (partial set-point logic) | Structurally supported |
| B7 | Thalamic relay and reticular gate | Triage, prioritisation and exception thresholds | Agenda-setting and justiciability | Flooding or starvation caused by filtering at the wrong place | Typed tonic/burst modes and explicit top-down gate | Filter only after recoverable information and before overload | `brain-v2/kernel/connectome.js`, `brain-v2/kernel/barrier.js` | Structurally supported |
| B8 | Cortical predictive-coding column | Repeated domain function template | Repeated institutional form | Feed-forward reporters with no descending prediction or error loop | Precision-weighted prediction, error, local competition and feedback | Prediction descends; only precision-weighted error ascends | `brain-v2/core/brain.js`, `brain-v2/kernel/predict.js`, phase estimator | Measured in software |
| B9 | Hierarchical, feedback and lateral inter-areal wiring | Reporting, direction and lateral coordination | Federal/local reciprocity and peer coordination | Everything reports upward; the human remains the integrator | Typed ascending, descending and lateral edges with bounded routing | Every permitted ascending path has a typed return path; lateral edges are explicit | `brain-v2/kernel/connectome.js`, relationship wiring and lateral tests | Structurally supported; cross-domain operation is Job 5 |
| B10 | Basal-ganglia action selection by disinhibition | Capital allocation and stage gates | Legislative process and injunction/hold | Proposal is executed automatically or nothing can win | Direct, indirect and hyperdirect hold paths; actor/critic separation | Default deny, explicit release, explicit hold, opportunity cost recorded | `brain-v2/kernel/select.js`, `brain-v2/kernel/inhibition.js`, propose/actuator tests | Measured in software |
| B11 | Motor path from command to effector | Decision → owner → executed change | Statute → agency → enforcement | Approved intent is mistaken for execution; no consumer or receipt | Bounded final common actuator path and receipt-based execution | `executed` is written only by the actuator after a receipt; outcomes re-enter | `brain-v2/kernel/actuate.js`, research/investment actuator work | Structurally supported; domain selection bridge remains Job 5 |
| B12 | Neuromodulatory axes (DA/NE/ACh/5-HT and state) | Realized incentives, escalation, attention and horizon | Returns, emergency response, public attention and discount rate | One scalar is renamed as several modulators; modulator becomes a driver | Orthogonal, outcome-fed modulators that weight rather than originate content | Each axis has distinct input, timescale and target; no axis alone creates action | `brain-v2/kernel/modulators.js`, `brain-v2/kernel/loop.js` | Structurally supported; external outcome wiring remains Job 5 |
| B13 | Offline replay, transfer, downscaling and clearance | Authorised retro/cleanup and process retirement | Sunset clauses, revision cycles and debt restructuring | Episodic storage grows while rules never consolidate or retire | Scheduled offline write authority, selective replay, multiplicative downscale and clearance | Consolidation changes durable state inside a declared offline window | `brain-v2/kernel/consolidate.js`, `brain-v2/kernel/memory.js` | Structurally supported; cross-lane consolidation remains Job 5 |
| B14 | Forward model, corollary discharge and reafference cancellation | Separate self-effect from market/customer outcome | Separate policy effect from instrument response | Own action is scored as independent confirmation | Command-time efference copy, predicted consequence, residual and timing calibration | Only residual after predicted self-effect is new evidence | `brain-v2/kernel/predict.js`, `brain-v2/kernel/actuate.js`, B11/B14 worktree/PR history | Structurally supported; trusted production cancellation remains Job 5 |
| B15 | Episodic hippocampal encoding and replay index | Replayable incident and case record | Archives and case law | Aggregates exist but specific cases cannot be retrieved or attributed | Pattern-separated episode IDs, encode-time tags and replay lookup | A later outcome can be traced to the exact originating episode | `brain-v2/kernel/memory.js` | Measured in software |
| B16 | Glial substrate maintenance and topology pruning | Infrastructure, audit, capacity reallocation | Infrastructure investment and institutional sunset | Weights change while stale records and dead edges accumulate | Clearance, pruning and traffic-based capacity allocation | Maintenance can retire state and change topology without hand-editing every edge | No complete B16 block identified; clearance is embedded in B13 | Unresolved |
| B17 | Metaplasticity, precision-of-precision and self-model | How the organisation changes how it changes; capability inventory | Constitutional revision rate and honest statistical blind spots | Hand-tuned constants proliferate and confidence ignores missing channels | Derive rates from own history, inventory availability, and abstain when unknown | Confidence is constrained by what is sensed, not only by internal agreement | `brain-v2/core/metaplasticity.js`, `brain-v2/kernel/vitals.js` | Structurally supported |

## Use in the build sequence

1. This ledger names the intended correspondence; it does not authorize a runtime action.
2. A runtime change must cite the block row, the invariant it implements, and its failure test.
3. If the row says **unresolved**, implementation pauses at that boundary until the missing contract is named; it does not get filled with a metaphor.
4. Job 3 audits the B0/B1/B3/B5/B7 substrate across all 20 domains.
5. Job 4 turns B7/B9/B11/B14 handoffs into an explicit Civilization↔Master Brain contract.
6. Job 5 closes B11+B14 first, then B9, B13 and B17, using this ledger as the traceability index.

## Boundary note

The P0–P10 phase registry and this B0–B17 ledger are related but not interchangeable. P0–P10 describes the phase vocabulary used by
the product and conceptual homology layer. B0–B17 describes functional blocks and implementation work. A phase label never proves that
a block is present, and a block implementation never proves the underlying biological analogy.
