# Domain Stress Telemetry Proof — 2026-09-04

## Scope boundary

This repair exposes evidence already returned by the protected P0-P10 phase
estimator. It does not modify `lib/phase-estimator.js`, its precision floor,
phase promotion eligibility, displayed stress, lane policy, validation status,
domain content, or any protected/quarantined file.

The public worker projection now carries:

- the estimator's exact bounded abstention reason;
- its existing degradation flags, preserving absent values as `null`;
- its existing per-channel precision when the estimator returns it; and
- no `corrState` or other estimator memory.

The stress-promotion organ records abstaining domains separately from the
promotion score. An abstention therefore becomes observable without being
treated as a promotion failure or made eligible for promotion.

## Measured production baseline

Command:

```powershell
$uri='https://limenhelix.com/api/limen-snapshot?type=console'
$response=Invoke-WebRequest -Uri $uri -Method Get -TimeoutSec 30
$snap=$response.Content | ConvertFrom-Json
# enumerate domains whose phaseBelief.grounded is not true
```

Output from the production snapshot generated at
`2026-09-04T23:21:31.133Z`:

```text
http=200
domainCount=20
ungroundedCount=4
industry  displayedStress=0.91 groundedStress=0.203 reason=<absent> degraded=<absent> channels=<absent>
education displayedStress=0.45 groundedStress=0.658 reason=<absent> degraded=<absent> channels=<absent>
defense   displayedStress=0.49 groundedStress=0.688 reason=<absent> degraded=<absent> channels=<absent>
law       displayedStress=0.51 groundedStress=0.079 reason=<absent> degraded=<absent> channels=<absent>
```

The earlier domain audit observed five abstentions, including Energy. Energy
was grounded in this later snapshot, so the implementation discovers current
abstentions from evidence and does not hardcode domain names.

## Local proofs

Focused commands:

```text
node scripts/test-phase-belief-telemetry.cjs
phase belief telemetry: abstention reason, bounded degradation, and channel precision preserved; estimator memory excluded

node scripts/test-stress-promotion-telemetry.cjs
stress promotion telemetry: abstaining domains observed without entering promotion score

node scripts/test-phase-estimator.js
36 passed, 0 failed

node scripts/test-worker-phase-grounding.js
13/13 passed
```

Full repository command:

```text
npm test
repository check passed
254 passed, 1 skipped, 0 failed, 276.6s
```

The single skip is the existing explicit contract for
`brain-v2/test/corpus-foundation.js` when the external corpus root is
unavailable.

## Production acceptance

UNMEASURED until the exact merged SHA is deployed and a subsequent worker
snapshot is generated. Acceptance requires all currently abstaining domains to
publish a non-empty `reason` and bounded `degraded` evidence; `channels` may be
`null` when the protected estimator does not return per-channel precision for
that abstention. The abstention count itself may change with live evidence and
is not a parity target.
