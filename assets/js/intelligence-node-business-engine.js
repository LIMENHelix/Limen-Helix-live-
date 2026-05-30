/**
 * intelligence-node-business-engine.js — Intelligence Node-to-Business Assignment Engine
 *
 * INTELLIGENCE DOMAIN ONLY. Full-hierarchy inference layer.
 * 103 operational nodes mapped (20 INTELLIGENCE-TOP + 83 INTELLIGENCE-OPERATIONAL).
 * Excludes the same 20 RI / framework nodes as locked domains.
 * (123 total brain nodes - 20 RI exclusions = 103 operational.)
 *
 * Self-gates: only runs when ?domain=intelligence
 * Exposes: window.LIMENIntelligenceBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'intelligence') return;

  var STORAGE_KEY = 'limen_intelligence_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_intelligence_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

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
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // 20 INTELLIGENCE-TOP (full neuroTranslation) + 83 INTELLIGENCE-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── INTELLIGENCE-TOP NODES (19) — full detail with neuroTranslation ──
    'DMN': {
      fullName: 'Default Mode Network', label: 'Intelligence Hypothesis Generation & Threat Imagination', tier: 'top',
      neuroTranslation: { inNeurology: 'Generates spontaneous thought, mental simulation, and counterfactual reasoning when the brain is not task-focused.', inBusiness: 'In intelligence, hypothesis generation is the work of imagining what adversaries might do, modeling threat scenarios, and generating alternative hypotheses before evidence arrives.' },
      function: 'Generates threat hypotheses, models adversary decision-making, and produces alternative analytic scenarios',
      dysregulation: 'Failure of imagination, mirror-imaging, inability to anticipate strategic surprise',
      expectedTypes: [
        { type: 'Threat modeling and wargaming platform', reason: 'Palantir AIP scenario modeling, RAND wargaming for ODNI, CSIS strategic simulation', confidence: 0.90 },
        { type: 'Red team and alternative analysis service', reason: 'Booz Allen DarkLabs red team, Two Six Technologies adversary emulation for DIA', confidence: 0.88 },
        { type: 'AI-driven hypothesis generation tool', reason: 'Recorded Future predictive intelligence, BigBear.ai threat forecasting for SOCOM', confidence: 0.85 },
        { type: 'Structured analytic technique platform', reason: 'IARPA ACE/FOCUS forecasting tournament technology, Palantir analyst notebook ACH tools', confidence: 0.82 },
        { type: 'Adversary doctrine research', reason: 'CNA Russia Studies, RAND China military doctrine analysis, DIA Red Book production support', confidence: 0.80 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Intelligence Collection Planning', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains working memory and goal-directed reasoning across abstract plans.', inBusiness: 'In intelligence, collection planning is the work of deciding what to collect, from which sensors, against which targets, and in what priority \u2014 SIGINT, HUMINT, GEOINT, OSINT, and MASINT.' },
      function: 'Plans and manages multi-INT collection across SIGINT, HUMINT, GEOINT, OSINT, and MASINT',
      dysregulation: 'Collection gaps, sensor misallocation, priority mismatch between policymaker needs and collection capacity',
      expectedTypes: [
        { type: 'Collection management platform', reason: 'Palantir MetaConstellation satellite tasking, L3Harris SIGINT collection management under ITES-3S', confidence: 0.92 },
        { type: 'Commercial GEOINT provider', reason: 'BlackSky EOCL contract, Planet Labs NRO daily imagery, Maxar NGA foundation GEOINT', confidence: 0.90 },
        { type: 'SIGINT collection system manufacturer', reason: 'L3Harris SIGINT platforms, Northrop Grumman ground-based SIGINT processing for NSA', confidence: 0.90 },
        { type: 'HUMINT support contractor', reason: 'Booz Allen CIA operations support, CACI DIA HUMINT under SITE III', confidence: 0.88 },
        { type: 'OSINT collection platform', reason: 'Recorded Future Intelligence Graph, Babel Street, Dataminr real-time open-source collection', confidence: 0.85 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Intelligence Quality Control & Analytic Standards', tier: 'top',
      neuroTranslation: { inNeurology: 'Monitors conflict and errors and signals when adjustment is needed.', inBusiness: 'In intelligence, quality control is the work of tradecraft review, confidence ratings, ensuring NIE dissents are properly documented, and maintaining analytic integrity.' },
      function: 'Enforces analytic tradecraft standards, A/B/C confidence ratings, and quality control across intelligence products',
      dysregulation: 'Groupthink, politicized analysis, missed dissents, degraded tradecraft',
      expectedTypes: [
        { type: 'Analytic tradecraft review platform', reason: 'Palantir AIP tradecraft audit workflows, ODNI Analytic Integrity and Standards office support by Booz Allen', confidence: 0.85 },
        { type: 'Structured analysis tool', reason: 'Two Six Technologies structured analytic technique tools for DIA DI, IARPA forecasting technology', confidence: 0.82 },
        { type: 'Intelligence product quality assurance', reason: 'Leidos SITE III analytic review support, CACI intelligence production quality under Alliant 2', confidence: 0.80 },
        { type: 'Bias detection and calibration tool', reason: 'IARPA CREATE program bias detection, BigBear.ai calibrated confidence scoring', confidence: 0.78 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Multi-INT Fusion & All-Source Analysis', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates attention and task control across regions in response to changing demands.', inBusiness: 'In intelligence, multi-INT fusion is the work of combining SIGINT, GEOINT, HUMINT, OSINT, and MASINT into finished intelligence that no single INT could produce alone.' },
      function: 'Fuses multiple intelligence disciplines into all-source finished intelligence products',
      dysregulation: 'Stovepiped analysis, failure to correlate across INTs, missed patterns visible only in fusion',
      expectedTypes: [
        { type: 'All-source fusion platform', reason: 'Palantir Gotham/Foundry for IC all-source fusion, Leidos NGA GEOINT Analytic Modernization', confidence: 0.92 },
        { type: 'Cross-INT correlation engine', reason: 'Elastic deployed on classified networks for cross-INT search, Snowflake Government cross-agency data sharing', confidence: 0.88 },
        { type: 'IC ITE data infrastructure', reason: 'AWS C2S and Azure Government cloud for IC data lake, GDIT IC network operations', confidence: 0.90 },
        { type: 'AI-augmented fusion tool', reason: 'BigBear.ai predictive intelligence for DIA, C3.ai federal AI for pattern detection, Confluent real-time streaming', confidence: 0.85 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Intelligence Operations Execution', tier: 'top',
      neuroTranslation: { inNeurology: 'Executes planned motor commands that move the body through the environment.', inBusiness: 'In intelligence, operations execution is the work of running agents, conducting technical collection, and executing covert actions approved by the President.' },
      function: 'Executes intelligence operations: agent handling, technical collection, covert action',
      dysregulation: 'Blown operations, asset compromise, collection system failures, covert action exposure',
      expectedTypes: [
        { type: 'Clandestine operations support contractor', reason: 'Booz Allen CIA operations support, CACI HUMINT operations under INSCOM ITES-3S', confidence: 0.88 },
        { type: 'Technical collection system integrator', reason: 'L3Harris SIGINT collection platforms, Northrop Grumman NRO satellite systems', confidence: 0.92 },
        { type: 'Covert communications technology', reason: 'L3Harris tactical COMSEC, General Dynamics TACLANE, classified comms for CIA OTS', confidence: 0.85 },
        { type: 'Special operations intelligence support', reason: 'Peraton SOCOM intelligence support, Two Six Technologies SOF analytics', confidence: 0.82 }
      ]
    },
    'BROCA': {
      fullName: 'Broca Area', label: 'Intelligence Reporting & Dissemination', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces speech by converting thought into structured linguistic output.', inBusiness: 'In intelligence, reporting and dissemination is the work of writing the PDB, NIEs, SNIEs, threat briefs, and warning intelligence that reach the President and combatant commanders.' },
      function: 'Produces and disseminates finished intelligence: PDB, NIE, SNIE, threat briefs, warning intelligence',
      dysregulation: 'Delayed warning, unclear assessments, dissemination failures, compartmentation blocking timely sharing',
      expectedTypes: [
        { type: 'Intelligence production platform', reason: 'Palantir AIP analyst production workflows, Leidos DIA production support under SITE III', confidence: 0.88 },
        { type: 'Secure dissemination system', reason: 'GDIT JWICS operations, L3Harris secure communications for intelligence dissemination', confidence: 0.85 },
        { type: 'Natural language generation for intelligence', reason: 'Primer.ai automated intelligence summary generation, UiPath report automation', confidence: 0.80 },
        { type: 'Compartmented handling system', reason: 'SAP/SCI management platforms, Palantir compartmented access control', confidence: 0.82 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Intelligence Knowledge Networks & Databases', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multimodal information into coherent semantic knowledge.', inBusiness: 'In intelligence, knowledge networks are Intelink, JWICS, NSANet, and IC ITE \u2014 the classified infrastructure that connects every analyst to every database.' },
      function: 'Maintains intelligence knowledge infrastructure: Intelink, JWICS, NSANet, IC ITE',
      dysregulation: 'System outages, database fragmentation, search failures, inability to find prior reporting',
      expectedTypes: [
        { type: 'IC enterprise IT infrastructure', reason: 'GDIT IC classified cloud and network operations, Leidos IC ITE transition support', confidence: 0.92 },
        { type: 'Intelligence search and discovery', reason: 'Elastic full-text search on classified networks, Palantir Foundry data discovery', confidence: 0.88 },
        { type: 'Knowledge management platform', reason: 'MongoDB Atlas for Government unstructured intelligence storage, Confluent event streaming', confidence: 0.85 },
        { type: 'IC cloud migration', reason: 'AWS C2S (CIA), Azure Government (IC elements), Palantir cloud-native analytics', confidence: 0.90 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Intelligence Budget & Resource Allocation', tier: 'top',
      neuroTranslation: { inNeurology: 'Makes strategic tradeoff decisions based on expected value and emotional weighting.', inBusiness: 'In intelligence, budget and resource allocation is the work of dividing the NIP ($23.1B), MIP ($27.9B), TIARA, and JMIP budgets across collection, analysis, and infrastructure.' },
      function: 'Allocates NIP, MIP, TIARA, and JMIP budgets across IC collection, analysis, and infrastructure programs',
      dysregulation: 'Budget misallocation, underfunded collection disciplines, infrastructure technical debt',
      expectedTypes: [
        { type: 'IC budget analytics platform', reason: 'Govini intelligence community budget analysis, Booz Allen ODNI program evaluation', confidence: 0.85 },
        { type: 'IC program management consulting', reason: 'Booz Allen ODNI CAPE support, McKinsey Government IC modernization advisory', confidence: 0.82 },
        { type: 'Portfolio decision support tool', reason: 'Palantir Foundry program portfolio analysis, IDA intelligence program evaluation', confidence: 0.80 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Intelligence Historical Memory & Lessons Learned', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes new memories and retrieves historical context for current situations.', inBusiness: 'In intelligence, historical memory is the work of precedent analysis, historical comparisons, and ensuring the IC does not repeat the same failures.' },
      function: 'Provides historical intelligence context, precedent analysis, and lessons learned from past failures',
      dysregulation: 'Repeat failures, lessons unlearned, inability to recognize historical patterns',
      expectedTypes: [
        { type: 'Intelligence history and lessons learned platform', reason: 'CIA Center for the Study of Intelligence, DIA Lessons Learned program, NGA historical GEOINT archive', confidence: 0.78 },
        { type: 'Historical pattern recognition AI', reason: 'Palantir AIP historical correlation, Recorded Future historical threat database', confidence: 0.80 },
        { type: 'Intelligence archive management', reason: 'SAIC classified archive management, Leidos IC records management under SITE III', confidence: 0.75 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Intelligence Analytic Methodology', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains executive control and inhibits inappropriate responses.', inBusiness: 'In intelligence, analytic methodology is the work of structured analysis techniques \u2014 Analysis of Competing Hypotheses, red teaming, devil\u2019s advocacy, and key assumptions checks.' },
      function: 'Applies structured analytic techniques: ACH, red team, devil\u2019s advocacy, key assumptions checks',
      dysregulation: 'Unstructured analysis, confirmation bias, failure to consider alternative hypotheses',
      expectedTypes: [
        { type: 'Structured analytic technique software', reason: 'Palantir AIP ACH module, Two Six Technologies analytic tools for DIA DI', confidence: 0.85 },
        { type: 'Red team service provider', reason: 'Booz Allen red team services, RAND alternative analysis, CSIS wargaming', confidence: 0.82 },
        { type: 'IARPA analytic methodology research', reason: 'IARPA CREATE, FOCUS, and ACE program technology; forecasting calibration tools', confidence: 0.80 },
        { type: 'Analytic training platform', reason: 'In-Q-Tel portfolio analytic training tools, DIA Sherman Kent School curriculum support', confidence: 0.75 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Counterintelligence & Adversary Modeling', tier: 'top',
      neuroTranslation: { inNeurology: 'Generates self-referential thought and models other agents\u2019 perspectives.', inBusiness: 'In intelligence, counterintelligence and adversary modeling is the work of CI investigations, detecting double agents, understanding adversary doctrine, and thinking like the enemy.' },
      function: 'Conducts counterintelligence investigations, adversary doctrine analysis, and perspective-taking',
      dysregulation: 'Undetected penetration agents, failure to model adversary intent, CI blind spots',
      expectedTypes: [
        { type: 'Counterintelligence analytics platform', reason: 'Palantir Gotham CI link analysis for FBI, Booz Allen DIA CI support', confidence: 0.88 },
        { type: 'Adversary doctrine research', reason: 'CNA Russia/China studies, RAND adversary strategy analysis, DIA Red Book', confidence: 0.85 },
        { type: 'CI investigation support', reason: 'CACI CI operational support under INSCOM ITES-3S, Leidos DCSA CI support', confidence: 0.82 },
        { type: 'Double agent detection technology', reason: 'Insider threat analytics (DTEX, Securonix) adapted for CI, behavioral analysis tools', confidence: 0.78 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'HUMINT & Clandestine Operations', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains baseline body homeostasis through hormonal and autonomic regulation.', inBusiness: 'In intelligence, HUMINT and clandestine operations is the work of case officer operations, asset recruitment, running covert human sources, and managing the human intelligence cycle.' },
      function: 'Manages HUMINT operations: case officer activities, asset recruitment, covert human source handling',
      dysregulation: 'Asset compromise, blown cover, recruitment failures, compromised case officer communications',
      expectedTypes: [
        { type: 'Clandestine communications system', reason: 'L3Harris covert communications, classified CIA OTS (Office of Technical Service) systems', confidence: 0.85 },
        { type: 'HUMINT operations support contractor', reason: 'Booz Allen CIA DO support, CACI DIA HUMINT operations under SITE III, Peraton SOCOM HUMINT', confidence: 0.88 },
        { type: 'Cover development and management', reason: 'Classified cover support programs, commercial cover platforms', confidence: 0.75 },
        { type: 'Asset vetting and validation technology', reason: 'Polygraph systems, behavioral analysis tools, source validation analytics', confidence: 0.78 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'SIGINT & Electronic Intelligence', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates reward value and adjusts behavior based on outcome feedback.', inBusiness: 'In intelligence, SIGINT and electronic intelligence is the work of NSA signals collection \u2014 COMINT, ELINT, and network exploitation that provides the largest volume of raw intelligence.' },
      function: 'Conducts SIGINT operations: COMINT, ELINT, network exploitation, and signals processing',
      dysregulation: 'Encrypted communications gaps, SIGINT overload without adequate processing, collection against wrong targets',
      expectedTypes: [
        { type: 'SIGINT collection platform manufacturer', reason: 'L3Harris SIGINT systems, Northrop Grumman signals processing, BAE Systems electronic intelligence', confidence: 0.92 },
        { type: 'Signals processing and analysis contractor', reason: 'CACI NSA SIGINT processing under ITES-3S, Leidos NSA mission support', confidence: 0.90 },
        { type: 'Network exploitation tool', reason: 'Classified CNE tools, two-way access development technology for NSA TAO/CES', confidence: 0.85 },
        { type: 'Encryption and decryption technology', reason: 'NSA Crypto School technology, General Dynamics TACLANE, Wickr Government', confidence: 0.82 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Quantitative Intelligence & Measurement (MASINT)', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes numerical magnitude, spatial attention, and quantitative reasoning.', inBusiness: 'In intelligence, MASINT is the work of technical collection \u2014 nuclear monitoring, seismic detection, chemical/biological sampling, and radar cross-section measurement.' },
      function: 'Conducts MASINT: nuclear monitoring, seismic/acoustic detection, chemical/biological sampling, radar measurement',
      dysregulation: 'Missed nuclear tests, undetected WMD programs, technical collection sensor gaps',
      expectedTypes: [
        { type: 'Nuclear monitoring system', reason: 'AFTAC (Air Force Technical Applications Center) contractor support, seismic/infrasound detection', confidence: 0.85 },
        { type: 'Chemical/biological detection technology', reason: 'FLIR/Teledyne CBRN sensors, Smiths Detection, DTRA contractor support', confidence: 0.82 },
        { type: 'Technical collection platform', reason: 'Northrop Grumman classified MASINT platforms, L3Harris measurement systems', confidence: 0.85 },
        { type: 'Radar cross-section and signature analysis', reason: 'Raytheon Intelligence & Space signature analysis, BAE Systems radar measurement', confidence: 0.80 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'GEOINT & Imagery Intelligence', tier: 'top',
      neuroTranslation: { inNeurology: 'Aggregates interoceptive sensor data from across the body into a unified internal state.', inBusiness: 'In intelligence, GEOINT is the work of NGA \u2014 satellite imagery, IMINT analysis, terrain modeling, change detection, and the geospatial foundation that every operation depends on.' },
      function: 'Produces GEOINT: satellite imagery analysis, terrain modeling, change detection, foundation data',
      dysregulation: 'Imagery gaps, missed change detection, terrain data errors, GEOINT production backlogs',
      expectedTypes: [
        { type: 'Commercial satellite imagery provider', reason: 'BlackSky EOCL, Planet Labs NRO/NGA contract, Maxar NGA foundation GEOINT (Vivid imagery basemap)', confidence: 0.92 },
        { type: 'GEOINT analysis platform', reason: 'Palantir Gaia for NGA, BAE Systems GXP, Leidos NGA GEOINT Analytic Modernization', confidence: 0.90 },
        { type: 'Change detection and terrain modeling', reason: 'AI-powered change detection on satellite imagery, 3D terrain modeling (Vricon/Maxar)', confidence: 0.85 },
        { type: 'NGA prime contractor', reason: 'Leidos, BAE Systems, SAIC \u2014 NGA BSP (Basic SIGINT Products) and foundation GEOINT production', confidence: 0.88 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Open Source Intelligence (OSINT)', tier: 'top',
      neuroTranslation: { inNeurology: 'Attributes mental states to other agents and shifts attention to socially relevant stimuli.', inBusiness: 'In intelligence, OSINT is the work of collecting and analyzing publicly available information \u2014 social media, news, commercial data, gray literature, and the open internet.' },
      function: 'Collects and analyzes open-source intelligence: social media, news, commercial data, gray literature',
      dysregulation: 'OSINT overload, failure to integrate open-source with classified reporting, social media manipulation detection gaps',
      expectedTypes: [
        { type: 'OSINT collection and analysis platform', reason: 'Recorded Future Intelligence Graph, Babel Street Locate/Forge, Dataminr real-time alerting', confidence: 0.92 },
        { type: 'Social media analytics vendor', reason: 'Fivecast, Sayari graph analytics, Babel Street social media monitoring', confidence: 0.88 },
        { type: 'Commercial data aggregator', reason: 'Babel Street commercial data, Sayari corporate registry data, public records aggregation', confidence: 0.85 },
        { type: 'Dark web monitoring service', reason: 'Recorded Future dark web collection, Flashpoint, DarkOwl for IC OSINT centers', confidence: 0.82 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate', label: 'Intelligence Oversight & Ethics', tier: 'top',
      neuroTranslation: { inNeurology: 'Reviews completed actions and updates expectations based on outcomes.', inBusiness: 'In intelligence, oversight and ethics is the work of FISA compliance, USSID 18 adherence, EO 12333 implementation, PCLOB review, and congressional oversight \u2014 ensuring the IC operates within the law.' },
      function: 'Enforces intelligence oversight: FISA, USSID 18, EO 12333, PCLOB, congressional oversight compliance',
      dysregulation: 'Compliance violations, unauthorized surveillance, FISA Court findings of noncompliance, congressional investigations',
      expectedTypes: [
        { type: 'IC compliance technology platform', reason: 'Palantir audit trail and data governance, Varonis data access monitoring for classified systems', confidence: 0.85 },
        { type: 'Oversight consulting service', reason: 'Booz Allen ODNI compliance support, ICF International congressional reporting assistance', confidence: 0.82 },
        { type: 'Privacy-enhancing technology', reason: 'CyberArk privileged access management, homomorphic encryption research (In-Q-Tel portfolio)', confidence: 0.80 },
        { type: 'FISA minimization technology', reason: 'Automated U.S. person identification and minimization tools for NSA and FBI', confidence: 0.78 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke Area', label: 'Intelligence IT & Cyber Operations', tier: 'top',
      neuroTranslation: { inNeurology: 'Comprehends spoken and written language, extracting meaning from input.', inBusiness: 'In intelligence, IT and cyber operations is the work of IC ITE, C2S cloud, offensive and defensive cyber operations, and the digital infrastructure the entire IC runs on.' },
      function: 'Manages IC IT infrastructure (IC ITE, C2S cloud) and conducts offensive/defensive cyber operations (CNE/CNA/CND)',
      dysregulation: 'IC ITE migration delays, cloud security breaches, cyber operation exposure, infrastructure fragility',
      expectedTypes: [
        { type: 'IC cloud infrastructure provider', reason: 'AWS C2S (CIA prime), Microsoft Azure Government (IC elements), Palantir cloud-native analytics on IC ITE', confidence: 0.92 },
        { type: 'IC enterprise IT contractor', reason: 'GDIT IC network operations, Leidos IC ITE transition support, SAIC IC systems engineering', confidence: 0.90 },
        { type: 'Cyber operations platform', reason: 'Classified CNE/CNA tools for NSA TAO/CES, CrowdStrike Federal for CND', confidence: 0.88 },
        { type: 'Zero-trust architecture implementer', reason: 'Zscaler Government, Okta Federal, Palo Alto zero-trust for IC networks', confidence: 0.85 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Intelligence Workforce & Training', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays auditory information from the brainstem to the cortex for processing.', inBusiness: 'In intelligence, workforce and training is the work of the IC workforce pipeline \u2014 recruiting, polygraph, TS/SCI clearance processing, language training, and analytic tradecraft education at the Farm, DIA DI school, and NSA Cryptologic School.' },
      function: 'Manages IC workforce: recruitment, polygraph, TS/SCI clearance pipeline, training at the Farm, DIA DI school, NSA Crypt school',
      dysregulation: 'Clearance backlogs, workforce attrition, language skill gaps, analytic tradecraft erosion',
      expectedTypes: [
        { type: 'Personnel security and continuous vetting', reason: 'Leidos DCSA continuous vetting IT, Peraton background investigation support, CACI polygraph services', confidence: 0.88 },
        { type: 'IC workforce analytics', reason: 'Booz Allen ODNI workforce planning, ICF International IC human capital consulting', confidence: 0.82 },
        { type: 'Language training and translation', reason: 'CACI linguist services, Leidos translation support, DLI contractor augmentation', confidence: 0.80 },
        { type: 'Analytic training technology', reason: 'In-Q-Tel portfolio training tools, DIA Sherman Kent School curriculum development support', confidence: 0.78 }
      ]
    },

    // ── INTELLIGENCE-OPERATIONAL NODES (84) ──
    'OP_SIGINT_TACTICAL': { fullName: 'Tactical SIGINT Collection', label: 'Tactical SIGINT', tier: 'operational', function: 'Collects tactical signals intelligence in theater', dysregulation: 'Missed tactical communications, collection latency', expectedTypes: [{ type: 'Tactical SIGINT platform', reason: 'L3Harris Prophet/TROJAN tactical SIGINT under Army INSCOM ITES-3S', confidence: 0.88 }, { type: 'Man-portable SIGINT', reason: 'TRL Technology tactical SIGINT, Harris AN/PRC-163 with SIGINT overlay', confidence: 0.82 }] },
    'OP_ELINT_COLLECTION': { fullName: 'ELINT Collection & Processing', label: 'ELINT Collection', tier: 'operational', function: 'Collects electronic intelligence from radar and electronic emitters', dysregulation: 'Uncharacterized radar threats, ELINT database gaps', expectedTypes: [{ type: 'ELINT receiver system', reason: 'BAE Systems ELINT receivers, Northrop Grumman radar warning receivers', confidence: 0.85 }, { type: 'Emitter database management', reason: 'Leidos ELINT database support for NSA/DIA, SAIC electronic order of battle', confidence: 0.82 }] },
    'OP_COMINT_PROCESS': { fullName: 'COMINT Processing & Analysis', label: 'COMINT Processing', tier: 'operational', function: 'Processes intercepted communications into actionable intelligence', dysregulation: 'Processing backlogs, encryption barriers, language translation delays', expectedTypes: [{ type: 'Communications processing platform', reason: 'CACI NSA COMINT processing under ITES-3S, Leidos signals analysis', confidence: 0.88 }, { type: 'Machine translation technology', reason: 'In-Q-Tel NLP portfolio, Babel Street multilingual processing', confidence: 0.82 }] },
    'OP_AGENT_HANDLING': { fullName: 'Agent Handling & Source Management', label: 'Agent Handling', tier: 'operational', function: 'Manages recruited human intelligence sources in the field', dysregulation: 'Asset compromise, handler-source trust failure, communications exposure', expectedTypes: [{ type: 'Source management system', reason: 'Classified CIA source management IT, Booz Allen DO operations support', confidence: 0.85 }, { type: 'Covert meeting technology', reason: 'L3Harris covert communications devices, CIA OTS technical operations tools', confidence: 0.80 }] },
    'OP_ASSET_VETTING': { fullName: 'Asset Vetting & Validation', label: 'Asset Vetting', tier: 'operational', function: 'Validates intelligence source reliability and detects fabrication or doubled assets', dysregulation: 'Fabricator penetration, unvalidated sources driving analysis, Curveball-type failures', expectedTypes: [{ type: 'Polygraph and behavioral assessment', reason: 'CACI polygraph services for IC elements, Leidos personnel assessment', confidence: 0.82 }, { type: 'Source validation analytics', reason: 'Palantir source correlation analysis, behavioral analytics for deception detection', confidence: 0.78 }] },
    'OP_COVER_DEV': { fullName: 'Cover Development & Management', label: 'Cover Development', tier: 'operational', function: 'Creates and maintains cover identities for clandestine officers', dysregulation: 'Cover blown, identity compromise, commercial cover infrastructure gaps', expectedTypes: [{ type: 'Cover infrastructure', reason: 'CIA cover development programs (classified), commercial cover companies', confidence: 0.75 }, { type: 'Identity management technology', reason: 'Document fabrication and legend building (classified programs)', confidence: 0.72 }] },
    'OP_SAT_TASKING': { fullName: 'Satellite Tasking & Scheduling', label: 'Satellite Tasking', tier: 'operational', function: 'Tasks and schedules satellite collection against priority intelligence requirements', dysregulation: 'Tasking conflicts, revisit gaps, weather interference on optical collection', expectedTypes: [{ type: 'Satellite tasking platform', reason: 'Palantir MetaConstellation for NRO/NGA, BlackSky real-time satellite tasking API', confidence: 0.90 }, { type: 'NRO mission management', reason: 'Northrop Grumman NRO ground systems, L3Harris satellite operations', confidence: 0.88 }] },
    'OP_CHANGE_DETECT': { fullName: 'Change Detection & Activity Monitoring', label: 'Change Detection', tier: 'operational', function: 'Detects changes in satellite imagery indicating adversary activity', dysregulation: 'Missed construction, undetected deployments, change detection false positives', expectedTypes: [{ type: 'AI change detection', reason: 'Planet Labs automated change detection, BlackSky AI-powered activity monitoring', confidence: 0.88 }, { type: 'GEOINT analysis automation', reason: 'Palantir Gaia imagery analysis, BAE Systems GXP automated feature extraction', confidence: 0.85 }] },
    'OP_TERRAIN_MODEL': { fullName: 'Terrain Modeling & 3D Visualization', label: 'Terrain Modeling', tier: 'operational', function: 'Produces 3D terrain models and elevation data for operational planning', dysregulation: 'Inaccurate terrain data, 3D model gaps in denied areas', expectedTypes: [{ type: '3D terrain generation', reason: 'Maxar Vricon 3D terrain, NGA foundation GEOINT production', confidence: 0.85 }, { type: 'Digital twin for operational planning', reason: 'Improbable defense digital twin, Bohemia Interactive Simulations VBS4', confidence: 0.80 }] },
    'OP_SOCIAL_MEDIA_MON': { fullName: 'Social Media Monitoring & Analysis', label: 'Social Media OSINT', tier: 'operational', function: 'Monitors social media platforms for intelligence indicators and influence operations', dysregulation: 'Platform access restrictions, algorithm changes, false positive flood', expectedTypes: [{ type: 'Social media intelligence platform', reason: 'Babel Street social media monitoring, Fivecast AI-powered social analysis', confidence: 0.88 }, { type: 'Influence operation detection', reason: 'Recorded Future influence tracking, Dataminr real-time social alerting', confidence: 0.85 }] },
    'OP_DARK_WEB': { fullName: 'Dark Web Intelligence Collection', label: 'Dark Web Intel', tier: 'operational', function: 'Collects intelligence from dark web forums, markets, and encrypted platforms', dysregulation: 'Access denial, source attribution difficulties, operational security risks', expectedTypes: [{ type: 'Dark web monitoring service', reason: 'Recorded Future dark web collection, Flashpoint intelligence, DarkOwl darknet data', confidence: 0.85 }, { type: 'Cryptocurrency tracing', reason: 'Chainalysis government edition, Elliptic for FBI and IC crypto investigations', confidence: 0.82 }] },
    'OP_CI_OPERATIONS': { fullName: 'Counterintelligence Field Operations', label: 'CI Operations', tier: 'operational', function: 'Conducts counterintelligence investigations and operations against foreign intelligence services', dysregulation: 'Undetected foreign agents, penetration of IC workforce, CI operation exposure', expectedTypes: [{ type: 'CI investigation support', reason: 'CACI CI operations under INSCOM ITES-3S, Booz Allen FBI CI Division support', confidence: 0.85 }, { type: 'CI surveillance technology', reason: 'L3Harris TSCM equipment, physical and technical surveillance platforms', confidence: 0.82 }] },
    'OP_INSIDER_THREAT': { fullName: 'Insider Threat Detection & Prevention', label: 'Insider Threat', tier: 'operational', function: 'Detects and prevents insider threats within the IC workforce', dysregulation: 'Undetected insiders, monitoring gaps, false positive fatigue', expectedTypes: [{ type: 'User activity monitoring', reason: 'DTEX Systems insider threat analytics, Forcepoint behavioral analytics for IC', confidence: 0.88 }, { type: 'Insider threat program support', reason: 'Securonix UEBA for IC, CACI insider threat program management under ITES-3S', confidence: 0.85 }] },
    'OP_CYBER_CNE': { fullName: 'Computer Network Exploitation (CNE)', label: 'Cyber CNE', tier: 'operational', function: 'Conducts offensive cyber operations to collect intelligence from adversary networks', dysregulation: 'Tool exposure, operational failure, attribution blowback', expectedTypes: [{ type: 'Offensive cyber tooling', reason: 'Classified NSA TAO/CES tools, Northrop Grumman cyber mission systems', confidence: 0.88 }, { type: 'Vulnerability research', reason: 'Two Six Technologies vulnerability discovery, Raytheon cyber operations support', confidence: 0.85 }] },
    'OP_CYBER_CNA': { fullName: 'Computer Network Attack (CNA)', label: 'Cyber CNA', tier: 'operational', function: 'Conducts offensive cyber operations to disrupt, deny, or destroy adversary capabilities', dysregulation: 'Collateral damage, unintended effects, escalation risk', expectedTypes: [{ type: 'Cyber weapons development', reason: 'Classified Cyber Command programs, Northrop Grumman offensive cyber platforms', confidence: 0.85 }, { type: 'Effects-based cyber planning', reason: 'Raytheon Intelligence & Space cyber planning tools, BAE Systems cyber effects', confidence: 0.82 }] },
    'OP_CYBER_CND': { fullName: 'Computer Network Defense (CND)', label: 'Cyber CND', tier: 'operational', function: 'Defends IC networks against cyber intrusion and attack', dysregulation: 'Breached networks, persistent adversary presence, patch management failures', expectedTypes: [{ type: 'Federal endpoint protection', reason: 'CrowdStrike Federal Falcon, SentinelOne government, Palo Alto Cortex XDR', confidence: 0.92 }, { type: 'Network monitoring and SIEM', reason: 'Fortinet FortiSIEM, Elastic SIEM on classified networks, Splunk Federal', confidence: 0.88 }] },
    'OP_WARNING_INTEL': { fullName: 'Warning Intelligence & Indications', label: 'Warning Intelligence', tier: 'operational', function: 'Provides strategic and tactical warning of imminent threats', dysregulation: 'Warning failure, false negatives, cry-wolf false positives', expectedTypes: [{ type: 'Indications and warning platform', reason: 'Palantir AIP for I&W workflows, Recorded Future threat intelligence for DIA I&W', confidence: 0.88 }, { type: 'Strategic warning analysis', reason: 'Booz Allen ODNI National Intelligence Warning support, CSIS strategic warning research', confidence: 0.82 }] },
    'OP_INTEL_DISSEM': { fullName: 'Intelligence Dissemination & Sharing', label: 'Intel Dissemination', tier: 'operational', function: 'Disseminates finished intelligence to authorized consumers across classification levels', dysregulation: 'Dissemination delays, over-classification, tearline failures', expectedTypes: [{ type: 'Secure dissemination platform', reason: 'GDIT JWICS operations, L3Harris secure messaging, IC ITE collaboration tools', confidence: 0.85 }, { type: 'Tearline and downgrade technology', reason: 'Automated tearline generation, classification management tools for multi-level security', confidence: 0.78 }] },
    'OP_COMPART_HANDLE': { fullName: 'Compartmented Information Handling', label: 'SCI Handling', tier: 'operational', function: 'Manages Special Compartmented Information (SCI) and Special Access Programs (SAP)', dysregulation: 'Compartmentation breaches, SAP spillage, need-to-know violations', expectedTypes: [{ type: 'SCI management platform', reason: 'Palantir compartmented access control, classified SCI management IT systems', confidence: 0.82 }, { type: 'SCIF construction and accreditation', reason: 'Parsons SCIF construction, CACI SCIF accreditation support', confidence: 0.80 }] },
    'OP_CI_POLYGRAPH': { fullName: 'CI Polygraph & Personnel Security', label: 'CI Polygraph', tier: 'operational', function: 'Conducts counterintelligence polygraph examinations for IC personnel', dysregulation: 'Polygraph backlogs, false negative rates, CI screening gaps', expectedTypes: [{ type: 'Polygraph examination services', reason: 'CACI polygraph examiners, Leidos DCSA polygraph program support', confidence: 0.85 }, { type: 'Continuous vetting technology', reason: 'Peraton DCSA continuous vetting, automated records checks for CV', confidence: 0.82 }] },
    'OP_PERSONNEL_SEC': { fullName: 'Personnel Security & Clearance Processing', label: 'Personnel Security', tier: 'operational', function: 'Processes TS/SCI security clearances and conducts background investigations', dysregulation: 'Clearance backlogs (200K+ in queue), investigation quality gaps, OPM-breach aftermath', expectedTypes: [{ type: 'Background investigation contractor', reason: 'Peraton (formerly USIS/KeyPoint) DCSA investigations, Leidos DCSA IT support', confidence: 0.88 }, { type: 'Continuous evaluation platform', reason: 'DCSA Trusted Workforce 2.0 technology, automated CE data feeds', confidence: 0.85 }] },
    'OP_COVERT_ACTION': { fullName: 'Covert Action & Special Activities', label: 'Covert Action', tier: 'operational', function: 'Executes covert action programs authorized by presidential finding', dysregulation: 'Covert action exposure, political blowback, operational failure', expectedTypes: [{ type: 'Special activities support', reason: 'Classified CIA Special Activities Center programs, Peraton SOF intelligence support', confidence: 0.80 }, { type: 'Covert logistics and infrastructure', reason: 'L3Harris tactical equipment, classified procurement and logistics', confidence: 0.78 }] },
    'OP_SPECIAL_OPS_INTEL': { fullName: 'Special Operations Intelligence', label: 'SOF Intel', tier: 'operational', function: 'Provides intelligence support to special operations forces', dysregulation: 'SOF-intelligence integration gaps, targeting errors, actionable intelligence delays', expectedTypes: [{ type: 'SOF intelligence platform', reason: 'Palantir Gotham for SOCOM, Two Six Technologies SOF analytics', confidence: 0.88 }, { type: 'SOF targeting support', reason: 'CACI SOCOM intelligence support, Peraton targeting analytics', confidence: 0.85 }] },
    'OP_INTEL_LAW': { fullName: 'Intelligence Legislation & Legal Compliance', label: 'Intel Law', tier: 'operational', function: 'Ensures IC operations comply with FISA, EO 12333, and other legal authorities', dysregulation: 'Legal authority gaps, FISA violations, unauthorized collection', expectedTypes: [{ type: 'Intelligence legal compliance', reason: 'Booz Allen ODNI general counsel support, IC element legal office consulting', confidence: 0.82 }, { type: 'FISA application technology', reason: 'Automated FISA application processing, compliance audit tools', confidence: 0.78 }] },
    'OP_FISA_COMPLIANCE': { fullName: 'FISA Court Compliance & Minimization', label: 'FISA Compliance', tier: 'operational', function: 'Implements FISA Court orders and minimization procedures', dysregulation: 'FISC compliance findings, minimization failures, query abuse', expectedTypes: [{ type: 'Minimization technology', reason: 'Automated U.S. person identification and minimization engines for NSA', confidence: 0.82 }, { type: 'FISA audit platform', reason: 'Palantir compliance audit, Varonis data access monitoring on IC systems', confidence: 0.80 }] },
    'OP_DENIAL_DECEPTION': { fullName: 'Foreign Denial & Deception Analysis', label: 'D&D Analysis', tier: 'operational', function: 'Analyzes adversary denial and deception operations', dysregulation: 'Failure to detect deception, acceptance of fabricated intelligence, D&D-enabled surprise', expectedTypes: [{ type: 'D&D analysis methodology', reason: 'DIA Foreign Denial & Deception Committee support, Booz Allen D&D analysis', confidence: 0.82 }, { type: 'Deception detection technology', reason: 'AI-powered anomaly detection for deception indicators, Palantir pattern analysis', confidence: 0.78 }] },
    'OP_TSCM': { fullName: 'Technical Surveillance Countermeasures', label: 'TSCM', tier: 'operational', function: 'Detects and neutralizes foreign technical surveillance of U.S. facilities', dysregulation: 'Undetected listening devices, compromised SCIFs, embassy surveillance', expectedTypes: [{ type: 'TSCM equipment manufacturer', reason: 'L3Harris TSCM sweep equipment, REI (Research Electronics International) detection tools', confidence: 0.85 }, { type: 'TSCM inspection services', reason: 'Parsons TSCM services, CACI technical security inspections', confidence: 0.82 }] },
    'OP_SOURCE_PROTECT': { fullName: 'Source Protection & Asset Security', label: 'Source Protection', tier: 'operational', function: 'Protects intelligence sources and methods from compromise', dysregulation: 'Source identity exposure, methods compromise, asset targeting by adversary CI', expectedTypes: [{ type: 'Source protection technology', reason: 'Classified compartmentation systems, secure communications for source protection', confidence: 0.80 }, { type: 'CI damage assessment', reason: 'Booz Allen CI damage assessment support, CACI CI investigation services', confidence: 0.78 }] },
    'OP_TRAIN_FARM': { fullName: 'Intelligence Training (Farm/Camp Peary)', label: 'The Farm', tier: 'operational', function: 'Conducts clandestine operations training for CIA officers', dysregulation: 'Training pipeline gaps, tradecraft degradation, instructor shortfalls', expectedTypes: [{ type: 'Training facility operations', reason: 'CIA Farm training support contractors, Booz Allen training program development', confidence: 0.78 }, { type: 'Training simulation technology', reason: 'CAE simulation for intelligence training, immersive scenario platforms', confidence: 0.75 }] },
    'OP_ELECTION_SEC': { fullName: 'Election Security Intelligence', label: 'Election Security', tier: 'operational', function: 'Provides intelligence support to election security operations', dysregulation: 'Undetected election interference, attribution delays, interagency coordination gaps', expectedTypes: [{ type: 'Election security platform', reason: 'CrowdStrike election infrastructure protection, CISA election security services', confidence: 0.85 }, { type: 'Foreign influence detection', reason: 'Recorded Future election threat monitoring, Babel Street social media analysis', confidence: 0.82 }] },
    'OP_COUNTER_INFLUENCE': { fullName: 'Counter-Influence Operations', label: 'Counter-Influence', tier: 'operational', function: 'Detects and counters foreign influence and disinformation campaigns', dysregulation: 'Undetected influence operations, attribution failure, First Amendment constraints', expectedTypes: [{ type: 'Counter-influence analytics', reason: 'Two Six Technologies counter-narrative tools, Palantir influence tracking', confidence: 0.85 }, { type: 'Attribution platform', reason: 'Mandiant/Google APT attribution, CrowdStrike adversary intelligence', confidence: 0.82 }] },
    'OP_FITF': { fullName: 'FBI Foreign Influence Task Force', label: 'FBI FITF', tier: 'operational', function: 'Coordinates FBI response to foreign influence targeting U.S. institutions', dysregulation: 'Coordination gaps between CI and influence operations, attribution delays', expectedTypes: [{ type: 'FITF analytics platform', reason: 'Palantir Gotham for FBI foreign influence analysis, Recorded Future threat feeds', confidence: 0.85 }, { type: 'Foreign agent investigation support', reason: 'Booz Allen FBI CI support, CACI investigative analytics', confidence: 0.82 }] },
    'OP_IC_ITE_MIGRATION': { fullName: 'IC ITE Cloud Migration', label: 'IC ITE Migration', tier: 'operational', function: 'Migrates IC systems and data to IC ITE cloud infrastructure', dysregulation: 'Migration delays, data loss during transition, legacy system dependencies', expectedTypes: [{ type: 'IC cloud migration', reason: 'AWS C2S migration services, Microsoft Azure Government IC onboarding', confidence: 0.90 }, { type: 'IC ITE systems engineering', reason: 'Leidos IC ITE transition, SAIC IC systems engineering, GDIT IC network ops', confidence: 0.88 }] },
    'OP_CLOUD_SEC': { fullName: 'IC Cloud Security Operations', label: 'Cloud Security', tier: 'operational', function: 'Secures IC cloud environments across classification levels', dysregulation: 'Cloud misconfiguration, cross-tenant data exposure, FedRAMP compliance gaps', expectedTypes: [{ type: 'Cloud security platform', reason: 'Palo Alto Prisma Cloud Federal, CrowdStrike Cloud Security, Wiz Government', confidence: 0.88 }, { type: 'Cloud compliance monitoring', reason: 'Tenable cloud vulnerability scanning, Rapid7 cloud security posture', confidence: 0.85 }] },
    'OP_ZERO_TRUST': { fullName: 'Zero Trust Architecture Implementation', label: 'Zero Trust', tier: 'operational', function: 'Implements zero-trust security architecture across IC networks', dysregulation: 'Legacy trust-based access, network segmentation gaps, identity verification failures', expectedTypes: [{ type: 'Zero trust platform', reason: 'Zscaler Government zero-trust access, Okta Federal identity, CyberArk PAM', confidence: 0.90 }, { type: 'Microsegmentation', reason: 'Palo Alto microsegmentation, Fortinet intent-based segmentation', confidence: 0.85 }] },
    'OP_JWICS_OPS': { fullName: 'JWICS Network Operations', label: 'JWICS Ops', tier: 'operational', function: 'Operates and maintains the Joint Worldwide Intelligence Communications System', dysregulation: 'JWICS outages, bandwidth constraints, end-of-life equipment', expectedTypes: [{ type: 'JWICS operations contractor', reason: 'GDIT JWICS network operations, Leidos JWICS sustainment', confidence: 0.88 }, { type: 'Network modernization', reason: 'Cisco Federal JWICS refresh, Juniper Networks classified routing', confidence: 0.82 }] },
    'OP_NSANET_OPS': { fullName: 'NSANet Operations', label: 'NSANet Ops', tier: 'operational', function: 'Operates NSA internal classified network for SIGINT operations', dysregulation: 'NSANet security incidents, performance degradation, access management issues', expectedTypes: [{ type: 'NSANet operations support', reason: 'CACI NSANet operations under ITES-3S, Leidos NSA IT support', confidence: 0.88 }, { type: 'NSANet security monitoring', reason: 'CrowdStrike Federal endpoint monitoring, Fortinet network security', confidence: 0.85 }] },
    'OP_IARPA_PROGRAMS': { fullName: 'IARPA Research Programs', label: 'IARPA Programs', tier: 'operational', function: 'Manages IARPA advanced research programs for IC technology breakthroughs', dysregulation: 'Research-to-production gap, program transition failures', expectedTypes: [{ type: 'IARPA research performer', reason: 'Two Six Technologies IARPA programs, Raytheon BBN IARPA research, university consortium research', confidence: 0.82 }, { type: 'Technology transition support', reason: 'Booz Allen IARPA program management, SAIC research transition', confidence: 0.78 }] },
    'OP_IQT_PORTFOLIO': { fullName: 'In-Q-Tel Investment Operations', label: 'In-Q-Tel', tier: 'operational', function: 'Identifies and invests in commercial technology relevant to IC mission needs', dysregulation: 'Investment miss on critical technology, slow commercial adoption', expectedTypes: [{ type: 'In-Q-Tel portfolio company', reason: 'In-Q-Tel invests in commercial AI, cybersecurity, and data analytics companies for IC adoption', confidence: 0.80 }, { type: 'Technology scouting', reason: 'In-Q-Tel technology scouts, DIU commercial technology identification', confidence: 0.78 }] },
    'OP_NGA_BSP': { fullName: 'NGA Base Support Program', label: 'NGA BSP', tier: 'operational', function: 'Provides base GEOINT production and foundation data for NGA', dysregulation: 'Foundation GEOINT backlogs, data currency gaps, production quality issues', expectedTypes: [{ type: 'NGA BSP prime contractor', reason: 'BAE Systems NGA GEOINT production, Leidos NGA foundation data', confidence: 0.88 }, { type: 'GEOINT production automation', reason: 'Palantir Gaia automated feature extraction, AI-powered GEOINT production', confidence: 0.85 }] },
    'OP_DIA_ANALYSIS': { fullName: 'DIA All-Source Analysis', label: 'DIA Analysis', tier: 'operational', function: 'Produces all-source defense intelligence assessments for DoD', dysregulation: 'Analytic quality degradation, assessment delays, workforce gaps', expectedTypes: [{ type: 'DIA analytic support', reason: 'Leidos SITE III ($11.5B) DIA analysis support, CACI DIA intelligence production', confidence: 0.88 }, { type: 'AI-augmented analysis', reason: 'Palantir AIP for DIA analysts, BigBear.ai predictive intelligence', confidence: 0.85 }] },
    'OP_CIA_DSNT': { fullName: 'CIA Directorate of Science & Technology', label: 'CIA DS&T', tier: 'operational', function: 'Develops technical collection systems and analytic tools for CIA', dysregulation: 'Technology gaps, innovation pipeline stalls, commercial technology adoption delays', expectedTypes: [{ type: 'CIA DS&T technical support', reason: 'Booz Allen CIA DS&T programs, classified technical development contractors', confidence: 0.82 }, { type: 'Technical collection innovation', reason: 'In-Q-Tel technology identification, classified sensor development', confidence: 0.80 }] },
    'OP_NSA_CSS': { fullName: 'NSA Central Security Service', label: 'NSA CSS', tier: 'operational', function: 'Coordinates SIGINT operations between NSA and military cryptologic elements', dysregulation: 'Military-NSA coordination gaps, tactical-national SIGINT integration failures', expectedTypes: [{ type: 'CSS coordination support', reason: 'CACI CSS operations support, L3Harris military cryptologic equipment', confidence: 0.85 }, { type: 'Tactical-national SIGINT bridge', reason: 'Northrop Grumman tactical SIGINT integration, BAE Systems signals processing', confidence: 0.82 }] },
    'OP_NRO_COLLECTION': { fullName: 'NRO Space-Based Collection', label: 'NRO Collection', tier: 'operational', function: 'Operates space-based intelligence collection systems for the IC', dysregulation: 'Satellite constellation gaps, launch delays, ground system failures', expectedTypes: [{ type: 'NRO satellite prime', reason: 'Northrop Grumman classified NRO satellite programs, Lockheed Martin NRO platforms', confidence: 0.92 }, { type: 'NRO ground systems', reason: 'L3Harris ground station operations, SAIC NRO mission systems', confidence: 0.88 }] },
    'OP_FVEY_SHARING': { fullName: 'Five Eyes Intelligence Sharing', label: 'FVEY Sharing', tier: 'operational', function: 'Manages intelligence sharing with Five Eyes partners (UK, Canada, Australia, New Zealand)', dysregulation: 'Sharing restrictions, partner trust erosion, classification barriers', expectedTypes: [{ type: 'Allied sharing platform', reason: 'Coalition information sharing infrastructure, GDIT allied network operations', confidence: 0.82 }, { type: 'Cross-domain solution', reason: 'Forcepoint cross-domain transfer, BAE Systems guard technology', confidence: 0.80 }] },
    'OP_ALLIED_LIAISON': { fullName: 'Allied Intelligence Liaison', label: 'Allied Liaison', tier: 'operational', function: 'Manages intelligence liaison relationships with non-FVEY allies and partners', dysregulation: 'Liaison friction, intelligence sharing disputes, allied trust incidents', expectedTypes: [{ type: 'Liaison support services', reason: 'Booz Allen allied engagement, CACI foreign liaison support', confidence: 0.78 }, { type: 'Coalition intelligence platform', reason: 'Palantir mission manager for coalition sharing, NATO intelligence tools', confidence: 0.80 }] },
    'OP_SIGINT_GEOLOC': { fullName: 'SIGINT Geolocation & Targeting', label: 'SIGINT Geoloc', tier: 'operational', function: 'Geolocates signals emitters for intelligence and targeting', dysregulation: 'Geolocation errors, emitter misidentification, targeting accuracy failures', expectedTypes: [{ type: 'Geolocation system', reason: 'L3Harris SIGINT geolocation platforms, Northrop Grumman emitter geolocation', confidence: 0.88 }, { type: 'Targeting integration', reason: 'Palantir targeting workflows, Raytheon Intelligence targeting systems', confidence: 0.85 }] },
    'OP_HUMINT_LINGUIST': { fullName: 'HUMINT Linguist & Translation Services', label: 'HUMINT Linguist', tier: 'operational', function: 'Provides language translation and interpretation for HUMINT operations', dysregulation: 'Language skill gaps, translation backlogs, cultural context errors', expectedTypes: [{ type: 'Linguist services', reason: 'CACI linguist services under ITES-3S, Leidos translation support for DIA', confidence: 0.85 }, { type: 'Machine translation', reason: 'In-Q-Tel NLP technology, Babel Street multilingual processing', confidence: 0.80 }] },
    'OP_GEOINT_MARITIME': { fullName: 'Maritime GEOINT & Vessel Tracking', label: 'Maritime GEOINT', tier: 'operational', function: 'Tracks maritime vessel movements and provides naval GEOINT', dysregulation: 'AIS gaps, dark vessel tracking failures, maritime domain awareness limitations', expectedTypes: [{ type: 'Maritime tracking platform', reason: 'Spire Global AIS data, Windward maritime intelligence, Planet Labs maritime imaging', confidence: 0.85 }, { type: 'Maritime domain awareness', reason: 'Palantir maritime analysis, Sayari vessel network analysis', confidence: 0.82 }] },
    'OP_SPACE_INTEL': { fullName: 'Space Intelligence & Counterspace', label: 'Space Intel', tier: 'operational', function: 'Provides intelligence on adversary space capabilities and counterspace threats', dysregulation: 'Undetected ASAT development, counterspace surprise, orbital awareness gaps', expectedTypes: [{ type: 'Space domain awareness', reason: 'LeoLabs space tracking, ExoAnalytic orbital monitoring for IC', confidence: 0.85 }, { type: 'Counterspace intelligence', reason: 'Northrop Grumman space situational awareness, L3Harris space sensors', confidence: 0.82 }] },
    'OP_NUCLEAR_INTEL': { fullName: 'Nuclear Intelligence & Proliferation Monitoring', label: 'Nuclear Intel', tier: 'operational', function: 'Monitors nuclear weapons programs and proliferation activities', dysregulation: 'Missed nuclear developments, enrichment detection failures, test monitoring gaps', expectedTypes: [{ type: 'Nuclear monitoring technology', reason: 'AFTAC nuclear monitoring support, seismic/infrasound detection systems', confidence: 0.85 }, { type: 'Proliferation analysis', reason: 'NTI analysis support, NNSA intelligence contractor, imagery analysis of nuclear sites', confidence: 0.82 }] },
    'OP_BIO_INTEL': { fullName: 'Biological Threat Intelligence', label: 'Bio Intel', tier: 'operational', function: 'Monitors biological threats, bioweapon programs, and pandemic indicators', dysregulation: 'COVID origin intelligence gaps, bioweapon detection failures, dual-use research blind spots', expectedTypes: [{ type: 'Biosurveillance platform', reason: 'Palantir biosurveillance for BARDA/HHS, DTRA biological threat detection', confidence: 0.82 }, { type: 'Bio threat analysis', reason: 'Leidos DTRA biological intelligence, SAIC WMD analysis support', confidence: 0.80 }] },
    'OP_ECON_INTEL': { fullName: 'Economic Intelligence & Sanctions Enforcement', label: 'Economic Intel', tier: 'operational', function: 'Provides economic intelligence for sanctions enforcement and trade security', dysregulation: 'Sanctions evasion detection gaps, illicit finance blind spots, trade diversion failures', expectedTypes: [{ type: 'Financial intelligence platform', reason: 'Sayari corporate network analysis, Babel Street financial entity screening', confidence: 0.85 }, { type: 'Sanctions compliance technology', reason: 'Palantir financial investigations, Chainalysis sanctions crypto tracing', confidence: 0.82 }] },
    'OP_TERROR_TRACKING': { fullName: 'Terrorism Tracking & CT Intelligence', label: 'CT Intel', tier: 'operational', function: 'Tracks terrorist organizations and provides counterterrorism intelligence', dysregulation: 'Terrorism indicator gaps, radicalization detection failures, CT coordination issues', expectedTypes: [{ type: 'CT intelligence platform', reason: 'Palantir Gotham for NCTC, Recorded Future terrorism tracking, Babel Street CT analysis', confidence: 0.88 }, { type: 'NCTC analysis support', reason: 'Booz Allen NCTC support, CACI CT analysis under ITES-3S', confidence: 0.85 }] },
    'OP_NARCO_INTEL': { fullName: 'Narcotics & Transnational Crime Intelligence', label: 'Narco Intel', tier: 'operational', function: 'Provides intelligence on drug trafficking and transnational criminal organizations', dysregulation: 'TCO adaptation, darknet market proliferation, precursor chemical tracking gaps', expectedTypes: [{ type: 'TCO tracking platform', reason: 'Palantir Gotham for DEA, Sayari network analysis for TCO mapping', confidence: 0.85 }, { type: 'Drug interdiction intelligence', reason: 'Leidos JIATF-South support, CACI narcotics intelligence analytics', confidence: 0.82 }] },
    'OP_WMD_INTEL': { fullName: 'WMD Proliferation Intelligence', label: 'WMD Intel', tier: 'operational', function: 'Monitors weapons of mass destruction proliferation networks', dysregulation: 'Proliferation network detection gaps, dual-use technology export failures', expectedTypes: [{ type: 'WMD analysis platform', reason: 'Palantir proliferation network analysis, Sayari WMD supply chain tracking', confidence: 0.85 }, { type: 'Export control intelligence', reason: 'Booz Allen WMD analysis support, NGA WMD site monitoring', confidence: 0.82 }] },
    'OP_STRATEGIC_WARNING': { fullName: 'Strategic Warning & Surprise Prevention', label: 'Strategic Warning', tier: 'operational', function: 'Provides strategic warning against existential threats and strategic surprise', dysregulation: 'Strategic surprise, Pearl Harbor/9/11-type failure, warning fatigue', expectedTypes: [{ type: 'Strategic warning analytics', reason: 'Palantir AIP strategic warning workflows, Recorded Future strategic threat monitoring', confidence: 0.85 }, { type: 'Net assessment support', reason: 'RAND strategic assessment, IDA net assessment for ODNI', confidence: 0.82 }] },
    'OP_CRISIS_INTEL': { fullName: 'Crisis Intelligence Support', label: 'Crisis Intel', tier: 'operational', function: 'Provides real-time intelligence support during crises and contingencies', dysregulation: 'Intelligence latency during crisis, surge capacity gaps, coordination failures', expectedTypes: [{ type: 'Crisis intelligence platform', reason: 'Palantir AIP crisis management, Dataminr real-time alerting for IC watch centers', confidence: 0.88 }, { type: 'Watch center support', reason: 'Booz Allen CIA Operations Center support, CACI DIA watch center', confidence: 0.85 }] },
    'OP_MEDICAL_INTEL': { fullName: 'Medical Intelligence (MEDINT)', label: 'MEDINT', tier: 'operational', function: 'Provides medical intelligence on disease threats, foreign health capabilities, and biothreats', dysregulation: 'Pandemic early warning failures, foreign health system intelligence gaps', expectedTypes: [{ type: 'MEDINT analysis', reason: 'DIA National Center for Medical Intelligence (NCMI) contractor support', confidence: 0.82 }, { type: 'Disease surveillance', reason: 'Palantir HHS biosurveillance, CDC intelligence liaison analytics', confidence: 0.78 }] },
    'OP_TECH_INTEL': { fullName: 'Scientific & Technical Intelligence (S&TI)', label: 'S&TI', tier: 'operational', function: 'Assesses adversary science and technology capabilities', dysregulation: 'Technology surprise, missed adversary capability development, dual-use gaps', expectedTypes: [{ type: 'S&TI analysis', reason: 'DIA S&TI production support, Booz Allen technology assessment for ODNI', confidence: 0.82 }, { type: 'Technology assessment tools', reason: 'AI-powered patent and publication analysis for adversary technology tracking', confidence: 0.78 }] },
    'OP_IDENTITY_INTEL': { fullName: 'Identity Intelligence (I2)', label: 'Identity Intel', tier: 'operational', function: 'Manages biometric and identity intelligence for IC operations', dysregulation: 'Identity verification failures, biometric database gaps, false identity detection failures', expectedTypes: [{ type: 'Biometric platform', reason: 'Leidos DoD ABIS (Automated Biometric Identification System), NEC biometrics', confidence: 0.85 }, { type: 'Identity resolution', reason: 'Babel Street identity resolution, Palantir entity resolution across databases', confidence: 0.82 }] },
    'OP_CYBER_THREAT_INTEL': { fullName: 'Cyber Threat Intelligence Production', label: 'CTI Production', tier: 'operational', function: 'Produces cyber threat intelligence reports and advisories', dysregulation: 'CTI latency, indicator staleness, attribution confidence gaps', expectedTypes: [{ type: 'Cyber threat intelligence', reason: 'CrowdStrike adversary intelligence, Recorded Future CTI feeds, Mandiant threat reports', confidence: 0.90 }, { type: 'CTI sharing platform', reason: 'STIX/TAXII sharing infrastructure, Anomali ThreatStream government', confidence: 0.85 }] },
    'OP_INFLUENCE_DETECT': { fullName: 'Influence Operation Detection', label: 'Influence Detection', tier: 'operational', function: 'Detects foreign influence operations in digital and physical spaces', dysregulation: 'Undetected influence campaigns, platform cooperation barriers, First Amendment constraints', expectedTypes: [{ type: 'Influence detection analytics', reason: 'Recorded Future influence monitoring, Fivecast social media AI, Babel Street', confidence: 0.85 }, { type: 'Bot detection technology', reason: 'Graphika network analysis, Stanford Internet Observatory research technology', confidence: 0.80 }] },
    'OP_CLASSIFIED_NETWORK_SEC': { fullName: 'Classified Network Security', label: 'Classified NetSec', tier: 'operational', function: 'Secures JWICS, NSANet, and other classified networks against intrusion', dysregulation: 'Classified network breaches, persistent adversary presence, insider access abuse', expectedTypes: [{ type: 'Classified endpoint security', reason: 'CrowdStrike Federal classified deployment, SentinelOne government endpoint', confidence: 0.90 }, { type: 'Network monitoring', reason: 'Fortinet classified network monitoring, Tenable ACAS vulnerability assessment', confidence: 0.88 }] },
    'OP_DATA_GOVERNANCE': { fullName: 'IC Data Governance & Classification', label: 'Data Governance', tier: 'operational', function: 'Manages data classification, tagging, and governance across IC systems', dysregulation: 'Over-classification, data tagging inconsistency, cross-system discovery failures', expectedTypes: [{ type: 'Data governance platform', reason: 'Palantir Foundry data governance, Varonis classification and access management', confidence: 0.85 }, { type: 'Classification management', reason: 'Automated classification marking tools, ODNI IC marking system compliance', confidence: 0.80 }] },
    'OP_HUMINT_CYBER': { fullName: 'Cyber-Enabled HUMINT Operations', label: 'Cyber HUMINT', tier: 'operational', function: 'Conducts HUMINT operations enabled by cyber tools and techniques', dysregulation: 'Digital tradecraft exposure, social engineering detection, online recruitment failures', expectedTypes: [{ type: 'Cyber-enabled HUMINT tools', reason: 'Classified CIA cyber HUMINT platforms, social engineering technology', confidence: 0.78 }, { type: 'Online persona management', reason: 'Classified cover identity platforms for digital operations', confidence: 0.75 }] },
    'OP_SIGINT_SPACE': { fullName: 'Space-Based SIGINT Collection', label: 'Space SIGINT', tier: 'operational', function: 'Collects signals intelligence from space-based platforms', dysregulation: 'Orbital SIGINT gaps, satellite lifecycle management issues, constellation design constraints', expectedTypes: [{ type: 'Space SIGINT satellite', reason: 'Northrop Grumman classified SIGINT satellites for NRO, Lockheed Martin signals collection platforms', confidence: 0.90 }, { type: 'Space SIGINT ground processing', reason: 'L3Harris ground stations, CACI space SIGINT processing', confidence: 0.85 }] },
    'OP_OPEN_SOURCE_CENTER': { fullName: 'Open Source Enterprise (OSE)', label: 'Open Source Enterprise', tier: 'operational', function: 'Manages CIA Open Source Enterprise for IC-wide OSINT production', dysregulation: 'OSINT collection backlogs, foreign language coverage gaps, commercial data access restrictions', expectedTypes: [{ type: 'OSINT production platform', reason: 'Recorded Future IC deployment, Babel Street for Open Source Enterprise', confidence: 0.88 }, { type: 'Foreign media monitoring', reason: 'BBC Monitoring equivalent services, foreign language news aggregation', confidence: 0.82 }] },
    'OP_AI_ML_INTEL': { fullName: 'AI/ML for Intelligence Analysis', label: 'AI/ML Intel', tier: 'operational', function: 'Applies AI and machine learning to intelligence analysis and automation', dysregulation: 'AI hallucination in intelligence context, model bias, explainability gaps', expectedTypes: [{ type: 'AI-augmented analysis', reason: 'Palantir AIP for IC, BigBear.ai predictive intelligence, C3.ai federal AI', confidence: 0.88 }, { type: 'ML model development', reason: 'Two Six Technologies ML for IC, IARPA AI research programs', confidence: 0.85 }] },
    'OP_FUSION_CENTER': { fullName: 'Intelligence Fusion Center Operations', label: 'Fusion Centers', tier: 'operational', function: 'Operates joint intelligence fusion centers for interagency coordination', dysregulation: 'Fusion center resource constraints, information sharing barriers, classification conflicts', expectedTypes: [{ type: 'Fusion center platform', reason: 'Palantir Gotham for fusion centers, Leidos fusion center IT support', confidence: 0.88 }, { type: 'Interagency data sharing', reason: 'Snowflake Government cross-agency sharing, GDIT collaboration infrastructure', confidence: 0.82 }] },
    'OP_PDB_PRODUCTION': { fullName: 'Presidential Daily Brief Production', label: 'PDB Production', tier: 'operational', function: 'Produces the President Daily Brief and senior policymaker intelligence', dysregulation: 'PDB relevance gaps, timeliness failures, politicization pressure', expectedTypes: [{ type: 'PDB production support', reason: 'Classified CIA PDB production contractors, Booz Allen senior intelligence support', confidence: 0.82 }, { type: 'Intelligence visualization', reason: 'Palantir visualization for PDB graphics, interactive intelligence briefing tools', confidence: 0.78 }] },
    'OP_COLLECTION_MGMT': { fullName: 'Collection Management & Requirements', label: 'Collection Management', tier: 'operational', function: 'Manages intelligence collection requirements and coordinates collection across INTs', dysregulation: 'Requirements drift, collection-analysis disconnect, sensor over-tasking', expectedTypes: [{ type: 'Collection management platform', reason: 'Palantir MetaConstellation, L3Harris collection planning under ITES-3S', confidence: 0.88 }, { type: 'Requirements tracking', reason: 'SAIC collection requirements management, Leidos CCMD collection coordination', confidence: 0.82 }] },
    'OP_TARGETING': { fullName: 'Intelligence Targeting Support', label: 'Targeting', tier: 'operational', function: 'Provides intelligence support to targeting for kinetic and non-kinetic operations', dysregulation: 'Targeting errors, collateral damage intelligence failures, BDA (battle damage assessment) gaps', expectedTypes: [{ type: 'Targeting intelligence platform', reason: 'Palantir Gotham targeting workflows, Raytheon Intelligence targeting integration', confidence: 0.88 }, { type: 'BDA analysis', reason: 'NGA battle damage assessment, Maxar imagery for targeting validation', confidence: 0.85 }] },
    'OP_TREATY_VERIFICATION': { fullName: 'Arms Control & Treaty Verification', label: 'Treaty Verification', tier: 'operational', function: 'Provides intelligence support to arms control treaty verification', dysregulation: 'Verification gaps, treaty compliance detection failures, monitoring infrastructure aging', expectedTypes: [{ type: 'Treaty verification monitoring', reason: 'AFTAC monitoring support, NGA nuclear site imagery analysis', confidence: 0.82 }, { type: 'Compliance analysis', reason: 'Booz Allen arms control analysis, RAND verification methodology research', confidence: 0.78 }] },
    'OP_FOREIGN_LEADER': { fullName: 'Foreign Leader Intelligence', label: 'Foreign Leader Intel', tier: 'operational', function: 'Produces intelligence assessments on foreign leader decision-making and intent', dysregulation: 'Leader intent misread, succession analysis failures, cultural blind spots', expectedTypes: [{ type: 'Leadership analysis', reason: 'CIA Leadership Analysis office support, Booz Allen political analysis', confidence: 0.80 }, { type: 'Behavioral profiling', reason: 'DIA leadership profiling support, personality assessment technology', confidence: 0.78 }] },
    'OP_REGIONAL_ANALYSIS': { fullName: 'Regional Intelligence Analysis', label: 'Regional Analysis', tier: 'operational', function: 'Produces regional intelligence assessments covering political, military, economic, and social dynamics', dysregulation: 'Regional expertise gaps, area studies knowledge erosion, language coverage shortfalls', expectedTypes: [{ type: 'Regional analysis support', reason: 'Leidos DIA regional analysis under SITE III, CACI regional intelligence production', confidence: 0.85 }, { type: 'Regional expertise consulting', reason: 'CSIS regional programs, RAND area studies, CNA regional expertise', confidence: 0.80 }] },
    'OP_INFRASTRUCTURE_INTEL': { fullName: 'Critical Infrastructure Intelligence', label: 'Infrastructure Intel', tier: 'operational', function: 'Provides intelligence on threats to critical infrastructure', dysregulation: 'Infrastructure threat blind spots, OT/ICS intelligence gaps, cross-sector analysis failures', expectedTypes: [{ type: 'Infrastructure threat analysis', reason: 'Dragos OT/ICS threat intelligence for IC, Claroty industrial monitoring', confidence: 0.85 }, { type: 'CISA intelligence coordination', reason: 'CISA IC liaison support, Booz Allen critical infrastructure analysis', confidence: 0.82 }] },
    'OP_SUPPLY_CHAIN_INTEL': { fullName: 'Supply Chain Intelligence', label: 'Supply Chain Intel', tier: 'operational', function: 'Provides intelligence on adversary supply chain operations and vulnerabilities', dysregulation: 'Supply chain compromise detection failures, component provenance gaps', expectedTypes: [{ type: 'Supply chain analysis', reason: 'Sayari corporate network and supply chain graph analytics, Babel Street entity screening', confidence: 0.85 }, { type: 'Component provenance', reason: 'Supply chain risk management platforms, trusted foundry intelligence support', confidence: 0.80 }] },
    'OP_CLEARANCE_ADJUDICATION': { fullName: 'Clearance Adjudication & Appeals', label: 'Clearance Adjudication', tier: 'operational', function: 'Adjudicates security clearance determinations and manages appeals', dysregulation: 'Adjudication backlogs, inconsistent standards, clearance denial appeals', expectedTypes: [{ type: 'Adjudication support', reason: 'Peraton DCSA adjudication IT, Leidos clearance processing systems', confidence: 0.82 }, { type: 'Appeals management', reason: 'Legal support for clearance appeals, DOHA (Defense Office of Hearings and Appeals) contractor support', confidence: 0.78 }] },
    'OP_SCIF_MANAGEMENT': { fullName: 'SCIF Construction & Accreditation', label: 'SCIF Management', tier: 'operational', function: 'Constructs and accredits Sensitive Compartmented Information Facilities', dysregulation: 'SCIF construction delays, accreditation backlogs, physical security vulnerabilities', expectedTypes: [{ type: 'SCIF construction', reason: 'Parsons SCIF construction, Hensel Phelps classified facility construction', confidence: 0.82 }, { type: 'SCIF accreditation', reason: 'CACI SCIF accreditation and compliance, Leidos classified facility IT', confidence: 0.80 }] },
    'OP_SATELLITE_COMMERCIAL': { fullName: 'Commercial Satellite Integration', label: 'Commercial SAT', tier: 'operational', function: 'Integrates commercial satellite imagery and data into IC workflows', dysregulation: 'Commercial data integration gaps, classification barriers, contract vehicle limitations', expectedTypes: [{ type: 'Commercial imagery provider', reason: 'BlackSky EOCL contract, Planet Labs NRO/NGA imagery, Capella Space SAR', confidence: 0.90 }, { type: 'Commercial data integration', reason: 'Palantir commercial data fusion, NRO Commercial Imagery Program', confidence: 0.88 }] },
    'OP_RESPONSIVE_SPACE': { fullName: 'Responsive Space Launch & Reconstitution', label: 'Responsive Space', tier: 'operational', function: 'Provides rapid space launch capability for constellation reconstitution', dysregulation: 'Launch delays, constellation gap vulnerability, responsive launch readiness', expectedTypes: [{ type: 'Responsive launch provider', reason: 'Rocket Lab Electron/Neutron for NRO, SpaceX Falcon 9 NRO rapid launch', confidence: 0.88 }, { type: 'Small satellite manufacturer', reason: 'BlackSky satellite production, Planet Labs Dove/SuperDove production line', confidence: 0.85 }] },
    'OP_CROSS_DOMAIN': { fullName: 'Cross-Domain Solution Operations', label: 'Cross-Domain', tier: 'operational', function: 'Operates cross-domain solutions that enable data transfer between classification levels', dysregulation: 'Cross-domain bottlenecks, security review delays, data loss during transfer', expectedTypes: [{ type: 'Cross-domain solution', reason: 'Forcepoint High Speed Guard, BAE Systems cross-domain transfer', confidence: 0.85 }, { type: 'Multi-level security', reason: 'General Dynamics cross-domain products, Raytheon Trusted Computer Solutions', confidence: 0.82 }] },
    'OP_OSINT_COMMERCIAL_DATA': { fullName: 'Commercial Data Acquisition for OSINT', label: 'Commercial Data', tier: 'operational', function: 'Acquires commercial datasets (geolocation, financial, social media) for IC analysis', dysregulation: 'Data acquisition policy restrictions, vendor reliability issues, privacy concerns', expectedTypes: [{ type: 'Commercial data aggregator', reason: 'Babel Street commercial data access, Sayari corporate registry data', confidence: 0.85 }, { type: 'Geolocation data', reason: 'Commercial geolocation data providers for IC pattern-of-life analysis', confidence: 0.80 }] },
};

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveApprovals(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
  function approvalKey(nodeId, businessType) { return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50); }
  function getApprovalStatus(nodeId, businessType) { return loadApprovals()[approvalKey(nodeId, businessType)] || null; }

  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status, reason: reason || '', nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(), reviewer: reviewerRole || 'operator'
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
        _hierarchyCache = cached; _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}
    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('intelligence');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = { nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {}, nodeLabels: {}, nodeDepths: {}, allActivations: [] };

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
          if (!result.nodeCompanies[nid][tk]) result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
        }
        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
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

  function getDefenseState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('intelligence');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getDefenseState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();
    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('intelligence') : null;
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
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Intelligence.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: this business type becomes eligible for future portal path mapping within Intelligence.';
          else consequence = 'If approved: this business type is recorded as a valid Intelligence mapping. Requires further validation.';
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) variantState = 'MISSING';
        else if (!alreadyMapped) variantState = 'PROPOSED';
        else variantState = 'MAPPED';

        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey, nodeId: nodeId, nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label, nodeFunction: dir.function, plainFunction: dir.function,
          dysregulation: dir.dysregulation || '', plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type, reason: expected.reason, confidence: expected.confidence,
          nodeActive: nodeActive, alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames, approval: approval,
          approvalRequired: showButtons, variantState: variantState,
          approvalConsequence: consequence, tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) { entry.bucket = 'MAPPED'; mapped.push(entry); }
        else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}, out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped); missing = dedupeExact(missing); speculative = dedupeExact(speculative);

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
    for (var i = 0; i < all.length; i++) if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    return approved;
  }

  window.LIMENIntelligenceBusinessEngine = {
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

  loadFullHierarchy(function () { console.log('[DefenseBusinessEngine] Hierarchy loaded'); });
  console.log('[DefenseBusinessEngine] Loaded \u2014 103-node intelligence business engine');
})();
