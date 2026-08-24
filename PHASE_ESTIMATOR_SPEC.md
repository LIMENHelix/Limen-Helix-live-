# Phase Estimator — Shared Core + Two Input Adapters (SPEC)

Status: design spec, not built. Firewalled (repo/history only). 2026-07-19.

## 0. What this is, in one paragraph

One estimator that infers a **latent LIMEN phase belief** (a distribution over P0–P10) and a
**transition-regulation state** from a bundle of noisy channels, fusing each channel by its **reliability
(precision = inverse variance = Kalman gain)**. The core knows nothing about brains or markets. Two
thin adapters convert a substrate into the channel bundle the core consumes: **Adapter A (human
sensory)** and **Adapter B (domain/market)**. Making the core rigorous once makes both substrates
defensible at once. This is the isomorphism of NEURO_LEARNING_REFERENCE.md Creator 13 turned into an
interface: person and market are two channel-sets on the same precision-weighted latent-state estimator.

Provenance of every design choice is cited inline as `[src: ...]` against the research corpus so a
skeptic can trace it. Nothing here is asserted as validated efficacy — see §7.

---

## 1. The latent state (what we estimate)

Phase is a **developmental cycle, every phase equal; distress is a transition-regulation failure,
not a phase number**. The failure can be low-side (stuck in a transition) or high-side
(runaway/premature transition without control) `[src: corrected-recursion-grammar]`. So
the estimator never emits a bare label.

Canonical human/clinical register (LIMEN Helix Brain Development doc), 11 states:

```
P0 Null/Void   P1 Light   P2 Rhythm   P3 Darkness   P4 Peace   P5 Endurance
P6 Order   P7 Separation   (P7b optional)   P8 Conscience   P9 Threshold   P10 Resurrection
```

The Structure-of-Recursion "Collapse/Bonding/Overload/Scaffolding" labels are the **abstract skeleton
of the same arc, not a competing sequence** — the core indexes by number; registers are display skins.
Reconcile display names against `scripts/kernel-validation/LIMEN_RECURSION_ARC.md`.

**The state space itself is a STATED prior** `[mark: prior — taxonomy unvalidated]`. What each phase
represents, and that the transition ordering is anything more than internal convention, is NOT yet
grounded in an external evidentiary base — the physiology/scripture editions describe the arc richly
but do not validate it as a detector's state space. The fusion *mechanics* around the taxonomy are
well-evidenced (§2.2); the *taxonomy* is not. Given the clinical-adjacent stakes, the 11-state
identity and the `A` transition matrix carry the same `[mark: prior]` discipline as every other stated
value and are candidates for the §7 labeled benchmark before any accuracy is claimed. Do not let the
strength of the fusion rule launder confidence onto the state space it operates over.

**Estimator output** (a belief, never a scalar):

```
{
  belief:      float[11]      // posterior distribution over P0..P10, sums to 1  (predictive-coding: beliefs carry precision)
  phaseMAP:    int            // argmax(belief) — for display only, never the whole answer
  confidence:  float [0,1]    // total precision available this tick (low => the MAP is barely better than the prior)
  stuck:       float [0,1]    // current low-side component: failure-to-transition magnitude; NOT complete distress
  grounded:    bool           // false => abstained (thin coverage); belief == prior
  degraded:    {...}|null     // untransformed channels, no-history, unlabeled precision — surfaced, never hidden
  corrState:   {...}          // EWMA precision/correlation memory — caller persists and feeds back
}
```

---

## 2. The core estimator (discrete Bayes filter / HMM form)

Phase is discrete, so the core is a **recursive Bayesian filter over 11 states** (the forward
algorithm). Continuous Kalman is the special case for continuous state; predictive coding "grandfathers
nearly every estimation scheme" and reduces to this under discrete latent variables `[src: Creator 13.3
Bastos 2012]`. The principle we actually use — **precision-weighted update, inverse-variance channel
fusion** — is identical to Kalman `[src: Creator 13.1, 13.5 Ernst-Banks]`.

### 2.1 Predict (transition model A, 11×11)

The developmental arc has an order. `A[i][j]` = P(next=Pj | now=Pi):

- dominant mass on **stay** (Pi) and **advance** (P{i+1 mod 11}) — the arc's forward direction;
- small mass on **re-entry/regression** — "use the spiral, not the ladder; what seems like relapse is
  a spiral descent" (Brain Development doc). Adults re-enter P3 after trauma, P7 on vocation loss.
- P0→P1 is the symmetry-break (First Distinction); P10→P0/P1 closes the cycle.

```
belief_pred = A^T · belief_prev
```

`A` is a STATED prior on developmental dynamics, not fitted `[mark: prior]`. Keep it sparse and
legible; do not tune it against outcomes until §7 labels exist.

### 2.2 Update (precision-weighted channel fusion — the core operation)

Each channel `c` supplies a **phase-likelihood vector** `Lc[11]` (how consistent its reading is with
each phase) and a **precision** `rc ≥ 0` (its reliability this tick). The fused log-posterior is the
**precision-weighted sum of per-channel evidence** — this line IS the Kalman gain / inverse-variance
rule `[src: Creator 13.5 Ernst-Banks Eq.2 w_i ∝ 1/σ_i²; 13.1 K = P/(P+R)]`:

```
logpost[p] = log(belief_pred[p]) + Σ_c  (rc / Σ_k rk) · log(Lc[p])
belief     = softmax(logpost)
```

A noisy channel (small `rc`) contributes little; a reliable one dominates — exactly "the less reliable
channel is down-weighted" (ventriloquist effect) `[src: Creator 13.5 Alais & Burr]`. This is why news
demotes to reference without being discarded: it enters as a low-precision channel, never as the level.

### 2.3 Precision estimation (where the weights come from, honestly)

The **true** Ernst-Banks / Kalman precision for a channel is its OWN independently-measured noise
variance — NOT its agreement with other channels `[src: Creator 13.5 Ernst-Banks 2002, DOI
10.1038/415429a, verified from primary PDF this session]`. So precision is sourced in priority order:

1. **`precisionHint` (preferred, independent).** A channel's own measured reliability — a validated
   HRV device, a sensor spec, an inter-rater κ for a coded channel. This is the real inverse-variance
   and is not subject to the failure mode below.
2. **Self-consistency (fallback, for channels with no independent noise estimate).** No labels
   required `[src: Hawkins voting; grounded-stress corrState]`:

```
residual_c    = KL( Lc , belief )                       // how far this channel sat from the fused belief
var_c(t)      = λ·var_c(t-1) + (1-λ)·residual_c²         // EWMA, λ = 0.93  [src: CISS Eq.4]
rc_raw        = 1 / (var_c + ε)                          // precision = inverse residual variance
```

**FAILURE MODE — correlated-channel groupthink** `[mark: prior — self-consistency is not independence]`.
Self-consistency measures agreement with the consensus, not correctness. When several channels share a
common bias rather than being conditionally independent (e.g. a cluster of self-report channels sharing
response bias, or motivated reporting), consensus-derived precision **systematically inflates that
cluster's apparent reliability** and can outvote a channel that is genuinely correct but disagrees —
the exact scenario where HRV (independent, high-precision) diverges from a self-report cluster while
being right, and loses. This is the estimator cousin of correlated noise degrading population codes
(Averbeck/Latham/Pouget-style; recalled, not re-verified — confirm before practitioner-facing use).

**Mitigation — decorrelate before you weight** (reuse the CISS insight already in `corrState`). The
EWMA cross-channel correlation matrix `C` we maintain anyway tells us which channels chronically
co-move. Discount each channel by its effective multiplicity so a bias-sharing cluster of `k` counts
as ~1 independent vote, not `k`:

```
eff_c = 1 / Σ_j |C[c][j]|                                // effective-independence discount, row-sum of |corr|
rec_c = decay(age_c)                                     // exponential half-life; age_c = ticks since channel c last delivered a FRESH reading
rc    = rc_raw · eff_c · rec_c                            // multiplicative composition of independent factors
```

The three factors compose multiplicatively into one scalar — the standard short-term-plasticity shape
(release efficacy = facilitation × depression, both continuous, carried by one number) `[src: Abbott &
Regehr synaptic dynamics — recalled, not re-verified; confirm before practitioner-facing use]`.

`rec_c` is the **staleness/forgetting factor**, and it closes the acquisition-without-removal gap: a
channel that goes silent (feed breaks, client stops reporting on that sense) must not keep voting on
its last earned precision forever. This is the extinction/offline-clearance pairing applied at the
estimator layer — the same fix already reviewed in the plasticity recency work (`w = w_drift ·
w_recency`). Freshness stays **event-driven** (a channel is "fresh" only when it delivers a genuinely
new reading); `rec_c` discounts trust in the live blend continuously, it does not decide whether to
learn — mirroring synaptic tagging-and-capture (discrete capture event, continuously-decaying tag).

An independently-measured `precisionHint` channel bypasses the self-consistency fallback (but NOT
`rec_c` — a stale validated sensor is still stale), so HRV cannot be outvoted by a correlated self-
report cluster while it is reporting — the decorrelation is what protects the correct-but-lonely
channel. **Every self-consistency-derived `rc` is a prior-strength, not a validated weight**
`[mark: prior]`; only §7 labels turn it into a measured one.

**The `decay` half-life is a per-substrate STATED prior** `[mark: prior]`, and carries the same
timescale-rescaling risk logged across the plasticity build: do NOT reuse one half-life across
substrates (human sensory cadence ≠ domain feed cadence ≠ market resolve cadence). Measure each
substrate's own channel-refresh spacing and abstain (`rec_c = 1`) until it is known, rather than
copying a constant — this is also the one genuinely self-adjusting (metaplastic) parameter in the
design, so it is worth doing right rather than hard-coding.

### 2.4 Input transform (before likelihoods)

Every raw channel value is mapped to its **empirical CDF rank** over the channel's own history — unit-
free, bounded (0,1], distribution-free, immune to the silent re-centering that makes z-scored indices
non-comparable across vintages `[src: Creator 12.4 CISS; 12.3 Cleveland CFSI]`. Below `CDF_MIN_SAMPLE=8`
history points the value passes through untransformed and the channel is flagged `degraded` — an
untransformed channel is on a different scale and pretending otherwise is how a stress index lies.

### 2.5 Transition-regulation failure (orthogonal to phase)

The existing `stuck` output is only the **low-side** component. It measures blockage or
perseveration, not distress in both directions. A complete transition-regulation record must keep
the two poles separate:

- **low-side / stuck:** failing to transition, remaining in a state despite unresolved drive;
- **high-side / runaway:** transitioning prematurely or without control, including uncontrolled
  state changes.

Both are distress, and neither is implied by the phase number. The current core implements only the
low-side `stuck` component; a future high-side component must be added as an independently evidenced
field rather than folded into an unsigned scalar. Until then, callers must not describe `stuck` as
the complete distress state.

The low-side component currently uses two signals, both label-free:

1. **Transition blockage.** The system should move but doesn't: prediction wants to advance, evidence
   keeps re-confirming the same phase under rising unresolved drive. Measure = accumulated divergence
   between `belief_pred` (which leaks forward via A) and the post-update `belief` staying put →
   "failure to shut off / failure to habituate" `[src: Creator 9.1 McEwen four load conditions]`, and
   loss of adaptive range `[src: Creator 10 Scheffer variance/critical-slowing — note: VARIANCE form
   only; autocorrelation form falsified for markets, Creator 12.15 Guttal]`.
2. **Within-phase severity.** The CISS composite already built in `lib/grounded-stress.js`: distress
   channels fused by a quadratic form over their EWMA correlation, so it lights up only on CO-MOVEMENT
   `[src: Creator 12.4 CISS]`.

```
stuck = clamp01( α · blockage + (1-α) · cissComposite )     // low-side only; α STATED, ~0.5 [mark: prior]
```

`stuck` is reported next to `belief`, never folded into the phase number. Constellation p0-RUPTURE is
distressed; AEP p8-RECOVERED is fine `[src: memory phase grammar]`.

### 2.6 Abstention

If `Σ_c rc < PRECISION_FLOOR` (thin/low-reliability coverage), **abstain**: return
`grounded:false`, `belief = belief_pred` (or uniform on cold start), `stuck:null`. Same contract as
`grounded-stress.js` minScored — never emit a false number on thin coverage `[src: phase-percept,
grounded-stress]`.

### 2.7 Hard invariants (carry from the whole corpus)

- **No phase-synchrony / Kuramoto-r as an input channel.** Falsified as a financial proxy; do not
  re-run `[src: memory kuramoto-r-homology-falsified]`. Coupling enters only as CISS correlation and
  the unison Herfindahl, never as an order parameter r.
- **Belief, not label.** Output the distribution + confidence; the MAP is display only `[src: Creator
  13, Bayesian brain]`.
- **Ordinal within a vintage.** CDF is taken over supplied history; never diff beliefs across vintages.
- **Persist `corrState`.** Without it precision stays flat and the fusion degenerates to a mean.
- **Every STATED prior is marked `[mark: prior]`** and is a candidate for §7 replacement.

---

## 3. The adapter contract (the only thing the core knows)

```
ChannelReading = {
  key:        string          // stable channel id, e.g. "scent", "companyDistress"
  value:      number          // raw reading; core CDF-transforms it
  likelihood: float[11]|null  // phase-signature: consistency of this reading with each P0..P10.
                              //   null => core derives a flat/uninformative likelihood (value only informs precision)
  precisionHint?: number      // optional sensor-quality prior (a validated HRV device > a self-report sheet);
                              //   multiplies the self-consistency precision, does not replace it
  massHint?: number           // optional importance weight (Gabaix size) for aggregate channels
}

ChannelBundle = { substrate: "human"|"domain", subjectId: string, readings: ChannelReading[] }
```

Adapters produce a `ChannelBundle`. The core does everything else. This is the whole seam.

---

## 4. Adapter A — human sensory  (from the Brain Development sensory diagnostic table)

Turns a person's readings into channels. `likelihood` vectors come straight from the doc's
phase↔sensory map (e.g. scent-aversion + hyperacusis loads Darkness/Threshold; soft-pressure craving
loads Peace). This is multi-sensory cue integration = the estimator's native form `[src: Creator 13.5]`.

| channel key    | source reading                                  | likelihood from            | precisionHint driver              |
|----------------|-------------------------------------------------|----------------------------|-----------------------------------|
| `scent`        | Smell Preference sheet (✅/❌ per phase line)     | Smell/Phase-Weight doc      | self-report → low                 |
| `sound`        | auditory tolerance / entrainment test           | diagnostic table            | test-structured → med             |
| `touch`        | tactile/interoceptive calm, pressure craving    | diagnostic table            | med                               |
| `thermal`      | hot/cold resilience or intolerance              | diagnostic table            | med                               |
| `taste`        | bitter/sour preference, appetite loss           | diagnostic table            | low                               |
| `hrv`          | vagally-mediated HRV (if device present)        | Peace/Endurance signature   | validated device → HIGH           |
| `behavioral`   | energy/focus/meltdown/shutdown markers          | practitioner coding         | med                               |
| `verbalTheme`  | story language ("stuck","rebuilding","done")    | practitioner coding         | med                               |

Notes:
- Clinical outputs are **advisory and human-gated**. Adapter A must never emit a diagnosis, a
  contraindication, or a supplement/medical recommendation autonomously — those are human-gated
  actions `[src: CLAUDE.md]`. It emits a phase belief + confidence for a practitioner to act on. §7.
- `hrv` is the one high-precision human channel that isn't self-report; it should usually dominate,
  which is the estimator behaving correctly (reliability-weighting) `[src: Creator 12/13 Thayer HRV].`

---

## 5. Adapter B — domain / market  (generalizes lib/grounded-stress.js)

`grounded-stress.js` v2 is already 90% of this adapter — its three channels become `ChannelReading`s,
its `corrState` becomes the core's precision memory. What changes: it currently returns a scalar
`stress`; as an adapter it returns a `ChannelBundle` and lets the core produce the belief + `stuck`.

| channel key       | source reading                                         | likelihood from                     | precision/mass |
|-------------------|--------------------------------------------------------|-------------------------------------|----------------|
| `companyDistress` | mass-weighted share of kernel-STUCK nodes (alert/traj) | loads P3/P7/P9 (rupture band)       | massHint=Gabaix size `[src:12.7]` |
| `unison`          | phase Herfindahl (nodes collapsing to one phase)       | high unison ⇒ coupled/fragile band  | absorption-ratio analogue `[src:12.6]` |
| `granularity`     | Gabaix h = √Σ(Sᵢ/ΣS)²                                   | structural fragility prior          | `[src:12.7]`   |
| `indicatorFeed`   | normalized indicator series (EIA/EDGAR/WARN/openFDA)   | domain-specific phase signature     | med            |
| `newsVolume`      | BBD-normalized feed share (NOT raw count)              | weak, broad likelihood              | **LOW** by construction `[src:12.11 BBD, 12.16 crowd-out]` |
| `connectedness`   | Diebold-Yilmaz TO-degree / out-influence               | transmission-weighted distress      | `[src:12.9]`   |

Notes:
- **Weight nodes by transmission/size, not headcount** — the recurring cross-paper finding `[src:12.7–
  12.10; #Out predicts, #In does not]`. `companyDistress` and `connectedness` carry `massHint`.
- **`newsVolume` enters LOW-precision, likelihood-broad, never as the level.** This is the whole
  feeds-are-not-stress rework expressed as a precision, not a special case `[src: memory stress-source-
  rework]`. Raw counts are inadmissible; only the BBD share-normalized value is `[src:12.11].`
- Kernel is one channel (`companyDistress`), high weight WHEN it fires, silent otherwise — a
  nociceptor, not the whole read `[src: memory kernel-scope-envelope]`.

---

## 6. What's buildable now vs label-gated

**Now (no labels):** the whole core, self-consistency precision, both adapters, abstention, `stuck`.
This ships as SHADOW next to feed-stress, same as grounded-stress today. It is already better than a
mean because fusion is precision-weighted and CDF-transformed.

**Label-gated (§7):** replacing STATED priors with fitted values needs an outcome benchmark. The
tractable path is Illing & Liu's: hand-build a labeled event set (they reviewed every Bank of Canada
report since 1977 + a 40-person expert survey → 55/276 months labeled) and score the estimator's
Type I/II against it `[src: Creator 12.2]`. Human substrate: practitioner-labeled phase sessions.
Only then do `A`, `α`, and `precisionHint`s become derived rather than stated. The learning machinery
already exists (`lib/limen-plasticity.js`, BCM/adaptive-η) `[src: memory plasticity-shadow-built]`;
it just needs a label source to point at. Until then: mark every prior, abstain often, claim nothing.

---

## 7. Honesty & gate summary (this is what makes it defensible to skeptics)

- Output beliefs with confidence; abstain on thin coverage; never a bare label.
- Every non-derived number is marked `[mark: prior]`; "validated" is reserved for the §7 label-scored
  envelope only, and never stamped outside it `[src: memory kernel-scope-envelope].`
- **Two priors carry the highest clinical risk and must be named as such in any outward material: the
  P0–P10 state space (§1, taxonomy unvalidated) and self-consistency precision (§2.3, correlated-
  channel groupthink).** Neither blocks the shadow build; both must be resolved before an accuracy
  claim or a practitioner-facing surface.
- No fabrication of efficacy. Adapter A produces decision support for a human; it does not make a
  medical/clinical/contraindication claim on its own `[src: CLAUDE.md human-gated actions].`
- Rigor is aimed outward — the point of the CDF/CISS/Kalman/Gabaix scaffolding is to make the lived
  pattern legible to people who can't feel it, so one unevidenced claim can't sink the estimator
  `[src: memory limen-helix-is-lived-first].`

---

## 8. Build order (each step verifiable, none ships to prod)

1. Extract the core into `lib/phase-estimator.js` — pure, no Redis/Date, `corrState` in/out. Unit
   tests prove: precision-weighting beats a mean on synthetic co-moving vs independent channels;
   abstains on thin coverage; belief sums to 1; `stuck` orthogonal to phaseMAP. (Mirror the 37-assert
   grounded-stress suite.)
2. Refit `lib/grounded-stress.js` as **Adapter B** emitting a `ChannelBundle`; worker persists
   `corrState`; keep feed-stress untouched (SHADOW). Verify on a live snapshot: energy reads a belief,
   not 1.0.
3. Stub **Adapter A** against the Smell/Phase-Weight sheet + one HRV input; offline test only, no
   deploy, no clinical output surfaced.
4. (Gated) stand up the labeled benchmark; only then fit priors and speak of accuracy.
```
