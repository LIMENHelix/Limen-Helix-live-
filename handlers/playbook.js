/**
 * handlers/playbook.js - MASTER-gated operator playbook (Torti/Saraev GTM + skills map).
 *
 * The distilled business-layer reference. Content lives HERE (server-side) and is returned
 * ONLY to a valid master key, so /playbook cannot be curled by anyone else - the raw
 * corpora + full strategy stay in the repo (docs/research/, .vercelignore'd). This is the
 * operator-facing distillation, gated the same way the capital engine is.
 *
 * GET /api/playbook?key=<master> → { ok, html } | 403
 * Source of truth: docs/research/torti-tools-and-skills-map.md + dysregulation-intervention-library.md
 *   + domain-L1-money-map.md + saraev-net-new-vs-torti.md; catalogs CLAUDE_CODE_SKILLS.md,
 *   API_KEY_COMPANIES.md, SCRAPEABLE_SITES.md.
 */
const gate = require('../lib/admin-gate');

const HTML = `
<section>
  <h2>The reframe</h2>
  <div class="why"><b>Why use this.</b> Read first. It fixes the mental model: every business is a regulation instrument that slots into one of the 20 domains, so you always know WHERE a new offer belongs. <b class="ai">Autonomous AI:</b> Map any opportunity to a domain + failing regulation function before building anything.</div>
  <p>LIMEN = 20 domains, each a brain. Any business that regulates a domain's dysregulation ("nervous system") slots into the domain where that dysregulation lives. Torti's AI-agency playbook is a <b>catalog of regulation instruments</b>, not a competing model. His whole niche list is a subset of ~5 LIMEN domains (Medicine, Homestead/RE, Finance, Business/Ops, Technology); 15 domains have no provider yet. Saraev runs a different shape (agency + community + content + equity) and his one repeated line is the operative doctrine: "the moat is no longer the software, it is the distribution."</p>
  <div class="stack">
    <div class="lyr"><span class="t">Targeting = LIMEN</span><p>Telescope / kernel / P3 desks sense which domain+company is dysregulated. Torti's students cold-prospect to FIND pain; LIMEN senses it first. That head start is the edge nobody else has.</p></div>
    <div class="lyr"><span class="t">Go-to-market = Torti</span><p>Which function to sell, value-based pricing formulas, the named 4-step close, the paid-audit front door, the niche filter and the 7 businesses to avoid.</p></div>
    <div class="lyr"><span class="t">Fulfillment = skills</span><p>The stored skills catalog. anthropics/knowledge-work-plugins is ~1:1 with Torti's 20 offers; most builds are one <code>npx skills add</code>. Saraev's Skill-as-a-Service on Modal is the productization layer Torti lacks.</p></div>
  </div>
  <p class="note">Status: business layer PARKED until the 20 domains are built into brains. This page is the resume-from inventory. Master-gated; the raw corpora (~21MB of transcripts) stay repo-internal and .vercelignore'd. Sources distilled: 25 Torti videos (~239k words) + 13 Saraev videos (of 295) + the 355-skill catalog + the free-data and keyed-API maps.</p>
</section>

<section>
  <h2>Regulation function &rarr; Torti offer &rarr; skills</h2>
  <div class="why"><b>Why use this.</b> The routing table. Given a domain's failing function, it names the offer to sell and the exact skills that deliver it. Use it to scope what to build for a flagged domain. <b class="ai">Autonomous AI:</b> This is your diagnosis-to-toolchain lookup: failing function in, offer + skill list out.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Function</th><th>Offer</th><th>Stored skills</th></tr></thead>
    <tbody>
      <tr><td><b>Diagnostic / interoceptive readout</b><br><span class="dim">L1 wedge = LIMEN's edge</span></td><td>AI Audit, sales scoring</td><td>business-pulse, customer-pulse, monday-brief / friday-brief, quarterly-review, metrics-review, margin-analyzer, cash-flow-snapshot, variance-analysis, competitive-intelligence, market-research, deep-research, digest</td></tr>
      <tr><td><b>Afferent sensing / lead capture</b></td><td>Missed-call receptionist, inbound</td><td>lead-triage, enrich-lead, ticket-deflector, Zoom virtual-agent / phone / contact-center</td></tr>
      <tr><td><b>Salience + latency</b></td><td>Speed-to-lead</td><td>prospect, sequence-load, compose-outreach, draft-outreach, email-sequence, call-prep, weekly-prep-brief</td></tr>
      <tr><td><b>Memory / retrieval</b></td><td>Lead reactivation, internal GPTs</td><td>crm-cleanup, crm-maintenance, kb-article, knowledge-synthesis, memory-management</td></tr>
      <tr><td><b>Efferent / output</b></td><td>Content, UGC, newsletter, SEO</td><td>content-creation, draft-content, content-strategy, campaign-plan, seo-audit, brand-voice-enforcement, run-campaign, canva-creator, article-writing</td></tr>
      <tr><td><b>Homeostasis / allocation</b></td><td>Hiring system, training</td><td>recruiting-pipeline, comp-analysis, interview-prep, onboarding, job-post-builder, plan-payroll, capacity-plan</td></tr>
      <tr><td><b>Immune / guard</b></td><td>Risk / compliance, support, sales QA</td><td>compliance-check, legal-risk-assessment, review-contract, vendor-check, sox-testing, risk-assessment, ticket-triage, customer-escalation, handle-complaint, security-review</td></tr>
      <tr><td><b>ROI reporting</b><br><span class="dim">anti-churn, cross-cutting</span></td><td>Monthly impact report</td><td>build-dashboard, create-viz, data-visualization, performance-report, status-report</td></tr>
      <tr><td><b>Infra</b><br><span class="dim">build LIMEN faster/safer</span></td><td>Torti infra tactics</td><td>skill-development / skill-creator, agent-development, eval-harness, git-guardrails-claude-code, writing-hookify-rules, cost-aware-llm-pipeline, mcp-builder, strategic-compact, verification-loop, claude-md-improver, deploy</td></tr>
    </tbody>
  </table>
  </div>
  <p class="note">Install pattern: <code>npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'enrich-lead'</code>. Anthropic repos = high trust; community top-100 = vet before install (a skill can run commands in your environment). Already installed locally: skill-development, agent-development, writing-hookify-rules, mcp-builder, git-guardrails-claude-code, eval-harness.</p>
</section>

<section>
  <h2>Torti's full tool stack</h2>
  <div class="why"><b>Why use this.</b> The vetted tool inventory by layer. Reach here when a job needs a tool (automation, voice, scraping, CRM, media, deploy) and you want a known-good pick, not a search. <b class="ai">Autonomous AI:</b> Choose integrations from this list; obey the "avoid competing with" row (they ship AI free).</div>
  <p>Every named tool from the 25-video mine, grouped. Cap MCP servers at 2-3 then convert stable ones to skills to save tokens. Vertical SaaS at the bottom ships AI free; do not try to out-build them.</p>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Layer</th><th>Tools</th></tr></thead>
    <tbody>
      <tr><td><b>Automation backbone</b></td><td>n8n (self-host ~$5/mo), Make.com, Zapier</td></tr>
      <tr><td><b>Voice / conversational</b></td><td>Retell AI, Vapi, Voiceflow, Twilio (US numbers), Telnyx (EU numbers), WhatsApp Business API, Hermes Agent (Hostinger Docker)</td></tr>
      <tr><td><b>LLM / build</b></td><td>Claude Code (VS Code ext), Anthropic API, ChatGPT / OpenAI, Claude Design (claude.ai/design for landing pages, decks, prototypes; the "Design System" file = brand-level CLAUDE.md)</td></tr>
      <tr><td><b>Lead data / scraping</b></td><td>Apollo, Apify (Google Maps + Apollo scrapers), Clay, Hunter.io, Instantly (cold email), Sales Navigator, HeyReach, Prospect.ai</td></tr>
      <tr><td><b>CRM</b></td><td>GoHighLevel, HubSpot, Wealthbox, Airtable, Google Sheets</td></tr>
      <tr><td><b>Content / media</b></td><td>Sora, Veo, HeyGen, ElevenLabs, Nano Banana (Gemini image ~$0.09/img), Kling 3.0 (video), fal.ai, KIE/Key API, Opus Clip, Canva, Figma, Pixela (logo), 21st.dev (UI animation), Dribbble (refs), Excalidraw</td></tr>
      <tr><td><b>Email / newsletter</b></td><td>Klaviyo, ActiveCampaign, Mailchimp, Beehiiv, ConvertKit</td></tr>
      <tr><td><b>SEO</b></td><td>DataForSEO (cheap), Semrush</td></tr>
      <tr><td><b>Deploy</b></td><td>GitHub (middleman), Vercel, Modal, Railway, Render, Replit, Hostinger</td></tr>
      <tr><td><b>Ops / delivery</b></td><td>Notion, ClickUp, Confluence, Loom (outreach + SOPs), Cal.com / Calendly, Typeform, Stripe (no company needed to start), Gumroad (lead-magnet hosting), Buffer / Hootsuite, WhisperFlow (voice dictation)</td></tr>
      <tr><td><b>MCP servers</b><br><span class="dim">cap at 2-3, then convert to skills</span></td><td>Chrome DevTools, Firecrawl, Supabase (vector DB), Playwright, Xcode Build. Source: mcpservers.org; vet by GitHub stars</td></tr>
      <tr><td><b>Support</b></td><td>Intercom, Gorgias, Zendesk</td></tr>
      <tr><td><b>Sales QA</b></td><td>Fathom, Fireflies</td></tr>
      <tr><td><b>AVOID competing with</b><br><span class="dim">they ship AI free</span></td><td>Toast, Mindbody, Vagaro, Dentrix, ServiceTitan</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Torti's 20 offers with pricing</h2>
  <div class="why"><b>Why use this.</b> The productized-service menu with real price bands. Use it to quote a scoped engagement in seconds instead of guessing. <b class="ai">Autonomous AI:</b> Map a capability you just built to the closest offer to set a price and a retainer automatically.</div>
  <p>Filter: an offer must MAKE or SAVE money with a number attached. "One problem, one type of business, one way." Retainer heuristic = 20% of setup fee.</p>
  <div class="table-scroll">
  <table>
    <thead><tr><th>#</th><th>Offer</th><th>Pricing</th></tr></thead>
    <tbody>
      <tr><td colspan="3"><b>Sales (8)</b></td></tr>
      <tr><td>1</td><td>Inbound Receptionist (voice, 24/7)</td><td>$2-15k setup + 20% retainer</td></tr>
      <tr><td>2</td><td>Speed-to-Lead (&lt;5min callback; 100x conversion stat)</td><td>$3-10k + retainer</td></tr>
      <tr><td>3</td><td>Paid Ad Funnel</td><td>$5-15k + $1-3k/mo</td></tr>
      <tr><td>4</td><td>Lead Reactivation (dead CRM)</td><td>$3-15k OR per-appointment</td></tr>
      <tr><td>5</td><td>WhatsApp Agents</td><td>$2-5k + $500-1.5k/mo</td></tr>
      <tr><td>6</td><td>Email Marketing / Nurture</td><td>$2-5k + $500-2k/mo</td></tr>
      <tr><td>7</td><td>LinkedIn Outbound DFY</td><td>$3-7k + $1-3k/mo OR per-appointment</td></tr>
      <tr><td>8</td><td>AI Websites</td><td>free hook &rarr; $200-2k/mo retainer</td></tr>
      <tr><td colspan="3"><b>Marketing (5)</b></td></tr>
      <tr><td>9</td><td>UGC Creators (Sora)</td><td>$1.5-4k/mo OR $100-300/creative</td></tr>
      <tr><td>10</td><td>Content Systems (the prompts are the moat)</td><td>$1-5k + $500-2k/mo</td></tr>
      <tr><td>11</td><td>Newsletter-as-a-Service</td><td>$1-3k/mo</td></tr>
      <tr><td>12</td><td>SEO Content Engine</td><td>$2-5k + $1-3k/mo</td></tr>
      <tr><td>13</td><td>Content Repurposing</td><td>$2-4k + $1-2k/mo</td></tr>
      <tr><td colspan="3"><b>Operations (7)</b></td></tr>
      <tr><td>14</td><td>AI Audit (front door; $300 = commitment filter, discounted off project)</td><td>$1-3k OR free &rarr; upsell $10-20k</td></tr>
      <tr><td>15</td><td>Hiring Systems</td><td>$2-5k + $500-1k/mo</td></tr>
      <tr><td>16</td><td>Training Sessions (TCI: Training &rarr; Consulting &rarr; Implementation)</td><td>$1-10k</td></tr>
      <tr><td>17</td><td>AI Operating Systems on Claude Code ("EOS for AI": workflow=skill, task=agent, tool=MCP). NOT beginner</td><td>$5-15k + $1-3k/mo</td></tr>
      <tr><td>18</td><td>AI Sales Coaching (score calls vs framework)</td><td>$2-10k + $500-1.5k/mo</td></tr>
      <tr><td>19</td><td>Customer Support Agent (handles 70-80% tickets)</td><td>$3-10k + $500-2k/mo</td></tr>
      <tr><td>20</td><td>Internal GPTs</td><td>$2-5k/GPT or $5-15k suite + $400-1k/mo</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Pricing formulas + sales spine</h2>
  <div class="why"><b>Why use this.</b> How to price on value and run the close. Read it before any sales conversation so you anchor on outcome, not hours. <b class="ai">Autonomous AI:</b> Auto-compute a value-based quote from the formulas; the spine is the human close you hand off, never automate.</div>
  <ul>
    <li><b>Value-based pricing:</b> cost-saving = hours-saved/wk &times; rate &times; 52 &times; 20-25%; revenue-uplift = added annual revenue &times; 10%; retainer = 20% of setup. Cautionary tale: charged $500 for a system that made the client $8k.</li>
    <li><b>"Sell the outcome, don't say AI."</b> "We're not selling a voice agent." A confused buyer never buys.</li>
    <li><b>Niche 5-point filter:</b> LTV &gt;$3k &middot; obvious daily pain &middot; can reach the owner &middot; ROI &lt;30 days &middot; no heavy compliance.</li>
    <li><b>7 businesses to AVOID:</b> franchises (no tech control) &middot; no-digital-foundation &middot; free-tool-already-solves-it &middot; volume-too-low &middot; pre-revenue &middot; regulated / data-processor &middot; vertical-SaaS-already-shipping-AI.</li>
    <li><b>Sales spine:</b> send offer doc pre-call &rarr; let them state the problem &rarr; amplify pain + future-pace cost of inaction &rarr; ask permission to pitch &rarr; present a NAMED 4-step process (Audit &rarr; Implement &rarr; Automate &rarr; Optimize) &rarr; gate price behind value &rarr; anchor high, discount with scarcity &rarr; book next step + take payment ON the call. Paid audit ($300) = universal front door + qualifier ("won't pay $300 &rarr; won't pay $3k"). A 5-min triage call disqualifies before wasting 30. Never email a proposal without a call attached.</li>
    <li><b>Anti-churn:</b> build ROI reporting into delivery from day one. "Clients care about numbers, not your dashboard." Monthly one-number impact report.</li>
    <li><b>Infra tactics:</b> 3-layer CLAUDE.md (Directives / Orchestration / Execution + .env); .env-guard PreToolUse hook; PostToolUse audit-log hook; <code>/context</code> token discipline; convert stable MCP &rarr; skill; eval-gated skills.</li>
  </ul>
</section>

<section>
  <h2>Saraev net-new tactics (deeper than Torti)</h2>
  <div class="why"><b>Why use this.</b> The build-acceleration and client-acquisition tactics beyond Torti: how to BUILD faster and how to GET clients without an audience. <b class="ai">Autonomous AI:</b> Section A (auto-research loop, fan-out, fresh-context QA) is usable now to improve your own build loop.</div>
  <p>Only the material that is net-new or deeper than the Torti playbook. Section A is usable NOW on domains-first work (not parked).</p>
  <div class="stack">
    <div class="lyr"><span class="t">Auto-research loop</span><p>Karpathy autoresearch: autonomous hypothesis &rarr; change &rarr; assess &rarr; keep-if-better &rarr; log, run ~1,440x/day. Needs a METRIC, a CHANGE method, a fast ASSESSMENT (both &lt;30s). 30 good 1% changes/day = +34%/day. Proof: Shopify Liquid, 53% faster. LIMEN fit: wrap kernel PR-AUC/holdout as the assessment, bridge-pattern params as the change &rarr; tune the ranking function overnight. Human gate on the config commit.</p></div>
    <div class="lyr"><span class="t">Fan-out / fan-in</span><p>Orchestrator spawns N cheap Sonnet/Haiku sub-agents (fresh context, ~2k summary each = "50x cheaper"), Opus synthesizes. ~60% token saving by construction. This is how the deep-mine itself ran.</p></div>
    <div class="lyr"><span class="t">Fresh-context QA + security</span><p>New unbiased agent (or Codex/Gemini) audits + fixes so the builder never grades its own work. Security 80/20: grep sk_live / sk_test, check .gitignore covers .env*, flag npm typosquats, RLS-off. Run before every Vercel deploy. Note: API keys leak into ~/.claude/*.jsonl in plaintext.</p></div>
    <div class="lyr"><span class="t">Anti-monoculture failover</span><p>Keep CLAUDE.md, agents.md, gemini.md mirrored so the repo is drivable by Codex/Gemini if Anthropic is down. Codex MCP lets Claude delegate to GPT-5 when it degrades. Cheap insurance for a daily-operated system.</p></div>
    <div class="lyr"><span class="t">Token-as-P&amp;L</span><p><code>/context</code> forensics (~17k system-tool floor; MCP overhead is the #1 controllable drain). Skills load ~60 tokens of front-matter, body on demand. Standing move: install MCP, test, then CONVERT to skill.</p></div>
    <div class="lyr"><span class="t">Orchestration</span><p>Agent teams (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1, peer scratchpad, ~7x tokens, terminal only); git worktrees for collision-free parallel edits; stochastic consensus (N personas &rarr; mode = safe, outliers = valuable); debate/GAN agents; <code>/insights</code> across full history.</p></div>
  </div>
  <p style="margin-top:14px"><b>New sellable builds (add to catalog):</b></p>
  <ul>
    <li><b>AI Invoice &amp; Payment Recovery</b> ($5-10k/mo) - invoice-on-delivery &rarr; overdue detection &rarr; escalating follow-ups &rarr; QuickBooks/Xero. Deliverable = recovered money. [homeostasis]</li>
    <li><b>Proposal / Document Generation</b> ($1.5-10k; Saraev's $200k+ proven seller) - form/CRM &rarr; merged branded template (PandaDoc/Slides/PDF) &rarr; send. [efferent]</li>
    <li><b>Deep-Personalization Cold Outreach</b> (his highest-ROI) - scrape+research &rarr; fill template vars &rarr; Instantly/Smartlead. ~3% &rarr; ~15-20% reply. [afferent+salience]</li>
    <li><b>Content-Repurposing Engine</b> ($1-2k) - YouTube URL &rarr; Apify transcript &rarr; 10-point extraction &rarr; per-platform posts+images &rarr; content-calendar DB &rarr; daily drip. Decoupled generate-then-drip. [efferent+memory]</li>
    <li><b>AI Graphic Design Agent</b> ($1k+, "replaces $82k designer") - agent + subworkflow tools (logo, style-guide, upscaler, forced revision loop). White-label chat endpoint resold into client workspaces. [efferent+guard]</li>
    <li><b>Skill-as-a-Service on Modal</b> - wrap any skill behind a public URL / form &rarr; CSV / webhook in ~2 min. The productization layer Torti lacks.</li>
  </ul>
  <p style="margin-top:14px"><b>Two own-nothing acquisition channels LIMEN did not have:</b></p>
  <ul>
    <li><b>Marketplace demand-harvesting</b> (Upwork/Fiverr/Toptal/Malt) - capture EXISTING buying-ladder demand instead of manufacturing it; source of Saraev's $500K. Profile SEO (non-round rate $52.50, social proof in first ~100 chars, video), boosting, JSS + Top-Rated / Expert-Vetted ladder, fixed-price + subcontract. AI proposal-factory auto-writes proposal + CV + bespoke Mermaid diagram per job. CAVEAT: tactics DECAY as viewers flood them; Upwork cracking down on full automation.</li>
    <li><b>"Parasite" distribution</b> - scrape engagement-gated winners (likes &gt;100 = free demand validation) &rarr; AI research-twist (fuse 3 web sources) &rarr; re-voice in your tone &rarr; Sheet queue &rarr; auto-drip publish. This IS "sell curation not raw data" made mechanical. LIMEN fit: point the search term at any of the 20 domains &rarr; auto-build per-vertical authority &rarr; route to /api/lead; inject affiliate links in the twist step. RISK: platform ToS-adjacent; treat the pattern as durable, the actors/endpoints as disposable.</li>
  </ul>
  <p class="note">Business-model ceiling is NOT the agency: community/info-product ($100k+/mo, funneled from FREE long-form content) is bigger than Saraev's agency. Take equity/rev-share. Contrarian ops: custom-first as "training wheels" then productize; never throttle lead gen; a deliberate 72-hour delivery FLOOR (slower reads as more work); form-over-function; batched Mon/Wed/Fri client comms. "Local businesses are a TRAP" - small lead pool, low tech literacy, thin margins. He REFUSES to sell public vibe-coded apps (liability; "software isn't the moat").</p>
</section>

<section>
  <h2>Dysregulation &rarr; proven intervention library</h2>
  <div class="why"><b>Why use this.</b> The treatment protocol: each failure type maps to the proven tactic, the skills, and how autonomous it can safely be. Use it to pick the intervention for a diagnosed problem. <b class="ai">Autonomous AI:</b> This is the action-selection table. Read the Autonomy column to know what you may run alone vs what needs a human.</div>
  <p class="dim">Proof-gated: only tactics with real influencer validation. Autonomy = how much the engine runs without a human. The engine keys each dysregulation type to the validated tactic + the skill that renders it.</p>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Dysregulation</th><th>Proven directive</th><th>Skills</th><th>Autonomy</th></tr></thead>
    <tbody>
      <tr><td><b>1. Afferent-sensing failure</b><br><span class="dim">can't feel its inputs</span></td><td>Procedural scrape/capture pipeline (Saraev: 1,000 leads in 87s). NEVER put AI at first human contact - capture is back-end only.</td><td>enrich-lead, lead-triage, ticket-deflector, scrape-leads, Chrome DevTools MCP</td><td>FULL</td></tr>
      <tr><td><b>2. Salience + latency</b><br><span class="dim">responds too slow / can't prioritize</span></td><td>Speed-to-lead &lt;5min = 100x conversion (real closed deals $4.5k, $18k). The ranking function is the moat.</td><td>prospect, sequence-load, call-prep; kernel ranking; cost-aware-llm-pipeline for cheap-rank / expensive-act routing</td><td>Sense+rank+alert auto; the call/close is human</td></tr>
      <tr><td><b>3. Memory / retrieval</b><br><span class="dim">stored potential sits inert</span></td><td>Lead reactivation (Torti's favorite); follow-up-nurture clears the whole queue each morning. Solve the NEXT problem for the same client (raise LTV).</td><td>crm-cleanup, crm-maintenance, follow-up-nurture, knowledge-synthesis, memory-management</td><td>FULL (cron)</td></tr>
      <tr><td><b>4. Efferent output</b><br><span class="dim">can't express / act</span></td><td>Content-repurposing ($1-2k, decoupled generate&rarr;drip); proposal-generation ($200k proven); design agent (replaces $82k designer); parasite distribution. Form over function; TANGIBLE deliverable always.</td><td>content-creation, draft-content, content-strategy, canva-creator, parasite pipeline</td><td>HIGHEST</td></tr>
      <tr><td><b>5. Homeostasis / allocation</b><br><span class="dim">misallocates resources</span></td><td>Invoice/payment recovery (deliverable = recovered money, $5-10k/mo); hiring/screening; value-based pricing. Don't automate high-value touchpoints.</td><td>invoice-chase, recruiting-pipeline, comp-analysis, margin-analyzer, capacity-plan, plan-payroll</td><td>Invoice auto; hiring gated</td></tr>
      <tr><td><b>6. Immune / guard</b><br><span class="dim">threat / compliance / boundary</span></td><td>Monitor/alert desks; compliance AUDIT as report-not-code; support triage as procedural back-end only (Amazon refund-equation works 99.9999% because it's a deterministic threshold); "violation != guilt."</td><td>compliance-check, legal-risk-assessment, risk-assessment, ticket-triage, security-review; git-guardrails + .env-guard hook</td><td>Monitoring auto; legal line human</td></tr>
      <tr><td><b>7. Diagnostic-readout</b><br><span class="dim">blind to its own state</span></td><td>The paid AUDIT as front door (Torti's single highest-leverage tactic, live $9.5k close); pulse/ROI report as anti-churn; interoception readout = LIMEN's north star.</td><td>business-pulse, customer-pulse, build-dashboard, metrics-review, deep-research, digest</td><td>Generation auto; SELLING is human</td></tr>
    </tbody>
  </table>
  </div>
  <p class="note">The control loop: live-events feed &rarr; classify domain dysregulation &rarr; select proven intervention (this table) &rarr; Claude Code builds+runs the deployable portion &rarr; monitor feed &rarr; retire/mutate when the domain signal changes. Self-improves via the auto-research loop: metric = dysregulation-signal delta, change = intervention variant, assessment = the live feed.</p>
</section>

<section>
  <h2>The 20-domain L1 money map</h2>
  <div class="why"><b>Why use this.</b> The buildable queue. Per domain it gives the free feed, the L1 business, and who pays. Use it to pick the next domain to build and its exact source + buyer. <b class="ai">Autonomous AI:</b> Each row is a spec: the feed to ingest, the readout to render, the buyer to route it to.</div>
  <p>Each domain = a dysregulated nervous system; the business is the treatment; the no-capital (L1) instrument deploys first and funds the ladder. All 20 are the same machine: ingest free public feed &rarr; entity-resolve + rank/join (THE MOAT) &rarr; curated plain-language readout &rarr; auto-drip newsletter (affiliate-monetized) &rarr; paid scoped alert &rarr; licensed feed. Sell curation, never raw data. Own nothing.</p>
  <div class="table-scroll">
  <table>
    <thead><tr><th>#</th><th>Domain</th><th>Broken function</th><th>L1 no-capital render</th><th>Free source</th><th>Reachable buyer</th><th>L1 conf</th></tr></thead>
    <tbody>
      <tr><td>1</td><td><b>Technology</b></td><td>efferent + allocation</td><td>"Freed-talent + hiring-competitor" weekly</td><td>layoffs.fyi, WARN</td><td>tech recruiters / staffing</td><td>HIGH (desk LIVE)</td></tr>
      <tr><td>2</td><td><b>Medicine</b></td><td>immune/guard latency</td><td>Rising adverse-event/recall FEED, one drug/device class</td><td>openFDA</td><td>mass-tort firms, insurers</td><td>HIGH (desk LIVE)</td></tr>
      <tr><td>3</td><td><b>Finance</b></td><td>salience+latency (flood)</td><td>"Quiet Distress Watch" (EDGAR + kernel)</td><td>EDGAR</td><td>distressed-debt / claims-trading</td><td>HIGH build</td></tr>
      <tr><td>4</td><td><b>Industry</b></td><td>afferent latency + efferent</td><td>Clean national WARN board + alerts</td><td>state WARN feeds</td><td>staffing / outplacement</td><td>HIGH ROI</td></tr>
      <tr><td>5</td><td><b>Science</b></td><td>memory/retrieval + guard</td><td>1-area "trial+grant+retraction" weekly</td><td>ClinicalTrials, NIH RePORTER, Retraction Watch, arXiv/bioRxiv</td><td>pharma competitive-intel</td><td>HIGH</td></tr>
      <tr><td>6</td><td><b>Trade</b></td><td>salience+latency + guard</td><td>"True stacked effective tariff" lookup + 301/232 alert</td><td>USITC HTS, USTR, Federal Register, Comtrade</td><td>small importers, customs brokers, 3PLs</td><td>HIGH</td></tr>
      <tr><td>7</td><td><b>Defense</b></td><td>memory/retrieval (walled)</td><td>"Recompete Radar" per-NAICS (undercuts $6-119k GovWin)</td><td>USAspending, SAM.gov awards</td><td>small/new fed contractors</td><td>HIGH</td></tr>
      <tr><td>8</td><td><b>Agriculture</b></td><td>salience+latency (last-mile)</td><td>Per-county Crop Progress + Drought readout</td><td>USDA NASS, Drought Monitor, NDVI</td><td>row-crop farmers, co-ops, insurers</td><td>HIGH ($180-455/yr WTP)</td></tr>
      <tr><td>9</td><td><b>Law</b></td><td>memory/retrieval</td><td>Single-MDL/tort "new filings" radar</td><td>CourtListener/RECAP</td><td>mass-tort firms, litigation finance</td><td>HIGH</td></tr>
      <tr><td>10</td><td><b>Economy</b></td><td>salience+latency (flood)</td><td>Metro "Vital Signs" newsletter</td><td>FRED, BLS, BEA, WARN</td><td>SMB owners (affiliate), regional banks</td><td>validated data+affiliate</td></tr>
      <tr><td>11</td><td><b>Education</b></td><td>memory/retrieval</td><td>Per-major "worth it?" ROI pages (mass parasite surface)</td><td>College Scorecard, IPEDS</td><td>students / career-changers (affiliate)</td><td>validated</td></tr>
      <tr><td>12</td><td><b>Energy</b></td><td>efferent-output</td><td>Bill X-Ray action list (wedge EXISTS)</td><td>EIA, NREL</td><td>ratepayers (solar/efficiency affiliate)</td><td>validated</td></tr>
      <tr><td>13</td><td><b>Communication</b></td><td>immune/guard</td><td>Area-code "Robocall Threat Report"</td><td>FCC unwanted-calls, Robocall Mitigation DB</td><td>SMBs / consumers (affiliate)</td><td>MED-HIGH</td></tr>
      <tr><td>14</td><td><b>Infrastructure</b></td><td>immune/guard + readout</td><td>"Worsening Assets" watch (ECHO daily-diff)</td><td>EPA ECHO, PHMSA, NBI</td><td>enviro-consulting/remediation, insurers</td><td>inferred, high buildability</td></tr>
      <tr><td>15</td><td><b>Intelligence</b></td><td>salience+latency</td><td>"Debarment &amp; Sanctions Radar" digest</td><td>OFAC SDN/Consolidated, SAM exclusions, USAspending</td><td>corporate vendor-risk, AML, journalists</td><td>inferred high</td></tr>
      <tr><td>16</td><td><b>Population</b></td><td>homeostasis/allocation</td><td>"Where America Is Moving &amp; Building" county digest</td><td>Census ACS, CBP, Migration Flows</td><td>RE investors, site-selection</td><td>inferred med-high</td></tr>
      <tr><td>17</td><td><b>Governance</b></td><td>memory/retrieval + readout</td><td>"Follow-the-Award" brief + entity alerts</td><td>FEC, LDA lobbying, congress.gov, USAspending</td><td>compliance/FCPA teams, newsrooms</td><td>inferred</td></tr>
      <tr><td>18</td><td><b>Environment</b></td><td>immune/guard</td><td>"Pollution near me" ZIP alert</td><td>EPA ECHO (keyless)</td><td>L1 test-kit affiliate (WEAK); L2/L3 ESG, plaintiff firms</td><td>L1 weak, L2/L3 strong</td></tr>
      <tr><td>19</td><td><b>Culture</b></td><td>afferent latency + salience</td><td>"What's Accelerating This Week" niche momentum</td><td>Box Office Mojo/The Numbers, public charts</td><td>creators, small labels (affiliate)</td><td>MEDIUM</td></tr>
      <tr><td>20</td><td><b>Religion</b></td><td>afferent + readout</td><td>"Church Vitality Index" benchmark PDF</td><td>Gallup/Pew/Lifeway, ProPublica 990s, Census</td><td>pastors/admins (church-SaaS affiliate)</td><td>MODERATE (lowest fit)</td></tr>
    </tbody>
  </table>
  </div>
  <p class="note">Fattest-wallet convergence (sequence L1s that share a buyer): mass-tort plaintiff firms + litigation finance (pay PER SIGNED CASE) = Medicine + Law + Environment-L3, warmest across all 20. Distressed-debt / claims-trading = Finance + Industry + Infrastructure. Staffing = Technology + Industry. ESG / insurers = Environment-L2/L3 + Infrastructure. RE investors = Population + Agriculture + Economy. Bootstrap order: Technology (desk live) &rarr; Medicine + Law (same wallet) &rarr; Finance (tightest gate) &rarr; Industry &rarr; Trade/Science/Defense/Agriculture, then the rest.</p>
</section>

<section>
  <h2>Claude Code skills catalog</h2>
  <div class="why"><b>Why use this.</b> How to read and install the catalog below. Check the repo trust legend and the npx pattern before pulling any skill. <b class="ai">Autonomous AI:</b> Prefer Anthropic-official repos; a community skill can run commands, so vet before install.</div>
  <p>The comprehensive fulfillment inventory: 355 skills across 11+ repos. Prioritize Anthropic-official repos (high trust, Anthropic-vetted). Community repos = vet each entry before installing, since a skill can run commands in your environment. Repo legend: <b>KWP</b> = anthropics/knowledge-work-plugins &middot; <b>SK</b> = anthropics/skills &middot; <b>CC</b> = anthropics/claude-code &middot; <b>CPO</b> = anthropics/claude-plugins-official &middot; <b>ECC</b> = affaan-m/everything-claude-code (community) &middot; others named inline.</p>
  <p class="note">Install any skill: <code>npx skills add https://github.com/&lt;owner&gt;/&lt;repo&gt; --skill '&lt;name&gt;'</code>. Install a whole repo at once: <code>npx skills add https://github.com/anthropics/claude-code</code>. The 4 discovery lists (community-curated, vet before use): hesreallyhim/awesome-claude-code, ComposioHQ/awesome-claude-skills, travisvn/awesome-claude-skills, karanb192/awesome-claude-skills.</p>
</section>

<section>
  <h2>Catalog: build &amp; agent infrastructure</h2>
  <div class="why"><b>Why use this.</b> Grab these to build MORE skills, agents, plugins, MCP servers, and hooks. Use when extending LIMEN's own tooling. <b class="ai">Autonomous AI:</b> This is how you build new tools for yourself before building for a client.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>skill-development</td><td>Author skills: structure, description quality, progressive disclosure</td><td>CC</td></tr>
      <tr><td>skill-creator</td><td>Create/modify/measure skills; run evals; benchmark performance</td><td>SK / CPO</td></tr>
      <tr><td>agent-development</td><td>Create subagents: frontmatter, when-to-use, tools, examples</td><td>CC</td></tr>
      <tr><td>plugin-structure</td><td>Scaffold a plugin; plugin.json; component layout; auto-discovery</td><td>CC</td></tr>
      <tr><td>plugin-settings</td><td>Per-project plugin config via .local.md + YAML frontmatter</td><td>CC</td></tr>
      <tr><td>command-development</td><td>Create slash commands: args, frontmatter, file references</td><td>CPO</td></tr>
      <tr><td>hook-development</td><td>PreToolUse/PostToolUse/Stop hooks; event-driven automation; blocking</td><td>CPO</td></tr>
      <tr><td>writing-hookify-rules</td><td>Hookify rule syntax and patterns</td><td>CC / CPO</td></tr>
      <tr><td>mcp-integration</td><td>Add MCP server to a plugin; .mcp.json; connect external service</td><td>CPO</td></tr>
      <tr><td>mcp-builder</td><td>Build high-quality MCP servers (Python FastMCP or Node SDK)</td><td>SK</td></tr>
      <tr><td>build-mcp-server</td><td>Wrap an API for Claude; expose tools to Claude</td><td>CPO</td></tr>
      <tr><td>build-mcp-app</td><td>Interactive UI / widgets / forms in an MCP server</td><td>CPO</td></tr>
      <tr><td>build-mcpb</td><td>Package/bundle a local MCP server (.mcpb) for distribution</td><td>CPO</td></tr>
      <tr><td>claude-automation-recommender</td><td>Analyze a codebase, recommend hooks/subagents/skills/plugins/MCP</td><td>CPO</td></tr>
      <tr><td>claude-md-improver</td><td>Audit + improve CLAUDE.md files against templates</td><td>CPO</td></tr>
      <tr><td>claude-api</td><td>Claude API/SDK reference: models, pricing, streaming, tool use, caching</td><td>SK</td></tr>
      <tr><td>claude-opus-4-5-migration</td><td>Migrate prompts/code to Opus 4.5</td><td>CC</td></tr>
      <tr><td>agent-harness-construction</td><td>Design action spaces, tool defs, observation formats to raise completion</td><td>ECC</td></tr>
      <tr><td>claude-devfleet</td><td>Orchestrate multi-agent tasks in isolated worktrees; monitor; report</td><td>ECC</td></tr>
      <tr><td>cowork-plugin-customizer / create-cowork-plugin</td><td>Build/tailor a plugin for an org's tools in a cowork session</td><td>KWP</td></tr>
      <tr><td>session-report</td><td>Explorable HTML report of Claude Code session usage/tokens/cost</td><td>CPO</td></tr>
      <tr><td>project-artifact</td><td>Publish a tabbed project status artifact page</td><td>CPO</td></tr>
      <tr><td>codebase-onboarding</td><td>Analyze an unfamiliar codebase; arch map + starter CLAUDE.md</td><td>ECC</td></tr>
      <tr><td>code-tour</td><td>Create CodeTour .tour walkthroughs (onboarding, RCA, PR)</td><td>ECC</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: autonomy, orchestration &amp; cost</h2>
  <div class="why"><b>Why use this.</b> Patterns for running long autonomous loops cheaply and safely. Use when designing a self-running pipeline. <b class="ai">Autonomous AI:</b> eval-harness + cost-aware routing + loop patterns are your operating discipline; wire them in early.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>eval-harness</td><td>Formal eval framework for Claude Code (eval-driven development)</td><td>ECC</td></tr>
      <tr><td>verification-loop</td><td>Comprehensive verification system for sessions</td><td>ECC</td></tr>
      <tr><td>autonomous-loops</td><td>Architectures for autonomous loops: sequential to RFC-driven DAG</td><td>ECC</td></tr>
      <tr><td>continuous-agent-loop</td><td>Continuous autonomous loop with quality gates + recovery</td><td>ECC</td></tr>
      <tr><td>agentic-engineering</td><td>Eval-first execution, decomposition, cost-aware routing</td><td>ECC</td></tr>
      <tr><td>ai-first-engineering</td><td>Ops model for teams whose agents produce most implementation output</td><td>ECC</td></tr>
      <tr><td>cost-aware-llm-pipeline</td><td>Model routing by task complexity, budget tracking, caching</td><td>ECC</td></tr>
      <tr><td>strategic-compact</td><td>Manual context compaction at logical intervals</td><td>ECC</td></tr>
      <tr><td>iterative-retrieval</td><td>Progressive context-retrieval refinement for sub-agents</td><td>ECC</td></tr>
      <tr><td>continuous-learning-v2</td><td>Instinct-based learning from session hooks; project-scoped</td><td>ECC</td></tr>
      <tr><td>search-first</td><td>Research-before-coding: find existing tools/libs before writing custom</td><td>ECC</td></tr>
      <tr><td>regex-vs-llm-structured-text</td><td>Decision framework: regex vs LLM for parsing structured text</td><td>ECC</td></tr>
      <tr><td>content-hash-cache-pattern</td><td>Cache file processing by SHA-256 content hash; auto-invalidating</td><td>ECC</td></tr>
      <tr><td>math-olympiad</td><td>Competition math with adversarial fresh-context verification</td><td>CPO</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: testing &amp; verification</h2>
  <div class="why"><b>Why use this.</b> Install before shipping anything with logic. Use to add tests and a pre-deploy verification gate. <b class="ai">Autonomous AI:</b> Run these as the QA step before every deploy; do not ship un-verified.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>testing-strategy</td><td>Design test strategies and plans; coverage; test architecture</td><td>KWP</td></tr>
      <tr><td>tdd-workflow</td><td>Enforce TDD with 80%+ coverage (unit/integration/E2E)</td><td>ECC</td></tr>
      <tr><td>e2e-testing</td><td>Playwright E2E, Page Object Model, CI, flaky-test strategy</td><td>ECC</td></tr>
      <tr><td>webapp-testing</td><td>Interact with + test local web apps via Playwright; screenshots/logs</td><td>SK</td></tr>
      <tr><td>golang-testing / rust-testing / cpp-testing</td><td>Language-specific test patterns (table-driven, property, coverage)</td><td>ECC</td></tr>
      <tr><td>django-tdd / springboot-tdd / laravel-tdd</td><td>Framework TDD (pytest-django / JUnit+Testcontainers / Pest)</td><td>ECC</td></tr>
      <tr><td>django-verification / springboot-verification</td><td>Pre-release verification loop: build, lint, coverage, security, diff</td><td>ECC</td></tr>
      <tr><td>validate-data</td><td>QA an analysis before sharing: methodology, accuracy, bias</td><td>KWP</td></tr>
      <tr><td>swift-protocol-di-testing</td><td>Protocol-based DI for testable Swift; mock FS/network/APIs</td><td>ECC</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: security, guard &amp; compliance</h2>
  <div class="why"><b>Why use this.</b> Install before anything touches auth, secrets, payments, or user input. Use to review a build and gate risky actions. <b class="ai">Autonomous AI:</b> Mandatory pass before deploy; git-guardrails blocks destructive git; never skip on a money-touching build.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>security-review</td><td>Security checklist for auth, input, secrets, endpoints, payments (11k installs)</td><td>ECC</td></tr>
      <tr><td>security-scan</td><td>Scan .claude/ config for vulns, misconfig, injection risk (AgentShield)</td><td>ECC</td></tr>
      <tr><td>git-guardrails-claude-code</td><td>Hooks that block dangerous git (push, reset --hard, clean) (122k installs)</td><td>mattpocock/skills</td></tr>
      <tr><td>code-review</td><td>Review a PR/diff for security, performance, correctness</td><td>KWP</td></tr>
      <tr><td>code-reviewer</td><td>Bugs, SQLi/XSS, N+1, smells; structured prioritized report</td><td>jeffallan/claude-skills</td></tr>
      <tr><td>typescript-react-reviewer</td><td>TS + React 19 anti-patterns, useEffect abuse, state mgmt</td><td>dotneet/claude-code-marketplace</td></tr>
      <tr><td>django-security / springboot-security / laravel-security</td><td>Framework security: authn/z, CSRF, injection, secrets, rate-limit</td><td>ECC</td></tr>
      <tr><td>compliance-check</td><td>Surface applicable regs, required approvals, risk areas for an action</td><td>KWP</td></tr>
      <tr><td>compliance-tracking</td><td>Track SOC 2 / ISO 27001 / GDPR audit readiness</td><td>KWP</td></tr>
      <tr><td>legal-risk-assessment</td><td>Classify legal risk by severity x likelihood; escalation criteria</td><td>KWP</td></tr>
      <tr><td>review-contract</td><td>Review vs negotiation playbook; redlines; business-impact analysis</td><td>KWP</td></tr>
      <tr><td>triage-nda</td><td>Classify an incoming NDA GREEN/YELLOW/RED</td><td>KWP</td></tr>
      <tr><td>vendor-check</td><td>Vendor agreement status across CLM/CRM/email; gap + deadline analysis</td><td>KWP</td></tr>
      <tr><td>audit-support / sox-testing</td><td>SOX 404 control testing, sample selection, workpapers</td><td>KWP</td></tr>
      <tr><td>risk-assessment</td><td>Identify/assess/mitigate operational risk; risk register</td><td>KWP</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: language &amp; framework patterns</h2>
  <div class="why"><b>Why use this.</b> Idiomatic patterns per stack. Use when building in a specific language or framework so the code matches convention. <b class="ai">Autonomous AI:</b> Load the matching pattern skill for the target stack before writing code.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>coding-standards</td><td>Cross-project naming, readability, immutability conventions</td><td>ECC</td></tr>
      <tr><td>backend-patterns</td><td>API design, DB optimization, server-side for Node/Express/Next</td><td>ECC</td></tr>
      <tr><td>frontend-patterns</td><td>React/Next, state mgmt, performance, UI best practice</td><td>ECC</td></tr>
      <tr><td>golang-patterns</td><td>Idiomatic Go: functional options, DI, concurrency, errors</td><td>ECC</td></tr>
      <tr><td>python-patterns</td><td>Protocols, dataclasses, context managers, async, type hints</td><td>ECC</td></tr>
      <tr><td>rust-patterns</td><td>Ownership, error handling, traits, concurrency</td><td>ECC</td></tr>
      <tr><td>django-patterns / laravel-patterns / springboot-patterns</td><td>Framework arch: REST, ORM, caching, queues, events</td><td>ECC</td></tr>
      <tr><td>kotlin-patterns / kotlin-coroutines-flows</td><td>Idiomatic Kotlin; structured concurrency, Flow, StateFlow</td><td>ECC</td></tr>
      <tr><td>swiftui-patterns / swift-actor-persistence</td><td>SwiftUI arch (@Observable); actor-based thread-safe persistence</td><td>ECC</td></tr>
      <tr><td>cpp-coding-standards / java-coding-standards</td><td>Modern C++ Core Guidelines; Java Spring/Quarkus standards</td><td>ECC</td></tr>
      <tr><td>jpa-patterns</td><td>JPA/Hibernate entities, relationships, query optimization</td><td>ECC</td></tr>
      <tr><td>postgres-patterns / clickhouse-io</td><td>Query optimization, schema/index design; analytical workloads</td><td>ECC</td></tr>
      <tr><td>database-migrations</td><td>Schema/data migrations, rollbacks, zero-downtime (Prisma/Drizzle/etc)</td><td>ECC</td></tr>
      <tr><td>docker-patterns / deployment-patterns</td><td>Compose, container security; CI/CD, health checks, rollback</td><td>ECC</td></tr>
      <tr><td>android-clean-architecture / compose-multiplatform-patterns</td><td>Android/KMP clean arch; Compose Multiplatform</td><td>ECC</td></tr>
      <tr><td>tauri-v2</td><td>Tauri v2 cross-platform apps with Rust backend; IPC, capabilities</td><td>nodnarbnitram/claude-code-extensions</td></tr>
      <tr><td>foundation-models-on-device</td><td>On-device model implementation, quantization, private inference</td><td>ECC</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: engineering delivery</h2>
  <div class="why"><b>Why use this.</b> The non-code parts of shipping: ADRs, system design, debugging, deploy checklists, docs, incident response. <b class="ai">Autonomous AI:</b> Structure the work with these so a build is reproducible and documented, not a one-off.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>architecture</td><td>Create/evaluate an ADR with trade-offs and consequences</td><td>KWP</td></tr>
      <tr><td>system-design</td><td>Design systems/services/APIs; data modeling</td><td>KWP</td></tr>
      <tr><td>debug</td><td>Structured debug: reproduce, isolate, diagnose, fix</td><td>KWP</td></tr>
      <tr><td>deploy-checklist</td><td>Pre-deploy verification; migrations, flags, rollback triggers</td><td>KWP</td></tr>
      <tr><td>documentation / code-documenter</td><td>READMEs, runbooks, API docs, docstrings, OpenAPI/JSDoc</td><td>KWP / jeffallan</td></tr>
      <tr><td>incident-response</td><td>Triage, communicate, blameless postmortem</td><td>KWP</td></tr>
      <tr><td>standup</td><td>Generate a standup update from recent commits/PRs/tickets</td><td>KWP</td></tr>
      <tr><td>tech-debt</td><td>Identify, categorize, prioritize technical debt</td><td>KWP</td></tr>
      <tr><td>deploy / logs / setup</td><td>Deploy to Vercel; view logs; link/configure the project</td><td>vercel/vercel-deploy-claude-code-plugin</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: data, analytics &amp; visualization</h2>
  <div class="why"><b>Why use this.</b> Turn data into dashboards, charts, SQL, and stats. Use for any readout or reporting deliverable. <b class="ai">Autonomous AI:</b> The L1 wedge IS a curated readout; build it with these instead of hand-rolling charts.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>analyze</td><td>Answer data questions from quick lookup to full report</td><td>KWP</td></tr>
      <tr><td>build-dashboard</td><td>Interactive HTML dashboard: KPI cards, charts, filters, tables</td><td>KWP</td></tr>
      <tr><td>create-viz / data-visualization</td><td>Publication-quality Python charts (matplotlib/seaborn/plotly)</td><td>KWP</td></tr>
      <tr><td>explore-data</td><td>Profile a dataset: shape, quality, nulls, distributions</td><td>KWP</td></tr>
      <tr><td>sql-queries / write-query</td><td>Correct, performant SQL across warehouse dialects</td><td>KWP</td></tr>
      <tr><td>statistical-analysis</td><td>Descriptive stats, trend, outlier detection, hypothesis testing</td><td>KWP</td></tr>
      <tr><td>data-context-extractor</td><td>Bootstrap a company-specific analysis skill from analyst tribal knowledge</td><td>KWP</td></tr>
      <tr><td>tushare-finance</td><td>Chinese market data via 220+ Tushare Pro endpoints</td><td>stanleychanh/tushare-finance</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: sales, lead &amp; CRM</h2>
  <div class="why"><b>Why use this.</b> The prospect, enrich, outreach, and CRM stack as installable skills. Use to build a lead or outreach engine. <b class="ai">Autonomous AI:</b> These are the afferent-sensing and salience offers; keep them back-end, never AI at first contact.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo (plugin)</th></tr></thead>
    <tbody>
      <tr><td>prospect</td><td>Full ICP-to-leads pipeline; ranked enriched decision-makers</td><td>KWP (apollo / common-room)</td></tr>
      <tr><td>enrich-lead</td><td>Instant lead enrichment from name/company/URL/email</td><td>KWP (apollo)</td></tr>
      <tr><td>sequence-load</td><td>Bulk-add matched leads to an Apollo outreach sequence</td><td>KWP (apollo)</td></tr>
      <tr><td>account-research</td><td>Company/person sales intel; standalone or CRM-supercharged</td><td>KWP (sales / common-room)</td></tr>
      <tr><td>call-prep</td><td>Call context, attendee research, suggested agenda</td><td>KWP (sales / common-room)</td></tr>
      <tr><td>call-summary</td><td>Extract action items, draft follow-up, internal summary from a transcript</td><td>KWP (sales)</td></tr>
      <tr><td>compose-outreach / draft-outreach</td><td>Personalized outreach from signals/web research</td><td>KWP (common-room / sales)</td></tr>
      <tr><td>competitive-intelligence</td><td>Interactive battlecard HTML artifact + comparison matrix</td><td>KWP (sales)</td></tr>
      <tr><td>create-an-asset</td><td>Tailored sales asset (landing page/deck/one-pager) from deal context</td><td>KWP (sales)</td></tr>
      <tr><td>daily-briefing</td><td>Prioritized morning sales briefing</td><td>KWP (sales)</td></tr>
      <tr><td>forecast</td><td>Weighted forecast: best/likely/worst, commit vs upside, gap analysis</td><td>KWP (sales)</td></tr>
      <tr><td>pipeline-review</td><td>Pipeline health: prioritize deals, flag risks, weekly plan</td><td>KWP (sales)</td></tr>
      <tr><td>weekly-prep-brief</td><td>One briefing for all external calls in the next 7 days</td><td>KWP (common-room)</td></tr>
      <tr><td>lead-triage / call-list</td><td>Score inbound leads; "call these 5 today" + talking points</td><td>KWP (small-business)</td></tr>
      <tr><td>crm-cleanup / crm-maintenance</td><td>Fix stale/duplicate records; keep HubSpot current without opening it</td><td>KWP (small-business)</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: marketing, content &amp; brand</h2>
  <div class="why"><b>Why use this.</b> Content systems, campaigns, SEO, and brand voice. Use for the efferent-output offers. <b class="ai">Autonomous AI:</b> The content-repurposing and parasite-distribution pipelines run on these; always emit a tangible piece.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo (plugin)</th></tr></thead>
    <tbody>
      <tr><td>content-creation / draft-content</td><td>Multi-channel marketing content; channel formatting; SEO</td><td>KWP (marketing)</td></tr>
      <tr><td>campaign-plan</td><td>Full campaign brief: objectives, audience, calendar, metrics</td><td>KWP (marketing)</td></tr>
      <tr><td>email-sequence</td><td>Multi-email sequences: copy, timing, branching, exit conditions</td><td>KWP (marketing)</td></tr>
      <tr><td>seo-audit</td><td>Keyword research, on-page, content gaps, technical, competitor</td><td>KWP (marketing)</td></tr>
      <tr><td>brand-review</td><td>Review content vs brand voice; flag deviations with before/after</td><td>KWP (marketing)</td></tr>
      <tr><td>competitive-brief</td><td>Competitor positioning/messaging comparison; content gaps</td><td>KWP (marketing / pm)</td></tr>
      <tr><td>performance-report</td><td>Marketing performance report with prioritized optimizations</td><td>KWP (marketing)</td></tr>
      <tr><td>brand-voice-enforcement</td><td>Apply brand guidelines to any drafted content</td><td>KWP (brand-voice)</td></tr>
      <tr><td>discover-brand / guideline-generation</td><td>Find brand materials across platforms; generate a style guide</td><td>KWP (brand-voice)</td></tr>
      <tr><td>content-strategy</td><td>30-day content brief from sales data + seasonality</td><td>KWP (small-business)</td></tr>
      <tr><td>canva-creator / run-campaign / sales-brief</td><td>Execute a campaign end-to-end; Canva designs; HubSpot send</td><td>KWP (small-business)</td></tr>
      <tr><td>article-writing</td><td>Long-form articles/guides in a distinctive supplied voice</td><td>ECC</td></tr>
      <tr><td>prompt-optimizer</td><td>Optimize prompts</td><td>ECC</td></tr>
      <tr><td>video-editing / ffmpeg</td><td>AI video editing pipeline (FFmpeg, Remotion, ElevenLabs); media transforms</td><td>ECC / digitalsamba</td></tr>
      <tr><td>story-* (write/analyze/scan/cover/deslop)</td><td>Long/short web-fiction toolkit: outline to draft, de-AI, cover-gen</td><td>worldwonderer/oh-story-claudecode</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: customer support (procedural back-end only)</h2>
  <div class="why"><b>Why use this.</b> Triage, draft, and KB skills for support offers. Use them, but read the anti-catalog note first. <b class="ai">Autonomous AI:</b> Procedural back-end or human-in-the-loop drafts only; AI at the front line drops conversion ~30 to ~20 percent.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo (plugin)</th></tr></thead>
    <tbody>
      <tr><td>ticket-triage</td><td>Categorize + P1-P4 priority + route + dedupe a support ticket</td><td>KWP (customer-support)</td></tr>
      <tr><td>draft-response</td><td>Professional customer reply tailored to situation and relationship</td><td>KWP (customer-support)</td></tr>
      <tr><td>customer-escalation</td><td>Package an escalation for eng/product/leadership with full context</td><td>KWP (customer-support)</td></tr>
      <tr><td>customer-research</td><td>Multi-source lookup on a customer question with attribution</td><td>KWP (customer-support)</td></tr>
      <tr><td>kb-article</td><td>Draft a KB article from a resolved issue or repeated question</td><td>KWP (customer-support)</td></tr>
      <tr><td>ticket-deflector</td><td>Read a ticket, pull order/refund + account, draft tone-matched reply</td><td>KWP (small-business)</td></tr>
      <tr><td>handle-complaint</td><td>End-to-end complaint: pull context, draft response, suggest fix</td><td>KWP (small-business)</td></tr>
      <tr><td>customer-pulse / customer-pulse-check</td><td>Aggregate disputes/tickets/reviews into a themes report + top-3 fixes</td><td>KWP (small-business)</td></tr>
    </tbody>
  </table>
  </div>
  <p class="note">Anti-catalog reminder: never AI the front line. These render as procedural back-ends or human-in-the-loop drafts, never an autonomous responder. AI at first human contact drops setter conversion ~30% &rarr; ~20%.</p>
</section>

<section>
  <h2>Catalog: finance, accounting &amp; SMB ops</h2>
  <div class="why"><b>Why use this.</b> Close, reconcile, cash-flow, invoice, and pulse skills. Use for the diagnostic-readout and homeostasis offers. <b class="ai">Autonomous AI:</b> business-pulse and invoice-chase are high-value, mostly-autonomous builds; the deliverable is recovered money or a clear number.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo (plugin)</th></tr></thead>
    <tbody>
      <tr><td>financial-statements</td><td>P&amp;L / balance sheet / cash flow with period-over-period + variance</td><td>KWP (finance)</td></tr>
      <tr><td>variance-analysis</td><td>Decompose variances into drivers; waterfall; narrative</td><td>KWP (finance)</td></tr>
      <tr><td>reconciliation</td><td>GL vs subledger/bank/third-party; categorize reconciling items</td><td>KWP (finance)</td></tr>
      <tr><td>journal-entry / journal-entry-prep</td><td>Accruals, depreciation, revenue recognition with debits/credits</td><td>KWP (finance)</td></tr>
      <tr><td>close-management</td><td>Month-end close: task sequencing, dependencies, status</td><td>KWP (finance)</td></tr>
      <tr><td>business-pulse</td><td>One-page cross-functional SMB snapshot (cash/sales/pipeline/watch)</td><td>KWP (small-business)</td></tr>
      <tr><td>cash-flow-snapshot / month-heads-up</td><td>30/60/90-day cash forecast with variance bands + risk flags</td><td>KWP (small-business)</td></tr>
      <tr><td>margin-analyzer / price-check</td><td>Unit economics by product; pricing-scenario views</td><td>KWP (small-business)</td></tr>
      <tr><td>invoice-chase</td><td>Overdue-invoice reminders matched to payment history + tone</td><td>KWP (small-business)</td></tr>
      <tr><td>plan-payroll</td><td>Forecast cash, rank overdue invoices, stage reminders for payroll</td><td>KWP (small-business)</td></tr>
      <tr><td>month-end-prep / close-month</td><td>Reconcile QB vs processors; flag gaps; P&amp;L narrative; close packet</td><td>KWP (small-business)</td></tr>
      <tr><td>quarterly-review</td><td>Full QBR narrative as a presentation-ready PDF/deck</td><td>KWP (small-business)</td></tr>
      <tr><td>monday-brief / friday-brief / sales-brief</td><td>One-page weekly pulse: cash, sales, pipeline, top to-dos</td><td>KWP (small-business)</td></tr>
      <tr><td>tax-season-organizer / tax-prep</td><td>Quarterly-estimate or 1099 prep as an accountant handoff (not advice)</td><td>KWP (small-business)</td></tr>
      <tr><td>smb-onboard / smb-router</td><td>Front door + trainer for the small-business plugin</td><td>KWP (small-business)</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: HR, hiring &amp; legal</h2>
  <div class="why"><b>Why use this.</b> Recruiting, comp, onboarding, and contract/NDA triage. Use for the homeostasis and immune offers. <b class="ai">Autonomous AI:</b> Legal outputs are drafts for a human to sign, never advice; hiring decisions stay human-gated.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo (plugin)</th></tr></thead>
    <tbody>
      <tr><td>recruiting-pipeline</td><td>Track sourcing/screening/interviewing/offer stages</td><td>KWP (hr)</td></tr>
      <tr><td>interview-prep</td><td>Competency-based interview plans + scorecards</td><td>KWP (hr)</td></tr>
      <tr><td>comp-analysis</td><td>Benchmarking, band placement, equity modeling</td><td>KWP (hr)</td></tr>
      <tr><td>draft-offer</td><td>Offer letter + total-comp package + negotiation guidance</td><td>KWP (hr)</td></tr>
      <tr><td>onboarding</td><td>New-hire checklist + Day 1 / Week 1 / 30-60-90 plan</td><td>KWP (hr)</td></tr>
      <tr><td>org-planning / people-report</td><td>Headcount plan, org design; attrition/diversity/span reports</td><td>KWP (hr)</td></tr>
      <tr><td>performance-review</td><td>Self-assessment + manager template + calibration prep</td><td>KWP (hr)</td></tr>
      <tr><td>policy-lookup</td><td>Explain company policies (PTO, remote, expenses) in plain language</td><td>KWP (hr)</td></tr>
      <tr><td>job-post-builder</td><td>Job post + interview guide + offer template from a brief</td><td>KWP (small-business)</td></tr>
      <tr><td>brief</td><td>Contextual legal briefings: daily scan, topic research, incident</td><td>KWP (legal)</td></tr>
      <tr><td>legal-response</td><td>Templated reply to common legal inquiries + escalation checks</td><td>KWP (legal)</td></tr>
      <tr><td>meeting-briefing / signature-request</td><td>Legal meeting prep; route a doc for e-signature with checklist</td><td>KWP (legal)</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: research, product &amp; operations</h2>
  <div class="why"><b>Why use this.</b> Deep research, market research, roadmaps, and SOPs. Use for intel deliverables and for running the business itself. <b class="ai">Autonomous AI:</b> deep-research and market-research feed the diagnostic readouts that are LIMEN's edge.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo (plugin)</th></tr></thead>
    <tbody>
      <tr><td>deep-research</td><td>Multi-source deep research; cited report with attribution</td><td>ECC</td></tr>
      <tr><td>market-research</td><td>Market sizing, competitor comparison, due diligence with sources</td><td>ECC</td></tr>
      <tr><td>investor-materials / investor-outreach</td><td>Pitch decks, memos, models; cold/warm investor emails</td><td>ECC</td></tr>
      <tr><td>digest</td><td>Daily/weekly cross-source activity digest</td><td>KWP (enterprise-search)</td></tr>
      <tr><td>knowledge-synthesis / search / search-strategy</td><td>Search across connected sources; dedupe + confidence-score answers</td><td>KWP (enterprise-search)</td></tr>
      <tr><td>metrics-review</td><td>Product metrics with trend analysis and actionable insight</td><td>KWP (product-management)</td></tr>
      <tr><td>product-brainstorming / roadmap-update</td><td>Explore problem spaces; update/reprioritize roadmap</td><td>KWP (product-management)</td></tr>
      <tr><td>sprint-planning / write-spec</td><td>Scope a sprint against capacity; write a PRD from a problem statement</td><td>KWP (product-management)</td></tr>
      <tr><td>stakeholder-update / synthesize-research</td><td>Audience-tailored status; distill interviews/surveys into insights</td><td>KWP (product-management)</td></tr>
      <tr><td>capacity-plan</td><td>Workload analysis + utilization forecast; hire-or-deprioritize</td><td>KWP (operations)</td></tr>
      <tr><td>process-doc / process-optimization</td><td>Flowcharts/RACI/SOPs; find and fix bottlenecks</td><td>KWP (operations)</td></tr>
      <tr><td>runbook / change-request</td><td>Repeatable ops runbook; change record with impact + rollback</td><td>KWP (operations)</td></tr>
      <tr><td>status-report / vendor-review</td><td>KPI/risk status; vendor TCO + risk + recommendation</td><td>KWP (operations)</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: documents, design &amp; productivity</h2>
  <div class="why"><b>Why use this.</b> docx/pptx/xlsx/pdf, design, artifacts, and memory. Use to produce the tangible deliverable every engagement must ship. <b class="ai">Autonomous AI:</b> Render the dossier or readout as a real file here; form-over-function, the artifact is the product.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo</th></tr></thead>
    <tbody>
      <tr><td>docx / pptx / xlsx / pdf</td><td>Create/read/edit Word, PowerPoint, Excel/CSV, PDF files</td><td>SK</td></tr>
      <tr><td>view-pdf</td><td>Interactive PDF viewer: annotate, highlight, fill, sign</td><td>KWP (pdf-viewer)</td></tr>
      <tr><td>nutrient-document-processing</td><td>DWS API: convert, OCR, extract, redact, sign, fill forms</td><td>ECC</td></tr>
      <tr><td>frontend-design</td><td>Distinctive, intentional visual design; typography; non-templated</td><td>SK / CPO</td></tr>
      <tr><td>canvas-design / algorithmic-art</td><td>PNG/PDF visual art; generative p5.js art</td><td>SK</td></tr>
      <tr><td>brand-guidelines / theme-factory</td><td>Apply brand colors/type; 10 preset themes to any artifact</td><td>SK</td></tr>
      <tr><td>web-artifacts-builder / playground</td><td>Complex React/Tailwind/shadcn artifacts; single-file explorers</td><td>SK / CPO</td></tr>
      <tr><td>slack-gif-creator</td><td>Slack-optimized animated GIFs with constraints + validation</td><td>SK</td></tr>
      <tr><td>liquid-glass-design</td><td>Liquid-glass visual design system</td><td>ECC</td></tr>
      <tr><td>accessibility-review</td><td>WCAG 2.1 AA audit: contrast, keyboard, touch target, screen reader</td><td>KWP (design)</td></tr>
      <tr><td>design-critique / design-system / design-handoff</td><td>Structured feedback; audit/extend a design system; dev handoff spec</td><td>KWP (design)</td></tr>
      <tr><td>ux-copy / user-research / research-synthesis</td><td>Microcopy; plan+run+synthesize user research into themes</td><td>KWP (design)</td></tr>
      <tr><td>memory-management</td><td>Two-tier memory; decode shorthand/acronyms/nicknames</td><td>KWP (productivity)</td></tr>
      <tr><td>task-management / update / start</td><td>Shared TASKS.md; sync tasks + refresh memory from activity</td><td>KWP (productivity)</td></tr>
      <tr><td>internal-comms / doc-coauthoring</td><td>Company-format internal comms; structured doc co-authoring workflow</td><td>SK</td></tr>
      <tr><td>slack-messaging / slack-search</td><td>Well-formatted mrkdwn Slack messages; effective Slack search</td><td>KWP (slack)</td></tr>
    </tbody>
  </table>
  </div>
</section>

<section>
  <h2>Catalog: channels, integrations &amp; domain-specialized</h2>
  <div class="why"><b>Why use this.</b> Zoom/Slack/Discord channels plus bio and hardware niches. Use when a build needs a specific channel or vertical. <b class="ai">Autonomous AI:</b> Pull the specific integration skill on demand rather than loading everything.</div>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Skill</th><th>Purpose</th><th>Repo (plugin)</th></tr></thead>
    <tbody>
      <tr><td>start / choose-zoom-approach / plan-zoom-integration</td><td>Route a Zoom idea to the right surface (REST/SDK/MCP) + build plan</td><td>KWP (zoom-plugin)</td></tr>
      <tr><td>build-zoom-meeting-app / build-zoom-bot / build-zoom-phone-integration</td><td>Meeting embeds; meeting/recording bots; Phone CTI/dialer automation</td><td>KWP (zoom-plugin)</td></tr>
      <tr><td>build-zoom-contact-center-app / build-zoom-virtual-agent</td><td>Contact-center + virtual-agent (afferent-sensing offers, procedural)</td><td>KWP (zoom-plugin)</td></tr>
      <tr><td>zoom video/meeting SDK (web/ios/android/electron/rn/linux)</td><td>Per-platform Zoom SDK integration references</td><td>KWP (zoom-plugin)</td></tr>
      <tr><td>zoom-mcp / setup-zoom-mcp / scribe / rtms</td><td>Zoom MCP connectors; transcription; real-time media streams</td><td>KWP (zoom-plugin)</td></tr>
      <tr><td>discord/telegram/imessage: access + configure</td><td>Set up + manage channel access, allowlists, DM policy</td><td>CPO</td></tr>
      <tr><td>browser-cdp</td><td>Drive Chrome via CDP to reuse login sessions; extract tokens</td><td>oh-story-claudecode</td></tr>
      <tr><td>nextflow-development / scvi-tools / single-cell-rna-qc</td><td>Bioinformatics pipelines, single-cell deep learning + QC</td><td>KWP (bio-research)</td></tr>
      <tr><td>instrument-data-to-allotrope / scientific-problem-selection</td><td>Standardize lab instrument output to ASM; research ideation</td><td>KWP (bio-research)</td></tr>
      <tr><td>m5-onboard / cardputer-buddy</td><td>Flash + iterate on M5Stack ESP32 MicroPython apps</td><td>CPO</td></tr>
      <tr><td>claude-code-plugin-release</td><td>Version + publish a Claude Code plugin release</td><td>thedotmack/claude-mem</td></tr>
    </tbody>
  </table>
  </div>
  <p class="note">Highest-install community skills for context (vet before installing): git-guardrails-claude-code 122k, agent-development 16k, skill-development 15k, security-review 11k, plugin-structure/plugin-settings/writing-hookify-rules 10k each, golang-patterns 9.9k, coding-standards 8.7k, backend/frontend-patterns 8.6k, the story-* web-fiction suite ~8k each.</p>
</section>

<section>
  <h2>Free data sources (green = build on it)</h2>
  <div class="why"><b>Why use this.</b> The green/yellow feed list. Use it to source a domain's L1 feed legally. <b class="ai">Autonomous AI:</b> Ingest only from here: green = build on it, yellow = signal and attribute, never circumvent a login/paywall.</div>
  <p>Green = open data or an official public API/bulk download; pull freely, respect limits. Yellow = public but ToS-restricted; use the official API, signal-only, always attribute. Anything needing login/CAPTCHA/paywall circumvention is out of scope. The moat is the ranking function over public data, never the raw feed.</p>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Category</th><th>Sources (green unless noted)</th></tr></thead>
    <tbody>
      <tr><td><b>Filings / corporate</b></td><td>SEC EDGAR (data.sec.gov, efts full-text, bulk zip; &le;10 req/s, UA email); Frankfurter/ECB FX; Yahoo Finance (yellow, unofficial, signal only)</td></tr>
      <tr><td><b>US gov open data</b></td><td>USAspending, Data.gov, openFDA, ClinicalTrials v2, CourtListener/RECAP, Federal Register, GovInfo, FCC/FEC/FTC, NOAA/NWS, USGS; State WARN (yellow, HTML)</td></tr>
      <tr><td><b>Economic / labor / demo</b></td><td>FRED, BLS, Census, World Bank, OECD/Eurostat/IMF, BEA</td></tr>
      <tr><td><b>Science / medical lit</b></td><td>PubMed E-utilities, Europe PMC, OpenAlex (250M works), Semantic Scholar, Crossref, MedlinePlus/CDC/ICD-11, arXiv/bioRxiv</td></tr>
      <tr><td><b>Entity / people</b></td><td>OpenCorporates (200M+, attribution), GLEIF (LEI), Wikidata/Wikipedia (CC0); county cadastral/assessor (yellow)</td></tr>
      <tr><td><b>Web-scale / corpora</b></td><td>Claude WebSearch/WebFetch, Common Crawl, Wikimedia dumps, GDELT, Hacker News (Firebase), GitHub REST/GraphQL</td></tr>
      <tr><td><b>Distress trackers</b></td><td>layoffs.fyi (yellow, attribute), WARN aggregators (yellow, cross-check state DOL)</td></tr>
    </tbody>
  </table>
  </div>
  <p class="note">NOT free scrape targets (use the paid/official API or skip): Amazon storefront (PA-API), YouTube/Google Search/Maps (Data/Places APIs), LinkedIn (litigates scraping, no green path), X/Reddit/TikTok/Instagram/Facebook (paid APIs only), Zillow/Redfin/MLS (use licensed BatchData), Glassdoor/Crunchbase/PitchBook/Bloomberg (paywalled).</p>
</section>

<section>
  <h2>Keyed APIs (payout + data)</h2>
  <div class="why"><b>Why use this.</b> Payout and data APIs by env var. Use to wire revenue (affiliate/payments) or resellable data. <b class="ai">Autonomous AI:</b> Check the env var is present before calling; reselling raw feed is prohibited, so sell curation on top.</div>
  <p>Two kinds: payout APIs that pay you (gated behind an approved account + real activity) and data APIs you resell as curation (own-nothing middleman). Reselling raw feed is usually prohibited; selling curation/analysis on top is the defensible line. Legend below: check = already referenced in this repo.</p>
  <div class="table-scroll">
  <table>
    <thead><tr><th>Group</th><th>APIs (env var)</th></tr></thead>
    <tbody>
      <tr><td><b>Direct payout (affiliate/POD)</b></td><td>Amazon PA-API (gated, access revoked without sales ~180d), CJ Affiliate, ClickBank, Printful, eBay/EPN, Impact/Awin/Rakuten/ShareASale/Walmart, Etsy, Gumroad</td></tr>
      <tr><td><b>Payments</b></td><td>Stripe (the money rail, live on AllAccessKC), PayPal/Braintree</td></tr>
      <tr><td><b>LLM (cost centers)</b></td><td>Anthropic (auto-spend KILLED, re-enable deliberately), OpenAI, xAI/Grok</td></tr>
      <tr><td><b>Market data</b></td><td>Alpha Vantage (25/day), Finnhub (60/min), FRED (unlimited), Alpaca (trade-capable), Polygon, FMP (250/day, valuation multiples), Tiingo/Twelve Data</td></tr>
      <tr><td><b>News / search / enrich</b></td><td>Tavily (1k/mo), NewsAPI, Event Registry, Google Places (paid), Last.fm</td></tr>
      <tr><td><b>Deal-engine (RE/mail)</b></td><td>BatchData, Skip-trace, Lob (direct mail), Resend, Beehiiv, Web3Forms</td></tr>
      <tr><td><b>Gov/scientific (free key)</b></td><td>EIA, Census, USDA, NOAA, AirNow, Congress.gov, Regulations.gov, PubMed (10 req/s), UN Population, ACLED, BLS</td></tr>
    </tbody>
  </table>
  </div>
  <p class="note">Recurring-affiliate side-rail earns before any subscriber converts: newsletter platforms pay recurring (Kit/ConvertKit ~30%, ActiveCampaign ~30%, beehiiv up to 60% first-year). YouTube Data API is a research/monetization-SIGNAL source, not a payout API (no public AdSense payout API). Fastest revenue-relevant adds not yet wired: Impact/Awin/ShareASale (one integration, many merchants), YouTube Data (Culture front), FMP (feed valuation-longs).</p>
</section>

<section>
  <h2>Meta-directives + irreducible residue</h2>
  <div class="why"><b>Why use this.</b> The rules that govern the whole engine plus the two cells that stay human. Use as guardrails on everything above. <b class="ai">Autonomous AI:</b> NON-NEGOTIABLE limits: the anti-catalog (what never to spawn) and the residue (the first sale + the trust boundary) are hard walls.</div>
  <ul>
    <li><b>Reliability:</b> template 90% yourself, let AI fill 10%. Deterministic rails; businesses pay for predictability, not flexibility.</li>
    <li><b>Build quality:</b> fan-out Sonnet-research / Opus-synthesis; fresh-context (or different-model) QA + security agent BEFORE any deploy; anti-monoculture failover (agents.md / gemini.md mirror).</li>
    <li><b>Self-improvement:</b> the auto-research loop (Karpathy) wrapped around the whole regulator. This IS "see the patterns" made mechanical. Priors in the intervention library get reweighted by real dysregulation signal once the domains produce it.</li>
    <li><b>Anti-catalog (never spawn):</b> AI at first human contact (receptionist/setter/closer/front-line support destroy conversion); full-autonomy email responders; basic FAQ chatbots; AI SEO content (window closed 2022); giant all-in-one agents (1-5% failure != 1% revenue loss). Every spawn must emit a TANGIBLE deliverable and improve a pipeline that ALREADY makes money.</li>
    <li><b>Do NOT copy from Torti:</b> becoming a voice-agent agency as LIMEN itself (own-something, retainer-delivery); the n8n self-host lock-in; the mentorship-funnel-as-a-business (only the funnel structure transfers). Do NOT copy from Saraev: selling public vibe-coded apps (liability); chasing local businesses (a trap).</li>
  </ul>
  <p><b>The irreducible residue</b> (autonomy concentrates it, does not remove it). The loop autonomously does sense &rarr; classify &rarr; select &rarr; build &rarr; run &rarr; monitor. Two cells stay human/licensed and just get concentrated:</p>
  <div class="stack">
    <div class="lyr"><span class="t">The first sale</span><p>The FIRST human sale per new buyer relationship. Generation of the audit/readout is auto; SELLING it is the human conversation.</p></div>
    <div class="lyr"><span class="t">The trust boundary</span><p>The regulated-advice line: no investment/legal/clinical advice; OSINT-only; aggregate-only; strict neutrality. "Violation != guilt." A false going-concern or sanction-match flag is reputational/defamation death, so high-severity fires need a human/licensed sign.</p></div>
    <div class="lyr"><span class="t">Per-domain legal gates</span><p>Defense = unclassified award-finance only. Intelligence = OSINT, no surveillance-of-individuals. Law = not legal advice (UPL wall). Medicine = FAERS correlation-not-causation caveat. Finance = professional counterparties only, audit gate non-optional. Population = never re-identify. Governance = non-partisan. Environment/Infra = descriptive with source links.</p></div>
  </div>
  <p class="note">Full sources (repo-internal, not web-served): docs/research/torti-tools-and-skills-map.md, dysregulation-intervention-library.md, domain-L1-money-map.md, saraev-net-new-vs-torti.md; catalogs CLAUDE_CODE_SKILLS.md (355 skills), API_KEY_COMPANIES.md, SCRAPEABLE_SITES.md. Raw transcript corpora (~21MB) are local-only. Business layer is PARKED until the 20 domains are built into brains; when unparked, the NEXT action is the 20-domain x 7-function matrix, each live cell = (a) the LIMEN feed that senses it, (b) the Torti pricing/pitch, (c) the exact npx skills add command.</p>
</section>
`;

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const pass = gate.reqKey(req);
  if (!gate.isMaster(pass)) return gate.deny(res);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, html: HTML }));
};
