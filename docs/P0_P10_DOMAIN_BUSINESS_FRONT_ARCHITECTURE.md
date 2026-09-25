# P0-P10 domain business-front architecture

**Status:** strategy and public truth surface; no new effect authority

**Machine source:** `assets/data/domain-business-ladders.json`

**Front renderer:** `assets/js/domain-business-ladder.js`

## Decision

Every sovereign domain front may show a P0-P10 **business capital ladder**, but that ladder is a
separate namespace from the domain's current P0-P10 **cycle phase**.

- `domainCyclePhase` answers: where does the sensed system currently sit in the conceptual cycle?
- `businessCapitalBand` answers: how capital-intensive is a candidate intervention or venture?

The labels deliberately share the owner's P0-P10 grammar while the namespaces prevent one from
laundering the other. A domain at P3 does not automatically need a P3 business. Stress does not
create authority, capital entitlement or a company. A business is an optional regulatory
intervention selected from established evidence and separately admitted by the owning domain.

## Fractal capital rule

| Business band | Capital | Typical revenue | Function |
|---|---:|---|---|
| P0-P1 | none to minimal | attention, referral, affiliate or lead revenue | observe and attract |
| P2-P3 | low | subscription, alert and transaction revenue | monitor and diagnose |
| P4-P5 | low to moderate | project, managed-service and B2B retainer revenue | operate and stabilize |
| P6-P7 | moderate to high | institutional contracts, APIs and licensing | coordinate at scale |
| P8-P10 | highest | platform, portfolio and productive-asset returns | own and renew |

Each band reuses what the band below proved: sources become calculators, calculators become paid
monitoring, monitoring becomes an operating desk, the desk becomes an institutional system, and
only then may the system consider owned assets. A higher band may start only from:

1. measured and reconciled surplus below it;
2. a separately budgeted Finance funding or lending contract; or
3. explicit owner/angel capital under its own authority ceiling.

Projected revenue is not surplus. Checkout intent is not settlement. A provider receipt is not an
independent business outcome. No card on the public front changes those distinctions.

## Public status vocabulary

The front uses evidence statuses rather than a single "live" badge:

- `LIVE_SURFACE`: the public read or tool exists; it does not prove revenue.
- `OFFER_DEFINED`: the server-authoritative offer exists; it does not prove a sale or fulfillment.
- `SOURCE_IMPLEMENTED_HELD`: source contracts exist while external commissioning is held or unproved.
- `BOUNDED_RUNTIME`: a restricted runtime effect has exact receipts; remaining business outcomes
  are named.
- `DESIGNED_UNMEASURED`: strategy only.
- `LICENSE_GATED`: legal, safety, capital or professional authority is required before implementation.

These values are intentionally conservative and must not be upgraded from code shape alone.

## Homestead identity ruling

The repository currently uses "Homestead" for two different things. They remain separate.

### Homestead Deal Desk

- Public product: `/home`
- Opportunity owner: **Population**
- Business band: **P2-P3**
- Purpose: public-record distressed-property research, ranked operator review and licensed-party
  connection
- Physical-mail motor: **Law**, through `law:automail`
- Current evidence: public and operator surfaces are implemented; autonomous sale, closing and
  revenue outcomes are unmeasured

Population may identify the housing opportunity. Law may decide whether a legally reviewed letter
can be sent. Neither may borrow the other's cognition or motor receipt. A future closing remains a
licensed real-estate/legal transaction and cannot be inferred from a mailed letter or reply.

### Farm Operations Desk

- Internal runtime lane: `agriculture:homestead`
- Owner: **Agriculture**
- Business band: **P4-P5**
- Purpose: bounded service-request email for an exact farm-property work order
- Current production measurement on 2026-09-25: switch disabled; zero decisions, commands and
  observations

The historical lane name is retained to avoid a risky runtime rename. The public business label is
"Farm Operations Desk" so it cannot be mistaken for the Population distressed-property venture.
It is not production commissioned until a real, consented work item completes decision → command →
provider receipt → signed inbound response → recovery/learning with exact-SHA evidence.

## Front-end behavior

The renderer is additive and read-only:

- one machine-readable registry covers all 20 public domains and exactly five capital bands each;
- the script inserts the ladder before the CalcStack block, or before the footer where Intelligence
  intentionally has no CalcStack mapping;
- it does not call a LIMEN API, provider, checkout, treasury or motor route;
- it fails quiet if its static registry cannot be read, so the live domain page continues to work;
- each card states evidence and the next gate, including designed and licensed-only candidates;
- CalcStack remains the mathematical P0-P1 traffic layer and does not become a diagnosis engine.

## Implementation order after this slice

1. Keep the shared ladder truthful while P0-P1 CalcStack gaps are closed.
2. Commission Homestead only with a real, consented target; do not manufacture a work order for a
   demonstration.
3. Prove one Population/Law Homestead outcome separately from the Agriculture Farm Operations lane.
4. Reconcile an actual Relay purchase, fulfillment, refund boundary and margin before upgrading its
   business status.
5. Promote at most one new domain venture at a time through the same exact-item, decision,
   authorization, effect, independent outcome, recovery and learning chain.
6. Keep mortgage then credit under the Finance/Population P0-P1 build; do not use them to silently
   open lending, insurance, brokerage or legal authority.

## Acceptance invariants

- 20 domains, five capital bands per domain, exact P0-P10 coverage once per domain.
- No capital band is presented as the current domain phase.
- No designed business is presented as operating.
- Homestead Deal Desk and Agriculture Farm Operations remain separately owned.
- A higher band never claims funding from projected revenue.
- Live money, contracts, regulated advice and physical acts remain behind their own authority and
  reversibility gates.
