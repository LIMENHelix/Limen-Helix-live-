# OpenClaw -> Claude Code handoff

How the OpenClaw operator agent dispatches build tasks to Claude Code (the builder), and the
task format to send. Internal (firewalled from the website).

## Wiring (one-time, in OpenClaw's config)
- **Working directory:** `C:\Users\Chris\Limen-Helix-live-` (the repo; both agents share it).
- **Builder command OpenClaw runs there:**
  - Windows: `set AGENT_BUILD=1 && claude -p "<TASK>"`
  - POSIX:   `AGENT_BUILD=1 claude -p "<TASK>"`
  - `AGENT_BUILD=1` arms the deploy gate (branch-only; the pre-push hook blocks main).
  - Confirm the headless flag with `claude --help` (`-p` / `--print` = non-interactive).
- **Enable the deploy gate once** (in the repo): `git config core.hooksPath .githooks`
- OpenClaw's own system prompt = the operator prompt (see `docs/operator-agent-prompt.md` if
  saved). The builder reads its rules from `CLAUDE.md` automatically.

## Task payload format (what OpenClaw puts in `<TASK>`)
Keep it self-contained; the builder gets one shot, no back-and-forth.

```
GOAL:        <one sentence: the outcome the operator wants>
WHY:         <the decision or revenue line this serves>
DO:          <concrete change to make>
ACCEPT:      <how "done" is checked - the verification that must pass>
CONSTRAINTS: <anything off-limits: files not to touch, no new deps, etc.>
```

The builder will: implement it, VERIFY against ACCEPT, commit to a branch `agent/<slug>`,
push the branch (never main under AGENT_BUILD=1), and return a report.

## What comes back (builder report)
- Summary of what changed + the files.
- HOW it was verified (the check that was run).
- The branch name to review/merge (merging is what deploys to production).
- Anything that hit a human gate (deploy / spend / publish) and stopped.

## The gates (enforced in code, not trust)
- **Deploy:** `.githooks/pre-push` rejects pushes to main when `AGENT_BUILD=1`. A human merges
  the branch to trigger the Vercel production deploy.
- **Cost:** OpenClaw caps its own model spend; each `claude -p` run costs Claude usage, so cap
  invocation frequency; the live app's paid AI stays behind `lib/ai-kill-switch`.
- **Live-system actions** (not code) go through the app API with the admin key, not the repo.

## Example
```
GOAL: Show feed freshness age on each civilization board card.
WHY:  Operator wants to see stale feeds at a glance before acting on a domain.
DO:   In assets/js/ui/clarity-vitals.js renderFeeds(), already shows LIVE/OFFLINE; make the
      age text red when > 6h old.
ACCEPT: node --check passes; grep shows the age-color logic; no other file changed.
CONSTRAINTS: Do not touch the galaxy or console-clarity.js. No new dependencies.
```
