---
description: Read the relevant code + data and return a decision brief — options, tradeoffs, a recommendation. No action (Layer 2, metered)
allowed-tools: Bash, Read, Grep, Glob
argument-hint: "<question>"
---

METERED command. Answer `$ARGUMENTS` as a DECISION, not an action.

1. Gather the relevant code, data, and any prior ledger context.
2. Return: the question restated, 2–4 real options, the tradeoffs of each, and a single recommendation with its strongest counter-argument (lead with the objection, no sycophancy).
3. Mark each claim validated / inferred / speculative.

Record the decision in `.claude/operator-ledger.json` under pending_decisions with awaiting_operator=true. Change no code and take no outward action — the operator decides, then `/build` or `/ship` executes.
