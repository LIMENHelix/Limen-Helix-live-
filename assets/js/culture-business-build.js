/**
 * environment-business-build.js — BUSINESS BUILD Execution Workspace (Science)
 *
 * Environment-native business launch system. Stages with environment-native templates
 * (culture startup, instrument vendor, biotech spinout, regtech-for-research,
 * lab services). 90-day execution plan, printable launch packet.
 *
 * Culture domain only.
 * Exposes: window.LIMENCultureBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isCulture = _dom === 'culture' || _dom === 'culture';
  var isWorkspace = window.location.pathname.indexOf('culture-workspace') !== -1;
  if (!isCulture && !isWorkspace) return;

  var STORE_KEY = 'limen_culture_business_build';
  var MODE_KEY = 'limen_sbb_mode';

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
    'university_spinout': {
      label: 'University Culture Spinout',
      description: 'A startup formed to commercialize university-developed IP. Typically licensed from a university tech transfer office (TTO) and spun out by faculty inventors and entrepreneurial CEOs.',
      capitalIntensity: 'high', regulated: false, typicalStartup: '$500K-$10M+',
      legalNotes: 'Delaware C-Corp standard. Founders sign restricted stock with 4-year vest, 1-year cliff. University TTO holds equity (typically 5-15%) and exclusive license. 83(b) elections within 30 days. SAFE/seed rounds typical.',
      fundingNotes: 'NSF I-Corps, SBIR Phase I/II ($275K-$2M), university gap funds, pre-seed angels, life culture VCs.',
      operatingNotes: 'Long timelines from formation to revenue. R&D heavy. Patent prosecution and tech transfer license terms are core operational concerns.',
      first90: [
        'DAYS 1-7: Engage startup-experienced counsel familiar with university IP licensing. Discuss founder equity, university royalty terms, and SAFE/preferred structures. OUTPUT: Counsel retained.',
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares with vesting schedule. File 83(b) elections within 30 days of share issuance. OUTPUT: Entity formed, founder equity vesting.',
        'DAYS 8-14: Sign exclusive license with university TTO. Negotiate royalty rates, milestones, and equity carve-out. OUTPUT: Executed license agreement.',
        'DAYS 8-14: Apply for EIN. Open business bank account (Mercury/Brex/SVB). Set up accounting (QuickBooks/Pilot). OUTPUT: EIN and banking active.',
        'DAYS 15-30: File provisional or non-provisional patent applications via university TTO if not already filed. Begin freedom-to-operate analysis. OUTPUT: IP protected.',
        'DAYS 15-30: Apply for SBIR Phase I (NIH or NSF) and/or NSF I-Corps. Prepare proposal team. OUTPUT: SBIR/I-Corps proposal in progress.',
        'DAYS 31-60: Recruit advisory board (technical advisors + business advisors). Sign advisor agreements with equity grants. OUTPUT: Advisory board formed.',
        'DAYS 31-60: Build minimum viable product/prototype. Demonstrate proof of concept. OUTPUT: Working prototype or MVP demo.',
        'DAYS 61-90: Begin pre-seed/seed fundraising. Pitch to angel networks and life culture VCs. Target $250K-$1M. OUTPUT: First investor commitments.'
      ]
    },
    'instrument_vendor': {
      label: 'Scientific Instrument / Reagent Vendor',
      description: 'A company that designs, manufactures, and sells laboratory equipment, reagents, or consumables to culture labs. Examples: assay kits, fluidics, custom oligos, antibody panels.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$250K-$5M+',
      legalNotes: 'LLC or C-Corp. ISO 9001 quality system if selling internationally. CE marking for EU. Some products require FDA clearance (IVD, RUO labels matter).',
      fundingNotes: 'Self-funded, SBA 7(a) ($100K-$5M), equipment financing, climate tech VCs.',
      operatingNotes: 'Long sales cycles into culture labs. Procurement through university purchasing. Trade shows (SLAS, Pittcon, AACR) drive lead generation.',
      first90: [
        'DAYS 1-7: Form entity (LLC or C-Corp). Apply for EIN. Open business bank account. OUTPUT: Entity, EIN, banking.',
        'DAYS 1-7: Engage product liability and IP counsel familiar with scientific instruments. OUTPUT: Counsel retained.',
        'DAYS 8-14: Define product specifications: target user, intended use, label claims (RUO vs IVD). For IVD products, this determines FDA pathway. OUTPUT: Product specifications and label claim documented.',
        'DAYS 8-14: Establish quality management system (QMS) framework. ISO 9001 baseline minimum. OUTPUT: QMS framework in place.',
        'DAYS 15-30: Build pilot production line. Validate manufacturing process. Document SOPs for production, QC, and shipping. OUTPUT: Pilot production validated.',
        'DAYS 15-30: Set up product testing protocols (analytical validation: linearity, precision, specificity, sensitivity). OUTPUT: Validation protocols complete.',
        'DAYS 31-60: Identify 5-10 beta customer labs. Offer free samples in exchange for feedback and early case studies. OUTPUT: Beta program active.',
        'DAYS 31-60: Set up distribution: direct sales, distributor agreements, online marketplace listings (Sigma, Thermo Marketplace). OUTPUT: Distribution channels live.',
        'DAYS 61-90: Launch at relevant trade show or via scientific journal product highlights. Begin paid customer onboarding. OUTPUT: First commercial sales.'
      ]
    },
    'research_software': {
      label: 'Culture Software / Informatics SaaS',
      description: 'A SaaS company building software for culture labs. Examples: ELN, LIMS, bioinformatics, AI-for-science, lab automation, reproducibility tools.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$100K-$2M',
      legalNotes: 'Delaware C-Corp standard. SOC 2 Type II often required for university and pharma customers. HIPAA if handling patient data. Security review and IT procurement common.',
      fundingNotes: 'Pre-seed angels, SaaS-focused VCs, climate tech VCs. SBIR for environment-specific tools.',
      operatingNotes: 'Long sales cycles into universities (12-18 months from first contact to PO). Annual contracts typical. Procurement and security review can take 6 months.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares with vesting. File 83(b) within 30 days. OUTPUT: Entity, founder equity active.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Set up accounting. OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Build MVP. Onboard 3-5 design partners (university labs or core facilities) for early validation. Sign mutual NDAs. OUTPUT: MVP shipped to design partners.',
        'DAYS 8-14: Purchase startup insurance (general liability, professional liability, cyber liability, D&O). OUTPUT: Insurance bundle active.',
        'DAYS 15-30: Begin SOC 2 readiness (Vanta or Drata). Most academic and pharma customers require SOC 2 for procurement. OUTPUT: SOC 2 program started.',
        'DAYS 15-30: Set up subscription billing (Stripe, Chargebee). Define pricing tiers (per-seat, per-lab, institution-wide). OUTPUT: Billing infrastructure live.',
        'DAYS 31-60: Hire first sales hire (or do founder-led sales) into 10 target accounts. Demo to PIs, lab managers, and core facility directors. OUTPUT: First sales conversations active.',
        'DAYS 31-60: Iterate product based on design partner feedback. OUTPUT: Product v0.2 with feedback incorporated.',
        'DAYS 61-90: Close first paying customer. Sign master subscription agreement. Implement billing. Set up customer success workflow. OUTPUT: First revenue, first MSA, first customer onboarded.'
      ]
    },
    'cro_lab_service': {
      label: 'Contract Culture Organization (CRO) / Lab Service',
      description: 'A service business that performs experiments or analyses on behalf of other labs. Examples: sequencing service, mass spec analysis, custom synthesis, animal model service, clinical trial CRO.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$500K-$5M+',
      legalNotes: 'LLC or C-Corp. GLP compliance for regulatory studies. GCP for clinical trials. AAALAC accreditation for animal facilities. CLIA if running clinical assays.',
      fundingNotes: 'Self-funded, SBA loans for equipment, equipment financing, climate tech VCs for scale-up.',
      operatingNotes: 'Operational excellence is everything. Repeat business and contracts depend on quality, turnaround time, and pricing.',
      first90: [
        'DAYS 1-7: Form entity (LLC for early stage, C-Corp for VC-track). Apply for EIN. Open business bank account. OUTPUT: Entity and banking active.',
        'DAYS 1-7: Engage counsel familiar with regulated lab services (GLP, GCP, CLIA as applicable). OUTPUT: Counsel retained.',
        'DAYS 8-14: Lease lab space appropriate for the service offering. For BSL-2/3, ensure facility certifications. OUTPUT: Lab space secured.',
        'DAYS 8-14: Procure core instrumentation. Begin instrument validation (IQ/OQ/PQ). OUTPUT: Equipment installed and qualified.',
        'DAYS 15-30: Establish quality management system. Write SOPs for all service offerings, sample handling, data delivery. OUTPUT: QMS and SOP library complete.',
        'DAYS 15-30: Apply for relevant accreditations (CAP, CLIA, AAALAC, ISO 17025) as appropriate. OUTPUT: Accreditation applications submitted.',
        'DAYS 31-60: Hire technical staff (PhD-level for science, technicians for execution). Background checks and confidentiality agreements. OUTPUT: Initial team hired.',
        'DAYS 31-60: Set up customer-facing portal: quote request, sample submission, results delivery. OUTPUT: Customer portal live.',
        'DAYS 61-90: Run first paid jobs. Document turnaround times and quality metrics. Request testimonials. OUTPUT: First paying customers and quality metrics tracked.'
      ]
    },
    'research_consultancy': {
      label: 'Culture Consultancy / Scientific Advisory',
      description: 'A consulting business providing scientific or methodological advisory services to culture organizations, biotech, or pharma. Examples: statistical consulting, clinical trial design, biomarker strategy.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$10K-$50K',
      legalNotes: 'LLC or S-Corp typical. Professional liability insurance (E&O) required. NDAs and consulting agreements per engagement.',
      fundingNotes: 'Self-funded most common. First clients usually come from existing scientific networks.',
      operatingNotes: 'Revenue from billable hours, retainers, or project-based fees. Reputation and network are everything.',
      first90: [
        'DAYS 1-5: File LLC or S-Corp with Secretary of State. Apply for EIN. Open business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Verify any required certifications (ASA for stats, ASCB membership, etc.). OUTPUT: Certifications confirmed.',
        'DAYS 6-15: Purchase professional liability insurance ($1M-$2M E&O). Add general liability. OUTPUT: Insurance active.',
        'DAYS 6-15: Draft service catalog: assessment, retainer advisory, project-based engagements. Set rates ($200-$500/hr or $5K-$25K/month retainer). OUTPUT: Service catalog finalized.',
        'DAYS 16-25: Build templates: NDAs, consulting agreements, statements of work, project deliverables. OUTPUT: Templates ready.',
        'DAYS 16-25: Outreach to 30 prospects in your network. Offer free 30-min consultation. OUTPUT: 10 consultations booked.',
        'DAYS 26-40: Convert consultations into paid engagements. Send proposals. Sign master services agreements. OUTPUT: First paying engagements.',
        'DAYS 41-60: Deliver first engagements. Bill on time. Request testimonials and referrals. OUTPUT: First engagements delivered.',
        'DAYS 61-90: Convert one-off engagements into ongoing retainers. Begin building thought leadership (LinkedIn, scientific blog, conference talks). OUTPUT: First retainer signed.'
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
        { id: 'template', label: 'Template', type: 'select', options: ['university_spinout', 'instrument_vendor', 'research_software', 'cro_lab_service', 'research_consultancy'] }
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
      { id: 'compliance', title: 'Culture / Regulatory Compliance', type: 'textarea', guidance: 'IRB / IACUC / IBC / GLP / GCP / CLIA / FDA requirements as applicable.' },
      { id: 'governance', title: 'Governance Documents', type: 'checklist', items: ['Operating agreement / shareholder agreement', 'Founder vesting / restricted stock', '83(b) election filed (if applicable)', 'Engagement / consulting templates', 'NDAs', 'IP assignment agreements', 'University license agreement (if applicable)'] },
      { id: 'legal_docs', title: 'Required Legal Documents', type: 'checklist', items: ['State formation filing', 'EIN confirmation', 'Insurance policies', 'University TTO license (if spinout)', 'Provisional / non-provisional patent applications'] }
    ] },
    { title: 'STAGE 3 - FINANCIAL SETUP', sections: [
      { id: 'banking', title: 'Banking & Accounting', type: 'fields', fields: [
        { id: 'op_bank', label: 'Operating bank', type: 'text' },
        { id: 'accounting_software', label: 'Accounting software', type: 'select', options: ['QuickBooks Online', 'Pilot', 'Bench', 'Other'] }
      ] },
      { id: 'startup_costs', title: 'Startup Costs', type: 'fields', fields: [
        { id: 'cost_legal', label: 'Legal/formation', type: 'text' },
        { id: 'cost_insurance', label: 'Insurance', type: 'text' },
        { id: 'cost_equipment', label: 'Equipment / lab buildout', type: 'text' },
        { id: 'cost_software', label: 'Software / IT', type: 'text' },
        { id: 'cost_personnel', label: 'Personnel (3-month runway)', type: 'text' },
        { id: 'cost_total', label: 'Total startup', type: 'text' }
      ] },
      { id: 'revenue', title: 'Revenue Model', type: 'textarea' },
      { id: 'sources', title: 'Funding Sources', type: 'textarea' },
      { id: 'loan_prep', title: 'Grant / Loan Preparation', type: 'textarea' },
      { id: 'financial_docs', title: 'Financial Documents Ready', type: 'checklist', items: ['Startup budget', 'Year 1 cash flow projection', '3-year P&L projection', 'SBIR Phase I/II proposal (if applicable)', 'Cap table (if VC track)', 'Pitch deck'] }
    ] },
    { title: 'STAGE 4 - OPERATIONS', sections: [
      { id: 'delivery', title: 'Service / Product Delivery Model', type: 'textarea' },
      { id: 'team', title: 'Team', type: 'textarea' },
      { id: 'infrastructure', title: 'Tech / Lab Infrastructure', type: 'textarea' },
      { id: 'operating_docs', title: 'Operating Procedures', type: 'checklist', items: ['Customer intake / quote process', 'Standard operating procedures (SOPs)', 'Quality management system', 'Sample / data handling protocols', 'Billing and invoicing', 'Customer support workflow'] }
    ] },
    { title: 'STAGE 5 - LAUNCH (FIRST 90 DAYS)', sections: [
      { id: 'customers', title: 'Customer Acquisition Plan', type: 'textarea' },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields', fields: [
        { id: 'days_1_30', label: 'Days 1-30', type: 'textarea' },
        { id: 'days_31_60', label: 'Days 31-60', type: 'textarea' },
        { id: 'days_61_90', label: 'Days 61-90', type: 'textarea' }
      ] }
    ] },
    { title: 'STAGE 6 - LAUNCH READINESS', sections: [
      { id: 'readiness', title: 'Launch Readiness Checklist', type: 'checklist', items: ['Legal entity formed and EIN issued', 'Banking and accounting active', 'Insurance in force', 'Compliance / accreditation in place', 'Founder/team vesting active', 'IP assignments signed', 'First customers / pilots identified', '90-day plan documented'] },
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
      if (bt.indexOf('spinout') !== -1 || bt.indexOf('university') !== -1 || bt.indexOf('tech transfer') !== -1) tmplKey = 'university_spinout';
      else if (bt.indexOf('instrument') !== -1 || bt.indexOf('reagent') !== -1 || bt.indexOf('vendor') !== -1) tmplKey = 'instrument_vendor';
      else if (bt.indexOf('saas') !== -1 || bt.indexOf('software') !== -1 || bt.indexOf('platform') !== -1 || bt.indexOf('eln') !== -1 || bt.indexOf('lims') !== -1) tmplKey = 'research_software';
      else if (bt.indexOf('cro') !== -1 || bt.indexOf('contract research') !== -1 || bt.indexOf('lab service') !== -1 || bt.indexOf('clinical trial') !== -1) tmplKey = 'cro_lab_service';
      else tmplKey = 'research_consultancy';
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

  window.LIMENCultureBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[EnvironmentBusinessBuild] loaded \u2014 7 stages, 5 environment-native templates');
})();
