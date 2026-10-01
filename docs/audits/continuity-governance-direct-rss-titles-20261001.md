# Governance direct RSS evidence retention

GovTrack, Congress.gov, GAO Reports and CBO Publications direct-success paths
counted RSS items and retained collection identity, while discarding available
headline metadata. Their fallback aggregator paths already retained headlines.
The direct paths now use the existing `rss-evidence.extract` helper to preserve
source titles, links, dates and supplied publisher labels.

Actual-fetcher fixtures verify all four direct source URLs are fetched once,
two items remain counted, the source-provided first title/link/date/label are
retained, and the second item's absent provenance remains null. Collection
identity remains source-derived. Activity formulas, fallback routing, ownership,
phase and brain are unchanged. Publisher label is not independence or authority.

The additional combined-title-feeds scenario now joins those four actual RSS
readings and the two actual institutional readings in one snapshot. Actual
feed-record writes four whole title sets from that snapshot using isolated
memory and explicit test-only auth/heartbeat stubs. The native brain uses that
same snapshot and derives three active diagnoses/eight handoffs. The candidate
uses the stored parser titles and exact native packet/RESEARCHABLE opportunity.
Actual native cognition records a durable NO_ACTION decision containing
`governance-immune-veto`. Keyed readback and exact replay preserve decision
identity. Executor remains HELD, makes zero publisher calls, and the existing
operator reader exposes exact packet/blockers with no command or external
authority. Executor/readout leave state unchanged. The count-only institutional
scenarios retain their independent source refusal.

This proves a LOCAL/FIXTURE source-to-native safe boundary, not current production
source authenticity or publication, independent outcome, revenue or learning
after execution. No cognition permission or provider receipt is invented.

Focused fetcher/native and existing title-transport tests pass. Full-suite
validation passed: 366 tests, one existing external-corpus skip, zero failures
in 201.9 seconds. Repository and harness checks pass. No external provider, production storage or deployment
is performed. Google Docs remains deferred until whole-goal completion.
