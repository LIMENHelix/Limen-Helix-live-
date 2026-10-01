# Agriculture source-to-native-handoff join

`scripts/test-continuity-agriculture-source-join.cjs` composes the actual USDA
Drought Monitor CSV fetcher and NOAA CPC outlook HTML fetcher, the actual private
snapshot assembler, native Agriculture brain cycle, server packet builder,
durable handoff consumer and autofire eligibility check. Transport is fixture
HTTP and memory storage; portal reads use checked-in JSON. No diagnosis,
opportunity, motor candidate or neurology is supplied to the brain.

Four fresh native runtime scenarios are exercised:

| Scenario | Assembled stress | Basis | Native opportunities |
|---|---:|---|---:|
| Valid drought plus outlook | 0.77 | measured | 4 |
| Malformed drought plus valid outlook | 0.30 | clamped / low signal | 1 |
| Valid zero drought plus outlook | 0.32 | measured | 1 |
| Valid recovery | 0.77 | measured | 4 |

The malformed drought source is broken, null-valued, not live, with the exact
parser failure reason. A valid outlook remains live. The existing assembler
therefore caps pressure with low-signal semantics rather than discarding all
domain sensing. Valid zero does not imply zero domain stress because the
independent outlook contributes pressure. Every scenario produces a native
packet and keyed handoffs. Exact replay creates no additional handoffs and
preserves stored values. The worker rejects both stored native handoff and raw
opportunity as an eligible actor candidate, with no dispatch or state mutation.

The next unproven edge remains
`native-agriculture-handoff-is-not-eligible-autofire-actor-candidate`.
No PENDING actor, ticker, research selection, capability or receipt is invented
to cross it. Homestead is excluded. Separate routing/outcome tests remain
separate evidence, not a composed result of these native handoffs.

Fixture bodies use identified upstream URL shapes and a fixture source date.
This does not establish publisher authenticity, current live availability or
current production observations. Individual source dates are retained by the
snapshot assembler. The protected base brain's feed projection omits
`sourceUpdatedAt`. A subsequent repair now projects the refresh handler's same
snapshot source evidence separately into the server packet and keyed handoff,
including source date, fetched time, value, live/classification/failure fields
and stress basis. It preserves observation-only owner identity; mismatched
owner is refused. The protected brain remains unchanged. This records snapshot
provenance rather than authenticating a publisher or granting release authority.
The saved JSON makes these levels inspectable.

Focused source-join and existing twenty-domain native-spine tests passed.
The previous runtime parser repair passed the full suite (363/1 skip/0 failures).
The source-evidence capture repair now also passes a fresh full suite: 364 passed,
one existing external-corpus skip, zero failures in 204.3 seconds. Repository,
harness, packet and snapshot-input contracts pass. Google Docs remains deferred
until the complete goal audit passes.
