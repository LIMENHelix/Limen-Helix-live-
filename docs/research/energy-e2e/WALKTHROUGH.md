# Energy E2E 1: isolated test cycle

Base: `38ff919c14fd1a5770ac727178af6860fa633ddb` (current `main` after PR #410).

This run is **test-system execution**, not a real customer, real Stripe payment, real
external delivery or production revenue. The evidence is in
`docs/research/energy-e2e/run-2026-10-24T003310Z/`.

## Evidence chain

| Stage | Record |
|---|---|
| Observation | Public console snapshot `2026-10-24T00:20:37.737Z`, age `758s`, 18/18 sources live, stress `1`, phase `p5`, top signal `5 event clusters (nuclear threat)`; observation hash `2a6b6c21ebb8f52ae5d612a855d4c339582de946f9d8d8685f00c368134edcb2` |
| Thing Two | `p5 ENDURANCE`, source `stress-heuristic`, grounded `false`, temporal evidence `LATEST_ONLY`, authority `OBSERVE_ONLY_NOT_A_COMPANY_VERDICT` |
| Portal decision | Issue `SYSTEMIC_ENERGY_STRESS` score `5`; node `HIPP` (Battery Storage), canonical and business-bindable; treatments `Battery Management System Optimization` and `State-of-Health Diagnostics`, both Strong |
| Service | Existing `energy.p2` "Your Utility Rate Watch", 400 cents, test customer `test-customer-energy-001` |
| Test order | `ord_test_350718c1e76e1580`, mode `test`, liveMoney `false`, authorized by `test-operator` |
| Fulfillment | `del_test_4011a3f6275f09f4`, isolated test artifact, content hash `fcc437b68fb76fb8676f1a25218dfc5ee2e2d271e77c8edb610957719b5bfe72`; no email or external delivery |
| Finance | Treasury receipts `ctr_915e03042d8c9d59866c620d50e4` (SALE_CAPTURED), `ctr_a80cdc1d1c0bd63d889605d971f4` (SALE_SETTLED), `ctr_eed3ef63f47767f3b77e83cec47b` (EXPENSE); test revenue `400`, test cost `50`, available `350`, real revenue `0`; all receipts `accountingOnly:true`, `externalEffectExecuted:false` |
| Outcome | `out_test_5897c6d9c17a96ac`, test-customer receipt `test-customer-ack-001`, acknowledged and diagnostic requested, `realCustomer:false` |
| Learning | `learn_test_7f895e0a05f33dc2`, next action `OFFER_STATE_OF_HEALTH_DIAGNOSTIC`, persisted against the test customer |
| Changed decision | Before: `SEND_UTILITY_RATE_WATCH`; after: `OFFER_STATE_OF_HEALTH_DIAGNOSTIC`; test authorization `test-operator`, real outreach authorization `false` |
| Audit | Hash chain `energy-e2e`, `ok:true`, length `7`, genesis-anchored |

The nuclear branch is not hidden: it scored `5` but was rejected as
`not_relevant_to_service_asset` because the chosen service asset is battery storage,
not nuclear generation. The issue remains a model inference, not a validated diagnosis.

## Files

- `snapshot.json`: retained Energy projection and hashes from the public endpoint.
- `trace.json`: the full cross-stage trace.
- `deliverable.md`: the customer brief generated for the test order.
- `accounting.json`: the treasury projection.
- `store.json`: isolated order, receipt, outcome, learning, treasury receipts and audit chain.

## Reproduce

```sh
node scripts/test-energy-e2e.js
node scripts/run-energy-e2e.js --capture --out-dir docs/research/energy-e2e/run-<timestamp>
```

The runner performs at most one public, read-only snapshot GET and writes only under
`--out-dir`. It never calls Stripe, email, a customer or production storage.

## Durable readback

A separate process reading the same isolated store returns the changed decision:

```json
{
  "action": "OFFER_STATE_OF_HEALTH_DIAGNOSTIC",
  "reason": "prior test outcome acknowledged and requested diagnostics",
  "authority": "PROPOSED_TEST_ONLY",
  "testAuthorization": "test-operator",
  "realOutreachAuthorized": false,
  "learningRef": "learn_test_7f895e0a05f33dc2"
}
```

The learning is persisted in `store.json`, not held only in the cycle process.

## Boundaries

- No real revenue. All money is TEST money in the existing treasury ledger's
  accounting-only form.
- No real external delivery or customer contact.
- No Thing One authority and no validated-company claim.
- Thing Two is observe-only and latest-only; no phase series is invented.
- The selected issue is a transparent model inference constrained to the service
  asset. Missing, stale or unsupported evidence abstains before any order.
- A whole-import deadline is not part of this cycle; the FIX-0103 15-second deadline
  remains per image download.
