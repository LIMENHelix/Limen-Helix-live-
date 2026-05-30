/**
 * medicine-business-build.js — BUSINESS BUILD Execution Workspace v2
 *
 * Complete business launch system. 7 stages, 24+ subsections,
 * business-type templates, branching logic, lender-ready financials,
 * 90-day execution plan, deep reviewer mode, printable launch packet.
 *
 * Medicine domain only.
 * Exposes: window.LIMENMedicineBusinessBuild
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isMedicine = params.get('domain') === 'medicine';
  var isWorkspace = window.location.pathname.indexOf('medicine-workspace') !== -1;
  if (!isMedicine && !isWorkspace) return;

  var STORE_KEY = 'limen_medicine_business_build';
  var MODE_KEY = 'limen_medicine_bb_mode';
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
  // BUSINESS TYPE TEMPLATES — 5 MEDICINE ARCHETYPES
  // ══════════════════════════════════════════════════════════════════════

  var TEMPLATES = {
    'digital_health_platform': {
      label: 'Digital Health Platform',
      description: 'A technology company providing telemedicine, remote patient monitoring, digital therapeutics, or health data analytics to hospitals, clinics, insurers, and patients. Software-as-a-medical-device (SaMD), mobile health apps, or clinical decision support tools.',
      capitalIntensity: 'medium', regulated: true, typicalStartup: '$100K-$500K',
      legalNotes: 'LLC or C-Corp depending on funding path. FDA 510(k) or De Novo may be required for SaMD. HIPAA compliance mandatory. State telemedicine licensure may apply. BAA agreements required with all vendors handling PHI. SOC 2 Type II recommended.',
      fundingNotes: 'Moderate to high startup for FDA regulatory pathway and HIPAA compliance infrastructure. Revenue from SaaS subscriptions, per-encounter fees, or value-based contracts. NIH SBIR/STTR and BARDA grants available for digital health innovation.',
      operatingNotes: 'Revenue from health system subscriptions ($5K-$50K/month), per-patient-per-month fees ($3-$25 PPPM), or licensing agreements. Clinical validation data and peer-reviewed publications drive adoption. EHR integration is table stakes.',
      first90: [
        'DAYS 1-7: Form entity (C-Corp for VC, LLC for bootstrap). Apply for EIN. Register on SAM.gov. Engage healthcare regulatory attorney. Begin HIPAA compliance program design. OUTPUT: Entity formed, regulatory counsel engaged.',
        'DAYS 1-7: Establish HIPAA-compliant infrastructure: encrypted cloud (AWS HIPAA-eligible, Azure Healthcare), audit logging, access controls, BAA with all vendors. Purchase cyber liability insurance with healthcare endorsement. OUTPUT: HIPAA infrastructure operational.',
        'DAYS 8-20: Define product MVP. Core features: clinical workflow integration, patient data capture, outcome tracking, provider dashboard. Determine FDA classification: wellness device (exempt), Class I (510(k) exempt), or Class II (510(k) required). OUTPUT: MVP scope defined, FDA pathway identified.',
        'DAYS 21-40: Begin development sprint 1. Tech stack: FHIR-compliant APIs, HL7 integration, encrypted data store, responsive web + mobile. Implement audit trail and consent management per 21 CFR Part 11 if FDA-regulated. OUTPUT: Development sprint 1 complete.',
        'DAYS 41-55: Prepare clinical validation plan. Design pilot study with 1-2 clinical sites. Draft IRB protocol if human subjects research. Identify key opinion leaders (KOLs) for advisory board. OUTPUT: Clinical validation plan ready.',
        'DAYS 56-70: Beta launch with 2-3 health system partners. Collect usability data, clinical outcomes, and provider satisfaction. Iterate on highest-impact features. Begin FDA pre-submission (Q-Sub) process if applicable. OUTPUT: Beta feedback collected.',
        'DAYS 71-80: Prepare go-to-market: pricing tiers, case studies from beta sites, ROI calculator, demo environment. Apply for SBIR/STTR grant. Register for HIMSS and relevant health IT conferences. OUTPUT: GTM materials ready.',
        'DAYS 81-90: Public launch. Target first 5 paying health system customers. Track: MRR, clinical outcomes, provider adoption rate, patient engagement. Set Q2 growth targets. OUTPUT: Public launch, initial revenue.'
      ]
    },
    'clinical_research_org': {
      label: 'Clinical Research Organization (CRO)',
      description: 'A contract research organization providing clinical trial management, regulatory affairs, biostatistics, data management, pharmacovigilance, and medical writing services to pharmaceutical, biotech, and medical device companies conducting FDA-regulated research.',
      capitalIntensity: 'low', regulated: true, typicalStartup: '$25K-$150K',
      legalNotes: 'LLC typically sufficient. Must comply with ICH-GCP (Good Clinical Practice), 21 CFR Parts 11/50/56/312/812. IRB relationships required. FDA Form 1572 for investigator oversight. DEA registration if handling controlled substances.',
      fundingNotes: 'Low startup cost for service-based CRO. Revenue from project fees ($50K-$2M per study), per-patient fees ($3K-$15K per enrolled subject), and milestone payments. Working capital needed for 60-90 day payment cycles from pharma sponsors.',
      operatingNotes: 'Revenue from sponsor contracts. Average study management fee: $500K-$5M. Per-patient costs drive economics. Site management, monitoring, and data management are core competencies. Quality systems and audit readiness are competitive differentiators.',
      first90: [
        'DAYS 1-5: File LLC. Apply for EIN. Purchase professional liability insurance with clinical research endorsement ($2M-$5M coverage). Register on SAM.gov for government-funded studies. OUTPUT: Entity formed, insurance active.',
        'DAYS 6-15: Establish quality management system (QMS): SOPs for monitoring, data management, adverse event reporting, protocol deviation handling. Align with ICH-GCP E6(R2). Document training records. OUTPUT: QMS framework established.',
        'DAYS 16-25: Build core service offerings: (1) Site management, (2) Clinical monitoring, (3) Regulatory submissions, (4) Biostatistics, (5) Medical writing, (6) Pharmacovigilance. Write capability statement targeting Phase I-III studies. OUTPUT: Service offerings defined.',
        'DAYS 26-40: Build prospect list: 25 biotech companies with pipeline compounds in IND stage, 10 medical device companies with IDE-track products, 5 academic medical centers seeking CRO support. Research their current CRO relationships. OUTPUT: 40-target prospect list.',
        'DAYS 41-55: Attend BIO International, DIA Annual Meeting, or ACRP conference. Present capabilities. Offer complimentary protocol feasibility assessment to top prospects. Network with clinical operations VPs. OUTPUT: Conference attendance, 10+ meetings scheduled.',
        'DAYS 56-70: Close first study management contract. Deliver protocol development, site feasibility, and regulatory strategy. Over-deliver on timeline and quality. Request reference upon study milestone completion. OUTPUT: First contract signed.',
        'DAYS 71-80: Build CTMS (Clinical Trial Management System) or configure existing platform (Medidata, Oracle Clinical). Establish EDC capability. Build audit-ready trial master file template. OUTPUT: CTMS operational.',
        'DAYS 81-90: Review Q1: studies under management, patient enrollment metrics, quality metrics (protocol deviations, query rates). Target: 2-3 active studies by Q2. OUTPUT: Q1 review complete.'
      ]
    },
    'specialty_pharmacy': {
      label: 'Specialty Pharmacy',
      description: 'A pharmacy focused on high-cost, complex medications for chronic, rare, or life-threatening conditions. Provides patient support programs, medication therapy management, prior authorization services, and outcomes tracking for specialty drugs including biologics, oncology agents, and rare disease treatments.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$500K-$2M',
      legalNotes: 'Must obtain state pharmacy license(s), DEA registration, VAWD (Verified Accredited Drug Distributor) or similar. URAC or ACHC accreditation recommended. Must comply with DSCSA (Drug Supply Chain Security Act). 340B registration if serving FQHCs. PBM network contracts required.',
      fundingNotes: 'High startup due to inventory, licensing, compliance, and accreditation costs. Revenue from prescription dispensing margins, patient support program fees, and manufacturer hub service contracts. Specialty drug margins: 15-25% before DIR fees.',
      operatingNotes: 'Revenue from dispensing specialty medications ($10K-$100K+ per prescription). Key metrics: fill rate, time to therapy, adherence rate, and patient satisfaction. Payer contracts and manufacturer relationships drive volume.',
      first90: [
        'DAYS 1-10: Form entity. Apply for EIN. Engage pharmacy regulatory attorney. Begin state pharmacy license application(s) in target state(s). Apply for DEA registration. OUTPUT: Entity formed, licensing applications filed.',
        'DAYS 11-20: Secure pharmacy location compliant with state Board of Pharmacy requirements. Install USP 797/800 compliant clean room if handling sterile compounds. Implement temperature-controlled storage for biologics. OUTPUT: Pharmacy facility secured.',
        'DAYS 21-35: Hire Pharmacist-in-Charge (PIC). Establish policies and procedures manual. Implement pharmacy management system (PioneerRx, QS/1, or BestRx). Begin URAC or ACHC accreditation process. OUTPUT: PIC hired, accreditation started.',
        'DAYS 36-50: Establish wholesale distributor relationships (McKesson, AmerisourceBergen, Cardinal Health). Negotiate specialty drug purchasing agreements. Register with DSCSA compliance system. Set up 340B if applicable. OUTPUT: Supply chain established.',
        'DAYS 51-65: Apply for PBM network inclusion (CVS Caremark, Express Scripts, OptumRx). Negotiate specialty pharmacy network contracts. Establish prior authorization workflow. OUTPUT: Payer contracts initiated.',
        'DAYS 66-75: Build patient support program: medication counseling, adherence monitoring, financial assistance coordination, outcomes tracking. Hire patient care coordinators. OUTPUT: Patient support program operational.',
        'DAYS 76-85: Implement outcomes tracking and reporting. Build manufacturer hub service capabilities. Develop prescriber outreach materials. Register for NASP conference. OUTPUT: Outcomes platform ready.',
        'DAYS 81-90: Fill first prescriptions. Track: time to therapy, fill rate, patient satisfaction, adherence rate. Target: 50+ patients by end of Q1. OUTPUT: First prescriptions dispensed, operations validated.'
      ]
    },
    'medical_device_startup': {
      label: 'Medical Device Startup',
      description: 'A company developing novel medical devices, diagnostic instruments, surgical tools, wearable health monitors, or point-of-care testing systems. Navigates FDA clearance/approval pathway from concept through commercialization.',
      capitalIntensity: 'high', regulated: true, typicalStartup: '$250K-$2M',
      legalNotes: 'C-Corp preferred for VC funding. FDA device classification determines regulatory pathway: Class I (exempt or 510(k)), Class II (510(k)), Class III (PMA). QSR (21 CFR 820) compliance required. ISO 13485 certification recommended. Product liability insurance essential.',
      fundingNotes: 'High startup for design, prototyping, testing, and regulatory clearance. FDA 510(k) costs: $50K-$200K. PMA costs: $500K-$5M+. Revenue begins post-clearance. NIH SBIR/STTR, NSF, and BARDA grants available. VC and strategic investors common.',
      operatingNotes: 'Revenue from device sales, service contracts, and consumables/reagents. GPO contracts (Vizient, Premier, HealthTrust) drive hospital purchasing. KOL adoption and peer-reviewed publications accelerate market acceptance.',
      first90: [
        'DAYS 1-7: Form C-Corp (Delaware). Apply for EIN. Engage FDA regulatory consultant. Hire product liability insurance. Register FDA Establishment. OUTPUT: Entity formed, FDA establishment registered.',
        'DAYS 8-20: Complete device classification research. Determine predicate device for 510(k) or identify De Novo pathway. Document intended use, indications for use, and device description. Begin design history file (DHF). OUTPUT: Regulatory pathway identified.',
        'DAYS 21-35: Implement Quality Management System per 21 CFR 820 / ISO 13485. Document design controls, CAPA procedures, complaint handling, and supplier qualification. Hire quality engineer. OUTPUT: QMS established.',
        'DAYS 36-50: Complete design verification and validation testing. Conduct biocompatibility testing per ISO 10993 if applicable. Perform electromagnetic compatibility (EMC) testing. Document design outputs. OUTPUT: V&V testing complete.',
        'DAYS 51-65: Prepare FDA submission package. 510(k): substantial equivalence argument, performance testing, labeling. PMA: clinical data, manufacturing controls. Consider pre-submission (Q-Sub) meeting with FDA. OUTPUT: FDA submission prepared.',
        'DAYS 66-75: Submit FDA application. Begin manufacturing scale-up planning. Identify contract manufacturer if not in-house. Establish supply chain for components. OUTPUT: FDA submission filed.',
        'DAYS 76-85: While awaiting FDA decision, build commercial infrastructure: sales team hiring, GPO contract applications, distributor agreements, KOL advisory board. Apply for CPT/HCPCS codes if needed for reimbursement. OUTPUT: Commercial preparation underway.',
        'DAYS 81-90: Review status: FDA review timeline, manufacturing readiness, commercial pipeline. Target: FDA clearance within 6-12 months, first sales within 30 days of clearance. OUTPUT: Q1 review complete.'
      ]
    },
    'health_analytics': {
      label: 'Health Analytics Company',
      description: 'A data analytics company providing population health analytics, clinical decision support, healthcare AI/ML models, claims data analysis, quality measurement, and predictive analytics to health systems, insurers, and pharmaceutical companies.',
      capitalIntensity: 'medium', regulated: false, typicalStartup: '$75K-$300K',
      legalNotes: 'LLC or C-Corp. HIPAA compliance mandatory if handling PHI. BAA agreements with all data sources and vendors. De-identification standards per HIPAA Safe Harbor or Expert Determination. State health data privacy laws may apply (e.g., California CMIA).',
      fundingNotes: 'Moderate startup for data infrastructure, HIPAA compliance, and model development. Revenue from SaaS subscriptions, consulting engagements, and data licensing. NIH and AHRQ grants available for health services research. PCORI funding for patient-centered outcomes.',
      operatingNotes: 'Revenue from health system analytics subscriptions ($10K-$100K/month), payer consulting ($50K-$500K per engagement), and pharma real-world evidence studies ($100K-$1M). Data quality, model accuracy, and clinical relevance drive renewals.',
      first90: [
        'DAYS 1-7: Form entity. Apply for EIN. Establish HIPAA compliance program. Execute BAA agreements with cloud providers. Purchase cyber liability insurance with healthcare endorsement. OUTPUT: Entity formed, HIPAA program initiated.',
        'DAYS 8-20: Establish data infrastructure: HIPAA-compliant cloud (AWS/Azure Healthcare), de-identification pipeline, secure data lake, analytics environment. Implement access controls, audit logging, and encryption. OUTPUT: Data infrastructure operational.',
        'DAYS 21-35: Define core analytics products: population health dashboards, risk stratification models, clinical quality measures (HEDIS/Stars), predictive readmission models, cost-of-care analytics. Write product specifications. OUTPUT: Product portfolio defined.',
        'DAYS 36-50: Build MVP analytics platform. Source data: CMS public use files (free), synthetic data (Synthea), or partner health system data under BAA. Train initial ML models. Validate against known benchmarks. OUTPUT: MVP analytics platform built.',
        'DAYS 51-65: Beta launch with 2-3 health system partners. Provide population health insights, quality measure reporting, and predictive risk scores. Collect feedback on clinical utility and workflow integration. OUTPUT: Beta feedback collected.',
        'DAYS 66-75: Develop pharma-facing product: real-world evidence analytics, treatment pattern analysis, health economics and outcomes research (HEOR). Target pharmaceutical medical affairs and market access teams. OUTPUT: Pharma product module built.',
        'DAYS 76-85: Apply for AHRQ or PCORI grant for health services research using your platform. Prepare investor deck if pursuing VC. Submit abstract to AMIA or AcademyHealth conference. OUTPUT: Funding application submitted.',
        'DAYS 81-90: Public launch. Target: 5 paying customers (mix of health systems and payers). Track: MRR, model accuracy, user engagement, clinical impact metrics. OUTPUT: Public launch, initial revenue.'
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STAGE DEFINITIONS — 7 stages, 24 subsections
  // ══════════════════════════════════════════════════════════════════════

  var STAGES = [
    { id: 'stage1', title: 'STAGE 1 \u2014 BUSINESS DEFINITION', sections: [
      { id: 'concept', title: 'Business Concept', type: 'fields',
        guidance: 'Define the medicine business in language anyone can understand. If you cannot explain it in two sentences, you do not understand it well enough. The reviewer will reject vague descriptions.',
        fields: [
          { id: 'name', label: 'Business name (draft)', type: 'text', placeholder: 'e.g., Meridian Clinical Analytics LLC' },
          { id: 'one_liner', label: 'One-sentence description', type: 'text', placeholder: 'We provide [medical service/product] to [customer] in [market]' },
          { id: 'full_desc', label: 'Full business description (3-5 sentences)', type: 'textarea', placeholder: 'What does the business do? Who are the clients/patients? How does it make money? What medical domain does it serve?' },
          { id: 'node_source', label: 'Node source (from LIMEN mapping)', type: 'text', prefill: 'nodeLabel' },
          { id: 'mapping_title', label: 'Business mapping title', type: 'text', prefill: 'businessType' }
        ] },
      { id: 'market', title: 'Client & Market', type: 'fields',
        guidance: 'Who pays you? Be specific. "Hospitals" is too vague. "Community hospitals with 100-300 beds that need sepsis early warning systems and have Epic or Cerner EHR" is specific.',
        fields: [
          { id: 'target_customer', label: 'Primary target client', type: 'textarea', placeholder: 'Describe your ideal client in detail. Size, type, clinical focus, pain point.' },
          { id: 'market_size', label: 'Estimated addressable market', type: 'text', placeholder: 'How many potential clients exist? What do they currently spend?' },
          { id: 'geography', label: 'Service geography', type: 'text', placeholder: 'Local, regional, national, or international' },
          { id: 'competition', label: 'Main competitors or alternatives', type: 'textarea', placeholder: 'Who else serves this client? What do they charge? Why would clients switch?' },
          { id: 'differentiation', label: 'Why you win', type: 'textarea', placeholder: 'Clinical evidence, regulatory clearance, EHR integration, pricing, outcomes data?' }
        ] },
      { id: 'revenue', title: 'Revenue Model', type: 'fields',
        guidance: 'How does money come in? In healthcare, common models include: SaaS subscriptions, per-patient-per-month (PPPM), fee-for-service, value-based contracts, device sales, and consulting fees.',
        fields: [
          { id: 'model_type', label: 'Revenue model', type: 'select', options: ['SaaS subscription', 'Per-patient-per-month (PPPM)', 'Fee-for-service', 'Value-based contract', 'Device sales + service', 'Project / consulting fees', 'Prescription dispensing', 'Data licensing', 'Mixed', 'Other'] },
          { id: 'pricing', label: 'Pricing structure', type: 'textarea', placeholder: 'What do you charge? Fee schedule, rate card, or subscription tiers.' },
          { id: 'payment_terms', label: 'Payment terms', type: 'text', placeholder: 'Monthly subscription, milestone-based, net 30/60/90?' },
          { id: 'recurring', label: 'Recurring vs one-time revenue', type: 'select', options: ['Mostly recurring (subscription, PPPM)', 'Mostly one-time (device sale, project)', 'Mixed', 'Undecided'] }
        ] },
      { id: 'biz_type', title: 'Business Type & Mode', type: 'fields',
        guidance: 'Choose the template that best matches your medicine business. This determines which operational and compliance sections appear below.',
        fields: [
          { id: 'template', label: 'Business type template', type: 'select', options: ['digital_health_platform', 'clinical_research_org', 'specialty_pharmacy', 'medical_device_startup', 'health_analytics'] },
          { id: 'build_mode', label: 'Build mode', type: 'select', options: ['Basic Build', 'Franchise-Ready Build'] },
          { id: 'capital_intensity', label: 'Capital intensity', type: 'select', options: ['Low ($25K-$150K)', 'Medium ($150K-$500K)', 'High ($500K+)'] },
          { id: 'regulated', label: 'Regulatory intensity?', type: 'select', options: ['Light (HIPAA only)', 'Moderate (HIPAA + state licensure)', 'Heavy (FDA + HIPAA + DEA + state licensure)'] }
        ] }
    ]},

    { id: 'stage2', title: 'STAGE 2 \u2014 LEGAL FORMATION & REGISTRATION', sections: [
      { id: 'entity', title: 'Entity Choice', type: 'fields',
        guidance: 'Healthcare companies have specific entity considerations. Physician-owned practices may need PC/PLLC. Device companies seeking VC should be C-Corps. HIPAA covered entities have additional compliance requirements.',
        fields: [
          { id: 'entity_type', label: 'Entity type', type: 'select', options: ['LLC (most common for services)', 'S-Corp (tax optimization for established firms)', 'C-Corp (VC-backed devices/platforms)', 'PC/PLLC (physician-owned)', 'Non-profit (research institute)', 'Undecided \u2014 need advice'] },
          { id: 'state', label: 'State of formation', type: 'text', placeholder: 'Delaware for C-Corp. Home state for LLC/PC.' },
          { id: 'name_check', label: 'Name availability checked?', type: 'select', options: ['Not yet', 'Available \u2014 confirmed with Secretary of State', 'Taken \u2014 need alternative', 'Reserved'] },
          { id: 'formation_cost', label: 'Estimated formation cost', type: 'text', placeholder: 'Filing fees + legal + registrations' }
        ] },
      { id: 'tax_id', title: 'Tax ID & Registration', type: 'mixed',
        guidance: 'Healthcare businesses need EIN plus potentially: NPI (National Provider Identifier), state pharmacy/medical licenses, DEA registration, CLIA certification (labs), and Medicare/Medicaid enrollment.',
        fields: [
          { id: 'ein', label: 'EIN', type: 'text', placeholder: 'Apply free at irs.gov/ein' },
          { id: 'npi', label: 'NPI number', type: 'text', placeholder: 'National Provider Identifier (if applicable)' },
          { id: 'state_license', label: 'State medical/pharmacy license', type: 'text', placeholder: 'State Board of Medicine/Pharmacy license number' },
          { id: 'dea', label: 'DEA registration', type: 'text', placeholder: 'If handling controlled substances' },
          { id: 'cms_enrollment', label: 'CMS provider enrollment', type: 'text', placeholder: 'Medicare/Medicaid enrollment status' }
        ],
        checklist: ['EIN obtained from IRS', 'State entity registration complete', 'NPI obtained (if applicable)', 'State medical/pharmacy license obtained', 'DEA registration (if applicable)', 'CLIA certification (if lab)', 'CMS provider enrollment (if applicable)', 'SAM.gov registration complete'] },
      { id: 'governance', title: 'Governance & Agreements', type: 'checklist',
        guidance: 'Healthcare businesses require clear governance, particularly around clinical decision-making, data handling, and patient safety.',
        items: ['Operating agreement / bylaws adopted', 'Ownership percentages documented', 'Clinical governance policy', 'HIPAA Privacy Officer designated', 'HIPAA Security Officer designated', 'Compliance Officer designated', 'IP assignment agreement', 'Non-compete / non-solicitation agreements', 'Employee handbook with HIPAA sections'] },
      { id: 'compliance', title: 'Insurance & Regulatory Compliance', type: 'mixed',
        guidance: 'Healthcare businesses need professional liability, cyber liability (HIPAA), and potentially product liability insurance. Regulatory compliance costs are significant.',
        fields: [
          { id: 'malpractice', label: 'Professional liability / malpractice', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'cyber_insurance', label: 'Cyber liability insurance (HIPAA)', type: 'select', options: ['Not yet', 'Quoted', 'Purchased'] },
          { id: 'product_liability', label: 'Product liability (devices/drugs)', type: 'select', options: ['Not applicable', 'Not yet', 'Quoted', 'Purchased'] },
          { id: 'hipaa_status', label: 'HIPAA compliance program', type: 'select', options: ['Not started', 'In progress', 'Complete'] }
        ],
        checklist: ['Professional liability insurance active', 'Cyber liability insurance active', 'HIPAA compliance program implemented', 'BAA agreements with all vendors', 'Incident response plan documented', 'Privacy policy published', 'HIPAA training completed for all staff', 'Business continuity plan'] },
      { id: 'banking', title: 'Banking & Bookkeeping', type: 'checklist',
        guidance: 'Healthcare businesses must maintain clean, auditable books. Medicare/Medicaid billing requires specific financial documentation and compliance.',
        items: ['Business operating account opened', 'Business credit card obtained', 'Accounting software set up (QuickBooks, Xero)', 'Chart of accounts configured', 'Revenue recognition policy documented', 'Healthcare billing system set up (if applicable)', 'Accountant or bookkeeper identified', 'Invoicing system established'] }
    ]},

    { id: 'stage3', title: 'STAGE 3 \u2014 FUNDING PREPARATION', sections: [
      { id: 'startup_costs', title: 'Startup Cost Estimate', type: 'fields',
        guidance: 'Healthcare businesses have unique cost categories: regulatory compliance, clinical validation, HIPAA infrastructure, licensing fees, and accreditation costs.',
        fields: [
          { id: 'cost_regulatory', label: 'Regulatory / compliance ($)', type: 'text' },
          { id: 'cost_technology', label: 'Technology / platforms ($)', type: 'text' },
          { id: 'cost_legal', label: 'Legal / licensing ($)', type: 'text' },
          { id: 'cost_insurance', label: 'Insurance premiums ($)', type: 'text' },
          { id: 'cost_clinical', label: 'Clinical validation / trials ($)', type: 'text' },
          { id: 'cost_marketing', label: 'Marketing / conferences ($)', type: 'text' },
          { id: 'cost_working_cap', label: 'Working capital (3-6 months) ($)', type: 'text' },
          { id: 'cost_buffer', label: 'Contingency buffer (15-20%) ($)', type: 'text' },
          { id: 'cost_total', label: 'TOTAL STARTUP COST ($)', type: 'text', placeholder: 'Sum of all above' }
        ] },
      { id: 'sources', title: 'Sources of Funds', type: 'fields',
        guidance: 'Healthcare businesses can leverage NIH SBIR/STTR grants, BARDA contracts, and healthcare-specific VC in addition to traditional funding sources.',
        fields: [
          { id: 'src_owner', label: 'Owner equity / cash injection ($)', type: 'text' },
          { id: 'src_loan', label: 'SBA or term loan ($)', type: 'text' },
          { id: 'src_investor', label: 'Outside investment / VC ($)', type: 'text' },
          { id: 'src_grant', label: 'NIH SBIR/STTR or other grant ($)', type: 'text' },
          { id: 'src_contract', label: 'Advance from first contract ($)', type: 'text' },
          { id: 'src_other', label: 'Other sources ($)', type: 'text' },
          { id: 'src_total', label: 'TOTAL SOURCES ($)', type: 'text', placeholder: 'Must equal total startup cost' }
        ] },
      { id: 'loan_prep', title: 'Financing Readiness', type: 'checklist',
        guidance: 'If seeking financing, healthcare businesses should emphasize: clinical validation data, regulatory clearance status, reimbursement pathway, and IP portfolio.',
        items: ['Business plan with market analysis', 'Financial projections (12-month)', 'Personal financial statement', 'Tax returns (2+ years)', 'Clinical validation data / pilot results', 'Regulatory clearance status / timeline', 'IP portfolio documentation', 'Professional credentials and CVs'] }
    ]},

    { id: 'stage4', title: 'STAGE 4 \u2014 FINANCIAL READINESS', sections: [
      { id: 'proforma', title: '12-Month Pro Forma', type: 'fields',
        guidance: 'Healthcare business pro formas must account for: regulatory timeline delays, clinical validation costs, long sales cycles (6-18 months for health systems), and reimbursement lag.',
        fields: [
          { id: 'monthly_revenue', label: 'Projected monthly revenue ($)', type: 'text', placeholder: 'Conservative \u2014 account for long sales cycles' },
          { id: 'revenue_basis', label: 'Revenue assumptions', type: 'textarea', placeholder: 'X clients at $Y average contract = $Z/month. When do clients sign?' },
          { id: 'monthly_clinical', label: 'Monthly clinical / regulatory ($)', type: 'text', placeholder: 'Clinical staff, regulatory compliance, quality systems' },
          { id: 'monthly_technology', label: 'Monthly technology ($)', type: 'text', placeholder: 'Cloud (HIPAA-compliant), software, EHR integrations' },
          { id: 'monthly_personnel', label: 'Monthly personnel ($)', type: 'text', placeholder: 'Salaries, benefits, contractors' },
          { id: 'monthly_insurance', label: 'Monthly insurance ($)', type: 'text' },
          { id: 'monthly_other', label: 'Monthly other overhead ($)', type: 'text' },
          { id: 'monthly_total_exp', label: 'TOTAL monthly expenses ($)', type: 'text' },
          { id: 'breakeven', label: 'Break-even month', type: 'text', placeholder: 'When cumulative revenue exceeds cumulative costs' }
        ] }
    ]},

    { id: 'stage5', title: 'STAGE 5 \u2014 OPERATING MODEL', sections: [
      { id: 'delivery', title: 'Service / Product Delivery', type: 'fields',
        guidance: 'How do you deliver the medical service or product? Walk through the clinical workflow from referral/order to outcome measurement.',
        fields: [
          { id: 'offer', label: 'Core service/product offering', type: 'textarea', placeholder: 'What specific medical service or product do you deliver?' },
          { id: 'process', label: 'Clinical workflow (step by step)', type: 'textarea', placeholder: '1. Referral/Order \u2192 2. Assessment \u2192 3. Treatment/Implementation \u2192 4. Monitoring \u2192 5. Outcome measurement \u2192 6. Reporting' },
          { id: 'quality', label: 'Quality standards', type: 'textarea', placeholder: 'Clinical outcome targets, quality measures, accreditation standards' },
          { id: 'capacity', label: 'Maximum capacity', type: 'text', placeholder: 'How many patients/clients can you handle simultaneously?' }
        ] },
      { id: 'team', title: 'Team & Staffing', type: 'fields',
        guidance: 'Healthcare businesses require credentialed professionals. Document licenses, certifications, board certifications, and clinical specializations.',
        fields: [
          { id: 'founder_role', label: 'Founder role and credentials', type: 'textarea', placeholder: 'Your role + degrees, licenses, board certifications' },
          { id: 'first_hire', label: 'First hire (role + timing)', type: 'text', placeholder: 'e.g., Clinical research coordinator at month 3' },
          { id: 'staff_plan', label: 'Year 1 staffing plan', type: 'textarea', placeholder: 'Include credential requirements per role' },
          { id: 'compensation', label: 'Compensation approach', type: 'textarea', placeholder: 'Base + bonus, profit sharing, equity?' }
        ] },
      { id: 'infrastructure', title: 'Technology & Clinical Infrastructure', type: 'fields',
        guidance: 'Healthcare businesses depend on HIPAA-compliant infrastructure, EHR integration, and clinical data management.',
        fields: [
          { id: 'core_system', label: 'Core platform / system', type: 'text', placeholder: 'EHR, CTMS, pharmacy system, or custom platform' },
          { id: 'data_stack', label: 'Data infrastructure', type: 'textarea', placeholder: 'HIPAA-compliant cloud, data pipeline, analytics, FHIR/HL7 integration' },
          { id: 'security', label: 'Security infrastructure', type: 'textarea', placeholder: 'Encryption, access controls, audit logging, HIPAA safeguards' },
          { id: 'vendors', label: 'Key vendors', type: 'textarea', placeholder: 'Cloud providers, EHR vendors, data sources, lab partners' }
        ] },
      { id: 'customers', title: 'Client Acquisition', type: 'fields',
        guidance: 'In healthcare, clinical evidence and peer referrals drive adoption. KOL endorsement, conference presentations, and peer-reviewed publications are primary channels.',
        fields: [
          { id: 'first_10', label: 'How will you get your first 10 clients?', type: 'textarea', placeholder: 'Physician network, conference presentations, publications, health system partnerships?' },
          { id: 'ongoing', label: 'Ongoing acquisition strategy', type: 'textarea', placeholder: 'Clinical evidence, KOL advisory board, GPO contracts, payer partnerships?' },
          { id: 'cac', label: 'Estimated client acquisition cost', type: 'text' },
          { id: 'ltv', label: 'Estimated client lifetime value', type: 'text' }
        ] },
      { id: 'first90', title: 'First 90 Days Execution Plan', type: 'fields',
        guidance: 'Healthcare businesses often have long regulatory and validation timelines. FDA clearance can take 6-18 months. Health system sales cycles are 6-12 months.',
        fields: [
          { id: 'days_1_30', label: 'Days 1-30: Foundation', type: 'textarea', placeholder: 'Entity, licenses, HIPAA compliance, regulatory pathway' },
          { id: 'days_31_60', label: 'Days 31-60: Build', type: 'textarea', placeholder: 'Product development, clinical validation, pilot partnerships' },
          { id: 'days_61_90', label: 'Days 61-90: Launch', type: 'textarea', placeholder: 'Beta launch, first clients, revenue generation' }
        ] }
    ]},

    { id: 'stage6', title: 'STAGE 6 \u2014 DOCUMENT PACKET', sections: [
      { id: 'legal_docs', title: 'Legal & Registration Documents', type: 'checklist',
        guidance: 'Healthcare businesses require extensive documentation for licensing, accreditation, and regulatory compliance.',
        items: ['Articles of organization / incorporation', 'Operating agreement / bylaws', 'EIN confirmation letter', 'State medical/pharmacy license(s)', 'NPI confirmation', 'DEA registration (if applicable)', 'CLIA certificate (if applicable)', 'Client/patient agreement templates'] },
      { id: 'financial_docs', title: 'Financial Documents', type: 'checklist',
        guidance: 'Healthcare investors and lenders expect financial documentation demonstrating clinical and operational viability.',
        items: ['Business plan with clinical validation data', '12-month financial projections', 'Startup cost and funding analysis', 'Personal financial statements (all principals)', 'Tax returns (2-3 years)', 'Proof of insurance (professional liability, cyber, GL)', 'Banking references', 'Reimbursement/coding analysis (if applicable)'] },
      { id: 'operating_docs', title: 'Operating Documents', type: 'checklist',
        guidance: 'Operational documentation demonstrates clinical rigor, patient safety, and regulatory compliance.',
        items: ['HIPAA policies and procedures', 'Clinical protocols / standard operating procedures', 'Quality management system documentation', 'Incident response / breach notification plan', 'Patient consent forms', 'Business continuity plan', 'Staff credentialing files', 'Compliance training records'] }
    ]},

    { id: 'stage7', title: 'STAGE 7 \u2014 REVIEW & APPROVAL', sections: [
      { id: 'readiness', title: 'Launch Readiness Review', type: 'review',
        guidance: 'Medicine business launch readiness requires: legal formation complete, licenses obtained, HIPAA compliance verified, clinical infrastructure operational, and regulatory pathway established.' },
      { id: 'auditor', title: 'Reviewer Decision', type: 'auditor',
        guidance: 'The reviewer evaluates: clinical safety, regulatory compliance, HIPAA readiness, professional credentials, market positioning, financial viability, and overall launch readiness.' }
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
      if (!hasContent) h += '<div style="color:#706860">No information yet \u2014 click Edit to add details</div>';
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
    if (sec.type === 'auditor') { var aud = ws.auditor || {}; var sl = aud.status || 'DRAFT'; h += '<div class="eep-auditor"><div class="eep-auditor-title">REVIEWER DECISION</div>'; h += '<div style="margin-bottom:6px"><span class="eep-status eep-status-' + sl.toLowerCase() + '">' + sl + '</span></div>'; h += '<div class="eep-field"><label class="eep-field-label">Clinical safety readiness</label><select class="eep-select" data-auditor="clinical_ready"><option' + (aud.clinical_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.clinical_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.clinical_ready || aud.clinical_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Regulatory compliance readiness</label><select class="eep-select" data-auditor="regulatory_ready"><option' + (aud.regulatory_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.regulatory_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.regulatory_ready || aud.regulatory_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Financial viability</label><select class="eep-select" data-auditor="financial_ready"><option' + (aud.financial_ready === 'Ready' ? ' selected' : '') + '>Ready</option><option' + (aud.financial_ready === 'Not ready' ? ' selected' : '') + '>Not ready</option><option' + ((!aud.financial_ready || aud.financial_ready === 'Not assessed') ? ' selected' : '') + '>Not assessed</option></select></div>'; h += '<div class="eep-field"><label class="eep-field-label">Reviewer comments</label><textarea class="eep-textarea" data-auditor="comments" style="min-height:60px">' + esc(aud.comments || '') + '</textarea></div>'; h += '<div class="eep-auditor-btns"><button class="eep-btn eep-btn-approve" data-action="approve">APPROVE</button><button class="eep-btn eep-btn-deny" data-action="deny">DENY</button><button class="eep-btn eep-btn-revise" data-action="revise">NEEDS REVISION</button></div>'; if (aud.timestamp) h += '<div style="font-size:0.24rem;color:#706860;margin-top:4px">Last reviewed: ' + new Date(aud.timestamp).toLocaleString() + '</div>'; h += '</div>'; }
    h += '</div>';
    return h;
  }

  function autoGenerate(ws, prefill, tmpl) {
    if (ws._autoGenerated) return;
    ws._autoGenerated = true;
    var bizName = (prefill && prefill.businessType) ? prefill.businessType : 'New Medicine Business';
    var nodeLabel = (prefill && prefill.nodeLabel) || '';
    var reason = (prefill && prefill.reason) || '';
    if (!ws.fields['concept']) ws.fields['concept'] = {};
    ws.fields['concept']['name'] = ws.fields['concept']['name'] || bizName + ' LLC';
    ws.fields['concept']['node_source'] = ws.fields['concept']['node_source'] || nodeLabel;
    ws.fields['concept']['mapping_title'] = ws.fields['concept']['mapping_title'] || bizName;
    ws.fields['concept']['one_liner'] = ws.fields['concept']['one_liner'] || 'We provide ' + bizName.toLowerCase() + ' services to the healthcare sector.';
    ws.fields['concept']['full_desc'] = ws.fields['concept']['full_desc'] || reason || (tmpl ? tmpl.description : '');
    if (!ws.fields['market']) ws.fields['market'] = {};
    ws.fields['market']['geography'] = ws.fields['market']['geography'] || 'Regional \u2014 United States';
    if (!ws.fields['entity']) ws.fields['entity'] = {};
    ws.fields['entity']['entity_type'] = ws.fields['entity']['entity_type'] || (tmpl ? (tmpl.capitalIntensity === 'high' ? 'C-Corp (VC-backed devices/platforms)' : 'LLC (most common for services)') : 'LLC (most common for services)');
    if (!ws.fields['startup_costs']) ws.fields['startup_costs'] = {};
    if (tmpl) {
      var costMap = { low: { reg: '5000', tech: '3000', legal: '3000', ins: '4000', clin: '2000', mkt: '3000', wc: '15000', buf: '5000', total: '40000' }, medium: { reg: '25000', tech: '15000', legal: '8000', ins: '6000', clin: '20000', mkt: '10000', wc: '40000', buf: '18000', total: '142000' }, high: { reg: '100000', tech: '50000', legal: '20000', ins: '10000', clin: '200000', mkt: '25000', wc: '100000', buf: '75000', total: '580000' } };
      var costs = costMap[tmpl.capitalIntensity] || costMap['medium'];
      ws.fields['startup_costs']['cost_regulatory'] = ws.fields['startup_costs']['cost_regulatory'] || costs.reg;
      ws.fields['startup_costs']['cost_technology'] = ws.fields['startup_costs']['cost_technology'] || costs.tech;
      ws.fields['startup_costs']['cost_legal'] = ws.fields['startup_costs']['cost_legal'] || costs.legal;
      ws.fields['startup_costs']['cost_insurance'] = ws.fields['startup_costs']['cost_insurance'] || costs.ins;
      ws.fields['startup_costs']['cost_clinical'] = ws.fields['startup_costs']['cost_clinical'] || costs.clin;
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
      if (bt.indexOf('digital') !== -1 || bt.indexOf('telehealth') !== -1 || bt.indexOf('telemedicine') !== -1 || bt.indexOf('health it') !== -1) tmplKey = 'digital_health_platform';
      else if (bt.indexOf('clinical research') !== -1 || bt.indexOf('cro') !== -1 || bt.indexOf('trial') !== -1) tmplKey = 'clinical_research_org';
      else if (bt.indexOf('pharmacy') !== -1 || bt.indexOf('dispensing') !== -1 || bt.indexOf('drug') !== -1) tmplKey = 'specialty_pharmacy';
      else if (bt.indexOf('device') !== -1 || bt.indexOf('diagnostic') !== -1 || bt.indexOf('instrument') !== -1 || bt.indexOf('surgical') !== -1) tmplKey = 'medical_device_startup';
      else if (bt.indexOf('analytics') !== -1 || bt.indexOf('data') !== -1 || bt.indexOf('ai') !== -1 || bt.indexOf('population') !== -1) tmplKey = 'health_analytics';
      else tmplKey = 'digital_health_platform';
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
    h += '<span style="flex:1"></span><span style="font-size:0.26rem;color:#706860">' + (mode === 'operator' ? 'Simplified guided flow' : 'Full access \u2014 all sections') + '</span></div>';

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

  window.LIMENMedicineBusinessBuild = { renderPanel: renderPanel, wirePanel: wirePanel, STAGES: STAGES, TEMPLATES: TEMPLATES };
  console.log('[MedicineBusinessBuild] v2 loaded \u2014 7 stages, 5 medicine templates, 24+ subsections');
})();
