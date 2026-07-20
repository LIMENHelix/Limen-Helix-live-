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
