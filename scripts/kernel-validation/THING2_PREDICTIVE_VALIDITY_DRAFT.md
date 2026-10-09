# THING 2 PREDICTIVE VALIDITY CHECK — DRAFT v0.1 (2026-10-09)

**DRAFT for operator review — NOT frozen, NOT scheduled.** This is the
single predictive check proposed for later (operator: "Separately draft one
predictive validity check for later"). Verification checks (companion draft)
establish that readings are computed correctly; THIS would test whether a
reading carries information. It spends no distress pool and needs no new
labels beyond public outcomes.

## Question

Does a **P4 (Scaffolding)** reading predict what happens next better than
the base rate — specifically: **P4 → P5 (Endurance, recovery on own cash)**
vs **P4 → distress** (subsequent filing, covenant relief, or dividend
suspension within N quarters)?

## Why P4→{P5, distress}

P4 is the release's only "currently stressed" state. Its commercial meaning
depends entirely on what follows it: if P4 companies usually resolve to P5,
the rung reads as "supported through a rough patch"; if they usually
collapse, it reads as late-stage warning. The registry's two names for P4
(Peace vs Scaffolding) encode exactly this disagreement — the transition
rates are the empirical answer.

## Design (all parameters to be frozen before any run)

- **Cohort:** every company that ever reads P4 on the research frame over
  the cached panels + board (point-in-time readings, no survivorship —
  delisted companies stay in). Current expectation: small-n; report counts,
  not just rates.
- **Outcome labels (public record):** P5 re-read at +4/+8 quarters
  (definition per fpm-r2); distress = Item 1.03 filing, covenant waiver, or
  dividend suspension within N quarters (event vocabulary per the v2 rule
  discussion, v3 scope: waiver/relief/tightened terms).
- **N (horizon):** to be chosen before data is read; candidates 4, 8, 12
  quarters. **Lead-window rule (standing, from the Thing 1 audit):** the
  horizon and the "true positive" definition must match any lead-time claim
  made for the reading — never a +2q window against a long-lead claim.
- **Statistics:** transition matrix with Wilson intervals per cell;
  comparison against the unconditional base rate of {P5 | distress} among
  non-P4 companies in the same panels; no pooling of phases.
- **Pre-committed readings (draft, to be ratified):**
  - If P4→P5 exceeds base rate with CI excluding 0 AND P4→distress is not
    above base rate → P4 reads as "stabilization supported by financing";
    the two-field valence contract (instantaneous vs cumulative) is
    sufficient.
  - If P4→distress exceeds base with CI excluding 0 → P4 is late-stage
    warning; the display needs the valence split before any sales copy uses
    the word "Peace".
  - If neither CI excludes 0 → inconclusive at this n; report counts; do
    not enlarge the claim.

## Discipline

- Uses only cached/public data; no distress-pool spend; no overlap with any
  reserved validation cohort.
- Exploratory until signed; EXPLORATORY label on every interim table.
- No result feeds the board until the verification suite (companion draft)
  is frozen and green.

Signature: ______________________  Date: ____________
