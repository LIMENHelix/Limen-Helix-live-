# Brain-in-Code × Human-Stress × Civilization-Domains — Synthesis

Firewalled internal design synthesis (repo/history only). Date: 2026-07-18. Built from a 4-agent scan
(human-stress sensing, the 2024-2026 AGI landscape, civilization-scale distress modeling, and a grounding pass
on LIMEN's own code), on top of the 11-creator [NEURO_LEARNING_REFERENCE.md](NEURO_LEARNING_REFERENCE.md).

## Honesty banner (read first)
There is **no validated, timed, civilization-scale distress predictor** anywhere in the literature. Human
*subjective* stress is **not directly machine-readable** (only arousal is; it dissociates from felt stress).
Early-warning signals are **noisy, give regime/direction not timing, and false-alarm**. Cross-domain coupling
weights are **mostly qualitative**. So the honest object is a **staging / conditional-severity instrument with
loud uncertainty labels**, not a crystal ball. Everything below respects that ceiling; where it doesn't, it is
labeled speculative.

---

## 1. The one finding: four fields, one shape

The four scans independently converge on the **same three-part architecture** for any system that senses and
regulates distress, at any scale:

> **a predictive model  +  a coupled propagation network  +  a regulation / viability "cost" drive**

- **AGI field** (LeCun world models, Dreamer, active inference, Thousand Brains): every serious camp is a
  predictive/generative model **plus** an actor **plus** a cost/drive term. Even "pure prediction" architectures
  smuggle regulation in (LeCun's Cost Module, Dreamer's reward-in-imagination, active inference's expected free
  energy). The field's live, unsettled question is **whether regulation is the root of intelligence or a bolt-on
  module** — the money (LeCun's ~$1B world-model startup) bets prediction-first; the theory (Friston, Solms,
  Levin) says regulation-first; active inference is the bridge.
- **Stress neuroscience** (Creator 9): allostatic load = many biomarkers fused to one cumulative index;
  interoception = the brain's predictive model of body state; stress = prediction error / anticipated expenditure.
- **Cybernetics** (Creator 8): a regulator must model what it regulates (Good Regulator theorem); allostasis =
  predictive setpoint control; requisite variety bounds what regulation can absorb.
- **Civilization-scale risk** (systemic-risk networks, polycrisis, interdependent cascades): distress is a
  **vector over coupled layers**, and the network **amplifies** (second-round losses dominate first-round).

**Substrate independence is the thesis, and it is now sourced.** Levin (cell→organism), Friston (any persisting
system), Scheffer (any fold bifurcation), Ashby/Cannon (any regulator) all claim the *same regulation dynamics*
apply from a cell to a human to a domain to a civilization. That is exactly LIMEN's phase-substrate thesis, and
the reference doc now carries the primary sources for it.

---

## 2. The three legs, grounded in LIMEN's actual code

LIMEN already has a skeleton of all three legs, and — the key structural fact — **they already share ONE scalar:
domain `stress` (0-1).** Plasticity's modulator, active-inference's observed channel, and the connectome's
`total_stress` all read the same number.

| Leg | What the science says it needs | What LIMEN already has (verified in code) | Gap |
|---|---|---|---|
| **1. Brain in code** | predictive model + local learning + a drive/cost | `domain-brain-base.js` K-stack; `limen-plasticity.js` (3-factor + BCM metaplasticity); `limen-phase-percept.js` (predictive coding, ARMED on energy); `limen-active-inference.js` (free-energy EFE, SHADOW); `master-brain/` (gated, `executionAllowed:false`) | learning **armed-eligible but self-arms only on finance**; active-inference + off-energy plasticity are shadow |
| **2. Human stress → code** | HRV + a fused readiness scalar + EMA label; per-person baseline; allostatic-load fusion; interoceptive prediction-error framing | `/api/biosensor-state` accepts `{hr, hrv, arousal, coherence, cognitiveLoad, valence, phase}`; `biosensor-bridge.js` classifies regulation state; `domain-biosensor-adapter.js` consumes at **≤30% advisory, firewalled off the validated spine** | receive-only; no per-person baseline / EMA label; deliberately fenced OUT of the stress scalar |
| **3. Civilization domains** | multi-layer network + propagation (not averaging) + conditional severity + EWS watchlist + per-edge provenance | `domain-snapshot.js` per-domain stress; `civilization-connectome.js` stress-weighted edge propagation (`total_stress`, `upward_impact`, `propagateActivation`); `cross-domain-detector.js` named patterns | stress **source** is the weak link (feed-volume fallback + event overlays for feed-poor domains); no EWS layer; no per-edge measured-vs-inferred labels |

LIMEN's biosensor schema (`hr, hrv, arousal, coherence, cognitiveLoad`) already **matches** what the human-stress
research says are the credible signals (HRV autonomic index + fused arousal + coherence). The integration is not
greenfield; it is **already wired and deliberately firewalled at 30%.**

---

## 3. The unifying math: the SAME operator at every scale

The three legs are not three different problems. They are **one scoring pattern at three scales**, and the
reference doc already contains both halves of the recipe:

**(a) Fusion — many weak signals → one honest index.** McEwen/Seeman's **Allostatic Load Index** (Creator 9.2):
score each of N markers 1 if in its high-risk band, sum to 0-N. This is the paper-grounded answer to "how do you
turn scattered signals into a cumulative distress score" — and it applies identically to human biomarkers
(HRV, EDA, cortisol) and to domain biomarkers (per-domain indicators). It is exactly the fix for LIMEN's
known-bad feed-volume stress proxy: replace "article count" with "count of domain biomarkers in their high-risk
band."

**(b) Propagation — the network amplifies.** DebtRank / interdependent-cascade / SIR-on-networks all say: don't
average, **propagate** along weighted edges, weight hubs disproportionately (vanishing epidemic threshold on
scale-free graphs). LIMEN's `civilization-connectome.js` already does stress-weighted edge propagation; the
science says keep it, and add per-edge measured-vs-inferred provenance.

**(c) Transition watch — critical slowing down.** Scheffer (Creator 10): rising lag-1 autocorrelation + variance +
flickering precede a fold transition. Same math at every scale — Scheffer himself applied it to **depression
onset** from human EMA streams, and it is proposed for ecosystem/climate/financial transitions. This is the
model-free early-warning layer LIMEN has never instrumented, applicable equally to a biosensor time series and a
domain time series.

**The synthesis in one line:** *distress at every scale = deviation from a predicted setpoint, fused across many
markers into one index, propagated through a coupled network, with rising autocorrelation/variance as the
transition warning.* That single sentence is the same for a cell, a person, a domain, and the connectome — which
is why the human leg and the civilization leg can share the same scoring language.

---

## 4. Where the AGI landscape validates (and bounds) the thesis

- **Validation:** LIMEN sits on the **regulation-first** side of the field's central fault line, and that side is
  the *deep theory* (Friston, Solms, Levin, cybernetics), not a backwater. LIMEN already has an active-inference
  module (free-energy EFE) in code — the exact mechanism VERSES is commercializing as an AGI path. The
  "intelligence grounded in staying alive / defending setpoints" thesis is a live 2026 frontier, not a settled
  loss.
- **Bound:** the *money and shipped systems* are prediction-first world models (LeCun, DeepMind Dreamer/Genie),
  and even the regulation camp has **no shipped AGI** — VERSES' wins are narrow-benchmark and company-reported;
  Solms/Levin are early engineering. So the thesis is respectable and unsettled, **not** a proven edge. LIMEN
  gains nothing by claiming to be "building AGI"; it gains by being a **correct small instance** of the
  regulation-first pattern applied to a real domain.

---

## 5. The honest ceiling (what the literature does NOT support)

- No validated civilization-scale collapse predictor exists; EWS give **direction/regime, not timing**, and
  false-alarm (Guttal 2016: no consistent critical slowing before financial crashes).
- Subjective human stress is not directly readable; arousal ≠ felt stress; models **collapse cross-subject**
  without per-person baselines and self-report labels.
- Cross-domain coupling weights are mostly **qualitative** (polycrisis is a framing, not yet a predictive model).
- "Global brain" is **metaphor, not evidence.** Society-as-nervous-system has no agreed observables.
- Therefore the defensible object is LIMEN's already-stated **staging / regulation-observer** posture: "which
  coupled domains are elevated, and if one tips, how far does it propagate," with loud uncertainty labels — never
  "collapse imminent."

---

## 6. The ONE buildable thread (traction discipline)

Do **not** build a global brain that senses humanity. The bounded, paper-grounded, revenue-adjacent thread that
falls straight out of this synthesis is:

> **A unified distress-scoring method — allostatic-load-style fusion + critical-slowing-down early-warning —
> applied consistently at each scale, replacing the feed-volume stress proxy.**

Why this one:
- It **fixes a known defect** already on the books (the feed-volume stress proxy; see the `stress-source-rework`
  note) with a **paper-grounded method** (McEwen's index), not an invention.
- It gives the human-biosensor leg and the civilization-domain leg a **common, honest scoring language**, so the
  ≤30% biosensor advisory and the domain stress finally speak the same units — without crossing the firewall.
- It adds the **model-free early-warning layer** (Scheffer autocorrelation/variance) LIMEN has never had, at both
  scales, as a **watchlist** (not an alarm), matching how regulators actually use these tools.
- It has a **line to the product**: a better-calibrated distress index directly improves the P3 regulation desks'
  ranking function (the actual moat), not a playground.

**What stays gated (do not cross without an explicit operator decision):**
- The biosensor **≤30% advisory cap** and its firewall off the validated scoring spine. The code enforces this on
  purpose; human physiological data reaching the validated distress spine is a decision, not a refactor.
- `master-brain` **`executionAllowed:false`** — advisory synthesis only, never actuation.
- Any **timed prediction** claim. Keep it conditional-severity + regime, per §5.
- Paid-AI on any regulation cycle (kill-switch discipline).

**The gating reality, restated:** the early-warning half needs a **real time series at usable cadence**, and
LIMEN's domain distress updates ~weekly with a largely static galaxy. So the first physical step is not the
scorer — it is getting **one domain (Energy) onto a genuine time series**, then the allostatic-fusion + CSD scorer
runs on it in shadow, honestly labeled. This matches the earlier `htm-anomaly-criticality-gap` finding.

---

## Key sources (by leg)
- **Human stress:** McEwen/Seeman allostatic load (PMID 11287659); Barrett interoceptive prediction (Nature Rev
  Neurosci nrn3950); Schmidt WESAD 2018; van de Leemput/Scheffer depression CSD (PNAS 2014). Credible live
  signals: Polar H10 R-R (ECG-grade HRV), vendor readiness scalars (Oura/Whoop/Garmin), EMA self-report.
- **AGI:** LeCun JEPA/AMI; Ha & Schmidhuber World Models 2018; DeepMind Dreamer/Genie; VERSES/Friston active
  inference; Numenta Thousand Brains Project (Monty, arXiv 2412.18354); Damasio/Solms/Levin regulation-first.
- **Civilization:** Haldane & May 2011 (Nature); Battiston DebtRank; Buldyrev 2010 interdependent cascades
  (Nature); Scheffer 2009/2012; Rocha 2018 cascading regime shifts (Science); Homer-Dixon/Cascade Institute
  polycrisis 2024; Guttal 2016 (the EWS critique).
- **LIMEN internal:** `domain-brain-base.js`, `limen-plasticity.js`, `limen-phase-percept.js`,
  `limen-active-inference.js`, `handlers/biosensor-state.js`, `biosensor-bridge.js`,
  `domain-biosensor-adapter.js`, `handlers/domain-snapshot.js`, `civilization-connectome.js`,
  `cross-domain-detector.js`.

---

_Firewalled via `.vercelignore` (repo/history only). This is a synthesis/design document — nothing was built or
wired. Crossing any gated boundary in §6 is an explicit operator decision._
