---
description: Implement a scoped change; leave it as an uncommitted diff or PR — never auto-applied to prod (Layer 2, metered)
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
argument-hint: "<spec> — what to build/change"
---

METERED command. Implement `$ARGUMENTS` under the propose→approve→apply model.

1. Read the relevant code first; confirm scope. If the spec is ambiguous or would touch >~10 files, stop and return a plan instead of editing.
2. Make the change in the working tree only. Match surrounding code style, comment density, and idioms.
3. Run `/verify` checks on what you changed.
4. STOP at an uncommitted diff. Summarize what changed and why.

Boundaries:
- Never commit or push in this command. `/ship` handles that behind an explicit confirm.
- Never reintroduce retired lanes (patents/grants/loans/SBA/franchise).
- In AllAccessKC: never reference LIMEN, limenhelix.com, or the autism site; write to a branch, not main.
- Append the built item to `.claude/operator-ledger.json` (deployed:false).
