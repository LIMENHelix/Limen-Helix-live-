# Domain commercial reflex dossier

## 1. Outcome and boundary

- User outcome: each of the twenty sovereign domain brains continuously turns
  fresh evidence, stress, phase, resource state and learned consequences into
  timely business work without a Master Brain.
- Durable mutations: one domain-local reflex state, immutable write-ahead
  intents, source-linked prepared artifacts and capped receipt logs. Every
  domain also has a separately namespaced paid-subscriber decision, motor,
  outcome, learning and recovery state machine.
- Explicit non-goals: aggregate domain stress never directly places a trade;
  a headline title is not publishable evidence; this slice never calls a
  model, provider, broker or payment rail.
- Deployment shape: `orchestrator`.
- Why this shape: deterministic code owns scheduling and legal state edges,
  while later bounded domain workers may propose content or a business program
  from a closed vocabulary. A model proposal never authorizes the effect.

## 2. Trust roles

| Role | Identity | Authority | Must differ from |
| --- | --- | --- | --- |
| Contract proposer | Domain governor | Propose one allowed business program from its own packet | Contract validator |
| Contract ratifier | Deterministic domain contract | Validate identity, allowed program and evidence boundary | Proposer |
| Worker | Fresh domain content/investment worker | Prepare an artifact; no motor authority | Result verifier |
| Result verifier | Source/artifact verifier and later provider observer | Check sources, artifact and real consequence | Worker |
| Operator | LIMEN owner | Lower ceilings, NUKE, recommission a lane | Domain worker |
| Receipt sink | Strict domain-scoped durable store | Preserve decisions and outcomes | Effecting provider |

## 3. State machine

- Durable states: `ABSTAINED → PLANNED → ARTIFACT_PREPARED → AUTHORIZED →
  DISPATCHING → RECEIPTED → OBSERVED → LEARNED`; `QUARANTINED` is terminal.
- Allowed transitions: only the deterministic driver advances a stored state.
  This slice implements `ABSTAINED`, `PLANNED` and `ARTIFACT_PREPARED`.
  Existing subscriber motors implement later edges, but each new domain remains
  inhibited until its exact production capability and switches are proven.
- Terminal states: `LEARNED`, `QUARANTINED`, and an expired unexecuted intent.
- Write-ahead decision record: `domain-commercial-intent/1.0`, keyed by domain,
  packet, evidence fingerprint and selected program before any rendering/effect.
- Kill/resume rule: NUKE suppresses the scheduled cycle. Resume reconstructs
  from durable domain state; identical inputs reuse the same intent identity.
- The latest planned intent identity survives temporary abstentions so a later
  distribution gate cannot mistake an older artifact for the most recent plan.
- Paid delivery and Governor orientation require that latest identity and a
  bounded work-order age; delayed preparation cannot expose older work as current.

## 4. Ports and adapters

| Port | Contract | Implementation | Failure behavior |
| --- | --- | --- | --- |
| Queue | Immutable domain-local planned-state queue plus exact intent namespace | `domain_commercial:intent-queue:<domain>` and `domain_commercial:intent:<domain>:<id>` | Refuse on read-back failure; a newer abstention cannot erase queued work; acknowledge only after artifact read-back |
| Worker | Source-linked signal-brief preparer | `domain-commercial-artifact` | No artifact on invalid/stale work order |
| Verifier | Artifact identity/truth-boundary validator | Strict read-back and content hash | Headline remains attributed topic lead only |
| State store | Strict durable JSON/CAS-capable store | `autofire-efference-store` | No process-memory fallback |
| Governance gate | Domain motor + runtime valve | Existing B10/B14 and civilization valves | External effect held |
| Receipt sink | Domain receipt logs | Reflex and artifact logs under each domain namespace | Cycle fails for that domain |
| Alert channel | Runtime health/admin status | Status endpoint + heartbeat | Failed domain is explicit |
| Ground-truth view | Current server cognition packet | `limen:brain:cognition:<domain>` | Abstain if stale/unpersisted |

## 5. Governance

- Operator dial: existing global NUKE and per-lane external valves.
- Contract ceiling: internal preparation only in this slice.
- Scoped verifier trust: source identities are admitted as topic leads, never
  as verified full-text claims.
- Reversibility rule: planning is reversible; publishing, email and financial
  effects inherit their existing independent observer/recovery contracts.
- Irreversible human gate: remains at the lane's existing commissioning or
  separately authorized live-capital boundary.
- Override SLO and independent sink: existing NUKE/state-preservation rules.
- Mutation-path inventory: scheduled reflex may write only the exact domain's
  state, intent and receipt namespaces.

## 6. Operational controls

- Idempotency: SHA-256 of domain + packet id + evidence fingerprint + program;
  store-enforced `SET NX` and verified read-back.
- Budgets: zero model/provider/spend budget for reflex and artifact preparation;
  subscriber transport has its own per-domain send cap, unit cost and daily
  budget variables.
- Quarantine: invalid identity, stale packet, no live feeds, unavailable
  metabolism, human-review veto or inadmissible source results in abstention.
- Alert/ACK/throttle/halt: failed domains are returned by the cycle and exposed
  through the protected status route; external motors stay inhibited.
- Health: process heartbeat, cron schedule, per-domain persisted state and
  downstream provider/observer health remain separate facts.
- Anomalies: duplicate intent, cross-domain identity, stale cognition, source
  outage, semantic identity mismatch, lost read-back and unchanged-input churn.

## 7. Evidence plan

- Acceptance: all twenty immutable contracts exist; all use distinct keys;
  fresh novel evidence plans work; unchanged evidence abstains; no effect is
  authorized; status reads are protected.
- Chaos/replay: repeat the same packet, cross-wire a brain, remove durability,
  remove feeds, inhibit metabolism and set human-review veto.
- Gate traces: the intent says `externalEffectAuthorized:false` and includes
  the required next state and efference copy.
- Bypass negative tests: direct mismatched cognition is refused and headline
  evidence is marked `topic-lead-only/fullTextVerified:false`.
- Receipt verification: intent and state are read after write; every cycle
  writes a bounded domain-scoped receipt.
- Claimed shape/level: `UNSCORED`. Prepared artifacts are now test-proven, but
  the complete harness cannot be scored until an external provider effect and
  independent consequence complete for each commissioned lane.

## First thin vertical slice

`brain-cognition-refresh → domain-commercial-reflex → domain-local PLANNED
intent → source-linked ARTIFACT_PREPARED → paid subscriber B10/B14 → Resend
receipt → independent mail outcome → same-domain learning/recovery`.

The internal half through ready inventory is implemented for all twenty
domains. Paid-subscriber motor code and visible valves now exist for all twenty:
Finance and Religion retain custom implementations; the other eighteen have
separate domain modules over common transport physiology. Production effect
capabilities remain evidence-gated by domain.

## Deliberately deferred

- Full-text factual expansion and model-rendered long-form artifacts.
- YouTube/Bluesky automation from these artifacts.
- Production commissioning evidence for the newly instantiated subscriber lanes.
- Checkout eligibility based on prepared fulfillment inventory.
- Live investing and any capital movement.
- Outcome-based cadence/format/price learning, pending real observations.
