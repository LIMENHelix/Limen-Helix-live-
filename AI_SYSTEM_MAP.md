# LIMEN Helix - AI / LLM System Map

Internal reference. Every AI call site in the system: what it does, whether it works,
whether it still fits the direction, and what part of the nervous system it maps to.
Firewalled from the public deploy via `.vercelignore`. Compiled 2026-07-13.

## 1. Providers (3 model vendors)

All server AI routes through `lib/ai-orchestrator.js`.

| Provider | Models in use | Env var | Role |
|---|---|---|---|
| Anthropic (Claude) | sonnet-4-6 (author), sonnet-5 (agent boxes), haiku-4.5 (cheap), opus-4-7 (referenced) | `ANTHROPIC_API_KEY` | Authoring + reasoning |
| OpenAI | gpt-4o, gpt-4o-mini | `OPENAI_API_KEY` | Verify + fallback |
| xAI (Grok) | grok-4 | `GROK_API_KEY` / `XAI_API_KEY` | Retrieve (timely angles) |

ElevenLabs is named in the kill-switch as a paid voice provider but is not actively wired.
All model IDs and params verified valid (incl. `output_config.effort` on sonnet-5).

## 2. Orchestrator routing (4 intents)

The "tri-model pipeline": Grok retrieves, Claude authors, OpenAI verifies.

| Intent | Primary | Fallback chain |
|---|---|---|
| AUTHOR_PATTERN | Claude sonnet-4-6 | Anthropic-required (no fallback) |
| REFRESH_ARTIFACT | Claude sonnet-4-6 | GPT-4o |
| VERIFY | GPT-4o-mini | Grok, then Claude haiku-4.5 |
| RETRIEVE | Grok-4 | GPT-4o-mini |

## 3. The gates (why almost everything is dark)

Three independent controls:

1. `lib/ai-kill-switch.js` -> `aiDisabled()` = true unless `LIMEN_AI_ENABLED === '1'` (UNSET).
   Kills all GLOBAL/autonomous AI. Set 2026-06-26 for the cost bleed.
2. Orchestrator budget gate: `LIMEN_AI_TOKENS_PER_TICK` defaults to `0`, and `_budgetGate()`
   fails on `0 >= 0`. So re-enabling needs BOTH `LIMEN_AI_ENABLED=1` AND a positive
   `LIMEN_AI_TOKENS_PER_TICK` (`lib/ai-orchestrator.js:23,50`).
3. `agentBoxesDisabled()` = `LIMEN_AGENT_BOXES_DISABLED === '1'` (UNSET). Governs the operator
   agent boxes SEPARATELY, so they stay usable (pay-per-use, admin-only) without re-opening
   global spend.

Net: today the ONLY sites that can spend are the operator agent boxes + DMAD coach/studio,
all admin-passcode-gated and per-day Redis-capped. Everything autonomous is off.

## 4. Per-location audit

Verdict legend: CORE (keep, on-direction) - RELEVANT (secondary, on-direction) -
PARKED (business layer, deferred by domains-first hold) - STALE (retired lane) - DEAD (unwired).

| Location | Route (live probe) | Works if enabled? | Gating / killed-by | Verdict |
|---|---|---|---|---|
| `lib/ai-orchestrator.js` | internal | Yes, bug-free, graceful fallbacks | budget gate + kill-switch | CORE |
| `lib/ai-kill-switch.js` | internal | Yes (it is the gate) | n/a | CORE |
| `handlers/domain-agent.js` | `/api/domain-agent` 403 | Yes (sonnet-5) | passcode + daily cap / agentBoxes | CORE |
| `handlers/master-agent.js` | `/api/master-agent` 403 | Yes (sonnet-5) | passcode + daily cap / agentBoxes | CORE |
| `handlers/energy-agent.js` | `/api/energy-agent` 403 | Yes (haiku-4.5) | passcode + daily cap / agentBoxes | CORE |
| `handlers/music-coach.js` | `/api/music-coach` 503 | Yes (haiku-4.5) | Drew/master passcode / aiDisabled | RELEVANT (DMAD venture) |
| `handlers/hook-studio.js` | `/api/hook-studio` 503 | Yes (sonnet-4-6) | passcode / aiDisabled | RELEVANT (DMAD venture) |
| `handlers/trigger-pattern-author.js` | `/api/trigger-pattern-author` 403 | Yes (AUTHOR_PATTERN) | isMaster + cron / orchestrator | RELEVANT (brain-building) |
| `lib/pattern-author.js` | via trigger / cron-repair | Yes (AUTHOR_PATTERN) | inherits caller / orchestrator | RELEVANT (brain-building) |
| `lib/application-auditor.js` | via `capital-engine?action=score-lanes` | Yes (scores investment+research only) | finance gate / orchestrator | RELEVANT (surviving-lane scorer) |
| `handlers/capital-engine.js` | `/api/capital-engine` 403 | orchestrate/produce yes; reads work now | finance passcode / orchestrator | PARKED (business layer) |
| `lib/stream-ops.js` | via capital-engine produce | Yes (RETRIEVE->AUTHOR->VERIFY) | inherits capital-engine / orchestrator | PARKED (content-revenue) |
| `handlers/sales.js` | `/api/sales` 200 status | generate yes; template fallback AI-off | SALES/LEAD admin key / orchestrator | PARKED (SALES machine) |
| `handlers/enrich-portal-claude.js` | `/api/enrich-portal-claude` 503 | Yes (haiku-4.5) | open behind kill-switch | PARKED (portal density) |
| `handlers/limen-reciprocity-prose-rewrite.js` | `/api/...` 503 | Yes (haiku-4.5) | optional token / aiDisabled | PARKED (portal enrichment) |
| `handlers/expand-artifact-claude.js` | `/api/expand-artifact-claude` 503 | Yes (sonnet-4-6) | open behind kill-switch | STALE (patent/grant/sba/franchise) |
| `handlers/expand-artifact.js` | `/api/expand-artifact` 503 | Yes (OpenAI) | open behind kill-switch | STALE (patents + NSF) |
| `handlers/critique-artifact.js` | `/api/critique-artifact` 503 | Yes (Grok) | open behind kill-switch | STALE (patents + NSF) |
| `lib/long-form-generator.js` | via `/api/print-from-pattern` 403 | Yes (sonnet-4-6) | isMaster / orchestrator | STALE (patent/grant/sba) |
| `assets/js/limen/engine-runner-claude.js` | client -> expand-artifact-claude | Yes (drives drafter) | server gate | STALE (retired-lane driver) |
| `assets/js/limen/multi-pass-runner.js` | client -> expand-artifact-claude | Yes (multi-pass) | server gate | STALE (retired-lane driver) |
| `lib/refresh-pipeline.js` | NO caller (only a stale comment) | Would run but unreachable | n/a | DEAD (orphan; retired-lane) |
| `assets/js/domain-agent-box.js` | client -> domain-agent | Yes | UI passcode | CORE |
| `assets/js/energy-agent-box.js` | client -> energy-agent | Yes | UI passcode | CORE |
| `assets/js/master-brain/master-consciousness-box.js` | client -> master-agent | Yes | UI passcode | CORE |
| `assets/js/master-brain/unified-consciousness-panel.js` | client, no AI call ($0) | Yes (deterministic synthesis) | n/a | CORE |

Findings: no BROKEN sites. All model IDs/params valid, key-presence checked, JSON parsing
defensive, no-provider/AI-off cases handled. One minor cosmetic: `critique-artifact.js` exports
`config.maxDuration=300` but runs through the Hono catch-all, so that ceiling is ignored.

## 5. Nervous-system chart (part-of-brain + acting as such?)

LIMEN's thesis is one connectome. Mapping each AI to its neuro role, and whether it is
currently fulfilling that role.

| AI element | Nervous-system role | Acting as such right now? |
|---|---|---|
| `ai-orchestrator` (intent router) | Thalamus / basal ganglia - relays each intent to the right cortical region | Structurally yes; the regions it relays to are silenced, so it is a relay to sleeping cortex |
| `ai-kill-switch` (global brake) | Global inhibitory tone - a GABAergic / vagal brake, effectively anesthesia | YES - the single most active element; it is holding the whole autonomic system in deliberate suppression |
| RETRIEVE (Grok) | Afferent sensory intake - sensing current external state | Dormant (killed) - the sense arc is intact but not firing |
| AUTHOR (Claude) | Association + expressive cortex - synthesizes structured output | Dormant (killed) |
| VERIFY (OpenAI) | Anterior cingulate / prefrontal inhibition - the "is this wrong?" error monitor | Dormant (killed) |
| `master-agent` box | Global workspace / unified consciousness - whole-brain integration | AWAKE on demand - fires only when the operator directs attention |
| `domain-agent` / `energy-agent` boxes | Local cortical-column consciousness - a domain's own executive/self-model | AWAKE on demand (per-domain) |
| `unified-consciousness-panel` (local $0) | Default-mode network - the resting self-narrative that feeds the master box | Always on (free) |
| `stream-ops` / `capital-engine` produce | Efferent motor output - expression/action to the outside world | Paralyzed (parked) - the motor arc exists, no output fires |
| `pattern-author` / `trigger-pattern-author` | Synaptic plasticity / Hebbian learning - forms new connections between nodes | Dormant - the brain is not forming new synapses autonomously (held to manual) |
| `application-auditor` (adversarial review) | Immune / guard + self-critical prefrontal monitor | Dormant; and partly points at retired behaviors |
| `enrich-portal-claude` / `limen-reciprocity-prose-rewrite` | Association-cortex elaboration - adds density/detail to memory traces | Dormant (parked) |
| `expand-artifact*` / `critique-artifact` / `long-form-generator` | Vestigial motor programs - firing patterns for a behavior the organism retired (patent/grant filings) | Not acting - discontinued function; atrophied tissue still wired to the shared brake |
| `engine-runner-claude` / `multi-pass-runner` (client kernel) | Interoceptive reasoning kernel ("Is" layer) | Off-direction - currently drives the retired-lane drafters |
| `refresh-pipeline` | Memory consolidation / elaboration | DEAD - a neuron with no axon (no caller); orphaned |
| `music-coach` / `hook-studio` | Specialized creative/expressive center - but a symbiont, not native connectome tissue | Active (gated) - belongs to the DMAD venture, grafted on, not part of the 20-domain brain |

### System-level neuro diagnosis

The connectome runs like a brain under deliberate sedation. The only awake cognition is the
CONSCIOUS/executive layer (the operator agent boxes), and only when the operator engages it.
The autonomic reflex arc (sense -> author -> verify), plasticity (pattern authoring), and motor
output (content production) are pharmacologically silenced by the global brake for metabolic
(cost) reasons. This is APPROPRIATE for a domains-first, cost-frozen build phase: you do not
want autonomic spend while building.

Two liabilities:
- VESTIGIAL TISSUE: the retired-lane document factory (`expand-artifact*`, `critique-artifact`,
  `long-form-generator`, and the two client drivers) is firing patterns for a behavior the
  organism abandoned (patent/grant/SBIR/SBA/franchise are retired lanes). It is coupled to the
  SAME global brake as the pieces you might want, so waking the system for a test wakes the
  discontinued behaviors too.
- A DEAD neuron: `refresh-pipeline.js` has no caller.

## 6. Recommendations

1. DELETE the dead orphan `lib/refresh-pipeline.js` (no route or lib requires it; content is
   retired-lane).
2. DECIDE on the retired-lane document factory. If patent/grant/SBIR/SBA/franchise are truly
   retired, delete `expand-artifact.js`, `expand-artifact-claude.js`, `critique-artifact.js`,
   `long-form-generator.js` and the two client drivers, rather than relying on the shared
   kill-switch to hide them. That decouples "test the CORE" from "reopen retired behaviors."
3. KEEP the CORE (orchestrator, kill-switch, the 3 agent boxes + their client boxes + the
   consciousness panel) and the RELEVANT brain-building pieces (pattern-author, application-
   auditor). Leave the PARKED business layer dormant until the domains-first hold lifts.

## 7. Enable -> test -> revert runbook (operator action; incurs spend)

Cannot be done from a coding session: `LIMEN_AI_ENABLED` is a Vercel env var and enabling it
makes real paid calls.

1. Vercel -> LIMEN project -> Settings -> Environment Variables: set `LIMEN_AI_ENABLED=1` AND
   `LIMEN_AI_TOKENS_PER_TICK=50000` (both required).
2. Redeploy (env changes apply only to new deployments).
3. Run one minimal call per endpoint, capture responses.
4. Revert: set `LIMEN_AI_ENABLED=0` (or delete) and redeploy. Spend stops on the next deploy.

Caution: while enabled, the autonomic crons (`autopilot`, tick) can also fire and spend on
their own schedule. Keep the window short. The agent boxes are already live-fireable
(pay-per-use) but need the master passcode.
