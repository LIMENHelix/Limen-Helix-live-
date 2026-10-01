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

This title transport is separately tested from the OFAC/CISA native brain path.
It does not yet prove a combined same-snapshot native publication decision, and
the count-only inputs remain correctly source-refused. No external feed or
production Redis/provider was accessed. Full-suite validation passed:
365 passed, one existing external-corpus skip, zero failures in 220.1 seconds.

Focused Defense join, title transport (51 assertions), RSS identity (three
contracts), repository and harness checks pass. Google Docs remains deferred.
