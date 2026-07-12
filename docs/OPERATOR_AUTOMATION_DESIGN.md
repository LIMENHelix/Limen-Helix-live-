# On-Demand Operator Automation — Design

Status: **DESIGN ONLY — not wired.** Cost posture chosen: *hold, design first.*
Trigger model: *on-demand (operator-invoked, no unattended firing).*
Scope: **LIMEN Helix (live), AllAccessKC, killswitch.**
Author: Claude Code · 2026-07-12

---

## 0. The honest ceiling (read first)

There is **no always-on Claude daemon** that watches your requests and acts. What
Claude Code actually offers is three primitives; this design uses only the ones that
fit "on-demand" and "spend nothing until I say so":

| Primitive | What it is | Cost | Used here |
|---|---|---|---|
| **Slash commands** (`.claude/commands/*.md`) | Reusable prompts you invoke by typing `/name`. | $0 to define; metered only when run | ✅ the core trigger surface |
| **Hooks** (`settings.json`) | Shell commands that fire on session events (after-edit, on-stop). Deterministic scripts, not AI. | $0 | ✅ for zero-token guards/notify |
| **Scheduled routines / GitHub Actions** | Cron-fired unattended runs. | recurring $ | ⏸ deferred — this is the unattended path you shut off |

"On-demand" means **you** are the trigger. Everything below fires only when you type
a command. Nothing runs on a clock. This keeps it inside `TOKENS_PER_TICK=0`,
build-drain-stays-manual, and work-frozen-pending-funds.

---

## 1. Three layers (by cost, safest first)

The system separates *what costs nothing* from *what spends tokens*, so you can run
the whole first layer forever at $0 and only reach for AI when a task needs judgment.

### Layer 1 — Deterministic commands (always $0, no model calls)
Plain scripts wrapped as commands. No Claude reasoning, just code doing verifiable
work. These should be the default for anything mechanical.

- `/status` — read repo state + Vercel deployment status + open ledger items, print
  one health board (exactly the project-status readout we already do by hand).
- `/verify` — build + lint + route/link check; report pass/fail with the failing lines.
- `/sync` — diff the full repo against the live repo, list/pull deltas (the recurring
  full→live gap).
- `/commit-batch` — stage the working tree into logical commits (what we did today),
  never push.
- `/ledger` — print the tracking ledger (§3) for this project.

### Layer 2 — AI-assisted commands (metered, hard-capped, operator-invoked)
Claude reads code + data and produces a decision or a change. Runs **only** when you
type it. Every run is capped with your existing env pattern
(`*_MAX_TOKENS` / `*_DAILY_CAP`).

- `/audit <target>` — review a domain/module/diff, return ranked findings (no edits).
- `/build <spec>` — implement a scoped change; leave it as an **uncommitted diff** or
  a PR, never auto-applied.
- `/decide <question>` — read the relevant code + data and return a **decision brief**:
  options, tradeoffs, a recommendation. Decision, not action.
- `/report <thing>` — synthesize state into a written status (e.g. the source ledger,
  a domain readout).

### Layer 3 — The tracking ledger (state between on-demand runs)
Because there's no daemon, continuity lives in a file each command reads/writes. This
is the "track and make decisions on my requests" backbone.

`/.claude/operator-ledger.json` per repo:
```json
{
  "open_requests":  [{ "id", "ask", "status", "opened", "notes" }],
  "built":          [{ "id", "what", "commit", "deployed": false }],
  "pending_decisions": [{ "id", "question", "options", "recommendation", "awaiting_operator": true }],
  "guardrails_tripped": [{ "when", "command", "reason" }]
}
```
Every command appends to it. `/status` and `/ledger` render it. Decisions are logged
`awaiting_operator: true` and are **never** acted on until you approve — this is the
propose-not-file / confirm-before-outward-action rule made mechanical.

---

## 2. The decision model — propose, approve, apply

"Make decisions on my requests" has a hard boundary baked in:

```
request → Claude reads code/data → PROPOSAL (diff or decision brief)
        → [ operator approves ] → apply / commit
        → [ irreversible?      ] → second explicit confirm before deploy/send/publish
```

- **Reversible + internal** (edit a file, write the ledger): applied on approval.
- **Irreversible or outward** (push→deploy, send mail, publish, make public): a second
  confirm, always. No automation flips a repo public or sends a mailer on its own.
- Claude may *recommend* strongly; it may not *execute* the outward step unattended.

This is the same posture as the rest of the system (kernel proposes, operator signs
off; nothing auto-files).

---

## 3. Per-project blueprint

### 3a. LIMEN Helix (live) — lowest friction, prove the pattern here
- On GitHub (`LIMENHelix/Limen-Helix-live-`), auto-deploys to limenhelix.com, already
  has the `immune-system.yml` Actions loop and SYSTEM_MAP to build on.
- Full command set (Layers 1+2). Deploy is push-triggered, so a `/ship` command =
  `/commit-batch` + push **behind an explicit confirm** (push = spend + public).
- Special commands: `/sync` (full→live), `/kernel-refresh` (rebuild watchlist/valuation
  longs — the scripts we just touched), `/portal-sync`.
- Reads the two source-of-truth repos; writes only the live one.

### 3b. AllAccessKC — same pattern, firewall-scoped
- On GitHub (`LIMENHelix/AllAccessKC`). Postgres (Neon) backed; seed via node not curl.
- **Every command inherits a firewall guard**: a preflight check that refuses to run
  if the task or output references LIMEN, limenhelix.com, or the autism site. The
  court-order anonymity boundary must survive automation, not just manual care.
- Layer-2 `/build` here writes to a branch + PR only (no direct main), given the live
  user base.

### 3c. killswitch.domains — prerequisite work first
- **No GitHub repo today** (CLI deploy only, no origin). Triggered automation and any
  Actions/routine path is impossible until it's in a repo.
- Prereq (when unfrozen): create **private** `LIMENHelix/killswitch`, push, connect.
- Until then: Layer-1 deterministic commands run locally; deploy stays the manual
  Vercel CLI step wrapped as `/ship` (confirm-gated).

---

## 4. Trigger surface

- **Local (primary):** `.claude/commands/*.md` in each repo → you type `/status`,
  `/audit finance`, `/build …`. One command set per repo; a shared template so they
  stay consistent.
- **Cross-project menu:** a top-level `OPERATOR.md` (or a `/menu` command) listing
  every command across the 3 projects, so you drive all three from one reference.
- **Cloud (deferred, optional):** any command can later be promoted to a **routine**
  you run manually from the app — same command, run off-device. This is the bridge to
  the original unattended vision, left off until you fund it.

---

## 5. Cost model

| Layer | When it spends | Ceiling |
|---|---|---|
| 1 (deterministic) | never | $0 |
| 2 (AI commands) | only on invocation | per-run `*_MAX_TOKENS` + `*_DAILY_CAP` |
| 3 (ledger) | never | $0 |
| routines/Actions | ⏸ not built | n/a until funded |

Nothing recurring. Nothing unattended. Matches killed-auto-spend and frozen-work.

---

## 6. Rollout (each phase gated on your go)

- **Phase 0 — now:** this design. Nothing wired. ✅
- **Phase 1 (when greenlit):** Layer-1 zero-token commands on LIMEN live. Prove the
  loop at $0. Reversible, no spend.
- **Phase 2:** Layer-2 AI commands on LIMEN live, capped. First metered spend — small.
- **Phase 3:** replicate to AllAccessKC (firewalled) + stand up the killswitch repo.
- **Phase 4 (optional, funded):** promote chosen commands to scheduled routines →
  this is where the original "runs automatically on triggers, decides, builds, tracks"
  vision actually turns on, deliberately and last.

---

## 7. What I need from you to move past Phase 0

1. **Greenlight Phase 1** (zero-token commands on LIMEN live) — or keep holding.
2. **The command list** — confirm/trim §1's commands; add any request-types you run
   often ("check deploys", "find broken portals", "refresh watchlist").
3. **killswitch repo** — say the word and I create the private repo + push (Phase 3
   prereq; no spend, but it is a new outward repo so I'll confirm before pushing).

Nothing above executes until you pick one.
