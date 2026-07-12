---
description: Review a domain/module/diff and return ranked findings — no edits (Layer 2, metered)
allowed-tools: Bash, Read, Grep, Glob
argument-hint: "<target> — e.g. finance | the working diff | assets/js/kernel-comparison.js"
---

METERED command (spends tokens). Review `$ARGUMENTS` and return findings only — apply nothing.

1. Locate the target (a domain's files, a module, or the current `git diff`).
2. Review for: correctness bugs, retired-lane reintroductions (investment + research are the ONLY lanes), firewall leaks, em/en dashes in prose, dead wiring, over-claims of "validated" outside the kernel envelope.
3. Return findings ranked most-severe first: file:line, one-sentence defect, and a concrete failure scenario. Mark each CONFIRMED or PLAUSIBLE.

Do not edit, commit, or deploy. Log a one-line summary to `.claude/operator-ledger.json` under open_requests if the operator should act. Respect any `*_MAX_TOKENS` / `*_DAILY_CAP` cap in the environment.
