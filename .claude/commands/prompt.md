---
description: Build a grounded system prompt for a task using Dan Martell's ROLE / RESEARCH / FORMAT method + Master Context (Layer 1, $0)
allowed-tools: Read, Grep, Glob
argument-hint: "<task> - what you want the AI to do"
---

FREE command. Turn a loose ask into a disciplined, grounded prompt. Method: Dan Martell's
system-prompt structure (see `DAN_MARTELL_AI_PLAYBOOK.md` sec 3), grounded in this business.

Steps:
1. Read `docs/MASTER_CONTEXT.md` first so the prompt is grounded in the real business, not generic.
   If a field the task depends on is still `<<FILL>>`, ask the operator for just that field, then continue.
2. Build the prompt with exactly these three blocks:
   - **ROLE**: who the AI should act as (specific expertise, whose interests it serves, what it must
     never do - fold in the relevant hard constraints from Master Context).
   - **RESEARCH**: what it must gather or consider before answering (data sources, files, live feeds,
     prior decisions). Name concrete repo paths / feeds where they exist. No invented data.
   - **FORMAT**: the exact output shape (sections, length, table vs prose, the one decision or artifact
     it must end on). Default to "recommend, do not survey" and "label validated/inferred/speculative."
3. Return the finished prompt in a copy-paste block, then one line on what to tweak if the first run misses.

Boundaries:
- Layer 1, read-only. Never edits files, never spends, never calls paid AI. It writes a prompt; the
  operator (or a metered command) runs it.
- Never produce a prompt whose output would be outward-facing action (send/publish/spend) without a
  human-gate note in the FORMAT block.
- No long dashes. No sycophancy.
