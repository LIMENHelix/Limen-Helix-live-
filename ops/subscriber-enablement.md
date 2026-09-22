# Subscriber delivery enablement runbook (PR-005)

How to take the already-built paid-subscriber fulfillment lane from "complete in
code, held by configuration" to delivering for one beachhead domain (finance),
with a durable record of what was enabled.

Nothing in this runbook changes code paths. Every gate referenced here already
exists; this is the operator sequence that opens them.

## 0. The one-glance answer: the registry

```
GET /api/env-capability-registry?key=<ADMIN_MASTER>
```

Master-gated, read-only. Reports, per domain (all 20 subscriber-email lanes):

- `status`: `GREEN` (every send gate open) or `HELD`
- `switches`: enabled / observerEnabled — open or closed, and whether the value
  came from the domain var or the global fallback
- `caps`: resolved `maxSends`, `emailCostUsd`, `dailyBudgetUsd`,
  `dailySendCap`, and `effectiveDailySlots` (the executor's real arithmetic)
- `missing`: the exact env var names still needed
- `capabilityPairRequired`: whether the lane additionally needs the projected
  capability receipts (true for 19 lanes; **false for finance** — its
  authorization is finance-local: switches + fresh brain state only)
- `capabilities`: presence/expiry of the persisted capability receipts
  (read-only store probe; add `&probe=0` to skip)

Plus a `transport` section (Resend key/from-address/postal footer readiness)
and a `commissioning` section (the one-shot proof prerequisites). Secret values
are never returned — presence booleans and cap numbers only.

## 1. Transport envs (Vercel, Production)

| Var | Why | State check |
|---|---|---|
| `RESEND_API_KEY` | send + read API credential | registry `transport.resendApiKey.configured` |
| `RESEND_FROM_EMAIL` | from-address on a domain verified in Resend (`Name <user@limenhelix.com>` or bare address) | `transport.fromEmail.deliverableClass` must be `own-domain-assumed-verified` |
| `CRM_SENDER_ADDRESS` | CAN-SPAM postal footer — without it every send renders "[sender postal address not configured]" | `transport.postalAddress.configured`; **blocks GREEN** |
| `CRM_REPLY_TO` | optional reply-to | `transport.replyTo.configured` |

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are already set in production
(limenhelix.com verified in Resend, 2026-09-20). `CRM_SENDER_ADDRESS` is a
**LEGAL/POLICY INPUT** — the operator's real postal address.

## 2. Commissioning envs (the one-shot transport proof)

The 19 capability-gated lanes borrow one already-executed proof: Intelligence's
owned-destination commissioning (one real email, independently observed via the
Resend read API, address durably suppressed). It may never have run in
production — the registry's `capabilities.intelligenceAutopilotSource` shows
whether usable evidence exists.

| Var | Value |
|---|---|
| `INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED` | `1` (only while commissioning) |
| `INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL` | an owned, consented address (operator's own inbox) |
| `INTELLIGENCE_AUTOPILOT_EMAIL_USD` | `0.001` (must be ≤ 0.01 — the capability contract bound) |
| `INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD` | `0.01` |
| `INTELLIGENCE_AUTOPILOT_DAILY_EMAIL_CAP` | `1` |

## 3. Commissioning execution

**Production runs server-side** — every credential the chain needs is a Vercel
Sensitive env (write-only; `vercel env pull` returns them empty by design), so
the local script cannot run outside production. The route runs the identical
chain (`runCommissioning` in `lib/commission-subscriber-lane.js`) with the
envs the production runtime already holds:

```
# 1. Dry-run first: full chain in memory, stubbed provider, nothing sent,
#    nothing persisted, the permanent one-shot slot untouched.
curl -X POST 'https://limenhelix.com/api/commission-subscriber-lane?key=<ADMIN_MASTER>' \
  -H 'content-type: application/json' -d '{"consent":true,"dryRun":true}'

# 2. Live: exactly ONE real email to the configured commissioning address.
curl -X POST 'https://limenhelix.com/api/commission-subscriber-lane?key=<ADMIN_MASTER>' \
  -H 'content-type: application/json' -d '{"consent":true}'
```

Authority shape (all required, fail-closed): master key + `{"consent":true}`
attestation + `INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED=1` (the pre-set
switch, enforced by preflight) + the permanent one-shot suppression slot. The
address is read from `INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL` server-side —
never accepted from the request, never returned (the response carries
`addressConfigured` instead; every occurrence of the address string is scrubbed
from the payload, including inside error text).

The local script remains for development against non-sensitive environments:
`node scripts/commission-subscriber-lane.cjs --address=<addr> [--live --consent]`.

What happens, using only existing modules:
`intelligence-autopilot-decision` (B10 release against fresh brain state) →
`intelligence-autopilot-executor` (one Resend send, durable suppression) →
`intelligence-autopilot-outcome-observer` (independent Resend **read** API
receipt) → `intelligence-autopilot-capability-verifier.verifyAndPersist` →
`subscriber-email-capability-verifier.run({persist:true})` projecting
executor+observer capability receipts to 19 lanes (6h TTL; the
`/api/subscriber-email-capability` cron at 8,23,38,53 * * * * re-projects from
the durable evidence, so the pairs stay alive).

Green output: `"ok": true`, `intelligenceCapability.status: "VERIFIED"`,
`projection.verified: 19` (or fewer with named `held` rows, e.g. a missing
religion motor receipt — that does not block finance).

**Terminal observation is the proof.** The observer contract is
`delivered-or-terminal-failure`: a bounce observed through the independent
Resend read API still completes the chain (decision → send → independent
terminal observation → durable suppression). Measured 2026-09-22: the live
commissioning send bounced (address-side) and the projection still VERIFIED
19/19. **A transport-level failure** (provider rejects the send, no terminal
event, observation times out) → no capability pair, every lane stays HELD.
That is the correct failure state; fix the transport and re-check.

## 4. Beachhead lane envs — finance (worked example)

Set in Vercel (Production), per the spec-suggested caps (operator decision):

```
FINANCE_SUBSCRIBER_EMAIL_ENABLED=1
FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED=1
FINANCE_SUBSCRIBER_MAX_SENDS=50
FINANCE_SUBSCRIBER_EMAIL_USD=0.001
FINANCE_SUBSCRIBER_DAILY_BUDGET_USD=1.00
FINANCE_SUBSCRIBER_DAILY_SEND_CAP=100
```

The digest cron already exists (`/api/finance-subscriber-cycle`, 34 * * * *).
With these set and transport GREEN, the registry's finance row shows:

```
status: GREEN, missing: [], effectiveDailySlots: 100, capabilityPairRequired: false
```

**Global equivalents** (`SUBSCRIBER_EMAIL_AUTONOMY_ENABLED`,
`_OUTCOME_OBSERVER_ENABLED`, `_MAX_SENDS`, `_EMAIL_USD`, `_DAILY_BUDGET_USD`,
`_DAILY_SEND_CAP`) open every lane that has no domain-level override — a domain
var, when present, always wins (use `=0` to keep one lane closed while opening
the rest). Recommendation: per-domain, finance first.

Other domains follow the same pattern: `<DOMAIN>_SUBSCRIBER_EMAIL_ENABLED`,
`<DOMAIN>_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED`, `<DOMAIN>_SUBSCRIBER_MAX_SENDS`,
`<DOMAIN>_SUBSCRIBER_EMAIL_USD`, `<DOMAIN>_SUBSCRIBER_DAILY_BUDGET_USD`,
`<DOMAIN>_SUBSCRIBER_DAILY_SEND_CAP`. Exception: religion's per-run cap is the
historical `SUBSCRIBER_DIGEST_MAX_SENDS`. The 19 capability-gated lanes also
need section 3 completed.

## 5. After enablement

- Registry: `summary.green` counts lanes with every env/cap gate open.
- First real delivery is observed by the existing observer crons
  (`finance-subscriber-outcome-observer` 46 13 * * * *; domain observer
  1,11,21,31,41,51 * * * *) — not by this pack.
- GATE A (PR-008) is the first unattended real subscription end-to-end; this
  pack only makes the lane capable of firing.
