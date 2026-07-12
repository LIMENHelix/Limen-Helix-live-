---
description: Print or update the operator tracking ledger (Layer 1, $0)
allowed-tools: Bash, Read, Edit
argument-hint: "[show | add-request <text> | resolve <id> | decide <id> <choice>]"
---

The ledger at `.claude/operator-ledger.json` is how state persists between on-demand runs (there is no daemon). Handle `$ARGUMENTS`:

- `show` (default): render open_requests, built, pending_decisions, guardrails_tripped as a readable board.
- `add-request <text>`: append a new open_request with a short id, status "open", today's date. (Use the date from context — do not call Date.now in scripts.)
- `resolve <id>`: mark that request/build done.
- `decide <id> <choice>`: record the operator's choice on a pending_decision and set awaiting_operator=false.

Only ever edit `.claude/operator-ledger.json`. Never touch code, commit, or deploy from this command.
