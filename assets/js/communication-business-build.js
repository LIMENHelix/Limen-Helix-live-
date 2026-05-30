/**
 * education-business-build.js — BUSINESS BUILD Execution Workspace (Education)
 *
 * Communication-native business launch system. Stages with communication-native templates
 * (B2B SaaS, cybersecurity vendor, AI infrastructure, devtools / open source,
 * technology consultancy). 90-day execution plan, printable launch packet.
 *
 * Education domain only.
 * Exposes: window.LIMENCommunicationBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isCommunication = _dom === 'communication';
  var isWorkspace = window.location.pathname.indexOf('communication-workspace') !== -1;
  if (!isCommunication && !isWorkspace) return;

  var STORE_KEY = 'limen_communication_business_build';
  var MODE_KEY = 'limen_cbb_mode';

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }
  function getWs(key) { return loadAll()[key] || null; }
  function saveWs(key, ws) { var a = loadAll(); a[key] = ws; saveAll(a); }
  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function getMode() { try { return localStorage.getItem(MODE_KEY) || 'operator'; } catch (e) { return 'operator'; } }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) {} }

  var OPERATOR_SECTIONS = ['concept', 'market', 'biz_type', 'entity', 'tax_id', 'compliance', 'banking', 'delivery', 'customers', 'first90', 'readiness'];
  var AUDITOR_ONLY = ['revenue', 'governance', 'startup_costs', 'sources', 'loan_prep', 'team', 'infrastructure', 'legal_docs', 'financial_docs'];

  var TEMPLATES = {
    'nonprofit_newsroom': {
      label: 'Nonprofit Newsroom (501(c)(3))',
      description: 'A community-funded, nonprofit news organization producing local or specialty journalism. Funded by foundations, individual donors, and reader memberships. Examples: ProPublica, The Texas Tribune, Chalkbeat, The 19th, Block Club Chicago.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$100K-$1M',
      legalNotes: 'Incorporate as a state nonprofit corporation. File IRS Form 1023 for 501(c)(3) status (long form, $600 fee, 3-12 month review). Editorial independence policy and conflict-of-interest policy mandatory. State charity registration in every state where you fundraise. Annual Form 990 filing.',
      fundingNotes: 'Knight Foundation, MacArthur, Lenfest, Solutions Journalism Network, Democracy Fund, American Journalism Project, INN seed grants. Reader memberships ($5-$25/month). Major donor program. Foundation grants typically $50K-$500K per cycle.',
      operatingNotes: 'Editorial independence is non-negotiable for funders. Annual transparency report. Public-service journalism focus. Must serve a clearly defined community. Partner with INN (Institute for Nonprofit News) for back-office support.',
      first90: [
        'DAYS 1-7: Incorporate as a state nonprofit corporation in your home state. Adopt bylaws and elect a founding board (5-7 members). OUTPUT: Legal entity established with governing board.',
        'DAYS 1-7: Apply for EIN. Open a business bank account at a community bank or credit union. Set up nonprofit accounting (QuickBooks Nonprofit, Sage). OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Begin IRS Form 1023 application for 501(c)(3) status. Engage nonprofit counsel ($2K-$5K) to review. OUTPUT: 1023 in progress.',
        'DAYS 8-14: Adopt editorial independence policy, conflict-of-interest policy, and ethics code. Publish them on the website. OUTPUT: Governance documents public.',
        'DAYS 15-30: Apply to INN (Institute for Nonprofit News) for membership and seed funding. Apply to NewsMatch for matching donor funds. OUTPUT: Foundation network engaged.',
        'DAYS 15-30: Build website on Newspack (free for nonprofit news), Ghost, or WordPress with subscription plugin. Set up newsletter (Beehiiv, Substack, Mailchimp). OUTPUT: Publishing infrastructure live.',
        'DAYS 31-60: Recruit founding editor and 1-2 reporters. Define beat coverage (geographic or topical). Publish first stories. OUTPUT: First original journalism published.',
        'DAYS 31-60: Launch reader membership program ($5-$25/month). Run NewsMatch year-end fundraising campaign. OUTPUT: First 100 paying members.',
        'DAYS 61-90: Submit first foundation grant proposal (Knight, Lenfest, or local community foundation). Host a launch event for community stakeholders. OUTPUT: First foundation pitch in process, community visibility established.'
      ]
    },
    'creator_subscription': {
      label: 'Independent Newsletter / Podcast / Creator Business',
      description: 'A solo or small-team creator-led media business funded by subscriptions, memberships, and sponsorships. Direct relationship with the audience, owned distribution. Examples: Substack publications, independent podcasts, niche YouTube channels, paid Discord communities.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$5K-$50K',
      legalNotes: 'LLC or S-Corp typical. State business registration. Sales tax registration in your home state. Publisher liability insurance (defamation/libel) recommended ($1M-$2M Media Perils policy).',
      fundingNotes: 'Self-funded; first clients come from your existing audience or network. Stripe / Substack / Patreon handles payment infrastructure. Sponsorships add revenue once you have meaningful audience scale (10K+ subscribers).',
      operatingNotes: 'Audience growth is everything in months 1-12. Show up consistently, write or record well, build trust. Convert free to paid at 5-15%. Average creator subscription: $50-$150/year. Reach 1,000 paying subscribers and you have a real business.',
      first90: [
        'DAYS 1-5: File LLC with Secretary of State. Apply for EIN. Open a business bank account (Mercury, Relay, or local credit union). OUTPUT: Legal entity and banking.',
        'DAYS 1-5: Choose a creator platform (Substack, Beehiiv, Ghost for newsletters; Spotify for Podcasters, Megaphone for podcasts). OUTPUT: Publishing platform selected.',
        'DAYS 6-15: Purchase Media Perils / publisher liability insurance ($1M-$2M coverage, ~$500-$2K/year). OUTPUT: Insurance active.',
        'DAYS 6-15: Define your beat / niche. Pick a name. Buy a domain. Set up email and social handles. OUTPUT: Brand identity ready.',
        'DAYS 16-25: Publish first 3-5 issues / episodes. Set free tier (always-free archive) and paid tier ($5-$15/month, $50-$150/year). OUTPUT: Catalog launched.',
        'DAYS 16-25: Activate your existing network. Email everyone you know. Cross-post on social. Pitch to relevant aggregators (Substack network, Podchaser, Spotify discovery). OUTPUT: First subscriber wave.',
        'DAYS 26-40: Build a subscriber acquisition habit \u2014 publish on a strict cadence (weekly newsletter, weekly podcast). Track open rates and engagement. OUTPUT: Cadence established.',
        'DAYS 41-60: Convert free to paid. Run a founding-member promotion ($120/year for first 100 subscribers). OUTPUT: First 50-100 paying subscribers.',
        'DAYS 61-90: Pitch your first sponsor or advertising partner. Apply for relevant creator grants (Substack Pro, Spotify Sound Up, Google News Initiative). OUTPUT: First sponsor pitch and grant application.'
      ]
    },
    'comms_consultancy': {
      label: 'Communications / PR Consultancy',
      description: 'A boutique communications consultancy providing strategy, messaging, crisis response, executive comms, and media relations to organizations. Examples: independent PR firms, executive ghostwriters, crisis management consultancies.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$10K-$50K',
      legalNotes: 'LLC or S-Corp typical. Professional liability (E&O) insurance recommended ($1M-$2M). Client agreements with confidentiality, payment, and termination terms. State business registration.',
      fundingNotes: 'Self-funded. First clients come from prior networks (former newsroom colleagues, former in-house comms peers, executive contacts). Retainer-based revenue model.',
      operatingNotes: 'Billable hours, monthly retainers, or project fees. Senior comms talent commands $250-$500/hr or $5K-$25K/month retainer. Reputation, network, and a track record of placed stories or managed crises are everything.',
      first90: [
        'DAYS 1-5: File LLC or S-Corp with Secretary of State. Apply for EIN. Open a business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Build a simple website (one page, who you are, services, contact). Set up business email. OUTPUT: Professional presence.',
        'DAYS 6-15: Purchase professional liability insurance ($1M-$2M E&O, ~$1K-$3K/year). OUTPUT: Insurance active.',
        'DAYS 6-15: Define service catalog: strategic comms, media relations, executive ghostwriting, crisis response, op-ed placement, internal comms. Set rates. OUTPUT: Service menu finalized.',
        'DAYS 16-25: Build template documents: MSA, SOW, NDA, monthly retainer agreement, project proposal, kickoff doc. OUTPUT: Templates ready.',
        'DAYS 16-25: Outreach to 30 prospects in your network. Offer free 30-min consultation. Get 10 conversations booked. OUTPUT: 10 prospect calls scheduled.',
        'DAYS 26-40: Convert consultations into paid engagements. Send proposals within 48 hours of every call. Sign MSAs. OUTPUT: 2-3 first paying clients.',
        'DAYS 41-60: Deliver first engagements. Bill on NET 30. Document case studies (with client permission). Request testimonials and referrals. OUTPUT: First engagements delivered, referral pipeline active.',
        'DAYS 61-90: Convert one-off engagements into ongoing monthly retainers. Build inbound visibility (LinkedIn writing, podcast appearances, panel speaking). OUTPUT: First retainer signed.'
      ]
    },
    'trust_safety_vendor': {
      label: 'Trust and Safety / Content Moderation Vendor',
      description: 'A B2B vendor selling content moderation, fact-checking, misinformation detection, or trust-and-safety tooling to platforms, brands, or media companies. Examples: ActiveFence, Hive, NewsGuard, Logically, Cinder.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$250K-$5M',
      legalNotes: 'Delaware C-Corp standard. SOC 2 Type II expected. GDPR and CCPA compliance for any service handling user content. Section 230 implications for any product that touches platform moderation. Mental health support program required for any moderator-facing role.',
      fundingNotes: 'Trust-and-safety-focused VCs (Notable Capital, Lightspeed, BoxGroup), platform corporate ventures (Meta, Google, Microsoft), DARPA and NSF for AI authenticity research.',
      operatingNotes: 'Long enterprise sales cycles (6-12 months). Reference customers from major platforms or major brands are critical. Mental health and content trauma protocols for any human moderator workflow. Continuous model retraining as new abuse patterns emerge.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares with vesting. File 83(b). Engage counsel familiar with platform liability and Section 230. OUTPUT: Entity and counsel retained.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Set up accounting. OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Build MVP. Define detection categories (misinformation, hate speech, CSAM, fraud, bot activity, etc.) and label initial training data. OUTPUT: MVP with baseline detection accuracy.',
        'DAYS 8-14: Draft moderator wellness policy and trauma support program (required by platform partners). OUTPUT: Wellness program documented.',
        'DAYS 15-30: Begin SOC 2 Type I readiness (Vanta, Drata). Required for platform contracts. OUTPUT: SOC 2 program live.',
        'DAYS 15-30: Approach 3-5 design partner platforms (mid-size social, marketplaces, gaming, dating apps) for free pilots. OUTPUT: Pilots in progress.',
        'DAYS 31-60: Iterate detection model on real platform data. Publish accuracy metrics (precision, recall, F1) per category. OUTPUT: Documented model performance.',
        'DAYS 31-60: Apply for relevant federal grants (DARPA SemaFor, NSF Convergence Accelerator, DHS S&T). OUTPUT: Federal grant pipeline active.',
        'DAYS 61-90: Convert first design partner into paid contract. Sign MSA, DPA, and content liability terms. OUTPUT: First paying platform customer.'
      ]
    },
    'local_news_coop': {
      label: 'Local News Cooperative / Reader-Owned Media',
      description: 'A reader-owned cooperative news organization producing local journalism. Members pay to join, vote on coverage priorities, and elect the board. Examples: Devil Strip (Akron), West Seattle Blog co-op model, Mountain View Voice.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$50K-$300K',
      legalNotes: 'Form as a cooperative (consumer or worker co-op) under your state\u2019s cooperative statute. Some states require both a co-op filing and an LLC or nonprofit underlying entity. Member subscription terms double as ownership shares. Co-op-specific accounting and annual member meeting requirements.',
      fundingNotes: 'Member-owner subscriptions ($60-$200/year). Local foundation grants. Cooperative development funds (CooperationWorks, Shared Capital). Program-related investments from values-aligned funders.',
      operatingNotes: 'Member-owners are your community, your sales force, and your governance board all at once. Annual member meeting. Transparent budget. Beat coverage driven by member input. Co-op identity is a real differentiator in markets dominated by chains.',
      first90: [
        'DAYS 1-15: Engage co-op counsel to choose entity structure (cooperative LLC, consumer co-op, worker co-op). File articles of incorporation in your state. OUTPUT: Co-op entity filed.',
        'DAYS 1-15: Adopt cooperative bylaws including member rights, board structure, and patronage dividend rules. OUTPUT: Bylaws adopted.',
        'DAYS 16-30: Apply for EIN. Open a business bank account at a community bank or credit union (Shared Capital, LEAF, or similar co-op-friendly lender). OUTPUT: Banking active.',
        'DAYS 16-30: Define membership terms ($60-$200/year), voting rights, and patronage dividend formula. OUTPUT: Membership offering documented.',
        'DAYS 31-45: Run a founding member campaign. Goal: 200-500 founding members at $60-$200 each. Use social, local events, and partner orgs to recruit. OUTPUT: 200+ founding members.',
        'DAYS 31-45: Set up website, newsletter, and CMS (Newspack, Ghost, WordPress). OUTPUT: Publishing infrastructure live.',
        'DAYS 46-60: Recruit founding board (5-7 members elected by founding members). Hire founding editor (full or part time). OUTPUT: Board and editor in place.',
        'DAYS 46-60: Publish first stories. Hold first member town hall to set coverage priorities. OUTPUT: Editorial operation live, member voice activated.',
        'DAYS 61-90: Apply for local foundation funding (community foundation, Knight Local) and cooperative development grants. OUTPUT: Foundation pipeline active.'
      ]
    },
    'creator_studio': {
      label: 'Multi-Show Creator Studio / Production House',
      description: 'A small production company that produces multiple newsletters, podcasts, or video shows under one umbrella. Examples: Defector Media, The Ringer (early), Ramble Podcasting, Pushkin Industries, Marfa Public Radio model.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$100K-$1M',
      legalNotes: 'LLC or C-Corp depending on funding plans. Founder agreements among the creator-owners. Show-by-show profit sharing or pooled compensation. Media Perils insurance ($2M-$5M).',
      fundingNotes: 'Founder capital from creator-owners. Member subscriptions and ad revenue across shows. Some studios raise from media-focused VCs (Lerer Hippeau, Lightspeed, GV). Sponsorships and brand partnerships.',
      operatingNotes: 'Cross-promotion across shows is the secret weapon. Shared back-office (accounting, sales, editing, hosting) lets each creator focus on craft. Member pricing typically $7-$15/month for the bundle.',
      first90: [
        'DAYS 1-7: Form LLC or C-Corp. Sign founder agreement among creator-owners (equity, decision rights, exit terms). OUTPUT: Entity and founder agreements signed.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Set up accounting (QuickBooks, Pilot, Bench). OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Define the studio\u2019s show portfolio (3-5 shows at launch, each with a clear creator and audience). OUTPUT: Portfolio plan.',
        'DAYS 8-14: Purchase Media Perils insurance ($2M-$5M). OUTPUT: Insurance active.',
        'DAYS 15-30: Build studio website, set up newsletter platform (Beehiiv, Ghost), set up podcast hosting (Megaphone, Acast, Transistor). OUTPUT: Publishing stack live.',
        'DAYS 15-30: Define member subscription bundle ($7-$15/month, all shows access). Set up payment infrastructure. OUTPUT: Subscription tier ready.',
        'DAYS 31-60: Launch all shows simultaneously. Cross-promote on each show, social, and email. Pitch coverage in trade press (Hot Pod, Digiday). OUTPUT: All shows live with cross-promotion.',
        'DAYS 31-60: Activate first sponsorships and ad partnerships. Use a podcast ad rep firm (Multitude, Acast, Magellan AI) if needed. OUTPUT: First ad revenue.',
        'DAYS 61-90: Hit 500-1000 paying members across the bundle. Apply for any relevant grants (NPR Studio, Spotify Sound Up, Google News Initiative). OUTPUT: First 1000 paying members.'
      ]
    }
  };

  var STAGES = [
    { title: 'STAGE 1 - CONCEPT & MARKET', sections: [
      { id: 'concept', title: 'What This Business Is', type: 'fields', guidance: 'In one paragraph, describe what this business does and who it serves.', fields: [
        { id: 'name', label: 'Business name', type: 'text' },
        { id: 'mapping_title', label: 'Mapped business type', type: 'text' },
        { id: 'node_source', label: 'Source brain node', type: 'text' },
        { id: 'full_desc', label: 'What this business does (1 paragraph)', type: 'textarea' }
      ] },
      { id: 'market', title: 'Market & Customer', type: 'fields', guidance: 'Who is the customer and why do they need this now?', fields: [
        { id: 'customer', label: 'Primary customer', type: 'text' },
        { id: 'market_size', label: 'Estimated addressable market', type: 'text' },
        { id: 'why_now', label: 'Why this market needs the service NOW', type: 'textarea' }
      ] },
      { id: 'biz_type', title: 'Business Template', type: 'fields', guidance: 'Which template best fits this business?', fields: [
        { id: 'template', label: 'Template', type: 'select', options: ['nonprofit_newsroom', 'creator_subscription', 'comms_consultancy', 'trust_safety_vendor', 'local_news_coop', 'creator_studio'] }
      ] }
    ] },
    { title: 'STAGE 2 - LEGAL & ENTITY', sections: [
      { id: 'entity', title: 'Entity Formation', type: 'fields', fields: [
        { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC', 'C-Corp', 'S-Corp', '501(c)(3)', 'Sole Proprietor'] },
        { id: 'state', label: 'State of formation', type: 'text' },
        { id: 'filing_status', label: 'Filing status', type: 'select', options: ['Not started', 'Drafted', 'Filed', 'Confirmed'] }
      ] },
      { id: 'tax_id', title: 'EIN & Tax Setup', type: 'fields', fields: [
        { id: 'ein', label: 'EIN (last 4 digits)', type: 'text' },
        { id: 'tax_year', label: 'Tax year', type: 'text' }
      ] },
      { id: 'compliance', title: 'Communication Regulatory Compliance', type: 'textarea', guidance: 'IRS 501(c)(3) / state charity registration / Section 230 / FCC rules / state defamation law / Media Perils insurance / GDPR / state shield laws / publisher liability as applicable.' },
      { id: 'governance', title: 'Governance Documents', type: 'checklist', items: ['Operating agreement / shareholder agreement', 'Founder vesting / restricted stock', '83(b) election filed (if applicable)', 'MSA / DPA / SLA templates', 'NDAs', 'IP assignment agreements', 'Open-source contribution license (CLA/DCO if applicable)'] },
      { id: 'legal_docs', title: 'Required Legal Documents', type: 'checklist', items: ['State formation filing', 'EIN confirmation', 'Insurance policies', 'Background check policy', 'Charter / authorizer approval (if applicable)', 'Student Privacy Pledge signature (if edtech)'] }
    ] },
    { title: 'STAGE 3 - FINANCIAL SETUP', sections: [
      { id: 'banking', title: 'Banking & Accounting', type: 'fields', fields: [
        { id: 'op_bank', label: 'Operating bank', type: 'text' },
        { id: 'accounting_software', label: 'Accounting software', type: 'select', options: ['QuickBooks Online', 'Pilot', 'Bench', 'Other'] }
      ] },
      { id: 'startup_costs', title: 'Startup Costs', type: 'fields', fields: [
        { id: 'cost_legal', label: 'Legal/formation', type: 'text' },
        { id: 'cost_insurance', label: 'Insurance', type: 'text' },
        { id: 'cost_publishing', label: 'Publishing platform / hosting', type: 'text' },
        { id: 'cost_software', label: 'Software / IT', type: 'text' },
        { id: 'cost_personnel', label: 'Personnel (3-month runway)', type: 'text' },
        { id: 'cost_total', label: 'Total startup', type: 'text' }
      ] },
      { id: 'revenue', title: 'Revenue Model', type: 'textarea' },
      { id: 'sources', title: 'Funding Sources', type: 'textarea' },
      { id: 'loan_prep', title: 'Grant / Loan Preparation', type: 'textarea' },
      { id: 'financial_docs', title: 'Financial Documents Ready', type: 'checklist', items: ['Startup budget', 'Year 1 cash flow projection', '3-year P&L projection', 'SBIR / STTR proposal (if applicable)', 'Cap table (if VC track)', 'Pitch deck'] }
    ] },
    { title: 'STAGE 4 - OPERATIONS', sections: [
      { id: 'delivery', title: 'Service / Product Delivery Model', type: 'textarea' },
      { id: 'team', title: 'Team', type: 'textarea' },
      { id: 'infrastructure', title: 'Tech / Facility Infrastructure', type: 'textarea' },
      { id: 'operating_docs', title: 'Operating Procedures', type: 'checklist', items: ['Customer intake / sales process', 'Standard operating procedures (SOPs)', 'Incident response + on-call runbook', 'Customer data handling protocols', 'Billing and invoicing', 'Customer success workflow'] }
    ] },
    { title: 'STAGE 5 - LAUNCH (FIRST 90 DAYS)', sections: [
      { id: 'customers', title: 'Customer / District Acquisition Plan', type: 'textarea' },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields', fields: [
        { id: 'days_1_30', label: 'Days 1-30', type: 'textarea' },
        { id: 'days_31_60', label: 'Days 31-60', type: 'textarea' },
        { id: 'days_61_90', label: 'Days 61-90', type: 'textarea' }
      ] }
    ] },
    { title: 'STAGE 6 - LAUNCH READINESS', sections: [
      { id: 'readiness', title: 'Launch Readiness Checklist', type: 'checklist', items: ['Legal entity formed and EIN issued', 'Banking and accounting active', 'Insurance in force (cyber + E&O + general liability)', 'SOC 2 / ISO 27001 program started if required', 'Privacy policy + ToS + DPA published', 'Founder/team vesting active', 'First customers / pilots identified', '90-day plan documented'] },
      { id: 'review', title: 'Final Review', type: 'review' }
    ] },
    { title: 'STAGE 7 - AUDITOR DECISION', sections: [
      { id: 'auditor', title: 'Auditor Decision', type: 'auditor' }
    ] }
  ];

  function renderField(sec, ws) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var checked = (ws.checks && ws.checks[sec.id]) || {};
    var sectionDone = ws.sectionDone && ws.sectionDone[sec.id];
    var h = '<div class="eep-section" data-section="' + sec.id + '">';
    h += '<div class="eep-section-header"><span class="eep-section-title">' + (sectionDone ? '\u2713 ' : '') + esc(sec.title) + '</span>';
    if (sec.type !== 'info' && sec.type !== 'review' && sec.type !== 'auditor') h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (sectionDone ? ' checked' : '') + '> done</label>';
    h += '</div>';
    if (sec.guidance) h += '<div class="eep-guidance">' + esc(sec.guidance) + '</div>';

    if (sec.type === 'textarea') {
      h += '<textarea class="eep-textarea" data-field="' + sec.id + '.value">' + esc(typeof val === 'object' ? (val.value || '') : val) + '</textarea>';
    } else if (sec.type === 'fields') {
      var fieldVals = typeof val === 'object' ? val : {};
      for (var fi = 0; fi < sec.fields.length; fi++) {
        var f = sec.fields[fi];
        var fv = fieldVals[f.id] || '';
        h += '<div class="eep-field"><label class="eep-field-label">' + esc(f.label) + '</label>';
        if (f.type === 'select') {
          h += '<select class="eep-select" data-field="' + sec.id + '.' + f.id + '">';
          h += '<option value=""></option>';
          for (var oi = 0; oi < f.options.length; oi++) h += '<option' + (fv === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>';
          h += '</select>';
        } else if (f.type === 'textarea') {
          h += '<textarea class="eep-textarea" data-field="' + sec.id + '.' + f.id + '">' + esc(fv) + '</textarea>';
        } else {
          h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(fv) + '">';
        }
        h += '</div>';
      }
    } else if (sec.type === 'checklist') {
      for (var ci = 0; ci < sec.items.length; ci++) {
        var ik = 'item_' + ci;
        h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="' + ik + '"' + (checked[ik] ? ' checked' : '') + '> ' + esc(sec.items[ci]) + '</label>';
      }
    } else if (sec.type === 'review') {
      var ts = 0, ds = 0;
      for (var ssi = 0; ssi < STAGES.length; ssi++) {
        for (var psi = 0; psi < STAGES[ssi].sections.length; psi++) {
          var ps = STAGES[ssi].sections[psi];
          if (ps.type === 'review' || ps.type === 'auditor') continue;
          ts++;
          if (ws.sectionDone && ws.sectionDone[ps.id]) ds++;
        }
      }
      var pct = ts > 0 ? Math.round(ds / ts * 100) : 0;
      h += '<div style="font-size:0.38rem;color:#d0c8b8;margin-bottom:6px">Progress: <b>' + ds + '/' + ts + '</b> (' + pct + '%)</div>';
      h += '<div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:3px"></div></div>';
      h += '<div style="margin-top:8px"><button class="eep-btn eep-btn-print" data-action="print">PRINT LAUNCH PACKET</button></div>';
    } else if (sec.type === 'auditor') {
      var as = ws.auditor || {};
      var sl = as.status || 'DRAFT';
      h += '<div class="eep-auditor"><div class="eep-auditor-title">AUDITOR REVIEW</div>';
      h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Auditor comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:40px">' + esc(as.comments || '') + '</textarea></div>';
      h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>';
      if (as.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(as.timestamp).toLocaleString() + '</div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function autoGenerate(ws, prefill, tmpl) {
    if (!ws.fields) ws.fields = {};
    if (tmpl && tmpl.first90 && (!ws.fields['first90'] || !ws.fields['first90']['days_1_30'])) {
      ws.fields['first90'] = ws.fields['first90'] || {};
      ws.fields['first90']['days_1_30'] = tmpl.first90.slice(0, 3).join('\n');
      ws.fields['first90']['days_31_60'] = tmpl.first90.slice(3, 6).join('\n');
      ws.fields['first90']['days_61_90'] = tmpl.first90.slice(6).join('\n');
    }
    if (tmpl && (!ws.fields['compliance'] || !ws.fields['compliance']['value'])) {
      ws.fields['compliance'] = { value: tmpl.legalNotes };
    }
    if (tmpl && (!ws.fields['revenue'] || !ws.fields['revenue']['value'])) {
      ws.fields['revenue'] = { value: tmpl.fundingNotes };
    }
    if (tmpl && (!ws.fields['delivery'] || !ws.fields['delivery']['value'])) {
      ws.fields['delivery'] = { value: tmpl.operatingNotes };
    }
  }

  function renderPanel(oppKey, prefill) {
    var ws = getWs(oppKey) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    var mode = getMode();

    if (!ws._prefilled && prefill) {
      ws._prefilled = true;
      if (!ws.fields['concept']) ws.fields['concept'] = {};
      if (prefill.nodeLabel) ws.fields['concept']['node_source'] = prefill.nodeLabel;
      if (prefill.businessType) {
        ws.fields['concept']['mapping_title'] = prefill.businessType;
        ws.fields['concept']['name'] = prefill.businessType + ' Inc.';
      }
      if (prefill.reason) ws.fields['concept']['full_desc'] = prefill.reason;
    }

    var tmplKey = ws.fields && ws.fields['biz_type'] && ws.fields['biz_type']['template'];
    if (!tmplKey && prefill && prefill.businessType) {
      var bt = (prefill.businessType || '').toLowerCase();
      if (bt.indexOf('nonprofit') !== -1 || bt.indexOf('501') !== -1 || bt.indexOf('newsroom') !== -1 || bt.indexOf('investigative') !== -1) tmplKey = 'nonprofit_newsroom';
      else if (bt.indexOf('co-op') !== -1 || bt.indexOf('coop') !== -1 || bt.indexOf('cooperative') !== -1 || bt.indexOf('member-owned') !== -1) tmplKey = 'local_news_coop';
      else if (bt.indexOf('newsletter') !== -1 || bt.indexOf('substack') !== -1 || bt.indexOf('podcast') !== -1 || bt.indexOf('creator') !== -1 || bt.indexOf('subscription') !== -1) tmplKey = 'creator_subscription';
      else if (bt.indexOf('studio') !== -1 || bt.indexOf('production house') !== -1 || bt.indexOf('multi-show') !== -1) tmplKey = 'creator_studio';
      else if (bt.indexOf('trust') !== -1 || bt.indexOf('moderation') !== -1 || bt.indexOf('fact check') !== -1 || bt.indexOf('misinformation') !== -1 || bt.indexOf('safety') !== -1) tmplKey = 'trust_safety_vendor';
      else if (bt.indexOf('consult') !== -1 || bt.indexOf('advisory') !== -1 || bt.indexOf('pr ') !== -1 || bt.indexOf('communications') !== -1 || bt.indexOf('crisis') !== -1) tmplKey = 'comms_consultancy';
      else tmplKey = 'creator_subscription';
      if (!ws.fields['biz_type']) ws.fields['biz_type'] = {};
      ws.fields['biz_type']['template'] = tmplKey;
    }
    var tmpl = tmplKey ? TEMPLATES[tmplKey] : null;

    autoGenerate(ws, prefill, tmpl);
    saveWs(oppKey, ws);

    var total = 0, done = 0;
    for (var pi = 0; pi < STAGES.length; pi++) {
      for (var psi = 0; psi < STAGES[pi].sections.length; psi++) {
        var ps = STAGES[pi].sections[psi];
        if (ps.type === 'review' || ps.type === 'auditor') continue;
        total++;
        if (ws.sectionDone && ws.sectionDone[ps.id]) done++;
      }
    }
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var status = ws.auditor && ws.auditor.status ? ws.auditor.status : 'DRAFT';

    var h = '<div class="eep-panel" data-opp="' + esc(oppKey) + '" data-track="business">';
    h += '<div class="eep-header" data-toggle="' + oppKey + '-business">';
    h += '<span class="eep-track-label" style="color:#C9A94E">BUSINESS BUILD</span>';
    h += '<span class="eep-progress">' + pct + '% \u00b7 ' + done + '/' + total + ' \u00b7 <span class="eep-status eep-status-' + status.toLowerCase() + '">' + status + '</span></span>';
    h += '<span class="eep-toggle">\u25BC</span>';
    h += '</div>';
    h += '<div class="eep-body" data-body="' + oppKey + '-business">';

    h += '<div style="display:flex;gap:4px;margin-bottom:10px;align-items:center">';
    h += '<button class="eep-btn" data-bb-mode="operator" style="' + (mode === 'operator' ? 'color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">OPERATOR MODE</button>';
    h += '<button class="eep-btn" data-bb-mode="auditor" style="' + (mode === 'auditor' ? 'color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">AUDITOR MODE</button>';
    h += '<span style="flex:1"></span>';
    h += '<span style="font-size:0.26rem;color:#706860">' + (mode === 'operator' ? 'Simplified guided flow' : 'Full access') + '</span>';
    h += '</div>';

    if (tmpl) {
      h += '<div style="padding:10px 12px;margin-bottom:12px;border:1px solid rgba(90,181,160,0.15);border-radius:3px;background:rgba(90,181,160,0.03)">';
      h += '<div style="font-size:0.36rem;color:#5ab5a0;margin-bottom:4px">We built this for you based on your business type.</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898">Template: <b>' + esc(tmpl.label) + '</b> \u00b7 Capital: ' + esc(tmpl.typicalStartup) + ' \u00b7 ' + (tmpl.regulated ? 'Regulated' : 'Non-regulated') + '</div>';
      h += '<div style="font-size:0.30rem;color:#908878;margin-top:4px">' + esc(tmpl.description) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868;margin-top:6px"><b>Legal:</b> ' + esc(tmpl.legalNotes) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868"><b>Funding:</b> ' + esc(tmpl.fundingNotes) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868"><b>Operations:</b> ' + esc(tmpl.operatingNotes) + '</div>';
      h += '</div>';
    }

    for (var si = 0; si < STAGES.length; si++) {
      var stage = STAGES[si];
      var stageSections = stage.sections.filter(function (sec) {
        if (mode === 'operator' && AUDITOR_ONLY.indexOf(sec.id) !== -1) return false;
        return true;
      });
      if (stageSections.length === 0) continue;
      h += '<div style="margin-bottom:12px">';
      h += '<div style="font-size:0.34rem;letter-spacing:2.5px;color:rgba(201,169,78,0.4);padding:6px 0;border-bottom:1px solid rgba(201,169,78,0.08);margin-bottom:8px">' + esc(stage.title) + '</div>';
      for (var ssi = 0; ssi < stageSections.length; ssi++) h += renderField(stageSections[ssi], ws);
      h += '</div>';
    }

    h += '</div></div>';
    return h;
  }

  function wirePanel(container, oppKey) {
    var panel = container.querySelector('[data-opp="' + esc(oppKey) + '"][data-track="business"]');
    if (!panel) return;
    var header = panel.querySelector('[data-toggle="' + oppKey + '-business"]');
    var body = panel.querySelector('[data-body="' + oppKey + '-business"]');
    if (header && body) {
      header.addEventListener('click', function () { body.classList.toggle('open'); var t = header.querySelector('.eep-toggle'); if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC'; });
    }
    var ws = getWs(oppKey) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };

    panel.querySelectorAll('.eep-textarea, .eep-input, .eep-select').forEach(function (el) {
      el.addEventListener('change', function () {
        var field = this.getAttribute('data-field'); var aud = this.getAttribute('data-auditor');
        if (field) { var p = field.split('.'); if (typeof ws.fields[p[0]] !== 'object') ws.fields[p[0]] = {}; ws.fields[p[0]][p[1]] = this.value; }
        if (aud) { ws.auditor = ws.auditor || {}; ws.auditor[aud] = this.value; }
        saveWs(oppKey, ws);
      });
    });

    panel.querySelectorAll('.eep-check').forEach(function (el) {
      el.addEventListener('change', function () { var sec = this.getAttribute('data-sec'), item = this.getAttribute('data-item'); if (!ws.checks[sec]) ws.checks[sec] = {}; ws.checks[sec][item] = this.checked; saveWs(oppKey, ws); });
    });

    panel.querySelectorAll('.eep-done-check').forEach(function (el) {
      el.addEventListener('change', function () { if (!ws.sectionDone) ws.sectionDone = {}; ws.sectionDone[this.getAttribute('data-sec')] = this.checked; saveWs(oppKey, ws); });
    });

    panel.querySelectorAll('[data-bb-mode]').forEach(function (el) {
      el.addEventListener('click', function () {
        setMode(this.getAttribute('data-bb-mode'));
        var newH = renderPanel(oppKey, null);
        panel.outerHTML = newH;
        wirePanel(container, oppKey);
        var newPanel = container.querySelector('[data-opp="' + esc(oppKey) + '"][data-track="business"]');
        if (newPanel) { var nb = newPanel.querySelector('.eep-body'); if (nb) nb.classList.add('open'); }
      });
    });

    panel.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        if (action === 'print') { window.print(); return; }
        ws.auditor = ws.auditor || {};
        if (action === 'approve') ws.auditor.status = 'APPROVED';
        if (action === 'deny') ws.auditor.status = 'DENIED';
        if (action === 'revise') ws.auditor.status = 'REVISE';
        ws.auditor.timestamp = Date.now();
        saveWs(oppKey, ws);
        var newH = renderPanel(oppKey, null);
        panel.outerHTML = newH;
        wirePanel(container, oppKey);
      });
    });
  }

  window.LIMENCommunicationBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[CommunicationBusinessBuild] loaded \u2014 7 stages, 6 communication-native templates');
})();
