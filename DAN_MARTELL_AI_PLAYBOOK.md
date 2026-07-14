# Dan Martell — AI Playbook (detailed notes)

Source: public YouTube videos + summaries + Dan Martell's own blog, scraped 2026-07-14.
Internal reference (firewalled in `.vercelignore`). Labels: **[transcript/summary]** = pulled
from actual video summary text; **[title/desc]** = inferred from title + description only.

## Videos / episodes found

- "The Automation Expert: How To Get RICH In The New Era Of AI" — youtube.com/watch?v=I9-D0YezWXc
- "How to Use AI Better Than 95% of the World" — youtube.com/watch?v=9q5JnlCyu4U
- "How To Actually Make Money With AI In 2026" — youtube.com/watch?v=6WgD2Drr1Pc
- "How To Actually Get Ahead With AI (Before It's Too Late)" — youtube.com/watch?v=abGXsagW0jo
- "These ChatGPT Hacks Will Make You SO Productive It Feels Illegal" — youtube.com/watch?v=Mxy6MVbpNhg
- "How to Get Ahead of 99% of People (with AI)" — youtube.com/watch?v=0tLHVyd7WtM
- "This is Your Last Chance to Get Rich (Before AI Replaces You)" — youtube.com/watch?v=eYyWFJpVBBI
- "These 5 AI Agents Will Make You $1M With Zero Employees" (podcast/video)
- "These 6 ChatGPT Hacks Will Make You So Much Money It Feels Illegal" (podcast)
- Blog: "AI Is About to Change Business Forever" — danmartell.com/ai-is-about-to-change-business-forever

---

## 1. The 5 AI Agents (his "$1M with zero employees" spine) [summary]

Build order (each unlocks capacity for the next): **Closer → Assistant → Workflow → Amplifier → Money.**

1. **CLOSER (sales).** Runs the pipeline end to end: lead intelligence (research, scraping,
   enrichment), voice-AI qualifier that intercepts unanswered calls, asks about urgency/budget,
   books pre-qualified leads onto a human closer's calendar. Tool named: Breezy.app (service trades).
2. **ASSISTANT (admin).** Email sorting/tagging, calendar optimization, travel/booking research.
   Pitch: "doesn't go on vacation, get sick, or make mistakes." Pair a human EA with AI for the routine.
3. **WORKFLOW (ops).** System-creator bot that watches a screen-recording of work and auto-writes the
   SOP/checklist; office-manager bot; support bot that also spots upsells. Tool named: Trainual.com.
   Frame (Michael Gerber): "let the systems run the business and the people run the systems" — now the
   systems self-manage.
4. **AMPLIFIER (marketing).** Analyzes what content performs, checks new content against brand voice,
   spins one source into reels/newsletter/social. Example cited: "Arnold's Pump Club" AI-voice newsletter/podcast.
5. **MONEY (finance).** Cash-flow forecasting bot, AP/payment bot (scans PDFs/POs, runs approvals),
   fraud/anomaly bot.

## 2. The orchestrator model — "Kai" and sub-agents [summary]

- **Kai** = his single orchestrator agent. It spins up, delegates to, and coordinates every sub-agent —
  and can *create new agents* (it created "Reese" on request).
- **Reese** = a specialist sub-agent (real estate, one city) with its own email; counterparties think
  it's a person. Runs continuously scanning off-market deals.
- Other named sub-agents: **Procure** (end-to-end purchasing on a monitored virtual card), **Speak**
  (gives the orchestrator a phone number for voice triage/delegation).
- **Apex** ("Agent Platform for EXecution") = his internal platform, **built on top of OpenClaw**,
  hardened for security and simplified for team deployment.
  > Directly relevant to us: LIMEN's builder/operator split is already an OpenClaw pattern. His "Kai
  > orchestrates sub-agents" = our operator → builder handoff. We already have the skeleton.

## 3. ChatGPT as a business operating system (the most copyable method) [summary]

Turn ChatGPT from a chatbot into an OS with four layers:

1. **Master Prompt** — a standing context doc the model always has: team size, revenue, product list,
   customer profile, current projects, goals. (This is just a reusable system/context file.)
2. **System Prompts** — structure every ask around three keywords: **ROLE** (who the AI should be),
   **RESEARCH** (what to gather/consider first), **FORMAT** (exact output shape).
3. **Projects** — group related chats + files so context persists per initiative.
4. **Custom GPTs** — freeze a system prompt into a shareable tool so a repeatable task runs the same way
   every time and can be handed to the team.

**Model mapping (we use Claude/Grok, NOT ChatGPT).** Martell teaches on ChatGPT, but every layer is
model-agnostic. In our stack:
- Master Prompt -> `docs/MASTER_CONTEXT.md` (loaded by any model) + `CLAUDE.md`.
- System Prompt (ROLE/RESEARCH/FORMAT) -> the `/prompt` command; works verbatim in Claude, Grok, or the app.
- Projects -> Claude Projects (or Grok workspaces) for persistent per-initiative context.
- Custom GPTs -> `.claude/commands/*.md` (Claude Code) and Claude Projects. This stack already runs on
  Claude (Anthropic keys, Claude Code builder). Nothing here should be wired to ChatGPT.

## 4. The 5 business shifts (strategy frame) [blog]

1. **Org charts → leverage charts** — ask "what system creates leverage?" not "who do we hire?"
2. **Doer → director** — spend 80-90% directing outcomes/designing workflows, not executing tasks.
3. **Feature moats → data moats** — proprietary customer data + feedback loops beat feature speed.
4. **Autonomous back office** — policy-driven agents replace routine finance/HR/legal. Rule of thumb:
   **"Exceptions deserve people. Patterns deserve code."**
5. **Development advantage → distribution advantage** — anyone can build now; owning an audience wins.
   Build one owned channel/week; attach an outcome-based promise ("72 hours to X"); pre-sell before building.

Also names an **"AI Ops person"** role: non-technical, removes friction / frees team time via automation.

## 5. Tools he names (external SaaS — signup/paid, human-gated for us)

Atlas (voice agent, youratlas.com), n8n (workflow automation), Lovable (text-to-app), GetRevio
(multi-channel sales assistant), Social Sweep (network intros), Hello Frank (finance co-pilot),
Alysio (revenue analytics), FlexPay (declined-payment recovery), Hero Hire (recruiting), Precision
(KPI anomaly alerts), Trainual (SOPs), Breezy (trades sales), Make/Zapier (automation).

---

## What maps onto LIMEN Helix (implementable vs not)

**Implementable in-repo, free, deterministic (no paid-AI cycle):**
- The **ChatGPT-OS architecture** (§3) → a Master Context file for the LIMEN operator + a small library
  of ROLE/RESEARCH/FORMAT system-prompt skills. This is the single highest-fidelity, zero-cost port.
- The **orchestrator→sub-agent** mental model (§2) → we already run OpenClaw operator→builder; document
  the 5-agent taxonomy as the map of what sub-agents *would* own.

**NOT doing autonomously (constitution: cost discipline + human-gated actions):**
- Spinning up live paid AI agents (Closer/Money/etc.) on any recurring cycle — kill-switch rule.
- Signing up for / paying any external SaaS (Atlas, n8n cloud, GetRevio, Precision, etc.).
- Anything outward-facing (an agent emailing real counterparties like "Reese" does).

**Advice-only (no code):** the 5 shifts, director mindset, distribution-first, pre-selling.
