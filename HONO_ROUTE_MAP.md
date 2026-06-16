# Hono Route Map — CONSOLIDATION COMPLETE ✅

**Status: DONE (2026-06-16).** All 57 Node `api/*.js` handlers were migrated into a
single Node catch-all `api/[...route].js` that uses Hono's `RegExpRouter` to match
`/api/<name>` and invokes each legacy handler with the **native Node `(req,res)`**
(no Fetch shim → raw bodies, `res.setHeader`, streaming, `req.on('data')` all behave
exactly as before). Verified `lambdaRuntimeStats: {"nodejs":1,"python":4}` (was 57+4).

## Architecture
- **`api/[...route].js`** — the single Node function. Holds `HANDLERS = { name: require('../handlers/<name>') }`
  (static requires so Vercel's tracer bundles them). Vercel serves static files with
  precedence over the catch-all, so each route flipped to Hono only when its file moved
  out of `api/` → fully incremental + reversible (`git mv` back).
- **`handlers/<name>.js`** — the 57 migrated handlers. Kept at top-level depth (same as
  `api/`) so every `require('../lib/..')` and `path.join(__dirname,'..','assets',...)`
  stays valid (the [[lib-path-bug-fixed]] trap, avoided).
- **Python untouched** — `api/helix.py`, `api/limen.py`, `api/ping.py`, `api/ping_app.py`,
  `api/helix_app/**` remain separate Python functions. `/api/limen/(.*) → /api/limen`
  rewrite preserved (verified: `/api/limen/score` → 422 FastAPI).

## Invariants verified live on limenhelix.com
- **6 cron paths** route through the catch-all at their exact paths. A real `*/15`
  `limen-worker-ingest` fire landed 200 (Vercel runtime logs, 18:45 UTC) + updated Redis;
  gated crons (trigger-pattern-author, cron-rebuild-engine-outputs, cron-repair-held)
  reject plain GET (405) but run on the `x-vercel-cron` header (200). `vercel.json` crons
  + schedules unchanged. `maxDuration` stays 800.
- **Stripe webhook** (`capital-engine?action=stripe-webhook`) — raw body + `stripe-signature`
  header delivered to `_readRaw(req)` exactly as standalone (catch-all never reads the body).
  POST reaches the HMAC compare. ⚠ Pre-existing (NOT changed here): capital-engine has no
  `bodyParser:false`, so Vercel parses JSON and `_readRaw` re-stringifies — true byte-exact
  HMAC would need a dedicated `bodyParser:false` function. Separate task.
- **Edge-cache** on `limen-changelog`/`limen-autofire-log` GET preserved (MISS→HIT confirmed).
- **Frontend hot routes** (domain-snapshot, fetch-portal, limen-snapshot) route-for-route
  identical.

## Known cosmetic (no functional impact)
- `/api/ping` → catch-all Hono-miss 404. `ping.py` is an unused legacy-format stub (no repo
  references). Was effectively absent before too.
- `/api/helix/*` subpaths → 404, **same as pre-migration** (operator's 2026-06-08 commit
  0505d25: helix path "was NEVER served (404)"; frontend pages degrade gracefully). The
  exact `/api/helix` hits Python (currently 500 on import — pre-existing dual-kernel issue,
  unrelated to this migration).

## Deferred (operator chose "consolidate now, unbundle later")
- **includeFiles unbundle** → to reach the ~20MB target, convert the 9 handlers that read
  `assets/data/companies/<slug>.json` from the bundle to fetch/Redis, then drop
  `companies/*.json` from `includeFiles`. The 57→1 consolidation already cut the artifact
  from ~1.6 GB (57 bundles) to a single bundle (~one function's worth). This is the next phase.

## Commit trail
phase 1 (pilot) → 2a/2b (GET cluster) → 3/3b (POST/Redis + AI/print) → 4a/4 (crons) → 5 (capital-engine).
