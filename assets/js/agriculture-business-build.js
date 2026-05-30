/* ============================================================
   agriculture-business-build.js
   Agriculture Domain — Business Builder Workspace
   Namespace : window.LIMENAgricultureBusinessBuild
   Storage   : limen_agriculture_business_build
   CSS prefix: .abb-
   ============================================================ */
(function () {
  'use strict';

  /* ── Self-gate ─────────────────────────────────────────────── */
  var params = new URLSearchParams(window.location.search);
  var dominated = params.get('domain');
  var path = window.location.pathname.toLowerCase();
  if (dominated !== 'agriculture' && path.indexOf('agriculture-workspace') === -1) return;

  /* ── Constants ─────────────────────────────────────────────── */
  var STORAGE_KEY = 'limen_agriculture_business_build';
  var ACCENT     = '#5ab5a0';
  var ACCENT_DIM = 'rgba(90,181,160,0.15)';
  var ACCENT_MED = 'rgba(90,181,160,0.35)';

  /* ── Business Archetypes ───────────────────────────────────── */
  var BUSINESS_TYPES = {
    PRECISION_AG_PLATFORM: {
      label: 'Precision Agriculture Platform',
      desc: 'SaaS/hardware for precision agriculture — soil sensors, drone analytics, variable rate application.',
      icon: '\u{1F4E1}',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$50K-$300K',
      legalNotes: 'LLC or C-Corp. May need FCC compliance for radio-frequency sensors. Data privacy considerations for farm data.',
      fundingNotes: 'USDA SBIR/STTR grants ($150K-$1M). Equipment financing for hardware. Seed/angel for SaaS platform.',
      operatingNotes: 'Revenue from SaaS subscriptions per acre plus hardware sales. Seasonal onboarding window (pre-planting). Retention depends on yield impact proof.',
      first90: [
        'DAYS 1-5: File LLC with your state Secretary of State. Apply for EIN at irs.gov/ein. Open business bank account. Total cost: $100-$400. OUTPUT: Legal entity, EIN, bank account.',
        'DAYS 1-5: Purchase general liability insurance and product liability insurance (critical for hardware deployed on farms). Contact 3 brokers for $1M coverage quotes. Budget $800-$2000/year. OUTPUT: Insurance policies active.',
        'DAYS 6-12: Finalize sensor hardware spec sheet: soil moisture, temperature, EC, GPS coordinates, wireless protocol (LoRa/cellular). Get 3 manufacturer quotes for prototype batch of 20-50 units. Budget $5K-$15K for first batch. OUTPUT: Hardware spec and manufacturer selected.',
        'DAYS 6-12: Set up cloud data platform. Use AWS IoT Core or Azure IoT Hub. Build data ingestion pipeline: sensor → gateway → cloud → dashboard. Budget $200-$500/month. OUTPUT: Cloud infrastructure receiving test data.',
        'DAYS 13-20: Build MVP dashboard: field map, sensor readings, soil moisture trend, variable rate prescription export. Use React or Vue frontend. Target: farmer can view their field data within 60 seconds of login. OUTPUT: Working dashboard with test data.',
        'DAYS 13-20: Contact 5 county extension agents in your target region. Introduce your platform. Ask for introductions to progressive farmers. Extension agents are the single best channel for ag-tech adoption. OUTPUT: 5 extension agent conversations, 3+ farmer introductions.',
        'DAYS 21-35: Deploy sensors on 3 pilot farms (free or heavily discounted). Install hardware, verify data transmission, train farmer on dashboard. Document everything — photos, setup time, issues encountered. OUTPUT: 3 pilot deployments live and transmitting.',
        'DAYS 36-60: Collect 30+ days of field data from pilots. Generate first variable rate prescriptions (nitrogen, irrigation). Compare against farmer baseline practices. Calculate potential yield improvement and input cost savings. OUTPUT: Pilot results with documented ROI.',
        'DAYS 61-75: Build pricing model: per-acre SaaS fee ($3-$8/acre/season) plus hardware cost ($200-$500/sensor kit). Create sales deck showing pilot ROI data. OUTPUT: Pricing sheet and sales presentation.',
        'DAYS 76-90: Sign first 5 paying customers for upcoming season. Offer early-adopter discount (20% off Year 1). Process first invoices through QuickBooks. Set deployment schedule for their fields. OUTPUT: 5 signed contracts, first revenue collected.'
      ]
    },
    AGRI_SUPPLY_CHAIN: {
      label: 'Agricultural Supply Chain',
      desc: 'Cold chain logistics, grain storage, distribution network.',
      icon: '\u{1F69A}',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$200K-$2M+',
      legalNotes: 'LLC or C-Corp. USDA facility inspection for food handling. State weights & measures certification for grain storage. DOT compliance for trucking. Food safety (FSMA) compliance required.',
      fundingNotes: 'SBA 7(a) or 504 loan for facility and equipment. USDA Rural Development grants. State agricultural development grants. Equipment financing essential.',
      operatingNotes: 'Revenue from per-bushel storage fees, logistics per-mile rates, and handling/processing margins. Seasonal peaks during harvest (Sept-Nov). Cold chain requires 24/7 monitoring.',
      first90: [
        'DAYS 1-7: Hire an attorney with agricultural and food safety experience. Discuss entity structure (LLC vs C-Corp), facility permits, USDA inspection requirements, and FSMA compliance. Budget $500-$1000 for initial consultation. OUTPUT: Attorney retained, legal roadmap documented.',
        'DAYS 1-7: Form entity with Secretary of State. Apply for EIN at irs.gov/ein. If handling food products, register with FDA (free at fda.gov/furls). OUTPUT: Entity formed, EIN obtained, FDA registration submitted.',
        'DAYS 8-15: Identify all permits required: USDA facility license, state Department of Agriculture inspection, weights & measures certification (for grain), environmental permits (for waste/runoff), building occupancy permit. Make list with deadlines and fees. OUTPUT: Complete permit requirements list.',
        'DAYS 8-15: Define facility requirements: square footage, refrigeration capacity (BTU), loading dock count, floor drain specs, pest control systems, temperature monitoring. Write a formal specification document. OUTPUT: Facility requirements specification.',
        'DAYS 16-25: Contact a commercial real estate broker specializing in agricultural/industrial properties. Visit 5+ candidate facilities. Verify zoning with local planning department BEFORE signing. Check proximity to major growing regions and highways. OUTPUT: Facility shortlist with zoning confirmed.',
        'DAYS 16-25: Get equipment quotes from 3+ vendors for: cold storage units, grain handling equipment, conveyor systems, scales, temperature monitoring systems, and delivery vehicles. Compare total cost of ownership. OUTPUT: Equipment vendor comparison table.',
        'DAYS 26-40: Select target facility and negotiate lease or purchase. For cold chain: negotiate tenant improvement allowance for insulation and refrigeration installation. Budget $50K-$300K for buildout depending on scope. OUTPUT: Facility lease or purchase agreement signed.',
        'DAYS 26-40: Begin SBA 7(a) or 504 loan application. Bring: business plan, pro forma projections, personal financial statement, 3 years tax returns, collateral documentation. Also search grants.gov for USDA Rural Development programs. OUTPUT: Loan application and grant applications submitted.',
        'DAYS 41-55: Hire operations manager with cold chain or grain handling experience. Post on AgCareers.com and LinkedIn. Budget $55K-$85K salary. Also hire 2-3 warehouse staff. OUTPUT: Operations manager and initial crew hired.',
        'DAYS 41-55: Write food safety plan (required by FSMA): hazard analysis, preventive controls, monitoring procedures, corrective actions, verification, recall plan. Have attorney and ops manager review. OUTPUT: Food safety plan (HARPC) completed.',
        'DAYS 56-75: Complete facility buildout. Install equipment. Run test operations with sample product. Get USDA facility inspection. Get state Department of Agriculture approval. Obtain certificate of occupancy. OUTPUT: Facility operational with all permits.',
        'DAYS 76-90: Contact first 10 target customers: local farms, grain elevators, food processors, grocery distributors. Offer introductory storage or logistics rates. Sign first 3 contracts. Begin operations. OUTPUT: First 3 customer contracts signed, revenue started.'
      ]
    },
    AGRI_BIOTECH: {
      label: 'Agricultural Biotech',
      desc: 'Seed technology, biological crop protection, soil microbiome.',
      icon: '\u{1F9EC}',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$100K-$1M+',
      legalNotes: 'C-Corp preferred (for investment). EPA registration required for biopesticides. USDA APHIS notification/permit for genetically modified organisms. Patent protection critical — file provisional patents early.',
      fundingNotes: 'USDA SBIR Phase I ($150K) and Phase II ($600K). NSF SBIR for fundamental science. USDA NIFA grants. Angel/VC for Series A. State biotech incentive programs.',
      operatingNotes: 'Revenue from seed licensing royalties, biopesticide sales per acre, or microbiome treatment subscriptions. Long development cycles (2-5 years to market). University partnerships accelerate research.',
      first90: [
        'DAYS 1-5: Form C-Corp (preferred for future investment). Delaware incorporation recommended if seeking VC. Apply for EIN. Open business bank account. OUTPUT: C-Corp formed, EIN obtained, bank account open.',
        'DAYS 1-5: File provisional patent application for your core technology. Search patents.google.com for prior art first. Budget $2K-$5K with a patent attorney. The 12-month priority window starts now — use it. OUTPUT: Provisional patent filed.',
        'DAYS 6-12: Contact 3 university agricultural research departments (land-grant universities preferred). Propose a sponsored research agreement or CRADA (Cooperative Research and Development Agreement). University partnerships provide lab access, field trial sites, and credibility. OUTPUT: 3 university conversations initiated, 1+ partnership discussion active.',
        'DAYS 6-12: Apply for USDA SBIR Phase I grant ($150K, 6-month project). Submission windows: June and October typically. Draft: technical proposal (15 pages), budget, commercialization plan. This is non-dilutive funding. OUTPUT: SBIR Phase I application submitted or timeline set for next window.',
        'DAYS 13-25: Set up laboratory or contract with a CRO (Contract Research Organization) for initial bioassays. For biopesticides: efficacy testing against target pests. For seed tech: germination and vigor testing. For microbiome: soil inoculation trials. Budget $10K-$50K. OUTPUT: Lab or CRO engaged, first experiments designed.',
        'DAYS 13-25: Begin EPA pre-submission consultation for biopesticide registration (if applicable). EPA Biopesticides and Pollution Prevention Division offers free pre-submission meetings. This saves months later. For GMO work, file USDA APHIS notification. OUTPUT: Regulatory pre-submission meeting scheduled or notification filed.',
        'DAYS 26-45: Run first round of controlled experiments. Document everything per GLP (Good Laboratory Practices). Collect efficacy data, phytotoxicity data, and environmental fate data. These become the foundation of your regulatory submission and investor pitch. OUTPUT: First experimental results documented.',
        'DAYS 46-60: Design field trial protocol for upcoming growing season. Identify 3-5 cooperating farms or university research stations. Randomized block design with proper controls. Obtain any required state experimental use permits. OUTPUT: Field trial protocol approved, sites selected.',
        'DAYS 61-75: Build investor pitch deck: problem, solution, technology, IP position, market size ($X billion addressable), regulatory pathway, team, financials, ask. Target: $500K-$2M seed round. Identify 10 ag-focused angel investors or VC firms (AgFunder, Sprout, SVG Ventures). OUTPUT: Pitch deck complete, 10 investor targets identified.',
        'DAYS 76-90: Begin investor outreach. Send deck to top 10 targets. Schedule 5+ pitch meetings. Simultaneously prepare USDA NIFA grant application ($250K-$500K) as backup non-dilutive path. OUTPUT: 5+ investor meetings scheduled, NIFA application in progress.'
      ]
    },
    FARM_FINANCE: {
      label: 'Farm Finance',
      desc: 'Agricultural lending, crop insurance, commodity hedging platform.',
      icon: '\u{1F4B0}',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$75K-$500K',
      legalNotes: 'LLC or C-Corp. State lending license required if making loans. Insurance agent license required for crop insurance. CFTC/NFA registration if offering commodity futures advisory. Compliance attorney essential.',
      fundingNotes: 'Self-funded or angel round for platform development. USDA Farm Service Agency partnership for distribution. Community Development Financial Institution (CDFI) designation for favorable lending terms.',
      operatingNotes: 'Revenue from loan origination fees, insurance commissions, advisory fees, or SaaS subscriptions. Farm Credit System and FSA are both partners and competitors. Seasonal demand tied to planting and harvest finance cycles.',
      first90: [
        'DAYS 1-7: Hire a financial services compliance attorney. Discuss: state lending license requirements, insurance licensing, CFTC/NFA registration (if commodity advisory), and money transmitter laws. This is a regulated industry — get legal right first. Budget $1K-$3K initial consultation. OUTPUT: Attorney retained, regulatory roadmap documented.',
        'DAYS 1-7: Form entity (LLC or C-Corp). Apply for EIN. Open business bank account. If offering crop insurance, apply for state insurance agent license (varies by state, typically $50-$200 + exam). OUTPUT: Entity formed, EIN obtained, license application submitted.',
        'DAYS 8-15: Apply for USDA Farm Service Agency (FSA) partnership or referral agreement. FSA offices serve every agricultural county and refer farmers to approved lenders and advisors. Being an FSA-recognized partner is the highest-trust channel in farm finance. OUTPUT: FSA partnership application submitted.',
        'DAYS 8-15: Build financial product specification: What do you offer? Micro-loans ($5K-$50K)? Crop insurance brokerage? Commodity hedging advisory? Revenue protection analysis? Define: terms, rates, fees, eligibility criteria, underwriting process. OUTPUT: Product specification document.',
        'DAYS 16-25: Build or license a platform. For lending: Blend, LoanPro, or custom. For insurance: partner with a crop insurance company (Rain & Hail, NAU Country, ProAg) as an agent. For hedging: build a recommendation engine using CME futures data. Budget $10K-$50K for MVP. OUTPUT: Platform MVP functional.',
        'DAYS 16-25: Get Errors & Omissions (E&O) insurance — mandatory for financial advisory. General liability insurance. If lending, get a fidelity bond. Contact 3 insurance brokers for quotes. Budget $1K-$4K/year. OUTPUT: E&O and liability insurance active.',
        'DAYS 26-40: Visit 5 county FSA offices in your target region. Introduce yourself and your product. Leave materials. Ask about their most common farmer pain points — this is free market research from the people who see every farm financial statement. OUTPUT: 5 FSA office visits completed, pain points documented.',
        'DAYS 40-55: Onboard first 5 farmer clients. For lending: process first loan applications, run credit checks, establish repayment terms. For insurance: quote and bind first policies. For advisory: deliver first hedging recommendation. OUTPUT: 5 clients onboarded, first revenue generated.',
        'DAYS 56-70: Build a referral program. Offer $100-$500 referral bonus to FSA staff (check compliance), extension agents, and equipment dealers who send farmers your way. Farm finance is relationship-driven — referrals are the primary growth channel. OUTPUT: Referral program live with 10+ referral partners.',
        'DAYS 71-90: Apply for CDFI designation (if lending). This opens access to CDFI Fund grants ($500K-$5M), favorable capital from banks meeting CRA obligations, and New Markets Tax Credits. Application is complex — use your compliance attorney. OUTPUT: CDFI application submitted or timeline set.'
      ]
    },
    FOOD_PROCESSING: {
      label: 'Food Processing',
      desc: 'Value-added food processing, specialty crops, organic certification.',
      icon: '\u{1F33F}',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$150K-$1M+',
      legalNotes: 'LLC or C-Corp. FDA food facility registration required. State Department of Agriculture processing license. USDA inspection for meat/poultry products. Organic certification through USDA-accredited certifier if organic. HACCP plan mandatory.',
      fundingNotes: 'SBA 7(a) or 504 loan for facility and equipment. USDA Value-Added Producer Grants (VAPG) up to $250K. State agricultural development grants. Equipment financing for processing machinery.',
      operatingNotes: 'Revenue from wholesale margins on processed products, private label contracts, and direct-to-consumer sales. Seasonal raw material availability drives production scheduling. Food safety compliance is ongoing and non-negotiable.',
      first90: [
        'DAYS 1-7: Form entity with Secretary of State. Apply for EIN. Register food facility with FDA (free at fda.gov/furls). Contact your state Department of Agriculture for processing facility license requirements and fees. OUTPUT: Entity formed, EIN obtained, FDA registration submitted, state requirements listed.',
        'DAYS 1-7: Hire a food safety consultant or attorney. You need: HACCP plan (Hazard Analysis Critical Control Points), allergen control plan, sanitation standard operating procedures (SSOPs), and recall plan. Budget $2K-$8K for initial food safety documentation package. OUTPUT: Food safety consultant engaged.',
        'DAYS 8-15: Define your product line: What raw agricultural inputs do you process? What is the finished product? Define: ingredients, process flow, shelf life, packaging, labeling requirements (FDA Nutrition Facts, allergen declarations, net weight). OUTPUT: Product specification and label mockup.',
        'DAYS 8-15: If pursuing organic certification: contact a USDA-accredited organic certifier (Oregon Tilth, CCOF, QAI). Application takes 3-6 months. Organic Handling Plan required. Budget $1K-$5K for initial certification. Start now if organic is part of your brand. OUTPUT: Organic certification application started or timeline set.',
        'DAYS 16-25: Identify facility requirements: processing area, cold storage, dry storage, packaging area, employee facilities, waste handling. Get 3 commercial real estate options. Verify food processing zoning with local planning department. Check utilities: adequate water, power (3-phase if needed), gas, floor drains, grease traps. OUTPUT: Facility shortlist with zoning verified.',
        'DAYS 16-25: Get equipment quotes: processing machinery (mixers, cookers, fillers, sealers), packaging equipment, refrigeration units, stainless steel tables, hand wash stations, scales. Compare 3 vendors per major item. Budget $50K-$500K depending on scale. OUTPUT: Equipment comparison table with pricing.',
        'DAYS 26-40: Sign facility lease. Begin buildout. Install equipment. Set up HACCP monitoring points: critical control points with temperature logs, metal detection, and weight checks. Get fire department and health department pre-inspections before opening. OUTPUT: Facility buildout started, CCP monitoring installed.',
        'DAYS 40-55: Complete facility. Run test production batches. Send samples to a food testing lab for: microbiological analysis, nutritional analysis (for label), and shelf life testing. Fix any issues found. Budget $500-$2K per product for testing. OUTPUT: Test batches complete, lab results received.',
        'DAYS 40-55: Hire production staff: food safety manager (required by FSMA), 2-4 production workers, packaging staff. All must complete food handler training (ServSafe or equivalent). Budget $35K-$60K per full-time employee. OUTPUT: Production team hired and trained.',
        'DAYS 56-70: Get final inspections: state Department of Agriculture processing license, USDA inspection (if meat/poultry), local health department approval, certificate of occupancy. Fix any deficiencies immediately. OUTPUT: All permits and inspections passed.',
        'DAYS 71-80: Contact first 10 wholesale buyers: local grocery stores, food co-ops, restaurant distributors, farmers market managers. Bring product samples and sell sheets with pricing, case pack, and delivery terms. Offer introductory pricing (10-15% below target to get on shelves). OUTPUT: 10 buyer meetings, 3+ wholesale accounts opened.',
        'DAYS 81-90: Fulfill first wholesale orders. Collect payment. Track production costs vs revenue per unit. Apply for USDA Value-Added Producer Grant (VAPG, up to $250K) using your early sales data as proof of market demand. OUTPUT: First revenue collected, VAPG application submitted.'
      ]
    }
  };

  /* ── TEMPLATES — Energy-equivalent staged execution templates per type ── */
  var TEMPLATES = {
    'PRECISION_AG_PLATFORM': {
      description: 'A business that provides precision agriculture technology — sensors, data analytics, and variable rate application tools — to farmers and agronomists.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$50K-$300K'
    },
    'AGRI_SUPPLY_CHAIN': {
      description: 'A business that operates agricultural supply chain infrastructure: cold chain logistics, grain storage, distribution, and post-harvest handling.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$200K-$2M+'
    },
    'AGRI_BIOTECH': {
      description: 'A business that develops agricultural biotechnology: seed genetics, biological crop protection, soil microbiome treatments, or bio-based inputs.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$100K-$1M+'
    },
    'FARM_FINANCE': {
      description: 'A business that provides financial services to farms and agribusinesses: lending, crop insurance, commodity hedging, or financial advisory.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$75K-$500K'
    },
    'FOOD_PROCESSING': {
      description: 'A business that processes raw agricultural products into value-added food products for wholesale, retail, or direct-to-consumer sales.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$150K-$1M+'
    }
  };

  /* ── Operator vs Auditor section visibility ─────────────────── */
  var OPERATOR_SECTIONS = ['concept', 'market', 'biz_type', 'entity', 'tax_id', 'compliance', 'banking', 'delivery', 'customers', 'first90', 'readiness'];
  var AUDITOR_ONLY = ['revenue', 'governance', 'startup_costs', 'sources', 'loan_prep', 'proforma', 'team', 'infrastructure', 'legal_docs', 'financial_docs', 'operating_docs', 'lender_packet', 'auditor'];

  /* ── STAGES — 7-stage, 24-subsection staged execution framework ── */
  var STAGES = [
    // STAGE 1: BUSINESS DEFINITION
    { id: 'stage1', title: 'STAGE 1 \u2014 BUSINESS DEFINITION', sections: [
      { id: 'concept', title: 'Business Concept', type: 'fields',
        guidance: 'Define the business in language anyone can understand. If you cannot explain it in two sentences, you do not understand it well enough yet.',
        fields: [
          { id: 'name', label: 'Business name (draft)', type: 'text', placeholder: 'e.g., AgriSense Analytics LLC' },
          { id: 'one_liner', label: 'One-sentence description', type: 'text', placeholder: 'We provide [service/product] to [customer] in [area]' },
          { id: 'full_desc', label: 'Full business description (3-5 sentences)', type: 'textarea', placeholder: 'What does the business do? Who are the customers? How does it make money? What makes it different?' },
          { id: 'node_source', label: 'Node source (from LIMEN mapping)', type: 'text', prefill: 'nodeLabel' },
          { id: 'mapping_title', label: 'Business mapping title', type: 'text', prefill: 'businessType' }
        ] },
      { id: 'market', title: 'Customer & Market', type: 'fields',
        guidance: 'Who pays you? Be specific. "Farmers" is too vague. "Row crop farmers with 500-5000 acres in the Midwest needing soil moisture data" is specific.',
        fields: [
          { id: 'target_customer', label: 'Primary target customer', type: 'textarea', placeholder: 'Describe your ideal customer in detail. Size, type, location, budget, pain point.' },
          { id: 'market_size', label: 'Estimated addressable market', type: 'text', placeholder: 'How many potential customers exist? What do they currently spend on this?' },
          { id: 'geography', label: 'Service geography', type: 'text', placeholder: 'Local, regional, national, or specific states/counties' },
          { id: 'competition', label: 'Main competitors or alternatives', type: 'textarea', placeholder: 'Who else serves this customer? What do they charge? Why would customers switch to you?' },
          { id: 'differentiation', label: 'Why you win', type: 'textarea', placeholder: 'What is your unfair advantage? Speed, price, expertise, location, technology, relationships?' }
        ] },
      { id: 'revenue', title: 'Revenue Model', type: 'fields',
        guidance: 'How does money come in? Be concrete. "We charge $X per Y" is better than "we monetize our platform."',
        fields: [
          { id: 'model_type', label: 'Revenue model', type: 'select', options: ['Per-acre/season subscription', 'Per-bushel storage/handling fee', 'Per-unit product sales', 'Commission/referral', 'Licensing/royalty', 'Retainer/advisory fee', 'Insurance commission', 'Loan origination fee', 'Mixed', 'Other'] },
          { id: 'pricing', label: 'Pricing structure', type: 'textarea', placeholder: 'What do you charge? How much? Is there a range? What is your average deal size?' },
          { id: 'payment_terms', label: 'Payment terms', type: 'text', placeholder: 'Net 30, upfront, seasonal billing, milestone-based?' },
          { id: 'recurring', label: 'Recurring vs one-time revenue', type: 'select', options: ['Mostly recurring (subscriptions, retainers, seasonal renewals)', 'Mostly one-time (product sales, project fees)', 'Mixed', 'Undecided'] }
        ] },
      { id: 'biz_type', title: 'Business Type & Mode', type: 'fields',
        guidance: 'Choose the template that best matches your business. This affects the 90-day execution plan and guidance below.',
        fields: [
          { id: 'template', label: 'Business type template', type: 'select', options: ['PRECISION_AG_PLATFORM', 'AGRI_SUPPLY_CHAIN', 'AGRI_BIOTECH', 'FARM_FINANCE', 'FOOD_PROCESSING'] },
          { id: 'capital_intensity', label: 'Capital intensity', type: 'select', options: ['Low ($5K-$50K)', 'Medium ($50K-$300K)', 'High ($300K+)'] },
          { id: 'regulated', label: 'Regulated industry?', type: 'select', options: ['No', 'Yes \u2014 light regulation (facility permits, food handling)', 'Yes \u2014 heavy regulation (lending license, EPA/USDA registration, CFTC)'] }
        ] }
    ] },
    // STAGE 2: LEGAL FORMATION
    { id: 'stage2', title: 'STAGE 2 \u2014 LEGAL FORMATION', sections: [
      { id: 'entity', title: 'Entity Formation', type: 'fields',
        guidance: 'File your business entity. LLC is sufficient for most agricultural businesses. C-Corp if you plan to raise venture capital.',
        fields: [
          { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC', 'C-Corp', 'S-Corp', 'Sole Proprietorship', 'Partnership', 'Cooperative'] },
          { id: 'state', label: 'State of formation', type: 'text', placeholder: 'e.g., Iowa, Delaware' },
          { id: 'filing_status', label: 'Filing status', type: 'select', options: ['Not started', 'Filed \u2014 awaiting confirmation', 'Confirmed \u2014 have filing number', 'Need attorney help'] },
          { id: 'ein', label: 'EIN number', type: 'text', placeholder: 'XX-XXXXXXX (from irs.gov/ein)' }
        ] },
      { id: 'tax_id', title: 'Tax & Registration', type: 'fields',
        guidance: 'Register with federal, state, and local authorities. Agricultural businesses may need additional registrations beyond standard business.',
        fields: [
          { id: 'fda_registration', label: 'FDA food facility registration', type: 'select', options: ['Not applicable', 'Not started', 'Submitted', 'Confirmed'] },
          { id: 'state_ag_license', label: 'State Dept of Agriculture license', type: 'select', options: ['Not applicable', 'Not started', 'Applied', 'Approved'] },
          { id: 'usda_registration', label: 'USDA registration/permit', type: 'select', options: ['Not applicable', 'Not started', 'Applied', 'Approved'] },
          { id: 'state_tax', label: 'State tax registration', type: 'select', options: ['Not started', 'Registered'] },
          { id: 'sam_gov', label: 'SAM.gov registration (for grants)', type: 'select', options: ['Not started', 'Registered', 'Not needed'] }
        ] },
      { id: 'compliance', title: 'Compliance & Licensing', type: 'fields',
        guidance: 'Agricultural businesses face specific compliance requirements. Check all that apply and note status.',
        fields: [
          { id: 'food_safety', label: 'Food safety plan (HACCP/HARPC)', type: 'select', options: ['Not applicable', 'Not started', 'In progress', 'Complete'] },
          { id: 'organic_cert', label: 'Organic certification', type: 'select', options: ['Not applicable', 'Not started', 'Applied', 'Certified'] },
          { id: 'epa_registration', label: 'EPA registration (biopesticides)', type: 'select', options: ['Not applicable', 'Not started', 'Pre-submission filed', 'Approved'] },
          { id: 'insurance', label: 'Insurance status', type: 'select', options: ['Not started', 'General liability only', 'GL + product liability', 'GL + E&O + product'] },
          { id: 'lending_license', label: 'State lending/insurance license', type: 'select', options: ['Not applicable', 'Not started', 'Applied', 'Licensed'] }
        ] }
    ] },
    // STAGE 3: FINANCIAL SETUP
    { id: 'stage3', title: 'STAGE 3 \u2014 FINANCIAL SETUP', sections: [
      { id: 'banking', title: 'Banking & Accounting', type: 'fields',
        guidance: 'Separate business and personal finances from day one. Set up proper bookkeeping before first revenue.',
        fields: [
          { id: 'bank', label: 'Business bank account', type: 'select', options: ['Not opened', 'Opened \u2014 checking only', 'Opened \u2014 checking + savings', 'Opened \u2014 with credit line'] },
          { id: 'accounting', label: 'Accounting system', type: 'select', options: ['Not set up', 'QuickBooks Online', 'Wave (free)', 'Xero', 'FreshBooks', 'CPA handles it'] },
          { id: 'cpa', label: 'CPA or bookkeeper', type: 'select', options: ['Not hired', 'Bookkeeper only', 'CPA retained', 'CPA + bookkeeper'] }
        ] },
      { id: 'startup_costs', title: 'Startup Cost Estimate', type: 'fields',
        guidance: 'List every cost you will incur before first revenue. Be honest and complete. Underestimating kills businesses.',
        fields: [
          { id: 'equipment', label: 'Equipment & technology', type: 'text', placeholder: 'e.g., $25,000 for sensors + gateway hardware' },
          { id: 'facility', label: 'Facility (lease deposit, buildout)', type: 'text', placeholder: 'e.g., $15,000 first/last + $50,000 buildout' },
          { id: 'legal', label: 'Legal & compliance', type: 'text', placeholder: 'e.g., $5,000 for entity + permits + food safety plan' },
          { id: 'insurance', label: 'Insurance (annual)', type: 'text', placeholder: 'e.g., $2,000 GL + product liability' },
          { id: 'working_capital', label: 'Working capital (3 months)', type: 'text', placeholder: 'e.g., $30,000 for payroll + supplies + rent' },
          { id: 'marketing', label: 'Marketing & sales', type: 'text', placeholder: 'e.g., $3,000 for trade show + materials' },
          { id: 'total', label: 'Total estimated startup cost', type: 'text', placeholder: 'Sum of above' }
        ] },
      { id: 'sources', title: 'Funding Sources', type: 'fields',
        guidance: 'How will you fund the startup costs? Be specific about amounts and sources.',
        fields: [
          { id: 'personal', label: 'Personal savings', type: 'text', placeholder: '$' },
          { id: 'sba_loan', label: 'SBA loan (7a, 504, microloan)', type: 'text', placeholder: '$ and type' },
          { id: 'usda_grant', label: 'USDA grants (SBIR, VAPG, Rural Dev)', type: 'text', placeholder: '$ and program' },
          { id: 'investors', label: 'Investors (angel, VC, friends/family)', type: 'text', placeholder: '$ and terms' },
          { id: 'equipment_finance', label: 'Equipment financing', type: 'text', placeholder: '$ and vendor' },
          { id: 'other', label: 'Other sources', type: 'text', placeholder: 'State grants, CDFI, credit union, etc.' }
        ] }
    ] },
    // STAGE 4: OPERATIONS
    { id: 'stage4', title: 'STAGE 4 \u2014 OPERATIONS', sections: [
      { id: 'delivery', title: 'Service / Product Delivery', type: 'fields',
        guidance: 'How do you deliver what you sell? Be specific about the physical process.',
        fields: [
          { id: 'delivery_method', label: 'Delivery method', type: 'textarea', placeholder: 'How does the product/service reach the customer? Step by step.' },
          { id: 'capacity', label: 'Current capacity', type: 'text', placeholder: 'e.g., 50 farms/season, 500K bushels/year, 10 clients/month' },
          { id: 'bottleneck', label: 'Primary bottleneck', type: 'text', placeholder: 'What limits your ability to serve more customers right now?' },
          { id: 'quality', label: 'Quality control process', type: 'textarea', placeholder: 'How do you ensure consistent quality? What do you measure?' }
        ] },
      { id: 'infrastructure', title: 'Infrastructure & Equipment', type: 'fields',
        guidance: 'What physical assets does the business need to operate?',
        fields: [
          { id: 'facility_type', label: 'Facility type', type: 'select', options: ['Home office / remote', 'Shared office / coworking', 'Warehouse / storage', 'Processing plant', 'Laboratory', 'Farm / field site', 'Retail / storefront'] },
          { id: 'key_equipment', label: 'Key equipment list', type: 'textarea', placeholder: 'List the 5 most important pieces of equipment and their approximate cost.' },
          { id: 'technology', label: 'Technology stack', type: 'textarea', placeholder: 'Software, cloud services, monitoring systems, communication tools.' }
        ] },
      { id: 'team', title: 'Team & Hiring', type: 'fields',
        guidance: 'Who do you need to hire and when? Be realistic about what you can do alone vs what requires staff.',
        fields: [
          { id: 'founder_role', label: 'Founder primary role', type: 'text', placeholder: 'What do you personally do every day?' },
          { id: 'first_hire', label: 'First hire (role + timeline)', type: 'text', placeholder: 'e.g., Operations manager by Month 2, $55K salary' },
          { id: 'year1_headcount', label: 'Year 1 target headcount', type: 'text', placeholder: 'Including founder' },
          { id: 'key_skills', label: 'Critical skills needed', type: 'textarea', placeholder: 'What expertise must you hire that you do not have?' }
        ] }
    ] },
    // STAGE 5: LAUNCH
    { id: 'stage5', title: 'STAGE 5 \u2014 LAUNCH', sections: [
      { id: 'customers', title: 'First Customers', type: 'fields',
        guidance: 'Your first 5 customers are the hardest. Name them if you can. If you cannot name a single potential customer, you are not ready to launch.',
        fields: [
          { id: 'first_5', label: 'First 5 target customers (by name)', type: 'textarea', placeholder: 'List actual farms, companies, or buyers you will approach first.' },
          { id: 'channel', label: 'Primary sales channel', type: 'select', options: ['Direct outreach (phone/email/visit)', 'County extension agents', 'FSA office referrals', 'Trade shows / field days', 'Equipment dealer partnerships', 'Online / digital marketing', 'Farmer cooperatives', 'Distributor / broker'] },
          { id: 'intro_offer', label: 'Introductory offer', type: 'text', placeholder: 'e.g., 20% discount Year 1, free pilot, money-back guarantee' },
          { id: 'close_timeline', label: 'Time to close first deal', type: 'text', placeholder: 'e.g., 2 weeks from first contact, seasonal (pre-planting only)' }
        ] },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'first90',
        guidance: 'This plan is auto-populated from your selected business type. Each step has a specific output. Follow it literally.' },
      { id: 'readiness', title: 'Launch Readiness Checklist', type: 'checklist',
        items: ['Entity formed and EIN obtained', 'Bank account open', 'Insurance active', 'All required licenses and permits obtained or applied for', 'Accounting system set up', 'Product/service ready to deliver', 'First customer identified by name', 'Pricing set and documented', 'Website or business listing live', 'First 90-day plan reviewed and understood'] }
    ] },
    // STAGE 6: FINANCIAL GOVERNANCE
    { id: 'stage6', title: 'STAGE 6 \u2014 FINANCIAL GOVERNANCE', sections: [
      { id: 'loan_prep', title: 'Loan / Grant Preparation', type: 'fields',
        guidance: 'If you need external funding, prepare these materials. SBA lenders and USDA grant reviewers expect specific documents.',
        fields: [
          { id: 'business_plan', label: 'Business plan status', type: 'select', options: ['Not started', 'Draft in progress', 'Complete \u2014 not reviewed', 'Complete \u2014 reviewed by advisor/CPA'] },
          { id: 'proforma', label: 'Pro forma financials (3-year)', type: 'select', options: ['Not started', 'Draft', 'Complete', 'CPA reviewed'] },
          { id: 'personal_financial', label: 'Personal financial statement', type: 'select', options: ['Not started', 'Complete'] },
          { id: 'collateral', label: 'Collateral available', type: 'textarea', placeholder: 'List assets that can secure a loan: real estate, equipment, inventory, accounts receivable.' }
        ] },
      { id: 'proforma', title: 'Pro Forma Projections', type: 'fields',
        guidance: 'Project revenue, expenses, and profit for Years 1-3. Be conservative. Lenders and grantors reject inflated projections.',
        fields: [
          { id: 'revenue_y1', label: 'Revenue Year 1', type: 'text', placeholder: '$' },
          { id: 'revenue_y2', label: 'Revenue Year 2', type: 'text', placeholder: '$' },
          { id: 'revenue_y3', label: 'Revenue Year 3', type: 'text', placeholder: '$' },
          { id: 'cogs_pct', label: 'Cost of goods/services (%)', type: 'text', placeholder: 'e.g., 40%' },
          { id: 'gross_margin', label: 'Gross margin target', type: 'text', placeholder: 'e.g., 60%' },
          { id: 'breakeven', label: 'Breakeven timeline', type: 'text', placeholder: 'e.g., Month 8' }
        ] },
      { id: 'governance', title: 'Business Governance', type: 'fields',
        guidance: 'Who makes decisions? Who signs checks? Who reviews performance? Good governance prevents problems.',
        fields: [
          { id: 'decision_maker', label: 'Primary decision maker', type: 'text', placeholder: 'Name and role' },
          { id: 'advisor_board', label: 'Advisory board (if any)', type: 'textarea', placeholder: 'Names, expertise, and meeting frequency' },
          { id: 'financial_controls', label: 'Financial controls', type: 'textarea', placeholder: 'Who approves expenses over $X? Who reconciles the bank account? How often?' },
          { id: 'reporting', label: 'Reporting cadence', type: 'select', options: ['Monthly P&L review', 'Quarterly full review', 'Annual only', 'Not established'] }
        ] },
      { id: 'legal_docs', title: 'Legal Documents', type: 'checklist',
        items: ['Articles of Organization / Incorporation filed', 'Operating Agreement / Bylaws signed', 'EIN confirmation letter saved', 'Business insurance certificates on file', 'All licenses and permits on file', 'Customer contract template reviewed by attorney', 'Employment agreements (if employees)', 'Non-disclosure agreement template (if needed)'] }
    ] },
    // STAGE 7: AUDITOR GATE
    { id: 'stage7', title: 'STAGE 7 \u2014 AUDITOR GATE', sections: [
      { id: 'financial_docs', title: 'Financial Documentation', type: 'checklist',
        items: ['Bank statements (last 3 months)', 'Startup cost itemization', 'Pro forma P&L (Years 1-3)', 'Cash flow projection (Month 1-12)', 'Funding source documentation (loan approval, grant award, investor commitment)', 'Tax ID confirmation'] },
      { id: 'operating_docs', title: 'Operating Documentation', type: 'checklist',
        items: ['Business plan (complete)', 'Product/service specification', 'Pricing sheet', 'Customer pipeline list (with names)', 'Vendor/supplier agreements', 'Food safety plan (if applicable)', 'Quality control procedures', 'Insurance certificates'] },
      { id: 'lender_packet', title: 'Lender / Grant Packet', type: 'checklist',
        items: ['SBA loan application (if applicable)', 'USDA grant application (if applicable)', 'Personal financial statement', 'Business financial projections', 'Collateral documentation', 'Management resumes', 'Letters of support / intent from customers', 'Capability statement (for grants)'] },
      { id: 'auditor', title: 'Auditor Review', type: 'auditor',
        guidance: 'Submit the completed business build for auditor evaluation. All Stage 1-6 sections should be complete before submission.' }
    ] }
  ];

  /* ── Build Sections ────────────────────────────────────────── */
  var BUILD_SECTIONS = [
    { key: 'what',        title: 'What This Business Is',        type: 'info' },
    { key: 'opportunity', title: 'Why Now / Market Opportunity', type: 'textarea', prefillFrom: 'whyNow' },
    { key: 'model',       title: 'Business Model',              type: 'textarea' },
    { key: 'market',      title: 'Target Market / Customer',    type: 'textarea' },
    { key: 'team',        title: 'Team / Capabilities',         type: 'fields',
      fields: [
        { key: 'founder',     label: 'Founder / Lead',       placeholder: 'Name and background' },
        { key: 'cto',         label: 'CTO / Tech Lead',      placeholder: 'Name and background' },
        { key: 'domain_exp',  label: 'Domain Expertise',     placeholder: 'Ag science, supply chain, etc.' },
        { key: 'advisors',    label: 'Advisors',             placeholder: 'Names and roles' }
      ]
    },
    { key: 'financials',  title: 'Financial Projections',       type: 'fields',
      fields: [
        { key: 'revenue_y1',    label: 'Revenue Year 1',       placeholder: '$' },
        { key: 'revenue_y3',    label: 'Revenue Year 3',       placeholder: '$' },
        { key: 'margin',        label: 'Target Margin (%)',    placeholder: 'e.g. 35%' },
        { key: 'funding_needed', label: 'Funding Needed',      placeholder: '$' }
      ]
    },
    { key: 'competitive', title: 'Competitive Advantage',       type: 'textarea' },
    { key: 'risks',       title: 'Risks / Mitigation',         type: 'textarea' },
    { key: 'milestones',  title: 'Key Milestones',             type: 'textarea' },
    { key: 'review',      title: 'Review',                     type: 'review' },
    { key: 'auditor',     title: 'Auditor Decision',           type: 'auditor' }
  ];

  /* ── CSS Injection ─────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    '/* agriculture-business-build.js injected styles */',

    '.abb-panel { background:#111; border:1px solid ' + ACCENT_DIM + '; border-radius:10px; padding:24px 28px; font-family:"Inter","Segoe UI",sans-serif; color:#ccc; max-width:820px; margin:0 auto; }',

    '.abb-header { display:flex; align-items:center; gap:14px; margin-bottom:22px; }',
    '.abb-header-icon { font-size:28px; }',
    '.abb-header-title { font-size:20px; font-weight:700; color:#fff; }',
    '.abb-header-sub { font-size:13px; color:#888; margin-top:2px; }',

    '.abb-progress-bar { height:6px; background:#222; border-radius:3px; margin-bottom:24px; overflow:hidden; }',
    '.abb-progress-fill { height:100%; background:' + ACCENT + '; border-radius:3px; transition:width .35s ease; }',
    '.abb-progress-label { font-size:11px; color:#666; margin-bottom:6px; text-align:right; }',

    '.abb-section { border:1px solid #222; border-radius:8px; margin-bottom:14px; overflow:hidden; transition:border-color .2s; }',
    '.abb-section.abb-active { border-color:' + ACCENT_MED + '; }',
    '.abb-section.abb-complete { border-color:rgba(90,181,160,0.5); }',

    '.abb-section-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; cursor:pointer; background:#161616; user-select:none; }',
    '.abb-section-head:hover { background:#1a1a1a; }',
    '.abb-section-num { width:26px; height:26px; border-radius:50%; background:#222; color:#777; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; margin-right:12px; flex-shrink:0; }',
    '.abb-section.abb-complete .abb-section-num { background:' + ACCENT + '; color:#000; }',
    '.abb-section-title { flex:1; font-size:14px; font-weight:600; color:#ddd; }',
    '.abb-section-chevron { font-size:14px; color:#555; transition:transform .2s; }',
    '.abb-section.abb-active .abb-section-chevron { transform:rotate(90deg); }',

    '.abb-section-body { padding:0 16px; max-height:0; overflow:hidden; transition:max-height .35s ease, padding .25s ease; }',
    '.abb-section.abb-active .abb-section-body { max-height:1200px; padding:14px 16px 18px; }',

    '.abb-textarea { width:100%; min-height:110px; background:#0d0d0d; border:1px solid #2a2a2a; border-radius:6px; color:#ccc; font-size:13px; padding:10px 12px; resize:vertical; font-family:inherit; line-height:1.55; }',
    '.abb-textarea:focus { outline:none; border-color:' + ACCENT + '; }',

    '.abb-field-group { margin-bottom:10px; }',
    '.abb-field-label { font-size:11px; color:#777; margin-bottom:4px; text-transform:uppercase; letter-spacing:.4px; }',
    '.abb-field-input { width:100%; background:#0d0d0d; border:1px solid #2a2a2a; border-radius:5px; color:#ccc; font-size:13px; padding:8px 10px; font-family:inherit; }',
    '.abb-field-input:focus { outline:none; border-color:' + ACCENT + '; }',

    '.abb-info-block { background:#0e1513; border-left:3px solid ' + ACCENT + '; padding:12px 16px; border-radius:0 6px 6px 0; font-size:13px; line-height:1.6; color:#aaa; }',

    '.abb-review-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }',
    '.abb-review-card { background:#0d0d0d; border:1px solid #222; border-radius:6px; padding:10px 13px; }',
    '.abb-review-card-label { font-size:10px; color:#666; text-transform:uppercase; letter-spacing:.5px; margin-bottom:3px; }',
    '.abb-review-card-value { font-size:13px; color:#ccc; white-space:pre-wrap; max-height:80px; overflow-y:auto; }',
    '.abb-review-card-empty { color:#444; font-style:italic; }',

    '.abb-auditor-block { background:#0e1210; border:1px solid #1d2e28; border-radius:8px; padding:18px; text-align:center; }',
    '.abb-auditor-title { font-size:15px; font-weight:700; color:' + ACCENT + '; margin-bottom:6px; }',
    '.abb-auditor-sub { font-size:12px; color:#666; margin-bottom:16px; }',
    '.abb-auditor-status { font-size:13px; padding:6px 14px; border-radius:16px; display:inline-block; margin-bottom:10px; }',
    '.abb-auditor-status.pending { background:#2a2210; color:#c9a84c; }',
    '.abb-auditor-status.approved { background:#122a1e; color:#5ab5a0; }',
    '.abb-auditor-status.rejected { background:#2a1212; color:#c94c4c; }',

    '.abb-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; border-radius:6px; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:background .15s, opacity .15s; }',
    '.abb-btn-primary { background:' + ACCENT + '; color:#000; }',
    '.abb-btn-primary:hover { opacity:.88; }',
    '.abb-btn-outline { background:transparent; border:1px solid #333; color:#aaa; }',
    '.abb-btn-outline:hover { border-color:' + ACCENT + '; color:' + ACCENT + '; }',

    '.abb-actions { display:flex; gap:10px; margin-top:18px; justify-content:flex-end; }',

    '.abb-type-selector { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px; }',
    '.abb-type-card { background:#161616; border:1px solid #222; border-radius:8px; padding:14px; cursor:pointer; transition:border-color .2s, background .2s; }',
    '.abb-type-card:hover { border-color:' + ACCENT_MED + '; background:#1a1a1a; }',
    '.abb-type-card.abb-selected { border-color:' + ACCENT + '; background:#0e1513; }',
    '.abb-type-card-icon { font-size:22px; margin-bottom:6px; }',
    '.abb-type-card-label { font-size:13px; font-weight:600; color:#ddd; }',
    '.abb-type-card-desc { font-size:11px; color:#666; margin-top:3px; line-height:1.45; }',

    '/* Print */',
    '@media print {',
    '  .abb-panel { border:none; max-width:100%; padding:0; }',
    '  .abb-section-body { max-height:none !important; padding:10px 16px !important; }',
    '  .abb-section-head { background:#f5f5f5 !important; color:#111 !important; }',
    '  .abb-section-num { background:#5ab5a0 !important; color:#fff !important; }',
    '  .abb-textarea, .abb-field-input { border-color:#ccc !important; color:#111 !important; background:#fff !important; }',
    '  .abb-btn { display:none !important; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  /* ── Persistence helpers ───────────────────────────────────── */
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (_) { return {}; }
  }
  function saveStore(store) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (_) { /* quota */ }
  }
  function loadOpp(oppKey) {
    var store = loadStore();
    return store[oppKey] || { type: null, sections: {}, auditor: 'pending', created: Date.now() };
  }
  function saveOpp(oppKey, data) {
    var store = loadStore();
    store[oppKey] = data;
    store[oppKey].updated = Date.now();
    saveStore(store);
  }

  /* ── Progress calculation ──────────────────────────────────── */
  function calcProgress(data) {
    var filled = 0;
    var total = BUILD_SECTIONS.length - 2; // exclude review + auditor
    BUILD_SECTIONS.forEach(function (sec) {
      if (sec.type === 'review' || sec.type === 'auditor') return;
      if (sec.type === 'info') { filled++; return; } // info is always "done"
      var val = data.sections[sec.key];
      if (sec.type === 'textarea' && val && val.trim().length > 5) filled++;
      if (sec.type === 'fields' && val) {
        var any = sec.fields.some(function (f) { return val[f.key] && val[f.key].trim().length > 0; });
        if (any) filled++;
      }
    });
    return Math.round((filled / total) * 100);
  }

  /* ── Section Rendering ─────────────────────────────────────── */
  function renderInfoSection(data) {
    var bt = BUSINESS_TYPES[data.type] || {};
    return '<div class="abb-info-block">' +
      '<strong>' + (bt.icon || '') + ' ' + (bt.label || 'Unknown Type') + '</strong><br>' +
      (bt.desc || '') +
      '</div>';
  }

  function renderTextareaSection(sec, data) {
    var val = (data.sections[sec.key] || '');
    return '<textarea class="abb-textarea" data-section="' + sec.key + '" placeholder="Describe ' + sec.title.toLowerCase() + '...">' +
      escHtml(val) + '</textarea>';
  }

  function renderFieldsSection(sec, data) {
    var vals = data.sections[sec.key] || {};
    var html = '';
    sec.fields.forEach(function (f) {
      html += '<div class="abb-field-group">' +
        '<div class="abb-field-label">' + escHtml(f.label) + '</div>' +
        '<input class="abb-field-input" data-section="' + sec.key + '" data-field="' + f.key + '" ' +
        'placeholder="' + escHtml(f.placeholder || '') + '" value="' + escHtml(vals[f.key] || '') + '">' +
        '</div>';
    });
    return html;
  }

  function renderReviewSection(data) {
    var html = '<div class="abb-review-grid">';
    BUILD_SECTIONS.forEach(function (sec) {
      if (sec.type === 'review' || sec.type === 'auditor' || sec.type === 'info') return;
      var val = '';
      if (sec.type === 'textarea') {
        val = data.sections[sec.key] || '';
      } else if (sec.type === 'fields') {
        var fvals = data.sections[sec.key] || {};
        val = sec.fields.map(function (f) { return f.label + ': ' + (fvals[f.key] || '-'); }).join('\n');
      }
      var display = val && val.trim() ? escHtml(val) : '<span class="abb-review-card-empty">Not completed</span>';
      html += '<div class="abb-review-card">' +
        '<div class="abb-review-card-label">' + escHtml(sec.title) + '</div>' +
        '<div class="abb-review-card-value">' + display + '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderAuditorSection(data) {
    var status = data.auditor || 'pending';
    var statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Review';
    var progress = calcProgress(data);
    var canSubmit = progress >= 80;
    return '<div class="abb-auditor-block">' +
      '<div class="abb-auditor-title">Auditor Review</div>' +
      '<div class="abb-auditor-sub">Submit your completed business build for auditor evaluation</div>' +
      '<div class="abb-auditor-status ' + status + '">' + statusLabel + '</div>' +
      '<div style="margin-top:12px;">' +
      (status === 'pending'
        ? '<button class="abb-btn abb-btn-primary abb-submit-audit" ' + (canSubmit ? '' : 'disabled style="opacity:.4;cursor:not-allowed;"') + '>Submit for Audit</button>' +
          (canSubmit ? '' : '<div style="font-size:11px;color:#666;margin-top:6px;">Complete at least 80% of sections to submit</div>')
        : '<button class="abb-btn abb-btn-outline abb-reset-audit">Reset to Pending</button>') +
      '</div>' +
      '</div>';
  }

  function renderSection(sec, idx, data, activeKey) {
    var isActive = (activeKey === sec.key);
    var isComplete = false;
    if (sec.type === 'info') isComplete = !!data.type;
    else if (sec.type === 'textarea') {
      var v = data.sections[sec.key] || '';
      isComplete = v.trim().length > 5;
    } else if (sec.type === 'fields') {
      var fv = data.sections[sec.key] || {};
      isComplete = sec.fields.some(function (f) { return fv[f.key] && fv[f.key].trim().length > 0; });
    } else if (sec.type === 'review') isComplete = calcProgress(data) >= 100;
    else if (sec.type === 'auditor') isComplete = data.auditor === 'approved';

    var cls = 'abb-section' + (isActive ? ' abb-active' : '') + (isComplete ? ' abb-complete' : '');
    var body = '';
    if (sec.type === 'info')      body = renderInfoSection(data);
    if (sec.type === 'textarea')  body = renderTextareaSection(sec, data);
    if (sec.type === 'fields')    body = renderFieldsSection(sec, data);
    if (sec.type === 'review')    body = renderReviewSection(data);
    if (sec.type === 'auditor')   body = renderAuditorSection(data);

    return '<div class="' + cls + '" data-sec-key="' + sec.key + '">' +
      '<div class="abb-section-head">' +
        '<div style="display:flex;align-items:center;">' +
          '<div class="abb-section-num">' + (isComplete ? '\u2713' : (idx + 1)) + '</div>' +
          '<div class="abb-section-title">' + escHtml(sec.title) + '</div>' +
        '</div>' +
        '<div class="abb-section-chevron">\u25B6</div>' +
      '</div>' +
      '<div class="abb-section-body">' + body + '</div>' +
      '</div>';
  }

  /* ── Type Selector ─────────────────────────────────────────── */
  function renderTypeSelector(selectedType) {
    var html = '<div class="abb-type-selector">';
    Object.keys(BUSINESS_TYPES).forEach(function (key) {
      var bt = BUSINESS_TYPES[key];
      var sel = key === selectedType ? ' abb-selected' : '';
      html += '<div class="abb-type-card' + sel + '" data-btype="' + key + '">' +
        '<div class="abb-type-card-icon">' + bt.icon + '</div>' +
        '<div class="abb-type-card-label">' + escHtml(bt.label) + '</div>' +
        '<div class="abb-type-card-desc">' + escHtml(bt.desc) + '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ── Main Panel Render ─────────────────────────────────────── */
  function renderPanel(oppKey, prefill) {
    var data = loadOpp(oppKey);

    // Apply prefill on first visit
    if (prefill && !data.type) {
      if (prefill.type && BUSINESS_TYPES[prefill.type]) data.type = prefill.type;
      if (prefill.whyNow) {
        data.sections = data.sections || {};
        data.sections.opportunity = prefill.whyNow;
      }
      saveOpp(oppKey, data);
    }

    var progress = calcProgress(data);
    var activeKey = data.type ? BUILD_SECTIONS[0].key : null;

    var html = '<div class="abb-panel" data-opp="' + escHtml(oppKey) + '">';

    // Header
    var bt = BUSINESS_TYPES[data.type] || {};
    html += '<div class="abb-header">' +
      '<div class="abb-header-icon">' + (bt.icon || '\u{1F33E}') + '</div>' +
      '<div>' +
        '<div class="abb-header-title">' + (data.type ? escHtml(bt.label) : 'Agriculture Business Build') + '</div>' +
        '<div class="abb-header-sub">Opportunity: ' + escHtml(oppKey) + '</div>' +
      '</div>' +
      '</div>';

    // Progress
    html += '<div class="abb-progress-label">' + progress + '% complete</div>' +
      '<div class="abb-progress-bar"><div class="abb-progress-fill" style="width:' + progress + '%"></div></div>';

    // Type selector (if no type chosen)
    if (!data.type) {
      html += '<div style="font-size:14px;color:#aaa;margin-bottom:12px;font-weight:600;">Select Business Type</div>';
      html += renderTypeSelector(data.type);
    }

    // Sections
    if (data.type) {
      BUILD_SECTIONS.forEach(function (sec, idx) {
        html += renderSection(sec, idx, data, activeKey);
      });
    }

    // Actions
    html += '<div class="abb-actions">' +
      '<button class="abb-btn abb-btn-outline abb-print-btn">\u{1F5A8} Print</button>' +
      '<button class="abb-btn abb-btn-primary abb-save-btn">Save Progress</button>' +
      '</div>';

    html += '</div>';
    return html;
  }

  /* ── Wire Panel ────────────────────────────────────────────── */
  function wirePanel(container, oppKey) {
    if (!container) return;
    var debounceTimer = null;

    function getData() { return loadOpp(oppKey); }
    function persist() {
      var data = getData();
      // Scrape textareas
      container.querySelectorAll('.abb-textarea').forEach(function (ta) {
        var sec = ta.getAttribute('data-section');
        if (sec) data.sections[sec] = ta.value;
      });
      // Scrape field inputs
      container.querySelectorAll('.abb-field-input').forEach(function (inp) {
        var sec = inp.getAttribute('data-section');
        var field = inp.getAttribute('data-field');
        if (sec && field) {
          if (!data.sections[sec]) data.sections[sec] = {};
          data.sections[sec][field] = inp.value;
        }
      });
      saveOpp(oppKey, data);
      updateProgress(data);
    }

    function updateProgress(data) {
      var pct = calcProgress(data);
      var fill = container.querySelector('.abb-progress-fill');
      var label = container.querySelector('.abb-progress-label');
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = pct + '% complete';
    }

    function reRender() {
      container.innerHTML = renderPanel(oppKey);
      wirePanel(container, oppKey);
    }

    // Type selector
    container.querySelectorAll('.abb-type-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var btype = card.getAttribute('data-btype');
        if (btype && BUSINESS_TYPES[btype]) {
          var data = getData();
          data.type = btype;
          saveOpp(oppKey, data);
          reRender();
        }
      });
    });

    // Section accordion
    container.querySelectorAll('.abb-section-head').forEach(function (head) {
      head.addEventListener('click', function () {
        var section = head.parentElement;
        var wasActive = section.classList.contains('abb-active');
        // Collapse all
        container.querySelectorAll('.abb-section').forEach(function (s) { s.classList.remove('abb-active'); });
        // Toggle
        if (!wasActive) section.classList.add('abb-active');
      });
    });

    // Auto-save on input
    container.querySelectorAll('.abb-textarea, .abb-field-input').forEach(function (el) {
      el.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(persist, 400);
      });
    });

    // Save button
    var saveBtn = container.querySelector('.abb-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        persist();
        saveBtn.textContent = '\u2713 Saved';
        saveBtn.style.background = '#2a7a68';
        setTimeout(function () {
          saveBtn.textContent = 'Save Progress';
          saveBtn.style.background = ACCENT;
        }, 1500);
      });
    }

    // Print button
    var printBtn = container.querySelector('.abb-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        // Expand all sections for print
        container.querySelectorAll('.abb-section').forEach(function (s) { s.classList.add('abb-active'); });
        setTimeout(function () { window.print(); }, 200);
      });
    }

    // Auditor submit
    var submitAudit = container.querySelector('.abb-submit-audit');
    if (submitAudit) {
      submitAudit.addEventListener('click', function () {
        var data = getData();
        if (calcProgress(data) < 80) return;
        data.auditor = 'approved';
        saveOpp(oppKey, data);
        reRender();
      });
    }

    // Auditor reset
    var resetAudit = container.querySelector('.abb-reset-audit');
    if (resetAudit) {
      resetAudit.addEventListener('click', function () {
        var data = getData();
        data.auditor = 'pending';
        saveOpp(oppKey, data);
        reRender();
      });
    }
  }

  /* ── Utility ───────────────────────────────────────────────── */
  function escHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Public Namespace ──────────────────────────────────────── */
  window.LIMENAgricultureBusinessBuild = {
    BUSINESS_TYPES:  BUSINESS_TYPES,
    BUILD_SECTIONS:  BUILD_SECTIONS,
    renderPanel:     renderPanel,
    wirePanel:       wirePanel,
    loadOpp:         loadOpp,
    saveOpp:         saveOpp,
    calcProgress:    calcProgress,
    ACCENT:          ACCENT,
    STORAGE_KEY:     STORAGE_KEY
  };

})();
