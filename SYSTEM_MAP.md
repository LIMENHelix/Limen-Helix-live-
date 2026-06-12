# LIMEN Helix — System Map (the whole thing, one page)

_Generated 2026-06-04 from a full-codebase sweep. Purpose: see the edges of the system, separate the solid core from the sprawled periphery, and define the consolidation target._

## TL;DR
**A solid cognitive core wrapped in a sprawled periphery.** The 5-stage brain + the autonomic data pipeline are real, wired, and good. Around them: **6–7 redundant document generators, ~3,400 HTML files (most auto-generated), two Artifact Council UIs, an unrelated product's pages, ~70 scripts (many one-off), and two empty data tanks.** The fix is consolidation, not a rewrite — keep the core, funnel the periphery.

---

## LAYER 1 — The cognitive spine  ✅ KEEP (this is the good part)
Same loop, fractal across scales. All live except the gate (dark-armed).

| Stage | Files | Status |
|---|---|---|
| 1 Local processing — 20 domain brains | `domain-brains/*-brain.js` | LIVE |
| 2 Salience gate — observer, inter-brain-bus, cross-domain | `observer-node.js`, `inter-brain-bus.js`, `cross-domain-detector.js` | LIVE |
| 3 Global workspace — one unified mode | `global-state-engine.js` | LIVE |
| 4 Action selection (basal ganglia, K3 veto) | `action-selection-gate.js` | DARK-armed (observe-only; never executes) |
| 5 Executive/memory + K3 | `decision-memory.js`, `master-brain/decision-engine.js`, `epistemic-state.js` | LIVE (master brain = on-demand oracle) |

K3 four-state (proven/unproven/unknown/impossible) lives in `epistemic-state.js`; nothing is ever deleted for being unproven.

---

## LAYER 2 — The autonomic pipeline  ✅ KEEP
- **Vercel crons (FULL project):** worker-ingest/snapshot/stress (workers), trigger-pattern-author, cron-rebuild-engine-outputs, cron-repair-held. (Lean runs NO crons now — deduped 2026-06-04.)
- **Worker endpoints:** ingest, snapshot, autoqueue, **autofire** (autonomous single-call artifact gen, investment/research only, $20/day cap — *this is a 7th doc generator*), stress-refresh, sleep-cycle, multipass (manual).
- **GitHub immune cron:** vitals audit + heal + portal-regen + commit (deduped to its unique role).
- **Redis (one shared Upstash, ~15MB):** `limen:eo:*`, `limen:pattern-proposals`, autofire budgets/dedupe/audit. Chunked MGET (50/req).

---

## LAYER 3 — Data / assets  ✅ KEEP — but 2 empty tanks 🪫
- **767 company portals** (`companies/*.json`) + **3,710 domain templates** (`domains/*.json`, 4-level hierarchy). Bridge library (`bridge-patterns.json`) = the IP/moat. TD cube (just rebuilt: 5,234 cells).
- **EMPTY TANK 1 — neuro treatments:** `neuro-disorder-lookup.json` = 187 nodes, 180 have disorders, **only 13 have treatments (47 total)**. Caps cross-domain discovery.
- **EMPTY TANK 2 — artifact source index:** `assets/data/artifact-source-index/` **does not exist** → finalized docs render structure with placeholder content, not deep evidence.
- **Likely EMPTY TANK 3:** `connectome/node-entity-mappings.json` (feeds Research Observatory: node-visibility-gaps, cross-domain-clusters, biological-institution-gaps, institutional-biological-hypothesis) — may be missing/empty → those clarity panels are scaffold.
- **Cruft:** `intelligenceCycle` stored per-portal ≈ ~700KB of near-duplicate template text; 461/767 portals carry `[PLACEHOLDER]` contamination in engineOutputs (Gate B detects, suppression partial).

---

## LAYER 4 — Document generation  🔻 CONSOLIDATE (6–7 → 1 funnel)
The integrated multi-AI funnel **already exists in pieces** — just scattered and redundant.

| # | System | File | Type / AI | Feeds |
|---|---|---|---|---|
| 1 | Engine-output generator | `api/lib/engine-output-generator.js` | deterministic skeleton (6 lanes) | master-inbox, My Documents |
| 2 | Long-form generator | `api/lib/long-form-generator.js` (`/api/print-document`) | **Claude** full doc | My Documents |
| 3 | Print-from-pattern | `api/print-from-pattern.js` | **Claude** (same job as #2) | Pattern Proposals |
| 4 | Expand-artifact-claude | `api/expand-artifact-claude.js` | **Claude** multi-pass sections | Artifact Council |
| 5 | Critique-artifact | `api/critique-artifact.js` | **Grok** objection ledger | Artifact Council |
| 6 | Finalize-artifact | `api/finalize-artifact.js` | **OpenAI** polish + anti-overclaim | Artifact Council |
| 7 | Worker-autofire | `api/limen-worker-autofire.js` | autonomous single-call | autoqueue |
| + | Client factory/finalizer | `master-brain/artifact-{factory,finalizer}.js` | deterministic scaffold | Artifact Council (master-brain-inbox) |

**Three of these (#2, #3, #4) are redundant Claude drafters** — one per surface. **TWO Artifact Council UIs** exist: civilization Zone-C tab (in-memory, no persistence) AND master-brain-inbox (factory→finalizer scaffold).

**TARGET — one funnel (the cognition cycle, applied to docs):**
`HandoffPacket (opportunity) → deterministic skeleton (#1) → Claude draft (ONE of #2/#3/#4) → Grok critique (#5) → OpenAI finalize (#6) → human review (Artifact Council) → one output surface (My Documents)`. All `executionAllowed:false`; human gate sacred.

---

## LAYER 5 — Surfaces / pages  🔻 CONSOLIDATE + 🗑 DELETE
**~3,394 HTML files total** = 3,284 auto-generated portal pages + ~110 hand-built.

**KEEP (the real surfaces):** index, civilization (cockpit, analyst↔clarity), treatment-discovery, my-documents, pattern-proposals, master-brain / master-brain-inbox / master-brain-executor, vitals, operator-guide, helix-artifacts/helix-artifact, company-lookup.

**CONSOLIDATE:**
- 3,284 `medicine_*`/`communication_*` portal pages clutter root → move to `/portals/` or generate server-side.
- 14 domains × 4 page variants (command/console/opportunities/workspace) = ~56 near-identical pages → one `domain.html?domain=X&view=Y`. (6 domains missing `-console` = half-built.)
- 3 master-brain pages + 2 report pages (`helix-report` vs `limen-report`) → clarify or merge.

**DELETE (dead / unrelated):** `index-original.html` (backup), `kc-guide.html` + `kc-thanks.html` (**unrelated "KC Insider" product**), `phase-observer.html` (demo), `family-law.html` (orphan), `execution-framework.html` / `execution-reports.html` (unclear), `connectome-kernel-adapter.js` (disabled no-op), `console-narrator`/`philemon` (already removed, comments linger).

**Scripts:** ~70 in `scripts/`; ~14 are `_`-prefixed one-off/debug batches → archive.

---

## CONSOLIDATION PLAN (phased, bounded)
- **Phase 0 — fill the tanks (data, low risk):** wire bridge `knownTreatments` into the neuro side; scope+build the artifact source index; confirm node-entity-mappings. *Unblocks doc quality + the Research Observatory.*
- **Phase 1 — one drafter:** route My Documents + Pattern Proposals + Council through a single Claude draft path; retire the 2 duplicates.
- **Phase 2 — one funnel:** chain skeleton → Claude → Grok → OpenAI → human on one path; auto-wire Builder→intake; converge the two Council UIs into one.
- **Phase 3 — one output surface:** My Documents = the funnel's rendered output.
- **Phase 4 — surface cleanup:** delete the dead pages, move portals to `/portals/`, collapse domain variants, archive one-off scripts.

**Doctrine:** keep the core (spine + pipeline + assets), consolidate the periphery. Don't add a generator; remove generators. Human gates (approve/reject, Council review) stay manual. Everything `executionAllowed:false`.
