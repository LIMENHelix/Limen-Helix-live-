# Finance Domain — Capital Engine · Activation Playbook

Companion to `assets/data/capital-engine.json`, `api/capital-engine.js`, and `/capital-engine`.
Ranked lowest-capital / highest-$-ROI first. For each stream: **YOU =** the human-only action
(account, TOS, tax info, key), **AI =** what the orchestrator runs once the key exists,
**NEEDS =** the exact info to hand the AI.

> **Honest boundary.** No AI can create an account, accept Terms of Service, or pass KYC/W-9 for
> you — those are legal acts requiring a person. The code rails are built to 100%; each stream needs
> one short human action to flip live, after which the AIs operate it. Items tagged **HUMAN-ONLY**
> are pure manual time (no meaningful automation) — listed for completeness but *not* where the
> autonomous engine earns. Items tagged **AUTONOMOUS-AFTER-KEY** are the real targets.

---

## How a key reaches the system
Every connector key is a **Vercel Environment Variable** (Project → Settings → Environment Variables).
Add the variable name shown, paste the value, redeploy. The page at `/capital-engine` then flips that
connector from `○ needs key` to `● ready` automatically — no code change. **Never paste a key into a
file or into chat;** only into Vercel env. The system reads presence only, never the value.

---

## TIER 1 — near-zero capital (highest $-ROI, ceiling = hours)

### ✅ Truly free + AUTONOMOUS-AFTER-KEY (do these first)

**1. Amazon Associates affiliate links** `[R]`
- **YOU:** Apply at Amazon Associates (need a live site/social with traffic — `/capital-engine` itself or AllAccessKC qualifies). Get tracking tag + PA-API keys after 3 qualifying sales.
- **NEEDS → AI:** `AMAZON_PAAPI_KEY`, `AMAZON_PAAPI_SECRET`, `AMAZON_ASSOC_TAG` (env). Plus: which niches/products to feature.
- **AI:** Generates product round-up content, inserts tracked links, schedules posts. Connector `amazon_paapi`.

**2. Impact.com affiliate** `[R]` / **3. Rakuten** / **4. ShareASale** / **5. CJ** / **6. ClickBank**
- **YOU:** Sign up (free), get approved per-merchant, copy API token.
- **NEEDS → AI:** the env keys listed in `capital-engine.json` connectors; target merchant categories.
- **AI:** Pulls offers, matches to content topics, generates linked copy. Same pattern across all five.

**7. Pinterest affiliate pinning** `[R]`
- **YOU:** Pinterest business account (free); connect to Impact/Amazon.
- **NEEDS → AI:** board themes, affiliate program.
- **AI:** Generates pin images (Higgsfield/Canva), captions, schedules. Disclosure tag auto-added.

**8. Medium Partner Program** `[R][AI]`
- **YOU:** Join Partner Program (free); enable.
- **NEEDS → AI:** topic lanes (e.g. systemic-risk explainers, KC business).
- **AI:** Drafts articles via `REFRESH_ARTIFACT`; you review + publish (Medium has no publish API for Partner content — **publish step is human**).

**9. Substack free→paid funnel** `[R][$]` ⚑ sign-off (charges customers)
- **YOU:** Create Substack; connect **Stripe** (this is the rail — see sign-off doc).
- **NEEDS → AI:** newsletter topic, cadence.
- **AI:** Drafts issues; you approve send. Paid tier requires Stripe sign-off.

### ⏳ Eligibility-GATED (free, but locked until thresholds met)

**10. YouTube Shorts / YPP** `[R][AI]` — needs 1K subs + watch-time. Connector `youtube` (`YOUTUBE_API_KEY`).
- **AI now:** faceless Shorts pipeline (Claude script → Higgsfield video → ElevenLabs voice) to *build toward* the threshold. **YOU:** create channel, accept YPP when eligible.

**11. TikTok Creativity Program** `[R][AI]` — needs 10K followers + 100K 30-day views. Connector `tiktok`.
- Same: AI produces, you post + enroll when eligible. **Verify TOS at execution — shifts often.**

**12. Threads / X Creator Program** — eligibility-gated; AI drafts, you post.

### 🔴 HUMAN-ONLY (no automation — listed, but not engine targets)
Receipt cashback (Fetch/Ibotta) · Prolific · UserInterviews/Respondent · UserTesting · Outlier/Scale
labeling · bank/brokerage/credit-card signup bonuses · crypto Learn&Earn · app referral codes · Foap
photos · FB Marketplace declutter · Buy-Nothing arbitrage · Reddit/Quora manual posting · microtasks
· transcription. → **These are your-hands-only income; do them on your own time. The autonomous
engine should not chase them.** (Receipt cashback = legitimate scan only; no fabricated receipts.)

---

## TIER 2 — $1–100, reusable digital assets (AUTONOMOUS-AFTER-KEY, strong fit)

**Etsy digital downloads** `[R][$]` — `ETSY_API_KEY`,`ETSY_SHARED_SECRET`. AI generates templates/printables + listings; **YOU** open shop + connect payments.
**Gumroad templates / Notion / Canva** `[R][$]` — `GUMROAD_ACCESS_TOKEN`. AI produces assets + product pages; Gumroad has a real publish API → **near-fully autonomous after key.**
**Amazon KDP low-content / coloring books** `[R][AI]` — AI generates interiors + covers (AI-disclosure required); **YOU** upload to KDP (no public publish API).
**PromptBase prompt sales** `[R][AI]` — AI authors + tests prompts; **YOU** list.
**Print-on-demand (Printful+Etsy / Printify)** `[R][$]` — `PRINTFUL_API_KEY`. AI generates designs + pushes products via API → **autonomous after key + shop connect.**
**Stock video/audio, presets, brush packs, sample packs, type beats** `[R]` — AI/Higgsfield/ElevenLabs generate; **YOU** upload to each marketplace (most have no contributor API).
**Fiverr gigs (voice-over/logo/resume), translation, proofreading, captioning** — **HUMAN-ONLY delivery** (client-facing); deprioritize for engine.
**Domain flipping, Mercari/Poshmark flipping** — HUMAN-ONLY.

---

## TIER 3 — $100–1k, platform & tooling (the recursive flagships)

**Faceless YouTube** `[R][AI]` + **Faceless TikTok/Reels** `[R][AI]` — the AI production flagship.
- **NEEDS → AI:** channel niche, brand voice, posting cadence. Keys: `YOUTUBE_API_KEY` / `TIKTOK_*`, plus `ELEVENLABS_API_KEY`, Higgsfield via MCP.
- **AI:** end-to-end script→video→voice→thumbnail→caption→schedule. **YOU:** create channels, final publish where no API.

**AllAccessKC node** `[R][K][$]` ⚑ — paid listings + lead-gen + KC newsletter. **DECISION NEEDED (see questions).**
- **NEEDS → AI:** is AllAccessKC live with traffic or just a registered domain? KC categories to seed.
- **AI:** builds directory pages, generates listings/events, lead-gen funnels. **YOU:** Stripe for listing payments (sign-off).

**Beehiiv newsletter** `[R][$]` — `BEEHIIV_API_KEY`,`BEEHIIV_PUB_ID`. AI drafts + schedules via API → **autonomous after key**; sponsor slots are the revenue.
**Skool/Whop community, Patreon, courses, cohort** `[$]` ⚑ — recurring billing → Stripe sign-off. AI produces content; **YOU** approve billing.
**Chrome extension / WP plugin / Shopify app / Discord bot / no-code micro-SaaS / API resale / white-label AI tool** `[R][$][AI]` — AI can build these; each needs Stripe (sign-off) + platform account. High recursive value, longer build.

---

## TIER 4 & 5 — inventory / acquisition (ALL ⚑ sign-off; capital + human)
FBA, dropshipping, DTC, ad-spend, vending/ATM, Airbnb arbitrage, site/newsletter/SaaS acquisition,
SBA-financed cash-flow businesses (laundromat/carwash/self-storage), franchises, RE syndication.
→ **Every one moves real capital or signs debt → human signature mandatory.** The engine *proposes
and models* these; it never executes. The investment lane (Tier 4) is live for **paper/proposal only**.

---

## The recommended activation order (free → income, fastest path)
1. **Stripe rail** (one-time, sign-off) — unlocks every `[$]` stream at once.
2. **Gumroad + Beehiiv + Printful** — these have real publish APIs → most autonomous.
3. **Amazon Associates + Impact/ShareASale/CJ/ClickBank** — affiliate layer over your content.
4. **Faceless YouTube + TikTok pipeline** — recursive content engine that also unlocks gated Tier-1.
5. **AllAccessKC node** — KC vertical; biggest single sub-node.

Ask the kernel anytime: `/capital-engine` → "Ask kernel: what to activate next" (budget-gated AI pass).
