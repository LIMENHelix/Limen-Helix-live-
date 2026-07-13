# Energy Domain - Brain Map + Autonomy Roadmap

Internal reference. How the Energy domain works end to end, how close it is to a self-regulating
brain (scored against LIMEN_Helix_Neurology_Reference.html), and the phased plan to make it
autonomous. Firewalled from the public deploy via `.vercelignore`. Compiled 2026-07-13.

## 1. How it works (the full loop)

```
READS (handlers/domain-snapshot.js -> energy domain object)
  price feeds: Massive Crude (MASSIVE_API_KEY), FRED (FRED_API_KEY), EIA (EIA_API_KEY, gated)
  12 keyless event feeds: FERC/NERC grid, EIA natgas/petroleum/electricity, OPEC, nuclear, LNG,
    IEA, solar, wind, coal-transition (article COUNTS)
  reused cross-domain: NOAA NWS, CISA KEV, Fed Reg NRC/DOE
  defenseSignals[]: NUCLEAR_THREAT, STRAIT_DISRUPTION, CYBER_ATTACK ...
    -> buildDomain('energy'): baselineStress + eventScore*0.3 -> finalStress + confidence + signals
       (LOW_SIGNAL caps stress at 0.3)
        |
        v
BRAIN CYCLE (assets/js/domain-brains/energy-brain.js; 30s client + server cron)
  normalizeSignals() -> _activeConditions[]
  scoreStress() (K1 afferent fold)
  deriveDiagnoses() -> 6 canonical + 2 datacenter, evidence-contract gated by the pulse engine
  surfaceOpportunities() -> _applyNeuroGating (K2 gain / K6 attention / K7 lateral inhibition)
  HALT + TRUTH brakes -> refractory-gated action drafts (REPORT_GENERATION)
        |
        v
EXPRESSION (only boots on domain-console.html?domain=energy; brain injects 16+ scripts)
  opportunities -> fractal directive promotion (extract from 198 portals / prebuilt 1.37MB
    directives -> rank -> translate -> target real tickers XOM/CVX/D/DUK/NEE -> inject)
  -> .opp-card + economics preview + CLAIM button (claim-ledger, localStorage)
  -> node-business-engine (103-node directory, MAPPED/MISSING/SPECULATIVE inference)
        |
        v
PUSHES TO CIVILIZATION
  brain writes brainStress/Diagnoses/Treatments/Opportunities/Directives/EnergyModel onto
    LIMENDomains['energy'] -> domain-packet-adapter -> civilization packets
  cross-domain-detector emits limen:cross-domain-signal + limen:opportunity-detected on co-stress
        |
        v
REVENUE
  REAL: admin-energy distress desk -> lib/energy-buyers.js matches retiring generators to 10 named
    buyers by fuel (NextEra, Plus Power, Brookfield, Ares, EIG ...)
  INERT: opp-card economics are default-table estimates; CLAIM dead-ends in localStorage
```

## 2. Brain-readiness chart

The six capabilities the operator asked about, scored, plus the neuro-mechanism coverage.

| Capability | Score | Evidence / gap |
|---|---|---|
| **Reads (afferent sensing)** | REAL | Many live feeds; crude prices key-gated, event feeds keyless. Senses dysregulation as finalStress + signals. |
| **Renders (expression)** | REAL | 6+ live surfaces; console auto-loads the operator stack; opp-cards + economics + claim + node-business panels. |
| **Pushes to civilization (efferent to mesh)** | REAL | Writes a normalized packet to the mesh + emits cross-domain co-stress and opportunity signals consumed downstream. |
| **Self-regulates** | PARTIAL | Only 1 of 8 neuro modules is actuated (refractory de-dup). K1/K2/K6/K7 + HALT/TRUTH brakes are live but governor-flavored (dampen/hold) and fail-OPEN. The other 7 modules are inert reference code. |
| **Self-audits** | PARTIAL -> improving | Connectivity/SPOF + incomplete-circuit audits are computed. Were consumed by nothing; as of 2026-07-13 the brain now CONSUMES the SPOF audit each cycle (advisory). |
| **Builds own portals** | PARTIAL | Runtime cannot mint a portal. Offline `scripts/autonomous-portal-regen.mjs` DETECTS + queues missing portals (no AI); `build-fractal-portals.mjs` drains the queue via paid `/api/enrich-portal-claude` (Haiku), run manually. The terminal creative act is AI-gated + offline-only. |

**Neuro-mechanism coverage vs the reference (41 mechanisms): ~10 implemented, ~6 partial, ~17 absent.**
Energy built the MAINTENANCE + SELF-TUNING half (refractory, prediction-error compression,
retrograde throttle, extinction, metaplasticity, offline consolidation, connectivity/SPOF audit,
incomplete-circuit audit, interoceptive telemetry). It has NOT built the ACTIVE-CONTROL half
(E/I balance brake, thalamic input gate, set-point homeostasis, neuromodulatory global gain,
runtime inhibitory motifs, basal-ganglia action selection).

## 3. The two hard gates to autonomy

1. **The sense -> advise -> ACT arc is severed at "act."** Seven neuro modules are faithful
   reference implementations that nothing calls; they default to no-op and never write state.
   The telemetry adapter computes their exact inputs (volatility, active-triggers, load) every
   cycle and the brain keeps only the timestamp. Six mechanisms are one wire from live.
2. **Portal/company minting is paid-AI + offline + manual, and expressed opportunities dead-end.**
   The system can sense a missing node, rank it, map it to a business type, and queue it - all
   deterministic - but creating the portal needs `/api/enrich-portal-claude`. And a claimed
   opportunity has no wired path to /api/lead, the buyer list, or a deal engine.

## 4. Phase 1 - DONE (2026-07-13, no-cost / deterministic)

- **E/I balance controller** `assets/js/energy-ei-balance.js` (NEW) - the reference's most-repeated
  invariant (XIII.1): inhibition must scale with drive. Pure, no-op-safe, dual-export. Flags
  runaway-risk (under-braked for the drive) vs over-inhibited.
- **Self-audit now consumed** - the brain runs `_computeEnergyRegulationAdvisories()` each cycle
  (energy-brain.js), attaching E/I balance + the connectivity SPOF audit to
  `state.energyNeuro.regulation`. Observe-only, guarded, additive; both modules added to the
  console load. The brain now SEES its own runaway risk + brittle single-points-of-failure.

## 5. Roadmap - Phases 2+ (each is a deliberate, operator-scoped step)

No-cost / deterministic (do without "running" the domain):
- **P2 Actuate the advisory overlay.** Wire the live telemetry overlay to drive extinction /
  retrograde / metaplasticity as real proposals surfaced to the operator (still observe-only),
  then, under operator scope, let them adjust weights - closing the act arc one module at a time
  like refractory was.
- **P3 E/I brake actuation.** Feed the E/I `recommendedInhibition` into `_computeEnergyBrake` so
  the brake strength tracks drive; flip the brake from fail-open to fail-safe for autonomous
  emission.
- **P4 Signal clearance.** Add a per-signal age field to unblock the already-coded clearance pass
  in `energy-offline-maintenance.js` (Op 2, currently skipped).
- **P5 Thalamic input gate + set-point homeostasis.** New deterministic modules for the two
  biggest absent mechanisms: an input filter (admit/suppress feeds under priority) and a closed
  sensor->controller->effector loop that drives an energy metric toward a target (allostasis),
  not just alerting on deviation.
- **P6 Deterministic portal scaffold minter.** Give the runtime a no-AI way to mint a BASIC portal
  for a detected missing node (from the 103-node directory + a template), so self-build no longer
  depends on paid AI; the AI enrichment then only DEEPENS a scaffold when the domain is "run."
- **P7 Opportunity outbound handoff.** Wire the CLAIM/opp-card to /api/lead + the buyer list so a
  claimed opportunity actually goes somewhere (closes the revenue dead-end).

Paid-AI (only when the domain is "run" - see below):
- Deep portal/company minting via `/api/enrich-portal-claude`; AI-authored regulation directives;
  the retrieve->author->verify content pipeline.

## 6. "Run the domain" runbook (paid-AI, operator-triggered)

The blanks that need generative AI are filled only on a deliberate run:
1. Enable AI: set `LIMEN_AI_ENABLED=1` + `LIMEN_AI_TOKENS_PER_TICK=<positive>` in Vercel, redeploy.
2. Drain the portal-build queue: run `scripts/autonomous-portal-regen.mjs` (detect+queue, free)
   then `scripts/build-fractal-portals.mjs` (mints portals via Haiku, budget-paced).
3. Revert: set `LIMEN_AI_ENABLED=0`, redeploy. Everything else stays deterministic and free.

Until a run, the brain senses, diagnoses, self-audits, regulates (advisory), ranks opportunities,
maps businesses to nodes, and pushes to civilization - all at $0.
