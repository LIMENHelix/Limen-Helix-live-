/**
 * agriculture-node-business-engine.js — Agriculture Node-to-Business Assignment Engine
 *
 * AGRICULTURE DOMAIN ONLY. Full-hierarchy inference layer.
 * 103 operational nodes (20 RI/framework excluded).
 *
 * Exposes: window.LIMENAgricultureBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'agriculture') return;

  var STORAGE_KEY = 'limen_agriculture_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_agriculture_hierarchy_cache';
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
    if (lower.indexOf('signal filtering') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal correlation') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('root cause analysis') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  var NODE_BUSINESS_DIRECTORY = {

    // ── TOP-TIER (20 portal-active) ──

    'M1': { fullName: 'Primary Motor Cortex', label: 'Crop Production', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output — voluntary movement execution.', inBusiness: 'In agriculture, this is crop production — planting, growing, and harvesting field crops.' },
      function: 'Plants, cultivates, and harvests row crops, grains, and oilseeds',
      dysregulation: 'Crop failure, planting delay, harvest loss, yield shortfall',
      expectedTypes: [
        { type: 'Row crop farm operator', reason: 'Corn, soybean, wheat, and cotton production', confidence: 0.95 },
        { type: 'Custom harvesting service', reason: 'Contract combining and grain cart operations', confidence: 0.85 },
        { type: 'Crop consulting agronomist', reason: 'In-season scouting, tissue sampling, and yield optimization', confidence: 0.82 }
      ]
    },
    'S1': { fullName: 'Primary Somatosensory Cortex', label: 'Livestock Production', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes tactile, pressure, and temperature signals.', inBusiness: 'In agriculture, this is livestock — cattle, hogs, sheep, and poultry management.' },
      function: 'Raises cattle, hogs, sheep, goats, and poultry for meat, milk, and eggs',
      dysregulation: 'Disease outbreak, feed shortage, market collapse, facility failure',
      expectedTypes: [
        { type: 'Cattle rancher and feedlot operator', reason: 'Beef cattle breeding, backgrounding, and finishing', confidence: 0.95 },
        { type: 'Swine integrator', reason: 'Vertically integrated hog production and processing', confidence: 0.90 },
        { type: 'Poultry producer', reason: 'Broiler, layer, and turkey production', confidence: 0.88 },
        { type: 'Livestock auction and marketing', reason: 'Sale barns, video auctions, and livestock brokerage', confidence: 0.78 }
      ]
    },
    'FG': { fullName: 'Fusiform Gyrus', label: 'Horticulture & Specialty Crops', tier: 'top',
      neuroTranslation: { inNeurology: 'Visual pattern recognition of complex objects.', inBusiness: 'In agriculture, this is horticulture — fruits, vegetables, herbs, and ornamentals.' },
      function: 'Grows fruits, vegetables, herbs, nursery stock, and ornamental plants',
      dysregulation: 'Frost damage, pollinator loss, labor shortage, quality rejection',
      expectedTypes: [
        { type: 'Fruit and vegetable grower', reason: 'Fresh produce production for wholesale and retail', confidence: 0.95 },
        { type: 'Greenhouse operator', reason: 'Controlled-environment production of transplants and specialty crops', confidence: 0.88 },
        { type: 'Nursery and garden center', reason: 'Propagation and retail of trees, shrubs, and ornamentals', confidence: 0.82 }
      ]
    },
    'THAL': { fullName: 'Thalamus', label: 'Post-Harvest Handling', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays sensory and motor signals to cortex.', inBusiness: 'In agriculture, this is post-harvest — sorting, grading, storing, and routing harvested commodities.' },
      function: 'Dries, cleans, grades, stores, and routes harvested commodities',
      dysregulation: 'Grain spoilage, mycotoxin contamination, storage loss, grading dispute',
      expectedTypes: [
        { type: 'Grain elevator operator', reason: 'Receiving, drying, storage, and merchandising of grain', confidence: 0.95 },
        { type: 'Post-harvest processing facility', reason: 'Cleaning, sorting, and packaging for market delivery', confidence: 0.88 },
        { type: 'Cold storage operator', reason: 'Temperature-controlled storage for perishable crops', confidence: 0.85 }
      ]
    },
    'STRI': { fullName: 'Striatum', label: 'Agricultural Machinery', tier: 'top',
      neuroTranslation: { inNeurology: 'Habit formation and reward-based learning.', inBusiness: 'In agriculture, this is machinery — tractors, combines, planters, and implements.' },
      function: 'Manufactures and services tractors, combines, planters, sprayers, and implements',
      dysregulation: 'Equipment breakdown during planting or harvest, parts shortage, dealer backlog',
      expectedTypes: [
        { type: 'Farm equipment manufacturer', reason: 'Tractors, combines, planters, and sprayers', confidence: 0.95 },
        { type: 'Farm equipment dealer', reason: 'Sales, parts, and service for agricultural machinery', confidence: 0.92 },
        { type: 'Used equipment marketplace', reason: 'Secondary market for tractors and implements', confidence: 0.78 }
      ]
    },
    'HYPO': { fullName: 'Hypothalamus', label: 'Water & Irrigation', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates homeostasis — thirst, temperature, hormones.', inBusiness: 'In agriculture, this is water and irrigation — managing crop water needs.' },
      function: 'Delivers water to crops via center pivot, drip, flood, and sprinkler irrigation',
      dysregulation: 'Drought, well depletion, irrigation system failure, water rights conflict',
      expectedTypes: [
        { type: 'Irrigation equipment manufacturer', reason: 'Center pivots, drip tape, pumps, and controllers', confidence: 0.95 },
        { type: 'Irrigation design and installation firm', reason: 'System design, pipe laying, and pump station construction', confidence: 0.88 },
        { type: 'Water rights and management consultancy', reason: 'Water rights, allocation, and conservation planning', confidence: 0.80 }
      ]
    },
    'NTS': { fullName: 'Nucleus Tractus Solitarius', label: 'Soil Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Primary visceral sensory relay.', inBusiness: 'In agriculture, this is soil — the living substrate determining everything above it.' },
      function: 'Tests, amends, conserves, and improves soil health and fertility',
      dysregulation: 'Soil erosion, compaction, nutrient depletion, pH imbalance',
      expectedTypes: [
        { type: 'Soil testing laboratory', reason: 'Nutrient analysis, organic matter, and microbiome testing', confidence: 0.92 },
        { type: 'Soil amendment supplier', reason: 'Lime, gypsum, compost, and biochar products', confidence: 0.88 },
        { type: 'Conservation tillage equipment vendor', reason: 'No-till drills, strip-till rigs, and residue management', confidence: 0.82 }
      ]
    },
    'OFC': { fullName: 'Orbitofrontal Cortex', label: 'Commodity Markets', tier: 'top',
      neuroTranslation: { inNeurology: 'Assigns value to choices and outcomes.', inBusiness: 'In agriculture, this is commodity markets — pricing agricultural output.' },
      function: 'Trades grain, livestock, dairy, and soft commodity futures and cash markets',
      dysregulation: 'Price crash, basis blowout, contract default, market manipulation',
      expectedTypes: [
        { type: 'Commodity trading firm', reason: 'Physical and financial grain and livestock trading', confidence: 0.95 },
        { type: 'Grain merchandiser', reason: 'Cash grain origination, basis trading, and export sales', confidence: 0.90 },
        { type: 'Agricultural market advisory', reason: 'Price forecasting, hedging strategy, and marketing plans', confidence: 0.85 }
      ]
    },
    'vmPFC': { fullName: 'Ventromedial Prefrontal Cortex', label: 'Agricultural Finance', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes subjective value and emotional significance.', inBusiness: 'In agriculture, this is farm finance — lending, insurance, and risk management.' },
      function: 'Provides farm credit, crop insurance, operating loans, and financial planning',
      dysregulation: 'Credit denial, insurance claim dispute, cash flow crisis, land value collapse',
      expectedTypes: [
        { type: 'Farm credit lender', reason: 'Operating loans, land mortgages, and equipment financing', confidence: 0.95 },
        { type: 'Crop insurance agent', reason: 'Federal crop insurance, revenue protection, and hail coverage', confidence: 0.92 },
        { type: 'Farm financial planner', reason: 'Cash flow planning, tax strategy, and succession financing', confidence: 0.82 }
      ]
    },
    'dlPFC': { fullName: 'Dorsolateral Prefrontal Cortex', label: 'Precision Agriculture', tier: 'top',
      neuroTranslation: { inNeurology: 'Working memory, planning, multi-goal coordination.', inBusiness: 'In agriculture, this is precision ag — GPS guidance, variable rate, and data-driven management.' },
      function: 'Deploys GPS guidance, VRA, yield monitoring, and data-driven agronomic decisions',
      dysregulation: 'GPS signal loss, sensor failure, data integration breakdown, prescription error',
      expectedTypes: [
        { type: 'Precision ag technology vendor', reason: 'GPS receivers, yield monitors, and VRA controllers', confidence: 0.95 },
        { type: 'Ag data analytics platform', reason: 'Field-level analytics, prescription mapping, and ROI tracking', confidence: 0.88 },
        { type: 'Drone and remote sensing service', reason: 'NDVI imagery, stand counts, and aerial crop scouting', confidence: 0.85 }
      ]
    },
    'dACC': { fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Agricultural Policy & Regulation', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflicts and errors, signals corrective action.', inBusiness: 'In agriculture, this is policy and regulation — Farm Bill, EPA, and USDA compliance.' },
      function: 'Administers farm programs, conservation compliance, and food safety regulation',
      dysregulation: 'Farm Bill uncertainty, regulatory overreach, compliance burden, program cut',
      expectedTypes: [
        { type: 'Agricultural policy consultancy', reason: 'Farm Bill navigation, program enrollment, and advocacy', confidence: 0.90 },
        { type: 'Regulatory compliance service', reason: 'EPA, USDA, FDA, and state ag department compliance', confidence: 0.88 },
        { type: 'Conservation program administrator', reason: 'CRP, EQIP, CSP enrollment and compliance monitoring', confidence: 0.82 }
      ]
    },
    'HIPP': { fullName: 'Hippocampus', label: 'Seeds & Genetics', tier: 'top',
      neuroTranslation: { inNeurology: 'Forms and consolidates new memories.', inBusiness: 'In agriculture, this is seeds and genetics — the stored genetic memory determining crop potential.' },
      function: 'Breeds, produces, treats, and distributes crop seed and genetic material',
      dysregulation: 'Seed shortage, trait failure, germination problem, IP dispute',
      expectedTypes: [
        { type: 'Seed company', reason: 'Hybrid and variety development, production, and distribution', confidence: 0.95 },
        { type: 'Plant breeding program', reason: 'Trait development, genomic selection, and variety testing', confidence: 0.88 },
        { type: 'Seed treatment manufacturer', reason: 'Fungicide, insecticide, and biological seed coatings', confidence: 0.82 }
      ]
    },
    'NAcc': { fullName: 'Nucleus Accumbens', label: 'Fertilizers & Nutrients', tier: 'top',
      neuroTranslation: { inNeurology: 'Core of reward circuit — drives motivated behavior.', inBusiness: 'In agriculture, this is fertilizer — the nutrient inputs driving crop growth and yield.' },
      function: 'Manufactures, blends, and applies nitrogen, phosphorus, potassium, and micronutrients',
      dysregulation: 'Fertilizer price spike, supply shortage, application error, runoff contamination',
      expectedTypes: [
        { type: 'Fertilizer manufacturer', reason: 'Nitrogen, phosphate, and potash production', confidence: 0.95 },
        { type: 'Custom fertilizer applicator', reason: 'Variable-rate dry and liquid fertilizer application', confidence: 0.88 },
        { type: 'Specialty nutrient company', reason: 'Micronutrients, biologicals, and enhanced-efficiency fertilizers', confidence: 0.82 }
      ]
    },
    'BLA': { fullName: 'Basolateral Amygdala', label: 'Crop Protection', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates threat significance.', inBusiness: 'In agriculture, this is crop protection — evaluating pest, disease, and weed threats.' },
      function: 'Protects crops from pests, diseases, and weeds via chemical, biological, and cultural methods',
      dysregulation: 'Pest outbreak, herbicide resistance, spray drift, timing miss',
      expectedTypes: [
        { type: 'Crop protection chemical manufacturer', reason: 'Herbicides, insecticides, and fungicides', confidence: 0.95 },
        { type: 'Custom spray applicator', reason: 'Ground and aerial pesticide application services', confidence: 0.90 },
        { type: 'Biological pest control vendor', reason: 'Beneficial insects, biopesticides, and pheromone traps', confidence: 0.82 }
      ]
    },
    'CBLM': { fullName: 'Cerebellum', label: 'Supply Chain & Logistics', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates movement with precise timing.', inBusiness: 'In agriculture, this is the supply chain — precisely timed logistics from farm to consumer.' },
      function: 'Moves agricultural products from farm gate through processing to retail',
      dysregulation: 'Trucking shortage, cold chain break, port congestion, processing bottleneck',
      expectedTypes: [
        { type: 'Agricultural trucking company', reason: 'Grain, livestock, and produce hauling', confidence: 0.92 },
        { type: 'Cold chain logistics provider', reason: 'Refrigerated transport for perishable products', confidence: 0.88 },
        { type: 'Food distribution company', reason: 'Wholesale distribution of agricultural products to retail', confidence: 0.85 }
      ]
    },
    'AG': { fullName: 'Angular Gyrus', label: 'Agricultural Research & Education', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multimodal input into unified concepts.', inBusiness: 'In agriculture, this is research and extension — integrating field trials and farmer education.' },
      function: 'Conducts agricultural research, field trials, and farmer education through extension',
      dysregulation: 'Research funding cut, extension reduction, knowledge transfer gap',
      expectedTypes: [
        { type: 'Land-grant university ag program', reason: 'Agricultural research, extension, and degree programs', confidence: 0.92 },
        { type: 'Agricultural research organization', reason: 'Private and public crop and livestock research', confidence: 0.85 },
        { type: 'Farm management education provider', reason: 'Workshops, field days, and continuing education', confidence: 0.78 }
      ]
    },
    'AI': { fullName: 'Anterior Insula', label: 'Food Processing', tier: 'top',
      neuroTranslation: { inNeurology: 'Conscious awareness of bodily states.', inBusiness: 'In agriculture, this is food processing — transforming raw products into consumer-ready food.' },
      function: 'Processes raw agricultural commodities into food products',
      dysregulation: 'Processing plant shutdown, contamination event, capacity shortage',
      expectedTypes: [
        { type: 'Meat processor', reason: 'Slaughter, fabrication, and packaging of beef, pork, and poultry', confidence: 0.95 },
        { type: 'Grain mill and flour producer', reason: 'Wheat milling, corn processing, and feed manufacturing', confidence: 0.88 },
        { type: 'Dairy processor', reason: 'Milk pasteurization, cheese making, and yogurt production', confidence: 0.85 }
      ]
    },
    'LANG': { fullName: 'Language Network', label: 'Climate & Weather', tier: 'top',
      neuroTranslation: { inNeurology: 'Distributed network for language comprehension.', inBusiness: 'In agriculture, this is climate and weather — the environmental language farmers read daily.' },
      function: 'Provides weather forecasting, climate data, and growing-season intelligence',
      dysregulation: 'Forecast miss, extreme weather, climate shift disrupting cropping patterns',
      expectedTypes: [
        { type: 'Agricultural weather service', reason: 'Field-level forecasting, frost alerts, and spray windows', confidence: 0.90 },
        { type: 'Climate risk analytics firm', reason: 'GDD modeling, drought indices, and climate adaptation', confidence: 0.85 },
        { type: 'Crop weather insurance provider', reason: 'Weather-indexed insurance and parametric coverage', confidence: 0.78 }
      ]
    },
    'EC': { fullName: 'Entorhinal Cortex', label: 'Agricultural Land & Property', tier: 'top',
      neuroTranslation: { inNeurology: 'Gateway to hippocampus with grid cells for spatial navigation.', inBusiness: 'In agriculture, this is land — ownership, leasing, and land use decisions.' },
      function: 'Manages farmland ownership, leasing, valuation, and land use decisions',
      dysregulation: 'Land price bubble, lease dispute, zoning conflict, succession failure',
      expectedTypes: [
        { type: 'Farm real estate broker', reason: 'Farmland sales, purchases, and appraisal', confidence: 0.92 },
        { type: 'Farmland investment manager', reason: 'Institutional farmland acquisition and management', confidence: 0.85 },
        { type: 'Farm lease advisor', reason: 'Cash rent, crop share, and flex lease negotiation', confidence: 0.80 }
      ]
    },
    'OXY': { fullName: 'Oxytocin', label: 'Equipment & Machinery Services', tier: 'top',
      neuroTranslation: { inNeurology: 'Promotes social bonding and cooperation.', inBusiness: 'In agriculture, this is equipment services — the cooperative relationships between farmers, dealers, and repair shops.' },
      function: 'Repairs, maintains, and services farm equipment and machinery',
      dysregulation: 'Parts unavailability, repair delay during critical season, technician shortage',
      expectedTypes: [
        { type: 'Farm equipment repair shop', reason: 'Mobile and shop repair of tractors, combines, and implements', confidence: 0.92 },
        { type: 'Agricultural parts distributor', reason: 'OEM and aftermarket parts for farm equipment', confidence: 0.88 },
        { type: 'Equipment telematics provider', reason: 'Remote diagnostics, fleet tracking, and predictive maintenance', confidence: 0.80 }
      ]
    },

    // ── OPERATIONAL NODES (83) ──

    'A1': { fullName: 'Primary Auditory Cortex', label: 'Livestock Sound Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes auditory signals.', inBusiness: 'In agriculture, this is livestock acoustic monitoring — distress calls, respiratory illness, and estrus vocalizations.' },
      function: 'Monitors livestock health and behavior through acoustic analysis',
      dysregulation: 'Undetected respiratory disease, missed calving, stress vocalization ignored',
      expectedTypes: [
        { type: 'Livestock acoustic monitoring vendor', reason: 'Cough detection, vocalization analysis, and barn sound monitoring', confidence: 0.82 },
        { type: 'Animal welfare assessment service', reason: 'Behavioral and acoustic welfare auditing', confidence: 0.78 },
        { type: 'Barn environment monitoring system', reason: 'Sound, temperature, humidity, and air quality sensors', confidence: 0.80 }
      ]
    },
    'ADR': { fullName: 'Adrenal', label: 'Emergency Ag Response', tier: 'operational',
      neuroTranslation: { inNeurology: 'Rapid mobilization under stress.', inBusiness: 'In agriculture, this is emergency response for disease outbreaks, chemical spills, and natural disasters.' },
      function: 'Mobilizes emergency response for agricultural disasters and disease outbreaks',
      dysregulation: 'Delayed quarantine, slow disaster response, inadequate emergency feed',
      expectedTypes: [
        { type: 'Livestock disease emergency service', reason: 'Rapid response for avian influenza, ASF, and FMD', confidence: 0.88 },
        { type: 'Agricultural disaster relief organization', reason: 'Emergency feed, fencing, and livestock evacuation', confidence: 0.82 },
        { type: 'Farm chemical spill response contractor', reason: 'Pesticide and fertilizer spill containment and cleanup', confidence: 0.78 }
      ]
    },
    'ANT': { fullName: 'Anterior Thalamus', label: 'Farm-to-Market Routing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays signals in the Papez circuit.', inBusiness: 'In agriculture, this is farm-to-market routing — directing products to optimal destinations.' },
      function: 'Routes agricultural products from farm to optimal market destinations',
      dysregulation: 'Missed delivery window, wrong destination, spoilage from misrouting',
      expectedTypes: [
        { type: 'Agricultural logistics platform', reason: 'Digital load matching for grain, produce, and livestock', confidence: 0.85 },
        { type: 'Produce broker', reason: 'Connects growers with buyers for perishable routing', confidence: 0.78 }
      ]
    },
    'ARC': { fullName: 'Arcuate Fasciculus', label: 'Farm Communication Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Connects language areas.', inBusiness: 'In agriculture, this is farm communication — rural broadband and connectivity for data flow.' },
      function: 'Provides rural connectivity for farm data and communication',
      dysregulation: 'Rural broadband gap, radio dead zones, field data transfer failure',
      expectedTypes: [
        { type: 'Rural broadband provider', reason: 'Fixed wireless, satellite, and fiber internet for farms', confidence: 0.88 },
        { type: 'Agricultural IoT connectivity platform', reason: 'LoRaWAN, cellular, and mesh networks for farm sensors', confidence: 0.82 }
      ]
    },
    'BDNF': { fullName: 'BDNF / Plasticity', label: 'Agricultural Innovation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports growth and adaptive rewiring.', inBusiness: 'In agriculture, this is innovation — adopting new varieties, methods, and technologies.' },
      function: 'Drives adoption of new farming methods, varieties, and technologies',
      dysregulation: 'Resistance to change, failed technology adoption, innovation gap',
      expectedTypes: [
        { type: 'AgTech startup', reason: 'Innovation in robotics, AI, and biologicals', confidence: 0.85 },
        { type: 'Farm innovation consultancy', reason: 'Technology scouting and adoption strategy', confidence: 0.80 },
        { type: 'Agricultural accelerator program', reason: 'Startup incubation and farmer-tech partnerships', confidence: 0.75 }
      ]
    },
    'BNST': { fullName: 'BNST', label: 'Long-Term Soil & Water Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustained anxiety to uncertain threats.', inBusiness: 'In agriculture, this is long-term monitoring of soil degradation and aquifer depletion.' },
      function: 'Tracks multi-year soil degradation, aquifer levels, and cumulative impacts',
      dysregulation: 'Undetected aquifer depletion, slow erosion ignored, nutrient loading',
      expectedTypes: [
        { type: 'Long-term soil monitoring service', reason: 'Multi-year organic matter, carbon, and health trending', confidence: 0.85 },
        { type: 'Groundwater monitoring firm', reason: 'Well level measurement and aquifer depletion tracking', confidence: 0.82 }
      ]
    },
    'BROCA': { fullName: 'Broca\'s Area', label: 'Farm Management Software', tier: 'operational',
      neuroTranslation: { inNeurology: 'Produces structured speech.', inBusiness: 'In agriculture, this is farm management software — translating plans into structured records.' },
      function: 'Translates farm plans into work orders, field records, and compliance reports',
      dysregulation: 'Recordkeeping failure, compliance gap, operational confusion',
      expectedTypes: [
        { type: 'Farm management information system vendor', reason: 'Field records, mapping, and financial tracking', confidence: 0.90 },
        { type: 'Compliance documentation platform', reason: 'GAP, organic, and food safety record management', confidence: 0.78 }
      ]
    },
    'CARD': { fullName: 'Cardiac', label: 'Livestock Facility Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Heart rate and blood pressure control.', inBusiness: 'In agriculture, this is the mechanical heart of livestock facilities — ventilation, heating, and watering.' },
      function: 'Maintains ventilation, heating, cooling, and watering in livestock barns',
      dysregulation: 'Ventilation failure causing mortality, waterer freeze, heater malfunction',
      expectedTypes: [
        { type: 'Livestock ventilation system vendor', reason: 'Tunnel ventilation, curtain systems, and fan controllers', confidence: 0.90 },
        { type: 'Barn construction contractor', reason: 'Confinement buildings, free-stall barns, and poultry houses', confidence: 0.88 },
        { type: 'Livestock watering system vendor', reason: 'Automatic waterers, frost-free hydrants, and tank heaters', confidence: 0.82 }
      ]
    },
    'CAUD': { fullName: 'Caudate', label: 'Agricultural Procurement', tier: 'operational',
      neuroTranslation: { inNeurology: 'Goal-directed action selection.', inBusiness: 'In agriculture, this is input procurement — selecting and purchasing seed, chemicals, and feed.' },
      function: 'Procures seed, fertilizer, chemicals, feed, and other farm inputs',
      dysregulation: 'Input price spike, supply allocation, wrong product selection',
      expectedTypes: [
        { type: 'Farm input retailer', reason: 'Full-service ag retail: seed, chemical, fertilizer, consulting', confidence: 0.95 },
        { type: 'Farmer cooperative', reason: 'Farmer-owned co-op for bulk input buying and marketing', confidence: 0.90 },
        { type: 'Online agricultural marketplace', reason: 'Digital platform for input comparison and ordering', confidence: 0.78 }
      ]
    },
    'CC': { fullName: 'Corpus Callosum', label: 'Farm-to-Market Transport', tier: 'operational',
      neuroTranslation: { inNeurology: 'Connects hemispheres.', inBusiness: 'In agriculture, this connects production regions to consumption centers.' },
      function: 'Transports agricultural products from production regions to markets',
      dysregulation: 'Trucking shortage at harvest, road weight restrictions, rail car shortage',
      expectedTypes: [
        { type: 'Grain transportation company', reason: 'Truck, rail, and barge transport of bulk commodities', confidence: 0.92 },
        { type: 'Livestock hauling service', reason: 'Live animal transport to feedlots and processors', confidence: 0.88 }
      ]
    },
    'CING': { fullName: 'Cingulum', label: 'Agricultural Supply Corridors', tier: 'operational',
      neuroTranslation: { inNeurology: 'White matter along fixed pathway.', inBusiness: 'In agriculture, these are fixed supply routes from manufacturers to farms.' },
      function: 'Manages fixed agricultural input supply routes from manufacturers to farm gate',
      dysregulation: 'Supply corridor disruption, warehouse stockout, seasonal bottleneck',
      expectedTypes: [
        { type: 'Agricultural input distribution company', reason: 'Wholesale distribution of fertilizer, chemical, and seed', confidence: 0.88 },
        { type: 'Fertilizer terminal operator', reason: 'Bulk fertilizer receiving, storage, and transloading', confidence: 0.82 }
      ]
    },
    'CLAUST': { fullName: 'Claustrum', label: 'Multi-Enterprise Farm Coordination', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrates information across areas.', inBusiness: 'In agriculture, this coordinates multiple enterprises on diversified farms.' },
      function: 'Coordinates crop, livestock, and specialty operations on diversified farms',
      dysregulation: 'Enterprise conflict for resources, scheduling collision',
      expectedTypes: [
        { type: 'Diversified farm management consultancy', reason: 'Integrated crop-livestock-specialty planning', confidence: 0.82 },
        { type: 'Integrated farming systems advisor', reason: 'Cover crop-livestock integration and resource cycling', confidence: 0.75 }
      ]
    },
    'CMZ': { fullName: 'Cerebellar Motor Zone', label: 'Field Equipment Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fine-tunes motor output.', inBusiness: 'In agriculture, this is precision field equipment operation.' },
      function: 'Operates tractors, combines, sprayers, and implements with precision',
      dysregulation: 'Operator error, guidance failure, implement misadjustment',
      expectedTypes: [
        { type: 'Custom farming operator', reason: 'Contract planting, spraying, and harvesting', confidence: 0.90 },
        { type: 'Auto-steer and guidance system vendor', reason: 'RTK correction, auto-steer, and implement guidance', confidence: 0.88 }
      ]
    },
    'CON': { fullName: 'Cingulo-Opercular Network', label: 'Farm Maintenance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustains attention during prolonged operations.', inBusiness: 'In agriculture, this is ongoing farm maintenance.' },
      function: 'Performs routine maintenance on fences, buildings, drainage, and equipment',
      dysregulation: 'Deferred fence repair, building deterioration, clogged tile lines',
      expectedTypes: [
        { type: 'Farm maintenance contractor', reason: 'Fence building, bin repair, and general construction', confidence: 0.88 },
        { type: 'Drainage tile maintenance service', reason: 'Tile line jetting, repair, and outlet maintenance', confidence: 0.85 }
      ]
    },
    'CeA': { fullName: 'Central Amygdala', label: 'Animal Disease Emergency', tier: 'operational',
      neuroTranslation: { inNeurology: 'Outputs threat responses.', inBusiness: 'In agriculture, this is animal disease emergency — quarantine and depopulation.' },
      function: 'Executes quarantine, depopulation, and containment for livestock disease',
      dysregulation: 'Delayed quarantine, disease escape, depopulation logistics failure',
      expectedTypes: [
        { type: 'Veterinary emergency response team', reason: 'Foreign animal disease investigation and response', confidence: 0.90 },
        { type: 'Livestock depopulation contractor', reason: 'Humane depopulation, disposal, and decontamination', confidence: 0.85 },
        { type: 'Biosecurity consultancy', reason: 'Farm biosecurity plans, protocols, and audit', confidence: 0.82 }
      ]
    },
    'DAN': { fullName: 'Dorsal Attention Network', label: 'Crop Scouting & Surveillance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Top-down voluntary attention.', inBusiness: 'In agriculture, this is targeted crop scouting.' },
      function: 'Scouts fields for pests, diseases, weeds, and nutrient deficiencies',
      dysregulation: 'Missed pest threshold, late disease detection, undetected weed escape',
      expectedTypes: [
        { type: 'Independent crop scout', reason: 'Field scouting with threshold-based recommendations', confidence: 0.92 },
        { type: 'Agricultural drone scouting service', reason: 'Aerial NDVI, multispectral, and thermal imaging', confidence: 0.88 },
        { type: 'Satellite crop monitoring platform', reason: 'Field-level satellite imagery for health tracking', confidence: 0.85 }
      ]
    },
    'DISS': { fullName: 'Dissolution', label: 'Farm Retirement & Transition', tier: 'operational',
      neuroTranslation: { inNeurology: 'Dissolution of coherent states.', inBusiness: 'In agriculture, this is farm retirement and succession.' },
      function: 'Manages farm succession, retirement, asset liquidation, and transition',
      dysregulation: 'No succession plan, forced liquidation, family conflict',
      expectedTypes: [
        { type: 'Farm succession planning firm', reason: 'Estate planning, entity structuring, and generational transfer', confidence: 0.90 },
        { type: 'Farm auction company', reason: 'Equipment, land, and livestock auction and liquidation', confidence: 0.88 }
      ]
    },
    'DMN': { fullName: 'Default Mode Network', label: 'Long-Range Farm Planning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Mental simulation and future planning.', inBusiness: 'In agriculture, this is long-range planning — crop rotations and farm strategy.' },
      function: 'Develops multi-year crop rotations, capital plans, and farm strategy',
      dysregulation: 'No rotation plan, reactive-only investment, no long-term vision',
      expectedTypes: [
        { type: 'Farm strategic planning consultancy', reason: 'Multi-year business plans and expansion strategy', confidence: 0.85 },
        { type: 'Crop rotation planning platform', reason: 'Multi-year rotation optimization with soil and economics', confidence: 0.82 }
      ]
    },
    'DV': { fullName: 'Dorsal Vagal', label: 'Quarantine & Isolation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Shutdown under extreme threat.', inBusiness: 'In agriculture, this is quarantine and field isolation.' },
      function: 'Isolates diseased livestock, contaminated fields, and infested areas',
      dysregulation: 'Failed quarantine, disease escape, contamination spread',
      expectedTypes: [
        { type: 'Quarantine and containment service', reason: 'Animal and plant quarantine establishment', confidence: 0.85 },
        { type: 'Pest eradication contractor', reason: 'Fumigation, field burning, and invasive removal', confidence: 0.82 }
      ]
    },
    'ECN': { fullName: 'Executive Control Network', label: 'Farm Operations Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Top-down cognitive control.', inBusiness: 'In agriculture, this is farm management — hiring, scheduling, budgeting.' },
      function: 'Manages farm hiring, scheduling, budgeting, and operational decisions',
      dysregulation: 'Management overload, poor hiring, budget overrun',
      expectedTypes: [
        { type: 'Farm management company', reason: 'Professional management of farmland for absentee owners', confidence: 0.92 },
        { type: 'Agricultural accounting firm', reason: 'Farm tax, bookkeeping, and financial reporting', confidence: 0.88 }
      ]
    },
    'EI': { fullName: 'E/I Ratio', label: 'Crop-Livestock Balance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Balance between excitation and inhibition.', inBusiness: 'In agriculture, this is resource balance between enterprises.' },
      function: 'Balances land, labor, water, and capital between crop and livestock enterprises',
      dysregulation: 'Over-allocation to one enterprise, resource competition',
      expectedTypes: [
        { type: 'Integrated crop-livestock systems advisor', reason: 'Resource allocation across mixed operations', confidence: 0.82 },
        { type: 'Water allocation consultancy', reason: 'Balancing irrigation between crops and livestock', confidence: 0.75 }
      ]
    },
    'EMP': { fullName: 'Empathy', label: 'Rural Community & Food Access', tier: 'operational',
      neuroTranslation: { inNeurology: 'Understanding others\' experiences.', inBusiness: 'In agriculture, this is community food access — markets, CSAs, and food banks.' },
      function: 'Connects agricultural production with community food access',
      dysregulation: 'Food desert expansion, farm-community disconnect',
      expectedTypes: [
        { type: 'Farmers\' market operator', reason: 'Direct-to-consumer sales venues', confidence: 0.85 },
        { type: 'Community supported agriculture coordinator', reason: 'CSA subscription management', confidence: 0.82 }
      ]
    },
    'ENDO': { fullName: 'Endocannabinoid', label: 'Crop Stress Dampening', tier: 'operational',
      neuroTranslation: { inNeurology: 'Dampens excessive activity.', inBusiness: 'In agriculture, this is crop stress dampening — biostimulants and stress-tolerant inputs.' },
      function: 'Mitigates crop stress from heat, drought, frost, and salinity',
      dysregulation: 'Crop stress unmitigated, biostimulant ineffective',
      expectedTypes: [
        { type: 'Biostimulant manufacturer', reason: 'Seaweed extracts, humic acids, and amino acid products', confidence: 0.85 },
        { type: 'Stress-tolerant seed trait developer', reason: 'Drought tolerance, heat tolerance traits', confidence: 0.82 }
      ]
    },
    'ENS': { fullName: 'Enteric Nervous System', label: 'Agricultural Waste & Manure', tier: 'operational',
      neuroTranslation: { inNeurology: 'Autonomous gut management.', inBusiness: 'In agriculture, this is waste management — manure, composting, and biogas.' },
      function: 'Handles manure collection, storage, composting, and biogas production',
      dysregulation: 'Manure lagoon overflow, runoff violation, odor complaint',
      expectedTypes: [
        { type: 'Manure management contractor', reason: 'Pumping, hauling, and land application of manure', confidence: 0.92 },
        { type: 'Agricultural biogas developer', reason: 'Anaerobic digesters converting manure to RNG', confidence: 0.85 },
        { type: 'Composting facility operator', reason: 'Commercial composting of agricultural waste', confidence: 0.80 }
      ]
    },
    'FEF': { fullName: 'Frontal Eye Fields', label: 'Aerial Ag Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Controls voluntary eye movements.', inBusiness: 'In agriculture, this is aerial operations — crop dusting and aerial seeding.' },
      function: 'Provides aerial application of pesticides, seed, and fertilizer',
      dysregulation: 'Spray drift, timing miss, flight restriction',
      expectedTypes: [
        { type: 'Aerial application operator', reason: 'Crop dusting, aerial seeding, and aerial fertilizer', confidence: 0.92 },
        { type: 'Ag drone spray service', reason: 'Precision drone application for specialty crops', confidence: 0.85 }
      ]
    },
    'FORN': { fullName: 'Fornix', label: 'Agricultural Supply Networks', tier: 'operational',
      neuroTranslation: { inNeurology: 'Dedicated fiber pathway.', inBusiness: 'In agriculture, these are fixed supply channels from manufacturers to farm communities.' },
      function: 'Connects input manufacturers to farm communities through distribution channels',
      dysregulation: 'Supply channel disruption, dealer closure, distribution gap',
      expectedTypes: [
        { type: 'Agricultural distribution cooperative', reason: 'Farmer-owned input supply and grain marketing', confidence: 0.92 },
        { type: 'Feed mill operator', reason: 'Commercial livestock feed manufacturing and delivery', confidence: 0.88 }
      ]
    },
    'FPN': { fullName: 'Frontoparietal Network', label: 'AgTech & Digital Farming', tier: 'operational',
      neuroTranslation: { inNeurology: 'Executive control and task-switching.', inBusiness: 'In agriculture, this is digital farming platforms and robotic agriculture.' },
      function: 'Deploys digital farming platforms, AI agronomics, and robotic agriculture',
      dysregulation: 'Platform integration failure, data silo, AgTech adoption gap',
      expectedTypes: [
        { type: 'Digital farming platform', reason: 'Cloud crop planning, monitoring, and analytics', confidence: 0.90 },
        { type: 'Agricultural robotics company', reason: 'Autonomous tractors, weeding robots, and harvest automation', confidence: 0.85 }
      ]
    },
    'GABA_GLU': { fullName: 'GABA/Glutamate Balance', label: 'Integrated Pest Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fundamental balance for neural stability.', inBusiness: 'In agriculture, this is IPM — balancing biological and chemical pest controls.' },
      function: 'Balances biological, cultural, and chemical pest management',
      dysregulation: 'IPM threshold error, resistance development, biological control failure',
      expectedTypes: [
        { type: 'IPM consultancy', reason: 'IPM program design and monitoring', confidence: 0.88 },
        { type: 'Beneficial insect producer', reason: 'Parasitoid wasps, ladybugs, and lacewings', confidence: 0.82 }
      ]
    },
    'GBA': { fullName: 'Gut-Brain Axis', label: 'Soil Microbiome', tier: 'operational',
      neuroTranslation: { inNeurology: 'Bidirectional gut-brain communication.', inBusiness: 'In agriculture, this is the soil microbiome driving nutrient cycling and disease suppression.' },
      function: 'Manages soil microbial communities for fertility and plant health',
      dysregulation: 'Microbiome crash, mycorrhizae loss, nutrient cycling breakdown',
      expectedTypes: [
        { type: 'Soil microbiome testing service', reason: 'DNA-based soil biology assessment', confidence: 0.88 },
        { type: 'Microbial inoculant manufacturer', reason: 'Rhizobium, mycorrhizae, and PGPB products', confidence: 0.85 }
      ]
    },
    'GP': { fullName: 'Globus Pallidus', label: 'Agricultural Permitting', tier: 'operational',
      neuroTranslation: { inNeurology: 'Gates motor programs.', inBusiness: 'In agriculture, this is permitting — CAFO permits, pesticide licenses, organic certification.' },
      function: 'Gates agricultural operations through permits, licenses, and certifications',
      dysregulation: 'Permit denial, license lapse, certification revocation',
      expectedTypes: [
        { type: 'Agricultural permitting consultancy', reason: 'CAFO permits, NPDES, and state ag permits', confidence: 0.88 },
        { type: 'Organic certification agency', reason: 'USDA organic certification and compliance', confidence: 0.85 }
      ]
    },
    'HAB': { fullName: 'Habenula', label: 'Agricultural Lessons Learned', tier: 'operational',
      neuroTranslation: { inNeurology: 'Encodes negative outcomes.', inBusiness: 'In agriculture, this is lessons learned — crop failure post-mortems and variety trials.' },
      function: 'Captures crop failure analysis, variety trial data, and agronomic lessons',
      dysregulation: 'Repeated variety error, ignored trial data, no post-season review',
      expectedTypes: [
        { type: 'Variety trial data service', reason: 'University and independent seed performance reporting', confidence: 0.88 },
        { type: 'Post-season crop analysis firm', reason: 'Yield map analysis and input ROI assessment', confidence: 0.82 }
      ]
    },
    'HPA': { fullName: 'HPA Axis', label: 'Agricultural Crisis Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustained stress response.', inBusiness: 'In agriculture, this is sustained crisis management — drought, disease outbreaks, and market collapse.' },
      function: 'Manages sustained agricultural crises',
      dysregulation: 'Prolonged crisis without strategy, farmer burnout',
      expectedTypes: [
        { type: 'Agricultural crisis management consultancy', reason: 'Drought plans, disaster recovery strategy', confidence: 0.85 },
        { type: 'Farm stress and mental health service', reason: 'Farmer mental health support and crisis hotlines', confidence: 0.82 }
      ]
    },
    'IC': { fullName: 'Inferior Colliculus', label: 'Grain Quality Testing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Subcortical auditory relay.', inBusiness: 'In agriculture, this is quality testing — moisture, protein, and mycotoxin screening.' },
      function: 'Tests grain moisture, test weight, protein, oil, and mycotoxin levels',
      dysregulation: 'Moisture meter error, mycotoxin miss, quality discount',
      expectedTypes: [
        { type: 'Grain quality testing equipment vendor', reason: 'NIR analyzers, moisture meters, and test weight scales', confidence: 0.90 },
        { type: 'Mycotoxin testing laboratory', reason: 'Aflatoxin, DON, and fumonisin rapid testing', confidence: 0.85 }
      ]
    },
    'IPS': { fullName: 'Intraparietal Sulcus', label: 'Farm Cost & Yield Estimation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes numerical magnitude.', inBusiness: 'In agriculture, this is cost and yield estimation.' },
      function: 'Estimates per-acre costs, yield projections, and break-even prices',
      dysregulation: 'Cost estimation error, yield overestimate, profitability miscalculation',
      expectedTypes: [
        { type: 'Farm cost-of-production analyst', reason: 'Per-acre cost budgets and margin calculation', confidence: 0.88 },
        { type: 'Yield estimation service', reason: 'Pre-harvest yield checks and satellite prediction', confidence: 0.80 }
      ]
    },
    'LAR': { fullName: 'Laryngeal', label: 'Agricultural Communications', tier: 'operational',
      neuroTranslation: { inNeurology: 'Voice production.', inBusiness: 'In agriculture, this is public communication — market reports, pest alerts, and bulletins.' },
      function: 'Publishes market reports, pest alerts, and extension bulletins',
      dysregulation: 'Missed pest alert, late market report',
      expectedTypes: [
        { type: 'Agricultural media and publishing', reason: 'Farm magazines, ag radio, and digital news', confidence: 0.82 },
        { type: 'Extension communication service', reason: 'Pest alerts and weather advisories for growers', confidence: 0.80 }
      ]
    },
    'LC': { fullName: 'Locus Coeruleus', label: 'Farm Alert Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Modulates arousal and vigilance.', inBusiness: 'In agriculture, this is the alert layer — frost warnings, pest thresholds, and price triggers.' },
      function: 'Triggers frost alerts, pest threshold warnings, and price alerts',
      dysregulation: 'Missed frost warning, alarm fatigue, unnoticed price trigger',
      expectedTypes: [
        { type: 'Farm alert and notification system', reason: 'Automated weather, equipment, and market alerts', confidence: 0.85 },
        { type: 'Frost detection and protection vendor', reason: 'Frost sensors, wind machines, and orchard heaters', confidence: 0.82 }
      ]
    },
    'LGN': { fullName: 'Lateral Geniculate Nucleus', label: 'Visual Crop Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary visual relay.', inBusiness: 'In agriculture, this is visual crop assessment — stand counts and health evaluation.' },
      function: 'Provides visual assessment of crop stand, vigor, and canopy development',
      dysregulation: 'Missed visual symptoms, delayed disease ID',
      expectedTypes: [
        { type: 'Crop scouting app vendor', reason: 'Mobile scouting with photo documentation and GPS', confidence: 0.85 },
        { type: 'Plant disease diagnostic laboratory', reason: 'Lab-based pathogen identification', confidence: 0.82 }
      ]
    },
    'MAMM': { fullName: 'Mammillary Bodies', label: 'Farm Historical Records', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays hippocampal memory.', inBusiness: 'In agriculture, this is historical records — planting histories, yield maps, and soil test data.' },
      function: 'Preserves planting histories, yield maps, and multi-year field data',
      dysregulation: 'Lost field records, no yield history, missing soil baseline',
      expectedTypes: [
        { type: 'Farm records management platform', reason: 'Multi-year field history and input tracking', confidence: 0.85 },
        { type: 'Yield data analytics service', reason: 'Historical yield map analysis and trend reporting', confidence: 0.82 }
      ]
    },
    'MDT': { fullName: 'Mediodorsal Thalamus', label: 'Agricultural Decision Support', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays to prefrontal cortex for decisions.', inBusiness: 'In agriculture, this is decision support — crop models and economic tools.' },
      function: 'Provides crop models and economic tools for planting and marketing decisions',
      dysregulation: 'Model error, decision paralysis',
      expectedTypes: [
        { type: 'Agricultural decision support software', reason: 'Planting date, hybrid selection, and input optimization', confidence: 0.88 },
        { type: 'Farm economic analysis tool', reason: 'Enterprise budgets and what-if scenarios', confidence: 0.80 }
      ]
    },
    'MGN': { fullName: 'Medial Geniculate Nucleus', label: 'Farm Sensor Telemetry', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays auditory information.', inBusiness: 'In agriculture, this is sensor telemetry — soil probes, weather stations, and bin monitors.' },
      function: 'Streams real-time data from field sensors, weather stations, and bin monitors',
      dysregulation: 'Sensor failure, data gap, telemetry latency',
      expectedTypes: [
        { type: 'Farm telemetry system vendor', reason: 'Cellular and radio data collection from ag sensors', confidence: 0.88 },
        { type: 'Soil moisture probe manufacturer', reason: 'Capacitance and TDR probes for irrigation scheduling', confidence: 0.85 },
        { type: 'Grain bin monitoring system', reason: 'Temperature, moisture, and fan status monitoring', confidence: 0.82 }
      ]
    },
    'MICRO': { fullName: 'Microbiome', label: 'Soil Biology & Carbon', tier: 'operational',
      neuroTranslation: { inNeurology: 'Gut microbiome.', inBusiness: 'In agriculture, this is soil carbon and biology — the underground ecosystem driving fertility.' },
      function: 'Manages soil carbon sequestration, organic matter, and biological fertility',
      dysregulation: 'Carbon loss from tillage, organic matter decline',
      expectedTypes: [
        { type: 'Agricultural carbon credit program', reason: 'Soil carbon measurement, verification, and trading', confidence: 0.88 },
        { type: 'Cover crop seed supplier', reason: 'Multi-species blends for soil biology building', confidence: 0.85 },
        { type: 'Regenerative agriculture consultancy', reason: 'No-till, cover crop, and soil health system design', confidence: 0.82 }
      ]
    },
    'NBM': { fullName: 'Nucleus Basalis of Meynert', label: 'Agricultural Workforce', tier: 'operational',
      neuroTranslation: { inNeurology: 'Cortical acetylcholine for attention and learning.', inBusiness: 'In agriculture, this is farm workforce — H-2A workers and skilled employees.' },
      function: 'Recruits, trains, and manages farm labor including seasonal and H-2A workers',
      dysregulation: 'Labor shortage at harvest, H-2A delay, worker injury',
      expectedTypes: [
        { type: 'Farm labor contractor', reason: 'H-2A recruitment, housing, and management', confidence: 0.90 },
        { type: 'Farm safety training provider', reason: 'OSHA ag standards and equipment safety training', confidence: 0.78 }
      ]
    },
    'NEOCER': { fullName: 'Neocerebellum', label: 'Food Safety & Quality', tier: 'operational',
      neuroTranslation: { inNeurology: 'Cognitive error correction.', inBusiness: 'In agriculture, this is food safety — GAP audits, FSMA, and quality assurance.' },
      function: 'Ensures food safety through GAP certification, FSMA, and quality audits',
      dysregulation: 'Contamination event, GAP failure, recall',
      expectedTypes: [
        { type: 'Food safety audit firm', reason: 'GAP, GMP, HACCP, and SQF auditing', confidence: 0.92 },
        { type: 'FSMA compliance consultancy', reason: 'Produce safety rule and preventive controls', confidence: 0.88 },
        { type: 'Food testing laboratory', reason: 'Pathogen testing and residue analysis', confidence: 0.85 }
      ]
    },
    'OLF': { fullName: 'Olfactory', label: 'Agricultural Odor & Environmental', tier: 'operational',
      neuroTranslation: { inNeurology: 'Airborne chemical signals.', inBusiness: 'In agriculture, this is odor and drift monitoring at agricultural operations.' },
      function: 'Monitors and mitigates odor, spray drift, and air quality',
      dysregulation: 'Odor complaint, spray drift incident, air quality violation',
      expectedTypes: [
        { type: 'Livestock odor mitigation vendor', reason: 'Biofilters, covers, and manure additives', confidence: 0.82 },
        { type: 'Spray drift monitoring service', reason: 'Drift prediction and complaint investigation', confidence: 0.80 }
      ]
    },
    'OPIOID': { fullName: 'Opioid System', label: 'Farm Pain-Point Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Endogenous pain modulation.', inBusiness: 'In agriculture, this is fixing the most acute operational bottleneck.' },
      function: 'Resolves the most acute operational bottlenecks on the farm',
      dysregulation: 'Chronic unresolved bottleneck, repeated breakdowns',
      expectedTypes: [
        { type: 'Mobile farm repair service', reason: 'Emergency field repair of combines and tractors', confidence: 0.90 },
        { type: 'Agricultural drainage contractor', reason: 'Tile installation and wet spot remediation', confidence: 0.88 }
      ]
    },
    'OSC': { fullName: 'Oscillatory', label: 'Seasonal Farming Rhythms', tier: 'operational',
      neuroTranslation: { inNeurology: 'Neural oscillations synchronize activity.', inBusiness: 'In agriculture, this is seasonal rhythm — planting, growing, harvesting cycles.' },
      function: 'Synchronizes planting windows, spray timing, and harvest schedule',
      dysregulation: 'Planting window miss, harvest timing error',
      expectedTypes: [
        { type: 'Growing season planning tool', reason: 'GDD tracking and planting window optimization', confidence: 0.85 },
        { type: 'Crop insurance date management', reason: 'Final plant date and prevented planting tracking', confidence: 0.78 }
      ]
    },
    'PAG': { fullName: 'Periaqueductal Gray', label: 'Veterinary & Animal Health', tier: 'operational',
      neuroTranslation: { inNeurology: 'Defensive responses and pain modulation.', inBusiness: 'In agriculture, this is veterinary services — livestock illness and herd health.' },
      function: 'Provides veterinary diagnosis, treatment, herd health, and disease prevention',
      dysregulation: 'Disease outbreak, antibiotic resistance, veterinary shortage',
      expectedTypes: [
        { type: 'Large animal veterinary practice', reason: 'Beef, dairy, swine, and poultry veterinary services', confidence: 0.95 },
        { type: 'Animal health product manufacturer', reason: 'Vaccines, parasiticides, and veterinary pharmaceuticals', confidence: 0.90 },
        { type: 'Herd health management software', reason: 'Individual animal tracking and treatment records', confidence: 0.82 }
      ]
    },
    'PBN': { fullName: 'Parabrachial Nucleus', label: 'Animal Comfort & Welfare', tier: 'operational',
      neuroTranslation: { inNeurology: 'Temperature and comfort signals.', inBusiness: 'In agriculture, this is animal comfort — heat stress, bedding, and welfare housing.' },
      function: 'Ensures animal thermal comfort, housing, and welfare compliance',
      dysregulation: 'Heat stress mortality, inadequate bedding, welfare audit failure',
      expectedTypes: [
        { type: 'Livestock heat stress abatement vendor', reason: 'Soaking systems, shade, and cooling fans', confidence: 0.85 },
        { type: 'Animal welfare certification program', reason: 'Certified Humane, GAP, and welfare audits', confidence: 0.78 }
      ]
    },
    'PCC': { fullName: 'Posterior Cingulate Cortex', label: 'Farm Performance Benchmarking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-referential evaluation.', inBusiness: 'In agriculture, this is benchmarking — comparing against peers and averages.' },
      function: 'Benchmarks farm performance against peer averages and industry standards',
      dysregulation: 'No baseline, inflated self-assessment, performance stagnation',
      expectedTypes: [
        { type: 'Farm benchmarking platform', reason: 'Yield, cost, and profitability comparison', confidence: 0.85 },
        { type: 'Agricultural financial benchmarking firm', reason: 'FINBIN, FBFM financial performance analysis', confidence: 0.78 }
      ]
    },
    'PI': { fullName: 'Posterior Insula', label: 'Crop Damage Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Pain and damage signals.', inBusiness: 'In agriculture, this is crop damage assessment for insurance claims.' },
      function: 'Assesses crop damage from hail, frost, flood, wind, and pest events',
      dysregulation: 'Damage underestimate, missed appraisal deadline',
      expectedTypes: [
        { type: 'Crop insurance adjuster', reason: 'Field damage appraisal and loss determination', confidence: 0.92 },
        { type: 'Hail damage assessment firm', reason: 'Kernel damage and yield reduction from hail', confidence: 0.85 }
      ]
    },
    'PIN': { fullName: 'Pineal', label: 'Crop Maturity & Harvest Timing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Circadian and seasonal timing.', inBusiness: 'In agriculture, this is harvest timing and crop maturity.' },
      function: 'Determines optimal harvest timing based on maturity and moisture',
      dysregulation: 'Premature harvest, excessive dry-down cost, missed window',
      expectedTypes: [
        { type: 'Crop maturity monitoring service', reason: 'Black layer, moisture tracking, and timing recommendation', confidence: 0.85 },
        { type: 'In-field moisture testing vendor', reason: 'Portable and on-combine moisture measurement', confidence: 0.82 }
      ]
    },
    'PIT': { fullName: 'Pituitary', label: 'Agricultural Funding Release', tier: 'operational',
      neuroTranslation: { inNeurology: 'Master gland triggering cascades.', inBusiness: 'In agriculture, this is funding release — FSA loans, indemnities, and program payments.' },
      function: 'Releases FSA loans, crop insurance indemnities, and conservation payments',
      dysregulation: 'Payment delay, indemnity backlog, FSA loan denial',
      expectedTypes: [
        { type: 'FSA loan specialist', reason: 'Operating, ownership, and emergency loan processing', confidence: 0.88 },
        { type: 'Crop insurance indemnity processor', reason: 'Claims processing and payment calculation', confidence: 0.85 }
      ]
    },
    'PPN': { fullName: 'Pedunculopontine Nucleus', label: 'Farm Startup', tier: 'operational',
      neuroTranslation: { inNeurology: 'Initiates locomotion.', inBusiness: 'In agriculture, this is new farm startup and beginning farmer support.' },
      function: 'Launches new farm operations and supports beginning farmers',
      dysregulation: 'Beginning farmer failure, inadequate capital, land access barrier',
      expectedTypes: [
        { type: 'Beginning farmer training program', reason: 'USDA grants, mentoring, and incubator farms', confidence: 0.85 },
        { type: 'Farm startup consultancy', reason: 'Business plan, entity formation, and financing', confidence: 0.82 }
      ]
    },
    'PRECUNEUS': { fullName: 'Precuneus', label: 'Farm Self-Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-awareness and episodic memory.', inBusiness: 'In agriculture, this is farm self-assessment — evaluating strengths and weaknesses.' },
      function: 'Evaluates farm operation strengths, weaknesses, and improvement opportunities',
      dysregulation: 'No self-assessment, blind spots, complacency',
      expectedTypes: [
        { type: 'Farm management review service', reason: 'Comprehensive operation assessment', confidence: 0.82 },
        { type: 'Peer advisory group facilitator', reason: 'Farmer-to-farmer benchmarking circles', confidence: 0.78 }
      ]
    },
    'PULV': { fullName: 'Pulvinar', label: 'Farm Dashboard & Visibility', tier: 'operational',
      neuroTranslation: { inNeurology: 'Visual attention and filtering.', inBusiness: 'In agriculture, this is the unified farm dashboard.' },
      function: 'Provides unified dashboards showing field status, equipment, weather, and markets',
      dysregulation: 'Information overload, stale dashboard, no unified view',
      expectedTypes: [
        { type: 'Farm operations dashboard vendor', reason: 'Single-pane farm status with weather, equipment, and fields', confidence: 0.85 },
        { type: 'Real-time grain market display', reason: 'Live futures, basis, and cash prices for farm office', confidence: 0.78 }
      ]
    },
    'PUT': { fullName: 'Putamen', label: 'Field Operations Execution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Habitual motor sequences.', inBusiness: 'In agriculture, this is repetitive field operations — tillage, planting, spraying, harvesting.' },
      function: 'Executes repetitive field operations: tillage, planting, spraying, harvest swaths',
      dysregulation: 'Skip in planting, overlap in spraying, missed harvest pass',
      expectedTypes: [
        { type: 'Precision planting equipment vendor', reason: 'Row-by-row control, singulation, and downforce', confidence: 0.90 },
        { type: 'Spray application technology vendor', reason: 'PWM, individual nozzle control, and boom height', confidence: 0.88 }
      ]
    },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Farm Quality of Life', tier: 'operational',
      neuroTranslation: { inNeurology: 'Serotonin — mood regulation.', inBusiness: 'In agriculture, this is farm family wellbeing.' },
      function: 'Supports farm family wellbeing and rural quality of life',
      dysregulation: 'Farmer burnout, isolation, inadequate rural services',
      expectedTypes: [
        { type: 'Farm family wellness program', reason: 'Mental health, financial stress counseling', confidence: 0.82 },
        { type: 'Agritourism development firm', reason: 'Farm stays, u-pick, and diversification', confidence: 0.75 }
      ]
    },
    'RF': { fullName: 'Reticular Formation', label: 'Farm Readiness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Wakefulness and alertness.', inBusiness: 'In agriculture, this is operational readiness before each season.' },
      function: 'Stages inputs, parts, fuel, and equipment before each critical season',
      dysregulation: 'Unprepped for planting, parts shortage at harvest',
      expectedTypes: [
        { type: 'Farm pre-season preparation service', reason: 'Equipment inspection and wear parts replacement', confidence: 0.85 },
        { type: 'Bulk fuel delivery for farms', reason: 'On-farm diesel and DEF storage and delivery', confidence: 0.82 }
      ]
    },
    'RSC': { fullName: 'Retrosplenial Cortex', label: 'Farm Navigation & Field Marking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Spatial orientation.', inBusiness: 'In agriculture, this is field marking — boundaries, AB lines, and markers.' },
      function: 'Marks field boundaries, guidance lines, tile outlets, and waterway locations',
      dysregulation: 'Lost AB lines, unmarked tile outlets, boundary dispute',
      expectedTypes: [
        { type: 'GPS boundary and mapping service', reason: 'Field boundary surveys and zone mapping', confidence: 0.85 },
        { type: 'RTK base station provider', reason: 'Local and network RTK for sub-inch guidance', confidence: 0.82 }
      ]
    },
    'SC': { fullName: 'Superior Colliculus', label: 'Rapid Crop Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Rapid visual orienting.', inBusiness: 'In agriculture, this is rapid field checks during critical season.' },
      function: 'Performs rapid field checks, stand counts, and quick assessments',
      dysregulation: 'Missed emerging problem during quick check',
      expectedTypes: [
        { type: 'Rapid field assessment app', reason: 'Quick stand count and issue flagging from phone', confidence: 0.82 },
        { type: 'Quick-turn tissue testing', reason: 'Same-day plant tissue nutrient analysis', confidence: 0.80 }
      ]
    },
    'SEPT': { fullName: 'Septal Nuclei', label: 'Farm Safety & Rest', tier: 'operational',
      neuroTranslation: { inNeurology: 'Pleasure and fear suppression.', inBusiness: 'In agriculture, this is safety zones and worker facilities.' },
      function: 'Provides shade, water, rest areas, and safety equipment for livestock and workers',
      dysregulation: 'No shade for cattle, inadequate worker facilities',
      expectedTypes: [
        { type: 'Livestock shade structure manufacturer', reason: 'Portable and permanent shade for feedlots', confidence: 0.82 },
        { type: 'Roadside safety device manufacturer', reason: 'SMV signs, guardrails for farm entrances', confidence: 0.78 }
      ]
    },
    'SMA': { fullName: 'Supplementary Motor Area', label: 'Pre-Season Farm Planning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Plans complex sequences before execution.', inBusiness: 'In agriculture, this is pre-season planning.' },
      function: 'Plans crop selections, input orders, and equipment prep before season',
      dysregulation: 'Late crop plan, unordered inputs, equipment unprepped',
      expectedTypes: [
        { type: 'Crop planning consultancy', reason: 'Hybrid selection, population rates, and input planning', confidence: 0.88 },
        { type: 'Pre-season agronomy service', reason: 'Soil sampling and fertility recommendations', confidence: 0.85 }
      ]
    },
    'SMN': { fullName: 'Somatomotor Network', label: 'Farm Field Crew Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Coordinated body movement.', inBusiness: 'In agriculture, this is field crew coordination.' },
      function: 'Coordinates operators, grain carts, trucks, and tenders across fields',
      dysregulation: 'Truck not at combine, grain cart miscommunication',
      expectedTypes: [
        { type: 'Harvest logistics platform', reason: 'Real-time combine-cart-truck coordination', confidence: 0.85 },
        { type: 'Farm crew communication system', reason: 'Multi-channel radios for field operations', confidence: 0.80 }
      ]
    },
    'SN': { fullName: 'Salience Network', label: 'Agricultural Priority Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects salient events.', inBusiness: 'In agriculture, this is priority detection — which problem to address first.' },
      function: 'Identifies the most urgent farm action and triggers resource reallocation',
      dysregulation: 'Wrong priority, missed critical window, overreaction to minor issue',
      expectedTypes: [
        { type: 'Farm decision prioritization tool', reason: 'Risk-based priority scoring across weather, pest, and market', confidence: 0.82 },
        { type: 'Agronomic urgency alert service', reason: 'Threshold alerts prioritized by economic impact', confidence: 0.80 }
      ]
    },
    'SNIG': { fullName: 'Substantia Nigra', label: 'Farm Energy & Fuel Supply', tier: 'operational',
      neuroTranslation: { inNeurology: 'Dopamine source for initiating movement.', inBusiness: 'In agriculture, this is farm energy — diesel, propane, and electricity.' },
      function: 'Supplies diesel, propane, electricity, and gas for farm operations',
      dysregulation: 'Diesel shortage at harvest, propane curtailment for grain drying',
      expectedTypes: [
        { type: 'Farm fuel supplier', reason: 'Bulk diesel, gasoline, and DEF delivery', confidence: 0.90 },
        { type: 'Propane delivery service', reason: 'LP gas for grain drying and livestock heating', confidence: 0.88 }
      ]
    },
    'SNS': { fullName: 'Sympathetic Nervous System', label: 'Harvest Surge Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fight-or-flight activation.', inBusiness: 'In agriculture, this is harvest surge — intense mobilization during narrow windows.' },
      function: 'Surges all available resources during narrow harvest and planting windows',
      dysregulation: 'Insufficient combine capacity, harvest crew shortage',
      expectedTypes: [
        { type: 'Custom harvest crew operator', reason: 'Traveling combine crews following harvest', confidence: 0.90 },
        { type: 'Seasonal equipment rental', reason: 'Short-term combine and truck rental for harvest', confidence: 0.85 }
      ]
    },
    'STN': { fullName: 'Subthalamic Nucleus', label: 'Agricultural Enforcement', tier: 'operational',
      neuroTranslation: { inNeurology: 'Brake on inappropriate actions.', inBusiness: 'In agriculture, this stops non-compliant practices.' },
      function: 'Enforces pesticide use rules, food safety standards, and environmental compliance',
      dysregulation: 'Unenforced violation, ignored water quality standard',
      expectedTypes: [
        { type: 'Pesticide enforcement consultancy', reason: 'FIFRA compliance and restricted use violations', confidence: 0.85 },
        { type: 'Food safety recall management', reason: 'FDA recall procedures and corrective action', confidence: 0.82 }
      ]
    },
    'STS': { fullName: 'Superior Temporal Sulcus', label: 'Consumer & Market Behavior', tier: 'operational',
      neuroTranslation: { inNeurology: 'Understanding intentions from behavior.', inBusiness: 'In agriculture, this is consumer behavior affecting production decisions.' },
      function: 'Analyzes food consumer trends affecting production decisions',
      dysregulation: 'Misread food trend, overproduction of wrong commodity',
      expectedTypes: [
        { type: 'Agricultural market research firm', reason: 'Consumer preference surveys and demand forecasting', confidence: 0.85 },
        { type: 'Farm-to-consumer marketing advisor', reason: 'Direct branding, e-commerce, and niche strategy', confidence: 0.78 }
      ]
    },
    'TPJ': { fullName: 'Temporoparietal Junction', label: 'Agricultural Stakeholder Relations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Understanding others\' perspectives.', inBusiness: 'In agriculture, this is stakeholder relations — balancing farmers, consumers, and regulators.' },
      function: 'Balances diverse stakeholder perspectives in agricultural policy',
      dysregulation: 'Farmer-environmentalist conflict, urban-rural disconnect',
      expectedTypes: [
        { type: 'Farm advocacy organization', reason: 'Farm Bureau, commodity groups, and grower associations', confidence: 0.85 },
        { type: 'Agricultural public relations firm', reason: 'Agricultural literacy and consumer trust', confidence: 0.78 }
      ]
    },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Agricultural Heritage', tier: 'operational',
      neuroTranslation: { inNeurology: 'Semantic memory and social associations.', inBusiness: 'In agriculture, this is farm heritage and cultural identity.' },
      function: 'Preserves family farm identity and agricultural heritage',
      dysregulation: 'Family farm identity loss, heritage erosion',
      expectedTypes: [
        { type: 'Agricultural branding and storytelling firm', reason: 'Farm brand identity and heritage marketing', confidence: 0.78 },
        { type: 'Rural cultural tourism developer', reason: 'Farm tours and harvest festivals', confidence: 0.72 }
      ]
    },
    'TrkB': { fullName: 'TrkB Receptor', label: 'Agricultural Technology Adoption', tier: 'operational',
      neuroTranslation: { inNeurology: 'BDNF receptor enabling plasticity.', inBusiness: 'In agriculture, this is technology adoption receptiveness.' },
      function: 'Evaluates and adopts new agricultural technologies and practices',
      dysregulation: 'Technology resistance, failed pilot, adoption without understanding',
      expectedTypes: [
        { type: 'Agricultural technology demonstration farm', reason: 'On-farm tech trials and farmer demonstration', confidence: 0.82 },
        { type: 'Ag technology evaluation service', reason: 'Independent assessment of new products', confidence: 0.80 }
      ]
    },
    'UNC': { fullName: 'Uncinate Fasciculus', label: 'Agricultural Market Connections', tier: 'operational',
      neuroTranslation: { inNeurology: 'Connects frontal and temporal lobes.', inBusiness: 'In agriculture, this links production to distant markets.' },
      function: 'Connects agricultural production to distant markets via contracts and exports',
      dysregulation: 'Export market loss, contract default, trade breakdown',
      expectedTypes: [
        { type: 'Agricultural export trading company', reason: 'Grain, meat, and specialty crop export', confidence: 0.90 },
        { type: 'Contract farming platform', reason: 'Connects growers with buyers via forward contracts', confidence: 0.85 }
      ]
    },
    'V1': { fullName: 'Primary Visual Cortex', label: 'Agricultural Imaging', tier: 'operational',
      neuroTranslation: { inNeurology: 'First stage of visual processing.', inBusiness: 'In agriculture, this is raw imagery — satellite, drone, and aerial photography.' },
      function: 'Captures satellite, drone, and aerial imagery for crop assessment',
      dysregulation: 'Cloud cover, resolution insufficient, timing miss',
      expectedTypes: [
        { type: 'Agricultural satellite imagery provider', reason: 'Planet, Sentinel imagery for crop monitoring', confidence: 0.90 },
        { type: 'Ag drone imaging service', reason: 'Multispectral and thermal drone imagery', confidence: 0.88 }
      ]
    },
    'VAN': { fullName: 'Ventral Attention Network', label: 'Unexpected Agricultural Events', tier: 'operational',
      neuroTranslation: { inNeurology: 'Bottom-up surprise detection.', inBusiness: 'In agriculture, this detects surprise hailstorms, sudden pest emergence, and market crashes.' },
      function: 'Detects unexpected hail, pest emergence, market crashes, and equipment failures',
      dysregulation: 'Surprise hail undetected, sudden outbreak missed',
      expectedTypes: [
        { type: 'Severe weather alert for agriculture', reason: 'Hail, tornado, and microburst farm-specific alerting', confidence: 0.88 },
        { type: 'Pest emergence early warning', reason: 'Trap network and first-flight notifications', confidence: 0.85 }
      ]
    },
    'VERM': { fullName: 'Vermis', label: 'Grain Bin & Storage Stability', tier: 'operational',
      neuroTranslation: { inNeurology: 'Balance and equilibrium.', inBusiness: 'In agriculture, this is grain bin stability and stored grain condition.' },
      function: 'Monitors grain bin structural integrity and stored grain condition',
      dysregulation: 'Bin collapse, foundation settlement, grain bridging',
      expectedTypes: [
        { type: 'Grain bin manufacturer', reason: 'Steel grain storage bins and hopper bottoms', confidence: 0.92 },
        { type: 'Bin site construction contractor', reason: 'Concrete pads, foundations, and handling systems', confidence: 0.88 },
        { type: 'Stored grain management service', reason: 'Aeration, fumigation, and condition monitoring', confidence: 0.85 }
      ]
    },
    'VEST': { fullName: 'Vestibular', label: 'Terrain & Slope Farming', tier: 'operational',
      neuroTranslation: { inNeurology: 'Position and movement for balance.', inBusiness: 'In agriculture, this is terrain management — slopes, terraces, and variable terrain.' },
      function: 'Manages farming on slopes, terraces, and variable terrain',
      dysregulation: 'Tractor rollover, terrace failure, hillside erosion',
      expectedTypes: [
        { type: 'Terrace and waterway construction contractor', reason: 'Conservation terraces and grassed waterways', confidence: 0.88 },
        { type: 'Erosion control consultancy', reason: 'T-value compliance and RUSLE modeling', confidence: 0.78 }
      ]
    },
    'VP': { fullName: 'Ventral Pallidum', label: 'Agricultural Resilience', tier: 'operational',
      neuroTranslation: { inNeurology: 'Motivational drive.', inBusiness: 'In agriculture, this is farm resilience — diversification and adaptive capacity.' },
      function: 'Builds farm resilience through diversification, reserves, and adaptive capacity',
      dysregulation: 'Single-crop dependency, no reserves, brittle operation',
      expectedTypes: [
        { type: 'Farm diversification consultancy', reason: 'Enterprise diversification and alternative revenue', confidence: 0.85 },
        { type: 'Agricultural risk management advisor', reason: 'Portfolio hedging and crop insurance optimization', confidence: 0.88 }
      ]
    },
    'VTA': { fullName: 'Ventral Tegmental Area', label: 'Agricultural Innovation & R&D', tier: 'operational',
      neuroTranslation: { inNeurology: 'Drives reward-seeking and novelty.', inBusiness: 'In agriculture, this is R&D — new varieties, biological products, and novel methods.' },
      function: 'Conducts R&D on new varieties, biological products, and farming methods',
      dysregulation: 'No R&D investment, stagnant genetics',
      expectedTypes: [
        { type: 'Agricultural R&D company', reason: 'New trait development and field testing', confidence: 0.88 },
        { type: 'Agricultural biotech startup', reason: 'Gene editing, biological treatments, and novel crop protection', confidence: 0.80 }
      ]
    },
    'VV': { fullName: 'Ventral Vagal', label: 'Farm Community & Cooperation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Social engagement and safe connection.', inBusiness: 'In agriculture, this is farm community — cooperatives, mutual aid, and equipment sharing.' },
      function: 'Facilitates cooperative farming, equipment sharing, and neighbor mutual aid',
      dysregulation: 'Co-op governance failure, neighbor dispute, community fragmentation',
      expectedTypes: [
        { type: 'Farmer cooperative', reason: 'Grain marketing, input purchasing, and service co-ops', confidence: 0.92 },
        { type: 'Equipment sharing platform', reason: 'Machinery ring and shared scheduling', confidence: 0.80 }
      ]
    },
    'WERN': { fullName: 'Wernicke\'s Area', label: 'Agricultural Data Interpretation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Comprehends language — extracts meaning.', inBusiness: 'In agriculture, this is data interpretation — making sense of yield maps, soil tests, and market data.' },
      function: 'Interprets yield maps, soil tests, and sensor data into actionable decisions',
      dysregulation: 'Misinterpreted yield map, unused soil test data, information overload',
      expectedTypes: [
        { type: 'Precision ag data interpretation service', reason: 'Yield analysis, zone delineation, and prescriptions', confidence: 0.90 },
        { type: 'Soil test interpretation consultancy', reason: 'Nutrient recommendations from soil test results', confidence: 0.88 }
      ]
    },
    'mPFC': { fullName: 'Medial Prefrontal Cortex', label: 'Farm Strategy & Values', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-referential and value-based decisions.', inBusiness: 'In agriculture, this is farm strategy based on family goals and values.' },
      function: 'Sets farm strategic direction based on family goals and long-term vision',
      dysregulation: 'Strategy-values conflict, generational disagreement, directionless operation',
      expectedTypes: [
        { type: 'Farm strategic planning advisor', reason: 'Family vision facilitation and goal setting', confidence: 0.85 },
        { type: 'Farm transition coach', reason: 'Generational transition and next-gen onboarding', confidence: 0.78 }
      ]
    },
    'rACC': { fullName: 'Rostral ACC', label: 'Agricultural Conflict Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates emotional conflict responses.', inBusiness: 'In agriculture, this is conflict resolution — landlord-tenant, neighbor, and family disputes.' },
      function: 'Resolves disputes between landlords, tenants, neighbors, and family members',
      dysregulation: 'Protracted lease dispute, spray drift lawsuit, family farm split',
      expectedTypes: [
        { type: 'Agricultural mediation service', reason: 'USDA mediation, landlord-tenant, and family disputes', confidence: 0.88 },
        { type: 'Farm legal services', reason: 'Agricultural law, land disputes, and regulatory representation', confidence: 0.85 }
      ]
    },
    'vlPFC': { fullName: 'Ventrolateral PFC', label: 'Farm Contract Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Response inhibition and rule-based decisions.', inBusiness: 'In agriculture, this is contract management — grain delivery, custom work, and leases.' },
      function: 'Manages grain delivery contracts, custom work agreements, and land leases',
      dysregulation: 'Contract default, delivery shortfall, lease term violation',
      expectedTypes: [
        { type: 'Agricultural contract management platform', reason: 'Grain contract tracking and basis monitoring', confidence: 0.85 },
        { type: 'Farm lease management firm', reason: 'Lease rate analysis and renewal negotiation', confidence: 0.78 }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIERARCHY, APPROVAL, INFERENCE, PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  var _hierarchyCache = null, _hierarchyCacheAge = 0;
  function loadFullHierarchy(cb) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) return cb(_hierarchyCache);
    try { var c = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY)); if (c && c._age && (Date.now()-c._age)<HIERARCHY_TTL) { _hierarchyCache=c; _hierarchyCacheAge=c._age; return cb(c); } } catch(e){}
    var b=window.LIMENDomainBrains; if(!b) return cb(null); var brain=b.get('agriculture'); if(!brain||!brain._portalCache) return cb(null);
    var top=brain._portalCache, r={nodeCompanies:{},nodeTreatments:{},nodeDiagnoses:{},nodeLabels:{},nodeDepths:{},allActivations:[]};
    function proc(acts,depth){for(var i=0;i<acts.length;i++){var a=acts[i],nid=a.brainNodeId;if(RI_NODES[nid])continue;if(!r.nodeCompanies[nid])r.nodeCompanies[nid]={};if(!r.nodeTreatments[nid])r.nodeTreatments[nid]={};if(!r.nodeDiagnoses[nid])r.nodeDiagnoses[nid]={};if(!r.nodeLabels[nid])r.nodeLabels[nid]=a.domainLabel||nid;if(!r.nodeDepths[nid])r.nodeDepths[nid]={};r.nodeDepths[nid][depth]=true;var cos=a.companies||[];for(var ci=0;ci<cos.length;ci++){var tk=cos[ci].ticker_or_id||cos[ci].name;if(!r.nodeCompanies[nid][tk])r.nodeCompanies[nid][tk]={name:cos[ci].name,ticker:tk,reason:cos[ci].functional_reason,strength:cos[ci].binding_strength};}var treats=a.treatments||[];for(var ti=0;ti<treats.length;ti++){var t=treats[ti];if(isGenericTreatment(t.label))continue;var tK=(t.label||'')+'|'+(t.type||'');if(!r.nodeTreatments[nid][tK])r.nodeTreatments[nid][tK]={label:t.label,type:t.type,evidence:t.evidence};}var dx=a.diagnosticTriggers||[];for(var di=0;di<dx.length;di++)r.nodeDiagnoses[nid][dx[di]]=true;r.allActivations.push({brainNodeId:nid,depth:depth,label:a.domainLabel,companiesCount:cos.length});}}
    proc(top.activations||[],0); r._age=Date.now(); _hierarchyCache=r; _hierarchyCacheAge=Date.now();
    try{sessionStorage.setItem(HIERARCHY_CACHE_KEY,JSON.stringify(r));}catch(e){} cb(r);
  }
  function loadApprovals(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(e){return{};}}
  function saveApprovals(d){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(e){}}
  function approvalKey(n,t){return n+'::'+t.replace(/[^a-zA-Z0-9 ]/g,'').substring(0,50);}
  function getApprovalStatus(n,t){return loadApprovals()[approvalKey(n,t)]||null;}
  function setApprovalStatus(n,t,s,reason,rev){var a=loadApprovals(),k=approvalKey(n,t),ex=a[k]||{};a[k]={status:s,reason:reason||'',nodeId:n,businessType:t,submitted_by:ex.submitted_by||'operator',submitted_at:ex.submitted_at||Date.now(),reviewed_by:(s!=='PROPOSED')?(rev||'operator'):(ex.reviewed_by||null),reviewed_at:(s!=='PROPOSED')?Date.now():(ex.reviewed_at||null),review_note:(s!=='PROPOSED')?(reason||''):(ex.review_note||''),timestamp:Date.now(),reviewer:rev||'operator'};saveApprovals(a);return a[k];}
  function getState(){var b=window.LIMENDomainBrains;if(!b)return null;var brain=b.get('agriculture');return brain?brain.getState():null;}
  function runInference(hd){
    var state=getState();if(!state)return{mapped:[],missing:[],speculative:[],error:'No brain state'};
    var adx=(state.diagnoses||[]).filter(function(d){return d.active;}),ap=loadApprovals(),nci={};
    if(hd&&hd.nodeCompanies)nci=hd.nodeCompanies;else{var b=window.LIMENDomainBrains,br=b?b.get('agriculture'):null,p=br?br._portalCache:null;if(p&&p.activations)for(var ai=0;ai<p.activations.length;ai++){var act=p.activations[ai],nid=act.brainNodeId;if(!nci[nid])nci[nid]={};var cos=act.companies||[];for(var ci=0;ci<cos.length;ci++){var tk=cos[ci].ticker_or_id||cos[ci].name;nci[nid][tk]={name:cos[ci].name,ticker:tk,reason:cos[ci].functional_reason};}}}
    var mapped=[],missing=[],speculative=[];
    for(var nodeId in NODE_BUSINESS_DIRECTORY){if(RI_NODES[nodeId])continue;var dir=NODE_BUSINESS_DIRECTORY[nodeId],et=dir.expectedTypes||[],na=false;for(var di=0;di<adx.length;di++){var cir=adx[di].circuits||[];for(var cci=0;cci<cir.length;cci++){if(cir[cci].nodeId===nodeId){na=true;break;}}if(na)break;}var ec=nci[nodeId]||{},mcn=[];for(var tk in ec)mcn.push(ec[tk].name+' ('+tk+')');
    for(var ti=0;ti<et.length;ti++){var exp=et[ti],key=approvalKey(nodeId,exp.type),apr=ap[key]||null,am=false,tw=exp.type.toLowerCase().split(/\s+/);for(var mi=0;mi<mcn.length;mi++){var cl=mcn[mi].toLowerCase(),mc=0;for(var wi=0;wi<tw.length;wi++){if(tw[wi].length>3&&cl.indexOf(tw[wi])!==-1)mc++;}if(mc>=2){am=true;break;}}if(!am)for(var ck in ec){var fr=(ec[ck].reason||'').toLowerCase(),mc2=0;for(var w2=0;w2<tw.length;w2++){if(tw[w2].length>3&&fr.indexOf(tw[w2])!==-1)mc2++;}if(mc2>=2){am=true;break;}}
    var con='';if(!am){if(exp.confidence>=0.85)con='If approved: eligible for opportunity generation for Agriculture tied to '+dir.label+'.';else if(exp.confidence>=0.75)con='If approved: eligible for portal path mapping within Agriculture.';else con='If approved: recorded as valid Agriculture mapping. Requires validation.';}
    var vs='ACTIVE';if(apr){if(apr.status==='DENIED')vs='REJECTED';else if(apr.status==='APPROVED')vs='ACTIVE';else vs='PROPOSED';}else if(!am&&exp.confidence>=0.75)vs='MISSING';else if(!am)vs='PROPOSED';else vs='MAPPED';
    var sb=!!apr||vs==='PROPOSED'||vs==='MISSING',ck2=nodeId+'::'+(exp.type||'').replace(/[^a-zA-Z0-9 ]/g,'').substring(0,50);
    var ent={cardKey:ck2,nodeId:nodeId,nodeFullName:dir.fullName||nodeId,nodeLabel:dir.label,nodeFunction:dir.function,plainFunction:dir.function,dysregulation:dir.dysregulation||'',plainDysregulation:dir.dysregulation||'',neuroTranslation:dir.neuroTranslation||null,businessType:exp.type,reason:exp.reason,confidence:exp.confidence,nodeActive:na,alreadyMapped:am,existingCompanies:mcn,approval:apr,approvalRequired:sb,variantState:vs,approvalConsequence:con,tier:dir.tier||'operational',reasoning:nodeId+' ('+(dir.fullName||'')+') \u2014 '+dir.label+'\n'+dir.function+'\n'+(dir.dysregulation?'When dysregulated: '+dir.dysregulation+'\n':'')+'Creates demand for: '+exp.type+'. '+exp.reason+'.'};
    if(am){ent.bucket='MAPPED';mapped.push(ent);}else if(exp.confidence>=0.75){ent.bucket='MISSING';if(!apr){setApprovalStatus(nodeId,exp.type,'PROPOSED','Auto-proposed');ent.approval=getApprovalStatus(nodeId,exp.type);}missing.push(ent);}else{ent.bucket='SPECULATIVE';if(!apr){setApprovalStatus(nodeId,exp.type,'PROPOSED','Auto-proposed \u2014 low confidence');ent.approval=getApprovalStatus(nodeId,exp.type);}speculative.push(ent);}}}
    function dd(arr){var s={},o=[];for(var i=0;i<arr.length;i++){var dk=arr[i].cardKey+'|'+arr[i].bucket+'|'+arr[i].variantState;if(!s[dk]){s[dk]=true;o.push(arr[i]);}}return o;}
    mapped=dd(mapped);missing=dd(missing);speculative=dd(speculative);
    var sf=function(a,b){var ta=a.tier==='top'?0:1,tb=b.tier==='top'?0:1;if(ta!==tb)return ta-tb;if(a.nodeActive!==b.nodeActive)return a.nodeActive?-1:1;return b.confidence-a.confidence;};
    mapped.sort(sf);missing.sort(sf);speculative.sort(sf);
    return{mapped:mapped,missing:missing,speculative:speculative,error:null};
  }
  function getApprovedMappings(){var r=runInference(null),a=[],all=r.missing.concat(r.speculative);for(var i=0;i<all.length;i++){if(all[i].approval&&all[i].approval.status==='APPROVED')a.push(all[i]);}return a;}

  window.LIMENAgricultureBusinessEngine = {
    runInference: function(){return runInference(_hierarchyCache);},
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

  loadFullHierarchy(function(){console.log('[AgricultureBusinessEngine] Hierarchy loaded');});
  console.log('[AgricultureBusinessEngine] Loaded \u2014 103-node full-hierarchy agriculture business assignment engine');
})();
