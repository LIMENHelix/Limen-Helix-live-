---
authority: OWNER_STATED_PENDING_CONFIRMATION
stated_by: Chris Hubbel (owner), in the Markdown Authority Audit review
stated_at: 2026-08-02
approved_by: null          # <- owner fills this in; nothing else may.
approved_at: null          # <- until set, this file is a RECORD of intent, not a ratified mandate.
version: 0.1
supersedes: []
scope: product mission and non-negotiable outcome requirements
recorded_by: engineering agent (Claude), from owner statements relayed in the audit
---

# OWNER SYSTEM INTENT

**Read this before `CLAUDE.md`, `docs/MASTER_CONTEXT.md`, `brain-v2/SPEC.md`, or any
`.claude/commands/*.md`.** Where any of those conflict with this file, this file wins once
it is ratified — and until it is ratified, the conflict is unresolved and the conservative
reading applies (see §5).

**Why this file is version 0.1 and not 1.0.** I recorded it; the owner has not signed it.
An engineering agent cannot self-certify owner approval — doing so would reproduce the exact
defect this file exists to correct, which is engineer-authored doctrine wearing the authority
of owner intent. Setting `approved_by` and `approved_at` is the owner's act alone.

---

## 1. What the system is for

1. **Handle the 465,939-file domain corpus productively.** Confirmed 2026-08-02: "456k" means
   465,939 domain JSON files in the FULL repo, one per domain node, L1-L8. See §4.1 for the
   reproducing command and depth distribution.
2. **Turn that corpus into business opportunities and research opportunities.** This is the
   product. A brain that regulates itself beautifully on one bound domain and produces no
   opportunity from the corpus has not met the requirement.
3. **Map in both directions:**
   - business and other system evidence → neurology;
   - neurology → hypotheses about human behaviour and other systems in civilization.

## 2. What must not be discarded

**Working code and demonstrated real-world results are preserved.** Criticism of a biological
analogy is not grounds to remove a mechanism that runs, consumes real data, and produces
useful output. Relabel or constrain an inaccurate analogy by default. Remove code only on
runtime evidence that it is dead, harmful, duplicative, or counterproductive.

## 3. Every brain component is scored on TWO axes, independently

| Axis | Question | Admissible evidence |
|---|---|---|
| **Operational effectiveness** | Does it run, consume real data, produce useful results, persist, learn, and survive failure? | Runtime traces, production-shaped tests, resolved outcomes, restart and rollback evidence |
| **Neurological fidelity** | Is the biological mapping accurate, bounded, and sourced? | Primary literature, declared abstraction class, competing interpretations, falsification criteria |

`operationally strong / neurologically approximate` and `neurologically plausible /
operationally unwired` are both legitimate results. **Neither axis may silently overwrite the
other**, and a single blended score is not permitted — it is how a naming quarrel gets to
delete working software, and how unwired code gets to look finished.

## 4. Owner-resolved facts, and what remains open

### 4.1 What "456k" counts — RESOLVED 2026-08-02 by the owner

**456k = 465,939 domain JSON files in the FULL repository.**

```
repo:     C:\Users\Chris\Limen-Helix        (full, 595,286 tracked files)
command:  git ls-files 'assets/data/domains/*.json' | wc -l
result:   465939                            measured 2026-08-02
```

The unit is **files** — one JSON per domain node. Not records, entities, relationships or
fields. Depth distribution at that measurement:

| level | files |
|---|---:|
| L1 | 28 |
| L2 | 419 |
| L3 | 3,266 |
| L4 | 14,733 |
| L5 | 120,512 |
| L6 | 296,895 |
| L7 | 30,085 |
| L8 | 1 |

**This corpus lives in the FULL repo, not the live one.** The live repo
(`Limen-Helix-live-`) tracks only 3,715 of those domain JSONs — the L1-L3 tier that
`.vercelignore` deploys — plus a 173,652-entry portal registry that indexes the rest. Any
acceptance test for the corpus mission has to reach the full repo or that registry; running
against the live repo alone touches under 1% of the corpus.

### 4.2 Legal entity name — RESOLVED 2026-08-02 by the owner

**The legal entity is `LIMEN Helix Transformational Sciences LLC`.**

`FINANCE_PORTAL_SIGNOFF.md:9` was correct. `docs/MASTER_CONTEXT.md:11` ("LIMEN Helix LLC")
is wrong and has been corrected in place with a note.

**One check before this goes on anything binding.** The owner confirmed the entity in prose
containing two evident typing slips ("Transformatinal Sciencess"). I have used the spelling
already present in three tracked files — `LIMEN Helix Transformational Sciences LLC` —
because it matches the intent. For a registered legal name the exact characters matter, so
**verify against the filing itself before this appears on a contract, invoice, filing, or
customer-facing document.** My reading of a typo is not authority over a legal name.

### 4.3 Repository visibility

`github.com/LIMENHelix/Limen-Helix-live-` is **PUBLIC** (verified 2026-08-02,
`gh repo view --json isPrivate`). `.vercelignore` is a **deploy filter only** and confers no
confidentiality. At least 32 tracked Markdown files describe themselves as internal or
firewalled; all of them are world-readable, several for weeks. No credentials were found in
them; the exposure is architecture and internal reasoning.

Owner decision required: make the repo private, rewrite history, or accept the exposure.
Deleting a file in a later commit does **not** remove it from history.

## 5. Conservative default while conflicts stand

Four active documents disagree about what an agent may do unprompted:

| document | position |
|---|---|
| `CLAUDE.md:14` | "normal pushes to `main` are fine" without `AGENT_BUILD=1` |
| `CLAUDE.md:44,47` | metered spend allowed to budget; deploy/publish allowed, rate-limited |
| `docs/MASTER_CONTEXT.md:46` | human holds spend, funds, buyer contact, outward publishing, signing |
| `docs/operator-agent-prompt.md:32` | explicit approval required for all of the above |
| `.claude/commands/ship.md:13` | do NOT push without `--push` AND explicit confirmation in-turn |

An environment variable is not evidence a human approved a production deployment.

**Until the owner reconciles these, the most conservative rule governs.** No spend, send,
publish, production push, visibility change, legal commitment, or movement of funds without
explicit current approval in the active conversation.

## 6. What "done" requires

Acceptance is measured end to end on the real corpus, not on the kernel in isolation:

**portal evidence → opportunity generation → outcome grading → learning**

Until that chain runs on real portal data and produces a graded outcome, no claim that the
brain "works" is admissible, regardless of the SPEC checklist score. The checklist measures
mechanism; this measures product.

---

## Related

`DOCUMENT_AUTHORITY.md` — per-document authority class, provenance, and supersession.
