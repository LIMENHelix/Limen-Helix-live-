# Operator Control Surface

On-demand command menu for driving LIMEN Helix, AllAccessKC, and killswitch from any
Claude Code session — local **or** the claude.ai cowork environment (once GitHub is
connected there). Design: `docs/OPERATOR_AUTOMATION_DESIGN.md`. You are the trigger;
nothing here fires on a clock.

## Commands (this repo)

| Command | Layer | Cost | Does |
|---|---|---|---|
| `/status` | 1 | $0 | Repo + Vercel + ledger health board |
| `/verify` | 1 | $0 | Build/lint/route check → DEPLOYABLE verdict |
| `/ledger [show\|add-request\|resolve\|decide]` | 1 | $0 | Read/update the tracking ledger |
| `/audit <target>` | 2 | metered | Ranked findings, no edits |
| `/build <spec>` | 2 | metered | Scoped change → uncommitted diff, never auto-shipped |
| `/decide <question>` | 2 | metered | Decision brief: options + recommendation |
| `/ship [--push]` | outward | deploy $ | Logical commits; push is double-confirmed |

**Cost rule:** Layer 1 is always free. Layer 2 spends only when invoked, capped by
`*_MAX_TOKENS` / `*_DAILY_CAP`. Nothing recurring, nothing unattended.

**Decision model:** request → Claude *proposes* (diff or brief) → you approve → apply.
Anything irreversible or outward (push→deploy, send, publish, make-public) takes a
second explicit confirm. No command deploys or publishes on its own.

## How cowork controls this

The commands live in `.claude/commands/` **in the repo**. Once you connect GitHub to
the cowork environment, cowork clones the repo and inherits the identical command set
— it runs `/status`, `/audit`, `/build`, `/ship` exactly as a local session does.
Vercel control (deploy/logs) is already available to cowork via its Vercel connector.

## Per-project status

| Project | Git | Vercel | Command surface |
|---|---|---|---|
| **LIMEN Helix (live)** | `LIMENHelix/Limen-Helix-live-` | connected | this file (primary) |
| **AllAccessKC** | `LIMENHelix/AllAccessKC` | connected | mirror these commands + firewall guard (no LIMEN/autism refs; PRs not main) |
| **killswitch** | none yet — needs private repo | CLI deploy | blocked until repo created + pushed |

## Your steps to hand cowork the wheel

1. **Connect GitHub** to the cowork environment (claude.ai/desktop app → connectors →
   GitHub) and grant it the `LIMENHelix` repos you want it to drive. This is the one
   step only you can do; it is what gives cowork the source.
2. **Confirm Vercel scope** — already connected; verify it covers the projects above.
3. Say the word to **push** this command surface (auto-deploys LIMEN live) and to
   **create the private killswitch repo** so all three are drivable.
