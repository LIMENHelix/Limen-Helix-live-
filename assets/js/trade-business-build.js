/**
 * trade-business-build.js — BUSINESS BUILD Execution Workspace v2
 *
 * Complete business launch system. 7 stages, 40+ subsections,
 * business-type templates, branching logic, lender-ready financials,
 * 90-day execution plan, deep reviewer mode, printable launch packet.
 *
 * Trade domain only.
 * Exposes: window.LIMENTradeBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  var isTrade = _dom === 'supplyChain' || _dom === 'trade';
  var isWorkspace = window.location.pathname.indexOf('trade-workspace') !== -1;
  if (!isTrade && !isWorkspace) return;

  var STORE_KEY = 'limen_trade_business_build';
  var MODE_KEY = 'limen_bb_mode';
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
    'local_service': {
      label: 'Local Service Business',
      description: 'A business that provides services to customers in a specific geographic area. Examples: HVAC maintenance, electrical contracting, environmental monitoring, site inspection.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$10K-$75K',
      legalNotes: 'LLC is usually sufficient. May need trade licenses, bonding, or professional certifications depending on service type.',
      fundingNotes: 'Often self-funded or with a small SBA microloan ($5K-$50K). Equipment financing common.',
      operatingNotes: 'Revenue starts from day one if you have a customer pipeline. Key risk: customer concentration and seasonal demand.',
      first90: [
        'DAYS 1-5: Go to your state Secretary of State website. File Articles of Organization for an LLC. Cost is typically $50-$300. Write down the confirmation number. OUTPUT: Filed LLC with state confirmation.',
        'DAYS 1-5: Go to irs.gov/ein. Click Apply Online. Select LLC. Enter your business name exactly as filed with the state. Complete the form (5 minutes). Download the EIN confirmation letter as PDF immediately. Save it. OUTPUT: EIN number and PDF confirmation letter.',
        'DAYS 6-10: Go to a bank (Chase, Bank of America, or local credit union). Bring your LLC filing confirmation, EIN letter, and personal ID. Open a business checking account. Ask about a business credit card. OUTPUT: Business checking account number and debit card.',
        'DAYS 6-10: Contact 3 insurance brokers. Request quotes for general liability insurance ($1M coverage). If you provide professional advice, also get Errors and Omissions (E&O) coverage. Compare quotes. Select one and purchase. OUTPUT: Insurance policy document (PDF).',
        'DAYS 11-15: Sign up for QuickBooks Online Simple Start ($30/month) or Wave (free). Connect your business bank account. Set up your chart of accounts: Revenue, Cost of Services, Payroll, Rent, Insurance, Marketing, Other. OUTPUT: Bookkeeping system active and connected to bank.',
        'DAYS 11-15: Create a one-page service description document. Include: what you do, who it is for, pricing, and how to contact you. Create a simple invoice template in QuickBooks or Google Docs. OUTPUT: Service description document and invoice template.',
        'DAYS 16-25: Make a list of 20 potential customers by name. Call, email, or visit the top 10. Offer an introductory price or free consultation. Goal: book 3 paying engagements within 30 days. OUTPUT: Customer contact list and at least 3 booked appointments.',
        'DAYS 16-25: Create a Google Business Profile (free at business.google.com). Add your business name, address, phone, hours, and photos. Ask your first customers to leave reviews. OUTPUT: Live Google Business listing.',
        'DAYS 26-30: Deliver your first services. Collect payment. Review your revenue vs expenses for the month. Identify what worked and what did not. Set goals for month 2. OUTPUT: First revenue collected and first monthly financial review completed.'
      ]
    },
    'advisory': {
      label: 'Advisory / Consulting Business',
      description: 'A business that provides expert advice, analysis, or strategic guidance. Low capital, high margin, knowledge-intensive. Examples: energy consulting, regulatory advisory, grid planning.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$5K-$25K',
      legalNotes: 'LLC or S-Corp recommended. Professional liability insurance (E&O) critical. May need professional certifications.',
      fundingNotes: 'Typically self-funded. No significant equipment. Main cost is time to first client.',
      operatingNotes: 'Revenue depends on reputation and network. First clients often come from existing relationships. Deliverable quality is everything.',
      first90: [
        'DAYS 1-5: File LLC with your state Secretary of State. Apply for EIN at irs.gov/ein. Open business bank account. Total time: 2-3 hours across 2-3 days. OUTPUT: Legal entity, EIN, and bank account.',
        'DAYS 6-10: Purchase professional liability insurance (Errors and Omissions). Contact Hiscox, Hartford, or a local broker. Request $1M-$2M coverage. Typical cost: $500-$1500/year for a solo consultant. OUTPUT: E&O insurance policy active.',
        'DAYS 6-10: Write a 2-page service offering document. Page 1: What problems you solve, who you help, and your qualifications. Page 2: Service packages with pricing (hourly rate, project rate, or retainer). OUTPUT: Service offering PDF ready to send to prospects.',
        'DAYS 11-15: Write down the names of 30 people in your network who work in energy or related industries. Rank them by likelihood of needing your expertise. Contact the top 10 by phone or email. Let them know you are now offering consulting services. Ask if they know anyone who needs help. OUTPUT: 10 outreach conversations completed.',
        'DAYS 16-20: Create a proposal template. Include: executive summary, scope of work, timeline, deliverables, pricing, and terms. Use Google Docs or Word. OUTPUT: Reusable proposal template.',
        'DAYS 16-25: Send your first proposal to a real prospect. Follow up within 48 hours. Negotiate terms if needed. Close the engagement with a signed agreement. OUTPUT: First signed consulting engagement.',
        'DAYS 26-30: Sign up for a time tracking tool (Toggl is free). Track all billable hours. Send your first invoice through QuickBooks. Follow up on payment within 7 days of due date. OUTPUT: First invoice sent and time tracking active.',
        'DAYS 31-60: Deliver your first engagement. Exceed expectations. Ask for a testimonial and a referral. Publish a short article or LinkedIn post about your area of expertise. OUTPUT: First engagement delivered, testimonial received, first content published.',
        'DAYS 61-90: Build a repeatable outreach process: 5 new conversations per week. Track proposals sent, win rate, and average deal size. Set revenue target for month 4-6. OUTPUT: Pipeline system active with measurable metrics.'
      ]
    },
    'trade_operator': {
      label: 'Trade Operator / Logistics Business',
      description: 'A business that operates, manages, or brokers freight, logistics, customs brokerage, or port operations. Examples: freight brokerage, 3PL provider, customs broker, port terminal operator, carrier fleet.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$100K-$5M+',
      legalNotes: 'LLC or C-Corp. Significant regulatory requirements: FMC (Federal Maritime Commission) licensing for ocean freight, CBP (Customs & Border Protection) broker license, DOT compliance for motor carriers. Freight broker bond ($75K surety bond for property brokers required by FMCSA).',
      fundingNotes: 'Requires significant capital. SBA 7(a) common. Equipment financing essential for trucks, containers, and warehouse equipment. Working capital line of credit for cash flow gaps between carrier payment and shipper collection.',
      operatingNotes: 'Revenue from freight contracts, 3PL agreements, customs brokerage fees. Long sales cycles. Carrier relationships and lane pricing are core competencies. Cash flow management critical — carriers often paid faster than shippers pay you.',
      first90: [
        'DAYS 1-7: Hire attorney with freight/trade regulatory experience. Schedule consultation on entity structure, FMC licensing, freight broker bond. OUTPUT: Attorney retained.',
        'DAYS 1-7: Form entity (LLC or C-Corp). File with Secretary of State. Apply for EIN at irs.gov/ein. OUTPUT: Entity formed, EIN obtained.',
        'DAYS 8-14: Apply for freight broker authority with FMCSA (MC number). Processing takes 4-6 weeks. File BOC-3 process agent designation. Obtain $75,000 surety bond or trust fund. OUTPUT: Broker authority application filed, bond obtained.',
        'DAYS 8-14: If handling ocean freight, apply for FMC license (Ocean Transportation Intermediary). Requires $50,000 bond for freight forwarder or $75,000 for NVOCC. OUTPUT: FMC application filed.',
        'DAYS 15-25: Obtain insurance: general liability ($1M), cargo insurance, contingent auto liability, errors & omissions. Contact 3 brokers for quotes. OUTPUT: Insurance policies active.',
        'DAYS 15-25: Set up TMS (Transportation Management System). Evaluate: MercuryGate, Kuebix, Turvo, or industry-specific options. Connect to load boards (DAT, Truckstop). OUTPUT: TMS operational, load board access active.',
        'DAYS 26-35: Establish carrier relationships. Contact 20 carriers. Negotiate rates for key lanes. Set up carrier packets with insurance certificates and W-9s. OUTPUT: Carrier network of 10+ active carriers.',
        'DAYS 26-35: Register on SAM.gov for government freight contracts. Obtain DUNS/UEI number. Check GSA schedules for transportation services. OUTPUT: SAM registration complete.',
        'DAYS 36-50: Begin shipper outreach. Contact 30 potential customers (manufacturers, distributors, importers). Offer competitive rates on their top 5 lanes. Goal: 3 signed shipper agreements. OUTPUT: First shipper agreements signed.',
        'DAYS 51-70: Move first loads. Track on-time delivery, damage claims, and carrier performance. Invoice shippers within 24 hours. Follow up on payment within terms. OUTPUT: First revenue collected, carrier scorecards started.',
        'DAYS 71-90: Review month 1-2 financials. Analyze lane profitability. Expand carrier network for weak lanes. Set growth targets for months 4-6. Begin building repeatable sales pipeline. OUTPUT: Financial review complete, growth plan documented.'
      ]
    },
    'product_equipment': {
      label: 'Product / Equipment Business',
      description: 'A business that manufactures, assembles, or sells physical products or equipment. Examples: monitoring sensors, grid components, safety equipment, energy storage units.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$50K-$500K',
      legalNotes: 'LLC or C-Corp. Product liability insurance critical. May need UL certification, FCC compliance, or industry-specific certifications.',
      fundingNotes: 'Equipment financing + working capital line of credit. Inventory financing may be needed. SBA 7(a) common.',
      operatingNotes: 'Inventory management is critical. Supply chain reliability matters. First customers often come through industry trade shows or direct outreach.',
      first90: [
        'DAYS 1-7: Form LLC or C-Corp. Apply for EIN. Open business bank account. Purchase product liability insurance (critical for physical products). Contact 3 insurance brokers for quotes with $1M-$2M product liability coverage. OUTPUT: Entity formed, EIN, bank account, product liability insurance active.',
        'DAYS 8-14: Finalize product design and specifications. Create a detailed spec sheet: dimensions, materials, performance ratings, compliance standards. If the product needs UL certification or FCC compliance, contact a testing lab now (UL, Intertek, TUV). Certification can take 8-16 weeks. OUTPUT: Product spec sheet and certification timeline.',
        'DAYS 8-14: Identify 3 potential manufacturing or assembly partners. Request quotes for minimum order quantities (MOQ), unit pricing at 100/500/1000 units, lead times, and quality standards. Visit at least one facility if possible. OUTPUT: Manufacturing partner comparison with pricing.',
        'DAYS 15-25: Order materials for first production run or prototype batch. Start with the smallest viable batch (10-50 units). Budget for a 20% scrap/defect rate on first run. OUTPUT: First production batch ordered.',
        'DAYS 15-25: Set up quality control process. Define: acceptance criteria, inspection points, testing procedures, defect tracking. Create a simple QC checklist. OUTPUT: QC process documented.',
        'DAYS 26-35: Build sales collateral: product data sheet (1 page), presentation (10 slides), pricing sheet, and order form. Use Canva or a freelance designer for professional appearance. Budget $500-$2000. OUTPUT: Complete sales collateral package.',
        'DAYS 26-35: Identify the next 3 industry trade shows or conferences in your sector. Register for at least one. Budget $2000-$10000 for booth, travel, and materials. Trade shows are the fastest way to get product visibility. OUTPUT: Trade show registered with booth reserved.',
        'DAYS 36-60: Begin direct outreach to target customers. Send product samples or demo units to top 10 prospects. Follow up within 1 week. Offer introductory pricing for early adopters. OUTPUT: 10 product samples sent, follow-ups scheduled.',
        'DAYS 61-90: Close first purchase order. Fulfill first delivery. Collect payment. Gather customer feedback. Update product or packaging based on feedback. Set production schedule for next batch. OUTPUT: First PO fulfilled, payment collected, customer feedback documented.'
      ]
    },
    'franchise_ready': {
      label: 'Franchise-Ready Business',
      description: 'A business designed from the start to be replicated. Requires standardized operations, training systems, brand package, and legal compliance with franchise law.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$75K-$300K (for the system, not per unit)',
      legalNotes: 'Franchise Disclosure Document (FDD) required by FTC. Must comply with state franchise registration laws. Franchise attorney essential. Trademark registration needed.',
      fundingNotes: 'Initial franchise system development funded by owner. Each franchise unit funded by franchisee. Franchisor earns royalties and fees.',
      operatingNotes: 'You are building a business SYSTEM, not just a business. The product is the operating model itself. Quality control across units is the main challenge.',
      first90: [
        'PREREQUISITE: You must operate your own pilot unit successfully for at least 6 months before starting franchise development. Do not franchise an unproven business. This 90-day plan assumes the pilot is already running.',
        'DAYS 1-10: Hire a franchise attorney. Search the International Franchise Association (franchise.org) directory. Budget $15,000-$40,000 for FDD preparation. Schedule initial consultation to discuss timeline, state registration requirements, and FTC compliance. OUTPUT: Franchise attorney retained.',
        'DAYS 1-10: Register your trademark with the US Patent and Trademark Office (uspto.gov). File a Section 1(a) application if already using the mark in commerce. Budget $250-$350 per class. Trademark approval takes 8-12 months. File now. OUTPUT: Trademark application filed.',
        'DAYS 11-25: Document every standard operating procedure from your pilot unit. Write step-by-step instructions for: opening procedures, service delivery, customer handling, closing procedures, inventory management, quality checks, and emergency protocols. Use screenshots and photos. OUTPUT: Operations manual draft (minimum 50 pages).',
        'DAYS 11-25: Build a training curriculum. Create a 5-day training program that covers: business overview (day 1), operations (days 2-3), customer service (day 4), financial management and reporting (day 5). Include written materials, videos if possible, and assessment tests. OUTPUT: Training curriculum document.',
        'DAYS 26-40: Design your territory model. Decide: exclusive vs non-exclusive territories, minimum population per territory, geographic boundaries, and maximum number of units per market. Create a territory map. OUTPUT: Territory model and map.',
        'DAYS 26-40: Work with your franchise attorney to prepare the Franchise Disclosure Document (FDD). You must provide: franchise fee, royalty structure, estimated initial investment, financial performance representations (Item 19), and 23 total required disclosure items. This takes 4-8 weeks. OUTPUT: FDD draft for legal review.',
        'DAYS 41-60: Build franchise sales materials: franchise overview brochure, investment summary, FAQ document, and franchise application form. Create a simple franchise website or landing page. OUTPUT: Franchise sales package.',
        'DAYS 41-60: Establish a quality audit system. Create a monthly inspection checklist covering: operational compliance, brand standards, customer satisfaction, financial reporting, and cleanliness/safety. Plan to audit each unit quarterly. OUTPUT: Quality audit checklist and schedule.',
        'DAYS 61-90: Identify your first 3 franchisee candidates. Look for: operational experience, adequate capital ($50K-$150K liquid), strong local market knowledge, and alignment with your brand values. Begin the disclosure process (14-day waiting period required by FTC after providing FDD). OUTPUT: First franchisee candidate in disclosure process.'
      ]
    },
    'facility': {
      label: 'Facility-Based / Industrial Business',
      description: 'A business that requires a physical facility: warehouse, lab, plant, or operational base. Examples: battery recycling center, testing lab, equipment depot, data center.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$200K-$2M+',
      legalNotes: 'LLC or C-Corp. Zoning permits, environmental permits, occupational safety compliance (OSHA). May need specialized hazardous materials handling permits.',
      fundingNotes: 'SBA 504 loan for real estate + equipment. Conventional commercial real estate loan. Equipment financing. May qualify for state/federal incentive programs.',
      operatingNotes: 'Facility costs are the largest fixed expense. Utilization rate determines profitability. Location selection is critical and hard to change.',
      first90: [
        'DAYS 1-7: Form entity (LLC or C-Corp). Apply for EIN. Consult with a CPA on entity structure for real estate ownership (may need separate holding company for the property). OUTPUT: Entity formed, EIN obtained, CPA advice on structure.',
        'DAYS 8-14: Define facility requirements: square footage, ceiling height, power requirements (voltage/amperage), water/sewer needs, loading dock access, zoning classification needed, parking, and proximity to customers or transportation. Write these down as a formal requirements document. OUTPUT: Facility requirements specification.',
        'DAYS 8-14: Contact a commercial real estate broker. Share your requirements document. Ask them to identify 5-10 properties. Visit at least 5. Check zoning with the local planning department BEFORE making an offer. OUTPUT: Property shortlist with zoning verification.',
        'DAYS 15-25: Select target property. Negotiate lease or purchase terms. For lease: negotiate tenant improvement allowance, rent abatement period, and lease term (5+ years typical for industrial). For purchase: get commercial appraisal and environmental Phase I assessment. Do not sign until zoning and permits are confirmed. OUTPUT: Letter of intent signed.',
        'DAYS 15-25: Begin permit applications. Contact your city or county building department for required permits: building permit, occupancy permit, fire department approval, environmental permits (if handling hazardous materials), health department (if applicable). Get a complete list with fees and timelines. OUTPUT: Permit applications filed.',
        'DAYS 26-40: Design facility layout. Hire an architect or industrial designer if budget allows ($5K-$20K). Define: production areas, storage areas, office space, loading areas, utility hookups, safety equipment locations, and emergency exits. Get fire department review of layout. OUTPUT: Facility layout plan approved.',
        'DAYS 26-40: Order major equipment. Get final quotes from 3 vendors per major item. Negotiate payment terms (30-50% deposit, balance on delivery). Confirm delivery dates align with facility buildout timeline. OUTPUT: Equipment purchase orders placed.',
        'DAYS 41-55: Hire site manager. This person will oversee daily operations, maintenance, safety compliance, and staff. Write a detailed job description. Post on LinkedIn, Indeed, and industry-specific job boards. Budget $55K-$90K annual salary. OUTPUT: Site manager hired.',
        'DAYS 41-55: Write safety protocols. Include: OSHA compliance checklist, personal protective equipment requirements, emergency evacuation plan, incident reporting procedures, equipment lockout/tagout procedures, and chemical handling protocols (if applicable). Post protocols visibly in the facility. OUTPUT: Safety manual completed and posted.',
        'DAYS 56-75: Set up utility accounts: electricity, gas, water, internet, waste disposal. Install security system (cameras, access control, alarm). Set up vendor accounts for ongoing supplies. OUTPUT: Utilities and vendors active.',
        'DAYS 76-90: Complete facility buildout. Install equipment. Run test operations. Fix issues. Get final inspections from building department and fire department. Obtain certificate of occupancy. Begin serving first customer. OUTPUT: Facility operational with certificate of occupancy.'
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STAGE DEFINITIONS — 7 stages, 40+ subsections
  // ══════════════════════════════════════════════════════════════════════

  var STAGES = [
    // ── STAGE 1: BUSINESS DEFINITION ──
    { id: 'stage1', title: 'STAGE 1 — BUSINESS DEFINITION', sections: [
      { id: 'concept', title: 'Business Concept', type: 'fields',
        guidance: 'Define the business in language anyone can understand. If you cannot explain it in two sentences, you do not understand it well enough yet. The reviewer will reject vague descriptions.',
        fields: [
          { id: 'name', label: 'Business name (draft)', type: 'text', placeholder: 'e.g., Pacific Trade Logistics LLC' },
          { id: 'one_liner', label: 'One-sentence description', type: 'text', placeholder: 'We provide [service/product] to [customer] in [area]' },
          { id: 'full_desc', label: 'Full business description (3-5 sentences)', type: 'textarea', placeholder: 'What does the business do? Who are the customers? How does it make money? What makes it different?' },
          { id: 'node_source', label: 'Node source (from LIMEN mapping)', type: 'text', prefill: 'nodeLabel' },
          { id: 'mapping_title', label: 'Business mapping title', type: 'text', prefill: 'businessType' }
        ] },
      { id: 'market', title: 'Customer & Market', type: 'fields',
        guidance: 'Who pays you? Be specific. "Energy companies" is too vague. "Regional utilities with 50K-500K customers that need grid monitoring" is specific. The more precisely you define your customer, the easier everything else becomes.',
        fields: [
          { id: 'target_customer', label: 'Primary target customer', type: 'textarea', placeholder: 'Describe your ideal customer in detail. Size, type, location, budget, pain point.' },
          { id: 'market_size', label: 'Estimated addressable market', type: 'text', placeholder: 'How many potential customers exist? What do they currently spend on this?' },
          { id: 'geography', label: 'Service geography', type: 'text', placeholder: 'Local, regional, national, or specific states/territories' },
          { id: 'competition', label: 'Main competitors or alternatives', type: 'textarea', placeholder: 'Who else serves this customer? What do they charge? Why would customers switch to you?' },
          { id: 'differentiation', label: 'Why you win', type: 'textarea', placeholder: 'What is your unfair advantage? Speed, price, expertise, location, technology, relationships?' }
        ] },
      { id: 'revenue', title: 'Revenue Model', type: 'fields',
        guidance: 'How does money come in? Be concrete. "We charge $X per Y" is better than "we monetize our platform." Common models: per-hour, per-project, subscription, per-unit, commission, licensing.',
        fields: [
          { id: 'model_type', label: 'Revenue model', type: 'select', options: ['Per-hour/day rate', 'Per-project fixed fee', 'Monthly subscription', 'Per-unit product sales', 'Commission/referral', 'Licensing/royalty', 'Retainer', 'Mixed', 'Other'] },
          { id: 'pricing', label: 'Pricing structure', type: 'textarea', placeholder: 'What do you charge? How much? Is there a range? What is your average deal size?' },
          { id: 'payment_terms', label: 'Payment terms', type: 'text', placeholder: 'Net 30, upfront, milestone-based, COD?' },
          { id: 'recurring', label: 'Recurring vs one-time revenue', type: 'select', options: ['Mostly recurring (subscriptions, retainers)', 'Mostly one-time (projects, sales)', 'Mixed (some recurring, some project)', 'Undecided'] }
        ] },
      { id: 'biz_type', title: 'Business Type & Mode', type: 'fields',
        guidance: 'Choose the template that best matches your business. This affects which sections appear below. Basic Build = one location or operation. Franchise-Ready = designed for replication.',
        fields: [
          { id: 'template', label: 'Business type template', type: 'select', options: ['local_service', 'advisory', 'trade_operator', 'product_equipment', 'franchise_ready', 'facility'] },
          { id: 'build_mode', label: 'Build mode', type: 'select', options: ['Basic Build', 'Franchise-Ready Build'] },
          { id: 'capital_intensity', label: 'Capital intensity', type: 'select', options: ['Low ($5K-$50K)', 'Medium ($50K-$300K)', 'High ($300K+)'] },
          { id: 'regulated', label: 'Regulated industry?', type: 'select', options: ['No', 'Yes — light regulation', 'Yes — heavy regulation (permits, inspections, compliance)'] }
        ] }
    ]},

    // ── STAGE 2: LEGAL FORMATION ──
    { id: 'stage2', title: 'STAGE 2 — LEGAL FORMATION', sections: [
      { id: 'entity', title: 'Entity Choice', type: 'fields',
        guidance: 'Your entity type determines your liability protection, tax treatment, and ability to raise money. LLC is the most common for small businesses — it protects your personal assets and is simple to set up. S-Corp can save on self-employment tax if you pay yourself a salary. C-Corp is for businesses that plan to raise outside investment. Talk to an accountant before choosing if unsure.',
        fields: [
          { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC (most common)', 'S-Corp (tax optimization)', 'C-Corp (outside investment)', 'Sole Proprietorship (simplest, no liability protection)', 'Partnership', 'Undecided — need advice'] },
          { id: 'state', label: 'State of formation', type: 'text', placeholder: 'Most businesses form in their home state. Delaware or Wyoming for special cases.' },
          { id: 'name_check', label: 'Name availability checked?', type: 'select', options: ['Not yet', 'Available — confirmed with Secretary of State', 'Taken — need alternative', 'Reserved'] },
          { id: 'formation_cost', label: 'Estimated formation cost', type: 'text', placeholder: 'Filing fees ($50-$500) + attorney if used ($500-$2000)' }
        ] },
      { id: 'tax_id', title: 'Tax ID & Registration', type: 'mixed',
        guidance: 'An EIN (Employer Identification Number) is like a Social Security Number for your business. You need it to open a bank account, hire employees, and file taxes. It is free and takes 5 minutes at irs.gov/ein.',
        fields: [
          { id: 'ein', label: 'EIN', type: 'text', placeholder: 'Apply free at irs.gov/ein — takes 5 minutes' },
          { id: 'state_tax_id', label: 'State tax registration', type: 'text', placeholder: 'Sales tax permit, withholding account if applicable' }
        ],
        checklist: ['EIN obtained from IRS', 'State tax registration complete', 'Sales tax permit (if selling taxable goods)', 'Payroll tax accounts set up (if hiring employees)'] },
      { id: 'governance', title: 'Governance & Agreements', type: 'checklist',
        guidance: 'These documents define how your business is run, who owns what, and what happens when things change. An operating agreement is required for multi-member LLCs and strongly recommended for single-member LLCs.',
        items: ['Operating agreement drafted (LLC) or bylaws adopted (Corp)', 'Ownership percentages documented', 'Vesting schedule for founders (if multiple owners)', 'Buy-sell agreement (if multiple owners)', 'Intellectual property assignment agreement', 'Non-compete / non-solicitation agreements (if needed)', 'Employee handbook (if hiring)'] },
      { id: 'compliance', title: 'Licenses, Permits & Insurance', type: 'mixed',
        guidance: 'Every business needs basic insurance. Many businesses need specific licenses or permits. Check with your city, county, and state. A general liability policy typically costs $500-$2000/year for a small business. Skip this and one lawsuit can end your business.',
        fields: [
          { id: 'gl_insurance', label: 'General liability insurance', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'pl_insurance', label: 'Professional liability (E&O)', type: 'select', options: ['Not needed', 'Not yet', 'Quoted', 'Purchased'] },
          { id: 'wc_insurance', label: 'Workers compensation', type: 'select', options: ['Not needed (no employees)', 'Not yet', 'Purchased'] },
          { id: 'auto_insurance', label: 'Commercial auto', type: 'select', options: ['Not needed', 'Not yet', 'Purchased'] }
        ],
        checklist: ['Business license (city/county)', 'State business registration', 'Professional certifications (if required)', 'Trade licenses (if required)', 'Environmental permits (if applicable)', 'Zoning approval (if facility-based)', 'Health/safety inspection (if applicable)', 'Bonding (if required by industry or contracts)'] },
      { id: 'banking', title: 'Banking & Bookkeeping', type: 'checklist',
        guidance: 'Open a business bank account immediately. Never mix personal and business money — it destroys your liability protection and makes taxes a nightmare. Set up bookkeeping software on day one, not "when you have time."',
        items: ['Business checking account opened', 'Business savings account opened', 'Business credit card obtained', 'Bookkeeping software set up (QuickBooks, Xero, Wave)', 'Chart of accounts configured', 'Receipt/expense tracking system active', 'Accountant or bookkeeper identified', 'Payroll system set up (if hiring — Gusto, ADP, etc.)'] }
    ]},

    // ── STAGE 3: FUNDING PREPARATION ──
    { id: 'stage3', title: 'STAGE 3 — FUNDING PREPARATION', sections: [
      { id: 'startup_costs', title: 'Startup Cost Estimate', type: 'fields',
        guidance: 'List every dollar you need to spend before the business opens its doors AND for the first 3 months of operation. Underestimating startup costs is the #1 reason new businesses fail. Add 15-20% buffer for surprises. Lenders will question your seriousness if this section is vague.',
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
        guidance: 'Where will the money come from? This must equal your total startup cost. Lenders want to see that you have skin in the game — typically 10-25% of the total as owner equity. The rest can come from loans, grants, or other sources.',
        fields: [
          { id: 'src_owner', label: 'Owner equity / cash injection ($)', type: 'text' },
          { id: 'src_sba', label: 'SBA or term loan ($)', type: 'text' },
          { id: 'src_equipment', label: 'Equipment financing ($)', type: 'text' },
          { id: 'src_loc', label: 'Line of credit ($)', type: 'text' },
          { id: 'src_grant', label: 'Grant funding ($)', type: 'text' },
          { id: 'src_investor', label: 'Outside investment ($)', type: 'text' },
          { id: 'src_other', label: 'Other sources ($)', type: 'text' },
          { id: 'src_total', label: 'TOTAL SOURCES ($)', type: 'text', placeholder: 'Must equal total startup cost' }
        ] },
      { id: 'loan_prep', title: 'Loan & Financing Readiness', type: 'mixed',
        guidance: 'If you need a loan, prepare like you are going to a job interview. The lender is deciding whether to trust you with their money. Sloppy preparation = instant rejection. Clean financials, clear plan, realistic numbers = fundable business.\n\nSBA 7(a): Most common small business loan. Up to $5M. Requires 10-20% down. Government guarantees part of the loan so banks take less risk.\nSBA Microloan: $500-$50K. Good for very small startups. Often from CDFIs (community lenders).\nEquipment financing: Loan secured by the equipment itself. 80-100% of equipment value. Equipment is the collateral.\nLine of credit: Revolving credit for cash flow gaps. Use it, pay it back, reuse. Good for businesses with uneven revenue.\nConventional term loan: Bank loan without SBA guarantee. Harder to get for new businesses. Lower fees.',
        fields: [
          { id: 'loan_type', label: 'Primary loan type', type: 'select', options: ['SBA 7(a)', 'SBA 504 (real estate)', 'SBA Microloan', 'Conventional term loan', 'Equipment financing', 'Line of credit', 'Not seeking loan', 'Undecided'] },
          { id: 'loan_amount', label: 'Loan amount requested ($)', type: 'text' },
          { id: 'personal_credit', label: 'Personal credit score', type: 'text', placeholder: '680+ for SBA, 720+ for conventional' },
          { id: 'collateral', label: 'Available collateral', type: 'textarea', placeholder: 'Real estate, equipment, accounts receivable, personal guarantee' },
          { id: 'down_payment', label: 'Down payment / equity injection ($)', type: 'text', placeholder: 'Most lenders want 10-25%' }
        ],
        checklist: ['Personal financial statement prepared', 'Business plan with executive summary written', 'Pro forma financial projections complete', 'Tax returns available (2+ years personal)', 'Bank statements available (3-6 months)', 'Collateral documentation with values', 'Resume / management bio ready', 'Existing debt schedule documented', 'Legal entity formed with EIN', 'Insurance quotes obtained', 'Lease or property agreement (if applicable)'] }
    ]},

    // ── STAGE 4: FINANCIAL READINESS ──
    { id: 'stage4', title: 'STAGE 4 — FINANCIAL READINESS', sections: [
      { id: 'proforma', title: '12-Month Pro Forma', type: 'fields',
        guidance: 'A pro forma is your best estimate of what the business will earn and spend over the next 12 months. Lenders and reviewers will scrutinize this. Be conservative. If you think revenue will be $20K/month, put $15K. Optimistic projections destroy credibility.',
        fields: [
          { id: 'monthly_revenue', label: 'Projected monthly revenue ($)', type: 'text', placeholder: 'Conservative — not best case' },
          { id: 'revenue_basis', label: 'Revenue assumptions', type: 'textarea', placeholder: 'How did you arrive at this number? X customers × $Y average = $Z/month' },
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
          { id: 'min_revenue', label: 'Minimum viable revenue ($)', type: 'text', placeholder: 'Floor — below this the business cannot pay its bills' },
          { id: 'dscr', label: 'DSCR (Debt Service Coverage Ratio)', type: 'text', placeholder: 'Net operating income / total debt payments. Lenders want ≥ 1.25' },
          { id: 'downside', label: 'Downside scenario', type: 'textarea', placeholder: 'What if revenue is 40% lower than projected? Can the business survive? For how long?' }
        ] }
    ]},

    // ── STAGE 5: OPERATING MODEL ──
    { id: 'stage5', title: 'STAGE 5 — OPERATING MODEL', sections: [
      { id: 'delivery', title: 'Service / Product Delivery', type: 'fields',
        guidance: 'How do you actually deliver the service or product? Walk through the process from customer order to delivery to payment collection. The more specific, the more credible.',
        fields: [
          { id: 'offer', label: 'Core offer', type: 'textarea', placeholder: 'Exactly what do you deliver? In what timeframe? At what quality standard?' },
          { id: 'process', label: 'Delivery process (step by step)', type: 'textarea', placeholder: '1. Customer requests → 2. Quote/proposal → 3. Agreement → 4. Deliver → 5. Invoice → 6. Collect' },
          { id: 'quality', label: 'Quality standards / SLAs', type: 'textarea', placeholder: 'Response time, uptime guarantee, defect rate, satisfaction metric' },
          { id: 'capacity', label: 'Maximum capacity', type: 'text', placeholder: 'How many customers/projects can you handle at once?' }
        ] },
      { id: 'team', title: 'Team & Staffing', type: 'fields',
        guidance: 'Who does the work? Even if it is just you at first, write down what roles need to exist and when you plan to fill them.',
        fields: [
          { id: 'founder_role', label: 'Founder/owner role', type: 'textarea', placeholder: 'What do you personally do? Sales, delivery, management, everything?' },
          { id: 'first_hire', label: 'First hire (role + timing)', type: 'text', placeholder: 'e.g., Operations technician at month 3' },
          { id: 'staff_plan', label: 'Year 1 staffing plan', type: 'textarea', placeholder: 'Month 1: founder only. Month 3: add technician. Month 6: add admin. Month 9: add sales.' },
          { id: 'compensation', label: 'Compensation approach', type: 'textarea', placeholder: 'Salary ranges, commission structure, benefits' }
        ] },
      { id: 'infrastructure', title: 'Location, Equipment & Systems', type: 'fields',
        guidance: 'What physical and digital infrastructure does the business need?',
        fields: [
          { id: 'location', label: 'Location / facility', type: 'text', placeholder: 'Office, warehouse, remote, client sites, hybrid' },
          { id: 'equipment_list', label: 'Key equipment', type: 'textarea', placeholder: 'List major equipment items with approximate costs' },
          { id: 'software', label: 'Software / systems', type: 'textarea', placeholder: 'CRM, accounting, scheduling, project management, communications' },
          { id: 'vendors', label: 'Key vendors and suppliers', type: 'textarea', placeholder: 'Who do you buy from? Are there alternatives?' }
        ] },
      { id: 'customers', title: 'Customer Acquisition', type: 'fields',
        guidance: 'How will you get customers? This is the most important question after "what does the business do?" A great business with no customers is just an expensive hobby.',
        fields: [
          { id: 'first_10', label: 'How will you get your first 10 customers?', type: 'textarea', placeholder: 'Be specific. Names if possible. Channels: direct outreach, referrals, online, events, partnerships.' },
          { id: 'ongoing', label: 'Ongoing acquisition strategy', type: 'textarea', placeholder: 'After the first 10: what repeatable process will keep customers coming?' },
          { id: 'cac', label: 'Estimated customer acquisition cost', type: 'text', placeholder: 'How much does it cost to get one new customer?' },
          { id: 'ltv', label: 'Estimated customer lifetime value', type: 'text', placeholder: 'How much does one customer pay you over their entire relationship?' }
        ] },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields',
        guidance: 'The first 90 days determine whether the business has momentum or stalls. Break it into 30-day blocks. Each block should have clear deliverables, not vague goals.',
        fields: [
          { id: 'days_1_30', label: 'Days 1-30: Foundation', type: 'textarea', placeholder: 'Formation, accounts, insurance, initial setup. What must be DONE by day 30?' },
          { id: 'days_31_60', label: 'Days 31-60: Operations', type: 'textarea', placeholder: 'First customers, first revenue, first delivery. What must be LIVE by day 60?' },
          { id: 'days_61_90', label: 'Days 61-90: Growth', type: 'textarea', placeholder: 'Repeat customer delivery, first hire, marketing active. What must be PROVEN by day 90?' },
          { id: 'year1_priorities', label: 'Year 1 priorities (top 5)', type: 'textarea', placeholder: '1. Reach break-even\n2. Build customer pipeline\n3. Hire key roles\n4. Establish processes\n5. Build reputation' }
        ] }
    ]},

    // ── STAGE 6: DOCUMENTS ──
    { id: 'stage6', title: 'STAGE 6 — DOCUMENT PACKET', sections: [
      { id: 'legal_docs', title: 'Legal & Formation Documents', type: 'checklist',
        guidance: 'These documents prove your business legally exists and is properly structured.',
        items: ['Articles of organization / incorporation', 'Operating agreement / bylaws', 'EIN confirmation letter', 'State business registration', 'Trade name registration (DBA if needed)', 'Ownership certificates or membership interests'] },
      { id: 'financial_docs', title: 'Financial Documents', type: 'checklist',
        guidance: 'These documents prove your financial readiness and projections.',
        items: ['Business plan / executive summary', '12-month financial projections', 'Uses and sources of funds table', 'Personal financial statement (all owners)', 'Personal tax returns (2-3 years)', 'Bank statements (3-6 months)', 'Collateral documentation', 'Existing debt schedule'] },
      { id: 'operating_docs', title: 'Operating Documents', type: 'checklist',
        guidance: 'These documents prove you can actually run the business.',
        items: ['Service/product description', 'Pricing schedule', 'First 90-day plan', 'Staffing plan', 'Customer acquisition plan', 'Vendor/supplier agreements', 'Lease or facility agreement', 'Equipment list with quotes', 'Insurance policies or quotes'] },
      { id: 'lender_packet', title: 'Lender Packet (if seeking loan)', type: 'checklist',
        guidance: 'If you are applying for a loan, the lender will ask for ALL of these. Having them organized in one packet shows you are serious and prepared.',
        items: ['Completed loan application', 'Business plan with executive summary', '12-month pro forma', 'Personal financial statement', 'Personal tax returns (2+ years)', 'Bank statements (3-6 months)', 'Collateral with valuations', 'Resume / management bios', 'Proof of entity formation + EIN', 'Insurance documentation', 'Lease agreement', 'Existing debt schedule', 'Accounts receivable/payable (if existing business)'] }
    ]},

    // ── STAGE 7: REVIEW & APPROVAL ──
    { id: 'stage7', title: 'STAGE 7 — REVIEW & APPROVAL', sections: [
      { id: 'readiness', title: 'Launch Readiness Review', type: 'review',
        guidance: 'This is the final gate. The reviewer checks every stage for completeness, consistency, and viability. All critical items must be addressed before approval.' },
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

    // Edit toggle — expands to show full section
    h += '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:0.28rem;color:rgba(201,169,78,0.5);letter-spacing:1px">EDIT \u25BC</summary>';
    h += '<div style="margin-top:6px">';
    // Render full editable fields inside the toggle
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

    var bizName = (prefill && prefill.businessType) ? prefill.businessType : 'New Trade Business';
    var nodeLabel = (prefill && prefill.nodeLabel) || '';
    var reason = (prefill && prefill.reason) || '';

    // Stage 1 defaults
    if (!ws.fields['concept']) ws.fields['concept'] = {};
    ws.fields['concept']['name'] = ws.fields['concept']['name'] || bizName + ' LLC';
    ws.fields['concept']['node_source'] = ws.fields['concept']['node_source'] || nodeLabel;
    ws.fields['concept']['mapping_title'] = ws.fields['concept']['mapping_title'] || bizName;
    ws.fields['concept']['one_liner'] = ws.fields['concept']['one_liner'] || 'We provide ' + bizName.toLowerCase() + ' services to the trade and logistics sector.';
    ws.fields['concept']['full_desc'] = ws.fields['concept']['full_desc'] || reason || (tmpl ? tmpl.description : '');

    if (!ws.fields['market']) ws.fields['market'] = {};
    ws.fields['market']['geography'] = ws.fields['market']['geography'] || 'Regional — United States';

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

    // Template info — detect from biz_type or infer from prefill
    var tmplKey = ws.fields && ws.fields['biz_type'] && ws.fields['biz_type']['template'];
    if (!tmplKey && prefill && prefill.businessType) {
      var bt = (prefill.businessType || '').toLowerCase();
      if (bt.indexOf('consult') !== -1 || bt.indexOf('advisory') !== -1) tmplKey = 'advisory';
      else if (bt.indexOf('freight') !== -1 || bt.indexOf('logistics') !== -1 || bt.indexOf('shipping') !== -1 || bt.indexOf('customs') !== -1 || bt.indexOf('port') !== -1 || bt.indexOf('carrier') !== -1 || bt.indexOf('broker') !== -1) tmplKey = 'trade_operator';
      else if (bt.indexOf('product') !== -1 || bt.indexOf('equipment') !== -1 || bt.indexOf('manufactur') !== -1) tmplKey = 'product_equipment';
      else if (bt.indexOf('facility') !== -1 || bt.indexOf('warehouse') !== -1 || bt.indexOf('lab') !== -1) tmplKey = 'facility';
      else tmplKey = 'local_service';
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

    // Operator mode: "We built this for you" banner
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

    // Template banner (auditor mode)
    if (mode === 'auditor' && tmpl) {
      h += '<div style="padding:8px 10px;margin-bottom:10px;border:1px solid rgba(201,169,78,0.12);border-radius:3px;background:rgba(201,169,78,0.03)">';
      h += '<div style="font-size:0.34rem;color:#C9A94E;margin-bottom:2px">' + esc(tmpl.label) + '</div>';
      h += '<div style="font-size:0.30rem;color:#908878">' + esc(tmpl.description) + '</div>';
      h += '<div style="font-size:0.28rem;color:#807868;margin-top:4px">Capital: ' + esc(tmpl.typicalStartup) + ' \u00b7 ' + (tmpl.regulated ? 'Regulated' : 'Non-regulated') + '</div>';
      h += '</div>';
    }

    // Render stages — filtered by mode
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
        // Count confirmed sections in this stage
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
          // Operator mode: show as confirm/edit card with pre-filled content
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
        // Re-open the panel body
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

  window.LIMENTradeBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[TradeBusinessBuild] v2 loaded — 7 stages, 6 templates, 40+ subsections');
})();
