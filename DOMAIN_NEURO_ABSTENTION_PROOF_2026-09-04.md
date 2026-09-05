# Domain Neurological Abstention Diagnostic Proof — 2026-09-04

## Scope and invariant

This is diagnosis instrumentation, not estimator or policy repair. It does not modify protected
`lib/phase-estimator.js`, the `0.5` precision floor, P0–P10 priors, channel values, histories,
correlation memory, promotion eligibility, domain stress, validation status, domain data, or portal
content.

When the authoritative estimator abstains, the worker replays that pure function with a zero
diagnostic floor to expose channels, then probes its grounded/abstain boundary to recover the
unrounded precision total. Only per-channel display precision, the unrounded total, and the caller's
effective floor are published under `phaseBelief.precisionDiagnostic`. Every diagnostic belief,
phase, confidence, stuck value, and correlation state is discarded and cannot enter persistence or
promotion.

## Before measurement

Fresh production console snapshot `1788575956737` was 37 seconds old and contained 20 domains:

```text
phaseBelief grounded: 17/20
industry:  groundedStress=0.192, phaseBelief=false, total precision 0.067 < floor 0.5
education: groundedStress=0.652, phaseBelief=false, total precision 0.072 < floor 0.5
law:       groundedStress=0.175, phaseBelief=false, total precision 0.080 < floor 0.5
```

All three refusals were visible, but `phaseBelief.channels` was `null`, so the evidence did not
distinguish a collapsed company channel, market channel, missing series, or decorrelation effect.

## Deterministic contract

```text
node scripts/test-phase-abstention-diagnostic.cjs
phase abstention diagnostic: effective floor and unrounded total exposed without promotion or estimator memory

node scripts/test-phase-belief-telemetry.cjs
phase belief telemetry: abstention reason, bounded degradation, and channel precision preserved; estimator memory excluded

node scripts/test-stress-promotion-telemetry.cjs
stress promotion telemetry: abstaining domains observed without entering promotion score
```

The diagnostic test constructs an estimate with total precision `0.1`. The real estimator still
abstains against its `0.5` floor. It also verifies a caller override of `1.0`, and a twelve-channel
rounding boundary where displayed channel precisions sum to `0.504` but the estimator's unrounded
total is `0.499`. The diagnostic reports the effective floor and the below-floor unrounded total,
does not mutate the caller's options, and exposes no belief or correlation state.

Full repository proof:

```text
npm test
repository check passed
  javascript parsed : 2007
  json parsed       : 4963 (2 skipped over the size cap)
  cron targets      : 52
  canonical nodes   : 123 (_meta.total enforced)

running 257 test files
256 passed, 1 skipped, 0 failed, 244.7s
```

The one skip is the explicit external-corpus prerequisite in
`brain-v2/test/corpus-foundation.js`; `LIMEN_CORPUS_ROOT` was unavailable.

## Production acceptance

UNMEASURED before deployment. Acceptance requires:

1. exact head-SHA CI and preview deployment checks;
2. exact merge-SHA CI and production deployment metadata;
3. a subsequent worker tick showing the same authoritative abstentions;
4. non-null `precisionDiagnostic` for Industry, Education, and Law;
5. no `_legacyFeedStress` or `stressSource` added to an abstaining domain; and
6. no production 5xx attributable to the change.

The diagnostic identifies the next repair candidate. It does not authorize relaxing the floor or
making the domains numerically identical.
