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

This increment proves parser retention. It does not yet join these four title
feeds through the recorder into the same institutional/native Governance
snapshot and publication decision. That remains the next safe transition;
the count-only institutional scenarios still refuse publication without titles.

Focused fetcher/native and existing title-transport tests pass. Full-suite
validation passed: 366 tests, one existing external-corpus skip, zero failures
in 201.9 seconds. Repository and harness checks pass. No external provider, production storage or deployment
is performed. Google Docs remains deferred until whole-goal completion.
