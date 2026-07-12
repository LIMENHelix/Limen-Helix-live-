/**
 * environment-node-business-engine.js — Environment Node-to-Business Assignment Engine
 *
 * ENVIRONMENT / RESEARCH DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (matches the locked-domain standard):
 *   - Recursively traverses ALL child portal JSONs (depth 0-5, ~18,200 files)
 *   - Covers full 103 operational nodes (19 ENVIRONMENT-TOP + 84 ENVIRONMENT-OPERATIONAL)
 *   - Excludes the same 20 RI / framework nodes as the locked domains
 *   - Filters generic template treatments before inference
 *
 * Outputs 3 buckets:
 *   MAPPED     - already mapped and active in Environment system
 *   MISSING    - plausible but missing from current Environment mappings
 *   SPECULATIVE - low-confidence or novel suggestions
 *
 * Approval statuses: PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_environment_business_approvals')
 *
 * Self-gates: only runs when ?domain=environment or ?domain=research
 * Exposes: window.LIMENEnvironmentBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'environment' && _dom !== 'research') return;

  var STORAGE_KEY = 'limen_environment_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_environment_hierarchy_cache';
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
  // 19 ENVIRONMENT-TOP (full neuroTranslation) + 84 ENVIRONMENT-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── ENVIRONMENT-TOP NODES (19) ──
    'DMN': {
      fullName: 'Default Mode Network', label: 'Environmental Scenario Imagination', tier: 'top',
      neuroTranslation: { inNeurology: 'Active during internally-directed thought, mental simulation, long-horizon planning, and counterfactual reasoning.', inBusiness: 'In environment, scenario imagination is the work of imagining long-range climate, ecosystem, and pollution futures that cannot be observed directly — the foundation of climate modeling, IAM scenarios, and adaptation planning.' },
      function: 'Generates long-range environmental scenarios, climate futures, and adaptation pathways under deep uncertainty',
      dysregulation: 'Failure of imagination, anchoring on recent past, ignoring tail risk and tipping-point cascades',
      expectedTypes: [
        { type: 'Climate scenario modeling service', reason: 'RCM / IAM modeling (Climate Analytics, Rhodium Group Climate Impact Lab, Woodwell Climate Research Center) for sovereign and corporate scenario work', confidence: 0.9 },
        { type: 'Integrated assessment model (IAM) provider', reason: 'GCAM, REMIND, MESSAGE-GLOBIOM teams at PNNL, PIK Potsdam, IIASA for IPCC-grade integrated assessment', confidence: 0.88 },
        { type: 'Catastrophe risk modeling vendor', reason: 'Moody’s RMS, Verisk AIR Worldwide, Karen Clark & Company, CoreLogic for physical climate and catastrophe risk', confidence: 0.92 },
        { type: 'Adaptation planning consultancy', reason: 'Jacobs, AECOM, Stantec climate adaptation practices for city, state, port, and utility long-range plans', confidence: 0.85 },
        { type: 'Earth-system research institute', reason: 'Woods Hole Research Center, NCAR, Max Planck Institute for Meteorology for fundamental climate dynamics research', confidence: 0.78 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Environmental Strategic Planning', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates working memory, planning, and goal-directed reasoning across abstract objectives.', inBusiness: 'In environment, strategic planning is the work of national and sub-national environmental strategy, long-range decarbonization roadmaps, and multi-stakeholder resilience planning.' },
      function: 'Develops long-range environmental strategy, NDC planning, and decarbonization roadmaps',
      dysregulation: 'Strategic drift, plan-execution gap, misaligned targets, sunset policies stranded assets',
      expectedTypes: [
        { type: 'Climate strategy consultancy', reason: 'McKinsey Sustainability, BCG Climate & Sustainability, Bain Sustainability Practice, Boston Consulting Group Climate', confidence: 0.92 },
        { type: 'NDC / LT-LEDS modeling team', reason: 'World Resources Institute (WRI), Climate Analytics, NewClimate Institute for sovereign Paris Agreement compliance', confidence: 0.88 },
        { type: 'Corporate net-zero advisory', reason: 'SBTi, ERM, PwC Sustainability, Deloitte Climate & Sustainability for corporate science-based targets', confidence: 0.9 },
        { type: 'Energy transition research', reason: 'Rocky Mountain Institute, IEA, BloombergNEF, Wood Mackenzie for transition pathway analysis', confidence: 0.85 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Environmental Compliance & Enforcement', tier: 'top',
      neuroTranslation: { inNeurology: 'Monitors performance and detects conflicts or errors between expected and actual outcomes.', inBusiness: 'In environment, compliance and enforcement is the work of auditing, inspecting, and disciplining polluters, habitat destroyers, and regulatory violators through EPA, state environmental agencies, and international bodies.' },
      function: 'Audits environmental compliance, enforces EPA and state rules, tracks violators and penalties',
      dysregulation: 'Enforcement gaps, captured regulators, uninspected sites, unpaid penalties',
      expectedTypes: [
        { type: 'Environmental compliance auditing firm', reason: 'ERM, Bureau Veritas, SGS, Intertek for ISO 14001 and corporate environmental audits', confidence: 0.92 },
        { type: 'EPA enforcement support contractor', reason: 'Tetra Tech, ICF, Abt Associates, Eastern Research Group for EPA OECA and Superfund enforcement support', confidence: 0.88 },
        { type: 'EHS compliance software vendor', reason: 'Sphera, Cority, Enablon (Wolters Kluwer), Intelex, VelocityEHS for industrial EHS compliance', confidence: 0.9 },
        { type: 'Emissions MRV platform', reason: 'Persefoni, Watershed, Normative, Sweep, Salesforce Net Zero Cloud for corporate Scope 1/2/3 MRV', confidence: 0.85 },
        { type: 'Pollution attribution service', reason: 'Climate TRACE, Carbon Plan, Clean Air Task Force for facility-level emissions attribution', confidence: 0.82 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Environmental Data Integration', tier: 'top',
      neuroTranslation: { inNeurology: 'Dynamically allocates cognitive resources and switches between analysis tasks.', inBusiness: 'In environment, data integration is the work of combining satellite imagery, in-situ sensors, weather stations, ocean buoys, and socioeconomic data into coherent operational pictures.' },
      function: 'Integrates multi-source environmental data: satellite, sensor, model, and citizen-science streams',
      dysregulation: 'Data silos, incompatible formats, missing metadata, failed fusion',
      expectedTypes: [
        { type: 'Earth observation data platform', reason: 'Google Earth Engine, ESRI ArcGIS Online, Planet Labs Analytics, Descartes Labs (EarthDaily) for multi-source integration', confidence: 0.92 },
        { type: 'Environmental IoT / sensor network', reason: 'Libelium, Aclima, Clarity Movement, QuantAQ for distributed environmental sensing', confidence: 0.85 },
        { type: 'Climate data platform', reason: 'Climavision, The Climate Service (S&P), Kayrros, ClimateAi for integrated climate datasets', confidence: 0.88 },
        { type: 'Geospatial analytics firm', reason: 'ESRI, Hexagon, Trimble, Bentley Systems for geospatial environmental analytics', confidence: 0.9 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Environmental Field Operations', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage where planned actions become physical execution.', inBusiness: 'In environment, field operations is the physical work of environmental remediation, habitat restoration, sampling, monitoring, and emergency spill response.' },
      function: 'Executes physical environmental operations: remediation, restoration, sampling, spill response',
      dysregulation: 'Field crew shortages, sample contamination, chain of custody failures, safety incidents',
      expectedTypes: [
        { type: 'Environmental remediation prime', reason: 'Clean Harbors, Republic Services / US Ecology, Waste Management (Phoenix Services), Veolia North America for hazardous cleanup', confidence: 0.95 },
        { type: 'Habitat restoration contractor', reason: 'Ducks Unlimited restoration services, Environmental Restoration LLC, ERM Restoration Services for wetland and riparian work', confidence: 0.85 },
        { type: 'Emergency spill response', reason: 'Clean Harbors CleanCo, NRC / USES, Marine Spill Response Corporation (MSRC) for marine and inland spill response', confidence: 0.92 },
        { type: 'Environmental sampling / labs', reason: 'Eurofins Environment Testing, Pace Analytical, ALS Environmental, TestAmerica for regulated environmental lab analysis', confidence: 0.9 },
        { type: 'Industrial cleaning / decon', reason: 'Safety-Kleen, Philip Services, Hepaco, PeroxyChem for industrial decontamination', confidence: 0.82 }
      ]
    },
    'BROCA': {
      fullName: 'Broca’s Area', label: 'Environmental Reporting & Disclosure', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured language and grammatical output.', inBusiness: 'In environment, reporting and disclosure produces structured corporate and sovereign environmental reports: TCFD, TNFD, CSRD, SEC climate disclosure, CDP, SBTi, IPCC author reports.' },
      function: 'Produces structured environmental disclosure: TCFD, TNFD, CSRD, CDP, IPCC, IPBES reports',
      dysregulation: 'Greenwashing, incomplete Scope 3, unverified claims, disclosure fatigue',
      expectedTypes: [
        { type: 'Sustainability reporting platform', reason: 'Workiva ESG, Sphera Sustainability, Diligent ESG, Novata, Nasdaq Metrio for structured ESG reporting', confidence: 0.92 },
        { type: 'Climate disclosure auditor', reason: 'Big 4 (Deloitte, EY, KPMG, PwC) sustainability assurance, ERM CVS for TCFD and CSRD assurance', confidence: 0.9 },
        { type: 'GHG inventory provider', reason: 'Persefoni, Watershed, Normative, Sweep, Plan A, Sinai Technologies for Scope 1-2-3 inventories', confidence: 0.88 },
        { type: 'CDP response consultancy', reason: 'South Pole, ClimatePartner, Anthesis, 3Degrees, First Climate for CDP and TCFD response drafting', confidence: 0.85 },
        { type: 'Sustainability-linked finance advisory', reason: 'Mizuho, MUFG, BNP Paribas sustainability teams for sustainability-linked loans and bonds', confidence: 0.82 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Environmental Knowledge Integration', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates semantic information across domains, supporting conceptual reasoning and analogical thought.', inBusiness: 'In environment, knowledge integration is the work of connecting climate science, biodiversity science, pollution data, and socioeconomic analysis into global assessments: IPCC, IPBES, UNEP, GEO.' },
      function: 'Integrates environmental knowledge into global assessments and synthesis reports',
      dysregulation: 'Stovepiped disciplines, missed cross-cutting signals, slow synthesis cycles',
      expectedTypes: [
        { type: 'Global assessment body (member services)', reason: 'IPCC Working Groups I/II/III, IPBES assessments, UNEP Global Environment Outlook for multi-decade synthesis', confidence: 0.92 },
        { type: 'Environmental knowledge graph platform', reason: 'Global Biodiversity Information Facility (GBIF), iNaturalist, OBIS, CMIP data portals for federated environmental data', confidence: 0.85 },
        { type: 'Bibliometric / evidence synthesis', reason: 'Elsevier Scopus Environmental, Clarivate Web of Science Environmental Science, Dimensions, OpenAlex for environmental literature indexing', confidence: 0.82 },
        { type: 'Systematic review platform', reason: 'Covidence, Rayyan, DistillerSR, Collaboration for Environmental Evidence for systematic reviews in environmental science', confidence: 0.78 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Climate & Environmental Finance', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates emotional valuation with long-term consequence assessment for value-based decision-making.', inBusiness: 'In environment, climate and environmental finance is the work of allocating capital to mitigation, adaptation, and nature-based solutions through green bonds, transition finance, blended finance, and carbon markets.' },
      function: 'Allocates and underwrites climate and nature finance through green bonds, transition finance, and carbon markets',
      dysregulation: 'Greenwashing, stranded asset risk, capital misallocation, blended finance failures',
      expectedTypes: [
        { type: 'Climate fund / green bank', reason: 'Green Climate Fund (GCF), Climate Investment Funds (CIF), Breakthrough Energy, TPG Rise Climate, Brookfield Global Transition Fund', confidence: 0.92 },
        { type: 'Green bond / sustainability-linked bond desk', reason: 'HSBC, BNP Paribas, MUFG, Mizuho sustainable finance desks for green and sustainability-linked debt', confidence: 0.88 },
        { type: 'Carbon market infrastructure', reason: 'Verra Verified Carbon Standard, Gold Standard, ART TREES, ICROA-accredited registries for voluntary credits; Xpansiv CBL for exchange', confidence: 0.85 },
        { type: 'Transition finance advisory', reason: 'Pollination, South Pole, EcoAct, Anthesis for corporate transition finance structuring', confidence: 0.82 },
        { type: 'Climate insurance / cat bond', reason: 'Munich Re, Swiss Re, RenaissanceRe, Everest Group, Hannover Re for parametric and indemnity climate insurance', confidence: 0.9 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Long-Term Environmental Baseline & Monitoring', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes new memories and consolidates short-term to long-term storage.', inBusiness: 'In environment, long-term monitoring consolidates short-duration observations into baselines that span decades — essential for detecting trends in climate, biodiversity, and pollution.' },
      function: 'Maintains long-term environmental baselines: weather, biodiversity, water quality, ice cores, tree rings',
      dysregulation: 'Baseline gaps, lost historical records, discontinued monitoring programs, data format rot',
      expectedTypes: [
        { type: 'Climate baseline data archive', reason: 'NOAA NCEI, NASA GISTEMP, Hadley Centre HadCRUT, Berkeley Earth for global temperature baselines', confidence: 0.92 },
        { type: 'Biodiversity monitoring network', reason: 'Christmas Bird Count, Breeding Bird Survey, GBIF, LTER (Long Term Ecological Research) sites for multi-decade biodiversity data', confidence: 0.88 },
        { type: 'Water quality baseline program', reason: 'USGS National Water Quality Assessment (NAWQA), EPA Water Quality Portal, NIWQN for long-term water baselines', confidence: 0.85 },
        { type: 'Ice core / paleoclimate archive', reason: 'WAIS Divide, EPICA, GISP2, NEEM ice core programs for paleoclimate baselines', confidence: 0.78 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Environmental Scenario Analysis', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates goal-directed attention and cognitive resource allocation for inference.', inBusiness: 'In environment, scenario analysis runs quantitative and qualitative forecasts across emissions pathways, warming outcomes, ecosystem responses, and policy interventions.' },
      function: 'Runs quantitative environmental scenarios for emissions, warming, ecosystem, and policy outcomes',
      dysregulation: 'Overconfident point estimates, ignored uncertainty, scenario anchoring',
      expectedTypes: [
        { type: 'Climate scenario analytics', reason: 'BlackRock Aladdin Climate, MSCI Climate, S&P Trucost, Moody’s RMS, Verisk Maplecroft for portfolio climate analytics', confidence: 0.92 },
        { type: 'Physical climate risk analytics', reason: 'First Street Foundation, Jupiter Intelligence, Climate X, Cervest for physical risk at asset level', confidence: 0.9 },
        { type: 'Transition risk analytics', reason: 'Trucost (S&P), ISS ESG, Sustainalytics (Morningstar), MSCI ESG for transition risk scoring', confidence: 0.88 },
        { type: 'Catastrophe model vendor', reason: 'Verisk AIR Worldwide, Moody’s RMS, CoreLogic, Karen Clark for cat bonds and reinsurance', confidence: 0.85 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Earth System & Climate Modeling', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports self-referential thought, mental imagery, and abstract spatial reasoning.', inBusiness: 'In environment, earth system modeling uses first-principles physics, chemistry, and biology to simulate the coupled atmosphere-ocean-land system.' },
      function: 'Runs coupled earth system models and global circulation models for climate projection',
      dysregulation: 'Resolution limits, parameterization error, model divergence, compute bottlenecks',
      expectedTypes: [
        { type: 'Earth system model development team', reason: 'NCAR CESM, NASA GISS ModelE, GFDL CM4, NOAA GFDL, Hadley Centre HadGEM for coupled Earth system models', confidence: 0.92 },
        { type: 'HPC compute provider for climate', reason: 'NVIDIA Earth-2, DOE Oak Ridge / Argonne / LBNL supercomputers, AWS / Azure / GCP cloud HPC for climate', confidence: 0.88 },
        { type: 'AI-for-climate model vendor', reason: 'NVIDIA FourCastNet, Google GraphCast, DeepMind GenCast, Microsoft Aurora, ECMWF AIFS for AI weather/climate', confidence: 0.9 },
        { type: 'Regional climate downscaling', reason: 'CORDEX regional climate, Climavision dynamical downscaling, NOAA / NASA high-resolution atmospheric models', confidence: 0.82 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Ecosystem & Biodiversity Science', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates homeostatic functions and integrates physiological signals across body systems.', inBusiness: 'In environment, ecosystem and biodiversity science investigates the integrated functioning of species, communities, and habitats that maintain Earth’s biosphere homeostasis.' },
      function: 'Researches ecosystem function, biodiversity, species ecology, and habitat dynamics',
      dysregulation: 'Species declines, food web disruption, ecosystem collapse, trophic cascade',
      expectedTypes: [
        { type: 'Ecological research institute', reason: 'Smithsonian SERC, Organization for Tropical Studies (OTS), NEON (National Ecological Observatory Network), Woods Hole MBL', confidence: 0.9 },
        { type: 'Biodiversity monitoring vendor', reason: 'NatureMetrics eDNA, SimplexDNA, Kenyon Environmental, Carbon Mapper for biodiversity sensing', confidence: 0.88 },
        { type: 'Wildlife tracking / telemetry', reason: 'Vectronic Aerospace, Lotek Wireless, Telonics, ICARUS Initiative for wildlife telemetry', confidence: 0.82 },
        { type: 'Ecological restoration consultancy', reason: 'Environmental Restoration LLC, Stantec ecology, Tetra Tech ecology for habitat restoration design', confidence: 0.85 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Environmental Chemistry & Toxicology', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates subjective value of options and updates expectations as outcomes change.', inBusiness: 'In environment, environmental chemistry analyzes how pollutants, nutrients, and natural compounds move through air, water, soil, and living tissue.' },
      function: 'Researches environmental chemistry, pollution transport, fate & transport, and toxicology',
      dysregulation: 'Unknown breakdown products, untested chemicals of concern, bioaccumulation gaps',
      expectedTypes: [
        { type: 'Environmental analytical lab', reason: 'Eurofins Environment Testing, Pace Analytical, ALS Environmental, TestAmerica for regulated chemical analysis', confidence: 0.92 },
        { type: 'PFAS / emerging contaminant testing', reason: 'Battelle PFAS lab, Alpha Analytical, SGS AXYS, Vista Analytical for emerging contaminant analysis', confidence: 0.9 },
        { type: 'Air emissions monitoring (CEMS)', reason: 'Thermo Fisher Environmental, Horiba, Teledyne API, Sick Maihak for continuous emissions monitoring', confidence: 0.88 },
        { type: 'Toxicology / ecotox consultancy', reason: 'Exponent, Integrated Laboratory Systems (ILS), Ramboll toxicology for ecological risk assessment', confidence: 0.85 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Environmental Risk Quantification', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports numerical cognition, spatial reasoning, and quantity representation.', inBusiness: 'In environment, risk quantification develops the mathematical models, statistical methods, and monetary loss estimates for physical and transition climate risk.' },
      function: 'Quantifies environmental risk: monetary loss, probability, exposure, vulnerability, adaptation benefit',
      dysregulation: 'Model uncertainty, data gaps, unpriced externalities, spurious precision',
      expectedTypes: [
        { type: 'Climate risk modeling platform', reason: 'Moody’s RMS Climate, Verisk AIR Worldwide Climate, Jupiter Intelligence, First Street Foundation, Climate X', confidence: 0.92 },
        { type: 'Transition risk analytics', reason: 'Trucost (S&P), MSCI Climate Value-at-Risk, ISS ESG, Sustainalytics transition risk models', confidence: 0.88 },
        { type: 'Catastrophe modeling vendor', reason: 'Verisk AIR, Moody’s RMS, CoreLogic, Karen Clark & Company for (re)insurance cat modeling', confidence: 0.9 },
        { type: 'Environmental economics firm', reason: 'Resources for the Future (RFF), Environmental Defense Fund Economics, IEc, Abt Associates for cost-benefit analysis', confidence: 0.82 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Environmental Sensor Networks', tier: 'top',
      neuroTranslation: { inNeurology: 'Routes visceral sensory input from the body to higher brain regions.', inBusiness: 'In environment, sensor networks route continuous environmental data from satellites, ground stations, buoys, and IoT sensors to processing systems.' },
      function: 'Operates environmental sensor networks: satellite, ground station, buoy, IoT',
      dysregulation: 'Sensor coverage gaps, telemetry dropouts, sensor drift, failed calibration',
      expectedTypes: [
        { type: 'Earth observation satellite operator', reason: 'NASA Landsat / MODIS / VIIRS, ESA Sentinel (Copernicus), Planet Labs, Maxar, BlackSky, ICEYE, Capella Space', confidence: 0.95 },
        { type: 'Ground-based sensor network', reason: 'NOAA NEXRAD, EPA AirNow, USGS WaterWatch, National Weather Service ASOS for operational ground networks', confidence: 0.9 },
        { type: 'Ocean observation network', reason: 'NOAA NDBC buoys, Argo floats, OOI (Ocean Observatories Initiative), IOOS for ocean sensor networks', confidence: 0.88 },
        { type: 'IoT environmental sensing', reason: 'Aclima mobile, Clarity Movement, QuantAQ, Kunak, Breeze Technologies for distributed air quality sensing', confidence: 0.82 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Environmental Justice & Social Impact', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multimodal sensory input and supports theory of mind and social cognition.', inBusiness: 'In environment, justice and social impact analyzes how environmental burdens fall unequally across communities, and designs interventions to reduce that inequity.' },
      function: 'Analyzes environmental justice, fenceline exposure, just transition, and community impact',
      dysregulation: 'Fenceline exposure, disproportionate burden, ignored community voice, NEPA evasion',
      expectedTypes: [
        { type: 'Environmental justice analytics platform', reason: 'EPA EJScreen, CDC Environmental Justice Index, CalEnviroScreen, Climate and Economic Justice Screening Tool (CEJST)', confidence: 0.92 },
        { type: 'Community air monitoring network', reason: 'Aclima community partnerships, Clarity community networks, Environmental Defense Fund community monitoring', confidence: 0.85 },
        { type: 'Environmental justice consultancy', reason: 'Eastern Research Group (ERG), Abt Associates, ICF Environmental Justice, Bloomberg Philanthropies EJ grantees', confidence: 0.82 },
        { type: 'Just transition advisory', reason: 'Just Transition Alliance, Labor Network for Sustainability, Climate Justice Alliance as references for community-led work', confidence: 0.78 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate Cortex', label: 'Environmental Ethics & NEPA Review', tier: 'top',
      neuroTranslation: { inNeurology: 'Engages in self-monitoring, moral reasoning, and emotional evaluation.', inBusiness: 'In environment, ethics review spans NEPA environmental impact statements, ESA Section 7 consultations, Superfund community meetings, and Endangered Species Act enforcement.' },
      function: 'Conducts NEPA environmental review, ESA Section 7 consultation, Superfund community process',
      dysregulation: 'NEPA evasion, categorical exclusions abused, incomplete ESA consultations',
      expectedTypes: [
        { type: 'NEPA / EIS consulting firm', reason: 'Tetra Tech NEPA practice, AECOM NEPA, Stantec NEPA, ICF NEPA, ERM NEPA for federal environmental impact statements', confidence: 0.92 },
        { type: 'ESA Section 7 consultation firm', reason: 'Cardno (Stantec), SWCA Environmental, WEST Inc, Biological Consulting Services for ESA Section 7 consultations', confidence: 0.88 },
        { type: 'Superfund community involvement', reason: 'Eastern Research Group, ICF, Abt Associates for EPA community involvement plans', confidence: 0.85 },
        { type: 'Environmental litigation support', reason: 'Exponent environmental, Ramboll expert witness, Environmental Defense Fund legal, Earthjustice as references', confidence: 0.82 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke’s Area', label: 'Environmental Computing & AI', tier: 'top',
      neuroTranslation: { inNeurology: 'Comprehends language and extracts meaning from symbolic input.', inBusiness: 'In environment, environmental computing develops AI, cloud HPC, and data infrastructure that powers climate modeling, remote sensing analytics, and operational forecasting.' },
      function: 'Develops environmental AI, cloud HPC, and data infrastructure for climate and ecological science',
      dysregulation: 'Compute bottlenecks, AI hallucination, model drift, proprietary lock-in',
      expectedTypes: [
        { type: 'AI-for-climate research team', reason: 'NVIDIA Earth-2, Google DeepMind GraphCast / GenCast, Microsoft Aurora, ECMWF AIFS, Climate Change AI community', confidence: 0.92 },
        { type: 'Environmental cloud platform', reason: 'AWS Open Data, Google Earth Engine, Microsoft Planetary Computer, Descartes Labs (EarthDaily) for environmental cloud compute', confidence: 0.9 },
        { type: 'HPC compute for climate', reason: 'NVIDIA Earth-2, DOE Oak Ridge Summit / Frontier, Argonne Aurora, NCAR Derecho, ECMWF Atos for operational climate HPC', confidence: 0.88 },
        { type: 'Environmental ML platform', reason: 'Google Vertex AI, AWS SageMaker, Databricks ML, Weights & Biases with environmental data partnerships', confidence: 0.82 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Green Workforce & Environmental Labor', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays auditory information from cochlea to auditory cortex; gateway for perception.', inBusiness: 'In environment, the green workforce pipeline relays trained environmental scientists, engineers, and tradespeople from training programs into climate, ecology, and pollution-control jobs.' },
      function: 'Recruits, trains, and retains the green workforce: environmental scientists, engineers, tradespeople',
      dysregulation: 'Workforce gaps, training mismatch, certification bottlenecks, aging practitioner base',
      expectedTypes: [
        { type: 'Environmental recruiting agency', reason: 'GreenBiz Jobs, Clean Energy Group, Environmental Career Center, Sustainable Staffing for environmental roles', confidence: 0.85 },
        { type: 'Green workforce training program', reason: 'Interstate Renewable Energy Council (IREC), North American Board of Certified Energy Practitioners (NABCEP), SolarAPP+', confidence: 0.88 },
        { type: 'Environmental certification body', reason: 'LEED (USGBC), BREEAM, ENERGY STAR, WELL Building Standard, SITES for practitioner certification', confidence: 0.85 },
        { type: 'Apprenticeship / trades program', reason: 'IBEW / NECA renewable apprenticeships, IUPAT environmental coatings training, LIUNA environmental remediation trades', confidence: 0.78 }
      ]
    },

    // ── ENVIRONMENT-OPERATIONAL NODES (84) ──
    'A1': { fullName: 'Primary Auditory Cortex', label: 'Environmental Alerting & Notification', tier: 'operational', function: 'Broadcasts severe weather, hazardous spill, air quality alerts to the public and operators', dysregulation: 'Degradation of environmental alerting & notification', expectedTypes: [{ type: 'NOAA Weather Radio / EAS', reason: 'NOAA NWR, NWS Severe Weather Alerts, FEMA Integrated Public Alert and Warning System (IPAWS)', confidence: 0.80 }, { type: 'Air quality alert vendor', reason: 'EPA AirNow, Plume Labs (AccuWeather), BreezoMeter (Google) for public air quality alerts', confidence: 0.80 }] },
    'ADR': { fullName: 'Adrenal', label: 'Environmental Emergency Mobilization', tier: 'operational', function: 'Mobilizes emergency response for spills, natural disasters, and environmental emergencies', dysregulation: 'Degradation of environmental emergency mobilization', expectedTypes: [{ type: 'Emergency spill response', reason: 'Clean Harbors CleanCo, NRC / USES, Marine Spill Response Corp (MSRC) for rapid spill response', confidence: 0.80 }, { type: 'Disaster recovery contractor', reason: 'AECOM Disaster Recovery, IEM, BELFOR Environmental for FEMA and state disaster response', confidence: 0.80 }] },
    'AI': { fullName: 'Anterior Insula', label: 'Environmental Risk Triage', tier: 'operational', function: 'Triages environmental risks: spills, exposures, climate events, biodiversity threats', dysregulation: 'Degradation of environmental risk triage', expectedTypes: [{ type: 'Climate risk triage platform', reason: 'Jupiter Intelligence, First Street Foundation, Climate X for physical climate risk scoring', confidence: 0.80 }, { type: 'Environmental incident triage', reason: 'IsoMetrix, Intelex, Cority incident management for industrial environmental triage', confidence: 0.80 }] },
    'ANT': { fullName: 'Anterior Thalamus', label: 'Operational Forecast Routing', tier: 'operational', function: 'Routes weather, air quality, and ecological forecasts to operators and emergency managers', dysregulation: 'Degradation of operational forecast routing', expectedTypes: [{ type: 'Weather forecast provider', reason: 'DTN, The Weather Company (IBM), AccuWeather Commercial, Baron Weather for operational weather', confidence: 0.80 }, { type: 'Operational forecast platform', reason: 'Climavision, ClimateAi, Jupiter Intelligence for climate-operational forecasting', confidence: 0.80 }] },
    'ARC': { fullName: 'Arcuate Fasciculus', label: 'Environmental Translation & Interpretation', tier: 'operational', function: 'Translates technical environmental data into operational actions and public communication', dysregulation: 'Degradation of environmental translation & interpretation', expectedTypes: [{ type: 'Climate communication firm', reason: 'Climate Central, Yale Program on Climate Change Communication, Climate Nexus as references', confidence: 0.80 }, { type: 'Environmental translation service', reason: 'Climate Desk (Grist / Mother Jones / The Atlantic), Inside Climate News for science translation', confidence: 0.80 }] },
    'BDNF': { fullName: 'BDNF / Plasticity', label: 'Environmental Innovation & Pilot Deployment', tier: 'operational', function: 'Develops new environmental technologies and pilots them in real-world settings', dysregulation: 'Degradation of environmental innovation & pilot deployment', expectedTypes: [{ type: 'Climate-tech accelerator', reason: 'Greentown Labs, Third Derivative (Rocky Mountain Institute), Plug and Play Sustainability, Elemental Excelerator', confidence: 0.80 }, { type: 'DOE demonstration projects', reason: 'DOE ARPA-E, DOE Office of Clean Energy Demonstrations, ARPA-C for first-of-kind environmental tech demonstrations', confidence: 0.80 }] },
    'BLA': { fullName: 'Basolateral Amygdala', label: 'Environmental Threat Modeling', tier: 'operational', function: 'Builds threat models from past environmental incidents, spills, and climate disasters', dysregulation: 'Degradation of environmental threat modeling', expectedTypes: [{ type: 'Catastrophe modeling vendor', reason: 'Verisk AIR Worldwide, Moody’s RMS, CoreLogic for cat bonds and reinsurance threat modeling', confidence: 0.80 }, { type: 'Environmental risk register', reason: 'Riskonnect, LogicGate, MetricStream for enterprise environmental risk registers', confidence: 0.80 }] },
    'BNST': { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Slow-Burn Environmental Monitoring', tier: 'operational', function: 'Monitors chronic stressors: creeping pollution, slow-onset drought, gradual acidification', dysregulation: 'Degradation of slow-burn environmental monitoring', expectedTypes: [{ type: 'Chronic pollution monitoring', reason: 'USGS NAWQA long-term monitoring, EPA Water Quality Portal trend analysis, Pace Analytical LT monitoring', confidence: 0.80 }, { type: 'Drought monitoring service', reason: 'NOAA U.S. Drought Monitor, NIDIS, NDMC (National Drought Mitigation Center) for slow-onset drought tracking', confidence: 0.80 }] },
    'CARD': { fullName: 'Cardiac Autonomic Centers', label: 'Continuous Environmental Monitoring', tier: 'operational', function: 'Continuous 24/7 monitoring of emissions, water quality, and environmental sensor streams', dysregulation: 'Degradation of continuous environmental monitoring', expectedTypes: [{ type: 'CEMS provider', reason: 'Thermo Fisher Environmental, Horiba, Teledyne API, Sick Maihak for continuous emissions monitoring', confidence: 0.80 }, { type: 'Water quality monitoring', reason: 'Xylem YSI, Hach (Veralto), In-Situ Inc, Turner Designs for continuous water quality', confidence: 0.80 }] },
    'CAUD': { fullName: 'Caudate Nucleus', label: 'Environmental Workflow Automation', tier: 'operational', function: 'Automates repetitive environmental compliance workflows: permits, reporting, audits', dysregulation: 'Degradation of environmental workflow automation', expectedTypes: [{ type: 'EHS workflow automation', reason: 'Sphera, Cority, Enablon, Intelex, VelocityEHS for automated compliance workflows', confidence: 0.80 }, { type: 'Permit management system', reason: 'Accela, GovPilot, CivicGov, Infor Public Sector for environmental permit workflows', confidence: 0.80 }] },
    'CBLM': { fullName: 'Cerebellum (whole)', label: 'Environmental Project Coordination', tier: 'operational', function: 'Coordinates complex multi-site environmental projects: remediation, restoration, monitoring', dysregulation: 'Degradation of environmental project coordination', expectedTypes: [{ type: 'Environmental project management', reason: 'Procore Environmental, Autodesk BIM 360, Ecodomus for environmental project coordination', confidence: 0.80 }, { type: 'Environmental program prime', reason: 'AECOM, Jacobs, Tetra Tech, Stantec for multi-site federal environmental programs', confidence: 0.80 }] },
    'CC': { fullName: 'Corpus Callosum', label: 'Cross-Agency Environmental Integration', tier: 'operational', function: 'Integrates environmental data and action across EPA, USGS, NOAA, USDA, DOI, and state agencies', dysregulation: 'Degradation of cross-agency environmental integration', expectedTypes: [{ type: 'Federal environmental integrator', reason: 'Leidos, Peraton, SAIC, General Dynamics IT for federal environmental IT integration', confidence: 0.80 }, { type: 'Multi-agency data platform', reason: 'Esri ArcGIS Online for government, Google Earth Engine for Government, AWS GovCloud environmental', confidence: 0.80 }] },
    'CING': { fullName: 'Cingulate Cortex (general)', label: 'Environmental Mission Conflict Resolution', tier: 'operational', function: 'Resolves conflicts between environmental and economic objectives across agencies and operators', dysregulation: 'Degradation of environmental mission conflict resolution', expectedTypes: [{ type: 'Environmental mediation service', reason: 'CDR Associates, Consensus Building Institute, Meridian Institute for environmental conflict mediation', confidence: 0.80 }, { type: 'NEPA facilitation firm', reason: 'Ross Strategic, Kearns & West, US Institute for Environmental Conflict Resolution (USIECR)', confidence: 0.80 }] },
    'CLAUST': { fullName: 'Claustrum', label: 'Cross-Sensor Environmental Correlation', tier: 'operational', function: 'Correlates events across satellite, ground sensor, buoy, and citizen science streams', dysregulation: 'Degradation of cross-sensor environmental correlation', expectedTypes: [{ type: 'Multi-source EO fusion', reason: 'Descartes Labs (EarthDaily), Orbital Insight, Ursa Space Systems for multi-source EO correlation', confidence: 0.80 }, { type: 'Environmental data fusion', reason: 'Esri Geoevent Server, Google Earth Engine, Microsoft Planetary Computer for multi-sensor fusion', confidence: 0.80 }] },
    'CMZ': { fullName: 'Central Midbrain Zone', label: 'Environmental Threat Level Management', tier: 'operational', function: 'Manages environmental threat levels: FEMA declaration thresholds, EPA emergency response tiers', dysregulation: 'Degradation of environmental threat level management', expectedTypes: [{ type: 'FEMA emergency declaration', reason: 'FEMA Public Assistance, HMGP, IHP programs for presidential disaster declarations', confidence: 0.80 }, { type: 'EPA emergency response', reason: 'EPA OSC (On-Scene Coordinators), Emergency Response Removal Program, SERPS for federal response tier management', confidence: 0.80 }] },
    'CON': { fullName: 'Cingulo-opercular Network', label: 'Sustained Environmental Operations', tier: 'operational', function: 'Maintains sustained long-duration environmental operations: monitoring stations, ranger patrols', dysregulation: 'Degradation of sustained environmental operations', expectedTypes: [{ type: 'National park operations', reason: 'National Park Service operations support contractors, USFS operations support, USFWS refuge operations', confidence: 0.80 }, { type: 'Long-term ecological research', reason: 'NSF LTER network operators, NEON operators (Battelle), AmeriFlux operators for sustained observation', confidence: 0.80 }] },
    'DAN': { fullName: 'Dorsal Attention Network', label: 'Targeted Environmental Surveillance', tier: 'operational', function: 'Maintains persistent surveillance on priority environmental targets: illegal logging, poaching, spills', dysregulation: 'Degradation of targeted environmental surveillance', expectedTypes: [{ type: 'Satellite surveillance vendor', reason: 'Planet Labs, BlackSky, Maxar, Capella Space for persistent target surveillance', confidence: 0.80 }, { type: 'Wildlife anti-poaching tech', reason: 'SMART Partnership, Vulcan EarthRanger, WWF tech partners for anti-poaching surveillance', confidence: 0.80 }] },
    'DISS': { fullName: 'Dissociation', label: 'Environmental Red-Team & Tabletop Exercises', tier: 'operational', function: 'Runs red-team exercises and tabletop simulations of environmental disasters and compliance failures', dysregulation: 'Degradation of environmental red-team & tabletop exercises', expectedTypes: [{ type: 'Climate red team service', reason: 'Climate Red Team (think-tank), Chatham House climate wargaming, CSIS climate scenarios as references', confidence: 0.80 }, { type: 'Disaster tabletop exercise', reason: 'FEMA Emergency Management Institute tabletop exercises, DHS CISA tabletop services, ICF tabletop facilitation', confidence: 0.80 }] },
    'DV': { fullName: 'Dorsal Vagal Complex', label: 'Environmental Program Drawdown', tier: 'operational', function: 'Handles closure and drawdown of environmental programs, Superfund sites, and closed facilities', dysregulation: 'Degradation of environmental program drawdown', expectedTypes: [{ type: 'Superfund site closure', reason: 'Clean Harbors site closure, Republic Services post-closure, Arcadis post-closure care', confidence: 0.80 }, { type: 'Brownfield closure service', reason: 'Terracon brownfield services, Langan Engineering brownfield closure, AECOM closure and post-closure care', confidence: 0.80 }] },
    'EC': { fullName: 'Entorhinal Cortex', label: 'Environmental Indicator Indexing', tier: 'operational', function: 'Indexes environmental indicators for rapid retrieval and trend analysis', dysregulation: 'Degradation of environmental indicator indexing', expectedTypes: [{ type: 'Environmental indicator index', reason: 'EPA Report on the Environment (ROE), NOAA Climate Indicators, WRI indicators for environmental indexing', confidence: 0.80 }, { type: 'Environmental data catalog', reason: 'data.gov Environmental Topic, EPA Enviro Atlas, USGS Science Explorer for environmental data discovery', confidence: 0.80 }] },
    'EI': { fullName: 'Excitatory/Inhibitory Balance', label: 'Environmental Action vs Pause Balance', tier: 'operational', function: 'Balances acceleration (new projects) and pause (environmental review, mitigation) in environmental policy', dysregulation: 'Degradation of environmental action vs pause balance', expectedTypes: [{ type: 'NEPA alternatives analysis', reason: 'Tetra Tech NEPA, AECOM NEPA, Stantec NEPA for alternatives analysis in environmental review', confidence: 0.80 }, { type: 'Adaptive management consulting', reason: 'Cadmus Group, Abt Associates, ICF adaptive management for environmental programs', confidence: 0.80 }] },
    'EMP': { fullName: 'Empathy Circuit', label: 'Environmental Community Engagement', tier: 'operational', function: 'Engages communities affected by environmental harm and brings their voice into decisions', dysregulation: 'Degradation of environmental community engagement', expectedTypes: [{ type: 'Community engagement firm', reason: 'ICF Environmental Justice, Kearns & West community process, US Institute for Environmental Conflict Resolution', confidence: 0.80 }, { type: 'Public participation platform', reason: 'Bang the Table EngagementHQ, Konveio, PublicInput, CitizenLab for environmental public participation', confidence: 0.80 }] },
    'ENDO': { fullName: 'Endocrine System', label: 'Environmental Program Scheduling', tier: 'operational', function: 'Schedules recurring environmental operations: inspections, permit renewals, reporting cycles', dysregulation: 'Degradation of environmental program scheduling', expectedTypes: [{ type: 'Compliance calendar software', reason: 'Cority, Sphera, Enablon compliance calendars, Intelex compliance scheduling', confidence: 0.80 }, { type: 'EHS calendar management', reason: 'VelocityEHS Compliance Management, ERA Environmental Solutions compliance calendars', confidence: 0.80 }] },
    'ENS': { fullName: 'Enteric Nervous System', label: 'Autonomous Environmental Monitoring', tier: 'operational', function: 'Runs autonomous environmental monitoring: drones, AUVs, autonomous weather stations', dysregulation: 'Degradation of autonomous environmental monitoring', expectedTypes: [{ type: 'Environmental drone service', reason: 'Percepto, Skydio, DJI Enterprise Environmental, Wingtra for autonomous environmental monitoring', confidence: 0.80 }, { type: 'Autonomous ocean monitoring', reason: 'Saildrone, Liquid Robotics Wave Glider, Ocean Infinity AUVs for autonomous ocean observation', confidence: 0.80 }] },
    'FEF': { fullName: 'Frontal Eye Field', label: 'Remote Sensing Tasking', tier: 'operational', function: 'Tasks satellite and aerial sensors onto priority environmental targets', dysregulation: 'Degradation of remote sensing tasking', expectedTypes: [{ type: 'EO tasking platform', reason: 'Planet Tasking, Maxar SecureWatch, BlackSky Spectra for priority EO tasking', confidence: 0.80 }, { type: 'Aerial survey tasking', reason: 'NV5 Geospatial, Quantum Spatial (NV5), Fugro for aerial LiDAR and imagery tasking', confidence: 0.80 }] },
    'FG': { fullName: 'Fusiform Gyrus', label: 'Environmental Object Detection', tier: 'operational', function: 'Computer vision for environmental object detection: deforestation, spills, illegal mining', dysregulation: 'Degradation of environmental object detection', expectedTypes: [{ type: 'Satellite CV / AI platform', reason: 'Orbital Insight, Descartes Labs (EarthDaily), Ursa Space Systems, Planet Analytics for EO computer vision', confidence: 0.80 }, { type: 'Deforestation CV platform', reason: 'Global Forest Watch, Satelligence, SpaceKnow for deforestation computer vision', confidence: 0.80 }] },
    'FORN': { fullName: 'Fornix', label: 'Environmental Data Pipeline Management', tier: 'operational', function: 'Manages pipelines moving environmental data from collection to analysis to decision', dysregulation: 'Degradation of environmental data pipeline management', expectedTypes: [{ type: 'Environmental ETL platform', reason: 'Fivetran Environmental, Airbyte, Dagster for environmental data pipelines', confidence: 0.80 }, { type: 'Geospatial pipeline service', reason: 'Esri Velocity, Google Earth Engine pipelines, Databricks Lakehouse for geospatial ETL', confidence: 0.80 }] },
    'GABA_GLU': { fullName: 'GABA / Glutamate Balance', label: 'Environmental Escalation Management', tier: 'operational', function: 'Balances escalation vs de-escalation in environmental crises and diplomatic climate negotiations', dysregulation: 'Degradation of environmental escalation management', expectedTypes: [{ type: 'Climate diplomacy support', reason: 'Climate Analytics, E3G, Third Generation Environmentalism as references for UNFCCC diplomatic support', confidence: 0.80 }, { type: 'Environmental crisis management', reason: 'Alvarez & Marsal Sustainability, FTI Consulting ESG, Control Risks environmental crisis management', confidence: 0.80 }] },
    'GBA': { fullName: 'Gut-Brain Axis', label: 'Environmental Field Feedback', tier: 'operational', function: 'Gathers feedback from field operators and citizen scientists back to program managers', dysregulation: 'Degradation of environmental field feedback', expectedTypes: [{ type: 'Citizen science platform', reason: 'iNaturalist (Cal Academy / NatGeo), eBird (Cornell Lab), Zooniverse for citizen science feedback loops', confidence: 0.80 }, { type: 'Field feedback software', reason: 'Fulcrum field apps, Survey123 (ESRI), QField, Collector for ArcGIS for environmental field feedback', confidence: 0.80 }] },
    'GP': { fullName: 'Globus Pallidus', label: 'Environmental Go/No-Go Gating', tier: 'operational', function: 'Gates environmental decisions through permitting, ESA consultation, and compliance checkpoints', dysregulation: 'Degradation of environmental go/no-go gating', expectedTypes: [{ type: 'Permit portal vendor', reason: 'Accela Permits, EnerGov (Tyler Technologies), Civicplus Permits for government permit gating', confidence: 0.80 }, { type: 'Environmental compliance gate', reason: 'EnviroStor (California DTSC), SEMS (EPA Superfund), ECHO (EPA Enforcement) as government gate systems', confidence: 0.80 }] },
    'HAB': { fullName: 'Habenula', label: 'Environmental Failure Signal Broadcast', tier: 'operational', function: 'Broadcasts signals of environmental program failures to prevent repetition', dysregulation: 'Degradation of environmental failure signal broadcast', expectedTypes: [{ type: 'Environmental audit findings', reason: 'EPA OIG, GAO environmental audits, state auditor environmental findings for failure signal broadcast', confidence: 0.80 }, { type: 'Lessons learned platform', reason: 'Wildlife Society lessons learned, Society for Ecological Restoration lessons library, IUCN lessons learned', confidence: 0.80 }] },
    'HPA': { fullName: 'HPA Axis', label: 'Multi-Tier Environmental Crisis Escalation', tier: 'operational', function: 'Escalates environmental crises through local, state, federal, and international tiers', dysregulation: 'Degradation of multi-tier environmental crisis escalation', expectedTypes: [{ type: 'Multi-tier emergency operations', reason: 'FEMA National Response Framework, state EMA systems, local EOCs for multi-tier escalation', confidence: 0.80 }, { type: 'International environmental escalation', reason: 'UNEP Emergency Operations, OCHA Environmental Emergencies Centre, IUCN emergency response', confidence: 0.80 }] },
    'IC': { fullName: 'Inferior Colliculus', label: 'Environmental Stream Routing', tier: 'operational', function: 'Routes incoming environmental data streams to analysts and operators', dysregulation: 'Degradation of environmental stream routing', expectedTypes: [{ type: 'Geospatial streaming platform', reason: 'Esri GeoEvent Server, Google Cloud Pub/Sub for environmental data, Databricks streaming', confidence: 0.80 }, { type: 'Sensor data routing', reason: 'AWS IoT Core environmental, Azure IoT Hub, Google Cloud IoT for environmental stream routing', confidence: 0.80 }] },
    'LANG': { fullName: 'Language Network', label: 'Multilingual Environmental Operations', tier: 'operational', function: 'Supports environmental operations across languages: multilingual community engagement and reporting', dysregulation: 'Degradation of multilingual environmental operations', expectedTypes: [{ type: 'Environmental translation', reason: 'Lionbridge environmental, TransPerfect environmental, United Language Group for environmental translation', confidence: 0.80 }, { type: 'Multilingual community engagement', reason: 'IRC language access, International Medical Corps environmental language services for disaster-affected communities', confidence: 0.80 }] },
    'LAR': { fullName: 'Laryngeal Cortex', label: 'Environmental Public Affairs', tier: 'operational', function: 'Manages public affairs and official environmental agency communications', dysregulation: 'Degradation of environmental public affairs', expectedTypes: [{ type: 'Agency PR firm', reason: 'Burson Cohn & Wolfe public affairs, Ogilvy Public Relations, Hill+Knowlton Strategies for environmental public affairs', confidence: 0.80 }, { type: 'Government affairs firm', reason: 'Akin Gump Environmental, Van Ness Feldman, Bracewell environmental for federal environmental government affairs', confidence: 0.80 }] },
    'LC': { fullName: 'Locus Coeruleus', label: 'Environmental Alert Broadcasting', tier: 'operational', function: 'Broadcasts urgent environmental alerts demanding operator and public attention', dysregulation: 'Degradation of environmental alert broadcasting', expectedTypes: [{ type: 'Emergency alerting platform', reason: 'Everbridge Mass Notification, OnSolve CodeRED, Rave Mobile Safety for environmental alerts', confidence: 0.80 }, { type: 'NOAA alert distribution', reason: 'NOAA Weather Radio (NWR), NWS CAP alerts, EAS distribution through broadcast partners', confidence: 0.80 }] },
    'LGN': { fullName: 'Lateral Geniculate Nucleus', label: 'Satellite Imagery Processing', tier: 'operational', function: 'Processes raw satellite imagery into analysis-ready environmental data', dysregulation: 'Degradation of satellite imagery processing', expectedTypes: [{ type: 'Analysis-ready data platform', reason: 'Planet Analysis-Ready Data (ARD), Maxar ARD, ESA Sentinel Analysis-Ready Data for processed imagery', confidence: 0.80 }, { type: 'Imagery processing service', reason: 'Up42, Arlula, Descartes Labs (EarthDaily), SkyWatch for satellite imagery processing', confidence: 0.80 }] },
    'MAMM': { fullName: 'Mammillary Bodies', label: 'Long-Term Environmental Archive', tier: 'operational', function: 'Archives long-term environmental data for climate, biodiversity, and pollution baselines', dysregulation: 'Degradation of long-term environmental archive', expectedTypes: [{ type: 'Climate data archive', reason: 'NOAA NCEI Climate Data Online, NASA Earthdata, ESA Copernicus Climate Data Store for climate archives', confidence: 0.80 }, { type: 'Biodiversity archive', reason: 'GBIF (Global Biodiversity Information Facility), iDigBio, Smithsonian NMNH for biodiversity specimen archives', confidence: 0.80 }] },
    'MDT': { fullName: 'Mediodorsal Thalamus', label: 'Environmental Decision Gating', tier: 'operational', function: 'Gates high-stakes environmental decisions through science advisory committees and expert review', dysregulation: 'Degradation of environmental decision gating', expectedTypes: [{ type: 'Science advisory committee support', reason: 'NRC / National Academies (NASEM) committee support, EPA Science Advisory Board support contractors', confidence: 0.80 }, { type: 'Environmental peer review', reason: 'Eastern Research Group, Versar, ICF environmental peer review for EPA assessments and risk evaluations', confidence: 0.80 }] },
    'NAcc': { fullName: 'Nucleus Accumbens', label: 'Environmental Talent Reward', tier: 'operational', function: 'Manages prestige, awards, and incentives for environmental scientists and practitioners', dysregulation: 'Degradation of environmental talent reward', expectedTypes: [{ type: 'Environmental awards body', reason: 'Goldman Environmental Prize, MacArthur Fellows in environment, Ramsar Wetland Conservation Award as references', confidence: 0.80 }, { type: 'Environmental fellowship', reason: 'Switzer Environmental Fellowship, Knauss Marine Policy Fellowship, Roger Arliner Young Diversity Fellowship for career development', confidence: 0.80 }] },
    'NBM': { fullName: 'Nucleus Basalis of Meynert', label: 'Environmental Operational Tempo', tier: 'operational', function: 'Sets and sustains operational tempo for environmental programs and field operations', dysregulation: 'Degradation of environmental operational tempo', expectedTypes: [{ type: 'NPS operations', reason: 'National Park Service operations support contractors, USFS operations support for operational tempo management', confidence: 0.80 }, { type: 'USFWS refuge operations', reason: 'USFWS National Wildlife Refuge System operations support and USFWS Ecological Services for tempo management', confidence: 0.80 }] },
    'NEOCER': { fullName: 'Neocerebellum', label: 'Environmental Precision Refinement', tier: 'operational', function: 'Refines environmental models and operations through prediction-error correction', dysregulation: 'Degradation of environmental precision refinement', expectedTypes: [{ type: 'Climate data assimilation', reason: 'ECMWF 4D-Var, NOAA GSI data assimilation, NASA GMAO data assimilation for numerical weather refinement', confidence: 0.80 }, { type: 'Environmental model calibration', reason: 'Abt Associates model calibration, RTI International environmental calibration, Industrial Economics Inc (IEc)', confidence: 0.80 }] },
    'OLF': { fullName: 'Olfactory System', label: 'Subtle Environmental Anomaly Detection', tier: 'operational', function: 'Detects subtle environmental anomalies through pattern matching and trace analysis', dysregulation: 'Degradation of subtle environmental anomaly detection', expectedTypes: [{ type: 'Anomaly detection platform', reason: 'Descartes Labs (EarthDaily) anomaly, Orbital Insight anomaly detection, Ursa Space anomaly detection for EO', confidence: 0.80 }, { type: 'Environmental forensic firm', reason: 'Exponent environmental forensics, RSI Entech forensics, Environmental Forensic Investigations for contamination', confidence: 0.80 }] },
    'OPIOID': { fullName: 'Opioid System', label: 'Environmental Trauma & Disaster Care', tier: 'operational', function: 'Provides mental health and trauma support to communities affected by environmental disasters', dysregulation: 'Degradation of environmental trauma & disaster care', expectedTypes: [{ type: 'Disaster mental health', reason: 'Red Cross Disaster Mental Health, SAMHSA Disaster Distress Helpline, IOCC Emergency Response as references', confidence: 0.80 }, { type: 'Community climate grief', reason: 'Climate Psychology Alliance, Good Grief Network, Climate Cares Center as references for climate grief support', confidence: 0.80 }] },
    'OSC': { fullName: 'Neural Oscillators', label: 'Environmental Cycle Synchronization', tier: 'operational', function: 'Synchronizes cyclical environmental operations: seasonal monitoring, tidal cycles, migration timing', dysregulation: 'Degradation of environmental cycle synchronization', expectedTypes: [{ type: 'Phenology network', reason: 'USA National Phenology Network (USA-NPN), PhenoCam, eBird Migration for phenological synchronization', confidence: 0.80 }, { type: 'Tidal / astronomical cycle', reason: 'NOAA Tides and Currents, USNO astronomical data for tidal and astronomical cycle synchronization', confidence: 0.80 }] },
    'OXY': { fullName: 'Oxytocin System', label: 'Environmental Coalition & Trust Building', tier: 'operational', function: 'Builds trust and information sharing across multi-stakeholder environmental coalitions', dysregulation: 'Degradation of environmental coalition & trust building', expectedTypes: [{ type: 'Multi-stakeholder coalition', reason: 'World Resources Institute (WRI), IUCN, Conservation International, The Nature Conservancy for coalition building', confidence: 0.80 }, { type: 'Environmental trust platform', reason: 'Trust for Public Land, Land Trust Alliance, American Farmland Trust for land conservation trust infrastructure', confidence: 0.80 }] },
    'PAG': { fullName: 'Periaqueductal Gray', label: 'Environmental Last-Resort Intervention', tier: 'operational', function: 'Coordinates last-resort environmental interventions: geoengineering, emergency species rescue', dysregulation: 'Degradation of environmental last-resort intervention', expectedTypes: [{ type: 'Solar geoengineering research', reason: 'SilverLining, Harvard SCoPEx (historical), SRM 360 as research references for SRM governance', confidence: 0.80 }, { type: 'Captive breeding / rescue', reason: 'Smithsonian Conservation Biology Institute, San Diego Zoo Wildlife Alliance, Revive & Restore for last-resort species rescue', confidence: 0.80 }] },
    'PBN': { fullName: 'Parabrachial Nucleus', label: 'Environmental Capacity Signaling', tier: 'operational', function: 'Signals environmental capacity constraints up the chain: funding, staffing, infrastructure gaps', dysregulation: 'Degradation of environmental capacity signaling', expectedTypes: [{ type: 'State environmental capacity', reason: 'State DEP capacity assessments, ECOS (Environmental Council of the States) for state capacity signaling', confidence: 0.80 }, { type: 'Federal workforce capacity', reason: 'EPA FedView, OPM workforce data, federal agency capacity dashboards for staffing and funding signaling', confidence: 0.80 }] },
    'PCC': { fullName: 'Posterior Cingulate Cortex', label: 'Environmental After-Action Review', tier: 'operational', function: 'Reviews past environmental events, spills, disasters, and policy outcomes for lessons learned', dysregulation: 'Degradation of environmental after-action review', expectedTypes: [{ type: 'After-action review firm', reason: 'Argonne National Laboratory AAR, Battelle AAR support, RAND Corporation environmental AAR', confidence: 0.80 }, { type: 'Disaster post-mortem service', reason: 'FEMA After-Action Reports, NTSB (for transportation environmental events), USCG Marine Casualty Investigation', confidence: 0.80 }] },
    'PI': { fullName: 'Posterior Insula', label: 'Environmental Internal State Monitoring', tier: 'operational', function: 'Monitors internal state of environmental programs: staff morale, mission alignment, burnout', dysregulation: 'Degradation of environmental internal state monitoring', expectedTypes: [{ type: 'Federal agency survey vendor', reason: 'Office of Personnel Management (OPM) FEVS, Partnership for Public Service surveys for federal agency morale', confidence: 0.80 }, { type: 'Environmental workforce health', reason: 'NIEHS Worker Training Program, OSHA HAZWOPER training partners for environmental workforce health', confidence: 0.80 }] },
    'PIN': { fullName: 'Pineal Gland', label: 'Environmental Time-Gated Operations', tier: 'operational', function: 'Synchronizes time-gated environmental operations: permit windows, hunting seasons, emission caps', dysregulation: 'Degradation of environmental time-gated operations', expectedTypes: [{ type: 'Permit scheduling system', reason: 'Accela Permits, Tyler Technologies EnerGov, OpenGov Permits for time-gated environmental permits', confidence: 0.80 }, { type: 'Seasonal regulatory platform', reason: 'State wildlife agency season systems, NOAA fisheries seasons, USFWS migratory bird calendars', confidence: 0.80 }] },
    'PIT': { fullName: 'Pituitary Gland', label: 'Environmental Directive Broadcast', tier: 'operational', function: 'Broadcasts strategic environmental directives: executive orders, EPA guidance, NEPA decisions', dysregulation: 'Degradation of environmental directive broadcast', expectedTypes: [{ type: 'Federal Register platform', reason: 'Federal Register (GPO), Regulations.gov, FedScope for environmental directive broadcast', confidence: 0.80 }, { type: 'EPA guidance distribution', reason: 'EPA Guidance Library, EPA NEPAssist, EPA TRI program for directive distribution', confidence: 0.80 }] },
    'PPN': { fullName: 'Pedunculopontine Nucleus', label: 'Environmental Continuous Operations Cadence', tier: 'operational', function: 'Maintains continuous operations cadence: 24/7 monitoring, rotating field crews, seasonal cycles', dysregulation: 'Degradation of environmental continuous operations cadence', expectedTypes: [{ type: 'Field crew scheduling', reason: 'Field Complete, Connecteam, When I Work for environmental field crew scheduling', confidence: 0.80 }, { type: 'Continuous monitoring cadence', reason: 'Sensorcon continuous field cadence, Kenter continuous monitoring, LI-COR continuous flux systems', confidence: 0.80 }] },
    'PULV': { fullName: 'Pulvinar', label: 'Critical Environmental Target Weighting', tier: 'operational', function: 'Weights attention by environmental priority: endangered species, Superfund priority, climate tipping points', dysregulation: 'Degradation of critical environmental target weighting', expectedTypes: [{ type: 'Priority list management', reason: 'USFWS Recovery Priority Numbers, EPA NPL (National Priorities List) for environmental priority weighting', confidence: 0.80 }, { type: 'Climate priority platform', reason: 'Climate Central climate priorities, Climate Analytics NDC priorities for climate priority weighting', confidence: 0.80 }] },
    'PUT': { fullName: 'Putamen', label: 'Habit-Formed Environmental Procedures', tier: 'operational', function: 'Reinforces habitual environmental procedures: standard sampling, permit workflows, field protocols', dysregulation: 'Degradation of habit-formed environmental procedures', expectedTypes: [{ type: 'SOP management system', reason: 'MasterControl SOP Management, VelocityEHS SOP, Sphera SOP for environmental SOP management', confidence: 0.80 }, { type: 'Field protocol platform', reason: 'protocols.io environmental, EPA SOPs, USGS field protocols for standardized environmental procedures', confidence: 0.80 }] },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Environmental Workforce Mood Monitoring', tier: 'operational', function: 'Monitors environmental workforce morale and burnout during disaster response and long campaigns', dysregulation: 'Degradation of environmental workforce mood monitoring', expectedTypes: [{ type: 'Federal employee morale survey', reason: 'OPM Federal Employee Viewpoint Survey (FEVS), Partnership for Public Service Best Places to Work', confidence: 0.80 }, { type: 'First responder wellness', reason: 'IAFC Wellness Fitness Initiative, Code Green Campaign, FirstNet wellness for responder morale monitoring', confidence: 0.80 }] },
    'RF': { fullName: 'Reticular Formation', label: 'Environmental Activation from Baseline', tier: 'operational', function: 'Activates environmental operations from baseline to emergency posture after triggering events', dysregulation: 'Degradation of environmental activation from baseline', expectedTypes: [{ type: 'Emergency activation system', reason: 'FEMA Emergency Alert System activation, state EMA activation systems, tribal EMA activation', confidence: 0.80 }, { type: 'Agency alert activation', reason: 'NOAA alert activation, NWS alert activation, EPA OSC activation for federal environmental posture', confidence: 0.80 }] },
    'RSC': { fullName: 'Retrosplenial Cortex', label: 'Environmental Mapping & Spatial Reference', tier: 'operational', function: 'Produces environmental maps, land cover products, and spatial reference data', dysregulation: 'Degradation of environmental mapping & spatial reference', expectedTypes: [{ type: 'Land cover mapping', reason: 'USGS National Land Cover Database (NLCD), NASA MODIS land cover, ESA WorldCover for land cover mapping', confidence: 0.80 }, { type: 'GIS reference provider', reason: 'Esri ArcGIS Living Atlas, Hexagon Geospatial, Trimble GIS for environmental spatial reference', confidence: 0.80 }] },
    'S1': { fullName: 'Primary Somatosensory Cortex', label: 'Environmental Ground-Truth Sensing', tier: 'operational', function: 'Collects ground-truth environmental data through handheld sensors, worn monitors, and manual sampling', dysregulation: 'Degradation of environmental ground-truth sensing', expectedTypes: [{ type: 'Handheld environmental sensor', reason: 'Thermo Fisher handhelds, Horiba handhelds, TSI handhelds for field ground-truth sensing', confidence: 0.80 }, { type: 'Wearable environmental monitor', reason: 'Aclima mobile platforms, Plume Labs Flow, Atmotube for wearable air quality monitoring', confidence: 0.80 }] },
    'SC': { fullName: 'Superior Colliculus', label: 'Environmental Orient-to-Threat', tier: 'operational', function: 'Orients operators to new environmental threats: fresh spills, wildfire ignitions, algal blooms', dysregulation: 'Degradation of environmental orient-to-threat', expectedTypes: [{ type: 'Wildfire detection', reason: 'ALERTWildfire cameras, NASA FIRMS fire alerts, WIFIRE for early wildfire threat orientation', confidence: 0.80 }, { type: 'Algal bloom detection', reason: 'NOAA HAB (Harmful Algal Bloom) Forecasts, EPA CyAN (Cyanobacteria Assessment Network) for algal orientation', confidence: 0.80 }] },
    'SEPT': { fullName: 'Septal Nuclei', label: 'Environmental Trust & Chain of Custody', tier: 'operational', function: 'Manages chain of custody and trust across environmental samples, data, and evidence', dysregulation: 'Degradation of environmental trust & chain of custody', expectedTypes: [{ type: 'Chain of custody platform', reason: 'LabLynx LIMS, LabVantage LIMS, LabWare LIMS for environmental chain of custody', confidence: 0.80 }, { type: 'Environmental evidence chain', reason: 'Eurofins chain of custody, Pace Analytical chain of custody, ALS Environmental COC systems', confidence: 0.80 }] },
    'SMA': { fullName: 'Supplementary Motor Area', label: 'Environmental Operational Planning', tier: 'operational', function: 'Builds operational plans for environmental programs: NEPA schedules, cleanup sequences, mobilization plans', dysregulation: 'Degradation of environmental operational planning', expectedTypes: [{ type: 'Environmental project planning', reason: 'Primavera P6 environmental, Microsoft Project environmental, Smartsheet environmental for project planning', confidence: 0.80 }, { type: 'Environmental program design', reason: 'AECOM program management, Jacobs program management, Tetra Tech program management for environmental planning', confidence: 0.80 }] },
    'SMN': { fullName: 'Somatomotor Network', label: 'Physical Environmental Infrastructure', tier: 'operational', function: 'Operates physical environmental infrastructure: treatment plants, landfills, monitoring stations', dysregulation: 'Degradation of physical environmental infrastructure', expectedTypes: [{ type: 'Water / wastewater operations', reason: 'Veolia North America water operations, Suez North America operations, American Water Operating', confidence: 0.80 }, { type: 'Landfill / transfer operations', reason: 'Waste Management facility operations, Republic Services facility operations, Clean Harbors treatment facility operations', confidence: 0.80 }] },
    'SN': { fullName: 'Salience Network', label: 'Environmental Salience Detection', tier: 'operational', function: 'Detects which environmental threats deserve immediate strategic attention right now', dysregulation: 'Degradation of environmental salience detection', expectedTypes: [{ type: 'Climate salience service', reason: 'Climate Central salience, Jupiter Intelligence risk scoring, First Street Foundation risk for climate salience', confidence: 0.80 }, { type: 'Disaster salience platform', reason: 'NOAA NWS IDSS (Impact-Based Decision Support Services), PDC DisasterAWARE for salience detection', confidence: 0.80 }] },
    'SNIG': { fullName: 'Substantia Nigra', label: 'Environmental Initiative Drive', tier: 'operational', function: 'Initiates and sustains major environmental initiatives: climate plans, cleanup campaigns', dysregulation: 'Degradation of environmental initiative drive', expectedTypes: [{ type: 'Climate initiative backbone', reason: 'Bloomberg Philanthropies Beyond Carbon, ClimateWorks Foundation, Hewlett Foundation Environment for initiative backing', confidence: 0.80 }, { type: 'Environmental campaign firm', reason: 'GMMB climate campaigns, Rethink Media environmental, Climate Nexus for environmental campaign execution', confidence: 0.80 }] },
    'SNS': { fullName: 'Sympathetic Nervous System', label: 'Environmental Surge Response', tier: 'operational', function: 'Mobilizes surge response for environmental emergencies: wildfire crews, spill teams, disaster response', dysregulation: 'Degradation of environmental surge response', expectedTypes: [{ type: 'Wildfire surge crews', reason: 'Patrick Environmental Services, GHD wildfire response, Cal Fire contractors for wildfire surge', confidence: 0.80 }, { type: 'Hazmat surge response', reason: 'Clean Harbors CleanCo surge, NRC / USES surge response, Marine Spill Response Corp surge response', confidence: 0.80 }] },
    'STN': { fullName: 'Subthalamic Nucleus', label: 'Environmental Operational Pause', tier: 'operational', function: 'Halts ongoing environmental operations for safety, compliance violation, or emergency pause', dysregulation: 'Degradation of environmental operational pause', expectedTypes: [{ type: 'Stop work authority', reason: 'OSHA stop work authority, EPA stop work orders, state regulatory stop work orders for operational pause', confidence: 0.80 }, { type: 'Compliance hold platform', reason: 'Intelex compliance hold, Sphera compliance hold, Cority compliance hold for environmental operational holds', confidence: 0.80 }] },
    'STRI': { fullName: 'Striatum', label: 'Environmental Procedural Operations', tier: 'operational', function: 'Encodes routine environmental procedures: standard sampling, calibration, permit workflows', dysregulation: 'Degradation of environmental procedural operations', expectedTypes: [{ type: 'Environmental SOP platform', reason: 'MasterControl Environmental SOP, VelocityEHS SOP, Sphera SOP Management for environmental procedures', confidence: 0.80 }, { type: 'Procedure library service', reason: 'protocols.io environmental protocols, ASTM International environmental methods, EPA Methods Program', confidence: 0.80 }] },
    'STS': { fullName: 'Superior Temporal Sulcus', label: 'Environmental Pattern of Life Analysis', tier: 'operational', function: 'Analyzes pattern-of-life for environmental threat actors: illegal loggers, poachers, polluters', dysregulation: 'Degradation of environmental pattern of life analysis', expectedTypes: [{ type: 'Illegal mining / logging POL', reason: 'Planet Labs, Descartes Labs (EarthDaily), Orbital Insight for illegal mining and logging pattern analysis', confidence: 0.80 }, { type: 'Wildlife poaching POL', reason: 'SMART Partnership, Vulcan EarthRanger, WildLabs for wildlife poaching pattern analysis', confidence: 0.80 }] },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Environmental Brand & Reputation Memory', tier: 'operational', function: 'Maintains long-term memory of environmental brand, reputation, and institutional credibility', dysregulation: 'Degradation of environmental brand & reputation memory', expectedTypes: [{ type: 'Environmental reputation monitoring', reason: 'Meltwater environmental monitoring, Cision environmental, Brandwatch environmental for reputation tracking', confidence: 0.80 }, { type: 'ESG reputation analytics', reason: 'RepRisk ESG, Sustainalytics ESG (Morningstar), MSCI ESG for environmental reputation scoring', confidence: 0.80 }] },
    'THAL': { fullName: 'Thalamus', label: 'Environmental Network Routing', tier: 'operational', function: 'Routes environmental data across federal, state, tribal, and international networks', dysregulation: 'Degradation of environmental network routing', expectedTypes: [{ type: 'Federal environmental network', reason: 'EPA Environmental Information Exchange Network (EEN / EIEN), Exchange Network Shared Services', confidence: 0.80 }, { type: 'Geospatial network routing', reason: 'Federal Geographic Data Committee (FGDC) Geoplatform, GeoPortal, MarineCadastre for geospatial routing', confidence: 0.80 }] },
    'TrkB': { fullName: 'Tropomyosin receptor kinase B', label: 'Environmental Experimentation', tier: 'operational', function: 'Enables safe environmental experimentation: pilots, research stations, controlled environment work', dysregulation: 'Degradation of environmental experimentation', expectedTypes: [{ type: 'Environmental pilot infrastructure', reason: 'Greentown Labs pilot facilities, Third Derivative (RMI) demonstration, Elemental Excelerator demonstration', confidence: 0.80 }, { type: 'DOE ARPA-E environmental', reason: 'DOE ARPA-E environmental programs, DOE Office of Clean Energy Demonstrations (OCED), ARPA-C for experimentation', confidence: 0.80 }] },
    'UNC': { fullName: 'Uncinate Fasciculus', label: 'Environmental Institutional Memory', tier: 'operational', function: 'Maintains long-term institutional memory across environmental programs and transitions', dysregulation: 'Degradation of environmental institutional memory', expectedTypes: [{ type: 'Environmental oral history', reason: 'Bureau of Reclamation Oral History, USFS Oral History, USGS Historians Office for institutional memory', confidence: 0.80 }, { type: 'Agency knowledge archive', reason: 'EPA National Service Center for Environmental Publications (NSCEP), USGS Publications Warehouse for archive', confidence: 0.80 }] },
    'V1': { fullName: 'Primary Visual Cortex', label: 'Raw Environmental Imagery Capture', tier: 'operational', function: 'Captures raw environmental imagery from satellite, aerial, and ground platforms', dysregulation: 'Degradation of raw environmental imagery capture', expectedTypes: [{ type: 'Commercial EO imagery', reason: 'Planet Labs, Maxar, BlackSky, Capella Space, ICEYE for raw commercial Earth observation imagery', confidence: 0.80 }, { type: 'Aerial imagery provider', reason: 'NV5 Geospatial, Quantum Spatial (NV5), Fugro, Woolpert for aerial and LiDAR imagery capture', confidence: 0.80 }] },
    'VAN': { fullName: 'Ventral Attention Network', label: 'Environmental Indications & Warning', tier: 'operational', function: 'Detects early warning signals of emerging environmental threats before they escalate', dysregulation: 'Degradation of environmental indications & warning', expectedTypes: [{ type: 'Early warning system', reason: 'NOAA NWS IDSS, PDC DisasterAWARE, NASA Worldview for environmental early warning', confidence: 0.80 }, { type: 'Climate early warning', reason: 'Climate Central early warning, Jupiter Intelligence early warning, First Street Foundation early warning', confidence: 0.80 }] },
    'VERM': { fullName: 'Cerebellar Vermis', label: 'Core Environmental Command Reliability', tier: 'operational', function: 'Provides core command reliability for long-running environmental programs and monitoring networks', dysregulation: 'Degradation of core environmental command reliability', expectedTypes: [{ type: 'EPA mission support prime', reason: 'Leidos EPA mission support, General Dynamics IT EPA support, Peraton EPA support, Guidehouse EPA support', confidence: 0.80 }, { type: 'NOAA mission support', reason: 'General Dynamics IT NOAA support, Leidos NOAA support, Peraton NOAA support for mission reliability', confidence: 0.80 }] },
    'VEST': { fullName: 'Vestibular System', label: 'Environmental Posture Drift Detection', tier: 'operational', function: 'Detects drift between intended environmental posture and actual operational performance', dysregulation: 'Degradation of environmental posture drift detection', expectedTypes: [{ type: 'Environmental performance analytics', reason: 'EPA Performance.gov, CEQ NEPA reports, state environmental performance dashboards for drift detection', confidence: 0.80 }, { type: 'Compliance trend platform', reason: 'EPA ECHO enforcement trends, Sphera compliance trends, Intelex compliance trends for posture drift', confidence: 0.80 }] },
    'VP': { fullName: 'Ventral Pallidum', label: 'Environmental Program Sunset', tier: 'operational', function: 'Handles graceful sunset of environmental programs, treatment systems, and regulatory regimes', dysregulation: 'Degradation of environmental program sunset', expectedTypes: [{ type: 'Program closure consulting', reason: 'Guidehouse program sunset, Alvarez & Marsal program wind-down, Berkeley Research Group environmental closures', confidence: 0.80 }, { type: 'Regulatory sunset support', reason: 'Akin Gump regulatory sunset, Van Ness Feldman, Beveridge & Diamond for environmental regulatory sunsetting', confidence: 0.80 }] },
    'VTA': { fullName: 'Ventral Tegmental Area', label: 'Environmental Innovator Incentives', tier: 'operational', function: 'Incentivizes external environmental innovators through prizes, challenges, and accelerators', dysregulation: 'Degradation of environmental innovator incentives', expectedTypes: [{ type: 'Environmental innovation prize', reason: 'XPRIZE Carbon Removal, XPRIZE Rainforest, USDA AgStar Challenge, DOE prize challenges for environmental innovation', confidence: 0.80 }, { type: 'Climate accelerator program', reason: 'Elemental Excelerator, Third Derivative (RMI), Greentown Labs, Plug and Play Sustainability for climate accelerators', confidence: 0.80 }] },
    'VV': { fullName: 'Ventral Vagal Complex', label: 'Environmental Calm-State Engagement', tier: 'operational', function: 'Runs calm-state environmental engagement: outreach, education, sustained partnerships', dysregulation: 'Degradation of environmental calm-state engagement', expectedTypes: [{ type: 'Environmental education org', reason: 'NEEF (National Environmental Education Foundation), NAAEE, Project Learning Tree for environmental education', confidence: 0.80 }, { type: 'Sustained partnership program', reason: 'World Wildlife Fund (WWF), The Nature Conservancy (TNC), Conservation International partnership programs', confidence: 0.80 }] },
    'mPFC': { fullName: 'Medial Prefrontal Cortex', label: 'Environmental Program Quality Engineering', tier: 'operational', function: 'Runs quality engineering across environmental programs and regulatory submissions', dysregulation: 'Degradation of environmental program quality engineering', expectedTypes: [{ type: 'Environmental QA / IV&V firm', reason: 'Battelle IV&V, SAIC IV&V, Abt Associates IV&V, IEc quality assurance for environmental programs', confidence: 0.80 }, { type: 'Environmental audit firm', reason: 'ERM audit, Bureau Veritas audit, SGS audit, Intertek environmental audit for program quality', confidence: 0.80 }] },
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Environmental Access Control', tier: 'operational', function: 'Enforces access control and authorization across environmental data and facility networks', dysregulation: 'Degradation of environmental access control', expectedTypes: [{ type: 'Federal identity / IAM', reason: 'ICAM (DHS FICAM), Okta Federal, CyberArk Federal, SailPoint Federal for environmental IAM', confidence: 0.80 }, { type: 'OT / ICS security', reason: 'Dragos, Claroty, Nozomi Networks for operational technology and ICS security at environmental facilities', confidence: 0.80 }] },
    'GABA_GLU_OP': { fullName: 'GABA / Glutamate Balance (ops)', label: 'Environmental Regulatory Stability', tier: 'operational', function: 'Balances rule-making acceleration vs regulatory stability for long-lived environmental infrastructure', dysregulation: 'Degradation of environmental regulatory stability', expectedTypes: [{ type: 'Regulatory stability advisory', reason: 'Van Ness Feldman, Bracewell, Beveridge & Diamond for environmental regulatory stability analysis', confidence: 0.80 }, { type: 'Rulemaking support firm', reason: 'Eastern Research Group, Abt Associates, ICF, Industrial Economics Inc for EPA rulemaking support', confidence: 0.80 }] },
    'BROCA_OP': { fullName: 'Broca (ops)', label: 'Environmental Statement Production', tier: 'operational', function: 'Produces outward-facing environmental statements: press releases, investor briefings, crisis comms', dysregulation: 'Degradation of environmental statement production', expectedTypes: [{ type: 'Sustainability PR firm', reason: 'Edelman Climate & Sustainability, APCO Sustainability, Weber Shandwick Sustainability Studio', confidence: 0.80 }, { type: 'Climate crisis comms', reason: 'FleishmanHillard Climate, Teneo ESG, Brunswick Group Climate & Sustainability', confidence: 0.80 }] }
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
    var brain = brains.get('environment');
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

  function getEnvironmentState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('environment');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getEnvironmentState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('environment') : null;
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
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Environment. It will appear as a valid target in investment and research opportunities tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Environment.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Environment mapping for audit tracking. Requires further validation.';
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

  window.LIMENEnvironmentBusinessEngine = {
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

  loadFullHierarchy(function () { console.log('[EnvironmentBusinessEngine] Hierarchy loaded'); });

  console.log('[EnvironmentBusinessEngine] Loaded \u2014 103-node full-hierarchy environment business assignment engine');

})();
