/**
 * education-business-build.js — BUSINESS BUILD Execution Workspace (Education)
 *
 * Technology-native business launch system. Stages with technology-native templates
 * (B2B SaaS, cybersecurity vendor, AI infrastructure, devtools / open source,
 * technology consultancy). 90-day execution plan, printable launch packet.
 *
 * Education domain only.
 * Exposes: window.LIMENTechnologyBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isTechnology = _dom === 'technology';
  var isWorkspace = window.location.pathname.indexOf('technology-workspace') !== -1;
  if (!isTechnology && !isWorkspace) return;

  var STORE_KEY = 'limen_technology_business_build';
  var MODE_KEY = 'limen_tbb_mode';

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
    'saas_startup': {
      label: 'B2B SaaS Startup',
      description: 'A software-as-a-service company selling to enterprise or mid-market customers. Examples: vertical SaaS, dev tools, data infrastructure, workflow automation, AI platforms.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$250K-$5M',
      legalNotes: 'Delaware C-Corp standard. SOC 2 Type II expected by enterprise buyers. GDPR / CCPA compliance for EU or California customers. HIPAA if handling PHI. DPAs required by most mid-market.',
      fundingNotes: 'Pre-seed angels, seed funds (Y Combinator, a16z, Sequoia, Founders Fund), SBIR for deep-tech. ARR-based valuations.',
      operatingNotes: 'PLG or sales-led motion. Self-serve + enterprise tiers. Customer success is everything. Net revenue retention is the NSM.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Issue founder shares with 4-year vesting, 1-year cliff. File 83(b) within 30 days. OUTPUT: Entity, founder equity active.',
        'DAYS 1-7: Apply for EIN. Open business bank account (Mercury, Brex, SVB). Set up accounting (QuickBooks, Pilot). OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Build MVP. Deploy to production infrastructure (AWS/GCP/Vercel). Stand up monitoring and logging. OUTPUT: MVP deployed and observable.',
        'DAYS 8-14: Draft privacy policy, ToS, DPA template, SLA template. OUTPUT: Customer-facing legal documents ready.',
        'DAYS 15-30: Begin SOC 2 Type I readiness (Vanta, Drata, Secureframe). Required before most enterprise deals close. OUTPUT: SOC 2 program started.',
        'DAYS 15-30: Set up subscription billing (Stripe, Chargebee, Orb). Define pricing tiers. OUTPUT: Billing infrastructure live.',
        'DAYS 31-60: Sign 3-5 design partners on discounted or free pilots in exchange for feedback and case studies. OUTPUT: Design partners active.',
        'DAYS 31-60: Iterate product weekly against design partner feedback. Instrument usage analytics. OUTPUT: Product v0.2 shipped with feedback incorporated.',
        'DAYS 61-90: Convert first design partner into a paid annual contract. Sign MSA and DPA. Begin customer success workflow. OUTPUT: First revenue, first paying customer.'
      ]
    },
    'cybersecurity_vendor': {
      label: 'Cybersecurity Product / Service Vendor',
      description: 'A company selling cybersecurity products or services. Examples: EDR, SIEM, identity / zero-trust, cloud security posture management, penetration testing, managed SOC.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$500K-$10M',
      legalNotes: 'Delaware C-Corp standard. SOC 2 Type II and ISO 27001 expected. FedRAMP if selling to federal government. State data breach notification laws. Export controls (EAR/ITAR) for some crypto products.',
      fundingNotes: 'Cybersecurity-focused VCs (Ten Eleven, YL Ventures, Allegis, ForgePoint), In-Q-Tel for intel community, SBIR for federal.',
      operatingNotes: 'RFP-driven enterprise sales. CISO is primary buyer. 6-18 month sales cycles. Reference customers and analyst relations (Gartner, Forrester) are critical.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Engage counsel familiar with cybersecurity IP and export controls. OUTPUT: Entity and counsel retained.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Set up accounting. OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Provision secure dev environment. Implement internal zero-trust posture. OUTPUT: Internal security baseline documented.',
        'DAYS 8-14: Begin SOC 2 readiness (Vanta, Drata) and ISO 27001 gap assessment. OUTPUT: Compliance programs started.',
        'DAYS 15-30: File provisional patents on any novel techniques. Complete export control classification (EAR). OUTPUT: IP filed, export posture documented.',
        'DAYS 15-30: Build MVP. Instrument detection efficacy metrics (TPR, FPR, MTTD). OUTPUT: MVP with baseline efficacy metrics.',
        'DAYS 31-60: Engage 3 design partner CISOs. Sign MNDAs, run controlled pilots. OUTPUT: Pilots active, efficacy data flowing.',
        'DAYS 31-60: Submit to relevant analyst briefings (Gartner inquiry, Forrester briefing request). OUTPUT: Analyst relationships opened.',
        'DAYS 61-90: Convert first pilot into paid subscription. Sign MSA and DPA. Document reference case study. OUTPUT: First paying CISO, first reference.'
      ]
    },
    'ai_infrastructure': {
      label: 'AI / ML Infrastructure Company',
      description: 'A company providing the substrate for building and operating AI systems. Examples: model training, inference serving, observability, eval / safety, vector databases, MLOps platforms.',
      capitalIntensity: 'high', regulated: false, typicalStartup: '$1M-$20M+',
      legalNotes: 'Delaware C-Corp standard. Enterprise AI customers require SOC 2, DPAs, and increasingly EU AI Act compliance. Model licensing chains (LLaMA, Mistral, etc.) must be tracked. Customer data must not be used for training without explicit consent.',
      fundingNotes: 'AI-focused VCs (a16z, Sequoia, Index, Lightspeed, Greylock), strategic investors (NVIDIA NVentures, Microsoft, Google Ventures), SBIR for deep research.',
      operatingNotes: 'Compute cost management is existential. GPU availability drives roadmap. Open-source strategy + enterprise tier is the standard motion. Partnership with foundation model labs matters.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Engage counsel familiar with AI IP, open-source licensing, and model licensing chains. OUTPUT: Entity and AI counsel retained.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Negotiate GPU credits with NVIDIA, AWS, GCP, CoreWeave, Lambda. OUTPUT: Banking + compute runway secured.',
        'DAYS 8-14: Draft model licensing policy. Document data provenance and training data lineage requirements. OUTPUT: Model governance policy.',
        'DAYS 8-14: Set up ML experimentation infrastructure (Weights & Biases, MLflow, Modal). Version datasets and models. OUTPUT: Reproducible ML pipeline.',
        'DAYS 15-30: Build MVP. Benchmark against open-source alternatives. Publish eval results. OUTPUT: MVP with published benchmarks.',
        'DAYS 15-30: Open-source a component (SDK, eval suite, reference implementation). Publish to GitHub and package registry. OUTPUT: OSS release with community engagement.',
        'DAYS 31-60: Sign 3 design partner enterprises. Offer free or discounted compute for feedback. OUTPUT: Design partners using the product in production.',
        'DAYS 31-60: Begin SOC 2 Type I. Document EU AI Act compliance posture. OUTPUT: Compliance programs live.',
        'DAYS 61-90: Convert first design partner into paid enterprise contract. Sign MSA with model licensing and data handling addenda. OUTPUT: First enterprise revenue.'
      ]
    },
    'devtools_opensource': {
      label: 'Developer Tools / Open-Source Company',
      description: 'A company building developer productivity tools or commercializing an open-source project. Examples: IDEs, CI/CD, infrastructure-as-code, observability, databases, frameworks.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$100K-$2M',
      legalNotes: 'Delaware C-Corp standard. Open-source licensing strategy (Apache 2 / MIT / AGPL / BSL) is core IP. Trademark the project name. Contributor License Agreement (CLA) or DCO for external contributors.',
      fundingNotes: 'Dev-tools VCs (Redpoint, Accel, Decibel, CRV), strategic investors (GitHub, Vercel, HashiCorp), self-funded with bootstrap revenue.',
      operatingNotes: 'Community is the go-to-market. GitHub stars, Hacker News, Dev Twitter matter. Open-core / hosted / enterprise pricing tiers are the standard playbook.',
      first90: [
        'DAYS 1-7: Incorporate as Delaware C-Corp. Engage counsel familiar with open-source licensing and SaaS contracts. OUTPUT: Entity and counsel retained.',
        'DAYS 1-7: Apply for EIN. Open business bank account. Set up accounting. OUTPUT: Banking and accounting active.',
        'DAYS 8-14: Choose open-source license (Apache 2 recommended for commercial-friendly; AGPL or BSL for source-available). Draft CLA / DCO. OUTPUT: OSS license strategy documented.',
        'DAYS 8-14: Register project trademark. Set up GitHub org, Discord/Slack community, docs site. OUTPUT: Community infrastructure live.',
        'DAYS 15-30: Launch open-source release. Post to Hacker News, Reddit (r/programming), Dev Twitter, relevant newsletters. OUTPUT: Public launch with initial star traction.',
        'DAYS 15-30: Respond to every issue and PR within 24 hours. Ship weekly releases. OUTPUT: Active maintainer engagement.',
        'DAYS 31-60: Identify enterprise feature gaps (SSO, audit logs, RBAC, deployment automation). Begin building enterprise tier. OUTPUT: Enterprise tier roadmap.',
        'DAYS 31-60: Ship hosted / cloud version. Set up subscription billing (Stripe, Lago). OUTPUT: Hosted offering live.',
        'DAYS 61-90: Convert first enterprise lead. Sign MSA. Document reference architecture and case study. OUTPUT: First enterprise customer.'
      ]
    },
    'tech_consultancy': {
      label: 'Technology Consultancy / Advisory',
      description: 'A consulting business providing strategic, architectural, security, or transformation advisory to enterprises. Examples: cloud migration, security architecture, AI transformation, data engineering, platform engineering, M&A due diligence.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$10K-$100K',
      legalNotes: 'LLC or S-Corp typical. Professional liability (E&O) insurance $2M-$5M recommended. NDAs and MSAs per engagement. Some client work requires SOC 2 or ISO 27001 for the consultancy itself.',
      fundingNotes: 'Self-funded. First clients come from prior networks (former CTO, former architect, former security leader).',
      operatingNotes: 'Billable hours, retainers, or fixed-bid engagements. Reputation and network are everything. Subject matter expertise and published thought leadership drive inbound.',
      first90: [
        'DAYS 1-5: File LLC or S-Corp with Secretary of State. Apply for EIN. Open business bank account. OUTPUT: Entity and banking.',
        'DAYS 1-5: Verify any required certifications (AWS/GCP/Azure certs, CISSP, CISM, etc.). OUTPUT: Credentials documented.',
        'DAYS 6-15: Purchase professional liability ($2M-$5M E&O) and general liability insurance. OUTPUT: Insurance active.',
        'DAYS 6-15: Draft service catalog: architecture reviews, security audits, cloud migration, AI readiness, platform engineering. Set rates ($250-$600/hr or $15K-$150K project). OUTPUT: Service catalog finalized.',
        'DAYS 16-25: Build templates: NDAs, MSAs, SOWs, deliverables. OUTPUT: Templates ready.',
        'DAYS 16-25: Outreach to 30 prospects (CTOs, VPs of Engineering, CISOs). Offer free 30-min consultation. OUTPUT: 10 consultations booked.',
        'DAYS 26-40: Convert consultations into paid engagements. Send proposals. Sign MSAs. OUTPUT: First paying engagements.',
        'DAYS 41-60: Deliver first engagements. Bill on NET 30. Request testimonials and referrals. OUTPUT: First engagements delivered.',
        'DAYS 61-90: Convert one-off engagements into retainers. Publish thought leadership (blog, conference talks, podcast appearances). OUTPUT: First retainer signed.'
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
        { id: 'template', label: 'Template', type: 'select', options: ['saas_startup', 'cybersecurity_vendor', 'ai_infrastructure', 'devtools_opensource', 'tech_consultancy'] }
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
      { id: 'compliance', title: 'Technology Regulatory Compliance', type: 'textarea', guidance: 'SOC 2 / ISO 27001 / FedRAMP / GDPR / CCPA / HIPAA / EU AI Act / export controls (EAR/ITAR) / state data breach notification laws as applicable.' },
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
        { id: 'cost_infra', label: 'Cloud / compute infrastructure', type: 'text' },
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
      if (bt.indexOf('cyber') !== -1 || bt.indexOf('security') !== -1 || bt.indexOf('edr') !== -1 || bt.indexOf('siem') !== -1 || bt.indexOf('zero-trust') !== -1 || bt.indexOf('soc') !== -1 || bt.indexOf('penetration') !== -1) tmplKey = 'cybersecurity_vendor';
      else if (bt.indexOf(' ai ') !== -1 || bt.indexOf('ai/') !== -1 || bt.indexOf('ml ') !== -1 || bt.indexOf('inference') !== -1 || bt.indexOf('llm') !== -1 || bt.indexOf('model') !== -1 || bt.indexOf('mlops') !== -1 || bt.indexOf('gpu') !== -1) tmplKey = 'ai_infrastructure';
      else if (bt.indexOf('open-source') !== -1 || bt.indexOf('open source') !== -1 || bt.indexOf('devtool') !== -1 || bt.indexOf('developer tool') !== -1 || bt.indexOf('framework') !== -1 || bt.indexOf('cli ') !== -1 || bt.indexOf('ide ') !== -1) tmplKey = 'devtools_opensource';
      else if (bt.indexOf('consult') !== -1 || bt.indexOf('advisory') !== -1 || bt.indexOf('architect') !== -1 || bt.indexOf('migration') !== -1) tmplKey = 'tech_consultancy';
      else tmplKey = 'saas_startup';
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

  window.LIMENTechnologyBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[TechnologyBusinessBuild] loaded \u2014 7 stages, 5 technology-native templates');
})();
