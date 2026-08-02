---
authority: MEASURED_SNAPSHOT
measured_at: 2026-08-02
measured_at_commit: 1e4c4ef6
scope: authority class and provenance for every consequential tracked Markdown file
inventory: 102 tracked .md (31 root, 32 docs/, 6 brain-v2/, 25 .claude/, remainder api/ assets/ scripts/)
recorded_by: engineering agent (Claude)
approved_by: null
---

# DOCUMENT AUTHORITY REGISTER

Git authorship proves who **committed** a file. It does not prove that the business decisions,
scientific axioms, or standing authorizations inside it were ever approved by the owner. The
key commits in this repository carry Claude as co-author and describe AI-agent work.

**No document may call itself "master", "non-negotiable", "verbatim", "protected", "authorized",
or "validated" without a row here supporting that status.**

## Authority classes

| class | meaning | may an agent act on it unprompted? |
|---|---|---|
| `OWNER_CONFIRMED` | owner reviewed and approved, with a signature field set | yes, within its scope |
| `MEASURED_RUNTIME_FACT` | reproduced from a live run, with the command recorded | yes, as evidence |
| `MEASURED_SNAPSHOT` | true at a stated commit and date; may be stale now | orientation only — re-verify |
| `EXTERNAL_PRIMARY_SOURCE` | third-party literature, quoted not paraphrased | as evidence, cited |
| `ENGINEERING_HYPOTHESIS` | plausible, unproven, engineer-authored | as a hypothesis, never a mandate |
| `DESIGN_PROPOSAL` | proposed but not accepted or built | never as built state |
| `GENERATED_ARTIFACT` | output of a run | evidence only, never instruction |
| `STALE_OR_CONFLICTED` | contradicted, superseded, or provably out of date | no — resolve first |

## Register

### Active agent controls — these steer behaviour

| path | class | issue | permitted use |
|---|---|---|---|
| `CLAUDE.md` | `ENGINEERING_HYPOTHESIS` + safety rules | Permission model conflicts with three other active docs (see `OWNER_SYSTEM_INTENT.md` §5). Line 14 permits unprompted pushes to `main`. | Safety defaults only. Its BUSINESS rules are unapproved. |
| `.claude/commands/build.md` | `UNCONFIRMED_ENGINEERING_STRATEGY` | L16 converts a retired-lane statement into a build prohibition | Do not enforce retired lanes until owner confirms |
| `.claude/commands/audit.md` | `UNCONFIRMED_ENGINEERING_STRATEGY` | L10 declares investment + research the ONLY lanes | Same |
| `.claude/commands/ship.md` | `ENGINEERING_HYPOTHESIS` | Most conservative push rule in the repo; conflicts with `CLAUDE.md:14` | **Follow this one** — it is the strictest |
| `.claude/commands/{decide,fleet,ledger,prompt,status,verify}.md` | `ENGINEERING_HYPOTHESIS` | unreviewed | Procedure only |
| `docs/operator-agent-prompt.md` | `UNCONFIRMED_ENGINEERING_STRATEGY` | L32 approval rules are sound; L51-52 "one dollar before the next" is unapproved strategy | Approval rules yes; sequencing doctrine no |
| `OPERATOR.md`, `AGENT_HANDOFF.md` | `MEASURED_SNAPSHOT` | undated handoff state | Orientation; re-verify |

### Business context — none owner-approved

| path | class | issue |
|---|---|---|
| `docs/MASTER_CONTEXT.md` | `UNCONFIRMED_ENGINEERING_STRATEGY` | L53-54 retires patents/grants/loans/SBA/franchise "never reintroduce"; L11 asserts a legal entity name; adopts "money, atoms, or audience" and a Dan Martell strategy as standing truth. **Stop loading automatically in prompt-generation commands.** |
| `FINANCE_PORTAL_SIGNOFF.md` | `STALE_OR_CONFLICTED` | L9 names a DIFFERENT legal entity than `MASTER_CONTEXT.md`. Both suppressed externally until resolved. |
| `DAN_MARTELL_AI_PLAYBOOK.md`, `ACTIVATION_PLAYBOOK.md` | `ENGINEERING_HYPOTHESIS` | third-party method, adopted without recorded approval |

### brain-v2

| path | class | issue |
|---|---|---|
| `brain-v2/MASTER_PROMPT.md` | `ENGINEERING_HYPOTHESIS` + **stale authorization** | §24 embeds a COMPLETED build cycle as live authority: AUTHORIZED FILES, PROTECTED FILES, EXECUTION AUTHORITY. Its "KNOWN CURRENT STATE" says 3 of 28, no motor path, no forward model, no persistence — all four now false. A future agent can read old one-session permission as standing permission. **Task authorization must move to per-task records.** |
| `brain-v2/SPEC.md` | `REVIEWER_MODEL / ENGINEERING_HYPOTHESIS` | Claims to be "verbatim, as supplied by the neurologist reviewer" with no reviewer identity, credentials, immutable original, date, signature, or owner acceptance. Several invariants are project doctrine rather than biology — INV-6's four orthogonal neuromodulators (cf. Avery & Krichmar 2017 on extensive cross-interaction), INV-9's error-only ascent (cf. Shipp 2016: a theory against incompletely mapped microcircuitry), INV-12 self-labels "Project doctrine". **The implemented mechanisms and their measured results stand regardless.** |
| `brain-v2/SCORECARD.md` | `MEASURED_RUNTIME_FACT` | reproducible: `node brain-v2/test/loop-acceptance.js`. Carries its own withdrawal history (26/28 and 25/28 both withdrawn). Good provenance. |
| `brain-v2/CONTRACT.md` | `ENGINEERING_HYPOTHESIS` | unreviewed |
| `brain-v2/CHART-01-SENSORS.md`, `CHART-02-SYNTHESIS.md` | `GENERATED_ARTIFACT` | |

### System maps — dated snapshots presented as current

| path | class | issue |
|---|---|---|
| `SYSTEM_MAP_FULL.md` | `MEASURED_SNAPSHOT` | compiled 2026-06-07, calls its measurements "exact" with no validity date |
| `SYSTEM_MAP_SIMPLE.md` | `STALE_OR_CONFLICTED` | turns that snapshot into "the only five decisions that matter" |
| `SYSTEM_MAP.md`, `AI_SYSTEM_MAP.md`, `HONO_ROUTE_MAP.md`, `DOMAIN_BUILDOUT_PLAYBOOK.md` | `MEASURED_SNAPSHOT` | re-verify against code before use |

### Audits — evidence, superseded in rounds

| path | class | note |
|---|---|---|
| `PER_DOMAIN_AGENT_ARCHITECTURE_AUDIT{,_R2,_R3}.md` | `MEASURED_SNAPSHOT` | R3 supersedes R2 supersedes R1. Earlier confident statements were corrected by later inspection and there is **no supersession marker in the earlier files**. |
| `BRAIN_COMPLETENESS_ANALYSIS.md` | `STALE_OR_CONFLICTED` | its "every edge weight hardcoded 0.3" claim was later corrected by `PROTECTED_FILES.md` |
| `DEFECT_LEDGER.md`, `docs/audits/*.md` | `MEASURED_SNAPSHOT` | time-bounded evidence |

### Scientific library — source and synthesis are merged

| path | class | issue |
|---|---|---|
| `NEURO_LEARNING_REFERENCE.md` | mixed | says "source material, no LIMEN mapping" while its coverage table includes "THE ISOMORPHISM" and "the LIMEN thread" |
| `BRAIN_STRESS_CIVILIZATION_SYNTHESIS.md` | mixed | claims substrate independence is sourced while conceding civilization-scale prediction is unvalidated |
| `ENERGY_NEURO_AUDIT.md` | mixed | |

**Required:** per-claim labels `SOURCE_SAYS` / `ENGINEER_SYNTHESIS` / `LIMEN_HYPOTHESIS` /
`OWNER_ACCEPTED_DESIGN`. Keep the library; separate the authority levels.

### Design proposals — not built state

`HIPPOCAMPUS_CONSOLIDATION_SPEC.md`, `PHASE_ESTIMATOR_SPEC.md`,
`SERVER_SIDE_PLASTICITY_DESIGN.md`, `docs/*proposal.md`, `docs/wave-radar-design.md` →
`DESIGN_PROPOSAL`. None is evidence that the thing exists.

### Vendored tool docs

`.claude/skills/**` → `GENERATED_ARTIFACT` / vendor documentation. **No authority over LIMEN
product intent.** Note these are third-party files that matched the corpus search for "456"
purely as unrelated ID examples.

## Two properties replace the word "firewalled"

`firewalled` conflates deployment with confidentiality and caused a real error. Every document
claiming internal status must instead state:

```text
deployed_to_website: yes|no      # controlled by .vercelignore
repository_visibility: public|private   # controlled by GitHub — currently PUBLIC
```

## Open supersession debt

No file in this repository declares `supersededBy`. Until maps and audits carry commit hash,
measurement date, scope, and an explicit supersession pointer, a future agent can read an old
confident statement without ever discovering its correction. Three documents above are known
to be in exactly that state.
