/**
 * environment-opportunity-playbooks.js
 *
 * Canonical Environment domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the environment-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENEnvironmentOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "climate_tipping_point",
    "title": "Climate Tipping Point Response",
    "type": "invest",
    "domains": [
      "environment",
      "energy",
      "infrastructure"
    ],
    "pattern": "environment_climate",
    "explain": "Accelerating climate anomalies triggering non-linear ecosystem response. Portal diagnosis CLIMATE_TIPPING_POINT maps through temperature-anomaly, extreme-weather persistence, and sea-level signals.",
    "action": "Position in climate-resilience infrastructure, clean-energy transition, and adaptation tooling. Review treatment nodes for grid hardening, water resilience, and climate-risk analytics.",
    "valueRange": "10–30% clean-energy and resilience returns",
    "saturation": "medium",
    "trigger": "Environment stress > 0.45 with temperature_anomaly, extreme_weather, or sea_level conditions active.",
    "validation": "Confirm NOAA / NASA GISS data LIVE. Cross-reference energy domain for grid-stress signals.",
    "steps": [
      "Drill into Environment portal CLIMATE_TIPPING_POINT diagnosis",
      "Review grid-hardening and climate-risk treatments",
      "Identify clean-energy and resilience primes",
      "Position in ICLN/TAN/QCLN ETFs",
      "Track DOE/EPA climate-adaptation funding"
    ],
    "branch_up": "Anomalies compound: multi-year adaptation-procurement wave.",
    "branch_down": "Climate signals stabilize: shift to long-horizon mitigation investment.",
    "outcome": "Clean-energy and resilience infrastructure see sustained demand from utilities, municipalities, and federal climate programs.",
    "failure": "Anomalies framed as cyclical. Mitigation budgets deferred. Public attention shifts.",
    "window": "90 days–10 years",
    "realWorld": {
      "invest": "Clean energy: First Solar (FSLR), NextEra (NEE), Enphase (ENPH), ICLN/TAN ETFs. Resilience: Jupiter Intelligence, Climate X, Orennia.",
      "apply": "DOE Grid Deployment Office, EPA Climate Pollution Reduction, NOAA climate-adaptation grants, USDA Rural Energy.",
      "build": "Climate-risk analytics platforms, resilience-planning tools, adaptation-finance infrastructure."
    },
    "examples": [
      "Solar, wind, and grid-storage infrastructure",
      "Climate-risk analytics platforms",
      "Resilience-planning and adaptation tooling",
      "Water-infrastructure modernization",
      "Extreme-weather monitoring"
    ],
    "fastPath": [
      "1. Confirm CLIMATE_TIPPING_POINT active",
      "2. Position in ICLN/TAN or resilience pure-plays",
      "3. Apply to DOE GDO or EPA climate-adaptation grants"
    ]
  },
  {
    "id": "mass_extinction",
    "title": "Biodiversity Collapse Response",
    "type": "fund",
    "domains": [
      "environment",
      "agriculture"
    ],
    "pattern": "environment_biodiversity",
    "explain": "Accelerating species loss and ecosystem-service degradation. Portal diagnosis MASS_EXTINCTION maps through habitat-loss, species-decline, and food-chain imbalance.",
    "action": "Position in biodiversity-monitoring, restoration finance, and ecosystem-services tooling. Review treatment nodes for habitat-connectivity, species-recovery, and invasive-species management.",
    "valueRange": "$250K–$50M restoration and biodiversity-finance",
    "saturation": "low",
    "trigger": "Environment stress > 0.40 with habitat_loss, species_decline, or biodiversity_collapse conditions active.",
    "validation": "Confirm USFWS / IUCN / GBIF data. Cross-reference agriculture domain for ecosystem-service corroboration.",
    "steps": [
      "Drill into Environment portal MASS_EXTINCTION diagnosis",
      "Review habitat-connectivity and species-recovery treatments",
      "Identify restoration operators and biodiversity-finance platforms",
      "Apply to USFWS/NOAA/USDA restoration grants",
      "Build biodiversity-credit and ecosystem-service infrastructure"
    ],
    "branch_up": "Species loss accelerates: biodiversity-credit markets formalize.",
    "branch_down": "Restoration policy stabilizes: shift to long-term monitoring investment.",
    "outcome": "Biodiversity-monitoring and restoration operators capture federal and philanthropic funding. Biodiversity-credit markets emerge.",
    "failure": "Biodiversity framed as local rather than systemic. Credit markets stall. Funding absorbed by climate-mitigation priority.",
    "window": "180 days–10 years",
    "realWorld": {
      "invest": "Restoration finance: EcoCommons, Restore. Biodiversity-credit: CreditNature, BioCarbon Registry. Monitoring: Dendra Systems, eDNA platforms.",
      "apply": "USFWS ESA Section 6, NOAA coastal resilience, USDA NRCS, BIL ecosystem restoration, Wyss Campaign for Nature.",
      "build": "Biodiversity-credit platforms, restoration-monitoring tooling, ecosystem-service quantification."
    },
    "examples": [
      "Restoration operators and land management",
      "Biodiversity-credit and ecosystem-service markets",
      "eDNA and species-monitoring platforms",
      "Invasive-species management",
      "Habitat-connectivity tooling"
    ],
    "fastPath": [
      "1. Confirm MASS_EXTINCTION active",
      "2. Apply to USFWS ESA Section 6 or NOAA coastal grants",
      "3. Build biodiversity-credit or restoration-monitoring tooling"
    ]
  },
  {
    "id": "ocean_acidification",
    "title": "Ocean Acidification & Marine Response",
    "type": "fund",
    "domains": [
      "environment"
    ],
    "pattern": "environment_marine",
    "explain": "Marine pH decline, coral bleaching, and fishery collapse threatening blue economy. Portal diagnosis OCEAN_ACIDIFICATION maps through marine-chemistry, reef-degradation, and fishery-collapse signals.",
    "action": "Position in aquaculture-resilience, marine-monitoring, and coastal-adaptation tooling. Review treatment nodes for reef-restoration and ocean-chemistry monitoring.",
    "valueRange": "$100K–$20M marine-resilience and blue-economy opportunity",
    "saturation": "low",
    "trigger": "Environment stress > 0.40 with marine_ph_decline, coral_bleaching, or fishery_collapse conditions active.",
    "validation": "Confirm NOAA ocean-observing and IOOS data. Cross-reference agriculture domain for aquaculture signals.",
    "steps": [
      "Drill into Environment portal OCEAN_ACIDIFICATION diagnosis",
      "Review reef-restoration and aquaculture-resilience treatments",
      "Identify blue-economy and marine-monitoring operators",
      "Apply to NOAA Sea Grant, National Sea Grant College Program",
      "Position in aquaculture and marine-tech ETFs"
    ],
    "branch_up": "Reef systems collapse: urgent reef-restoration and alternative-aquaculture investment.",
    "branch_down": "Regional stabilization: shift to long-term monitoring investment.",
    "outcome": "Marine-resilience, aquaculture, and coastal-adaptation vendors capture NOAA and philanthropic funding.",
    "failure": "Regional framing limits federal response. Blue-economy markets remain small.",
    "window": "180 days–5 years",
    "realWorld": {
      "invest": "Aquaculture: AquaBounty, Cooke Aquaculture. Marine-tech: Saildrone, Sofar Ocean. Reef: Coral Vita.",
      "apply": "NOAA Sea Grant, Sea Grant College Program, NFWF coastal resilience, Ocean Conservancy, Moore Foundation.",
      "build": "Ocean-monitoring sensor networks, aquaculture-resilience tooling, reef-restoration infrastructure."
    },
    "examples": [
      "Marine-monitoring sensor networks",
      "Aquaculture-resilience platforms",
      "Reef-restoration operators",
      "Ocean-chemistry analytics",
      "Fishery-management tooling"
    ],
    "fastPath": [
      "1. Confirm OCEAN_ACIDIFICATION active",
      "2. Apply to NOAA Sea Grant",
      "3. Build marine-monitoring or reef-restoration infrastructure"
    ]
  },
  {
    "id": "deforestation",
    "title": "Deforestation & Carbon-Sink Response",
    "type": "invest",
    "domains": [
      "environment",
      "agriculture"
    ],
    "pattern": "environment_forest",
    "explain": "Forest loss, carbon-sink decline, and soil degradation accelerating. Portal diagnosis DEFORESTATION maps through forest-loss, carbon-sink decline, and land-use conflict.",
    "action": "Position in voluntary-carbon markets, reforestation operators, and supply-chain-due-diligence tooling. Review treatment nodes for nature-based solutions and land-use monitoring.",
    "valueRange": "10–25% carbon-market and reforestation returns",
    "saturation": "medium",
    "trigger": "Environment stress > 0.40 with forest_loss, carbon_sink_decline, or land_use_conflict conditions active.",
    "validation": "Confirm Global Forest Watch / MapBiomas data. Cross-reference agriculture domain for land-use signals.",
    "steps": [
      "Drill into Environment portal DEFORESTATION diagnosis",
      "Review nature-based-solutions and land-use-monitoring treatments",
      "Identify carbon-credit and reforestation operators",
      "Position in carbon markets and forest-finance platforms",
      "Track EUDR and USDA climate-smart agriculture funding"
    ],
    "branch_up": "Forest loss accelerates: carbon-market stringency tightens, compliance demand spikes.",
    "branch_down": "Deforestation commitments enforced: shift to long-term monitoring investment.",
    "outcome": "Carbon-market operators, reforestation platforms, and supply-chain-due-diligence vendors capture compliance-driven demand.",
    "failure": "Voluntary-carbon markets lose credibility. Compliance delayed. Market fragmentation.",
    "window": "180 days–10 years",
    "realWorld": {
      "invest": "Carbon markets: Pachama, Sylvera, Verra registry partners. Reforestation: Propagate, Terraformation. Due diligence: Osapiens, Satelligence.",
      "apply": "USDA Climate Smart Commodities, NRCS EQIP, FAO climate-smart agriculture, Bezos Earth Fund, Norwegian International Climate Forest Initiative.",
      "build": "Carbon-MRV platforms, supply-chain deforestation due-diligence, land-use monitoring via remote sensing."
    },
    "examples": [
      "Voluntary-carbon market operators",
      "Reforestation and agroforestry platforms",
      "Supply-chain due diligence (EUDR compliance)",
      "Land-use monitoring via satellite",
      "Nature-based-solutions finance"
    ],
    "fastPath": [
      "1. Confirm DEFORESTATION active",
      "2. Screen carbon-MRV and due-diligence platforms",
      "3. Apply to USDA Climate Smart Commodities or NRCS EQIP"
    ]
  },
  {
    "id": "toxic_contamination",
    "title": "Toxic Contamination Response",
    "type": "invest",
    "domains": [
      "environment",
      "industry",
      "law"
    ],
    "pattern": "environment_toxic",
    "explain": "Industrial discharge, PFAS contamination, or toxic-spill event creating acute remediation demand. Portal diagnosis TOXIC_CONTAMINATION maps through water-contamination, air-quality degradation, and industrial-discharge signals.",
    "action": "Position in environmental-remediation operators, PFAS-treatment tooling, and industrial-compliance platforms. Review treatment nodes for contamination-monitoring and Superfund-eligible remediation.",
    "valueRange": "15–35% environmental-remediation returns",
    "saturation": "medium",
    "trigger": "Environment stress > 0.45 with water_contamination, air_quality_degradation, or industrial_discharge conditions active.",
    "validation": "Confirm EPA TRI, PFAS NPDWR, or regional emergency declarations. Cross-reference industry domain.",
    "steps": [
      "Drill into Environment portal TOXIC_CONTAMINATION diagnosis",
      "Review remediation and compliance treatments",
      "Identify environmental-remediation primes",
      "Position in PFAS-treatment and industrial-compliance pure-plays",
      "Track EPA Superfund and DoD remediation contracts"
    ],
    "branch_up": "PFAS or heavy-metal regulation tightens: multi-year compliance wave.",
    "branch_down": "Regulation rolled back: shift to voluntary-compliance investment.",
    "outcome": "Remediation operators and PFAS-treatment vendors capture EPA Superfund, state, and corporate-liability contracts.",
    "failure": "Regulatory rollback. Industry captures rule-making. Litigation resolves without remediation investment.",
    "window": "60 days–5 years",
    "realWorld": {
      "invest": "Remediation: Clean Harbors (CLH), US Ecology. PFAS: 374Water, Aquagga. Compliance: Sphera, Enablon.",
      "apply": "EPA Superfund, BIL PFAS remediation, DoD Environmental Restoration, state hazardous-waste programs.",
      "build": "PFAS-destruction tooling, contamination-monitoring sensor networks, industrial-compliance platforms."
    },
    "examples": [
      "Environmental-remediation operators",
      "PFAS-destruction and water-treatment",
      "Industrial-compliance platforms",
      "Air-quality monitoring networks",
      "Hazardous-waste management"
    ],
    "fastPath": [
      "1. Confirm TOXIC_CONTAMINATION active",
      "2. Screen remediation primes (CLH)",
      "3. Apply to EPA Superfund or BIL PFAS remediation"
    ]
  },
  {
    "id": "environment_data_gap",
    "title": "Environment Data Gap → Build",
    "type": "build",
    "domains": [
      "environment"
    ],
    "pattern": null,
    "explain": "Environmental monitoring has gaps in real-time coverage. Build infrastructure to fill blind spots.",
    "action": "Build real-time environmental-intelligence platforms or compliance-monitoring infrastructure.",
    "valueRange": "$500K–$10M environment-data infrastructure",
    "saturation": "low",
    "trigger": "Environment sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health. Verify gap is structural.",
    "steps": [
      "Check Environment feed health",
      "Count OFFLINE sources",
      "Identify uncovered dimension",
      "Build data pipeline",
      "Apply to NSF, NOAA, or EPA"
    ],
    "branch_up": "Gap persists: build permanent infrastructure.",
    "branch_down": "Sources recover: monitor.",
    "outcome": "Environmental-intelligence platform serving regulators, industry, and researchers.",
    "failure": "Incumbents (Planet, Maxar, Satelligence) absorb gap.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "apply": "NSF, NOAA, EPA ORD research grants, Gordon and Betty Moore Foundation.",
      "build": "Real-time environmental-data aggregation, compliance monitoring, climate-risk analytics."
    },
    "examples": [
      "Real-time air/water quality dashboards",
      "Remote-sensing climate monitoring",
      "Compliance-data aggregation",
      "Biodiversity-monitoring platforms",
      "Supply-chain environmental analytics"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify uncovered dimension",
      "3. Apply to NSF/NOAA or build platform"
    ]
  }
];

  window.LIMENEnvironmentOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENEnvironmentOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
