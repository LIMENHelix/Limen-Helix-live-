/**
 * finance-business-build.js — BUSINESS BUILD Execution Workspace v2
 *
 * Complete business launch system. 7 stages, 24+ subsections,
 * business-type templates, branching logic, lender-ready financials,
 * 90-day execution plan, deep reviewer mode, printable launch packet.
 *
 * Finance domain only.
 * Exposes: window.LIMENFinanceBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isFinance = params.get('domain') === 'finance';
  var isWorkspace = window.location.pathname.indexOf('finance-workspace') !== -1;
  if (!isFinance && !isWorkspace) return;

  var STORE_KEY = 'limen_finance_business_build';
  var MODE_KEY = 'limen_finance_bb_mode';
  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }
  function getWs(key) { return loadAll()[key] || null; }
  function saveWs(key, ws) { var a = loadAll(); a[key] = ws; saveAll(a); }
  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function getMode() { try { return localStorage.getItem(MODE_KEY) || 'operator'; } catch (e) { return 'operator'; } }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) {} }

  var OPERATOR_SECTIONS = ['concept', 'market', 'biz_type', 'entity', 'tax_id', 'compliance', 'banking', 'delivery', 'customers', 'first90', 'readiness'];
  var AUDITOR_ONLY = ['revenue', 'governance', 'startup_costs', 'sources', 'loan_prep', 'proforma', 'team', 'infrastructure', 'legal_docs', 'financial_docs', 'operating_docs', 'lender_packet', 'auditor'];

  // ══════════════════════════════════════════════════════════════════════
  // BUSINESS TYPE TEMPLATES — 5 FINANCE ARCHETYPES
  // ══════════════════════════════════════════════════════════════════════

  var TEMPLATES = {
    'wealth_advisory': {
      label: 'Wealth Advisory Practice',
      description: 'A registered investment advisory firm providing fiduciary wealth management, financial planning, and investment advice to high-net-worth clients. Fee-based model, high-trust, relationship-intensive.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$25K-$100K',
      legalNotes: 'Must register as RIA with SEC (>$100M AUM) or state (under $100M). Series 65 or 66 required. E&O insurance critical. ADV Part 2 brochure required.',
      fundingNotes: 'Typically self-funded. Low capital requirements but compliance setup costs. Revenue starts slowly — first year is relationship building.',
      operatingNotes: 'Revenue from AUM fees (typically 0.75%-1.25% annually) or flat fees. Client retention is everything. Compliance is ongoing and non-negotiable.',
      first90: [
        'DAYS 1-5: Pass Series 65 exam if not already licensed. Study materials: Kaplan or STC. Exam fee ~$187. Register with your state securities regulator. File Form ADV Parts 1 and 2A with IARD system. OUTPUT: Series 65 passed, state RIA registration filed.',
        'DAYS 1-5: Form LLC in your state. Apply for EIN at irs.gov/ein. Open business checking account. Purchase E&O (Errors and Omissions) insurance — contact Chubb, Hiscox, or a specialist broker. Typical cost: $2,000-$5,000/year. OUTPUT: Entity formed, EIN, bank account, E&O policy active.',
        'DAYS 6-15: Select a custodian (Schwab, Fidelity, Pershing). Complete custodial agreement. Set up portfolio management software (Orion, Tamarac, or Black Diamond). Set up financial planning software (eMoney, MoneyGuidePro, or RightCapital). OUTPUT: Custodian agreement signed, technology stack operational.',
        'DAYS 6-15: Write your ADV Part 2A brochure (Form ADV). This is your client disclosure document — required before onboarding any client. Include: services, fees, conflicts of interest, disciplinary history, and education. File with IARD. OUTPUT: ADV Part 2A filed and available for delivery.',
        'DAYS 16-25: Create your investment policy statement template. Define your model portfolios (conservative, moderate, growth, aggressive). Document your investment selection process and due diligence criteria. OUTPUT: IPS template and model portfolios documented.',
        'DAYS 16-25: Write a compliance manual covering: books and records, advertising, custody, proxy voting, personal trading, and code of ethics. If solo, you are your own CCO. Schedule annual compliance review process. OUTPUT: Compliance manual complete.',
        'DAYS 26-40: Identify your first 20 prospective clients from your professional network. Prepare a one-page service overview. Schedule introductory meetings. Offer a complimentary financial plan review as your initial engagement. OUTPUT: 20 prospects identified, meetings scheduled.',
        'DAYS 41-60: Deliver first financial plans. Open custodial accounts for first clients. Execute initial portfolio investments. Ensure all new account documentation is complete (IPS signed, ADV delivered, suitability documented). OUTPUT: First 3-5 client accounts funded and invested.',
        'DAYS 61-90: Establish a quarterly client review cadence. Send first client performance reports. Begin building referral pipeline. Track AUM growth toward first-year target. Set up CRM (Wealthbox, Redtail, or Salesforce Financial). OUTPUT: Client review process active, CRM operational, AUM tracking in place.'
      ]
    },
    'fintech_platform': {
      label: 'Fintech Platform',
      description: 'A technology company providing financial services through software — payments, lending, banking-as-a-service, or investment platforms. High capital intensity for development, lower marginal cost at scale.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$250K-$2M+',
      legalNotes: 'Regulatory requirements vary by function: money transmitter licenses (state-by-state), broker-dealer registration (FINRA/SEC), bank charter or BaaS partner. Engage fintech regulatory counsel early.',
      fundingNotes: 'Typically VC-funded or significant founder capital. Pre-revenue period can be 12-24 months. Regulatory compliance costs are front-loaded.',
      operatingNotes: 'Revenue from transaction fees, subscription fees, or interchange. Unit economics must work at scale. Regulatory compliance is a competitive moat if done well.',
      first90: [
        'DAYS 1-7: Hire a fintech regulatory attorney. Identify all required licenses and registrations for your specific service. If payments: state money transmitter licenses. If lending: state lending licenses. If securities: broker-dealer or RIA registration. Budget $20K-$50K for initial legal. OUTPUT: Regulatory roadmap documented, attorney retained.',
        'DAYS 1-7: Form Delaware C-Corp (standard for VC-backed startups). Apply for EIN. Set up corporate bank account. Engage a startup CPA for tax elections (83(b) if issuing founder stock). OUTPUT: C-Corp formed, EIN obtained, bank account open.',
        'DAYS 8-20: Begin license applications for longest-lead-time jurisdictions. State money transmitter licenses take 3-12 months. File early. Alternatively, identify a BaaS (Banking-as-a-Service) partner who holds the necessary licenses. OUTPUT: License applications filed or BaaS partner LOI signed.',
        'DAYS 8-20: Write product requirements document. Define: core user flows, API specifications, data model, security architecture, and compliance requirements. Prioritize MVP features. OUTPUT: PRD complete with MVP scope defined.',
        'DAYS 21-40: Begin MVP development. If building internally: hire 2-3 senior engineers with financial services experience. If outsourcing: select a development partner with fintech experience and SOC 2 compliance. OUTPUT: Development team assembled, sprint 1 started.',
        'DAYS 21-40: Implement security and compliance infrastructure: encryption at rest and in transit, SOC 2 Type 1 readiness, PCI DSS (if handling card data), penetration testing plan. Engage a cloud security firm. OUTPUT: Security architecture designed and implementation started.',
        'DAYS 41-60: Build compliance program: BSA/AML if handling funds, KYC/CDD procedures, privacy policy (CCPA/GDPR), terms of service. Engage compliance technology vendors for KYC (Alloy, Jumio) and transaction monitoring (Unit21, Sardine). OUTPUT: Compliance program documented, vendors selected.',
        'DAYS 61-75: Begin closed beta testing with 10-20 users. Collect feedback on UX, performance, and reliability. Fix critical bugs. Prepare investor materials: pitch deck, financial model, and product demo. OUTPUT: Beta live, initial user feedback collected.',
        'DAYS 76-90: Prepare for seed fundraising: refine pitch deck, build financial model showing path to profitability, prepare data room. Target 10-15 investor meetings. If bootstrapping: focus on converting beta users to paying customers. OUTPUT: Fundraising process initiated or first paying customers onboarded.'
      ]
    },
    'insurance_agency': {
      label: 'Insurance Agency',
      description: 'An independent insurance agency selling P&C, life, health, or specialty lines on behalf of carriers. Commission-based revenue, relationship-driven, regulated at the state level.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$15K-$75K',
      legalNotes: 'State insurance producer license required. Each line of authority (P&C, life, health) requires separate licensing. E&O insurance mandatory. Must comply with state insurance department regulations.',
      fundingNotes: 'Low startup costs. Revenue is commission-based — typically 10-20% of premium for P&C, higher for life/health. Cash flow is lumpy until book builds.',
      operatingNotes: 'Revenue grows with book of business. Carrier appointments are critical — start with 3-5 carriers. Client retention drives long-term profitability. Consider agency cluster or aggregator for better commissions.',
      first90: [
        'DAYS 1-5: Pass state insurance producer exam for your lines of authority (P&C, life, health). Study with Kaplan, ExamFX, or AD Banker. Apply for state license through NIPR (National Insurance Producer Registry). Cost: $50-$200 per line. OUTPUT: Insurance producer license(s) obtained.',
        'DAYS 1-5: Form LLC. Apply for EIN. Open business bank account. Purchase E&O insurance for insurance agents — contact Swiss Re, Westport, or a wholesale broker. Typical cost: $1,000-$3,000/year. OUTPUT: Entity formed, E&O policy active.',
        'DAYS 6-15: Apply for carrier appointments with 3-5 insurance companies. Start with: one standard P&C carrier (Travelers, Hartford, or regional carrier), one E&S/surplus lines access (through wholesale broker), and one personal lines carrier. Appointments take 2-6 weeks. OUTPUT: Carrier appointment applications submitted.',
        'DAYS 6-15: Set up agency management system (AMS): Applied Epic, HawkSoft, or EZLynx. Set up comparative rating tool (if P&C): EZLynx, TurboRater, or carrier portals. Set up client communication system. OUTPUT: AMS and rating tools operational.',
        'DAYS 16-25: Consider joining an insurance agency cluster or aggregator (SIAA, Smart Choice, Renaissance Alliance). This gives access to more carrier appointments, higher commissions, and shared resources. Trade-off: revenue sharing. OUTPUT: Cluster/aggregator evaluation complete, decision made.',
        'DAYS 26-40: Build your prospect list: 50 businesses or 100 individuals. Focus on a niche — contractors, restaurants, real estate investors, or a specific personal lines demographic. Specialization wins over generalist approach. OUTPUT: Target market defined, prospect list built.',
        'DAYS 41-60: Begin outbound prospecting. Request BORs (Broker of Record letters) from prospects unhappy with current coverage. Quote competitively using your rating tools. Close first 5-10 policies. OUTPUT: First policies written, commission earned.',
        'DAYS 61-75: Set up renewal tracking system. Insurance agencies live and die by retention — a 90%+ retention rate is the goal. Send renewal notices 60 days before expiration. Review coverage annually. OUTPUT: Renewal process established.',
        'DAYS 76-90: Review first quarter results: premium written, commission earned, retention rate, and carrier relationship status. Set production goals for next quarter. Consider hiring a CSR (customer service representative) if volume supports it. OUTPUT: Quarterly review complete, growth plan set.'
      ]
    },
    'lending_operation': {
      label: 'Lending Operation',
      description: 'A non-bank lending business originating loans — mortgage, commercial, consumer, or specialty finance. Capital-intensive, heavily regulated, margin-driven.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$500K-$5M+',
      legalNotes: 'State lending licenses required in every state you originate. NMLS registration for mortgage. State consumer finance licenses for consumer lending. Must comply with TILA, ECOA, HMDA, RESPA, state usury laws, and fair lending requirements.',
      fundingNotes: 'Requires warehouse line of credit or balance sheet capital. Warehouse lines from banks typically require $1-5M minimum. Alternative: partner with a table-funder or loan aggregator.',
      operatingNotes: 'Revenue from origination fees and gain-on-sale (if selling to secondary market). Volume and turn time are critical. Compliance cost is ongoing and significant.',
      first90: [
        'DAYS 1-10: Hire a lending regulatory attorney specializing in your loan type (mortgage, commercial, consumer). Map all state licensing requirements. If mortgage: register with NMLS. If consumer: identify required state licenses. Budget $25K-$75K for licensing across initial states. OUTPUT: Regulatory attorney retained, licensing roadmap complete.',
        'DAYS 1-10: Form entity (LLC or Corp). Apply for EIN. If mortgage: individual MLOs must also hold NMLS licenses (pass SAFE Act exam). Begin surety bond procurement — most states require bonds ($25K-$250K depending on state). OUTPUT: Entity formed, NMLS registration initiated.',
        'DAYS 11-25: Submit license applications to your initial target states (start with 3-5 high-volume states). Each application requires: business plan, financial statements, background checks, surety bond, and compliance policies. Allow 30-120 days for approval. OUTPUT: State license applications filed.',
        'DAYS 11-25: Secure warehouse line of credit (if mortgage) or lending capital. Contact warehouse lenders: Western Asset, Flagstar, or Comerica. Minimum net worth requirements apply ($500K-$2M typical). Alternatively, establish relationships with loan aggregators for correspondent lending. OUTPUT: Warehouse line application submitted or capital secured.',
        'DAYS 26-40: Select and implement loan origination system (LOS): Encompass (mortgage), Abrigo (commercial), or LoanPro (consumer). Set up pricing engine. Configure compliance rules and automated disclosures. OUTPUT: LOS operational with compliance rules configured.',
        'DAYS 26-40: Write compliance program: fair lending policy, BSA/AML policy, privacy policy, complaint handling procedure, quality control plan, and vendor management policy. Hire or designate a compliance officer. OUTPUT: Compliance manual complete.',
        'DAYS 41-55: Hire initial production team: 2-3 loan officers with existing referral networks. Provide them with rate sheets, marketing materials, and CRM access. Set production expectations: 3-5 loans/month minimum per LO. OUTPUT: Production team hired and equipped.',
        'DAYS 56-75: Fund first loans. Ensure all regulatory disclosures are delivered timely. If selling to secondary market: execute master purchase agreements with investors (Fannie, Freddie, or private). Ship first loan for purchase. OUTPUT: First loans funded and sold.',
        'DAYS 76-90: Implement QC program: pre-funding review on 100% of loans, post-closing review on 10% minimum. Run first compliance audit. Review financial performance: volume, margin, and overhead. Adjust pricing and staffing as needed. OUTPUT: QC program operational, first compliance review complete.'
      ]
    },
    'compliance_service': {
      label: 'Compliance Service Firm',
      description: 'A professional services firm providing compliance, regulatory, and risk management consulting to financial institutions. Knowledge-intensive, low capital, high-value engagements.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$10K-$50K',
      legalNotes: 'LLC typically sufficient. Professional liability insurance (E&O) essential. May need CAMS certification (for AML), CRCM (for bank compliance), or similar credentials.',
      fundingNotes: 'Self-funded. Main cost is time to first client. Professional certifications and credibility drive revenue.',
      operatingNotes: 'Revenue from hourly rates ($150-$500/hr), project fees, or retainers. Client relationships are everything. Reputation and referrals drive growth.',
      first90: [
        'DAYS 1-5: File LLC. Apply for EIN. Open business bank account. Purchase professional liability insurance (E&O) — contact Hiscox, Hartford, or CNA. $1M-$2M coverage typical. Cost: $1,500-$3,000/year. OUTPUT: Entity formed, E&O active.',
        'DAYS 6-10: Obtain or verify professional certifications: CAMS (AML), CRCM (bank compliance), CISA (IT audit), CFE (fraud), or relevant designations. If not certified, register for next exam. Certifications are critical for credibility in financial compliance. OUTPUT: Certifications verified or exam registered.',
        'DAYS 6-15: Define your service offerings. Common niches: BSA/AML program development, bank examination preparation, fair lending analysis, vendor management, cybersecurity assessment (FFIEC CAT), or regulatory change implementation. Write a 2-page service description document. OUTPUT: Service offerings defined and documented.',
        'DAYS 16-25: Build prospect list of 30 financial institutions: community banks, credit unions, mortgage companies, fintechs, or broker-dealers in your area. Research their recent exam results (publicly available for banks). Institutions with MRAs or consent orders need help most. OUTPUT: 30-target prospect list with research notes.',
        'DAYS 16-25: Create engagement templates: proposal template, engagement letter, statement of work, and NDA. Include: scope, deliverables, timeline, fees, and confidentiality terms. Have your attorney review. OUTPUT: Engagement document templates ready.',
        'DAYS 26-40: Contact top 15 prospects by phone or email. Offer a complimentary 30-minute compliance health check. Attend a banking association event or webinar to build visibility. OUTPUT: 15 outreach conversations, 3-5 meetings scheduled.',
        'DAYS 41-60: Close first engagement. Deliver exceptional work — over-prepare and over-deliver. Document your methodology so it becomes repeatable. Ask for a testimonial and referral upon completion. OUTPUT: First engagement delivered, testimonial received.',
        'DAYS 61-75: Publish a thought leadership piece: regulatory update summary, compliance checklist, or exam preparation guide. Post on LinkedIn and send to prospects. Establish yourself as a subject matter expert. OUTPUT: First thought leadership content published.',
        'DAYS 76-90: Build repeatable pipeline: 5 new conversations per week. Track proposals, win rate, and average engagement size. Set revenue target for next quarter. Consider joining banking association as a vendor/associate member. OUTPUT: Pipeline system active with metrics tracked.'
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STAGE DEFINITIONS — 7 stages, 24 subsections
  // ══════════════════════════════════════════════════════════════════════

  var STAGES = [
    { id: 'stage1', title: 'STAGE 1 — BUSINESS DEFINITION', sections: [
      { id: 'concept', title: 'Business Concept', type: 'fields',
        guidance: 'Define the financial services business in language anyone can understand. If you cannot explain it in two sentences, you do not understand it well enough. The reviewer will reject vague descriptions.',
        fields: [
          { id: 'name', label: 'Business name (draft)', type: 'text', placeholder: 'e.g., Meridian Capital Advisory LLC' },
          { id: 'one_liner', label: 'One-sentence description', type: 'text', placeholder: 'We provide [financial service] to [customer] in [market]' },
          { id: 'full_desc', label: 'Full business description (3-5 sentences)', type: 'textarea', placeholder: 'What does the business do? Who are the clients? How does it make money? What regulatory framework applies?' },
          { id: 'node_source', label: 'Node source (from LIMEN mapping)', type: 'text', prefill: 'nodeLabel' },
          { id: 'mapping_title', label: 'Business mapping title', type: 'text', prefill: 'businessType' }
        ] },
      { id: 'market', title: 'Client & Market', type: 'fields',
        guidance: 'Who pays you? Be specific. "Financial institutions" is too vague. "Community banks with $500M-$5B in assets that need BSA/AML program upgrades" is specific.',
        fields: [
          { id: 'target_customer', label: 'Primary target client', type: 'textarea', placeholder: 'Describe your ideal client in detail. Size, type, regulatory status, pain point.' },
          { id: 'market_size', label: 'Estimated addressable market', type: 'text', placeholder: 'How many potential clients exist? What do they currently spend?' },
          { id: 'geography', label: 'Service geography', type: 'text', placeholder: 'Local, regional, national, or specific states' },
          { id: 'competition', label: 'Main competitors or alternatives', type: 'textarea', placeholder: 'Who else serves this client? What do they charge? Why would clients switch?' },
          { id: 'differentiation', label: 'Why you win', type: 'textarea', placeholder: 'Speed, specialization, technology, relationships, pricing, regulatory expertise?' }
        ] },
      { id: 'revenue', title: 'Revenue Model', type: 'fields',
        guidance: 'How does money come in? In financial services, common models include: AUM fees, transaction fees, commissions, retainers, subscription, origination fees, spread income, and advisory fees.',
        fields: [
          { id: 'model_type', label: 'Revenue model', type: 'select', options: ['AUM-based fees', 'Commission / trailer fees', 'Origination fees + gain-on-sale', 'Subscription / SaaS', 'Hourly / project consulting', 'Transaction fees', 'Spread income', 'Mixed', 'Other'] },
          { id: 'pricing', label: 'Pricing structure', type: 'textarea', placeholder: 'What do you charge? Fee schedule, rate card, or commission structure.' },
          { id: 'payment_terms', label: 'Payment terms', type: 'text', placeholder: 'Quarterly billing, per-transaction, monthly retainer?' },
          { id: 'recurring', label: 'Recurring vs one-time revenue', type: 'select', options: ['Mostly recurring (AUM, retainer, subscription)', 'Mostly one-time (project, origination)', 'Mixed', 'Undecided'] }
        ] },
      { id: 'biz_type', title: 'Business Type & Mode', type: 'fields',
        guidance: 'Choose the template that best matches your financial services business. This determines which licensing, compliance, and operational sections appear below.',
        fields: [
          { id: 'template', label: 'Business type template', type: 'select', options: ['wealth_advisory', 'fintech_platform', 'insurance_agency', 'lending_operation', 'compliance_service'] },
          { id: 'build_mode', label: 'Build mode', type: 'select', options: ['Basic Build', 'Franchise-Ready Build'] },
          { id: 'capital_intensity', label: 'Capital intensity', type: 'select', options: ['Low ($10K-$100K)', 'Medium ($100K-$500K)', 'High ($500K+)'] },
          { id: 'regulated', label: 'Regulatory intensity?', type: 'select', options: ['Light (state registration only)', 'Moderate (state licensing + compliance program)', 'Heavy (federal + state, ongoing examination)'] }
        ] }
    ]},

    { id: 'stage2', title: 'STAGE 2 — LEGAL FORMATION & LICENSING', sections: [
      { id: 'entity', title: 'Entity Choice', type: 'fields',
        guidance: 'In financial services, entity type affects regulatory eligibility. RIAs can be LLCs. Fintech raising VC should be C-Corp. Insurance agencies are typically LLCs. Lending companies need entity type that satisfies state licensing requirements.',
        fields: [
          { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC (most common for advisory/agency)', 'S-Corp (tax optimization for established firms)', 'C-Corp (VC-backed fintech/lending)', 'Sole Proprietorship (simplest, limited use in finance)', 'Partnership', 'Undecided — need advice'] },
          { id: 'state', label: 'State of formation', type: 'text', placeholder: 'Delaware for C-Corp/fintech. Home state for LLC advisory/agency.' },
          { id: 'name_check', label: 'Name availability checked?', type: 'select', options: ['Not yet', 'Available — confirmed with Secretary of State', 'Taken — need alternative', 'Reserved'] },
          { id: 'formation_cost', label: 'Estimated formation cost', type: 'text', placeholder: 'Filing fees + legal + licensing (varies widely by type)' }
        ] },
      { id: 'tax_id', title: 'Tax ID & Registration', type: 'mixed',
        guidance: 'Financial services businesses need EIN plus potentially: NMLS registration, SEC/FINRA registration, state insurance producer license, or state lending license. Each has its own ID numbers.',
        fields: [
          { id: 'ein', label: 'EIN', type: 'text', placeholder: 'Apply free at irs.gov/ein' },
          { id: 'nmls_id', label: 'NMLS ID (if mortgage/lending)', type: 'text', placeholder: 'Register at mortgage.nationwidelicensingsystem.org' },
          { id: 'sec_crd', label: 'SEC/FINRA CRD# (if securities)', type: 'text', placeholder: 'Register through IARD/Web CRD' },
          { id: 'state_license', label: 'Primary state license/registration #', type: 'text', placeholder: 'State-specific financial license number' }
        ],
        checklist: ['EIN obtained from IRS', 'State entity registration complete', 'Primary financial license/registration filed', 'NMLS registration (if applicable)', 'SEC/FINRA registration (if applicable)', 'State insurance license (if applicable)'] },
      { id: 'governance', title: 'Governance & Agreements', type: 'checklist',
        guidance: 'Financial services businesses require robust governance documentation. Regulators and auditors will review these.',
        items: ['Operating agreement / bylaws adopted', 'Ownership percentages documented', 'Compliance officer designated', 'Board or advisory board established (if required)', 'Buy-sell agreement (if multiple owners)', 'IP assignment agreement', 'Non-compete / non-solicitation agreements', 'Employee handbook with compliance sections'] },
      { id: 'compliance', title: 'Licenses, Insurance & Compliance', type: 'mixed',
        guidance: 'Financial services businesses have specific insurance and licensing requirements that go far beyond basic GL. E&O is critical. Fidelity bonds may be required. Regulatory compliance programs are mandatory, not optional.',
        fields: [
          { id: 'eo_insurance', label: 'Professional liability / E&O', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'fidelity_bond', label: 'Fidelity bond (if required)', type: 'select', options: ['Not required', 'Not yet', 'Purchased'] },
          { id: 'cyber_insurance', label: 'Cyber liability insurance', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'gl_insurance', label: 'General liability', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'surety_bond', label: 'Surety bond (if lending/money transmission)', type: 'select', options: ['Not required', 'Not yet', 'Posted'] }
        ],
        checklist: ['Primary financial license obtained', 'E&O / professional liability insurance active', 'Compliance manual written', 'BSA/AML program (if handling funds)', 'Privacy policy (GLBA, CCPA)', 'Information security program', 'Business continuity plan', 'Vendor management policy', 'Complaint handling procedure'] },
      { id: 'banking', title: 'Banking & Bookkeeping', type: 'checklist',
        guidance: 'Financial services businesses must maintain clean, auditable books. Trust accounts must be segregated. Client funds must never be commingled with operating funds.',
        items: ['Business operating account opened', 'Trust/escrow account (if holding client funds)', 'Business credit card obtained', 'Accounting software set up (QuickBooks, Xero)', 'Chart of accounts configured for financial services', 'Revenue recognition policy documented', 'Trust account reconciliation process established', 'Accountant or bookkeeper with financial services experience identified'] }
    ]},

    { id: 'stage3', title: 'STAGE 3 — FUNDING PREPARATION', sections: [
      { id: 'startup_costs', title: 'Startup Cost Estimate', type: 'fields',
        guidance: 'Financial services startups have unique cost categories: licensing fees, compliance technology, regulatory counsel, and insurance premiums that other businesses do not face. Account for all of them.',
        fields: [
          { id: 'cost_licensing', label: 'Licensing and registration fees ($)', type: 'text' },
          { id: 'cost_technology', label: 'Technology / platforms ($)', type: 'text' },
          { id: 'cost_legal', label: 'Legal / regulatory counsel ($)', type: 'text' },
          { id: 'cost_insurance', label: 'Insurance premiums and bonds ($)', type: 'text' },
          { id: 'cost_compliance', label: 'Compliance program setup ($)', type: 'text' },
          { id: 'cost_marketing', label: 'Marketing / launch costs ($)', type: 'text' },
          { id: 'cost_working_cap', label: 'Working capital (3-6 months) ($)', type: 'text' },
          { id: 'cost_buffer', label: 'Contingency buffer (15-20%) ($)', type: 'text' },
          { id: 'cost_total', label: 'TOTAL STARTUP COST ($)', type: 'text', placeholder: 'Sum of all above' }
        ] },
      { id: 'sources', title: 'Sources of Funds', type: 'fields',
        guidance: 'Financial services regulators often require minimum net worth or capital. Ensure your funding sources satisfy both business needs and regulatory requirements.',
        fields: [
          { id: 'src_owner', label: 'Owner equity / cash injection ($)', type: 'text' },
          { id: 'src_loan', label: 'SBA or term loan ($)', type: 'text' },
          { id: 'src_investor', label: 'Outside investment / VC ($)', type: 'text' },
          { id: 'src_warehouse', label: 'Warehouse line / credit facility ($)', type: 'text' },
          { id: 'src_grant', label: 'Grant funding ($)', type: 'text' },
          { id: 'src_other', label: 'Other sources ($)', type: 'text' },
          { id: 'src_total', label: 'TOTAL SOURCES ($)', type: 'text', placeholder: 'Must equal total startup cost + regulatory minimums' }
        ] },
      { id: 'loan_prep', title: 'Financing Readiness', type: 'checklist',
        guidance: 'If seeking financing, financial services businesses face additional scrutiny on regulatory standing, compliance history, and licensing status.',
        items: ['Business plan with regulatory section', 'Financial projections (12-month)', 'Personal financial statement', 'Tax returns (2+ years)', 'Proof of licensing/registration', 'Compliance program documentation', 'Insurance documentation', 'Net worth certification (if required by regulator)', 'Background check clearance'] }
    ]},

    { id: 'stage4', title: 'STAGE 4 — FINANCIAL READINESS', sections: [
      { id: 'proforma', title: '12-Month Pro Forma', type: 'fields',
        guidance: 'Financial services pro formas must account for: regulatory minimum capital, compliance costs as ongoing overhead, and revenue ramp-up that may be slower than other industries due to licensing timelines and trust-building.',
        fields: [
          { id: 'monthly_revenue', label: 'Projected monthly revenue ($)', type: 'text', placeholder: 'Conservative — account for licensing ramp time' },
          { id: 'revenue_basis', label: 'Revenue assumptions', type: 'textarea', placeholder: 'X clients at $Y average fee = $Z/month. When do clients onboard?' },
          { id: 'monthly_compliance', label: 'Monthly compliance costs ($)', type: 'text', placeholder: 'Ongoing: technology, training, audits, counsel' },
          { id: 'monthly_technology', label: 'Monthly technology ($)', type: 'text', placeholder: 'Core systems, data feeds, security, cloud' },
          { id: 'monthly_personnel', label: 'Monthly personnel ($)', type: 'text', placeholder: 'Salaries, benefits, contractors' },
          { id: 'monthly_insurance', label: 'Monthly insurance ($)', type: 'text' },
          { id: 'monthly_other', label: 'Monthly other overhead ($)', type: 'text' },
          { id: 'monthly_total_exp', label: 'TOTAL monthly expenses ($)', type: 'text' },
          { id: 'breakeven', label: 'Break-even month', type: 'text', placeholder: 'When cumulative revenue exceeds cumulative costs' },
          { id: 'min_capital', label: 'Regulatory minimum capital ($)', type: 'text', placeholder: 'Minimum net worth or capital required by regulator' }
        ] }
    ]},

    { id: 'stage5', title: 'STAGE 5 — OPERATING MODEL', sections: [
      { id: 'delivery', title: 'Service Delivery', type: 'fields',
        guidance: 'How do you deliver the financial service? Walk through the client journey from first contact to ongoing relationship management.',
        fields: [
          { id: 'offer', label: 'Core service offering', type: 'textarea', placeholder: 'What specific financial service do you deliver?' },
          { id: 'process', label: 'Client journey (step by step)', type: 'textarea', placeholder: '1. Prospect → 2. KYC/Onboarding → 3. Needs analysis → 4. Solution → 5. Implementation → 6. Ongoing service → 7. Review' },
          { id: 'quality', label: 'Service standards', type: 'textarea', placeholder: 'Response times, reporting frequency, compliance standards' },
          { id: 'capacity', label: 'Maximum capacity', type: 'text', placeholder: 'How many clients or transactions can you handle?' }
        ] },
      { id: 'team', title: 'Team & Staffing', type: 'fields',
        guidance: 'Financial services firms must have qualified, licensed personnel. Document who needs which licenses and certifications.',
        fields: [
          { id: 'founder_role', label: 'Founder role and licenses', type: 'textarea', placeholder: 'Your role + licenses/certifications held' },
          { id: 'first_hire', label: 'First hire (role + timing)', type: 'text', placeholder: 'e.g., Compliance associate at month 4' },
          { id: 'staff_plan', label: 'Year 1 staffing plan', type: 'textarea', placeholder: 'Include licensing requirements per role' },
          { id: 'compensation', label: 'Compensation approach', type: 'textarea', placeholder: 'Base + bonus, commission, AUM-based, equity?' }
        ] },
      { id: 'infrastructure', title: 'Technology & Infrastructure', type: 'fields',
        guidance: 'Financial services technology must meet regulatory requirements for security, auditability, and data retention.',
        fields: [
          { id: 'core_system', label: 'Core platform / system', type: 'text', placeholder: 'LOS, AMS, PMS, trading platform, or core banking' },
          { id: 'compliance_tech', label: 'Compliance technology', type: 'textarea', placeholder: 'KYC, AML monitoring, surveillance, archiving' },
          { id: 'security', label: 'Security infrastructure', type: 'textarea', placeholder: 'Encryption, MFA, SOC 2, pen testing, DR' },
          { id: 'vendors', label: 'Key vendors', type: 'textarea', placeholder: 'Data providers, custodians, carriers, clearinghouses' }
        ] },
      { id: 'customers', title: 'Client Acquisition', type: 'fields',
        guidance: 'In financial services, trust is the currency. Referrals, credentials, and thought leadership drive acquisition more than advertising.',
        fields: [
          { id: 'first_10', label: 'How will you get your first 10 clients?', type: 'textarea', placeholder: 'Personal network, referrals, COI relationships, industry events?' },
          { id: 'ongoing', label: 'Ongoing acquisition strategy', type: 'textarea', placeholder: 'Referral program, thought leadership, strategic partnerships, channel relationships?' },
          { id: 'cac', label: 'Estimated client acquisition cost', type: 'text' },
          { id: 'ltv', label: 'Estimated client lifetime value', type: 'text' }
        ] },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields',
        guidance: 'Financial services businesses often have a 6-12 month pre-revenue period due to licensing. Plan accordingly.',
        fields: [
          { id: 'days_1_30', label: 'Days 1-30: Foundation', type: 'textarea', placeholder: 'Entity, licensing, core technology, compliance program' },
          { id: 'days_31_60', label: 'Days 31-60: Build', type: 'textarea', placeholder: 'Carrier/custodian appointments, first clients, first revenue' },
          { id: 'days_61_90', label: 'Days 61-90: Scale', type: 'textarea', placeholder: 'Pipeline building, process refinement, team expansion' }
        ] }
    ]},

    { id: 'stage6', title: 'STAGE 6 — DOCUMENT PACKET', sections: [
      { id: 'legal_docs', title: 'Legal & Regulatory Documents', type: 'checklist',
        guidance: 'Financial services businesses require extensive documentation for regulators, clients, and counterparties.',
        items: ['Articles of organization / incorporation', 'Operating agreement / bylaws', 'EIN confirmation letter', 'Financial license / registration certificate', 'Compliance manual', 'Privacy policy (GLBA)', 'ADV Part 2A / prospectus / policy forms (as applicable)', 'Client agreement templates'] },
      { id: 'financial_docs', title: 'Financial Documents', type: 'checklist',
        guidance: 'Financial regulators expect audited or reviewed financial statements.',
        items: ['Business plan with regulatory section', '12-month financial projections', 'Startup cost and funding analysis', 'Personal financial statements (all principals)', 'Tax returns (2-3 years)', 'Net worth certification', 'Proof of insurance (E&O, cyber, fidelity)', 'Surety bond documentation (if applicable)'] },
      { id: 'operating_docs', title: 'Operating Documents', type: 'checklist',
        guidance: 'Operational documentation demonstrates readiness to regulators and partners.',
        items: ['Service description and fee schedule', 'Client onboarding procedures', 'KYC/CDD procedures', 'Complaint handling procedure', 'Business continuity plan', 'Information security program', 'Vendor management policy', 'Record retention schedule'] }
    ]},

    { id: 'stage7', title: 'STAGE 7 — REVIEW & APPROVAL', sections: [
      { id: 'readiness', title: 'Launch Readiness Review', type: 'review',
        guidance: 'Financial services launch readiness requires: legal formation complete, licenses obtained or applied, compliance program operational, technology functional, and capital in place.' },
      { id: 'auditor', title: 'Reviewer Decision', type: 'auditor',
        guidance: 'The reviewer evaluates: regulatory readiness, capital adequacy, compliance program, technology infrastructure, staffing, and overall launch viability.' }
    ]}
  ];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER ENGINE (same pattern as energy-business-build.js)
  // ══════════════════════════════════════════════════════════════════════

  function renderOperatorCard(sec, ws) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var done = ws.sectionDone && ws.sectionDone[sec.id];
    var fv = typeof val === 'object' ? val : {};
    var h = '<div class="eep-section" data-section="' + sec.id + '" style="border-left:2px solid ' + (done ? 'rgba(90,181,160,0.3)' : 'rgba(201,169,78,0.15)') + ';padding-left:10px">';
    h += '<div class="eep-section-header"><span class="eep-section-title" style="color:' + (done ? '#5ab5a0' : '#C9A94E') + '">' + (done ? '\u2713 CONFIRMED' : '\u25CB REVIEW') + ' \u2014 ' + esc(sec.title) + '</span>';
    h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (done ? ' checked' : '') + '> ' + (done ? 'confirmed' : 'confirm') + '</label></div>';
    if (sec.fields) {
      var hasContent = false;
      h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.6;padding:4px 0">';
      for (var fi = 0; fi < sec.fields.length; fi++) { var f = sec.fields[fi]; var v = fv[f.id] || ''; if (v) { hasContent = true; h += '<div><span style="color:#807868">' + esc(f.label) + ':</span> ' + esc(typeof v === 'string' && v.length > 200 ? v.substring(0, 200) + ' [click Edit]' : v) + '</div>'; } }
      if (!hasContent) h += '<div style="color:#706860">No information yet — click Edit to add details</div>';
      h += '</div>';
    }
    var items = sec.items || (sec.checklist || null);
    if (items) { var checked = (ws.checks && ws.checks[sec.id]) || {}; var cc = 0; for (var ci = 0; ci < items.length; ci++) { if (checked['item_' + ci]) cc++; } h += '<div style="font-size:0.28rem;color:' + (cc === items.length ? '#5ab5a0' : '#807868') + '">' + cc + '/' + items.length + ' items checked</div>'; }
    h += '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:0.28rem;color:rgba(201,169,78,0.5);letter-spacing:1px">EDIT \u25BC</summary><div style="margin-top:6px">';
    if (sec.fields) { for (var efi = 0; efi < sec.fields.length; efi++) { var ef = sec.fields[efi]; var ev = fv[ef.id] || ''; h += '<div class="eep-field"><label class="eep-field-label">' + esc(ef.label) + '</label>'; if (ef.type === 'select') { h += '<select class="eep-select" data-field="' + sec.id + '.' + ef.id + '">'; for (var oi = 0; oi < ef.options.length; oi++) h += '<option' + (ev === ef.options[oi] ? ' selected' : '') + '>' + esc(ef.options[oi]) + '</option>'; h += '</select>'; } else if (ef.type === 'textarea') { h += '<textarea class="eep-textarea" data-field="' + sec.id + '.' + ef.id + '" style="min-height:60px"' + (ef.placeholder ? ' placeholder="' + esc(ef.placeholder) + '"' : '') + '>' + esc(ev) + '</textarea>'; } else { h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + ef.id + '" value="' + esc(ev) + '"' + (ef.placeholder ? ' placeholder="' + esc(ef.placeholder) + '"' : '') + '>'; } h += '</div>'; } }
    if (items) { var checked2 = (ws.checks && ws.checks[sec.id]) || {}; for (var ci2 = 0; ci2 < items.length; ci2++) { h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="item_' + ci2 + '"' + (checked2['item_' + ci2] ? ' checked' : '') + '> ' + esc(items[ci2]) + '</label>'; } }
    h += '</div></details></div>';
    return h;
  }

  function renderSection(sec, ws) {
    var val = (ws.fields && ws.fields[sec.id]) || '';
    var checked = (ws.checks && ws.checks[sec.id]) || {};
    var done = ws.sectionDone && ws.sectionDone[sec.id];
    var h = '<div class="eep-section" data-section="' + sec.id + '"><div class="eep-section-header"><span class="eep-section-title">' + (done ? '\u2713 ' : '') + esc(sec.title) + '</span>';
    if (sec.type !== 'review' && sec.type !== 'auditor') h += '<label class="eep-section-check"><input type="checkbox" class="eep-done-check" data-sec="' + sec.id + '"' + (done ? ' checked' : '') + '> done</label>';
    h += '</div><div class="eep-guidance">' + esc(sec.guidance).replace(/\\n/g, '<br>') + '</div>';
    if (sec.fields) { var fv = typeof val === 'object' ? val : {}; for (var fi = 0; fi < sec.fields.length; fi++) { var f = sec.fields[fi]; var v = fv[f.id] || ''; h += '<div class="eep-field"><label class="eep-field-label">' + esc(f.label) + '</label>'; if (f.type === 'select') { h += '<select class="eep-select" data-field="' + sec.id + '.' + f.id + '">'; for (var oi = 0; oi < f.options.length; oi++) h += '<option' + (v === f.options[oi] ? ' selected' : '') + '>' + esc(f.options[oi]) + '</option>'; h += '</select>'; } else if (f.type === 'textarea') { h += '<textarea class="eep-textarea" data-field="' + sec.id + '.' + f.id + '" style="min-height:80px"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>' + esc(v) + '</textarea>'; } else { h += '<input class="eep-input" type="text" data-field="' + sec.id + '.' + f.id + '" value="' + esc(v) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>'; } h += '</div>'; } }
    var items = sec.items || (sec.checklist || null);
    if (items) { for (var ci = 0; ci < items.length; ci++) { var ck = 'item_' + ci; h += '<label class="eep-check-item"><input type="checkbox" class="eep-check" data-sec="' + sec.id + '" data-item="' + ck + '"' + (checked[ck] ? ' checked' : '') + '> ' + esc(items[ci]) + '</label>'; } }
    if (sec.type === 'review') { var total = 0, dn = 0; for (var sti = 0; sti < STAGES.length; sti++) { for (var ssi = 0; ssi < STAGES[sti].sections.length; ssi++) { var ss = STAGES[sti].sections[ssi]; if (ss.type === 'review' || ss.type === 'auditor') continue; total++; if (ws.sectionDone && ws.sectionDone[ss.id]) dn++; } } var pct = total > 0 ? Math.round(dn / total * 100) : 0; h += '<div style="font-size:0.42rem;color:#d0c8b8;margin:8px 0">Progress: <b>' + dn + '/' + total + '</b> sections (' + pct + '%)</div>'; h += '<div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 80 ? '#5ab5a0' : pct >= 50 ? '#C9A94E' : '#e85454') + ';border-radius:4px"></div></div>'; h += '<div style="margin-top:10px"><button class="eep-btn eep-btn-print" data-action="print">PRINT LAUNCH PACKET</button></div>'; }
    if (sec.type === 'auditor') { var aud = ws.auditor || {}; var sl = aud.status || 'DRAFT'; h += '<div class="eep-auditor"><div class="eep-auditor-title">REVIEWER DECISION</div>'; h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>'; h += '<div class="eep-field"><label class="eep-field-label">Regulatory readiness</label><select class="eep-select" data-auditor="reg_ready"><option' + (aud.reg_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.reg_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.reg_ready || aud.reg_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Capital readiness</label><select class="eep-select" data-auditor="capital_ready"><option' + (aud.capital_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.capital_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.capital_ready || aud.capital_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Compliance readiness</label><select class="eep-select" data-auditor="compliance_ready"><option' + (aud.compliance_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.compliance_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.compliance_ready || aud.compliance_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Reviewer comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:60px">' + esc(aud.comments || '') + '</textarea></div>'; h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>'; if (aud.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(aud.timestamp).toLocaleString() + '</div>'; h += '</div>'; }
    h += '</div>';
    return h;
  }

  function autoGenerate(ws, prefill, tmpl) {
    if (ws._autoGenerated) return;
    ws._autoGenerated = true;
    var bizName = (prefill && prefill.businessType) ? prefill.businessType : 'New Finance Business';
    var nodeLabel = (prefill && prefill.nodeLabel) || '';
    var reason = (prefill && prefill.reason) || '';
    if (!ws.fields['concept']) ws.fields['concept'] = {};
    ws.fields['concept']['name'] = ws.fields['concept']['name'] || bizName + ' LLC';
    ws.fields['concept']['node_source'] = ws.fields['concept']['node_source'] || nodeLabel;
    ws.fields['concept']['mapping_title'] = ws.fields['concept']['mapping_title'] || bizName;
    ws.fields['concept']['one_liner'] = ws.fields['concept']['one_liner'] || 'We provide ' + bizName.toLowerCase() + ' services to the financial sector.';
    ws.fields['concept']['full_desc'] = ws.fields['concept']['full_desc'] || reason || (tmpl ? tmpl.description : '');
    if (!ws.fields['market']) ws.fields['market'] = {};
    ws.fields['market']['geography'] = ws.fields['market']['geography'] || 'Regional — United States';
    if (!ws.fields['entity']) ws.fields['entity'] = {};
    ws.fields['entity']['entity_type'] = ws.fields['entity']['entity_type'] || (tmpl ? (tmpl.capitalIntensity === 'high' ? 'C-Corp (VC-backed fintech/lending)' : 'LLC (most common for advisory/agency)') : 'LLC (most common for advisory/agency)');
    if (!ws.fields['startup_costs']) ws.fields['startup_costs'] = {};
    if (tmpl) {
      var costMap = { low: { lic: '3000', tech: '3000', legal: '2000', ins: '2500', comp: '2000', mkt: '2000', wc: '15000', buf: '5000', total: '34500' }, medium: { lic: '15000', tech: '10000', legal: '10000', ins: '5000', comp: '5000', mkt: '10000', wc: '40000', buf: '15000', total: '110000' }, high: { lic: '50000', tech: '50000', legal: '30000', ins: '10000', comp: '15000', mkt: '25000', wc: '150000', buf: '50000', total: '380000' } };
      var costs = costMap[tmpl.capitalIntensity] || costMap['medium'];
      ws.fields['startup_costs']['cost_licensing'] = ws.fields['startup_costs']['cost_licensing'] || costs.lic;
      ws.fields['startup_costs']['cost_technology'] = ws.fields['startup_costs']['cost_technology'] || costs.tech;
      ws.fields['startup_costs']['cost_legal'] = ws.fields['startup_costs']['cost_legal'] || costs.legal;
      ws.fields['startup_costs']['cost_insurance'] = ws.fields['startup_costs']['cost_insurance'] || costs.ins;
      ws.fields['startup_costs']['cost_compliance'] = ws.fields['startup_costs']['cost_compliance'] || costs.comp;
      ws.fields['startup_costs']['cost_marketing'] = ws.fields['startup_costs']['cost_marketing'] || costs.mkt;
      ws.fields['startup_costs']['cost_working_cap'] = ws.fields['startup_costs']['cost_working_cap'] || costs.wc;
      ws.fields['startup_costs']['cost_buffer'] = ws.fields['startup_costs']['cost_buffer'] || costs.buf;
      ws.fields['startup_costs']['cost_total'] = ws.fields['startup_costs']['cost_total'] || costs.total;
    }
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
    if (!ws._prefilled && prefill) { ws._prefilled = true; if (!ws.fields['concept']) ws.fields['concept'] = {}; if (prefill.nodeLabel) ws.fields['concept']['node_source'] = prefill.nodeLabel; if (prefill.businessType) { ws.fields['concept']['mapping_title'] = prefill.businessType; ws.fields['concept']['name'] = prefill.businessType + ' LLC'; } if (prefill.reason) ws.fields['concept']['full_desc'] = prefill.reason; }
    var tmplKey = ws.fields && ws.fields['biz_type'] && ws.fields['biz_type']['template'];
    if (!tmplKey && prefill && prefill.businessType) {
      var bt = (prefill.businessType || '').toLowerCase();
      if (bt.indexOf('wealth') !== -1 || bt.indexOf('advisory') !== -1 || bt.indexOf('ria') !== -1) tmplKey = 'wealth_advisory';
      else if (bt.indexOf('fintech') !== -1 || bt.indexOf('platform') !== -1 || bt.indexOf('neobank') !== -1) tmplKey = 'fintech_platform';
      else if (bt.indexOf('insurance') !== -1 || bt.indexOf('insur') !== -1) tmplKey = 'insurance_agency';
      else if (bt.indexOf('lend') !== -1 || bt.indexOf('mortgage') !== -1 || bt.indexOf('loan') !== -1) tmplKey = 'lending_operation';
      else tmplKey = 'compliance_service';
      if (!ws.fields['biz_type']) ws.fields['biz_type'] = {};
      ws.fields['biz_type']['template'] = tmplKey;
    }
    var tmpl = tmplKey ? TEMPLATES[tmplKey] : null;
    autoGenerate(ws, prefill, tmpl);
    saveWs(oppKey, ws);

    var total = 0, done = 0;
    for (var pi = 0; pi < STAGES.length; pi++) { for (var psi = 0; psi < STAGES[pi].sections.length; psi++) { var ps = STAGES[pi].sections[psi]; if (ps.type === 'review' || ps.type === 'auditor') continue; total++; if (ws.sectionDone && ws.sectionDone[ps.id]) done++; } }
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var status = ws.auditor && ws.auditor.status ? ws.auditor.status : 'DRAFT';

    var h = '<div class="eep-panel" data-opp="' + esc(oppKey) + '" data-track="business">';
    h += '<div class="eep-header" data-toggle="' + oppKey + '-business"><span class="eep-track-label" style="color:#C9A94E">BUSINESS BUILD</span>';
    h += '<span class="eep-progress">' + pct + '% \u00b7 ' + done + '/' + total + ' \u00b7 <span class="eep-status eep-status-' + status.toLowerCase() + '">' + status + '</span></span>';
    h += '<span class="eep-toggle">\u25BC</span></div>';
    h += '<div class="eep-body" data-body="' + oppKey + '-business">';

    h += '<div style="display:flex;gap:4px;margin-bottom:10px;align-items:center">';
    h += '<button class="eep-btn" data-bb-mode="operator" style="' + (mode === 'operator' ? 'color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">OPERATOR MODE</button>';
    h += '<button class="eep-btn" data-bb-mode="auditor" style="' + (mode === 'auditor' ? 'color:#C9A94E;border-color:rgba(201,169,78,0.3);background:rgba(201,169,78,0.08)' : 'color:#807868;border-color:rgba(128,120,104,0.2)') + '">AUDITOR MODE</button>';
    h += '<span style="flex:1"></span><span style="font-size:0.26rem;color:#706860">' + (mode === 'operator' ? 'Simplified guided flow' : 'Full access — all sections') + '</span></div>';

    if (mode === 'operator' && tmpl) { h += '<div style="padding:10px 12px;margin-bottom:12px;border:1px solid rgba(90,181,160,0.15);border-radius:3px;background:rgba(90,181,160,0.03)"><div style="font-size:0.36rem;color:#5ab5a0;margin-bottom:4px">We built this for you based on your business type.</div><div style="font-size:0.32rem;color:#b0a898">Template: <b>' + esc(tmpl.label) + '</b> \u00b7 Capital: ' + esc(tmpl.typicalStartup) + ' \u00b7 ' + (tmpl.regulated ? 'Regulated' : 'Non-regulated') + '</div><div style="font-size:0.30rem;color:#908878;margin-top:4px">' + esc(tmpl.description) + '</div><div style="font-size:0.28rem;color:#807868;margin-top:6px"><b>Legal:</b> ' + esc(tmpl.legalNotes) + '</div><div style="font-size:0.28rem;color:#807868"><b>Funding:</b> ' + esc(tmpl.fundingNotes) + '</div><div style="font-size:0.28rem;color:#807868"><b>Operations:</b> ' + esc(tmpl.operatingNotes) + '</div></div>'; }
    if (mode === 'auditor' && tmpl) { h += '<div style="padding:8px 10px;margin-bottom:10px;border:1px solid rgba(201,169,78,0.12);border-radius:3px;background:rgba(201,169,78,0.03)"><div style="font-size:0.34rem;color:#C9A94E;margin-bottom:2px">' + esc(tmpl.label) + '</div><div style="font-size:0.30rem;color:#908878">' + esc(tmpl.description) + '</div><div style="font-size:0.28rem;color:#807868;margin-top:4px">Capital: ' + esc(tmpl.typicalStartup) + ' \u00b7 ' + (tmpl.regulated ? 'Regulated' : 'Non-regulated') + '</div></div>'; }

    for (var si = 0; si < STAGES.length; si++) {
      var stage = STAGES[si];
      var stageSections = stage.sections.filter(function (sec) { if (mode === 'operator' && AUDITOR_ONLY.indexOf(sec.id) !== -1) return false; return true; });
      if (stageSections.length === 0) continue;
      h += '<div style="margin-bottom:12px"><div style="font-size:0.34rem;letter-spacing:2.5px;color:rgba(201,169,78,0.4);padding:6px 0;border-bottom:1px solid rgba(201,169,78,0.08);margin-bottom:8px">' + esc(stage.title);
      if (mode === 'operator') { var stageConf = 0, stageTotal = 0; for (var sci = 0; sci < stageSections.length; sci++) { if (stageSections[sci].type !== 'review' && stageSections[sci].type !== 'auditor') { stageTotal++; if (ws.sectionDone && ws.sectionDone[stageSections[sci].id]) stageConf++; } } if (stageTotal > 0) h += ' <span style="font-size:0.26rem;color:' + (stageConf === stageTotal ? '#5ab5a0' : '#807868') + '">' + stageConf + '/' + stageTotal + ' confirmed</span>'; }
      h += '</div>';
      for (var ssi = 0; ssi < stageSections.length; ssi++) { var sec = stageSections[ssi]; if (mode === 'operator' && OPERATOR_SECTIONS.indexOf(sec.id) !== -1) h += renderOperatorCard(sec, ws); else h += renderSection(sec, ws); }
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
    if (header && body) { header.addEventListener('click', function () { body.classList.toggle('open'); var t = header.querySelector('.eep-toggle'); if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC'; }); }
    var ws = getWs(oppKey) || { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
    panel.querySelectorAll('.eep-textarea, .eep-input, .eep-select').forEach(function (el) { el.addEventListener('change', function () { var field = this.getAttribute('data-field'); var aud = this.getAttribute('data-auditor'); if (field) { var p = field.split('.'); if (typeof ws.fields[p[0]] !== 'object') ws.fields[p[0]] = {}; ws.fields[p[0]][p[1]] = this.value; } if (aud) { ws.auditor = ws.auditor || {}; ws.auditor[aud] = this.value; } saveWs(oppKey, ws); }); });
    panel.querySelectorAll('.eep-check').forEach(function (el) { el.addEventListener('change', function () { var sec = this.getAttribute('data-sec'), item = this.getAttribute('data-item'); if (!ws.checks[sec]) ws.checks[sec] = {}; ws.checks[sec][item] = this.checked; saveWs(oppKey, ws); }); });
    panel.querySelectorAll('.eep-done-check').forEach(function (el) { el.addEventListener('change', function () { if (!ws.sectionDone) ws.sectionDone = {}; ws.sectionDone[this.getAttribute('data-sec')] = this.checked; saveWs(oppKey, ws); }); });
    panel.querySelectorAll('[data-bb-mode]').forEach(function (el) { el.addEventListener('click', function () { setMode(this.getAttribute('data-bb-mode')); var newH = renderPanel(oppKey, null); panel.outerHTML = newH; wirePanel(container, oppKey); var newPanel = container.querySelector('[data-opp="' + oppKey + '"][data-track="business"]'); if (newPanel) { var nb = newPanel.querySelector('.eep-body'); if (nb) nb.classList.add('open'); } }); });
    panel.querySelectorAll('[data-action]').forEach(function (el) { el.addEventListener('click', function () { var action = this.getAttribute('data-action'); if (action === 'print') { window.print(); return; } ws.auditor = ws.auditor || {}; if (action === 'approve') ws.auditor.status = 'APPROVED'; if (action === 'deny') ws.auditor.status = 'DENIED'; if (action === 'revise') ws.auditor.status = 'REVISE'; ws.auditor.timestamp = Date.now(); saveWs(oppKey, ws); var newH = renderPanel(oppKey, null); panel.outerHTML = newH; wirePanel(container, oppKey); }); });
  }

  window.LIMENFinanceBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[FinanceBusinessBuild] v2 loaded — 7 stages, 5 finance templates, 24+ subsections');
})();
