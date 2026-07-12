---
description: Operator health board — repo state + Vercel deployment + open ledger items (Layer 1, $0)
allowed-tools: Bash, Read
---

Produce a one-screen operator health board. Deterministic only — no code changes.

1. Repo state: current branch, `git status -s`, and whether local is ahead/behind `origin/main`.
2. Vercel: latest production deployment state + URL for this project (via the Vercel MCP/connector if available; otherwise say "connector not attached").
3. Ledger: read `.claude/operator-ledger.json` and summarize open_requests, built-but-not-deployed, and pending_decisions awaiting the operator.

Format as a compact table. Do not push, deploy, or edit anything. This command must cost zero model reasoning beyond formatting — just read and report.
