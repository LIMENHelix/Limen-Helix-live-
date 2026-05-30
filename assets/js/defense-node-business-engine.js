/**
 * defense-node-business-engine.js — Defense Node-to-Business Assignment Engine
 *
 * DEFENSE DOMAIN ONLY. Full-hierarchy inference layer.
 * 103 operational nodes mapped (20 DEFENSE-TOP + 83 DEFENSE-OPERATIONAL).
 * Excludes the same 20 RI / framework nodes as locked domains.
 * (123 total brain nodes - 20 RI exclusions = 103 operational.)
 *
 * Self-gates: only runs when ?domain=defense
 * Exposes: window.LIMENDefenseBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'defense') return;

  var STORAGE_KEY = 'limen_defense_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_defense_hierarchy_cache';
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
  // 20 DEFENSE-TOP (full neuroTranslation) + 83 DEFENSE-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── DEFENSE-TOP NODES (20) — full detail with neuroTranslation ──
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Strategic Command & Doctrine', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains working memory and goal-directed reasoning across abstract plans.', inBusiness: 'In defense, strategic command and doctrine is the work of national security strategy, war planning, and the long-range arc of force design.' },
      function: 'Sets national defense strategy, doctrine, and force design across the joint force and the alliance',
      dysregulation: 'Strategic drift, doctrinal lag, force design mismatch with the actual threat',
      expectedTypes: [
        { type: 'Defense strategy / war-gaming firm', reason: 'CSIS, RAND, Center for a New American Security \u2014 doctrine and wargaming for OUSD(P), Joint Staff, and allies', confidence: 0.92 },
        { type: 'Net assessment consultancy', reason: 'Long-horizon competitive analysis for DoD ONA and allied equivalents', confidence: 0.85 },
        { type: 'Force design AI / planning tool', reason: 'Modeling and simulation tools for force structure decisions', confidence: 0.85 },
        { type: 'Defense executive recruiting firm', reason: 'Recruiting senior strategists into primes and government', confidence: 0.75 },
        { type: 'Defense thinktank publishing arm', reason: 'CSIS Press, RAND Books, Brookings \u2014 doctrine literature', confidence: 0.78 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Kinetic Force Execution', tier: 'top',
      neuroTranslation: { inNeurology: 'Executes planned motor commands that move the body through the environment.', inBusiness: 'In defense, kinetic force execution is the work of moving troops, firing munitions, and turning a plan into a fired weapon on a target.' },
      function: 'Executes kinetic operations: troops, vehicles, fires, and the actual delivery of munitions on targets',
      dysregulation: 'Failed strikes, blue-on-blue, broken kill chains, fratricide',
      expectedTypes: [
        { type: 'Munitions / precision-fires manufacturer', reason: 'Lockheed Martin (HIMARS, JASSM), Raytheon (Tomahawk), Northrop Grumman (long-range fires)', confidence: 0.95 },
        { type: 'Combat vehicle manufacturer', reason: 'General Dynamics Land Systems, Rheinmetall, KNDS, Hyundai Rotem', confidence: 0.92 },
        { type: 'Targeting / fire control software', reason: 'Anduril Lattice, Palantir Gaia, BAE / Lockheed targeting suites', confidence: 0.90 },
        { type: 'Range / live-fire training service', reason: 'CUBIC, Cole Engineering, DRS Technologies training systems', confidence: 0.78 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Sensor Telemetry Aggregation', tier: 'top',
      neuroTranslation: { inNeurology: 'Aggregates interoceptive sensor data from across the body into a unified internal state.', inBusiness: 'In defense, sensor telemetry aggregation is the work of pulling radar, EO/IR, sigint, and battlefield sensors into one operational picture.' },
      function: 'Aggregates radar, EO/IR, sigint, and battlefield sensors into a unified picture',
      dysregulation: 'Sensor blind spots, fragmented common operating picture, fratricide due to bad data fusion',
      expectedTypes: [
        { type: 'Sensor fusion platform', reason: 'Palantir Gaia, Anduril Lattice, BAE Sensor Fusion', confidence: 0.92 },
        { type: 'Radar / EW manufacturer', reason: 'Raytheon, Northrop Grumman, Hensoldt, IAI ELTA', confidence: 0.92 },
        { type: 'EO/IR sensor manufacturer', reason: 'L3Harris, FLIR / Teledyne, Hensoldt, Elbit, Thales', confidence: 0.88 },
        { type: 'Tactical data link integration', reason: 'Link 16, MADL, IFDL integration vendors', confidence: 0.82 }
      ]
    },
    'FEF': {
      fullName: 'Frontal Eye Field', label: 'ISR Tasking & Attention Direction', tier: 'top',
      neuroTranslation: { inNeurology: 'Directs eye movement toward the next thing worth looking at.', inBusiness: 'In defense, ISR tasking and attention direction is the work of pointing satellites, drones, and analysts at the right target at the right time.' },
      function: 'Tasks satellites, drones, and intelligence analysts onto the highest-value targets',
      dysregulation: 'ISR collection gaps, missed indicators, intelligence blind spots',
      expectedTypes: [
        { type: 'ISR collection management software', reason: 'GDIT GEMINI, BAE Systems Distributed Common Ground System (DCGS), Raytheon GECKO collection management', confidence: 0.85 },
        { type: 'Commercial satellite imagery provider', reason: 'Maxar, Planet Labs, BlackSky, Capella Space', confidence: 0.92 },
        { type: 'AI-powered ISR analysis service', reason: 'Palantir, Anduril, Two Six Technologies', confidence: 0.88 },
        { type: 'Tactical UAV manufacturer', reason: 'AeroVironment, Skydio, Teal Drones', confidence: 0.85 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Joint & Coalition Coordination', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates attention and task control across regions in response to changing demands.', inBusiness: 'In defense, joint and coalition coordination is the work of getting the Army, Navy, Marines, Air Force, Space Force \u2014 plus NATO, AUKUS, and ad hoc partners \u2014 to fight together.' },
      function: 'Coordinates joint and coalition operations across services and allies',
      dysregulation: 'Service rivalry, coalition friction, interoperability gaps',
      expectedTypes: [
        { type: 'JADC2 / coalition C2 platform', reason: 'Joint All-Domain Command and Control software for DoD and allies', confidence: 0.92 },
        { type: 'NATO interoperability service', reason: 'NCI Agency contractors, Everbridge Public Warning, Rheinmetall Mission Master C2, Systematic SitaWare for allied C2 bridging', confidence: 0.85 },
        { type: 'Coalition exercise / simulation provider', reason: 'CACI, Leidos, BAE Mission Systems', confidence: 0.82 },
        { type: 'Allied liaison / consulting firm', reason: 'Booz Allen, McKinsey defense, BCG defense practice', confidence: 0.80 }
      ]
    },
    'PAG': {
      fullName: 'Periaqueductal Gray', label: 'Strategic Deterrence & Last-Resort Response', tier: 'top',
      neuroTranslation: { inNeurology: 'Triggers existential defense responses (fight, flight, freeze) when survival is threatened.', inBusiness: 'In defense, strategic deterrence is the work of nuclear and existential-level capabilities that exist to never be used.' },
      function: 'Maintains strategic deterrence: nuclear forces, second-strike, last-resort capabilities',
      dysregulation: 'Deterrence credibility erosion, escalation control failure, miscommunication during crisis',
      expectedTypes: [
        { type: 'Nuclear weapons sustainment contractor', reason: 'BWX Technologies, Honeywell FM&T, Y-12 contractors', confidence: 0.92 },
        { type: 'Strategic deterrent platform integrator', reason: 'Lockheed Martin (Trident, Sentinel), Northrop Grumman (B-21, Sentinel)', confidence: 0.92 },
        { type: 'Nuclear command and control modernization', reason: 'NC3 modernization vendors for STRATCOM', confidence: 0.85 },
        { type: 'Arms control / verification consultancy', reason: 'Verification regimes for IAEA, UNSC, NPT compliance', confidence: 0.78 }
      ]
    },
    'DAN': {
      fullName: 'Dorsal Attention Network', label: 'Persistent Surveillance & Targeting', tier: 'top',
      neuroTranslation: { inNeurology: 'Sustains goal-directed attention on a chosen target.', inBusiness: 'In defense, persistent surveillance and targeting is the work of keeping eyes on a target until the strike happens or the threat goes away.' },
      function: 'Maintains persistent surveillance on identified targets and threats',
      dysregulation: 'Loss of track, custody handoff failures, gaps in coverage',
      expectedTypes: [
        { type: 'Persistent ISR platform / tower', reason: 'TCOM (aerostats), Elbit Systems Skylark towers, Lockheed Martin Persistent Threat Detection System (PTDS)', confidence: 0.85 },
        { type: 'Target custody / tracking software', reason: 'Raytheon DDSDS, BAE GXP Xplorer, Leidos SCITOR, L3Harris WESCAM target track handoff', confidence: 0.85 },
        { type: 'Long-endurance UAV / HALE platform', reason: 'Northrop Grumman Global Hawk, MQ-9 Reaper, Triton', confidence: 0.88 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum (whole)', label: 'Precision-Guided Munitions & Fine Targeting', tier: 'top',
      neuroTranslation: { inNeurology: 'Refines skilled motor actions through prediction-error correction.', inBusiness: 'In defense, precision-guided munitions and fine targeting is the work of ensuring every weapon fired hits exactly where it should.' },
      function: 'Provides the precision guidance that turns every shot into a hit',
      dysregulation: 'Targeting errors, GPS denial impact, collateral damage events',
      expectedTypes: [
        { type: 'Precision-guidance kit manufacturer', reason: 'Boeing JDAM, Raytheon SDB, Lockheed Martin guided munitions', confidence: 0.92 },
        { type: 'Anti-jam GPS / PNT vendor', reason: 'BAE Systems M-Code, Collins Aerospace, Honeywell PNT', confidence: 0.88 },
        { type: 'Inertial navigation system supplier', reason: 'Northrop Grumman, Honeywell, Safran inertial nav', confidence: 0.85 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Command Authority & Rules of Engagement', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains executive control and inhibits inappropriate responses.', inBusiness: 'In defense, command authority and rules of engagement is the work of ensuring every action falls within the legal and political constraints set by leadership.' },
      function: 'Enforces command authority, ROE, and legal constraints on the use of force',
      dysregulation: 'ROE violations, friendly fire, unauthorized engagements, war crimes exposure',
      expectedTypes: [
        { type: 'Operational law (OPLAW) consulting firm', reason: 'JAG officers and law-of-armed-conflict specialists for primes and allies', confidence: 0.85 },
        { type: 'ROE management / collateral damage tool', reason: 'Lockheed Martin DCIDE collateral damage methodology, Raytheon FalconView ROE overlays, BAE Systems Strike Planning collateral damage modules', confidence: 0.82 },
        { type: 'Defense ethics / accountability platform', reason: 'PAX (Process, Analyze, eXchange) for incident reporting, Army Lessons Learned Information System (ALLIS), Marine Corps Lessons Learned Management System (MCLLMS)', confidence: 0.75 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Defense Acquisition & Reward Loops', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes reward prediction and selects actions based on expected value.', inBusiness: 'In defense, acquisition and reward loops are the contracting machinery that selects which programs get funded, scaled, or canceled.' },
      function: 'Manages defense acquisition, contract awards, and program incentives',
      dysregulation: 'Acquisition friction, valley-of-death, program cancellation, contract protests',
      expectedTypes: [
        { type: 'Defense acquisition consultancy', reason: 'Booz Allen, BCG, Govini \u2014 helps DoD program offices manage acquisition', confidence: 0.88 },
        { type: 'OTA / SBIR proposal writing service', reason: 'Dawnbreaker (Navy SBIR support), TechLink (DoD tech transfer), BRTRC Federal Solutions for OTA teaming', confidence: 0.85 },
        { type: 'Defense procurement intelligence platform', reason: 'Govini, GovWin, FPDS analytics', confidence: 0.85 },
        { type: 'Defense IPO / SPAC advisory', reason: 'Investment banking practices serving defense-tech', confidence: 0.78 }
      ]
    },
    'VAN': {
      fullName: 'Ventral Attention Network', label: 'Indications & Warning (I&W)', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects unexpected stimuli that demand a shift in attention.', inBusiness: 'In defense, indications and warning is the work of catching the early signs of a developing threat before it becomes a crisis.' },
      function: 'Detects early warning indicators of emerging threats',
      dysregulation: 'I&W failure, strategic surprise, missed indicators leading to crisis',
      expectedTypes: [
        { type: 'OSINT / I&W platform', reason: 'Recorded Future, Sayari, Jane\u2019s by Janes', confidence: 0.92 },
        { type: 'Geopolitical risk intelligence', reason: 'Stratfor, Eurasia Group, Control Risks, RANE', confidence: 0.85 },
        { type: 'Anomaly detection on satellite / open data', reason: 'Maxar Anomaly Detection, Planet Insights', confidence: 0.85 },
        { type: 'AI-driven I&W service', reason: 'Two Six, Primer, Palantir AIP for analysts', confidence: 0.85 }
      ]
    },
    'CeA': {
      fullName: 'Central Amygdala', label: 'Threat Detection & Active Defense', tier: 'top',
      neuroTranslation: { inNeurology: 'Initiates rapid defensive responses to perceived threats.', inBusiness: 'In defense, threat detection and active defense is the work of catching incoming attacks and stopping them before they hit.' },
      function: 'Detects incoming kinetic and cyber threats and triggers active defense',
      dysregulation: 'Air defense saturation, missed incoming missile, breached perimeter',
      expectedTypes: [
        { type: 'Air and missile defense vendor', reason: 'Raytheon (Patriot, SM-6), Lockheed (THAAD, PAC-3), MBDA, IAI Iron Dome', confidence: 0.95 },
        { type: 'Counter-UAS vendor', reason: 'Anduril Sentry, Epirus Leonidas, Northrop FAAD, Fortem', confidence: 0.92 },
        { type: 'Active protection system for vehicles', reason: 'Rafael Trophy APS, Israel Iron Fist, GD APS', confidence: 0.85 },
        { type: 'Hypersonic defense R&D contractor', reason: 'Lockheed Martin, Raytheon, Northrop hypersonic intercept programs', confidence: 0.82 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Force Readiness & Sustainment Baseline', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains baseline body homeostasis (temperature, hunger, hormones).', inBusiness: 'In defense, force readiness and sustainment baseline is the work of keeping every unit fed, fueled, paid, equipped, and ready to deploy.' },
      function: 'Maintains force readiness, sustainment, and the daily logistics of a standing military',
      dysregulation: 'Readiness collapse, deferred maintenance, troops underpaid, fuel shortages',
      expectedTypes: [
        { type: 'Defense logistics provider', reason: 'KBR, Fluor, DynCorp, Vectrus \u2014 LOGCAP and base support', confidence: 0.92 },
        { type: 'Defense maintenance / depot contractor', reason: 'Aircraft and vehicle depot maintenance providers', confidence: 0.88 },
        { type: 'Defense fuel / energy contractor', reason: 'Defense Logistics Agency Energy primary suppliers', confidence: 0.85 },
        { type: 'Military housing / base service vendor', reason: 'Liberty Military Housing, Hunt Military Communities', confidence: 0.78 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate', label: 'After-Action Review & Lessons Learned', tier: 'top',
      neuroTranslation: { inNeurology: 'Reviews completed actions and updates expectations based on outcomes.', inBusiness: 'In defense, after-action review is the work of pulling apart what happened in an operation and feeding the lessons back into doctrine.' },
      function: 'Conducts after-action reviews, incident reviews, and lessons-learned propagation',
      dysregulation: 'Repeat mistakes, lessons unlearned, AAR data loss',
      expectedTypes: [
        { type: 'Lessons learned / knowledge management platform', reason: 'CALL (Center for Army Lessons Learned) platforms, Joint Lessons Learned Information System (JLLIS), Marine Corps MCLLMS', confidence: 0.78 },
        { type: 'Defense knowledge management consultancy', reason: 'APQC federal practice, Booz Allen knowledge management, Knowledge Research Institute for joint lessons capture', confidence: 0.75 },
        { type: 'After-action analytics SaaS', reason: 'Palantir Foundry AAR workflow, Primer.ai defense analytics, Anduril Lattice AAR capture', confidence: 0.78 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Strategic Tradeoffs & Risk Decisions', tier: 'top',
      neuroTranslation: { inNeurology: 'Makes strategic tradeoff decisions based on expected value and emotional weighting.', inBusiness: 'In defense, strategic tradeoffs and risk decisions is the work of choosing among capabilities, theaters, and timelines under existential constraint.' },
      function: 'Makes strategic tradeoff decisions about capability investments and force employment',
      dysregulation: 'Sunk-cost programs, commitment to wrong capability, theater misallocation',
      expectedTypes: [
        { type: 'Defense portfolio analytics platform', reason: 'Govini, Tradespace tools, BCG defense portfolio practice', confidence: 0.85 },
        { type: 'Strategic risk advisory firm', reason: 'CSIS, RAND, IDA, MITRE strategic analysis', confidence: 0.85 },
        { type: 'Capability gap analysis service', reason: 'IDA Joint Advanced Warfighting Division, MITRE Capability Portfolio Analysis, CNA Strategic Studies for service gap reviews', confidence: 0.78 }
      ]
    },
    'SMA': {
      fullName: 'Supplementary Motor Area', label: 'Operational Planning & Mobilization', tier: 'top',
      neuroTranslation: { inNeurology: 'Plans and prepares motor sequences before they are executed.', inBusiness: 'In defense, operational planning and mobilization is the work of building the actual war plans, force flow, and timelines that commanders will execute.' },
      function: 'Builds operational plans, force flow timelines, and mobilization sequences',
      dysregulation: 'Plan-execution gap, force flow bottlenecks, mobilization friction',
      expectedTypes: [
        { type: 'Operational planning / war-gaming software', reason: 'Joint Operation Planning and Execution System (JOPES), Improved Deployability Analysis System (IDAS), BAE Systems AXIOM for TPFDD development', confidence: 0.82 },
        { type: 'Force flow / mobility analysis service', reason: 'BAH TRANSCOM mobility practice, CACI TRANSCOM support contracts, MITRE sealift / airlift analysis', confidence: 0.82 },
        { type: 'Defense scenario / simulation provider', reason: 'CAE, Cubic Mission Solutions, BAE Systems training', confidence: 0.85 }
      ]
    },
    'RSC': {
      fullName: 'Retrosplenial Cortex', label: 'Battlespace Mapping & Geospatial Intelligence', tier: 'top',
      neuroTranslation: { inNeurology: 'Maps the spatial environment and supports navigation through it.', inBusiness: 'In defense, battlespace mapping and geospatial intelligence is the work of producing the maps, terrain models, and 3D representations that every operation depends on.' },
      function: 'Produces battlespace maps, terrain models, and the geospatial picture',
      dysregulation: 'Bad terrain data, missing 3D, navigational errors, friendly-fire from bad maps',
      expectedTypes: [
        { type: 'Geospatial intelligence (GEOINT) provider', reason: 'NGA prime contractors: BAE Systems, Maxar, Esri, Planet', confidence: 0.92 },
        { type: '3D terrain / digital twin vendor', reason: 'Vricon (Maxar), Bohemia Interactive Simulations, Improbable', confidence: 0.85 },
        { type: 'Tactical mapping app for warfighters', reason: 'TAK (ATAK / WinTAK / iTAK), Cracked Lab, SitaWare', confidence: 0.88 },
        { type: 'Foundation GEOINT analyst service', reason: 'NGA-cleared analyst services from Leidos, BAH, CACI', confidence: 0.82 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Compliance, Accountability & Inspection', tier: 'top',
      neuroTranslation: { inNeurology: 'Monitors conflict and errors and signals when adjustment is needed.', inBusiness: 'In defense, compliance, accountability, and inspection is the work of catching contract violations, safety failures, and accountability gaps before they become scandals or congressional hearings.' },
      function: 'Enforces defense compliance, accountability, and inspector general functions',
      dysregulation: 'IG findings, contract fraud, safety incidents, congressional investigations',
      expectedTypes: [
        { type: 'Defense audit / IG support service', reason: 'Kearney & Company (DoD IG support), Cotton & Company federal audits, Guidehouse defense audit practice', confidence: 0.82 },
        { type: 'Contract compliance / DCAA prep', reason: 'Redstone Government Consulting, Capital Edge Consulting, Baker Tilly DCAA compliance practice', confidence: 0.85 },
        { type: 'Defense quality assurance vendor', reason: 'AS9100, ISO 9001 for defense supply chain', confidence: 0.78 },
        { type: 'CMMC compliance vendor', reason: 'Cybersecurity Maturity Model Certification preparation', confidence: 0.85 }
      ]
    },
    'MICRO': {
      fullName: 'Microglia', label: 'Vulnerability Patching & Counter-Cyber', tier: 'top',
      neuroTranslation: { inNeurology: 'Patrols brain tissue and removes pathogens, debris, and damaged cells.', inBusiness: 'In defense, vulnerability patching and counter-cyber is the work of scanning every weapon system, network, and supply chain for vulnerabilities and fixing them before an adversary exploits them.' },
      function: 'Identifies and remediates cyber vulnerabilities across weapon systems and networks',
      dysregulation: 'Unpatched weapon system vulnerabilities, supply chain compromise, ransomware on military networks',
      expectedTypes: [
        { type: 'Defense cybersecurity vendor', reason: 'CrowdStrike Falcon Federal, Mandiant, Two Six, Forescout', confidence: 0.92 },
        { type: 'Weapon system cyber assessment service', reason: 'Two Six Technologies, Red Balloon Security, Booz Allen DarkLabs, GrammaTech for embedded weapon-system vulnerability assessment', confidence: 0.88 },
        { type: 'CMMC and DFARS compliance platform', reason: 'PreVeil, Vanta defense, Drata defense', confidence: 0.85 },
        { type: 'Defense red team service', reason: 'Mandiant, Bishop Fox, NetSPI', confidence: 0.85 }
      ]
    },
    'PIN': {
      fullName: 'Pineal Gland', label: 'Operational Tempo & Time-Gated Operations', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates the body\u2019s circadian rhythm and time-gated processes.', inBusiness: 'In defense, operational tempo and time-gated operations is the work of synchronizing operations to a clock — sortie generation, watch cycles, kill chains, deployment windows.' },
      function: 'Synchronizes time-gated operations: sortie generation, watch cycles, deployment windows',
      dysregulation: 'Tempo collapse, sortie generation failures, missed launch windows',
      expectedTypes: [
        { type: 'Sortie generation / mission planning software', reason: 'Lockheed Martin JMPS (Joint Mission Planning System), Boeing Portable Flight Planning Software, BAE Electronic Flight Bag for AOC strike planners', confidence: 0.82 },
        { type: 'Defense scheduling / watch system', reason: 'Navy Standard Integrated Personnel System (NSIPS) rotation, Joint Personnel Adjudication System, CACI Joint Watch scheduling', confidence: 0.75 },
        { type: 'Launch window optimization service', reason: 'a.i. solutions FreeFlyer, AGI STK Scheduler, ExoAnalytic orbital window support for Space Force and NRO', confidence: 0.78 }
      ]
    },

    // ── DEFENSE-OPERATIONAL NODES (83) — 2 business types each ──
    'A1':        { fullName: 'Primary Auditory Cortex', label: 'Acoustic Sensing and SIGINT', tier: 'operational', function: 'Processes acoustic intelligence and acoustic threat detection (sonar, gunshot detection)', dysregulation: 'Acoustic blind spot', expectedTypes: [{ type: 'Sonar / underwater acoustic vendor', reason: 'Lockheed Martin sonar, Thales sonar, IAI underwater', confidence: 0.85 }, { type: 'Gunshot detection / acoustic localization', reason: 'ShotSpotter, Raytheon Boomerang', confidence: 0.78 }] },
    'ADR':       { fullName: 'Adrenal', label: 'Crisis Mobilization Response', tier: 'operational', function: 'Provides surge capacity for crisis military response', dysregulation: 'Crisis fatigue', expectedTypes: [{ type: 'Rapid deployment / surge contractor', reason: 'DynCorp / Amentum (LOGCAP contingency surge), KBR HARBOUR crisis response, Fluor rapid-response base build-out teams', confidence: 0.78 }] },
    'AG':        { fullName: 'Angular Gyrus', label: 'Multi-INT Fusion', tier: 'operational', function: 'Integrates information across multiple intelligence disciplines (SIGINT, GEOINT, HUMINT, OSINT)', dysregulation: 'Stovepiped intel', expectedTypes: [{ type: 'Multi-INT fusion platform', reason: 'Palantir Gaia, Anduril Lattice, BAE Sentinel', confidence: 0.90 }] },
    'AI':        { fullName: 'Anterior Insula', label: 'Threat Risk Triage', tier: 'operational', function: 'Triages and prioritizes threat indicators across the battlespace', dysregulation: 'Alert fatigue', expectedTypes: [{ type: 'Threat triage / decision support tool', reason: 'Palantir AIP threat ranking, Anduril Lattice priority queues, Primer.ai Command for analyst triage', confidence: 0.78 }] },
    'ANT':       { fullName: 'Anterior Thalamus', label: 'Watch Floor Attention Routing', tier: 'operational', function: 'Routes operator attention to high-priority watch items', dysregulation: 'Watch standing fatigue', expectedTypes: [{ type: 'Command center / watch dashboard', reason: 'Barco video wall controllers, Crestron C2 room integration, Leidos Command Center Modernization for watch floors', confidence: 0.75 }] },
    'ARC':       { fullName: 'Arcuate Fasciculus', label: 'Linguistic & Cultural Translation for HUMINT', tier: 'operational', function: 'Bridges language and culture for human intelligence and military diplomacy', dysregulation: 'HUMINT failure', expectedTypes: [{ type: 'Defense linguist / translation provider', reason: 'SOS International, Worldwide Language Resources, Mission Essential', confidence: 0.85 }] },
    'BDNF':      { fullName: 'Brain-Derived Neurotrophic Factor', label: 'Military Education and Training Pipeline', tier: 'operational', function: 'Develops and maintains the military education and training pipeline', dysregulation: 'Skill atrophy', expectedTypes: [{ type: 'Military training simulation vendor', reason: 'CAE, Cubic, BAE Systems, Lockheed Martin training', confidence: 0.88 }, { type: 'Professional military education provider', reason: 'War colleges and contractor instructors', confidence: 0.78 }] },
    'BLA':       { fullName: 'Basolateral Amygdala', label: 'Adversary Pattern Memory & Threat Modeling', tier: 'operational', function: 'Builds and maintains threat models from past adversary behavior', dysregulation: 'Outdated threat models', expectedTypes: [{ type: 'Threat intelligence / actor profiling vendor', reason: 'Mandiant, Recorded Future, Janes adversary analysis', confidence: 0.88 }] },
    'BNST':      { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Sustained Strategic Anxiety Monitoring', tier: 'operational', function: 'Monitors slow-burning strategic concerns (e.g., gradual force modernization by adversaries)', dysregulation: 'Slow-burn strategic surprise', expectedTypes: [{ type: 'Strategic competition analysis service', reason: 'CSBA, RAND, IDA \u2014 long-term competition analysis', confidence: 0.78 }] },
    'BROCA':     { fullName: 'Broca\u2019s Area', label: 'Defense Communications Production', tier: 'operational', function: 'Produces messaging, briefings, and strategic communications for defense audiences', dysregulation: 'Garbled messaging', expectedTypes: [{ type: 'Strategic communications / IO vendor', reason: 'PSYOP, MISO, IO contractors for SOCOM and allies', confidence: 0.82 }] },
    'CARD':      { fullName: 'Cardiovascular System', label: 'Defense Network Heartbeat / SLA', tier: 'operational', function: 'Maintains heartbeat and SLA monitoring for defense networks', dysregulation: 'Network outage', expectedTypes: [{ type: 'Defense network monitoring vendor', reason: 'SolarWinds Federal NPM, Netscout nGeniusONE Federal, ScienceLogic SL1 for DISA DoDIN SLA monitoring', confidence: 0.75 }] },
    'CAUD':      { fullName: 'Caudate Nucleus', label: 'Habitual Operations & Workflow Automation', tier: 'operational', function: 'Automates repetitive defense workflows and operations', dysregulation: 'Manual overload', expectedTypes: [{ type: 'Defense RPA / workflow automation', reason: 'UiPath defense, Govini workflow', confidence: 0.78 }] },
    'CC':        { fullName: 'Corpus Callosum', label: 'Cross-Service Integration', tier: 'operational', function: 'Integrates across services and combatant commands', dysregulation: 'Stovepiping', expectedTypes: [{ type: 'JADC2 integration consultancy', reason: 'Northrop Grumman IBCS, L3Harris Tactical Data Links, Anduril Lattice for JADC2, Palantir TITAN for Army JADC2', confidence: 0.82 }] },
    'CING':      { fullName: 'Cingulate Cortex (general)', label: 'Mission Conflict & Internal Coordination', tier: 'operational', function: 'Handles internal mission conflict and resolution within commands', dysregulation: 'Mission conflict', expectedTypes: [{ type: 'Defense culture / change management', reason: 'McKinsey Defense Practice, BCG Public Sector, Deloitte Federal for service-level change management on Future of Work / AI adoption', confidence: 0.72 }] },
    'CLAUST':    { fullName: 'Claustrum', label: 'Cross-Sensor Correlation', tier: 'operational', function: 'Correlates events across sensors and intelligence disciplines', dysregulation: 'Fragmented battlespace picture', expectedTypes: [{ type: 'Sensor correlation engine', reason: 'Palantir Gaia correlation layer, Anduril Lattice sensor fusion backbone, BAE Systems Sentinel multi-INT correlation', confidence: 0.82 }] },
    'CMZ':       { fullName: 'Central Midbrain Zone', label: 'Alert Posture and Defcon Management', tier: 'operational', function: 'Manages alert posture, force protection condition, and DEFCON levels', dysregulation: 'Alert fatigue', expectedTypes: [{ type: 'Force protection / FPCON management tool', reason: 'ATFP Enterprise Solution (Navy ATFP), ESS Electronic Security Systems (Army), Honeywell Pro-Watch for installation FPCON', confidence: 0.75 }] },
    'CON':       { fullName: 'Cingulo-opercular Network', label: 'Sustained Mission Command', tier: 'operational', function: 'Maintains sustained mission command across long-duration operations', dysregulation: 'Mission command degradation', expectedTypes: [{ type: 'Mission command / C2 platform', reason: 'BAE Systems CommandPost, Northrop IBCS', confidence: 0.85 }] },
    'DISS':      { fullName: 'Dissociation', label: 'Wargaming and Red Teaming', tier: 'operational', function: 'Runs wargames and red team exercises to expose plan weaknesses', dysregulation: 'Untested plans', expectedTypes: [{ type: 'Wargaming / red team service', reason: 'CSIS wargames, Booz Allen red teams, RAND wargaming', confidence: 0.85 }] },
    'DMN':       { fullName: 'Default Mode Network', label: 'Standing Defense Posture', tier: 'operational', function: 'Operates the default standing defense posture (peacetime garrison readiness)', dysregulation: 'Garrison rot', expectedTypes: [{ type: 'Garrison sustainment / base support', reason: 'KBR, Vectrus, Fluor base operations contracts', confidence: 0.85 }] },
    'DV':        { fullName: 'Dorsal Vagal Complex', label: 'Drawdown and Demobilization', tier: 'operational', function: 'Handles graceful drawdown and demobilization after operations', dysregulation: 'Bad drawdown', expectedTypes: [{ type: 'Equipment demilitarization / disposal vendor', reason: 'DLA Disposition Services contractors, Liquidity Services / GovDeals federal surplus, Eagle Industries demil services', confidence: 0.72 }] },
    'EC':        { fullName: 'Entorhinal Cortex', label: 'Threat Indicator Indexing', tier: 'operational', function: 'Indexes threat indicators for rapid retrieval', dysregulation: 'Stale threat data', expectedTypes: [{ type: 'Threat indicator database / TIP', reason: 'ThreatConnect Federal, Anomali ThreatStream, Recorded Future Intelligence Cloud for IC / DoD TIP deployments', confidence: 0.78 }] },
    'EI':        { fullName: 'Excitatory/Inhibitory Balance', label: 'Force Posture Balancing', tier: 'operational', function: 'Balances offensive and defensive force posture', dysregulation: 'Posture imbalance', expectedTypes: [{ type: 'Force posture analysis service', reason: 'CSIS Defense360, RAND posture studies', confidence: 0.78 }] },
    'EMP':       { fullName: 'Empathy Circuit', label: 'Civil-Military and Humanitarian Operations', tier: 'operational', function: 'Manages civil-military relations, humanitarian operations, and population engagement', dysregulation: 'Population alienation', expectedTypes: [{ type: 'CMO / humanitarian operations contractor', reason: 'USAID OFDA partners, Civil Affairs contractors', confidence: 0.78 }] },
    'ENDO':      { fullName: 'Endocrine System', label: 'Scheduled Force Generation', tier: 'operational', function: 'Schedules training, deployment, and force generation rotations', dysregulation: 'Schedule slip', expectedTypes: [{ type: 'Force generation / unit rotation tool', reason: 'Army Force Management System (FMSWeb), Navy Fleet Training Management Planning System (FLTMPS), Air Force TFI readiness tools', confidence: 0.72 }] },
    'ENS':       { fullName: 'Enteric Nervous System', label: 'Autonomous Drone Operations', tier: 'operational', function: 'Runs autonomous unmanned operations without continuous human direction', dysregulation: 'Lost autonomy', expectedTypes: [{ type: 'Autonomy mission management software', reason: 'Anduril Lattice, Shield AI Hivemind', confidence: 0.85 }] },
    'FG':        { fullName: 'Fusiform Gyrus', label: 'Computer Vision Targeting', tier: 'operational', function: 'Computer vision for target identification and ATR (automatic target recognition)', dysregulation: 'False targets', expectedTypes: [{ type: 'AI computer vision targeting vendor', reason: 'Project Maven primes (Palantir, Microsoft, Amazon, Google)', confidence: 0.88 }, { type: 'Target classification AI', reason: 'Automatic target recognition models', confidence: 0.85 }] },
    'FORN':      { fullName: 'Fornix', label: 'Intelligence Pipeline & Dissemination', tier: 'operational', function: 'Moves intelligence from collection to analysts to decision-makers', dysregulation: 'Intel pipeline gap', expectedTypes: [{ type: 'Intelligence dissemination platform', reason: 'Leidos DI2E / IC ITE dissemination backbone, ManTech IC cloud, Peraton NRO ground systems for intel pipeline delivery', confidence: 0.80 }] },
    'GABA_GLU':  { fullName: 'GABA / Glutamate Balance', label: 'Escalation Management & De-escalation', tier: 'operational', function: 'Balances escalation and de-escalation in crisis', dysregulation: 'Inadvertent escalation', expectedTypes: [{ type: 'Crisis management / escalation control consultancy', reason: 'CSIS, RAND, ICDS escalation analysis', confidence: 0.80 }] },
    'GBA':       { fullName: 'Gut-Brain Axis', label: 'Field Feedback Loops', tier: 'operational', function: 'Maintains feedback from the field back to acquisition and doctrine', dysregulation: 'Doctrine-field mismatch', expectedTypes: [{ type: 'Field feedback / lessons learned tool', reason: 'Army Lessons Learned Information System (ALLIS), Joint Lessons Learned Information System (JLLIS), Defense Innovation Unit warfighter feedback workflows', confidence: 0.72 }] },
    'GP':        { fullName: 'Globus Pallidus', label: 'Engagement Authorization Gating', tier: 'operational', function: 'Gates fire authorization through ROE and command approvals', dysregulation: 'Engagement bypass', expectedTypes: [{ type: 'Fire control / authorization workflow', reason: 'Northrop Grumman IBCS engagement authority gating, Lockheed Martin AFATDS fires approval, Raytheon Patriot engagement control station', confidence: 0.78 }] },
    'HAB':       { fullName: 'Habenula', label: 'Failure Signal Propagation', tier: 'operational', function: 'Propagates failure signals through the joint force', dysregulation: 'Repeat failures', expectedTypes: [{ type: 'Lessons learned platform', reason: 'CALL, Marine Corps Lessons Learned, Navy Lessons Learned', confidence: 0.75 }] },
    'HIPP':      { fullName: 'Hippocampus', label: 'Defense Knowledge Repository', tier: 'operational', function: 'Stores defense knowledge, doctrine, and historical lessons', dysregulation: 'Knowledge loss', expectedTypes: [{ type: 'Defense knowledge management system', reason: 'milSuite, intelink-style knowledge platforms', confidence: 0.78 }] },
    'HPA':       { fullName: 'HPA Axis', label: 'Multi-Tier Crisis Escalation', tier: 'operational', function: 'Manages multi-tier crisis escalation from tactical to strategic', dysregulation: 'Escalation gap', expectedTypes: [{ type: 'Crisis action team support tool', reason: 'Joint Crisis Action Planning System (JCAPS), Knowledge Management / Decision Support (KM/DS) tools for COCOM CATs, BAH Crisis Action Team integration support', confidence: 0.72 }] },
    'IC':        { fullName: 'Inferior Colliculus', label: 'Intel Stream Routing', tier: 'operational', function: 'Routes incoming intel streams to the right analyst desks', dysregulation: 'Stream loss', expectedTypes: [{ type: 'Intel routing middleware', reason: 'Solace PubSub+ (IC cloud messaging), Cloudera CDP for IC C2S, Red Hat AMQ for intel stream bus', confidence: 0.72 }] },
    'IPS':       { fullName: 'Intraparietal Sulcus', label: 'Defense Data Engineering', tier: 'operational', function: 'Runs defense data engineering and analytics infrastructure', dysregulation: 'Data pipeline failure', expectedTypes: [{ type: 'Defense data platform', reason: 'Palantir Gotham, Snowflake Federal, Databricks Federal', confidence: 0.88 }] },
    'LANG':      { fullName: 'Language Network', label: 'Multilingual Defense Operations', tier: 'operational', function: 'Supports multilingual defense operations across allied and adversary languages', dysregulation: 'Translation gap', expectedTypes: [{ type: 'Defense translation / linguist provider', reason: 'SOSi, Mission Essential, Worldwide Language', confidence: 0.85 }] },
    'LAR':       { fullName: 'Laryngeal Cortex', label: 'Public Affairs and Military Spokesperson', tier: 'operational', function: 'Manages public affairs and official defense statements', dysregulation: 'Off-message statements', expectedTypes: [{ type: 'Defense PA / strategic communications firm', reason: 'APCO Worldwide Defense, Edelman Public Affairs Federal, Strategic Communications Group for PA and MILDEC support', confidence: 0.72 }] },
    'LC':        { fullName: 'Locus Coeruleus', label: 'Global Alert Broadcasts', tier: 'operational', function: 'Broadcasts global alerts that demand immediate joint force attention', dysregulation: 'Alert overload', expectedTypes: [{ type: 'Global alert dissemination tool', reason: 'Everbridge Mass Notification (DoD), AtHoc (BlackBerry) for NIPR/SIPR alerts, Rave Mobile Safety federal alerting', confidence: 0.72 }] },
    'LGN':       { fullName: 'Lateral Geniculate Nucleus', label: 'EO/IR Imagery Pipelines', tier: 'operational', function: 'Ingests and processes EO/IR imagery streams', dysregulation: 'Frame loss', expectedTypes: [{ type: 'Full motion video (FMV) processing vendor', reason: 'L3Harris FMV, BAE Systems FMV', confidence: 0.85 }] },
    'MAMM':      { fullName: 'Mammillary Bodies', label: 'Long-Term Intelligence Archive', tier: 'operational', function: 'Archives long-term intelligence and historical files', dysregulation: 'Archive loss', expectedTypes: [{ type: 'Intelligence archive / records system', reason: 'Iron Mountain Government Services, OpenText Documentum Federal, Perspecta NARA archival contracts for IC records management', confidence: 0.72 }] },
    'MDT':       { fullName: 'Mediodorsal Thalamus', label: 'AI Decision Gating for Lethal Action', tier: 'operational', function: 'Gates AI-assisted lethal decisions through human-in-the-loop review', dysregulation: 'Unsafe autonomy', expectedTypes: [{ type: 'Human-on-the-loop / AI ethics tool', reason: 'Credo AI Responsible AI governance, Palantir Foundry AIP guardrails, CAIS (Center for AI Safety) advisory for DoD 3000.09 compliance', confidence: 0.85 }] },
    'MGN':       { fullName: 'Medial Geniculate Nucleus', label: 'Acoustic Intelligence Routing', tier: 'operational', function: 'Routes acoustic and SIGINT signal streams to analysts', dysregulation: 'Stream loss', expectedTypes: [{ type: 'SIGINT processing platform', reason: 'NSA platform contractors', confidence: 0.78 }] },
    'NAcc':      { fullName: 'Nucleus Accumbens', label: 'Defense Talent Reward Systems', tier: 'operational', function: 'Manages defense talent compensation, bonuses, and reward systems', dysregulation: 'Talent attrition', expectedTypes: [{ type: 'Defense talent management platform', reason: 'Workday Federal (Army IPPS-A), Oracle Cloud HCM for DoD, SAP SuccessFactors Federal for military talent and incentive programs', confidence: 0.72 }] },
    'NBM':       { fullName: 'Nucleus Basalis of Meynert', label: 'Operational Tempo and Sortie Generation', tier: 'operational', function: 'Sets and sustains operational tempo / sortie generation', dysregulation: 'Tempo collapse', expectedTypes: [{ type: 'Sortie generation analytics', reason: 'Lockheed Martin Sortie Generation Model, LOGSA sortie analytics, Palantir Foundry for AOC squadron tempo dashboards', confidence: 0.75 }] },
    'NEOCER':    { fullName: 'Neocerebellum', label: 'Fine Targeting Refinement', tier: 'operational', function: 'Refines targeting solutions through prediction-error correction', dysregulation: 'Targeting drift', expectedTypes: [{ type: 'AI-augmented targeting refinement', reason: 'Raytheon SeaRAM and SM-6 terminal guidance updates, Lockheed Martin LRASM seeker refinement, Palantir Project Maven target refinement', confidence: 0.78 }] },
    'OFC':       { fullName: 'Orbitofrontal Cortex', label: 'Defense Acquisition Value Decisions', tier: 'operational', function: 'Evaluates expected value of acquisition tradeoffs', dysregulation: 'Negative ROI programs', expectedTypes: [{ type: 'Defense ROI / cost-benefit analysis service', reason: 'Govini Ark acquisition analytics, Technomics / Tecolote cost estimating, CAPE (Cost Assessment and Program Evaluation) support contractors', confidence: 0.78 }] },
    'OLF':       { fullName: 'Olfactory System', label: 'Anomaly Detection by Pattern Match', tier: 'operational', function: 'Detects subtle threat anomalies by analogy to past patterns', dysregulation: 'Novel threats missed', expectedTypes: [{ type: 'Anomaly detection / OSINT vendor', reason: 'Recorded Future, Sayari, Two Six anomaly detection', confidence: 0.82 }] },
    'OPIOID':    { fullName: 'Opioid System', label: 'Veteran Wellness and Care', tier: 'operational', function: 'Provides veteran wellness, transition support, and care', dysregulation: 'Veteran crisis', expectedTypes: [{ type: 'Veteran wellness / transition platform', reason: 'Wounded Warrior Project, Cohen Veterans Network, Give an Hour, BAH VA behavioral health contracts, Maximus VA disability claims', confidence: 0.78 }] },
    'OSC':       { fullName: 'Neural Oscillators', label: 'Watch Cycle Synchronization', tier: 'operational', function: 'Synchronizes watch cycles, comm windows, and operational rhythms', dysregulation: 'Sync loss', expectedTypes: [{ type: 'Time synchronization / GPS PNT vendor', reason: 'Microchip Technology (Symmetricom) PNT, Orolia / Safran Federal for defense timing, Microsemi TimeProvider for DoD networks', confidence: 0.75 }] },
    'OXY':       { fullName: 'Oxytocin System', label: 'Coalition Trust and Information Sharing', tier: 'operational', function: 'Builds trust and information sharing with coalition partners', dysregulation: 'Coalition trust loss', expectedTypes: [{ type: 'Coalition information sharing platform', reason: 'CFBLNet, CENTRIXS, MPE platforms', confidence: 0.80 }] },
    'PBN':       { fullName: 'Parabrachial Nucleus', label: 'Capacity / Capability Signaling', tier: 'operational', function: 'Signals capacity and capability constraints up the chain', dysregulation: 'Silent overload', expectedTypes: [{ type: 'Capacity reporting tool', reason: 'DRRS-S / DRRS-A / DRRS-N readiness reporting contractors (CACI, Leidos, Jacobs Technology) for joint readiness status', confidence: 0.72 }] },
    'PCC':       { fullName: 'Posterior Cingulate Cortex', label: 'Retrospective Battle Damage Assessment', tier: 'operational', function: 'Conducts retrospective battle damage assessment and operations review', dysregulation: 'Bad BDA', expectedTypes: [{ type: 'BDA / post-strike analysis vendor', reason: 'Maxar, Planet Labs, BlackSky post-strike imagery', confidence: 0.85 }] },
    'PI':        { fullName: 'Posterior Insula', label: 'Force Health & Internal State', tier: 'operational', function: 'Monitors force health and internal physical/morale state', dysregulation: 'Force health collapse', expectedTypes: [{ type: 'Force health protection vendor', reason: 'Leidos DHMSM (MHS GENESIS) deployment, Oura Ring DoD wearables, Garmin tactix wearables, WHOOP DoD biometric pilots', confidence: 0.75 }] },
    'PPN':       { fullName: 'Pedunculopontine Nucleus', label: 'Continuous Operations Cadence', tier: 'operational', function: 'Maintains continuous operations cadence (24/7 watch, ongoing patrols)', dysregulation: 'Tempo collapse', expectedTypes: [{ type: 'Defense rotation / cadence management', reason: 'Navy Fleet Response Training Plan (FRTP) tooling, Army Sustainable Readiness Model (SRM) support, Air Force AFFORGEN cycle tooling', confidence: 0.72 }] },
    'PIT':       { fullName: 'Pituitary Gland', label: 'Strategic Order Broadcast', tier: 'operational', function: 'Broadcasts strategic orders and OPLAN updates across the joint force', dysregulation: 'Order loss', expectedTypes: [{ type: 'Order dissemination / OPORD platform', reason: 'GCCS-J (Global Command and Control System \u2014 Joint), Command Post Computing Environment (CPCE), Systematic SitaWare Headquarters for OPORD flow', confidence: 0.72 }] },
    'PRECUNEUS': { fullName: 'Precuneus', label: 'Self-Reflection & Force Analytics', tier: 'operational', function: 'Provides self-reflective analytics on force performance', dysregulation: 'Self-awareness gap', expectedTypes: [{ type: 'Force analytics dashboard', reason: 'DRRS, GCSS, Joint Lessons Learned analytics', confidence: 0.78 }] },
    'PULV':      { fullName: 'Pulvinar', label: 'Critical Target Attention Weighting', tier: 'operational', function: 'Weights attention by target criticality (high-value targets, time-sensitive targets)', dysregulation: 'HVT blindness', expectedTypes: [{ type: 'HVT / TST tracking system', reason: 'Lockheed Martin TBMCS for JFACC, Raytheon ATTCS for time-sensitive targeting, BAE GXP Xplorer for HVT track management', confidence: 0.78 }] },
    'PUT':       { fullName: 'Putamen', label: 'Habit-Formed Tactical Drills', tier: 'operational', function: 'Reinforces habitual tactical drills through repetition', dysregulation: 'Drill rot', expectedTypes: [{ type: 'Tactical drill / training platform', reason: 'Cubic Global Defense live training, CAE Defense & Security simulators, Bohemia Interactive VBS4 for tactical drill repetition', confidence: 0.78 }] },
    'RAPHE':     { fullName: 'Raphe Nuclei', label: 'Force Morale and Mood Monitoring', tier: 'operational', function: 'Monitors overall force morale and mood', dysregulation: 'Morale decay', expectedTypes: [{ type: 'Defense survey / morale tool', reason: 'DEOCS and similar morale climate surveys', confidence: 0.72 }] },
    'RF':        { fullName: 'Reticular Formation', label: 'Wake-from-Garrison Activation', tier: 'operational', function: 'Wakes garrison forces from peacetime to wartime posture', dysregulation: 'Activation lag', expectedTypes: [{ type: 'Mobilization / activation platform', reason: 'Army Reserve AR-MS (Mobilization System), Navy Reserve NSIPS mobilization, Air National Guard ARCNet activation tooling', confidence: 0.72 }] },
    'S1':        { fullName: 'Primary Somatosensory Cortex', label: 'Tactile and Wearable Battlefield Sensing', tier: 'operational', function: 'Collects soldier-worn and tactile battlefield sensing data', dysregulation: 'Soldier health blind spots', expectedTypes: [{ type: 'Soldier-worn sensor vendor', reason: 'Oura Ring DoD program, WHOOP tactical band, Garmin tactix, BioIntelliSense BioButton for deployed force biometric monitoring', confidence: 0.78 }] },
    'SC':        { fullName: 'Superior Colliculus', label: 'Orient-to-Threat Tactical Picture', tier: 'operational', function: 'Orients commanders to new threats fast (tactical common operating picture)', dysregulation: 'TacCOP overload', expectedTypes: [{ type: 'Tactical common operating picture vendor', reason: 'TAK, SitaWare, BAE BattleSpace', confidence: 0.85 }] },
    'SEPT':      { fullName: 'Septal Nuclei', label: 'Trust and Identity Management', tier: 'operational', function: 'Manages trust relationships and identity across the defense ecosystem', dysregulation: 'Identity / PKI rot', expectedTypes: [{ type: 'Defense identity / PKI vendor', reason: 'CAC / PIV / DBids identity infrastructure', confidence: 0.82 }] },
    'SMN':       { fullName: 'Somatomotor Network', label: 'Physical Defense Operations', tier: 'operational', function: 'Runs physical defense operations: bases, ranges, depots, ports', dysregulation: 'Base infrastructure failure', expectedTypes: [{ type: 'Base operations support contractor', reason: 'KBR, Vectrus, Fluor, DynCorp BOS', confidence: 0.85 }] },
    'SN':        { fullName: 'Salience Network', label: 'Strategic Salience Detection', tier: 'operational', function: 'Detects which threats deserve strategic attention right now', dysregulation: 'Strategic blindness', expectedTypes: [{ type: 'Strategic intelligence service', reason: 'DIA / NGA / NSA contractor analysis providers', confidence: 0.82 }] },
    'SNIG':      { fullName: 'Substantia Nigra', label: 'Force Modernization Initiative Drive', tier: 'operational', function: 'Initiates and sustains force modernization initiatives', dysregulation: 'Modernization paralysis', expectedTypes: [{ type: 'Defense modernization consultancy', reason: 'BAH, BCG, McKinsey defense modernization practices', confidence: 0.82 }] },
    'SNS':       { fullName: 'Sympathetic Nervous System', label: 'Combat Surge Mobilization', tier: 'operational', function: 'Mobilizes combat forces in response to acute threats', dysregulation: 'Surge fatigue', expectedTypes: [{ type: 'Surge mobilization contractor', reason: 'Amentum (LOGCAP surge support), KBR HARBOUR contingency response, Vectrus / V2X rapid base stand-up teams', confidence: 0.78 }] },
    'STN':       { fullName: 'Subthalamic Nucleus', label: 'Operational Pause and Fire Hold', tier: 'operational', function: 'Halts ongoing operations for safety, ROE, or political pause', dysregulation: 'Failed hold', expectedTypes: [{ type: 'Operational pause / ROE enforcement tool', reason: 'Lockheed Martin AFATDS cease-fire controls, Raytheon Patriot ECS hold logic, Northrop IBCS engagement inhibit functions', confidence: 0.72 }] },
    'STS':       { fullName: 'Superior Temporal Sulcus', label: 'Pattern of Life and Behavioral Analysis', tier: 'operational', function: 'Analyzes pattern-of-life and adversary behavior', dysregulation: 'POL blindness', expectedTypes: [{ type: 'Pattern-of-life analysis service', reason: 'Babel Street pattern-of-life, Dataminr First Alert for SOF targeting, Fivecast ONYX for POL analysis on IC and DoD targets', confidence: 0.85 }] },
    'TPJ':       { fullName: 'Temporoparietal Junction', label: 'Adversary Perspective & Red Cell', tier: 'operational', function: 'Brings adversary perspective into planning through red cell analysis', dysregulation: 'Mirror imaging', expectedTypes: [{ type: 'Red cell / adversary emulation service', reason: 'CSIS Red Cell, RAND wargaming, Booz Allen red teaming', confidence: 0.82 }] },
    'TPOLE':     { fullName: 'Temporal Pole', label: 'Defense Brand and Reputation Memory', tier: 'operational', function: 'Maintains defense brand and reputation memory across services', dysregulation: 'Brand damage', expectedTypes: [{ type: 'Defense PA / brand monitoring', reason: 'Meltwater Federal media monitoring, Cision Federal, Critical Mention for service-level PA brand tracking', confidence: 0.65 }] },
    'THAL':      { fullName: 'Thalamus', label: 'Defense Network Routing & MILSATCOM', tier: 'operational', function: 'Routes traffic across defense networks and military satellite communications', dysregulation: 'Network outage', expectedTypes: [{ type: 'MILSATCOM provider', reason: 'Iridium Government, Inmarsat Government, Viasat, Boeing WGS', confidence: 0.88 }] },
    'TrkB':      { fullName: 'Tropomyosin receptor kinase B', label: 'Defense Experimentation', tier: 'operational', function: 'Enables safe defense experimentation (new tactics, new tech, new force structures)', dysregulation: 'No experimentation', expectedTypes: [{ type: 'Defense experimentation / Project Convergence support', reason: 'SAIC Project Convergence integration, Leidos INDOPACOM experimentation, MITRE DIU experimentation support and AFWERX Spark Cells', confidence: 0.78 }] },
    'UNC':       { fullName: 'Uncinate Fasciculus', label: 'Allied Relationship Memory & Liaison', tier: 'operational', function: 'Maintains long-term allied relationships and liaison memory', dysregulation: 'Liaison rot', expectedTypes: [{ type: 'Defense diplomacy / SCOs', reason: 'SOSi Security Cooperation programs, PAE / Amentum OSC advisor contracts, DynCorp / Amentum ministerial advisory teams', confidence: 0.78 }] },
    'V1':        { fullName: 'Primary Visual Cortex', label: 'Raw Imagery Capture (Satellite + UAV)', tier: 'operational', function: 'Captures raw visual imagery from space and air platforms', dysregulation: 'Capture failure', expectedTypes: [{ type: 'Commercial satellite imagery provider', reason: 'Maxar, Planet, BlackSky, Capella, ICEYE', confidence: 0.92 }] },
    'VERM':      { fullName: 'Cerebellar Vermis', label: 'Core Command Reliability', tier: 'operational', function: 'Provides core command reliability across long-running operations', dysregulation: 'C2 outage', expectedTypes: [{ type: 'C2 reliability / managed mission services', reason: 'Leidos DISA GSM-O managed services, General Dynamics IT GSM-O II, Perspecta / Peraton managed C2 operations', confidence: 0.75 }] },
    'VEST':      { fullName: 'Vestibular System', label: 'Force Posture Drift Detection', tier: 'operational', function: 'Detects drift between intended force posture and actual posture', dysregulation: 'Posture drift', expectedTypes: [{ type: 'Force posture monitoring service', reason: 'CSIS Defense Futures, RAND posture tracking', confidence: 0.78 }] },
    'VP':        { fullName: 'Ventral Pallidum', label: 'Program Sunset & Divestment', tier: 'operational', function: 'Handles graceful program sunset, divestment, and capability retirement', dysregulation: 'Zombie programs', expectedTypes: [{ type: 'Program divestment consultancy', reason: 'Alvarez & Marsal Federal restructuring, Guidehouse defense portfolio optimization, Deloitte Federal divestment strategy for PBD 720 and Nunn-McCurdy triggered programs', confidence: 0.72 }] },
    'VTA':       { fullName: 'Ventral Tegmental Area', label: 'External Innovator Incentives', tier: 'operational', function: 'Incentivizes external innovators through prize challenges and OTAs', dysregulation: 'Innovator dropout', expectedTypes: [{ type: 'Defense prize challenge / OTA platform', reason: 'AFWERX, NavalX, Army xTech, Defense Innovation Unit', confidence: 0.85 }] },
    'VV':        { fullName: 'Ventral Vagal Complex', label: 'Calm-State Engagement Operations', tier: 'operational', function: 'Runs calm-state engagement operations (security cooperation, training, exercises)', dysregulation: 'Engagement decay', expectedTypes: [{ type: 'Security cooperation contractor', reason: 'DSCA prime contractors and security cooperation orgs', confidence: 0.78 }] },
    'WERN':      { fullName: 'Wernicke\u2019s Area', label: 'Defense NLU and Document Analysis', tier: 'operational', function: 'Understands and processes natural language for defense applications', dysregulation: 'Misunderstood directives', expectedTypes: [{ type: 'Defense NLP / document analysis vendor', reason: 'Primer, Two Six, BAE NLP defense applications', confidence: 0.85 }] },
    'mPFC':      { fullName: 'Medial Prefrontal Cortex', label: 'Defense Program Quality Engineering', tier: 'operational', function: 'Runs quality engineering across defense programs', dysregulation: 'Quality regressions', expectedTypes: [{ type: 'Defense quality assurance / IV&V vendor', reason: 'Aerospace Corporation IV&V for space programs, MITRE FFRDC IV&V, SAIC IV&V services for DoD major programs', confidence: 0.78 }] },
    'vlPFC':     { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Defense Authorization & Access Control', tier: 'operational', function: 'Enforces authorization and access control across defense networks', dysregulation: 'Insider threat', expectedTypes: [{ type: 'Defense IAM / PAM vendor', reason: 'CyberArk Federal, BeyondTrust Federal, SailPoint Federal', confidence: 0.82 }] }
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
    var brain = brains.get('defense');
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
    var brain = brains.get('defense');
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
      var brain = brains ? brains.get('defense') : null;
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
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Defense.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: this business type becomes eligible for future portal path mapping within Defense.';
          else consequence = 'If approved: this business type is recorded as a valid Defense mapping. Requires further validation.';
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

  window.LIMENDefenseBusinessEngine = {
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
  console.log('[DefenseBusinessEngine] Loaded \u2014 103-node defense business engine');
})();
