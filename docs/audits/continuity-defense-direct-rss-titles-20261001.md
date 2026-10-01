# Defense direct RSS title transport

Defense News and NATO News direct RSS success paths counted items while
discarding headline evidence. Defense News retained collection identity but
NATO did not. Their fallback aggregator paths already returned title arrays.
This asymmetry left direct-source success without evidence the existing title
recorder and publication source reader could consume.

Both direct paths now use the existing `rss-evidence.extract` helper to retain
source titles, item links, publication dates and supplied publisher labels.
NATO additionally uses the existing collection identity helper. Counts,
activity formula, fallback routing, source classification and brain are unchanged.
Missing fields remain null; a label is not publisher independence.

The Defense source-join test additionally runs these two actual direct fetchers,
actual snapshot assembler and actual feed-record handler with fixture HTTP and
memory-only storage. Recorder auth and heartbeat are explicitly stubbed in that
test module; this grants no production authorization. Two whole title sets/four
linked items persist and the existing publication source collector accepts the
four source records. Missing second publisher label remains null.

The subsequent combined-title-feeds scenario composes all four actual parser
outputs into one snapshot. That same snapshot enters the actual title recorder
and native Defense brain. The publication candidate uses the resulting stored
titles and exact native packet/research opportunity. Actual native cognition
records NO_ACTION with `defense-immune-veto`, keyed durable readback and stable
decision replay. The executor remains HELD with zero publisher calls. Existing
operator readout retains exact packet/blockers with no command or external
authority, and execution/readout leave stored values unchanged.

The count-only inputs remain separately tested and correctly source-refused.
No immune permission, diagnosis, opportunity, title-set receipt, command,
publication, independent outcome or revenue is fabricated. No external feed or
production Redis/provider was accessed. Full-suite validation passed:
365 passed, one existing external-corpus skip, zero failures in 220.1 seconds.

Focused Defense join, title transport (51 assertions), RSS identity (three
contracts), repository and harness checks pass. Google Docs remains deferred.
