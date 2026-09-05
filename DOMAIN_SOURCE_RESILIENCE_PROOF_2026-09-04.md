# Domain Source Resilience Proof — 2026-09-04

## Scope

This change repairs one measured shared-provider failure class without rewriting domain
specialization. Economy keeps BLS Employment, Supply Chain keeps BLS Freight PPI, and Industry
keeps BLS Manufacturing PPI. Their adapters now share one publisher-supported batch request and
bind their own observations by exact BLS `seriesID`.

No domain JSON, company portal, domain weight, validation status, phase/stress policy, protected
file, quarantined file, or source label changed. Culture's Event Registry row remains explicitly
unavailable while `EVENT_REGISTRY_API_KEY` is unset. The existing Culture RSS source is not
substituted or mislabeled as Event Registry.

## Before measurement

Production snapshot `1788566006754-264` had four no-reading rows:

```text
Economy / BLS Employment             blocked-source-unavailable — BLS daily threshold reached
SupplyChain / BLS Freight PPI        blocked-source-unavailable — BLS daily threshold reached
Industry / BLS Manufacturing PPI     blocked-source-unavailable — BLS daily threshold reached
Culture / Event Registry             blocked-source-unavailable — EVENT_REGISTRY_API_KEY not set
```

The three BLS fetchers each independently posted one series to the same endpoint. The configured
registration key therefore paid three quota units for every uncached domain snapshot. BLS also
echoed that key in its quota message, which made the public `sourceHealth.reason` unsafe.

## Repair contract

- One in-flight BLS request contains all three exact publisher series IDs.
- Each domain adapter selects by `seriesID`; response order cannot cross-wire domains.
- Successful monthly results are reused for six hours inside a warm runtime.
- Failed or quota responses are not cached.
- Any configured registration key is replaced with `[redacted]` before a BLS message reaches
  source health.
- The endpoint's existing 25-second CDN response policy and all domain scoring formulas remain
  unchanged.

## Live publisher proof

Exact command, run without a registration key:

```powershell
$body = @{ seriesid = @('CES0000000001','PCU484121484121','PCUOMFG--OMFG--'); startyear = '2025'; endyear = '2026' } | ConvertTo-Json -Compress
$reply = Invoke-RestMethod -Method Post -Uri 'https://api.bls.gov/publicAPI/v2/timeseries/data/' -ContentType 'application/json' -Body $body -TimeoutSec 30
[pscustomobject]@{ status=$reply.status; message=($reply.message -join ' | '); seriesCount=@($reply.Results.series).Count; seriesIds=(@($reply.Results.series | ForEach-Object {$_.seriesID}) -join ',') } | ConvertTo-Json -Compress
```

Output:

```json
{"status":"REQUEST_SUCCEEDED","message":"","seriesCount":3,"seriesIds":"CES0000000001,PCU484121484121,PCUOMFG--OMFG--"}
```

## Deterministic proof

```text
node scripts/test-bls-batch-resilience.js
BLS batch resilience: 17/17 passed

node scripts/test-source-collection-contracts.js
source collection contracts: 34/34 passed
```

The first proof deliberately returns the three publisher series out of order. It measures one
network request for three concurrent adapters, exact values routed to their proper domains, cache
reuse, failure non-caching, and secret redaction.

## Full repository proof

```text
npm test
repository check passed
  javascript parsed : 2006
  json parsed       : 4963 (2 skipped over the size cap)
  cron targets      : 52
  canonical nodes   : 123 (_meta.total enforced)

running 256 test files
255 passed, 1 skipped, 0 failed, 331.6s
```

The one skip is the repository's explicit external-corpus prerequisite:
`brain-v2/test/corpus-foundation.js` reports that `LIMEN_CORPUS_ROOT` is unavailable.

## Production acceptance

UNMEASURED before deployment. Acceptance requires an exact-SHA production deployment followed by
a fresh `/api/domain-snapshot` source-identity audit. The expected bounded movement is the three
BLS rows returning live after the publisher's daily quota is available. Event Registry remains a
separate credential gap and is not part of that expected movement.
