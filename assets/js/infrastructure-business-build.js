/**
 * infrastructure-business-build.js — BUSINESS BUILD Execution Workspace v2
 *
 * Complete business launch system. 7 stages, 24+ subsections,
 * business-type templates, branching logic, lender-ready financials,
 * 90-day execution plan, deep reviewer mode, printable launch packet.
 *
 * Infrastructure domain only.
 * Exposes: window.LIMENInfrastructureBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isInfra = params.get('domain') === 'infrastructure';
  var isWorkspace = window.location.pathname.indexOf('infrastructure-workspace') !== -1;
  if (!isInfra && !isWorkspace) return;

  var STORE_KEY = 'limen_infrastructure_business_build';
  var MODE_KEY = 'limen_ibb_mode';
  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }
  function getWs(key) { return loadAll()[key] || null; }
  function saveWs(key, ws) { var a = loadAll(); a[key] = ws; saveAll(a); }
  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function getMode() { try { return localStorage.getItem(MODE_KEY) || 'operator'; } catch (e) { return 'operator'; } }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) {} }

  // Sections that operators confirm (not edit deeply)
  var OPERATOR_SECTIONS = ['concept', 'market', 'biz_type', 'entity', 'tax_id', 'compliance', 'banking', 'delivery', 'customers', 'first90', 'readiness'];
  // Sections hidden from operator (auditor-only)
  var AUDITOR_ONLY = ['revenue', 'governance', 'startup_costs', 'sources', 'loan_prep', 'proforma', 'team', 'infrastructure', 'legal_docs', 'financial_docs', 'operating_docs', 'lender_packet', 'auditor'];

  // ══════════════════════════════════════════════════════════════════════
  // BUSINESS TYPE TEMPLATES
  // ══════════════════════════════════════════════════════════════════════

  var TEMPLATES = {
    'infra_advisory': {
      label: 'Infrastructure Advisory / Policy Consulting',
      description: 'A firm providing expert advisory on infrastructure planning, policy, and procurement.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$5K-$30K',
      legalNotes: 'LLC is usually sufficient. Professional liability insurance (E&O) is critical. May need certifications in urban planning, civil engineering, or policy analysis depending on service scope.',
      fundingNotes: 'Typically self-funded. No significant equipment. Main cost is time to first client and professional insurance.',
      operatingNotes: 'Revenue depends on reputation, network, and policy cycle timing. First clients often come from existing government or industry relationships. Deliverable quality and regulatory knowledge are everything.',
      first90: [
        'DAYS 1-5: Go to your state Secretary of State website. File Articles of Organization for an LLC. Cost is typically $50-$300. Write down the confirmation number. OUTPUT: Filed LLC with state confirmation.',
        'DAYS 1-5: Go to irs.gov/ein. Click Apply Online. Select LLC. Enter your business name exactly as filed with the state. Complete the form (5 minutes). Download the EIN confirmation letter as PDF immediately. Save it. OUTPUT: EIN number and PDF confirmation letter.',
        'DAYS 6-10: Purchase professional liability insurance (Errors and Omissions). Contact Hiscox, Hartford, or a local broker. Request $1M-$2M coverage. Typical cost: $500-$1500/year for a solo consultant. OUTPUT: E&O insurance policy active.',
        'DAYS 11-15: Write a 2-page service offering document. Page 1: What infrastructure problems you solve (policy analysis, procurement advisory, grant writing, project oversight). Page 2: Service packages with pricing (hourly rate $150-$350, project rate, or retainer). OUTPUT: Service offering PDF ready to send to prospects.',
        'DAYS 16-20: Write down the names of 30 people in your network who work in infrastructure, government, engineering, or related industries. Rank them by likelihood of needing your expertise. Contact the top 10 by phone or email. Let them know you are now offering infrastructure advisory services. OUTPUT: 10 outreach conversations completed.',
        'DAYS 21-25: Create a proposal template. Include: executive summary, scope of work, timeline, deliverables, pricing, and terms. Tailor it to municipal and government procurement language. OUTPUT: Reusable proposal template.',
        'DAYS 26-35: Send your first proposal to a real prospect — a municipality, transit authority, utility, or engineering firm. Follow up within 48 hours. Negotiate terms if needed. Close the engagement with a signed agreement. OUTPUT: First signed consulting engagement.',
        'DAYS 36-60: Deliver your first engagement. Exceed expectations. Ask for a testimonial and a referral. Publish a short article or LinkedIn post about an infrastructure policy issue you analyzed. OUTPUT: First engagement delivered, testimonial received, first content published.',
        'DAYS 61-90: Build a repeatable outreach process: 5 new conversations per week with municipal planners, state DOT contacts, or engineering firms. Track proposals sent, win rate, and average deal size. Set revenue target for month 4-6. Register on sam.gov for federal contracting opportunities. OUTPUT: Pipeline system active with measurable metrics.'
      ]
    },
    'infra_contractor': {
      label: 'Specialized Infrastructure Contractor',
      description: 'A construction/maintenance firm specializing in bridges, roads, water systems, or grid infrastructure.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$100K-$2M',
      legalNotes: 'LLC or C-Corp. Significant regulatory requirements: state contractor licensing, bonding (performance and payment bonds), general liability, workers compensation, auto insurance. Environmental permits for certain project types. OSHA compliance mandatory.',
      fundingNotes: 'Requires significant capital. SBA 7(a) or conventional term loan for equipment. Equipment financing essential. Bonding capacity determines bid ceiling. May qualify for DBE/MBE/WBE set-asides.',
      operatingNotes: 'Revenue from government contracts (municipal, state, federal) and private sector infrastructure projects. Bonding capacity and safety record determine growth ceiling. Equipment reliability and crew quality are critical.',
      first90: [
        'DAYS 1-5: Hire an attorney with construction law experience. Ask for referrals from your state bar association or search Martindale-Hubbell. Schedule a 1-hour consultation to discuss entity structure, licensing, bonding, and compliance. Budget $300-$500 for initial consult. OUTPUT: Attorney retained, legal roadmap documented.',
        'DAYS 1-5: Form entity (LLC or C-Corp based on attorney advice). File with Secretary of State. Apply for EIN at irs.gov/ein. If planning to raise investment or bid on large contracts, attorney should advise on C-Corp. OUTPUT: Entity formed, EIN obtained.',
        'DAYS 6-14: Apply for state contractor license. Requirements vary by state — contact your state contractor licensing board. Most require proof of experience, exam, insurance, and fees ($200-$2,000). Allow 4-8 weeks for processing. OUTPUT: Contractor license application submitted.',
        'DAYS 6-14: Contact 3 surety bond brokers. Request quotes for bid bonds, performance bonds, and payment bonds. Your bonding capacity (typically 10x your working capital) determines the size of projects you can bid. Budget $5,000-$25,000 for initial bonding. Purchase general liability ($1M-$2M), workers compensation, and commercial auto insurance. OUTPUT: Bonding and insurance active.',
        'DAYS 15-25: Identify and procure essential equipment. Get quotes from 3 vendors minimum. Compare purchase vs lease for each item. Prioritize equipment needed for your first project type (excavators, trucks, safety gear, survey equipment). OUTPUT: Equipment procurement plan with vendor comparison.',
        'DAYS 15-25: Write safety protocols and create a safety manual. Include: OSHA compliance checklist, personal protective equipment requirements, emergency procedures, incident reporting, equipment lockout/tagout, confined space entry (if applicable), fall protection plan. OUTPUT: Safety manual completed and ready for crew training.',
        'DAYS 26-35: Begin permit applications for your target project types. Contact your city or county building department. Identify environmental permits needed (stormwater, erosion control, wetlands). Check EPA and state environmental agency requirements. OUTPUT: Permit applications filed with timeline documented.',
        'DAYS 36-50: Register on government procurement platforms: sam.gov (federal), your state DOT vendor portal, and local municipality procurement sites. Begin monitoring bid opportunities. Prepare your first bid package including company qualifications, safety record, equipment list, and bonding capacity letter. OUTPUT: First project bid submitted.',
        'DAYS 36-50: Hire initial crew. Write job descriptions with specific technical requirements and safety certifications (OSHA 10/30, CDL, equipment operation certs). Post on Indeed, trade-specific job boards, and union halls if applicable. Budget for prevailing wage compliance on government projects. OUTPUT: Core crew hired with safety certifications verified.',
        'DAYS 51-75: Win and mobilize for first project. Conduct pre-construction meeting. Assign project manager. Create project schedule. Set up daily safety briefings. Begin field operations. Document everything. OUTPUT: First project underway with daily logs and safety documentation.',
        'DAYS 76-90: Conduct post-project safety audit. Review incident reports (if any). Calculate actual vs estimated costs. Collect project close-out documentation. Request client evaluation. Update bonding company with completed project information to increase bonding capacity. OUTPUT: Safety audit complete, project close-out documented, bonding capacity updated.'
      ]
    },
    'infra_tech': {
      label: 'Smart Infrastructure Technology Provider',
      description: 'A technology company building sensors, monitoring platforms, or digital twins for infrastructure.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$25K-$500K',
      legalNotes: 'LLC or C-Corp (C-Corp if planning to raise venture capital). Intellectual property protection critical — file provisional patents early. May need FCC certification for wireless sensors. Data privacy compliance for infrastructure monitoring data.',
      fundingNotes: 'Seed funding from angels or grants (NSF SBIR, DOE, DOT). Equipment/development costs moderate. First revenue often from pilot partnerships with municipalities or utilities.',
      operatingNotes: 'Revenue from SaaS subscriptions, hardware sales, or project-based deployment. Long sales cycles with government buyers (6-18 months). Pilot programs are the fastest path to first revenue. Product-market fit validation is critical before scaling.',
      first90: [
        'DAYS 1-5: Form entity (LLC or C-Corp). Apply for EIN at irs.gov/ein. If planning to raise investment, use C-Corp with Delaware incorporation. Open business bank account. OUTPUT: Entity formed, EIN obtained, bank account active.',
        'DAYS 6-10: Define your MVP (Minimum Viable Product). Write a 1-page product specification: what infrastructure problem it solves, who uses it, what data it collects, how it displays results. Be specific — "bridge structural health monitoring via IoT sensors with cloud dashboard" not "smart infrastructure platform." OUTPUT: MVP specification document.',
        'DAYS 11-20: Assemble development team. If solo, identify contractors for hardware engineering, embedded firmware, and cloud/web development. Post on Upwork, Toptal, or reach out to your network. Budget $10K-$50K for prototype development. OUTPUT: Development team identified with cost estimates.',
        'DAYS 21-40: Build prototype. Hardware: order development boards (Arduino, Raspberry Pi, or custom PCB). Software: build data collection pipeline and basic dashboard. Focus on one infrastructure type (bridges, water pipes, power grid, roads). Do NOT build everything. OUTPUT: Working prototype that collects real data from at least one sensor.',
        'DAYS 41-55: Identify 3 potential pilot partners — municipalities, utilities, or transportation agencies willing to test your technology on a real asset. Offer free or deeply discounted pilot (3-6 months) in exchange for data, feedback, and case study rights. Write a pilot proposal. OUTPUT: At least 1 signed pilot partnership agreement.',
        'DAYS 41-55: File provisional patent application with USPTO ($320 for small entity). Document your novel approach: the sensor configuration, data processing algorithm, or monitoring methodology. This gives you 12 months of patent-pending status. OUTPUT: Provisional patent filed with USPTO confirmation.',
        'DAYS 56-65: Deploy prototype at pilot site. Install sensors, configure data pipeline, train operators. Set up monitoring dashboard accessible to pilot partner. Define success metrics: uptime, data quality, detection accuracy, false alarm rate. OUTPUT: Pilot deployment live with monitoring active.',
        'DAYS 66-80: Acquire first paying customer. Convert pilot partner or sign new customer based on pilot results. Set pricing: SaaS model ($500-$5,000/month per monitored asset) or hardware+service bundle. Sign contract with clear SLAs. OUTPUT: First paying customer under contract.',
        'DAYS 66-80: Set up usage metrics tracking. Monitor: active deployments, data volume, uptime, customer engagement, support tickets. Build a simple dashboard for internal use. These metrics are critical for fundraising. OUTPUT: Internal metrics dashboard active with baseline measurements.',
        'DAYS 81-90: Prepare fundraise materials if seeking investment. Create pitch deck (12-15 slides), financial model (3-year projections), and customer traction summary. Research SBIR/STTR grants from NSF, DOE, or DOT. Apply to at least one. OUTPUT: Pitch deck, financial model, and at least one grant application submitted.'
      ]
    },
    'infra_finance': {
      label: 'Infrastructure Project Finance / Bonds',
      description: 'A firm specializing in municipal bond structuring, PPP advisory, or infrastructure project financing.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$50K-$200K',
      legalNotes: 'LLC or S-Corp. SEC registration or state investment adviser registration may be required depending on services. FINRA Series 7/63 licenses for bond underwriting. MSRB rules apply for municipal securities. Compliance framework is non-negotiable.',
      fundingNotes: 'Typically self-funded. Main costs are licensing, compliance setup, and professional insurance. Revenue is fee-based (advisory fees, underwriting spreads, success fees on closed deals).',
      operatingNotes: 'Revenue from advisory fees ($50K-$500K per engagement), bond underwriting spreads, and success fees. Long sales cycles (3-12 months). Relationship-driven — municipal treasurers, city managers, and state finance officers are your buyers. Deal flow depends on your network and track record.',
      first90: [
        'DAYS 1-5: Form entity (LLC or S-Corp). Apply for EIN at irs.gov/ein. Consult with a securities attorney on registration requirements — state RIA registration or SEC registration depending on scope of advisory services. Budget $2,000-$5,000 for legal setup. OUTPUT: Entity formed, EIN obtained, regulatory pathway identified.',
        'DAYS 6-20: If required for your business model, begin Series 7 and Series 63 licensing process through FINRA. Register with a broker-dealer or consider independent RIA registration. Study time: 4-8 weeks for Series 7, 2-3 weeks for Series 63. Exam fees: $300-$400 each. Alternatively, if operating as a municipal advisor, register with the SEC on Form MA. OUTPUT: Licensing/registration applications submitted.',
        'DAYS 6-20: Build compliance framework. Create: supervisory procedures manual, client onboarding forms (KYC/AML), conflict of interest policy, record retention policy, advertising review procedures. Hire a compliance consultant if needed ($2,000-$5,000). OUTPUT: Compliance framework documented and operational.',
        'DAYS 21-35: Build deal pipeline. Identify 20 municipalities, transit authorities, or infrastructure projects in your target geography that have upcoming bond issuances or financing needs. Check state bond calendar and municipal finance databases. Contact municipal treasurers and finance directors. OUTPUT: Pipeline of 20 potential engagements with status tracking.',
        'DAYS 36-45: Secure first advisory engagement. Respond to a municipal RFP or approach a municipality directly with a capabilities presentation. Prepare: firm qualifications, team bios, relevant experience, fee schedule, sample engagement letter. OUTPUT: First signed engagement letter with client.',
        'DAYS 36-45: Build financial model templates for common infrastructure project types: water/sewer revenue bonds, transportation bonds, general obligation bonds, PPP structures. Include: debt service coverage ratios, reserve fund requirements, coverage tests, sensitivity analysis. OUTPUT: 3-5 reusable financial model templates ready for client use.',
        'DAYS 46-65: Build relationships with institutional buyers (mutual funds, insurance companies, pension funds that buy municipal bonds), rating agencies (Moody\'s, S&P, Fitch), and bond counsel firms. Attend GFOA (Government Finance Officers Association) or NABL events. OUTPUT: Relationship map with 10+ institutional contacts.',
        'DAYS 66-80: Close first deal. Structure the financing, coordinate with bond counsel, prepare offering documents, manage rating agency process, price the bonds, and close. Document the process end-to-end for repeatability. OUTPUT: First infrastructure financing deal closed with documentation.',
        'DAYS 81-90: Conduct compliance audit of first engagement. Review all records, communications, and disclosures. Ensure MSRB and SEC/state requirements are met. Update procedures manual based on lessons learned. Plan next quarter pipeline. OUTPUT: Compliance audit complete, procedures updated, Q2 pipeline documented.'
      ]
    },
    'infra_operator': {
      label: 'Infrastructure Asset Operations / Management',
      description: 'A company that operates and manages infrastructure assets like toll roads, water treatment plants, or broadband networks.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$500K-$10M+',
      legalNotes: 'LLC or C-Corp. Heavy regulatory requirements: state utility commission approval, environmental permits (EPA, state DEQ), operating licenses, safety certifications. May need NERC/FERC compliance for grid-connected assets. Extensive insurance requirements including environmental liability.',
      fundingNotes: 'Requires significant capital. Project finance (non-recourse debt), municipal bonds, PPP structures, or infrastructure fund investment. SBA 7(a) for smaller assets. Tax-exempt bond financing for qualifying public infrastructure. May qualify for WIFIA (Water Infrastructure) or TIFIA (Transportation Infrastructure) federal loans.',
      operatingNotes: 'Revenue from user fees (tolls, water rates, broadband subscriptions), capacity payments, or government operating contracts. Long-term concession agreements (20-50 years) typical. Regulatory compliance and asset maintenance determine profitability. Community relations are critical for license to operate.',
      first90: [
        'DAYS 1-7: Hire an attorney with infrastructure regulatory experience — utility law, environmental law, or public-private partnership expertise. Ask for referrals from state bar association or infrastructure trade associations (ASCE, AWWA, ARTBA). Schedule a 2-hour consultation to discuss entity structure, regulatory approvals, and permitting. Budget $500-$1,000 for initial consult. OUTPUT: Attorney retained, legal and regulatory roadmap documented.',
        'DAYS 1-7: Form entity (LLC or C-Corp based on attorney and tax advisor guidance). File with Secretary of State. Apply for EIN at irs.gov/ein. If infrastructure will be financed with tax-exempt bonds, discuss special purpose entity (SPE) structure with attorney. OUTPUT: Entity formed, EIN obtained, corporate structure documented.',
        'DAYS 8-14: Conduct regulatory mapping. Identify ALL federal, state, and local approvals needed: state utility commission (for regulated utilities), environmental permits (NPDES, air quality, wetlands), operating licenses, safety certifications, rate-setting authority. Create a master permit timeline with dependencies. OUTPUT: Complete regulatory map with permit timeline and cost estimates.',
        'DAYS 8-21: Begin permit applications with longest lead times. Environmental impact assessments can take 6-18 months. Water/wastewater operating permits take 3-6 months. File early. Budget $25,000-$250,000 for environmental assessments and permit fees depending on asset type and scale. OUTPUT: Priority permit applications submitted with tracking system.',
        'DAYS 15-30: Identify target site or asset for acquisition/development. Verify zoning compatibility. For existing assets: conduct Phase I environmental site assessment. For new construction: engage civil engineering firm for site feasibility study. Do not commit capital until regulatory pathway is confirmed. OUTPUT: Target site/asset identified with feasibility assessment complete.',
        'DAYS 15-30: Contact equipment vendors (3 minimum per major system). Request formal quotes with delivery timelines, warranty terms, installation support, and ongoing maintenance contracts. For water treatment: membrane systems, pumps, controls. For broadband: fiber, switches, towers. For toll roads: toll collection systems, ITS equipment. Compare total cost of ownership. OUTPUT: Equipment vendor comparison table with lifecycle cost analysis.',
        'DAYS 31-50: Structure financing. Engage a financial advisor for project finance structuring. Options: SBA 7(a) for small assets, WIFIA/TIFIA for qualifying projects, tax-exempt bonds through state authority, PPP concession from municipality, or infrastructure fund investment. Prepare: business plan, pro forma projections, rate study (if regulated), engineering report. OUTPUT: Financing structure selected, application submitted.',
        'DAYS 31-50: Hire operations manager with direct experience in your infrastructure type. For water: state-certified water/wastewater operator. For broadband: network operations experience. For transportation: traffic management experience. Write detailed job description with technical certifications required. Budget $70K-$120K annual salary. OUTPUT: Operations manager hired with verified certifications.',
        'DAYS 51-70: Write safety and compliance protocols. Include: emergency response procedures, maintenance schedules, environmental monitoring requirements, reporting requirements (EPA, state agency), OSHA compliance checklist, operator training requirements, public notification procedures. Have attorney and operations manager review. OUTPUT: Safety and compliance manual completed.',
        'DAYS 51-70: Secure first customer or offtake agreement. For regulated utilities: apply for service territory and rate approval from state utility commission. For contract operations: respond to municipal RFPs or negotiate operating agreement directly. For broadband: pre-sell subscriptions in service area. OUTPUT: First customer agreement or regulatory service approval obtained.',
        'DAYS 71-90: Conduct operational readiness review. Verify: all permits obtained, equipment installed and tested, safety protocols in place, staff trained, emergency procedures tested (tabletop exercise), monitoring systems active, compliance reporting systems configured, customer service systems operational. Obtain certificate of occupancy or operating permit. OUTPUT: Operational readiness review passed, facility ready for revenue service.'
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STAGE DEFINITIONS — 7 stages, 24+ subsections
  // ══════════════════════════════════════════════════════════════════════

  var STAGES = [
    // ── STAGE 1: BUSINESS DEFINITION ──
    { id: 'stage1', title: 'STAGE 1 \u2014 BUSINESS DEFINITION', sections: [
      { id: 'concept', title: 'Business Concept', type: 'fields',
        guidance: 'Define the business in language anyone can understand. If you cannot explain it in two sentences, you do not understand it well enough yet. The reviewer will reject vague descriptions.',
        fields: [
          { id: 'name', label: 'Business name (draft)', type: 'text', placeholder: 'e.g., BridgeGuard Monitoring LLC' },
          { id: 'one_liner', label: 'One-sentence description', type: 'text', placeholder: 'We provide [service/product] to [customer] in [area]' },
          { id: 'full_desc', label: 'Full business description (3-5 sentences)', type: 'textarea', placeholder: 'What does the business do? Who are the customers? How does it make money? What makes it different?' },
          { id: 'node_source', label: 'Node source (from LIMEN mapping)', type: 'text', prefill: 'nodeLabel' },
          { id: 'mapping_title', label: 'Business mapping title', type: 'text', prefill: 'businessType' }
        ] },
      { id: 'market', title: 'Customer & Market', type: 'fields',
        guidance: 'Who pays you? Be specific. "Government agencies" is too vague. "Municipal water utilities with 20K-200K connections needing SCADA upgrades" is specific. The more precisely you define your customer, the easier everything else becomes.',
        fields: [
          { id: 'target_customer', label: 'Primary target customer', type: 'textarea', placeholder: 'Describe your ideal customer in detail. Size, type, location, budget, pain point.' },
          { id: 'market_size', label: 'Estimated addressable market', type: 'text', placeholder: 'How many potential customers exist? What do they currently spend on this?' },
          { id: 'geography', label: 'Service geography', type: 'text', placeholder: 'Local, regional, national, or specific states/territories' },
          { id: 'competition', label: 'Main competitors or alternatives', type: 'textarea', placeholder: 'Who else serves this customer? What do they charge? Why would customers switch to you?' },
          { id: 'differentiation', label: 'Why you win', type: 'textarea', placeholder: 'What is your unfair advantage? Speed, price, expertise, location, technology, relationships?' }
        ] },
      { id: 'revenue', title: 'Revenue Model', type: 'fields',
        guidance: 'How does money come in? Be concrete. "We charge $X per Y" is better than "we monetize our platform." Common models: per-hour, per-project, subscription, per-unit, commission, licensing, concession fee.',
        fields: [
          { id: 'model_type', label: 'Revenue model', type: 'select', options: ['Per-hour/day rate', 'Per-project fixed fee', 'Monthly subscription', 'Per-unit product sales', 'Commission/referral', 'Licensing/royalty', 'Retainer', 'Concession/user fee', 'Mixed', 'Other'] },
          { id: 'pricing', label: 'Pricing structure', type: 'textarea', placeholder: 'What do you charge? How much? Is there a range? What is your average deal size?' },
          { id: 'payment_terms', label: 'Payment terms', type: 'text', placeholder: 'Net 30, upfront, milestone-based, COD?' },
          { id: 'recurring', label: 'Recurring vs one-time revenue', type: 'select', options: ['Mostly recurring (subscriptions, retainers, concessions)', 'Mostly one-time (projects, sales)', 'Mixed (some recurring, some project)', 'Undecided'] }
        ] },
      { id: 'biz_type', title: 'Business Type & Mode', type: 'fields',
        guidance: 'Choose the template that best matches your business. This affects which sections appear below.',
        fields: [
          { id: 'template', label: 'Business type template', type: 'select', options: ['infra_advisory', 'infra_contractor', 'infra_tech', 'infra_finance', 'infra_operator'] },
          { id: 'build_mode', label: 'Build mode', type: 'select', options: ['Basic Build', 'Franchise-Ready Build'] },
          { id: 'capital_intensity', label: 'Capital intensity', type: 'select', options: ['Low ($5K-$50K)', 'Medium ($50K-$500K)', 'High ($500K+)'] },
          { id: 'regulated', label: 'Regulated industry?', type: 'select', options: ['No', 'Yes \u2014 light regulation', 'Yes \u2014 heavy regulation (permits, inspections, compliance)'] }
        ] }
    ]},

    // ── STAGE 2: LEGAL FORMATION ──
    { id: 'stage2', title: 'STAGE 2 \u2014 LEGAL FORMATION', sections: [
      { id: 'entity', title: 'Entity Choice', type: 'fields',
        guidance: 'Your entity type determines your liability protection, tax treatment, and ability to raise money. LLC is the most common for small businesses. S-Corp can save on self-employment tax. C-Corp is for businesses planning outside investment or complex project finance structures.',
        fields: [
          { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC (most common)', 'S-Corp (tax optimization)', 'C-Corp (outside investment)', 'Sole Proprietorship (simplest, no liability protection)', 'Partnership', 'Undecided \u2014 need advice'] },
          { id: 'state', label: 'State of formation', type: 'text', placeholder: 'Most businesses form in their home state. Delaware or Wyoming for special cases.' },
          { id: 'name_check', label: 'Name availability checked?', type: 'select', options: ['Not yet', 'Available \u2014 confirmed with Secretary of State', 'Taken \u2014 need alternative', 'Reserved'] },
          { id: 'formation_cost', label: 'Estimated formation cost', type: 'text', placeholder: 'Filing fees ($50-$500) + attorney if used ($500-$2000)' }
        ] },
      { id: 'tax_id', title: 'Tax ID & Registration', type: 'mixed',
        guidance: 'An EIN (Employer Identification Number) is like a Social Security Number for your business. You need it to open a bank account, hire employees, and file taxes. It is free and takes 5 minutes at irs.gov/ein.',
        fields: [
          { id: 'ein', label: 'EIN', type: 'text', placeholder: 'Apply free at irs.gov/ein \u2014 takes 5 minutes' },
          { id: 'state_tax_id', label: 'State tax registration', type: 'text', placeholder: 'Sales tax permit, withholding account if applicable' }
        ],
        checklist: ['EIN obtained from IRS', 'State tax registration complete', 'Sales tax permit (if selling taxable goods)', 'Payroll tax accounts set up (if hiring employees)'] },
      { id: 'governance', title: 'Governance & Agreements', type: 'checklist',
        guidance: 'These documents define how your business is run, who owns what, and what happens when things change.',
        items: ['Operating agreement drafted (LLC) or bylaws adopted (Corp)', 'Ownership percentages documented', 'Vesting schedule for founders (if multiple owners)', 'Buy-sell agreement (if multiple owners)', 'Intellectual property assignment agreement', 'Non-compete / non-solicitation agreements (if needed)', 'Employee handbook (if hiring)'] },
      { id: 'compliance', title: 'Licenses, Permits & Insurance', type: 'mixed',
        guidance: 'Infrastructure businesses often require specialized licenses, permits, and insurance. Contractor licensing, environmental permits, performance bonds, and professional certifications are common. Skip this and one compliance failure can shut you down.',
        fields: [
          { id: 'gl_insurance', label: 'General liability insurance', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'pl_insurance', label: 'Professional liability (E&O)', type: 'select', options: ['Not needed', 'Not yet', 'Quoted', 'Purchased'] },
          { id: 'wc_insurance', label: 'Workers compensation', type: 'select', options: ['Not needed (no employees)', 'Not yet', 'Purchased'] },
          { id: 'auto_insurance', label: 'Commercial auto', type: 'select', options: ['Not needed', 'Not yet', 'Purchased'] }
        ],
        checklist: ['Business license (city/county)', 'State business registration', 'Professional certifications (PE, PMP, etc.)', 'Contractor license (if required)', 'Environmental permits (if applicable)', 'Zoning approval (if facility-based)', 'Health/safety inspection (if applicable)', 'Performance/payment bonding (if required)', 'sam.gov registration (for federal contracts)'] },
      { id: 'banking', title: 'Banking & Bookkeeping', type: 'checklist',
        guidance: 'Open a business bank account immediately. Never mix personal and business money. Set up bookkeeping software on day one.',
        items: ['Business checking account opened', 'Business savings account opened', 'Business credit card obtained', 'Bookkeeping software set up (QuickBooks, Xero, Wave)', 'Chart of accounts configured', 'Receipt/expense tracking system active', 'Accountant or bookkeeper identified', 'Payroll system set up (if hiring \u2014 Gusto, ADP, etc.)'] }
    ]},

    // ── STAGE 3: FUNDING PREPARATION ──
    { id: 'stage3', title: 'STAGE 3 \u2014 FUNDING PREPARATION', sections: [
      { id: 'startup_costs', title: 'Startup Cost Estimate', type: 'fields',
        guidance: 'List every dollar you need to spend before the business opens its doors AND for the first 3 months of operation. Underestimating startup costs is the #1 reason new businesses fail. Add 15-20% buffer for surprises.',
        fields: [
          { id: 'cost_equipment', label: 'Equipment / hardware ($)', type: 'text' },
          { id: 'cost_leasehold', label: 'Leasehold improvements / buildout ($)', type: 'text' },
          { id: 'cost_inventory', label: 'Initial inventory / materials ($)', type: 'text' },
          { id: 'cost_software', label: 'Software / technology ($)', type: 'text' },
          { id: 'cost_legal', label: 'Legal / professional fees ($)', type: 'text' },
          { id: 'cost_insurance', label: 'Insurance deposits ($)', type: 'text' },
          { id: 'cost_marketing', label: 'Marketing / launch costs ($)', type: 'text' },
          { id: 'cost_working_cap', label: 'Working capital (3 months overhead) ($)', type: 'text' },
          { id: 'cost_buffer', label: 'Contingency buffer (15-20%) ($)', type: 'text' },
          { id: 'cost_total', label: 'TOTAL STARTUP COST ($)', type: 'text', placeholder: 'Sum of all above' }
        ] },
      { id: 'sources', title: 'Sources of Funds', type: 'fields',
        guidance: 'Where will the money come from? This must equal your total startup cost. Lenders want to see that you have skin in the game \u2014 typically 10-25% of the total as owner equity.',
        fields: [
          { id: 'src_owner', label: 'Owner equity / cash injection ($)', type: 'text' },
          { id: 'src_sba', label: 'SBA or term loan ($)', type: 'text' },
          { id: 'src_equipment', label: 'Equipment financing ($)', type: 'text' },
          { id: 'src_loc', label: 'Line of credit ($)', type: 'text' },
          { id: 'src_grant', label: 'Grant funding ($)', type: 'text' },
          { id: 'src_investor', label: 'Outside investment ($)', type: 'text' },
          { id: 'src_bonds', label: 'Bond financing / WIFIA / TIFIA ($)', type: 'text' },
          { id: 'src_other', label: 'Other sources ($)', type: 'text' },
          { id: 'src_total', label: 'TOTAL SOURCES ($)', type: 'text', placeholder: 'Must equal total startup cost' }
        ] },
      { id: 'loan_prep', title: 'Loan & Financing Readiness', type: 'mixed',
        guidance: 'If you need a loan, prepare like you are going to a job interview. Clean financials, clear plan, realistic numbers = fundable business.',
        fields: [
          { id: 'loan_type', label: 'Primary loan type', type: 'select', options: ['SBA 7(a)', 'SBA 504 (real estate)', 'SBA Microloan', 'Conventional term loan', 'Equipment financing', 'Line of credit', 'WIFIA/TIFIA', 'Municipal bonds', 'Not seeking loan', 'Undecided'] },
          { id: 'loan_amount', label: 'Loan amount requested ($)', type: 'text' },
          { id: 'personal_credit', label: 'Personal credit score', type: 'text', placeholder: '680+ for SBA, 720+ for conventional' },
          { id: 'collateral', label: 'Available collateral', type: 'textarea', placeholder: 'Real estate, equipment, accounts receivable, personal guarantee' },
          { id: 'down_payment', label: 'Down payment / equity injection ($)', type: 'text', placeholder: 'Most lenders want 10-25%' }
        ],
        checklist: ['Personal financial statement prepared', 'Business plan with executive summary written', 'Pro forma financial projections complete', 'Tax returns available (2+ years personal)', 'Bank statements available (3-6 months)', 'Collateral documentation with values', 'Resume / management bio ready', 'Existing debt schedule documented', 'Legal entity formed with EIN', 'Insurance quotes obtained', 'Lease or property agreement (if applicable)'] }
    ]},

    // ── STAGE 4: FINANCIAL READINESS ──
    { id: 'stage4', title: 'STAGE 4 \u2014 FINANCIAL READINESS', sections: [
      { id: 'proforma', title: '12-Month Pro Forma', type: 'fields',
        guidance: 'A pro forma is your best estimate of what the business will earn and spend over the next 12 months. Be conservative. If you think revenue will be $20K/month, put $15K.',
        fields: [
          { id: 'monthly_revenue', label: 'Projected monthly revenue ($)', type: 'text', placeholder: 'Conservative \u2014 not best case' },
          { id: 'revenue_basis', label: 'Revenue assumptions', type: 'textarea', placeholder: 'How did you arrive at this number? X customers \u00d7 $Y average = $Z/month' },
          { id: 'monthly_cogs', label: 'Monthly cost of goods/services ($)', type: 'text' },
          { id: 'monthly_gross', label: 'Monthly gross profit ($)', type: 'text', placeholder: 'Revenue minus COGS' },
          { id: 'monthly_rent', label: 'Monthly rent / facility ($)', type: 'text' },
          { id: 'monthly_payroll', label: 'Monthly payroll including owner ($)', type: 'text' },
          { id: 'monthly_insurance', label: 'Monthly insurance ($)', type: 'text' },
          { id: 'monthly_software', label: 'Monthly software/tech ($)', type: 'text' },
          { id: 'monthly_marketing', label: 'Monthly marketing ($)', type: 'text' },
          { id: 'monthly_other', label: 'Monthly other overhead ($)', type: 'text' },
          { id: 'monthly_total_exp', label: 'TOTAL monthly expenses ($)', type: 'text' },
          { id: 'monthly_debt_svc', label: 'Monthly loan payments ($)', type: 'text' },
          { id: 'monthly_net', label: 'Monthly net income ($)', type: 'text', placeholder: 'Gross profit minus all expenses minus debt' },
          { id: 'breakeven', label: 'Break-even month', type: 'text', placeholder: 'Month when cumulative revenue exceeds cumulative costs' },
          { id: 'min_revenue', label: 'Minimum viable revenue ($)', type: 'text', placeholder: 'Floor \u2014 below this the business cannot pay its bills' },
          { id: 'dscr', label: 'DSCR (Debt Service Coverage Ratio)', type: 'text', placeholder: 'Net operating income / total debt payments. Lenders want \u2265 1.25' },
          { id: 'downside', label: 'Downside scenario', type: 'textarea', placeholder: 'What if revenue is 40% lower than projected? Can the business survive? For how long?' }
        ] }
    ]},

    // ── STAGE 5: OPERATING MODEL ──
    { id: 'stage5', title: 'STAGE 5 \u2014 OPERATING MODEL', sections: [
      { id: 'delivery', title: 'Service / Product Delivery', type: 'fields',
        guidance: 'How do you actually deliver the service or product? Walk through the process from customer order to delivery to payment collection.',
        fields: [
          { id: 'offer', label: 'Core offer', type: 'textarea', placeholder: 'Exactly what do you deliver? In what timeframe? At what quality standard?' },
          { id: 'process', label: 'Delivery process (step by step)', type: 'textarea', placeholder: '1. Customer requests \u2192 2. Quote/proposal \u2192 3. Agreement \u2192 4. Deliver \u2192 5. Invoice \u2192 6. Collect' },
          { id: 'quality', label: 'Quality standards / SLAs', type: 'textarea', placeholder: 'Response time, uptime guarantee, defect rate, safety record, satisfaction metric' },
          { id: 'capacity', label: 'Maximum capacity', type: 'text', placeholder: 'How many customers/projects can you handle at once?' }
        ] },
      { id: 'team', title: 'Team & Staffing', type: 'fields',
        guidance: 'Who does the work? Even if it is just you at first, write down what roles need to exist and when you plan to fill them.',
        fields: [
          { id: 'founder_role', label: 'Founder/owner role', type: 'textarea', placeholder: 'What do you personally do? Sales, delivery, management, everything?' },
          { id: 'first_hire', label: 'First hire (role + timing)', type: 'text', placeholder: 'e.g., Operations technician at month 3' },
          { id: 'staff_plan', label: 'Year 1 staffing plan', type: 'textarea', placeholder: 'Month 1: founder only. Month 3: add technician. Month 6: add admin. Month 9: add sales.' },
          { id: 'compensation', label: 'Compensation approach', type: 'textarea', placeholder: 'Salary ranges, commission structure, benefits, prevailing wage compliance' }
        ] },
      { id: 'infrastructure', title: 'Location, Equipment & Systems', type: 'fields',
        guidance: 'What physical and digital infrastructure does the business need?',
        fields: [
          { id: 'location', label: 'Location / facility', type: 'text', placeholder: 'Office, warehouse, field operations, remote, client sites, hybrid' },
          { id: 'equipment_list', label: 'Key equipment', type: 'textarea', placeholder: 'List major equipment items with approximate costs' },
          { id: 'software', label: 'Software / systems', type: 'textarea', placeholder: 'CRM, accounting, project management, SCADA, GIS, asset management' },
          { id: 'vendors', label: 'Key vendors and suppliers', type: 'textarea', placeholder: 'Who do you buy from? Are there alternatives?' }
        ] },
      { id: 'customers', title: 'Customer Acquisition', type: 'fields',
        guidance: 'How will you get customers? For infrastructure businesses, government procurement, RFP responses, and industry relationships are typically the primary channels.',
        fields: [
          { id: 'first_10', label: 'How will you get your first 10 customers?', type: 'textarea', placeholder: 'Be specific. Names if possible. Channels: government RFPs, direct outreach, referrals, industry events, sam.gov.' },
          { id: 'ongoing', label: 'Ongoing acquisition strategy', type: 'textarea', placeholder: 'After the first 10: what repeatable process will keep customers coming?' },
          { id: 'cac', label: 'Estimated customer acquisition cost', type: 'text', placeholder: 'How much does it cost to get one new customer?' },
          { id: 'ltv', label: 'Estimated customer lifetime value', type: 'text', placeholder: 'How much does one customer pay you over their entire relationship?' }
        ] },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields',
        guidance: 'The first 90 days determine whether the business has momentum or stalls. Break it into 30-day blocks.',
        fields: [
          { id: 'days_1_30', label: 'Days 1-30: Foundation', type: 'textarea', placeholder: 'Formation, accounts, insurance, licensing, permits. What must be DONE by day 30?' },
          { id: 'days_31_60', label: 'Days 31-60: Operations', type: 'textarea', placeholder: 'First customers, first revenue, first delivery. What must be LIVE by day 60?' },
          { id: 'days_61_90', label: 'Days 61-90: Growth', type: 'textarea', placeholder: 'Repeat customer delivery, first hire, marketing active. What must be PROVEN by day 90?' },
          { id: 'year1_priorities', label: 'Year 1 priorities (top 5)', type: 'textarea', placeholder: '1. Reach break-even\n2. Build customer pipeline\n3. Hire key roles\n4. Establish processes\n5. Build safety record' }
        ] }
    ]},

    // ── STAGE 6: DOCUMENTS ──
    { id: 'stage6', title: 'STAGE 6 \u2014 DOCUMENT PACKET', sections: [
      { id: 'legal_docs', title: 'Legal & Formation Documents', type: 'checklist',
        guidance: 'These documents prove your business legally exists and is properly structured.',
        items: ['Articles of organization / incorporation', 'Operating agreement / bylaws', 'EIN confirmation letter', 'State business registration', 'Trade name registration (DBA if needed)', 'Ownership certificates or membership interests'] },
      { id: 'financial_docs', title: 'Financial Documents', type: 'checklist',
        guidance: 'These documents prove your financial readiness and projections.',
        items: ['Business plan / executive summary', '12-month financial projections', 'Uses and sources of funds table', 'Personal financial statement (all owners)', 'Personal tax returns (2-3 years)', 'Bank statements (3-6 months)', 'Collateral documentation', 'Existing debt schedule'] },
      { id: 'operating_docs', title: 'Operating Documents', type: 'checklist',
        guidance: 'These documents prove you can actually run the business.',
        items: ['Service/product description', 'Pricing schedule', 'First 90-day plan', 'Staffing plan', 'Customer acquisition plan', 'Vendor/supplier agreements', 'Lease or facility agreement', 'Equipment list with quotes', 'Insurance policies or quotes', 'Safety manual (if applicable)', 'Environmental compliance plan (if applicable)'] },
      { id: 'lender_packet', title: 'Lender Packet (if seeking loan)', type: 'checklist',
        guidance: 'If you are applying for a loan, the lender will ask for ALL of these.',
        items: ['Completed loan application', 'Business plan with executive summary', '12-month pro forma', 'Personal financial statement', 'Personal tax returns (2+ years)', 'Bank statements (3-6 months)', 'Collateral with valuations', 'Resume / management bios', 'Proof of entity formation + EIN', 'Insurance documentation', 'Lease agreement', 'Existing debt schedule', 'Accounts receivable/payable (if existing business)'] }
    ]},

    // ── STAGE 7: REVIEW & APPROVAL ──
    { id: 'stage7', title: 'STAGE 7 \u2014 REVIEW & APPROVAL', sections: [
      { id: 'readiness', title: 'Launch Readiness Review', type: 'review',
        guidance: 'This is the final gate. The reviewer checks every stage for completeness, consistency, and viability.' },
      { id: 'auditor', title: 'Reviewer Decision', type: 'auditor',
        guidance: 'The reviewer evaluates: legal readiness, capital readiness, operating readiness, compliance readiness, document completeness, and overall launch viability.' }
    ]}
  ];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER ENGINE
  // ══════════════════════════════════════════════════════════════════════

  // Operator mode: simplified confirm/edit card
  function renderOperatorCard(sec, ws) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var done = ws.sectionDone && ws.sectionDone[sec.id];
    var fv = typeof val === 'object' ? val : {};

    var h = '<div class="eep-section" data-section="' + sec.id + '" style="border-left:2px solid ' + (done ? 'rgba(90,181,160,0.3)' : 'rgba(201,169,78,0.15)') + ';padding-left:10px">';
    h += '<div class="eep-section-header">';
    h += '<span class="eep-section-title" style="color:' + (done ? '#5ab5a0' : '#C9A94E') + '">' + (done ? '\u2713 CONFIRMED' : '\u25CB REVIEW') + ' \u2014 ' + esc(sec.title) + '</span>';
    h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (done ? ' checked' : '') + '> ' + (done ? 'confirmed' : 'confirm') + '</label>';
    h += '</div>';

    // Show summary of auto-generated content
    if (sec.fields) {
      var hasContent = false;
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.6;padding:4px 0">';
      for (var fi = 0; fi < sec.fields.length; fi++) {
        var f = sec.fields[fi];
        var v = fv[f.id] || '';
        if (v) {
          hasContent = true;
          h += '<div><span style="color:#807868">' + esc(f.label) + ':</span> ' + esc(typeof v === 'string' && v.length > 200 ? v.substring(0, 200) + ' [click Edit to see full text]' : v) + '</div>';
        }
      }
      if (!hasContent) h += '<div style="color:#706860">No information yet \u2014 click Edit to add details</div>';
      h += '</div>';
    }

    // Checklist summary
    var items = sec.items || (sec.checklist || null);
    if (items) {
      var checked = (ws.checks && ws.checks[sec.id]) || {};
      var checkCount = 0;
      for (var ci = 0; ci < items.length; ci++) { if (checked['item_' + ci]) checkCount++; }
      h += '<div style="font-size:0.28rem;color:' + (checkCount === items.length ? '#5ab5a0' : '#807868') + '">' + checkCount + '/' + items.length + ' items checked</div>';
    }

    // Edit toggle
    h += '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:0.28rem;color:rgba(201,169,78,0.5);letter-spacing:1px">EDIT \u25BC</summary>';
    h += '<div style="margin-top:6px">';
    if (sec.fields) {
      for (var efi = 0; efi < sec.fields.length; efi++) {
        var ef = sec.fields[efi];
        var ev = fv[ef.id] || '';
        h += '<div class="eep-field"><label class="eep-field-label">' + esc(ef.label) + '</label>';
        if (ef.type === 'select') {
          h += '<select class="eep-select" data-field="' + sec.id + '.' + ef.id + '">';
          for (var oi = 0; oi < ef.options.length; oi++) h += '<option' + (ev === ef.options[oi] ? ' selected' : '') + '>' + esc(ef.options[oi]) + '</option>';
          h += '</select>';
        } else if (ef.type === 'textarea') {
          h += '<textarea class="eep-textarea" data-field="' + sec.id + '.' + ef.id + '" style="min-height:60px"' + (ef.placeholder ? ' placeholder="' + esc(ef.placeholder) + '"' : '') + '>' + esc(ev) + '</textarea>';
        } else {
          h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + ef.id + '" value="' + esc(ev) + '"' + (ef.placeholder ? ' placeholder="' + esc(ef.placeholder) + '"' : '') + '>';
        }
        h += '</div>';
      }
    }
    if (items) {
      var checked2 = (ws.checks && ws.checks[sec.id]) || {};
      for (var ci2 = 0; ci2 < items.length; ci2++) {
        h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="item_' + ci2 + '"' + (checked2['item_' + ci2] ? ' checked' : '') + '> ' + esc(items[ci2]) + '</label>';
      }
    }
    h += '</div></details>';
    h += '</div>';
    return h;
  }

  function renderSection(sec, ws) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var checked = (ws.checks && ws.checks[sec.id]) || {};
    var done = ws.sectionDone && ws.sectionDone[sec.id];

    var h = '<div class="eep-section" data-section="' + sec.id + '">';
    h += '<div class="eep-section-header"><span class="eep-section-title">' + (done ? '\u2713 ' : '') + esc(sec.title) + '</span>';
    if (sec.type !== 'review' && sec.type !== 'auditor') {
      h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (done ? ' checked' : '') + '> done</label>';
    }
    h += '</div>';
    h += '<div class="eep-guidance">' + esc(sec.guidance).replace(/\\n/g, '<br>') + '</div>';

    if (sec.fields) {
      var fv = typeof val === 'object' ? val : {};
      for (var fi = 0; fi < sec.fields.length; fi++) {
        var f = sec.fields[fi];
        var v = fv[f.id] || '';
        h += '<div class="eep-field"><label class="eep-field-label">' + esc(f.label) + '</label>';
        if (f.type === 'select') {
          h += '<select class="eep-select" data-field="' + sec.id + '.' + f.id + '">';
          for (var oi = 0; oi < f.options.length; oi++) h += '<option' + (v === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>';
          h += '</select>';
        } else if (f.type === 'textarea') {
          h += '<textarea class="eep-textarea" data-field="' + sec.id + '.' + f.id + '" style="min-height:80px"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>' + esc(v) + '</textarea>';
        } else {
          h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(v) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
        }
        h += '</div>';
      }
    }

    var items = sec.items || (sec.checklist || null);
    if (items) {
      for (var ci = 0; ci < items.length; ci++) {
        var ck = 'item_' + ci;
        h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="' + ck + '"' + (checked[ck] ? ' checked' : '') + '> ' + esc(items[ci]) + '</label>';
      }
    }

    if (sec.type === 'review') {
      var total = 0, dn = 0;
      for (var sti = 0; sti < STAGES.length; sti++) {
        for (var ssi = 0; ssi < STAGES[sti].sections.length; ssi++) {
          var ss = STAGES[sti].sections[ssi];
          if (ss.type === 'review' || ss.type === 'auditor') continue;
          total++;
          if (ws.sectionDone && ws.sectionDone[ss.id]) dn++;
        }
      }
      var pct = total > 0 ? Math.round(dn / total * 100) : 0;
      h += '<div style="font-size:0.42rem;color:#d0c8b8;margin:8px 0">Progress: <b>' + dn + '/' + total + '</b> sections (' + pct + '%)</div>';
      h += '<div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:4px"></div></div>';
      if (pct < 100) {
        h += '<div style="font-size:0.32rem;color:#C9A94E;margin-bottom:6px">Missing sections:</div>';
        for (var mi = 0; mi < STAGES.length; mi++) {
          for (var msi = 0; msi < STAGES[mi].sections.length; msi++) {
            var ms = STAGES[mi].sections[msi];
            if (ms.type === 'review' || ms.type === 'auditor') continue;
            if (!(ws.sectionDone && ws.sectionDone[ms.id])) h += '<div style="font-size:0.30rem;color:#908878">\u2022 ' + esc(ms.title) + ' (' + esc(STAGES[mi].title) + ')</div>';
          }
        }
      }
      h += '<div style="margin-top:10px"><button class="eep-btn eep-btn-print" data-action="print">PRINT LAUNCH PACKET</button></div>';
    }

    if (sec.type === 'auditor') {
      var aud = ws.auditor || {};
      var sl = aud.status || 'DRAFT';
      h += '<div class="eep-auditor"><div class="eep-auditor-title">REVIEWER DECISION</div>';
      h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Legal readiness</label><select class="eep-select" data-auditor="legal_ready"><option' + (aud.legal_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.legal_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.legal_ready || aud.legal_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Capital readiness</label><select class="eep-select" data-auditor="capital_ready"><option' + (aud.capital_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.capital_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.capital_ready || aud.capital_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Operating readiness</label><select class="eep-select" data-auditor="ops_ready"><option' + (aud.ops_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.ops_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.ops_ready || aud.ops_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>';
      h += '<div class="eep-field"><label class="eep-field-label">Reviewer comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:60px">' + esc(aud.comments || '') + '</textarea></div>';
      if (sl === 'DENIED') h += '<div class="eep-field"><label class="eep-field-label">Denial reason</label><select class="eep-select" data-auditor="denial_category"><option>Missing formation items</option><option>Weak funding assumptions</option><option>Incomplete financials</option><option>Missing operating plan</option><option>Missing compliance steps</option><option>Incomplete documentation</option><option>High launch risk</option><option>Other</option></select><textarea class="eep-textarea" data-auditor="denial_detail" style="min-height:40px">' + esc(aud.denial_detail || '') + '</textarea></div>';
      h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>';
      if (aud.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(aud.timestamp).toLocaleString() + '</div>';
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  // Auto-generate draft content from template + prefill
  function autoGenerate(ws, prefill, tmpl) {
    if (ws._autoGenerated) return;
    ws._autoGenerated = true;

    var bizName = (prefill && prefill.businessType) ? prefill.businessType : 'New Infrastructure Business';
    var nodeLabel = (prefill && prefill.nodeLabel) || '';
    var reason = (prefill && prefill.reason) || '';

    // Stage 1 defaults
    if (!ws.fields['concept']) ws.fields['concept'] = {};
    ws.fields['concept']['name'] = ws.fields['concept']['name'] || bizName + ' LLC';
    ws.fields['concept']['node_source'] = ws.fields['concept']['node_source'] || nodeLabel;
    ws.fields['concept']['mapping_title'] = ws.fields['concept']['mapping_title'] || bizName;
    ws.fields['concept']['one_liner'] = ws.fields['concept']['one_liner'] || 'We provide ' + bizName.toLowerCase() + ' services to the infrastructure sector.';
    ws.fields['concept']['full_desc'] = ws.fields['concept']['full_desc'] || reason || (tmpl ? tmpl.description : '');

    if (!ws.fields['market']) ws.fields['market'] = {};
    ws.fields['market']['geography'] = ws.fields['market']['geography'] || 'Regional \u2014 United States';

    // Stage 2 defaults from template
    if (!ws.fields['entity']) ws.fields['entity'] = {};
    ws.fields['entity']['entity_type'] = ws.fields['entity']['entity_type'] || (tmpl ? (tmpl.capitalIntensity === 'high' ? 'C-Corp (outside investment)' : 'LLC (most common)') : 'LLC (most common)');

    // Stage 3 defaults from template
    if (!ws.fields['startup_costs']) ws.fields['startup_costs'] = {};
    if (tmpl) {
      var costMap = { low: { equip: '5000', soft: '2000', legal: '1500', ins: '1500', mkt: '3000', wc: '10000', buf: '5000', total: '28000' }, medium: { equip: '30000', soft: '5000', legal: '3000', ins: '3000', mkt: '10000', wc: '30000', buf: '15000', total: '96000' }, high: { equip: '150000', soft: '15000', legal: '10000', ins: '8000', mkt: '25000', wc: '100000', buf: '50000', total: '358000' } };
      var costs = costMap[tmpl.capitalIntensity] || costMap['medium'];
      ws.fields['startup_costs']['cost_equipment'] = ws.fields['startup_costs']['cost_equipment'] || costs.equip;
      ws.fields['startup_costs']['cost_software'] = ws.fields['startup_costs']['cost_software'] || costs.soft;
      ws.fields['startup_costs']['cost_legal'] = ws.fields['startup_costs']['cost_legal'] || costs.legal;
      ws.fields['startup_costs']['cost_insurance'] = ws.fields['startup_costs']['cost_insurance'] || costs.ins;
      ws.fields['startup_costs']['cost_marketing'] = ws.fields['startup_costs']['cost_marketing'] || costs.mkt;
      ws.fields['startup_costs']['cost_working_cap'] = ws.fields['startup_costs']['cost_working_cap'] || costs.wc;
      ws.fields['startup_costs']['cost_buffer'] = ws.fields['startup_costs']['cost_buffer'] || costs.buf;
      ws.fields['startup_costs']['cost_total'] = ws.fields['startup_costs']['cost_total'] || costs.total;
    }

    // Stage 5 defaults — first 90 days from template
    if (tmpl && tmpl.first90 && !ws.fields['first90']) {
      ws.fields['first90'] = {};
      ws.fields['first90']['days_1_30'] = tmpl.first90.slice(0, 3).join('\n');
      ws.fields['first90']['days_31_60'] = tmpl.first90.slice(3, 6).join('\n');
      ws.fields['first90']['days_61_90'] = tmpl.first90.slice(6).join('\n');
    }
  }

  function renderPanel(oppKey, prefill) {
    var ws = getWs(oppKey) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    var mode = getMode();

    if (!ws._prefilled && prefill) {
      ws._prefilled = true;
      if (!ws.fields['concept']) ws.fields['concept'] = {};
      if (prefill.nodeLabel) ws.fields['concept']['node_source'] = prefill.nodeLabel;
      if (prefill.businessType) { ws.fields['concept']['mapping_title'] = prefill.businessType; ws.fields['concept']['name'] = prefill.businessType + ' LLC'; }
      if (prefill.reason) ws.fields['concept']['full_desc'] = prefill.reason;
    }

    // Template info
    var tmplKey = ws.fields && ws.fields['biz_type'] && ws.fields['biz_type']['template'];
    if (!tmplKey && prefill && prefill.businessType) {
      var bt = (prefill.businessType || '').toLowerCase();
      if (bt.indexOf('consult') !== -1 || bt.indexOf('advisory') !== -1 || bt.indexOf('policy') !== -1) tmplKey = 'infra_advisory';
      else if (bt.indexOf('contractor') !== -1 || bt.indexOf('construction') !== -1 || bt.indexOf('bridge') !== -1 || bt.indexOf('road') !== -1) tmplKey = 'infra_contractor';
      else if (bt.indexOf('tech') !== -1 || bt.indexOf('sensor') !== -1 || bt.indexOf('monitor') !== -1 || bt.indexOf('digital') !== -1) tmplKey = 'infra_tech';
      else if (bt.indexOf('finance') !== -1 || bt.indexOf('bond') !== -1 || bt.indexOf('fund') !== -1) tmplKey = 'infra_finance';
      else if (bt.indexOf('operator') !== -1 || bt.indexOf('water') !== -1 || bt.indexOf('toll') !== -1 || bt.indexOf('broadband') !== -1) tmplKey = 'infra_operator';
      else tmplKey = 'infra_advisory';
      if (!ws.fields['biz_type']) ws.fields['biz_type'] = {};
      ws.fields['biz_type']['template'] = tmplKey;
    }
    var tmpl = tmplKey ? TEMPLATES[tmplKey] : null;

    // Auto-generate draft content
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

    // Mode toggle
    h += '<div style="display:flex;gap:4px;margin-bottom:10px;align-items:center">';
    h += '<button class="eep-btn" data-bb-mode="operator" style="' + (mode === 'operator' ? 'color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">OPERATOR MODE</button>';
    h += '<button class="eep-btn" data-bb-mode="auditor" style="' + (mode === 'auditor' ? 'color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">AUDITOR MODE</button>';
    h += '<span style="flex:1"></span>';
    h += '<span style="font-size:0.26rem;color:#706860">' + (mode === 'operator' ? 'Simplified guided flow \u2014 confirm what we built for you' : 'Full access \u2014 all sections, all fields, all detail') + '</span>';
    h += '</div>';

    // Operator mode banner
    if (mode === 'operator' && tmpl) {
      h += '<div style="padding:10px 12px;margin-bottom:12px;border:1px solid rgba(90,181,160,0.15);border-radius:3px;background:rgba(90,181,160,0.03)">';
      h += '<div style="font-size:0.36rem;color:#5ab5a0;margin-bottom:4px">We built this for you based on your business type.</div>';
      h += '<div style="font-size:0.32rem;color:#b0a898">Template: <b>' + esc(tmpl.label) + '</b> \u00b7 Capital: ' + esc(tmpl.typicalStartup) + ' \u00b7 ' + (tmpl.regulated ? 'Regulated' : 'Non-regulated') + '</div>';
      h += '<div style="font-size:0.30rem;color:#908878;margin-top:4px">' + esc(tmpl.description) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868;margin-top:6px"><b>Legal:</b> ' + esc(tmpl.legalNotes) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868"><b>Funding:</b> ' + esc(tmpl.fundingNotes) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868"><b>Operations:</b> ' + esc(tmpl.operatingNotes) + '</div>';
      h += '</div>';
    }

    // Auditor mode banner
    if (mode === 'auditor' && tmpl) {
      h += '<div style="padding:8px 10px;margin-bottom:10px;border:1px solid rgba(201,169,78,0.12);border-radius:3px;background:rgba(201,169,78,0.03)">';
      h += '<div style="font-size:0.34rem;color:#C9A94E;margin-bottom:2px">' + esc(tmpl.label) + '</div>';
      h += '<div style="font-size:0.30rem;color:#908878">' + esc(tmpl.description) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868;margin-top:4px">Capital: ' + esc(tmpl.typicalStartup) + ' \u00b7 ' + (tmpl.regulated ? 'Regulated' : 'Non-regulated') + '</div>';
      h += '</div>';
    }

    // Render stages
    for (var si = 0; si < STAGES.length; si++) {
      var stage = STAGES[si];
      var stageSections = stage.sections.filter(function (sec) {
        if (mode === 'operator' && AUDITOR_ONLY.indexOf(sec.id) !== -1) return false;
        return true;
      });
      if (stageSections.length === 0) continue;

      h += '<div style="margin-bottom:12px">';
      h += '<div style="font-size:0.34rem;letter-spacing:2.5px;color:rgba(201,169,78,0.4);padding:6px 0;border-bottom:1px solid rgba(201,169,78,0.08);margin-bottom:8px">' + esc(stage.title);
      if (mode === 'operator') {
        var stageConf = 0, stageTotal = 0;
        for (var sci = 0; sci < stageSections.length; sci++) {
          if (stageSections[sci].type !== 'review' && stageSections[sci].type !== 'auditor') {
            stageTotal++;
            if (ws.sectionDone && ws.sectionDone[stageSections[sci].id]) stageConf++;
          }
        }
        if (stageTotal > 0) h += ' <span style="font-size:0.26rem;color:' + (stageConf === stageTotal ? '#5ab5a0' : '#807868') + '">' + stageConf + '/' + stageTotal + ' confirmed</span>';
      }
      h += '</div>';
      for (var ssi = 0; ssi < stageSections.length; ssi++) {
        var sec = stageSections[ssi];
        if (mode === 'operator' && OPERATOR_SECTIONS.indexOf(sec.id) !== -1) {
          h += renderOperatorCard(sec, ws);
        } else {
          h += renderSection(sec, ws);
        }
      }
      h += '</div>';
    }

    h += '</div></div>';
    return h;
  }

  function wirePanel(container, oppKey) {
    var panel = container.querySelector('[data-opp="' + oppKey + '"][data-track="business"]');
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
        if (field) { var p = field.split('.'); if (typeof ws.fields[p[0]] !== 'object') ws.fields[p[0]] = {}; ws.fields[p[0]][p[1]] = this.value; }
        if (aud) { ws.auditor = ws.auditor || {}; ws.auditor[aud] = this.value; }
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

    // Mode toggle
    panel.querySelectorAll('[data-bb-mode]').forEach(function (el) {
      el.addEventListener('click', function () {
        var newMode = this.getAttribute('data-bb-mode');
        setMode(newMode);
        var newH = renderPanel(oppKey, null);
        panel.outerHTML = newH;
        wirePanel(container, oppKey);
        var newPanel = container.querySelector('[data-opp="' + oppKey + '"][data-track="business"]');
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

  window.LIMENInfrastructureBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[InfrastructureBusinessBuild] v2 loaded \u2014 7 stages, 5 templates, 24+ subsections');
})();
