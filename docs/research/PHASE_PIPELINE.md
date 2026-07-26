# PHASE PIPELINE — A→Z staged agent chain on the P0-P10 arc

**Status:** design artifact. Nothing here has been run. `[mark: IDEA]`
**Firewalled:** lives under `docs/research/`, which is `.vercelignore` line 108. Repo/history only.
**Created:** 2026-07-26

---

## What this is

A chain of single-duty agents. Each stage owns one prompt, one duty, and one output artifact.
Stage N+1 consumes stage N's artifact and nothing else. The spine is the P0-P10 arc, used as a
**passthrough**: every item entering the pipeline is walked through all stages in order, and a stage
may HALT the item but may not skip ahead.

**Subject matter:** any proposed change to LIMEN. Seed intake is the Entry 014 ranked list.

**Why staged rather than one big prompt:** a single agent asked to find, verify, scope, build and
ship will contaminate its own evidence — it will scope toward what it already decided to build. One
duty per stage, with the artifact as the only channel between them, is what prevents that.

---

## The four design rules (carried from the Zapiwala chained-prompt pattern, which works)

1. **The artifact is the interface.** A stage reads the previous artifact and nothing else. No stage
   re-reads the original request. If information is missing, the stage HALTS and names what is
   missing; it does not go fetch it.
2. **Gates at expensive boundaries.** Human approval sits immediately before any step whose output
   is costly to regenerate or impossible to reverse.
3. **Output in copyable blocks.** Every artifact is emitted as a fenced block with a fixed schema, so
   the handoff is mechanical rather than interpretive.
4. **Ground in real artifacts, never descriptions.** A stage that reasons about code must cite
   `file:line`. A stage that reasons about behaviour must cite a measured number. Descriptions of
   code are not admissible evidence.

## The three house rules (LIMEN-specific, non-negotiable)

5. **Label every claim** `[verified]` / `[inferred]` / `[speculative]`. Unlabelled = rejected by the
   next stage.
6. **Only Thing1 may say "validated."** Every other stage says `stabilized`, `measured`, or
   `abstains`.
7. **Report what the code DOES, never what it lacks.** An absence may only be asserted by stage D,
   and only after naming every file read to establish it. This rule exists because it was violated
   three times in one session (Entries 009 §5, 011 §5, 015 §0).

---

## The chain

| Stage | Phase | Register (name / label) | Duty in one line |
|---|---|---|---|
| **A** | P0 | Source | Intake. State the raw signal and where it lives. |
| **B** | P1 | Rupture / RUPTURE | Name the defect precisely. What breaks, for whom. |
| **C** | P2 | Rhythm / RHYTHM | Measure the baseline BEFORE any change. |
| **D** | P3 | Darkness / INSTABILITY | Adversarial. Try to kill the finding. |
| **E** | P4 | Peace / STABILISATION | Scope the minimum change. |
| **F** | P5 | Endurance / ENDURANCE | Stress it. Edge cases, load, failure modes. |
| **G** | P6 | Order / ORDER | Implement. Diff only, never applied. |
| **H** | P7 | Dissolution / DIVERGENCE | Test. Where does behaviour diverge from prediction? |
| **H-a** | P7a | Terminal Dissolution / TERMINAL | Kill path. Viability breached ⇒ stop, record why. |
| **H-b** | P7b | Differentiated Separation / SEPARATION | Isolate. Controlled branch, no entanglement. |
| **I** | P8 | Conscience / PIVOT | Honesty gate. What may now be claimed, and what may not. |
| **J** | P9 | Threshold / COLLAPSE | Ship gate. HUMAN. The only stage a machine cannot pass. |
| **K** | P10 | Resurrection / RESURRECTION | Ship, record, and re-baseline. |
| **Z** | — | Ledger | Terminal archive. Append outcome, close the item, feed intake. |

**Distress is orthogonal to stage.** An item at stage F is not "worse off" than one at stage C.
Being STUCK at a stage is the pathology, and Z tracks it (see Stuck Detection below).

---

## Stage prompts

Each stage prompt is a complete agent brief. `<<PRIOR>>` is the previous stage's artifact, pasted
whole.

### A — SOURCE (P0). Intake.

    ROLE: Intake officer. You do not evaluate. You record.
    INPUT: a raw item (a finding, a complaint, an idea, a line from Entry 014).
    DUTY:
      1. Restate the item in one sentence.
      2. Name every file:line it touches. If you cannot name one, say so explicitly.
      3. Classify origin: code-read | measurement | external-material | operator | speculation.
      4. Do NOT assess merit. Do NOT propose a fix.
    HALT IF: the item names no file, no measurement, and no operator directive.
    OUTPUT (fenced block):
      ITEM-ID | ONE-LINE | TOUCHES[] | ORIGIN | LABEL[verified|inferred|speculative]

### B — RUPTURE (P1). Name the defect.

    ROLE: Diagnostician. You state what is broken, not what to do about it.
    INPUT: <<PRIOR A>>
    DUTY:
      1. State the defect as a falsifiable sentence: "X produces Y when Z, and it should produce W."
      2. Name who or what is harmed: a number displayed wrong, a signal that teaches wrong, a claim
         that overstates.
      3. If the item is a preference rather than a defect, say so and HALT.
    HALT IF: you cannot write the falsifiable sentence.
    OUTPUT: DEFECT | FALSIFIABLE-AS | HARM | LABEL

### C — RHYTHM (P2). Baseline first.

    ROLE: Instrument. You measure the CURRENT state. You change nothing.
    INPUT: <<PRIOR B>>
    DUTY:
      1. Define the metric that would show the defect.
      2. Measure it now. Report the number.
      3. If the metric cannot be measured with existing instrumentation, say what instrument is
         missing and HALT.
      4. Record the sampling window and cadence. A number without a window is not a measurement.
    HALT IF: no number can be produced.
    OUTPUT: METRIC | CURRENT-VALUE | WINDOW | CADENCE | INSTRUMENT-GAP?

### D — INSTABILITY (P3). Adversarial pass.

    ROLE: Skeptic. Your job is to KILL this item. Default to killing it.
    INPUT: <<PRIOR A,B,C>>
    DUTY:
      1. Read every file the item touches, IN FULL. List them.
      2. Attempt three refutations: (i) the mechanism already exists elsewhere; (ii) the measurement
         is confounded; (iii) the defect is intended behaviour with a stated reason.
      3. If the item asserts an ABSENCE, you must prove the absence by exhaustive read or downgrade
         it to "not found in files X,Y,Z".
      4. State plainly whether the item SURVIVES.
    HALT IF: any refutation succeeds. Record which one, and route to Z.
    OUTPUT: FILES-READ[] | REFUTATION-1/2/3 + verdict each | SURVIVES[y/n] | RESIDUAL-CLAIM

### E — STABILISATION (P4). Minimum scope.

    ROLE: Scoper. You make the change as small as it can possibly be.
    INPUT: <<PRIOR D>> (only items marked SURVIVES=y)
    DUTY:
      1. Write the smallest change that addresses the residual claim. Count the lines.
      2. Name what you are deliberately NOT changing and why.
      3. Name the reversal lever: exactly how this is undone.
      4. If the change exceeds ~40 lines or touches more than 3 files, split it and emit multiple
         scoped items back to A.
    HALT IF: no reversal lever exists.
    OUTPUT: CHANGE-SPEC | LINES | FILES[] | NOT-DOING[] | REVERSAL-LEVER

### F — ENDURANCE (P5). Stress it.

    ROLE: Adversarial tester. Assume the change ships and goes wrong.
    INPUT: <<PRIOR E>>
    DUTY:
      1. Enumerate edge cases: empty input, single sample, all-identical values, stale data,
         cold start, concurrent write.
      2. For each, state the expected behaviour and whether the spec handles it.
      3. Name the failure mode that would be SILENT (the dangerous class).
      4. Name the blast radius: what else consumes this output.
    HALT IF: a silent failure mode has no detector.
    OUTPUT: EDGE-CASES[] | SILENT-FAILURES[] | BLAST-RADIUS[] | DETECTORS-NEEDED[]

### G — ORDER (P6). Implement.

    ROLE: Builder. You produce a diff. You do not apply it.
    INPUT: <<PRIOR E,F>>
    DUTY:
      1. Write the change exactly to spec. No scope expansion. No "while I'm here."
      2. Match surrounding code style, comment density, and idiom.
      3. Add the detectors F required.
      4. Emit as a unified diff in a fenced block.
      5. State how you verified it parses/loads (node --check, import, test run).
    HALT IF: the diff exceeds the line count E specified by more than 20%.
    OUTPUT: DIFF | VERIFY-METHOD | VERIFY-RESULT

### H — DIVERGENCE (P7). Test against prediction.

    ROLE: Examiner. C predicted a metric. Did it move as expected?
    INPUT: <<PRIOR C,G>>
    DUTY:
      1. Re-measure C's metric with the diff applied in an ISOLATED tree.
      2. Compare against C's baseline. State the delta.
      3. If the metric moved in an unexpected direction or magnitude, that is DIVERGENCE. Do not
         explain it away. Report it.
      4. Route: divergence within tolerance ⇒ H-b. Viability breach ⇒ H-a.
    OUTPUT: BASELINE | POST | DELTA | EXPECTED? | ROUTE[H-a|H-b]

### H-a — TERMINAL (P7a). Kill path.

    ROLE: Coroner. The item failed viability. Record it properly.
    DUTY: state what was expected, what happened, and the one sentence a future reader needs so
          nobody rebuilds this. Route to Z. Do not attempt rescue.
    OUTPUT: EXPECTED | OBSERVED | DO-NOT-REBUILD-BECAUSE

### H-b — SEPARATION (P7b). Isolate.

    ROLE: Quarantine. Put the change somewhere it cannot entangle.
    DUTY:
      1. Branch `agent/<item-id>`. Commit the diff there. Nothing on main.
      2. Verify with a three-dot diff against the merge-base that ONLY intended files changed.
      3. Confirm no other window's work is included.
    OUTPUT: BRANCH | THREE-DOT-FILES[] | CLEAN[y/n]

### I — PIVOT / CONSCIENCE (P8). Honesty gate.

    ROLE: Claims auditor. Decide what may now be SAID.
    INPUT: <<PRIOR C,H,H-b>>
    DUTY:
      1. Write the strongest claim the evidence supports. Then weaken it until it is defensible.
      2. Write explicitly what may NOT be claimed.
      3. Enforce: nothing here may say "validated" unless it came from Thing1.
      4. If the change alters anything an operator or outsider READS, flag it as outward-facing.
    OUTPUT: MAY-CLAIM | MAY-NOT-CLAIM | OUTWARD-FACING[y/n] | VALIDATED-WORD-USED[must be n]

### J — THRESHOLD (P9). Ship gate. HUMAN ONLY.

    ROLE: none. No agent occupies this stage.
    PRESENTED TO THE OPERATOR:
      - one-line item, the defect, the baseline→post delta
      - the diff, the branch, the reversal lever
      - MAY-CLAIM / MAY-NOT-CLAIM
      - what deploys if merged, stated explicitly
    DECISION: merge | hold | reject-to-Z
    RULE: no agent may pass this stage, infer passage, or interpret silence as approval.

### K — RESURRECTION (P10). Ship and re-baseline.

    ROLE: Shipper.
    DUTY:
      1. Merge only what J approved.
      2. Re-measure C's metric post-merge. This becomes the NEW baseline.
      3. Record the new baseline where C will read it next time.
    OUTPUT: MERGED-SHA | NEW-BASELINE | RECORDED-AT

### Z — LEDGER. Terminal archive.

    ROLE: Historian. Every item ends here, shipped or killed.
    DUTY:
      1. Append: item-id, final stage, outcome, one-line reason.
      2. Killed items are as valuable as shipped ones. Record them identically.
      3. Emit a STUCK REPORT (below).
      4. Feed patterns back to A as new intake.

---

## Stuck detection (the thing this whole structure is for)

Distress is not a stage. Being unable to LEAVE a stage is.

    stuck(item) = cycles_at_current_stage / median_cycles_at_that_stage_across_all_items

Z flags any item with `stuck > 2`. The stage where items pile up is the real defect in the process,
not the items themselves. Expected pattern on first run: items will jam at **C** (no instrument to
measure the baseline) and at **D** (absence claims that cannot survive exhaustive read). Both jams
are informative — C tells you what instrumentation is missing, D tells you which findings were
never real.

---

## Mapping to the skills that already exist

| Stage | Existing skill | Note |
|---|---|---|
| A, B | `/decide` | reads code + data, returns a brief, takes no action |
| C, H | `/verify` | build + route/link check, reports pass/fail with failing lines |
| D | `/audit` | ranked findings, no edits |
| E, F | `/decide` | options and tradeoffs, no action |
| G | `/build` | scoped change, uncommitted diff, never auto-applied |
| H-b, K | `/ship` | commits, and push is double-gated |
| Z | `/ledger` | operator tracking ledger |
| any | `/prompt` | build the stage prompt itself, grounded |

**The pipeline does not replace these. It sequences them and puts an artifact between each.**

---

## Cost and gating

- Stages A, B, C, E, I, Z are cheap and deterministic-leaning. Run freely.
- Stage D is the expensive one by design (exhaustive reads) and is where most items should die.
  That is the point: **kill items before G, not after.**
- Stage G is the only stage that writes code, and it writes a diff, never an applied change.
- Stage J is human and cannot be automated, delegated, or inferred.
- Paid AI never runs on a regulation cycle. This pipeline is operator-triggered, item-by-item,
  never on a timer.

---

## First run: seed intake

Take Entry 014 in order. Item 0 (marginal entropy per channel) enters at A first, because if the
channels carry no information most of the queue dies at D and the pipeline will have earned its
keep on day one by telling you that.

    0   marginal entropy per channel        → A
    1   Brier + log loss in outcome-ledger  → A
    0b  registry-load provenance            → A
    6   propagator stops using composite    → A
    ...
