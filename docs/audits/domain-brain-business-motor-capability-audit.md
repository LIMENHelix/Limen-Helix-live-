# Domain Brain and Business-Motor Capability Audit

**Audit date:** 2026-09-30  
**Scope:** the twenty product-domain brains and their optional outward business motors  
**Status:** updated after the 20-domain brain/runtime and opportunity-routing repairs

## Original finding preserved

The initial audit reported:

1. Only Communication had verified live motor capability: `1/20`.
2. The other nineteen reported `domain-executor-capability-missing`.
3. Agriculture had live diagnoses/opportunities, but its Homestead loop had zero decisions, commands and observations.
4. Autofire cycles completed but fired zero actions; results were held.
5. The full suite reported `342 passed, 1 skipped, 2 failed`; the failures were audit-scope contamination from the preserved `work/limen-commercial-inventory` tree.

That finding mixed two different systems: the product-domain brain and an optional business/provider motor. This document keeps the finding as history and records the corrected interpretation below.

## Correct system boundary

### Product-domain brain

A brain is complete when its own local loop can observe state, diagnose, form or route opportunities, make an internal decision, run its local neuro/learning organs, and return durable state without requiring an external provider.

The current verification is:

- `20/20` separate brains pass the common-core and authority audits.
- `20/20` pass the local runtime-organ harness. Energy is exercised through its own richer K-stack; the other nineteen use the shared local-organ path.
- `20/20` pass opportunity routing. Investment routes to Finance; research routes to Science/research.
- Agriculture’s Homestead property-availability catalog is separate from Agriculture’s opportunity brain and is not part of Agriculture brain completion.

### Business/provider motor

A motor is an optional outward effect owned by a business lane. It requires additional evidence:

`domain decision → domain executor → provider receipt → independent external read → rollback or suppression → outcome learning`

Provider-owned evidence means the external system supplied an identity or state that LIMEN can independently read back. Examples are a Bluesky URI/CID, Tradier order receipt, Resend message ID, HubSpot company ID, or generated asset URL. These are business-motor receipts, not brain evidence.

The motor remains held when its capability pair is absent. `domain-executor-capability-missing` therefore means “the outward business motor is not authorized,” not “the domain brain is broken.”

## Communication reference implementation

Communication is the reference pattern because it has a bounded commissioning path:

1. Claim one fixed, non-commercial Bluesky marker.
2. Receive the provider URI/CID.
3. Independently read the public AppView and verify presence and identity.
4. Delete the marker.
5. Independently read the AppView and verify public absence.
6. Persist separate executor and independent-observer capability receipts.
7. Allow normal social execution only while those short-lived receipts remain valid.

The implementation is split across:

- `lib/communication-social-capability-verifier.js`
- `lib/communication-social-executor.js`
- `lib/product-domain-motor-capability.js`
- `lib/product-domain-motor-authorization.js`

The verifier never selects domain content and never grants itself reusable authority. Normal social execution still requires the domain decision, durable claim, provider receipt, AppView outcome observation, recovery and learning paths.

## Difference between Communication and the other domains

| Boundary | Communication | Other domains |
| --- | --- | --- |
| Brain contract | Complete | Complete: 20/20 |
| Source-chain motor code | Complete | Complete for 18 other outward lanes; Agriculture is intentionally routed rather than given its own motor |
| Bounded commissioning | One fixed Bluesky marker | Must be implemented or completed per provider/lane |
| Independent observation | Public Bluesky AppView | Provider/public read path must be independently defined |
| Recovery | Delete marker and verify absence | Cancel, archive, close, suppress, unpublish or otherwise prove the lane-specific recovery result |
| Capability pair | Verifiable executor + observer receipts | Missing, held, expired or not yet proven in live provider state |
| External action | Eligible only behind switches and capability lease | Fail-closed and held until equivalent evidence exists |

## Can the Communication pattern fix the other nineteen?

Yes, at the architecture level. It is a reusable commissioning pattern, not a copy-paste provider implementation.

The correct rollout is:

1. Define the exact owner, lane, motor contract and receipt/outcome contracts.
2. Add a lane-specific bounded commissioning verifier.
3. Use a real provider adapter for the smallest safe effect.
4. Independently read the provider or public surface through a separate observer path.
5. Roll back the effect, or for irreversible effects durably suppress future delivery and prove the one-shot boundary.
6. Persist and read back separate executor and observer capability receipts.
7. Keep the normal executor held until the pair validates against the current domain motor receipt.
8. Commission and measure one lane at a time; do not infer capability from source code or injected test fixtures.

Reversible examples include Bluesky posts, owned publications, CRM records, marketplace listings and generated assets. Irreversible examples include email and physical mail; those require an owned destination, consent, a permanent one-shot limit, suppressed business-state transitions and a provider-specific independent read.

Agriculture is the deliberate exception: its brain should route investment and research opportunities, while Homestead remains an independent property-availability catalog. Agriculture should not receive a copied Communication motor merely to improve a capability count.

## Current verification after the repair

- Brain audit: `20/20`.
- Local brain runtime harness: `20/20`.
- Opportunity-routing matrix and E2E routing: all domains pass; Agriculture investment → Finance, Agriculture research → Science/research, Homestead held/separate.
- Repository check: passed.
- Harness check: passed.
- Full suite: `357 passed, 1 skipped, 0 failed`.
- Live provider capability baseline: remains evidence-gated; no receipt or provider action is fabricated by this audit.

### Domain-by-domain implementation progress

The first reusable provider group is now wired for Economy, Energy and Technology. Their existing domain-owned paper-investment command and outcome ledgers can be promoted by a shared read-only verifier, while each domain receives its own capability keys, contract identity, handler and scheduled verification route:

- `lib/product-domain-tradier-capability-verifier.js`
- `/api/economy-investment-capability`
- `/api/energy-investment-capability`
- `/api/technology-investment-capability`

The verifier refuses to write capability receipts when evidence is absent. Its positive test uses only pre-existing zero-fill/cancel and independent paper-outcome records; it does not submit an order. This is implementation progress, not live provider proof.

The research-owned group is also wired for Science, Medicine, Education and Environment. Their verifier promotes only an already-executed research artifact that has an independently admitted evaluation, domain-authorized withdrawal, withdrawal readback and returned learner state. The evaluation intake preserves product identity (`science`/`medicine`), while the returned afferent uses the runtime learning owners (`research`/`health`). No research provider call or recovery action is made by the capability route.

- `lib/product-domain-research-capability-verifier.js`
- `/api/science-research-capability`
- `/api/medicine-research-capability`
- `/api/education-research-capability`
- `/api/environment-research-capability`

The research verifier is held without that complete historical chain. Its positive test uses only durable fixture records and independent readback; it does not generate, publish, evaluate or withdraw an artifact.

The remaining business lanes are now wired to the same promotion boundary:

- Law automail: `/api/law-automail-capability`
- Infrastructure real estate: `/api/infrastructure-real-estate-capability`
- Population real estate: `/api/population-real-estate-capability`
- Communication video: `/api/communication-video-capability`

Law and the two real-estate verifiers inspect their existing domain command,
provider receipt, independently recorded outcome and returned learning state.
They promote only an explicit owned-destination commissioning proof on the exact
command: consent, permanent one-shot slot, suppressed business-state transition,
future suppression recovery and zero-money boundary. Ordinary Lob or Resend
business activity is therefore visible but remains held; an accepted message is
not mistaken for reversible commissioning evidence.

Communication video is intentionally separate from Communication social. A
private YouTube platform receipt proves only that the private upload was accepted.
Until an independent public outcome observer exists, the video capability route
reports `HELD` and never projects the Bluesky capability pair onto it.

This closes the implementation gap in the four remaining business lanes without
fabricating provider evidence or issuing a provider call from a capability route.

## Remaining work

The remaining work is real provider commissioning where an external receipt is
actually desired, plus the spider-web propagation audit. That is provider- and
environment-dependent work, not brain repair. The code now has a lane-specific
promotion boundary for every currently implemented outward motor and keeps each
lane held until its evidence is independently present.

