# Taxonomy clone-refactor — finance pilot proof harness

**Status: READ-ONLY PROOF ONLY. No runtime files changed. No shared engine wired in.**

Purpose: prove that the 5 "GREEN" per-domain taxonomy engines can be collapsed into
one shared engine + per-domain data JSON **with zero behavior change**, before any
production refactor. This is the regression gate for the eventual implementation and
for the 20-domain rollout.

## How it works
`lib.cjs` loads the **unmodified OLD** finance files inside a stubbed, fully-pinned
Node `vm` context (Math.random = seeded mulberry32, Date.now/new Date = fixed epoch,
setTimeout/setInterval = no-op, minimal document/localStorage/location stubs). It then:
1. **Extracts** each file's top-level pure-data constants — but ONLY those that
   round-trip losslessly through JSON. Anything containing a regex or function
   (e.g. inline `executionTargets`, the `Math.random` step templates, scrub regex)
   is **left inline as logic**, never moved to data. (Directly answers the
   regex-round-trip risk: such data simply isn't extracted.)
2. Builds an **in-memory prototype** by replacing each extracted const declaration
   with `var NAME = __DATA["NAME"];` — **every function stays byte-identical**.
3. Runs OLD (golden, twice for determinism) vs prototype on identical fixtures and
   **deep-equals** the outputs. Any mismatch exits non-zero (stop condition).

Run: `node scripts/_taxonomy-pilot/proof.cjs`

## Files read (OLD, unmodified)
- `assets/js/finance-directive-ranker.js`
- `assets/js/finance-targeting-engine.js`
- `assets/js/finance-directive-translator.js`
- `assets/js/finance-execution-panels.js`
(`clarity-operator` is intentionally EXCLUDED — it has genuine per-domain logic divergence, verdict RED.)

## Result (2026-06-17)
| engine | extracted consts | checks | verdict |
|---|---|---|---|
| directive-ranker | 7 | rank() | IDENTICAL, deterministic |
| targeting-engine | 3 | resolveTargets ×4 | IDENTICAL, deterministic |
| directive-translator | 6 | translate (RNG-pinned) + shape | IDENTICAL, deterministic (RNG stable) |
| execution-panels | 2 | GRANT/PATENT data + render | data IDENTICAL; render/wire = BROWSER_ONLY (shared verbatim, verify in browser) |

`out/` holds the extracted per-engine data JSON (regenerable; gitignored).

## What this does NOT prove
- `renderForOpportunity(GRANT)` and `wireForOpportunity` need a real DOM → marked
  BROWSER_ONLY. They are shared-verbatim render logic (not extracted data), so their
  identity is by code-identity; confirm with the in-browser golden-diff on
  `domain-console?domain=finance` when/if the runtime pilot is approved.
- The other 19 domains (only finance was proven here).
