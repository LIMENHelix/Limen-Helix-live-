# Energy K1 — Deep Portal Access Map

**Date:** 2026-06-18  **Probe:** `scripts/_taxonomy-pilot/k1-energy-portal-access-map.cjs` (read-only)
**Map:** `assets/data/deep/energy-portal-access-map.json` (11 KB, compact aggregates — not 27k records)
**Verdict:** The full Energy portal tree is **structurally coherent and fully reachable. Nothing admitted as evidence.**

## Live vs full / depth table

| Depth | LIVE | FULL | status |
|---|---|---|---|
| L0 | 1 | 1 | static (live) |
| L1 | 19 | 19 | static (live) |
| L2 | 173 | 173 | static (live) |
| L3 | 0 | 829 | full-only, API-reachable |
| L4 | 0 | 7,401 | full-only, API-reachable |
| L5 | 0 | 18,485 | full-only, API-reachable |
| L6 | 0 | 252 | full-only, API-reachable |
| **Total** | **193** | **27,160** | |

## Parent/child reconstruction

- **Root:** `energy` (L0). **19 L1 branches**, each with a real `energy_<branch>.json` file and a large subtree
  (energytrade 1,591 · energytrans 1,574 · gridmod 1,573 · … · solar 1,181). Direct children per branch: 8–10.
- **Two parent signals:** filename ancestry (drop last `_`-segment) and the `parentPortal` field. The
  filename ancestry is the **canonical tree**; `parentPortal` is a display label that often points to a
  *higher* ancestor (compound slugs).

## Structural health

| Metric | Value | Meaning |
|---|---|---|
| Orphans (no resolvable parent) | **0** | every node resolves to a parent |
| True broken links | **0** | — |
| Filename-ancestry gaps | 388 (1.4%) | `parentPortal` skips the filename-inferred parent; all resolve to a real ancestor (e.g. `energy_battery_ri_action` → field `energy_battery`, inferred `energy_battery_ri`) — compound slug like `ri`/`dx` is not its own file |
| `parentPortal` mismatches | 388 | same set as above |
| `parentPortal` missing | 0 | every file has the field |
| Duplicate portal ids | **0** | filenames + `domainId` unique |
| **Missing branch roots** | **1 — `energy_carbon`** | a full subtree (`energy_carbon_cap` → … → L6) exists but has **no `energy_carbon.json` L1 file**; not one of the 19 L1 branches |

So the tree is coherent: 0 orphans, 0 duplicates, 0 true broken links. The only true gaps are (1) the
missing `energy_carbon` L1 root, and (2) 388 compound-slug nodes whose `parentPortal` label points above
the filename parent — both navigational notes, neither blocks K2 classification.

## Reachability (proven in production, 2026-06-18)

`/api/fetch-portal?domainId=<id>` → GitHub Contents API → JSON. All depths verified HTTP 200:

| Depth | id | bytes |
|---|---|---|
| L3 | `energy_battery_battrecycling_collection` | 103 KB |
| L4 | `energy_battery_battrecycling_collection_action` | 1 KB |
| L5 | `energy_battery_battrecycling_collection_assess_baselinecali` | 62 KB |
| L6 | `energy_carbon_cap_carbutil_buildmatr_dx_classify` | 800 B |

Marked **reachable, NOT admissible.** Admissibility waits for K2.

## Content characterization per depth (sample — NOT classification)

| Depth | sampled | avg treatments | avg companies | % with companies |
|---|---|---|---|---|
| L0 | 1 | 32 | 57 | 100% |
| L1 | 19 | 122 | 8.9 | 53% |
| L2 | 25 | 89 | 1.4 | 4% |
| L3 | 25 | 39 | **0** | **0%** |
| L4 | 25 | 10 | **0** | **0%** |
| L5 | 25 | 19 | **0** | **0%** |
| L6 | 25 | 2 | **0** | **0%** |

**Strong synthetic signal for K2:** company presence collapses to **0% at L3 and below**, while treatment
counts persist — exactly the "templated treatments, no real entities" shape J1 proved at L1/L2. The deep
substrate is almost certainly synthetic; K2 must classify before any admission. (L4 avg 10 / L6 avg 2
treatments also suggests many deep nodes are thin.)

## Can the access map support K2 classification?

**Yes.** The tree is coherent, every node is reachable, ancestry is reconstructable, and the per-depth
content shape is already visible. K2 can iterate the map (by branch/depth), fetch via `/api/fetch-portal`,
and run the canonical `_portal-real-content-classifier.cjs` on real content — no structural repair needed first.

## Anything to fix before K2?

- **Nothing blocking.** Two notes carried forward: (1) `energy_carbon` lacks an L1 root file — K2/K3 should
  treat its subtree as rooted at `energy_carbon_cap`; (2) the 388 compound-slug ancestry gaps mean K2 should
  use **filename ancestry** (not `parentPortal`) as the canonical edge.

## Constraints honored

Read-only. No runtime/brain/finalizer/kernel change. No bundle creation. No portal admitted as evidence.
No traversal activated. Immune/conscience untouched. Template-lock gate (H7 + J + 5 critical gates) remains green.
