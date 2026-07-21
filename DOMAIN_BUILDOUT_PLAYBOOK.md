# Domain Buildout Playbook + Session Ledger

Internal, repo/history only (firewalled in `.vercelignore`). This is the single "what we did, where it lives, what's needed, repeat for the next domain" map. Energy is the fully-built template; every other domain is brought up to it by the checklist in section E.

Last updated: 2026-07-20.

---

## A. THE AUDIT/MAP DOCS (already in repo — read these first)

| Doc | What it holds |
|---|---|
| `AI_SYSTEM_MAP.md` | Every AI in the system, what it does, brain/nervous-system mapping, the two kill gates. |
| `ENERGY_BRAIN_MAP.md` | Energy domain deep map: reads, renders, self-regulation, self-audit, portal build; how close to a brain. The **port template** narrative. |
| `ENERGY_NEURO_AUDIT.md` | Energy vs `LIMEN_Helix_Neurology_Reference.html`, 100% accuracy pass, the list of impossibilities. |
| `SYSTEM_MAP.md` / `SYSTEM_MAP_FULL.md` | Full surface/layer inventory. |
| `HONO_ROUTE_MAP.md` | Every `/api/*` route in the single Hono catch-all. |
| `OPERATOR.md` | Operator-console intent. |

All firewalled. They are the durable record of the neurology audit and the Energy audit.

---

## B. WHAT WE BUILT THIS SESSION (file-level, all live on limenhelix.com)

**1. Energy autonomy actuations (the neurology mechanisms mapped to code)**
- `assets/js/domain-brains/energy-brain.js` — `this._actuation = { refractory, servo, eiBrake, phase }`.
  - E/I balance + self-audit consumption: `_computeEnergyRegulationAdvisories()` (lazy-loads the 81 edges from `assets/data/domains/energy.json`, runs SPOF self-audit).
  - Regulate-to-target servo (allostasis): `_computeEnergyServo()` (PI controller, `_servoIntegral`, effector = emissionFactor).
  - E/I brake actuation inside `_computeEnergyBrake` (pushes `ei-imbalance`, `eiFactor`).
  - Phase-coherence router + phase-transition reward: `_computeEnergyPhaseDynamics()` (patent §3.4 Loop-1 matrix `PHASE_M`; VALIDATED={p3,p7,p7a,p7b}); a validated transition PREEMPTS the call-ledger as K4 credit source.
- `assets/js/energy-ei-balance.js` — E/I controller (Ref XIII.1). Harnesses: servo/brake 8/8, phase 10/10.

**2. Venture engine — node → ANY-archetype business portfolio (the efferent arc)**
- `lib/venture-engine.js` — `generateVentures(opp)` → portfolio tagged {archetype, capital L1–L6, role, skillChain, standUp scaffold}. Archetypes: afferent-feeder, broker, affiliate-content, curated-readout, local-service, subscription, product-flip, licensed-data, owned-operation. Afferent-feeder always emitted (the L1 entry). `fundingChain()` = compounding. Option-(b) stand-up scaffold per venture. Word-boundary fix so "buyer" ≠ product-flip.
- `handlers/ventures.js` — `/api/ventures` (master-gated). POST {domain,opportunities[]} → generate + **persist to Redis `ventures:<domain>`** + return ladder-organized. GET → registry. `?standup=<id>` → scaffold.

**3. Operator console venture portfolio (the free deterministic surface)**
- `operator.html` — selecting a domain POSTs its sensed opportunity to `/api/ventures`; renders the live L1→L6 archetype portfolio (replaces the old static 3-rung), each card expandable to its stand-up scaffold. Per-domain client cache. No AI, no spend.
- `assets/js/gate-master.js` — auto-attaches master key to `/api/ventures` and `/api/ai-switch`.

**4. AI enabled + a visible spend switch**
- Operator set Vercel env `LIMEN_AI_ENABLED=1` + `LIMEN_AI_TOKENS_PER_TICK=50000` (both required; confirmed at `lib/ai-orchestrator.js:23,50`). Redeployed.
- `lib/ai-kill-switch.js` — `spendPausedRuntime()` (Redis `ai:spend:paused`), `spendDisabled()` = env OR runtime pause, `setSpendPaused()`. Env var is the HARD boundary; the switch is the SOFT instant pause inside it.
- `lib/ai-orchestrator.js` `call()` + 8 direct AI handlers now gate on `await spendDisabled()`.
- `handlers/ai-switch.js` — `/api/ai-switch` (master-gated): GET state, POST {paused}. Visible pill in the operator top bar: ON (green) / PAUSED (amber) / OFF-env (red).

---

## C. THE OPERATOR PAGE — what it does now, where things render

- **URL:** `https://limenhelix.com/operator` (static `operator.html`, master-gated by `gate-master.js`; non-masters bounce to `/`). Served natively via cleanUrls.
- **Flow:** sense → diagnose → select → launch. On load it fetches `/api/domain-snapshot` for real per-domain stress and re-ranks the 20-domain rail + "start here" strip.
- **Where the new venture stuff renders:** in the main panel, the section titled **"Venture portfolio · L1→L6 businesses this node supports."** It first shows an instant 3-rung skeleton, then upgrades to the live portfolio returned by `/api/ventures` (rungs L1-first, each venture card → "stand up ▾" reveals offer / landing sections / capture→/api/lead / storefront / skill-chain / first action / gated flag), plus a compounding funding sequence line.
- **Where the AI switch renders:** top bar, right side — the **"AI spend ON / PAUSED / OFF (env)"** pill. Tap toggles the runtime pause instantly (no redeploy).
- **Persistence:** venture portfolios persist server-side to Redis (`ventures:<domain>`); the switch state persists to Redis (`ai:spend:paused`). (Contrast: civilization brain state is ephemeral/in-browser — see D.)

---

## D. ENERGY → CIVILIZATION — verified flow + the one real gap

Civilization page = `https://limenhelix.com/civilization` (static `civilization.html`).

**Two data paths, NOT the same source:**
1. **Live clarity-view console panels — WIRED, updates every 30s, client-side.** Energy brain auto-starts on page load (`energy-brain.js:3093`), cycles every 30s (`cycleInterval:30000`), fires `limen:domain-brain-update` → `domain-brain-adapter.js` merges to `window.LIMENDomains.energy` (`brainStress`/`brainDiagnoses`/`brainOpportunities`) → `civilization/domain-packet-adapter.js` builds a civilization packet and the clarity view reads the same slot. **This is genuinely live.**
2. **Background connectome galaxy — STATIC, a real gap.** It fetches baked `assets/data/civilization.top.json` and seeds node stress **synthetically** (`civilization-connectome.js:1472,1493`). Live energy `brainStress` is **not** injected into the galaxy node coloring. The galaxy is decorative; the live data reaches only the console panels.

**Important nuance:** the brain runs in the visitor's browser, so "live" civilization state is recomputed per session and is NOT persisted to a shared server feed. Server crons (`vercel.json:4-11`) refresh feed DATA; the page recomputes from feeds in-browser.

**Energy portals:** 197 static `energy_*.json` in `assets/data/domains/` + a deep set in `assets/data/deep/` (access-map, quality-index, certified-cortex-index, directives, authoring-queue). Static/baked. `assets/data/energy-distress-scores.json` is regenerated **weekly** by `.github/workflows/energy-distress.yml` (Mon 16:00 UTC → `/api/energy-distress-ingest`). The portal files themselves are static, not generated at page load.

**So, honestly:** Energy → civilization console = correct + live (30s). Galaxy visual = static (does not reflect live energy). Portals = static, distress scores weekly. Two open items: (i) inject live `brainStress` into the galaxy node coloring; (ii) persist a server-side civilization snapshot if we want cross-session/shared state.

---

## E. THE REPEATABLE NEXT-DOMAIN CHECKLIST (Energy = the template)

To bring domain **X** up to Energy's level:

1. **Feeds:** confirm X's live data desk (`handlers/<x>-live.js` / `<x>-markets` / distress ingest). Energy = EIA + NREL + weekly distress Action.
2. **Brain:** create `assets/js/domain-brains/<x>-brain.js` extending `window.LIMENDomainBrainBase` (or the generic adapter for advisory-only). Port the K1–K8 layers + HALT/TRUTH brakes from `energy-brain.js`. 19/20 domains already carry the advisory neuro-substrate (agriculture excluded).
3. **Actuations (only where the domain has a real effector + validated signal):** E/I brake + servo need a controllable output; the phase router/reward need P3/P7 ground-truth (Thing1-validated) to be more than advisory. Gate everything behind `this._actuation` flags. Do NOT claim validation outside the envelope.
4. **Edges/self-audit:** ensure `assets/data/domains/<x>.json` has the node/edge graph so `_compute...RegulationAdvisories()` can run the SPOF self-audit (Energy lazy-loads 81 edges — replicate the pattern, don't read from the snapshot which has no edges).
5. **Civilization wiring:** the brain→adapter→packet path is generic; once the brain fires `limen:domain-brain-update`, `domain-packet-adapter.js` picks X up automatically. Verify `window.LIMENDomains.<x>` gets `brainStress/Diagnoses/Opportunities`.
6. **Operator console:** X is already one of the 20 `D[]` entries in `operator.html`; its venture portfolio works the moment the entry has `biz/blurb/node/buyer/ladder`. No per-domain code — the `/api/ventures` POST is generic.
7. **Portals:** static `<x>_*.json` in `assets/data/domains/`. Regenerate/enrich as needed; the build queue stays operator-pulled (not auto-cron) per the cost rule.
8. **Stress source (added 2026-07-20, full detail `ENERGY_REFERENCE.md` §N):** X's `groundedStress`/
   `phaseBelief` are ALREADY live and grounded on `/api/limen-snapshot?type=console` — the CISS composite +
   precision-weighted phase fusion run for all 20 domains unconditionally, no per-domain code. What Energy
   alone has: (a) the promotion that makes the fused belief X's DISPLAYED `dsum.stress` instead of the old
   feed-volume number (one guard clause, `limen-worker-snapshot.js:284`, currently `pk==='energy'` only),
   and (b) a live market-channel + typed feed-fractal enrichment (energy-specific network calls; only add
   an equivalent if X has a real live public price/index series — abstain if not, don't force one). Do NOT
   port the promotion for a domain until you've confirmed on TWO consecutive worker ticks (5 min apart) that
   `est.grounded` is reliably true and `stress !== _legacyFeedStress` — the first tick after any deploy can
   still be running old code and looks identical to a broken promotion.

**Rule of thumb:** the ENGINE is one; per-domain work = (a) feeds, (b) a brain JS with the right weights, (c) an edge graph, (d) honest actuation gating, (e) [new] flip the stress-promotion guard once a domain's live grounding is confirmed reliable. Everything downstream (adapter, civilization packet, operator venture portfolio, AI switch) is shared and already built.

---

## G. PORT SCOPE — the fence (2026-07-21)

Read this BEFORE running the 19-domain port. It exists because the last rollout dropped a domain
*silently*; every exclusion here is deliberate, named, and has a stated re-entry condition.

### G.1 IN SCOPE: 18 domains
agriculture, communication, culture, defense, economy, education, environment, finance, governance,
industry, intelligence, law, medicine, population, religion, science, technology, trade.
(energy = the reference/source; infrastructure = fenced, see G.2.)

### G.2 ISOLATED: `infrastructure` — DO NOT PORT, DO NOT TEMPLATE OVER
Deliberately excluded 2026-07-21 by operator decision ("skip over infrastructure, we can come back,
isolate it"). It is NOT skipped-by-accident and NOT broken. It carries two things no other domain has,
and a templated port would either destroy them or spread them:

1. **`INFRA_PORTAL_TO_BRAIN`** (`assets/js/domain-identity.js`). Infrastructure's portal issue IDs
   (`GRID_FAILURE`, `BRIDGE_COLLAPSE`, `WATER_CRISIS`, `TELECOM_OUTAGE`, `TRANSIT_BREAKDOWN`) and its
   `diagnosisIndex` keys (`GRID_DEGRADATION`, `MAINTENANCE_DEFICIT`, …) are **disjoint by construction**
   (asset-class vs failure-category vocabularies, ZERO overlap). It is the ONLY domain in this state:
   18 of 20 match 100%; medicine's single gap (`MENTAL_HEALTH_CRISIS`) is deliberate and documented at
   `medicine-brain.js:135-138`. On 2026-05-25 the other 19 domains had portal IDs added directly into
   `diagnosisIndex`; infrastructure got a translation map instead. Both work; infrastructure is the outlier.
   It is also the only domain overriding `deriveDiagnoses` (`infrastructure-brain.js:508`).
   **PORT RULE: never propagate this map. It is dead code in all 18 targets.**
   Without it infrastructure reports "STRESSED / NO DX MATCH" on every diagnosis — the map is load-bearing.

2. **A self-misdiagnosing comment** at `infrastructure-brain.js:451-452`, which claims *"feed values
   arrive as index levels (100 = FRED baseline), not deltas."* **This is factually wrong.** All three of
   its FRED feeds emit `pctChange` (`handlers/domain-snapshot.js:2577, 2594, 2612`); infrastructure is one
   of only ~5 domains anywhere that receives deltas at all. The real reason its filters rarely fire is
   (a) keyword-vocabulary mismatch — the filters key on `maintenance`, `backlog`, `substation`,
   `transformer`, `deferred` etc., which appear in NONE of its 18 feed names — and (b) magnitude gates set
   for the wrong scale (`port` matches "FRED Trans**port**ation Index" but the gate needs `value > 3`
   while monthly freight pctChange runs under 1).
   **PORT RULE: do not copy that comment or its reasoning anywhere.**

**Re-entry condition:** infrastructure returns to scope once (a) its feed filters are re-keyed to the
feed names it actually receives, and (b) its magnitude gates are recalibrated to pctChange scale. Until
then it stays on its own path. Nothing about it is blocking the other 18.

### G.3 PORT RULE: resolve domain keys, never concatenate them
`assets/js/domain-identity.js` gained a **dual export 2026-07-21** (was browser-only; `require()` threw
`window is not defined`). That was the ROOT CAUSE of agriculture falling out of the 19/20 neuro-substrate
rollout: the node generator could not load the alias table, fell back to globbing
`assets/data/domains/<domain>.json`, and agriculture's file is `p2_agri.json`.

**`p2_agri` is CORRECT and STAYS.** It has live downstream consumers (`cross-domain-audit.js:1171`,
`observatory-aggregator.js:45`, `company-portal-ui.js:11,54,803`, the connectome portal URLs). Do not
rename it, do not migrate it, do not "fix" it.

Any generator or port script MUST resolve, never string-build:
- `portalKey(d)` for portal / graph / issue data — agriculture → `p2_agri`
- `snapshotKey(d)` for runtime / API reads — trade → `supplyChain`, science → `research`, medicine → `health`
- `canonical(k)` to normalize an unknown key back
- `warnIfAlias(k, ctx)` is the existing guardrail for catching stale usage

This covers all FOUR alias domains. A glob-based generator doesn't just skip agriculture; it silently
mis-keys trade, science and medicine, which is quieter and worse (you get an artifact keyed to nothing).

### G.4 PORT RULE: do NOT copy stress-derived condition blocks
Every target domain already has one. Audited 2026-07-21: **19 of 20 domains** push condition tokens as a
pure function of `state.stress` crossing thresholds; **16 do it in the live, diagnosis-activating form.**
Energy is the sole abstainer (consistent with its stress-source rework). Infrastructure's 0.40 floor is
among the most conservative; medicine fires at **0.15**, and communication/culture/education/technology/
intelligence at **0.20**.

**OPEN CORRECTNESS ITEM, deferred to the operator (not a port task):** in those 16 domains the
diagnoses are a relabeling of one scalar, not independent findings. Worst case is culture and religion,
which have ZERO numeric stress drivers and are permanently capped at stress 0.3 by the LOW_SIGNAL guard
(`domain-snapshot.js:1624-1633`) yet still synthesize conditions at 0.20 — fabrication on top of a number
that could not mean anything.
The remediation already exists and is enforced: `_`-prefixed tokens are filtered out of diagnosis
evidence at `domain-console-brain.js:594-597`. Agriculture, economy and finance were remediated this way;
the other 16 were not. Applying it is mechanical.
**Consequence the operator must accept before it is applied: those domains will show far fewer active
diagnoses, several possibly zero. It does not break the site; it reveals how much was already empty.**

### G.5 THE WEIGHTING — what the research produced, and what actually transfers

The research-derived weighting is the highest-value thing energy produced. The good news, verified
2026-07-21: **most of it already reaches all 20 domains and needs NO port work.** It was written into
shared modules, not into energy. Do not re-derive it, do not copy it per domain, do not "port" it.

**ALREADY FLEET-WIDE (shared modules, zero per-domain work):**

| Weighting | Where | Provenance | Reaches |
|---|---|---|---|
| `CHANNEL_WEIGHTS = {distress:0.45, unison:0.30, granularity:0.25}` | `lib/grounded-stress.js:60` | CISS composite (Holló/Kremer/Lo Duca 2012) | all 20 — `limen-worker-snapshot.js:186` computes per `pk` with no domain gate |
| `EWMA_LAMBDA = 0.93` | `lib/grounded-stress.js:62` + `lib/phase-estimator.js:26` | CISS, fitted to a 5-dim IGARCH on demeaned subindices | all 20, both modules |
| `CDF_MIN_SAMPLE = 8` | both modules | below this a CDF rank is too coarse to mean anything | all 20 |
| `PRECISION_FLOOR = 0.5` | `lib/phase-estimator.js:28` | total precision below this ⇒ ABSTAIN (this is what makes unscored domains stay silent instead of guessing) | all 20 |
| `STUCK_ALPHA = 0.5` | `lib/phase-estimator.js:29` | blend of transition-blockage vs external distress | all 20 |
| Interoception `W` `{financial:1.0, prediction:.85, regulation:.7, metacognitive:.75, immune:.6, allostatic:.6}` | `domain-brain-base.js:1377` `INTERO_WEIGHTS_DEFAULT` | — | all 20; base comment states "Every domain uses the default today". Values are IDENTICAL to energy's own `W` at `energy-brain.js:3210`. |

So the precision-weighted fusion, the CISS channel blend, the abstain floor and the interoception
profile are already every domain's inheritance. What is gated per-domain is only the **promotion**
(`STRESS_PROMOTION_DOMAINS` in `handlers/limen-worker-snapshot.js`), i.e. whether the fused result
becomes the DISPLAYED `dsum.stress`. Grounding computes for 20/20; only energy is promoted.

**DEFAULT POSTURE: CARRY EVERYTHING ENERGY HAS.** Operator direction 2026-07-21: *"Keep all
information including documents researched and built for energy across all other domains... stay with
energy parts."* The exceptions below are NARROW and each has a stated reason. Do not invent new ones,
and do not strip a part out because it looks domain-flavoured — most of energy's naming is historical,
not semantic (see the three modules renamed `limen-*` on 2026-07-21 for exactly this reason).

**K-layer seeds — CARRY THEM. (Corrected 2026-07-21; an earlier draft of this section wrongly said
copying energy's seeds was unsafe. Verified against the code, they already agree.)**

| Layer | Generic base | Energy | |
|---|---|---|---|
| gain | `K_gain [0.5]` (`domain-brain-base.js:1064`) | `K2_gain [0.5]` (`energy-brain.js:2543`) | **identical** |
| slow | `K_slow [GK_SLOW_RATE = 0.08]` (`:1048,1065`) | `K3_slow [0.08]` (`:2545`) | **identical** |
| attention | `K_attention [0.5, 0.4, 0.1]` (`:1064`) | `K6_attention [0.5, 0.4, 0.1, 0.5]` (`:2552`) | **identical + a 4th (`focusBoost`)** |
| forecast | `GK_FORECAST_WINDOW 12 / HORIZON 8` (`:1048`) | `EK_*` window 12 / horizon 8 | **identical** (`ENERGY_REFERENCE.md` D.3 says "usually reuse") |

Energy's seeds ARE the generic seeds where the two overlap. The port delta is that energy runs **8**
layers against the generic **4** — it ADDS `K1_pressure`, `K4_lr`, `K5_pe`, `K7_inhib`, `K8_floor`. So
carry all 8 across; nothing is being overwritten with a foreign prior.
The one real check per domain: the seed is a Bayesian prior, so IF a domain genuinely runs a different
live static constant for one of these, seed that layer from its own value. Verified today, none do.

**Genuinely NOT transferable (narrow list):**

1. **The market channel.** Energy's is FRED WTI (`lib/energy-market-feed.js`). Its measured
   precision/recall (0.70 / 0.08, from the 40-year leakage-safe backfill) is a property of WTI, not of
   the method. Most domains have NO equivalent public series — **abstaining is correct, do not force one.**
2. **Feed-fractal category keywords.** The mechanism (`lib/feed-fractal.js`) is generic and DOES carry;
   only the regex/keyword sets per category are domain-specific text that must be rewritten per domain.
3. **Per-domain interoception overrides.** `INTERO_WEIGHTS_BY_DOMAIN` ships EMPTY by deliberate design.
   The base comment: *"to be CALIBRATED from real divergence-resolution data, never hard-coded as if
   measured, so the table ships empty until that data exists."* Do not hand-populate it. A hand-tuned
   number presented as a calibrated one is the exact failure this project keeps catching.

**The honest summary:** the research gave the fleet ONE good, sourced default. It is already installed
everywhere via the shared modules, and energy's own seeds match it — so CARRY EVERYTHING and expect
almost nothing to conflict. Exactly three things are genuinely per-domain: whether a live market series
exists, the feed-fractal keyword text, and the (deliberately empty) calibrated interoception table.

What the research did NOT give is 20 CALIBRATED profiles, and the code deliberately refuses to fake
them. That is real outstanding work needing real divergence-resolution data per domain. It is not a
port task and cannot be done by copying — but it also does not block the port, because the shared
default is already sound and already everywhere.

---

## F. PENDING / NEXT

- Galaxy node coloring off live `brainStress` (civilization gap ii above).
- Optional server-side civilization snapshot for shared/cross-session state.
- AI-deep venture stand-up (build the actual L1 capture page from a scaffold) — needs AI ON (now enabled) + a "run"; keep SEND/SPEND gated.
- `/api/lead` last-mile from a stood-up L1 feeder (capture page already points at `/api/lead`).
- Repeat section E for the next domain after Energy (candidate: Finance — already the most-validated desk).
- **Stress-source promotion (E.8) is unclaimed for all 19 non-energy domains.** Grounding already runs
  (confirmed live 2026-07-20: 20/20 domains `groundedStress.grounded=true`, `baselineDepth=16` past the
  CDF threshold), so this is cheap relative to E.2-E.4 — mostly a per-domain judgment call on whether a live
  market/index channel exists, then one line flipping the promotion guard. Finance is the obvious first
  candidate (already Tier-A truth-eligible, most real external data of the 19).
- One domain, `population`, currently reads `groundedStress.stress=1` in production — unexplained, not yet
  investigated (`ENERGY_REFERENCE.md` §N.10/§N.12).
