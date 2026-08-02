# LIMEN HELIX — THE SYSTEM ON ONE PAGE

<!-- AUTHORITY: STALE_OR_CONFLICTED — see DOCUMENT_AUTHORITY.md -->
> **AUTHORITY NOTE, added 2026-08-02.** This distils a 2026-06-07 snapshot into "the only five
> decisions that matter". A dated measurement cannot license a permanent decision frame.
> Orientation only.



> Companion to SYSTEM_MAP_FULL.md (the 9,300-line reference). Read THIS to decide; open the big one only to look up details. Generated 2026-06-07.

## The system in one sentence

**The world sends in signals → a brain-modeled kernel scores stress → it's mapped onto 20 domains and ~800 companies → you see it in cockpits/portals → the Master Brain turns the best findings into money documents (patents, grants, investments) — and you approve everything.**

## The 6 blocks

```
[1 SENSES] → [2 SCORING] → [3 WIRING MAP] → [4 DISPLAY (you look here)]
                  ↓                               ↓
            [5 SCIENCE LIBRARY]            [6 MONEY MACHINE → $$]
```

| # | Block | What it is | What it affects | Health | Full-map sections |
|---|---|---|---|---|---|
| 1 | **SENSES** — feeds/ingestion | 266 data sources pulling the world in | Everything downstream | 🟢 Works (its status gauge under-reports, but the feeds run) | §17 |
| 2 | **SCORING** — Python kernel, stress propagation, autonomic workers | Scores every company/domain P0–P10 | Every alert, portal number, and document | 🔴 **DARK — the root cause.** Missing VALIDATION_LOCK → kernel refuses to score → all 767 portals empty | §4, §14, §21 |
| 3 | **WIRING MAP** — brain nodes, connectome, registries | The diagram connecting brain regions ↔ domains ↔ companies | How signals travel | 🟡 Built; 3 wires unplugged (connectome-weights.json, action-gate listener, portal.html router) | §5, §6, §10, §22 |
| 4 | **DISPLAY** — portals, civilization cockpit, per-domain pages, vitals | The windows you look through | Nothing downstream — it's the glass | 🟡 Structurally complete; shows placeholders BECAUSE #2 is dark | §1, §8, §9, §19, §21, §23 |
| 5 | **SCIENCE LIBRARY** — treatment discovery, remedy, disorders | 66,025 disorder/treatment claims across 113 nodes | Credibility of everything you publish | 🟡 Built; PubMed verification pass (task #33) never ran — all claims sit "UNKNOWN" | §11, §12 |
| 6 | **MONEY MACHINE** — master brain, document lanes, capital engine, paper trading | Findings → documents → revenue | Revenue | 🟡 Pipeline works end-to-end; outputs thin BECAUSE #2 is dark | §13, §15, §16, §18 |

## The one insight

**~80% of the red flags in the full map trace to ONE root cause: Block 2 is dark.** Kernel won't score → portals placeholder → investment artifacts have no numbers → documents thin. Fix the kernel and most of the map turns green on its own. The rest is a handful of unplugged wires and stale files.

## The only 5 decisions that matter

1. **Wire `portal.html`** — copy 1 file (3.6 KB) from the full repo → agriculture + ~123K deep portals render from JSON. *(5 minutes, zero risk. The .vercelignore already documents this as the intended design.)*
2. **Light the kernel** — deploy the validated backtest + VALIDATION_LOCK ("Phase 4") → scores flow, placeholders fill. *(The big one.)*
3. **Run the PubMed verification pass** (task #33) → 66,025 claims get real PROVEN/DISPROVEN verdicts. *(Credibility.)*
4. **Hono consolidation** — collapse ~54 api functions into one app. Ready whenever; §24 of the full map is the blueprint. Doesn't depend on 1–3.
5. **Re-arm the 4 paused crons** — ONLY after Gate A is wired (they were burning $9–16/day broken when paused 2026-06-01).

Everything else in the full map is detail underneath one of these five.

## Facts that look like problems but aren't

- **Agriculture's "missing" portals** — by design: it's the first all-JSON domain (data in 21 tanks + full registry hierarchy). Decision #1 makes it render. Nothing was lost; 205 static pages also still exist in the full repo.
- **Infrastructure root portal "missing"** — audit error; `infrastructure_portal.html` exists with 192 children. Full parity.
- **The 126,338 static portal pages in the full repo** — can never deploy to Vercel (file-count limits). That's WHY the JSON/registry/router architecture exists. Never bulk-sync them.
- **Hono work cannot break any of this** — it only touches /api functions, never HTML or JSON.
