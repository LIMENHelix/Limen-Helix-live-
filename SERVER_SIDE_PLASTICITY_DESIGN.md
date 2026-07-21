# Server-Side Plasticity Persistence — Design Doc

Status: DESIGN ONLY. No code written. Operator asked to scope before building (2026-07-21).
Firewalled (repo/history only, in `.vercelignore`). Decision requested at the end.

---

## The problem, in one line

Learned K-layer weights compute in the browser and evaporate on tab close. A brain that resets to
seed every page load cannot regulate or correct itself over time — it re-derives the same starting
position forever. Persistence must become server-side and continuous, independent of any open tab.

## What is already true (verified 2026-07-21, file:line)

1. **The learning clock is already server-side.** `feed-resolve?emit=1` (cron, hourly at :42,
   `vercel.json:12`) loops every recorded domain and emits a forecast; it is explicitly tab- and
   token-independent (`feed-resolve.js:56-57`). Learning only MOVES on a new resolved outcome
   (`energy-brain.js:2782`, gated on `resolvedTotal` increasing), so hourly is the correct cadence —
   the 30s browser cycles between resolutions do not teach.

2. **The reward signal is already computed server-side.** The worker snapshot carries
   `dsum.outcomeTrack.{resolvedCount, estimatorHitRate}` per domain (`limen-worker-snapshot.js:342-346`)
   — the server analog of what the browser fetches from `/api/feed-resolve` to form the modulator.

3. **The authoritative stress is already computed server-side.** `dsum.stress` is the promoted
   grounded-stress value (`limen-worker-snapshot.js:312`) — the exact input `_buildObservation` needs
   to regenerate the cycle.

4. **A headless brain already exists.** `scripts/test-energy-plasticity-wiring.js` and
   `test-energy-overlays-wiring.js` load the real `energy-brain.js` in node against a ~15-line `window`
   stub and run `_initEnergyPlasticity` -> `_computeEnergyPlasticity` -> `serialize`/`hydrate`
   end-to-end. `limen-plasticity.js` and `limen-k4-selfconsistency.js` are pure, dual-exported, zero
   browser deps.

5. **The store round-trips through node.** The cron can read AND write `brainwts:<domain>` directly via
   `require('../lib/limen-db')`, no HTTP, no token (`brain-weights.js:91-93`). `serialize`/`hydrate`
   (`limen-plasticity.js:247-293`) restore weights + modulator baseline + resolved-count across runs,
   which is what makes cross-invocation continuity work.

## The two real design problems (not blockers — the substance)

### P1. No concurrency guard
`brain-weights.js:91` is a plain `db.set` — no version, no CAS, no last-writer-wins guard. If a browser
tab AND the cron both write `brainwts:energy`, they clobber. **RESOLUTION: the cron is the SINGLE
authoritative writer.** The browser drops to read-only for persistence (it already hydrates from this
key at boot). In practice the browser is not writing today anyway — it only POSTs when a localStorage
token is set, and none is. So this is a formalization, not a behavior change users would see. We will
also stamp `snapshot.source='cron'` so the store self-documents who owns it.

### P2. Faithful learning vs reconstructed learning (THE decision that matters)
The plasticity update reads ~10 state fields (observation, predictionError, regulation, ledger,
homeostasis, attention, inhibition, afferent, phaseDynamics). Two ways to supply them:

- **A1 — FAITHFUL (run the real compute chain).** Seed the headless brain with `dsum.stress`, run the
  real `_updateEnergyModel` + `_computeEnergyNeuroLayers`, which produce all 10 intermediates via the
  SAME code the browser runs. Feed the reward from `dsum.outcomeTrack`. The server learns EXACTLY what
  the browser would from the same stress + reward. ONE implementation, cannot diverge.
- **A2 — RECONSTRUCT (harness-fixture style).** Hand-inject the 10 fields from the snapshot and call
  only `_computeEnergyPlasticity`. Lighter, but it rebuilds inputs the brain normally computes itself —
  a SECOND code path that can silently drift from the browser's. This is the fabrication/divergence
  risk flagged to the operator earlier.

**RECOMMENDATION: A1.** The whole point of persistence is a brain that learns the real thing. A2 saves
a few milliseconds of compute (irrelevant at hourly cadence) at the cost of a second learning
implementation to keep in sync forever. A1 is only marginally more code because the compute chain is
already synchronous and degrades gracefully on the first pass (`energy-brain.js:1516-1519,2562-2563`).
The one genuinely external input, `energyAfferent.externalPressure` (cross-domain bus), is empty
headless and degrades to 0 — acceptable, and identical to a browser with no bus data.

## Proposed build (A1)

New handler `handlers/brain-learn.js`, registered one line in the Hono catch-all HANDLERS map, cron at
`:44` (2 min after the resolver at :42 so the reward is fresh). Per promoted domain (starts energy-only,
same `STRESS_PROMOTION_DOMAINS` allowlist gate as the stress promotion — widened deliberately, not
automatically):

```
1. hydrate:  snap = db.get('brainwts:'+dom); brain._initEnergyPlasticity(); P.hydrate(layers, snap);
             P.hydrateModulator(mod, snap)          // restores baseline + resolved-count
2. inputs:   read dsum.stress + dsum.outcomeTrack from the latest worker snapshot
3. learn:    run the REAL compute chain (observation->PE->regulation->K-layers->plasticity)
             one tick; applyModulator fires only if resolvedCount advanced since last snapshot
4. persist:  serialize(layers, mod) -> db.set('brainwts:'+dom, {...snap, source:'cron'})
             + db.lpush/ltrim history
5. never:    no emit, no send, no spend, no structural change. Calibration state ONLY.
```

Idempotent per hour (same guard as the resolver: skip if this hour's snapshot already stored).

## Cron identity + persona (operator asked for this on every cron)

```
id:        brain-learn
role:      SYSTEMS CONSOLIDATION — the offline "sleep" step. Hippocampal replay to cortex:
           takes each domain's freshly resolved outcomes and consolidates them into the
           durable K-layer weights, the way slow-wave sleep consolidates the day's learning.
persona:   computational-neuroscientist. Reads reward, updates synaptic weights, writes them
           to long-term store. Does not perceive, decide, or act.
must never: emit a call, send, spend, file, contact anyone, or change structure. It writes
           ONE Redis key class (brainwts:*) and nothing else. Fail-closed, fail-toward-seed.
escalates:  a runaway/oscillating layer (from the self-audit) is surfaced as an operator
           attention item, never auto-corrected. Same discipline as every other cron.
```
This should become the header block convention for ALL crons (none have it today — `vercel.json` is
bare path+schedule). Separate follow-up.

## Cost
One hourly invocation, one process, all promoted domains in a loop. Compute is milliseconds
(harness proves it); `maxDuration:800` available, needs ~1-2s. 24 invocations/day. Negligible against
the real Vercel cost line (build CPU from frequent deploys — batch the deploy). No new paid AI, no 30s
cadence, killswitch-irrelevant (deterministic).

## Rollback
Delete the one cron line in `vercel.json` + the one HANDLERS map line. The brain reverts to browser-
compute-from-seed exactly as today. The stored `brainwts:*` keys are inert without a reader. Zero
schema migration, fully reversible. `_actuation.plasticityLive=false` remains the instant kill for the
learned path regardless.

## What this does NOT do (stated plainly)
- Does not make any domain's diagnoses more real — see the stress-derived-circularity finding; learning
  on a self-referential stress signal learns the self-reference.
- Does not arm actuation. Persisted weights still only reach the live path through the existing gated
  `_learnedVec` (stable + rewardActive + drift-bounded + the new re-arm gate). This persists learning;
  it does not widen what learning is allowed to change.
- Does not touch infrastructure (fenced, playbook §G.2).

## Decision requested
1. Approve A1 (faithful headless) over A2? (recommended)
2. Energy-only first, then widen the allowlist after N clean runs — same discipline as the stress
   promotion? (recommended) Or all promoted domains at once?
3. Go / hold.
