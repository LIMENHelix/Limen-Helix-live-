---
description: Commit the working tree into logical commits and (with explicit confirm) push — which auto-deploys (outward action, double-gated)
allowed-tools: Bash, Read
argument-hint: "[--push]"
---

OUTWARD/IRREVERSIBLE command. Push to `main` auto-deploys to production and costs Vercel build time.

1. Show `git status` and a summary of what would ship.
2. Stage the working tree into LOGICAL commits (group by concern, one message each). End every commit message with:
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
   Use hyphens, never em/en dashes.
3. STOP. Do NOT push unless the operator passed `--push` AND explicitly confirms in this turn. Committing is fine; pushing is the gated step.
4. On confirmed push: `git push origin main`, then report the deploy is triggered. Mark shipped items deployed:true in the ledger.

Never push on ambiguity. Never make a repo public. killswitch has no origin — for it, `/ship` means the manual Vercel CLI deploy, still confirm-gated.
