# Hippocampus + Consolidation Spec (the missing memory organ)

INTERNAL — firewalled from the public site via `.vercelignore`. Repo/history only.
Status: SPEC ONLY. Nothing here is built or deployed. Written 2026-07-16.

## Why this exists (the one-line diagnosis)
The system has a full sensory layer (240 feeds), a full regulatory layer (20 domain
brains: brakes, gating, immune quarantine, forecasts-with-falsifiers), and NO durable
memory of outcomes. Feeds flow through and evaporate; brain state dies on tab close;
storage is spent on ~3,284 pre-baked static portals that nothing ever writes into
("dry aquifer, not deep aquifer"). Result: the architecture is brain-SHAPED but cannot
LEARN, because nothing hears back from reality. `energy-brain.js:1417` says it outright:
"NOT externalRewardEligible... self-consistency calibration only, NEVER reward."

This is not scope creep. The project's own fractal map named "prediction error drives
update" (management-by-exception) as the candidate unified rule at every scale. An offline
process that updates weights on RESOLVED forecast error IS that rule, made concrete. This
is the overdue payoff, not a new direction.

## Neuroscience frame (Complementary Learning Systems)
Two-system memory: fast episodic encoding (hippocampus, one-shot, tags each experience
with its outcome) feeds a slow OFFLINE consolidation (replay during rest) that gradually
updates long-term cortical structure. We build the same two systems:
  - RECORDER  = hippocampus (fast, cheap, writes every episode down)
  - RESOLVER  = outcome tagging (did the episode's prediction come true)
  - CONSOLIDATOR = offline replay (periodic refit of the slow weights)

CLS citation flagged HIGH-CONFIDENCE TEXTBOOK RECALL, not re-verified this session
(PubMed erroring). McClelland, McNaughton & O'Reilly 1995 (CLS); hippocampal replay is
among the more replicated systems-neuro findings. Pin the DOI when the tool is back.

## The scale reality (storage is a NON-issue)
240 feeds x 1 reading/hour x 24 x 365 = ~2.1M numbers/yr = ~30-50 MB/yr. One photo album.
Data centers spend on COMPUTE (training GPU-months), not on warehousing thoughts; the
finished "mind" is small weights. Binding constraints here, in order of scarcity:
  (1) outcome labels  (2) calendar time for them to accrue  (3) minutes of CPU to refit
  (4) storage — trivially cheap. We are feed-rich and label-poor. Do NOT add more feeds,
  deeper portals, or bigger anything. Add the 40 MB memory.

## Three components

### 1. RECORDER (hippocampus) — turn the feed river into a reservoir   [BUILT 2026-07-16]
- BUILT: handlers/feed-record.js, cron `12 * * * *`, registered in api/[...route].js HANDLERS.
- Store DECISION = Redis via lib/limen-db (lpush/ltrim = capped append-only time series).
  Chosen over Neon: already wired (no new secret/infra), list ops fit, past Redis pain was
  BANDWIDTH not storage and this reads only weekly. Cap 2160 rows/domain (~90d hourly, ~43MB).
- Reads the SAME live /api/domain-snapshot the console worker uses; records domain scalars
  (stress/activity/confidence/maturity) + any numeric per-source fields present (defensive).
- IDEMPOTENT PER HOUR (skip if newest row already in this hour bucket) — no new secret needed.
- Endpoints: write (cron), ?read=<domain>&n=<k>, ?stats=1.
- VERIFIED end-to-end against live prod: 20 domains recorded, real feed values captured
  (e.g. energy FRED Crude 79.2, Grid Reliability 100), second write correctly skipped.
- On a branch (agent/hippocampus-recorder); merge = deploy. Data accrues from first cron run.
- NEXT: after ~weeks of history, build component 2 (RESOLVER).

### 2. RESOLVER (outcome tagging) — close the loop honestly
- Each brain already emits `energyForecast`-style forecasts WITH explicit falsifiers.
  Persist each emitted forecast: { forecastId, domain, dxId, direction, projectedStress,
  horizon, falsifier, emittedAt, priorWeightsVersion }.
- A weekly job resolves each matured forecast against EXTERNAL truth that actually exists
  (EIA prices, Yahoo XLE/USO/UNG moves, realized vol) + the recorder's own feed history —
  NOT against the brain's own stress number (that is self-grading homework; the current
  truth-brake ledger's weakness).
- Write the resolved label: { forecastId, realized, error, reliability, resolvedAt }.

### 3. CONSOLIDATOR (offline replay) — refit the slow weights, kernel-style
- Periodic (weekly/monthly) offline batch. Same pattern as scripts/kernel-validation/.
- NOT on the 30s cycle. NOT paid AI. Deterministic fit. Ship learned weights back as
  CONFIG the brains read (energy.json runtime.params etc.) — never edit code on the loop.

## THE THREE RULES (build in from day one — retrofit is expensive)

### RULE 1 — plasticity ∝ error × RELIABILITY (not error alone)
Raw error-weighting is a NOISE AMPLIFIER in a 240-feed stream: the biggest prediction
errors are disproportionately garbage (feed divergence, one-off shocks, stale reads, RSS
spikes) not genuine surprise. The brain gates plasticity by neuromodulation (ACh/NE
signal reliability/salience): surprise updates weights ONLY when deemed trustworthy.
  reliability = f(feed freshness, divergence flag, cross-channel agreement
                  [interoception consensusOther], sample count)
  update_weight_i ∝ error_i × reliability_i
This wires the governor layers the system ALREADY computes into the one place they earn
their keep. Without it, error-weighting is the cosmetic rule wearing the rigorous rule's
clothes.

### RULE 2 — DECAY from day one (acquisition WITHOUT removal is this project's #1 failure)
The portals, the pruning debt, policy accumulation — all the same pathology: things that
only ever grow. A forecast-outcome ledger that only grows is that pathology in new clothes.
Half-life on how much an old resolved forecast counts toward the current fit.
  SUBTLETY: decay by WALL-CLOCK time silently forgets a still-valid regime that just
  hasn't fired forecasts lately (quiet oil market != invalid oil knowledge). Prefer decay
  by COUNT of intervening resolved forecasts, or a regime-aware half-life. Precedent: the
  validated kernel used a C(t) accumulator, not a flat window.

### RULE 3 — sample-efficient fit + honest confidence (early signal, gated action)
Hippocampal memory is sample-efficient because of STRONG PRIORS + FEW PARAMETERS, not bulk.
So choose the fit for that property EXPLICITLY:
  - a handful of interpretable weights (not a deep net)
  - a Bayesian-shaped update with the PRIOR sitting on today's hand-set defaults
  - the posterior WIDTH is the confidence signal
Then early movement away from the defaults is real AND self-labeling. Show movement early;
gate ACTING on it by sample count (code already does this: creditAssignmentActive n>=5,
resolvedSamples>=3). Both early-signal and honest-confidence — not one or the other.

## What is NOT on the build list
More feeds. Deeper portals. Bigger storage. Paid AI on the loop. RL on the live stream
(sparse/noisy/delayed rewards on news-count features = overfit noise; not viable solo).

## First concrete step (when the freeze lifts)
The RECORDER alone. One cron + one compact store. Data starts accruing on day one;
RESOLVER and CONSOLIDATOR only become useful once months of history exist. Start the clock.

## Gate
Build/deploy is FROZEN pending funds (scope-lifted only for the deal engine). The RECORDER
is a deploy (cron + store). Do NOT build without explicit operator go. This doc is the
ready-to-build plan; it costs nothing until then.

## DEFERRED: cross-stack credit assignment (documented so it is not silently lost)

Written 2026-07-16 alongside the reward-gated plasticity build (branch agent/plasticity-v1).

CURRENT APPROACH: per-layer three-factor plasticity. Each K-layer (K1-K8) owns a small
learnable weight vector updated locally by dw = eta * pre * post * modulator, where the
modulator is the centered self-consistency credit from the central honest gate
(assets/js/limen-k4-selfconsistency.js) and eligibility traces bridge the truth brake's
3-20 cycle outcome delay (assets/js/limen-plasticity.js). This is right-sized for the
current stack: layers are shallow, coupling is mostly adjacent, and each layer's
contribution to the outcome is close enough to its own activity for local credit to land.

KNOWN WEAKNESS (deferred, not deleted): per-layer local rules assign credit poorly when it
must travel ACROSS many layers. If an error surfaced at the output is really caused three
layers upstream, a local rule at the upstream layer never hears about it except through the
shared scalar modulator, which cannot say WHICH layer erred. This becomes a real problem
only if (a) the stack deepens, or (b) cross-layer coupling becomes more load-bearing than
it is today.

THE BRIDGE WHEN THAT DAY COMES: a predictive-coding approximation of backprop
(Whittington & Bogacz 2017-style): each layer holds an explicit error unit; errors settle
through purely LOCAL computations that provably approximate gradient-like credit assignment
without literal backpropagation or weight transport. Biologically plausible, still local,
strictly more powerful for deep credit paths. Do NOT jump to literal backprop: it is a
different and harder mechanism the brain almost certainly does not run, and nothing in this
system needs it.

TRIGGER CONDITION (revisit when EITHER holds; otherwise leave this deferred):
  1. The K-stack grows beyond ~3 effective layers of dependency (today: K-layers act
     side-by-side on a shared state, closer to 1-2 layers of true depth), or
  2. Shadow diagnostics show persistent cross-layer misattribution: a layer's weights
     oscillate or drift while the OUTCOME error clearly originates in a different layer's
     inputs (observable in the per-layer shadowOutput-vs-staticOutput divergence logs
     stored via /api/brain-weights history).
A future session hitting either trigger should start from this section, not re-derive the
argument.

RELATED PROJECT-WIDE PATTERN (context, stated plainly): the fixed, non-pruning K-layer
graph (no structural plasticity) is the acquisition-without-removal failure shape one level
down. Any future structural-plasticity work (growing/pruning CONNECTIONS, not just
reweighting them) must build in a removal mechanism from day one, same as RULE 2 above.
The weight-level version already ships in this build (priorLambda shrinkage toward seed).
