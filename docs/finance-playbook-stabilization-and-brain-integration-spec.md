---
authority: UNRATIFIED_ENGINEERING_PROPOSAL
measured_at: 2026-09-26
scope: finance domain-console regulation-playbook count defect, its root causes, and the integration path for client domain-brain derivations into the server architecture
recorded_by: engineering agent (Kimi Code)
approved_by: null
---

# Finance Playbook Stabilization + Brain-Derivation Integration Spec

Recovered from an interrupted working session (2026-09-26). Two parts: (A) the measured
defects behind the finance REGULATION PLAYBOOK count bouncing 1000 → 2000 → settled, with
fixes; (B) where the client domain-brain derivations (diagnoses → treatments → opportunities)
fit in the newer server architecture and the stated long-term direction.

---

## Part A — The playbook count defect (measured)

### A1. Why the count bounces

Arithmetic, not data change. Evidence chain:

1. `assets/js/domain-brains/portal-content-resolver.js:562` — `resolveForBrain` caps at
   `maxTreatments = 200` **per active diagnosis**. Finance L1 portal files hold 356–1299
   treatments per diagnosis, so the cap always saturates.
2. Active diagnoses flip on/off each ~30s cycle as feed-derived conditions match/unmatch
   (`finance-brain.js:329`, `active = matchCount > 0`). Total = 200 × (#active diagnoses):
   5 active → 1000, 10 active → 2000.
3. Mid-cycle flicker within one cycle: `recommendTreatments` first sets the small canonical
   root set (`finance-brain.js:406`), then `resolveDeepContent` **replaces** it wholesale
   (`finance-brain.js:805`), and the console re-renders at both points. The console's own
   comment admits the transient (`domain-console-brain.js:513-514`: "state.treatments
   transiently holds the RAW portal harvest before the regulation engine narrows it").

### A2. Twin diagnoses double-count

`portal-content-resolver.js:72-76`: `BANKING_CRISIS` and `CREDIT_CHANNEL_BREAK` resolve the
identical four portal roots (verified byte-identical); same for `MARKET_CRASH` /
`EQUITY_WEALTH_SHOCK`. When both twins are active, the same treatments are counted twice.

### A3. True pool sizes (measured by walking L1→L3 `childPortal` links, cycle-safe)

| Diagnosis | L1 only | Full L1–L3 | portals | non-finance tx |
|---|---|---|---|---|
| BANKING_CRISIS / CREDIT_CHANNEL_BREAK | 1088 | 2816 | 40 | 0 |
| CREDIT_FREEZE | 1299 | 2547 | 29 | 0 |
| MARKET_CRASH / EQUITY_WEALTH_SHOCK | 356 | 1892 | 36 | 0 |
| CURRENCY_COLLAPSE | 724 | 2020 | 30 | 0 |
| SYSTEMIC_CONTAGION | 722 | 2354 | 38 | 0 |
| FRAUD_SCANDAL | 690 | 2034 | 31 | 0 |

No other domains leak into finance — every mapped subtree is `finance_*`. "1000" was never a
real count; the unique pool is ~2,000–2,800 treatments per diagnosis.

### A4. Fixes (ordered, smallest first)

1. **Dedupe by identity.** In `resolveForBrain`'s combine step
   (`portal-content-resolver.js:581-599`), dedupe treatments across diagnoses on
   `(nodeId, label)` — or canonicalize the twin map entries so twin diagnoses share one
   resolution. Fixes the double-count regardless of which twins are active.
2. **Single commit point per cycle.** In `finance-brain.js`, stop publishing
   `state.treatments` from `recommendTreatments` when `resolveDeepContent` will replace it
   later in the same cycle (stage into a local, assign once). Kills the intra-cycle flicker.

   **STATUS 2026-09-26: FIXED (as deterministic merge).** `resolveDeepContent` now unions
   resolver treatments with existing `state.treatments` under a composite dedupe key
   (`id|diagnosisId|nodeId|label`) instead of overwriting. Regression test:
   `scripts/test-finance-treatment-merge.js` (8/8) proves a deep-digest treatment injected
   by `_applyDeepDigest` survives the complete Finance cycle, the merge is idempotent on
   re-run, and the id sequence is deterministic. Measured funnel before → after:
   injected 6 deep-digest → post-resolver 2 total / **0 deep-digest** → after:
   8 total / **6 deep-digest**, playbook 8 / 6 deep-digest.
3. **Honest count semantics in the console.** `domain-console-brain.js:910` renders
   "N treatments across D diagnoses" as if N were the pool. Either render
   "showing N (capped) of ~M resolved" using the resolver's pre-cap count, or raise/remove
   the 200 cap with depth-aware pagination. Do not silently keep the cap while implying
   completeness — that is the exact fabrication class `brain-v2/CONTRACT.md` (R1–R10)
   was written against.

---

## Part B — Integration: where the derivations fit in the newer system

### B1. Current state (measured, with citations in session log)

Three derivations of "domain state" coexist; only the old one is consumer-visible:

- **Old client brains** (`assets/js/domain-brains/*`): signals → stress → diagnoses
  (feed-condition matching) → treatments (portal JSON trees) → opportunities
  (rank = `stress × relevance`, `finance-brain.js:445`). **Output never leaves the browser**
  — the only outbound calls are plasticity weight snapshots (token-gated, normally off) and
  change telemetry.
- **Server re-execution** (`handlers/brain-cognition-refresh.js`, 30-min cron): re-runs the
  same client brain sources in a `vm` sandbox, stores `limen:brain:cognition:<domain>`
  (TTL 3h). Consumers: `lib/communication-social-decision.js` salience gate (requires
  producer `brain-cognition-refresh/1` — quietly demotes the browser's own POST path),
  `lib/master-briefing-packet.js`, ~15 per-domain decision modules, `/vitals`.
- **brain-v2 shadow runtime** (`lib/brain-shadow-runtime.js`, hourly): clean-room kernel
  (Kalman+HGF estimation, abstention gates, declarative `bind/` findings), 20/20 domains
  INSTALLED, persistence proven — but **0/10 relationships ACTIVE, no actuation, and no
  diagnosis→treatment→opportunity derivation at all**.

Three opportunity producers, unreconciled: (a) client brain (stress × relevance); (b) server
worker snapshot (`handlers/limen-worker-snapshot.js:610-742`, stress × hardcoded FAMILIES);
(c) cognition-packet opportunities via `lib/civilization-handoff-consumer.js` (laned
`investments`/`research-papers` only). Posts (`lib/social-generator.js:63-211`) read only
`*-tools` endpoints. `/api/ventures` receives only hardcoded entries from `operator.html:625`.

### B2. The gap in one sentence

The diagnosis→treatment→opportunity derivation **is the product** (OWNER_SYSTEM_INTENT.md
L4: "Turn that corpus into business opportunities and research opportunities… NOT COMPLETE.
Nothing currently reads the corpus") and it lives **only** in the old client stack — while
the new stack (brain-v2) has the proven loop and no product logic.

### B3. Integration path (proposed)

The architecture's own answer is `bind/`: domain-specific knowledge belongs as declared data
consumed by one runtime, never as per-domain code (`brain-v2/DELIVERY_STATE.md:27-33` —
"`if (domain === 'x')` in the runtime is the failure mode"; the 34 energy overrides in
`assets/js/domain-brains/` are "the counter-example, not the pattern").

1. **Portal trees → bind data (the unbuilt middle).** Express the portal
   diagnosis/treatment/opportunity trees as brain-v2 `bind/` declarations (findings +
   efferent proposals), generated offline from the portal JSON corpus the way
   `bind/diagnosis-registry.js` was generated from the old predicates. This is the bridge
   between the shadow brain (proven loop, no product) and the client brains (product logic,
   unproven loop).
2. **One opportunity producer.** Until the bridge exists, reconcile (a)/(b)/(c): route
   brain-derived opportunities (cognition packets) into the surfaces that currently read
   only the worker snapshot — atlas, finance console, master briefing — with producer
   identity attached, so consumers can weight server-brain vs worker-FAMILIES output
   instead of silently diverging. Retire or demote the hardcoded FAMILIES table once
   brain-derived opportunities reach parity.
3. **Posts and ventures consume cognition.** `social-generator` should accept the salience
   gate's subject packet (it already gates; it just doesn't compose from it), and
   `operator.html`'s static `D[]` POST to `/api/ventures` should be replaced by
   cognition/handoff-lane opportunities (`civilization-handoff-consumer` already lanes
   `investments` — wire the ventures surface to it).
4. **Keep the browser a renderer, not a source of truth.** Server re-execution
   (brain-cognition-refresh) already makes the server the writer consumers trust; lean into
   that. The console renders server packets; the in-browser brain becomes a preview, not a
   parallel universe.

### B4. AGI-direction fit, and whether it is maximized

Stated doctrine (quoted in the architecture map, with sources):

- Regulation-first, no master tier: synthesis "must not be drawn or implemented as a
  downstream tier that governs the sovereign domain brains"
  (CIVILIZATION_NO_HOMUNCULUS_RENDER_CONTRACT.md).
- The long-term goal is "moving your manual integration function into the substrate…
  precisely and only the construction of L7 with L5's lateral connectivity beneath it"
  (brain-v2/SPEC.md:501). "AGI" language is deliberately disclaimed
  (BRAIN_STRESS_CIVILIZATION_SYNTHESIS.md:102-103).

Where the derivation system fits: it is the **efferent half** the new stack lacks. brain-v2
today is afferent-only (sense → estimate → abstain; five inert effectors). Diagnoses →
treatments → opportunities is precisely "propose → select → actuate" content. In SPEC terms
it is L5-lateral/L7 material: cross-domain treatment propagation and opportunity formation
are the substrate-level integration the operator currently does by hand.

Is it maximized? **No, on four measured counts:**

1. The 200-cap + twin duplication means the console shows <10% of the resolved pool and
   miscounts what it shows (Part A).
2. The derivations never reach posts, investments, or business formation — the three
   surfaces named in the product mission read from a static server table instead (B1).
3. Learning is inert in the old stack (`_learnedVec` "abstains everywhere and always") and
   consumerless in the new (brain-v2 learns, nothing acts on it) — so derivations do not
   improve from outcome feedback, violating the HIPPOCAMPUS_CONSOLIDATION_SPEC loop
   (resolve → modulator → plasticity → persist).
4. brain-v2's evidence gate is shut (0/10 relationships, comparability 4/6) — correct per
   CONTRACT, but it means the new runtime cannot yet carry the derivation load even if the
   bridge (B3.1) were built.

Maximizing, in doctrine-consistent order: fix A (honesty) → B3.2/B3.3 (reach the product
surfaces) → B3.1 (become bind data) → let brain-v2's evidence gates open on their own
measurement schedule. Each step is additive; none requires a big-bang migration.

---

## Defect ledger entries (for DEFECT_LEDGER.md)

| # | defect | location | fix |
|---|---|---|---|
| 1 | Twin diagnoses double-count treatments | portal-content-resolver.js:72-76, 581-599 | A4.1 — **FIXED 2026-09-26** (Exp 3, c83b3659): cross-dx dedupe, 1200→901 unique, conservation fields on packet |
| 2 | Mid-cycle wholesale replace of state.treatments causes count flicker | finance-brain.js:406 vs :805 | A4.2 — **FIXED 2026-09-26** (baseline 04dc5b6d): deterministic merge, regression 8/8 |
| 3 | Console implies capped count is the full pool | domain-console-brain.js:910 | A4.3 — open (selected-vs-available provenance now computable from digest `diagnosisTotalAvailable` + resolver `totalUnique`) |
| 4 | Brain derivations unreachable by posts/investments/ventures | social-generator.js, limen-worker-snapshot.js:610-742, operator.html:625 | B3.2-B3.3 |
| 5 | Browser POST cognition path demoted to second-class by consumers | communication-social-decision.js:48-52 | B3.4 |

---

## Part C — Neurology audit: real vs. label, and the redundancy ledger

Three-tier verdict across both stacks (full citations in session audit, 2026-09-26):

**REAL (mechanism matches the name):** brain-v2 NE axis (unexpected uncertainty, Yu & Dayan
family, `kernel/modulators.js:152-155`), `kernel/predict.js` residuals, `kernel/select.js`
(tonic inhibition + evidence accumulator + hyperdirect HOLD — not argmax), `kernel/actuate.js`
refractoriness/adaptation, `core/channel.js` Kalman + liveness; old stack: three-factor
plasticity math (`limen-plasticity.js:181,200`), active inference (`limen-active-inference.js`
— genuine Kalman + EFE), inter-brain-bus cross-brain stress coupling
(`domain-brain-base.js:679-681`), finance metaplasticity → refractory dead-time
(`finance-brain.js:967-974 → :743`, the one ARMED neuro effect on a user surface),
brain-v2's autofire gate (critic HOLD blocks a paid Anthropic call —
`handlers/limen-worker-autofire.js:413-439`).

**REAL MATH, NO CONSUMER (inert-by-disconnection, not by defect):** `_learnedVec` — pinned
to seed because no domain has positive skill, by the code's own measurement
(`domain-brain-base.js:1430-1432`); BCM metaplasticity (modulates a learning rate whose
weights never actuate); active inference EFE ("no live consumer", base:1921);
`kernel/lateral.js` (never imported by loop.js); 5 of 6 finance overlays
(proposal/observe-only); γ system gain ("MODULATES NOTHING",
`brain-cognition-refresh.js:386-418`); bus cascade/loop detection (zero listeners).

**LABEL:** anatomical node IDs (THAL/AMY/dlPFC — identical computation for every node; the
name is a lookup key + hand-written narrative); the galaxy connectome visualization (100%
hardcoded edges, stress rings derived from that same hardcoded topology —
`civilization-connectome.js:1355-1469`); `kernel/connectome.js` by its own admission
("THE NAME IS A LIABILITY… no weights, no learned structure", connectome.js:5-23).

### C.1 Redundancy ledger (deletion/consolidation list)

| # | Duplication | Where | Action |
|---|---|---|---|
| 1 | Plasticity driver ×~21 | base `_computeDomainPlasticity` + per-domain copies aliased (e.g. finance-brain.js:2679) | collapse to base implementation |
| 2 | Active-inference driver ×~21 | base `_computeGenericActiveInference` + per-domain copies (e.g. finance-brain.js:2683) | collapse to base |
| 3 | Two unrelated "metaplasticity" | BCM η-scaling (limen-plasticity.js:155-171, shadow) vs finance volatility knob-shifter (armed) | keep finance's; rename one; share no name |
| 4 | Prediction error ×4 | recurrent model, active-inference innovation, K-stack pe, PE-compressor | pick one canonical PE per consumer |
| 5 | Refractory ×2 | inline `_refractoryParams` (live) vs finance-refractory-limiter.js; `_refractoryLimiter` never assigned (finance-brain.js:973/977 dead writes) | delete dead path |
| 6 | Old stack vs brain-v2 re-implementations | plasticity/active-inference/metaplasticity exist in both, neither feeds the other | brain-v2 wins long-term (Part B3.1); freeze old-stack learning surface |
| 7 | Three "connectomes" | kernel router (honest), inter-brain-bus (in-page), galaxy renderer (decorative) | rename renderer; it is not a connectome |

---

## Part D — Finance console as ONE system: the 16 panels (owner-requested audit)

The owner's correction is accepted and measured: these are not inert panels. Traced per
panel against `domain-console-brain.js` (DCB), `finance-brain.js` (FB), `domain-brain-base.js`
(Base), `finance-pulse-engine.js` (Pulse): **10 WORK, 4 PARTIAL, 2 STATIC-BUT-COHERENT,
0 BS.** The panels sit on one live cycle (Base:326-357 + FB:810-865) and form a real causal
chain, not 16 widgets.

| # | Panel | Verdict | Note |
|---|---|---|---|
| 1 | Pulse (Crisis–Stable) | WORKS | live; evidence contracts gate panel 6 (FB:824-844) |
| 2 | Signal intake | WORKS | live feeds → conditions |
| 3 | Node activation (23 nodes) | STATIC-BUT-COHERENT | baked `state:"active"`; live IMPLICITED overlay; fix: compute activation from `diagnosticTriggers ∩ _activeConditions` |
| 4 | Change log | PARTIAL | live pipeline, **render bug: `title` never rendered** (DCB:777) — most entries blank; one-line fix |
| 5 | Finance state assessment | WORKS | live numbers, templated prose; honesty badges genuine (DCB:176-261) |
| 6 | Diagnosis chain | WORKS | relevance = matched triggers, not stress-restated (finance opted out via `groundedOnly`); dead catch-all triggers `finance_high_stress`/`structural_stress` can't match `_stress_*` conditions (FB:109-114 vs 215-217) |
| 7 | Regulation playbook | WORKS | only panel that walks the fractal tree L1→L3 (resolver:349-366); see Part A for count defects |
| 8 | Node → system mapping | STATIC-BUT-COHERENT | live-filtered static data; first-5 fallback can show uninvolved nodes |
| 9 | Cross-domain regulatory transfer | PARTIAL | live magnitude (stress≥0.55 + active dx), **dead delivery** — finance is the only registered brain on the page (domain-console.html:617-636); rationale text hardcoded |
| 10 | Ontology gap | WORKS | genuine self-criticism surface; feeds ONTOLOGY COVERAGE INCOMPLETE badges |
| 11 | Self-model · metacognition | WORKS | most computationally honest panel; prior persists, PE real, E-I brake dampens opportunity confidence (FB:1104-1160); K4 refuses fabricated reward (FB:1706-1712) |
| 12 | Cross-domain pressure | WORKS (display) / BROKEN (bus) | works only by bypassing the bus and reading the shared snapshot directly (DCB:451-465); `_externalSignals` empty, K1 afferent inert on this page |
| 13 | Finance outbound emissions | PARTIAL | correctly silent until real conditions; emitted into an empty room (same bus gap as 9) |
| 14 | Decision surface | WORKS | live scored cards; **one-cycle lag**: opportunities read previous cycle's emissions (Base step 6 before step 7); company-distress abstains silently — should show an abstention badge |
| 15 | Companies | STATIC-BUT-COHERENT | validated kernel output (`kid:'limen_backtest.py'`, `vs:'validated'`) frozen at last worker run; fix: render `_generated` as "scored as of" |
| 16 | Pipeline trace | PARTIAL | the honesty panel has an honesty bug: `freshColor`/`ageStr` used at DCB:1454-1455, assigned at :1479-1484 — SNAPSHOT AGE always "unknown" |

### D.1 The chain, live vs broken

Live links: pulse→diagnoses (blocking) · diagnoses→playbook (filter) · diagnoses→node mapping
· diagnoses+stress→emissions · conditions→ontology gap→authority badges · state→self-model→
E-I brake→decision-surface confidence.

Broken/degraded links (the fix list, ordered by effort):
1. **DCB:777 changelog `title` fallback** — one line.
2. **DCB:1454-1455 trace var-order** — move computation above the lines array.
3. **Dead catch-all triggers** (FB:109-114) — re-ground or delete; effect is already honest,
   the slots are fiction.
4. **One-cycle emission lag** into decision surface (Base:331-337) — reorder or document.
5. **Bus delivery on single-brain pages** (panels 9/12/13) — the real structural gap:
   deliver emissions via the server propagation worker (`handlers/limen-stress-propagation.js`
   exists) instead of in-page registration, or register peer brains on console pages.
6. **Provenance labels**: companies "scored as of" timestamp; coupling semantics labeled
   "rule-based projection, not measured transmission"; node activation computed live.

### D.2 Fractal depth coverage

Deep tree (L1→L3) is read by: regulation playbook (full recursion), diagnosis chain
(evidence-gated deep digest), immune/K5/DDP surfaces (credit sub-portal, L1 mad-lib
quarantine scan FB:1929-1972). L1-root only: node activation, node→system mapping,
companies, the canonical diagnosis catalog. The panel system genuinely sits *above* the
fractal portals — but only the playbook and diagnosis chain currently descend into them.

### D.3 Correction to earlier framing

Parts of this document's Part B and the earlier "inert" language referred to the **learning
arm** (`_learnedVec`, BCM η, active-inference consumer, lateral.js) — that finding stands.
It does **not** extend to the 16-panel console system, which this audit shows is a
functioning pipeline with 4 fixable defects and 2 provenance-labeling gaps, not a mockup.

---

## Part E — Owner doctrine (2026-09-27) + per-domain implementation notes

Owner doctrine, stated this session and binding on how this work is applied:

1. **Domains are individual brains.** They do not share code or behavior for
   convenience. A fix proven in one domain is a *pattern*, not a fleet rollout.
2. **Sharing is permitted only where it matches a neurological sequence** — the
   actual neural pipeline stages (brainstem cycle, thalamic relay, immune
   surveillance, memory consolidation), not "twenty domains might want this."
3. **The current system is what it is.** No re-architecture. Fix bugs and the
   items needed to connect the systems efficiently.
4. **Everything done is noted here for possible implementation in the NEXT
   domain** — applied when that domain is worked on, with its own before/after
   measurement. No fleet-wide campaigns.

### E.1 Domain-local patterns (implement per domain, in that domain's own files)

Each of these was proven on finance. Apply to the next domain individually,
adapting to that domain's own data and contracts:

| Pattern | Proven at | What it is |
|---|---|---|
| diagnosisIndex grounding | finance-brain.js:113 | match stress catch-all triggers to the domain's own pulse contracts (only the catchAllBlocked:false diagnosis keeps `_stress_*` triggers) |
| stress catch-all timing | finance-brain.js scoreStress override | stress flags computed after current-cycle scoring, not from previous-cycle state |
| treatment merge w/ semantic dedupe | finance resolveDeepContent | merge-not-replace; reconcile on normalized label; node-aware separation; union diagnosisIds + nodeIds; preserve metadata (description/monitoring/escalation/target); stricter provenance wins |
| provenance tri-state | finance (both treatment paths) | mad-lib => scaffold; cite+steps => verified-eligible; otherwise unknown. Each domain applies its OWN classifier/verb family |
| digest rebuild + validation | finance, then fleet build | full-tree digest + manifest, per-domain measured before/after identity sets; synthetic tagging at build |
| refractory/metaplasticity actuation | finance overlays | volatility-scaled refractory dead-time (already domain-owned; copy the pattern, not the parameters) |

### E.2 Legitimately shared (neurological sequences — already the design)

These are the nervous system's own stages; sharing here is anatomical, not
convenience:

- **Brainstem cycle spine** (`domain-brain-base.js`): signals → stress →
  diagnoses → treatments → opportunities → emissions. One sequence, every brain.
- **Thalamic relay** (digest + `_applyDeepDigest`): sensory content gated into
  the cycle. Rotation over depth = attention cycling; per-depth cursors.
- **Synaptic convergence** (`portal-content-resolver.js` joint selection):
  associations preserved as `diagnosisIds` on each kept entity — one signal,
  many targets, counted once.
- **Immune surveillance** (console `classifyProvenance` + panel authority):
  scaffold/unknown/verified discrimination; synthetic may inform but never
  carries FULL authority.
- **Memory** (per-domain manifests + `/api/diagnosis-manifest`): complete
  identity/route table, snapshot-pinned recall (`?ref=`), schema-gated.
- **Inter-brain emissions** (emissionRules + bus): domain-local rules, shared
  delivery mechanism — matches the connectome contract (no master tier).

### E.3 What this doctrine changes about the current PR

- The **19-adapter `diagnosisIds` propagation** was NOT a coupling change: each
  domain's own adapter now carries the association set its own console needs to
  render shared treatments under every applicable diagnosis. It is listed here
  as a domain-local pattern (E.1, merge/render row) — each file owns its copy.
- The **fleet digest rebuild** is done (all 20 exist now with full-tree
  coverage, manifests, provenance tags). That was a one-time admission of the
  corpus, not a rolling campaign. Future digest rebuilds happen per domain,
  when that domain is worked on.
- **brain-v2 `bind/`** remains the long-term home for domain knowledge as
  declared data (Part B3.1) — that direction *is* the doctrine: one runtime,
  per-domain declarations, no per-domain code inside the shared kernel.

### E.4 Working agreement going forward

1. No re-architecture; bug fixes and connection-efficiency items only.
2. New fixes land in the domain being worked on, and are recorded in this
   document under E.1 for the next domain's optional adoption.
3. Shared files (base brain, resolver, console, manifest endpoint) are touched
   only for neurological-sequence stages (E.2) — and each such touch gets
   justified against the sequence it belongs to.
4. Every change keeps its conservation/provenance measurements so the next
   domain can compare honestly rather than copy blindly.
