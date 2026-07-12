---
description: Build + lint + route/link check; report pass/fail with failing lines (Layer 1, $0)
allowed-tools: Bash, Read, Grep
---

Verify the working tree is deployable. Deterministic checks only, no fixes applied.

Run whatever of these exist in this repo, and report each as PASS/FAIL with the failing output:
1. Node syntax check on changed `.js`/`.mjs` files (`node --check`).
2. Any build/lint script in `package.json`.
3. Route sanity: confirm `vercel.json` rewrites/redirects resolve to real targets (cleanUrls project — clean-path targets, not `.html`).
4. Dead-link/portal sync gaps if a checker script exists.

End with a single verdict line: DEPLOYABLE or NOT. If NOT, list the exact blocking items. Never edit, commit, or deploy.
