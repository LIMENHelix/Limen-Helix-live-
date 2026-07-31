# BRAIN v2 — CONTRACT

Clean-room domain brain. Built as if the domain were empty. Nothing here imports from or writes to
the live system until it earns that.

Internal. Firewalled in `.vercelignore`.

---

## Why this exists

Not because the current brain is badly written. Parts of it are careful work — the propagator
excludes hubs on the stated grounds that "a bank is highly connected, not distressed", the market
feed abstains below 3 live tickers rather than publishing a two-ETF index, the phase estimator
abstains below a precision floor.

It exists because of one measured pattern, found repeatedly on 2026-07-30/31:

**The system produces structures that look measured and are not, and nothing downstream can tell.**

| measured today | |
|---|---|
| 111 portals carry `validationStatus: "validated"` with **no CIK** | the kernel scores from EDGAR by CIK; it cannot have scored them. Their composites take **8 distinct values** vs **357** for the 518 CIK-backed portals |
| 32/32 energy treatments labelled `evidence: "Strong"` | **0 carry a citation** |
| 180 digest diagnoses, 4,702 treatments | **0** can be triggered; the domain has **14** observable conditions |
| 21 node activations | all `state: "active"`, `weight: 1` — no dysregulation signal exists |
| vitals `organ-propagator` | measured `0 damped` for weeks and scored **100/HEALTHY**; `dampedCount` was excluded from the score |
| `heal-corpus` | reported `success: true` on a count that sat unchanged for **19 days** |
| `organ-propagator` attention | a hardcoded TODO emitted at MED for **2 months** after the work was done elsewhere |
| fractal network | **16,424 of 30,457 (53.9%)** links dead; 8,404 were a category error — the SEC rendered as a company portal |

Every one is the same defect: **a claim emitted without the measurement that would support it.**

The rules below are not style preferences. Each one is the direct inverse of a failure above.

---

## THE RULES

### R1 — Declare inputs. No input, no claim.
Every brain declares a **sensor manifest**: for each input, its source, cadence, units, and what
happens when it is absent. A derived claim may only exist if its declared inputs resolved.

*Prevents:* `organ-feeds` defaulting `snapshotSrc` to `''`, which would have put all 20 domains in
"NO feed source" at HIGH from one unreadable file. And the connectome ENOENT read as "the system has
no regulation".

*Existing precedent to reuse:* `scripts/sense/_inputs.mjs` — accessors return `null`, never `[]`.

### R2 — Missing is not empty. Unmeasurable is not zero.
Three distinct states, never collapsed: **measured**, **absent** (could not read), **abstained**
(read fine, insufficient to conclude). A finding that depends on an absent input is **suppressed**,
not computed from a default.

*Prevents:* an empty corpus reading as a dead corpus. Scoring an unreadable connectome as
"regulation = 0" instead of "regulation = unmeasurable".

### R3 — Cardinality is capped by the sensors, and the cap is enforced in code.
The number of distinguishable states the brain can emit may not exceed what its sensors can
distinguish. This is a runtime assertion, not a comment.

*Prevents:* 180 diagnoses on 14 conditions. If the library exceeds the sensor count, the excess is
surfaced as **ranked candidates**, explicitly `active: false`, never as findings.

### R4 — Every label carries its basis, or it is not emitted.
No `validated`, `Strong`, `confirmed`, or confidence number without a `basis` field naming the
measurement. Where a value is a judgement rather than a measurement it is marked `[mark: prior]`,
which is already this codebase's convention.

*Prevents:* 111 `validated` with no CIK. 32/32 `Strong` with 0 citations.

### R5 — Abstention is a first-class output, and it is the default.
Abstaining is success. The brain reports **what it could not measure and why** in the same payload
as what it could. A consumer must be able to distinguish "calm" from "blind".

*Existing precedent:* `MIN_TICKERS = 3`, `PRECISION_FLOOR`, `CDF_MIN_SAMPLE = 8`,
`deriveForecast`'s refusal to call a direction on a window that spans less than the dead-band.

### R6 — State every clock. Grade at the consumer's clock.
Each signal declares its update cadence. Any comparison across signals of different cadence must
state the cadence it is grading at.

*Prevents:* the sixth instance of one-cadence-across-signals — a daily `marketScore` injected into an
hourly composite, then judged on hourly transitions where it can move at most 1 in 24.

### R7 — Name the efferent path, or declare that there is none.
Every brain declares what changes because of its reading. If nothing changes, it says so in its own
output. "No consumer" is a legitimate state; an *undeclared* consumer is not.

*Prevents:* the fold reaching only a browser tab; `stress_slim` feeding a consumer paused since
2026-06-01; `corr(refusal%, liveCount) = -0.029` — sources having no relationship to capability.

### R8 — Success is measured against the thing it was supposed to change.
No operation reports success from its own exit code. It re-measures the quantity it claimed to move.

*Prevents:* `heal-corpus` reporting `success: true` with the count unchanged for 19 days.

### R9 — Version the apparatus in the record.
Every stored reading carries the identity of what produced it: model id, weights hash, which
representation each channel used. A change in the instrument must be partitionable after the fact.

*Existing precedent:* `704e917d` stamped forecasts with `model` and graded only matching rows —
applied once, correctly, and never generalised.

*Prevents:* a re-level being mistaken for movement, which happened on the first measurement of the
composite unfreeze.

### R10 — An entity may only be offered an action its kind can support.
Gate on what a thing IS, not on whether the target happens to exist today.

*Prevents:* 8,404 links rendering the SEC, the FTC and individual executives as company portals.

---

## What the brain must produce

A single payload, per domain, per cycle:

```
{
  domain, cycleAt, apparatus: { version, weightsHash, sensorManifestHash },
  sensors:   [ { key, source, cadence, state: measured|absent|abstained, value, asOf, why } ],
  state:     { value, basis, confidence, basisOf: [sensor keys] } | { abstained: true, why },
  findings:  [ { id, active, relevance, triggeredBy: [sensor keys], basis } ],
  candidates:[ { id, relevance, triggerSource: 'derived', active: false } ],
  actions:   [ { id, forFinding, evidence: { kind: 'citation'|'prior', ref }, } ],
  efferent:  { consumers: [...], declaredNone: bool },
  blind:     [ { what, why } ]
}
```

`blind` is not optional. A cycle that measured nothing emits a payload that says so.

---

## Acceptance test — the brain is not "done" until it passes

1. Starve every sensor. It must emit a payload where every claim is `absent`/`abstained`, and
   **zero findings**. It must not emit a single default value.
2. Feed one sensor. Exactly the findings that sensor can support appear. No others.
3. Change the apparatus. Old readings remain partitionable by `apparatus` and are not blended.
4. Ask it what changed because of it. It answers with a consumer or declares there is none.
5. Run the R3 assertion. Findings never exceed sensor-distinguishable states.

Until 1-5 pass on real data, this is scaffolding, not a brain.
