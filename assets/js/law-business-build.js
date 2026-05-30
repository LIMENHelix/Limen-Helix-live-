/**
 * law-business-build.js — BUSINESS BUILD Execution Workspace (Law)
 *
 * Law-native business launch system. Stages with law-native templates,
 * lender-ready financials, 90-day execution plan, printable launch packet.
 *
 * Law domain only.
 * Exposes: window.LIMENLawBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isLaw = _dom === 'law';
  var isWorkspace = window.location.pathname.indexOf('law-workspace') !== -1;
  if (!isLaw && !isWorkspace) return;

  var STORE_KEY = 'limen_law_business_build';
  var MODE_KEY = 'limen_lbb_mode';

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }
  function getWs(key) { return loadAll()[key] || null; }
  function saveWs(key, ws) { var a = loadAll(); a[key] = ws; saveAll(a); }
  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function getMode() { try { return localStorage.getItem(MODE_KEY) || 'operator'; } catch (e) { return 'operator'; } }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) {} }

  var OPERATOR_SECTIONS = ['concept', 'market', 'biz_type', 'entity', 'tax_id', 'compliance', 'banking', 'delivery', 'customers', 'first90', 'readiness'];
  var AUDITOR_ONLY = ['revenue', 'governance', 'startup_costs', 'sources', 'loan_prep', 'team', 'infrastructure', 'legal_docs', 'financial_docs'];

  // ══════════════════════════════════════════════════════════════════════
  // LAW-NATIVE BUSINESS TYPE TEMPLATES
  // ══════════════════════════════════════════════════════════════════════

  var TEMPLATES = {
    'solo_law_practice': {
      label: 'Solo Law Practice',
      description: 'A single-attorney law firm offering one or more legal services to clients. Examples: estate planning, family law, immigration, criminal defense, civil litigation.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$5K-$30K',
      legalNotes: 'Bar admission in the state of practice required. Most states require a PLLC or PC entity for law practice. Trust account (IOLTA) required. Professional liability insurance (legal malpractice) strongly advised.',
      fundingNotes: 'Typically self-funded. SBA microloans possible. Unfunded for first 3-6 months is common while client pipeline builds.',
      operatingNotes: 'Revenue from billable hours, flat fees, or contingency. First clients usually come from referrals and bar associations. Cash flow gap between work and collection is the main risk.',
      first90: [
        'DAYS 1-5: Confirm bar admission status in your state. Pay annual bar dues. Verify CLE requirements are current. OUTPUT: Active bar membership confirmed.',
        'DAYS 1-5: Form a PLLC or PC with your state Secretary of State. Most states require an attorney-only entity. File the bar registration if your state requires it. OUTPUT: Legal entity formed and bar-registered.',
        'DAYS 6-10: Apply for EIN at irs.gov/ein. Open a business operating account AND a separate IOLTA trust account at a bar-approved bank. Never commingle trust funds. OUTPUT: EIN, operating account, and IOLTA active.',
        'DAYS 6-10: Purchase legal malpractice insurance (E&O for lawyers). Contact ALPS, CNA, or a bar-recommended carrier. Typical solo cost: $1,500-$4,000/year for $1M coverage. OUTPUT: Malpractice policy in force.',
        'DAYS 11-15: Set up legal practice management software (Clio, MyCase, or PracticePanther). Configure trust accounting, time tracking, and conflict checking. OUTPUT: Practice management system live.',
        'DAYS 11-15: Draft engagement letter template, fee agreement template, and conflicts waiver template. Have a senior attorney or ethics counsel review. OUTPUT: Standard client documents ready.',
        'DAYS 16-25: Join 2-3 local bar associations and your state bar lawyer-referral service. Set up lawyers.com / FindLaw / Avvo profiles. Create a Google Business Profile. OUTPUT: Live referral channels.',
        'DAYS 16-25: Contact 20 prior contacts (former colleagues, classmates, prior clients). Let them know you are open for business. Goal: 3 paying client matters within 30 days. OUTPUT: First client matters opened.',
        'DAYS 26-30: Bill first hours through Clio. Send first invoices. Confirm trust deposits clear before withdrawing earned fees. Reconcile IOLTA monthly. OUTPUT: First revenue collected, trust account reconciled.'
      ]
    },
    'multi_attorney_law_firm': {
      label: 'Multi-Attorney Law Firm',
      description: 'A law firm with multiple attorneys, partners, or associates. Examples: small civil litigation firm, boutique practice, multi-practice firm.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$50K-$500K',
      legalNotes: 'Most states allow LLP, PC, or PLLC entities for multi-attorney firms. Partnership agreement essential. Each attorney needs individual bar admission. Firm-level malpractice insurance covers all attorneys. Trust accounting compliance is firm-wide.',
      fundingNotes: 'Partner capital contributions plus working capital line of credit. Some firms use SBA 7(a) for build-out and equipment. Litigation funding can finance contingency cases.',
      operatingNotes: 'Revenue mix typically hourly + contingency + flat fee. Realization rates and collection rates are critical metrics. Partner draws vs. retained earnings need governance.',
      first90: [
        'DAYS 1-7: Engage a law firm formation attorney with multi-state experience. Discuss entity choice (LLP vs. PC vs. PLLC), partnership agreement, and fee splitting. OUTPUT: Formation counsel retained.',
        'DAYS 1-7: Negotiate and sign partnership / shareholder agreement covering capital contributions, profit splits, draws, voting, dissolution, and non-compete. OUTPUT: Signed partnership agreement.',
        'DAYS 8-14: File entity with Secretary of State. Apply for EIN. Register firm with state bar (some states require). Each attorney files individual bar registration. OUTPUT: Entity formed, EIN obtained, bar registration complete.',
        'DAYS 8-14: Open business operating account and IOLTA trust account. Set up signing authority and dual-control for trust withdrawals. OUTPUT: Banking and trust accounts active.',
        'DAYS 15-25: Purchase firm-level legal malpractice insurance ($3M-$10M coverage typical). Add cyber liability policy. Workers comp and disability for employees. OUTPUT: Insurance program in force.',
        'DAYS 15-25: Implement firm-wide practice management (Clio Manage, NetDocuments, or iManage). Configure conflicts, billing, document management, and trust accounting. OUTPUT: Firm tech stack live.',
        'DAYS 26-40: Hire support staff (legal assistant, billing clerk if needed). Run background checks. Confidentiality agreements signed. Training on conflicts and ethics. OUTPUT: Support staff onboarded.',
        'DAYS 26-40: Build referral network: 5 referring attorneys, 3 bar association involvements, 2 professional organizations. Begin BD outreach. OUTPUT: Referral and BD pipeline started.',
        'DAYS 41-60: Open first 10 client matters. Run conflicts on each. Send engagement letters. Confirm retainer deposits. Begin billable work. OUTPUT: First 10 matters open and active.',
        'DAYS 61-90: First monthly billing cycle. Reconcile trust account. Close month-end financials. Review realization, collection, and utilization rates. OUTPUT: First financial close complete.'
      ]
    },
    'regtech_startup': {
      label: 'Regtech / Legaltech Startup',
      description: 'A technology company building software for the legal or compliance market. Examples: contract analysis platform, e-discovery tool, compliance monitoring SaaS, legal AI assistant.',
      capitalIntensity: 'high', regulated: false, typicalStartup: '$250K-$5M+',
      legalNotes: 'C-Corp recommended (Delaware) for venture funding. NOT a law practice — does not provide legal advice. Unauthorized practice of law (UPL) is the largest regulatory risk; review state UPL rules in target markets.',
      fundingNotes: 'Pre-seed and seed funding from angels, accelerators, and VCs. Y Combinator, Bessemer, and a16z have legaltech portfolios. Revenue-based financing also available.',
      operatingNotes: 'Revenue from SaaS subscriptions or transaction fees. Long sales cycles into law firms. Procurement and security review can take 6-12 months. Customer success critical for renewal.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Apply for EIN. Founders sign restricted stock purchase agreements with vesting (typically 4 years, 1-year cliff). 83(b) elections filed within 30 days of issuance. OUTPUT: Entity formed, founder equity vesting.',
        'DAYS 1-7: Engage startup-experienced counsel. Cap table software (Carta or Pulley) set up. OUTPUT: Counsel retained, cap table active.',
        'DAYS 8-14: UPL compliance review. Define what your product does and does NOT do. Add disclaimers in product and marketing. Avoid words like "legal advice", "recommend", or "should". OUTPUT: UPL compliance memo and disclaimers in place.',
        'DAYS 8-14: Open business bank account (Mercury, Brex, or SVB-style). Set up accounting (QuickBooks, Pilot, or Bench). OUTPUT: Banking and accounting active.',
        'DAYS 15-30: Purchase startup insurance bundle: general liability, professional liability, cyber, and D&O. Cyber is critical for legaltech because of confidential client data. OUTPUT: Insurance bundle active.',
        'DAYS 15-30: Build MVP. Onboard 3-5 design partners (law firms or in-house teams) for early validation. Sign mutual NDAs. OUTPUT: MVP shipped to design partners.',
        'DAYS 31-60: Begin SOC 2 readiness (Vanta or Drata). Most law firm customers require SOC 2 Type II for procurement. OUTPUT: SOC 2 program started.',
        'DAYS 31-60: Hire first sales hire or do founder-led sales into 10 target accounts. Demo to legal-ops teams. Iterate product based on feedback. OUTPUT: First sales conversations active.',
        'DAYS 61-90: Close first paying customer. Sign master subscription agreement. Implement billing. Set up customer success workflow. OUTPUT: First revenue, first MSA, first customer onboarded.'
      ]
    },
    'legal_aid_nonprofit': {
      label: 'Legal Aid / Legal Nonprofit',
      description: 'A 501(c)(3) organization providing free or reduced-fee legal services to low-income or marginalized populations. Examples: civil legal aid, immigration legal services, criminal justice reform organization.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$50K-$500K',
      legalNotes: 'Form as state nonprofit corporation, then apply for 501(c)(3) tax-exempt status (IRS Form 1023). LSC (Legal Services Corporation) funding has eligibility requirements. State bar may require nonprofit law-firm registration.',
      fundingNotes: 'IOLTA grants, LSC grants, foundation grants, court-awarded fees, individual donations, lawyer pro bono support. Revenue is grant-based, not earned.',
      operatingNotes: 'Mission-driven. Outcomes measured in clients served, cases closed, and policy impact. Grant reporting and compliance are major operational burdens.',
      first90: [
        'DAYS 1-10: Incorporate as state nonprofit corporation with charitable purpose statement. Adopt bylaws meeting IRS requirements. Recruit founding board (typically 3-5 members). OUTPUT: Nonprofit entity formed with board.',
        'DAYS 1-10: Apply for EIN. Open business bank account and IOLTA trust account at a bar-approved bank. OUTPUT: EIN, operating account, IOLTA.',
        'DAYS 11-25: Prepare and file IRS Form 1023 (Application for 501(c)(3) status). Filing fee $275-$600 depending on organization size. Approval takes 3-9 months. OUTPUT: Form 1023 filed.',
        'DAYS 11-25: Register with state Attorney General charitable solicitation office (most states require). OUTPUT: State charitable registration filed.',
        'DAYS 26-40: Recruit founding executive director (lawyer with management experience preferred) and pro bono coordinator. Run background checks. Confidentiality and conflicts policies signed. OUTPUT: Founding staff hired.',
        'DAYS 26-40: Identify and apply for 3-5 startup grants. Targets: state IOLTA program, community foundations, bar foundations, LSC if eligible. OUTPUT: Initial grant applications submitted.',
        'DAYS 41-60: Implement legal practice management software (LegalServer is the standard for legal aid). Configure intake, conflicts, case management, and grant reporting. OUTPUT: Case management system live.',
        'DAYS 41-60: Open first client matters with strict eligibility screening. Document income verification. OUTPUT: First clients served.',
        'DAYS 61-90: First monthly impact and grant report. Begin building referral relationships with courts, social services, and community organizations. OUTPUT: First impact report, referral network forming.'
      ]
    },
    'compliance_advisory': {
      label: 'Compliance / Regulatory Advisory',
      description: 'A consulting business providing regulatory compliance advisory and audit services to regulated industries. NOT a law practice. Examples: HIPAA compliance consulting, SEC compliance advisory, OSHA safety consulting.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$10K-$50K',
      legalNotes: 'LLC or S-Corp typical. NOT a law firm; cannot give legal advice. Disclaimer must be clear. Industry certifications (e.g., CISA, CHC, CCEP, CIPP) are key credentials. Professional liability insurance required.',
      fundingNotes: 'Self-funded most common. SBA 7(a) loans available. Subscription advisory revenue allows for revenue-based financing.',
      operatingNotes: 'Revenue from retainer-based advisory, audit engagements, and remediation projects. First clients often come from professional networks and certifications.',
      first90: [
        'DAYS 1-5: File LLC with state Secretary of State. Apply for EIN. Open business bank account. OUTPUT: Entity, EIN, banking.',
        'DAYS 1-5: Verify or pursue relevant compliance certifications (CIPP for privacy, CCEP for healthcare/general compliance, CISA for IT audit, CFE for fraud, etc.). OUTPUT: Certification status confirmed or in progress.',
        'DAYS 6-15: Purchase professional liability insurance ($1M-$2M E&O coverage). Add cyber liability. OUTPUT: Insurance active.',
        'DAYS 6-15: Draft service offering: compliance assessment, ongoing advisory retainer, audit prep, and remediation. Set pricing: $200-$500/hr or $5K-$25K/month retainer or $25K-$150K project. OUTPUT: Service catalog and pricing finalized.',
        'DAYS 16-25: Build compliance assessment templates: policy review, control testing, gap analysis, remediation roadmap. OUTPUT: Assessment templates ready.',
        'DAYS 16-25: Outreach to 30 prospects. Target compliance officers, GCs, and CFOs of regulated companies. Offer free 30-minute compliance health check. OUTPUT: 10 health-check meetings booked.',
        'DAYS 26-40: Convert health checks into paying engagements. Send proposals. Sign master services agreements (MSA). Begin first assessment. OUTPUT: First paying engagement.',
        'DAYS 41-60: Deliver first compliance assessment. Provide written report with findings and recommendations. Bill final invoice. Request testimonial and referral. OUTPUT: First engagement delivered.',
        'DAYS 61-90: Convert assessment client to ongoing retainer. Begin building thought leadership: LinkedIn posts, webinars, certification courses. OUTPUT: First retainer signed, thought leadership active.'
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STAGES (simplified)
  // ══════════════════════════════════════════════════════════════════════

  var STAGES = [
    {
      title: 'STAGE 1 - CONCEPT & MARKET',
      sections: [
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
          { id: 'template', label: 'Template', type: 'select', options: ['solo_law_practice', 'multi_attorney_law_firm', 'regtech_startup', 'legal_aid_nonprofit', 'compliance_advisory'] }
        ] }
      ]
    },
    {
      title: 'STAGE 2 - LEGAL & ENTITY',
      sections: [
        { id: 'entity', title: 'Entity Formation', type: 'fields', guidance: 'What legal entity is this?', fields: [
          { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC', 'PLLC', 'PC', 'LLP', 'C-Corp', '501(c)(3)', 'Sole Proprietor'] },
          { id: 'state', label: 'State of formation', type: 'text' },
          { id: 'filing_status', label: 'Filing status', type: 'select', options: ['Not started', 'Drafted', 'Filed', 'Confirmed'] }
        ] },
        { id: 'tax_id', title: 'EIN & Tax Setup', type: 'fields', fields: [
          { id: 'ein', label: 'EIN (last 4 digits)', type: 'text' },
          { id: 'tax_year', label: 'Tax year', type: 'text' }
        ] },
        { id: 'compliance', title: 'Bar / Regulatory Compliance', type: 'textarea', guidance: 'List bar admissions, regulatory licenses, certifications, and compliance obligations.' },
        { id: 'governance', title: 'Governance Documents', type: 'checklist', guidance: 'Confirm each document is drafted and signed.', items: ['Operating agreement / partnership agreement', 'Engagement letter template', 'Conflicts policy', 'Trust accounting policy (if applicable)', 'Employee handbook', 'IP assignment agreements'] },
        { id: 'legal_docs', title: 'Required Legal Documents', type: 'checklist', items: ['State formation filing', 'EIN confirmation letter', 'Bar registration (if law practice)', '501(c)(3) determination (if nonprofit)', 'IOLTA disclosure (if law practice)'] }
      ]
    },
    {
      title: 'STAGE 3 - FINANCIAL SETUP',
      sections: [
        { id: 'banking', title: 'Banking & Trust Accounts', type: 'fields', guidance: 'Set up business operating account and (if law practice) IOLTA trust account.', fields: [
          { id: 'op_bank', label: 'Operating bank', type: 'text' },
          { id: 'iolta_bank', label: 'IOLTA bank (if applicable)', type: 'text' },
          { id: 'reconciliation_freq', label: 'Reconciliation frequency', type: 'select', options: ['Monthly', 'Weekly'] }
        ] },
        { id: 'startup_costs', title: 'Startup Costs', type: 'fields', fields: [
          { id: 'cost_legal', label: 'Legal/formation', type: 'text' },
          { id: 'cost_insurance', label: 'Insurance', type: 'text' },
          { id: 'cost_software', label: 'Practice management software', type: 'text' },
          { id: 'cost_marketing', label: 'Marketing/website', type: 'text' },
          { id: 'cost_working_cap', label: 'Working capital reserve', type: 'text' },
          { id: 'cost_total', label: 'Total startup', type: 'text' }
        ] },
        { id: 'revenue', title: 'Revenue Model', type: 'textarea' },
        { id: 'sources', title: 'Funding Sources', type: 'textarea' },
        { id: 'loan_prep', title: 'Loan Preparation', type: 'textarea' },
        { id: 'financial_docs', title: 'Financial Documents Ready', type: 'checklist', items: ['Startup budget', 'Year 1 cash flow projection', '3-year P&L projection', 'Personal financial statement (for SBA)', 'Tax returns (last 2 years)', 'Loan application packet'] }
      ]
    },
    {
      title: 'STAGE 4 - OPERATIONS',
      sections: [
        { id: 'delivery', title: 'Service Delivery Model', type: 'textarea', guidance: 'How are services delivered? What is the workflow from intake to close?' },
        { id: 'team', title: 'Team', type: 'textarea' },
        { id: 'infrastructure', title: 'Tech Infrastructure', type: 'textarea' },
        { id: 'operating_docs', title: 'Operating Procedures', type: 'checklist', items: ['Intake procedure', 'Conflicts procedure', 'Billing procedure', 'Trust accounting procedure', 'File retention policy', 'Disengagement procedure'] }
      ]
    },
    {
      title: 'STAGE 5 - LAUNCH (FIRST 90 DAYS)',
      sections: [
        { id: 'customers', title: 'Customer Acquisition Plan', type: 'textarea' },
        { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields', fields: [
          { id: 'days_1_30', label: 'Days 1-30', type: 'textarea' },
          { id: 'days_31_60', label: 'Days 31-60', type: 'textarea' },
          { id: 'days_61_90', label: 'Days 61-90', type: 'textarea' }
        ] }
      ]
    },
    {
      title: 'STAGE 6 - LAUNCH READINESS',
      sections: [
        { id: 'readiness', title: 'Launch Readiness Checklist', type: 'checklist', items: ['Legal entity formed and EIN issued', 'Bar admission / professional license active (if applicable)', 'Banking and trust accounts open', 'Insurance in force', 'Practice management software live', 'Engagement letter and conflicts process tested', 'First clients identified', '90-day plan documented'] },
        { id: 'review', title: 'Final Review', type: 'review' }
      ]
    },
    {
      title: 'STAGE 7 - AUDITOR DECISION',
      sections: [
        { id: 'auditor', title: 'Auditor Decision', type: 'auditor' }
      ]
    }
  ];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

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
        ws.fields['concept']['name'] = prefill.businessType + ' PLLC';
      }
      if (prefill.reason) ws.fields['concept']['full_desc'] = prefill.reason;
    }

    var tmplKey = ws.fields && ws.fields['biz_type'] && ws.fields['biz_type']['template'];
    if (!tmplKey && prefill && prefill.businessType) {
      var bt = (prefill.businessType || '').toLowerCase();
      if (bt.indexOf('legal aid') !== -1 || bt.indexOf('501') !== -1 || bt.indexOf('nonprofit') !== -1) tmplKey = 'legal_aid_nonprofit';
      else if (bt.indexOf('regtech') !== -1 || bt.indexOf('legaltech') !== -1 || bt.indexOf('platform') !== -1 || bt.indexOf('saas') !== -1 || bt.indexOf('software') !== -1) tmplKey = 'regtech_startup';
      else if (bt.indexOf('compliance') !== -1 || bt.indexOf('advisory') !== -1 || bt.indexOf('consulting') !== -1) tmplKey = 'compliance_advisory';
      else if (bt.indexOf('firm') !== -1 || bt.indexOf('boutique') !== -1 || bt.indexOf('practice') !== -1) tmplKey = 'multi_attorney_law_firm';
      else tmplKey = 'solo_law_practice';
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
    h += '<span style="font-size:0.26rem;color:#706860">' + (mode === 'operator' ? 'Simplified guided flow \u2014 confirm what we built for you' : 'Full access \u2014 all sections, all fields, all detail') + '</span>';
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
      for (var ssi = 0; ssi < stageSections.length; ssi++) {
        h += renderField(stageSections[ssi], ws);
      }
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
      header.addEventListener('click', function () {
        body.classList.toggle('open');
        var t = header.querySelector('.eep-toggle');
        if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC';
      });
    }

    var ws = getWs(oppKey) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };

    panel.querySelectorAll('.eep-textarea, .eep-input, .eep-select').forEach(function (el) {
      el.addEventListener('change', function () {
        var field = this.getAttribute('data-field');
        var aud = this.getAttribute('data-auditor');
        if (field) {
          var p = field.split('.');
          if (typeof ws.fields[p[0]] !== 'object') ws.fields[p[0]] = {};
          ws.fields[p[0]][p[1]] = this.value;
        }
        if (aud) {
          ws.auditor = ws.auditor || {};
          ws.auditor[aud] = this.value;
        }
        saveWs(oppKey, ws);
      });
    });

    panel.querySelectorAll('.eep-check').forEach(function (el) {
      el.addEventListener('change', function () {
        var sec = this.getAttribute('data-sec'), item = this.getAttribute('data-item');
        if (!ws.checks[sec]) ws.checks[sec] = {};
        ws.checks[sec][item] = this.checked;
        saveWs(oppKey, ws);
      });
    });

    panel.querySelectorAll('.eep-done-check').forEach(function (el) {
      el.addEventListener('change', function () {
        if (!ws.sectionDone) ws.sectionDone = {};
        ws.sectionDone[this.getAttribute('data-sec')] = this.checked;
        saveWs(oppKey, ws);
      });
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

  window.LIMENLawBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[LawBusinessBuild] loaded \u2014 7 stages, 5 law-native templates');
})();
