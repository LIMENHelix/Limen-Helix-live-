---
artifact: transmutation-r2a-control-proof
date: 2026-09-25
implementation_status: R2A_READY_FOR_EXACT_SHA_VERIFICATION
authority: measured repository evidence; production remains unmeasured until deployment
---

# R2a staged control and shadow observability proof

## Scope

This slice closes two audit gaps without changing provider, money, portal, Tradier, CalcStack,
domain-cognition, or outward-effect behavior:

1. Vercel's consolidated Python entry point now reads the same durable global civilization
   control record as the JavaScript boundary and applies its staged authority ceiling.
2. The secret-safe autonomy cycle summary now carries aggregate canonical-homology shadow counts.

No protected corpus, portal output, domain brain, provider adapter, or business lifecycle changed.

## Python authority matrix

| Global stage | Diagnostic health | Read-only sensing | Scoring / cognition |
| --- | --- | --- | --- |
| `NUKED` | allow | deny | deny |
| `DIAGNOSTIC_READ_ONLY` | allow | deny | deny |
| `SENSING_ONLY` | allow | allow | deny |
| `INTERNAL_COGNITION` | allow | allow | allow |
| `SANDBOX_MOTOR` | allow | allow | allow |
| `DOMAIN_RECOMMISSION` | allow | allow | allow |
| `OPEN` | allow | allow | allow |

Diagnostic routes remain reachable without Redis so the control plane cannot lock the operator out
of health evidence. Every non-diagnostic route fails closed when the durable control is missing,
unreadable, malformed, or contradictory. An absent but readable global record retains the existing
JavaScript default of `OPEN`; transport/control failure is different from absence.

Unknown future Python routes default to `cognition`, never to a lower authority class.

## Shadow observability boundary

The cycle log may now publish only:

```json
{
  "mode": "SHADOW_ONLY",
  "eligible": 3,
  "wouldChange": 17,
  "evaluated": 20,
  "enforcementActive": false
}
```

Per-domain blockers and secret-bearing fields remain excluded. This makes the production shadow
count measurable without weakening log redaction or activating enforcement.

## Measured repository proof

Focused commands:

```text
node scripts/test-python-control-gate.cjs
python staged global control: 13 assertions passed

node scripts/test-autonomy-cycle-observability.cjs
autonomy cycle observability: per-domain gates and safe shadow aggregate visible without secret-bearing values

python -m py_compile api/python.py python_runtime/control_gate.py
exit 0

npm run check:harness
harness map matches reality: 68 vercel crons, 8 github crons, 6 globally valved jobs; 27 total outward-effect jobs; 1 explicit heartbeat exception
```

Full command:

```text
npm test
```

Result:

```text
repository check passed
320 test files discovered
319 passed, 1 skipped, 0 failed, 213.0s
```

The single skip is the known external corpus prerequisite in
`brain-v2/test/corpus-foundation.js`; it is not reported as a pass.

## Production boundary

Production evidence is **UNMEASURED** until this exact commit is deployed and both of these are
observed:

- a Python sensing/scoring request returns the expected control-class/stage headers or a bounded
  staged denial; and
- a scheduled domain-commercial reflex log includes the safe shadow aggregate with
  `enforcementActive:false`.
