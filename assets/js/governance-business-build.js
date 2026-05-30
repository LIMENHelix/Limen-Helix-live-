/**
 * education-business-build.js — BUSINESS BUILD Execution Workspace (Education)
 *
 * Governance-native business launch system. Stages with governance-native templates
 * (B2B SaaS, cybersecurity vendor, AI infrastructure, devtools / open source,
 * technology consultancy). 90-day execution plan, printable launch packet.
 *
 * Education domain only.
 * Exposes: window.LIMENGovernanceBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isGovernance = _dom === 'governance';
  var isWorkspace = window.location.pathname.indexOf('governance-workspace') !== -1;
  if (!isGovernance && !isWorkspace) return;

  var STORE_KEY = 'limen_governance_business_build';
  var MODE_KEY = 'limen_gbb_mode';

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
    'govtech_startup': {
      label: 'GovTech / Civic-Tech Startup',
      description: 'A venture-backed company building software for federal, state, or local government. Examples: Tyler Technologies, Granicus, OpenGov, Accela, CivicPlus, NIC, Bloomerang, Quorum, FiscalNote.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$500K-$10M',
      legalNotes: 'Delaware C-Corp. SAM.gov registration. State procurement registrations across 50 states (ouch). FedRAMP if federal cloud. NIST 800-171 / CMMC 2.0 if handling CUI. State sales tax registrations.',
      fundingNotes: 'GovTech-focused VCs (Govtech Fund, Ekistic Ventures, Founders Fund Civic, a16z American Dynamism). SBIR Phase I/II/III. State innovation funds.',
      operatingNotes: 'Government sales cycles are long (12-24 months). State and local procurement is its own subculture. Multi-state expansion requires per-state vendor registration and customizing for local procurement quirks. RFP responses are an art form.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares with vesting. File 83(b). OUTPUT: Entity and founder equity active.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Set up accounting. Engage counsel familiar with government contracting. OUTPUT: Banking and counsel.',
        'DAYS 8-14: Register on SAM.gov. Get DUNS / UEI. Apply for relevant state vendor registrations (start with home state, expand later). OUTPUT: Federal and state vendor IDs active.',
        'DAYS 8-14: Build MVP and demo environment. Document the value proposition in plain government language. OUTPUT: MVP demo-ready.',
        'DAYS 15-30: Engage 2-3 design partner agencies (city, county, or state). Offer free pilots in exchange for case studies. OUTPUT: Design partner pilots active.',
        'DAYS 15-30: Apply for SBIR Phase I or state innovation fund. Pursue GovTech Fund / Ekistic Ventures meetings. OUTPUT: Funding pipeline open.',
        'DAYS 31-60: Iterate on design partner feedback. Document reference case study. OUTPUT: First reference customer.',
        'DAYS 31-60: Begin FedRAMP readiness if pursuing federal customers. Begin state procurement RFP responses. OUTPUT: Compliance and RFP pipeline live.',
        'DAYS 61-90: Win first paid contract (most likely a small city or county pilot). Sign master subscription agreement. OUTPUT: First paying customer.'
      ]
    },
    'lobbying_firm': {
      label: 'Lobbying / Government Affairs Firm',
      description: 'A firm providing federal, state, or international lobbying and government affairs services. Examples: BGR Group, Akin Gump, Holland & Knight, Brownstein Hyatt Farber Schreck, Crowell & Moring.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$50K-$500K',
      legalNotes: 'LLC or PLLC typical. Lobbying Disclosure Act (LDA) registration with House and Senate. Foreign Agents Registration Act (FARA) registration if representing foreign principals. State lobbying registrations. Quarterly LD-2 reports.',
      fundingNotes: 'Self-funded. First clients come from prior networks (former Hill staff, former agency officials, former White House staff). Monthly retainers $5K-$50K typical.',
      operatingNotes: 'Reputation, network, and bipartisan reach are everything. Top federal lobbyists bill $750-$1500 per hour. Retainers run $5K-$50K per month. Niche specialization (defense, healthcare, fintech, energy) pays.',
      first90: [
        'DAYS 1-5: File LLC or PLLC. Apply for EIN. Open business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Register on SAM.gov for federal contract eligibility. OUTPUT: Federal vendor registration live.',
        'DAYS 6-15: Register under Lobbying Disclosure Act (LDA). Set up quarterly LD-2 reporting workflow. OUTPUT: Federal lobbying registration active.',
        'DAYS 6-15: Build website with bios, practice areas, recent wins. Set up business email and phone. OUTPUT: Professional presence live.',
        'DAYS 16-25: Define service catalog: federal lobbying, agency advocacy, regulatory comment drafting, congressional outreach, coalition management. Set rates ($15K-$50K/month retainer). OUTPUT: Service menu finalized.',
        'DAYS 16-25: Outreach to 50 prospects in your network. Schedule 15 meetings. OUTPUT: 15 prospect meetings booked.',
        'DAYS 26-40: Convert meetings into first 2-3 paying clients. Sign retainer agreements. OUTPUT: First paying clients.',
        'DAYS 41-60: Deliver first lobbying engagements. File first LD-2 quarterly report. Build coalition and meeting tracker. OUTPUT: First quarterly report filed.',
        'DAYS 61-90: Convert one-off engagements into year-long retainers. Pitch defense or healthcare niche if you have prior agency experience. OUTPUT: First annual retainer signed.'
      ]
    },
    'democracy_ngo': {
      label: 'Democracy / Governance Nonprofit',
      description: 'A 501(c)(3) nonprofit working on democracy, governance, election integrity, or institutional reform. Examples: National Democratic Institute, Brennan Center, NDI, IRI, Verified Voting, IFES.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$250K-$2M',
      legalNotes: 'State nonprofit corporation. IRS Form 1023 for 501(c)(3) status. State charity registration in every state where you fundraise. Lobbying limits (501(c)(3) can lobby but with caps; many democracy nonprofits use a 501(c)(4) sister entity for unrestricted lobbying). Annual Form 990.',
      fundingNotes: 'Foundation grants (Open Society, Hewlett, Carnegie, Knight, MacArthur, Ford, Democracy Fund). Federal democracy assistance funding (NED, USAID DRG). Major individual donors. Membership donations.',
      operatingNotes: 'Editorial / advocacy independence is non-negotiable for foundation funders. Annual transparency report. Public-interest mission focus. Multi-year program planning. Coalition partnerships are critical.',
      first90: [
        'DAYS 1-7: Incorporate as a state nonprofit corporation. Adopt bylaws and elect a founding board (5-7 members). OUTPUT: Legal entity and governing board.',
        'DAYS 1-7: Apply for EIN. Open business bank account at a community-friendly bank. Set up nonprofit accounting (QuickBooks Nonprofit). OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Begin IRS Form 1023 application for 501(c)(3) status. Engage nonprofit counsel ($2K-$5K). OUTPUT: 1023 in progress.',
        'DAYS 8-14: Adopt bylaws, conflict-of-interest policy, financial controls policy, whistleblower policy. OUTPUT: Governance documents in place.',
        'DAYS 15-30: Define program focus area (election integrity, government transparency, civic engagement, anti-corruption, etc.). Develop logic model and theory of change. OUTPUT: Program design documented.',
        'DAYS 15-30: Apply to relevant funder networks (Knight Foundation, Democracy Fund, NED, Hewlett). OUTPUT: Funder pipeline open.',
        'DAYS 31-60: Recruit founding executive director and 1-2 program staff. Publish first programmatic content. OUTPUT: Team and first content live.',
        'DAYS 31-60: Run first donor / member campaign. Build CRM and donor management system. OUTPUT: First 100-500 donors / members.',
        'DAYS 61-90: Submit first foundation grant proposal (typically $50K-$500K). Host launch event for board, donors, and stakeholders. OUTPUT: First grant pitch in process.'
      ]
    },
    'political_risk_advisory': {
      label: 'Political Risk Advisory Firm',
      description: 'A boutique political risk advisory practice providing intelligence and analysis to corporate boards, sovereign wealth funds, family offices, and multilateral institutions. Examples: Eurasia Group, Control Risks, RANE, Teneo, Hakluyt, Maplecroft.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$50K-$500K',
      legalNotes: 'LLC or PLLC typical. Professional liability insurance ($2M-$5M E&O). NDA / engagement letters per client. State business registration.',
      fundingNotes: 'Self-funded. First clients come from prior government, intelligence community, or diplomatic service networks. Subscription and retainer revenue model.',
      operatingNotes: 'Subject matter expertise is the moat. Senior intelligence community veterans, former ambassadors, and academics can charge $500-$1500 per hour. Subscriptions to corporate clients run $250K-$2M per year.',
      first90: [
        'DAYS 1-5: File LLC or PLLC. Apply for EIN. Open business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Build a simple website. Set up business email. OUTPUT: Professional presence.',
        'DAYS 6-15: Purchase professional liability insurance ($2M-$5M E&O, ~$2K-$5K/year). OUTPUT: Insurance active.',
        'DAYS 6-15: Define service catalog: country risk reports, scenario planning, sanctions advisory, election analysis, geopolitical war games, executive briefings. Set rates ($500-$1500/hr or $50K-$250K project). OUTPUT: Service menu finalized.',
        'DAYS 16-25: Build templates: NDA, MSA, country report template, executive briefing template, scenario doc. OUTPUT: Templates ready.',
        'DAYS 16-25: Outreach to 30 prospects in your network. Schedule 10 meetings. OUTPUT: 10 prospect meetings booked.',
        'DAYS 26-40: Convert meetings into first paying engagements. OUTPUT: First paying clients.',
        'DAYS 41-60: Deliver first reports and briefings. Build case studies. OUTPUT: First engagements delivered.',
        'DAYS 61-90: Convert one-off engagements into annual subscriptions. Build inbound visibility (op-eds, podcast appearances, conference panels). OUTPUT: First annual subscription signed.'
      ]
    },
    'fcpa_anti_corruption_firm': {
      label: 'FCPA / Anti-Corruption Investigation Practice',
      description: 'A boutique forensic investigation practice specializing in Foreign Corrupt Practices Act (FCPA) defense, anti-bribery compliance, and corruption investigations. Examples: FTI Consulting, FRA, AlixPartners, K2 Integrity, Kroll.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$100K-$1M',
      legalNotes: 'LLC or PLLC typical. Attorney work product protection if affiliated with a law firm. Professional liability insurance ($5M-$10M E&O). Confidentiality agreements with every client. Bar admission for any attorney work.',
      fundingNotes: 'Self-funded. First clients come from prior DOJ, SEC, or Big Four forensic backgrounds. Hourly billing or fixed-fee project model.',
      operatingNotes: 'Subject matter expertise is everything. Former DOJ Public Integrity Section attorneys, SEC enforcement attorneys, and Big Four forensic accountants are in highest demand. Hourly rates $500-$1500. Fixed-fee investigations $250K-$5M.',
      first90: [
        'DAYS 1-5: File LLC or PLLC. Apply for EIN. Open business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Verify any required certifications (CFE, CFI, CPA, JD, bar admission). OUTPUT: Credentials documented.',
        'DAYS 6-15: Purchase professional liability ($5M-$10M E&O, ~$5K-$15K/year). OUTPUT: Insurance active.',
        'DAYS 6-15: Define service catalog: FCPA defense, anti-bribery compliance assessment, internal investigations, forensic accounting, monitor / audit response, due diligence. Set rates ($500-$1500/hr). OUTPUT: Service menu finalized.',
        'DAYS 16-25: Build templates: NDA, engagement letter, investigation work plan, interview memo template, forensic finding report. OUTPUT: Templates ready.',
        'DAYS 16-25: Outreach to former DOJ / SEC colleagues, Big Four alumni, and law firm contacts. Get on BTI / Chambers consideration. OUTPUT: Network warm.',
        'DAYS 26-40: Convert relationships into first investigation engagement. Sign engagement letter. OUTPUT: First paying engagement.',
        'DAYS 41-60: Deliver first investigation. Bill on hourly with monthly invoices. OUTPUT: First engagement delivered.',
        'DAYS 61-90: Convert one-off into ongoing compliance monitor or retainer relationship. Pursue Chambers / BTI ranking. OUTPUT: First monitor / retainer signed.'
      ]
    },
    'civic_engagement_platform': {
      label: 'Civic Engagement / Campaign Tech Platform',
      description: 'A B2B SaaS platform for political campaigns, advocacy organizations, or civic engagement groups. Examples: NGP VAN, Action Network, ActBlue, WinRed, Quorum, Phone2Action, Bloomerang.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$500K-$5M',
      legalNotes: 'Delaware C-Corp. FEC compliance for any political advertising or fundraising features. State election commission registration (varies by state). Privacy compliance (CCPA, GDPR if international). Data security audits.',
      fundingNotes: 'Civic-tech VCs (Higher Ground Labs, Ekistic Ventures, Govtech Fund). Strategic investors (NGP VAN parent companies). Self-funded with subscription revenue.',
      operatingNotes: 'Election cycles drive revenue spikes (presidential year > midterm year > odd year). Bipartisan vs. partisan positioning matters. Sales cycle is short for individual campaigns and long for state party committees.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares. OUTPUT: Entity active.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Engage election law counsel. OUTPUT: Banking and counsel.',
        'DAYS 8-14: Build MVP. Decide bipartisan vs. partisan positioning (this is a strategic call that affects everything). OUTPUT: MVP and positioning decided.',
        'DAYS 8-14: FEC compliance review for any features touching political fundraising or advertising. OUTPUT: FEC posture documented.',
        'DAYS 15-30: Sign 3-5 design partner campaigns or advocacy organizations. Offer free pilots. OUTPUT: Design partners active.',
        'DAYS 15-30: Pitch civic-tech VCs (Higher Ground, Ekistic, Govtech Fund). OUTPUT: Funding pipeline open.',
        'DAYS 31-60: Iterate on design partner feedback. Build subscription billing and tier structure. OUTPUT: Production-ready platform.',
        'DAYS 31-60: Begin SOC 2 Type I readiness. Required by enterprise customers and many state party committees. OUTPUT: SOC 2 program live.',
        'DAYS 61-90: Convert first design partner into a paid annual contract. Sign MSA. OUTPUT: First paying customer.'
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
        { id: 'template', label: 'Template', type: 'select', options: ['govtech_startup', 'lobbying_firm', 'democracy_ngo', 'political_risk_advisory', 'fcpa_anti_corruption_firm', 'civic_engagement_platform'] }
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
      { id: 'compliance', title: 'Governance Regulatory Compliance', type: 'textarea', guidance: 'IRS 501(c)(3) / state charity registration / Lobbying Disclosure Act (LDA) / FARA / FCPA / FEC / state election law / SAM.gov / FedRAMP / state procurement / GDPR / state privacy laws as applicable.' },
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
      if (bt.indexOf('lobby') !== -1 || bt.indexOf('government affair') !== -1) tmplKey = 'lobbying_firm';
      else if (bt.indexOf('nonprofit') !== -1 || bt.indexOf('501') !== -1 || bt.indexOf('democracy') !== -1 || bt.indexOf('election integrity') !== -1) tmplKey = 'democracy_ngo';
      else if (bt.indexOf('political risk') !== -1 || bt.indexOf('advisory') !== -1 || bt.indexOf('intelligence analysis') !== -1) tmplKey = 'political_risk_advisory';
      else if (bt.indexOf('fcpa') !== -1 || bt.indexOf('anti-corruption') !== -1 || bt.indexOf('forensic') !== -1 || bt.indexOf('investigation') !== -1) tmplKey = 'fcpa_anti_corruption_firm';
      else if (bt.indexOf('campaign') !== -1 || bt.indexOf('voter') !== -1 || bt.indexOf('civic engagement') !== -1 || bt.indexOf('crm') !== -1) tmplKey = 'civic_engagement_platform';
      else tmplKey = 'govtech_startup';
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

  window.LIMENGovernanceBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[GovernanceBusinessBuild] loaded \u2014 7 stages, 6 governance-native templates');
})();
