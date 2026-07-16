# LIMEN Helix, Per-Domain Agent Architecture, Full-Site Forensic Audit

Read-only inventory and fit assessment. No code was changed. Compiled 2026-07-15 by a 10-agent parallel sweep (9 targeted auditors + 1 completeness critic). Every claim traces to file:line. This document is inventory and fit only; it contains no build or fix recommendations.

Status legend: CONFIRMED (read the code, does what is claimed) / PARTIAL (related thing exists, does not fully match) / ABSENT (searched thoroughly, not found) / UNCLEAR (ambiguous).

---

## 1. Executive summary

The five-part per-domain agent architecture (per-domain operations manager, per-domain sales manager, per-domain gain-setter, a lateral peer channel between domains' sales managers, and one shared cross-domain pruning agent) was **partially built, but not as five distinct agents**. The system's own design doc (`LIMEN_Helix_Neuro_Business_CrossRef.html`) names all five roles explicitly in neuro-to-business terms, and the build then **collapsed them into one brain object per domain plus a few shared services**, rather than instantiating separate ops/sales/gain agents per domain. Concretely: the inhibitory-override function and the gain-setting function both exist **per domain**, but as internal sub-computations of a single domain-brain object (the "K-stack": conscience, brake, K2 gain), not as autonomous agents that sit above other agents. The sales function exists as **one global, domain-agnostic revenue engine** in which "domain" is a tag, with only economy and finance wired end-to-end and only economy doing autonomous outreach. The lateral cross-domain channel is genuinely built and lateral (`inter-brain-bus.js`) but carries distress signals, not sales. The shared pruning agent is effectively **absent**: one dormant single-queue expirer plus scattered key-level TTLs, with the "microglia" concept living only in data, never in running cross-domain code. Net: the substrate and the intent are clearly present (roughly 70% of the pieces exist in prototype), the assembly into a five-agent-per-domain architecture is not.

One correction to the system's own self-description, surfaced by the audit: the repeated claim that everything is `executionAllowed:false` is **materially misleading**. That invariant covers only the client-side master-brain artifact pipeline. Two production paths already act autonomously on the outside world with no per-action human gate: `handlers/autopilot.js` auto-sends templated email via Resend on a Vercel cron when armed, and `handlers/homestead-automail.js` auto-sends physical Lob letters on a daily GitHub Action when armed. Both default to off and require an operator arm-switch, but neither is behind the AI kill-switch and neither asks a human per message.

---

## 2. Coverage statement

**Searched (read at file:line depth):**
- Server libraries: all 47 files in `lib/` (fleet, sales, CRM, gain, kill-switch, orchestrator, db clients, node-guard, ledger, buyers/disposition libs, venture engine, more).
- Server handlers: the ~140 files in `handlers/`, with deep reads on fleet, sales, leadgen, crm, autopilot, homestead-automail, domain-agent, master-agent, system-gain, brain-cognition(-refresh), the `limen-worker-*` crons, opportunities, deal-engine, capital-engine, ventures, spine, operator-action.
- Client brain layer: `assets/js/domain-brains/domain-brain-base.js` + all 20 `*-brain.js`, `inter-brain-bus.js`, `cross-domain-detector.js`, `action-selection-gate.js`, `global-state-engine.js`, `observer-node.js`.
- Python surface: `api/limen.py`, `api/helix.py`, `api/helix_app/**` (Thing1/Thing2 kernel + audit), `api/ping*.py`.
- Infra/config: `vercel.json`, `api/[...route].js` (the Hono catch-all HANDLERS map), all `.github/workflows/*`, `.vercelignore`.
- Design docs: `SYSTEM_MAP.md`, `AI_SYSTEM_MAP.md`, `LIMEN_Helix_Neuro_Business_CrossRef.html`, plus targeted reads of `autonomous-regulator.html`, `business-operations-atlas.html`, `atlas-companion.html`.
- Scripts: headers of `scripts/*.mjs|*.js` (~70), including the new `domain-structure-audit.mjs`, `domain-audit-hook.mjs`, `build-diagnosis-digest.mjs`, and root `wire-finance-feed.mjs`.

**Explicitly NOT opened (declared gaps, no silent caps):**
- Two untracked binary design docs were **not extracted**: `Isomorphism-Continued_M1-Latency-Spec-and-Fractal-Weight-Triage (1).docx` and `Neural-Business-Control-Isomorphisms_Research-Prospectus (1).docx`, plus `governance-pack.zip`. These are the most likely place an *intended* spec of this exact architecture lives. Flagged in section 8.
- The ~114-file per-domain **advisory UI layer** in `assets/js/` (`<domain>-targeting-engine.js`, `-clarity-operator.js`, `-directive-ranker.js`, `-node-business-engine.js`, `-opportunity-matrix.js`, `-business-build.js`) was **sampled, not exhaustively read** (representative headers per family confirmed they are browser-side, advisory/presentation only, non-actuating). If a per-domain agent were hiding, this is where a deeper pass would go, but the sampled evidence is consistent and strong that none is autonomous.
- Actual Vercel environment variable values could **not** be verified (no `.env` in repo). All third-party keys are referenced in code only; "configured vs dormant" for live keys is therefore inferred, not confirmed.
- Live production endpoints were not probed (read-only static audit by design).

---

## 3. Per-domain matrix (items 1 to 3)

Items 4 and 5 are cross-domain by definition and are assessed once in section 4. Every row is High confidence unless noted. Key: Item 1 = ops-manager / inhibitory override; Item 2 = sales-manager / revenue; Item 3 = per-domain gain-setter.

| Domain | Item 1 Ops/override | Item 2 Sales/revenue | Item 3 Gain-setter | One-line evidence |
|---|---|---|---|---|
| governance | PARTIAL | ABSENT | PARTIAL | conscience+brake `governance-brain.js:81`; sales = tag only `leadgen.js:46`; gain `governance-brain.js:1255` |
| economy | PARTIAL | **CONFIRMED** | PARTIAL | brake `economy-brain.js:98`; **full RE desk + autonomous Lob mail** `homestead.js:43`,`homestead-automail.js:114`; gain `economy-brain.js:1280` |
| infrastructure | PARTIAL | ABSENT | PARTIAL | `infrastructure-brain.js:124`; tag only; gain `:1528` |
| energy | PARTIAL (deepest) | PARTIAL | PARTIAL (actuating) | own brake modules `energy-brain.js:76,2796`; desk list only `energy-distress.js:8`; gain caps output `energy-brain.js:2331` |
| agriculture | PARTIAL | ABSENT | PARTIAL | emission-brake `agriculture-brain.js:1685`; tag only; gain `:1554` |
| industry | PARTIAL | PARTIAL | PARTIAL | `industry-brain.js:63`; WARN desk + liquidator match, no funnel `industry.js:9`; gain `:1450` |
| science | PARTIAL | ABSENT | PARTIAL | `science-brain.js:63`; tag only; gain `:1553` |
| medicine | PARTIAL | ABSENT | PARTIAL | `medicine-brain.js:87`; tag (TRT clinic entry) `leadgen.js:59`; gain `:1572` |
| education | PARTIAL | ABSENT | PARTIAL | `education-brain.js:44`; tag only; gain `:866` |
| technology | PARTIAL | ABSENT | PARTIAL | `technology-brain.js:72`; "layoffs desk" named, no handler `leadgen.js:55`; gain `:1291` |
| communication | PARTIAL | ABSENT | PARTIAL | refractory `communication-brain.js:874`; tag only; gain `:1339` |
| culture | PARTIAL | ABSENT | PARTIAL | `culture-brain.js:46`; tag only; gain `:937` |
| defense | PARTIAL | ABSENT | PARTIAL (actuating) | selfAudit `defense-brain.js:62`; tag only; gain servo `:1260` |
| environment | PARTIAL | ABSENT | PARTIAL (actuating) | selfAudit `environment-brain.js:116`; tag only; gain servo `:2034` |
| religion | PARTIAL | ABSENT | PARTIAL | emission-brake `religion-brain.js:1354`; tag only; gain `:1974` |
| population | PARTIAL | ABSENT | PARTIAL | emission-brake `population-brain.js:1331`; tag (fitness entry) `leadgen.js:58`; gain `:1818` |
| trade | PARTIAL | ABSENT | PARTIAL | selfAudit `trade-brain.js:63`; tag only; gain `:1566` |
| law | PARTIAL | ABSENT | PARTIAL | emission-brake `law-brain.js:1632`; tag only; gain `:1545` |
| finance | PARTIAL | **CONFIRMED** | PARTIAL | refractory `finance-brain.js:721`; **EDGAR desk + funnel-wired** `finance-distress.js:7`,`leadgen.js:362`; gain `:1451` |
| intelligence | PARTIAL | ABSENT | PARTIAL | emission-brake `intelligence-brain.js:1734`; tag only; gain `:1116` |

**How to read this matrix:** the Item 1 and Item 3 columns are uniformly PARTIAL because the function genuinely exists for all 20 domains but as a **sub-layer of one domain-brain object**, defined once in `domain-brain-base.js` and parameterized per domain, not as a distinct agent above separate ops/sales agents. Item 1's actuation is real but internal-only (it throttles/holds/dedupes the brain's own surfaced opportunities and action-drafts); the one true winner-take-all veto (`action-selection-gate.js`) is global, not per-domain, and dark by default. Item 3's gain is computed per domain everywhere but **actuates output only in Energy, defense, and environment**; elsewhere it is advisory. The single global gain value (`limen:system_gain`) is a deliberately inert observer that modulates nothing (`handlers/system-gain.js:3-8`, `handlers/brain-cognition-refresh.js:150-155`). Item 2 is mostly ABSENT because there is no per-domain sales agent at all; the two CONFIRMED cells (economy, finance) are the two domains wired into the global funnel, and economy is the only one with autonomous outreach.

---

## 4. System-wide findings (items 3 cross-scope, 4, 5)

**Item 3, network-wide broadcast layer: PARTIAL / non-actuating (High).** Beyond per-domain gain, the spec's "priority broadcast" also implies a network-wide arousal signal. That exists only as read-only collective-surprise (`handlers/brain-cognition-refresh.js:152-180`, exposed at `handlers/system-gain.js`), which "modulates nothing." So the network-level gain is measured, never wired to actuate.

**Item 4, lateral peer channel between sales managers across domains: ABSENT (High).** There are no per-domain sales-manager agents, so there is nothing to connect laterally. The sales stack is a single global hub (`sales:*`, `leadgen:*`, `crm:*` keyspaces) that all domains' leads funnel INTO, with domain as an attribution tag (`lib/sales-engine.js:32-72` segments by dealSize and trigger, not domain; `handlers/leadgen.js:135`, `handlers/crm.js:211` use domain only as a filter). The genuinely lateral, peer-to-peer cross-domain wiring that DOES exist, `inter-brain-bus.js` (`collectEmissions` at `:982`, `deliverEmissions` calling `targetBrain.receiveExternalSignal` at `:1024-1047`, cascade/loop detection, 30s cycle), transports brain-state distress signals (credit-spread, fuel-cost, solvency stress), not revenue, pricing, or leads. It is client-side only. The one cross-domain coordinator of decisions, master "Kai" (`lib/operator-fleet.js:141,221`), is hub-and-spoke and not sales. So the two ingredients the spec wants fused, sales-specific and lateral-peer, exist separately and are never combined. A partial adjacent layer the completeness pass flagged: `handlers/spine.js` is a system-wide SENSE to WEIGHT to GATE to RANK layer that reads `sales:companies`/`leadgen:*` and ranks who to contact by domain-weight (`spine.js:117-212`), with an operator inhibitory-override (`action=override`, `:243-251`). It is a single global gate, operator-driven, `recommend` by default, not 20 lateral peers, so it does not satisfy item 4 but is the closest structural relative.

**Item 5, shared cross-domain extinction/pruning agent: ABSENT (High).** No single shared agent retires stale data across all domains. What exists: (a) one near-match, `_pruningPass()` in `handlers/limen-worker-sleep-cycle.js:76-91`, which marks stale PENDING entries in one queue (`autoqueue`) EXPIRED after 7 days, but it touches a single record class, is **dormant** (its schedule sits in `ops/crons-paused-2026-06-01-pre-gate-a.json`, not in the active `vercel.json` crons), and is redundant with that key's own 14-day Redis TTL; (b) a scatter of incidental per-key TTLs and freshness gates across ~20 handlers (Redis `EX` on budget/dedupe/cache keys, `updatedMs < TTL_MS` checks that ignore-but-keep stale data); (c) the "microglia" concept, which appears only in data files (`brain-nodes-111.json`, `neuro-disorder-lookup.json`, per-domain neuro-substrate JSON) and as read-only, default-no-op Energy-only "extinction" proposal modules (`assets/js/energy-extinction.js:24-26`), never as a running cross-domain agent. The nearest operational analog is the `immune-system.yml` GitHub Action (daily), which heals/normalizes the corpus and processes operator actions, but it repairs data quality, it does not retire stale records or sunset policies.

---

## 5. Naming-drift findings

The codebase does not use the spec's vocabulary; it uses neuro-to-business isomorphism terms. The same functions map as follows (the design doc `LIMEN_Helix_Neuro_Business_CrossRef.html` names each intended role, cited):

| Spec function | Built-as name (drift) | Rating | Evidence |
|---|---|---|---|
| Operations manager / inhibitory override | **conscience** + **brake** (per-domain K-stack); global **action-selection-gate** (dark) | CONFIRMED (drifted) | `domain-brain-base.js:1057-1119`; per-brain conscience e.g. `agriculture-brain.js:1816`; doc names it "Managers/Supervisors + Legal/Risk/Compliance" `CrossRef.html:121-123` |
| Sales manager / external reward | **surfaceOpportunities** / **node-business-engine** / `/api/opportunities` / deal+capital engines | CONFIRMED revenue; reward-signal ABSENT by doctrine | `domain-brain-base.js` surfaceOpportunities; `handlers/opportunities.js`; `isReward=false` hard-coded e.g. `agriculture-brain.js:1627`; doc names dopamine/reward `CrossRef.html:223-226` |
| Per-domain gain-setter | **K2 gainControl** / **neuromodulation** | CONFIRMED per-domain; PARTIAL actuation | `domain-brain-base.js:1067`; `_compute<Domain>GainControl()` per brain; doc names neuromodulator "org-wide tone/priorities" `CrossRef.html:148,231` |
| Lateral cross-domain channel | **inter-brain-bus** ("cross-domain nervous system") | CONFIRMED (strongest-built) | `inter-brain-bus.js:961-1179`; doc names corpus callosum `CrossRef.html:1837` |
| Shared pruning agent | **sleep-cycle** worker + **node-business-guard** + Energy **extinction** | PARTIAL (fragmented, no unified agent) | `limen-worker-sleep-cycle.js:76-91`; `node-business-guard.js:129`; doc names microglia "internal audit / portfolio pruning" `CrossRef.html:137-139` |

**Roles named in the doc but NOT built as such:** the dopamine/reward-prediction-error learning signal (deliberately refused everywhere via `isReward=false`); the network-wide gain broadcast (read-only only); a unified microglia pruning agent (fragmented only); the global basal-ganglia action gate (built but dark by default). A whole-repo synonym sweep for supervisor/overseer/steward/warden/governor/dispatcher/reaper/janitor/sweeper/forage/harvest found **no** agent under any of those names (the `prune` hits are cache eviction in `lib/youtube.js`; `harvest` is a portal-content ETL).

---

## 6. Fit assessment

No layer conflicts with the target architecture; nothing forces a rebuild. The substrate is roughly 70% present in prototype.

**Easy fit (reuse existing patterns):**
- **Per-domain ops manager.** `lib/operator-fleet.js` already instantiates a persistent, self-named, memory-carrying operator per domain (`runFleet`, per-domain journal at `fleet:journal:<domain>`) with a bounded-action contract (`abstain|monitor|recommend|open-human-gate`, `interpretive:true, validated:false`). Reuse it.
- **Per-domain sales manager (wiring, not build).** `handlers/autopilot.js` is a working autonomous sales engine and already carries an explicit pre-cut per-domain plug point: `domainGate(state)` is a documented pass-through hook ("DOMAIN-READY, NOT DOMAIN-WIRED", `autopilot.js:12-14,70`). The outreach rails exist and are past scaffolding: Resend email (`lib/crm-send.js`), Lob physical mail (`handlers/homestead-automail.js`), a bandit-optimized funnel (`lib/sales-engine.js`), a CRM cadence/worklist (`handlers/crm.js`), and a real append-only money ledger (`lib/finance-ledger.js`). Gap is per-domain scoping of the currently-global `crm:*` worklist and implementing the domain gate.
- **Shared pruning agent.** `immune-system.yml` + `scripts/heal-corpus.mjs` + `lib/operator-action-queue.js` already are a deterministic, cross-domain, human-gated healing/decision loop, and `handlers/limen-worker-sleep-cycle.js` already carries the "synaptic pruning" framing. Extend, do not build; the natural chokepoint is `lib/limen-db.js` (uniform `limen:` prefix, one place every mutable key passes through).

**Needs a new (light) pattern:**
- **Per-domain gain store.** The intent is proven (`handlers/domain-agent.js:88-93` emits a bounded `config` toolCall for autonomy/maxConcurrent), but there is no *persisted server-side per-domain gain* key; γ is global and read-only. Adding an `agent:<domain>:gain` key (idiomatic given the existing colon namespaces) plus a deterministic setter is small.
- **Lateral cross-domain sales router.** `master-agent`/Kai reasons across all 20 but is observe-only (emits no toolCalls). Routing a lead/opportunity from domain A to domain B's sales manager is genuinely new behavior; the closest transport, `inter-brain-bus.js`, carries distress not sales, and is client-side. Medium effort.

**Conflicts / duplication to avoid if built naively:**
- **Three Redis clients, two credential pairs.** `lib/limen-db.js` (auto-prefixes `limen:`), `lib/redis-kv.js` (no prefix), and `lib/operator-action-queue.js` (different `KV_REST_API_*` creds, path-based REST). A shared pruning agent reading "all agent state" must know which store each writer used. Pick `limen-db` for new agent state; do not add a fourth.
- **Domain registry key duality.** The 20-domain list is copied in at least five places with two key conventions (runtime `research/health/supplyChain` in `operator-fleet.js` and the snapshot pipeline; portal `science/medicine/trade` in `brain-cognition.js`, `spine.js`, `leadgen.js`), reconciled by a `RUNTIME_TO_PORTAL` bridge in `limen-worker-score.js:16`. Reuse `operator-fleet.DOMAINS` (already exported) rather than declaring a sixth copy.
- **Lead-death ownership.** `handlers/crm.js:49-50` already owns lead lifecycle state (`dead/lost/unresponsive` via POST status). A pruning agent that "retires leads" would become a second writer of that state; it should recommend a CRM transition, not maintain a parallel dead-list.
- **Allocator vs pruning tension.** `lib/sales-engine.js:172-198` has an exploration floor that deliberately never starves a losing play to zero ("winners get fed, losers get a trickle"). A pruning agent that kills losing plays fights the allocator's design. Decide up front whether pruning acts on leads/deals (compatible) or on plays (collision).
- **Restraint double-stacking.** `lib/fleet-decision.js` conscience is a system-wide restraint (`restrictive` to recommend-only) and standing memory (`hedging-killed-usefulness`) warns that stacking the outward-claim brake onto internal ops "killed usefulness." Keep any reward-side sales brake per-deal, do not route it through the fleet conscience.

**Anti-reward / loss-cutting brake near the sales function:** expected-and-confirmed-ABSENT (High). This was explicitly deferred in the design, and the absence is real (the sales allocator does the opposite: it never starves a losing play). Reported as expected, not a defect.

---

## 7. Full evidence appendix (grouped)

**Per-domain ops/inhibition (Item 1):** `assets/js/domain-brains/domain-brain-base.js:1040-1130` (generic K-stack: `_computeGenericKStack`, `_applyGenericBrakeGate`), `:319-343` (30s cycle), `:956-988` (`applyRequestBias`); per-brain actuation flags cited per row in section 3; `assets/js/action-selection-gate.js:30-33,52-57,167-176` (global K3 veto, dark by default); `lib/fleet-decision.js:53-87` (`vetoed:false`, conscience downgrade); `lib/fleet-signals.js:57-74` (retired-lane veto scrub); `lib/node-guard.js:1-75` (author-time binding guard); `assets/js/energy-*` bespoke modules (`energy-refractory-limiter.js`, `energy-retrograde-throttle.js`, `energy-metaplasticity.js`, `energy-extinction.js`, `energy-ei-balance.js`).

**Per-domain sales/revenue (Item 2):** `lib/sales-engine.js:32-97,117,172-198` (funnel, segment key, allocator floor); `handlers/sales.js:40-46` (global keyspace); `handlers/leadgen.js:46-48,84-85,135,336-376` (domain-as-tag, desk pull sources); `handlers/crm.js:49-50,144-156,211,362-385` (lifecycle, worklist filter, operator-triggered send); `handlers/autopilot.js:12-14,54,70,182-217` (two-speed autonomy, domain-gate stub, auto-email); `handlers/homestead-automail.js:60,114-133` (armed Lob mail); disposition libs `lib/buyers.js`, `lib/energy-buyers.js`, `lib/liquidators.js`, `lib/distress-funds.js`; `handlers/{homestead,deal-engine,energy-distress,industry,finance-distress}.js`; `lib/venture-engine.js:147`, `handlers/ventures.js:11`, `handlers/opportunities.js:15-113`; `handlers/skip-trace.js:8-16`.

**Per-domain gain (Item 3):** `assets/js/domain-brains/domain-brain-base.js:1067-1073` (gainControl + attention/inhibition); `_compute<Domain>GainControl()` per brain (call sites cited per row); `energy-brain.js:2331,1989-2010` (actuating closed loop); `handlers/system-gain.js:3-18` and `handlers/brain-cognition-refresh.js:150-187` (global γ, read-only observer).

**Cross-domain lateral (Item 4):** `assets/js/domain-brains/inter-brain-bus.js:961-1179`; `assets/js/cross-domain-detector.js`; `assets/js/civilization/cross-domain-audit.js`; `lib/operator-fleet.js:141,221-243` (Kai hub); `handlers/spine.js:9-11,117-212,243-261` (system-wide gate/rank + operator override); `handlers/opportunities.js:71-113` (read-side aggregation).

**Shared pruning (Item 5):** `handlers/limen-worker-sleep-cycle.js:15-32,76-91` (dormant `_pruningPass`); `ops/crons-paused-2026-06-01-pre-gate-a.json:10` (paused schedule); `vercel.json:4-11` (active crons, none a prune); `.github/workflows/immune-system.yml:7-8,91-149` (deterministic heal, not retire); TTL inventory across `lib/redis-kv.js:33-37`, `lib/limen-db.js:70-91`, `lib/limen-iteration-cache.js:46`, `lib/company-phase-scorer.js:44-52`, `handlers/*-markets.js`, `handlers/cron-repair-held.js:93`; microglia-as-data `assets/data/brain-nodes-111.json:1887`, `assets/data/neuro-disorder-lookup.json:10319`; Energy extinction `assets/js/energy-extinction.js:24-26`.

**Architecture / fit:** data clients `lib/limen-db.js:24-91`, `lib/redis-kv.js:51-67`, `lib/operator-action-queue.js:28,45-52`; ledger `lib/finance-ledger.js:16-81`; registry copies `assets/js/domain-registry.js`, `lib/operator-fleet.js:35-56,251-257`, `handlers/brain-cognition.js:24`, `handlers/spine.js:27`, `handlers/leadgen.js:46-47`, bridge `handlers/limen-worker-score.js:16`; routing `api/[...route].js:27-194`; agent framework `handlers/domain-agent.js:8-11,36,61-97,126-151`, `handlers/master-agent.js:40,53-71`; crons `vercel.json:4-11`, `.github/workflows/*`.

**Auth / integrations / execution:** `lib/admin-gate.js:15-36`, `handlers/admin-auth.js:49-63`; `lib/crm-send.js:57-82`; `lib/stripe-rail.js:33-104` (inbound only, outflow HALT); `lib/post-adapters.js:18-75` (beehiiv/Printful/Gumroad); `lib/ai-kill-switch.js` (spend gate only, does not touch send rails); Twilio/SendGrid/Mailgun ABSENT (stubs only, `handlers/leadgen.js:82`, `handlers/crm.js:13`).

**Python (no second implementation):** `api/limen.py:1-14,205-464` (distress scorer, 2 routes), `api/helix.py` to `api/helix_app/index.py` (EDGAR proxy + Thing1/Thing2), locked kernel `api/helix_app/thing1/limen_backtest.py` + `VALIDATION_LOCK.json`; wired at `vercel.json:53`; grep of `api/**.py` for the 5 functions found zero hits.

**Design doc that names all five intended roles:** `LIMEN_Helix_Neuro_Business_CrossRef.html:121-123,137-139,148,223-226,231-232,303,1837`.

---

## 8. What this audit did not determine

1. **The intended design spec.** Two untracked binary docs, `Isomorphism-Continued_M1-Latency-Spec-and-Fractal-Weight-Triage (1).docx` and `Neural-Business-Control-Isomorphisms_Research-Prospectus (1).docx`, plus `governance-pack.zip`, were not extracted. If the goal is to compare the build against the *documented* five-agent intent (not just the code), these need extraction. `CrossRef.html` already gives a strong proxy (it names all five roles), but the `.docx` triage/prospectus files may carry the authoritative per-domain agent decomposition. Resolution: extract and read the three binaries.
2. **Live configuration.** Whether the outreach keys (`RESEND_API_KEY`, `LOB_API_KEY`, `STRIPE_SECRET_KEY`, etc.) are actually set in Vercel, and whether `autopilot`/`homestead-automail` are currently armed in Redis, cannot be determined from the repo. This decides whether the two autonomous-send paths are live today or merely wireable. Resolution: check Vercel env + the Redis `autopilot:config`/homestead arm flags.
3. **Exhaustive read of the ~114-file per-domain advisory UI layer.** Sampled, not fully read. The sampled evidence is consistent (all browser-side, advisory, non-actuating), so the conclusion is high-confidence, but a claim of "zero autonomous agents anywhere in that layer" rests on sampling, not a full read. Resolution: a targeted second sweep of `assets/js/<domain>-*.js` if certainty is required.
4. **Runtime behavior.** This is a static read. Whether the dark-armed `action-selection-gate`, the paused sleep-cycle pruner, or the per-domain gain actuators behave as the code implies when running was not observed. Resolution: a gated, observed runtime trace (out of scope for a read-only audit).
