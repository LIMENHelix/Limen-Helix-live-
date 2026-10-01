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
snapshot assembler; the protected base brain's feed projection omits
`sourceUpdatedAt`, so the downstream packet carries snapshot identity, not a
claim of complete per-source date continuity. Protected brain changes remain
outside current scope. The saved JSON makes these levels inspectable.

Focused source-join and existing twenty-domain native-spine tests passed.
The previous runtime parser repair passed the full suite (363/1 skip/0 failures);
this increment adds test and evidence only. Google Docs remains deferred until
the complete goal audit passes.
