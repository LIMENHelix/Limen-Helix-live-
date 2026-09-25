# Transmutation R2b — paid-provider boundary proof (2026-09-25)

## Scope

This increment closes the first bounded part of the paid-provider gap identified by
`DOMAIN_DIFFERENCE_AUDIT_2026-09-24.md`:

- replace the shared spend meter's read/mutate/write reservation with one durable Redis Lua mutation;
- require a global AI-spend authorization, local daily cap, stable idempotency key, reservation, and settlement for Finance structured AI calls;
- put public Orb voice synthesis through the same boundary;
- delete the unused anonymous `relay-grok-image` and `relay-image-search` paid-provider routes;
- make the Relay firewall require zero anonymous paid-provider exceptions.

This increment does **not** authorize paid AI, raise a budget, change a civilization valve,
change Finance trade policy, or change Relay purchase authority. Relay's scheduled engine and
scraper are a separate remediation increment because they combine provider spend with an existing
business-specific purchase boundary.

## Enforced contract

The effective paid-provider authority is the minimum of:

1. `LIMEN_AI_ENABLED` (hard deployment gate);
2. the durable `ai:spend:paused` operator gate;
3. the caller's positive local daily dollar cap;
4. the process-wide run/daily caps when configured;
5. one atomic durable reservation tied to a stable idempotency key.

An unavailable or malformed durable ledger refuses provider dispatch. Settlement is idempotent.
An ambiguous provider result retains the conservative estimate rather than treating the call as
free. The strict store exports two reviewed spend operations and does not expose arbitrary Redis
`EVAL` to callers.

Default local ceilings remain deliberately small:

- Finance structured providers: `$2/day` across each named Finance provider scope, overridable by
  `LIMEN_FINANCE_AI_DAILY_CAP_USD`;
- Orb voice: `$6/day`, preserving the prior 400,000-character ceiling at the documented `$15/M`
  rate, overridable by `LIMEN_ORB_VOICE_DAILY_CAP_USD`.

## Measured local evidence

```text
> node scripts/test-paid-provider-boundary.cjs
paid provider boundary: strict Lua, atomic delegation, Finance/Orb ordering, caps, idempotency, and global kill passed
```

The test proves that the strict store issues the bounded Lua reserve/settle shapes, does not export
arbitrary `eval`, passes all cap and identity fields into the atomic operation, checks the global
kill before requesting budget, and observes `reserve -> network -> settle` for both Finance and
Orb. Its denial fixtures observe zero provider network calls.

```text
> node scripts/test-relay-firewall.js
F10: no routed Relay handler can spend without a credential
  PASS no spend-capable Relay endpoint is reachable without a credential
  PASS unused anonymous paid-provider endpoints stay deleted
  PASS the deleted anonymous fulfilment endpoint stays deleted
FIREWALL INTACT (52 assertions)
```

```text
> npm run check
repository check
  javascript parsed : 2169
  json parsed       : 4964  (2 skipped over the size cap)
  cron targets      : 68
  canonical nodes   : 123 (_meta.total enforced)
  boot              : boot test: 334 modules loaded, 0 skip-listed, 0 failed to load
repository check passed
```

The first full-suite run discovered that both new cap variables were absent from the complete
control inventory. That proof failed rather than permitting an invisible control. Both were added
to `civilization-control-inventory`, and the focused inventory test then measured:

```text
civilization control inventory: 42 runtime valves, all env controls, 68 cadences,
385 triggers, 111 diagnoses, B0-B17 and P0-P10 visible
```

Corrected full-suite result:

```text
> npm test
repository check passed
harness map matches reality: 68 vercel crons, 8 github crons, 6 globally valved jobs;
27 total outward-effect jobs; 1 explicit heartbeat exception
running 321 test files
320 passed, 1 skipped, 0 failed, 218.8s
```

The one skip is the explicitly reported external corpus prerequisite in
`brain-v2/test/corpus-foundation.js`; it is not counted as a pass.

## Production evidence

R2b merged as `f783f077c852c025fbdde5f1ca63d37080abda97`. GitHub repository check
`36092135731`, Vercel production deployment `6653348068`, and post-deploy smoke
`36092272154` all completed successfully against that exact merge SHA.

Both deleted anonymous paid-provider routes returned 404 in production:

```text
POST /api/relay-grok-image    -> 404
POST /api/relay-image-search -> 404
```

The production AI gate was not closed. A single valid Orb verification request returned
`200 audio`, `Content-Length: 35328`, and `X-Orb-Cache: miss`, proving that the positive path
crossed the deployed boundary. Its 34 input characters have a conservative documented estimate
of `$0.00051` at `$15/M` characters. No second paid request was made.

Therefore a live kill-switch refusal is **UNMEASURED**, not passed: production's global AI gate
was open. The closed-gate and exhausted-budget paths are measured by the hermetic tests above;
the exact-SHA production deployment and positive-path provider reach are measured live.

Full production transcript:
`https://github.com/LIMENHelix/Limen-Helix-live-/pull/377#issuecomment-5826428733`.
