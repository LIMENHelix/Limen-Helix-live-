/**
 * education-business-build.js — BUSINESS BUILD Execution Workspace (Education)
 *
 * Education-native business launch system. Stages with education-native templates
 * (k12 district services, higher-ed institution, edtech startup, ed consultancy,
 * charter / micro-school operator). 90-day execution plan, printable launch packet.
 *
 * Education domain only.
 * Exposes: window.LIMENEducationBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isEducation = _dom === 'education';
  var isWorkspace = window.location.pathname.indexOf('education-workspace') !== -1;
  if (!isEducation && !isWorkspace) return;

  var STORE_KEY = 'limen_education_business_build';
  var MODE_KEY = 'limen_ebb_mode';

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
    'edtech_startup': {
      label: 'EdTech SaaS Startup',
      description: 'A SaaS company building software for K-12 schools, districts, or higher-ed institutions. Examples: LMS, SIS, assessment platforms, classroom engagement tools, AI tutoring.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$100K-$2M',
      legalNotes: 'Delaware C-Corp standard. SOC 2 Type II + COPPA + FERPA + state student data privacy laws (CA SOPIPA, NY Ed Law 2-d, etc.) are non-negotiable for school customers. Student Privacy Pledge signature standard.',
      fundingNotes: 'Pre-seed angels, edtech-focused VCs (Reach Capital, GSV, Owl Ventures, Rethink Education), SBIR for ed research tools, ED IES grants.',
      operatingNotes: 'Long sales cycles (6-18 months district adoption). Procurement runs through purchasing offices. Free pilot \u2192 paid annual contract is the standard motion. Summer is the buying season.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares with 4-year vesting, 1-year cliff. File 83(b) within 30 days. OUTPUT: Entity, founder equity active.',
        'DAYS 1-7: Apply for EIN. Open business bank account (Mercury, Brex, SVB). Set up accounting (QuickBooks, Pilot). OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Build MVP. Sign 3-5 design partner schools (free pilot, mutual NDA, data processing addendum). OUTPUT: MVP shipped to design partners.',
        'DAYS 8-14: Sign Student Privacy Pledge. Draft FERPA-compliant data processing addendum and privacy policy. OUTPUT: Privacy posture documented.',
        'DAYS 15-30: Begin SOC 2 Type I readiness (Vanta, Drata, or Secureframe). Required by most district IT departments. OUTPUT: SOC 2 program kicked off.',
        'DAYS 15-30: Set up subscription billing (Stripe, Chargebee). Define pricing (per-student, per-classroom, per-school, district-wide). OUTPUT: Billing infrastructure live.',
        'DAYS 31-60: Run design-partner pilots. Iterate weekly on teacher feedback. Document case studies and outcome metrics. OUTPUT: 3 case studies in hand.',
        'DAYS 31-60: Apply for ISTE Seal of Alignment, Common Sense Education review, or relevant edtech quality marks. OUTPUT: Quality review submitted.',
        'DAYS 61-90: Convert first design partner into a paid annual contract. Sign master subscription agreement with FERPA addendum. OUTPUT: First revenue, first MSA, first paying district.'
      ]
    },
    'k12_district_services': {
      label: 'K-12 District Services Provider',
      description: 'A services company contracting with K-12 districts. Examples: tutoring providers, after-school programs, special education service providers, transportation, food service, professional development for teachers.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$50K-$500K',
      legalNotes: 'LLC or S-Corp common. State vendor registration required in each state. Background checks and fingerprinting for all staff entering schools. Certificate of insurance ($1M-$5M general + professional liability) typically required by districts.',
      fundingNotes: 'Title I, Title II, Title IV federal funds (via districts). ESSER funds (sunsetting). State-funded tutoring grants. Self-funded launch typical.',
      operatingNotes: 'RFP-driven sales. Contracts run on academic year. Payment terms 30-60 days from districts. Background-check compliance is the gating operational concern.',
      first90: [
        'DAYS 1-7: Form entity (LLC or S-Corp). Apply for EIN. Open business bank account. OUTPUT: Entity and banking active.',
        'DAYS 1-7: Register as vendor with target state(s) and target district(s). Obtain DUNS/SAM.gov registration if pursuing federal funds. OUTPUT: Vendor registrations submitted.',
        'DAYS 8-14: Purchase insurance bundle: general liability ($1M-$2M), professional liability, workers comp, auto if transportation. OUTPUT: Insurance certificates ready for districts.',
        'DAYS 8-14: Establish background check + fingerprinting workflow for all staff (state DOJ + FBI). Document the policy. OUTPUT: Background check policy live.',
        'DAYS 15-30: Build service delivery model: staff ratios, hours, scheduling, supervision. Document SOPs and safety protocols. OUTPUT: Service catalog and SOPs.',
        'DAYS 15-30: Hire and clear initial cohort of staff. Verify credentials, run background checks, complete onboarding. OUTPUT: First team trained and cleared.',
        'DAYS 31-60: Outreach to 10-20 target districts. Meet with curriculum directors, special-ed coordinators, or program leads. OUTPUT: 10 district conversations active.',
        'DAYS 31-60: Respond to 3-5 active RFPs or submit unsolicited proposals. OUTPUT: First proposals submitted.',
        'DAYS 61-90: Sign first district contract. Onboard students. Begin tracking outcome metrics (attendance, growth, satisfaction). OUTPUT: First paying district, first cohort served.'
      ]
    },
    'higher_ed_services': {
      label: 'Higher-Ed Institutional Services',
      description: 'A company providing services to colleges, universities, or university systems. Examples: enrollment marketing (OPM), retention software, advising services, financial aid optimization, online program management.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$250K-$5M',
      legalNotes: 'Delaware C-Corp standard. Title IV / DOE incentive compensation rules ban revenue-share for student recruitment except inside narrow OPM safe harbors (now under ED scrutiny). FERPA and GLBA Safeguards Rule apply. State authorization (SARA) for any student-facing service.',
      fundingNotes: 'Higher-ed VCs, growth equity (University Ventures, Owl Ventures), self-funded. ED postsecondary grants. SBIR rare for higher-ed services.',
      operatingNotes: 'Long sales cycles (12-24 months). Provost / VP enrollment / VP student affairs are the buyers. Annual contracts with auto-renew clauses standard. RFP-driven for larger systems.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares with vesting. File 83(b). OUTPUT: Entity formed.',
        'DAYS 1-7: Engage counsel familiar with Title IV / 90-10 rule / incentive compensation ban / Bundled Services rules. OUTPUT: Higher-ed counsel retained.',
        'DAYS 8-14: Apply for EIN. Open business bank account. Set up accounting. OUTPUT: Banking and accounting live.',
        'DAYS 8-14: Draft FERPA-compliant data processing addendum and privacy policy. Document GLBA Safeguards posture. OUTPUT: Privacy posture documented.',
        'DAYS 15-30: Begin SOC 2 Type I readiness (Vanta, Drata). Required by most university IT and procurement. OUTPUT: SOC 2 program started.',
        'DAYS 15-30: Build service delivery model. Define pricing (subscription, per-student, per-program, fixed-fee). Confirm pricing avoids prohibited incentive compensation. OUTPUT: Pricing model documented.',
        'DAYS 31-60: Sign 2-3 design partner institutions. Offer pilot pricing. Mutual NDAs and data processing addenda. OUTPUT: Pilots in progress.',
        'DAYS 31-60: Apply for state authorization (SARA) if students will receive direct services across state lines. OUTPUT: SARA application submitted.',
        'DAYS 61-90: Convert first pilot to paid annual contract. Sign MSA with FERPA + GLBA addenda. Begin outcome reporting. OUTPUT: First revenue, first paying institution.'
      ]
    },
    'charter_microschool': {
      label: 'Charter / Micro-School Operator',
      description: 'A company that operates one or more schools directly. Examples: charter schools, private micro-schools, hybrid homeschool centers, virtual schools, learning pods.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$500K-$5M+',
      legalNotes: 'State-specific. Charter requires authorizer approval (state, district, or university authorizer). Private schools require state accreditation/registration. ESEA, IDEA, and state special-ed obligations apply once enrolling students. State teacher certification rules apply.',
      fundingNotes: 'Per-pupil public funding (charter), tuition (private), Charter Schools Program federal grant, foundation grants (Walton, Charter School Growth Fund), New Markets Tax Credit financing, facility loans.',
      operatingNotes: 'Authorizer relationship is the most important operational concern. Annual reporting, financial audits, academic performance benchmarks. Enrollment and retention are everything financially.',
      first90: [
        'DAYS 1-15: Engage counsel familiar with state charter law or private school regulation. OUTPUT: Education counsel retained.',
        'DAYS 1-15: Form non-profit entity (501(c)(3)) for charter or LLC for private/micro-school. Apply for EIN. OUTPUT: Entity formed.',
        'DAYS 16-30: For charter: prepare and submit charter application to authorizer. Curriculum plan, governance, financial plan, facility plan. OUTPUT: Charter application submitted.',
        'DAYS 16-30: For private/micro: begin state registration / approval process. Prepare facilities and curriculum documentation. OUTPUT: State approval in progress.',
        'DAYS 31-45: Identify and secure facility. Negotiate lease or purchase. Confirm zoning and occupancy permits for educational use. OUTPUT: Facility under contract.',
        'DAYS 31-45: Recruit founding board (charter) or advisory board (private). Sign board member agreements. OUTPUT: Governance body in place.',
        'DAYS 46-60: Recruit founding teachers. Verify state certification, run background checks, sign employment contracts. OUTPUT: Founding faculty hired.',
        'DAYS 46-60: Begin family recruitment / enrollment campaign. Open houses, info nights, application portal. OUTPUT: Enrollment pipeline active.',
        'DAYS 61-90: Final inspections, occupancy permits, fire/safety, food service, transportation arrangements. Confirm authorizer/state final approvals. OUTPUT: Ready to open for first day of school.'
      ]
    },
    'ed_consultancy': {
      label: 'Education Consultancy / Advisory',
      description: 'A consulting business providing strategic, instructional, policy, or curriculum advisory to schools, districts, universities, or edtech companies. Examples: curriculum consulting, school improvement, equity consulting, instructional coaching, policy analysis.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$5K-$50K',
      legalNotes: 'LLC or S-Corp typical. Professional liability (E&O) insurance recommended. State vendor registration in target states. NDAs and consulting agreements per engagement.',
      fundingNotes: 'Self-funded most common. First clients usually come from existing professional networks (former superintendents, former principals, former faculty).',
      operatingNotes: 'Revenue from billable hours, retainers, or project-based fees. Reputation, network, and case studies are everything. Title I, Title II, ESSER, and state set-aside funds often fund the work.',
      first90: [
        'DAYS 1-5: File LLC or S-Corp with Secretary of State. Apply for EIN. Open business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Register as vendor in target state(s) and target district(s). DUNS/SAM.gov if pursuing federal-funded contracts. OUTPUT: Vendor registrations submitted.',
        'DAYS 6-15: Purchase professional liability ($1M-$2M E&O) and general liability insurance. OUTPUT: Insurance active.',
        'DAYS 6-15: Draft service catalog: school improvement audits, instructional coaching, curriculum review, professional development, equity audits. Set rates ($150-$400/hr or $5K-$50K project). OUTPUT: Service catalog finalized.',
        'DAYS 16-25: Build templates: NDAs, MSAs, statements of work, project deliverables. OUTPUT: Templates ready.',
        'DAYS 16-25: Outreach to 30 prospects (superintendents, principals, curriculum directors, edtech founders). Offer free 30-min consultation. OUTPUT: 10 consultations booked.',
        'DAYS 26-40: Convert consultations into paid engagements. Send proposals. Sign MSAs. OUTPUT: First paying engagements.',
        'DAYS 41-60: Deliver first engagements. Bill on time (NET 30 districts, NET 15 startups). Request testimonials and referrals. OUTPUT: First engagements delivered.',
        'DAYS 61-90: Convert one-off engagements into ongoing retainers. Build thought leadership (LinkedIn, EdSurge, EdWeek bylines, conference talks). OUTPUT: First retainer signed.'
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
        { id: 'template', label: 'Template', type: 'select', options: ['edtech_startup', 'k12_district_services', 'higher_ed_services', 'charter_microschool', 'ed_consultancy'] }
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
      { id: 'compliance', title: 'Education Regulatory Compliance', type: 'textarea', guidance: 'FERPA / COPPA / GLBA / Title IV / state student data privacy laws / state vendor registration / authorizer rules as applicable.' },
      { id: 'governance', title: 'Governance Documents', type: 'checklist', items: ['Operating agreement / shareholder agreement', 'Founder vesting / restricted stock', '83(b) election filed (if applicable)', 'Engagement / consulting templates', 'NDAs', 'IP assignment agreements', 'Student data processing addendum (FERPA)'] },
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
        { id: 'cost_facility', label: 'Facility / classroom buildout', type: 'text' },
        { id: 'cost_software', label: 'Software / IT', type: 'text' },
        { id: 'cost_personnel', label: 'Personnel (3-month runway)', type: 'text' },
        { id: 'cost_total', label: 'Total startup', type: 'text' }
      ] },
      { id: 'revenue', title: 'Revenue Model', type: 'textarea' },
      { id: 'sources', title: 'Funding Sources', type: 'textarea' },
      { id: 'loan_prep', title: 'Grant / Loan Preparation', type: 'textarea' },
      { id: 'financial_docs', title: 'Financial Documents Ready', type: 'checklist', items: ['Startup budget', 'Year 1 cash flow projection', '3-year P&L projection', 'Title I / II / IV grant applications (if applicable)', 'Cap table (if VC track)', 'Pitch deck'] }
    ] },
    { title: 'STAGE 4 - OPERATIONS', sections: [
      { id: 'delivery', title: 'Service / Product Delivery Model', type: 'textarea' },
      { id: 'team', title: 'Team', type: 'textarea' },
      { id: 'infrastructure', title: 'Tech / Facility Infrastructure', type: 'textarea' },
      { id: 'operating_docs', title: 'Operating Procedures', type: 'checklist', items: ['Customer / district intake process', 'Standard operating procedures (SOPs)', 'Background-check + safety protocols', 'Student data handling protocols', 'Billing and invoicing', 'Customer support workflow'] }
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
      { id: 'readiness', title: 'Launch Readiness Checklist', type: 'checklist', items: ['Legal entity formed and EIN issued', 'Banking and accounting active', 'Insurance in force', 'FERPA / COPPA / state privacy compliance verified', 'Background check policy active', 'Founder/team vesting active', 'First customers / pilots identified', '90-day plan documented'] },
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
      if (bt.indexOf('charter') !== -1 || bt.indexOf('micro-school') !== -1 || bt.indexOf('microschool') !== -1 || bt.indexOf('virtual school') !== -1 || bt.indexOf('learning pod') !== -1) tmplKey = 'charter_microschool';
      else if (bt.indexOf('district') !== -1 || bt.indexOf('tutoring') !== -1 || bt.indexOf('after-school') !== -1 || bt.indexOf('special education service') !== -1 || bt.indexOf('professional development') !== -1) tmplKey = 'k12_district_services';
      else if (bt.indexOf('university') !== -1 || bt.indexOf('higher ed') !== -1 || bt.indexOf('college') !== -1 || bt.indexOf('opm') !== -1 || bt.indexOf('enrollment') !== -1 || bt.indexOf('retention') !== -1) tmplKey = 'higher_ed_services';
      else if (bt.indexOf('saas') !== -1 || bt.indexOf('software') !== -1 || bt.indexOf('platform') !== -1 || bt.indexOf('lms') !== -1 || bt.indexOf('sis') !== -1 || bt.indexOf('edtech') !== -1 || bt.indexOf('app') !== -1) tmplKey = 'edtech_startup';
      else tmplKey = 'ed_consultancy';
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

  window.LIMENEducationBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[EducationBusinessBuild] loaded \u2014 7 stages, 5 education-native templates');
})();
