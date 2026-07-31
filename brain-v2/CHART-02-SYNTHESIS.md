# CHART 02 — SYNTHESIS

Five parallel audits, 2026-07-31. This is the decision-grade summary. Details in the agent
findings; every number below is cited to a file:line or a paper.

---

## THE BINDING CONSTRAINT IS NOT THE ALGORITHM

> 250 observations / 14 sensors. If dysregulation occurs in ~10% of observations, that is
> **1.8 events per variable**. Peduzzi 1996 sets 10 EPV as the minimum for stable coefficients;
> Austin & Steyerberg 2017 find ~20 EPV before bootstrap-corrected estimates match held-out data.
> **We are off by 5-10×.**

And the 90-day hourly history is not 2,160 samples. Quarterly channels contribute **one** update
across the whole window; everything between is carry-forward. Any method that counts rows reads a
held-constant value as a confident low-variance signal. That is the mechanism behind the degenerate
constant already on record (grounded CISS identical at 0.5042 across all 20 domains).

**Design rule that follows:** prefer architectures whose parameters you **SET** rather than LEARN,
and whose starved behaviour is a **wide posterior**, not a confident number.

---

## THE STACK

Ranked, all closed-form, all deterministic, all with a native uncertainty that grows when data thins.

| # | component | job | JS | effort |
|---|---|---|---|---|
| 1 | **Kalman, predict-only when no observation** | state + intrinsic uncertainty | `kalman-filter` npm or ~80 lines | low |
| 2 | **HGF, 2-3 level** | volatility / regime instability, precision-weighted PE | port ~150 lines | medium |
| 3 | **Empirical-Bayes shrinkage across the 20 domains** | makes 250 obs usable | ~40 lines | low |
| 4 | **EWMA + BOCPD** | dysregulation detection, run-length posterior | ~80 lines | low |
| 5 | **Split conformal** | the abstention gate | ~30 lines | low |
| 6 | **Delta rule** | the only learning defensible at this n | ~15 lines | trivial |
| 7 | **Hand-written rule layer** | action recommendation | ours | low |
| 8 | Successor representation 12×12 | multi-step phase | ~40 lines | **gated on label quality** |

Kalman's abstention is produced *by the math*: no observation → predict-only → covariance grows.
Sinopoli et al. give a citable critical observation-arrival rate below which the estimate diverges,
so the "I cannot say" threshold is principled rather than hand-set. That is R5 satisfied by
construction.

**Item 3 is the largest available win and was not on anyone's list.** Twenty independent
250-observation problems become one hierarchical problem; shrinkage is strongest exactly where a
domain is thinnest. Graceful degradation obtained for free instead of hand-tuned.

### Rejected, with reasons

| | why |
|---|---|
| **HTM** | needs n=2048-bit SDRs; we have 14 sensors. Numenta's own floor is 400-500 rows. Assumes regular sampling; ours is daily-to-quarterly. **Starved, it does not abstain — anomaly likelihood pins high and stays there.** An alarm always on is no alarm |
| **Echo state networks** | need hundreds of units and a validation set we cannot spare. Documented overfit risk on limited data. **Fails silently** — excellent in-sample, random out-of-sample. This is the overfit wall the kernel already hit once |
| **Active inference / EFE** | exponential in horizon × state-space. Requires specifying A, B, C — we do not know A or B, and C is our preferences. The policy ranking is **our priors passed through a free-energy number that looks derived.** Under R4 that is unsupportable |
| **Predictive-coding networks** (arXiv:2006.04182) | that paper approximates backprop on deep nets with a training set. At 14 sensors it offers nothing. **The part we want is the linear-Gaussian reduction — which IS Kalman filtering** (Rao & Ballard derived theirs from it; Millidge 2021 "Neural Kalman Filtering"). Adopt predictive coding as the interpretive frame over a Kalman/HGF core; do not implement PC networks |
| **ACT-R / SOAR / Nengo** | wrong category — none consumes sensor streams; none has a JS implementation. jSoar is Java, not JavaScript. ACT-R's decay parameter is documented as unidentifiable |

---

## THE THREE GATES, IN ORDER

1. **Liveness.** A channel with ~zero across-time variance is **dead, not stable**. Drop it from
   fusion rather than fusing a constant as a high-precision observation. *This is the exact failure
   that produced identical stress across all 20 domains.*
2. **Precision.** Posterior variance past threshold → abstain. Derived from the filter, not set.
3. **Conformal.** Nonconformity above the calibrated quantile → abstain. At n=250, α=0.1, coverage
   sd ≈ 1.9pp — honest and reportable.

Plus the structural rule no algorithm can enforce: **no derived quantity may re-enter its own
input.** Circular inference makes every gate above read as confident agreement when it is one
number echoing. Already cut once, 2026-07-24, `groundedOnly` on 17 brains.

---

## WHAT THE CURRENT BRAIN ACTUALLY DOES

42 base methods, 68 energy overrides. The **working cycle is small**:

```
ingestFeeds → normalizeSignals → scoreStress → deriveDiagnoses
  → recommendTreatments → surfaceOpportunities → emitCrossDomainSignals → updateMemory
```

`deriveDiagnoses` (`energy-brain.js:526`) is the load-bearing measurement in the entire brain:
6 portal issues × `_activeConditions` via exact-token match, `active = matchCount > 0`,
`relevance = matchCount/triggers`.

**Eleven base methods return immediately for energy** — every generic K-stack, plasticity,
brake-gate, emission-queue, interoception and phase-percept method begins
`if (typeof this._runEnergyAutonomousEmission === 'function') return;`. They are called every tick
and do nothing.

**Decorative** (computed, nothing reads): `_applyDeepFold` payload, `_computeEnergySimulation`,
`_computeEnergyExecutiveReport`, `_computeEnergyPlasticity`, `_computeEnergyActiveInference`,
`_computeEnergyOverlays`, `_computeEnergyPhasePercept`, `_computeEnergyRegulationAdvisories`,
emission queues, `_buildDomainDiagnosisPacket`.

**`_learnedVec` abstains everywhere and always** — its own measurement block states no domain has
positive skill, so it returns the seed every call. The learning arm is present and inert.

**Static content masquerading as output:** `_PB_DETAIL` (3 hardcoded playbooks), the `moneyChain`
builder (~110 lines of if/else emitting fixed sentences), `_COMP` compensation, `o.validity`.
Every opportunity from a given diagnosis gets **identical prose regardless of feed values**.

### It DOES reach outside the browser — three POST paths

| path | gate |
|---|---|
| `POST /api/brain-cognition` every cycle, all 20 domains | hardcoded header token, ungated |
| `POST /api/brain-weights` | `localStorage['limen:brainwts:token']`, absent ⇒ no request |
| `POST /api/limen-drafts` (energy only) | active diagnosis + brake + 15-min refractory; `requiresHumanApproval:true`, `executed:false` |

So R7 has a real answer for v2 to match: the efferent path exists, it is telemetry and drafts, and
it is human-gated.

---

## THE CLAIM, AND WHAT THE SYSTEM ITSELF SAYS ABOUT IT

**The claim** (`NEURO_LEARNING_REFERENCE.md` Creator 13): brain and economist estimate a latent
state by *the identical algebra* — precision-weighted recursive estimation. "Reliability-weighting
is not a metaphor shared across the two fields; it is the identical algebra."

**The system's own honesty banner, same document:** "No single published paper asserts, in one
sentence, that the brain's state estimator and the economist's dynamic-factor estimator are the same
object. The isomorphism is therefore LIMEN's **synthesis grounded in shared equations**, not a claim
lifted from a source."

**And:** "There is no validated, timed, civilization-scale distress predictor anywhere in the
literature… the honest object is a **staging / conditional-severity instrument with loud uncertainty
labels**, not a crystal ball."

**Its own clinical impression** (`BRAIN_COMPLETENESS_ANALYSIS.md`): *"a superb perceptual learner
that cannot act, cannot sleep-consolidate, runs on one neurotransmitter, and confabulates its own
executive function."* Of ~83 mapped components: **~13 genuinely compute, ~31 structural, ~36
naming-only.**

The one hard out-of-sample result claimed anywhere: **40-year FRED WTI backtest, precision 0.699 /
recall 0.084, unfitted** (`ENERGY_REFERENCE.md` §N.4).

### Contradictions the reviewers must arbitrate

| # | conflict |
|---|---|
| X1 | `LIMEN_RECURSION_ARC.md` calls the **Kuramoto order parameter "the spine"**; `PHASE_ESTIMATOR_SPEC.md` §2.7 bans it — "Falsified as a financial proxy; do not re-run". *The theory doc's central through-line is the one quantity the estimator forbids.* |
| X2 | Synthesis wants **lag-1 autocorrelation** as the early-warning layer; the spec says "VARIANCE form only; autocorrelation form falsified for markets" |
| X3 | Completeness analysis: real external reward exists **only in finance**. `ENERGY_REFERENCE.md` §D: **finance + energy** |
| X4 | Same file, three states for plasticity: "SHADOW, no consumer" (§0), "ARMED" (§D), "No consumers" (§M) |
| X5 | Hippocampus spec header says "SPEC ONLY, nothing built"; component 1 in the same doc says "BUILT 2026-07-16, VERIFIED end-to-end" |

---

## EVIDENCE VOCABULARY TO REUSE, NOT REINVENT

The repo already has the strictest convention, in `lib/phase-estimator.js:14-22`:

> "The 11-state taxonomy and transition matrix A are STATED priors `[mark: prior]`; the fusion
> mechanics are well-evidenced, the state space is not — **do not let one launder the other.**"

Four-way distinction already in use: **measured** (`grounded:true`, `fromHint:true`) / **stated
prior** (`[mark: prior]`, `interpretive:true, validated:false`) / **abstain** (`grounded:false` +
reason containing "abstain", or `null`) / **degraded** (an object naming each defect, never a
boolean).

Existing abstention thresholds to inherit: `PRECISION_FLOOR 0.5`, `CDF_MIN_SAMPLE 8`,
`minScored 4`, `MIN_TICKERS 3`, `MIN_POINTS 60`, `DEAD_BAND 0.02`, `W_FLOOR 0.15`.

Canonical citation schema already exists: `treatment-discovery-cell.schema.js` — `SourceProvenance
{field, sourceFile, sourcePath, retrievedAt, retrievedFromSha}`, `VerificationVerdict {verdict,
verifier, evidence[], confidence, checkedAt, note}`, verdicts `VERIFIED | DISPUTED | THEORETICAL |
UNVERIFIABLE | FABRICATED | PENDING`. **`FABRICATED` is a first-class verdict.**

**The schema is right; the data never went through it.** `_summary.json`: 5,234 cells,
**66,025 unverified claims**, and a grep for any verdict across all 113 `by-node/*.json` returns
**zero files** — every claim is still `PENDING`.

---

## WHAT THIS MEANS FOR THE BUILD

1. **Cap at 14 conditions × 3 levels.** The existing 8 diagnoses are already near the honest ceiling.
   180 was never buildable.
2. **Read `recent7d`, not `value`.** The unsaturated field is already computed and discarded. Highest
   value-per-line change available, and it costs nothing.
3. **Kalman + HGF core, EB shrinkage across domains, conformal gate.** Not HTM, not ESN, not EFE.
4. **Predictive coding is the frame, Kalman is the implementation.** Say so, cite Rao & Ballard and
   Millidge 2021, and do not build PC networks.
5. **Liveness gate first.** A constant channel is dead, not calm.
6. **Inherit the evidence vocabulary verbatim.** It is better than anything I would invent.
