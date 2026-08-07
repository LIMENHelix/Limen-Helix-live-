# brain-audit

Read-only measurements behind the batch-1 domain selection and the bounded-hot-state gate
recorded in `brain-v2/DELIVERY_STATE.md`.

Nothing here fetches, deploys, or touches Redis. Each script replays the committed
`brain-v2/fixtures/*-recorder.json` through the same binder call and kernel loop the runtime
uses. Run from anywhere; paths resolve against the script, not the caller's directory.

    node scripts/brain-audit/audit-readiness.mjs   # per-domain readiness: coverage AND analyzer eligibility
    node scripts/brain-audit/audit-onset.js        # where each domain's readable data STARTS, unavailable inputs
    node scripts/brain-audit/audit-cost.js         # serialized state value size after one 120-row cycle
    node scripts/brain-audit/audit-growth.js       # how that value grows at 120 / 240 / 360 / full replay

`*-out.json` are the outputs as regenerated after the corrections below, so a later run is
diffed rather than compared from memory.

## Four defects the first version shipped with, all found in review

These are recorded because each one produced a number that looked authoritative and was not.

**1. Source-identity coverage was reported as relationship eligibility.** The audit called a
relationship eligible when both sides carried >= 6 distinct source keys. That is not the
rule. `scripts/build-brain-fixture.mjs` is the authority and additionally requires each side
to be MOVING (`distinctValues >= 2`): a channel that never changes value has nothing to
observe however often its publisher restamps it. `audit-readiness.mjs` now **imports**
`analyze`, `loadManifest`, `testableRelationships` and `MIN_OBSERVATIONS` from that analyzer
rather than re-deriving them, and prints coverage and eligibility as separate columns
because they answer different questions.

**2. `String.length` was labelled bytes.** It counts UTF-16 code units. Now
`Buffer.byteLength(value, 'utf8')` everywhere, matching what `lib/brain-shadow-store.js`
actually measures. Measured effect: about 0.4% larger totals. Real, but no conclusion moved.

**3. The installed set was hardcoded** as `['energy','finance']`, so it would have kept
reporting two after batch 1 made it seven. Now derived from `REG.INSTALLED_DOMAINS`.

**4. Kernel-loop timing was called cycle cost.** The field is now `tickLoopMs` and it times
`readRecorderRow` plus `LOOP.tick` and nothing else. A real cycle also performs a state
read, `LOOP.serialize` of a multi-megabyte object, a stringify, a state write, a cycle
write, an LPUSH, an LTRIM and a read-back LRANGE: seven Redis round trips in total
(state GET, recorder LRANGE, state SET, cycle SET, history LPUSH, history LTRIM, history
LRANGE), plus their latency. Serialization alone grows with state and is unbounded. The excluded work is
substantial and is not measured here.

## Unit warning

The sizes are the UTF-8 length of the serialized state **value**. They are **not** bytes on
the wire. The Upstash REST transport nests the value in a JSON command array, escapes it
again, and adds an HTTP envelope; a GET adds a response envelope. So these must not be
doubled into bandwidth, projected into a bill, or compared with a request-size ceiling.
Earlier versions printed all three of those; they were withdrawn.

What the numbers are good for is **relative growth of hot state**, which is what the
batch-2 gate turns on. Actual transport-byte measurement requires instrumenting
`lib/brain-shadow-redis.js` and belongs to that milestone.
