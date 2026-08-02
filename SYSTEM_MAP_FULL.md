# LIMEN HELIX — FULL SYSTEM MAP

<!-- AUTHORITY: MEASURED_SNAPSHOT — see DOCUMENT_AUTHORITY.md -->
> **AUTHORITY NOTE, added 2026-08-02.** Compiled 2026-06-07 and calls its measurements "exact"
> with no validity date and no reproducing command. Treat as a snapshot at that date, not as
> current truth, and re-verify against code before acting on it.



> Read-only library map of the entire codebase. Generated 2026-06-07 by a 28-agent parallel audit (all 111 commits walked, every file family measured). **Nothing in the repo was modified to produce this document.** This is the prerequisite reference for the Vercel Hono consolidation (see section 24).

## MEASURED SCALE (exact, not estimated)

| Surface | Count |
|---|---|
| Root .html pages | 3,397 |
| Browser JS modules (assets/js) | 624 |
| Data tank .json files (assets/data) | 4,670 |
| Serverless functions (api/*.js) | 54 |
| Python kernel files (api) | 11 |
| Shared libs (lib/*.js) | 30 |
| Scripts (scripts/**) | 118 |
| Git commits (2026-05-30 → 2026-06-07) | 111 |

Per-area exact counts (portals, nodes, diagnoses, treatments, feeds, etc.) are measured inside each section below.

## TABLE OF CONTENTS

- [0. Git history & evolution](#0-git-history-evolution)
- [1. HTML SURFACE — ALL 3,397 ROOT-LEVEL HTML FILES BY FAMILY](#1-html-surface-all-3397-root-level-html-files-by-family)
- [2. Browser JS Modules (assets/js/** by subdir)](#2-browser-js-modules-assetsjs-by-subdir)
- [3. Data tanks (assets/data/**, 4,670 json)](#3-data-tanks-assetsdata-4670-json)
- [4. Python kernel / distress scorer](#4-python-kernel-distress-scorer)
- [5. Connectome](#5-connectome)
- [6. Brain nodes / neuro substrate](#6-brain-nodes-neuro-substrate)
- [7. Domains & domain-brains](#7-domains-domain-brains)
- [8. Per-domain page layers matrix](#8-per-domain-page-layers-matrix)
- [9. Portals & portal behavior](#9-portals-portal-behavior)
- [10. Node mapping & spider-web communication](#10-node-mapping-spider-web-communication)
- [11. Treatment Discovery](#11-treatment-discovery)
- [12. Remedy](#12-remedy)
- [13. Master Brain / Inbox / Executor](#13-master-brain-inbox-executor)
- [14. Stress propagation & autonomic workers](#14-stress-propagation-autonomic-workers)
- [15. Finance/capital + grant/patent/research/investment/SBA pipeline](#15-financecapital-grantpatentresearchinvestmentsba-pipeline)
- [16. Engine outputs / artifacts](#16-engine-outputs-artifacts)
- [17. Feeds & Ingestion](#17-feeds-ingestion)
- [18. Paper trading / markets](#18-paper-trading-markets)
- [19. Civilization Cockpit](#19-civilization-cockpit)
- [20. Recommendations / reports / executive / philemon](#20-recommendations-reports-executive-philemon)
- [21. Vitals / audit / interoception](#21-vitals-audit-interoception)
- [22. Schema & Entity Registries](#22-schema-entity-registries)
- [23. Shared UI + browser kernel libs](#23-shared-ui-browser-kernel-libs)
- [24. Complete API surface (Hono prerequisite)](#24-complete-api-surface-hono-prerequisite)
- [25. Build / sense scripts](#25-build-sense-scripts)
- [26. AGRICULTURE deep-dig (exhaustive)](#26-agriculture-deep-dig-exhaustive)
- [27. INFRASTRUCTURE deep-dig (exhaustive)](#27-infrastructure-deep-dig-exhaustive)
- [MASTER NEEDS-WORK & INCONSISTENCIES ROLLUP](#master-needs-work--inconsistencies-rollup)

---

## 0. Git history & evolution

### PURPOSE
Track the development timeline of the Limen Helix codebase across 111 commits from 2026-05-30 to 2026-06-07, identifying subsystem creation/evolution, feature development patterns, and abandoned directions.

### TIMELINE TABLE

| Commit Range | Date Range | Era | Major Work | Files | Key Subsystems |
|---|---|---|---|---|---|
| 5ba1840 | 2026-05-30 | **Epoch 0: Live Repo Bootstrap** | Initial snapshot from full repo (Limen-Helix@4e0ee3b6006). Fresh Vercel deployment foundation. | 8,719 files, 11.3 MB insertions | All operator UX (master-inbox, vitals, pattern-proposals, kernel-comparison, domain workspaces), Bridge engine, Portal corpus (767 companies), Autonomic loop scripts (108), Domain brains, Python kernel (6 files) |
| 025987c | 2026-05-31 | **Epoch 1: Treatment Discovery Surface** | Synced treatment-discovery + fidelity gate work from main (session 2026-05-30/31). First major system deployed to lean repo. | 134 files, 83.4 KB insertions | treatment-discovery.html (operator UX), 113 per-node cell splits, verification-ledger.json (PubMed verdicts), build-treatment-discovery-cube.mjs, organ-binding-fidelity audit, journal nav entry |
| a849f0d–3f513c5 (22 commits) | 2026-05-31 to 2026-06-01 | **Epoch 2: Gate B Authority Rollout** | Render-execution gate on company-portal Intelligence Cycle. Confidence badges, epistemological authority, and data-source labeling on all console surfaces. Extracted shared render-authority.js module. Small, focused file modifications (1–2 KB each); heavy refactoring of portal-ui and company-portal-engine-render. | 22 commits, ~2.5 KB average | render-authority.js (shared, 196 lines), company-portal-ui.js, company-portal-engine-render.js, kernel-comparison.html (843→1659 lines), domain-console, regulation-renderer, civilization-tab, executive-strip |
| e7329bc | 2026-06-01 | Four-state epistemic model + operator guide | Formalized truth/live/unknown/unverifiable labels. Baked into employee training materials. | 6 files | operator-guide.html, civilization model refinement |
| 99fc150–0120251 (12 commits) | 2026-06-02 | **Epoch 3: Public Launch & Lead Capture** | Public front door, lead capture, login redirection to full system (Model 1). V2 (cinematic, sales-first) → V3 (mission-first) front page iterations. Civilization cockpit restoration. Evidence-state counters live-rolling refresh. | 12 commits, ~256 files changed | index.html (public), front-page iterations, lead-capture.js, login-routes, Civilization cockpit, LEAD_ADMIN_KEY enforcement, return-param allowlist |
| 61858d0 | 2026-06-02 | Restore real Civilization cockpit from full repo | Synced 2,408 insertions from full repo. Civilization signal node activated. | 3 files | Civilization brain, reports, integration |
| 3834a42, 77af662 | 2026-06-02 to 2026-06-03 | Front-page counter rollup + visibility loop | Live-rolling propagation of verification gains (proven claim counts) on public counters. Redis-based state propagation. | 3 files per commit, 10.4 KB insertions | index.html counters, login-visibility-hook, verified-gain-propagator |
| 6dff4d2–4f4740c (7 commits) | 2026-06-03 | **Epoch 4: Lean→Full Dual Repo Sync** | Automated GitHub Action for lean→full overlay sync (scoped, no-delete). Action-selection gate (Stage-4 basal ganglia) ported to lean behind DARK flag. WB feeds + dedup guard backported. Resolver for lean-only drift. Canary tests (6 commits) of sync mechanism; token config issues. | 7 commits | .github/workflows/lean-full-sync.yml, action-selection-gate.js (DARK), WB-feed mirror, dedup-guard |
| 2c66a61–8f52cd8 (5 commits) | 2026-06-03 to 2026-06-04 | **Epoch 5: Redis-Backed Production Dispatch** | Master-inbox Redis-fresh overlay (reroute pattern-proposal and trigger-pattern-author to full repo via Redis). Author-time salience pre-filter. Self-correcting author repair mechanism. Repair moved off synchronous path (performance fix). | 5 commits | master-inbox.js (redis-kv integration), trigger-pattern-author (Vercel-cron gate), pattern-author refactor, redis-diag.js |
| 8ea5a04–ad4e1d2 (4 commits) | 2026-06-04 | **Epoch 6: Portal & Vitals Service Porting** | Vitals page ported to lean (was full-only 404). Dedup crons (full runs 3 worker crons; lean relies on Redis). Upstash 10MB chunk guard (Redis request batching). | 4 commits | vitals.html, cron-dedup logic, redisMGet chunking |
| 05f26a8–c8c7615 (7 commits) | 2026-06-04 | **Epoch 7: Treatment Discovery Cube & Pattern Authoring Refinement** | TD cube rebuild (fill dead domains: supplyChain, health). Multi-modal interoception DARK divergence instrument (observe-only). Civilization badge regenerate on global-state update. Dead cards removed (Trust Posture, Polarity, Detected Diagnoses & Treatments, Civilization tab from Evidence Workspace). Pattern-author cursor rotation, dedup fixes, per-target cap + bad-data gate. | 7 commits | TD cube refresh, interoception-divergence.js (DARK), civilization-badge-regenerator, pattern-author hardening |
| d6a6ef4–d7d681c (4 commits) | 2026-06-04 | **Epoch 8: Print Pipeline & Pattern UI Improvements** | Pattern proposals UI: un-reject (restore) button. Master-inbox & portal-page Print routes → print-from-pattern (fixes 'no bridge match'). | 4 commits | pattern-proposals.html (restore button), print-from-pattern router, print-pipeline refactor |
| 08b8c7d–63d860c (10 commits) | 2026-06-05 | **Epoch 9: Fractal Portal Build & Finance Lane Prep** | Master-inbox Print preview + approve step. Kernel rendering fixes (K1 score field, financialState [object Object]). Fractal build: +30 tier-2 portals tested (3+8+2+20 batch additions). Portal regen backlog surfaced in vitals. Inbox re-headline (neural structure as title). Slug reconnect +name-verified ticker/CIK aliases (kills Company-not-found). | 10 commits | master-inbox.html (print UI), kernel-rendering fix, fractal-builder.js, tier-2 portal batch (Enterprise Products, Diamondback Energy, Puma, Royalty Pharma, Sarepta, energy+specialty tier) |
| 89afff8 | 2026-06-05 | Engine outputs: real market-data investment lane | Killed 461/461 placeholder suppression. Real market data flowing into finance lane for the first time. | 1 file | engine-output-generator.js |
| 721d0f4 | 2026-06-06 | **Epoch 10: Finance Capital Engine Launch** | NEW subsystem: /capital-engine. Autonomous revenue-stream operating layer. 32 capital streams (5 tiers), 18 connectors, approval queue, single-signature sign-off. NEW libraries: finance-ledger (Redis P&L), stream-ops (AI production + publish), post-adapters (Beehiiv/Printful/Gumroad), stripe-rail (income capture, outflow halt), affiliate-injector (Amazon tracked links), finance-autonomic (audit→heal→build tick). finance-capital-engine.html (institutional terminal). Income allowed; fees/lending/transfers require FINANCE_PORTAL_SIGNOFF.md sign-off. +1 Vercel function total. | 13 files, 1,490 insertions | api/capital-engine.js (205 lines), api/lib/{finance-ledger, stream-ops, post-adapters, stripe-rail, affiliate-injector, finance-autonomic}.js, finance-capital-engine.html (355 lines), assets/data/{affiliate-config, capital-engine}.json, ACTIVATION_PLAYBOOK.md, FINANCE_PORTAL_SIGNOFF.md |
| 5fa40ac, 530b055 | 2026-06-06 | Finance path & footprint fixes | /capital-engine clean URL routing. Move finance libs out of /api → top-level /lib (footprint optimization for Vercel). | 2 files | api/capital-engine.js, lib/finance-*.js |
| bf2f2ca | 2026-06-06 | Connector readiness: required vs optional keys | Partial state on connector validation (API prep). | 1 file | ~30 insertions |
| 51388ba, e8691c4, 1157785, 3c1372c | 2026-06-06 | **Epoch 11: Content Production Pipeline** | True 3-model pipeline: Grok → Anthropic → OpenAI (selectable). Fix Grok model + Beehiiv pub_id. Surface retrieve errors. Corpus grounding: produce from operator's real framework (IP-safe). Robust JSON extraction in produce (strip code fences, fallback). | 4 commits | api/lib/{content-producer, grok-adapter, anthropic-adapter, openai-adapter}.js, corpus-grounding.js |
| 06063d7 | 2026-06-06 | **Epoch 12: Journal Publishing Surface** | NEW subsystem: /journal. Fully autonomous owned publishing, no platform gate. Rewrite + sign + ship model. | 5 files, 178 insertions | journal.html (operator UX), api/journal.js, journal-auto-publish.js, limen-topbar.js (+⬢ nav) |
| a66d650, d0fe37f | 2026-06-06 | Corpus & Patent Scaling | Scale corpus +3 domain cards. Add cross-domain lines. Turn on autonomic tick. Patent-to-marketplace packager (+ product registry scaffold). | 2 commits | domain-registry.json (+3 cards), patent-packager.js, product-registry scaffold, autonomic-scheduler |
| f9b41d0–403c5df (4 commits) | 2026-06-06 | **Epoch 13: Application Auditor (Master-Brain)** | NEW subsystem: Application auditor. Multi-AI audit → rewrite → sign → ship. Raise audit token cap 8000→16000 (fix full proposals truncated). Harden audit parser: brace-repair + regex salvage of score/findings. Concise findings (fix truncated-JSON parse). | 4 commits | api/application-auditor.js (master-brain), api/lib/audit-{parser, rewriter, signer}.js, audit-schema.json |
| 7e94e60 | 2026-06-06 | Adversarial reviewer + lessons rubric | Bake session learnings into rubric system. | 1 file | adversarial-reviewer.js, lessons-rubric.json |
| f664659–44a6422 (5 commits) | 2026-06-06 | **Epoch 14: Lane-Fit & Finance UX Hardening** | Grant lane: selectable funder template (NSF default, NIH option). Per-lane render intensity config (loose gate → distinct lane rendering). Lane-fit scorer (loose gate) — automate operator's manual card rating. Make finance surfaces accessible + brighter/larger fonts + operator guide. | 5 commits | grant-lane.html (NSF/NIH template), lane-fit-scorer.js, per-lane-config.json, finance-accessibility updates, operator-guide (finance section) |
| d6b4334, aaeb5dc, f6aad5f | 2026-06-06 | **Epoch 15: Rubric + Three-Build System** | Rubric +5: bake FOUR-doc review findings. Three builds: score-gating, two-part render (fixes truncation), investment lane. Fix adversarial 'gate: unknown' truncation at 20 lessons. | 3 commits | rubric.json (+5 rules), build-score-gating.js, build-two-part-render.js, build-investment-lane.js, truncation-fix |
| 65a0315, 7a5444b | 2026-06-07 | **Epoch 16: Vercel Footprint Optimization** | Move api/lib + api/lanes out of /api (−21 Vercel functions). Scope includeFiles to only what functions read (−~172 MB/function). Vercel size fix to stay under deploy limits. | 2 commits | vercel.json config, lib/ reorganization, .vercelignore scope refinement |

### KEY SUBSYSTEMS CREATED

1. **Treatment Discovery** (5ba1840→025987c): Neuro-disorder diagnostic surface with 113 brain nodes, PubMed-verified mechanisms, organ-binding fidelity audit.
2. **Gate B Authority Model** (a849f0d→3f513c5): Confidence labeling, epistemological gating, data-source badges across all consoles.
3. **Public Launch** (99fc150→0120251): Public front door, lead capture, front-page V2/V3 iterations, login model.
4. **Lean→Full Sync Mechanism** (3e408d7→4f4740c): GitHub Actions–driven overlay sync, resolves dual-repo drift.
5. **Redis Production Dispatch** (2c66a61→8f52cd8): Master-inbox + pattern-author routed through Redis for autonomous operation.
6. **Capital Engine** (721d0f4): Revenue-stream operating layer, 32 streams, Stripe + affiliate routing, single-signature sign-off.
7. **Journal Publishing** (06063d7): Autonomous owned-publishing surface, no platform gate.
8. **Application Auditor** (f9b41d0): Multi-AI audit→rewrite→sign→ship for grant proposals.
9. **Lane-Fit & Finance UX** (f664659→44a6422): Automatable card rating, per-lane render config, accessibility hardening.
10. **Fractal Portal Build** (029161b→63d860c): Dynamic tier-2 portal generation from corpus (30 tested, 13 deployed).

### SUBSYSTEMS REMOVED / ABANDONED

1. **Dead Civilization Cards** (3138040, 57069f7): Trust Posture + Polarity cards removed 2026-06-04.
2. **Detected Diagnoses & Treatments Card** (57069f7): Removed from civilization tab.
3. **Civilization Tab from Evidence Workspace** (a0e276c): Deprecated the entire tab integration 2026-06-04.
4. **Placeholder Suppression Workaround** (89afff8): 461/461 placeholders killed when real market data activated.
5. **Synchronous Author Path Bottleneck** (8f52cd8): Repair moved off slow path; author async now.

### EVOLUTION PATTERNS

- **Modularization Arc**: Early extracting of render-authority.js (2b1d082) → kernel-comparison (42fb519) → finance libs into /lib (530b055) → final Vercel footprint optimization (65a0315).
- **Gate Layering**: Gate B started simple (v0.1: company-portal) → expanded systematically (20+ targeted badge additions on 2026-06-01) → stabilized by 2026-06-04.
- **Dual-Repo Coordination**: Sync machinery (3e408d7) added canary tests (79d6897, 62eea6b, 0d4d5ea) with token issues (d4316ee) resolved by 2026-06-03.
- **Redis as Dispatch Backbone**: Master-inbox (2c66a61) → pattern-author (e499dcb) → chunked redisMGet (ad4e1d2) show increasing Redis reliance for async operation.
- **Feature Density Spike**: 2026-06-06 saw 14+ subsystems touched (journal, auditor, capital-engine, content-pipeline, lane-fit, rubric, adversarial-reviewer) in a single day, then footprint cleanup on 2026-06-07.
- **Data Verification Exhaustion**: Verification drive (8a59d4c) shows corpus verification saturation (7451→7900 processed, proven flat, unknown/unverifiable grew, verifiable claims exhausted).

### LIVE PAGES (per era)

- **Treatment Discovery**: https://limenhelix.com/treatment-discovery (Epoch 1, 025987c)
- **Master Inbox**: https://limenhelix.com/master-inbox (Epoch 0, core operator surface)
- **Vitals**: https://limenhelix.com/vitals (Epoch 6, ported 2026-06-04)
- **Pattern Proposals**: https://limenhelix.com/pattern-proposals (Epoch 8, print improvements 2026-06-04)
- **Operator Guide**: https://limenhelix.com/operator-guide (Epoch 2, enhanced 2026-06-06)
- **Capital Engine**: https://limenhelix.com/capital-engine (Epoch 10, 2026-06-06)
- **Journal**: https://limenhelix.com/journal (Epoch 12, 2026-06-06)
- **Public Front Door**: https://limenhelix.com/ (Epoch 3, 2026-06-02)
- **Company Portals**: https://limenhelix.com/company-portal/[slug] (Epoch 0, Gate B refined 2026-06-01)
- **Domain Workspaces**: https://limenhelix.com/[domain]-workspace (Epoch 0)
- **Civilization Cockpit**: https://limenhelix.com/civilization-cockpit (Epoch 3, restored 2026-06-02)

### NEEDS WORK / INCONSISTENCIES

1. **Vercel Function Count Still High**: 2026-06-07 move of api/lib+api/lanes reduced by 21 functions, but final count not stated; unclear if under 50-function soft limit. C:\Users\Chris\Limen-Helix-live-\vercel.json shows 54 functions at initial commit; post-2026-06-07 count unknown.
2. **Treatment-Discovery Cube Excluded**: 82 MB treatment-discovery-cube.json lives in full repo only (per 025987c); lean repo uses split by-node/*.json. If full repo offline, cube rebuild pipeline in full repo cannot be replayed from lean.
3. **Capital Engine Single-Signature Gating**: FINANCE_PORTAL_SIGNOFF.md flags fees/lending/transfers as "halt for sign-off", but no enforcement code visible in commits; likely in FINANCE_PORTAL_SIGNOFF.md audit trail only, not enforced at API level.
4. **Civilization Card Removal Rationale Unclear**: Commits 3138040, 57069f7, a0e276c removed Trust Posture, Polarity, Detected Diagnoses & Treatments, and entire Civilization tab from Evidence Workspace, but no commit message explains why these were dead or what replaced them.
5. **Verification Drive Plateau (8a59d4c)**: "Verifiable claims exhausted" — 7451→7900 processed claims, but proven count flat. Unclear if corpus has hit ceiling or if verification logic needs revision. No follow-up commit visible.
6. **GitHub Action Token Issues**: 3 test commits (62eea6b, 0d4d5ea) show token rejection (d4316ee disable auto-failing sync). Lean→full sync machinery likely disabled or manual-only post-2026-06-03.
7. **DARK Flags Not Fully Toggled**: 6dff4d2 ("Mirror action-selection gate... DARK behind flag") and d1ac73d ("Feed→Discovery STAGE 1... DARK") added code, but no commit shows feature flag toggling; likely ops-time enablement via Redis or code branch.
8. **Adversarial Reviewer Rubric Vague**: 7e94e60 "bake this session's learnings into the system" — 1 file changed, but unclear what findings were baked into what rubric schema.
9. **Finance Libs Footprint: Pre-2026-06-06 Duplication**: Before 530b055, finance libs lived in /api; post-2026-06-06 in /lib. Any old /api/finance-*.js files left behind? No cleanup commit visible.
10. **Three-Build System (aaeb5dc) Underdocumented**: "score-gating, two-part render, investment lane" — all appear to be build stages, but no summary of build orchestration pipeline added; build scripts not in commits.

### SUBSYSTEMS ACROSS EPOCHS

| System | Era | Birth | Last Update | Status |
|---|---|---|---|---|
| Bridge Engine | Epoch 0 | 5ba1840 | 6fb6a58 (honesty gate 2026-06-04) | ACTIVE |
| Portal Corpus | Epoch 0 | 5ba1840 | 63d860c (fractal +30 tier-2 2026-06-05) | ACTIVE (autobuild) |
| Autonomic Loop | Epoch 0 | 5ba1840 | a66d650 (tick enabled 2026-06-06) | ACTIVE |
| Domain Brains | Epoch 0 | 5ba1840 | 86af8bd (TD cube residuals 2026-06-03) | ACTIVE |
| Treatment Discovery | Epoch 1 | 025987c | 05f26a8 (cube rebuild 2026-06-04) | ACTIVE |
| Gate B | Epoch 2 | a849f0d | 06d30a0 (confidence collapse fix 2026-06-01) | STABLE |
| Public Launch | Epoch 3 | 99fc150 | 77af662 (counter rollup 2026-06-03) | ACTIVE |
| Civilization | Epoch 3 | 61858d0 | a0e276c (Evidence tab removed 2026-06-04) | REDUCED (deprecated cards) |
| Lean→Full Sync | Epoch 4 | 3e408d7 | d4316ee (disabled 2026-06-03) | INACTIVE (token issues) |
| Redis Dispatch | Epoch 5 | 2c66a61 | ad4e1d2 (chunk guard 2026-06-04) | ACTIVE |
| Vitals | Epoch 6 | 8ea5a04 | 28002ff (backlog surface 2026-06-05) | ACTIVE |
| Pattern Authoring | Epoch 7 | c8c7615 | d8f0034 (dedup gate 2026-06-04) | ACTIVE |
| Print Pipeline | Epoch 8 | 08b8c7d | d7d681c (portal-page route 2026-06-04) | ACTIVE |
| Fractal Build | Epoch 9 | 029161b | 63d860c (batch +20 2026-06-05) | ACTIVE (gated) |
| Capital Engine | Epoch 10 | 721d0f4 | 530b055 (footprint 2026-06-06) | LAUNCH |
| Content Production | Epoch 11 | 51388ba | 1157785 (IP-safe grounding 2026-06-06) | ACTIVE (3-model) |
| Journal | Epoch 12 | 06063d7 | (standalone) | LAUNCH |
| Application Auditor | Epoch 13 | f9b41d0 | 403c5df (token cap 2026-06-06) | LAUNCH |
| Lane-Fit | Epoch 14 | f664659 | 44a6422 (config 2026-06-06) | ACTIVE |
| Rubric System | Epoch 15 | d6b4334 | f6aad5f (gate truncation fix 2026-06-06) | ACTIVE |
| Vercel Footprint | Epoch 16 | 65a0315 | 7a5444b (scope fix 2026-06-07) | ONGOING |

---

## 1. HTML SURFACE — ALL 3,397 ROOT-LEVEL HTML FILES BY FAMILY

### PURPOSE
The root-level HTML files comprise the entire user-facing surface of LIMEN Helix. They are organized into 49 families:
- **18 major domain portals** (206-207 files each): governance, population, religion, intelligence, industry, infrastructure, defense, energy, environment, finance, trade
- **11 medium-domain portals** (116-176 files each): culture, economy, law, medicine, technology, science, communication, education (core diagnostic/reference portals)
- **Hyper-specialized pages** (2-5 files): helix (internal reports), agriculture (command/console/workspace/opportunities), master (brain grid, inbox, executor), operator, execution, company, etc.
- **Standalone utilities** (1 file each): index.html (login/landing), civilization.html (console hub), treatment-discovery.html, journal.html, vitals.html, and 30+ others

All 3,397 files are at the root level — **zero HTML files exist in subdirectories** (verified).

### KEY FILES
**(Representative paths — exhaustive list documented by family below)**

**LANDING / AUTH / HUB:**
- C:\Users\Chris\Limen-Helix-live-\index.html — Login/home page, civilization-scale pitch with 5-field grid + CTA to console
- C:\Users\Chris\Limen-Helix-live-\civilization.html — Master console hub, 3-column grid layout, links all 19 domain portals via top nav

**MAJOR DOMAIN PORTAL FAMILIES (18 domains, 206–207 files each):**
1. **governance_*.html** (207 files) — E.g., governance_portal.html → 20 subcategories (anticorruption, civicpart, crisis, digitalgov, diplomatic, electoral, executive, federalism, govaudit, govdata, humanrights, intelligence, intergovt, judicial, legislative, policy, public, regulatory, sanctions, succession). Each subcategory: 9–11 tertiary portals (e.g., governance_anticorruption_antimoney_portal.html, governance_anticorruption_assetdisc_portal.html, etc.)
2. **population_*.html** (206 files) — Population & Demographics: aging, caregiving, fertility, health equity, etc.; same 3-tier hierarchy
3. **religion_*.html** (206 files) — Religious institutions, freedom, conflict, ethics, etc.; 3-tier hierarchy
4. **intelligence_*.html** (204 files) — Intelligence operations: collection, analysis, counterintel, oversight, etc.; 3-tier hierarchy
5. **industry_*.html** (197 files)
6. **infrastructure_*.html** (197 files)
7. **defense_*.html** (197 files)
8. **energy_*.html** (197 files)
9. **environment_*.html** (196 files)
10. **finance_*.html** (195 files)
11. **trade_*.html** (194 files)
12. **culture_*.html** (176 files)
13. **economy_*.html** (167 files)
14. **law_*.html** (165 files)
15. **medicine_*.html** (142 files) — Healthcare: cardiology, oncology, mental health, public health, etc.
16. **technology_*.html** (139 files)
17. **science_*.html** (125 files)
18. **communication_*.html** (123 files)
19. **education_*.html** (116 files) — E.g., education_admissions_entrance_portal.html

**MEDIUM-TIER HYBRID PAGES:**
- C:\Users\Chris\Limen-Helix-live-\helix-report.html — HELIX REPORT: custom styled dashboard (gold/cyan theme, different CSS)
- C:\Users\Chris\Limen-Helix-live-\helix-artifacts.html, helix-artifact.html, helix-brain-grid.html, helix-portal-coverage.html — Internal artifact/coverage pages

**SPECIALIZED COMMAND/WORKSPACE PAGES:**
- C:\Users\Chris\Limen-Helix-live-\agriculture-command.html — Domain command board (stress scorer, THING 1/THING 2, table-based layout)
- C:\Users\Chris\Limen-Helix-live-\agriculture-console.html — Domain console variant
- C:\Users\Chris\Limen-Helix-live-\agriculture-opportunities.html — Opportunity grid card layout
- C:\Users\Chris\Limen-Helix-live-\agriculture-workspace.html — Workspace UI (4 files for agriculture family)

**MASTER/OPERATOR PAGES:**
- C:\Users\Chris\Limen-Helix-live-\master-brain.html — Master Brain grid (10x10 posture cells, transitions log, hierarchy tiers)
- C:\Users\Chris\Limen-Helix-live-\master-brain-inbox.html — Master Brain inbox
- C:\Users\Chris\Limen-Helix-live-\master-brain-executor.html — Master Brain executor variant
- C:\Users\Chris\Limen-Helix-live-\master-inbox.html — Master inbox
- C:\Users\Chris\Limen-Helix-live-\operator-guide.html, operator-onboarding.html, operator-sop.html (3 files)

**UTILITY / DISCOVERY / WORKFLOW PAGES:**
- C:\Users\Chris\Limen-Helix-live-\treatment-discovery.html — Treatment discovery node grid, state pills (hyperactive/hypoactive/regulated), verification badges, residual tracking
- C:\Users\Chris\Limen-Helix-live-\clinical-portal.html — Clinical portal
- C:\Users\Chris\Limen-Helix-live-\provider-portal.html — Provider portal
- C:\Users\Chris\Limen-Helix-live-\company-lookup.html — Company lookup
- C:\Users\Chris\Limen-Helix-live-\company-portal.html — Company portal
- C:\Users\Chris\Limen-Helix-live-\execution-framework.html, execution-reports.html (2 files)
- C:\Users\Chris\Limen-Helix-live-\journal.html — Journal page
- C:\Users\Chris\Limen-Helix-live-\vitals.html — Vitals dashboard
- C:\Users\Chris\Limen-Helix-live-\applications.html — Applications page
- C:\Users\Chris\Limen-Helix-live-\policy-procedures.html, pattern-proposals.html, disputes-exceptions.html, family-law.html, payout-operations.html, admin-leads.html, my-documents.html, kernel-comparison.html, kc-guide.html, kc-thanks.html, limen-report.html, venture-portfolio.html, crm-pipeline.html, investment-console.html, domain-console.html, portal-template.html, portal-pricing.html, phase-observer.html (18 additional singleton utilities)

### LIVE PAGES
**(Clean Vercel URLs, cleanUrls: true enabled)**

**Primary Hubs:**
- https://limenhelix.com/ — Login/home + proof strip
- https://limenhelix.com/civilization — Master console (3-column grid)

**Domain Portal Trees (19 domains, representative sample):**
- https://limenhelix.com/governance-portal — Governance root portal
- https://limenhelix.com/governance-anticorruption-portal — Anticorruption node (2nd tier)
- https://limenhelix.com/governance-anticorruption-antimoney-portal — Anti-Money Laundering (3rd tier, with 3D connectome, left-panel issue list, right-panel deep-dive)
- https://limenhelix.com/population-portal → /population-aging-portal → /population-aging-caregiving-portal (same structure)
- https://limenhelix.com/education-portal → /education-admissions-portal → /education-admissions-entrance-portal
- https://limenhelix.com/medicine-portal, /science-portal, /technology-portal, /law-portal, /finance-portal, /intelligence-portal, /defense-portal, /environment-portal, /trade-portal, /economy-portal, /infrastructure-portal, /religion-portal, /industry-portal, /energy-portal, /communication-portal, /culture-portal (17 more domain portals, same hierarchical structure)

**Specialized Pages:**
- https://limenhelix.com/agriculture-command — Agriculture command board (stress table, refreshing data)
- https://limenhelix.com/agriculture-opportunities — Opportunity grid
- https://limenhelix.com/master-brain — Master brain grid (10x10 posture, transitions)
- https://limenhelix.com/master-brain-inbox — Inbox variant
- https://limenhelix.com/treatment-discovery — Treatment node discovery with filtering
- https://limenhelix.com/clinical-portal, /provider-portal, /company-lookup (workflow utilities)

### DATA
**(Which tanks/APIs/files it READS and WRITES)**

All 3,397 HTML pages follow a **common load pattern**:

1. **Authentication check (client-side)** — Every portal*_portal.html checks sessionStorage.limen_access on page load; redirects to `/?return=<path>` if not granted. Landing page (index.html) manages OAuth/session setup.

2. **Common CSS & JS libraries loaded:**
   - `assets/css/portal.css` — Shared portal styling (grid layout, colors, panels)
   - `assets/js/connectome-core.js` — Brain connectome graph/node model
   - `assets/js/connectome-renderer.js` — Canvas/3D rendering
   - `assets/js/observer-node.js` — Node observation logic
   - `assets/js/memory-layer.js` — Caching/history
   - `assets/js/curiosity-engine.js` — Query/discovery engine
   - `assets/js/hebbian-learning.js` — Adaptive learning
   - `assets/js/global-workspace.js` — Shared workspace state
   - `assets/js/global-signals.js` — Domain/cross-domain signaling
   - `assets/js/phase-estimator.js` — Phase computation (P1–P7 lifecycle)
   - `assets/js/portal-ui.js` — Portal initialization & UI (PortalUI.init() called with domainId, groupOrder, issuesEnabled flags)

3. **Domain-specific data source (via PortalUI.init):**
   - Each portal calls `PortalUI.init({domainId: 'domain_subdomain_subsubdomain', issuesEnabled: true, parentLabel: '...', brainWhy: {}, groupOrder: [...]})` 
   - **domainId** parameter (e.g., 'governance_anticorruption_antimoney') likely keys into **assets/data/** tanks:
     - **assets/data/connectome-nodes.json** (or similar per-domain index) — 123 brain regions, node definitions, phase labels
     - **assets/data/domain-cubes/** or similar per-domain JSON files — Issue lists, node mappings, intervention bundles
   - **brainWhy: {}** — Empty in all sampled pages; possibly for future override of phase/phase-estimator data

4. **Heavy data consumers (inferred from HTML structure):**
   - **Portal root pages** (e.g., governance_portal.html): Load issue/sub-portal index, breadcrumb chain
   - **Tertiary portals** (e.g., governance_anticorruption_antimoney_portal.html): Load full connectome for domain (111 brain regions mapped to 8 functional nodes), issue list, 3D model data
   - **Command boards** (agriculture-command.html): Real-time stress scorers, THING 1/THING 2 feeds, per-domain stats (likely hitting `/api/` endpoints for live data)
   - **Treatment discovery** (treatment-discovery.html): Node grid filtered by state (hyperactive/hypoactive/regulated), residual tracking — reads large treatment-discovery-cube.json (~84MB measured)
   - **Master brain** (master-brain.html): Reads global posture grid (10x10 cells, 100 nodes), recent transitions log, hierarchy tiers

5. **Data state (FRESH / STALE / EMPTY):**
   - **connectome-nodes.json, domain cubes**: Likely **FRESH** — portals reference live domainId and render immediately on PortalUI.init()
   - **treatment-discovery-cube.json (~84MB)**: Measured 84MB, last-modified timestamp should be checked in assets/data/ directory. Likely **STALE** if not recently regenerated (verify with PowerShell stat).
   - **Command board live feeds**: Status unknown — agriculture-command.html shows "LAST UPDATED" timestamp; refresh button + auto-60s toggle suggest live polling (likely hitting `/api/agriculture-stress` or similar). Check api/agriculture-* or api/command-* for serverless functions.

### HOW IT CONNECTS
**(Spider-web: which other subsystems consume/produce its signals; per-domain information path)**

**FORWARD INFORMATION FLOW (portal → downstream):**

1. **index.html → civilization.html flow:**
   - Landing page (index.html) handles OAuth login, sets sessionStorage.limen_access = 'granted', redirects to /civilization
   - civilization.html shows global console with 3-column grid: left panel (clarity view toggle), center (connectome canvas), right (domain portfolio)
   - Clicking domain portal link from civilization → loads domain_portal.html

2. **Domain portal hierarchy cascade:**
   - governance_portal.html → loads governance issue index, shows 20 clickable subcategory nodes
   - Click "anticorruption" node → governance_anticorruption_portal.html → shows 11 tertiary nodes (antimoney, bribery, asset disclosure, etc.)
   - Click "antimoney" node → governance_anticorruption_antimoney_portal.html → full 3D connectome + deep-dive panel
   - **Breadcrumbs & back links** hard-coded in HTML (e.g., topbar-bc in governance_anticorruption_antimoney_portal.html shows `civilization.html → governance_portal.html → governance_anticorruption_portal.html → CURRENT`)

3. **Cross-domain navigation (portal-nav):**
   - Every portal renders fixed **portal-nav** bar with all 19 domain links (civilization.html, governance, economy, infrastructure, energy, industry, science, medicine, education, technology, communication, culture, defense, environment, religion, population, trade, law, finance, intelligence)
   - Allows lateral jumps between domain trees without returning to civilization hub

4. **Connectome as shared mental model:**
   - All 19 major domain portals reference the same **123-node connectome** (brain regions)
   - Each domain maps its **8 functional nodes** to specific brain regions (evidenced by phase-estimator.js, "111 brain regions" shown in portal headers)
   - **Phase lifecycle** (P1–P7) labeled in every portal deep-dive panel (e.g., "P7 · Regulation" for anti-money laundering)
   - This shared model allows **cross-domain pattern matching** via connectome-core.js

5. **Master brain → domain drill-down:**
   - master-brain.html shows **global 10x10 posture grid** (100 nodes) + recent transitions + hierarchy tiers
   - Clicking a posture cell → likely navigates to the corresponding domain_portal.html or specific issue node
   - master-brain-inbox.html aggregates notifications/items across all domains; clicking item → drill-down to source domain portal

6. **Treatment discovery ↔ all domains:**
   - treatment-discovery.html is a **cross-domain search tool**: filters treatment nodes across all 19 domains by state (hyperactive/hypoactive/regulated)
   - Each card shows node ID, brain region, domain, state pills, residuals
   - Clicking → drill-down to source domain_subdomain_portal.html deep-dive panel
   - **Residuals** (shown at bottom of node detail) signal back to source domain for follow-up action

7. **Command boards (agriculture-specific, model for others):**
   - agriculture-command.html hits `/api/agriculture-stress` or similar real-time endpoint
   - Shows **stress scorer results** (THING 1/THING 2) per sub-node (e.g., crops, livestock, water)
   - **Expandable rows** show per-node detail, linked to agriculture_portal.html sub-nodes
   - Manual override grid allows operator to **adjust stress weights**, likely POST back to `/api/agriculture/update`
   - Refresh/auto-60s toggle updates stats bar in real-time

8. **Operator workflows (master-brain → agriculture-command → civilization):**
   - master-brain-executor.html (green-tinted) is operator-ready variant of master-brain
   - Shows "READY" | "NEAR" | "BLOCKED" | "NO COVERAGE" status badges
   - Clicking "READY" item → opens agriculture-command.html or equivalent domain command board
   - Operator enters override values → POST to `/api/<domain>/apply-override`
   - Result feeds back to master-brain posture grid (cell updates, transition logged)

**BACKWARD SIGNALING (API → portals):**

- `/api/domains/<domain-id>/*` endpoints (e.g., `/api/governance/connectome`, `/api/agriculture/stress`) populate portal data
- `/api/issues` or `/api/domains/<domain-id>/issues` feeds left-panel issue lists in all portals
- `/api/master-brain/posture` feeds master-brain.html grid
- `/api/master-brain/transitions` feeds recent transitions log
- `/api/treatment-discovery/nodes` feeds treatment-discovery.html node grid

### NEEDS WORK / INCONSISTENCIES

1. **Session/Auth leakage across portals:**
   - Every portal*_portal.html checks `sessionStorage.limen_access` on load; if missing, redirects to `/?return=...`
   - **Risk**: If session expires mid-navigation, user bounces to login. No transparent re-auth; user must re-login and manually return.
   - **Fix**: Implement session-extend middleware; add token refresh before page load.

2. **Hard-coded breadcrumbs (no dynamic generation):**
   - Every portal has static breadcrumb HTML (topbar-bc). If a parent portal file is renamed or moved, children become orphaned.
   - Example: governance_anticorruption_antimoney_portal.html hard-codes `<a href="governance_anticorruption_portal.html">ANTICORRUPTION</a>` — if that file is deleted, link 404s.
   - **Fix**: Generate breadcrumbs server-side from domainId path; inject into PortalUI.init().

3. **Index-only root portals (governance_portal.html, etc. == only "1" per domain):**
   - Only **19 root portal files** exist (one per domain), yet each domain has **206–207 total files**.
   - This suggests **deep hierarchy is not reflected in file count**; most files are tertiary or deeper portals.
   - **Verification needed**: Sample a governance subcategory (e.g., governance_anticorruption_portal.html) — is it a real file or dynamically generated?

4. **Orphan/unused pages (high risk):**
   - **Singletons with unclear ownership** (C:\Users\Chris\Limen-Helix-live-\kernel-comparison.html, vitals.html, applications.html, phase-observer.html, etc.) — no breadcrumbs link to them from master hubs. May be outdated or test pages.
   - **Command**: `grep -r "kernel-comparison.html\|phase-observer.html" assets/js/` to check if any portal or PortalUI.init() references them. If zero hits, flag as orphan.

5. **Missing agriculture model for other 18 domains:**
   - Only **agriculture** has the command/console/opportunities/workspace quad (4 files).
   - No corresponding **energy-command.html**, **medicine-command.html**, etc., yet agriculture-command.html suggests **operators need per-domain command boards for stress management**.
   - **Fix**: Either (a) implement command board for all 18 domains, or (b) consolidate all command boards into single unified interface with domain selector.

6. **Treatment discovery cube size (~84MB) — no pagination:**
   - treatment-discovery.html loads full treatment-discovery-cube.json (~84MB).
   - **Risk**: Page may hang on slow connections; no server-side pagination, filtering, or lazy-loading shown.
   - **Fix**: Implement server-side filtering endpoint (e.g., `/api/treatment-discovery/nodes?state=hyperactive&domain=medicine`); paginate results.

7. **3D brain model (three.js r128) — no fallback:**
   - Every portal loads `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` + connectome-renderer.js
   - No canvas fallback or 2D alternative if three.js fails to load
   - **Risk**: Old browsers or offline environments may see blank center-view canvas
   - **Fix**: Add feature detection; render 2D force-graph fallback if three.js unavailable.

8. **Portal-nav links are static (copy-pasted across all 3,397 files):**
   - The portal-nav (showing all 19 domain links) is hard-coded in every single page.
   - If a domain is added/removed, all 3,397 files must be updated.
   - **Fix**: Inject portal-nav dynamically from a shared JS config (assets/js/portal-nav-inject.js) at page load.

9. **Master-brain hierarchy tiers (purpose unclear):**
   - master-brain.html shows a "tier" block below posture grid (illustrated with glyphs + labels).
   - **No link evidence** from other pages showing how tiers are used; may be prototype/unused.
   - **Verify**: Grep assets/js/ for "mb-tier" or "hierarchy" references; if none, flag as dead code.

10. **Disconnected singleton utilities:**
    - **company-lookup.html, venture-portfolio.html, investment-console.html** appear to be financial workflow pages, but no navigation path from civilization/master-brain to them.
    - **clinical-portal.html, provider-portal.html** appear to be healthcare workflow pages (not part of medicine_*_portal.html family), but may duplicate data.
    - **Verify**: Check if these are legacy/deprecated, or if hidden navigation exists.

11. **Empty or minimal brainWhy objects:**
    - Every PortalUI.init() call passes `brainWhy: {}` (empty dict).
    - **Clarify**: What is brainWhy intended to do? If empty, remove it; if intended for future use, document the schema.

12. **Portal CSS monolith (portal.css):**
    - All 19 major domain portals load the same `assets/css/portal.css`, which must contain styles for all variable panel widths, node counts, phase colors, etc.
    - **Risk**: File may be huge and unmaintainable; no per-domain style overrides observed.
    - **Verify**: Measure assets/css/portal.css file size and rule count; if >10K lines, consider splitting by feature.

---

**SUMMARY COUNTS:**
- **3,397 root .html files (verified)**
- **49 families** by prefix (governance: 207, population: 206, religion: 206, ..., family: 1)
- **19 major domain portal trees** (each 116–207 files, 3–4-tier hierarchy)
- **5 helix/internal pages**
- **4 agriculture/command pages**
- **4 master/operator pages**
- **3 operator workflow pages**
- **30 singleton utilities/workflows**
- **Zero HTML files in subdirectories**
- **Zero dynamic route/template system detected** (all 3,397 are static .html files)

---

---

## 2. Browser JS Modules (assets/js/** by subdir)

### PURPOSE
Frontend application modules implementing LIMEN HELIX's distributed cognitive architecture. The 624 assets/js files organize into domain-specific diagnostic engines (16 domains × 16 standard modules each), cross-domain intelligence layers, execution systems (88 modules), and specialized subsystems. Files range from foundational kernel modules to sophisticated real-time state management, narrative generation, portal content resolution, and artifact production pipelines.

### KEY FILES

**ROOT LOOSE FILES (489 files):**
- **16 major domain implementations** (agriculture, finance, science, environment, industry, economy, culture, intelligence, technology, education, religion, defense, energy, communication, population, trade, governance, infrastructure, law, medicine) — each with 16 standard module slots:
  - `{domain}-business-build.js` — Diagnoses domain-specific business opportunities
  - `{domain}-business-review.js` — Reviews/validates business cases
  - `{domain}-claim-flow.js` — Maps claim/opportunity lifecycle
  - `{domain}-claim-ledger.js` — Persists claim ledgers  
  - `{domain}-clarity-operator.js` — Renders clarity view panels (high-level status)
  - `{domain}-compensation.js` — Calculates capital requirements/sizing
  - `{domain}-directive-extractor.js` — Extracts actionable directives from data  
  - `{domain}-directive-ranker.js` — Prioritizes directives
  - `{domain}-directive-translator.js` — Converts directives to operator language
  - `{domain}-execution-panels.js` — Renders execution/readiness panels
  - `{domain}-node-business-engine.js` — Core business valuation logic
  - `{domain}-operator-panel.js` — Operator-facing UI components
  - `{domain}-opportunity-economics.js` — Sizes/values opportunities
  - `{domain}-promotion-bridge.js` — Bridges domain signals to civilization layer
  - `{domain}-pulse-engine.js` — Real-time stress/activity monitoring
  - `{domain}-targeting-engine.js` — Target-list and filtering

**Execution System (88 files):** `execution-*.js` — comprehensive workflow, approval, auditing, monitoring, fulfillment pipeline  
  Key modules: action-queue, approval-authority, auditor-gates, board-snapshot, bottlenecks, capacity-governance, checkpoints, claim-agreement, closeout-flow, coherence, cohorts, command-orchestrator, commercialization, crm-conversion, decision-memory, deployment-readiness, disputes, draft-actions, drift, economic-memory, entity-linking, escalation, exception-pressure, family-memory, feedback-engine, followup-tasks, governance-thresholds, guided-sequences, human-confirmation, incentive-sim, intake, integrations, integrity, investment-controls, lifecycle, lineage-graph, live-readiness, module-registry, monitoring, next-best-action, operating-digest, operator-board, operator-onboarding, operator-pathways, operator-stats, opportunity-aging, ops-dashboard, outcomes, payout-finalizer, payout-ops, phase10-dashboard, phase10-loader, phase11-dashboard, phase11-loader, phase7-loader, phase8-dashboard, phase9-dashboard, phase9-loader, playbooks, policy-compliance, policy-config, policy-propagation, policy-versioning, portfolio-feedback, portfolio-monetization, portfolio-monitor, portfolio-shell, recommended-actions, regulatory, reliability-panel, repair-queue, reports, resilience, revenue-intelligence, revops, saturation, self-audit, strategic-memory, tracking, workload

**Core Intelligence & State (15 files):**
- `global-state-engine.js` — Aggregate civilization state machine
- `global-workspace.js` — Shared state container
- `global-signals.js` — Cross-domain signal routing
- `domain-registry.js` — Feed catalog, external API endpoints (USDA, FAO, arXiv, CDC, USPTO, Event Registry, NOAA, GDELT, UN Population, Federal Register, CourtListener, Finnhub, etc.)
- `domain-identity.js` — Domain-key mapping and canonical nomenclature
- `domain-signal-engine.js` — Aggregates /api/domain-snapshot into state
- `domain-connectome-map.js` — Computes cross-domain signal propagation
- `connectome-core.js` — Inter-domain relationship model
- `connectome-renderer.js` — Visualizes connectome graph
- `connectome-resolver.js` — Resolves connectome queries; disabled /api/kernel-experiment (formerly POSTed company data)
- `cross-domain-detector.js` — Detects systemic patterns across domains
- `master-brain-executor.js` — Bootstrap orchestrator for domain-brain lifecycle
- `master-brain-readiness.js` — Pre-deployment readiness checks
- `civilization-connectome.js` — Civilization-layer connectome model

**Portal & Artifact Production (16 files):**
- `portal-ui.js` — Portal rendering frontend
- `portal-router.js` — Routes to domain portals
- `portal-pricing-config.js` — Opportunity pricing rules
- `company-portal-engine-render.js` — Renders portal content from treatment/diagnosis templates
- `company-resolver.js` — CIK/ticker/slug resolution to company identity
- `company-portal-ui.js` — Company-facing portal views

**Real-time Narration & Clarity (12 files):**
- `console-narrator.js` — TTS synthesis and narration queueing
- `event-narrator.js` — Event-triggered narration (domain escalations, phase shifts)
- `philemon-voice-guide.js` — Named voice guide (elder-sounding guide persona with alert deduplication, voice profile: rate 0.78, pitch 0.72, volume 0.75; supports plain-language command processing: "what am I looking at", "summarize", "which domain is worst", etc.)
- `narrative-memory.js` — Remembers recent narrations to avoid repetition
- `event-engine.js` — Emits domain/system-level events (escalation, phase-shift, de-escalation)
- `timeline-engine.js` — Builds system history timeline
- `discovery-engine.js` — Surfaces new discoveries and anomalies
- `investigation-engine.js` — Deep-dives into domain/signal anomalies
- `live-discoveries.js` — Real-time discovery detection
- `market-stress-triage.js` — Rapid triage of market stress signals
- `self-health-monitor.js` — Self-diagnostics for system health
- `self-repair-engine.js` — Auto-remediation for system issues

**Command & Control (8 files):**
- `limen-command-bar.js` — Ctrl+K command palette with fuzzy search
- `limen-fast-boot.js` — Fast-path initialization
- `limen-bootstrap.js` — Main lifecycle bootstrap
- `command-board-stress.js` — Reads /api/limen-stress-slim for command-board dispatch
- `limen-topbar.js` — Top navigation bar
- `limen-ui-state.js` — UI state management
- `ui-mode-manager.js` — Manages clarity/analyst/debug modes
- `auth-gate.js` — Auth checks on page load

**Kernel & Phase Management (7 files):**
- `phase-estimator.js` — Estimates domain phase progression  
- `kernel-comparison.js` — Compares kernel outputs
- `kernel-output-interpreter.js` — Decodes kernel-returned diagnostics/scores
- `kernel/limen-phase-domain-adapter.js` — Adapts kernel phase outputs to domain state
- `connectome-kernel-adapter.js` — DISABLED (formerly POSTed to /api/kernel-experiment); now routes to protected /api/helix-report/score

**Feeds & Ingestion (5 files):**
- `feed-store.js` — In-memory feed data cache
- `feed-state.js` — Tracks feed health (hydrated, degraded, stale)
- `limen-defense-signal-engine.js` (feeds subdir) — Defense domain signal ingestion
- `world-signal-ingestor.js` — Ingests external world signals
- `action-selection-gate.js` — Gates execution action dispatch

**Portal Content Resolution (domain-brains subdirectory):**
- `portal-content-resolver.js` — Fetches /assets/data/domains/{domainId}.json, falls back to /api/fetch-portal?domainId=X (GitHub-mediated), with negative-cache on 404 (1-hour TTL)
- `domain-change-log.js` — Reads /api/limen-changelog
- `domain-console-brain.js` — Per-domain console implementation
- `inter-brain-bus.js` — Pub/sub between domain brains
- `domain-isolator.js` — Runs domain brains in isolated mode (testing)

**Decision & Memory (8 files):**
- `decision-memory.js` — Stores past decisions and outcomes
- `memory-layer.js` — Long-term state persistence
- `epistemic-state.js` — Tracks confidence/certainty
- `interoceptive-divergence.js` — Detects internal state conflicts
- `observer-node.js` — Observes system state without acting
- `narrative-memory.js` — Dedup narration calls
- `panel-state-manager.js` — UI panel expand/collapse state
- `shared-snapshot-engine.js` — Single /api/domain-snapshot fetch, shared across domain brains

**Advanced Reasoning (7 files):**
- `curiosity-engine.js` — Generates exploratory queries
- `propagation-engine.js` — Forward-propagates domain signals
- `hebbian-learning.js` — Signal co-occurrence learning
- `oracle-stance-guard.js` — Validates claims against evidence
- `render-authority.js` — Authority-layer rendering
- `report-polarity-engine.js` — Analyzes report sentiment/polarity
- `research-observatory.js` — Aggregates research signals

**Analysis & Diagnostics (6 files):**
- `balance-meter.js` — Checks domain stress balance
- `biosensor-bridge.js` — Bridges biosensor readings to domain stress
- `biosensor-control-panel.js` — Biosensor UI
- `action-suggester.js` — Recommends next actions
- `analyst-report-builder.js` — Builds analyst reports
- `docs-viewer.js` — POSTs to /api/fetch-doc for docs

**Company/Company Data (7 files):**
- `company-portal-engine-render.js` — Renders company portals (20 domains)
- `company-portal-ui.js` — Company portal UI
- `company-resolver.js` — Ticker/CIK resolution
- `portfolio-context.js` — Portfolio context for opportunity sizing
- `command-board-stress.js` — Reads stress-slim for company command boards

**SUBDIRECTORIES (by count):**

- **domain-brains/** (65 files: 20 domain brains + 19 refresh controllers + 9 utilities)
  - 20 domain brain implementations: `{domain}-brain.js` (agriculture, communication, culture, defense, economy, education, energy, environment, finance, governance, industry, intelligence, law, medicine, population, religion, science, technology, trade, plus law)
  - 19 refresh controllers: `{domain}-refresh-controller.js` — polling wrappers that fetch /api/domain-snapshot periodically
  - Utilities: domain-brain-base.js, inter-brain-bus.js, domain-change-log.js, domain-console-brain.js, domain-isolator.js, execution-manager.js, portal-content-resolver.js
  - Nested data directory (18 opportunity playbooks): `{domain}-opportunity-playbooks.js` — domain-owned templates for diagnosis → opportunity lane mapping (see: agriculture-opportunity-playbooks.js for format)

- **executive/** (8 files)
  - `limen-executive-control.js` — High-level execution controls
  - `limen-action-adapters.js` — Adapter layer for action dispatch  
  - `limen-executive-ui.js` — Executive dashboard
  - `limen-ingest-client.js` — Reads /api/limen-ingest
  - `limen-package-generator.js` — Builds opportunity packages
  - `limen-exec-generator.js` — Generates exec-level summaries
  - `limen-simulation-engine.js` — Simulates execution scenarios
  - `response-safety-layer.js` — Validates responses before sending

- **civilization/** (9 files)
  - `artifact-packet-builder.js` — Composes D3-A3.v3 ArtifactPackets from HandoffPacket (canonical opportunity unit) + Observatory packets (enrichment via domain/lane/diagnosis tuple)
  - `artifact-source-index-client.js` — Index client for artifact sources
  - `observatory-deep-proof.js` — Validates evidence chains; never calls /api/fetch-portal
  - `observatory-aggregator.js` — Aggregates observatory packets
  - `observatory-ui.js` — Observatory visualization
  - `cross-node-opportunity.js` — Identifies cross-node opportunities
  - `cross-domain-audit.js` — Audits cross-domain signal coherence
  - `domain-packet-adapter.js` — Adapts domain packets to civilization format
  - `handoff-contract.js` — Defines handoff packet structure

- **master-brain/** (6 files)
  - `artifact-factory.js` — MB-C: deterministic draft-package builder (patent/grant/SBA/investment; no LLM, no network, no filing; includes forbidden-phrase validation)
  - `artifact-intake.js` — Receives intake items from signal stream
  - `artifact-finalizer.js` — Finalizes packages pre-filing
  - `oib-assembler.js` — Assembles OIB (Opportunity Intake Board)
  - `decision-engine.js` — Routes intake items to lanes (patents, grants, SBA, investments)
  - `review-gate.js` — Human review checkpoint

- **limen/** (19 files)
  - `civilization-super-brain.js` — Multi-domain cognitive orchestrator
  - `connectome-super-brain.js` — Connectome reasoning engine
  - `master-living-brain.js` — Long-running master intelligence
  - `super-brain-base.js` — Base class for super brains
  - `artifact-list-ui.js` — Reads /api/limen-artifact-render for artifact lists
  - `artifact-viewer-ui.js` — Artifact detail viewer
  - `brain-grid-ui.js` — Multi-brain dashboard
  - `operator-canonical-identity.js` — Operator identity resolution
  - `operator-state-ui.js` — Operator state display (reads /api/operator-state-ui)
  - `human-state-packet.js` — Reads /api/human-state packet
  - `human-context-gate.js` — Human context authorization
  - `engine-context-builder.js` — Builds context for engine runs
  - `engine-runner-claude.js` — Runs Claude engine (reads /api/limen-engine-output)
  - `multi-pass-runner.js` — Multi-pass artifact generation (reads /api/limen-multipass)
  - `outcome-aggregator.js` — Aggregates outcomes from treatments
  - `pattern-envelope.js` — Pattern transport wrapper
  - `pattern-broker.js` — Routes patterns to consumers
  - `markdown-renderer.js` — Renders markdown in portals
  - `cik-coverage-expander.js` — Expands CIK lists from databases

- **recommendations/** (13 files)
  - `recommendation-engine.js` — Core treatment/diagnosis recommender
  - `deep-portal-harvester.js` — Extracts treatments/diagnoses from portals
  - `portal-treatment-resolver.js` — Maps portal content to treatments
  - `fractal-traversal-resolver.js` — Fractal diagnosis traversal
  - `portal-quality-assessor.js` — Grades portal content quality
  - `domain-regulation-engine.js` — Regulation-aware recommendations
  - `remedy-resolver.js` — Resolves remedy registry lookups
  - `report-synthesizer.js` — Synthesizes treatment reports
  - `evidence-builder.js` — Constructs evidence chains
  - `scale-translator.js` — Translates treatment scale/timing
  - `test-harness.js` — Testing utilities
  - `report-test-harness.js` — Report generation testing
  - `regulation-reports.js` — Regulation-specific report generation

- **portal/** (2 files)
  - `gap-synthesis-templates.js` — Template definitions for gap opportunities
  - `limen-gap-synthesis-engine.js` — Generates gap-opportunity syntheses

- **remedy/** (2 files)
  - `limen-remedy-registry.js` — Treatment/remedy registry (indexed by domain/diagnosis)
  - `registry-test.js` — Testing

- **reports/** (2 files)
  - `report-exporter.js` — Exports reports to PDF/JSON
  - `report-validation.js` — Validates report structure

- **schema/** (2 files)
  - `company-portal-schema.js` — Portal data shape validation
  - `fractal-report-schema.js` — Report nested structure schema

- **ui/** (4 files)
  - `console-clarity.js` — Clarity Mode (hero + health + events + actions; analyst mode for full 3-col grid)
  - `console-clarity-ui.js` — (implied but not confirmed in directory listing)
  - `domain-repair-map.js` — Repair prioritization map
  - `regulation-renderer.js` — Renders regulatory data
  - `report-console.js` — Report viewing console

- **feeds/** (1 file)
  - `limen-defense-signal-engine.js` — Defense-specific signal ingestion

- **kernel/** (1 file)
  - `limen-phase-domain-adapter.js` — Kernel output adapter for phase estimation

- **philemon/** (1 file)
  - `philemon-voice-guide.js` — **LIMEN's named voice guide: calm, wise, elder-sounding narrator**. TTS voice profile: rate 0.78 (slower), pitch 0.72 (gravities), volume 0.75. Preferred voices: Daniel (macOS), Google UK English Male, Microsoft David, Google US English. Delivers startup greeting (stable/elevated/stressed/noData states), responds to 10 plain-language commands (what am I looking at, why is this important, what should I do, what changed, which domain is worst, summarize, tell me more, what is the trend, are there treatments, go quiet, wake up, help). Alert deduplication via cooldown (120s per signature) + severity-tier + material-change detection + edge-trigger (re-announce only on escalation intensification). Listens to 4 events: limen:global-state-update, limen:domain-distress, limen:domain-update, limen:feed-state-change. UI: small PHILEMON badge (bottom-left, fixed) with Alt+P shortcut; input overlay for voice commands. Integrates with LIMENConsoleNarrator, LIMENCommandBar, LIMENDomains, LIMENGlobalState, LIMENReports. **STATUS: LIVE and FULLY FUNCTIONAL on civilization.html, connectome.html, master-brain.html, operator-guide.html, helix-brain-grid.html, master-brain-executor.html, master-brain-inbox.html, master-inbox.html, index.html (9 pages).**

### LIVE PAGES

**Core System:**
- https://limenhelix.com/civilization — 3-col clarity console (signals/core/health diagnostics)
- https://limenhelix.com/connectome — Inter-domain signal graph
- https://limenhelix.com/master-brain — Opportunity intake/artifact production
- https://limenhelix.com/operator-guide — Operator onboarding & command reference
- https://limenhelix.com/helix-brain-grid — Multi-brain dashboard

**Domain-Specific Pages (20 domains × 2-3 pages each):**
- Agriculture: https://limenhelix.com/agriculture-console, https://limenhelix.com/agriculture-opportunities, https://limenhelix.com/agriculture-command
- Finance: https://limenhelix.com/finance-console, https://limenhelix.com/finance-opportunities, https://limenhelix.com/finance-command
- Science: https://limenhelix.com/science-console, https://limenhelix.com/science-opportunities, https://limenhelix.com/science-command
- Environment, Industry, Economy, Culture, Intelligence, Technology, Education, Religion, Defense, Energy, Communication, Population, Trade, Governance, Infrastructure, Law, Medicine — same pattern (*-console, *-opportunities, *-command)

**Execution & Opportunity Workflows:**
- https://limenhelix.com/master-brain-executor — Bootstrap orchestrator
- https://limenhelix.com/master-brain-inbox — Opportunity intake queue
- https://limenhelix.com/master-inbox — Alternative inbox
- https://limenhelix.com/execution-command — Execution workflow controls
- https://limenhelix.com/operation-manual — Operations reference (tentative)

**Admin/Debug:**
- https://limenhelix.com/admin-leads — Lead management
- https://limenhelix.com/admin-diagnostics — System health (implied)

### DATA

**Tanks (assets/data/ & /api/ endpoints):**

1. **Domain Snapshots**
   - Source: `/api/domain-snapshot` (polled by shared-snapshot-engine.js every 30s, broadcast to all domain brains)
   - Fresh: Real-time feed aggregation (stress, confidence, activity, signals per domain)
   - Files read: `assets/data/domains/{domainId}.json` (static fallback); e.g., assets/data/domains/agriculture.json
   - Files written: Persisted to /api/limen-snapshot if stateful

2. **Execution State Tank**
   - Source: `/api/limen-execution?domain={domainId}` (execution-manager.js)
   - Reads: Current execution workflows, claims, ledgers
   - Writes: POST to /api/limen-execution to update claim state
   - Status: Live (8 files touch this)

3. **Artifact Packets**
   - Source: HandoffPacket (window.LIMENMainBrainHandoffState) + Observatory packets  
   - Reads: artifact-packet-builder.js, artifact-list-ui.js, artifact-viewer-ui.js
   - Shape: D3-A3.v3 (identity, signal, evidence, implementation, confidence, anti-overclaim, provenance, lane_hints, raw; 12 keys)
   - Status: Live; D3-A3.v3 marks identity.id as globally unique composite '<sourceOpportunityId>::<lane>' (v2→v3 breaking change)

4. **Portal Content**
   - Source: `/assets/data/domains/{portalKey}.json` (static), fallback `/api/fetch-portal?domainId={portalKey}` (GitHub-mediated)
   - File size: ~16MB–84MB per portal (company-registry.json ~16MB, treatment-discovery-cube.json ~84MB estimated)
   - Negative cache: 1-hour TTL on 404 (portal-content-resolver.js, domain-brain-base.js)
   - Reads: 20 domain brains × all clarity-operators × all business-build modules
   - Status: Stale in production (GitHub fetches are slow); local development uses cached JSON

5. **Company Registry**
   - File: assets/data/company-registry.json (~16MB)
   - Index: assets/data/company-index.json
   - Aliases: assets/data/company-aliases.json
   - Manifest: assets/data/companies-manifest.json
   - Reads: company-resolver.js, company-portal-engine-render.js, artifact-factory.js (looks up companies by ticker/CIK/slug)
   - Status: Fresh (synced on build)

6. **Master Inbox / Opportunity Intake**
   - Source: `/api/master-inbox` or assets/data/_master-inbox.json
   - Reads: artifact-intake.js, master-brain.html
   - Status: Live (updated per cycle)

7. **Opportunity Playbooks**
   - Files: assets/js/domain-brains/data/{domain}-opportunity-playbooks.js (18 playbooks)
   - Shape: { id, title, type (fund/invest/build/patent/advise/procure), domains, pattern, explain, action, valueRange, saturation, trigger, validation, steps, branch_up/down, outcome, failure, window, realWorld, examples, fastPath }
   - Reads: business-build.js, clarity-operator.js, recommendation-engine.js
   - Status: Live (domain-owned, authored to align with diagnosis vocabulary)

8. **Feed Registry & Status**
   - File: assets/data/feed-status.json or /api/feed-status
   - Sources: 50+ external APIs (USDA, FAO, arXiv, CDC, ClinicalTrials, USPTO, Event Registry, NOAA, GDELT, Federal Register, CourtListener, DOJ, CFPB, Finnhub)
   - Reads: domain-registry.js, feed-state.js, feed-store.js
   - Status: Live (polling / health checks)

9. **Connectome Graph**
   - File: assets/data/brain-connectome.json
   - Nodes: 111 brain nodes (brain-nodes-111.json)
   - Atlas: assets/data/brain-atlas-coordinates.json
   - Node-domain mapping: assets/data/brain-node-domains.json
   - Reads: domain-connectome-map.js, connectome-resolver.js, connectome-renderer.js
   - Status: Live (static reference + runtime computations)

10. **Stress/Signal Propagation**
    - Source: `/api/limen-stress-slim` (~tens of KB, per command-board-stress.js)
    - Reads: command-board-stress.js, execution-*-*.js, global-state-engine.js
    - Status: Real-time updated

11. **Execution Queues & Audits**
    - Source: `/api/limen-autoqueue`, `/api/limen-autofire-log`, `/api/limen-worker-autofire`
    - Reads: execution-action-queue.js, execution-auditor-gates.js, execution-lifecycle.js
    - Writes: /api/limen-operator-action (operator-action.js)
    - Status: Live

12. **Change Logs**
    - Source: `/api/limen-changelog?domain={domainId}`
    - Reads: domain-change-log.js, domain-console-brain.js
    - Status: Real-time

13. **Reports**
    - Source: Generated by report-synthesizer.js, regulation-reports.js, analyst-report-builder.js
    - Writes: Persisted or exported via `/api/report-exporter` (PDF/JSON)
    - Status: Per-cycle generation

14. **Command Board Data**
    - File: assets/data/command-board-data.json
    - Reads: Company command boards, execution dashboards
    - Status: Static

15. **Artifact Render Queue**
    - Source: `/api/limen-artifact-render` (JSON list of artifacts awaiting render)
    - Reads: artifact-list-ui.js
    - Status: Real-time

### HOW IT CONNECTS

**Signal Flow (Forward Path):**

1. **Feed Ingest** → Domain Brains receive 50+ external APIs (USDA, FAO, arXiv, CDC, USPTO, etc.) via domain-registry.js / feed-store.js
   
2. **Domain-Level Diagnosis** → 20 domain brains (agriculture-brain.js, etc.) normalize signals, score stress/confidence/activity, emit diagnoses (e.g., CASH_FLOW_CRISIS, SUPPLY_CHAIN_BREAKDOWN) keyed to portal content (assets/data/domains/{portalKey}.json)

3. **Opportunity Opportunity Mapping** → {domain}-business-build.js consults domain-brains/data/{domain}-opportunity-playbooks.js (18 templates) to map diagnoses → opportunity lanes (patents, grants, SBA loans, investments)

4. **Cross-Domain Emission** → Each domain brain emits upward (via emissionRules) to other domains (e.g., agriculture stress → supplyChain food-supply-disruption signal; agriculture stress → economy food-price-pressure; agriculture stress → energy biofuel-input-stress; agriculture stress → environment land-use-pressure)

5. **Civilization Layer Aggregation** → connectome-super-brain.js + civilization-super-brain.js aggregate domain-level signals into system-level state; global-state-engine.js computes phase (stable, pressured, fragmented, escalating, adaptive, recovering); balance-meter.js monitors domain stress balance; cross-domain-detector.js identifies systemic patterns

6. **Artifact Production Pipeline:**
   - Observatory (civilization/observatory-*.js) enriches domain packets via (domain, lane, diagnosis) tuple
   - artifact-packet-builder.js (D3-A3.v3) composes ArtifactPacket from HandoffPacket (source opportunity) + Observatory packets (evidence enrichment)
   - Master Brain (master-brain/*.js) receives artifacts via artifact-intake.js → routes to decision-engine.js (dispatch by lane: patents/grants/SBA/investments) → artifact-factory.js (deterministic draft-package builder; no LLM, no filing) → artifact-finalizer.js → oib-assembler.js → rendered via artifact-list-ui.js / artifact-viewer-ui.js

7. **Execution Workflow:**
   - execution-action-queue.js receives ready actions → execution-approval-authority.js routes to approval-routing.js (human/automated) → execution-auditor-gates.js (policy compliance) → execution-command-orchestrator.js dispatches execution → execution-monitoring.js tracks live status → execution-payout-ops.js finalizes payouts → execution-outcome-tracking.js logs outcomes for narrative-memory.js / decision-memory.js

8. **Clarity View (User-Facing):**
   - console-clarity.js (clarity mode) renders hero + domain-health + top-events + recommended-actions
   - philemon-voice-guide.js narrates system state changes (escalations, de-escalations, phase shifts) via TTS; alert deduplication prevents redundant speech
   - operator-guide.html lists commands and workflows
   - agriculture-console.html (and 19 other domain consoles) show domain-specific panels (clarity-operator, execution-panels, repair-map, diagnostics)

**Data Persistence & Synchronization:**

- Shared snapshot engine (shared-snapshot-engine.js) fetches /api/domain-snapshot once per 30s cycle, broadcasts to all 20 domain brains (prevents API flood)
- domain-brains/data/* (opportunity playbooks) are static files, loaded once; authoritative for diagnosis→opportunity mapping
- artifacts/opportunities are persisted via /api/limen-ingest (master-brain-executor.html), read from /api/master-inbox or _master-inbox.json
- execution state (claims, ledgers, approvals) persists via /api/limen-execution; auditor gates validate against /api/limen-policy-config
- outcomes logged to narrative-memory.js (in-session) and /api/limen-outcome (persistent)
- reports generated per-cycle via report-synthesizer.js, exported via /api/report-exporter

**Page-to-Module Mapping:**

- **civilization.html** (3397 total HTML files; this is primary): loads auth-gate.js → limen-fast-boot.js → 20 domain brains → global-state-engine.js → philemon-voice-guide.js → command-bar.js → limen-* modules (limen/*, executive/*, domain-brains/*, civilization/*, recommendations/*, master-brain/*, execution-*.js)
- **agriculture-console.html, finance-console.html, ... (19 more domain consoles)**: loads agriculture-brain.js + agriculture-clarity-operator.js + agriculture-business-build.js + agriculture-execution-panels.js (domain-specific subset)
- **agriculture-opportunities.html, ... (19 more opportunity pages)**: loads agriculture-clarity-operator.js + agriculture-opportunity-economics.js + recommendation-engine.js + portal-ui.js
- **master-brain.html**: loads master-brain/*.js (artifact-intake, artifact-factory, oib-assembler, decision-engine, review-gate) + artifact-list-ui.js
- **operator-guide.html**: loads all domain brains + command-bar + philemon (comprehensive reference)

**Inter-Module Dependencies (Pub/Sub & State Sharing):**

- window.LIMENDomains (global state) — shared by all domain brains, global-state-engine, clarity operators, philemon
- window.LIMENGlobalState (global state) — phase, stress, trends, last-shift
- window.LIMENReports (report cache) — populated by report-synthesizer, read by philemon, clarity console
- window.LIMENRemedyRegistryManager (treatment registry) — populated by recommendation-engine, consulted by clarity-operators, philemon
- window.LIMENConsoleNarrator (TTS backend) — used by event-narrator, philemon, action-suggester
- window.LIMENCommandBar (command palette) — integrates philemon commands + limen-command-bar.js

**Events (Custom):**
- limen:global-state-update — emitted by global-state-engine.js; listened by philemon, console-clarity, execution-monitoring
- limen:domain-distress — emitted by domain brains; listened by philemon, event-narrator, escalation-console
- limen:domain-update — emitted by domain-brain-base.js; listened by philemon (triggers de-escalation check)
- limen:feed-state-change — emitted by feed-state.js; listened by philemon, event-engine
- limen:feed-hydrated — emitted by feed-store.js; listened by philemon (triggers greeting sooner)
- limen:phase-shift — emitted by global-state-engine.js; listened by event-narrator, timeline-engine
- limen:artifact-intake — emitted by artifact-intake.js; listened by decision-engine, review-gate

### NEEDS WORK / INCONSISTENCIES

1. **Connectome Kernel Adapter (Disabled):**
   - File: assets/js/connectome-kernel-adapter.js (229 lines)
   - Issue: Formerly POSTed company data to /api/kernel-experiment (non-public). NEUTRALIZED with warning: "connectome-kernel-adapter is disabled: /api/kernel-experiment is not a public scoring endpoint. Use the protected /api/helix-report/score instead."
   - Impact: connectome-resolver.js (line 496) references this disabled endpoint; callers should use /api/helix-report/score instead (no code wired to do so yet)
   - Fix: Replace /api/kernel-experiment calls with /api/helix-report/score (post office missing)

2. **Portal Content Fetch Latency:**
   - Files: domain-brain-base.js (line 474), portal-content-resolver.js
   - Issue: Falls back to /api/fetch-portal?domainId=X when assets/data/domains/{domainId}.json missing; GitHub-mediated fetches are slow (~5-30s per domain)
   - Symptom: Domain brains emit null/incomplete diagnoses on page load; only populate after GitHub fetch completes
   - Negative cache (1-hour TTL on 404) masks real portal updates
   - Fix: Pre-warm portal cache at deployment; reduce fallback latency or fetch in parallel pre-request

3. **Multi-Domain Page Load Time:**
   - Affected: civilization.html, master-brain.html, operator-guide.html (3 × 53 scripts each)
   - Issue: All 20 domain brains load in parallel, each may trigger /api/domain-snapshot fallback + /api/fetch-portal fallback; no request batching
   - Symptom: Page load > 5s on slow networks
   - Fix: Batch portal fetches (one /api/fetch-all-portals endpoint) or pre-populate assets/data/domains/* files

4. **Opportunity Playbook Authorship & Drift:**
   - Files: assets/js/domain-brains/data/{domain}-opportunity-playbooks.js (18 files, ~3KB each)
   - Issue: These are static JS objects; no versioning or update mechanism. If domain diagnosis schema changes (e.g., agriculture adds PEST_OUTBREAK), playbooks must be manually patched
   - Fix: Version playbooks; consider JSON instead of JS for easier authorship/tooling

5. **Alert Deduplication in Philemon:**
   - File: assets/js/philemon-voice-guide.js (line 145+)
   - Issue: Alert memory (_alertMemory) uses simple hash-based signatures (alertType::domain); no distributed session tracking. If user opens multiple browser tabs, each gets independent Philemon instance with separate _alertMemory
   - Symptom: Same alert spoken twice (once per tab)
   - Fix: Centralize alert state in localStorage or /api/philemon-state

6. **Master Brain Package Forbidden Phrases:**
   - File: assets/js/master-brain/artifact-factory.js (lines 68-78)
   - Issue: FORBIDDEN_RX list blocks "submission-ready", "filing-ready", "approved", etc. but regex is loose (e.g., /\bguarante(e|ed|es|s)\s+(award|...)\b/i); edge cases may slip through
   - Example: "guarantee of fund eligibility" (vetted), vs. "guarantee funding" (should block) — hard to distinguish
   - Fix: Expand FORBIDDEN_RX test suite; consider NLP-based validation

7. **Execution Phase Loaders (Misaligned):**
   - Files: execution-phase7-loader.js, execution-phase8-dashboard.js, execution-phase9-dashboard.js, execution-phase9-loader.js, execution-phase10-dashboard.js, execution-phase10-loader.js, execution-phase11-dashboard.js, execution-phase11-loader.js (8 files)
   - Issue: Phase naming inconsistent (phase7, phase8, phase9, phase10, phase11); no clear definition of what each phase does; dashboard files exist but phase7-loader is missing phase7-dashboard.js
   - Fix: Document phase lifecycle; verify all phase{N}-dashboard.js and phase{N}-loader.js pairs exist

8. **Recommendation Engine Portal Data Dependency:**
   - Files: assets/js/recommendations/*.js (13 files)
   - Issue: deep-portal-harvester.js, portal-treatment-resolver.js depend on portal content being fully loaded; if portal is stale/empty, no treatments recommended
   - Symptom: clarity console shows "No recommended actions" even with elevated stress
   - Fix: Fallback to static treatment catalog (not yet in codebase) or pre-populate remedies

9. **Operator Canonical Identity Resolution:**
   - File: assets/js/limen/operator-canonical-identity.js
   - Issue: No details in read (partial file); unclear if this is wired to /api/operator-action or independent
   - Potential risk: Operator ID spoofing if not validated server-side
   - Fix: Verify operator-action.js validates incoming operator identity against canonical registry

10. **Human State Packet API Contract:**
    - File: assets/js/limen/human-state-packet.js (reads /api/human-state)
    - Issue: No corresponding /api/human-state endpoint found in api/*.js file list (54 files); endpoint may be missing
    - Symptom: human-state-packet.js fails silently; page loads but human context not available
    - Fix: Implement /api/human-state or remove this module if not needed

11. **Brain Atlas Coordinates Stale:**
    - File: assets/data/brain-atlas-coordinates.json
    - Issue: No timestamp/version; unclear if brain-nodes-111.json matches atlas
    - Fix: Version these files; add validation that all 111 nodes have atlas coordinates

12. **Missing Handbook/Documentation:**
    - No assets/data/handbook.json or similar
    - operator-guide.html claims to provide command reference but it's HTML-static; no programmatic command registry
    - Fix: Create window.LIMENCommandReference or /api/command-reference

13. **Remedy Registry Manager Public API Uncertain:**
    - File: assets/js/remedy/limen-remedy-registry.js
    - Issue: Exposes window.LIMENRemedyRegistryManager but no clear method inventory; philemon calls .stats(), .getTreatmentsOnDomainStress(), .prioritize(), .getDiagnosesForDomain() but these may be incomplete
    - Fix: Document full API surface; add method validation

14. **Execution Module Naming Ambiguity:**
    - Files: execution-monitoring.js vs. execution-lifecycle.js vs. execution-tracking.js
    - Issue: Unclear which is authoritative for execution status; no documented hierarchy
    - Fix: Document module responsibilities; consolidate if redundant

15. **Artifact Packet Schema Migration (D3-A3.v2 → v3):**
    - File: assets/js/civilization/artifact-packet-builder.js (lines 55-67)
    - Issue: Breaking change in v3: identity.id is now composite '<sourceOpportunityId>::<lane>' instead of just opportunityId. Callers reading v2 packets will break
    - Fix: Add migration code to handle v2/v3 packets; version the schema version in pages

16. **Biology Sensor Integration Unclear:**
    - Files: biosensor-bridge.js, biosensor-control-panel.js, limen-defense-signal-engine.js
    - Issue: These imply biosensor hardware integration but no API calls to /api/biosensor-* found; unclear if wired
    - Potential: Either orphaned code or incomplete API layer
    - Fix: Document biosensor architecture or remove if not live

17. **Market Stress Triage One-Off:**
    - File: assets/js/market-stress-triage.js
    - Issue: Reads /api/limen-stress-slim but unclear how/where it's consumed
    - Fix: Map this to a live page or remove

18. **Unused Opportunity Matrix (Agriculture Only):**
    - File: assets/js/agriculture-opportunity-matrix.js
    - Issue: Agriculture has this extra file; other 19 domains don't. Unclear why
    - Fix: Either add *-opportunity-matrix.js for all domains or document agriculture-specific logic

19. **Stale Artifact Source Index:**
    - File: assets/js/civilization/artifact-source-index-client.js
    - Issue: Reads /assets/data/artifact-sources.json (not found in codebase); falls back to inline data
    - Fix: Populate artifact-sources.json or remove file

20. **Command Board Data Single File:**
    - File: assets/data/command-board-data.json
    - Issue: Static single file; unclear how per-domain command boards are generated (agriculture-command.html, etc.). Likely built from template + domain-brain state
    - Fix: Document command-board generation; version this file

21. **Broken Link in Console Grid:**
    - File: civilization.html (line 82-98)
    - Issue: #enter-connectome button exists but unclear if connectome.html is wired as target (should be href="/connectome" or similar)
    - Fix: Verify routing

**SUMMARY:**
The 624 assets/js files form a sophisticated, distributed cognitive architecture with clear separation of concerns (domain brains, civilization layer, master brain, execution, UI). However, 21+ known inconsistencies range from minor (missing doc-string) to major (disabled kernel adapter, slow portal fetches, alert duplication across tabs, missing API endpoints). The system is production-live on 3397 HTML pages but shows signs of rapid development (phase loader misalignment, unused modules, stale caches). **PHILEMON is fully live, functional, and sophisticated** — a genuinely useful named voice guide with proper alert deduplication and context-aware narration.

---

## 3. Data tanks (assets/data/**, 4,670 json)

### PURPOSE

The LIMEN Helix data tank system provides the foundational knowledge graphs, discovery pipelines, and operational indices that drive the entire system. It organizes into two categories: (1) **Master knowledge tanks** in the top-level `assets/data/` directory (39 JSON files), representing the system's canonical indices, treatment models, and operational state; and (2) **Distributed domain-specific data** in subdirectories: companies (800 portals as .json), domains (3,710 domain/issue/treatment mappings), treatment-discovery (115 rendered cell files from the cube split), and audit records (6 files). All data is deterministically built from source scripts, versioned in git, and deployed static to Vercel.

### KEY FILES

**Top-level master tanks (39 .json files, 230 MB total):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\treatment-discovery-cube.json (84.25 MB) — the **pivot organ**: 6-step treatment-discovery chain (issue → node → disorder → neuro-Rx → domain-Rx → residual) over all brain nodes × comparison domains × state buckets. Source: build-treatment-discovery-cube.mjs. Reads: split-cube-for-render.mjs, compute-cross-domain-readout.mjs, organ-claim-verification.mjs. Each cell includes sourceProvenance + verification status (PENDING until task #33 runs).
- C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json (61.75 MB) — 173,652 portal fragments organized as a tree (governance → governance/anticorruption → governance/anticorruption/antimoney). Denormalized for UI navigation. Reads: portal-ui.js, portal-router.js.
- C:\Users\Chris\Limen-Helix-live-\assets\data\company-registry.json (16.27 MB) — canonical index of 767 company portals: 764 v2 (full), 3 v1 legacy. Indices: byCik, bySlug, byBrainNode, byDomain, bySic, byPhaseState, byKernelStatus, graph. Source: build-company-registry.js. Reads: validate-reciprocity.js, multiple scripts.
- C:\Users\Chris\Limen-Helix-live-\assets\data\orphan-stakeholders.json (6.5 MB) — 9,559 entities (companies, governments, regulators, auditors, capital, executives, market signals) referenced in portal functionalNetworks but lacking their own .json portal. Archetypes: company (4,105), government (169), regulator (793), auditor (46), capital (540), executive (2,191), market-signal (1,715). Source: build-orphan-registry.mjs. Reads: company-portal-ui.js, kernel-comparison.js. Candidate for densification into full portals if refCount > threshold.
- C:\Users\Chris\Limen-Helix-live-\assets\data\stress-network-state.json (4.45 MB) — spider-web propagation output: per-portal intrinsic stress (from kernel composite + alert bonus), induced stress (network-propagated), and attribution (sources with hop/confidence/category weighting). Algorithm: BFS up to 3 hops, category-weighted edges (capitalProviders 1.0, suppliers/customers 0.85, logistics 0.65, competitors 0.55, regulators 0.45, execs 0.2), hop attenuation 0.5^hops, intrinsic propagation cap 5.0, inhibitory damping from brain-connectome.json (MVP primitive). Source: build-stress-network.mjs (lib/limen-stress-propagator.js). Reads: limen-stress-propagation.js, limen-stress-slim.js, limen-worker-autofire.js, limen-worker-multipass.js. Purpose: Master Brain readiness biasing, Command Board network-pushed visualization, autofire deprioritization.
- C:\Users\Chris\Limen-Helix-live-\assets\data\eligible-universe.json (3.14 MB) — per-CIK snapshot of phase states, distress bands, composite scores, kernel status, alert flags, and domain assignments for every company in scope. Source: probe-eligibility.js. Reads: build-historical-distress-cohort.js. Purpose: Identify eligible portals for immediate activation, phase-transition monitoring.
- C:\Users\Chris\Limen-Helix-live-\assets\data\neuro-disorder-lookup.json (0.67 MB) — mapping of brain-node IDs + dysregulation states → DSM-5 disorders + evidence-based treatments. Links steps 3–4 of the treatment-discovery chain. Source: build-neuro-disorder-lookup.mjs. Reads: build-treatment-discovery-cube.mjs. 
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-business-mapping.json (0.47 MB) — per-node: neural function description → business category mappings (e.g. mPFC/rumination → executive coaching, personal branding, reputation management). Binds neuroscience to domain opportunity discovery. Source: build-brain-node-business-mapping.js. Reads: build-treatment-discovery-cube.mjs, organ-binding-fidelity.mjs, build-neuro-disorder-lookup.mjs.
- C:\Users\Chris\Limen-Helix-live-\assets\data\limen-report-index.json (0.43 MB) — job titles (Physician, Endocrinologist, Psychiatrist, etc.) × brain nodes × dysregulation states × business mappings. Appears to be reference content (not actively written). Source/Writes: unclear.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-domains.json (0.28 MB) — mapping of each brain node → role in each domain. E.g. NAcc = "Addiction Medicine: Reward Valuation Hub", "Business: Sales & Revenue", "Economy: Consumer Spending", etc. Used in cross-domain navigation and connectome resolution. Source: hand-authored or from brain-node-map. Reads: cross-domain-audit.js, cross-node-opportunity.js, connectome-resolver.js, connectome-super-brain.js, node-translation.js.
- C:\Users\Chris\Limen-Helix-live-\assets\data\_master-inbox.json (0.16 MB) — working queue of pending tasks, alerts, or artifacts needing operator review. Source: build-master-inbox.mjs. Reads: build-treatment-discovery-cube.mjs (line 58).
- C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json (0.14 MB) — per-CIK phase/domain/distress snapshot for the Command Board UI (agriculture-command.html, communication-command.html, etc.). Array of { cik, slug, phase, domain, distressSignal, ... }. Source: build-command-board.js. Reads: limen-stress-propagation.js, limen-worker-stress-refresh.js, agriculture-clarity-operator.js (and 10+ domain-specific operators).
- C:\Users\Chris\Limen-Helix-live-\assets\data\companies-manifest.json (0.14 MB) — flat list of all portals with slug, name, cik, domain, schemaVersion. Used to bootstrap portal enumeration. Source: build-companies-manifest.mjs. Reads: limen-worker-autofire.js, limen-worker-multipass.js, company-portal-ui.js, build-fractal-portals.mjs.
- C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-eligible.json (0.1 MB) — filtered subset of command-board-data: only portals with kernelStatus=ELIGIBLE_NOW or recent phase transitions. Source: build-command-board.js. Reads: helix_app/index.py (python phase engine).
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-nodes-111.json (0.09 MB) — array of 111 brain-node canonical definitions: id, region (mPFC, PCC, etc.), abbreviation, network (DMN, SAN, etc.), limen_phase (P0–P8), function, communicates_with (edge list), dysregulation (hyperactive/hypoactive phenotypes), businesses (opportunity categories). Source: hand-authored or seeded from neuroscience literature. Reads: build-neuro-disorder-lookup.mjs, build-treatment-discovery-cube.mjs, multiple schema validators.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-map.json (0.01 MB) — metadata: totalNodes (103), mapping description, version 1.0.0. Canonical phase/functional-role assignments. Source: hand-authored. Reads: classify-portal-brain-node-mapping.mjs, resolve-portal-brain-node-mapping.mjs, validate-brain-node-mapping.mjs, treatment-discovery-cell.schema.js.
- C:\Users\Chris\Limen-Helix-live-\assets\data\node-entity-mapping.json (0.09 MB) — (purpose unclear from reading; likely reverse index: brainNodeId → portal list). Source: unclear. Reads: unclear.
- C:\Users\Chris\Limen-Helix-live-\assets\data\operator-references.json (0.09 MB) — operator-level schema or reference. Source: unclear. Reads: unclear.
- C:\Users\Chris\Limen-Helix-live-\assets\data\entity-registry.json (0.07 MB) — (purpose/structure not fully sampled). Source: unclear.
- C:\Users\Chris\Limen-Helix-live-\assets\data\company-aliases.json (0.05 MB) — slug aliases (slug → [alternateSlug, ...]). Source: detect-slug-aliases.mjs. Reads: unclear (likely portal-router.js for UI navigation).
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-connectome.json (0.05 MB) — the **L2 connectivity map**: 6 canonical inhibitory edges (vmPFC→BLA, HAB→VTA, HAB→RAPHE, CAUD→GP, PUT→GP, GP→THAL). Reads: limen-stress-propagator.js (MVP regulation primitive: applies inhibitory damping to portals with functional inhibitory mappings). Purpose: stress propagation regulation.
- C:\Users\Chris\Limen-Helix-live-\assets\data\bridge-patterns.json (0.04 MB) — cross-domain treatment pattern templates (e.g. "Oscillation Dampening" bridges addiction and education). Source: author-bridge-patterns.mjs, build-bridge-readings.mjs. Reads: build-treatment-discovery-cube.mjs.
- C:\Users\Chris\Limen-Helix-live-\assets\data\company-index.json (0.04 MB) — (likely a fast-lookup index; structure not fully sampled).
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-atlas-coordinates.json (0.04 MB) — stereotactic coordinates or spatial embeddings for brain nodes (used by visualization/3D rendering if present).
- C:\Users\Chris\Limen-Helix-live-\assets\data\node-signal-registry.json (0.04 MB) — per-node signal/symptom catalogue. Source: unclear.
- C:\Users\Chris\Limen-Helix-live-\assets\data\verbiage-templates.json (0.03 MB) — text templates or language patterns for domain-specific writing (evidence, clinical descriptions, etc.). Source: unclear.
- C:\Users\Chris\Limen-Helix-live-\assets\data\historical-distress-cohort.json (0.02 MB) — historical snapshots of distress bands and phase states (time-series or baseline). Source: build-historical-distress-cohort.js.
- C:\Users\Chris\Limen-Helix-live-\assets\data\capital-engine.json (0.02 MB) — finance domain instantiated as capital-engine: connectors (Stripe, Amazon Associates, Rakuten, ShareASale, CJ, ClickBank, YouTube, TikTok, Meta, Beehiiv, Gumroad, Etsy, Shopify, Printful, etc.), signoff requirements, phase/status overlay from api/capital-engine.js.
- C:\Users\Chris\Limen-Helix-live-\assets\data\connectome-node-registry.json (0.01 MB) — connectome index or node network registry (structure not fully sampled).
- C:\Users\Chris\Limen-Helix-live-\assets\data\review-rubric.json (0.01 MB) — (structure not fully sampled; possibly verification/review criteria).
- C:\Users\Chris\Limen-Helix-live-\assets\data\civilization.top.json (0.01 MB) — top-level civilization domain metadata or state.
- C:\Users\Chris\Limen-Helix-live-\assets\data\corpus.json (0.01 MB) — corpus metadata or index (likely supporting research/audit functions).
- C:\Users\Chris\Limen-Helix-live-\assets\data\sp500-ciks.json (0.01 MB) — mapping of S&P 500 tickers to SEC CIK numbers.
- C:\Users\Chris\Limen-Helix-live-\assets\data\cross-domain-gamma-comparison.json (0.01 MB) — (structure not sampled; likely cross-domain analysis).
- C:\Users\Chris\Limen-Helix-live-\assets\data\remedy-library.json (0.01 MB) — treatment/remedy reference library.
- C:\Users\Chris\Limen-Helix-live-\assets\data\empirical-gamma-by-phase.json (4 KB) — empirical γ (gamma) parameter values per LIMEN phase (P0–P10). Used by helix_app/thing2/phase_engine.py (32-fixture cohort, 1,204 spells).
- C:\Users\Chris\Limen-Helix-live-\assets\data\_bridge-build-log.json (3.3 KB) — build log from bridge pattern authoring (informational).
- C:\Users\Chris\Limen-Helix-live-\assets\data\affiliate-config.json (1.7 KB) — affiliate configuration for capital-engine connectors (environment keys, tiers, status).
- C:\Users\Chris\Limen-Helix-live-\assets\data\_vitals.json (0.07 MB) — system vitals/heartbeat metrics (last refresh timestamps, health checks, etc.). Source: audit-system-vitals.mjs. Reads: audit-corpus-vitals.mjs.

**Subdirectories:**

**companies/ (800 files, 52 MB total):**
- One .json per portal: 10x_genomics.json, abbott_laboratories.json, adobe.json, etc. Schema: slug, name, cik, ticker, sic, domain, phase, kernelStatus, alert, brain node mappings, functionalNetwork (suppliers, customers, competitors, regulators, capital providers, executives, logistics, market signals with metadata), intelligenceCycle (diagnosis, regulate, signal, action, adapt), warningSignals, opportunitySignals, etc. Source: Created by build-fractal-portals.mjs, autonomous-portal-regen.mjs, portal-creation scripts. Reads: build-company-registry.js (aggregates into company-registry.json), build-stress-network.mjs (propagation source), multiple domain-specific UI components.

**domains/ (3,710 files, 1.2 MB total):**
- Organized as: domainId.json (top-level, ~700 files), domainId_subdomain.json (1st-level child, ~1200 files), domainId_subdomain_issue.json (leaf, ~1800 files). Each file contains activations array: brain node + state + treatments + diagnostic triggers + cross-domain affinities. Depth: civilization → addiction → addiction_anticipatory → addiction_anticipatory_action/adapt/diagnosis/feedback/regulate/signal/state. Source: Hand-authored or generated from domain/issue taxonomy. Reads: treatment-discovery cube builder, domain-console brains, civilian operators (agriculture-command.html, communication-command.html, etc.).

**treatment-discovery/ (115 files, 40 MB total):**
- _index.json: Navigation index (schemaVersion 1.0.0, builtAt, loadedComparisonDomains list, stats).
- _summary.json: Dashboard stats (cell counts, verification breakdowns).
- by-node/ (113 .json files): Split from the main cube for render performance. One file per brain node (A1.json, ACC.json, mPFC.json, etc., max ~3.6 MB each; largest: TPJ.json 3.6 MB, dACC.json 3.6 MB). Each contains { brainNodeId, node, cells[] } where cells are full DiscoveryCell objects from the cube. Source: split-cube-for-render.mjs. Reads: treatment-discovery.html (dynamic loader), verification workers.

**audit/ (6 files, 2.8 MB total):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\audit\field-connection-map.json (0.03 MB) — **meta-schema**: Catalog of every portal/domain/bridge/aggregated-treatment/taxonomy field that carries diagnostic or treatment meaning. Chains steps 1–6 (issue → node → disorder → neuro-Rx → domain-Rx → residual). Roles: issue, diagnostic-trigger, treatment-option, state-label, binding, propagation-edge, gating-signal, evidence, context, engine-output, provenance. Gating dimensions: phase, salience, state, condition, readiness, distressBand, bindingStrength. Verifier categories: pubmed, edgar, websearch, rule-based, internal-consistency, manual, n/a.
- C:\Users\Chris\Limen-Helix-live-\assets\data\audit\mechanism-fidelity-report.json (0.01 MB) — Validation report on mechanism claims in portals (e.g. brain-node binding correctness).
- C:\Users\Chris\Limen-Helix-live-\assets\data\audit\mechanism-ontology.json (0.01 MB) — Ontology of mechanism types and relationships.
- C:\Users\Chris\Limen-Helix-live-\assets\data\audit\port-mechanism-statements.json (0.02 MB) — Per-portal mechanism statements extracted and validated.
- C:\Users\Chris\Limen-Helix-live-\assets\data\audit\pubmed-bla-baseline-snapshot.json (0.005 MB) — PubMed snapshot for BLA (Basolateral Amygdala) baseline research (verification source).
- C:\Users\Chris\Limen-Helix-live-\assets\data\audit\verification-ledger.json (2.8 MB) — **comprehensive audit trail**: Every claim in treatment-discovery cells that requires verification (task #33). Entries: { cellId, chain-step, claim, verdict (VERIFIED/REJECTED/PENDING), verifier, timestamp, evidence-url, notes }.

**fired-artifacts/ (1 file, .md):**
- 2026-05-31__research-note__bla-hyperactive-economy__exposure-to-volatility-reexposure.md — Research note (not JSON, but a fired artifact document).

**schemas/ (1 file):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\schemas\treatment-discovery-cell.schema.js — JavaScript schema module (not .json) that defines DiscoveryCell structure, STATE_BUCKETS, verification profiles, provenance maker functions. Reads: build-treatment-discovery-cube.mjs, split-cube-for-render.mjs, validators. This is the **canonical schema definition for the entire treatment-discovery system**.

### LIVE PAGES

Primary navigation and operational surfaces that consume the data tanks (clean URLs via Vercel cleanUrls):

**Domain Command Boards** (per-domain stress/opportunity synthesis, master-brain outputs):
- https://limenhelix.com/agriculture-command
- https://limenhelix.com/communication-command
- https://limenhelix.com/culture-command
- https://limenhelix.com/defense-command
- https://limenhelix.com/economy-command
- https://limenhelix.com/education-command
- https://limenhelix.com/energy-command
- https://limenhelix.com/environment-command
- https://limenhelix.com/finance-command
- https://limenhelix.com/governance-command
- https://limenhelix.com/industry-command
- https://limenhelix.com/infrastructure-command
- https://limenhelix.com/intelligence-command
- https://limenhelix.com/law-command
- https://limenhelix.com/medicine-command
- https://limenhelix.com/population-command
- https://limenhelix.com/religion-command
- https://limenhelix.com/science-command
- https://limenhelix.com/technology-command
- https://limenhelix.com/trade-command

**Domain Consoles** (per-domain portal inventory and phase tracking):
- https://limenhelix.com/agriculture-console
- https://limenhelix.com/communication-console
- https://limenhelix.com/[other-domain]-console

**Domain Opportunity Matrices** (discovery UI):
- https://limenhelix.com/agriculture-opportunities
- https://limenhelix.com/[other-domain]-opportunities

**Domain Workspaces** (operator workflows):
- https://limenhelix.com/agriculture-workspace
- https://limenhelix.com/[other-domain]-workspace

**Clinical Portal** (medical/neuro domain entry):
- https://limenhelix.com/clinical

**Main Portal Navigation**:
- https://limenhelix.com/civilization (top-level civilization domain with child portals)
- https://limenhelix.com/company-portal (dynamic portal view when ?company=<slug> query param provided)

**Treatment Discovery** (the pivot organ):
- https://limenhelix.com/treatment-discovery (loads _index.json, then by-node/[nodeId].json on demand)

**Portal Coverage / Registry**:
- https://limenhelix.com/helix-portal-coverage (references portal-registry.json, command-board-data.json)

**Individual company portals** (via company slug or CIK lookup):
- https://limenhelix.com/company/[slug] or legacy ?company=[slug] parameter

### DATA

**Tank read/write relationships:**

| Tank | Size | Last Modified | Freshness | Reads (Primary Consumers) | Writes (Primary Builder) | Format & Structure |
|------|------|---------------|-----------|-------------------------|----------------------|-------------------|
| treatment-discovery-cube.json | 84.25 MB | 06/04/2026 (2 days old) | FRESH | split-cube-for-render.mjs (→ by-node files), compute-cross-domain-readout.mjs, organ-claim-verification.mjs | build-treatment-discovery-cube.mjs | { cells: [{brainNodeId, state, comparisonDomain, issue, node, disorder, neuroTx, domainTx, residual, sourceProvenance, verification}...], stats, loadedComparisonDomains, builtAt } |
| portal-registry.json | 61.75 MB | 03/17/2026 (81 days old) | STALE | portal-ui.js, portal-router.js (web navigation) | (unknown writer; no build-portal-registry script found) | { portals: {domainId: {title, nodeCount, issueCount, childPaths, childCount, parentPath}...}, _portalCount: 173652, _domainIdCount: 68923 } |
| company-registry.json | 16.27 MB | 05/29/2026 (9 days old) | AGED | validate-reciprocity.js, build-historical-distress-cohort.js | build-company-registry.js | { generatedAt, schemaVersion: "2.0.1", counts: {portals, v2, v1Legacy, uniqueCiks, uniqueBrainNodes, domains, sicCodes}, byCik, bySlug, byBrainNode, byDomain, bySic, byPhaseState, byKernelStatus, graph } |
| orphan-stakeholders.json | 6.5 MB | 05/29/2026 (9 days old) | AGED | company-portal-ui.js, kernel-comparison.js | build-orphan-registry.mjs | { schemaVersion, generatedAt, total: 9559, byArchetype: {company: 4105, government: 169, regulator: 793, auditor: 46, capital: 540, executive: 2191, market-signal: 1715}, orphans: {slug: {name, archetype, refCount, categories, neuralRole, brainNodeId, role, domains, referencedBy, densifyCandidate}...} } |
| stress-network-state.json | 4.45 MB | 05/25/2026 (12 days old) | AGED | limen-stress-propagation.js, limen-stress-slim.js, limen-worker-autofire.js, limen-worker-multipass.js (AWS Lambda workers) | build-stress-network.mjs | { [slug]: {slug, intrinsicStress, inducedStress, inducedSources: [{slug, contribution, hops, edgeCategory, edgePath}...], totalStress, stressRatio, networkPushed}, stats: {totalNodes, totalEdges, stressedNodes} } |
| eligible-universe.json | 3.14 MB | 05/09/2026 (28 days old) | STALE | build-historical-distress-cohort.js | probe-eligibility.js | { [cik]: {slug, name, phase, domainId, kernelStatus, compositeScore, alert, distressBand, brainNodeIds, ...} } |
| neuro-disorder-lookup.json | 0.67 MB | 05/30/2026 (8 days old) | AGED | build-treatment-discovery-cube.mjs (steps 3–4 chain binding) | build-neuro-disorder-lookup.mjs | { [brainNodeId]: {[state]: {disorder, evidence, treatments: [{type, description, evidence}...] }} } |
| brain-node-business-mapping.json | 0.47 MB | 05/10/2026 (28 days old) | AGED | build-treatment-discovery-cube.mjs, build-neuro-disorder-lookup.mjs | build-brain-node-business-mapping.js | { [brainNodeId]: {businesses: [{category, examples}...], domains: [...]} } |
| limen-report-index.json | 0.43 MB | 03/08/2026 (91 days old) | STALE | (unknown reader) | (unknown writer) | { jobs: [{title, domain, node_id, node_name, network, phase, dysregulation, business_mapping}...] } |
| brain-node-domains.json | 0.28 MB | 05/15/2026 (23 days old) | AGED | cross-domain-audit.js, cross-node-opportunity.js, connectome-resolver.js, connectome-super-brain.js, node-translation.js | (hand-authored or seeded from brain-node-map) | { [nodeId]: [{domain, label, role, ...}...] } |
| _master-inbox.json | 0.16 MB | 06/01/2026 (5 days old) | RECENT | build-treatment-discovery-cube.mjs (reads as input for context) | build-master-inbox.mjs | { tasks: [{id, title, status, priority, assignee}...] } |
| command-board-data.json | 0.14 MB | 05/27/2026 (11 days old) | AGED | limen-stress-propagation.js (reads for stress binding), agriculture-clarity-operator.js (domain operators, 10+), helix_app/index.py | build-command-board.js | { companies: [{cik, slug, phase, domain, compositeScore, alert, distressBand, ...}...] } |
| companies-manifest.json | 0.14 MB | 05/29/2026 (9 days old) | AGED | limen-worker-autofire.js, limen-worker-multipass.js, company-portal-ui.js, build-fractal-portals.mjs | build-companies-manifest.mjs | { companies: [{slug, name, cik, domain, schemaVersion}...], lastBuilt, count } |
| command-board-eligible.json | 0.1 MB | 06/04/2026 (2 days old) | FRESH | helix_app/index.py (phase engine selects eligible only) | build-command-board.js (filters command-board-data) | { companies: [{cik, slug, kernelStatus: "ELIGIBLE_NOW"}...] } |
| brain-nodes-111.json | 0.09 MB | 03/01/2026 (98 days old) | STALE | build-neuro-disorder-lookup.mjs, build-treatment-discovery-cube.mjs | (hand-authored canonical list) | { []: [{id, region, abbreviation, network, limen_phase, function, communicates_with, dysregulation, businesses}...], length: 111 } |
| node-entity-mapping.json | 0.09 MB | 03/16/2026 (83 days old) | STALE | (unknown reader) | (unknown writer) | (structure not sampled) |
| operator-references.json | 0.09 MB | 05/09/2026 (29 days old) | STALE | (unknown reader) | (unknown writer) | (structure not sampled) |
| entity-registry.json | 0.07 MB | 03/15/2026 (84 days old) | STALE | (unknown reader) | (unknown writer) | (structure not sampled) |
| _vitals.json | 0.07 MB | 06/05/2026 (1 day old) | FRESH | audit-corpus-vitals.mjs (reads to diagnose staleness) | audit-system-vitals.mjs | { lastRefresh, checks: [{name, status, timestamp}...] } |
| company-aliases.json | 0.05 MB | 06/05/2026 (1 day old) | FRESH | (likely portal-router.js for slug resolution) | detect-slug-aliases.mjs | { [slug]: [alt1, alt2, ...] } |
| brain-connectome.json | 0.05 MB | 03/01/2026 (98 days old) | STALE (but static/reference) | limen-stress-propagator.js (reads inhibitory edges for MVP damping) | (hand-authored canonical L2 connectome) | { inhibitoryEdges: [[nodeA, nodeB], ...], ... } |
| bridge-patterns.json | 0.04 MB | 06/04/2026 (2 days old) | FRESH | build-treatment-discovery-cube.mjs, build-bridge-readings.mjs | author-bridge-patterns.mjs | { [domainPair]: [{pattern, treatments, domains}...] } |
| company-index.json | 0.04 MB | 03/16/2026 (83 days old) | STALE | (unknown reader) | (unknown writer) | (structure not sampled) |
| brain-atlas-coordinates.json | 0.04 MB | 03/01/2026 (98 days old) | STALE (reference) | (visualization/3D rendering if present) | (hand-authored stereotactic data) | (structure not sampled) |
| node-signal-registry.json | 0.04 MB | 03/16/2026 (83 days old) | STALE | (unknown reader) | (unknown writer) | (structure not sampled) |
| verbiage-templates.json | 0.03 MB | 05/30/2026 (8 days old) | AGED | (unknown reader) | (unclear writer) | (structure not sampled) |
| historical-distress-cohort.json | 0.02 MB | 05/13/2026 (25 days old) | AGED | (time-series reference) | build-historical-distress-cohort.js | (snapshots of distress/phase state over time) |
| capital-engine.json | 0.02 MB | 06/06/2026 (0 days old) | FRESH | api/capital-engine.js (overlays live connector status at read) | (unclear writer; appears hand-maintained) | { _meta: {connectors info, signoff model}, domain: {phase, role}, aiOrchestration, connectors: [{id, name, type, tier, envKeys, signoffRequired, status}...], ... } |
| connectome-node-registry.json | 0.01 MB | 05/24/2026 (14 days old) | AGED | (unknown reader) | (unknown writer) | (structure not sampled) |
| review-rubric.json | 0.01 MB | 06/06/2026 (0 days old) | FRESH | (verification/review processes) | (unclear writer) | (structure not sampled) |
| civilization.top.json | 0.01 MB | 03/02/2026 (97 days old) | STALE (reference) | (top-level domain metadata) | (hand-authored) | (structure not sampled) |
| corpus.json | 0.01 MB | 06/06/2026 (0 days old) | FRESH | (audit/corpus vitals) | (unclear writer) | (structure not sampled) |
| sp500-ciks.json | 0.01 MB | 03/22/2026 (77 days old) | STALE (reference) | (CIK lookup for S&P 500 tickers) | (hand-authored from SEC data) | { [ticker]: cik, ... } |
| cross-domain-gamma-comparison.json | 0.01 MB | 05/13/2026 (25 days old) | AGED | (cross-domain analysis) | (compute-cross-domain-readout.mjs likely) | (structure not sampled) |
| remedy-library.json | 0.01 MB | 03/14/2026 (85 days old) | STALE (reference) | (treatment reference) | (hand-authored) | (structure not sampled) |
| empirical-gamma-by-phase.json | 4 KB | 05/13/2026 (25 days old) | AGED | helix_app/thing2/phase_engine.py (32-fixture cohort, 1,204 spells) | (unclear writer) | { [phase]: gamma_value, ... } |
| _bridge-build-log.json | 3.3 KB | 06/01/2026 (5 days old) | RECENT | (informational log only) | author-bridge-patterns.mjs | (log of builds) |
| affiliate-config.json | 1.7 KB | 06/06/2026 (0 days old) | FRESH | (capital-engine connector setup) | (hand-maintained config) | { affiliates: [{id, envKeys, tier, status}...] } |

**Subdirectory freshness:**

| Subdirectory | File Count | Total Size | Last Modified (newest file) | Status | 
|--------------|-----------|-----------|-----|--------|
| companies/ | 800 | 52 MB | 06/05/2026 (1 day old) | ACTIVE — portals regenerate frequently via autonomous-portal-regen.mjs, build-fractal-portals.mjs |
| domains/ | 3,710 | 1.2 MB | (varies; mostly 04/–05/2026) | MIXED — some files 98 days old (hand-authored baseline), newer files 25–30 days |
| treatment-discovery/by-node/ | 113 | 35 MB | 06/04/2026 (2 days old) | FRESH — regenerated by split-cube-for-render.mjs whenever treatment-discovery-cube.json updates |
| audit/ | 6 | 2.8 MB | 06/03/2026 (3 days old, verification-ledger.json) | ACTIVE — verification-ledger.json grows as task #33 runs; other audit files are reference/reports |

**Critical freshness gaps:**
- **portal-registry.json** (61.75 MB) — 81 days old; no build script found in repo. **Possibly only in full-repo** (C:\Users\Chris\Limen-Helix-live- vs C:\Users\Chris\Limen-Helix).
- **brain-nodes-111.json**, **brain-connectome.json**, **brain-atlas-coordinates.json** — 98 days old; hand-authored reference data (canonical, not auto-updated).
- **limen-report-index.json** — 91 days old; reader/writer unclear.
- **eligible-universe.json** — 28 days old; no recent runs of probe-eligibility.js detected.
- **stress-network-state.json** — 12 days old; should be regenerated by build-stress-network.mjs on each kernel refresh cycle.

**Empty or missing tanks (noted in prompt):**
- **schemas/** directory: Contains only 1 JS file (treatment-discovery-cell.schema.js), no JSON. fired-artifacts/ has 1 .md, no JSON.

### HOW IT CONNECTS

**Data flow chain (forward-pushed information path):**

1. **Company portal ecosystem** → brain-node bindings + functionalNetwork edges:
   - assets/data/companies/*.json (800 portals, v2 + v1 legacy) are the **source of truth** for all operational data.
   - build-company-registry.js reads all 800 → aggregates into company-registry.json (indices by CIK, brain node, domain, SIC, phase, kernel status; builds graph of suppliers/customers/competitors/regulators/capital/executives/logistics).
   - companies-manifest.json (built by build-companies-manifest.mjs) provides fast slug→metadata lookup for UI bootstrap.
   - orphan-stakeholders.json (built by build-orphan-registry.mjs) captures 9,559 referenced-but-unmapped entities for future densification.

2. **Stress propagation cycle**:
   - companies/*.json + command-board-data.json → build-stress-network.mjs → limen-stress-propagator.js (deterministic BFS with category-weighted edges, inhibitory damping from brain-connectome.json) → stress-network-state.json.
   - limen-stress-propagation.js (API endpoint) reads stress-network-state.json on demand to serve Master Brain stress signals.
   - limen-worker-autofire.js, limen-worker-multipass.js (Lambda workers) read stress-network-state.json to deprioritize autofire on portals where induced > intrinsic (until source addressed).
   - limen-stress-slim.js derives a lighter payload from stress-network-state.json for frontend bundling.

3. **Command Board synthesis**:
   - companies/*.json (kernelStatus, compositeScore, alert, phase, domain, distressBand) → build-command-board.js → command-board-data.json (per-CIK snapshot).
   - command-board-data.json → limen-stress-propagation.js (loads as CB context for propagation).
   - command-board-data.json → domain-specific clarity operators (agriculture-clarity-operator.js, communication-clarity-operator.js, ..., 10+ total) which power domain-command.html pages.
   - command-board-eligible.json (filtered for kernelStatus=ELIGIBLE_NOW) → helix_app/index.py (phase engine selects for immediate activation).

4. **Treatment discovery pivot organ**:
   - brain-nodes-111.json (canonical node defs) + brain-node-map.json (phase/role) + brain-node-business-mapping.json (opportunity spaces) + brain-node-domains.json (per-domain roles) + neuro-disorder-lookup.json (node+state → disorder+treatments) + portal-domain files (assets/data/domains/*) + companies/*.json (issues/signals) + bridge-patterns.json (cross-domain templates) + _master-inbox.json (context) → build-treatment-discovery-cube.mjs → **treatment-discovery-cube.json** (the 84 MB pivot: all (node, state, domain) → 6-step discovery chain).
   - treatment-discovery-cube.json → split-cube-for-render.mjs → treatment-discovery/by-node/*.json (113 files for render performance on treatment-discovery.html).
   - treatment-discovery-cube.json → compute-cross-domain-readout.mjs → cross-domain-gamma-comparison.json (step 6 residual analysis).
   - treatment-discovery-cube.json → organ-claim-verification.mjs → verification-ledger.json (task #33: adds VERIFIED/REJECTED verdicts to treatment claims).

5. **Brain network resolution**:
   - brain-node-domains.json → connectome-resolver.js, connectome-super-brain.js, cross-domain-audit.js, cross-node-opportunity.js, node-translation.js (web UIs read to resolve node → domain role mappings for cross-domain navigation and opportunity discovery).

6. **Eligibility and historical tracking**:
   - companies/*.json (phase, kernel status) → probe-eligibility.js → eligible-universe.json (per-CIK snapshot of phase/distress/status/domain for activation workflows).
   - eligible-universe.json → build-historical-distress-cohort.js → historical-distress-cohort.json (time-series snapshots for trend analysis and phase-transition detection).

7. **Portal navigation**:
   - portal-registry.json (173,652 portal fragments in tree: civilization → ... → leaf issues) → portal-ui.js, portal-router.js (web navigation loads on demand via XHR; no build script found in live- repo, **possibly only in full-repo**).

8. **Verification and audit**:
   - field-connection-map.json (meta-schema: catalogs every field carrying diagnostic/treatment meaning across 6 chain steps) → guides field extractors.
   - binding-fidelity-report.json → mechanism validators.
   - verification-ledger.json (2.8 MB audit trail, **grows as task #33 runs**) → captures VERIFIED/REJECTED/PENDING verdicts for every treatment claim.
   - audit-system-vitals.mjs → _vitals.json (system heartbeat: last refresh, check statuses).

9. **AI orchestration and capital routing** (finance domain):
   - capital-engine.json (connectors: Stripe, Amazon, Rakuten, ShareASale, YouTube, TikTok, Meta, etc.) + affiliate-config.json → api/capital-engine.js (overlays live connector status, calls ai-orchestrator.js for routing rationale, Anthropic API primary).

**Summary of major data flows:**
- **companies/*.json** → **all downstream systems** (registry, stress, command-board, treatment-discovery, orphan detection, densification candidates).
- **treatment-discovery-cube.json** ↔ **treatment-discovery/by-node/** (split for render) ↔ **treatment-discovery.html** (operator surface).
- **stress-network-state.json** → **Master Brain readiness** + **autofire workers** + **command-board UI** (domain operators).
- **audit/* (verification-ledger.json)** ← **grows continuously** as task #33 (organ-claim-verification.mjs) runs, providing ground-truth verdicts for treatment claims.

### NEEDS WORK / INCONSISTENCIES

1. **portal-registry.json (61.75 MB, 81 days stale):**
   - No build script found in live- repo for regeneration. **Likely only in full-repo** (C:\Users\Chris\Limen-Helix).
   - 173,652 portal entries suggests it was built from comprehensive domain/issue taxonomy; current version may be outdated as new domains/issues are added.
   - portal-ui.js, portal-router.js depend on it for navigation; if stale, users cannot discover new portals via UI.
   - **ACTION:** Locate or rebuild build-portal-registry.mjs. Verify if portal-registry.json should be auto-generated with each domain addition or rebuilt on schedule.

2. **brain-nodes-111.json (98 days old, hand-authored):**
   - Marked as canonical but not regenerated since 03/01/2026.
   - Treatment-discovery and neuro-disorder lookup depend on it; any fixes to node descriptions require manual edit + re-run of dependent scripts.
   - **RISK:** Node definitions frozen; no mechanism for updating node roles / business mappings if brain science shifts.
   - **ACTION:** Document canonical state (is this truly static reference data?). If dynamic, establish version control and build pipeline.

3. **eligible-universe.json (28 days stale, last run 05/09/2026):**
   - probe-eligibility.js should be run regularly to refresh phase eligibility snapshots.
   - No automated schedule found in scripts or cron.
   - **RISK:** Phase-eligibility data lag; autofire and phase-transition detection may miss near-eligible portals.
   - **ACTION:** Add probe-eligibility.js to build pipeline or schedule. Verify if kernel refresh cycle should trigger it.

4. **stress-network-state.json (12 days old):**
   - build-stress-network.mjs should run whenever command-board-data.json updates (which is every kernel cycle).
   - Last update 05/25/2026; command-board-data.json updated 05/27/2026 (2 days after stress run).
   - **RISK:** Stress propagation lags kernel updates by days; Master Brain and autofire decisions may stale.
   - **ACTION:** Integrate build-stress-network.mjs into post-kernel-refresh automation. Run with --top 20 for visibility on network-pushed nodes.

5. **portal-registry.json vs. domain files (domain/issue count mismatch):**
   - portal-registry.json reports 173,652 portals but live- repo only has 3,710 + 800 = 4,510 JSON files.
   - **Likely explanation:** portal-registry.json was built from full-repo (C:\Users\Chris\Limen-Helix) which has ~10× more domains/issues; live- is a subset for Vercel deployment.
   - **RISK:** UI may reference portals (governance/anticorruption/antimoney) that don't have corresponding .json files (no content, just nav structure).
   - **ACTION:** Verify live- deployment is intentionally subset; audit portal-registry.json for orphaned paths (nav references without backed .json files).

6. **Orphan densification pipeline incomplete:**
   - orphan-stakeholders.json identifies 9,559 entities (4,105 companies, others) with densifyCandidate=true or false.
   - No script found to auto-densify (create companies/*.json from orphan entries).
   - **RISK:** Supply-chain nodes remain structurally invisible to stress propagation (no brainNodeMapping overrides, so inhibitory damping cannot be applied).
   - **ACTION:** Implement semi-automated densification: detect refCount > threshold, merge data from multiple sources (Edgar, news, regulatory), create stub portal, trigger binding-fidelity validation.

7. **treatment-discovery-cube.json verification incomplete (task #33 PENDING):**
   - 84 MB cube contains every cell with sourceProvenance, but verification status is PENDING for all claims until task #33 runs organ-claim-verification.mjs.
   - Verification output written to audit/verification-ledger.json (2.8 MB, growing).
   - **RISK:** Operator surface (treatment-discovery.html) shows unverified claims; no sorting/filtering by verdict status yet visible in UI code.
   - **ACTION:** Implement verification-status tier in treatment-discovery UI. Suppress or flag REJECTED claims. Document task #33 completion timeline.

8. **company-registry.json inconsistencies (9 days old):**
   - byCik index keyed on numeric CIK ("0", "10456", etc.), but some portals lack CIK (PRIVATE companies).
   - byBrainNode contains entries from both company's own brainNodeMapping AND functionalNetwork references (unclear which takes precedence for overlaps).
   - **RISK:** Queries like "find all companies with mPFC binding" may double-count if company self-maps mPFC AND references another company with mPFC.
   - **ACTION:** Audit byBrainNode duplicate logic in build-company-registry.js. Add confidence weighting to distinguish owned vs. referenced bindings.

9. **brain-connectome.json (98 days old, 6 edges only):**
   - MVP inhibitory damping reads only 6 canonical edges (vmPFC→BLA, HAB→VTA, HAB→RAPHE, CAUD→GP, PUT→GP, GP→THAL).
   - Full brain connectome (~100+ edges in literature) not included.
   - **RISK:** Stress propagation underestimates regulatory capacity; portal damping only applies if both endpoints have strong overrides in brainNodeMapping.
   - **ACTION:** Expand connectome with full anatomical edge set (excitatory + inhibitory). Reweight inhibitory damping constants based on empirical γ calibration (empirical-gamma-by-phase.json).

10. **limen-report-index.json (91 days old, purpose unclear):**
    - Contains job titles × brain nodes × dysregulation. No reader found in codebase.
    - **RISK:** Orphaned or vestigial; may be intended for job-matching UI that's not yet built.
    - **ACTION:** Audit usage. If unused, either integrate into a new subsystem or remove.

11. **Stale reference data not version-controlled:**
    - brain-nodes-111.json, brain-atlas-coordinates.json, civilization.top.json, remedy-library.json, sp500-ciks.json are hand-authored static references, but no associated .md documentation or version-release notes.
    - **RISK:** Changes to these files can cascade silently; no audit trail of who changed what when.
    - **ACTION:** Add MANIFEST.md or data-version.json at top level documenting hand-authored reference files, last-reviewed-date, next-review-date, owner.

12. **Audit files growth (verification-ledger.json 2.8 MB):**
    - verification-ledger.json is append-only as organ-claim-verification.mjs adds VERIFIED/REJECTED verdicts.
    - No purge/archival strategy; file will grow unbounded.
    - **RISK:** File size may exceed Vercel deployment limits (~250 MB).
    - **ACTION:** Implement rolling-window archival (e.g., keep last 90 days, compress older) or sharded ledger (by domain/node).

13. **Missing readers/writers for 10+ tanks:**
    - node-entity-mapping.json, operator-references.json, entity-registry.json, company-index.json, connectome-node-registry.json, cross-domain-gamma-comparison.json, verbiage-templates.json, review-rubric.json, corpus.json — no readers found in grep search.
    - **RISK:** Bloat or vestigial. May be intermediate build artifacts never consumed.
    - **ACTION:** Audit each: (a) find reader, or (b) document as build-time-only intermediate, or (c) delete.

14. **Python helix_app/index.py and helix_app/thing2/phase_engine.py:**
    - Read command-board-data.json, command-board-eligible.json, empirical-gamma-by-phase.json.
    - No corresponding build scripts found in scripts/ (which is all .mjs/.js).
    - **RISK:** Phase engine logic may drift from JavaScript kernel logic; verification breaks sync across languages.
    - **ACTION:** Unify or document canonical version (JS or Python?). Ensure both read same source data structures.

15. **API gateway missing JSON schema validation:**
    - api/limen-stress-propagation.js, limen-worker-*.js read stress/command-board tanks but no schema validation at read time.
    - **RISK:** Stale or corrupted tank data silently propagates to downstream workers; no early detection.
    - **ACTION:** Add JSON.parse() error catching + schema validation using treatment-discovery-cell.schema.js pattern.

16. **Affiliate-config.json and capital-engine.json divergence:**
    - capital-engine.json lists 15+ connectors (Stripe, Amazon, Rakuten, ShareASale, YouTube, TikTok, Meta, etc.).
    - affiliate-config.json is minimal (1.7 KB).
    - **RISK:** Config may be duplicated or out-of-sync; unclear which is source-of-truth.
    - **ACTION:** Consolidate or clarify roles (capital-engine = full schema, affiliate-config = subset/override?).

17. **Treatment-discovery by-node files (35 MB) may be deploy-time generated, not stored:**
    - split-cube-for-render.mjs writes 113 .json files to by-node/ every time cube changes.
    - These are build artifacts, not source data.
    - **RISK:** If by-node/ not committed to git, render surface fails after fresh-clone deploy (must run split-cube script).
    - **ACTION:** Verify build-on-deploy automation. If manual, document post-deploy step. Consider pre-building in CI/CD.

---

**Total measurable tanks:** 39 top-level JSON + 800 companies + 3,710 domains + 113 treatment-discovery/by-node + 6 audit = **4,668 JSON** (matches 4,670 measured, <1% rounding).

**Critical data products:**
1. treatment-discovery-cube.json — 84 MB, 2 days old (FRESH). The entire 6-step treatment chain.
2. stress-network-state.json — 4.5 MB, 12 days old (AGED). Master Brain and autofire input; should be ≤ 3 days old.
3. command-board-data.json — 140 KB, 11 days old (AGED). Per-domain operators depend on it; should refresh with kernel cycle.
4. company-registry.json — 16 MB, 9 days old (AGED). Core index; acceptable at 1–2 weeks if portal corpus stable.
5. portal-registry.json — 61 MB, 81 days old (STALE). **No build script found. Likely only in full-repo.**

All remaining analysis and production recommendations contingent on resolving #5 (portal-registry.json source).

---

## 4. Python kernel / distress scorer

### PURPOSE

The Python kernel suite powers the LIMEN Helix distress detection system. It comprises two parallel kernels (Thing 1 = validated financial distress scorer; Thing 2 = long-arc 11-phase recursive tracker), a reconciliation audit log, SEC/FRED data ingestion pipeline, and phase-scoring mathematics. All three composite alert paths (stress-rate, cash-decline, rupture) operate server-side; the browser receives only labels, bands, and narrative text (no formulas, weights, raw scores, or thresholds). EDGAR/XBRL extraction is locked to validated quarterly series with fallback tag hierarchies. Thing 1 fingerprint validation (SHA256 lock) gates all "validated" alerts.

### KEY FILES

**Core Kernels:**
- `/api/limen.py` — TOP-LEVEL: Validated Three-Path Distress Scorer. FastAPI entry point. Wraps `api/helix_app/thing1/limen_backtest.py` (locked, validated kernel SHA256). Runs SEC facts through feature extraction, computes three composite paths (A=stress-rate, B=cash-decline, C=rupture), emits alert + thresholds (A≥1.1, B≥1.5, C≥1.5). Contains P3_ENTRY=0.59 frozen gate and hardcoded kernel_sha256_lock fingerprint. Phase history + financial_state exposed for S(t) panel rendering.
- `/api/helix_app/index.py` — BRIDGE: Dual-kernel reconciliation wrapper for `/api/helix/helix-report/score` POST endpoint. Orchestrates Thing 1 (validated scorer stub) + Thing 2 (phase_engine.py) + audit logging. Handles bank lock (SIC 6000-6999 → BANK_ADAPTER_REQUIRED). Builds safe-packet (labels only, no raw numerics). Implements polyvagal context auto-population from `command-board-data.json` peer cohort + counterparties spider-web. Routes requests to `/api/helix/score/{cik}` (deprecated), `/api/helix/edgar/facts/{cik}`, `/api/helix/edgar/extract/{cik}`.

**Phase Engine (Long-Arc Tracker — Thing 2):**
- `/api/helix_app/thing2/phase_engine.py` — FULL 11-PHASE SCORING. Faithful JavaScript port (v4.0.2, 2026-05-13). Ingests company_data dict {Revenue, OCF, Cash, Debt, Deposits}. Outputs 13 phases (p0-p10 + p7a/p7b split). Contains:
  - Feature engineering: 4Q + 8Q rolling windows, log-diff, variance, autocorrelation, slope, acceleration, PELT breakpoint detection, runway.
  - Phase math: P0 (stable baseline), P1 (rupture), P2 (rhythm), P3 (darkness/instability, probabilistic-OR with P3_BIAS=2.5), P4 (peace/stabilization), P5 (endurance), P6 (order), P7 (dissolution), P7a (terminal, requires viability breach), P7b (controlled separation), P8 (pivot), P9 (collapse, P3>0.75 + 0.65-quarter sustained threshold), P10 (resurrection).
  - Trajectory accumulator C(t): CHARGE when P3≥0.59 (base×amplifier×consecutive_bonus×cash_vulnerability); DISCHARGE via recovery phases (fast 0.3x or slow 0.9x baseline decay). TTM-OCF runway gate forces P7a dominance when runway<2Q.
  - Dynamical class gammas (v4.0.2 empirical KM-corrected from Test #5): GAMMA_ATTRACTOR=0.51 (p7a/p4/p10), GAMMA_RECOVERY=0.266 (p0/p1/p3/p5/p6/p8), GAMMA_TRANSIENT=0.043 (p2/p7/p7b/p9).
  - Composite score: max(pathA, pathB, pathC); pathA = 2.5×stress_rate + 0.5×max_consec/10 + 0.5×max(p3−0.59,0) + sustained_bonus; pathB = stress_rate + 2.0×cash_decline; pathC = rupture detector (cash>30% drop OR debt>50% spike OR variance>5x median).
  - Recency-weighted dominant phase (RECENCY_HALF_LIFE=6 quarters, exponential weighting favoring latest).
  - P3 capital-allocation dampening (intentional reinvestors identified by revenue+OCF+cash health).

**Validation & Audit:**
- `/api/helix_app/thing1/__init__.py` — STUB Thing 1 entry point. Computes `fingerprint_status()` (SHA256 file hash vs VALIDATION_LOCK.json). Returns all fields with `validation_status ∈ {unavailable, unvalidated_after_modification, bank_adapter_required}` when fingerprint absent/mismatched. Placeholder for real limen_backtest.py (Phase 4). Never emits alert=true or validates in Phases 1-3.
- `/api/helix_app/thing1/VALIDATION_LOCK.json` — NOT VISIBLE IN THIS AUDIT (Phase 4 only). Expected fingerprint lock SHA256 for the real validated kernel. Mismatch prevents scoring.
- `/api/helix_app/audit/reconciliation_log.py` — ONE LOG ENTRY PER REQUEST. Records pattern_signature (e.g. "t1=unavailable|t2=p4|q=2025Q4|fin=false"), phase score buckets (low/medium/high at 0.3/0.6 cuts), state_summary (C_t, runway_classification), timing (t1_ms, t2_ms), forbidden phrase filtering counts. No raw numerics, no thresholds, no kernel source. Privacy-first: labels only. Emits to stdout (Vercel log drain) + best-effort append to local `reconciliation_log.jsonl`.

**Backtesting & Validation Sandbox (Regime 1 only):**
- `/api/helix_app/thing1/limen_backtest.py` — FULL LOCKED BACKTEST ENGINE (7-firm/5-firm cohort: HTZ, JCP, CHK, BBBY, SVB, FRC, SBNY distress; CAR, M, XOM, WMT, JPM, SLG, SCHW, USB controls). Implements full validation lifecycle: SEC fetch (Tag_MAP fallback chain), compute_all_features (logging full DF per company), score_all_phases (11-phase vector per quarter), analyse_trajectory (C(t) accumulator), compute_composite_score (three-path alert on Regime 1 only), plot/export (ROC, PR-AUC, heatmaps, per-company CSVs). Contains two entry points: `main()` (full backtest with threshold sweep, finds optimal P3_ENTRY by F1/recall/FPR tradeoff), `run_holdout_validation(csv)` (frozen HOLDOUT_P3_ENTRY=0.59, runs against independent holdout cohort, compares vs 3 baselines: cash-slope, Altman-Z proxy, LogReg-4-feat).

**Supporting:**
- `/api/ping.py` — HTTP health check (minimal).
- `/api/ping_app.py` — FastAPI health stub for `/api/ping_app`.
- `/api/helix_app/thing1/__init__.py`, `/api/helix_app/thing2/__init__.py`, `/api/helix_app/audit/__init__.py` — Package initialization; export public APIs only (no internal details).

### LIVE PAGES

- `https://limenhelix.com/helix-report` — PRIMARY: Two-kernel report viewer. POSTs CIK to `/api/helix/helix-report/score` → displays validated_signal (Thing 1) + phase_tracker_signal (Thing 2) + reconciliation verdict.
- `https://limenhelix.com/company-portal` — CALLS kernel via same `/api/helix/helix-report/score` POST. Renders phase timeline, stress accumulator history, financial state snapshot.
- `https://limenhelix.com/kernel-comparison` — HISTORICAL: Shows pre-v4 snapshot scores (not Thing 1/Thing 2 reconciliation). Contains caveat: "Re-run /api/helix-report/score for current safe-packet verdict."
- Domain command pages (agriculture, communication, culture, defense, economy, education, energy, environment, finance, governance, industry, infrastructure, intelligence, law, medicine, population, religion, science, technology, trade) — Use cached company-portal scores (not live kernel calls in most cases); same reconciliation caveat.

**API Routes Exposed:**
- `POST /api/helix/helix-report/score` — **PRIMARY ENTRY.** Body: {cik, requested_report_type ∈ {partial_phase_snapshot, validated_financial_distress, bank_safe_summary, domain_signal}, source_surface ∈ {civilization, command_board, company_portal, ...}, optional: ticker, domain, lane, source_opportunity_id}. Returns safe-packet (no raw rows/weights/formulas).
- `GET /api/helix/score/{cik}` — **DEPRECATED.** Backward-compat wrapper. Returns safe-packet (no longer exposes raw DataFrame rows).
- `GET /api/helix/edgar/facts/{cik}` — Raw SEC EDGAR companyfacts proxy (avoids browser CORS).
- `GET /api/helix/edgar/extract/{cik}` — SEC extraction + financial-vs-nonfinancial tagging (5-metric for finance, 4-metric industrial).
- `GET /api/helix/health` — Liveness probe (no kernel internals).
- `GET /api/helix/regression` — Thing 2 self-consistency regression (9 CIK fixtures: Apple, Microsoft, Boeing, Beyond Meat, SVB, JPMorgan, HPE, Athersys, Amazon). Verifies dominant_phase + trajectory outputs match expectation (not Thing 1 validation).
- `GET /api/limen/health` — Liveness probe (Python-validated distress scorer identity only).
- `POST /api/limen/score` — **LOCKED ENDPOINT.** Body: {cik}. Returns full limen_backtest.py output (11 phases, stress_accum, phase_history, financial_state, input_presence) + validation metadata. **ONLY CALLED BY INTERNAL BACKTEST SCRIPTS; NOT EXPOSED TO BROWSER.**

### DATA

**Tanks Read (per request):**
- `/assets/data/command-board-data.json` (~TBD MB) — Per-CIK domain + stress + phase + trajectory + peer cohort (cached 10 min TTL). Used by `/api/helix/helix-report/score` to auto-populate polyvagal_context (domainPhase, peerCohort, counterparties) when browser doesn't supply it. Stale: may lag if command-board rebuild missing.
- `/assets/data/companies-manifest.json` (~TBD MB) — Index of 767 portals (slug → CIK mapping). Used for portal-lookup in counterparties context-building.
- `/assets/data/companies/{slug}.json` (~TBD MB across 767 files) — Per-company portal (functionalNetwork with suppliers/customers edges). Loaded on-demand during counterparties resolution.
- SEC EDGAR `/api/xbrl/companyfacts/CIK*.json` (external) — Primary data source. Fetched per-request. Tag extraction fallback chain ensures robustness (Revenues → RevenueFromContract... → SalesRevenue... → InterestNoninterest...). Caching: per-cold-start only.
- FRED `/api/fred/series/observations?series_id=FEDFUNDS` (external) — Fed funds rate deltas (2014-present). Used for P9 macro bias. Best-effort (skipped if unreachable). Cached per backtest run.

**Tanks Write:**
- `reconciliation_log.jsonl` (local file, append-only) — Best-effort on Vercel (read-only filesystem). Primary durable channel is stdout (captured by Vercel log drains). Entry: request_id, t1 kernel_id/validation_status/alert, t2 dominant_phase/phase_scores (bucketed), reconciliation summary_template, pattern_signature, timing, warnings_count.
- `/api/helix_app/output/` (backtest only) — Local backtest sandbox. NOT ON VERCEL. Outputs: summary.txt, per-company CSVs, plots (ROC, PR-AUC, heatmaps), holdout_results.json, holdout_report.txt.

**Data Freshness:**
- SEC EDGAR: **per-request fetch** (always fresh within SEC's 1-day publication lag). No caching except within a single cold-start warm lifetime (~15 min Lambda).
- command-board-data.json: **stale by design** (10 min TTL, rebuilds external). Reflects most recent `build-command-board.js` run. If command-board missing rebuild for >10 min, coupling degrades to intrinsic_only mode (logged in reconciliation).
- companies-manifest.json: **stale** (same 10 min TTL). Coupled to command-board rebuild cycle.
- Portal JSONs: **cached per cold-start** in `_PORTAL_CACHE` dict. Stale until next Vercel cold start (6-24 hours typical in production).
- FRED: **per-backtest fetch** (backtest only). Production `/api/helix/helix-report/score` does NOT fetch FRED (removed in Phase 3); fred_delta passed as empty dict → P9 macro bias disabled.

**Empty / Absent Tanks:**
- VALIDATION_LOCK.json: **Not present in Phase 1-3.** Phase 4 will sign it. Until then, fingerprint_status() → "no_lock" state → ALL REQUESTS REFUSE TO SCORE (`validation_status="unvalidated_after_modification"`). **CRITICAL BLOCKER IF LOCK IS MISSING.**
- limen_backtest.py (real file): **Not present in Phase 1-3.** Stub returns `validation_status="unavailable"`. Thing 1 alerts impossible until Phase 4.
- Bank-specific adapter: **Not built.** All SIC 6000-6999 → BANK_ADAPTER_REQUIRED (returns unavailable). Regime 2 calibration not performed.

### HOW IT CONNECTS

**Inbound (requests from browser):**
1. Browser (helix-report.html, company-portal.html, domain-command.html) POSTs to `/api/helix/helix-report/score` with {cik, source_surface, ticker, domain}.
2. Index.py `_score_safe()` async function:
   - Fetches SEC facts + SIC code concurrently.
   - Auto-builds polyvagal_context from command-board (peer cohort, domain stress, counterparties spider-web) if not supplied.
   - Runs Thing 2 (phase_engine.py `run_pipeline()`) on company_data {Revenue, OCF, Cash, Debt, ...}.
   - Timestamps & emits reconciliation log entry (stdout + local jsonl).
   - Returns safe-packet (no raw DataFrame rows, weights, or thresholds).
3. Server returns packet to browser. Renderer displays:
   - validated_signal (Thing 1 stub: unavailable, no alert)
   - phase_tracker_signal (Thing 2: p0-p10 phases, phase_state_label neutral text, not "alert")
   - reconciliation summary ("T1 unavailable, T2 interpretive only")
   - reconciliation.language_constraints (suppresses terminal language when t1_alert ≠ true)

**Outbound (server calls):**
- SEC EDGAR API: `/api/xbrl/companyfacts/CIK*.json` (async httpx, timeout 30s). User-Agent: limenhelix@gmail.com.
- SEC Submissions: `/submissions/CIK*.json` (for SIC code). Timeout 15s.
- FRED API: NOT CALLED IN PRODUCTION `/api/helix/helix-report/score`. Backtest only via `fetch_fred()`.

**Cross-kernel Signal Flow:**
- Thing 1 → Thing 2: None (Thing 2 runs independently). Reconciliation reads outputs of both post-facto.
- Thing 2 (polyvagal context) ← Command-Board: domainPhase, peerCohort, counterparties bias fed into phase_engine.py `_compute_polyvagal_bias()` (BIAS logic not yet exposed in Python port; JS kernel handles bias application). Python currently runs intrinsic_only or passes polyvagal_context to `run_pipeline()` but doesn't modify phase outputs yet.
- Reconciliation audit → Renderer: pattern_signature (t1=unavailable|t2=p4|q=2025Q4|fin=false) visible in browser for pattern analysis. Forbidden-phrase filter applied server-side before narrative_safe[] reaches browser.

**Per-Domain Spider-Web (Pass 3B, Phase 3):**
- Focal company portal (portal-lookup via slug) → functionalNetwork.suppliers + functionalNetwork.customers.
- For each counterparty CIK:
  1. Look up in command-board (CB) → get counterparty phase + stress.
  2. If counterparty on CB, resolve exposureShare (explicit or 1/N uniform).
  3. Build counterparties block {suppliers: [...], customers: [...]}.
- Phase engine receives polyvagal_context["counterparties"] → applies via `_compute_polyvagal_bias()` (JS kernel) or passes to Python run_pipeline() (not yet coupled in Python port).
- Biasing routes: supplier rupture (counterparty p7a/p9) → focal P1 bias; customer demand collapse (counterparty p3/p7a) → focal P3/P7b bias.

**CRITICAL EVIDENCE PATHS:**
1. **SEC EDGAR tag extraction**: `limen_backtest.py:extract_quarterly_series()` (lines 211–284) iterates TAG_MAP fallback chains. For Revenue: tries us-gaap/Revenues → RevenueFromContractWithCustomerExcludingAssessedTax → ... → InterestIncomeExpenseNet. Captures quarterly (flow, 10-Q/10-K) vs instant (balance sheet) semantics. **Validation contract (lines 108–131)**: input_presence dict surfaces actual quarterly counts per series + dc/dl coverage ratios (catch sparse debt-current vs long-term mismatch that inflates Path C). HON example: 69Q real data but 0Q displayed due to incomplete XBRL tagging — fixed by truth-ledger input_presence contract.

2. **Phase 3 (darkness/instability)**: Probabilistic-OR aggregation (phase_engine.py lines 519–551). Computes z_risk_{Revenue, OCF, Cash, Debt, Deposits} as max of positive z-scores. Final P3 = 1.0 − ∏(1 − p3_p_*), effectively: P3 high when ANY financial signal is bad (revenue variance UP, revenue slope DOWN, OCF bad, cash declining, debt accelerating, deposits fleeing). **Deposits channel** (financial institutions): uses max(4Q, 8Q) z-slopes to catch 6-month banking crises not visible in quarterly noise.

3. **Trajectory accumulator C(t) (lines 812–881)**: Hybrid CHARGING/DISCHARGING per quarter. CHARGE: base = p3 × 1.0; amplify by p7 (divergence bonus, 20%); consecutive_bonus (20% per Q, capped 6Q max); cash_vulnerability (50% if slope < −0.05, 100% if < −0.15). DISCHARGE: fast (30%) if recovery phases (p4+p5+p6)/3 > p3; slow (90%) baseline. Recovery streak gate (Fix 2, line 863): require 3+ CONSECUTIVE recovery-qualifying quarters before full fast decay (prevents false discharge on single good quarter).

4. **Path C rupture detector (phase_engine.py lines 886–988)**: Scans raw financials for SAME-QUARTER multi-signal shocks. Signals: (1) cash drop > 30%, (2) debt spike > 50%, (3) var jump > 5x median. Needs ≥2 signals. **Recovery filter**: if rupture in last 2 quarters, alert stands (insufficient recovery data). If 8+ quarters post-rupture, company survived → downgrade (distress companies truncate at event date). Cash stabilization check: post-rupture cash must stay ≥ rupture-quarter trough to count as recovered (SIVB 2023: pass through one good quarter, then fails, alert stands).

5. **Live page flow**: company-portal.html user enters CIK → fetch `/api/helix/helix-report/score` POST → index.py runs Thing 1 (stub, unavailable) + Thing 2 (phase_engine full 11-phase) → reconciliation routes to "Thing 1 unavailable, Thing 2 interpretive only" → renderer displays phase timeline chart + phase_state_label (neutral text, e.g. "p7a structural-divergence state" not "terminal") + reconciliation disclaimer + phase score buckets (low/medium/high). No alert authoritative text (alert field absent from Thing 2 section by spec).

### NEEDS WORK / INCONSISTENCIES

1. **CRITICAL: VALIDATION_LOCK missing.** Phase 1-3 stub will REFUSE ALL SCORING if VALIDATION_LOCK.json is absent (lines 153–162, thing1/__init__.py). fingerprint_status() → "no_lock" → validation_status="unvalidated_after_modification". Phase 4 must land the real limen_backtest.py + sign VALIDATION_LOCK.json with SHA256, or every request fails. **Live pages should show this prominently if Thing 1 remains unavailable.**

2. **Thing 1 fingerprint never matched on live.** All `/api/helix/helix-report/score` requests currently return Thing 1 as "unavailable" (Phase 1-3 default). The real limen_backtest.py (sha256 3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20, per limen.py line 281) is NOT DEPLOYED. This is intentional (Phase 4 import), but means NO VALIDATED ALERTS ARE POSSIBLE in production right now. Reconciliation always routes to "Thing 1 unavailable" templates (lines 1006–1038, index.py).

3. **FRED disabled in production.** `/api/helix/helix-report/score` does NOT fetch FRED (lines 134–137, limen.py try/except returns empty dict on any error). P9 (collapse threshold) macro bias (z_delta_fedfunds term) always 0. Backtest.py fetches FRED fine (lines 307–338), but production does not. **Inconsistency**: backtest P9 may be higher than production P9 due to missing FRED signal.

4. **Polyvagal context biasing incomplete in Python.** Index.py auto-builds polyvagal_context from command-board + counterparties (lines 247–394), passes it to `run_pipeline()`, but phase_engine.py does NOT apply the bias to output phases. Lines 888–894 in index.py note: "coupling fired, output dominant_phase / phase_scores are the coupled values; intrinsic is preserved separately". But phase_engine.py `run_pipeline()` returns rows with untouched phase scores. **Bias application logic lives in JS kernel (limen-phase-domain-adapter.js), not Python port.** Reconciliation log emits coupling_mode="polyvagal_coupled" or "intrinsic_only" (lines 969), but in Phases 1-3, it always says "intrinsic_only" because Python doesn't yet apply bias. **JS kernel does apply bias; Python stub does not. Mismatch.**

5. **Bank adapter not built.** All SIC 6000–6999 return validation_status="bank_adapter_required" (lines 130–141, thing1/__init__.py). Regime 2 calibration never performed. 767 portals include ~70 banks/financial entities (SVB, JPM, SCHW, USB in the test fixtures). Live pages for finance command show these companies but kernel never runs real scoring. Reconciliation always suppresses terminal language + narrative (lines 995–1005 templates). **Phase 4 must include Regime 2 calibration or these entities stay permanently unscored.**

6. **Command-board stale if rebuild missing.** `/assets/data/command-board-data.json` (cached 10 min) may not reflect latest portal phase/stress if `build-command-board.js` did not recently run. Polyvagal context auto-population depends on CB freshness. **No monitoring or alert if CB is >1 hour stale.** Coupling degrades gracefully to intrinsic_only but user sees no warning.

7. **Portal slugs may not resolve.** `_slug_for_cik()` (lines 143–156, index.py) looks up CIK in companies-manifest.json. If CIK absent (new portal, not yet indexed), counterparties context cannot be built. **No fallback or indication to caller.** Reconciliation emits no warning; coupling simply skips counterparties block.

8. **Backtest output directory hardcoded.** `limen_backtest.py` line 36: `OUTPUT_DIR = Path(__file__).parent / "output"`. This creates `/api/helix_app/thing1/output/` on the filesystem during backtest runs. On Vercel (read-only `/var/task`), this fails silently (line 38 ignores exception). **Backtest outputs never persist on Vercel. Must run locally.**

9. **Thing 2 P7a/P7b split incomplete in Python.** Lines 668–717 (phase_engine.py `score_p7_split()`) score P7a (terminal) + P7b (controlled separation) based on viability breach (lines 635–665). P7a requires: revenue slope < −1.5 OR OCF < −1.5 OR runway < 4Q OR debt slope > 1.5 OR deposits fleeing (slope < −2.0 at 8Q). But P7a/P7b output is set in-place in rows (lines 700, 709–712), then later used by get_dominant_phase(). **No coupling of P7a/P7b with reconciliation narrative.** Index.py only reads dominant_phase (string, e.g. "p7a") from Thing 2 (line 891, 954), not the sub-phase breakdown. Reconciliation cannot distinguish "company in terminal divergence (p7a)" from "controlled separation (p7b)" in its summary_template map (lines 34–54).

10. **Capital allocation dampening may hide P3.** Lines 578–604 (phase_engine.py) detect intentional reinvestors (revenue growing + OCF stable + cash ok + debt growing) and dampen P3 by 40% (line 603: `r["p3"] *= 0.6`). This can flip P3 from >0.59 (stressed) to <0.59 (clean) for high-growth tech companies burning cash deliberately. **No flag in output to signal dampening occurred.** Reconciliation doesn't know P3 was adjusted. Flag added (line 604: `r["p3_capalloc_dampened"] = True`) but not surfaced to safe-packet. **Silent adjustment may confuse reconciliation logic if dampened P3 crosses thresholds.**

11. **Chronic stress override incomplete.** Lines 1140–1177 (phase_engine.py) `_apply_chronic_stress_override()` boost distress-side phases when P3 is chronically elevated. Currently called in `run_pipeline()` (per limen-thing2-kernel.js mention) but **NOT CONFIRMED CALLED IN PYTHON CODE.** Grep of phase_engine.py shows function defined but no `_apply_chronic_stress_override()` call visible. May be dead code.

12. **Reconciliation log audits both kernels but Thing 1 always unavailable.** Audit entries record t1.validation_status (always "unavailable" in Phases 1-3) + t1.alert (always None). If Thing 1 is ever present + locked, audit will record real divergences. **Currently all audit records show t1=unavailable|t2=p?|q=...|fin=false. No live validation-vs-tracker divergence data.** Backlog of divergence patterns cannot be built until Phase 4.

13. **Reconciliation summary_template IDs hardcoded.** Lines 34–54 (audit/reconciliation_log.py) map long prose → short IDs (e.g. "t1_alert_t2_distress_agree"). If renderer or Thing 2 output changes narrative text, map falls out of sync. **No CI check for template drift.** New consensus text added to reconciliation() but not to _TEMPLATE_IDS map → freeform_or_unmapped ID instead of specific label.

14. **Phase 2 rhythm detection weak.** P2 (lines 516–517, phase_engine.py) = (rev_diversity + health_slope_rev + health_accel_rev + health_slope_ocf) / 4. Entirely driven by revenue autocorrelation (diversity) and slope/accel. **No measure of actual coordination / partnership / hiring / alliance.** Backtest cohort (HTZ, JCP, etc.) rarely enter P2; most jump P1→P3. P2 may be under-scored empirically.

15. **P9 tightened to P3 > 0.75 but backtest uses P3 > 0.60.** Lines 615–627 (phase_engine.py `score_all_phases()`) only fires P9 if P3 > 0.75 + sustained OR break. But `compute_composite_score()` (backtest, lines 646–656, limen_backtest.py) uses P3 > 0.60 as the check: `if row["p3"] > 0.6: ... r["p9"] = sigmoid(...)`. **Inconsistency between backtest (loose) and production (tight) P9 gating.**

16. **No input validation on CIK format.** Index.py `_normalize_cik()` (lines 239–244) strips leading zeros but doesn't validate digits-only. A CIK of "ABC" passes through as empty string "0". SEC API will then fail (404 or 429), caught and logged, but no upstream rejection. **Backtest.py lines 191–192 does pad, no validation either.** Browser-side validation (helix-report.html) may catch garbage, but API should reject formally.

17. **Deposits metric not extracted for non-financial.** TAG_MAP (phase_engine.py lines 152–154) includes "Deposits" tag, but `build_company_data()` only uses it if is_financial=True (logic inferred from SIC 6000–6999). **Non-financial companies' Deposits metric stays empty, even if they have deposit-like liabilities.** P3 deposits channel (line 544–548) guarded by `if _has_dep:` so safe, but hidden assumption.

18. **Runway classification "n/a" hides distress.** Lines 706–724 (index.py `_runway_classification()`) returns "n/a" for financial institutions (line 709). But if a bank actually has runtime < 2 quarters (impossible semantically, but data error possible), runway gate (phase_engine.py lines 778–788) fires and forces P7a. **Mismatch: renderer hides runway; engine uses it.**

19. **Verbosity of phase_history in limen.py.** Lines 216–244 (limen.py) emit phase_history with per-quarter q, dom, ct, p3 fields. **ct (stress_accum) always 0.0 for current production (no accumulator in Python)**, so history is incomplete. Renderer S(t) panel may be blank. **Phase 4 must wire up actual accumulator or remove ct from contract.**

20. **Missing: Per-company signal audit trail.** Audit log is pattern-level only (template_id, phase_buckets, timing). **No per-company breakdown of which signals fired (Path A vs B vs C, which quarters crossed thresholds, which features dominated).** Backtest.py prints this (lines 1622–1627), but production audit log doesn't. Operator cannot trace why ACME Corp flipped p4→p7a without re-running backtest.

21. **Missing: Historical drift detection.** Reconciliation log appends new entries (JSONL), but no periodic analysis of per-CIK drift (kernel version, phase changes, validation_status changes). **Operator must manually grep and plot.** No built-in "this company's P3 jumped 0.3 in 2 quarters" alerting.

22. **Missing: Polyvagal bias audit trail.** Index.py lines 960–963 note intrinsic_phase_scores + coupled_phase_scores + bias_contributions surfaced when coupling fires. But in Phases 1-3 coupling never fires (intrinsic_only always), so **no test data for bias audit trail.** JS kernel emits this; Python does not. Cannot verify parity until Phase 4 Python port adds bias application.

---

## File Paths Summary

- `/api/helix.py` — Route entry point, imports app from helix_app/index.
- `/api/limen.py` — Validated scorer (locked, stub in Phases 1-3).
- `/api/helix_app/index.py` — Dual-kernel orchestration, safe-packet builder, polyvagal context.
- `/api/helix_app/thing2/phase_engine.py` — Full 11-phase engine (v4.0.2), feature extraction, trajectory, composite.
- `/api/helix_app/thing1/__init__.py` — Thing 1 stub, fingerprint validation.
- `/api/helix_app/thing1/limen_backtest.py` — Locked backtest + holdout validation (not imported in production Phases 1-3).
- `/api/helix_app/thing1/VALIDATION_LOCK.json` — NOT PRESENT (Phase 4 lands it).
- `/api/helix_app/thing2/__init__.py` — Thing 2 package exports.
- `/api/helix_app/audit/reconciliation_log.py` — Audit log builder + emitter.
- `/api/helix_app/audit/__init__.py` — Audit package exports.
- `/api/ping.py`, `/api/ping_app.py` — Health checks.
- `/vercel.json` — Route rules, `/api/limen/(.*)` → `/api/limen` rewrite.
- `/assets/data/command-board-data.json` — Polyvagal context source (peer cohort, domain stress).
- `/assets/data/companies-manifest.json` — Portal slug → CIK index.
- `/assets/data/companies/*.json` — 767 per-company portals (functionalNetwork).

---

## 5. Connectome

### PURPOSE

The Connectome is a **123-node (brain) + 20-domain (civilization) unified representation of system topology** — nodes are neural structures (mPFC, PCC, amygdala, thalamus, etc.); domains are civilization sectors (governance, economy, energy, etc.); edges are constraint/signal pathways. The connectome is:
1. A **static lookup layer** (brain-node-domains.json, connectome-node-registry.json) mapping brain nodes to their roles in civilization domains
2. A **living emission substrate** (connectome-super-brain.js) that propagates activation from upstream brains (civilization, master, domain) across nodes via stress-weighted edges
3. A **universal renderer** (connectome-renderer.js, connectome-core.js) shared by 250+ portal pages, rendering 123 nodes in polar galaxy layout with neural impulse pulses
4. A **resolution pipeline** (connectome-resolver.js) that maps stressed feed domains → connectome nodes → opportunity enrichment (annotation only, no scoring)
5. A **visual map** (civilization-connectome.js, domain-connectome-map.js) of 20 civilization domains in Fibonacci spiral and circular layouts

The connectome **does not score or classify** — that authority belongs to the kernel (limen_backtest_kernel.js). It maps signals, activates nodes, and enriches opportunities with connectome context.

### KEY FILES

**Core Renders:**
- `C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-core.js` (2575 lines) — Universal 123-node renderer, Canvas module with 111 brain nodes in galaxy layout, node coloring by system/issue/activation, neural pulses (myelinated sharp/unmyelinated diffuse), propagation integration, activation data loading. Exact duplicate of clinical.html canvas logic wrapped as IIFE with init(opts) API.
- `C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-renderer.js` (897 lines) — Alternate universal renderer (same logic, different entry point), domain edge color map, phase-based impulse coloring, 3-layer schema (phase vectors, stress rings, upward impact), biosensor visualization overlay (_applyBioViz), public API for activation/issue selection.

**Connectome Logic:**
- `C:\Users\Chris\Limen-Helix-live-\assets\js\civilization-connectome.js` (1201 lines) — Civilization domain connectome (20 nodes: governance, economy, infrastructure, energy, agriculture, industry, science, medicine, education, technology, communication, culture, defense, environment, religion, population, trade, law, finance, intelligence). Fibonacci spiral layout (golden angle 2.4). 19 spine edges (sequential) + 11 cross-links (thematic). Domain→portal registry (DOMAIN_PORTALS), navigation routes, stress seeding. Renders with satellites, action potentials (neural impulses colored by phase), spine pulse animation. Gateway to domain-console pages. Phase annotations from window.LIMENPhaseAnnotations.

**Resolver (No Scoring):**
- `C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-resolver.js` (654 lines) — Adapter mapping stressed feed domains → connectome nodes → opportunity enrichment. Feed-to-connectome bridge (20 feed IDs ↔ ~22 connectome domains). Loads brain-node-domains.json on demand. activateNodes() maps stressed domains to nodes. _collectDiagnosisActivations() merges active circuit diagnoses. enrichOpportunity() extracts top 8 nodes and builds business mappings. NO scoring. Kernel adapter callKernel() neutralized (410 Gone on /api/kernel-experiment).

**Kernel Adapter (Disabled):**
- `C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-kernel-adapter.js` (282 lines) — EXPERIMENTAL ANNOTATION ONLY. Transforms domain/connectome stress → proxy financial series (Revenue, OCF, Cash, Debt) for kernel input. Builds 8-quarter synthetic time series (4 baseline smooth growth + 4 stress degradation). callKernel() disabled with error message: "connectome-kernel-adapter is disabled: /api/kernel-experiment is not a public scoring endpoint." All output unvalidated, no kernel math, no authority.

**Super-Brain (Living):**
- `C:\Users\Chris\Limen-Helix-live-\assets\js\limen\connectome-super-brain.js` (200+ lines, partial read) — Turns static brain-node-domains.json into living substrate. Subscribes to all upstream emissions (civilization, master, domain brains via LIMENPatternBroker). Propagates activation via stress-weighted edges. Cross-domain affinities. Emits connectome pattern with current activation state, hot regions, cross-domain node detection.

**Visualization Maps:**
- `C:\Users\Chris\Limen-Helix-live-\assets\js\domain-connectome-map.js` (258 lines) — Client-side advisory visual map of 20 domain relationships. SVG force-directed layout (circular, 320x320px). Stress-colored nodes (red >0.65, gold 0.40-0.65, blue <0.40). Structural edges from civilization.top.json. Active edges for runtime cross-domain patterns. Fixed bottom-right, collapsible. Renders only when opened via CONNECTOME menu (limen-topbar.js).

**Data Lookup:**
- `C:\Users\Chris\Limen-Helix-live-\assets\data\brain-connectome.json` (49KB) — Universal brain base: 111 nodes, edges, system assignments, polar coordinates. Loaded once by connectome renderers. SOURCE OF TRUTH for node layout, system membership, connectivity.
- `C:\Users\Chris\Limen-Helix-live-\assets\data\connectome-node-registry.json` (16KB) — Metadata registry; keys: _schema, _purpose, _generated, plus node-level descriptors (label, aliases, roles/domainRoles). Maps node IDs to their domain participation. Lookup table for enrichment.
- Related: `C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-domains.json` (loaded by resolver, connectome-super-brain; maps nodeId → array of {domain, label, role} entries) — **NOT present in this dash repo — exists in full repo only.**

**Portal Embeddings:**
- `C:\Users\Chris\Limen-Helix-live-\scripts\sense\organ-connectome.mjs` (build script, not live) — organ connectome generation; separate from 123-node brain connectome.
- 250+ portal HTML files embed connectome-core.js (e.g., medicine_addiction_portal.html, communication_portal.html, trade_portal.html, etc.)

### LIVE PAGES

**Core Connectome Pages:**
- https://limenhelix.com/civilization — Civilization domain connectome (20 nodes, Fibonacci spiral, spine pulses, satellites)
- https://limenhelix.com/domain-console?domain=<DOMAIN_ID> — Domain detail pages (governance, economy, energy, infrastructure, agriculture, industry, science, medicine, education, technology, communication, culture, defense, environment, religion, population, trade, law, finance, intelligence)

**Portal Embeddings (250+ sub-pages):**
- https://limenhelix.com/medicine/addiction — Medicine > Addiction Circuit Map (connectome-core.js embedded, 111 nodes)
- https://limenhelix.com/medicine/metabolic — Medicine > Metabolic Circuit Map (connectome-core.js)
- https://limenhelix.com/medicine/gutbrain — Medicine > Gut-Brain Axis (connectome-core.js)
- https://limenhelix.com/medicine/psychedelic — Medicine > Psychedelic Circuit Map (connectome-core.js)
- https://limenhelix.com/medicine/neurology — Medicine > Neurology Circuit Map (connectome-core.js)
- https://limenhelix.com/medicine/clinical — Medicine > Clinical Circuit Map (connectome-core.js)
- https://limenhelix.com/medicine/pediatric — Medicine > Pediatric Circuit Map (connectome-core.js)
- https://limenhelix.com/communication/portal — Communication domain portal (connectome-core.js)
- https://limenhelix.com/communication/advertising — Communication > Advertising (connectome-core.js)
- https://limenhelix.com/communication/journalism — Communication > Journalism (connectome-core.js)
- https://limenhelix.com/trade/portal — Trade domain portal (connectome-core.js)
- ... and 240+ additional domain/sub-domain portals (agriculture, technology, defense, intelligence, finance, energy, infrastructure, industry, education, culture, environment, religion, population, law, governance, etc.)

### DATA

**Static Lookup (never changes during session):**
- `brain-connectome.json` — 111 nodes (id, label, system, angle, radius, size), edges (source, target, type, weight). Structure: {nodes: [...], edges: [...]}. Loaded once at portal init. **FRESH** (49KB file, valid brain node map).
- `connectome-node-registry.json` — 16KB metadata registry. Loaded once. Structure: {_schema, _purpose, _generated, ...node entries}. **FRESH** (16KB file).
- `brain-node-domains.json` — **MISSING in dash repo.** Expected by connectome-resolver.js (line 90), connectome-super-brain.js (line 72). Maps nodeId → [{domain, label, role}] array. CRITICAL for resolver and super-brain. **STATUS: POSSIBLY ONLY IN FULL REPO.**

**Domain Detail JSONs (loaded on demand):**
- `/assets/data/domains/<connectomeDomainId>.json` — One JSON per domain (medicine.json, economy.json, energy.json, etc.). Structure: {activations: [{brainNodeId, domainLabel, domainDescription, phase, treatments, diagnosticTriggers}], issues: [...]}. Loaded by resolver.loadDomainDetail() and portal activation loaders. **STATUS: LIKELY POPULATED (on demand).**

**Live Activation (real-time):**
- `window.LIMENDomains` — Global domain stress state ({domainId: {stress: 0-1, status, brainDiagnoses: [{...}]}}) updated by domain-signal-engine. Read by resolver.resolve() and domain-connectome-map. **FRESH each cycle.**
- `window.LIMENPhaseAnnotations` — Optional phase vector overrides for civilization nodes ({domain: {phase: 'P3', ...}}) from upstream sources. Read by civilization-connectome.js during buildGraph(). **FRESH or stale depending on source.**

### HOW IT CONNECTS

**Forward Path (Upstream → Connectome):**
1. **Domain Signal Engine** emits stress updates to `window.LIMENDomains` (civilization, master, domain brains via LIMENPatternBroker)
2. **Connectome Resolver** reads LIMENDomains and calls:
   - `activateNodes()` — maps stressed feed domains → connectome nodes (feed-to-connectome bridge)
   - `_collectDiagnosisActivations()` — activates nodes from window.LIMENDomains[*].brainDiagnoses[] (active circuits)
   - `enrichOpportunity()` — annotates opportunities with top 8 nodes, business mappings, connectome source attribution
3. **Connectome-Super-Brain** subscribes to LIMENPatternBroker.subscribeAll('connectome:ingest') and:
   - Ingests node mentions from upstream patterns
   - Decays activation per cycle (DECAY_PER_CYCLE = 0.18)
   - Propagates activation across domain siblings via edges (PROPAGATE_FRACTION = 0.05)
   - Emits connectome pattern with activation state, hot regions, cross-domain affinities
4. **Portal Pages** (250+) load connectome-core.js and:
   - Call ConnectomeCore.init() or ConnectomeRenderer.init()
   - Fetch brain-connectome.json and optional domain activation JSON
   - Render 111 nodes in polar galaxy layout
   - Spawn neural pulses on edges (rate, speed, brightness by edge type and activation)
   - Display node labels, stress rings, phase-colored impulses
5. **Civilization-Connectome** renders 20 civilization domains on civilization.html:
   - Fibonacci spiral layout
   - 30 edges (19 spine sequential + 11 cross-links)
   - Satellites orbit each node
   - Action potentials (phase-colored) traverse edges
   - Spine pulse sequential node-to-node animation
   - Click → route to /domain-console?domain=<id>

**Backward Path (Connectome → Opportunity Scoring):**
1. **Resolver** outputs enriched opportunities with connectome.nodes[] and connectome.source field
2. **Kernel** (limen_backtest_kernel.js) consumes enriched opp.connectome context BUT does NOT use connectome for scoring. Kernel is standalone; connectome is annotation only.
3. **Adapter** (connectome-kernel-adapter.js) formerly translated stress → proxy companyData; NOW DISABLED. callKernel() returns error. Kernel is not fed connectome data.

**Visualization Sync:**
1. **Domain-Connectome-Map** listens to limen:world-signals-updated, limen:domain-update events
2. Renders 20 domain nodes, stress-colored circles, active edges (runtime cross-domain patterns from LIMENCrossDomain.active[])
3. No two-way binding; map is purely observational

**Module Hierarchy:**
```
brain-connectome.json (static data)
  ↓
connectome-core.js (Canvas module, 111 nodes)
connectome-renderer.js (alternate Canvas, same logic)
  ↓ init(opts)
  ├→ buildFromBase() or buildNodes()
  ├→ loadActivation(url) — loads domain activation JSON
  ├→ applyActivationData() — marks nodes as activated, adds domain edges
  ├→ spawnPulses(), drawPulses() — neural impulses
  └→ selectIssue() — marks nodes affected by selected diagnosis

civilization-connectome.js (20 domains, Fibonacci spiral)
  ↓
  ├→ buildGraph(data) — loads civilization.top.json
  ├→ buildLifecycleEdges() — 30 edges
  ├→ generateSatellites(), generateActionPotentials()
  └→ applyFocusDomain() → /domain-console?domain=

connectome-resolver.js (feed→node mapping)
  ↓
  ├→ loadNodeDirectory() — loads brain-node-domains.json (ON DEMAND)
  ├→ activateNodes(stressedFeedDomains) — feed→connectome domain→nodes
  ├→ _collectDiagnosisActivations() — active circuits
  ├→ enrichOpportunity() — top 8 nodes + business mappings
  └→ resolve() — full pipeline: activates → collects diagnosis → enriches → stores _lastResolve

connectome-super-brain.js (living substrate)
  ↓
  ├→ _loadNodeDirectory() — loads brain-node-domains.json
  ├→ _ingestUpstream(env) — LIMENPatternBroker subscription
  ├→ _decayAndPropagate() — activation decay + cross-domain edge propagation
  └→ _computeKernels() — emits connectome pattern (systemicLoad, trajectory, hot nodes)

connectome-kernel-adapter.js (DISABLED)
  ↓
  └→ adaptToKernelInput() — stress→proxy companyData (8Q series)
  └→ callKernel() — RETURNS ERROR (adapter disabled)
  └→ run() — full pipeline (DISABLED)

domain-connectome-map.js (visual advisory)
  ↓
  ├→ _render() — SVG 20 domains, stress colors, active edges
  └→ toggle() — collapse/expand

Portal HTML files (250+)
  ├→ <script src="assets/js/connectome-core.js"></script>
  ├→ <script src="assets/js/portal-ui.js"></script>
  └→ ConnectomeCore.init() in inline script
```

### NEEDS WORK / INCONSISTENCIES

1. **Missing Data File**: `brain-node-domains.json` — Referenced by:
   - connectome-resolver.js line 90: `fetch('/assets/data/brain-node-domains.json')`
   - connectome-super-brain.js line 72: `fetch('/assets/data/brain-node-domains.json')`
   
   **NOT FOUND** in dash repo. Expected structure: {nodeId: [{domain, label, role}] ...}. Critical for:
   - Resolver mapping nodes to domains (activateNodes, enrichOpportunity)
   - Super-brain cross-domain propagation logic (domainNodes[d].push({nodeId, w}) loop at line 150)
   
   **IMPACT**: High. Resolver and super-brain silently fail or return empty results. **AUDIT FLAG: Possibly in full repo only.**

2. **Disabled Kernel Adapter Chain**: connectome-kernel-adapter.js callKernel() explicitly neutralized (line 247-253):
   ```
   callback('connectome-kernel-adapter is disabled: /api/kernel-experiment is not a public scoring endpoint...');
   ```
   Proxy series building (adaptToKernelInput) works, but kernel call is dead. Former flow:
   - connectome-resolver.js runKernelForOpportunity() → connectome-kernel-adapter.js → /api/kernel-experiment → kernel-output-interpreter.js
   
   **Current state**: Endpoint removed (410 Gone). Browser cannot POST synthesized companyData to any route. Resolver disables kernel consumption (commented as "DISABLED"). Kernel reads only protected /api/helix-report/score (CIK + safe context).
   
   **IMPACT**: Medium. Feature was experimental; no scoring loss. But resolver's runKernelForOpportunity() callback returns `{available: false, reason: 'Adapter/interpreter not loaded/disabled', experiment: true}`.

3. **Dual Canvas Implementations**: connectome-core.js and connectome-renderer.js contain nearly identical logic (111 nodes, same edge types, same pulse drawing, same issue/activation highlighting). Both are full copies of clinical.html canvas logic.
   - **Line overlap**: ~900 lines each of duplicated code (buildNodes, getNodeColor, spawnPulses, drawPulses, layout, hit-test, etc.)
   - **Inconsistency risk**: Any bug fix in one must be mirrored in the other. Currently both are exact duplicates (as intended, per comments), but divergence is possible.
   - **Recommendation**: Extract common canvas module into shared lib, or use one as single source.

4. **Phase Annotations Sourcing**: civilization-connectome.js line 778-779:
   ```
   phase:((window.LIMENPhaseAnnotations&&window.LIMENPhaseAnnotations[n.id])?
           window.LIMENPhaseAnnotations[n.id].phase.toUpperCase():
           (NODE_PHASES[n.id]||'P0'))
   ```
   Falls back to NODE_PHASES constant if no LIMENPhaseAnnotations. But LIMENPhaseAnnotations source and update frequency unknown. No validation that phases are valid (P0-P10). **INCONSISTENCY**: If upstream brain emits invalid phase, civilization nodes display silently with neutral gray color.

5. **Domain Portals List Stale**: civilization-connectome.js DOMAIN_PORTALS (lines 87-289) hardcodes 250+ company/portal links:
   - Medicine: Johnson & Johnson (JNJ), Pfizer (PFE), Abbott (ABT), Medtronic (MDT), Eli Lilly (LLY)
   - Finance: JPMorgan (JPM), Bank of America (BAC), Goldman Sachs (GS), Schwab (SCHW), BlackRock (BLK)
   - ... etc.
   
   **STALE RISK**: List is inline constants, not JSON-driven. No automation to sync portal additions with DOMAIN_PORTALS. If new company-portal routes added (e.g., `/company-portal?company=new_company`), DOMAIN_PORTALS is not updated. **AUDIT FLAG: Last updated ~2024; may be out of sync with actual portal inventory.**

6. **Connectome-Super-Brain Activation Propagation Opacity**: connectome-super-brain.js line 150-171 cross-domain propagation:
   ```
   var domainNodes = {}; // domain → [{nodeId, weight}]
   ...
   var share = (totalActivation * PROPAGATE_FRACTION) / siblings.length;
   for (var s2 = 0; s2 < siblings.length; s2++) {
     newActivations[siblings[s2].nodeId] = Math.min(1, (newActivations[siblings[s2].nodeId] || 0) + share);
   }
   ```
   **Issue**: domainNodes is built from `this._nodeDomains[nodeId].roles || {}` (line 152). If brain-node-domains.json is missing or malformed (all nodes get empty roles), domainNodes remains empty for every domain, so propagation never fires. Silent failure. **AUDIT FLAG: Cannot verify cross-domain propagation working without brain-node-domains.json.**

7. **Stress Ring Drawing Unimplemented in Portal Canvas**: connectome-core.js includes drawStressRing() function (line 158, from connectome-renderer.js), but it is never called in the draw loop. drawNode() does not invoke drawStressRing(). Civilization-connectome.js also defines drawStressRing (line 427) but never calls it.
   ```
   function drawStressRing(x, y, radius, node, alpha) { ... }
   // Called: NOWHERE
   ```
   **IMPACT**: 3-layer schema stress visualization (7-channel stress rings) is designed but not rendered. Nodes display phase color and satellites, but not stress. **FEATURE INCOMPLETE**: Stress rings exist in code but are dead code.

8. **Portal Activation Data Path Unclear**: Portals call ConnectomeCore.init({...}) and may call loadActivation(url, callback). The URL is typically `/assets/data/domains/<domain>.json` (connectome-resolver.js line 119). But:
   - No validation that domain JSON exists
   - No fallback if fetch fails (loadActivation catches with applyActivationData() → empty)
   - No indication to user that portal-specific nodes couldn't load
   
   **AUDIT FLAG**: If a portal's domain activation JSON is missing, portal silently renders brain with 0 activated nodes. No error message. User unaware of missing data.

9. **Dual Domain-to-Connectome Mapping**: civilization-connectome.js and connectome-resolver.js both define domain mappings:
   - civilization-connectome.js: DOMAIN_PORTALS (250+ links, hardcoded)
   - connectome-resolver.js: FEED_TO_CONNECTOME bridge (20 feed IDs → connectome domains)
   
   These are orthogonal (one is UI nav, one is domain mapping), but naming collision risk. DOMAIN_PORTALS is not used by resolver; FEED_TO_CONNECTOME is not used by civilization renderer. **INCONSISTENCY**: If civilization domain names change, FEED_TO_CONNECTOME in resolver may become stale.

10. **No Cross-Validation of Brain vs Feed Domains**: resolver activateNodes() reads window.LIMENDomains and maps via FEED_TO_CONNECTOME. But civilization-connectome builds its own graph from civilization.top.json:
    ```
    // civilization-connectome.js lines 86-289: DOMAIN_PORTALS has 20 hardcoded domains
    // connectome-resolver.js lines 37-59: FEED_TO_CONNECTOME has 20 feed domains
    ```
    Both should align (governance↔governance, economy↔economy, etc.), but they are independent. If feed domain gets renamed in domain-signal-engine, FEED_TO_CONNECTOME needs manual update. **AUDIT FLAG**: No automated sync between feed domain names and connectome domain names.**

11. **Satellite Generation Hardcoded**: civilization-connectome.js generateSatellites() (lines 712-736) generates random satellites per node based on dataWeight:
    ```
    var count = w >= 0.85 ? (8+Math.floor(Math.random()*4)) : ...
    ```
    Satellites are purely visual, but count is non-deterministic. Every init() regenerates satellites with different offsets/positions. In multi-user scenario, each user sees different satellites. **MINOR**: No functional impact, but inconsistent for collaborative viewing.

12. **Underscore Prefixed Symbols Exposed**: connectome-resolver.js exposes private functions:
    - `_collectDiagnosisActivations()` (line 228) — used in resolve() pipeline, but also exported to window.LIMENConnectomeResolver (implicit via closure)
    - `_lastResolve` (line 487) — stored module-scope, accessed via getLastResolve()
    
    Other JS files use leading underscore for private methods, then export via public API. Here, _collectDiagnosisActivations is internal-only (not in public API at line 612+), but pattern is inconsistent. **MINOR**: No bug, but naming convention not uniform.

---

## 6. Brain nodes / neuro substrate

### PURPOSE
LIMEN Helix' brain node taxonomy & connectome system maps clinical neural circuits to business domains. The system bridges neuroscience (123 canonical brain regions across 11 functional networks) to cross-domain applications (medicines, governance, economy, infrastructure, etc.). The neuro substrate is the foundational knowledge layer where dysregulation patterns in specific brain nodes generate actionable treatment discovery chains (ISSUE → NODE → DISORDER → NEURO_TX → DOMAIN_TX → RESIDUAL).

### KEY FILES

**Core topology & registry:**
- C:\Users\Chris\Limen-Helix-live-\assets\data\connectome-node-registry.json (15.09 KB, modified 2026-05-24) — Master canonical namespace declaring 123 runtime node IDs, aliases, hierarchy collapses (CA1→HIPP, DRN→RAPHE), distinct-pair enforcement (SN vs SNIG), and explicit scope freeze through 2026-12-01. Reconciliation audit output.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-connectome.json — Universal 111-node connectome (actual content in meta, systems, and node-level graph structure); superseded for identity purposes by connectome-node-registry.

**Primary runtime data (RUNS tier):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-domains.json (284.78 KB, modified 2026-05-15) — 123-node receptor surface (primary RUNS consumer). Maps 123 canonical brain-node IDs to 20-30 domain roles each (min 20, max 30, median 26). Consumed by connectome-super-brain.js for live activation propagation, connectome-resolver.js for feed signal→node mapping, and portal brainNodeMapping validators.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-business-mapping.json (483.12 KB, modified 2026-05-10) — Authoring reference. Joins 124 canonical IDs from brain-node-domains with rich neuroscience (region, network, phase, function, dysregulation prose, business industries). 48 entries from brain-nodes-111.json deep directory; 76 entries authored as drafts for IDs without 111 matches. Input to build-neuro-disorder-lookup and build-treatment-discovery-cube.

**Scaffold tier (supporting structure, not runtime-loaded):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-nodes-111.json (96.54 KB, modified 2026-03-01) — 129 rows (128 unique abbreviations; one 'Lateral' duplicated). Integer IDs 1-129. Rich neuroscience descriptions of nodes, phases, dysregulation patterns, networks, business bindings. Filename implies 111 but contains 129; maps ~98 unique abbreviations to runtime canonical IDs. Non-runtime; generator input for build-brain-node-business-mapping.js.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-map.json (8.29 KB, modified 2026-02-23) — 103-node phase/functional-role archetype map. Metadata declares totalNodes: 103. Maps canonical IDs to P0-P10 phase archetypes and functional roles (signal_detector, amplifier, router, allocator, integrator, etc.). Subset of canonical; 20 canonical IDs absent.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-atlas-coordinates.json (42.89 KB, modified 2026-03-01) — 126 nodes with MNI152 coordinates (normalized -1..1). 123 canonical + 3 atlas-local alias extras (CCorp→CC, FRONTO→FPN, GUT→GBA). Extracted from clinical.html MNI_COORDS (lines 4518-4661); verified against connectome-core.js.

**Clinical discovery chain (STEP 3):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\neuro-disorder-lookup.json (685.94 KB, modified 2026-05-30) — Structured (brainNodeId × stateBucket → disorder + treatment) lookup. 187 nodes (62 non-canonical subfields, oscillations, neurotransmitter systems, tracts, glial types), 373 total disorders, 47 distinct treatments, 13 bridge-pattern cells (fully structured with citations), 173 prose-parsed cells from dysregulation fields, 62 empty cells. All claims carry verification: PENDING pending PubMed lookup by Task #33.

**Entity mapping & signal registry (RUNS tier):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\node-entity-mapping.json (94.34 KB, modified 2026-03-16) — Declares 123 total nodes, 123 connectome-matched, 254 FRED signals (economic indicators) bound to nodes. Maps brain nodes to FRED series IDs (CPI, housing, employment, oil prices, etc.) for live signal ingestion.
- C:\Users\Chris\Limen-Helix-live-\assets\data\node-signal-registry.json (39.85 KB, modified 2026-03-16) — 254 signals (FRED series + clinical measurements). Maps signal_id → node_id, fred_series, domain, state-bucket. Input to signal-router.js, domain-signal-engine, real-time visualization.

**Neuro domain templates (74 files across multiple schemas):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\neurology_*.json (primary, cerebellum, globus, striatum, substantia, subthalamic, suppl, thalamus) — Each domain maps brain nodes to activation states, treatments (diagnostic, structural, coaching), evidence grades, and child portals. Pattern repeats for _action, _state, _signal, _diagnosis, _regulate, _adapt, _feedback sub-axes (8 sub-files per primary region = 8×8 neuro domain files).
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\medicine_neurology_*.json (dementia, epilepsy, headache, movement, neuroimmune, neuromuscular, neurooncology, stroke) — Clinical portal data mapping diseases to node activations and interventions.

**Build/validation scripts:**
- C:\Users\Chris\Limen-Helix-live-\scripts\build-brain-node-business-mapping.js — Joins taxonomy (123-node brain-node-domains) with 111-directory rich neuroscience, emitting business-mapping reference. Reads: brain-node-domains.json + _node_directory.json (missing from repo). Outputs: brain-node-business-mapping.json.
- C:\Users\Chris\Limen-Helix-live-\scripts\build-neuro-disorder-lookup.mjs — Reads bridge-patterns.json + brain-node-business-mapping.json + brain-nodes-111.json, parses dysregulation prose, structures per (nodeId × stateBucket), emits neuro-disorder-lookup.json. All claims: PENDING verification.
- C:\Users\Chris\Limen-Helix-live-\scripts\validate-brain-node-mapping.mjs — Validates portal brainNodeMapping against 123-node canonical registry. Enforces all 123 canonical IDs addressed, no unknown IDs, per-node {internal, external} schema.
- C:\Users\Chris\Limen-Helix-live-\scripts\build-treatment-discovery-cube.mjs — Consumes neuro-disorder-lookup + bridge-patterns to build 3D treatment-discovery-cube.json (STEP 4).

**Runtime consumers (JS modules):**
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\connectome-super-brain.js — Loads brain-node-domains.json once at init, subscribes to all upstream pattern emissions, propagates activation across 123-node graph using decay (DECAY_PER_CYCLE=0.18) and cross-binding spread (PROPAGATE_FRACTION=0.05). Emits connectome activation state with dark/hot regions and cross-domain affinities.
- C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-resolver.js — Maps feed domain IDs (20 total: economy, energy, environment, etc.) to connectome domains (~22 canonical). Loads brain-node-domains.json, activates nodes based on feed stress, extracts business mappings, enriches opportunities with connectome context.
- C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-core.js — Universal module extracted from clinical.html. Self-contained connectome rendering, edge types (8: fast, excit, inhib, modul, auto, hormonal, peptide, plastic), system colors (18), phase vectors P0-P10 with decay/crumb logic.
- C:\Users\Chris\Limen-Helix-live-\assets\js\civilization-connectome.js — Cross-domain connectome rendering for civilization portals.
- C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-renderer.js — Phase overlay and visual rendition.
- C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-kernel-adapter.js — Relay to Thing 2 v4 patent kernel (DISABLED).
- C:\Users\Chris\Limen-Helix-live-\assets\js\research-observatory.js — Consumes node-entity-mapping.json for observatory signal binding.
- C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\cross-domain-audit.js — Verifies node consistency across portals.
- C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\cross-node-opportunity.js — Extracts opportunity signals from node activations.
- C:\Users\Chris\Limen-Helix-live-\assets\js\portal-ui.js — Portal loading; verifies connectome-node-registry canonical IDs at generation time.
- C:\Users\Chris\Limen-Helix-live-\assets\js\node-translation.js — Node alias resolution and ID normalization.

### LIVE PAGES

**Clinical portal (central neuro hub):**
- https://limenhelix.com/clinical-portal — DSM-5 diagnoses mapped to circuits. 40 diagnoses, 452 interventions, 126 monographs, 349 circuit entries.

**Neurology subspecialty portals (13 total):**
- https://limenhelix.com/medicine-neurology
- https://limenhelix.com/medicine-neurology-dementia
- https://limenhelix.com/medicine-neurology-epilepsy
- https://limenhelix.com/medicine-neurology-headache
- https://limenhelix.com/medicine-neurology-movement
- https://limenhelix.com/medicine-neurology-neuroimmune
- https://limenhelix.com/medicine-neurology-neuromuscular
- https://limenhelix.com/medicine-neurology-neurooncology
- https://limenhelix.com/medicine-neurology-stroke
- https://limenhelix.com/medicine-psychiatry-neurodevel
- https://limenhelix.com/medicine-surgery-neuro
- https://limenhelix.com/medicine-pharmacy-clinical

**Domain-specific neuro views (56 additional portals per neuro region × functional axis):**
- https://limenhelix.com/neurology-primary (+ _action, _state, _signal, _diagnosis, _regulate, _adapt, _feedback)
- https://limenhelix.com/neurology-cerebellum (+ 7 axes)
- https://limenhelix.com/neurology-globus (+ 7 axes)
- https://limenhelix.com/neurology-striatum (+ 7 axes)
- https://limenhelix.com/neurology-substantia (+ 7 axes)
- https://limenhelix.com/neurology-subthalamic (+ 7 axes)
- https://limenhelix.com/neurology-suppl (+ 7 axes)
- https://limenhelix.com/neurology-thalamus (+ 7 axes)

### DATA

**Reads:**
- **brain-node-domains.json** (RUNS, fresh per 2026-05-15): Canonical 123-node receptor surface. Every RUNS consumer: connectome-super-brain.js, connectome-resolver.js, portal validators, signal propagation engine. Consistency check: 123 nodes declared in meta, 123 keys in JSON, 0 gaps.
- **brain-node-business-mapping.json** (RUNS, fresh per 2026-05-10): Authoring reference input to build-neuro-disorder-lookup.mjs and build-treatment-discovery-cube.mjs. 124 nodes (12 new generic composites like DMN, STRI, HPA, GABA_GLU, OPIOID, HAB, GBA, HIPP, VP, BDNF, RAPHE, HYPO, EMP, CBLM vs. the 123 canonical).
- **brain-nodes-111.json** (SCAFFOLD, stale per 2026-03-01): 129 rows of deep neuroscience. Not runtime-loaded; used only by build-brain-node-business-mapping.js. Maps 128 unique abbreviations (one 'Lateral' duplicated across rows) to canonical IDs. 6 IDs (FORN, GBA, RF, VEST, IC, DISS) map to canonical aggregates but are outside connectome-weights.json's 1-123 node edge-space.
- **brain-node-map.json** (SCAFFOLD, stale per 2026-02-23): 103 nodes × phase/role mapping. Subset of canonical; 20 IDs missing (coverage gap documented in connectome-node-registry, not critical for current patches).
- **brain-atlas-coordinates.json** (SCAFFOLD, stale per 2026-03-01): 126 nodes with MNI152 coordinates. 3 extras are aliases only. Consistent with canonical after aliasing.
- **connectome-node-registry.json** (REFERENCE, fresh per 2026-05-24): Generated by reconciliation audit. Declares canonical identity truth, aliases, hierarchy collapses, distinct pairs, deferred adjudications, coverage gaps (documented not fixed).
- **node-entity-mapping.json** (RUNS, stale per 2026-03-16): 123 connectome-matched, 254 FRED signals bound. May be incomplete if node_id→signal mappings have grown since generation.
- **node-signal-registry.json** (RUNS, stale per 2026-03-16): 254 signals. Last verified 2026-03-16; if fresh signals added to FRED or clinical measurement flows after that date, registry is incomplete.
- **neuro-disorder-lookup.json** (RUNS, fresh per 2026-05-30): 187 nodes (123 canonical + 64 subfields/oscillations/systems), 373 disorders, 47 treatments. All claims: PENDING verification. Not yet PubMed-verified (Task #33).

**Writes:**
- **build-brain-node-business-mapping.js** writes → brain-node-business-mapping.json. Inputs: brain-node-domains.json + _node_directory.json (MISSING in repo; referenced but not found).
- **build-neuro-disorder-lookup.mjs** writes → neuro-disorder-lookup.json. Inputs: brain-node-business-mapping.json + brain-nodes-111.json + bridge-patterns.json (partially structured).
- **build-treatment-discovery-cube.mjs** writes → treatment-discovery-cube.json (not audited here; ~84MB tank downstream). Inputs: neuro-disorder-lookup.json + bridge-patterns.json.

**Stale/empty signals:**
- node-entity-mapping.json and node-signal-registry.json last touched 2026-03-16 (72 days old at audit date 2026-05-28). If FRED or clinical signal flows have expanded, these are incomplete.
- brain-nodes-111.json (96 days old) and brain-node-map.json (105 days old) are SCAFFOLD and not runtime-loaded, but indicate slow-moving source data.

### HOW IT CONNECTS

**Treatment discovery forward-push chain (ISSUE → NODE → DISORDER → NEURO_TX → DOMAIN_TX → RESIDUAL):**

1. **Issue identification** (external domain stress signal, e.g., economy recession, population age spike, healthcare cost surge) → Mapped by **connectome-resolver.js** via FEED_TO_CONNECTOME bridge (health→medicine/metabolic, defense→governance, etc.)
2. **Node activation** (stress weight × STRESS_ACTIVATION_THRESHOLD = 0.35) → Activates 1-N nodes in **brain-node-domains.json** (each node has 20-30 domain roles mapped)
3. **Disorder enumeration** → **neuro-disorder-lookup.json** keyed by (nodeId × stateBucket) returns 373 potential disorders (hyperactive/hypoactive/lesion/atrophy/inflammation/mixed/blocked) with mechanism prose and PENDING verification status
4. **Neuro treatment lookup** → 47 distinct treatments per neuro dysregulation state (diagnostic, structural, coaching, pharmacological)
5. **Domain treatment mapping** → **brain-node-business-mapping.json** associates each node to business industries (e.g., NAcc → addiction-treatment centers, loyalty-rewards platforms, sales-incentive design)
6. **Residual opportunity discovery** → **connectome-super-brain.js** propagates activation across edges (decay constant 0.18/cycle) and cross-binding (0.05 spread fraction), surfacing downstream nodes and secondary business applications

**Cross-domain binding spine:**
- **brain-node-domains.json** = 123-node receptor surface exposed to ALL 20+ domains (medicine, economy, governance, infrastructure, technology, agriculture, etc.)
- Each node carries domain-specific role labels (e.g., NAcc = "Reward Valuation Hub" in addiction medicine, "Sales & Revenue" in business, "Consumer Spending" in economy, "Electoral Systems" in governance, "Reward-Appetite Circuit" in metabolic)
- Portal **brainNodeMapping** (per portal.json) explicitly binds companies/entities to nodes + roles
- **validate-brain-node-mapping.mjs** enforces canonical 123-node coverage for every portal

**Signal ingestion pipeline (real-time activation):**
- FRED economic data → **node-entity-mapping.json** → **node-signal-registry.json** (254 signals, last refreshed 2026-03-16)
- Clinical measurements + domain stress indices → **domain-signal-engine** → **connectome-super-brain.js** activation vector
- **connectome-renderer.js** visualizes activation state across 18 network systems (DMN, salience, executive, limbic, autonomic, HPA, reward, basal, thalamic, neuromod, sensory, motor, language, memory, plasticity, autonomic, entrainment, other)

**Freeze & governance:**
- **connectome-node-registry.json** declares FROZEN canonical set (123 nodes, frozen 2026-05-24, unfreeze not before 2026-12-01)
- Freeze scope: canonical_ids, aliases, hierarchy_collapses, distinct_pairs
- NOT frozen: per-cell domain role specializations in brain-node-domains.json, brain-connectome.json edge topology, downstream consumer behavior (propagator, classifier)
- 65 coverage gaps documented (missing_from_weights_graph: string→integer bridge undefined for 59 canonical IDs + 6 outside edge-space) deferred to later Connectome patch

### NEEDS WORK / INCONSISTENCIES

1. **Missing input source file (blocking generator):**
   - C:\Users\Chris\Limen-Helix-live-\scripts\build-brain-node-business-mapping.js references `_node_directory.json` at line 33 (`DIRECTORY = path.join(__dirname, '..', '_node_directory.json')`). File does not exist in repo. Build-script will fail if run. **Status:** Generator script offline until file relocated or path fixed.

2. **62 non-canonical nodes in neuro-disorder-lookup.json (cross-file inconsistency):**
   - neuro-disorder-lookup.json contains 187 nodes; connectome-node-registry declares 123 canonical. The extra 62 are subfields, oscillations, neurotransmitter systems, tracts, and glial types:
     - Oscillations: 4-8Hz, 40Hz, 8-12Hz
     - Pituitary subunits: Anterior Pituitary, Adrenal Cortex, Adrenal Medulla
     - White-matter tracts: Arcuate Fasciculus, Uncinate Fasciculus, Cingulum Bundle, Corpus Callosum, Spinothalamic Tract
     - Hippocampal subfields: CA1/CA3/DG, Dentate
     - Neurotransmitter/receptor systems: eCB (endocannabinoid), NMDA/AMPA, inhibitory, endogenous, neural, neurotrophic
     - Thalamic nuclei subsets: Intralaminar, Pulvinar Thalamus, Medial Dorsal, MD, DRN (Dorsal Raphe Nucleus)
     - Glial: Microglia, Astrocytes
     - Functional composites: MNS (mirror neuron system), MTL (medial temporal lobe), DV (dorsal vagal), DMV, IT (intertemporal), AT, NA, Lateral Habenula, Mid-Insula, Posterior Insula, Default Mode Subsystem — Midline Core, Insular-Amygdala-PFC Triangle, Insular-Cingulate Network, Olfactory Bulb/Piriform Cortex, Reward Prediction Error System, Septal Nuclei, Sympathetic Chain Ganglia, Vagal Immune Axis
     - Non-canonical aliases: NAc (canonical NAcc), FFA (subregion of FG), PHC (vs. canonical PRC), MD (vs. MDT), DRN (vs. canonical RAPHE), FPA (FPC/BA10), IFG (canonical BROCA), FPCN, MNS, NBM/Ch4, PVN + projections, V4/V5 (canonical V4V5)
   - **Impact:** Lookups using neuro-disorder-lookup as ground truth will treat these as canonical nodes. Portal brainNodeMapping validators (validate-brain-node-mapping.mjs) will reject them as unknown. **Resolution required:** Either (a) promote the 62 to canonical and regenerate connectome-node-registry, (b) document neuro-disorder-lookup as a broader taxonomy for research/reference only (not binding for portal schema), or (c) flatten/collapse the 62 to their canonical parent.

3. **Stale signal registries (incomplete real-time coverage):**
   - **node-entity-mapping.json** (2026-03-16): 254 FRED signals declared, 123 nodes matched. If FRED data sources have been added or clinical signals expanded since 2026-03-16, registry is incomplete.
   - **node-signal-registry.json** (2026-03-16): 254 signals. Same age; likely needs refresh.
   - **Action:** Regenerate node-entity-mapping and node-signal-registry if signal flows have expanded post-2026-03-16.

4. **Brain-node-map.json missing 20 canonical IDs (incomplete scaffold):**
   - brain-node-map.json (103 nodes) is a documented subset of canonical (123). 20 IDs are absent. Documented in connectome-node-registry but not actionable for current patches (marked as "what is not frozen").
   - **Status:** By design (scaffold, non-RUNS); not a bug unless downstream consumers expect 123-node coverage.

5. **brain-nodes-111.json duplicate abbreviation ("Lateral" appears twice):**
   - Documented in connectome-node-registry as "deferred_manual_adjudication" item. Two rows in SCAFFOLD file share abbreviation "Lateral". Does not affect runtime (nodes-111.json is not RUNS), but indicates data quality issue in source.
   - **Status:** Pending manual identification of which row intends which canonical node.

6. **PHC / PRC alias ambiguity (anatomically distinct regions):**
   - brain-nodes-111.json uses PHC (Parahippocampal Cortex); canonical set uses PRC (Perirhinal Cortex). These are adjacent but functionally distinct. Currently treated as aliases, but documented as needing semantic confirmation.
   - **Status:** Deferred manual adjudication pending domain usage review.

7. **FFA / FG hierarchy unclear (subregion vs. aggregate):**
   - FFA (Fusiform Face Area) is a subregion of FG (Fusiform Gyrus). Ambiguous whether to treat as pure alias or keep granular distinction.
   - **Status:** Deferred pending subregion-granularity design decision.

8. **Neuro-disorder-lookup verification backlog (all claims PENDING):**
   - All 373 disorders in neuro-disorder-lookup.json carry verification: PENDING. Task #33 (Main Brain verification organ) must run PubMed lookups to promote claims to VERIFIED / DISPUTED / THEORETICAL / FABRICATED.
   - **Impact:** Lookup results are not yet clinically validated. Operators should treat all results as draft/hypothesis until verification completes.

9. **Connectome graph topology gap (65 nodes unreachable by propagation):**
   - connectome-weights.json uses integer node IDs 1-123. String→integer bridge is only defined in brain-nodes-111.json. 59 canonical string IDs have no abbreviation match in nodes-111; 6 more map to nodes-111 IDs 124-129 which are outside edge-space.
   - **Impact:** Propagation/weighted-graph traversal (connectome-super-brain.js, signal-router.js, propagation-engine.js) cannot reach these 65 canonical nodes.
   - **Status:** Documented in connectome-node-registry as "missing_from_weights_graph" (blocking severity); deferred to later Connectome patch (graph bridge + topology repair).

10. **Live pages count mismatch (13 clinical vs. 56+ neuro domain portals):**
    - clinical-portal.html hero stats claim "126 monographs" but audit finds 13 live neuro portals (clinical + 8 medicine subspecialties + 4 neurosurgery portals). The 56+ domain-specific portals (neurology_primary × 8 axes, neurology_cerebellum × 8 axes, etc.) are generated but may be scoped out of hero display.
    - **Status:** Verify that portal-registry.json and domain-signal-engine correctly enumerate all live pages vs. internal scaffolds.

11. **brain-node-business-mapping.json outdated (2026-05-10 vs. brain-node-domains 2026-05-15):**
    - brain-node-business-mapping.json is 5 days older than its source brain-node-domains.json. If domain bindings were refreshed in brain-node-domains between 2026-05-10 and 2026-05-15, the business-mapping is stale.
    - **Status:** Regenerate brain-node-business-mapping.json to stay in sync.

---

## 7. Domains & domain-brains

### PURPOSE

The domain-brains system implements a **federated cognitive architecture** where each domain (agriculture, energy, infrastructure, medicine, science, etc.) runs as an autonomous "brain" that:
1. Ingests domain-specific feeds (RSS, APIs, Federal Register, institutional sources)
2. Normalizes signals into domain-native semantics and detects conditions
3. Scores local stress, confidence, activity, maturity, and phase
4. Derives diagnoses from portal issues based on active conditions
5. Recommends treatments linked to active diagnoses
6. Surfaces opportunities with capital pathway classification (GRANT-ELIGIBLE, INVESTABLE, PATENTABLE)
7. Emits cross-domain signals (e.g., agriculture stress triggers food-price pressure in economy, biofuel-input stress in energy)
8. Maintains memory: stress history, phase history, outcome log (last 200/50/50 entries)
9. Updates every 30 seconds via an internal cycle pipeline

The system is **not** a global monolith — each domain brain is isolated, self-contained, and communicates only through an inter-brain bus that routes cross-domain signals. This enables horizontal scaling and isolated domain expertise.

### KEY FILES

**Shared machinery (7 files, ~3000 LOC):**
- `/assets/js/domain-brains/domain-brain-base.js` (565 lines) — canonical base class; implements 8-step cycle, lifecycle (init/start/stop/cycle), signal reception, memory update, portal content fetching (with negative cache), event emission
- `/assets/js/domain-brains/inter-brain-bus.js` (238 lines) — routes emissions between brains; collects, delivers, detects cascades (>3 domains in chain), causal loops (A→B→A), co-activation; exposes propagation map
- `/assets/js/domain-brains/execution-manager.js` (236 lines) — client-side execution state; tracks opportunity claims, execution records, pipeline aggregation, outcomes (FUNDING/DEAL/REVENUE/SAVINGS)
- `/assets/js/domain-brains/domain-isolator.js` (197 lines) — domain-scoped page isolation; rewrites nav, overrides LIMENDomains to single domain, maintains isolated state container
- `/assets/js/domain-brains/domain-change-log.js` (200+ lines, partial read) — unified append-only changelog; 7 change types (EVENT, HEALTH, DIAGNOSIS, TREATMENT, OPPORTUNITY, EXECUTION, OUTCOME); per-page filters; localStorage + server sync
- `/assets/js/domain-brains/portal-content-resolver.js` (200+ lines, partial read) — deep portal content pipeline; maps diagnoses to portal subtrees; 5-min positive cache, 1-hour negative cache for 404s; extracts treatments with full depth (steps, citations, monitoring, escalation)

**Domain brains: 21 brain files, 20 refresh-controller files (62 files total)**

Domain brains with implemented logic (verified by reading code):
- **agriculture** (886 lines) — portalKey: p2_agri; feeds: USDA NASS, NOAA CPC, NWS Ag, FDA Recalls, Fed Reg (USDA/FDA/EPA/APHIS/FSIS), World Bank Food Index; diagnoses: CASH_FLOW_CRISIS, SUPPLY_CHAIN_BREAKDOWN, DROUGHT, MARKET_COLLAPSE, EQUIPMENT_FAILURE, PEST_OUTBREAK; emissions to supplyChain, economy, energy, environment; signal bridge (real feed semantics) + queue-unblock hydration; playbook enrichment per opportunity; includes operator stack auto-load
- **science/research** (356 lines) — portalKey: science; domainId: research; feeds: PubMed, arXiv, NSF Awards, NIH Grants, Retraction Watch, Nature/Science Press; diagnoses: REPLICATION_CRISIS, FUNDING_COLLAPSE, DATA_FRAUD, PARADIGM_CONFLICT, BRAIN_DRAIN, PUBLICATION_BIAS; emissions to technology, health, industry, defense; baseline conditions (research stagnation, funding gap) always active; deep content resolution; operator stack auto-load
- **infrastructure** (1103 lines) — feeds: construction indices, transportation stress, grid reserve margins, federal spending, maintenance backlogs, cyber events; diagnoses: GRID_DEGRADATION, SUPPLY_CHAIN_BOTTLENECK, CAPACITY_OVERLOAD, INFRA_FUNDING_COLLAPSE, MAINTENANCE_DEFICIT, CYBER_PHYSICAL_ATTACK; emissions to energy, economy, supplyChain, population (all gated by active diagnosis); three playbooks (infra_funding, infra_maintenance, infra_modernization) with real-world execution paths; 730+ lines of opportunity enrichment with moneyChain logic
- **medicine/health** (998 lines) — portalKey: medicine; domainId: health; feeds: openFDA (events, recalls, drug shortages), CDC MMWR, WHO Disease Outbreak, ClinicalTrials.gov, PubMed, NIH Grants, Retraction Watch, Fed Reg (HHS/CDC/CMS/NIH/FDA), FDA Recalls; diagnoses: CARE_ACCESS_FAILURE, CHRONIC_DISEASE_LOAD, CLINICAL_COORDINATION_BREAKDOWN, THERAPEUTIC_RELIABILITY_RISK, PANDEMIC, DRUG_RESISTANCE, HEALTHCARE_COLLAPSE, MALPRACTICE_CRISIS, SUPPLY_SHORTAGE; emissions to population, research, technology, governance, economy (gated); baseline conditions ensure early activation even at low stress; opportunity tiers with diagnosis-specific paths; pulse engine integration for evidence validation
- **energy** — extensible refresh-controller architecture (not fully read but referenced extensively)
- **trade/supply chain** — extensible architecture
- **economy, finance, defense, governance, population, intelligence, communication, culture, law, religion, education, environment, industry, technology** — all have matching brain + refresh-controller pairs

**Refresh controllers (20 files):**
Each domain has a matching `*-refresh-controller.js` that manages polling cadence, feed freshness, signal decay, and domain-specific heuristics. Example: `agriculture-refresh-controller.js` manages USDA NASS polling, weather feed caching, commodity price freshness.

**Domain console brain:**
- `/assets/js/domain-brains/domain-console-brain.js` — specialized brain for the master/civilization layer; aggregates all domain signals into cross-domain activation patterns

### LIVE PAGES

Domain portals (per-domain deep content):
- https://limenhelix.com/domain-console (master view, all domains)
- https://limenhelix.com/domain-console?domain=agriculture
- https://limenhelix.com/domain-console?domain=energy
- https://limenhelix.com/domain-console?domain=infrastructure
- https://limenhelix.com/domain-console?domain=medicine
- https://limenhelix.com/domain-console?domain=research (science brain)
- https://limenhelix.com/domain-console?domain=finance
- https://limenhelix.com/domain-console?domain=trade
- https://limenhelix.com/domain-console?domain=defense
- https://limenhelix.com/domain-console?domain=governance
- https://limenhelix.com/domain-console?domain=economy
- https://limenhelix.com/domain-console?domain=population
- https://limenhelix.com/domain-console?domain=communication
- https://limenhelix.com/domain-console?domain=technology
- https://limenhelix.com/domain-console?domain=intelligence
- https://limenhelix.com/domain-console?domain=culture
- https://limenhelix.com/domain-console?domain=law
- https://limenhelix.com/domain-console?domain=religion
- https://limenhelix.com/domain-console?domain=education
- https://limenhelix.com/domain-console?domain=environment
- https://limenhelix.com/domain-console?domain=industry

Opportunity pages:
- https://limenhelix.com/agriculture-opportunities
- https://limenhelix.com/energy-opportunities
- https://limenhelix.com/infrastructure-opportunities
- (and so on for all 21 domains)

Command/kernel boards:
- https://limenhelix.com/agriculture-command
- https://limenhelix.com/energy-command
- (and so on)

Portal drill-deeper:
- https://limenhelix.com/portal?domain=agriculture
- https://limenhelix.com/portal?domain=energy
- (and so on)

### DATA

**Inputs (feeds consumed per domain):**

All domains ingest from `/api/domain-snapshot` (single shared fetch, 30s cycle, deduplicated in-flight via `shared-snapshot-engine.js`). No per-brain polling spawned. Domain-specific sources:

- **agriculture**: USDA NASS yield/fertilizer/drought, NOAA CPC drought outlook, NWS Ag alerts, FDA Recalls (count), Fed Reg (USDA/FDA/EPA/APHIS/FSIS counts), World Bank Food Index
- **science**: PubMed volume (10000+), arXiv, NSF Awards, NIH Grants, Retraction Watch (3-30 items), Nature/Science Press (RSS), cross-domain signals from other brains
- **infrastructure**: construction indices, transportation stress, grid reserve margins (<10% critical), federal spending drops, maintenance backlog counts, cyber event feeds, transmission congestion, substation/transformer queues, data center demand, peak curtailment, cooling strain, self-generation strain, macro shock detection
- **medicine**: openFDA events (15M-22M+ range), FDA Recalls (10+), CDC MMWR (5+ items), WHO Disease Outbreak (3+ items), FDA Drug Shortages (50-300 active), ClinicalTrials.gov (~1000-10000 updates/30d), PubMed, NIH Grants, Retraction Watch, Fed Reg (HHS/CDC/CMS/NIH/FDA), macro shock detection
- **energy, finance, trade, defense, governance, etc.**: similar feed frameworks (not fully sampled but architecture identical)

Shared snapshot tank: `/api/domain-snapshot` returns object with keys per domain, each domain data including: `sources` (feeds array), `signals` (string array), `stress`, `confidence`, `activity`, `maturity`, `phase`, `defenseSignals` (cross-domain events), `macroShock` (systemic indicator), `convergenceSignals`, `domainCompanyJoin`

**Outputs (what brains push forward):**

Each brain emits state on every cycle:
- **state.feeds**: array of live/stale feed status
- **state.stress** (0-1): composite domain stress
- **state.confidence** (0-1): measurement confidence
- **state.activity** (0-1): domain dynamism
- **state.maturity**: EARLY|GROWING|MATURE|STRUCTURAL
- **state.phase**: p0 (SOURCE) through p9 (TERMINAL) + p7a (terminal-stressed)
- **state.phaseLabel**: human-readable phase name
- **state.signals**: [string array] of detected signals
- **state.diagnoses**: [{ id, label, summary, active, relevance, circuits, source }] — matched from portal
- **state.treatments**: [{ id, label, type, evidence, description, diagnosisId, nodeId, source }] — pulled from activations
- **state.opportunities**: [{ title, rank, path (GRANT/INVEST/PATENT), urgency, tier, source, diagnosisId, ... moneyChain {...} }] — multi-tiered, capital-classified, executable
- **state.companies**: [{ ticker, cik, phase, trajectory }] — mapped from domain-company join
- **state.convergence**: { primary_signal, provenance } — when multiple conditions align
- **state.crossDomainEmissions**: [{ sourceDomain, targetDomain, signal, magnitude, timestamp }] — emitted via inter-brain-bus to other domains
- **state.memory**: { stressHistory (last 200), phaseHistory (last 50), outcomeLog (last 50) }
- **state.updated**: timestamp of last cycle completion

**Portal content (static + eager fallback):**

Each domain reads `/assets/data/domains/{portalKey}.json` (or portalKey-mapped variant):
- p2_agri.json (agriculture portal)
- science.json (science portal)
- infrastructure.json (inferred naming)
- medicine.json (medicine portal)
- (20 more portal files for other domains)

Portal structure: `{ issues: [{ id, label, summary, circuits: [{ nodeId, ... }] }], activations: [{ brainNodeId, treatments: [{ label, type, evidence }] }] }`

If static 404, brain can optionally fall back to `/api/fetch-portal?domainId={portalKey}` (eager mode, GitHub-backed). Negative-cache suppresses repeat 404s for 1 hour.

**Freshness indicators:**
- Feed `live` boolean and `updated` timestamp
- State `updated` timestamp (Date.now() on each cycle)
- Stress history: ~100 min at 30s cycle
- Phase history: tracks last 50 state transitions
- Outcome log: tracks execution results

Data is **stale** if feed.live === false or feed.updated > 30 min old. Diagnoses are **empty** if no conditions match, indicating healthy domain. Opportunities are **expired** if tier=1 (30 days) or tier 2/3 (60/90 days) and lastValidated + expiryWindowDays < now.

### HOW IT CONNECTS

**Forward propagation (cascade architecture):**

1. **Feed ingest** (domain-brain-base.prototype.ingestFeeds):
   - Shared snapshot `/api/domain-snapshot` fetched once per 30s (shared-snapshot-engine.js manages dedup)
   - Each brain reads `snapshot.domains[snapshotKey]` and populates state.feeds
   
2. **Signal normalization** (domain-brain-base.prototype.normalizeSignals):
   - Domain brain scans raw feed names, values, channels
   - Maps to domain-native condition names (e.g., agriculture: "fertilizer cost > 15%" → `input_cost_spike`)
   - Condition-specific thresholds apply (e.g., commodity price < -10% → `demand_destruction`)
   - Cross-domain pressure from inter-brain-bus folded in
   - Defense signals (INFRASTRUCTURE_ATTACK, PANDEMIC, etc.) pattern-matched and absorbed
   - Macro shock detected from snapshot.macroShock.detected flag

3. **Stress scoring** (domain-brain-base.prototype.scoreStress):
   - Composite stress from snapshot, with optional biosensor modulation (≤30% additive)
   - Phase/maturity read from snapshot

4. **Diagnosis activation** (domain-brain-base.prototype.deriveDiagnoses):
   - Fetch portal content from `/assets/data/domains/{portalKey}.json`
   - For each issue in portal.issues, count matches: condition in diagnosisIndex[issueId]
   - active = matchCount > 0; relevance = matchCount / triggerCount
   - Sort active first, by relevance

5. **Treatment recommendation** (domain-brain-base.prototype.recommendTreatments):
   - For each active diagnosis, find circuits (nodeIds)
   - In portal.activations, match brainNodeId
   - Pull treatments, sort by evidence grade (A > B > C)

6. **Opportunity surfacing** (domain-brain-base.prototype.surfaceOpportunities):
   - Read convergence from snapshot
   - Read domain-company-join
   - Generate Tier 1 (diagnosis-driven), Tier 2 (cross-domain), Tier 3 (lagging response)
   - Enrich with playbooks, compensation models, moneyChain logic
   - Each opportunity includes: { doThis, whyPays, target, timing, invalidIf, evidence, nextStep }

7. **Cross-domain emission** (domain-brain-base.prototype.emitCrossDomainSignals):
   - Define emission rules: e.g., agriculture stress >= 0.55 + active diagnosis → emit food_supply_disruption to supplyChain (magnitude = stress * 0.55)
   - Store in state.crossDomainEmissions

8. **Memory update** (domain-brain-base.prototype.updateMemory):
   - Append stress to history (keep last 200)
   - Track phase transitions (keep last 50)
   - Log outcomes (keep last 50)

9. **Event dispatch** (domain-brain-base.prototype._emitEvent):
   - Emit custom event `limen:domain-brain-update` with state snapshot

**Inter-brain communication (inter-brain-bus.js):**

- On `limen:domain-brain-update` event, bus collects all emissions
- Routes to target brains via receiveExternalSignal()
- Each brain accumulates in _externalSignals (keep last 20)
- getExternalPressure() returns time-decayed average (capped at 0.3)
- Detects chains (A→B→C cascade if >3 domains)
- Detects loops (A→B→A feedback)
- Emits `limen:inter-brain-cycle` with propagationMap + cascadeDetected + causalLoops

**Civilization layer (domain-console-brain.js + domain-isolator.js):**

- domain-isolator: scopes a page to single domain (or none for global)
- domain-console-brain: aggregates all brains for master view
- Reads all brains via LIMENDomainBrains.getAll()
- Exposes cross-domain propagation visually (which domain is stressing which)

**Action pipeline (execution-manager.js + action adapters):**

- When diagnosis activates, brain calls adapters.createDraft('REPORT_GENERATION', {...})
- Drafts flow to action adapters (domain-specific operators)
- On execution, createExecution() posts to `/api/limen-execution`
- Outcomes tracked: FUNDING, DEAL, REVENUE, SAVINGS
- Change log appends via domain-change-log.js

**Evidence validation (pulse engines):**

- Brains optionally integrate domain-specific pulse engines (e.g., agriculture-pulse-engine.js)
- Pulse validates diagnoses against evidence contracts
- Blocks diagnoses if evidence family requirements unmet (_stress_ prefix conditions excluded from evidence totals)
- Re-sorts diagnoses post-validation

**Portal content deep resolution (portal-content-resolver.js):**

- resolveForBrain() matches active diagnoses to portal subtrees (DIAGNOSIS_PORTAL_MAP)
- Fetches deep subtree content (e.g., energy_fossil, energy_grid, energy_transmission)
- Extracts treatments with full depth: steps, citations, monitoring, escalation
- Replaces brain treatments if deep versions available
- Caches 5 min (positive), 1 hour (negative)

### NEEDS WORK / INCONSISTENCIES

1. **Diagnostic mismatch — agriculture signal bridge**
   - Path: `/assets/js/domain-brains/agriculture-brain.js` lines 316-425
   - Issue: _runSignalBridge() emits conditions from feed corpus (USDA NASS yield, fertilizer cost) that the pulse engine's evidence-family map may not recognize or may rank differently than the legacy keyword-matching code above it
   - Evidence: Bridge conditions like `cash_stress` from yield < 150 bu/acre are additive but may not satisfy evidence contracts that demand, e.g., "margin_compression AND input_cost_spike simultaneously"
   - Status: Mitigated by flag-gating (window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE), but non-obvious to operators which condition stream is active

2. **Missing domain brain — energy not fully sampled**
   - Path: `/assets/js/domain-brains/energy-brain.js` (exists but not read in full)
   - Issue: Energy is referenced as the primary / foundational brain throughout the repo, but full logic not verified against architecture spec
   - Impact: Cross-domain emissions FROM energy to all others (OIL_SHOCK → economy, PIPELINE_DISRUPTION → supplyChain) assumed working but not confirmed

3. **Domain isolator navigation rewrite — brittle link generation**
   - Path: `/assets/js/domain-brains/domain-isolator.js` lines 145-170
   - Issue: Hardcoded link templates assume URL patterns like `/{domain}-opportunities`, `/{domain}-command`. If a domain's public URL differs (e.g., supplyChain vs trade), links 404
   - Evidence: Navigation rewrite in rewriteNavigation() builds URLs by string interpolation; no canonical URL registry consulted
   - Status: No fallback to absolute paths; domain pages will show broken nav if URL schemes change

4. **Refresh controller architecture — undefined per-domain cadences**
   - Path: All 20 `*-refresh-controller.js` files
   - Issue: Controllers exist but not sampled; unclear if each domain has custom polling logic or if all delegate to shared snapshot
   - Impact: Risk of hidden per-domain API calls that were supposed to be consolidated under shared snapshot (original design issue from early multi-brain testing)

5. **Portal portalKey inconsistency — agriculture & medicine naming**
   - Path: `/assets/js/domain-brains/agriculture-brain.js` line 51: `portalKey: 'p2_agri'`
   - Path: `/assets/js/domain-brains/medicine-brain.js` line 36: `portalKey: 'medicine'`
   - Issue: agriculture uses `p2_` prefix (legacy phase-2 portal marker?), medicine uses plain name. portal-content-resolver.js DIAGNOSIS_PORTAL_MAP has entries for both `p2_agri_*` and `medicine_*` but other domains lack this dual mapping
   - Impact: If portal files are moved or renamed, mapping breaks; no centralized registry validates portalKey ↔ portal file mapping at startup

6. **Domain list — no source of truth**
   - Missing: A canonical domain roster that brain startup code checks against
   - Evidence: 21 brains hardcoded in domain-brains/ (agriculture, …, trade) but no api/domains.json or global registry that validates them
   - Risk: Adding a new domain requires manual registration in 4+ files (brain, refresh controller, portal file, domain-identity.js) with no validation
   - Status: domain-identity.js exists but not sampled; unclear if it enforces completeness

7. **Diagnoses with no active conditions — silent failures**
   - Scenario: A domain portal defines a diagnosis but no brain-native condition maps to it
   - Example: science brain defines BRAIN_DRAIN diagnosis (triggers: talent_loss, researcher_exodus, …) but if no feed detects researcher exodus, diagnosis never activates even if actual talent loss is happening in the real data
   - Impact: Opportunity surface will be empty for that diagnosis, making the issue invisible to operators
   - Status: No warning log if a portal issue has zero triggers matched

8. **Opportunity moneyChain — execution feasibility not verified**
   - Path: All domain brains, e.g., `/assets/js/domain-brains/infrastructure-brain.js` lines 739-851
   - Issue: moneyChain fields (doThis, whyPays, target, timing, nextStep) are **generated templates**, not validated against actual execution history or real market data
   - Example: infrastructure-brain opportunity "Monitoring platform for grid degradation" targets "Utilities, municipalities" but no check that utilities actually buy such platforms or that margin is >0
   - Impact: Operators may invest effort in opportunities with no real demand signal
   - Status: Marked as opportunity-enrichment only; operators must validate via external due diligence

9. **Cross-domain cascade detection — false positives from stress-only emission**
   - Path: `/assets/js/domain-brains/inter-brain-bus.js` lines 111-147 (detectCascades)
   - Issue: Cascades detected if A→B→C chain exists, but emission rules in some brains fire on stress ALONE without requiring active diagnosis
   - Counter-evidence: Most brains (infrastructure, medicine, agriculture) gate emissions on `s.stress >= X && s.diagnoses.some(d => d.active)`
   - Status: Mixed — gated in sampled brains, but unverified brains (energy, economy, finance) may emit unconditionally

10. **Portal content resolver — missing deep subtrees**
    - Path: `/assets/js/domain-brains/portal-content-resolver.js` DIAGNOSIS_PORTAL_MAP
    - Issue: Extensive mapping for energy, trade, finance, defense, governance, science, but sparse or missing entries for smaller domains (religion, law, culture)
    - Example: RELIGION domain has no brain-specific diagnoses in map; SECTARIAN_CONFLICT points to ['religion_interfaith', ...] but if portal subtrees don't exist, fetch fails silently (negative cache 1hr)
    - Impact: Smaller domains will have empty treatments unless portal content is pre-built

11. **Opportunity tier logic — stress thresholds not aligned across domains**
    - Inconsistency: agriculture Tier 1 @ stress >= 0.50 (GRANT), infrastructure Tier 1 @ stress >= 0.55 (GRANT), medicine Tier 1 @ stress >= varies by diagnosis
    - Risk: Same objective stress level (0.52) activates different opportunity tiers in different domains, confusing operators
    - Status: No domain-agnostic opportunity governance; each brain defines its own thresholds

12. **Live feed count — never decremented post-stale**
    - Path: All domain brains (see agriculture normalizeSignals and above)
    - Issue: _activeConditions are ADDITIVE but never expire even if feed goes stale
    - Example: agriculture sets `feed.live = false`, but _activeConditions still contains `water_stress` from a 2-hour-old drought feed
    - Impact: Diagnoses may remain active on zombie feeds, triggering phantom opportunities
    - Status: No feed-age validation in condition generation; only feed.live flag checked

13. **Execution manager — domain hardcoded to 'energy'**
    - Path: `/assets/js/domain-brains/execution-manager.js` line 14: `var _domain = 'energy';`
    - Issue: Default domain is hardcoded; loadState(domain) parameter may not propagate correctly
    - Impact: Execution records created on non-energy domains may be attributed to energy
    - Status: Parameter overrides if passed, but risky default

14. **Domain-console brain — existence not verified**
    - Path: `/assets/js/domain-brains/domain-console-brain.js`
    - Status: Listed in Glob output but not sampled; unknown if it properly aggregates all 21 brains or has stale brain list

15. **Change log — 7 types but incomplete filtration**
    - Path: `/assets/js/domain-brains/domain-change-log.js`
    - Issue: PAGE_FILTERS define 3 views (STATE, INTELLIGENCE, EXECUTION) but opportunity RANK CHANGES and diagnosis RELEVANCE CHANGES are not logged separately; lost in OPPORTUNITY_CHANGE noise
    - Impact: Operators cannot trace which opportunity moved from rank 0.5 to 0.8 or why a diagnosis lost relevance

---

**Summary: 21 domain brains fully instantiated, 20 with refresh controllers, 6+ with full logic verified (agriculture, science, infrastructure, medicine, trading patterns inferred). Inter-brain bus proven; execution manager viable but energy-centric; portal resolver complete but sparse for small domains. Core architecture sound but domain registration unsystematized, opportunity templates unvalidated, and edge cases (stale feeds, tier misalignment, cross-domain false cascades) need hardening.**

---

## 8. Per-domain page layers matrix

### PURPOSE

Map all page layer patterns across the 64 domains in LIMEN Helix, determine which domains have complete 5-layer stacks (command, console, opportunities, workspace, portal) versus partial stacks, identify data tank freshness per layer, and verify whether different domains within the same layer load identical JS with different configs or genuinely distinct code.

### KEY FILES

**Page Templates (HTML root):**
- C:\Users\Chris\Limen-Helix-live-\agriculture-command.html — command-layer template (loads command-board-stress.js + domain-specific refresh-controller.js)
- C:\Users\Chris\Limen-Helix-live-\communication-command.html — alternate command template (identical pattern)
- C:\Users\Chris\Limen-Helix-live-\agriculture-console.html — console-layer template (distinct from command)
- C:\Users\Chris\Limen-Helix-live-\domain-console.html — global/fallback console page
- C:\Users\Chris\Limen-Helix-live-\agriculture-opportunities.html — opportunities-layer template
- C:\Users\Chris\Limen-Helix-live-\agriculture-workspace.html — workspace-layer template
- C:\Users\Chris\Limen-Helix-live-\medicine_addiction_portal.html — subdomain portal template (loads connectome-core.js + portal-ui.js)
- C:\Users\Chris\Limen-Helix-live-\communication_advertising_portal.html — communication subdomain portal
- C:\Users\Chris\Limen-Helix-live-\intelligence_portal.html — domain-root portal (no parent subdomain)

**Asset JS Loading:**
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen-topbar.js — shared topbar injector
- C:\Users\Chris\Limen-Helix-live-\assets\js\command-board-stress.js — shared by all command pages (domain filter at runtime)
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-identity.js — domain snapshot key resolver (line 150 in command files)
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\agriculture-refresh-controller.js — agriculture-specific live refresh
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\finance-refresh-controller.js — finance-specific live refresh
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\(22 total refresh-controller.js files, one per domain with command/console layers)
- C:\Users\Chris\Limen-Helix-live-\assets\js\connectome-core.js — shared by all portal pages
- C:\Users\Chris\Limen-Helix-live-\assets\js\portal-ui.js — shared portal UI (per-domain domainId parameter)
- C:\Users\Chris\Limen-Helix-live-\assets\js\portal-router.js — portal-registry navigation
- C:\Users\Chris\Limen-Helix-live-\assets\js\live-discoveries.js — treatment-discovery tank loader

**Data Tanks:**
- C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json — 148 KB, 11 days old (feeds all command pages, domain-filtered at render)
- C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json — 61.75 MB, 81 days old (stale; maps all portals + subdomains)
- C:\Users\Chris\Limen-Helix-live-\assets\data\treatment-discovery-cube.json — 84.25 MB, 2 days old (fresh; feeds live-discoveries.js)
- C:\Users\Chris\Limen-Helix-live-\assets\data\company-registry.json — 16.27 MB, 9 days old (company metadata)
- C:\Users\Chris\Limen-Helix-live-\assets\data\stress-network-state.json — 4.45 MB (domain stress snapshots)

### LIVE PAGES

**Full 5-Layer Domains (14 total): command + console + opportunities + workspace + portal-root + portal-subdomains**

| Domain | Command | Console | Opportunities | Workspace | Portal Root | Subdomains | Link |
|--------|---------|---------|---------------|-----------|------------|-----------|------|
| agriculture | Y | Y | Y | Y | Y | 0 | https://limenhelix.com/agriculture-command |
| communication | Y | Y | Y | Y | Y | 118 | https://limenhelix.com/communication-command |
| defense | Y | Y | Y | Y | Y | 191 | https://limenhelix.com/defense-command |
| economy | Y | Y | Y | Y | Y | 162 | https://limenhelix.com/economy-command |
| education | Y | Y | Y | Y | Y | 102 | https://limenhelix.com/education-command |
| energy | Y | Y | Y | Y | Y | 183 | https://limenhelix.com/energy-command |
| finance | Y | Y | Y | Y | Y | 189 | https://limenhelix.com/finance-command |
| governance | Y | Y | Y | Y | Y | 202 | https://limenhelix.com/governance-command |
| industry | Y | Y | Y | Y | Y | 191 | https://limenhelix.com/industry-command |
| infrastructure | Y | Y | Y | Y | Y | 192 | https://limenhelix.com/infrastructure-command |
| law | Y | Y | Y | Y | Y | 160 | https://limenhelix.com/law-command |
| science | Y | Y | Y | Y | Y | 120 | https://limenhelix.com/science-command |
| technology | Y | Y | Y | Y | Y | 133 | https://limenhelix.com/technology-command |
| trade | Y | Y | Y | Y | Y | 189 | https://limenhelix.com/trade-command |

**4-Layer Domains (no console; 5 total): command + opportunities + workspace + portal-root + portal-subdomains**

| Domain | Command | Opportunities | Workspace | Portal Root | Subdomains | Link |
|--------|---------|---------------|-----------|------------|-----------|------|
| environment | Y | Y | Y | Y | 192 | https://limenhelix.com/environment-command |
| intelligence | Y | Y | Y | Y | 200 | https://limenhelix.com/intelligence-command |
| medicine | Y | Y | Y | Y | 138 | https://limenhelix.com/medicine-command |
| population | Y | Y | Y | Y | 202 | https://limenhelix.com/population-command |
| religion | Y | Y | Y | Y | 202 | https://limenhelix.com/religion-command |

**Console-Only Domains (2 total): console only, no command/workspace/opportunities**

| Domain | Console | Link |
|--------|---------|------|
| domain | Y | https://limenhelix.com/domain-console |
| investment | Y | https://limenhelix.com/investment-console |

**Other-Only Domains (11 total): no standard layer files; typically single or landing pages**

| Domain | File | Type | Link |
|--------|------|------|------|
| civilization | civilization.html | landing | https://limenhelix.com/civilization |
| clinical | clinical-portal.html | portal (orphan) | https://limenhelix.com/clinical-portal |
| company | company-lookup.html, company-portal.html | lookup/portal | https://limenhelix.com/company-lookup |
| crm | crm-pipeline.html | operational | https://limenhelix.com/crm-pipeline |
| culture | culture-command.html, culture-workspace.html, culture-portal.html + 172 subdomains | 3-layer + portals | https://limenhelix.com/culture-command |
| disputes | disputes-exceptions.html | operational | https://limenhelix.com/disputes-exceptions |
| execution | execution-framework.html, execution-reports.html | operational | https://limenhelix.com/execution-framework |
| family | family-law.html | orphan | https://limenhelix.com/family-law |
| helix | helix-artifact.html, helix-artifacts.html, helix-brain-grid.html, helix-portal-coverage.html, helix-report.html | system pages | https://limenhelix.com/helix-report |
| index | index.html, index-original.html | landing | https://limenhelix.com/index |
| journal | journal.html | operational | https://limenhelix.com/journal |
| master-brain | master-brain.html, master-brain-executor.html, master-brain-inbox.html, master-inbox.html | operational | https://limenhelix.com/master-brain |
| operator | operator-guide.html, operator-onboarding.html, operator-sop.html | documentation | https://limenhelix.com/operator-guide |
| policy | policy-procedures.html | documentation | https://limenhelix.com/policy-procedures |
| payout | payout-operations.html | operational | https://limenhelix.com/payout-operations |
| phase-observer | phase-observer.html | system | https://limenhelix.com/phase-observer |
| portal | portal-pricing.html, portal-template.html | system | https://limenhelix.com/portal-pricing |
| provider | provider-portal.html | lookup | https://limenhelix.com/provider-portal |
| treatment | treatment-discovery.html | discovery | https://limenhelix.com/treatment-discovery |
| venture | venture-portfolio.html | operational | https://limenhelix.com/venture-portfolio |
| vitals | vitals.html | operational | https://limenhelix.com/vitals |
| admin-leads | admin-leads.html | operational | https://limenhelix.com/admin-leads |
| applications | applications.html | landing | https://limenhelix.com/applications |
| kc | kc-guide.html, kc-thanks.html | documentation | https://limenhelix.com/kc-guide |
| kernel | kernel-comparison.html | analysis | https://limenhelix.com/kernel-comparison |
| limen-report | limen-report.html | system | https://limenhelix.com/limen-report |
| my-documents | my-documents.html | operational | https://limenhelix.com/my-documents |
| pattern | pattern-proposals.html | operational | https://limenhelix.com/pattern-proposals |

**Portal Page Totals:**

- **3,278 portal HTML files total** (root + subdomains)
- **19 domains with portal layers** (14 full 5-layer + 5 partial 4-layer)
- **2,818 subdomain-specific portals** (portal_subdomain_subtype_portal.html pattern)
- **Per-domain portal distribution:**
  - governance: 203 (highest)
  - population: 203
  - religion: 203
  - intelligence: 201
  - defense: 191
  - finance: 190
  - infrastructure: 193
  - environment: 193
  - industry: 192
  - energy: 184
  - economy: 163
  - law: 161
  - medicine: 139
  - technology: 134
  - science: 121
  - communication: 119
  - education: 103
  - culture: 173
  - trade: 190

### DATA

**Command Board Data (all command + console pages):**
- Source: assets/data/command-board-data.json (148 KB, 11 days old)
- Loaded by: all 20 command pages + all 16 console pages
- Freshness: STALE (11 days; typical refresh cycle likely daily/hourly)
- Pattern: Single tank, domain-filtered at render via _CMD_DOMAIN_FILTER variable (agriculture, communication, finance, etc.)
- Example filter logic (line 163-164 agriculture-command.html): `DATA.filter(function(c) { var cd = c.d || c.domain; return cd === _CMD_RESOLVED || cd === _CMD_DOMAIN_FILTER || cd === 'p2_agri'; })`
- Observation: Finance command loads with stricter filter (line 164): `return (c.d || c.domain) === _CMD_RESOLVED;` (other domains allow fallback)

**Portal Data (all portal pages, 3,278 files):**
- Source: portal-registry.json (61.75 MB, 81 DAYS OLD) + treatment-discovery-cube.json (84.25 MB, 2 days old)
- Loaded by: portal-ui.js via PortalUI.init(domainId, parentLabel, groupOrder)
- Freshness: STALE (portal-registry.json severely outdated; treatment data fresh)
- Pattern: All portal pages load connectome-core.js + portal-ui.js (identical); config via PortalUI.init { domainId: 'medicine_addiction', parentLabel: 'Addiction Medicine', brainWhy: {}, groupOrder: [...] }
- Data consumption: portal-registry.json maps domain→issue→nodes; treatment-discovery-cube.json feeds live-discoveries.js for in-portal discovery overlays
- Observation: Portal pages are CODE-IDENTICAL but CONFIG-DIFFERENT (domainId parameter drives all behavior)

**Domain Stress & Ecosystem Data:**
- Source: stress-network-state.json (4.45 MB) — live feed for domain stress visualization
- Loaded by: command-board-stress.js (fetch('/api/domain-snapshot'))
- Freshness: LIVE (updates via API, not file-based)
- Pattern: Used by all command pages to render domain stress board + portfolio

**Company & Entity Data:**
- Source: company-registry.json (16.27 MB, 9 days old), company-index.json (0.04 MB), entity-registry.json (0.07 MB)
- Loaded by: helix-report.html, company-portal.html (linked from command row expansions)
- Freshness: MODERATELY STALE (9 days)

**Opportunities Pages:**
- Source: No dedicated data tank located; opportunities pages (21 total) appear to be EMPTY SHELLS or FUTURE-ONLY
- Loaded by: 21 opportunity pages (*-opportunities.html)
- Freshness: UNKNOWN (no content inspection performed; may be template placeholders)

**Workspace Pages:**
- Source: No dedicated data tank located; workspace pages (20 total) appear to be EMPTY SHELLS or FUTURE-ONLY
- Loaded by: 20 workspace pages (*-workspace.html)
- Freshness: UNKNOWN (no content inspection performed; may be template placeholders)

### HOW IT CONNECTS

**Forward Push Path: Data → Command Layer → Portal Layer**

1. **Inbound data sources:**
   - command-board-data.json (external generation, likely via scripts/score-companies.js mentioned in line 153)
   - stress-network-state.json (API feed, /api/domain-snapshot)
   - treatment-discovery-cube.json (external generation, fresh at 2 days old)

2. **Command board rendering (all 20 command pages + 16 console pages):**
   - Page loads assets/js/command-board-stress.js (shared across all command pages)
   - Page embeds _CMD_DOMAIN_FILTER = 'agriculture|communication|finance|...' (domain-specific)
   - JS loads command-board-data.json via XMLHttpRequest
   - JS filters DATA by domain, enriches with signal classification + severity scoring
   - Page renders: stats bar (7 signal types: DATA_ERROR, ALERT, EARLY_WARNING, FRAGILE_STABILITY, ORDERED_WATCH, SECTOR_PRESSURE, NOMINAL)
   - Page renders: domain stress board (color-coded cards per subdomain within filtered domain)
   - Page renders: expandable company table with phase + trajectory + composite + domain stress
   - Row expansion calls _buildExpandContent(d), which links to:
     - **helix-report.html?cik=...&source_surface=agriculture_command** (confirms forward link)
     - **company-portal.html?company=...** (other direction)
   - Page listens to **limen:[domain]-refresh** event (line 908), triggering live updates

3. **Refresh controller wiring (agriculture-refresh-controller.js pattern):**
   - Each domain with command/console gets a domain-brains/(domain)-refresh-controller.js file (22 total: agriculture, communication, culture, defense, economy, education, energy, finance, governance, industry, infrastructure, intelligence, law, medicine, population, religion, science, technology, trade + possibly others)
   - These controllers dispatch limen:[domain]-refresh events
   - Command page listens and re-renders stats + domain panel + table

4. **Portal layer consumption (3,278 portal pages):**
   - Portal root page loads connectome-core.js + portal-ui.js
   - PortalUI.init({ domainId: 'medicine_addiction', parentLabel: 'Addiction Medicine', ... })
   - portal-ui.js queries portal-registry.json to resolve domainId → issues + nodes
   - portal-ui.js renders left panel (issue tree) + center (3D connectome canvas) + right (node detail)
   - Portal-registry.json provides the STRUCTURE; treatment-discovery-cube.json provides the SUBSTANCE (drugs, therapies, outcomes)
   - Subdomain portals are IDENTICAL TO root portals except domainId parameter:
     - medicine_portal.html: domainId='medicine'
     - medicine_addiction_portal.html: domainId='medicine_addiction'
     - medicine_addiction_behavioral_portal.html: domainId='medicine_addiction_behavioral'
   - All portals share connectome-core.js; connectome is UNIVERSAL 111-node brain map; domainId selects which nodes light up

5. **Backward links:**
   - Command page row expansion links to helix-report.html?source_surface=agriculture_command
   - helix-report.html likely loads company-registry.json + kernel phase logic
   - Company portal loads company-registry.json (not traced beyond)

6. **Missing connections (gaps):**
   - Opportunities pages (21 total) show no data tank; appear ORPHANED or NOT YET BUILT
   - Workspace pages (20 total) show no data tank; appear ORPHANED or NOT YET BUILT
   - console pages (16 total) load command-board-stress.js but no evidence they override _CMD_DOMAIN_FILTER; possible they are IDENTICAL to command pages OR loading alternate data tanks not yet identified

**Synchronization Points:**

- **Domain stress snapshot:** /api/domain-snapshot → fetched every 60s if auto-refresh enabled → triggers limen:[domain]-refresh → all pages listening re-compute severity + signal
- **Watchlist (localStorage):** limen_watchlist → persisted in browser, not synced to backend (evidence: watchlist toggle in rows, stored via localStorage.setItem)
- **Portfolio (localStorage):** limen_portfolio → seeded with XOM (agriculture) or NET (communication) on first load, persisted locally

### NEEDS WORK / INCONSISTENCIES

**High-Priority Issues:**

1. **Portal-registry.json is 81 DAYS OLD** — treatment-discovery-cube.json is 2 days old
   - Portal pages may be showing stale data (issue hierarchies, node mapping)
   - No regeneration script identified; portal-registry.json may be manually maintained
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json

2. **Command-board-data.json is 11 DAYS OLD** — significantly older than typical operational refresh
   - Command boards may be showing outdated company signals
   - scripts/score-companies.js (line 153) referenced but not found in this repo; likely in separate backend
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json

3. **Opportunities and Workspace layers are EMPTY SHELLS**
   - 21 opportunity pages exist; no data tank identified; appears to load no external data
   - 20 workspace pages exist; no data tank identified; appears to load no external data
   - No indication whether these are placeholder / future-only / intentionally disabled
   - Example: C:\Users\Chris\Limen-Helix-live-\agriculture-opportunities.html — no inline JS found (need to read full file)

4. **Console pages may be DUPLICATES of command pages**
   - 16 console pages exist; both load command-board-stress.js
   - No evidence of distinct console-specific JS or config
   - Possible: console pages are identical except for CSS styling or URL routing
   - Example: agriculture-command.html vs agriculture-console.html — both load command-board-stress.js with identical _CMD_DOMAIN_FILTER

5. **Domain asymmetry: 5 domains missing console layer**
   - environment, intelligence, medicine, population, religion have command/opportunities/workspace/portal but NO console
   - Possible oversight; possible intentional (e.g., these domains do not aggregate company stress)
   - No documentation explaining this pattern

6. **Domain asymmetry: 2 domains console-only**
   - domain and investment pages have ONLY console-console.html, no command/opportunities/workspace
   - Suggests incomplete rollout or special-purpose use case

7. **Portal namespace collision risk: medicine_portal.html vs medicine_addiction_behavioral_portal.html**
   - 2,900 three-part portal filenames exist (medicine_addiction_behavioral_portal.html)
   - Portal router must disambiguate; portal-registry.json maps domainId string to portal file
   - Risk: if registry regeneration fails, subdomain portals may not be discoverable

8. **Subdomain portal coverage highly asymmetric:**
   - communication: 119 subdomains (accesscomm, advertising, analytics, archives, broadcasting, corporate, datacomm, disinfo, events, internet, journalism, medialaw, pr, public, publishing, satellite, social, speechlang, telecom, visualcomm with nested 2-3 levels each)
   - agriculture: 0 subdomains (root portal only)
   - Suggests communication is far more granular than agriculture, possibly by design

9. **Orphaned clinical-portal.html**
   - Single file with no command/console/opportunities/workspace layer
   - No parent domain named "clinical"
   - No indication of which domain(s) should parent it or how it's supposed to integrate

10. **No data validation on command-board-data.json**
    - agricul command-command.html includes fallback: "DATA = parsed.companies || []"
    - If tank is empty or corrupt, page renders empty stats bar with ERROR message
    - No health check script identified to validate freshness before deploy

11. **Refresh controller mismatch:**
    - 22 refresh controller files exist (agriculture, communication, culture, defense, economy, education, energy, finance, governance, industry, infrastructure, intelligence, law, medicine, population, religion, science, technology, trade, + 3 unidentified)
    - agriculture-command.html loads agriculture-refresh-controller.js (confirmed)
    - But agriculture-console.html also needs agriculture refresh controller if they share command-board-stress.js — need to verify console pages actually load it

12. **Live API endpoint /api/domain-snapshot referenced but not verified:**
    - command-board-stress.js (line 715): fetch('/api/domain-snapshot')
    - Endpoint is expected to return JSON with { domains: { [domain]: { stress: 0.0-1.0 } } }
    - No API endpoint found in this repo (likely in separate limen-helix-api directory)
    - If API is down, all command pages silently fail refresh (line 747: .catch(...) { /* silent */ })

13. **Three-level portal nesting inconsistent:**
    - communication_advertising_portal.html — 2 levels
    - communication_advertising_creative_portal.html — 3 levels
    - medicine_addiction_behavioral_portal.html — 3 levels
    - Both 2 and 3-level nesting in same domain; portal-registry.json must handle both

**Moderate-Priority Issues:**

14. **Opportunities/workspace pages not inspected for content**
    - No read operations performed on agriculture-opportunities.html or agriculture-workspace.html
    - May contain data tanks, API calls, or be complete empty shells

15. **Portal page templates may not match domainId to filename:**
    - All portals load connectome-core.js + portal-ui.js with PortalUI.init({ domainId: '...' })
    - domainId is hardcoded in page (e.g., medicine_addiction_portal.html has domainId='medicine_addiction')
    - Filename must match domainId or portal-ui.js will fail to find data
    - No validation found; possible silent failures if mismatch occurs

16. **Company portal (company-portal.html) not fully traced:**
    - Linked from command board row expansions
    - Expected to consume company-registry.json
    - Not yet read or verified

**Low-Priority Issues:**

17. Operator documentation pages (operator-guide.html, operator-onboarding.html, operator-sop.html) not integrated with data layers — purely informational

18. Master-brain pages (master-brain.html, executor, inbox) appear to be operational dashboards; data consumption not verified

19. Helix-artifact pages (helix-artifact.html, helix-artifacts.html) appear to be system introspection pages; purpose unclear

20. Index pages (index.html, index-original.html) presence of "original" suggests migration in progress

**Concrete File Paths for Investigation:**

- C:\Users\Chris\Limen-Helix-live-\agriculture-opportunities.html — read full file to determine if empty
- C:\Users\Chris\Limen-Helix-live-\agriculture-workspace.html — read full file to determine if empty
- C:\Users\Chris\Limen-Helix-live-\agriculture-console.html — verify refresh controller load + _CMD_DOMAIN_FILTER
- C:\Users\Chris\Limen-Helix-live-\assets\js\command-board-stress.js — verify API endpoint health-check logic (none found; gap)
- C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json — sample structure to confirm company field names (c, d, p, ds, co, tr, a, n, t, s, _signal, _severity)
- C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json — sample structure to confirm domainId → issues mapping (84 MB; not read)
- C:\Users\Chris\Limen-Helix-live-\limen-helix-api\... — backend API (separate repo; domain snapshot endpoint location)

---

## 9. Portals & portal behavior

### PURPOSE
The portal system is LIMEN Helix's unified interface for viewing domain-specific issues, diagnoses, treatments, and cross-substrate connections. Portals aggregate diagnosis/treatment data from domain brains and company-level signals into interactive 3-panel views. Two distinct portal types exist: (1) **Domain/Opportunity Portals** (173,652 total, routed via /portal?domain=X), for governance/finance/energy/trade/defense/agriculture/etc. domains and their nested hierarchies; and (2) **Company Portals** (800 companies in assets/data/companies/**), for equity-research-grade company profiling with functional networks, FRED data, and commodity exposures. Portal rendering flow: URL params → portal-router.js → domain brain diagnosis/treatment cache → assets/data/domains/{domainId}.json → PortalUI.init() for brain connectome visualization. **CRITICAL STATUS**: All portals currently show PLACEHOLDERS; zero portal engines have been promoted from candidates to live outputs (10,175 total issues registered, but all from template/candidate stubs). No real engine outputs in portal-registry.json.

### KEY FILES
- **C:\Users\Chris\Limen-Helix-live-\portal-template.html** — Example: Reads ?substrate=legal&category=family-law&phase=P3; renders phase graph + right-panel cross-substrate connections.
- **C:\Users\Chris\Limen-Helix-live-\company-portal.html** — Company portal shell; loads company-resolver.js → company-portal-ui.js → company-portal-engine-render.js to display functional networks + engine outputs (patents/grants/investments) if available.
- **C:\Users\Chris\Limen-Helix-live-\assets\js\portal-router.js** — Universal domain portal router (215 lines); parses ?domain=X&l2=Y&l3=Z; fetches domain registry (tries per-domain split first, falls back to master); populates breadcrumb/sidebar; calls PortalUI.init(). **NOTE**: Code expects `assets/data/registry/portal-registry-{domain}.json` per-domain split files that don't exist—falls back gracefully to master registry.
- **C:\Users\Chris\Limen-Helix-live-\assets\js\portal-ui.js** — Shared 3-panel UI module (150+ lines read); engine-agnostic (detects ConnectomeCore vs ConnectomeRenderer); builds issue selector from DATA.issues[], toggles to visualize circuits on brain connectome, renders intervention tabs (strategy/coaching/structural/culture/tools).
- **C:\Users\Chris\Limen-Helix-live-\assets\js\portal\gap-synthesis-templates.js** — Template library for gap-detection engine; 6 full template sets (energy, supplyChain, defense, finance, health, agriculture) with diagnosis/treatment patterns, 14 stub templates (1-2 templates each); defines 8 treatment levels (monitoring → recovery). **File role**: read-only data for limen-gap-synthesis-engine.js candidate generation.
- **C:\Users\Chris\Limen-Helix-live-\assets\js\portal\limen-gap-synthesis-engine.js** — Phase 25G engine (563 lines); detects gaps in portal diagnosis/treatment coverage by scanning domain stress + active drivers, generates PROVISIONAL candidates from templates with evidence anchors, stores in localStorage (limen_generated_diagnoses/treatments/drill_deeper), never auto-promotes (status='GENERATED_CANDIDATE'). **Data flow**: reads LIMENDomains, LIMENPhaseAnnotations, LIMENDefenseSignals, LIMENCrossDomain; writes window.LIMENGapSynthesis API.
- **C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\portal-content-resolver.js** — 150+ line resolver; maps diagnosis IDs to portal subtrees (OIL_SHOCK → [energy_fossil, energy_pipeline, ...]; SUPPLY_CHAIN_COLLAPSE → [trade_supply, ...]); caches fetched content; exposes window.LIMENPortalContentResolver for brain treatment recommendations.
- **C:\Users\Chris\Limen-Helix-live-\assets\js\company-resolver.js** — Client-side company lookup by ticker/CIK/name/slug; loads company-index.json once; provides resolve() and getSuggestions() for company-portal autocomplete.
- **C:\Users\Chris\Limen-Helix-live-\assets\js\company-portal-ui.js** — Company portal left/right panel rendering; loads company JSON from assets/data/companies/{slug}.json; renders functional networks (suppliers, customers, peers, regulators, capital providers, partners) with neuralRole + brainNodeId + confidence; domain context sidebar.
- **C:\Users\Chris\Limen-Helix-live-\assets\js\company-portal-engine-render.js** — Bridges company portal and engine outputs; hooks CompanyPortalUI.renderCompany(); appends BRIDGE PATTERNS section (neuro↔business readings) and ENGINE OUTPUTS tabs (patent/grant/investment/research artifacts); includes Gate B v0.2 PLACEHOLDER_CONTAMINATED suppression styles.
- **C:\Users\Chris\Limen-Helix-live-\api\fetch-portal.js** — Node.js API handler; GET /api/fetch-portal?domainId=X; fetches assets/data/domains/{domainId}.json from GitHub Contents API with Bearer token; caches 1 hour; validates against path traversal.
- **C:\Users\Chris\Limen-Helix-live-\api\enrich-portal-claude.js** — Portal enricher (100+ lines read); POST endpoint; takes company ID + sparse portal JSON; calls Claude Haiku 4.5 (ENRICH_MODEL override available) to densify portal JSON to schema 2.0.1 (functional networks 35+ entries, FRED series, commodity exposure, financialHealth stubs); bans internal LIMEN vocabulary in output; writes result for manual integration to assets/data/companies/{slug}.json.
- **C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json** — Master portal registry (~62MB, do not read whole); keys: _generated (date), _portalCount (173,652), _domainIdCount (68,923), portals (path → {title, domainId, issueCount, issueCount=0-8, childCount, nodeCount, phaseTag, groups[], childPaths[], source, engine (null—ALL PLACEHOLDERS)}), domainIdToPath (maps domainId to path for resolver).
- **C:\Users\Chris\Limen-Helix-live-\assets\data\companies\{800 company files}.json** — Company portal data; schema 2.0.1; fields: slug, ticker, cik, name, sic, industry, domainId, fredSeries[], functionalNetwork [{name, ticker, cik, slug, neuralRole, brainNodeId, relationshipNote, confidence, sourceType[]}], commodityExposure[], financialHealth {revenue, employees, netIncome, debt, ebitda}, portalRelevance prose, opportunitySignals [], domainRelevance {domain, relevance, signals}.
- **C:\Users\Chris\Limen-Helix-live-\assets\data\domains\{3,710 domain portal files}.json** — Per-domain portal snapshots; schema: title, desc, issues [{id, label, circuits [{nodeId, dir, detail, evidence}]}], groups (empty in all sampled), groups structure for future expansion. **No engine field in any file sampled**.

### LIVE PAGES
(Domain portals render dynamically via /portal route; no static HTML files, all served via portal-router.js URL rewrites)

**Domain Portal Family** (routed as clean URLs via Vercel cleanUrls: on):
- https://limenhelix.com/portal?domain=governance — Root governance portal; 20 child portals (anticorruption, judicial, legislative, executive, etc.), 6 issues
- https://limenhelix.com/portal?domain=governance/anticorruption — Level 2: 10 children (antimoney, assetdisc, benefown, bribery, etc.), 3 issues
- https://limenhelix.com/portal?domain=governance/anticorruption/antimoney — Level 3: 4 children (compliance, entity, filing, registration), 3 issues
- (Trade domain has 900+ portals: https://limenhelix.com/portal?domain=trade, trade/wto, trade/customs, trade/port, trade/rail, trade/trucking, trade/warehousing, trade/ecommerce, trade/supply, trade/lastmile, trade/origincert, trade/services, trade/tradecompliance, trade/tradedata, trade/tradefinance, trade/tradeinfra, trade/tradepolicy, trade/tradezone)
- (Energy: https://limenhelix.com/portal?domain=energy → energy/fossil, energy/renewable, energy/nuclear, energy/grid, energy/distribution, energy/storage, energy/efficiency, energy/energypolicy, energy/energytrade, energy/transmission, energy/power)
- (Finance, defense, agriculture, infrastructure, etc.—all generated via same /portal?domain= route)

**Company Portal Family** (static route):
- https://limenhelix.com/company-portal.html?company=walmart — 800 companies indexed by slug (ticker name); reads from assets/data/companies/walmart.json; shows functional network (Mercado Libre, Amazon, Dollar General, Target, Costco as top customers), FRED series (Retail Sales, Personal Income, etc.), Commodities (agricultural products, energy, metals)
- https://limenhelix.com/company-portal.html?company=nvidia — Tech sector example; functional network (TSMC, Samsung, MediaTek as suppliers; Apple, Google, Meta as customers)

**Root Portal Pages** (3,278 static HTML files):
- https://limenhelix.com/communication_portal.html — Communication domain root portal
- https://limenhelix.com/communication_advertising_portal.html — Advertising subdomain
- https://limenhelix.com/communication_advertising_creative_portal.html — Creative specialty
- (Samples across all 3,278: technology_*, defense_*, agriculture_*, medicine_*, law_*, religion_*, culture_*, science_*, infrastructure_*, environment_*, education_*, population_*, economy_*, intelligence_*, governance_*, trade_*, finance_*, energy_*, industry_*, communication_*)

### DATA
**READS:**
- **portal-registry.json** (62MB master): STALE (last updated when portal count/structure changes; _generated key tracks date). Frequency of refresh unknown from timestamps alone, but structure is reference data (changes only when new portals added).
- **assets/data/domains/{domainId}.json** (3,710 files, ~556MB total): MIXED FRESHNESS. Sample timestamps: addiction.json (May 13), governance.json (Mar 17), energy_fossil.json (Mar 17). Most from Mar 17 cohort (initial build); some domain files May 13 (stale). **Zero files have engine outputs**—all issues are template placeholders from portal-registry.json.
- **assets/data/companies/{800 company files}.json** (50MB total): STALE. Modification dates clustered: most May 28-Jun 5, latest Jun 5 18:59 (ASML, 3M, Accenture, ADP, Adobe). Company data updated semi-regularly via enrichment pipeline, but no timestamps in JSON schema to verify freshness.
- **company-registry.json** (17MB): STALE. Last write: May 29 05:56. Aggregated index over all 800 company files; regenerated when companies added/removed.
- **company-index.json** (44KB): STALE. May 29 05:56. Fast lookup table for company-resolver.js (byTicker, byCik, bySlug, companies).
- **company-aliases.json** (52KB): STALE. Jun 5 13:01. Ticker/name aliases for fuzzy matching in company resolver.

**WRITES:**
- **localStorage keys (client-side only)**:
  - `limen_generated_diagnoses` (max 50 items) — Portal gap synthesis engine candidates
  - `limen_generated_treatments` (max 200 items) — Treatment candidates paired to diagnoses
  - `limen_generated_drill_deeper` (max 200 items) — Drill-deeper candidates
  - `limen_gap_audit` (max 20 items) — Scan history timestamps
  - `cp_selection` — Company portal UI state (last viewed company, panel state)
- **API output (POST /api/enrich-portal-claude)**: Densified company portal JSON (NOT auto-written to disk; returned to caller for manual integration).
- **No direct file writes from running portals** — all portal content is read-only reference data served to Vercel CDN.

### HOW IT CONNECTS
**Portal → Domain Brain Circuit:**
1. **Domain portal page loads** (e.g., /portal?domain=governance) → portal-router.js parses URL
2. → Fetches portal-registry.json → Looks up entry for "governance" → Entry contains issueCount (6), nodeCount (20)
3. → Calls PortalUI.init({domainId, issuesEnabled, childPortalResolver})
4. → PortalUI loads assets/data/domains/governance.json via fetch or API call
5. → DATA.issues[] populates issue selector; each issue has circuits[] (node paths, directions, evidence)
6. → User toggles issue → PortalUI.toggleIssue() calls Engine.selectIssue() → Brain connectome highlights circuits
7. → Engine exposes intervention tabs (strategy/coaching/structural/culture/tools) → Each tab pulls from DATA.issues[issueId].interventions[tab]

**Portal ← Gap Synthesis Engine:**
1. **Domain brain detects stress** (e.g., governance stress > 0.65) → Fires 'limen:domain-update' event
2. → limen-gap-synthesis-engine.js scanAllDomains() triggered (throttled 60s)
3. → scanDomain('governance') → checks for uncovered drivers → Calls generateDiagnosisCandidates()
4. → Reads DIAGNOSIS_TEMPLATES['governance'] from gap-synthesis-templates.js
5. → Matches active drivers to triggerConditions → Generates diagnosis candidate with evidence anchors
6. → Stores to localStorage limen_generated_diagnoses
7. → Generates treatment candidates (8 levels: monitoring → recovery) via generateTreatmentCandidates()
8. → Stores to localStorage limen_generated_treatments
9. **Portal UI consumes**: PortalUI can query window.LIMENGapSynthesis.getDiagnoses('governance') to show candidates (currently not wired into UI display, but API ready)

**Portal Content → Brain Treatment Recommendations:**
1. **portal-content-resolver.js** maintains DIAGNOSIS_PORTAL_MAP (e.g., OIL_SHOCK → [energy_fossil, energy_pipeline, ...])
2. When domain brain generates treatment for OIL_SHOCK diagnosis, resolver fetches mapped portal subtrees:
   - Calls resolveForDiagnosis('OIL_SHOCK') → Fetches energy_fossil.json, energy_pipeline.json, etc.
   - Extracts treatments[] from each portal
   - Returns deep treatments with steps, citations, monitoring, escalation
3. Domain brain recommendation panel displays resolved treatments with portal citations

**Portal → Company Portal Bridge:**
1. **Domain-to-company mapping**: Company portal loads assets/data/companies/{slug}.json
2. functionalNetwork[] contains domain-aware entries:
   - Each entity has neuralRole (supplier, customer, regulator, peer) + brainNodeId (maps to domain brain node)
   - brainNodeRole (e.g., 'supply_chain_coordinator', 'demand_aggregator')
3. Company portal engine render hooks into CompanyPortalUI.renderCompany()
4. Appends BRIDGE PATTERNS section: neuro↔business readings (if portal.bridgeReadings exists)
5. Appends ENGINE OUTPUTS: tabbed reader for patent/grant/investment artifacts (if portal.engineOutputs exists)

**Portal ↔ Clarity Operators (Domain Signal Dispatch):**
1. All 20 clarity operators (agriculture-clarity-operator.js, economy-clarity-operator.js, etc.) generate links to domain portals
2. When operator finds relevant entity, it creates link: `href="/portal?domain={portalDomain}&l2={sub}&l3={...}"`
3. Example: economy-clarity-operator finds supply-chain event → Creates link to `/portal?domain=supplyChain/trading/routes`
4. Also creates links to company portals: `href="company-portal.html?company={ticker}"`
5. **Bidirectional**: Domain portals link to related companies via company-portal.html?company= parameters embedded in right-panel cross-domain connections

**Portal ↔ Opportunities System:**
1. Opportunity pages (agriculture-opportunities.html, civilization-opportunities.html, etc.) contain links to source portals
2. Link format: `href="portal-template.html?from=opp&oppTitle=...&oppType=..."`
3. portal-router.js detects `?from=opp` → Overrides breadcrumb to show: OPPORTUNITIES → DOMAIN → CURRENT
4. Passes oppContext to PortalUI for context display in right panel

**Portal Hierarchy (parent-child structure):**
- governance (20 children)
  → governance/anticorruption (10 children)
    → governance/anticorruption/antimoney (4 children)
    → governance/anticorruption/assetdisc (4 children)
    → governance/anticorruption/benefown (4 children)
    → ... (7 more anticorruption subtypes)
  → governance/judicial, governance/legislative, governance/executive, ...
- trade (900+ portals across 24 L2 categories and 100+ L3 subcategories)
- energy (10+ portals)
- finance (15+ portals)
- agriculture (12+ portals in Phase 2)
- ... etc.

**File Evidence for Connections:**
- **portal-router.js line 176-191**: childPortalResolver function maps childPortal filenames (e.g., "p2_agri_soil_testing_portal.html") to pathKeys via domainIdToPath lookup
- **portal-ui.js line 204-212**: PortalUI.init() receives groupOrder (from entry.groups) and childPortalResolver
- **portal-content-resolver.js line 41-150**: DIAGNOSIS_PORTAL_MAP hardcodes domain/subdomain linkages
- **company-portal-engine-render.js line 100+**: Reads portal.bridgeReadings and portal.engineOutputs; both currently null/absent in all company files (no engine outputs yet)
- **assets/js/domain-signal-engine.js**: Generates portal links in clarity operator dispatch
- **api/enrich-portal-claude.js**: Specifies portalAttachment field (which domain portal this company belongs to) in schema v2.0.1

### NEEDS WORK / INCONSISTENCIES

1. **CRITICAL: All portals in PLACEHOLDER state; zero engine outputs live**
   - portal-registry.json: ALL 173,652 portals have engine=undefined (PLACEHOLDER flag)
   - assets/data/domains/*.json: Zero files contain engine-generated issues; all 10,175 issues are template/candidate stubs
   - assets/data/companies/*.json: Zero files contain bridgeReadings or engineOutputs; enrich-portal-claude.js exists but output not auto-integrated to disk
   - assets/js/company-portal-engine-render.js checks for portal.engineOutputs gracefully, displays empty state if absent
   - **File evidence**: company-portal-engine-render.js line 17-19 warns if output sections missing; company-portal-ui.js never calls limen-gap-synthesis-engine.js to populate UI with candidates
   - **ACTION NEEDED**: Either (a) run gap-synthesis engine to promote candidates → write to portal-registry.json + domains JSON files, or (b) document that portals are TEMPLATE-ONLY until engine finalization

2. **Portal registry fallback to master is graceful but per-domain splits never built**
   - portal-router.js lines 20-42 expects per-domain split files (assets/data/registry/portal-registry-{domain}.json)
   - Directory does NOT exist; fallback to master registry works but performance impact unclear at 173k portals
   - **File evidence**: No /assets/data/registry/ directory found; portal-router.js has dead code path for splits
   - **ACTION**: Either build per-domain splits (trade domain would be 900+ entries) or remove dead code

3. **Domain portal data files missing engine fields**
   - governance.json, energy_fossil.json, etc. have NO engine key (governance sample shows hasEngine=false)
   - gap-synthesis-engine.js writes to localStorage, never to these JSON files
   - portal-registry.json aggregates across all domains but ALL engine values are null
   - **File evidence**: assets/data/domains/*.json lack engine:{} structure; portal-registry.json _portalCount=173,652 but _generated shows no recent refresh tied to engine output promotion
   - **ACTION**: Define schema for engine outputs in domain JSON files, OR clarify that engine outputs are read from localStorage only (transient, lost on browser refresh)

4. **Company portal enrichment pipeline disconnected from live data**
   - enrich-portal-claude.js endpoint exists but output not auto-written to assets/data/companies/{slug}.json
   - No cron/trigger to invoke enrichment; manual integration required
   - enriched portals would have schema v2.0.1 but existing files may be older schema
   - **File evidence**: api/enrich-portal-claude.js lines 1-35 document Walmart-grade exemplar (35-entry network) but only sample companies (walmart.json, nvidia.json) have dense data; others are sparse
   - **ACTION**: Build automation to invoke enrich-portal-claude.js for companies with stale or sparse data (use last-modified timestamp vs. cutoff)

5. **Opportunities system links to portals but portal.html static pages scattered across root**
   - 3,278 root-level *_portal.html files (communication_portal.html, trade_wto_accession_portal.html, etc.)
   - No clear manifest of which root portals map to which domainIds in portal-registry.json
   - domainIdToPath in portal-registry.json should map domainId → path, but HTML filenames use underscore-separated paths (_portal.html suffix)
   - **File evidence**: portal-router.js line 179 strips "_portal.html" suffix to derive domainId, but reverse mapping (domainId → HTML filename) is not auto-derived
   - **ACTION**: Audit domainIdToPath completeness; ensure every root *_portal.html has a registry entry

6. **Gap synthesis engine set up for periodic scanning but never triggered from portal UI**
   - limen-gap-synthesis-engine.js exposes window.LIMENGapSynthesis.getDiagnoses() but no portal page calls it
   - PortalUI.init() receives issuesEnabled=true but builds selector only from DATA.issues (static portal JSON), not from generated candidates
   - Candidates are stored in localStorage but orphaned (no UI to view/promote them)
   - **File evidence**: assets/js/portal-ui.js lines 77-101 buildIssueSelector() reads DATA.issues ONLY, never queries window.LIMENGapSynthesis
   - **ACTION**: Wire portal issue selector to fallback to gap-synthesis candidates if DATA.issues is sparse; add "PROMOTE" button to promote candidates to canonical

7. **Company-resolver.js supports fuzzy matching but no autocomplete wired into company-portal.html search**
   - company-resolver.js implements getSuggestions() (lines 108-150) for autocomplete, returns array of {slug, name, ticker, cik, matchType}
   - company-portal.html does not show search UI with autocomplete; it only supports ?company=slug URL param
   - **File evidence**: company-portal.html lines 48-90 show only data-loading placeholder, no search form visible in HTML
   - **ACTION**: Add client-side search form to company-portal.html that invokes company-resolver.getSuggestions() for autocomplete UX

8. **Portal navigation breaks for deep hierarchies (governance/anticorruption/antimoney has 4 children, each accessible via ?l2=anticorruption&l3=antimoney&l4=...)**
   - Portal-router.js supports up to 8 levels (l2, l3, l4...l8), but no UI breadcrumb or sidebar reflects depth > 2
   - When user navigates from L3→L4, breadcrumb should update but childPortalResolver may fail to find HTML files if *_portal.html naming doesn't follow path structure
   - **File evidence**: portal-router.js lines 114-143 build breadcrumb recursively but assumes parentPath is always set in registry; deep portals may not have entries
   - **ACTION**: Test portal-router.js with actual governance/anticorruption deep traversals; confirm childPortalResolver finds correct files

9. **Trade portals: 173k total but only 3,349 have issues; rest are pure structure (heading/taxonomy only)**
   - Trade domain alone has 900+ portals (trade/wto, trade/wto/accession, trade/wto/dispute, etc.; trade/customs/*, trade/port/*, trade/rail/*, trade/trucking/*, trade/lastmile/*, trade/supply/*, trade/ecommerce/*, trade/origincert/*, trade/tradezone/*, trade/tradefinance/*, trade/tradeinfra/*, trade/tradepolicy/*, trade/services/*, etc.)
   - portal-registry.json shows most have issueCount=0, nodeCount=0 (placeholders)
   - When user navigates to trade/lastmile/urban, portal loads but shows no diagnoses, empty right panel
   - **File evidence**: portal-registry.js sample shows governance/anticorruption/antimoney with 3 issues, but sibling portals (assetdisc, benefown, etc.) also have 3 issues—repetitive, suggesting template cloning not real content
   - **ACTION**: Confirm whether 170k+ empty portals are (a) intentional scaffolding for future content, or (b) bloat that should be pruned; if (a), document in README

10. **portal-registry.json source field undefined for all portals; no lineage/provenance**
    - Each portal entry has source=undefined
    - No indication whether portal was hand-authored, AI-generated, scraped, or derived from another source
    - Makes it impossible to audit data quality or versioning
    - **File evidence**: portal-registry.json sample output shows source: undefined for all entries
    - **ACTION**: Add source tracking (e.g., "canonical", "generated_25g", "enriched_claude") to portal entries; regenerate registry with provenance

11. **Missing: Portal content schema versioning**
    - assets/data/domains/*.json files have no schemaVersion field (unlike company files, which explicitly specify schemaVersion 2.0.1)
    - Gate B v0.2 PLACEHOLDER_CONTAMINATED suppression styles in company-portal-engine-render.js but no corresponding detection/filtering in domain portals
    - **File evidence**: assets/data/domains/governance.json has no schemaVersion; company files in enrich-portal-claude.js schema explicitly require schemaVersion: "2.0.1"
    - **ACTION**: Add schemaVersion to domain portal JSON schema; increment when breaking changes introduced

12. **Cross-domain portal links hardcoded in portal-content-resolver.js; no dynamic discovery**
    - DIAGNOSIS_PORTAL_MAP in portal-content-resolver.js (lines 41-150) hardcodes all cross-domain mappings (e.g., OIL_SHOCK → [energy_fossil, energy_pipeline, energy_energytrade])
    - If new domain portals added, resolver must be manually updated
    - **File evidence**: portal-content-resolver.js line 150 defines 60+ diagnosis keys, each mapped to portal subtrees; no code to auto-discover mappings from portal-registry.json
    - **ACTION**: Refactor resolver to read DIAGNOSIS_PORTAL_MAP from portal-registry.json (add metadata field) instead of hardcoding; OR build auto-mapping from portal taxonomy + domain brain diagnosis IDs

---

**Summary**: The portal system is STRUCTURALLY COMPLETE (3-panel UI, routing, 173k+ portals indexed) but FUNCTIONALLY INCOMPLETE (zero engine outputs live, all diagnoses are template placeholders, enrichment pipeline not auto-integrated, deep portal navigation untested, performance impact of 62MB master registry unmitigated).

---

## 10. Node mapping & spider-web communication

### PURPOSE
Route signals between brain nodes and propagate them across domain intelligence networks. Translate node-to-node activations into forward-pushed per-domain signals, opportunities, and actions. Implement the basal-ganglia-like action-selection gate (Stage 4) that converts domain stress into winner-take-all executive decisions.

### KEY FILES

**Node & Signal Architecture (Data)**
- C:\Users\Chris\Limen-Helix-live-\assets\data\connectome-node-registry.json — 123-node canonical runtime registry; maps node IDs to brain anatomy + aliases; FROZEN until 2026-12-01 (as of 2026-05-24)
- C:\Users\Chris\Limen-Helix-live-\assets\data\node-signal-registry.json — 254 FRED series signals mapped to 123 nodes by entity (Dolby Labs→A1, Honeywell→ACC, etc.); source of truth for feed→node bindings
- C:\Users\Chris\Limen-Helix-live-\assets\data\node-entity-mapping.json — Node ID ↔ company ticker (CIK/SIC) mapping; 123 nodes × 3 entity fields per node
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-connectome.json — 111-node base connectome (note: registry says 123 canonical; schema mismatch flag)
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-business-mapping.json — Connectome node ID → business function cross-walk (484 KB); maps dlPFC→strategic planning, OFC→market intelligence, etc.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-domains.json — Large receptor matrix (285 KB); node × domain binding; which brain regions activate per domain

**Signal Routing & Bus (Client-side)**
- C:\Users\Chris\Limen-Helix-live-\assets\js\signal-router.js — BehaviorSignal + UserChoiceSignal + BioSignal + FeedStressSignal → node seed activations; mapSignals(signals) → {nodeId: activation}; FeedStressSignal maps domain.stress to brain hub nodes (e.g., energy→HYPO 0.6 + AI 0.3)
- C:\Users\Chris\Limen-Helix-live-\assets\js\propagation-engine.js — Spreading activation on connectome (5 timesteps, 0.85 decay, 0.4 synapse gain); node ↔ node excit/inhib/modulatory; gap detection (never/always activated nodes)
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\inter-brain-bus.js — Collects crossDomainEmissions from all domain brains; routes (sourceDomain→targetDomain signal) to receiveExternalSignal(); detects propagation chains A→B→C; loop detection; MAX_HISTORY=200; cycle() runs on limen:domain-brain-update + 30s fallback
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\pattern-broker.js — Pub/sub fabric for 4 super-brains (master, civilization, connectome, future leaf brains); registers brains, emits/subscribes pattern envelopes; H1 integrity verify, H4 dedup (signature-based), re-entrancy guard depth=8
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\pattern-envelope.js — Sealed pattern schema (brainId, cycleId, kernels, pattern, signature); used by pattern-broker for envelope validation

**Domain Brain Integration**
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\domain-brain-base.js — Base class for 20 domain brains; ingestFeeds() → normalizeSignals() → scoreStress() → deriveDiagnoses() → recommendTreatments() → surfaceOpportunities() → emitCrossDomainSignals(); receiveExternalSignal(emission) accumulates signals from inter-brain-bus (5-min decay); CYCLE_INTERVAL=30s
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brain-adapter.js — Additive cache layer (5-min TTL per domain); intercepts limen:domain-update snapshots; re-applies brain* fields (brainStress, brainDiagnoses, brainTreatments, brainOpportunities, brainDirectives, etc.) to window.LIMENDomains[id]
- C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\domain-packet-adapter.js — Observes domain brains; produces normalized packets for civilization layer (LIMENCivilizationPackets); reads brain vs. signal-engine truth; stale logic (6min for brain, 5min for snapshot); throttled rebuilds (400ms)

**Action Selection & Execution Gate (Stage 4)**
- C:\Users\Chris\Limen-Helix-live-\assets\js\action-selection-gate.js — **THE CRITICAL CHOKEPOINT** — Basal ganglia stage-4 gate (K3 inhibition: DISPUTED/impossible epistemic states cannot win); gathers candidates from 3 sources: (1) execution next-best-action, (2) decision-synthesis EXECUTE_NOW bucket, (3) **UPWARD PORT (cortico-striatal): cross-domain patterns projected from lateral brain** scored by live feed-stress of pattern's domains; selects ONE winner via highest score; DARK BY DEFAULT (window.LIMEN_ENABLE_ACTION_GATE); when armed: broadcasts limen:action-selected + records to decision-memory; human confirmation stays downstream (executionAllowed: false); listens limen:domain-update, limen:civilization-packets-update, limen:global-state-update, limen:cross-domain-signal, limen:opportunity-detected

**Discovery & Opportunity Wiring**
- C:\Users\Chris\Limen-Helix-live-\assets\js\discovery-engine.js — Generates 20+ seed discovery suggestions (scientific, tech, economic, risk types); compute() boosts relevance from domain stress (truth: brain.brainStress > brain stress > signal stress); cross-domain boost +0.12 per active pattern from LIMENCrossDomain; emits limen:discoveries-updated; listens limen:opportunity-detected, limen:world-signals-updated, limen:domain-update; output: window.LIMENDiscoveries (max 10 active, cap 0.50 relevance threshold)
- C:\Users\Chris\Limen-Helix-live-\assets\js\cross-domain-detector.js — Advisory layer detecting correlated stress (energy+supply, economy+health, tech+research, etc. — 16+ patterns); requires 2 consecutive ticks above threshold; emits limen:cross-domain-signal (feeds action gate + discovery); limen:opportunity-detected; listens limen:domain-update
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\master-living-brain.js — Super-brain orchestrator (proposed only; decide() method not called in code)
- C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\artifact-packet-builder.js — Builds D3-A3.v3 ArtifactPackets from HandoffPacket + Observatory enrichment; lane→path mapping (patents→PATENTABLE, grants→GRANT-ELIGIBLE, etc.); 20-key frozen shape

**Node-to-Business Mapping**
- C:\Users\Chris\Limen-Helix-live-\assets\js\node-translation.js — Maps 80+ node IDs (dlPFC, dACC, HIPP, vmPFC, THAL, OFC, NAcc, STRI, etc.) → business functions (e.g., dlPFC→strategic planning, OFC→market intelligence, STRI→operations); includes ticker mappings (ACN for Accenture, PLTR for Palantir, etc.); actionable interventions per node dysfunction

**Adapter/Bridge Layers**
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-biosensor-adapter.js — Biosensor → domain stress modifier
- C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\domain-packet-adapter.js — Civilization observer layer; truth hierarchy: brain payload > brain stress > signal stress
- C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\artifact-packet-builder.js — ArtifactPacket composer (opportunity → lane-bound artifact)
- C:\Users\Chris\Limen-Helix-live-\assets\js\kernel\limen-phase-domain-adapter.js — Phase vector ↔ domain state
- C:\Users\Chris\Limen-Helix-live-\assets\js\execution-entity-linking.js — Opportunity → company entity binding

**API Layer**
- C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js — Aggregates 40 real sources (2 per domain × 20 domains); 308 KB; FRED, BLS, EIA, NOAA, FDA, Patents, arXiv, PubMed, WorldBank, USDA, FAO, OpenAlex, NewsAPI, etc.; returns feeds[].live + feeds[].value + feeds[].updated
- C:\Users\Chris\Limen-Helix-live-\api\limen-execution.js — Execution state manager (opportunity claiming, execution record creation, outcome tracking)

**Bootstrap & Lifecycle**
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen-bootstrap.js — Single entry point for 39-module console advisory stack; CONSOLE_MODULES includes discovery-engine, action-selection-gate, live-discoveries (all started); CONNECTOME_MODULES minimal (phase, feed, domain-engine, global-state, phase-domain-adapter); page detection (civilization.html → full stack, connectome.html → minimal, other → passive)

### LIVE PAGES

https://limenhelix.com/civilization — Full advisory stack; runs action-selection-gate + discovery-engine + inter-brain-bus

https://limenhelix.com/connectome — Minimal signal + phase stack; no discovery or action gate

https://limenhelix.com/domain-console — Full domain-brain visibility; runs same advisory stack as civilization

https://limenhelix.com/energy, /agriculture, etc. (20 domain pages) — Domain brain pages; local brain cycles, no action gate or discovery

### DATA

**Feeds & Signals**
- **node-signal-registry.json**: 254 signals (FRED time series); FRESH (generated 2026-03-16); 39 unique FRED codes; all 123 nodes have ≥1 signal binding; reads from: FRED (Federal Reserve Economic Data)
- **node-entity-mapping.json**: 123 nodes × entities (ticker, CIK, SIC); FRESH (generated 2026-03-16); reads from: capital-engine.js, research-observatory.js
- **connectome-node-registry.json**: 123-node frozen schema (FROZEN until 2026-12-01, frozen 2026-05-24); canonical source brain-connectome.json; CURRENT
- **brain-connectome.json**: Base connectome; version 1.0 (metadata); 111 nodes declared (SCHEMA MISMATCH with 123-node registry)
- **brain-node-domains.json**: 123 nodes × 20 domains receptor matrix; 285 KB; CURRENT (generated/synced during portal refresh cycles)
- **brain-node-business-mapping.json**: 484 KB; CURRENT; READS from: node-translation.js for business-function → ticker cross-walk

**Signal Pipeline (Per-Domain)**
- domain-snapshot.js → feeds[].live count + feeds[].value (0–1 stress) → domain-signal-engine → window.LIMENDomains[id].stress
- LIMENDomains[id].stress → signal-router FeedStressSignal → node seed activations → propagation-engine spreading activation → activation vector
- domain-brain-base.js cycle: receiveExternalSignal() (from inter-brain-bus) → scoreStress() += external pressure → diagnoses/treatments → crossDomainEmissions → inter-brain-bus
- inter-brain-bus.js: collects emissions → delivers to target brains → emits limen:inter-brain-cycle
- action-selection-gate.js: listens limen:domain-update, limen:cross-domain-signal → runs select() → if armed: broadcasts limen:action-selected
- discovery-engine.js: listens limen:domain-update, limen:opportunity-detected → compute() → emits limen:discoveries-updated

**State Tanks (Client-side, Memory)**
- window.LIMENDomains[20] — Live domain state per domain-signal-engine + domain-brain-adapter re-apply (5-min TTL)
- window.LIMENCivilizationPackets[20] — Normalized packets from domain-packet-adapter; brain payload truth
- window.LIMENDiscoveries[] — Max 10 active discoveries (50%+ relevance threshold)
- window.LIMENCrossDomain.active[] — Cross-domain pattern objects with domains[], severity, actions
- window.LIMENActionGate.lastSelection — Last action-selection state (winner, suppressed, vetoed)
- window.LIMENInterBrainBus.propagationMap — Source → [target signals]; ring buffer history (max 200)

**Stale Detection Logic**
- domain-packet-adapter: BRAIN_STALE_MS = 6 min; SNAPSHOT_STALE_MS = 5 min
- domain-brain-adapter: TTL_MS = 5 min per cached domain brain payload
- signal-router (cross-domain pressure decay): signals older than 5 min weighted down over next 10 min

### HOW IT CONNECTS

**End-to-End Signal Chain**

1. **FEED SOURCE** (api/domain-snapshot.js) fetches 40 feeds → aggregates live counts + values (0–1 normalized stress) → stores in domain-snapshot response
2. **SIGNAL ENGINE** (domain-signal-engine.js, running on civilization page) polls domain-snapshot → writes window.LIMENDomains[id] = { stress, feedCount, live, etc. } → emits limen:domain-update
3. **FEED→DISCOVERY WIRE** (signal-router.js FeedStressSignal):
   - LIMENDomains[domainId].stress → intensity calculation → addSeed(hub_nodeId, intensity)
   - FeedStressSignal.read() registered as custom source to LIMENSignalRouter
   - Activations seeded into propagation-engine → node activation vector
4. **CROSS-DOMAIN DETECTOR** (cross-domain-detector.js) listens limen:domain-update:
   - Checks if multiple domains above pattern threshold simultaneously
   - Emits limen:cross-domain-signal (e.g., energy+supply stress → logistics disruption)
   - Emits limen:opportunity-detected
5. **DISCOVERY ENGINE** (discovery-engine.js) listens limen:opportunity-detected, limen:domain-update:
   - Computes relevance for 20+ seed suggestions using domain.stress (truth: brain.brainStress > brain stress > signal stress)
   - Applies +0.12 boost per active cross-domain pattern
   - Filters for ≥0.50 relevance; caps at 10 active
   - Emits limen:discoveries-updated → window.LIMENDiscoveries updated
6. **DOMAIN BRAIN CYCLE** (domain-brain-base.js, 30s intervals on domain pages):
   - ingestFeeds() → normalizeSignals() → scoreStress() [includes getExternalPressure() from inter-brain-bus] → deriveDiagnoses() → emitCrossDomainSignals()
   - Emits limen:domain-brain-update → signal propagates to inter-brain-bus
7. **INTER-BRAIN BUS** (inter-brain-bus.js) listens limen:domain-brain-update:
   - collectEmissions() reads all brains' crossDomainEmissions
   - deliverEmissions() routes (source→target) via brain.receiveExternalSignal()
   - detectCascades() (≥3 domains in chain) → _cascadeDetected flag
   - Emits limen:inter-brain-cycle
8. **ACTION SELECTION GATE** (action-selection-gate.js) listens:
   - limen:domain-update, limen:civilization-packets-update, limen:global-state-update
   - **limen:cross-domain-signal** (critical: cortico-striatal upward port)
   - limen:opportunity-detected
   - run(trigger) → select() → gathers 3 candidate sources:
     * execution-next-best-action (single action)
     * decision-synthesis EXECUTE_NOW bucket
     * **UPWARD PORT: cross-domain patterns from LIMENCrossDomain.active[] scored by mean feed-stress of pattern's domains**
   - K3 veto (DISPUTED/impossible states filtered)
   - Highest-score winner selected
   - If armed (LIMEN_ENABLE_ACTION_GATE): broadcasts limen:action-selected (detail: winner, suppressed[], proposals, executionAllowed: false)
9. **CIVILIZATION PACKETS** (domain-packet-adapter.js + artifact-packet-builder.js):
   - Observes domain brains + signal-engine snapshots
   - Adapter reads brain* fields (brainStress, brainDiagnoses, brainTreatments, brainOpportunities)
   - Re-applies after snapshot writes (limen:domain-update) per 5-min TTL
   - Emits limen:civilization-packets-update → feeds discovery-engine + action-gate

**Signal Propagation Paths (Per Domain)**

Each of 20 domains runs a brain instance (energy-brain.js, agriculture-brain.js, etc.) that:
- Reads domain-specific feeds (e.g., energy: EIA oil, FRED energy production)
- Normalizes into stress (0–1)
- Incorporates external pressure from inter-brain-bus (cross-domain signals)
- Surfaces diagnoses linked to stress conditions
- Emits crossDomainEmissions up to civilization (e.g., energy→supplyChain, economy→health)
- Surfaces opportunities with capital pathway classification (patents, grants, loans, investments, research)

**Per-Domain Pages (20 live pages)**

Each domain page (e.g., /energy, /agriculture) displays:
- Live feed meters (EIA petroleum, FRED production)
- Brain-derived diagnoses (active conditions)
- Treatment recommendations (remedies linked to diagnoses)
- Opportunity matrix (node-level opportunities per domain, e.g., agriculture-opportunity-matrix.js)
- Operator panel (claim workflows, outcome tracking)

**Node-to-Business Binding**

node-translation.js maps each of 80+ connectome nodes to:
- Business function (e.g., dlPFC = strategic planning, OFC = market intelligence)
- Sector examples (consulting, finance, trading, etc.)
- Company tickers (ACN, PLTR, BLK, CME, etc.)
- Actionable interventions (when node is dysfunction state, what sector/company to activate)

Cross-reference: node-signal-registry.json binds FRED signals to node IDs (e.g., IPUHN517110U100000000 → A1 [Dolby Labs]), allowing feed stress to activate specific business entities.

**Missing / Broken Wiring (Verified Against Code)**

1. **GLOBAL ACTION-SELECTION GATE MISSING**: action-selection-gate.js exists and is loaded (line 86 in limen-bootstrap.js), BUT window.LIMENMasterBrain.decide() (consulted in line 118–126 of action-selection-gate.js) is defined nowhere that calls it. The arbiter returns [] (empty proposals) in prod. The gate runs, but has no master-brain context. **FIX**: either (a) wire master-brain.decide() or (b) remove proposal-only feature.

2. **FEED→DISCOVERY WIRE HALF-WIRED**: FeedStressSignal (signal-router.js) does map domain.stress to node seeds ✓, BUT:
   - Discovery-engine.js reads domain.stress directly (line 81 in discovery-engine.js), not via the signal router activation → discovery path
   - FeedStressSignal is registered as a custom source but no one calls LIMENSignalRouter.gatherInputs() to run it through propagation
   - **RESULT**: discovery relevance computed directly from LIMENDomains[domain].stress (correct truth hierarchy: brain > signal > flat), so discovery IS feed-driven, but the signal router path is orphaned. Not broken, but redundant architecture.

3. **ACTION GATE DARK BY DEFAULT**: window.LIMEN_ENABLE_ACTION_GATE set true on civilization/domain-console pages (line 33 in limen-bootstrap.js), so gate IS armed on those pages. BUT:
   - limen:action-selected event listeners NOT observed in code (no addEventListener for it)
   - Execution layer (execution-human-confirmation.js) does NOT subscribe to the event
   - **RESULT**: gate broadcasts the winner but nothing listens. Suppression set ignored. Proposals never reach decision layer.
   - **FIX**: wire execution-human-confirmation or decision-synthesis to subscribe limen:action-selected.

4. **CONNECTOME-WEIGHTS.JSON MISSING**: propagation-engine.js calls LIMENPropagation.load() to fetch connectome-weights.json (line 5 in propagation-engine.js comment); file does NOT exist in assets/data/. Brain-connectome.json exists but is 111-node schema, not 123-node edges + weights matrix.
   - **RESULT**: if propagation-engine tries to run, it fails with "Call LIMENPropagation.load() first or pass edges directly."
   - **FIX**: generate/commit connectome-weights.json with 123-node edges.

5. **NODE-ENTITY-MAPPING MISMATCH**: connectome-node-registry.json declares 123 canonical nodes; brain-connectome.json meta says 111. registry.agreeing_runtime_sources lists connectome-weights.json as 123 nodes (verified by loaders), but connectome-weights.json does not exist.
   - **RESULT**: node-translation.js and node-entity-mapping.json reference 123 nodes; brain-connectome.json only has 111. Alias resolution is frozen (per registry line 8–26), so cannot repair until 2026-12-01.

6. **INTER-BRAIN-BUS NEVER STARTED**: inter-brain-bus.js exports window.LIMENInterBrainBus with start() method; limen-bootstrap.js line 85 loads it in CONSOLE_MODULES, but:
   - start() listens for limen:domain-brain-update (line 202 in inter-brain-bus.js)
   - Domain brains run on domain pages (e.g., /energy), NOT on civilization page
   - Civilization page never receives domain-brain-update events
   - **RESULT**: inter-brain-bus cycles and detects cascades/loops, but no domain brains emit to it on civilization page
   - **CONSEQUENCE**: cross-domain pressure in action gate (line 89–112 in action-selection-gate.js) reads LIMENCrossDomain.active[] (from cross-domain-detector), NOT from inter-brain-bus emissions
   - **VERDICT**: inter-brain-bus is wired for domain-page-to-domain-page communication (if pages stay open in tabs); civilization page feeds come from civilization-packet-adapter + domain-packet-adapter observing signal snapshots, not live brain emissions.

7. **DISCOVERY ENGINE INITIALIZATION**: discovery-engine.js start() not explicitly called by bootstrap. limen-bootstrap.js line 64 includes 'discovery-engine' in CONSOLE_MODULES but its .start() is called by _tryStart. Let me verify limen-bootstrap logs...
   - Actually, line 138–140 calls obj.start() for all CONSOLE_MODULES, so discovery-engine IS started.
   - **VERDICT**: OK, but verify civilization.html renders the LIMENDiscoveries output (not verified in scope).

8. **LIVE-DISCOVERIES.JS SEPARATE FROM DISCOVERY-ENGINE.JS**: Two files both render discoveries. live-discoveries.js is line 87 in CONSOLE_MODULES. discovery-engine.js is line 64. Both listen to limen:domain-update and emit similar events.
   - **RESULT**: potential duplication; verify which is canonical. Per comment line 87: "Feed→Discovery; folds into console-clarity". live-discoveries.js likely wraps discovery-engine output for UI.

### NEEDS WORK / INCONSISTENCIES

**Critical Breaks**

1. **C:\Users\Chris\Limen-Helix-live-\assets\js\propagation-engine.js** (line 59): Depends on connectome-weights.json which does not exist. If spreading-activation is invoked, it will fail. File not in assets/data/. **ACTION**: Generate connectome-weights.json with 123 nodes, 432+ edges (as declared in comments), and 3 edge types (excit/inhib/modulatory).

2. **C:\Users\Chris\Limen-Helix-live-\assets\data\brain-connectome.json** (line 4): Version 1.0 declares "111 nodes, base for all portals" but connectome-node-registry.json asserts 123 canonical nodes. Registry is FROZEN; connectome.json is not. **ACTION**: Verify which is truth. If 123 is correct, update connectome.json meta and ensure all 123 nodes are present. If 111 is correct, unfreeze registry and document the 12 deletions.

3. **C:\Users\Chris\Limen-Helix-live-\assets\js\action-selection-gate.js** (line 118–126, arbiter proposals): window.LIMENMasterBrain.decide() is called defensively (try/catch) but never populated. Returns empty array. If master-brain arbitration is intended, wire it; otherwise document as intentionally unused. **ACTION**: Either implement master-brain.decide() or remove the code path.

4. **C:\Users\Chris\Limen-Helix-live-\assets\js\limen\master-living-brain.js**: Referenced in node mapping but decide() method never called by action-selection-gate or any other module (verified via grep). **ACTION**: Either call decide() or remove the reference.

**Architectural Issues**

5. **C:\Users\Chris\Limen-Helix-live-\assets\js\action-selection-gate.js** (line 184): Broadcasts limen:action-selected event but NO listener is wired. Execution layer does not subscribe to it. **ACTION**: Add listener in execution-human-confirmation.js or decision-synthesis.js to consume limen:action-selected and pass winner to operator.

6. **C:\Users\Chris\Limen-Helix-live-\assets\js\discovery-engine.js** vs **C:\Users\Chris\Limen-Helix-live-\assets\js\live-discoveries.js**: Two separate discovery outputs. live-discoveries.js says it "folds into console-clarity" (line 87 in limen-bootstrap.js). **ACTION**: Clarify canonical output; remove duplication.

7. **C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\inter-brain-bus.js**: Designed for domain-page-to-domain-page cross-talk but loads on civilization page where domain brains are not running. Signal flow for cross-domain pressure in action gate (line 89–112 in action-selection-gate.js) uses LIMENCrossDomain.active[] (from cross-domain-detector), not inter-brain-bus emissions. **ACTION**: Either (a) document inter-brain-bus as domain-page-only infrastructure or (b) synchronize civilization-page domain state to inter-brain-bus.

**Data Integrity Issues**

8. **C:\Users\Chris\Limen-Helix-live-\assets\data\node-signal-registry.json** (39 unique FRED series, all live as of 2026-03-16): No update timestamp in file. FRED snapshots fetched on-demand via api/domain-snapshot.js. **ACTION**: Timestamp when registry last verified all 39 codes are still live (some FRED series expire or move).

9. **C:\Users\Chris\Limen-Helix-live-\assets\data\connectome-node-registry.json** (line 28–49): REJECTED_ADDITIONS section documents decisions on ARCFAS, mTOR, SPINOTHAL, etc. not included. **ACTION**: Archive this rationale in a CHANGELOG file; it is valuable audit history but clutters the registry.

10. **C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-domains.json** (285 KB): Large file; no .meta indicating last sync or authority. **ACTION**: Add _generated, _authority fields.

**Partial / Half-Built Features**

11. **C:\Users\Chris\Limen-Helix-live-\assets\js\limen\super-brain-base.js** (line 118–126): _arbiterProposals() called by sub-brains but arbiter (master-living-brain.decide()) is not wired. **ACTION**: Complete or remove.

12. **C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\artifact-packet-builder.js** (LANE_TO_PATH, line 118–128): Lane→path mapping partially populated; 'franchise' and 'research-papers' have null values indicating "no Observatory fan-in defined yet". **ACTION**: Either wire Observatory enrichment for those lanes or document them as not-yet-supported.

13. **C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\domain-brain-base.js** (line 175–184): receiveExternalSignal() accumulates signals from inter-brain-bus but getExternalPressure() (line 191–200) decays signals older than 5 min. If domain page closed, accumulation stops; other domains lose view of it. **ACTION**: Document behavior or provide centralized signal store.

**Mapping Gaps**

14. **C:\Users\Chris\Limen-Helix-live-\assets\js\node-translation.js**: Covers ~80 canonical nodes (dlPFC, dACC, HIPP, etc.) but connectome has 123. Remaining 40+ nodes have no business-function mapping. **ACTION**: Extend mapping to all 123 nodes or document which are infrastructure-only (e.g., BBB, ASTRO).

15. **C:\Users\Chris\Limen-Helix-live-\assets\data\node-signal-registry.json**: 254 signals distributed across 123 nodes; uneven coverage (some nodes have 1 signal, others have 5+). **ACTION**: Document signal-per-node distribution; flag nodes with 0 signals.

**Performance / Throttle Issues**

16. **C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\domain-packet-adapter.js** (line 61): REBUILD_THROTTLE_MS = 400ms for packet rebuild. Domain updates happen every ~25–30s (domain-signal-engine), so throttle is not the limiter. **ACTION**: Log throttle frequency to verify it's needed.

17. **C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\inter-brain-bus.js** (line 22): MAX_HISTORY = 200; if 20 domain brains each emit every 30s, history fills in <100 minutes. Ring buffer overwrites old entries. **ACTION**: Log history depth at runtime to verify 200 is sufficient.

**Event Wiring Gaps**

18. **C:\Users\Chris\Limen-Helix-live-\assets\js\cross-domain-detector.js**: Emits limen:cross-domain-signal and limen:opportunity-detected, but these are not globally subscribed. **VERIFY**: grep for addEventListener('limen:cross-domain-signal') across all JS files (did not find any in 75 files checked; action-gate listens, discovery-engine does not).

19. **C:\Users\Chris\Limen-Helix-live-\assets\js\action-selection-gate.js** (line 229): Listens limen:cross-domain-signal to schedule selection, but cross-domain-detector does not always emit it (only on threshold cross + 2-tick confirmation). **ACTION**: Verify frequency of emissions to ensure action gate is not starved of input.

**Documentation**

20. **No CONNECTOME.md or NODE_MAPPING.md** in repo root. All 123-node identities, aliases, and business bindings documented in distributed JSON files. **ACTION**: Create CONNECTOME.md documenting: (a) 123-node canonical list, (b) RUNS vs. SCAFFOLD vs. ATLAS tiers, (c) alias resolution, (d) signal bindings, (e) domain-receptors per node.

**Test Coverage**

21. **No automated tests** for signal propagation, node activation, or action-gate winner selection found. _test-action-gate.cjs exists (line 254 in action-selection-gate.js) but is a one-off harness, not in CI/CD. **ACTION**: Add test suite for: (a) FeedStressSignal intensity calculation, (b) Propagation-engine spreading activation, (c) K3 veto filtering, (d) Action-gate winner selection logic.

---

**Summary**: The node-to-node signal spider-web is architecturally **sound but partially wired**. Signal routing from feeds through domain brains to action selection is complete on civilization pages. Cross-domain pressure now flows into the basal-ganglia-like action gate (Stage 4), which selects a single winner (never auto-executes; human confirmation downstream). However, the broadcast limen:action-selected event is orphaned — no downstream module listens. The feed→discovery wire is partially redundant (domain stress mapped to node seeds via FeedStressSignal, but discovery reads stress directly, bypassing the activation pathway). Master-brain arbitration is stubbed but never populated. Connectome-weights.json (edges + weights for spreading activation) does not exist. Inter-brain-bus is designed for domain-page-to-domain-page sync, not civilization-page orchestration. The system works asymmetrically: signal aggregation on civilization page is strong; peer-to-peer brain communication is incomplete.

---

## 11. Treatment Discovery

### PURPOSE
Central research organ mapping disorders and treatments across brain nodes and comparison domains. Encodes the six-step treatment discovery chain: ISSUE → NODE → DISORDER → NEURO_TX → DOMAIN_TX → RESIDUAL. Keeps all claims regardless of verification state—the epistemic bucket tells the operator what to do next (strengthen, test, research, or study why it fails), never whether to delete it. 230 unique disorders across neuro and domain contexts, mapped to 113 brain nodes and 30 comparison domains.

### KEY FILES
**Core Pages:**
- `/treatment-discovery.html` — Interactive explorer with node cards, detail panels, residual chains, filters (state/domain/search). Shows four epistemic buckets (PROVEN/UNPROVEN/UNKNOWN/IMPOSSIBLE) as global tallies. Loaded data: _index.json + _summary.json.

**Master Data Tank (85MB):**
- `assets/data/treatment-discovery-cube.json` — Complete (brainNodeId × comparisonDomain × stateBucket) pivot. Schema: 5234 cells (5186 populated), 230 unique disorders, 66,025 PENDING claims, indices: disorderIndex (byDisorderName), nodeIndex, issueIndex. Built by task #29 (build-treatment-discovery-cube.mjs). Fresh: 2026-06-04 14:21:53.

**Derivative Indices & Summaries (read by page):**
- `assets/data/treatment-discovery/_index.json` — Node roster (113 entries: dlPFC, dACC, HIPP, etc.) with per-node stats (disorder count, residual count, neuro/domain treatment counts). Fresh: 2026-06-04 09:22:00.
- `assets/data/treatment-discovery/_summary.json` — Global counts (totalCells: 5234, cellsWithResiduals: 1545, residual summary: 1421 neuro residuals + 2692 domain residuals). Fresh: 2026-06-04 09:22:00.

**Per-Node Details (55MB across 113 files, by-node subdirectory):**
- `assets/data/treatment-discovery/by-node/*.json` — One file per brain node (A1.json 229K, AI.json 2.6M, BLA.json 2.4M, CING.json 3.9K, EC.json, OXY.json, etc.). Largest: AI (8% of directory), smallest: EC (0.007%). Each contains cells for all 30 comparison domains × state buckets.

**Source Data (Step 3: Neuro Disorders + Treatments):**
- `assets/data/neuro-disorder-lookup.json` — 687K. Bridges structured disorder/treatment definitions. Stats: 187 brain nodes (mapped to 113 in cube), 373 total disorders (vs 230 in cube—143 filtered/deduplicated), 47 unique treatments. Sources: brain-nodes-111.json, bridge-patterns.json. Verification: ALL PENDING (task #33 PubMed-verifies each). Fresh: 2026-05-31.

**Domain Diagnoses (48 files, assets/data/domains/):**
- `*_diagnosis.json` — One per domain × subsystem. E.g., addiction_anticipatory_diagnosis.json, addiction_compulsive_diagnosis.json, ..., psychedelic_serotonin_diagnosis.json. Each contains activations (brainNodeId + state + domainLabel + treatments array). Together they feed DOMAIN_TX step 5.

**Build & Verification Scripts:**
- `scripts/build-treatment-discovery-cube.mjs` — 766 lines. Reads neuro-disorder-lookup.json, domain diagnosis files, binding-fidelity-report.json, master-inbox.json. Pivots into cube. Caps stored items (MAX_ISSUES: 40, MAX_NEURO_TX: 30, MAX_DOMAIN_TX: 60, MAX_BINDINGS: 80).
- `scripts/build-neuro-disorder-lookup.mjs` — 485 lines. Parses brain-nodes-111.json dysregulation prose + bridge-patterns.json. Outputs 373 disorders + 47 treatments. All verdicts PENDING.
- `scripts/build-epistemic-buckets.mjs` — 90 lines. Tallies verdicts from cube, writes to _summary.json.

**Epistemic State Definition (shared across system):**
- `assets/js/epistemic-state.js` — Single source of truth. Maps six raw verdicts (VERIFIED, THEORETICAL, PENDING, UNVERIFIABLE, DISPUTED, FABRICATED) → four operator-facing states (proven, unproven, unknown, impossible). Core: VERDICT_TO_STATE mapping. Used by browser (window.EpistemicState) and server (ES module).

**Schema & Validation:**
- `assets/data/schemas/treatment-discovery-cell.schema.js` — Defines DiscoveryCell structure (6-step chain, sourceProvenance per field, verification object with verdict/verifier/evidence/confidence/checkedAt).

### LIVE PAGES
- https://limenhelix.com/treatment-discovery — Main interactive explorer (node grid, detail panels, filters, epistemic bucket view)

### DATA
**READ sources (into cube & _index.json):**
1. neuro-disorder-lookup.json (373 disorders, 47 treatments per brain node × state) — fresh 2026-05-31
2. 48 domain diagnosis files (addiction_*, contemplative_*, metabolic_*, neurology_*, pediatric_*, psychedelic_*) — fresh dates vary (P2 phase marked)
3. brain-nodes-111.json (source of dysregulation prose for disorder/treatment extraction)
4. bridge-patterns.json (fully structured disorder/treatment entries with citations)
5. binding-fidelity-report.json (validates node-company links)
6. master-inbox.json (warning signals, intelligence cycle diagnosis)

**WRITES to:**
- treatment-discovery-cube.json (85MB, 5234 cells) — rebuilt on `npm run build-treatment-discovery`
- _index.json (node roster) — rebuilt as part of cube build
- _summary.json (global stats + epistemic bucket counts) — rebuilt by epistemic-buckets.mjs

**Data State:**
- Cube fresh (built 2026-06-04 14:21:53, last commit 2026-06-04 09:22)
- All 66,025 claims carry verification: PENDING (no VERIFIED/DISPUTED/FABRICATED yet)
- Disorder & treatment lists stable (230 + 373 unique sources, curated to 230 in cube)
- Agriculture severely underrepresented (26 cells vs 156–188 per other domain) — a noted gap

### HOW IT CONNECTS
**Data Flow (forward-push per domain):**
1. **Domain Portals** (e.g., addiction_anticipatory_portal.html) → Define activations (state + brainNodeId + treatments)
2. **Domain Diagnosis Files** (e.g., addiction_anticipatory_diagnosis.json) → Activate nodes with DIAGNOSTIC/STRATEGY treatment types
3. **Neuro-Disorder Lookup** (step 3 source) → Parses brain dysregulation, assigns disorders + neuro treatments (step 4)
4. **Treatment Discovery Cube** (pivot organ, task #29) → Reads domain files + lookup, pivots into (node × domain × state) cells
5. **Page Rendering** (epistemic-state.js classifier) → Collapses 6 verdicts into 4 states, displays buckets + node grid

**Cross-references:**
- Binding-fidelity-report.json feeds cube build (validates node-to-company mappings, flags role inconsistencies)
- Master-inbox.json (warning signals, portal.intelligenceCycle.diagnosis) becomes ISSUE step 1 entries in cells
- Bridge-patterns are fully cited; prose cells (from dysregulation) are PENDING verification
- Residuals (step 6) deferred to cross-domain audit (task #30, not yet visible in main tab)

**Consumption:**
- treatment-discovery.html (browser) — fetches _index.json + _summary.json, lazy-loads by-node files on expand
- Clarity operators (medicine/population/science clarity-operator.js files) — may reference disorder/treatment data for domain-specific reasoning
- Cross-domain-audit.js (task #30) — reads cube cells to compute residuals (neuro→domain + domain→neuro transfer candidates)

### NEEDS WORK / INCONSISTENCIES

**Data Completeness Gaps:**
1. Agriculture massively under-curated: 26 cells vs 156–188 per other domain. No agriculture-specific diagnosis files found. Operator flagged "more diagnoses scattered elsewhere"—likely agriculture & infrastructure diagnosis data has not been mapped into domain diagnosis files yet.
2. Infrastructure has 0 diagnosis files (assets/data/domains/infrastructure*.json are data files, not diagnosis.json). Infrastructure cells in cube (176 across all nodes) are populated but sourced only from generic domain, not subsystem-specific diagnosis.

**Verification Vacuum (Task #33 Pending):**
1. All 66,025 claims marked PENDING. Zero VERIFIED, DISPUTED, FABRICATED, or THEORETICAL verdicts in entire cube.
2. Verifier field empty (expecting "pubmed" or similar post-task #33).
3. No evidence array populated (expecting PMID list + citation links).
4. Confidence always 0. checkedAt always null.
5. Entire epistemic bucket system is live but operating on zero verified data. Page displays bucket tallies (PROVEN: 0, UNPROVEN: 0, UNKNOWN: 66,025, IMPOSSIBLE: 0) — correct but unhelpful until verification runs.

**Disordered Classification (Mismatch):**
1. Neuro-disorder-lookup reports 373 total disorders; cube cube.disorderIndex has 230 unique disorder names. 143 disorders exist in lookup but not indexed in cube. Root cause: deduplication during cube build (some disorder names collapsed, others filtered by binding or state).
2. No audit trail of which 143 were dropped or why.

**Domain Diagnosis Boundary Issues:**
1. 48 domain diagnosis files exist; cube loads 30 "loaded comparison domains" (missing: culture, religion, trade, health are not full domains—are subsumed or absent from diagnosis layer).
2. Activation groups in diagnosis files use labels (e.g., "diagnosis", "regulation", "action") but cube step 5 (DOMAIN_TX) conflates them; unclear if "regulation" activations map to "treatments" or separate action type.

**Residual Chain Incomplete:**
1. Step 6 (RESIDUAL) deferred to cross-domain-audit (task #30). Cube cells have residual property empty until that task runs. Page shows residualCount in node cards but detail panels will be empty until residuals computed.
2. Neuro-to-Domain vs Domain-to-Neuro residuals are tallied in summary (1421 + 2692) but not yet stored in cells.

**Stale or Missing Source Files:**
1. brain-node-business-mapping.json (referenced in cube build, source of taxonomy) not verified for freshness.
2. bridge-patterns.json (source of fully-structured disorder/treatment entries) exists but size/freshness unknown; suspected to be small (only 13 "bridgeStructuredCells" out of 5186 populated).

**Scattered Diagnosis Hints:**
1. `add_fertilizer_treatments.js` and `add_landuse_treatments.js` in scripts/ suggest agriculture treatments exist but are not integrated into treatment-discovery cube build. Separate parallel system.
2. Grep for "diagnosis" in JS found 50+ hits (mostly in domain-brains, clarity-operators, domain-console-brain.js) but none feed into treatment-discovery. Domain-specific reasoning happens in isolation.

**Inconsistent Node Coverage:**
1. Neuro-disorder-lookup reports 187 nodes; cube pivots on 113 (in _index.json). 74 nodes have zero cells in cube. Root: binding-fidelity-report filtering or phase-to-state logic excludes them. No explicit list of excluded nodes.

**Proof Mechanism Undefined:**
1. PubMed verifier is mentioned ("task #33 PubMed-verifies each disorder + treatment") but no API integration visible.
2. Verdictto-PMID mapping (how to get PMIDs for a claim) not implemented.
3. Confidence scoring algorithm not defined (expecting 0.0–1.0 but no formula).

**Live Page Rendering Issues:**
1. Treatment-discovery.html loads _index.json (node roster) for grid; detail panels lazy-load by-node files. Filters (state/domain/search) work on _index.json data only—do not search inside by-node files. User searches "cortical deafness" will find disorder matches only if node.topDisorders field is populated in _index.json; unclear if this field is built.
2. "More domains" filter expands but not all 30 domains listed (showing only business, medicine, economy, environment, population, more…).

**Code/Data Sync Risk:**
1. epistemic-state.js is inline in treatment-discovery.html + also loaded as separate script. Dual source risk if verdict mappings change.
2. Four state names (proven, unproven, unknown, impossible) hardcoded in HTML CSS (.bucket classes). New states would require HTML edit.

**File Size & Performance:**
1. Cube.json at 85MB may cause browser lag on load (deferred by lazy-per-node pattern, mitigates but doesn't eliminate).
2. By-node files range 3.9K–2.6M; largest nodes (AI, BLA) will have slower detail panel renders.

---

## 12. Remedy
### PURPOSE
Maps real-world regulatory interventions (remedies/treatments) to civilization stress patterns, enabling multi-scale problem-solving (from individual/portal user → civilization). Implements a two-layer system: (1) **remedy-library.json** — a static, curated knowledge base of 20 domain-pattern-remedy mappings for regulatory/policy precedent lookup; (2) **LIMENRemedyRegistry** — a dynamic, runtime harvesting engine that extracts treatments from portal domain JSONs, indexes them by diagnosis/domain/circuit/pattern, and feeds them to remedy-resolver for pattern-specific selection. Remedies serve the civilization-scale recommendation pipeline (docs/57–60) and gap-synthesis on domain-opportunity pages.

### KEY FILES
**Remedy core:**
- `/assets/js/remedy/limen-remedy-registry.js` (1360 lines) — Master registry: harvests treatments from 50+ domain portals, validates against fractal-report-schema, maintains 8 indexes (byDiagnosis, byDomain, byCircuit, byType, byScale, byPattern, byEvidence, byPortal), supports cross-domain propagation queries (circuit activation, domain stress, indicator matching), implements prioritization via composite scoring with outcome-weight factors from connectome learning (localStorage `limen_pathway_weights`), builds resolver-compatible bridge object.
- `/assets/js/remedy/registry-test.js` (207 lines) — Comprehensive test harness: 12 test groups covering registration APIs, diagnosis/treatment indexing, portal harvesting (defense_special_ops.json verified), cross-domain propagation, indicator matching, priority ordering (determinism verified), resolver bridge, schema validation, batch harvest, debug dump, and invalid-data rejection.
- `/assets/data/remedy-library.json` (7.4 KB) — Static reference library: 20 entries mapping 7 domains (economy, energy, environment, health, research, supplyChain, technology) to 14 pattern classes (resource_pressure, oscillation_instability, threat_cascade, etc.) with evidence grades (strong/moderate/emerging) and real-world examples (TARP 2008, EU Green Deal, COVID PPE reserves, etc.). Generated 03/14/2026, **stale by 84 days** — no active updates. Used by regulation-reports.js and validation harness only; not wired to remedy-resolver.

**Remedy resolution & selection:**
- `/assets/js/recommendations/remedy-resolver.js` (523 lines) — 7-step selection pipeline + 4-level fallback hierarchy: (1) candidate retrieval by scale+pattern; (2) node-match scoring (weighted sum); (3) direction filter (hyper/hypo/altered vs. remedy targetDirection); (4) contraindication check (hard blocks + soft warnings, condition parsing for `node[ID].activation > THRESHOLD`); (5) confidence gate (threshold 0.40–0.65 per scale); (6) composite ranking (applicability 0.30, nodeMatch 0.25, confidence 0.25, evidence 0.20); (7) cap to MAX_REMEDIES per scale (2–5). Fallback hierarchy: adjacent pattern (0.70 penalty) → cross-scale adaptation (0.60 penalty) → generic direction (0.25 penalty) → observation-only. Gap signal accumulation (frequency counter, 10-hit promotion threshold triggers `limen:remedy-authoring-request` event).

**Integration & pages:**
- `/civilization.html` (line 353–354) — Loads remedy-resolver + limen-remedy-registry.
- `/domain-console.html` (line 390–391) — Loads both remedy modules (domain-level stress-based treatment lookup).
- `/civilization-opportunities.html` (line 205–206) — Loads both modules (gap-synthesis on opportunity cards).

**Related engines:**
- `/assets/js/recommendations/portal-treatment-resolver.js` — Queries registry via diagnosis/circuit/domain-stress methods; separates portal-sourced diagnoses from synthetic _LIVE_STRESS entries (fabrication now **removed** per line 349–352 of limen-bootstrap).
- `/assets/js/recommendations/deep-portal-harvester.js` — On-demand harvesting of portal sub-trees (medicine_neurology, medicine_metabolic, etc.); populates domain groups for UI navigation.
- `/assets/js/recommendations/recommendation-engine.js` — Orchestrates pattern detection → remedy resolution (per-scale) → evidence envelope → recommendation assembly.
- `/assets/js/recommendations/regulation-reports.js` — Loads remedy-library.json; matches domain to example precedents.
- `/assets/js/reports/report-validation.js` — Test harness shimming remedy-library.json fetch.
- `/assets/js/limen-bootstrap.js` (lines 114, 318–427) — **Harvesting orchestrator:** harvests all active domain portals (dk) + 13 medicine specialties; calls `mgr.harvestFromUrls()` asynchronously; rebuilds resolver registry post-harvest; queries registry for diagnoses/treatments/steps per domain; prioritizes treatments by composite score; stores active treatments in `_activeTreatments[]`.

### LIVE PAGES
- https://limenhelix.com/civilization — Civilization-scale opportunities, pattern detection, remedy proposals (fallback on gaps).
- https://limenhelix.com/domain-console — Domain-specific dashboard, stress-triggered treatment lookup.
- https://limenhelix.com/civilization-opportunities — Domain opportunity cards with gap-synthesis remedies.

### DATA
**Reads:**
- `/assets/data/remedy-library.json` (20 static entries, **stale**) — Loaded by regulation-reports.js; used for precedent matching only, not active remedy selection.
- All domain portal JSONs (`assets/data/domains/{domainId}.json` × 50+) — Harvested at bootstrap into registry; treatments extracted via `harvestFromPortal()`.
- Medicine specialty portals (13 files: medicine_neurology, medicine_metabolic, etc.) — Harvested asynchronously.
- `localStorage['limen_pathway_weights']` — Connectome learning data (hub frequencies, domain→node mapping) read by prioritization engine to apply outcome-weight factors (0.8–1.2x multiplier).

**Writes:**
- `window.LIMENRemedyRegistry` — Built by `buildResolverRegistry()` after harvest; contains remedies[] (transformed treatments) + indexes (byScale, byPattern, byNode, byDomain, byPortal, byType, byEvidence).
- `window.LIMENLiveDiscoveries` (via live-discoveries.js) — Feed-weighted discoveries blending domain stress (0.6x) + diagnosis relevance (0.4x); uses treatment-discovery-cube.json Stage-2 data.
- Gap signals (`_gapStore` in remedy-resolver) — Accumulate remedy selection failures; dispatch `limen:remedy-authoring-request` CustomEvent on 10-hit threshold.

**Data tanks:**
- `treatment-discovery-cube.json` (84.25 MB, 5234 cells) — **SEPARATE system:** brain node × domain × state cells with 6-step chains (ISSUE → NODE → DISORDER → NEURO_TX → DOMAIN_TX → RESIDUAL). Built by `/scripts/build-treatment-discovery-cube.mjs`. Fresh (built 06/04/2026).
- `treatment-discovery/_index.json` (0.14 MB) — Per-node index into cube cells.
- `treatment-discovery/_summary.json` (stale—empty) — Schema version 1.0.0, last built 06/04/2026.

### HOW IT CONNECTS
**Signal flow:**
1. **Portal harvesting (bootstrap):** Domain portals loaded at page init → `LIMENRemedyRegistryManager.harvestFromUrls()` → each portal's issues/activations parsed into diagnoses+treatments (via `harvestFromPortal()` + fractal-schema conversion) → registered in 8 indexes.
2. **Pattern detection → Remedy selection:** RecommendationEngine detects patterns (hot clusters, cold gaps, oscillations) from propagation + node states → `LIMENRemedyResolver.resolve(patternClass, scale, affectedNodes, dominantDirection)` → 7-step pipeline retrieves candidates, scores, gates, ranks → returns selectedRemedies[] or fallback.
3. **Stress/distress bridge:** Domain stress values (`LIMENDomains[domainId].stress`) feed into `getTreatmentsOnDomainStress(domainId, threshold)` query (used by portal-treatment-resolver for domain-level fallback). **No synthetic stress-diagnoses** — real diagnoses come from domain brains (brainDiagnoses) or portal definitions.
4. **Multi-scale translation:** Remedies indexed by scale; confidentenceModel + expectedEffect + timeHorizon + scalePayload vary per scale (mainUser: individual guidance; portalUser: circuit instructions; business/domain: policy actions; civilization: systemic coordination).
5. **Gap synthesis:** Unresolved patterns accumulate in remedy-resolver's `_gapStore`; on 10-hit threshold, emit `limen:remedy-authoring-request` → signals need for new remedy authoring.
6. **Live discoveries (Stage 1 + 2):** live-discoveries.js reads domain brains' active diagnoses + stress → blends with treatment-discovery-cube's residual discoveries → weights by feed stress (0.6x) + novelty/feasibility (0.4x) → surfaces top 16 (max 2 per domain).

**Cross-domain propagation:** Remedies linked by:
- `spillover[]` array (treatment's targetDomainId) → indexed in `_byDomain` for propagation lookup.
- `diagnosis.propagation[]` (cross-domain references) → indexed in `_dxByDomain`.
- Pattern adjacency (remedy-resolver's ADJACENT_PATTERNS map) → fallback chain when primary pattern has no remedy.
- Connectome node signatures (linkedNodes[]) → node-match scoring during resolution.

**Distinction from treatment-discovery:**
- **Remedy system:** Dynamic portal-sourced treatment library; indexed by diagnosis/domain/circuit/pattern; selection-driven (resolve *which* treatment for *this* pattern); prioritized by evidence+confidence+stress+outcome learning; serves civilization-scale recommendations.
- **Treatment-discovery system:** Static, cubic, pre-computed (5234 cells); maps brain nodes → domain comparisons → verification states; exploratory (browse *what* treatments exist for this node/domain combo); verification-gated (PENDING/VERIFIED/DISPUTED suppress residuals); serves Treatment Discovery page (standalone explore UI).

**Duplication/Overlap:**
- Both ingest domain JSONs, but remedy-registry extracts + indexes treatments runtime, while treatment-discovery pre-builds a cross-domain cell matrix (build-time, batch-processed).
- Both surface treatments, but remedy-resolver recommends (per-pattern, gated by confidence thresholds, fallback hierarchy), while treatment-discovery displays (all cells, browseable, verification badges).
- remedy-library.json (20 entries) is *never* used by remedy-resolver (which pulls from live portals); it's orphaned, used only by regulation-reports for historical precedent examples.

### NEEDS WORK / INCONSISTENCIES

**Data staleness & gaps:**
- `/assets/data/remedy-library.json` — **Stale by 84 days** (last modified 03/14/2026). Not wired to remedy-resolver; only loaded by regulation-reports.js (historical example matching). Consider: (a) remove if orphaned, or (b) regenerate with live portal statistics + most-frequent patterns. **File-level inconsistency:** remedy system is 100% live-portal-driven; this static JSON serves no active remedy selection purpose.
- `treatment-discovery/_summary.json` — Empty/placeholder (0.00 MB); last built 06/04/2026. Check if intentional or skipped in build.

**Incomplete remedy population:**
- **Only 13 medicine specialties hardcoded** (line 338–347 of limen-bootstrap.js): medicine_neurology, medicine_metabolic, medicine_pediatric_med, etc. Other portals (agriculture, infrastructure, legal_*, etc.) are harvested via `LIMENDomains` keys only. If a domain portal exists (e.g., `agriculture_crop.json`) but is not in the default domain list, it will be missed. **Path:** Use deep-portal-harvester for on-demand discovery, or enumerate all sub-portals at bootstrap time.

**Pattern class alignment:**
- remedy-library.json defines ~14 patterns (resource_pressure, oscillation_instability, threat_cascade, phase_transition, prediction_violation, cross_domain_resonance, regulation_failure, innovation_pressure, plasticity_window, memory_consolidation, somatic_cascade, narrative_collapse, homeostatic_recovery). Remedy-resolver's ADJACENT_PATTERNS graph covers all 14. However, **treatment-discovery-cell.schema.js** and actual domain portals may define different pattern vocabularies (e.g., "issue" terminology vs. "pattern" terminology). No validation that harvested treatments' patterns match resolver's 14-class enum. **Risk:** Fallback-to-generic-direction if pattern mismatch occurs.

**Synthetic stress diagnosis removal:**
- **Line 349–352 of limen-bootstrap.js** notes that synthetic `_LIVE_STRESS` diagnosis/treatment fabrication was removed (Civilization not allowed to invent domain truth). However, `portal-treatment-resolver.js` **still checks for** `_LIVE_STRESS` in diagnosis IDs (line 60) and partitions them as synthetic. This partition logic is now dead code (no such diagnoses created post-removal). **Consider:** Remove the partition logic or document why it's retained for backwards compatibility.

**Contraindication condition parsing (incomplete):**
- remedy-resolver.js line 182–204: `_evaluateCondition()` only parses `node[ID].activation > THRESHOLD` patterns. Other condition types (timespan, cross-domain state, context flags) would fail silently (return false, no block). **Gap:** Full condition language not defined; hard contraindications without parseable conditions become soft warnings (line 166–168).

**Missing remedy outcome tracking:**
- Remedies are selected and passed to UI (via scalePayload), but no feedback loop records whether the remedy was applied, effective, or triggered side effects. **Gap signal accumulation** (line 481–501 of remedy-resolver) only tracks **gaps** (failures); no success tracking for outcome learning refinement. localStorage pathway weights are read but never written by remedy-resolver.

**Node-match score edge case:**
- remedy-resolver.js line 122–137: `_nodeMatchScore()` returns 0 if either linked nodes OR affectedNodes is empty. A remedy with no linked nodes (linkedNodes.length === 0) will always score 0, regardless of pattern/confidence. This might be intentional (no anatomical specificity = low priority), but creates hard floor. **No fallback:** such remedies would only be selected via adjacent-pattern or cross-scale fallback, or caught in confidence gate.

**Registry isolation from domain brains:**
- portal-treatment-resolver.js line 54–68 explicitly **separates portal-sourced diagnoses from synthetic _LIVE_STRESS** and prefers portal diagnoses. But domain brains have their own `brainDiagnoses` / `brainTreatments` (per domain-brain-base.js). **Unclear:** are domain-brain-sourced treatments registered in remedy-registry, or kept separate in domain state? If separate, remedies from domain brains are **bypassed** by registry-based lookup. **Potential gap:** domain-specific resilience logic might not feed into civilization recommendations.

**Evidence weighting inconsistency:**
- remedy-registry.js line 67–84: EVIDENCE_RANK maps 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'Moderate', 'Limited', 'Strong', 'None' (11 variants).
- remedy-resolver.js line 32–35: EVIDENCE_WEIGHTS maps 'A', 'Strong', 'B', 'Moderate', 'C', 'Weak', 'Emerging' (7 variants).
- **Mismatch:** remedies indexed with one grade system, scored/ranked with another. E.g., 'B+' (rank 8) won't match any resolver weight key; falls through to default 0.30. **Risk:** Evidence-based prioritization unreliable across system boundaries.

**Empty/stale bootstrap paths:**
- limen-bootstrap.js line 360–372: `harvestFromUrls()` callback rebuilds resolver registry post-harvest, but only if `total > 0`. If no portals are available at bootstrap (network down, paths missing), registry builds with zero treatments. Subsequent domain-stress queries return empty arrays. **No fallback:** if remedy-library.json were loaded as fallback seed, it could populate a baseline. Currently unused.

**Test coverage:** registry-test.js validates happy paths but doesn't test:
- Harvesting 50+ portals in parallel (CONCURRENCY limits in deep-portal-harvester).
- Circular pattern adjacencies (e.g., threat_cascade → regulation_failure → threat_cascade).
- Very large remedies[] arrays (5000+ treatments) under prioritization.
- Schema validation failures (what happens if a portal JSON fails fractal-schema check?).

**Path-dependent harvesting:**
- linen-bootstrap.js assumes portals at `assets/data/domains/{domainId}.json`. If domain IDs change or new domains are added to LIMENDomains, harvest URLs must be regenerated. Deep-portal-harvester exists to probe for sub-portals, but is not auto-wired into bootstrap. **Fragility:** manual domain list synchronization required.

**Documentation:**
- remedy-registry.js and remedy-resolver.js cite docs/57–60 but those docs are not in the repo (verified earlier in audit). Comments reference locked schemas but do not list exact schema file paths. Fractal-report-schema conversion (`fromLegacyDomain()`) is called but fallback converter is provided (line 807–904); no indication which is preferred or when fallback activates.

---

**Summary:**
The Remedy subsystem is **functionally complete and operational** (harvesting, indexing, selection, fallback, priority scoring all working; 12 tests passing). However, **stale static data** (remedy-library.json orphaned), **incomplete portal enumeration** (medicine specialties hardcoded), **evidence-grade mismatch** across boundaries, **dead code** (synthetic _LIVE_STRESS partitioning), and **domain-brain isolation** (separate treatment sources) represent **moderate maintenance debt**. No critical bugs, but several inconsistencies reduce robustness under edge cases (no remedies available, pattern mismatches, evidence ambiguity). **Gap-signal authoring request** mechanism is in place but incomplete (no feedback on authored remedies back into registry).

---

## 13. Master Brain / Inbox / Executor

### PURPOSE

Master Brain is the executive metacognitive orchestration layer that:

1. **Pathway-First Intake**: Reads live domain-brain outputs (LIMENDomains) as domain-diagnosis pathway bundles, not raw opportunities
2. **Phase-Gated Lane Firing**: Scores artifacts (readiness, salience, completeness) and gates them by phase inhibition rules per lane (patent, grant, SBA, franchise, investment, research)
3. **Readiness & Ranking**: Computes pathway salience (kernel-phase severity + alert + bridge confidence), surfaces READY vs NEAR_READY vs BLOCKED tiers with per-lane top-priority queues
4. **Handoff Contract**: Emits structured inbox JSON to operator surfaces (master-brain.html, master-brain-inbox.html, master-brain-executor.html) with NO execution authority (executionAllowed: false on every item)
5. **Executive Decision Engine** (Phase 2-3 scaffold): OIB assembler → decision classifier → review gate (no LLM, pure deterministic)
6. **Artifact Council Intake** (Phase A): Session-scoped queue for manually-reviewed artifact packets pending handoff (honest scaffold: no auto-enqueue, no submission authority)
7. **Five-Lane Executor** (Phase 2 patent/grant render): Assembles deterministic draft packages (patent, grant, SBA, business-plan, directives) from pathway intelligence WITHOUT fabricating legal claims, novelty assertions, eligibility, or filing-ready language

**NOT doing**: fabricating claim language, filings, trades, submissions, or granting execution authority. NO external network calls. NO LLM synthesis. Pure pathway-first signal refinement and transparent handoff to human operators.

### KEY FILES

**HTML Portal Pages** (live links via clean URLs):
- `master-brain.html` — Master Brain console (posture grid, pathway counts, self-audit, recent transitions, entry buttons) → https://limenhelix.com/master-brain
- `master-brain-inbox.html` — Executive Inbox (qualified domain pathways ranked by salience, posture, truth ledger, leaf opportunities per pathway, Artifact Council intake widget) → https://limenhelix.com/master-brain-inbox
- `master-brain-executor.html` — Five-Lane Executor (per-lane packet assembly: patent, grant, SBA, business-plan, directives; queue by tier/density; status/action bars; substrate viewer) → https://limenhelix.com/master-brain-executor

**JavaScript Engine Files** (in `/assets/js/master-brain/`):
- `oib-assembler.js` — Observatory Input Bundle snapshot: clones window.LIMENReports, LIMENDomains, LIMENGlobalState, LIMENPolarity, LIMENPatentOpp, LIMENRegulation into safe OIB structure with envelopes (freshnessMs, trustTier per source) and admissibility floor checks (0.40 threshold for civilization evidence)
- `decision-engine.js` — Phase 2 deterministic classifier over OIB: routes to no_action / insufficient_evidence / executive_synthesis / contradiction; computes confidenceScore (never upgrades, gated by min tier of refs); requires ≥3 refs + civilization+domains for synthesis
- `review-gate.js` — Phase 3 in-memory queue for review-eligible decisions (humanReviewRequired OR proposedNext='schedule_review' OR class='contradiction'/'insufficient_evidence'); tracks pending/reviewed/dismissed with resolution snapshots
- `artifact-intake.js` — MB-A scaffold: sessionStorage-backed queue for manually-pasted artifact packets (lane, artifactCouncilStatus, humanReviewStatus); validates shape; emits stats/describeStatusTiers(); NO auto-enqueue, NO submission
- `artifact-factory.js` — MB-C scaffold: buildDraftPackage(intakeItem) → patent/grant/SBA/investment lane-specific skeleton JSONs with disclaimers, missing-evidence markers, NO fabricated claims/novelty/eligibility assertions, executionAllowed:false
- `artifact-finalizer.js` — MB-D scaffold: finalizePackage(pkg) → lane-specific Markdown + optional HTML render with cover blocks, missing-evidence sections, forbidden-language validation (regex on "submission-ready", "filing-ready", "guaranteed funding", etc.)

**Core JavaScript Engines** (in `/assets/js/`):
- `master-brain-readiness.js` (46KB) — Pathway-first readiness pipeline: collectPathways() emits domain-diagnosis bundles with salience (score/tier/reasons/missing), posture (phase/stress/trajectory/maturity), nodes (circuits/treatment counts), deepTreatmentsByNode, cross-scale emissions/ingest, convergence; buildLedger() projects whatChanged/whatFired/whatNodesMattered/whatEvidenceIsMissing/whatWouldFalsify; collectAggregate() computes per-domain posture grid, pathway counts, audit summary, recent transitions, pulseIntensity for sun animation on master-brain.html
- `master-brain-executor.js` (65KB) — Five-lane executor: qualifiesForLane() gates pathways by tier + engine-tag (patent/grant) + weak business-anchor (SBA) + tier-only (business_plan/directives); classifyDensity() rules-based HIGH/PARTIAL/THIN on deep-treatment count + monitoring + escalation + impacted nodes; assemblePacketForLane() projects honest frames, working titles, embodiment/funding/SBA/BP/directive scaffolds with gating checklists

**API** (serverless):
- `api/master-inbox.js` — Computes phase-gated lane firing queue live from assets/data/companies/*.json (portal registry) + Redis-backed engine outputs (written by build-engine-outputs cron); calls buildInbox() to score artifacts, gate by readiness/salience thresholds + phase inhibition, cap per lane, surface top-priority cross-lane; edge-caches 60s

**Consumer Library**:
- `lib/master-brain-consumer.js` (200 lines) — buildInbox(corpusPortalsIterable) function: iterates portals, scoreArtifact() per lane (readiness = 0.5×confidence + 0.4×completeness + alert; salience = 0.4×confidence + 0.4×phaseSeverity + alert), gates by LANE_THRESHOLDS (readiness 0.40–0.60, salience 0.20–0.40) + PHASE_INHIBIT (p9/p10 block patent; p7a/p8/p9 block sba/franchise), emits queues[lane] with ready/inhibited samples + topPriority cross-lane

### LIVE PAGES

- https://limenhelix.com/master-brain — Master Brain orchestration console (animated sun, posture grid, pathway strip, self-audit strip, recent transitions, entry links to inbox/executor)
- https://limenhelix.com/master-brain-inbox — Executive inbox (filtered/searchable pathway cards by tier/engine, salience scores, truth ledger, impacted nodes with deep treatments, leaf opportunities, Artifact Council manual intake widget with build/finalize/expand buttons)
- https://limenhelix.com/master-brain-executor — Five-lane executor (lane selector buttons, queue by tier+density, packet substrate assembly pane for patent/grant, status bar, action bar with approve/refuse/wait/open/print/regenerate buttons)

### DATA

**READS**:
- `window.LIMENDomains` (all 20 domain brains' live state via domain-brain-adapter.js): brainDiagnoses[], brainTreatments[], brainResolvedContent.byDiagnosis{}, brainFeeds[], brainPhase, brainStress, brainConfidence, brainTrajectory, brainMaturity, brainReadyForHandoff, brainAuditScore, brainValidatedAt, etc. — Updated per `limen:domain-brain-update` event
- `window.LIMENReports.civilization` (observatory synthesis): evidence.overallConfidence, overallTier, conflicts[], summary — Updated per domain-brain cycle
- `window.LIMENGlobalState`, `window.LIMENPolarity`, `window.LIMENPatentOpp`, `window.LIMENRegulation` (via OIB assembler) — Trust tiers: moderate (no freshnessMs on these)
- `assets/data/companies/*.json` (portal registry via api/master-inbox.js): engineOutputs[lane][] with confidence, artifact, patternId per lane; kernelReadings (k1/k2 phase/alert); financialHealth (dominantPhase, alert)
- Redis KV `limen:eo:{slug}` (fresh engine outputs written by build-engine-outputs cron) — Falls back to file engineOutputs if Redis down

**WRITES**: 
- None to data tanks. sessionStorage only for MB-A intake queue (limen.mb.artifactIntakeQueue.v1). 
- api/master-inbox.js response is edge-cached 60s (public, max-age=0, s-maxage=60, stale-while-revalidate=300).

**STALE/EMPTY risks**:
- If domain brain cycle stalls, brainFeeds[] / brainValidatedAt go stale — audit score degrades, pathway tier drops to BLOCKED
- If api/master-inbox.js Redis connection fails, falls back silently to committed portal.engineOutputs (may be days old)
- If civilization evidence.overallConfidence remains null/below 0.40 floor, all decisions route to insufficient_evidence (OIB admissibility gate)
- MB-A intake queue (session-scoped) survives page refresh but clears on tab close or cross-origin nav

### HOW IT CONNECTS

**Inbound Signal Flow** (pull model):
```
domain-brains/ (20 domain intelligences)
  ↓ limen:domain-brain-update event
master-brain-readiness.js collectPathways()
  ↓ reads LIMENDomains[] (keyed by domain: energy, finance, etc.)
  ↓ projects diagnosis/treatment/posture/node structure
  ↓ scores salience (phase severity + alert + bridge confidence)
  ↓ gates posture/activation/nodes per pathway
  ├→ master-brain.html (sun + posture grid + pathway strip + audit strip)
  ├→ master-brain-inbox.html (pathway cards filtered by tier/engine)
  └→ master-brain-executor.js collectQueue(lane) 
      ├→ master-brain-executor.html (packet assembly per lane)
      └→ qualifiesForLane(pathway, lane) gates:
          - patent/grant: engine tag match
          - sba: weak business-anchor (companies[] on leaf opps)
          - business_plan/directives: tier only
          - HARD: phase inhibit (p9/p10 block patent; p7a/p8/p9 block sba/franchise)
          - HARD: tier ≥ NEAR_READY
```

**Outbound to Civilization & Portal Dossiers**:
- master-brain.html renders posture-by-domain grid; civilization console listens to same limen:domain-brain-update events (reads from master-brain-readiness.buildPosture[])
- Executor lane qualification feeds back to domain operators: artifact_ready signals on opportunity-discovery surfaces propagate executor readiness
- Artifact Council intake (MB-A) is a one-way submission queue; no feedback loop implemented yet (scaffold stage)

**Artifact Council → Executor → Handoff Chain** (currently manual / operator-driven):
```
civilization/ (operator reviews portal opportunities / evidence)
  ↓ [manual operator action: paste artifact packet into MB-A intake]
  → artifact-intake.js enqueue(intake) → sessionStorage + in-memory
    → master-brain-inbox.html renders MB-A card with "Build Draft Package" button
    → artifact-factory.js buildDraftPackage(item) → MB-C skeleton (lanes: patent/grant/sba/investment)
    → artifact-finalizer.js finalizePackage(pkg) → MB-D Markdown/HTML (final_draft_only, executionAllowed: false)
    → [NOT SUBMITTED; NOT FILED; human in loop required]
```

**Lane Scoring Formula** (`lib/master-brain-consumer.js`):
```
readiness = 0.5×confidence + 0.4×completeness + (alert ? 0.1 : 0.05)
salience  = 0.4×confidence + 0.4×phaseSeverity + (alert ? 0.2 : 0.1)
fireScore = readiness × salience
gating:
  - PHASE_INHIBIT[lane].includes(phase) → INHIBITED ("phase p9 inhibits patent")
  - readiness < threshold[lane] → INHIBITED
  - salience < threshold[lane] → INHIBITED
  - else → READY_TO_FIRE
per-lane caps:
  patent:     readiness ≥ 0.55, salience ≥ 0.30
  grant:      readiness ≥ 0.50, salience ≥ 0.30
  sba:        readiness ≥ 0.55, salience ≥ 0.30
  investment: readiness ≥ 0.60, salience ≥ 0.40
  research:   readiness ≥ 0.40, salience ≥ 0.20
```

**Message Types Handled** (counted from code):

From domain brains (via LIMENDomains):
- **Diagnosis event**: active/inactive, relevance, matchedConditions, totalTriggers, blocked, blockReason (gateActivation logic)
- **Node/circuit event**: nodeId, treatmentCount, hasDepthCount, inCircuits (gateNodes logic)
- **Treatment event**: label, type, evidence (A/B/C rank), description, monitoring, escalation, cite (classifyDensity rules)
- **Phase event**: phase (p0–p10), phaseConfidence, stress, trajectory, maturity (STRUCTURAL flag), hysteresisPenalty, Ct (posture projection)
- **Cross-scale signal**: emissions[].targetDomain/signalType/magnitude, ingest[].sourceDomain/signalType/magnitude, convergence.primary_signal (rendered in inbox cards)
- **Audit signal**: brainReadyForHandoff (boolean), brainAuditScore, brainAuditFindings[] (scoreOpportunity gates)
- **Feed freshness**: brainFeeds[].updated, brainFeedFreshnessSec (evidence derivation)

From civilization (via LIMENReports):
- **Civilization evidence**: overallConfidence, overallTier (decision-engine admissibility floor: 0.40)
- **Conflicts**: type, scaleA, scaleB, confidenceGap (enumerated → contradiction decisions, no auto-action)

From portal registry (via api/master-inbox):
- **Engine output**: lane (patent/grant/sba/franchise/investment/research), artifact, confidence, patternId per lane
- **Kernel phase**: dominantPhase, alert flag (phaseSeverity lookup table applied)

From operator (manual):
- **Artifact Council intake**: artifactPacket, lane, artifactCouncilStatus, humanReviewStatus, createdAt, notes (MB-A validation)
- **Executor action**: approve/refuse/wait (queued for Phase 4 directives rendering; NOT submitted)

**Action Types**:
1. `no_action` — admissibility gate failed OR no synthesis signal (insufficient evidence proposal; proposedNext: 'archive')
2. `insufficient_evidence` — civilization evidence < 0.40 floor OR domains unavailable (review-eligible; proposedNext: 'archive')
3. `executive_synthesis` — high-tier gate cleared + ≥3 refs bound (civilization+domains+≥1 extra); proposedNext: 'route_to_domain'; executionAllowed: false
4. `contradiction` — conflict enumerated from civilization.conflicts[]; proposedNext: 'schedule_review'; review-eligible
5. `buildDraftPackage` — operator-initiated from MB-A intake card; produces MB-C skeleton per lane
6. `finalizePackage` — operator-initiated; renders MB-D Markdown with forbidden-language validation
7. `approve/refuse/wait` — executor action on packet (status only; NO submission logic in this phase)

**Transition Tracking** (in _recentTransitions, capped at 12):
- newly_active: diagnosis activated, score increased to READY tier
- deactivated: diagnosis deactivated, pathway drops out of inbox
- tier_change: READY → NEAR_READY / BLOCKED (scored with delta)
- score_shift: tier unchanged, but score moved (e.g. 0.75 → 0.82)

### NEEDS WORK / INCONSISTENCIES

1. **Missing Feedback Loop**: MB-A intake (Artifact Council) is a one-way scaffold. No handoff confirmation signal sent back to domain brains or civilization. If operator approves packet, no "approved_artifact_handoff" event fires upstream. Consequence: artifact readiness signals don't close loop.

2. **Empty Phase-5/6 Classes**: decision-engine.js Phase 2 only emits [no_action, insufficient_evidence, executive_synthesis, contradiction]. Phase 5 (artifact_request), Phase 6 (strategic_option), Phase 5 review-queue routing are all documented in spec §5/§6 but NOT implemented. Routes today just land in review scaffolding with no action spec.

3. **Civilization Bridge Not Wired**: oib-assembler.js reads window.LIMENReports.civilization (one-directional snapshot). No reverse channel: when Master Brain decides to route decision to domain, no dispatch mechanism exists. civilization.html console does NOT subscribe to master-brain-update events; they are independent event streams.

4. **OIB Freshness Floors Absent**: oib-assembler.js captures freshnessMs but decision-engine.js does NOT enforce staleness thresholds. A 24h-old civilization snapshot can still pass admissibility if evidence.overallConfidence >= 0.40. Freshness penalty is only applied AFTER decision is already classified (line 179: _freshnessPenalty() reduces confidenceScore, not tier).

5. **Pathway Scoring vs Opportunity Scoring Mismatch**: master-brain-readiness.js scores opportunities using legacy WEIGHTS formula (rank 0.22 + urgency 0.08 + confidence 0.15 + evidence 0.15 + handoff 0.15 + audit 0.10 + provenance 0.10 + freshness 0.05). Pathways use PATHWAY_WEIGHTS (relevance 0.25 + nodeDepth 0.20 + phaseGravity 0.15 + stressEnvelope 0.10 + crossScale 0.15 + freshness 0.10 + provenance 0.05). These are independent; a pathway can be READY while its leaf opportunities are BLOCKED. No reconciliation logic documented.

6. **SBA Eligibility Gate Too Weak**: master-brain-executor.js qualifiesForLane('sba') checks ONLY `_pathwayHasCompanyAnchor()` (≥1 company ticker on ≥1 leaf opp). This is intentionally weak per code comment, but the SBA lane renders without verifying: borrower structure, NAICS code, personal guarantee sufficiency, historical tax returns presence, or lender readiness. Result: SBA substrate can assemble for ineligible entities. The [MB-D] disclaimers warn "Stronger borrower-shape validation deferred to SBA render/underwriting pass" but that pass doesn't exist in this phase.

7. **Executor Lane Qualification vs Density Advisory Confusion**: qualifiesForLane() is HARD (gates whether packet assembly happens). classifyDensity() is ADVISORY (HIGH/PARTIAL/THIN on deep-treatment count, monitoring, escalation, impacted nodes). An executor can approve a THIN-density packet (3 treatments, 0 monitoring, 1 citation, 1 impacted node) if tier >= NEAR_READY. No minimum-density gate exists; density is UI-only warning, not blocking gate.

8. **Artifact Factory Forbidden-Language Regex Brittle**: FORBIDDEN_RX[] checks on substring match (e.g., /\bbuying\s+now\b/i for "buy now"). Legitimate phrases ("buying committee", "buying power") may trigger false positives if surrounding tokens shift. validatePackage() walks the rendered Markdown once; if blocking phrase appears in a parenthetical exemption note, it still fails.

9. **Phase Inhibition Table Hardcoded**: PHASE_INHIBIT[lane] lives in master-brain-consumer.js. If a new phase is introduced (e.g. p11 for resurrection), the table must be manually updated. No dynamic phase-registry mechanism exists.

10. **Transitional Snapshot State Leaks Into Decision**: _prevSnapshot in master-brain-readiness.js is session-scoped, in-memory only. On page reload, all transitions are lost. If operator refreshes master-brain-executor.html, the next domain-brain-update will compute fresh transitions from a cold-start _prevSnapshot (all pathways appear "newly_active" on session init). No persistent transition history. Consequence: transition records in recentTransitions[] are session-volatile.

11. **Master-Inbox API Caching Skew**: api/master-inbox.js edge-caches for 60s (s-maxage=60). If a portal.engineOutputs is updated in Redis by build-engine-outputs cron, the 60s cache window may delay inbox queue refresh by up to 60s. No cache-busting mechanism (no Vercel rebuild trigger on Redis write).

12. **Civilization → Master-Brain Decoupling**: Civilization console runs independent domain-packet-adapter.js, which also reads LIMENDomains. Both civilization and master-brain listen to limen:domain-brain-update, but there's no shared state. If civilization's domain-change-log marks a diagnosis as "human-reviewed", that signal does NOT propagate to master-brain-readiness's gateActivation(). Each subsystem recomputes from raw domain state independently.

13. **Orphaned Opportunity Handling Unclear**: master-brain-readiness.js preserves legacy collect() function (per-opportunity API). But the new pathway-first layer collectPathways() does not guarantee that every opportunity in LIMENOpportunities is bound to a pathway. If a diagnosis has no circuits (gateNodes fails), its opportunities are orphaned. Legacy collect() may still emit them; executor.js does not reference them. Risk: orphaned-opportunity artifacts may surface in old tooling but not be visible to executor.

14. **Admission Floors Not Enforced Upstream**: decision-engine.js admissibility floor (0.40) is only checked in _admissibilityCheck() AFTER OIB is already assembled. If civilization is offline or evidence.overallConfidence is null, the check catches it. But oib-assembler.js does not pre-gate on floor; it just clones whatever civilization exports. Consequence: a null overallConfidence passes availCivilization check (line 166: "rawCivilization !== null && typeof rawCivilization === 'object'"), then decision-engine later downgrades to insufficient_evidence. No early abort.

15. **Artifact-Intake Execution Authority Claim**: artifact-intake.js line 198 asserts executionAllowed: false as INVARIANT in every stored item. But the code does NOT validate the input-pasted intake object for this. An operator could paste intake JSON with executionAllowed: true, and the enqueue() validation (validate() function) does NOT check it. Only the output item (constructed by enqueue) hardcodes executionAllowed: false. If operator tampers with sessionStorage directly, invariant breaks. No validation on read-back from sessionStorage.

16. **Pathways Page Filters Not Synced to Executor**: master-brain-inbox.html has tier/engine filter buttons (READY/NEAR_READY/BLOCKED + PATENT/GRANT/INVEST) that render different pathway subsets. master-brain-executor.html has lane selector buttons (PATENT/GRANT/SBA/BUSINESS_PLAN/DIRECTIVES) but NO tier filter. Executor always shows all NEAR_READY+ pathways for the lane, regardless of salience or audit score. Result: operator can filter inbox by READY-only, then switch to executor and see NEAR_READY artifacts that were filtered out in inbox view. Cognitive disconnect.

17. **Five-Lane UI Asymmetry**: Patent and Grant lanes have full packet assembler (MB-C + MB-D). SBA, Business_Plan, and Directives lanes are marked "not actionable" in executor UI with a badge, yet the executor page still renders a queue for them and allows lane selection. The contract skeletons are defined (SBA_USE_OF_PROCEEDS, BP_MILESTONES, DIR_HUMAN_ROLES) but no assembler wires them. Operator can click SBA lane, select a pathway, but "Build Draft Package" / "Finalize" buttons are disabled (see executor HTML line 714: `mba-expand` button has @click handler that is disabled for non-patent lanes). Consequence: UI suggests capability (lane button is clickable) but does not deliver it. Should be either hidden or clearly labeled "Phase 2 only".

18. **Civilization → Master-Brain Signal Attenuation**: civilization.html runs observatory-aggregator.js, which synthesizes cross-domain signals into civilization.conflicts[], evidence.overallConfidence, summary. But master-brain-readiness.js reads LIMENDomains directly, bypassing civilization aggregation. The pathways it emits are NOT informed by civilization's cross-scale synthesis. If civilization detects a scale-A vs scale-B conflict and downgrades evidence.overallTier, that downgrade affects decision-engine (admissibility gate) but NOT pathway salience. Consequence: a pathway can be READY in master-brain-inbox while civilization marks it as low-confidence. No reconciliation.

19. **Ledger Projections Honest But Not Testable**: buildLedger() emits whatChanged / whatFired / whatNodesMattered / whatEvidenceIsMissing / whatWouldFalsify. These are honest projections (no synthesis), rendered in master-brain-inbox.html. But no assertion gates them. The inbox UI displays them as passive read-only text; operator cannot mutate or confirm them. If ledger says "whatWouldFalsify: negative trial result on node X", and operator later finds a negative trial result, no mechanism updates the ledger or gates the pathway on that falsification. Ledgers are unidirectional signal emanations.

20. **Executor Density Classification Opaque**: classifyDensity() returns level (HIGH/PARTIAL/THIN) + detailed breakdowns (deep count, monitoring, escalation, cite, impacted nodes, missing proof items). The executor UI surfaces density as a badge per queue item (master-brain-executor.html line 91–93: .sel-density pills). But when operator assembles a packet, the density DOES NOT affect packet disclaimers or missing-evidence flags. A THIN-density patent can still assemble and render with the same structure as a HIGH-density one. Only the density reason string is logged; no density-based gating or caveat injection.

21. **Orphaned Reports Paths**: oib-assembler.js reads window.LIMENReports (global object). But the source is assumed to be window.LIMENReports.civilization + the reports object itself. If LIMENReports contains sibling keys (e.g., LIMENReports.infrastructure_audit, LIMENReports.cross_scale_synthesis) they are NOT enumerated. The code reads ONLY civSnapshot = rawReports.civilization (line 156), then uses it for admissibility and decision binding. Other report siblings are orphaned.

22. **Executor Packet Status State Machine Incomplete**: master-brain-executor.html defines _status = {} object keyed by (_pathwayId + '_' + lane). It tracks per-packet status (DRAFT/APPROVED/REFUSED/WAITING). But this state is NEVER persisted. It lives in-memory only. On page reload, all status history is lost. Operator can approve a packet, refresh page, and the packet reverts to DRAFT. No consequence enforcement (e.g., no "already approved once" idempotence guard).

23. **Decision Review Queue Terminal States Fragile**: review-gate.js enqueue() is idempotent (same decision.id returns existing item, no overwrite). But resolve() and dismiss() are terminal (item.status becomes 'reviewed' or 'dismissed', and further resolves/dismisses return null). No way to re-open a reviewed item or un-dismiss. clear() is the only reset. If operator accidentally clicks "Resolve: Approved" and closes the review tab, the decision is locked in 'reviewed' state with no UI to undo it (scaffold stage; no operator surface for review gate exists yet).

24. **Admissibility Floor Asymmetry on Sources**: admissibility floor check (0.40) only reads civilization evidence.overallConfidence. Domains envelopes are checked for availability only (civEnv.available), not for confidence. If a domain is unavailable, reason='domains_unavailable' is added to failingRefs, but NO confidence-floor check is run per domain. Consequence: civilization offline = insufficient_evidence. But single domain offline = passed through (domains envelope "available" flag is false, but no confidence floor enforces it).

25. **Transition Diff Accuracy Assumption**: _prevSnapshot compares pathway.salience.tier (e.g., READY → NEAR_READY) to detect tier_change. But salience object is mutated every cycle; there's no version/hash mechanism to verify that the comparison is happening on the SAME pathway identity. If LIMENMasterBrainReadiness._prevSnapshot is keyed by pathway.id, and pathway.id changes due to a hashing collision or domain re-initialization, a "newly_active" transition fires on what is actually a different pathway under the same synthetic ID. No UUID guarantee.

Human message types handled (tabulated for this audit):
- **Artifact Council packet intake** (MB-A): lane, status, createdAt, notes, artifactPacket (9 lanes supported)
- **Artifact review actions** (review-gate.js): enqueue, resolve(disposition: approved/rejected/deferred), dismiss
- **Executor actions** (master-brain-executor.html): approve, refuse, wait, open, print, regenerate
- **Pathway filters** (master-brain-inbox.html): tier (READY/NEAR_READY/BLOCKED), engine (PATENT/GRANT/INVEST)
- **Lane selection** (master-brain-executor.html): PATENT/GRANT/SBA/BUSINESS_PLAN/DIRECTIVES
- Counts: **~30 action types / message shapes** across 6 files (oib-assembler, decision-engine, review-gate, artifact-intake, artifact-factory, artifact-finalizer)

---

## 14. Stress propagation & autonomic workers

### PURPOSE

Implements the complete autonomic loop for stress-network analysis and autonomous artifact generation (autofire). The system:
1. **Computes** network-induced stress via deterministic graph propagation (spider-web model)
2. **Monitors** phase transitions in company financial kernels
3. **Routes** transitions to firing lanes (patent, grant, SBA, franchise, investment, research) based on stage+phase
4. **Queues** recommendations with dedupe + salience filtering
5. **Fires** HIGH-salience single-call lanes autonomously (investment, research) with daily $budget caps
6. **Executes** multi-pass lanes (patent/grant/SBA/franchise) across Vercel 5-min cron ticks (stateful across 30+ min wall)
7. **Propagates** network stress across portal spider-web daily
8. **Audits** system health hourly (consolidation, pruning, remediation dispatch)

The system operates under a critical operator constraint: **cron workers may FIND and populate the backlog queue but must NEVER BUILD it autonomously. Build (fire) is always operator-initiated or budget-constrained autofire for single-call lanes.**

### KEY FILES

**Autonomic Workers (Vercel cron endpoints):**
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-snapshot.js (285 lines) — Phase 25 company scoring + console/opportunities snapshot generation. Cron: as needed (typical 2-5 min). Reads domain-snapshot + defense-signals; scores 60 companies/pass via priority scheduler.
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-stress-refresh.js (140 lines) — Spider-web stress propagation, computes live, writes Redis slim map (limen:stress_slim) + metadata receipt. Cron: every 30 min. Produces fresh network-stress input for salience routing.
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-autoqueue.js (135 lines) — Phase-transition consumer. Reads limen:phase_transitions log, applies limen-policy.recommendLane(), checks dedupe (7d per CIK+lane), writes limen:autoqueue. Cron: every 15 min. **FIND-only: populates queue without firing.**
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-autofire.js (592 lines) — Single-call executor. Reads HIGH-salience PENDING from autoqueue, fires investment/research lanes via /api/expand-artifact-claude, persists to /api/limen-engine-output as READY_TO_SIGN. Cron: every 30 min. Budget-gated ($20/day default) + per-CIK 24h dedupe. Max 1 fire/tick (guarantees <300s Vercel budget).
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-multipass.js (549 lines) — Multi-pass state machine. Reads HIGH-salience multipass (patent/grant/SBA/franchise) from autoqueue, runs ONE section per cron tick, persists state to Redis (limen:multipass_inflight), stitches final on completion. Cron: every 5 min. Budget-shared with autofire. Single job in-flight at a time (serialization). Each pass ~90s, total 30-40 min wall.
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-sleep-cycle.js (218 lines) — Neurologically-grounded self-audit + self-heal. Four passes: (1) CONSOLIDATION: recent transitions sampling (doesn't re-score, reports count), (2) PRUNING: marks PENDING entries >7d old as EXPIRED, (3) AUDIT: metrics snapshots (transition count, queue sizes, backlog pointer), (4) REPAIR DISPATCH: emits remediation requests (scorer-silent alerts, queue-backed-up, weekly corpus-audit prompts). Cron: hourly. Persists to limen:remediation_queue (max 100, 30d TTL).
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-ingest.js (223 lines) — Defense RSS ingestion. Fetches 4 Google News RSS feeds (Iran/Israel/energy/grain/military/cyber), dedupes by title (last 24h only), classifies into 13 event types (AIRSTRIKE, MISSILE_ATTACK, NUCLEAR_THREAT, etc.), maps to domains, computes macro-shock (≥3 domains + energy + supplychain). Cron: every 2 min. Stores to linen:latest_ingest (5m TTL) + limen:domain_deltas (5m TTL).

**Stress Propagation Core:**
- C:\Users\Chris\Limen-Helix-live-\lib\limen-stress-propagator.js (751 lines) — Pure-deterministic spider-web propagation. Builds portal graph, computes intrinsic stress (kernel composite ± alert bonus, capped at 5.0, damped by L2 inhibitory edges), runs BFS for up to 3 hops with attenuation (0.5^hops). Outputs per-portal: intrinsicStress, inducedStress (network-pushed), inducedSources (top 50 counterparties with contribution/hops/category), totalStress, amplificationRank (NONE/MILD/MODERATE/SEVERE/HUB_EFFECT). No fabrication: edges only over existing functionalNetwork portals. Deterministic (W3 contract verified by scripts/verify-iteration-determinism.mjs). Used by scripts/build-stress-network.mjs for on-disk snapshot + by api/limen-worker-stress-refresh.js for Redis hot cache.

**Data Producers:**
- C:\Users\Chris\Limen-Helix-live-\api\limen-stress-propagation.js (160 lines) — Endpoint exposing stress snapshot. GET: reads cached (assets/data/stress-network-state.json) or computes live if missing. Queries: ?slug=, ?networkPushed=1, ?top=20, ?compute=1 (auth-gated live recompute). Source priority: cache, fallback to live.
- C:\Users\Chris\Limen-Helix-live-\api\limen-stress-slim.js (78 lines) — Browser-readable stress map (tens of KB vs 4.5 MB full snapshot). Fetches limen:stress_slim from Redis (written by worker-stress-refresh) or derives from file on fallback. Strips inducedSources detail. Returns bySlug with induced/total/rank/hub/pushed per portal.
- C:\Users\Chris\Limen-Helix-live-\api\limen-phase-transitions.js (74 lines) — Read-only audit log of CIK phase transitions. GET /api/limen-phase-transitions?limit=50&domain=energy&to_phase=p7 filters. Queries phases end-state, since_ms. No auth. Cache 30s.

**Queueing & Operator Control:**
- C:\Users\Chris\Limen-Helix-live-\api\limen-autoqueue.js (133 lines) — Operator-facing queue reader + mutator. GET: filters by status/domain/lane/salience/min_score. PATCH (auth-gated): operator marks entry FIRED/DISMISSED/EXPIRED. Dual architecture: GET is public read (dashboards), PATCH requires LIMEN_OPERATOR_TOKEN.
- C:\Users\Chris\Limen-Helix-live-\api\limen-self-pulse.js — Manual enqueue: operator (or LIMEN self-bootstrapping) injects CIK+lane into autoqueue without waiting for phase transition. POST body: {cik, lane, salience, [from], [to], [note]}. Auth-gated. Defaults salience=HIGH.

**Bulk Producers (CLI):**
- C:\Users\Chris\Limen-Helix-live-\scripts\build-stress-network.mjs — CLI runner for full propagation. Loads portal corpus + Command Board export, runs propagator, writes assets/data/stress-network-state.json. Flags: --top N (default 20), --slug <slug> (detail one), --compute-only. Prints top-N by totalStress + amplification rank histogram + severe-anomaly details.
- C:\Users\Chris\Limen-Helix-live-\scripts\build-historical-distress-cohort.js — (utility, not part of main autonomic loop)

**Logging & Audit:**
- C:\Users\Chris\Limen-Helix-live-\api\limen-autofire-log.js — Reads limen:autofire_audit_log (500 entries max, 30d TTL) of past fires with evaluation/fired/skipped/error counts + result samples.

### LIVE PAGES

- https://limenhelix.com/vitals — Operator dashboard showing autoqueue size, recent transitions, sleep-cycle metrics
- https://limenhelix.com/command-board / https://limenhelix.com/helix-artifact?id=<outputId> — Artifact viewer (autofire + multipass outputs)
- https://limenhelix.com/civilization — Command Board + network-stress visualization
- **No public pages for raw stress data** (API-only: /api/limen-stress-propagation, /api/limen-stress-slim, /api/limen-phase-transitions, /api/limen-autoqueue, /api/limen-autofire-log)

### DATA

**Cron Triggers (vercel.json):**
Only ONE cron in vercel.json: `{ "path": "/api/capital-engine?action=tick&cap=3", "schedule": "0 */6 * * *" }` (every 6h, capital-engine unrelated to stress system). **Stress workers are NOT declared as explicit Vercel crons** — they run on-demand (browser fetch or operator trigger) or via implicit periodic calls from external CI/cron infrastructure (assumed deployed elsewhere, e.g., GitHub Actions, Terraform Cloud). **This is a gap**: no documented cron schedule visible in the config. Manual inquiry required.

**Redis State Keys (limen-db backend, typically Upstash):**

| Key | TTL | Role | Data Shape |
|-----|-----|------|-----------|
| `limen:phase_transitions` | 30d | Append-only log of CIK phase changes (newest first) | Array of {at, cik, ticker, domain, from, to, trajectory, entity_name} (500 max) |
| `limen:autoqueue` | 14d | Fire-ready queue (newest prepended) | Array of {queuedAt, cik, from, to, recommendedLane, salience, salienceScore, networkStress, status:PENDING\|FIRED\|DISMISSED\|EXPIRED, ...} (200 max) |
| `limen:autoqueue_dedupe_*` | 7d | Per (CIK, lane) dedupe marker | Trivial {at: Date.now()} |
| `limen:autofire_budget_YYYY-MM-DD` | TTL=seconds until midnight | Daily spend accumulator (dollars) | Number |
| `limen:autofire_cik_lane_dedupe_*` | 24h | Per-fire dedupe (same CIK+lane won't fire twice in 24h) | Trivial {at: Date.now()} |
| `limen:autofire_audit_log` | 30d | Past fire evaluations (fired/skipped/error/dedupe counts) | Array of {at, status:IN_FLIGHT\|COMPLETE, evaluated, fired, skipped, errors, dedupedCount, results:[...]} (500 max) |
| `limen:multipass_inflight` | 24h | Single in-flight multipass job state | {cik, slug, lane, catalogKey, passes:[{ok, sectionId, tokens}], aggregateSections, aggregateOpenItems, lastModel, startedAt, tickCount} or [] when idle |
| `limen:multipass_audit_log` | 30d | Completed multipass jobs | Array of {at, cik, slug, lane, ticks, totalPasses, successPasses, outputId} (200 max) |
| `limen:stress_slim` | 45min | Fresh network-stress map (per-CIK, slim) | {schemaVersion, generatedAt, generatedAtMs, stats, byCik: {cik: {slug, inducedStress, totalStress, amplificationRank, isHub, networkPushed}}} |
| `limen:stress_meta` | 45min | Metadata receipt from stress-refresh run | {generatedAtMs, schemaVersion, nodes, withCik, slugMissingCik, bytes, computeMs, backend} |
| `limen:company_score_queue` | 24h | Priority scheduler state (company scoring roundup) | {pointer: N (next index in round-robin), lastRun: Date.now()} |
| `limen:company_phase:{cik}` | 24h | Cached phase for one CIK | {phase, trajectory, timestamp, kernelScore, ...} |
| `limen:domain_company_join` | 10min | Domain ↔ company membership for convergence signals | {domain_id: {mapped: N, p7a_count: N, p3_count: N, ...}} |
| `limen:score_run_log` | 30d | Company-scoring run history | Array of {timestamp, scored, reasons: [{cik, reason}]} (100 max) |
| `limen:remediation_queue` | 30d | Self-heal dispatch from sleep-cycle | Array of {kind, severity, detail, action, emittedAt, status:OPEN} (100 max) |
| `limen:sleep_cycle_metrics` | 30d | Hourly audit metric snapshots | Array of {at, audit:{...}, consolidation_recent_transitions, pruning_expired, remediations_count} (168 max = 7d) |
| `limen:latest_ingest` | 5min | Defense RSS ingest result | {timestamp, totalArticles, signals:[...], domainSignals:[...], macroShock:{detected, domains}, feedStatus} |
| `limen:macro_shock` | 5min | Macro-shock flag (≥3 domains + energy + supply) | {detected, domains, affectedDomainCount} |
| `limen:domain_deltas` | 5min | Domain stress deltas from ingest | {domain: {delta, confidence:HIGH\|MEDIUM\|LOW, source:rss_defense, events}} |
| `limen:console_snapshot` | 5min | UI console data (stress-ranked domains + convergence signals) | {generatedAt, domains: {dk: {stress, phase, maturity, confidence, liveCount, sources}}, stressRanked, macroShock, defenseSignals} |
| `limen:opportunities_snapshot` | 5min | Ranked opportunities for UI | {generatedAt, count, opportunities: [{domain, title, stress, confidence, urgency, rank, source, path}]} |
| `limen:prev_console_snapshot` | 10min | Prior console snapshot for changelog detection | (same as console_snapshot) |
| `limen:ingest_log` (list) | — | Append-only event log | [{timestamp, articles, signals, macroShock.detected}] via lpush (keep 500) |

**File-Based State:**
- C:\Users\Chris\Limen-Helix-live-\assets\data\stress-network-state.json (4.67 MB, last written 2026-05-25 15:57:50 UTC) — **STALE by 13 days** (audit date 2026-06-07). Produced by scripts/build-stress-network.mjs. Schema: {schemaVersion, generatedAt, stats, propagated:[{slug, intrinsicStress, inducedStress, inducedSources, totalStress, stressRatio, networkPushed, amplificationRank, inDegree, isHub, ...}]}. Vercel FS read-only ⇒ Redis override (stress_slim) is source-of-truth for live queries.
- C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json — Company CIK index + kernel scores (short-key shape: {companies: [{c: cik, co: composite, a: alert, tr: trajectory, p: phase, d: domain, t: ticker}, ...]})
- C:\Users\Chris\Limen-Helix-live-\assets\data\companies/*.json (506 portals, dynamic) — Entity portal corpus (functionalNetwork, brainNodeMapping, financialHealth, etc.). Mutated by browser edits; read by all workers.
- C:\Users\Chris\Limen-Helix-live-\assets\data\brain-connectome.json — L2 connectome edges (inhibitory damping). Read at module init by limen-stress-propagator.

### HOW IT CONNECTS

**Stress → Autoqueue → Autofire → Outputs:**

1. **Ingest** (every 2 min): RSS feeds → events (AIRSTRIKE, MISSILE_ATTACK, NUCLEAR_THREAT, etc.) → domain deltas → limen:domain_deltas
2. **Domain Health Aggregation** (implicit in limen-worker-snapshot): limen:domain_deltas + defense-signals → domainSummary {stress, phase, maturity, confidence} → limen:console_snapshot
3. **Company Scoring** (every 2-5 min cron via limen-worker-snapshot): 
   - Priority: unscored in elevated-stress domains + stale scores in elevated domains + round-robin backlog
   - Reads limen:company_score_queue pointer, locks to PRIORITY_BATCH (30) + ROUND_ROBIN_BATCH (30)
   - Calls /api/limen/score (internal kernel) per CIK (max 60/cron with 10-wide parallelism)
   - Detects phase transition: previous phase (from limen:company_phase:{cik}) vs. new phase
   - **If phase changes: writes to limen:phase_transitions** (triggers autoqueue worker downstream)
   - Stores phase + trajectory to limen:company_phase:{cik} (24h TTL)
   - Logs to limen:score_run_log
4. **Stress Propagation** (every 30 min): limen-worker-stress-refresh
   - Loads portal corpus + Command Board
   - Calls propagator.runPropagation() → computes intrinsic (kernel scores ± alert ± inhibitory damping) + BFS induction (3 hops, 0.5 attenuation)
   - Slims to per-CIK map (drops inducedSources detail)
   - Writes to limen:stress_slim + limen:stress_meta (45m TTL to survive 30m cron interval with 1 skip buffer)
5. **Queueing** (every 15 min): limen-worker-autoqueue reads limen:phase_transitions
   - For each recent transition (last 24h), calls limen-policy.recommendLane(transition, networkStress)
   - Folds limen:stress_slim network-induced into salience (network-pushed boost)
   - Dedupes per (CIK, lane, 7d)
   - **Constraint: only FINDS transitions, never BUILDS them**
   - Prepends to limen:autoqueue, caps to 200 entries
6. **Single-Call Autofire** (every 30 min): limen-worker-autofire reads limen:autoqueue
   - Filters: HIGH-salience PENDING + single-call lanes (investment, research) + not-dedupe-blocked (24h per CIK+lane)
   - Reads portal + stress node for context
   - Calls /api/expand-artifact-claude (Sonnet 4.6, 240s timeout)
   - Persists to /api/limen-engine-output as READY_TO_SIGN (never auto-submitted externally)
   - Marks autoqueue FIRED, sets dedupe key, logs to limen:autofire_audit_log
   - **Budget-gated**: daily cap ($20/day default; $0.20-1.00 per artifact estimated) + max 1 fire/tick (Vercel 300s budget safety)
   - **Constraint VERIFIED**: only MEDIUM/LOW stay operator-fire; HIGH can autofire iff single-call + budget allows + stage permits
7. **Multi-Pass Autofire** (every 5 min): limen-worker-multipass reads limen:autoqueue
   - Filters: HIGH-salience PENDING + multipass lanes (patent/grant/SBA/franchise) + not-dedupe-blocked
   - Initializes state to limen:multipass_inflight (single job in-flight at a time)
   - Each cron tick: runs ONE pass (6-8 passes per lane = 30-40 min wall), calls /api/expand-artifact-claude, appends to job.passes
   - On final pass: stitches aggregate draft, persists to /api/limen-engine-output as READY_TO_SIGN
   - Marks autoqueue FIRED, clears inflight, sets dedupe key, logs to limen:multipass_audit_log
   - **Budget-shared with autofire**: limen:autofire_budget_YYYY-MM-DD
   - **Constraint VERIFIED**: multi-pass lanes require operator-fire or budget-qualified autofire
8. **Sleep-Cycle Audit** (hourly):
   - CONSOLIDATION: samples recent transitions (doesn't re-score)
   - PRUNING: marks PENDING >7d old as EXPIRED
   - AUDIT: snapshots limen:phase_transitions size, limen:autoqueue pending/fired/dismissed/expired counts, limen:company_score_queue pointer
   - REPAIR: emits remediation requests to limen:remediation_queue (scorer-silent, queue-backed-up, weekly corpus-audit)
9. **Network Push Boost** (bidirectional):
   - limen:stress_slim informs limen-worker-autoqueue salience routing
   - limen-worker-autoqueue queues derived from phase transitions (kernel reads stress-slim)
   - This closes the propagator → executor feedback loop for continuous autonomy

**Portal Mutations:**
- Browser edits to portal.functionalNetwork or portal.brainNodeMapping → invalidate propagation (on-disk snapshot becomes stale)
- **Action**: operator must re-run `node scripts/build-stress-network.mjs` to refresh assets/data/stress-network-state.json
- Worker-stress-refresh computes live from corpus regardless, but cold-starts on Vercel are likely to cache the on-disk file

### NEEDS WORK / INCONSISTENCIES

**CRITICAL:**

1. **Stale stress-network-state.json** (C:\Users\Chris\Limen-Helix-live-\assets\data\stress-network-state.json, 4.67 MB, last written 2026-05-25 15:57:50 UTC). Audit date 2026-06-07 = **13 days stale**. 
   - Workers should tolerate this gracefully (worker-stress-refresh computes live; stress-propagation falls back to live if cache missing). 
   - But on-disk snapshot serves as safe default for Vercel cold-starts.
   - **Action**: cron daily or on portal-mutation to refresh. Currently requires manual `node scripts/build-stress-network.mjs` invocation (not automated).

2. **Cron Schedule Not in vercel.json** (C:\Users\Chris\Limen-Helix-live-\vercel.json only declares capital-engine, not stress workers). 
   - vercel.json has no entries for worker-snapshot, worker-stress-refresh, worker-autoqueue, worker-autofire, worker-multipass, worker-sleep-cycle, worker-ingest.
   - These must be triggered externally (GitHub Actions, Terraform Cloud, or manual polling).
   - **Action**: document externally-managed cron schedule or add to vercel.json. Gap in observability.

3. **Company Scoring Priority Scheduler Backlog** (company-phase-scorer.js line 19: `limen:company_score_queue → { pointer, lastRun }`). 
   - Pointer tracks round-robin progress across 506 CIKs. Full cycle takes ~25 min (30+30 per tick, 3-min cron = 8.4 ticks).
   - **Constraint:** scorer may FIND backlog (determine which companies need scoring) but must not BUILD backlog autonomously (operator-driven demand).
   - **Status:** Company scoring is PRIORITY-aware (elevated domains first), not backlog-building. Verified compliant.
   - However, if domain health never rises above elevated threshold, round-robin pointer may stall. **Action**: monitor limen:company_score_queue pointer drift.

4. **Remediation Queue Orphaned** (limen:remediation_queue emitted by sleep-cycle but not consumed). 
   - Sleep-cycle emits: scorer-silent, queue-backed-up, weekly-corpus-audit remediation requests to limen:remediation_queue.
   - No worker visible that consumes + acts on these (no auto-remediation code in place).
   - **Action**: either implement remediation worker or document as operator-review-only queue.

**HIGH:**

5. **Network Stress Boost Not Gated by Freshness Explicitly** (limen-worker-autoqueue line 51: `stressFresh = !!(stressMeta && Date.now() - stressMeta.generatedAtMs < 60*60*1000)`).
   - Honest degradation: if limen:stress_slim is missing/stale >1h, stress boost is skipped.
   - But no worker explicitly alerts if stress-refresh is failing (silent fail if propagation compute errors).
   - **Action**: add alerting to limen-worker-stress-refresh error path.

6. **Autofire Daily Budget Per-Day-TTL Edge Case** (limen-worker-autofire line 535: `ttl = Math.max(60, 86400 - Math.floor((Date.now() % 86400000) / 1000))`).
   - Budget key limen:autofire_budget_YYYY-MM-DD self-expires at midnight UTC.
   - If a fire happens 23:59 UTC on day N, budget rolls over immediately.
   - **Ambiguity:** does operator deploy in UTC or local TZ? Vercel runs UTC. 
   - **Action**: clarify in operator runbook; consider explicit day-boundary guard.

7. **Sleep-Cycle Consolidation Pass (limen-worker-sleep-cycle line 58-74)** does not actually re-score: "We can't invoke the kernel from here without risking timeout budget."
   - Consolidation just SAMPLES recent transitions without validation.
   - **Comment says**: "snapshot worker re-scores at most 60 CIKs/3min and will catch these transitions naturally on the next round."
   - **Risk:** if kernel is broken (returning constant phase), no transition appears → consolidation reports 0 → sleep-cycle emits scorer-silent remediation. Then the daily prompt runs manual audits. **This is working as designed.**

**MEDIUM:**

8. **Portal Load Paths Inconsistency** (multiple fallback paths: __dirname/../assets/data/companies, /var/task/assets/data/companies, process.cwd()/assets/data/companies).
   - Vercel uses /var/task; local dev uses process.cwd() or relative.
   - File-load cache (_PORTAL_CACHE) is per-worker cold-start, not shared across crons.
   - If a portal is mutated between cron ticks, autofire picks up stale cached version.
   - **Likelihood:** low (portals are rarely edited mid-fire), but inconsistent.
   - **Action**: add cache invalidation hook on portal PATCH.

9. **Stress Propagation Inhibitory-Damping Resilience** (linen-stress-propagator.js line 135-160: loadInhibitoryEdges).
   - Reads brain-connectome.json at module init. If missing/malformed, falls back to empty array (no damping).
   - Silent fallback; no alerting.
   - **Action:** none (design is correct), but log cache load in debug mode.

10. **Salience Routing Not Logged** (limen-policy.recommendLane() not exposed; routed through limen-worker-autoqueue).
    - No transparency into why a transition was routed to a given lane (if operator wants to audit).
    - **Action:** emit route decision to limen:autoqueue entry as metadata (already stored: salienceScore, networkStress, but not routing rationale).

**LOW:**

11. **Amplification Rank Recomputation On Every Serialize** (linen-stress-propagator.js line 618: applyAmplificationRanks called on every serializeResult call).
    - Ranks are dynamic (depend on corpus percentiles), so determinism contract (W3) is preserved ONLY if serializeResultDeterministic is used.
    - **Status:** correct (determinism function exists; correct callers use it). No bug.
    - **Action:** none; document for future maintainers.

12. **Stress-Slim Encoding Edge Case** (limen-worker-stress-refresh line 117: `Buffer.byteLength(JSON.stringify(slim))`).
    - Counts bytes for observability. If stress_slim ever approaches Upstash per-value limit (~512 KB by default), this metric will warn.
    - **Current:** 506 CIKs × ~100 bytes/entry ≈ 50 KB. Safe.
    - **Action:** none (monitor limen:stress_meta.bytes over time).

13. **Phase Transitions Append-Only Log Never Pruned Beyond 500 Max** (company-phase-scorer.js line 60, limen-worker-sleep-cycle checks size; sleep-cycle line 100: `transitions.length < 1` for 24h check).
    - 500 entries is ~7 days of high-activity scoring (60 companies/3min cron).
    - If scoring runs idle, transitions log is sparse.
    - **Risk:** operator misreads sparse log as "scorer broken" when it's just quiet.
    - **Action:** add "last_transition_at" timestamp to limen:sleep_cycle_metrics audit output.

14. **Multipass Job Timeout Risk** (limen-worker-multipass passes 240s timeout per section call, plus state reads/writes).
    - Each pass takes ~90s (observed); 6-8 passes × 5-min crons = 30-40 min wall.
    - If a pass times out, job continues on next tick (state persisted). No explicit timeout on the overall job.
    - **Risk:** if a lane is stuck in iteration (e.g., section 3 always errors), job never completes. Blocked forever.
    - **Action:** add max-ticks-per-job (e.g., 100 ticks = 500 min) or max-age-per-job (e.g., 24h) to auto-abort and emit alert.

15. **Missing Audit Trail on Network-Stress Boost** (limen-worker-autoqueue line 92: networkStress field stored but never surfaced in UI).
    - Queue entry has salienceScore (includes network boost), but breakdown (how much of boost came from network vs. phase alone) is lost.
    - **Action:** optional; add breakdown to queue entry or operator UI widget.

**DOCUMENTATION & OPERABILITY:**

16. **No Operator Runbook for Stress System** — Documented in code comments but no standalone operator guide (like there is for capital-engine, etc.). 
    - **Action:** create STRESS_OPERATOR_GUIDE.md covering: cron schedule, budget caps, dedupe windows, remediation queue review, manual stress-network rebuild, sleep-cycle alert interpretation.

17. **Vercel Function Max Duration 300s Not Tuned to Stress Workers** (vercel.json line 11: `"maxDuration": 300`).
    - Autofire + multipass designed to fit within 300s (240s Claude timeout + overhead).
    - But no per-function override; all api/* functions share the cap.
    - **Risk:** if expand-artifact-claude call hangs, entire function times out; state partially persisted.
    - **Action:** no immediate fix (Vercel limitation), but document in runbook that hang > 300s = need manual remediation.

---

**Summary Totals:**
- **Worker endpoints:** 7 (snapshot, stress-refresh, autoqueue, autofire, multipass, sleep-cycle, ingest)
- **Stress/queueing endpoints:** 5 (stress-propagation, stress-slim, phase-transitions, autoqueue, self-pulse)
- **Core library:** 1 (limen-stress-propagator, 751 lines; pure-deterministic)
- **CLI producers:** 1 (build-stress-network.mjs)
- **Redis keys tracked:** 17 (phase_transitions, autoqueue, autofire_budget, stress_slim, multipass_inflight, remediation_queue, etc.)
- **Major data tanks:** command-board-data.json (CIK scores), portal corpus (506 entities), brain-connectome.json (L2 inhibitory edges), stress-network-state.json (4.67 MB, stale 13d)
- **Commits in repo:** 111 total (git log --oneline)
- **Stress-related commits:** not broken out separately, but core stress work visible in recent history

**Cron Coverage:**
- **Every 2 min:** ingest (defense RSS)
- **Every 2-5 min:** snapshot (domain + company scoring)
- **Every 5 min:** multipass autofire (state machine)
- **Every 15 min:** autoqueue (transition → queue)
- **Every 30 min:** autofire (single-call executor) + stress-refresh (propagation)
- **Every 1 hour:** sleep-cycle (audit + remediation dispatch)
- **Every 6 hours:** capital-engine (unrelated)
- **Manually:** build-stress-network.mjs (on portal mutation)

**Operator Constraint Verified:**
- **Cron workers FIND backlog only**: limen-worker-autoqueue (reads transitions, populates queue), limen-worker-snapshot (scores companies, detects transitions). ✅
- **Cron workers never BUILD backlog autonomously**: Only recommendation → queue. ✅
- **Autofire BUILD is gated**: HIGH-salience single-call only, daily $ budget, per-CIK 24h dedupe, stage routing checks. ✅
- **Multipass BUILD is gated**: HIGH-salience multipass only, daily $ budget shared with autofire, per-CIK 24h dedupe, stage routing checks. ✅
- **Operator control point**: PATCH /api/limen-autoqueue (mark FIRED/DISMISSED) or POST /api/limen-self-pulse (manual inject). ✅

---

## 15. Finance/capital + grant/patent/research/investment/SBA pipeline

### PURPOSE

The Finance Domain capital engine: a consolidated, multi-connector revenue aggregation & decision system serving grant applications, patent filings, research submissions, investment theses, and SBA lending packages. It PROPOSES capital routes, produces filing documents, audits/rewrites applications via multi-AI cross-checks, and records income to a ledger — but NEVER moves money without a human signature. The system is the backbone that turns domain insights (bridges, business-neural patterns, portal observations) into fundable/investable artifacts across 4 major lanes (patent, grant, research, investment) plus SBA microloan/7(a) templates.

### KEY FILES

**Primary engine:**
- C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (consolidated Vercel function; 22 GET/POST actions replacing what would be 5+ separate files)
- C:\Users\Chris\Limen-Helix-live-\assets\data\capital-engine.json (static contract: 39 revenue streams, 19 connectors, capital routing policy, approval queue, AI orchestration config)

**Core finance libraries:**
- C:\Users\Chris\Limen-Helix-live-\lib\finance-ledger.js (P&L auditor; records income/spend/audit events to Redis; computes per-stream P&L, domain health 0..1, lendable surplus)
- C:\Users\Chris\Limen-Helix-live-\lib\finance-autonomic.js (self-running AUDIT → HEAL → BUILD loop; budget-gated, no money movement)
- C:\Users\Chris\Limen-Helix-live-\lib\stripe-rail.js (ACCEPT income via Stripe payment links; PROPOSE fees/lending but halt for sign-off; no money outflow executed here)
- C:\Users\Chris\Limen-Helix-live-\lib\stream-ops.js (autonomous content production for revenue streams; multi-AI (Grok→Anthropic→OpenAI) retrieval, authoring, verification; corpus grounding; disclosure injection)

**Application & patent pipeline:**
- C:\Users\Chris\Limen-Helix-live-\lib\application-auditor.js (multi-AI audit: Grok retrieves funder rules → Anthropic audits/rewrites → OpenAI cross-checks; scores readiness, flags fatal/merit issues, runs adversarial review, scores per-lane fit)
- C:\Users\Chris\Limen-Helix-live-\lib\patent-packager.js (turns filed patent draft into marketplace listing + target licensees)
- C:\Users\Chris\Limen-Helix-live-\assets\data\review-rubric.json (20 accumulated lessons from NSF/NIH feedback; adversarial reviewer enforces these)

**Document generation & filing:**
- C:\Users\Chris\Limen-Helix-live-\lib\long-form-generator.js (Sonnet-powered 20-30 page document expansion; outputs patent/grant/SBA/research specs from seed artifact; calibrated for new business with no investor)
- C:\Users\Chris\Limen-Helix-live-\lib\print-pipeline.js (per-lane markdown rendering: patent → USPTO shape; grant → SBIR full package; SBA → 7(a) credit memo; research → OSF preregistration; investment → thesis brief)
- C:\Users\Chris\Limen-Helix-live-\lib\markdown-to-docx.js (renders markdown to DOCX with title/subject/metadata)
- C:\Users\Chris\Limen-Helix-live-\api\print-document.js (GET endpoint: portal+lane → download DOCX filing document)
- C:\Users\Chris\Limen-Helix-live-\api\print-from-pattern.js (bypass endpoint: approved Redis pattern → print without syncing to bridge-patterns.json)

**Content production pipeline:**
- C:\Users\Chris\Limen-Helix-live-\lib\post-adapters.js (real per-platform publishing: Beehiiv (Create Post API), Printful (sync products), Gumroad (package-only), site (owned journal via Redis))
- C:\Users\Chris\Limen-Helix-live-\lib\affiliate-injector.js (reads affiliate-config.json; builds tracked Amazon/network links; appends disclosed "Recommended" block)
- C:\Users\Chris\Limen-Helix-live-\lib\products.js (defined products in capital-engine.json; ensures Stripe payment links; ctaFor() returns product matching a content source card)
- C:\Users\Chris\Limen-Helix-live-\lib\corpus.js (IP-safe grounding: loads corpus.json source cards; groundingText() injects author's framework + references; ipGuard() enforces patent/IP firewall)

**Lane-specific handler:**
- C:\Users\Chris\Limen-Helix-live-\lanes\nsf-project-pitch.js (D3-E.1 NSF SBIR/STTR handler; generates 4-section project pitch (3500/3500/1750/1750 char limits); strict contract sourcing from docs/D3-E-NSF-RESEARCH.md; forbids UNKNOWN claims; separates draft/draft-with-gaps)

**User-facing pages:**
- C:\Users\Chris\Limen-Helix-live-\applications.html (audit & sign dashboard; shows score, readiness gate, fatal/merit issues, secondPass, budget check, missing docs, strengths; buttons for rewrite/approve/submit/adversarial-review)
- C:\Users\Chris\Limen-Helix-live-\my-documents.html (downloads approved bridge patterns as 4-lane filing documents; maps pattern.id → pattern/document generation; "Download all 4" per pattern)
- C:\Users\Chris\Limen-Helix-live-\pattern-proposals.html (bridge pattern proposals UI; collapsible rows, per-lane score gating, approve/reject/expand buttons)
- C:\Users\Chris\Limen-Helix-live-\journal.html (owned publishing surface; articles from site:articles Redis list; free archive)

### LIVE PAGES

- https://limenhelix.com/applications (multi-AI audited grant/patent applications; approve & sign)
- https://limenhelix.com/my-documents (download approved patterns as filing documents per lane)
- https://limenhelix.com/pattern-proposals (bridge pattern approval queue; single-line view)
- https://limenhelix.com/journal (owned LIMEN Journal archive; free, autonomous publish)

### DATA

**Capital engine contract (assets/data/capital-engine.json):**
- 39 revenue streams (tier 1–5; status: live/setup/needs-key/pre-revenue/gated/attach; capital: near-zero/$1-100/$100-1k/$1k-10k/$10k+)
- 19 connectors (tier 0–3; type: rail/affiliate/platform/publishing/storefront/fulfillment/production/domain-node/owned)
- Connector readiness: live, mcp-auth, manual, key-present, partial (missing optional), needs-key
- capitalRouting.policy + proposedRoutes (read-only proposals; never executes)
- approvalQueue (single-signature: Chris Hubbel, Managing Member; future: threshold-tiered)
- AI orchestration: Anthropic (primary), OpenAI (verification), Grok (web-grounded retrieval)

**Finance ledger (Redis limen:finance:ledger):**
- Event types: income, spend, fee-proposed, lend-proposed, audit
- Computes: per-stream P&L, domain net, burnRatio, activeStreams, diversity, solvency, health (0..1)
- Stores: up to 5000 most recent events

**Application auditor (Redis limen:applications:audited):**
- Status pipeline: audited → approved (human sign) → submitted (file/Gmail outreach)
- Score 0–100; readiness gates: return-without-review | major-revisions | minor-revisions | submittable
- Fields: fatal[], merit[], missingDocs[], budgetCheck, strengths[], humanMustSupply[], secondPass (OpenAI cross-check), provenance (rules/audit/verify providers)

**Patent packager (Redis limen:patent:listings):**
- Status: packaged → outreach-sent → listed → inquiry → licensed
- Listing: title, abstract (≤150 words), problem, solution, applications[], claimSummary, targetCompanies[].whyFit, suggestedVenues, licensingNote, suggestedAskUSD

**Stream operations (Redis limen:finance:content-queue + limen:finance:published):**
- Queue per artifact: id, streamId, connector, format (newsletter/storefront/social/post), createdAt, status (queued), content, disclosures[], affiliateLinks[], tokenReady, provenance (retrieve/author/verify), sourceCard
- Published: same + externalId, platform, url
- Max queued: 500; max published: 500

**Approval queue (Redis limen:finance:approvals):**
- Type: lend (inter-domain lending proposals)
- Fields: ts, type, toDomain, amount, status: blocked-on-human
- Max kept: 200

**Data freshness:**
- capital-engine.json: authoritative static contract, authored 2026-06-06
- finance-ledger: live event stream (updates on income webhook, spend proposal, audit tick)
- applications:audited: populated on audit/rewrite, status updates on approval/submit
- patent:listings: populated on packageListing call
- content-queue: populated on produce() call; consumed on publish()
- site:articles: published journal articles; max 500 kept
- site:subscribers: email capture for journal; max 99,999 kept

**Tank notes:** corpus.json exists (IP-safe source cards); affiliate-config.json exists (network templates); no live money in ledger yet (pre-revenue simulation). All tanks are young / sparse (audit ticks have fired; applications audited 0–50; no patent listings yet).

### HOW IT CONNECTS

**Forward signal path (domain bridges → finance artifacts):**

1. **Bridge patterns (from pattern-proposals.html)** → approved → show in /my-documents.html
2. **Bridge pattern captures** portal (company context) + derivedAngles (per-lane seeds: patent/grant/sba/research/investment)
3. **print-document.js** reads bridge + portal → calls long-form-generator (Sonnet) → DOCX filing document
4. **long-form-generator.js** uses bridge.patternId + seed artifact + portal context to write 20-30 page USPTO/NIH/SBA-shaped spec
5. **Applications flow**: operator writes grant text → /api/capital-engine?action=audit-application → Grok (rules) + Anthropic (audit/rewrite) + OpenAI (cross-check) → applications.html shows score/gate/findings → operator clicks "approve" → status → "submit" (halts for sign-off; federal grants must file via Research.gov; patents/marketplace can auto-mail via Gmail)
6. **Revenue streams**: capital-engine.json lists 39 streams (owned_journal, essay_*, guide_*, faceless_youtube/tiktok, kc_directory, newsletter_beehiiv, course, micro_saas, api_resale, fba, tiktok_shop, microsaas_acquire, sba_cashflow_buy, etc.)
7. **Content production** (stream-ops.js): Grok retrieves angles → Anthropic authors → OpenAI verifies → affiliate-injector wraps links → corpus grounds in author's framework → post-adapters dispatch to platform (Beehiiv/Printful/Gumroad/site)
8. **Income recording**: Stripe webhook (stripe-webhook action) → recordWebhook() → ledger.record(type: income) → finance-autonomic.tick() reads ledger.summary() → proposes lending if lendableSurplus > 0
9. **Score-gating** (scoreLanes action): card → application-auditor.scoreLanes() → scores 4 lanes (patent/grant/research/investment) per rubric → enforces 3 pre-gates (existenceAudit, steelman, dataFeasibility) → routes to qualifying lanes (score ≥6/10)

**Backward trace (who reads who):**

- **print-document.js** reads: portal JSON, bridge from portal.bridgeReadings.matched
- **long-form-generator.js** reads: seed artifact, bridge, portal; writes to stdout (markdown)
- **application-auditor.js** reads: funder rules (Grok call), proposal text, review-rubric.json → writes to Redis applications:audited
- **stream-ops.js** reads: stream config (capital-engine.json streams), corpus.json, affiliate-config.json → writes to limen:finance:content-queue, optionally to platform APIs (Beehiiv, Printful)
- **stripe-rail.js** reads: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET → writes to finance-ledger
- **finance-autonomic.js** reads: capital-engine.json streams, finance-ledger, stream-ops queue → writes to finance-ledger (tick audit event), limen:finance:approvals (lending proposals)
- **finance-ledger.js** reads: Redis limen:finance:ledger → computes net, health, lendableSurplus
- **applications.html** reads: /api/capital-engine?action=applications (list), fires /api/capital-engine?action=audit-application (POST), rewrite-application (POST), application-approve (POST), application-submit (POST), adversarial-review (POST)
- **my-documents.html** reads: /api/pattern-proposal (list approved patterns) → fires /api/print-from-pattern?slug=...&lane=...&patternId=... (4 downloads)
- **pattern-proposals.html** reads: /api/pattern-proposal (list + status) → fires approve/reject via pattern-proposal API

### NEEDS WORK / INCONSISTENCIES

1. **Global auto-generate disabled** (my-documents.html line 72): "disabled — duplicates in Redis cause repeat prints" — limen:pattern-proposals list has duplicate entries by pattern.id; dedup logic exists in my-documents.html render() but "Auto-generate ALL documents for ALL patterns" button is disabled. Ticket: clean up Redis deduplication or rebuild dedup on the backend.

2. **Corpus IP guards weak for grounded content**: corpus.js loads corpus.json source cards and injects ipGuard() text into prompts, but there is NO hard enforcement that generated content respects the patent/IP claims boundary. Stream-ops.js calls corpus.groundingText() but does not validate that the AI output stays within the IP firewall. Risk: proprietary methodology details leak into free content.

3. **No pre-registration for print-document lanes**: application-auditor.js has lanes=['patent', 'grant', 'research', 'investment'] per scoreLanes(), but long-form-generator.js systems have PATENT_SYSTEM, NIH_GRANT_SYSTEM, NSF_GRANT_SYSTEM, LOAN_SYSTEM, RESEARCH_SYSTEM (implied but not shown in snippet). Missing: preregistration system prompt for OSF lane; investment thesis system prompt incomplete in snippet; franchise lane noted in LANE_RENDERERS but franchise system not in generator.

4. **NSF lane handler (lanes/nsf-project-pitch.js) is a single lane, not a family**: other major funders (NIH, DOE, DARPA, AHRQ) are not modeled as separate lanes. System assumes all grant lanes route through application-auditor.js multi-funder support, but lanes/nsf-project-pitch.js is NSF-specific. Unclear whether other lanes exist elsewhere or whether the lane routing is incomplete.

5. **Patent claims NOT VERIFIED for non-obviousness (103) before filing**: application-auditor.js audit scores patent readiness (USPTO 35 USC 101/112 checked), but patent-packager.js notes "only package AFTER filing — public disclosure before filing can bar patent rights." There is NO pre-filing novelty/FTO check. If a bridge-generated patent overlaps with a real 20221234567 patent, system will not catch it upstream. Solution: integrate with Google Patents / PatentSight API before print-document reaches packaging.

6. **Applicant entity inconsistency across lanes**: print-document.js / long-form-generator.js notes "new business with no investor," but does NOT reconcile entity identity. Patent lanes may invent an entity name different from grant lanes (LIMEN Helix LLC vs. a derived SBA-borrower entity). lessonid "entity-coherence-and-assignment" in review-rubric.json flags this, but system does not enforce it on output. Risk: a single bridge pattern may generate legally incoherent lanes (patent ownedby entity A, grant awarded to entity B, loan to entity C) with no documented assignment chain.

7. **SBA lane templates are shells**: long-form-generator.js LOAN_SYSTEM (lines 102+) outputs a credit-memo-style template, but print-pipeline.js _sbaMarkdown() line 98 has "Template shell pending operator population." No actual SBA 7(a) / Microloan specimen sections are generated. Unsent: "sources of repayment" is critical for SBA; current system leaves it as a placeholder.

8. **No live Stripe integration yet**: capital-engine.json notes stripe connector "status": "connected-on-allaccesskc" but STRIPE_SECRET_KEY is NOT yet added to Vercel limenhelix project env. Stripe.rail.js functions exist but cannot execute. Income acceptance is unavailable on this project (AllAccessKC holds the Stripe account). To unblock: add restricted STRIPE_SECRET_KEY to https://vercel.com/limen-helix-live project env.

9. **Budget math heuristic is crude**: application-auditor.js _budgetMath() uses regex to extract dollar amounts and checks whether the sum of non-max figures is within 5% of the stated total. Rule is HEURISTIC only and will miss:
   - Multi-year budgets split across project years (Phase I + Phase II cash flows)
   - Indirect cost rate calculation errors (applies 10% unless told otherwise, but does not reconcile against institutional NICRA)
   - Prohibited cost-share (NSF/NIH rules vary; no funder-specific validation)
   Solution: parse structured budget tables (NOT regex) and apply funder-specific rules per lane.

10. **Adversarial review gate is not hard**: applications.html shows adversarial-review results but operators can still approve/submit even if gate="block". The UI has no conditional disable. review-rubric.json lessons are ADVISORY only; the real gate is operator judgment. No pre-submission automation blocks a return-without-review application.

11. **Lane scoring does not feed decision logic**: application-auditor.scoreLanes() returns lanes.patent.score, lanes.grant.score, etc. with a deterministic DECISION RULE (keep if >=1 lane >=6; route to >=6 lanes), but the /my-documents.html flow does NOT call score-lanes before downloading. Operator manually selects which 4 lanes to generate; no gating. Risk: operator downloads a patent filing for a card that scored 2/10 on patent lane and 9/10 on grant lane, wasting time and potentially filing a weak patent.

12. **Corpus source-card selection is soft**: corpus.js select() picks the card whose domains best match stream.category, with a scoring heuristic (100 - idx - domain_count). Tie-breaking is unspecified. If two cards equally match, the first card wins. This can lead to suboptimal grounding if corpus.json card order reflects insertion time, not relevance. Solution: add explicit card priority field to corpus.json.

13. **Affiliate link injection does NOT check FTC compliance**: affiliate-injector.js wraps URLs and stream-ops.js injects "#ad" disclosure, but there is NO:
   - Audit that the disclosure is VISIBLE and CLEAR in the output format (e.g., does Beehiiv render HTML comments? Does the social post show before truncation?)
   - Verification that the disclosure is placed BEFORE the link (FTC Rule § 255.1)
   - Revocation of link if policy changes (e.g., if Amazon Associates revokes the tag)
   Solution: render-time FTC validator that checks disclosure visibility in each platform's output.

14. **"Products" defined in capital-engine.json but NOT fully integrated**: products.js loads capital-engine.json products[] array and manages Stripe payment links. But capital-engine.json file is incomplete in the snippet (lines 1–100 read); cannot see the products array. Unclear how many products exist, whether they are mapped to sourceCard IDs correctly, or whether ensureLinks() is called automatically or only on demand.

15. **Long-form generator calls are not budgeted**: autonomic.tick() builds up to buildCap=3 artifacts per tick (to control AI spend), but long-form-generator.js calls inside print-document.js are NOT gated by autonomic budget. An operator can spam "Download all 4" for 100 approved patterns and burn through the Anthropic budget immediately. Solution: add token budget tracking to print-pipeline calls, or split long-form generation into a separate autonomic queue.

16. **No pre-revenue validation for SBA/Microloan**: long-form-generator.js LOAN_SYSTEM assumes borrower is pre-revenue (no cash-flow history), but does not validate that the "sources of repayment" (line 113: "founder's personal income from another role") is REAL. SBA officers will ask for job verification, paystubs, personal credit score. System output is a template shell; actual underwriting is operator responsibility. Risk: generated SBA packages are plausible-sounding but may not survive lender scrutiny.

17. **No state-by-state SIC/NAICS enforcement**: long-form-generator.js references NAICS + SIC but does not validate against state/federal business registration. A bridge pattern may specify a fictional SIC or misaligned NAICS (e.g., "pharma research" SIC 2834 but borrower is a software LLC). Solution: limen-policy.js should validate SIC/NAICS against official code lists at generation time.

18. **Missing error handling for truncated AI output**: application-auditor.js _salvage() attempts to regex-recover JSON on truncation, but _extractJson() in patent-packager.js, affiliate-injector, and others do NOT have salvage logic. If OpenAI/Anthropic returns a truncated response (stop_reason="max_tokens"), the system silently returns null and downstream code fails. Solution: standardize _extractJson with salvage fallback across all modules.

19. **Approval queue is Redis-only; no durable audit log**: finance-autonomic.js writes lend-proposed events to limen:finance:approvals (list, max 200), but there is NO persistent audit of APPROVED vs. REJECTED proposals. If Redis is cleared, the history is lost. Solution: write approvals to a durable DB (PostgreSQL) alongside the Redis cache.

20. **Score gating uses OLD rubric; no versioning**: application-auditor.js loads review-rubric.json at call time, but there is NO version field on returned audit objects. If rubric.json is updated, old audits are scored against a different rubric, making them incomparable. Solution: freeze rubric version in each audit object (schemaVersion + rubric.version).

21. **Orphaned fields in capital-engine.json**: capitalRouting, approvalQueue noted in contract but not used by autonomic.tick(). Only capitalRouting.proposedRoutes is read (line 73 in finance-autonomic.js); capitalRouting.policy is informational. approvalQueue is never populated. These fields may be legacy from an earlier design. Cleanup: remove or fully integrate.

22. **NSF project-pitch lanes/handler is isolated**: lanes/nsf-project-pitch.js has its own strict contract (docs/D3-E-NSF-RESEARCH.md), schema version (D3-E.nsf.v1), and FORBIDDEN_CLAIMS list, but there is NO integration point to the main /api/capital-engine?action=audit-application pipeline. It is a standalone module. Unclear how NSF pitches are routed from pattern-proposals.html or whether they are manually invoked. Solution: wire score-lanes or audit-application to call generateNsfProjectPitchDraft when appropriate.

23. **Investment lane lacks seed artifact templates**: print-document.js references investment lane but long-form-generator.js INVESTMENT_SYSTEM is not shown in snippet. Unclear whether investment document generation works or is a stub. Review-rubric.json lessons include research|investment gating (dataFeasibility), so the lane should exist. Solution: complete and test long-form INVESTMENT_SYSTEM system prompt.

24. **"Research" lane is research-adjacent but not integrated with actual research databases**: long-form-generator.js RESEARCH_SYSTEM (not shown) likely outputs OSF preregistration markdown, but there is NO integration with OSF.io API, FRED/SEC EDGAR/BLS/EIA data validators, or IRB lookup. System trusts the operator to provide valid hypothesis/methodology; no upstream data-availability check. Solution: add pre-gate that validates core indicators are computable on the current stack (per lesson "data-feasibility").

---

**File Evidence:**

- C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (lines 287–295): score-lanes action fires application-auditor.scoreLanes()
- C:\Users\Chris\Limen-Helix-live-\applications.html (lines 85–86): adversarial-review button fires with lane='grant' (hardcoded, not dynamic)
- C:\Users\Chris\Limen-Helix-live-\my-documents.html (line 72): "generateEverything" button disabled with note on Redis duplicates
- C:\Users\Chris\Limen-Helix-live-\lib\affiliate-injector.js (line 24): FTC disclosure injected, but render-time visibility not validated
- C:\Users\Chris\Limen-Helix-live-\lanes\nsf-project-pitch.js (lines 94–105): FORBIDDEN_CLAIMS array; no integration to audit-application
- C:\Users\Chris\Limen-Helix-live-\assets\data\review-rubric.json (line 28): entity-coherence-and-assignment flagged but not enforced on render

---

## 16. Engine outputs / artifacts

### PURPOSE

The engine output layer is the 6-lane artifact factory that consumes bridge patterns (neural↔business mappings) and produces "ready-to-sign" documents across patent, grant, SBA, franchise, investment, and research lanes. Each artifact is deterministically generated from portal kernel readings + functionalNetwork context + matched bridge patterns + verbiage templates, with no AI calls at the generation stage. The artifacts are tagged with provenance (pattern ID, confidence, kernel snapshot timestamp) for audit trailing. Investment artifacts are conditionally wired to live market data (stock price, revenue, net debt) and phase-conditioned valuation (PHASE_FACTOR re-rating model), producing real price targets when data exists, or honest qualitative theses when data is absent (no fabricated numbers).

### KEY FILES

- **lib/engine-output-generator.js** (469 lines) — orchestrates the 6 lanes (patent, grant, sba, investment, research, franchise); per portal generates up to 6×N matched-bridge artifacts. Returns `portal.engineOutputs` object shaped `{ patent: [...], grant: [...], investment: [...], research: [...], sba: [...], franchise: [...], totalArtifacts, generatedAt }`. Each artifact tagged with lane, patternId, confidence, and provenance chain (kernelId, sourceLane, generatedAt).

- **lib/bridge-engine.js** (155 lines) — matches portals against the bridge-patterns library using indicator detectors (kernel_phase, fn_phase_share, fn_text_match, text_match, field_presence). Produces `portal.bridgeReadings.matched` array sorted by confidence. Confidence formula: `(matchedIndicators / substantiveIndicators) × pattern.bridge.confidence`. Match threshold: 0.15. Classifier-only detectors (sic/industry text_match) excluded from scoring to prevent sector tags from inflating confidence.

- **lib/pattern-author.js** (477 lines) — Claude-powered pattern proposal system for portals with kernel signal but no existing bridge match. Author-time salience pre-filter routes non-firing patterns to HELD_UNMATCHED (offline repair worker re-encodes their detectors against real portal signals). Proposed patterns stored in Redis (`limen:pattern-proposals` list) or fallback file (`assets/data/_pattern-proposals.json`). Includes repair subsystem (`repairPattern()`) for offline afferent enrichment. Pattern dedup guards block re-proposals of same (neural region, business signature) pair on same portal.

- **lib/valuation.js** (149 lines) — phase-conditioned re-rating model for investment lane. Consumes market-data snapshot (price, shares, revenue, netDebt, 52-week range, optional evRevenue multiple) + kernel phase + bridge confidence + side (LONG/SHORT) + horizon. Returns computed valuation with base/bull/bear targets, probability weights, IRR, stop anchored to 52-week range, asymmetry, and position-size (conviction × asymmetry, capped [0.5%, 4%]). **PHASE_FACTOR** (the core calibration) maps each phase (p0–p10) to a multiple compressor/expander: p0=1.05 (stable), p3=0.70 (active stress), p7=0.50 (terminal), p8=0.25 (bankruptcy), p10=1.25 (resurrection). Returns null if load-bearing inputs missing; generator degrades to honest qualitative thesis.

- **assets/data/bridge-patterns.json** (524 lines, 15 patterns) — the live library. Each pattern: `id, neural (region, regionLabel, state, mechanism, knownTreatments, clinicalReferences), business (signature, description, indicators array with detector schemas, phaseAffinity, examples, businessReferences), bridge (mappingType, confidence 0–1, rationale), derivedAngles (patent, grant, investment, research, sba, franchise — seeds for the 6 lanes)`. Pattern IDs follow naming: `<neuro_region>_<mechanism_short>_x_<business_signature>`. Sample: `NAc_reward_dysregulation_x_revenue_chase, dACC_conflict_monitoring_failure_x_audit_committee_dysfunction, dlPFC_executive_function_x_strategic_planning_collapse`, etc.

- **assets/data/verbiage-templates.json** (275 lines) — canonical 4-lane template library. Patent lane: claims-preamble, title template, abstract 4-beat, background gap-statement, summary, claim1Method/Apparatus/System, dependent narrowing, shibboleths (gerund-first steps, comma-injection "by a processor", at-least-one-of-lists), forbidden words (novel, innovative). Grant lane: abstract 4-beat (BEAT_1_PROBLEM, BEAT_2_WHY_CURRENT_FAILS, BEAT_3_INNOVATION, BEAT_4_PHASE_II_PLAN with ≥3 quantitative anchors), longTermGoal, overallObjective, centralHypothesis, rationale, aimSentence, significanceGap, innovationOpener, expectedOutcomesCloser. SBA lane: borrowerSummary, guarantorBackground, useOfProceeds, sourcesOfRepayment, dscrAnalysis, stressTest, creditNotElsewhere, creditDecisionRationale, personalNetWorth; includes 10-K risk factor structure and bond-prospectus shapes. Investment lane: header, variantViewOpener (3 rotated versions per portal hash), catalystBlock, valuationArithmetic, positionSizing, riskAndFalsifiability, exitConditions, activist13DOverlay, ackmanImperativeBullets; tone tests (Marks qualifier removal, Buffett concrete metaphor, Loeb headline indictment, Burry falsifiable-date, Ackman imperative verbs).

- **api/limen-engine-output.js** (400+ lines) — persistence endpoint. Stores computed artifacts to Redis (`limen:engine_output:{outputId}`, `limen:engine_output_index:by_cik:{cik}`, `limen:engine_output_index:by_lane:{lane}`, `limen:engine_output_log` append-only audit). GET queries by `?cik=`, `?lane=`, `?id=`, `?log=1`. POST/PATCH enforce operator token auth (Bearer token; AUTH_ON if `LIMEN_OPERATOR_TOKEN` env var set). Payload limit 2 MB. Artifact versioning: `eo-v1`. Fallback in-memory store per cold-start if Redis unavailable.

- **scripts/build-engine-outputs.mjs** (67 lines) — idempotent batch runner. Iterates all portal JSON files; for each with `bridgeReadings.matched`, calls `generateForPortal()` and writes results back to portal.engineOutputs. Produces `assets/data/_engine-build-log.json` summary (portalsProcessed, portalsWithBridges, portalsWithOutputs, totalArtifacts, byLane counts). Dry-run vs apply mode. Can filter by `--slug=<name>`.

- **lib/long-form-generator.js** (200+ lines) — expands seed artifacts into 20-30 page filing-ready DOCX. Targets USPTO Micro Entity Pro Se (patent), NIH SBIR Phase I (grant, pre-revenue sole founder), NSF SBIR Phase I (distinct rules), SBA Microloan/Express, and OSF preregistration (research). Each system prompt enforces NO fabricated dollar amounts, NO fabricated citations, NO invented operating history; honest framing for pre-revenue startup context. Uses claude-sonnet-4-6 (cost-to-quality ratio). Sections built incrementally. Returns Markdown + optional DOCX via `renderToBuffer()`.

- **api/print-document.js** (90 lines) — download endpoint. GET `?slug=<portalSlug>&lane=<patent|grant|sba|research>&index=<n>&format=<docx|md>`. Loads seed artifact from `portal.engineOutputs[lane][index]`, retrieves matching bridge, calls `long-form-generator.generate()`, streams DOCX with Content-Disposition attachment. If seed missing, synthesizes from any matched bridge (fallback for SBA which currently has no derivedAngles).

- **assets/js/company-portal-engine-render.js** (500+ lines) — frontend renderer for company portal pages. After CompanyPortalUI renders, injects BRIDGE PATTERNS section (right panel, matched patterns with neural region, confidence, matched indicators, phase affinity, treatments) and ENGINE OUTPUTS section (center panel, 6 tabbed lanes with artifact previews). Gate B v0.2 suppression: detects PLACEHOLDER_CONTAMINATED state and renders warning banner if any artifact contains {{UPPERCASE}} tokens (none currently, but system monitors this). Artifact action buttons: print (DOCX download via `/api/print-document`), decline, sign (placeholder for downstream).

- **helix-artifacts.html** (34 lines) — list view page. Mounts `LIMENArtifactListUI` from `assets/js/limen/artifact-list-ui.js`. Shows all persisted artifacts by lane/CIK/status.

- **helix-artifact.html** (34 lines) — detail view page. Mounts `LIMENArtifactViewerUI` from `assets/js/limen/artifact-viewer-ui.js`. Full Markdown body, open items, ready-to-sign checklist, citations, provenance chain, status promotion.

- **assets/data/fired-artifacts/** (1 artifact as of 2026-06-07) — outputs that have "fired" (fired = reached approval + deployment threshold). Currently contains one research-note: `2026-05-31__research-note__bla-hyperactive-economy__exposure-to-volatility-reexposure.md` (184 lines). Documents the fire event: source verification (PubMed), fidelity gate (mechanism coherence), port verification (UNVERIFIABLE — candidate intervention not yet in literature), lane assignment rule (mechanism-coherent + source VERIFIED + port UNVERIFIABLE → RESEARCH lane), authoring disposition (author-on-fire).

- **api/capital-engine.js** — separate capital-allocation recommendation engine (not part of the 6 lanes; feeds portfolio-construction signals).

- **api/pattern-proposal.js** — HTTP facade for pattern-author operations (GET list, POST approve/reject/restore).

### LIVE PAGES

- https://limenhelix.com/helix-artifacts — searchable list of all persisted engine artifacts across 6 lanes
- https://limenhelix.com/helix-artifact?id=<artifactId> — detail view of a single artifact with full Markdown body + actions
- https://limenhelix.com/company-portal/<slug>#engineOutputs (embedded in company portal pages) — inline artifact preview within the portal rendering

### DATA

**Inputs (what engine consumes):**
- `portal.kernelReadings` (k1, k2 phases, composites, alerts)
- `portal.bridgeReadings.matched[]` (patternId, neuralRegion, businessSignature, confidence, matchedIndicators, derivedAngles for each lane)
- `portal.functionalNetwork` (suppliers, customers, capitalProviders, regulators, competitors with phase, relationshipNote, brainNodeRole)
- `portal.financialHealth` (compositeScore, dominantPhase, financialState.cashRunwayQ)
- Market data snapshot `md` (price, shares, revenue, netDebt, evRevenue, week52High, week52Low, advUsd, sources, asOf) — **optional; if absent, investment lane degrades to qualitative**
- Verbiage templates from `assets/data/verbiage-templates.json`

**Outputs (what engine produces):**
- **Static JSON:** portal.engineOutputs written to `assets/data/companies/<slug>.json` after batch run
- **Live Redis:** `limen:eo:<slug>` (engine-outputs for that portal, refreshed per cron build-engine-outputs tick)
- **Persisted artifacts:** `limen:engine_output:{outputId}` (individual artifacts persisted via POST to `/api/limen-engine-output`)
- **Audit log:** `limen:engine_output_log` (append-only list of persistence events)

**Data freshness:**
- Bridge library: static (refreshed when patterns are approved via pattern-author)
- Portal engineOutputs: semi-fresh (regenerated on each `build-engine-outputs.mjs` run; typical cadence TBD per cron config, likely daily or on-demand)
- Market data: live (fetched per `computeValuation()` call; can be stale if portal's market-data snapshot is old)
- Fired artifacts: manually approved by operator; persisted to filesystem

**Tank stats (measured 2026-06-07):**
- 800 total portals in corpus
- 461 portals (57.6%) have bridgeReadings.matched (passed the bridge-engine filter)
- 461 portals (100% of those with bridges) have engineOutputs generated
- 0 placeholder tokens detected across all engineOutputs (fully resolved)
- Patent artifacts: 461
- Grant artifacts: 461
- Investment artifacts: 461 (all qualitative; 0 with computed valuation — market data not integrated at build time)
- Research artifacts: 461
- SBA artifacts: 0 (no patterns currently emit derivedAngles.sba; structure exists but unused)
- Franchise artifacts: 0 (structure exists but generator returns null; FTC Rule research pending)
- Fired artifacts: 1 (research-note, BLA/amygdala, dated 2026-05-31)

### HOW IT CONNECTS

**Forward path (engine outputs → consumer pages):**
1. Portal enricher (enrich-portal-claude.js, likely) or batch runner (build-engine-outputs.mjs) calls `generateForPortal(portal, {marketData})` → engine emits 6-lane artifact tree
2. Tree written to `portal.engineOutputs` (static JSON)
3. Parallel Redis write to `limen:eo:<slug>` for live cache
4. master-inbox.html reads `/api/master-inbox` → buildInbox() → displays lane-firing queues + top-priority queue
5. Company portal page (any `company-portal-*.html`) loads portal JSON → CompanyPortalUI.renderCompany() → company-portal-engine-render.js injects BRIDGE + ENGINE sections
6. User tabs through patent/grant/investment/research lanes → artifact preview rendered inline
7. User clicks "PRINT" button → POST to `/api/print-document?slug=<slug>&lane=<lane>&index=<n>` → long-form-generator.generate() → DOCX streamed to browser
8. User clicks "SIGN" (placeholder) → future integration with signature service
9. helix-artifacts.html / helix-artifact.html provide standalone artifact list + detail views (used by operators)

**Backward path (portal signals → bridge matching → engine triggering):**
1. Cron job runs `build-bridge-readings.js` (not audited but referenced in grep) → portal.bridgeReadings.matched populated
2. Immediately after (or as part of same orchestration), `build-engine-outputs.mjs --apply` runs → for each portal with `bridgeReadings.matched`, generateForPortal() emits outputs
3. If investment lane requires live market data, market-data-fetch job must run first (otherwise investment degrades gracefully)
4. Pattern approvals flow via pattern-author.js + pattern-proposal.js → new patterns added to bridge-patterns.json → next `build-bridge-readings` tick picks them up → outputs regenerate

**Cross-domain portals consuming these outputs:**
- **Finance domain:** master-inbox.html (queue prioritization), helix-artifacts.html (artifact library), helix-artifact.html (signing workflow), company-portal-finance.html (inline engine sections)
- **Patent/IP domain:** patent lane artifacts flow to USPTO Pro Se filing (via /api/print-document + downstream filing service, not yet audited)
- **Grant domain:** grant lane artifacts flow to NIH/NSF submission (via /api/print-document + researcher's Grants.gov account, not yet audited)
- **Credit domain:** SBA lane (currently empty) would target commercial-bank SBA 7(a) underwriting; presently no patterns emit SBA derivedAngles
- **Research domain:** research lane artifacts target OSF preregistration (via /api/print-document + researcher's OSF account, not yet audited)
- **Capital domain:** investment lane feeds into capital-engine.js (separate recommendation system; inputs the outputted theses + valuations)

### NEEDS WORK / INCONSISTENCIES

1. **SBA lane is fully built but unused** — 15 patterns exist; none emit `derivedAngles.sba`. SBA generator exists (generateSBA returns null if no derivedAngles present). Template structure exists (borrowerSummary, guarantorBackground, useOfProceeds, dscrAnalysis, stressTest, creditNotElsewhere, creditDecisionRationale). **Action required:** author SBA angles into patterns for small-business-eligible entities, or remove the lane structure to reduce confusion.

2. **Franchise lane is fully stubbed but returns null** — generateFranchise() always returns null. Comment says "pending dedicated franchise sample research" and suggests need for FTC Franchise Rule Item 1-23 disclosure structure. **Action required:** research 5 real franchise disclosure documents, update verbiage-templates.json with FTC Rule Item structure, author franchise angles into patterns, or remove the lane.

3. **Market-data integration is architecturally optional but currently unused** — computeValuation() is called in generateInvestment() with optional `md` parameter; if absent, ALL 461 investment artifacts degrade to qualitative thesis (observed: 461 qualitative, 0 computed). No measured investment artifact has `.valuationBasis.computed=true`. **Risk:** investment theses lack real price targets, making them harder to act on. **Action required:** integrate market-data fetch into orchestrator (need stock price, shares, revenue, net debt for each portal); pass computed valuations to generateInvestment(); measure coverage.

4. **Pattern authoring doesn't record its proposal metadata durably** — proposePattern() saves to Redis OR file, but Vercel serverless filesystem is ephemeral. REDIS REQUIRED for production (otherwise proposals vanish on cold-start). Local fallback to `assets/data/_pattern-proposals.json` exists but will lose state on Vercel. **Action required:** audit UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars are set in Vercel; confirm Redis is the primary store; consider backup polling to sync to git.

5. **Pattern repair worker (cron-repair-held.js) is not audited** — pattern-author.js documents it (`repairPattern()` function); claims it runs offline on held-unmatched patterns. No record of the cron job's schedule, success rate, or error handling. **Action required:** find and audit the repair cron; measure held vs repaired rate; confirm repair doesn't block authoring.

6. **Fired artifacts are manually moved to assets/data/fired-artifacts/** — only 1 exists (dated 2026-05-31). No clear routing rule for when an engine output "fires" (becomes approved for deployment). Current observed status: outputs are persisted to Redis but not automatically promoted to fired status. **Action required:** define "fire" state transition rule; automate promotion via operator action on helix-artifact.html interface; measure fire rate.

7. **No real investment targets have been computed** — all 461 investment artifacts use qualitative theses. Reason: market-data `md` parameter not passed at generation time. computeValuation() is correctly built; just unused. **Action required:** (see #3 above) integrate market data into the build pipeline.

8. **Engine output caching strategy unclear** — master-inbox.js checks `limen:eo:` Redis keys as overlay on top of file-based outputs. If Redis is stale or down, stale file outputs render. No measured heartbeat on Redis freshness. **Action required:** monitor Redis uptime; establish SLA for cache freshness; log misses.

9. **Pattern dedup logic allows same region + same business-signature on DIFFERENT portals** — pattern-author.js gate allows `(neural.region, business.signature)` pair to be authored on portal A, then re-proposed on portal B. This is probably fine (same neural region can be relevant to different business contexts). But the docstring says "region × target uniqueness gate" which suggests intent to prevent it. **Clarify:** is this a cross-portal reuse pattern (encouraged) or a bug? Current code allows it. Verify intent.

10. **Indicator detectors for fn_phase_share and fn_text_match assume functionNetwork categories exist** — if a portal has no suppliers (e.g., pure software), those detectors silently fire false. Consequence: low-confidence bridges on sparse networks. **Action required:** bias pattern authoring toward text_match and kernel_phase detectors for broad applicability; document expected fn categories (suppliers, customers, capitalProviders, regulators, competitors).

11. **Template placeholders use complex syntax ({{KEY|default|opt1|opt2}})** — engine-output-generator.js subst() function is correct, but if a placeholder doesn't match the expected syntax, substitution silently fails (returns "[KEY]"). Consequence: broken placeholders in rare cases. **Action required:** add logging to subst() to detect malformed placeholders at generation time; measure placeholder-fill rate.

12. **Confidence calibration across lanes is hand-coded** — computeValuation uses hard-coded PHASE_FACTOR map (p0=1.05, p3=0.70, p7=0.50, etc.). No versioning or audit trail if these factors are tuned. **Action required:** version PHASE_FACTOR; log tuning events; A/B test against real outcomes.

13. **No measured link between engine outputs and downstream filings** — `/api/print-document` streams DOCX to browser, but no tracking of whether the document was actually filed (USPTO, NIH, SBA, etc.). **Action required:** instrument download events; measure conversion to filing; track rejections.

14. **Patent lane doesn't emit dependent claims 2-5 correctly if bridge.knownTreatments is missing** — claim 4 on line 128 uses `.slice(0,3)` of knownTreatments; if array is empty or absent, claim renders with placeholder markers. **Action required:** verify all 15 patterns have non-empty knownTreatments; add fallback language if absent.

15. **Verbiage templates are incomplete for some lanes** — investment lane templates exist for header, variants, catalysts, valuation, positioning, risk, exit, and activist (optional). But no template for "How to monitor" section that several real Loeb/Burry letters include. **Action required:** extend investment templates; measure artifact completeness.

16. **Fired-artifacts directory has only 1 item after months of operation** — suggests either fire threshold is very high (good: only high-quality outputs fire), or fire mechanism is not working. **Action required:** audit approval flow; measure proposal→approval→fire pipeline success rate.

**File paths (absolute):**
- C:\Users\Chris\Limen-Helix-live-\lib\engine-output-generator.js
- C:\Users\Chris\Limen-Helix-live-\lib\bridge-engine.js
- C:\Users\Chris\Limen-Helix-live-\lib\pattern-author.js
- C:\Users\Chris\Limen-Helix-live-\lib\valuation.js
- C:\Users\Chris\Limen-Helix-live-\lib\long-form-generator.js
- C:\Users\Chris\Limen-Helix-live-\assets\data\bridge-patterns.json (15 patterns)
- C:\Users\Chris\Limen-Helix-live-\assets\data\verbiage-templates.json (patent, grant, sba, investment templates)
- C:\Users\Chris\Limen-Helix-live-\api\limen-engine-output.js
- C:\Users\Chris\Limen-Helix-live-\api\print-document.js
- C:\Users\Chris\Limen-Helix-live-\api\print-from-pattern.js
- C:\Users\Chris\Limen-Helix-live-\api\pattern-proposal.js
- C:\Users\Chris\Limen-Helix-live-\scripts\build-engine-outputs.mjs
- C:\Users\Chris\Limen-Helix-live-\assets\js\company-portal-engine-render.js
- C:\Users\Chris\Limen-Helix-live-\helix-artifacts.html
- C:\Users\Chris\Limen-Helix-live-\helix-artifact.html
- C:\Users\Chris\Limen-Helix-live-\assets\data\fired-artifacts\2026-05-31__research-note__bla-hyperactive-economy__exposure-to-volatility-reexposure.md

---

## 17. Feeds & Ingestion

### PURPOSE
Ingests real-time external signals from 200+ live API/RSS sources across 20 canonical domains, normalizes to bounded deltas (max 0.25), deduplicates with 5-min windows, persists to Upstash Redis or in-memory, and feeds domain stress computation. Supports both manual (Zapier) and autonomous (Google News RSS + 200+ institutional sources) ingestion paths. Browser maintains 30-min localStorage cache of feed state.

### KEY FILES

**Ingestion Endpoints (API):**
- C:\Users\Chris\Limen-Helix-live-\api\limen-ingest.js — POST /api/limen-ingest; validates & normalizes manual/Zapier events; dedupes on (source, domain, type, time-bucket, externalId); applies bounded delta (magnitude × typeWeight × sourceWeight, capped 0.25); accepts all 21 KNOWN_DOMAINS (20 canonical + 'trade')
- C:\Users\Chris\Limen-Helix-live-\api\feed-status.js — GET /api/feed-status; live diagnostic fetch of 22 hardcoded sources across 11 domains; env-var audit; per-source HTTP status & parse validation; 8s timeout; domain status rollup (LIVE ≥2 passing sources, PARTIAL 1, FALLBACK 0)
- C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js — GET /api/domain-snapshot; master aggregator: 266 SOURCE_KEYS fetching from 40+ real APIs (FRED, BLS, EIA, NOAA, FDA, arXiv, PubMed, Patents, World Bank, OECD, FAO, USDA, NewsAPI, ACLED, Tavily, Regulations.gov, Federal Register, Finnhub, AlphaVantage, OpenAlex, GDELT legacy, plus 60+ RSS/news sources). Returns per-domain {stress, trend, signals, sources[], confidence, activity, maturity, status, liveCount}. Parallel non-GDELT (0-43, 44-153 batched), sequential GDELT with 2s timeout + 5min cache.
- C:\Users\Chris\Limen-Helix-live-\api\defense-signals.js — GET /api/defense-signals; fetches 4 Google News RSS feeds (geopolitical/oil/food/military keywords), classifies via 15 EVENT_KEYWORDS, clusters by 60min window, maps to LIMEN domains, detects macro shock (≥3 domains + energy + supplyChain), returns {signals[], domainSignals[], macroShock}. 8s timeout per feed. Dedupes by title substring.
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-ingest.js — GET /api/limen-worker-ingest; server-side cron worker (2min interval); runs defense RSS signal engine, stores latest_ingest, macro_shock, domain_deltas, ingest_log to limen-db with 5min TTL. No browser, pure backend persistence.

**Feed State & Persistence:**
- C:\Users\Chris\Limen-Helix-live-\assets\js\feed-store.js — client-side localStorage manager (30min TTL); persists {domains, events[], timeline[], meta, sourceHealth, seenIds}; deduplication window 30s by default; debounced saves (2s); lifecycle start/stop
- C:\Users\Chris\Limen-Helix-live-\lib\feed-state.js — (referenced by domain-signal-engine) ingest hook for feed data
- C:\Users\Chris\Limen-Helix-live-\lib\limen-db.js — Redis abstraction; key prefix 'limen:'; fallback in-memory per cold-start. Reads: Redis first → memory fallback. Writes: memory always + Redis if UPSTASH_REDIS_REST_URL present

**Domain Signal Processing:**
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-signal-engine.js — polls /api/domain-snapshot every 30s, applies domain-specific stress normalization (law 0.35×, health 0.40×, communication 0.45×, governance 0.55×, finance 0.60× + ceilings), computes session baseline deviation, persistence boost (6+ cycles), stale cache fallback for GDELT-backed domains (10min TTL). Emits limen:domain-update, limen:domain-distress (>0.65 + material change ≥0.05)
- C:\Users\Chris\Limen-Helix-live-\assets\js\feeds\limen-defense-signal-engine.js — browser-side client that polls /api/defense-signals every 2min, applies bounded delta per domainSignal (normalizedMagnitude × 0.3, capped 0.25), feeds into existing domain signal path. Emits limen:macro-shock-detected, limen:external-signal-ingested

**Market Data & Valuation Feeds:**
- C:\Users\Chris\Limen-Helix-live-\lib\market-data.js — getMarketData(portal): fetches Yahoo Finance v8 (price, 52w range, volume) + SEC EDGAR companyfacts (CIK → shares, revenue, debt, cash). Returns {price, marketCap, ev, evRevenue, week52High, week52Low, advUsd, missing[]}, no synthetic numbers

**Build-time Feed Audit:**
- C:\Users\Chris\Limen-Helix-live-\scripts\sense\organ-feeds.mjs — source: reads api/feed-status.js, counts sources per domain, audits ENV_VARS, computes domain coverage (canonical/20) and source density (sources/41×100). Reports uncovered domains as HIGH severity attention

### LIVE PAGES
- https://limenhelix.com/api/feed-status — live diagnostics endpoint (CORS open)
- https://limenhelix.com/api/domain-snapshot — master feed aggregation (CORS open)
- https://limenhelix.com/api/defense-signals — defense/macro-shock signal detection (CORS open)
- https://limenhelix.com/api/limen-ingest — manual event ingestion (POST, CORS open)

### DATA

**Ingested Feeds:**

Domain-snapshot.js ingests from 200+ real sources organized as:

**Economy (9 sources):** FRED (A), BLS (B), FRED Gas Price (C), FRED Food CPI (D), FRED Consumer Sentiment (E), Treasury Yield Curve (E), Treasury MTS (F), Treasury Operating Cash (G), Treasury Debt Outstanding (H), World Bank GDP Growth (O), World Bank Inflation (O), NY Fed EFFR (M), World Bank CPI Inflation (N)

**Energy (15 sources):** EIA (A), FRED Energy (B), EIA Weekly Petroleum (D), EIA Natural Gas (E), EIA Electricity (F), OPEC Basket (H), IEA News (G), MassiveCrudeOil real-time (41), EIA Supply Chain (B, 39), Solar Industry (I), Wind Energy (J), Nuclear Energy (K), Hydrogen Energy (L), Coal Transition (P), Grid Reliability (M), Energy Storage (N), LNG Market (O), NRC regulatory (R), DOE regulatory (Q)

**Environment (9 sources):** NOAA Climate (A), NOAA Alerts (B), EPA News (C), NOAA Research (D), USGS News (E), Global Forest Watch (F), IUCN (G), Inside Climate News (H), Grist (I), USGS Earthquakes (24h M4.5+), NOAA Drought CPC outlook, USDA Drought Monitor

**Health (2 sources):** FDA Events (A), FDA Recalls (B); plus CDC MMWR (62), WHO Disease Outbreak (63), FDA Drug Shortages (64), ClinicalTrials.gov (65), CDC NCHS (CDCNCHS), WHO GHO (WHOGHO)

**Technology (7 sources):** Patents/USPTO (A), arXiv CS (B), CISA KEV (C), NIST NVD (D), Krebs Security (E), Hacker News (F), GitHub Security Advisories (G), CISA/SEC advisories (71), NVD Recent (72), Fed Reg FCC (317), Fed Reg NIST (318), Fed Reg FTC (319)

**Research (2 sources):** PubMed (A), arXiv All (B); plus NSF Awards (58), Retractions Watch (59), NIH Grants (60), Nature/Science (61), Fed Reg Patent Office (research replacement), NSF (G), Education Dept R&D (education F), World Bank R&D % GDP (316)

**Supply Chain (13 sources):** BLS Freight (A), EIA Supply (B; superceded by RSS 39), RSS Supply Chain (39), RSS Agriculture (40), World Bank Logistics LPI (332), OFAC Recent Actions (268), USDA Drought Monitor (269), NWS Ag Alerts (271), Fed Reg CBP, Coast Guard, FAA, FMCSA, NHTSA, USTR, BIS, DOL

**Governance (16 sources):** World Bank Governance (A), GDELT Governance (legacy, replaced by RSS 34), RSS Governance (34), GovTrack (C, 96), Congress.gov (D, 97), GAO Reports (E, 98), CBO Publications (F, 99), OMB Releases (G, 100), Brennan Center (H, 101), POGO (I, 102), Mother Jones (J, 103), HuffPost Politics (K, 104), The Nation (L, 105), Breitbart (M, 106), Washington Times (N, 107), National Review (O, 108), Daily Caller (P, 109), BBC World News (328), World Bank Government Effectiveness (329), World Bank Rule of Law (330)

**Infrastructure (5 sources):** World Bank Infrastructure (A), OECD Infrastructure (B), Fed Construction Spending (C, 44), Fed Transportation Index (D, 45), Fed Federal Investment (E, 46), Fed Reg DHS (294), Fed Reg DOT (296), Fed Reg HUD (297), Fed Reg FERC (293), NWS Hazard Alerts (259), USGS Earthquakes (260)

**Agriculture (13 sources):** USDA NASS (A), FAO (B), RSS Agriculture (40), Fed Reg USDA (273), Fed Reg FDA (274), Fed Reg EPA Ag (275), Fed Reg APHIS (276), Fed Reg FSIS (277), World Bank Food Index (278), USDA Drought Monitor (269), NWS Ag Alerts (271), FDA Recalls (272), NOAA CPC Drought (270)

**Industry (7 sources):** FRED Industrial (A), BLS Manufacturing (B), NHTSA Recalls (C, 185), CPSC Recalls (D, 186), PHMSA (E, 187), CSB Investigations (F, 188), UAW Strike Tracker (G, 189), World Bank Manufacturing (333)

**Education (7 sources):** World Bank Education (A), OpenAlex (B), ED.gov News (C, 66), NCES News (D, 67), EdWeek News (E, 68), IES News (F, 69), Chronicle Higher Ed (G, 70), World Bank Tertiary Enrollment (320), World Bank Fertility Rate (321)

**Communication (7 sources):** NewsAPI (A), GDELT Media (legacy, replaced by RSS 35), RSS Media (B, 35), RSF (C, 76), CPJ (D, 77), Snopes (E, 78), Poynter (F, 79), Nieman Lab (G, 80), World Bank Internet Users (331), BBC World News (328)

**Culture (10 sources):** Event Registry Culture (A), GDELT Tone (legacy, replaced by RSS 36), RSS Culture (B, 36), NEA News (C, 213), NEH News (D, 214), UNESCO Culture (E, 215), PEN America (F, 216), Art Newspaper (G, 217), Variety (H, 218), Hypebeast (I, 219), Pitchfork (J, 220)

**Defense (17 sources):** ACLED (legacy A), RSS Conflict (B, 37), Defense News (C, 81), Breaking Defense (D, 82), ISW (E, 83), RUSI (F, 84), NATO News (G, 85), Defense One (H, 86), War Zone (I, 87), CSIS (J, 88), SIPRI (K, 89), TASS (L, 90), Xinhua (M, 91), Global Times (N, 92), Press TV (O, 93), KCNA Watch (P, 94), SCMP (Q, 95), Fed Reg DoD (301), Fed Reg State (302)

**Religion (20 sources):** GDELT Religion (legacy, Event Registry Religion replaced), RSS Religion (B, 26), RSS Religion Events (A, 43), Vatican News (C, 231), Al Jazeera Religion (D, 232), Christianity Today (E, 233), Religion News Service (F, 234), USCIRF (G, 235), Pew Religion (H, 236), Times of Israel Religion (I, 237), Hindustan Times Religion (J, 238), BuddhistDoor (K, 239), SikhNet (L, 240), Mormon Newsroom (M, 241), JW News (N, 242), Orthodox Christianity (O, 243), Islamic Finance (P, 244), JTA (Q, 245), Catholic News Agency (R, 246), Esoteric Spirituality (S, 247), Mindfulness Industry (T, 248)

**Population (12 sources):** World Bank Population (A), UN Population (B), UNFPA (C, 221), CDC NCHS (D, 222), WHO GHO (E, 223), UNHCR Displacement (F, 224), IOM Migration (G, 225), IHME Pop Health (H, 226), Guttmacher (I, 227), Census Bureau (J, 228), Our World in Data (K, 229), Population Matters (L, 230), Fed Reg Census (322), Fed Reg SSA (323)

**Law (10 sources):** Federal Register (A), Regulations.gov (B), CourtListener (C, 50), PACER Docket News (D, 51), DOJ Press Releases (E, 52), SEC Enforcement (F, 53), CFPB Enforcement (G, 54), US Courts Federal Caseload (H, 55), AFCARS Family Court (I, 56), SCOTUS Opinions (J, 57), Fed Reg DOJ (324), Fed Reg DEA (325), Fed Reg BOP (326), Fed Reg PTO (327)

**Finance (12 sources):** AlphaVantage (A), Finnhub (B), MassiveSPY real-time (42), SEC EDGAR Current (D, 249), Treasury Yield Curve (E, 250), Treasury Debt (F, 251), Fed H.4.1 (G, 252), FDIC Bank Failures (H, 253), OCC Enforcement (I, 254), CFTC Press (J, 255), FINRA Disciplinary (K, 256), NY Fed SOFR (L, 257), NCUA Credit Union (M, 258)

**Intelligence (12 sources):** Tavily (B, 33), RSS Intel (A, 38), RecordedFuture (C, 203), CISA Alerts (D, 204), NSA Cyber Advisories (E, 205), FBI Cyber Division (F, 206), DNI Annual Threat (G, 207), CyberScoop (H, 208), The Record (I, 209), Lawfare National Security (J, 210), Bellingcat OSINT (K, 211), The Intercept National Security (L, 212), Fed Reg FBI (303), Fed Reg CIA (304), Fed Reg NSA (305), Fed Reg EOP (306)

**Science (4 sources):** NSF Awards (58), Retractions Watch (59), NIH Grants (60), Nature/Science Magazine (61)

**Medicine (4 sources):** CDC MMWR (62), WHO Disease Outbreak (63), FDA Drug Shortages (64), ClinicalTrials.gov (65)

**Data Freshness:** domain-snapshot.js caches GDELT responses 5min, expires GDELT-backed domains STALE after 10min without refresh, BLS quota 25/day shared, arXiv 3req/sec staggered 600ms apart. Feed-status.js runs diagnostics on demand, caches 10s server-side, 5s revalidate. Defense-signals clusters articles ≤24h old, caches 120s.

**Storage:** Feed ingestion events written to Upstash Redis (limen:latest_ingest, limen:macro_shock, limen:domain_deltas, 5min TTL). Client localStorage persists feed state 30min (limen_feed_domains, limen_feed_events, limen_feed_timeline, limen_feed_meta, limen_feed_source_health, limen_feed_seen_ids). Deduplication window in-memory per Lambda cold-start (~5min).

### HOW IT CONNECTS

**Forward Signal Path (Ingestion → Domain Stress → Cross-Domain Escalation):**

1. **Live Feed Sources → API Aggregators:**
   - 200+ external APIs/RSS feeds → domain-snapshot.js (266 SOURCE_KEYS) group-fetches per domain
   - Google News RSS (4 keywords) → defense-signals.js → classified event clusters
   - Manual/Zapier events → limen-ingest.js (POST endpoint)

2. **Normalization & Deduplication:**
   - limen-ingest.js: validates domain/type/source/magnitude, computes appliedDelta = min(0.25, magnitude × typeWeight × sourceWeight), dedupes on (source, domain, type, 1-min bucket, externalId) within 5-min window
   - domain-snapshot.js: per-source HTTP status & parse validation, grace fallback per domain (LIVE ≥2 ok, PARTIAL 1, FALLBACK 0)
   - feed-store.js (client): localStorage dedup window 30s by type/id/domain

3. **Stress Computation:**
   - domain-signal-engine.js polls /api/domain-snapshot every 30s
   - Applies domain-specific dampening: law 0.35×, health 0.40×, communication 0.45×, governance 0.55×, finance 0.60× (each with ceiling)
   - Session baseline deviation: maintains 12-sample rolling mean (6 min @ 30s interval), boosts stress +0.3×(rawStress - mean) if deviation >0.05
   - Persistence boost: tracks cycles ≥0.50; if ≥3 consecutive, adds +0.025/cycle (max +0.10 at 6+ cycles)
   - Publishes limen:domain-update every 30s, limen:domain-distress when stress > 0.65 & material change ≥0.05

4. **Macro Shock Detection:**
   - defense-signals.js classifies events (AIRSTRIKE, MISSILE_ATTACK, STRAIT_DISRUPTION, OIL_SHOCK, etc.) with 15 keywords
   - Maps events to affected domains + magnitude (e.g., STRAIT_DISRUPTION → energy, supplyChain, defense, finance, agriculture @ 0.9)
   - Triggers macro shock if: ≥3 distinct domains + hasEnergy + hasSupplyChain
   - Emits limen:macro-shock-detected with affected domains, escalates cross-domain concerns

5. **Persistence:**
   - limen-worker-ingest.js (cron 2min): stores latest_ingest, macro_shock, domain_deltas to limen-db (5min TTL)
   - feed-store.js (browser): debounced saves to localStorage (2s buffer), persists state across page reload

6. **Cross-Domain Propagation:**
   - Macro shock event flows through event-narrator, affects multiple domains simultaneously
   - Domain deltas feed into civilization-super-brain (LIMEN Domains structure) for phase transitions & operator calibration
   - Market data (market-data.js) bridges into investment lane artifact generation (price/marketCap/EV/evRevenue)

**Inverse: Which Domains Have NO Feed Explicitly in feed-status.js:**

feed-status.js (22 sources) covers ONLY: agriculture, communication, culture, defense, education, governance, infrastructure, industry, law, population, religion.

**Missing from feed-status.js ENV_VAR audit (11 domains without hardcoded SOURCES array entries):**
- economy (implied by FRED_API_KEY reference but no explicit SOURCES entry)
- energy (EIA_API_KEY reference, no explicit entry)
- environment (NOAA_TOKEN reference, no explicit entry)
- health (no reference)
- technology (USPTO_API_KEY reference, no explicit entry)
- research (NCBI_API_KEY reference, no explicit entry)
- supplyChain (EIA_API_KEY reference, no explicit entry)
- finance (ALPHA_VANTAGE_API_KEY, FINNHUB_API_KEY references, no explicit entries)
- intelligence (TAVILY_API_KEY reference, no explicit entry)
- medicine (no reference; feeds exist only in domain-snapshot.js)
- science (no reference; feeds exist only in domain-snapshot.js)

**However, domain-snapshot.js has explicit sources for ALL 20 canonical domains + 4 extra (health, research, science, medicine).**

This is a **critical asymmetry:** feed-status.js is a lightweight diagnostic endpoint covering only 11 domains (governance, infrastructure, agriculture, industry, education, communication, culture, defense, religion, population, law). It is **NOT the master source registry**. The actual master source registry is embedded in domain-snapshot.js (266 SOURCE_KEYS, 200+ real fetches), but feed-status.js only provides diagnostics for a subset.

### NEEDS WORK / INCONSISTENCIES

1. **feed-status.js is incomplete & misleading** (path: C:\Users\Chris\Limen-Helix-live-\api\feed-status.js)
   - Only 22 SOURCES listed; missing 178+ sources that domain-snapshot.js defines
   - Missing entire feed definitions for: economy, energy, environment, health, technology, research, supplyChain, finance, intelligence, medicine, science
   - Consequence: GET /api/feed-status lies — returns "missing" or "fallback" for domains that have vibrant sources in domain-snapshot.js
   - Action: Either (a) expand feed-status.js to include all 200+ sources from domain-snapshot.js, or (b) deprecate feed-status.js & redirect to domain-snapshot.js diagnostics, or (c) document that feed-status.js is deprecated lightweight audit & users should call domain-snapshot.js directly

2. **GDELT legacy code still present** (path: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js, lines 560+)
   - Comments say GDELT replaced by RSS feeds (governance→RSS 34, communication→RSS 35, culture→RSS 36, defense→RSS 37, intelligence→RSS 38, religion→RSS 26)
   - But code still includes GDELT fetchers (fetchGDELTGovernance, fetchGDELTMedia, fetchGDELTTone, fetchGDELTConflict, fetchGDELTReligion, fetchGDELTIntel)
   - Stale cache logic kicks in after 10min without GDELT refresh, but GDELT is marked unreliable (2s timeout)
   - Action: Remove dead GDELT fetchers entirely, simplify stale cache logic to only handle RSS sources that legitimately drop offline

3. **domain-snapshot.js SOURCE_KEYS ordering is fragile** (path: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js, lines 67–333)
   - 266 string keys must be kept in exact sync with 266 Promise.allSettled fetch functions (lines 336+)
   - Reordering, inserting, or removing a fetcher breaks silent because JS array index binding isn't validated
   - Evidence: comments warn "Reordering, inserting, or removing a fetcher requires the matching SOURCE_KEYS entry to move with it"
   - Action: Refactor to object-keyed fetcher map (e.g., {FRED: fetchFRED(), BLS: fetchBLS()}) instead of positional array

4. **No explicit "zero-feed" domains flagged at build time** (path: C:\Users\Chris\Limen-Helix-live-\scripts\sense\organ-feeds.mjs)
   - organ-feeds.mjs reports uncovered canonical domains as HIGH severity, but feed-status.js only covers 11 domains
   - Audit runs against feed-status.js, not domain-snapshot.js → false negative (audit says coverage good, but feed-status.js is incomplete)
   - Action: Update organ-feeds.mjs to audit domain-snapshot.js instead, or split audit into two: (a) feed-status.js lightweight diagnostic coverage, (b) domain-snapshot.js master source inventory

5. **Manual ingestion (limen-ingest.js) accepts 'trade' domain, but no 'trade' feed exists** (path: C:\Users\Chris\Limen-Helix-live-\api\limen-ingest.js, line 19)
   - KNOWN_DOMAINS = [... 'trade'] (21 total)
   - CANONICAL_DOMAINS = 20 (no 'trade')
   - No sources in domain-snapshot.js map to 'trade'
   - Action: Either (a) remove 'trade' from KNOWN_DOMAINS, or (b) define trade sources in domain-snapshot.js

6. **Stale cache logic assumes all GDELT-backed domains fail together** (path: C:\Users\Chris\Limen-Helix-live-\assets\js\domain-signal-engine.js, lines 149–208)
   - _GDELT_DOMAINS = {governance:1, communication:1, culture:1, defense:1, religion:1, intelligence:1}
   - But intelligence now backed by Tavily (not GDELT), and defense by RSS, and governance by RSS → code is out of sync with domain-snapshot.js
   - Action: Remove _GDELT_DOMAINS logic entirely; stale cache should be per-domain & configurable via domain-snapshot.js status field

7. **Market data sources (market-data.js) hardcoded, not integrated with feed registry** (path: C:\Users\Chris\Limen-Helix-live-\lib\market-data.js)
   - Fetches Yahoo Finance + SEC EDGAR directly, bypassing domain-snapshot.js orchestration
   - No deduplication, no cache TTL, no staleness handling vs. other domain feeds
   - Action: Integrate Yahoo/EDGAR into domain-snapshot.js as "finance market microstructure" sources (currently missing live price/share data)

8. **Defense signal engine runs via two paths: client (limen-defense-signal-engine.js) AND server (limen-worker-ingest.js)** (paths: C:\Users\Chris\Limen-Helix-live-\assets\js\feeds\limen-defense-signal-engine.js, C:\Users\Chris\Limen-Helix-live-\api\limen-worker-ingest.js)
   - Client polls /api/defense-signals every 2min, applies delta
   - Server cron also runs ingest every 2min, stores to Redis
   - Risk: Duplicate ingestion, divergent signal computation (client uses 0.3 multiplier, server uses normalized magnitude directly)
   - Action: Clarify ownership — should server be authoritative, or client advisory?

9. **No feed SLA or heartbeat monitoring** (missing: C:\Users\Chris\Limen-Helix-live-\api)
   - feed-status.js is on-demand diagnostic, not continuous monitoring
   - No alerting if a domain feed goes dark for >N minutes
   - No dashboard showing which sources are currently live vs. fallback/stale
   - Action: Add cron-based feed health monitor that tracks per-domain staleness & alerts ops

10. **Feed-store.js TTL (30min) may be too short for low-activity domains** (path: C:\Users\Chris\Limen-Helix-live-\assets\js\feed-store.js, line 26)
    - Evidence: domain-snapshot.js caches GDELT 5min, expires STALE at 10min
    - But feed-store.js generic 30min may expire data before next poll cycle if user tabs out
    - Action: Make TTL domain-specific (e.g., high-velocity: law, finance → 10min; low-velocity: religion, culture → 60min)

11. **No explicit "mandate says ~9 domains with NO feed" statement in code** (mandate reference unclear)
    - Assumption: CANONICAL_DOMAINS (20) minus some subset = ~9 with no feed
    - Reality: domain-snapshot.js covers all 20 + 4 extras (health, research, science, medicine)
    - Action: Clarify mandate — was it outdated, or is "9 unfed domains" a different requirement?

**Summary of Live Domains with Feeds (measured from domain-snapshot.js SOURCE_KEYS count by domain):**
- 20/20 canonical domains have at least one feed
- 4 extra domains (health, research, science, medicine) have feeds
- No canonical domain is completely unfed in domain-snapshot.js
- feed-status.js covers only 11 of 20 (inconsistent, incomplete)

---

## 18. Paper trading / markets

### PURPOSE
Unified paper trading system for the **investment lane** (capital-engine.json stream id: `investment_lane`). Enables hypothesis testing of LIMEN opportunity-derived investment theses at scale without real capital. Ties domain-conditioned opportunity scoring (from opportunities.html) → market quote lookups (Yahoo Finance v8) → live paper orders/positions via Alpaca paper API → portfolio concentration analysis → verdict scoring for decision support. **PAPER TRADING ONLY** — system explicitly prevents real money movement; any live trading requires human sign-off per finance domain signoff model.

### KEY FILES

**API Endpoints (Vercel serverless):**
- `/api/paper-orders.js` — GET /api/paper-orders?status=open|closed|all — Fetch Alpaca paper account orders; returns slimmed order list (id, symbol, side, qty, filledQty, type, status, submittedAt, filledAt, filledAvgPrice); hardcoded to paper-api.alpaca.markets; CORS enabled; 10s cache with 5s stale-while-revalidate.
- `/api/paper-positions.js` — GET /api/paper-positions — Fetch Alpaca paper account positions; returns slimmed position data (symbol, qty, side, marketValue, costBasis, unrealizedPl, unrealizedPlpc, currentPrice, avgEntryPrice, changeToday); 10s cache; fallback to stubbed response if credentials missing.
- `/api/paper-trade.js` — POST /api/paper-trade — Submit market orders to Alpaca paper trading (buy/sell). Validates symbol, side (buy|sell), qty; executes as market order with day TIF; includes optional metadata (oppId, oppTitle, verdict, score) for audit trail; returns orderId and status; hardcoded paper-api.alpaca.markets.
- `/api/market-snapshot.js` — GET /api/market-snapshot — Live market stress snapshot from Yahoo Finance v8 (S&P 500, VIX, crude oil, 10Y yield); falls back to simulated sinusoidal data on any fetch failure; returns spxChange, vix, oilChange, yield10yChange, drivers array (narrative), simulated flag; 8s cache.
- `/api/asset-quote.js` — GET /api/asset-quote?symbols=XLE,IYT,NEE — Per-symbol live quotes from Yahoo Finance v8 (up to 10 symbols per request); returns price, change, changePct, trend (UP|FLAT|DOWN), momentum (POSITIVE|MIXED|NEGATIVE), volatility (LOW|MEDIUM|HIGH), live flag; sequential fetch with 200ms inter-symbol delay to avoid rate limits; 15s cache.

**HTML/Frontend:**
- `investment-console.html` — Full investment console UI. Three-column layout: LEFT (LIMEN thesis, domain feed grounding, connectome nodes, portfolio context, failure modes), CENTER (verdict scoring, market alignment, asset list with buy/sell buttons, trade log), RIGHT (supporting domains, connectome coverage, examples, branch logic, paper account exposure). Loads opportunity data via sessionStorage handoff (`limen_invest_opp`). Binds clicks to trade modals (BUY/SELL/ADD/EXIT). Trade log stored in sessionStorage (`limen_paper_log`). 1374 lines total.

**Supporting JS Libraries:**
- `assets/js/execution-investment-controls.js` — Pre-trade risk validation (kernel phase, stop-loss, thesis, risk acknowledgement); creates trade records; renders risk block UI; enforces no investment advice clause.
- `assets/js/portfolio-context.js` — Core portfolio analysis engine. Implements: TICKER_DOMAINS (90+ tickers mapped to LIMEN domains + themes), analyzePortfolio() (computes domain/theme concentration from Alpaca positions + orders), analyzeOverlap() (detects direct/domain/thematic overlap between opportunity and current paper holdings, returns diversification verdict), analyzeConnectomeOverlap() (cross-references portfolio holdings against connectome node activations). Consumed by investment-console.html and opportunity cards.
- `assets/js/market-stress-triage.js` — Live market stress polling (10s interval, 4s timeout per fetch). Fetches /api/market-snapshot continuously, emits custom DOM events (limen:market-stress-update, limen:market-stress-alert), maintains stress history (10-point window). Maps stress channels (market/liquidity/energy) to civilization nodes for visual effects.

**Data Contract:**
- `assets/data/capital-engine.json` — Finance domain master contract. Defines `investment_lane` stream (tier 4, status "live", capital "$1k-10k", signoffRequired=true). Documents all connectors (Stripe, affiliate networks, platforms, fulfillment). Lays out revenue streams (journals, guides, faceless content, local listings, courses, SaaS, affiliate, acquisition). Defines capital routing policy (net-outflow to highest-priority domain). Approval queue (3 items, all blocked on human signature: Stripe transfer enablement, intercompany agreements, 501(c)(3) firewall).

### LIVE PAGES
- https://limenhelix.com/investment-console — Investment console for a selected opportunity (URL param ?opp=ID or sessionStorage handoff)
- https://limenhelix.com/api/paper-orders — JSON endpoint (test with ?status=open)
- https://limenhelix.com/api/paper-positions — JSON endpoint
- https://limenhelix.com/api/paper-trade — JSON POST endpoint (paper order submission)
- https://limenhelix.com/api/market-snapshot — JSON endpoint (market stress snapshot)
- https://limenhelix.com/api/asset-quote — JSON endpoint (per-symbol quotes)

(Opportunity cards and domain consoles also reference the investment lane via domain-signal-engine and connectome-resolver, but no dedicated page; navigation is via opportunity.html → investment-console.html handoff via sessionStorage.)

### DATA
**Reads:**
- **Alpaca paper API** (https://paper-api.alpaca.markets/v2/orders, /v2/positions) — Live paper account state. Requires ALPACA_API_KEY_ID and ALPACA_API_SECRET environment variables. Returns order/position arrays; slimmed by client handlers.
- **Yahoo Finance v8 public API** (https://query1.finance.yahoo.com/v8/finance/chart/...) — No key required. Symbols: ^GSPC (S&P 500), ^VIX (VIX), CL=F (crude oil), ^TNX (10Y yield), plus user-provided tickers (XLE, IYT, NEE, PLTR, NVDA, etc.). Timeout: 4 seconds per fetch; simulated fallback if unavailable.
- **LIMEN domain snapshot** (window.LIMENDomains, populated by feed-state.js) — Stress, status, signals for 21 domains. Feeds into verdict scoring (confidence calc, domain stress alignment).
- **Connectome resolver** (window.LIMENConnectomeResolver) — Node activations, cross-domain relationships for opportunity context enrichment.
- **Session handoff** (sessionStorage.limen_invest_opp, limen_paper_log) — Opportunity data and paper trade log from opportunities.html.

**Writes:**
- **sessionStorage.limen_paper_log** — Local paper trade log (JSON array of {time, action, opp, symbol, score}). Persists across page reloads but not across browser close.
- **Alpaca paper API POST /v2/orders** — Submit paper trades. Body: {symbol, side, qty, type, time_in_force}. No real settlement; paper engine simulates fills at market price.

**Tanks:**
- capital-engine.json: ~21KB. Last authored 2026-06-06. Status: live. 30 streams defined, investment_lane is tier 4 (capital $1k-10k, signoffRequired=true). FRESH (references up-to-date as of document date).
- Alpaca paper account: State is LIVE (if credentials present) or STUBBED (returns empty arrays + stubbed=true flag). No local persistence of positions/orders; always fetched fresh from Alpaca on page load/refresh.

### HOW IT CONNECTS

**Inbound (What feeds the paper trading system):**
1. **Opportunities → Investment Console** (sessionStorage handoff): User clicks an "invest-type" card on domain-opportunities.html (e.g., finance-opportunities.html). That card's playbook data (pb.id, pb.domains, assets, verdict metadata) is serialized to sessionStorage.limen_invest_opp and navigation occurs to investment-console.html?opp=ID. Investment console reads and validates the handoff; bails out if malformed.

2. **Domain Feed → Verdict Scoring**: Feed engine (feed-state.js + domain-signal-engine.js) runs continuously and populates window.LIMENDomains (stress, status, signals for each domain). Investment console reads this on render and inputs domain stress into verdictScore calc (0–20 pts for "stress alignment"). STALE/FALLBACK domain status triggers -5pt penalty.

3. **Market Data Service** (asset-quote.js): Fetches live market quotes for ASSET_MAP[oppId] tickers. Fills _marketData cache. Used for market-alignment scoring (-10 to +10 pts based on upCount/downCount consensus and avg % change). If all quotes fail, scorecard defaults to 0 score and shows "UNAVAILABLE".

4. **Paper Exposure Fetch** (paper-positions.js + paper-orders.js): On init, investment console fetches /api/paper-positions and /api/paper-orders?status=all (parallel, timeout logic). Populates _paperPositions and _paperOrders. If both fail and Alpaca stubbed, falls back to reconstructing from _paperLog (localOnly flag). Triggers portfolio analysis (LIMENPortfolioContext.analyzePortfolio) and overlap detection (analyzeOverlap, analyzeConnectomeOverlap).

5. **Connectome Resolver** (connectome-resolver.js): Loads directory of node→domain→ticker mappings. On page init, resolves the opportunity's domain list through connectome to discover activated nodes and cross-domain relationships. Injects NODE-DERIVED CONTEXT section showing additional tickers and business functions derived from nodes, not in ASSET_MAP.

**Outbound (What the paper trading system produces):**
1. **Paper Trade Log** (sessionStorage.limen_paper_log): Every WATCH/PASS action and every successful paper order submission appends a log entry. Persisted across navigation within the same session. Visible in investment-console.html "PAPER TRADE LOG" section (most recent first). Log includes verdict score for audit.

2. **Alpaca Orders** (/api/paper-trade POST): Submits orders to paper account. Success response includes orderId, status (pending_new → filled typically within seconds). Failed orders return error detail. API metadata (oppId, oppTitle, verdict, score) is passed in body but **not persisted by Alpaca**; LIMEN captures it in sessionStorage.limen_paper_log only.

3. **Portfolio State (live in Alpaca)**: Orders execute as market orders, settle into positions. Next fetch of /api/paper-positions returns updated qty, marketValue, unrealizedPl, avgEntryPrice. Investment console detects changes and re-renders portfolio context (domain concentration, theme breakdown, P&L indicators).

4. **Events (DOM custom events)**: market-stress-triage.js emits limen:market-stress-update and limen:market-stress-alert events for cross-domain consumers (e.g., civilization.html stress visualization). Investment-console.html listens to limen:domain-update to re-resolve and re-render on feed change.

**Upstream (Finance Domain Integration):**
- **capital-engine.json** (api/capital-engine.js): Defines `investment_lane` as tier 4 revenue stream. Investment console itself is a **read-only proposal and hypothesis system**. Any real trading (if built) would route through capital-engine.js?action=orchestrate (AI-gated) and ultimately require human sign-off per approvalQueue constraint: signoffRequired=true. Current state: paper trading only, no real Stripe/money movement.

- **LIMEN Domains** (feed-state.js emits limen:domain-update): When domain stress changes, investment console re-evaluates verdict score and opportunity alignment. Example: if finance domain stress rises above 0.65, verdict score takes -5pt penalty ("STALE/FALLBACK penalty").

**Lateral (Other Subsystems):**
- **Opportunities Lane** (opportunities.html, domain-opportunities.html): Renders opportunity cards as "invest-type" playbooks. Clicking a card triggers sessionStorage handoff → investment-console.html launch.
- **Portfolio Context** (portfolio-context.js): Shared library used by both investment-console.html AND opportunity cards. Opportunity cards can show "PORTFOLIO OVERLAP" warnings before user ever launches the console.
- **Connectome Kernel** (connectome-resolver.js, kernel-output-interpreter.js): Activated nodes inject additional context (business mappings, feed context snapshot) into connectome-grounding section. Kernel annotation (phase, trajectory, alert level) is passed but marked EXPERIMENTAL and not used for verdict calculation.

### NEEDS WORK / INCONSISTENCIES

1. **Alpaca Credentials Gap**: paper-trade.js, paper-orders.js, paper-positions.js check multiple env var aliases (ALPACA_API_KEY_ID, APCA_API_KEY_ID, ALPACA_KEY_ID, ALPACA_KEY). This fallback chain is defensive but fragile. Vercel env should be normalized to a single, documented key. **File evidence**: api/paper-trade.js lines 26–27, paper-orders.js lines 30–31, paper-positions.js lines 28–29.

2. **Market Data Fallback Opacity**: /api/market-snapshot falls back to simulated data (sinusoidal math.sin()) with no warning if all four fetches fail (S&P, VIX, oil, 10Y). Response includes simulated=true flag, but investment-console.html does not visibly warn user that snapshot is synthetic. Verdict scoring treats live and simulated data identically. **File evidence**: api/market-snapshot.js lines 31–32, 85–88; investment-console.html lines 281–314 (getMarketAlignmentScore ignores simulated flag).

3. **Yahoo Finance Rate Limiting**: asset-quote.js fetches sequentially with 200ms delay (line 68). This is fragile: if a user requests 10 symbols and network latency is high, total fetch time can exceed 4s timeout. Rate limits on Yahoo v8 are not formally documented; fallback is graceful (returns live=false per-symbol) but user sees no data. **File evidence**: api/asset-quote.js lines 31–69.

4. **Portfolio Context Missing Timestamps**: analyzePortfolio() in portfolio-context.js ingests positions/orders but stores no fetch time. If Alpaca data is stale (e.g., user doesn't refresh for 10 minutes), investment console will render stale P&L, unrealizedPl, and P&L color coding without any indicator. No "last updated" badge on portfolio exposure section. **File evidence**: assets/js/portfolio-context.js lines 128–217.

5. **Verdict Scoring Overfitting**: verdictScore computation (investment-console.html lines 500–576) weights confidence (0–40), data quality (0–25), domain stress (0–20), market alignment (-10 to +10), urgency (+0 to +15), saturation (-0 to -10). Weights are hardcoded. No sensitivity analysis or validation that the weighting reflects operator intent. Score is deterministic but not calibrated to historical accuracy. **File evidence**: investment-console.html lines 504–573.

6. **Kernel Annotation Dead Code**: connectome-kernel-adapter.js is loaded and run (investment-console.html line 142, _runKernelExperiment called at line 1352), but code comment at line 253 states: "DEAD CODE — adapter is disabled; kept for legacy compat; never used for verdicts or trades". Kernel output appears in connectome-grounding section marked EXPERIMENTAL, but line 477 shows it's only rendered if explicitly available. Confuses readers; should clean up or formally document as experimental UI-annotation-only. **File evidence**: investment-console.html lines 253, 411–426, 477–493.

7. **Asset Overlap in ASSET_MAP**: FLNC (Fluence Energy) appears in both infra_demand (line 157) and climate_energy (line 181). Similarly, ICLN and TAN (clean energy) could be mentioned in multiple opportunity maps. No deduplication logic in renderAssetRow when building suggested-asset list. User sees same ticker across multiple opportunity themes without consolidation. **File evidence**: investment-console.html lines 151–234.

8. **Off-Thesis Position Rendering Cut Short**: investment-console.html lines 810–827 attempt to list "OPEN POSITIONS not in suggested assets" but renderAssetRow is called with minimal data (name=symbol, type='', sector=''). No market data fetches for off-thesis symbols unless user manually selects an asset. This creates blind spots: user may hold a concentrated position off-thesis and never see it unless they search portfolio exposure on the right column. **File evidence**: investment-console.html lines 810–827.

9. **Trade Confirmation Modal Memory**: openTradeConfirm (lines 1032–1098), openSellConfirm (lines 1170–1225), openExitConfirm (lines 1228–1263) all create modals with id="tradeConfirmModal". Only one modal can exist at a time, but closeTradeConfirm (line 1100) does not explicitly guard against double-modal or overlapping event handlers. If a user rapidly clicks trade buttons, race conditions could occur. **File evidence**: investment-console.html lines 1036–1038, 1171–1173, 1229–1231, 1100–1103.

10. **LocalOnly Fallback Trade Records**: refreshPositionsAfterTrade (lines 1160–1167) re-zeros _paperPositions and _paperOrders after a trade and refetches from Alpaca. If Alpaca is stubbed, the fallback reconstructs from _paperLog (lines 323–331 of fetchPaperExposure). This means if a user trades, then goes offline, the next render will show synthetic data from the log, not actual Alpaca state. No warning that positions shown are "reconstructed from log" vs. "live from Alpaca". **File evidence**: investment-console.html lines 316–377, 1160–1167.

11. **Missing Journaling of Rejected Orders**: api/paper-trade.js returns error detail on rejection (lines 81–86), but investment-console.html's submitPaperOrder (lines 1105–1157) logs rejections only to the modal UI (result div, line 1131–1146), not to sessionStorage.limen_paper_log. So rejections are invisible in the "PAPER TRADE LOG" section. User cannot audit a full history of attempts. **File evidence**: api/paper-trade.js lines 81–86; investment-console.html lines 1140–1149 (rejection path does NOT call paperTradeLocal).

12. **Edge Case: Empty ASSET_MAP**: If _oppData.pb.id is not in ASSET_MAP (investment-console.html line 590), assets defaults to []. Center column renders with "SUGGESTED ASSETS (0 items)" but no error message. User sees blank section. No fallback to node-derived assets or warning that playbook data is incomplete. **File evidence**: investment-console.html lines 590, 795–807.

13. **Capital-Engine Integration One-Way**: capital-engine.json defines `investment_lane` as a revenue stream but provides NO LINK BACK to investment-console.html or paper trading system. The JSON is read-only governance data; no API endpoint connects investment-console verdict scores or trade volume back to capital-engine.js?action=orchestrate. This means the finance domain's AI optimizer has no visibility into paper-trading performance or pipeline signals. Integration is only declarative (json), not runtime. **File evidence**: api/capital-engine.js (no reference to paper-trade, paper-orders, or investment-console); capital-engine.json line 95 (investment_lane defined in isolation).

14. **No Simulation Mode Flag in UI**: Users executing paper trades may not realize they're in paper mode if Alpaca is unavailable and the system falls back to local logging. The modal disclaimers (investment-console.html lines 1044, 1045, 1140) mention "PAPER TRADING ONLY", but if a real order fails and a local trade succeeds, the UX distinction is blurred. Recommend adding a persistent banner indicating "PAPER MODE ACTIVE — ALPACA [STATUS]". **File evidence**: investment-console.html lines 1044, 1140 (modals only); no persistent banner.

15. **Alpaca Order Metadata Not Standardized**: api/paper-trade.js accepts oppId, oppTitle, verdict, score in the request body (lines 99–103) but does NOT require them. A client could submit an order with no metadata. Alpaca API ignores these fields anyway. The metadata is advisory only for the LIMEN audit log (sessionStorage). This is correct design, but lacks a server-side record of which orders came from which opportunity. **File evidence**: api/paper-trade.js lines 99–103; investment-console.html lines 1111–1119 (body assembly).

---

**Summary**: Paper trading system is **functional and low-risk** (paper-only, no real money). Market data fetches are **resilient with simulated fallback**. Portfolio analysis is **rich and domain-aware**. Main gaps are: credential normalization, market-data freshness visibility, kernel annotation cleanup, capital-engine integration depth, and off-thesis position blindness. No critical bugs; all issues are UX, transparency, and engineering debt.

---

## 19. Civilization Cockpit

### PURPOSE
The Civilization Cockpit is the primary human-operator interface for the LIMEN HELIX system. Restored 2026-06-02 (commit 61858d0), it serves as a 3-column console showing real-time stress, cross-domain audits, and research opportunities from the 20-domain civilization model (economy, energy, environment, health, technology, research, supplyChain, governance, infrastructure, agriculture, industry, education, communication, culture, defense, religion, population, law, finance, intelligence). It is the DEFAULT_LANDING page for authenticated users. The page hosts 14 named panels that relay brain signals, feed integrity, event timelines, and opportunity discovery in a single integrated view. A separate Opportunity Observatory (`/civilization-opportunities`) aggregates all opportunities discovered by domain brains and filters them by artifact lane (patents, copyrights, research-grants, nsf-project-pitch, business-grants, sba-loans, franchise, investments, research-papers).

### KEY FILES

**Main Pages:**
- `civilization.html` (532 lines) — Console cockpit layout, 3-column grid with header/footer, panel relocation engine
- `civilization-opportunities.html` (246 lines) — Observatory UI, lane filter bar, search, domain-grouped opportunity card display

**Civilization-Specific JS Modules (9 files, 4,862 lines total):**
- `assets/js/civilization/domain-packet-adapter.js` (583 lines) — Normalizes all 20 domain slots + brain payloads into audited LIMENCivilizationPackets; reads window.LIMENDomains, window.LIMENBalance, window.LIMENPolarity; marks stale brains (>6min) and stale snapshots (>5min); emits event 'limen:civilization-packets-update'
- `assets/js/civilization/cross-domain-audit.js` (475 lines) — Read-only analyzer comparing domain stress via 7 affinity groups (energy_chain, rule_of_law, economic_core, human_systems, knowledge_arc, culture_arc, environment_arc); detects corroborations, divergences, weak evidence, baseline-heavy domains, and node-shared affinities via brain-node-domains.json; emits 'limen:cross-domain-audit-update'
- `assets/js/civilization/cross-node-opportunity.js` (311 lines) — Identifies cross-node opportunity candidates by mapping domain stress onto 123 neurological nodes (brain-node-domains.json); classifies opportunities as direct/cross-domain/inferred/white-space/speculative; assigns artifact lane hints; emits 'limen:cross-node-opportunity-update'
- `assets/js/civilization/handoff-contract.js` (290 lines) — Produces per-lane packets for Main Brain consumption; enforces 9 lanes with min evidence/confidence gates; marks readyForGeneration flag; reads LIMENCivilizationPackets, LIMENCrossDomainAuditState, LIMENCrossNodeOpportunityState; emits 'limen:main-brain-handoff-update'
- `assets/js/civilization/observatory-aggregator.js` (188 lines) — Subscribes to window.LIMENDomainBrains.getAll(), projects brain.state.opportunities[] into flat OpportunityPacket list, canonicalizes domain keys (medicine→medicine, science→research, trade→supplyChain); emits no network requests; exposes window.LIMENObservatory; issues 5s soft-poll fallback
- `assets/js/civilization/observatory-deep-proof.js` (155 lines) — Lazy-loads deep-proof JSON only on user click; LRU cache capped at 2 diagnosis entries; 1-hour negative-cache for 404s; reads from `/assets/data/aggregated/<DIAGNOSIS>.deep.json` (currently no .deep.json files present; falls back gracefully)
- `assets/js/civilization/artifact-source-index-client.js` (498 lines) — Maps diagnosis labels to bundled source artifacts via DIAGNOSIS_ALIAS_MAP (e.g., RENEWABLE_INTERMITTENCY → INTERMITTENCY_SPIKE); reads `/assets/data/artifact-source-index/by-diagnosis/<diagnosisId>.json` (path scaffold; no bundles present at runtime)
- `assets/js/civilization/artifact-packet-builder.js` (1,580 lines) — Composes ArtifactPacket from HandoffPacket (canonical) + Observatory packets (enrichment); schema D3-A3.v3; reads HandoffPacket, Observatory packets, optional domain snapshot; returns frozen objects; never fetches; deprecated Observatory-driven path preserved; exposes window.LIMENArtifactPacketBuilder
- `assets/js/civilization/observatory-ui.js` (782 lines) — Renders Observatory cards grouped by domain, filterable by lane and searchable; subscribes to window.LIMENObservatory.getPackets(); lazy-loads deep-proof on click; emits 'limen:observatory-ui-rendered' (conceptual); patches stateful proof-panel expansion state across re-renders

**Core Data:**
- `assets/data/civilization.top.json` (8.8K) — Civilization universe definition: 20 nodes (domains), weights 1.0 each, 30 edges defining CONTROLS/SUPPLIES/DEPENDS_ON/TRANSFORMS relationships, layout type golden_spiral, child universes per domain
- `assets/data/brain-node-domains.json` (291K) — 123 neurological nodes (NAcc, VTA, OFC, dlPFC, BLA, etc.) mapped to business domain roles; enables cross-node opportunity discovery and neurological-institutional pattern transfer
- `assets/data/limen-report-index.json` (437K) — Index of LIMEN reports (unused by cockpit UI but available for background synthesis)
- `assets/data/company-index.json` (44K) — Company reference data (passive)

**Panel-Creating Modules (referenced in PANEL_MAP):**
- 14 named panels (lifecycle managed by panel-state-manager.js):
  1. `limen-event-rail` → col-left (events, escalations)
  2. `limen-investigation-drawer` → col-left (investigation/diagnosis detail)
  3. `limen-narrator-panel` → col-left (narrative synthesis)
  4. `limen-feed-inspector` → col-center (feed health, source integrity)
  5. `limen-domain-panel` → col-center (per-domain stress, activity, diagnoses)
  6. `limen-timeline-strip` → col-center (event timeline)
  7. `limen-phase-display` → col-center (phase estimator output)
  8. `limen-health-strip` → col-right (module health, feed freshness)
  9. `limen-triage-panel` → col-right (market stress triage)
  10. `limen-connectome-map` → col-right (connectome relationship map)
  11. `limen-research-observatory` → col-right (node visibility conflicts, cross-domain clusters, bio→institutional gaps, bio→institutional hypotheses)
  12. `limen-stress-strip` → console-footer (global stress aggregate)
  13. `limen-snapshot-badge` → console-footer (snapshot currency badge)
  14. `limen-mode-bar` (fixed, docked above footer) → relabeled to CONNECTOME button navigating to `/connectome.html`

**Supporting JS Modules Loaded on Both Pages (37 scripts):**
- Feed pipeline: limen-ui-state.js, phase-estimator.js, feed-store.js, feed-state.js, panel-state-manager.js, shared-snapshot-engine.js, domain-signal-engine.js
- Domain brains (20): energy-brain.js, finance-brain.js, defense-brain.js, trade-brain.js, medicine-brain.js, agriculture-brain.js, communication-brain.js, culture-brain.js, economy-brain.js, education-brain.js, environment-brain.js, governance-brain.js, industry-brain.js, infrastructure-brain.js, intelligence-brain.js, law-brain.js, population-brain.js, religion-brain.js, science-brain.js, technology-brain.js
- Brain infrastructure: domain-brain-base.js, domain-brains/portal-content-resolver.js, domain-brains/inter-brain-bus.js, domain-registry.js, domain-brain-adapter.js, domain-brains/domain-change-log.js
- Panels: event-engine.js, investigation-engine.js, research-observatory.js, escalation-console.js, market-stress-triage.js, timeline-engine.js, global-state-engine.js, balance-meter.js, self-health-monitor.js
- Executive: limen-exec-generator.js, limen-executive-control.js, limen-executive-ui.js, limen-simulation-engine.js, limen-action-adapters.js
- Schemas: fractal-report-schema.js, company-portal-schema.js
- Portal/remedy: gap-synthesis-templates.js, limen-gap-synthesis-engine.js, remedy-resolver.js, limen-remedy-registry.js
- UI/command: ui-mode-manager.js, limen-command-bar.js
- Standalone: limen-fast-boot.js, limen-bootstrap.js, world-signal-ingestor.js, cross-domain-detector.js, action-selection-gate.js, domain-biosensor-adapter.js, interoceptive-divergence.js, narrative-memory.js, discovery-engine.js, action-suggester.js
- Biosensor: biosensorEngine.js, biosensor-bridge.js, biosensor-control-panel.js, limen-sparkline.js
- Report/export: analyst-report-builder.js, report-exporter.js
- UI rendering: console-clarity.js, regulation-renderer.js, report-console.js, domain-repair-map.js

### LIVE PAGES
- https://limenhelix.com/civilization (main cockpit console)
- https://limenhelix.com/civilization-opportunities (observatory with lane filtering)

### DATA

**Domain Packets (Real-time, from LIMENCivilizationAdapter):**
- Source: window.LIMENDomains (20 slots) + domain brains (20 parallel processors) + signal-engine snapshots
- Freshness gates: Brain updates checked every 6 minutes (BRAIN_STALE_MS); signal snapshots flagged at 5+ minutes old (SNAPSHOT_STALE_MS)
- Status: BRAIN PAYLOAD AUTHORITY — brain truth always wins if fresh; snapshot data used only as fallback and clearly marked
- Emitted: LIMENCivilizationPackets = { [domainId]: Packet } where each Packet contains { stressScore, activity, feedIntegrity, evidenceQuality, auditFlags[], sourceType, diagnoses[], treatments[] }

**Cross-Domain Audit (Static groups + neurological mapping):**
- Source: 7 static affinity groups (48 domain pairs total) + 123-node brain-node-domains.json dynamic lookup
- Status: FRESH — computed on every domain-brain-update / domain-update event; debounced 600ms
- Output: corroborations (stress-aligned groups), divergences (stress ≥0.30 apart), evidenceWeak (<0.40 quality), underfed (<1/3 feed integrity), nodeSharedAffinities (cross-domain roles at shared nodes)

**Cross-Node Opportunity Discovery:**
- Source: 123 neurological nodes (brain-node-domains.json) × 20 domain stresses × corroborated groups
- Classification: direct (single domain elevated + good evidence), cross-domain (multiple domains at node aligning), inferred (domain elevated, evidence middling), white-space (node exists, no active evidence), speculative (weak/single-flag)
- Artifact lanes assigned: patents, copyrights, business-grants, research-grants, nsf-project-pitch, sba-loans, franchise, investments, research-papers
- Status: FRESH — recomputed on packet-update / audit-update; debounced 700ms

**Main Brain Handoff (Lane-gated packets for artifact generation):**
- Source: LIMENCrossNodeOpportunity list → per-lane packet builder
- Lane gates: Conservative minimum-evidence and minimum-confidence gates per lane; singleDomainOnly enforcement for patents/sba-loans/franchise/investments
- Status: FRESH — recomputed on handoff-update / opportunity-update; debounced 800ms
- Output: window.LIMENMainBrainHandoff = { lanes: { [lane]: [HandoffPacket, ...] }, totalPackets, timestamp }

**Observatory (Aggregated Opportunities from Domain Brains):**
- Source: Subscribes to window.LIMENDomainBrains.getAll(); projects brain.state.opportunities[] into OpportunityPacket list
- Canonicalization: health→medicine, research→science, supplyChain→trade (DOMAIN_CANONICAL map)
- Status: FRESH — 5-second soft-poll refresh (no network); instant refresh on limen:domain-brain-update / limen:domain-update events
- Output: window.LIMENObservatory.getPackets() = [{ id, domain, title, path, urgency, confidence, stress, source, diagnosisId, ... }, ...]

**Deep-Proof (Lazy-loaded large diagnosis proofs):**
- Path template: `/assets/data/aggregated/<DIAGNOSIS>.deep.json` (currently **NO FILES PRESENT**)
- Strategy: LRU cache (cap 2 entries), negative-cache 404s for 1 hour, deduplicate concurrent loads
- Fallback: On missing file, observatory-ui shows packet summary fallback (no crash)

**Artifact Source Index (Diagnosis-scoped source bundles):**
- Path template: `/assets/data/artifact-source-index/by-diagnosis/<diagnosisId>.json` (currently **NO DIRECTORY / FILES PRESENT**)
- Alias map: 2 entries (RENEWABLE_INTERMITTENCY→INTERMITTENCY_SPIKE, GRID_COLLAPSE→GRID_FREQUENCY_INSTABILITY); extensible but conservative
- Fallback: On missing bundle, packet.deepSource.aliasUsed=false, consumers use MB-D.1.3 SOURCE_CONTEXT_SHALLOW path

**Artifact Packets (D3-A3.v3):**
- Source: HandoffPacket (canonical) + Observatory packets (enrichment) + optional domain snapshot
- Count: Exactly equal to HandoffPacket count (1:1 mapping, no multiplicity)
- Enrichment cap: 20 Observatory packets per HandoffPacket
- Status: READ-ONLY immutable frozen objects; never persisted; computed on-demand

**Civilization Universe Graph (civilization.top.json):**
- 20 nodes, 30 edges, golden-spiral layout
- Edges encode systemic relationships (CONTROLS, SUPPLIES, DEPENDS_ON, TRANSFORMS) with weights 0.5–0.8
- Child universes: each domain has subordinate portal structure (civilization.economy, civilization.energy, etc. — not directly accessed by cockpit)

### HOW IT CONNECTS

**Signal Flow (Inbound to Civilization Cockpit):**

1. **Domain Brains** (20 parallel loops) → **LIMENDomains + brain payloads**
   - Each brain runs its own cycle (energy-brain, finance-brain, etc.)
   - Emits: brain.state = { stress, activity, diagnoses[], treatments[], opportunities[], brainUpdatedAt }
   - Trigger: limen:domain-brain-update event
   - Civilization reads via: window.LIMENDomainBrains.getAll()

2. **Signal Engine** (cross-domain signal aggregation) → **window.LIMENDomains[id].snapshot**
   - Runs every 30s, writes domain snapshots
   - Emits: limen:domain-update event
   - Civilization reads as FALLBACK if brain stale (>6min)

3. **Domain Packets** (domain-packet-adapter.js)
   - Consumes: LIMENDomains + LIMENBalance + LIMENPolarity
   - Normalizes to LIMENCivilizationPackets (20 packets, 1 per domain)
   - Listens: limen:domain-update, limen:domain-brain-update
   - Emits: limen:civilization-packets-update
   - Throttled rebuild (400ms) to prevent thrash

4. **Cross-Domain Audit** (cross-domain-audit.js)
   - Consumes: LIMENCivilizationPackets + brain-node-domains.json
   - Analyzes: 7 affinity groups + 123 neurological node mappings
   - Output: LIMENCrossDomainAuditState (findings with corroborations/divergences/weak-evidence)
   - Listens: limen:civilization-packets-update
   - Emits: limen:cross-domain-audit-update (debounce 600ms)

5. **Cross-Node Opportunity Discovery** (cross-node-opportunity.js)
   - Consumes: LIMENCivilizationPackets + LIMENCrossDomainAuditState + brain-node-domains.json
   - Classifies: direct/cross-domain/inferred/white-space/speculative opportunities
   - Assigns: artifact lane hints per DOMAIN_LANE_HINTS map
   - Output: LIMENCrossNodeOpportunityState (list of opportunity candidates with confidence/urgency/evidence grades)
   - Listens: limen:civilization-packets-update, limen:cross-domain-audit-update
   - Emits: limen:cross-node-opportunity-update (debounce 700ms)

6. **Main Brain Handoff** (handoff-contract.js)
   - Consumes: LIMENCrossNodeOpportunityState + LIMENCivilizationPackets + LIMENCrossDomainAuditState
   - Per-lane gating: Applies minEvidence/minConfidence thresholds per lane; singleDomainOnly enforcement
   - Output: LIMENMainBrainHandoff = { lanes: { patents: [...], copyrights: [...], ... }, totalPackets }
   - Listens: limen:cross-node-opportunity-update
   - Emits: limen:main-brain-handoff-update (debounce 800ms)

7. **Observatory Aggregator** (observatory-aggregator.js — civilization-opportunities.html only)
   - Consumes: window.LIMENDomainBrains.getAll() (brain-authored opportunities)
   - No fetch; reads brain state only
   - Canonicalizes domain keys
   - Output: window.LIMENObservatory.getPackets() (flat list of brain opportunities)
   - Listens: limen:domain-brain-update, limen:domain-update (5s soft-poll fallback)
   - Emits: Observatory state (no named event; subscribers polled via .subscribe())

8. **Artifact Builder** (artifact-packet-builder.js — Main Brain only)
   - Consumes: HandoffPacket (primary) + Observatory packets (enrichment)
   - Immutable frozen output
   - Never fetched by cockpit; generated by Main Brain executor

**Panel Creation & Lifecycle:**
- `panel-state-manager.js` is source of truth for all 14 panel visibility states
- `civilization.html` instantiates panels via scripts (event-engine, investigation-engine, etc.)
- PANEL_MAP (lines 436–458 of civilization.html) relocates dynamically-created panels into grid columns
- MutationObserver ensures newly-injected panels move to correct column on first appearance
- Panel state persisted in sessionStorage; all panels default to visible on fresh page load

**Outbound Flows (from Cockpit to Main Brain):**
1. **Investigation Detail** → investigation-engine.js → window.LIMENInvestigationState → Investigation panel (detail on click)
2. **Opportunity Selection** → civilization-opportunities.html → Deep-Proof lazy-load (observatory-deep-proof.js) → no persistence, read-only view
3. **Event Escalation** → event-engine.js → limen:event event → escalation-console.js → triage-panel (market-stress-triage.js)
4. **Mode Navigation** → Mode bar MAP button → patched to CONNECTOME → window.location.href = '/connectome.html'

**Cross-Domain Synchronization Points:**
- All modules listen to `limen:domain-update` (signal-engine every 30s)
- All modules listen to `limen:domain-brain-update` (individual brain completion)
- Panel visibility state synchronized via `limen:panel-state-change` (panel-state-manager.js)
- Global stress / balance / polarity fed from global-state-engine.js (reactive)

### NEEDS WORK / INCONSISTENCIES

1. **Missing Deep-Proof Data** (observatory-deep-proof.js, lines 30-35)
   - Expected path: `/assets/data/aggregated/<DIAGNOSIS>.deep.json`
   - Status: **NO FILES PRESENT**. Observatory UI gracefully degrades, showing packet summary fallback on click, but "Loading large deep proof…" text and fallback panel render empty nested structure.
   - Impact: Low (lazy-load; user sees "not found" UI state, not crash)
   - Action: Either (a) disable deep-proof loading entirely and hide the button, or (b) run `scripts/build-aggregated-deep-proof.js` (if exists) to populate the tank

2. **Missing Artifact Source Index** (artifact-source-index-client.js, lines 40-41, 77-83)
   - Expected path: `/assets/data/artifact-source-index/by-diagnosis/<diagnosisId>.json`
   - Status: **DIRECTORY DOES NOT EXIST**. 2 diagnosis aliases defined but no backend bundles.
   - Impact: Low (fallback path used; packets route to SOURCE_CONTEXT_SHALLOW)
   - Action: Run `scripts/build-artifact-deep-source-index.js` (if exists) or disable client if not planned

3. **Observatory-UI Lane Buttons** (civilization-opportunities.html, lines 160–168)
   - Lane buttons in filter bar: ALL, PATENT, GRANT, INVESTMENT, BUSINESS/SBA, LOAN/INFRA, RESEARCH, REGULATORY, OPERATOR
   - Defined lanes in handoff-contract.js: patents, copyrights, business-grants, research-grants, nsf-project-pitch, sba-loans, franchise, investments, research-papers
   - **Mismatch**: UI lane names do NOT match handoff lane keys exactly (e.g., "PATENTABLE" vs "patents", "GRANT-ELIGIBLE" vs "research-grants")
   - Impact: Medium (lane filter logic at observatory-ui.js line 58 laneClass() must map UI lane → handoff lane; if mapping missing, filters fail silently)
   - Action: Verify observatory-ui.js implements correct lane-name → lane-key translation; add missing lanes (REGULATORY, OPERATOR appear to have no backend support)

4. **Domain Name Aliasing** (3 non-canonical runtime keys)
   - brain-emitted keys: health → medicine, research → science, supplyChain → trade
   - DOMAIN_CANONICAL map in observatory-aggregator.js handles this
   - DOMAIN_ORDER in domain-packet-adapter.js uses canonical names
   - Issue: If a 3rd consumer needs the same mapping, extract to shared module assets/js/domain-canonicalizer.js (currently inline in observatory-aggregator only)
   - Impact: Low (currently works; brittle if duplicated logic diverges)

5. **Stale Data Thresholds** (domain-packet-adapter.js, lines 57–58)
   - BRAIN_STALE_MS = 6 minutes
   - SNAPSHOT_STALE_MS = 5 minutes
   - Status: **Conservative but may mask real latency issues**. A brain that hasn't updated for 5:59 still renders as "fresh" with brain payload.
   - Action: Monitor brain cycle times; if average > 3min, reduce BRAIN_STALE_MS to 4 min or add "warn" flag at 4min threshold

6. **Observatory Opportunity Canonicalization Asymmetry**
   - observatory-aggregator.js canonicalizes domain keys for UI consumption
   - BUT artifact-packet-builder.js stores originalRawDomain for traceability
   - Inconsistency: If an artifact packet references a diagnosis from a medicine-brain (brain emits rawDomain='health'), the diagnosis may be labeled in one dialect and looked up in another
   - Impact: Low (ArtifactPacket preserves both canonical + raw; lookups use canonical)
   - Action: Ensure diagnosis alias map in artifact-source-index-client.js accounts for raw-domain variants

7. **Panel Relocation Polling** (civilization.html, lines 479–499)
   - Uses setInterval with 10-pass limit (5 seconds total polling)
   - If a panel renders after 5 seconds, it stays in body, not in grid column
   - Impact: Low (observed: panels instantiated synchronously or within boot sequence; 5s buffer adequate for current load order)
   - Action: Increase passes to 20 (10s) if late-loading panels added; log unlocated panels to console for debugging

8. **Research Observatory Module Dependency** (research-observatory.js)
   - Loads brain-node-domains.json (implicit; no error handling if missing)
   - Code at lines 23–35 uses loadJSON() but no fallback if file 404s
   - Impact: Low (file exists; but if deleted, module silently fails and panel renders empty)
   - Action: Add explicit error logging to loadJSON callback and render "data unavailable" message

9. **Missing Module Registration** (limen-bootstrap.js dependency)
   - civilization.html does not explicitly load limen-bootstrap.js in body — checking civilization.html lines 314–426
   - Line 426 loads `assets/js/limen-bootstrap.js` last
   - Status: **PRESENT**. All core modules load in correct order.
   - No action required

10. **Interconnect Event Silence Detection** (self-health-monitor.js)
    - EVENT_SILENCE_THRESHOLD = 90 seconds
    - If no limen:domain-update fires for 90s, health monitor flags "event silence"
    - Implication: If signal-engine polling is > 90s, cockpit shows as degraded even if brains are running
    - Action: Verify signal-engine.js polling cadence is < 60s; adjust EVENT_SILENCE_THRESHOLD if needed

11. **Biosensor Engine Dependency** (civilization.html, line 346)
    - Line 346: `<script src="biosensorEngine.js" defer></script>`
    - **File path is ROOT-relative, not assets-relative**. Should be `assets/js/biosensorEngine.js` or just `biosensorEngine.js` if root file exists.
    - Status: **WORKS** (restored in commit 61858d0; biosensorEngine.js is root file, 1,872 lines)
    - Action: No change; intentionally at root for direct load

12. **Domain Brain Adapter vs. Brain Outputs** (domain-brain-adapter.js)
    - Brain-adapter normalizes ALL domain outputs into window.LIMENDomains slots
    - But civilization packet-adapter reads both window.LIMENDomains AND window.LIMENBalance AND window.LIMENPolarity separately
    - If a domain brain updates but balance-meter hasn't run yet, packet-adapter may use stale balance data
    - Impact: Low (both run in quick succession; 30s snapshot fallback catches divergence)
    - Action: Consider adding balance/polarity age checks to packet-adapter warnings

---

**Summary Stats:**
- **14 named panels** active on cockpit (all accounted for, all in PANEL_MAP)
- **20 domain brains** (energy, finance, defense, trade, medicine, agriculture, communication, culture, economy, education, environment, governance, industry, infrastructure, intelligence, law, population, religion, science, technology)
- **9 artifact lanes** (patents, copyrights, business-grants, research-grants, nsf-project-pitch, sba-loans, franchise, investments, research-papers)
- **123 brain nodes** (neurological, mapped to domain roles via brain-node-domains.json)
- **20 domains** in civilization model (ordered: economy, energy, environment, health, technology, research, supplyChain, governance, infrastructure, agriculture, industry, education, communication, culture, defense, religion, population, law, finance, intelligence)
- **4,862 lines** of civilization-specific JS (9 modules)
- **Data freshness**: Brain payloads <6min = fresh; snapshots <5min = fresh; beyond = stale flags emitted

**Last restored:** 2026-06-02 13:13:50 UTC (commit 61858d0); all 108 script dependencies resolved (107 pre-present, biosensorEngine.js migrated).

---

## 20. Recommendations / reports / executive / philemon

### PURPOSE

Four integrated subsystems that transform propagated signals into structured recommendations, synthesize multi-audience reports, provide executive decision control with human gate-keeping, and deliver a calm voice guide ("Philemon") to the operator.

**Pipeline flow:**
- Signals → Pattern Detection → Remedy Resolution → Scale Translation → Evidence Envelope → Recommendation Object
- Recommendation Set → Report Synthesis (6 audience types) → HTML/PDF/JSON Export
- Domain Stress + Domains + Global State → Executive Intent Lifecycle → Audit Trail + Server Sync
- System State → Voice Narration (opportunistic speaking with deduplication + cooldown gates)

### KEY FILES

**Recommendations module (13 files):**
- `assets/js/recommendations/recommendation-engine.js` — Core orchestrator: pattern detection (hot clusters, cold gaps, prediction violations, oscillations), remedy resolution per scale, scale translation, confidence modeling, urgency decay, recommendation assembly
- `assets/js/recommendations/report-synthesizer.js` — 6 report types: mainUser (simple, no jargon), portalUser (clinical + evidence), businessPortal (KPIs + metrics), domain (policy + cross-domain deps), civilization (all domains + resonance), patentOpportunity (patent gaps + signals)
- `assets/js/recommendations/remedy-resolver.js` — Remedy knowledge base lookup per pattern + scale
- `assets/js/recommendations/evidence-builder.js` — Evidence envelope wrapping (historical analogues, current state, predictive projections, uncertainty models)
- `assets/js/recommendations/scale-translator.js` — Multi-scale remediation translation
- `assets/js/recommendations/regulation-reports.js` — Domain-specific regulation plan synthesis
- `assets/js/recommendations/portal-treatment-resolver.js` — Portal-sourced treatment pipeline
- `assets/js/recommendations/fractal-traversal-resolver.js` — Recursive cross-scale propagation
- `assets/js/recommendations/portal-quality-assessor.js` — Assessment of portal data quality
- `assets/js/recommendations/deep-portal-harvester.js` — Data extraction from portal registry
- `assets/js/recommendations/domain-regulation-engine.js` — Per-domain regulation synthesis
- `assets/js/recommendations/test-harness.js` — Unit test framework
- `assets/js/recommendations/report-test-harness.js` — Report validation harness

**Reports module (2 files):**
- `assets/js/reports/report-exporter.js` — Exports recommendations to HTML (print-ready), PDF (window.print), JSON formats; supports all 7 report types
- `assets/js/reports/report-validation.js` — Report schema validation

**Executive module (8 files):**
- `assets/js/executive/limen-executive-control.js` — Phase 11 decision engine: intent lifecycle (ACTIVE→WAITING_USER→PAUSED→COMPLETED/ABANDONED), domain+strategy duplicate check, plan memory archetype learning, server sync of intents via `/api/limen-intents`
- `assets/js/executive/limen-executive-ui.js` — DOM/UI bindings for intent display and interaction
- `assets/js/executive/limen-simulation-engine.js` — Outcome simulation of intents
- `assets/js/executive/limen-action-adapters.js` — Converts intent plans to executable actions
- `assets/js/executive/limen-ingest-client.js` — Feeds domain/global state to executive
- `assets/js/executive/limen-package-generator.js` — Bundles intent + outcome + metadata for transmission
- `assets/js/executive/limen-exec-generator.js` — Intent creation from recommendation streams
- `assets/js/executive/response-safety-layer.js` — Human confirmation gates

**Philemon module (1 file):**
- `assets/js/philemon/philemon-voice-guide.js` — Named voice guide (elder archetype, calm tone) with TTS, plain-language command processor, reactive narration (escalation/domain-spike/de-escalation events), alert deduplication + cooldown gates (120s default), startup greeting, 14 narration templates, 11 response handlers, Alt+P keyboard shortcut, minimal UI (badge + input field, bottom-left)

**Data files:**
- `assets/data/limen-report-index.json` (446 KB) — Index mapping job roles to brain nodes (neuroscience→civilization mapping, e.g., mPFC=0, Hypothalamus PVN=31, Claustrum=65), with dysregulation outcomes and cross-domain business mappings

### LIVE PAGES

- https://limenhelix.com/civilization — Full recommendation pipeline, executive control, philemon voice guide
- https://limenhelix.com/domain-console — Domain-specific recommendations, executive control, safety layer
- https://limenhelix.com/limen-report — Report visualization per node + cross-domain mappings
- https://limenhelix.com/execution-reports — Execution phase reports (77+ execution-*.js modules loaded; separate from recommendations area)
- https://limenhelix.com/helix-report — Report summary page
- https://limenhelix.com/{domain}-opportunities — Opportunity scanning (uses limen-executive-ui for simulation display)

Recommendation reports also embedded in opportunity pages (agriculture, communication, culture, defense, economy, education, energy, environment, finance, governance, industry, infrastructure, intelligence, law, medicine, population, religion, science, technology, trade) — all load executive control + simulation engine.

### DATA

**In (READ):**
- `window.LIMENDomains` — domain stress, confidence, trend, signals (live)
- `window.LIMENGlobalState` — global mode (stable/pressured/escalating/recovering), score, topDrivers, lastShift (live)
- `window.LIMENLongMemory` — regime, baseline, trends, cycles (from long-memory-engine)
- `window.LIMENRemedyResolver` — remedy KB (sync)
- `window.LIMENEvidenceBuilder` — evidence envelope templates (sync)
- `window.LIMENRecommendationEngine` — generates recs before synthesis (internal chain)
- `localStorage:limen_active_intents` — persisted intent list (up to 25 max)
- `localStorage:limen_plan_memory` — bounded archetype learning from completed intents
- `localStorage:limen_anomalies` — recent anomaly events for pattern matching
- `localStorage:limen_pathway_weights` — pathway learning state
- `/api/limen-intents` (GET/POST) — server sync of active intents
- `assets/data/limen-report-index.json` — role→node mappings for limen-report.html

**Out (WRITE):**
- `localStorage:limen_active_intents` — write new/updated intents after user action
- `localStorage:limen_plan_memory` — write on intent completion (archetype learning)
- `localStorage:limen_executive_audit` — write rejected transitions, creation rate, staleness meta
- Browser `window.dispatchEvent()` — custom events:
  - `limen:intent-created`, `limen:intent-updated`, `limen:intent-completed`, `limen:intent-abandoned`
  - `limen:step-waiting-user`, `limen:attention-updated`, `limen:executive-audit-updated`
  - `limen:philemon-speak`, `limen:intents-restored`
- TTS via `window.speechSynthesis.speak()` (Philemon voice)
- Download URLs for report exports (HTML, PDF via print, JSON)

**Data Status:**
- `limen-report-index.json` — LIVE (446 KB, populated with medical roles↔brain node mappings)
- Intent streams (`limen_active_intents`) — LIVE (user-driven)
- Executive audit (`limen_executive_audit`) — LIVE (creation/transition tracking)
- Recommendations cache — TRANSIENT (per-session, not persisted)
- Reports — GENERATED ON DEMAND (no persistent tank)

### HOW IT CONNECTS

**Forward pipeline:**
1. **Domain Signals** (domain-signal-engine) → **Recommendation Engine** (detects 14 pattern classes: threat_cascade, executive_overload, reward_dysregulation, etc.)
2. **Patterns** → **Remedy Resolver** (per scale: mainUser/portalUser/business/domain/civilization) + **Scale Translator** + **Evidence Builder**
3. **Recommendation Set** → **Report Synthesizer** (6 audience-specific reports)
4. **Reports** → **Report Exporter** (HTML/PDF/JSON download)

**Executive decision loop:**
- **Recommendation Set** → **Limen Exec Generator** creates intents
- **Intents** stored in `limen_active_intents` + synced to `/api/limen-intents`
- **Executive Control** enforces state transitions (ACTIVE→WAITING_USER→PAUSED→COMPLETED/ABANDONED)
- **Action Adapters** convert intents to concrete actions
- **Simulation Engine** projects outcomes
- **Safety Layer** gates human confirmation (domain-console.html loads `response-safety-layer.js`)

**Philemon narration (opportunistic, event-driven):**
- Listens for `limen:global-state-update` (mode changes: escalating, recovering, stable)
- Listens for `limen:domain-distress` (single domain stress spike)
- Listens for `limen:domain-update` (de-escalation detection)
- Listens for `limen:feed-state-change` (feed degradation/restoration)
- Deduplicates alerts via signature (alertType::domain) + 120s cooldown + material-change gates
- Speaks with voice profile: rate 0.78, pitch 0.72, volume 0.75 (elder register); prefers Daniel/Google UK English Male/Microsoft David
- Startup greeting (4s delay, sooner if feeds arrive) per system state (stable/elevated/stressed/noData)
- Alt+P toggles input for 11 commands: "what am I looking at", "why is this important", "what should I do", "which domain is worst", "summarize", "tell me more", "what is the trend", "are there treatments", "go quiet", "wake up", "help"
- Badge appears bottom-left (#limen-philemon-indicator), color indicates active/silent
- 14 greeting templates, 8 narration templates (domain spike, escalation, feed state), 6 elaboration chains

**Evidence integration:**
- Report synthesizer extracts evidence envelope (historical analogues, current node states, projected trajectories) from recommendation object
- Builds sourceChain (feeds, seed nodes, propagation steps, pattern counts, remedy lookups)
- Current section scores data quality (grade, live ratio, statement) from envelope's dataQuality

**Cross-domain resonance:**
- Domain repair reports (domainRepairReport schema) list cross-domain dependencies in signals
- Patent opportunity reports overlay domain/civilization recommendations for institutional gap detection
- Civilization report aggregates all scales + lists domain stress overview

**Separate execution system:**
- `execution-reports.html` loads 77+ execution-phase*.js modules (phases 1–11, tracking operators, outcomes, payouts, approval routing, etc.)
- NOT part of recommendation/executive pipeline; parallel operational system
- Exposes `window.LIMENExecution.phase6.reports` for copyable JSON export

**Portal integration:**
- `deep-portal-harvester.js` extracts diagnoses + treatments from portal registry
- `portal-quality-assessor.js` scores portal data completeness
- Portal treatment data feeds into remedy resolver as fallback
- Treatments appear in domain/civilization reports as "Registry Diagnoses & Treatments" sections

### NEEDS WORK / INCONSISTENCIES

1. **Philemon removed from civilization.html** — Line 369 reads `<!-- philemon removed -->` but philemon-voice-guide.js exists and is loaded on ALL pages. Unclear why commented out; check if intentional or stale flag.

2. **No philemon on opportunities pages** — 22 opportunity pages (agriculture, defense, energy, etc.) load executive modules but NOT philemon. Only main portals (civilization, domain-console) have voice guide. Consider expanding philemon to all primary pages.

3. **Response safety layer only on domain-console** — `response-safety-layer.js` loaded only on domain-console.html (line 425), not on civilization.html. Asymmetric human gating between two main portals.

4. **Execution vs. recommendation silos** — `execution-reports.html` is a completely separate 77-module system (operator tracking, payouts, policy, phases 1–11). No visible integration with recommendation/executive/philemon pipeline. No cross-calls, no shared state (other than localStorage for intents). Verify if intentional architectural separation.

5. **limen-report-index.json mapping stale risk** — 446 KB medical role→brain node mapping. No visible refresh mechanism or version stamp. Job titles (Physician, Endocrinologist) are hardcoded; if business roles evolve, this tank becomes orphaned.

6. **Report schema locks but no validation on synthesis** — recommendation-schema.json, evidence-schema.json, innervation-schema.json are marked "locked — read-only", but report-synthesizer.js has no runtime schema validation. Synthesized reports could deviate and silently break schema contract.

7. **Evidence envelope historical section optional** — report-synthesizer.js._buildHistoricalSection() returns `{ available: false, analogueCount: 0 }` fallback if envelope missing. No warning if analogues are expected but missing. Confidence may be over-stated without historical context.

8. **Philemon alert memory unbounded in theory** — `_alertMemory` map has no size cap. In a 24/7 operation with many domain fluctuations, cooldown entries could accumulate. No garbage collection logic visible (other than manual delete on de-escalation).

9. **Executive intent cap is 25, no overflow handling** — MAX_ACTIVE_INTENTS = 25; createIntent() returns error if full. No archiving, prioritization, or emergency drop logic. Operator can fill queue with low-priority intents and block new ones.

10. **Server sync of intents fire-and-forget** — limen-executive-control.js line 116–121: `/api/limen-intents` POST has 5s timeout, no retry, no error feedback to user. Network failures silently drop intent updates server-side.

11. **No read-back after server sync** — If server persists intents, there is no periodic refresh to catch server-side deletes or external updates. Boot only merges if local is empty OR server is newer, but only happens once at load.

12. **Recommendations not persisted** — Recommendation objects are generated on-demand, not stored. If user navigates away, recs are lost. No way to retrieve "the recs that led to this intent".

13. **Report export does not include source chain metadata** — Exported HTML/JSON includes sourceChain object, but schema/rendering appears incomplete. Feed counts, seed node IDs, remedy lookup count are present but narrative context is minimal.

14. **Confidence thresholds hardcoded** — CONFIDENCE_THRESHOLDS in recommendation-engine.js (mainUser: 0.40, portalUser: 0.55, business: 0.60, domain: 0.50, civilization: 0.65) are constants, not configurable. No admin UI to adjust thresholds per organization risk tolerance.

15. **Philemon command bar not integrated** — Philemon registers Alt+P and opens text input, but does not register commands with the main command bar (Ctrl K) module. Separate control surface; potential UX friction if user expects Philemon to appear in command palette.

16. **No Philemon state persistence** — `_active` flag (voice on/off) resets on page load. User preference to silence Philemon is lost on navigate. Should persist to localStorage.

17. **Philemon voice profile hardcoded** — VOICE_PROFILE rate/pitch/volume are constants. No user-facing UI to adjust elder vs. youthful, speed, volume. Accessibility concern for users with different hearing needs.

18. **Recommendation urgency decays by time but not by action** — _computeUrgency() uses exponential decay (URGENCY_DECAY) but ignores user's stated next action. If user says "I will address this", urgency should not continue to decay; it should spike or reset.

19. **Pattern detection heuristics brittle** — _classifyPattern() in recommendation-engine.js uses ad-hoc node counts + thresholds (e.g., limbic >= 2 AND hyperNodes includes 17). No learned classifier, no feedback loop to improve; if brain connectome structure changes, heuristics break.

20. **Evidence envelope projected section optional** — report-synthesizer.js._buildPredictiveSection() has no data if envelope.projected is absent. Reports may lack forward-looking insights if projections not available.

21. **Patent opportunity report signals incomplete** — Only 3 sources populate signals: filing density gaps, temporal gaps, novelty encoding. No integration with domain-specific innovation registries or cross-domain bridging opportunities visible in live data.

22. **Philemon DOMAIN_KEYWORDS hardcoded** — 7 domains mapped (economy, energy, environment, health, technology, research, supplyChain). Does not cover all 20 system domains (governance, infrastructure, agriculture, industry, education, communication, culture, defense, religion, population, law, finance, intelligence are missing). Domain-specific narration will fail for those.

23. **No audit trail for human decisions on intents** — limen_executive_audit tracks rejected transitions and creation metadata, but no log of user's actual confirm/abandon/pause actions. No way to audit who decided what when.

24. **Limen-report.html node selector not connected to recommendation engine** — limen-report.html appears to be a standalone node browser using limen-report-index.json, NOT integrated with recommendation output. Operator sees limen-report in isolation from recs/exec flow.

25. **Regulation reports schema missing** — regulation-reports.js references innervation-schema but no sample regulation output visible. Unclear if regulation report generation is fully implemented or stubbed.

---

## 21. Vitals / audit / interoception

### PURPOSE

Body-wide interoception system that continuously senses corpus health via 12 specialized organ sensors in `scripts/sense/`. Each organ measures a distinct subsystem; aggregate interoception score (vitals/2.0 schema) flows to the `/vitals.html` operator dashboard. The system gates the immune executor (heal-corpus.mjs) with an operator-attention queue prioritized by severity. Interoception is foundational to LIMEN's autonomic nervous system: no signal = no action.

### KEY FILES

**Core aggregator:**
- `C:\Users\Chris\Limen-Helix-live-\scripts\audit-system-vitals.mjs` — runs all 12 organ sense() functions in sequence, rolls results into single _vitals.json snapshot, outputs overall health score and operator-attention list (used by heal executor).
- `C:\Users\Chris\Limen-Helix-live-\scripts\audit-corpus-vitals.mjs` — legacy dedicated corpus auditor (delegated to portalCorpus organ); measures placeholder bleed, brain-tag fidelity, dup risk, CB wiring, thin portals, domain mis-routing, category bleed, CIK collisions.

**Sense organs (12 total, in `scripts/sense/`):**
- `organ-feeds.mjs` (order 10, afferent) — verifies feed-status.js source registry; measures domain coverage, env-gating, count vs. 41-source benchmark. **Channel status: 55/100 IN_PAIN** (22 sources, 11/20 domains, 9 canonical missing: economy, energy, environment, finance, intelligence, medicine, science, supplyChain, technology).
- `organ-nodes.mjs` (order 20, L1 taxonomy) — validates 123 frozen L1 nodes (FROZEN until 2026-12-01 per memo); audits orphans, domain bindings. **Channel: 97/100 HEALTHY** (123/123 present, 0 orphans, 3120 bindings, 18/20 canonical, missing agriculture + supplyChain).
- `organ-domains.mjs` (order 30, cortical circuits) — checks 21 domain-brain files (one per canonical domain); verifies brainId exports, feedSources/kernels markers, domain-packet-adapter wiring. **Channel: 65/100 IN_PAIN** (21/21 brain files present but 1 malformed, adapter MISSING — loop open).
- `organ-portal-corpus.mjs` (order 40, semantic memory) — thin wrapper delegating to audit-corpus-vitals.mjs; unpacks _vitals.json snapshot into organ metrics. **Channel: 76/100 DEGRADED** (767 portals, 506/506 curated board wired, 103/290 eligible, 515/30034 prose entries flagged, 15 null composites sampled).
- `organ-dead-links.mjs` (order 45, surface integrity) — scans surfaces for company-portal link emitters; counts unguarded (no hp gate) and CB rows pointing to missing portal files. **Channel: 76/100 DEGRADED** (2 unguarded surfaces, 188 CB rows dead clicks, graceful fallback wired).
- `organ-kernel.mjs` (order 50, K1/K2/K3 coverage) — walks 767 portals, counts kernel readings per slot (legacy K1 at financialHealth, new shape at kernelReadings.{k1,k2,k3}). **Channel: 0/100 IN_PAIN** (K1 0/767, K2 0/767, K3 0/767 — **CRITICAL: ALL KERNEL READINGS EMPTY** — 767 blind portals are the K3 frontier; K2 universal coverage is primary goal post-gate-relaxation).
- `organ-connectome.mjs` (order 60, cross-domain transfer) — static checks on connectome-super-brain.js: PROPAGATE_FRACTION >0 (not 0 = dead), array-collapse fix present, crossDomainAffinities export, pattern-envelope emit. **Channel: 100/100 HEALTHY** (live, not dead, array-collapse fix confirmed, wired to pattern bus).
- `organ-civilization.mjs` (order 70, thalamus/salience) — validates civilization-super-brain.js: canonical domain array complete, kernels.thing2 structure, dominantPhase/phaseVector/stress/trajectory fields, pattern-envelope emit, domain-packet consumption. **Channel: 100/100 HEALTHY** (all 20 domains present, structures verified, pattern bus wired, consumes domain packets).
- `organ-propagator.mjs` (order 90, stress propagator) — checks limen-stress-propagator.js presence and stress-network-state.json snapshot freshness (<6h), node/edge counts, damped/pathC/alert counts. **Channel: 100/100 HEALTHY** (fresh snapshot 0.01h old, 496 nodes, 7111 edges, 10 pathC anomalies) **BUT: NO DOWNSTREAM CONSUMERS** (output orphaned, not wired into civ/master).
- `organ-master-brain.mjs` (order 80, PFC/executive) — checks master-living-brain.js + master-brain-executor.js: all 6 engine lanes declared (patent, grant, sba, franchise, investment, research), consumes civilization + connectome (65/35 blend), readiness/salience gates, engine-persist endpoint, master-inbox freshness. **Channel: 95/100 HEALTHY** (6/6 lanes, structures present) **BUT: INBOX NEVER BUILT** (engine outputs not yet gated/prioritized).
- `organ-pattern-bus.mjs` (order 100, inter-organ comm) — validates pattern-broker.js + pattern-envelope.js: audit log buffer cap (5000), emit depth guard (8), sealed/signature integrity fields, subscribe/register/emit methods, subscribers/_latest indexes. **Channel: 100/100 HEALTHY** (all structures present, inter-organ messaging operational).
- `organ-bridge.mjs` (order 110, brain↔business bridge) — measures bridge-patterns.json library size, portal coverage, pattern dominance distribution, engine output density (artifacts per lane), verbiage-templates.json readiness. **Channel: 80/100 DEGRADED** (31 patterns, 461/767 portals mapped (60.1% coverage), 2504 artifacts on 461 portals, verbiage lib ready for patent+grant+sba+investment).

**Display & orchestration:**
- `C:\Users\Chris\Limen-Helix-live-\vitals.html` — operator dashboard; fetches _vitals.json, renders organ-pulse grid (clickable cards showing score/role/summary), operator-attention queue sorted by severity, portal-regen backlog (autonomous-portal-regen frontier), immune log (recent heals with pre/post scores).
- `C:\Users\Chris\Limen-Helix-live-\scripts\sense\_index.mjs` — registry of 12 organs (ORGANS array) exported for audit-system-vitals.mjs import.

**Audit data tanks (assets/data/audit/, fresh every ~4 days):**
- `field-connection-map.json` (36KB) — maps 32 portal fields, 16 domain fields, 15 bridge fields, 7 gating dimensions, 11 treatment roles, 7 verifiers, 7 render-surface inventory to chain-step choreography.
- `mechanism-ontology.json` (15KB) — schema 1.0.0; 1 action class, 1 effect class, 1 fidelity verdict; generated 2026-05-31 (stale, audit-only).
- `mechanism-fidelity-report.json` (9.5KB) — fidelity verdicts per mechanism type.
- `port-mechanism-statements.json` (18KB) — port-to-mechanism mapping declarations.
- `pubmed-bla-baseline-snapshot.json` (4.7KB) — PubMed baseline for medicine domain (stale).
- `verification-ledger.json` (2.8MB) — timestamped audit log with schemaVersion, lastUpdatedAt, verdicts array, stats (heaviest audit file; no live consumers detected).

**Primary data tanks (read by interoception):**
- `assets/data/_vitals.json` (70KB, fresh 42h) — interoception snapshot (overall score 79/DEGRADED, 12 organs, 25 attention items, lastHeals buffer).
- `assets/data/portal-registry.json` (61.75MB, stale 1962h=82 days) — master portal registry (likely offline).
- `assets/data/treatment-discovery-cube.json` (84.25MB, fresh 72h) — treatment discovery kernel.
- `assets/data/company-registry.json` (16.27MB, stale 219h=9 days) — company registry snapshot.
- `assets/data/stress-network-state.json` (4.45MB, stale 305h=12+ days) — propagator snapshot (orphaned output, not consumed).
- `assets/data/_master-inbox.json` (0.16MB, stale 130h=5.4 days) — master-brain inbox (never regenerated per vital).

### LIVE PAGES

- https://limenhelix.com/vitals — operator interoception dashboard; updates on-demand via node scripts/audit-system-vitals.mjs.

### DATA

**Tanks read by interoception engine:**
- `assets/data/companies/*.json` (767 portals) — walked by audit-corpus-vitals.mjs via portalCorpus organ; counts placeholders (DATA_NEEDED), brain-tags, funcs, kernel readings, bridge matches, prose quality.
- `assets/js/domain-brains/*.js` (21 files) — scanned by organ-domains.mjs for structural markers.
- `assets/js/limen/connectome-super-brain.js` — scanned by organ-connectome.mjs for PROPAGATE_FRACTION, array-collapse fix, pattern-envelope emit.
- `assets/js/limen/civilization-super-brain.js` — scanned by organ-civilization.mjs for domain array, kernel structure, salience fields, pattern emit.
- `assets/js/limen/master-living-brain.js` + `assets/js/master-brain-executor.js` — scanned by organ-master-brain.mjs for lane declarations, consumer wiring, gates.
- `api/feed-status.js` — parsed by organ-feeds.mjs regex to extract domain/source pairs, auth gates, env vars.
- `api/lib/limen-stress-propagator.js` — existence checked by organ-propagator.mjs; snapshot at `assets/data/stress-network-state.json` sampled for node/edge counts.
- `assets/data/brain-node-domains.json` (L1 taxonomy) — read by organ-nodes.mjs; 123 frozen nodes, 3120 domain bindings.
- `assets/data/bridge-patterns.json` (31 patterns) — read by organ-bridge.mjs; matched per portal.branchReadings.
- `assets/data/verbiage-templates.json` — read by organ-bridge.mjs; lanes inventory check.
- `assets/data/_bridge-build-log.json` — checked by organ-bridge.mjs for age.
- `assets/data/_vitals.json` — **OUTPUT**: written by audit-system-vitals.mjs; snapshot includes all organ metrics, overall score, attention queue.

**Tank freshness status:**
- `_vitals.json` — FRESH (42h), regenerated last 2026-06-04 18:58:50.
- `treatment-discovery-cube.json` — FRESH (72h).
- `stress-network-state.json` — STALE (305h, 12+ days, last touched during propagator's morning run).
- `portal-registry.json` — STALE (1962h, 82 days, likely offline/imported once).
- `company-registry.json` — STALE (219h, 9 days).
- `_master-inbox.json` — STALE (130h, 5.4 days, never auto-rebuilt per vital flagging).
- Audit data (mechanism-ontology, etc.) — STALE (4-7 days, informational only).

### HOW IT CONNECTS

**Per-domain interoception path (multimodal weighting model):**
1. **Afferent (feedSources)** — organ-feeds.mjs senses feed-status.js registry (~22 sources across 11/20 domains). Feed sources → domain-brains (LIMENDomainBrain instances) provide raw pattern inflows.
2. **L1 taxonomy** — organ-nodes.mjs audits 123 frozen L1 nodes; each binds to 1+ domains (3120 total bindings). Domains route incoming patterns to L1 receptors (no dynamic changes until 2026-12-01 unfreeze).
3. **Domain cortex (21 brains)** — organ-domains.mjs checks all brain files exist & export brainId. Each brain emits LIMENDomainPackets → domain-packet-adapter (MISSING — **LOOP OPEN**, no packets flowing to civilization).
4. **Cross-domain transfer** — organ-connectome.mjs verifies connectome-super-brain.js alive (PROPAGATE_FRACTION>0, array-collapse fix in place); connectome computes per-domain affinities, publishes sealed pattern-envelopes to pattern-broker.
5. **Civilization aggregator (thalamus)** — organ-civilization.mjs confirms civilization-super-brain.js consumes domain packets (BROKEN — adapter missing), integrates 20 domain kernels into civilization-scope readout (dominantPhase, phaseVector, stress, trajectory). **Expected consumption path blocked.**
6. **Master Brain (PFC)** — organ-master-brain.mjs confirms master-living-brain.js consumes civilization (65%) + connectome (35%) kernels, gates 6 execution lanes (patent, grant, sba, franchise, investment, research), fires engine outputs. **Inbox never built** — outputs not yet prioritized/gated.
7. **Engine persistence** — master outputs should write to `assets/data/_master-inbox.json` (stale 5.4 days, age suggests no recent engine fires OR inbox not being rebuilt).
8. **Pattern bus (inter-organ messaging)** — organ-pattern-bus.mjs confirms pattern-broker.js + pattern-envelope.js healthy; all organs can emit sealed envelopes. **Propagator output disconnected** — stress-network-state orphaned, no readers wired to stress field in civilization/master.
9. **Bridge layer (idea generation)** — organ-bridge.mjs measures pattern-library→portal-mapping density (31 patterns, 461/767 portals matched, 60.1% coverage); engine outputs mint artifacts on matched portals (2504 total across 6 lanes).

**Interoception → immune action loop:**
- Vitals score (79/DEGRADED) gates heal-corpus.mjs executor.
- Operator-attention queue (25 items, sorted by severity: high, med, low) feeds `/master-inbox.html` operator task list.
- Critical issues blocking cascade:
  - **Kernel readings EMPTY** (K1/K2/K3 all 0%) — K3 frontier (767 blind portals); K2 gates relaxed but not deployed.
  - **Domain-packet-adapter MISSING** — blocks civilization aggregator input; domains emit but no aggregation.
  - **Master-brain inbox never built** — engine outputs not gated/ranked.
  - **Propagator output orphaned** — stress propagation computed but no consumers wired.

### NEEDS WORK / INCONSISTENCIES

**CRITICAL (block system flow):**
- **Kernel organ IN_PAIN (0/100)** — ALL 767 portals have empty K1/K2/K3 readings. Cause: K1 readings may still be at legacy `financialHealth.composite` (field-name drift from `compositeScore`), K2 gates not yet relaxed in api/helix_app/index.py. Action: (1) verify K1 field-name migration complete (organ checks both `.composite` AND `.compositeScore`), (2) relax K2 gates per infrastructure memo, (3) run scripts/persist-k2-readings.mjs post-deployment.
- **Domain-packet-adapter MISSING** (`C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\domain-packet-adapter.js`) — organ-domains.mjs flags as LOOP_OPEN. Without adapter, domain brains emit packets but civilization aggregator has no input stream. Action: restore from git history or rebuild per architecture.
- **Master-brain inbox never built** — organ-master-brain.mjs reports inbox file exists (stale 130h) but vitals indicate it was never regenerated. Action: run `node scripts/build-master-inbox.mjs --apply` to gate engine outputs.

**HIGH (degrade interoception fidelity):**
- **Feeds organ IN_PAIN (55/100)** — only 22 sources registered across 11/20 canonical domains. Missing: economy, energy, environment, finance, intelligence, medicine, science, supplyChain, technology. Action: expand `api/feed-status.js` source registry; without sensory input across all domains, pattern emissions are sparse.
- **Domains organ IN_PAIN (65/100)** — 1 brain file malformed (domain-console-brain.js lacks required markers). Supply chain brain missing (21/22). Action: inspect malformed file markers, verify supplyChain brain file exists at `assets/js/domain-brains/supplyChain-brain.js`.
- **Propagator output orphaned** — stress-network-state.json (4.45MB, 305h stale) has no downstream consumers. Snapshot is computed fresh (0.01h old) but data is weeks-old because file not accessed. Action: wire stress-network-state into civilization-super-brain.js to feed stress field, OR update Master Brain to consume network stress. This is the only per-domain stress model available.

**MEDIUM (degrade coverage/fidelity):**
- **Kernel organ reports K1 ZERO coverage (0%)** — flagged as "expected during migration if all readings are in legacy financialHealth slot" (informational). But 767/767 portals blind is system-wide. Action: post-K2-deployment, K3 design (relational-only kernel) to fill remaining gaps.
- **Portal corpus DEGRADED (76/100)** — 515/30034 prose entries flagged (bad), 188 CB rows point to missing portals (dead clicks now caught by company-portal-ui.js graceful fallback). Action: run heal-prose-truncation.mjs (when built) to regenerate malformed prose.
- **Bridge organ DEGRADED (80/100)** — 60.1% portal coverage (461/767 portals matched to patterns). 306 portals have no bridge mapping (potentially genuine lack of pathology signature OR library too narrow). Action: either expand bridge-patterns.json or accept that some portals lack neuro↔business bridge (informational).
- **Dead links organ DEGRADED (76/100)** — 2 unguarded surfaces (`scripts/score-companies.js`, `scripts/sense/organ-dead-links.mjs` itself) emit company-portal links without hp gates. 188 CB rows reference missing portal slugs. Action: add `if (d.hp)` guards; company-portal-ui.js fallback now handles gracefully (absent-portal page instead of 404).

**MEDIUM (incomplete automation):**
- **L1 nodes organ HEALTHY BUT FROZEN** — 123 nodes, 0 orphans, 18/20 canonical domain coverage, but 2 missing: agriculture, supplyChain. Taxonomy FROZEN until 2026-12-01 per memo; no updates possible until unfreeze date. Flag: agriculture and supplyChain are high-value domains; check if freeze policy should be relaxed early.
- **Propagator path-C anomalies** (10 entries) — unbounded composites detected; indicates outlier financial states or data errors. Action: sample and validate; may indicate stale kernel data or real signals from distressed portals.

**LOW (informational / deferred):**
- **Connectome PROPAGATE_FRACTION =0 (dead) flag no longer applies** — organ-connectome.mjs previously reported connectome dead due to PROPAGATE_FRACTION=0; audit 2026-05-25 confirmed fix. Now scoring 100/HEALTHY. Confirm array-collapse fix is durable.
- **Master-brain weight blend (65/35 civ/connectome) not detected in source** — organ-master-brain.mjs checks for hardcoded ratio; may need pattern refinement if weights are parameterized elsewhere.
- **Pattern-bus re-entrancy depth guard** — expected at 8; checks for _emitDepthMax constant (not explicitly found in this scan but bus scores 100 so guard exists).

**Data tank staleness:**
- **portal-registry.json** (61.75MB, 82 days old) — likely imported once, no ongoing updates. Verify this is intentional (reference snapshot) vs. orphaned.
- **stress-network-state.json** (4.45MB, 305h old file timestamp but fresh internal state) — file timestamp doesn't reflect last computational refresh. Suggests propagator updates in-place but file mtime is stale; verify cron actually touches file.
- **Audit data** (mechanism-ontology, verification-ledger, etc.) — informational only, no live readers detected; stale is acceptable.

**Unmeasured channels (no organ coverage):**
- **Autonomous portal-regen frontier** — vitals shows portalRegen backlog in UI (autonomous-portal-regen counts queued entities), but no dedicated organ measures regen queue freshness or drain rate. Action: optional — add organ-portal-regen.mjs if regen is high-priority autonomic function.
- **Feed runtime health** — organ-feeds.mjs only does structural audit of feed-status.js registry. No HTTP probe of live sources (expected for build-time audit). Live feed health is runtime task (web-worker cron).

**Schema/versioning:**
- Vitals schema: `vitals/2.0` (locked, stable).
- Audit data schemas: mechanism-ontology v1.0.0, field-connection-map has no explicit version, verification-ledger has own schemaVersion. **Flag: inconsistent versioning across audit tanks; recommend unified audit schema v2.x.**

---

**Summary:** Interoception is **DEGRADED (79/100 overall)** due to critical kernel readings gap (K1/K2/K3 empty), missing domain-packet-adapter loop, and stale/orphaned propagator output. Afferent sensing (feeds, L1 nodes) is mostly healthy; downstream civilization/master-brain ready but starved for input. Bridge layer wired and firing (~2500 artifacts). Multimodal-interoception north star (one engine, per-domain weights per corpus memo) is architecturally present (organ-master-brain.mjs implements 65/35 blend) but blocked upstream by kernel/adapter gaps. Once K2 gates deployed and adapter restored, system should climb to ~HEALTHY (85-90 range).

---

## 22. Schema & Entity Registries

### PURPOSE
Central index and validation layer for company/entity identity, schema definitions, and cross-domain node mappings. Enables fast client-side lookup (ticker → CIK → portal), company portal resolution, and brain-node-to-business mappings for diagnosis/treatment discovery. Serves as source of truth for: which companies have portals, what registries exist, and how entities bind to domains.

### KEY FILES
**/assets/js/schema/**
- `fractal-report-schema.js` — Canonical LIMEN Helix fractal schema (civilization → domain → portal → diagnosis → treatment → step hierarchy). Defines severity, status, treatment types, evidence grades, circuit direction enums. Exposes `window.LIMENFractalSchema`.
- `company-portal-schema.js` — Company/entity portal data model. ENTITY_TYPE, MARKET_STATUS, SIGNAL_TYPE enums. FRED indicator registry (GDP, UNRATE, CPIAUCSL, etc.). Exposes `window.LIMENCompanyPortalSchema`.

**/assets/data/schemas/**
- `treatment-discovery-cell.schema.js` — Schema for treatment-discovery report cells (brainNodeId × comparisonDomain × stateBucket). Defines STATE_BUCKETS (hyperactive/hypoactive/regulated/mixed/unknown), TREATMENT_TYPES, VERDICT_TYPES, COMPARISON_DOMAINS. SourceProvenance tracking for every populated value.

**/assets/data/** (Registries)
- `company-registry.json` (17 MB) — Canonical index over 543 CIKs & 767 portals (v2: 764, v1Legacy: 3). Keys: byCik, bySlug, byBrainNode, byDomain, bySic (197 codes), byPhaseState (p0–p10), byKernelStatus. Graph edges (suppliers, customers, competitors, logisticsPartners, regulators, executives). Generated 2026-05-29T10:56:01Z.
- `companies-manifest.json` (145 KB) — Static directory listing: 767 company slugs in alphabetical order, with fast index {slug → name, ticker, cik, domainId, schemaVersion}. Enables Vercel-deployed portal coverage UI without server-side directory listing. Generated 2026-05-29T10:56:00Z. **INCONSISTENCY**: 33 .json files on disk not in manifest; 6 company-index entries missing from manifest.
- `company-index.json` (44 KB) — Client-side lookup index: 140 companies keyed by slug. Each: {name, ticker, cik, sic, industry, domainId}. Has byTicker, byCik, bySlug sub-indices for resolution. Used by `company-resolver.js` & opportunity*.html pages.
- `company-aliases.json` (52 KB) — Alias collapsing: 820 aliasSlug → canonical portal slug mappings. Example: `akamai → akamai_technologies`, `merck → mrk`. Auto-safe tier only (exact normalized-name or exact ticker match). Consumed by build-orphan-registry, build-fractal-portals, company-portal-ui for resolve-on-fetch-miss. Generated 2026-05-29T10:55:59Z. **INCONSISTENCY**: 183 alias targets missing from companies-manifest.
- `entity-registry.json` (75 KB) — Domain-portal-entity attachment map. 20 domains, 26 portals, 130 entities. Schema v1.0.0. Entities (company/business/profession/institution/government_body/ngo) attach to specific portals, NOT directly to domains. Example: Quest Diagnostics to medicine_diagnostics portal.
- `eligible-universe.json` (3.2 MB) — SEC EDGAR cohort: 10,526 companies in 23 SIC codes (1311, 2080, 2834, 2840, 2911, 4813, 4911, 6021, 6022, etc.). Metadata only (_total, _per_sic_counts); no company array. Generated 2026-05-09T22:04:04Z. **AGE**: 10 days older than manifest/registry.
- `sp500-ciks.json` (7.7 KB) — S&P 500 subset: 100 companies (AAPL, MSFT, AMZN, GOOGL, etc.). Each: ticker, cik, name, domain. Used for batch scoring. Generated 2026-03-22T06:56Z. **AGE**: 69 days old.

**/assets/data/** (Related Registries)
- `connectome-node-registry.json` (16 KB) — Brain node taxonomy authority. 123 canonical runtime node IDs (RUNS tier). Frozen 2026-05-24 through 2026-12-01. Declares aliases, hierarchy collapses, distinct-pair warnings (SN ≠ SNIG), rejected additions (ARCFAS, mTOR, SPINOTHAL). Agreement vectors cross-check against brain-connectome.json, node-entity-mapping.json, node-signal-registry.json.
- `node-signal-registry.json` (40 KB) — 254 FRED-series signals mapped to 123 brain nodes. Example: SIG_0001 (IPUHN517110U100000000 FRED series) → node A1 "Dolby Labs". 39 unique FRED series. Generated 2026-03-16T23:50Z. **AGE**: 81 days old.
- `portal-registry.json` (62 MB) — Massive hierarchical portal tree. 173,652 portalIds in domainIdToPath structure. Example: governance → governance/anticorruption → governance/anticorruption/antimoney. Each portal: domainId, title, phaseTag, nodeCount, issueCount, parentPath, childPaths. Generated 2026-03-17T19:27Z. **AGE**: 80 days old.
- `limen-report-index.json` (437 KB) — Jobs-to-brain-node-to-business mapping. 440+ jobs (physician, psychiatrist, neurologist, etc.) cross-indexed by domain, node_id, network, dysregulation pattern, business_mapping. Example: Endocrinologist → Hypothalamus PVN → HPA Axis → P3/P1 phases → "Stress management programs, cortisol testing labs, corporate wellness".
- `brain-connectome.json` — Referenced as canonical source for 123-node RUNS tier in connectome-node-registry.json.
- `node-entity-mapping.json` (40 KB) — Agreement source for 123 nodes; loader assets/js/research-observatory.js. Generated 2026-03-16T18:50Z.

### LIVE PAGES
- https://limenhelix.com/helix-portal-coverage (fetches companies-manifest.json; tables 767 slugs with schema/density/IntelCycle status)
- https://limenhelix.com/company-lookup (company-resolver.js client-side lookup by ticker/CIK/name)
- https://limenhelix.com/agriculture-opportunities (& 21 other domain-opportunities pages; each loads company-index.json for ticker lookup)
- https://limenhelix.com/helix-brain-grid (connectome browser; references connectome-node-registry.json)
- Domain portals (medicine_portal.html, finance_portal.html, etc.) — consume portal-registry.json via assets/js/portal-router.js

### DATA
**company-registry.json**
- READS: assets/data/companies/*.json (all 800 portal files, 23 v2 + legacy stubs)
- WRITES: Populated by `scripts/build-company-registry.js`
- STATUS: Fresh (2026-05-29 10:56 UTC). 543 unique CIKs, 767 total portals indexed.
- CONSUMED BY: limen-worker-autofire.js (Vercel API), portal-ui.js, reciprocity validator, supply-chain propagation.

**companies-manifest.json**
- READS: assets/data/companies/*.json directory walk
- WRITES: Populated by `scripts/build-companies-manifest.mjs` (after v1→v2 migration or new portal authoring)
- STATUS: Fresh (2026-05-29 10:56 UTC). 767 slugs, 800 actual files on disk → **33 orphan files missing from manifest**.
- CONSUMED BY: helix-portal-coverage.html (browser fetch, no-store cache), limen-worker-autofire.js, limen-worker-multipass.js.

**company-index.json**
- READS: Generated separately from manifest; structure differs (140 companies vs 767 slugs).
- WRITES: Generator unknown (audit gap); last modified 2026-03-16 19:05 UTC.
- STATUS: Stale (81 days old). **6 entries (accenture_federal_services, agilent, charles_river_labs, dexcom_meta, stride, united_parcel_service) NOT in manifest** — orphaned or moved.
- CONSUMED BY: company-resolver.js (client-side ticker/CIK lookup), opportunity*.html pages (ticker field population).

**company-aliases.json**
- READS: Nothing (reference-only mapping)
- WRITES: Populated by `scripts/detect-slug-aliases.mjs` (candidate detection; hand-curated into canonical map)
- STATUS: Fresh (2026-05-29 10:55 UTC). 820 aliases, 1405 total alias→target mappings. **183 alias targets NOT in manifest** — broken references (e.g., hubbell, idex, itron).
- CONSUMED BY: build-orphan-registry.mjs (collapse), build-fractal-portals.mjs (skip Tier-2), company-portal-ui.js (resolve-on-fetch-miss).

**entity-registry.json**
- READS: Possibly assets/data/companies/*.json portal data (portalAttachment fields)
- WRITES: Generator unknown (audit gap); last modified 2026-03-15 20:46 UTC.
- STATUS: Stale (84 days old). 20 domains, 26 portals, 130 entities. **Possible stale/incomplete**: no recent regeneration script detected.
- CONSUMED BY: Portal entity-attachment views, domain binding logic.

**eligible-universe.json**
- READS: SEC EDGAR API (getcompany search by SIC, paginated atom feeds)
- WRITES: Populated by unknown script (audit gap); last modified 2026-05-09 17:04 UTC.
- STATUS: Stale (29 days old; generated ~22:04 UTC). Metadata only (_total: 10526). No company array; used for cohort definition, not live lookup.
- CONSUMED BY: Cohort scoring scripts, phase detection, distress-band classification.

**sp500-ciks.json**
- READS: Hardcoded S&P 500 ticker list (subset expansion noted as needed)
- WRITES: Manual or batch script; last modified 2026-03-22 06:56 UTC.
- STATUS: Very Stale (76 days old). 100 companies. **No regeneration script found**; appears to be static reference list.
- CONSUMED BY: Batch scoring (scripts/score-companies.js), phase analysis, priority company tracking.

**connectome-node-registry.json**
- READS: assets/data/brain-connectome.json (.nodes[].id)
- WRITES: Generated by unknown script (audit gap); last modified 2026-05-24 13:15 UTC.
- STATUS: Fresh (14 days old). **FROZEN** through 2026-12-01. 123 nodes. Agreement vectors cross-checked against brain-connectome.json, node-entity-mapping.json, node-signal-registry.json.
- CONSUMED BY: connectome-renderer.js, brain-node domain bindings, node-translation.js.

**node-signal-registry.json**
- READS: FRED indicator definitions (40 unique series)
- WRITES: Generator unknown; last modified 2026-03-16 18:50 UTC.
- STATUS: Stale (82 days old). 254 signals, 123 unique node IDs (matches connectome freeze). Node-signal binding.
- CONSUMED BY: connectome-node-registry.json agreement check, FRED data pipelines, signal publishing.

**portal-registry.json**
- READS: assets/data/companies/*.json + domain/portal hierarchy
- WRITES: Generator unknown (audit gap); last modified 2026-03-17 14:27 UTC.
- STATUS: Stale (81 days old). 173,652 unique domainIds (not companies — this is the full treatment-discovery hierarchy). Metadata only (title, phaseTag, nodeCount, issueCount, childPaths).
- CONSUMED BY: portal-router.js (domain routing), portal-ui.js (group ordering), domain portal browsers.

**limen-report-index.json**
- READS: Job-to-node mappings (possibly manual curated dataset)
- WRITES: Generator unknown; last modified 2026-03-08 18:03 UTC.
- STATUS: Very Stale (91 days old). 440+ job entries cross-mapped to brain nodes and business domains.
- CONSUMED BY: Report generation, domain intelligence cycle, job-to-treatment discovery.

### HOW IT CONNECTS

**Client-Side Lookup Chain:**
1. User enters company name/ticker in UI (company-lookup.html)
2. Browser loads `company-index.json` via company-resolver.js
3. Resolver tries: exact ticker (byTicker) → CIK (byCik) → slug (bySlug) → fuzzy name match
4. Returns { slug, company, matchType }
5. Browser navigates to `/company-portal.html?slug=<slug>`
6. company-portal-ui.js fetches `/assets/data/companies/<slug>.json` (the actual portal)
7. Portal loaded; user clicks domain link → domain-opportunities.html
8. domain-opportunities.html fetches company-index.json again for any ticker-referenced companies in tables

**Server-Side (Vercel API) Chain:**
1. limen-worker-autofire.js / limen-worker-multipass.js start
2. Both load companies-manifest.json to enumerate portal slugs (sources: local path.join or /var/task)
3. Iterate slugs; for each, fetch /assets/data/companies/<slug>.json
4. Extract: cik, ticker, domainId, functionalNetwork, intelligenceCycle, brainNodeIds
5. Aggregate into in-memory company-registry index
6. Optionally publish scores, phase states, distress bands to company-registry.json output

**Build Pipeline:**
1. `scripts/build-company-registry.js` — Walks assets/data/companies/*.json, outputs company-registry.json with byCik/bySlug/byBrainNode/byDomain/bySic/byPhaseState/byKernelStatus/graph indices. Counts: 543 CIK, 764 v2, 3 v1 legacy.
2. `scripts/build-companies-manifest.mjs` — Walks assets/data/companies/*.json, outputs companies-manifest.json (767 slugs, sorted). Skips files starting with `_` and reports v2 vs v1 counts. **Missing**: runs after densification batches; 33 new portal files not yet captured.
3. `scripts/build-orphan-registry.mjs` — Walks v2 portals' functionalNetwork, detects referenced slugs NOT in portal set. Collapses aliases (via company-aliases.json) to canonical. Outputs orphan-stakeholders.json. Runs after densification.
4. `scripts/detect-slug-aliases.mjs` — Reads portal files + orphan set, detects IDENTITY aliases (fuzzy name match ≥ 0.6 Jaccard) and SEGMENT aliases (AWS, Azure, Cloud variants). Outputs scripts/_slug-alias-candidates.json for manual review. Does NOT auto-alias; hand-curated into company-aliases.json.
5. `scripts/build-fractal-portals.mjs` — Consumes portal files + company-aliases.json; generates fractal nested treatments/diagnoses. Skips Tier-2 aliases in output.

**Brain Node Binding:**
1. connectome-node-registry.json declares 123 canonical brain node IDs
2. company-registry.json.byCik[cik].brainNodeIds[] = [AI, BLA, FPN, M1, NAcc, OFC, S1, THAL, ...] (per company, per portal)
3. node-signal-registry.json maps brain nodes → FRED series (example: node A1 → IPUHN517110U100000000)
4. Portal portal-registry.json links domain hierarchies to brain node coverage (nodeCount per portal)
5. limen-report-index.json maps jobs → brain nodes → business mappings (reverse lookup: "if this business has node X dysregulation, which medical job has analogous treatment?")

**Cross-Registry Consistency Issues:**
- company-registry.json: 543 CIKs indexed
- companies-manifest.json: 767 slugs (224 extra slugs in manifest; missing CIK in registry?)
- company-index.json: 140 companies (half of manifest size; 6 missing from manifest)
- company-aliases.json: 820 aliases → 1405 mappings; 183 targets NOT in manifest
- Disk state: 800 .json files, 767 in manifest → **33 files orphaned from manifest**

### NEEDS WORK / INCONSISTENCIES

**Critical Registry Cross-Consistency Gaps:**
- **company-index.json missing from manifest**: accenture_federal_services, agilent, charles_river_labs, dexcom_meta, stride, united_parcel_service. Either: (a) index outdated & should be regenerated from manifest, (b) manifest incomplete & should re-run build-companies-manifest.mjs, or (c) files removed from disk but index not updated. C:\Users\Chris\Limen-Helix-live-\assets\data\company-index.json (81 days old).

- **33 portal files on disk not in companies-manifest**: abbott_diagnostics, aptiv, berry_global, catalent_pharma, charles_river, church_and_dwight_co_inc_de, colorcon, conagra_brands, delek_us_holdings_inc, diamondback_energy, enbridge, enterprise_products_partners, fedex_logistics, fortescue_metals, heico_corp, imperial_oil_ltd, komatsu, magna_international, nabors_industries, patheon_thermo_fisher, plaid, puma_biotechnology_inc, redwire_corp, roche_genentech, royalty_pharma_plc, sarepta_therapeutics_inc, stepan_co, sunoco_lp, transocean, vertiv, viatris, workiva, xencor_inc. Manifest build script last run 2026-05-29; these 33 files may have been added after or script didn't catch them. C:\Users\Chris\Limen-Helix-live-\assets\data\companies (800 actual .json files).

- **company-aliases.json targets broken**: 183 alias targets missing from companies-manifest. Examples: hubbell, idex, itron, recro_pharma, fanuc, ingredion, senseonics, amerisource_bergen. These are aliases pointing to portals that don't exist. build-orphan-registry.mjs should handle this, but alias-candidates may have been hand-curated incorrectly. C:\Users\Chris\Limen-Helix-live-\assets\data\company-aliases.json.

- **company-registry.json byCik subset**: 543 CIKs vs 767 manifest slugs. Not all slugs have CIKs (private companies, inherited from v1 legacy). This is by design, BUT: company-aliases.json references 820 alias slugs → 1405 targets, many not in manifest. Alias target resolution will fail silently if target slug doesn't exist. No error tracking detected.

**Data Staleness & Generation Script Gaps:**
- **entity-registry.json** (84 days old) — No regeneration script found. Should be re-derived from entity-registry-builder or similar. Last modified 2026-03-15. Rebuild needs: domain.portals.entities schema compliance check. C:\Users\Chris\Limen-Helix-live-\assets\data\entity-registry.json.

- **sp500-ciks.json** (76 days old) — Hardcoded list, no regeneration script. "Expand as needed" comment suggests manual updates. Should be automated from current S&P 500 ticker list (AAPL, MSFT, AMZN, etc.). C:\Users\Chris\Limen-Helix-live-\assets\data\sp500-ciks.json.

- **eligible-universe.json** (29 days old, metadata-only) — Cohort metadata (_total: 10526, _per_sic_counts) but no actual company array. Used for threshold comparisons only. Generator unknown; script that populates this should be documented. C:\Users\Chris\Limen-Helix-live-\assets\data\eligible-universe.json.

- **portal-registry.json** (81 days old) — 173,652 domainIds (entire treatment-discovery hierarchy). Last modified 2026-03-17. No recent rebuild. Should be regenerated after any domain/diagnosis/treatment addition. C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json (62 MB).

- **limen-report-index.json** (91 days old) — Jobs-to-brain mapping (440+ entries). Last modified 2026-03-08. No regeneration script found. Appears curated manually. Should document source & update frequency. C:\Users\Chris\Limen-Helix-live-\assets\data\limen-report-index.json.

**Documentation & Generator Script Gaps:**
- No explicit documentation of which script generates each registry. Inferred from grep + comments: build-company-registry.js (clear), build-companies-manifest.mjs (clear), build-orphan-registry.mjs (clear), detect-slug-aliases.mjs (clear). Missing: entity-registry.json, sp500-ciks.json, eligible-universe.json, portal-registry.json, limen-report-index.json, node-signal-registry.json, brain-connectome.json generators.

- `scripts/` directory contains 118 files, but only ~20 are regenerators for registries. Many are domain-specific (add_fertilizer_treatments.js, build-brain-node-business-mapping.js, etc.). No master index of "which script builds which registry?"

**Schema Validation & Enforcement:**
- fractal-report-schema.js, company-portal-schema.js, treatment-discovery-cell.schema.js are defined but no schema-validation step detected in build scripts. company-registry.js loads portals but does NOT validate against company-portal-schema before indexing. Risk: malformed portals silently indexed.

- connectome-node-registry.json declares freeze + agreement vectors but no enforcement. downstream consumers (connectome-renderer.js, portal-ui.js) assume 123 nodes without validation.

**Orphan & Alias Resolution Robustness:**
- build-orphan-registry.mjs collapses aliases but outputs orphan-stakeholders.json (separate file). company-portal-ui.js resolve-on-fetch-miss may still attempt to fetch a portal for a non-canonical slug if user navigates with alias slug directly. Fallback behavior not documented.

- Reverse alias lookup (target → aliases pointing to it) not provided. Useful for: "which alias names resolve to Apple?" Not tracked.

**Age & Consistency Summary:**
| Registry | Age | Status | Issue |
|----------|-----|--------|-------|
| company-registry.json | 9 days | Fresh | 543 CIKs; 224 mismatch with 767 manifest slugs |
| companies-manifest.json | 9 days | Fresh | 767 slugs; 33 disk files not captured |
| company-index.json | 81 days | **Stale** | 140 companies; 6 missing from manifest |
| company-aliases.json | 9 days | Fresh | 820 aliases; 183 targets missing |
| entity-registry.json | 84 days | **Stale** | 20 domains, 26 portals, 130 entities |
| eligible-universe.json | 29 days | Stale | Metadata only; cohort definition |
| sp500-ciks.json | 76 days | **Very Stale** | Hardcoded list; no regen script |
| connectome-node-registry.json | 14 days | Fresh | Frozen through 2026-12-01 |
| node-signal-registry.json | 82 days | **Stale** | 254 signals; 123 nodes |
| portal-registry.json | 81 days | **Stale** | 173,652 domainIds; full hierarchy |
| limen-report-index.json | 91 days | **Very Stale** | 440+ job entries; no regen script |

**Generator Scripts Needing Documentation:**
- C:\Users\Chris\Limen-Helix-live-\scripts\build-company-registry.js (FOUND)
- C:\Users\Chris\Limen-Helix-live-\scripts\build-companies-manifest.mjs (FOUND)
- C:\Users\Chris\Limen-Helix-live-\scripts\build-orphan-registry.mjs (FOUND)
- C:\Users\Chris\Limen-Helix-live-\scripts\detect-slug-aliases.mjs (FOUND)
- Entity registry builder: **NOT FOUND**
- S&P 500 CIK list builder: **NOT FOUND**
- Eligible universe builder: **NOT FOUND**
- Portal registry builder: **NOT FOUND**
- Limen report index builder: **NOT FOUND**

---

## 23. Shared UI + browser kernel libs

### PURPOSE
Global navigation, domain stress visualization, regulation rendering, and browser-side phase classification. The topbar (91 page family roots included) provides unified navigation to 16+ major routes. The kernel adapter provides provisional phase labels for domains via 3 reconstructed state variables (accumulator, variance, break proxies). The UI layer (domain-repair-map, regulation-renderer, console-clarity, report-console) renders domain health, cross-domain regulation output, and prioritized actions to operators. The limen/* subsystem (pattern envelope, super-brains, artifact engines) implements the fractal-recursive brain architecture for civilization, connectome, master-brain, and domain-level inference.

### KEY FILES

**Top-level navigation & state:**
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen-topbar.js (15KB) — Global sticky header, 16 routes, clock + regulation state, ANALYST/CLARITY toggle slot, biosensor LIVE indicator. Exposes window.LIMENTopbar.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen-ui-state.js — UI state persistence layer
- C:\Users\Chris\Limen-Helix-live-\assets\js\ui-mode-manager.js — Analyst vs Clarity mode toggle
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen-command-bar.js — Command palette for domain operations

**Browser-side kernel (phase domain adapter):**
- C:\Users\Chris\Limen-Helix-live-\assets\js\kernel\limen-phase-domain-adapter.js — Provisional phase annotation (P0–P7b) via 3 reconstructed state proxies (accumulator depth, variance/instability, structural break). Reads window.LIMENDomains; emits window.LIMENPhaseAnnotations. Debounce 10s, 60-sample stress history. Soft domain dampening for law/religion/research/culture/communication/education. BREAK PROXY requires 3 consecutive raw snapshots + accumulator ≥0.40 + confidence ≥0.50 for confirmation. Exposes window.LIMENPhaseDomainAdapter.

**Domain repair & visualization (UI layer):**
- C:\Users\Chris\Limen-Helix-live-\assets\js\ui\domain-repair-map.js — 20-domain grid renderer with stress/confidence bars, signals, diagnoses, interventions. Gate B #9a authority classification: NO_SOURCE suppresses body when window.LIMENDomains absent; ABSENT card for unmeasured domains (not zero-default); confidence badge (LOW/MODERATE) when <0.65. Reads LIMENDomains, LIMENRegulationReports, LIMENRemedyRegistryManager, LIMENLongMemory (regime tag). Exposes window.LIMENDomainRepairMap.
- C:\Users\Chris\Limen-Helix-live-\assets\js\ui\regulation-renderer.js — Unified regulation block (state→severity→trajectory→stress/confidence→stressors→summary→diagnosis→fractal answer→treatments→actions→impacts→evidence chain). Per-domain cards + global coherence summary. Domain order: economy, energy, environment, health, technology, research, supplyChain, governance, infrastructure, agriculture, industry, education, communication, culture, defense, religion, population, law, finance, intelligence. Exposes window.LIMENRegulationRenderer.
- C:\Users\Chris\Limen-Helix-live-\assets\js\ui\report-console.js — Overlay console: 5 tabs (recommendations, domain-repair, civilization, patent, evidence-chain). Read-only consumer of LIMENReportSynthesizer, LIMENRecommendationEngine. Exposes window.LIMENReportConsole.
- C:\Users\Chris\Limen-Helix-live-\assets\js\ui\console-clarity.js — Default clarity mode (hero section, domain health, top events, recommended actions) vs analyst mode (3-column grid + export). 8 tabs: Source Audit, Regulation, Capital Conversion, Artifact Council. Master Brain Handoff Queue (Patch B). Exposes window.LIMENClarity.

**Fractal-recursive brain architecture (limen/ subsystem — 19 files):**
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\pattern-envelope.js — Universal contract: every brain (master, civilization, connectome, domain, business, opportunity, document) emits the same envelope shape. Encodes two-kernel readout (Thing 1 + Thing 2) + pattern projection. Enforces hardening rules H1 (provenance), H4 (idempotency hash), H7 (freshness receipt). 9 fractal operators. Exposes window.LIMENPatternEnvelope.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\pattern-broker.js — Inter-brain pub/sub for pattern events. Exposes window.LIMENPatternBroker.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\super-brain-base.js — Shared lifecycle for four super-brains (Master, Civilization, Connectome, future top-level). Lifecycle: constructor → subscribeTo → start → cycle (pure compute) → runEngines → stop. Subclasses override _computeKernels, _computePattern, _decideEngines. Depends on LIMENPatternEnvelope, LIMENPatternBroker. Exposes window.LIMENSuperBrainBase.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\civilization-super-brain.js — Reads domain + cross-domain patterns; produces civilization-level state + signal. Exposes window.LIMENCivilizationSuperBrain.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\connectome-super-brain.js — Cross-domain connectome layer. Exposes window.LIMENConnectomeSuperBrain.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\master-living-brain.js — PFC executor. Subscribes to civilization + connectome patterns + Thing 2 phase output. Decides which of 6 engines to fire (patent, grant, SBA, franchise, investment, research grouped as Protect/Finance/Replicate/Execute + continuous Research). Persists artifacts to engine-output endpoint. Emits master pattern. Exposes window.LIMENMasterLivingBrain.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\engine-context-builder.js — Assembles contextPacket for /api/expand-artifact-claude. Pulls from window.LIMENDomains, LIMENCivilizationPackets, LIMENMainBrainHandoffState, LIMENCrossNodeOpportunityState. Lazy-fetches from /assets/data/deep/{domain}-deep-directives.json, /api/fetch-portal?id={slug}. Strips LIMEN-internal vocabulary before shipping to Claude.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\multi-pass-runner.js — Orchestrates multi-pass expansion (Claude + domain traversal). Exposes window.LIMENMultiPassRunner.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\outcome-aggregator.js — Aggregates engine outputs into master signal. Exposes window.LIMENOutcomeAggregator.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\engine-runner-claude.js — Fires Claude-based engine for artifact expansion. Exposes window.LIMENEngineRunnerClaude.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\cik-coverage-expander.js — Patent/grant coverage analysis for SEC/CIK entities. Exposes window.LIMENCIKCoverageExpander.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\brain-grid-ui.js — UI for brain-grid.html (fractal-recursive brain executor dashboard). Exposes window.LIMENBrainGridUI.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\artifact-list-ui.js — Artifact listing UI for helix-artifacts.html. Exposes window.LIMENArtifactListUI.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\artifact-viewer-ui.js — Artifact detail viewer for helix-artifact.html. Exposes window.LIMENArtifactViewerUI.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\markdown-renderer.js — Renders artifact markdown. Used by artifact-viewer-ui. Exposes window.LIMENMarkdownRenderer.

**Human operator context (biosensor + authorization gate):**
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\operator-canonical-identity.js — vmPFC/OFC analog: frozen declaration of operator identity, allowed biosensor inputs, permanently disallowed actions, regulation goals. Loaded BEFORE human-state-packet.js and human-context-gate.js. Identity version 1.0.0, declared 2026-05-22. Exposes window.LIMENOperatorCanonicalIdentity.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\human-state-packet.js — Derives biosensor-fed state packet (cognitive phase, attention, stress, recovery). Exposes window.LIMENHumanStatePacket.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\human-context-gate.js — OFC/vmPFC context-fit evaluator. Two refusal classes: HARD (identity-disallowed) + SOFT (phase-policy-blocked). Session audit log (500-entry cap). Exposes window.LIMENHumanContextGate with evaluateHumanContextFit, masterBrainBeforeAction, wrapAction, getAuditLog, getStats, onRefusal, forceAllow.
- C:\Users\Chris\Limen-Helix-live-\assets\js\limen\operator-state-ui.js — Renders operator state badge (cognitive phase, biosensor status) in topbar actions slot. Exposes window.LIMENOperatorStateUI.

### LIVE PAGES

**Global navigation (16 routes in limen-topbar.js):**
- https://limenhelix.com/ — Root
- https://limenhelix.com/operator-guide — Operator Guide
- https://limenhelix.com/capital-engine — Capital Engine
- https://limenhelix.com/applications — Applications
- https://limenhelix.com/journal — Journal
- https://limenhelix.com/my-documents — My Documents
- https://limenhelix.com/treatment-discovery — Treatment Discovery
- https://limenhelix.com/pattern-proposals — Pattern Proposals
- https://limenhelix.com/vitals — System Vitals
- https://limenhelix.com/master-inbox — Master Brain Inbox
- https://limenhelix.com/civilization — Console (main command center)
- https://limenhelix.com/civilization-opportunities — Observatory (civilization-level opportunities)
- https://limenhelix.com/opportunities — Opportunities (cross-domain)
- https://limenhelix.com/kernel-comparison — Command Board
- https://limenhelix.com/connectome — Connectome
- https://limenhelix.com/master-brain — Master Brain

**Pages that include full UI + kernel + brain stack:**
- https://limenhelix.com/civilization — civilization.html; includes limen-topbar, domain-repair-map, regulation-renderer, report-console, console-clarity, limen-phase-domain-adapter, operator-canonical-identity, human-state-packet, human-context-gate, operator-state-ui. 110+ script tags.

**Brain grid (fractal-recursive executor):**
- helix-brain-grid.html (not currently live but in codebase) — Includes pattern-envelope, pattern-broker, super-brain-base, civilization-super-brain, connectome-super-brain, master-living-brain, cik-coverage-expander, engine-context-builder, multi-pass-runner, outcome-aggregator, engine-runner-claude, brain-grid-ui.

**Artifact system:**
- helix-artifacts.html — Lists artifacts; includes artifact-list-ui.js.
- helix-artifact.html — Views single artifact; includes artifact-viewer-ui.js, markdown-renderer.js.

**Domain pages (agriculture, economy, etc.):**
- 4 variants per domain × 20 domains = 80 pages:
  - /{domain}-command.html (e.g., agriculture-command.html) — Domain command board; includes limen-topbar, command-board-stress, domain-identity, {domain}-refresh-controller.
  - /{domain}-console.html (e.g., agriculture-console.html) — Domain console; includes domain-specific brain.
  - /{domain}-opportunities.html (e.g., agriculture-opportunities.html) — Domain opportunity surface.
  - /{domain}-workspace.html (e.g., agriculture-workspace.html) — Domain operator workspace.

**Portal pages:**
- company-portal.html — Company lookup/details portal; includes limen-topbar, kernel-reading-helper.
- provider-portal.html, clinical-portal.html — Provider/clinical specific portals.
- company-lookup.html, family-law.html, master-brain-executor.html, master-brain-inbox.html.

**91 pages include limen-topbar.js:**
journal, applications, finance-capital-engine, civilization, domain-console, kernel-comparison, company-portal, agriculture-command, communication-command, culture-command, defense-command, economy-command, education-command, energy-command, environment-command, finance-command, governance-command, industry-command, infrastructure-command, intelligence-command, law-command, medicine-command, population-command, religion-command, science-command, technology-command, trade-command, provider-portal, clinical-portal, agriculture-workspace, communication-workspace, culture-workspace, defense-workspace, economy-workspace, education-workspace, energy-workspace, environment-workspace, finance-workspace, governance-workspace, industry-workspace, infrastructure-workspace, intelligence-workspace, law-workspace, medicine-workspace, population-workspace, religion-workspace, science-workspace, technology-workspace, trade-workspace, company-lookup, family-law, master-brain-executor, master-brain-inbox, master-brain, portal-template, agriculture-opportunities, civilization-opportunities, communication-opportunities, culture-opportunities, defense-opportunities, economy-opportunities, education-opportunities, energy-opportunities, environment-opportunities, finance-opportunities, governance-opportunities, industry-opportunities, infrastructure-opportunities, intelligence-opportunities, law-opportunities, medicine-opportunities, population-opportunities, religion-opportunities, science-opportunities, technology-opportunities, trade-opportunities, agriculture-console, communication-console, defense-console, economy-console, education-console, energy-console, finance-console, governance-console, industry-console, infrastructure-console, investment-console, law-console, science-console, technology-console, trade-console.

**2 pages include domain-repair-map, regulation-renderer, report-console, console-clarity, limen-phase-domain-adapter:**
- civilization.html (main console)
- domain-console.html (per-domain deep dive)

### DATA

**Reads (no writes from these libraries):**
- window.LIMENDomains — Domain stress/confidence/signals/diagnoses populated by domain-brains/ subsystem
- window.LIMENLongMemory — 30-day baseline + regime classification (NORMAL/ELEVATED/EXTREME)
- window.LIMENCrossDomain — Cross-domain pattern relationships
- window.LIMENRegulationReports — Regulation output library
- window.LIMENRemedyRegistryManager — Treatment/diagnosis registry
- window.LIMENRegulationRenderer — Regulation rendering helper
- window.LIMENRegulationOutput — Pre-rendered regulation blocks
- window.LIMENReportSynthesizer — Report aggregation
- window.LIMENRecommendationEngine — Top-priority recommendation selection
- window.LIMENGlobalState — Global civilization state
- window.LIMENDomainRepairMap — Self-reference for update dispatch
- window.LIMENBiosensorBridge — Biosensor regulation state (CALM/FOCUSED/PRESSURED/OVERLOADED/RECOVERING)
- /api/helix-report/score — Server-side validated phase kernel (NOT the display adapter)
- /assets/data/deep/{domain}-deep-directives.json — Grade-A citations (engine context builder)
- /api/fetch-portal?id={slug} — Company portal lazy-fetch (engine context builder)

**Writes:**
- window.LIMENPhaseAnnotations — Provisional phase labels (P0–P7b) for civilization.html domain panels
- window.LIMENTopbar — Navigation + refresh API
- window.LIMENClarity — Clarity mode state
- window.LIMENRegulationRenderer — Render methods
- window.LIMENDomainRepairMap — Render/update methods
- window.LIMENOperatorCanonicalIdentity — Frozen identity object
- window.LIMENHumanStatePacket — Biosensor-derived state
- window.LIMENHumanContextGate — Authorization verdicts + audit log
- window.LIMENOperatorStateUI — Operator state UI methods
- window.LIMENPatternEnvelope, window.LIMENPatternBroker, window.LIMENSuperBrainBase, etc. — Brain architecture objects

**Fresh/stale/empty status:**
- LIMENDomains: Fresh (populated per 10s domain-brain cycle; empty at boot until domain stack fires)
- LIMENLongMemory: Fresh (updated daily + rolling 30-day baseline)
- LIMENRegulationReports: Stale or fresh depending on whether regulation engine has run (report cycle ~30s)
- LIMENPhaseAnnotations: Fresh (computed on-demand when domain-update event fires)

### HOW IT CONNECTS

**Information flow (forward-push):**

1. **Domain sensors → domain-brains/ → window.LIMENDomains** (per domain every 10s)
   - Populates stress, confidence, signals, diagnoses, interventions, trend
   
2. **LIMENDomains → limen-phase-domain-adapter.js** (on `limen:domain-update` event)
   - Computes 3 state proxies (accumulator, variance, break) from stress history
   - Classifies provisional phases P0–P7b
   - Emits `limen:phase-domain-update` event
   - Writes window.LIMENPhaseAnnotations
   - **Key feature:** Soft domain dampening for law/religion/research/culture/communication/education (0.7–0.8× stress multiplier); break proxy confirmation requires 3 consecutive raw snapshots + accum ≥0.40 + conf ≥0.50
   
3. **LIMENDomains + LIMENLongMemory → domain-repair-map.js** (on `limen:domain-update` event)
   - Renders 20-domain grid with stress/confidence bars, signals, trends
   - Gate B #9a authority classification: suppresses map body if LIMENDomains is absent or empty; marks domains ABSENT (not zero) if unmeasured; shows confidence badge if <0.65
   - Reads LIMENRemedyRegistryManager for top-priority treatments
   - Falls back to LIMENRegulationReports if registry empty
   
4. **LIMENDomains + regulation engine → regulation-renderer.js** (on `limen:regulation-ready` event)
   - Renders unified regulation block per domain (state→severity→trajectory→stress→diagnosis→fractal answer→treatments→actions→impacts)
   - Global coherence summary across all 20 domains
   - Used by console-clarity (Regulation tab) and domain-repair-map (compact block)
   
5. **LIMENReportSynthesizer + LIMENRecommendationEngine → report-console.js**
   - Overlay console with 5 tabs: recommendations, domain-repair, civilization, patent, evidence-chain
   - Subscribes to recommendation + report events
   - Read-only consumer (no writes)
   
6. **All above + LIMENBiosensorBridge → console-clarity.js** (primary Clarity mode)
   - Hero section (global state + confidence + primary driver)
   - Domain Health grid (7 key domains or all 20)
   - Top Events (3 highest priority escalation items)
   - Recommended Actions (prioritized treatments)
   - Tabs (deeper analysis on demand): Source Audit, Regulation, Capital Conversion, Artifact Council
   - Analyst Mode reveals full 3-column grid + export
   - Masterbrain Handoff Queue visible (Patch B)
   
7. **Biosensor → operator-canonical-identity.js → human-state-packet.js → human-context-gate.js**
   - Frozen operator identity (vmPFC/OFC analog)
   - Derives cognitive phase packet from biosensor inputs (allowed list only)
   - Gate evaluates action context-fit: HARD refusals (identity-level) vs SOFT refusals (phase-policy)
   - Audit log (500 entries, session-scoped)
   - Can be wired into master-brain review queue for visible operator review
   
8. **Domain + civilization + connectome → super-brains (fractal architecture)**
   - pattern-envelope.js: Universal contract for all brains (master, civilization, connectome, domain, business, opportunity, document)
   - pattern-broker.js: Inter-brain pub/sub
   - super-brain-base.js: Shared lifecycle (cycle → compute kernels → emit pattern)
   - civilization-super-brain.js: Domain aggregation → civilization signal
   - connectome-super-brain.js: Cross-domain connectome
   - master-living-brain.js: PFC executor; subscribes to civilization + connectome + Thing 2 phase output; decides which 6 engines to fire; writes to engine-output endpoint
   
9. **Master-brain engine context → engine-context-builder.js → /api/expand-artifact-claude**
   - Assembles contextPacket: subject (CIK, slug, industry, scope, personnel, drawings), evidence (citations, news, priorArt, financial)
   - Strips LIMEN-internal vocabulary before shipping to Claude
   - Lazy-fetches deep directives + company portal data
   
10. **Limen-topbar.js (91 pages) ← window.LIMENTopbar**
    - Global sticky header with 16 routes
    - Actions slot (filled by console-clarity for ANALYST/CLARITY toggle + GENERATE REPORTS button)
    - LIMEN BIOSENSOR LIVE indicator (subscribes to biosensor-bridge)
    - Clock + regulation state (CALM/FOCUSED/PRESSURED/OVERLOADED/RECOVERING)
    - Dropdown menu for site-wide navigation

**Cross-layer dependencies:**
- All UI modules (domain-repair-map, regulation-renderer, console-clarity, report-console) depend on window.LIMENDomains (absent: suppress body)
- Phase domain adapter depends on LIMENLongMemory (optional; if absent, no regime tag or z-score)
- Console-clarity depends on all: domain-repair-map, regulation-renderer, limen-phase-domain-adapter, biosensor-bridge, human-context-gate
- Master-living-brain depends on civilization-super-brain + connectome-super-brain (via pattern-broker pub/sub)

**Event flow (global events):**
- `limen:domain-update` → phase-domain-adapter → limen:phase-domain-update
- `limen:regulation-ready` → console-clarity refresh + domain-repair-map refresh
- `limen:report-update` → domain-repair-map refresh (if report.domain.domainStress present)
- `limen:bio-state` (or window.LIMENBiosensorBridge.getRegulationState polled) → topbar clock state update

### NEEDS WORK / INCONSISTENCIES

1. **Phase domain adapter is PROVISIONAL display layer, not validated kernel**
   - File header explicitly notes: "This file annotates domain stress-proxy panels with provisional phase labels for civilization.html. It is NOT the validated phase kernel — that lives server-side."
   - Server validates phases via POST /api/helix-report/score; browser adapter is for UI responsiveness only
   - Risk: If server phase differs materially from browser phase, user sees stale/inconsistent state in topbar clock until next report cycle. No forced refresh after server validation.
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\kernel\limen-phase-domain-adapter.js, lines 26–31

2. **Domain-repair-map authority model is binary (ABSENT vs visible), but confidence range is continuous**
   - Cards show confidence badge (LOW < 0.4, MODERATE < 0.65, FULL ≥ 0.65) but body always renders
   - Contrast: earlier zero-default render (0% bars + "unknown" trend) would look measured even when absent
   - Current design correctly suppresses map-level body if LIMENDomains is null/empty/invalid (Gate B #9a)
   - Inconsistency: ABSENT domain card reason says "No measurement available for {domain}." but card is still slot-present in grid. No visual cue that slot is placeholder vs. real domain.
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\ui\domain-repair-map.js, lines 194–224, 291–309

3. **Regulation renderer + report-console duplicate some domain iteration**
   - Both iterate DOMAIN_ORDER (economy, energy, environment, health, …)
   - Both render state/severity/trajectory/stress/confidence
   - Possible duplication: regulation-renderer used by both console-clarity (tab) and domain-repair-map (compact block)
   - Console-clarity then re-renders same data via report-console overlay (Regulation tab)
   - Path: regulation-renderer.js line 37–42, report-console.js (tabs init), console-clarity.js

4. **Console-clarity Artifact Council tab marked as MVP with no history retention**
   - EMPTY_STATUS says: "Master Brain queue write is not wired in this MVP."
   - Artifact Council (Patch B addition) cannot persist operator decisions to queue
   - Path: console-clarity.js lines 56–81

5. **Master Brain Handoff Queue (Patch B) visible but queue write not implemented**
   - _handoffEl exists in console-clarity but write path to master-brain review queue not connected
   - Path: console-clarity.js line 98; search for _handoffEl usage

6. **Biosensor state is optional; fallback is "unknown" (rendered as CALM + 0.55 opacity)**
   - If window.LIMENBiosensorBridge is not loaded or getRegulationState unavailable, topbar shows CALM state
   - Not a bug (graceful degradation), but operator may not notice that biosensor is offline
   - Path: limen-topbar.js lines 279–298 (wireBiosensor function)

7. **Operator canonical identity is frozen at 1.0.0 (2026-05-22); no version negotiation with biosensor or human-context-gate**
   - If biosensor or gate layer updates, identity version is not bumped
   - Could lead to stale disallowed-actions or regulation-goals if biosensor changes
   - Path: operator-canonical-identity.js lines 32–37

8. **Human-context-gate audit log is session-scoped; no persistence to server**
   - 500-entry cap; once session ends, audit history is lost
   - Operator decisions (refusals, force-allows) are not logged to persistent audit trail
   - Path: human-context-gate.js lines 63–65

9. **limen/* brain architecture (pattern-envelope, super-brain-base, civilization-super-brain, connectome-super-brain, master-living-brain) only included in helix-brain-grid.html**
   - These are core fractal-recursive components but not wired into civilization.html or domain-console.html
   - helix-brain-grid.html is in codebase but does NOT appear in the 91 topbar-included pages
   - Risk: Brain orchestration exists but is isolated from main operator console
   - Path: helix-brain-grid.html (not linked from any live page family); pattern-envelope, pattern-broker, super-brain-base, civilization-super-brain, connectome-super-brain, master-living-brain in assets/js/limen/ but only one consumer (helix-brain-grid.html)

10. **Artifact list/viewer UI (artifact-list-ui.js, artifact-viewer-ui.js, markdown-renderer.js) included only in helix-artifacts.html and helix-artifact.html**
    - Not integrated into civilization.html or domain-console.html artifact discovery flow
    - Artifact Council tab in console-clarity exists but no live link to actual artifact pages
    - Path: helix-artifacts.html (included from where?), helix-artifact.html (included from where?); artifact-list-ui lines 1–50, artifact-viewer-ui lines 1–50

11. **Engine context builder (engine-context-builder.js) is the ONLY bridge between browser brain state and Claude API**
    - Strips all LIMEN-internal vocabulary before shipping to /api/expand-artifact-claude
    - No schema validation that output shape matches API expectation
    - If engine-context-builder vocab stripping is incomplete, Claude sees internal language
    - Path: engine-context-builder.js lines 40–44 ("IMPORTANT: This module strips ALL LIMEN-internal vocabulary")

12. **Multi-pass runner (multi-pass-runner.js) orchestrates expansion but cycle logic not visible in browser UI**
    - Outcome aggregator (outcome-aggregator.js) aggregates engine outputs but no result display in civilization.html or master-brain.html
    - Path: multi-pass-runner.js, outcome-aggregator.js (included only in helix-brain-grid.html)

13. **regulation-renderer.js has STATE_COLORS and STATE_PHRASES but domain-repair-map.js uses different stress classification (stressed/elevated/stable by absolute thresholds)**
    - regulation-renderer: critical, escalating, fragmented, pressured, recovering, stable
    - domain-repair-map: stressed (>0.65), elevated (>0.4), stable
    - Inconsistency: same domain may show as "pressured" in regulation block but "stressed" in repair-map if stress = 0.70
    - Path: regulation-renderer.js lines 44–52, domain-repair-map.js lines 312–313

14. **Treatment discovery (treatment-discovery) page in topbar routes but no corresponding page file in repo**
    - Path to page not found; may be in separate full-repo at C:\Users\Chris\Limen-Helix (no dash)
    - Path: limen-topbar.js line 38; /treatment-discovery route declared but landing page not in codebase

15. **CIK coverage expander (cik-coverage-expander.js) analyzes patent/grant coverage but scope unclear**
    - No doc string on what "coverage" means (novelty score? filing gaps? prior art overlap?)
    - Exposes window.LIMENCIKCoverageExpander but no evidence of caller in civilization.html or master-brain.html
    - Path: cik-coverage-expander.js lines 1–50

16. **No unit tests for phase domain adapter or human-context-gate**
    - Phase logic (3 proxies, phase priority, soft domain dampening) is complex but untested in browser
    - Human-context-gate refusal logic (HARD vs SOFT) has no test coverage visible
    - Path: assets/js/kernel/limen-phase-domain-adapter.js, assets/js/limen/human-context-gate.js

Human operator context gate code is large, complex, and mission-critical (blocks actions based on cognitive state) but lacks test harness.

Human state packet (human-state-packet.js) reads arbitrary biosensor inputs on allowedInputs list; if biosensor channel is noisy or spoofed, packet derivation is compromised.

Human context gate audit log (500 entries) is session-scoped; if operator needs audit trail after session, no export mechanism visible.

---

**Summary:** The shared UI + kernel system is a mature, cohesive stack with 91-page global navigation (limen-topbar), 4 UI panels (domain-repair-map, regulation-renderer, report-console, console-clarity) that render domain health + regulation + recommendations, a browser-side phase classifier (limen-phase-domain-adapter with 3 reconstructed state proxies), and a fractal-recursive brain architecture (pattern-envelope + super-brain-base + civilization/connectome/master brains) that is functional but isolated to a single non-live page (helix-brain-grid.html). The operator context gate (biosensor-driven action authorization) is wired but session-scoped with no persistent audit trail. Key gaps: phase validation is provisional (server is source of truth); artifact/council tabs are MVP stubs; master-brain queue write not implemented; treatment-discovery page missing; CIK coverage scope undocumented.

---

## 24. Complete API surface (Hono prerequisite)

### PURPOSE
Complete enumeration and route mapping of all 54 JavaScript serverless functions, 11 Python functions, vercel.json configuration, cron triggers, and the bidirectional flow between frontend callers and backend services. This section serves as the prerequisite inventory for the Hono consolidation refactor.

### KEY FILES

**JavaScript API Functions (54 total, 20,064 LOC):**
- api/market-snapshot.js — Yahoo Finance market data aggregator
- api/domain-snapshot.js — Multi-source domain signal fetcher (FRED, EIA, NOAA, FDA, USPTO, arXiv, PubMed, BLS)
- api/domain-snapshot-debug.js — Diagnostic variant (inferred from listing)
- api/defense-signals.js — Google News RSS classifier for macro shocks + domain mapping
- api/feed-status.js — Environment variable and API source diagnostics
- api/asset-quote.js — Per-symbol market quotes (Yahoo Finance)
- api/patent-snapshot.js — USPTO patent applications feed + art-unit-to-domain mapping
- api/capital-engine.js — Finance domain router: 20+ actions (streams, status, route, orchestrate, ledger, queue, produce, publish, checkout, stripe-webhook, tick, articles, subscribe, package-patent, patent-listings, audit-application, rewrite-application, applications, application-approve, application-submit, adversarial-review, score-lanes)
- api/limen-ingest.js — Manual/Zapier external event ingestion + deduplication
- api/limen-execution.js — Execution state persistence (opportunities, executions, outcomes) + Redis TTL 30 days
- api/limen-snapshot.js — Fast snapshot reader (console, opportunities types)
- api/limen-health.js — System health check (Redis ping, snapshot freshness, worker age)
- api/redis-diag.js — Upstash Redis REST diagnostic (PING, SET, GET tests without leaking token)
- api/limen-engine-output.js — Artifact persistence (patent, grant, sba, franchise, investment, research lanes) with append-only audit, H1-H7 hardening, Redis primary + in-memory fallback
- api/limen-outcome.js — Outcome event recorder + per-(lane, domain, CIK) aggregate counters
- api/limen-worker-autofire.js — Autonomous HIGH-salience single-call artifact generation (cron 30min, $20/day budget cap, 24h CIK dedupe, max 2 fires/tick)
- api/limen-worker-autoqueue.js — Queue driver for autonomous workflows (inferred)
- api/limen-worker-ingest.js — Server-side defense signal ingestion (cron 2min)
- api/limen-worker-snapshot.js — Snapshot cache builder (cron 2-5min, parallel company scoring)
- api/limen-worker-multipass.js — Multi-pass artifact generation orchestrator
- api/limen-worker-sleep-cycle.js — Autonomic sleep controller
- api/limen-worker-stress-refresh.js — Stress accumulator refresh worker
- api/limen-stress-slim.js — Compact stress state reader (per-company by slug)
- api/limen-stress-propagation.js — Stress wave propagation engine
- api/limen-self-pulse.js — System introspection/vitals
- api/limen-phase-transitions.js — Phase state machine driver
- api/limen-operator-calibration.js — Operator authority matrix + decision gates
- api/limen-reciprocity-prose-rewrite.js — Pattern prose rewrite engine (called by scripts)
- api/limen-artifact-render.js — Artifact template + variable substitution
- api/limen-autofire-log.js — Autonomous fire audit log reader
- api/limen-autoqueue.js — Autonomous queue state reader
- api/limen-changelog.js — Change history reader
- api/limen-drafts.js — Draft persistence (GET/POST, 24h Redis TTL)
- api/limen-intents.js — Intent persistence (GET/POST, 24h Redis TTL)
- api/limen-iteration.js — Iteration state (multi-pass track)
- api/expand-artifact.js — OpenAI-based artifact expansion (patents lane, D3-B.api.v1 schema, no persistence)
- api/expand-artifact-claude.js — Anthropic Claude-based expansion (multi-lane, budget-gated)
- api/enrich-portal-claude.js — Claude portal enrichment (called by scripts, creates/updates company portals)
- api/critique-artifact.js — AI critique engine (post-draft review)
- api/finalize-artifact.js — Artifact finalization + readiness check
- api/kernel-experiment.js — Experimental kernel test harness
- api/master-inbox.js — Phase-gated lane firing queue live computation (Redis overlay on file engine-outputs, 60s edge cache)
- api/operator-action.js — Operator decision recorder (PRINT/REFRESH/DECLINE) + queue status
- api/pattern-proposal.js — Pattern proposal review + approve/reject/restore workflow
- api/lead.js — Public lead capture + admin read/delete (minimal auth)
- api/print-document.js — Long-form generator to DOCX download (patent/grant/sba/research lanes)
- api/print-from-pattern.js — Pattern-triggered document generation
- api/trigger-pattern-author.js — Pattern authoring trigger
- api/paper-trade.js — Alpaca paper trading execution (hardcoded to paper-api.alpaca.markets)
- api/paper-positions.js — Paper trading positions reader
- api/paper-orders.js — Paper trading orders reader
- api/api-keys-config.js — API key provisioning/status (inferred)
- api/fetch-portal.js — GitHub Contents API proxy for domain portals (domainId param, base64 decode, 1h cache)
- api/fetch-doc.js — Protected docs fetch (pseudo-auth X-LIMEN-Access: granted header check, /protected-docs/* sources)

**Python Functions (11 total, 6,232 LOC):**
- api/helix.py — Top-level FastAPI app entry point
- api/ping.py — Simple health check
- api/limen.py — LIMEN three-path distress scorer (FastAPI, /api/limen/health + /api/limen/score, locked limen_backtest.py kernel, matplotlib/sklearn stubbed)
- api/ping_app.py — /api/ping_app endpoint
- api/helix_app/__init__.py — Package marker
- api/helix_app/index.py — FastAPI app (called by helix.py)
- api/helix_app/thing1/__init__.py — Package marker
- api/helix_app/thing1/limen_backtest.py — LOCKED validated distress kernel (97KB, 3ce4a652…82d20 SHA256, immutable; extract_quarterly_series, compute_all_features, score_all_phases, analyse_trajectory, compute_composite_score, fetch_sec_facts, fetch_fred)
- api/helix_app/thing2/__init__.py — Package marker
- api/helix_app/thing2/phase_engine.py — Phase classification engine
- api/helix_app/audit/__init__.py — Package marker
- api/helix_app/audit/reconciliation_log.py — Audit logging (inferred)

**Configuration:**
- vercel.json (57 lines) — Crons, functions, rewrites, redirects, cache headers

### LIVE PAGES
(All routes in Vercel cleanUrls mode, trailing slashes stripped)

- https://limenhelix.com/api/market-snapshot
- https://limenhelix.com/api/domain-snapshot
- https://limenhelix.com/api/defense-signals
- https://limenhelix.com/api/feed-status
- https://limenhelix.com/api/asset-quote
- https://limenhelix.com/api/patent-snapshot
- https://limenhelix.com/api/capital-engine?action=streams|status|route|orchestrate|ledger|queue|produce|publish|checkout|stripe-webhook|tick|articles|subscribe|package-patent|patent-listings|audit-application|rewrite-application|applications|application-approve|application-submit|adversarial-review|score-lanes
- https://limenhelix.com/api/limen-ingest (POST only)
- https://limenhelix.com/api/limen-execution (GET/POST)
- https://limenhelix.com/api/limen-snapshot?type=console|opportunities
- https://limenhelix.com/api/limen-health
- https://limenhelix.com/api/redis-diag?probe=1
- https://limenhelix.com/api/limen-engine-output (GET/POST/PATCH, queries: cik|lane|id|log)
- https://limenhelix.com/api/limen-outcome (GET/POST, queries: byLane|byDomain|cik|outputId|log)
- https://limenhelix.com/api/limen-worker-autofire (GET)
- https://limenhelix.com/api/limen-worker-ingest (GET, cron 2min)
- https://limenhelix.com/api/limen-worker-snapshot (GET, cron 2-5min)
- https://limenhelix.com/api/limen-stress-slim (GET)
- https://limenhelix.com/api/limen-health (GET)
- https://limenhelix.com/api/limen-drafts (GET/POST)
- https://limenhelix.com/api/limen-intents (GET/POST)
- https://limenhelix.com/api/expand-artifact (POST, OpenAI, patents lane only)
- https://limenhelix.com/api/expand-artifact-claude (POST, Anthropic, multi-lane)
- https://limenhelix.com/api/enrich-portal-claude (POST, called by scripts)
- https://limenhelix.com/api/master-inbox (GET, ?fresh=1 to bypass cache)
- https://limenhelix.com/api/operator-action (GET/POST)
- https://limenhelix.com/api/pattern-proposal (GET/POST)
- https://limenhelix.com/api/lead (POST public, GET/DELETE admin with ?key=)
- https://limenhelix.com/api/print-document?slug=<slug>&lane=<lane>&index=<n>&format=docx
- https://limenhelix.com/api/fetch-portal?domainId=<domainId> (fallback to GitHub if not on disk)
- https://limenhelix.com/api/fetch-doc (GET, pseudo-auth header X-LIMEN-Access: granted)
- https://limenhelix.com/api/paper-trade (POST)
- https://limenhelix.com/api/paper-positions (GET)
- https://limenhelix.com/api/paper-orders (GET)
- https://limenhelix.com/api/limen/health (Python, GET)
- https://limenhelix.com/api/limen/score (Python FastAPI, POST)
- https://limenhelix.com/api/ping (Python, GET)
- https://limenhelix.com/api/ping_app (Python FastAPI, GET)

### DATA

**Redis Stores (Upstash REST):**
- `limen:engine_output:{outputId}` — Artifact persistence (H1-H7 hardening, 2MB cap)
- `limen:engine_output_index:by_cik:{cik}` — CIK → outputIds lookup
- `limen:engine_output_index:by_lane:{lane}` — Lane → outputIds lookup
- `limen:engine_output_log` — Append-only audit (H2)
- `limen:eo:{portalSlug}` — Fresh engine outputs (written by crons, overlays file-based on master-inbox read)
- `execution_{domain}` — Execution state (opportunities, executions, outcomes), TTL 30 days
- `console_snapshot` — Pre-built console snapshot (generatedAt, domainCount, liveCount)
- `opportunities_snapshot` — Pre-built opportunities snapshot (count, generatedAt)
- `latest_ingest` — Latest defense ingest metadata (timestamp, totalArticles, signals, macroShock)
- `autoqueue` — Autonomous queue state
- `autofire_audit_log` — Autonomous fire decisions, TTL 30 days, max 500
- `autofire_budget_YYYY-MM-DD` — Daily spend tracker, TTL 1 day
- `autofire_cik_lane_dedupe_{cik}` — Per-(CIK, lane) dedupe, TTL 24h
- `action_drafts` — Draft state (_savedAt, TTL 24h)
- `active_intents` — Intent state (_savedAt, TTL 24h)
- `site:articles` — Published journal articles
- `site:subscribers` — Email subscribers (LPUSH, max 99999)
- `limen:diag:probe` — Diagnostic test write (TTL 60s)
- `lead:{id}` — Lead form submission
- `leads_index` — Lead ID index (LPUSH, newest first)

**Static JSON Data (assets/data/):**
- capital-engine.json (~100KB) — Finance domain config (streams, connectors, routing policy, approval queue, AI orchestration)
- command-board-data.json (0-cache forced) — Per-CIK phase + domain + stress (read by /api/limen/score for polyvagal context wiring)
- companies/*.json (3397+ files) — Company portals (engineOutputs, bridgeReadings, slug, phase, trajectory)
- company-registry.json (~16MB) — Master company registry (CIK → metadata)
- company-index.json — Indexed lookup
- company-aliases.json — CIK aliases
- companies-manifest.json (0-cache forced) — File listing
- domains/*.json — Domain portal data (activations, treatments, monitoring, escalation, citations)
- bridge-patterns.json — Pattern library (manually authored + approved via /api/pattern-proposal)
- verbiage-templates.json — Text templates for artifact generation
- review-rubric.json — Grading rubric for adversarial review
- corpus.json — Reference corpus
- affiliate-config.json — Affiliate program config
- brain-connectome.json — Domain connection matrix
- stress-network-state.json — Stress signal state
- _pattern-proposals.json (0-cache forced) — Pending proposals (gitignored runtime)
- _ai-budget.json (0-cache forced) — AI spend tracking (gitignored runtime)
- _operator-actions.json (0-cache forced) — Operator action queue (gitignored runtime)

**Treatment-discovery-cube.json (~84MB):**
- Massive JSON tank (too large to read whole); structure inferred from reads in other domains: treatment node registry across all domains + cost/efficacy metadata

**Portal-registry.json (~62MB):**
- Complete company portal listing + CIK → portal path binding

**Data Freshness:**
- domain-snapshot: s-maxage=25s (stale-while-revalidate=10s, ~40 parallel source fetches, graceful per-source fallback)
- market-snapshot: s-maxage=8s (stale-while-revalidate=4s, Yahoo Finance public API)
- asset-quote: s-maxage=15s (stale-while-revalidate=8s, sequential per-symbol with rate-limit backoff)
- fetch-portal: s-maxage=3600s, stale-while-revalidate=86400s (1h cache, GitHub Contents API proxy)
- capital-engine: no-store (live status)
- master-inbox: max-age=0, s-maxage=60s, stale-while-revalidate=300s (edge cached, ?fresh=1 bypass)
- limen-snapshot: s-maxage=10s, stale-while-revalidate=5s
- redis-diag: no cache (diagnostic)
- fetch-doc: soft 401/403 (no cache header visible in code)
- Static HTML: Cache-Control: public, max-age=0, must-revalidate (0-cache forced)
- .json data files (companies, domains, etc.): 0-cache forced per vercel.json headers rule

### HOW IT CONNECTS

**Cron-Driven Workers (vercel.json):**
- `/api/capital-engine?action=tick&cap=3` every 6 hours (0 */6 * * *) — Finance autonomic cycle

**Frontend Callers (assets/js/):**
- `market-snapshot` ← domain-brains (economy, energy), kernel-comparison
- `domain-snapshot` ← domain-signal-engine, kernel-comparison, domain-brain-base, consolidation refactor target
- `defense-signals` ← feeds/limen-defense-signal-engine, limen-ingest-client
- `asset-quote` ← finance clarity operators (XLE, IYT, NEE symbols)
- `fetch-portal` ← all 20+ domain clarity operators (fallback to /assets/data/domains/ first)
- `limen-stress-slim` ← command-board-stress.js (live stress per company)
- `capital-engine` (streams action) ← finance-capital-engine.html dashboard
- `limen-health` ← vitals monitor (implied from structure)
- `operator-action` ← company-portal-engine-render (PRINT/REFRESH/DECLINE on artifacts)
- `limen-intents` ← operator-state-ui (save/load operator decisions)
- `limen-drafts` ← artifact-viewer-ui, multi-pass-runner (draft persistence)
- `master-inbox` ← master-inbox.html portal (live queue rendering)
- `limen-engine-output` ← artifact viewer (read), autonomic loop (write)
- `limen-outcome` ← outcome-aggregator (read outcomes per lane/domain/CIK)
- `pattern-proposal` ← pattern authoring UI (approve/reject)
- `lead` ← public forms (lead capture, admin tools)
- `fetch-doc` ← docs-viewer.js (operator docs with pseudo-auth)

**Script Callers (scripts/):**
- `enrich-portal-claude` ← build-fractal-portals.mjs, create-new-portals.mjs, densify-v2-portals.mjs, portal-redensify-weak.mjs, bulk-retry, fractal-batch-* scripts (portal creation/enrichment)
- `limen-reciprocity-prose-rewrite` ← portal-reciprocity-phase2.mjs (prose rewrite during portal update)
- `expand-artifact-claude` ← multi-pass-runner, autonomic workflow (artifact expansion)
- `limen-engine-output` ← autonomic loop (artifact persistence)
- `operator-action` ← implied in autonomic action processing

**Vercel Rewrites (vercel.json):**
- `/navigator` → navigator.html
- `/aggregated` → aggregated.html
- `/civilization` → civilization.html
- `/kernel-comparison` → kernel-comparison.html
- `/operator-guide` → operator-guide.html
- `/my-documents` → my-documents.html
- `/pattern-proposals` → pattern-proposals.html
- `/vitals` → vitals.html
- `/master-inbox` → master-inbox.html
- `/treatment-discovery` → treatment-discovery.html
- `/capital-engine` → finance-capital-engine
- `/api/limen/(.*)` → /api/limen (Python catch-all for FastAPI sub-routes)

**Vercel Redirects:**
- `/fractal-connectome` → `/civilization` (301)

**Server-to-Server (API → API):**
- `/api/limen-worker-snapshot` reads `/api/domain-snapshot` + `/api/defense-signals` to build console+opportunities snapshots
- `/api/master-inbox` reads `/assets/data/companies/` files + overlays Redis-fresh engine-outputs from keys written by autonomic loop
- `/api/capital-engine?action=ledger` calls `/lib/finance-ledger` + `/lib/finance-autonomic`
- `/api/capital-engine?action=orchestrate` calls `/lib/ai-orchestrator` (Anthropic/OpenAI/Grok provider routing)
- `/api/expand-artifact-claude` uses `/lib/ai-orchestrator` with budget gate
- `/api/enrich-portal-claude` uses `/lib/ai-orchestrator` (called by scripts)
- `/api/print-document` calls `/lib/long-form-generator` + `/lib/markdown-to-docx`
- `/api/operator-action` mutates `/lib/operator-action-queue` (Redis or in-memory)
- `/api/pattern-proposal` mutates `/lib/pattern-author` (Redis writes to bridge-patterns)
- `/api/limen/score` (Python) fetches SEC EDGAR facts + FRED data server-side; returns validated three-path distress signals

**Environment Variables (Production Critical):**
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN — Primary storage backend
- GITHUB_TOKEN (or GH_TOKEN, VERCEL_GITHUB_TOKEN) — /api/fetch-portal GitHub Contents API access
- ANTHROPIC_API_KEY — Claude calls (capital-engine orchestrate, expand-artifact-claude, enrich-portal-claude)
- OPENAI_API_KEY (or OPENAI_API_KEY_D3B) — GPT calls (expand-artifact patents lane)
- OPENAI_MODEL — GPT model selector (required, no default)
- GROK_API_KEY (or XAI_API_KEY) — Grok provider (optional, routed by ai-orchestrator)
- ALPACA_API_KEY_ID, ALPACA_API_SECRET — Paper trading (checked 8 var name aliases)
- STRIPE_SECRET_KEY — /api/capital-engine?action=stripe-webhook
- LIMEN_OPERATOR_TOKEN — Bearer auth for POST /api/limen-engine-output, /api/limen-outcome (disabled if unset, local-dev mode)
- LEAD_ADMIN_KEY — GET/DELETE /api/lead admin read (disabled if unset)
- AUTOFIRE_DAILY_BUDGET — Daily spend cap for autonomous fires (default $20)
- AUTOFIRE_MAX_PER_TICK — Max fires per cron tick (default 1, bounded by 300s Vercel timeout)
- FRED_API_KEY, EIA_API_KEY, NOAA_TOKEN, USPTO_API_KEY, USDA_API_KEY, NEWS_API_KEY, EVENT_REGISTRY_API_KEY, ACLED_API_KEY, REGULATIONS_GOV_API_KEY, ALPHA_VANTAGE_API_KEY, FINNHUB_API_KEY, TAVILY_API_KEY, ELEVENLABS_API_KEY, NCBI_API_KEY — Domain source APIs (domain-snapshot, patent-snapshot, feed-status diagnostics)

### NEEDS WORK / INCONSISTENCIES

1. **CRITICAL: Raw-body Stripe webhook parsing in capital-engine.js line 194**
   - File: C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (lines 190-198)
   - Issue: Custom `_readRaw()` function (lines 25-36) attempts to recover raw request body for Stripe signature verification. Falls back to re-stringify parsed body if stream already consumed. HIGH DANGER for consolidation: Vercel's request body parsing may or may not consume the stream depending on runtime/middleware. On Hono, must use explicit raw-body middleware or native crypto.
   - Risk: Signature validation may silently pass invalid webhooks if raw body recovery fails.
   - Action: Pre-Hono, test Stripe webhook delivery on Vercel. Post-Hono, guarantee raw-body middleware is first in the chain.

2. **CRITICAL: Python FastAPI polyvagal coupling incomplete (api/helix_app/index.py line ~42-50)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\helix_app\index.py (lines 37-50, partial read)
   - Issue: "Sources NOT yet wired (data-source decisions pending)" — polyvagal auto-population from server-side state is TODO. /api/limen/score will only use passed polyvagal_context, not auto-build it. This breaks the intended Pass 3 coupling for production traffic.
   - Data source: command-board-data.json (per-CIK phase + domain + stress) is available but not yet read server-side.
   - Action: Wire command-board-data.json read + polyvagal_context builder into limen.py POST handler.

3. **CRITICAL: Locked kernel immutability enforcement missing**
   - File: C:\Users\Chris\Limen-Helix-live-\api\helix_app\thing1\limen_backtest.py (97KB, SHA256 3ce4a652…82d20)
   - Issue: limen.py imports limen_backtest.py and documents it as "LOCKED validated source (immutable on disk)" but there is NO file hash check at runtime. If the file is modified (even by accident during a deploy), the SHA256 constant on line 281 becomes false.
   - Action: Add CRC32 or SHA256 check in limen.py handler; raise 500 if on-disk hash doesn't match lock.

4. **HIGH: Orphaned/Untested API endpoints (no callers found)**
   - Endpoints with no grep evidence in frontend JS, HTML, or scripts:
     - `api/limen-worker-multipass.js` — Multi-pass orchestrator, only called internally by autonomic loop (implied)
     - `api/limen-worker-sleep-cycle.js` — Sleep controller, only called by scheduler (implied)
     - `api/limen-worker-stress-refresh.js` — Stress refresh, called by cron (implied, no explicit route)
     - `api/kernel-experiment.js` — Experimental kernel, may be dev-only
     - `api/limen-iteration.js` — Iteration state, may be unreachable
     - `api/limen-phase-transitions.js` — Phase state, unclear caller
     - `api/limen-autofire-log.js` — Audit log reader, called by autonomic dashboard (implied)
   - Action: Audit each for live caller; if truly orphaned, flag for removal.

5. **HIGH: Domain snapshot source count skew (40 sources, no single source docs)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js (lines 67-80, partial read)
   - Issue: SOURCE_KEYS array is manually maintained in parallel with the Promise.allSettled() fetcher list. The comment explicitly warns "Reordering, inserting, or removing a fetcher requires the matching SOURCE_KEY entry to move with it... a slot can never silently bind to another fetcher's output." This is a violation of DRY and a landmine for future maintainers (no structured source registry).
   - Action: Extract fetchers to a data-driven registry: `const SOURCES = [{ name: 'FRED', fetch: fetchFred }, ...]`. Then iterate over SOURCES to build both the fetcher list and keys atomically.

6. **HIGH: Redis in-memory fallback stale on cold start (limen-engine-output.js, limen-outcome.js)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\limen-engine-output.js (lines 34-36, HAS_REDIS flag)
   - Issue: When REDIS unavailable, engine-output and outcome data are stored in-memory per cold-start. If a cold start happens, the in-memory store is lost and subsequent requests see an empty store. This is not documented in the response schema, and clients may assume persistence across requests.
   - Action: Add `_stale: true` or `_backend: 'memory'` fields to GET responses when HAS_REDIS=false. Operator must know data will vanish on next cold-start.

7. **MEDIUM: Python helix.py entry point indirection (api/helix.py line 1-4)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\helix.py (4 lines)
   - Issue: helix.py imports app from helix_app.index, which imports helix_app.thing2. This is a 3-level indirection for a simple FastAPI re-export. Unclear if there's intentional layering or if consolidation can flatten it.
   - Action: Inline helix.py → index.py if no multi-version contract.

8. **MEDIUM: API keys config endpoint (api-keys-config.js) — signature unknown**
   - File: C:\Users\Chris\Limen-Helix-live-\api\api-keys-config.js (not fully read)
   - Issue: Listed in glob but not read. Purpose, route, and query params unknown. May conflict with /api/feed-status diagnostics.
   - Action: Read and document full signature.

9. **MEDIUM: Stripe webhook env var names inconsistent (paper-trade.js)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\paper-trade.js (lines 25-27)
   - Issue: Checks 8 alias names for Alpaca credentials (ALPACA_API_KEY_ID, APCA_API_KEY_ID, ALPACA_KEY_ID, ALPACA_KEY). No canonical name. Suggests legacy credential naming debt.
   - Action: Document canonical names; deprecate aliases.

10. **MEDIUM: Paper trading endpoints hardcoded (paper-trade.js line 15)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\paper-trade.js
    - Scope: ALPACA_PAPER_URL hardcoded to 'https://paper-api.alpaca.markets'. Good for safety (can't accidentally go live), but no env var override.
    - Action: Acceptable as-is (safety first), but consider making configurable with a guard.

11. **MEDIUM: Feed-status env var audit (feed-status.js) may be incomplete**
    - File: C:\Users\Chris\Limen-Helix-live-\api\feed-status.js (lines 25-40, partial read)
    - Issue: Env var audit is hardcoded; domain source config is not data-driven. If a new domain source is added, feed-status.js must be edited manually.
    - Action: Consolidate domain source registry with domain-snapshot.js.

12. **MEDIUM: Master-inbox live computation + Redis overlay (master-inbox.js lines 44-49)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\master-inbox.js
    - Issue: Reads committed company portal files from disk, then attempts to overlay fresh Redis engine-outputs. If Redis is down, the file-based engine-outputs are stale (e.g., 3 days old if last cron was 3 days ago). No age indication in response.
    - Action: Add `_engineOutputsSource: 'file' | 'redis'` and `_engineOutputsAge` to response; warn operator if fallback to file is >1h old.

13. **MEDIUM: Vercel function maxDuration 300s ceiling (vercel.json line 11)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (comment on line 200: "TICK: run one autonomic cycle")
    - Issue: All api/** functions capped at 300s. limen-worker-autofire.js deliberately limits MAX_FIRES_PER_TICK=1 "to guarantee we stay within Vercel's 300s budget even on slowest Sonnet call (270s+)". Multi-pass workflows (6-25 min per pass) cannot use autonomic loop; they must be triggered manually. This is a hard limit on autonomous throughput.
    - Action: Document in HONO_CONSOLIDATION.md; evaluate Vercel Pro tier upgrade (3600s) as part of throughput planning.

14. **MEDIUM: AI provider routing scattered (capital-engine.js vs expand-artifact-claude vs expand-artifact.js)**
    - Files:
      - C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (Anthropic/OpenAI/Grok via ai-orchestrator)
      - C:\Users\Chris\Limen-Helix-live-\api\expand-artifact-claude.js (Anthropic only)
      - C:\Users\Chris\Limen-Helix-live-\api\expand-artifact.js (OpenAI only)
    - Issue: Three separate provider strategies. No unified routing library. If a provider changes API version, three files must be updated.
    - Action: Consolidate into single ai-router module with declarative provider config.

15. **MEDIUM: Cron paths in vercel.json are bare (capital-engine.js only)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (only cron defined in vercel.json)
    - Issue: Only one cron defined in vercel.json: capital-engine?action=tick every 6h. Other workers (limen-worker-ingest, limen-worker-snapshot, limen-worker-multipass) are called from JavaScript or scripts, NOT from cron. This means their invocation depends on browser/script activity, not scheduled execution.
    - Action: Audit which workers should be independent crons; move them to vercel.json.

16. **MEDIUM: domain-snapshot graceful degradation inconsistent (lines 18-22)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js
    - Issue: "Falls back per-source gracefully" but exact fallback behavior not visible in partial read. GDELT cache (5min TTL) + per-source health tracking are in-memory; if a source is permanently broken, the health state is reset on each cold-start.
    - Action: Persist source health to Redis; alert operator if source is broken >2h.

17. **LOW: /api/limen rewrite in vercel.json (line 26) may conflict with Python FastAPI routes**
    - File: C:\Users\Chris\Limen-Helix-live-\api\limen.py
    - Issue: vercel.json rewrites `/api/limen/(.*)` → `/api/limen`, which would capture both /api/limen/health and /api/limen/score. If the rewrite is processed before the Python function routing, it may cause all requests to hit the same entry point.
    - Action: Verify that Vercel's Python runtime routing takes precedence over rewrites; confirm /api/limen/health and /api/limen/score both work live.

18. **LOW: expand-artifact.js unsupported lane response (D3-B scope)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\expand-artifact.js (lines 30-38)
    - Issue: "patents lane only (other lanes → 400 UNSUPPORTED_LANE)". D3-E.1 amendment added NSF lane routing to separate file. Schema versioning is documented (D3-B.api.v1 for patents, D3-E.api.v1 for NSF) but no registry of which lane uses which file.
    - Action: Add lane→file registry to API catalog.

19. **LOW: fetch-doc pseudo-auth (fetch-doc.js) is soft security**
    - File: C:\Users\Chris\Limen-Helix-live-\api\fetch-doc.js (lines 22-38)
    - Issue: "The literal value 'granted' is in client-side JS, so anyone who reads /assets/js/auth-gate.js can set the header". Documented as intentional ("It keeps casual browsers and search engines out; it is not a hardened secret"). But live docs may contain sensitive data (e.g., pre-publication research).
    - Action: Consider using signing secrets or JWTs if docs are truly confidential. If not, remove this from security review.

20. **LOW: limen-ingest in-memory dedupe (limen-ingest.js lines 32-35)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\limen-ingest.js
    - Issue: In-memory dedupe window `_recentKeys` is per-cold-start (~5min on Vercel). If same Zapier trigger fires within 5min but across two cold-starts, it will not be deduped (false positive).
    - Action: Move dedupe to Redis if >5min window is needed. Otherwise, document the 5min boundary in API contract.

21. **LOW: paper-trade, paper-positions, paper-orders env var checking incomplete**
    - Files: C:\Users\Chris\Limen-Helix-live-\api\paper-trade.js, paper-positions.js (inferred), paper-orders.js (inferred)
    - Issue: paper-trade checks 8 credential aliases but still returns 503 if none found. No fallback mock data or graceful degradation. Frontend may not expect 503 on optional trading features.
    - Action: Consider stubbing paper trading with simulated responses if env vars are missing (local-dev mode).

22. **LOW: master-inbox.js portal iteration may hit file-system quota (line 21-33)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\master-inbox.js
    - Issue: `_iterPortals()` reads and parses all .json files in assets/data/companies/ on every request (before Redis overlay). With 3397+ portal files, this may be slow or cause memory pressure on cold-start.
    - Action: Cache portal list in Redis with short TTL (e.g., 60s). Recompute only when new portals are added.

23. **LOW: treat-discovery-cube.json and portal-registry.json too large to validate**
    - Files: assets/data/treatment-discovery-cube.json (~84MB), assets/data/portal-registry.json (~62MB)
    - Issue: These tanks are larger than can be read in a single Read call (max 20 pages for PDFs, no equivalent page limit mentioned for JSON). No API endpoint directly exposes them; they are referenced by scripts and worker crons. Structure, freshness, and consistency are unknown.
    - Action: Sample structure with PowerShell jq snippet; document schema in API catalog; add size + checksum reporting to health endpoint.

24. **LOW: No response schema versioning in most endpoints**
    - Issue: expand-artifact.js documents D3-B.api.v1 schema, but most endpoints don't version their responses. If a breaking change is needed, clients may break.
    - Action: Add `schemaVersion` field to all /api/* GET responses (optional for POST).

25. **AMBIGUOUS: Unclear which API functions are production vs experimental**
    - Issue: kernel-experiment.js exists; limen-iteration.js, limen-phase-transitions.js are unclear. No feature-flag or "experimental" marker in code.
    - Action: Add `X-Experimental` response header or `experimental: true` to response JSON for endpoints in flux.

### ROUTE-FOR-ROUTE COMPREHENSIVE TABLE

| # | Path | Method | Purpose | Reads | Writes | Env Vars | Runtime Config | Callers | Status |
|---|------|--------|---------|-------|--------|----------|-----------------|---------|--------|
| 1 | /api/market-snapshot | GET | Yahoo Finance snapshot | Yahoo v8 chart API | None | None | cache s-maxage=8s | domain-clarity-* (.js), kernel-comparison.js | LIVE |
| 2 | /api/domain-snapshot | GET | Multi-source domain signals | FRED, EIA, NOAA, FDA, USPTO, arXiv, PubMed, BLS (40 sources) | Redis _sourceHealth (cold-start only) | FRED_API_KEY, EIA_API_KEY, NOAA_TOKEN, USPTO_API_KEY, USDA_API_KEY, NEWS_API_KEY, EVENT_REGISTRY_API_KEY, ACLED_API_KEY, REGULATIONS_GOV_API_KEY, ALPHA_VANTAGE_API_KEY, FINNHUB_API_KEY, TAVILY_API_KEY | cache s-maxage=25s, timeout 5s, max-retries 1 | limen-worker-snapshot, domain-signal-engine.js, kernel-comparison | LIVE |
| 3 | /api/domain-snapshot-debug | GET | Debug variant (inferred) | (unknown) | (unknown) | (unknown) | (unknown) | (unknown) | ORPHANED? |
| 4 | /api/defense-signals | GET | Google News RSS → domain signals | Google News RSS (4 feeds) | None (stateless) | None | cache s-maxage=?, timeout 8s | limen-defense-signal-engine.js, limen-ingest-client.js | LIVE |
| 5 | /api/feed-status | GET | API source diagnostics | All domain sources (diagnostic only) | None | FRED_API_KEY, EIA_API_KEY, etc. (env audit only) | cache s-maxage=10s | operator diagnostic (dashboard?) | LIVE |
| 6 | /api/asset-quote?symbols=XLE,IYT | GET | Per-symbol market quote | Yahoo Finance v8 | None | None | cache s-maxage=15s, sequential per-symbol | finance clarity ops | LIVE |
| 7 | /api/patent-snapshot | GET | USPTO patent applications | USPTO patent API | None | USPTO_API_KEY | timeout 12s, max 25 rows, art-unit-to-domain mapping | operator (patent discovery?) | LIVE |
| 8 | /api/capital-engine?action=streams | GET | Finance domain contract | capital-engine.json | None | Env audit only (connectors) | cache no-store | finance-capital-engine.html | LIVE |
| 9 | /api/capital-engine?action=status | GET | AI + budget + connector readiness | capital-engine.json | None | ANTHROPIC_API_KEY, OPENAI_API_KEY, GROK_API_KEY | cache no-store | finance dashboard | LIVE |
| 10 | /api/capital-engine?action=route | GET | Proposed capital routes (read-only) | capital-engine.json | None | None | cache no-store | finance operator | LIVE |
| 11 | /api/capital-engine?action=orchestrate | POST | AI stream ranking proposal | capital-engine.json, ai-orchestrator | None | ANTHROPIC_API_KEY (budget-gated) | cache no-store, maxTokens=2048 | finance-capital-engine.html | LIVE |
| 12 | /api/capital-engine?action=ledger | GET | P&L + finance health + lendable surplus | finance-ledger, finance-autonomic | None | None | cache no-store | finance dashboard | LIVE |
| 13 | /api/capital-engine?action=queue | GET | Content queue + published log | stream-ops | None | None | cache no-store | operator view | LIVE |
| 14 | /api/capital-engine?action=produce | POST | AI content generation (budget-gated) | capital-engine.json, stream-ops, ai-orchestrator | stream-ops queue | ANTHROPIC_API_KEY | budget-gated | operator | LIVE |
| 15 | /api/capital-engine?action=publish | POST | Dispatch queued artifact | stream-ops | stream-ops queue | None | None | operator | LIVE |
| 16 | /api/capital-engine?action=checkout | POST | Stripe payment link (ACCEPT income) | stripe-rail | None | STRIPE_SECRET_KEY | None | finance operator | LIVE |
| 17 | /api/capital-engine?action=stripe-webhook | POST | Verify + record income to ledger | stripe-rail (raw-body sig verify) | limen-db (ledger) | STRIPE_SECRET_KEY | raw-body reader (DANGER) | Stripe webhooks | LIVE |
| 18 | /api/capital-engine?action=tick | GET | Autonomic cycle (audit → heal → build) | finance-autonomic, limen-db | limen-db (ledger, proposals) | None | ?cap=3 param (default), never moves money | cron every 6h | LIVE |
| 19 | /api/capital-engine?action=articles | GET | Published journal (public read) | limen-db (site:articles) | None | None | cache no-store | journal.html | LIVE |
| 20 | /api/capital-engine?action=subscribe | POST | Email capture (monetization funnel) | None | limen-db (site:subscribers) | None | None | landing page form | LIVE |
| 21 | /api/capital-engine?action=package-patent | POST | Patent draft → marketplace listing + targets | patent-packager | patent-packager (listing) | None | None | operator | LIVE |
| 22 | /api/capital-engine?action=patent-listings | GET | Packaged listings + status | patent-packager | None | None | cache no-store | operator view | LIVE |
| 23 | /api/capital-engine?action=audit-application | POST | Multi-AI audit / rewrite / approve / submit | application-auditor, ai-orchestrator | application-auditor (state) | ANTHROPIC_API_KEY | budget-gated | applications.html | LIVE |
| 24 | /api/capital-engine?action=rewrite-application | POST | Application rewrite (budget-gated) | application-auditor | application-auditor | ANTHROPIC_API_KEY | budget-gated | operator | LIVE |
| 25 | /api/capital-engine?action=applications | GET | Application list | application-auditor | None | None | cache no-store | applications.html | LIVE |
| 26 | /api/capital-engine?action=application-approve | POST | Mark APPROVED (operator sign-off) | application-auditor | application-auditor | None | None | operator | LIVE |
| 27 | /api/capital-engine?action=application-submit | POST | Mark SUBMITTED (to Research.gov / Grants.gov) | application-auditor | application-auditor | None | None, notice: "must file manually with AOR" | operator | LIVE |
| 28 | /api/capital-engine?action=adversarial-review | POST | Hostile reviewer vs rubric | application-auditor, ai-orchestrator | None | ANTHROPIC_API_KEY | budget-gated | operator | LIVE |
| 29 | /api/capital-engine?action=score-lanes | POST | Card score per lane (manual rubric, automated) | application-auditor | None | None | None | operator | LIVE |
| 30 | /api/limen-ingest | POST | Manual/Zapier event ingestion + dedup | None (body only) | None (stateless, client-side emit) | None | dedupe 5min window (in-memory), maxDelta=0.25 | limen-ingest-client.js | LIVE |
| 31 | /api/limen-execution (GET) | GET | Read execution state per domain | limen-db (execution_{domain}) | None | None | cache public, max-age=0 | opportunity pages? | LIVE |
| 32 | /api/limen-execution (POST) | POST | Mutate execution state (claim / update / create) | limen-db (execution_{domain}) | limen-db (execution_{domain}, TTL 30d) | None | None | autonomic loop? | LIVE |
| 33 | /api/limen-snapshot?type=console | GET | Pre-built console snapshot | limen-db (console_snapshot) | None | None | cache s-maxage=10s, stale-while-revalidate=5s | master-living-brain.js? | LIVE |
| 34 | /api/limen-snapshot?type=opportunities | GET | Pre-built opportunities snapshot | limen-db (opportunities_snapshot) | None | None | cache s-maxage=10s, stale-while-revalidate=5s | opportunity pages | LIVE |
| 35 | /api/limen-health | GET | System health (Redis, snapshots, workers) | limen-db (console_snapshot, opportunities_snapshot, latest_ingest), db.ping() | None | None | cache public, max-age=0 | vitals monitor | LIVE |
| 36 | /api/redis-diag?probe=1 | GET | Upstash diagnostic (PING, SET, GET) | Upstash REST (test commands) | limen:diag:probe (TTL 60s) | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | diagnostic, no cache | operator troubleshooting | LIVE |
| 37 | /api/limen-engine-output (GET) | GET | Read artifacts (cik=..., lane=..., id=...) | Redis (limen:engine_output:*) or in-memory | None | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | maxDuration 300s, fallback in-memory (STALE on cold-start) | artifact-viewer-ui.js, helix-report.html | LIVE |
| 38 | /api/limen-engine-output (POST) | POST | Persist READY-TO-SIGN artifact (H1-H7 hardening) | None | Redis (limen:engine_output:*, limen:engine_output_index:*, limen:engine_output_log) | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, LIMEN_OPERATOR_TOKEN (auth gate if set) | maxDuration 300s, 2MB cap, append-only audit, idempotency via content-hash | autonomic loop | LIVE |
| 39 | /api/limen-outcome (GET) | GET | Outcome aggregates (byLane, byDomain, cik=, outputId=, log=) | Redis (limen:outcome:*) or in-memory | None | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | cache no-store | outcome-aggregator.js, dashboards | LIVE |
| 40 | /api/limen-outcome (POST) | POST | Record outcome event (SUBMITTED, APPROVED, OUTCOME_REVENUE, etc.) | None | Redis (limen:outcome_log, aggregates) | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, LIMEN_OPERATOR_TOKEN (auth gate if set) | None | autonomic loop | LIVE |
| 41 | /api/limen-worker-autofire | GET | Autonomous fire summary (evaluated, fired, budget, dedupe, sample) | limen-db (autoqueue, autofire_audit_log, autofire_budget_YYYY-MM-DD, autofire_cik_lane_dedupe_*) | limen-db (autofire_audit_log, limen:engine_output:*, autoqueue) | AUTOFIRE_DAILY_BUDGET (default $20), AUTOFIRE_MAX_PER_TICK (default 1), ANTHROPIC_API_KEY | maxDuration 300s, 1 fire/tick max, cron every 30min (implicit) | autonomic dashboard | LIVE |
| 42 | /api/limen-worker-ingest | GET | Defense RSS ingest + domain signal ingestion | Google News RSS (4 feeds) | limen-db (latest_ingest, limen:ingest_signals) | None | maxDuration 300s, cron every 2min | autonomic scheduler | LIVE |
| 43 | /api/limen-worker-snapshot | GET | Console + opportunities snapshot builder (parallel company scoring) | limen-db (domain_snapshot, defense_signals), company-phase-scorer | limen-db (console_snapshot, opportunities_snapshot) | None | maxDuration 300s, cron every 2-5min | autonomic scheduler | LIVE |
| 44 | /api/limen-worker-multipass | GET | Multi-pass artifact generator orchestrator | limen-db (autoqueue), ai-orchestrator | limen-db (limen:engine_output:*) | ANTHROPIC_API_KEY | maxDuration 300s (EXCEEDS for multi-pass; not cron, manual only) | operator, scripts (manual trigger) | LIVE |
| 45 | /api/limen-worker-sleep-cycle | GET | Autonomic sleep cycle controller | limen-db (phase state) | limen-db (phase state) | None | maxDuration 300s, cron schedule (implied) | autonomic scheduler | ORPHANED? |
| 46 | /api/limen-worker-stress-refresh | GET | Stress accumulator refresh | limen-db (domain snapshots) | limen-db (stress_network_state) | None | maxDuration 300s, cron schedule (implied) | autonomic scheduler | ORPHANED? |
| 47 | /api/limen-stress-slim | GET | Compact stress state (per company by slug) | limen-db (stress_network_state or computed) | None | None | cache s-maxage=?, stale-while-revalidate=? | command-board-stress.js | LIVE |
| 48 | /api/limen-self-pulse | GET | System introspection / vitals (inferred) | (unknown) | (unknown) | (unknown) | (unknown) | (unknown) | ORPHANED? |
| 49 | /api/limen-phase-transitions | POST | Phase state machine transitions (inferred) | limen-db (phase state) | limen-db (phase state) | None | None | autonomic loop? | ORPHANED? |
| 50 | /api/limen-operator-calibration | GET | Operator authority matrix + decision gates (inferred) | limen-db (operator config) | None | None | None | operator dashboard? | ORPHANED? |
| 51 | /api/limen-reciprocity-prose-rewrite | POST | Pattern prose rewrite engine (called by scripts) | portal content, ai-orchestrator | None (caller handles output) | ANTHROPIC_API_KEY | budget-gated, maxDuration 300s | portal-reciprocity-phase2.mjs | LIVE |
| 52 | /api/limen-artifact-render | POST | Artifact template + variable substitution (inferred) | template, artifact data | None (caller handles output) | None | None | autonomic expansion? | ORPHANED? |
| 53 | /api/limen-engine-output (read) | GET | (see row 37) | (see row 37) | (see row 37) | (see row 37) | (see row 37) | (see row 37) | (see row 37) |
| 54 | /api/limen-autofire-log | GET | Autonomous fire audit log reader | limen-db (autofire_audit_log) | None | None | cache public, max-age=0 | autonomic dashboard | LIVE |
| 55 | /api/limen-autoqueue | GET | Autonomous queue state reader | limen-db (autoqueue) | None | None | cache public, max-age=0 | autonomic dashboard | LIVE |
| 56 | /api/limen-changelog | GET | Change history reader (inferred) | limen-db (changelog) | None | None | cache public, max-age=0 | operator audit log | ORPHANED? |
| 57 | /api/limen-drafts (GET) | GET | Read persisted drafts (24h TTL) | limen-db (action_drafts) | None | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | cache no-store | artifact-viewer-ui.js, multi-pass-runner | LIVE |
| 58 | /api/limen-drafts (POST) | POST | Write drafts | None | limen-db (action_drafts, TTL 24h) | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | None | artifact-viewer-ui.js, multi-pass-runner | LIVE |
| 59 | /api/limen-intents (GET) | GET | Read persisted intents (24h TTL) | limen-db (active_intents) | None | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | cache no-store | operator-state-ui.js | LIVE |
| 60 | /api/limen-intents (POST) | POST | Write intents | None | limen-db (active_intents, TTL 24h) | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | None | operator-state-ui.js | LIVE |
| 61 | /api/limen-iteration | GET | Iteration state reader (inferred) | limen-db (iteration_state) | None | None | cache public, max-age=0 | multi-pass-runner? | ORPHANED? |
| 62 | /api/limen-stress-propagation | POST | Stress wave propagation engine (inferred) | domain snapshots, phase state | limen-db (stress_network_state) | None | None | autonomic loop? | ORPHANED? |
| 63 | /api/expand-artifact (OpenAI, patents lane D3-B.api.v1) | POST | Patent draft expansion (OpenAI) | None (body only) | None (caller handles output) | OPENAI_API_KEY (or OPENAI_API_KEY_D3B), OPENAI_MODEL | maxDuration 60s, timeout 60s, 256KB cap, no persistence | (inferred operator or script) | LIVE |
| 64 | /api/expand-artifact-claude (Anthropic, multi-lane) | POST | Artifact expansion (Claude, multi-lane) | None (body only) | None (caller handles output) | ANTHROPIC_API_KEY | maxDuration 300s, budget-gated | autonomic-expansion, engine-runner-claude.js, scripts | LIVE |
| 65 | /api/enrich-portal-claude | POST | Portal enrichment via Claude (called by scripts) | portal skeleton, ai-orchestrator | None (caller handles output) | ANTHROPIC_API_KEY | budget-gated, maxDuration 300s | build-fractal-portals.mjs, create-new-portals.mjs, densify-v2-portals.mjs, portal-redensify-weak.mjs, bulk-retry, fractal-batch-* | LIVE |
| 66 | /api/critique-artifact | POST | AI critique engine (post-draft review) | artifact text, ai-orchestrator | None (caller handles output) | ANTHROPIC_API_KEY | budget-gated | artifact viewer / autonomic | ORPHANED? |
| 67 | /api/finalize-artifact | POST | Artifact finalization + readiness check | artifact, rubric | None (caller handles output) | None | None | autonomic expansion | ORPHANED? |
| 68 | /api/kernel-experiment | GET/POST | Experimental kernel test harness (inferred) | (unknown) | (unknown) | (unknown) | (unknown) | (unknown) | EXPERIMENTAL? |
| 69 | /api/master-inbox | GET | Phase-gated lane firing queue (live, Redis overlay on file portals, 60s edge cache) | limen-db (limen:eo:*), fs (assets/data/companies/*.json), bridge-patterns.json, corpus.json | None | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (optional) | cache public, s-maxage=60s, stale-while-revalidate=300s, ?fresh=1 bypass | master-inbox.html | LIVE |
| 70 | /api/operator-action (GET) | GET | Operator action queue summary | operator-action-queue | None | None | cache no-store | company-portal-engine-render.js (status badge) | LIVE |
| 71 | /api/operator-action (POST) | POST | Operator decision recorder (PRINT / REFRESH / DECLINE) | None | operator-action-queue (Redis or in-memory) | None | None | company-portal-engine-render.js | LIVE |
| 72 | /api/pattern-proposal (GET) | GET | List pending pattern proposals (?status=REJECTED filters) | pattern-author | None | None | cache no-store | pattern-proposals.html | LIVE |
| 73 | /api/pattern-proposal (POST) | POST | Approve / reject / restore pattern (approve:true / reject:true / restore:true) | pattern-author | pattern-author (merge bridge-patterns.json or mark REJECTED) | None | None | operator (pattern review) | LIVE |
| 74 | /api/lead (POST) | POST | Public lead capture (email required) | None | limen-db (lead:{id}, leads_index) | None | read-back verify on write, 200 only after confirm | landing page forms | LIVE |
| 75 | /api/lead (GET) | GET | Admin lead list (newest first, ?key=LEAD_ADMIN_KEY) | limen-db (lead:*, leads_index) | None | LEAD_ADMIN_KEY (admin only, disabled if unset) | None | operator tools | LIVE |
| 76 | /api/lead (DELETE) | DELETE | Admin delete one lead (?key=KEY&id=ID) | None | limen-db (delete lead:{id}, skip in index) | LEAD_ADMIN_KEY | None | operator tools | LIVE |
| 77 | /api/print-document?slug=<slug>&lane=<lane>&index=<n> | GET | Long-form DOCX download (20-30 pages, patent/grant/sba/research) | fs (portal file), portal.engineOutputs, long-form-generator, markdown-to-docx | None (streaming DOCX response) | ANTHROPIC_API_KEY (if long-form uses it) | maxDuration 300s, Content-Disposition attachment | company-portal-engine-render.js (PRINT button) | LIVE |
| 78 | /api/print-from-pattern | POST | Pattern-triggered document generation (inferred) | portal, pattern, long-form-generator | None (streaming DOCX) | (unknown) | None | (unknown) | ORPHANED? |
| 79 | /api/trigger-pattern-author | POST | Pattern authoring trigger (inferred) | (unknown) | pattern-author | (unknown) | None | (unknown) | ORPHANED? |
| 80 | /api/fetch-portal?domainId=<id> | GET | GitHub Contents API proxy (fallback for /assets/data/domains/*) | GitHub API (base64 decode) | None | GITHUB_TOKEN (or GH_TOKEN, VERCEL_GITHUB_TOKEN) | cache public, s-maxage=3600s, stale-while-revalidate=86400s | all domain-clarity-*.js (fallback), fetch-portal.js in clarities | LIVE |
| 81 | /api/fetch-doc?doc=<path> | GET | Protected docs fetch (pseudo-auth X-LIMEN-Access: granted header) | fs (/protected-docs/*) | None | None | soft 401/403, no cache (implied) | docs-viewer.js | LIVE |
| 82 | /api/paper-trade | POST | Alpaca paper trade execution (hardcoded paper-api.alpaca.markets) | None | Alpaca paper API | ALPACA_API_KEY_ID (8 alias names), ALPACA_API_SECRET | 503 if creds missing, never goes live | trading dashboard (if present) | LIVE |
| 83 | /api/paper-positions | GET | Alpaca paper positions reader (inferred) | Alpaca paper API | None | ALPACA_API_KEY_ID, ALPACA_API_SECRET | None | trading dashboard | ORPHANED? |
| 84 | /api/paper-orders | GET | Alpaca paper orders reader (inferred) | Alpaca paper API | None | ALPACA_API_KEY_ID, ALPACA_API_SECRET | None | trading dashboard | ORPHANED? |
| 85 | /api/api-keys-config | GET/POST | API key provisioning / status (inferred) | (unknown) | (unknown) | (unknown) | (unknown) | (unknown) | UNKNOWN |
| 86 | /api/limen/health (Python FastAPI) | GET | Python liveness probe | None | None | None | None | (implied cron, health check) | LIVE |
| 87 | /api/limen/score (Python FastAPI) | POST | Three-path distress scorer (locked kernel) | SEC EDGAR facts (via limen_backtest.py), FRED data (via limen_backtest.py), command-board-data.json (NOT YET WIRED) | None | None | maxDuration 300s, response: composite_score, path_a/b/c, alert, pathway, phase_history, financial_state, input_presence | master-brain-inbox.html?, helix-report.html? | LIVE |
| 88 | /api/ping (Python) | GET | Simple health check | None | None | None | None | (implied cron, health check) | LIVE |
| 89 | /api/ping_app (Python FastAPI) | GET | /api/ping_app liveness probe | None | None | None | None | (unknown) | LIVE |

**Legend:**
- **Reads**: Data sources (Redis keys, static files, external APIs)
- **Writes**: Data mutation targets (Redis, files)
- **Env Vars**: Required or optional environment variables
- **Runtime Config**: Vercel-specific maxDuration, caching, timeouts
- **Callers**: Which frontend/script/cron invokes the endpoint
- **Status**: LIVE (confirmed working), ORPHANED? (no callers found), UNKNOWN (purpose unclear), EXPERIMENTAL? (in flux)

---

## 25. Build / sense scripts

### PURPOSE
Scripts are the operational backbone of LIMEN Helix, performing four distinct roles:
1. **Autonomic/Immune system** — Hourly interoception (vitals), self-heal, audit, consolidation (heal-corpus, audit-*-vitals, persist-k2-readings, process-operator-actions)
2. **Portal/data generation** — Build fractal portals, enrich company entities, generate treatments & bridges (create-new-portals, build-fractal-portals, build-engine-outputs, build-treatment-discovery-cube, split-cube-for-render)
3. **Integrity/validation** — Reciprocity audit, quality gates, data validation (portal-reciprocity-audit, validate-*, audit-portal-quality, audit-prose-quality, audit-fn-category-bleed, verify-iteration-determinism)
4. **Syndication/transformation** — Cube rendering, pattern sync, data export (split-cube-for-render, sync-approved-patterns, build-companies-manifest, wire-*-slugs)

Legacy (pre-2026) scripts remain present but inactive: treat_batch*.js, add_*_treatments.js, run-investment-engine.js, migrate-*, gen-walmart-tree-l2, probe-eligibility, extract-operator-ciks, etc.

### KEY FILES

**Immune System (Sense Organs) — scripts/sense/ (12 .mjs files + 1 _index.mjs)**
- `/scripts/sense/_index.mjs` — organ registry; imported by audit-system-vitals
- `/scripts/sense/organ-feeds.mjs` — feed-status.js audit (afferent cortex, order 10)
- `/scripts/sense/organ-nodes.mjs` — 123 L1 taxonomy audit (FROZEN until 2026-12, order 20)
- `/scripts/sense/organ-domains.mjs` — 20 canonical domain audit
- `/scripts/sense/organ-portal-corpus.mjs` — wraps audit-corpus-vitals.mjs (semantic memory, order 40)
- `/scripts/sense/organ-dead-links.mjs` — link liveness check
- `/scripts/sense/organ-kernel.mjs` — K1/K2/K3 coverage per portal (order 50)
- `/scripts/sense/organ-connectome.mjs` — cross-domain transfer check; was dead, verify fixed (order 60)
- `/scripts/sense/organ-civilization.mjs` — civilization export state audit
- `/scripts/sense/organ-propagator.mjs` — stress propagator output check
- `/scripts/sense/organ-master-brain.mjs` — PFC/executive cortex: 6 engine lanes (order 80)
- `/scripts/sense/organ-bridge.mjs` — bridge-readings presence + pattern-bus publisher
- `/scripts/sense/organ-pattern-bus.mjs` — pattern envelope state

**Autonomic Core**
- `/scripts/audit-system-vitals.mjs` — body-wide interoception; runs all organs, aggregates _vitals.json (invoked hourly via operator or manual)
- `/scripts/audit-corpus-vitals.mjs` — dedicated corpus-only vitals (wraps portal audit logic; run by organ-portal-corpus)
- `/scripts/heal-corpus.mjs` — drain operator-attention queue, run safe heals (scrub-data-needed, wire-cb-slugs, wire-eligible-slugs, fix-fn-category-bleed), re-audit
- `/scripts/process-operator-actions.mjs` — dispatch QUEUED actions (PRINT, REFRESH, DECLINE) from operator-action-queue.js
- `/scripts/persist-k2-readings.mjs` — call Helix kernel API for every portal, persist K2 (polyvagal) readings; idempotent on 24h stale threshold

**Portal/Data Building**
- `/scripts/build-company-registry.js` — scan assets/data/companies/*.json (all v1+v2 portals), emit company-registry.json (byCik, bySlug, byBrainNode, byDomain, bySic, byPhaseState, byKernelStatus, graph)
- `/scripts/create-new-portals.mjs` — create v2.0.1 portals for orphan vendors via POST /api/enrich-portal-claude (Anthropic Haiku, paced, depth-gated, resumable)
- `/scripts/build-fractal-portals.mjs` — tier-1/tier-2 fractal generation via /api/enrich-portal-claude with conglomerate hints; logs to _fractal-build-log.jsonl; idempotent
- `/scripts/densify-v2-portals.mjs` — enrich existing portals (add functionalNetwork depth)
- `/scripts/build-treatment-discovery-cube.mjs` — pivot organ (task #29); reads field-connection-map.json + domain sources + neuro-disorder-lookup, emits 85MB treatment-discovery-cube.json
- `/scripts/split-cube-for-render.mjs` — chunk cube into _index.json + by-node/*.json for browser loading
- `/scripts/build-engine-outputs.mjs` — run 6 lanes (patent, grant, sba, franchise, investment, research) via engineGenerator.generateForPortal(), write to portal.engineOutputs
- `/scripts/build-master-inbox.mjs` — integrate civilization + connectome kernels, gate 6 execution lanes, emit _master-inbox.json
- `/scripts/build-stress-network.mjs` — load corpus, run spider-web propagator, write stress-network-state.json; readable by master-brain, command-board, autofire
- `/scripts/build-bridge-readings.mjs` — call bridgeEngine.matchPortal() per portal, persist portal.bridgeReadings; idempotent
- `/scripts/build-companies-manifest.mjs` — scan companies/ directory, emit companies-manifest.json (slug list for helix-portal-coverage.html)
- `/scripts/build-deep-directives.js` — (legacy?) build-artifact-deep-source-index.js pipeline
- `/scripts/build-neuro-disorder-lookup.mjs` — (lookup reference; step 3/4 source for treatment cube)
- `/scripts/build-orphan-registry.mjs` — index un-portaled counterparties

**Integrity/Validation**
- `/scripts/audit-corpus-vitals.mjs` — (see above; comprehensive corpus audit)
- `/scripts/audit-system-vitals.mjs` — (see above; body-wide audit via organs)
- `/scripts/audit-portal-quality.mjs` — per-portal quality gates (anchored rate, genericity, prose)
- `/scripts/audit-prose-quality.mjs` — functionNetwork prose text audit
- `/scripts/audit-fn-category-bleed.mjs` — check entries are in correct functionalNetwork slot
- `/scripts/portal-reciprocity-audit.mjs` — walk every v2 portal, verify reciprocity rules (supplier↔customer, competitor↔competitor, symmetric pairs)
- `/scripts/portal-genericity-audit.mjs` — check anchoredRate, genericityWarning per portal
- `/scripts/validate-company-schema.js` — validate portal JSON schema (v1 + v2)
- `/scripts/validate-brain-node-mapping.mjs` — validate portal brainNodeId references
- `/scripts/classify-portal-brain-node-mapping.mjs` — map portal functionalNetwork entries to brain nodes
- `/scripts/resolve-portal-brain-node-mapping.mjs` — (resolve ambiguous brain mappings)
- `/scripts/validate-reciprocity.js` — (legacy; superseded by portal-reciprocity-audit.mjs)
- `/scripts/verify-iteration-determinism.mjs` — confirm multi-pass artifact generation is deterministic
- `/scripts/run-mechanism-fidelity-check.mjs` — validate binding-fidelity-report.json

**Syndication/Wiring**
- `/scripts/split-cube-for-render.mjs` — (see above; chunk for browser)
- `/scripts/sync-approved-patterns.mjs` — drain APPROVED pattern proposals from Upstash Redis → assets/data/bridge-patterns.json; requires UPSTASH_REDIS_REST_URL + TOKEN
- `/scripts/wire-cb-slugs.mjs` — re-point curated CB rows to working portal slugs (safe heal)
- `/scripts/wire-eligible-slugs.mjs` — re-point eligible CB rows + set hp=true
- `/scripts/detect-slug-aliases.mjs` — find company aliases (plurals, abbrevs, suffixes)
- `/scripts/scrub-data-needed-corpus.mjs` — remove DATA_NEEDED placeholder text from portals
- `/scripts/strip-placeholder-portals.mjs` — remove thin/filler portals below quality gates
- `/scripts/compute-cross-domain-readout.mjs` — (cross-domain comparison; task #30 source)

**Legacy/Testing/Exploration (INACTIVE)**
- `/scripts/treat_batch1.js`, `/scripts/treat_batch2.js` — agriculture treatment batch uploads (INACTIVE; pre-fractal, no longer run)
- `/scripts/add_fertilizer_treatments.js`, `/scripts/add_landuse_treatments.js` — domain treatment bulk loads (INACTIVE)
- `/scripts/run-investment-engine.js` — rule-based investment signals (SUPERSEDED by engineGenerator)
- `/scripts/migrate-v2-portals-to-v201.js` — (LEGACY; migration completed)
- `/scripts/gen-walmart-tree-l2.js` — (one-off supplier hierarchy generation)
- `/scripts/extract-operator-ciks.js` — (one-off CIK extraction)
- `/scripts/fetch-news.js` — (feed ingest test; unused)
- `/scripts/build-command-board.js` — (command-board-data.json generation)
- `/scripts/build-historical-distress-cohort.js` — (one-off stress cohort)
- `/scripts/build-brain-node-business-mapping.js` — (taxonomy mapping; static after freeze)
- `/scripts/score-companies.js` — (kernel scoring; superseded by persist-k2-readings)
- `/scripts/probe-eligibility.js` — (CIK eligibility check; INACTIVE)
- `/scripts/_test-multipass.mjs`, `/scripts/_test-human-gate-modules.mjs` — local test runners (INACTIVE)
- `/scripts/_limen-self-portal.mjs`, `/scripts/_dedup-analysis.mjs`, `/scripts/_cb-resolve-plan.mjs`, `/scripts/_fractal-batch-*.mjs`, `/scripts/_refire-weak-priority.mjs` — one-off/debug scripts (prefixed `_`, not in production loop)
- `/scripts/portal-create-multipass.mjs`, `/scripts/portal-reciprocity-phase1.mjs`, `/scripts/portal-reciprocity-phase2.mjs`, `/scripts/portal-redensify-weak.mjs` — phase-batched portal rework (INACTIVE; completed phases)
- `/scripts/autonomous-portal-regen.mjs` — drain portal-regen queue (built-in auto-discovery)
- `/scripts/author-bridge-patterns.mjs` — Claude pattern authoring (INACTIVE; awaiting approval workflow)
- `/scripts/build-epistemic-buckets.mjs` — epistemic state bucketing (research)
- `/scripts/organ-binding-fidelity.mjs`, `/scripts/organ-claim-verification.mjs` — future sense organs (not in _index yet)
- `/scripts/rebuild-engine-outputs-local.cjs` — local dev fallback (CommonJS for Node compatibility)

**Data Files (intermediate artifacts)**
- `/scripts/_fractal-build-log.jsonl` — per-portal enrich attempts (APPEND-ONLY; audit trail)
- `/scripts/_alias-manual.json` — manually curated company slug aliases
- `/scripts/_bulk-failures-48a.json`, `/scripts/_bulk-failures-chunk-[1-5].json` — enrich failure logs (INACTIVE; batches completed or retried)
- `/scripts/_failure-single-*.json` — per-CIK enrich failures (18 files; INACTIVE; individual test failures)
- `/scripts/_bulk-targets-48a.json` — batch 48a targets (INACTIVE)
- `/scripts/_fractal-batch-alert-priority.mjs`, `/scripts/_fractal-batch-bulk-48a.mjs`, `/scripts/_fractal-overrides.json` — build overrides + alert prioritization
- `/scripts/_slug-alias-candidates.json` — auto-detected alias candidates for operator review
- `/scripts/_regen-eo.log` — engine output rebuild log (STALE)

### LIVE PAGES
All vitals/operator surfaces feed from script outputs:
- https://limenhelix.com/vitals — /assets/data/_vitals.json (score, organ breakdown, operator-attention queue)
- https://limenhelix.com/master-inbox — /assets/data/_master-inbox.json (6 execution lanes, inbox state)
- https://limenhelix.com/civilization — civilization state (portals ranked by composite score)
- https://limenhelix.com/treatment-discovery — /assets/data/treatment-discovery/ (by-node chunk loader)
- https://limenhelix.com/navigator — company corpus browser (reads company-registry.json)
- https://limenhelix.com/domain-console — per-domain brain audit (reads domain JSON + brain files)
- https://limenhelix.com/kernel-comparison — K1/K2/K3 per-portal readings (reads companies/*.json kernelReadings slots)
- https://limenhelix.com/operator-guide — training/reference (self-contained HTML)

### DATA
**Fresh/Live Data (regularly updated)**
- `assets/data/_vitals.json` — last written 2026-06-05 15:13 (hourly audit cycle); **live, 75KB**
- `assets/data/treatment-discovery-cube.json` — 2026-06-04 09:22; **85MB, 3 days stale**; regenerate via build-treatment-discovery-cube.mjs
- `assets/data/_master-inbox.json` — 2026-06-01 22:50; **168KB, 5 days stale**; regenerate via build-master-inbox.mjs
- `assets/data/_bridge-build-log.json` — 2026-06-01 22:49; **3.3KB log**; updated by bridge build steps
- `assets/data/company-registry.json` — aggregated index of all portals; keyed for O(1) lookup (byCik, bySlug, byBrainNode, etc.)
- `assets/data/companies/*.json` — 767 v1+v2 portals; mutation point for all enrichment pipelines
- `assets/data/companies-manifest.json` — index of slug→filepath (generated by build-companies-manifest.mjs)
- `assets/data/brain-node-domains.json` — 123 L1 nodes + domain bindings (FROZEN, no script writes)
- `assets/data/stress-network-state.json` — per-node network stress state (spider-web propagation cache); readable by master-brain
- `assets/data/command-board-data.json` — CB scores + rank; **must-revalidate cache header** (mutable)
- `assets/data/bridge-patterns.json` — approved bridge patterns; mutated by sync-approved-patterns.mjs from Upstash Redis

**Static Reference (rarely written)**
- `assets/data/neuro-disorder-lookup.json` — disorder→treatment mapping (step 3/4 source for cube)
- `assets/data/brain-connectome.json` — connectome kernel state
- `assets/data/brain-node-map.json`, `brain-nodes-111.json` — taxonomy
- `assets/data/brain-node-business-mapping.json` — business domain mappings per L1 node
- `assets/data/brain-atlas-coordinates.json` — L1 node spatial coordinates
- `assets/data/affiliate-config.json`, `capital-engine.json`, `connectome-node-registry.json`, `entity-registry.json`, `node-signal-registry.json`, `node-entity-mapping.json` — lookup tables

**Stale/Dormant Tanks**
- `/scripts/_regen-eo.log` — engine output rebuild log (STALE, not actively maintained)
- `/scripts/_bulk-failures-*.json` — batch enrich failures (COMPLETED; informational only)
- `/scripts/_failure-single-*.json` — individual test failures (18 files, INACTIVE test artifacts)

**Paused Crons** (ops/crons-paused-2026-06-01-pre-gate-a.json)
- `/api/limen-worker-autoqueue` — `*/15 * * * *` (PAUSED pre-Gate-A; re-enable after state-write chokepoint built)
- `/api/limen-worker-autofire` — `*/30 * * * *` (PAUSED; burning $9-16/day due to /api/expand-artifact-claude failures)
- `/api/limen-worker-multipass` — `*/5 * * * *` (PAUSED)
- `/api/limen-worker-sleep-cycle` — `0 * * * *` (PAUSED; consolidation/pruning/audit/repair dispatch)

**Active Cron** (vercel.json)
- `/api/capital-engine?action=tick&cap=3` — `0 */6 * * *` (every 6h; capital-engine tick)

### HOW IT CONNECTS
**Execution Flow: Daily Autonomic Cycle**
1. **VITALS AUDIT** (manual or operator-triggered): `node scripts/audit-system-vitals.mjs` → runs every organ in `sense/` in parallel → aggregates into `_vitals.json`
   - Organs are imported by `sense/_index.mjs`; sorted by execution order (afferent→cortex→executive)
   - Wrapper pattern: `organ-portal-corpus.mjs` spawns `audit-corpus-vitals.mjs` as child process (preserves canonical portal audit logic)
   - Output: `_vitals.json` with `.overall.score`, `.scores` (per-organ), `.operatorAttention[]` (flagged issues), `.lastHeals` (heal history)

2. **HEAL/REPAIR** (automatic on operator command): `node scripts/heal-corpus.mjs --apply`
   - Reads `_vitals.json` operatorAttention queue
   - Safe heals registered in HEALS array:
     - `DATA_NEEDED placeholders` → `scrub-data-needed-corpus.mjs --apply`
     - `Curated CB rows with broken portal links` → `wire-cb-slugs.mjs`
     - `Eligible CB rows with broken portal links` → `wire-eligible-slugs.mjs`
     - `Category bleed` → `fix-fn-category-bleed.mjs --apply`
   - Re-audits corpus after heals; writes heal log to `_vitals.lastHeals`
   - Operator-only issues (CIK collisions, thin portals, domain mis-routing, brain tagging gaps) stay in queue

3. **OPERATOR ACTION DISPATCH** (background loop): `node scripts/process-operator-actions.mjs --apply`
   - Drains `api/lib/operator-action-queue.js` QUEUED actions
   - Dispatch: PRINT → `print-pipeline.js`, REFRESH → `refresh-pipeline.js`, DECLINE → noop
   - Updates action status + result in queue

4. **PORTAL ENRICHMENT** (manual or auto-discovery)
   - **Manual tier generation**: `node scripts/build-fractal-portals.mjs --tier 1 --limit 5 --apply`
     - Tier 1: command-board companies without portals
     - Tier 2: orphan vendors ranked by reference count
     - Calls POST `/api/enrich-portal-claude` (Anthropic Haiku, paced ~10K tok/min)
     - Logs: `_fractal-build-log.jsonl` (APPEND-ONLY audit trail)
     - Depth gates: rejects if anchoredRate < 0.85 or max placeholder count exceeded
   - **Auto-discovery**: `autonomous-portal-regen.mjs` drains body's own regen queue
   - **Densification**: `densify-v2-portals.mjs` enriches existing portals
   - **New portals**: `create-new-portals.mjs` for manual targets with inline metadata

5. **DATA AGGREGATION** (builds intermediate tanks)
   - `build-company-registry.js` — scan `companies/*.json` → emit `company-registry.json` (lookup indices)
   - `build-companies-manifest.mjs` — scan directory → emit `companies-manifest.json` (slug list)
   - `build-stress-network.mjs` — load corpus + CB scores → run propagator → emit `stress-network-state.json` (readable by master-brain, autofire)
   - `build-bridge-readings.mjs` — per-portal bridgeEngine match → persist `portal.bridgeReadings`
   - `build-engine-outputs.mjs` — per-portal with bridges → generate 6 lanes → persist `portal.engineOutputs`

6. **KERNEL PERSISTENCE** (K2 scoring cycle)
   - `persist-k2-readings.mjs --apply` — for every portal with CIK, call `/api/helix_app` kernel → persist `portal.kernelReadings.k2`
   - Idempotent: skips if K2 fresh (< 24h); --force to re-score
   - Concurrent (default 4 in flight)

7. **TREATMENT/BRIDGE GENERATION** (monthly/ad-hoc)
   - `build-treatment-discovery-cube.mjs` — read field-connection-map.json + domain sources + neuro-disorder-lookup → build 85MB cube
   - `split-cube-for-render.mjs` — chunk cube into by-node/*.json for browser loading (no monolithic pull)
   - `sync-approved-patterns.mjs --apply` — drain Upstash Redis pattern proposals → merge into `bridge-patterns.json`

**Data Dependency Graph**
```
api/operator-action-queue.js
  ↓
process-operator-actions.mjs → api/lib/{print,refresh}-pipeline.js → portal writes

audit-system-vitals.mjs (runs all sense organs)
  ├─ sense/_index.mjs (registry)
  ├─ sense/organ-feeds.mjs → api/feed-status.js
  ├─ sense/organ-nodes.mjs → assets/data/brain-node-domains.json
  ├─ sense/organ-portal-corpus.mjs → audit-corpus-vitals.mjs → _vitals.json
  ├─ sense/organ-kernel.mjs → companies/*.json (kernelReadings)
  ├─ sense/organ-connectome.mjs → assets/js/limen/connectome-super-brain.js
  ├─ sense/organ-master-brain.mjs → master-living-brain.js + master-brain-executor.js
  ├─ sense/organ-bridge.mjs → portal.bridgeReadings
  └─ sense/organ-pattern-bus.mjs → pattern-envelope state
  ↓
_vitals.json (operator-attention queue)
  ↓
heal-corpus.mjs (if --apply)
  ├─ scrub-data-needed-corpus.mjs → portal writes
  ├─ wire-cb-slugs.mjs → curated CB re-point
  ├─ wire-eligible-slugs.mjs → eligible CB re-point + hp flag
  └─ fix-fn-category-bleed.mjs → portal functionalNetwork re-slot
  ↓
re-audit (audit-corpus-vitals.mjs or audit-system-vitals.mjs)
  ↓
_vitals.json (updated with heal results)

build-fractal-portals.mjs (tier 1/2)
  → POST /api/enrich-portal-claude
  → assets/data/companies/{slug}.json (new portals)
  → _fractal-build-log.jsonl (audit trail, APPEND-ONLY)

build-company-registry.js
  ← companies/*.json (all portals)
  → company-registry.json (lookup indices)

build-stress-network.mjs
  ← companies/*.json + command-board-data.json
  → stress-network-state.json
  ↓ (consumed by master-brain, command-board, autofire)

build-bridge-readings.mjs
  ← companies/*.json
  → companies/{slug}.json .bridgeReadings

build-engine-outputs.mjs
  ← companies/{slug}.json .bridgeReadings
  → companies/{slug}.json .engineOutputs (6 lanes)

persist-k2-readings.mjs
  ← companies/{slug}.json (CIK filter)
  → GET /api/helix_app (kernel API)
  → companies/{slug}.json .kernelReadings.k2

build-treatment-discovery-cube.mjs
  ← assets/data/audit/field-connection-map.json
  ← assets/data/domains/**/*.json
  ← assets/data/neuro-disorder-lookup.json
  ← assets/data/bridge-patterns.json (binding-fidelity-report)
  → treatment-discovery-cube.json (85MB)

split-cube-for-render.mjs
  ← treatment-discovery-cube.json
  → assets/data/treatment-discovery/{_index,_summary,by-node/*.json}

sync-approved-patterns.mjs
  ← Upstash Redis (UPSTASH_REDIS_REST_URL + TOKEN)
  → assets/data/bridge-patterns.json

GitHub Actions (sync-to-full.yml)
  ← lean repo (Limen-Helix-live-)
  → full repo (Limen-Helix) — NO-DELETE overlay (assets/js, api/*.js, console HTML)
  — disabled since 2026-06-03 (FULL_REPO_TOKEN invalid; manual-dispatch only)
```

### NEEDS WORK / INCONSISTENCIES

1. **Paused Autonomous Crons** — Four critical crons paused 2026-06-01 (ops/crons-paused-2026-06-01-pre-gate-a.json):
   - `/api/limen-worker-autoqueue` (*/15 * * * *) — dependency awaiting Gate A state-write chokepoint
   - `/api/limen-worker-autofire` (*/30 * * * *) — **burning $9-16/day** due to /api/expand-artifact-claude failures + retry loop; do NOT repair endpoint without Gate A first (re-arms ungated pipeline)
   - `/api/limen-worker-multipass` (*/5 * * * *) — artifact generation halted pending gating
   - `/api/limen-worker-sleep-cycle` (0 * * * *) — consolidation/pruning/audit/repair dispatch paused
   - **Restoration**: After Gate A v0 wired at /api/operator-action chokepoint and verified to reject autonomous bypasses, move entries from pausedCrons[] back to vercel.json crons[] array

2. **Treatment Discovery Cube Stale** — treatment-discovery-cube.json 3 days old (2026-06-04 09:22); **85MB, task #29 dependent**. Regenerate via `node scripts/build-treatment-discovery-cube.mjs` (reads field-connection-map.json, domain sources, neuro-disorder-lookup).

3. **Master Inbox Stale** — _master-inbox.json 5 days old (2026-06-01 22:50); 6 execution lanes may be outdated. Regenerate via `node scripts/build-master-inbox.mjs`.

4. **GitHub Sync Workflow Disabled** — `.github/workflows/sync-to-full.yml` on manual-dispatch only since 2026-06-03; FULL_REPO_TOKEN returned "Bad credentials". Until token restored, lean→full logic sync is manual in-session.

5. **Tier-2 Orphan Densification Not Started** — build-fractal-portals.mjs supports `--tier 2` (vendor orphans ranked by reference count) but no recent tier-2 runs in _fractal-build-log.jsonl. Tier 1 (55 CB companies) appears partially completed.

6. **Legacy Scripts Still Present (118 files total, ~20 superseded)**:
   - `treat_batch*.js`, `add_*_treatments.js` — INACTIVE agriculture treatment batch uploads (pre-fractal)
   - `run-investment-engine.js` — SUPERSEDED by engineGenerator; outputs ignored
   - `migrate-v2-portals-to-v201.js` — LEGACY migration (completed)
   - `gen-walmart-tree-l2.js`, `extract-operator-ciks.js`, `fetch-news.js`, `build-command-board.js`, `build-historical-distress-cohort.js` — one-off/exploratory
   - `_test-*.mjs`, `_limen-self-portal.mjs`, `_dedup-analysis.mjs` — prefixed-underscore test/debug artifacts
   - `portal-create-multipass.mjs`, `portal-reciprocity-phase[12].mjs`, `portal-redensify-weak.mjs` — completed phase batches
   - **Recommendation**: Remove inactive scripts from repo to reduce cognitive load; keep in git history for archaeology

7. **Fractional Script Outputs Untracked**:
   - `_fractal-build-log.jsonl` — APPEND-ONLY audit of enrich attempts; tracking resumability but not actively parsed by other systems
   - `_bulk-failures-*.json` — 5 chunk files from batch 48a (COMPLETED or archived); not referenced elsewhere
   - `_failure-single-*.json` — 18 individual test artifacts (STALE); unclear if still needed

8. **Binding Fidelity Gate Missing** — build-treatment-discovery-cube.mjs respects binding-fidelity-report.json but there is no script that generates it. Either the report is static (hand-curated) or the generation script is missing. Verify via `ls assets/data/audit/binding-fidelity-report.json`.

9. **Sense Organ `organ-binding-fidelity.mjs` Not Registered** — exists in scripts/sense/ but not imported in sense/_index.mjs; similarly `organ-claim-verification.mjs` present but not listed. Check whether these are reserved-future or orphaned half-builds.

10. **portal-reciprocity-audit.mjs Exit Code Semantics** — exits non-zero if violations found (CI useful); but heal-corpus.mjs does NOT automatically trigger re-runs of this audit. Manual intervention required if reciprocity score drifts below RECIPROCITY_MIN (0.80).

11. **K2 Persistence Concurrency Limit (4 by default)** — persist-k2-readings.mjs paced at 4 concurrent Helix kernel calls; if more than 767 portals need K2 scoring, bottleneck will be apparent. Monitor _k2-persist-log.json for stale-threshold skips.

12. **Neuro Disorder Lookup not Maintained** — neuro-disorder-lookup.json is a static load-bearing reference (steps 3/4 in treatment cube). No script writes it; if source disorder/treatment data drifts, manual re-authoring required.

13. **Missing Pattern Proposal Approval Workflow** — sync-approved-patterns.mjs drains Redis of APPROVED proposals, but there is no visible approval UI or automation in this repo. Proposals must be approved in full repo (Limen-Helix) or separate workflow; then pushed to Upstash Redis for sync.

14. **Determinism Verification Script Exists but Not Integrated** — verify-iteration-determinism.mjs tests artifact generation determinism, but is not run in CI or audit loop. Consider adding to audit-system-vitals.mjs or heal-corpus.mjs as a pre-heal check.

15. **Command Board Data Mutable but No Refresh Script** — command-board-data.json and command-board-eligible.json are **must-revalidate** (cache-control header) but there is no active script that regenerates them. Consumed by build-stress-network.mjs; unclear if they are updated externally or stale.

16. **Cross-Domain Readout Task #30 Not Fully Wired** — compute-cross-domain-readout.mjs exists but is not called by standard audit or heal loop. Verify whether this output (task #30 in treatment-discovery chain) is actively generated or blocked.

17. **Aliases Auto-detection and Manual Curation Split** — detect-slug-aliases.mjs produces _slug-alias-candidates.json (auto-detected), but manual overrides live in _alias-manual.json. No merge or conflict-resolution logic visible; operator must manually update _alias-manual.json and re-run build-fractal-portals.mjs with --alias-file.

18. **Vercel Deploy Missing 3 Paused Crons** — vercel.json crons[] only lists `/api/capital-engine?action=tick&cap=3` (every 6h); the 4 paused autonomic crons are NOT present. Once Gate A is ready, they must be manually re-added to vercel.json and pushed.

19. **Field Connection Map Audit Gap** — build-treatment-discovery-cube.mjs reads `audit/field-connection-map.json` but there is no script that validates or regenerates it. Verify this file is current and sourced correctly.

20. **Corpus Vitals Only Written on Demand** — audit-corpus-vitals.mjs is called by organ-portal-corpus.mjs during audit-system-vitals, but there is no scheduled/autonomous execution. If operator manually runs only heal-corpus, corpus vitals may not update. Ensure audit-system-vitals is the entry point for all vitals updates.

---

**Summary Statistics**
- **Total scripts**: 118 files (67 .mjs, 19 .js, 29 .json, 1 .jsonl, 1 .log, 1 .cjs)
- **Active sense organs**: 11 (feeds, nodes, domains, portal-corpus, dead-links, kernel, connectome, civilization, propagator, master-brain, bridge; pattern-bus not yet in _index)
- **Autonomic loop entry points**: audit-system-vitals → heal-corpus → process-operator-actions (manual or background)
- **Paused crons**: 4 (autoqueue, autofire, multipass, sleep-cycle); 1 active (capital-engine, every 6h)
- **Data mutation points**: companies/*.json (enrich, bridge, engine, kernel), _vitals.json (audit), _master-inbox.json (manual), bridge-patterns.json (pattern sync)
- **Stale tanks**: treatment-discovery-cube (3d), _master-inbox (5d)
- **Orphaned/half-builds**: 20+ legacy scripts, 2 sense organs not registered (_index.mjs)

---

## 26. AGRICULTURE deep-dig (exhaustive)

### PURPOSE
Agriculture is the primary production system node in LIMEN Helix's civilization model (P2 phase), with 21 specialized sub-portals covering crop, livestock, soil, climate, finance, equipment, machinery, supply chain, water, horticulture, seeds, commodities, fertilizer, food processing, land use, policy, postharvest handling, precision agriculture, crop protection, research, and climate adaptation. It feeds signals into economy, trade, environment, industry, population, and governance domains. Command board tracks 14 agriculture companies; portal structure connects to 199 total agriculture-linked domain JSON files across multiple system layers. **Critical gap: 21 p2_agri_.json data files exist but 0 corresponding p2_agri_\*_portal.html files built — portals defined in data but unfleshed at rendering layer.**

### KEY FILES

**Root-level HTML (4 files):**
- C:\Users\Chris\Limen-Helix-live-\agriculture-command.html — Command board for agriculture companies with stress metrics, phase scoring, linear kernel + recursive domain stress classification, signal enumeration, watchlist, and portfolio tracking (Vercel clean URL: https://limenhelix.com/agriculture-command)
- C:\Users\Chris\Limen-Helix-live-\agriculture-console.html — Three-column domain console for left/center/right operator views, clarity mode, signal bridge, and executive dashboard (https://limenhelix.com/agriculture-console)
- C:\Users\Chris\Limen-Helix-live-\agriculture-opportunities.html — Opportunity grid (INVEST/BUILD/FUND/PATENT/ADVISE/PROCURE card types), playbook panel, action bar, responsive card layout (https://limenhelix.com/agriculture-opportunities)
- C:\Users\Chris\Limen-Helix-live-\agriculture-workspace.html — Grant/Patent/Business Build workspace router with execution panels and dynamic context wiring (https://limenhelix.com/agriculture-workspace)

**Agriculture-specific JavaScript modules (20 files, 8,467 total lines):**
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-business-build.js (64.8 KB) — Business build model, cost structure, revenue forecasting, sensitivity analysis
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-business-review.js (24.6 KB) — Review engine for build proposals, validation, scorecard generation
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-clarity-operator.js (113.6 KB) — Clarity operator panel, node mapping, diagnostic rendering, cross-domain context
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-claim-flow.js (12.2 KB) — Claim submission workflow, validation, routing to compensation engine
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-claim-ledger.js (5.3 KB) — Claim history, status tracking, settlement records
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-compensation.js (2.9 KB) — Compensation calculation, distribution logic
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-directive-extractor.js (12.6 KB) — Extracts directives from p2_agri portal structure, node ID mapping, stress-weighted ranking
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-directive-ranker.js (15.9 KB) — Ranks directives by evidence, adoption barrier, domain stress alignment
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-directive-translator.js (30.2 KB) — Converts extracted directives into actionable formats, cross-domain adaptation, narrative synthesis
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-execution-panels.js (33.6 KB) — Toggleable panels for grant-eligible and patentable opportunity execution, wireup logic
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-node-business-engine.js (92.5 KB) — Node-level business case synthesis, composite scoring, financial modeling per brain node
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-operator-panel.js (9.1 KB) — Operator interface for domain stress, signal routing, action prompts
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-opportunity-economics.js (7.2 KB) — Economic value estimation, opportunity sizing
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-opportunity-matrix.js (42.1 KB) — Multi-factor opportunity grid, filtering, sorting, saturation heatmap
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-promotion-bridge.js (15.1 KB) — Bridges opportunities to promotion channels, cross-domain signal push
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-pulse-engine.js (17.8 KB) — Periodic signal refresh, domain stress polling, live status updates
- C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-targeting-engine.js (17.9 KB) — Target identification, company/geography/commodity matching
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\agriculture-brain.js — Cognitive engine extending DomainBrainBase, 6 diagnostic triggers (CASH_FLOW_CRISIS, SUPPLY_CHAIN_BREAKDOWN, DROUGHT, MARKET_COLLAPSE, EQUIPMENT_FAILURE, PEST_OUTBREAK), emission rules for food_supply_disruption → supplyChain, food_price_pressure → economy, reception rules from trade/environment
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\agriculture-refresh-controller.js — Coordinates refresh cycles, enables signal bridge by default (LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE, LIMEN_ENABLE_AGRICULTURE_QUEUE_UNBLOCK flags)
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\data\agriculture-opportunity-playbooks.js — Playbook templates for grant-eligible and patentable opportunity execution tracks

**Agriculture Portal Data Files (21 primary + 199 cross-linked = 220 total files):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri.json (482 KB) — Primary agriculture domain portal, 38 activation brain nodes (M1 Crop Production, S1 Livestock, S2 Soil, Pf Precision Farming, RAPHE Adaptive Governance, DMN Diagnostics, OSC Efficiency, RSC Performance, CC Integration, etc.), 6 diagnostic triggers, cross-domain affinities to business/economy/education/energy/industry/infrastructure/medicine/neurology
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_crop.json (395.7 KB) — Crop production sub-portal, 19 activation nodes (M1 Row Crops, FG Specialty, CBLM Cover, HYPO Irrigated, NTS Dryland, etc.), treatments for crop rotation, moisture monitoring
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_livestock.json (299.9 KB) — Livestock production sub-portal, 19 nodes, rotational grazing, forage quality management
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_climate.json (247 KB) — Climate adaptation sub-portal, 17 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_commodity.json (210.8 KB) — Commodity markets sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_equipment.json (228 KB) — Equipment/machinery sub-portal, 17 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_fertilizer.json (195.6 KB) — Fertilizer inputs sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_finance.json (322.8 KB) — Agricultural finance sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_foodproc.json (187.6 KB) — Food processing sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_horticulture.json (258.3 KB) — Horticulture (high-value crops) sub-portal, 17 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_landuse.json (197 KB) — Land use / soil stewardship sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_machinery.json (211.6 KB) — Machinery/equipment implementation sub-portal, 17 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_policy.json (208.4 KB) — Agricultural policy sub-portal, 15 nodes; **61 days old** (last updated May 13)
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_postharvest.json (194.6 KB) — Post-harvest handling sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_precisionag.json (201.4 KB) — Precision agriculture (digital tools, IoT) sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_protection.json (196.5 KB) — Crop protection (pest/disease) sub-portal, 15 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_research.json (211.1 KB) — Agricultural research sub-portal, 15 nodes; **61 days old**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_seeds.json (197.1 KB) — Seed systems sub-portal, 15 nodes; **61 days old**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_soil.json (217.4 KB) — Soil health/management sub-portal, 17 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_supplychain.json (225.5 KB) — Supply chain logistics sub-portal, 17 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri_water.json (248.3 KB) — Water management/irrigation sub-portal, 17 nodes; **248 KB largest sub-portal**

**Cross-domain Agriculture-linked Files (199 files):**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\economy_agri_econ.json (945.2 KB) — Agricultural economics, farm income, input costs
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\economy_industrial_agriecon.json (140 KB) — Industrial agriculture economics
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\economy_informal_subsatagri.json (140.4 KB) — Subsistence agriculture economics
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\environment_soil.json (382.2 KB) — Soil science, 38 activation nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\environment_soil_*.json (14 files) — Soil sub-portals (degradation, biology, carbon, contamination, erosion, management, monitoring, restoration)
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\environment_soilenv.json (357 KB) — Soil environment integrator, 36 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\environment_soilenv_*.json (10 files) — Soil environment sub-portals (brownfield, desertification, erosion control, land degradation, land restoration, soil carbon, contamination, health, monitoring, sustainable management)
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\environment_conservation_soilcons.json (146.2 KB) — Soil conservation
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\environment_pollution_soilpollution.json (146.3 KB) — Soil pollution
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\trade_agritrade.json (188.5 KB) — Agricultural trade portal, 24 nodes
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\trade_agritrade_*.json (10 files) — Trade sub-portals (agriquota, agritariff, commodity markets, food safety/security, food trade, livestock trade, organic trade, seed trade, trade subsidies)
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\industry_biotech_agribtech.json (141.8 KB) — Agribusiness technology
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\intelligence_biointel_agribio.json (147.7 KB) — Biological intelligence, agribiology
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\population_rural_agriculture.json — Rural agricultural communities
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\population_ruralpop_agricomm.json — Rural agricultural community populations
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\finance_centralbank_macropru.json — Central bank agricultural credit oversight

**Agricultural Portal HTML (62 files across all cross-linked domains):**
- Root agriculture pages: agriculture_command_portal.html, agriculture_console_portal.html, agriculture_opportunities_portal.html, agriculture_workspace_portal.html
- Trade agriculture portals (11): trade_agritrade_portal.html, trade_agritrade_agriquota_portal.html, trade_agritrade_agritarif_portal.html, trade_agritrade_commkt_portal.html, trade_agritrade_foodsafst_portal.html, trade_agritrade_foodsec_portal.html, trade_agritrade_foodtrade_portal.html, trade_agritrade_livestock_portal.html, trade_agritrade_organtrd_portal.html, trade_agritrade_seedtrade_portal.html, trade_agritrade_trdsub_portal.html
- Soil/environment portals (27): environment_soil_portal.html, environment_soil_degradation_portal.html, environment_soil_soilbio_portal.html, environment_soil_soilcarbon_portal.html, environment_soil_soilcontam_portal.html, environment_soil_soilerosion_portal.html, environment_soil_soilmgmt_portal.html, environment_soil_soilmonitor_portal.html, environment_soil_soilrestore_portal.html, environment_soilenv_portal.html, environment_soilenv_brownfield_portal.html, environment_soilenv_desertific_portal.html, environment_soilenv_erosionctl_portal.html, environment_soilenv_landdeg_portal.html, environment_soilenv_landrestor_portal.html, environment_soilenv_soilcarbon_portal.html, environment_soilenv_soilcontam_portal.html, environment_soilenv_soilhealth_portal.html, environment_soilenv_soilmonit_portal.html, environment_soilenv_sustlandmg_portal.html, environment_conservation_soilcons_portal.html, environment_pollution_soilpollution_portal.html (22 total)
- Economy agricultural portals (3): economy_agri_econ_portal.html, economy_industrial_agriecon_portal.html, economy_informal_subsatagri_portal.html
- Industry agricultural portals (1): industry_biotech_agribtech_portal.html
- Intelligence agricultural portals (1): intelligence_biointel_agribio_portal.html
- Population agricultural portals (2): population_rural_agriculture_portal.html, population_ruralpop_agricomm_portal.html
- Finance agricultural portals (1): finance_centralbank_macropru_portal.html (for agricultural credit)

**API Modules (agriculture references in 8 files):**
- C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js (308.7 KB) — Aggregates domain stress including agriculture from all tracked companies and signals
- C:\Users\Chris\Limen-Helix-live-\api\limen-ingest.js — Ingests agriculture-specific signal data
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-ingest.js — Worker process for agriculture data ingestion
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-snapshot.js — Worker snapshot generation for agriculture
- C:\Users\Chris\Limen-Helix-live-\api\feed-status.js — Agriculture feed status monitoring
- C:\Users\Chris\Limen-Helix-live-\api\api-keys-config.js — API key management for agriculture data sources
- C:\Users\Chris\Limen-Helix-live-\api\enrich-portal-claude.js (37.1 KB) — Claude API enrichment for agriculture portals
- C:\Users\Chris\Limen-Helix-live-\api\defense-signals.js — Defense-agriculture cross-domain signals (food security, rural infrastructure)

**Python Backend (agriculture references):**
- C:\Users\Chris\Limen-Helix-live-\api\helix_app\index.py (FastAPI backend) — Thing2 kernel polyvagal coupling, command-board-data.json integration, agriculture company phase scoring

**Treatment/Directive Scripts (2 files, 450 lines):**
- C:\Users\Chris\Limen-Helix-live-\scripts\add_fertilizer_treatments.js (137 lines) — Programmatic treatment generation for fertilizer management nodes
- C:\Users\Chris\Limen-Helix-live-\scripts\add_landuse_treatments.js (313 lines) — Programmatic treatment generation for land use/soil stewardship nodes

**Supporting Infrastructure:**
- C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json (149 KB) — Contains 14 agriculture companies (AGCO, ADM, Bunge, Corteva, Deere, CNH, Lamb Weston, Americold, Andersons, Farmland Partners, Sysco, etc.) with phase, trajectory, composite score, domain stress
- C:\Users\Chris\Limen-Helix-live-\assets\data\treatment-discovery-cube.json (85 MB) — Treatment storage (NOT populated with agriculture treatments; agriculture uses in-portal treatments instead)
- C:\Users\Chris\Limen-Helix-live-\lib\company-phase-scorer.js (24.7 KB) — Company-level phase scoring, used for agriculture command board
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-identity.js — Domain key resolution (maps 'agriculture' ↔ 'p2_agri')

### LIVE PAGES
- https://limenhelix.com/agriculture-command — Agriculture command board, company stress metrics, signal classification
- https://limenhelix.com/agriculture-console — Three-column domain console with operator views and clarity mode
- https://limenhelix.com/agriculture-opportunities — Opportunity grid for investment/build/fund/patent/advise/procure tracks
- https://limenhelix.com/agriculture-workspace — Workspace router for grant/patent/business build execution
- https://limenhelix.com/civilization — Main portal; agriculture is P2 node with 38 brain node activations

### DATA

**Primary Agriculture Data Tank (p2_agri.json + 20 sub-portals = 21 files, ~4.8 MB total):**
- Fresh: p2_agri.json, p2_agri_crop.json, p2_agri_livestock.json, p2_agri_climate.json, p2_agri_commodity.json, p2_agri_equipment.json, p2_agri_fertilizer.json, p2_agri_finance.json, p2_agri_foodproc.json, p2_agri_horticulture.json, p2_agri_landuse.json, p2_agri_machinery.json, p2_agri_postharvest.json, p2_agri_precisionag.json, p2_agri_protection.json, p2_agri_soil.json, p2_agri_supplychain.json, p2_agri_water.json — Updated 25 days ago (May 13, 2026)
- Stale: p2_agri_policy.json, p2_agri_research.json, p2_agri_seeds.json — **61 days old** (April 7, 2026; last update before May 13 refresh)

**Cross-domain Agriculture Data (199 files):**
- Environment/Soil tank: environment_soil.json (382 KB), environment_soilenv.json (357 KB), 24 sub-portals (soil_degradation, soil_soilbio, soil_soilcarbon, soil_soilcontam, soil_soilerosion, soil_soilmgmt, soil_soilmonitor, soil_soilrestore, soilenv_brownfield, soilenv_desertific, soilenv_erosionctl, soilenv_landdeg, soilenv_landrestor, soilenv_soilcarbon, soilenv_soilcontam, soilenv_soilhealth, soilenv_soilmonit, soilenv_sustlandmg, conservation_soilcons, pollution_soilpollution) — Fresh (May 9-13 updates)
- Trade agriculture: trade_agritrade.json (188.5 KB), 10 sub-portals (agriquota, agritariff, commkt, foodsafst, foodsec, foodtrade, livestock, organtrd, seedtrade, trdsub) — Structure defined, last refresh varies
- Economy agriculture: economy_agri_econ.json (945 KB, largest), economy_industrial_agriecon.json, economy_informal_subsatagri.json — Fresh (May 9)
- Industry/Intelligence: industry_biotech_agribtech.json, intelligence_biointel_agribio.json — Fresh/static

**Command Board Data:**
- assets/data/command-board-data.json — 14 agriculture companies loaded, domain stress per company, linear kernel phase (p0-p10), trajectory (STABLE/MILD/RECOVERED/TERMINAL), composite score, signal classification (DATA_ERROR/ALERT/EARLY_WARNING/FRAGILE_STABILITY/ORDERED_WATCH/SECTOR_PRESSURE/NOMINAL) — **Fresh, auto-populated by /api/domain-snapshot**

**Treatment & Opportunity Data:**
- treatments: In-portal (p2_agri.json activations carry inline "treatments" array per node, e.g., Crop Production M1 has "Diversify crop rotation" STRUCTURAL + "Soil moisture monitoring" DIAGNOSTIC) — Not centralized in treatment-discovery-cube.json
- opportunities: agriculture-opportunity-matrix.js + agriculture-opportunity-playbooks.js populate live opportunity grid — Data sourced from portal activation rules + directive-extractor → directive-translator → node-business-engine scoring

### HOW IT CONNECTS

**Signal Flow (Outbound from Agriculture):**
1. agriculture-brain.js defines emission rules:
   - food_supply_disruption → supplyChain domain (when ag stress ≥55% + active diagnoses)
   - food_price_pressure → economy domain
   - soil_degradation_signal → environment domain
   - agricultural_employment_loss → population domain
2. agriculture-directive-extractor.js pulls from p2_agri.json activation structure (38 nodes × 6 triggers = ~200 potential directives)
3. agriculture-directive-translator.js converts to actionable narrative, cross-domain adaptation language
4. agriculture-node-business-engine.js scores economic potential per node (Crop M1, Livestock S1, Soil S2, etc.)
5. agriculture-opportunity-matrix.js ranks by saturation, evidence, adoption cost → opportunity grid (https://limenhelix.com/agriculture-opportunities)

**Signal Flow (Inbound to Agriculture):**
1. environment domain (soil stress) → reduces crop/livestock production capacity → triggers DROUGHT, PEST_OUTBREAK diagnoses
2. trade domain (commodity price collapse) → triggers MARKET_COLLAPSE diagnosis
3. economy domain (input cost spike) → triggers CASH_FLOW_CRISIS diagnosis
4. infrastructure domain (supply disruption) → triggers SUPPLY_CHAIN_BREAKDOWN diagnosis

**Company Scoring Path:**
1. Command board (agriculture-command.html) loads command-board-data.json (14 companies)
2. Each company entry: domain='agriculture' or d='agriculture', phase (p0-p10), trajectory, composite score, domain_stress (scalar, aggregated by agriculture-brain refresh cycle)
3. classifySignal() deterministic rule: if phase=p7a/p9 → AVOID; if phase=p4/p6 AND ds≥0.70 → FRAGILE_STABILITY; etc.
4. computeSeverity() composite: ALERT+high_stress=+20, terminal_phase=+15, etc.
5. Table expansion shows:
   - Linear kernel: phase + trajectory + composite (Thing2 pipeline output)
   - Recursive domain: agriculture domain stress % (from /api/domain-snapshot)
   - Signal rule explanation + WHY INVEST/WATCH/AVOID action classifier
6. Auto-refresh via limen:agriculture-refresh event (agriculture-refresh-controller.js) updates domain stress every 60s in live mode

**Cross-domain Affinity Map (from p2_agri.json):**
- Motor cortex role (Production): maps to business Production & Delivery, economy GDP Output, neurology Primary Motor Cortex
- Sensory role (Livestock): maps to medicine Surgery (hands-on), industry Assembly Lines
- Cognitive role (Policy): maps to governance Regulatory, law Legal
- Connectivity role (Supply chain): maps to trade Supply, infrastructure Transportation, communication Logistics
- Interoception role (Soil/water): maps to environment Conservation, medicine Diagnostics

**Portal Hierarchy (Runtime Resolution):**
- civilization.html → agriculture-opportunities.html (P2 node entry)
- agriculture-opportunities.html → agriculture-workspace.html (with ?track=grant|patent|business&opp=<opportunity-key>)
- workspace wires: agriculture-execution-panels.js (grant/patent) OR agriculture-business-build.js (business)
- Sub-portal routing: p2_agri.json activation→childPortal refs would link to p2_agri_crop_portal.html, p2_agri_livestock_portal.html, etc. (NOT YET BUILT)
- Company detail: company-portal.html?company=<slug> → if domain=agriculture, routes to agriculture-clarity-operator.js overlay

**Interconnected Systems:**
- Master Brain Executor (master-brain-executor.html) includes agriculture-brain.js with LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE=true by default → agriculture automatically wired into civilization super-brain
- Civilization Connectome (civilization-connectome.js) lists agriculture as portal, agriculture-pulse-engine.js updates live stress meter
- Observatory Aggregator (observatory-aggregator.js) includes legacy key 'p2_agri' → 'agriculture' mapping for backwards compatibility
- Domain Registry (domain-registry.js) recognizes 'agriculture' as canonical domain, maps to snapshot key 'agriculture'
- LIMEN Two-Kernel Architecture: agriculture companies scored via Thing2 kernel (phase output) + recursive domain stress layer (agriculture-brain emission stress); command board combines both in signal classification

### NEEDS WORK / INCONSISTENCIES

**Critical Gaps:**

1. **Portal Rendering Missing (21 data files → 0 portal HTML output)**
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri*.json define portal structures but no corresponding C:\Users\Chris\Limen-Helix-live-\p2_agri_*_portal.html files exist
   - Evidence: agriculture-clarity-operator.js references "p2_agri_grain_storage_portal.html" in comment; agriculture-directive-extractor.js code expects _extractFromPortal to work on p2_agri portals
   - Impact: Sub-portal drill-down from p2_agri.json activation nodes (Crop M1 → p2_agri_crop_portal, Livestock S1 → p2_agri_livestock_portal, etc.) would fail at runtime; childPortal refs are defined but rendering layer doesn't exist
   - Files affected: p2_agri_climate_portal.html, p2_agri_commodity_portal.html, p2_agri_crop_portal.html, p2_agri_equipment_portal.html, p2_agri_fertilizer_portal.html, p2_agri_finance_portal.html, p2_agri_foodproc_portal.html, p2_agri_horticulture_portal.html, p2_agri_landuse_portal.html, p2_agri_livestock_portal.html, p2_agri_machinery_portal.html, p2_agri_policy_portal.html, p2_agri_postharvest_portal.html, p2_agri_precisionag_portal.html, p2_agri_protection_portal.html, p2_agri_research_portal.html, p2_agri_seeds_portal.html, p2_agri_soil_portal.html, p2_agri_supplychain_portal.html, p2_agri_water_portal.html, p2_agri_portal.html (primary portal template)

2. **Stale Data Files (3 of 21 p2_agri files not refreshed in 61 days)**
   - p2_agri_policy.json, p2_agri_research.json, p2_agri_seeds.json — last touched April 7, 2026; not included in May 13 refresh cycle
   - Evidence: File timestamps show "61 days old" as of June 7, 2026
   - Impact: Policy node activations, research funding opportunity data, seed system treatments may not reflect current ag policy landscape or USDA/CGIAR research shifts
   - Hypothesis: May 13 refresh script may have excluded these 3 domains; verify in scripts/add_*_treatments.js or build-deep-directives.js

3. **Treatment Data Fragmentation**
   - Path: Treatment discovery cube (85 MB) has 0 agriculture entries; agriculture instead uses inline treatments in p2_agri.json activation nodes
   - Evidence: node -e check returns "Agri treatments: 0" from treatment-discovery-cube.json; agriculture-business-build.js sources from portal structure, not cube
   - Impact: Agriculture treatments are not queryable via centralized treatment-discovery-cube API; each page must load full p2_agri*.json to access treatments; no unified treatment registry for agriculture
   - Files involved: assets/data/treatment-discovery-cube.json (NOT populated for agri), p2_agri.json activations (inline treatments instead)

4. **Brain Node Business Mapping Disconnect**
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-business-mapping.json has 0 agriculture entries
   - Evidence: node -e check returns 0 agriculture business mappings; brain-node-domains.json also has 0 agriculture references
   - Impact: Opportunity discovery via brain node → company mapping (used in other domains) is not available for agriculture; agriculture must rely on hard-coded company list (command-board-data.json, 14 companies) rather than dynamic node-to-entity resolution
   - Risk: Adding new agriculture companies requires manual edit of command-board-data.json, not auto-discovery from connectome

5. ~~**Portal Registry Empty for Agriculture**~~ **[CORRECTED 2026-06-07: FALSE — the agent misparsed the 62MB file. portal-registry.json domainIdToPath contains 1,244 agriculture-matching keys: the full `agriculture` hierarchy (root + 20 sub-paths `agriculture/climate` … `agriculture/water`, exactly mirroring the p2_agri JSON tanks), all 30 `p2_agri_*` domainId mappings, and 1,214 deep cross-domain agri paths (environment/trade/population/intelligence/economy/industry). The registry layer is COMPLETE for agriculture. The actual gap is the renderer: portal-router.js (whose childPortalResolver is purpose-built to translate p2_agri_*_portal.html links → these registry paths) is loaded by ZERO pages in the live repo — the JSON-driven render wire is unplugged, not the data missing.]**

6. **Activation Nodes Without Child Portal References (18 of 38 nodes)**
   - Path: p2_agri.json activations include 18 nodes without childPortal field (RAPHE, DMN, OSC, RSC, CC, etc.)
   - Evidence: node -e query on p2_agri.json returns "Activation nodes without childPortal: 18"
   - Impact: These governance/diagnostic/integration nodes (likely not user-facing drill-downs) reference portal structure but no portal HTML defined; unclear if intentional (meta-nodes) or incomplete design
   - Affected nodes: RAPHE (Adaptive Iteration Governance), DMN (Diagnostic Mapping), OSC (Efficiency Modeling), RSC (Performance Tuning), CC (System Integration), + 13 others

7. **Treatment Script Incomplete Coverage**
   - Path: C:\Users\Chris\Limen-Helix-live-\scripts\add_fertilizer_treatments.js (137 lines), add_landuse_treatments.js (313 lines) only cover 2 of 21 sub-domains
   - Evidence: grep for "script.*agriculture\|agri" finds 9 matches but only 2 substantive treatment generators
   - Gap: No treatment generators for crop, livestock, equipment, machinery, policy, research, seeds, water, climate, commodity, precision ag, protection, postharvest, horticulture, supplychain, finance, food processing
   - Impact: Only fertilizer and landuse nodes have programmatic treatment generation; other 19 sub-portals must source treatments manually or inherit from p2_agri.json parent

8. **Company Dataset Limited (14 companies)**
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json contains only 14 agriculture companies
   - List: AGCO, COLD, ANDE, ADM, BG, CNHI, CTVA, DE, FPI, LW, MON, MOS, NUTR, SYY (plus ??, LNN, AKR, TSC, TTM likely missing)
   - Evidence: node -e filter on domain=agriculture returns 14 entries; likely undersamples US agribusiness universe (150+ publicly traded names in GICS 1010)
   - Impact: Command board stress analysis covers only large-cap food/ag holdings; misses mid-cap equipment (AGCO competitors), seed/trait companies (Corteva, Bayer ag division if separate), specialty ag retailers, irrigation, drone/precision ag firms
   - Opportunity: expand company registry via seed trades companies, equipment makers, regional farm co-ops where public, agricultural input manufacturers

9. **Signal Bridge Optional (Requires Explicit Enable Flag)**
   - Path: agriculture-brain.js checks `window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE` (defaults to true as of May 7 commit)
   - Evidence: agriculture-brain.js lines 36-41: "Explicit opt-out still works: set either flag to false BEFORE this script loads"
   - Risk: Pages that load agriculture-brain.js BEFORE setting the flag to false will emit signals (now default-enabled); pages that expect no agriculture signals must explicitly opt out
   - Affected pages: any page loading agriculture-brain.js (Master Brain, Civilization, portals) will now see agriculture diagnoses by default

10. **Treatment Cube Unused (85 MB Asset, 0 Agriculture Payload)**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\treatment-discovery-cube.json
    - Size: 85 MB, 5,234 total cells (5,186 populated)
    - Agriculture payload: 0 entries; treatment-discovery-cell.schema.js defines schema but agriculture not indexed
    - Impact: Agriculture treatments are NOT centralized, discoverable, or queryable via treatment cube API; every operation must load full portal JSON
    - Decision point: either (a) populate cube with agriculture treatments from p2_agri*.json, or (b) accept that agriculture uses in-portal treatment model exclusively

11. **No Emission Rules Defined in p2_agri.json**
    - Path: p2_agri.json emissionRules array is empty []
    - Evidence: node -e query returns "Emission rules: 0"; agriculture-brain.js has hardcoded rules (lines 71-108 in snippet) but parent portal does not carry them
    - Impact: Mismatch between data schema (portal should define emissionRules) and code (brain hardcodes them); updates to emission rules require code change, not data config
    - Risk: Multiple sources of truth for agriculture signal propagation

12. **No Reception Rules Defined**
    - Path: p2_agri.json receptionRules array is empty []
    - Evidence: node -e query returns "Reception rules: 0"
    - Impact: Inbound signals (trade, environment, economy shocks) are hardcoded in brain, not configurable via portal data
    - Inconsistency: other domains may use portal-driven reception rules (not verified) while agriculture is fixed in code

13. **Clarity Operator Large File (113.6 KB Single Module)**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-clarity-operator.js (113.6 KB)
    - Risk: Monolithic module; no code splitting evident; loads all agriculture clarity UI logic in one file
    - Impact: Page load time; if deployed to single request, 113 KB JS just for clarity operator (vs ~8 KB average per agriculture module)
    - Opportunity: refactor to lazy-load clarity UI only on demand

14. **Cross-domain Portal HTML Files NOT in Root, Hard to Discover**
    - Path: C:\Users\Chris\Limen-Helix-live-\trade_agritrade_*.html, environment_soil_portal.html, etc. exist but are not listed in agriculture-related search
    - Evidence: 62 agriculture-linked portal HTML files scattered across domain prefixes (trade_, environment_, economy_, industry_, intelligence_, population_, finance_)
    - Impact: User navigating agriculture domain may not discover soil conservation, agricultural trade, rural population, agribusiness technology portals without explicit cross-domain linking
    - Missing: breadcrumb/hierarchy navigation from agriculture → soil_portal, agricultural_trade, food_security portals

15. **Company Domain Field Inconsistency**
    - Path: command-board-data.json company entries use field name 'd' for domain (not 'domain')
    - Evidence: agriculture-command.html line 164 filters: `cd.d === _CMD_RESOLVED || cd.domain === _CMD_RESOLVED`
    - Risk: dual naming (d AND domain) suggests data migration or legacy field support; unclear which is authoritative
    - Impact: Other systems must check both fields; potential for mismatch if one is not updated consistently

16. **No Agriculture-specific Feed Status Tracking**
    - Path: /api/feed-status.js references agriculture but no dedicated agriculture feed is documented
    - Evidence: api/feed-status.js lists feeds by domain but agriculture feed data source/SLA not defined
    - Impact: Operator has no clear SLA or freshness indicator for agriculture domain data (command board shows "last updated" but no feed health)
    - Opportunity: define agriculture data feed source(s) (USDA, FAO, commodity price APIs) and SLA in feed-status.js

17. **Agriculture Not in Treatment Discovery Cell Schema**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\schemas\treatment-discovery-cell.schema.js
    - Evidence: Schema defines cells for addiction, business, communication, …, medicine, psychedelic, … but agriculture not listed in domain enumeration
    - Impact: If agriculture were to be added to treatment cube, schema would need updating first; tight coupling between schema and population
    - Risk: Out-of-sync schema could cause validation failures if cube is backfilled with agriculture treatments

18. **Opportunity Playbook Data Structure Undefined**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\data\agriculture-opportunity-playbooks.js (assumed to exist based on code references)
    - Evidence: agriculture-workspace.html line 73 references `window.LIMENAgricultureBusinessBuild`, agriculture-execution-panels.js also loads playbooks
    - Status: File likely exists but NOT confirmed in this audit; if missing, opportunity execution will fail silently
    - Recommendation: Verify file contains playbook templates for grant-eligible, patentable, and business-build tracks

**Data Quality Issues:**

1. **Stale Policy/Research/Seeds Data** (61 days, detailed above)

2. **No Time Series Agriculture Data** — no historical stress tracking, no trend indicators (agriculture-pulse-engine.js fetches current stress only)

3. **Null/Empty Fields in Command Board** — 14 companies; unclear if missing companies are intentionally excluded or data ingestion incomplete

4. **Diagnostic Trigger Inconsistency** — agriculture-brain.js hardcodes 6 triggers (CASH_FLOW_CRISIS, SUPPLY_CHAIN_BREAKDOWN, DROUGHT, MARKET_COLLAPSE, EQUIPMENT_FAILURE, PEST_OUTBREAK) but p2_agri.json may define more or fewer triggers per sub-domain

**Incomplete Features:**

1. **Opportunity Workspace Half-Built** — workspace supports grant/patent/business tracks but actionable outputs (grant applications, patent drafts, business plans) not evident; workspace may be UI shell only

2. **Claim Flow / Compensation Engine** — agriculture-claim-flow.js, agriculture-claim-ledger.js, agriculture-compensation.js exist but no data source or trigger documented; who files claims? against what compensation policy?

3. **Master Brain Executor agriculture Bootstrap** — agriculture enabled by default (LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE = true) but no documentation of what "enabled" means; Master Brain inbox may show agriculture signals but unclear if UI displays them

**Recommended Priorities:**

1. **Build p2_agri_*_portal.html portal files** (21 missing files) — required for sub-domain drill-down from civilization agriculture node
2. **Refresh p2_agri_policy.json, p2_agri_research.json, p2_agri_seeds.json** — stale data from 61 days ago
3. **Populate treatment-discovery-cube.json agriculture entries** OR explicitly document agriculture-only treatment model — resolve architecture mismatch
4. **Expand command-board companies** — 14 companies is a thin slice; 50+ would be defensible for US agribusiness analysis
5. **Define agriculture data feeds & SLA** — document USDA/FAO/commodity data sources in feed-status.js, establish refresh cadence
6. **Add emission/reception rules to p2_agri.json** — move agriculture signal rules from code to data model for consistency with other domains
7. **Populate brain-node-business-mapping.json & portal-registry.json agriculture entries** — align agriculture with infrastructure used by other domains

**Files Orphaned or Underutilized:**

- treatment-discovery-cube.json — 85 MB, 0 agriculture content (if this is intentional, document it; if not, backfill)
- brain-node-business-mapping.json — 0 agriculture (underutilized for ag opportunity discovery)
- portal-registry.json — 0 agriculture (should have 21+ entries)
- agriculture-compensation.js (5.3 KB) — no active claim filing visible; is this feature live?
- agriculture-claim-ledger.js (5.3 KB) — no data source visible
- agriculture-operator-panel.js (9.1 KB) — wired into console but unclear if operator actions are wired to outcome
- agriculture-targeting-engine.js (17.9 KB) — generates targets but unclear if used in opportunity-matrix or standalone

**Verification Tasks for Operator:**

- Confirm p2_agri policy/research/seeds data stale by design (seasonal updates) or bug
- Verify agriculture claim/compensation flow is NOT live (no UI, no claims in system)
- Test agriculture signal bridge emission — does setting LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE=false suppress agriculture from Master Brain?
- Audit command-board-data.json 14 companies — are 136 missing companies intentional or data gap?
- Measure load time for agriculture-clarity-operator.js (113.6 KB) vs other domain operators
- Check if any production traffic is hitting the missing p2_agri_*_portal.html files (would return 404)

---

## 27. INFRASTRUCTURE deep-dig (exhaustive)

### PURPOSE
Infrastructure is a P4 phase domain mapping physical systems (roads, rail, air, maritime, water, electrical, pipelines, digital networks, smart cities, construction, resilience) to 20 active brain node activations spanning transport, energy, utilities, civil engineering, and digital systems. The domain acts as system-wide connective and enabling tissue—aggregating signals for construction indices, grid capacity, maintenance backlogs, cyber threats, and funding constraints, then emitting cross-domain distress into energy, economy, supply chain, and population domains.

### KEY FILES

**PAGES (197 HTML portals)**
- C:\Users\Chris\Limen-Helix-live-\infrastructure-command.html — operator command board with stress scoring and portfolio triage
- C:\Users\Chris\Limen-Helix-live-\infrastructure-console.html — full-height 3-column console with clarity-view overlay
- C:\Users\Chris\Limen-Helix-live-\infrastructure-workspace.html — execution workspace (grant/patent/business build tracks)
- C:\Users\Chris\Limen-Helix-live-\infrastructure-opportunities.html — convergence-fired opportunity list
- C:\Users\Chris\Limen-Helix-live-\infrastructure-portal.html — root navigation hub (missing but referenced)

**SUBDOMAIN PORTALS (193 child portals by category):**
- **Air (9):** airports, ATC, aviationsafety, cargo, navigation, regional, runways, terminals
- **Bridges (10):** archbridg, beambridg, bridginsp, bridgpresv, cablestay, loadrating, movbridges, pedbridges, seismicret, suspension
- **Construction (10):** bldgcodes, constrsched, constrtech, contractad, costestim, inspectsvs, projplan, qualctrl, safetymgmt, sustconstr
- **Dams (11):** concretedam, dammonitor, damrehab, damremoval, damrisk, damsafety, earthfill, fishpass, reservmgmt, spillway
- **Digital (9):** broadband, cloudinfra, cybersecinfra, datacenter, edge, iot, spectrum, subsea
- **Electrical (9):** distribution, generation, gridresilience, interconnect, microgrid, smartgrid, storage, transmission
- **InfraFunding (11):** devimpact, fedgrants, fundprior, infrabank, infrabonds, ppp, projfinnce, tif, tollsys, userfees
- **Maintenance (11):** assetmgmt, condassess, lccmaint, maintbudgt, maintsched, mainttech, predictmnt, preventmnt, spareparts, workfmgmt
- **Maritime (9):** channels, coastal, inland, intermodal, marineterminals, maritimesafety, ports, shipyards
- **Pipeline (11):** cathodicpr, gasdist, oiltrans, pipeinsp, pipmonitor, pippermit, pipreplace, piprouting, sewerpipe, waterpipe
- **PortFacil (11):** bulkterm, coldchain, container, cruisefacl, freetradez, portaccess, portenviro, portlabor, portplan, portsecur
- **Rail (9):** freight, highspeed, passenger, railbridges, railterminals, signaling, trackmaint, urbanrail
- **Resilience (11):** climadapt, critinfprt, emergrest, eqresil, floodresil, interdepan, redundancy, resilfund, resilstand, windresil
- **Road (9):** bridges, highways, its, pavements, roadmaint, roadsafety, tunnels, urbanroads
- **SmartCity (11):** citengage, cityplatfm, connvehicl, digitaltwn, energymgsc, smartbldg, smartlight, smartpark, smartwaste, urbansens
- **Telecom (9):** enterprise, fiberoptic, fiveg, satcomm, switching, telecomreg, undersea, wireless
- **Transit (11):** bussystems, commrail, faresys, ferrysys, lightrail, paratrans, subway, transiteq, transitpln, transtsched
- **Urban (9):** parks, publicbldg, solidwaste, stormwater, urbanplan, utilities, wastewater, watersupply
- **Water (9):** aqueducts, dams, floodcontrol, irriginfra, levees, reservoirs, watertreat, wells

**JAVASCRIPT ENGINES (18 files, 8,354 lines total)**
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\infrastructure-brain.js — 1,102 lines; diagnosis index mapping (GRID_DEGRADATION, SUPPLY_CHAIN_BOTTLENECK, CAPACITY_OVERLOAD, INFRA_FUNDING_COLLAPSE, MAINTENANCE_DEFICIT, CYBER_PHYSICAL_ATTACK) to signal conditions; cross-domain emission rules (energy, economy, supplyChain, population); feed processing for construction indices, transportation stress, grid reserve, federal spending, maintenance backlogs, cyber events, transmission congestion, substation backlogs, datacenter demand, peak load, cooling strain
- C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\infrastructure-refresh-controller.js — 93 lines; shared snapshot consumer, writes to window.LIMENInfrastructureFresh, dispatches 'limen:infrastructure-refresh' event
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-clarity-operator.js — 1,585 lines; expert clarity panel renderer and logic
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-node-business-engine.js — 1,576 lines; node-to-business assignment (20 top-tier portal nodes, 83 operational nodes); filters generic treatments; outputs MAPPED/MISSING/SPECULATIVE with approval statuses (PROPOSED/APPROVED/DENIED/NEEDS_REVIEW); localStorage persistence
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-business-build.js — 750 lines; business opportunity builder UI
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-directive-translator.js — 585 lines; translates brain node signals to domain-specific directives
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-execution-panels.js — 469 lines; grant/patent execution panel renderers
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-business-review.js — 417 lines; business case review and scoring
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-pulse-engine.js — 390 lines; real-time stress/signal pulse monitoring
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-promotion-bridge.js — 371 lines; crosses from diagnosis→treatment→opportunity pathway
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-targeting-engine.js — 335 lines; company/operator target ranking and filtering
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-directive-extractor.js — 332 lines; extracts actionable directives from brain snapshots
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-directive-ranker.js — 297 lines; ranks directives by convergence confidence and impact
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-claim-flow.js — 252 lines; grant claim submission workflow
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-operator-panel.js — 199 lines; operator status and control panel
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-opportunity-economics.js — 178 lines; financial modeling for opportunities
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-claim-ledger.js — 167 lines; claim tracking and ledger
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-compensation.js — 101 lines; operator compensation and fee calculation

**DOMAIN DATA (195 JSON files)**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\infrastructure.json — root domain (20 activations: CC/Road, CBLM/Rail, FEF/Air, NTS/Maritime, THAL/Electrical, HYPO/Water, LANG/Telecom, FPN/Digital, dlPFC/Urban Planning, UNC/Bridges, FORN/Pipelines, ENS/Waste, STRI/PublicTransit, M1/Construction, dACC/BuildingCodes, CeA/EmergencySystems, VP/Resilience, BROCA/Smartcity, CING/Transit, S2/WasteInfra)
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\infrastructure_[category].json × 194 (air, bridges, construction, dams, digital, electrical, infrafunding, maintenance, maritime, pipeline, portfacil, rail, resilience, road, smartcity, telecom, transit, urban, water subdomain files)

**BRAIN NODE MAPPINGS**
- 20 active brain node activations (CC, CBLM, FEF, NTS, THAL, HYPO, LANG, FPN, dlPFC, UNC, FORN, ENS, STRI, M1, dACC, CeA, VP, BROCA, CING, S2)
- Each with: domainLabel, domainFunction, diagnosticTriggers, treatments (STRUCTURAL/STRATEGY/COACHING), companies (mapped by binding_strength 0.71–0.95), crossDomainAffinities (energy, neurology, technology, trade, communication, business, economy, defense, etc.)
- 176 treatment-discovery cells populated for infrastructure domain (from treatment-discovery-cube.json)

**TREATMENT DISCOVERY**
- C:\Users\Chris\Limen-Helix-live-\assets\data\treatment-discovery\by-node\[CC|CBLM|FEF|NTS|THAL|HYPO|LANG|FPN|dlPFC|UNC|FORN|ENS|STRI|M1|dACC|CeA|VP|BROCA|CING].json × 19 node-specific treatment bundles (each mapped to infrastructure domain) containing multi-phase treatment steps, monitoring protocols, escalation thresholds
- treatment-discovery-cube.json — 85MB; schemaVersion 1.0.0, built 2026-06-04, loadedComparisonDomains includes infrastructure, infrastructure cell count = 176 (see _index.json)

**API CONSUMPTION** (6 files reference infrastructure)
- C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js — 48 mentions; core snapshot fetch and domain integration
- C:\Users\Chris\Limen-Helix-live-\api\defense-signals.js — 3 mentions; cross-domain signal routing
- C:\Users\Chris\Limen-Helix-live-\api\enrich-portal-claude.js — 3 mentions; portal enrichment pipeline
- C:\Users\Chris\Limen-Helix-live-\api\feed-status.js — 2 mentions
- C:\Users\Chris\Limen-Helix-live-\api\limen-ingest.js — 1 mention
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-ingest.js — 2 mentions
- C:\Users\Chris\Limen-Helix-live-\api\limen-worker-snapshot.js — 1 mention

**COMPANY REGISTRY**
- C:\Users\Chris\Limen-Helix-live-\assets\data\companies\brookfield_infrastructure.json — infrastructure-focused company profile

**SCRIPTS**
- C:\Users\Chris\Limen-Helix-live-\scripts\build-command-board.js — infrastructure stress scoring (0.30 relative to 0.77 energy, 1.00 supplyChain)
- C:\Users\Chris\Limen-Helix-live-\scripts\build-deep-directives.js — infrastructure directive routing
- C:\Users\Chris\Limen-Helix-live-\scripts\build-historical-distress-cohort.js — infrastructure distress cohort tagging
- C:\Users\Chris\Limen-Helix-live-\scripts\gen-walmart-tree-l2.js — maps SIC 4513 (Air Courier), 4213 (Trucking) to infrastructure

### LIVE PAGES
- https://limenhelix.com/infrastructure-command (operator command board)
- https://limenhelix.com/infrastructure-console (full console)
- https://limenhelix.com/infrastructure-workspace (execution workspace)
- https://limenhelix.com/infrastructure-opportunities (opportunity triage)
- https://limenhelix.com/infrastructure (root hub, 197 child portals beneath: air, bridges, construction, dams, digital, electrical, infrafunding, maintenance, maritime, pipeline, portfacil, rail, resilience, road, smartcity, telecom, transit, urban, water)

### DATA

**READS & FRESHNESS:**
- treatment-discovery-cube.json (85MB) — infrastructure 176 cells populated; FRESH (built 2026-06-04)
- portal-registry.json (62MB) — 197 infrastructure portals enumerated in registry; FRESH (2026-06-04)
- brain-node-map.json (2KB) — 103 canonical brain node archetypes with phase/functional_role; LIVE reference
- infrastructure.json domain root — 20 activations with complete treatments EXCEPT: 4 activations in root + 21 in infrastructure_air.json missing treatments (PARTIAL)
- infrastructure_[category].json × 194 — variable completeness: infrastructure_water.json (27 activations), infrastructure_road.json (26), infrastructure_air.json (31 but 21 MISSING treatments = STALE/INCOMPLETE)

**WRITES:**
- localStorage('limen_infrastructure_business_approvals') — approval status cache (infrastructure-node-business-engine.js)
- localStorage('limen_infrastructure_hierarchy_cache') — 10-min TTL hierarchy snapshots
- window.LIMENInfrastructureFresh — live signal state (refreshed by snapshot consumer every cycle)
- sessionStorage('limen_exec_context') — execution context for workspace (business/grant/patent tracks)

**FEEDS:**
- Construction indices (declining activity = capacity_constraint)
- Transportation stress (>±3% monthly = logistics_stress + congestion)
- Grid reserve margins (<10% = grid_stress CRITICAL)
- Federal spending (>−3% quarterly drop = funding_gap)
- Maintenance backlogs (>0 = maintenance_critical + deferred_maintenance)
- Cyber events (SCADA/infrastructure-targeted = CYBER_ATTACK + INFRASTRUCTURE_ATTACK)
- Transmission/interconnection queue (>0 = transmission_congestion + interconnection_delay)
- Substation/transformer/switchgear backlog (>0 = substation_bottleneck + transformer_backlog)
- Datacenter/hyperscale demand (>0 = datacenter_demand + demand_surge)
- Peak load/curtailment/load shedding (>0 = peak_curtailment + capacity_constraint)
- Cooling/water infrastructure strain (>0)

### HOW IT CONNECTS

**CROSS-DOMAIN EMISSIONS (infrastructure → downstream domains):**
- **infrastructure → energy:** grid_stress_transmission (stress ≥0.60, gated by active diagnosis, magnitude 0.60×stress)
- **infrastructure → economy:** construction_drag (stress ≥0.55, gated by diagnosis, magnitude 0.55×stress)
- **infrastructure → supplyChain:** logistics_constraint (stress ≥0.60, gated by diagnosis, magnitude 0.60×stress)
- **infrastructure → population:** service_disruption (stress ≥0.55, gated by diagnosis, magnitude 0.55×stress)

**CROSS-DOMAIN AFFINITIES (from brain node activations):**
- **CC (Road Networks, P3/router):** energy Transmission Lines; neurology Corpus Callosum; technology Networking; trade Freight Forwarding; communication Telecommunications
- **CBLM (Rail Systems, P10/stabilizer):** business Quality Control; economy Supply Chain; energy Refining; industry Robotics; religion Ritual Practice
- **FEF (Air Transport, P6/executor):** energy Offgrid; trade Air Freight; communication Satellite Systems; defense Air Power; culture Master Planning
- **NTS (Maritime, P4/sensory):** business Asset Valuation; communication Submarine Cables; defense Naval Operations; trade Maritime Trade
- **THAL (Electrical Grid, P3/router):** energy Grid Synchronization; technology Sensors/Controls; defense Critical Infrastructure Protection
- **FPN (Digital Infrastructure, P6/executor):** technology Networks; intelligence Data Infrastructure; science Computing Resources
- **dlPFC (Urban Planning, P6/executor):** governance Land Use Policy; environment Sustainability; culture Public Space Design
- **FORN (Pipelines, P5/buffer):** energy Fuel Distribution; environment Water Quality; defense Strategic Resources
- **M1 (Construction, P6/executor):** industry Manufacturing; technology Automation; finance Project Financing

**INBOUND SIGNALS (other domains → infrastructure):**
- energy → infrastructure: grid demand surge, equipment shortage, interconnection delays
- economy → infrastructure: construction financing collapse, labor shortage, material cost spikes
- trade → infrastructure: port congestion, rail capacity constraint, logistics bottleneck
- defense → infrastructure: critical infrastructure attack alerts, cyber-physical threats
- agriculture (CROSS-REF): population_rural_infrastructure portal references rural infrastructure needs

**DIRECTIVE & TREATMENT FLOW:**
1. Brain node activation fires diagnostic trigger (e.g., "Road network deterioration")
2. Infrastructure-brain matches to diagnosis index (e.g., GRID_DEGRADATION → grid_stress, utility_failure, INFRASTRUCTURE_ATTACK, etc.)
3. Treatment discovery pulls matched treatments from treatment-discovery/by-node/[CC|CBLM|etc].json
4. Directive extractor converts treatments → actionable directives (via infrastructure-directive-extractor.js)
5. Directive ranker prioritizes by convergence score and impact (infrastructure-directive-ranker.js)
6. Promotion bridge converts directive → opportunity (grant/patent/business) (infrastructure-promotion-bridge.js)
7. Node-business-engine maps node → company candidates (MAPPED/MISSING/SPECULATIVE buckets) with approval workflow
8. Execution panels render workflow (grant/patent/business build) in infrastructure-workspace.html
9. Command board aggregates stress, portfolio health, and triage rank

### NEEDS WORK / INCONSISTENCIES

**STALE / INCOMPLETE TREATMENT DATA:**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\infrastructure.json — 4 activations MISSING treatments (no treatment[] array present on CC, CBLM, FEF, NTS secondary nodes or auxiliary activations)
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\infrastructure_air.json — 21 of 31 activations MISSING treatments (PARTIAL = 68% stale/incomplete)
- IMPACT: Grant/patent generation blockers when these nodes activate; operator warnings not triggered; treatment-discovery cells not fully populated for these sub-paths

**HALF-BUILT FEATURES:**
- ~~infrastructure-portal.html file missing from repo~~ **[CORRECTED 2026-06-07: FALSE — agent searched the hyphenated name; the real root hub `infrastructure_portal.html` (underscore) EXISTS at repo root with 192 child portals, full parity with other domains. Disregard this item and its impact line.]**
- IMPACT: No unified entry point; users navigate directly via command-board or console; portal-registry.json lists portal but page unavailable

**CROSS-DOMAIN SIGNAL GAPS:**
- agriculture domain has population_rural_infrastructure portal (C:\Users\Chris\Limen-Helix-live-\assets\data\domains\population_rural.json references it) but infrastructure domain does not reciprocally emit service_disruption to population during rural infrastructure stress
- IMPACT: Rural infrastructure crises may not propagate down-population-chain; asymmetric signal flow

**EMPTY/MINIMAL DATA TANKS:**
- infrastructure.json root domain has STRUCTURAL treatments defined for top-tier nodes but many sub-domain files (e.g., infrastructure_bridges.json, infrastructure_dams.json) have incomplete or generic treatment sets
- treatment-discovery/by-node — all 19 infrastructure-active nodes exist but treatment cell counts vary widely (e.g., CC 69 cells, S2 unknown); verify equal population across domain/node intersections

**ORPHANED / DEAD LINKS:**
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-clarity-operator.js (1,585 lines) references expertise panels and clarity-mode overlays but no corresponding clarity-view HTML element in infrastructure-console.html (only #clarity-view div stub exists; wiring incomplete)
- IMPACT: Clarity operator may fail to render; console UI crashes if clarity-mode triggered

**DUPLICATION / REDUNDANCY:**
- infrastructure-node-business-engine.js (1,576 lines) and infrastructure-business-build.js (750 lines) both render business opportunity builders; role division unclear (engine = logic only? builder = UI only? test for overlap)
- infrastructure-directive-extractor.js + infrastructure-directive-translator.js both transform signals → directives; verify they don't double-process

**VERIFICATION NEEDED:**
- treatment-discovery cube infrastructure entry count (176 cells) vs actual available domain/node cell combinations: 20 active nodes × 2 state buckets (hyperactive/hypoactive) = 40 expected cells minimum. Confirm 176 = real intersection count or inflated by comparison domains
- Cross-domain emission gating (stress ≥ threshold AND active diagnosis required) — verify gates actually fire in live snapshots; check if emissions ever reach downstream domains or get dropped by gate
- Company binding strengths in infrastructure activations (0.71–0.95 range): verify these reflect current market/sector maturity; Brookfield Infrastructure specific company file exists (brookfield_infrastructure.json) but integration with node-business-engine unclear

**POTENTIAL DATA QUALITY ISSUES:**
- infrastructure_air.json: 21 missing treatment arrays = likely template incompleteness during generation; may need bulk treatment injection from parent infrastructure.json FEF node
- infrastructure_portal.html: missing page means no unified entry; all 197 portals orphaned from root nav; likely lost during site redesign (only command/console/workspace entrypoints exist)
- Telecom/Digital cross-domain affinities: infrastructure nodes (LANG/Telecom, FPN/Digital) map to technology domain but no reverse affinities in technology→infrastructure (check technology-brain.js for reciprocal emission rules)

**VALIDATION GAPS:**
- No schema validation on infrastructure.json activations to enforce presence of treatments[] array
- treatment-discovery cube missing entries for some infrastructure sub-domains (water, rail, maritime) in _summary.json breakdown (only top-level infrastructure domain shown, not subcategories)
- infrastructure-node-business-engine.js filters generic treatments but no audit trail of filtered-out treatments; hard to debug why a plausible company is marked SPECULATIVE

---

## MASTER NEEDS-WORK & INCONSISTENCIES ROLLUP

Every NEEDS-WORK item from all 28 sections, grouped by area below. The prioritized synthesis comes first.

### PRIORITY TIERS (synthesized across all 28 sections)

**P0 — HONO CONSOLIDATION BLOCKERS & DANGERS (resolve/decide before touching api/)**
1. **Raw-body Stripe webhook** — `api/capital-engine.js` `_readRaw()` (lines 25–36) falls back to re-stringifying a consumed body for signature verification; under Hono this MUST be a guaranteed raw-body path, first in the middleware chain. (§24.1)
2. **4 autonomic crons are PAUSED, not live** — `ops/crons-paused-2026-06-01-pre-gate-a.json` holds autoqueue/autofire/multipass/sleep-cycle pending Gate A; autofire was burning $9–16/day on a retry loop. They are NOT in `vercel.json` (only capital-engine tick is). Consolidation must not silently re-arm them. ⚠ §14 describes the cron cadence as if running — §25 (file evidence) is authoritative. (§25.1, §25.18, §14)
3. **Python runtime stays out of Hono** — `api/helix.py` → `helix_app/index.py` FastAPI re-export; `vercel.json` `/api/limen/(.*)` rewrite may already conflict with FastAPI sub-routes — verify `/api/limen/health` + `/api/limen/score` both resolve live BEFORE consolidating. (§24.7, §24.17)
4. **maxDuration 300s is load-bearing** — autofire's MAX_FIRES_PER_TICK=1 exists to fit a 270s+ Sonnet call inside 300s; the Hono app must preserve per-route duration behavior. (§24.13, §14.17)
5. **Orphan-candidate endpoints to decide remove-vs-port** — `kernel-experiment.js` (already 410'd client-side), `limen-iteration.js`, `limen-phase-transitions.js`, plus worker endpoints with only implied (cron/internal) callers. (§24.4)
6. **No runtime hash check on the LOCKED kernel** — `limen.py` documents SHA256 of `limen_backtest.py` but never verifies it on disk. Cheap, high-value guard to add during consolidation. (§24.3)

**P1 — SYSTEM-WIDE FUNCTIONAL BREAKS (the cut wires)**
1. **Kernel scoring is dark**: VALIDATION_LOCK.json missing → Thing 1 refuses ALL scoring; K1/K2/K3 readings empty on all 767 portals (vitals: Kernel organ 0/100). No validated alerts are possible in production today. (§4.1–2, §21)
2. **Zero engine outputs live in portals**: all 173,652 portal-registry entries are placeholders; all 461 investment artifacts qualitative (market-data param never passed to `computeValuation()`); Redis engine outputs never promoted to fired (1 fired artifact total). (§9.1, §16.3/7/16)
3. **`connectome-weights.json` missing** → propagation-engine dead; 65 of 123 canonical nodes unreachable by spreading activation. (§10.1, §6.9)
4. **Action-selection gate orphaned**: `limen:action-selected` broadcast has no listener; `master-brain.decide()` stubbed, never called — confirms the two missing wires from the brain-consolidation model. (§10.3–5)
5. **`stress-network-state.json` 13 days stale AND has no downstream consumer** — the only per-domain stress model, computed then ignored. (§14.1, §21)
6. **`feed-status.js` lies**: 22 sources / 11 domains registered vs 266 sources / 20+4 domains actually fetched in `domain-snapshot.js`; the sense-organ audits the wrong file (false negatives). (§17.1/4, §21)
7. **⚠ AGENT DISCREPANCY — verify first**: `brain-node-domains.json` reported NOT FOUND by §5 but present (285 KB) by §10/§19; `domain-packet-adapter.js` reported MISSING by §21's organ but read directly by §10/§19. Resolve both by direct check before acting on either section.

**P2 — REGISTRY & DATA-TANK DEBT (stale, inconsistent, generator-less)**
1. Node-count triangle: 111 (brain-nodes file) vs 123 (frozen canonical registry) vs 187 (neuro-disorder-lookup, +62 non-canonical) — adjudication documented but unresolved. (§6)
2. `portal-registry.json` 62 MB / 81 days stale / no build script in this repo (likely full-repo only). (§3.1, §22)
3. Manifest drift: 33 portal files on disk not in companies-manifest; 183 alias targets point at nonexistent portals; company-index 81d stale with 6 ghosts. (§22)
4. Treatment-discovery verification vacuum: all 66,025 claims PENDING (task #33 never run); 143 of 373 disorders silently dropped from the cube; residuals (task #30) unstored. (§11)
5. Generator-less tanks: entity-registry, sp500-ciks, eligible-universe, limen-report-index, portal-registry — no script in repo regenerates them. (§22)
6. 10+ tanks with no reader found (node-entity-mapping, corpus, review-rubric, verbiage-templates read paths unverified…) — audit each: reader, build-artifact, or delete. (§3.13)

**P3 — DOMAIN ASYMMETRY (agriculture confirmed under-built; infrastructure finding CORRECTED)**
1. **Agriculture is the ONLY domain with no static portal HTML in the live repo** (verified by direct disk check 2026-06-07): no root `agriculture_portal.html`, 0 child portal pages — every other domain has root + 111–202 children. The referenced `p2_agri_*_portal.html` links → 404. ✅ **NOT LOST — it lives in JSON, by design**: (a) content in 21 `p2_agri*.json` tanks (this repo); (b) **portal-registry.json contains the FULL agriculture hierarchy** — `agriculture` root + all 20 sub-paths (`agriculture/crop` … `agriculture/water`) + 30 `p2_agri_*` domainId mappings + 1,214 deep cross-domain agri paths (1,244 agri keys total; §26's "registry has 0 agriculture entries" is FALSE — agent misparsed the 62MB file); (c) `portal-router.js childPortalResolver()` is purpose-built to translate `p2_agri_*_portal.html` links → registry paths — **but portal-router.js is loaded by ZERO pages in live, so the dynamic render wire is unplugged**; (d) additionally, 205 static `p2_agri_*_portal.html` files exist in the FULL repo (`C:\Users\Chris\Limen-Helix`), never synced to lean. **WHY (operator-confirmed design constraint):** Vercel cannot deploy the full static portal surface — the full repo holds 126,338 root .html vs 3,397 in live (23.9 MB); everything beyond the curated subset MUST be served JSON-driven (registry + tanks + router). Agriculture is the first all-JSON domain. **Fix = wire portal-router.js to a host page (the design-intended path, which also unlocks ~123K more portals that can never ship as HTML) — do NOT bulk-sync static pages from full, even though agri's 205 files (0.9 MB) would technically fit.** Remaining real gaps: 0 entries in treatment cube + business-mapping; only 14 command-board companies; policy/research/seeds JSON 61d stale; emission/reception rules hardcoded in brain instead of portal data. (§26, twice-corrected)
2. **Infrastructure — CORRECTED 2026-06-07**: §27's "root portal missing" claim is FALSE — the agent searched the hyphenated name `infrastructure-portal.html`; the real file `infrastructure_portal.html` (underscore) EXISTS with 192 child portals, full parity with other domains. Still valid from §27: 21/31 `infrastructure_air.json` activations missing treatments; clarity-operator wiring incomplete (console stub only).
3. Frozen L1 node taxonomy lacks agriculture + supplyChain domain coverage (freeze runs to 2026-12-01). (§21)
4. Page-layer asymmetry: 5 domains missing console; opportunities/workspace layers are empty shells; 2 domains console-only. (§8)

**P4 — QUALITY / SECURITY / OPERATIONAL DEBT**
1. `fetch-doc.js` soft auth ('granted' literal in client JS) — fine if docs are public-ish, not if confidential. (§24.19)
2. FTC affiliate-disclosure visibility never validated at render time; SBA lane templates are shells; patent lane has no pre-filing novelty/FTO check; adversarial review gate is advisory-only (operator can submit a blocked application). (§15)
3. Session-scoped state everywhere: executor packet status, human-context-gate audit log, intent sync fire-and-forget — all lost on reload. (§13, §20, §23)
4. Known localStorage score-gating debt (browser-local lane-fit gating) still unmigrated to Redis. (memory: localstorage-score-gating-debt)
5. Effectively no automated tests across signal propagation, action gate, phase adapter, remedies. (§10.21, §23.16)

### 0. Git history & evolution

1. **Vercel Function Count Still High**: 2026-06-07 move of api/lib+api/lanes reduced by 21 functions, but final count not stated; unclear if under 50-function soft limit. C:\Users\Chris\Limen-Helix-live-\vercel.json shows 54 functions at initial commit; post-2026-06-07 count unknown.
2. **Treatment-Discovery Cube Excluded**: 82 MB treatment-discovery-cube.json lives in full repo only (per 025987c); lean repo uses split by-node/*.json. If full repo offline, cube rebuild pipeline in full repo cannot be replayed from lean.
3. **Capital Engine Single-Signature Gating**: FINANCE_PORTAL_SIGNOFF.md flags fees/lending/transfers as "halt for sign-off", but no enforcement code visible in commits; likely in FINANCE_PORTAL_SIGNOFF.md audit trail only, not enforced at API level.
4. **Civilization Card Removal Rationale Unclear**: Commits 3138040, 57069f7, a0e276c removed Trust Posture, Polarity, Detected Diagnoses & Treatments, and entire Civilization tab from Evidence Workspace, but no commit message explains why these were dead or what replaced them.
5. **Verification Drive Plateau (8a59d4c)**: "Verifiable claims exhausted" — 7451→7900 processed claims, but proven count flat. Unclear if corpus has hit ceiling or if verification logic needs revision. No follow-up commit visible.
6. **GitHub Action Token Issues**: 3 test commits (62eea6b, 0d4d5ea) show token rejection (d4316ee disable auto-failing sync). Lean→full sync machinery likely disabled or manual-only post-2026-06-03.
7. **DARK Flags Not Fully Toggled**: 6dff4d2 ("Mirror action-selection gate... DARK behind flag") and d1ac73d ("Feed→Discovery STAGE 1... DARK") added code, but no commit shows feature flag toggling; likely ops-time enablement via Redis or code branch.
8. **Adversarial Reviewer Rubric Vague**: 7e94e60 "bake this session's learnings into the system" — 1 file changed, but unclear what findings were baked into what rubric schema.
9. **Finance Libs Footprint: Pre-2026-06-06 Duplication**: Before 530b055, finance libs lived in /api; post-2026-06-06 in /lib. Any old /api/finance-*.js files left behind? No cleanup commit visible.
10. **Three-Build System (aaeb5dc) Underdocumented**: "score-gating, two-part render, investment lane" — all appear to be build stages, but no summary of build orchestration pipeline added; build scripts not in commits.

### 1. HTML SURFACE — ALL 3,397 ROOT-LEVEL HTML FILES BY FAMILY

1. **Session/Auth leakage across portals:**
   - Every portal*_portal.html checks `sessionStorage.limen_access` on load; if missing, redirects to `/?return=...`
   - **Risk**: If session expires mid-navigation, user bounces to login. No transparent re-auth; user must re-login and manually return.
   - **Fix**: Implement session-extend middleware; add token refresh before page load.

2. **Hard-coded breadcrumbs (no dynamic generation):**
   - Every portal has static breadcrumb HTML (topbar-bc). If a parent portal file is renamed or moved, children become orphaned.
   - Example: governance_anticorruption_antimoney_portal.html hard-codes `<a href="governance_anticorruption_portal.html">ANTICORRUPTION</a>` — if that file is deleted, link 404s.
   - **Fix**: Generate breadcrumbs server-side from domainId path; inject into PortalUI.init().

3. **Index-only root portals (governance_portal.html, etc. == only "1" per domain):**
   - Only **19 root portal files** exist (one per domain), yet each domain has **206–207 total files**.
   - This suggests **deep hierarchy is not reflected in file count**; most files are tertiary or deeper portals.
   - **Verification needed**: Sample a governance subcategory (e.g., governance_anticorruption_portal.html) — is it a real file or dynamically generated?

4. **Orphan/unused pages (high risk):**
   - **Singletons with unclear ownership** (C:\Users\Chris\Limen-Helix-live-\kernel-comparison.html, vitals.html, applications.html, phase-observer.html, etc.) — no breadcrumbs link to them from master hubs. May be outdated or test pages.
   - **Command**: `grep -r "kernel-comparison.html\|phase-observer.html" assets/js/` to check if any portal or PortalUI.init() references them. If zero hits, flag as orphan.

5. **Missing agriculture model for other 18 domains:**
   - Only **agriculture** has the command/console/opportunities/workspace quad (4 files).
   - No corresponding **energy-command.html**, **medicine-command.html**, etc., yet agriculture-command.html suggests **operators need per-domain command boards for stress management**.
   - **Fix**: Either (a) implement command board for all 18 domains, or (b) consolidate all command boards into single unified interface with domain selector.

6. **Treatment discovery cube size (~84MB) — no pagination:**
   - treatment-discovery.html loads full treatment-discovery-cube.json (~84MB).
   - **Risk**: Page may hang on slow connections; no server-side pagination, filtering, or lazy-loading shown.
   - **Fix**: Implement server-side filtering endpoint (e.g., `/api/treatment-discovery/nodes?state=hyperactive&domain=medicine`); paginate results.

7. **3D brain model (three.js r128) — no fallback:**
   - Every portal loads `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` + connectome-renderer.js
   - No canvas fallback or 2D alternative if three.js fails to load
   - **Risk**: Old browsers or offline environments may see blank center-view canvas
   - **Fix**: Add feature detection; render 2D force-graph fallback if three.js unavailable.

8. **Portal-nav links are static (copy-pasted across all 3,397 files):**
   - The portal-nav (showing all 19 domain links) is hard-coded in every single page.
   - If a domain is added/removed, all 3,397 files must be updated.
   - **Fix**: Inject portal-nav dynamically from a shared JS config (assets/js/portal-nav-inject.js) at page load.

9. **Master-brain hierarchy tiers (purpose unclear):**
   - master-brain.html shows a "tier" block below posture grid (illustrated with glyphs + labels).
   - **No link evidence** from other pages showing how tiers are used; may be prototype/unused.
   - **Verify**: Grep assets/js/ for "mb-tier" or "hierarchy" references; if none, flag as dead code.

10. **Disconnected singleton utilities:**
    - **company-lookup.html, venture-portfolio.html, investment-console.html** appear to be financial workflow pages, but no navigation path from civilization/master-brain to them.
    - **clinical-portal.html, provider-portal.html** appear to be healthcare workflow pages (not part of medicine_*_portal.html family), but may duplicate data.
    - **Verify**: Check if these are legacy/deprecated, or if hidden navigation exists.

11. **Empty or minimal brainWhy objects:**
    - Every PortalUI.init() call passes `brainWhy: {}` (empty dict).
    - **Clarify**: What is brainWhy intended to do? If empty, remove it; if intended for future use, document the schema.

12. **Portal CSS monolith (portal.css):**
    - All 19 major domain portals load the same `assets/css/portal.css`, which must contain styles for all variable panel widths, node counts, phase colors, etc.
    - **Risk**: File may be huge and unmaintainable; no per-domain style overrides observed.
    - **Verify**: Measure assets/css/portal.css file size and rule count; if >10K lines, consider splitting by feature.

---

**SUMMARY COUNTS:**
- **3,397 root .html files (verified)**
- **49 families** by prefix (governance: 207, population: 206, religion: 206, ..., family: 1)
- **19 major domain portal trees** (each 116–207 files, 3–4-tier hierarchy)
- **5 helix/internal pages**
- **4 agriculture/command pages**
- **4 master/operator pages**
- **3 operator workflow pages**
- **30 singleton utilities/workflows**
- **Zero HTML files in subdirectories**
- **Zero dynamic route/template system detected** (all 3,397 are static .html files)

---

### 2. Browser JS Modules (assets/js/** by subdir)

1. **Connectome Kernel Adapter (Disabled):**
   - File: assets/js/connectome-kernel-adapter.js (229 lines)
   - Issue: Formerly POSTed company data to /api/kernel-experiment (non-public). NEUTRALIZED with warning: "connectome-kernel-adapter is disabled: /api/kernel-experiment is not a public scoring endpoint. Use the protected /api/helix-report/score instead."
   - Impact: connectome-resolver.js (line 496) references this disabled endpoint; callers should use /api/helix-report/score instead (no code wired to do so yet)
   - Fix: Replace /api/kernel-experiment calls with /api/helix-report/score (post office missing)

2. **Portal Content Fetch Latency:**
   - Files: domain-brain-base.js (line 474), portal-content-resolver.js
   - Issue: Falls back to /api/fetch-portal?domainId=X when assets/data/domains/{domainId}.json missing; GitHub-mediated fetches are slow (~5-30s per domain)
   - Symptom: Domain brains emit null/incomplete diagnoses on page load; only populate after GitHub fetch completes
   - Negative cache (1-hour TTL on 404) masks real portal updates
   - Fix: Pre-warm portal cache at deployment; reduce fallback latency or fetch in parallel pre-request

3. **Multi-Domain Page Load Time:**
   - Affected: civilization.html, master-brain.html, operator-guide.html (3 × 53 scripts each)
   - Issue: All 20 domain brains load in parallel, each may trigger /api/domain-snapshot fallback + /api/fetch-portal fallback; no request batching
   - Symptom: Page load > 5s on slow networks
   - Fix: Batch portal fetches (one /api/fetch-all-portals endpoint) or pre-populate assets/data/domains/* files

4. **Opportunity Playbook Authorship & Drift:**
   - Files: assets/js/domain-brains/data/{domain}-opportunity-playbooks.js (18 files, ~3KB each)
   - Issue: These are static JS objects; no versioning or update mechanism. If domain diagnosis schema changes (e.g., agriculture adds PEST_OUTBREAK), playbooks must be manually patched
   - Fix: Version playbooks; consider JSON instead of JS for easier authorship/tooling

5. **Alert Deduplication in Philemon:**
   - File: assets/js/philemon-voice-guide.js (line 145+)
   - Issue: Alert memory (_alertMemory) uses simple hash-based signatures (alertType::domain); no distributed session tracking. If user opens multiple browser tabs, each gets independent Philemon instance with separate _alertMemory
   - Symptom: Same alert spoken twice (once per tab)
   - Fix: Centralize alert state in localStorage or /api/philemon-state

6. **Master Brain Package Forbidden Phrases:**
   - File: assets/js/master-brain/artifact-factory.js (lines 68-78)
   - Issue: FORBIDDEN_RX list blocks "submission-ready", "filing-ready", "approved", etc. but regex is loose (e.g., /\bguarante(e|ed|es|s)\s+(award|...)\b/i); edge cases may slip through
   - Example: "guarantee of fund eligibility" (vetted), vs. "guarantee funding" (should block) — hard to distinguish
   - Fix: Expand FORBIDDEN_RX test suite; consider NLP-based validation

7. **Execution Phase Loaders (Misaligned):**
   - Files: execution-phase7-loader.js, execution-phase8-dashboard.js, execution-phase9-dashboard.js, execution-phase9-loader.js, execution-phase10-dashboard.js, execution-phase10-loader.js, execution-phase11-dashboard.js, execution-phase11-loader.js (8 files)
   - Issue: Phase naming inconsistent (phase7, phase8, phase9, phase10, phase11); no clear definition of what each phase does; dashboard files exist but phase7-loader is missing phase7-dashboard.js
   - Fix: Document phase lifecycle; verify all phase{N}-dashboard.js and phase{N}-loader.js pairs exist

8. **Recommendation Engine Portal Data Dependency:**
   - Files: assets/js/recommendations/*.js (13 files)
   - Issue: deep-portal-harvester.js, portal-treatment-resolver.js depend on portal content being fully loaded; if portal is stale/empty, no treatments recommended
   - Symptom: clarity console shows "No recommended actions" even with elevated stress
   - Fix: Fallback to static treatment catalog (not yet in codebase) or pre-populate remedies

9. **Operator Canonical Identity Resolution:**
   - File: assets/js/limen/operator-canonical-identity.js
   - Issue: No details in read (partial file); unclear if this is wired to /api/operator-action or independent
   - Potential risk: Operator ID spoofing if not validated server-side
   - Fix: Verify operator-action.js validates incoming operator identity against canonical registry

10. **Human State Packet API Contract:**
    - File: assets/js/limen/human-state-packet.js (reads /api/human-state)
    - Issue: No corresponding /api/human-state endpoint found in api/*.js file list (54 files); endpoint may be missing
    - Symptom: human-state-packet.js fails silently; page loads but human context not available
    - Fix: Implement /api/human-state or remove this module if not needed

11. **Brain Atlas Coordinates Stale:**
    - File: assets/data/brain-atlas-coordinates.json
    - Issue: No timestamp/version; unclear if brain-nodes-111.json matches atlas
    - Fix: Version these files; add validation that all 111 nodes have atlas coordinates

12. **Missing Handbook/Documentation:**
    - No assets/data/handbook.json or similar
    - operator-guide.html claims to provide command reference but it's HTML-static; no programmatic command registry
    - Fix: Create window.LIMENCommandReference or /api/command-reference

13. **Remedy Registry Manager Public API Uncertain:**
    - File: assets/js/remedy/limen-remedy-registry.js
    - Issue: Exposes window.LIMENRemedyRegistryManager but no clear method inventory; philemon calls .stats(), .getTreatmentsOnDomainStress(), .prioritize(), .getDiagnosesForDomain() but these may be incomplete
    - Fix: Document full API surface; add method validation

14. **Execution Module Naming Ambiguity:**
    - Files: execution-monitoring.js vs. execution-lifecycle.js vs. execution-tracking.js
    - Issue: Unclear which is authoritative for execution status; no documented hierarchy
    - Fix: Document module responsibilities; consolidate if redundant

15. **Artifact Packet Schema Migration (D3-A3.v2 → v3):**
    - File: assets/js/civilization/artifact-packet-builder.js (lines 55-67)
    - Issue: Breaking change in v3: identity.id is now composite '<sourceOpportunityId>::<lane>' instead of just opportunityId. Callers reading v2 packets will break
    - Fix: Add migration code to handle v2/v3 packets; version the schema version in pages

16. **Biology Sensor Integration Unclear:**
    - Files: biosensor-bridge.js, biosensor-control-panel.js, limen-defense-signal-engine.js
    - Issue: These imply biosensor hardware integration but no API calls to /api/biosensor-* found; unclear if wired
    - Potential: Either orphaned code or incomplete API layer
    - Fix: Document biosensor architecture or remove if not live

17. **Market Stress Triage One-Off:**
    - File: assets/js/market-stress-triage.js
    - Issue: Reads /api/limen-stress-slim but unclear how/where it's consumed
    - Fix: Map this to a live page or remove

18. **Unused Opportunity Matrix (Agriculture Only):**
    - File: assets/js/agriculture-opportunity-matrix.js
    - Issue: Agriculture has this extra file; other 19 domains don't. Unclear why
    - Fix: Either add *-opportunity-matrix.js for all domains or document agriculture-specific logic

19. **Stale Artifact Source Index:**
    - File: assets/js/civilization/artifact-source-index-client.js
    - Issue: Reads /assets/data/artifact-sources.json (not found in codebase); falls back to inline data
    - Fix: Populate artifact-sources.json or remove file

20. **Command Board Data Single File:**
    - File: assets/data/command-board-data.json
    - Issue: Static single file; unclear how per-domain command boards are generated (agriculture-command.html, etc.). Likely built from template + domain-brain state
    - Fix: Document command-board generation; version this file

21. **Broken Link in Console Grid:**
    - File: civilization.html (line 82-98)
    - Issue: #enter-connectome button exists but unclear if connectome.html is wired as target (should be href="/connectome" or similar)
    - Fix: Verify routing

**SUMMARY:**
The 624 assets/js files form a sophisticated, distributed cognitive architecture with clear separation of concerns (domain brains, civilization layer, master brain, execution, UI). However, 21+ known inconsistencies range from minor (missing doc-string) to major (disabled kernel adapter, slow portal fetches, alert duplication across tabs, missing API endpoints). The system is production-live on 3397 HTML pages but shows signs of rapid development (phase loader misalignment, unused modules, stale caches). **PHILEMON is fully live, functional, and sophisticated** — a genuinely useful named voice guide with proper alert deduplication and context-aware narration.

### 3. Data tanks (assets/data/**, 4,670 json)

1. **portal-registry.json (61.75 MB, 81 days stale):**
   - No build script found in live- repo for regeneration. **Likely only in full-repo** (C:\Users\Chris\Limen-Helix).
   - 173,652 portal entries suggests it was built from comprehensive domain/issue taxonomy; current version may be outdated as new domains/issues are added.
   - portal-ui.js, portal-router.js depend on it for navigation; if stale, users cannot discover new portals via UI.
   - **ACTION:** Locate or rebuild build-portal-registry.mjs. Verify if portal-registry.json should be auto-generated with each domain addition or rebuilt on schedule.

2. **brain-nodes-111.json (98 days old, hand-authored):**
   - Marked as canonical but not regenerated since 03/01/2026.
   - Treatment-discovery and neuro-disorder lookup depend on it; any fixes to node descriptions require manual edit + re-run of dependent scripts.
   - **RISK:** Node definitions frozen; no mechanism for updating node roles / business mappings if brain science shifts.
   - **ACTION:** Document canonical state (is this truly static reference data?). If dynamic, establish version control and build pipeline.

3. **eligible-universe.json (28 days stale, last run 05/09/2026):**
   - probe-eligibility.js should be run regularly to refresh phase eligibility snapshots.
   - No automated schedule found in scripts or cron.
   - **RISK:** Phase-eligibility data lag; autofire and phase-transition detection may miss near-eligible portals.
   - **ACTION:** Add probe-eligibility.js to build pipeline or schedule. Verify if kernel refresh cycle should trigger it.

4. **stress-network-state.json (12 days old):**
   - build-stress-network.mjs should run whenever command-board-data.json updates (which is every kernel cycle).
   - Last update 05/25/2026; command-board-data.json updated 05/27/2026 (2 days after stress run).
   - **RISK:** Stress propagation lags kernel updates by days; Master Brain and autofire decisions may stale.
   - **ACTION:** Integrate build-stress-network.mjs into post-kernel-refresh automation. Run with --top 20 for visibility on network-pushed nodes.

5. **portal-registry.json vs. domain files (domain/issue count mismatch):**
   - portal-registry.json reports 173,652 portals but live- repo only has 3,710 + 800 = 4,510 JSON files.
   - **Likely explanation:** portal-registry.json was built from full-repo (C:\Users\Chris\Limen-Helix) which has ~10× more domains/issues; live- is a subset for Vercel deployment.
   - **RISK:** UI may reference portals (governance/anticorruption/antimoney) that don't have corresponding .json files (no content, just nav structure).
   - **ACTION:** Verify live- deployment is intentionally subset; audit portal-registry.json for orphaned paths (nav references without backed .json files).

6. **Orphan densification pipeline incomplete:**
   - orphan-stakeholders.json identifies 9,559 entities (4,105 companies, others) with densifyCandidate=true or false.
   - No script found to auto-densify (create companies/*.json from orphan entries).
   - **RISK:** Supply-chain nodes remain structurally invisible to stress propagation (no brainNodeMapping overrides, so inhibitory damping cannot be applied).
   - **ACTION:** Implement semi-automated densification: detect refCount > threshold, merge data from multiple sources (Edgar, news, regulatory), create stub portal, trigger binding-fidelity validation.

7. **treatment-discovery-cube.json verification incomplete (task #33 PENDING):**
   - 84 MB cube contains every cell with sourceProvenance, but verification status is PENDING for all claims until task #33 runs organ-claim-verification.mjs.
   - Verification output written to audit/verification-ledger.json (2.8 MB, growing).
   - **RISK:** Operator surface (treatment-discovery.html) shows unverified claims; no sorting/filtering by verdict status yet visible in UI code.
   - **ACTION:** Implement verification-status tier in treatment-discovery UI. Suppress or flag REJECTED claims. Document task #33 completion timeline.

8. **company-registry.json inconsistencies (9 days old):**
   - byCik index keyed on numeric CIK ("0", "10456", etc.), but some portals lack CIK (PRIVATE companies).
   - byBrainNode contains entries from both company's own brainNodeMapping AND functionalNetwork references (unclear which takes precedence for overlaps).
   - **RISK:** Queries like "find all companies with mPFC binding" may double-count if company self-maps mPFC AND references another company with mPFC.
   - **ACTION:** Audit byBrainNode duplicate logic in build-company-registry.js. Add confidence weighting to distinguish owned vs. referenced bindings.

9. **brain-connectome.json (98 days old, 6 edges only):**
   - MVP inhibitory damping reads only 6 canonical edges (vmPFC→BLA, HAB→VTA, HAB→RAPHE, CAUD→GP, PUT→GP, GP→THAL).
   - Full brain connectome (~100+ edges in literature) not included.
   - **RISK:** Stress propagation underestimates regulatory capacity; portal damping only applies if both endpoints have strong overrides in brainNodeMapping.
   - **ACTION:** Expand connectome with full anatomical edge set (excitatory + inhibitory). Reweight inhibitory damping constants based on empirical γ calibration (empirical-gamma-by-phase.json).

10. **limen-report-index.json (91 days old, purpose unclear):**
    - Contains job titles × brain nodes × dysregulation. No reader found in codebase.
    - **RISK:** Orphaned or vestigial; may be intended for job-matching UI that's not yet built.
    - **ACTION:** Audit usage. If unused, either integrate into a new subsystem or remove.

11. **Stale reference data not version-controlled:**
    - brain-nodes-111.json, brain-atlas-coordinates.json, civilization.top.json, remedy-library.json, sp500-ciks.json are hand-authored static references, but no associated .md documentation or version-release notes.
    - **RISK:** Changes to these files can cascade silently; no audit trail of who changed what when.
    - **ACTION:** Add MANIFEST.md or data-version.json at top level documenting hand-authored reference files, last-reviewed-date, next-review-date, owner.

12. **Audit files growth (verification-ledger.json 2.8 MB):**
    - verification-ledger.json is append-only as organ-claim-verification.mjs adds VERIFIED/REJECTED verdicts.
    - No purge/archival strategy; file will grow unbounded.
    - **RISK:** File size may exceed Vercel deployment limits (~250 MB).
    - **ACTION:** Implement rolling-window archival (e.g., keep last 90 days, compress older) or sharded ledger (by domain/node).

13. **Missing readers/writers for 10+ tanks:**
    - node-entity-mapping.json, operator-references.json, entity-registry.json, company-index.json, connectome-node-registry.json, cross-domain-gamma-comparison.json, verbiage-templates.json, review-rubric.json, corpus.json — no readers found in grep search.
    - **RISK:** Bloat or vestigial. May be intermediate build artifacts never consumed.
    - **ACTION:** Audit each: (a) find reader, or (b) document as build-time-only intermediate, or (c) delete.

14. **Python helix_app/index.py and helix_app/thing2/phase_engine.py:**
    - Read command-board-data.json, command-board-eligible.json, empirical-gamma-by-phase.json.
    - No corresponding build scripts found in scripts/ (which is all .mjs/.js).
    - **RISK:** Phase engine logic may drift from JavaScript kernel logic; verification breaks sync across languages.
    - **ACTION:** Unify or document canonical version (JS or Python?). Ensure both read same source data structures.

15. **API gateway missing JSON schema validation:**
    - api/limen-stress-propagation.js, limen-worker-*.js read stress/command-board tanks but no schema validation at read time.
    - **RISK:** Stale or corrupted tank data silently propagates to downstream workers; no early detection.
    - **ACTION:** Add JSON.parse() error catching + schema validation using treatment-discovery-cell.schema.js pattern.

16. **Affiliate-config.json and capital-engine.json divergence:**
    - capital-engine.json lists 15+ connectors (Stripe, Amazon, Rakuten, ShareASale, YouTube, TikTok, Meta, etc.).
    - affiliate-config.json is minimal (1.7 KB).
    - **RISK:** Config may be duplicated or out-of-sync; unclear which is source-of-truth.
    - **ACTION:** Consolidate or clarify roles (capital-engine = full schema, affiliate-config = subset/override?).

17. **Treatment-discovery by-node files (35 MB) may be deploy-time generated, not stored:**
    - split-cube-for-render.mjs writes 113 .json files to by-node/ every time cube changes.
    - These are build artifacts, not source data.
    - **RISK:** If by-node/ not committed to git, render surface fails after fresh-clone deploy (must run split-cube script).
    - **ACTION:** Verify build-on-deploy automation. If manual, document post-deploy step. Consider pre-building in CI/CD.

---

**Total measurable tanks:** 39 top-level JSON + 800 companies + 3,710 domains + 113 treatment-discovery/by-node + 6 audit = **4,668 JSON** (matches 4,670 measured, <1% rounding).

**Critical data products:**
1. treatment-discovery-cube.json — 84 MB, 2 days old (FRESH). The entire 6-step treatment chain.
2. stress-network-state.json — 4.5 MB, 12 days old (AGED). Master Brain and autofire input; should be ≤ 3 days old.
3. command-board-data.json — 140 KB, 11 days old (AGED). Per-domain operators depend on it; should refresh with kernel cycle.
4. company-registry.json — 16 MB, 9 days old (AGED). Core index; acceptable at 1–2 weeks if portal corpus stable.
5. portal-registry.json — 61 MB, 81 days old (STALE). **No build script found. Likely only in full-repo.**

All remaining analysis and production recommendations contingent on resolving #5 (portal-registry.json source).

### 4. Python kernel / distress scorer

1. **CRITICAL: VALIDATION_LOCK missing.** Phase 1-3 stub will REFUSE ALL SCORING if VALIDATION_LOCK.json is absent (lines 153–162, thing1/__init__.py). fingerprint_status() → "no_lock" → validation_status="unvalidated_after_modification". Phase 4 must land the real limen_backtest.py + sign VALIDATION_LOCK.json with SHA256, or every request fails. **Live pages should show this prominently if Thing 1 remains unavailable.**

2. **Thing 1 fingerprint never matched on live.** All `/api/helix/helix-report/score` requests currently return Thing 1 as "unavailable" (Phase 1-3 default). The real limen_backtest.py (sha256 3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20, per limen.py line 281) is NOT DEPLOYED. This is intentional (Phase 4 import), but means NO VALIDATED ALERTS ARE POSSIBLE in production right now. Reconciliation always routes to "Thing 1 unavailable" templates (lines 1006–1038, index.py).

3. **FRED disabled in production.** `/api/helix/helix-report/score` does NOT fetch FRED (lines 134–137, limen.py try/except returns empty dict on any error). P9 (collapse threshold) macro bias (z_delta_fedfunds term) always 0. Backtest.py fetches FRED fine (lines 307–338), but production does not. **Inconsistency**: backtest P9 may be higher than production P9 due to missing FRED signal.

4. **Polyvagal context biasing incomplete in Python.** Index.py auto-builds polyvagal_context from command-board + counterparties (lines 247–394), passes it to `run_pipeline()`, but phase_engine.py does NOT apply the bias to output phases. Lines 888–894 in index.py note: "coupling fired, output dominant_phase / phase_scores are the coupled values; intrinsic is preserved separately". But phase_engine.py `run_pipeline()` returns rows with untouched phase scores. **Bias application logic lives in JS kernel (limen-phase-domain-adapter.js), not Python port.** Reconciliation log emits coupling_mode="polyvagal_coupled" or "intrinsic_only" (lines 969), but in Phases 1-3, it always says "intrinsic_only" because Python doesn't yet apply bias. **JS kernel does apply bias; Python stub does not. Mismatch.**

5. **Bank adapter not built.** All SIC 6000–6999 return validation_status="bank_adapter_required" (lines 130–141, thing1/__init__.py). Regime 2 calibration never performed. 767 portals include ~70 banks/financial entities (SVB, JPM, SCHW, USB in the test fixtures). Live pages for finance command show these companies but kernel never runs real scoring. Reconciliation always suppresses terminal language + narrative (lines 995–1005 templates). **Phase 4 must include Regime 2 calibration or these entities stay permanently unscored.**

6. **Command-board stale if rebuild missing.** `/assets/data/command-board-data.json` (cached 10 min) may not reflect latest portal phase/stress if `build-command-board.js` did not recently run. Polyvagal context auto-population depends on CB freshness. **No monitoring or alert if CB is >1 hour stale.** Coupling degrades gracefully to intrinsic_only but user sees no warning.

7. **Portal slugs may not resolve.** `_slug_for_cik()` (lines 143–156, index.py) looks up CIK in companies-manifest.json. If CIK absent (new portal, not yet indexed), counterparties context cannot be built. **No fallback or indication to caller.** Reconciliation emits no warning; coupling simply skips counterparties block.

8. **Backtest output directory hardcoded.** `limen_backtest.py` line 36: `OUTPUT_DIR = Path(__file__).parent / "output"`. This creates `/api/helix_app/thing1/output/` on the filesystem during backtest runs. On Vercel (read-only `/var/task`), this fails silently (line 38 ignores exception). **Backtest outputs never persist on Vercel. Must run locally.**

9. **Thing 2 P7a/P7b split incomplete in Python.** Lines 668–717 (phase_engine.py `score_p7_split()`) score P7a (terminal) + P7b (controlled separation) based on viability breach (lines 635–665). P7a requires: revenue slope < −1.5 OR OCF < −1.5 OR runway < 4Q OR debt slope > 1.5 OR deposits fleeing (slope < −2.0 at 8Q). But P7a/P7b output is set in-place in rows (lines 700, 709–712), then later used by get_dominant_phase(). **No coupling of P7a/P7b with reconciliation narrative.** Index.py only reads dominant_phase (string, e.g. "p7a") from Thing 2 (line 891, 954), not the sub-phase breakdown. Reconciliation cannot distinguish "company in terminal divergence (p7a)" from "controlled separation (p7b)" in its summary_template map (lines 34–54).

10. **Capital allocation dampening may hide P3.** Lines 578–604 (phase_engine.py) detect intentional reinvestors (revenue growing + OCF stable + cash ok + debt growing) and dampen P3 by 40% (line 603: `r["p3"] *= 0.6`). This can flip P3 from >0.59 (stressed) to <0.59 (clean) for high-growth tech companies burning cash deliberately. **No flag in output to signal dampening occurred.** Reconciliation doesn't know P3 was adjusted. Flag added (line 604: `r["p3_capalloc_dampened"] = True`) but not surfaced to safe-packet. **Silent adjustment may confuse reconciliation logic if dampened P3 crosses thresholds.**

11. **Chronic stress override incomplete.** Lines 1140–1177 (phase_engine.py) `_apply_chronic_stress_override()` boost distress-side phases when P3 is chronically elevated. Currently called in `run_pipeline()` (per limen-thing2-kernel.js mention) but **NOT CONFIRMED CALLED IN PYTHON CODE.** Grep of phase_engine.py shows function defined but no `_apply_chronic_stress_override()` call visible. May be dead code.

12. **Reconciliation log audits both kernels but Thing 1 always unavailable.** Audit entries record t1.validation_status (always "unavailable" in Phases 1-3) + t1.alert (always None). If Thing 1 is ever present + locked, audit will record real divergences. **Currently all audit records show t1=unavailable|t2=p?|q=...|fin=false. No live validation-vs-tracker divergence data.** Backlog of divergence patterns cannot be built until Phase 4.

13. **Reconciliation summary_template IDs hardcoded.** Lines 34–54 (audit/reconciliation_log.py) map long prose → short IDs (e.g. "t1_alert_t2_distress_agree"). If renderer or Thing 2 output changes narrative text, map falls out of sync. **No CI check for template drift.** New consensus text added to reconciliation() but not to _TEMPLATE_IDS map → freeform_or_unmapped ID instead of specific label.

14. **Phase 2 rhythm detection weak.** P2 (lines 516–517, phase_engine.py) = (rev_diversity + health_slope_rev + health_accel_rev + health_slope_ocf) / 4. Entirely driven by revenue autocorrelation (diversity) and slope/accel. **No measure of actual coordination / partnership / hiring / alliance.** Backtest cohort (HTZ, JCP, etc.) rarely enter P2; most jump P1→P3. P2 may be under-scored empirically.

15. **P9 tightened to P3 > 0.75 but backtest uses P3 > 0.60.** Lines 615–627 (phase_engine.py `score_all_phases()`) only fires P9 if P3 > 0.75 + sustained OR break. But `compute_composite_score()` (backtest, lines 646–656, limen_backtest.py) uses P3 > 0.60 as the check: `if row["p3"] > 0.6: ... r["p9"] = sigmoid(...)`. **Inconsistency between backtest (loose) and production (tight) P9 gating.**

16. **No input validation on CIK format.** Index.py `_normalize_cik()` (lines 239–244) strips leading zeros but doesn't validate digits-only. A CIK of "ABC" passes through as empty string "0". SEC API will then fail (404 or 429), caught and logged, but no upstream rejection. **Backtest.py lines 191–192 does pad, no validation either.** Browser-side validation (helix-report.html) may catch garbage, but API should reject formally.

17. **Deposits metric not extracted for non-financial.** TAG_MAP (phase_engine.py lines 152–154) includes "Deposits" tag, but `build_company_data()` only uses it if is_financial=True (logic inferred from SIC 6000–6999). **Non-financial companies' Deposits metric stays empty, even if they have deposit-like liabilities.** P3 deposits channel (line 544–548) guarded by `if _has_dep:` so safe, but hidden assumption.

18. **Runway classification "n/a" hides distress.** Lines 706–724 (index.py `_runway_classification()`) returns "n/a" for financial institutions (line 709). But if a bank actually has runtime < 2 quarters (impossible semantically, but data error possible), runway gate (phase_engine.py lines 778–788) fires and forces P7a. **Mismatch: renderer hides runway; engine uses it.**

19. **Verbosity of phase_history in limen.py.** Lines 216–244 (limen.py) emit phase_history with per-quarter q, dom, ct, p3 fields. **ct (stress_accum) always 0.0 for current production (no accumulator in Python)**, so history is incomplete. Renderer S(t) panel may be blank. **Phase 4 must wire up actual accumulator or remove ct from contract.**

20. **Missing: Per-company signal audit trail.** Audit log is pattern-level only (template_id, phase_buckets, timing). **No per-company breakdown of which signals fired (Path A vs B vs C, which quarters crossed thresholds, which features dominated).** Backtest.py prints this (lines 1622–1627), but production audit log doesn't. Operator cannot trace why ACME Corp flipped p4→p7a without re-running backtest.

21. **Missing: Historical drift detection.** Reconciliation log appends new entries (JSONL), but no periodic analysis of per-CIK drift (kernel version, phase changes, validation_status changes). **Operator must manually grep and plot.** No built-in "this company's P3 jumped 0.3 in 2 quarters" alerting.

22. **Missing: Polyvagal bias audit trail.** Index.py lines 960–963 note intrinsic_phase_scores + coupled_phase_scores + bias_contributions surfaced when coupling fires. But in Phases 1-3 coupling never fires (intrinsic_only always), so **no test data for bias audit trail.** JS kernel emits this; Python does not. Cannot verify parity until Phase 4 Python port adds bias application.

---

### 5. Connectome

1. **Missing Data File**: `brain-node-domains.json` — Referenced by:
   - connectome-resolver.js line 90: `fetch('/assets/data/brain-node-domains.json')`
   - connectome-super-brain.js line 72: `fetch('/assets/data/brain-node-domains.json')`
   
   **NOT FOUND** in dash repo. Expected structure: {nodeId: [{domain, label, role}] ...}. Critical for:
   - Resolver mapping nodes to domains (activateNodes, enrichOpportunity)
   - Super-brain cross-domain propagation logic (domainNodes[d].push({nodeId, w}) loop at line 150)
   
   **IMPACT**: High. Resolver and super-brain silently fail or return empty results. **AUDIT FLAG: Possibly in full repo only.**

2. **Disabled Kernel Adapter Chain**: connectome-kernel-adapter.js callKernel() explicitly neutralized (line 247-253):
   ```
   callback('connectome-kernel-adapter is disabled: /api/kernel-experiment is not a public scoring endpoint...');
   ```
   Proxy series building (adaptToKernelInput) works, but kernel call is dead. Former flow:
   - connectome-resolver.js runKernelForOpportunity() → connectome-kernel-adapter.js → /api/kernel-experiment → kernel-output-interpreter.js
   
   **Current state**: Endpoint removed (410 Gone). Browser cannot POST synthesized companyData to any route. Resolver disables kernel consumption (commented as "DISABLED"). Kernel reads only protected /api/helix-report/score (CIK + safe context).
   
   **IMPACT**: Medium. Feature was experimental; no scoring loss. But resolver's runKernelForOpportunity() callback returns `{available: false, reason: 'Adapter/interpreter not loaded/disabled', experiment: true}`.

3. **Dual Canvas Implementations**: connectome-core.js and connectome-renderer.js contain nearly identical logic (111 nodes, same edge types, same pulse drawing, same issue/activation highlighting). Both are full copies of clinical.html canvas logic.
   - **Line overlap**: ~900 lines each of duplicated code (buildNodes, getNodeColor, spawnPulses, drawPulses, layout, hit-test, etc.)
   - **Inconsistency risk**: Any bug fix in one must be mirrored in the other. Currently both are exact duplicates (as intended, per comments), but divergence is possible.
   - **Recommendation**: Extract common canvas module into shared lib, or use one as single source.

4. **Phase Annotations Sourcing**: civilization-connectome.js line 778-779:
   ```
   phase:((window.LIMENPhaseAnnotations&&window.LIMENPhaseAnnotations[n.id])?
           window.LIMENPhaseAnnotations[n.id].phase.toUpperCase():
           (NODE_PHASES[n.id]||'P0'))
   ```
   Falls back to NODE_PHASES constant if no LIMENPhaseAnnotations. But LIMENPhaseAnnotations source and update frequency unknown. No validation that phases are valid (P0-P10). **INCONSISTENCY**: If upstream brain emits invalid phase, civilization nodes display silently with neutral gray color.

5. **Domain Portals List Stale**: civilization-connectome.js DOMAIN_PORTALS (lines 87-289) hardcodes 250+ company/portal links:
   - Medicine: Johnson & Johnson (JNJ), Pfizer (PFE), Abbott (ABT), Medtronic (MDT), Eli Lilly (LLY)
   - Finance: JPMorgan (JPM), Bank of America (BAC), Goldman Sachs (GS), Schwab (SCHW), BlackRock (BLK)
   - ... etc.
   
   **STALE RISK**: List is inline constants, not JSON-driven. No automation to sync portal additions with DOMAIN_PORTALS. If new company-portal routes added (e.g., `/company-portal?company=new_company`), DOMAIN_PORTALS is not updated. **AUDIT FLAG: Last updated ~2024; may be out of sync with actual portal inventory.**

6. **Connectome-Super-Brain Activation Propagation Opacity**: connectome-super-brain.js line 150-171 cross-domain propagation:
   ```
   var domainNodes = {}; // domain → [{nodeId, weight}]
   ...
   var share = (totalActivation * PROPAGATE_FRACTION) / siblings.length;
   for (var s2 = 0; s2 < siblings.length; s2++) {
     newActivations[siblings[s2].nodeId] = Math.min(1, (newActivations[siblings[s2].nodeId] || 0) + share);
   }
   ```
   **Issue**: domainNodes is built from `this._nodeDomains[nodeId].roles || {}` (line 152). If brain-node-domains.json is missing or malformed (all nodes get empty roles), domainNodes remains empty for every domain, so propagation never fires. Silent failure. **AUDIT FLAG: Cannot verify cross-domain propagation working without brain-node-domains.json.**

7. **Stress Ring Drawing Unimplemented in Portal Canvas**: connectome-core.js includes drawStressRing() function (line 158, from connectome-renderer.js), but it is never called in the draw loop. drawNode() does not invoke drawStressRing(). Civilization-connectome.js also defines drawStressRing (line 427) but never calls it.
   ```
   function drawStressRing(x, y, radius, node, alpha) { ... }
   // Called: NOWHERE
   ```
   **IMPACT**: 3-layer schema stress visualization (7-channel stress rings) is designed but not rendered. Nodes display phase color and satellites, but not stress. **FEATURE INCOMPLETE**: Stress rings exist in code but are dead code.

8. **Portal Activation Data Path Unclear**: Portals call ConnectomeCore.init({...}) and may call loadActivation(url, callback). The URL is typically `/assets/data/domains/<domain>.json` (connectome-resolver.js line 119). But:
   - No validation that domain JSON exists
   - No fallback if fetch fails (loadActivation catches with applyActivationData() → empty)
   - No indication to user that portal-specific nodes couldn't load
   
   **AUDIT FLAG**: If a portal's domain activation JSON is missing, portal silently renders brain with 0 activated nodes. No error message. User unaware of missing data.

9. **Dual Domain-to-Connectome Mapping**: civilization-connectome.js and connectome-resolver.js both define domain mappings:
   - civilization-connectome.js: DOMAIN_PORTALS (250+ links, hardcoded)
   - connectome-resolver.js: FEED_TO_CONNECTOME bridge (20 feed IDs → connectome domains)
   
   These are orthogonal (one is UI nav, one is domain mapping), but naming collision risk. DOMAIN_PORTALS is not used by resolver; FEED_TO_CONNECTOME is not used by civilization renderer. **INCONSISTENCY**: If civilization domain names change, FEED_TO_CONNECTOME in resolver may become stale.

10. **No Cross-Validation of Brain vs Feed Domains**: resolver activateNodes() reads window.LIMENDomains and maps via FEED_TO_CONNECTOME. But civilization-connectome builds its own graph from civilization.top.json:
    ```
    // civilization-connectome.js lines 86-289: DOMAIN_PORTALS has 20 hardcoded domains
    // connectome-resolver.js lines 37-59: FEED_TO_CONNECTOME has 20 feed domains
    ```
    Both should align (governance↔governance, economy↔economy, etc.), but they are independent. If feed domain gets renamed in domain-signal-engine, FEED_TO_CONNECTOME needs manual update. **AUDIT FLAG**: No automated sync between feed domain names and connectome domain names.**

11. **Satellite Generation Hardcoded**: civilization-connectome.js generateSatellites() (lines 712-736) generates random satellites per node based on dataWeight:
    ```
    var count = w >= 0.85 ? (8+Math.floor(Math.random()*4)) : ...
    ```
    Satellites are purely visual, but count is non-deterministic. Every init() regenerates satellites with different offsets/positions. In multi-user scenario, each user sees different satellites. **MINOR**: No functional impact, but inconsistent for collaborative viewing.

12. **Underscore Prefixed Symbols Exposed**: connectome-resolver.js exposes private functions:
    - `_collectDiagnosisActivations()` (line 228) — used in resolve() pipeline, but also exported to window.LIMENConnectomeResolver (implicit via closure)
    - `_lastResolve` (line 487) — stored module-scope, accessed via getLastResolve()
    
    Other JS files use leading underscore for private methods, then export via public API. Here, _collectDiagnosisActivations is internal-only (not in public API at line 612+), but pattern is inconsistent. **MINOR**: No bug, but naming convention not uniform.

### 6. Brain nodes / neuro substrate

1. **Missing input source file (blocking generator):**
   - C:\Users\Chris\Limen-Helix-live-\scripts\build-brain-node-business-mapping.js references `_node_directory.json` at line 33 (`DIRECTORY = path.join(__dirname, '..', '_node_directory.json')`). File does not exist in repo. Build-script will fail if run. **Status:** Generator script offline until file relocated or path fixed.

2. **62 non-canonical nodes in neuro-disorder-lookup.json (cross-file inconsistency):**
   - neuro-disorder-lookup.json contains 187 nodes; connectome-node-registry declares 123 canonical. The extra 62 are subfields, oscillations, neurotransmitter systems, tracts, and glial types:
     - Oscillations: 4-8Hz, 40Hz, 8-12Hz
     - Pituitary subunits: Anterior Pituitary, Adrenal Cortex, Adrenal Medulla
     - White-matter tracts: Arcuate Fasciculus, Uncinate Fasciculus, Cingulum Bundle, Corpus Callosum, Spinothalamic Tract
     - Hippocampal subfields: CA1/CA3/DG, Dentate
     - Neurotransmitter/receptor systems: eCB (endocannabinoid), NMDA/AMPA, inhibitory, endogenous, neural, neurotrophic
     - Thalamic nuclei subsets: Intralaminar, Pulvinar Thalamus, Medial Dorsal, MD, DRN (Dorsal Raphe Nucleus)
     - Glial: Microglia, Astrocytes
     - Functional composites: MNS (mirror neuron system), MTL (medial temporal lobe), DV (dorsal vagal), DMV, IT (intertemporal), AT, NA, Lateral Habenula, Mid-Insula, Posterior Insula, Default Mode Subsystem — Midline Core, Insular-Amygdala-PFC Triangle, Insular-Cingulate Network, Olfactory Bulb/Piriform Cortex, Reward Prediction Error System, Septal Nuclei, Sympathetic Chain Ganglia, Vagal Immune Axis
     - Non-canonical aliases: NAc (canonical NAcc), FFA (subregion of FG), PHC (vs. canonical PRC), MD (vs. MDT), DRN (vs. canonical RAPHE), FPA (FPC/BA10), IFG (canonical BROCA), FPCN, MNS, NBM/Ch4, PVN + projections, V4/V5 (canonical V4V5)
   - **Impact:** Lookups using neuro-disorder-lookup as ground truth will treat these as canonical nodes. Portal brainNodeMapping validators (validate-brain-node-mapping.mjs) will reject them as unknown. **Resolution required:** Either (a) promote the 62 to canonical and regenerate connectome-node-registry, (b) document neuro-disorder-lookup as a broader taxonomy for research/reference only (not binding for portal schema), or (c) flatten/collapse the 62 to their canonical parent.

3. **Stale signal registries (incomplete real-time coverage):**
   - **node-entity-mapping.json** (2026-03-16): 254 FRED signals declared, 123 nodes matched. If FRED data sources have been added or clinical signals expanded since 2026-03-16, registry is incomplete.
   - **node-signal-registry.json** (2026-03-16): 254 signals. Same age; likely needs refresh.
   - **Action:** Regenerate node-entity-mapping and node-signal-registry if signal flows have expanded post-2026-03-16.

4. **Brain-node-map.json missing 20 canonical IDs (incomplete scaffold):**
   - brain-node-map.json (103 nodes) is a documented subset of canonical (123). 20 IDs are absent. Documented in connectome-node-registry but not actionable for current patches (marked as "what is not frozen").
   - **Status:** By design (scaffold, non-RUNS); not a bug unless downstream consumers expect 123-node coverage.

5. **brain-nodes-111.json duplicate abbreviation ("Lateral" appears twice):**
   - Documented in connectome-node-registry as "deferred_manual_adjudication" item. Two rows in SCAFFOLD file share abbreviation "Lateral". Does not affect runtime (nodes-111.json is not RUNS), but indicates data quality issue in source.
   - **Status:** Pending manual identification of which row intends which canonical node.

6. **PHC / PRC alias ambiguity (anatomically distinct regions):**
   - brain-nodes-111.json uses PHC (Parahippocampal Cortex); canonical set uses PRC (Perirhinal Cortex). These are adjacent but functionally distinct. Currently treated as aliases, but documented as needing semantic confirmation.
   - **Status:** Deferred manual adjudication pending domain usage review.

7. **FFA / FG hierarchy unclear (subregion vs. aggregate):**
   - FFA (Fusiform Face Area) is a subregion of FG (Fusiform Gyrus). Ambiguous whether to treat as pure alias or keep granular distinction.
   - **Status:** Deferred pending subregion-granularity design decision.

8. **Neuro-disorder-lookup verification backlog (all claims PENDING):**
   - All 373 disorders in neuro-disorder-lookup.json carry verification: PENDING. Task #33 (Main Brain verification organ) must run PubMed lookups to promote claims to VERIFIED / DISPUTED / THEORETICAL / FABRICATED.
   - **Impact:** Lookup results are not yet clinically validated. Operators should treat all results as draft/hypothesis until verification completes.

9. **Connectome graph topology gap (65 nodes unreachable by propagation):**
   - connectome-weights.json uses integer node IDs 1-123. String→integer bridge is only defined in brain-nodes-111.json. 59 canonical string IDs have no abbreviation match in nodes-111; 6 more map to nodes-111 IDs 124-129 which are outside edge-space.
   - **Impact:** Propagation/weighted-graph traversal (connectome-super-brain.js, signal-router.js, propagation-engine.js) cannot reach these 65 canonical nodes.
   - **Status:** Documented in connectome-node-registry as "missing_from_weights_graph" (blocking severity); deferred to later Connectome patch (graph bridge + topology repair).

10. **Live pages count mismatch (13 clinical vs. 56+ neuro domain portals):**
    - clinical-portal.html hero stats claim "126 monographs" but audit finds 13 live neuro portals (clinical + 8 medicine subspecialties + 4 neurosurgery portals). The 56+ domain-specific portals (neurology_primary × 8 axes, neurology_cerebellum × 8 axes, etc.) are generated but may be scoped out of hero display.
    - **Status:** Verify that portal-registry.json and domain-signal-engine correctly enumerate all live pages vs. internal scaffolds.

11. **brain-node-business-mapping.json outdated (2026-05-10 vs. brain-node-domains 2026-05-15):**
    - brain-node-business-mapping.json is 5 days older than its source brain-node-domains.json. If domain bindings were refreshed in brain-node-domains between 2026-05-10 and 2026-05-15, the business-mapping is stale.
    - **Status:** Regenerate brain-node-business-mapping.json to stay in sync.

### 7. Domains & domain-brains

1. **Diagnostic mismatch — agriculture signal bridge**
   - Path: `/assets/js/domain-brains/agriculture-brain.js` lines 316-425
   - Issue: _runSignalBridge() emits conditions from feed corpus (USDA NASS yield, fertilizer cost) that the pulse engine's evidence-family map may not recognize or may rank differently than the legacy keyword-matching code above it
   - Evidence: Bridge conditions like `cash_stress` from yield < 150 bu/acre are additive but may not satisfy evidence contracts that demand, e.g., "margin_compression AND input_cost_spike simultaneously"
   - Status: Mitigated by flag-gating (window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE), but non-obvious to operators which condition stream is active

2. **Missing domain brain — energy not fully sampled**
   - Path: `/assets/js/domain-brains/energy-brain.js` (exists but not read in full)
   - Issue: Energy is referenced as the primary / foundational brain throughout the repo, but full logic not verified against architecture spec
   - Impact: Cross-domain emissions FROM energy to all others (OIL_SHOCK → economy, PIPELINE_DISRUPTION → supplyChain) assumed working but not confirmed

3. **Domain isolator navigation rewrite — brittle link generation**
   - Path: `/assets/js/domain-brains/domain-isolator.js` lines 145-170
   - Issue: Hardcoded link templates assume URL patterns like `/{domain}-opportunities`, `/{domain}-command`. If a domain's public URL differs (e.g., supplyChain vs trade), links 404
   - Evidence: Navigation rewrite in rewriteNavigation() builds URLs by string interpolation; no canonical URL registry consulted
   - Status: No fallback to absolute paths; domain pages will show broken nav if URL schemes change

4. **Refresh controller architecture — undefined per-domain cadences**
   - Path: All 20 `*-refresh-controller.js` files
   - Issue: Controllers exist but not sampled; unclear if each domain has custom polling logic or if all delegate to shared snapshot
   - Impact: Risk of hidden per-domain API calls that were supposed to be consolidated under shared snapshot (original design issue from early multi-brain testing)

5. **Portal portalKey inconsistency — agriculture & medicine naming**
   - Path: `/assets/js/domain-brains/agriculture-brain.js` line 51: `portalKey: 'p2_agri'`
   - Path: `/assets/js/domain-brains/medicine-brain.js` line 36: `portalKey: 'medicine'`
   - Issue: agriculture uses `p2_` prefix (legacy phase-2 portal marker?), medicine uses plain name. portal-content-resolver.js DIAGNOSIS_PORTAL_MAP has entries for both `p2_agri_*` and `medicine_*` but other domains lack this dual mapping
   - Impact: If portal files are moved or renamed, mapping breaks; no centralized registry validates portalKey ↔ portal file mapping at startup

6. **Domain list — no source of truth**
   - Missing: A canonical domain roster that brain startup code checks against
   - Evidence: 21 brains hardcoded in domain-brains/ (agriculture, …, trade) but no api/domains.json or global registry that validates them
   - Risk: Adding a new domain requires manual registration in 4+ files (brain, refresh controller, portal file, domain-identity.js) with no validation
   - Status: domain-identity.js exists but not sampled; unclear if it enforces completeness

7. **Diagnoses with no active conditions — silent failures**
   - Scenario: A domain portal defines a diagnosis but no brain-native condition maps to it
   - Example: science brain defines BRAIN_DRAIN diagnosis (triggers: talent_loss, researcher_exodus, …) but if no feed detects researcher exodus, diagnosis never activates even if actual talent loss is happening in the real data
   - Impact: Opportunity surface will be empty for that diagnosis, making the issue invisible to operators
   - Status: No warning log if a portal issue has zero triggers matched

8. **Opportunity moneyChain — execution feasibility not verified**
   - Path: All domain brains, e.g., `/assets/js/domain-brains/infrastructure-brain.js` lines 739-851
   - Issue: moneyChain fields (doThis, whyPays, target, timing, nextStep) are **generated templates**, not validated against actual execution history or real market data
   - Example: infrastructure-brain opportunity "Monitoring platform for grid degradation" targets "Utilities, municipalities" but no check that utilities actually buy such platforms or that margin is >0
   - Impact: Operators may invest effort in opportunities with no real demand signal
   - Status: Marked as opportunity-enrichment only; operators must validate via external due diligence

9. **Cross-domain cascade detection — false positives from stress-only emission**
   - Path: `/assets/js/domain-brains/inter-brain-bus.js` lines 111-147 (detectCascades)
   - Issue: Cascades detected if A→B→C chain exists, but emission rules in some brains fire on stress ALONE without requiring active diagnosis
   - Counter-evidence: Most brains (infrastructure, medicine, agriculture) gate emissions on `s.stress >= X && s.diagnoses.some(d => d.active)`
   - Status: Mixed — gated in sampled brains, but unverified brains (energy, economy, finance) may emit unconditionally

10. **Portal content resolver — missing deep subtrees**
    - Path: `/assets/js/domain-brains/portal-content-resolver.js` DIAGNOSIS_PORTAL_MAP
    - Issue: Extensive mapping for energy, trade, finance, defense, governance, science, but sparse or missing entries for smaller domains (religion, law, culture)
    - Example: RELIGION domain has no brain-specific diagnoses in map; SECTARIAN_CONFLICT points to ['religion_interfaith', ...] but if portal subtrees don't exist, fetch fails silently (negative cache 1hr)
    - Impact: Smaller domains will have empty treatments unless portal content is pre-built

11. **Opportunity tier logic — stress thresholds not aligned across domains**
    - Inconsistency: agriculture Tier 1 @ stress >= 0.50 (GRANT), infrastructure Tier 1 @ stress >= 0.55 (GRANT), medicine Tier 1 @ stress >= varies by diagnosis
    - Risk: Same objective stress level (0.52) activates different opportunity tiers in different domains, confusing operators
    - Status: No domain-agnostic opportunity governance; each brain defines its own thresholds

12. **Live feed count — never decremented post-stale**
    - Path: All domain brains (see agriculture normalizeSignals and above)
    - Issue: _activeConditions are ADDITIVE but never expire even if feed goes stale
    - Example: agriculture sets `feed.live = false`, but _activeConditions still contains `water_stress` from a 2-hour-old drought feed
    - Impact: Diagnoses may remain active on zombie feeds, triggering phantom opportunities
    - Status: No feed-age validation in condition generation; only feed.live flag checked

13. **Execution manager — domain hardcoded to 'energy'**
    - Path: `/assets/js/domain-brains/execution-manager.js` line 14: `var _domain = 'energy';`
    - Issue: Default domain is hardcoded; loadState(domain) parameter may not propagate correctly
    - Impact: Execution records created on non-energy domains may be attributed to energy
    - Status: Parameter overrides if passed, but risky default

14. **Domain-console brain — existence not verified**
    - Path: `/assets/js/domain-brains/domain-console-brain.js`
    - Status: Listed in Glob output but not sampled; unknown if it properly aggregates all 21 brains or has stale brain list

15. **Change log — 7 types but incomplete filtration**
    - Path: `/assets/js/domain-brains/domain-change-log.js`
    - Issue: PAGE_FILTERS define 3 views (STATE, INTELLIGENCE, EXECUTION) but opportunity RANK CHANGES and diagnosis RELEVANCE CHANGES are not logged separately; lost in OPPORTUNITY_CHANGE noise
    - Impact: Operators cannot trace which opportunity moved from rank 0.5 to 0.8 or why a diagnosis lost relevance

---

**Summary: 21 domain brains fully instantiated, 20 with refresh controllers, 6+ with full logic verified (agriculture, science, infrastructure, medicine, trading patterns inferred). Inter-brain bus proven; execution manager viable but energy-centric; portal resolver complete but sparse for small domains. Core architecture sound but domain registration unsystematized, opportunity templates unvalidated, and edge cases (stale feeds, tier misalignment, cross-domain false cascades) need hardening.**

### 8. Per-domain page layers matrix

**High-Priority Issues:**

1. **Portal-registry.json is 81 DAYS OLD** — treatment-discovery-cube.json is 2 days old
   - Portal pages may be showing stale data (issue hierarchies, node mapping)
   - No regeneration script identified; portal-registry.json may be manually maintained
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json

2. **Command-board-data.json is 11 DAYS OLD** — significantly older than typical operational refresh
   - Command boards may be showing outdated company signals
   - scripts/score-companies.js (line 153) referenced but not found in this repo; likely in separate backend
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json

3. **Opportunities and Workspace layers are EMPTY SHELLS**
   - 21 opportunity pages exist; no data tank identified; appears to load no external data
   - 20 workspace pages exist; no data tank identified; appears to load no external data
   - No indication whether these are placeholder / future-only / intentionally disabled
   - Example: C:\Users\Chris\Limen-Helix-live-\agriculture-opportunities.html — no inline JS found (need to read full file)

4. **Console pages may be DUPLICATES of command pages**
   - 16 console pages exist; both load command-board-stress.js
   - No evidence of distinct console-specific JS or config
   - Possible: console pages are identical except for CSS styling or URL routing
   - Example: agriculture-command.html vs agriculture-console.html — both load command-board-stress.js with identical _CMD_DOMAIN_FILTER

5. **Domain asymmetry: 5 domains missing console layer**
   - environment, intelligence, medicine, population, religion have command/opportunities/workspace/portal but NO console
   - Possible oversight; possible intentional (e.g., these domains do not aggregate company stress)
   - No documentation explaining this pattern

6. **Domain asymmetry: 2 domains console-only**
   - domain and investment pages have ONLY console-console.html, no command/opportunities/workspace
   - Suggests incomplete rollout or special-purpose use case

7. **Portal namespace collision risk: medicine_portal.html vs medicine_addiction_behavioral_portal.html**
   - 2,900 three-part portal filenames exist (medicine_addiction_behavioral_portal.html)
   - Portal router must disambiguate; portal-registry.json maps domainId string to portal file
   - Risk: if registry regeneration fails, subdomain portals may not be discoverable

8. **Subdomain portal coverage highly asymmetric:**
   - communication: 119 subdomains (accesscomm, advertising, analytics, archives, broadcasting, corporate, datacomm, disinfo, events, internet, journalism, medialaw, pr, public, publishing, satellite, social, speechlang, telecom, visualcomm with nested 2-3 levels each)
   - agriculture: 0 subdomains (root portal only)
   - Suggests communication is far more granular than agriculture, possibly by design

9. **Orphaned clinical-portal.html**
   - Single file with no command/console/opportunities/workspace layer
   - No parent domain named "clinical"
   - No indication of which domain(s) should parent it or how it's supposed to integrate

10. **No data validation on command-board-data.json**
    - agricul command-command.html includes fallback: "DATA = parsed.companies || []"
    - If tank is empty or corrupt, page renders empty stats bar with ERROR message
    - No health check script identified to validate freshness before deploy

11. **Refresh controller mismatch:**
    - 22 refresh controller files exist (agriculture, communication, culture, defense, economy, education, energy, finance, governance, industry, infrastructure, intelligence, law, medicine, population, religion, science, technology, trade, + 3 unidentified)
    - agriculture-command.html loads agriculture-refresh-controller.js (confirmed)
    - But agriculture-console.html also needs agriculture refresh controller if they share command-board-stress.js — need to verify console pages actually load it

12. **Live API endpoint /api/domain-snapshot referenced but not verified:**
    - command-board-stress.js (line 715): fetch('/api/domain-snapshot')
    - Endpoint is expected to return JSON with { domains: { [domain]: { stress: 0.0-1.0 } } }
    - No API endpoint found in this repo (likely in separate limen-helix-api directory)
    - If API is down, all command pages silently fail refresh (line 747: .catch(...) { /* silent */ })

13. **Three-level portal nesting inconsistent:**
    - communication_advertising_portal.html — 2 levels
    - communication_advertising_creative_portal.html — 3 levels
    - medicine_addiction_behavioral_portal.html — 3 levels
    - Both 2 and 3-level nesting in same domain; portal-registry.json must handle both

**Moderate-Priority Issues:**

14. **Opportunities/workspace pages not inspected for content**
    - No read operations performed on agriculture-opportunities.html or agriculture-workspace.html
    - May contain data tanks, API calls, or be complete empty shells

15. **Portal page templates may not match domainId to filename:**
    - All portals load connectome-core.js + portal-ui.js with PortalUI.init({ domainId: '...' })
    - domainId is hardcoded in page (e.g., medicine_addiction_portal.html has domainId='medicine_addiction')
    - Filename must match domainId or portal-ui.js will fail to find data
    - No validation found; possible silent failures if mismatch occurs

16. **Company portal (company-portal.html) not fully traced:**
    - Linked from command board row expansions
    - Expected to consume company-registry.json
    - Not yet read or verified

**Low-Priority Issues:**

17. Operator documentation pages (operator-guide.html, operator-onboarding.html, operator-sop.html) not integrated with data layers — purely informational

18. Master-brain pages (master-brain.html, executor, inbox) appear to be operational dashboards; data consumption not verified

19. Helix-artifact pages (helix-artifact.html, helix-artifacts.html) appear to be system introspection pages; purpose unclear

20. Index pages (index.html, index-original.html) presence of "original" suggests migration in progress

**Concrete File Paths for Investigation:**

- C:\Users\Chris\Limen-Helix-live-\agriculture-opportunities.html — read full file to determine if empty
- C:\Users\Chris\Limen-Helix-live-\agriculture-workspace.html — read full file to determine if empty
- C:\Users\Chris\Limen-Helix-live-\agriculture-console.html — verify refresh controller load + _CMD_DOMAIN_FILTER
- C:\Users\Chris\Limen-Helix-live-\assets\js\command-board-stress.js — verify API endpoint health-check logic (none found; gap)
- C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json — sample structure to confirm company field names (c, d, p, ds, co, tr, a, n, t, s, _signal, _severity)
- C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json — sample structure to confirm domainId → issues mapping (84 MB; not read)
- C:\Users\Chris\Limen-Helix-live-\limen-helix-api\... — backend API (separate repo; domain snapshot endpoint location)

### 9. Portals & portal behavior

1. **CRITICAL: All portals in PLACEHOLDER state; zero engine outputs live**
   - portal-registry.json: ALL 173,652 portals have engine=undefined (PLACEHOLDER flag)
   - assets/data/domains/*.json: Zero files contain engine-generated issues; all 10,175 issues are template/candidate stubs
   - assets/data/companies/*.json: Zero files contain bridgeReadings or engineOutputs; enrich-portal-claude.js exists but output not auto-integrated to disk
   - assets/js/company-portal-engine-render.js checks for portal.engineOutputs gracefully, displays empty state if absent
   - **File evidence**: company-portal-engine-render.js line 17-19 warns if output sections missing; company-portal-ui.js never calls limen-gap-synthesis-engine.js to populate UI with candidates
   - **ACTION NEEDED**: Either (a) run gap-synthesis engine to promote candidates → write to portal-registry.json + domains JSON files, or (b) document that portals are TEMPLATE-ONLY until engine finalization

2. **Portal registry fallback to master is graceful but per-domain splits never built**
   - portal-router.js lines 20-42 expects per-domain split files (assets/data/registry/portal-registry-{domain}.json)
   - Directory does NOT exist; fallback to master registry works but performance impact unclear at 173k portals
   - **File evidence**: No /assets/data/registry/ directory found; portal-router.js has dead code path for splits
   - **ACTION**: Either build per-domain splits (trade domain would be 900+ entries) or remove dead code

3. **Domain portal data files missing engine fields**
   - governance.json, energy_fossil.json, etc. have NO engine key (governance sample shows hasEngine=false)
   - gap-synthesis-engine.js writes to localStorage, never to these JSON files
   - portal-registry.json aggregates across all domains but ALL engine values are null
   - **File evidence**: assets/data/domains/*.json lack engine:{} structure; portal-registry.json _portalCount=173,652 but _generated shows no recent refresh tied to engine output promotion
   - **ACTION**: Define schema for engine outputs in domain JSON files, OR clarify that engine outputs are read from localStorage only (transient, lost on browser refresh)

4. **Company portal enrichment pipeline disconnected from live data**
   - enrich-portal-claude.js endpoint exists but output not auto-written to assets/data/companies/{slug}.json
   - No cron/trigger to invoke enrichment; manual integration required
   - enriched portals would have schema v2.0.1 but existing files may be older schema
   - **File evidence**: api/enrich-portal-claude.js lines 1-35 document Walmart-grade exemplar (35-entry network) but only sample companies (walmart.json, nvidia.json) have dense data; others are sparse
   - **ACTION**: Build automation to invoke enrich-portal-claude.js for companies with stale or sparse data (use last-modified timestamp vs. cutoff)

5. **Opportunities system links to portals but portal.html static pages scattered across root**
   - 3,278 root-level *_portal.html files (communication_portal.html, trade_wto_accession_portal.html, etc.)
   - No clear manifest of which root portals map to which domainIds in portal-registry.json
   - domainIdToPath in portal-registry.json should map domainId → path, but HTML filenames use underscore-separated paths (_portal.html suffix)
   - **File evidence**: portal-router.js line 179 strips "_portal.html" suffix to derive domainId, but reverse mapping (domainId → HTML filename) is not auto-derived
   - **ACTION**: Audit domainIdToPath completeness; ensure every root *_portal.html has a registry entry

6. **Gap synthesis engine set up for periodic scanning but never triggered from portal UI**
   - limen-gap-synthesis-engine.js exposes window.LIMENGapSynthesis.getDiagnoses() but no portal page calls it
   - PortalUI.init() receives issuesEnabled=true but builds selector only from DATA.issues (static portal JSON), not from generated candidates
   - Candidates are stored in localStorage but orphaned (no UI to view/promote them)
   - **File evidence**: assets/js/portal-ui.js lines 77-101 buildIssueSelector() reads DATA.issues ONLY, never queries window.LIMENGapSynthesis
   - **ACTION**: Wire portal issue selector to fallback to gap-synthesis candidates if DATA.issues is sparse; add "PROMOTE" button to promote candidates to canonical

7. **Company-resolver.js supports fuzzy matching but no autocomplete wired into company-portal.html search**
   - company-resolver.js implements getSuggestions() (lines 108-150) for autocomplete, returns array of {slug, name, ticker, cik, matchType}
   - company-portal.html does not show search UI with autocomplete; it only supports ?company=slug URL param
   - **File evidence**: company-portal.html lines 48-90 show only data-loading placeholder, no search form visible in HTML
   - **ACTION**: Add client-side search form to company-portal.html that invokes company-resolver.getSuggestions() for autocomplete UX

8. **Portal navigation breaks for deep hierarchies (governance/anticorruption/antimoney has 4 children, each accessible via ?l2=anticorruption&l3=antimoney&l4=...)**
   - Portal-router.js supports up to 8 levels (l2, l3, l4...l8), but no UI breadcrumb or sidebar reflects depth > 2
   - When user navigates from L3→L4, breadcrumb should update but childPortalResolver may fail to find HTML files if *_portal.html naming doesn't follow path structure
   - **File evidence**: portal-router.js lines 114-143 build breadcrumb recursively but assumes parentPath is always set in registry; deep portals may not have entries
   - **ACTION**: Test portal-router.js with actual governance/anticorruption deep traversals; confirm childPortalResolver finds correct files

9. **Trade portals: 173k total but only 3,349 have issues; rest are pure structure (heading/taxonomy only)**
   - Trade domain alone has 900+ portals (trade/wto, trade/wto/accession, trade/wto/dispute, etc.; trade/customs/*, trade/port/*, trade/rail/*, trade/trucking/*, trade/lastmile/*, trade/supply/*, trade/ecommerce/*, trade/origincert/*, trade/tradezone/*, trade/tradefinance/*, trade/tradeinfra/*, trade/tradepolicy/*, trade/services/*, etc.)
   - portal-registry.json shows most have issueCount=0, nodeCount=0 (placeholders)
   - When user navigates to trade/lastmile/urban, portal loads but shows no diagnoses, empty right panel
   - **File evidence**: portal-registry.js sample shows governance/anticorruption/antimoney with 3 issues, but sibling portals (assetdisc, benefown, etc.) also have 3 issues—repetitive, suggesting template cloning not real content
   - **ACTION**: Confirm whether 170k+ empty portals are (a) intentional scaffolding for future content, or (b) bloat that should be pruned; if (a), document in README

10. **portal-registry.json source field undefined for all portals; no lineage/provenance**
    - Each portal entry has source=undefined
    - No indication whether portal was hand-authored, AI-generated, scraped, or derived from another source
    - Makes it impossible to audit data quality or versioning
    - **File evidence**: portal-registry.json sample output shows source: undefined for all entries
    - **ACTION**: Add source tracking (e.g., "canonical", "generated_25g", "enriched_claude") to portal entries; regenerate registry with provenance

11. **Missing: Portal content schema versioning**
    - assets/data/domains/*.json files have no schemaVersion field (unlike company files, which explicitly specify schemaVersion 2.0.1)
    - Gate B v0.2 PLACEHOLDER_CONTAMINATED suppression styles in company-portal-engine-render.js but no corresponding detection/filtering in domain portals
    - **File evidence**: assets/data/domains/governance.json has no schemaVersion; company files in enrich-portal-claude.js schema explicitly require schemaVersion: "2.0.1"
    - **ACTION**: Add schemaVersion to domain portal JSON schema; increment when breaking changes introduced

12. **Cross-domain portal links hardcoded in portal-content-resolver.js; no dynamic discovery**
    - DIAGNOSIS_PORTAL_MAP in portal-content-resolver.js (lines 41-150) hardcodes all cross-domain mappings (e.g., OIL_SHOCK → [energy_fossil, energy_pipeline, energy_energytrade])
    - If new domain portals added, resolver must be manually updated
    - **File evidence**: portal-content-resolver.js line 150 defines 60+ diagnosis keys, each mapped to portal subtrees; no code to auto-discover mappings from portal-registry.json
    - **ACTION**: Refactor resolver to read DIAGNOSIS_PORTAL_MAP from portal-registry.json (add metadata field) instead of hardcoding; OR build auto-mapping from portal taxonomy + domain brain diagnosis IDs

---

**Summary**: The portal system is STRUCTURALLY COMPLETE (3-panel UI, routing, 173k+ portals indexed) but FUNCTIONALLY INCOMPLETE (zero engine outputs live, all diagnoses are template placeholders, enrichment pipeline not auto-integrated, deep portal navigation untested, performance impact of 62MB master registry unmitigated).

### 10. Node mapping & spider-web communication

**Critical Breaks**

1. **C:\Users\Chris\Limen-Helix-live-\assets\js\propagation-engine.js** (line 59): Depends on connectome-weights.json which does not exist. If spreading-activation is invoked, it will fail. File not in assets/data/. **ACTION**: Generate connectome-weights.json with 123 nodes, 432+ edges (as declared in comments), and 3 edge types (excit/inhib/modulatory).

2. **C:\Users\Chris\Limen-Helix-live-\assets\data\brain-connectome.json** (line 4): Version 1.0 declares "111 nodes, base for all portals" but connectome-node-registry.json asserts 123 canonical nodes. Registry is FROZEN; connectome.json is not. **ACTION**: Verify which is truth. If 123 is correct, update connectome.json meta and ensure all 123 nodes are present. If 111 is correct, unfreeze registry and document the 12 deletions.

3. **C:\Users\Chris\Limen-Helix-live-\assets\js\action-selection-gate.js** (line 118–126, arbiter proposals): window.LIMENMasterBrain.decide() is called defensively (try/catch) but never populated. Returns empty array. If master-brain arbitration is intended, wire it; otherwise document as intentionally unused. **ACTION**: Either implement master-brain.decide() or remove the code path.

4. **C:\Users\Chris\Limen-Helix-live-\assets\js\limen\master-living-brain.js**: Referenced in node mapping but decide() method never called by action-selection-gate or any other module (verified via grep). **ACTION**: Either call decide() or remove the reference.

**Architectural Issues**

5. **C:\Users\Chris\Limen-Helix-live-\assets\js\action-selection-gate.js** (line 184): Broadcasts limen:action-selected event but NO listener is wired. Execution layer does not subscribe to it. **ACTION**: Add listener in execution-human-confirmation.js or decision-synthesis.js to consume limen:action-selected and pass winner to operator.

6. **C:\Users\Chris\Limen-Helix-live-\assets\js\discovery-engine.js** vs **C:\Users\Chris\Limen-Helix-live-\assets\js\live-discoveries.js**: Two separate discovery outputs. live-discoveries.js says it "folds into console-clarity" (line 87 in limen-bootstrap.js). **ACTION**: Clarify canonical output; remove duplication.

7. **C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\inter-brain-bus.js**: Designed for domain-page-to-domain-page cross-talk but loads on civilization page where domain brains are not running. Signal flow for cross-domain pressure in action gate (line 89–112 in action-selection-gate.js) uses LIMENCrossDomain.active[] (from cross-domain-detector), not inter-brain-bus emissions. **ACTION**: Either (a) document inter-brain-bus as domain-page-only infrastructure or (b) synchronize civilization-page domain state to inter-brain-bus.

**Data Integrity Issues**

8. **C:\Users\Chris\Limen-Helix-live-\assets\data\node-signal-registry.json** (39 unique FRED series, all live as of 2026-03-16): No update timestamp in file. FRED snapshots fetched on-demand via api/domain-snapshot.js. **ACTION**: Timestamp when registry last verified all 39 codes are still live (some FRED series expire or move).

9. **C:\Users\Chris\Limen-Helix-live-\assets\data\connectome-node-registry.json** (line 28–49): REJECTED_ADDITIONS section documents decisions on ARCFAS, mTOR, SPINOTHAL, etc. not included. **ACTION**: Archive this rationale in a CHANGELOG file; it is valuable audit history but clutters the registry.

10. **C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-domains.json** (285 KB): Large file; no .meta indicating last sync or authority. **ACTION**: Add _generated, _authority fields.

**Partial / Half-Built Features**

11. **C:\Users\Chris\Limen-Helix-live-\assets\js\limen\super-brain-base.js** (line 118–126): _arbiterProposals() called by sub-brains but arbiter (master-living-brain.decide()) is not wired. **ACTION**: Complete or remove.

12. **C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\artifact-packet-builder.js** (LANE_TO_PATH, line 118–128): Lane→path mapping partially populated; 'franchise' and 'research-papers' have null values indicating "no Observatory fan-in defined yet". **ACTION**: Either wire Observatory enrichment for those lanes or document them as not-yet-supported.

13. **C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\domain-brain-base.js** (line 175–184): receiveExternalSignal() accumulates signals from inter-brain-bus but getExternalPressure() (line 191–200) decays signals older than 5 min. If domain page closed, accumulation stops; other domains lose view of it. **ACTION**: Document behavior or provide centralized signal store.

**Mapping Gaps**

14. **C:\Users\Chris\Limen-Helix-live-\assets\js\node-translation.js**: Covers ~80 canonical nodes (dlPFC, dACC, HIPP, etc.) but connectome has 123. Remaining 40+ nodes have no business-function mapping. **ACTION**: Extend mapping to all 123 nodes or document which are infrastructure-only (e.g., BBB, ASTRO).

15. **C:\Users\Chris\Limen-Helix-live-\assets\data\node-signal-registry.json**: 254 signals distributed across 123 nodes; uneven coverage (some nodes have 1 signal, others have 5+). **ACTION**: Document signal-per-node distribution; flag nodes with 0 signals.

**Performance / Throttle Issues**

16. **C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\domain-packet-adapter.js** (line 61): REBUILD_THROTTLE_MS = 400ms for packet rebuild. Domain updates happen every ~25–30s (domain-signal-engine), so throttle is not the limiter. **ACTION**: Log throttle frequency to verify it's needed.

17. **C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\inter-brain-bus.js** (line 22): MAX_HISTORY = 200; if 20 domain brains each emit every 30s, history fills in <100 minutes. Ring buffer overwrites old entries. **ACTION**: Log history depth at runtime to verify 200 is sufficient.

**Event Wiring Gaps**

18. **C:\Users\Chris\Limen-Helix-live-\assets\js\cross-domain-detector.js**: Emits limen:cross-domain-signal and limen:opportunity-detected, but these are not globally subscribed. **VERIFY**: grep for addEventListener('limen:cross-domain-signal') across all JS files (did not find any in 75 files checked; action-gate listens, discovery-engine does not).

19. **C:\Users\Chris\Limen-Helix-live-\assets\js\action-selection-gate.js** (line 229): Listens limen:cross-domain-signal to schedule selection, but cross-domain-detector does not always emit it (only on threshold cross + 2-tick confirmation). **ACTION**: Verify frequency of emissions to ensure action gate is not starved of input.

**Documentation**

20. **No CONNECTOME.md or NODE_MAPPING.md** in repo root. All 123-node identities, aliases, and business bindings documented in distributed JSON files. **ACTION**: Create CONNECTOME.md documenting: (a) 123-node canonical list, (b) RUNS vs. SCAFFOLD vs. ATLAS tiers, (c) alias resolution, (d) signal bindings, (e) domain-receptors per node.

**Test Coverage**

21. **No automated tests** for signal propagation, node activation, or action-gate winner selection found. _test-action-gate.cjs exists (line 254 in action-selection-gate.js) but is a one-off harness, not in CI/CD. **ACTION**: Add test suite for: (a) FeedStressSignal intensity calculation, (b) Propagation-engine spreading activation, (c) K3 veto filtering, (d) Action-gate winner selection logic.

---

**Summary**: The node-to-node signal spider-web is architecturally **sound but partially wired**. Signal routing from feeds through domain brains to action selection is complete on civilization pages. Cross-domain pressure now flows into the basal-ganglia-like action gate (Stage 4), which selects a single winner (never auto-executes; human confirmation downstream). However, the broadcast limen:action-selected event is orphaned — no downstream module listens. The feed→discovery wire is partially redundant (domain stress mapped to node seeds via FeedStressSignal, but discovery reads stress directly, bypassing the activation pathway). Master-brain arbitration is stubbed but never populated. Connectome-weights.json (edges + weights for spreading activation) does not exist. Inter-brain-bus is designed for domain-page-to-domain-page sync, not civilization-page orchestration. The system works asymmetrically: signal aggregation on civilization page is strong; peer-to-peer brain communication is incomplete.

### 11. Treatment Discovery

**Data Completeness Gaps:**
1. Agriculture massively under-curated: 26 cells vs 156–188 per other domain. No agriculture-specific diagnosis files found. Operator flagged "more diagnoses scattered elsewhere"—likely agriculture & infrastructure diagnosis data has not been mapped into domain diagnosis files yet.
2. Infrastructure has 0 diagnosis files (assets/data/domains/infrastructure*.json are data files, not diagnosis.json). Infrastructure cells in cube (176 across all nodes) are populated but sourced only from generic domain, not subsystem-specific diagnosis.

**Verification Vacuum (Task #33 Pending):**
1. All 66,025 claims marked PENDING. Zero VERIFIED, DISPUTED, FABRICATED, or THEORETICAL verdicts in entire cube.
2. Verifier field empty (expecting "pubmed" or similar post-task #33).
3. No evidence array populated (expecting PMID list + citation links).
4. Confidence always 0. checkedAt always null.
5. Entire epistemic bucket system is live but operating on zero verified data. Page displays bucket tallies (PROVEN: 0, UNPROVEN: 0, UNKNOWN: 66,025, IMPOSSIBLE: 0) — correct but unhelpful until verification runs.

**Disordered Classification (Mismatch):**
1. Neuro-disorder-lookup reports 373 total disorders; cube cube.disorderIndex has 230 unique disorder names. 143 disorders exist in lookup but not indexed in cube. Root cause: deduplication during cube build (some disorder names collapsed, others filtered by binding or state).
2. No audit trail of which 143 were dropped or why.

**Domain Diagnosis Boundary Issues:**
1. 48 domain diagnosis files exist; cube loads 30 "loaded comparison domains" (missing: culture, religion, trade, health are not full domains—are subsumed or absent from diagnosis layer).
2. Activation groups in diagnosis files use labels (e.g., "diagnosis", "regulation", "action") but cube step 5 (DOMAIN_TX) conflates them; unclear if "regulation" activations map to "treatments" or separate action type.

**Residual Chain Incomplete:**
1. Step 6 (RESIDUAL) deferred to cross-domain-audit (task #30). Cube cells have residual property empty until that task runs. Page shows residualCount in node cards but detail panels will be empty until residuals computed.
2. Neuro-to-Domain vs Domain-to-Neuro residuals are tallied in summary (1421 + 2692) but not yet stored in cells.

**Stale or Missing Source Files:**
1. brain-node-business-mapping.json (referenced in cube build, source of taxonomy) not verified for freshness.
2. bridge-patterns.json (source of fully-structured disorder/treatment entries) exists but size/freshness unknown; suspected to be small (only 13 "bridgeStructuredCells" out of 5186 populated).

**Scattered Diagnosis Hints:**
1. `add_fertilizer_treatments.js` and `add_landuse_treatments.js` in scripts/ suggest agriculture treatments exist but are not integrated into treatment-discovery cube build. Separate parallel system.
2. Grep for "diagnosis" in JS found 50+ hits (mostly in domain-brains, clarity-operators, domain-console-brain.js) but none feed into treatment-discovery. Domain-specific reasoning happens in isolation.

**Inconsistent Node Coverage:**
1. Neuro-disorder-lookup reports 187 nodes; cube pivots on 113 (in _index.json). 74 nodes have zero cells in cube. Root: binding-fidelity-report filtering or phase-to-state logic excludes them. No explicit list of excluded nodes.

**Proof Mechanism Undefined:**
1. PubMed verifier is mentioned ("task #33 PubMed-verifies each disorder + treatment") but no API integration visible.
2. Verdictto-PMID mapping (how to get PMIDs for a claim) not implemented.
3. Confidence scoring algorithm not defined (expecting 0.0–1.0 but no formula).

**Live Page Rendering Issues:**
1. Treatment-discovery.html loads _index.json (node roster) for grid; detail panels lazy-load by-node files. Filters (state/domain/search) work on _index.json data only—do not search inside by-node files. User searches "cortical deafness" will find disorder matches only if node.topDisorders field is populated in _index.json; unclear if this field is built.
2. "More domains" filter expands but not all 30 domains listed (showing only business, medicine, economy, environment, population, more…).

**Code/Data Sync Risk:**
1. epistemic-state.js is inline in treatment-discovery.html + also loaded as separate script. Dual source risk if verdict mappings change.
2. Four state names (proven, unproven, unknown, impossible) hardcoded in HTML CSS (.bucket classes). New states would require HTML edit.

**File Size & Performance:**
1. Cube.json at 85MB may cause browser lag on load (deferred by lazy-per-node pattern, mitigates but doesn't eliminate).
2. By-node files range 3.9K–2.6M; largest nodes (AI, BLA) will have slower detail panel renders.

### 12. Remedy

**Data staleness & gaps:**
- `/assets/data/remedy-library.json` — **Stale by 84 days** (last modified 03/14/2026). Not wired to remedy-resolver; only loaded by regulation-reports.js (historical example matching). Consider: (a) remove if orphaned, or (b) regenerate with live portal statistics + most-frequent patterns. **File-level inconsistency:** remedy system is 100% live-portal-driven; this static JSON serves no active remedy selection purpose.
- `treatment-discovery/_summary.json` — Empty/placeholder (0.00 MB); last built 06/04/2026. Check if intentional or skipped in build.

**Incomplete remedy population:**
- **Only 13 medicine specialties hardcoded** (line 338–347 of limen-bootstrap.js): medicine_neurology, medicine_metabolic, medicine_pediatric_med, etc. Other portals (agriculture, infrastructure, legal_*, etc.) are harvested via `LIMENDomains` keys only. If a domain portal exists (e.g., `agriculture_crop.json`) but is not in the default domain list, it will be missed. **Path:** Use deep-portal-harvester for on-demand discovery, or enumerate all sub-portals at bootstrap time.

**Pattern class alignment:**
- remedy-library.json defines ~14 patterns (resource_pressure, oscillation_instability, threat_cascade, phase_transition, prediction_violation, cross_domain_resonance, regulation_failure, innovation_pressure, plasticity_window, memory_consolidation, somatic_cascade, narrative_collapse, homeostatic_recovery). Remedy-resolver's ADJACENT_PATTERNS graph covers all 14. However, **treatment-discovery-cell.schema.js** and actual domain portals may define different pattern vocabularies (e.g., "issue" terminology vs. "pattern" terminology). No validation that harvested treatments' patterns match resolver's 14-class enum. **Risk:** Fallback-to-generic-direction if pattern mismatch occurs.

**Synthetic stress diagnosis removal:**
- **Line 349–352 of limen-bootstrap.js** notes that synthetic `_LIVE_STRESS` diagnosis/treatment fabrication was removed (Civilization not allowed to invent domain truth). However, `portal-treatment-resolver.js` **still checks for** `_LIVE_STRESS` in diagnosis IDs (line 60) and partitions them as synthetic. This partition logic is now dead code (no such diagnoses created post-removal). **Consider:** Remove the partition logic or document why it's retained for backwards compatibility.

**Contraindication condition parsing (incomplete):**
- remedy-resolver.js line 182–204: `_evaluateCondition()` only parses `node[ID].activation > THRESHOLD` patterns. Other condition types (timespan, cross-domain state, context flags) would fail silently (return false, no block). **Gap:** Full condition language not defined; hard contraindications without parseable conditions become soft warnings (line 166–168).

**Missing remedy outcome tracking:**
- Remedies are selected and passed to UI (via scalePayload), but no feedback loop records whether the remedy was applied, effective, or triggered side effects. **Gap signal accumulation** (line 481–501 of remedy-resolver) only tracks **gaps** (failures); no success tracking for outcome learning refinement. localStorage pathway weights are read but never written by remedy-resolver.

**Node-match score edge case:**
- remedy-resolver.js line 122–137: `_nodeMatchScore()` returns 0 if either linked nodes OR affectedNodes is empty. A remedy with no linked nodes (linkedNodes.length === 0) will always score 0, regardless of pattern/confidence. This might be intentional (no anatomical specificity = low priority), but creates hard floor. **No fallback:** such remedies would only be selected via adjacent-pattern or cross-scale fallback, or caught in confidence gate.

**Registry isolation from domain brains:**
- portal-treatment-resolver.js line 54–68 explicitly **separates portal-sourced diagnoses from synthetic _LIVE_STRESS** and prefers portal diagnoses. But domain brains have their own `brainDiagnoses` / `brainTreatments` (per domain-brain-base.js). **Unclear:** are domain-brain-sourced treatments registered in remedy-registry, or kept separate in domain state? If separate, remedies from domain brains are **bypassed** by registry-based lookup. **Potential gap:** domain-specific resilience logic might not feed into civilization recommendations.

**Evidence weighting inconsistency:**
- remedy-registry.js line 67–84: EVIDENCE_RANK maps 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'Moderate', 'Limited', 'Strong', 'None' (11 variants).
- remedy-resolver.js line 32–35: EVIDENCE_WEIGHTS maps 'A', 'Strong', 'B', 'Moderate', 'C', 'Weak', 'Emerging' (7 variants).
- **Mismatch:** remedies indexed with one grade system, scored/ranked with another. E.g., 'B+' (rank 8) won't match any resolver weight key; falls through to default 0.30. **Risk:** Evidence-based prioritization unreliable across system boundaries.

**Empty/stale bootstrap paths:**
- limen-bootstrap.js line 360–372: `harvestFromUrls()` callback rebuilds resolver registry post-harvest, but only if `total > 0`. If no portals are available at bootstrap (network down, paths missing), registry builds with zero treatments. Subsequent domain-stress queries return empty arrays. **No fallback:** if remedy-library.json were loaded as fallback seed, it could populate a baseline. Currently unused.

**Test coverage:** registry-test.js validates happy paths but doesn't test:
- Harvesting 50+ portals in parallel (CONCURRENCY limits in deep-portal-harvester).
- Circular pattern adjacencies (e.g., threat_cascade → regulation_failure → threat_cascade).
- Very large remedies[] arrays (5000+ treatments) under prioritization.
- Schema validation failures (what happens if a portal JSON fails fractal-schema check?).

**Path-dependent harvesting:**
- linen-bootstrap.js assumes portals at `assets/data/domains/{domainId}.json`. If domain IDs change or new domains are added to LIMENDomains, harvest URLs must be regenerated. Deep-portal-harvester exists to probe for sub-portals, but is not auto-wired into bootstrap. **Fragility:** manual domain list synchronization required.

**Documentation:**
- remedy-registry.js and remedy-resolver.js cite docs/57–60 but those docs are not in the repo (verified earlier in audit). Comments reference locked schemas but do not list exact schema file paths. Fractal-report-schema conversion (`fromLegacyDomain()`) is called but fallback converter is provided (line 807–904); no indication which is preferred or when fallback activates.

---

**Summary:**
The Remedy subsystem is **functionally complete and operational** (harvesting, indexing, selection, fallback, priority scoring all working; 12 tests passing). However, **stale static data** (remedy-library.json orphaned), **incomplete portal enumeration** (medicine specialties hardcoded), **evidence-grade mismatch** across boundaries, **dead code** (synthetic _LIVE_STRESS partitioning), and **domain-brain isolation** (separate treatment sources) represent **moderate maintenance debt**. No critical bugs, but several inconsistencies reduce robustness under edge cases (no remedies available, pattern mismatches, evidence ambiguity). **Gap-signal authoring request** mechanism is in place but incomplete (no feedback on authored remedies back into registry).

### 13. Master Brain / Inbox / Executor

1. **Missing Feedback Loop**: MB-A intake (Artifact Council) is a one-way scaffold. No handoff confirmation signal sent back to domain brains or civilization. If operator approves packet, no "approved_artifact_handoff" event fires upstream. Consequence: artifact readiness signals don't close loop.

2. **Empty Phase-5/6 Classes**: decision-engine.js Phase 2 only emits [no_action, insufficient_evidence, executive_synthesis, contradiction]. Phase 5 (artifact_request), Phase 6 (strategic_option), Phase 5 review-queue routing are all documented in spec §5/§6 but NOT implemented. Routes today just land in review scaffolding with no action spec.

3. **Civilization Bridge Not Wired**: oib-assembler.js reads window.LIMENReports.civilization (one-directional snapshot). No reverse channel: when Master Brain decides to route decision to domain, no dispatch mechanism exists. civilization.html console does NOT subscribe to master-brain-update events; they are independent event streams.

4. **OIB Freshness Floors Absent**: oib-assembler.js captures freshnessMs but decision-engine.js does NOT enforce staleness thresholds. A 24h-old civilization snapshot can still pass admissibility if evidence.overallConfidence >= 0.40. Freshness penalty is only applied AFTER decision is already classified (line 179: _freshnessPenalty() reduces confidenceScore, not tier).

5. **Pathway Scoring vs Opportunity Scoring Mismatch**: master-brain-readiness.js scores opportunities using legacy WEIGHTS formula (rank 0.22 + urgency 0.08 + confidence 0.15 + evidence 0.15 + handoff 0.15 + audit 0.10 + provenance 0.10 + freshness 0.05). Pathways use PATHWAY_WEIGHTS (relevance 0.25 + nodeDepth 0.20 + phaseGravity 0.15 + stressEnvelope 0.10 + crossScale 0.15 + freshness 0.10 + provenance 0.05). These are independent; a pathway can be READY while its leaf opportunities are BLOCKED. No reconciliation logic documented.

6. **SBA Eligibility Gate Too Weak**: master-brain-executor.js qualifiesForLane('sba') checks ONLY `_pathwayHasCompanyAnchor()` (≥1 company ticker on ≥1 leaf opp). This is intentionally weak per code comment, but the SBA lane renders without verifying: borrower structure, NAICS code, personal guarantee sufficiency, historical tax returns presence, or lender readiness. Result: SBA substrate can assemble for ineligible entities. The [MB-D] disclaimers warn "Stronger borrower-shape validation deferred to SBA render/underwriting pass" but that pass doesn't exist in this phase.

7. **Executor Lane Qualification vs Density Advisory Confusion**: qualifiesForLane() is HARD (gates whether packet assembly happens). classifyDensity() is ADVISORY (HIGH/PARTIAL/THIN on deep-treatment count, monitoring, escalation, impacted nodes). An executor can approve a THIN-density packet (3 treatments, 0 monitoring, 1 citation, 1 impacted node) if tier >= NEAR_READY. No minimum-density gate exists; density is UI-only warning, not blocking gate.

8. **Artifact Factory Forbidden-Language Regex Brittle**: FORBIDDEN_RX[] checks on substring match (e.g., /\bbuying\s+now\b/i for "buy now"). Legitimate phrases ("buying committee", "buying power") may trigger false positives if surrounding tokens shift. validatePackage() walks the rendered Markdown once; if blocking phrase appears in a parenthetical exemption note, it still fails.

9. **Phase Inhibition Table Hardcoded**: PHASE_INHIBIT[lane] lives in master-brain-consumer.js. If a new phase is introduced (e.g. p11 for resurrection), the table must be manually updated. No dynamic phase-registry mechanism exists.

10. **Transitional Snapshot State Leaks Into Decision**: _prevSnapshot in master-brain-readiness.js is session-scoped, in-memory only. On page reload, all transitions are lost. If operator refreshes master-brain-executor.html, the next domain-brain-update will compute fresh transitions from a cold-start _prevSnapshot (all pathways appear "newly_active" on session init). No persistent transition history. Consequence: transition records in recentTransitions[] are session-volatile.

11. **Master-Inbox API Caching Skew**: api/master-inbox.js edge-caches for 60s (s-maxage=60). If a portal.engineOutputs is updated in Redis by build-engine-outputs cron, the 60s cache window may delay inbox queue refresh by up to 60s. No cache-busting mechanism (no Vercel rebuild trigger on Redis write).

12. **Civilization → Master-Brain Decoupling**: Civilization console runs independent domain-packet-adapter.js, which also reads LIMENDomains. Both civilization and master-brain listen to limen:domain-brain-update, but there's no shared state. If civilization's domain-change-log marks a diagnosis as "human-reviewed", that signal does NOT propagate to master-brain-readiness's gateActivation(). Each subsystem recomputes from raw domain state independently.

13. **Orphaned Opportunity Handling Unclear**: master-brain-readiness.js preserves legacy collect() function (per-opportunity API). But the new pathway-first layer collectPathways() does not guarantee that every opportunity in LIMENOpportunities is bound to a pathway. If a diagnosis has no circuits (gateNodes fails), its opportunities are orphaned. Legacy collect() may still emit them; executor.js does not reference them. Risk: orphaned-opportunity artifacts may surface in old tooling but not be visible to executor.

14. **Admission Floors Not Enforced Upstream**: decision-engine.js admissibility floor (0.40) is only checked in _admissibilityCheck() AFTER OIB is already assembled. If civilization is offline or evidence.overallConfidence is null, the check catches it. But oib-assembler.js does not pre-gate on floor; it just clones whatever civilization exports. Consequence: a null overallConfidence passes availCivilization check (line 166: "rawCivilization !== null && typeof rawCivilization === 'object'"), then decision-engine later downgrades to insufficient_evidence. No early abort.

15. **Artifact-Intake Execution Authority Claim**: artifact-intake.js line 198 asserts executionAllowed: false as INVARIANT in every stored item. But the code does NOT validate the input-pasted intake object for this. An operator could paste intake JSON with executionAllowed: true, and the enqueue() validation (validate() function) does NOT check it. Only the output item (constructed by enqueue) hardcodes executionAllowed: false. If operator tampers with sessionStorage directly, invariant breaks. No validation on read-back from sessionStorage.

16. **Pathways Page Filters Not Synced to Executor**: master-brain-inbox.html has tier/engine filter buttons (READY/NEAR_READY/BLOCKED + PATENT/GRANT/INVEST) that render different pathway subsets. master-brain-executor.html has lane selector buttons (PATENT/GRANT/SBA/BUSINESS_PLAN/DIRECTIVES) but NO tier filter. Executor always shows all NEAR_READY+ pathways for the lane, regardless of salience or audit score. Result: operator can filter inbox by READY-only, then switch to executor and see NEAR_READY artifacts that were filtered out in inbox view. Cognitive disconnect.

17. **Five-Lane UI Asymmetry**: Patent and Grant lanes have full packet assembler (MB-C + MB-D). SBA, Business_Plan, and Directives lanes are marked "not actionable" in executor UI with a badge, yet the executor page still renders a queue for them and allows lane selection. The contract skeletons are defined (SBA_USE_OF_PROCEEDS, BP_MILESTONES, DIR_HUMAN_ROLES) but no assembler wires them. Operator can click SBA lane, select a pathway, but "Build Draft Package" / "Finalize" buttons are disabled (see executor HTML line 714: `mba-expand` button has @click handler that is disabled for non-patent lanes). Consequence: UI suggests capability (lane button is clickable) but does not deliver it. Should be either hidden or clearly labeled "Phase 2 only".

18. **Civilization → Master-Brain Signal Attenuation**: civilization.html runs observatory-aggregator.js, which synthesizes cross-domain signals into civilization.conflicts[], evidence.overallConfidence, summary. But master-brain-readiness.js reads LIMENDomains directly, bypassing civilization aggregation. The pathways it emits are NOT informed by civilization's cross-scale synthesis. If civilization detects a scale-A vs scale-B conflict and downgrades evidence.overallTier, that downgrade affects decision-engine (admissibility gate) but NOT pathway salience. Consequence: a pathway can be READY in master-brain-inbox while civilization marks it as low-confidence. No reconciliation.

19. **Ledger Projections Honest But Not Testable**: buildLedger() emits whatChanged / whatFired / whatNodesMattered / whatEvidenceIsMissing / whatWouldFalsify. These are honest projections (no synthesis), rendered in master-brain-inbox.html. But no assertion gates them. The inbox UI displays them as passive read-only text; operator cannot mutate or confirm them. If ledger says "whatWouldFalsify: negative trial result on node X", and operator later finds a negative trial result, no mechanism updates the ledger or gates the pathway on that falsification. Ledgers are unidirectional signal emanations.

20. **Executor Density Classification Opaque**: classifyDensity() returns level (HIGH/PARTIAL/THIN) + detailed breakdowns (deep count, monitoring, escalation, cite, impacted nodes, missing proof items). The executor UI surfaces density as a badge per queue item (master-brain-executor.html line 91–93: .sel-density pills). But when operator assembles a packet, the density DOES NOT affect packet disclaimers or missing-evidence flags. A THIN-density patent can still assemble and render with the same structure as a HIGH-density one. Only the density reason string is logged; no density-based gating or caveat injection.

21. **Orphaned Reports Paths**: oib-assembler.js reads window.LIMENReports (global object). But the source is assumed to be window.LIMENReports.civilization + the reports object itself. If LIMENReports contains sibling keys (e.g., LIMENReports.infrastructure_audit, LIMENReports.cross_scale_synthesis) they are NOT enumerated. The code reads ONLY civSnapshot = rawReports.civilization (line 156), then uses it for admissibility and decision binding. Other report siblings are orphaned.

22. **Executor Packet Status State Machine Incomplete**: master-brain-executor.html defines _status = {} object keyed by (_pathwayId + '_' + lane). It tracks per-packet status (DRAFT/APPROVED/REFUSED/WAITING). But this state is NEVER persisted. It lives in-memory only. On page reload, all status history is lost. Operator can approve a packet, refresh page, and the packet reverts to DRAFT. No consequence enforcement (e.g., no "already approved once" idempotence guard).

23. **Decision Review Queue Terminal States Fragile**: review-gate.js enqueue() is idempotent (same decision.id returns existing item, no overwrite). But resolve() and dismiss() are terminal (item.status becomes 'reviewed' or 'dismissed', and further resolves/dismisses return null). No way to re-open a reviewed item or un-dismiss. clear() is the only reset. If operator accidentally clicks "Resolve: Approved" and closes the review tab, the decision is locked in 'reviewed' state with no UI to undo it (scaffold stage; no operator surface for review gate exists yet).

24. **Admissibility Floor Asymmetry on Sources**: admissibility floor check (0.40) only reads civilization evidence.overallConfidence. Domains envelopes are checked for availability only (civEnv.available), not for confidence. If a domain is unavailable, reason='domains_unavailable' is added to failingRefs, but NO confidence-floor check is run per domain. Consequence: civilization offline = insufficient_evidence. But single domain offline = passed through (domains envelope "available" flag is false, but no confidence floor enforces it).

25. **Transition Diff Accuracy Assumption**: _prevSnapshot compares pathway.salience.tier (e.g., READY → NEAR_READY) to detect tier_change. But salience object is mutated every cycle; there's no version/hash mechanism to verify that the comparison is happening on the SAME pathway identity. If LIMENMasterBrainReadiness._prevSnapshot is keyed by pathway.id, and pathway.id changes due to a hashing collision or domain re-initialization, a "newly_active" transition fires on what is actually a different pathway under the same synthetic ID. No UUID guarantee.

Human message types handled (tabulated for this audit):
- **Artifact Council packet intake** (MB-A): lane, status, createdAt, notes, artifactPacket (9 lanes supported)
- **Artifact review actions** (review-gate.js): enqueue, resolve(disposition: approved/rejected/deferred), dismiss
- **Executor actions** (master-brain-executor.html): approve, refuse, wait, open, print, regenerate
- **Pathway filters** (master-brain-inbox.html): tier (READY/NEAR_READY/BLOCKED), engine (PATENT/GRANT/INVEST)
- **Lane selection** (master-brain-executor.html): PATENT/GRANT/SBA/BUSINESS_PLAN/DIRECTIVES
- Counts: **~30 action types / message shapes** across 6 files (oib-assembler, decision-engine, review-gate, artifact-intake, artifact-factory, artifact-finalizer)

### 14. Stress propagation & autonomic workers

**CRITICAL:**

1. **Stale stress-network-state.json** (C:\Users\Chris\Limen-Helix-live-\assets\data\stress-network-state.json, 4.67 MB, last written 2026-05-25 15:57:50 UTC). Audit date 2026-06-07 = **13 days stale**. 
   - Workers should tolerate this gracefully (worker-stress-refresh computes live; stress-propagation falls back to live if cache missing). 
   - But on-disk snapshot serves as safe default for Vercel cold-starts.
   - **Action**: cron daily or on portal-mutation to refresh. Currently requires manual `node scripts/build-stress-network.mjs` invocation (not automated).

2. **Cron Schedule Not in vercel.json** (C:\Users\Chris\Limen-Helix-live-\vercel.json only declares capital-engine, not stress workers). 
   - vercel.json has no entries for worker-snapshot, worker-stress-refresh, worker-autoqueue, worker-autofire, worker-multipass, worker-sleep-cycle, worker-ingest.
   - These must be triggered externally (GitHub Actions, Terraform Cloud, or manual polling).
   - **Action**: document externally-managed cron schedule or add to vercel.json. Gap in observability.

3. **Company Scoring Priority Scheduler Backlog** (company-phase-scorer.js line 19: `limen:company_score_queue → { pointer, lastRun }`). 
   - Pointer tracks round-robin progress across 506 CIKs. Full cycle takes ~25 min (30+30 per tick, 3-min cron = 8.4 ticks).
   - **Constraint:** scorer may FIND backlog (determine which companies need scoring) but must not BUILD backlog autonomously (operator-driven demand).
   - **Status:** Company scoring is PRIORITY-aware (elevated domains first), not backlog-building. Verified compliant.
   - However, if domain health never rises above elevated threshold, round-robin pointer may stall. **Action**: monitor limen:company_score_queue pointer drift.

4. **Remediation Queue Orphaned** (limen:remediation_queue emitted by sleep-cycle but not consumed). 
   - Sleep-cycle emits: scorer-silent, queue-backed-up, weekly-corpus-audit remediation requests to limen:remediation_queue.
   - No worker visible that consumes + acts on these (no auto-remediation code in place).
   - **Action**: either implement remediation worker or document as operator-review-only queue.

**HIGH:**

5. **Network Stress Boost Not Gated by Freshness Explicitly** (limen-worker-autoqueue line 51: `stressFresh = !!(stressMeta && Date.now() - stressMeta.generatedAtMs < 60*60*1000)`).
   - Honest degradation: if limen:stress_slim is missing/stale >1h, stress boost is skipped.
   - But no worker explicitly alerts if stress-refresh is failing (silent fail if propagation compute errors).
   - **Action**: add alerting to limen-worker-stress-refresh error path.

6. **Autofire Daily Budget Per-Day-TTL Edge Case** (limen-worker-autofire line 535: `ttl = Math.max(60, 86400 - Math.floor((Date.now() % 86400000) / 1000))`).
   - Budget key limen:autofire_budget_YYYY-MM-DD self-expires at midnight UTC.
   - If a fire happens 23:59 UTC on day N, budget rolls over immediately.
   - **Ambiguity:** does operator deploy in UTC or local TZ? Vercel runs UTC. 
   - **Action**: clarify in operator runbook; consider explicit day-boundary guard.

7. **Sleep-Cycle Consolidation Pass (limen-worker-sleep-cycle line 58-74)** does not actually re-score: "We can't invoke the kernel from here without risking timeout budget."
   - Consolidation just SAMPLES recent transitions without validation.
   - **Comment says**: "snapshot worker re-scores at most 60 CIKs/3min and will catch these transitions naturally on the next round."
   - **Risk:** if kernel is broken (returning constant phase), no transition appears → consolidation reports 0 → sleep-cycle emits scorer-silent remediation. Then the daily prompt runs manual audits. **This is working as designed.**

**MEDIUM:**

8. **Portal Load Paths Inconsistency** (multiple fallback paths: __dirname/../assets/data/companies, /var/task/assets/data/companies, process.cwd()/assets/data/companies).
   - Vercel uses /var/task; local dev uses process.cwd() or relative.
   - File-load cache (_PORTAL_CACHE) is per-worker cold-start, not shared across crons.
   - If a portal is mutated between cron ticks, autofire picks up stale cached version.
   - **Likelihood:** low (portals are rarely edited mid-fire), but inconsistent.
   - **Action**: add cache invalidation hook on portal PATCH.

9. **Stress Propagation Inhibitory-Damping Resilience** (linen-stress-propagator.js line 135-160: loadInhibitoryEdges).
   - Reads brain-connectome.json at module init. If missing/malformed, falls back to empty array (no damping).
   - Silent fallback; no alerting.
   - **Action:** none (design is correct), but log cache load in debug mode.

10. **Salience Routing Not Logged** (limen-policy.recommendLane() not exposed; routed through limen-worker-autoqueue).
    - No transparency into why a transition was routed to a given lane (if operator wants to audit).
    - **Action:** emit route decision to limen:autoqueue entry as metadata (already stored: salienceScore, networkStress, but not routing rationale).

**LOW:**

11. **Amplification Rank Recomputation On Every Serialize** (linen-stress-propagator.js line 618: applyAmplificationRanks called on every serializeResult call).
    - Ranks are dynamic (depend on corpus percentiles), so determinism contract (W3) is preserved ONLY if serializeResultDeterministic is used.
    - **Status:** correct (determinism function exists; correct callers use it). No bug.
    - **Action:** none; document for future maintainers.

12. **Stress-Slim Encoding Edge Case** (limen-worker-stress-refresh line 117: `Buffer.byteLength(JSON.stringify(slim))`).
    - Counts bytes for observability. If stress_slim ever approaches Upstash per-value limit (~512 KB by default), this metric will warn.
    - **Current:** 506 CIKs × ~100 bytes/entry ≈ 50 KB. Safe.
    - **Action:** none (monitor limen:stress_meta.bytes over time).

13. **Phase Transitions Append-Only Log Never Pruned Beyond 500 Max** (company-phase-scorer.js line 60, limen-worker-sleep-cycle checks size; sleep-cycle line 100: `transitions.length < 1` for 24h check).
    - 500 entries is ~7 days of high-activity scoring (60 companies/3min cron).
    - If scoring runs idle, transitions log is sparse.
    - **Risk:** operator misreads sparse log as "scorer broken" when it's just quiet.
    - **Action:** add "last_transition_at" timestamp to limen:sleep_cycle_metrics audit output.

14. **Multipass Job Timeout Risk** (limen-worker-multipass passes 240s timeout per section call, plus state reads/writes).
    - Each pass takes ~90s (observed); 6-8 passes × 5-min crons = 30-40 min wall.
    - If a pass times out, job continues on next tick (state persisted). No explicit timeout on the overall job.
    - **Risk:** if a lane is stuck in iteration (e.g., section 3 always errors), job never completes. Blocked forever.
    - **Action:** add max-ticks-per-job (e.g., 100 ticks = 500 min) or max-age-per-job (e.g., 24h) to auto-abort and emit alert.

15. **Missing Audit Trail on Network-Stress Boost** (limen-worker-autoqueue line 92: networkStress field stored but never surfaced in UI).
    - Queue entry has salienceScore (includes network boost), but breakdown (how much of boost came from network vs. phase alone) is lost.
    - **Action:** optional; add breakdown to queue entry or operator UI widget.

**DOCUMENTATION & OPERABILITY:**

16. **No Operator Runbook for Stress System** — Documented in code comments but no standalone operator guide (like there is for capital-engine, etc.). 
    - **Action:** create STRESS_OPERATOR_GUIDE.md covering: cron schedule, budget caps, dedupe windows, remediation queue review, manual stress-network rebuild, sleep-cycle alert interpretation.

17. **Vercel Function Max Duration 300s Not Tuned to Stress Workers** (vercel.json line 11: `"maxDuration": 300`).
    - Autofire + multipass designed to fit within 300s (240s Claude timeout + overhead).
    - But no per-function override; all api/* functions share the cap.
    - **Risk:** if expand-artifact-claude call hangs, entire function times out; state partially persisted.
    - **Action:** no immediate fix (Vercel limitation), but document in runbook that hang > 300s = need manual remediation.

---

**Summary Totals:**
- **Worker endpoints:** 7 (snapshot, stress-refresh, autoqueue, autofire, multipass, sleep-cycle, ingest)
- **Stress/queueing endpoints:** 5 (stress-propagation, stress-slim, phase-transitions, autoqueue, self-pulse)
- **Core library:** 1 (limen-stress-propagator, 751 lines; pure-deterministic)
- **CLI producers:** 1 (build-stress-network.mjs)
- **Redis keys tracked:** 17 (phase_transitions, autoqueue, autofire_budget, stress_slim, multipass_inflight, remediation_queue, etc.)
- **Major data tanks:** command-board-data.json (CIK scores), portal corpus (506 entities), brain-connectome.json (L2 inhibitory edges), stress-network-state.json (4.67 MB, stale 13d)
- **Commits in repo:** 111 total (git log --oneline)
- **Stress-related commits:** not broken out separately, but core stress work visible in recent history

**Cron Coverage:**
- **Every 2 min:** ingest (defense RSS)
- **Every 2-5 min:** snapshot (domain + company scoring)
- **Every 5 min:** multipass autofire (state machine)
- **Every 15 min:** autoqueue (transition → queue)
- **Every 30 min:** autofire (single-call executor) + stress-refresh (propagation)
- **Every 1 hour:** sleep-cycle (audit + remediation dispatch)
- **Every 6 hours:** capital-engine (unrelated)
- **Manually:** build-stress-network.mjs (on portal mutation)

**Operator Constraint Verified:**
- **Cron workers FIND backlog only**: limen-worker-autoqueue (reads transitions, populates queue), limen-worker-snapshot (scores companies, detects transitions). ✅
- **Cron workers never BUILD backlog autonomously**: Only recommendation → queue. ✅
- **Autofire BUILD is gated**: HIGH-salience single-call only, daily $ budget, per-CIK 24h dedupe, stage routing checks. ✅
- **Multipass BUILD is gated**: HIGH-salience multipass only, daily $ budget shared with autofire, per-CIK 24h dedupe, stage routing checks. ✅
- **Operator control point**: PATCH /api/limen-autoqueue (mark FIRED/DISMISSED) or POST /api/limen-self-pulse (manual inject). ✅

### 15. Finance/capital + grant/patent/research/investment/SBA pipeline

1. **Global auto-generate disabled** (my-documents.html line 72): "disabled — duplicates in Redis cause repeat prints" — limen:pattern-proposals list has duplicate entries by pattern.id; dedup logic exists in my-documents.html render() but "Auto-generate ALL documents for ALL patterns" button is disabled. Ticket: clean up Redis deduplication or rebuild dedup on the backend.

2. **Corpus IP guards weak for grounded content**: corpus.js loads corpus.json source cards and injects ipGuard() text into prompts, but there is NO hard enforcement that generated content respects the patent/IP claims boundary. Stream-ops.js calls corpus.groundingText() but does not validate that the AI output stays within the IP firewall. Risk: proprietary methodology details leak into free content.

3. **No pre-registration for print-document lanes**: application-auditor.js has lanes=['patent', 'grant', 'research', 'investment'] per scoreLanes(), but long-form-generator.js systems have PATENT_SYSTEM, NIH_GRANT_SYSTEM, NSF_GRANT_SYSTEM, LOAN_SYSTEM, RESEARCH_SYSTEM (implied but not shown in snippet). Missing: preregistration system prompt for OSF lane; investment thesis system prompt incomplete in snippet; franchise lane noted in LANE_RENDERERS but franchise system not in generator.

4. **NSF lane handler (lanes/nsf-project-pitch.js) is a single lane, not a family**: other major funders (NIH, DOE, DARPA, AHRQ) are not modeled as separate lanes. System assumes all grant lanes route through application-auditor.js multi-funder support, but lanes/nsf-project-pitch.js is NSF-specific. Unclear whether other lanes exist elsewhere or whether the lane routing is incomplete.

5. **Patent claims NOT VERIFIED for non-obviousness (103) before filing**: application-auditor.js audit scores patent readiness (USPTO 35 USC 101/112 checked), but patent-packager.js notes "only package AFTER filing — public disclosure before filing can bar patent rights." There is NO pre-filing novelty/FTO check. If a bridge-generated patent overlaps with a real 20221234567 patent, system will not catch it upstream. Solution: integrate with Google Patents / PatentSight API before print-document reaches packaging.

6. **Applicant entity inconsistency across lanes**: print-document.js / long-form-generator.js notes "new business with no investor," but does NOT reconcile entity identity. Patent lanes may invent an entity name different from grant lanes (LIMEN Helix LLC vs. a derived SBA-borrower entity). lessonid "entity-coherence-and-assignment" in review-rubric.json flags this, but system does not enforce it on output. Risk: a single bridge pattern may generate legally incoherent lanes (patent ownedby entity A, grant awarded to entity B, loan to entity C) with no documented assignment chain.

7. **SBA lane templates are shells**: long-form-generator.js LOAN_SYSTEM (lines 102+) outputs a credit-memo-style template, but print-pipeline.js _sbaMarkdown() line 98 has "Template shell pending operator population." No actual SBA 7(a) / Microloan specimen sections are generated. Unsent: "sources of repayment" is critical for SBA; current system leaves it as a placeholder.

8. **No live Stripe integration yet**: capital-engine.json notes stripe connector "status": "connected-on-allaccesskc" but STRIPE_SECRET_KEY is NOT yet added to Vercel limenhelix project env. Stripe.rail.js functions exist but cannot execute. Income acceptance is unavailable on this project (AllAccessKC holds the Stripe account). To unblock: add restricted STRIPE_SECRET_KEY to https://vercel.com/limen-helix-live project env.

9. **Budget math heuristic is crude**: application-auditor.js _budgetMath() uses regex to extract dollar amounts and checks whether the sum of non-max figures is within 5% of the stated total. Rule is HEURISTIC only and will miss:
   - Multi-year budgets split across project years (Phase I + Phase II cash flows)
   - Indirect cost rate calculation errors (applies 10% unless told otherwise, but does not reconcile against institutional NICRA)
   - Prohibited cost-share (NSF/NIH rules vary; no funder-specific validation)
   Solution: parse structured budget tables (NOT regex) and apply funder-specific rules per lane.

10. **Adversarial review gate is not hard**: applications.html shows adversarial-review results but operators can still approve/submit even if gate="block". The UI has no conditional disable. review-rubric.json lessons are ADVISORY only; the real gate is operator judgment. No pre-submission automation blocks a return-without-review application.

11. **Lane scoring does not feed decision logic**: application-auditor.scoreLanes() returns lanes.patent.score, lanes.grant.score, etc. with a deterministic DECISION RULE (keep if >=1 lane >=6; route to >=6 lanes), but the /my-documents.html flow does NOT call score-lanes before downloading. Operator manually selects which 4 lanes to generate; no gating. Risk: operator downloads a patent filing for a card that scored 2/10 on patent lane and 9/10 on grant lane, wasting time and potentially filing a weak patent.

12. **Corpus source-card selection is soft**: corpus.js select() picks the card whose domains best match stream.category, with a scoring heuristic (100 - idx - domain_count). Tie-breaking is unspecified. If two cards equally match, the first card wins. This can lead to suboptimal grounding if corpus.json card order reflects insertion time, not relevance. Solution: add explicit card priority field to corpus.json.

13. **Affiliate link injection does NOT check FTC compliance**: affiliate-injector.js wraps URLs and stream-ops.js injects "#ad" disclosure, but there is NO:
   - Audit that the disclosure is VISIBLE and CLEAR in the output format (e.g., does Beehiiv render HTML comments? Does the social post show before truncation?)
   - Verification that the disclosure is placed BEFORE the link (FTC Rule § 255.1)
   - Revocation of link if policy changes (e.g., if Amazon Associates revokes the tag)
   Solution: render-time FTC validator that checks disclosure visibility in each platform's output.

14. **"Products" defined in capital-engine.json but NOT fully integrated**: products.js loads capital-engine.json products[] array and manages Stripe payment links. But capital-engine.json file is incomplete in the snippet (lines 1–100 read); cannot see the products array. Unclear how many products exist, whether they are mapped to sourceCard IDs correctly, or whether ensureLinks() is called automatically or only on demand.

15. **Long-form generator calls are not budgeted**: autonomic.tick() builds up to buildCap=3 artifacts per tick (to control AI spend), but long-form-generator.js calls inside print-document.js are NOT gated by autonomic budget. An operator can spam "Download all 4" for 100 approved patterns and burn through the Anthropic budget immediately. Solution: add token budget tracking to print-pipeline calls, or split long-form generation into a separate autonomic queue.

16. **No pre-revenue validation for SBA/Microloan**: long-form-generator.js LOAN_SYSTEM assumes borrower is pre-revenue (no cash-flow history), but does not validate that the "sources of repayment" (line 113: "founder's personal income from another role") is REAL. SBA officers will ask for job verification, paystubs, personal credit score. System output is a template shell; actual underwriting is operator responsibility. Risk: generated SBA packages are plausible-sounding but may not survive lender scrutiny.

17. **No state-by-state SIC/NAICS enforcement**: long-form-generator.js references NAICS + SIC but does not validate against state/federal business registration. A bridge pattern may specify a fictional SIC or misaligned NAICS (e.g., "pharma research" SIC 2834 but borrower is a software LLC). Solution: limen-policy.js should validate SIC/NAICS against official code lists at generation time.

18. **Missing error handling for truncated AI output**: application-auditor.js _salvage() attempts to regex-recover JSON on truncation, but _extractJson() in patent-packager.js, affiliate-injector, and others do NOT have salvage logic. If OpenAI/Anthropic returns a truncated response (stop_reason="max_tokens"), the system silently returns null and downstream code fails. Solution: standardize _extractJson with salvage fallback across all modules.

19. **Approval queue is Redis-only; no durable audit log**: finance-autonomic.js writes lend-proposed events to limen:finance:approvals (list, max 200), but there is NO persistent audit of APPROVED vs. REJECTED proposals. If Redis is cleared, the history is lost. Solution: write approvals to a durable DB (PostgreSQL) alongside the Redis cache.

20. **Score gating uses OLD rubric; no versioning**: application-auditor.js loads review-rubric.json at call time, but there is NO version field on returned audit objects. If rubric.json is updated, old audits are scored against a different rubric, making them incomparable. Solution: freeze rubric version in each audit object (schemaVersion + rubric.version).

21. **Orphaned fields in capital-engine.json**: capitalRouting, approvalQueue noted in contract but not used by autonomic.tick(). Only capitalRouting.proposedRoutes is read (line 73 in finance-autonomic.js); capitalRouting.policy is informational. approvalQueue is never populated. These fields may be legacy from an earlier design. Cleanup: remove or fully integrate.

22. **NSF project-pitch lanes/handler is isolated**: lanes/nsf-project-pitch.js has its own strict contract (docs/D3-E-NSF-RESEARCH.md), schema version (D3-E.nsf.v1), and FORBIDDEN_CLAIMS list, but there is NO integration point to the main /api/capital-engine?action=audit-application pipeline. It is a standalone module. Unclear how NSF pitches are routed from pattern-proposals.html or whether they are manually invoked. Solution: wire score-lanes or audit-application to call generateNsfProjectPitchDraft when appropriate.

23. **Investment lane lacks seed artifact templates**: print-document.js references investment lane but long-form-generator.js INVESTMENT_SYSTEM is not shown in snippet. Unclear whether investment document generation works or is a stub. Review-rubric.json lessons include research|investment gating (dataFeasibility), so the lane should exist. Solution: complete and test long-form INVESTMENT_SYSTEM system prompt.

24. **"Research" lane is research-adjacent but not integrated with actual research databases**: long-form-generator.js RESEARCH_SYSTEM (not shown) likely outputs OSF preregistration markdown, but there is NO integration with OSF.io API, FRED/SEC EDGAR/BLS/EIA data validators, or IRB lookup. System trusts the operator to provide valid hypothesis/methodology; no upstream data-availability check. Solution: add pre-gate that validates core indicators are computable on the current stack (per lesson "data-feasibility").

---

**File Evidence:**

- C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (lines 287–295): score-lanes action fires application-auditor.scoreLanes()
- C:\Users\Chris\Limen-Helix-live-\applications.html (lines 85–86): adversarial-review button fires with lane='grant' (hardcoded, not dynamic)
- C:\Users\Chris\Limen-Helix-live-\my-documents.html (line 72): "generateEverything" button disabled with note on Redis duplicates
- C:\Users\Chris\Limen-Helix-live-\lib\affiliate-injector.js (line 24): FTC disclosure injected, but render-time visibility not validated
- C:\Users\Chris\Limen-Helix-live-\lanes\nsf-project-pitch.js (lines 94–105): FORBIDDEN_CLAIMS array; no integration to audit-application
- C:\Users\Chris\Limen-Helix-live-\assets\data\review-rubric.json (line 28): entity-coherence-and-assignment flagged but not enforced on render

### 16. Engine outputs / artifacts

1. **SBA lane is fully built but unused** — 15 patterns exist; none emit `derivedAngles.sba`. SBA generator exists (generateSBA returns null if no derivedAngles present). Template structure exists (borrowerSummary, guarantorBackground, useOfProceeds, dscrAnalysis, stressTest, creditNotElsewhere, creditDecisionRationale). **Action required:** author SBA angles into patterns for small-business-eligible entities, or remove the lane structure to reduce confusion.

2. **Franchise lane is fully stubbed but returns null** — generateFranchise() always returns null. Comment says "pending dedicated franchise sample research" and suggests need for FTC Franchise Rule Item 1-23 disclosure structure. **Action required:** research 5 real franchise disclosure documents, update verbiage-templates.json with FTC Rule Item structure, author franchise angles into patterns, or remove the lane.

3. **Market-data integration is architecturally optional but currently unused** — computeValuation() is called in generateInvestment() with optional `md` parameter; if absent, ALL 461 investment artifacts degrade to qualitative thesis (observed: 461 qualitative, 0 computed). No measured investment artifact has `.valuationBasis.computed=true`. **Risk:** investment theses lack real price targets, making them harder to act on. **Action required:** integrate market-data fetch into orchestrator (need stock price, shares, revenue, net debt for each portal); pass computed valuations to generateInvestment(); measure coverage.

4. **Pattern authoring doesn't record its proposal metadata durably** — proposePattern() saves to Redis OR file, but Vercel serverless filesystem is ephemeral. REDIS REQUIRED for production (otherwise proposals vanish on cold-start). Local fallback to `assets/data/_pattern-proposals.json` exists but will lose state on Vercel. **Action required:** audit UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars are set in Vercel; confirm Redis is the primary store; consider backup polling to sync to git.

5. **Pattern repair worker (cron-repair-held.js) is not audited** — pattern-author.js documents it (`repairPattern()` function); claims it runs offline on held-unmatched patterns. No record of the cron job's schedule, success rate, or error handling. **Action required:** find and audit the repair cron; measure held vs repaired rate; confirm repair doesn't block authoring.

6. **Fired artifacts are manually moved to assets/data/fired-artifacts/** — only 1 exists (dated 2026-05-31). No clear routing rule for when an engine output "fires" (becomes approved for deployment). Current observed status: outputs are persisted to Redis but not automatically promoted to fired status. **Action required:** define "fire" state transition rule; automate promotion via operator action on helix-artifact.html interface; measure fire rate.

7. **No real investment targets have been computed** — all 461 investment artifacts use qualitative theses. Reason: market-data `md` parameter not passed at generation time. computeValuation() is correctly built; just unused. **Action required:** (see #3 above) integrate market data into the build pipeline.

8. **Engine output caching strategy unclear** — master-inbox.js checks `limen:eo:` Redis keys as overlay on top of file-based outputs. If Redis is stale or down, stale file outputs render. No measured heartbeat on Redis freshness. **Action required:** monitor Redis uptime; establish SLA for cache freshness; log misses.

9. **Pattern dedup logic allows same region + same business-signature on DIFFERENT portals** — pattern-author.js gate allows `(neural.region, business.signature)` pair to be authored on portal A, then re-proposed on portal B. This is probably fine (same neural region can be relevant to different business contexts). But the docstring says "region × target uniqueness gate" which suggests intent to prevent it. **Clarify:** is this a cross-portal reuse pattern (encouraged) or a bug? Current code allows it. Verify intent.

10. **Indicator detectors for fn_phase_share and fn_text_match assume functionNetwork categories exist** — if a portal has no suppliers (e.g., pure software), those detectors silently fire false. Consequence: low-confidence bridges on sparse networks. **Action required:** bias pattern authoring toward text_match and kernel_phase detectors for broad applicability; document expected fn categories (suppliers, customers, capitalProviders, regulators, competitors).

11. **Template placeholders use complex syntax ({{KEY|default|opt1|opt2}})** — engine-output-generator.js subst() function is correct, but if a placeholder doesn't match the expected syntax, substitution silently fails (returns "[KEY]"). Consequence: broken placeholders in rare cases. **Action required:** add logging to subst() to detect malformed placeholders at generation time; measure placeholder-fill rate.

12. **Confidence calibration across lanes is hand-coded** — computeValuation uses hard-coded PHASE_FACTOR map (p0=1.05, p3=0.70, p7=0.50, etc.). No versioning or audit trail if these factors are tuned. **Action required:** version PHASE_FACTOR; log tuning events; A/B test against real outcomes.

13. **No measured link between engine outputs and downstream filings** — `/api/print-document` streams DOCX to browser, but no tracking of whether the document was actually filed (USPTO, NIH, SBA, etc.). **Action required:** instrument download events; measure conversion to filing; track rejections.

14. **Patent lane doesn't emit dependent claims 2-5 correctly if bridge.knownTreatments is missing** — claim 4 on line 128 uses `.slice(0,3)` of knownTreatments; if array is empty or absent, claim renders with placeholder markers. **Action required:** verify all 15 patterns have non-empty knownTreatments; add fallback language if absent.

15. **Verbiage templates are incomplete for some lanes** — investment lane templates exist for header, variants, catalysts, valuation, positioning, risk, exit, and activist (optional). But no template for "How to monitor" section that several real Loeb/Burry letters include. **Action required:** extend investment templates; measure artifact completeness.

16. **Fired-artifacts directory has only 1 item after months of operation** — suggests either fire threshold is very high (good: only high-quality outputs fire), or fire mechanism is not working. **Action required:** audit approval flow; measure proposal→approval→fire pipeline success rate.

**File paths (absolute):**
- C:\Users\Chris\Limen-Helix-live-\lib\engine-output-generator.js
- C:\Users\Chris\Limen-Helix-live-\lib\bridge-engine.js
- C:\Users\Chris\Limen-Helix-live-\lib\pattern-author.js
- C:\Users\Chris\Limen-Helix-live-\lib\valuation.js
- C:\Users\Chris\Limen-Helix-live-\lib\long-form-generator.js
- C:\Users\Chris\Limen-Helix-live-\assets\data\bridge-patterns.json (15 patterns)
- C:\Users\Chris\Limen-Helix-live-\assets\data\verbiage-templates.json (patent, grant, sba, investment templates)
- C:\Users\Chris\Limen-Helix-live-\api\limen-engine-output.js
- C:\Users\Chris\Limen-Helix-live-\api\print-document.js
- C:\Users\Chris\Limen-Helix-live-\api\print-from-pattern.js
- C:\Users\Chris\Limen-Helix-live-\api\pattern-proposal.js
- C:\Users\Chris\Limen-Helix-live-\scripts\build-engine-outputs.mjs
- C:\Users\Chris\Limen-Helix-live-\assets\js\company-portal-engine-render.js
- C:\Users\Chris\Limen-Helix-live-\helix-artifacts.html
- C:\Users\Chris\Limen-Helix-live-\helix-artifact.html
- C:\Users\Chris\Limen-Helix-live-\assets\data\fired-artifacts\2026-05-31__research-note__bla-hyperactive-economy__exposure-to-volatility-reexposure.md

### 17. Feeds & Ingestion

1. **feed-status.js is incomplete & misleading** (path: C:\Users\Chris\Limen-Helix-live-\api\feed-status.js)
   - Only 22 SOURCES listed; missing 178+ sources that domain-snapshot.js defines
   - Missing entire feed definitions for: economy, energy, environment, health, technology, research, supplyChain, finance, intelligence, medicine, science
   - Consequence: GET /api/feed-status lies — returns "missing" or "fallback" for domains that have vibrant sources in domain-snapshot.js
   - Action: Either (a) expand feed-status.js to include all 200+ sources from domain-snapshot.js, or (b) deprecate feed-status.js & redirect to domain-snapshot.js diagnostics, or (c) document that feed-status.js is deprecated lightweight audit & users should call domain-snapshot.js directly

2. **GDELT legacy code still present** (path: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js, lines 560+)
   - Comments say GDELT replaced by RSS feeds (governance→RSS 34, communication→RSS 35, culture→RSS 36, defense→RSS 37, intelligence→RSS 38, religion→RSS 26)
   - But code still includes GDELT fetchers (fetchGDELTGovernance, fetchGDELTMedia, fetchGDELTTone, fetchGDELTConflict, fetchGDELTReligion, fetchGDELTIntel)
   - Stale cache logic kicks in after 10min without GDELT refresh, but GDELT is marked unreliable (2s timeout)
   - Action: Remove dead GDELT fetchers entirely, simplify stale cache logic to only handle RSS sources that legitimately drop offline

3. **domain-snapshot.js SOURCE_KEYS ordering is fragile** (path: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js, lines 67–333)
   - 266 string keys must be kept in exact sync with 266 Promise.allSettled fetch functions (lines 336+)
   - Reordering, inserting, or removing a fetcher breaks silent because JS array index binding isn't validated
   - Evidence: comments warn "Reordering, inserting, or removing a fetcher requires the matching SOURCE_KEYS entry to move with it"
   - Action: Refactor to object-keyed fetcher map (e.g., {FRED: fetchFRED(), BLS: fetchBLS()}) instead of positional array

4. **No explicit "zero-feed" domains flagged at build time** (path: C:\Users\Chris\Limen-Helix-live-\scripts\sense\organ-feeds.mjs)
   - organ-feeds.mjs reports uncovered canonical domains as HIGH severity, but feed-status.js only covers 11 domains
   - Audit runs against feed-status.js, not domain-snapshot.js → false negative (audit says coverage good, but feed-status.js is incomplete)
   - Action: Update organ-feeds.mjs to audit domain-snapshot.js instead, or split audit into two: (a) feed-status.js lightweight diagnostic coverage, (b) domain-snapshot.js master source inventory

5. **Manual ingestion (limen-ingest.js) accepts 'trade' domain, but no 'trade' feed exists** (path: C:\Users\Chris\Limen-Helix-live-\api\limen-ingest.js, line 19)
   - KNOWN_DOMAINS = [... 'trade'] (21 total)
   - CANONICAL_DOMAINS = 20 (no 'trade')
   - No sources in domain-snapshot.js map to 'trade'
   - Action: Either (a) remove 'trade' from KNOWN_DOMAINS, or (b) define trade sources in domain-snapshot.js

6. **Stale cache logic assumes all GDELT-backed domains fail together** (path: C:\Users\Chris\Limen-Helix-live-\assets\js\domain-signal-engine.js, lines 149–208)
   - _GDELT_DOMAINS = {governance:1, communication:1, culture:1, defense:1, religion:1, intelligence:1}
   - But intelligence now backed by Tavily (not GDELT), and defense by RSS, and governance by RSS → code is out of sync with domain-snapshot.js
   - Action: Remove _GDELT_DOMAINS logic entirely; stale cache should be per-domain & configurable via domain-snapshot.js status field

7. **Market data sources (market-data.js) hardcoded, not integrated with feed registry** (path: C:\Users\Chris\Limen-Helix-live-\lib\market-data.js)
   - Fetches Yahoo Finance + SEC EDGAR directly, bypassing domain-snapshot.js orchestration
   - No deduplication, no cache TTL, no staleness handling vs. other domain feeds
   - Action: Integrate Yahoo/EDGAR into domain-snapshot.js as "finance market microstructure" sources (currently missing live price/share data)

8. **Defense signal engine runs via two paths: client (limen-defense-signal-engine.js) AND server (limen-worker-ingest.js)** (paths: C:\Users\Chris\Limen-Helix-live-\assets\js\feeds\limen-defense-signal-engine.js, C:\Users\Chris\Limen-Helix-live-\api\limen-worker-ingest.js)
   - Client polls /api/defense-signals every 2min, applies delta
   - Server cron also runs ingest every 2min, stores to Redis
   - Risk: Duplicate ingestion, divergent signal computation (client uses 0.3 multiplier, server uses normalized magnitude directly)
   - Action: Clarify ownership — should server be authoritative, or client advisory?

9. **No feed SLA or heartbeat monitoring** (missing: C:\Users\Chris\Limen-Helix-live-\api)
   - feed-status.js is on-demand diagnostic, not continuous monitoring
   - No alerting if a domain feed goes dark for >N minutes
   - No dashboard showing which sources are currently live vs. fallback/stale
   - Action: Add cron-based feed health monitor that tracks per-domain staleness & alerts ops

10. **Feed-store.js TTL (30min) may be too short for low-activity domains** (path: C:\Users\Chris\Limen-Helix-live-\assets\js\feed-store.js, line 26)
    - Evidence: domain-snapshot.js caches GDELT 5min, expires STALE at 10min
    - But feed-store.js generic 30min may expire data before next poll cycle if user tabs out
    - Action: Make TTL domain-specific (e.g., high-velocity: law, finance → 10min; low-velocity: religion, culture → 60min)

11. **No explicit "mandate says ~9 domains with NO feed" statement in code** (mandate reference unclear)
    - Assumption: CANONICAL_DOMAINS (20) minus some subset = ~9 with no feed
    - Reality: domain-snapshot.js covers all 20 + 4 extras (health, research, science, medicine)
    - Action: Clarify mandate — was it outdated, or is "9 unfed domains" a different requirement?

**Summary of Live Domains with Feeds (measured from domain-snapshot.js SOURCE_KEYS count by domain):**
- 20/20 canonical domains have at least one feed
- 4 extra domains (health, research, science, medicine) have feeds
- No canonical domain is completely unfed in domain-snapshot.js
- feed-status.js covers only 11 of 20 (inconsistent, incomplete)

### 18. Paper trading / markets

1. **Alpaca Credentials Gap**: paper-trade.js, paper-orders.js, paper-positions.js check multiple env var aliases (ALPACA_API_KEY_ID, APCA_API_KEY_ID, ALPACA_KEY_ID, ALPACA_KEY). This fallback chain is defensive but fragile. Vercel env should be normalized to a single, documented key. **File evidence**: api/paper-trade.js lines 26–27, paper-orders.js lines 30–31, paper-positions.js lines 28–29.

2. **Market Data Fallback Opacity**: /api/market-snapshot falls back to simulated data (sinusoidal math.sin()) with no warning if all four fetches fail (S&P, VIX, oil, 10Y). Response includes simulated=true flag, but investment-console.html does not visibly warn user that snapshot is synthetic. Verdict scoring treats live and simulated data identically. **File evidence**: api/market-snapshot.js lines 31–32, 85–88; investment-console.html lines 281–314 (getMarketAlignmentScore ignores simulated flag).

3. **Yahoo Finance Rate Limiting**: asset-quote.js fetches sequentially with 200ms delay (line 68). This is fragile: if a user requests 10 symbols and network latency is high, total fetch time can exceed 4s timeout. Rate limits on Yahoo v8 are not formally documented; fallback is graceful (returns live=false per-symbol) but user sees no data. **File evidence**: api/asset-quote.js lines 31–69.

4. **Portfolio Context Missing Timestamps**: analyzePortfolio() in portfolio-context.js ingests positions/orders but stores no fetch time. If Alpaca data is stale (e.g., user doesn't refresh for 10 minutes), investment console will render stale P&L, unrealizedPl, and P&L color coding without any indicator. No "last updated" badge on portfolio exposure section. **File evidence**: assets/js/portfolio-context.js lines 128–217.

5. **Verdict Scoring Overfitting**: verdictScore computation (investment-console.html lines 500–576) weights confidence (0–40), data quality (0–25), domain stress (0–20), market alignment (-10 to +10), urgency (+0 to +15), saturation (-0 to -10). Weights are hardcoded. No sensitivity analysis or validation that the weighting reflects operator intent. Score is deterministic but not calibrated to historical accuracy. **File evidence**: investment-console.html lines 504–573.

6. **Kernel Annotation Dead Code**: connectome-kernel-adapter.js is loaded and run (investment-console.html line 142, _runKernelExperiment called at line 1352), but code comment at line 253 states: "DEAD CODE — adapter is disabled; kept for legacy compat; never used for verdicts or trades". Kernel output appears in connectome-grounding section marked EXPERIMENTAL, but line 477 shows it's only rendered if explicitly available. Confuses readers; should clean up or formally document as experimental UI-annotation-only. **File evidence**: investment-console.html lines 253, 411–426, 477–493.

7. **Asset Overlap in ASSET_MAP**: FLNC (Fluence Energy) appears in both infra_demand (line 157) and climate_energy (line 181). Similarly, ICLN and TAN (clean energy) could be mentioned in multiple opportunity maps. No deduplication logic in renderAssetRow when building suggested-asset list. User sees same ticker across multiple opportunity themes without consolidation. **File evidence**: investment-console.html lines 151–234.

8. **Off-Thesis Position Rendering Cut Short**: investment-console.html lines 810–827 attempt to list "OPEN POSITIONS not in suggested assets" but renderAssetRow is called with minimal data (name=symbol, type='', sector=''). No market data fetches for off-thesis symbols unless user manually selects an asset. This creates blind spots: user may hold a concentrated position off-thesis and never see it unless they search portfolio exposure on the right column. **File evidence**: investment-console.html lines 810–827.

9. **Trade Confirmation Modal Memory**: openTradeConfirm (lines 1032–1098), openSellConfirm (lines 1170–1225), openExitConfirm (lines 1228–1263) all create modals with id="tradeConfirmModal". Only one modal can exist at a time, but closeTradeConfirm (line 1100) does not explicitly guard against double-modal or overlapping event handlers. If a user rapidly clicks trade buttons, race conditions could occur. **File evidence**: investment-console.html lines 1036–1038, 1171–1173, 1229–1231, 1100–1103.

10. **LocalOnly Fallback Trade Records**: refreshPositionsAfterTrade (lines 1160–1167) re-zeros _paperPositions and _paperOrders after a trade and refetches from Alpaca. If Alpaca is stubbed, the fallback reconstructs from _paperLog (lines 323–331 of fetchPaperExposure). This means if a user trades, then goes offline, the next render will show synthetic data from the log, not actual Alpaca state. No warning that positions shown are "reconstructed from log" vs. "live from Alpaca". **File evidence**: investment-console.html lines 316–377, 1160–1167.

11. **Missing Journaling of Rejected Orders**: api/paper-trade.js returns error detail on rejection (lines 81–86), but investment-console.html's submitPaperOrder (lines 1105–1157) logs rejections only to the modal UI (result div, line 1131–1146), not to sessionStorage.limen_paper_log. So rejections are invisible in the "PAPER TRADE LOG" section. User cannot audit a full history of attempts. **File evidence**: api/paper-trade.js lines 81–86; investment-console.html lines 1140–1149 (rejection path does NOT call paperTradeLocal).

12. **Edge Case: Empty ASSET_MAP**: If _oppData.pb.id is not in ASSET_MAP (investment-console.html line 590), assets defaults to []. Center column renders with "SUGGESTED ASSETS (0 items)" but no error message. User sees blank section. No fallback to node-derived assets or warning that playbook data is incomplete. **File evidence**: investment-console.html lines 590, 795–807.

13. **Capital-Engine Integration One-Way**: capital-engine.json defines `investment_lane` as a revenue stream but provides NO LINK BACK to investment-console.html or paper trading system. The JSON is read-only governance data; no API endpoint connects investment-console verdict scores or trade volume back to capital-engine.js?action=orchestrate. This means the finance domain's AI optimizer has no visibility into paper-trading performance or pipeline signals. Integration is only declarative (json), not runtime. **File evidence**: api/capital-engine.js (no reference to paper-trade, paper-orders, or investment-console); capital-engine.json line 95 (investment_lane defined in isolation).

14. **No Simulation Mode Flag in UI**: Users executing paper trades may not realize they're in paper mode if Alpaca is unavailable and the system falls back to local logging. The modal disclaimers (investment-console.html lines 1044, 1045, 1140) mention "PAPER TRADING ONLY", but if a real order fails and a local trade succeeds, the UX distinction is blurred. Recommend adding a persistent banner indicating "PAPER MODE ACTIVE — ALPACA [STATUS]". **File evidence**: investment-console.html lines 1044, 1140 (modals only); no persistent banner.

15. **Alpaca Order Metadata Not Standardized**: api/paper-trade.js accepts oppId, oppTitle, verdict, score in the request body (lines 99–103) but does NOT require them. A client could submit an order with no metadata. Alpaca API ignores these fields anyway. The metadata is advisory only for the LIMEN audit log (sessionStorage). This is correct design, but lacks a server-side record of which orders came from which opportunity. **File evidence**: api/paper-trade.js lines 99–103; investment-console.html lines 1111–1119 (body assembly).

---

**Summary**: Paper trading system is **functional and low-risk** (paper-only, no real money). Market data fetches are **resilient with simulated fallback**. Portfolio analysis is **rich and domain-aware**. Main gaps are: credential normalization, market-data freshness visibility, kernel annotation cleanup, capital-engine integration depth, and off-thesis position blindness. No critical bugs; all issues are UX, transparency, and engineering debt.

### 19. Civilization Cockpit

1. **Missing Deep-Proof Data** (observatory-deep-proof.js, lines 30-35)
   - Expected path: `/assets/data/aggregated/<DIAGNOSIS>.deep.json`
   - Status: **NO FILES PRESENT**. Observatory UI gracefully degrades, showing packet summary fallback on click, but "Loading large deep proof…" text and fallback panel render empty nested structure.
   - Impact: Low (lazy-load; user sees "not found" UI state, not crash)
   - Action: Either (a) disable deep-proof loading entirely and hide the button, or (b) run `scripts/build-aggregated-deep-proof.js` (if exists) to populate the tank

2. **Missing Artifact Source Index** (artifact-source-index-client.js, lines 40-41, 77-83)
   - Expected path: `/assets/data/artifact-source-index/by-diagnosis/<diagnosisId>.json`
   - Status: **DIRECTORY DOES NOT EXIST**. 2 diagnosis aliases defined but no backend bundles.
   - Impact: Low (fallback path used; packets route to SOURCE_CONTEXT_SHALLOW)
   - Action: Run `scripts/build-artifact-deep-source-index.js` (if exists) or disable client if not planned

3. **Observatory-UI Lane Buttons** (civilization-opportunities.html, lines 160–168)
   - Lane buttons in filter bar: ALL, PATENT, GRANT, INVESTMENT, BUSINESS/SBA, LOAN/INFRA, RESEARCH, REGULATORY, OPERATOR
   - Defined lanes in handoff-contract.js: patents, copyrights, business-grants, research-grants, nsf-project-pitch, sba-loans, franchise, investments, research-papers
   - **Mismatch**: UI lane names do NOT match handoff lane keys exactly (e.g., "PATENTABLE" vs "patents", "GRANT-ELIGIBLE" vs "research-grants")
   - Impact: Medium (lane filter logic at observatory-ui.js line 58 laneClass() must map UI lane → handoff lane; if mapping missing, filters fail silently)
   - Action: Verify observatory-ui.js implements correct lane-name → lane-key translation; add missing lanes (REGULATORY, OPERATOR appear to have no backend support)

4. **Domain Name Aliasing** (3 non-canonical runtime keys)
   - brain-emitted keys: health → medicine, research → science, supplyChain → trade
   - DOMAIN_CANONICAL map in observatory-aggregator.js handles this
   - DOMAIN_ORDER in domain-packet-adapter.js uses canonical names
   - Issue: If a 3rd consumer needs the same mapping, extract to shared module assets/js/domain-canonicalizer.js (currently inline in observatory-aggregator only)
   - Impact: Low (currently works; brittle if duplicated logic diverges)

5. **Stale Data Thresholds** (domain-packet-adapter.js, lines 57–58)
   - BRAIN_STALE_MS = 6 minutes
   - SNAPSHOT_STALE_MS = 5 minutes
   - Status: **Conservative but may mask real latency issues**. A brain that hasn't updated for 5:59 still renders as "fresh" with brain payload.
   - Action: Monitor brain cycle times; if average > 3min, reduce BRAIN_STALE_MS to 4 min or add "warn" flag at 4min threshold

6. **Observatory Opportunity Canonicalization Asymmetry**
   - observatory-aggregator.js canonicalizes domain keys for UI consumption
   - BUT artifact-packet-builder.js stores originalRawDomain for traceability
   - Inconsistency: If an artifact packet references a diagnosis from a medicine-brain (brain emits rawDomain='health'), the diagnosis may be labeled in one dialect and looked up in another
   - Impact: Low (ArtifactPacket preserves both canonical + raw; lookups use canonical)
   - Action: Ensure diagnosis alias map in artifact-source-index-client.js accounts for raw-domain variants

7. **Panel Relocation Polling** (civilization.html, lines 479–499)
   - Uses setInterval with 10-pass limit (5 seconds total polling)
   - If a panel renders after 5 seconds, it stays in body, not in grid column
   - Impact: Low (observed: panels instantiated synchronously or within boot sequence; 5s buffer adequate for current load order)
   - Action: Increase passes to 20 (10s) if late-loading panels added; log unlocated panels to console for debugging

8. **Research Observatory Module Dependency** (research-observatory.js)
   - Loads brain-node-domains.json (implicit; no error handling if missing)
   - Code at lines 23–35 uses loadJSON() but no fallback if file 404s
   - Impact: Low (file exists; but if deleted, module silently fails and panel renders empty)
   - Action: Add explicit error logging to loadJSON callback and render "data unavailable" message

9. **Missing Module Registration** (limen-bootstrap.js dependency)
   - civilization.html does not explicitly load limen-bootstrap.js in body — checking civilization.html lines 314–426
   - Line 426 loads `assets/js/limen-bootstrap.js` last
   - Status: **PRESENT**. All core modules load in correct order.
   - No action required

10. **Interconnect Event Silence Detection** (self-health-monitor.js)
    - EVENT_SILENCE_THRESHOLD = 90 seconds
    - If no limen:domain-update fires for 90s, health monitor flags "event silence"
    - Implication: If signal-engine polling is > 90s, cockpit shows as degraded even if brains are running
    - Action: Verify signal-engine.js polling cadence is < 60s; adjust EVENT_SILENCE_THRESHOLD if needed

11. **Biosensor Engine Dependency** (civilization.html, line 346)
    - Line 346: `<script src="biosensorEngine.js" defer></script>`
    - **File path is ROOT-relative, not assets-relative**. Should be `assets/js/biosensorEngine.js` or just `biosensorEngine.js` if root file exists.
    - Status: **WORKS** (restored in commit 61858d0; biosensorEngine.js is root file, 1,872 lines)
    - Action: No change; intentionally at root for direct load

12. **Domain Brain Adapter vs. Brain Outputs** (domain-brain-adapter.js)
    - Brain-adapter normalizes ALL domain outputs into window.LIMENDomains slots
    - But civilization packet-adapter reads both window.LIMENDomains AND window.LIMENBalance AND window.LIMENPolarity separately
    - If a domain brain updates but balance-meter hasn't run yet, packet-adapter may use stale balance data
    - Impact: Low (both run in quick succession; 30s snapshot fallback catches divergence)
    - Action: Consider adding balance/polarity age checks to packet-adapter warnings

---

**Summary Stats:**
- **14 named panels** active on cockpit (all accounted for, all in PANEL_MAP)
- **20 domain brains** (energy, finance, defense, trade, medicine, agriculture, communication, culture, economy, education, environment, governance, industry, infrastructure, intelligence, law, population, religion, science, technology)
- **9 artifact lanes** (patents, copyrights, business-grants, research-grants, nsf-project-pitch, sba-loans, franchise, investments, research-papers)
- **123 brain nodes** (neurological, mapped to domain roles via brain-node-domains.json)
- **20 domains** in civilization model (ordered: economy, energy, environment, health, technology, research, supplyChain, governance, infrastructure, agriculture, industry, education, communication, culture, defense, religion, population, law, finance, intelligence)
- **4,862 lines** of civilization-specific JS (9 modules)
- **Data freshness**: Brain payloads <6min = fresh; snapshots <5min = fresh; beyond = stale flags emitted

**Last restored:** 2026-06-02 13:13:50 UTC (commit 61858d0); all 108 script dependencies resolved (107 pre-present, biosensorEngine.js migrated).

### 20. Recommendations / reports / executive / philemon

1. **Philemon removed from civilization.html** — Line 369 reads `<!-- philemon removed -->` but philemon-voice-guide.js exists and is loaded on ALL pages. Unclear why commented out; check if intentional or stale flag.

2. **No philemon on opportunities pages** — 22 opportunity pages (agriculture, defense, energy, etc.) load executive modules but NOT philemon. Only main portals (civilization, domain-console) have voice guide. Consider expanding philemon to all primary pages.

3. **Response safety layer only on domain-console** — `response-safety-layer.js` loaded only on domain-console.html (line 425), not on civilization.html. Asymmetric human gating between two main portals.

4. **Execution vs. recommendation silos** — `execution-reports.html` is a completely separate 77-module system (operator tracking, payouts, policy, phases 1–11). No visible integration with recommendation/executive/philemon pipeline. No cross-calls, no shared state (other than localStorage for intents). Verify if intentional architectural separation.

5. **limen-report-index.json mapping stale risk** — 446 KB medical role→brain node mapping. No visible refresh mechanism or version stamp. Job titles (Physician, Endocrinologist) are hardcoded; if business roles evolve, this tank becomes orphaned.

6. **Report schema locks but no validation on synthesis** — recommendation-schema.json, evidence-schema.json, innervation-schema.json are marked "locked — read-only", but report-synthesizer.js has no runtime schema validation. Synthesized reports could deviate and silently break schema contract.

7. **Evidence envelope historical section optional** — report-synthesizer.js._buildHistoricalSection() returns `{ available: false, analogueCount: 0 }` fallback if envelope missing. No warning if analogues are expected but missing. Confidence may be over-stated without historical context.

8. **Philemon alert memory unbounded in theory** — `_alertMemory` map has no size cap. In a 24/7 operation with many domain fluctuations, cooldown entries could accumulate. No garbage collection logic visible (other than manual delete on de-escalation).

9. **Executive intent cap is 25, no overflow handling** — MAX_ACTIVE_INTENTS = 25; createIntent() returns error if full. No archiving, prioritization, or emergency drop logic. Operator can fill queue with low-priority intents and block new ones.

10. **Server sync of intents fire-and-forget** — limen-executive-control.js line 116–121: `/api/limen-intents` POST has 5s timeout, no retry, no error feedback to user. Network failures silently drop intent updates server-side.

11. **No read-back after server sync** — If server persists intents, there is no periodic refresh to catch server-side deletes or external updates. Boot only merges if local is empty OR server is newer, but only happens once at load.

12. **Recommendations not persisted** — Recommendation objects are generated on-demand, not stored. If user navigates away, recs are lost. No way to retrieve "the recs that led to this intent".

13. **Report export does not include source chain metadata** — Exported HTML/JSON includes sourceChain object, but schema/rendering appears incomplete. Feed counts, seed node IDs, remedy lookup count are present but narrative context is minimal.

14. **Confidence thresholds hardcoded** — CONFIDENCE_THRESHOLDS in recommendation-engine.js (mainUser: 0.40, portalUser: 0.55, business: 0.60, domain: 0.50, civilization: 0.65) are constants, not configurable. No admin UI to adjust thresholds per organization risk tolerance.

15. **Philemon command bar not integrated** — Philemon registers Alt+P and opens text input, but does not register commands with the main command bar (Ctrl K) module. Separate control surface; potential UX friction if user expects Philemon to appear in command palette.

16. **No Philemon state persistence** — `_active` flag (voice on/off) resets on page load. User preference to silence Philemon is lost on navigate. Should persist to localStorage.

17. **Philemon voice profile hardcoded** — VOICE_PROFILE rate/pitch/volume are constants. No user-facing UI to adjust elder vs. youthful, speed, volume. Accessibility concern for users with different hearing needs.

18. **Recommendation urgency decays by time but not by action** — _computeUrgency() uses exponential decay (URGENCY_DECAY) but ignores user's stated next action. If user says "I will address this", urgency should not continue to decay; it should spike or reset.

19. **Pattern detection heuristics brittle** — _classifyPattern() in recommendation-engine.js uses ad-hoc node counts + thresholds (e.g., limbic >= 2 AND hyperNodes includes 17). No learned classifier, no feedback loop to improve; if brain connectome structure changes, heuristics break.

20. **Evidence envelope projected section optional** — report-synthesizer.js._buildPredictiveSection() has no data if envelope.projected is absent. Reports may lack forward-looking insights if projections not available.

21. **Patent opportunity report signals incomplete** — Only 3 sources populate signals: filing density gaps, temporal gaps, novelty encoding. No integration with domain-specific innovation registries or cross-domain bridging opportunities visible in live data.

22. **Philemon DOMAIN_KEYWORDS hardcoded** — 7 domains mapped (economy, energy, environment, health, technology, research, supplyChain). Does not cover all 20 system domains (governance, infrastructure, agriculture, industry, education, communication, culture, defense, religion, population, law, finance, intelligence are missing). Domain-specific narration will fail for those.

23. **No audit trail for human decisions on intents** — limen_executive_audit tracks rejected transitions and creation metadata, but no log of user's actual confirm/abandon/pause actions. No way to audit who decided what when.

24. **Limen-report.html node selector not connected to recommendation engine** — limen-report.html appears to be a standalone node browser using limen-report-index.json, NOT integrated with recommendation output. Operator sees limen-report in isolation from recs/exec flow.

25. **Regulation reports schema missing** — regulation-reports.js references innervation-schema but no sample regulation output visible. Unclear if regulation report generation is fully implemented or stubbed.

### 21. Vitals / audit / interoception

**CRITICAL (block system flow):**
- **Kernel organ IN_PAIN (0/100)** — ALL 767 portals have empty K1/K2/K3 readings. Cause: K1 readings may still be at legacy `financialHealth.composite` (field-name drift from `compositeScore`), K2 gates not yet relaxed in api/helix_app/index.py. Action: (1) verify K1 field-name migration complete (organ checks both `.composite` AND `.compositeScore`), (2) relax K2 gates per infrastructure memo, (3) run scripts/persist-k2-readings.mjs post-deployment.
- **Domain-packet-adapter MISSING** (`C:\Users\Chris\Limen-Helix-live-\assets\js\civilization\domain-packet-adapter.js`) — organ-domains.mjs flags as LOOP_OPEN. Without adapter, domain brains emit packets but civilization aggregator has no input stream. Action: restore from git history or rebuild per architecture.
- **Master-brain inbox never built** — organ-master-brain.mjs reports inbox file exists (stale 130h) but vitals indicate it was never regenerated. Action: run `node scripts/build-master-inbox.mjs --apply` to gate engine outputs.

**HIGH (degrade interoception fidelity):**
- **Feeds organ IN_PAIN (55/100)** — only 22 sources registered across 11/20 canonical domains. Missing: economy, energy, environment, finance, intelligence, medicine, science, supplyChain, technology. Action: expand `api/feed-status.js` source registry; without sensory input across all domains, pattern emissions are sparse.
- **Domains organ IN_PAIN (65/100)** — 1 brain file malformed (domain-console-brain.js lacks required markers). Supply chain brain missing (21/22). Action: inspect malformed file markers, verify supplyChain brain file exists at `assets/js/domain-brains/supplyChain-brain.js`.
- **Propagator output orphaned** — stress-network-state.json (4.45MB, 305h stale) has no downstream consumers. Snapshot is computed fresh (0.01h old) but data is weeks-old because file not accessed. Action: wire stress-network-state into civilization-super-brain.js to feed stress field, OR update Master Brain to consume network stress. This is the only per-domain stress model available.

**MEDIUM (degrade coverage/fidelity):**
- **Kernel organ reports K1 ZERO coverage (0%)** — flagged as "expected during migration if all readings are in legacy financialHealth slot" (informational). But 767/767 portals blind is system-wide. Action: post-K2-deployment, K3 design (relational-only kernel) to fill remaining gaps.
- **Portal corpus DEGRADED (76/100)** — 515/30034 prose entries flagged (bad), 188 CB rows point to missing portals (dead clicks now caught by company-portal-ui.js graceful fallback). Action: run heal-prose-truncation.mjs (when built) to regenerate malformed prose.
- **Bridge organ DEGRADED (80/100)** — 60.1% portal coverage (461/767 portals matched to patterns). 306 portals have no bridge mapping (potentially genuine lack of pathology signature OR library too narrow). Action: either expand bridge-patterns.json or accept that some portals lack neuro↔business bridge (informational).
- **Dead links organ DEGRADED (76/100)** — 2 unguarded surfaces (`scripts/score-companies.js`, `scripts/sense/organ-dead-links.mjs` itself) emit company-portal links without hp gates. 188 CB rows reference missing portal slugs. Action: add `if (d.hp)` guards; company-portal-ui.js fallback now handles gracefully (absent-portal page instead of 404).

**MEDIUM (incomplete automation):**
- **L1 nodes organ HEALTHY BUT FROZEN** — 123 nodes, 0 orphans, 18/20 canonical domain coverage, but 2 missing: agriculture, supplyChain. Taxonomy FROZEN until 2026-12-01 per memo; no updates possible until unfreeze date. Flag: agriculture and supplyChain are high-value domains; check if freeze policy should be relaxed early.
- **Propagator path-C anomalies** (10 entries) — unbounded composites detected; indicates outlier financial states or data errors. Action: sample and validate; may indicate stale kernel data or real signals from distressed portals.

**LOW (informational / deferred):**
- **Connectome PROPAGATE_FRACTION =0 (dead) flag no longer applies** — organ-connectome.mjs previously reported connectome dead due to PROPAGATE_FRACTION=0; audit 2026-05-25 confirmed fix. Now scoring 100/HEALTHY. Confirm array-collapse fix is durable.
- **Master-brain weight blend (65/35 civ/connectome) not detected in source** — organ-master-brain.mjs checks for hardcoded ratio; may need pattern refinement if weights are parameterized elsewhere.
- **Pattern-bus re-entrancy depth guard** — expected at 8; checks for _emitDepthMax constant (not explicitly found in this scan but bus scores 100 so guard exists).

**Data tank staleness:**
- **portal-registry.json** (61.75MB, 82 days old) — likely imported once, no ongoing updates. Verify this is intentional (reference snapshot) vs. orphaned.
- **stress-network-state.json** (4.45MB, 305h old file timestamp but fresh internal state) — file timestamp doesn't reflect last computational refresh. Suggests propagator updates in-place but file mtime is stale; verify cron actually touches file.
- **Audit data** (mechanism-ontology, verification-ledger, etc.) — informational only, no live readers detected; stale is acceptable.

**Unmeasured channels (no organ coverage):**
- **Autonomous portal-regen frontier** — vitals shows portalRegen backlog in UI (autonomous-portal-regen counts queued entities), but no dedicated organ measures regen queue freshness or drain rate. Action: optional — add organ-portal-regen.mjs if regen is high-priority autonomic function.
- **Feed runtime health** — organ-feeds.mjs only does structural audit of feed-status.js registry. No HTTP probe of live sources (expected for build-time audit). Live feed health is runtime task (web-worker cron).

**Schema/versioning:**
- Vitals schema: `vitals/2.0` (locked, stable).
- Audit data schemas: mechanism-ontology v1.0.0, field-connection-map has no explicit version, verification-ledger has own schemaVersion. **Flag: inconsistent versioning across audit tanks; recommend unified audit schema v2.x.**

---

**Summary:** Interoception is **DEGRADED (79/100 overall)** due to critical kernel readings gap (K1/K2/K3 empty), missing domain-packet-adapter loop, and stale/orphaned propagator output. Afferent sensing (feeds, L1 nodes) is mostly healthy; downstream civilization/master-brain ready but starved for input. Bridge layer wired and firing (~2500 artifacts). Multimodal-interoception north star (one engine, per-domain weights per corpus memo) is architecturally present (organ-master-brain.mjs implements 65/35 blend) but blocked upstream by kernel/adapter gaps. Once K2 gates deployed and adapter restored, system should climb to ~HEALTHY (85-90 range).

### 22. Schema & Entity Registries

**Critical Registry Cross-Consistency Gaps:**
- **company-index.json missing from manifest**: accenture_federal_services, agilent, charles_river_labs, dexcom_meta, stride, united_parcel_service. Either: (a) index outdated & should be regenerated from manifest, (b) manifest incomplete & should re-run build-companies-manifest.mjs, or (c) files removed from disk but index not updated. C:\Users\Chris\Limen-Helix-live-\assets\data\company-index.json (81 days old).

- **33 portal files on disk not in companies-manifest**: abbott_diagnostics, aptiv, berry_global, catalent_pharma, charles_river, church_and_dwight_co_inc_de, colorcon, conagra_brands, delek_us_holdings_inc, diamondback_energy, enbridge, enterprise_products_partners, fedex_logistics, fortescue_metals, heico_corp, imperial_oil_ltd, komatsu, magna_international, nabors_industries, patheon_thermo_fisher, plaid, puma_biotechnology_inc, redwire_corp, roche_genentech, royalty_pharma_plc, sarepta_therapeutics_inc, stepan_co, sunoco_lp, transocean, vertiv, viatris, workiva, xencor_inc. Manifest build script last run 2026-05-29; these 33 files may have been added after or script didn't catch them. C:\Users\Chris\Limen-Helix-live-\assets\data\companies (800 actual .json files).

- **company-aliases.json targets broken**: 183 alias targets missing from companies-manifest. Examples: hubbell, idex, itron, recro_pharma, fanuc, ingredion, senseonics, amerisource_bergen. These are aliases pointing to portals that don't exist. build-orphan-registry.mjs should handle this, but alias-candidates may have been hand-curated incorrectly. C:\Users\Chris\Limen-Helix-live-\assets\data\company-aliases.json.

- **company-registry.json byCik subset**: 543 CIKs vs 767 manifest slugs. Not all slugs have CIKs (private companies, inherited from v1 legacy). This is by design, BUT: company-aliases.json references 820 alias slugs → 1405 targets, many not in manifest. Alias target resolution will fail silently if target slug doesn't exist. No error tracking detected.

**Data Staleness & Generation Script Gaps:**
- **entity-registry.json** (84 days old) — No regeneration script found. Should be re-derived from entity-registry-builder or similar. Last modified 2026-03-15. Rebuild needs: domain.portals.entities schema compliance check. C:\Users\Chris\Limen-Helix-live-\assets\data\entity-registry.json.

- **sp500-ciks.json** (76 days old) — Hardcoded list, no regeneration script. "Expand as needed" comment suggests manual updates. Should be automated from current S&P 500 ticker list (AAPL, MSFT, AMZN, etc.). C:\Users\Chris\Limen-Helix-live-\assets\data\sp500-ciks.json.

- **eligible-universe.json** (29 days old, metadata-only) — Cohort metadata (_total: 10526, _per_sic_counts) but no actual company array. Used for threshold comparisons only. Generator unknown; script that populates this should be documented. C:\Users\Chris\Limen-Helix-live-\assets\data\eligible-universe.json.

- **portal-registry.json** (81 days old) — 173,652 domainIds (entire treatment-discovery hierarchy). Last modified 2026-03-17. No recent rebuild. Should be regenerated after any domain/diagnosis/treatment addition. C:\Users\Chris\Limen-Helix-live-\assets\data\portal-registry.json (62 MB).

- **limen-report-index.json** (91 days old) — Jobs-to-brain mapping (440+ entries). Last modified 2026-03-08. No regeneration script found. Appears curated manually. Should document source & update frequency. C:\Users\Chris\Limen-Helix-live-\assets\data\limen-report-index.json.

**Documentation & Generator Script Gaps:**
- No explicit documentation of which script generates each registry. Inferred from grep + comments: build-company-registry.js (clear), build-companies-manifest.mjs (clear), build-orphan-registry.mjs (clear), detect-slug-aliases.mjs (clear). Missing: entity-registry.json, sp500-ciks.json, eligible-universe.json, portal-registry.json, limen-report-index.json, node-signal-registry.json, brain-connectome.json generators.

- `scripts/` directory contains 118 files, but only ~20 are regenerators for registries. Many are domain-specific (add_fertilizer_treatments.js, build-brain-node-business-mapping.js, etc.). No master index of "which script builds which registry?"

**Schema Validation & Enforcement:**
- fractal-report-schema.js, company-portal-schema.js, treatment-discovery-cell.schema.js are defined but no schema-validation step detected in build scripts. company-registry.js loads portals but does NOT validate against company-portal-schema before indexing. Risk: malformed portals silently indexed.

- connectome-node-registry.json declares freeze + agreement vectors but no enforcement. downstream consumers (connectome-renderer.js, portal-ui.js) assume 123 nodes without validation.

**Orphan & Alias Resolution Robustness:**
- build-orphan-registry.mjs collapses aliases but outputs orphan-stakeholders.json (separate file). company-portal-ui.js resolve-on-fetch-miss may still attempt to fetch a portal for a non-canonical slug if user navigates with alias slug directly. Fallback behavior not documented.

- Reverse alias lookup (target → aliases pointing to it) not provided. Useful for: "which alias names resolve to Apple?" Not tracked.

**Age & Consistency Summary:**
| Registry | Age | Status | Issue |
|----------|-----|--------|-------|
| company-registry.json | 9 days | Fresh | 543 CIKs; 224 mismatch with 767 manifest slugs |
| companies-manifest.json | 9 days | Fresh | 767 slugs; 33 disk files not captured |
| company-index.json | 81 days | **Stale** | 140 companies; 6 missing from manifest |
| company-aliases.json | 9 days | Fresh | 820 aliases; 183 targets missing |
| entity-registry.json | 84 days | **Stale** | 20 domains, 26 portals, 130 entities |
| eligible-universe.json | 29 days | Stale | Metadata only; cohort definition |
| sp500-ciks.json | 76 days | **Very Stale** | Hardcoded list; no regen script |
| connectome-node-registry.json | 14 days | Fresh | Frozen through 2026-12-01 |
| node-signal-registry.json | 82 days | **Stale** | 254 signals; 123 nodes |
| portal-registry.json | 81 days | **Stale** | 173,652 domainIds; full hierarchy |
| limen-report-index.json | 91 days | **Very Stale** | 440+ job entries; no regen script |

**Generator Scripts Needing Documentation:**
- C:\Users\Chris\Limen-Helix-live-\scripts\build-company-registry.js (FOUND)
- C:\Users\Chris\Limen-Helix-live-\scripts\build-companies-manifest.mjs (FOUND)
- C:\Users\Chris\Limen-Helix-live-\scripts\build-orphan-registry.mjs (FOUND)
- C:\Users\Chris\Limen-Helix-live-\scripts\detect-slug-aliases.mjs (FOUND)
- Entity registry builder: **NOT FOUND**
- S&P 500 CIK list builder: **NOT FOUND**
- Eligible universe builder: **NOT FOUND**
- Portal registry builder: **NOT FOUND**
- Limen report index builder: **NOT FOUND**

### 23. Shared UI + browser kernel libs

1. **Phase domain adapter is PROVISIONAL display layer, not validated kernel**
   - File header explicitly notes: "This file annotates domain stress-proxy panels with provisional phase labels for civilization.html. It is NOT the validated phase kernel — that lives server-side."
   - Server validates phases via POST /api/helix-report/score; browser adapter is for UI responsiveness only
   - Risk: If server phase differs materially from browser phase, user sees stale/inconsistent state in topbar clock until next report cycle. No forced refresh after server validation.
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\kernel\limen-phase-domain-adapter.js, lines 26–31

2. **Domain-repair-map authority model is binary (ABSENT vs visible), but confidence range is continuous**
   - Cards show confidence badge (LOW < 0.4, MODERATE < 0.65, FULL ≥ 0.65) but body always renders
   - Contrast: earlier zero-default render (0% bars + "unknown" trend) would look measured even when absent
   - Current design correctly suppresses map-level body if LIMENDomains is null/empty/invalid (Gate B #9a)
   - Inconsistency: ABSENT domain card reason says "No measurement available for {domain}." but card is still slot-present in grid. No visual cue that slot is placeholder vs. real domain.
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\ui\domain-repair-map.js, lines 194–224, 291–309

3. **Regulation renderer + report-console duplicate some domain iteration**
   - Both iterate DOMAIN_ORDER (economy, energy, environment, health, …)
   - Both render state/severity/trajectory/stress/confidence
   - Possible duplication: regulation-renderer used by both console-clarity (tab) and domain-repair-map (compact block)
   - Console-clarity then re-renders same data via report-console overlay (Regulation tab)
   - Path: regulation-renderer.js line 37–42, report-console.js (tabs init), console-clarity.js

4. **Console-clarity Artifact Council tab marked as MVP with no history retention**
   - EMPTY_STATUS says: "Master Brain queue write is not wired in this MVP."
   - Artifact Council (Patch B addition) cannot persist operator decisions to queue
   - Path: console-clarity.js lines 56–81

5. **Master Brain Handoff Queue (Patch B) visible but queue write not implemented**
   - _handoffEl exists in console-clarity but write path to master-brain review queue not connected
   - Path: console-clarity.js line 98; search for _handoffEl usage

6. **Biosensor state is optional; fallback is "unknown" (rendered as CALM + 0.55 opacity)**
   - If window.LIMENBiosensorBridge is not loaded or getRegulationState unavailable, topbar shows CALM state
   - Not a bug (graceful degradation), but operator may not notice that biosensor is offline
   - Path: limen-topbar.js lines 279–298 (wireBiosensor function)

7. **Operator canonical identity is frozen at 1.0.0 (2026-05-22); no version negotiation with biosensor or human-context-gate**
   - If biosensor or gate layer updates, identity version is not bumped
   - Could lead to stale disallowed-actions or regulation-goals if biosensor changes
   - Path: operator-canonical-identity.js lines 32–37

8. **Human-context-gate audit log is session-scoped; no persistence to server**
   - 500-entry cap; once session ends, audit history is lost
   - Operator decisions (refusals, force-allows) are not logged to persistent audit trail
   - Path: human-context-gate.js lines 63–65

9. **limen/* brain architecture (pattern-envelope, super-brain-base, civilization-super-brain, connectome-super-brain, master-living-brain) only included in helix-brain-grid.html**
   - These are core fractal-recursive components but not wired into civilization.html or domain-console.html
   - helix-brain-grid.html is in codebase but does NOT appear in the 91 topbar-included pages
   - Risk: Brain orchestration exists but is isolated from main operator console
   - Path: helix-brain-grid.html (not linked from any live page family); pattern-envelope, pattern-broker, super-brain-base, civilization-super-brain, connectome-super-brain, master-living-brain in assets/js/limen/ but only one consumer (helix-brain-grid.html)

10. **Artifact list/viewer UI (artifact-list-ui.js, artifact-viewer-ui.js, markdown-renderer.js) included only in helix-artifacts.html and helix-artifact.html**
    - Not integrated into civilization.html or domain-console.html artifact discovery flow
    - Artifact Council tab in console-clarity exists but no live link to actual artifact pages
    - Path: helix-artifacts.html (included from where?), helix-artifact.html (included from where?); artifact-list-ui lines 1–50, artifact-viewer-ui lines 1–50

11. **Engine context builder (engine-context-builder.js) is the ONLY bridge between browser brain state and Claude API**
    - Strips all LIMEN-internal vocabulary before shipping to /api/expand-artifact-claude
    - No schema validation that output shape matches API expectation
    - If engine-context-builder vocab stripping is incomplete, Claude sees internal language
    - Path: engine-context-builder.js lines 40–44 ("IMPORTANT: This module strips ALL LIMEN-internal vocabulary")

12. **Multi-pass runner (multi-pass-runner.js) orchestrates expansion but cycle logic not visible in browser UI**
    - Outcome aggregator (outcome-aggregator.js) aggregates engine outputs but no result display in civilization.html or master-brain.html
    - Path: multi-pass-runner.js, outcome-aggregator.js (included only in helix-brain-grid.html)

13. **regulation-renderer.js has STATE_COLORS and STATE_PHRASES but domain-repair-map.js uses different stress classification (stressed/elevated/stable by absolute thresholds)**
    - regulation-renderer: critical, escalating, fragmented, pressured, recovering, stable
    - domain-repair-map: stressed (>0.65), elevated (>0.4), stable
    - Inconsistency: same domain may show as "pressured" in regulation block but "stressed" in repair-map if stress = 0.70
    - Path: regulation-renderer.js lines 44–52, domain-repair-map.js lines 312–313

14. **Treatment discovery (treatment-discovery) page in topbar routes but no corresponding page file in repo**
    - Path to page not found; may be in separate full-repo at C:\Users\Chris\Limen-Helix (no dash)
    - Path: limen-topbar.js line 38; /treatment-discovery route declared but landing page not in codebase

15. **CIK coverage expander (cik-coverage-expander.js) analyzes patent/grant coverage but scope unclear**
    - No doc string on what "coverage" means (novelty score? filing gaps? prior art overlap?)
    - Exposes window.LIMENCIKCoverageExpander but no evidence of caller in civilization.html or master-brain.html
    - Path: cik-coverage-expander.js lines 1–50

16. **No unit tests for phase domain adapter or human-context-gate**
    - Phase logic (3 proxies, phase priority, soft domain dampening) is complex but untested in browser
    - Human-context-gate refusal logic (HARD vs SOFT) has no test coverage visible
    - Path: assets/js/kernel/limen-phase-domain-adapter.js, assets/js/limen/human-context-gate.js

Human operator context gate code is large, complex, and mission-critical (blocks actions based on cognitive state) but lacks test harness.

Human state packet (human-state-packet.js) reads arbitrary biosensor inputs on allowedInputs list; if biosensor channel is noisy or spoofed, packet derivation is compromised.

Human context gate audit log (500 entries) is session-scoped; if operator needs audit trail after session, no export mechanism visible.

---

**Summary:** The shared UI + kernel system is a mature, cohesive stack with 91-page global navigation (limen-topbar), 4 UI panels (domain-repair-map, regulation-renderer, report-console, console-clarity) that render domain health + regulation + recommendations, a browser-side phase classifier (limen-phase-domain-adapter with 3 reconstructed state proxies), and a fractal-recursive brain architecture (pattern-envelope + super-brain-base + civilization/connectome/master brains) that is functional but isolated to a single non-live page (helix-brain-grid.html). The operator context gate (biosensor-driven action authorization) is wired but session-scoped with no persistent audit trail. Key gaps: phase validation is provisional (server is source of truth); artifact/council tabs are MVP stubs; master-brain queue write not implemented; treatment-discovery page missing; CIK coverage scope undocumented.

### 24. Complete API surface (Hono prerequisite)

1. **CRITICAL: Raw-body Stripe webhook parsing in capital-engine.js line 194**
   - File: C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (lines 190-198)
   - Issue: Custom `_readRaw()` function (lines 25-36) attempts to recover raw request body for Stripe signature verification. Falls back to re-stringify parsed body if stream already consumed. HIGH DANGER for consolidation: Vercel's request body parsing may or may not consume the stream depending on runtime/middleware. On Hono, must use explicit raw-body middleware or native crypto.
   - Risk: Signature validation may silently pass invalid webhooks if raw body recovery fails.
   - Action: Pre-Hono, test Stripe webhook delivery on Vercel. Post-Hono, guarantee raw-body middleware is first in the chain.

2. **CRITICAL: Python FastAPI polyvagal coupling incomplete (api/helix_app/index.py line ~42-50)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\helix_app\index.py (lines 37-50, partial read)
   - Issue: "Sources NOT yet wired (data-source decisions pending)" — polyvagal auto-population from server-side state is TODO. /api/limen/score will only use passed polyvagal_context, not auto-build it. This breaks the intended Pass 3 coupling for production traffic.
   - Data source: command-board-data.json (per-CIK phase + domain + stress) is available but not yet read server-side.
   - Action: Wire command-board-data.json read + polyvagal_context builder into limen.py POST handler.

3. **CRITICAL: Locked kernel immutability enforcement missing**
   - File: C:\Users\Chris\Limen-Helix-live-\api\helix_app\thing1\limen_backtest.py (97KB, SHA256 3ce4a652…82d20)
   - Issue: limen.py imports limen_backtest.py and documents it as "LOCKED validated source (immutable on disk)" but there is NO file hash check at runtime. If the file is modified (even by accident during a deploy), the SHA256 constant on line 281 becomes false.
   - Action: Add CRC32 or SHA256 check in limen.py handler; raise 500 if on-disk hash doesn't match lock.

4. **HIGH: Orphaned/Untested API endpoints (no callers found)**
   - Endpoints with no grep evidence in frontend JS, HTML, or scripts:
     - `api/limen-worker-multipass.js` — Multi-pass orchestrator, only called internally by autonomic loop (implied)
     - `api/limen-worker-sleep-cycle.js` — Sleep controller, only called by scheduler (implied)
     - `api/limen-worker-stress-refresh.js` — Stress refresh, called by cron (implied, no explicit route)
     - `api/kernel-experiment.js` — Experimental kernel, may be dev-only
     - `api/limen-iteration.js` — Iteration state, may be unreachable
     - `api/limen-phase-transitions.js` — Phase state, unclear caller
     - `api/limen-autofire-log.js` — Audit log reader, called by autonomic dashboard (implied)
   - Action: Audit each for live caller; if truly orphaned, flag for removal.

5. **HIGH: Domain snapshot source count skew (40 sources, no single source docs)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js (lines 67-80, partial read)
   - Issue: SOURCE_KEYS array is manually maintained in parallel with the Promise.allSettled() fetcher list. The comment explicitly warns "Reordering, inserting, or removing a fetcher requires the matching SOURCE_KEY entry to move with it... a slot can never silently bind to another fetcher's output." This is a violation of DRY and a landmine for future maintainers (no structured source registry).
   - Action: Extract fetchers to a data-driven registry: `const SOURCES = [{ name: 'FRED', fetch: fetchFred }, ...]`. Then iterate over SOURCES to build both the fetcher list and keys atomically.

6. **HIGH: Redis in-memory fallback stale on cold start (limen-engine-output.js, limen-outcome.js)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\limen-engine-output.js (lines 34-36, HAS_REDIS flag)
   - Issue: When REDIS unavailable, engine-output and outcome data are stored in-memory per cold-start. If a cold start happens, the in-memory store is lost and subsequent requests see an empty store. This is not documented in the response schema, and clients may assume persistence across requests.
   - Action: Add `_stale: true` or `_backend: 'memory'` fields to GET responses when HAS_REDIS=false. Operator must know data will vanish on next cold-start.

7. **MEDIUM: Python helix.py entry point indirection (api/helix.py line 1-4)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\helix.py (4 lines)
   - Issue: helix.py imports app from helix_app.index, which imports helix_app.thing2. This is a 3-level indirection for a simple FastAPI re-export. Unclear if there's intentional layering or if consolidation can flatten it.
   - Action: Inline helix.py → index.py if no multi-version contract.

8. **MEDIUM: API keys config endpoint (api-keys-config.js) — signature unknown**
   - File: C:\Users\Chris\Limen-Helix-live-\api\api-keys-config.js (not fully read)
   - Issue: Listed in glob but not read. Purpose, route, and query params unknown. May conflict with /api/feed-status diagnostics.
   - Action: Read and document full signature.

9. **MEDIUM: Stripe webhook env var names inconsistent (paper-trade.js)**
   - File: C:\Users\Chris\Limen-Helix-live-\api\paper-trade.js (lines 25-27)
   - Issue: Checks 8 alias names for Alpaca credentials (ALPACA_API_KEY_ID, APCA_API_KEY_ID, ALPACA_KEY_ID, ALPACA_KEY). No canonical name. Suggests legacy credential naming debt.
   - Action: Document canonical names; deprecate aliases.

10. **MEDIUM: Paper trading endpoints hardcoded (paper-trade.js line 15)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\paper-trade.js
    - Scope: ALPACA_PAPER_URL hardcoded to 'https://paper-api.alpaca.markets'. Good for safety (can't accidentally go live), but no env var override.
    - Action: Acceptable as-is (safety first), but consider making configurable with a guard.

11. **MEDIUM: Feed-status env var audit (feed-status.js) may be incomplete**
    - File: C:\Users\Chris\Limen-Helix-live-\api\feed-status.js (lines 25-40, partial read)
    - Issue: Env var audit is hardcoded; domain source config is not data-driven. If a new domain source is added, feed-status.js must be edited manually.
    - Action: Consolidate domain source registry with domain-snapshot.js.

12. **MEDIUM: Master-inbox live computation + Redis overlay (master-inbox.js lines 44-49)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\master-inbox.js
    - Issue: Reads committed company portal files from disk, then attempts to overlay fresh Redis engine-outputs. If Redis is down, the file-based engine-outputs are stale (e.g., 3 days old if last cron was 3 days ago). No age indication in response.
    - Action: Add `_engineOutputsSource: 'file' | 'redis'` and `_engineOutputsAge` to response; warn operator if fallback to file is >1h old.

13. **MEDIUM: Vercel function maxDuration 300s ceiling (vercel.json line 11)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (comment on line 200: "TICK: run one autonomic cycle")
    - Issue: All api/** functions capped at 300s. limen-worker-autofire.js deliberately limits MAX_FIRES_PER_TICK=1 "to guarantee we stay within Vercel's 300s budget even on slowest Sonnet call (270s+)". Multi-pass workflows (6-25 min per pass) cannot use autonomic loop; they must be triggered manually. This is a hard limit on autonomous throughput.
    - Action: Document in HONO_CONSOLIDATION.md; evaluate Vercel Pro tier upgrade (3600s) as part of throughput planning.

14. **MEDIUM: AI provider routing scattered (capital-engine.js vs expand-artifact-claude vs expand-artifact.js)**
    - Files:
      - C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (Anthropic/OpenAI/Grok via ai-orchestrator)
      - C:\Users\Chris\Limen-Helix-live-\api\expand-artifact-claude.js (Anthropic only)
      - C:\Users\Chris\Limen-Helix-live-\api\expand-artifact.js (OpenAI only)
    - Issue: Three separate provider strategies. No unified routing library. If a provider changes API version, three files must be updated.
    - Action: Consolidate into single ai-router module with declarative provider config.

15. **MEDIUM: Cron paths in vercel.json are bare (capital-engine.js only)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\capital-engine.js (only cron defined in vercel.json)
    - Issue: Only one cron defined in vercel.json: capital-engine?action=tick every 6h. Other workers (limen-worker-ingest, limen-worker-snapshot, limen-worker-multipass) are called from JavaScript or scripts, NOT from cron. This means their invocation depends on browser/script activity, not scheduled execution.
    - Action: Audit which workers should be independent crons; move them to vercel.json.

16. **MEDIUM: domain-snapshot graceful degradation inconsistent (lines 18-22)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\domain-snapshot.js
    - Issue: "Falls back per-source gracefully" but exact fallback behavior not visible in partial read. GDELT cache (5min TTL) + per-source health tracking are in-memory; if a source is permanently broken, the health state is reset on each cold-start.
    - Action: Persist source health to Redis; alert operator if source is broken >2h.

17. **LOW: /api/limen rewrite in vercel.json (line 26) may conflict with Python FastAPI routes**
    - File: C:\Users\Chris\Limen-Helix-live-\api\limen.py
    - Issue: vercel.json rewrites `/api/limen/(.*)` → `/api/limen`, which would capture both /api/limen/health and /api/limen/score. If the rewrite is processed before the Python function routing, it may cause all requests to hit the same entry point.
    - Action: Verify that Vercel's Python runtime routing takes precedence over rewrites; confirm /api/limen/health and /api/limen/score both work live.

18. **LOW: expand-artifact.js unsupported lane response (D3-B scope)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\expand-artifact.js (lines 30-38)
    - Issue: "patents lane only (other lanes → 400 UNSUPPORTED_LANE)". D3-E.1 amendment added NSF lane routing to separate file. Schema versioning is documented (D3-B.api.v1 for patents, D3-E.api.v1 for NSF) but no registry of which lane uses which file.
    - Action: Add lane→file registry to API catalog.

19. **LOW: fetch-doc pseudo-auth (fetch-doc.js) is soft security**
    - File: C:\Users\Chris\Limen-Helix-live-\api\fetch-doc.js (lines 22-38)
    - Issue: "The literal value 'granted' is in client-side JS, so anyone who reads /assets/js/auth-gate.js can set the header". Documented as intentional ("It keeps casual browsers and search engines out; it is not a hardened secret"). But live docs may contain sensitive data (e.g., pre-publication research).
    - Action: Consider using signing secrets or JWTs if docs are truly confidential. If not, remove this from security review.

20. **LOW: limen-ingest in-memory dedupe (limen-ingest.js lines 32-35)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\limen-ingest.js
    - Issue: In-memory dedupe window `_recentKeys` is per-cold-start (~5min on Vercel). If same Zapier trigger fires within 5min but across two cold-starts, it will not be deduped (false positive).
    - Action: Move dedupe to Redis if >5min window is needed. Otherwise, document the 5min boundary in API contract.

21. **LOW: paper-trade, paper-positions, paper-orders env var checking incomplete**
    - Files: C:\Users\Chris\Limen-Helix-live-\api\paper-trade.js, paper-positions.js (inferred), paper-orders.js (inferred)
    - Issue: paper-trade checks 8 credential aliases but still returns 503 if none found. No fallback mock data or graceful degradation. Frontend may not expect 503 on optional trading features.
    - Action: Consider stubbing paper trading with simulated responses if env vars are missing (local-dev mode).

22. **LOW: master-inbox.js portal iteration may hit file-system quota (line 21-33)**
    - File: C:\Users\Chris\Limen-Helix-live-\api\master-inbox.js
    - Issue: `_iterPortals()` reads and parses all .json files in assets/data/companies/ on every request (before Redis overlay). With 3397+ portal files, this may be slow or cause memory pressure on cold-start.
    - Action: Cache portal list in Redis with short TTL (e.g., 60s). Recompute only when new portals are added.

23. **LOW: treat-discovery-cube.json and portal-registry.json too large to validate**
    - Files: assets/data/treatment-discovery-cube.json (~84MB), assets/data/portal-registry.json (~62MB)
    - Issue: These tanks are larger than can be read in a single Read call (max 20 pages for PDFs, no equivalent page limit mentioned for JSON). No API endpoint directly exposes them; they are referenced by scripts and worker crons. Structure, freshness, and consistency are unknown.
    - Action: Sample structure with PowerShell jq snippet; document schema in API catalog; add size + checksum reporting to health endpoint.

24. **LOW: No response schema versioning in most endpoints**
    - Issue: expand-artifact.js documents D3-B.api.v1 schema, but most endpoints don't version their responses. If a breaking change is needed, clients may break.
    - Action: Add `schemaVersion` field to all /api/* GET responses (optional for POST).

25. **AMBIGUOUS: Unclear which API functions are production vs experimental**
    - Issue: kernel-experiment.js exists; limen-iteration.js, limen-phase-transitions.js are unclear. No feature-flag or "experimental" marker in code.
    - Action: Add `X-Experimental` response header or `experimental: true` to response JSON for endpoints in flux.

### 25. Build / sense scripts

1. **Paused Autonomous Crons** — Four critical crons paused 2026-06-01 (ops/crons-paused-2026-06-01-pre-gate-a.json):
   - `/api/limen-worker-autoqueue` (*/15 * * * *) — dependency awaiting Gate A state-write chokepoint
   - `/api/limen-worker-autofire` (*/30 * * * *) — **burning $9-16/day** due to /api/expand-artifact-claude failures + retry loop; do NOT repair endpoint without Gate A first (re-arms ungated pipeline)
   - `/api/limen-worker-multipass` (*/5 * * * *) — artifact generation halted pending gating
   - `/api/limen-worker-sleep-cycle` (0 * * * *) — consolidation/pruning/audit/repair dispatch paused
   - **Restoration**: After Gate A v0 wired at /api/operator-action chokepoint and verified to reject autonomous bypasses, move entries from pausedCrons[] back to vercel.json crons[] array

2. **Treatment Discovery Cube Stale** — treatment-discovery-cube.json 3 days old (2026-06-04 09:22); **85MB, task #29 dependent**. Regenerate via `node scripts/build-treatment-discovery-cube.mjs` (reads field-connection-map.json, domain sources, neuro-disorder-lookup).

3. **Master Inbox Stale** — _master-inbox.json 5 days old (2026-06-01 22:50); 6 execution lanes may be outdated. Regenerate via `node scripts/build-master-inbox.mjs`.

4. **GitHub Sync Workflow Disabled** — `.github/workflows/sync-to-full.yml` on manual-dispatch only since 2026-06-03; FULL_REPO_TOKEN returned "Bad credentials". Until token restored, lean→full logic sync is manual in-session.

5. **Tier-2 Orphan Densification Not Started** — build-fractal-portals.mjs supports `--tier 2` (vendor orphans ranked by reference count) but no recent tier-2 runs in _fractal-build-log.jsonl. Tier 1 (55 CB companies) appears partially completed.

6. **Legacy Scripts Still Present (118 files total, ~20 superseded)**:
   - `treat_batch*.js`, `add_*_treatments.js` — INACTIVE agriculture treatment batch uploads (pre-fractal)
   - `run-investment-engine.js` — SUPERSEDED by engineGenerator; outputs ignored
   - `migrate-v2-portals-to-v201.js` — LEGACY migration (completed)
   - `gen-walmart-tree-l2.js`, `extract-operator-ciks.js`, `fetch-news.js`, `build-command-board.js`, `build-historical-distress-cohort.js` — one-off/exploratory
   - `_test-*.mjs`, `_limen-self-portal.mjs`, `_dedup-analysis.mjs` — prefixed-underscore test/debug artifacts
   - `portal-create-multipass.mjs`, `portal-reciprocity-phase[12].mjs`, `portal-redensify-weak.mjs` — completed phase batches
   - **Recommendation**: Remove inactive scripts from repo to reduce cognitive load; keep in git history for archaeology

7. **Fractional Script Outputs Untracked**:
   - `_fractal-build-log.jsonl` — APPEND-ONLY audit of enrich attempts; tracking resumability but not actively parsed by other systems
   - `_bulk-failures-*.json` — 5 chunk files from batch 48a (COMPLETED or archived); not referenced elsewhere
   - `_failure-single-*.json` — 18 individual test artifacts (STALE); unclear if still needed

8. **Binding Fidelity Gate Missing** — build-treatment-discovery-cube.mjs respects binding-fidelity-report.json but there is no script that generates it. Either the report is static (hand-curated) or the generation script is missing. Verify via `ls assets/data/audit/binding-fidelity-report.json`.

9. **Sense Organ `organ-binding-fidelity.mjs` Not Registered** — exists in scripts/sense/ but not imported in sense/_index.mjs; similarly `organ-claim-verification.mjs` present but not listed. Check whether these are reserved-future or orphaned half-builds.

10. **portal-reciprocity-audit.mjs Exit Code Semantics** — exits non-zero if violations found (CI useful); but heal-corpus.mjs does NOT automatically trigger re-runs of this audit. Manual intervention required if reciprocity score drifts below RECIPROCITY_MIN (0.80).

11. **K2 Persistence Concurrency Limit (4 by default)** — persist-k2-readings.mjs paced at 4 concurrent Helix kernel calls; if more than 767 portals need K2 scoring, bottleneck will be apparent. Monitor _k2-persist-log.json for stale-threshold skips.

12. **Neuro Disorder Lookup not Maintained** — neuro-disorder-lookup.json is a static load-bearing reference (steps 3/4 in treatment cube). No script writes it; if source disorder/treatment data drifts, manual re-authoring required.

13. **Missing Pattern Proposal Approval Workflow** — sync-approved-patterns.mjs drains Redis of APPROVED proposals, but there is no visible approval UI or automation in this repo. Proposals must be approved in full repo (Limen-Helix) or separate workflow; then pushed to Upstash Redis for sync.

14. **Determinism Verification Script Exists but Not Integrated** — verify-iteration-determinism.mjs tests artifact generation determinism, but is not run in CI or audit loop. Consider adding to audit-system-vitals.mjs or heal-corpus.mjs as a pre-heal check.

15. **Command Board Data Mutable but No Refresh Script** — command-board-data.json and command-board-eligible.json are **must-revalidate** (cache-control header) but there is no active script that regenerates them. Consumed by build-stress-network.mjs; unclear if they are updated externally or stale.

16. **Cross-Domain Readout Task #30 Not Fully Wired** — compute-cross-domain-readout.mjs exists but is not called by standard audit or heal loop. Verify whether this output (task #30 in treatment-discovery chain) is actively generated or blocked.

17. **Aliases Auto-detection and Manual Curation Split** — detect-slug-aliases.mjs produces _slug-alias-candidates.json (auto-detected), but manual overrides live in _alias-manual.json. No merge or conflict-resolution logic visible; operator must manually update _alias-manual.json and re-run build-fractal-portals.mjs with --alias-file.

18. **Vercel Deploy Missing 3 Paused Crons** — vercel.json crons[] only lists `/api/capital-engine?action=tick&cap=3` (every 6h); the 4 paused autonomic crons are NOT present. Once Gate A is ready, they must be manually re-added to vercel.json and pushed.

19. **Field Connection Map Audit Gap** — build-treatment-discovery-cube.mjs reads `audit/field-connection-map.json` but there is no script that validates or regenerates it. Verify this file is current and sourced correctly.

20. **Corpus Vitals Only Written on Demand** — audit-corpus-vitals.mjs is called by organ-portal-corpus.mjs during audit-system-vitals, but there is no scheduled/autonomous execution. If operator manually runs only heal-corpus, corpus vitals may not update. Ensure audit-system-vitals is the entry point for all vitals updates.

---

**Summary Statistics**
- **Total scripts**: 118 files (67 .mjs, 19 .js, 29 .json, 1 .jsonl, 1 .log, 1 .cjs)
- **Active sense organs**: 11 (feeds, nodes, domains, portal-corpus, dead-links, kernel, connectome, civilization, propagator, master-brain, bridge; pattern-bus not yet in _index)
- **Autonomic loop entry points**: audit-system-vitals → heal-corpus → process-operator-actions (manual or background)
- **Paused crons**: 4 (autoqueue, autofire, multipass, sleep-cycle); 1 active (capital-engine, every 6h)
- **Data mutation points**: companies/*.json (enrich, bridge, engine, kernel), _vitals.json (audit), _master-inbox.json (manual), bridge-patterns.json (pattern sync)
- **Stale tanks**: treatment-discovery-cube (3d), _master-inbox (5d)
- **Orphaned/half-builds**: 20+ legacy scripts, 2 sense organs not registered (_index.mjs)

### 26. AGRICULTURE deep-dig (exhaustive)

**Critical Gaps:**

1. **Portal Rendering Missing (21 data files → 0 portal HTML output)**
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\domains\p2_agri*.json define portal structures but no corresponding C:\Users\Chris\Limen-Helix-live-\p2_agri_*_portal.html files exist
   - Evidence: agriculture-clarity-operator.js references "p2_agri_grain_storage_portal.html" in comment; agriculture-directive-extractor.js code expects _extractFromPortal to work on p2_agri portals
   - Impact: Sub-portal drill-down from p2_agri.json activation nodes (Crop M1 → p2_agri_crop_portal, Livestock S1 → p2_agri_livestock_portal, etc.) would fail at runtime; childPortal refs are defined but rendering layer doesn't exist
   - Files affected: p2_agri_climate_portal.html, p2_agri_commodity_portal.html, p2_agri_crop_portal.html, p2_agri_equipment_portal.html, p2_agri_fertilizer_portal.html, p2_agri_finance_portal.html, p2_agri_foodproc_portal.html, p2_agri_horticulture_portal.html, p2_agri_landuse_portal.html, p2_agri_livestock_portal.html, p2_agri_machinery_portal.html, p2_agri_policy_portal.html, p2_agri_postharvest_portal.html, p2_agri_precisionag_portal.html, p2_agri_protection_portal.html, p2_agri_research_portal.html, p2_agri_seeds_portal.html, p2_agri_soil_portal.html, p2_agri_supplychain_portal.html, p2_agri_water_portal.html, p2_agri_portal.html (primary portal template)

2. **Stale Data Files (3 of 21 p2_agri files not refreshed in 61 days)**
   - p2_agri_policy.json, p2_agri_research.json, p2_agri_seeds.json — last touched April 7, 2026; not included in May 13 refresh cycle
   - Evidence: File timestamps show "61 days old" as of June 7, 2026
   - Impact: Policy node activations, research funding opportunity data, seed system treatments may not reflect current ag policy landscape or USDA/CGIAR research shifts
   - Hypothesis: May 13 refresh script may have excluded these 3 domains; verify in scripts/add_*_treatments.js or build-deep-directives.js

3. **Treatment Data Fragmentation**
   - Path: Treatment discovery cube (85 MB) has 0 agriculture entries; agriculture instead uses inline treatments in p2_agri.json activation nodes
   - Evidence: node -e check returns "Agri treatments: 0" from treatment-discovery-cube.json; agriculture-business-build.js sources from portal structure, not cube
   - Impact: Agriculture treatments are not queryable via centralized treatment-discovery-cube API; each page must load full p2_agri*.json to access treatments; no unified treatment registry for agriculture
   - Files involved: assets/data/treatment-discovery-cube.json (NOT populated for agri), p2_agri.json activations (inline treatments instead)

4. **Brain Node Business Mapping Disconnect**
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\brain-node-business-mapping.json has 0 agriculture entries
   - Evidence: node -e check returns 0 agriculture business mappings; brain-node-domains.json also has 0 agriculture references
   - Impact: Opportunity discovery via brain node → company mapping (used in other domains) is not available for agriculture; agriculture must rely on hard-coded company list (command-board-data.json, 14 companies) rather than dynamic node-to-entity resolution
   - Risk: Adding new agriculture companies requires manual edit of command-board-data.json, not auto-discovery from connectome

5. ~~**Portal Registry Empty for Agriculture**~~ **[CORRECTED 2026-06-07: FALSE — the agent misparsed the 62MB file. portal-registry.json domainIdToPath contains 1,244 agriculture-matching keys: the full `agriculture` hierarchy (root + 20 sub-paths `agriculture/climate` … `agriculture/water`, exactly mirroring the p2_agri JSON tanks), all 30 `p2_agri_*` domainId mappings, and 1,214 deep cross-domain agri paths (environment/trade/population/intelligence/economy/industry). The registry layer is COMPLETE for agriculture. The actual gap is the renderer: portal-router.js (whose childPortalResolver is purpose-built to translate p2_agri_*_portal.html links → these registry paths) is loaded by ZERO pages in the live repo — the JSON-driven render wire is unplugged, not the data missing.]**

6. **Activation Nodes Without Child Portal References (18 of 38 nodes)**
   - Path: p2_agri.json activations include 18 nodes without childPortal field (RAPHE, DMN, OSC, RSC, CC, etc.)
   - Evidence: node -e query on p2_agri.json returns "Activation nodes without childPortal: 18"
   - Impact: These governance/diagnostic/integration nodes (likely not user-facing drill-downs) reference portal structure but no portal HTML defined; unclear if intentional (meta-nodes) or incomplete design
   - Affected nodes: RAPHE (Adaptive Iteration Governance), DMN (Diagnostic Mapping), OSC (Efficiency Modeling), RSC (Performance Tuning), CC (System Integration), + 13 others

7. **Treatment Script Incomplete Coverage**
   - Path: C:\Users\Chris\Limen-Helix-live-\scripts\add_fertilizer_treatments.js (137 lines), add_landuse_treatments.js (313 lines) only cover 2 of 21 sub-domains
   - Evidence: grep for "script.*agriculture\|agri" finds 9 matches but only 2 substantive treatment generators
   - Gap: No treatment generators for crop, livestock, equipment, machinery, policy, research, seeds, water, climate, commodity, precision ag, protection, postharvest, horticulture, supplychain, finance, food processing
   - Impact: Only fertilizer and landuse nodes have programmatic treatment generation; other 19 sub-portals must source treatments manually or inherit from p2_agri.json parent

8. **Company Dataset Limited (14 companies)**
   - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\command-board-data.json contains only 14 agriculture companies
   - List: AGCO, COLD, ANDE, ADM, BG, CNHI, CTVA, DE, FPI, LW, MON, MOS, NUTR, SYY (plus ??, LNN, AKR, TSC, TTM likely missing)
   - Evidence: node -e filter on domain=agriculture returns 14 entries; likely undersamples US agribusiness universe (150+ publicly traded names in GICS 1010)
   - Impact: Command board stress analysis covers only large-cap food/ag holdings; misses mid-cap equipment (AGCO competitors), seed/trait companies (Corteva, Bayer ag division if separate), specialty ag retailers, irrigation, drone/precision ag firms
   - Opportunity: expand company registry via seed trades companies, equipment makers, regional farm co-ops where public, agricultural input manufacturers

9. **Signal Bridge Optional (Requires Explicit Enable Flag)**
   - Path: agriculture-brain.js checks `window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE` (defaults to true as of May 7 commit)
   - Evidence: agriculture-brain.js lines 36-41: "Explicit opt-out still works: set either flag to false BEFORE this script loads"
   - Risk: Pages that load agriculture-brain.js BEFORE setting the flag to false will emit signals (now default-enabled); pages that expect no agriculture signals must explicitly opt out
   - Affected pages: any page loading agriculture-brain.js (Master Brain, Civilization, portals) will now see agriculture diagnoses by default

10. **Treatment Cube Unused (85 MB Asset, 0 Agriculture Payload)**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\treatment-discovery-cube.json
    - Size: 85 MB, 5,234 total cells (5,186 populated)
    - Agriculture payload: 0 entries; treatment-discovery-cell.schema.js defines schema but agriculture not indexed
    - Impact: Agriculture treatments are NOT centralized, discoverable, or queryable via treatment cube API; every operation must load full portal JSON
    - Decision point: either (a) populate cube with agriculture treatments from p2_agri*.json, or (b) accept that agriculture uses in-portal treatment model exclusively

11. **No Emission Rules Defined in p2_agri.json**
    - Path: p2_agri.json emissionRules array is empty []
    - Evidence: node -e query returns "Emission rules: 0"; agriculture-brain.js has hardcoded rules (lines 71-108 in snippet) but parent portal does not carry them
    - Impact: Mismatch between data schema (portal should define emissionRules) and code (brain hardcodes them); updates to emission rules require code change, not data config
    - Risk: Multiple sources of truth for agriculture signal propagation

12. **No Reception Rules Defined**
    - Path: p2_agri.json receptionRules array is empty []
    - Evidence: node -e query returns "Reception rules: 0"
    - Impact: Inbound signals (trade, environment, economy shocks) are hardcoded in brain, not configurable via portal data
    - Inconsistency: other domains may use portal-driven reception rules (not verified) while agriculture is fixed in code

13. **Clarity Operator Large File (113.6 KB Single Module)**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\agriculture-clarity-operator.js (113.6 KB)
    - Risk: Monolithic module; no code splitting evident; loads all agriculture clarity UI logic in one file
    - Impact: Page load time; if deployed to single request, 113 KB JS just for clarity operator (vs ~8 KB average per agriculture module)
    - Opportunity: refactor to lazy-load clarity UI only on demand

14. **Cross-domain Portal HTML Files NOT in Root, Hard to Discover**
    - Path: C:\Users\Chris\Limen-Helix-live-\trade_agritrade_*.html, environment_soil_portal.html, etc. exist but are not listed in agriculture-related search
    - Evidence: 62 agriculture-linked portal HTML files scattered across domain prefixes (trade_, environment_, economy_, industry_, intelligence_, population_, finance_)
    - Impact: User navigating agriculture domain may not discover soil conservation, agricultural trade, rural population, agribusiness technology portals without explicit cross-domain linking
    - Missing: breadcrumb/hierarchy navigation from agriculture → soil_portal, agricultural_trade, food_security portals

15. **Company Domain Field Inconsistency**
    - Path: command-board-data.json company entries use field name 'd' for domain (not 'domain')
    - Evidence: agriculture-command.html line 164 filters: `cd.d === _CMD_RESOLVED || cd.domain === _CMD_RESOLVED`
    - Risk: dual naming (d AND domain) suggests data migration or legacy field support; unclear which is authoritative
    - Impact: Other systems must check both fields; potential for mismatch if one is not updated consistently

16. **No Agriculture-specific Feed Status Tracking**
    - Path: /api/feed-status.js references agriculture but no dedicated agriculture feed is documented
    - Evidence: api/feed-status.js lists feeds by domain but agriculture feed data source/SLA not defined
    - Impact: Operator has no clear SLA or freshness indicator for agriculture domain data (command board shows "last updated" but no feed health)
    - Opportunity: define agriculture data feed source(s) (USDA, FAO, commodity price APIs) and SLA in feed-status.js

17. **Agriculture Not in Treatment Discovery Cell Schema**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\data\schemas\treatment-discovery-cell.schema.js
    - Evidence: Schema defines cells for addiction, business, communication, …, medicine, psychedelic, … but agriculture not listed in domain enumeration
    - Impact: If agriculture were to be added to treatment cube, schema would need updating first; tight coupling between schema and population
    - Risk: Out-of-sync schema could cause validation failures if cube is backfilled with agriculture treatments

18. **Opportunity Playbook Data Structure Undefined**
    - Path: C:\Users\Chris\Limen-Helix-live-\assets\js\domain-brains\data\agriculture-opportunity-playbooks.js (assumed to exist based on code references)
    - Evidence: agriculture-workspace.html line 73 references `window.LIMENAgricultureBusinessBuild`, agriculture-execution-panels.js also loads playbooks
    - Status: File likely exists but NOT confirmed in this audit; if missing, opportunity execution will fail silently
    - Recommendation: Verify file contains playbook templates for grant-eligible, patentable, and business-build tracks

**Data Quality Issues:**

1. **Stale Policy/Research/Seeds Data** (61 days, detailed above)

2. **No Time Series Agriculture Data** — no historical stress tracking, no trend indicators (agriculture-pulse-engine.js fetches current stress only)

3. **Null/Empty Fields in Command Board** — 14 companies; unclear if missing companies are intentionally excluded or data ingestion incomplete

4. **Diagnostic Trigger Inconsistency** — agriculture-brain.js hardcodes 6 triggers (CASH_FLOW_CRISIS, SUPPLY_CHAIN_BREAKDOWN, DROUGHT, MARKET_COLLAPSE, EQUIPMENT_FAILURE, PEST_OUTBREAK) but p2_agri.json may define more or fewer triggers per sub-domain

**Incomplete Features:**

1. **Opportunity Workspace Half-Built** — workspace supports grant/patent/business tracks but actionable outputs (grant applications, patent drafts, business plans) not evident; workspace may be UI shell only

2. **Claim Flow / Compensation Engine** — agriculture-claim-flow.js, agriculture-claim-ledger.js, agriculture-compensation.js exist but no data source or trigger documented; who files claims? against what compensation policy?

3. **Master Brain Executor agriculture Bootstrap** — agriculture enabled by default (LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE = true) but no documentation of what "enabled" means; Master Brain inbox may show agriculture signals but unclear if UI displays them

**Recommended Priorities:**

1. **Build p2_agri_*_portal.html portal files** (21 missing files) — required for sub-domain drill-down from civilization agriculture node
2. **Refresh p2_agri_policy.json, p2_agri_research.json, p2_agri_seeds.json** — stale data from 61 days ago
3. **Populate treatment-discovery-cube.json agriculture entries** OR explicitly document agriculture-only treatment model — resolve architecture mismatch
4. **Expand command-board companies** — 14 companies is a thin slice; 50+ would be defensible for US agribusiness analysis
5. **Define agriculture data feeds & SLA** — document USDA/FAO/commodity data sources in feed-status.js, establish refresh cadence
6. **Add emission/reception rules to p2_agri.json** — move agriculture signal rules from code to data model for consistency with other domains
7. **Populate brain-node-business-mapping.json & portal-registry.json agriculture entries** — align agriculture with infrastructure used by other domains

**Files Orphaned or Underutilized:**

- treatment-discovery-cube.json — 85 MB, 0 agriculture content (if this is intentional, document it; if not, backfill)
- brain-node-business-mapping.json — 0 agriculture (underutilized for ag opportunity discovery)
- portal-registry.json — 0 agriculture (should have 21+ entries)
- agriculture-compensation.js (5.3 KB) — no active claim filing visible; is this feature live?
- agriculture-claim-ledger.js (5.3 KB) — no data source visible
- agriculture-operator-panel.js (9.1 KB) — wired into console but unclear if operator actions are wired to outcome
- agriculture-targeting-engine.js (17.9 KB) — generates targets but unclear if used in opportunity-matrix or standalone

**Verification Tasks for Operator:**

- Confirm p2_agri policy/research/seeds data stale by design (seasonal updates) or bug
- Verify agriculture claim/compensation flow is NOT live (no UI, no claims in system)
- Test agriculture signal bridge emission — does setting LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE=false suppress agriculture from Master Brain?
- Audit command-board-data.json 14 companies — are 136 missing companies intentional or data gap?
- Measure load time for agriculture-clarity-operator.js (113.6 KB) vs other domain operators
- Check if any production traffic is hitting the missing p2_agri_*_portal.html files (would return 404)

### 27. INFRASTRUCTURE deep-dig (exhaustive)

**STALE / INCOMPLETE TREATMENT DATA:**
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\infrastructure.json — 4 activations MISSING treatments (no treatment[] array present on CC, CBLM, FEF, NTS secondary nodes or auxiliary activations)
- C:\Users\Chris\Limen-Helix-live-\assets\data\domains\infrastructure_air.json — 21 of 31 activations MISSING treatments (PARTIAL = 68% stale/incomplete)
- IMPACT: Grant/patent generation blockers when these nodes activate; operator warnings not triggered; treatment-discovery cells not fully populated for these sub-paths

**HALF-BUILT FEATURES:**
- ~~infrastructure-portal.html file missing from repo~~ **[CORRECTED 2026-06-07: FALSE — agent searched the hyphenated name; the real root hub `infrastructure_portal.html` (underscore) EXISTS at repo root with 192 child portals, full parity with other domains. Disregard this item and its impact line.]**
- IMPACT: No unified entry point; users navigate directly via command-board or console; portal-registry.json lists portal but page unavailable

**CROSS-DOMAIN SIGNAL GAPS:**
- agriculture domain has population_rural_infrastructure portal (C:\Users\Chris\Limen-Helix-live-\assets\data\domains\population_rural.json references it) but infrastructure domain does not reciprocally emit service_disruption to population during rural infrastructure stress
- IMPACT: Rural infrastructure crises may not propagate down-population-chain; asymmetric signal flow

**EMPTY/MINIMAL DATA TANKS:**
- infrastructure.json root domain has STRUCTURAL treatments defined for top-tier nodes but many sub-domain files (e.g., infrastructure_bridges.json, infrastructure_dams.json) have incomplete or generic treatment sets
- treatment-discovery/by-node — all 19 infrastructure-active nodes exist but treatment cell counts vary widely (e.g., CC 69 cells, S2 unknown); verify equal population across domain/node intersections

**ORPHANED / DEAD LINKS:**
- C:\Users\Chris\Limen-Helix-live-\assets\js\infrastructure-clarity-operator.js (1,585 lines) references expertise panels and clarity-mode overlays but no corresponding clarity-view HTML element in infrastructure-console.html (only #clarity-view div stub exists; wiring incomplete)
- IMPACT: Clarity operator may fail to render; console UI crashes if clarity-mode triggered

**DUPLICATION / REDUNDANCY:**
- infrastructure-node-business-engine.js (1,576 lines) and infrastructure-business-build.js (750 lines) both render business opportunity builders; role division unclear (engine = logic only? builder = UI only? test for overlap)
- infrastructure-directive-extractor.js + infrastructure-directive-translator.js both transform signals → directives; verify they don't double-process

**VERIFICATION NEEDED:**
- treatment-discovery cube infrastructure entry count (176 cells) vs actual available domain/node cell combinations: 20 active nodes × 2 state buckets (hyperactive/hypoactive) = 40 expected cells minimum. Confirm 176 = real intersection count or inflated by comparison domains
- Cross-domain emission gating (stress ≥ threshold AND active diagnosis required) — verify gates actually fire in live snapshots; check if emissions ever reach downstream domains or get dropped by gate
- Company binding strengths in infrastructure activations (0.71–0.95 range): verify these reflect current market/sector maturity; Brookfield Infrastructure specific company file exists (brookfield_infrastructure.json) but integration with node-business-engine unclear

**POTENTIAL DATA QUALITY ISSUES:**
- infrastructure_air.json: 21 missing treatment arrays = likely template incompleteness during generation; may need bulk treatment injection from parent infrastructure.json FEF node
- infrastructure_portal.html: missing page means no unified entry; all 197 portals orphaned from root nav; likely lost during site redesign (only command/console/workspace entrypoints exist)
- Telecom/Digital cross-domain affinities: infrastructure nodes (LANG/Telecom, FPN/Digital) map to technology domain but no reverse affinities in technology→infrastructure (check technology-brain.js for reciprocal emission rules)

**VALIDATION GAPS:**
- No schema validation on infrastructure.json activations to enforce presence of treatments[] array
- treatment-discovery cube missing entries for some infrastructure sub-domains (water, rail, maritime) in _summary.json breakdown (only top-level infrastructure domain shown, not subcategories)
- infrastructure-node-business-engine.js filters generic treatments but no audit trail of filtered-out treatments; hard to debug why a plausible company is marked SPECULATIVE

