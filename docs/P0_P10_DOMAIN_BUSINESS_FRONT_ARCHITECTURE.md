# P0-P10 domain business-front architecture

**Status:** strategy and public truth surface; no new effect authority

**Machine source:** `assets/data/domain-business-ladders.json`

**Stress-regulation source:** `assets/data/domain-business-regulation.json`

**Front renderer:** `assets/js/domain-business-ladder.js`

**Deterministic evaluator:** `lib/domain-business-regulation.js`

## Decision

Every sovereign domain front may show a P0-P10 **business capital ladder**, but that ladder is a
separate namespace from the domain's current P0-P10 **cycle phase**.

- `domainCyclePhase` answers: where does the sensed system currently sit in the conceptual cycle?
- `businessCapitalBand` answers: how capital-intensive is a candidate intervention or venture?

The labels deliberately share the owner's P0-P10 grammar while the namespaces prevent one from
laundering the other. A domain at P3 does not automatically need a P3 business. Stress does not
create authority, capital entitlement or a company. A business is an optional regulatory
intervention selected from established evidence and separately admitted by the owning domain.

A third namespace now carries the link between them:

- `businessStressRegulation` answers: given the sensed cycle phase and continuous stress, what
  operating posture should every candidate business adopt?

The composition is intentionally one-way. `domainCyclePhase` and numeric stress may restrict a
business posture. They may never promote `businessCapitalBand`, ratify a contract, fund a budget or
authorize an effect.

## P0-P10 business regulation strategy

P0-P10 is a cycle, not an eleven-step severity scale. P9 is the threshold/circuit-break state; P10
is a new baseline that must re-earn privileges. The phase posture composes with the continuous
stress band by taking the more restrictive result.

| Sensed phase | Business posture | What the domain businesses do | Capital rule |
|---|---|---|---|
| P0 Source | Observe | Inventory the field and expose a useful free read; forming a company is optional. | Hold |
| P1 First Distinction | Validate | Separate one measurable opportunity and test one reversible offer/referral. | Hold |
| P2 Rhythm | Repeat | Build a repeatable monitor, calculator, subscription or low-risk transaction loop. | Evidence eligible, never automatic |
| P3 Fracture | Diagnose | Stop promotion and locate the broken assumption or operating constraint. | Hold |
| P4 Scaffolding | Support | Apply temporary service capacity or separately contracted Finance/owner support. | Separate funding required |
| P5 Endurance | Operate | Run the proven lane from collected revenue and measured capacity. | Reconciled surplus only |
| P6 Order | Coordinate | Coordinate proven domain businesses through standards, contracts and APIs. | Reconciled surplus only |
| P7 Separation | Contain | Isolate the failing venture/dependency and stop hidden cross-subsidy. | Hold |
| P8 Conscience | Correct | Audit the regulator itself; correct, refund, unwind or revise with independent outcome proof. | Hold |
| P9 Threshold | Circuit break | Halt new commitments, discretionary spend and irreversible acts; protect cash, data and people. | Halt |
| P10 Renewal | Reopen progressively | Treat the new baseline as new evidence and restart from the smallest reversible loop. | Rebase, then prove |

Continuous stress overlays the phase:

- 0-39% regulated: existing verified work can remain gate-eligible.
- 40-69% elevated: reduce discretionary scope and require stabilization proof.
- 70-84% high: freeze expansion and allow only reversible recovery work.
- 85-100% acute: halt new spend, contracts, publication and physical acts.
- unmeasured: propose-only; preserve the last verified posture.

This matrix regulates every venture in the 20-by-5 ladder. It does not mean all 100 candidate
ventures should exist. Each domain may build, invest in, partner with or decline a venture based on
evidence and its separate authority boundary.

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
- every front exposes the shared Domains & Apps directory plus its portal/engine and clearly marked
  operator console;
- every front exposes the same eleven-row stress-regulation policy and numeric stress overlay;
- the policy surface is not a live phase claim and never calls an effect route.

## Runtime adoption state

The commercial reflex now records a `businessRegulationShadow` alongside each domain decision and
write-ahead intent. This is a deterministic, zero-provider-call observation. It is deliberately
`SHADOW_ONLY`: the current server packet does not yet carry a ratified business contract, fresh
independent verifier qualification, four-layer runtime-health proof and verified rollback reference.
Therefore the shadow fails closed and reports no external authority or spend.

Promotion from shadow to enforcement requires an inventory of every publishing, payment, contract,
brokerage, email and physical motor path. Each path must consume one gate decision or a short-lived
gate token. Until that proof exists, the public contract and runtime telemetry may guide proposals
but may not claim end-to-end enforcement.

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
- Missing/stale four-layer health, ratification, verifier freshness or rollback proof fails closed.
- Stress can only narrow or pause behavior; it can never grant authority, capital or a company.
