/**
 * population-node-business-engine.js — Population Node-to-Business Assignment Engine
 *
 * POPULATION / RESEARCH DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (matches the locked-domain standard):
 *   - Recursively traverses ALL child portal JSONs (depth 0-5, ~18,200 files)
 *   - Covers full 103 operational nodes (19 POPULATION-TOP + 84 POPULATION-OPERATIONAL)
 *   - Excludes the same 20 RI / framework nodes as the locked domains
 *   - Filters generic template treatments before inference
 *
 * Outputs 3 buckets:
 *   MAPPED     - already mapped and active in Population system
 *   MISSING    - plausible but missing from current Population mappings
 *   SPECULATIVE - low-confidence or novel suggestions
 *
 * Approval statuses: PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_population_business_approvals')
 *
 * Self-gates: only runs when ?domain=population or ?domain=research
 * Exposes: window.LIMENPopulationBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'population' && _dom !== 'population') return;

  var STORAGE_KEY = 'limen_population_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_population_hierarchy_cache';
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
  // 19 POPULATION-TOP (full neuroTranslation) + 84 POPULATION-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

    var NODE_BUSINESS_DIRECTORY = {
      // ══ POPULATION-TOP NODES (19) ══
      "DMN": {
        fullName: "Default Mode Network", label: "Population Scenario Modeling", tier: 'top',
        neuroTranslation: { inNeurology: "Active during internally-directed imagination, narrative construction, and long-range creative planning.", inBusiness: "In population, scenario modeling projects demographic futures, performs what-if analysis of policy interventions, and forecasts population trajectories under varying fertility, mortality, and migration assumptions." },
        function: "Generates demographic projections, what-if population models, scenario analysis for policy interventions, and long-range forecasting",
        dysregulation: "Failure to anticipate demographic transitions, surprise population collapses, inability to model compounding effects of fertility decline and aging",
        expectedTypes: [
          { type: "Demographic modeling institute", reason: "UN Population Division (World Population Prospects), IIASA (Wittgenstein Centre), Max Planck Institute for Demographic Research for authoritative population projection modeling", confidence: 0.95 },
          { type: "Actuarial firm", reason: "Milliman, Mercer, Willis Towers Watson for population-dependent actuarial modeling of pension, insurance, and healthcare systems", confidence: 0.88 },
          { type: "Policy simulation platform", reason: "RAND Corporation, Brookings Institution, Urban Institute for population policy scenario analysis and microsimulation", confidence: 0.85 },
          { type: "Demographic data analytics", reason: "IPUMS (University of Minnesota), DHS Program, and census microdata platforms for population data infrastructure", confidence: 0.82 }
        ]
      },
      "dlPFC": {
        fullName: "Dorsolateral Prefrontal Cortex", label: "Population Policy & Planning", tier: 'top',
        neuroTranslation: { inNeurology: "Executive control center for working memory, planning, and strategic reasoning.", inBusiness: "In population, policy and planning determine pro-natalist incentives, immigration quotas, urban zoning, healthcare capacity planning, and pension system design." },
        function: "Directs population policy including pro-natalist programs, immigration policy, urban planning, and demographic governance",
        dysregulation: "Policy paralysis on fertility decline, contradictory immigration signals, failure to plan for aging infrastructure needs",
        expectedTypes: [
          { type: "National population agency", reason: "Japan NIPSSR, Korea Institute for Health and Social Affairs, Singapore National Population and Talent Division for national population policy", confidence: 0.92 },
          { type: "International population body", reason: "UNFPA, World Bank Population, OECD Employment Directorate for international population policy coordination", confidence: 0.9 },
          { type: "Immigration policy institute", reason: "Migration Policy Institute, CATO Immigration, Center for Immigration Studies for immigration policy analysis", confidence: 0.85 },
          { type: "Urban planning authority", reason: "UN-Habitat, World Bank Urban Development, national housing ministries for urban population planning", confidence: 0.82 }
        ]
      },
      "dACC": {
        fullName: "Dorsal Anterior Cingulate Cortex", label: "Demographic Data Quality & Census Audit", tier: 'top',
        neuroTranslation: { inNeurology: "Monitors conflict, detects errors, and triggers adaptive responses.", inBusiness: "In population, data quality and census audit ensure accuracy of population counts, detect undercounting, and verify vital registration completeness." },
        function: "Monitors census accuracy, vital registration completeness, demographic data integrity, and statistical quality control",
        dysregulation: "Census undercount (U.S. 2020 missed 3.3M minorities), vital registration gaps (40% of global births unregistered), data manipulation",
        expectedTypes: [
          { type: "National statistics office", reason: "U.S. Census Bureau, UK ONS, Eurostat, Statistics Japan for official population data collection and quality", confidence: 0.95 },
          { type: "Vital registration authority", reason: "CDC NCHS, WHO CRVS for birth/death registration quality assurance", confidence: 0.9 },
          { type: "Demographic audit organization", reason: "Population Reference Bureau (PRB), IPUMS data quality programs for independent verification", confidence: 0.85 },
          { type: "Census technology provider", reason: "Census-specialized IT firms, mobile data collection platforms, satellite population estimation services", confidence: 0.82 }
        ]
      },
      "FPN": {
        fullName: "Frontoparietal Network", label: "Multi-Source Demographic Integration", tier: 'top',
        neuroTranslation: { inNeurology: "Flexibly integrates information from multiple brain systems for complex task management.", inBusiness: "In population, multi-source integration combines census data, vital records, surveys, satellite imagery, mobile data, and administrative records into unified demographic intelligence." },
        function: "Integrates census, vital records, surveys, satellite imagery, mobile phone data, and administrative records for demographic monitoring",
        dysregulation: "Data silos between agencies, incompatible classification systems, failure to triangulate sources",
        expectedTypes: [
          { type: "Demographic data integrator", reason: "IPUMS (100+ countries), DHS Program (90+ countries), UNICEF MICS for integrated demographic microdata", confidence: 0.92 },
          { type: "Geospatial population platform", reason: "WorldPop, Meta Data for Good, Flowminder for satellite and mobile data population estimates", confidence: 0.88 },
          { type: "Administrative data linker", reason: "Nordic population registers, UK Administrative Data Research, U.S. Census LEHD for record linkage", confidence: 0.85 },
          { type: "Survey organization", reason: "Gallup World Poll, Pew Research Global Attitudes, Afrobarometer for cross-national surveys", confidence: 0.82 }
        ]
      },
      "M1": {
        fullName: "Primary Motor Cortex", label: "Population Program Execution", tier: 'top',
        neuroTranslation: { inNeurology: "Executes voluntary movement, translating intention into physical action.", inBusiness: "In population, program execution implements vaccination campaigns, refugee processing, housing construction, census field operations, and resettlement programs." },
        function: "Executes population programs: vaccination campaigns, refugee processing, housing construction, census operations",
        dysregulation: "Failed vaccination rollouts, asylum processing backlogs, housing construction shortfalls, census operational failures",
        expectedTypes: [
          { type: "Vaccination campaign operator", reason: "WHO EPI, Gavi, UNICEF Supply Division for global vaccination program execution", confidence: 0.92 },
          { type: "Refugee processing agency", reason: "UNHCR field operations, IOM resettlement, USCIS, BAMF Germany for refugee processing", confidence: 0.9 },
          { type: "Census field operations", reason: "U.S. Census Bureau field ops (600K+ temp workers), national statistical offices for census execution", confidence: 0.88 },
          { type: "Housing construction authority", reason: "National housing agencies, Habitat for Humanity, public housing authorities", confidence: 0.82 }
        ]
      },
      "BROCA": {
        fullName: "Broca Area", label: "Demographic Reporting & Disclosure", tier: 'top',
        neuroTranslation: { inNeurology: "Controls speech production and language output.", inBusiness: "In population, reporting publishes census results, vital statistics, UN population reports, and demographic research informing policy and investment." },
        function: "Publishes census reports, vital statistics bulletins, UN population reports, and demographic data portals",
        dysregulation: "Delayed census results, suppressed demographic data, misleading population statistics",
        expectedTypes: [
          { type: "UN population reporting", reason: "UN Population Division (World Population Prospects, Urbanization Prospects), UNFPA State of World Population", confidence: 0.95 },
          { type: "National vital statistics", reason: "CDC NCHS (NVSR), ONS, Eurostat for national demographic reporting", confidence: 0.9 },
          { type: "Demographic research publisher", reason: "Population and Development Review, Demography journal, Lancet population health", confidence: 0.85 },
          { type: "Data portal operator", reason: "Our World in Data, Gapminder, World Bank DataBank for demographic data access", confidence: 0.82 }
        ]
      },
      "AG": {
        fullName: "Angular Gyrus", label: "Population Knowledge Networks", tier: 'top',
        neuroTranslation: { inNeurology: "Integrates multi-modal information, supports semantic processing.", inBusiness: "In population, knowledge networks connect demographic research institutions, data archives, and scholarly communities advancing population dynamics understanding." },
        function: "Connects UN Population Division, INED, Max Planck Demography, PRB, and academic demography departments",
        dysregulation: "Research silos, failure to translate findings into policy, loss of institutional expertise",
        expectedTypes: [
          { type: "Demographic research center", reason: "Max Planck Demography, INED (France), Wittgenstein Centre (IIASA/VID) for world-class research", confidence: 0.92 },
          { type: "Population reference organization", reason: "PRB, Population Council, Guttmacher Institute for research dissemination", confidence: 0.9 },
          { type: "Academic demography network", reason: "PAA, EAPS, IUSSP for scholarly demographic networks", confidence: 0.85 },
          { type: "Demographic data archive", reason: "Human Mortality Database, Human Fertility Database, IPUMS for curated archives", confidence: 0.88 }
        ]
      },
      "vmPFC": {
        fullName: "Ventromedial Prefrontal Cortex", label: "Population Funding & Investment", tier: 'top',
        neuroTranslation: { inNeurology: "Evaluates reward, risk, and value to guide decision-making.", inBusiness: "In population, funding allocates resources to family planning, refugee assistance, urban infrastructure, and research through UNFPA, USAID, Gates Foundation, and Wellcome Trust." },
        function: "Allocates funding through UNFPA, USAID population programs, Gates Foundation, Wellcome Trust, and national research budgets",
        dysregulation: "Underfunding family planning, UNFPA withdrawal (Mexico City Policy), misallocation between priorities",
        expectedTypes: [
          { type: "International population funder", reason: "UNFPA ($1.3B budget), USAID Population/Reproductive Health, DFID/FCDO for bilateral funding", confidence: 0.95 },
          { type: "Philanthropic population funder", reason: "Gates Foundation (family planning $400M+/yr), Wellcome Trust, Packard Foundation", confidence: 0.92 },
          { type: "Development bank", reason: "World Bank IDA, Asian Development Bank, African Development Bank for multilateral investment", confidence: 0.88 },
          { type: "National research funder", reason: "NIH NICHD, ESRC (UK), ANR (France) for demographic research funding", confidence: 0.85 }
        ]
      },
      "HIPP": {
        fullName: "Hippocampus", label: "Historical Demography & Long-Run Baselines", tier: 'top',
        neuroTranslation: { inNeurology: "Forms new memories, consolidates storage, enables spatial navigation.", inBusiness: "In population, historical demography provides long-run baselines: historical censuses, parish records, archaeological demography, demographic transition theory." },
        function: "Maintains historical baselines from parish records, censuses, archaeological demography, and long-run population series",
        dysregulation: "Loss of historical context, failure to recognize changes as unprecedented, ahistorical policy assumptions",
        expectedTypes: [
          { type: "Historical demography center", reason: "Cambridge Group for History of Population, INED historical demography, Utrecht Centre for long-run data", confidence: 0.9 },
          { type: "Historical census archive", reason: "IPUMS historical (U.S. back to 1790), NAPP, Mosaic (UK) for historical census data", confidence: 0.88 },
          { type: "Archaeological demography", reason: "Bioarchaeology programs, ancient DNA labs, paleodemography for pre-census reconstruction", confidence: 0.82 },
          { type: "Demographic transition research", reason: "European Fertility Project (Princeton), DHS historical series, global transition databases", confidence: 0.85 }
        ]
      },
      "ECN": {
        fullName: "Executive Control Network", label: "Demographic Methods & Statistical Inference", tier: 'top',
        neuroTranslation: { inNeurology: "Top-down control directing attention and maintaining task focus.", inBusiness: "In population, methods provide mathematical/statistical tools: cohort-component models, life tables, survival analysis, indirect estimation." },
        function: "Develops demographic methods: cohort-component projection, life tables, survival analysis, indirect estimation",
        dysregulation: "Methodological stagnation, over-reliance on outdated models, failure to incorporate new data sources",
        expectedTypes: [
          { type: "Demographic methods center", reason: "UN Population Division methodology, Wittgenstein Centre methods, Berkeley Demography", confidence: 0.92 },
          { type: "Statistical agency methods", reason: "Census Bureau Center for Statistical Research, ONS Methodology, Eurostat", confidence: 0.88 },
          { type: "Demographic software", reason: "DemProj (Spectrum), MORTPAK (UN), R demography packages", confidence: 0.82 },
          { type: "Bayesian population estimation", reason: "IHME, bayesPop, machine learning demographic estimation", confidence: 0.85 }
        ]
      },
      "PRECUNEUS": {
        fullName: "Precuneus", label: "Population Theory & Demographic Transition", tier: 'top',
        neuroTranslation: { inNeurology: "Supports self-reflection, consciousness, and episodic memory retrieval.", inBusiness: "In population, theory provides intellectual frameworks: demographic transition, Malthus, Boserup, second demographic transition, post-transition fertility decline." },
        function: "Develops population theory: demographic transition models, post-transition fertility decline, population-environment frameworks",
        dysregulation: "Theory-policy disconnect, over-reliance on Malthusian assumptions, failure to update for global fertility decline",
        expectedTypes: [
          { type: "Population theory program", reason: "Princeton OPR, LSE Social Policy, ANU demography for population theory", confidence: 0.9 },
          { type: "Demographic transition research", reason: "Lesthaeghe (SDT), Livi-Bacci, Coleman (Third DT) research programs", confidence: 0.85 },
          { type: "Population-environment research", reason: "IIASA Population program, CICRED, population-climate interaction groups", confidence: 0.82 },
          { type: "Theory publication", reason: "Population and Development Review, Population Studies, European Journal of Population", confidence: 0.88 }
        ]
      },
      "HYPO": {
        fullName: "Hypothalamus", label: "Fertility & Reproductive Health", tier: 'top',
        neuroTranslation: { inNeurology: "Regulates homeostasis, hunger, thirst, temperature, survival drives.", inBusiness: "In population, fertility/reproductive health covers IVF, contraception, maternal health, NIPT screening, reproductive endocrinology, and biological reproduction foundations." },
        function: "Monitors fertility and reproductive health: IVF, contraception, maternal health, prenatal screening, reproductive endocrinology",
        dysregulation: "IVF access inequality, contraception supply disruption, maternal mortality, endocrine disruptor proliferation",
        expectedTypes: [
          { type: "Reproductive health organization", reason: "Guttmacher Institute, Planned Parenthood, Marie Stopes International", confidence: 0.92 },
          { type: "Fertility technology company", reason: "CooperSurgical (IVF), Hologic (diagnostics), Natera (NIPT)", confidence: 0.9 },
          { type: "Maternal health program", reason: "WHO Maternal Health, UNFPA Maternal Health, Jhpiego (Johns Hopkins)", confidence: 0.88 },
          { type: "Endocrine research", reason: "Endocrine Society, NIEHS research, PFAS/microplastics fertility impact labs", confidence: 0.82 }
        ]
      },
      "OFC": {
        fullName: "Orbitofrontal Cortex", label: "Mortality & Epidemiological Transition", tier: 'top',
        neuroTranslation: { inNeurology: "Encodes expected value, processes reward prediction.", inBusiness: "In population, mortality analysis tracks cause-of-death, life expectancy, epidemiological transitions, and excess mortality for population health intelligence." },
        function: "Analyzes mortality patterns, cause-of-death, life expectancy, epidemiological transitions, excess mortality",
        dysregulation: "Failure to detect excess mortality, cause-of-death misclassification, life expectancy stagnation without response",
        expectedTypes: [
          { type: "Mortality database", reason: "Human Mortality Database, WHO GHO mortality, IHME GBD for mortality analysis", confidence: 0.95 },
          { type: "Cause-of-death authority", reason: "CDC NCHS mortality, WHO ICD, GBD cause-specific mortality", confidence: 0.9 },
          { type: "Life expectancy research", reason: "Oeppen-Vaupel best-practice, Vaupel biodemography, longevity science", confidence: 0.85 },
          { type: "Excess mortality tracker", reason: "The Economist model, Our World in Data, EuroMOMO for real-time surveillance", confidence: 0.88 }
        ]
      },
      "IPS": {
        fullName: "Intraparietal Sulcus", label: "Population Mathematics & Actuarial Science", tier: 'top',
        neuroTranslation: { inNeurology: "Processes numerical and spatial information.", inBusiness: "In population, math and actuarial science provide quantitative foundations: projections, life tables, dependency ratios, population pyramids." },
        function: "Performs population projections, actuarial calculations, dependency ratio modeling, pyramid analysis",
        dysregulation: "Projection errors, actuarial miscalculation, failure to update for unprecedented conditions",
        expectedTypes: [
          { type: "Actuarial organization", reason: "Society of Actuaries, IFoA (UK), International Actuarial Association", confidence: 0.9 },
          { type: "Projection authority", reason: "UN Population Division, Census Bureau International Programs, Eurostat EUROPOP", confidence: 0.92 },
          { type: "Demographic accounting", reason: "National Transfer Accounts, Lee-Mason analysis, generational accounting", confidence: 0.85 },
          { type: "Insurance actuarial", reason: "Milliman, Mercer, Aon for population-dependent actuarial analysis", confidence: 0.88 }
        ]
      },
      "NTS": {
        fullName: "Nucleus Tractus Solitarius", label: "Population Sensing & Vital Registration", tier: 'top',
        neuroTranslation: { inNeurology: "Primary relay for visceral sensory information.", inBusiness: "In population, sensing and registration are civil registration systems recording births, deaths, marriages, migrations — the raw data foundation." },
        function: "Operates CRVS systems, sample registration schemes, real-time demographic event monitoring",
        dysregulation: "CRVS gaps (40% births/60% deaths unregistered), delayed processing, incomplete migration recording",
        expectedTypes: [
          { type: "Civil registration authority", reason: "National civil registration, WHO CRVS strengthening, Bloomberg Data for Health", confidence: 0.92 },
          { type: "Sample registration", reason: "India SRS, China DSP, INDEPTH Network for continuous demographic monitoring", confidence: 0.88 },
          { type: "Digital vital registration", reason: "UNICEF CRVS digitization, OpenCRVS, mobile birth registration", confidence: 0.85 },
          { type: "Demographic surveillance", reason: "INDEPTH Network (47 sites/18 countries), Agincourt HDSS, Matlab HDSS", confidence: 0.82 }
        ]
      },
      "TPJ": {
        fullName: "Temporoparietal Junction", label: "Migration & Displacement Studies", tier: 'top',
        neuroTranslation: { inNeurology: "Supports theory of mind, empathy, perspective-taking.", inBusiness: "In population, migration studies analyze forced displacement, voluntary migration, diaspora, remittance flows, and integration outcomes." },
        function: "Analyzes migration patterns, forced displacement, diaspora dynamics, remittance flows, integration outcomes",
        dysregulation: "Migration data gaps, internal displacement undertracking, climate migration underestimation",
        expectedTypes: [
          { type: "Migration research", reason: "UNHCR Global Trends, IOM World Migration Report, Migration Policy Institute, Pew Hispanic Center", confidence: 0.95 },
          { type: "Displacement monitoring", reason: "IDMC, ACAPS, OCHA for real-time displacement tracking", confidence: 0.9 },
          { type: "Remittance tracking", reason: "World Bank Remittance Prices, KNOMAD, Western Union/Wise flow data", confidence: 0.85 },
          { type: "Diaspora research", reason: "Oxford Diaspora Programme, IOM diaspora engagement, GFMD", confidence: 0.82 }
        ]
      },
      "rACC": {
        fullName: "Rostral Anterior Cingulate Cortex", label: "Population Ethics & Bioethics", tier: 'top',
        neuroTranslation: { inNeurology: "Processes emotional conflict, regulates autonomic responses.", inBusiness: "In population, ethics covers reproductive rights, population control history, eugenics legacy, informed consent in reproductive technology, and demographic intervention ethics." },
        function: "Navigates population ethics: reproductive rights, eugenics history, population control, informed consent",
        dysregulation: "Coercive population control, eugenics resurgence, reproductive rights violations, uninformed consent",
        expectedTypes: [
          { type: "Population ethics research", reason: "Hastings Center, Oxford Uehiro Centre, Georgetown Kennedy Institute for ethics", confidence: 0.9 },
          { type: "Reproductive rights", reason: "Center for Reproductive Rights, UNFPA reproductive rights, WHO ethics guidelines", confidence: 0.88 },
          { type: "Eugenics history", reason: "Cold Spring Harbor archives, UCL Galton legacy, academic eugenics history", confidence: 0.82 },
          { type: "Reproductive technology ethics", reason: "ESHRE Ethics Committee, ASRM Ethics, Nuffield Council on Bioethics", confidence: 0.85 }
        ]
      },
      "WERN": {
        fullName: "Wernicke Area", label: "Population Informatics & GIS", tier: 'top',
        neuroTranslation: { inNeurology: "Comprehends language, processes auditory signals, extracts meaning.", inBusiness: "In population, informatics/GIS provide spatial/computational tools: population mapping, satellite estimates, mobile demography, geographic analysis." },
        function: "Provides GIS population mapping, satellite-derived estimates, mobile phone demography, geospatial analysis",
        dysregulation: "Mapping gaps in conflict zones, estimation errors, privacy concerns, digital divide",
        expectedTypes: [
          { type: "Geospatial platform", reason: "WorldPop, Meta Data for Good, LandScan for satellite-derived estimates", confidence: 0.92 },
          { type: "GIS demographic analysis", reason: "Esri ArcGIS, CIESIN (Columbia), NASA SEDAC for geospatial demographic data", confidence: 0.88 },
          { type: "Mobile data demography", reason: "Flowminder, GSMA Mobile for Development, Telenor Research", confidence: 0.85 },
          { type: "Census GIS", reason: "Census Bureau TIGER/Line, Ordnance Survey, national mapping agencies", confidence: 0.82 }
        ]
      },
      "MGN": {
        fullName: "Magnocellular Neurosecretory", label: "Demographic Workforce & Training", tier: 'top',
        neuroTranslation: { inNeurology: "Produces hormones regulating fluid balance, maintaining system readiness.", inBusiness: "In population, workforce develops demographers, actuaries, public health workers, census enumerators, and GIS specialists who operate population systems." },
        function: "Develops demographic workforce: demography programs, actuarial training, public health workforce, census enumerators",
        dysregulation: "Program closures, actuarial shortage, census staffing failures, public health burnout",
        expectedTypes: [
          { type: "Demography graduate program", reason: "Princeton OPR, UC Berkeley Demography, LSHTM, ANU for PhD training", confidence: 0.9 },
          { type: "Actuarial education", reason: "Society of Actuaries, IFoA exams, university actuarial programs", confidence: 0.85 },
          { type: "Public health workforce", reason: "Johns Hopkins SPH, Harvard Chan, CDC EIS for population health workforce", confidence: 0.88 },
          { type: "Census operations workforce", reason: "Census Bureau recruitment, national statistical office training, UN capacity building", confidence: 0.82 }
        ]
      },

      // ══ POPULATION-OPERATIONAL NODES (84) ══
      "POP_VR_BIRTH": {
        fullName: "Birth Registration & Certificates", label: "Birth Registration & Certificates", tier: 'operational',
        function: "Birth Registration & Certificates operations and analysis for population domain",
        dysregulation: "Operational gaps in birth registration & certificates affecting population system integrity",
        expectedTypes: [
          { type: "Birth Registration & Certificates provider", reason: "Thomson Reuters ONESOURCE Vital Records, VitalChek (LexisNexis), Naphsis EVVE for electronic birth registration verification", confidence: 0.85 },
          { type: "Birth Registration & Certificates institution", reason: "CDC NCHS National Vital Statistics System, state vital records offices, WHO CRVS for birth registration standards", confidence: 0.82 }
        ]
      },
      "POP_VR_DEATH": {
        fullName: "Death Registration & Cause Coding", label: "Death Registration & Cause Coding", tier: 'operational',
        function: "Death Registration & Cause Coding operations and analysis for population domain",
        dysregulation: "Operational gaps in death registration & cause coding affecting population system integrity",
        expectedTypes: [
          { type: "Death Registration & Cause Coding provider", reason: "WHO ICD-11 coding tools, CDC NCHS WONDER, Rhapsody (InterSystems) for automated cause-of-death coding", confidence: 0.85 },
          { type: "Death Registration & Cause Coding institution", reason: "CDC National Center for Health Statistics, WHO Mortality Database, IHME Global Burden of Disease for mortality analysis", confidence: 0.82 }
        ]
      },
      "POP_VR_MARRIAGE": {
        fullName: "Marriage & Divorce Registration", label: "Marriage & Divorce Registration", tier: 'operational',
        function: "Marriage & Divorce Registration operations and analysis for population domain",
        dysregulation: "Operational gaps in marriage & divorce registration affecting population system integrity",
        expectedTypes: [
          { type: "Marriage & Divorce Registration provider", reason: "Tyler Technologies Odyssey (court records), Thomson Reuters CLEAR, LexisNexis for family law records", confidence: 0.85 },
          { type: "Marriage & Divorce Registration institution", reason: "CDC NCHS marriage/divorce statistics, state courts, Eurostat demographic events for family formation data", confidence: 0.82 }
        ]
      },
      "POP_CENSUS_OPS": {
        fullName: "Census Operations & Enumeration", label: "Census Operations & Enumeration", tier: 'operational',
        function: "Census Operations & Enumeration operations and analysis for population domain",
        dysregulation: "Operational gaps in census operations & enumeration affecting population system integrity",
        expectedTypes: [
          { type: "Census Operations & Enumeration provider", reason: "U.S. Census Bureau (Decennial), UK ONS Census, Statistics Canada, ABS Australia for national census operations", confidence: 0.85 },
          { type: "Census Operations & Enumeration institution", reason: "Deloitte Federal census IT, SAIC census processing, Lockheed Martin census support for census technology", confidence: 0.82 }
        ]
      },
      "POP_CENSUS_ADMIN": {
        fullName: "Administrative Records Population Estimation", label: "Administrative Records Population Estimation", tier: 'operational',
        function: "Administrative Records Population Estimation operations and analysis for population domain",
        dysregulation: "Operational gaps in administrative records population estimation affecting population system integrity",
        expectedTypes: [
          { type: "Administrative Records Population Estimation provider", reason: "IRS Master File, SSA Numident, CMS Medicare enrollment, USPS National Change of Address for admin-based population estimates", confidence: 0.85 },
          { type: "Administrative Records Population Estimation institution", reason: "U.S. Census Bureau Population Estimates Program, Eurostat UNECE, Nordic population registers for admin-record demography", confidence: 0.82 }
        ]
      },
      "POP_FERTILITY_MONITOR": {
        fullName: "Fertility Rate Monitoring", label: "Fertility Rate Monitoring", tier: 'operational',
        function: "Fertility Rate Monitoring operations and analysis for population domain",
        dysregulation: "Operational gaps in fertility rate monitoring affecting population system integrity",
        expectedTypes: [
          { type: "Fertility Rate Monitoring provider", reason: "CDC NCHS National Survey of Family Growth (NSFG), Eurostat fertility indicators, OECD Family Database for TFR tracking", confidence: 0.85 },
          { type: "Fertility Rate Monitoring institution", reason: "UNFPA State of World Population, PRB World Population Data Sheet, INED Human Fertility Database for global fertility monitoring", confidence: 0.82 }
        ]
      },
      "POP_FERTILITY_IVF": {
        fullName: "IVF & Assisted Reproduction", label: "IVF & Assisted Reproduction", tier: 'operational',
        function: "IVF & Assisted Reproduction operations and analysis for population domain",
        dysregulation: "Operational gaps in ivf & assisted reproduction affecting population system integrity",
        expectedTypes: [
          { type: "IVF & Assisted Reproduction provider", reason: "CooperSurgical (IVF media, ICSI tools), Vitrolife (culture media), Hamilton Thorne (laser systems) for ART laboratory equipment", confidence: 0.85 },
          { type: "IVF & Assisted Reproduction institution", reason: "CDC ART Surveillance, ESHRE, ICMART for assisted reproduction outcome tracking and registry", confidence: 0.82 }
        ]
      },
      "POP_FERTILITY_ENDO": {
        fullName: "Endocrine Disruption & Reproductive Toxicology", label: "Endocrine Disruption & Reproductive Toxicology", tier: 'operational',
        function: "Endocrine Disruption & Reproductive Toxicology operations and analysis for population domain",
        dysregulation: "Operational gaps in endocrine disruption & reproductive toxicology affecting population system integrity",
        expectedTypes: [
          { type: "Endocrine Disruption & Reproductive Toxicology provider", reason: "Eurofins Environment Testing (PFAS/phthalate assays), SGS Environmental, TestAmerica for endocrine disruptor testing", confidence: 0.85 },
          { type: "Endocrine Disruption & Reproductive Toxicology institution", reason: "EPA Endocrine Disruptor Screening Program, NIEHS NTP, EU REACH SVHC for reproductive toxicology regulation", confidence: 0.82 }
        ]
      },
      "POP_MATERNAL": {
        fullName: "Maternal Health & Obstetric Care", label: "Maternal Health & Obstetric Care", tier: 'operational',
        function: "Maternal Health & Obstetric Care operations and analysis for population domain",
        dysregulation: "Operational gaps in maternal health & obstetric care affecting population system integrity",
        expectedTypes: [
          { type: "Maternal Health & Obstetric Care provider", reason: "GE HealthCare maternal ultrasound, Philips Avalon fetal monitoring, Hologic Aptima for maternal health diagnostics", confidence: 0.85 },
          { type: "Maternal Health & Obstetric Care institution", reason: "WHO Maternal Health, UNFPA midwifery, CDC Pregnancy Mortality Surveillance System for maternal health tracking", confidence: 0.82 }
        ]
      },
      "POP_CONTRACEPTION": {
        fullName: "Contraception Access & Family Planning", label: "Contraception Access & Family Planning", tier: 'operational',
        function: "Contraception Access & Family Planning operations and analysis for population domain",
        dysregulation: "Operational gaps in contraception access & family planning affecting population system integrity",
        expectedTypes: [
          { type: "Contraception Access & Family Planning provider", reason: "Bayer (Mirena IUD), Organon (NuvaRing, Nexplanon), Pfizer (Depo-Provera), CooperSurgical (Paragard) for contraceptive products", confidence: 0.85 },
          { type: "Contraception Access & Family Planning institution", reason: "Guttmacher Institute, UNFPA Supplies Partnership, DKT International for family planning program evaluation", confidence: 0.82 }
        ]
      },
      "POP_PRENATAL": {
        fullName: "Prenatal Screening & Genetic Testing", label: "Prenatal Screening & Genetic Testing", tier: 'operational',
        function: "Prenatal Screening & Genetic Testing operations and analysis for population domain",
        dysregulation: "Operational gaps in prenatal screening & genetic testing affecting population system integrity",
        expectedTypes: [
          { type: "Prenatal Screening & Genetic Testing provider", reason: "Natera (Panorama NIPT), Illumina (VeriSeq), Roche (Harmony), Myriad Genetics (Prequel) for prenatal genetic screening", confidence: 0.85 },
          { type: "Prenatal Screening & Genetic Testing institution", reason: "ACOG prenatal screening guidelines, CDC Birth Defects Surveillance, WHO antenatal care standards", confidence: 0.82 }
        ]
      },
      "POP_MIG_INTL": {
        fullName: "International Migration Flow Tracking", label: "International Migration Flow Tracking", tier: 'operational',
        function: "International Migration Flow Tracking operations and analysis for population domain",
        dysregulation: "Operational gaps in international migration flow tracking affecting population system integrity",
        expectedTypes: [
          { type: "International Migration Flow Tracking provider", reason: "IOM Displacement Tracking Matrix (DTM), UNHCR Population Statistics Database, Frontex Risk Analysis for migration flow monitoring", confidence: 0.85 },
          { type: "International Migration Flow Tracking institution", reason: "UN DESA International Migration, OECD International Migration Outlook, World Bank KNOMAD for migration data", confidence: 0.82 }
        ]
      },
      "POP_REFUGEE_MGMT": {
        fullName: "Refugee Camp Management", label: "Refugee Camp Management", tier: 'operational',
        function: "Refugee Camp Management operations and analysis for population domain",
        dysregulation: "Operational gaps in refugee camp management affecting population system integrity",
        expectedTypes: [
          { type: "Refugee Camp Management provider", reason: "UNHCR PRIMES (proGres registration), WFP SCOPE (aid distribution), IOM Camp Coordination/Management for refugee operations", confidence: 0.85 },
          { type: "Refugee Camp Management institution", reason: "UNHCR, UNRWA, IRC, NRC, MSF for refugee camp operations and humanitarian response", confidence: 0.82 }
        ]
      },
      "POP_ASYLUM": {
        fullName: "Asylum Processing & Status Determination", label: "Asylum Processing & Status Determination", tier: 'operational',
        function: "Asylum Processing & Status Determination operations and analysis for population domain",
        dysregulation: "Operational gaps in asylum processing & status determination affecting population system integrity",
        expectedTypes: [
          { type: "Asylum Processing & Status Determination provider", reason: "UNHCR proGres (refugee status determination), EASO (EUAA) Country of Origin Information, USCIS ELIS for asylum processing", confidence: 0.85 },
          { type: "Asylum Processing & Status Determination institution", reason: "UNHCR Refugee Status Determination, national asylum courts, EUAA for asylum procedure standards", confidence: 0.82 }
        ]
      },
      "POP_REMITTANCE": {
        fullName: "Remittance Flows & Diaspora Economics", label: "Remittance Flows & Diaspora Economics", tier: 'operational',
        function: "Remittance Flows & Diaspora Economics operations and analysis for population domain",
        dysregulation: "Operational gaps in remittance flows & diaspora economics affecting population system integrity",
        expectedTypes: [
          { type: "Remittance Flows & Diaspora Economics provider", reason: "Western Union (WU), Wise (WISE.L), Remitly, WorldRemit for remittance transfer services", confidence: 0.85 },
          { type: "Remittance Flows & Diaspora Economics institution", reason: "World Bank KNOMAD Remittance Prices Worldwide, IFAD Financing Facility for Remittances for remittance tracking", confidence: 0.82 }
        ]
      },
      "POP_MIG_INTERNAL": {
        fullName: "Internal Migration & Urbanization", label: "Internal Migration & Urbanization", tier: 'operational',
        function: "Internal Migration & Urbanization operations and analysis for population domain",
        dysregulation: "Operational gaps in internal migration & urbanization affecting population system integrity",
        expectedTypes: [
          { type: "Internal Migration & Urbanization provider", reason: "Meta Data for Good (population density maps), Google Environmental Insights Explorer, Unacast mobility data for internal migration tracking", confidence: 0.85 },
          { type: "Internal Migration & Urbanization institution", reason: "UN-Habitat Urban Indicators, census internal migration tables, ACS geographic mobility for urbanization monitoring", confidence: 0.82 }
        ]
      },
      "POP_MIG_CLIMATE": {
        fullName: "Climate Migration & Environmental Displacement", label: "Climate Migration & Environmental Displacement", tier: 'operational',
        function: "Climate Migration & Environmental Displacement operations and analysis for population domain",
        dysregulation: "Operational gaps in climate migration & environmental displacement affecting population system integrity",
        expectedTypes: [
          { type: "Climate Migration & Environmental Displacement provider", reason: "IDMC (Internal Displacement Monitoring Centre), World Bank Groundswell reports, IPCC WGII migration for climate displacement tracking", confidence: 0.85 },
          { type: "Climate Migration & Environmental Displacement institution", reason: "IOM Environmental Migration, UNHCR climate displacement, Brookings-LSE Project on Internal Displacement", confidence: 0.82 }
        ]
      },
      "POP_MIG_LABOR": {
        fullName: "Labor Migration & Work Permits", label: "Labor Migration & Work Permits", tier: 'operational',
        function: "Labor Migration & Work Permits operations and analysis for population domain",
        dysregulation: "Operational gaps in labor migration & work permits affecting population system integrity",
        expectedTypes: [
          { type: "Labor Migration & Work Permits provider", reason: "USCIS H-1B/H-2A/H-2B data, UK Home Office work visa statistics, OECD SOPEMI for labor migration tracking", confidence: 0.85 },
          { type: "Labor Migration & Work Permits institution", reason: "ILO International Labour Migration, World Bank Migration and Development Brief for labor mobility analysis", confidence: 0.82 }
        ]
      },
      "POP_AGING_MONITOR": {
        fullName: "Aging Population Monitoring", label: "Aging Population Monitoring", tier: 'operational',
        function: "Aging Population Monitoring operations and analysis for population domain",
        dysregulation: "Operational gaps in aging population monitoring affecting population system integrity",
        expectedTypes: [
          { type: "Aging Population Monitoring provider", reason: "WHO Global Report on Ageing, HelpAge Global AgeWatch Index, UN World Population Ageing for aging demographic tracking", confidence: 0.85 },
          { type: "Aging Population Monitoring institution", reason: "National Institute on Aging (NIA), OECD Health at a Glance aging indicators, Eurostat aging data for aging monitoring", confidence: 0.82 }
        ]
      },
      "POP_ELDER_CARE": {
        fullName: "Elder Care & Long-Term Care", label: "Elder Care & Long-Term Care", tier: 'operational',
        function: "Elder Care & Long-Term Care operations and analysis for population domain",
        dysregulation: "Operational gaps in elder care & long-term care affecting population system integrity",
        expectedTypes: [
          { type: "Elder Care & Long-Term Care provider", reason: "Brookdale Senior Living (BKD), Amedisys (AMED), LHC Group (Optum), Kindred Healthcare for elder care operations", confidence: 0.85 },
          { type: "Elder Care & Long-Term Care institution", reason: "CMS Medicare & Medicaid, WHO Integrated Care for Older People (ICOPE), OECD Long-Term Care for elder care policy", confidence: 0.82 }
        ]
      },
      "POP_PENSION": {
        fullName: "Pension Solvency & Reform", label: "Pension Solvency & Reform", tier: 'operational',
        function: "Pension Solvency & Reform operations and analysis for population domain",
        dysregulation: "Operational gaps in pension solvency & reform affecting population system integrity",
        expectedTypes: [
          { type: "Pension Solvency & Reform provider", reason: "Milliman pension consulting, Mercer pension advisory, Willis Towers Watson, Aon Retirement Solutions for pension actuarial services", confidence: 0.85 },
          { type: "Pension Solvency & Reform institution", reason: "OECD Pensions at a Glance, World Bank Pension Reform Primer, IMF Fiscal Monitor for pension sustainability analysis", confidence: 0.82 }
        ]
      },
      "POP_GERIATRIC": {
        fullName: "Geriatric Medicine & Age-Related Disease", label: "Geriatric Medicine & Age-Related Disease", tier: 'operational',
        function: "Geriatric Medicine & Age-Related Disease operations and analysis for population domain",
        dysregulation: "Operational gaps in geriatric medicine & age-related disease affecting population system integrity",
        expectedTypes: [
          { type: "Geriatric Medicine & Age-Related Disease provider", reason: "Novo Nordisk (GLP-1 obesity/aging), Eli Lilly (donanemab Alzheimer), Biogen (aducanumab), Roche (gantenerumab) for age-related therapeutics", confidence: 0.85 },
          { type: "Geriatric Medicine & Age-Related Disease institution", reason: "NIA Clinical Trials, WHO Decade of Healthy Ageing, Alzheimer Association research programs", confidence: 0.82 }
        ]
      },
      "POP_ASSISTIVE": {
        fullName: "Assistive Technology & Disability", label: "Assistive Technology & Disability", tier: 'operational',
        function: "Assistive Technology & Disability operations and analysis for population domain",
        dysregulation: "Operational gaps in assistive technology & disability affecting population system integrity",
        expectedTypes: [
          { type: "Assistive Technology & Disability provider", reason: "ResMed (SLP respiratory), Sonova (hearing), Cochlear (implants), Ottobock (prosthetics), Invacare (mobility) for assistive devices", confidence: 0.85 },
          { type: "Assistive Technology & Disability institution", reason: "WHO Global Cooperation on Assistive Technology (GATE), UNICEF assistive tech, Disability Rights Fund", confidence: 0.82 }
        ]
      },
      "POP_SILVER_ECON": {
        fullName: "Silver Economy & Aging Markets", label: "Silver Economy & Aging Markets", tier: 'operational',
        function: "Silver Economy & Aging Markets operations and analysis for population domain",
        dysregulation: "Operational gaps in silver economy & aging markets affecting population system integrity",
        expectedTypes: [
          { type: "Silver Economy & Aging Markets provider", reason: "AARP, Philips Lifeline, Best Buy Health (Lively), Amazon Alexa Together for silver economy consumer products", confidence: 0.85 },
          { type: "Silver Economy & Aging Markets institution", reason: "Oxford Economics Silver Economy analysis, Euromonitor aging consumer, McKinsey Aging Society for aging market research", confidence: 0.82 }
        ]
      },
      "POP_URBAN_PLAN": {
        fullName: "Urban Population Planning & Zoning", label: "Urban Population Planning & Zoning", tier: 'operational',
        function: "Urban Population Planning & Zoning operations and analysis for population domain",
        dysregulation: "Operational gaps in urban population planning & zoning affecting population system integrity",
        expectedTypes: [
          { type: "Urban Population Planning & Zoning provider", reason: "Esri ArcGIS Urban, Autodesk InfraWorks, Bentley Systems CityEngine for urban planning software", confidence: 0.85 },
          { type: "Urban Population Planning & Zoning institution", reason: "UN-Habitat Global Urban Observatory, World Bank Urban Development, C40 Cities for urban governance", confidence: 0.82 }
        ]
      },
      "POP_HOUSING": {
        fullName: "Housing Supply & Affordability", label: "Housing Supply & Affordability", tier: 'operational',
        function: "Housing Supply & Affordability operations and analysis for population domain",
        dysregulation: "Operational gaps in housing supply & affordability affecting population system integrity",
        expectedTypes: [
          { type: "Housing Supply & Affordability provider", reason: "Zillow (Z), Redfin (RDFN), CoStar Group (CSGP), Realogy (HOUS) for housing market data and platforms", confidence: 0.85 },
          { type: "Housing Supply & Affordability institution", reason: "HUD Office of Policy Development, OECD Affordable Housing Database, UN-Habitat Housing for housing policy", confidence: 0.82 }
        ]
      },
      "POP_WATER_SANIT": {
        fullName: "Water & Sanitation Infrastructure", label: "Water & Sanitation Infrastructure", tier: 'operational',
        function: "Water & Sanitation Infrastructure operations and analysis for population domain",
        dysregulation: "Operational gaps in water & sanitation infrastructure affecting population system integrity",
        expectedTypes: [
          { type: "Water & Sanitation Infrastructure provider", reason: "Xylem (XYL), Veolia (VEOEY), American Water Works (AWK), Pentair (PNR) for water infrastructure", confidence: 0.85 },
          { type: "Water & Sanitation Infrastructure institution", reason: "WHO/UNICEF JMP (Joint Monitoring Programme), World Bank Water Supply for WASH monitoring", confidence: 0.82 }
        ]
      },
      "POP_TRANSIT": {
        fullName: "Urban Transit & Mobility", label: "Urban Transit & Mobility", tier: 'operational',
        function: "Urban Transit & Mobility operations and analysis for population domain",
        dysregulation: "Operational gaps in urban transit & mobility affecting population system integrity",
        expectedTypes: [
          { type: "Urban Transit & Mobility provider", reason: "Uber (UBER), Lyft (LYFT), BYD (BYDDY), Alstom (ALO.PA) for urban transit technology", confidence: 0.85 },
          { type: "Urban Transit & Mobility institution", reason: "UITP International Transit, ITDP Transport, C40 Transportation for urban mobility planning", confidence: 0.82 }
        ]
      },
      "POP_SMART_CITY": {
        fullName: "Smart City Technology", label: "Smart City Technology", tier: 'operational',
        function: "Smart City Technology operations and analysis for population domain",
        dysregulation: "Operational gaps in smart city technology affecting population system integrity",
        expectedTypes: [
          { type: "Smart City Technology provider", reason: "Cisco Smart City, Siemens Xcelerator, Honeywell Smart Buildings, IBM Intelligent Operations for smart city platforms", confidence: 0.85 },
          { type: "Smart City Technology institution", reason: "World Economic Forum Smart Cities, OECD Smart Cities, ITU Smart Sustainable Cities for smart city standards", confidence: 0.82 }
        ]
      },
      "POP_ENERGY_URBAN": {
        fullName: "Urban Energy & Grid Capacity", label: "Urban Energy & Grid Capacity", tier: 'operational',
        function: "Urban Energy & Grid Capacity operations and analysis for population domain",
        dysregulation: "Operational gaps in urban energy & grid capacity affecting population system integrity",
        expectedTypes: [
          { type: "Urban Energy & Grid Capacity provider", reason: "NextEra Energy (NEE), Eaton (ETN), Schneider Electric, Siemens Smart Infrastructure for urban energy systems", confidence: 0.85 },
          { type: "Urban Energy & Grid Capacity institution", reason: "IRENA urban energy, IEA Energy in Cities, C40 Climate Action for urban energy policy", confidence: 0.82 }
        ]
      },
      "POP_WASTE": {
        fullName: "Waste Management for Growing Populations", label: "Waste Management for Growing Populations", tier: 'operational',
        function: "Waste Management for Growing Populations operations and analysis for population domain",
        dysregulation: "Operational gaps in waste management for growing populations affecting population system integrity",
        expectedTypes: [
          { type: "Waste Management for Growing Populations provider", reason: "Waste Management (WM), Republic Services (RSG), Veolia (VEOEY), Clean Harbors (CLH) for waste services", confidence: 0.85 },
          { type: "Waste Management for Growing Populations institution", reason: "World Bank What a Waste 2.0, UNEP Global Waste Management Outlook for waste management policy", confidence: 0.82 }
        ]
      },
      "POP_PANDEMIC_PREP": {
        fullName: "Pandemic Preparedness & Response", label: "Pandemic Preparedness & Response", tier: 'operational',
        function: "Pandemic Preparedness & Response operations and analysis for population domain",
        dysregulation: "Operational gaps in pandemic preparedness & response affecting population system integrity",
        expectedTypes: [
          { type: "Pandemic Preparedness & Response provider", reason: "WHO Health Emergencies, CDC Emergency Preparedness, CEPI Coalition for Epidemic Preparedness for pandemic response", confidence: 0.85 },
          { type: "Pandemic Preparedness & Response institution", reason: "Johns Hopkins CHS Global Health Security Index, NTI Nuclear Threat Initiative biosecurity for preparedness assessment", confidence: 0.82 }
        ]
      },
      "POP_VACCINE_PLAT": {
        fullName: "Vaccine Platforms & mRNA Technology", label: "Vaccine Platforms & mRNA Technology", tier: 'operational',
        function: "Vaccine Platforms & mRNA Technology operations and analysis for population domain",
        dysregulation: "Operational gaps in vaccine platforms & mrna technology affecting population system integrity",
        expectedTypes: [
          { type: "Vaccine Platforms & mRNA Technology provider", reason: "Moderna (MRNA), BioNTech (BNTX), Pfizer (PFE), Novavax (NVAX), CureVac (CVAC) for mRNA and vaccine platforms", confidence: 0.85 },
          { type: "Vaccine Platforms & mRNA Technology institution", reason: "WHO EUL, FDA CBER, EMA for vaccine regulatory review and approval", confidence: 0.82 }
        ]
      },
      "POP_LONG_COVID": {
        fullName: "Long COVID & Workforce Impact", label: "Long COVID & Workforce Impact", tier: 'operational',
        function: "Long COVID & Workforce Impact operations and analysis for population domain",
        dysregulation: "Operational gaps in long covid & workforce impact affecting population system integrity",
        expectedTypes: [
          { type: "Long COVID & Workforce Impact provider", reason: "Teladoc (TDOC), Hims & Hers (HIMS), Noom, Omada Health for long COVID telehealth and management", confidence: 0.85 },
          { type: "Long COVID & Workforce Impact institution", reason: "CDC Long COVID research, NIH RECOVER Initiative, UK ONS Long COVID Prevalence for long COVID surveillance", confidence: 0.82 }
        ]
      },
      "POP_DISEASE_SURV": {
        fullName: "Disease Surveillance & Outbreak Detection", label: "Disease Surveillance & Outbreak Detection", tier: 'operational',
        function: "Disease Surveillance & Outbreak Detection operations and analysis for population domain",
        dysregulation: "Operational gaps in disease surveillance & outbreak detection affecting population system integrity",
        expectedTypes: [
          { type: "Disease Surveillance & Outbreak Detection provider", reason: "BlueDot, Metabiota (now Ginkgo), HealthMap, ProMED (ISID) for digital disease surveillance", confidence: 0.85 },
          { type: "Disease Surveillance & Outbreak Detection institution", reason: "WHO GOARN, CDC Global Disease Detection, ECDC EpiPulse for institutional outbreak detection", confidence: 0.82 }
        ]
      },
      "POP_EXCESS_MORT": {
        fullName: "Excess Mortality Monitoring", label: "Excess Mortality Monitoring", tier: 'operational',
        function: "Excess Mortality Monitoring operations and analysis for population domain",
        dysregulation: "Operational gaps in excess mortality monitoring affecting population system integrity",
        expectedTypes: [
          { type: "Excess Mortality Monitoring provider", reason: "IHME excess mortality estimates, The Economist excess deaths tracker, EuroMOMO for excess mortality monitoring", confidence: 0.85 },
          { type: "Excess Mortality Monitoring institution", reason: "WHO excess mortality working group, CDC NCHS excess deaths, Human Mortality Database for official excess mortality", confidence: 0.82 }
        ]
      },
      "POP_AMR": {
        fullName: "Antimicrobial Resistance & Population Health", label: "Antimicrobial Resistance & Population Health", tier: 'operational',
        function: "Antimicrobial Resistance & Population Health operations and analysis for population domain",
        dysregulation: "Operational gaps in antimicrobial resistance & population health affecting population system integrity",
        expectedTypes: [
          { type: "Antimicrobial Resistance & Population Health provider", reason: "bioMerieux (BIM.PA) diagnostics, Cepheid (DHR) GeneXpert, Becton Dickinson (BDX) susceptibility for AMR testing", confidence: 0.85 },
          { type: "Antimicrobial Resistance & Population Health institution", reason: "WHO GLASS (Global AMR Surveillance), CDC AR Threats Report, Fleming Fund for AMR monitoring", confidence: 0.82 }
        ]
      },
      "POP_CHRONIC_DIS": {
        fullName: "Chronic Disease Burden & NCD", label: "Chronic Disease Burden & NCD", tier: 'operational',
        function: "Chronic Disease Burden & NCD operations and analysis for population domain",
        dysregulation: "Operational gaps in chronic disease burden & ncd affecting population system integrity",
        expectedTypes: [
          { type: "Chronic Disease Burden & NCD provider", reason: "Novo Nordisk (NVO) GLP-1, Eli Lilly (LLY) tirzepatide, Abbott (ABT) CGM, Dexcom (DXCM) for NCD therapeutics/monitoring", confidence: 0.85 },
          { type: "Chronic Disease Burden & NCD institution", reason: "WHO NCD Global Monitoring Framework, IHME Global Burden of Disease, NCD Alliance for NCD surveillance", confidence: 0.82 }
        ]
      },
      "POP_MENTAL_HEALTH": {
        fullName: "Population Mental Health", label: "Population Mental Health", tier: 'operational',
        function: "Population Mental Health operations and analysis for population domain",
        dysregulation: "Operational gaps in population mental health affecting population system integrity",
        expectedTypes: [
          { type: "Population Mental Health provider", reason: "Talkspace (TALK), BetterHelp (TDOC), Cerebral, Spring Health for digital mental health platforms", confidence: 0.85 },
          { type: "Population Mental Health institution", reason: "WHO Mental Health Atlas, IHME mental disorder burden, NIMH population mental health for mental health monitoring", confidence: 0.82 }
        ]
      },
      "POP_PROJECTION": {
        fullName: "Population Projection & Forecasting", label: "Population Projection & Forecasting", tier: 'operational',
        function: "Population Projection & Forecasting operations and analysis for population domain",
        dysregulation: "Operational gaps in population projection & forecasting affecting population system integrity",
        expectedTypes: [
          { type: "Population Projection & Forecasting provider", reason: "UN Population Division World Population Prospects, IIASA SSP projections, U.S. Census Bureau IDB for global projections", confidence: 0.85 },
          { type: "Population Projection & Forecasting institution", reason: "Wittgenstein Centre for Demography, INED, Max Planck MPIDR for demographic forecasting research", confidence: 0.82 }
        ]
      },
      "POP_PYRAMID": {
        fullName: "Population Pyramid & Age Structure", label: "Population Pyramid & Age Structure", tier: 'operational',
        function: "Population Pyramid & Age Structure operations and analysis for population domain",
        dysregulation: "Operational gaps in population pyramid & age structure affecting population system integrity",
        expectedTypes: [
          { type: "Population Pyramid & Age Structure provider", reason: "PopulationPyramid.net, U.S. Census Bureau population pyramids, OECD age structure data for visualization", confidence: 0.85 },
          { type: "Population Pyramid & Age Structure institution", reason: "UN Population Division age-sex datasets, Eurostat EUROPOP, national statistics offices for official age structure", confidence: 0.82 }
        ]
      },
      "POP_LIFE_TABLE": {
        fullName: "Life Table Construction", label: "Life Table Construction", tier: 'operational',
        function: "Life Table Construction operations and analysis for population domain",
        dysregulation: "Operational gaps in life table construction affecting population system integrity",
        expectedTypes: [
          { type: "Life Table Construction provider", reason: "Human Mortality Database (HMD), WHO Global Health Observatory life tables, CDC NCHS life tables for mortality analysis", confidence: 0.85 },
          { type: "Life Table Construction institution", reason: "Milliman life table actuarial, Society of Actuaries mortality tables, WHO life expectancy at birth for actuarial use", confidence: 0.82 }
        ]
      },
      "POP_DEPENDENCY": {
        fullName: "Dependency Ratio Calculation", label: "Dependency Ratio Calculation", tier: 'operational',
        function: "Dependency Ratio Calculation operations and analysis for population domain",
        dysregulation: "Operational gaps in dependency ratio calculation affecting population system integrity",
        expectedTypes: [
          { type: "Dependency Ratio Calculation provider", reason: "World Bank age dependency ratio indicators, UN Population old-age dependency, OECD dependency projections for ratio tracking", confidence: 0.85 },
          { type: "Dependency Ratio Calculation institution", reason: "IIASA dependency ratio scenarios, national pension authorities, IMF Fiscal Monitor demographic pressure for policy analysis", confidence: 0.82 }
        ]
      },
      "POP_SEX_RATIO": {
        fullName: "Sex Ratio & Gender Imbalance", label: "Sex Ratio & Gender Imbalance", tier: 'operational',
        function: "Sex Ratio & Gender Imbalance operations and analysis for population domain",
        dysregulation: "Operational gaps in sex ratio & gender imbalance affecting population system integrity",
        expectedTypes: [
          { type: "Sex Ratio & Gender Imbalance provider", reason: "UNFPA sex ratio at birth tracking, China NBS sex ratio data, India Census sex ratio for gender imbalance monitoring", confidence: 0.85 },
          { type: "Sex Ratio & Gender Imbalance institution", reason: "Guttmacher Institute, Population Council, WHO sex ratio surveillance for sex-selective practice monitoring", confidence: 0.82 }
        ]
      },
      "POP_RURAL_DEPOP": {
        fullName: "Rural Depopulation & Ghost Towns", label: "Rural Depopulation & Ghost Towns", tier: 'operational',
        function: "Rural Depopulation & Ghost Towns operations and analysis for population domain",
        dysregulation: "Operational gaps in rural depopulation & ghost towns affecting population system integrity",
        expectedTypes: [
          { type: "Rural Depopulation & Ghost Towns provider", reason: "USDA Economic Research Service rural population, Eurostat urban-rural typology, Japan MLIT depopulation maps for rural monitoring", confidence: 0.85 },
          { type: "Rural Depopulation & Ghost Towns institution", reason: "OECD Rural Policy Reviews, World Bank rural development indicators, FAO rural livelihoods for rural population policy", confidence: 0.82 }
        ]
      },
      "POP_NATALIST": {
        fullName: "Pro-Natalist Policy Evaluation", label: "Pro-Natalist Policy Evaluation", tier: 'operational',
        function: "Pro-Natalist Policy Evaluation operations and analysis for population domain",
        dysregulation: "Operational gaps in pro-natalist policy evaluation affecting population system integrity",
        expectedTypes: [
          { type: "Pro-Natalist Policy Evaluation provider", reason: "OECD Family Database policy indicators, INED fertility policy tracker, Korea Institute for Health policy evaluation for pro-natalist assessment", confidence: 0.85 },
          { type: "Pro-Natalist Policy Evaluation institution", reason: "Japan NIPSSR, Hungary Demographics Office, Singapore NPTD for pro-natalist program design and evaluation", confidence: 0.82 }
        ]
      },
      "POP_IMMIGRATION_POL": {
        fullName: "Immigration Policy Design", label: "Immigration Policy Design", tier: 'operational',
        function: "Immigration Policy Design operations and analysis for population domain",
        dysregulation: "Operational gaps in immigration policy design affecting population system integrity",
        expectedTypes: [
          { type: "Immigration Policy Design provider", reason: "Migration Policy Institute (MPI), CATO Immigration, Center for Immigration Studies for policy research", confidence: 0.85 },
          { type: "Immigration Policy Design institution", reason: "OECD SOPEMI International Migration Outlook, IOM World Migration Report for global migration policy", confidence: 0.82 }
        ]
      },
      "POP_URBAN_GOV": {
        fullName: "Urban Governance & Municipal Response", label: "Urban Governance & Municipal Response", tier: 'operational',
        function: "Urban Governance & Municipal Response operations and analysis for population domain",
        dysregulation: "Operational gaps in urban governance & municipal response affecting population system integrity",
        expectedTypes: [
          { type: "Urban Governance & Municipal Response provider", reason: "UN-Habitat Urban Governance, C40 Cities, ICLEI Local Governments for Sustainability for urban governance", confidence: 0.85 },
          { type: "Urban Governance & Municipal Response institution", reason: "World Bank Municipal Finance, OECD Metropolitan Areas, Bloomberg Philanthropies Mayors Challenge for municipal capacity", confidence: 0.82 }
        ]
      },
      "POP_EDUCATION_PLAN": {
        fullName: "Education Planning for Demographic Change", label: "Education Planning for Demographic Change", tier: 'operational',
        function: "Education Planning for Demographic Change operations and analysis for population domain",
        dysregulation: "Operational gaps in education planning for demographic change affecting population system integrity",
        expectedTypes: [
          { type: "Education Planning for Demographic Change provider", reason: "UNESCO Institute for Statistics, OECD Education at a Glance, World Bank EdStats for education-population planning", confidence: 0.85 },
          { type: "Education Planning for Demographic Change institution", reason: "GPE Global Partnership for Education, UNICEF education programs for demographic-responsive education policy", confidence: 0.82 }
        ]
      },
      "POP_FOOD_SECURITY": {
        fullName: "Food Security & Population Growth", label: "Food Security & Population Growth", tier: 'operational',
        function: "Food Security & Population Growth operations and analysis for population domain",
        dysregulation: "Operational gaps in food security & population growth affecting population system integrity",
        expectedTypes: [
          { type: "Food Security & Population Growth provider", reason: "FAO Food Price Index, WFP Hunger Map, IFPRI Global Food Policy for food-population nexus monitoring", confidence: 0.85 },
          { type: "Food Security & Population Growth institution", reason: "CGIAR, FAO, World Bank Agriculture for food security research linked to population growth", confidence: 0.82 }
        ]
      },
      "POP_CHILD_WELFARE": {
        fullName: "Child Welfare & Youth Services", label: "Child Welfare & Youth Services", tier: 'operational',
        function: "Child Welfare & Youth Services operations and analysis for population domain",
        dysregulation: "Operational gaps in child welfare & youth services affecting population system integrity",
        expectedTypes: [
          { type: "Child Welfare & Youth Services provider", reason: "UNICEF State of the World Children, Save the Children, CRS for child welfare programs", confidence: 0.85 },
          { type: "Child Welfare & Youth Services institution", reason: "CDC ACE (Adverse Childhood Experiences), HHS Administration for Children and Families for child welfare data", confidence: 0.82 }
        ]
      },
      "POP_REPRO_RIGHTS": {
        fullName: "Reproductive Rights & Access", label: "Reproductive Rights & Access", tier: 'operational',
        function: "Reproductive Rights & Access operations and analysis for population domain",
        dysregulation: "Operational gaps in reproductive rights & access affecting population system integrity",
        expectedTypes: [
          { type: "Reproductive Rights & Access provider", reason: "Guttmacher Institute reproductive rights tracker, Center for Reproductive Rights, Planned Parenthood for access monitoring", confidence: 0.85 },
          { type: "Reproductive Rights & Access institution", reason: "UNFPA reproductive rights, WHO reproductive health, UN Population Fund for international reproductive rights", confidence: 0.82 }
        ]
      },
      "POP_GIS_DEMOG": {
        fullName: "Demographic GIS & Spatial Analysis", label: "Demographic GIS & Spatial Analysis", tier: 'operational',
        function: "Demographic GIS & Spatial Analysis operations and analysis for population domain",
        dysregulation: "Operational gaps in demographic gis & spatial analysis affecting population system integrity",
        expectedTypes: [
          { type: "Demographic GIS & Spatial Analysis provider", reason: "Esri ArcGIS demographic tools, CARTO population analytics, WorldPop spatial population for demographic GIS", confidence: 0.85 },
          { type: "Demographic GIS & Spatial Analysis institution", reason: "NASA SEDAC (Socioeconomic Data), Meta Data for Good, Flowminder for spatial population estimation", confidence: 0.82 }
        ]
      },
      "POP_SATELLITE_EST": {
        fullName: "Satellite-Derived Population Estimation", label: "Satellite-Derived Population Estimation", tier: 'operational',
        function: "Satellite-Derived Population Estimation operations and analysis for population domain",
        dysregulation: "Operational gaps in satellite-derived population estimation affecting population system integrity",
        expectedTypes: [
          { type: "Satellite-Derived Population Estimation provider", reason: "WorldPop, Meta High Resolution Settlement Layer, Oak Ridge LandScan for satellite population estimates", confidence: 0.85 },
          { type: "Satellite-Derived Population Estimation institution", reason: "UN Global Pulse satellite analytics, World Bank remote sensing poverty for satellite-derived demography", confidence: 0.82 }
        ]
      },
      "POP_MOBILE_DATA": {
        fullName: "Mobile Phone Data for Demography", label: "Mobile Phone Data for Demography", tier: 'operational',
        function: "Mobile Phone Data for Demography operations and analysis for population domain",
        dysregulation: "Operational gaps in mobile phone data for demography affecting population system integrity",
        expectedTypes: [
          { type: "Mobile Phone Data for Demography provider", reason: "Flowminder (mobile data demography), Unacast mobility, Cuebiq (Spectus), X-Mode (Outlogic) for mobile demographic data", confidence: 0.85 },
          { type: "Mobile Phone Data for Demography institution", reason: "ITU Digital Development, GSMA Mobile for Development, UN Global Pulse mobile data for mobile-based population analytics", confidence: 0.82 }
        ]
      },
      "POP_SURVEY_METHODS": {
        fullName: "Demographic Survey Methodology", label: "Demographic Survey Methodology", tier: 'operational',
        function: "Demographic Survey Methodology operations and analysis for population domain",
        dysregulation: "Operational gaps in demographic survey methodology affecting population system integrity",
        expectedTypes: [
          { type: "Demographic Survey Methodology provider", reason: "DHS Program (USAID), UNICEF MICS, Gallup World Poll, Afrobarometer for demographic survey platforms", confidence: 0.85 },
          { type: "Demographic Survey Methodology institution", reason: "IPUMS harmonization, Survey Solutions (World Bank), KoboToolbox for survey data collection and harmonization", confidence: 0.82 }
        ]
      },
      "POP_DATA_PRIVACY": {
        fullName: "Population Data Privacy & Ethics", label: "Population Data Privacy & Ethics", tier: 'operational',
        function: "Population Data Privacy & Ethics operations and analysis for population domain",
        dysregulation: "Operational gaps in population data privacy & ethics affecting population system integrity",
        expectedTypes: [
          { type: "Population Data Privacy & Ethics provider", reason: "OneTrust population data compliance, BigID census data, Privitar demographic anonymization for privacy technology", confidence: 0.85 },
          { type: "Population Data Privacy & Ethics institution", reason: "UNECE census confidentiality guidelines, Eurostat statistical disclosure control, Census Bureau DAS for privacy policy", confidence: 0.82 }
        ]
      },
      "POP_ECON_DEMOG": {
        fullName: "Economic Demography & Dividend", label: "Economic Demography & Dividend", tier: 'operational',
        function: "Economic Demography & Dividend operations and analysis for population domain",
        dysregulation: "Operational gaps in economic demography & dividend affecting population system integrity",
        expectedTypes: [
          { type: "Economic Demography & Dividend provider", reason: "World Bank demographic dividend reports, UNFPA demographic dividend initiative, National Transfer Accounts for economic demography", confidence: 0.85 },
          { type: "Economic Demography & Dividend institution", reason: "IMF Fiscal Monitor demographic chapter, OECD Long-Term Baseline Projections for population-economic linkage", confidence: 0.82 }
        ]
      },
      "POP_POLITICAL_DEMOG": {
        fullName: "Political Demography & Electoral Impact", label: "Political Demography & Electoral Impact", tier: 'operational',
        function: "Political Demography & Electoral Impact operations and analysis for population domain",
        dysregulation: "Operational gaps in political demography & electoral impact affecting population system integrity",
        expectedTypes: [
          { type: "Political Demography & Electoral Impact provider", reason: "Pew Research Center demographic politics, Brookings Governance Studies, census apportionment data for political demography", confidence: 0.85 },
          { type: "Political Demography & Electoral Impact institution", reason: "IFES (International Foundation for Electoral Systems), IDEA Voter Turnout, census redistricting for electoral demographics", confidence: 0.82 }
        ]
      },
      "POP_SOCIAL_SEC": {
        fullName: "Social Security & Public Pension Admin", label: "Social Security & Public Pension Admin", tier: 'operational',
        function: "Social Security & Public Pension Admin operations and analysis for population domain",
        dysregulation: "Operational gaps in social security & public pension admin affecting population system integrity",
        expectedTypes: [
          { type: "Social Security & Public Pension Admin provider", reason: "SSA Office of the Actuary, CMS Medicare Trust Fund, PBGC (Pension Benefit Guaranty) for U.S. social security", confidence: 0.85 },
          { type: "Social Security & Public Pension Admin institution", reason: "OECD Pensions at a Glance, ILO Social Protection, World Bank Pension Reform Primer for global pension systems", confidence: 0.82 }
        ]
      },
      "POP_HEALTH_INS": {
        fullName: "Health Insurance & Coverage", label: "Health Insurance & Coverage", tier: 'operational',
        function: "Health Insurance & Coverage operations and analysis for population domain",
        dysregulation: "Operational gaps in health insurance & coverage affecting population system integrity",
        expectedTypes: [
          { type: "Health Insurance & Coverage provider", reason: "UnitedHealth Group (UNH), Elevance Health (ELV), Cigna (CI), Humana (HUM), Centene (CNC) for health insurance operations", confidence: 0.85 },
          { type: "Health Insurance & Coverage institution", reason: "CMS National Health Expenditure, WHO Universal Health Coverage, World Bank health financing for coverage tracking", confidence: 0.82 }
        ]
      },
      "POP_INTL_ORG": {
        fullName: "International Population Organizations", label: "International Population Organizations", tier: 'operational',
        function: "International Population Organizations operations and analysis for population domain",
        dysregulation: "Operational gaps in international population organizations affecting population system integrity",
        expectedTypes: [
          { type: "International Population Organizations provider", reason: "UNFPA, IIASA, IUSSP (International Union for Scientific Study of Population), PAA for international population organizations", confidence: 0.85 },
          { type: "International Population Organizations institution", reason: "UN Population Division, WHO, UNICEF, World Bank Population for multilateral population governance", confidence: 0.82 }
        ]
      },
      "POP_NGO": {
        fullName: "Population NGO Network", label: "Population NGO Network", tier: 'operational',
        function: "Population NGO Network operations and analysis for population domain",
        dysregulation: "Operational gaps in population ngo network affecting population system integrity",
        expectedTypes: [
          { type: "Population NGO Network provider", reason: "Population Council, PRB (Population Reference Bureau), Population Services International (PSI), Pathfinder International for population NGOs", confidence: 0.85 },
          { type: "Population NGO Network institution", reason: "Bill & Melinda Gates Foundation population programs, Wellcome Trust, Hewlett Foundation population for philanthropic funding", confidence: 0.82 }
        ]
      },
      "POP_ACADEMIC": {
        fullName: "Academic Demography Programs", label: "Academic Demography Programs", tier: 'operational',
        function: "Academic Demography Programs operations and analysis for population domain",
        dysregulation: "Operational gaps in academic demography programs affecting population system integrity",
        expectedTypes: [
          { type: "Academic Demography Programs provider", reason: "Princeton OPR, UC Berkeley Demography, Max Planck MPIDR, INED Paris, Wittgenstein Centre Vienna for academic demography", confidence: 0.85 },
          { type: "Academic Demography Programs institution", reason: "PAA, IUSSP, EAPS (European Association for Population Studies), APA (Asian Population Association) for academic societies", confidence: 0.82 }
        ]
      },
      "POP_ACTUARIAL_ED": {
        fullName: "Actuarial Education & Workforce", label: "Actuarial Education & Workforce", tier: 'operational',
        function: "Actuarial Education & Workforce operations and analysis for population domain",
        dysregulation: "Operational gaps in actuarial education & workforce affecting population system integrity",
        expectedTypes: [
          { type: "Actuarial Education & Workforce provider", reason: "Society of Actuaries (SOA), Casualty Actuarial Society (CAS), Institute and Faculty of Actuaries (IFoA) for actuarial certification", confidence: 0.85 },
          { type: "Actuarial Education & Workforce institution", reason: "Milliman, Mercer, Willis Towers Watson, Aon actuarial practices for actuarial employer pipeline", confidence: 0.82 }
        ]
      },
      "POP_PH_WORKFORCE": {
        fullName: "Public Health Workforce Development", label: "Public Health Workforce Development", tier: 'operational',
        function: "Public Health Workforce Development operations and analysis for population domain",
        dysregulation: "Operational gaps in public health workforce development affecting population system integrity",
        expectedTypes: [
          { type: "Public Health Workforce Development provider", reason: "CDC Public Health Workforce, ASTHO State Health Workforce, NACCHO local health workforce for public health staffing", confidence: 0.85 },
          { type: "Public Health Workforce Development institution", reason: "WHO Health Workforce, GHWA Global Health Workforce Alliance, Johns Hopkins Bloomberg SPH for health workforce training", confidence: 0.82 }
        ]
      },
      "POP_CENSUS_TECH": {
        fullName: "Census Technology & Modernization", label: "Census Technology & Modernization", tier: 'operational',
        function: "Census Technology & Modernization operations and analysis for population domain",
        dysregulation: "Operational gaps in census technology & modernization affecting population system integrity",
        expectedTypes: [
          { type: "Census Technology & Modernization provider", reason: "Pegasystems (PEGA) government, Palantir census applications, Salesforce Government Cloud for census IT modernization", confidence: 0.85 },
          { type: "Census Technology & Modernization institution", reason: "U.S. Census Bureau CEDCaP, UK ONS Census Transformation, ABS Australia digital census for census modernization programs", confidence: 0.82 }
        ]
      },
      "POP_VITAL_DIGITAL": {
        fullName: "Digital Vital Registration", label: "Digital Vital Registration", tier: 'operational',
        function: "Digital Vital Registration operations and analysis for population domain",
        dysregulation: "Operational gaps in digital vital registration affecting population system integrity",
        expectedTypes: [
          { type: "Digital Vital Registration provider", reason: "DHIS2 (University of Oslo), OpenCRVS, Plan International CRVS Digitisation for digital vital registration systems", confidence: 0.85 },
          { type: "Digital Vital Registration institution", reason: "WHO CRVS, UNICEF Birth Registration, Bloomberg Data for Health Initiative for digital vital registration", confidence: 0.82 }
        ]
      },
      "POP_IDENTITY_DOC": {
        fullName: "Population Identity & Civil ID", label: "Population Identity & Civil ID", tier: 'operational',
        function: "Population Identity & Civil ID operations and analysis for population domain",
        dysregulation: "Operational gaps in population identity & civil id affecting population system integrity",
        expectedTypes: [
          { type: "Population Identity & Civil ID provider", reason: "IDEMIA (biometric ID), Thales (national ID), HID Global, NEC identity solutions for population identity systems", confidence: 0.85 },
          { type: "Population Identity & Civil ID institution", reason: "World Bank ID4D (Identification for Development), UNHCR PRIMES, Aadhaar (UIDAI India) for civil identity programs", confidence: 0.82 }
        ]
      },
      "POP_MICRODATA": {
        fullName: "Population Microdata & Records", label: "Population Microdata & Records", tier: 'operational',
        function: "Population Microdata & Records operations and analysis for population domain",
        dysregulation: "Operational gaps in population microdata & records affecting population system integrity",
        expectedTypes: [
          { type: "Population Microdata & Records provider", reason: "IPUMS (University of Minnesota), Integrated Census Microdata, UK Data Service, GESIS for population microdata access", confidence: 0.85 },
          { type: "Population Microdata & Records institution", reason: "National Archives census records, Ancestry.com (historical), FamilySearch for historical population records", confidence: 0.82 }
        ]
      },
      "POP_INDICATORS": {
        fullName: "Demographic Indicator Systems & SDG", label: "Demographic Indicator Systems & SDG", tier: 'operational',
        function: "Demographic Indicator Systems & SDG operations and analysis for population domain",
        dysregulation: "Operational gaps in demographic indicator systems & sdg affecting population system integrity",
        expectedTypes: [
          { type: "Demographic Indicator Systems & SDG provider", reason: "UN SDG Global Database, World Bank DataBank, OECD.Stat for demographic indicator platforms", confidence: 0.85 },
          { type: "Demographic Indicator Systems & SDG institution", reason: "UN DESA SDG monitoring, WHO Global Health Observatory, UNICEF Data for SDG population targets", confidence: 0.82 }
        ]
      },
      "POP_CONFLICT_DEMOG": {
        fullName: "Conflict Demography & War Mortality", label: "Conflict Demography & War Mortality", tier: 'operational',
        function: "Conflict Demography & War Mortality operations and analysis for population domain",
        dysregulation: "Operational gaps in conflict demography & war mortality affecting population system integrity",
        expectedTypes: [
          { type: "Conflict Demography & War Mortality provider", reason: "ACLED (Armed Conflict Location), Uppsala Conflict Data Program (UCDP), IISS Armed Conflict Survey for conflict demography", confidence: 0.85 },
          { type: "Conflict Demography & War Mortality institution", reason: "ICRC (International Committee of Red Cross), MSF mortality surveys, Lancet war mortality studies for conflict mortality", confidence: 0.82 }
        ]
      },
      "POP_INDIGENOUS": {
        fullName: "Indigenous & Ethnic Demography", label: "Indigenous & Ethnic Demography", tier: 'operational',
        function: "Indigenous & Ethnic Demography operations and analysis for population domain",
        dysregulation: "Operational gaps in indigenous & ethnic demography affecting population system integrity",
        expectedTypes: [
          { type: "Indigenous & Ethnic Demography provider", reason: "IWGIA (Indigenous Work Group), Cultural Survival, First Peoples Worldwide for indigenous demographic monitoring", confidence: 0.85 },
          { type: "Indigenous & Ethnic Demography institution", reason: "UN Permanent Forum on Indigenous Issues, ILO Indigenous and Tribal Peoples Convention, census ethnic coding for ethnic demography", confidence: 0.82 }
        ]
      },
      "POP_HOUSEHOLD": {
        fullName: "Household Composition & Family", label: "Household Composition & Family", tier: 'operational',
        function: "Household Composition & Family operations and analysis for population domain",
        dysregulation: "Operational gaps in household composition & family affecting population system integrity",
        expectedTypes: [
          { type: "Household Composition & Family provider", reason: "U.S. Census American Community Survey, Eurostat EU-SILC, OECD Family Database for household composition data", confidence: 0.85 },
          { type: "Household Composition & Family institution", reason: "DHS Program household surveys, UNICEF MICS household, World Bank LSMS for household demographic analysis", confidence: 0.82 }
        ]
      },
      "POP_YOUTH_BULGE": {
        fullName: "Youth Bulge & Demographic Window", label: "Youth Bulge & Demographic Window", tier: 'operational',
        function: "Youth Bulge & Demographic Window operations and analysis for population domain",
        dysregulation: "Operational gaps in youth bulge & demographic window affecting population system integrity",
        expectedTypes: [
          { type: "Youth Bulge & Demographic Window provider", reason: "UNFPA State of Youth, World Bank Jobs, ILO Youth Employment for youth demographic analysis", confidence: 0.85 },
          { type: "Youth Bulge & Demographic Window institution", reason: "PRB Youth Fact Sheets, Population Council Transitions to Adulthood, African Union Youth for youth bulge policy", confidence: 0.82 }
        ]
      },
      "POP_DEPOPULATION": {
        fullName: "National Depopulation & Decline", label: "National Depopulation & Decline", tier: 'operational',
        function: "National Depopulation & Decline operations and analysis for population domain",
        dysregulation: "Operational gaps in national depopulation & decline affecting population system integrity",
        expectedTypes: [
          { type: "National Depopulation & Decline provider", reason: "Japan NIPSSR population projections, Korea Statistics Office, Italy ISTAT, Bulgaria NSI for national depopulation monitoring", confidence: 0.85 },
          { type: "National Depopulation & Decline institution", reason: "OECD Regional Demography, EU Cohesion depopulation indicators, World Bank rural-urban for depopulation tracking", confidence: 0.82 }
        ]
      },
      "POP_LONGEVITY": {
        fullName: "Longevity Science & Life Extension", label: "Longevity Science & Life Extension", tier: 'operational',
        function: "Longevity Science & Life Extension operations and analysis for population domain",
        dysregulation: "Operational gaps in longevity science & life extension affecting population system integrity",
        expectedTypes: [
          { type: "Longevity Science & Life Extension provider", reason: "Calico (Alphabet), Unity Biotechnology (UBX), Insilico Medicine, Altos Labs for longevity biotech", confidence: 0.85 },
          { type: "Longevity Science & Life Extension institution", reason: "NIA Biology of Aging, Buck Institute for Research on Aging, SENS Research Foundation for longevity science", confidence: 0.82 }
        ]
      },
      "POP_DISABILITY": {
        fullName: "Disability Demographics", label: "Disability Demographics", tier: 'operational',
        function: "Disability Demographics operations and analysis for population domain",
        dysregulation: "Operational gaps in disability demographics affecting population system integrity",
        expectedTypes: [
          { type: "Disability Demographics provider", reason: "WHO Global Disability Action Plan, World Bank Disability Inclusion, Washington Group on Disability Statistics for disability data", confidence: 0.85 },
          { type: "Disability Demographics institution", reason: "CDC National Health Interview Survey disability, UN CRPD monitoring, Eurostat EHIS disability for disability tracking", confidence: 0.82 }
        ]
      },
      "POP_BIODEMOG": {
        fullName: "Biodemography & Evolutionary Demography", label: "Biodemography & Evolutionary Demography", tier: 'operational',
        function: "Biodemography & Evolutionary Demography operations and analysis for population domain",
        dysregulation: "Operational gaps in biodemography & evolutionary demography affecting population system integrity",
        expectedTypes: [
          { type: "Biodemography & Evolutionary Demography provider", reason: "Max Planck MPIDR biodemography lab, Duke Population Research Institute, Stanford Morrison Institute for biodemographic research", confidence: 0.85 },
          { type: "Biodemography & Evolutionary Demography institution", reason: "Human Mortality Database, Human Fertility Database, Primate Life Histories Database for comparative biodemography", confidence: 0.82 }
        ]
      },
      "POP_MATHEMATICAL": {
        fullName: "Mathematical Demography", label: "Mathematical Demography", tier: 'operational',
        function: "Mathematical Demography operations and analysis for population domain",
        dysregulation: "Operational gaps in mathematical demography affecting population system integrity",
        expectedTypes: [
          { type: "Mathematical Demography provider", reason: "IIASA population mathematics, UN Population Division projection methodology, Wittgenstein Centre for formal demography", confidence: 0.85 },
          { type: "Mathematical Demography institution", reason: "Demographic Research (MPIDR journal), Population Studies (LSE), mathematical demography textbook publishers", confidence: 0.82 }
        ]
      },
      "POP_COMPARATIVE": {
        fullName: "Comparative Demography", label: "Comparative Demography", tier: 'operational',
        function: "Comparative Demography operations and analysis for population domain",
        dysregulation: "Operational gaps in comparative demography affecting population system integrity",
        expectedTypes: [
          { type: "Comparative Demography provider", reason: "OECD cross-country demographic indicators, World Bank WDI, UNDP Human Development Report for comparative demography", confidence: 0.85 },
          { type: "Comparative Demography institution", reason: "Eurostat demographic comparisons, DHS Program STATcompiler, IPUMS International for cross-national comparison", confidence: 0.82 }
        ]
      },
      "POP_HEALTH_EQUITY": {
        fullName: "Population Health Equity", label: "Population Health Equity", tier: 'operational',
        function: "Population Health Equity operations and analysis for population domain",
        dysregulation: "Operational gaps in population health equity affecting population system integrity",
        expectedTypes: [
          { type: "Population Health Equity provider", reason: "RWJF (Robert Wood Johnson Foundation) health equity, CDC Office of Health Equity, WHO Health Equity for health equity programs", confidence: 0.85 },
          { type: "Population Health Equity institution", reason: "IHME subnational health disparities, County Health Rankings, Drexel Urban Health Collaborative for health equity data", confidence: 0.82 }
        ]
      },
      "POP_URBANIZATION_MONITOR": {
        fullName: "Urbanization Rate Monitoring", label: "Urbanization Rate Monitoring", tier: 'operational',
        function: "Urbanization Rate Monitoring operations and analysis for population domain",
        dysregulation: "Operational gaps in urbanization rate monitoring affecting population system integrity",
        expectedTypes: [
          { type: "Urbanization Rate Monitoring provider", reason: "UN World Urbanization Prospects, World Bank urban population data, Eurostat urban audit for urbanization monitoring", confidence: 0.85 },
          { type: "Urbanization Rate Monitoring institution", reason: "UN-Habitat Global Urban Observatory, Lincoln Institute of Land Policy, NYU Urban Expansion for urbanization tracking", confidence: 0.82 }
        ]
      },
      "POP_DEMOGRAPHIC_DATA_VIZ": {
        fullName: "Demographic Data Visualization", label: "Demographic Data Visualization", tier: 'operational',
        function: "Demographic Data Visualization operations and analysis for population domain",
        dysregulation: "Operational gaps in demographic data visualization affecting population system integrity",
        expectedTypes: [
          { type: "Demographic Data Visualization provider", reason: "Our World in Data (University of Oxford), Gapminder, PopulationPyramid.net for demographic data visualization", confidence: 0.85 },
          { type: "Demographic Data Visualization institution", reason: "Tableau Public demographic dashboards, D3.js demographic visualization, Flourish Studio for demographic storytelling", confidence: 0.82 }
        ]
      }
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
    var brain = brains.get('population');
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

  function getScienceState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('population');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getScienceState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('population') : null;
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
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Science. It will appear as a valid target in grants, investments, and patent searches tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Science.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Population mapping for audit tracking. Requires further validation.';
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

  window.LIMENPopulationBusinessEngine = {
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

  loadFullHierarchy(function () { console.log('[ScienceBusinessEngine] Hierarchy loaded'); });

  console.log('[ScienceBusinessEngine] Loaded \u2014 103-node full-hierarchy population business assignment engine');

})();
