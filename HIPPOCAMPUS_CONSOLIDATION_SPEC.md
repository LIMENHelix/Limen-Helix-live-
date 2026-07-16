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
