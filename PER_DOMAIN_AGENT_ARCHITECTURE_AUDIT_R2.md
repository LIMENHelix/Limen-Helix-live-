# LIMEN Helix, Per-Domain Agent Architecture, Forensic Audit ROUND 2

Read-only follow-up to `PER_DOMAIN_AGENT_ARCHITECTURE_AUDIT.md` (round 1). Closes the four open questions round 1 named, plus one new falsifiability test. No code was changed. Every claim traces to file:line. Compiled 2026-07-15 by five dedicated read-only agents (one per item below). This document extends round 1; it does not repeat it.

Status legend: CONFIRMED / PARTIAL / ABSENT / UNCLEAR. Each finding is tagged REVISES (changes a specific round-1 claim) or ADDITIVE (new, round-1 stands).

---

## 1. Executive summary

Round 2 does not overturn round 1's core conclusion: the five documented roles were built as sub-computations of one domain-brain object per domain plus a few shared services, not as five distinct per-domain agents. Round 2 sharpens or corrects five specific points.

- **One factual correction:** round 1 called the action-selection-gate "dark by default." It is actually **armed by default on the console and domain-console pages** (`assets/js/limen-bootstrap.js:33`). This is immaterial to risk because even when armed it hard-pins `executionAllowed:false` and only emits a client-side event, but the round-1 wording was wrong.
- **The highest-priority open question is resolved at the code-default level:** on a fresh deploy with no operator action, neither autonomous-send path can fire (both default `armed:false`). What static analysis cannot see is whether an operator already armed them in live Redis; that is answerable by one unauthenticated GET (section 3).
- **`spine.js` is a genuine third structure**, live and operator-reachable but wholly non-actuating: a server-side sales-surfacing hub. It does not give item 1 a second live veto (it cannot suppress an outward action because none is wired downstream), and it strengthens item 4's ABSENT by being an active centralizer, the opposite of a lateral peer channel.
- **The three unread binaries do not contain the five-agent spec** (round-1 open question closed). They are a neuroscience research prospectus, its M1-latency/fractal-weight addendum, and a portable, uninstalled autonomy-safeguard pack. But the addendum ranks the exact brake round 1 filed as "expected-absent" (the M8 anti-reward/loss-cutting brake) as the **number-one thing to build**, which reframes that absence.
- **The differentiation collapse is an object/lifecycle boundary problem, not a logic-fusion problem.** The five roles are already separate, single-responsibility methods; what is fused is the shared-state blackboard and the single tick, not the arithmetic. That makes a future split easy-to-moderate, not a rewrite.

Net: round 1's map holds. Round 2 corrects one detail, closes the live-vs-dormant question at the default level, and makes two soft findings hard (the missing M8 brake is the source docs' top priority; the collapse is separable).

---

## 2. The five findings

### Finding 1, `handlers/spine.js` given its own pass. ADDITIVE, with a minor REVISION to round-1 item 1.

**What it is (CONFIRMED, High).** A single Hono handler (`handlers/spine.js:134`), action-dispatched by `?action=`, backed only by `lib/limen-db` (`:25`). No AI, no send/trade/payment rail anywhere in the file (confirmed by full read: no `fetch`, no `crm-send`, no Lob, no Stripe). It implements SENSE to WEIGHT to GATE to RANK over sales "cells":
- SENSE: reads `console_snapshot`, `sales:companies`, `leadgen:index`, `leadgen:lead:<id>` (`:33-41`).
- WEIGHT: `domainSignals()` sets per-domain dysregulation `weight = MAX(structural stress, live event magnitude, operator override floor)` (`:85-115`, max at `:96`).
- GATE: `resolveCell()` fires a cell when `cfg.enabled && cell.enabled && domainWeight >= threshold` (default 0.5) (`:117-132`).
- RANK: `action=opportunities` scores `domainWeight x (lead.score/100)`, sorts, returns top slice (default 25, cap 100) (`:185-212`).
- Operator floor: `action=override` pins a per-domain dysregulation floor into `spine:overrides` (`:243-251`); the only way an operator forces cells to fire, and it is manual, not autonomous.
- Two-speed autonomy: cells default `enabled + recommend`; `mode='control'` only changes the reported state string to `firing-control` (`:130`); the header states plainly "until actuators are wired to it, still only surfaces, nothing here sends, trades, or moves money" (`:13-16`).
- Kill/config: global `action=kill/arm` toggles `spine:config.enabled` (`:254-261`); per-cell `action=cell` writes `spine:cells` (`:227-238`).
- Auth: only `action=status` is public (`:140-149`); all mutating actions require `SALES_ADMIN_KEY` or `LEAD_ADMIN_KEY` (`:151-154`), else 503.

**Call graph (CONFIRMED).**
```
Callers of /api/spine:
  api/[...route].js:32 ........ registers 'spine' (only server entry)
  command.html:130 ........... SOLE client caller: fetch('/api/spine?action=...&key=...')
  vercel.json crons .......... NONE
  .github/workflows/* ........ NONE
  => spine runs only when an operator opens command.html and enters the admin key.

spine READS (via lib/limen-db):
  console_snapshot ........... written by handlers/limen-worker-snapshot.js:109 (cron, vercel.json:6)
  sales:companies, leadgen:* . written by handlers/leadgen.js
spine WRITES (private to itself; read by NO other handler):
  spine:config, spine:cells, spine:overrides  (:222,237,249)
spine REQUIRES: ../lib/limen-db only. No other lib, no AI, no send rail.
```

**Revision to round-1 item 1 (inhibitory override):** minor. Round 1 §3 called `action-selection-gate.js` "the one true winner-take-all veto." There are actually **two global gates at different layers, neither actuating in production**: `action-selection-gate.js` (client-side, autonomous, over brain action-drafts) and `spine.js` (server-side, operator-driven, over sales-cell surfacing). Spine cannot suppress an outward action because nothing downstream of it actuates. So it is a second inhibitory *locus* but not a second live *veto over anything external*.

**Effect on round-1 item 4 (lateral sales channel):** CONFIRMS and strengthens ABSENT. `action=board` (`:157-173`) is a single central reader that pulls all 20 domains and ranks centrally. There is no domain-to-domain message passing. Spine is itself the hub; it is an active centralizer, which would compete with (not become) any future lateral sales router.

**Overlap:** spine duplicates neither `action-selection-gate.js` (parallel gate, different layer/substrate/trigger, no shared code) nor `inter-brain-bus.js` (spine is a downstream consumer of the server snapshot artifact; the bus is client-side lateral distress transport). Distinct third structure.

### Finding 2, the three unread binaries. CONFIRMED, closes a round-1 open question and sharpens two findings.

**Round-1 §8 item 1 resolved (CONFIRMED):** none of the three specifies the five-agent-per-domain architecture. `LIMEN_Helix_Neuro_Business_CrossRef.html` remains the only doc that names all five roles. Round 1's reliance on it as the sole documented-intent proxy is validated.

**What they actually are:**
- `Neural-Business-Control-Isomorphisms_Research-Prospectus (1).docx` (161 paras, 3 tables): a neuroscience research prospectus grading 12 control motifs M1-M12 (neural substrate, control primitive, business instantiation, failure poles, KNOWN/PROBABLE/POSSIBLE rating, anchor cases: Barings, Archegos, London Whale, Knight, Wells Fargo). Ranked start targets M1 > M8 > M3 > M6 > M4. Table 2 rules the corpus callosum an EDGE (communication channel: interbank rails, clearinghouses, EDI), not a node.
- `Isomorphism-Continued_M1-Latency-Spec-and-Fractal-Weight-Triage (1).docx` (60 paras, 6 tables): the only doc with a concrete numeric spec. Part A splits M1 into memory-gating vs a stop-signal race, defines loop latency L = SSRT and criterion rho = L(stop)/(t_go_finish - t_stop_onset) with an a-priori critical value **rho\* = 1** (rho < 1 inhibition wins, rho >= 1 failure; Archegos rho ~ 1+, survivors rho < 1). Part B triages the 12 motifs: only M6, M8, M11 bear "fractal weight" (human-suboptimality signature); the rest are control-theory-generic. Spending recommendation: entire budget to M6/M8/M11, "M8 is the place to start." Catch #3: the M2 gain-broadcast mapping is "structural on the fan-out, cosmetic on the transform."
- `governance-pack.zip` (5 files): a portable Claude-Code autonomy-safeguard pack. `guard.py` PreToolUse blocker with two red lines, money movement (Stripe/PayPal/Venmo/Wise/Plaid patterns, `guard.py:29-34`) and data deletion (`rm -rf`, `DROP TABLE`, force-push, `vercel remove`, etc., `:37-54`), whitelisting deletes confined to `/tmp`, `node_modules`, `dist/` (`:85-95`); `audit.py` PostToolUse logger; `settings.template.json` deny-list + hook registration; a DRAFT-FIRST autonomy `CLAUDE.md`; a README. **Verified NOT installed in this repo** (grep/find: no `guard.py`/`audit.py`, no `.claude/settings.json`, no `.claude/hooks/`). It is a standalone template ("install into any project"), enforcement aspirational.

**Intent-vs-code divergences (each CONFIRMED against round-1 evidence):**
1. **M1 brake threshold rho\*=1 is unimplemented.** Docs specify a stop-signal race with measured latency and an a-priori failure line; code's per-domain brake is a conscience/hold/dedupe gate (`domain-brain-base.js:1040-1130`) with no SSRT, no rho, no latency race. Whole-repo grep for the mechanism hits one static node label (`scripts/build-canonical-nodes.mjs:61`), not a mechanism.
2. **M8 anti-reward brake is the docs' #1 build target and is absent in code, which does the inverse.** Doc 2 ranks M8 first to build; round-1 §6 confirmed it expected-absent, and `lib/sales-engine.js:172-198` has an exploration floor that "never starves a losing play to zero," structurally the opposite of a loss-cutting brake. This is the sharpest divergence.
3. **Gain directionality inverted.** Docs designate ONE org-wide gain broadcaster (M2, one-to-many); code built per-domain gain in all 20 brains (actuating in only 3) and left the single global `limen:system_gain` inert (`handlers/system-gain.js:3-8`). The locus the docs name as the gain node is the one left inert. (Softened by Doc 2 Catch #3, which itself calls that mapping "cosmetic on the transform," so the inert global is a mapping the source already flagged as weak.)
4. **Lateral channel as *sales* has no documentary support either.** Docs intend only a lateral communication edge (corpus callosum = rails/EDI); code's `inter-brain-bus.js` carries distress, which matches the doc. It is round-1's target spec ("lateral *sales* channel") that neither code nor doc supports.

**Revision effect:** REVISES the tone of round-1 §6. The anti-reward brake absence was filed as "expected, not a defect" (deferred in design). Doc 2 flips the framing: the source science ranks that exact brake as the highest-value, first-to-build motif. The absence is still real; "expected/low-priority" should be re-read as "missing the source docs' own number-one target." ADDITIVE otherwise.

### Finding 3, live-vs-dormant state. See section 3 for the consolidated determination. REVISES one round-1 detail (the gate default).

### Finding 4, the per-domain advisory UI layer. REVISES two round-1 details; core characterization holds.

**Count correction (CONFIRMED):** round 1 said "~114 files." The six enumerated families total **101**: `*-targeting-engine.js` (20), `*-clarity-operator.js` (20), `*-directive-ranker.js` (20), `*-node-business-engine.js` (20), `*-business-build.js` (20), and `*-opportunity-matrix.js` (**1**, agriculture only, not a 20-domain family). The rest of round-1's ~114 were other `<domain>-*.js` siblings (agent boxes, brain runtime) in a different layer.

**Action-trigger verdict (CONFIRMED via exhaustive grep of all 101 files for `fetch(`, POST/PUT/DELETE, `localStorage.setItem`, `dispatchEvent`, `postMessage`, `XMLHttpRequest`, `sendBeacon`):** no file in any family issues a backend-mutating request. Every `method:'POST'` in `assets/js/` lives outside these families. So "not autonomous agents, non-actuating on the outside world" is CONFIRMED.

**Precision revision:** round 1 called them "purely display/read surface." That is imprecise. They do write **browser-local** state (clarity-operator status maps `localStorage.setItem` at e.g. `agriculture-clarity-operator.js:239`; node-business-engine operator approvals with `reviewed_by:'operator'` at `medicine-node-business-engine.js:632-636`; business-build worksheets/print-mode) and fire same-page `CustomEvent`s. All of it stays inside the browser, per-device, never synced to server. So "non-actuating on the outside world" is correct; "purely display" is not.

**Operator-trust finding (ADDITIVE, actionable):** the clarity-operator, node-business-engine, and opportunity-matrix panels read the **live** brain runtime (`window.LIMENDomainBrains.get('<domain>').getState()`, e.g. `agriculture-node-business-engine.js:1039-1054`) but blend in **baked static JSON** (`/assets/data/deep/*`, `/assets/data/domains/*`, `command-board-data.json`, `/api/fetch-portal` GET) with no visual distinction, so part of a "live" panel can be a stale snapshot. Aggravated by the runtime-vs-portal key duality round 1 flagged (`medicine-node-business-engine.js:647` calls `brains.get('health')` while siblings use portal keys, so a wrong key silently yields empty state). The targeting-engine and directive-ranker families instead read static taxonomy (`window.LIMENTaxData`) and directive-ranker returns `[]` unless `window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION` (dark by default), so they can look domain-live while being inert.

### Finding 5, differentiation collapse made falsifiable. REVISES the *interpretation* of round-1's central synthesis (not its facts).

**Verdict: the collapse is primarily an object/lifecycle-boundary issue, NOT genuine logic fusion. Confidence High.**

The base tick `cycle()` (`domain-brain-base.js:319-343`) is a strictly sequential chain of named, individually-overridable methods: `ingestFeeds -> normalizeSignals -> scoreStress -> deriveDiagnoses -> recommendTreatments -> surfaceOpportunities -> emitCrossDomainSignals -> updateMemory`, then `_applyRequestSteer -> _computeGenericKStack -> _applyGenericBrakeGate -> _computeGenericInteroception`. Each of the five target roles is a distinct method, not a branch inside one pass. Energy/Finance/Culture each add a role sequencer (`_computeEnergyNeuroLayers` at `energy-brain.js:2329-2345`; `_computeFinanceNeuroLayers` at `finance-brain.js:1449-1483`; `_computeCultureNeuroLayers` at `culture-brain.js:935-968`) that calls K1-K8 + servo + brake + phase as separate sequential calls and publishes a `closedLoops[]` manifest enumerating each stage's single cross-stage write (e.g. `energy-brain.js:2364-2372`). That manifest is direct evidence the roles are enumerably separable.

The coupling that *did* collapse is a **shared-mutable blackboard**: every stage reads/writes `this.state.*` and `this._*` with a deliberate one-cycle lag. The single shared effector is the `s.opportunities` array, which SALES generates, OPS brakes, GAIN caps, LATERAL appends a cross-domain tier to, and refractory gates, all mutating one array in one cycle (Energy: servo writes `emissionFactor` at `:2176-2207` -> brake reads it at `:2600-2648` -> `_applyNeuroGating` slices the same array at `:2558-2588`). The one genuinely fused function per brain is the recurrent-model updater (`_updateEnergyModel`, `_updateFinanceModel` at `finance-brain.js:1488+`, `_updateCultureModel` at `culture-brain.js:437-578`), which computes prediction-error + regulation + the K4 reward gate in one pass over a shared model object, though even it delegates actuation to separate `_compute*`/`_apply*` helpers.

**Rebuild difficulty (the point of the test):** split into per-role modules sharing `this.state` is EASY-MODERATE (methods are already namespaced and mechanically movable); split into separate services with message-passing is MODERATE-HARD (must convert ~7-10 enumerated cross-stage blackboard reads per brain into message contracts and reproduce tick ordering), but bounded by the `closedLoops[]` manifests, not a rewrite. The three brains differ: **Energy** has the tightest live coupling and the only actuating gain, hardest to split and most worth it; **Finance** is the easiest cut because half its ported effectors are inert (`_computeFinanceGainControl` is `shadow:true`, no `_applyNeuroGating`, no autonomous emission); **Culture** is the most separable and least consequential (gain shadow, phase advisory `_actuation.phase=false`, sales role neutralized to `[]` at `:226`).

This REVISES the *reading* of round 1: "one domain-brain object per domain" is an object/lifecycle collapse, not a logic collapse. The neuro-to-business roles were built as separable methods and never fused; they were simply never given separate object boundaries or separate ticks.

---

## 3. Live vs dormant determination (the priority question)

**Determination: at the code default, on a fresh deploy with no operator action and no Redis seeding, no path performs an autonomous outward action.** Two of the three are disarmed by code default; the third cannot act outward even when armed. What static analysis cannot resolve is the live Redis arm state of the two send paths, which is answerable by one unauthenticated GET.

| Path | Arm mechanism | Code default (fresh deploy) | What flips it live | Who | Outward reach when "on" |
|---|---|---|---|---|---|
| `action-selection-gate.js` (client veto/broadcast) | browser global `window.LIMEN_ENABLE_ACTION_GATE` | **ARMED on console + domain-console pages** (`limen-bootstrap.js:33` sets it true inside the `isConsole/isDomainConsole` block); dark/undefined on all other pages | page load of civilization/root/domain-console (automatic, no auth) | anyone loading those public pages | **None.** `executionAllowed:false` hard-pinned (`action-selection-gate.js:189`); armed only dispatches a client-side `limen:action-selected` event, no server touch |
| `handlers/autopilot.js` (Resend email, Vercel cron `7,37 * * * *`) | Redis `autopilot:config` fields `armed` + `mode` | **DARK** (`armed:false, mode:'recommend'` when key absent, `autopilot.js:54`; tick no-ops if not armed, `:253`; send needs `mode==='control'`, `:196`) | `POST /api/autopilot?action=config {armed:true, mode:'control'}` with admin key (`:289-296`) | `SALES_ADMIN_KEY` or `LEAD_ADMIN_KEY` (`:246`) | Templated email, only if also `RESEND_API_KEY` + verified non-sandbox from-domain (`crm-send.js:19-35`); not behind the AI kill-switch (`:182-184`) |
| `handlers/homestead-automail.js` (Lob mail, GitHub Action daily 11:45) | Redis `homestead:automail` field `armed` | **DARK** (`armed:false` when key absent, `:67`; send no-ops if not armed, `:116`) | `POST /api/homestead-automail {armed:true}` with admin key (`:135-150`) | `LEAD_ADMIN_KEY` (`:60`) | Physical letters, only if also `LOB_API_KEY` + a return address, else dry-run (`:117,128-129`) |

**Deploy-config sweep:** no cron, workflow, or script arms any of the three. `vercel.json:10` only invokes `/api/autopilot` (which self-checks `armed`); `.github/workflows/automail.yml:24-26` POSTs `action=send` but does not arm; `scripts/automail-run.js:44-45` only reads the flag and is not wired to any workflow. No `.env` in repo, so env values are unknowable statically.

**What cannot be determined from the repo, and exactly what resolves it:**
1. Live `autopilot` arm state: `GET https://limenhelix.com/api/autopilot?action=status` (unauthenticated, `autopilot.js:237-243`) returns the `config` plus `keyConfigured`/`emailReady` booleans, resolving both arm state and Resend-key presence with zero credentials.
2. Live `homestead-automail` arm state: `GET /api/homestead-automail?key=<LEAD_ADMIN_KEY>` returns `{armed}` and `hasLobKey` (`:155-160`); needs the admin key.
3. Vercel env values (`RESEND_API_KEY`, verified from-domain, `LOB_API_KEY`, return address): the two status endpoints above expose presence booleans without leaking values; anything more needs the Vercel env dashboard or a `.env`.

I did not perform these requests; they are the operator's to run. The determination that both send paths are code-default DARK stands regardless.

---

## 4. Round-2 evidence appendix (round-2 citations only)

**Spine:** `handlers/spine.js:13-16,25,31,33-41,57,67-79,81-84,85-115,117-132,134,138,140-154,157-173,185-212,217-224,227-238,243-251,254-261`; callers `api/[...route].js:32`, `command.html:130`; upstream writers `handlers/limen-worker-snapshot.js:109`, `handlers/leadgen.js:184,472,479`; cron ref `vercel.json:6`.

**Docs:** extraction artifacts in scratchpad (`iso_m1.txt`, `prospectus.txt`, `govpack/`); prospectus motifs M1/M2/M8/M11 and Table 2 (edge ruling); addendum Part A (L=SSRT, rho\*=1, Tables 1-3) and Part B fractal triage (M6/M8/M11, "M8 is the place to start", Table 4) and Catch #3; govpack `guard.py:29-34,37-54,57-61,85-95`, `audit.py`, `settings.template.json`, `CLAUDE.md`, `README.md`; not-installed verified by repo find/ls (no `guard.py`/`audit.py`, no `.claude/settings.json`, no `.claude/hooks/`); divergence 1 grep `scripts/build-canonical-nodes.mjs:61`; divergence 2 `lib/sales-engine.js:172-198`; divergence 3 `handlers/system-gain.js:3-8`.

**Live-vs-dormant:** `assets/js/limen-bootstrap.js:22-23,31,33`; `assets/js/action-selection-gate.js:31,167-176,178-211,189`; `handlers/autopilot.js:34,54,182-184,196,231-233,246,253,258-259,289-296`, cron `vercel.json:10`; `handlers/homestead-automail.js:14,60,65,67,74-75,77,82,96,115-117,128-129,135-150,155-160`, workflow `.github/workflows/automail.yml:9-10,24-26`; send guard `lib/crm-send.js:19-35`; status routes `autopilot.js:237-243`, `homestead-automail.js:155-160`.

**Advisory UI:** family counts by glob (20/20/20/20/20/1 = 101); shared factories `assets/js/domain-taxonomy/shared-targeting-engine.js`, `shared-directive-ranker.js`, `finance-targeting-engine.js:9`, `finance-directive-ranker.js:9`; local-write sites `agriculture-clarity-operator.js:239`, `medicine-node-business-engine.js:632-638`, `agriculture-business-build.js:464`, `communication-business-build.js:24,29`; live-brain reads `agriculture-node-business-engine.js:1039,1050,1054`, `medicine-node-business-engine.js:646-648`; static-source reads `finance-targeting-engine.js:7`, `agriculture-directive-ranker.js:165`, `agriculture-opportunity-matrix.js:113,586,596`; GET-only fetches `agriculture-clarity-operator.js:608,617,626`; key-duality `medicine-node-business-engine.js:647`.

**Differentiation:** base `domain-brain-base.js:319-343,843-858,1040-1130`; Energy role map `energy-brain.js:633-1119,1120-1228,1371-1388,1789-1816,1952-1984,1989-2010,2176-2207,2256-2324,2329-2345,2364-2372,2558-2588,2600-2663,2679-2719,2768-2824`; Finance `finance-brain.js:403-703,709-761,945-1108,1222-1280,1449-1483,1488+,1993-2009` (gain `shadow:true` at `1260-1280`); Culture `culture-brain.js:143-156,209-321,226,323-344,426-434,437-578,463-509,632-637,717-775,935-968,1508-1564,1613-1686` (phase advisory `_actuation.phase=false`).

---

## 5. Remaining open questions after round 2

1. **Live production arm state of the two send paths.** Code-default is DARK for both, but whether an operator armed `autopilot:config` or `homestead:automail` in live Redis is not in the repo. Resolves via the two status GETs in section 3 (one needs no credentials).
2. **Vercel env values.** Whether `RESEND_API_KEY` + a verified from-domain and `LOB_API_KEY` + return address are set determines whether an armed path could actually send versus fail closed. Presence booleans are exposed by the status endpoints; exact values need the Vercel dashboard.
3. **Full read of the 101 advisory files.** The action-trigger verdict rests on an exhaustive I/O grep (complete), but only ~10 files were deep-read for behavior. A claim about subtle per-domain logic differences beyond I/O would need a fuller read. Not expected to change the non-actuating verdict.
4. **The rho\*=1 M1 spec is a ready but unbuilt measurable brake.** Whether the design intends to implement it (making item 1's brake quantitative rather than heuristic) is a design decision, not determinable from current code, which contains no latency-race machinery.
5. **Whether `governance-pack.zip` was meant for this repo.** It is generically templated ("install into any project") and not installed here; its intended target cannot be determined from the repo. Note that even if installed, its money-movement red line targets Stripe/PayPal-style calls, not Resend email or Lob mail, so it would not by itself gate the two autonomous-send paths.
