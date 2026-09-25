---
authority: MEASURED_LOCAL_AND_READ_ONLY_PRODUCTION_PROOF
measured_at: 2026-09-24
base_commit: 7663c9c7d58cf41f28eca5ec979dd8b6ef6f1bdd
implementation_status: R1_SHADOW_NOT_ENFORCED
deployed: no
external_effect_authority_changed: no
---

# R1 Canonical Homology Shadow Proof — 2026-09-24

## Scope

This slice repairs the cognition read seam without replacing any domain brain or lifecycle:

- `domain-snapshot` remains the live feed/source observation.
- existing `console_snapshot` supplies its already-computed domain/company join and authoritative
  domain phase.
- medicine→health, science→research, and trade→supplyChain are normalized at the read boundary.
- stale/missing console evidence abstains and cannot masquerade as a grounded reading.
- canonical homology admission is evaluated and persisted in **SHADOW_ONLY** mode.
- current decisions are not changed, providers are not called, spend remains zero, and no external
  effect is authorized.

## Live read-only snapshot proof

Command:

```text
node -e "const I=require('./lib/brain-cognition-snapshot-input'); (async()=>{const [d,c]=await Promise.all([fetch('https://www.limenhelix.com/api/domain-snapshot').then(r=>r.json()),fetch('https://www.limenhelix.com/api/limen-snapshot?type=console').then(r=>r.json())]);const x=I.merge(d,c,Date.now()); ... })()"
```

Measured output:

```json
{
  "evidence": {
    "schemaVersion": "brain-cognition-snapshot-input/1.0",
    "status": "OBSERVED",
    "reason": null,
    "phaseAuthority": "console_snapshot.domain.phase",
    "consoleGeneratedAt": 1790302837636,
    "consoleAgeMs": 507647,
    "phaseDomainsOverlaid": 20,
    "companyJoinDomains": 20,
    "aliases": {
      "medicine": "health",
      "science": "research",
      "trade": "supplyChain"
    },
    "readOnly": true
  },
  "phases": {
    "finance": { "phase": "p8", "phaseSource": "node-grounded", "grounded": true },
    "medicine": { "phase": "p4", "phaseSource": "node-grounded", "grounded": true },
    "science": { "phase": "p4", "phaseSource": "node-grounded", "grounded": true },
    "trade": { "phase": "p4", "phaseSource": "node-grounded", "grounded": true }
  },
  "joins": {
    "finance": 28,
    "medicine": 67,
    "science": 24,
    "trade": 34
  },
  "liveStressPreserved": 0.49051860311564677
}
```

This proves the adapter can restore all 20 existing joins and phases while preserving the live
domain stress input. It does not prove deployed behavior because this branch is not deployed.

## Decision-delta proof

Commands:

```text
node scripts/test-domain-commercial-homology-shadow.cjs
node scripts/test-domain-commercial-reflex.cjs
```

Measured result:

```text
domain commercial homology shadow: all tests passed
current decisions:       PLANNED 20
canonical shadow:        ABSTAINED 20
shadow wouldChange:      20
enforcementActive:       false
providerCalled:          false
externalEffectAuthorized:false
```

The current fixture deliberately mirrors production's unestablished canonical mappings. The
shadow gate therefore identifies the exact semantic difference without changing the existing
decision or work queue.

## Repository proof

Command:

```text
npm test
```

Measured result:

```text
repository check passed
running 319 test files
318 passed, 1 skipped, 0 failed, 218.9s
```

The one skip is `brain-v2/test/corpus-foundation.js`; its separately configured external corpus
root was unavailable.

After the control inventory was reconciled, `npm test` was updated to run
`npm run check:harness` between the repository check and the unit suite so future scheduler/control
drift is a required failure rather than an optional audit command.

Focused packet/homology results after adding input provenance:

```text
node scripts/test-civilization-homology-context.js  → 5/5 passed
node scripts/test-civilization-server-packet.js     → 14/14 passed
node scripts/test-brain-cognition-snapshot-input.cjs → all tests passed
```

## Scheduler/control truth proof

Command:

```text
node scripts/check-harness-map.js
```

Initial measured result before reconciliation:

```text
HARNESS MAP DRIFT (46)
exit code 1
```

The same 46-item scheduler/control drift measured in the preceding audit remained at the initial
measurement. The R1 changes did not create that drift. The inventory was then reconciled without
changing a schedule or enabling
an effect:

- all 68 Vercel crons and eight scheduled GitHub workflows are declared;
- world-effect kind is separated from heartbeat wiring;
- six jobs with real global heartbeat valves are distinguished from 21 outward jobs governed by
  domain-local/delegated controls;
- `finance-subscriber-cycle` now emits its own observation heartbeat;
- Relay remains an explicit common-heartbeat exception because its firewall forbids importing a
  foreign Helix subsystem into Relay core;
- `finance-position-owner` uses an honest observation wrapper rather than a non-functional global
  guard; its existing Finance/Tradier local switches remain authoritative.

Final measured result:

```text
harness map matches reality: 68 vercel crons, 8 github crons,
6 globally valved jobs (automail, autopilot, communication-social-capability,
finance-paper-cycle, social-cron, subscriber-digest); 27 total outward-effect jobs;
1 explicit heartbeat exception
exit code 0
```

No deployment or production claim is made.
