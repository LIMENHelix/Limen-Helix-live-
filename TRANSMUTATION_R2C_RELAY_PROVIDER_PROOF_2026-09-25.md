# Transmutation R2c — Relay scheduled provider boundary proof (2026-09-25)

## Scope

This bounded increment closes the scheduled Relay engine gap left explicit by R2b. It does not
change Relay's product, margin, listing, payment, fulfilment, or purchase policies.

- add the sovereign `trade:relay-sourcing` runtime valve owned by Supply Chain;
- keep payment and ambiguous-supplier reconciliation open while the motor is inhibited;
- require the valve before new discovery or purchase sweeping;
- put xAI image generation, SerpAPI Lens/Shopping, Google Vision and Google CSE through Relay's
  one reviewed adapter to the global AI kill and atomic durable spend boundary;
- enforce a `$1/day` default Relay provider ceiling, conservative per-call estimates, stable
  one-hour idempotency, reserve-before-network and conservative settlement;
- heartbeat the scheduled engine and remove its explicit harness exception;
- pin both permitted cross-firewall seams so coupling cannot silently widen.

## Authority contract

Effective authority is the minimum of cron/operator authentication, Relay autonomy and purchase
controls, the sovereign `trade:relay-sourcing` valve, the global AI-spend gate, the atomic durable
provider reservation, and the local provider daily cap. Missing or unreadable valve/spend state
refuses new work. Recovery reads remain available because they cannot create a provider order.

Default estimates are deliberately conservative and operator-overridable:

- `RELAY_PROVIDER_DAILY_CAP_USD`: `$1.00/day`;
- `RELAY_XAI_IMAGE_COST_USD`: `$0.20/request`;
- `RELAY_SEARCH_OPERATION_COST_USD`: `$0.02/request`.

## Measured local evidence

The first full-suite run correctly failed `scripts/test-civilization-adapter-guard.cjs`: the new
lane had route-level inhibition but no co-timed adapter checkpoint. The implementation was
corrected rather than exempted. Relay's provider adapter now re-reads the same durable valve
immediately before reserving each external effect.

```text
> node scripts/test-relay-paid-provider.cjs
relay paid provider: local valve ordering, heartbeat, global-boundary delegation, caps, costs, settlement and stable idempotency passed

> node scripts/test-civilization-adapter-guard.cjs
civilization adapter guard: all 42 lane valves inhibit at the last moment before their external effect

> node scripts/test-relay-firewall.js
FIREWALL INTACT (55 assertions)

> node scripts/test-relay-autonomous-loop.js
HERMETIC: no request left the machine
ALL PASS (562 assertions)

> node scripts/test-relay-p0-integrity.js
ALL PASS (87 assertions)

> node scripts/test-cron-auth-fail-closed.js
CRON AUTH FAILS CLOSED (9 assertions across 68 cron targets)

> node scripts/test-civilization-valve-control.cjs
civilization valve control: 42 local lines, total NUKE suppression, preserved state, ordered re-entry, and post-NUKE recommission passed

> node scripts/test-civilization-control-inventory.cjs
civilization control inventory: 43 runtime valves, all env controls, 68 cadences, 385 triggers, 111 diagnoses, B0-B17 and P0-P10 visible

> npm run check:harness
harness map matches reality: 68 vercel crons, 8 github crons, 6 globally valved jobs; 27 total outward-effect jobs; 0 explicit heartbeat exception
```

Clean complete rerun after the adapter correction:

```text
> npm test
repository check passed
harness map matches reality: 68 vercel crons, 8 github crons, 6 globally valved jobs; 27 total outward-effect jobs; 0 explicit heartbeat exception
running 322 test files
321 passed, 1 skipped, 0 failed, 215.8s
```

The one skip is the suite's explicit external-corpus prerequisite
(`brain-v2/test/corpus-foundation.js`); it is not reported as a pass.

## Production evidence

**UNMEASURED until exact-SHA deployment.** Production verification will use deployment identity,
post-deploy smoke, read-only route/log evidence, and the next naturally scheduled heartbeat. It
will not manually trigger a paid Relay cycle.
