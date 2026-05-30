/**
 * energy-node-business-engine.js — Energy Node-to-Business Assignment Engine
 *
 * ENERGY DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture:
 *   - Covers 103 operational nodes (20 RI/framework nodes excluded)
 *   - Filters generic template treatments before inference
 *   - Compares existing companies against business-type directory
 *
 * Outputs 3 buckets:
 *   MAPPED     — already mapped and active in Energy system
 *   MISSING    — plausible but missing from current Energy mappings
 *   SPECULATIVE — low-confidence or novel suggestions
 *
 * Approval statuses:
 *   PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_energy_business_approvals')
 *
 * Self-gates: only runs when ?domain=energy is in the URL.
 * Exposes: window.LIMENEnergyBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'energy') return;

  var STORAGE_KEY = 'limen_energy_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_energy_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

  // ══════════════════════════════════════════════════════════════════════
  // RI/FRAMEWORK NODES — excluded from business generation
  // ══════════════════════════════════════════════════════════════════════

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  // ══════════════════════════════════════════════════════════════════════
  // GENERIC TREATMENT FILTER
  // ══════════════════════════════════════════════════════════════════════

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
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {

    // ── TOP-TIER (20 portal-active) ──────────────────────────────────

    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Power Generation', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage — sends direct commands for voluntary movement.', inBusiness: 'In energy, this is power generation. Raw fuel inputs are converted into usable electrical output through turbines, generators, and solar arrays.' },
      function: 'Converts primary energy sources into electrical power',
      dysregulation: 'Capacity shortfall, generator failure, frequency deviation',
      expectedTypes: [
        { type: 'Utility-scale power producer', reason: 'Core generation capacity — turbines, plants, dispatch', confidence: 0.95 },
        { type: 'Gas turbine manufacturer', reason: 'Equipment supply for thermal generation', confidence: 0.90 },
        { type: 'Independent power producer', reason: 'Competitive generation outside regulated utilities', confidence: 0.85 },
        { type: 'Power plant O&M contractor', reason: 'Operations and maintenance for generation assets', confidence: 0.80 }
      ]
    },
    'THAL': {
      fullName: 'Thalamus', label: 'Grid Distribution', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays nearly all sensory and motor signals between subcortical structures and cortex.', inBusiness: 'In energy, this is grid distribution — routing electricity from generators to consumers through substations and transformers.' },
      function: 'Routes and regulates power flow across voltage levels',
      dysregulation: 'Transmission congestion, voltage instability, line overload',
      expectedTypes: [
        { type: 'T&D utility', reason: 'Owns and operates grid infrastructure', confidence: 0.95 },
        { type: 'Grid automation and SCADA vendor', reason: 'Real-time monitoring and control of distribution', confidence: 0.90 },
        { type: 'Substation equipment manufacturer', reason: 'Transformers, switchgear, and protection equipment', confidence: 0.85 },
        { type: 'Power line contractor', reason: 'Transmission and distribution line construction and maintenance', confidence: 0.82 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Fossil Fuels', tier: 'top',
      neuroTranslation: { inNeurology: 'Central to habit formation and reward-based learning through dopaminergic feedback.', inBusiness: 'In energy, this is fossil fuels — deeply entrenched supply chains for oil, gas, and coal that form habitual energy production patterns.' },
      function: 'Produces and processes oil, natural gas, and coal',
      dysregulation: 'Supply disruption, price spike, stranded asset risk',
      expectedTypes: [
        { type: 'Integrated oil and gas company', reason: 'Upstream exploration through downstream refining', confidence: 0.95 },
        { type: 'Oilfield services provider', reason: 'Drilling, completion, and well services', confidence: 0.90 },
        { type: 'Natural gas processor', reason: 'Gas gathering, processing, and NGL fractionation', confidence: 0.85 },
        { type: 'Coal producer', reason: 'Thermal and metallurgical coal mining and logistics', confidence: 0.78 }
      ]
    },
    'VTA': {
      fullName: 'Ventral Tegmental Area', label: 'Solar & Wind', tier: 'top',
      neuroTranslation: { inNeurology: 'Origin of mesolimbic dopamine pathway — drives reward-seeking and novelty exploration.', inBusiness: 'In energy, this is renewable generation — solar and wind representing the novel, reward-driven frontier of energy production.' },
      function: 'Generates electricity from solar photovoltaics and wind turbines',
      dysregulation: 'Intermittency, curtailment, interconnection queue delay',
      expectedTypes: [
        { type: 'Solar developer', reason: 'Utility-scale and distributed solar project development', confidence: 0.95 },
        { type: 'Wind turbine manufacturer', reason: 'Onshore and offshore wind turbine supply', confidence: 0.90 },
        { type: 'Renewable EPC contractor', reason: 'Engineering, procurement, and construction for solar and wind', confidence: 0.85 },
        { type: 'Solar panel manufacturer', reason: 'Photovoltaic module production', confidence: 0.82 }
      ]
    },
    'PAG': {
      fullName: 'Periaqueductal Gray', label: 'Nuclear Power', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates defensive responses and pain modulation under threat.', inBusiness: 'In energy, this is nuclear power — high-stakes generation requiring extreme safety protocols and defensive operating postures.' },
      function: 'Generates baseload electricity from nuclear fission',
      dysregulation: 'Safety incident, regulatory shutdown, spent fuel storage crisis',
      expectedTypes: [
        { type: 'Nuclear plant operator', reason: 'Operates licensed nuclear generation facilities', confidence: 0.95 },
        { type: 'Nuclear fuel fabricator', reason: 'Uranium enrichment and fuel assembly manufacturing', confidence: 0.88 },
        { type: 'Nuclear decommissioning contractor', reason: 'Reactor dismantlement and site remediation', confidence: 0.82 },
        { type: 'Nuclear safety consultancy', reason: 'NRC compliance, PRA, and safety system assessment', confidence: 0.80 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Battery Storage', tier: 'top',
      neuroTranslation: { inNeurology: 'Forms and consolidates new memories into long-term storage.', inBusiness: 'In energy, this is battery storage — capturing and storing energy for later dispatch, the memory of the grid.' },
      function: 'Stores electrical energy in battery systems for grid balancing and dispatch',
      dysregulation: 'Storage degradation, capacity fade, thermal runaway',
      expectedTypes: [
        { type: 'Battery storage developer', reason: 'Utility-scale and front-of-meter battery projects', confidence: 0.95 },
        { type: 'Battery cell manufacturer', reason: 'Lithium-ion, solid-state, and flow battery cell production', confidence: 0.90 },
        { type: 'Energy storage integrator', reason: 'Battery management systems and grid interconnection', confidence: 0.85 },
        { type: 'Battery recycling service', reason: 'End-of-life battery materials recovery and processing', confidence: 0.78 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Hydroelectric Power', tier: 'top',
      neuroTranslation: { inNeurology: 'Primary relay for visceral sensory input — integrates cardiovascular and respiratory signals.', inBusiness: 'In energy, this is hydroelectric power — generation driven by the flow and pressure of water, a visceral natural force.' },
      function: 'Generates electricity from water flow through dams and run-of-river turbines',
      dysregulation: 'Drought reducing generation, dam safety concern, fish passage conflict',
      expectedTypes: [
        { type: 'Hydroelectric operator', reason: 'Operates dams and hydro generation facilities', confidence: 0.95 },
        { type: 'Hydro turbine manufacturer', reason: 'Francis, Kaplan, and Pelton turbine supply', confidence: 0.88 },
        { type: 'Dam safety engineering firm', reason: 'Dam inspection, stability analysis, and rehabilitation', confidence: 0.82 },
        { type: 'Pumped storage developer', reason: 'Pumped hydro energy storage project development', confidence: 0.80 }
      ]
    },
    'CC': {
      fullName: 'Corpus Callosum', label: 'Transmission Lines', tier: 'top',
      neuroTranslation: { inNeurology: 'Largest white matter tract connecting left and right hemispheres.', inBusiness: 'In energy, these are high-voltage transmission lines connecting generation regions to load centers across long distances.' },
      function: 'Carries bulk power across long distances from generation to load centers',
      dysregulation: 'Line overload, ice storm damage, right-of-way conflict, vegetation contact',
      expectedTypes: [
        { type: 'Transmission line owner/operator', reason: 'High-voltage interstate transmission infrastructure', confidence: 0.95 },
        { type: 'Transmission construction contractor', reason: 'Tower erection, conductor stringing, and substation building', confidence: 0.90 },
        { type: 'Vegetation management contractor', reason: 'Right-of-way clearing and maintenance for transmission corridors', confidence: 0.82 },
        { type: 'Conductor and cable manufacturer', reason: 'ACSR, ACCC, and underground cable production', confidence: 0.80 }
      ]
    },
    'FORN': {
      fullName: 'Fornix', label: 'Pipeline Networks', tier: 'top',
      neuroTranslation: { inNeurology: 'Major white matter bundle carrying output from hippocampus — dedicated fiber pathway.', inBusiness: 'In energy, these are pipeline networks — dedicated physical corridors transporting oil, gas, and refined products.' },
      function: 'Transports oil, natural gas, and refined products through fixed pipeline corridors',
      dysregulation: 'Pipeline rupture, corrosion failure, throughput constraint, regulatory blockage',
      expectedTypes: [
        { type: 'Pipeline operator', reason: 'Operates interstate oil and gas pipeline infrastructure', confidence: 0.95 },
        { type: 'Pipeline integrity service', reason: 'In-line inspection, corrosion monitoring, and repair', confidence: 0.88 },
        { type: 'Midstream MLP', reason: 'Gathering, processing, and pipeline transportation services', confidence: 0.85 },
        { type: 'Pipeline construction contractor', reason: 'New pipeline construction and expansion projects', confidence: 0.82 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum', label: 'Refining', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates voluntary movement with precise timing and calibration.', inBusiness: 'In energy, this is refining — the precise conversion of crude oil into usable petroleum products through carefully calibrated processes.' },
      function: 'Converts crude oil into gasoline, diesel, jet fuel, and petrochemicals',
      dysregulation: 'Refinery outage, crude slate mismatch, product yield deviation, turnaround delay',
      expectedTypes: [
        { type: 'Petroleum refiner', reason: 'Operates crude-to-product refining facilities', confidence: 0.95 },
        { type: 'Refinery process control vendor', reason: 'DCS, APC, and optimization systems for refining', confidence: 0.88 },
        { type: 'Catalyst manufacturer', reason: 'FCC, hydrotreating, and reforming catalysts', confidence: 0.82 },
        { type: 'Refinery turnaround contractor', reason: 'Planned maintenance, inspection, and equipment replacement', confidence: 0.80 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Energy Trading', tier: 'top',
      neuroTranslation: { inNeurology: 'Assigns value to choices and outcomes — integrates reward for decision-making.', inBusiness: 'In energy, this is energy trading — commodity markets, futures, and physical trading that assign price to energy flows.' },
      function: 'Trades physical and financial energy commodities on exchanges and OTC markets',
      dysregulation: 'Price manipulation, liquidity crisis, margin call cascade, market design failure',
      expectedTypes: [
        { type: 'Energy trading house', reason: 'Physical and financial commodity trading', confidence: 0.95 },
        { type: 'ETRM software vendor', reason: 'Energy trading and risk management platforms', confidence: 0.88 },
        { type: 'Exchange and clearing operator', reason: 'Commodity exchange and clearinghouse services', confidence: 0.82 },
        { type: 'Energy market analytics firm', reason: 'Price forecasting, fundamental analysis, and market intelligence', confidence: 0.80 }
      ]
    },
    'S1': {
      fullName: 'Primary Somatosensory Cortex', label: 'Mining & Extraction', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes tactile, pressure, and temperature signals from the body.', inBusiness: 'In energy, this is mining and extraction — the raw sensing and removal of energy resources from the earth.' },
      function: 'Extracts coal, uranium, lithium, and rare earths from geological deposits',
      dysregulation: 'Mine accident, resource depletion, permitting blockage, environmental violation',
      expectedTypes: [
        { type: 'Mining operator', reason: 'Surface and underground extraction of energy minerals', confidence: 0.92 },
        { type: 'Mining equipment manufacturer', reason: 'Draglines, continuous miners, and haul trucks', confidence: 0.85 },
        { type: 'Mine reclamation contractor', reason: 'Post-mining land restoration and environmental compliance', confidence: 0.78 },
        { type: 'Critical minerals processor', reason: 'Lithium, cobalt, and rare earth processing for energy supply chain', confidence: 0.82 }
      ]
    },
    'ENS': {
      fullName: 'Enteric Nervous System', label: 'Carbon & Emissions', tier: 'top',
      neuroTranslation: { inNeurology: 'Autonomous nervous system of the gut — manages digestion independently.', inBusiness: 'In energy, this is carbon and emissions management — the byproduct processing layer that handles greenhouse gases and pollutants from energy production.' },
      function: 'Monitors, captures, and manages carbon emissions and pollutants from energy production',
      dysregulation: 'Emissions exceedance, carbon price shock, capture system failure, compliance gap',
      expectedTypes: [
        { type: 'Carbon capture technology vendor', reason: 'Point-source and direct air capture systems', confidence: 0.90 },
        { type: 'Emissions monitoring service', reason: 'CEMS, methane detection, and emissions reporting', confidence: 0.88 },
        { type: 'Carbon credit market operator', reason: 'Voluntary and compliance carbon market trading platforms', confidence: 0.82 },
        { type: 'Environmental compliance consultancy', reason: 'EPA, state DEQ, and Clean Air Act compliance for energy', confidence: 0.80 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Grid Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and multi-goal coordination.', inBusiness: 'In energy, this is grid management — ISOs, RTOs, and control room operations that plan and coordinate the real-time operation of the power grid.' },
      function: 'Plans and coordinates real-time grid operations via ISOs, RTOs, and control centers',
      dysregulation: 'Dispatch error, load forecast miss, reserve margin shortfall',
      expectedTypes: [
        { type: 'ISO/RTO operator', reason: 'Independent system operator managing wholesale electricity markets', confidence: 0.95 },
        { type: 'Energy management system vendor', reason: 'EMS, state estimation, and optimal power flow software', confidence: 0.90 },
        { type: 'Load forecasting service', reason: 'Day-ahead and real-time demand forecasting', confidence: 0.82 },
        { type: 'Grid planning consultancy', reason: 'Integrated resource planning and transmission studies', confidence: 0.80 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Demand Response', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflicts and errors, signaling when corrective action is needed.', inBusiness: 'In energy, this is demand response — detecting grid stress and signaling consumers and generators to adjust behavior.' },
      function: 'Manages demand-side flexibility through curtailment, load shifting, and price signals',
      dysregulation: 'DR program failure, baseline gaming, slow response to grid stress',
      expectedTypes: [
        { type: 'Demand response aggregator', reason: 'Enrolls and dispatches DR resources for grid operators', confidence: 0.92 },
        { type: 'Smart thermostat vendor', reason: 'Connected devices enabling automated load reduction', confidence: 0.85 },
        { type: 'Virtual power plant operator', reason: 'Aggregates distributed resources for grid services', confidence: 0.82 },
        { type: 'Time-of-use rate design firm', reason: 'Rate structure design to incentivize demand flexibility', confidence: 0.75 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Energy Policy', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes subjective value and integrates emotional significance into decisions.', inBusiness: 'In energy, this is energy policy — the value-laden decisions about energy mix, subsidies, mandates, and transition strategies.' },
      function: 'Sets energy policy including RPS mandates, subsidies, emission targets, and transition planning',
      dysregulation: 'Policy reversal, unfunded mandate, regulatory uncertainty, stranded investment',
      expectedTypes: [
        { type: 'Energy policy consultancy', reason: 'Federal and state energy policy analysis and advocacy', confidence: 0.90 },
        { type: 'Regulatory affairs firm', reason: 'FERC, PUC, and state commission filings and proceedings', confidence: 0.88 },
        { type: 'Clean energy advocacy organization', reason: 'Policy development for renewable and decarbonization targets', confidence: 0.78 },
        { type: 'Energy transition advisory', reason: 'Corporate and governmental energy transition strategy', confidence: 0.82 }
      ]
    },
    'BNST': {
      fullName: 'Bed Nucleus of the Stria Terminalis', label: 'Energy Storage (Long Duration)', tier: 'top',
      neuroTranslation: { inNeurology: 'Mediates sustained anxiety and vigilance to uncertain threats.', inBusiness: 'In energy, this is long-duration storage — technologies addressing sustained grid uncertainty over hours to days.' },
      function: 'Provides multi-hour to multi-day energy storage for grid resilience',
      dysregulation: 'Insufficient long-duration reserves, technology immaturity, cost barrier',
      expectedTypes: [
        { type: 'Long-duration storage developer', reason: 'Iron-air, compressed air, and gravity storage projects', confidence: 0.88 },
        { type: 'Flow battery manufacturer', reason: 'Vanadium redox and zinc-bromine flow battery systems', confidence: 0.85 },
        { type: 'Thermal energy storage vendor', reason: 'Molten salt, ice, and sand-based thermal storage', confidence: 0.78 }
      ]
    },
    'CAUD': {
      fullName: 'Caudate', label: 'Hydrogen', tier: 'top',
      neuroTranslation: { inNeurology: 'Part of basal ganglia involved in goal-directed action selection and reward anticipation.', inBusiness: 'In energy, this is hydrogen — a goal-directed emerging fuel pursuing the reward of decarbonization across sectors.' },
      function: 'Produces, stores, and distributes hydrogen for power, transport, and industry',
      dysregulation: 'Electrolyzer shortage, hydrogen infrastructure gap, color-label confusion',
      expectedTypes: [
        { type: 'Green hydrogen producer', reason: 'Electrolysis-based hydrogen from renewable electricity', confidence: 0.90 },
        { type: 'Fuel cell manufacturer', reason: 'PEM and SOFC fuel cells for stationary and mobile applications', confidence: 0.88 },
        { type: 'Hydrogen storage and transport vendor', reason: 'Compressed, liquid, and pipeline hydrogen logistics', confidence: 0.82 },
        { type: 'Electrolyzer manufacturer', reason: 'PEM and alkaline electrolyzer systems', confidence: 0.85 }
      ]
    },
    'FEF': {
      fullName: 'Frontal Eye Fields', label: 'Off-Grid Energy', tier: 'top',
      neuroTranslation: { inNeurology: 'Controls voluntary eye movements directing visual attention.', inBusiness: 'In energy, this is off-grid and distributed energy — directed energy solutions for remote, off-grid, and microgrid applications.' },
      function: 'Provides energy systems for off-grid, remote, and microgrid applications',
      dysregulation: 'Microgrid islanding failure, off-grid system undersizing, backup fuel shortage',
      expectedTypes: [
        { type: 'Microgrid developer', reason: 'Designs and builds autonomous microgrid systems', confidence: 0.90 },
        { type: 'Portable generator manufacturer', reason: 'Diesel, gas, and solar portable generation units', confidence: 0.85 },
        { type: 'Remote power systems integrator', reason: 'Solar-battery-diesel hybrid systems for remote sites', confidence: 0.82 },
        { type: 'Backup power service', reason: 'UPS and standby generator installation and maintenance', confidence: 0.78 }
      ]
    },
    'EMP': {
      fullName: 'Empathy', label: 'Carbon Capture & Sequestration', tier: 'top',
      neuroTranslation: { inNeurology: 'Neural basis of understanding others\' states and experiences.', inBusiness: 'In energy, this is CCS — understanding and addressing the environmental impact of energy production through capture and sequestration.' },
      function: 'Captures CO2 from energy production and sequesters it in geological formations',
      dysregulation: 'Sequestration site leakage, capture efficiency shortfall, pipeline opposition',
      expectedTypes: [
        { type: 'CCS project developer', reason: 'End-to-end carbon capture and sequestration project delivery', confidence: 0.88 },
        { type: 'CO2 pipeline operator', reason: 'Transports captured CO2 to sequestration sites', confidence: 0.82 },
        { type: 'Geological sequestration service', reason: 'Saline aquifer and depleted reservoir CO2 injection', confidence: 0.80 }
      ]
    },

    'BROCA': {
      fullName: 'Broca\'s Area', label: 'Energy Control & Automation', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured speech output — translates thought into articulated language.', inBusiness: 'In energy, this is control and automation — SCADA commands, automated switching, and DCS outputs that translate grid intelligence into physical actions on equipment.' },
      function: 'Translates grid intelligence into automated switching, control commands, and DCS actions',
      dysregulation: 'Automation script failure, miscommanded switch, DCS output error',
      expectedTypes: [
        { type: 'Energy automation and DCS vendor', reason: 'Distributed control systems for power plants and substations', confidence: 0.92 },
        { type: 'Automated switching equipment manufacturer', reason: 'Reclosers, sectionalizers, and automated switches for distribution', confidence: 0.88 },
        { type: 'SCADA programming service', reason: 'RTU programming, point mapping, and SCADA system configuration', confidence: 0.82 }
      ]
    },
    'CING': {
      fullName: 'Cingulum', label: 'Energy Corridor Management', tier: 'top',
      neuroTranslation: { inNeurology: 'White matter bundle connecting frontal and temporal lobes — carries signals along a fixed pathway.', inBusiness: 'In energy, this is corridor management — transmission and pipeline corridors that carry energy along fixed physical pathways requiring ongoing maintenance and access control.' },
      function: 'Manages transmission and pipeline corridors including access, vegetation, and encroachment',
      dysregulation: 'Corridor encroachment, vegetation contact with lines, access road deterioration',
      expectedTypes: [
        { type: 'Transmission corridor management firm', reason: 'Right-of-way maintenance, vegetation management, and access control', confidence: 0.88 },
        { type: 'Pipeline right-of-way service', reason: 'ROW patrol, encroachment monitoring, and one-call coordination', confidence: 0.85 },
        { type: 'Aerial corridor survey vendor', reason: 'LiDAR and photogrammetric survey of energy corridors', confidence: 0.80 }
      ]
    },

    // ── OPERATIONAL NODES (83) ───────────────────────────────────────

    'A1': {
      fullName: 'Primary Auditory Cortex', label: 'Energy Acoustic Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes auditory signals from the environment.', inBusiness: 'In energy, this is acoustic monitoring — leak detection on pipelines, turbine health monitoring via sound, and transformer hum analysis.' },
      function: 'Detects energy equipment faults and leaks via acoustic and ultrasonic monitoring',
      dysregulation: 'Undetected gas leak, missed turbine bearing failure, transformer fault',
      expectedTypes: [
        { type: 'Acoustic leak detection vendor', reason: 'Ultrasonic and acoustic pipeline and valve leak detection', confidence: 0.88 },
        { type: 'Turbine vibration analysis service', reason: 'Rotating machinery condition monitoring via vibration and sound', confidence: 0.85 },
        { type: 'Transformer diagnostic firm', reason: 'Dissolved gas analysis, partial discharge, and acoustic fault detection', confidence: 0.80 }
      ]
    },
    'ADR': {
      fullName: 'Adrenal', label: 'Emergency Energy Response', tier: 'operational',
      neuroTranslation: { inNeurology: 'Releases adrenaline and cortisol for rapid mobilization under stress.', inBusiness: 'In energy, this is emergency response — storm restoration crews, emergency generator deployment, and grid black start procedures.' },
      function: 'Mobilizes emergency crews and equipment for energy system restoration',
      dysregulation: 'Slow storm response, black start failure, insufficient emergency generation',
      expectedTypes: [
        { type: 'Storm restoration contractor', reason: 'Emergency line crew deployment for power restoration', confidence: 0.92 },
        { type: 'Emergency generator rental', reason: 'Temporary generation for outage and disaster response', confidence: 0.88 },
        { type: 'Black start service provider', reason: 'Grid restoration capability from total blackout', confidence: 0.78 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Energy Knowledge & Standards', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrates multimodal sensory input into unified concepts.', inBusiness: 'In energy, this is the knowledge layer — IEEE, NERC, and API standards databases and technical reference systems.' },
      function: 'Maintains energy industry standards, technical references, and engineering knowledge bases',
      dysregulation: 'Outdated standards, conflicting codes, knowledge loss from retirements',
      expectedTypes: [
        { type: 'Energy standards organization', reason: 'IEEE, NERC, API, and NFPA standards development', confidence: 0.85 },
        { type: 'Energy technical training provider', reason: 'Continuing education for power engineers and operators', confidence: 0.80 },
        { type: 'Energy knowledge management platform', reason: 'Digital libraries for energy codes, specs, and procedures', confidence: 0.75 }
      ]
    },
    'AI': {
      fullName: 'Anterior Insula', label: 'Grid Condition Awareness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Generates conscious awareness of bodily states — interoception.', inBusiness: 'In energy, this is real-time grid condition awareness — SCADA dashboards, phasor measurement, and grid health visualization.' },
      function: 'Provides real-time awareness of grid conditions through SCADA and synchrophasors',
      dysregulation: 'SCADA blind spot, phasor data gap, delayed state estimation',
      expectedTypes: [
        { type: 'Synchrophasor system vendor', reason: 'PMU deployment, PDC integration, and wide-area monitoring', confidence: 0.88 },
        { type: 'Grid visualization platform', reason: 'Real-time grid topology, flow, and constraint display', confidence: 0.85 },
        { type: 'Distribution management system vendor', reason: 'ADMS for distribution grid monitoring and control', confidence: 0.82 }
      ]
    },
    'ANT': {
      fullName: 'Anterior Thalamus', label: 'Energy Dispatch & Scheduling', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays signals between hippocampus and cingulate cortex in the Papez circuit.', inBusiness: 'In energy, this is dispatch and scheduling — unit commitment, economic dispatch, and day-ahead scheduling that routes generation to load.' },
      function: 'Schedules and dispatches generation units to meet forecasted and real-time demand',
      dysregulation: 'Dispatch error, unit commitment failure, schedule-actual deviation',
      expectedTypes: [
        { type: 'Generation dispatch software vendor', reason: 'Unit commitment, security-constrained dispatch, and AGC', confidence: 0.90 },
        { type: 'Day-ahead market operator', reason: 'Runs day-ahead energy and ancillary service auctions', confidence: 0.85 },
        { type: 'Scheduling coordinator', reason: 'Coordinates generator schedules with ISO/RTO', confidence: 0.78 }
      ]
    },
    'ARC': {
      fullName: 'Arcuate Fasciculus', label: 'Energy Communication Networks', tier: 'operational',
      neuroTranslation: { inNeurology: 'White matter connecting Broca and Wernicke areas for language.', inBusiness: 'In energy, this is the communication backbone between control centers, substations, and field crews — SCADA comms, fiber, and radio.' },
      function: 'Connects energy control centers to substations and field assets via dedicated communications',
      dysregulation: 'Communication link failure between control center and substation, radio dead zone',
      expectedTypes: [
        { type: 'Utility communications network builder', reason: 'Fiber, microwave, and radio networks for energy SCADA', confidence: 0.88 },
        { type: 'Utility-grade cybersecurity vendor', reason: 'NERC CIP compliance, OT security, and intrusion detection', confidence: 0.85 },
        { type: 'Field communication equipment vendor', reason: 'Ruggedized radios and mobile data terminals for energy crews', confidence: 0.78 }
      ]
    },
    'BDNF': {
      fullName: 'BDNF / Plasticity', label: 'Energy System Modernization', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports neuronal growth, synaptic plasticity, and adaptive rewiring.', inBusiness: 'In energy, this is grid modernization — upgrading aging infrastructure, adopting smart grid technologies, and adapting to new generation sources.' },
      function: 'Drives energy system modernization, grid hardening, and smart grid deployment',
      dysregulation: 'Grid technology debt, inability to integrate DERs, aging infrastructure failure',
      expectedTypes: [
        { type: 'Grid modernization consultancy', reason: 'Smart grid roadmapping, AMI deployment, and DER integration strategy', confidence: 0.90 },
        { type: 'Advanced metering infrastructure vendor', reason: 'Smart meters, head-end systems, and meter data management', confidence: 0.85 },
        { type: 'Grid-edge intelligence platform', reason: 'DER management, volt-var optimization, and grid-edge analytics', confidence: 0.82 }
      ]
    },
    'BLA': {
      fullName: 'Basolateral Amygdala', label: 'Energy Risk Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Evaluates threat significance and assigns emotional valence.', inBusiness: 'In energy, this is risk assessment — evaluating threats from weather, cyber attacks, supply disruption, and price volatility.' },
      function: 'Assesses risk from weather, cyber, supply, regulatory, and price threats to energy systems',
      dysregulation: 'Underestimated risk, ignored vulnerability, failure to act on known threats',
      expectedTypes: [
        { type: 'Energy risk consultancy', reason: 'Supply, price, weather, and regulatory risk quantification', confidence: 0.90 },
        { type: 'Energy cyber threat assessment vendor', reason: 'ICS/OT vulnerability assessment and penetration testing', confidence: 0.85 },
        { type: 'Weather risk analytics firm', reason: 'Energy-specific weather forecasting and storm impact modeling', confidence: 0.82 }
      ]
    },
    'CARD': {
      fullName: 'Cardiac', label: 'Power Plant Critical Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Autonomic cardiac regulation — heart rate and blood pressure control.', inBusiness: 'In energy, this is the critical mechanical heart of power plants — turbines, boilers, cooling systems, and balance-of-plant that must operate continuously.' },
      function: 'Maintains turbines, boilers, condensers, and cooling systems in power plants',
      dysregulation: 'Turbine trip, boiler tube leak, condenser fouling, cooling tower failure',
      expectedTypes: [
        { type: 'Power plant equipment OEM', reason: 'Turbines, generators, boilers, and heat recovery systems', confidence: 0.92 },
        { type: 'Plant maintenance contractor', reason: 'Rotating equipment overhaul, boiler repair, and outage support', confidence: 0.88 },
        { type: 'Cooling system vendor', reason: 'Cooling towers, condensers, and closed-loop cooling systems', confidence: 0.80 }
      ]
    },
    'CLAUST': {
      fullName: 'Claustrum', label: 'Energy System Integration', tier: 'operational',
      neuroTranslation: { inNeurology: 'Hypothesized to integrate information across cortical areas into unified experience.', inBusiness: 'In energy, this is system integration — coordinating generation, transmission, distribution, and demand into a unified operating whole.' },
      function: 'Integrates generation, T&D, demand, and storage into coordinated energy systems',
      dysregulation: 'Integration failure between renewables and grid, DER-grid conflict, data silos',
      expectedTypes: [
        { type: 'Energy system integrator', reason: 'End-to-end integration of generation, grid, and demand systems', confidence: 0.88 },
        { type: 'DERMS platform vendor', reason: 'Distributed energy resource management and orchestration', confidence: 0.85 },
        { type: 'Interoperability standards consultancy', reason: 'IEEE 2030, OpenADR, and CIM model implementation', confidence: 0.78 }
      ]
    },
    'CMZ': {
      fullName: 'Cerebellar Motor Zone', label: 'Energy Construction Equipment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fine-tunes motor output for precision execution.', inBusiness: 'In energy, this is specialized construction equipment — line trucks, cranes, pipe layers, and specialized rigs for energy infrastructure building.' },
      function: 'Provides specialized equipment for power line, pipeline, and plant construction',
      dysregulation: 'Equipment breakdown on critical path, specialized rig shortage',
      expectedTypes: [
        { type: 'Utility line truck and equipment vendor', reason: 'Bucket trucks, digger derricks, and cable pullers', confidence: 0.90 },
        { type: 'Heavy lift crane service', reason: 'Turbine and transformer placement requiring specialized cranes', confidence: 0.85 },
        { type: 'Pipe laying equipment vendor', reason: 'Side booms, bending machines, and pipeline construction rigs', confidence: 0.80 }
      ]
    },
    'CON': {
      fullName: 'Cingulo-Opercular Network', label: 'Energy Maintenance Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustains attention and task-set maintenance during prolonged operations.', inBusiness: 'In energy, this is sustained maintenance — preventive and predictive maintenance programs that keep energy assets functional over decades.' },
      function: 'Executes preventive, predictive, and corrective maintenance on energy infrastructure',
      dysregulation: 'Deferred maintenance spiral, unexpected failure, inspection backlog',
      expectedTypes: [
        { type: 'Energy asset maintenance contractor', reason: 'Substation, line, and plant routine and preventive maintenance', confidence: 0.92 },
        { type: 'Predictive maintenance platform', reason: 'Condition-based monitoring and ML-driven failure prediction', confidence: 0.88 },
        { type: 'Reliability engineering consultancy', reason: 'RCM, FMEA, and reliability program development for energy', confidence: 0.82 }
      ]
    },
    'CeA': {
      fullName: 'Central Amygdala', label: 'Energy Emergency Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Outputs fear and threat responses — triggers defensive behaviors.', inBusiness: 'In energy, this is emergency management — emergency operations centers, mutual aid activation, and emergency action plans for energy facilities.' },
      function: 'Activates emergency operations centers and emergency action plans for energy events',
      dysregulation: 'EOC activation failure, uncoordinated emergency response, EAP gaps',
      expectedTypes: [
        { type: 'Energy emergency management consultancy', reason: 'EAP development, emergency exercise design, and ICS training', confidence: 0.88 },
        { type: 'Utility mutual aid coordinator', reason: 'Interstate utility crew sharing for storm restoration', confidence: 0.85 },
        { type: 'Emergency notification system vendor', reason: 'Mass notification for pipeline, dam, and grid emergencies', confidence: 0.80 }
      ]
    },
    'DAN': {
      fullName: 'Dorsal Attention Network', label: 'Energy Asset Inspection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Top-down voluntary attention directed toward selected stimuli.', inBusiness: 'In energy, this is directed asset inspection — targeted drone inspection of lines, thermal imaging of panels, and infrared scanning of substations.' },
      function: 'Conducts targeted inspection of energy assets via drones, IR, and thermal imaging',
      dysregulation: 'Missed hotspots, inspection backlog, drone grounding',
      expectedTypes: [
        { type: 'Energy drone inspection service', reason: 'Transmission line, solar panel, and wind turbine UAS inspection', confidence: 0.92 },
        { type: 'Infrared thermography service', reason: 'Thermal imaging for substations, connections, and switchgear', confidence: 0.88 },
        { type: 'Transmission line inspection firm', reason: 'Helicopter and climbing inspection of high-voltage lines', confidence: 0.85 }
      ]
    },
    'DISS': {
      fullName: 'Dissolution', label: 'Energy Asset Retirement', tier: 'operational',
      neuroTranslation: { inNeurology: 'Dissolution of coherent network states.', inBusiness: 'In energy, this is asset retirement — decommissioning power plants, abandoning wells, and retiring pipelines.' },
      function: 'Decommissions power plants, abandons wells, and retires end-of-life energy infrastructure',
      dysregulation: 'Abandoned well leakage, incomplete plant decommissioning, orphan asset liability',
      expectedTypes: [
        { type: 'Power plant decommissioning contractor', reason: 'Coal, nuclear, and gas plant demolition and site remediation', confidence: 0.90 },
        { type: 'Well plugging and abandonment service', reason: 'Permanently plugs orphaned and end-of-life oil and gas wells', confidence: 0.88 },
        { type: 'Pipeline decommissioning firm', reason: 'Pipeline purging, cutting, and removal or abandonment-in-place', confidence: 0.82 }
      ]
    },
    'DMN': {
      fullName: 'Default Mode Network', label: 'Energy Long-Range Planning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Active during rest and self-referential thought — mental simulation and future planning.', inBusiness: 'In energy, this is long-range planning — integrated resource plans, 20-year capacity expansion studies, and energy transition roadmaps.' },
      function: 'Develops integrated resource plans, capacity expansion studies, and transition roadmaps',
      dysregulation: 'No long-range plan, reactive-only investment, planning-reality disconnect',
      expectedTypes: [
        { type: 'Integrated resource planning consultancy', reason: 'IRP modeling, scenario analysis, and least-cost planning', confidence: 0.92 },
        { type: 'Energy transition strategy firm', reason: 'Decarbonization pathways, stranded asset analysis, and net-zero planning', confidence: 0.88 },
        { type: 'Capacity expansion modeling vendor', reason: 'Production cost models, reliability analysis, and resource adequacy', confidence: 0.85 }
      ]
    },
    'DV': {
      fullName: 'Dorsal Vagal', label: 'Energy System Shutdown & Lockout', tier: 'operational',
      neuroTranslation: { inNeurology: 'Triggers freeze/shutdown under extreme threat.', inBusiness: 'In energy, this is controlled shutdown — LOTO procedures, turbine trips, and emergency de-energization of energy equipment.' },
      function: 'Executes controlled shutdowns, lockout/tagout, and emergency de-energization',
      dysregulation: 'Failed LOTO, accidental energization, incomplete isolation',
      expectedTypes: [
        { type: 'Energy safety and LOTO system vendor', reason: 'Lockout devices, procedures, and compliance programs for energy', confidence: 0.85 },
        { type: 'Protective relay engineer', reason: 'Relay coordination, trip settings, and protection scheme design', confidence: 0.88 },
        { type: 'Energy safety consultancy', reason: 'Arc flash analysis, NFPA 70E compliance, and safety program development', confidence: 0.82 }
      ]
    },
    'EC': {
      fullName: 'Entorhinal Cortex', label: 'Energy Geospatial Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Gateway to hippocampus with grid cells for spatial navigation.', inBusiness: 'In energy, this is geospatial systems — GIS mapping of transmission lines, pipeline routes, well locations, and service territories.' },
      function: 'Maintains geospatial databases for energy asset locations, routes, and service territories',
      dysregulation: 'Inaccurate asset locations, GIS data gaps, spatial planning errors',
      expectedTypes: [
        { type: 'Utility GIS services firm', reason: 'Transmission, distribution, and pipeline GIS mapping', confidence: 0.90 },
        { type: 'Energy geospatial analytics platform', reason: 'Siting analysis, route optimization, and land rights tracking', confidence: 0.85 },
        { type: 'Digital twin platform for energy', reason: 'Spatially accurate 3D models of power plants and substations', confidence: 0.80 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Energy Project Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Manages top-down cognitive control and executive decision-making.', inBusiness: 'In energy, this is project management — PMOs overseeing power plant construction, transmission projects, and renewable installations.' },
      function: 'Manages project delivery for power plants, transmission lines, and renewable installations',
      dysregulation: 'Schedule overrun, cost escalation, project delivery failure',
      expectedTypes: [
        { type: 'Energy program management firm', reason: 'Owner-side oversight of large energy capital programs', confidence: 0.92 },
        { type: 'Energy project controls consultancy', reason: 'Earned value, scheduling, and cost control for energy projects', confidence: 0.85 },
        { type: 'Energy EPC contractor', reason: 'Full engineering, procurement, and construction delivery', confidence: 0.90 }
      ]
    },
    'EI': {
      fullName: 'Excitatory/Inhibitory Ratio', label: 'Grid Frequency & Voltage Regulation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Balance between excitatory and inhibitory signaling maintaining network stability.', inBusiness: 'In energy, this is frequency and voltage regulation — the real-time balance between generation and load that keeps the grid stable at 60Hz.' },
      function: 'Maintains grid frequency at 60Hz and voltage within bounds through real-time balancing',
      dysregulation: 'Frequency deviation, voltage sag or swell, oscillation event',
      expectedTypes: [
        { type: 'Ancillary services provider', reason: 'Frequency regulation, spinning reserve, and reactive power', confidence: 0.90 },
        { type: 'Power quality equipment vendor', reason: 'STATCOMs, SVCs, and capacitor banks for voltage support', confidence: 0.85 },
        { type: 'Grid stability analytics platform', reason: 'Oscillation detection, inertia monitoring, and stability assessment', confidence: 0.80 }
      ]
    },
    'ENDO': {
      fullName: 'Endocannabinoid', label: 'Energy Transient Dampening', tier: 'operational',
      neuroTranslation: { inNeurology: 'Modulates synaptic transmission to dampen excessive activity.', inBusiness: 'In energy, this is transient dampening — surge arresters, harmonic filters, and systems that absorb transient overloads on the grid.' },
      function: 'Protects energy equipment from surges, harmonics, and transient overloads',
      dysregulation: 'Surge damage, harmonic distortion, equipment failure from transients',
      expectedTypes: [
        { type: 'Surge protection equipment vendor', reason: 'Lightning arresters, TVS devices, and SPDs for substations', confidence: 0.88 },
        { type: 'Power quality and harmonics firm', reason: 'Harmonic filter design, power factor correction, and THD mitigation', confidence: 0.85 },
        { type: 'Transient analysis consultancy', reason: 'Switching transient studies, insulation coordination, and TRV analysis', confidence: 0.78 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Energy Pattern Recognition & AI', tier: 'operational',
      neuroTranslation: { inNeurology: 'Specialized for visual pattern recognition.', inBusiness: 'In energy, this is AI and pattern recognition — machine learning for load forecasting, equipment anomaly detection, and generation prediction.' },
      function: 'Applies AI and machine learning to energy forecasting, anomaly detection, and optimization',
      dysregulation: 'Model drift, false positive alerts, forecast error',
      expectedTypes: [
        { type: 'Energy AI analytics vendor', reason: 'ML models for load forecasting, outage prediction, and asset health', confidence: 0.90 },
        { type: 'Renewable generation forecasting service', reason: 'Solar irradiance and wind speed prediction for grid operators', confidence: 0.88 },
        { type: 'Anomaly detection platform for energy', reason: 'Real-time equipment anomaly detection from sensor data', confidence: 0.82 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Energy Cybersecurity', tier: 'operational',
      neuroTranslation: { inNeurology: 'Executive control managing task-switching and adaptive control.', inBusiness: 'In energy, this is cybersecurity — protecting SCADA, ICS, and IT systems from cyber threats that could disrupt energy operations.' },
      function: 'Protects energy operational technology and IT systems from cyber threats',
      dysregulation: 'SCADA breach, ransomware attack on grid, ICS vulnerability exploitation',
      expectedTypes: [
        { type: 'Energy OT cybersecurity vendor', reason: 'ICS security monitoring, NERC CIP compliance, and OT-specific tools', confidence: 0.92 },
        { type: 'Energy penetration testing firm', reason: 'Red team exercises on SCADA, DCS, and grid control systems', confidence: 0.85 },
        { type: 'NERC CIP compliance consultancy', reason: 'CIP standard implementation, audit preparation, and gap analysis', confidence: 0.88 }
      ]
    },
    'GABA_GLU': {
      fullName: 'GABA/Glutamate Balance', label: 'Energy Protection Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fundamental excitatory/inhibitory balance controlling neural stability.', inBusiness: 'In energy, these are protection systems — relays, circuit breakers, and fuses that prevent faults from cascading through the grid.' },
      function: 'Prevents fault propagation through protective relaying, breakers, and fuses',
      dysregulation: 'Relay misoperation, breaker failure, protection scheme gap',
      expectedTypes: [
        { type: 'Protective relay manufacturer', reason: 'Overcurrent, differential, and distance relays for grid protection', confidence: 0.92 },
        { type: 'Circuit breaker manufacturer', reason: 'SF6, vacuum, and oil circuit breakers for substations', confidence: 0.88 },
        { type: 'Protection engineering consultancy', reason: 'Relay coordination studies, settings, and protection scheme design', confidence: 0.85 }
      ]
    },
    'GBA': {
      fullName: 'Gut-Brain Axis', label: 'Underground Energy Infrastructure', tier: 'operational',
      neuroTranslation: { inNeurology: 'Bidirectional communication between gut and brain.', inBusiness: 'In energy, this is underground infrastructure — buried cables, underground gas distribution, and subsurface storage that operates invisibly.' },
      function: 'Manages underground cables, gas distribution mains, and subsurface energy storage',
      dysregulation: 'Dig-in damage to buried cable, unlocated gas main, underground storage leak',
      expectedTypes: [
        { type: 'Underground cable installation contractor', reason: 'Direct burial, duct bank, and HDD for power cables', confidence: 0.90 },
        { type: 'Gas distribution utility', reason: 'Operates underground natural gas distribution network', confidence: 0.88 },
        { type: 'Underground storage operator', reason: 'Salt cavern, depleted reservoir, and aquifer gas storage', confidence: 0.82 }
      ]
    },
    'GP': {
      fullName: 'Globus Pallidus', label: 'Energy Permitting & Siting', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates voluntary movement by selecting which programs to release or inhibit.', inBusiness: 'In energy, this is permitting and siting — regulatory gates that release or block energy projects based on environmental and land use review.' },
      function: 'Gates energy projects through environmental permits, siting reviews, and land rights',
      dysregulation: 'Permit delay, environmental challenge, siting opposition, interconnection queue',
      expectedTypes: [
        { type: 'Energy permitting consultancy', reason: 'NEPA, ESA, wetlands, and state energy facility siting', confidence: 0.90 },
        { type: 'Land and right-of-way acquisition firm', reason: 'Easement negotiation, eminent domain, and landowner relations', confidence: 0.85 },
        { type: 'Interconnection study consultancy', reason: 'Generator interconnection, system impact, and facilities studies', confidence: 0.82 }
      ]
    },
    'HAB': {
      fullName: 'Habenula', label: 'Energy Failure Analysis', tier: 'operational',
      neuroTranslation: { inNeurology: 'Encodes negative outcomes — suppresses unrewarding actions.', inBusiness: 'In energy, this is failure analysis — root cause investigations, cascading failure analysis, and lessons learned from energy incidents.' },
      function: 'Investigates energy equipment failures, cascading events, and near-misses',
      dysregulation: 'Repeated equipment failures, ignored root causes, no institutional learning',
      expectedTypes: [
        { type: 'Energy forensic engineering firm', reason: 'Equipment failure investigation, metallurgical analysis, and expert testimony', confidence: 0.90 },
        { type: 'Cascading failure analysis consultancy', reason: 'Power system cascading event analysis and mitigation', confidence: 0.85 },
        { type: 'Energy incident investigation service', reason: 'NERC event analysis, after-action reports, and compliance', confidence: 0.80 }
      ]
    },
    'HPA': {
      fullName: 'HPA Axis', label: 'Energy Crisis Governance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustained stress response system.', inBusiness: 'In energy, this is crisis governance — the sustained command structure during extended energy emergencies like prolonged outages or fuel crises.' },
      function: 'Governs sustained response during prolonged energy emergencies and fuel crises',
      dysregulation: 'Uncoordinated extended outage response, governance breakdown during crisis',
      expectedTypes: [
        { type: 'Energy emergency management consultancy', reason: 'Emergency plans, crisis governance, and restoration management', confidence: 0.88 },
        { type: 'Fuel supply emergency coordinator', reason: 'Strategic reserve release, fuel allocation, and supply chain triage', confidence: 0.82 },
        { type: 'Energy continuity of operations planner', reason: 'COOP planning for utilities and energy agencies', confidence: 0.78 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Energy Market Regulation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates homeostasis — temperature, hunger, thirst, and hormones.', inBusiness: 'In energy, this is market regulation — PUCs, FERC, and state commissions that regulate rates, reliability, and market structure to maintain energy homeostasis.' },
      function: 'Regulates energy rates, reliability standards, and market structures',
      dysregulation: 'Rate shock, regulatory capture, market design failure',
      expectedTypes: [
        { type: 'Energy regulatory consultancy', reason: 'Rate case preparation, tariff design, and regulatory strategy', confidence: 0.92 },
        { type: 'Market design consultancy', reason: 'Wholesale market structure, capacity market design, and settlement', confidence: 0.85 },
        { type: 'Regulatory compliance platform', reason: 'FERC/PUC filing management, compliance tracking, and reporting', confidence: 0.78 }
      ]
    },
    'IC': {
      fullName: 'Inferior Colliculus', label: 'Energy Telemetry & SCADA', tier: 'operational',
      neuroTranslation: { inNeurology: 'Subcortical auditory processing relay.', inBusiness: 'In energy, this is telemetry and SCADA — the data relay layer streaming operational data from field devices to control centers.' },
      function: 'Relays real-time operational data from energy field devices to control centers',
      dysregulation: 'Telemetry gap, SCADA latency, RTU communication failure',
      expectedTypes: [
        { type: 'SCADA system vendor', reason: 'RTU, PLC, and master station systems for energy operations', confidence: 0.92 },
        { type: 'Utility telemetry integrator', reason: 'Radio, cellular, and satellite telemetry for remote energy sites', confidence: 0.85 },
        { type: 'Metering and instrumentation vendor', reason: 'CTs, PTs, and precision meters for energy measurement', confidence: 0.82 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Energy Cost Estimation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes numerical magnitude and spatial quantities.', inBusiness: 'In energy, this is cost estimation — quantifying project costs, rate impacts, and investment requirements for energy infrastructure.' },
      function: 'Estimates costs for energy projects, rate cases, and capital investment programs',
      dysregulation: 'Cost overruns, inaccurate rate impact estimates, bid blowouts',
      expectedTypes: [
        { type: 'Energy cost estimation firm', reason: 'Power plant, transmission, and renewable project cost estimating', confidence: 0.88 },
        { type: 'Rate case preparation consultancy', reason: 'Revenue requirement, cost-of-service, and rate design analysis', confidence: 0.85 },
        { type: 'Energy procurement advisory', reason: 'RFP development, bid evaluation, and PPA negotiation', confidence: 0.82 }
      ]
    },
    'LANG': {
      fullName: 'Language Network', label: 'Energy Data Communications', tier: 'operational',
      neuroTranslation: { inNeurology: 'Distributed network supporting language comprehension and production.', inBusiness: 'In energy, this is data communications — the protocols and networks (DNP3, IEC 61850, Modbus) that energy devices use to exchange operational data.' },
      function: 'Provides standardized data communication protocols for energy device interoperability',
      dysregulation: 'Protocol incompatibility, data exchange failure, legacy system integration gap',
      expectedTypes: [
        { type: 'Energy protocol gateway vendor', reason: 'DNP3, IEC 61850, and Modbus protocol conversion and integration', confidence: 0.88 },
        { type: 'Substation automation integrator', reason: 'IEC 61850-based protection, control, and monitoring systems', confidence: 0.85 },
        { type: 'Energy data platform vendor', reason: 'Data historians, data lakes, and analytics for operational energy data', confidence: 0.80 }
      ]
    },
    'LAR': {
      fullName: 'Laryngeal', label: 'Energy Public Communications', tier: 'operational',
      neuroTranslation: { inNeurology: 'Controls laryngeal muscles for voice production.', inBusiness: 'In energy, this is public communications — outage notifications, rate change alerts, and energy conservation messaging.' },
      function: 'Issues outage notifications, rate alerts, and energy conservation communications',
      dysregulation: 'No outage notification, surprised ratepayers, poor conservation messaging',
      expectedTypes: [
        { type: 'Utility customer communications platform', reason: 'Outage maps, outage alerts, and customer notification systems', confidence: 0.88 },
        { type: 'Energy conservation marketing firm', reason: 'DSM program marketing and energy efficiency awareness campaigns', confidence: 0.80 },
        { type: 'Utility customer experience vendor', reason: 'Billing portals, usage dashboards, and customer engagement tools', confidence: 0.78 }
      ]
    },
    'LC': {
      fullName: 'Locus Coeruleus', label: 'Energy Alarm Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary norepinephrine source modulating arousal and vigilance.', inBusiness: 'In energy, this is the alarm layer — SCADA alarms, generator trip alerts, and grid disturbance notifications.' },
      function: 'Triggers energy system alarms for generator trips, line faults, and grid disturbances',
      dysregulation: 'Alarm fatigue, missed critical alerts, alarm flood during events',
      expectedTypes: [
        { type: 'Alarm management consultancy', reason: 'ISA 18.2 alarm rationalization for energy control centers', confidence: 0.85 },
        { type: 'Control room human factors firm', reason: 'Operator display design, alarm prioritization, and fatigue management', confidence: 0.82 },
        { type: 'Event and disturbance recording vendor', reason: 'Digital fault recorders, sequence of events, and oscillography', confidence: 0.80 }
      ]
    },
    'LGN': {
      fullName: 'Lateral Geniculate Nucleus', label: 'Energy Visual Inspection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary relay for visual information to visual cortex.', inBusiness: 'In energy, this is visual inspection — the first-pass assessment of energy equipment condition by field inspectors and cameras.' },
      function: 'Provides visual inspection of lines, substations, plants, and renewable assets',
      dysregulation: 'Missed visual defects, inadequate inspection frequency',
      expectedTypes: [
        { type: 'Utility line inspection firm', reason: 'Ground patrol, climbing, and helicopter inspection of power lines', confidence: 0.90 },
        { type: 'Substation inspection service', reason: 'Visual, thermal, and ultrasonic inspection of substation equipment', confidence: 0.85 },
        { type: 'Solar panel inspection vendor', reason: 'Electroluminescence, IR, and visual inspection of PV arrays', confidence: 0.80 }
      ]
    },
    'MAMM': {
      fullName: 'Mammillary Bodies', label: 'Energy Historical Records', tier: 'operational',
      neuroTranslation: { inNeurology: 'Part of Papez memory circuit — relays hippocampal memory output.', inBusiness: 'In energy, this is historical records — as-built drawings, load histories, outage records, and archival data informing current operations.' },
      function: 'Preserves as-built drawings, outage history, load data, and archival energy records',
      dysregulation: 'Lost as-builts, incomplete outage records, missing load history',
      expectedTypes: [
        { type: 'Utility document management vendor', reason: 'Engineering drawing management, version control, and retrieval', confidence: 0.82 },
        { type: 'Outage data analytics platform', reason: 'Historical outage analysis, SAIDI/SAIFI trending, and benchmarking', confidence: 0.80 },
        { type: 'Energy asset records service', reason: 'Digitization and indexing of legacy utility records', confidence: 0.75 }
      ]
    },
    'MDT': {
      fullName: 'Mediodorsal Thalamus', label: 'Energy Decision Support', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays information to prefrontal cortex for higher-order decisions.', inBusiness: 'In energy, this is decision support — production cost models, portfolio optimization, and analytics that inform investment and dispatch decisions.' },
      function: 'Provides modeling and analytics for energy investment and operational decisions',
      dysregulation: 'Model mismatch, decisions without data, analysis paralysis',
      expectedTypes: [
        { type: 'Energy modeling and simulation vendor', reason: 'Production cost, capacity expansion, and stochastic models', confidence: 0.90 },
        { type: 'Energy portfolio optimization firm', reason: 'Generation portfolio, fuel hedging, and risk-adjusted planning', confidence: 0.85 },
        { type: 'Energy data analytics platform', reason: 'Dashboards, visualizations, and BI for energy decision-makers', confidence: 0.80 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Energy Metering & Telemetry', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays auditory information to auditory cortex.', inBusiness: 'In energy, this is metering and telemetry — the precise measurement and relay of energy flows at generation, transmission, and distribution points.' },
      function: 'Measures and relays energy flow data at custody transfer and monitoring points',
      dysregulation: 'Meter inaccuracy, telemetry latency, revenue meter failure',
      expectedTypes: [
        { type: 'Revenue metering system vendor', reason: 'Custody transfer meters, CT/PT combinations, and meter data management', confidence: 0.90 },
        { type: 'Smart meter deployment contractor', reason: 'AMI rollout, meter installation, and communication network buildout', confidence: 0.85 },
        { type: 'Meter testing and calibration service', reason: 'Revenue meter accuracy testing and certification', confidence: 0.78 }
      ]
    },
    'MICRO': {
      fullName: 'Microbiome', label: 'Energy Site Conditions', tier: 'operational',
      neuroTranslation: { inNeurology: 'Gut microbiome affecting neural function through metabolic pathways.', inBusiness: 'In energy, this is site conditions — soil, geology, and environmental factors that determine where and how energy infrastructure can be built.' },
      function: 'Characterizes soil, seismic, and environmental conditions for energy facility siting',
      dysregulation: 'Unexpected soil conditions, seismic risk underestimation, environmental contamination',
      expectedTypes: [
        { type: 'Geotechnical engineering firm', reason: 'Foundation design for wind turbines, substations, and plants', confidence: 0.90 },
        { type: 'Environmental site assessment firm', reason: 'Phase I/II ESA for energy facility development', confidence: 0.85 },
        { type: 'Geophysical survey service', reason: 'Seismic, resistivity, and GPR surveys for energy siting', confidence: 0.78 }
      ]
    },
    'NAcc': {
      fullName: 'Nucleus Accumbens', label: 'Energy Incentive Programs', tier: 'operational',
      neuroTranslation: { inNeurology: 'Core of reward circuit driving motivated behavior.', inBusiness: 'In energy, these are incentive programs — ITC, PTC, rebates, and feed-in tariffs that motivate energy investment and adoption.' },
      function: 'Administers tax credits, rebates, and incentive programs that drive energy investment',
      dysregulation: 'Incentive expiration disruption, program fraud, misaligned subsidies',
      expectedTypes: [
        { type: 'Energy incentive advisory firm', reason: 'ITC, PTC, 45X, 45V, and state incentive optimization', confidence: 0.90 },
        { type: 'Utility rebate program administrator', reason: 'DSM, EE, and DR rebate program design and implementation', confidence: 0.85 },
        { type: 'Tax equity investor', reason: 'Tax equity financing structures for renewable energy projects', confidence: 0.82 }
      ]
    },
    'NBM': {
      fullName: 'Nucleus Basalis of Meynert', label: 'Energy Workforce Development', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary source of cortical acetylcholine supporting attention and learning.', inBusiness: 'In energy, this is workforce development — lineworker apprenticeships, plant operator training, and energy workforce pipelines.' },
      function: 'Develops skilled energy workforce through apprenticeships, training, and certification',
      dysregulation: 'Lineworker shortage, aging workforce, insufficient training pipeline',
      expectedTypes: [
        { type: 'Lineworker apprenticeship program', reason: 'Electrical line worker training and IBEW-partnered programs', confidence: 0.88 },
        { type: 'Power plant operator training vendor', reason: 'Simulator-based training for control room operators', confidence: 0.85 },
        { type: 'Energy workforce platform', reason: 'Skills tracking, credentialing, and job matching for energy trades', confidence: 0.78 }
      ]
    },
    'NEOCER': {
      fullName: 'Neocerebellum', label: 'Energy Quality Assurance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Cognitive functions, planning, and error correction beyond motor coordination.', inBusiness: 'In energy, this is quality assurance — QA/QC for power plant construction, materials testing, and equipment acceptance testing.' },
      function: 'Executes quality assurance and control for energy construction and equipment acceptance',
      dysregulation: 'Defective equipment installed, failed acceptance test, construction quality shortcut',
      expectedTypes: [
        { type: 'Energy QA/QC firm', reason: 'Independent quality observation for power plant and line construction', confidence: 0.88 },
        { type: 'Materials testing laboratory', reason: 'Concrete, steel, conductor, and insulation testing for energy', confidence: 0.85 },
        { type: 'Equipment acceptance testing service', reason: 'Factory and site acceptance testing for generators, transformers, and switchgear', confidence: 0.82 }
      ]
    },
    'OLF': {
      fullName: 'Olfactory', label: 'Energy Environmental Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes airborne chemical signals.', inBusiness: 'In energy, this is environmental monitoring — emissions testing, flare monitoring, and air quality compliance at energy facilities.' },
      function: 'Monitors emissions, air quality, and environmental compliance at energy production sites',
      dysregulation: 'Emissions exceedance, undetected methane leak, air quality violation',
      expectedTypes: [
        { type: 'Energy emissions monitoring vendor', reason: 'CEMS, flare monitoring, and fugitive emissions detection', confidence: 0.90 },
        { type: 'Methane detection technology firm', reason: 'OGI, satellite, and aerial methane sensing for oil and gas', confidence: 0.88 },
        { type: 'Energy environmental compliance consultancy', reason: 'Title V, NSPS, and GHG reporting for energy facilities', confidence: 0.82 }
      ]
    },
    'OPIOID': {
      fullName: 'Opioid System', label: 'Energy Bottleneck Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Endogenous pain modulation system.', inBusiness: 'In energy, this is bottleneck resolution — targeted fixes for the most acute operational constraints like transmission congestion or fuel supply interruption.' },
      function: 'Resolves acute operational bottlenecks in generation, transmission, and fuel supply',
      dysregulation: 'Chronic transmission congestion, persistent fuel supply constraint',
      expectedTypes: [
        { type: 'Congestion management consultancy', reason: 'Transmission congestion analysis and mitigation strategies', confidence: 0.85 },
        { type: 'Fuel supply logistics firm', reason: 'Emergency fuel delivery, rail-to-truck transfer, and supply chain triage', confidence: 0.82 },
        { type: 'Rapid deployment energy contractor', reason: 'Fast-track construction for urgent energy infrastructure needs', confidence: 0.78 }
      ]
    },
    'OSC': {
      fullName: 'Oscillatory', label: 'Grid Oscillation & Harmonics', tier: 'operational',
      neuroTranslation: { inNeurology: 'Neural oscillations synchronize activity at specific frequencies.', inBusiness: 'In energy, this is grid oscillation and harmonics — the cyclic phenomena that must be managed to prevent instability and equipment damage.' },
      function: 'Monitors and manages grid oscillations, sub-synchronous resonance, and harmonics',
      dysregulation: 'Sub-synchronous resonance event, harmonic-induced equipment damage, oscillation instability',
      expectedTypes: [
        { type: 'Power system oscillation analysis firm', reason: 'SSR, forced oscillation, and inter-area mode analysis', confidence: 0.85 },
        { type: 'Harmonic filter manufacturer', reason: 'Active and passive harmonic filters for inverter-heavy grids', confidence: 0.82 },
        { type: 'Grid waveform monitoring vendor', reason: 'Point-on-wave, waveform capture, and power quality recorders', confidence: 0.78 }
      ]
    },
    'OXY': {
      fullName: 'Oxytocin', label: 'Energy Partnerships & PPAs', tier: 'operational',
      neuroTranslation: { inNeurology: 'Promotes social bonding, trust, and cooperative behavior.', inBusiness: 'In energy, this is partnerships and PPAs — the contractual bonds between generators, utilities, and offtakers that underpin energy markets.' },
      function: 'Structures power purchase agreements, joint ventures, and energy partnerships',
      dysregulation: 'PPA dispute, failed joint venture, partnership dissolution',
      expectedTypes: [
        { type: 'PPA advisory firm', reason: 'Corporate and utility PPA structuring, negotiation, and optimization', confidence: 0.92 },
        { type: 'Energy joint venture consultancy', reason: 'JV structuring for generation, transmission, and storage projects', confidence: 0.82 },
        { type: 'Energy contract management platform', reason: 'PPA, tolling, and fuel contract lifecycle management', confidence: 0.80 }
      ]
    },
    'PBN': {
      fullName: 'Parabrachial Nucleus', label: 'Energy Comfort & End-Use', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays visceral sensory information about temperature and comfort.', inBusiness: 'In energy, this is end-use comfort — the HVAC, lighting, and appliance systems that deliver energy services to consumers.' },
      function: 'Delivers energy services to end-users through HVAC, lighting, and appliance systems',
      dysregulation: 'Energy poverty, inefficient buildings, comfort complaints',
      expectedTypes: [
        { type: 'Energy efficiency contractor', reason: 'Insulation, HVAC upgrades, and weatherization for buildings', confidence: 0.90 },
        { type: 'Building energy management vendor', reason: 'BAS, EMS, and energy optimization for commercial buildings', confidence: 0.85 },
        { type: 'Lighting efficiency vendor', reason: 'LED retrofit, controls, and lighting design for energy savings', confidence: 0.78 }
      ]
    },
    'PCC': {
      fullName: 'Posterior Cingulate Cortex', label: 'Energy Performance Benchmarking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-referential processing and internal evaluation.', inBusiness: 'In energy, this is performance benchmarking — comparing energy system performance against industry standards, peers, and historical baselines.' },
      function: 'Benchmarks energy reliability, efficiency, and cost against peers and standards',
      dysregulation: 'No performance baseline, unmeasured inefficiency, self-congratulatory reporting',
      expectedTypes: [
        { type: 'Energy benchmarking consultancy', reason: 'SAIDI/SAIFI benchmarking, heat rate optimization, and peer comparison', confidence: 0.85 },
        { type: 'Utility performance analytics platform', reason: 'Reliability metrics, generation KPIs, and financial benchmarks', confidence: 0.82 },
        { type: 'Energy Star and LEED assessor', reason: 'Building energy performance rating and certification', confidence: 0.75 }
      ]
    },
    'PI': {
      fullName: 'Posterior Insula', label: 'Energy Equipment Damage Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes pain and damage signals.', inBusiness: 'In energy, this is equipment damage detection — identifying physical damage to transformers, turbines, lines, and panels from weather, age, or impact.' },
      function: 'Detects physical damage to energy equipment from lightning, storms, age, and impact',
      dysregulation: 'Undetected lightning damage, hidden turbine blade crack, corroded conductor',
      expectedTypes: [
        { type: 'Post-storm damage assessment firm', reason: 'Rapid aerial and ground assessment after weather events', confidence: 0.90 },
        { type: 'Wind turbine blade inspection vendor', reason: 'Blade crack, erosion, and delamination detection', confidence: 0.85 },
        { type: 'Transformer oil analysis laboratory', reason: 'DGA, moisture, and dielectric testing for transformer health', confidence: 0.82 }
      ]
    },
    'PIN': {
      fullName: 'Pineal', label: 'Energy Asset Lifecycle Timing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Produces melatonin regulating circadian rhythm and seasonal timing.', inBusiness: 'In energy, this is asset lifecycle timing — determining when to overhaul, repower, or retire energy assets based on age, condition, and economics.' },
      function: 'Optimizes timing of energy asset overhaul, repowering, and retirement decisions',
      dysregulation: 'Premature retirement, delayed replacement past useful life, repower timing miss',
      expectedTypes: [
        { type: 'Energy asset lifecycle consultancy', reason: 'Remaining useful life, repower economics, and retirement planning', confidence: 0.88 },
        { type: 'Wind turbine repowering developer', reason: 'Replaces aging turbines with newer, larger models on existing sites', confidence: 0.85 },
        { type: 'Power plant life extension firm', reason: 'Boiler, turbine, and BOP upgrades extending plant operating life', confidence: 0.80 }
      ]
    },
    'PIT': {
      fullName: 'Pituitary', label: 'Energy Funding & Capital Release', tier: 'operational',
      neuroTranslation: { inNeurology: 'Master gland releasing hormones that trigger downstream cascades.', inBusiness: 'In energy, this is capital release — bond issuances, project finance closings, and DOE loan guarantees that trigger downstream construction activity.' },
      function: 'Releases capital through bonds, project finance, and government loan programs',
      dysregulation: 'Financing gap, bond market disruption, DOE loan guarantee delay',
      expectedTypes: [
        { type: 'Energy project finance advisor', reason: 'Non-recourse project finance for generation and transmission', confidence: 0.92 },
        { type: 'Utility bond underwriter', reason: 'Revenue and general obligation bonds for utility capital programs', confidence: 0.88 },
        { type: 'DOE loan program consultant', reason: 'LPO Title XVII and ATVM loan guarantee applications', confidence: 0.80 }
      ]
    },
    'PPN': {
      fullName: 'Pedunculopontine Nucleus', label: 'Energy Project Commissioning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Initiates locomotion and activates motor programs.', inBusiness: 'In energy, this is commissioning — the activation and testing of new energy systems before they enter commercial operation.' },
      function: 'Commissions new generation, transmission, and storage assets for commercial operation',
      dysregulation: 'Commissioning failure, incomplete testing, delayed COD',
      expectedTypes: [
        { type: 'Energy commissioning agent', reason: 'Power plant, substation, and renewable system commissioning', confidence: 0.92 },
        { type: 'Startup and testing contractor', reason: 'First fire, steam blow, and performance testing for new plants', confidence: 0.88 },
        { type: 'Relay and protection testing firm', reason: 'Secondary injection testing and protection scheme validation', confidence: 0.82 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Energy Self-Assessment & Maturity', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-awareness, mental imagery, and episodic memory retrieval.', inBusiness: 'In energy, this is organizational self-assessment — utility management maturity models, self-audits, and capability reviews.' },
      function: 'Evaluates utility organizational capability and management maturity',
      dysregulation: 'No self-assessment, blind spots, maturity stagnation',
      expectedTypes: [
        { type: 'Utility management maturity assessor', reason: 'ISO 55000, APPA RAMP, and utility management best practice evaluation', confidence: 0.82 },
        { type: 'Utility peer review facilitator', reason: 'Cross-utility benchmarking visits and best practice exchanges', confidence: 0.78 },
        { type: 'Organizational capability consultancy', reason: 'Staffing analysis, competency mapping, and succession planning', confidence: 0.75 }
      ]
    },
    'PULV': {
      fullName: 'Pulvinar', label: 'Energy Control Room Situational Awareness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Largest thalamic nucleus — visual attention and relevant stimulus filtering.', inBusiness: 'In energy, this is control room situational awareness — the video walls, map boards, and operator displays that maintain real-time energy system visibility.' },
      function: 'Provides control room displays, video walls, and real-time grid visualization',
      dysregulation: 'Information overload, stale displays, operator misses critical alarm',
      expectedTypes: [
        { type: 'Control room display integrator', reason: 'Video walls, map boards, and one-line diagram displays for energy', confidence: 0.88 },
        { type: 'Grid visualization software vendor', reason: 'Real-time one-line, geographic, and schematic grid displays', confidence: 0.85 },
        { type: 'Control room ergonomics firm', reason: 'Console design, lighting, and human factors for 24/7 operations', confidence: 0.78 }
      ]
    },
    'PUT': {
      fullName: 'Putamen', label: 'Energy Construction Execution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Executes habitual motor sequences.', inBusiness: 'In energy, this is construction execution — the repetitive field processes of setting poles, pulling wire, welding pipe, and pouring foundations.' },
      function: 'Executes repetitive energy construction: pole setting, conductor stringing, pipe welding',
      dysregulation: 'Construction defect, weld failure, pole set error',
      expectedTypes: [
        { type: 'Electrical line construction contractor', reason: 'T&D pole setting, conductor stringing, and substation building', confidence: 0.95 },
        { type: 'Pipeline welding contractor', reason: 'Manual and automatic pipe welding for oil and gas lines', confidence: 0.88 },
        { type: 'Foundation contractor for energy', reason: 'Turbine foundations, substation pads, and pole footings', confidence: 0.82 }
      ]
    },
    'RAPHE': {
      fullName: 'Raphe Nuclei', label: 'Energy Service Quality', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary serotonin source — modulates mood and regulation.', inBusiness: 'In energy, this is service quality — reliability metrics, customer satisfaction, and the overall quality of energy service delivery.' },
      function: 'Measures and improves energy reliability, customer satisfaction, and service quality',
      dysregulation: 'Declining reliability, customer complaints, poor SAIDI/SAIFI',
      expectedTypes: [
        { type: 'Utility customer satisfaction consultancy', reason: 'JD Power methodology, survey design, and customer experience', confidence: 0.82 },
        { type: 'Reliability improvement firm', reason: 'Targeted reliability investments to reduce SAIDI/SAIFI', confidence: 0.85 },
        { type: 'Power quality monitoring vendor', reason: 'Voltage quality, flicker, and sag/swell monitoring', confidence: 0.80 }
      ]
    },
    'RF': {
      fullName: 'Reticular Formation', label: 'Energy Operational Readiness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Maintains wakefulness and arousal.', inBusiness: 'In energy, this is operational readiness — spare parts inventory, crew availability, and standby capacity for rapid response.' },
      function: 'Maintains spare equipment, crew readiness, and standby capacity for energy operations',
      dysregulation: 'No spare transformer, depleted crew roster, insufficient standby generation',
      expectedTypes: [
        { type: 'Utility spare equipment management vendor', reason: 'Transformer sparing, breaker inventory, and critical spares programs', confidence: 0.88 },
        { type: 'Workforce scheduling platform', reason: 'Crew rostering, on-call management, and overtime optimization', confidence: 0.82 },
        { type: 'Standby generation fleet operator', reason: 'Mobile substation and temporary generation deployment', confidence: 0.80 }
      ]
    },
    'RSC': {
      fullName: 'Retrosplenial Cortex', label: 'Energy Wayfinding & Signage', tier: 'operational',
      neuroTranslation: { inNeurology: 'Spatial orientation and reference frame transition.', inBusiness: 'In energy, this is wayfinding — pipeline markers, substation signage, and clearance markings that enable safe navigation around energy infrastructure.' },
      function: 'Provides pipeline markers, warning signs, and clearance markings on energy infrastructure',
      dysregulation: 'Missing pipeline marker, inadequate clearance warning, unmarked energized equipment',
      expectedTypes: [
        { type: 'Pipeline marker and sign manufacturer', reason: 'API-compliant pipeline markers, warning signs, and line posts', confidence: 0.85 },
        { type: 'Substation signage vendor', reason: 'Danger, high voltage, and clearance markings for energy facilities', confidence: 0.80 },
        { type: 'Utility locating equipment vendor', reason: 'EM locators, GPS markers, and ELF systems for buried energy assets', confidence: 0.78 }
      ]
    },
    'SC': {
      fullName: 'Superior Colliculus', label: 'Energy Rapid Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Rapid visual orienting and reflexive gaze shifts.', inBusiness: 'In energy, this is rapid assessment — quick-look evaluations after storms, rapid damage triage, and fast safety assessments.' },
      function: 'Performs rapid post-event damage assessment and safety triage for energy assets',
      dysregulation: 'Slow post-storm assessment, missed damage during rapid survey',
      expectedTypes: [
        { type: 'Post-storm aerial damage assessment firm', reason: 'Helicopter and drone rapid assessment of line and structure damage', confidence: 0.90 },
        { type: 'Rapid safety assessment team', reason: 'First-look safety evaluation before restoration crews enter area', confidence: 0.85 },
        { type: 'Mobile damage reporting platform', reason: 'Field damage reporting apps for utility storm response', confidence: 0.78 }
      ]
    },
    'SEPT': {
      fullName: 'Septal Nuclei', label: 'Energy Safe Zones & Refuges', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in pleasure and suppression of fear responses.', inBusiness: 'In energy, these are safe zones — transformer exclusion zones, safe clearance distances, and refuge areas at energy facilities.' },
      function: 'Establishes exclusion zones, safe clearances, and shelter areas around energy infrastructure',
      dysregulation: 'Clearance violation, missing exclusion zone, inadequate blast radius protection',
      expectedTypes: [
        { type: 'Arc flash and blast protection vendor', reason: 'Arc-rated PPE, blast-resistant enclosures, and arc flash labels', confidence: 0.88 },
        { type: 'Clearance zone design consultancy', reason: 'NESC clearance, pipeline setback, and wind turbine setback design', confidence: 0.82 },
        { type: 'Safety barrier and fencing vendor', reason: 'Substation fencing, pipeline bollards, and restricted area barriers', confidence: 0.78 }
      ]
    },
    'SMA': {
      fullName: 'Supplementary Motor Area', label: 'Energy Pre-Construction Planning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Plans complex motor sequences before M1 executes them.', inBusiness: 'In energy, this is pre-construction planning — constructability reviews, outage scheduling, and work package planning before execution.' },
      function: 'Plans energy construction sequences, outage windows, and constructability reviews',
      dysregulation: 'Poorly planned outage, construction interference with operations, sequence error',
      expectedTypes: [
        { type: 'Energy constructability review firm', reason: 'Pre-construction reviews for power plant and T&D projects', confidence: 0.85 },
        { type: 'Outage planning consultancy', reason: 'Generation and transmission outage scheduling and coordination', confidence: 0.88 },
        { type: 'Work package development firm', reason: 'Detailed work packages for energy construction and maintenance', confidence: 0.78 }
      ]
    },
    'SMN': {
      fullName: 'Somatomotor Network', label: 'Energy Field Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrates sensory input with motor output for coordinated movement.', inBusiness: 'In energy, this is field operations — coordinated deployment of line crews, plant operators, and field technicians.' },
      function: 'Coordinates energy field crew deployment, equipment logistics, and material staging',
      dysregulation: 'Crew-truck mismatch, material delivery failure, uncoordinated field ops',
      expectedTypes: [
        { type: 'Utility field operations platform', reason: 'Digital work orders, crew GPS tracking, and mobile field tools', confidence: 0.88 },
        { type: 'Energy material management vendor', reason: 'Warehouse management, kit staging, and JIT material delivery', confidence: 0.82 },
        { type: 'Contract line crew provider', reason: 'Supplemental line crew staffing for peak and storm periods', confidence: 0.85 }
      ]
    },
    'SN': {
      fullName: 'Salience Network', label: 'Energy Priority Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects salient events and switches attention.', inBusiness: 'In energy, this is priority detection — identifying which grid emergencies, outages, or market conditions require immediate resource reallocation.' },
      function: 'Identifies the highest-priority energy events and triggers resource reallocation',
      dysregulation: 'Wrong priority assignment, overreaction to minor event, missed critical failure',
      expectedTypes: [
        { type: 'Outage management system vendor', reason: 'OMS with priority-based restoration and crew dispatch', confidence: 0.92 },
        { type: 'Energy event triage platform', reason: 'Real-time event classification, priority scoring, and escalation', confidence: 0.85 },
        { type: 'Grid emergency response consultancy', reason: 'Emergency operating procedures and priority restoration planning', confidence: 0.80 }
      ]
    },
    'SNIG': {
      fullName: 'Substantia Nigra', label: 'Fuel Supply Chain', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary dopamine source to striatum — essential for initiating movement.', inBusiness: 'In energy, this is the fuel supply chain — the coal trains, gas pipelines, and fuel deliveries that supply the raw inputs generation needs to produce power.' },
      function: 'Delivers fuel to power plants via rail, pipeline, truck, and marine logistics',
      dysregulation: 'Fuel delivery disruption, coal train delay, gas curtailment, LNG cargo diversion',
      expectedTypes: [
        { type: 'Fuel logistics and supply firm', reason: 'Coal, gas, oil, and biomass procurement and delivery', confidence: 0.90 },
        { type: 'LNG terminal operator', reason: 'LNG receiving, storage, regasification, and send-out', confidence: 0.85 },
        { type: 'Fuel quality testing laboratory', reason: 'BTU content, sulfur, ash, and moisture testing for power plant fuels', confidence: 0.78 }
      ]
    },
    'SNS': {
      fullName: 'Sympathetic Nervous System', label: 'Energy Rapid Mobilization', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fight-or-flight activation.', inBusiness: 'In energy, this is rapid mobilization — calling out storm crews, activating mutual aid, and surging resources for grid emergencies.' },
      function: 'Mobilizes storm crews, activates mutual aid, and surges resources for grid emergencies',
      dysregulation: 'Slow crew callout, mutual aid coordination failure, insufficient surge capacity',
      expectedTypes: [
        { type: 'Storm restoration mobilization service', reason: 'Pre-positioned crews and equipment for utility storm response', confidence: 0.92 },
        { type: 'Utility mutual aid platform', reason: 'RMAG, NAMAG, and regional mutual assistance coordination', confidence: 0.85 },
        { type: 'Emergency utility staffing agency', reason: 'Rapid deployment of qualified utility workers during emergencies', confidence: 0.80 }
      ]
    },
    'STN': {
      fullName: 'Subthalamic Nucleus', label: 'Energy Regulatory Enforcement', tier: 'operational',
      neuroTranslation: { inNeurology: 'Excitatory brake on inappropriate actions.', inBusiness: 'In energy, this is regulatory enforcement — NERC violations, EPA enforcement, and state commission penalties that stop non-compliant energy operations.' },
      function: 'Enforces energy regulations through NERC penalties, EPA actions, and state commission orders',
      dysregulation: 'Unenforced violations, regulatory gap, weak enforcement authority',
      expectedTypes: [
        { type: 'NERC compliance consultancy', reason: 'Reliability standards compliance, self-reporting, and mitigation planning', confidence: 0.90 },
        { type: 'Energy regulatory enforcement attorney', reason: 'FERC, NERC, and state enforcement proceedings representation', confidence: 0.85 },
        { type: 'Compliance management platform', reason: 'NERC CIP, O&P, and FAC standards evidence management', confidence: 0.82 }
      ]
    },
    'STS': {
      fullName: 'Superior Temporal Sulcus', label: 'Energy Consumer Behavior', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes social perception — understanding intentions from behavior.', inBusiness: 'In energy, this is consumer behavior analysis — understanding how consumers use energy through AMI data, load profiles, and rate response patterns.' },
      function: 'Analyzes energy consumption patterns, load profiles, and rate response behavior',
      dysregulation: 'Misunderstood demand patterns, ineffective rate design, load profile errors',
      expectedTypes: [
        { type: 'Energy consumer analytics firm', reason: 'AMI data analytics, customer segmentation, and load profiling', confidence: 0.88 },
        { type: 'Rate design consultancy', reason: 'Tariff structure design based on customer usage patterns', confidence: 0.85 },
        { type: 'Energy behavioral science firm', reason: 'Behavioral nudges, home energy reports, and conservation psychology', confidence: 0.78 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Energy Stakeholder Perspective', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports theory of mind — understanding others\' perspectives.', inBusiness: 'In energy, this is stakeholder perspective — understanding diverse needs of ratepayers, communities, environmentalists, and industry in energy decisions.' },
      function: 'Incorporates diverse stakeholder perspectives into energy planning and siting decisions',
      dysregulation: 'Ignored community concerns, one-sided planning, project opposition',
      expectedTypes: [
        { type: 'Energy stakeholder engagement firm', reason: 'Public hearings, community advisory panels, and consensus building', confidence: 0.85 },
        { type: 'Environmental justice in energy consultancy', reason: 'EJ analysis for power plant siting and rate impact assessment', confidence: 0.82 },
        { type: 'Energy public participation platform', reason: 'Online engagement tools for IRP, rate cases, and siting proceedings', confidence: 0.78 }
      ]
    },
    'TPOLE': {
      fullName: 'Temporal Pole', label: 'Energy Heritage & Identity', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports semantic memory and social-emotional associations.', inBusiness: 'In energy, this is heritage and identity — the cultural significance of energy landmarks, historic power plants, and energy community identity.' },
      function: 'Preserves cultural significance of energy landmarks and community energy identity',
      dysregulation: 'Loss of historic energy sites, community identity disruption from plant closure',
      expectedTypes: [
        { type: 'Historic preservation for energy sites', reason: 'SHPO coordination and adaptive reuse of historic power plants', confidence: 0.78 },
        { type: 'Community transition planning firm', reason: 'Economic transition planning for communities losing power plants', confidence: 0.82 },
        { type: 'Energy heritage tourism developer', reason: 'Repurposing retired energy sites for education and tourism', confidence: 0.72 }
      ]
    },
    'TrkB': {
      fullName: 'TrkB Receptor', label: 'Energy Innovation Adoption', tier: 'operational',
      neuroTranslation: { inNeurology: 'BDNF receptor enabling neuroplasticity when activated.', inBusiness: 'In energy, this is innovation adoption — the willingness of utilities and operators to adopt new technologies like AI, blockchain, and advanced materials.' },
      function: 'Evaluates and adopts emerging energy technologies and operational innovations',
      dysregulation: 'Innovation resistance, failed pilot programs, technology paralysis',
      expectedTypes: [
        { type: 'Energy innovation consultancy', reason: 'Technology scouting, pilot design, and implementation roadmapping', confidence: 0.85 },
        { type: 'Advanced energy materials vendor', reason: 'High-temperature superconductors, advanced conductors, and nano-coatings', confidence: 0.78 },
        { type: 'Energy technology accelerator', reason: 'Startup incubation and utility-startup partnership programs', confidence: 0.75 }
      ]
    },
    'UNC': {
      fullName: 'Uncinate Fasciculus', label: 'Energy Interconnection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Connects frontal and temporal lobes across the Sylvian fissure.', inBusiness: 'In energy, this is interconnection — the tie lines, DC ties, and cross-border connections linking separate grid systems.' },
      function: 'Links separate grid regions through tie lines, HVDC links, and cross-border interconnections',
      dysregulation: 'Interconnection constraint, DC tie failure, cross-border scheduling conflict',
      expectedTypes: [
        { type: 'HVDC system vendor', reason: 'High-voltage DC converters and submarine cable systems', confidence: 0.90 },
        { type: 'Interconnection study consultant', reason: 'System impact, facility, and cluster studies for generator interconnection', confidence: 0.88 },
        { type: 'Cross-border power trading firm', reason: 'International electricity trade scheduling and settlement', confidence: 0.78 }
      ]
    },
    'V1': {
      fullName: 'Primary Visual Cortex', label: 'Energy Imaging & Survey', tier: 'operational',
      neuroTranslation: { inNeurology: 'First cortical stage of visual processing.', inBusiness: 'In energy, this is raw imaging — LiDAR survey of transmission corridors, satellite monitoring of solar farms, and aerial survey of pipelines.' },
      function: 'Captures aerial and satellite imagery for energy corridor and facility assessment',
      dysregulation: 'Survey gaps, poor image resolution, outdated corridor mapping',
      expectedTypes: [
        { type: 'Aerial LiDAR survey firm', reason: 'Transmission corridor, pipeline route, and wind site LiDAR mapping', confidence: 0.92 },
        { type: 'Satellite monitoring for energy', reason: 'Solar farm performance monitoring and pipeline surveillance from space', confidence: 0.85 },
        { type: 'Photogrammetric survey vendor', reason: 'Orthophotos and 3D models for energy facility as-builts', confidence: 0.80 }
      ]
    },
    'VAN': {
      fullName: 'Ventral Attention Network', label: 'Energy Unexpected Event Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects unexpected salient stimuli — bottom-up surprise detection.', inBusiness: 'In energy, this is unexpected event detection — detecting equipment failures, price spikes, and weather events that were not predicted.' },
      function: 'Detects unpredicted equipment failures, price anomalies, and weather-driven energy events',
      dysregulation: 'Missed unexpected transformer failure, undetected market anomaly',
      expectedTypes: [
        { type: 'Real-time anomaly detection platform', reason: 'ML-based detection of unexpected patterns in energy data streams', confidence: 0.88 },
        { type: 'Weather impact modeling for energy', reason: 'Severe weather impact prediction on generation and transmission', confidence: 0.85 },
        { type: 'Market surveillance vendor', reason: 'Detects unusual trading patterns and price manipulation in energy markets', confidence: 0.80 }
      ]
    },
    'VERM': {
      fullName: 'Vermis', label: 'Energy Structural Balance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Midline cerebellum for postural balance and equilibrium.', inBusiness: 'In energy, this is structural balance — tower loading, conductor sag-tension, and foundation settlement for energy structures.' },
      function: 'Monitors structural balance and loading on towers, poles, and energy structures',
      dysregulation: 'Tower overload, excessive conductor sag, foundation tilt',
      expectedTypes: [
        { type: 'Transmission structure engineering firm', reason: 'Tower loading analysis, PLS-CADD modeling, and structural assessment', confidence: 0.90 },
        { type: 'Conductor sag-tension analysis service', reason: 'Sag surveys, clearance verification, and thermal rating studies', confidence: 0.85 },
        { type: 'Foundation assessment for energy structures', reason: 'Tower and pole foundation inspection and repair', confidence: 0.78 }
      ]
    },
    'VEST': {
      fullName: 'Vestibular', label: 'Energy Stability Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects head position and movement for balance.', inBusiness: 'In energy, this is stability monitoring — inclinometers on transmission towers, tilt sensors on solar trackers, and dam deformation monitoring.' },
      function: 'Detects tilt, movement, and deformation in energy structures and facilities',
      dysregulation: 'Undetected tower lean, solar tracker misalignment, dam seepage',
      expectedTypes: [
        { type: 'Structural monitoring for energy assets', reason: 'Tilt, vibration, and deformation sensors for towers and dams', confidence: 0.88 },
        { type: 'Solar tracker alignment service', reason: 'Tracker calibration, backlash correction, and tilt sensor maintenance', confidence: 0.82 },
        { type: 'Dam safety monitoring vendor', reason: 'Piezometers, inclinometers, and seepage monitoring for hydro dams', confidence: 0.85 }
      ]
    },
    'VP': {
      fullName: 'Ventral Pallidum', label: 'Energy Resilience', tier: 'operational',
      neuroTranslation: { inNeurology: 'Reward circuitry involved in motivational drive.', inBusiness: 'In energy, this is resilience — grid hardening, undergrounding, and redundancy investments that maintain service under extreme conditions.' },
      function: 'Hardens energy infrastructure against storms, cyber attacks, and cascading failures',
      dysregulation: 'Brittle grid, insufficient redundancy, slow recovery from extreme events',
      expectedTypes: [
        { type: 'Grid hardening contractor', reason: 'Undergrounding, pole replacement, and storm-resistant construction', confidence: 0.92 },
        { type: 'Energy resilience consultancy', reason: 'Climate adaptation, hardening cost-benefit, and resilience planning', confidence: 0.88 },
        { type: 'Microgrid for resilience developer', reason: 'Critical facility microgrids for islanding during grid outages', confidence: 0.82 }
      ]
    },
    'VV': {
      fullName: 'Ventral Vagal', label: 'Energy Community Connection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports social engagement and safe connection.', inBusiness: 'In energy, this is community energy — community solar, energy co-ops, and local clean energy programs that connect neighbors through shared energy resources.' },
      function: 'Provides community solar, energy co-ops, and shared clean energy programs',
      dysregulation: 'Community solar program failure, co-op governance breakdown, subscriber churn',
      expectedTypes: [
        { type: 'Community solar developer', reason: 'Shared solar projects enabling renters and low-income access', confidence: 0.90 },
        { type: 'Energy cooperative manager', reason: 'Rural electric co-op and municipal utility management services', confidence: 0.85 },
        { type: 'Community energy platform', reason: 'Subscriber management and billing for shared energy programs', confidence: 0.78 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke\'s Area', label: 'Energy Data Interpretation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Comprehends spoken and written language — extracts meaning from input.', inBusiness: 'In energy, this is data interpretation — making sense of SCADA data, market data, and operational analytics into actionable intelligence.' },
      function: 'Interprets energy operational data, market signals, and analytics into actionable findings',
      dysregulation: 'Misinterpreted grid data, unused analytics output, information overload',
      expectedTypes: [
        { type: 'Energy data analytics firm', reason: 'Transforms raw SCADA, AMI, and market data into operational insights', confidence: 0.88 },
        { type: 'Energy market intelligence service', reason: 'Price signal interpretation, fundamental analysis, and market reports', confidence: 0.85 },
        { type: 'Utility business intelligence platform', reason: 'Executive dashboards, KPI tracking, and operational reporting', confidence: 0.80 }
      ]
    },
    'mPFC': {
      fullName: 'Medial Prefrontal Cortex', label: 'Energy Strategy & Policy Direction', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-referential processing and value-based decision-making.', inBusiness: 'In energy, this is high-level strategy — corporate strategy for utilities, national energy strategy, and political direction on energy mix.' },
      function: 'Sets corporate and governmental energy strategy, political direction, and investment priority',
      dysregulation: 'Strategy drift, political reversal on energy policy, investment misallocation',
      expectedTypes: [
        { type: 'Energy strategy consultancy', reason: 'Corporate strategy, M&A advisory, and portfolio optimization for energy', confidence: 0.90 },
        { type: 'Energy policy think tank', reason: 'Research and policy recommendations on energy transition and security', confidence: 0.82 },
        { type: 'Government energy advisory', reason: 'DOE, state energy office, and legislative energy policy support', confidence: 0.78 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate Cortex', label: 'Energy Dispute Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates emotional responses to conflict.', inBusiness: 'In energy, this is dispute resolution — resolving rate case disputes, PPA conflicts, siting opposition, and interconnection disagreements.' },
      function: 'Resolves energy disputes through mediation, arbitration, and regulatory proceedings',
      dysregulation: 'Protracted rate case, PPA litigation, siting injunction',
      expectedTypes: [
        { type: 'Energy dispute resolution firm', reason: 'Mediation and arbitration for utility, IPP, and developer disputes', confidence: 0.85 },
        { type: 'Energy litigation attorney', reason: 'FERC, PUC, and court representation in energy proceedings', confidence: 0.88 },
        { type: 'Regulatory mediation service', reason: 'Facilitated settlement of rate cases and siting disputes', confidence: 0.78 }
      ]
    },
    'vlPFC': {
      fullName: 'Ventrolateral Prefrontal Cortex', label: 'Energy Contract Administration', tier: 'operational',
      neuroTranslation: { inNeurology: 'Response inhibition and rule-based decision-making.', inBusiness: 'In energy, this is contract administration — enforcing PPA terms, EPC contract compliance, and fuel supply agreement adherence.' },
      function: 'Administers energy contracts including PPAs, EPC agreements, and fuel supply contracts',
      dysregulation: 'PPA dispute, EPC contractor non-performance, fuel contract breach',
      expectedTypes: [
        { type: 'Energy contract administration firm', reason: 'PPA compliance monitoring, milestone verification, and change management', confidence: 0.88 },
        { type: 'EPC claims consultancy', reason: 'Power plant and renewable EPC delay claims and dispute resolution', confidence: 0.85 },
        { type: 'Energy procurement compliance platform', reason: 'Contract milestone tracking, deliverable verification, and audit trail', confidence: 0.80 }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIERARCHY CACHE
  // ══════════════════════════════════════════════════════════════════════

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) {
      return callback(_hierarchyCache);
    }
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
    var brain = brains.get('energy');
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
        for (var di = 0; di < dx.length; di++) { result.nodeDiagnoses[nid][dx[di]] = true; }
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
      status: status, reason: reason || '', nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator', submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(), reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  // ══════════════════════════════════════════════════════════════════════
  // INFERENCE ENGINE
  // ══════════════════════════════════════════════════════════════════════

  function getEnergyState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('energy');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getEnergyState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('energy') : null;
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
      for (var tk in existingCos) { mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')'); }

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
            var mc2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) mc2++;
            }
            if (mc2 >= 2) { alreadyMapped = true; break; }
          }
        }

        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Energy tied to ' + dir.label + '.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: eligible for future portal path mapping and audit tracking within Energy.';
          else consequence = 'If approved: recorded as valid Energy mapping for audit tracking. Requires further validation.';
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
          nodeLabel: dir.label, nodeFunction: dir.function,
          plainFunction: dir.function, dysregulation: dir.dysregulation || '',
          plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type, reason: expected.reason,
          confidence: expected.confidence, nodeActive: nodeActive,
          alreadyMapped: alreadyMapped, existingCompanies: mappedCompanyNames,
          approval: approval, approvalRequired: showButtons,
          variantState: variantState, approvalConsequence: consequence,
          tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' + (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
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
      var seen = {}; var out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped); missing = dedupeExact(missing); speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var ta = a.tier === 'top' ? 0 : 1, tb = b.tier === 'top' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);

    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) {
      if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    }
    return approved;
  }

  window.LIMENEnergyBusinessEngine = {
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

  loadFullHierarchy(function () {
    console.log('[EnergyBusinessEngine] Hierarchy loaded');
  });

  console.log('[EnergyBusinessEngine] Loaded \u2014 103-node full-hierarchy energy business assignment engine');

})();
