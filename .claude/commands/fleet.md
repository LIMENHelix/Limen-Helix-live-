---
description: Run the 20 named domain operators + master Kai; print the ranked decision board (Layer 1, $0). --deliberate <domain> opens a gated AI pass (Layer 2)
allowed-tools: Bash, Read
argument-hint: "[--deliberate <domain>] — blank runs the free board"
---

The operator FLEET. Twenty self-named domain operators (see `lib/operator-fleet.js`) each reach
one bounded decision from their brain's live signals; master **Kai** runs the salience
competition and speaks one system decision. Deterministic path is $0. Reuses the honest rules in
`assets/js/limen-decision.js` + `assets/js/limen-workspace.js`. Everything stops at the human gate.

## Live board (Layer 1, $0)
- Production: `curl -s https://limenhelix.com/api/fleet` — runs the 20 operators + master Kai off the
  latest server signals (console_snapshot + per-domain cognition + opportunities_snapshot). Add
  `?journal=1` to record the run so operators compound. This is the real, live board.
- Local (no Redis): `node lib/operator-fleet.js` prints the deterministic board; operators honestly
  report "no live signal" without production Redis. Do NOT fabricate state to make it look busy.
- Report the top 1-3 by salience and, for any at `open-human-gate`, the exact human step required.
  Recommend one thread; do not survey all twenty.

## Master Kai read (paid, gated) — `?master=1`
- `curl -s "https://limenhelix.com/api/fleet?master=1"` asks Kai to reason over the whole board and
  speak one master decision. This is the ONLY paid path here: `masterDeliberate` routes ai-orchestrator,
  blocked by the kill switch (`LIMEN_AI_ENABLED` + runtime pause) + per-tick budget, so it returns
  `masterDeliberation.disabled:true` until the operator opens the budget. The free deterministic system
  decision is always present regardless. Kai is bounded to recommend/open-human-gate; it never acts.

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
