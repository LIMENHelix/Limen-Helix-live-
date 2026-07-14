---
description: Run the 20 named domain operators + master Kai; print the ranked decision board (Layer 1, $0). --deliberate <domain> opens a gated AI pass (Layer 2)
allowed-tools: Bash, Read
argument-hint: "[--deliberate <domain>] — blank runs the free board"
---

The operator FLEET. Twenty self-named domain operators (see `lib/operator-fleet.js`) each reach
one bounded decision from their brain's live signals; master **Kai** runs the salience
competition and speaks one system decision. Deterministic path is $0. Reuses the honest rules in
`assets/js/limen-decision.js` + `assets/js/limen-workspace.js`. Everything stops at the human gate.

## Default run (Layer 1, $0)
1. `node lib/operator-fleet.js` — prints the ranked board: each operator's name, domain, posture
   (abstain/hold/monitor/act/escalate), bounded action (abstain/monitor/recommend/open-human-gate),
   and Kai's system decision.
2. If a live-signal source is wired (Redis snapshots), load it and pass it to `runFleet(states)`;
   otherwise operators honestly report "no live signal" until the brains feed them. Do NOT fabricate
   state to make the board look busy.
3. Report the top 1-3 operators by salience and, for any at `open-human-gate`, the exact human step
   required (what to spend/approve/send). Recommend one thread; do not survey all twenty.

## Deliberate (Layer 2, gated) — `--deliberate <domain>`
- Calls `operator-fleet.deliberate(domain, state)`, which routes through `ai-orchestrator` (Claude to
  reason, Grok to retrieve). This is the ONLY paid path. It is blocked by the kill switch
  (`LIMEN_AI_ENABLED` + runtime pause) and the per-tick budget, so it returns "AI spend disabled"
  unless the operator has explicitly opened the budget. Even when it runs, the operator returns a
  written recommendation, never an action.
- Use it to let one named operator "think harder" on its single best capital-light move.

Boundaries:
- Never let an operator spend, send, publish, or deploy. boundedAction tops out at open-human-gate.
- Never claim "validated" — every fleet output is interpretive:true, validated:false.
- No long dashes. No sycophancy. Lead with the strongest objection to the top move.
