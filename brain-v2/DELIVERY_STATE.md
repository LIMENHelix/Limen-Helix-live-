---
authority: MEASURED_SNAPSHOT
measured_at: 2026-08-08T01:10Z
measured_at_commit: 278a2fbee868d1f9c09f75f4cbf8d7821e5beb03
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

**THREE DIFFERENT COUNTS, AND COLLAPSING ANY TWO OF THEM IS THE MISREADING THIS TABLE
EXISTS TO PREVENT.** Bound is a statement about declaration and offline readability.
Installed is a statement about what executes hourly in shadow. Active is a statement about
evidence, and it is still zero. A domain can be bound, installed, and evidence nothing.

| fact | value |
|---|---|
| total domains | 20 |
| **BOUND** (validating binder + a fixture that binder can read) | **20 of 20** |
| **INSTALLED** in the production shadow runtime | **7**: energy, finance, education, economy, trade, industry, population |
| not yet installed | **13** |
| **relationships ACTIVE as neural pathways** | **0 of 10** |
| declared relationships | 10, in energy (7) and finance (3) only. The five batch-1 domains declare **zero**. |
| offline replay fixtures | 20 of 20 |

Installation grants nothing. It puts a domain in shadow, where it senses and reports. It
activates no relationship, licenses no claim of independent evidence, and is not a step
toward one that can be skipped: the evidence gate is measured separately and is still shut.

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
- **PROVEN — source-identity TRANSPORT, for the subset of channels that currently emit
  source IDs.** Cycle 4 (2026-08-05T21:27Z) crossed the `su` boundary and
  `withObservationId` matched the recorder exactly: energy 19 of 19, finance 56 of 56.
  Nothing was dropped between adapter, recorder, binder and runtime.

  **THIS IS TRANSPORT INTEGRITY, NOT PROVENANCE COVERAGE.** An earlier version of this file
  said "the provenance chain is closed end to end". That sentence described a subset as
  though it were the whole and is withdrawn.

  - energy declares **18 channels; 1 currently emits `su`** (FRED Crude Oil)
  - finance declares **13 channels; 3 currently emit `su`** (Finnhub, Alpha Vantage,
    Treasury Yield Curve)
  - **19 and 56 are OCCURRENCES, not distinct observation identities.** Repeated hourly
    polls of one unchanged publisher record count repeatedly.
  - repeated polling of the same upstream identity **must not** count as independent
    evidence
  - rows recorded before 2026-08-05T03:12Z retain their VALUES but have **unknown** source
    identity, permanently — the field did not exist when they were written

  ### Measured per-channel identity, 35 eligible rows since `su` deployment

  | domain | channel | withSu | **DISTINCT** | repeats | tier |
  |---|---|---|---|---|---|
  | energy | FRED Crude Oil | 35 | **2** | 33 | source |
  | energy | other 17: 11 value-change (news/RSS), 6 unknown (Massive, EIA Petroleum, Fed Reg x2, +2) | 0 | 0 | — | mixed |
  | finance | Finnhub Market | 35 | **8** | 27 | source |
  | finance | Alpha Vantage Market | 34 | **2** | 32 | source |
  | finance | Treasury Yield Curve | 35 | **1** | 34 | source |
  | finance | other 10: 3 value-change (Treasury Debt, FDIC, SOFR), 7 unknown | 0 | 0 | — | mixed |

  35 occurrences of 2 identities is two observations polled 35 times, not 35 observations.

  ### Relationship eligibility — measured, not inferred from occurrence counts

  **0 of 10 declared relationships meet the analyzer's minimum (>=6 distinct identities on
  BOTH sides).**

  | domain | latent | side A distinct | side B distinct | eligible |
  |---|---|---|---|---|
  | energy | crude oil price level | FRED 2 | EIA Petroleum 0 | no |
  | energy | crude oil price level | FRED 2 | Massive Crude 0 | no |
  | energy | electric grid stress | 0 | 0 | no |
  | energy | natural gas supply pressure | 0 | 0 | no |
  | energy | renewable generation attention | 0 | 0 | no |
  | energy | nuclear sector activity | 0 | 0 | no |
  | energy | coal-to-renewable displacement | 0 | 0 | no |
  | finance | SPY price level | Massive 0 | Finnhub 8 | no |
  | finance | SPY price level | Massive 0 | Alpha Vantage 2 | no |
  | finance | SPY price level | **Finnhub 8** | Alpha Vantage 2 | no |

  The last row is closest: Finnhub clears the bar, Alpha Vantage does not — its key is
  `07. latest trading day`, one identity per trading day. Holding 2 of the 6 required, it
  needs **4 more**, subject to a successful fetch on each of those market days.

  ### What this permits and forbids

  - Missing identity **does NOT block installation** in shadow mode; shadow sensing over
    value-change channels is legitimate if the gap is reported honestly.
  - It **DOES block** claiming independent evidence or activating any relationship that
    requires it. No neural pathway may be switched on from these numbers.
  - Unavailable identity must stay **visible in domain health**, never defaulted or hidden.

  BACKFILL IS COMPLETE: the cursor reached 2026-08-05T21:12:46.814Z, the newest recorded
  row. From cycle 5 the runtime is in steady state and `rowsApplied` drops from ~120 to
  roughly 1 per hour. That is normal, not a stall.
- **UNPROVEN — absence of unexpected Redis keys.** Requires a looped `SCAN` (repeat with
  the returned cursor until it returns `0`), and even then only covers the pattern queried.
  `vercel env pull` returns sensitive values EMPTY, so this session has no Redis
  credentials and cannot run it.
- **No outward actions.** Five effectors, all in-process. No pre-existing site, UI or
  decision consumer reads shadow state; `/api/brain-shadow` is a new, token-gated operator
  reader and is the only one.

---

## BATCH 1: five domains installed, VERIFIED IN PRODUCTION

**Evidence gained: none.** This is an installation, and installation is not evidence. What
changed is how many domains sense in shadow, not what any of them has established.

Added to the shadow runtime: **education, economy, trade, industry, population**. Selected
by a read-only audit of all 18 uninstalled domains, measured against the PR #4 fixtures:

| domain | channels read / declared | source-ID channels | declared relationships | first readable row |
|---|---|---|---|---|
| education | 10 / 10 | 1 | 0 | 0 |
| economy | 15 / 15 | 3 | 0 | 0 |
| trade | 13 / 13 | 2 | 0 | 0 |
| industry | 10 / 11 | 0 | 0 | 0 |
| population | 14 / 15 | 1 | 0 | 0 |

Chosen for three properties, in this order. Each **declares zero relationships**, so
installing them cannot activate a pathway even by mistake. Each reads from **row 0**, so its
first cycle is immediately falsifiable rather than silent. Each carries 91% to 100% channel
coverage, so an unavailable input is a small, named exception rather than the norm.

**Culture and religion were excluded and the reason is not coverage.** Their first readable
row is index 373 of 470, so at a 120-row cap they tick zero times for three consecutive
cycles. A green cycle from either would prove nothing for three hours, which is the worst
property a canary can have.

**MEMBERSHIP IS NOW REGISTRY DATA.** `registry.INSTALLED_DOMAINS` is the only operational
list; `lib/brain-shadow-runtime.js` re-exports that array and `handlers/brain-shadow.js`
derives from the runtime. The runtime used to hold its own literal, which is one list owned
by the wrong module: a domain added there but not to the health handler is executed hourly
and reported as absent, and the operator read is the only surface anyone looks at.

**SERIALIZED STATE SIZE IS NOW MEASURED per domain.** `writeState` returns
`Buffer.byteLength(json, 'utf8')` of the exact string it passed to SET, the cycle report
carries it as `stateValueBytes`, and `/api/brain-shadow` reports it per domain plus a total
and how many domains that total covers. Nothing was measuring hot-state size before, so no
growth projection could be checked against production at all.

**WHAT THIS NUMBER IS, STATED EXACTLY.** The UTF-8 byte length of the serialized state value
accepted by SET. It is useful for measuring **relative hot-state growth**, and it is **not a
measurement of HTTP transport bandwidth or billing.** `brain-shadow-redis` speaks the Upstash
REST API, which nests this value inside a JSON command array and escapes it a second time,
and a GET adds its own response envelope, so the figure on the wire is strictly larger by an
amount nothing here observes. An earlier version of this section called it "bytes actually
written", doubled it for read-plus-write, projected a monthly bandwidth total from it, and
compared it against an HTTP request ceiling. **All four of those are withdrawn.** They
substituted a value length for a transport length, which is the same class of error as
counting occurrences and calling them observations.

Offline, first cold cycle of 120 rows, through the real write path:

| domain | stateValueBytes | | domain | stateValueBytes |
|---|---:|---|---|---:|
| energy | 926,617 | | trade | 781,990 |
| finance | 674,805 | | industry | 468,016 |
| economy | 649,007 | | education | 436,741 |
| population | 572,415 | | **7 installed** | **4,509,591 (4.30 MB of value)** |

### VERIFIED IN PRODUCTION 2026-08-07, and the outage in the middle of it

Measured by authenticated reads of `/api/brain-shadow`, not inferred.

**Cycle at 16:27:32Z, first post-merge.** All seven `ok:true`. `installedCount:7`,
`totalDomains:20`. Aliases resolved: `trade` reported runtime domain `supplyChain`. The five
new domains cold as expected (`restored:false`, `cursorBefore:null`), each applying 120 rows
at the cap, cursor to `2026-07-22T20:12:33.982Z`. Energy and finance `restored:true`.
`stateValueBytes` measured for 7 of 7, total **11,121,483**.

**THEN THE RUNTIME WENT OFF THE AIR FOR THREE AND A HALF HOURS, and no brain file changed.**
An unrelated feature merge at 16:26:55Z deployed at 16:30:19Z having lost two lines in a
merge resolution: the `brain-shadow` entry in `api/[...route].js`, and the
`/api/brain-shadow?run=1` cron in `vercel.json`, whose array slot was taken by another cron.
`/api/brain-shadow` answered 404. **The cycles at 17:27, 18:27 and 19:27 did not run.**
Every test passed and every deploy was green throughout, because nothing asserted that the
brain was reachable. Restored at 19:50:21Z. See NEXT PROGRAM STEP 5.

**Cycle at 20:27:15Z, first post-restoration.** All seven `ok:true` and **`restored:true`**,
including the five installed by this batch, whose first cycle was cold. Every domain's
`cursorBefore` equalled its OWN `cursorAfter` from 16:27, proved from each domain's
`?history=` record:

| domain | 16:27 cursorAfter | 20:27 cursorBefore | applied | stateValueBytes |
|---|---|---|---:|---:|
| energy | 2026-08-07T16:12:15.703Z | 2026-08-07T16:12:15.703Z | 4 | 3,911,335 |
| finance | 2026-08-07T16:12:15.703Z | 2026-08-07T16:12:15.703Z | 4 | 4,376,143 |
| education | 2026-07-22T20:12:33.982Z | 2026-07-22T20:12:33.982Z | 120 | 916,504 |
| economy | 2026-07-22T20:12:33.982Z | 2026-07-22T20:12:33.982Z | 120 | 1,300,158 |
| trade | 2026-07-22T20:12:33.982Z | 2026-07-22T20:12:33.982Z | 120 | 1,525,786 |
| industry | 2026-07-22T20:12:33.982Z | 2026-07-22T20:12:33.982Z | 120 | 1,004,203 |
| population | 2026-07-22T20:12:33.982Z | 2026-07-22T20:12:33.982Z | 120 | 1,237,775 |

No replay: every applied row was newer than the stored cursor, and the total rose to
**14,271,904** across 7 measured domains. State survived a four-hour gap and a
deployment, which is stronger restoration evidence than two adjacent cycles.

**Cycle at 21:27:15Z, second post-restoration, CONSECUTIVE with the first.** 20:27 and
21:27 are one hour apart with nothing between them, which is the claim the earlier pairing
(16:27 and 20:27, separated by the outage) could not support. All seven `restored:true`,
and every domain's `cursorBefore` equalled its OWN 20:27 `cursorAfter`:

| domain | 20:27 cursorAfter = 21:27 cursorBefore | applied | stateValueBytes 20:27 → 21:27 |
|---|---|---:|---|
| energy | 2026-08-07T20:12:43.770Z | 1 | 3,911,335 → 3,918,000 |
| finance | 2026-08-07T20:12:43.770Z | 1 | 4,376,143 → 4,383,808 |
| education | 2026-07-27T20:12:29.928Z | 120 | 916,504 → 1,562,659 |
| economy | 2026-07-27T20:12:29.928Z | 120 | 1,300,158 → 2,159,066 |
| trade | 2026-07-27T20:12:29.928Z | 120 | 1,525,786 → 2,194,589 |
| industry | 2026-07-27T20:12:29.928Z | 120 | 1,004,203 → 1,658,563 |
| population | 2026-07-27T20:12:29.928Z | 120 | 1,237,775 → 2,029,484 |

57 of 57 criteria passed. Records selected by post-deployment timestamp, not array
position, so a delayed or manually dispatched cycle cannot shift the pairing silently.

**THE GATE JUST GOT TIGHTER, MEASURED IN PRODUCTION.** The five backfilling domains grew
**44% to 71% in a single cycle**, and the seven-domain total went from 14,271,904 to
17,906,169, **+25% in one hour**. Offline replay of a cold start did not show this because
it never ran more than one cycle per domain. Batch 2 must not be installed against a curve
this steep.

**Backfill completed at 23:27:16Z, and the earlier prediction about it was wrong twice.**
An earlier draft said "360 of 470 rows consumed, one 110-row cycle remains, then a zero-row
cycle". Production says otherwise on both halves:

| education cycle (`startedAt`) | rowsApplied | cursorAfter |
|---|---:|---|
| 2026-08-07T16:27:32.964Z | 120 | 2026-07-22T20:12:33.982Z |
| 2026-08-07T20:27:16.175Z | 120 | 2026-07-27T20:12:29.928Z |
| 2026-08-07T21:27:15.932Z | 120 | 2026-08-01T20:12:56.266Z |
| 2026-08-07T22:27:16.177Z | 120 | 2026-08-06T20:12:16.515Z |
| 2026-08-07T23:27:16.134Z | **27** | 2026-08-07T23:12:06.626Z |

It took **four** 120-row cycles and then 27, not three and then 110. And the catch-up cycle
was not zero and never could be.

**THE ERROR WAS TREATING A FIXTURE SIZE AS A PRODUCTION TAIL.** The 470-row figure is the
offline replay corpus. Production is different in two ways that both matter:
`readRecorderRows` reads the newest **500** rows, and `feed-record` runs at `:12`, sixteen
minutes before `brain-shadow` at `:27`, so fresh rows arrive between every pair of cycles.
The tail was never a fixed number to divide.

A caught-up domain therefore applies **newly recorded rows, not zero**. All five now sit at
`cursorAfter` 2026-08-07T23:12:06.626Z, identical to energy and finance, which is what
caught-up looks like: energy applies 1 row per cycle in steady state, and the five will do
the same. No further backfill count is predicted here, because nothing measured supports
one.

**PRODUCTION CONTRADICTS THE OFFLINE PROJECTION.** The five new domains matched offline
replay within 0.1% on their first cold cycle, validating the method for a cold start. The
two canaries did not, because production has run for days and is past the end of the
measured curve. Both numerator and denominator are named, because an earlier draft quoted
a ratio without them and divided the 16:27 figures against the table above, which shows
20:27:

| domain | 21:27 production | offline cold cycle | ratio |
|---|---:|---:|---:|
| energy | 3,918,000 | 926,617 | **4.23x** |
| finance | 4,383,808 | 674,805 | **6.50x** |

At 20:27 the same pairing gives 4.22x and 6.49x. Finance at 4,383,808 already exceeds the
3.67 MB largest value ever measured offline. **The offline 20-domain projection is
therefore a floor, not a worst case.**

### The six fields this file requires of every brain PR

- **evidence gained**: none. Installation is not evidence. No relationship moved, no
  identity count changed, no claim became citable.
- **domains promoted**: education, economy, trade, industry, population. 2 installed to 7.
- **remaining domains**: 13 outside the runtime.
- **current gate**: hot state growth (NEXT PROGRAM STEP 3). Hard gate before batch 2.
  Production measurement makes it tighter than the offline projection said, not looser.
- **known unknowns**: (a) **actual transport bytes are not measured anywhere**, so no
  bandwidth or billing figure exists for this system, only serialized value lengths;
  (b) the Upstash request-size ceiling for this plan has not been retrieved, and since the
  value length is not the wire length, headroom above the largest value is doubly
  unestablished; (c) the sequential seven-domain batch wall-clock and the per-cycle Redis
  round-trip latency are still unmeasured, because the cycle report records neither;
  (d) STEADY-STATE growth is not yet known. Backfill COMPLETED at 23:27:16Z and all five
  now share energy's cursor, but every cycle measured so far was a backfill cycle, so no
  measurement yet exists of how the serialized value moves across ordinary live cycles
  applying a handful of new rows. That number, not the backfill curve, is what the
  hot-state gate ultimately turns on.

  **Withdrawn from this list, now measured:** "no production cycle has run with 7 domains"
  and "production `stateValueBytes` is unknown". Five seven-domain cycles have run
  (`startedAt` 16:27:32Z, 20:27:15Z, 21:27:15Z, 22:27:15Z, 23:27:15Z; per-domain values
  differ by under two seconds within a cycle) and every domain has reported a measured
  `stateValueBytes` in each. Leaving them listed as unknown after measuring them would make
  this file understate what the system has proven, which is the same defect as overstating
  it.
- **exact next action**: close the hot-state gate (NEXT PROGRAM STEP 3). Production
  restoration is now proven across two CONSECUTIVE cycles (20:27:15Z, 21:27:15Z), so that
  question is settled and is no longer the blocker. The blocker is growth: +25% across the
  seven installed domains during backfill, which completed at 23:27:16Z. The next
  measurement needed is steady-state growth across ordinary live cycles, which has not
  been observed yet. Not the next batch, and not pathway activation: 0 of 10
  relationships are analyzer-testable.

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

1. **THE PERSISTENCE GATE IS CLOSED.** Restoration (cycle 2) and source-identity transport
   (cycle 4) are proven against production, so batched onboarding is unblocked.
   **The EVIDENCE gate is a separate, still-open milestone** and does not block
   installation: 0 of 10 relationships have enough distinct identities on both sides.
   Install domains in shadow; activate relationships only when measured.
2. **Then onboard remaining domains in registry-driven BATCHES.**
   - Do **not** create 18 bespoke runtimes.
   - Do **not** process one domain per session.
   - A domain enters a batch only with: a binder, recorded rows, provenance handling,
     isolation tests, and honest reporting of unavailable channels.
   - Per-domain failure isolation is mandatory: one bad domain must not stop the others.
   - Batch 1 (5 domains) is done. **13 remain.**

3. **MANDATORY GATE BEFORE BATCH 2, bound hot state growth.** Batch 2 must not be
   installed until this is closed, and it is a hard gate, not a preference.

   **What was measured, and in which unit.** Serialized state VALUE length grows roughly
   linearly with ticks and shows no plateau within 470 ticks. Offline replay of the PR #4
   fixtures. These are value lengths, not wire bytes; see the unit note in BATCH 1.

   | replay depth | economy | finance | infrastructure |
   |---|---|---|---|
   | 120 rows | 633.7 KB | 658.9 KB | 928.8 KB |
   | 240 rows | 1,268.2 KB | 1,787.7 KB | 1,833.4 KB |
   | 360 rows | 2,118.6 KB | 2,798.6 KB | 2,686.5 KB |
   | full replay | 2,834.7 KB | **3,761.8 KB** | 3,472.4 KB |

   Composition of finance at 470 ticks: `memory` 2,398 KB (64%) and
   `registry.predictions` 763 KB (656 open, 611 resolved). Both accumulate per tick.
   `lib/brain-shadow-store.js` enforces no size ceiling.

   **Why it gates the batch and not this one.** Every cycle reads the whole state and writes
   it back, so a value that grows without bound grows the work of every future cycle. At 7
   installed domains the total is 4.30 MB of value and is manageable. At 20, offline replay
   projects **50.09 MB of resident value**, with the largest single domain already 3.67 MB and
   no ceiling in the store. Installing 13 more before bounding growth commits every
   subsequent cycle to carrying it.

   **STATED IN THE UNIT ACTUALLY MEASURED.** The figures above are serialized value lengths.
   Earlier wording here turned them into a bandwidth-per-cycle number, a monthly billing
   projection, and a comparison against a request-size ceiling. Those needed transport bytes,
   which nothing measures, so they are withdrawn rather than restated more carefully. The
   growth curve is real and is enough on its own to gate the batch; the cost curve is
   currently unknown, and saying so is the honest form of the same warning.

   **What closing it requires**, and each of these is a constraint the fix must not break:
   - bound `memory` and the prediction registry, by retention policy, compaction, or both
   - **preserve auditable history**: a pruned record must remain reconstructable or its
     removal must be recorded, because state that quietly forgets is state that cannot be
     audited later
   - **preserve replay, rollback and deterministic tests**: `test/shadow-runtime.js` S3b
     asserts byte-identical state across two independent runs, and S4 asserts a restored
     brain carries the same channel state. A compaction that depends on wall-clock time or
     on how many cycles happened to run breaks both, and would break them silently
   - **measure ACTUAL TRANSPORT BYTES**, by instrumenting `lib/brain-shadow-redis` at the
     point it builds a request and reads a response. Until that exists there is no bandwidth
     figure and no billing figure for this system, and the request-size headroom above the
     current 3.67 MB largest value cannot be established either. This belongs to THIS
     milestone and was deliberately kept out of the batch-1 installation PR.
   - re-measure against production and record the new curve here

   **Not attempted in this PR, deliberately.** Compaction touches the kernel's memory and
   prediction registry, which every existing measurement depends on. Bundling it with a
   membership change would make a regression in either one impossible to attribute.

5. **REACHABILITY IS NOW A TESTED INVARIANT.** `brain-v2/test/deployment-invariants.js`
   fails CI if `api/[...route].js` loses the `brain-shadow` registration, if
   `vercel.json` loses the `:27` cron, if anything else claims that schedule, or if any
   cron targets a route that is not registered. It also refuses a duplicate registration
   and a dedicated `api/brain-shadow.<ext>` file that would shadow the catch-all.

   **Measured at head `5216ddda`, against the 21-assertion version of that test:** clean
   **21/21**; reproducing the 2026-08-07 damage exactly (registration removed, cron
   substituted at the same schedule, cron count unchanged) gives **17/21, 4 failed**.
   Both figures are properties of that head and that assertion count, not of the test in
   general: earlier revisions ran 9 and then 14 assertions and produced different counts,
   so any count quoted without its revision is meaningless.

   The lesson is not "someone was careless". It is that **an installed, correct,
   unreachable brain is indistinguishable from a working one** from inside the repository.
   Every brain file was right on main for the whole outage, every test passed, every deploy
   was green. The only surface that would have said otherwise was the one that had stopped
   answering. That is why the invariant asserts the declaration rather than the behaviour:
   it fails on the pull request that causes it, not hours later in production.

6. **THE AUDIT NUMBERS WERE CORRECTED. Do not cite the pre-correction ones.** Four defects
   in `scripts/brain-audit`, all found in review, all now fixed:
   - source-identity coverage was reported as relationship eligibility. The real rule, in
     `scripts/build-brain-fixture.mjs`, also requires each side to be MOVING. The audit now
     imports `analyze` / `loadManifest` / `testableRelationships` / `MIN_OBSERVATIONS` from
     that analyzer instead of re-deriving them, and prints coverage and eligibility apart.
   - `String.length` was labelled bytes. Now `Buffer.byteLength(value, 'utf8')`. Effect:
     about 0.4% larger totals. Real, and no conclusion moved.
   - the installed set was hardcoded to two domains. Now `REG.INSTALLED_DOMAINS`.
   - kernel-loop timing was called cycle cost. Now `tickLoopMs`, which excludes the state
     read, `LOOP.serialize`, the stringify, and all seven Redis round trips.

   Re-measured after correction: **10 declared relationships, 0 analyzer-testable, 0 of 20
   domains supporting independent observations.** Unchanged conclusion, now on the real
   rule. Serialized value all 20: 11.53 MB at 120 ticks, 50.09 MB at full replay.

7. **Separate bounded cleanup, not urgent, do not fold into a batch PR.**
   `brain-v2/bind/agriculture.js:2` still reads "No fixture exists; MANIFEST-ONLY". PR #4
   gave it a fixture and the registry reports it BOUND, so the header contradicts the code
   below it. Documentation only, no behaviour, and it should not ride along with a change
   that alters what runs.

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
