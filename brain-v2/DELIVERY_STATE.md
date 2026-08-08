---
authority: MEASURED_SNAPSHOT
measured_at: 2026-08-08T22:33Z
measured_at_commit: c18a54cd0f5db9e3d7ede9f8424b764d88825c87
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
| **INSTALLED** in the production shadow runtime | **12 executing now**, 17 declared by this PR. Production ran twelve at 2026-08-08T22:27Z; the five added here execute only after merge. |
| not yet installed | **3 after this PR**: communication, culture, religion |
| **relationships ACTIVE as neural pathways** | **0 of 10** |
| declared relationships | 10, in energy (7) and finance (3) only. All fifteen batch-1, batch-2 and batch-3 domains declare **zero**, so no installation so far could activate a pathway even by mistake. |
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
| population | 572,415 | | **7 installed** | **4,509,591 (4.30 MiB of value)** |

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
3.67 MiB largest value ever measured offline. **The offline 20-domain projection is
therefore a floor, not a worst case.** These figures are the 2026-08-07 cycles; the latest
verified single-domain maximum is finance at 4,522,058 B, 2026-08-08T13:27Z.

## COMPACTION MERGED (PR #14, merge `8a2ba452`), AND WHAT PRODUCTION MEASURED

**Evidence gained: none about any domain.** Compaction bounds hot state. It establishes
nothing about what any domain senses, and it activates no pathway.

**FIRST POST-MERGE PRODUCTION CYCLE, 2026-08-08T21:27:32Z.** All seven `ok:true`. Read from
the stored cycle report, not inferred from a byte total:

| domain | compaction.ran | retired | archive seq | beforeBytes | afterBytes |
|---|---|---:|---:|---:|---:|
| energy | true | 314 | 1 | 4,090,236 | 3,722,988 |

Serialized state across the seven installed domains fell from **23,355,053 B at 20:27
(pre-merge) to 21,739,546 B at 21:27**. `reusedChunk:false`, so archive sequence 1 was
genuinely CREATED by `SET NX` against production Upstash rather than reusing a slot.
Calibration after the retirement reads `n:533, status MEASURED, hitRate 0.807,
contaminatedFraction 0` — it did not get younger, which is the property archived totals
exist to preserve.

**THE HEALTH READ COULD NOT SEE ANY OF THAT, and that was a real defect.** `/api/brain-shadow`
builds each domain's entry from an explicit ALLOW-LIST of fields, and `compaction` and
`calibration` were not on it. The runtime recorded both and the stored report carried both;
the only surface an operator reads dropped them, so the endpoint whose job is to answer "did
it compact?" could not answer it. Fixed, with an assertion that writes a real cycle and reads
it back THROUGH the handler, so it tests the projection rather than the runtime.

### THE COMPACTION GATE'S OWN INSTRUMENT WAS WRONG, and it passed by luck

PR #14 verified the gate at 60 replay cycles. **It fails at 40 and at 100.** Same code, same
seven domains, three different verdicts. That is not a gate.

The cause was in the audit, not the runtime. `replay-compaction.js` judged recursive structure
by "the late window must not sit entirely above the early window", over windows of **2 to 5
samples**. Direct attribution settled what was actually happening:

- `memory.episodic` holds **exactly 512 records at every post-warm-up cycle, min equal to
  max**. The cap holds. Nothing accumulates.
- Its NODE count wanders in a **33-node band on a base of 72,000**, 28 increments up and 39
  down, OLS slope **0.033 nodes/cycle** over 80 cycles. Per-record composition drifts; the
  record count does not move.

A two-window comparison cannot tell bounded wander from accumulation, so it answered
differently depending on where the windows landed. The verdict now requires TWO conditions: a
slope significant against its own scatter (t > 3), AND a rise over the measured window worth at
least one average retained record. Significance alone fires on 0.09 nodes/cycle, which is real
and about a century from mattering; magnitude alone fires on noise.

**Verified in both directions.** With the corrected verdict the seven-domain state passes at
40, 60 and 100 cycles alike. Raising `RETAIN.episodic` to 100,000 so records genuinely
accumulate makes it fail loudly at **15,095 nodes/cycle, t=95,125** — four orders of magnitude
above the noise floor it now ignores. A gate that never fires would have been the worse
outcome of this fix.

## BATCH 2: five domains installed, 7 of 20 to 12 of 20

Added: **infrastructure, science, intelligence, environment, medicine**. Selected on the
batch-1 criteria, unchanged and in the same order, because those criteria were not a one-off
convenience:

| domain | channels read / declared | coverage | declared relationships | first readable row | cycle ms |
|---|---|---:|---:|---:|---:|
| infrastructure | 17 / 18 | 94% | 0 | 0 | 235 |
| science | 14 / 15 | 93% | 0 | 0 | 107 |
| intelligence | 14 / 15 | 93% | 0 | 0 | 86 |
| environment | 9 / 10 | 90% | 0 | 0 | 63 |
| medicine | 13 / 15 | 87% | 0 | 0 | 66 |

Each declares **zero relationships**, so installing them cannot activate a pathway even by
mistake. Each reads from **row 0**, so its first cycle is falsifiable immediately rather than
silent for three hours. These are the five highest-coverage domains remaining.

Runtime aliases resolved and checked for collision: `science` runs as `research`, `medicine`
as `health`, `trade` as `supplyChain`. Twelve products map to twelve distinct snapshots.

**CULTURE AND RELIGION ARE STILL EXCLUDED, still not for coverage.** Their first readable row
is 373 of 470, so at the 120-row cap they tick ZERO times for three consecutive cycles. A
canary that cannot fail for three hours is the worst kind. They go in behind a cursor that
starts near their first readable row, not before.

**Offline gate for all twelve: passes at 40, 60 and 100 cycles** with the corrected verdict.
Eight domains remain outside the runtime.

### The six fields this file requires of every brain PR

- **evidence gained**: none. Installation is not evidence. No relationship moved, no
  identity count changed, no claim became citable.
- **domains promoted**: infrastructure, science, intelligence, environment, medicine. 7
  installed to 12. (An earlier version of this line listed batch 1's five domains and "2
  installed to 7", which was batch 1's entry left standing under batch 2's heading. Corrected
  2026-08-08 against `registry.INSTALLED_DOMAINS` and the production read.)
- **remaining domains**: 8 outside the runtime.
- **current gate**: hot state growth (NEXT PROGRAM STEP 3). Hard gate before batch 2.
  Production measurement makes it tighter than the offline projection said, not looser.
- **known unknowns**: (a) **actual transport bytes are not measured anywhere**, so no
  bandwidth or billing figure exists for this system, only serialized value lengths;
  (b) the Upstash request-size ceiling for this plan has not been retrieved, and since the
  value length is not the wire length, headroom above the largest SINGLE-DOMAIN value
  (finance, 4,522,058 B at 2026-08-08T13:27Z) is doubly unestablished; (c) the sequential seven-domain batch wall-clock and the per-cycle Redis
  round-trip latency are still unmeasured, because the cycle report records neither;
  (d) the SHAPE of steady-state growth beyond the 15 post-backfill cycles measured so far. It is now measured (below) but
  only over half a day, so whether the per-cycle rate holds, decays, or compounds over
  weeks is not established.

  **STEADY-STATE GROWTH IS NOW MEASURED**, which was listed here as unknown while every
  cycle was still backfill. Over 12 consecutive post-backfill cycles, each applying 1 row
  per domain, the seven-domain total went 22,527,202 to 23,012,849 bytes: **+44,150 bytes
  and +0.19% per cycle.** Per domain the rate is tight, 0.18% to 0.21%, so this is a
  property of the loop rather than of one domain's data. A brain applying ONE row per hour
  still grows, which is the gate's actual subject.

  **Withdrawn from this list, now measured:** "no production cycle has run with 7 domains"
  and "production `stateValueBytes` is unknown". **19 complete seven-domain cycles have
  run**, counted from the recorded `startedAt` values in each domain's history, not copied:
  first 2026-08-07T16:27Z, latest 2026-08-08T13:27Z. **4 of those were backfill** (16:27,
  20:27, 21:27, 22:27 on 2026-08-07, where at least one domain hit the 120-row cap) and
  **15 are post-backfill steady state**. Per-domain `startedAt` differ by under two seconds
  within a cycle, and every domain reported a measured `stateValueBytes` in each. Leaving them listed as unknown after measuring them would make
  this file understate what the system has proven, which is the same defect as overstating
  it.
- **exact next action**: close the hot-state gate (NEXT PROGRAM STEP 3). Restoration is
  settled and steady-state growth is no longer unmeasured: it is **+0.19% per cycle** with
  one row applied per domain, on a resident value already at 23,012,849 bytes for seven
  domains. That is the gate, and it is now quantified rather than anticipated. Not the next
  batch, and not pathway activation: 0 of 10 relationships are analyzer-testable.

### VERIFIED IN PRODUCTION 2026-08-08T22:27Z — the twelve-domain registry executed

The first production cycle of the merged PR #15 registry. Read from `/api/brain-shadow` with
an operator token against `c18a54cd`, not inferred from the merge.

`installedCount: 12`, `totalDomains: 20`, **twelve of twelve `ok: true`, zero errors.** The
whole batch started within 3.5 seconds, 22:27:33.163Z to 22:27:36.674Z.

| product | snapshot | ok | restored | rowsApplied | stateValueBytes | compaction.retired |
|---|---|---|---|---:|---:|---:|
| energy | energy | true | true | 1 | 3,724,240 | 2 |
| finance | finance | true | true | 1 | 3,966,901 | 3 |
| education | education | true | true | 1 | 2,456,680 | 2 |
| economy | economy | true | true | 1 | 3,156,003 | 2 |
| trade | supplyChain | true | true | 1 | 2,923,316 | 2 |
| industry | industry | true | true | 1 | 2,497,433 | 2 |
| population | population | true | true | 1 | 3,023,505 | 2 |
| infrastructure | infrastructure | true | **false** | 120 | 983,401 | 0 |
| science | research | true | **false** | 120 | 710,203 | 0 |
| intelligence | intelligence | true | **false** | 120 | 583,312 | 0 |
| environment | environment | true | **false** | 120 | 670,741 | 0 |
| medicine | health | true | **false** | 120 | 711,270 | 0 |

`stateValueBytesTotal` 25,407,005 over 12 measured domains, **24.23 MiB of value**. The
per-domain figures sum to exactly that, checked rather than assumed.

**WHAT THIS PROVES AND WHAT IT DOES NOT.** It proves the twelve-domain registry executes, that
the five new domains bind and tick against real recorded history, and that per-domain failure
isolation was not needed because nothing failed. It does **not** prove restoration for the five:
`restored: false` is correct for a first cycle, and restoration is the property PR #5 had to
prove separately for the canaries. **The five new domains have exactly one production cycle
each.** Their second cycle is what establishes that their state came back from Redis rather
than being recreated, and it had not run at this measurement.

**DO NOT COMPARE THE `channelsRead` FIGURES ACROSS THESE TWO GROUPS.** `provenance.channelsRead`
is summed over the ticks in the cycle, so the mature seven report 8 to 16 for their single row
while the new five report 427 to 1,702 across 120 rows. Those are occurrence totals at two
different tick counts, not channel counts, and reading the larger numbers as broader sensing
inverts the truth: infrastructure's 1,702 is roughly 14 channels x 120 ticks.

Compaction is running on the seven mature domains and holding them close to flat — energy
3,730,249 → 3,724,240 in-cycle, retiring 2 records into archive sequence 2. The five new
domains retired nothing, which is expected: they have not accumulated enough to trip retention.

---

## BATCH 3: five domains installed, 12 of 20 to 17 of 20 (THIS PR, NOT YET IN PRODUCTION)

**Evidence gained: none.** Installation is not evidence. No relationship moved, no identity
count changed, no claim became citable.

Added: **agriculture, law, defense, technology, governance**. Selected by
`scripts/brain-audit/audit-readiness.mjs` run against the current registry, on the same three
criteria in the same order as batches 1 and 2.

| domain | channels read / declared | coverage | declared relationships | first readable row | tickLoopMs |
|---|---|---:|---:|---:|---:|
| agriculture | 11 / 13 | 85% | 0 | 0 | 90 |
| law | 12 / 15 | 80% | 0 | 0 | 35 |
| defense | 11 / 15 | 73% | 0 | 0 | 71 |
| technology | 7 / 10 | 70% | 0 | 0 | 78 |
| governance | 7 / 12 | 58% | 0 | 0 | 35 |

Each declares **zero relationships**, so installing them cannot activate a pathway even by
mistake. Each reads from **row 0** — 120 ticks, 0 abstentions on the first capped batch — so
its first cycle is falsifiable immediately rather than silent for three hours.

**COVERAGE IS MATERIALLY LOWER THAN EITHER PREVIOUS BATCH, AND THIS IS THE STRONGEST OBJECTION
TO THIS PR.** Batch 1 ran 91-100%, batch 2 86-94%, batch 3 is 58-85%. The batch-1 criterion
said an unavailable input should be "a small, named exception rather than the norm", and at
governance's 5 of 12 unread that criterion is no longer met. It is installed anyway because
the remaining pool contains nothing better, because shadow sensing over the channels that do
read is still legitimate, and because the gap is reported rather than averaged away. The
unread channels, named:

| domain | unread channels |
|---|---|
| agriculture | cornYield (USDA NASS), wheatIndex (FAO FAOSTAT) |
| law | regulationsGov, secEnforcement (SEC Enforcement Actions), scotusOpinions |
| defense | defenseNews, breakingDefense, xinhua, cisaAdvisories |
| technology | patents (USPTO), krebs (Krebs Security), githubAdv (GitHub Security Advisories) |
| governance | corruption, govEffect, ruleOfLaw (all World Bank), gao (GAO Reports), cbo (CBO Publications) |

**None of these five carries a source-identity channel.** `suChannels` is 0 for all five, so
this batch adds sensing and adds **no** distinct observation identities. It moves the evidence
gate by nothing, which is the expected and correct outcome of an installation.

Runtime aliases resolved and checked for collision: seventeen products map to **seventeen
distinct snapshots**, verified by loading the registry rather than by reading the list.

**CULTURE AND RELIGION ARE EXCLUDED FOR THE THIRD TIME, and for the third time not for
coverage** — religion reads 15/15 and culture 15/16, the two best figures in the entire
roster. Their first readable row is 373 of 470, so at the 120-row cap they tick ZERO times for
three consecutive cycles and cannot fail during them. They go in with **communication** as
batch 4, behind a cursor that starts near their first readable row.

**Communication (6/11, 55%) is held to batch 4** as the sixth of the six row-0 domains, since
batch 3 takes five.

### The six fields this file requires of every brain PR

- **evidence gained**: none. No pathway activated, no distinct identity added, nothing became
  citable. The only thing that changed is how many domains will sense in shadow.
- **domains promoted**: agriculture, law, defense, technology, governance. 12 installed to 17.
- **remaining domains**: 3 outside the runtime — communication, culture, religion.
- **current gate**: unchanged, hot state growth. The bounded-growth replay is the instrument
  and this PR re-runs it across all seventeen rather than assuming batch 2's result carries.
- **known unknowns**: (a) the five batch-2 domains have **one** production cycle each, so
  their restoration across invocations is unproven; adding five more before that second cycle
  lands means seventeen domains will be executing while ten of them have never demonstrated
  restore; (b) production `stateValueBytes` for these five is unknown until their first cycle,
  and the offline figure is a floor because fixtures stop at 470 rows; (c) the sequential
  seventeen-domain batch wall-clock is unmeasured, but it is **not a plausible risk and this
  file should stop implying it is**: the twelve-domain cycle spanned 3.5 s from the first
  domain's `startedAt` to the last's `finishedAt`, and `vercel.json` sets `maxDuration: 800`
  for `api/**`. That is roughly 230x headroom. The 3.5 s figure is in-function batch time and
  excludes cold start and the HTTP round trip, so it is a floor for the invocation, not the
  invocation; (d) **actual
  transport bytes are still not measured anywhere**, so no bandwidth or billing figure exists;
  (e) resident value at 24.23 MiB for twelve, where the seven mature domains average 3.03 MiB
  and the five new ones 0.70 MiB and rising — a seventeen-domain steady state is therefore a
  projection above 50 MiB, and compaction bounding it is proven only in replay.
- **exact next action**: merge, then read `/api/brain-shadow` after the first `:27` cycle and
  confirm `installedCount: 17` with seventeen `ok: true`. Record the production
  `stateValueBytes` per domain here. Not batch 4, and not pathway activation.

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
   - Batches 1, 2 and 3 (5 domains each) are done. **3 remain**: communication, culture,
     religion. (This line read "Batch 1 (5 domains) is done. 13 remain" through both the
     batch-2 and compaction PRs. Corrected 2026-08-08 against `registry.INSTALLED_DOMAINS`.)
   - **BATCH 4 IS NOT A REPEAT OF THIS PATTERN.** Culture and religion need a cursor that
     starts near their first readable row (373 of 470) before installation means anything,
     and that is a runtime change, not a membership change. Communication is a plain install.

3. **MANDATORY GATE BEFORE BATCH 2, bound hot state growth.** Batch 2 must not be
   installed until this is closed, and it is a hard gate, not a preference.

   **What was measured, and in which unit.** The COMPLETE persisted value
   `{runtime, domain, lastRowT, savedAt, loop}` that the runtime writes, not the loop
   alone. An earlier revision of `audit-growth.js` measured `LOOP.serialize(loop)` by
   itself and labelled it the stored state value, so its figures were smaller than what
   production stores and disagreed with `audit-cost.js` at the same depth. Both scripts
   now import one shared envelope definition and their 120-row figures agree exactly for
   all 20 domains. Re-measured after that fix, the numbers moved by roughly 0.1 KiB per
   domain: the envelope is a fixed overhead, so the SHAPE of the curve is unchanged, and
   growth is still roughly linear with no plateau within the fixture.

   These are value lengths, not wire bytes; see the unit note in BATCH 1.

   | replay depth | economy | finance | infrastructure |
   |---|---|---|---|
   | 120 rows | 633.8 KiB | 659.0 KiB | 928.9 KiB |
   | 240 rows | 1,268.3 KiB | 1,787.8 KiB | 1,833.5 KiB |
   | 360 rows | 2,118.7 KiB | 2,798.8 KiB | 2,686.6 KiB |
   | full replay | 2,834.8 KiB | **3,761.9 KiB** | 3,472.5 KiB |

   Composition of finance at 470 ticks: `memory` 2,398 KB (64%) and
   `registry.predictions` 763 KB (656 open, 611 resolved). Both accumulate per tick.
   `lib/brain-shadow-store.js` enforces no size ceiling.

   **Why it gates the batch and not this one.** Every cycle reads the whole state and writes
   it back, so a value that grows without bound grows the work of every future cycle.

   **THREE DIFFERENT NUMBERS, AND AN EARLIER DRAFT PRESENTED THE SMALLEST AS CURRENT STATE.**
   It said "at 7 installed domains the total is 4.30 MiB and is manageable". That figure is
   the OFFLINE cold-start estimate, production was already far past it, and "manageable" was
   asserted with no capacity measurement behind it. All three faults are corrected here:

   | figure | value | what it is |
   |---|---:|---|
   | offline cold-start estimate | 4,509,591 B (4.30 MiB) | 7 domains, first capped 120-row cycle, replayed from fixtures |
   | **latest verified PRODUCTION resident value** | **23,012,849 B (21.95 MiB)** | 7 domains, cycle of 2026-08-08T12:27Z, all seven measured in that single cycle |
   | offline 20-domain projection | 50.09 MiB | full replay of 20 fixtures. A FLOOR, not a worst case |

   Production is **5.10x** the offline estimate for the same seven domains. No capacity claim
   is made: the Upstash request ceiling has not been retrieved, per-cycle latency is not
   recorded, and transport bytes are unmeasured, so there is nothing here that supports
   calling any of it manageable or unmanageable.

   Installing 13 more before bounding growth commits every subsequent cycle to carrying it.

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
     figure and no billing figure for this system, and the request-size headroom cannot be
     established either.

     The value to size that headroom against is the **largest SINGLE DOMAIN** in production,
     because that is what one request carries. A total across seven domains is seven
     requests, not one, and must not be compared with a request ceiling. Latest verified:
     **finance, 4,522,058 B (4.31 MiB), cycle 2026-08-08T13:27:04.663Z**. The offline
     3.67 MiB full-replay figure is a floor from fixtures and is now superseded by that
     measurement. This belongs to THIS milestone and was deliberately kept out of the
     batch-1 installation PR.
   - re-measure against production and record the new curve here

   **Not attempted in this PR, deliberately.** Compaction touches the kernel's memory and
   prediction registry, which every existing measurement depends on. Bundling it with a
   membership change would make a regression in either one impossible to attribute.

5. **REACHABILITY IS NOW A TESTED INVARIANT.** `brain-v2/test/deployment-invariants.js`
   fails CI if `api/[...route].js` loses the `brain-shadow` registration, if
   `vercel.json` loses the `:27` cron, if a SECOND execution-capable brain cron exists on
   any schedule, or if any cron targets a route that does not resolve to a loadable handler.
   It does not reserve the `:27` minute: an unrelated job may use it.
   It also refuses a duplicate registration, a registration whose module does not resolve,
   a `HANDLERS` declared anywhere but the router's top-level binding, and a dedicated
   `api/brain-shadow.<ext>` or `api/brain-shadow/index.<ext>` that would shadow the
   catch-all. Each of those is a named negative control inside the test.

   **It also checks the EFFECTIVE route, not only the initializer.** The router reads
   `HANDLERS[name]` at request time, so `HANDLERS['brain-shadow'] = require(...)` after the
   declaration, directly or through an alias, redirects the route while leaving every static
   assertion green. The test loads `api/[...route].js` in a sandbox with each handler
   replaced by a stub that records its own name, dispatches a request, and asserts the
   brain-shadow stub is the one that ran. No real handler executes and the module cache is
   untouched. Both mutation forms are negative controls.

   **No pass/fail counts are recorded here.** Four revisions of that test ran 9, 14, 21
   and 28 assertions, and every copied count went stale the moment coverage improved,
   which cost more review cycles than the guard itself. Run
   `node brain-v2/test/deployment-invariants.js` for the current numbers; CI runs it on
   every pull request.

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
   rule. Serialized value all 20: 11.53 MiB after the first capped **120-ROW** cold cycle,
   50.09 MiB at full replay. Rows, not ticks: culture and religion execute ZERO ticks inside
   those 120 rows, because their readable data starts at row 373, so the two depths are not
   interchangeable and comparing them would misstate the growth baseline.

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
