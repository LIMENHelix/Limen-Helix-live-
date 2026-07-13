/**
 * handlers/playbook.js — MASTER-gated operator playbook (Torti/Saraev GTM + skills map).
 *
 * The distilled business-layer reference. Content lives HERE (server-side) and is returned
 * ONLY to a valid master key, so /playbook cannot be curled by anyone else — the raw
 * corpora + full strategy stay in the repo (docs/research/, .vercelignore'd). This is the
 * operator-facing distillation, gated the same way the capital engine is.
 *
 * GET /api/playbook?key=<master> → { ok, html } | 403
 * Source of truth: docs/research/torti-tools-and-skills-map.md + dysregulation-intervention-library.md
 */
const gate = require('../lib/admin-gate');

const HTML = `
<section>
  <h2>The reframe</h2>
  <p>LIMEN = 20 domains, each a brain. Any business that regulates a domain's dysregulation ("nervous system") slots into the domain where that dysregulation lives. Torti's AI-agency playbook is a <b>catalog of regulation instruments</b>, not a competing model. His whole niche list is a subset of ~5 LIMEN domains (Medicine, Homestead/RE, Finance, Business/Ops, Technology); 15 domains have no provider yet.</p>
  <div class="stack">
    <div class="lyr"><span class="t">Targeting</span><p>LIMEN telescope / kernel / P3 desks sense which domain+company is dysregulated. Torti's students cold-prospect to FIND pain; LIMEN senses it first = the edge.</p></div>
    <div class="lyr"><span class="t">Go-to-market</span><p>Torti playbook: which function to sell, value-based pricing, how to close.</p></div>
    <div class="lyr"><span class="t">Fulfillment</span><p>The stored skills catalog (anthropics/knowledge-work-plugins ~= 1:1 with his 20 offers). Most builds are one <code>npx skills add</code>.</p></div>
  </div>
</section>

<section>
  <h2>Regulation function &rarr; Torti offer &rarr; skills</h2>
  <table>
    <thead><tr><th>Function</th><th>Offer</th><th>Skills</th></tr></thead>
    <tbody>
      <tr><td><b>Diagnostic readout</b><br><span class="dim">L1 wedge = LIMEN's edge</span></td><td>AI Audit, sales scoring</td><td>businesspulse, customerpulse, dailybriefing, metricsreview, marginanalyzer, competitiveintelligence, market-research, deep-research, digest</td></tr>
      <tr><td><b>Afferent sensing</b></td><td>Missed-call receptionist, inbound</td><td>leadtriage, enrichlead, ticketdeflector</td></tr>
      <tr><td><b>Salience + latency</b></td><td>Speed-to-lead</td><td>prospect, sequenceload, composeoutreach, emailsequence, callprep</td></tr>
      <tr><td><b>Memory / retrieval</b></td><td>Lead reactivation, internal GPTs</td><td>crmcleanup, crmmaintenance, knowledgesynthesis, memorymanagement</td></tr>
      <tr><td><b>Efferent / output</b></td><td>Content, UGC, newsletter, SEO</td><td>contentcreation, draftcontent, contentstrategy, campaignplan, seoaudit, article-writing</td></tr>
      <tr><td><b>Homeostasis</b></td><td>Hiring system, training</td><td>recruitingpipeline, companalysis, interviewprep, onboarding, planpayroll, capacityplan</td></tr>
      <tr><td><b>Immune / guard</b></td><td>Risk/compliance, support, sales QA</td><td>compliancecheck, legalriskassessment, reviewcontract, riskassessment, tickettriage, security-review</td></tr>
      <tr><td><b>ROI reporting</b><br><span class="dim">anti-churn, cross-cutting</span></td><td>Monthly impact report</td><td>builddashboard, createviz, datavisualization, performancereport, statusreport</td></tr>
      <tr><td><b>Infra</b><br><span class="dim">build LIMEN faster/safer</span></td><td>Torti infra tactics</td><td>skill-development, agent-development, eval-harness, git-guardrails, writing-hookify-rules, mcp-builder, cost-aware-llm-pipeline, verification-loop</td></tr>
    </tbody>
  </table>
  <p class="note">Install pattern: <code>npx skills add https://github.com/anthropics/knowledge-work-plugins --skill '&lt;name&gt;'</code>. Anthropic repos = high trust; community top-100 = vet before install (skills can run commands). Already installed locally: skill-development, agent-development, writing-hookify-rules, mcp-builder, git-guardrails-claude-code, eval-harness.</p>
</section>

<section>
  <h2>Pricing + sales mechanics</h2>
  <ul>
    <li><b>Value-based pricing:</b> cost-saving = hours-saved/wk &times; rate &times; 52 &times; 20-25%; revenue-uplift = added annual revenue &times; 10%; retainer = 20% of setup.</li>
    <li><b>"Sell the outcome, don't say AI."</b> A confused buyer never buys.</li>
    <li><b>Niche 5-point filter:</b> LTV &gt;$3k &middot; obvious daily pain &middot; reach the owner &middot; ROI &lt;30 days &middot; no heavy compliance.</li>
    <li><b>7 to avoid:</b> franchises, no-digital-foundation, free-tool-already-solves-it, volume-too-low, pre-revenue, regulated/data-processor, vertical-SaaS-already-shipping-AI.</li>
    <li><b>Sales spine:</b> send offer doc pre-call &rarr; let them state the problem &rarr; amplify pain + cost of inaction &rarr; ask permission to pitch &rarr; present a NAMED 4-step process (Audit&rarr;Implement&rarr;Automate&rarr;Optimize) &rarr; gate price behind value &rarr; anchor high, discount with scarcity &rarr; book next step + take payment on the call. Paid audit ($300) = universal front door + commitment filter.</li>
    <li><b>Anti-churn:</b> build ROI reporting into delivery from day one. Monthly one-number impact report.</li>
  </ul>
</section>

<section>
  <h2>Dysregulation &rarr; proven intervention library</h2>
  <p class="dim">Proof-gated: only tactics with real influencer validation. Autonomy = how much the engine can run without a human.</p>
  <table>
    <thead><tr><th>Dysregulation</th><th>Proven directive</th><th>Autonomy</th></tr></thead>
    <tbody>
      <tr><td><b>Afferent-sensing failure</b></td><td>Procedural scrape/capture pipeline (Saraev: 1,000 leads in 87s). Never put AI at first human contact.</td><td>FULL</td></tr>
      <tr><td><b>Salience + latency</b></td><td>Speed-to-lead &lt;5min = 100x conversion. The ranking function is the moat.</td><td>Sense+rank auto; the call/close is human</td></tr>
      <tr><td><b>Memory / retrieval</b></td><td>Lead reactivation; follow-up-nurture clears the queue every morning. Solve the NEXT problem for the same client (raise LTV).</td><td>FULL (cron)</td></tr>
      <tr><td><b>Efferent output</b></td><td>Content-repurposing ($1-2k), proposal-generation ($200k proven), design agent, parasite distribution (scrape&rarr;twist&rarr;re-voice&rarr;auto-drip).</td><td>HIGHEST</td></tr>
      <tr><td><b>Homeostasis</b></td><td>Invoice/payment recovery (deliverable = recovered money), hiring/screening, value-based pricing.</td><td>Invoice auto; hiring gated</td></tr>
      <tr><td><b>Immune / guard</b></td><td>Monitor/alert desks; compliance AUDIT as a report-not-code; support triage as procedural back-end only; "violation != guilt."</td><td>Monitoring auto; legal line human</td></tr>
      <tr><td><b>Diagnostic readout</b></td><td>The paid AUDIT as front door (Torti's highest-leverage tactic); pulse/ROI report as anti-churn; interoception readout = LIMEN's north star.</td><td>Generation auto; SELLING is human</td></tr>
    </tbody>
  </table>
</section>

<section>
  <h2>Meta-directives + irreducible residue</h2>
  <ul>
    <li><b>Reliability:</b> template 90% yourself, let AI fill 10%. Businesses pay for predictability, not flexibility.</li>
    <li><b>Build quality:</b> fan-out Sonnet-research / Opus-synthesis; fresh-context QA + security agent before any deploy; anti-monoculture failover.</li>
    <li><b>Anti-catalog (never spawn):</b> AI at first human contact, full-autonomy email responders, basic FAQ chatbots, giant all-in-one agents. Every spawn must emit a tangible deliverable and improve a pipeline that ALREADY makes money.</li>
    <li><b>Irreducible residue (stays human/licensed):</b> (1) the FIRST human sale per new buyer relationship; (2) the regulated-advice / trust boundary (no investment/legal/clinical advice; OSINT-only; aggregate-only; neutrality).</li>
  </ul>
  <p class="note">Full sources (repo-internal, not web-served): <code>docs/research/torti-tools-and-skills-map.md</code>, <code>dysregulation-intervention-library.md</code>, <code>domain-L1-money-map.md</code>, <code>saraev-net-new-vs-torti.md</code>; catalogs <code>CLAUDE_CODE_SKILLS.md</code>, <code>API_KEY_COMPANIES.md</code>, <code>SCRAPEABLE_SITES.md</code>. Raw transcript corpora (~21MB) are local-only. Business layer is PARKED until the 20 domains are built into brains.</p>
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
