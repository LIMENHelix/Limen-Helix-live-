---
authority: ENGINEERING_HYPOTHESIS
built_at: 2026-10-05
built_by: engineering agent (Kimi Code), agent branch
state: built and unit-tested locally; NOT deployed, NOT live-verified
verified_by: node scripts/test-brain-live.js — 20/20 checks against the real kernel over the real recorded energy fixture
---

# BRAIN-V2 LIVE WIRE

## What this is

The production wiring for the brain-v2 closed loop. Until this change, the only
driver was `brain-v2/run.js`, an offline replay over a cached fixture. Now a Vercel
cron advances the same kernel against live recorder rows:

- `vercel.json` → `GET /api/brain-tick` (every 30 min) → `handlers/brain-tick.js`
  → `lib/brain-v2-live.js` advances `LOOP.tick` over new rows from the same Redis
  history `/api/feed-record?read=energy` serves, then persists the serialized loop.
- `GET /api/brain-state?domain=energy` (`handlers/brain-state.js`) — read-only view:
  tick count, watermark, prediction registry counts. Every response is labeled
  `interpretiveOnly: true`.

## What this is NOT

- NOT authoritative. This loop writes only its own `brain_v2:energy` state key.
  It does not touch domain stress, portal scores, company JSONs, or any
  user-visible number. Production scoring authority stays with the validated path
  (`bk-scorer` / `VALIDATION_LOCK.json`). These predictions are a measurement
  instrument under calibration.
- NOT a second domain. Energy is the only binder backed by a measured fixture
  (`brain-v2/bind/registry.js`: BOUND vs MANIFEST_ONLY). A domain is added by
  binding it to observed channels and extending `DOMAINS` in the handler.
- NOT filesystem-backed. `spec.storeDir` is deliberately never set; state lives in
  one db value (`limen:brain_v2:energy`) so state and watermark move in one write.

## Mechanics that matter

- **Watermark, not `lastTickAt`.** The kernel assumes non-decreasing `now`. Rows in
  the 02:00–04:00 UTC offline window are consolidated over, not ticked, so
  `lastTickAt` does not advance past them. Progress is a separate `watermark`
  (max row.t presented), stored in the same value as the state.
- **Cron idempotency.** Re-firing with already-seen rows ticks nothing (T2 in the
  test). One invocation is capped at 48 ticks; a backlog is caught up over
  successive crons.
- **Auth.** `lib/cron-auth` (Bearer `CRON_SECRET`) exactly like every other worker;
  `x-vercel-cron` is never treated as a credential. `heartbeat.wrap` records runs
  as `brain-tick` spikes without counting auth rejections.
- **Degradation.** With Redis unreachable, `lib/limen-db` falls back to per-instance
  memory: the loop still runs but resumes fresh each invocation. That is the
  standard repo behavior for non-money paths; it is recorded here so the loss of
  continuity is a known property, not a surprise.

## Verify

```
node scripts/test-brain-live.js     # 20 checks: kernel over real fixture, idempotency, auth, state endpoint
node brain-v2/run.js                # the offline replay lab — unchanged, still the authority for kernel behavior
```

Live verification after deploy: call `/api/brain-tick` with the cron secret, then
`/api/brain-state?domain=energy` and confirm `brain.exists: true` and a watermark
close to the newest `feedhist:energy` row.
