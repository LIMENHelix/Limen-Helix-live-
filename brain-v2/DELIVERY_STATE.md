---
authority: MEASURED_SNAPSHOT
measured_at: 2026-08-05T19:35Z
measured_at_commit: 8f69c7ac1091463286ecb1de55c51919e9b78a3c
notice: >
  This records state; it grants no merge, deployment, spending, or external-action
  authority. Nothing here authorises anything. Where a fact is mutable, re-verify it
  against the repository and the live system before relying on it.
---

# brain-v2 delivery state

The single current answer to "where is the brain, and what has actually been proven".
Written because the reasoning behind this build lives in chat logs and PR threads, and a
new session that cannot see them will re-derive wrong answers or lose the objective.

`DOCUMENT_AUTHORITY.md` (2026-08-02), `OWNER_SYSTEM_INTENT.md` and
`brain-v2/MASTER_PROMPT.md` (marked stale) do not carry delivery state. This file does, and
only this file.

**Anything below marked GATED or UNPROVEN is not evidence.** Do not cite it as a result.

---

## OWNER GOAL

1. **One canonical brain runtime across all 20 domains.** One runtime, executed once per
   domain, never twenty copied runtimes.
2. **Domain differences live in binders and registry data, not runtime forks.** A
   `if (domain === 'x')` branch in the runtime is the failure mode to avoid.
   `assets/js/domain-brains/` already went the other way and carries 34 energy-specific
   overrides; that is the counter-example, not the pattern.
3. **Add measured pathways gradually**: lateral connections, information integration,
   rendering, then decision-making. Each earns its place with measurement.
4. **Preserve working brain code. Do not drift into unrelated site work.**

---

## CURRENT POSITION

| fact | value |
|---|---|
| total domains | 20 |
| live in the production runtime | **2** (energy, finance) — same runtime, different descriptor |
| not yet live | **18** |
| offline replay fixtures | 20 of 20 (registry reports 20 bound) |
| declared relationships | 10, in energy (7) and finance (3) only |

- **PR #5 merged as `8f69c7ac`.** First real Upstash cycle succeeded at 2026-08-05T18:27Z
  for both canaries: `ok=true`, 120 rows applied each, 5 internal effectors, no outward
  action.
- **PROVEN — strict Redis persistence for initial creation.** `writeState`, `writeCycle`
  and the read-back confirmation all succeeded against production Upstash. A memory
  fallback or a wrong key prefix would have failed the cycle, not passed quietly.
- **PROVEN — production restoration across invocations.** Cycle 2 (2026-08-05T19:27Z), both
  domains: `ok=true`, `restored=true`, `cursorBefore === 2026-07-21T23:13:02.267Z` exactly
  matching cycle 1's `cursorAfter`, cursor advanced to `2026-07-26T23:12:21.773Z`, 120 rows
  applied with no replay of the first segment.

  The stronger evidence is the **prediction registry carrying forward**, which a recreated
  brain could not do — it would restart near zero each cycle:

  | domain | open predictions | resolved |
  |---|---|---|
  | energy | 102 → 229 (+127) | 95 → 221 (+126) |
  | finance | 45 → 267 (+222) | 28 → 233 (+205) |

  So the loop's learning state was restored from Redis, not recreated. This is the gate
  PR #5 could not close on its own.
- **GATED — backfill provenance.** `withObservationId` is 0 across 1888 (energy) and 1439
  (finance) readings at cycle 2. Expected: the cursor is at 2026-07-26 and `su` did not
  exist in recorded rows before 2026-08-05. The backfill advances ~5 days (120 hourly rows)
  per cycle, so the boundary is projected to fall at **cycle 4, 21:27Z**.
  **If `withObservationId` is still 0 once `cursorAfter` passes 2026-08-05, that is a
  DEFECT**, not a pass.
- **UNPROVEN — absence of unexpected Redis keys.** Requires a looped `SCAN` (repeat with
  the returned cursor until it returns `0`), and even then only covers the pattern queried.
  `vercel env pull` returns sensitive values EMPTY, so this session has no Redis
  credentials and cannot run it.
- **No outward actions.** Five effectors, all in-process. No pre-existing site, UI or
  decision consumer reads shadow state; `/api/brain-shadow` is a new, token-gated operator
  reader and is the only one.

---

## PAST MILESTONES

### PR #3 — provenance foundation (merge `70de3b75`)

| commit | what it actually proved |
|---|---|
| `a571163b` | UN indicator 49 row selection fixed (`pageSize=1` gave the server the choice) |
| `6c2f8c8f` | The UN schema IS published. Indicator 49 is **persons, not thousands** |
| `1e61863f` | The population relationship was **withdrawn**: WPP 2024 estimates end 2023, so the latest completed year is a projection, and World Bank may sit on another year |
| `e4f6c893` | Publisher-side observation keys for the three SPY adapters |

Net: source identity exists on a handful of channels. It did **not** produce a second
bound domain, and the one relationship it seemed to earn was given back.

### PR #4 — offline replay fixtures (merge `4024c98a`)

| commit | what it actually proved |
|---|---|
| `370bf5f5` | 19 fixtures from ~19.5 days of production history; registry 1 → **20 bound** |
| `898027aa` | All 20 fixtures checked (not a 4-domain sample); the r7 boundary pinned causally |

Net: **offline replay only.** `brain-v2/` is in `.vercelignore`, so this changed nothing on
the live site. "20 bound" describes the offline replay registry, NOT 20 production runtimes.
Every fixture honestly reports `supportsIndependentObservations: false`.

### PR #5 — server-side shadow runtime (merge `8f69c7ac`)

| commit | what it actually proved |
|---|---|
| `09828c16` | One runtime parameterised by descriptor; two canaries; confined namespace |
| `4c614d76` | Fail-closed cron, read-only GET, real durability checks |
| `8cd624ab` | Strict Redis transport with **no memory fallback of any kind** |
| `3695c383` | Raw `command()` kept private to the transport |

Net: the shared production template. This is the thing the remaining 18 domains plug into.

---

## CORRECTIONS THAT MUST NOT BE REDISCOVERED

1. **`lib/limen-db` falls back to per-instance memory** when Redis is absent *or when a
   call fails*, and it satisfies a failed write AND the following read from that same
   object — so a read-back guard written against it passes in exactly the case it exists to
   catch. `_redisRequest` also **returns `null` without throwing** on `{error: ...}`, so
   `set()` reported protocol errors as durable writes. The shadow runtime therefore has its
   own strict transport. **limen-db is untouched; other consumers keep its behaviour.**
2. **Token roles are not interchangeable.** `CRON_SECRET` authorises **execution/writes**
   (non-empty, exact `Authorization: Bearer <secret>`). `BRAIN_SHADOW_TOKEN` authorises
   **read-only operator inspection** and cannot make the runtime write. Neither has a
   query-string form: query strings are logged.
3. **Idempotency is SEQUENTIAL ONLY.** There is no lock. Two concurrent cycles would both
   read the same cursor and apply the same rows. Safe at one hourly cron; do not describe
   it as concurrency-safe.
4. **Deployment hash is not proven by `vercel inspect` here** — it returned empty. A
   working route plus a successful cycle establishes deployment; a hash claim needs the
   hash actually retrieved.
5. **HTTP 200 on `/lib/*.js` is weak bundle evidence.** The catch-all can answer 200.
   Verify content, or rely on the runtime actually working.
6. **`SCAN` needs its cursor loop.** One `SCAN 0 MATCH ...` is not exhaustive; repeat with
   the returned cursor until it is `0`. It still only proves the pattern queried.
7. **The kernel wires FIVE internal effectors** (`raise_attention`, `lower_attention`,
   `collect_evidence`, `no_action`, `escalate`) and a 24-row cycle executes ~23 actions.
   The guarantee is **no OUTWARD actuation**, never "no actuation".
8. **`ACT.serialize` does not persist the motor's execution log**, so no lifetime actuation
   count exists in stored state. Report per-cycle counts only.
9. **`.vercelignore` cannot re-include a path whose parent is excluded.** `!brain-v2/kernel/`
   would look correct and ship nothing. Exclude the parts that must not ship instead.
10. **The `limen:` key prefix is load-bearing.** The recorder's history is physically at
    `limen:feedhist:<domain>`; a bare key reads an empty list and reports a healthy cycle
    over zero rows.
11. **BOUND ≠ evidenced.** `registry.js` defines BOUND as a validating binder plus a
    non-empty fixture the binder can read. A declared relationship is required only for
    `supportsIndependentObservations` / SPEC row 10 — **not** for installation.

---

## NEXT PROGRAM STEP

1. **Finish backfill verification** — the one remaining GATED item. Restoration is closed
   (cycle 2, above). Nothing else starts until `withObservationId` resolves either way once
   the cursor passes 2026-08-05.
2. **Then onboard remaining domains in registry-driven BATCHES.**
   - Do **not** create 18 bespoke runtimes.
   - Do **not** process one domain per session.
   - A domain enters a batch only with: a binder, recorded rows, provenance handling,
     isolation tests, and honest reporting of unavailable channels.
   - Per-domain failure isolation is mandatory: one bad domain must not stop the others.

---

## REQUIRED OF EVERY FUTURE BRAIN PR

Update this file, in the same PR, with:

- **evidence gained** — what is now proven that was not
- **domains promoted** — which entered the live runtime
- **remaining domains** — the count still outside it
- **current gate** — what blocks the next step
- **known unknowns** — what is still unproven, named as such
- **exact next action** — the single next step, not a range of options

A PR that changes brain behaviour without updating this file has moved the system and left
its own record behind.
