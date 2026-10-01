# Agriculture drought input validation

The actual USDA Drought Monitor fetcher in `handlers/domain-snapshot.js`
previously used `parseFloat(value) || 0`. Malformed or missing D2 values became
zero before its NaN check and returned a live, zero-stress drought reading.
Malformed D3 values similarly became zero in the reported signal.

The existing fetcher now returns null with source-health fallback reason
`invalid cumulative D2/D3 percentages` for missing, non-finite, partially
numeric, negative or out-of-range values, or D3 greater than D2. Valid zero
remains a reading. The stress formula and valid source-date identity are unchanged.
The existing snapshot aggregator retains responsibility for its fallback behavior;
this change does not equate a missing reading with a domain motor HOLD.

The actual fetcher is exercised through stubbed HTTP text in
`scripts/test-source-collection-contracts.js`: valid 14.5/5.5 returns stress
0.29 and exact source date; nine malformed/inconsistent cases return null;
zero/zero returns zero; a later valid response recovers. Agriculture server
refresh and repository/harness checks passed. Full-suite validation finished:
363 passed, one existing external-corpus skip, zero failed in 222.5 seconds.

This is LOCAL/FIXTURE source-parser proof. It does not prove current upstream
availability, snapshot-to-native-packet composition, provider execution,
returned outcomes or revenue. No brain, phase, portal data, production
configuration or Homestead lane was changed. Google Docs remains deferred.
