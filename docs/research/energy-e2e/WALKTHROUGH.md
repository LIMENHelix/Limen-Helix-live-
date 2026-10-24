# Energy E2E 1: isolated test cycle

Base: `38ff919c14fd1a5770ac727178af6860fa633ddb` (current `main` after PR #410).

This run is **test-system execution**, not a real customer, real Stripe payment, real
external delivery or production revenue. The evidence is in
`docs/research/energy-e2e/run-2026-10-24T010557Z/`.

The earlier `run-2026-10-24T003310Z` run was invalid for acceptance because its
snapshot was `_stale:true` and its synthetic outcome was treated as independent.
It is superseded and removed by this correction.

## Corrected gates

- The observation must have `_stale:false` and age at most 300 seconds. A stale
  observation produces no order, delivery, accounting, outcome or learning.
- The default fixture outcome is synthetic: `independent:false`, `measured:false`,
  actor `test-harness`, authority `SIMULATED_TEST_ONLY`. Asserted
  `independent:true` or `measured:true` fields on a synthetic outcome are ignored.
- A measured independent outcome requires a separately supplied receipt with
  receipt identity, event time, content hash, issuer and HMAC source signature.
  The gate checks the signature, content hash, event window, issuer, and receipt
  replay identity. The positive and negative cases are covered by tests.
  The verifier key and issuer come only from the server-side
  `ENERGY_E2E_VERIFIER_KEY` and `ENERGY_E2E_VERIFIER_ISSUER` channel. Cycle
  input, outcome objects and CLI flags cannot supply them. When the channel is
  unset, the measured gate stays closed. A test-only key or non-external trust
  mode remains `SIMULATED_TEST_ONLY` even when its signature is valid. Measured
  also requires the issuer to be bound to the expected customer and order.
- Fulfillment matches the existing `energy.p2` "Your Utility Rate Watch" offer.
  The portal issue, node and treatment are related context, not the purchased
  deliverable and not an automatic substitute.

## Evidence chain

| Stage | Record |
|---|---|
| Observation | Public console snapshot `2026-10-24T01:05:37.758Z`, age `20s`, `_stale:false`, 18/18 sources live, stress `1`, phase `p5`, top signal `6 event clusters (nuclear threat)`; observation hash `5fe40270d08bfd96b931a5a56178b92b2c6491a9bbfff0382ae581aa2316a2f8`; input hash `90fc4be0690f616ababde4c290c9cae1b9c44e4b96289d4e08225753e1be607e` |
| Thing Two | `p5 ENDURANCE`, source `stress-heuristic`, grounded `false`, temporal evidence `LATEST_ONLY`, authority `OBSERVE_ONLY_NOT_A_COMPANY_VERDICT` |
| Portal decision | Issue `SYSTEMIC_ENERGY_STRESS` score `5`; node `HIPP` (Battery Storage), canonical and business-bindable; treatments `Battery Management System Optimization` and `State-of-Health Diagnostics`, both Strong |
| Service | Existing `energy.p2` "Your Utility Rate Watch", 400 cents, test customer `test-customer-energy-001` |
| Test order | `ord_test_f0c9fb34863dce13`, mode `test`, liveMoney `false`, amount `400` cents, authorized by `test-operator` |
| Fulfillment | `del_test_89317f4aa513f778`, title `Energy Watch: Utility Rate Watch Brief (TEST)`, content hash `d8a0ed52453249d7e47582b0faf3b1cf6922fca2d41cca02e71ebaccc0e43fd6`; isolated test artifact, no email or external delivery |
| Finance | Treasury receipts `ctr_ad20ce1019e66c775b19d9919919` (SALE_CAPTURED), `ctr_f9fa93fb9aa27b8592a90af82228` (SALE_SETTLED), `ctr_ac8b1bf7fd9038e960ce7163f14a` (EXPENSE); test revenue `400`, test cost `50`, available `350`, pending `0`, real revenue `0`; all receipts `accountingOnly:true`, `externalEffectExecuted:false` |
| Outcome | `out_test_synthetic_cebcf7c916b0fc81`, provenance `synthetic_test_fixture`, actor `test-harness`, `independent:false`, `measured:false`, authority `SIMULATED_TEST_ONLY` |
| Learning | `learn_test_60fb5869d7ccbc5f`, next action `OFFER_STATE_OF_HEALTH_DIAGNOSTIC`, authority `SIMULATED_TEST_ONLY`, `measuredOutcome:false`, `simulated:true` |
| Decision change | Before: `SEND_UTILITY_RATE_WATCH`; after: `OFFER_STATE_OF_HEALTH_DIAGNOSTIC`; both test-authorized (`test-operator`), real outreach `false`; the change is **simulated only** |
| Audit | Hash chain `energy-e2e`, `ok:true`, length `7`, genesis-anchored |

The nuclear branch is not hidden: it scored `5` but was rejected as
`not_relevant_to_service_asset` because the chosen service asset is battery
storage, not nuclear generation. The issue remains a model inference.

## Durable readback

A separate process reading the same isolated store returns the changed decision:

```json
{
  "action": "OFFER_STATE_OF_HEALTH_DIAGNOSTIC",
  "reason": "synthetic test acknowledgment requested diagnostics; simulated only",
  "authority": "SIMULATED_TEST_ONLY",
  "measuredOutcome": false,
  "simulated": true,
  "testAuthorization": "test-operator",
  "realOutreachAuthorized": false,
  "learningRef": "learn_test_60fb5869d7ccbc5f"
}
```

The learning is persisted in `store.json`, and the readback correctly keeps it
simulated rather than measured.

## What this proves and does not prove

Proved:

- A real timestamped public observation can drive the isolated test-system cycle.
- The stale gate prevents an order from a stale observation.
- A synthetic acknowledgment remains explicitly synthetic and does not qualify as
  a measured independent outcome.
- A verified-receipt gate exists and is regression-tested for test-signed,
  spoofed, wrong-content, wrong-event, wrong-issuer, missing-verifier, wrong
  customer/order and replayed receipts.
- A valid test-signed receipt is cryptographically checked but remains
  simulated because the test key is not an external trust root. Test-only keys
  cannot set measured.
- Caller-signed receipts and caller-supplied verifier configuration cannot
  elevate an outcome to measured; the verifier is server-environment only and
  bound to the expected customer and order.
- The fulfillment matches the purchased Utility Rate Watch offer.
- Test money is booked only as accounting-only test money; real revenue is zero.
- The simulated learning changes the next proposed test decision and persists in
  the isolated store.

Not proved:

- No real customer was contacted and no real external delivery occurred.
- No real Stripe charge or production revenue occurred.
- No separately verified real customer receipt was supplied, so no measured
  independent outcome is claimed. Test-only signatures remain simulated. The
  measured gate stays open until an external verifier is actually provisioned;
  no such verifier exists in this environment.

## Files

- `snapshot.json`: retained Energy projection and hashes from the public endpoint.
- `trace.json`: the full cross-stage trace.
- `deliverable.md`: the Utility Rate Watch brief generated for the test order.
- `accounting.json`: the treasury projection.
- `store.json`: isolated order, receipt, outcome, learning, treasury receipts and audit chain.
- `customer.json`, `outcome-input.json`: explicit test inputs.

## Reproduce

```sh
node scripts/test-energy-e2e.js
node scripts/run-energy-e2e.js --capture --synthetic-outcome --out-dir docs/research/energy-e2e/run-<timestamp>
```

The runner performs at most one public, read-only snapshot GET and writes only under
`--out-dir`. It never calls Stripe, email, a customer or production storage.

## Boundaries

- No real revenue. All money is TEST money in the existing treasury ledger's
  accounting-only form.
- No real external delivery or customer contact.
- No Thing One authority and no validated-company claim.
- Thing Two is observe-only and latest-only; no phase series is invented.
- The selected issue is a transparent model inference constrained to the service
  asset. Missing, stale, contradictory or unsupported evidence abstains.
- The FIX-0103 15-second deadline remains per image download and is not part of
  this Energy cycle.
