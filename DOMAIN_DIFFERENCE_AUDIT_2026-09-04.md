# Domain Difference Audit — 2026-09-04

## Scope and safety boundary

This audit compares the 20 product domains, their live runtime surfaces, and
their company-portal routing. It does not make every domain identical. Domain
specialization, evidence abstentions, activation gates, aliases, and the
isolated Infrastructure path are preserved unless a measured failure crosses
an existing contract.

No company JSON, domain JSON, validation status, lane policy, protected file,
quarantined file, scoring record, diagnosis digest, authoring queue, or portal
content was rewritten. The only repair in this change is read-time routing in
the company renderer, plus read-only audit and test coverage.

## Measured repair: company portal → domain portal

Production reproduction before the repair:

```text
https://limenhelix.com/company-portal?company=ride
visible domain link: supplyChain → /supplyChain_portal.html
click result: 404 NOT_FOUND
```

The corpus contains 799 company identity records. All 799 preserve a
`portalAttachment` using a hyphenated filename convention (for example,
`energy-portal.html`), while the deployed portal files use underscores (for
example, `energy_portal.html`). Runtime and historical aliases add a second
failure mode:

| Raw identity | Records | Canonical product domain | Existing target |
|---|---:|---|---|
| `supplyChain` | 73 | `trade` | `trade_portal.html` |
| `health` | 1 | `medicine` | `medicine_portal.html` |
| `legal` | 2 | `law` | `law_portal.html` |

The repair resolves the domain at the presentation boundary. The source label
and `portalAttachment` stay untouched as authored provenance; both company
portal links use the resolver's existing `portalKey`. The same canonical value
selects domain-specific renderer sections, so the two `legal` records now use
the Law presentation.

Proof:

```text
node scripts/audit-company-portal-domain-routing.js
companyRecords: 799
rawDomainLabels: 23
canonicalDomains: 20
staleAttachmentRecords: 799
failures: []

local browser: /company-portal.html?company=ride
Identity link: Supply Chain → /trade_portal.html
Domain Pipeline link: Supply Chain → /trade_portal.html
clicked result: LIMEN HELIX · TRADE & LOGISTICS (HTTP page loaded)

local browser: /company-portal.html?company=legalzoom
canonical footer: LAW DOMAIN
Law panels present: Litigation Portfolio, Compliance Status,
Judicial Independence & Rule-of-Law, Access-to-Justice Capacity
```

## Differences intentionally preserved

### Domain brains and activation

`node scripts/audit-product-domain-brains.js --require-complete` reports 20/20
separate brains with complete common-core and authority surfaces.
`node scripts/audit-product-domain-energy-parity.js` reports 20/20 complete
local depth: Energy remains the single custom reference and the other 19 are
domain-local extensions; none are generic ports.

The activation differences are evidence gates, not missing code:

- Phase actuation is enabled in 9 domains and inhibited in 11. The brain-local
  comments tie the gate to a P3/P7-family signal and a real output effector.
- Phase percept is armed only in Energy. The generic mechanism is installed in
  every domain, but the audit explicitly treats the other 19 as not armed.
- All external motors remain inhibited. The business-executor audit reports
  20/20 declared executors, receipts, observers, and rollback paths, but 0/20
  production-verified external autonomy. Enabling them would be a policy and
  evidence change, not parity repair.
- Infrastructure remains on its documented isolated path. Its portal-to-brain
  translation and diagnosis override are load-bearing and were not templated.

### Agriculture's smaller diagnosis surface

`node scripts/audit-diagnosis-surface.js` proves that Agriculture has 106 issue
entries, 98 unique authored IDs, and a 98-entry digest. Its digest therefore
covers the full available diagnosis surface. The other 19 domains reach the
180-entry working-set cap. Agriculture's 500 deep directives are treatment
candidates, not additional diagnoses, and were not promoted by counting.

### Cross-domain source overlap

`node scripts/audit-cross-domain-edge-candidates.js` reports 75 overlapping
pairs, all rejected as shared-provider overlaps, and zero distinct-provider
corroboration candidates. No edges were created merely to make domains look
more alike.

### Runtime count cardinality

The live domain snapshot's metadata counts unique upstream health checks;
per-domain rows count placements of those sources. Reused providers such as
CISA KEV and NOAA NWS therefore make placement totals higher. This is a
cardinality difference, not missing sources.

## Measured differences that remain open

### Stress promotion abstention

At the observed production worker snapshot, grounded CISS stress existed for
20/20 domains, while the phase estimator grounded 15/20. Energy, Industry,
Education, Defense, and Law abstained, so the explicit worker gate preserved
their legacy feed stress. The visible consequence for Energy was material:

```text
Energy displayed stress: 1.000 (legacy feed, stressBasis=clamped)
Energy groundedStress:    0.679
Energy phaseBelief:       grounded=false, confidence=0
```

The protected estimator's precision floor must not be relaxed to force parity.
The worker currently omits `est.degraded` from `phaseBelief`, so production does
not expose the exact abstention reason or per-channel precision. The safe next
step is telemetry-only: surface that existing result, observe consecutive
ticks, and then separately decide whether an estimator abstention should keep
the legacy feed value or fall back to grounded CISS stress. This change does
neither.

### Portal-content quality

The genericity audit reports 54 of 799 v2 portals below its 0.70 anchored-note
threshold. The largest groups are Medicine (13), Law (6), and Environment (5).
These are individual content-review candidates, not authorization for a bulk
rewrite. The older portal-quality truncation heuristic flags 793/799 and is too
broad to act on without item-level review.

### Live source failures

The read-only source-identity audit found four current no-reading rows: Event
Registry (Culture), SIPRI Arms Trade (Defense), JTA Jewish News (Religion), and
Guttmacher Institute (Population). Each is correctly classified
`blocked-source-unavailable`; no timestamp or value was inferred.

## Verification

```text
npm test
repository check passed
251 passed, 1 skipped, 0 failed

Skipped by explicit contract:
brain-v2/test/corpus-foundation.js — external corpus root unavailable
```

The repository test above was rerun against the final working tree after both
company-portal link surfaces were routed through the resolver.
