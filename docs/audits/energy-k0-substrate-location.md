# Energy K0 — Substrate Location Audit

**Date:** 2026-06-18  **Probe:** `scripts/_taxonomy-pilot/k0-energy-substrate-location-audit.cjs` (read-only)
**Verdict:** Deep portals are **PRESENT + intentionally EXCLUDED from static deploy + REACHABLE via API.**
The real problem is **admissibility (synthetic content), not access.**

## Live vs full corpus (energy portal JSON by depth)

| Depth | LIVE | FULL | deployed live? |
|---|---|---|---|
| L0 | 1 | 1 | YES (static) |
| L1 | 19 | 19 | YES (static) |
| L2 | 173 | 173 | YES (static) |
| L3 | 0 | 829 | NO — full-only → API fallback |
| L4 | 0 | 7,401 | NO — full-only → API fallback |
| L5 | 0 | 18,485 | NO — full-only → API fallback |
| L6 | 0 | 252 | NO — full-only → API fallback |
| **TOTAL** | **193** | **27,160** | |

L0–L2 are the same shallow set in both repos. **L3–L6 = 26,967 files exist only in the full repo.**

## K0 questions answered

1. **Live energy portal files:** 193 (L0–L2 only).
2. **Full-repo energy portal files:** 27,160 (through L6).
3. **Depths per repo:** live L0–L2; full L0–L6.
4. **Why L3–L6 are absent from live:** **Intentional.** Live `.vercelignore` line 4 excludes
   `assets/data/domains/*_*_*_*.json` (4-segment = L3+), with the comment *"L4+ served via
   /api/fetch-portal fallback."* Combined with the repo split (live is a deliberately lean subset —
   see [[two-repos-full-vs-live]], [[portals-json-by-design-vercel-limit]]), the deep files were never
   copied into the live working tree. Cause = Vercel deploy-size limit + repo split, **not** build
   pruning, asset-cap accident, or data loss.
5. **Registry/index pointing to missing portals:** `portal-registry.json` is *referenced* by
   `.vercelignore` (line 91–92: "deliberately NOT ignored — portal-router.js fetches it as a live
   browser fallback") but is **absent from live `assets/data/`**. The branch index for energy deep
   portals is effectively the filename ancestry + `parentPortal` fields inside each file (K1 reconstructs it).
6. **Deep files present-but-unreachable (missing branch index):** N/A for the API path — `/api/fetch-portal`
   resolves by `domainId` directly, no index needed. A browser branch-index *is* missing, but the API
   does not depend on it.
7. **Deep files in live `assets/data/domains` but unreferenced:** None — they are not in live at all.
8. **Deep files in another repo/path not copied to live:** **Yes — the full repo** (`C:\Users\Chris\
   Limen-Helix`, GitHub `LIMENHelix/Limen-Helix`), where L3–L6 are git-tracked and pushed.

## The access path (already works)

`handlers/fetch-portal.js`: `GET /api/fetch-portal?domainId=<id>` → fetches
`https://api.github.com/repos/LIMENHelix/Limen-Helix/contents/assets/data/domains/<id>.json` →
base64-decode → JSON, cached `s-maxage=3600`. Requires `GITHUB_TOKEN`. Path-traversal guarded.

**Live production test (2026-06-18):**
- `energy_battery_battrecycling_collection` (L3) → **HTTP 200, 103 KB** ✅ reachable
- bogus id → 404 (correct rejection)

So `GITHUB_TOKEN` is set, the full repo is on GitHub with the deep files, and **deep portals are
retrievable in production today.** Access (Problem 1) is solved at the infrastructure level.

## What this means for the K-phase

- **Access (Problem 1): solved.** The retrieval path exists and works. K4's "safe retrieval layer" can
  build on `/api/fetch-portal` rather than inventing one.
- **Admissibility (Problem 2): the real target.** The L3 sample carried `companies: 0, treatments: 5` —
  the same shape that proved 100% mad-lib at L1/L2. Almost certainly most L3–L6 are synthetic too. K2's
  reality classifier (extending the canonical `_portal-real-content-classifier.cjs`) must classify them
  before any are admitted, and the immune/conscience gates must continue to refuse synthetic content.
- The Energy **brain** does not currently call `/api/fetch-portal` for deep portals (it loads L0 + L1
  only, and J1 quarantines L1 treatments). Wiring deep retrieval into the brain is **gated on K2/K3
  certification** — access existing is not permission to traverse.

## No runtime behavior changed

K0 is pure audit. Critical gates unaffected (no runtime file touched); the template-lock gate (which
bundles H7 + J + the 5 critical gates) remains green.

## Next: K1 — Deep Portal Access Map

Reconstruct parent/child ancestry from filenames + `parentPortal` fields across the full substrate;
detect orphans, broken links, duplicated/synthetic branches. Read-only; no admission, no traversal.
