/**
 * economy-business-build.js — BUSINESS BUILD Execution Workspace v2
 *
 * Complete business launch system. 7 stages, 24+ subsections,
 * business-type templates, branching logic, lender-ready financials,
 * 90-day execution plan, deep reviewer mode, printable launch packet.
 *
 * Economy domain only.
 * Exposes: window.LIMENEconomyBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isEconomy = params.get('domain') === 'economy';
  var isWorkspace = window.location.pathname.indexOf('economy-workspace') !== -1;
  if (!isEconomy && !isWorkspace) return;

  var STORE_KEY = 'limen_economy_business_build';
  var MODE_KEY = 'limen_economy_bb_mode';
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
  // BUSINESS TYPE TEMPLATES — 5 ECONOMY ARCHETYPES
  // ══════════════════════════════════════════════════════════════════════

  var TEMPLATES = {
    'macro_advisory': {
      label: 'Macro Advisory Practice',
      description: 'A macroeconomic consulting firm providing GDP forecasting, monetary policy analysis, fiscal impact assessment, and economic scenario planning to governments, central banks, institutional investors, and multinational corporations.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$15K-$75K',
      legalNotes: 'LLC typically sufficient. No specific economic consulting license required at federal level. May need state business license. Professional liability insurance (E&O) recommended. Government contract work may require GSA schedule or SAM.gov registration.',
      fundingNotes: 'Low startup costs. Main investment is in data subscriptions (BLS, BEA, Fed data, Bloomberg) and econometric software (STATA, EViews, R). Revenue starts with first client engagement.',
      operatingNotes: 'Revenue from retainer-based advisory ($10K-$50K/month), project fees ($25K-$250K), and speaking/publication fees. Reputation and accuracy of forecasts drive growth. Policy access and relationships are the moat.',
      first90: [
        'DAYS 1-5: File LLC in your state. Apply for EIN at irs.gov/ein. Open business checking account. Purchase professional liability insurance (E&O) — contact Hiscox or Hartford. Cost: $1,500-$3,000/year. OUTPUT: Entity formed, EIN obtained, E&O active.',
        'DAYS 1-5: Subscribe to essential data sources: BLS (free), BEA NIPA (free), FRED (free), Census Bureau API (free). Evaluate paid subscriptions: Bloomberg Terminal ($24K/year), Haver Analytics, or Macrobond. Set up econometric software: R/Python (free) or STATA ($1,595+). OUTPUT: Data pipeline operational.',
        'DAYS 6-15: Define your core advisory offerings. Common niches: GDP nowcasting, inflation forecasting, labor market analysis, trade policy impact, fiscal multiplier assessment, monetary policy transmission analysis. Write a 3-page capabilities brief. OUTPUT: Service offerings defined with capability brief.',
        'DAYS 6-15: Build your first proprietary model. Start with a GDP nowcasting model using high-frequency indicators (jobless claims, PMI, retail sales, satellite data). Backtest against actual GDP releases. Document methodology for client presentations. OUTPUT: First proprietary model built and backtested.',
        'DAYS 16-25: Build prospect list: 25 institutional investors, 10 government agencies, 5 multinational corporations, and 5 trade associations. Research their current economic advisory relationships. Prepare tailored outreach for each segment. OUTPUT: 45-target prospect list with research.',
        'DAYS 26-40: Publish your first economic forecast or policy brief. Distribute via LinkedIn, email list, and targeted outreach. Offer complimentary 30-minute economic outlook briefings to top prospects. Attend or present at an economics conference (AEA, NABE, or regional). OUTPUT: First publication released, 10+ briefings scheduled.',
        'DAYS 41-60: Close first engagement. Deliver a comprehensive economic outlook report with proprietary forecasts. Over-deliver on analysis depth and presentation quality. Request testimonial upon completion. OUTPUT: First client engagement delivered.',
        'DAYS 61-75: Build recurring revenue: propose quarterly retainer arrangement to first client. Develop a monthly economic outlook newsletter for prospect nurturing. Consider launching a subscription-based research product. OUTPUT: Recurring revenue pipeline initiated.',
        'DAYS 76-90: Review first quarter: track forecast accuracy against actuals. Refine models based on performance. Set up CRM for pipeline tracking. Target: 3 active clients by end of Q1 with $15K+ monthly recurring revenue. OUTPUT: Q1 review complete, accuracy scorecard published.'
      ]
    },
    'trade_analytics': {
      label: 'Trade Analytics Platform',
      description: 'A technology company providing trade flow analysis, tariff impact modeling, supply chain economics, and cross-border trade intelligence to importers, exporters, logistics companies, and government trade agencies.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$75K-$300K',
      legalNotes: 'LLC or C-Corp depending on funding path. Export control regulations may apply if serving foreign governments. ITAR/EAR compliance if handling controlled economic data. Data licensing agreements with trade data providers required.',
      fundingNotes: 'Moderate startup for data acquisition and platform development. Key data sources: UN Comtrade, USITC DataWeb, Census Foreign Trade Statistics. Platform development: $50K-$150K for MVP. May pursue SBIR/STTR grants.',
      operatingNotes: 'Revenue from SaaS subscriptions ($2K-$15K/month), enterprise licensing ($50K-$200K/year), and custom trade impact studies ($25K-$100K). Data freshness and analytical depth are competitive advantages.',
      first90: [
        'DAYS 1-7: Form entity (LLC for bootstrap, C-Corp if seeking VC). Apply for EIN. Register on SAM.gov if pursuing government contracts. Purchase E&O insurance. OUTPUT: Entity formed, registrations initiated.',
        'DAYS 1-7: Secure data access: UN Comtrade API (free tier), USITC DataWeb (free), Census Bureau Foreign Trade Statistics (free), WTO tariff data (free). Evaluate paid sources: IHS Markit, Descartes Datamyne, ImportGenius. Budget $5K-$20K/year for premium trade data. OUTPUT: Trade data pipeline established.',
        'DAYS 8-20: Write product requirements document for trade analytics platform MVP. Core features: HS code trade flow visualization, tariff impact calculator, trade partner analysis, supply chain risk scoring. Define API specifications. OUTPUT: PRD complete with MVP scope.',
        'DAYS 8-20: Begin platform development. Frontend: interactive trade flow maps, tariff impact dashboards. Backend: trade data ingestion, harmonized system classification engine, impact modeling API. Tech stack: Python/FastAPI, React, PostgreSQL, D3.js. OUTPUT: Development sprint 1 started.',
        'DAYS 21-40: Build tariff impact model: given HS code and origin/destination, calculate duty rate, estimate price impact, model substitution effects. Integrate with current US HTS schedule. Add Section 301, 201, and AD/CVD duty layers. OUTPUT: Tariff impact engine functional.',
        'DAYS 41-55: Build supply chain economics module: identify concentration risk by tracking import source diversification, calculate economic exposure by trade corridor, model disruption scenarios (port closure, tariff escalation, sanctions). OUTPUT: Supply chain risk scoring operational.',
        'DAYS 56-70: Beta launch with 5-10 target users: trade compliance managers, import/export companies, customs brokers. Collect feedback on UX, data accuracy, and analytical value. Iterate on highest-impact features. OUTPUT: Beta feedback collected, priority fixes identified.',
        'DAYS 71-80: Prepare go-to-market: pricing tiers (starter/professional/enterprise), marketing website, case studies from beta users, demo environment. Apply for SBIR/STTR grant if pursuing government market. OUTPUT: GTM materials ready.',
        'DAYS 81-90: Launch publicly. Target first 10 paying subscribers. Set up customer success process. Track: MRR, user engagement, data accuracy scores, and feature usage analytics. OUTPUT: Public launch, first paying customers onboarded.'
      ]
    },
    'fiscal_consultancy': {
      label: 'Fiscal Policy Consultancy',
      description: 'A professional services firm advising state and local governments, sovereign entities, and development organizations on fiscal policy design, tax structure optimization, budget management, debt sustainability, and public finance strategy.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$20K-$80K',
      legalNotes: 'LLC sufficient. Government procurement registration required (SAM.gov, state vendor portals). May need registered municipal advisor (SEC/MSRB) if advising on bond issuance. Background checks for government contract eligibility.',
      fundingNotes: 'Low startup cost. Revenue from government contracts ($50K-$500K per engagement), development organization funding (World Bank, IMF technical assistance), and advisory retainers. Payment cycles can be long (60-90 days for government clients).',
      operatingNotes: 'Revenue from project-based consulting, retainers, and training programs. Government procurement cycles require patience. Past performance and references are critical for winning new contracts. DUNS registration and past performance database essential.',
      first90: [
        'DAYS 1-5: File LLC. Apply for EIN. Open business bank account. Register on SAM.gov (required for federal contracts). Register on state/local vendor portals in your target jurisdictions. OUTPUT: Entity formed, government registrations initiated.',
        'DAYS 6-10: Purchase professional liability insurance. Obtain DUNS/UEI number if not yet assigned. Prepare Standard Form 330 (qualifications statement for government services). OUTPUT: Insurance active, SF-330 prepared.',
        'DAYS 6-15: Define fiscal advisory service offerings: revenue forecasting, tax structure analysis, expenditure optimization, debt capacity assessment, capital improvement planning, economic development incentive analysis. Write 5-page qualifications package. OUTPUT: Service offerings documented.',
        'DAYS 16-25: Build analytical toolset: revenue forecasting models (property tax, sales tax, income tax), debt service coverage calculators, capital budget planning templates, fiscal stress indicators dashboard. Use open data from Census Bureau Annual Survey of State Government Finances. OUTPUT: Core analytical tools built.',
        'DAYS 26-35: Identify 20 target clients: municipalities with fiscal stress indicators, states undertaking tax reform, development organizations with active RFPs, counties facing budget shortfalls. Monitor government procurement portals daily (GovWin, FBO.gov successor SAM.gov). OUTPUT: 20-target prospect list, procurement monitoring active.',
        'DAYS 36-50: Respond to first RFP or submit unsolicited proposal to target municipality. Government proposals require: technical approach, staffing plan, past performance, and cost proposal. Allow 2-3 weeks for response preparation. OUTPUT: First proposal submitted.',
        'DAYS 51-65: While awaiting procurement decisions, deliver a pro bono fiscal health assessment for a small municipality. Use publicly available CAFR data. Present findings to city council. This builds portfolio and references. OUTPUT: Pro bono engagement complete, reference secured.',
        'DAYS 66-80: Publish fiscal policy brief on timely topic (property tax reform, state budget gaps, infrastructure funding). Distribute to prospects and submit to Government Finance Review or similar publication. Attend GFOA conference or state finance officers association meeting. OUTPUT: Thought leadership published, conference attended.',
        'DAYS 81-90: Review pipeline: proposals submitted, responses pending, new RFPs identified. Target: 1-2 active engagements by Q2. Refine pricing based on initial market response. Consider subcontracting to larger firms for past performance building. OUTPUT: Pipeline reviewed, Q2 targets set.'
      ]
    },
    'labor_platform': {
      label: 'Labor Economics Platform',
      description: 'A data and analytics platform providing labor market intelligence — workforce analytics, wage benchmarking, skills gap analysis, employment forecasting, and labor supply-demand modeling for employers, workforce boards, and economic development agencies.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$50K-$200K',
      legalNotes: 'LLC or C-Corp. If accessing BLS Confidential Data Research Center, requires special agreements. FERPA compliance if using education data. State workforce agency data sharing agreements may be needed.',
      fundingNotes: 'Moderate startup for data acquisition and platform development. Free data: BLS OES, QCEW, CPS. Paid data: Burning Glass/Lightcast ($50K+/year), LinkedIn Economic Graph API, ADP workforce data. Potential SBIR/STTR funding from DOL.',
      operatingNotes: 'Revenue from SaaS subscriptions to employers and workforce boards ($1K-$10K/month), enterprise licensing ($25K-$150K/year), and custom workforce studies. Data partnerships and API access are the moat. Accuracy of forecasts drives renewals.',
      first90: [
        'DAYS 1-7: Form entity. Apply for EIN. Register on SAM.gov for government contracting. Contact state workforce agency about data partnership possibilities. OUTPUT: Entity formed, workforce agency outreach initiated.',
        'DAYS 1-7: Establish data pipeline: BLS Occupational Employment Statistics (free API), Quarterly Census of Employment and Wages (free), Current Population Survey microdata (free via IPUMS), O*NET occupation database (free). Evaluate Lightcast/Burning Glass for job posting data. OUTPUT: Core labor data pipeline operational.',
        'DAYS 8-20: Build MVP labor analytics platform. Core modules: regional employment dashboard, wage benchmarking by occupation/geography, skills demand analysis from job postings, labor supply-demand gap scoring. Tech: Python, PostgreSQL, React, mapping library. OUTPUT: MVP development started.',
        'DAYS 21-35: Build employment forecasting model using leading indicators: initial claims, job openings (JOLTS), PMI employment component, temporary staffing levels. Backtest against actual employment changes. Document methodology. OUTPUT: Employment forecast model built and validated.',
        'DAYS 36-50: Build skills gap analysis engine: map employer demand (from job postings) against workforce supply (from education completions and occupation data). Score gaps by region, occupation, and industry. Visualize on interactive maps. OUTPUT: Skills gap engine operational.',
        'DAYS 51-60: Beta launch with 3-5 workforce development boards or economic development organizations. These are ideal beta users — they need this data and can provide immediate feedback and references. OUTPUT: Beta users onboarded, feedback collection started.',
        'DAYS 61-70: Develop employer-facing product: wage benchmarking tool, talent availability scoring, workforce planning calculator. Employers pay more and faster than government agencies. OUTPUT: Employer product module built.',
        'DAYS 71-80: Apply for DOL SBIR/STTR grant if pursuing workforce innovation angle. Alternatively, respond to workforce board RFPs for labor market information services. Prepare investor deck if pursuing VC path. OUTPUT: Funding application or RFP submitted.',
        'DAYS 81-90: Public launch. Target: 5 paying customers (mix of workforce boards and employers). Track: MRR, forecast accuracy, user engagement, and data freshness metrics. Set Q2 growth targets. OUTPUT: Public launch complete, initial revenue generating.'
      ]
    },
    'monetary_instruments': {
      label: 'Monetary Instruments Firm',
      description: 'A specialized economic services firm focused on monetary system analysis, inflation hedging products, currency risk advisory, CBDC consulting, and monetary policy transmission research for central banks, treasuries, and institutional investors.',
      capitalIntensity: 'low', regulated: false, typicalStartup: '$25K-$100K',
      legalNotes: 'LLC sufficient for advisory. If offering investment products, may need RIA registration (SEC) or commodity trading advisor registration (CFTC/NFA). Inflation-linked product structuring may require broker-dealer affiliation.',
      fundingNotes: 'Low startup if advisory-only. Higher if building inflation hedging products. Key data: FRED (free), central bank publications (free), TIPS breakeven data (free). Revenue from advisory retainers and research subscriptions.',
      operatingNotes: 'Revenue from institutional advisory ($15K-$50K/month retainer), research subscriptions ($5K-$25K/year), CBDC consulting projects ($100K-$500K), and inflation hedging strategy fees. Central bank network and policy credibility are essential.',
      first90: [
        'DAYS 1-5: File LLC. Apply for EIN. Open business bank account. Purchase E&O insurance. If planning to offer investment advice, evaluate RIA registration requirements. OUTPUT: Entity formed, regulatory path mapped.',
        'DAYS 6-10: Establish monetary data infrastructure: FRED API (free — all Fed data), BIS statistics (free), IMF IFS data (free), central bank websites (free). Set up automated data ingestion for key monetary indicators: money supply, interest rates, inflation expectations, exchange rates. OUTPUT: Monetary data pipeline operational.',
        'DAYS 11-20: Build proprietary inflation forecasting model: combine CPI components, PPI pipeline, wage growth, money supply growth, inflation expectations (Michigan/NY Fed), TIPS breakevens, and commodity prices. Backtest against actual CPI. OUTPUT: Inflation model built and backtested.',
        'DAYS 21-30: Define service offerings: (1) Monetary policy outlook advisory, (2) Inflation hedging strategy, (3) Currency risk assessment, (4) CBDC impact analysis, (5) Central bank policy transmission research. Write detailed service descriptions for each. OUTPUT: Five service lines defined.',
        'DAYS 31-40: Build prospect list: 15 institutional investors (pension funds, insurance companies, endowments), 10 central banks and treasuries, 5 multinational corporations with currency exposure. Research their current monetary advisory relationships. OUTPUT: 30-target prospect list.',
        'DAYS 41-55: Publish first monetary policy analysis or inflation outlook report. Distribute to prospects. Offer complimentary inflation risk assessment to top 5 prospects. Present at monetary economics seminar or webinar. OUTPUT: First publication released, presentations delivered.',
        'DAYS 56-70: Close first advisory engagement. Deliver comprehensive monetary outlook with proprietary inflation and rate forecasts. Include actionable hedging or positioning recommendations. OUTPUT: First engagement delivered.',
        'DAYS 71-80: Develop CBDC consulting capability: research all active CBDC projects globally (digital yuan, digital euro, FedNow implications). Build assessment framework for CBDC impact on monetary policy transmission. OUTPUT: CBDC consulting framework ready.',
        'DAYS 81-90: Review Q1: forecast accuracy scorecard, client satisfaction, pipeline status. Target: 2-3 active retainer clients by end of quarter. Evaluate launching subscription research product for broader distribution. OUTPUT: Q1 review complete, growth plan set.'
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STAGE DEFINITIONS — 7 stages, 24 subsections
  // ══════════════════════════════════════════════════════════════════════

  var STAGES = [
    { id: 'stage1', title: 'STAGE 1 — BUSINESS DEFINITION', sections: [
      { id: 'concept', title: 'Business Concept', type: 'fields',
        guidance: 'Define the economics business in language anyone can understand. If you cannot explain it in two sentences, you do not understand it well enough. The reviewer will reject vague descriptions.',
        fields: [
          { id: 'name', label: 'Business name (draft)', type: 'text', placeholder: 'e.g., Meridian Economic Advisory LLC' },
          { id: 'one_liner', label: 'One-sentence description', type: 'text', placeholder: 'We provide [economic service] to [customer] in [market]' },
          { id: 'full_desc', label: 'Full business description (3-5 sentences)', type: 'textarea', placeholder: 'What does the business do? Who are the clients? How does it make money? What economic domain does it serve?' },
          { id: 'node_source', label: 'Node source (from LIMEN mapping)', type: 'text', prefill: 'nodeLabel' },
          { id: 'mapping_title', label: 'Business mapping title', type: 'text', prefill: 'businessType' }
        ] },
      { id: 'market', title: 'Client & Market', type: 'fields',
        guidance: 'Who pays you? Be specific. "Governments" is too vague. "State budget offices with $5B-$50B annual budgets that need revenue forecasting model upgrades" is specific.',
        fields: [
          { id: 'target_customer', label: 'Primary target client', type: 'textarea', placeholder: 'Describe your ideal client in detail. Size, type, economic focus, pain point.' },
          { id: 'market_size', label: 'Estimated addressable market', type: 'text', placeholder: 'How many potential clients exist? What do they currently spend?' },
          { id: 'geography', label: 'Service geography', type: 'text', placeholder: 'Local, regional, national, or international' },
          { id: 'competition', label: 'Main competitors or alternatives', type: 'textarea', placeholder: 'Who else serves this client? What do they charge? Why would clients switch?' },
          { id: 'differentiation', label: 'Why you win', type: 'textarea', placeholder: 'Data access, model accuracy, policy experience, technology, speed, pricing?' }
        ] },
      { id: 'revenue', title: 'Revenue Model', type: 'fields',
        guidance: 'How does money come in? In economics services, common models include: advisory retainers, project fees, SaaS subscriptions, research subscriptions, government contracts, and training programs.',
        fields: [
          { id: 'model_type', label: 'Revenue model', type: 'select', options: ['Advisory retainer', 'Project / engagement fees', 'SaaS subscription', 'Research subscription', 'Government contract', 'Training / workshops', 'Data licensing', 'Mixed', 'Other'] },
          { id: 'pricing', label: 'Pricing structure', type: 'textarea', placeholder: 'What do you charge? Fee schedule, rate card, or subscription tiers.' },
          { id: 'payment_terms', label: 'Payment terms', type: 'text', placeholder: 'Monthly retainer, milestone-based, net 30/60/90?' },
          { id: 'recurring', label: 'Recurring vs one-time revenue', type: 'select', options: ['Mostly recurring (retainer, subscription)', 'Mostly one-time (project, engagement)', 'Mixed', 'Undecided'] }
        ] },
      { id: 'biz_type', title: 'Business Type & Mode', type: 'fields',
        guidance: 'Choose the template that best matches your economics business. This determines which operational and compliance sections appear below.',
        fields: [
          { id: 'template', label: 'Business type template', type: 'select', options: ['macro_advisory', 'trade_analytics', 'fiscal_consultancy', 'labor_platform', 'monetary_instruments'] },
          { id: 'build_mode', label: 'Build mode', type: 'select', options: ['Basic Build', 'Franchise-Ready Build'] },
          { id: 'capital_intensity', label: 'Capital intensity', type: 'select', options: ['Low ($10K-$100K)', 'Medium ($100K-$500K)', 'High ($500K+)'] },
          { id: 'regulated', label: 'Regulatory intensity?', type: 'select', options: ['Light (state registration only)', 'Moderate (government contracting + data agreements)', 'Heavy (RIA/CTA registration + government clearance)'] }
        ] }
    ]},

    { id: 'stage2', title: 'STAGE 2 — LEGAL FORMATION & REGISTRATION', sections: [
      { id: 'entity', title: 'Entity Choice', type: 'fields',
        guidance: 'Economics advisory firms are typically LLCs. Platform companies seeking VC should be C-Corps. Government contractors may need specific entity types for contracting eligibility.',
        fields: [
          { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC (most common for advisory)', 'S-Corp (tax optimization for established firms)', 'C-Corp (VC-backed platform)', 'Sole Proprietorship (simplest, limited liability)', 'Partnership', 'Undecided — need advice'] },
          { id: 'state', label: 'State of formation', type: 'text', placeholder: 'Delaware for C-Corp. Home state for LLC advisory.' },
          { id: 'name_check', label: 'Name availability checked?', type: 'select', options: ['Not yet', 'Available — confirmed with Secretary of State', 'Taken — need alternative', 'Reserved'] },
          { id: 'formation_cost', label: 'Estimated formation cost', type: 'text', placeholder: 'Filing fees + legal + registrations' }
        ] },
      { id: 'tax_id', title: 'Tax ID & Registration', type: 'mixed',
        guidance: 'Economics businesses need EIN plus potentially: SAM.gov registration, state vendor portal registrations, and data access agreements with government statistical agencies.',
        fields: [
          { id: 'ein', label: 'EIN', type: 'text', placeholder: 'Apply free at irs.gov/ein' },
          { id: 'sam_uei', label: 'SAM.gov UEI number', type: 'text', placeholder: 'Required for government contracts' },
          { id: 'state_vendor', label: 'State vendor registration', type: 'text', placeholder: 'Registration in target state procurement systems' },
          { id: 'data_agreements', label: 'Data access agreements', type: 'text', placeholder: 'BLS, Census, BEA data access agreements' }
        ],
        checklist: ['EIN obtained from IRS', 'State entity registration complete', 'SAM.gov registration complete', 'DUNS/UEI number assigned', 'State vendor portal registration(s) filed', 'Data access agreements executed'] },
      { id: 'governance', title: 'Governance & Agreements', type: 'checklist',
        guidance: 'Economics services firms require clear governance, particularly around data handling, conflicts of interest, and research methodology.',
        items: ['Operating agreement / bylaws adopted', 'Ownership percentages documented', 'Research methodology standards adopted', 'Conflict of interest policy', 'Data handling and confidentiality policy', 'IP assignment agreement', 'Non-compete / non-solicitation agreements', 'Employee handbook with data security sections'] },
      { id: 'compliance', title: 'Insurance & Professional Standards', type: 'mixed',
        guidance: 'Economics advisory firms need professional liability coverage. Government contractors need additional compliance documentation. Data-intensive firms need cyber insurance.',
        fields: [
          { id: 'eo_insurance', label: 'Professional liability / E&O', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'cyber_insurance', label: 'Cyber liability insurance', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'gl_insurance', label: 'General liability', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'data_security', label: 'Data security program', type: 'select', options: ['Not started', 'In progress', 'Complete'] }
        ],
        checklist: ['Professional liability insurance active', 'Research methodology documented', 'Data security policy written', 'Confidentiality / NDA templates ready', 'Government contracting compliance (if applicable)', 'Privacy policy (data handling)', 'Business continuity plan', 'Quality assurance / peer review process'] },
      { id: 'banking', title: 'Banking & Bookkeeping', type: 'checklist',
        guidance: 'Economics businesses must maintain clean, auditable books. Government contractors face additional financial documentation requirements.',
        items: ['Business operating account opened', 'Business credit card obtained', 'Accounting software set up (QuickBooks, Xero)', 'Chart of accounts configured', 'Revenue recognition policy documented', 'Government contract accounting setup (if applicable)', 'Accountant or bookkeeper identified', 'Invoicing system established'] }
    ]},

    { id: 'stage3', title: 'STAGE 3 — FUNDING PREPARATION', sections: [
      { id: 'startup_costs', title: 'Startup Cost Estimate', type: 'fields',
        guidance: 'Economics businesses have unique cost categories: data subscriptions, econometric software, conference attendance, and publication costs.',
        fields: [
          { id: 'cost_data', label: 'Data subscriptions and licenses ($)', type: 'text' },
          { id: 'cost_technology', label: 'Technology / platforms ($)', type: 'text' },
          { id: 'cost_legal', label: 'Legal / registration ($)', type: 'text' },
          { id: 'cost_insurance', label: 'Insurance premiums ($)', type: 'text' },
          { id: 'cost_software', label: 'Econometric / analytics software ($)', type: 'text' },
          { id: 'cost_marketing', label: 'Marketing / conferences ($)', type: 'text' },
          { id: 'cost_working_cap', label: 'Working capital (3-6 months) ($)', type: 'text' },
          { id: 'cost_buffer', label: 'Contingency buffer (15-20%) ($)', type: 'text' },
          { id: 'cost_total', label: 'TOTAL STARTUP COST ($)', type: 'text', placeholder: 'Sum of all above' }
        ] },
      { id: 'sources', title: 'Sources of Funds', type: 'fields',
        guidance: 'Economics businesses can leverage SBIR/STTR grants, SBA loans, and government economic development programs in addition to traditional funding.',
        fields: [
          { id: 'src_owner', label: 'Owner equity / cash injection ($)', type: 'text' },
          { id: 'src_loan', label: 'SBA or term loan ($)', type: 'text' },
          { id: 'src_investor', label: 'Outside investment / VC ($)', type: 'text' },
          { id: 'src_grant', label: 'SBIR/STTR or other grant ($)', type: 'text' },
          { id: 'src_contract', label: 'Advance from first contract ($)', type: 'text' },
          { id: 'src_other', label: 'Other sources ($)', type: 'text' },
          { id: 'src_total', label: 'TOTAL SOURCES ($)', type: 'text', placeholder: 'Must equal total startup cost' }
        ] },
      { id: 'loan_prep', title: 'Financing Readiness', type: 'checklist',
        guidance: 'If seeking financing, economics businesses should emphasize: revenue pipeline, government contract pipeline, data asset value, and intellectual property.',
        items: ['Business plan with market analysis', 'Financial projections (12-month)', 'Personal financial statement', 'Tax returns (2+ years)', 'Client pipeline documentation', 'Government contracting credentials', 'Insurance documentation', 'Professional credentials and CVs'] }
    ]},

    { id: 'stage4', title: 'STAGE 4 — FINANCIAL READINESS', sections: [
      { id: 'proforma', title: '12-Month Pro Forma', type: 'fields',
        guidance: 'Economics business pro formas must account for: data subscription costs, conference/travel for business development, and potentially long government payment cycles (60-90 days).',
        fields: [
          { id: 'monthly_revenue', label: 'Projected monthly revenue ($)', type: 'text', placeholder: 'Conservative — account for pipeline build time' },
          { id: 'revenue_basis', label: 'Revenue assumptions', type: 'textarea', placeholder: 'X clients at $Y average engagement = $Z/month. When do clients sign?' },
          { id: 'monthly_data', label: 'Monthly data subscriptions ($)', type: 'text', placeholder: 'Bloomberg, Lightcast, Haver, etc.' },
          { id: 'monthly_technology', label: 'Monthly technology ($)', type: 'text', placeholder: 'Cloud, software, APIs' },
          { id: 'monthly_personnel', label: 'Monthly personnel ($)', type: 'text', placeholder: 'Salaries, benefits, contractors' },
          { id: 'monthly_insurance', label: 'Monthly insurance ($)', type: 'text' },
          { id: 'monthly_other', label: 'Monthly other overhead ($)', type: 'text' },
          { id: 'monthly_total_exp', label: 'TOTAL monthly expenses ($)', type: 'text' },
          { id: 'breakeven', label: 'Break-even month', type: 'text', placeholder: 'When cumulative revenue exceeds cumulative costs' }
        ] }
    ]},

    { id: 'stage5', title: 'STAGE 5 — OPERATING MODEL', sections: [
      { id: 'delivery', title: 'Service Delivery', type: 'fields',
        guidance: 'How do you deliver the economic service? Walk through the client journey from first contact to ongoing advisory relationship.',
        fields: [
          { id: 'offer', label: 'Core service offering', type: 'textarea', placeholder: 'What specific economic service do you deliver?' },
          { id: 'process', label: 'Client journey (step by step)', type: 'textarea', placeholder: '1. Prospect → 2. Discovery → 3. Proposal → 4. Engagement → 5. Analysis → 6. Deliverable → 7. Ongoing advisory' },
          { id: 'quality', label: 'Quality standards', type: 'textarea', placeholder: 'Forecast accuracy targets, peer review process, revision policy' },
          { id: 'capacity', label: 'Maximum capacity', type: 'text', placeholder: 'How many clients or projects can you handle simultaneously?' }
        ] },
      { id: 'team', title: 'Team & Staffing', type: 'fields',
        guidance: 'Economics firms require credentialed professionals. Document qualifications, research specializations, and publication records.',
        fields: [
          { id: 'founder_role', label: 'Founder role and credentials', type: 'textarea', placeholder: 'Your role + degrees, certifications, publications' },
          { id: 'first_hire', label: 'First hire (role + timing)', type: 'text', placeholder: 'e.g., Research economist at month 4' },
          { id: 'staff_plan', label: 'Year 1 staffing plan', type: 'textarea', placeholder: 'Include credential requirements per role' },
          { id: 'compensation', label: 'Compensation approach', type: 'textarea', placeholder: 'Base + bonus, profit sharing, equity?' }
        ] },
      { id: 'infrastructure', title: 'Technology & Data Infrastructure', type: 'fields',
        guidance: 'Economics businesses depend on data infrastructure, econometric tools, and secure data handling.',
        fields: [
          { id: 'core_system', label: 'Core platform / system', type: 'text', placeholder: 'Analytics platform, econometric software, or custom system' },
          { id: 'data_stack', label: 'Data infrastructure', type: 'textarea', placeholder: 'Data sources, ingestion, storage, and access management' },
          { id: 'security', label: 'Security infrastructure', type: 'textarea', placeholder: 'Encryption, access controls, data classification, backup' },
          { id: 'vendors', label: 'Key vendors', type: 'textarea', placeholder: 'Data providers, cloud, software, consulting tools' }
        ] },
      { id: 'customers', title: 'Client Acquisition', type: 'fields',
        guidance: 'In economics services, credibility drives acquisition. Publications, conference presentations, and referrals are primary channels.',
        fields: [
          { id: 'first_10', label: 'How will you get your first 10 clients?', type: 'textarea', placeholder: 'Professional network, conference presentations, publications, government RFPs?' },
          { id: 'ongoing', label: 'Ongoing acquisition strategy', type: 'textarea', placeholder: 'Thought leadership, referrals, government procurement pipeline, strategic partnerships?' },
          { id: 'cac', label: 'Estimated client acquisition cost', type: 'text' },
          { id: 'ltv', label: 'Estimated client lifetime value', type: 'text' }
        ] },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields',
        guidance: 'Economics businesses often have a 3-6 month pipeline build period. Government contracts can take 6+ months from RFP to award.',
        fields: [
          { id: 'days_1_30', label: 'Days 1-30: Foundation', type: 'textarea', placeholder: 'Entity, registrations, data infrastructure, first models' },
          { id: 'days_31_60', label: 'Days 31-60: Build', type: 'textarea', placeholder: 'First publications, prospect outreach, beta testing' },
          { id: 'days_61_90', label: 'Days 61-90: Launch', type: 'textarea', placeholder: 'First clients, pipeline building, revenue generation' }
        ] }
    ]},

    { id: 'stage6', title: 'STAGE 6 — DOCUMENT PACKET', sections: [
      { id: 'legal_docs', title: 'Legal & Registration Documents', type: 'checklist',
        guidance: 'Economics businesses require documentation for government contracting, data access, and professional services delivery.',
        items: ['Articles of organization / incorporation', 'Operating agreement / bylaws', 'EIN confirmation letter', 'SAM.gov registration confirmation', 'State vendor registration(s)', 'Research methodology standards', 'Data handling agreements', 'Client agreement templates'] },
      { id: 'financial_docs', title: 'Financial Documents', type: 'checklist',
        guidance: 'Government clients and investors expect financial documentation demonstrating organizational stability.',
        items: ['Business plan with market analysis', '12-month financial projections', 'Startup cost and funding analysis', 'Personal financial statements (all principals)', 'Tax returns (2-3 years)', 'Proof of insurance (E&O, cyber, GL)', 'Banking references', 'Cost accounting methodology (for government contracts)'] },
      { id: 'operating_docs', title: 'Operating Documents', type: 'checklist',
        guidance: 'Operational documentation demonstrates research rigor and professional standards.',
        items: ['Service description and fee schedule', 'Research methodology documentation', 'Quality assurance / peer review process', 'Data security and privacy policy', 'Conflict of interest policy', 'Business continuity plan', 'Client onboarding procedures', 'Record retention schedule'] }
    ]},

    { id: 'stage7', title: 'STAGE 7 — REVIEW & APPROVAL', sections: [
      { id: 'readiness', title: 'Launch Readiness Review', type: 'review',
        guidance: 'Economics business launch readiness requires: legal formation complete, registrations filed, data infrastructure operational, first models built, and client pipeline initiated.' },
      { id: 'auditor', title: 'Reviewer Decision', type: 'auditor',
        guidance: 'The reviewer evaluates: research methodology rigor, data infrastructure, professional credentials, market positioning, financial viability, and overall launch readiness.' }
    ]}
  ];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER ENGINE
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
    if (sec.type === 'auditor') { var aud = ws.auditor || {}; var sl = aud.status || 'DRAFT'; h += '<div class="eep-auditor"><div class="eep-auditor-title">REVIEWER DECISION</div>'; h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>'; h += '<div class="eep-field"><label class="eep-field-label">Methodology readiness</label><select class="eep-select" data-auditor="method_ready"><option' + (aud.method_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.method_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.method_ready || aud.method_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Data infrastructure readiness</label><select class="eep-select" data-auditor="data_ready"><option' + (aud.data_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.data_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.data_ready || aud.data_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Financial viability</label><select class="eep-select" data-auditor="financial_ready"><option' + (aud.financial_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.financial_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.financial_ready || aud.financial_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Reviewer comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:60px">' + esc(aud.comments || '') + '</textarea></div>'; h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>'; if (aud.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(aud.timestamp).toLocaleString() + '</div>'; h += '</div>'; }
    h += '</div>';
    return h;
  }

  function autoGenerate(ws, prefill, tmpl) {
    if (ws._autoGenerated) return;
    ws._autoGenerated = true;
    var bizName = (prefill && prefill.businessType) ? prefill.businessType : 'New Economy Business';
    var nodeLabel = (prefill && prefill.nodeLabel) || '';
    var reason = (prefill && prefill.reason) || '';
    if (!ws.fields['concept']) ws.fields['concept'] = {};
    ws.fields['concept']['name'] = ws.fields['concept']['name'] || bizName + ' LLC';
    ws.fields['concept']['node_source'] = ws.fields['concept']['node_source'] || nodeLabel;
    ws.fields['concept']['mapping_title'] = ws.fields['concept']['mapping_title'] || bizName;
    ws.fields['concept']['one_liner'] = ws.fields['concept']['one_liner'] || 'We provide ' + bizName.toLowerCase() + ' services to the economy sector.';
    ws.fields['concept']['full_desc'] = ws.fields['concept']['full_desc'] || reason || (tmpl ? tmpl.description : '');
    if (!ws.fields['market']) ws.fields['market'] = {};
    ws.fields['market']['geography'] = ws.fields['market']['geography'] || 'Regional — United States';
    if (!ws.fields['entity']) ws.fields['entity'] = {};
    ws.fields['entity']['entity_type'] = ws.fields['entity']['entity_type'] || (tmpl ? (tmpl.capitalIntensity === 'high' ? 'C-Corp (VC-backed platform)' : 'LLC (most common for advisory)') : 'LLC (most common for advisory)');
    if (!ws.fields['startup_costs']) ws.fields['startup_costs'] = {};
    if (tmpl) {
      var costMap = { low: { data: '2000', tech: '2000', legal: '2000', ins: '2500', soft: '1500', mkt: '2000', wc: '12000', buf: '4000', total: '28000' }, medium: { data: '15000', tech: '10000', legal: '5000', ins: '4000', soft: '5000', mkt: '8000', wc: '30000', buf: '12000', total: '89000' }, high: { data: '30000', tech: '40000', legal: '10000', ins: '5000', soft: '10000', mkt: '15000', wc: '80000', buf: '30000', total: '220000' } };
      var costs = costMap[tmpl.capitalIntensity] || costMap['medium'];
      ws.fields['startup_costs']['cost_data'] = ws.fields['startup_costs']['cost_data'] || costs.data;
      ws.fields['startup_costs']['cost_technology'] = ws.fields['startup_costs']['cost_technology'] || costs.tech;
      ws.fields['startup_costs']['cost_legal'] = ws.fields['startup_costs']['cost_legal'] || costs.legal;
      ws.fields['startup_costs']['cost_insurance'] = ws.fields['startup_costs']['cost_insurance'] || costs.ins;
      ws.fields['startup_costs']['cost_software'] = ws.fields['startup_costs']['cost_software'] || costs.soft;
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
      if (bt.indexOf('macro') !== -1 || bt.indexOf('gdp') !== -1 || bt.indexOf('forecast') !== -1) tmplKey = 'macro_advisory';
      else if (bt.indexOf('trade') !== -1 || bt.indexOf('tariff') !== -1 || bt.indexOf('import') !== -1 || bt.indexOf('export') !== -1) tmplKey = 'trade_analytics';
      else if (bt.indexOf('fiscal') !== -1 || bt.indexOf('tax') !== -1 || bt.indexOf('budget') !== -1 || bt.indexOf('government') !== -1) tmplKey = 'fiscal_consultancy';
      else if (bt.indexOf('labor') !== -1 || bt.indexOf('workforce') !== -1 || bt.indexOf('employment') !== -1 || bt.indexOf('wage') !== -1) tmplKey = 'labor_platform';
      else if (bt.indexOf('monetary') !== -1 || bt.indexOf('inflation') !== -1 || bt.indexOf('currency') !== -1 || bt.indexOf('central bank') !== -1) tmplKey = 'monetary_instruments';
      else tmplKey = 'macro_advisory';
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

  window.LIMENEconomyBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[EconomyBusinessBuild] v2 loaded — 7 stages, 5 economy templates, 24+ subsections');
})();
