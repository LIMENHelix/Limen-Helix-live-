# Transmutation R3: Homestead and domain business-front proof

**Measured:** 2026-09-25

**Branch:** `codex/r3-homestead-p0-p10-fronts`

**Base:** `69b675366fd5a92a9bf2f1b664d0b21dc4acbb84`

## Scope proved

- one read-only `businessCapitalBand` ladder covers all 20 public domain fronts;
- five bands cover P0-P10 exactly once per domain, for 100 evidence-labelled venture records;
- `businessCapitalBand` remains separate from the live `domainCyclePhase` namespace;
- the Population Homestead Deal Desk and Agriculture Farm Operations Desk remain separate businesses,
  owners and runtime lanes;
- no new provider, payment, treasury, checkout, valve or motor authority was added;
- the public Homestead page now names autonomous transaction, closing and profit as `UNMEASURED`.

## Production baseline before this change

Read-only request:

```text
GET https://limenhelix.com/api/agriculture-homestead-status
HTTP 200
switchEnabled: false
decisions: 0
commands: 0
observations: 0
readOnly: true
liveMoney: false
```

Page probes returned HTTP 200 for `/home` and `/agriculture`. The gated
`/api/homestead-status` route returned HTTP 403 without operator credentials, as expected.

This establishes only a pre-commissioning baseline. It does not establish a Homestead sale,
closing, profit, signed provider response or autonomous business outcome.

## Contract tests

```text
> node scripts/test-domain-business-ladders.cjs
domain business ladders: 20 domains, 100 band records, P0-P10 namespaced, Homestead identities separated: PASS

> node scripts/test-calcstack-domain-tools.cjs
20 fronts mapped, 16 embeds, 4 explicit gaps: PASS

> node scripts/test-front-controller-contract.cjs
13 fronts, 11 ids pinned, telescope gone: PASS

> node --check assets/js/domain-business-ladder.js
exit 0
```

## Browser proof

A local static server was checked in a browser at desktop and 390x844 mobile sizes.

```text
Population:   1 ladder, 5 cards, namespace businessCapitalBand
Agriculture:  1 ladder, 5 cards, namespace businessCapitalBand
Intelligence: 1 ladder, 5 cards, namespace businessCapitalBand
Home:         UNMEASURED autonomous outcome disclosure present
Mobile:       Population, Agriculture and Energy ladders render as one column
```

The ladder itself introduced no horizontal overflow. Existing full-viewport hero/canvas elements
remain the widest elements on Agriculture and Energy and are outside this change.

Browser verification exposed a pre-existing unescaped apostrophe in an Intelligence inline script.
That parser error is fixed here and guarded by the new test; the reloaded page produced no new
warning or error logs.

## Full repository proof

```text
> npm test
repository check: 2173 JavaScript files parsed; 4964 JSON files parsed; 68 cron targets;
123 canonical nodes; 334 modules loaded; 0 skip-listed; 0 failed
harness: 68 Vercel crons; 8 GitHub crons; 6 globally valved jobs;
27 outward-effect jobs; 0 heartbeat exceptions
unit: 323 files; 322 passed; 1 skipped (external corpus unavailable); 0 failed
elapsed: 219.1s
```

## Deployment state

`UNMEASURED` at commit time. Production acceptance requires the merged commit SHA to equal the
Vercel production deployment SHA, followed by HTTP and browser probes of the published registry,
renderer, representative domain fronts and Homestead disclosure. Post-merge evidence belongs in
the pull-request record so it cannot be confused with this pre-deploy proof.
