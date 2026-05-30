/**
 * infrastructure-node-business-engine.js — Infrastructure Node-to-Business Assignment Engine
 *
 * INFRASTRUCTURE DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture:
 *   - Covers 103 operational nodes (20 RI/framework nodes excluded)
 *   - Filters generic template treatments before inference
 *   - Compares existing companies against business-type directory
 *
 * Outputs 3 buckets:
 *   MAPPED     — already mapped and active in Infrastructure system
 *   MISSING    — plausible but missing from current Infrastructure mappings
 *   SPECULATIVE — low-confidence or novel suggestions
 *
 * Approval statuses:
 *   PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_infrastructure_business_approvals')
 *
 * Self-gates: only runs when ?domain=infrastructure is in the URL.
 * Exposes: window.LIMENInfrastructureBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'infrastructure') return;

  var STORAGE_KEY = 'limen_infrastructure_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_infrastructure_hierarchy_cache';
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
  // 20 portal-active nodes = tier 'top'
  // 83 remaining operational nodes = tier 'operational'
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {

    // ────────────────────────────────────────────────────────────────────
    // TOP-TIER NODES (20) — portal-active in infrastructure.json
    // ────────────────────────────────────────────────────────────────────

    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Construction', tier: 'top',
      neuroTranslation: { inNeurology: 'Sends direct commands to muscles producing voluntary movement — the final cortical output stage.', inBusiness: 'In infrastructure, this is the construction industry. Residential, commercial, and industrial building physically creates the built environment. M1 is where plans become physical structures.' },
      function: 'Physically builds residential, commercial, and industrial infrastructure',
      dysregulation: 'Construction delays, labor shortage, permit backlog, structural defects',
      expectedTypes: [
        { type: 'General contractor', reason: 'Manages and executes construction projects end-to-end', confidence: 0.95 },
        { type: 'Heavy civil contractor', reason: 'Builds roads, bridges, dams, tunnels, and utilities', confidence: 0.92 },
        { type: 'Construction management firm', reason: 'Oversees schedule, budget, and quality for owners', confidence: 0.88 },
        { type: 'Building materials manufacturer', reason: 'Produces concrete, steel, lumber, and composites for construction', confidence: 0.85 }
      ]
    },
    'THAL': {
      fullName: 'Thalamus', label: 'Electrical Grid', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays nearly all sensory and motor signals between subcortical structures and the cortex.', inBusiness: 'In infrastructure, this is the electrical grid — generation, transmission, and distribution networks delivering power across the built environment.' },
      function: 'Generates, transmits, and distributes electrical power',
      dysregulation: 'Grid failure, transformer overload, substation outage, frequency deviation',
      expectedTypes: [
        { type: 'T&D utility', reason: 'Owns and operates transmission and distribution infrastructure', confidence: 0.95 },
        { type: 'Grid automation vendor', reason: 'SCADA, smart grid monitoring, and real-time control', confidence: 0.90 },
        { type: 'Transformer manufacturer', reason: 'Core grid hardware — voltage conversion equipment', confidence: 0.88 },
        { type: 'Smart meter provider', reason: 'Demand-side visibility and grid-edge intelligence', confidence: 0.82 }
      ]
    },
    'CC': {
      fullName: 'Corpus Callosum', label: 'Road Networks', tier: 'top',
      neuroTranslation: { inNeurology: 'Largest white matter tract connecting left and right hemispheres, enabling interhemispheric communication.', inBusiness: 'In infrastructure, this is the road network — highways, arterials, and local streets connecting population centers and enabling ground transportation.' },
      function: 'Connects population centers via highway, arterial, and local road systems',
      dysregulation: 'Highway congestion, pavement failure, bridge deficiency, traffic signal outage',
      expectedTypes: [
        { type: 'Highway contractor', reason: 'Builds and resurfaces road infrastructure', confidence: 0.95 },
        { type: 'Pavement engineering firm', reason: 'Designs and inspects road surfaces and subgrades', confidence: 0.88 },
        { type: 'Traffic management vendor', reason: 'Real-time traffic monitoring, signal control, ITS systems', confidence: 0.85 },
        { type: 'Toll system operator', reason: 'Manages electronic toll collection and highway revenue', confidence: 0.80 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Urban Planning', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, cognitive planning, and multi-goal coordination.', inBusiness: 'In infrastructure, this is urban planning — zoning, land use frameworks, and spatial development that organize how cities grow and infrastructure is sited.' },
      function: 'Organizes spatial development, zoning, and land use for human settlements',
      dysregulation: 'Zoning conflicts, sprawl, incompatible land use, permitting gridlock',
      expectedTypes: [
        { type: 'Urban planning consultancy', reason: 'Master planning, zoning analysis, and development review', confidence: 0.92 },
        { type: 'GIS and spatial analytics vendor', reason: 'Mapping, land use modeling, and infrastructure siting tools', confidence: 0.85 },
        { type: 'Permitting technology platform', reason: 'Digital permit management and approval tracking', confidence: 0.80 },
        { type: 'Land surveyor', reason: 'Boundary, topographic, and construction surveying for infrastructure siting', confidence: 0.78 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Public Transit', tier: 'top',
      neuroTranslation: { inNeurology: 'Central to habit formation and reward-based learning through dopaminergic feedback loops.', inBusiness: 'In infrastructure, this is public transit — bus, subway, light rail, and ferry systems providing habitual shared transportation within metropolitan areas.' },
      function: 'Provides shared metropolitan transportation via bus, subway, light rail, and ferry',
      dysregulation: 'Service disruption, overcrowding, fare system failure, fleet deterioration',
      expectedTypes: [
        { type: 'Transit vehicle manufacturer', reason: 'Builds buses, railcars, and light rail vehicles', confidence: 0.92 },
        { type: 'Transit operations contractor', reason: 'Operates transit services under public agency contracts', confidence: 0.88 },
        { type: 'Fare collection system vendor', reason: 'Electronic fare media, gates, and revenue management', confidence: 0.82 },
        { type: 'Transit planning consultancy', reason: 'Route optimization, ridership modeling, service design', confidence: 0.78 }
      ]
    },
    'FORN': {
      fullName: 'Fornix', label: 'Pipelines', tier: 'top',
      neuroTranslation: { inNeurology: 'Major white matter bundle carrying output from hippocampus to hypothalamus — a dedicated fiber pathway.', inBusiness: 'In infrastructure, these are pipeline networks — oil, gas, water, and chemical pipelines transporting fluids across long distances through fixed corridors.' },
      function: 'Transports oil, gas, water, and chemicals through fixed pipeline corridors',
      dysregulation: 'Pipeline rupture, corrosion failure, right-of-way conflict, pressure loss',
      expectedTypes: [
        { type: 'Pipeline operator', reason: 'Operates interstate pipeline infrastructure', confidence: 0.95 },
        { type: 'Pipeline integrity service', reason: 'In-line inspection, corrosion monitoring, and repair', confidence: 0.88 },
        { type: 'Utility corridor manager', reason: 'Manages shared rights-of-way for multiple utilities', confidence: 0.82 },
        { type: 'Horizontal directional drilling contractor', reason: 'Installs underground pipelines and conduits', confidence: 0.78 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum', label: 'Rail Systems', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates voluntary movement, balance, and motor learning with precise timing.', inBusiness: 'In infrastructure, this is rail — freight and passenger rail networks requiring precise scheduling, coordination, and high-capacity throughput.' },
      function: 'Moves freight and passengers via conventional, high-speed, and urban rail',
      dysregulation: 'Derailment, signal failure, track degradation, scheduling collapse',
      expectedTypes: [
        { type: 'Railroad operator', reason: 'Operates freight or passenger rail services', confidence: 0.95 },
        { type: 'Rail signal and control vendor', reason: 'Positive train control, signaling, and dispatch systems', confidence: 0.88 },
        { type: 'Track maintenance contractor', reason: 'Rail grinding, tie replacement, and ballast work', confidence: 0.85 },
        { type: 'Rolling stock manufacturer', reason: 'Locomotives, freight cars, and passenger coaches', confidence: 0.82 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Maritime & Ports', tier: 'top',
      neuroTranslation: { inNeurology: 'Primary relay for visceral sensory input — integrates cardiovascular, respiratory, and digestive signals.', inBusiness: 'In infrastructure, these are seaports and maritime systems — the intake hubs where global trade volume enters domestic infrastructure networks.' },
      function: 'Handles seaport operations, shipping lanes, canal systems, and maritime infrastructure',
      dysregulation: 'Port congestion, berth shortage, dredging failure, navigational hazard',
      expectedTypes: [
        { type: 'Port terminal operator', reason: 'Manages container and bulk cargo terminal operations', confidence: 0.95 },
        { type: 'Marine construction contractor', reason: 'Builds wharves, bulkheads, breakwaters, and dredging', confidence: 0.88 },
        { type: 'Port equipment manufacturer', reason: 'Cranes, straddle carriers, and cargo handling systems', confidence: 0.85 },
        { type: 'Dredging service', reason: 'Maintains navigable channel depths for vessel access', confidence: 0.80 }
      ]
    },
    'FEF': {
      fullName: 'Frontal Eye Fields', label: 'Air Transport', tier: 'top',
      neuroTranslation: { inNeurology: 'Controls voluntary saccadic eye movements and visual attention direction.', inBusiness: 'In infrastructure, this is aviation — airports, air traffic control, and aviation infrastructure enabling directed long-range movement.' },
      function: 'Operates airports, air traffic control, and aviation ground infrastructure',
      dysregulation: 'Runway closure, ATC system failure, terminal overcapacity, ground equipment breakdown',
      expectedTypes: [
        { type: 'Airport operator', reason: 'Manages terminal, runway, and airfield operations', confidence: 0.95 },
        { type: 'ATC systems vendor', reason: 'Radar, communication, and navigation systems for air traffic', confidence: 0.88 },
        { type: 'Aviation ground support equipment', reason: 'Jetbridges, baggage systems, de-icing, and fueling', confidence: 0.82 },
        { type: 'Airport engineering firm', reason: 'Runway design, terminal planning, and airside civil works', confidence: 0.80 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Digital Infrastructure', tier: 'top',
      neuroTranslation: { inNeurology: 'Executive control network managing task-switching, cognitive flexibility, and adaptive control.', inBusiness: 'In infrastructure, this is digital infrastructure — data centers, cloud platforms, internet exchange points, and cybersecurity systems.' },
      function: 'Houses data centers, cloud platforms, internet exchanges, and cybersecurity systems',
      dysregulation: 'Data center outage, network partition, DDoS attack, cloud service failure',
      expectedTypes: [
        { type: 'Data center operator', reason: 'Operates colocation, hyperscale, or edge data centers', confidence: 0.95 },
        { type: 'Cybersecurity infrastructure vendor', reason: 'Firewalls, intrusion detection, and security operations centers', confidence: 0.90 },
        { type: 'Internet exchange point operator', reason: 'Peering and interconnection infrastructure', confidence: 0.82 },
        { type: 'Cloud infrastructure provider', reason: 'IaaS platforms serving government and enterprise', confidence: 0.80 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Water Treatment', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates homeostasis — temperature, hunger, thirst, circadian rhythms, and hormone release.', inBusiness: 'In infrastructure, this is water treatment — purification, distribution, and wastewater processing that maintain the essential balance of clean water supply.' },
      function: 'Purifies, distributes, and treats municipal water and wastewater',
      dysregulation: 'Water contamination, treatment plant overload, distribution main break, boil-water advisory',
      expectedTypes: [
        { type: 'Water utility', reason: 'Operates municipal water supply and distribution', confidence: 0.95 },
        { type: 'Water treatment equipment manufacturer', reason: 'Filtration, disinfection, and membrane systems', confidence: 0.90 },
        { type: 'Wastewater treatment operator', reason: 'Operates sewage treatment and water reclamation facilities', confidence: 0.88 },
        { type: 'Water quality testing laboratory', reason: 'Compliance testing for Safe Drinking Water Act standards', confidence: 0.78 }
      ]
    },
    'LANG': {
      fullName: 'Language Network', label: 'Telecommunications', tier: 'top',
      neuroTranslation: { inNeurology: 'Distributed network supporting language comprehension and production.', inBusiness: 'In infrastructure, this is telecommunications — fiber, wireless, and satellite networks enabling voice, data, and video transmission.' },
      function: 'Provides voice, data, and video transmission via fiber, wireless, and satellite',
      dysregulation: 'Network outage, fiber cut, spectrum congestion, satellite link loss',
      expectedTypes: [
        { type: 'Fiber optic network builder', reason: 'Deploys fiber infrastructure for broadband access', confidence: 0.95 },
        { type: 'Wireless tower operator', reason: 'Owns and operates wireless tower infrastructure', confidence: 0.90 },
        { type: 'Telecom equipment manufacturer', reason: 'Routers, switches, optical transport, and radio access', confidence: 0.85 },
        { type: 'Satellite communications provider', reason: 'LEO and GEO satellite connectivity for rural and maritime', confidence: 0.78 }
      ]
    },
    'ENS': {
      fullName: 'Enteric Nervous System', label: 'Waste Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Autonomous nervous system of the gut — manages digestion independently of central control.', inBusiness: 'In infrastructure, this is waste management — solid waste collection, recycling, hazardous waste processing, and landfill systems operating as a largely autonomous utility.' },
      function: 'Collects, processes, recycles, and disposes of solid and hazardous waste',
      dysregulation: 'Landfill capacity exhaustion, recycling contamination, hazardous waste spill, collection route failure',
      expectedTypes: [
        { type: 'Waste hauler', reason: 'Residential and commercial solid waste collection', confidence: 0.95 },
        { type: 'Recycling processor', reason: 'Materials recovery facility sorting and commodity processing', confidence: 0.88 },
        { type: 'Hazardous waste handler', reason: 'Licensed treatment, storage, and disposal of hazardous materials', confidence: 0.85 },
        { type: 'Landfill operator', reason: 'Engineered landfill with leachate and gas management', confidence: 0.82 }
      ]
    },
    'CeA': {
      fullName: 'Central Amygdala', label: 'Emergency Systems', tier: 'top',
      neuroTranslation: { inNeurology: 'Outputs fear and threat responses — triggers defensive behaviors and autonomic emergency reactions.', inBusiness: 'In infrastructure, these are emergency response systems — fire stations, EMS, disaster warning, and civil defense infrastructure that activate under threat.' },
      function: 'Provides fire, EMS, disaster warning, and civil defense response infrastructure',
      dysregulation: 'Delayed emergency response, warning system failure, dispatch overload, shelter shortage',
      expectedTypes: [
        { type: 'Emergency vehicle manufacturer', reason: 'Fire apparatus, ambulances, and rescue vehicles', confidence: 0.92 },
        { type: 'Emergency dispatch system vendor', reason: 'CAD, 911 systems, and public safety answering points', confidence: 0.88 },
        { type: 'Mass notification system provider', reason: 'Sirens, wireless alerts, and emergency broadcast infrastructure', confidence: 0.85 },
        { type: 'Emergency shelter and logistics contractor', reason: 'Temporary housing, supplies, and disaster staging', confidence: 0.78 }
      ]
    },
    'BROCA': {
      fullName: 'Broca\'s Area', label: 'Smart City Systems', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured speech output — translates thought into articulated language.', inBusiness: 'In infrastructure, these are smart city systems — sensor networks, IoT platforms, and integrated command centers that translate urban data into coordinated infrastructure actions.' },
      function: 'Integrates IoT sensors, command centers, and coordinated urban management platforms',
      dysregulation: 'Sensor network failure, command center overload, data integration breakdown',
      expectedTypes: [
        { type: 'Smart city platform vendor', reason: 'Integrated urban management software and dashboards', confidence: 0.88 },
        { type: 'IoT sensor network deployer', reason: 'Environmental, traffic, and utility sensor installations', confidence: 0.85 },
        { type: 'Municipal operations center integrator', reason: 'Unified command and control for city services', confidence: 0.80 }
      ]
    },
    'CING': {
      fullName: 'Cingulum', label: 'Transit Corridors', tier: 'top',
      neuroTranslation: { inNeurology: 'White matter bundle connecting frontal and temporal lobes — carries memory and emotional signals along a fixed pathway.', inBusiness: 'In infrastructure, these are transit corridors — fixed-guideway paths for bus rapid transit, light rail, and dedicated lanes.' },
      function: 'Provides dedicated transit corridors for BRT, light rail, and managed lanes',
      dysregulation: 'Guideway obstruction, signal priority failure, corridor encroachment',
      expectedTypes: [
        { type: 'BRT system designer', reason: 'Bus rapid transit station, lane, and signal priority design', confidence: 0.85 },
        { type: 'Light rail construction contractor', reason: 'Builds fixed-guideway and elevated rail infrastructure', confidence: 0.88 },
        { type: 'Transit signal priority vendor', reason: 'Signal preemption and priority systems for transit vehicles', confidence: 0.78 }
      ]
    },
    'UNC': {
      fullName: 'Uncinate Fasciculus', label: 'Bridges & Tunnels', tier: 'top',
      neuroTranslation: { inNeurology: 'White matter tract connecting frontal and temporal lobes across the Sylvian fissure — bridges separated brain regions.', inBusiness: 'In infrastructure, these are bridges and tunnels — structures that connect areas separated by water, terrain, or barriers.' },
      function: 'Connects areas separated by water or terrain via bridge and tunnel structures',
      dysregulation: 'Structural deficiency, scour damage, joint failure, tunnel ventilation loss',
      expectedTypes: [
        { type: 'Bridge engineering firm', reason: 'Bridge design, inspection, load rating, and rehabilitation', confidence: 0.95 },
        { type: 'Tunnel contractor', reason: 'Tunnel boring, cut-and-cover, and immersed tube construction', confidence: 0.90 },
        { type: 'Structural steel fabricator', reason: 'Fabrication of bridge girders, trusses, and connection plates', confidence: 0.85 },
        { type: 'Bridge inspection service', reason: 'NBI-compliant inspection, underwater inspection, and NDT', confidence: 0.82 }
      ]
    },
    'VP': {
      fullName: 'Ventral Pallidum', label: 'Infrastructure Resilience', tier: 'top',
      neuroTranslation: { inNeurology: 'Part of reward circuitry involved in motivational drive and hedonic evaluation.', inBusiness: 'In infrastructure, this is resilience — hardening, redundancy, and recovery systems that maintain service continuity under stress.' },
      function: 'Hardens infrastructure against natural disasters, climate events, and cascading failures',
      dysregulation: 'Cascading failure, inadequate redundancy, slow recovery, brittle single-point dependencies',
      expectedTypes: [
        { type: 'Resilience engineering consultancy', reason: 'Climate adaptation, hazard mitigation, and continuity planning', confidence: 0.90 },
        { type: 'Flood control contractor', reason: 'Levees, floodwalls, detention basins, and stormwater systems', confidence: 0.88 },
        { type: 'Backup power systems vendor', reason: 'Generators, UPS, and microgrid systems for critical facilities', confidence: 0.85 },
        { type: 'Seismic retrofit contractor', reason: 'Structural strengthening for earthquake resilience', confidence: 0.80 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Building Codes & Standards', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflicts and errors, signaling when corrective action is needed.', inBusiness: 'In infrastructure, this is the building code and standards system — safety regulations, inspections, and compliance enforcement that detect and correct structural deficiencies.' },
      function: 'Enforces safety standards, building codes, and inspection requirements',
      dysregulation: 'Code enforcement failure, inspection backlog, outdated standards, compliance gap',
      expectedTypes: [
        { type: 'Building inspection service', reason: 'Structural, electrical, plumbing, and fire code inspection', confidence: 0.92 },
        { type: 'Code compliance consultancy', reason: 'IBC, NFPA, ADA, and local code interpretation and review', confidence: 0.88 },
        { type: 'Testing and certification laboratory', reason: 'Materials testing, fire rating, and product certification', confidence: 0.85 },
        { type: 'Standards development organization', reason: 'ASTM, ASCE, AASHTO standards authoring and updates', confidence: 0.75 }
      ]
    },

    // ────────────────────────────────────────────────────────────────────
    // OPERATIONAL NODES (83) — not currently portal-active but available
    // for future diagnosis expansion
    // ────────────────────────────────────────────────────────────────────

    'A1': {
      fullName: 'Primary Auditory Cortex', label: 'Noise & Vibration Control', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes auditory signals from the environment.', inBusiness: 'In infrastructure, this is noise and vibration monitoring — sound barriers, vibration dampening, and environmental noise compliance for transportation and construction.' },
      function: 'Monitors and mitigates noise and vibration from infrastructure operations',
      dysregulation: 'Noise ordinance violations, vibration damage to adjacent structures, community complaints',
      expectedTypes: [
        { type: 'Acoustic engineering firm', reason: 'Sound barrier design, noise impact assessment, and mitigation', confidence: 0.85 },
        { type: 'Vibration monitoring service', reason: 'Construction and transit vibration measurement and compliance', confidence: 0.80 },
        { type: 'Sound wall manufacturer', reason: 'Highway and rail noise barrier panels and posts', confidence: 0.75 }
      ]
    },
    'ADR': {
      fullName: 'Adrenal', label: 'Emergency Power & Surge Response', tier: 'operational',
      neuroTranslation: { inNeurology: 'Releases adrenaline and cortisol during acute stress for rapid mobilization.', inBusiness: 'In infrastructure, this is emergency power and rapid surge response — backup generation, emergency repair crews, and mutual aid mobilization.' },
      function: 'Provides emergency power generation and rapid-response repair mobilization',
      dysregulation: 'Generator failure during outage, delayed mutual aid, fuel supply interruption',
      expectedTypes: [
        { type: 'Emergency generator rental service', reason: 'Temporary power for disaster and outage response', confidence: 0.88 },
        { type: 'Emergency infrastructure repair contractor', reason: 'Rapid mobilization for storm damage, washouts, and breaks', confidence: 0.85 },
        { type: 'Mutual aid coordination platform', reason: 'Interstate utility and contractor mutual assistance systems', confidence: 0.75 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Infrastructure Knowledge & Reference Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrates multimodal sensory input into unified conceptual understanding.', inBusiness: 'In infrastructure, this is the knowledge layer — technical manuals, design standards databases, and reference systems that synthesize multiple engineering disciplines.' },
      function: 'Maintains technical reference libraries, design manuals, and engineering knowledge bases',
      dysregulation: 'Outdated design standards, conflicting specifications, knowledge loss from workforce turnover',
      expectedTypes: [
        { type: 'Engineering reference publisher', reason: 'AASHTO, PCI, ACI manuals and design guides', confidence: 0.82 },
        { type: 'Infrastructure knowledge management platform', reason: 'Digital libraries for standards, specs, and lessons learned', confidence: 0.78 },
        { type: 'Professional development training provider', reason: 'Continuing education for PE, SE, and infrastructure professionals', confidence: 0.72 }
      ]
    },
    'AI': {
      fullName: 'Anterior Insula', label: 'Infrastructure Condition Awareness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Generates conscious awareness of bodily states — interoception.', inBusiness: 'In infrastructure, this is real-time condition awareness — structural health monitoring, SCADA dashboards, and asset condition assessment that make infrastructure state visible.' },
      function: 'Provides real-time structural health monitoring and condition awareness',
      dysregulation: 'Undetected deterioration, sensor blind spots, delayed condition reporting',
      expectedTypes: [
        { type: 'Structural health monitoring vendor', reason: 'Strain gauges, accelerometers, and tilt sensors on bridges and dams', confidence: 0.90 },
        { type: 'SCADA system integrator', reason: 'Supervisory control and data acquisition for utilities', confidence: 0.88 },
        { type: 'Asset condition assessment firm', reason: 'Pavement management, bridge inspection, and facility condition index', confidence: 0.85 }
      ]
    },
    'ANT': {
      fullName: 'Anterior Thalamus', label: 'Infrastructure Routing & Dispatch', tier: 'operational',
      neuroTranslation: { inNeurology: 'Part of the Papez circuit, relays signals between hippocampus and cingulate cortex.', inBusiness: 'In infrastructure, this is routing and dispatch — traffic management centers, utility dispatch, and fleet routing that direct resources to where they are needed.' },
      function: 'Routes vehicles, utility crews, and resources through dispatch and traffic management',
      dysregulation: 'Dispatch failure, misrouted crews, traffic management center outage',
      expectedTypes: [
        { type: 'Traffic management center operator', reason: 'Real-time highway monitoring and incident management', confidence: 0.88 },
        { type: 'Fleet management platform', reason: 'GPS tracking, routing, and dispatch for utility and maintenance fleets', confidence: 0.85 },
        { type: 'Intelligent transportation systems integrator', reason: 'Variable message signs, ramp metering, and connected vehicle systems', confidence: 0.80 }
      ]
    },
    'ARC': {
      fullName: 'Arcuate Fasciculus', label: 'Infrastructure Communication Networks', tier: 'operational',
      neuroTranslation: { inNeurology: 'White matter bundle connecting Broca and Wernicke areas for language processing.', inBusiness: 'In infrastructure, this is the communication backbone connecting field operations to command centers — radio networks, interoperable communications, and PSAP systems.' },
      function: 'Connects field operations to command centers via radio and interoperable networks',
      dysregulation: 'Radio dead zones, interoperability failure between agencies, communication overload during incidents',
      expectedTypes: [
        { type: 'Public safety radio system vendor', reason: 'P25, FirstNet, and LMR systems for infrastructure agencies', confidence: 0.88 },
        { type: 'Interoperable communications integrator', reason: 'Cross-agency radio bridges and shared talk groups', confidence: 0.82 },
        { type: 'Field communication equipment provider', reason: 'Ruggedized radios, repeaters, and mobile command units', confidence: 0.78 }
      ]
    },
    'BDNF': {
      fullName: 'BDNF / Plasticity', label: 'Infrastructure Modernization & Adaptation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports neuronal growth, synaptic plasticity, and adaptive rewiring.', inBusiness: 'In infrastructure, this is modernization — retrofitting aging systems, adopting new technologies, and adapting infrastructure to changing demands and climate.' },
      function: 'Drives infrastructure modernization, technology adoption, and adaptive retrofitting',
      dysregulation: 'Failure to modernize, technology debt, inability to adapt to new loads or climate',
      expectedTypes: [
        { type: 'Infrastructure modernization consultancy', reason: 'Asset lifecycle planning, technology roadmapping, and retrofit strategy', confidence: 0.88 },
        { type: 'Smart infrastructure technology vendor', reason: 'IoT retrofit kits, digital twins, and predictive maintenance platforms', confidence: 0.85 },
        { type: 'Climate adaptation engineering firm', reason: 'Sea level rise, heat island, and extreme weather infrastructure adaptation', confidence: 0.82 }
      ]
    },
    'BLA': {
      fullName: 'Basolateral Amygdala', label: 'Infrastructure Risk Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Evaluates threat significance and assigns emotional valence to sensory inputs.', inBusiness: 'In infrastructure, this is risk assessment — evaluating threats to infrastructure from natural hazards, security, and systemic vulnerabilities.' },
      function: 'Evaluates infrastructure risk from natural hazards, security threats, and systemic vulnerabilities',
      dysregulation: 'Underestimated risk, ignored vulnerability assessments, failure to act on known threats',
      expectedTypes: [
        { type: 'Infrastructure risk consultancy', reason: 'Hazard identification, vulnerability assessment, and risk quantification', confidence: 0.90 },
        { type: 'Natural hazard modeling firm', reason: 'Flood, earthquake, wind, and wildfire risk modeling for infrastructure', confidence: 0.85 },
        { type: 'Security assessment vendor', reason: 'Physical and cyber threat assessment for critical infrastructure', confidence: 0.82 }
      ]
    },
    'BNST': {
      fullName: 'Bed Nucleus of the Stria Terminalis', label: 'Sustained Infrastructure Threat Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Mediates sustained anxiety and vigilance to uncertain threats.', inBusiness: 'In infrastructure, this is sustained threat monitoring — long-term structural surveillance, deferred maintenance tracking, and slow-developing hazard detection.' },
      function: 'Tracks slow-developing infrastructure threats and deferred maintenance accumulation',
      dysregulation: 'Ignored slow deterioration, deferred maintenance spiral, undetected long-term subsidence',
      expectedTypes: [
        { type: 'Long-term structural monitoring vendor', reason: 'Multi-year sensor deployments on bridges, dams, and retaining walls', confidence: 0.85 },
        { type: 'Deferred maintenance tracking platform', reason: 'Capital improvement program management and backlog analytics', confidence: 0.82 },
        { type: 'Geotechnical monitoring firm', reason: 'Subsidence, slope stability, and groundwater monitoring', confidence: 0.80 }
      ]
    },
    'CARD': {
      fullName: 'Cardiac', label: 'Critical Facility Power & HVAC', tier: 'operational',
      neuroTranslation: { inNeurology: 'Autonomic cardiac regulation — heart rate and blood pressure control.', inBusiness: 'In infrastructure, this is the mechanical heart of critical facilities — HVAC, power distribution, and life safety systems in hospitals, data centers, and government buildings.' },
      function: 'Maintains HVAC, power, and life safety systems in critical facilities',
      dysregulation: 'HVAC failure in hospital, UPS failure in data center, life safety system malfunction',
      expectedTypes: [
        { type: 'Critical facility MEP contractor', reason: 'Mechanical, electrical, and plumbing for mission-critical buildings', confidence: 0.90 },
        { type: 'Building automation system vendor', reason: 'BAS/BMS for HVAC, lighting, and energy management', confidence: 0.85 },
        { type: 'Fire protection contractor', reason: 'Sprinkler, alarm, and suppression system design and installation', confidence: 0.82 }
      ]
    },
    'CAUD': {
      fullName: 'Caudate', label: 'Infrastructure Procurement & Contracting', tier: 'operational',
      neuroTranslation: { inNeurology: 'Part of the basal ganglia involved in goal-directed action selection and reward anticipation.', inBusiness: 'In infrastructure, this is procurement and contracting — the selection of contractors, vendors, and delivery methods that direct resources toward infrastructure goals.' },
      function: 'Manages contractor selection, bid evaluation, and procurement for infrastructure projects',
      dysregulation: 'Bid protest, contract dispute, cost overrun from poor procurement, sole-source dependency',
      expectedTypes: [
        { type: 'Construction procurement consultancy', reason: 'Best-value evaluation, DB/DBB/CMAR delivery method advisory', confidence: 0.85 },
        { type: 'E-procurement platform', reason: 'Digital bid management, vendor qualification, and compliance tracking', confidence: 0.82 },
        { type: 'Claims and dispute resolution firm', reason: 'Construction claims analysis, mediation, and arbitration', confidence: 0.78 }
      ]
    },
    'CLAUST': {
      fullName: 'Claustrum', label: 'Infrastructure Coordination Hub', tier: 'operational',
      neuroTranslation: { inNeurology: 'Thin sheet of neurons hypothesized to integrate information across cortical areas into unified conscious experience.', inBusiness: 'In infrastructure, this is the inter-agency coordination layer — joint utility coordination, one-call systems, and multi-agency project coordination.' },
      function: 'Coordinates multi-agency infrastructure projects and utility conflicts',
      dysregulation: 'Utility strike, uncoordinated construction, conflicting schedules between agencies',
      expectedTypes: [
        { type: 'Utility coordination service', reason: 'One-call/811 systems, SUE (subsurface utility engineering)', confidence: 0.88 },
        { type: 'Multi-agency project management firm', reason: 'Coordinates DOT, utility, and municipality work in shared corridors', confidence: 0.82 },
        { type: 'Conflict detection software vendor', reason: 'BIM-based clash detection for underground utilities and structures', confidence: 0.78 }
      ]
    },
    'CMZ': {
      fullName: 'Cerebellar Motor Zone', label: 'Heavy Equipment Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fine-tunes motor output for precision movement execution.', inBusiness: 'In infrastructure, this is heavy equipment operations — excavators, cranes, pile drivers, and earthmoving machinery that execute precise construction actions.' },
      function: 'Operates heavy construction equipment for earthwork, foundations, and structural erection',
      dysregulation: 'Equipment breakdown on critical path, operator shortage, safety incident',
      expectedTypes: [
        { type: 'Heavy equipment rental company', reason: 'Excavators, cranes, dozers, and loaders for infrastructure projects', confidence: 0.92 },
        { type: 'Crane and rigging contractor', reason: 'Heavy lift, structural steel erection, and bridge beam setting', confidence: 0.88 },
        { type: 'Pile driving contractor', reason: 'Foundation piles for bridges, wharves, and buildings', confidence: 0.82 }
      ]
    },
    'CON': {
      fullName: 'Cingulo-Opercular Network', label: 'Infrastructure Maintenance Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustains attention and task-set maintenance during prolonged operations.', inBusiness: 'In infrastructure, this is the sustained maintenance operations layer — routine maintenance crews, scheduled repairs, and preventive maintenance programs that keep infrastructure functional.' },
      function: 'Executes routine and preventive maintenance across infrastructure asset classes',
      dysregulation: 'Maintenance backlog growth, deferred repairs, crew shortage, missed inspection cycles',
      expectedTypes: [
        { type: 'Infrastructure maintenance contractor', reason: 'Roads, bridges, facilities, and utility routine maintenance', confidence: 0.92 },
        { type: 'Preventive maintenance software vendor', reason: 'CMMS and EAM platforms for infrastructure asset management', confidence: 0.85 },
        { type: 'Pavement maintenance contractor', reason: 'Crack sealing, chip seal, microsurfacing, and patching', confidence: 0.82 }
      ]
    },
    'DAN': {
      fullName: 'Dorsal Attention Network', label: 'Infrastructure Surveillance & Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Top-down voluntary attention directed toward selected stimuli.', inBusiness: 'In infrastructure, this is targeted surveillance and monitoring — CCTV, drone inspection, satellite imagery, and directed monitoring of specific infrastructure assets.' },
      function: 'Provides directed monitoring via CCTV, drones, LiDAR, and satellite imagery',
      dysregulation: 'Camera blind spots, inspection drone grounding, satellite imagery gaps',
      expectedTypes: [
        { type: 'Infrastructure inspection drone service', reason: 'Bridge, tower, pipeline, and roof inspection via UAS', confidence: 0.90 },
        { type: 'CCTV and surveillance integrator', reason: 'Video monitoring for tunnels, transit, and critical infrastructure', confidence: 0.85 },
        { type: 'Remote sensing and LiDAR vendor', reason: 'Aerial survey, terrain modeling, and change detection', confidence: 0.82 }
      ]
    },
    'DISS': {
      fullName: 'Dissolution', label: 'Infrastructure Decommissioning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Represents dissolution of coherent network states during altered consciousness.', inBusiness: 'In infrastructure, this is decommissioning — the planned retirement, demolition, and environmental remediation of end-of-life infrastructure.' },
      function: 'Manages demolition, decommissioning, and environmental remediation of retired infrastructure',
      dysregulation: 'Abandoned infrastructure, unaddressed contamination, incomplete demolition',
      expectedTypes: [
        { type: 'Demolition contractor', reason: 'Structural demolition, abatement, and site clearing', confidence: 0.90 },
        { type: 'Environmental remediation firm', reason: 'Brownfield cleanup, soil remediation, and groundwater treatment', confidence: 0.88 },
        { type: 'Asbestos and lead abatement contractor', reason: 'Hazardous material removal from aging infrastructure', confidence: 0.82 }
      ]
    },
    'DMN': {
      fullName: 'Default Mode Network', label: 'Infrastructure Long-Range Planning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Active during rest and self-referential thought — mental simulation and future planning.', inBusiness: 'In infrastructure, this is long-range planning — 20-year capital improvement programs, regional transportation plans, and infrastructure master plans.' },
      function: 'Develops long-range capital improvement programs and regional infrastructure plans',
      dysregulation: 'No long-range plan, reactive-only investment, planning-implementation disconnect',
      expectedTypes: [
        { type: 'Long-range transportation planning firm', reason: 'MPO plans, LRTP, and multimodal planning', confidence: 0.90 },
        { type: 'Capital improvement program consultancy', reason: 'CIP development, prioritization, and funding strategy', confidence: 0.88 },
        { type: 'Infrastructure master planning firm', reason: 'Water, sewer, stormwater, and facilities master plans', confidence: 0.85 }
      ]
    },
    'DV': {
      fullName: 'Dorsal Vagal', label: 'Infrastructure Shutdown & Isolation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Triggers freeze or shutdown response under extreme threat — conservation mode.', inBusiness: 'In infrastructure, this is controlled shutdown and isolation — lockout/tagout, system isolation, and controlled de-energization during emergencies or maintenance.' },
      function: 'Executes controlled shutdowns, lockout/tagout, and system isolation for safety',
      dysregulation: 'Failed isolation, energized-line contact, incomplete lockout, uncontrolled shutdown',
      expectedTypes: [
        { type: 'Safety lockout/tagout system vendor', reason: 'LOTO equipment, procedures, and compliance programs', confidence: 0.85 },
        { type: 'Valve and isolation equipment manufacturer', reason: 'Gate valves, butterfly valves, and pipeline isolation tools', confidence: 0.82 },
        { type: 'Industrial safety consultancy', reason: 'Confined space, de-energization, and isolation procedure development', confidence: 0.78 }
      ]
    },
    'EC': {
      fullName: 'Entorhinal Cortex', label: 'Infrastructure Spatial Mapping', tier: 'operational',
      neuroTranslation: { inNeurology: 'Gateway to hippocampus, contains grid cells for spatial navigation and mapping.', inBusiness: 'In infrastructure, this is spatial mapping and GIS — geographic information systems, asset mapping, and spatial databases that locate every infrastructure component.' },
      function: 'Maintains geospatial asset databases and infrastructure mapping systems',
      dysregulation: 'Inaccurate asset locations, missing GIS layers, spatial data gaps',
      expectedTypes: [
        { type: 'GIS services firm', reason: 'Infrastructure asset mapping, spatial database development', confidence: 0.90 },
        { type: 'Survey and geospatial technology vendor', reason: 'Total stations, GPS rovers, and mobile mapping systems', confidence: 0.85 },
        { type: 'Digital twin platform vendor', reason: 'Spatially accurate 3D models of infrastructure assets', confidence: 0.80 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Infrastructure Project Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Manages top-down cognitive control, decision-making, and executive functions.', inBusiness: 'In infrastructure, this is project management and program oversight — PMOs, delivery oversight, and executive decision-making for major capital programs.' },
      function: 'Manages project delivery, program oversight, and executive decision-making for capital programs',
      dysregulation: 'Schedule overrun, scope creep, cost escalation, delivery failure',
      expectedTypes: [
        { type: 'Program management firm', reason: 'Owner-side oversight of large infrastructure programs', confidence: 0.92 },
        { type: 'Project controls consultancy', reason: 'Earned value, scheduling, and cost estimating for infrastructure', confidence: 0.88 },
        { type: 'Construction scheduling software vendor', reason: 'Primavera, Microsoft Project, and BIM-integrated scheduling', confidence: 0.80 }
      ]
    },
    'EI': {
      fullName: 'Excitatory/Inhibitory Ratio', label: 'Infrastructure Load Balancing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Balance between excitatory and inhibitory neural signaling that maintains stable network function.', inBusiness: 'In infrastructure, this is load balancing — managing the balance between demand and capacity across power grids, water systems, and transportation networks.' },
      function: 'Balances demand against capacity across infrastructure networks',
      dysregulation: 'Demand exceeds capacity, load shedding, water pressure loss, traffic gridlock',
      expectedTypes: [
        { type: 'Demand response technology vendor', reason: 'Grid demand management, load curtailment, and peak shaving', confidence: 0.88 },
        { type: 'Capacity planning consultancy', reason: 'Forecasting infrastructure demand growth and capacity needs', confidence: 0.85 },
        { type: 'Network optimization software vendor', reason: 'Hydraulic modeling, traffic simulation, and grid dispatch optimization', confidence: 0.80 }
      ]
    },
    'EMP': {
      fullName: 'Empathy', label: 'Community Impact & Equity', tier: 'operational',
      neuroTranslation: { inNeurology: 'Neural basis of empathic response — understanding others\' experiences and states.', inBusiness: 'In infrastructure, this is community impact and equity — environmental justice analysis, public engagement, and equitable infrastructure investment.' },
      function: 'Ensures equitable infrastructure investment and community impact assessment',
      dysregulation: 'Environmental injustice, underserved communities, inadequate public engagement',
      expectedTypes: [
        { type: 'Environmental justice consultancy', reason: 'EJ analysis, Title VI compliance, and disparate impact assessment', confidence: 0.85 },
        { type: 'Public engagement platform', reason: 'Digital town halls, comment management, and stakeholder tracking', confidence: 0.80 },
        { type: 'Community benefit agreement specialist', reason: 'Local hire, DBE goals, and community mitigation agreements', confidence: 0.75 }
      ]
    },
    'ENDO': {
      fullName: 'Endocannabinoid', label: 'Infrastructure Stress Dampening', tier: 'operational',
      neuroTranslation: { inNeurology: 'Modulates synaptic transmission to dampen excessive neural activity and restore homeostasis.', inBusiness: 'In infrastructure, this is stress dampening — vibration isolation, surge protection, and systems that absorb transient overloads without failure.' },
      function: 'Provides vibration isolation, surge protection, and transient load absorption',
      dysregulation: 'Unprotected surge damage, undampened vibration fatigue, resonance failure',
      expectedTypes: [
        { type: 'Surge protection equipment vendor', reason: 'Lightning arresters, TVS devices, and power conditioning', confidence: 0.85 },
        { type: 'Vibration isolation system manufacturer', reason: 'Bearing pads, isolators, and dampers for bridges and buildings', confidence: 0.82 },
        { type: 'Seismic damper manufacturer', reason: 'Viscous dampers, tuned mass dampers, and base isolation systems', confidence: 0.78 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Infrastructure Pattern Recognition & AI', tier: 'operational',
      neuroTranslation: { inNeurology: 'Specialized for visual pattern recognition, especially faces and complex objects.', inBusiness: 'In infrastructure, this is pattern recognition and AI — machine learning for crack detection, pothole identification, vegetation encroachment, and anomaly detection.' },
      function: 'Applies machine vision and AI to detect infrastructure defects and anomalies',
      dysregulation: 'Missed defects, false positives overwhelming inspection crews, model drift',
      expectedTypes: [
        { type: 'AI infrastructure inspection vendor', reason: 'Machine vision for bridge crack, pothole, and corrosion detection', confidence: 0.88 },
        { type: 'Predictive maintenance AI platform', reason: 'ML models predicting equipment failure and asset deterioration', confidence: 0.85 },
        { type: 'Automated pavement condition survey vendor', reason: 'Vehicle-mounted cameras and AI for network-level PCI assessment', confidence: 0.82 }
      ]
    },
    'GABA_GLU': {
      fullName: 'GABA/Glutamate Balance', label: 'Infrastructure Safety Interlocks', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fundamental excitatory/inhibitory neurotransmitter balance controlling neural stability.', inBusiness: 'In infrastructure, these are safety interlocks — mechanical and electronic systems that prevent dangerous operations and enforce safe sequences.' },
      function: 'Enforces safety interlocks, fail-safes, and protective relay sequences',
      dysregulation: 'Interlock bypass, relay miscoordination, safety system defeat',
      expectedTypes: [
        { type: 'Protective relay manufacturer', reason: 'Overcurrent, differential, and distance relays for grid protection', confidence: 0.88 },
        { type: 'Safety interlock system vendor', reason: 'Railroad crossing gates, dam spillway interlocks, and elevator safeties', confidence: 0.85 },
        { type: 'Functional safety consultancy', reason: 'SIL assessment, safety instrumented system design, and SIS audit', confidence: 0.78 }
      ]
    },
    'GBA': {
      fullName: 'Gut-Brain Axis', label: 'Buried Infrastructure', tier: 'operational',
      neuroTranslation: { inNeurology: 'Bidirectional communication between gut microbiome and central nervous system.', inBusiness: 'In infrastructure, this is buried infrastructure — underground utilities, conduits, and tunnels that operate invisibly beneath the surface but are essential to function above.' },
      function: 'Manages underground utilities, conduits, and subsurface infrastructure',
      dysregulation: 'Unknown buried conflicts, sinkhole from utility failure, unlocatable infrastructure',
      expectedTypes: [
        { type: 'Subsurface utility engineering firm', reason: 'SUE quality level A-D investigation and designation', confidence: 0.90 },
        { type: 'Trenchless technology contractor', reason: 'Microtunneling, pipe jacking, and cured-in-place pipe lining', confidence: 0.88 },
        { type: 'Ground penetrating radar service', reason: 'GPR scanning for buried utilities and void detection', confidence: 0.82 }
      ]
    },
    'GP': {
      fullName: 'Globus Pallidus', label: 'Infrastructure Permitting & Approvals', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates voluntary movement by selecting which motor programs to inhibit or release.', inBusiness: 'In infrastructure, this is the permitting and approval gate — regulatory approvals that inhibit or release infrastructure projects for construction.' },
      function: 'Gates infrastructure projects through regulatory permits and agency approvals',
      dysregulation: 'Permit delay, regulatory conflict, environmental clearance blockage',
      expectedTypes: [
        { type: 'Environmental permitting consultancy', reason: 'NEPA, Section 404, ESA, and SHPO compliance', confidence: 0.90 },
        { type: 'Regulatory affairs firm', reason: 'FERC, PUC, and state DOT permitting and approvals', confidence: 0.85 },
        { type: 'Permit expediting service', reason: 'Accelerates building, grading, and utility permit processing', confidence: 0.78 }
      ]
    },
    'HAB': {
      fullName: 'Habenula', label: 'Infrastructure Lessons Learned', tier: 'operational',
      neuroTranslation: { inNeurology: 'Encodes negative outcomes and disappointment, suppressing unrewarding actions.', inBusiness: 'In infrastructure, this is lessons learned — post-construction reviews, failure investigations, and after-action reports that prevent repeating past mistakes.' },
      function: 'Captures failure investigations, after-action reports, and post-project reviews',
      dysregulation: 'Repeated design errors, ignored failure reports, no institutional learning',
      expectedTypes: [
        { type: 'Forensic engineering firm', reason: 'Structural failure investigation, root cause analysis, and expert testimony', confidence: 0.90 },
        { type: 'After-action review facilitator', reason: 'Post-incident and post-project lessons learned capture', confidence: 0.80 },
        { type: 'Infrastructure failure database operator', reason: 'NTSB, ASCE failure case studies, and near-miss databases', confidence: 0.72 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Infrastructure Asset Records', tier: 'operational',
      neuroTranslation: { inNeurology: 'Forms and consolidates new memories into long-term storage.', inBusiness: 'In infrastructure, this is asset records — as-built drawings, maintenance histories, and asset management databases that constitute the institutional memory of infrastructure.' },
      function: 'Stores as-built drawings, maintenance histories, and lifecycle records for all infrastructure assets',
      dysregulation: 'Lost as-builts, incomplete maintenance records, unknown asset condition',
      expectedTypes: [
        { type: 'Asset management system vendor', reason: 'EAM, CMMS, and infrastructure asset registry platforms', confidence: 0.92 },
        { type: 'As-built documentation service', reason: 'Record drawings, laser scanning, and as-built verification', confidence: 0.85 },
        { type: 'Document management platform', reason: 'Engineering document control, version management, and retrieval', confidence: 0.80 }
      ]
    },
    'HPA': {
      fullName: 'HPA Axis', label: 'Infrastructure Stress Response Governance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Hypothalamic-pituitary-adrenal axis — the sustained stress response system.', inBusiness: 'In infrastructure, this is the governance framework for sustained stress — emergency management agencies, incident command systems, and continuity of operations planning.' },
      function: 'Governs sustained emergency response, incident command, and continuity of operations',
      dysregulation: 'Uncoordinated emergency response, COOP plan gaps, incident command breakdown',
      expectedTypes: [
        { type: 'Emergency management consultancy', reason: 'EOP development, ICS training, and COOP planning', confidence: 0.88 },
        { type: 'Incident command system vendor', reason: 'ICS software, resource tracking, and situation reporting', confidence: 0.85 },
        { type: 'Continuity of operations planner', reason: 'COOP, essential functions, and alternate facility planning', confidence: 0.80 }
      ]
    },
    'IC': {
      fullName: 'Inferior Colliculus', label: 'Infrastructure Acoustic Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Subcortical auditory processing relay — processes sound localization and frequency.', inBusiness: 'In infrastructure, this is acoustic monitoring — leak detection via acoustic sensors, machinery health via vibration analysis, and pipeline monitoring.' },
      function: 'Detects infrastructure faults via acoustic emission, leak detection, and vibration analysis',
      dysregulation: 'Undetected leaks, missed bearing failure, acoustic sensor gap',
      expectedTypes: [
        { type: 'Acoustic leak detection vendor', reason: 'Correlating loggers and acoustic sensors for water and gas mains', confidence: 0.88 },
        { type: 'Machinery vibration analysis service', reason: 'Pump, motor, and turbine condition monitoring via vibration', confidence: 0.85 },
        { type: 'Acoustic emission testing firm', reason: 'AE testing for pressure vessels, bridges, and storage tanks', confidence: 0.78 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Infrastructure Quantity & Cost Estimation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes numerical magnitude and spatial quantities.', inBusiness: 'In infrastructure, this is quantity takeoff and cost estimation — measuring volumes, areas, and counts to produce accurate infrastructure cost estimates.' },
      function: 'Produces quantity takeoffs, cost estimates, and budget forecasts for infrastructure',
      dysregulation: 'Inaccurate estimates, cost overruns, bid blowouts',
      expectedTypes: [
        { type: 'Cost estimation consultancy', reason: 'Parametric, detailed, and lifecycle cost estimating for infrastructure', confidence: 0.90 },
        { type: 'Quantity takeoff software vendor', reason: 'BIM-based and plan-based quantity extraction tools', confidence: 0.85 },
        { type: 'Value engineering firm', reason: 'Function analysis, cost reduction, and design optimization', confidence: 0.80 }
      ]
    },
    'LAR': {
      fullName: 'Laryngeal', label: 'Infrastructure Public Communication', tier: 'operational',
      neuroTranslation: { inNeurology: 'Controls laryngeal muscles for voice production.', inBusiness: 'In infrastructure, this is public communication — public notices, construction alerts, and stakeholder communications about infrastructure projects and disruptions.' },
      function: 'Issues public notices, construction alerts, and stakeholder communications',
      dysregulation: 'Surprised communities, inadequate notice of disruption, communication gap',
      expectedTypes: [
        { type: 'Public affairs and outreach firm', reason: 'Construction impact communications and community liaison', confidence: 0.85 },
        { type: 'Construction notification platform', reason: 'Automated alerts for lane closures, utility shutoffs, and detours', confidence: 0.80 },
        { type: 'Stakeholder management software vendor', reason: 'Contact databases, comment tracking, and response management', confidence: 0.75 }
      ]
    },
    'LC': {
      fullName: 'Locus Coeruleus', label: 'Infrastructure Alert & Alarm Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary norepinephrine source — modulates arousal, vigilance, and attention.', inBusiness: 'In infrastructure, this is the alert and alarm layer — SCADA alarms, seismic early warning, flood alerts, and infrastructure health alarms that trigger attention.' },
      function: 'Triggers infrastructure alerts, SCADA alarms, and early warning notifications',
      dysregulation: 'Alarm fatigue, missed critical alerts, false alarm overload',
      expectedTypes: [
        { type: 'SCADA alarm management vendor', reason: 'Alarm rationalization, prioritization, and state-based alarming', confidence: 0.88 },
        { type: 'Early warning system provider', reason: 'Seismic, flood, and severe weather early warning for infrastructure', confidence: 0.85 },
        { type: 'Infrastructure health alarm platform', reason: 'Threshold-based alerts from structural and utility monitoring sensors', confidence: 0.80 }
      ]
    },
    'LGN': {
      fullName: 'Lateral Geniculate Nucleus', label: 'Infrastructure Visual Inspection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary relay for visual information from retina to visual cortex.', inBusiness: 'In infrastructure, this is visual inspection — the first-pass visual assessment of infrastructure condition by inspectors, cameras, and imaging systems.' },
      function: 'Provides visual inspection of infrastructure via field inspectors and imaging systems',
      dysregulation: 'Missed visual defects, inadequate inspection frequency, image quality failure',
      expectedTypes: [
        { type: 'Infrastructure inspection firm', reason: 'Visual bridge, tunnel, dam, and facility inspection services', confidence: 0.92 },
        { type: 'Inspection camera and imaging vendor', reason: 'Sewer CCTV, borescopes, and high-resolution inspection cameras', confidence: 0.85 },
        { type: 'Inspection management platform', reason: 'Digital inspection forms, photo documentation, and defect tracking', confidence: 0.80 }
      ]
    },
    'MAMM': {
      fullName: 'Mammillary Bodies', label: 'Infrastructure Historical Archives', tier: 'operational',
      neuroTranslation: { inNeurology: 'Part of the Papez memory circuit — relays hippocampal memory output.', inBusiness: 'In infrastructure, this is historical archives — original design plans, historical load data, and archival records that inform rehabilitation and assessment.' },
      function: 'Preserves original design documents, historical load data, and archival infrastructure records',
      dysregulation: 'Lost original plans, unavailable historical records, incomplete archive',
      expectedTypes: [
        { type: 'Engineering document archival service', reason: 'Digitization, indexing, and preservation of infrastructure records', confidence: 0.82 },
        { type: 'Historical infrastructure assessment firm', reason: 'Determines original design capacity from archival plans and load tests', confidence: 0.78 },
        { type: 'Records management platform', reason: 'Cloud-based archival with version tracking and retrieval', confidence: 0.75 }
      ]
    },
    'MDT': {
      fullName: 'Mediodorsal Thalamus', label: 'Infrastructure Decision Support', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays information to prefrontal cortex for higher-order decision-making.', inBusiness: 'In infrastructure, this is decision support — dashboards, analytics, and modeling tools that inform infrastructure investment and operations decisions.' },
      function: 'Provides analytics dashboards and modeling tools for infrastructure decisions',
      dysregulation: 'Decisions without data, model mismatch, dashboard overload',
      expectedTypes: [
        { type: 'Infrastructure analytics platform', reason: 'Asset condition scoring, risk prioritization, and investment modeling', confidence: 0.88 },
        { type: 'Transportation modeling firm', reason: 'Travel demand, microsimulation, and corridor analysis', confidence: 0.85 },
        { type: 'Hydraulic and hydrologic modeling firm', reason: 'Stormwater, floodplain, and water system modeling', confidence: 0.82 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Infrastructure Telemetry', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays auditory information from inferior colliculus to auditory cortex.', inBusiness: 'In infrastructure, this is telemetry — real-time data streaming from field sensors to operations centers for water, power, and transportation systems.' },
      function: 'Streams real-time sensor data from infrastructure assets to operations centers',
      dysregulation: 'Telemetry gap, data latency, sensor communication failure',
      expectedTypes: [
        { type: 'Telemetry system integrator', reason: 'Radio, cellular, and satellite telemetry for remote infrastructure', confidence: 0.88 },
        { type: 'RTU and PLC manufacturer', reason: 'Remote terminal units and programmable controllers for SCADA', confidence: 0.85 },
        { type: 'IoT connectivity platform', reason: 'LoRaWAN, NB-IoT, and cellular modules for infrastructure sensors', confidence: 0.78 }
      ]
    },
    'MICRO': {
      fullName: 'Microbiome', label: 'Soil & Subsurface Conditions', tier: 'operational',
      neuroTranslation: { inNeurology: 'Trillions of organisms in the gut affecting neural function through metabolic and immune pathways.', inBusiness: 'In infrastructure, this is soil and subsurface conditions — the unseen ground conditions that determine foundation design, settlement, and infrastructure durability.' },
      function: 'Characterizes soil, rock, and groundwater conditions for infrastructure foundations',
      dysregulation: 'Unexpected soil conditions, foundation settlement, groundwater intrusion',
      expectedTypes: [
        { type: 'Geotechnical engineering firm', reason: 'Boring, lab testing, foundation design, and slope stability analysis', confidence: 0.95 },
        { type: 'Environmental site assessment firm', reason: 'Phase I/II ESA, soil and groundwater contamination investigation', confidence: 0.88 },
        { type: 'Soil testing laboratory', reason: 'Proctor, gradation, Atterberg limits, and bearing capacity testing', confidence: 0.82 }
      ]
    },
    'NAcc': {
      fullName: 'Nucleus Accumbens', label: 'Infrastructure Incentive Programs', tier: 'operational',
      neuroTranslation: { inNeurology: 'Core of the reward circuit — drives motivated behavior toward desirable outcomes.', inBusiness: 'In infrastructure, these are incentive programs — tax credits, accelerated permitting, P3 structures, and grant programs that motivate infrastructure investment.' },
      function: 'Administers incentive programs that motivate private and public infrastructure investment',
      dysregulation: 'Misaligned incentives, grant fraud, incentive-driven overbuilding',
      expectedTypes: [
        { type: 'P3 advisory firm', reason: 'Public-private partnership structuring and transaction advisory', confidence: 0.90 },
        { type: 'Grant writing and administration firm', reason: 'Federal infrastructure grant applications and compliance', confidence: 0.88 },
        { type: 'Tax incentive consultancy', reason: 'Opportunity zones, NMTC, TIFIA, and infrastructure tax credits', confidence: 0.82 }
      ]
    },
    'NBM': {
      fullName: 'Nucleus Basalis of Meynert', label: 'Infrastructure Workforce Development', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary source of cortical acetylcholine supporting attention and learning.', inBusiness: 'In infrastructure, this is workforce development — apprenticeship programs, skilled trades training, and workforce pipelines for construction and operations.' },
      function: 'Develops skilled workforce through apprenticeships, trade schools, and certification programs',
      dysregulation: 'Skilled labor shortage, aging workforce, inadequate training pipeline',
      expectedTypes: [
        { type: 'Construction trades apprenticeship program', reason: 'Electrician, ironworker, pipefitter, and operator training', confidence: 0.88 },
        { type: 'Workforce development platform', reason: 'Credentialing, skills tracking, and job matching for infrastructure trades', confidence: 0.82 },
        { type: 'Heavy equipment operator training school', reason: 'NCCER-certified equipment operation and safety training', confidence: 0.78 }
      ]
    },
    'NEOCER': {
      fullName: 'Neocerebellum', label: 'Infrastructure Quality Control', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in cognitive functions, planning, and error correction beyond motor coordination.', inBusiness: 'In infrastructure, this is quality control — QA/QC programs, materials testing, and workmanship inspection that catch errors before they become failures.' },
      function: 'Executes quality assurance and quality control for infrastructure construction and materials',
      dysregulation: 'Defective construction, failed materials, inspection shortcut, rework',
      expectedTypes: [
        { type: 'Construction quality assurance firm', reason: 'Independent QA observation, documentation review, and audit', confidence: 0.90 },
        { type: 'Materials testing laboratory', reason: 'Concrete, asphalt, steel, and soil testing for construction compliance', confidence: 0.92 },
        { type: 'Non-destructive testing service', reason: 'Ultrasonic, radiographic, and magnetic particle testing of welds and structures', confidence: 0.85 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Infrastructure Investment Valuation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Assigns value to choices and outcomes — integrates reward information for decision-making.', inBusiness: 'In infrastructure, this is investment valuation — benefit-cost analysis, lifecycle cost analysis, and economic justification of infrastructure spending.' },
      function: 'Conducts benefit-cost analysis and economic justification for infrastructure investments',
      dysregulation: 'Unjustified investments, ignored lifecycle costs, benefit inflation',
      expectedTypes: [
        { type: 'Infrastructure economics consultancy', reason: 'BCA, lifecycle cost analysis, and economic impact assessment', confidence: 0.90 },
        { type: 'Municipal finance advisory', reason: 'Bond issuance, infrastructure financing, and revenue forecasting', confidence: 0.88 },
        { type: 'Asset valuation firm', reason: 'Replacement cost, depreciated value, and fair market value for infrastructure', confidence: 0.82 }
      ]
    },
    'OLF': {
      fullName: 'Olfactory', label: 'Environmental Monitoring & Air Quality', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes smell — detects airborne chemical signals from the environment.', inBusiness: 'In infrastructure, this is environmental monitoring — air quality, emissions, and fugitive gas detection around infrastructure sites.' },
      function: 'Monitors air quality, emissions, and fugitive gases at infrastructure sites',
      dysregulation: 'Undetected gas leak, air quality exceedance, odor complaints',
      expectedTypes: [
        { type: 'Air quality monitoring vendor', reason: 'Ambient monitors, fence-line systems, and regulatory compliance', confidence: 0.85 },
        { type: 'Fugitive emission detection service', reason: 'Optical gas imaging, LDAR, and methane detection', confidence: 0.82 },
        { type: 'Environmental compliance consultancy', reason: 'Air permits, Title V, and NAAQS compliance for infrastructure', confidence: 0.78 }
      ]
    },
    'OPIOID': {
      fullName: 'Opioid System', label: 'Infrastructure Pain-Point Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Endogenous pain modulation system that suppresses acute pain signals.', inBusiness: 'In infrastructure, this is bottleneck and pain-point resolution — targeted fixes for the most acute operational problems affecting service delivery.' },
      function: 'Identifies and resolves the most acute operational bottlenecks and service failures',
      dysregulation: 'Chronic unresolved bottlenecks, complaint-driven patching, no root cause resolution',
      expectedTypes: [
        { type: 'Infrastructure troubleshooting contractor', reason: 'Rapid-response repair for acute infrastructure failures', confidence: 0.85 },
        { type: 'Operations improvement consultancy', reason: 'Root cause analysis and operational efficiency for utilities and transit', confidence: 0.82 },
        { type: 'Customer complaint analytics platform', reason: 'Service request pattern analysis to identify infrastructure pain points', confidence: 0.75 }
      ]
    },
    'OSC': {
      fullName: 'Oscillatory', label: 'Infrastructure Rhythmic Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Neural oscillations synchronize activity across brain regions at specific frequencies.', inBusiness: 'In infrastructure, this is rhythmic operations — traffic signal timing, train scheduling, utility cycling, and seasonal maintenance schedules that synchronize infrastructure activity.' },
      function: 'Synchronizes signal timing, train schedules, maintenance cycles, and seasonal operations',
      dysregulation: 'Signal timing desynchronization, scheduling conflict, maintenance cycle drift',
      expectedTypes: [
        { type: 'Traffic signal timing consultancy', reason: 'Arterial coordination, adaptive signal control, and cycle optimization', confidence: 0.88 },
        { type: 'Transit scheduling software vendor', reason: 'Timetabling, crew scheduling, and vehicle assignment', confidence: 0.85 },
        { type: 'Seasonal maintenance planning firm', reason: 'Snow/ice operations, vegetation management, and sweeping programs', confidence: 0.78 }
      ]
    },
    'OXY': {
      fullName: 'Oxytocin', label: 'Infrastructure Partnerships & Cooperation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Promotes social bonding, trust, and cooperative behavior.', inBusiness: 'In infrastructure, this is partnerships and cooperation — intergovernmental agreements, joint powers authorities, and cooperative procurement for infrastructure.' },
      function: 'Facilitates intergovernmental agreements and cooperative infrastructure delivery',
      dysregulation: 'Inter-agency conflict, failed joint ventures, cooperative agreement collapse',
      expectedTypes: [
        { type: 'Intergovernmental relations consultancy', reason: 'MOUs, IGAs, and joint powers authority formation', confidence: 0.82 },
        { type: 'Cooperative procurement platform', reason: 'Shared contracts, piggyback purchasing, and consortium buying', confidence: 0.78 },
        { type: 'P3 transaction advisory', reason: 'Public-private partnership deal structuring and negotiation', confidence: 0.85 }
      ]
    },
    'PAG': {
      fullName: 'Periaqueductal Gray', label: 'Infrastructure Hazard Response', tier: 'operational',
      neuroTranslation: { inNeurology: 'Coordinates defensive responses — fight, flight, freeze — and pain modulation under threat.', inBusiness: 'In infrastructure, this is hazard response — the immediate reaction to infrastructure emergencies including gas leaks, structural collapse, and utility failures.' },
      function: 'Coordinates immediate response to infrastructure emergencies and hazardous conditions',
      dysregulation: 'Delayed hazard response, wrong response to threat type, response crew unavailability',
      expectedTypes: [
        { type: 'Emergency repair contractor', reason: 'Immediate response for gas leaks, main breaks, and structural collapse', confidence: 0.92 },
        { type: 'Hazardous materials response team', reason: 'HazMat containment and cleanup for infrastructure incidents', confidence: 0.88 },
        { type: 'Structural emergency shoring vendor', reason: 'Emergency shoring, bracing, and temporary support systems', confidence: 0.82 }
      ]
    },
    'PBN': {
      fullName: 'Parabrachial Nucleus', label: 'Infrastructure Comfort & Habitability', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays visceral sensory information about temperature, taste, and pain to higher centers.', inBusiness: 'In infrastructure, this is comfort and habitability — building HVAC comfort, streetscape quality, and pedestrian environment that make infrastructure livable.' },
      function: 'Ensures thermal comfort, air quality, and livability in and around infrastructure',
      dysregulation: 'Uncomfortable buildings, hostile pedestrian environments, poor indoor air quality',
      expectedTypes: [
        { type: 'HVAC design and commissioning firm', reason: 'Thermal comfort design, air balancing, and building commissioning', confidence: 0.85 },
        { type: 'Streetscape design firm', reason: 'Pedestrian amenities, shade, seating, and walkability improvements', confidence: 0.80 },
        { type: 'Indoor air quality consultancy', reason: 'IAQ testing, mold investigation, and ventilation assessment', confidence: 0.78 }
      ]
    },
    'PCC': {
      fullName: 'Posterior Cingulate Cortex', label: 'Infrastructure Performance Benchmarking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Part of the default mode network — involved in self-referential processing and internal evaluation.', inBusiness: 'In infrastructure, this is performance benchmarking — comparing infrastructure performance against national standards, peer agencies, and self-historical trends.' },
      function: 'Benchmarks infrastructure performance against national standards and peer agencies',
      dysregulation: 'No performance baseline, unmeasured deterioration, self-congratulatory reporting',
      expectedTypes: [
        { type: 'Infrastructure benchmarking consultancy', reason: 'ASCE report card analysis, peer comparison, and KPI development', confidence: 0.85 },
        { type: 'Performance measurement platform', reason: 'Dashboard KPIs, trend tracking, and target-vs-actual reporting', confidence: 0.82 },
        { type: 'National performance standard organization', reason: 'GASB 34, MAP-21, and TAMP compliance reporting', confidence: 0.75 }
      ]
    },
    'PI': {
      fullName: 'Posterior Insula', label: 'Infrastructure Damage Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes pain and bodily damage signals from peripheral nerves.', inBusiness: 'In infrastructure, this is damage detection — identifying physical damage from impacts, overloads, weather events, and wear before failure occurs.' },
      function: 'Detects physical damage from impacts, overloads, and environmental exposure',
      dysregulation: 'Undetected impact damage, hidden corrosion, missed fatigue cracking',
      expectedTypes: [
        { type: 'Post-event damage assessment firm', reason: 'Rapid damage assessment after earthquakes, floods, and storms', confidence: 0.90 },
        { type: 'Corrosion detection and protection vendor', reason: 'Cathodic protection, coating inspection, and corrosion mapping', confidence: 0.85 },
        { type: 'Impact damage forensics firm', reason: 'Vehicle strike, vessel allision, and overheight hit analysis', confidence: 0.78 }
      ]
    },
    'PIN': {
      fullName: 'Pineal', label: 'Infrastructure Lifecycle Timing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Produces melatonin regulating circadian rhythm and seasonal timing.', inBusiness: 'In infrastructure, this is lifecycle timing — asset useful life estimation, replacement scheduling, and optimal timing for rehabilitation versus replacement decisions.' },
      function: 'Determines optimal timing for infrastructure rehabilitation, replacement, and retirement',
      dysregulation: 'Premature replacement, deferred replacement past useful life, timing mismatch',
      expectedTypes: [
        { type: 'Asset lifecycle consultancy', reason: 'Remaining useful life estimation and replacement optimization', confidence: 0.88 },
        { type: 'Pavement management system vendor', reason: 'PCI deterioration curves and optimal treatment timing', confidence: 0.85 },
        { type: 'Infrastructure depreciation specialist', reason: 'GASB 34 depreciation, condition-based accounting, and asset valuation', confidence: 0.78 }
      ]
    },
    'PIT': {
      fullName: 'Pituitary', label: 'Infrastructure Funding Release', tier: 'operational',
      neuroTranslation: { inNeurology: 'Master gland releasing hormones that trigger downstream endocrine cascades.', inBusiness: 'In infrastructure, this is funding release — the appropriations, bond sales, and grant disbursements that trigger downstream construction and procurement activity.' },
      function: 'Releases capital through appropriations, bond sales, and grant disbursements',
      dysregulation: 'Funding delay, sequestration, bond market disruption, grant disbursement failure',
      expectedTypes: [
        { type: 'Municipal bond underwriter', reason: 'Infrastructure revenue and GO bond issuance and marketing', confidence: 0.90 },
        { type: 'Federal grant administration firm', reason: 'FHWA, FTA, EPA, and FEMA grant drawdown and compliance', confidence: 0.88 },
        { type: 'Infrastructure finance advisory', reason: 'TIFIA, WIFIA, SRF, and innovative finance structuring', confidence: 0.85 }
      ]
    },
    'PPN': {
      fullName: 'Pedunculopontine Nucleus', label: 'Infrastructure Activation & Startup', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in initiation of movement and locomotion — activates motor programs.', inBusiness: 'In infrastructure, this is project activation and startup — commissioning, ribbon-cutting, and the transition from construction to operations.' },
      function: 'Commissions new infrastructure and transitions projects from construction to operations',
      dysregulation: 'Commissioning failure, operations unready at completion, punchlist overrun',
      expectedTypes: [
        { type: 'Commissioning agent', reason: 'Building, utility, and system commissioning and functional testing', confidence: 0.90 },
        { type: 'Startup and turnover consultancy', reason: 'Transition planning from construction to O&M for infrastructure', confidence: 0.85 },
        { type: 'Punchlist management platform', reason: 'Deficiency tracking, closeout documentation, and warranty management', confidence: 0.78 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Infrastructure Self-Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in self-awareness, mental imagery, and episodic memory retrieval.', inBusiness: 'In infrastructure, this is organizational self-assessment — agency capability reviews, maturity models, and self-evaluation of infrastructure management practices.' },
      function: 'Evaluates organizational capability and infrastructure management maturity',
      dysregulation: 'No self-assessment, blind spots in organizational capability, maturity stagnation',
      expectedTypes: [
        { type: 'Infrastructure management maturity assessor', reason: 'ISO 55000, TAMP, and asset management maturity evaluation', confidence: 0.85 },
        { type: 'Organizational capability consultancy', reason: 'Staffing analysis, competency mapping, and capacity assessment', confidence: 0.80 },
        { type: 'Peer review facilitator', reason: 'FHWA peer exchange, agency-to-agency best practice sharing', confidence: 0.75 }
      ]
    },
    'PULV': {
      fullName: 'Pulvinar', label: 'Infrastructure Situational Awareness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Largest thalamic nucleus — involved in visual attention and filtering relevant stimuli.', inBusiness: 'In infrastructure, this is situational awareness — operations center displays, common operating pictures, and real-time infrastructure status boards.' },
      function: 'Provides real-time situational awareness through operations center displays and dashboards',
      dysregulation: 'Information overload, stale displays, no common operating picture',
      expectedTypes: [
        { type: 'Operations center display integrator', reason: 'Video walls, GIS displays, and common operating picture systems', confidence: 0.88 },
        { type: 'Real-time status dashboard vendor', reason: 'Infrastructure health dashboards for water, power, and transit', confidence: 0.85 },
        { type: 'Situation awareness software platform', reason: 'Multi-source data fusion and anomaly highlighting', confidence: 0.80 }
      ]
    },
    'PUT': {
      fullName: 'Putamen', label: 'Infrastructure Construction Execution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Part of the basal ganglia involved in learning and executing habitual motor sequences.', inBusiness: 'In infrastructure, this is the execution of construction sequences — the habitual processes of earthwork, forming, pouring, erecting, and finishing that build infrastructure.' },
      function: 'Executes repetitive construction sequences: earthwork, forming, pouring, and finishing',
      dysregulation: 'Construction sequence error, forming failure, cold joint, improper compaction',
      expectedTypes: [
        { type: 'Concrete contractor', reason: 'Formwork, reinforcement, placement, and finishing for structures', confidence: 0.92 },
        { type: 'Earthwork contractor', reason: 'Mass grading, embankment, and subgrade preparation', confidence: 0.90 },
        { type: 'Structural steel erector', reason: 'Steel frame, connection, and deck installation', confidence: 0.85 }
      ]
    },
    'RAPHE': {
      fullName: 'Raphe Nuclei', label: 'Infrastructure Mood & Service Quality', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary source of serotonin — modulates mood, sleep, and emotional regulation.', inBusiness: 'In infrastructure, this is service quality and user experience — the overall quality of infrastructure service delivery as experienced by users.' },
      function: 'Measures and improves user experience and service quality across infrastructure',
      dysregulation: 'Declining service quality, user dissatisfaction, poor ride quality, unreliable service',
      expectedTypes: [
        { type: 'Infrastructure user experience consultancy', reason: 'Customer satisfaction surveys, service level assessment, and UX design', confidence: 0.82 },
        { type: 'Ride quality measurement vendor', reason: 'Inertial profiler, IRI measurement, and ride index reporting', confidence: 0.80 },
        { type: 'Service reliability analytics platform', reason: 'On-time performance, outage tracking, and reliability metrics', confidence: 0.78 }
      ]
    },
    'RF': {
      fullName: 'Reticular Formation', label: 'Infrastructure Alertness & Readiness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Maintains wakefulness and arousal — the brain\'s alertness system.', inBusiness: 'In infrastructure, this is operational readiness — the state of preparedness of maintenance crews, spare parts inventory, and emergency response capability.' },
      function: 'Maintains operational readiness of crews, equipment, and spare parts for rapid response',
      dysregulation: 'Unprepared crews, depleted spare parts, slow mobilization',
      expectedTypes: [
        { type: 'Spare parts inventory management vendor', reason: 'Warehouse management, reorder triggers, and parts forecasting', confidence: 0.85 },
        { type: 'Workforce scheduling platform', reason: 'Crew rostering, on-call management, and shift optimization', confidence: 0.82 },
        { type: 'Emergency preparedness contractor', reason: 'Pre-positioned materials, staged equipment, and readiness drills', confidence: 0.78 }
      ]
    },
    'RSC': {
      fullName: 'Retrosplenial Cortex', label: 'Infrastructure Wayfinding & Navigation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports spatial orientation and the transition between egocentric and allocentric reference frames.', inBusiness: 'In infrastructure, this is wayfinding and navigation — signage, pavement markings, and navigation systems that help users orient within infrastructure networks.' },
      function: 'Provides signage, pavement markings, and navigation aids across infrastructure networks',
      dysregulation: 'Confusing signage, faded markings, GPS dead zones, wayfinding failure',
      expectedTypes: [
        { type: 'Highway sign manufacturer', reason: 'Overhead, roadside, and variable message sign fabrication', confidence: 0.88 },
        { type: 'Pavement marking contractor', reason: 'Thermoplastic, paint, and retroreflective marking application', confidence: 0.85 },
        { type: 'Wayfinding design consultancy', reason: 'Airport, transit, and campus wayfinding system design', confidence: 0.78 }
      ]
    },
    'S1': {
      fullName: 'Primary Somatosensory Cortex', label: 'Infrastructure Sensor Networks', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes tactile, pressure, temperature, and pain signals from the body surface.', inBusiness: 'In infrastructure, this is the sensor network layer — strain gauges, temperature sensors, pressure transducers, and flow meters that give infrastructure its sense of touch.' },
      function: 'Deploys pressure, temperature, flow, and strain sensors across infrastructure assets',
      dysregulation: 'Sensor failure, uncalibrated instruments, data gaps',
      expectedTypes: [
        { type: 'Infrastructure sensor manufacturer', reason: 'Strain gauges, pressure transducers, flow meters, and level sensors', confidence: 0.90 },
        { type: 'Instrumentation and calibration service', reason: 'Field calibration, sensor replacement, and data validation', confidence: 0.85 },
        { type: 'Environmental sensor vendor', reason: 'Weather stations, water quality probes, and air monitors for infrastructure', confidence: 0.80 }
      ]
    },
    'SC': {
      fullName: 'Superior Colliculus', label: 'Infrastructure Rapid Visual Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes rapid visual orienting and reflexive gaze shifts toward salient stimuli.', inBusiness: 'In infrastructure, this is rapid visual assessment — windshield surveys, rapid condition ratings, and quick-look evaluations that triage infrastructure needs.' },
      function: 'Performs rapid condition surveys and triage assessments across infrastructure networks',
      dysregulation: 'Overlooked defects during rapid surveys, inconsistent rating, survey gaps',
      expectedTypes: [
        { type: 'Windshield survey service', reason: 'Network-level rapid condition assessment for roads and facilities', confidence: 0.85 },
        { type: 'Mobile data collection platform', reason: 'Tablet and vehicle-mounted rapid field data capture', confidence: 0.82 },
        { type: 'Condition rating training provider', reason: 'NBI, NBIS, and HPMS condition rating consistency training', confidence: 0.75 }
      ]
    },
    'SEPT': {
      fullName: 'Septal Nuclei', label: 'Infrastructure Comfort & Safety Zones', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in pleasure, reward, and suppression of fear responses.', inBusiness: 'In infrastructure, this is safety zones and comfort infrastructure — rest areas, service plazas, weigh stations, and safe harbor areas that provide relief along transportation networks.' },
      function: 'Provides rest areas, service plazas, weigh stations, and refuge areas along networks',
      dysregulation: 'Closed rest areas, overloaded weigh stations, unsafe refuge points',
      expectedTypes: [
        { type: 'Rest area and service plaza operator', reason: 'Highway rest area facilities, fuel, and traveler services', confidence: 0.85 },
        { type: 'Weigh station technology vendor', reason: 'Weigh-in-motion, PrePass, and commercial vehicle screening', confidence: 0.82 },
        { type: 'Roadside safety device manufacturer', reason: 'Guardrail, attenuators, cable barriers, and rumble strips', confidence: 0.88 }
      ]
    },
    'SMA': {
      fullName: 'Supplementary Motor Area', label: 'Infrastructure Pre-Construction Planning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Plans complex motor sequences before M1 executes them.', inBusiness: 'In infrastructure, this is pre-construction planning — constructability review, staging plans, traffic control plans, and sequence planning before construction begins.' },
      function: 'Plans construction sequencing, staging, traffic control, and constructability before execution',
      dysregulation: 'Poorly planned construction sequence, inadequate staging, traffic control failure',
      expectedTypes: [
        { type: 'Constructability review firm', reason: 'Pre-bid and pre-construction constructability analysis', confidence: 0.88 },
        { type: 'Traffic control design firm', reason: 'MOT plans, detour routing, and work zone traffic management', confidence: 0.85 },
        { type: 'Construction staging planner', reason: 'Site logistics, laydown areas, and phasing plans', confidence: 0.80 }
      ]
    },
    'SMN': {
      fullName: 'Somatomotor Network', label: 'Infrastructure Field Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrates somatosensory input with motor output for coordinated body movement.', inBusiness: 'In infrastructure, this is field operations — the coordinated deployment of crews, equipment, and materials to execute infrastructure work in the field.' },
      function: 'Coordinates field crew deployment, equipment logistics, and material delivery',
      dysregulation: 'Crew-equipment mismatch, material delivery failure, uncoordinated field ops',
      expectedTypes: [
        { type: 'Field operations management platform', reason: 'Digital work orders, crew tracking, and field reporting', confidence: 0.88 },
        { type: 'Material logistics service', reason: 'Just-in-time material delivery and staging for construction', confidence: 0.82 },
        { type: 'Construction labor staffing firm', reason: 'Temporary skilled labor placement for infrastructure projects', confidence: 0.78 }
      ]
    },
    'SN': {
      fullName: 'Salience Network', label: 'Infrastructure Priority Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects and filters salient events, switching attention between internal and external stimuli.', inBusiness: 'In infrastructure, this is priority detection — identifying which infrastructure needs are most urgent and switching resources from routine to emergency mode.' },
      function: 'Identifies the most urgent infrastructure needs and triggers resource reallocation',
      dysregulation: 'Misidentified priorities, overreaction to minor issues, missed critical failures',
      expectedTypes: [
        { type: 'Infrastructure priority scoring platform', reason: 'Risk-based prioritization for bridge, pavement, and utility programs', confidence: 0.88 },
        { type: 'Emergency resource allocation system', reason: 'Dynamic crew and equipment reassignment during incidents', confidence: 0.85 },
        { type: 'Condition-based priority consultancy', reason: 'Worst-first vs. optimal timing analysis for infrastructure programs', confidence: 0.80 }
      ]
    },
    'SNIG': {
      fullName: 'Substantia Nigra', label: 'Infrastructure Energy Supply', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary source of dopamine to the striatum — essential for initiating voluntary movement.', inBusiness: 'In infrastructure, this is the energy supply layer — fuel, electricity, and power that infrastructure systems themselves consume to operate.' },
      function: 'Supplies fuel, electricity, and power consumed by infrastructure operations',
      dysregulation: 'Fuel shortage for fleet, power loss to pumping stations, energy cost spike',
      expectedTypes: [
        { type: 'Fleet fuel management vendor', reason: 'Fuel cards, bulk fuel delivery, and consumption tracking', confidence: 0.85 },
        { type: 'Infrastructure power supply contractor', reason: 'Temporary and permanent power connections for construction and operations', confidence: 0.82 },
        { type: 'Energy procurement consultancy', reason: 'Utility rate analysis and energy purchasing for infrastructure agencies', confidence: 0.78 }
      ]
    },
    'SNS': {
      fullName: 'Sympathetic Nervous System', label: 'Infrastructure Rapid Mobilization', tier: 'operational',
      neuroTranslation: { inNeurology: 'Activates fight-or-flight — increases heart rate, blood pressure, and mobilizes energy.', inBusiness: 'In infrastructure, this is rapid mobilization — calling out emergency crews, activating mutual aid, and surging resources for infrastructure emergencies.' },
      function: 'Mobilizes emergency crews, activates mutual aid, and surges resources for infrastructure crises',
      dysregulation: 'Slow mobilization, mutual aid failure, insufficient surge capacity',
      expectedTypes: [
        { type: 'Emergency mobilization contractor', reason: 'Pre-positioned crews and equipment for storm, flood, and disaster response', confidence: 0.90 },
        { type: 'Utility mutual aid coordination service', reason: 'Interstate crew sharing and restoration coordination', confidence: 0.85 },
        { type: 'Emergency staffing agency', reason: 'Rapid-deployment skilled workers for infrastructure emergencies', confidence: 0.78 }
      ]
    },
    'STN': {
      fullName: 'Subthalamic Nucleus', label: 'Infrastructure Regulatory Enforcement', tier: 'operational',
      neuroTranslation: { inNeurology: 'Excitatory nucleus in basal ganglia that inhibits unwanted actions — the brake on inappropriate motor programs.', inBusiness: 'In infrastructure, this is regulatory enforcement — the mechanisms that stop non-compliant construction, unsafe operations, and code violations.' },
      function: 'Enforces compliance through stop-work orders, fines, and regulatory action',
      dysregulation: 'Unenforced regulations, ignored violations, weak stop-work authority',
      expectedTypes: [
        { type: 'Construction regulatory compliance firm', reason: 'OSHA, EPA, DOT, and local code enforcement support', confidence: 0.88 },
        { type: 'Environmental enforcement consultancy', reason: 'NPDES, stormwater, and erosion control inspection and enforcement', confidence: 0.85 },
        { type: 'Safety compliance monitoring platform', reason: 'Real-time safety violation tracking and corrective action management', confidence: 0.80 }
      ]
    },
    'STS': {
      fullName: 'Superior Temporal Sulcus', label: 'Infrastructure User Behavior Analysis', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes social perception — understanding others\' intentions from observed behavior.', inBusiness: 'In infrastructure, this is user behavior analysis — understanding how people use infrastructure through traffic counts, transit ridership data, and usage patterns.' },
      function: 'Analyzes infrastructure usage patterns through traffic counts, ridership, and flow data',
      dysregulation: 'Inaccurate usage data, undetected demand shifts, misunderstood travel patterns',
      expectedTypes: [
        { type: 'Traffic data collection firm', reason: 'Tube counts, video counts, O-D studies, and turning movement counts', confidence: 0.90 },
        { type: 'Transit ridership analytics vendor', reason: 'APC data, origin-destination analysis, and demand forecasting', confidence: 0.85 },
        { type: 'Big data mobility analytics platform', reason: 'Cell phone, GPS, and probe data for infrastructure usage patterns', confidence: 0.82 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Infrastructure Stakeholder Perspective', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports theory of mind — understanding others\' mental states and perspectives.', inBusiness: 'In infrastructure, this is stakeholder perspective — understanding the diverse needs of residents, businesses, travelers, and agencies affected by infrastructure decisions.' },
      function: 'Incorporates diverse stakeholder perspectives into infrastructure planning and design',
      dysregulation: 'Ignored stakeholder concerns, one-sided design, community opposition',
      expectedTypes: [
        { type: 'Stakeholder engagement facilitator', reason: 'Public meetings, charrettes, and consensus building for infrastructure', confidence: 0.85 },
        { type: 'Context-sensitive design consultancy', reason: 'CSS/CSD approach balancing mobility, safety, and community values', confidence: 0.82 },
        { type: 'Social impact assessment firm', reason: 'Relocation, displacement, and community disruption analysis', confidence: 0.78 }
      ]
    },
    'TPOLE': {
      fullName: 'Temporal Pole', label: 'Infrastructure Identity & Placemaking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports semantic memory and social-emotional associations with concepts and entities.', inBusiness: 'In infrastructure, this is placemaking and identity — the design of infrastructure that creates sense of place, community identity, and civic pride.' },
      function: 'Creates sense of place and civic identity through infrastructure design and public space',
      dysregulation: 'Generic placeless infrastructure, demolished historic structures, sterile public space',
      expectedTypes: [
        { type: 'Landscape architecture firm', reason: 'Public space design, streetscape, and green infrastructure', confidence: 0.88 },
        { type: 'Historic preservation consultancy', reason: 'SHPO coordination, Section 106, and adaptive reuse', confidence: 0.82 },
        { type: 'Public art and infrastructure aesthetics firm', reason: 'Bridge aesthetics, retaining wall treatments, and gateway features', confidence: 0.75 }
      ]
    },
    'TrkB': {
      fullName: 'TrkB Receptor', label: 'Infrastructure Innovation Adoption', tier: 'operational',
      neuroTranslation: { inNeurology: 'Receptor for BDNF — enables neuroplasticity and growth signaling when activated.', inBusiness: 'In infrastructure, this is innovation adoption — the receptiveness of agencies and industries to new technologies, materials, and methods.' },
      function: 'Evaluates and adopts new technologies, materials, and construction methods',
      dysregulation: 'Innovation resistance, stuck on legacy methods, failed technology pilots',
      expectedTypes: [
        { type: 'Infrastructure innovation consultancy', reason: 'Technology evaluation, pilot design, and implementation strategy', confidence: 0.85 },
        { type: 'Advanced materials vendor', reason: 'UHPC, FRP, geosynthetics, and self-healing concrete', confidence: 0.82 },
        { type: 'Construction technology startup', reason: 'Robotics, 3D printing, and autonomous equipment for infrastructure', confidence: 0.75 }
      ]
    },
    'V1': {
      fullName: 'Primary Visual Cortex', label: 'Infrastructure Imaging & Survey', tier: 'operational',
      neuroTranslation: { inNeurology: 'First cortical stage of visual processing — receives raw visual input from LGN.', inBusiness: 'In infrastructure, this is raw imaging and survey — photogrammetry, LiDAR point clouds, and satellite imagery that provide the raw visual data for infrastructure assessment.' },
      function: 'Captures raw visual data via photogrammetry, LiDAR, and satellite imagery',
      dysregulation: 'Poor image quality, incomplete LiDAR coverage, survey datum errors',
      expectedTypes: [
        { type: 'Aerial survey and photogrammetry firm', reason: 'Orthophotos, point clouds, and topographic mapping', confidence: 0.92 },
        { type: 'Terrestrial LiDAR scanning service', reason: 'High-resolution 3D scanning of structures and corridors', confidence: 0.88 },
        { type: 'Satellite imagery analytics vendor', reason: 'Change detection, land use analysis, and infrastructure monitoring from space', confidence: 0.82 }
      ]
    },
    'VAN': {
      fullName: 'Ventral Attention Network', label: 'Infrastructure Unexpected Event Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects unexpected salient stimuli — the bottom-up surprise detection system.', inBusiness: 'In infrastructure, this is unexpected event detection — detecting sinkholes, unexpected failures, third-party damage, and anomalies that were not predicted.' },
      function: 'Detects sinkholes, unexpected failures, third-party damage, and infrastructure anomalies',
      dysregulation: 'Undetected sinkholes, surprise failures, missed third-party damage reports',
      expectedTypes: [
        { type: 'Sinkhole detection and repair contractor', reason: 'GPR, void detection, and emergency sinkhole stabilization', confidence: 0.88 },
        { type: 'Third-party damage reporting platform', reason: '811 violation tracking and damage claim management', confidence: 0.82 },
        { type: 'Anomaly detection analytics vendor', reason: 'ML-based detection of unusual patterns in infrastructure sensor data', confidence: 0.78 }
      ]
    },
    'VERM': {
      fullName: 'Vermis', label: 'Infrastructure Balance & Equilibrium', tier: 'operational',
      neuroTranslation: { inNeurology: 'Midline cerebellum involved in postural balance and equilibrium.', inBusiness: 'In infrastructure, this is structural balance and equilibrium — load distribution, settlement monitoring, and structural equilibrium analysis for foundations, retaining walls, and embankments.' },
      function: 'Monitors structural balance, load distribution, and foundation settlement',
      dysregulation: 'Differential settlement, retaining wall tilt, uneven load distribution',
      expectedTypes: [
        { type: 'Settlement monitoring vendor', reason: 'Survey monuments, tiltmeters, and settlement tracking for structures', confidence: 0.88 },
        { type: 'Retaining wall design firm', reason: 'MSE walls, soldier pile, and sheet pile design and assessment', confidence: 0.85 },
        { type: 'Foundation rehabilitation contractor', reason: 'Underpinning, micropiles, and grouting for settlement repair', confidence: 0.82 }
      ]
    },
    'VEST': {
      fullName: 'Vestibular', label: 'Infrastructure Stability Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects head position and movement for balance and spatial orientation.', inBusiness: 'In infrastructure, this is stability monitoring — inclinometers, settlement plates, and tilt sensors that detect when infrastructure is moving or losing stability.' },
      function: 'Detects infrastructure movement, tilt, and stability changes via inclinometers and tilt sensors',
      dysregulation: 'Undetected slope movement, foundation tilt, embankment creep',
      expectedTypes: [
        { type: 'Geotechnical instrumentation vendor', reason: 'Inclinometers, piezometers, settlement plates, and extensometers', confidence: 0.90 },
        { type: 'Slope stability monitoring service', reason: 'Real-time slope movement detection for highways, dams, and cuts', confidence: 0.85 },
        { type: 'Dam safety monitoring firm', reason: 'Dam instrumentation, deformation monitoring, and safety evaluation', confidence: 0.82 }
      ]
    },
    'VTA': {
      fullName: 'Ventral Tegmental Area', label: 'Infrastructure Innovation & R&D', tier: 'operational',
      neuroTranslation: { inNeurology: 'Origin of the mesolimbic dopamine pathway — drives reward-seeking and novelty exploration.', inBusiness: 'In infrastructure, this is R&D and innovation — research into new materials, construction methods, and technologies that advance infrastructure capability.' },
      function: 'Conducts research into new materials, construction methods, and infrastructure technologies',
      dysregulation: 'No R&D investment, stagnant methods, inability to adopt proven innovations',
      expectedTypes: [
        { type: 'Infrastructure research institute', reason: 'TRB, NCHRP, WERF, and university-based infrastructure research', confidence: 0.88 },
        { type: 'Construction R&D firm', reason: 'New materials testing, method development, and pilot programs', confidence: 0.82 },
        { type: 'Infrastructure technology accelerator', reason: 'Startup incubation for construction and infrastructure tech', confidence: 0.75 }
      ]
    },
    'VV': {
      fullName: 'Ventral Vagal', label: 'Infrastructure Social Connection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports social engagement, calm states, and safe connection through the vagal brake.', inBusiness: 'In infrastructure, this is social connection infrastructure — pedestrian bridges, bike lanes, greenways, and connectivity that links communities.' },
      function: 'Provides pedestrian, bicycle, and multi-use path infrastructure connecting communities',
      dysregulation: 'Disconnected neighborhoods, missing sidewalks, unsafe pedestrian crossings',
      expectedTypes: [
        { type: 'Bicycle and pedestrian infrastructure firm', reason: 'Trail design, bike lane, and sidewalk engineering', confidence: 0.88 },
        { type: 'Pedestrian bridge manufacturer', reason: 'Prefabricated and custom pedestrian crossing structures', confidence: 0.82 },
        { type: 'Complete streets consultancy', reason: 'Multimodal corridor design balancing all road users', confidence: 0.80 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke\'s Area', label: 'Infrastructure Data Interpretation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Comprehends spoken and written language — extracts meaning from input.', inBusiness: 'In infrastructure, this is data interpretation — making sense of the vast data streams from infrastructure sensors, inspections, and monitoring into actionable intelligence.' },
      function: 'Interprets infrastructure monitoring data and inspection results into actionable findings',
      dysregulation: 'Misinterpreted data, unused monitoring output, analysis paralysis',
      expectedTypes: [
        { type: 'Infrastructure data analytics firm', reason: 'Transforms raw sensor and inspection data into actionable insights', confidence: 0.88 },
        { type: 'Inspection data interpretation service', reason: 'Bridge load rating, pavement distress analysis, and pipeline assessment', confidence: 0.85 },
        { type: 'Data visualization platform', reason: 'Dashboards, charts, and maps for infrastructure decision-makers', confidence: 0.80 }
      ]
    },
    'mPFC': {
      fullName: 'Medial Prefrontal Cortex', label: 'Infrastructure Policy & Strategy', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in self-referential processing, social cognition, and value-based decision-making.', inBusiness: 'In infrastructure, this is policy and strategy — the high-level decisions about infrastructure investment priorities, policy direction, and strategic goals.' },
      function: 'Sets infrastructure investment policy, strategic direction, and political priorities',
      dysregulation: 'Policy drift, unfunded mandates, strategy-execution disconnect',
      expectedTypes: [
        { type: 'Infrastructure policy consultancy', reason: 'Federal, state, and local infrastructure policy analysis and advocacy', confidence: 0.88 },
        { type: 'Strategic planning firm', reason: 'Agency strategic plans, performance frameworks, and goal setting', confidence: 0.85 },
        { type: 'Government affairs and advocacy firm', reason: 'Infrastructure legislation tracking and advocacy', confidence: 0.80 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate Cortex', label: 'Infrastructure Conflict Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates emotional responses to conflict and supports error-related emotional processing.', inBusiness: 'In infrastructure, this is conflict resolution — resolving disputes between agencies, contractors, communities, and stakeholders over infrastructure decisions.' },
      function: 'Resolves disputes between agencies, contractors, and communities over infrastructure',
      dysregulation: 'Protracted disputes, litigation, project-stopping community opposition',
      expectedTypes: [
        { type: 'Construction dispute resolution firm', reason: 'Mediation, arbitration, DRB, and claims resolution', confidence: 0.88 },
        { type: 'Community conflict mediator', reason: 'Facilitation of community-agency disputes over infrastructure projects', confidence: 0.82 },
        { type: 'Ombudsman service', reason: 'Independent complaint investigation and resolution for infrastructure agencies', confidence: 0.75 }
      ]
    },
    'vlPFC': {
      fullName: 'Ventrolateral Prefrontal Cortex', label: 'Infrastructure Contract Administration', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in response inhibition and rule-based decision-making.', inBusiness: 'In infrastructure, this is contract administration — enforcing contract terms, managing change orders, and ensuring compliance with specifications.' },
      function: 'Administers infrastructure contracts, change orders, and specification compliance',
      dysregulation: 'Uncontrolled change orders, specification non-compliance, weak contract enforcement',
      expectedTypes: [
        { type: 'Construction contract administration firm', reason: 'Pay application review, change order negotiation, and closeout', confidence: 0.90 },
        { type: 'Specification writing consultancy', reason: 'Technical specifications, special provisions, and performance specs', confidence: 0.85 },
        { type: 'Construction audit firm', reason: 'Billing audit, DBE compliance, and prevailing wage verification', confidence: 0.82 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Infrastructure Value Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Encodes subjective value and integrates emotional significance into decisions.', inBusiness: 'In infrastructure, this is value assessment — determining the true value of infrastructure assets considering social, economic, and environmental dimensions beyond cost.' },
      function: 'Assesses the multi-dimensional value of infrastructure including social and environmental benefits',
      dysregulation: 'Narrow cost-only analysis, ignored social value, undervalued environmental benefits',
      expectedTypes: [
        { type: 'Triple bottom line assessment firm', reason: 'Economic, social, and environmental value quantification', confidence: 0.85 },
        { type: 'Social return on investment consultancy', reason: 'SROI analysis for infrastructure investment justification', confidence: 0.80 },
        { type: 'Environmental benefit valuation firm', reason: 'Ecosystem services, carbon, and green infrastructure valuation', confidence: 0.78 }
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
    var brain = brains.get('infrastructure');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = {
      nodeCompanies: {},
      nodeTreatments: {},
      nodeDiagnoses: {},
      nodeLabels: {},
      nodeDepths: {},
      allActivations: []
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
        for (var di = 0; di < dx.length; di++) {
          result.nodeDiagnoses[nid][dx[di]] = true;
        }
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

  function getInfrastructureState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('infrastructure');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getInfrastructureState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('infrastructure') : null;
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

    var mapped = [];
    var missing = [];
    var speculative = [];

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
      for (var tk in existingCos) {
        mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')');
      }

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
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Infrastructure. It will appear as a valid target in grants, investments, and patent searches tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Infrastructure.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Infrastructure mapping for audit tracking. Requires further validation.';
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
    mapped.sort(sortFn);
    missing.sort(sortFn);
    speculative.sort(sortFn);

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

  window.LIMENInfrastructureBusinessEngine = {
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
    console.log('[InfrastructureBusinessEngine] Hierarchy loaded');
  });

  console.log('[InfrastructureBusinessEngine] Loaded \u2014 103-node full-hierarchy infrastructure business assignment engine');

})();
