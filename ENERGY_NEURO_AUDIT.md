# Energy Domain - Neuro-Fidelity Audit (vs LIMEN_Helix_Neurology_Reference.html)

Internal reference. A 3-agent, mechanism-by-mechanism audit of how faithfully the ENERGY domain
follows the neurology reference, plus the list of document aspects that are IMPOSSIBLE to map to a
domain. Firewalled from the public deploy. Compiled 2026-07-13. Energy only; no other domain touched.

## Verdict

The reference specifies ~41 mechanisms. Its own scope note (line 139) says it is the "neural
substrate layer" and marks the mappable invariants ⟨fractal-critical⟩ (~18 of them). Part XV rules
that a mapping must preserve the RATIOS, "or the fractal is cosmetic, not structural."

Of the ~18 ⟨fractal-critical⟩ CONTROL invariants (the layer actually meant to map):
- ~6 are LIVE and faithful (drive a real decision): refractory rate-limit, feedback/recurrent
  inhibition, lateral inhibition (K7), thalamocortical evidence-gate (boundary gating), predictive-
  coding error signal + forward-model calibration, neuromodulatory global gain, cross-domain
  escalation emission, and (post-fix) the diaschisis/SPOF self-audit.
- ~6 are present-but-WEAK (cosmetic/inert or distorted): E/I balance (advisory only; the LIVE
  inhibition term scales with inverse-surprise, not drive), the GABA brake (fails OPEN, not
  fail-safe), retrograde feedback (module inert/unwired), homeostatic scaling + metaplasticity +
  offline-maintenance + extinction + incomplete-circuit + failure-classifier (faithful in shape,
  default no-ops, called by nothing), the two-timescale RATIO (~12x, not the doc's ~1000x -
  cosmetic by XV), management-by-exception (compressor inert), disinhibitory selection (uses
  suppression instead), allostasis (a threshold floor, not a regulate-to-target servo).
- The rest are OPEN (mappable, not built) or correctly ABSENT because IMPOSSIBLE (below).

Blunt summary: Energy has strong diagnostic coverage on paper but a thin actuated core. Only ~4
neuro modules are wired into the brain at all (refractory, telemetry adapter, E/I balance,
connectivity audit), and of those only refractory (+ the in-brain evidence-gate / K7 / K8 floor)
drives a decision. No fabrication was found: the impossible mechanisms are omitted, not faked, and
the inert ones are honestly commented as no-ops.

## Accuracy correction (integrity note)

The 2026-07-13 Phase-1 claim "the brain now CONSUMES the connectivity/SPOF self-audit each cycle"
was FALSE as first shipped: `_computeEnergyRegulationAdvisories` read edges from `s._rawDomain`,
but `_rawDomain` is the /api/domain-snapshot object (signals/stress only) and carries NO edges -
so it returned `consumed:false` every cycle. Edges (81) live only in `assets/data/domains/energy.json`,
which the brain never loaded. FIXED same day: the method now lazily fetches + caches those edges
(browser fire-and-forget, server via require) and runs the audit on the real 81-edge graph
(verified: 2 articulation nodes / SPOF, hubs THAL:13, dACC:11, M1:8). The E/I balance advisory is
still observe-only by design (actuating it into the live brake is roadmap P3, ENERGY_BRAIN_MAP.md).

## The impossibilities (what NOT to force onto a domain)

Grouped by why. These are document aspects with no faithful domain mapping - forcing them is a
category error. Energy correctly leaves them out.

1. PHYSICAL / CHEMICAL SUBSTRATE (no informational analog):
   resting membrane potential, ion channels/pumps, action-potential ionic mechanics, conduction
   velocity / myelination, synaptic delay, neurotransmitter pharmacology (glutamate/GABA/ACh/
   monoamine molecules), glymphatic waste chemistry, blood-brain-barrier tight junctions, the
   molecular circadian clock, ionic excitotoxicity, decussation, the mV/ms/Hz parameter values,
   sensory transduction hardware. Only their emergent INVARIANTS (rate-limit, load-bearing
   inhibition, clearance, selective gating, global gain) carry the ⟨fractal-critical⟩ flag and map.

2. NEEDS MILLISECOND TIMING (a 5-min-to-24-hr feed cannot resolve spike order):
   STDP / Hebbian timing-based potentiation (+-10 ms pre/post window), NMDA coincidence detection,
   feedforward-inhibition narrow window, temporal summation window, E/I millisecond simultaneity
   (the scaling RELATIONSHIP maps; the instant-by-instant co-tracking does not).

3. NEEDS A CONTINUOUS RHYTHM + PHASE (a discrete event feed has neither):
   oscillations, communication-through-coherence, cross-frequency coupling, central pattern
   generators, oscillatory pathology. A scheduler is only a loose echo, not the mechanism.

4. NEEDS AN EXTERNAL GROUND-TRUTH REWARD/OUTCOME LABEL (the domain lacks one):
   dopaminergic reward-prediction-error and reward-based learning. Mappable only as SELF-CONSISTENCY
   calibration (which Energy's forecast/call-ledger does), never as true reward - or it is fabricated.
   This is why Energy correctly does only LTD-like down-scaling, never Hebbian potentiation.

5. PURE ANATOMY (maps only as a function listed elsewhere, never as structure):
   the 12 cranial nerves, spinal tracts/dermatomes, cortical lobes as regions, dual-innervation
   organ lists. The doc maps FUNCTIONS (thalamus=gate, basal-ganglia=selection, hypothalamus=
   set-point), not the anatomy; mapping the anatomy literally is a category error.

## Fidelity scorecard - the ~18 fractal-critical control invariants

| Invariant (doc section) | Energy status | Evidence |
|---|---|---|
| Refractory rate-limit (III.3) | LIVE | energy-refractory-limiter.js + energy-brain.js:1116-1144 (the one actuated overlay) |
| E/I balance = inhibition scales with drive (XIII.1) | **LIVE (actuated 2026-07-13)** | `_computeEnergyServo` + brake `eiFactor`: the HALT brake now dampens emission PROPORTIONALLY to the drive/inhibition deficit (harness 8/8: runaway->0.23, monotonic). Reversible via `_actuation.eiBrake`. |
| GABA load-bearing brake (IV.2/XIV) | WEAK (fails open) | _computeEnergyBrake fail-open when state absent (energy-brain.js:2362-2363); proportional arm deferred |
| Retrograde negative feedback (IV.5) | WEAK (inert) | energy-retrograde-throttle.js unwired, no overload feed |
| Feedback/recurrent inhibition (XIII.2) | LIVE | HALT brake one-cycle-lag + flood cap (energy-brain.js:2360-2404) |
| Lateral inhibition (XIII.2/X.1) | LIVE (weak strength) | K7 _computeEnergyInhibition + _applyNeuroGating (energy-brain.js:2071,2336) |
| Feedforward inhibition / disinhibition (XIII.2) | OPEN / WEAK | FF absent; disinhibition only as prose labels |
| Thalamocortical input gate (XIII.4) | LIVE (gate) / OPEN (tonic-burst) | evidence-contract gate (energy-brain.js:1226-1245); no relay-mode switch |
| Predictive coding / prediction error (XIII.5) | LIVE (error) / WEAK (summarize-away) | live PE (energy-brain.js:1326-1338); compressor inert (threshold 0) |
| Hebbian / STDP (XIII.6) | IMPOSSIBLE (time+label) | correctly absent |
| Homeostatic synaptic scaling (XIII.6/9) | WEAK (inert) | energy-offline-maintenance.js deep-copy, wrote:false, factor 1 |
| Metaplasticity (XIII.6) | WEAK (inert) | energy-metaplasticity.js gain 0, volatility unwired |
| Neuromodulation / global gain (XIII.7) | LIVE | novelty scalar reconfigures gain/output (energy-brain.js:1354-1370) |
| Set-point homeostasis / allostasis (V.2/XII) | **LIVE (actuated 2026-07-13)** | `_computeEnergyServo` = a real sensor->controller(PI: fast proportional + bounded slow integral, the HPA fast+slow arms)->effector(emission dampening)->feedback loop that drives inhibition toward a drive+deviation TARGET. Reversible via `_actuation.servo`. |
| HPA fast+slow feedback (XII) | WEAK (fast only) | fast K4 hitRate live; slow K3 observe-only |
| Interoception (X.8) | LIVE (observe-only) | _computeEnergyInteroception 6-channel + divergence (energy-brain.js:2214-2323) |
| Offline maintenance / sleep (XIII.9) | WEAK (inert) | module never called; no scheduler to invoke it |
| Diaschisis / SPOF (XIV) | LIVE (post-fix) | now consumes 81-edge graph -> 2 SPOF (energy-brain.js:2183+) |
| Incomplete-circuit diagnostic (XIV) | WEAK (inert) | energy-neuro-substrate.js correct but [INTEGRATION HOOK] unapplied |
| Two-timescale RATIO (XV) | WEAK (cosmetic) | ~12x separation, not ~1000x; no code holds a ratio fixed |
| Escalation broadcast (VIII.1) | LIVE (unlabeled) | cross-domain emissionRules + autonomous emission, brake-gated |

The full aspect-by-aspect table (all ~80 document aspects, Parts I-XV, with each domain partner and
status incl. IMP reasons) accompanies this audit; the fractal-critical subset above is the actionable
core. The gap to autonomy is not new mechanisms alone - it is ACTUATION: ~7 faithful modules sit one
wire from live, and the E/I brake + regulate-to-target servo are the two that would most change behavior.
