# Neuro Learning Reference (running document)

A faithful record of brain-learning mechanisms **as their authors/creators state them**, verified
against the primary neuroscience literature and (where relevant) the reference algorithms. This is
source material, not analysis: no LIMEN mapping, no application spin, no "takeaway" sections. Those
live in the memory directory.

## Method & honesty
- Sources are YouTube science communicators + the primary papers their videos are built on.
- Verbatim transcripts could **not** be pulled (transcript proxies and YouTube `/videos` return 403 to
  server fetchers). Each entry is therefore the video's **topic** (confirmed via Class Central / index
  listings) anchored to the **primary paper(s)** it is built on, with math/params checked against the
  literature and reference implementations.
- Nothing here is invented. Where a specific in-video claim could not be confirmed word-for-word, the
  entry is marked and the mechanism is stated from the cited paper (which is the accuracy ground truth).

## Confidence legend
- `[paper-verified]` — mechanism, math, and parameters confirmed against the primary source and standard
  neuroscience/algorithm references.
- `[video-topic-confirmed]` — the video exists and its subject is confirmed; the mechanism detail is drawn
  from the primary paper, not a verbatim transcript.
- `[attribution-uncertain]` — whether a distinct standalone video exists, or exact video boundaries, not
  fully confirmed.
- `[partially-verified]` — core claim confirmed against the primary source, but a stated sub-detail (a page
  range, one parameter, an appendix) could not be reached. Added 2026-07-19 for Creator 12, whose sources are
  journal articles rather than videos, so the failure modes differ (paywalls, 403s, un-extractable equations).
- `[unverified]` — could not be confirmed this pass. Present so that gaps are recorded rather than quietly
  dropped. Do not cite anything carrying this tag.

## Coverage log
| # | Creator | Field | Items | Date added |
|---|---------|-------|-------|------------|
| 1 | Artem Kirsanov (@ArtemKirsanov, Harvard/Kempner) | Computational neuroscience | 14 | 2026-07-18 |
| 2 | Jeff Hawkins / Numenta | Neocortical theory (HTM + Thousand Brains) | 8 | 2026-07-18 |
| 3 | Richards / Lillicrap / Bengio / Hinton | Biologically plausible backprop / credit assignment | 6 | 2026-07-18 |
| 4 | Chris Eliasmith / Nengo | Neural Engineering Framework (NEF, SPA, Spaun) | 6 | 2026-07-18 |
| 5 | Karl Friston | Free Energy Principle / Active Inference | 9 | 2026-07-18 |
| 6 | Randall O'Reilly | Leabra / predictive cortical learning | 5 | 2026-07-18 |
| 7 | Michael Levin (Allen Discovery Center, Tufts) | Developmental bioelectricity / basal cognition | 6 | 2026-07-18 |
| 8 | Cannon / Wiener / Ashby / Powers / Sterling | Cybernetic & control-theoretic regulation | 7 | 2026-07-18 |
| 9 | McEwen / Seeman / Chrousos / Sapolsky / Lupien / Barrett / Wager | Stress neuroscience: allostatic load, prediction & tracking | 7 | 2026-07-18 |
| 10 | Marten Scheffer / Dakos et al. | Critical transitions & early-warning signals | 8 | 2026-07-18 |
| 11 | Rescorla-Wagner / Sutton-Barto / Schultz | Reinforcement learning & reward prediction error | 5 | 2026-07-18 |
| 12 | Hakkio-Keeton / Illing-Liu / Holló-Kremer-Lo Duca / Kritzman / Gabaix / Acemoglu / Diebold-Yilmaz / Billio-Lo / Baker-Bloom-Davis / Jurado-Ludvigson-Ng / Loughran-McDonald | Economics: financial stress measurement, aggregation, network propagation & uncertainty | 16 | 2026-07-19 |
| 13 | Kalman / Wiener / Rao-Ballard / Friston / Bastos / Wolpert-Ghahramani-Jordan / Todorov-Jordan / Ernst-Banks / Alais-Burr / Körding-Wolpert / Knill-Pouget / Aruoba-Diebold-Scotti / Doz-Giannone-Reichlin | THE ISOMORPHISM: stress = precision-weighted state estimation, shared by neuroscience & economics (the LIMEN thread) | 5 | 2026-07-19 |
| 14 | Bates / Elstein / Schmidt-Norman-Boshuizen / Fagan / Sackett / Norman-Eva / Graber / Croskerry | Clinical diagnostic reasoning: the medical intake (differential, pre-test probability, likelihood ratios, premature closure) — why the estimator is a workup | 8 | 2026-07-20 |

## How to extend
Add the next creator as a new `# Creator N —` section, keep the same per-item template
(Mechanism / Math or Algorithm / Key parameters / Primary sources / Confidence), append a row to the
Coverage log, and date it. Do not edit prior entries except to correct a verified factual error (note the
correction inline).

---

# Creator 1 — Artem Kirsanov

Neuroscience PhD researcher (Harvard, Kempner Institute). Channel focus: how neural systems learn and
compute, at the intersection of neuroscience, computer science, and mathematics. Channel ID
`UCR2uRTQ53V_egXKFflMMaaw`.

## 1.1 Predictive Coding — "The Brain's Learning Algorithm Isn't Backpropagation" (v=l-OLgbdZ3kk)
**Mechanism (as stated).** Backpropagation is biologically implausible for specific reasons: the *weight
transport problem* (the backward pass needs the transpose of the forward weights, which a neuron cannot
access), *non-local credit assignment* (a synapse's update depends on distant neurons), a *separate global
error channel*, and *phase-locking* (activity frozen during the backward pass). Predictive coding (PC)
replaces these with a hierarchy that has two populations per level — **value/representation nodes** x and
**prediction-error nodes** ε — and a single energy (free-energy) function that both inference and learning
descend. Top-down predictions flow down; only the mismatch (prediction error) flows up.

**Math.**
- Energy: `F = ½ Σ_l Σ_i (x_i^(l) − μ_i^(l))² / Σ_i^(l)`, with top-down prediction `μ^(l) = W^(l+1) f(x^(l+1))`
  and `Σ` the precision (inverse variance).
- Error node: `ε_i^(l) = (x_i^(l) − μ_i^(l)) / Σ_i^(l)`.
- Inference (fast, weights fixed): value nodes relax by gradient descent on F,
  `ẋ_b^(a) = −ε_b^(a) + f′(x_b^(a)) Σ_i ε_i^(a−1) θ_{i,b}^(a)` (own top-down error + weighted bottom-up
  errors); run to equilibrium.
- Learning (slow, after relaxation): local Hebbian weight update `Δθ_{b,c}^(a) = α · ε_b^(a−1) · f(x_c^(a))`
  — depends only on the presynaptic value node and postsynaptic error node.
- **Key result:** at equilibrium the error recursion has the same form as backprop's δ recursion; in the
  limit of high output precision the PC weight updates converge to the backprop updates. A network with only
  local Hebbian plasticity computes backprop-equivalent gradients.

**Primary sources.** Rao & Ballard 1999 (Nat Neurosci, predictive coding of visual cortex); Whittington &
Bogacz 2017 (Neural Computation — the core equivalence result, PMC5467749); Millidge, Tschantz & Buckley
2020 (arXiv 2006.04182, PC approximates backprop on arbitrary graphs); Song et al. 2020 (NeurIPS, exact
backprop in PC nets, PMC7610561); Bogacz 2017 (free-energy tutorial).

**Confidence.** `[paper-verified]` for the math; `[video-topic-confirmed]` for the video's exact framing
(syllabus lists credit assignment → backprop limits → energy formalism → activity update → weight update).

## 1.2 Associative Memory — "The Physics of Associative Memory" / Hopfield networks (v=1WPJdAW-sFo)
**Mechanism (as stated).** Content-addressable memory as energy descent. N symmetric-weight neurons; stored
patterns are local energy minima with basins of attraction; a noisy/partial cue rolls downhill into the
nearest stored pattern (pattern completion).

**Math.**
- Energy (classical): `E = −½ Σ_i Σ_j w_ij s_i s_j`, with `s_i ∈ {−1,+1}`.
- Hebbian storage: `w_ij = (1/N) Σ_μ s_i^μ s_j^μ`.
- Async retrieval: `s_i ← sign(Σ_j w_ij s_j − θ)`, iterate to convergence.
- Classical capacity: ~`0.14 N` patterns before spurious minima corrupt recall.
- Modern Hopfield: replacing the quadratic energy with a log-sum-exp (softmax) energy raises capacity to
  exponential in N and makes retrieval one-step; the update rule equals Transformer attention
  (query = cue, keys/values = stored patterns).

**Primary sources.** Hopfield 1982; Amit/Gardner (0.14N capacity); Ramsauer et al. 2020 ("Hopfield Networks
Is All You Need", arXiv 2008.02217, modern Hopfield ↔ attention).

**Confidence.** `[paper-verified]` for classical Hopfield; `[attribution-uncertain]` whether the video
reaches the modern/attention equivalence or stops at the classical model.

## 1.3 Cognitive Maps — "How Your Brain Organizes Information" (Class Central 154530)
**Mechanism (as stated).** The brain builds reusable *cognitive maps* — factorized structural knowledge
separated from sensory content: Tolman's cognitive maps, hippocampal cell types (place cells), grid cells,
and non-spatial/relational "concept" maps. Two computational formalisms are central:
- **Successor Representation (SR):** encode expected discounted future state occupancy, separating transition
  structure (slow) from reward (fast).
- **Tolman–Eichenbaum Machine (TEM):** entorhinal cells learn an abstract structural basis `g` (the graph of
  how states connect, transferable across environments); hippocampal cells bind it to sensory input via a
  conjunctive code, enabling zero-shot generalization to new environments sharing the same structure.

**Math.**
- SR: `M(s,s′) = E[ Σ_{t≥0} γ^t 𝟙(s_t = s′) | s_0 = s ]`; value factorizes as `V(s) = Σ_{s′} M(s,s′) R(s′)`.
- SR learned by TD: `M(s,·) ← M(s,·) + η [ 𝟙(s=·) + γ M(s′,·) − M(s,·) ]`.
- Neural grounding (Stachenfeld 2017): place cells encode rows of M; **grid cells = eigenvectors of the SR
  matrix** (eigendecomposition gives the multi-scale periodic code).
- TEM: factorized code, `hippocampal p ≈ g ⊗ x` (structure bound to content).

**Primary sources.** Tolman 1948; Dayan 1993 (SR); Stachenfeld, Gershman & Behrens 2017 ("The hippocampus as
a predictive map"); Behrens et al. 2018 ("What is a cognitive map?", Neuron); Whittington et al. 2020 (TEM,
Cell, PMC7707106); Fang et al. 2022 (eLife, STDP on theta sweeps approximates SR).

**Confidence.** `[paper-verified]` for SR and TEM math; `[video-topic-confirmed]` that this one video covers
the cognitive-maps cluster (SR + TEM + grid/place cells).

## 1.4 Neural Manifolds — "Brain's Hidden Learning Limits" (v=Ay3_D7VgzZs)
**Mechanism (as stated).** Population activity lives on a low-dimensional *intrinsic manifold* set by the
network's existing correlation structure. In brain-computer-interface experiments, monkeys learn decoder
perturbations that stay **within** the manifold quickly (single session) but **largely fail** to learn
perturbations that require **off-manifold** activity patterns. Learning is constrained by pre-existing
architecture: the brain readily remixes patterns it can already produce, but cannot quickly generate
fundamentally new population structure (that takes slow, effortful change over many sessions).

**Math/quantities.** Intrinsic manifold ≈ top ~10 principal dimensions of N-neuron activity (factor
analysis); within-manifold vs outside-manifold decoder rotations as the experimental manipulation.

**Primary sources.** Sadtler et al. 2014 ("Neural constraints on learning", Nature 512); Oby et al. 2019
(PNAS, new patterns emerge with extended training); Batista/Yu labs.

**Confidence.** `[paper-verified]` for the experiment and result; `[video-topic-confirmed]` (creator's own
posts confirm this is the source work).

## 1.5 Free Energy Principle / Active Inference (Friston)
**Mechanism (as stated).** The brain is a generative model that minimizes **variational free energy** F, a
tractable upper bound on surprise (negative log model evidence). Perception minimizes F with respect to
beliefs (this reduces to predictive coding under Gaussian assumptions); action ("active inference")
minimizes F by changing sensations to match predictions. Policies minimize **expected free energy**, which
splits into a pragmatic (goal) term and an epistemic (information-gain) term — exploration falls out for
free.

**Math.**
- `F = −⟨log p(o,x)⟩_q + ⟨log q(x)⟩_q = Complexity − Accuracy = KL[q(x)‖p(x|o)] − log p(o)`.
- Expected free energy `G(π) = risk (divergence of predicted outcomes from preferred) + ambiguity (expected
  observation uncertainty)`.

**Primary sources.** Friston 2010 ("The free-energy principle: a unified brain theory?", Nat Rev Neurosci);
Friston active-inference series; Buckley et al. 2017 (math review).

**Confidence.** `[paper-verified]` for the framework; `[attribution-uncertain]` on which specific Kirsanov
video is the canonical standalone FEP video (his generative-model/Bayesian-brain videos cover it).

## 1.6 Boltzmann Machines — "The Grandfather of Generative Models" (v=_bqa_I5hNAo)
**Mechanism (as stated).** A stochastic recurrent net of binary units (visible + hidden), symmetrically
connected, that learns a *probability distribution* over data rather than an input→output map. State
probability follows the Boltzmann/Gibbs distribution over an energy; units update stochastically; sampling
at decreasing temperature (annealing) settles toward high-probability configurations. Learning is a
two-phase contrastive Hebbian rule (wake/sleep). Restricted Boltzmann Machines (bipartite, no intra-layer
connections) make sampling tractable via Contrastive Divergence.

**Math.**
- Energy: `E(s) = −(½ Σ_ij w_ij s_i s_j + Σ_i b_i s_i)`; `P(s) ∝ e^(−E(s)/T)`.
- Stochastic unit update: `P(s_i = 1) = σ(Σ_j w_ij s_j / T)`.
- Contrastive Hebbian learning: `Δw_ij = η ( ⟨s_i s_j⟩_data − ⟨s_i s_j⟩_model )` — positive/wake phase clamps
  visible units to data; negative/sleep phase runs free; weights move so the model's fantasies match the
  data statistics. Local, two-factor (endpoint co-activation), no backprop, no global error.

**Primary sources.** Hinton & Sejnowski 1983/85; Ackley, Hinton & Sejnowski 1985; Smolensky 1986 (Harmonium/
RBM); Hinton 2002 (Contrastive Divergence). (Hinton — Nobel Prize in Physics 2024.)

**Confidence.** `[paper-verified]`.

## 1.7 Hodgkin–Huxley Model — "The Core Equation of Neuroscience" (Class Central 365209)
**Mechanism (as stated).** The action potential as an RC circuit with voltage-gated conductances. Fast
positive feedback (Na⁺ activation) drives the spike upstroke; slower negative feedback (K⁺ activation + Na⁺
inactivation) repolarizes. Threshold, all-or-none spiking, and the refractory period emerge from the coupled
ODEs.

**Math.**
- `C dV/dt = I_ext − g_Na m³h (V−E_Na) − g_K n⁴ (V−E_K) − g_L (V−E_L)`.
- Each gating variable: `dx/dt = α_x(V)(1−x) − β_x(V) x` (relaxation toward `x_∞(V)` with `τ_x(V)`), for
  `x ∈ {m, h, n}`.

**Primary sources.** Hodgkin & Huxley 1952 (squid giant axon series; Nobel Prize in Physiology or Medicine
1963).

**Confidence.** `[paper-verified]`.

## 1.8 Dynamical Systems — "Geometry of Neuronal Dynamics" / phase portraits & bifurcations
**Mechanism (as stated).** A neuron (and any regulated unit) as a dynamical system in state space. Tools:
nullclines, fixed points and stability (Jacobian eigenvalues), limit cycles, and **bifurcations**
(qualitative changes as a parameter crosses a critical value). Saddle-node/SNIC → Type-I excitability
(integrator, arbitrarily low firing rate); Hopf → Type-II excitability (resonator, nonzero onset frequency,
subthreshold oscillations). Excitability = sitting near a bifurcation; near a bifurcation systems show
**critical slowing down** — slower recovery from perturbation, rising variance and lag-1 autocorrelation.

**Math/quantities.** Stability from Jacobian eigenvalue sign; critical-slowing-down early-warning indicators:
rising lag-1 AR(1) coefficient and variance approaching a transition.

**Primary sources.** Izhikevich 2007 (*Dynamical Systems in Neuroscience*); FitzHugh–Nagumo; Rinzel &
Ermentrout. (Early-warning-signals literature: Scheffer et al. 2009, Nature.)

**Confidence.** `[paper-verified]` for the dynamical-systems content; `[video-topic-confirmed]`.

## 1.9 Engrams — "Building Blocks of Memory in the Brain" (v=X5trRLX7PQY)
**Mechanism (as stated).** A memory is stored in a sparse, distributed set of neurons (an **engram**) that
were co-active during learning and are physically strengthened. **Allocation:** which neurons join is not
random — neurons with transiently high excitability (high CREB) at encoding win a competition and are
recruited. **Linking:** two memories encoded close in time share overlapping engrams (the same population is
still excitable), creating association; wider temporal gaps yield separate engrams. Engram cells are tagged
by immediate-early genes (c-fos/Arc); optogenetic reactivation is necessary and sufficient for recall.

**Primary sources.** Josselyn & Tonegawa 2020 (engram review, Science); Han et al. 2007 (CREB allocation);
Yiu et al. 2014; Liu et al. 2012 (optogenetic engram); Rogerson et al. (excitability & allocation).

**Confidence.** `[paper-verified]`.

## 1.10 Theta Rhythm — "Theta Rhythm: A Memory Clock" (v=5CxSoFK5tOQ)
**Mechanism (as stated).** Theta (4–8 Hz, paced by the medial septum) is a clock that time-multiplexes
memory. **Phase precession:** as an animal crosses a place field, the cell fires at progressively earlier
theta phases, so position within the field is encoded by spike phase, compressing a behavioral-timescale
sequence into one theta cycle (feeding spike-timing-dependent plasticity). **Theta–gamma coupling
(Lisman–Idiart–Jensen):** each theta cycle nests ~7 gamma sub-cycles, each holding one ordered item — a
slot-based working-memory buffer (~7±2 items) whose theta phase indexes serial order.

**Primary sources.** O'Keefe & Recce 1993 (phase precession); Lisman & Idiart 1995; Jensen & Lisman; Buzsáki
(theta phase coding).

**Confidence.** `[paper-verified]`.

## 1.11 Lognormal Brain — "The Logarithmic Nature of the Brain" (v=erVacDY441U)
**Mechanism (as stated).** Core brain quantities are heavy-tailed / **lognormal**, not Gaussian, spanning
orders of magnitude: firing rates, synaptic weights, axonal conductances, population synchrony. A small
minority of strong synapses / fast-firing "rich-club" neurons carry most of the computational backbone; the
vast weak/slow majority is a plastic reserve. Averages mislead (mean ≫ median); reason on the log scale.
Skewed dynamics balance stability (strong backbone) with flexibility (weak, learnable majority).

**Primary sources.** Buzsáki & Mizuseki 2014 ("The log-dynamic brain", Nat Rev Neurosci); Song et al. 2005
(lognormal EPSP amplitudes).

**Confidence.** `[paper-verified]`.

## 1.12 Memory Consolidation — "Memory Consolidation: Time Machine of the Brain" (v=NteHQv0ceN4)
**Mechanism (as stated).** **Systems consolidation** via hippocampal–cortical dialogue during rest/sleep.
During slow-wave sleep the hippocampus emits **sharp-wave ripples (SPW-R, ~150–250 Hz)** during which recent
experience is **replayed** in compressed and often reverse order, time-locked to ripples and coordinated
with cortical slow oscillations and thalamic spindles (triple coupling), gradually training the memory into
cortex and making it hippocampus-independent. Ripples appear to *select* which experiences consolidate.

**Primary sources.** Buzsáki 2015 (SPW-R review); Wilson & McNaughton 1994 (replay); Ólafsdóttir/Foster
(reverse replay); "Selection of experience by sharp-wave ripples" (Science 2024, doi 10.1126/science.adk8261).

**Confidence.** `[paper-verified]`.

## 1.13 Brain Criticality — "Brain Criticality — Optimizing Neural Computations"
**Mechanism (as stated).** The **critical brain hypothesis**: networks self-tune to operate near a phase
transition between order (activity dies out) and chaos (activity explodes). Signature is **neuronal
avalanches** with power-law size and duration distributions (scale-free, no characteristic size). The control
parameter is the **branching ratio σ** (average descendants per active unit): σ<1 subcritical (signals decay),
σ>1 supercritical (runaway), σ≈1 critical — maximizing dynamic range, information transmission, and
susceptibility. Homeostatic/plastic mechanisms pull σ back toward 1 (self-organized criticality).

**Math/quantities.** Avalanche size `P(s) ∝ s^(−3/2)`, duration `P(d) ∝ d^(−2)` at criticality; branching
ratio σ ≈ 1 at the critical point.

**Primary sources.** Beggs & Plenz 2003 (neuronal avalanches, J Neurosci); Bak, Tang & Wiesenfeld 1987
(self-organized criticality); Chialvo; Shew & Plenz (functional benefits of criticality).

**Confidence.** `[paper-verified]`.

### Coverage caveat (Creator 1)
The channel could not be enumerated with full certainty (YouTube `/videos` and individual Class Central
pages 403 server fetchers). The 14 items above are cross-confirmed via the mwolf.dev catalog index +
Class Central search snippets + primary papers. Two unresolved possibilities: (a) a distinct standalone
grid-cell or Kuramoto-synchronization video separate from the dynamical-systems / theta content (none
surfaced), and (b) any 2026 upload newer than the dynamical-systems video. Verifying these requires the
YouTube Data API on channel `UCR2uRTQ53V_egXKFflMMaaw`.

---

# Creator 2 — Jeff Hawkins / Numenta

Two distinct bodies of work. **HTM (Hierarchical Temporal Memory, ~2004–2017)** is the concrete, coded,
parameterized algorithm layer. **Thousand Brains Theory (2017–2021)** is the newer conceptual framework
(columns, reference frames, voting), mechanism-rich but only partially reduced to production code.

## 2.1 Cortical columns as the repeating unit
**Mechanism (as stated).** The neocortex is ~150,000 near-identical cortical columns, each running the same
algorithm. Claim: object recognition is not a strict hierarchy where only the top learns whole objects —
*every* column learns complete models of complete objects from its own limited sensory patch, by integrating
sensation with movement. Intelligence = thousands of parallel models reconciled by voting; no CEO region;
competence is distributed and redundant (theory tolerates large fractions of unit loss).

**Algorithm/params.** Modeled column (2017 columns paper) = two stacked layers: an input/sensory layer
(~150–250 minicolumns × ~16 cells ≈ 2,400–4,000 cells) and an output layer (~4,096 cells, not organized into
minicolumns). Same wiring repeated per column; columns differ only in what they sense.

**Primary sources.** Hawkins, Ahmad & Cui 2017 (columns paper, PMC5661005); Hawkins et al. 2019 (grid-cell
framework companion paper); *A Thousand Brains* (2021).

**Confidence.** `[paper-verified]` (HTM/columns); the biological universality claim is Hawkins' theory.

## 2.2 Reference frames
**Mechanism (as stated).** Each column attaches every sensory feature to a **location in a reference frame**
anchored to the object. Recognition = accumulating (feature, location) pairs that uniquely identify an object.
The neocortex is claimed to reuse entorhinal machinery — **grid cells** (a metric hexagonal coordinate system)
and **place cells** — with copies in every cortical column, not just navigation areas. Movement updates the
location signal (path integration); the column predicts the next feature given the movement. Abstract concepts
are handled the same way — as objects arranged in learned reference frames.

**Algorithm/params.** Input-layer cells have basal distal dendritic segments that recognize a **location SDR**;
location input biases which cell in each active minicolumn wins, binding feature→location; one cell per active
minicolumn is chosen to represent the current location during learning. A sub-granular "location layer"
computes location by path integration from the movement signal.

**Primary sources.** Hawkins, Ahmad & Cui 2017; Hawkins et al. 2019 (grid-cell framework).

**Confidence.** `[paper-verified]` for the column algorithm; the "grid cells in every column" universality is
Hawkins' hypothesis, not established anatomy.

## 2.3 Voting / consensus
**Mechanism (as stated).** No single column sees enough to be certain. Columns sensing the same object at
different locations share their current object-hypothesis over **long-range lateral connections** in the
output layer. These connections are **modulatory (biasing), not driving**: a cell receiving lateral support
from agreeing columns is depolarized, fires first, and inhibits competitors. Over a few sensations the network
settles on the single object consistent with all columns.

**Algorithm/quantities.** Measured convergence (2017 paper): 1 column ≈ 11 sensations to recognize an object;
3 columns ≈ 4 sensations; with enough columns, single-sensation recognition of confusable objects; diminishing
returns as laterals saturate.

**Primary sources.** Hawkins, Ahmad & Cui 2017 (Fig. 4B convergence data).

**Confidence.** `[paper-verified]`.

## 2.4 Sparse Distributed Representations (SDRs)
**Mechanism (as stated).** State is a long binary vector with a tiny fixed active fraction; semantics live in
*which* bits overlap (similar inputs share active bits). Properties: very high capacity, noise robustness
(a subsample of matching bits reliably identifies a pattern), cheap similarity via overlap count, and the
**union property** (OR many SDRs into one and still test membership with low false-positive rate).

**Math/params.** n ≈ 2,048, active w ≈ 40 (~2%); match threshold θ ≈ 18–20; capacity ≈ `C(n,w)`; two random
SDRs expect ≈ `w²/n` overlapping bits (collisions astronomically rare at n=2,048).

**Primary sources.** Ahmad & Hawkins 2015 ("Properties of SDRs", arXiv 1503.07469); "How do neurons operate on
SDRs" (arXiv 1601.00720).

**Confidence.** `[paper-verified]`.

## 2.5 Spatial Pooler
**Mechanism (as stated).** Converts arbitrary binary input into a fixed-sparsity SDR while preserving
similarity. Each minicolumn has fixed *potential* synapses to an input patch, each with a **permanence**
(connected if permanence > threshold). Overlap = count of connected+active inputs (× boost); **k-winners-take-
all** keeps the top ~2%. Hebbian learning adjusts permanences on winners; **boosting/homeostasis** keeps the
representation distributed (no dead or hog columns).

**Math/params.** connection threshold = 0.5; permanence increment ≈ 0.03–0.1, decrement ≈ 0.02; target sparsity
2%; boosting window T ≈ 1,000 steps.

**Primary sources.** Cui, Ahmad & Hawkins 2017 ("The HTM Spatial Pooler", Frontiers in Comp. Neuroscience).

**Confidence.** `[paper-verified]`.

## 2.6 Temporal Memory — online, backprop-free sequence learner
**Mechanism (as stated).** Each minicolumn has ~16–32 cells; a cell has a point soma plus many **basal
dendritic segments**, each a coincidence detector that puts the cell in a **predictive (depolarized)** state
if enough of its synapses match currently-active cells. Per timestep: (1) feedforward input activates ~2% of
minicolumns; (2) in each active minicolumn, previously-predicted cells win and become active (context-specific
sparse code — same input in different context → different cells, giving high-order/non-Markovian memory for
free); (3) an active minicolumn with **no** predicted cell **bursts** (all cells fire) — bursting = an
unpredicted input = the anomaly signal; (4) cells whose segments now exceed threshold enter the predictive
state for next step; (5) **local learning** — reinforce the segment that correctly predicted a cell, and on a
burst pick the best-matching cell/segment (or grow a new one). Fully online, one pass, no global loss, no
backprop.

**Math/params.** ~2,048 minicolumns × ~32 cells; ≤128 segments/cell; ~40 synapses/segment; segment (NMDA)
threshold θ ≈ 13–15; permanence increment/decrement ≈ 0.1; 2% activity.

**Primary sources.** Hawkins & Ahmad 2016 ("Why Neurons Have Thousands of Synapses", Frontiers; arXiv
1511.00083); Cui et al. 2016 ("Continuous Online Sequence Learning", arXiv 1512.05463).

**Confidence.** `[paper-verified]`.

## 2.7 Anomaly detection from prediction error
**Mechanism (as stated).** Two stages. **Raw anomaly score** = fraction of currently active minicolumns that
were not predicted (0 = fully predicted, 1 = fully bursting/surprising). Because the raw score is noisy,
compute an **anomaly likelihood**: model a rolling window of raw scores as Gaussian (running mean μ, variance
σ²), take a short-term recent mean μ̃, and flag when the tail probability crosses a threshold. This detects a
*change in the distribution of prediction error*, robust to inherently noisy streams. Validated on the
Numenta Anomaly Benchmark (NAB).

**Math.**
- Raw score: `s_t = |A(t) \ π(t−1)| / |A(t)|` (active columns not in the prior prediction, normalized).
- Anomaly likelihood: `L_t = 1 − Q((μ̃ − μ) / σ)`, with Q the Gaussian tail; flag when `L_t` exceeds a
  threshold (e.g. > 0.99999).

**Primary sources.** Ahmad, Lavin, Purdy & Agha 2017 ("Unsupervised real-time anomaly detection for streaming
data", Neurocomputing); reference implementation `nupic anomaly_likelihood.py`; NAB benchmark.

**Confidence.** `[paper-verified]`.

## 2.8 Sensorimotor integration — prediction through movement
**Mechanism (as stated).** The cortex is fundamentally a prediction machine driven by movement. Every column
continuously predicts its next sensory input given the movement it is about to make; correct prediction = the
model is right and the percept is stable; prediction error = the model is wrong → learn. Movement is what lets
a single small sensor build a complete object model — it moves over the object accumulating features at
locations. "Movement" generalizes to any action that changes the input (saccades, touch, attention shifting
across an abstract space).

**Primary sources.** Hawkins, Ahmad & Cui 2017 (sensorimotor inference); *A Thousand Brains* (2021), Part 1.

**Confidence.** `[paper-verified]` for the column model; the whole-cortex generalization is Hawkins' theory.

### Framework note (Creator 2)
Honest split per the source material: HTM (SDRs, Spatial Pooler, Temporal Memory, anomaly likelihood) is
production-grade, parameterized, and reproducible. Reference frames, cross-column voting, and the full
sensorimotor column are the deepest ideas of the Thousand Brains Theory but are the least reduced to
production code and the most dependent on genuine movement/sequence through time.

---

# Creator 3 — Biologically Plausible Backpropagation (Richards / Lillicrap / Bengio / Hinton)

This research program asks whether the brain can perform the deep credit assignment that
backpropagation performs in artificial nets, without the biologically impossible parts of backprop.
Each mechanism below is a distinct proposal for how a local, physically realizable circuit could
compute or approximate the error gradient.

## 3.1 The credit-assignment problem and why exact backprop is biologically implausible
**Mechanism (as stated).** Improving behaviour requires knowing how each synapse deep in the hierarchy
should change to reduce a global error. Backprop solves this by the chain rule but demands operations no
known synapse can perform. The canonical objection list: weight transport, a distinct/segregated backward
pass, and non-locality of the error signal.
**Math / Algorithm.** Feedforward `a_l = W_l h_{l-1}`, `h_l = f(a_l)`:
- Output error `δ_L = ∂C/∂a_L = (h_L − y) ⊙ f'(a_L)`
- Hidden recursion `δ_l = (W_{l+1}^T δ_{l+1}) ⊙ f'(a_l)`
- Update `ΔW_l = −η · δ_l · h_{l-1}^T`
Objections attach to specific terms: (1) **weight transport** — the backward pass uses `W_{l+1}^T`, the exact
transpose of the forward weights, which no mechanism copies between distinct unidirectional synapses;
(2) **segregated backward pass** — `δ_l` is a second linear pass using stored pre-activations `a_l`;
(3) **non-locality** — `δ_l` depends on arbitrarily distant downstream weights/errors; (4) **no dedicated
signed-error channel** in cortex; (5) exact `f'(a_l)` must be known and multiplied in.
**Key parameters.** Learning rate `η`; nonlinearity `f`, derivative `f'`.
**Primary sources.** Lillicrap, Santoro, Marris, Akerman & Hinton 2020 (Nat Rev Neurosci 21:335–346,
PMID 32303713); Lillicrap et al. 2016 (Nat Commun 7:13276).
**Confidence.** [paper-verified] — objection set stated in the 2020 review; equations are the standard
backprop recursion.

## 3.2 Feedback Alignment (and Direct Feedback Alignment)
**Mechanism (as stated).** Feedback Alignment (FA) replaces the transpose `W^T` in the backward pass with a
*fixed random* matrix `B`, never updated. Learning still works because the forward weights evolve so their
action aligns with `B` (the pseudo-gradient stays within 90° of the true gradient — a descent direction).
This removes weight transport. Direct Feedback Alignment (DFA) instead projects the global output error to
every hidden layer through its own fixed random matrix, breaking the sequential backward dependency.
**Math / Algorithm.**
- FA: `δ_h^FA = (B δ_y) ⊙ f'(a_h)`; updates `ΔW_y = −η δ_y h^T`, `ΔW_h = −η (B δ_y ⊙ f'(a_h)) x^T`.
- Learnability: angle between `δ^FA` and the true gradient stays `< 90°`; training drives `W` toward soft
  alignment so `B` acts approximately like `W^T` up to a positive-definite transform.
- DFA: `δ_l = (B_l e) ⊙ f'(a_l)`, `e = ∂C/∂a_L` the single output error, `B_l` fixed random (dim `h_l` × dim
  output) — all hidden layers update in parallel from one broadcast error.
**Key parameters.** Fixed random feedback matrices `B` / `B_l` (drawn once, held constant); learning rate `η`.
**Primary sources.** Lillicrap, Cownden, Tweed & Akerman 2016 (Nat Commun 7:13276; preprint arXiv:1411.0247);
Nøkland 2016 (NeurIPS; arXiv:1609.01596).
**Confidence.** [paper-verified] — fixed-random-`B` mechanism and DFA broadcast confirmed from source; the
`W^T → B` substitution and alignment argument are the papers' canonical forms.

## 3.3 Target Propagation / Difference Target Propagation
**Mechanism (as stated).** Propagate *targets*, not gradients: each layer gets a desired activation `ĥ_l`
that would lower the global loss, and trains locally toward it. Targets are carried backward by *learned*
feedback functions `g_l` that approximate the inverse of the forward `f_l` (trained autoencoder-style).
Difference Target Propagation (DTP) adds a linear correction cancelling the error from `g_l` being an
imperfect inverse. Because it exchanges values, not derivatives, it tolerates stochastic/discrete units.
**Math / Algorithm.**
- Inverse trained by reconstruction: minimize `L_l^inv = || g_l(f_l(h_{l-1} + ε)) − (h_{l-1} + ε) ||²`.
- Top target from loss: `ĥ_L = h_L − η̂ ∂L/∂h_L`.
- Naive: `ĥ_{l-1} = g_l(ĥ_l)`.
- **DTP correction:** `ĥ_{l-1} = h_{l-1} + g_l(ĥ_l) − g_l(h_l)` (if `ĥ_l = h_l` then `ĥ_{l-1} = h_{l-1}`).
- Local forward update: minimize `L_l = || f_l(h_{l-1}) − ĥ_l ||²` w.r.t. `W_l`.
**Key parameters.** Feedback functions `g_l` (learned) with own weights; reconstruction-noise variance; target
step `η̂`; local learning rate.
**Primary sources.** Lee, Zhang, Fischer & Bengio 2015 (ECML-PKDD; arXiv:1412.7525); Bengio 2014
(arXiv:1407.7906).
**Confidence.** [paper-verified] — DTP correction, autoencoder-trained `g_l`, and loss-derived top target
confirmed from source.

## 3.4 NGRAD hypothesis (Neural Gradients Represented by Activity Differences)
**Mechanism (as stated).** The unifying hypothesis of "Backpropagation and the brain": the brain does not
transmit signed errors on a dedicated channel; feedback connections drive neurons toward a target-influenced
state, and the *difference* between that feedback-driven activity and the feedforward activity locally encodes
the error. Ordinary activity-dependent plasticity then uses these differences. NGRAD = "Neural Gradient
Representation by Activity Differences," and is argued to subsume target prop, equilibrium prop, predictive
coding, and dendritic-error schemes.
**Math / Algorithm.** Schema (not one equation): with feedforward activity `h_l^ff` and feedback-influenced
target state `h_l^*`, the local error is `Δh_l = h_l^* − h_l^ff`, giving a Hebbian rule `ΔW_l ∝ Δh_l · h_{l-1}^T`.
Consequence stated in the review: the postsynaptic term of the plasticity rule must measure a *change* in
firing rate, not the raw rate.
**Key parameters.** None specific (a hypothesis-class constraint: feedback must nudge activity; plasticity
must read activity differences).
**Primary sources.** Lillicrap, Santoro, Marris, Akerman & Hinton 2020 (Nat Rev Neurosci 21:335–346,
PMID 32303713).
**Confidence.** [paper-verified] — NGRAD definition confirmed from source; `ΔW ∝ Δh · h^T` is the review's
illustrative form, not a numbered equation.

## 3.5 Burst-dependent / dendritic error coding
**Mechanism (as stated).** A concrete cortical NGRAD implementation. Pyramidal neurons multiplex two streams
on one axon: single spikes ("events") carry the bottom-up signal; high-frequency **bursts** carry the top-down
(feedback/teaching) signal. Apical-dendrite input (regenerative calcium events coupling somatic spikes with
top-down feedback) controls whether an event becomes a burst. A burst-dependent plasticity rule — potentiation
when bursting exceeds baseline, depression when below — moves lower-layer synapses to reduce top-level error.
Short-term synaptic dynamics let downstream neurons demultiplex the two streams.
**Math / Algorithm.** Event rate `E`, burst probability `P`, burst rate `B = P·E`. Apical/top-down input sets
`P` relative to baseline `P̄`, so burst-rate deviation encodes the teaching signal. Burst-dependent plasticity
(form): `Δw_ij ∝ Ẽ_j^pre · (B_i^post − P̄_i·E_i^post)` — positive (potentiation) above baseline, negative below.
Demultiplexing: short-term-depressing synapses preferentially transmit the event rate (feedforward);
short-term-facilitating synapses transmit the burst rate (feedback).
**Key parameters.** `E`, `P`, `B=PE`, moving-average `P̄`; short-term depression/facilitation time constants;
apical coupling strength; plastic feedback weights.
**Primary sources.** Payeur, Guerguiev, Zenke, Richards & Naud 2021 (Nat Neurosci 24:1010–1019,
doi:10.1038/s41593-021-00857-x; bioRxiv 2020.03.30.015511).
**Confidence.** [paper-verified] for mechanism (event/burst multiplexing, apical control, burst-dependent
plasticity around baseline, STD/STF demultiplexing). [attribution-uncertain] for the exact rule coefficients —
`Δw ∝ Ẽ^pre(B − P̄E)` is reconstructed to match the paper's "deviation of burst rate from baseline"
description (full text was paywalled); treat the precise expression as indicative.

## 3.6 Equilibrium Propagation
**Mechanism (as stated).** A two-phase, energy-based, fully local alternative. The network is a continuous
dynamical system (continuous Hopfield / leaky-integrator net) that relaxes to an energy minimum. In the **free
phase** it settles given the input; in the **nudged phase** the output is gently pulled toward the target by a
small factor `β`, and the perturbation propagates through the same recurrent dynamics. The weight update is the
difference in local Hebbian correlations between the two equilibria — no separate backward pass — and provably
matches the backprop gradient as `β → 0`.
**Math / Algorithm.**
- Energy: `E(u) = ½ Σ_i u_i² − ½ Σ_{i≠j} W_ij ρ(u_i) ρ(u_j) − Σ_i b_i ρ(u_i)`, `ρ` a bounded nonlinearity.
- Output cost `C = ½ ‖y − ŷ‖²`; total nudged energy `F = E + β C`; dynamics `du/dt = −∂F/∂u`.
- Free phase (`β=0`) → fixed point `u^0`; nudged phase (`β>0` small) → `u^β`.
- Learning rule (local, contrastive-Hebbian): `ΔW_ij ∝ (1/β)[ ρ(u_i^β)ρ(u_j^β) − ρ(u_i^0)ρ(u_j^0) ]`.
- Theorem: as `β → 0` this equals `−∂C/∂W` (the backprop gradient).
**Key parameters.** Nudging factor `β` (small, >0); nonlinearity `ρ`; two relaxation dynamics; learning rate.
**Primary sources.** Scellier & Bengio 2017 (Front Comput Neurosci 11:24; arXiv:1602.05179).
**Confidence.** [paper-verified] for mechanism; equations are the paper's canonical published forms (PDF binary
extraction failed, so reproduced from the standard statement rather than re-quoted line-by-line).

### Verification note (Creator 3)
Titles, authors, venues, and mechanisms confirmed against arXiv abstracts and the Nature/bioRxiv listings.
Several full-text PDFs returned 403/binary, so the EqProp weight rule and the burst-rule coefficients are
reproduced from the papers' canonical forms rather than freshly quoted; the burst-rule coefficient is flagged
[attribution-uncertain] in 3.5.

---

# Creator 4 — Chris Eliasmith / Neural Engineering Framework (Nengo, SPA, Spaun)

Chris Eliasmith (University of Waterloo) and Charles Anderson built the Neural Engineering Framework (NEF), a
quantitative method for compiling high-level computations into networks of spiking neurons. Layered on top are
the Semantic Pointer Architecture (SPA), the Spaun brain model, and the Nengo simulator.

## 4.1 NEF Principle 1 — Representation (nonlinear encoding, linear decoding)
**Mechanism (as stated).** A population of spiking neurons collectively represents a time-varying vector **x**.
Each neuron encodes **x** nonlinearly through its tuning curve; the value is recovered by an optimal *linear*
decoding (weighted sum of filtered activities). Representation = a nonlinear encoder paired with a weighted
linear decoder.
**Math / Algorithm.** Encoding `a_i = G[ α_i ⟨e_i, x⟩ + J_bias_i ]` (G the LIF spiking nonlinearity, α_i gain,
e_i unit-length encoder, J_bias_i bias). Decoding `x̂ = Σ_i d_i a_i`, with decoders from least squares:
`d = Γ⁻¹Υ`, `Γ_ij = Σ_x a_i(x)a_j(x)`, `Υ_j = Σ_x a_j(x)x`, plus a noise term σ² on Γ's diagonal.
**Key parameters.** Gain α_i, bias J_bias_i, encoders e_i, neuron count N, dimensionality D, max rates and
x-intercepts, regularization σ², synaptic filter τ.
**Primary sources.** Eliasmith & Anderson 2003 (MIT Press, *Neural Engineering*); Bekolay et al. 2014
(Front Neuroinform, Nengo paper).
**Confidence.** [paper-verified] — encoding/decoding confirmed in the Nengo Frontiers paper; the Γ/Υ closed form
is the canonical NEF textbook result (relayed from standard references, not re-derived from a fetched page).

## 4.2 NEF Principle 2 — Transformation (functions via decoders)
**Mechanism (as stated).** Connections compute functions of **x**, not just transmit it. Any `f(x)` is realized
by choosing *decoders for that function*, then wiring them into the downstream encoders. The connection weight
matrix is derived analytically, not trained.
**Math / Algorithm.** For `y = f(x)`, solve `min ‖f(x) − Σ_i d_i^f a_i(x)‖²` for function-decoders `d_i^f`.
Full synaptic weight `w_ij = α_j ⟨e_j, d_i^f⟩` (downstream encoder × upstream function-decoder).
**Key parameters.** Target `f`, function-decoders `d^f`, downstream encoders e_j and gains α_j.
**Primary sources.** Eliasmith & Anderson 2003; Bekolay et al. 2014.
**Confidence.** [paper-verified] — `w_ij = α_j⟨e_j, d_i⟩` and the "substitute f(x) for x" decoder solve confirmed
in the Nengo Frontiers paper.

## 4.3 NEF Principle 3 — Dynamics (recurrent connections as dynamical systems)
**Mechanism (as stated).** Represented vectors are treated as state variables. Because synapses act as filters
(leaky integrators), the NEF rewrites a desired dynamical system into a recurrent-connection spec that, once
passed through the synaptic filter, produces the intended dynamics (integrators, attractors, oscillators).
**Math / Algorithm.** Control form `ẋ = A x + B u`. For an exponential synapse with time constant τ, replace
with `A′ = τA + I`, `B′ = τB`; the recurrent connection implements `A′`, the input `B′`. A perfect integrator
(`A=0, B=1`) gives `A′=I` (unit feedback) and `B′=τ`, cancelling the synapse's leak.
**Key parameters.** Synaptic time constant τ; feedback A and input B; recurrent decoders implementing A′.
**Primary sources.** Eliasmith & Anderson 2003; Nengo dynamics documentation (nengo.ai).
**Confidence.** [paper-verified] — `A′=τA+I`, `B′=τB`, integrator case confirmed in Nengo docs, consistent with
Eliasmith & Anderson 2003.

## 4.4 Semantic Pointer Architecture — compressed vectors and circular-convolution binding
**Mechanism (as stated).** A "semantic pointer" is a compressed high-dimensional neural vector that carries
semantic content (position in a similarity space) and can be dereferenced back toward richer detail. SPA is a
vector symbolic architecture built on Plate's Holographic Reduced Representations (HRR): structures are built by
*binding* role/filler vectors and *superposing* results, in fixed dimensionality, implementable in spiking
neurons via the NEF.
**Math / Algorithm.** On D-dimensional vectors: binding `C = A ⊛ B` (circular convolution, dissimilar to both
inputs), computed as `A ⊛ B = IDFT(DFT(A) ⊙ DFT(B))`; unbinding `B ≈ C ⊛ A⁻¹` (`A⁻¹` the involution/reversed
vector); superposition = elementwise addition. E.g. "red circle" = `SHAPE ⊛ CIRCLE + COLOR ⊛ RED`; query with
`COLOR⁻¹` returns ≈ RED, cleaned by an associative memory.
**Key parameters.** Vector dimensionality D (hundreds–thousands; controls binding capacity/crosstalk); atomic
vocabulary (random unit vectors); a clean-up/associative memory.
**Primary sources.** Eliasmith 2013 (*How to Build a Brain*, OUP); Plate 1995 (HRR); Blouw et al. 2016
(Cognitive Science).
**Confidence.** [paper-verified] — binding = circular convolution, unbinding via pseudo-inverse, superposition =
addition confirmed across SPA/HRR sources; Fourier-domain form is the standard HRR computation.

## 4.5 Spaun — one fixed spiking network performing eight tasks
**Mechanism (as stated).** Spaun (Semantic Pointer Architecture Unified Network) is a single fixed-architecture
spiking model with one 28×28 visual "eye" and a modeled arm that draws answers. With no reconfiguration, it
switches behavior on a task-instruction input — unifying perception, cognition, and action in one biologically
constrained network built from NEF/SPA parts.
**Math / Algorithm.** Pipeline: (1) hierarchical visual system compresses images to semantic pointers; (2)
information-encoding to working-memory pointers; (3) SPA binding/unbinding computation; (4) reward evaluation
for RL; (5) basal-ganglia action-selection loop (striatum, STN, GPe, GPi/SNr) picks highest-utility rule; (6)
motor system generates arm trajectories. Working memory uses NEF integrator/attractor dynamics; all computation
in LIF spiking neurons. Eight tasks: copy drawing, image recognition, reinforcement learning (bandit), serial
working-memory recall, counting, question answering, rapid variable creation, fluid reasoning (Raven's-style).
**Key parameters.** ~2.5 million LIF neurons; single fixed connectome; 28×28 visual input; arm output;
anatomical mapping to visual cortex, PFC/working memory, basal ganglia, thalamus, motor areas.
**Primary sources.** Eliasmith, Stewart, Choo, Bekolay, DeWolf, Tang & Rasmussen 2012, "A Large-Scale Model of
the Functioning Brain," Science 338:1202–1205.
**Confidence.** [paper-verified] on architecture, LIF neurons, single fixed network, arm output, basal-ganglia
selection. [attribution-uncertain] on exact neuron count — the Science headline is ~2.5M (one secondary fetch
said 2.3M); the eight-task labels are the canonical set (one automated fetch returned a garbled list).

## 4.6 Nengo — compiling the NEF into runnable code
**Mechanism (as stated).** Nengo is the Python simulator that turns NEF/SPA specs into spiking networks. The
modeler declares populations (Ensembles) representing vectors and Connections annotated with the function to
compute; Nengo solves for decoders and hence weights. The user writes the computation; Nengo derives the weights.
**Math / Algorithm.** `nengo.Ensemble(n_neurons, dimensions, neuron_type=nengo.LIF())` samples encoders/gains/
biases from chosen max-rate and intercept distributions. `nengo.Connection(A, B, function=f)` triggers the
least-squares decoder solve (`d = Γ⁻¹Υ` with regularization); the signal is filtered by a synapse (default
exponential, τ). Recurrent `nengo.Connection(x, x, transform=A_prime, synapse=tau)` implements Principle-3
dynamics. Weights may stay factored (encoder × decoder) or be multiplied to `w_ij = α_j⟨e_j, d_i^f⟩`.
**Key parameters.** n_neurons, dimensions, neuron_type, max_rates/intercepts distributions, synaptic τ, decoder
solver + regularization, `function=`/`transform=` on connections, timestep dt.
**Primary sources.** Bekolay et al. 2014, "Nengo: a Python tool for building large-scale functional brain
models," Front Neuroinform 7:48; nengo.ai documentation.
**Confidence.** [paper-verified] — ensemble construction, LIF default, decoder-solve-on-connection, synaptic
filtering confirmed in the Nengo Frontiers paper and docs.

---

# Creator 5 — Karl Friston / Free Energy Principle & Active Inference

The Free Energy Principle (FEP) states that any self-organizing system that persists must minimize a variational
free-energy functional — an upper bound on the "surprise" (negative log-evidence) of its sensory states — and
that perception, learning, and action are all gradient descents on this single quantity. Active inference is the
corollary that action minimizes *expected* free energy over future outcomes. Sign conventions follow the sources.

## 5.1 Variational free energy as a bound on surprise
**Mechanism (as stated).** An agent cannot compute the true posterior p(x|o) or the evidence p(o); it maintains
an approximate recognition density q(x) and minimizes a tractable functional F that upper-bounds surprise
−ln p(o). Minimizing F w.r.t. q makes q approach the posterior and tightens the evidence bound.
**Math / Algorithm.** `F = ∫ q(x) ln[q(x)/p(o,x)] dx = E_q[ln q(x) − ln p(o,x)]`. Three decompositions:
- Evidence bound: `F = D_KL[q(x)‖p(x|o)] − ln p(o)` (so `F ≥ −ln p(o)`).
- Energy − entropy: `F = E_q[E(x,o)] − H[q]`, `E(x,o) ≡ −ln p(o,x)`.
- Complexity − accuracy: `F = D_KL[q(x)‖p(x)] − E_q[ln p(o|x)]`.
**Key parameters.** Generative model `p(o,x) = p(o|x)p(x)`; recognition density q(x) and its sufficient
statistics; KL terms are the non-negative slack.
**Primary sources.** Friston 2010 (Nat Rev Neurosci 11:127–138, doi:10.1038/nrn2787); Buckley, Kim, McGregor &
Seth 2017 (J Math Psychol 81:55–79, arXiv:1705.09156); Smith, Friston & Whyte 2022 (J Math Psychol 107:102632).
**Confidence.** [paper-verified] — F definition and decompositions transcribed from Buckley 2017 and Smith 2022.

## 5.2 Perception as inference: Laplace approximation
**Mechanism (as stated).** For continuous states, assume q(x) = N(x; μ, Σ) (Laplace). F then depends only on the
mean/mode μ (the optimal covariance is fixed by the energy curvature at μ). Perception = gradient descent driving
μ to the posterior mode.
**Math / Algorithm.** `F = E(μ,o) − ½ ln{2π ζ*}`, `E(μ,o) = −ln p(o,μ)`, `ζ* = [∂²E/∂x²|_μ]⁻¹`. Minimizing F
reduces to minimizing E(μ,o). In generalized coordinates of motion `μ̃ = (μ, μ′, μ″, …)`: `μ̃̇ = D μ̃ − ∂F/∂μ̃`
(D the derivative/shift operator); settles when `μ̃̇ = D μ̃`.
**Key parameters.** Mode μ and generalized-coordinate vector μ̃; curvature ∂²E/∂x² setting ζ*; operator D.
**Primary sources.** Buckley et al. 2017 (arXiv:1705.09156); Friston, Trujillo-Barreto & Daunizeau 2008 "DEM"
(NeuroImage 41:849–885).
**Confidence.** [paper-verified] — Laplace F and ζ* from Buckley 2017; `μ̃̇ = Dμ̃ − ∂F/∂μ̃` is Friston's DEM
convention.

## 5.3 Predictive coding as the continuous-state implementation
**Mechanism (as stated).** For a hierarchical linear-Gaussian model, gradient descent on the Laplace free energy
becomes precision-weighted prediction-error minimization. Each level predicts the level below; the residual,
weighted by its precision (inverse variance), passes back up; state units carry expectations, error units carry
precision-weighted errors.
**Math / Algorithm.** Static model `o = g(x;θ) + z`, prior `x = x̄ + w`. Energy
`E(μ,o) = ½ ε_z²/σ_z + ½ ε_w²/σ_w + ½ ln(σ_z σ_w)`, with `ε_z = o − g(μ;θ)` and `ε_w = μ − x̄`. With precisions
`Π = Σ⁻¹`: `μ̇ = −∂F/∂μ = Π_z ε_z ∂g/∂μ − Π_w ε_w` (the canonical predictive-coding update).
**Key parameters.** Prediction errors ε_z, ε_w; precisions Π = Σ⁻¹ (gains on error units); nonlinearity g,
flow f; generalized-coordinate order.
**Primary sources.** Buckley et al. 2017 (arXiv:1705.09156); Friston 2005 "A theory of cortical responses"
(Phil Trans R Soc B 360:815–836); Bogacz 2017 tutorial (J Math Psychol 76:198–211).
**Confidence.** [paper-verified] — energy, ε_z/ε_w, precision-weighted μ̇ transcribed from Buckley 2017.

## 5.4 Action: active inference in continuous time
**Mechanism (as stated).** Action changes sensations, not beliefs. F can be lowered by updating μ (perception)
or by acting so incoming sensations match predictions (action). Because action affects F only through sensory
prediction errors, the control law is gradient descent on F w.r.t. action; classical reflexes emerge as
suppression of proprioceptive prediction error.
**Math / Algorithm.** `ȧ = −∂F/∂a = −(∂õ/∂a)ᵀ Π_z ε_z` — only the sensory-error term depends on `a`. Equilibrium
when action cancels the precision-weighted sensory error. Perception (μ̇) and action (ȧ) are symmetric arms of
one descent on F.
**Key parameters.** Action a; sensory sensitivity ∂o/∂a; sensory precision Π_z; sensory prediction error ε_z.
**Primary sources.** Friston, Daunizeau, Kilner & Kiebel 2010 "Action and behavior: a free-energy formulation"
(Biol Cybern 102:227–260); Buckley et al. 2017.
**Confidence.** [paper-verified] — `ȧ = −∂F/∂a` acting only through ∂ε_z/∂a stated in Buckley 2017; chain-rule
form matches Friston 2010 (Biol Cybern).

## 5.5 Expected free energy G(π): discrete-state active inference
**Mechanism (as stated).** For planning, policies π are evaluated by the free energy *expected* in future,
averaging over unobserved outcomes under the generative model. G trades off reaching preferred outcomes
(pragmatic/extrinsic value = risk) against resolving uncertainty (epistemic value/information gain = ambiguity),
yielding goal-directed and exploratory behavior without an added exploration bonus.
**Math / Algorithm.** POMDP factors: A = P(o|s) likelihood; B = P(s'|s,π) transitions; C = ln P(o|C)
log-preferences; D = P(s₁) initial prior. Policy free energy `F_π = D_KL[q(s|π)‖p(s|π)] − E_{q(s|π)}[ln p(o|s,π)]`.
Expected free energy `G_π = D_KL[q(o_τ|π)‖p(o_τ|C)] + E_{q(s_τ|π)}[H[p(o_τ|s_τ)]]` (risk + ambiguity), equivalently
`G_π = −(epistemic value) − (pragmatic value)`. Matrix form
`G_π = A s_{π,τ}·(ln A s_{π,τ} − ln C_τ) − diag(Aᵀ ln A)·s_{π,τ}`.
**Key parameters.** A, B, C, D; predicted states s_{π,τ}; preference vector C (utility as log-prior); horizon τ.
**Primary sources.** Da Costa, Parr, Sajid, Veselic, Neacsu & Friston 2020 (J Math Psychol 99:102447,
arXiv:2001.07203); Smith, Friston & Whyte 2022; Friston, FitzGerald, Rigoli, Schwartenbeck & Pezzulo 2017
"Active inference: a process theory" (Neural Comput 29:1–49).
**Confidence.** [paper-verified] — A/B/C/D, F_π, G_π risk+ambiguity and epistemic/pragmatic forms, matrix
implementation transcribed from Smith et al. 2022 (consistent with Da Costa 2020).

## 5.6 Policy selection and precision γ
**Mechanism (as stated).** Policy beliefs follow a softmax of negative expected free energy: lower-G policies are
more probable. A precision γ scales the softmax — confidence in the G evaluation — gating how deterministically
the agent commits. γ is itself inferred (gamma prior), so the agent updates its own decision confidence online.
**Math / Algorithm.** `π⁰ = σ(ln E − γ G)`, `π = σ(ln E − F_π − γ G_π)` (σ softmax, E habit prior). Precision
prior `p(γ) = Γ(1, β)`, `E[γ] = 1/β`; γ updated by a fixed point balancing prior against G-weighted beliefs.
State updates: `s_{π,1} = σ(½(ln D + ln(B†_{π,τ} s_{π,τ+1})) + ln Aᵀ o_τ)`, and for τ>1 the forward+backward
message form.
**Key parameters.** Policy precision γ (gamma prior rate β); habit prior E; transition messages B, B†.
**Primary sources.** Da Costa et al. 2020; Smith, Friston & Whyte 2022; Friston et al. 2017.
**Confidence.** [paper-verified] — `π = σ(ln E − F − γG)`, `p(γ)=Γ(1,β)`, state-update softmax transcribed from
Smith et al. 2022.

## 5.7 Precision / gain and its neuromodulatory interpretation
**Mechanism (as stated).** Precision is the inverse-variance weighting on each prediction error, i.e. the synaptic
gain on error units — sensory (Π_z), state/prior, and policy (γ). Friston et al. map these to neuromodulation:
dopamine ≈ policy/affordance precision (γ), acetylcholine ≈ likelihood/sensory precision, noradrenaline ≈
transition/volatility precision. Aberrant precision is offered as a formal account of symptoms.
**Math / Algorithm.** In PC, Π = Σ⁻¹ multiplies each error, e.g. `μ̇ = Π_z ε_z ∂g/∂μ − Π_w ε_w`; raising Π_z
increases sensory-error influence. In discrete AI, `π = σ(−γ G)` makes γ the gain on expected-free-energy
differences (high γ → deterministic; low γ → exploratory). γ dynamics track prior-vs-posterior policy belief
discrepancy, analogous to a dopaminergic prediction error.
**Key parameters.** Precisions Π = Σ⁻¹ (Π_z, Π_w); policy precision γ, rate β; neuromodulator mapping (proposed).
**Primary sources.** Friston et al. 2012 "Dopamine, affordance and active inference" (PLoS Comput Biol
8:e1002327); Parr & Friston 2017 (J R Soc Interface 14:20170376); Friston 2010.
**Confidence.** [paper-verified] for precision = inverse-variance/gain and the γ softmax; [attribution-uncertain]
for the specific neuromodulator↔precision assignments — theoretical proposals, not established physiology.

## 5.8 Markov blankets and internal vs external states
**Mechanism (as stated).** The FEP rests on a statistical partition: to be distinguishable from its environment a
system must have a Markov blanket rendering internal states conditionally independent of external states. The
blanket splits into sensory states (influenced by external, not internal) and active states (influenced by
internal, not external). Internal states then appear to infer external states.
**Math / Algorithm.** Partition ψ = {η (external), s (sensory), a (active), μ (internal)}; blanket b = {s, a};
`p(η, μ | b) = p(η|b) p(μ|b)` (η ⊥ μ | b). Under non-equilibrium steady-state `p*(ψ) = exp(−G(ψ))`, internal/
active flows can be written as gradient flow on surprise, so internal states parameterize a variational density
minimizing F. (Derivation uses a Langevin/Fokker-Planck dissipative + solenoidal decomposition.)
**Key parameters.** Partition {η, s, a, μ}; blanket b = {s, a}; steady-state density p*(ψ); flow operator
(dissipative Γ + solenoidal Q).
**Primary sources.** Friston 2013 "Life as we know it" (J R Soc Interface 10:20130475); Friston 2019 (arXiv:
1906.10184); Parr, Da Costa & Friston 2020 (Phil Trans R Soc A 378:20190159).
**Confidence.** [paper-verified] for the partition and conditional-independence definition; [attribution-uncertain]
for the strong "any persisting system infers" reading (contested — see 5.9).

## 5.9 Status: falsifiability and scope criticism
**Mechanism (as stated, incl. critique).** The FEP is frequently criticized as unfalsifiable/tautological at its
most general: "systems that persist minimize free energy" can read as true by construction, since free energy is
surprise and persistence is defined via the same steady-state density. Critics argue empirical content lies only
in the process theories it motivates (predictive coding, the POMDP scheme), which are testable, whereas the
overarching principle is a normative/"as-if" framework. A second critique targets equating the mathematical
Markov blanket with a physical/agential boundary.
**Math / Algorithm.** None new; the dispute concerns the interpretation of F (5.1) and p*(ψ) with b={s,a} (5.8).
**Key parameters.** N/A (meta-theoretical).
**Primary sources.** Colombo & Wright 2021 (Synthese 198:S3463–S3488); Bruineberg, Dolega, Dewhurst & Baltieri
2022 "The Emperor's New Markov Blankets" (Behav Brain Sci 45:e183); Hohwy 2016 "The self-evidencing brain"
(Noûs 50:259–285); Friston et al. replies.
**Confidence.** [paper-verified] that these criticisms exist as stated; contested by Friston and colleagues — an
open debate, not a settled verdict.

### Verification note (Creator 5)
Core equations transcribed from primary sources — principally Buckley et al. 2017 (arXiv:1705.09156) for the
continuous/predictive-coding math and Smith, Friston & Whyte 2022 (PMC8956124) for the discrete POMDP —
cross-checked against Da Costa et al. 2020 and Friston 2010. Equations were verified via ar5iv/PMC HTML rather
than the binary PDFs. Two items marked [attribution-uncertain]: the neuromodulator↔precision assignments (5.7)
and the strong Markov-blanket reading (5.8); 5.9 records the standing falsifiability criticism factually.

---

# Creator 6 — Randall O'Reilly / Leabra & Predictive Cortical Learning

O'Reilly's program builds error-driven learning that uses only locally available activation variables, avoiding
the non-local error transport of backprop. The arc runs from GeneRec (1996) — showing contrastive Hebbian
learning is a form of backprop — through the Leabra framework and its XCAL rule, to the 2021 pulvinar model that
grounds the two "phases" in thalamocortical anatomy and the ~100 ms alpha cycle.

## 6.1 GeneRec (Generalized Recirculation)
**Mechanism (as stated).** A recurrently, symmetrically connected sigmoidal network settles to equilibrium in two
phases: in the **minus phase** only the input is clamped and the network produces its own expectation over
outputs; in the **plus phase** the target/outcome is also clamped. Error is carried backward through the same
reciprocal weights by ordinary bidirectional activation flow, so a hidden unit's error appears locally as the
difference between its plus- and minus-phase states. With symmetric weights this computes essentially the same
gradient as Almeida-Pineda recurrent backprop.
**Math / Algorithm.** With sending `s_i`, receiving `s_j` (superscripts +/− = phase):
- GeneRec: `Δw_ij = η · s_i⁻ · (s_j⁺ − s_j⁻)`
- Midpoint (average sending across phases): `Δw_ij = η · ½(s_i⁺ + s_i⁻) · (s_j⁺ − s_j⁻)`
- Symmetry preservation: apply the summed/averaged change to both reciprocal weights.
Midpoint + symmetry yields CHL exactly. The `(s_j⁺ − s_j⁻)` term is the local stand-in for the error derivative
and needs no explicit derivative of the activation function.
**Key parameters.** Learning rate η; symmetric reciprocal weights; two-phase settle schedule; cross-entropy error
framing.
**Primary sources.** O'Reilly 1996, "Biologically Plausible Error-Driven Learning Using Local Activation
Differences: The Generalized Recirculation Algorithm," Neural Computation 8(5):895–938.
**Confidence.** [paper-verified] — equations extracted from the source PDF; glyph OCR was lossy but the surrounding
prose fixes the forms unambiguously.

## 6.2 Contrastive Hebbian Learning (CHL) as symmetric-midpoint GeneRec
**Mechanism (as stated).** CHL (deterministic/mean-field Boltzmann learning) is the difference between pre-post
activation coproducts in the two phases: it lowers the energy of the plus-phase state and raises it for the
minus-phase state. O'Reilly derives CHL from *within* the backprop framework via GeneRec, sidestepping the
mean-field assumptions earlier authors called flawed.
**Math / Algorithm.** `Δw_ij = η · (s_i⁺ s_j⁺ − s_i⁻ s_j⁻)` — exactly `dw ∝ (x⁺y⁺ − x⁻y⁻)`. Midpoint integration +
symmetry make it generally learn faster than equivalent backprop/AP networks.
**Key parameters.** η; symmetric weights; two-phase equilibrium activations s⁺, s⁻.
**Primary sources.** O'Reilly 1996 (Neural Computation 8(5)); original CHL: Ackley, Hinton & Sejnowski 1985;
Movellan 1990.
**Confidence.** [paper-verified] — CHL form present in the source and re-derived from GeneRec.

## 6.3 Leabra Framework
**Mechanism (as stated).** Leabra ("Local, Error-driven and Associative, Biologically Realistic Algorithm")
composes three pieces: (1) a **point-neuron** conductance-based activation yielding a rate-coded output;
(2) **inhibitory competition** among units (modern versions use an FFFB feedforward+feedback inhibition function
approximating **k-Winners-Take-All** sparse codes); (3) a learning rule **balancing error-driven (GeneRec/CHL,
later XCAL) with Hebbian self-organizing learning**, over bidirectionally connected layers.
**Math / Algorithm.** Point-neuron membrane update:
`Inet = Ge*(E_e − Vm) + Gbar_L*(E_l − Vm) + Gi*(E_i − Vm) + noise`; `Vm += (1/VmTau)*Inet`.
Rate output via noisy X-over-X-plus-1: `geThr = (Gi*(E_i−Thr) + Gbar_L*(E_l−Thr))/(Thr−E_e)`;
`act = NoisyXX1(Gain*(Ge*Gbar_E − geThr))`, with `XX1(x)=x/(x+1)` for x>0. FFFB inhibition:
`ffNetin = avgGe + MaxVsAvg*(maxGe − avgGe)`; `ffi = FF*max(ffNetin − FF0, 0)`;
`fbi += (1/FBTau)*(FB*avgAct − fbi)`; `Gi = GiMult*(ffi + fbi)`.
**Key parameters.** `E_e=1, E_l=0.3, E_i=0.25`; `Gbar_L=0.2`; NXX1 `Gain=100`, threshold Thr; FFFB `FF, FB, FF0,
FBTau=1.4, GiMult≈1.8` (emergent/`emer` defaults).
**Primary sources.** O'Reilly & Munakata 2000, "Computational Explorations in Cognitive Neuroscience" (MIT Press);
O'Reilly et al., "Computational Cognitive Neuroscience" (compcogneuro.org / CCNBook 3e), ch. 2, 4; `emer/leabra`.
**Confidence.** [paper-verified] — component list from CCNBook §4.5; Vm/NXX1/FFFB equations and defaults from the
`emer/leabra` implementation (O'Reilly's canonical code). The 2000 book used kWTA proper; FFFB is the later
continuous approximation.

## 6.4 XCAL (eXtended Contrastive Attractor Learning) — the "checkmark" rule
**Mechanism (as stated).** XCAL replaces CHL + separate-Hebbian with a single rule on **time-averaged**
activations across the settling trajectory. It is a piecewise-linear ("checkmark") linearization of the BCM rule:
the coincidence signal (product of pre and post short-term averages) drives weight up above a threshold and down
below, with the down-regime reversing back toward zero at very small values (silent synapses not driven strongly
negative). The threshold **floats** with the postsynaptic long-term average (BCM homeostasis); a second copy uses
the medium-timescale average as threshold to recover error-driven (CHL-like) learning.
**Math / Algorithm.** Checkmark function with dynamic threshold θ_p and fixed reversal fraction θ_d:
`f_xcal(x, θ_p) = (x − θ_p) if x > θ_p·θ_d;  else −x·(1 − θ_d)/θ_d`, with `θ_d = 0.1`. Combined change using
short (x_s,y_s), medium (x_m,y_m), long-term post (y_l) averages:
`Δw = λ_m · f_xcal(x_s·y_s, x_m·y_m) + λ_l · f_xcal(x_s·y_s, y_l)` — first term error-driven (outcome vs
expectation as threshold), second Hebbian/BCM with floating threshold y_l. Implementation:
`XCAL(x,th) = 0 if x<DThr; (x−th) if x>th*DRev; −x*((1−DRev)/DRev) otherwise`.
**Key parameters.** θ_d/DRev = 0.1; DThr ≈ 0.0001; STau=2 (AvgS), MTau=10 (AvgM), long-term AvgL per trial;
mixing weights λ_m, λ_l (AvgLLrn gates the BCM term). Derived from BCM (Bienenstock-Cooper-Munro 1982) and STDP.
**Primary sources.** CCNBook 3e §4.3 "The eXtended Contrastive Attractor Learning (XCAL) Model"; `emer/leabra`;
BCM: Bienenstock, Cooper & Munro 1982.
**Confidence.** [paper-verified] — f_xcal form, θ_d=.1, reversal point, two-term combination extracted verbatim
from CCNBook §4.3; DThr/DRev/STau/MTau from O'Reilly's code. (Naming variant seen in the wild: "eXtended" vs
"temporally eXtended"; the former is the textbook usage.)

## 6.5 Deep Predictive Learning in Neocortex and Pulvinar
**Mechanism (as stated).** Abstract (verbatim): "numerous weak projections into the pulvinar nucleus of the
thalamus generate top-down predictions, and sparse, focal driver inputs from lower areas supply the actual
outcome, originating in layer 5 intrinsic bursting (5IB) neurons. Thus, the outcome is only briefly activated,
roughly every 100 msec (i.e., 10 Hz, alpha), resulting in a temporal difference error signal, which drives local
synaptic changes throughout the neocortex, resulting in a biologically-plausible form of error backpropagation
learning." Deep-layer corticothalamic projections continuously drive the pulvinar with a *prediction*; once per
alpha cycle a phasic 5IB burst clamps it to the *outcome*; the predicted→outcome shift is the local error,
playing GeneRec's minus→plus role without an explicit backpropagated derivative.
**Math / Algorithm.** The error is a temporal difference in pulvinar activation between the prediction state
(early alpha, "minus") and the outcome burst ("plus"), consumed by XCAL (6.4): medium-timescale average captures
the prediction, short-timescale the outcome, so `f_xcal(x_s·y_s, x_m·y_m)` yields the prediction-error weight
change locally. No new weight equation beyond XCAL; the contribution is the anatomical/temporal grounding.
**Key parameters.** Alpha cycle ≈ 100 ms / 10 Hz (minus/plus timing); pulvinar as prediction/outcome comparison
layer; 5IB layer-5 burst as outcome driver; weak/numerous corticothalamic projections as prediction; learning via
XCAL.
**Primary sources.** O'Reilly, Russin, Zolfaghar & Rohrlich 2021, "Deep Predictive Learning in Neocortex and
Pulvinar," J Cogn Neurosci 33(6):1158–1196 (arXiv:2006.14800).
**Confidence.** [paper-verified] — abstract quoted verbatim (5IB driver, pulvinar prediction, 100 ms alpha,
temporal-difference error). [attribution-uncertain] for the fine detail of mapping the alpha-cycle difference onto
XCAL's short/medium windows — the consistent framing across O'Reilly's writing, but the 2021 methods PDF was
compressed/un-extractable, so exact projection weighting and averaging-window assignments were not re-verified
line-by-line.

### Verification note (Creator 6)
GeneRec/CHL equations from the 1996 paper PDF (extracted via pdftotext; glyph OCR lossy, forms pinned by prose).
XCAL f_xcal and combination verbatim from CCNBook §4.3 (LibreTexts mirror). Point-neuron/NXX1/FFFB and coding
defaults from O'Reilly's own `emer/leabra` code. Not fully verified: the exact projection-strength math and
averaging-window assignments in the 2021 pulvinar paper's methods (compressed PDF; abstract/HTML only) — flagged
in 6.5.

---

# Creator 7 — Michael Levin / Developmental Bioelectricity & Basal Cognition

Michael Levin (Vannevar Bush Chair, Tufts; director, Allen Discovery Center at Tufts) studies how non-neural
bioelectric signaling stores and enforces large-scale anatomical patterns, and reframes morphogenesis as
goal-directed problem-solving by cell collectives. Established experimental results are kept strictly separate
from Levin's interpretive framework (TAME, cognitive light cone), which he himself labels a framework/hypothesis.

## 7.1 Bioelectric signaling as an instructive prepattern (Vmem, gap junctions, ectopic eye induction)
**Mechanism (as stated).** Ion channels and pumps (Na/K-ATPase, K-ATP/Kir channels, V-ATPase) set each cell's
resting transmembrane voltage (Vmem). Gap junctions (connexins in vertebrates, innexins in invertebrates)
electrically couple cells into a syncytium, so Vmem forms spatial gradients across cell sheets. Levin's claim is
that these gradients act *instructively* and *upstream* of canonical transcription factors, encoding positional/
organ information. Demonstration: in *Xenopus laevis*, anterior neural-field cells hyperpolarize (~10 mV more
negative) before eye primordia form; forcing that hyperpolarized Vmem in cells far outside the eye field (gut,
tail, mesoderm) via dominant-negative K-ATP (Kir6.1) induces complete, organized ectopic eyes (retina, lens,
RPE). Depolarizing the native eye field disrupts eye formation. Transduction is via voltage-gated Ca²⁺ influx
regulating eye-field transcription factors (Pax6, Rx1), with positive feedback onto the hyperpolarization signal.
**Math / Algorithm.** Conceptual/empirical at the biology level — no closed-form model; established by gain/
loss-of-function electrophysiology, voltage-reporter dye imaging, and pharmacological/genetic channel control with
rescue. (Formal treatment lives in BETSE — see 7.6.)
**Key parameters.** Vmem sign and magnitude within a narrow window is the instructive variable. Quantified:
depolarization disrupted Rx1 in ~50–53% and Pax6 in ~56–57% of embryos; dominant-negative Kir6.1 gave ~20%
ectopic eye tissue and ~7.5% complete ectopic eyes; VGCC blockade (100 µM verapamil) suppressed induction;
co-expressing hyperpolarizing Kv1.5 rescued, confirming voltage per se (not ion identity) drives the effect.
**Primary sources.** Pai, Aw, Shomrat, Lemire & Levin 2012, "Transmembrane voltage potential controls embryonic
eye patterning in *Xenopus laevis*," Development 139(2):313–323 (doi:10.1242/dev.073759; PMID 22159581); Levin
2014, Mol Biol Cell 25(24):3835–3850 (doi:10.1091/mbc.e13-12-0708).
**Confidence.** [paper-verified] — mechanism, channels, transcription factors, Ca²⁺ transduction, and quantitative
yields read directly from the primary paper.

## 7.2 Anatomical homeostasis / target morphology as a setpoint
**Mechanism (as stated).** Levin frames morphogenesis as error-correcting feedback toward a stored target
morphology: cells work from diverse or perturbed starting states toward an invariant anatomical endstate and stop
when it is reached. Empirical anchors: planaria regenerate exactly the missing structures and halt at correct
form; "Picasso" tadpoles with surgically scrambled craniofacial organ positions still produce largely normal frog
faces because organs translocate along abnormal paths and cease movement only upon reaching a correct config.
Interpreted as organ-level homeostasis with "pattern-homeostatic setpoints" defined at macrostate (organ) scale.
**Math / Algorithm.** Conceptual/empirical — no closed-form controller; the "setpoint/error-correction" language
is a cybernetic reinterpretation of regeneration/remodeling data. The control-theoretic framing (comparator,
setpoint, feedback) is Levin's interpretation, not a fitted model.
**Key parameters.** Invariance of endstate across perturbed initial conditions; cessation of remodeling on
reaching target; scale of the regulated variable (organ-level macrostate).
**Primary sources.** Levin 2019, "The computational boundary of a 'self'…," Front Psychol 10:2688
(doi:10.3389/fpsyg.2019.02688); Vandenberg, Adams & Levin 2012 (Dev Dyn 241:863–878, scrambled-face result).
**Confidence.** [paper-verified] for the empirical remodeling results; the "setpoint/error-correcting feedback"
formulation is Levin's interpretive framing — [attribution-uncertain] as mechanism (a model/analogy, stated as such).

## 7.3 Bioelectric pattern memory distinct from the genome
**Mechanism (as stated).** The gap-junction-coupled bioelectric network stores a "pattern memory" — the shape a
regenerating fragment builds toward — separable from genomic sequence and rewritable by transiently perturbing the
electrical network, with no genomic edit. (1) In *Dugesia japonica*, brief gap-junction interruption (octanol)
during regeneration yields a stable fraction of two-headed worms; amputating the *normal-looking* regenerates (in
plain water, no further treatment) reproduces the same two-headed-to-normal ratio — a cryptic state stable through
regeneration with unchanged genome, described as a multistable epigenetic switch in global resting-potential
patterns. (2) In *Girardia dorotocephala*, transient gap-junction blockade stochastically yields head/brain shapes
resembling *other* planarian species in wild-type animals (this one reverts over weeks).
**Math / Algorithm.** Conceptual/empirical — no closed-form model; demonstrated by pharmacological gap-junction
perturbation plus serial amputation to test stability across regeneration rounds. The "multistable attractor /
stored memory distinct from genome" reading is inference from persistence + reversibility without genomic change.
**Key parameters.** Constant stochastic two-head:normal ratio across repeated cuts (the cryptic-phenotype
signature); reversibility of the switch; gap-junction connectivity as the manipulated variable; permanent rewrite
(D. japonica) vs transient (G. dorotocephala).
**Primary sources.** Durant, Morokuma, Fields, Williams, Adams & Levin 2017, "Long-Term, Stochastic Editing of
Regenerative Anatomy via Targeting Endogenous Bioelectric Gradients," Biophys J 112(10):2231–2243 (PMID 28538159);
Emmons-Bell et al. 2015, Int J Mol Sci 16(11):27865–27896 (PMID 26610482); Oviedo et al. 2010 (gap-junction/innexin
control of planarian A/P polarity).
**Confidence.** [paper-verified] for the experimental phenotypes and cross-regeneration stability; the
interpretation as a genome-independent "memory" is empirically supported (wild-type genome, no edit) but the label
"memory" is Levin's framing — storage mechanism partly hypothesized.

## 7.4 Basal cognition, TAME, and the cognitive light cone
**Mechanism (as stated).** Cognition as a *continuum* of homeostatic goal-directedness scaling from metabolic →
transcriptional/physiological → anatomical (morphogenetic) → behavioral problem spaces. The "cognitive light cone"
= the largest spatial and temporal set of goal-states a system can measure, model, and attempt to regulate — a
computational boundary demarcating a "self." Subunits (cells) retain their own competency, reducing the higher
agent's search space. Morphogenesis is presented as collective intelligence of cells navigating "anatomical
morphospace." In TAME the primal driver is minimization of anti-homeostatic stress, with cell networks expanding
their measurement/prediction horizon as they scale up.
**Math / Algorithm.** Conceptual/interpretive — no closed-form model. TAME and the light cone are an explicitly
framework-level, continuous taxonomy plotting agents on temporal-reach × spatial-extent axes; it borrows from
cybernetics, active inference (surprise minimization), and control theory but supplies no fitted quantitative model.
**Key parameters.** Spatial extent and temporal reach (memory + anticipation) of the goal-set; competency/autonomy
of subunits; stress (deviation from homeostatic setpoint) as the driving error; a "persuadability" axis.
**Primary sources.** Levin 2022, "Technological Approach to Mind Everywhere (TAME)…," Front Syst Neurosci 16:768201
(doi:10.3389/fnsys.2022.768201); Levin 2019, Front Psychol 10:2688.
**Confidence.** [attribution-uncertain] as mechanism — Levin's interpretive framework, presented as such. The
bioelectric experiments it rests on are empirical (7.1–7.3); the cognitive/agency interpretation layered on top is
theory/analogy, flagged honestly.

## 7.5 Synthetic living machines (Xenobots, Anthrobots)
**Mechanism (as stated).** Cells liberated from their normal context self-organize into novel motile organisms
whose form/behavior are not specified by the native genome, demonstrating plasticity of cellular goals. Xenobots:
an evolutionary algorithm searches, in a physics simulator, over shapes built from two *Xenopus* cell types —
passive epidermal (structure) and cardiac progenitor (contractile actuation; later ciliated epidermis for
propulsion); transferable in-silico designs are sculpted in vitro; the sub-millimeter constructs locomote, push/
aggregate particles, and show collective behavior despite a wild-type genome and no neurons. Anthrobots: adult
human airway epithelial cells, wild-type genome, no editing, self-construct into motile spheroids that evert so
cilia face outward and drive locomotion; they self-repair after puncture and were reported to bridge a scratch in
a neuronal cell layer in vitro.
**Math / Algorithm.** Xenobots: evolutionary/genetic algorithm over morphologies evaluated in a soft-body physics
simulation, then physically instantiated — the "algorithm" is the in-silico design loop, not a model of the
biology. Anthrobots: no algorithmic design; self-assembly driven by culture-condition change (Matrigel → liquid),
characterized morphologically/behaviorally/transcriptomically.
**Key parameters.** Xenobots: cell-type ratio (skin vs cardiac/ciliated), designed geometry, actuation mode.
Anthrobots: bot size (larger = longer-lived, distinct motility), eversion state, cilia-driven motility; lifespan
~45–60 days; wound-bridging in a neuron monolayer.
**Primary sources.** Kriegman, Blackiston, Levin & Bongard 2020, "A scalable pipeline for designing reconfigurable
organisms," PNAS 117(4):1853–1859 (doi:10.1073/pnas.1910837117); Gumuskaya et al. 2024, "Motile Living Biobots
Self-Construct from Adult Human Somatic Progenitor Seed Cells," Adv Sci 11(4):2303575 (doi:10.1002/advs.202303575;
announced Nov 2023); Gumuskaya et al. 2025 (Anthrobot life cycle, Adv Sci, doi:10.1002/advs.202409330).
**Confidence.** [paper-verified] for cell sources, self-assembly, motility, and the in-silico-evolution pipeline.
Date nuance: the Anthrobots paper carries a 2024 Advanced Science date (announced Nov 2023).

## 7.6 Computational tools / models (BETSE; bioelectric gene-regulatory networks)
**Mechanism (as stated).** BETSE (BioElectric Tissue Simulation Engine) is an open-source finite-volume multiphysics
simulator predicting spatiotemporal Vmem, ion concentrations, currents, and fields across a cell network by
modeling ion channels, pumps, gap junctions, and tight junctions. A companion framework couples the bioelectric
layer to gene-regulatory/biochemical networks so voltage and gene expression influence each other. Levin/Pietak
frame resting Vmem states as *attractor states* of a dynamical system, with cells converging (pattern completion)
to characteristic voltages from divergent initial conditions.
**Math / Algorithm.** Formal. BETSE solves: Nernst-Planck electrodiffusion for each ion across transmembrane,
gap-junctional, and extracellular pathways; voltage via a Maxwell capacitance-matrix approach (net ionic surface
charge with double-layer screening) rather than solving Poisson directly; ion pumps via Michaelis-Menten kinetics
with thermodynamic free-energy terms (Na/K-ATPase); voltage-gated channels via Hodgkin-Huxley-style ODEs; gap
junctions via voltage-sensitive diffusion-scaling gating; plus electroosmotic flow and self-electrophoresis. Ions:
Na⁺, K⁺, Cl⁻, Ca²⁺, H⁺, HCO₃⁻, and charged macromolecules.
**Key parameters.** Per-ion diffusion constants and charge; membrane ion-permeability profile (sets the attractor
Vmem, the dominant determinant); channel gating kinetics; gap-junction coupling strength; pump rates; tight-junction
(trans-epithelial) permeability.
**Primary sources.** Pietak & Levin 2016, "Exploring instructive physiological signaling with the bioelectric
tissue simulation engine," Front Bioeng Biotechnol 4:55 (doi:10.3389/fbioe.2016.00055); Pietak & Levin 2017,
"Bioelectric gene and reaction networks…," J R Soc Interface 14(134):20170425 (doi:10.1098/rsif.2017.0425); code:
github.com/betsee/betse.
**Confidence.** [paper-verified] — equations, numerical method, and attractor framing read from the BETSE paper;
the second citation's volume/DOI is from index metadata (high-confidence).

### Verification note (Creator 7)
Confirmed against primary sources (full text or PMC): Pai et al. 2012 (channels, transcription factors, Ca²⁺
transduction, ~20%/~7.5% ectopic-eye and rescue numbers); Durant et al. 2017 two-headed-planaria including the
cryptic-phenotype claim (serial amputation reproduces the ratio without genomic change); TAME 2022 and Computational
Boundary 2019 definitions; Kriegman et al. 2020 Xenobots pipeline; the Anthrobots life-cycle paper; BETSE's numerical
framework. Two primary URLs 403'd (ScienceDirect S0006349517304277, PNAS 1910837117) and were verified via PMC5443973/
PMID 28538159 and the authors' mirror + PNAS DOI metadata. Distinctions honored: two-headed planaria, cross-species
heads, and ectopic eyes = established empirical results; TAME, cognitive light cone, "setpoint/error-correcting"
morphogenesis, and "scale-free cognition" = Levin's interpretive framework, marked as such.

---

# Creator 8 — Cybernetic & Control-Theoretic Foundations of Regulation (Cannon / Wiener / Ashby / Powers / Sterling)

The substrate-independent claim that any persisting system regulates by feeding its own deviations back against
themselves has five load-bearing formulations. Cannon named the biological fact; Wiener made feedback a general
theory of purpose; Ashby proved its limits (requisite variety) and its structural corollary (the good regulator
must model its system) and built the parameter-changing second loop (ultrastability); Powers relocated the
controlled quantity from output to perception; Sterling replaced the fixed setpoint with a predicted one.

## 8.1 Walter B. Cannon — Homeostasis
**Mechanism (as stated).** Cannon named the "coordinated physiological processes which maintain most of the steady
states in the organism" homeostasis, explicitly denoting constancy not fixity: "The word does not imply something
set and immobile, a stagnation. It means a condition — a condition which may vary, but which is relatively
constant." The animal is an *open* system in continuous exchange yet holds critical variables (temperature, pH,
glucose, water, salt, O₂) within narrow bounds. Corrective principle (from Fredericq): "each disturbing influence
induces by itself the calling forth of compensatory activity to neutralize or repair the disturbance" — deviation
itself triggers opposing action (negative feedback, though Cannon did not use the engineering term). He suggested
generalization to "other kinds of organization — even social and industrial" (the substrate-independence seed).
**Math / Algorithm.** Purely conceptual/verbal; no equations. Qualitative propositions: constancy in an open system
is evidence of agencies maintaining it; a tendency to change is automatically met by increasing effectiveness of
resisting factors; regulating agencies commonly act antagonistically; a factor shifting a state one way implies an
opposite factor. No setpoint equation; "setpoint" is a later gloss.
**Key parameters.** The regulated ("essential") variables and their tolerable range; antagonistic corrective
effectors; disturbing influences.
**Primary sources.** Cannon 1929 ("Organization for Physiological Homeostasis," Physiol Rev 9:399–431); Cannon 1932
(*The Wisdom of the Body*).
**Confidence.** [paper-verified] — definition, "relatively constant" qualification, open-system and Fredericq
statements read verbatim from the 1932 text.

## 8.2 Norbert Wiener (with Rosenblueth & Bigelow) — Cybernetics / Feedback Teleology
**Mechanism (as stated).** The 1943 founding move reduces *purpose* to negative feedback: feedback (restricted
sense) means "the behavior of an object is controlled by the margin of error at which the object stands at a given
time with reference to a relatively specific goal." Thesis: "All purposeful behavior may be considered to require
negative feed-back." Identity: "Teleological behavior thus becomes synonymous with behavior controlled by negative
feed-back." Substrate-neutral by design — "a uniform behavioristic analysis is applicable to both machines and
living organisms." Wiener's 1948 *Cybernetics* generalized this to "control and communication in the animal and the
machine," adding information flow and feedback stability (undamped feedback → oscillation).
**Math / Algorithm.** The 1943 paper is conceptual (a taxonomy: active/passive; purposeful/random; feedback vs not;
predictive orders). Formal content is the qualitative feedback law: action driven by error = present state − goal
state, sign negative. Servo/differential-equation stability math lives in the 1948 book, not the 1943 paper.
**Key parameters.** Goal/reference state; error margin; feedback sign (negative = corrective, positive =
destabilizing); loop gain and damping.
**Primary sources.** Rosenblueth, Wiener & Bigelow 1943 ("Behavior, Purpose and Teleology," Philos Sci 10(1):18–24);
Wiener 1948 (*Cybernetics*).
**Confidence.** [paper-verified] — all quoted phrases verbatim from the 1943 paper; 1948 attributions summarized,
not quoted.

## 8.3 W. Ross Ashby — Ultrastability & the Homeostat
**Mechanism (as stated).** Beyond the primary feedback loop (system R acting on environment) Ashby posits a
*second-order* loop. "Essential variables" must stay within viability limits; when one crosses its bound, a
*step-mechanism* changes the *parameters* of the primary loop (in the homeostat, a switch to new, randomly selected
values), and the system re-selects parameters until essential variables return inside limits. A system with this
capacity is **ultrastable**: able to reorganize itself to become stable against disturbances its current
organization cannot handle. Adaptation = second-loop parameter change driven by essential-variable violation. The
**Homeostat** (four cross-coupled units with uniselectors re-randomizing coefficients on limit-crossing) was the
physical demonstration.
**Math / Algorithm.** Two nested loops. Primary: fast, continuous R–environment feedback at fixed parameters.
Secondary: a *step-function* — discontinuous, triggered only on limit-crossing — resetting the primary loop's
parameters (a discrete random jump from a finite pool). Search is trial-and-error over parameter space with
acceptance test = "all essential variables back in bounds." The selection rule is conceptual (random re-selection
until viable), not an optimization equation.
**Key parameters.** Essential variables and viability bounds; the pool/space of adjustable parameters; the trigger
threshold (limit-crossing); time-scale separation (primary fast, parameter loop slow/discontinuous).
**Primary sources.** Ashby 1952/1960 (*Design for a Brain*); Ashby 1948 ("Design for a Brain," Electronic
Engineering) for the homeostat.
**Confidence.** [attribution-uncertain] for exact wording — the concepts are correctly attributed and standard but
verified from authoritative secondary summaries rather than the book's page text; no claim rests on a verbatim quote.

## 8.4 W. Ross Ashby — Law of Requisite Variety
**Mechanism (as stated).** A regulator can suppress the variety (range of distinct states) disturbances impose on
an essential outcome only by deploying at least a matching variety of counteracting responses. Slogan: **"only
variety can destroy variety."** Restated: "R's capacity as a regulator cannot exceed R's capacity as a channel of
communication" — regulation is fundamentally information transmission. Insufficient regulator variety leaves
irreducible residual disturbance in the outcome.
**Math / Algorithm.** A two-move game: disturbance D chooses a value, regulator R chooses a response, a table maps
(D,R) → outcome E; question is how small the variety of E can be. Standard entropy (bits) restatement:
`H(E) ≥ H(D) − H(R)` (equivalently minimum outcome variety `V_O ≥ V_D − V_R` in log terms), so outcome variety
cannot go below disturbance minus regulator variety; holding H(E) at a target requires raising H(R) point-for-point
with H(D). Ashby tied this to Shannon's Theorem 10 (channel capacity bounds correctable disturbance rate).
**Key parameters.** Disturbance variety H(D)/V_D; regulator variety H(R)/V_R; residual outcome variety H(E)/V_O;
regulator channel capacity.
**Primary sources.** Ashby 1956 (*An Introduction to Cybernetics*, ch. 11 "Requisite Variety").
**Confidence.** [paper-verified] for the slogan and channel-capacity statement (Ashby's wording).
[attribution-uncertain] for the exact typographic form of the inequality — `H(E) ≥ H(D) − H(R)` is the standard
logarithmic restatement of his variety argument, faithful to his result, but his chapter presents it mainly as a
variety/table argument plus the Shannon Theorem-10 link rather than that boxed formula.

## 8.5 Conant & Ashby — The Good Regulator Theorem
**Mechanism (as stated).** "Every good regulator of a system must be a model of that system." The paper proves any
regulator that is simultaneously *maximally successful* and *maximally simple* must be isomorphic with (a model of)
the regulated system — "Making a model is thus necessary." Model-making becomes a logical requirement of optimal
regulation, with the corollary that a brain, insofar as it is an efficient survival regulator, "must proceed, in
learning, by the formation of a model (or models) of its environment." They distinguish error-controlled regulation
(regulator informed via system S, information-conserving, so H(Z) cannot reach zero — "residual variation") from
cause-controlled regulation (regulator draws directly from disturbance D, in principle perfectible).
**Math / Algorithm.** Frame: disturbances D, regulator events R, system events S, outcomes Z, with maps φ:D→S,
ρ:D→R, ψ:S×R→Z. "Successful regulation" is *defined* as "H(Z) is minimal," `H(Z) = −Σ p(z_k) log p(z_k)`. Regulator
= conditional p(R|S); p(S) given. **Theorem (verbatim):** "The simplest optimal regulator R of a reguland S produces
events R which are related to the events S by a mapping h : S → R." Formally (eq. 8): `∃h : ∀i : ρ(i) = h[σ(i)]`.
Proof core (lemma): for each s_j all r_i with positive probability must map (via ψ) to the *same* outcome z_k —
else one could shift probability between outcomes to make p(Z) more unequal, lowering H(Z) and contradicting
optimality — so the simplest optimal p(R|S) collapses to a deterministic mapping h:S→R.
**Key parameters.** Outcome entropy H(Z) (objective, minimized); fixed p(S); regulator policy p(R|S); mapping h:S→R;
interaction map ψ. Assumption: p(S) exists and is (locally) constant — if it drifts, h must become time-varying.
**Primary sources.** Conant & Ashby 1970 ("Every Good Regulator of a System Must Be a Model of That System," Int J
Syst Sci 1(2):89–97).
**Confidence.** [paper-verified] — theorem statement, eq. (8), the H(Z)-minimal definition, the entropy-imbalance
lemma, and the error- vs cause-controlled distinction read verbatim from the full text. Documented debate: the
"model" the theorem delivers is a state→action mapping/homomorphic image (closer to a policy than a predictive
world-model).

## 8.6 William T. Powers — Perceptual Control Theory (PCT)
**Mechanism (as stated).** The controlled quantity is not output but *perception*: "Behaviour is the control of
perception." "The organism does not respond to stimulation; it controls its own input." A control unit compares a
*perceptual signal* p against an internally supplied *reference signal* r; the difference drives output/action that
alters the environment, which changes the perceptual input, closing a negative-feedback loop holding p near r
despite disturbances. Because the loop defends p, the organism's *actions* look variable while the *perception*
stays constant (the observer correlating stimulus to response misreads the system). Control is **hierarchical**:
higher-level units set the *reference signals* for the level below, so a high-level goal cascades reference values
downward to lower loops each controlling their own perception.
**Math / Algorithm.** Comparator: error `e = r − p`. Output `o = g(e)` (typically integrating/high-gain). Environment
feeds back so `p = f(o, disturbance)`; the loop drives `e → 0`, i.e. `p → r`. The **behavioral illusion**: in a
high-gain control loop the observed disturbance→output relation is essentially the *inverse of the environmental
feedback function* and nearly *independent of the organism's own output function* — so a stimulus-response law read
from it describes the environment, not the organism. Each level: reference from above → comparator → error → output
= reference to the level below.
**Key parameters.** Reference r (setpoint from above); perceptual signal p; error e = r − p; output/loop gain; the
environmental feedback function; disturbance; per-level perceptual input functions.
**Primary sources.** Powers 1973 (*Behavior: The Control of Perception*, Aldine); Powers, Clark & McFarland 1960
("A general feedback theory of human behavior," Percept Mot Skills).
**Confidence.** [paper-verified] for the core claims (Powers' own concepts, correctly stated).
[attribution-uncertain] for exact wording — loop components and `e = r − p` confirmed from authoritative PCT/IAPCT
sources rather than the 1973 book's pages; `e = r − p` is the universal standard formalization of his comparator.

## 8.7 Sterling & Eyer — Allostasis (Predictive Regulation)
**Mechanism (as stated).** Allostasis = "stability through change." Against defending a *fixed* setpoint by reacting
to error after it occurs, the body *anticipates* demand and adjusts internal parameters — including effective
setpoints — in advance: "To maintain stability an organism must vary all the parameters of its internal milieu and
match them appropriately to environmental demands." Regulation is brain-centered and feed-forward: the brain
predicts what will be needed and pre-adjusts, so setpoints are variable targets set by anticipated demand. Sterling
2012 states the efficiency argument: predictive regulation minimizes the frequency and size of errors, and is
therefore more efficient than reactive homeostasis, which "waits for errors to occur and then corrects them by
negative feedback." Illustration: at peak exercise muscle O₂ demand rises ~18-fold while cardiac output rises only
~3.5-fold, so the brain predictively reroutes blood from gut/kidney to muscle rather than reacting to a shortfall.
**Math / Algorithm.** Conceptual/framework-level; no governing equation. Formal contrast: reactive homeostasis =
negative feedback around a fixed setpoint r (correct after error `e = measured − r` appears); allostasis =
feed-forward/predictive control in which the setpoint itself is a function of predicted demand (`r = r(prediction)`),
acting *before* error accrues.
**Key parameters.** Predicted demand (anticipatory signal); the adjustable setpoints/parameters of the internal
milieu (all of them); prior/learned expectations; error rate and magnitude (minimized). Efficiency is the stated
selection criterion.
**Primary sources.** Sterling & Eyer 1988 ("Allostasis: A New Paradigm to Explain Arousal Pathology," in *Handbook
of Life Stress, Cognition and Health*, Wiley); Sterling 2012 ("Allostasis: A Model of Predictive Regulation,"
Physiol Behav 106(1):5–15).
**Confidence.** [paper-verified] for the concepts and key claims (correctly attributed to Sterling & Eyer 1988 /
Sterling 2012). [attribution-uncertain] for exact wording — verified via authoritative reviews and the Sterling 2012
abstract/summary rather than the full 1988 chapter.

### Verification note (Creator 8)
Read in full, verbatim this session: Conant & Ashby 1970 (the entire Good Regulator paper — frame, maps φ/ρ/ψ,
"H(Z) is minimal" definition, the exact theorem, eq. (8), the entropy-imbalance lemma and proof, error- vs
cause-controlled distinction) and Rosenblueth-Wiener-Bigelow 1943 (every quoted phrase). Cannon 1932 verified via a
reproduction of his own text. Confirmed by concept but NOT from the book's own pages (authoritative secondary
sources): Ashby *Design for a Brain* (ultrastability); the exact typographic form of the Requisite Variety
inequality; Powers' `e = r − p`; Sterling & Eyer 1988. Open caveats: (1) Ashby's exact form for the requisite-variety
inequality — the shown `H(E) ≥ H(D) − H(R)` is a faithful standard restatement, not a direct quote; (2) whether the
Good Regulator "model" warrants its title's strong reading (a documented debate; as proved it is a state→action
mapping); (3) exact 1988 Sterling & Eyer page wording.

---

# Creator 9 — Neuroscience of Stress: Allostatic Load, Prediction & Biological Tracking

How stress is operationalized in neuroscience splits into two projects: **tracking** the cumulative biological
burden of stress (McEwen/Seeman's allostatic load and its biomarker index), and modeling the brain as a
**predictive/allostatic regulator** that anticipates demand (Sterling, Barrett). This section holds the
mechanism-level accounts of both, plus the HPA-axis systems view (Chrousos), the glucocorticoid-cascade damage
model (Sapolsky), the psychological triggers that make stress trackable (Lupien), and multivariate neuroimaging
prediction (Wager).

## 9.1 Bruce McEwen — Allostasis & Allostatic Load / Overload
**Mechanism (as stated).** Allostasis is "stability through change": the body maintains viability by *actively*
varying internal parameters through mediators (glucocorticoids, catecholamines) rather than defending fixed
set-points. These mediators are protective acutely but exact a cost over time. **Allostatic load** is the cumulative
"wear and tear" from chronic or inefficiently managed activation of stress-mediating systems; **allostatic
overload** is the pathological state when load exceeds coping capacity and disease emerges. **Four conditions that
raise allostatic load:** (1) *repeated hits* from multiple novel stressors; (2) *lack of adaptation/habituation* to
a repeated stressor; (3) *failure to shut off* the response after the stressor ends; (4) *inadequate response* by
one mediator, causing *compensatory overactivity* of others (e.g. insufficient cortisol → unopposed inflammatory
cytokines). Mediators follow a **non-linear inverted-U / hormetic dose-response** (beneficial in an intermediate
range, damaging when over- or under-produced). A **primary → secondary → tertiary cascade**: primary mediators
(cortisol, catecholamines, DHEA, cytokines) → secondary outcomes (BP, waist-hip ratio, lipids, HbA1c) → tertiary
outcomes (frank disease, cognitive/physical decline).
**Math / Algorithm.** Conceptual/framework — no closed-form equation; the quantitative operationalization is the
Allostatic Load Index (9.2). Dose-response stated qualitatively as an inverted-U.
**Key parameters.** Primary mediators: glucocorticoids (cortisol), catecholamines (epi/norepinephrine), DHEA(-S),
pro-inflammatory cytokines. The four load-generating conditions. Time (acute-protective vs chronic-damaging).
**Primary sources.** McEwen 1998, "Protective and Damaging Effects of Stress Mediators," N Engl J Med 338:171–179
(PMID 9428819); McEwen 2000, "Allostasis and Allostatic Load…," Neuropsychopharmacology 22:108–124 (PMID 10649824);
McEwen & Wingfield 2003, Horm Behav 43:2–15.
**Confidence.** [paper-verified] — definitions, four conditions, inverted-U, mediator list confirmed against the
2000 Neuropsychopharmacology paper + corroboration; the primary/secondary/tertiary cascade is McEwen & Seeman's
framing (9.2 sources), taken from the corpus rather than a verbatim fetch of the 1998 NEJM piece.

## 9.2 McEwen & Seeman — The Allostatic Load Index (MacArthur Studies)
**Mechanism (as stated).** An operational battery that *tracks* cumulative multi-system biological wear and tear by
combining neuroendocrine, cardiovascular, and metabolic biomarkers into a single summary score — the canonical
stress-tracking instrument. Higher baseline scores predicted 7-year all-cause mortality and cognitive/physical
decline in the MacArthur cohort of older adults.
**Math / Algorithm.** **Count-based scoring:** for each of ~10 parameters, an individual scores **1 point if in the
highest-risk quartile** of the sample distribution, else 0; points sum to a **0–10 allostatic load score**.
Highest-risk quartile = the *top* quartile for most parameters, but the **lowest** quartile for HDL cholesterol and
DHEA-S (where low = risk). Empirical, not a mechanistic model.
**Key parameters.** The canonical MacArthur 10 biomarkers: (1) systolic BP; (2) diastolic BP; (3) waist-to-hip
ratio; (4) HDL cholesterol (low = risk); (5) total/HDL cholesterol ratio; (6) HbA1c; (7) 12-h urinary cortisol;
(8) 12-h urinary norepinephrine; (9) 12-h urinary epinephrine; (10) serum DHEA-S (low = risk).
**Primary sources.** Seeman, McEwen, Rowe & Singer 2001, "Allostatic load as a marker of cumulative biological
risk: MacArthur studies of successful aging," PNAS 98(8):4770–4775 (PMID 11287659); Seeman et al. 1997, Arch Intern
Med 157:2259–2268 (original operationalization).
**Confidence.** [paper-verified] — the 10-parameter list and "count of biomarkers in the highest-risk quartile"
scoring confirmed by multiple corroborations; direct PNAS full-text fetch 403'd, so the HDL/DHEA-S quartile-direction
nuance is stated from established AL methodology rather than a verbatim line.

## 9.3 George Chrousos — The Stress System / HPA Axis
**Mechanism (as stated).** A formal systems view: the central **stress system** has two interacting arms — the
**CRH** system and the **locus coeruleus–norepinephrine (LC/NE) / autonomic** system — with peripheral effectors
the pituitary-adrenal axis and the autonomic nervous system. Endocrine cascade: hypothalamic PVN **CRH → pituitary
ACTH → adrenal cortisol**, under **negative feedback** (cortisol suppresses CRH and ACTH). CRH and LC/NE mutually
reinforce and coordinate behavioral + peripheral adaptation. Stress-system disorders (hyper- or hypo-activation)
map to specific pathologies.
**Math / Algorithm.** Conceptual systems model (feedback-loop description) — no formal equations in the canonical
statement.
**Key parameters.** CRH, arginine-vasopressin (co-secretagogue), LC/NE, ACTH, cortisol; negative-feedback gain; the
CRH↔LC/NE positive coupling.
**Primary sources.** Chrousos & Gold 1992, "The concepts of stress and stress system disorders," JAMA
267(9):1244–1252 (PMID 1538563); Chrousos 2009, Nat Rev Endocrinol 5:374–381.
**Confidence.** [paper-verified] — two-arm (CRH + LC/NE) architecture and CRH→ACTH→cortisol feedback cascade
confirmed via corroboration of the 1992 JAMA paper; full text not fetched directly, so exact wording is inferred
from multiple secondary confirmations.

## 9.4 Robert Sapolsky — Glucocorticoid Physiology & the Glucocorticoid Cascade Hypothesis
**Mechanism (as stated).** Acute glucocorticoid (GC) secretion is adaptive (mobilizes energy, supports survival);
chronic/prolonged GC exposure is damaging, especially to the **hippocampus**, which normally exerts *inhibitory*
negative feedback on the HPA axis. The **glucocorticoid cascade hypothesis** (aging-rat work): cumulative GC exposure
causes hippocampal degeneration (dendritic atrophy, synapse loss, impaired neurogenesis); the damaged hippocampus
can no longer restrain the HPA axis, so cortisol is less effectively shut off, raising GC further — a **feed-forward
vicious cycle** (GC excess → hippocampal damage / GR downregulation → weaker feedback → more GC). Explains why the
*same* mediator is protective acutely and harmful chronically: a matter of duration/cumulative dose.
**Math / Algorithm.** Conceptual/empirical — rat neuroendocrine experiments + a positive-feedback causal loop; no
formal equation. Later human neuroimaging (hippocampal volume) extended it.
**Key parameters.** Glucocorticoids (corticosterone/cortisol); hippocampal GC receptors (GR/MR); negative-feedback
efficacy; cumulative lifetime GC exposure; post-stress recovery (termination) rate.
**Primary sources.** Sapolsky, Krey & McEwen 1986, "The Neuroendocrinology of Stress and Aging: The Glucocorticoid
Cascade Hypothesis," Endocrine Reviews 7(3):284–301 (PMID 3527687); Sapolsky 2000, Arch Gen Psychiatry 57:925–935
(PMID 11015810).
**Confidence.** [paper-verified] — the 1986 citation and the feed-forward hippocampal-damage mechanism confirmed via
search; the acute-adaptive vs chronic-damaging framing is Sapolsky's consistent position.

## 9.5 Sonia Lupien — Stress Measurement & the NUTS Recipe
**Mechanism (as stated).** A situation triggers a physiological stress response (and cortisol release) to the extent
it contains one or more of four psychological ingredients — **N.U.T.S.**: **N**ovelty, **U**npredictability, **T**hreat
to the ego/self, and low **S**ense of control. The more present, the stronger the response. The theoretical point:
the stress response is driven not by physical severity per se but by these *interpretive* features — **unpredictability
is a core driver**. Cortisol is the biomarker and can be tracked across the lifespan (Lupien's developmental work
links cortisol exposure to hippocampal/cognitive outcomes from prenatal life to aging).
**Math / Algorithm.** Conceptual/psychometric — a qualitative checklist (identify which of the 4 NUTS components are
present); cortisol as the quantitative physiological readout. No formula.
**Key parameters.** Novelty, Unpredictability, Threat-to-ego, low Sense-of-control; salivary/urinary cortisol;
developmental timing of exposure.
**Primary sources.** Lupien, McEwen, Gunnar & Heim 2009, "Effects of stress throughout the lifespan on the brain,
behaviour and cognition," Nat Rev Neurosci 10:434–445 (PMID 19401723); Lupien 2012, *Well Stressed* (Wiley, NUTS
popularization); CESH "Recipe for Stress."
**Confidence.** [paper-verified] for the NUTS components and cortisol-as-biomarker (via CESH + multiple sources); the
NUTS acronym is Lupien's teaching framework (book + CESH), so [attribution-uncertain] as to a single peer-reviewed
titling paper — the underlying "characteristics that make a stressor" trace to Mason and Lupien's cortisol work.

## 9.6 Sterling & Barrett — The Predictive (Allostatic) Brain & Interoception
**Mechanism (as stated).** Allostasis as **predictive regulation**: the brain regulates the body by *anticipating*
needs and mobilizing resources *before* they are required, not reacting after deviations (Sterling). Barrett casts
the brain's core job as **"body budgeting"** (allostasis) — predicting energy needs (glucose, oxygen, salt, water)
and issuing deposits/withdrawals ahead of demand. **Interoception** is the brain's top-down *model* of internal
bodily state, checked against ascending visceral signals; the mismatch is **interoceptive prediction error**. In the
**EPIC (Embodied Predictive Interoception Coding)** model, agranular visceromotor cortices (anterior cingulate,
anterior insula) issue interoceptive/allostatic predictions and minimize error via active inference. Under this frame,
**stress = the brain predicting a large upcoming energy expenditure**, and chronic **anxiety/depression = persistently
high interoceptive prediction error or a depleted body budget**. Kleckner et al. 2017 gave neuroanatomical evidence
for a large-scale allostatic–interoceptive system overlapping default-mode and salience networks.
**Math / Algorithm.** Computational — **predictive coding / active inference**: minimize precision-weighted
interoceptive prediction error / variational free energy (the Friston framework applied to interoception; Barrett/
Kleckner supply the anatomy, not a new equation). Empirically instantiated via tract-tracing + resting-state fMRI
connectivity.
**Key parameters.** Prediction vs prediction error; precision (confidence weighting); body-budget deposits (sleep,
nutrition, rest, social support) vs withdrawals (exertion, cognition, stress, illness); visceromotor hubs (ACC,
anterior insula); default-mode + salience networks.
**Primary sources.** Sterling 2012, "Allostasis: a model of predictive regulation," Physiol Behav 106:5–15
(PMID 21684297); Barrett & Simmons 2015, "Interoceptive predictions in the brain," Nat Rev Neurosci 16:419–429
(PMID 26016744); Kleckner et al. 2017, "Evidence for a large-scale brain system supporting allostasis and
interoception in humans," Nat Hum Behav 1:0069 (PMC5624222); Barrett, Quigley & Hamilton 2016, "An active inference
theory of allostasis and interoception in depression," Phil Trans R Soc B (PMID 28080969).
**Confidence.** [paper-verified] — Sterling's predictive-regulation definition, Barrett's body-budget/EPIC framing,
Kleckner 2017 anatomy, and the depression active-inference paper confirmed via search. The "stress = predicted large
expenditure / anxiety = high prediction error" statements are Barrett's *interpretive* framing (predictive
processing is a model, not settled mechanism) — labeled as such.

## 9.7 Tor Wager — Multivariate Neuroimaging Signatures (Computational Prediction)
**Mechanism (as stated).** Rather than localizing stress/pain to one region, machine learning is trained on
whole-brain fMRI to produce a **multivariate "signature"** — a weighted pattern across many regions — that predicts
an experience quantitatively at the individual level. The **Neurologic Pain Signature (NPS)** predicts noxious-heat
pain intensity within-person; the approach extends to affective/stress-related states. Represents the *computational*
prediction method: decode a subjective state from a distributed brain pattern.
**Math / Algorithm.** Formal — supervised machine learning (LASSO-PCR / penalized regression) on voxel-wise fMRI
yields a linear brain pattern; prediction = dot-product of signature weights with a new image. Reported effect sizes:
within-person single-trial pain prediction d ≈ 1.45 (very large); between-person d ≈ 0.49 (medium).
**Key parameters.** fMRI activity in thalamus, posterior/anterior insula, secondary somatosensory cortex, anterior
cingulate, periaqueductal gray (NPS regions); regression weights; cross-validated prediction-outcome correlation.
**Primary sources.** Wager, Atlas, Lindquist, Roy, Woo & Kross 2013, "An fMRI-Based Neurologic Signature of Physical
Pain," N Engl J Med 368:1388–1397 (PMID 23574118).
**Confidence.** [paper-verified] for the NPS (2013 NEJM — regions, method, effect sizes). The extension to *stress
specifically* is [attribution-uncertain]: the verified biomarker is for physical *pain*; stress/negative-affect
signatures exist in the Wager corpus (e.g. PINES, Chang et al. 2015) but were not fetched this pass, so NPS is the
sourced exemplar and the stress generalization is flagged unverified.

### Verification note (Creator 9)
Confirmed via multiple independent corroborations of primary sources: McEwen's allostasis/load/overload definitions,
the four load-generating conditions, and the inverted-U (Neuropsychopharmacology 2000; NEJM 1998); the **Allostatic
Load Index 10-biomarker battery** and **0–10 count-in-highest-risk-quartile** scoring (Seeman et al., PNAS 2001) — the
priority deliverable; Chrousos & Gold two-arm stress system + HPA cascade (JAMA 1992); Sapolsky-Krey-McEwen
glucocorticoid cascade (Endocrine Reviews 1986); Lupien NUTS + cortisol (Nat Rev Neurosci 2009; CESH); Sterling
predictive regulation (2012), Barrett body-budget/EPIC + Kleckner 2017 + depression active-inference (PMID 28080969);
Wager NPS (NEJM 2013). Could not fully confirm: direct PNAS 2001 full-text fetch 403'd (biomarker list/scoring from
strong corroboration + established AL methodology; HDL/DHEA-S lowest-quartile direction is standard in the literature);
the NUTS acronym is Lupien's teaching framework, not a single titling paper; Barrett's "stress = predicted expenditure"
is interpretive framing; Wager's signature is verified for physical *pain*, not stress specifically.

---

# Creator 10 — Marten Scheffer / Critical Transitions & Early-Warning Signals

Scheffer (Wageningen) and collaborators argue that a broad class of complex systems has fold (saddle-node)
bifurcations where a smooth change in conditions triggers an abrupt shift between alternative stable states, and
that the approach to such a tipping point produces *generic*, substrate-independent statistical early-warning
signals rooted in critical slowing down. Points that are conceptual/theoretical rather than established empirical
results are marked, and the actively-debated reliability of the indicators is noted factually.

## 10.1 Alternative stable states & catastrophic (fold) bifurcations, with hysteresis
**Mechanism (as stated).** A system can have two alternative stable equilibria separated by an unstable equilibrium
(a repeller). Under a slowly changing control parameter, the stable branch can lose stability at a **fold
(saddle-node / catastrophic) bifurcation**: stable and unstable equilibria collide and annihilate, and the system
tips to the contrasting state. Because a catastrophic fold has a folded equilibrium curve, the reverse shift requires
driving the parameter well back past the forward threshold to a second fold — **hysteresis** (not easily reversed).
Ball-in-a-landscape framing: each valley is a basin of attraction, the hilltop between them the unstable
equilibrium; as conditions change one valley flattens and shrinks until the ball rolls to the other. (Not all shifts
are catastrophic; only fold-type/hysteretic ones give the full picture.)
**Math / Algorithm.** Conceptual/analytic — a 1-D system `dx/dt = f(x; μ)` with a fold at (x*, μ*) where f = 0 and
∂f/∂x = 0; the equilibrium curve is S-shaped over control parameter μ, giving two stable branches, an unstable middle
branch, and two fold points bounding the bistable region. Potential form: `dx/dt = −dV/dx`, V a double-well whose
barrier vanishes at the fold.
**Key parameters.** Slowly varying control/forcing parameter μ; basin depth/width; positions of the two fold
thresholds (width of the hysteresis loop).
**Primary sources.** Scheffer, Carpenter, Foley, Folke & Walker 2001, "Catastrophic shifts in ecosystems," Nature
413:591–596 (doi:10.1038/35098000, PMID 11595939); Scheffer et al. 2009, Nature 461:53–59 (doi:10.1038/nature08227,
PMID 19727193).
**Confidence.** [paper-verified] — abstract/metadata confirmed via PubMed; fold/hysteresis framing is the standard
core of these papers.

## 10.2 Critical Slowing Down (CSD) — the generic mechanism behind the signals
**Mechanism (as stated).** As a system approaches a fold bifurcation, the rate at which it recovers from small
perturbations decreases and, at the bifurcation, goes to zero — because the dominant eigenvalue of the linearized
system approaches zero. This critical slowing down is the theoretical reason the statistical indicators (10.3–10.5)
rise near a transition; it is the mechanistic engine, not itself directly observed in most field data.
**Math / Algorithm.** Linearized about a stable equilibrium, recovery decays exponentially with rate set by the
dominant eigenvalue λ (λ < 0 for a stable node): return time ≈ −1/λ. At a fold, λ → 0⁻, so return time → ∞ (return
rate → 0). For the stochastic linearization `dx = λx dt + σ dW` (Ornstein–Uhlenbeck): lag-Δt autocorrelation
= exp(λΔt) → 1 as λ → 0, and stationary variance = σ²/(2|λ|) → ∞ as λ → 0. Return rate is estimated empirically from
a fitted AR(1) model.
**Key parameters.** Dominant eigenvalue λ (return rate); noise intensity σ; sampling interval Δt.
**Primary sources.** Scheffer et al. 2009, Nature 461:53–59 (doi:10.1038/nature08227); Dakos, Scheffer, van Nes et
al. 2008, "Slowing down as an early warning signal for abrupt climate change," PNAS 105(38):14308–14312
(doi:10.1073/pnas.0802430105, PMID 18787119).
**Confidence.** [paper-verified] — CSD-eigenvalue mechanism and the OU variance/autocorrelation results are stated in
these papers and standard in the field.

## 10.3 Generic temporal early-warning indicators: rising AR(1), variance, and changing skewness
**Mechanism (as stated).** Critical slowing down increases the system's short-term "memory," so successive states
become more similar (rising lag-1 autocorrelation). Slow return lets stochastic perturbations accumulate and the
state drift more widely (rising variance/SD). Near a fold the potential well becomes asymmetric and disturbances push
the state toward one slow boundary, so the distribution can become skewed (changing skewness). These are the primary
temporal EWS.
**Math / Algorithm.** From Dakos et al. 2012 (verified):
- Lag-1 autocorrelation `ρ₁ = Σ(z_t − μ)(z_{t+1} − μ) / Σ(z_t − μ)²`. Equivalently fit AR(1) `z_{t+1} = α₁ z_t + ε_t`;
  ρ₁ and α₁ are equivalent; α₁ → 1 signals approach to the bifurcation. Return rate ≈ `1 − α₁`.
- Standard deviation `σ = √[Σ(z_t − μ)²/n]`; coefficient of variation `CV = σ/μ`.
- Skewness `[Σ(z_t − μ)³/n] / σ³` (standardized third moment).
Computed in a sliding (rolling, overlapping) window (e.g. half the series), after **detrending** (Gaussian smoothing
or linear); the strength of the upward trend is quantified by **Kendall's τ** rank correlation of the indicator vs
time.
**Key parameters.** Rolling-window length; detrending bandwidth/method; sampling resolution; Kendall-τ significance
(often vs surrogate/bootstrap null).
**Primary sources.** Scheffer et al. 2009, Nature 461:53–59 (doi:10.1038/nature08227); Dakos, Carpenter, Brock,
Ellison, Guttal, Ives, Kéfi, Livina, Seekell, van Nes & Scheffer 2012, "Methods for detecting early warnings of
critical transitions in time series…," PLoS ONE 7(7):e41010 (doi:10.1371/journal.pone.0041010, PMID 22815897).
**Confidence.** [paper-verified] — ρ₁, σ, skewness formulas and the rolling-window + Kendall-τ workflow quoted
directly from the Dakos 2012 methods paper; the indicator list matches Scheffer 2009.

## 10.4 Flickering (in strongly stochastic / bistable systems)
**Mechanism (as stated).** When noise is large relative to basin depth, a system approaching a transition may not
slide smoothly but is repeatedly knocked back and forth across the (still-present) unstable boundary before the
deterministic threshold is reached. This "flickering" appears as jumps between regimes and produces a bimodal
(two-peaked) state distribution and elevated variance — a distinct early signal in high-noise systems, complementary
to smooth critical slowing down.
**Math / Algorithm.** Conceptual/statistical — detected as bimodality in the state's frequency distribution and
increased variance; no single closed-form indicator; noise-driven barrier crossing of a double-well potential
(Kramers-type escape).
**Key parameters.** Noise amplitude relative to basin depth; barrier height between attractors.
**Primary sources.** Scheffer et al. 2009, Nature 461:53–59 (doi:10.1038/nature08227); Scheffer, Carpenter, Lenton,
Bascompte, Brock, Dakos et al. 2012, "Anticipating critical transitions," Science 338(6105):344–348
(doi:10.1126/science.1225244, PMID 23087241).
**Confidence.** [paper-verified] — flickering and its bimodal/variance signature are described in both papers; the
barrier-crossing detail is standard interpretation, marked conceptual.

## 10.5 Spatial early-warning signals (spatially extended systems)
**Mechanism (as stated).** In spatially extended systems, slowing down and loss of resilience manifest across space:
units become more coupled/coherent, so **spatial correlation increases**, **spatial variance increases**, and
**spatial skewness changes** near a transition. Self-organized pattern features (e.g. changes in patch-size
distribution) can serve as system-specific signals. These are mathematical analogs of the temporal indicators.
**Math / Algorithm.** Spatial variance = variance of the state across the grid; spatial correlation typically a
two-point/nearest-neighbor correlation (Moran's-I–type) rising toward its maximum; spatial skewness = standardized
third spatial moment. (Dakos et al. 2012 defers full spatial formulas to a separate paper; it lists the indicator
set only.)
**Key parameters.** Grid resolution/extent; neighborhood/lag for spatial correlation; connectivity of spatial units.
**Primary sources.** Scheffer et al. 2012, Science 338:344–348 (doi:10.1126/science.1225244); Scheffer et al. 2009,
Nature 461:53–59 (doi:10.1038/nature08227); indicator list also in Dakos et al. 2012 (doi:10.1371/journal.pone.0041010).
**Confidence.** [paper-verified] for the indicator set (spatial variance, correlation, skewness);
[attribution-uncertain] for exact spatial formulas — Dakos 2012 defers them to a separate publication.

## 10.6 Resilience defined dynamically (basin size / distance to tipping)
**Mechanism (as stated).** Resilience is defined not as return speed alone but as the size of the basin of
attraction — how large a perturbation the system can absorb before crossing into an alternative state, i.e. the
distance from the current state to the basin boundary (the unstable equilibrium). As conditions push toward a fold,
the basin shrinks and recovery slows, so the rising EWS of 10.3–10.5 operate as an *indirect estimate of loss of
resilience* even though the basin boundary is not directly observable.
**Math / Algorithm.** Conceptual — resilience ≈ width/depth of the basin (distance in state space to the nearest
unstable manifold); operationally proxied by return rate (−1/λ) and the CSD indicators, all degrading monotonically
as the basin collapses at the fold.
**Key parameters.** Basin width/depth; distance to the unstable equilibrium; return rate as proxy.
**Primary sources.** Scheffer et al. 2001, Nature 413:591–596 (doi:10.1038/35098000); Scheffer et al. 2009, Nature
461:53–59 (doi:10.1038/nature08227).
**Confidence.** [paper-verified] — the basin-of-attraction definition of resilience and its link to EWS are stated in
these papers (rooted in Holling's resilience concept, which Scheffer cites).

## 10.7 Cross-domain generality, and the depression application (substrate-independence claim)
**Mechanism (as stated).** Because CSD follows generically from the fold-bifurcation structure, the *same* indicators
are claimed to apply regardless of substrate — ecosystems (lake eutrophication, desertification, coral-reef shifts),
climate (abrupt paleoclimate transitions), and financial markets/systemic instability are the recurring examples.
Extending this, van de Leemput et al. 2014 (with Scheffer) applied CSD to human mood: using experience-sampling time
series of momentary emotions, they report that in individuals more likely to undergo a future transition, mood
dynamics are slower and different emotions more correlated — elevated **temporal autocorrelation, variance, and
cross-correlation between emotions** precede shifts both *into* and *out of* depression. Supports the hypothesis that
mood has alternative stable states separated by tipping points sustained by reinforcing symptom feedbacks. The
substrate-independence claim is explicit.
**Math / Algorithm.** Same indicator family as 10.3 applied to multivariate emotion time series: per-emotion lag-1
autocorrelation and variance, plus **between-emotion correlation** (the multivariate CSD signature — variables become
more collectively coupled near a transition). No new estimator; the novelty is the domain and the
correlation-between-components indicator.
**Key parameters.** Sampling cadence of momentary emotion reports; window length; set of emotions used for the
cross-correlation.
**Primary sources.** van de Leemput, Wichers, Cramer, Borsboom, …, Scheffer 2014, "Critical slowing down as early
warning for the onset and termination of depression," PNAS 111(1):87–92 (doi:10.1073/pnas.1312114110, PMID 24324144);
generality also in Scheffer et al. 2009 (doi:10.1038/nature08227) and 2012 (doi:10.1126/science.1225244).
**Confidence.** [paper-verified] — abstract/significance statement confirm the three indicators (autocorrelation,
variance, between-emotion correlation) and the alternative-stable-states-of-mood hypothesis. The paper frames it as
*support for a hypothesis*, not settled clinical fact.

## 10.8 Caveats and the active reliability debate (stated factually)
**Mechanism (as stated).** The authors stress the indicators are not infallible. Not every critical transition is
preceded by detectable slowing down (noise-induced or non-fold-type transitions); indicators can give **false
positives** (rising variance/autocorrelation from non-critical causes) and **false negatives**; results are sensitive
to window length, detrending, data length, and noise; no single indicator is optimal across scenarios, so multiple
indicators plus surrogate/null testing are recommended. This is actively contested: independent work argues detection
limits are severe in realistic data, and the depression application drew a published critique.
**Math / Algorithm.** N/A (methodological caveats). Safeguards from Dakos 2012: combine indicators, sensitivity
analysis over window/bandwidth, significance via Kendall-τ against bootstrapped/surrogate nulls.
**Key parameters.** Data length; window/bandwidth; noise level; choice of null model.
**Primary sources.** Dakos et al. 2012, PLoS ONE 7(7):e41010 (doi:10.1371/journal.pone.0041010) — own limitations;
Bos & de Jonge 2014, "'Critical slowing down in depression' is a great idea that still needs empirical proof," PNAS
(doi:10.1073/pnas.1323672111), with reply by van de Leemput et al. (doi:10.1073/pnas.1323835111); Boettiger &
Hastings 2012, "Quantifying limits to detection of early warning for critical transitions," J R Soc Interface
9:2527–2539 (doi:10.1098/rsif.2012.0125).
**Confidence.** [paper-verified] for Dakos 2012 caveats and the Bos/de Jonge critique + reply; [attribution-uncertain]
for the Boettiger & Hastings citation details (paper/thesis well established, exact volume/pages not opened this pass).

### Verification note (Creator 10)
Confirmed via PubMed metadata/abstracts, with the formal indicator equations quoted from the Dakos 2012 full article:
Scheffer 2009 (Nature 461, PMID 19727193), Scheffer 2012 (Science 338, PMID 23087241; the fetched PDF was unparseable
so 2012-specific quotes rest on the verified abstract + corroboration), van de Leemput 2014 (PNAS 111, PMID 24324144;
full author list, abstract, significance statement, three indicators verified), Dakos 2012 (PLoS ONE, PMID 22815897;
ρ₁/σ/skewness/AR(1)/return-rate/rolling-window/Gaussian-detrend/Kendall-τ quoted), Scheffer 2001 (Nature 413,
PMID 11595939), Dakos 2008 (PNAS 105, PMID 18787119). Could not fully verify: exact wording inside the 2001 and 2012
papers (worked from abstracts + corroborating papers); precise spatial-EWS equations (deferred by Dakos 2012 to a
separate paper); exact bibliographic fields of Boettiger & Hastings 2012. Nature and PNAS HTML bodies were behind
auth/anti-bot walls, so those rest on PubMed metadata rather than full text.

---

# Creator 11 — Reinforcement Learning & Reward Prediction Error (Rescorla-Wagner / Sutton-Barto / Schultz)

Prediction-error learning runs as one continuous idea across three literatures: the psychology of classical
conditioning (Rescorla-Wagner), the computational theory of learning from reward (Sutton & Barto's temporal-difference
methods), and the neurophysiology of midbrain dopamine (Schultz). The load-bearing object throughout is a single
scalar — the discrepancy between predicted and received value — appearing as `λ − ΣV` in Rescorla-Wagner, as the TD
error `δ` in reinforcement learning, and as phasic dopamine firing in the brain.

## 11.1 Rescorla-Wagner model (error-driven associative learning)
**Mechanism (as stated).** Classical conditioning is driven not by mere CS-US contiguity but by the discrepancy
between the US received and the US already predicted by all cues present on that trial. Learning occurs only when the
animal is "surprised" — when the summed prediction is wrong. Multiple cues compete for a shared, limited pool of
associative strength, which is how the model captures blocking (a cue already predicting the US prevents a redundant
new cue from being learned) and overshadowing.
**Math / Algorithm.** For cue A on a trial: `ΔV_A = α_A · β · (λ − ΣV)`.
- `V_A` = associative strength of cue A; `ΔV_A` = its change on the trial.
- `ΣV` = summed associative strength of *all* CSs present (the aggregate prediction).
- `λ` = asymptote the US can support (target; λ>0 reinforced, λ=0 non-reinforced trials).
- `(λ − ΣV)` = prediction error / surprise; learning stops when `ΣV = λ`. Update `V_A ← V_A + ΔV_A`. Direct
  psychological ancestor of the TD error: an outcome-minus-expectation term scaling the weight update.
**Key parameters.** `α_A` = CS salience/associability (0–1); `β` = US-specific learning rate (often differs for
reinforced vs non-reinforced trials); `λ` = US-supported asymptote.
**Primary sources.** Rescorla & Wagner 1972, "A theory of Pavlovian conditioning…," in *Classical Conditioning II*
(Appleton-Century-Crofts), 64–99.
**Confidence.** [paper-verified] — equation `ΔV = αβ(λ − ΣV)` cross-confirmed against multiple independent summaries;
the model is trial-level (not real-time), the key limitation TD later removes.

## 11.2 The RL problem, returns, and value functions (Sutton & Barto)
**Mechanism (as stated).** An agent interacts with an environment over discrete steps, formalized as a Markov
Decision Process. Each step: observe state `S_t`, take action `A_t` under policy π, receive reward `R_{t+1}` and next
state `S_{t+1}`. The objective is to maximize expected cumulative *discounted* reward, not immediate reward. Value
functions summarize "how good" a state (or state-action pair) is under a policy, as expected return.
**Math / Algorithm.**
- Return `G_t = R_{t+1} + γR_{t+2} + γ²R_{t+3} + … = Σ_{k=0}^∞ γ^k R_{t+k+1}`.
- State value `V^π(s) = E_π[G_t | S_t = s]`; action value `Q^π(s,a) = E_π[G_t | S_t = s, A_t = a]`.
- Bellman (expectation): `V^π(s) = Σ_a π(a|s) Σ_{s',r} p(s',r|s,a)[ r + γV^π(s') ] = E_π[ R_{t+1} + γV^π(S_{t+1}) | S_t = s]`.
  Value is recursive in successor-state values — the self-consistency bootstrapping exploits.
**Key parameters.** `γ` = discount ∈ [0,1] (0 myopic, →1 far-sighted; γ<1 keeps `G_t` finite); `π(a|s)` = policy;
`p(s',r|s,a)` = environment dynamics.
**Primary sources.** Sutton & Barto, *Reinforcement Learning: An Introduction*, MIT Press (1998; 2nd ed. 2018),
Chs. 3–4.
**Confidence.** [paper-verified] — canonical MDP/Bellman formulation, standard across the textbook; equations are the
field-standard forms.

## 11.3 Temporal-Difference (TD) learning and the TD error δ
**Mechanism (as stated).** TD methods learn value estimates directly from experience without a model and without
waiting for the final return. They *bootstrap*: update a value estimate toward another, later estimate ("learning a
guess from a guess"). After each transition the agent forms a target `R_{t+1} + γV(S_{t+1})` and nudges `V(S_t)`
toward it; the nudge size is the TD error.
**Math / Algorithm.**
- **TD(0) update:** `V(S_t) ← V(S_t) + α[ R_{t+1} + γV(S_{t+1}) − V(S_t) ]`.
- **TD error (central object):** `δ_t = R_{t+1} + γV(S_{t+1}) − V(S_t)`. δ>0 = better than expected; δ<0 = worse;
  δ=0 = fully predicted. A *temporal* prediction error.
- **TD(λ) with eligibility traces:** `e_t(s) = γλ e_{t-1}(s) + 𝟙[S_t=s]`, update all states `V(s) ← V(s) + α δ_t e_t(s)`;
  λ interpolates TD(0) (λ=0) to Monte Carlo (λ=1).
- **SARSA (on-policy):** `Q(S_t,A_t) ← Q(S_t,A_t) + α[ R_{t+1} + γQ(S_{t+1},A_{t+1}) − Q(S_t,A_t) ]`.
- **Q-learning (off-policy):** `Q(S_t,A_t) ← Q(S_t,A_t) + α[ R_{t+1} + γ max_{a'} Q(S_{t+1},a') − Q(S_t,A_t) ]` —
  learns optimal `Q*` while acting exploratorily.
- **Actor-critic:** a *critic* learns V and emits δ_t; an *actor* updates policy preferences in the direction δ_t
  indicates (`p(S_t,A_t) ← p(S_t,A_t) + α δ_t`). The same δ trains value and policy.
**Key parameters.** `α` = step size; `γ` = discount; `λ` = trace decay; exploration parameter (e.g. ε).
**Primary sources.** Sutton 1988, "Learning to predict by the methods of temporal differences," Machine Learning
3:9–44; Watkins 1989 (thesis) & Watkins & Dayan 1992, "Q-learning," Machine Learning 8:279–292; Sutton & Barto
(1998/2018), Chs. 6–7, 12–13.
**Confidence.** [paper-verified] — TD(0), TD error, SARSA, Q-learning, actor-critic are the textbook-canonical forms;
Q-learning's off-policy `max` vs SARSA's on-policy `A_{t+1}` is exactly as in Sutton & Barto and Watkins & Dayan 1992.

## 11.4 The dopamine reward-prediction-error hypothesis (Schultz)
**Mechanism (as stated).** Recordings from midbrain dopamine neurons (SNc, VTA) in behaving monkeys show three
signatures that jointly identify a reward *prediction error* rather than a reward signal per se: (1) **unexpected
reward → phasic burst**; (2) **transfer to the earliest predictor** — as a stimulus reliably predicts reward, the
phasic response shifts backward in time from the reward to the earliest reward-predicting cue, and the reward itself
no longer drives a burst once fully predicted; (3) **omission → dip below baseline** — a fully predicted reward then
omitted depresses firing below baseline exactly at the expected reward time. Rising to positive error, no change to a
fully predicted reward, below-baseline dip to negative error is a *bidirectional* error code matching the sign
structure of the TD error δ. Schultz, Dayan & Montague 1997 made the correspondence explicit; the backward transfer is
exactly the TD phenomenon of value propagating to the earliest reliable predictor.
**Math / Algorithm.** Proposed identity `dopamine phasic response ∝ δ_t = R_{t+1} + γV(S_{t+1}) − V(S_t)`. The three
findings map onto δ: (1) unpredicted reward, `V(S_t)≈0`, R>0 → δ>0 (burst); (2) after learning, reward fully predicted
→ δ≈0 at reward while the cue transition carries positive δ; (3) predicted reward omitted → R=0 but prediction
positive → δ<0 (dip).
**Key parameters.** Same `γ` and value estimates V as TD; empirically, dopamine phasic responses are brief (~tens of
ms latency, ~100–200 ms) and the depression aligns to the *expected* reward time, implying an internal timing
representation.
**Primary sources.** Schultz, Dayan & Montague 1997, "A Neural Substrate of Prediction and Reward," Science
275(5306):1593–1599; Schultz 1998, "Predictive reward signal of dopamine neurons," J Neurophysiol 80(1):1–27.
**Confidence.** [paper-verified] — bibliographic details and the three-finding structure confirmed via primary-source
abstracts; Schultz 1998's abstract states dopamine neurons "code reward value as it differs from prediction… a
bidirectional prediction error teaching signal." [attribution-uncertain] only for the exact δ notation *inside* SDM97
(PDF returned binary / paywalled); the reward-prediction-error identity itself is unambiguous and universally
attributed to these two papers.

## 11.5 Successor Representation (Dayan 1993) and actor-critic anatomy
**Mechanism (as stated).** *Successor Representation (SR):* represent a state by *which future states it tends to lead
to* under the current policy — a predictive representation. Dayan showed good generalization for TD value learning
depends on states having similar *successors*, and that the SR can be learned by TD; it factorizes value into a
learned predictive map times a reward vector, between model-free and model-based RL. *Actor-critic anatomy:* the
actor-critic decomposition has been mapped onto the basal ganglia — dorsal striatum as actor (action selection),
ventral/striatal circuits as critic (value), with midbrain dopamine broadcasting δ to both as the shared teaching
signal.
**Math / Algorithm.** SR matrix `M(s,s') = E[ Σ_{t=0}^∞ γ^t 𝟙[S_t=s'] | S_0=s ]` (expected discounted future occupancy
of s' from s). Value factorizes `V(s) = Σ_{s'} M(s,s') R(s')` (predictive map × reward); M is learnable by a TD rule
structurally identical to value TD.
**Key parameters.** `γ` (controls the predictive horizon of M); reward vector `R(s')`.
**Primary sources.** Dayan 1993, "Improving generalization for temporal difference learning: the successor
representation," Neural Computation 5(4):613–624; actor-critic/basal-ganglia mapping: Barto 1995; Montague, Dayan &
Sejnowski 1996 (J Neurosci); Joel, Niv & Ruppin 2002 (Neural Networks).
**Confidence.** [paper-verified] for the SR (Dayan 1993 details and the "similar successors" thesis; V = M·R is
standard). [attribution-uncertain] for the exact actor/critic-to-striatum assignment — the correspondence is real
(Barto 1995; Montague et al. 1996) but the precise dorsal=actor/ventral=critic partition is a modeling hypothesis with
competing variants, not settled fact. (See 1.3 for the SR as a cognitive-map mechanism; this is the same object from
the RL side.)

### Verification note (Creator 11)
Confirmed: Rescorla-Wagner `ΔV = αβ(λ − ΣV)` and its cue-competition/blocking interpretation (cross-checked across
Scholarpedia, Wikipedia, Princeton course material); Schultz, Dayan & Montague 1997 (Science 275:1593–1599) and
Schultz 1998 (J Neurophysiol 80:1–27) bibliographic details and the three dopamine findings + bidirectional-error
interpretation; Dayan 1993 (Neural Computation 5(4):613–624) SR thesis; TD(0)/δ/TD(λ)/SARSA/Q-learning/Bellman/return/
actor-critic as the canonical Sutton & Barto forms (Sutton 1988; Watkins & Dayan 1992; Sutton & Barto 1998/2018).
Could not directly confirm: the exact δ notation inside the SDM97 PDF (binary/paywalled) and Schultz 1998 full text
(403) — content verified via abstracts + corroborating summaries; the dorsal/ventral actor-critic anatomical partition
is a modeling hypothesis, marked [attribution-uncertain].


# Creator 12 — Economics: Financial Stress Measurement, Aggregation, Network Propagation & Uncertainty

How economists formally define, construct, aggregate and validate a *stress* measure over a population of
firms or markets. This section exists because the same object (a scalar severity read over a network of
units) is measured in economics with a fifty-year methodological record, several production instruments run
by central banks, and published post-mortems on the ones that failed. The entries split into four projects:
**defining** stress as a continuous variable (12.1-12.2), **aggregating** many indicators into one number
(12.3-12.6), **propagating** shocks from individual units to the aggregate (12.7-12.10), and **measuring
uncertainty from text and volatility**, including the critiques that bound it (12.11-12.16).

Sourcing note: unlike Creators 1-11, these sources are journal articles, so verification was by local text
extraction (`pdftotext -layout` / `pypdf`) from primary PDFs rather than by video-topic confirmation. During
research two fetch-tool PDF *summaries* returned fabricated content (one claimed Illing & Liu used principal
component analysis and LIBOR-OIS spreads, both false and the second anachronistic). Nothing below rests on a
tool summary. Sub-details behind paywalls or 403s are flagged inline.

## 12.1 Hakkio & Keeton — What Financial Stress Is (the definitional entry)
**Mechanism (as stated).** "In most general terms, financial stress can be thought of as an interruption to
the normal functioning of financial markets." The authors then decline to sharpen it further, and say why:
"Agreeing on a more specific definition is not easy, because no two episodes of financial stress are exactly
the same. Still, economists tend to associate certain key phenomena with financial stress. The relative
importance of these phenomena may differ from one episode of financial stress to another. However, every
episode seems to involve at least one of the phenomena, and often all of them." The five phenomena, as the
paper's own section headings: (1) **increased uncertainty about fundamental value of assets**; (2)
**increased uncertainty about behavior of other investors**; (3) **increased asymmetry of information**;
(4) **decreased willingness to hold risky assets** (flight to quality); (5) **decreased willingness to hold
illiquid assets** (flight to liquidity). The logical structure is **disjunctive, not conjunctive** — "at
least one," not all five. This is a family-resemblance definition, not a set of necessary conditions. Two
stated causal orderings: (1)→(2), uncertainty about other investors "tends to arise" when investors are
already uncertain about fundamentals; and (3)→(5), reduced asset liquidity is "often associated with greater
asymmetry of information between buyers."
**Math / Algorithm.** Conceptual. The operationalization is the KCFSI (12.3).
**Key parameters.** The five phenomena; their disjunctive combination; the two stated causal links.
**Primary sources.** Hakkio, Craig S., and William R. Keeton 2009, "Financial Stress: What Is It, How Can It
Be Measured, and Why Does It Matter?" FRB Kansas City *Economic Review* 94(2):5-50. No DOI. RePEc
`fip:fedker:y:2009:i:qi:p:5-50:n:v.94no.2`.
**Confidence.** [paper-verified] — definition, five section headings, disjunctive framing and both causal
orderings read from local extraction of the source PDF.

## 12.2 Illing & Liu — Stress as a Continuous Variable, and the Aggregation Horse Race
**Mechanism (as stated).** The canonical paper treating financial stress as continuous rather than binary.
Abstract, verbatim: "Stress is defined as the force exerted on economic agents by uncertainty and changing
expectations of loss in financial markets and institutions. It is a continuous variable with a spectrum of
values, where extreme values are called financial crises." The operational definition has **three distinct
arguments**: "Stress increases with expected financial loss, with risk (a widening in the distribution of
probable loss), or with uncertainty (lower confidence about the shape of the distribution of probable loss)"
— first moment, second moment, and a Knightian term about the distributional form itself. Two scope limits
the authors state explicitly: stress "is the product of a vulnerable structure and some exogenous shock," so
the index measures *realized stress*, not fragility; and "By definition, the FSI captures the
contemporaneous level of stress and is not expected to have strong predictive power for future stresses or
crises." The index is **ordinal, not cardinal**: "The value of the index is likely to change when the sample
period is altered, but the ordinal ranking of two events should remain the same." Their stated reason binary
crisis dummies fail for developed economies: early-warning models "have not been successfully applied to
highly developed countries, owing to the rarity of crises in large mature markets."
**Math / Algorithm.** Five weighting families × three variable sets = 15 candidate indexes, each scored
against an external label. *Variance-equal*: z_jt = (x_jt − x̄_j)/σ_j, then arithmetic (1/J)Σ_j z_jt or
geometric (Π_j z_jt)^(1/J) chained monthly (the geometric variant requires positive values, so "half of the
observations must be ignored"). *Credit weights*: w_jt = C_m(j),t / Σ_m C_m,t, chain-linked, total credit =
bank credit + corporate bonds + government bonds + equities + USD credit; "For markets with more than one
stress proxy, the corresponding weight is split evenly." *Sample CDF*: u_jt = F̂_j(x_jt) = (1/T)Σ_s 1{x_js ≤
x_jt}, mapped to percentiles 1-99; stated rationale: "The transformed variables are unit-free and implicitly
reflect all the moments of their distributions, provided they are time stationary, regardless of whether the
distribution is normal" — the stationarity proviso is theirs and is load-bearing. *Factor analysis*: first
principal component. Probit/logit implicit weights were considered and rejected (fn. 31) because both sides
of the regression would be the same concept measured two ways.
Evaluation: with X the stress measure, τ the threshold, C the survey label,
Type I = Pr(X < τ | C = 1) ("failure rate"); Type II = Pr(X > τ | C = 0) ("false positive rate"),
τ = median + 1σ per Eichengreen-Rose-Wyplosz, evaluated monthly.
**The external label, which is the methodologically important part.** Not news-scraped. Stage 1: "The list of
events was drawn from a review of every Bank of Canada Annual Report since 1977 and every Monetary Policy
Report since 1995. Events were included if they were explicitly identified as having had a significant impact
on Canadian markets" → 40 ranked events. Stage 2: 40 questionnaires to "a former governor, three governing
council members, eight senior bank officers, twelve bank officers, and three analysts," ranking 1-3.
Labelled sample: **55 of 276 months stressful**, base rate 19.9%.
**Results (Table 5, Type I / Type II, percent).** Standard variables: variance-equal arithmetic 15/41;
variance-equal geometric 22/43; **credit weights 13/33 (winner)**; sample CDF 22/42; factor analysis 45/41.
Refined variables: 22/38, 25/38, 27/36, 44/48, 42/42. GARCH variables: 27/40, 32/41, 33/41, 25/38, 44/42.
Benchmarks: Bank Credit Analyst FSI 35/46; Bordo-Dueker-Wheelock 64/15. Four robust findings: **factor
analysis is worst in all three variable sets** (45/42/44) and correlates only 57% with the others;
**"refined" model-adjusted variables are worse than raw ones** (the Elfner fair-value adjustment to the
corporate spread alone "increases the Type I error by 20 percentage points"); **binary crisis dummies from
the early-warning literature are catastrophic** (Demirgüç-Kunt & Detragiache 100/0, Kaminsky-Reinhart 88/0 —
near-zero false positives achieved by essentially never firing); and **method choice barely matters among the
top three** (cross-correlations during stress: variance-equal-arithmetic vs credit 99%, vs sample CDF 94%).
Threshold sensitivity: raising τ to +2σ "increases Type I errors by 8.6 percentage points on average, and
reduces Type II errors by 6 percentage points on average… The choice of τ does not significantly alter the
ordinal ranking of the measures."
**Selection rationale, in the authors' stated order.** Interpretability, economically meaningful weights,
lowest errors — error performance is listed *last*: "Since it performs well and is simple to interpret and
communicate, we suggest that it be used as the FSI for Canada."
**The shipped index differs from the paper's recommendation.** Six months later the same authors published an
operational hybrid in the Bank of Canada *Financial System Review* (Dec 2003), composing the two axes:
FSI_t = Σ_j w_jt [∫_{−∞}^{x_j} f(x_jt) dx_jt] × 100 — "The daily value of each variable is first weighted by
its sample cumulative distribution function… Next, each variable is weighted by the relative size of the
market to which it pertains." Transformation and weighting are **orthogonal axes, composed**, which the flat
five-item list in the working paper obscures. Realized weights, 11 Sept 2003, nine variables: 12.7 / 9.7 /
11.3 / 12.7 / 9.1 / 10.5 / 11.3 / 11.3 / 11.3 percent. The authors' own caveat: "The weighting of the
components by their shares in credit involves a certain arbitrariness. Thus, one cannot claim that this index
has the optimal weights for measuring stress. It should be noted, however, that the weights are approximately
equal across the components." Credit weighting won the horse race and lands within **1.6 points of equal
weighting** (nine variables at equal weight = 11.1%).
**Primary sources.** Illing, Mark, and Ying Liu 2006, "Measuring financial stress in a developed country: An
application to Canada," *Journal of Financial Stability* 2(3):243-265, DOI 10.1016/j.jfs.2006.06.002. Working
paper: Bank of Canada WP 2003-14 (June 2003), DOI 10.34989/swp-2003-14, titled "An Index of Financial Stress
for Canada." Operational index: Bank of Canada *Financial System Review*, December 2003.
**Confidence.** [paper-verified] for all methodology, the Table 5 grid (independently extracted twice), the
survey design and the FSR hybrid — all from WP 2003-14 read in full plus two Bank of Canada restatements.
[unverified]: whether the published 2006 article carries **9 or 11** variables — Bank of Canada documents
enumerate nine, the ECB CISS paper says eleven, and ScienceDirect returned 403. Does not affect any
structural claim.

## 12.3 The Production Fed Indexes — KCFSI, STLFSI, CFSI, NFCI
**Mechanism (as stated).** Four central-bank instruments that answer the same question with materially
different machinery. Compared here because the divergences are informative and two of the four have publicly
documented failures.

**KCFSI (Kansas City).** 11 monthly variables → first principal component, explaining **61.4%** of total
variation (Feb 1990 - Mar 2009). Variables and PC1 coefficients: TED spread 0.099; 2-yr swap spread 0.116;
off-the-run/on-the-run 10-yr Treasury spread 0.107; Aaa/10-yr Treasury 0.107; Baa/Aaa 0.125; high-yield/Baa
0.124; consumer ABS/5-yr Treasury 0.130; negative stock-Treasury return correlation 0.081; VIX 0.129; bank
idiosyncratic volatility 0.130; cross-section dispersion of bank stock returns 0.116. Two structural notes:
all five Hakkio-Keeton phenomena are covered but **not evenly** — flight-to-liquidity and flight-to-quality
carry four variables each, while "uncertainty about fundamental value" and "uncertainty about other
investors" are never separately identified and are always jointly assigned to the same two volatility
measures; and the **coefficients are nearly flat** (0.081-0.130, a 1.6× range on a standardized scale), so
PCA weighting here is close to equal weighting.
Math, fn. 19 verbatim: choose {FSI_t} and {a_k} to minimize SSE = Σ_{k,t}(X_kt − a_k FSI_t)² subject to
Σ_t FSI_t²/(T−1) = 1. "As shown in Theil, the values of a_1…a_11 solving this problem are the elements of the
first eigenvector of the sample correlation matrix of the 11 variables. Also, FSI_t = (a_1/√λ)X_1t + … +
(a_11/√λ)X_11t for all t, where λ is the first eigenvalue for the sample correlation matrix." Correlation
matrix, not covariance (a consequence of pre-standardizing).
**Rolling-window instability, stated by the authors:** because sample mean and SD are re-estimated as the
window extends, adding low-stress months mechanically shrinks all standardized values and forces rescaling of
every coefficient. The paper notes a sample change made some months "no longer considered high-stress." The
KCFSI is **ordinal within a vintage and not comparable across vintages**.
2018 revision (Cook & Doh, KC Fed *Macro Bulletin*, Oct 24 2018): TED spread replaced by (DTCC GCF Treasury
repo − 3-mo T-bill), with repo history backfilled in two stages — regress DTCC on the NY Fed survey rate,
RR = a + b·RR^S + e, splice at 2005, then back out 1990-1998 from the statistical relationship to the other
KCFSI inputs. **Live KCFSI since Nov 2018 contains two layers of imputed data in one of its 11 inputs.**

**STLFSI (St. Louis).** 18 weekly series (7 interest rates, 6 yield spreads, 5 other) → first principal
component. The 7/6/5 partition is invariant across all four vintages; membership is not. Seven-step
construction: 18 series from Dec 31 1993; de-mean; divide by sample SD; PCA; scale coefficients so index
SD = 1; multiply; sum. z_i,t = (x_i,t − x̄_i)/σ_i, STLFSI_t = Σ_{i=1}^{18} ℓ̃_1i z_i,t with sd 1, mean 0.
"The average value of the index, which begins in late 1993, is designed to be zero. Thus, zero is viewed as
representing normal financial market conditions." Normalization window is the **entire history**, so the
sample contains 2008 and 2020 and "zero" silently re-centers with every new observation. **Units are standard
deviations, not basis points** (a common secondary-source error). Version lineage: v1→v2 (Mar 2020) switched
from levels to **daily changes** in interest rates and stock prices, "The primary reason is that interest
rates have trended lower and stock prices have trended higher, on average" — a detrending fix, because levels
of trending series contaminate PC1 with a secular factor. v2→v3 (Jan 2022) LIBOR retirement, two of six
spreads affected, correlation with v2 = 0.99. v3→v4 (Nov 2022) backward- to forward-looking SOFR,
correlation v3-v4 = 0.993 to Jan 2022, diverging after Feb 2022 as the FOMC tightened.

**CFSI (Cleveland) — uses credit weights, not PCA, and was withdrawn.** Four schemes were tested — "equal
weights; equal variance weights; credit weights; and principal component weights" — and credit weights
selected: "the CFSI calibration using credit weights to be optimal under competing weighting methods… In
addition to statistical optimality, the CFSI calibration using dynamic credit weights is conceptually
appealing since it lends economic significance to the different FSI components." Their stated objection to
PCA is a direct critique of the STLFSI design: "weighting based on a single component creates a fixed set of
weights for all dates in the analysis, **forcing market relationships to hold in the data when reality shows
they may not**." Transformation is empirical CDF at component level, z-score at index level:
FSI_t = 100 · Σ_j w_j,t CDF_j(x_j,t), CDFs over 4,237 daily observations (26 Sep 1991 - 31 Mar 2009), three
series rank-inverted (weighted dollar crashes, stock market crashes, Treasury yield-curve spread — "Flat or
inverted yield curves signal slow growth"). Credit weights w_i,q = Flow_i,q / Σ_k Flow_k,q from Fed Z.1 Flow
of Funds, recomputed **quarterly**. Grades are empirically chosen z-cutoffs maximizing ROC / Somers' D, not a
priori percentiles; WP 12-37 (Sept 2011), probit Z = −1.344444 + 0.370646·CFSI: expansion Z ≤ −0.70 (5.4%
systemic-stress probability), normal −0.70 to 0.57 (12.8%), moderate 0.57-1.84 (25.4%), significant Z ≥ 1.84
(38.0%). WP 11-30 used grade 4 at **2.38**, not 1.84 — thresholds are not stable across vintages. Component
count grew from **11 components / 4 markets** (WP 11-30) to **16 / 6** (WP 12-37, adding real estate and
securitization).
**Discontinued 2016.** Standing advisory banner on every Cleveland Fed CFSI PDF: "This article is based in
whole or in part on the CFSI… an indicator that was discontinued by the Federal Reserve Bank of Cleveland in
2016 due to the discovery of errors in the indicator's construction. **These errors overestimated stress in
the real estate and securitization markets.**" Last observation 2016-05-05. The errors were precisely in the
five variables added in the six-market expansion — the thinnest-data markets. The original 11-component
four-market core did not contain them.

**NFCI (Chicago).** **105 financial indicators currently**, but **100** in both Brave & Butters papers ("Our
100 financial indicators consist of 47 weekly, 29 monthly, and 24 quarterly variables"), so any equation or
weight taken from 2011/2012 describes a 100-indicator panel. Categories: "Risk indicators capture volatility
and funding risk in the financial sector, while credit indicators are composed of measures of credit
conditions, and leverage indicators consist of debt and equity measures." Subsystem breakdown exists only for
the 2011 vintage: money markets 28, debt and equity markets 27, banking system 45; variance decomposition
banking 41% / money markets 30% / debt-equity 29%.
Model: X_t = ΓF_t + ε_t, F_t = AF_{t−1} + ν_t, "where F_t represents a 1 × T latent factor capturing a
time-variation in the N × T matrix of standardized financial indicators X_t, Γ is their N × 1 vector of
loadings onto this factor, A is the transition matrix describing the evolution of the factor's AR(p) dynamics
with **p = 15 weeks** (corresponding to roughly one quarter)." Identification "is achieved only up to scale."
Estimator is **Doz-Giannone-Reichlin quasi-maximum-likelihood, not Stock-Watson**: "it requires one pass
through the Kalman filter and smoother, and then reestimation of the system matrices—Z, T, H, and Q—using
ordinary least squares at each iteration," convergence at 10⁻⁶ relative log-likelihood change, "generally
within 150 iterations"; Stock-Watson PCA-EM supplies starting values only. Mixed frequency via Harvey (1989)
accumulators as implemented by Aruoba-Diebold-Scotti: three accumulators for monthly averages, monthly sums
and quarterly sums; sum accumulator S_{t+1} = s_t S_t + f_{t+1}, s_t = 0 at the last base-frequency period
within the lower frequency, else 1. Ragged edges via Durbin-Koopman selection matrices: Z* = W_t Z,
H* = W_t H W_t′. Normalized to mean 0, sd 1 over a sample extending back to **1971** (subindexes use **1973**
— the 2017 revision extended NFCI/ANFCI history without re-basing the subindexes).
**Adjusted NFCI changed in 2017.** Old (2011-2017): two-step, each indicator regressed on current and lagged
CFNAI-MA3 and 3-month PCE inflation with BIC-selected lags, standardized residuals then fed to the factor
model. Current: simultaneous, X_t = ΓF_t + βZ_t + ε_t, with **Z_t containing four series** — CFNAI-MA3,
3-month PCE inflation, the **unemployment rate gap** (U-3 minus CBO natural rate), and **3-month KR-CRB
commodity price inflation** (added "to ensure that we do not put too much weight on the impact of commodity
price spikes on inflation"). Lag orders now fixed (15 weeks / 3 months / 1 quarter), not BIC-selected.
Because β is estimated jointly with Γ, the ANFCI is **not "NFCI minus macro" — the weights themselves
differ**: "the ANFCI tends to put less weight (in absolute terms) on credit indicators and a little more
weight on both risk and leverage indicators than the NFCI." Attribution of the 2017 revision: 80% new
simultaneous procedure, 12% unemployment gap, 8% commodity inflation. Subindexes are a restricted-loadings
re-smoothing, not a separate estimation (zero out λ for excluded variables, one more Kalman pass with the
final EM system matrices). Empirical character: "Risk is a coincident, Credit a lagging, and Leverage a
leading indicator of financial stress."

**Comparison table.**

| | KCFSI | Illing-Liu | STLFSI | CFSI | NFCI |
|---|---|---|---|---|---|
| Aggregation | PCA (PC1) | credit weights | PCA (PC1) | credit weights, quarterly dynamic | dynamic factor, QML-EM |
| Component transform | z-score | z-score (WP) / CDF (shipped) | z-score | empirical CDF | z-score |
| Weights over time | static | chain-linked | static | dynamic | static loadings, Kalman-smoothed factor |
| Index scale | mean 0, sd 1 | 0-100 | mean 0, sd 1 | CDF-weighted ×100, reported as z | mean 0, sd 1 |
| Frequency | monthly | daily | weekly | daily (10-obs MA) | weekly, mixed-frequency inputs |
| Validated against | narrative episodes | expert survey, Type I/II | — | expert survey, ROC/Somers' D | crisis prediction |
| Status | live | superseded | live (v4) | **discontinued 2016 (errors)** | live |

**Key parameters.** Component counts 11 / 9 / 18 / 11→16 / 100→105. Normalization windows: Feb 1990-Mar 2009
(KCFSI), Dec 1993-present (STLFSI), Sep 1991-Mar 2009 (CFSI CDFs), 1971 (NFCI). NFCI AR order p = 15 weeks.
**Primary sources.** KCFSI: Hakkio & Keeton 2009 (above); Cook, Thomas R., and Taeyoung Doh 2018, "Revamping
the Kansas City Financial Stress Index Using the Treasury Repo Rate," KC Fed *Macro Bulletin*, Oct 24 2018.
STLFSI: Kliesen, Kevin L., and Douglas C. Smith 2010, "Measuring financial market stress," FRB St. Louis
*Economic Synopses* 2010(2). CFSI: Oet, Eiben, Bianco, Gramlich & Ong 2011, FRB Cleveland WP 11-30R3, DOI
10.26509/frbc-wp-201130r3; Oet, Bianco, Gramlich & Ong 2012, WP 12-37, DOI 10.26509/frbc-wp-201237 (cite this
for the 16-component list); Oet, Dooley & Ong 2015, *Risks* 3(3):420-444, DOI 10.3390/risks3030420 (note the
author list changes across the three). NFCI: Brave, Scott, and R. Andrew Butters 2011, *Economic Perspectives*
(FRB Chicago) 35(1):22-43; Brave & Butters 2012, *International Journal of Central Banking* 8(2):191-239;
Brave, Scott A., and **David Kelley** 2017, "Introducing the Chicago Fed's New Adjusted National Financial
Conditions Index," *Chicago Fed Letter* No. 386; FRB Chicago 2025, "Changes to the NFCI and ANFCI," June 2
2025 technical report.
**Confidence.** [paper-verified] for all construction methods, coefficient tables, version lineages, the CFSI
discontinuation banner and the NFCI model equations, from local extraction. [unverified]: the exact v3/v4
STLFSI SOFR spread labels (`stlfsi-key.pdf` returned 403); the ℓ̃_1 = ℓ_1/√λ_1 divisor for STLFSI is an
algebraic reconstruction — the Fed states the target (index sd = 1), not the divisor. [partially-verified]:
per-category NFCI counts (risk 36 / credit 33 / leverage 36) are arithmetic on the official indicator-list
PDF, not published figures.

## 12.4 Holló, Kremer & Lo Duca — CISS, Aggregation by Time-Varying Correlation
**Mechanism (as stated).** Abstract, verbatim: "The main methodological innovation of the CISS is the
application of basic portfolio theory to the aggregation of five market-specific subindices created from a
total of 15 individual financial stress measures. The aggregation accordingly takes into account the
time-varying cross-correlations between the subindices. As a result, the CISS puts relatively more weight on
situations in which stress prevails in several market segments at the same time, capturing the idea that
financial stress is more systemic and thus more dangerous for the economy as a whole if financial instability
spreads more widely across the whole financial system." Two channels: the **"horizontal view"** (the
time-varying correlation matrix — "The stronger financial stress is correlated across subindices, the more
widespread is the state of financial instability") and the **"vertical view"** (subindex weights set by each
segment's measured impact on the real economy).
**Math / Algorithm.** *Step 1, raw indicator transform (empirical CDF / order statistics), Eq. (1a):* for
ordered sample x_(1) ≤ … ≤ x_(n), z_t = F_n(x_t) = r/n for x_[r] ≤ x_t < x_[r+1], r = 1…n−1; = 1 for
x_t ≥ x_[n]. Ties take the average of the involved ranks. Output unit-free, ordinal, range (0,1].
*Step 1b, recursive real-time version, Eq. (1b):* z_{n+T} = r/(n+T), on an expanding ordered sample, one new
observation at a time. Non-recursive (1a) applies to the pre-recursion period 8 Jan 1999 - 4 Jan 2002;
everything thereafter is recursive through 24 June 2011.
*Stated rationale for rejecting z-scores:* standardization "implicitly assumes variables to be normally
distributed," and expanding-sample means and standard deviations "can be subject to large revisions if more
and more outliers are added to the sample." *Stated rationale for rejecting PCA as the aggregator:* "PCA
itself is sensitive to outliers (as it minimises squared distances from the multidimensional mean)."
*Step 2, subindices:* simple arithmetic mean of the three stress factors per segment, s_i,t = (1/3)Σ_j z_i,j,t,
equal weight within segment deliberately, "to underscore their presumed complementary information." Footnote
9 explains why correlation weights were **not** used inside subindices: "the contribution of changes in
subindices to changes in the composite indicator would be too much reduced while changes in correlations
would tend to dominate."
*Step 3, portfolio-theoretic aggregation, Eq. (2) — the core formula:*

    CISS_t = (w ∘ s_t)′ C_t (w ∘ s_t)

with w the vector of **constant** subindex weights, s_t the vector of subindices, **∘ the Hadamard product**
(elementwise, so weights multiply subindex levels *before* the quadratic form), and C_t the 5×5 symmetric
matrix of time-varying cross-correlations with ones on the diagonal (Eq. 3). CISS is continuous, unit-free,
bounded on (0,1].
*Step 4, EWMA estimation of C_t, Eq. (4):* σ_ij,t = λσ_ij,t−1 + (1−λ)s̃_i,t s̃_j,t; σ²_i,t = λσ²_i,t−1 +
(1−λ)s̃²_i,t; ρ_ij,t = σ_ij,t/(σ_i,t σ_j,t), with **s̃_i,t = (s_i,t − 0.5)** — demeaned by the *theoretical*
median of 0.5, not a sample mean. Because the inputs are CDF ranks, the result is "broadly interpreted as a
time-varying variant of Spearman's rank correlation coefficient" and "simply indicates whether the historical
ranking of the level of stress in two market segments is relatively similar or dissimilar at any point in
time — rather than being an economic prediction of correlation risk as in Value-at-Risk frameworks."
**The structural property.** "The square of the simple arithmetic average of the five subindices … emerges as
a special case within the general formula, namely when all subindices were perfectly correlated." That
squared weighted average "actually serves as an **upper boundary** for the CISS." In normal times
correlations are "quite diverse and relatively moderate such that the CISS assumes much lower levels in
'normal times' than the simple-average composite indicator." A **"volatility-equivalent CISS"** is available
as the square root of Eq. (2) (analogous to portfolio standard deviation vs variance); the authors prefer the
variance-equivalent form because "it more strongly differentiates between episodes of stress and calmer
periods." The index decomposes cleanly into per-subindex contributions plus a total cross-correlation
contribution, computed as the difference between CISS and the squared weighted average.
**Key parameters.** λ = **0.93**, constant, "close to the average level of the smoothing parameter estimated
recursively within a simple specification of a five-dimensional IGARCH model for the demeaned subindices"
(fn. 14); robustness tested at 0.89 / 0.93 / 0.97 with differences "generally rather small." Initialization:
covariances and volatilities set at pre-recursion-period averages at t = 0. **5 segments, 15 indicators**
(exactly 3 per segment). Euro-area subindex weights: money market 15%, bond market 15%, equity market 25%,
financial intermediaries 30%, FX 15%, set from "cumulated impulse responses" of industrial production growth
across "a variety of different specifications of standard linear VAR models"; equal weights (20% each)
produce "not very large" differences. Weekly, 8 Jan 1999 - 24 June 2011. The 15 indicators (Table 1): *money
market* — realised volatility of 3-mo Euribor, Euribor − 3-mo French T-bill spread, MFI emergency lending
(marginal lending facility ÷ total reserve requirements); *bond* — realised volatility of the German 10Y
benchmark index, A-rated non-financial corporate vs government yield spread (7Y), 10-year interest rate swap
spread; *equity* — realised volatility of the Datastream non-financial index, **CMAX** = 1 − x_t/max[x ∈
(x_{t−j} | j = 0…T)] with **T = 104** (2-year moving window, weekly), and a stock-bond correlation term (weekly
average of the difference between the 4-year/1,040-business-day and 4-week/20-business-day correlation of
daily log returns of the total stock index and the 10Y Bund price index, floored at zero); *financial
intermediaries* — realised volatility of the **idiosyncratic** bank-sector equity return (OLS residual of
daily log bank return on log market return, moving 522-business-day window), A-rated financial vs
non-financial yield spread (7Y), and CMAX × book-price ratio for financials (both CDF-transformed first,
multiplied, then square-rooted); *FX* — realised volatility of EUR vs USD, JPY and GBP.
**Primary sources.** Holló, Dániel, Manfred Kremer, and Marco Lo Duca 2012, "CISS — A Composite Indicator of
Systemic Stress in the Financial System," ECB Working Paper Series No. 1426, March 2012 (Macroprudential
Research Network / MaRs).
**Confidence.** [paper-verified] — all equations, λ, the 15-indicator table, the upper-bound property and both
rejection rationales read from local extraction of the ECB PDF. [unverified]: the numeric threshold-VAR
"systemic crisis level" of the CISS, and the VAR specifications behind the 15/15/25/30/15 weights, are
described in the paper but were not in the extracted sections.

## 12.5 Kritzman & Li — The Turbulence Index (Mahalanobis Distance)
**Mechanism (as stated).** "We define financial turbulence as a condition in which asset prices, given their
historical patterns of behavior, behave in an uncharacteristic fashion, including extreme price moves,
decoupling of correlated assets, and convergence of uncorrelated assets. Financial turbulence often coincides
with excessive risk aversion, illiquidity, and devaluation of risky assets." Three trigger modes in one
scalar: extreme moves, decoupling, and convergence. A set of moves that are individually unremarkable can be
highly turbulent if the *joint configuration* violates the historical covariance structure.
**Math / Algorithm.** Mahalanobis (1936) distance. Eq. (1): d = (y − μ)Σ⁻¹(y − μ)′. Applied to returns, Eq.
(2): **d_t = (y_t − μ)Σ⁻¹(y_t − μ)′**, with d_t the scalar turbulence for period t, y_t the 1×n vector of
asset returns, μ the 1×n sample average of historical returns, Σ the n×n sample covariance. Row-vector
convention; it is the *squared* Mahalanobis distance. "The Mahalanobis distance is scale independent … The
characteristic deviations are scaled by the covariance matrix."
**Key parameters.** **Σ and μ are full-sample, not rolling** — "The average vector μ and covariance matrix Σ
in Equation 2 were calculated for the full sample from January 1980 to January 2009," a deliberate choice so
the benchmark is the entire history. n = 6 asset classes for the headline index, monthly (US stocks, non-US
stocks, US bonds, non-US bonds, commodities, US real estate). Turbulent-day threshold: the **10 percent most
turbulent days**. Parallel indices for global assets, US assets, US sectors, currencies, US fixed income, US
Treasury notes, US credit.
**Key findings.** *Turbulence is highly persistent* (Table 1, normalized average daily turbulence following
first arrival above the 10th-percentile threshold; percentile rank in parentheses): global assets 2.31(7) /
2.22(8) / 2.13(8) at 5/10/20 days, threshold 1.93; US assets 2.98(5)/2.90(5)/2.79(6), threshold 1.95; US
sectors 3.12(5)/3.04(6)/2.87(6), 2.03; currencies 2.08(8)/1.93(9)/1.80(11), 1.83; US fixed income
4.05(4)/3.85(5)/3.60(5), 2.12; US Treasury notes 3.19(5)/3.13(6)/2.96(6), 2.00; US credit
4.17(4)/4.09(4)/3.69(4), 1.61. "Markets tend to remain turbulent for up to a month or longer once turbulence
begins." The index is **coincident, not predictive**; persistence is what makes a coincident reading
actionable. *Returns to risk are substantially lower during turbulent periods irrespective of the source of
turbulence* (Figure 5, annualized daily, 4 Jan 1993 - 31 Dec 2008, across World Equities, Small−Large,
Growth−Value, naive Carry Trade and Hedge Funds): all turbulent-period bars negative, all nonturbulent
positive. *Motivating asymmetric-correlation statistic* (fn. 1): when both US and non-US equities return more
than one SD **above** their means, correlation = **−17%**; when both return more than one SD **below**,
correlation = **+76%** (monthly S&P 500 and MSCI World ex US, Jan 1970 - Feb 2008).
**Priority note.** "Chow, Jacquier, Lowrey, and Kritzman (1999) introduced a mathematical measure of
financial turbulence"; this paper extends it.
**Primary sources.** Kritzman, Mark, and Yuanzhen Li 2010, "Skulls, Financial Turbulence, and Risk
Management," *Financial Analysts Journal* 66(5):30-41.
**Confidence.** [paper-verified] for equations, parameters, Table 1 and the asymmetric-correlation statistic.
[unverified]: the Table 2 turbulent-sample VaR column (pdftotext scrambled it; only the full-sample row
7.77 / 10.12 / 12.86 is confirmed).

## 12.6 Kritzman, Li, Page & Rigobon — The Absorption Ratio (Coupling as Fragility)
**Mechanism (as stated).** "The absorption ratio captures the extent to which markets are unified or tightly
coupled. A high value for the absorption ratio corresponds to a high level of systemic risk, because it
implies the sources of risk are more unified. A low absorption ratio indicates less systemic risk, because it
implies the sources of risk are more disparate." The authors explicitly separate fragility from realized
loss: "We should not expect high systemic risk necessarily to lead to asset depreciation or financial
turbulence. It is simply an indication of market fragility in the sense that a shock is more likely to
propagate quickly and broadly when sources of risk are tightly coupled."
**Math / Algorithm.** Eq. (1): AR = Σ_{i=1}^{n} σ²_{E_i} / Σ_{j=1}^{N} σ²_{A_j}, with N the number of
assets, n the number of eigenvectors used, σ²_{E_i} the "variance of the i-th eigenvector, sometimes called
eigenportfolio," and σ²_{A_j} the "variance of the j-th asset." In prose: "the fraction of the total variance
of a set of assets explained or absorbed by a finite set of eigenvectors."
Eq. (2), the standardized shift: **ΔAR = (AR_15Day − AR_1Year)/σ**, with σ the standard deviation of the
one-year absorption ratio. ⚠ **Internal inconsistency in the paper:** the prose preceding Eq. (2) describes
AR_1Year − AR_15Day, the reverse of the printed equation. Equation (2) as printed is the one consistent with
the rest of the paper (a spike = positive ΔAR = subsequent losses).
**Key parameters.** Covariance/eigenvector window **500 days**, trailing, overlapping. Number of eigenvectors
**fixed at approximately 1/5 of the number of assets** — for US equities, 51 MSCI USA industries → **n = 10**.
The authors concede the choice is arbitrary (fn. 7: "We could instead calculate the number of eigenvectors
required to explain a fixed percentage of variance, but for no particular reason we chose to fix the number
of eigenvectors"; fn. 11: "In principle, we should condition the number of eigenvectors on the rank of the
covariance. Because the covariance matrices in our analysis are nearly full rank, we are effectively doing
this"). Variances exponentially weighted, **half-life 250 days** (half the window). Main sample 1 Jan 1998 -
31 Jan 2010; shift/drawdown results to 10 May 2010. Global version: 42 countries, Feb 1995 - Dec 2009, AR
ranges 65-85%. A Herfindahl index over per-eigenvector variance shares was tested and rejected as
"significantly less informative than our method."
**Absorption ratio ≠ average correlation.** "One might suspect that the average correlation of the assets
used to estimate the absorption ratio provides the same indication of market unity, but it does not. Unlike
the absorption ratio, the average correlation fails to account for the relevance of the asset correlations
that make up the average." Constructed counterexample (Exhibits 5-6): correlation rises between two
**high-volatility** assets while falling between two **low-volatility** assets; average correlation
*decreases* slightly, absorption ratio *increases* sharply. "The key distinction is that the absorption ratio
accounts for the relative importance of each asset's contribution to systemic risk whereas the average
correlation does not."
**Key findings.** *Drawdowns preceded by an AR spike* (Exhibit 8, 1σ shift, 1/1/1998-5/10/2010): 1-day
horizon 84.85% / 87.69% / 70.81% for the 1% / 2% / 5% worst; 1-week 84.85% / 83.08% / 75.78%; 1-month
**100.00%** / 98.46% / 89.44%. "All of the 1% worst monthly drawdowns were preceded by a one-standard
deviation spike in the absorption ratio." The authors' own qualifier, which is the one to carry: "We should
not conclude from this exhibit that a spike in the absorption ratio reliably leads to a significant drawdown
in stock prices. In many instances, stocks performed well following a spike in the absorption ratio. We would
be correct to conclude, though, that a spike in the absorption ratio is a **near necessary condition** for a
significant drawdown, just not a sufficient condition." *Subsequent returns* (Exhibit 9, annualized): after a
1σ increase −8.28% / −8.44% / −5.86% at 1 day / 1 week / 1 month, after a 1σ decrease +9.27% / +10.06% /
+12.16%, differences −17.56 / −18.50 / −18.02. *Market-timing test* (Exhibit 10, MSCI USA + Treasuries, daily
rules with 1-day lag, baseline 50/50, go 0/100 if ΔAR > +1σ and 100/0 if ΔAR < −1σ): 1.72 trades per year,
turnover 86.01%, return 9.58% vs 5.08%, risk 11.50% vs 10.89%, **return/risk 0.83 vs 0.47**. *AR leads
turbulence* (Exhibit 17): synchronizing on the 10% most turbulent 30-day periods of the MSCI USA index
(1 Jan 1997 - 10 Jan 2010), "Prior to turbulent events in the stock market, the median of the standardized
shift in the absorption ratio increased beginning about **40 days in advance** of the event, and continued to
rise throughout the turbulent periods. It then fell following the conclusion of the turbulent episodes."
**Architectural relationship to 12.5.** Turbulence is the *shock magnitude* measure; the absorption ratio is
the *conductivity* measure, and it leads turbulence by roughly 40 days. The authors position them as
complements, not substitutes.
**Primary sources.** Kritzman, Mark, Yuanzhen Li, Sebastien Page, and Roberto Rigobon 2011, "Principal
Components as a Measure of Systemic Risk," *The Journal of Portfolio Management* 37(4):112-126. Working paper:
MIT Sloan WP 4785-10, 28 June 2010; SSRN 1633027.
**Confidence.** [paper-verified] for mechanism, parameters, all exhibits and the near-necessary-not-sufficient
qualifier, from the MIT Sloan WP. [partially-verified]: JPM volume 37, issue 4, start page 112 confirmed from
the publisher URL; end page 126 from secondary citations only. The Eq. (1) numerator/denominator arrangement
is inferred from the verbatim symbol definitions and prose (the rendered equation glyph was not
text-extractable), which are unambiguous. [unverified]: the housing-market AR construction.

## 12.7 Gabaix — The Granular Origins of Aggregate Fluctuations
**Mechanism (as stated).** Idiosyncratic firm-level shocks do not average out, because the firm size
distribution is fat-tailed. Verbatim: "This paper points out that when firm size is power-law distributed,
the conditions under which one derives the central limit theorem break down and other mathematics apply. In
the central case of Zipf's law, aggregate volatility decays according to **1/ln N, rather than 1/√N**. The
strong 1/√N diversification is replaced by a much milder one that decays according to 1/ln N." The reason
large firms matter is an explicit volatility assumption (Gibrat's law for variances): the standard deviation
of a firm's percentage growth rate is independent of its size. "If Walmart doubles its number of supermarkets
and thus its size, its variance is not divided by 2, as would be the case if Walmart were the amalgamation of
many independent supermarkets. Instead, the newly acquired supermarkets inherit the Walmart shocks." A second
CLT failure: because GDP contains some very large firms, "the Lindeberg-Feller theorem does not apply," so
GDP fluctuations are typically **not Gaussian** even asymptotically.
**Math / Algorithm.** Islands economy ΔS_{i,t+1}/S_it = σ_i ε_{i,t+1}, Y_t = Σ S_it. Then
σ_GDP = [Σ_i σ_i²(S_it/Y_t)²]^{1/2} (eq. 3); with all σ_i = σ, σ_GDP = σ·h (eq. 4) where
**h = [Σ_i (S_it/Y_t)²]^{1/2}** (eq. 5), "the herfindahl" — note h is the **square root** of the sales
Herfindahl and the weights are **sales/GDP**, not value-added shares. Following Hulten (1978),
dTFP/TFP = Σ_i (sales_i/GDP)dπ_i (eq. 15), so σ_TFP = h·σ_π (eq. 17); with an endogenous factor-usage
multiplier μ, **σ_GDP = μ σ_π h** (eq. 20).
*Proposition 1* (thin tails, finite variance): σ_GDP ~ (E[S²]^{1/2}/E[S])·σ/√N.
*Proposition 2* (power law P(S > x) = a x^{−ζ}, exponent ζ ≥ 1), as N → ∞:
σ_GDP ~ (v_ζ/ln N)·σ for **ζ = 1** (eq. 8, Zipf); ~ (v_ζ/N^{1−1/ζ})·σ for **1 < ζ < 2** (eq. 9);
~ (v_ζ/N^{1/2})·σ for **ζ ≥ 2** (eq. 10). v_ζ is a *random variable* whose distribution depends on neither N
nor σ (for ζ ≤ 2 it is the square root of a stable Lévy distribution with exponent ζ/2; for ζ > 2 a
constant); "~" means convergence in distribution after scaling. Conditions: the tail index must satisfy
ζ < 2 for the failure to bite (ζ > 2 ⟺ finite variance of firm size ⟺ classical 1/√N). The knife-edge ζ = 1
requires separate treatment because E[S] = ∞, handled via Lévy's theorem with a_N = N, b_N = N ln N, giving
Y = Σ S_i ~ N ln N (eq. 14) and top-firm share S₁/Y = 1/ln N. Underlying scaling intuition, which generalizes
to any node-size problem: typical largest unit S₁ = N^{1/ζ}, k-th largest S_k = (N/k)^{1/ζ}, so top-K share
∝ N^{−(1−1/ζ)}. Appendix A (Lévy's theorem, Durrett 1996 p.153): for i.i.d. X with P(|X| > x) = x^{−ζ}L(x),
ζ ∈ (0,2), the sum scales as **N^{1/ζ}, not N^{1/2}**.
*Granular residual*, ideal (eq. 31) and empirical (eq. 32): Γ*_t = Σ_{i=1}^{K}(S_{i,t−1}/Y_{t−1})ε_it;
Γ_t = Σ_{i=1}^{K}(S_{i,t−1}/Y_{t−1})ε̂_it with ε̂_it = g_it − β̂′X_it. Productivity proxy
z_it = ln(sales_it/employees_it) (eq. 29), g_it = z_it − z_{i,t−1}. Two operational forms subtract a
cross-firm mean (eq. 33) or an industry mean (eq. 34). Theory link g_Yt = μΓ*_t. Proposition 4 gives
identification conditions requiring that observables X span the common-factor structure; Gabaix is explicit
that without a parametric restriction there is no solution (Manski 1993 reflection problem).
**Key parameters.** Firm-size power-law exponent ζ = **1.059 ± 0.054** (Axtell 2001, US Census) ⟹ Zipf.
Firm-level volatility σ_π = **12%/yr** (sales per employee; 12% sales, 14% employees). Cross-firm correlation
among the top 100: 0.023 / 0.073 / 0.033, "most variation is idiosyncratic." Sales Herfindahl h, US 2008 =
**5.3%** (Compustat); 22% average across countries. Multiplier μ = **2.6** (average of 1.8, 4.5, 1.5; Frisch
elasticity 2). Implied σ_TFP = 12% × 5.3% = 0.63%; implied σ_GDP = 2.6 × 12% × 5.3% = **1.7%** against an
observed ~1-2%. Simulated median h under Zipf at N = 10⁶ = **12%**, versus 0.1% if firms were equal-sized.
Sample: Compustat annual **1951-2008**, K = 100 largest by prior-year sales, Q = 100 or 1000, **excluding
oil/energy/finance**, 3-digit SIC industries, demeaned growth winsorized at 20%.
**Headline result.** Abstract, verbatim: "The idiosyncratic movements of the largest 100 firms in the United
States appear to explain about **one-third** of variations in output growth." The "one-third" summarizes a
range, not a single estimate. Table I (simple demeaning, 1952-2008): per-capita GDP growth on Γ_t, adjusted
R² = 0.239 (1 lag) and 0.346 (2 lags); Solow residual 0.233 / 0.239. Table II (industry-demeaned): GDP growth
adjusted R² = 0.332 / **0.477**; Solow 0.335. Predictive (Tables III/IV): lagged Γ alone adjusted R² =
**18.5%**; oil (Hamilton) + money (Romer-Romer) shocks = 10.9%; term spread = 23.1%; all predictors together
= 34.1%; Γ's incremental adjusted R² over everything else = **14.9%**. Gabaix labels this "tentative," and
flags a small-sample errors-in-variables bias that *lowers* measured R² relative to the true R², biasing
against his own hypothesis. Caveat to carry: if only aggregate shocks mattered these R² would be zero, so the
result rejects a representative-firm framework, but the reflection problem (large firms volatile *because of*
aggregate shocks) is controlled parametrically, not identified. Narrative validation (Table V) attributes
specific years to specific firms: 1952 U.S. Steel strike, 1955-57 GM/Ford price war, 1970-71 GM strike, 1974
GM fuel-economy hit, 1983 IBM PC, 1996 AT&T spin-off of NCR/Lucent, 2000 GE, 2002 Walmart. Walmart's 2001
share of US GDP was 2.2%, near GM's 3% peak (1956) and U.S. Steel's 2.8% (1917).
**Primary sources.** Gabaix, Xavier 2011, "The Granular Origins of Aggregate Fluctuations," *Econometrica*
79(3):733-772, DOI 10.3982/ECTA8769.
**Confidence.** [paper-verified] — all propositions, scaling rates, parameters and regression results read
from the author's PDF (identical pagination to the journal).

## 12.8 Acemoglu, Carvalho, Ozdaglar & Tahbaz-Salehi — The Network Origins of Aggregate Fluctuations
**Mechanism (as stated).** Input-output linkages are a propagation channel. The diversification argument
survives symmetry (no linkages, or every sector relying equally on all others) and fails under **asymmetry**
in the roles sectors play as suppliers. Two distinct causes of slow decay: **first-order interconnections** (a
sector supplying disproportionately many others transmits directly) and **higher-order interconnections**
(cascades reaching customers of customers). Headline structural claim: "the 'sparseness' of the input-output
matrix is unrelated to the nature of aggregate fluctuations" — what matters is asymmetry. Ring networks and
binary trees, though sparse and intuitively fragile, diversify at exactly √n.
**Math / Algorithm.** Cobb-Douglas Long-Plosser economy x_i = z_i^α ℓ_i^α Π_j x_ij^{(1−α)w_ij}, Σ_j w_ij = 1,
α = labor share, ε_i ≡ log z_i independent across sectors. **Influence vector** (eq. 4) and aggregate output
(eq. 3): y ≡ log(GDP) = **v′ε**, with **v ≡ (α/n)[I − (1−α)W′]⁻¹𝟙**, where [I − (1−α)W′]⁻¹ is the **Leontief
inverse** and v is a **Bonacich centrality** vector. *Relation to Domar weights:* the authors show (eq. 5)
that v **is the sales vector**, v_i = p_i x_i / Σ_j p_j x_j, the equilibrium sales share — the exact bridge to
12.7. One caveat they flag (fn. 12): unlike Hulten's formula, log shocks are multiplied by **sales shares,
not sales divided by value added**, because their shocks are Harrod-neutral whereas Hulten's are
Hicks-neutral. Weighted **outdegree** d_i ≡ Σ_j w_ji = share of sector i's output in the economy's input
supply. Under their Assumption 1 all weighted **indegrees equal 1**, which they verify approximates US data,
so the entire action is in the out-degree distribution: out-degree = how much of a supplier you are =
systemic importance.
Aggregate volatility scaling (eq. 6): (var y_n)^{1/2} = Θ(‖v_n‖₂). If ‖v_n‖₂ is bounded away from zero (star
network: ‖v_n‖₂ = Θ(1)) the law of large numbers fails outright. *Theorem 1*: y_n/‖v_n‖₂ → N(0,σ²) under
normality, or under a tail-dominance condition plus ‖v_n‖_∞/‖v_n‖₂ → 0; if that ratio does not vanish and
shocks are non-normal, the limiting distribution is **non-normal** with finite variance — the network
determines not only the rate but the shape.
*First-order.* With CV_n = (1/d̄_n)[(1/(n−1))Σ_i(d_i − d̄_n)²]^{1/2}: Theorem 2 gives (var y_n)^{1/2} =
Ω((1/n)√(Σ_i(d_i^n)²)) (eq. 7) and = Ω((1 + CV_n)/√n) (eq. 8). Corollary 1, power-law out-degree with shape
β ∈ (1,2): (var y_n)^{1/2} = Ω(n^{−(β−1)/β − δ}) for any δ > 0.
*Second-order.* Definition 3 (eq. 9): **τ₂(W_n) ≡ Σ_i Σ_{j≠i} Σ_{k≠i,j} w^n_ji w^n_ki d^n_j d^n_k**,
measuring the extent to which **high-degree sectors share common suppliers** (their Ford/GM/Chrysler
example). Provably not recoverable from the degree sequence: Example 2 constructs two economies with
identical degree sequences for all n where τ₂ = Θ(n²) versus 0, giving ‖v_n‖₂ = Θ(1) versus Θ(n^{−1/4}).
Theorem 3 (eq. 10): (var y_n)^{1/2} = Ω(1/√n + CV_n/√n + √τ₂(W_n)/n). Second-order degree
q^n_i ≡ Σ_j d^n_j w^n_ji (eq. 11); Corollary 2, power-law second-order degrees with shape ζ ∈ (1,2):
(var y_n)^{1/2} = Ω(n^{−(ζ−1)/ζ − δ}). When both first- and second-order degrees are power law, **the binding
bound is set by min{β, ζ}**.
*Converse.* Theorem 4: a sequence is *balanced* if max_i d_i^n = Θ(1); for balanced economies there exists
ᾱ ∈ (0,1) such that for α ≥ ᾱ, (var y_n)^{1/2} = **Θ(1/√n)** exactly. This generalizes Dupor (1999) and is
the source of the sparseness-irrelevance claim.
**Key parameters (BEA detailed benchmark input-output, 1972-2002).** Estimated by the Gabaix-Ibragimov (2011)
modified log-rank/log-size regression (OLS log-CCDF is downward biased in small samples), tail = top 20% of
sectors. β̂ (first-order): 1.38 / 1.38 / 1.35 / 1.37 / 1.32 / 1.43 / 1.46 across the seven benchmark years,
average **1.38**. ζ̂ (second-order): 1.14 / 1.15 / 1.10 / 1.14 / 1.15 / 1.27 / 1.30, average **1.18**. Sector
counts 483 / 524 / 529 / 510 / 476 / 474 / 417. Standard errors 0.18-0.23 (β̂), 0.15-0.20 (ζ̂). Cross-checks:
Nadaraya-Watson implied slopes 1.28 / 1.17; Clauset-Shalizi-Newman Hill-type ML 1.39 / 1.14. **The
second-order tail is always heavier than the first-order.** Implied decay: ζ̂ = 1.18 ⟹ volatility decays no
faster than **n^{−0.15}**; β̂ = 1.38 ⟹ n^{−0.28}. Both far slower than n^{−0.5}. Average intermediate input
share 0.55, stable. ‖v_n‖₂ ≈ 0.088-0.098 at the detailed level, roughly **twice** 1/√n_d, i.e. linkages at
least double the impact of sectoral shocks. Moving from 84 summary to 483 detailed sectors, diversification
predicts a 58% decline in ‖v‖₂; the observed decline is ~29%. Back-of-envelope with the NBER productivity
database (459 four-digit SIC manufacturing industries, 1958-2005, detrended, average sectoral TFP sd 0.058):
a balanced structure would give 0.058/√2295 ≈ 0.001, while the n^{−0.15} rate gives ≈ **0.018**, "in the
ballpark of the approximately 2% standard deviation of U.S. GDP" — the authors call this "merely suggestive."
Top five by first-order degree (2002): management of companies, wholesale trade, real estate, electric power,
iron and steel mills. Top five by second-order degree: management of companies, wholesale trade, real estate,
advertising, monetary authorities and depository credit intermediation.
**Stated generalization.** The results apply to any model with the representation ỹ = W̃ỹ + ε̃, where ỹ is a
vector of outputs/actions of n units, W̃ captures interactions and ε̃ independent shocks. The authors state
this explicitly as the license to port the machinery outside input-output economics. They also state the
relationship to 12.7 directly: "The intersectoral network in our model plays the same role as the firm size
distribution in Gabaix's analysis" — but the network version is more informative, because sizes are *derived*
from interactions rather than assumed, and the network additionally pins down sectoral **comovement**.
**Primary sources.** Acemoglu, Daron, Vasco M. Carvalho, Asuman Ozdaglar, and Alireza Tahbaz-Salehi 2012,
"The Network Origins of Aggregate Fluctuations," *Econometrica* 80(5):1977-2016, DOI 10.3982/ECTA9623.
**Confidence.** [paper-verified] from the MIT-hosted PDF of the published article. Note the authors' own
caution that n^{−0.15} is a **lower bound extrapolated** from the estimated second-order tail index under an
explicitly "speculative" scale-free assumption at finer disaggregation than the BEA data provides.

## 12.9 Diebold & Yilmaz — Connectedness from Forecast-Error Variance Decompositions
**Mechanism (as stated).** Connectedness is defined as **shares of forecast error variance in variable i
attributable to shocks in variable j, for i ≠ j**. The MA coefficients contain the dynamics, but hundreds of
coefficients are "typically fruitless" to read directly, so a transformation is needed, and variance
decompositions achieve it. Their slogan: "The key is i ≠ j." In 2014 the structural claim becomes explicit:
"variance decompositions **are** networks. More precisely, the variance decomposition matrix D, which defines
our connectedness table and all associated connectedness measures, is a network adjacency matrix A."
**Math / Algorithm.** Covariance-stationary N-variable VAR(p) x_t = Σ_i Φ_i x_{t−i} + ε_t, ε ~ (0,Σ) iid;
MA x_t = Σ_i A_i ε_{t−i} with A_i = Φ₁A_{i−1} + … + Φ_p A_{i−p}, A₀ = I_N.
*2009 (Cholesky).* x_t = A(L)u_t with A(L) = Θ(L)Q⁻¹, u_t = Qε_t, E(u_t u_t′) = I, Q⁻¹ the unique
lower-triangular Cholesky factor. S = 100 · [Σ_{h=0}^{H−1} Σ_{i≠j} a²_{h,ij}] / [Σ_{h=0}^{H−1} tr(A_h A_h′)].
**Ordering dependence** is the acknowledged flaw: "DY relies on Cholesky-factor identification of VARs, so
the resulting variance decompositions can be dependent on variable ordering. One would prefer a spillover
measure invariant to ordering." Nuance often misquoted: "We often find that **total** connectedness is robust
to Cholesky ordering … **Directional** connectedness, however, is sometimes more sensitive to Cholesky
ordering, which enhances the appeal of GVDs." GVDs are not assumption-free either (fn. 2 of the 2014 paper
notes they assume normality of shock distributions).
*Generalized (KPPS) variance decomposition* (Koop-Pesaran-Potter 1996; Pesaran-Shin 1998). Mechanism as
stated: "Instead of attempting to orthogonalize shocks, the generalized approach allows correlated shocks but
accounts for them appropriately using the historically observed distribution of the errors. As the shocks to
each variable are not orthogonalized, the sum of contributions to the variance of forecast error … is not
necessarily equal to one."

    θ^g_ij(H) = σ_jj⁻¹ · Σ_{h=0}^{H−1}(e_i′ A_h Σ e_j)²  /  Σ_{h=0}^{H−1}(e_i′ A_h Σ A_h′ e_i)

with Σ the covariance matrix of ε, e_j a selection vector, and **σ_jj the j-th diagonal element of Σ (a
variance)**. ⚠ **Implementation discrepancy worth recording:** the March-2010 working paper prints σ_ii⁻¹ and
calls it "the standard deviation of the error term for the i-th equation." That is wrong, and the same
authors say so — 2014 fn. 4: "Note the typo in the original paper of Pesaran and Shin (1998), p. 20. They
write σ⁻¹_{ii} but should have written σ⁻¹_{jj}." Implement **σ_jj = Σ[j][j]**, a variance.
Normalization (row sums ≠ 1 under GVD): θ̃^g_ij(H) = θ^g_ij(H)/Σ_j θ^g_ij(H), so Σ_j θ̃^g_ij = 1 and
Σ_{i,j} θ̃^g_ij = N. Total: S^g(H) = 100·[Σ_{i≠j} θ̃^g_ij(H)]/N; 2014 decimal form C^H = (1/N)Σ_{i≠j} d^H_ij.
Exactness caveat (2012 fn. 7): under GVD the "off-diagonal over total" identity is **approximate**; under
Cholesky it is exact — which is why the 2014 paper calls the block an *approximate* variance decomposition
matrix.
Directional measures: FROM others to i, S^g_{i←·}(H) = 100·[Σ_{j≠i}θ̃^g_ij]/[Σ_j θ̃^g_ij] (row sum, = 1);
TO others from i, S^g_{·←i}(H) = 100·[Σ_{j≠i}θ̃^g_ji]/[Σ_j θ̃^g_ji] (column sum, unconstrained); NET = TO −
FROM; NET PAIRWISE S^g_ij(H) = 100·[θ̃^g_ij/Σ_k θ̃^g_ik − θ̃^g_ji/Σ_k θ̃^g_jk]. Because "to" denominators are
column sums, **"to others" can exceed 100 while "from others" cannot** — this asymmetry is the point of the
2012 title ("Better to Give than to Receive").
*Network mapping.* D departs from a classical adjacency matrix in three ways the authors enumerate: entries
are weights in [0,1] not 0/1; links are directed so A is generally **not symmetric**; row sums are
constrained to 1 so the diagonal A_ii = 1 − Σ_{j≠i}A_ij is **not zero**. From-degree δ^from_i = Σ_{j≠i}A_ij,
support [0,1]; to-degree δ^to_j = Σ_{i≠j}A_ij, support [0,N]. Verbatim: "our total directional connectedness
measures C_{i←·} and C_{·←j} are precisely the from-degrees and to-degrees … our total connectedness measure
C is simply the **mean degree** of the network D," motivated via the Erdős-Rényi diameter approximation
s_max ~ ln N / ln E(δ). Their trade analogy: pairwise directional ≈ bilateral imports/exports, net pairwise ≈
bilateral trade balances, total directional ≈ total exports/imports, net total directional ≈ a country's
trade balance, total connectedness ≈ total world exports.
**Key parameters.** Formal dependence C(x, H, A(L), M(L;θ)) — reference universe, horizon, true dynamics,
approximating model; time-varying estimate Ĉ_t(x, H, M_{t−w:t}(θ̂)). Two warnings worth carrying:
"Connectedness measurements generally will not, and should not, be robust to choice of reference universe,"
and "there is no reason why connectedness should be 'robust' to H" — longer H lets lagged/contagion-style
connectedness appear that short H cannot see. They suggest anchoring H to a decision (H = 10 "would cohere
with the 10-day value at risk (VaR) required under the Basel accord"). Rolling window: "a uniform one-sided
estimation window of width w, sweeping through the sample," with the cost that "Rolling windows do, however,
require choice of window width w, in a manner precisely analogous to bandwidth choice in density estimation";
expanding windows are rejected as too slow to adapt. Specifications: 2009 — 19 global equity markets, weekly
returns + Garman-Klass range volatilities, Jan 1992-Nov 2007, VAR(2) by Schwarz, Cholesky, H = 10 weeks,
w = **200 weeks**. 2012 — 4 US asset classes, daily Parkinson range volatility, Jan 1999-Jan 2010, 2771 obs,
VAR(4), H = 10 days, w = **200 days**. 2014 — 13 US financial institutions, daily log realized volatility
from 5-minute TAQ returns (78 intervals/day), May 1999-Apr 2010, VAR(3), H = **12 days**, w = **100 days**.
Parkinson estimator σ̃²_it = 0.361[ln(P^max_it) − ln(P^min_it)]².
**Key findings.** *2009:* "almost forty percent of forecast error variance comes from spillovers, both for
returns (36 percent) and volatilities (40 percent)." The central result is a **divergence in dynamics**:
"return spillovers display a gently increasing trend but no bursts, whereas volatility spillovers display no
trend but clear bursts." Many well-known events produced large volatility spillovers while none produced
return spillovers. *2012:* full-sample total volatility spillover only **12.6%**; stocks the largest net
transmitter (+5.05), FX a net receiver (−2.8); the rolling index runs 10-20% for most of the sample and "by
far exceed[s] the thirty percent level, during the global financial crisis of 2007-2009," in four waves.
*2014:* full-sample total connectedness **78.3%**. The structurally important finding is the **asymmetry
between the to- and from-degree distributions**: "the spread of the 'from' degree distribution is noticeably
less than that of the 'to' degree distribution." From-degree spans **12 points** (70% Fannie/Freddie to 82%
Wells Fargo/PNC); to-degree spans **53 points** (53% Fannie Mae to **106% Citigroup**). "While the financial
stocks are largely similar in terms of receiving volatility shocks from others, they are highly
differentiated as transmitters." Net leaders Citigroup +26.5, BofA +18.8, AmEx +13.0, JPM +8.9; net receivers
AIG −18.7, PNC −18.2, Fannie Mae −17.4, Goldman −15.2, BNY Mellon −9.9. A dynamic finding that cuts against
the naive reading: "even though for each stock the 'from' connectedness reached the highest levels during the
2007-08 crisis, we do **not** observe such a level shift in the 'to' and 'net' connectedness measures over
the same period" — instead the "to" distribution becomes **more right-skewed** in crisis, a few firms
transmitting very heavily.
**Primary sources.** Diebold, F.X. & Yilmaz, K. 2009, "Measuring Financial Asset Return and Volatility
Spillovers, with Application to Global Equity Markets," *Economic Journal* 119(534):158-171, DOI
10.1111/j.1468-0297.2008.02208.x. 2012, "Better to Give than to Receive: Predictive Directional Measurement
of Volatility Spillovers," *International Journal of Forecasting* 28(1):57-66. 2014, "On the Network Topology
of Variance Decompositions: Measuring the Connectedness of Financial Firms," *Journal of Econometrics*
182(1):119-134. 2015, *Financial and Macroeconomic Connectedness: A Network Approach to Measurement and
Monitoring*, Oxford University Press.
**Confidence.** [paper-verified] for all equations and findings, read in the authors' **working-paper
versions** (NBER WP 13811, Koç-TÜSİAD ERF WP 1001 rev. March 2010, NBER WP 17490). [unverified]: published
typesetting, page numbers and published equation numbering were not diffed against these; whether the
published IJF version corrected the σ_ii/σ_jj slip; the 2015 OUP book (bibliographic details only, no text
read, no claim made about contents).

## 12.10 Billio, Getmansky, Lo & Pelizzon — Granger-Causality Networks and PCAS
**Mechanism (as stated).** Direct exposure and leverage data across sectors is proprietary and unavailable to
any single regulator, so connectedness must be inferred **indirectly from statistical properties of market
returns**. Two complementary channels: PCA captures *contemporaneous commonality* (few components explaining
most variance ⟹ shared risk exposures), Granger causality captures *lagged, directional spillover*. Granger
causality in monthly returns should be zero under informational efficiency; its presence is attributed to VaR
constraints, transaction costs, borrowing constraints, information-processing costs and short-sale
restrictions, which also prevent it from being arbitraged away.
**Math / Algorithm.** *PCA layer.* With R_S = Σ_i R_i and z_k ≡ (R_k − μ_k)/σ_k: σ_S² = Σ_iΣ_j σ_iσ_j E[z_iz_j]
(1); z_i = Σ_k L_ik ζ_k with E[ζ_kζ_l] = λ_k if k = l else 0 (2,3); E[z_iz_j] = Σ_k L_ik L_jk λ_k (4);
σ_S² = Σ_iΣ_jΣ_k σ_iσ_j L_ik L_jk λ_k (5). **Cumulative Risk Fraction** (6): Ω ≡ Σ_{k=1}^{N}λ_k,
ω_n ≡ Σ_{k=1}^{n}λ_k, **h_n ≡ ω_n/Ω ≥ H**. **PCAS** (7-8): PCAS_{i,n} = ½·(σ_i²/σ_S²)·(∂σ_S²/∂σ_i²)|_{h_n≥H}
= Σ_{k=1}^{n}(σ_i²/σ_S²)L²_ik λ_k |_{h_n≥H}. Note PCAS is **conditional on h_n ≥ H**: only defined when a
strong common component is present.
*Granger layer, bivariate VAR(1)* (9): R^i_{t+1} = a_i R^i_t + b_ij R^j_t + e^i_{t+1} and symmetrically; j
Granger-causes i iff b_ij ≠ 0, feedback if both; lag length by **BIC**, inference by **F-tests**.
*Heteroskedasticity correction* (the main upgrade over the 2010 working paper): a per-institution GARCH(1,1)
baseline R^i_t = μ_i + σ_it ε^i_t, σ²_it = ω_i + α_i(R^i_{t−1} − μ_i)² + β_i σ²_{it−1} (10), conditioned on
the system information set (11), with the Granger test then run on **standardized returns
R̃^i_t = R^i_t/σ̂_it** (12). Hedge-fund autocorrelation additionally filtered with Getmansky-Lo-Makarov (2004)
as robustness.
*Network statistics*, all conditional on DGC ≥ K: **DGC ≡ [1/(N(N−1))]Σ_iΣ_{j≠i}(j→i)** (14);
#Out (j→S) = [1/(N−1)]Σ_{i≠j}(j→i), #In (S→j) = [1/(N−1)]Σ_{i≠j}(i→j), #In+Out = the average of the two (15);
sector-conditional versions with M = 4 types and normalizer (M−1)N/M (16-18); Closeness
(j —C→ i) = (j→k₁)(k₁→k₂)···(k_{C−1}→i) (19), C_ji = min_C{C ∈ [1,N−1] : (j —C→ i) = 1} set to N−1 if no
path (20), C_jS = [1/(N−1)]Σ_{i≠j}C_ji(j —C→ i) (21); Eigenvector centrality [A]_ji = (j→i) (22),
Av = v at eigenvalue 1 (23), v_j = Σ_i [A]_ji v_i (24). Note the direction: **v_j sums the centralities of
institutions caused by j**, so it scores transmission, not reception. Uniqueness by Perron-Frobenius.
*Nonlinear layer.* Two-state Markov-switching R_{j,t} = μ_j(Z_{j,t}) + σ_j(Z_{j,t})u_{j,t} (25); joint chain
Y_t ≡ (Z_h,t, Z_b,t) (26-27); non-causality restrictions (28-30) tested by **likelihood-ratio tests**
(Billio & Di Sanzo 2009). Because of parameter count these run on **four value-weighted sector indexes'
S&P-500-residual returns, not the 100 individual firms**.
*Illiquidity.* Following Lo (2002) and Getmansky-Lo-Makarov (2004), **first-order return autocorrelation ρ₁
is the illiquidity proxy**. Leverage proxy = (Total Assets − Equity Market Value)/Equity Market Value.
**Key parameters.** Four sectors (hedge funds, banks, broker/dealers, insurers), **monthly returns only**,
**Jan 1994 - Dec 2008**. Hedge funds from TASS Tremont (8,770 funds, Live + Defunct); banks/brokers/insurers
from CRSP, SIC 6000-6199 / 6200-6299 / 6300-6499. The 25 largest per sector by average AUM or market cap
**during the time period considered**, so selection is re-done inside each window and the 100-institution
panel changes over time. N = 100, M = 4, **9,900 directed pairs**. Rolling window **36 months** (60-month
robustness), **145 overlapping windows**. Edge significance **5%**. DGC threshold K = **0.055**, the 95th
percentile of a Monte Carlo null (100 independent series, 500 reps; null centered at 0.052, 90% mass in
[0.049, 0.055]). CRF thresholds H = **33.74% (n=1), 74.48% (n=10), 91.67% (n=20)**.
**Key findings.** *Directionality:* "the returns of banks and insurers seem to have more significant impact
on the returns of hedge funds and broker/dealers than vice versa," an asymmetry that "became highly
significant prior to the Financial Crisis of 2007-2009." Quantified for 2006-2008: banks → hedge funds =
**23% of possible connections, 142 significant links**; hedge funds → banks = **5%, 31 links**. Alongside
this, "hedge funds may be the 'canary in the cage' that first experience losses when financial crises hit."
The published JFE abstract narrows it to asymmetry "with banks playing a much more important role in
transmitting shocks than other financial institutions." *Connectedness rises before and during crises:* total
significant connections 583 (6%) in 1994-1996 → 856 (9%) in 1996-1998 (+50%, just before/during LTCM) → 611
(6%) in 2002-2004 → **1,244 (13%) in 2006-2008**, the sample maximum. *PCA:* PC1 ranges **24-43%**, peaking
at 43% in August 1998 and again October 2008; over 2007-2009 PC1 = 37% and the first 10 PCs = 83%. Sample
averages PC1 = 33%, PC1-10 = 74%, PC1-20 = 91%. Correlation of GARCH system variance with CRF = 0.41; of h₁
with number of connections = 0.50; of system variance with connections = 0.43 — related but not redundant,
and they diverge in 2001-2006. *Out-of-sample:* two 36-month estimation windows (Oct 2002-Sep 2005, Jul
2004-Jun 2007), crisis window Jul 2007-Dec 2008, dependent variable the rank of Max%Loss. **Significant:
#Out, #Out-to-Other, #In+Out-Other, Closeness, Eigenvector Centrality, PCAS. Not significant: #In,
#In-from-Other.** The stated interpretation is the finding to carry: the firms that lost most were those that
**affected** others, not those affected by others. Oct02-Sep05 univariate: PCAS 1 β = 0.35 (t = 3.46),
Out-to-Other β = 0.32 (t = 3.11), Out / Closeness β = 0.23 (t = 2.23), Eigenvector Centrality β = 0.24
(t = 2.31). Multivariate (controlling leverage, size, ρ₁, PCAS 1): network measures survive, **size is never
significant**, leverage is positively related to Max%Loss; R² 0.19-0.27 and 0.08-0.17. Top-ranked on Out /
Out-to-Other: Wells Fargo, Bank of America, Citigroup, Fannie Mae, UBS, Lehman Brothers Holdings, Wachovia,
Bank of New York, AIG, Washington Mutual. Granger-network measures are **not** consistently correlated with
realized contemporaneous tail risk during the crisis while PCAS measures are, which the authors read as
Granger measures capturing *non-contemporaneous* loss spillover. *Illiquidity:* asset-weighted autocorrelation
was negative for all institutions in the first four windows and turned positive for all four sectors in
2006-2008, read as maximum illiquidity coinciding with maximum connectivity. *Nonlinear:* nonlinear tests find
**more** interconnectedness than linear, supporting Danielsson-Shin-Zigrand endogenous volatility feedback.
**Two corrections recorded to prevent misquotation.** (a) **The paper makes no numeric lead-time claim.**
There is no "N months of warning" statement anywhere; only the qualitative claim that the measures "may be
useful out-of-sample indicators of systemic risk." A lead time can be *inferred* from the design (the earlier
estimation window ends Sept 2005, roughly 22 months before the crisis window opens; the later ends June 2007,
1 month ahead) but is not asserted. Structurally, 36-month rolling windows of monthly data floor the
responsiveness at months, not days. (b) **1994-1996 is the paper's tranquil baseline, not a crisis.** Any
"1994 crisis" attribution to this paper is unsupported.
**Version discrepancy.** NBER WP 16223 (July 2010), titled "Econometric Measures of *Systemic Risk*…", is a
substantially different paper and a frequent source of misquotation. There PCA is applied to only **four
sector indexes**, so PC1 = **77% (1994-2000) / 83% (2001-2008)** and PC1+PC2 = 92%, not the 24-43% of the JFE
version. Anyone citing "the first principal component explains 83%" is citing the working paper's index-level
result, not the published firm-level one. The NBER draft also has **no CRF, no PCAS, no DGC, no formal eqs.
14-24**.
**Primary sources.** Billio, Monica, Mila Getmansky, Andrew W. Lo, and Loriana Pelizzon 2012, "Econometric
measures of connectedness and systemic risk in the finance and insurance sectors," *Journal of Financial
Economics* 104(3):535-559, DOI 10.1016/j.jfineco.2011.12.010.
**Confidence.** [paper-verified] from the accepted-manuscript version (SSRN 1963216 / Ca' Foscari WP
21/WP/2011) read in full; journal citation confirmed via RePEc. [unverified]: typeset JFE page and equation
numbering (ScienceDirect returned 403); Online Appendices O.1-O.4, including the co-kurtosis derivation
relating PCAS to multivariate tail dynamics.

## 12.11 Baker, Bloom & Davis — Economic Policy Uncertainty from Newspaper Text
**Mechanism (as stated).** Newspaper coverage is treated as a *sampling instrument on discourse*, not as a
direct reading of the economy. The claim is deliberately modest: that the frequency with which journalists
jointly invoke the economy, policy and uncertainty tracks the intensity of societal concern about economic
policy uncertainty. The authors never claim the index measures uncertainty itself, and they validate against
human readers of the same articles rather than against economic outcomes.
**Math / Algorithm.** *Search rule.* Ten newspapers (USA Today, Miami Herald, Chicago Tribune, Washington
Post, LA Times, Boston Globe, SF Chronicle, Dallas Morning News, NYT, WSJ), digital archives from January
1985. An article counts only if it contains a term from **all three** sets (strict conjunction):
**Uncertainty** — "uncertainty" or "uncertain"; **Economy** — "economic" or "economy"; **Policy** —
"Congress", "deficit", "Federal Reserve", "legislation", "regulation", or "White House". Variants
("uncertainties", "regulatory", "the Fed") included. For the long-span historical indexes back to 1900 the E
set adds "business", "industry", "commerce", "commercial" and the P set adds "tariff" and "war". Scale check:
**only 0.5 percent of all articles in the ten papers satisfy the E and U criteria at all** — the triple is a
very narrow filter.
*Normalization, verbatim, with T1 the standardization interval and T2 the normalization interval:* "(i)
Compute the times-series variance, σ²_i, in the interval T1 for each paper i. (ii) Standardize X_it by
dividing through by the standard deviation σ_i for all t. This operation yields for each paper a series Y_it
with unit standard deviation in the interval T1. (iii) Compute the mean over newspapers of Y_it in each month
to obtain the series Z_t. (iv) Compute M, the mean value of Z_t in the interval T2. (v) Multiply Z_t by
(100/M) for all t to obtain the normalized EPU time-series index." For the US index both T1 and T2 are
**1985-2009**. Compactly:

    X_it  = EPU_it / TotalArticles_it        scale by outlet volume  ← "share, not count"
    Y_it  = X_it / sd_{T1}(X_i)              unit sd PER PAPER, before averaging
    Z_t   = (1/10) Σ_i Y_it                  average across papers
    EPU_t = Z_t · (100 / mean_{T2}(Z))       rescale to mean 100 (cosmetic)

The authors' stated reason for step (i): "An obvious difficulty with these raw counts is that the overall
volume of articles varies across newspapers and time." Three properties: division by outlet volume happens
**per outlet per period**, not globally; unit-variance standardization happens **per outlet before
averaging**, so a high-variance outlet cannot dominate; and the final 100 is **cosmetic only**. Where a
platform will not report a total, they substitute a neutral denominator: "search platform limitations
preclude us from scaling by the count of all articles. In these cases, we instead scale by the count of
articles containing the common and neutral term 'today'."
**Validation, including the human audit.** Six months developing the process, eighteen months running it.
Supervised teams read and coded **12,009 articles** spanning **1900-2012** from eight newspapers, preceded by
a **2,000-article pilot** with about 20 percent double-coded which produced a **65-page audit guide** used
for training. Each auditor did at least 100 trial codings outside the sample plus one-on-one review. Articles
were presented in **randomized order** so auditor learning effects would not be confounded with differences
across papers or over time. About **one quarter of articles were assigned to multiple auditors**. Sampling was
deliberately *not* random over all articles — they sample from the universe already satisfying E and U, since
only 0.5% pass, and the audit exists to select and evaluate the **P** term set.
*How the audit picked the terms.* Auditors recorded which policy terms appeared in EPU-relevant passages,
yielding 15 candidates. The authors then evaluated **approximately 32,000 term-set permutations** of four or
more terms, generating a computer label EPU_C for every audited article and comparing to the human label
EPU_H, selecting the set **minimizing the gross error rate, defined as the sum of the false positive and
false negative rates**. "Tax" is the instructive rejection: it materially lowered false negatives but raised
false positives more.
*Measured agreement.* **Correlation 0.86** between human and computer EPU indexes, quarterly, 1985-2012;
**0.93** annual, 1900-2010. And the property that actually licenses the index: net error (computer minus
human) correlates **−0.02** with quarterly real GDP growth and **0.004** with the true human EPU rate — the
classifier's error is not systematically larger in booms or busts and does not scale with the level of
uncertainty. The term set was chosen with **no use of time-series variation**, so 0.86 is a genuine
out-of-criterion check.
*Other validations.* Left- vs right-leaning newspaper subsets (split by the Gentzkow-Shapiro slant index)
correlate **0.92**. Correlation with **VIX is 0.58**. Swapping the P set for "stock price"/"equity
price"/"stock market" produces a news index correlating **0.73 with VIX**. Beige Book policy-uncertainty
mentions correlate 0.54; policy-triggered large daily stock jumps 0.78 annually; Jurado-Ludvigson-Ng
correlates **0.42** with EPU.
**Key parameters.** 10 newspapers; 3-set strict conjunction; T1 = T2 = 1985-2009; 12,009 audited articles;
~32,000 term-set permutations; 0.5% base pass rate on E∧U. The daily NewsBank index (~1,500 papers)
correlates 0.85 with the 10-paper monthly index, but the authors warn "because papers enter and leave the
NewsBank archive, and its count of newspapers expands greatly over time, compositional shifts potentially
distort the longer term behavior."
**Limits the authors acknowledge.** Only **5 percent** of EPU_H = 1 articles mainly discuss *declines* in
policy uncertainty — "apparently, reporters and editors do not regard falling uncertainty as particularly
newsworthy." The index is roughly **20-to-1 asymmetric toward detecting rises over falls**. EPU is on average
**16 log points higher during the month of a national election** (t = 5.3, 12 countries, 62 elections), and
the share of articles about *who* will make policy **triples in presidential election years** — calendar
composition, not economic severity.
**Primary sources.** Baker, Scott R., Nicholas Bloom, and Steven J. Davis 2016, "Measuring Economic Policy
Uncertainty," *Quarterly Journal of Economics* 131(4):1593-1636, DOI 10.1093/qje/qjw024. NBER WP 21633. Audit
guide: policyuncertainty.com/Audit_Guide.pptx.
**Confidence.** [paper-verified] from full text extraction of the published QJE PDF and the authors' NBER
version. **Verified absent** (checked by grep, recorded because their absence is itself informative): the
paper reports **no numeric gross error rate, false positive rate or false negative rate** anywhere in the
main text, and reports **no inter-rater agreement among the human auditors** despite double-coding 25
percent — treat any specific accuracy percentage quoted elsewhere as unverified. Also verified absent: **no
discussion anywhere of the news hole, editorial crowd-out, attention/salience bias, declining circulation, or
newsroom staffing** as threats to the index. The scaling step handles volume drift mechanically, but the
paper never engages the attention-bias critique on its own terms.

## 12.12 Bloom — Uncertainty Shocks and the Region of Inaction
**Mechanism (as stated).** Firms face **nonconvex adjustment costs** — partial irreversibility (capital
resale loss, per-capita hiring and firing costs) plus fixed disruption costs, both entering via indicator
functions. These generate a **region of inaction** in (A/K, A/L) space with A a composite business-conditions
index. Verbatim: "Firms only hire and invest when business conditions are sufficiently good, and only fire
and disinvest when they are sufficiently bad. When uncertainty is higher, this region of inaction expands,
firms become more cautious in responding to business conditions." The investment band is wider than the
hiring band because capital adjustment costs are larger. Magnitude of the real-options wedge: moving from low
to high uncertainty is equivalent to a **25 percent wage cut** for the marginal hiring decision and a **700
basis point interest rate cut** for the marginal investment decision. *Second effect, policy
ineffectiveness:* after the shock the thresholds jump outward, so no units sit near a threshold and the
economy goes insensitive to prices. Feeding in the actual estimated factor-price responses (interest rates
down up to 1.1 points, prices down 0.5 percent, wages down 0.3 percent) produces almost no immediate output
effect, peaking at 3-5 months when the shock has already faded. Since the shock is worth ~700bp, a 110bp cut
cannot pull the thresholds back. His conclusion: "This cautions against using first-moment policy levers to
respond to the second-moment component of shocks."
**Math / Algorithm.** *The measure is the VXO, not the VIX* — implied volatility on a hypothetical
at-the-money **S&P100** option, **30 days to expiration**, from **1986** onward. Before 1986 the series is the
**monthly standard deviation of daily S&P500 returns, normalized to the same mean and variance as the VXO
over the 1986-onward overlap**; the two correlate **0.874** on the overlap. Figure 1 caps monthly values at 50
for display; true peaks are 58.2 (Black Monday) and 64.4 (credit crunch).
*Shock identification:* months where volatility exceeds **1.65 standard deviations above the Hodrick-Prescott
detrended mean**, **λ = 129,600**. The 1.65 is the 5 percent one-tailed level treating each month as
independent. The threshold is applied to the *detrended* series while Figure 1 plots the raw one.
*VAR:* monthly, **June 1962 - June 2008**, Cholesky-identified, 8 variables ordered log S&P500, volatility
shock indicator, Fed Funds rate, log average hourly earnings, log CPI, hours, log employment, log industrial
production; all HP-detrended with λ = 129,600 except the 0/1 indicator; **12 lags**.
**Key parameters.** **17 shocks** in the published Econometrica paper; the 2007 NBER working paper lists
**16** (the credit crunch is the addition) — do not treat the versions as interchangeable. Proxy validation
(Table I), volatility regressed on four independent dispersion measures normalized to unit sd: firm pretax
profit growth dispersion **0.532**, firm stock return dispersion **0.543**, industry TFP growth dispersion
**0.429**, Livingston GDP forecast dispersion **0.614** — so the average 2.47 sd volatility rise after a shock
maps to a 1.31 sd rise in the cross-sectional spread of profit growth.
**Key findings.** Stated magnitudes: "Industrial production displays a rapid fall of around 1% within 4
months, with a subsequent recovery and rebound from 7 months after the shock," significant at 5 percent. The
paper prints **no separate numeric magnitude for employment**, saying only "similar." Orthogonalized IRF
values recovered from the author's own replication data (`irf.dta`, specification `kitchen`), industrial
production / employment: month 2 −0.90 / −0.49; **month 4 −0.98 (IP trough) / −0.60**; **month 5 −0.69 /
−0.68 (employment trough)**; month 7 +0.10 / −0.20; **month 9 +1.15 (IP peak) / +0.14**; month 13 +0.93 /
**+0.33 (employment peak)**. The IP overshoot (+1.15) actually exceeds the initial drop (−0.98) in absolute
terms, which the paper's "milder long-run overshoot" understates.
*The contrast that does the identification work:* a 1 percent Fed Funds impulse produces "a much more
persistent drop and recovery of up to 0.7% over the subsequent 2 years," with the introduction putting
first-moment dynamics at 2-3 years. Second- and first-moment shocks have **qualitatively different shapes** —
sharp drop plus rebound plus overshoot within ~6 months, versus a slow persistent decline over years. Bad
news alone cannot generate the overshoot. Bloom also orders stock *levels* first in the VAR so levels are
pre-controlled, reports low correlations between the volatility indicator and detrended stock levels (−0.192
main, −0.136 exogenous subsample, −0.340 continuous volatility index), and re-runs on war/oil/terror events
only. *Two mechanisms, separated:* the *uncertainty* effect (expectations, instant, drop and return to trend)
and the *volatility* effect (realized, delayed, level overshoot via a right-skewed cross-sectional density
making hiring locally convex) are decoupled in Figure 9. "The uncertainty drop always precedes the volatility
overshoot."
**Primary sources.** Bloom, Nicholas 2009, "The Impact of Uncertainty Shocks," *Econometrica* 77(3):623-685,
DOI 10.3982/ECTA6248.
**Confidence.** [paper-verified] for mechanism, VXO splice, HP λ, VAR specification and stated magnitudes,
from the published typeset PDF plus the author's replication package. **Replication-derived, not printed in
the article:** the exact IRF values above (figures only in the paper) and the VAR lag length of 12 (from the
working paper and `lags(1(1)12)` in the code). **Unresolved discrepancy:** the text refers to "the 10
exogenous shocks arising from wars, OPEC shocks, and terror events" but Table A.1 sums to 9 (Terror 3, War 4,
Oil 2) — do not present 10 as derivable from the table. **Verified absent:** no discussion anywhere of risk
aversion, risk premia or the variance risk premium as a confound for implied volatility, and no explicit
caveat on volatility being endogenous to the real economy. Those objections belong to 12.13.

## 12.13 Jurado, Ludvigson & Ng — Uncertainty as the Unforecastable Component (the critique entry)
**Mechanism (as stated).** The premise: "what matters for economic decision making is not whether particular
economic indicators have become more or less variable or disperse per se, but rather whether the economy has
become more or less predictable; that is, less or more uncertain." The central objection, verbatim:

> "The proper measurement of uncertainty requires removing the forecastable component E[y_jt+h | I_t] before
> computing conditional volatility. **Failure to do so will lead to estimates that erroneously categorize
> forecastable variations as 'uncertain.'** Thus, uncertainty in a series is not the same as the conditional
> volatility of the raw series where, for example, a constant mean is removed: it is important to remove the
> entire forecastable component. While this point may seem fairly straightforward, it is worth noting that
> almost all measures of stock market volatility (realized or implied) or cross-sectional dispersion
> currently used in the literature do not take this into account."

**A quantity can be highly variable and perfectly predictable, and that variability is not uncertainty.**
Mechanism-specific objections: stock volatility moves with leverage, risk aversion and sentiment without any
change in fundamentals uncertainty; the VIX "has a large component that appears driven by factors associated
with time-varying risk-aversion rather than economic uncertainty" (citing Bekaert-Hoerova-Duca, not their own
decomposition); cross-sectional dispersion can move purely from heterogeneous factor loadings or
heterogeneous cyclicality, and "has no forward looking component; it is the same for all horizons";
forecaster disagreement "could be more reflective of differences in opinion than of uncertainty." Second
conceptual point: macro uncertainty is not the uncertainty in any one series but "a measure of the common
variation in uncertainty across many series," since purely idiosyncratic variance would not move aggregates.
**Math / Algorithm.** Eq. (1): **U_jt(h) = sqrt( E[ (y_j,t+h − E[y_j,t+h | I_t])² | I_t ] )** — the
conditional expectation of the **squared forecast error**, not the conditional volatility of the raw series.
Aggregate uncertainty U_t(h) = E_w[U_jt(h)], eq. (2). Construction: **132 macro series + 147 financial series
= 279** used to estimate factors, 1960:1-2011:12, estimates 1960:7-2011:12 (618 observations). **Critical
asymmetry:** uncertainty is computed from the **132 macro series only**; the 147 financial series enter as
*predictors*, never as uncertainty targets. Stated reason (fn. 8): otherwise "their greater volatility will
dominate the uncertainty measure and we will get back an aggregate financial market volatility variable as
uncertainty." Factors: static principal components, Bai-Ng (2002) criterion selects **12 factors** explaining
~54 percent of variation (first three: 37, 8, 3 percent). Forecasting model: factor-augmented diffusion index
regression including **squares of the first factor and factors extracted from squared raw data**; Bai-Ng
(2008) hard thresholding retains a predictor only if |t| > **2.575**; four lags of the dependent variable
always included. Stochastic volatility on the forecast-error residuals, **AR(1) in log volatility**,
log(σ_t)² = α + β log(σ_{t−1})² + τη_t, by **Bayesian MCMC** (R `stochvol`), chosen over GARCH specifically
because SV "permits the construction of a shock to the second moment that is independent of innovations to
y_j itself." Aggregation: **equal-weighted average** (eq. 12), with a first-principal-component alternative
giving similar results. Horizons h = 1, 3, 12 months.
**Key findings.** *Rarity:* "consider the 17 uncertainty dates defined in Bloom (2009)... By contrast, in a
sample extending from 1960:7 to 2011:12, our measure of macro uncertainty exceeds (or comes close to
exceeding) 1.65 standard deviations from its mean a total of only **49 (out of 618) months**, each of which
are bunched into three deep recession episodes" — **1973-74, 1981-82, 2007-09**. Two honesty caveats: at
h = 3 and h = 12 it is only *two* episodes; and under Bloom's own HP-trend convention rather than the
unconditional mean, theirs yields 5 episodes rather than 3, still against Bloom's 17. *Persistence* (Table 1,
monthly): their measure **AR(1) 0.99, half-life 53.58 months**; VXO **AR(1) 0.85, half-life 4.13 months**;
cross-sectional stock return dispersion 0.70 and 1.92 months. More persistent than every proxy at every
frequency tested. *Correlation with VXO 0.45* (figure note; text says "around 0.5"); correlation with
industrial production growth −0.62/−0.61/−0.57 versus VXO's −0.32. *Real effects are substantially LARGER,
not smaller* — 11-variable monthly VAR, 12 lags, Cholesky with uncertainty ordered **last** (the conservative
ordering), maximum share of forecast error variance (Table 3): U_t(12) production **28.54**, employment
**31.00**, hours **12.34**; VXO **6.93 / 7.64 / 2.32**. "Uncertainty shocks are associated with **over four
times** the variation in production and employment and **over five times** the variation in hours compared to
VXO shocks." Effects persist past 60 months; Fed Funds shocks in the same VAR explain at most 28.96 percent
of production, so uncertainty is roughly as important as monetary policy shocks. *Dispersion proxies fail
even the sign test:* shocks to firm profit dispersion and to GDP forecast dispersion make production and
employment **rise**. *A direct hit on 12.12:* they find no statistically significant volatility overshoot for
any measure including VXO, and fn. 22 states: "After a careful inspection of the code kindly provided by
Bloom, we find that **contrary to a statement in the paper, Bloom (2009) HP filters all data in the VAR for
these impulse responses except the VXO Index.**" Their objection is that the HP filter uses whole-sample
information, so observation timing becomes hard to interpret — structurally the same objection as their
forecastable-component critique: **do not let information unavailable at time t leak into your time-t
measure.**
**Key parameters.** 132 macro + 147 financial = 279 series; 618 observations; 12 factors; t-threshold 2.575;
h = 1, 3, 12; 49/618 high-uncertainty months; half-life 53.58 months.
**Primary sources.** Jurado, Kyle, Sydney C. Ludvigson, and Serena Ng 2015, "Measuring Uncertainty,"
*American Economic Review* 105(3):1177-1216, DOI 10.1257/aer.20131193.
**Confidence.** [paper-verified] from the full published AER text. **Scope correction recorded to prevent
over-citation:** there is **no empirical comparison of JLN to the EPU index anywhere in the paper** — no
correlation, no VAR, no figure, no table. BBD is cited once in a footnote list, and news-based measures
appear substantively exactly once, in the opening list of proxies ("the appearance of certain
'uncertainty-related' key words in news publications"). Their general critique plainly *applies* to a news
keyword count (it has no forward-looking component and removes no forecastable variation), but **that
extension is inference, not their published claim.** Two further cautions: the rarity result is partly a
consequence of the aggregation choice (they excluded the 147 financial series precisely because those would
dominate), and they state that their results "are silent on whether uncertainty is the cause or effect" of
declines.

## 12.14 Loughran & McDonald — Why Generic Word Lists Fail in a Specialized Domain
**Mechanism (as stated).** "We find that almost three-fourths (**73.8%**) of the negative word counts
according to the Harvard list are attributable to words that are typically not negative in a financial
context." Nuance most citations get wrong: 73.8% is a fraction of the negative word **count** (token
occurrences in the corpus), not of distinct list entries — cite it as occurrence-weighted misclassification.
**Two distinct damage mechanisms**, carefully separated: (1) **Attenuation** — misclassified words
uncorrelated with the outcome (tax, liability) "simply add noise to the measurement of tone and thus
attenuate the estimated regression coefficients." (2) **Type I error** — words like "mine" or "cancer" "could
introduce type I errors into the analysis to the extent that they proxy for industry segments or firm
attributes," so part of the apparent power of a generic list in prior work may be the list silently proxying
for industry. Concrete cases: "mine" is the most common Harvard negative word for precious metals and coal,
and in Coeur d'Alene Mines' 1999 10-K alone "accounts for over 25% of all the H4N-Inf negative word counts";
"cancer" ranks tenth in pharmaceuticals; "capital" is "by far the most common negative word" for banking. The
top seven Harvard negatives in 10-Ks (tax, costs, loss, capital, cost, expense, expenses) account for over a
quarter of all negative counts. Zipf's law is invoked explicitly as the structural reason a handful of words
dominates any list.
**Math / Algorithm.** Term weighting, Eq. (1), §II.E. With N total documents, df_i documents containing word
i, tf_i,j the raw count of word i in document j, and a_j the average word count in document j:

    w_i,j = [ (1 + log(tf_i,j)) / (1 + log(a_j)) ] × log(N / df_i)   if tf_i,j ≥ 1;  0 otherwise

Their reading: the first term "attenuates the impact of high frequency words with a log transformation"
(*loss* appears 1.79 million times, *aggravates* 10 times; the collective impact of *loss* is surely not
179,000 times greater); the second "modifies the impact of a word based on its commonality" (*loss* appears
in over 90 percent of documents so the idf term cuts it by more than 90 percent, while *aggravates* is
multiplied by roughly eight). The a_j document-length denominator is **their modification** to textbook
tf-idf, added because "since we are comparing different documents, length matters."
**Key parameters.** Sample: 50,115 10-K filings, 1994-2008, 8,341 firms, ~2.5 billion words. **Six** lists in
the 2011 paper (constraining was added later): Fin-Neg **2,337**; Fin-Pos **353**; Fin-Unc **285**; Fin-Lit
**731**; modal-strong 19; modal-weak 27; H4N-Inf (their inflected Harvard) 4,187 from 2,005 roots. The
uncertainty list, closest to a stress use case, verbatim: "The Fin-Unc list includes words denoting
uncertainty, with emphasis on the general notion of imprecision rather than exclusively focusing on risk. The
list includes 285 words, such as approximate, contingency, depend, fluctuate, indefinite, uncertain, and
variability." Weak modal words (could, depending, might, possibly) are a genuinely **separate** list, so
epistemic hedging via modality is measured apart from lexical imprecision. The lists overlap heavily and the
authors warn against using them jointly due to collinearity.
**Key findings.** Validation by 60 quarterly Fama-MacBeth regressions, Newey-West errors, 48 industry
dummies, controls for size, book-to-market, turnover, pre-filing alpha, institutional ownership, NASDAQ.
**Fin-Unc is the strongest single list for filing-period returns**, coefficient −42.026 (t = −4.13), beating
Fin-Neg (−19.538, t = −2.64) — uncertainty outperformed negativity, which is underappreciated. **The result
that should change how the paper is read:** under proportional weighting the generic Harvard list is
insignificant for filing returns (t = −1.35) while Fin-Neg is significant (t = −2.64), but under tf-idf
weighting **both become significant and essentially identical** (−0.003, t = −3.16 versus −0.003, t = −3.11).
Their words: "The term weighting method, however, mitigates the noise in both measures, especially for the
H4N-Inf measure, to an extent that the Fin-Neg list does not dominate." So **term weighting, not the
dictionary swap, is what recovers statistical power**; the residual case for the domain-specific list is the
type I error / industry-proxy argument, not incremental explanatory power. Most citations get this backwards.
Other results: post-event return volatility is positive and significant for **all** lists under tf-idf, the
strongest and most uniform result in the paper; abnormal trading volume positive and significant. Two nulls
they report plainly: the **long-short trading strategy produces no significant alpha**, and restricting to
the **MD&A section does not improve signal** over the full 10-K.
**The most transferable warning.** Their standardized-unexpected-earnings result has the **opposite sign**
from Tetlock, Saar-Tsechansky & Macskassy (2008) on news. Their explanation is authorship: "More negative
words used by independent journalists indicate pessimism... When insiders are the document's authors, more
negative words... point to more positive subsequent earnings surprises." So **lexicon transfer across domains
fails on vocabulary, and transfer across authorship roles can fail on sign, even when the vocabulary holds.**
The summary sentence: "financial researchers should be cautious when relying on word classification schemes
derived outside the domain of business usage. Applying nonbusiness word lists to accounting and finance
topics can lead to a high misclassification rate and spurious correlations. All textual analysis ultimately
stands or falls by the categorization procedures."
**Primary sources.** Loughran, Tim, and Bill McDonald 2011, "When Is a Liability Not a Liability? Textual
Analysis, Dictionaries, and 10-Ks," *Journal of Finance* 66(1):35-65, DOI 10.1111/j.1540-6261.2010.01625.x.
**Confidence.** [paper-verified] from the full published typeset text, including the corrected 2011 list
counts (285 uncertainty, 731 litigious — later versions differ, and 297/871 are later-version numbers).

## 12.15 Guttal, Raghavendra, Goel & Hoarau — Critical Slowing Down Does NOT Transfer to Markets
**Mechanism (as stated).** A direct test of whether the Scheffer-style early-warning framework (Creator 10)
holds in financial markets. Three indicators were tested: **lag-1 autocorrelation** (the canonical
critical-slowing-down indicator), **variance** of detrended residuals, and **power spectral density at low
frequencies** (average spectrum up to 1/8 of all frequencies).
**Math / Algorithm.** Standard EWS estimation on detrended residuals over rolling windows; markets DJI, S&P
500, NASDAQ (crashes of 1929, 1987, 2000, 2008, plus 1-minute high-frequency data) and DAX, FTSE (2000,
2008).
**Key findings.** *What failed:* "autocorrelation at lag-1 … a key measure of critical slowing down, showed
either no or weak trends" before any crash. Their conclusion is that financial crashes "are not critical
transitions that occur in the vicinity of a tipping point." *What worked:* "All markets showed strong trends
of rising variability, quantified by time series variance and spectral function at low frequencies, prior to
crashes," and "all important recorded stock market crises in DJI were preceded by EWS in variance and power
spectrum at least three months in advance." *False alarms:* **seven** — rising variability occurred without a
subsequent crash seven times.
**Key parameters.** Three indicators; five indices; four US crash episodes plus two European; low-frequency
spectral band = up to 1/8 of all frequencies; ≥3-month lead for the variance/spectrum signals; 7 false
positives.
**Primary sources.** Guttal, Vishwesha, Srinivas Raghavendra, Nikunj Goel, and Quentin Hoarau 2016, "Lack of
Critical Slowing Down Suggests that Financial Meltdowns Are Not Critical Transitions, yet Rising Variability
Could Signal Systemic Risk," *PLOS ONE* 11(1):e0144198, DOI 10.1371/journal.pone.0144198.
**Confidence.** [paper-verified] via the publisher page. Recorded here because it **bounds Creator 10**: the
autocorrelation/critical-slowing-down formulation specifically does not transfer to financial markets, while
the variance formulation does, with a stated false-alarm rate.

## 12.16 Coupling and Attention: Corroborations and Critiques
**Mechanism (as stated).** Two clusters of results that bound the entries above rather than adding a new
instrument: independent corroborations that **rising cross-correlation signals fragility**, and critiques
establishing that **news coverage volume tracks attention, not severity**.

*Rising correlation as an early-warning signal.* **Zheng, Podobnik, Feng & Li (2012)**: PCA on 10 Dow Jones
Supersector indexes, monthly returns March 2000 - June 2012, on a **moving 12-month window** (compared
against 36-month); the indicator is the **rate of change of PC1, not its level** — "The larger the peak in
the change of PC1, the higher is the systemic risk." Window length is load-bearing and they say why: "Market
crashes are associated with large shocks, but if window size is too large, large shocks are overridden by all
other signals." With 12-month windows "the steepest increase of PC1 occurred in August 2007," the month the
interbank market froze, preceding the December 2007 recession onset; the European replication peaked February
2008, "a few months later … it took time for the crisis to spread from US to Europe." **Patro, Qi & Sun
(2013)**: daily stock return correlations and default correlations among the 22 largest bank holding
companies and investment banks, 1988-2008; an increasing trend in stock return correlation among banks with
**no comparable trend among non-banks**, and — mechanistically important — the increases are largely driven
by rising correlation between banks' **idiosyncratic** risks, not common factor exposure.

*News volume tracks attention, not severity.* **Brochet, Mueller & Rauh (2025)** is the sharpest result and
produces a **sign flip**: "the standard text-based EPU index systematically declines during armed conflict
periods"; "the index declines significantly by 11 points during armed conflict"; "this decline is driven not
by reduced uncertainty, but by a **crowding out of reporting on economics and policy**"; "while U counts
spike during conflict, mentions of E and P drop sharply." And: "The pattern is not a feature of our
international news corpus but holds in the original EPU data as well." A properly scaled, human-audited,
peer-reviewed index **moves the wrong direction** under topic crowd-out. **Bae, Jo & Shim (2025)**, a formal
replication: "shocks to the index do not significantly affect the economy during the period from September
2008 to December 2019," and "this pattern is unique to the Economic Policy Uncertainty measure."
**Ghirelli, Pérez & Urtasun (2019)** document spurious EPU spikes "that cannot be associated to any relevant
policy-related historical event." **Chen, Huang, Huang & Chen (2021)**: "over 40% of news articles with the
selected keywords are not related to the EPU" (Taiwanese corpus, non-BBD keyword sets, so transfer is
imperfect). **Gentzkow, Kelly & Taddy (2019)**, the discipline survey: "there is no ground truth data on the
actual level of policy uncertainty reflected in particular articles," and they independently corroborate the
EPU scaling procedure. **Gentzkow & Shapiro (2010)**: newspaper content is a demand-driven product — "Firms
respond strongly to consumer preferences, which account for roughly 20 percent of the variation in measured
slant in our sample. By contrast, the identity of a newspaper's owner explains far less." Coverage reflects
what readers want, which is an attention process, not a severity process. **Da, Engelberg & Gao (2011)**,
attention measures reverse: "a one standard deviation increase in ASVI this week leads to a positive price
change of more than 30 basis points... during the subsequent two weeks. This initial positive price pressure
is almost completely reversed by the end of the year." Attention predicts reversible price pressure, not
fundamentals. **Google Trends as an alternative is unstable**: Cebrián & Domènech (2024) — "the same query
produces different results that can widely change from day to day"; Eichenauer, Indergand, Martínez & Sax
(2022) — "raw data are frequency-inconsistent: daily data fail to capture long-run trends. This issue has
gone unnoticed in the literature"; Rovetta (2024) — "Google Trends improvements have altered the RSV
historical trends."
**Primary sources.** Zheng, Z., B. Podobnik, L. Feng, and B. Li 2012, "Changes in cross-correlations as an
indicator for systemic risk," *Scientific Reports* 2:888, DOI 10.1038/srep00888 (open access). Patro, Dilip
K., Min Qi, and Xian Sun 2013, "A simple indicator of systemic risk," *Journal of Financial Stability*
9:105-116. Brochet, Mueller & Rauh 2025, "Uncovering Economic Policy Uncertainty During Conflict," Cambridge
Working Papers in Economics 2551. Bae, Jo & Shim 2025, "Does Economic Policy Uncertainty differ from other
uncertainty measures? Replication of Baker, Bloom, and Davis (2016)," *Canadian Journal of Economics*
58(1):40-74. Ghirelli, Pérez & Urtasun 2019, *Economics Letters* 182:64-67. Chen, Huang, Huang & Chen, CIKM
'21. Gentzkow, Kelly & Taddy 2019, "Text as Data," *Journal of Economic Literature* 57(3):535-574. Gentzkow &
Shapiro 2010, "What Drives Media Slant? Evidence from U.S. Daily Newspapers," *Econometrica* 78(1):35-71. Da,
Engelberg & Gao 2011, "In Search of Attention," *Journal of Finance* 66(5):1461-1499. Cebrián & Domènech
2024, *Technological Forecasting and Social Change* 202:123318. Eichenauer, Indergand, Martínez & Sax 2022,
*Economic Inquiry* 60(2):694-705. Rovetta 2024, *International Journal of Medical Informatics* 190:105563.
Ahir, Bloom & Furceri, World Uncertainty Index, NBER WP 29763 (**not** Davis — a common misattribution).
**Confidence.** [paper-verified] for Zheng et al. (via PMC full text), the EPU critiques, Gentzkow-Shapiro,
and the Google Trends instability findings. **Brochet, Mueller & Rauh is [paper-verified but NOT peer
reviewed]** — cite as emerging. [partially-verified]: Patro/Qi/Sun and Da/Engelberg/Gao (abstract or
near-final-draft level only). **[unverified], explicitly not retrieved this pass, do NOT cite from this
document:** the classical attention literature — Cutler, Poterba & Summers (*Journal of Portfolio Management*
1989), Shiller "Narrative Economics" (*AER* 2017), Tetlock (*JF* 2007; *RFS* 2011), Huberman & Regev (*JF*
2001), and Eisensee & Strömberg (*QJE* 2007, the news-pressure/crowd-out instrument). The Eisensee-Strömberg
mechanism is the one most wanted and the one not confirmed; its structural claim is however independently
corroborated by Brochet-Mueller-Rauh above, so the crowd-out mechanism itself is on solid footing even though
the disaster-relief magnitudes are not. **Also verified absent after full search, do not use:** any paper
showing newspaper slant *drifting over time* biases EPU, any paper linking declining circulation or newsroom
staffing to index bias, and any published Comment or Reply on BBD 2016. BBD's own slant check is a static
whole-sample correlation of 0.92, which is **not** a test of drift.

### Verification note (Creator 12)
All sixteen entries rest on local text extraction (`pdftotext -layout` / `pypdf`) of primary PDFs, not on
fetch-tool summaries. This is not a stylistic preference: during research **two fetch-tool PDF summaries
returned fabricated content**, one asserting that Illing & Liu used principal component analysis and
LIBOR-OIS spreads — false, and anachronistic in the second case. Any future extension of this section should
assume tool-generated summaries of paywalled economics PDFs are unreliable and verify against extracted text.
Items that could not be confirmed are flagged inline as `[partially-verified]` or `[unverified]` rather than
smoothed over, and four entries additionally record **verified absences** (claims a paper does *not* make),
because in this literature the absent claim is frequently the one attributed to the paper by others: BBD
report no numeric error rates and never discuss attention bias; Bloom never discusses risk premia as a
confound; JLN never empirically compare to EPU; Billio et al. make no numeric lead-time claim and treat
1994-1996 as a tranquil baseline, not a crisis.


# Creator 13 — The Isomorphism: Stress as Precision-Weighted State Estimation (the LIMEN thread)

This section is different from Creators 1-12. Those record mechanisms as their authors state them, one field at a
time. This one documents the **single mathematical object that appears in both the neuroscience of Creators 1-9 and
the economics of Creator 12**, because that shared object is the thread the whole LIMEN stress model runs on. The
claim, stated once and then sourced:

> **Stress is a latent state. The channels that report on it (in the brain: sensory afferents; in a market: the
> indicators; in LIMEN: node-numbers and news) are noisy sensors. Both the brain and the economist estimate that
> hidden state by the SAME operation — recursive optimal estimation that weights each sensor by its reliability
> (precision = inverse variance = Kalman gain). Reliability-weighting is not a metaphor shared across the two
> fields; it is the identical algebra, and both fields adopted it from the same control-theory root.**

**HONESTY BANNER, read before citing.** No single published paper asserts, in one sentence, that "the brain's state
estimator and the economist's dynamic-factor estimator are the same object." The three research passes behind this
section searched for that sentence and did not find it; presenting a quotation to that effect would be fabrication.
What IS paper-verified, and what this section rests on, is the weaker but sufficient set of facts that force the
conclusion: (i) both fields write the identical state-space pair; (ii) both estimate the latent state with the
identical inverse-variance gain; (iii) each field, in its own literature, names the Kalman filter explicitly as the
estimator it adopted. The isomorphism is therefore LIMEN's **synthesis grounded in shared equations**, not a claim
lifted from a source. That distinction is the difference between a defensible thesis and a fabricated authority, and
it is kept throughout.

## 13.1 The shared object — Kalman 1960, and why the gain is inverse-variance weighting
**Mechanism (as stated).** Kalman's 1960 paper replaces the Wiener-Kolmogorov integral approach with a RECURSIVE
state-space filter that estimates a hidden state x_t from noisy observations y_t. Verbatim opening: "FILTERING is the
process of estimating the current value of a … stochastic signal, using the history … of another (observed)
stochastic process (so-called measurement process) which is correlated with it." His Theorem 2 proves the optimal
estimate is the orthogonal projection of x onto the span of past observations — i.e. the conditional expectation
under Gaussian assumptions.
**Math / Algorithm.** State and observation equations (Kalman's eqs. 16-17, verbatim symbols):
    x(t+1) = Φ(t+1;t) x(t) + u(t)          (state / "message")
    y(t)   = M(t) x(t)                       (observation / "measurement")
Optimal-estimate recursion (eqs. 21-30): x*(t+1|t) = Φ*(t+1;t) x*(t|t−1) + Δ*(t) y(t), with the GAIN
Δ*(t) = Φ(t+1;t) P*(t) M'(t) [M(t) P*(t) M'(t)]⁻¹ and the error-covariance Riccati recursion
P*(t+1) = Φ*(t+1;t) P*(t) Φ'(t+1;t) + Q(t). In the modern (measurement-noise R present) discrete form:
    innovation      v_t = y_t − H x̂_{t|t−1}
    innovation cov   S_t = H P_{t|t−1} Hᵀ + R
    GAIN            K_t = P_{t|t−1} Hᵀ S_t⁻¹
    update          x̂_{t|t} = x̂_{t|t−1} + K_t v_t
**The load-bearing identity.** In the scalar case (H = 1, prediction variance P, measurement variance R):
    K = P / (P + R) = (1/R) / (1/P + 1/R)
so the posterior mean is exactly the **inverse-variance-weighted average** of the prior prediction and the new
measurement. K is the fraction of trust placed on new evidence = its relative precision. A noisy sensor (large R)
gets a small gain. This one line is the entire conceptual content the two fields share.
**Key parameters.** A/Φ (transition), H/M (observation loadings), Q (process-noise cov), R (measurement-noise cov),
P (error cov, Riccati), K/Δ (gain).
**Primary sources.** Kalman, R.E. 1960, "A New Approach to Linear Filtering and Prediction Problems," *Transactions
of the ASME – Journal of Basic Engineering* 82(D):35-45, DOI 10.1115/1.3662552.
**Confidence.** [paper-verified] — eqs. 16-17, 21-30 read visually from a scanned original reprint. One honest
detail recorded: **Kalman's 1960 base observation equation y = Mx has NO measurement-noise term**, so his inverse is
[M P M']⁻¹ with no R; the textbook `+R` form is the later-codified discrete filter (and Kalman-Bucy 1961 for the
noisy continuous case). Both are the same object; R = 0 collapses one to the other. The exact `+R` gain is sourced
verbatim from the economics side (13.4, ADS 2009), where R is present.

## 13.2 The common root — Wiener's cybernetics, "the animal and the machine"
**Mechanism (as stated).** The reason the two fields rhyme is that they descend from one program. Wiener's 1948
*Cybernetics* proposes a single theory of control-and-communication spanning, in the book's own subtitle, "the
Animal and the Machine." Wiener's optimal-linear-prediction theory (Wiener-Kolmogorov, 1940s) is exactly what
Kalman 1960 supersedes — Kalman verbatim names "the Wiener-Kolmogorov theory" as the prevailing approach he
replaces. The lineage is therefore literal, not analogical:
    Wiener 1948 (control uniting animal + machine) → Wiener-Kolmogorov optimal prediction → Kalman 1960 recursive
    state estimator → adopted BY economics (dynamic factor models, 13.4) AND BY neuroscience (13.3).
**Primary sources.** Wiener, Norbert 1948, *Cybernetics: or Control and Communication in the Animal and the
Machine*, MIT Press / Hermann / Wiley. (See also Creator 8, which carries Wiener's regulation lineage.)
**Confidence.** [paper-verified] for the subtitle and the Wiener→Kalman supersession (Kalman names Wiener-Kolmogorov
verbatim). The interpretation that this common root is *why* both later fields converged is LIMEN's synthesis.

## 13.3 The neuroscience adoption — the brain runs the filter
**Mechanism (as stated).** Three independent primary results establish that perceptual and motor inference in the
brain IS optimal state estimation, with precision (inverse variance) playing the role of the Kalman gain.
- **Wolpert, Ghahramani & Jordan 1995** — the cleanest "the CNS uses a Kalman filter" statement. Verbatim: "we chose
  to use a Kalman filter observer, which is a linear dynamical system that produces an estimate of the location of
  the hand by using both the motor outflow and sensory feedback in conjunction with a model of the motor system."
  Their state-update equation is printed with the two terms labelled "Forward model" and "Sensory correction":
      x̂(t) = A x(t) + B u(t) + K(t)[y(t) − C x(t)]
  and verbatim: "The relative contributions of the internal simulation and sensory correction processes to the final
  estimate are modulated by the Kalman gain so as to provide optimal state estimates." The gain shifts weight from
  forward model to sensory feedback as the state estimate's reliability changes — exactly reliability-weighting.
- **Rao & Ballard 1997** — predictive coding formalized as an extended Kalman filter. Verbatim: cortical dynamics
  "assume the form of an extended Kalman filter … which optimally estimates current recognition state by combining
  information from input-driven bottom-up signals and expectation-driven top-down signals," yielding "modeling of the
  visual cortex as a hierarchical Kalman predictor." (The 1999 Nature Neuroscience paper is the same model; Friston
  2005 verbatim confirms it "uses Kalman filtering.")
- **Friston 2005 / 2008 & Bastos et al. 2012** — precision IS the inverse-variance weight on prediction error, and
  reduces to the Kalman gain. Friston 2005 verbatim: "precision is the inverse of variance." Bastos 2012 verbatim:
  "prediction errors are weighted by their precision (inverse variance) … Under linear models, it reduces to linear
  predictive coding, also known as Kalman-Bucy filtering," and precision "controls the postsynaptic sensitivity or
  gain" — i.e. precision-weighting is realized as synaptic gain, the Kalman gain in cortex. Also Todorov & Jordan
  2002, verbatim: optimal motor control requires "an internal state estimate obtained by a forward model (a Kalman
  filter)."
**Math / Algorithm.** Identical to 13.1. In predictive coding the update is gradient descent on precision-weighted
squared prediction error ξ = P·ε (Bastos eq. 1), with P = Σ⁻¹ the precision; under linear-Gaussian assumptions this
is the Kalman filter. In the motor case (Wolpert, Todorov) it is the Kalman observer explicitly.
**Key parameters.** Prediction vs prediction error; precision P (= inverse variance = gain); forward model / top-down
prediction; sensory correction / bottom-up error.
**Primary sources.** Wolpert, Ghahramani & Jordan 1995, *Science* 269(5232):1880-1882. Rao & Ballard 1997, "Dynamic
model of visual recognition…," *Neural Computation* 9(4):721-763; Rao & Ballard 1999, *Nature Neuroscience*
2(1):79-87. Friston 2005, "A theory of cortical responses," *Phil Trans R Soc B* 360(1456):815-836; Friston 2008,
"Hierarchical models in the brain," *PLoS Comput Biol* 4(11):e1000211. Bastos et al. 2012, "Canonical microcircuits
for predictive coding," *Neuron* 76(4):695-711. Todorov & Jordan 2002, *Nature Neuroscience* 5(11):1226-1235.
**Confidence.** [paper-verified] for the Wolpert 1995, Rao & Ballard 1997, Friston 2005, Bastos 2012 and Todorov 2002
verbatim quotes (all read from locally-extracted primary PDF text). [partially-verified] for the internal wording of
Rao & Ballard 1999 (paywalled; corroborated by the 1997 primary and by Friston 2005's verbatim citation of it "using
Kalman filtering").

## 13.4 The economics adoption — the market's stress index runs the SAME filter
**Mechanism (as stated).** The state-space dynamic factor model is the Kalman filter applied to economics: a
low-dimensional LATENT state (business or financial conditions) estimated from many noisy mixed-frequency
indicators, each weighted by its signal reliability. This is not a loose parallel; the estimator is the same object
as 13.1 and 13.3.
- **Aruoba, Diebold & Scotti 2009** — the cleanest exact match to the `K = P Hᵀ(HPHᵀ+R)⁻¹` gain, in a peer-reviewed
  economics paper. Verbatim: "We work with a dynamic factor model, treating business conditions as an unobserved
  variable, related to observed indicators," and the estimator "amounts to a filtering problem with a large amount of
  missing data, which the Kalman filter is optimally designed to handle … we use the Kalman filter and smoother to
  obtain optimal extractions of the latent state of real activity." Their update (eqs. 12-17):
      a_{t|t} = a_t + P_t Z_t' F_t⁻¹ v_t,   v_t = y_t − Z_t a_t − Γ_t w_t,   F_t = Z_t P_t Z_t' + H_t
  so the gain K_t = P_t Z_t' (Z_t P_t Z_t' + H_t)⁻¹ is **identical in form to the Kalman gain** with Z_t ≡ H
  (indicator loadings) and H_t ≡ R (indicator noise). A noisy indicator (large H_t) gets a small gain — inverse-
  variance weighting, the same rule the brain uses in 13.3. Operationalized live as the Philadelphia Fed's ADS
  Business Conditions Index.
- **Doz, Giannone & Reichlin 2011 / 2012** — the estimators behind the Chicago Fed NFCI (Creator 12, §12.3). The 2011
  title is itself the adoption statement: "A two-step estimator for large approximate dynamic factor models **based
  on Kalman filtering**." Both estimate a latent common factor from a large panel of noisy indicators via the Kalman
  filter/smoother (2011 = PCA-initialized two-step; 2012 = QML via the Kalman-filter likelihood + EM). The **NFCI is
  the Kalman-smoothed factor estimate** over ~105 indicators. So the same production stress index catalogued in
  Creator 12 as "dynamic factor, QML-EM" is, precisely, the brain's estimator pointed at markets.
**Math / Algorithm.** Identical to 13.1, with H = indicator loadings, R = indicator-noise covariance. The latent
state is "financial/business conditions"; in LIMEN the latent state is a domain's stress.
**Key parameters.** Latent factor (the stress state); indicator loadings Z/H; indicator-noise covariance H_t/R
(sets each indicator's gain); Kalman-smoothed factor = the published index.
**Primary sources.** Aruoba, Diebold & Scotti 2009, "Real-Time Measurement of Business Conditions," *J. Bus. Econ.
Stat.* 27(4):417-427. Doz, Giannone & Reichlin 2011, *J. Econometrics* 164(1):188-205; 2012, *Rev. Econ. Stat.*
94(4):1014-1024. Chicago Fed NFCI (Brave & Butters; see Creator 12 §12.3). Antecedent: Stock & Watson dynamic factor
/ coincident-index work (1989, 1991, 2002).
**Confidence.** [paper-verified] for ADS 2009 (latent state + Kalman + eqs. 12-17), the DGR citations and titles, and
NFCI = Kalman-smoothed factor. [partially-verified] for the Stock-Watson antecedents (confirmed via ADS's verbatim
citation, originals not re-extracted).

## 13.5 The cue-combination bridge — the fusion rule LIMEN needs, stated as an equation
**Mechanism (as stated).** Between "the brain runs a Kalman filter" and "weight numbers vs news" sits the
cue-combination literature, which gives the two-sensor fusion rule in closed form and proves humans use it. This is
the direct answer to how LIMEN should combine its two channels.
- **Ernst & Banks 2002** — the foundational result. Verbatim: "a general principle, which minimizes variance in the
  final estimate, determines the degree to which vision or haptics dominates. This principle is realized by using
  maximum-likelihood estimation." The fusion formula (their eq. 2, verbatim):
      Ŝ = Σ_i w_i Ŝ_i,   w_i = (1/σ_i²) / (Σ_j 1/σ_j²)
  and the variance-reduction guarantee (eq. 3): σ²_combined = (σ_V² σ_H²)/(σ_V² + σ_H²) < either input. Confirmed
  empirically: measured visual-haptic weights and thresholds matched the MLE prediction, combined threshold always
  below either alone.
- **Alais & Burr 2004** — the audiovisual (ventriloquist) version, and the cleanest demonstration of the LIMEN point
  that the unreliable channel is DOWN-WEIGHTED. Verbatim: "the ventriloquist effect is a specific example of optimal
  combination of visual and auditory spatial cues, where each cue is weighted by an inverse estimate of its
  variability … if the visual estimate is corrupted sufficiently by blurring … vision can become worse than audition,
  and optimal localization correctly predicts that sound will effectively capture sight." Same inverse-variance
  weights (w_A = 1/σ_A², w_V = 1/σ_V²) and same variance reduction.
- **Körding & Wolpert 2004** — the same rule when one "cue" is a learned PRIOR: the optimal estimate is the
  inverse-variance-weighted average of prior mean and sensory evidence, MSE = σ²_s σ²_p/(σ²_s+σ²_p), "always lower
  than … sensory alone." As feedback uncertainty rises, subjects rely more on the prior (F₃,₂₇ = 82.7, p < 0.001).
- **Knill & Pouget 2004** — the "Bayesian brain" framing and the neural implementation. Verbatim: the integrated
  estimate is μ_{V,A} = w_V μ_V + w_A μ_A, "the weights (w) are inversely proportional to the variances of the
  likelihood functions," and neurally, "the variance [is] inversely proportional to the gain of the hill … the cues
  are integrated with weights proportional to their reliability" — reliability = neural gain = inverse variance, the
  same quantity predictive coding calls precision.
**The LIMEN reading.** Numbers = the low-variance interoceptive channel; news = the high-variance exteroceptive/
salience channel. The body does not average or add them; it weights each by 1/σ² and the fused estimate has lower
variance than either. This is why raw feed volume failed (an unreliable channel was allowed to set the level instead
of being gain-scaled by its own noise) and why news demotes to "reference/opportunity" without being discarded (a
high-variance exteroceptive alarm is not ignored, it is precision-gated against interoception). The weighting is not
a stated prior to be guessed (as in grounded-stress.js v2's 0.45/0.30/0.25) — the correct weight for a channel is its
measured inverse variance.
**Primary sources.** Ernst & Banks 2002, *Nature* 415:429-433, DOI 10.1038/415429a. Alais & Burr 2004, *Current
Biology* 14:257-262, DOI 10.1016/j.cub.2004.01.029. Körding & Wolpert 2004, *Nature* 427:244-247, DOI
10.1038/nature02169. Knill & Pouget 2004, "The Bayesian brain…," *Trends Neurosci.* 27(12):712-719, DOI
10.1016/j.tins.2004.10.007.
**Confidence.** [paper-verified] for Ernst & Banks, Körding & Wolpert and Knill & Pouget (verbatim from primary PDF
text). [primary-equivalent] for Alais & Burr (Current Biology paywalled; equations and data quoted verbatim from
Burr & Alais's own *Progress in Brain Research* reproduction). Honest boundary recorded: **none of these four
cue-combination papers contains the word "Kalman"** — the inverse-variance-weighting-IS-Kalman-gain identity is
sourced to Wolpert 1995 and the predictive-coding literature (13.3), not to these four. The cue papers supply the
static two-sensor fusion formula; the Kalman/predictive-coding papers supply its dynamic, recursive form; they are
the same estimator at two levels of generality.

### Verification note (Creator 13)
Three parallel research passes, each verifying against locally-extracted primary PDF text rather than tool summaries
(the same discipline as Creator 12, and for the same reason — earlier fetch-tool summaries fabricated content). The
isomorphism is established by a chain every link of which is paper-verified: Kalman's recursive estimator (13.1) and
its inverse-variance gain; the Wiener root both fields descend from (13.2); the neuroscience adoption naming Kalman
explicitly (13.3, Wolpert/Rao-Ballard/Bastos/Todorov verbatim); the economics adoption naming Kalman explicitly
(13.4, ADS/DGR verbatim, and the NFCI of Creator 12 shown to BE this estimator); and the closed-form two-sensor
fusion rule with its empirical confirmation (13.5, Ernst-Banks verbatim). The ONE thing deliberately NOT claimed is a
single quoted sentence asserting the cross-disciplinary identity — it does not exist in the literature searched, and
the section is explicit that the isomorphism is LIMEN's synthesis grounded in the shared equations, not a borrowed
authority. That is the line between this being the thread the system runs on and this being a fabrication.


# Creator 14 — Clinical Diagnostic Reasoning: The Medical Intake (why the estimator is a workup)

This section documents how a clinician gathers information BEFORE committing to a diagnosis, because
that protocol is the template the domain estimator implements. A provider does not diagnose from the
chief complaint; they run a deliberately redundant, multi-channel, prior-then-update workup — a deep
probe on the presenting problem, a wide independent screen across every system, and context channels —
building a PRIOR over a RANKED hypothesis set that independent channels then update, with structural
rules engineered to prevent collapsing to one label too early. That is the fractal-feed → belief →
forward-outcome loop, in clinical form. This is why neurology/medicine maps to the business estimator:
both are diagnostic instruments, and the intake is the discipline that makes a diagnosis trustworthy.

**LIMEN-mapping banner (read first).** The clinical facts below are sourced. The mapping to LIMEN's
estimator (§14.8) is LIMEN's synthesis grounded in the shared structure, not a claim from the medical
literature. Kept distinct, same discipline as Creator 13.

## 14.1 The intake structure — a deep probe plus context (Bates)
**Mechanism (as stated).** The comprehensive history proceeds in a fixed order: Identifying data +
source/reliability → Chief Complaint (CC, in the patient's own words, explicitly NOT a diagnosis) →
History of Present Illness (HPI) → Past Medical / Surgical History → Medications → Allergies → Family
History → Social History → Review of Systems → Physical Exam → Diagnostics. Each element is a distinct
information channel weighted by source credibility; tests come LAST and selectively, because a test is
only interpretable against a prior the history has already built.
The HPI's primary framework in Bates is the **seven attributes of a symptom**: (1) Location; (2)
Quality; (3) Quantity/severity; (4) Timing (onset, duration, frequency); (5) Setting; (6) Remitting/
exacerbating (aggravating/alleviating) factors; (7) Associated manifestations — plus **pertinent
positives and pertinent negatives** from the relevant systems. The popular mnemonics are downstream
compressions of these seven, not the textbook's own scaffold:
- **OLDCARTS** — Onset, Location, Duration, Character, Aggravating/Alleviating, Radiation, Timing,
  Severity. RECORDED AMBIGUITY: the A and R letters vary across sources (A = Aggravating/Alleviating
  combined vs A = Aggravating with a separate R = Relieving; R = Radiation vs Relieving). No governing
  body fixes it; commit to one and note the other exists.
- **OPQRST** — Onset, Provocation/Palliation, Quality, Region/Radiation, Severity, Timing (often
  extended -AAA: Associated symptoms, Aggravating, Alleviating). Predominant in acute/pain/EMS.
**Key parameters.** ~10 ordered history elements; 7 symptom attributes; pertinent positives + negatives.
**Primary sources.** Bickley, Szilagyi et al., *Bates' Guide to Physical Examination and History
Taking* (Wolters Kluwer/Lippincott, current eds.).
**Confidence.** [verified] structure and the seven-attributes framework; [recalled] exact chapter
wording. The OLDCARTS/OPQRST mnemonics are standard teaching devices (Lecturio/Osmosis/nursing texts),
hard to pin to a single primary source; the A/R ambiguity is real and flagged.

## 14.2 Review of Systems — the wide independent screen
**Mechanism (as stated).** The ROS is a **systematic head-to-toe symptom checklist across EVERY organ
system, run largely independently of the chief complaint** — a screen, distinct from the deep HPI. Its
job is to catch (i) symptoms the patient did not volunteer, (ii) disease in systems unrelated to the
CC, and (iii) pertinent negatives that constrain the differential. Stated design logic: the CC is a
*biased, low-recall sample* of the disease state (patients report what is salient, not what is
diagnostically decisive), so the ROS is added as a **wide-aperture, high-recall, low-specificity sweep
deliberately run to raise sensitivity across the whole system space** before narrowing.
**Key parameters (the countable channel set).** CMS/AMA *1995 & 1997 Documentation Guidelines for E&M
Services* fix **14 systems**: (1) Constitutional; (2) Eyes; (3) ENT/mouth; (4) Cardiovascular; (5)
Respiratory; (6) Gastrointestinal; (7) Genitourinary; (8) Musculoskeletal; (9) Integumentary (skin/
breast); (10) Neurological; (11) Psychiatric; (12) Endocrine; (13) Hematologic/lymphatic; (14)
Allergic/immunologic. A "complete ROS" historically required **≥10 of 14**. Bates' clinical taxonomy is
similar (~15-16 head-to-toe headings). For a multi-channel mapping, treat **≈13-14 independent
system-channels** as canonical.
**Primary sources.** CMS/AMA 1995 & 1997 E&M Documentation Guidelines; Bates' (above).
**Confidence.** [verified] that CMS defines 14 systems and the ≥10 completeness threshold; [recalled]
exact guideline wording (not pulled this pass).

## 14.3 Differential diagnosis + hypothetico-deductive reasoning — a belief, not a label
**Mechanism (as stated).** Clinical reasoning is **hypothetico-deductive**: the clinician generates a
small set of candidate hypotheses very early (seconds to minutes, before most data is in), then gathers
data selectively to **confirm or refute** each, revising the set as data arrives. The explicit artifact
is the **differential diagnosis** — a **ranked list of possibilities held simultaneously open**, ordered
by BOTH probability AND "must-not-miss" severity, each carrying its own discriminating data
requirements. The intake gathers enough to **rule in / rule out** before narrowing. Two robust empirical
findings: clinicians hold only a **limited number** of active hypotheses at once (~4-5, working-memory
bounded), and diagnostic skill is **content-specific** (performance on one case does not predict
another — there is no general "good diagnostician" trait separable from domain knowledge).
**Math / Algorithm.** Maintain a ranked hypothesis SET (a distribution), not a point estimate, until
evidence separates them. Update sequentially as each finding arrives (§14.5).
**Primary sources.** Elstein AS, Shulman LS, Sprafka SA, *Medical Problem Solving: An Analysis of
Clinical Reasoning* (Harvard Univ. Press, 1978); Kassirer JP, "Diagnostic reasoning," *Ann Intern Med*
1989 (iterative hypothesis testing).
**Confidence.** [verified] Elstein 1978 (book; existence/authorship/year/hypothesis-generation claim
web-verified, not PubMed-indexed); the ~4-5 and content-specificity findings verified. [recalled] exact
Kassirer 1989 citation detail.

## 14.4 Illness scripts — the structured template a finding is matched against
**Mechanism (as stated).** Expertise rests not on superior general reasoning nor on depth of
pathophysiology but on stored **cognitive structures describing prototypical patients — illness
scripts** — matched against the presentation. The canonical **three-slot structure**: **Enabling
conditions** (predisposing/contextual factors: age, sex, risk factors, exposures, priors) → **Fault**
(the pathophysiological insult / failing mechanism) → **Consequences** (the signs, symptoms, features
that follow). Diagnosis proceeds by **matching** the patient against activated scripts; the best-fitting
script's unfilled slots generate expectations that drive further data-gathering. Experts' scripts carry
little explicit causal/pathophysiological detail but rich enabling-condition + consequence knowledge —
"**knowledge encapsulation**" (biomedical detail compiled into high-level clinical concepts); novices
still reason through slow causal pathophysiology.
**Key parameters.** Three slots: enabling conditions / fault / consequences.
**Primary sources.** Schmidt HG, Norman GR, Boshuizen HP, "A cognitive perspective on medical expertise:
theory and implication," *Acad Med* 1990 Oct;65(10):611-621, DOI 10.1097/00001888-199010000-00001.
**Confidence.** [verified] the 1990 paper (PubMed + abstract) and the script/matching/encapsulation
claims. [recalled] the three-slot formulation's origin in Feltovich & Barrows (1984) and Bordage/Custers
elaborations — structure anchored in the verified 1990 paper, sub-attributions unverified.

## 14.5 Bayesian diagnostic reasoning — the estimator's exact math
**Mechanism (as stated).** A test result is only interpretable relative to the probability of disease
*before* the test. History + exam set the **pre-test (prior) probability**; each finding's **likelihood
ratio** moves it to a **post-test probability**. This is the Bayesian core of evidence-based diagnosis.
**Math / Algorithm** (definitional identities, confirmed exact):
    odds = P / (1 − P) ;   P = odds / (1 + odds)
    LR+ = Sn / (1 − Sp) = P(finding | disease) / P(finding | no disease)
    LR− = (1 − Sn) / Sp
    post-test odds = pre-test odds × LR
    multi-finding:  post-test odds = pre-test odds × LR₁ × LR₂ × … × LRₙ   (each finding a multiplicative update)
LR = 1 → no information; LR > 1 raises disease probability; LR < 1 lowers it. **CRITICAL CAVEAT the
sources force:** the chained product is valid ONLY when findings are **conditionally independent given
disease status** — correlated findings **double-count** evidence. That is the clinical statement of
channel non-independence, and the direct justification for LIMEN's decorrelation discount (§14.8).
**Fagan's nomogram** — a three-column alignment chart (pre-test probability | LR | post-test
probability): a straight line from the pre-test probability through the LR reads off the post-test
probability, a graphical solver for the odds-form Bayes update.
**Primary sources.** Fagan TJ, "Nomogram for Bayes's theorem," *N Engl J Med* 1975 Jul 31;293(5):257,
DOI 10.1056/NEJM197507312930513. Sackett DL, Straus SE, Richardson WS, Rosenberg W, Haynes RB,
*Evidence-Based Medicine: How to Practice and Teach EBM*, 2nd ed. (Churchill Livingstone, 2000).
**Confidence.** [verified] Fagan 1975 (PubMed); formulas are standard identities taught in the Sackett
text; [verified] Sackett book (web-level; exact page text not extracted, not needed for identities).
**Cross-ref.** This is the same estimator as Creator 13 (Kalman / precision-weighting) in odds form:
the LR is the finding's informativeness = its precision; sequential LR-multiplication = precision-
weighted fusion. Medicine and the Bayesian brain are the same update, one in odds, one in log-precision.

## 14.6 Dual-process reasoning — and why "fast = error" is wrong
**Mechanism (as stated).** **System 1** = fast, non-analytical **pattern recognition** (script/exemplar
matching); **System 2** = slow, effortful, **analytical/hypothetico-deductive** reasoning. LOAD-BEARING
CAVEAT: the primary literature does NOT support "System 1 causes errors." Experts err **as often when
being deliberately systematic/analytical**; the effective intervention is encouraging **both** modes
(combined reasoning), yielding small but consistent accuracy gains. So a design that treats a fast/cheap
channel as inherently untrustworthy versus a slow/expensive one is not supported — reliability is
empirical, not a function of speed.
**Primary sources.** Norman GR, Eva KW, "Diagnostic error and clinical reasoning," *Med Educ* 2010
Jan;44(1):94-100, DOI 10.1111/j.1365-2923.2009.03507.x; Croskerry P (dual-process framing, see §14.7).
**Confidence.** [verified] Norman & Eva 2010 (PubMed + abstract) and the S1≠error finding.

## 14.7 Premature closure + cognitive bias — the named failure modes
**Mechanism (as stated).** **Premature closure** — the single most common cognitive cause of diagnostic
error — is verbatim **"the failure to continue considering reasonable alternatives after an initial
diagnosis was reached."** It is committing to a diagnosis before it is fully verified. In a 100-case
diagnostic-error study, **cognitive factors contributed in 74%** of cases (system factors 65%), and the
dominant cognitive fault was **faulty synthesis, NOT faulty knowledge** — inadequate knowledge was
uncommon. Premature closure is usually the downstream consequence of a cluster of biases:
- **Anchoring** — locking onto early information (first impression/finding) and under-adjusting as
  later, discordant data arrives.
- **Confirmation bias** — seeking/over-weighting evidence that confirms the working diagnosis,
  discounting refuting evidence.
- **Availability** — judging a diagnosis likelier because it comes to mind easily (recent/vivid), not
  because it is more probable.
- **Search satisficing** — stopping the search once one plausible finding is found, missing a second
  concurrent problem.
The countermeasure is **metacognition / cognitive forcing** — deliberately asking "what else could this
be?" and forcing the alternatives to be addressed. The intake structure IS the anti-premature-closure
protocol: mandatory ROS (data beyond the working hypothesis), forced differential (alternatives listed),
deferred testing (commitment withheld until independent channels report).
**Primary sources.** Graber ML, Franklin N, Gordon R, "Diagnostic error in internal medicine," *Arch
Intern Med* 2005 Jul 11;165(13):1493-1499, DOI 10.1001/archinte.165.13.1493 (premature closure
definition + 74% figure). Croskerry P, "The importance of cognitive errors in diagnosis and strategies
to minimize them," *Acad Med* 2003 Aug;78(8):775-780, DOI 10.1097/00001888-200308000-00003 (bias
taxonomy + metacognition); Croskerry P, "From mindless to mindful practice," *N Engl J Med* 2013 Jun
27;368(26):2445-2448, DOI 10.1056/NEJMp1303712.
**Confidence.** [verified] Graber 2005 (PubMed + abstract, exact premature-closure wording and 74%);
[verified] Croskerry 2003 & 2013 (PubMed). Bias definitions confirmed in Croskerry 2003; Tversky-Kahneman
cognitive-science origins [recalled].

## 14.8 The LIMEN mapping — why the estimator is a workup (synthesis, not sourced)
Each clinical element has a direct estimator correlate; this is the "why we map medicine to business":
- **Chief complaint → the flagged node / domain under review.** Scopes the encounter, is not the answer.
- **HPI (deep probe, seven attributes) → the fractal of feeds on the distressed companies themselves** —
  layoffs, leadership change, unit price, demand, competition, primary distressed-company sources. The
  deep, attribute-by-attribute characterization of the presenting problem.
- **Review of Systems (≈14 independent system-channels) → the broad-variance independent feed set.** The
  wide-aperture screen run precisely because the chief complaint is a biased low-recall sample. "Broad
  variance of sources" = ROS breadth; it is what makes convergence meaningful.
- **Differential diagnosis (ranked set held open) → the phase BELIEF distribution.** Never a bare label;
  ranked by probability AND must-not-miss severity; held open until evidence separates. This is exactly
  the estimator outputting a belief, not a phaseMAP.
- **Pre-test probability → beliefPred (the prior / transition step).** Set by context before any test.
- **Likelihood ratio → channel precision / informativeness.** post-odds = pre-odds × ∏LRᵢ IS the
  precision-weighted multi-channel fusion (Creator 13, in odds form).
- **Conditional-independence caveat (correlated findings double-count) → the decorrelation discount
  (eff_c).** The medical literature states the exact hazard LIMEN's groupthink mitigation addresses.
- **Corroboration across independent channels before trust → convergence of the fractal WITH the market
  score.** Agreement across independently-failing channels raises confidence; a single-channel
  conclusion is provisional. When the fractal and the market DIVERGE, that is "a different diagnosis."
- **Premature closure → the failure the estimator is built to avoid.** Abstention on thin coverage, the
  belief-not-label output, and (the queued) forward-outcome resolution ARE the anti-premature-closure
  protocol: do not commit before the evidence is sufficient. Graber 2005 is the citation for the gate.
- **Anchoring → over-weighting the first/loudest channel;** the reason a validated channel must not be
  auto-overridden and a self-report cluster must not auto-win (the HRV/groupthink case).
- **The market score → one channel (a "prior test"), not the label; the LABEL is the forward realized
  outcome** — the clinical analogue of the diagnosis being confirmed by the disease course, which is
  what ultimately calibrates which findings (channels) deserved what weight.

### Verification note (Creator 14)
Core citations verified against primary sources (PubMed + DOIs): Schmidt/Norman/Boshuizen 1990, Norman &
Eva 2010, Fagan 1975, Graber/Franklin/Gordon 2005, Croskerry 2003 & 2013. Book-level (web-verified, not
PubMed-indexed): Elstein/Shulman/Sprafka 1978, Sackett EBM 2nd ed. The Bayesian formulas are standard
identities. Flagged [recalled] and not re-pulled this pass: exact Bates chapter wording; the CMS
guideline exact text (14 systems / ≥10 threshold confirmed, wording not extracted); Kassirer 1989 detail;
the illness-script three-slot origin (Feltovich & Barrows 1984). The OLDCARTS A/R ambiguity is a genuine
divergence across teaching sources, recorded rather than resolved. §14.8 is LIMEN synthesis grounded in
the shared structure, explicitly not a claim from the medical literature.

---

_Last updated: 2026-07-20. Firewalled from the public site via `.vercelignore` (repo/history only). Creators: 14._
