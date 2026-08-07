# brain-audit

The read-only measurements behind the batch-1 domain selection (PR #7) and the
bounded-hot-state gate recorded in `brain-v2/DELIVERY_STATE.md`.

Nothing here writes, fetches, or touches Redis. Each script replays the committed
`brain-v2/fixtures/*-recorder.json` through the SAME binder call and kernel loop the
runtime uses, so the numbers describe the real path rather than a helper written to
produce them. Run from the repository root:

    node scripts/brain-audit/audit-readiness.js   # per-domain readiness: channels, identity, relationships, cycle cost
    node scripts/brain-audit/audit-onset.js       # where each domain's readable data STARTS, and unavailable inputs
    node scripts/brain-audit/audit-cost.js        # serialized state value size after one 120-row cycle
    node scripts/brain-audit/audit-growth.js      # how that size grows at 120 / 240 / 360 / full replay

`*-out.json` are the outputs as measured at `2ead52f2`, kept so a later run can be
diffed against them rather than compared from memory.

UNIT WARNING, because this was got wrong once and corrected in review: the sizes are
the UTF-8 length of the serialized state VALUE. They are not bytes on the wire. The
Upstash REST transport re-encodes the value and adds an envelope, so these must not be
doubled into bandwidth, projected into a bill, or compared with a request-size ceiling.
They measure relative growth, which is what the batch-2 gate turns on.
