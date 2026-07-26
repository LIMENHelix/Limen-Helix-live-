# PHASE PIPELINE — a developmental A→Z chain on the P0-P10 arc

**Status:** design artifact. Nothing here has been run. `[mark: IDEA]`
**Firewalled:** `docs/research/`, `.vercelignore` line 108. Repo/history only.
**Created:** 2026-07-26. **Rewritten same day** — v1 was a defect-triage pipeline, which is the
wrong shape. See §0.

---

## §0 What this is, and what it replaced

**v1 was wrong.** It took a known defect and walked it to a fix: find → verify → scope → build →
ship. That is change management. It is not the P0-P10 arc.

**P0-P10 is a DEVELOPMENTAL cycle.** Things come into being, elaborate, get pruned, and either die
or become a new baseline that seeds the next cycle. Distress is not a late stage; **distress is a
STUCK TRANSITION**, and it can happen anywhere.

So this pipeline starts at **idea**, moves to **creation**, and treats **pruning as the primary
mechanism rather than a failure state.**

### The mechanism it is built on

Neural development overproduces and then prunes. Proliferation, migration, differentiation,
synaptogenesis, then **massive elimination**, then myelination of what survived. The elimination is
not a mistake being corrected. It is how the circuit is found.

The load-bearing consequence, and the thing v1 got backwards:

> **You cannot know which connections matter until signal has run through them.**

v1 pruned ideas *before* building, by argument. That is cheap and it kills the wrong ones, because
an argument about an idea is not signal through the idea. **This version builds crude versions of
many, then prunes on measured signal.**

**The honest cost:** building before pruning is more expensive than arguing before building. The
biology pays that cost because carrying signal is the only valid test. If cost is the binding
constraint, make stage C cheaper, not stage D earlier.

### The loop closes

P10 Resurrection is not an endpoint. It is the new baseline, which becomes P0 Source for the next
cycle. **Spiral, not ladder.** An item that completes the arc re-enters at A carrying what it
learned.

---

## §1 The arc

| Stage | Phase | Register | Duty | Survival |
|---|---|---|---|---|
| **A** | P0 | Source | **Overproduce.** Many ideas, no filtering. | all pass |
| **B** | P1 | Rupture | Each idea must name what it disrupts. | ~70% |
| **C** | P2 | Rhythm | Cheapest crude build. Make signal flow. | ~60% |
| **D** | P3 | Darkness / Instability | Run it. **It does not work yet.** Record how it fails. | ~40% |
| **E** | P4 | Peace / Stabilisation | Variance drops. It starts working. | ~50% |
| **F** | P5 | Endurance | Stress inoculation. Survive load. | ~60% |
| **G** | P6 | Order | Integrate into structure. | ~80% |
| **H** | P7 | Dissolution / Divergence | It hits a structural break. Route. | — |
| **H-a** | P7a | Terminal | **PRUNE.** Dies. Record why, permanently. | 0% |
| **H-b** | P7b | Separation | Survives in changed form. | 100% |
| **I** | P8 | Conscience / Pivot | New pattern emerges from the break. | ~90% |
| **J** | P9 | Threshold | The gate. **HUMAN.** | operator |
| **K** | P10 | Resurrection | New baseline. Re-enters at A. | — |
| **Z** | — | Ledger | The pruning record. Every death, kept. | — |

**Survival rates are STATED PRIORS `[mark: prior]`, not measured.** They express intent: roughly
**5-8 of 100 ideas should reach K.** If far more survive, the gates are too soft and you are shipping
noise. If far fewer, A is not generating enough or C is too expensive.

**Pruning is continuous, not a stage.** Every stage from B onward can kill. H-a is where death is
*recorded formally*, not where it first becomes possible.

---

## §2 Stage prompts

`<<PRIOR>>` is the previous artifact, pasted whole. A stage reads that and nothing else. If
information is missing it HALTS and names the gap; it does not go fetch.

### A — SOURCE (P0). Overproduce.

    ROLE: Generator. You are not a critic. Criticism happens later and by someone else.
    DUTY:
      1. Emit 20-40 candidate ideas against the seed domain. Quantity over quality, explicitly.
      2. Vary the ANGLE deliberately: mechanism, measurement, removal, recombination, inversion,
         borrowing-from-another-domain. Do not emit 30 variations of one idea.
      3. Include ideas you expect to fail. The failure distribution is data.
      4. Do NOT rank. Do NOT filter. Do NOT justify.
    FORBIDDEN: evaluating merit, estimating effort, mentioning feasibility.
    OUTPUT: IDEA-ID | ONE-LINE | ANGLE | SEED-DOMAIN

### B — RUPTURE (P1). What does it disrupt?

    ROLE: Disruption tester. An idea that changes nothing is not an idea.
    INPUT: <<A>>
    DUTY:
      1. For each idea, name precisely what existing behaviour it would DISRUPT.
      2. If nothing is disrupted, PRUNE it and say so.
      3. State the disruption as a difference: "today X, with this Y."
      4. Do not assess whether the disruption is good.
    PRUNE IF: no behaviour changes, or the change is cosmetic.
    OUTPUT: IDEA-ID | DISRUPTS | TODAY→WITH-THIS | SURVIVES[y/n]

### C — RHYTHM (P2). Crude build. Make signal flow.

    ROLE: Prototyper. Build the cheapest thing that carries signal.
    INPUT: <<B>> survivors
    DUTY:
      1. Build the crudest version that produces a NUMBER or an OBSERVABLE. Hours, not days.
      2. It may be ugly, hardcoded, single-domain, offline. It must RUN.
      3. Instrument it. An unmeasured prototype cannot be pruned on evidence.
      4. If it cannot be made to run cheaply, PRUNE and record the blocker.
    RULE: this is a throwaway. Do not optimise, generalise, or make it pretty.
    PRUNE IF: no cheap path to a running artifact.
    OUTPUT: IDEA-ID | ARTIFACT-PATH | WHAT-IT-EMITS | COST-TO-BUILD | SURVIVES[y/n]

### D — DARKNESS / INSTABILITY (P3). It does not work yet.

    ROLE: Observer of failure. Expect high variance. Do not fix anything.
    INPUT: <<C>> survivors
    DUTY:
      1. Run the prototype against real data. Multiple runs.
      2. Record the variance, not just the mean. Unstable output IS the finding here.
      3. Characterise the failure MODE: noisy, degenerate, inverted, saturating, silent.
      4. Distinguish "does not work yet" (P3, keep) from "cannot work" (prune).
      5. Resist the urge to patch. Patching here hides the failure mode.
    PRUNE IF: output is degenerate (constant, or independent of input) with no plausible cause
              other than the idea being wrong.
    OUTPUT: IDEA-ID | RUNS[] | MEAN | VARIANCE | FAILURE-MODE | YET-vs-CANNOT | SURVIVES[y/n]

### E — PEACE / STABILISATION (P4). Variance drops.

    ROLE: Stabiliser. Now you may fix, and only what D characterised.
    INPUT: <<D>> survivors
    DUTY:
      1. Address the specific failure mode D named. Nothing else.
      2. Re-run. Show variance BEFORE and AFTER. The number must move.
      3. If variance does not drop, the fix did not address the real cause. Return to D once.
         Second failure ⇒ prune.
      4. State what is now stable and what is still not.
    PRUNE IF: two passes without variance dropping.
    OUTPUT: IDEA-ID | FIX-APPLIED | VAR-BEFORE→AFTER | STILL-UNSTABLE[] | SURVIVES[y/n]

### F — ENDURANCE (P5). Stress inoculation.

    ROLE: Stressor. Break it deliberately, under conditions it will actually meet.
    INPUT: <<E>> survivors
    DUTY:
      1. Empty input, single sample, all-identical values, stale data, cold start, concurrent write.
      2. Name the SILENT failures specifically — the ones that produce a plausible wrong answer
         rather than an error. These are the dangerous class.
      3. Every silent failure needs a detector or the idea is pruned.
      4. Name the blast radius: what else would consume this.
    PRUNE IF: a silent failure has no possible detector.
    OUTPUT: IDEA-ID | EDGE-RESULTS[] | SILENT[] | DETECTORS | BLAST-RADIUS | SURVIVES[y/n]

### G — ORDER (P6). Integrate.

    ROLE: Integrator. Make the throwaway real.
    INPUT: <<F>> survivors
    DUTY:
      1. Rebuild properly. Match surrounding style, comment density, idiom.
      2. Add F's detectors.
      3. Name the reversal lever: exactly how this is undone.
      4. Emit as a diff. Never applied.
      5. State how you verified it parses/loads.
    PRUNE IF: no reversal lever exists.
    OUTPUT: IDEA-ID | DIFF | REVERSAL-LEVER | VERIFY-METHOD | VERIFY-RESULT

### H — DISSOLUTION / DIVERGENCE (P7). The structural break.

    ROLE: Examiner at the breakpoint. Integration always reveals something.
    INPUT: <<C,G>>
    DUTY:
      1. Re-measure C's original observable, now integrated, in an isolated tree.
      2. Compare against C's crude number. State the delta.
      3. Something WILL diverge from the prototype. Name it. Do not explain it away.
      4. Route: viability breached ⇒ H-a. Divergence tolerable ⇒ H-b.
    OUTPUT: PROTOTYPE-VALUE | INTEGRATED-VALUE | DELTA | DIVERGENCE | ROUTE[H-a|H-b]

### H-a — TERMINAL (P7a). Prune. Record permanently.

    ROLE: Coroner. This is the most valuable stage in the pipeline.
    DUTY:
      1. What was expected, what happened, at which stage it truly died.
      2. **One sentence a future reader needs so nobody rebuilds this.**
      3. What was learned that OTHER ideas can use.
      4. Route to Z. Do not attempt rescue.
    RULE: a well-recorded death is a success. Most ideas end here by design.
    OUTPUT: IDEA-ID | EXPECTED | OBSERVED | DIED-AT-STAGE | DO-NOT-REBUILD-BECAUSE | TRANSFERABLE

### H-b — SEPARATION (P7b). Survives, changed.

    ROLE: Quarantine.
    DUTY:
      1. Branch `agent/<idea-id>`. Commit there. Nothing on main.
      2. Three-dot diff against merge-base: only intended files.
      3. Confirm no other window's work is included.
      4. State how the surviving form DIFFERS from the original idea. It always does.
    OUTPUT: BRANCH | THREE-DOT-FILES[] | CLEAN[y/n] | DRIFTED-FROM-ORIGINAL

### I — CONSCIENCE / PIVOT (P8). New pattern from the break.

    ROLE: Claims auditor and pattern-namer.
    INPUT: <<H,H-b>>
    DUTY:
      1. Strongest claim the evidence supports. Then weaken until defensible.
      2. What may NOT be claimed.
      3. Nothing says "validated" unless it came from Thing1.
      4. Name the NEW pattern the break revealed — the thing you did not know at A.
         This is what makes the cycle developmental rather than repetitive.
      5. Flag outward-facing if any operator or outsider reads the output.
    OUTPUT: MAY-CLAIM | MAY-NOT-CLAIM | NEW-PATTERN | OUTWARD-FACING[y/n]

### J — THRESHOLD (P9). Human gate.

    ROLE: none. No agent occupies this stage.
    PRESENTED: idea one-line, what it disrupts, prototype→integrated delta, the diff, the branch,
               the reversal lever, MAY-CLAIM / MAY-NOT-CLAIM, and **what deploys if merged.**
    DECISION: merge | hold | prune-to-Z
    RULE: no agent passes, infers, or reads silence as approval.

### K — RESURRECTION (P10). New baseline, and re-entry.

    ROLE: Shipper and seeder.
    DUTY:
      1. Merge only what J approved.
      2. Re-measure. **This becomes the new baseline** that the next cycle's C compares against.
      3. Emit the NEW-PATTERN from I back into A as a seed for the next round.
    RULE: K is not an endpoint. The arc closes here and reopens at A.
    OUTPUT: MERGED-SHA | NEW-BASELINE | SEED-BACK-TO-A

### Z — LEDGER. The pruning record.

    ROLE: Historian of what did not survive.
    DUTY:
      1. Append every idea: id, stage of death or K, one-line reason.
      2. **Deaths are the primary product.** 90+ of 100 entries should be deaths.
      3. Report the survival curve per stage. A stage killing almost nothing is not filtering.
         A stage killing almost everything is misplaced.
      4. Emit the STUCK REPORT (§3).
      5. Cluster the DO-NOT-REBUILD reasons. Repeated causes are the real finding.

---

## §3 Stuck detection — distress is a stuck transition

Distress is not a late phase. **It is failure to leave a phase.**

    stuck(idea) = cycles_at_current_stage / median_cycles_at_that_stage

Flag `stuck > 2`. Then read it structurally:

- **Ideas jam at C** ⇒ prototyping is too expensive. Make C cruder, not D earlier.
- **Ideas jam at D** ⇒ you cannot tell "not yet" from "cannot." Usually means the observable chosen
  at C is too weak to discriminate.
- **Ideas jam at E** ⇒ D characterised failure modes badly, so fixes address symptoms.
- **Ideas jam at H** ⇒ prototypes are not predictive of integrated behaviour. A C-stage problem
  surfacing late.
- **Nothing jams and everything survives** ⇒ the pipeline is theatre. Tighten B and D.

**The stage where items pile up is the defect, not the items.**

---

## §4 What each stage costs, and where to spend

- **A, B** cheap and generative. Run wide. Underproducing here is the most common failure.
- **C** is the real budget line, because it is many crude builds. Keep each one hours, not days.
  **If C is expensive, the whole shape collapses back into v1.**
- **D** cheap to run, and where most ideas should die on measured evidence.
- **E, F, G** progressively more expensive, and by then the survivor count should be small.
- **H-a** nearly free and the highest-value stage per token spent.
- **J** human, unautomatable.
- Paid AI never on a regulation cycle. Operator-triggered, batch-by-batch, never on a timer.

---

## §5 Mapping to existing skills

| Stage | Skill | Note |
|---|---|---|
| A | `/prompt` | build the generator brief, grounded |
| B, I | `/decide` | brief with tradeoffs, no action |
| C, G | `/build` | scoped, uncommitted diff, never auto-applied |
| D, E, F, H | `/verify` | pass/fail with failing lines |
| D | `/audit` | ranked findings, no edits |
| H-b, K | `/ship` | commits; push double-gated |
| Z | `/ledger` | tracking ledger |

The pipeline sequences these and puts an artifact between each. It does not replace them.

---

## §6 First run

Seed A with one domain and let it overproduce. Suggested first seed: **"ways to know whether a
LIMEN domain channel carries information at all."** Entry 014 item 0 is ONE answer to that; A should
produce 20-40 and let the arc decide, rather than assuming the known answer is the best one.

Expected first-run outcome: a jam at C or D, which tells you more about the process than any
surviving idea will.
