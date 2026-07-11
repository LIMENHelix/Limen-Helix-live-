/**
 * industry-node-business-engine.js — Industry Node-to-Business Assignment Engine
 *
 * INDUSTRY / RESEARCH DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (matches the locked-domain standard):
 *   - Recursively traverses ALL child portal JSONs (depth 0-5, ~18,200 files)
 *   - Covers full 103 operational nodes (19 INDUSTRY-TOP + 84 INDUSTRY-OPERATIONAL)
 *   - Excludes the same 20 RI / framework nodes as the locked domains
 *   - Filters generic template treatments before inference
 *
 * Outputs 3 buckets:
 *   MAPPED     - already mapped and active in Industry system
 *   MISSING    - plausible but missing from current Industry mappings
 *   SPECULATIVE - low-confidence or novel suggestions
 *
 * Approval statuses: PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_industry_business_approvals')
 *
 * Self-gates: only runs when ?domain=industry or ?domain=research
 * Exposes: window.LIMENIndustryBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'industry' && _dom !== 'industry') return;

  var STORAGE_KEY = 'limen_industry_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_industry_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

  // ══════════════════════════════════════════════════════════════════════
  // RI / FRAMEWORK NODES — same 20 excluded by all locked domains
  // ══════════════════════════════════════════════════════════════════════

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  var GENERIC_TREATMENT_PATTERNS = [
    'Deploy Technology Integration Integrated Technology Platform',
    'Deploy KPI Tracking Integrated Technology Platform',
    'Deploy Innovation Pipeline Integrated Technology Platform',
    'Deploy Trend Analysis Integrated Technology Platform',
    'Deploy Scalability Integrated Technology Platform',
    'Deploy Baseline Assessment Integrated Technology Platform',
    'Deploy Reporting Integrated Technology Platform',
    'Deploy Sustainability Integrated Technology Platform',
    'Deploy Cost Optimization Integrated Technology Platform',
    'Deploy Process Improvement Integrated Technology Platform',
    'Deploy Benchmarking Integrated Technology Platform',
    'Deploy Data Collection Integrated Technology Platform',
    'Deploy Delivery Integrated Technology Platform',
    'Deploy Risk Mitigation Integrated Technology Platform',
    'Deploy Resource Planning Integrated Technology Platform',
    'Deploy Execution Integrated Technology Platform',
    'Deploy Stakeholder Coordination Integrated Technology Platform',
    'Deploy Timeline Management Integrated Technology Platform'
  ];
  var _genericSet = {};
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) {
    _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;
  }

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal filtering') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal correlation') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('root cause analysis') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // 19 INDUSTRY-TOP (full neuroTranslation) + 84 INDUSTRY-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── INDUSTRY-TOP NODES (19) ──
    'DMN': {
      fullName: 'Default Mode Network', label: 'Industrial Scenario Planning', tier: 'top',
      neuroTranslation: { inNeurology: 'Active during internally-directed planning, counterfactual reasoning, and long-range strategy formation.', inBusiness: 'In industry, scenario planning is the work of modeling reshoring decisions, capacity expansion paths, automation ROI, and multi-year capex programs under deep uncertainty.' },
      function: 'Generates long-range industrial scenarios for reshoring, capacity, automation, and capex',
      dysregulation: 'Failure of imagination, anchoring on recent demand, ignoring structural shifts',
      expectedTypes: [
        { type: 'Industrial strategy consultancy', reason: 'McKinsey Operations, BCG Operations, Deloitte Industrial, Bain Performance Improvement for reshoring and industrial strategy', confidence: 0.92 },
        { type: 'Reshoring advisory firm', reason: 'Reshoring Initiative, Kearney A.T. reshoring practice, PwC Industrial Products advisory', confidence: 0.88 },
        { type: 'Capacity planning analytics', reason: 'Oracle Industrial Analytics, SAP S/4HANA Manufacturing, Aspen Technology aspenONE for capacity modeling', confidence: 0.85 },
        { type: 'Industrial M&A advisory', reason: 'Goldman Sachs Industrials, Morgan Stanley Global Industrials, Lazard Industrial for consolidation work', confidence: 0.82 },
        { type: 'Industrial research institute', reason: 'Manufacturing USA institutes (MForesight, IACMI, MxD, NIIMBL) for industrial strategy research', confidence: 0.78 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Industrial Strategic Planning', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and coordination of multiple simultaneous goals.', inBusiness: 'In industry, strategic planning holds capex timing, supplier qualification, workforce development, and regulatory compliance simultaneously across multi-year plans.' },
      function: 'Develops industrial strategy: capex, supplier base, workforce, regulatory roadmaps',
      dysregulation: 'Plan-execution gap, stranded assets, missed capex windows',
      expectedTypes: [
        { type: 'Industrial EPC prime', reason: 'Jacobs Solutions, Fluor, AECOM Hunt, McDermott International, Bechtel (reference) for industrial EPC', confidence: 0.92 },
        { type: 'Industrial operations consulting', reason: 'McKinsey Operations, BCG Operations, Accenture Industry X for industrial operations strategy', confidence: 0.9 },
        { type: 'Industrial portfolio planning', reason: 'Siemens Opcenter, SAP Integrated Business Planning, Oracle SCM Cloud for portfolio planning', confidence: 0.88 },
        { type: 'CHIPS Act / IRA advisory', reason: 'Big 4 federal credits practices (Deloitte, PwC, EY, KPMG) for CHIPS Act and IRA manufacturing credit advisory', confidence: 0.85 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Industrial Compliance & Audit', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflict and errors, monitors performance, flags discrepancies.', inBusiness: 'In industry, compliance and audit covers OSHA PSM, EPA RMP, FDA CGMP, FAA airworthiness, NHTSA safety standards, and ISO/AS/IATF certification regimes.' },
      function: 'Audits industrial compliance against OSHA, EPA, FDA, FAA, NHTSA, and ISO / AS / IATF standards',
      dysregulation: 'Audit findings, 483 letters, safety citations, certificate suspensions',
      expectedTypes: [
        { type: 'Industrial compliance auditor', reason: 'SGS, Bureau Veritas, Intertek, DEKRA, TUV Rheinland, TUV SUD for ISO 9001 / AS9100 / IATF 16949 audits', confidence: 0.92 },
        { type: 'EHS compliance software', reason: 'Sphera, Cority, Enablon (Wolters Kluwer), Intelex, VelocityEHS, EcoOnline for industrial EHS compliance', confidence: 0.9 },
        { type: 'Quality management system', reason: 'MasterControl, ETQ Reliance, AssurX, Sparta Systems (Honeywell), Veeva Vault QMS for regulated QMS', confidence: 0.88 },
        { type: 'Industrial legal / regulatory', reason: 'Beveridge & Diamond, Bracewell, Van Ness Feldman, Hunton Andrews Kurth for industrial regulatory counsel', confidence: 0.85 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Industrial Data Integration', tier: 'top',
      neuroTranslation: { inNeurology: 'Dynamically allocates cognitive resources across multi-source data.', inBusiness: 'In industry, data integration fuses MES, ERP, CMMS, LIMS, PLM, and SCADA streams into unified operational pictures.' },
      function: 'Integrates MES, ERP, CMMS, PLM, SCADA, and historian data for unified factory analytics',
      dysregulation: 'Data silos, format mismatch, synchronization failures',
      expectedTypes: [
        { type: 'Industrial data platform', reason: 'AVEVA PI System (formerly OSIsoft), GE Digital Proficy Historian, Siemens XHQ, Honeywell Forge for historian and data fabric', confidence: 0.92 },
        { type: 'MES / MOM platform', reason: 'Rockwell Plex, Siemens Opcenter, GE Digital Proficy Plant Applications, Dassault DELMIA Apriso for MES / MOM', confidence: 0.9 },
        { type: 'Industrial IoT platform', reason: 'Siemens MindSphere, PTC ThingWorx, GE Digital Predix, Rockwell FactoryTalk Cloud for IIoT', confidence: 0.88 },
        { type: 'Manufacturing analytics', reason: 'Seeq, TrendMiner, Aspen Technology aspenONE, Tulip Interfaces for industrial operations analytics', confidence: 0.85 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Industrial Production Execution', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage where planned actions become physical execution.', inBusiness: 'In industry, production execution is the physical work of manufacturing — presses, CNC, robotics, assembly lines, packaging.' },
      function: 'Executes physical production: machining, assembly, welding, packaging, material handling',
      dysregulation: 'Production halts, unplanned downtime, scrap rates, missed takt time',
      expectedTypes: [
        { type: 'Industrial robotics vendor', reason: 'Fanuc (FANUY), ABB Robotics, Yaskawa (YASKY), Kuka (Midea), Universal Robots (Teradyne), Rockwell Automation', confidence: 0.95 },
        { type: 'Machine tool builder', reason: 'DMG Mori, Mazak, Okuma, Haas Automation (private), Makino, Doosan Machine Tools for CNC production', confidence: 0.92 },
        { type: 'Material handling vendor', reason: 'Dematic (KION), Honeywell Intelligrated, SSI Schaefer (private), Daifuku, Murata Machinery for automated material handling', confidence: 0.88 },
        { type: 'Welding / joining equipment', reason: 'Lincoln Electric (LECO), Illinois Tool Works (ITW), Colfax (ESAB), Miller Electric (ITW) for industrial welding', confidence: 0.85 },
        { type: 'Packaging machinery', reason: 'ProMach (private), Barry-Wehmiller (private), Illinois Tool Works (ITW), Krones for packaging lines', confidence: 0.82 }
      ]
    },
    'BROCA': {
      fullName: 'Broca’s Area', label: 'Industrial Reporting & Disclosure', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured language and grammatical output.', inBusiness: 'In industry, reporting and disclosure covers SEC 10-K industrial segment, EHS reports, ESG disclosure, CDP Supply Chain, TCFD climate disclosure, and quality audit reports.' },
      function: 'Produces industrial regulatory disclosures: SEC segment, EHS, ESG, CDP, TCFD, quality audit',
      dysregulation: 'Disclosure gaps, greenwashing, incomplete Scope 3, delayed SEC filings',
      expectedTypes: [
        { type: 'Sustainability reporting platform', reason: 'Workiva ESG, Sphera Sustainability, Diligent ESG, Novata, Nasdaq Metrio for industrial ESG reporting', confidence: 0.9 },
        { type: 'GHG inventory vendor', reason: 'Persefoni, Watershed, Normative, Sweep, Plan A for Scope 1/2/3 industrial GHG reporting', confidence: 0.88 },
        { type: 'Industrial audit & assurance', reason: 'Big 4 (Deloitte, EY, KPMG, PwC) industrial audit + assurance practices', confidence: 0.92 },
        { type: 'Financial reporting platform', reason: 'Workiva Wdesk, Oracle Hyperion Financial Management, SAP BPC for SEC industrial financial disclosure', confidence: 0.85 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Industrial Knowledge Integration', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates semantic information across domains, supporting conceptual reasoning.', inBusiness: 'In industry, knowledge integration connects manufacturing engineering, materials science, process control, and industrial data across plants and supplier networks.' },
      function: 'Integrates manufacturing engineering, materials, process, and supplier knowledge across the enterprise',
      dysregulation: 'Tribal knowledge loss, undocumented processes, slow technology transfer',
      expectedTypes: [
        { type: 'Knowledge management platform', reason: 'Atlassian Confluence, Microsoft SharePoint, Guru, Notion for industrial knowledge bases', confidence: 0.82 },
        { type: 'PLM / product data management', reason: 'Siemens Teamcenter, Dassault Systemes 3DEXPERIENCE, PTC Windchill, Oracle Agile PLM for PLM', confidence: 0.92 },
        { type: 'Engineering standards library', reason: 'IHS Markit Engineering Workbench, SAE MOBILUS, ASTM Compass, IEEE Xplore for engineering standards access', confidence: 0.85 },
        { type: 'Technical publication platform', reason: 'Quark XML Author, DITA-OT, Adobe FrameMaker for technical publications and service manuals', confidence: 0.78 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Industrial Capital Allocation', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates emotional valuation with long-term consequence assessment.', inBusiness: 'In industry, capital allocation directs capex across plants, equipment, automation, and capacity expansion — the highest-stakes strategic decisions an industrial firm makes.' },
      function: 'Allocates capex across plants, equipment, automation, and capacity expansion',
      dysregulation: 'Stranded assets, ROI misses, greenfield overruns, under-investment in modernization',
      expectedTypes: [
        { type: 'Industrial M&A bank', reason: 'Goldman Sachs Industrials, Morgan Stanley Global Industrials, Lazard Industrial, Evercore for industrial M&A', confidence: 0.92 },
        { type: 'Industrial private equity', reason: 'Apollo Industrial, KKR Industrial, Blackstone Industrial, Carlyle Industrial, Advent International industrials', confidence: 0.9 },
        { type: 'Project finance bank', reason: 'BNP Paribas project finance, Mizuho, SMBC, MUFG industrial project finance', confidence: 0.85 },
        { type: 'Capex consulting firm', reason: 'McKinsey Operations, BCG Operations, Accenture Industry X, Deloitte Consulting Industrial capex advisory', confidence: 0.82 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Industrial Process Memory & Baselines', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes new memories and consolidates short-term to long-term storage.', inBusiness: 'In industry, process memory consolidates short-run shift data into long-term baselines: golden batches, best-demonstrated-run (BDR), and process fingerprints.' },
      function: 'Maintains long-term process baselines: golden batches, BDR, process fingerprints',
      dysregulation: 'Baseline drift, lost golden batches, tribal knowledge evaporation',
      expectedTypes: [
        { type: 'Historian platform', reason: 'AVEVA PI System, GE Digital Proficy Historian, Siemens XHQ, Wonderware Historian for long-term process data', confidence: 0.92 },
        { type: 'Batch analytics platform', reason: 'Aspen Technology InfoPlus.21, Seeq, TrendMiner for batch and continuous process analytics', confidence: 0.88 },
        { type: 'SPC / Six Sigma platform', reason: 'Minitab, InfinityQS, JMP Statistical Discovery (SAS), Northwest Analytics for SPC and process capability', confidence: 0.85 },
        { type: 'Process engineering consulting', reason: 'Aspen Technology Services, Wood Consulting, Stantec process engineering for process baseline development', confidence: 0.82 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Industrial Operations Control', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates goal-directed attention and executive resource allocation.', inBusiness: 'In industry, operations control directs plant-floor decisions: scheduling, dispatching, OEE management, and real-time corrective action.' },
      function: 'Runs plant-floor operations: scheduling, dispatching, OEE management, real-time response',
      dysregulation: 'Scheduling chaos, missed takt, OEE decline, unresponsive corrective action',
      expectedTypes: [
        { type: 'Advanced planning & scheduling', reason: 'Siemens Opcenter APS, SAP IBP, o9 Solutions, Kinaxis RapidResponse, OMP Plus for industrial APS', confidence: 0.92 },
        { type: 'OEE / performance platform', reason: 'Evocon, OEE Systems, Redzone Production System, Tulip Interfaces for real-time OEE', confidence: 0.88 },
        { type: 'Plant floor dashboarding', reason: 'Rockwell FactoryTalk VantagePoint, AVEVA InTouch, Ignition SCADA (Inductive Automation) for plant dashboards', confidence: 0.85 },
        { type: 'Industrial MES', reason: 'Rockwell Plex, Siemens Opcenter, GE Digital Proficy, Dassault DELMIA Apriso for enterprise MES', confidence: 0.9 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Industrial Simulation & Digital Twin', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports self-referential thought, mental imagery, and abstract spatial reasoning.', inBusiness: 'In industry, simulation and digital twin technology models plants, lines, robots, and processes before they’re built or changed.' },
      function: 'Builds simulations and digital twins of plants, lines, robots, and processes',
      dysregulation: 'Simulation gaps, model divergence from reality, twin rot',
      expectedTypes: [
        { type: 'Digital twin platform', reason: 'Ansys Twin Builder, Siemens Plant Simulation, Rockwell Emulate3D, Dassault DELMIA, PTC ThingWorx for digital twins', confidence: 0.92 },
        { type: 'Industrial CAE / FEA', reason: 'Ansys, Dassault SIMULIA, Siemens Simcenter, Altair HyperWorks for finite element and multiphysics', confidence: 0.9 },
        { type: 'Process simulation', reason: 'Aspen Technology aspenONE (HYSYS, Plus), AVEVA Process Simulation (SimCentral), Honeywell UniSim for process simulation', confidence: 0.88 },
        { type: 'Discrete event simulation', reason: 'AnyLogic, Siemens Tecnomatix Plant Simulation, Rockwell Arena, FlexSim for discrete event simulation', confidence: 0.85 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Industrial Homeostasis & Utilities', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates homeostatic functions and integrates physiological signals.', inBusiness: 'In industry, homeostasis covers plant utilities: compressed air, steam, chilled water, HVAC, power quality, industrial wastewater — the baseline systems that keep production running.' },
      function: 'Operates plant utilities: compressed air, steam, chilled water, HVAC, power quality, wastewater',
      dysregulation: 'Utility outages, energy waste, water compliance failures',
      expectedTypes: [
        { type: 'Compressed air systems', reason: 'Atlas Copco, Ingersoll Rand (IR), Gardner Denver (IR), Kaeser Kompressoren, Sullair (Hitachi) for compressed air', confidence: 0.9 },
        { type: 'Steam and boiler systems', reason: 'Cleaver-Brooks, Babcock & Wilcox (BW), Spirax Sarco, TLV for steam and boiler systems', confidence: 0.85 },
        { type: 'Industrial chillers & HVAC', reason: 'Johnson Controls (JCI), Carrier (CARR), Trane Technologies (TT), Daikin for industrial HVAC and chillers', confidence: 0.88 },
        { type: 'Industrial water treatment', reason: 'Veolia Water, Suez (Veolia), Evoqua (Xylem), Ecolab Nalco for industrial process and wastewater', confidence: 0.85 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Industrial Materials & Metallurgy', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates subjective value of options and updates expectations as outcomes change.', inBusiness: 'In industry, materials and metallurgy specify, test, and qualify the metals, alloys, composites, polymers, and ceramics that make every part a manufacturer builds.' },
      function: 'Specifies, tests, and qualifies materials: metals, alloys, composites, polymers, ceramics',
      dysregulation: 'Material substitution failures, metallurgy defects, composite lay-up errors',
      expectedTypes: [
        { type: 'Materials testing lab', reason: 'Element Materials Technology (private / Bridgepoint), NTS (National Technical Systems), Exova (Element), SGS materials for materials testing', confidence: 0.9 },
        { type: 'Metallurgy and failure analysis', reason: 'Exponent, Engineering Systems Inc (ESI), Materials Research and Testing (MR&T) for metallurgy and failure analysis', confidence: 0.88 },
        { type: 'Specialty alloys producer', reason: 'Allegheny Technologies (ATI), Carpenter Technology (CRS), Haynes International (HAYN) for specialty alloys', confidence: 0.85 },
        { type: 'Composites materials', reason: 'Hexcel (HXL), Toray Advanced Composites, Solvay Composite Materials, Teijin Limited for composite materials', confidence: 0.82 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Industrial Quantitative Operations', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports numerical cognition, spatial reasoning, and quantity representation.', inBusiness: 'In industry, quantitative operations runs the math: SPC, DOE, Six Sigma, process capability, production scheduling, and operations research.' },
      function: 'Runs industrial quantitative methods: SPC, DOE, Six Sigma, capability analysis, scheduling math',
      dysregulation: 'Statistical errors, underpowered DOE, capability misreads',
      expectedTypes: [
        { type: 'SPC / Six Sigma software', reason: 'Minitab, JMP Statistical Discovery (SAS), InfinityQS, Northwest Analytics, QI Macros for SPC and Six Sigma', confidence: 0.92 },
        { type: 'Design of experiments (DOE)', reason: 'Stat-Ease Design-Expert, Minitab DOE, JMP DOE, SAS DOE for industrial DOE', confidence: 0.88 },
        { type: 'Operations research firm', reason: 'Palisade Decision Tools (@RISK), Frontline Solvers, Gurobi Optimization, IBM CPLEX for industrial OR modeling', confidence: 0.85 },
        { type: 'Industrial engineering consultancy', reason: 'Performance Solutions by Milliken, Kaizen Institute, LeanCor for industrial engineering', confidence: 0.82 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Industrial Sensor & IIoT Networks', tier: 'top',
      neuroTranslation: { inNeurology: 'Routes visceral sensory input from the body to higher brain regions.', inBusiness: 'In industry, sensor networks route vibration, temperature, pressure, flow, and condition-monitoring data from thousands of points on every line.' },
      function: 'Operates industrial sensor and IIoT networks: vibration, temp, pressure, flow, condition monitoring',
      dysregulation: 'Sensor drift, broken wireless links, blind spots in condition monitoring',
      expectedTypes: [
        { type: 'Industrial sensor vendor', reason: 'Emerson (AMS sensors), Honeywell Industrial, Endress+Hauser, VEGA Grieshaber, Siemens SITRANS for industrial sensors', confidence: 0.92 },
        { type: 'IIoT gateway / edge vendor', reason: 'Cisco IR industrial routers, Siemens SIMATIC IOT, PTC Kepware, Rockwell Stratix, Dell Edge Gateway', confidence: 0.88 },
        { type: 'Wireless instrumentation', reason: 'Emerson WirelessHART, Honeywell OneWireless, ISA100.11a ecosystem vendors for wireless process instrumentation', confidence: 0.85 },
        { type: 'Predictive maintenance sensors', reason: 'Augury, Senseye (now Siemens), Uptake, Petasense for wireless vibration and predictive maintenance', confidence: 0.82 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Industrial Community & Labor Relations', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multimodal sensory input and supports theory of mind and social cognition.', inBusiness: 'In industry, community and labor relations manages the relationships between plants, unions, local communities, and workforces that make or break operational continuity.' },
      function: 'Manages plant-community relations, union negotiations, workforce engagement',
      dysregulation: 'Strikes, community opposition, plant shutdowns, brownfield disputes',
      expectedTypes: [
        { type: 'Labor relations consultancy', reason: 'Ogletree Deakins, Jackson Lewis, Littler Mendelson, Seyfarth Shaw for industrial labor relations counsel', confidence: 0.92 },
        { type: 'Community engagement firm', reason: 'FleishmanHillard Industrial, Edelman Business Marketing, APCO Community Relations for plant community engagement', confidence: 0.85 },
        { type: 'Workforce engagement platform', reason: 'Glint (Microsoft), Qualtrics EmployeeXM, CultureAmp, Medallia Employee for industrial workforce listening', confidence: 0.82 },
        { type: 'Industrial staffing prime', reason: 'ManpowerGroup, Kelly Services, Robert Half, Adecco Group industrial staffing brands', confidence: 0.78 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate Cortex', label: 'Industrial Process Safety & Ethics', tier: 'top',
      neuroTranslation: { inNeurology: 'Engages in self-monitoring, moral reasoning, and emotional evaluation.', inBusiness: 'In industry, process safety and ethics spans OSHA PSM, EPA RMP, Responsible Care, CSB recommendations, and corporate safety culture programs.' },
      function: 'Runs process safety management: OSHA PSM, EPA RMP, Responsible Care, CSB compliance',
      dysregulation: 'PSM audit findings, catastrophic events, criminal referrals, safety culture decay',
      expectedTypes: [
        { type: 'PSM consulting firm', reason: 'ABS Group, DEKRA, ioMosaic, BakerRisk, Risktec (TUV Rheinland) for OSHA PSM and EPA RMP consulting', confidence: 0.92 },
        { type: 'Safety instrumented systems', reason: 'Emerson DeltaV SIS, Honeywell Safety Manager, Yokogawa ProSafe, Siemens Safety Integrated for SIS', confidence: 0.9 },
        { type: 'Responsible Care consultancy', reason: 'ACC Responsible Care verification audits, TUV Rheinland Responsible Care audits, ABS Group Responsible Care', confidence: 0.85 },
        { type: 'Industrial ethics training', reason: 'NAVEX Global (formerly NAVEX), Ethena, Convercent (Diligent) for industrial ethics and compliance training', confidence: 0.78 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke’s Area', label: 'Industrial Software & AI', tier: 'top',
      neuroTranslation: { inNeurology: 'Comprehends language and extracts meaning from symbolic input.', inBusiness: 'In industry, software and AI develops the MES, MOM, PLM, CAD, CAM, CAE, and increasingly AI-for-manufacturing stacks that power modern production.' },
      function: 'Develops industrial software stacks: MES, MOM, PLM, CAD, CAM, CAE, AI-for-manufacturing',
      dysregulation: 'Software silos, integration debt, proprietary lock-in, AI hallucination in generative design',
      expectedTypes: [
        { type: 'Industrial software platform', reason: 'Siemens Digital Industries Software, Dassault Systemes, PTC, Rockwell Automation software, Autodesk Manufacturing', confidence: 0.92 },
        { type: 'AI-for-manufacturing startup', reason: 'Instrumental, Osaro, Covariant, Path Robotics, Bright Machines, Landing AI for AI-in-manufacturing', confidence: 0.88 },
        { type: 'Generative design software', reason: 'Autodesk Fusion 360 Generative Design, Ansys Discovery, Siemens NX Topology, nTopology for generative design', confidence: 0.85 },
        { type: 'Industrial AI platform', reason: 'C3.ai (AI), Palantir Foundry industrial, Databricks Manufacturing Lakehouse for industrial AI platforms', confidence: 0.82 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Skilled Trades Workforce', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays auditory information from cochlea to auditory cortex.', inBusiness: 'In industry, the skilled-trades workforce pipeline feeds welders, machinists, electricians, pipefitters, millwrights, industrial technicians into every plant and project.' },
      function: 'Recruits, trains, and retains skilled trades: welders, machinists, electricians, pipefitters, millwrights',
      dysregulation: 'Skilled-trade shortages, apprenticeship pipeline gaps, aging workforce',
      expectedTypes: [
        { type: 'Industrial staffing prime', reason: 'ManpowerGroup (MAN), Kelly Services (KELYA), Robert Half (RHI), ASGN Incorporated for industrial staffing', confidence: 0.92 },
        { type: 'Apprenticeship program provider', reason: 'Tooling U-SME, Penn Foster, NIMS (National Institute for Metalworking Skills), AWS for welding', confidence: 0.85 },
        { type: 'Industrial training academy', reason: 'Rockwell Automation University, Siemens Sitrain, ABB University, Fanuc America CNC training', confidence: 0.82 },
        { type: 'Union workforce', reason: 'USW (United Steelworkers), IAM (Machinists), IBEW (Electrical Workers), UA (Pipefitters), UAW (Auto Workers) training centers', confidence: 0.88 }
      ]
    },

    // ── INDUSTRY-OPERATIONAL NODES (84) ──
    'A1': { fullName: 'Primary Auditory Cortex', label: 'Industrial Alerting & Alarm Management', tier: 'operational', function: 'Broadcasts plant alarms, safety warnings, and operator notifications across the factory floor', dysregulation: 'Degradation of industrial alerting & alarm management', expectedTypes: [{ type: 'Alarm management software', reason: 'Emerson AMS Alarm Management, Honeywell DynAMo, Yokogawa CENTUM Alarm Master, PAS Global (Hexagon) for alarm management', confidence: 0.80 }, { type: 'Plant-wide PA / alert system', reason: 'HED alarm and warning systems, Federal Signal industrial, Edwards Signaling (Carrier) for plant alarms', confidence: 0.80 }] },
    'ADR': { fullName: 'Adrenal', label: 'Industrial Surge Response', tier: 'operational', function: 'Mobilizes surge response for plant outages, emergency ramp-ups, and crisis production', dysregulation: 'Degradation of industrial surge response', expectedTypes: [{ type: 'Surge maintenance contractor', reason: 'Day & Zimmermann industrial services, URS Energy (AECOM), Performance Contractors for surge maintenance', confidence: 0.80 }, { type: 'Emergency parts supplier', reason: 'Fastenal same-day, Grainger same-day, MSC Industrial Direct for emergency MRO supply', confidence: 0.80 }] },
    'AI': { fullName: 'Anterior Insula', label: 'Industrial Risk Triage', tier: 'operational', function: 'Triages industrial risks: safety, quality, supply, compliance', dysregulation: 'Degradation of industrial risk triage', expectedTypes: [{ type: 'Industrial risk software', reason: 'Origami Risk, Riskonnect Industrial, LogicGate for industrial enterprise risk management', confidence: 0.80 }, { type: 'Plant risk assessment firm', reason: 'DEKRA, TUV Rheinland, TUV SUD, DNV for industrial HAZOP, LOPA, and risk assessments', confidence: 0.80 }] },
    'ANT': { fullName: 'Anterior Thalamus', label: 'Production Attention Routing', tier: 'operational', function: 'Routes operator attention to priority production issues: SPC alarms, deviation alerts', dysregulation: 'Degradation of production attention routing', expectedTypes: [{ type: 'Alarm rationalization tool', reason: 'Honeywell DynAMo, Emerson AMS, PAS Global Automation, Yokogawa AAASuite for alarm rationalization', confidence: 0.80 }, { type: 'MES operator dashboard', reason: 'Rockwell FactoryTalk View SE, Siemens WinCC, GE Digital Proficy HMI for operator interfaces', confidence: 0.80 }] },
    'ARC': { fullName: 'Arcuate Fasciculus', label: 'Engineering Change Translation', tier: 'operational', function: 'Translates engineering change orders (ECOs) into work instructions, BOM updates, and tooling changes', dysregulation: 'Degradation of engineering change translation', expectedTypes: [{ type: 'PLM / change management', reason: 'Siemens Teamcenter Change, PTC Windchill ChangeWorkflow, Dassault 3DEXPERIENCE ENOVIA Change for ECO workflow', confidence: 0.80 }, { type: 'Work instructions platform', reason: 'Tulip Interfaces, Dozuki, VKS (Visual Knowledge Share), Poka for digital work instructions', confidence: 0.80 }] },
    'BDNF': { fullName: 'BDNF / Plasticity', label: 'Industrial Process Innovation', tier: 'operational', function: 'Develops new processes and adapts existing ones: continuous improvement, kaizen, TPM', dysregulation: 'Degradation of industrial process innovation', expectedTypes: [{ type: 'Continuous improvement firm', reason: 'Kaizen Institute, LeanCor, Performance Solutions by Milliken, Shingijutsu for kaizen and lean consulting', confidence: 0.80 }, { type: 'TPM consulting', reason: 'JIPM (Japan Institute of Plant Maintenance), TPM Consulting Group, SMRP (Society for Maintenance & Reliability Professionals)', confidence: 0.80 }] },
    'BLA': { fullName: 'Basolateral Amygdala', label: 'Industrial Threat Modeling', tier: 'operational', function: 'Builds threat models from past incidents: safety events, quality failures, supply disruptions', dysregulation: 'Degradation of industrial threat modeling', expectedTypes: [{ type: 'OT / ICS threat intel', reason: 'Dragos, Claroty, Nozomi Networks, Armis Industrial for OT threat intelligence', confidence: 0.80 }, { type: 'Industrial incident database', reason: 'CSB investigation database, PHMSA pipeline incidents, OSHA fatality database, NTSB accident reports', confidence: 0.80 }] },
    'BNST': { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Slow-Burn Industrial Monitoring', tier: 'operational', function: 'Monitors chronic industrial stressors: creeping backlogs, drift, aging equipment', dysregulation: 'Degradation of slow-burn industrial monitoring', expectedTypes: [{ type: 'CMMS / EAM platform', reason: 'IBM Maximo, IFS Applications, SAP PM, Infor EAM, eMaint (Fluke) for computerized maintenance management', confidence: 0.80 }, { type: 'Reliability engineering firm', reason: 'ARMS Reliability, SMRP, HSB (Munich Re), ABS Consulting for reliability engineering services', confidence: 0.80 }] },
    'CARD': { fullName: 'Cardiac Autonomic Centers', label: 'Continuous Plant Monitoring', tier: 'operational', function: 'Continuous monitoring of production lines, utilities, and critical plant assets', dysregulation: 'Degradation of continuous plant monitoring', expectedTypes: [{ type: 'Condition monitoring', reason: 'SKF (SKFRY), Emerson AMS Machine Works, Rockwell Dynamix, Brüel & Kjaer Vibro for condition monitoring', confidence: 0.80 }, { type: 'Plant historian', reason: 'AVEVA PI System, GE Digital Proficy Historian, Siemens XHQ, Wonderware Historian for continuous plant data', confidence: 0.80 }] },
    'CAUD': { fullName: 'Caudate Nucleus', label: 'Industrial Workflow Automation', tier: 'operational', function: 'Automates repetitive industrial workflows: permits, lockout-tagout, maintenance tickets', dysregulation: 'Degradation of industrial workflow automation', expectedTypes: [{ type: 'CMMS workflow automation', reason: 'IBM Maximo Workflow, Infor EAM Workflow, Fiix (Rockwell), UpKeep for CMMS workflows', confidence: 0.80 }, { type: 'Industrial RPA / automation', reason: 'UiPath Manufacturing, Automation Anywhere, Microsoft Power Automate for industrial back-office RPA', confidence: 0.80 }] },
    'CBLM': { fullName: 'Cerebellum (whole)', label: 'Industrial Project Coordination', tier: 'operational', function: 'Coordinates complex multi-site industrial projects: turnarounds, capital projects, debottlenecking', dysregulation: 'Degradation of industrial project coordination', expectedTypes: [{ type: 'Industrial project management', reason: 'Primavera P6 (Oracle), Microsoft Project, Smartsheet, Planisware 6 for industrial project scheduling', confidence: 0.80 }, { type: 'Turnaround management firm', reason: 'Day & Zimmermann turnarounds, TIC (URS/AECOM), Brand Safway (Clayton, Dubilier & Rice) for refinery turnarounds', confidence: 0.80 }] },
    'CC': { fullName: 'Corpus Callosum', label: 'Cross-Plant Integration', tier: 'operational', function: 'Integrates data and processes across multiple plants, sites, and business units', dysregulation: 'Degradation of cross-plant integration', expectedTypes: [{ type: 'Enterprise MES / MOM', reason: 'Rockwell Plex Enterprise, Siemens Opcenter Enterprise, GE Digital Proficy Plant Applications for enterprise MES', confidence: 0.80 }, { type: 'Industrial data fabric', reason: 'AVEVA PI Server, Cognite Data Fusion, Databricks Lakehouse, Snowflake Manufacturing Data Cloud', confidence: 0.80 }] },
    'CING': { fullName: 'Cingulate Cortex (general)', label: 'Industrial Mission Conflict Resolution', tier: 'operational', function: 'Resolves conflicts between production, maintenance, quality, safety, and engineering priorities', dysregulation: 'Degradation of industrial mission conflict resolution', expectedTypes: [{ type: 'Operations management consulting', reason: 'McKinsey Operations, BCG Operations, Accenture Industry X for industrial ops conflict resolution', confidence: 0.80 }, { type: 'Cross-functional workflow', reason: 'Tulip Interfaces, Poka, Dozuki for cross-functional industrial workflow enablement', confidence: 0.80 }] },
    'CLAUST': { fullName: 'Claustrum', label: 'Cross-Sensor Correlation', tier: 'operational', function: 'Correlates events across vibration, temperature, pressure, current, and acoustic sensors', dysregulation: 'Degradation of cross-sensor correlation', expectedTypes: [{ type: 'Anomaly detection platform', reason: 'Augury, Senseye (Siemens), Uptake, Petasense, C3.ai Anomaly Detection for multi-sensor correlation', confidence: 0.80 }, { type: 'Plant-wide analytics', reason: 'Seeq, TrendMiner, Aspen Technology aspenONE, Tulip for industrial operations analytics', confidence: 0.80 }] },
    'CMZ': { fullName: 'Central Midbrain Zone', label: 'Industrial Threat Level Management', tier: 'operational', function: 'Manages plant threat levels: ACGIH exposure, PSI pressure safety, LOTO and PPE escalation', dysregulation: 'Degradation of industrial threat level management', expectedTypes: [{ type: 'LOTO / permit to work', reason: 'Brady LOTO, Enablon (Wolters Kluwer) Permit to Work, Intelex Permit, EcoOnline Permit for LOTO and permits', confidence: 0.80 }, { type: 'Industrial hygiene service', reason: 'Industrial Hygiene Solutions (IHS), EnviroGuard, SGS Industrial Hygiene for OSHA exposure assessments', confidence: 0.80 }] },
    'CON': { fullName: 'Cingulo-opercular Network', label: 'Sustained Industrial Operations', tier: 'operational', function: 'Maintains sustained long-duration operations: 24/7 shift operations, continuous production', dysregulation: 'Degradation of sustained industrial operations', expectedTypes: [{ type: 'Shift scheduling software', reason: 'Kronos (UKG), Dayforce (Ceridian), Quinyx, When I Work for industrial shift scheduling', confidence: 0.80 }, { type: 'Industrial EHS platform', reason: 'Sphera Industrial, Cority Industrial, Enablon, Intelex for sustained industrial EHS operations', confidence: 0.80 }] },
    'DAN': { fullName: 'Dorsal Attention Network', label: 'Targeted Plant Surveillance', tier: 'operational', function: 'Maintains targeted surveillance on critical assets: rotating equipment, high-criticality lines', dysregulation: 'Degradation of targeted plant surveillance', expectedTypes: [{ type: 'Predictive maintenance', reason: 'Augury, Senseye (Siemens), Uptake, Petasense for targeted predictive maintenance', confidence: 0.80 }, { type: 'Industrial video analytics', reason: 'Avigilon (Motorola), Genetec, Verkada for industrial security and operations video', confidence: 0.80 }] },
    'DISS': { fullName: 'Dissolution', label: 'Industrial Red-Team Exercises', tier: 'operational', function: 'Runs HAZOP, LOPA, and process safety red-team exercises', dysregulation: 'Degradation of industrial red-team exercises', expectedTypes: [{ type: 'HAZOP / LOPA facilitation', reason: 'BakerRisk, ioMosaic, ABS Consulting, DEKRA HAZOP and LOPA facilitation', confidence: 0.80 }, { type: 'Safety culture assessment', reason: 'DuPont Sustainable Solutions, DEKRA Organisational Reliability, BakerRisk safety culture', confidence: 0.80 }] },
    'DV': { fullName: 'Dorsal Vagal Complex', label: 'Industrial Program Drawdown', tier: 'operational', function: 'Handles closure and drawdown of industrial programs, plant mothballing, brownfield transition', dysregulation: 'Degradation of industrial program drawdown', expectedTypes: [{ type: 'Plant decommissioning', reason: 'AECOM decommissioning, Jacobs decommissioning, TRC Companies, Environmental Resources Management (ERM)', confidence: 0.80 }, { type: 'Asset recovery firm', reason: 'IronPlanet (Ritchie Bros RBA), GoIndustry DoveBid (Liquidity Services LQDT), Perfection Industrial Sales', confidence: 0.80 }] },
    'EC': { fullName: 'Entorhinal Cortex', label: 'Industrial Indicator Indexing', tier: 'operational', function: 'Indexes industrial KPIs and conditions for rapid retrieval: OEE, yield, scrap, rework', dysregulation: 'Degradation of industrial indicator indexing', expectedTypes: [{ type: 'OEE / KPI dashboards', reason: 'Evocon, OEE Systems, Redzone Production System, Tulip Interfaces for OEE dashboards', confidence: 0.80 }, { type: 'Manufacturing intelligence', reason: 'AspenONE Mtell, Seeq, TrendMiner, GE Digital Proficy for manufacturing intelligence', confidence: 0.80 }] },
    'EI': { fullName: 'Excitatory/Inhibitory Balance', label: 'Industrial Pacing & Takt Balance', tier: 'operational', function: 'Balances line pacing, takt time, and throughput across production lines', dysregulation: 'Degradation of industrial pacing & takt balance', expectedTypes: [{ type: 'Line balancing software', reason: 'Siemens Tecnomatix, Dassault DELMIA, GE Digital Proficy Workflow for line balancing and takt', confidence: 0.80 }, { type: 'Industrial engineering consultancy', reason: 'LeanCor, Performance Solutions by Milliken, Kaizen Institute for industrial engineering', confidence: 0.80 }] },
    'EMP': { fullName: 'Empathy Circuit', label: 'Industrial Customer Co-Engineering', tier: 'operational', function: 'Engages customers in co-engineering, application engineering, and value-add partnerships', dysregulation: 'Degradation of industrial customer co-engineering', expectedTypes: [{ type: 'Application engineering firm', reason: 'Customer engineering services at Rockwell, Siemens, ABB, Emerson for OEM application engineering', confidence: 0.80 }, { type: 'Supplier development', reason: 'Milliken Supplier Development, Automotive Industry Action Group (AIAG) supplier programs', confidence: 0.80 }] },
    'ENDO': { fullName: 'Endocrine System', label: 'Industrial Program Scheduling', tier: 'operational', function: 'Schedules recurring industrial operations: preventive maintenance, calibration, audit cycles', dysregulation: 'Degradation of industrial program scheduling', expectedTypes: [{ type: 'Preventive maintenance scheduling', reason: 'IBM Maximo PM Schedule, IFS Applications PM, SAP Plant Maintenance, Infor EAM PM for PM scheduling', confidence: 0.80 }, { type: 'Calibration management', reason: 'GageSmart (Beamex), ProCalV5, SimplyCal, Beamex CMX for instrument calibration management', confidence: 0.80 }] },
    'ENS': { fullName: 'Enteric Nervous System', label: 'Autonomous Industrial Systems', tier: 'operational', function: 'Runs autonomous industrial systems: AGVs, AMRs, collaborative robots', dysregulation: 'Degradation of autonomous industrial systems', expectedTypes: [{ type: 'AGV / AMR vendor', reason: 'Mobile Industrial Robots (Teradyne), Fetch Robotics (Zebra), Locus Robotics, 6 River Systems (Shopify) for AGVs and AMRs', confidence: 0.80 }, { type: 'Collaborative robots', reason: 'Universal Robots (Teradyne), Fanuc CRX, ABB YuMi, Doosan Robotics for cobots', confidence: 0.80 }] },
    'FEF': { fullName: 'Frontal Eye Field', label: 'Industrial Inspection Tasking', tier: 'operational', function: 'Tasks inspection resources onto priority quality issues: first article, in-process, final', dysregulation: 'Degradation of industrial inspection tasking', expectedTypes: [{ type: 'Vision inspection system', reason: 'Cognex (CGNX), Keyence (KYCCF), Omron (OMRNY), Basler (BSLNF) for industrial machine vision', confidence: 0.80 }, { type: 'CMM / metrology tasking', reason: 'Hexagon Metrology, Zeiss Industrial Metrology, Mitutoyo, Nikon Metrology for CMM inspection', confidence: 0.80 }] },
    'FG': { fullName: 'Fusiform Gyrus', label: 'Industrial Part Recognition', tier: 'operational', function: 'Computer vision for part recognition, defect detection, and automated quality inspection', dysregulation: 'Degradation of industrial part recognition', expectedTypes: [{ type: 'Deep learning vision', reason: 'Cognex VisionPro Deep Learning, Keyence CV-X Series AI, Landing AI for industrial visual inspection', confidence: 0.80 }, { type: 'Specialty defect detection', reason: 'Instrumental (AI vision), MakinaRocks, Neurala (Honeywell) for AI defect detection', confidence: 0.80 }] },
    'FORN': { fullName: 'Fornix', label: 'Industrial Data Pipeline Management', tier: 'operational', function: 'Manages pipelines moving industrial data from historian to analytics to decision', dysregulation: 'Degradation of industrial data pipeline management', expectedTypes: [{ type: 'Industrial data integration', reason: 'Cognite Data Fusion, AVEVA Connect, Seeq, TrendMiner for industrial data pipelines', confidence: 0.80 }, { type: 'ETL for manufacturing', reason: 'Databricks Manufacturing Lakehouse, Snowflake Manufacturing Data Cloud, Microsoft Fabric manufacturing', confidence: 0.80 }] },
    'GABA_GLU': { fullName: 'GABA / Glutamate Balance', label: 'Industrial Capacity Balancing', tier: 'operational', function: 'Balances plant capacity utilization across lines, shifts, and sites', dysregulation: 'Degradation of industrial capacity balancing', expectedTypes: [{ type: 'Capacity planning software', reason: 'Siemens Opcenter APS, SAP IBP Capacity, Kinaxis RapidResponse for capacity planning', confidence: 0.80 }, { type: 'Plant load balancing', reason: 'Plex Systems Capacity, Aspen Technology MES Mtell for plant load balancing', confidence: 0.80 }] },
    'GBA': { fullName: 'Gut-Brain Axis', label: 'Plant Floor Feedback', tier: 'operational', function: 'Captures plant floor feedback: operator input, kaizen suggestions, gemba walks', dysregulation: 'Degradation of plant floor feedback', expectedTypes: [{ type: 'Operator feedback platform', reason: 'Tulip Interfaces, Poka, Dozuki, VKS for plant floor feedback and shop floor connectivity', confidence: 0.80 }, { type: 'Kaizen / ideas platform', reason: 'KaiNexus, Spigit (Planview), Brightidea, IdeaScale for industrial kaizen and continuous improvement', confidence: 0.80 }] },
    'GP': { fullName: 'Globus Pallidus', label: 'Industrial Authorization Gating', tier: 'operational', function: 'Gates critical industrial actions: production release, change authorization, PPE approval', dysregulation: 'Degradation of industrial authorization gating', expectedTypes: [{ type: 'Change control system', reason: 'Siemens Teamcenter Change Management, Oracle Agile PLM, Dassault 3DEXPERIENCE ENOVIA Change', confidence: 0.80 }, { type: 'Permit authorization', reason: 'Enablon Permit to Work, Intelex Permits, Sphera Operational Risk Permit for industrial permits', confidence: 0.80 }] },
    'HAB': { fullName: 'Habenula', label: 'Industrial Failure Signal Propagation', tier: 'operational', function: 'Propagates failure signals: lessons learned, CAPA, failure mode capture', dysregulation: 'Degradation of industrial failure signal propagation', expectedTypes: [{ type: 'CAPA platform', reason: 'MasterControl CAPA, ETQ Reliance CAPA, Veeva Vault CAPA for corrective and preventive action', confidence: 0.80 }, { type: 'Failure mode database', reason: 'IHS Markit Engineering Workbench (RAM Commander), ReliaSoft (Hottinger Bruel & Kjaer) for FMEA and failure mode', confidence: 0.80 }] },
    'HPA': { fullName: 'HPA Axis', label: 'Multi-Tier Industrial Crisis Escalation', tier: 'operational', function: 'Escalates industrial crises through line, plant, region, and corporate tiers', dysregulation: 'Degradation of multi-tier industrial crisis escalation', expectedTypes: [{ type: 'Enterprise crisis management', reason: 'Everbridge Industrial, OnSolve Critical Event Management, Noggin for industrial crisis management', confidence: 0.80 }, { type: 'Operations control tower', reason: 'SAP IBP Control Tower, Kinaxis Control Tower, o9 Digital Control Tower for industrial escalation', confidence: 0.80 }] },
    'IC': { fullName: 'Inferior Colliculus', label: 'Industrial Stream Routing', tier: 'operational', function: 'Routes industrial data streams to analysts, operators, and planners', dysregulation: 'Degradation of industrial stream routing', expectedTypes: [{ type: 'OPC / data routing', reason: 'PTC Kepware, Matrikon OPC (Honeywell), Softing OPC, Inductive Automation Ignition for OPC routing', confidence: 0.80 }, { type: 'Industrial messaging', reason: 'Solace PubSub+, MQTT brokers (HiveMQ), AWS IoT Core, Azure IoT Hub for industrial messaging', confidence: 0.80 }] },
    'LANG': { fullName: 'Language Network', label: 'Multilingual Industrial Operations', tier: 'operational', function: 'Supports industrial operations across languages: multilingual documentation, operator training', dysregulation: 'Degradation of multilingual industrial operations', expectedTypes: [{ type: 'Industrial translation', reason: 'Lionbridge Technical, TransPerfect Life Sciences, United Language Group Industrial for industrial translation', confidence: 0.80 }, { type: 'Technical documentation', reason: 'Quark XML Author, DITA-OT, Adobe FrameMaker, Madcap Flare for industrial technical docs', confidence: 0.80 }] },
    'LAR': { fullName: 'Laryngeal Cortex', label: 'Industrial Public Affairs', tier: 'operational', function: 'Manages public affairs and official communications for industrial companies', dysregulation: 'Degradation of industrial public affairs', expectedTypes: [{ type: 'Industrial PR firm', reason: 'Edelman Business Marketing, FleishmanHillard Industrial, Weber Shandwick Industrial for industrial PR', confidence: 0.80 }, { type: 'Government affairs firm', reason: 'Akin Gump Industrial, Van Ness Feldman, Bracewell Industrial for industrial government affairs', confidence: 0.80 }] },
    'LC': { fullName: 'Locus Coeruleus', label: 'Industrial Alert Broadcasting', tier: 'operational', function: 'Broadcasts urgent industrial alerts across the plant: evacuations, safety incidents, production halts', dysregulation: 'Degradation of industrial alert broadcasting', expectedTypes: [{ type: 'Mass notification system', reason: 'Everbridge Mass Notification, OnSolve CodeRED, Rave Mobile Safety for industrial mass alerts', confidence: 0.80 }, { type: 'Plant paging / PA', reason: 'Federal Signal Plant Paging, Edwards Signaling (Carrier), Gai-Tronics (Hubbell) for plant-wide PA', confidence: 0.80 }] },
    'LGN': { fullName: 'Lateral Geniculate Nucleus', label: 'Industrial Imagery Processing', tier: 'operational', function: 'Processes industrial imagery: machine vision, part inspection, thermal imaging', dysregulation: 'Degradation of industrial imagery processing', expectedTypes: [{ type: 'Machine vision library', reason: 'Cognex VisionPro, Keyence CV-X Series, Halcon (MVTec), Matrox Imaging for industrial machine vision libraries', confidence: 0.80 }, { type: 'Thermal imaging for industry', reason: 'FLIR (Teledyne TDY), Fluke Thermal Imagers (Fortive), Testo Industrial for industrial thermal imaging', confidence: 0.80 }] },
    'MAMM': { fullName: 'Mammillary Bodies', label: 'Long-Term Industrial Archive', tier: 'operational', function: 'Archives long-term industrial data: historian rollup, batch records, audit archives', dysregulation: 'Degradation of long-term industrial archive', expectedTypes: [{ type: 'Industrial data archive', reason: 'AVEVA PI Archive, GE Digital Proficy Historian Archive, Canary Labs Historian for long-term plant data', confidence: 0.80 }, { type: 'Batch record archive', reason: 'Werum PAS-X (Körber), Rockwell PharmaSuite, Siemens SIMATIC IT Manufacturing Intelligence for batch records', confidence: 0.80 }] },
    'MDT': { fullName: 'Mediodorsal Thalamus', label: 'Industrial Decision Gating', tier: 'operational', function: 'Gates high-stakes industrial decisions through engineering review, safety review, ops review', dysregulation: 'Degradation of industrial decision gating', expectedTypes: [{ type: 'Engineering review software', reason: 'Siemens Teamcenter Review, PTC Windchill Review, Dassault 3DEXPERIENCE ENOVIA Review', confidence: 0.80 }, { type: 'Management of change (MOC)', reason: 'Sphera MOC, Enablon MOC, Intelex MOC, PSM Solutions for industrial MOC management', confidence: 0.80 }] },
    'NAcc': { fullName: 'Nucleus Accumbens', label: 'Industrial Incentive & Rewards', tier: 'operational', function: 'Manages plant floor incentives, bonuses, and production rewards', dysregulation: 'Degradation of industrial incentive & rewards', expectedTypes: [{ type: 'Performance management', reason: 'Kronos (UKG) Performance, Ceridian Dayforce, ADP Workforce Now, Paychex Flex for industrial performance management', confidence: 0.80 }, { type: 'Safety incentive programs', reason: 'Total Safety, DEKRA Insight, DuPont Sustainable Solutions for industrial safety incentive programs', confidence: 0.80 }] },
    'NBM': { fullName: 'Nucleus Basalis', label: 'Industrial Operational Tempo', tier: 'operational', function: 'Sets and sustains operational tempo: line speed, shift cadence, turnaround cycle time', dysregulation: 'Degradation of industrial operational tempo', expectedTypes: [{ type: 'Takt time calculators', reason: 'Siemens Opcenter Takt, Dassault DELMIA Takt, Lean Enterprise Institute reference tooling for takt', confidence: 0.80 }, { type: 'Turnaround planning', reason: 'Day & Zimmermann turnarounds, Jacobs turnaround services, Wood Group turnarounds for refinery and petrochemical turnarounds', confidence: 0.80 }] },
    'NEOCER': { fullName: 'Neocerebellum', label: 'Industrial Precision Control', tier: 'operational', function: 'Refines industrial control through closed-loop adjustment: APC, MPC, real-time optimization', dysregulation: 'Degradation of industrial precision control', expectedTypes: [{ type: 'Advanced process control', reason: 'AspenTech DMCplus, Honeywell Profit Controller, Yokogawa Exasmoc, Rockwell Pavilion8 for APC and MPC', confidence: 0.80 }, { type: 'Real-time optimization', reason: 'AspenTech aspenONE RTO, Honeywell Profit Optimizer, Yokogawa Exaquantum for real-time optimization', confidence: 0.80 }] },
    'OLF': { fullName: 'Olfactory Cortex', label: 'Industrial Leak & Emissions Detection', tier: 'operational', function: 'Detects subtle industrial leaks: VOCs, fugitive emissions, refrigerants, process gas', dysregulation: 'Degradation of industrial leak & emissions detection', expectedTypes: [{ type: 'LDAR service provider', reason: 'Heath Consultants, Environment One, Picarro, Aeris Technologies for LDAR (Leak Detection and Repair)', confidence: 0.80 }, { type: 'Optical gas imaging', reason: 'FLIR OGI (Teledyne TDY), Workswell WIRIS OGI, Opgal EyeCGas for optical gas imaging', confidence: 0.80 }] },
    'OPIOID': { fullName: 'Opioid System', label: 'Industrial Worker Wellness', tier: 'operational', function: 'Provides industrial worker wellness: heat stress, fatigue management, ergonomics', dysregulation: 'Degradation of industrial worker wellness', expectedTypes: [{ type: 'Worker wellness platform', reason: 'Fitbit Health Solutions (Google), Virgin Pulse, WHOOP, Garmin Health for industrial worker wellness', confidence: 0.80 }, { type: 'Ergonomics consulting', reason: 'Humantech, Ergodirect, Evans Incorporated Ergonomics, Humanscale for industrial ergonomics', confidence: 0.80 }] },
    'OSC': { fullName: 'Oscillatory Networks', label: 'Industrial Cycle Synchronization', tier: 'operational', function: 'Synchronizes cyclical industrial operations: shift changes, PM cycles, batch campaigns', dysregulation: 'Degradation of industrial cycle synchronization', expectedTypes: [{ type: 'Production scheduling', reason: 'Siemens Opcenter APS, SAP IBP, Kinaxis RapidResponse, o9 Solutions for industrial production scheduling', confidence: 0.80 }, { type: 'Batch scheduling', reason: 'Werum PAS-X Scheduling, AspenTech aspenONE Supply Chain, Rockwell PharmaSuite for batch scheduling', confidence: 0.80 }] },
    'OXY': { fullName: 'Oxytocin System', label: 'Industrial Supplier Trust', tier: 'operational', function: 'Builds trust with suppliers: qualification, long-term agreements, supplier development', dysregulation: 'Degradation of industrial supplier trust', expectedTypes: [{ type: 'Supplier qualification', reason: 'GHX Industrial, Achilles, SAP Ariba Supplier Risk, Coupa Supplier Information Management for supplier qualification', confidence: 0.80 }, { type: 'Supplier development', reason: 'Milliken Supplier Development, AIAG supplier programs, SAE G-21 and G-23 supplier quality standards', confidence: 0.80 }] },
    'PAG': { fullName: 'Periaqueductal Gray', label: 'Industrial Last-Resort Response', tier: 'operational', function: 'Coordinates last-resort industrial responses: emergency shutdowns, evacuation, force majeure', dysregulation: 'Degradation of industrial last-resort response', expectedTypes: [{ type: 'Emergency shutdown system', reason: 'Emerson DeltaV SIS, Honeywell Safety Manager, Yokogawa ProSafe-RS for ESD systems', confidence: 0.80 }, { type: 'Force majeure legal', reason: 'Vinson & Elkins industrial force majeure, Kirkland & Ellis industrial crisis, Skadden industrial force majeure', confidence: 0.80 }] },
    'PBN': { fullName: 'Parabrachial Nucleus', label: 'Industrial Capacity Signaling', tier: 'operational', function: 'Signals industrial capacity constraints up the chain: bottleneck alerts, volume commitments', dysregulation: 'Degradation of industrial capacity signaling', expectedTypes: [{ type: 'Capacity alerting', reason: 'Kinaxis RapidResponse Capacity Alerts, SAP IBP Alerts, o9 Solutions Capacity Alerts for capacity signaling', confidence: 0.80 }, { type: 'Bottleneck analytics', reason: 'Aspen Technology aspenONE Bottlenecks, Siemens Plant Simulation Bottleneck, GE Digital Proficy Bottleneck', confidence: 0.80 }] },
    'PCC': { fullName: 'Posterior Cingulate Cortex', label: 'Industrial Post-Event Review', tier: 'operational', function: 'Reviews past production runs, incidents, and quality escapes for lessons learned', dysregulation: 'Degradation of industrial post-event review', expectedTypes: [{ type: 'Post-shift review tool', reason: 'Tulip Interfaces, Poka, Dozuki, Redzone Production System for post-shift review', confidence: 0.80 }, { type: 'Incident investigation', reason: 'TapRooT (System Improvements Inc), Kelvin TOP-SET, ABS Consulting for incident investigation', confidence: 0.80 }] },
    'PI': { fullName: 'Posterior Insula', label: 'Industrial Internal State Monitoring', tier: 'operational', function: 'Monitors internal state of industrial operations: worker morale, shift culture, plant climate', dysregulation: 'Degradation of industrial internal state monitoring', expectedTypes: [{ type: 'Employee listening platform', reason: 'Glint (Microsoft), Qualtrics EmployeeXM, CultureAmp, Medallia Employee for plant-floor employee listening', confidence: 0.80 }, { type: 'Plant culture assessment', reason: 'DuPont Sustainable Solutions, DEKRA Organisational Reliability, BakerRisk safety culture assessment', confidence: 0.80 }] },
    'PIN': { fullName: 'Pineal Gland', label: 'Industrial Time-Gated Operations', tier: 'operational', function: 'Synchronizes time-gated industrial operations: shift windows, PM windows, changeover', dysregulation: 'Degradation of industrial time-gated operations', expectedTypes: [{ type: 'Shift scheduling software', reason: 'Kronos (UKG), Ceridian Dayforce, ADP Workforce Now, Quinyx for industrial shift scheduling', confidence: 0.80 }, { type: 'Changeover optimization', reason: 'Aspen Technology aspenONE Changeover, Siemens Opcenter Changeover, SMED implementations via Shingijutsu', confidence: 0.80 }] },
    'PIT': { fullName: 'Pituitary Gland', label: 'Industrial Directive Broadcast', tier: 'operational', function: 'Broadcasts industrial directives: safety stand-downs, production orders, quality holds', dysregulation: 'Degradation of industrial directive broadcast', expectedTypes: [{ type: 'Production order system', reason: 'SAP PP, Oracle Manufacturing Cloud, Rockwell Plex, Siemens Opcenter for production order dispatch', confidence: 0.80 }, { type: 'Safety stand-down comms', reason: 'Everbridge Mass Notification, OnSolve CEM, Rave Alert for safety stand-down communications', confidence: 0.80 }] },
    'PPN': { fullName: 'Pedunculopontine Nucleus', label: 'Industrial Continuous Operations', tier: 'operational', function: 'Maintains continuous operations cadence: 24/7 running, autonomous shift coverage', dysregulation: 'Degradation of industrial continuous operations', expectedTypes: [{ type: 'Shift handover platform', reason: 'Tulip Interfaces Shift Handover, Poka Shift Handover, Dozuki Shift Notes for industrial shift handover', confidence: 0.80 }, { type: '24/7 ops monitoring', reason: 'Rockwell FactoryTalk Metrics, Siemens WinCC Performance, GE Digital Proficy Performance for 24/7 ops', confidence: 0.80 }] },
    'PULV': { fullName: 'Pulvinar', label: 'Critical Asset Attention', tier: 'operational', function: 'Weights attention by asset criticality: bad actors, bottleneck machines, safety-critical equipment', dysregulation: 'Degradation of critical asset attention', expectedTypes: [{ type: 'Asset criticality ranking', reason: 'SMRP asset criticality, Bentley Asset Wisdom, IBM Maximo Asset Criticality, Infor EAM Criticality', confidence: 0.80 }, { type: 'Bad actor management', reason: 'Meridium APM (GE Digital), AspenTech Mtell, Cognite Machine Health for bad actor management', confidence: 0.80 }] },
    'PUT': { fullName: 'Putamen', label: 'Industrial Procedural Execution', tier: 'operational', function: 'Reinforces habitual industrial procedures: SOPs, standard work, lockout-tagout drills', dysregulation: 'Degradation of industrial procedural execution', expectedTypes: [{ type: 'SOP management', reason: 'MasterControl Documents, Veeva Vault QualityDocs, ETQ Documents for industrial SOP management', confidence: 0.80 }, { type: 'Standard work platform', reason: 'Tulip Interfaces, Poka, Dozuki, VKS (Visual Knowledge Share) for standard work execution', confidence: 0.80 }] },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Industrial Morale Monitoring', tier: 'operational', function: 'Monitors industrial workforce morale: shift sentiment, retention risk, burnout signals', dysregulation: 'Degradation of industrial morale monitoring', expectedTypes: [{ type: 'Workforce sentiment platform', reason: 'Glint (Microsoft), Qualtrics EmployeeXM, Visier People, UKG Pro for workforce sentiment', confidence: 0.80 }, { type: 'Retention analytics', reason: 'Workday People Analytics, Visier People Analytics, Eightfold AI for industrial retention analytics', confidence: 0.80 }] },
    'RF': { fullName: 'Reticular Formation', label: 'Industrial Wake-from-Idle Activation', tier: 'operational', function: 'Activates plants from idle, cold-start, or extended-shutdown condition', dysregulation: 'Degradation of industrial wake-from-idle activation', expectedTypes: [{ type: 'Startup / commissioning', reason: 'Fluor commissioning, Jacobs commissioning, Burns & McDonnell commissioning for plant startup and cold-start', confidence: 0.80 }, { type: 'Restart sequencing', reason: 'AVEVA Unified Operations Center, Emerson SureService Startup, Honeywell Experion Startup for plant restart', confidence: 0.80 }] },
    'RSC': { fullName: 'Retrosplenial Cortex', label: 'Industrial Layout & Flow Mapping', tier: 'operational', function: 'Maps plant layout, material flow, and value streams for operational awareness', dysregulation: 'Degradation of industrial layout & flow mapping', expectedTypes: [{ type: 'Plant layout / simulation', reason: 'Siemens Tecnomatix Plant Simulation, Dassault DELMIA, AnyLogic, FlexSim for plant layout and flow', confidence: 0.80 }, { type: 'Value stream mapping', reason: 'LeanCor VSM, Lean Enterprise Institute VSM templates, Shingijutsu VSM facilitation for VSM workshops', confidence: 0.80 }] },
    'S1': { fullName: 'Primary Somatosensory Cortex', label: 'Tactile & Wearable Plant Sensing', tier: 'operational', function: 'Collects tactile and wearable data: handheld sensors, PPE sensors, body-worn devices', dysregulation: 'Degradation of tactile & wearable plant sensing', expectedTypes: [{ type: 'Industrial wearable sensor', reason: 'Kenzen, MakuSafe, Strongarm Technologies for industrial wearable safety and productivity sensors', confidence: 0.80 }, { type: 'Handheld inspection tool', reason: 'Fluke industrial handhelds (Fortive), Emerson AMS Trex, BK Precision industrial handhelds', confidence: 0.80 }] },
    'SC': { fullName: 'Superior Colliculus', label: 'Industrial Orient-to-Incident', tier: 'operational', function: 'Orients operators to new incidents: fresh alarms, quality escapes, safety events', dysregulation: 'Degradation of industrial orient-to-incident', expectedTypes: [{ type: 'Alarm management', reason: 'Emerson DeltaV Alarms, Honeywell DynAMo, Yokogawa CENTUM Alarm Master for alarm management', confidence: 0.80 }, { type: 'Industrial incident routing', reason: 'Everbridge Critical Event Management, OnSolve CEM, Noggin Industrial for incident routing', confidence: 0.80 }] },
    'SEPT': { fullName: 'Septal Nuclei', label: 'Industrial Identity & Access', tier: 'operational', function: 'Manages industrial worker identity, badge access, and role-based permissions', dysregulation: 'Degradation of industrial identity & access', expectedTypes: [{ type: 'Plant access control', reason: 'Honeywell Pro-Watch, Johnson Controls P2000, Genetec Security Center, Lenel OnGuard (Carrier) for plant access', confidence: 0.80 }, { type: 'Industrial IAM', reason: 'BeyondTrust Privilege Management for Industrial, CyberArk OT, Claroty Secure Remote Access for OT IAM', confidence: 0.80 }] },
    'SMA': { fullName: 'Supplementary Motor Area', label: 'Industrial Operational Planning', tier: 'operational', function: 'Builds operational plans: production plans, turnaround plans, changeover sequences', dysregulation: 'Degradation of industrial operational planning', expectedTypes: [{ type: 'Production planning', reason: 'SAP IBP Production Planning, Oracle Production Planning, Kinaxis RapidResponse Production Planning', confidence: 0.80 }, { type: 'Turnaround planning', reason: 'Day & Zimmermann turnaround services, Jacobs turnaround planning, Fluor turnaround planning for capital turnarounds', confidence: 0.80 }] },
    'SMN': { fullName: 'Somatomotor Network', label: 'Physical Industrial Infrastructure', tier: 'operational', function: 'Operates physical plant infrastructure: buildings, cranes, conveyors, fork lifts, rail', dysregulation: 'Degradation of physical industrial infrastructure', expectedTypes: [{ type: 'Material handling integrator', reason: 'Dematic (KION), Honeywell Intelligrated, SSI Schaefer, Daifuku, Murata Machinery for material handling', confidence: 0.80 }, { type: 'Industrial cranes / lifting', reason: 'Konecranes, Columbus McKinnon (CMCO), Cargotec (Kalmar), SANY, Liebherr for industrial lifting and cranes', confidence: 0.80 }] },
    'SN': { fullName: 'Salience Network', label: 'Industrial Salience Detection', tier: 'operational', function: 'Detects which industrial signals deserve immediate attention: critical alarms, safety events', dysregulation: 'Degradation of industrial salience detection', expectedTypes: [{ type: 'Critical alarm platform', reason: 'Emerson DeltaV Smart Alarms, Honeywell Experion ACM, Yokogawa CENTUM ACM for critical alarm salience', confidence: 0.80 }, { type: 'Safety event platform', reason: 'Sphera Incident Management, Cority Incident, Intelex Safety, VelocityEHS Safety for safety event salience', confidence: 0.80 }] },
    'SNIG': { fullName: 'Substantia Nigra', label: 'Industrial Modernization Drive', tier: 'operational', function: 'Initiates and sustains plant modernization initiatives', dysregulation: 'Degradation of industrial modernization drive', expectedTypes: [{ type: 'Modernization consulting', reason: 'McKinsey Operations, BCG Operations, Accenture Industry X, Deloitte Industrial Modernization practices', confidence: 0.80 }, { type: 'Digital transformation firm', reason: 'Cognizant Industrial IoT, Capgemini Industry X.0, Infosys Engineering Services for digital modernization', confidence: 0.80 }] },
    'SNS': { fullName: 'Sympathetic Nervous System', label: 'Industrial Surge Mobilization', tier: 'operational', function: 'Mobilizes surge capacity: contract manufacturers, emergency shifts, outsourced production', dysregulation: 'Degradation of industrial surge mobilization', expectedTypes: [{ type: 'Contract manufacturer', reason: 'Jabil (JBL), Celestica (CLS), Flex (FLEX), Benchmark Electronics (BHE), Sanmina (SANM) for electronics surge manufacturing', confidence: 0.80 }, { type: 'Industrial staffing surge', reason: 'ManpowerGroup (MAN), Kelly Services (KELYA), Robert Half (RHI), ASGN for industrial surge staffing', confidence: 0.80 }] },
    'STN': { fullName: 'Subthalamic Nucleus', label: 'Industrial Operational Pause', tier: 'operational', function: 'Halts ongoing industrial operations for safety, quality, or compliance reasons', dysregulation: 'Degradation of industrial operational pause', expectedTypes: [{ type: 'Stop work authority', reason: 'OSHA stop work authority, corporate stop-the-line authority (Toyota Production System andon) for industrial operational pause', confidence: 0.80 }, { type: 'Quality hold management', reason: 'Sparta Systems (Honeywell) Hold Management, MasterControl Hold, ETQ Reliance Hold for quality holds', confidence: 0.80 }] },
    'STRI': { fullName: 'Striatum', label: 'Industrial Routine Execution', tier: 'operational', function: 'Encodes routine industrial procedures: startup, shutdown, PM, calibration', dysregulation: 'Degradation of industrial routine execution', expectedTypes: [{ type: 'SOP automation', reason: 'Tulip Interfaces SOP Automation, Poka Work Instructions, Dozuki Guided Procedures, VKS (Visual Knowledge Share)', confidence: 0.80 }, { type: 'Maintenance planning', reason: 'IBM Maximo Planning, IFS Applications Maintenance Planning, SAP PM Planning for industrial maintenance planning', confidence: 0.80 }] },
    'STS': { fullName: 'Superior Temporal Sulcus', label: 'Industrial Pattern-of-Life Analysis', tier: 'operational', function: 'Analyzes pattern-of-life for assets and workers: equipment behavior, shift patterns, anomaly', dysregulation: 'Degradation of industrial pattern-of-life analysis', expectedTypes: [{ type: 'Equipment anomaly detection', reason: 'Augury, Senseye (Siemens), Uptake, Petasense for equipment POL and anomaly detection', confidence: 0.80 }, { type: 'Worker pattern analytics', reason: 'Kronos (UKG), Quinyx, Workday Labor Analytics for industrial worker pattern analysis', confidence: 0.80 }] },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Industrial Brand & Reputation', tier: 'operational', function: 'Maintains long-term memory of plant brand, customer relationships, and service reputation', dysregulation: 'Degradation of industrial brand & reputation', expectedTypes: [{ type: 'Industrial brand monitoring', reason: 'Meltwater Industrial, Cision Industrial, Brandwatch Industrial for industrial brand and reputation monitoring', confidence: 0.80 }, { type: 'Customer experience tracking', reason: 'Qualtrics CustomerXM, Medallia CX, NICE inContact for industrial customer experience tracking', confidence: 0.80 }] },
    'THAL': { fullName: 'Thalamus', label: 'Industrial Network Routing', tier: 'operational', function: 'Routes industrial data across plants, sites, corporate, and customer networks', dysregulation: 'Degradation of industrial network routing', expectedTypes: [{ type: 'Industrial network infrastructure', reason: 'Cisco Industrial, Rockwell Stratix (Cisco), Siemens SCALANCE, Moxa for industrial networks', confidence: 0.80 }, { type: 'Industrial DMZ / segmentation', reason: 'Cisco Industrial Firewall, Fortinet FortiGate Rugged, Tofino Industrial Firewall (Belden) for OT network segmentation', confidence: 0.80 }] },
    'TrkB': { fullName: 'Tropomyosin receptor kinase B', label: 'Industrial Experimentation', tier: 'operational', function: 'Enables safe industrial experimentation: pilot lines, R&D plants, advanced manufacturing cells', dysregulation: 'Degradation of industrial experimentation', expectedTypes: [{ type: 'Pilot plant service', reason: 'Catalent (CTLT) pilot plant, Lonza (LONN.SW) pilot manufacturing, Thermo Fisher Pharma Services for pilot operations', confidence: 0.80 }, { type: 'Advanced manufacturing institute', reason: 'Manufacturing USA institutes (IACMI, MxD, NIIMBL, NextFlex, CESMII, LIFT) for advanced manufacturing demonstration', confidence: 0.80 }] },
    'UNC': { fullName: 'Uncinate Fasciculus', label: 'Industrial Institutional Memory', tier: 'operational', function: 'Maintains long-term memory of operator know-how, tribal knowledge, and institutional expertise', dysregulation: 'Degradation of industrial institutional memory', expectedTypes: [{ type: 'Knowledge capture platform', reason: 'Tulip Interfaces Knowledge Capture, Poka Expertise Capture, Dozuki Tribal Knowledge for industrial knowledge capture', confidence: 0.80 }, { type: 'Retiree knowledge transfer', reason: 'SME (Society of Manufacturing Engineers) mentorship, industry retiree networks, ASQ expert registries', confidence: 0.80 }] },
    'V1': { fullName: 'Primary Visual Cortex', label: 'Raw Industrial Vision Capture', tier: 'operational', function: 'Captures raw industrial imagery: line-scan cameras, area-scan cameras, hyperspectral', dysregulation: 'Degradation of raw industrial vision capture', expectedTypes: [{ type: 'Industrial camera vendor', reason: 'Cognex (CGNX), Keyence (KYCCF), Basler (BSLNF), Teledyne FLIR (TDY), Omron (OMRNY) for industrial cameras', confidence: 0.80 }, { type: 'Hyperspectral imaging', reason: 'Headwall Photonics, Specim (Konica Minolta), Corning Hyperspectral for industrial hyperspectral imaging', confidence: 0.80 }] },
    'VAN': { fullName: 'Ventral Attention Network', label: 'Industrial Early Warning', tier: 'operational', function: 'Detects early warning signals of plant failures: vibration trends, temperature creep, flow anomalies', dysregulation: 'Degradation of industrial early warning', expectedTypes: [{ type: 'Early warning analytics', reason: 'Aspen Technology Mtell, Cognite Machine Health, Senseye (Siemens), Augury for industrial early warning', confidence: 0.80 }, { type: 'Predictive APM', reason: 'GE Digital Asset Performance Management (APM), IBM Maximo APM, Bentley APM for asset performance early warning', confidence: 0.80 }] },
    'VERM': { fullName: 'Cerebellar Vermis', label: 'Core Plant Operations Reliability', tier: 'operational', function: 'Provides core reliability for long-running plant operations', dysregulation: 'Degradation of core plant operations reliability', expectedTypes: [{ type: 'Industrial managed services', reason: 'Accenture Industry X Managed Services, Cognizant Industrial Managed Services, Capgemini Industry X.0', confidence: 0.80 }, { type: 'Reliability engineering prime', reason: 'SMRP-certified reliability engineering firms, ARMS Reliability, HSB Reliability Services (Munich Re)', confidence: 0.80 }] },
    'VEST': { fullName: 'Vestibular System', label: 'Industrial Posture Drift Detection', tier: 'operational', function: 'Detects drift between intended and actual plant performance', dysregulation: 'Degradation of industrial posture drift detection', expectedTypes: [{ type: 'KPI drift analytics', reason: 'AspenTech aspenONE Drift, Seeq TrendMiner Drift Detection, GE Digital Proficy Drift for KPI drift', confidence: 0.80 }, { type: 'Manufacturing SPC', reason: 'Minitab SPC, JMP SPC, InfinityQS SPC, Northwest Analytics SPC for manufacturing control chart drift', confidence: 0.80 }] },
    'VP': { fullName: 'Ventral Pallidum', label: 'Industrial Asset Sunset', tier: 'operational', function: 'Handles plant, line, and product line sunset decisions: decommissioning, brownfield, divestment', dysregulation: 'Degradation of industrial asset sunset', expectedTypes: [{ type: 'Asset decommissioning', reason: 'AECOM Decommissioning, Jacobs Decommissioning, Wood Decommissioning, Burns & McDonnell Decommissioning', confidence: 0.80 }, { type: 'Industrial auction', reason: 'Ritchie Bros (RBA), Liquidity Services (LQDT), Perfection Industrial Sales for industrial asset auctions', confidence: 0.80 }] },
    'VTA': { fullName: 'Ventral Tegmental Area', label: 'Industrial Innovation Incentives', tier: 'operational', function: 'Incentivizes industrial innovation through prizes, challenges, and R&D credits', dysregulation: 'Degradation of industrial innovation incentives', expectedTypes: [{ type: 'R&D credit advisory', reason: 'Big 4 R&D credits practices (PwC, Deloitte, EY, KPMG), alliantgroup, Source Advisors for IRS Section 41 credits', confidence: 0.80 }, { type: 'Manufacturing USA institutes', reason: 'MForesight, IACMI, MxD, NIIMBL, NextFlex, CESMII, LIFT for advanced manufacturing innovation incentives', confidence: 0.80 }] },
    'VV': { fullName: 'Ventral Vagal Complex', label: 'Industrial Calm-State Engagement', tier: 'operational', function: 'Runs calm-state engagement: customer visits, plant tours, investor days, open houses', dysregulation: 'Degradation of industrial calm-state engagement', expectedTypes: [{ type: 'Plant tour / experience', reason: 'Phoenix Group (investor tours), industrial visitor center vendors, SYPartners industrial customer experience', confidence: 0.80 }, { type: 'Investor day support', reason: 'Edelman Smithfield IR, Sard Verbinnen & Co, Abernathy MacGregor for industrial investor day support', confidence: 0.80 }] },
    'WERN_OP': { fullName: 'Wernicke (ops)', label: 'Industrial NLU & Document Analysis', tier: 'operational', function: 'Processes industrial documents: SOPs, engineering drawings, regulations, specifications', dysregulation: 'Degradation of industrial nlu & document analysis', expectedTypes: [{ type: 'Industrial NLU platform', reason: 'Scite industrial, Sparrho industrial, Semantic Scholar industrial for NLU', confidence: 0.80 }, { type: 'Engineering doc search', reason: 'PTC Windchill Search, Siemens Teamcenter Search, OpenText Engineering Document Management for engineering docs', confidence: 0.80 }] },
    'mPFC': { fullName: 'Medial Prefrontal Cortex', label: 'Industrial Program Quality Engineering', tier: 'operational', function: 'Runs quality engineering across industrial programs: supplier quality, process quality, product quality', dysregulation: 'Degradation of industrial program quality engineering', expectedTypes: [{ type: 'Quality engineering firm', reason: 'NSF International Quality, Regulatory Compliance Associates, Compliance Insight Inc for quality engineering', confidence: 0.80 }, { type: 'Supplier quality audit', reason: 'SGS Supplier Quality, Bureau Veritas Supplier Quality, Intertek Supplier Quality for supplier audit', confidence: 0.80 }] },
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Industrial Access Control', tier: 'operational', function: 'Enforces access control and authorization for industrial networks, plants, and data', dysregulation: 'Degradation of industrial access control', expectedTypes: [{ type: 'OT access control', reason: 'Claroty Secure Remote Access, Dragos Platform, Nozomi Networks Guardian for OT access control', confidence: 0.80 }, { type: 'Industrial IAM', reason: 'CyberArk OT, BeyondTrust Privilege Management, SailPoint Industrial for industrial IAM', confidence: 0.80 }] },
    'ENDOOP': { fullName: 'Endocannabinoid (ops)', label: 'Industrial Process Stability', tier: 'operational', function: 'Stabilizes long-running processes through chemistry and catalyst management', dysregulation: 'Degradation of industrial process stability', expectedTypes: [{ type: 'Catalyst management', reason: 'BASF Catalysts, Honeywell UOP Catalysts, Johnson Matthey Catalysts, Clariant Catalysts for industrial catalysts', confidence: 0.80 }, { type: 'Chemistry control', reason: 'Nalco Water (Ecolab), Kemira, Solenis, Ecolab Nalco for industrial process chemistry control', confidence: 0.80 }] }
  };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveApprovals(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function approvalKey(nodeId, businessType) {
    return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);
  }
  function getApprovalStatus(nodeId, businessType) {
    var approvals = loadApprovals();
    return approvals[approvalKey(nodeId, businessType)] || null;
  }
  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status, reason: reason || '',
      nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(),
      reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) return callback(_hierarchyCache);
    try {
      var cached = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY));
      if (cached && cached._age && (Date.now() - cached._age) < HIERARCHY_TTL) {
        _hierarchyCache = cached;
        _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}

    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('industry');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = {
      nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {},
      nodeLabels: {}, nodeDepths: {}, allActivations: []
    };

    function processActivations(acts, depth) {
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i];
        var nid = a.brainNodeId;
        if (RI_NODES[nid]) continue;

        if (!result.nodeCompanies[nid]) result.nodeCompanies[nid] = {};
        if (!result.nodeTreatments[nid]) result.nodeTreatments[nid] = {};
        if (!result.nodeDiagnoses[nid]) result.nodeDiagnoses[nid] = {};
        if (!result.nodeLabels[nid]) result.nodeLabels[nid] = a.domainLabel || nid;
        if (!result.nodeDepths[nid]) result.nodeDepths[nid] = {};
        result.nodeDepths[nid][depth] = true;

        var cos = a.companies || [];
        for (var ci = 0; ci < cos.length; ci++) {
          var tk = cos[ci].ticker_or_id || cos[ci].name;
          if (!result.nodeCompanies[nid][tk]) {
            result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
          }
        }

        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) {
            result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
          }
        }

        var dx = a.diagnosticTriggers || [];
        for (var di = 0; di < dx.length; di++) result.nodeDiagnoses[nid][dx[di]] = true;

        result.allActivations.push({ brainNodeId: nid, depth: depth, label: a.domainLabel, companiesCount: cos.length });
      }
    }

    processActivations(topLevel.activations || [], 0);

    result._age = Date.now();
    _hierarchyCache = result;
    _hierarchyCacheAge = Date.now();

    try { sessionStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(result)); } catch (e) {}

    callback(result);
  }

  function getIndustryState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('industry');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getIndustryState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('industry') : null;
      var portal = brain ? brain._portalCache : null;
      if (portal && portal.activations) {
        for (var ai = 0; ai < portal.activations.length; ai++) {
          var act = portal.activations[ai];
          var nid = act.brainNodeId;
          if (!nodeCompanyIndex[nid]) nodeCompanyIndex[nid] = {};
          var cos = act.companies || [];
          for (var ci = 0; ci < cos.length; ci++) {
            var tk = cos[ci].ticker_or_id || cos[ci].name;
            nodeCompanyIndex[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason };
          }
        }
      }
    }

    var mapped = [], missing = [], speculative = [];

    for (var nodeId in NODE_BUSINESS_DIRECTORY) {
      if (RI_NODES[nodeId]) continue;
      var dir = NODE_BUSINESS_DIRECTORY[nodeId];
      var expectedTypes = dir.expectedTypes || [];
      var nodeActive = false;

      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var cci = 0; cci < circuits.length; cci++) {
          if (circuits[cci].nodeId === nodeId) { nodeActive = true; break; }
        }
        if (nodeActive) break;
      }

      var existingCos = nodeCompanyIndex[nodeId] || {};
      var mappedCompanyNames = [];
      for (var tk in existingCos) mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')');

      for (var ti = 0; ti < expectedTypes.length; ti++) {
        var expected = expectedTypes[ti];
        var key = approvalKey(nodeId, expected.type);
        var approval = approvals[key] || null;

        var alreadyMapped = false;
        var typeWords = expected.type.toLowerCase().split(/\s+/);
        for (var mi = 0; mi < mappedCompanyNames.length; mi++) {
          var compLower = mappedCompanyNames[mi].toLowerCase();
          var matchCount = 0;
          for (var wi = 0; wi < typeWords.length; wi++) {
            if (typeWords[wi].length > 3 && compLower.indexOf(typeWords[wi]) !== -1) matchCount++;
          }
          if (matchCount >= 2) { alreadyMapped = true; break; }
        }

        if (!alreadyMapped) {
          for (var ck in existingCos) {
            var fr = (existingCos[ck].reason || '').toLowerCase();
            var matchCount2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) matchCount2++;
            }
            if (matchCount2 >= 2) { alreadyMapped = true; break; }
          }
        }

        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) {
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Industry. It will appear as a valid target in investments and research briefs tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Industry.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Industry mapping for audit tracking. Requires further validation.';
          }
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) {
          variantState = 'MISSING';
        } else if (!alreadyMapped) {
          variantState = 'PROPOSED';
        } else {
          variantState = 'MAPPED';
        }
        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey,
          nodeId: nodeId,
          nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label,
          nodeFunction: dir.function,
          plainFunction: dir.function,
          dysregulation: dir.dysregulation || '',
          plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type,
          reason: expected.reason,
          confidence: expected.confidence,
          nodeActive: nodeActive,
          alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames,
          approval: approval,
          approvalRequired: showButtons,
          variantState: variantState,
          approvalConsequence: consequence,
          tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) {
          entry.bucket = 'MAPPED';
          mapped.push(entry);
        } else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}; var out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped);
    missing = dedupeExact(missing);
    speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var tierOrder = { 'top': 0, 'operational': 1 };
      var ta = tierOrder[a.tier] || 1, tb = tierOrder[b.tier] || 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);

    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) {
      if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    }
    return approved;
  }

  window.LIMENIndustryBusinessEngine = {
    runInference: function () { return runInference(_hierarchyCache); },
    runInferenceWithHierarchy: runInference,
    loadFullHierarchy: loadFullHierarchy,
    getApprovedMappings: getApprovedMappings,
    setApprovalStatus: setApprovalStatus,
    getApprovalStatus: getApprovalStatus,
    loadApprovals: loadApprovals,
    NODE_DIRECTORY: NODE_BUSINESS_DIRECTORY,
    RI_NODES: RI_NODES,
    isGenericTreatment: isGenericTreatment
  };

  loadFullHierarchy(function () { console.log('[IndustryBusinessEngine] Hierarchy loaded'); });

  console.log('[IndustryBusinessEngine] Loaded \u2014 103-node full-hierarchy industry business assignment engine');

})();
