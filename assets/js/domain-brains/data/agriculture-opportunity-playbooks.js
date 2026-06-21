/**
 * agriculture-opportunity-playbooks.js
 *
 * Canonical Agriculture domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the agriculture-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENAgricultureOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "cash_flow_crisis",
    "title": "Farm Cash Flow Crisis Response",
    "type": "invest",
    "domains": [
      "agriculture",
      "finance"
    ],
    "pattern": "agri_cashflow",
    "explain": "Farm-income collapse, cost-price squeeze, or debt-service stress. Portal diagnosis CASH_FLOW_CRISIS maps through income-collapse, cost-squeeze, and debt-stress signals.",
    "action": "Position in farm-lending, crop-insurance tech, and working-capital platforms.",
    "valueRange": "$250K–$10M farm-finance and working-capital",
    "saturation": "low",
    "trigger": "Agriculture stress > 0.45 with income_collapse, cost_squeeze, or debt_stress conditions active.",
    "validation": "Confirm USDA ERS farm-income, FSA loan-delinquency data.",
    "steps": [
      "Drill into Agriculture portal CASH_FLOW_CRISIS",
      "Review farm-finance treatments",
      "Screen farm-lending (Farmer Mac, AGM)",
      "Position in farmland REITs (LAND, FPI)",
      "Scope a research brief on farm-financial-stress patterns"
    ],
    "branch_up": "Multi-year squeeze: consolidation and farm-finance wave.",
    "branch_down": "Commodity recovery: shift to growth finance.",
    "outcome": "Farm-lending and crop-insurance vendors capture lender demand; research brief benchmarks farm-stress severity.",
    "failure": "Commodity prices recover.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Farmer Mac (AGM), Farmland Partners (FPI), Gladstone Land (LAND). Crop insurance: NAU Country (via QBE).",
      "research": "Research brief: measure farm cash-flow stress indicators and compare intervention efficacy (crop insurance vs working-capital facilities).",
      "build": "Farm-finance platforms, crop-insurance tech, working-capital tools for farmers."
    },
    "examples": [
      "Farm-lending platforms",
      "Farmland REITs",
      "Crop-insurance tech",
      "Working-capital tools",
      "Farm-debt restructuring"
    ],
    "fastPath": [
      "1. Confirm CASH_FLOW_CRISIS",
      "2. Screen AGM/FPI/LAND",
      "3. Position or scope research brief on farm-stress indicators"
    ]
  },
  {
    "id": "supply_chain_breakdown_agri",
    "title": "Agricultural Supply Chain Breakdown",
    "type": "invest",
    "domains": [
      "agriculture",
      "trade"
    ],
    "pattern": "agri_supply",
    "explain": "Input shortage, processing bottleneck, or distribution failure. Portal diagnosis SUPPLY_CHAIN_BREAKDOWN maps through input-shortage, processing-bottleneck, and distribution-failure signals.",
    "action": "Position in agtech logistics, cold-chain, and processing-capacity platforms.",
    "valueRange": "10–25% agtech-logistics returns",
    "saturation": "medium",
    "trigger": "Agriculture stress > 0.45 with input_shortage, processing_bottleneck, or distribution_failure conditions active.",
    "validation": "Confirm USDA NASS, AMS data, PPI food manufacturing.",
    "steps": [
      "Drill into Agriculture portal SUPPLY_CHAIN_BREAKDOWN",
      "Review logistics treatments",
      "Screen Americold (COLD), Lineage (via Bay Grove).",
      "Position in agtech logistics",
      "Scope research brief on supply-chain failure patterns and cold-chain efficacy"
    ],
    "branch_up": "Persistent disruption: processing and cold-chain investment wave.",
    "branch_down": "Normalization: shift to optimization.",
    "outcome": "Cold-chain and processing-capacity platforms capture corporate demand; research brief benchmarks disruption recovery timelines.",
    "failure": "Quick normalization.",
    "window": "60 days–3 years",
    "realWorld": {
      "invest": "Americold (COLD), Lineage Logistics (private), Deere (DE), AGCO (AGCO).",
      "research": "Research brief: map agricultural supply-chain failure modes and benchmark cold-chain investment vs disruption recovery time.",
      "build": "Cold-chain monitoring, processing-capacity analytics, farm-to-fork traceability."
    },
    "examples": [
      "Cold-chain operators",
      "Processing-capacity platforms",
      "Farm-to-fork traceability",
      "Agricultural logistics tooling",
      "Distribution-optimization services"
    ],
    "fastPath": [
      "1. Confirm SUPPLY_CHAIN_BREAKDOWN",
      "2. Screen COLD and DE",
      "3. Position or scope research brief on cold-chain efficacy"
    ]
  },
  {
    "id": "drought",
    "title": "Drought Response",
    "type": "invest",
    "domains": [
      "agriculture",
      "environment"
    ],
    "pattern": "agri_drought",
    "explain": "Water shortage, crop-yield collapse, or aquifer depletion. Portal diagnosis DROUGHT maps through water-shortage, yield-collapse, and aquifer-depletion signals.",
    "action": "Position in precision-irrigation, water-efficiency tech, and drought-tolerant seed operators.",
    "valueRange": "15–30% water-tech and agtech returns",
    "saturation": "medium",
    "trigger": "Agriculture stress > 0.45 with water_shortage, yield_collapse, or aquifer_depletion conditions active.",
    "validation": "Confirm USDA NASS, US Drought Monitor, NOAA data.",
    "steps": [
      "Drill into Agriculture portal DROUGHT",
      "Review water-efficiency treatments",
      "Screen Valmont (VMI), Lindsay (LNN), Corteva (CTVA)",
      "Position in water ETFs (PHO, FIW)",
      "Scope research brief on precision-irrigation efficacy and drought-adaptive genetics"
    ],
    "branch_up": "Sustained drought: multi-year water-tech investment.",
    "branch_down": "Precipitation recovery: rotate to yield optimization.",
    "outcome": "Precision-irrigation and drought-tolerant seed operators capture grower demand; research brief benchmarks irrigation ROI vs drought severity.",
    "failure": "Rapid precipitation recovery.",
    "window": "90 days–5 years",
    "realWorld": {
      "invest": "Valmont (VMI), Lindsay (LNN), Corteva (CTVA), Toro (TTC). Water ETFs: PHO, FIW.",
      "research": "Research brief: quantify precision-irrigation ROI across drought severity bands and evaluate drought-tolerant genetics adoption rates.",
      "build": "Precision-irrigation tooling, water-efficiency platforms, drought-analytics."
    },
    "examples": [
      "Precision-irrigation equipment",
      "Water-efficiency tech",
      "Drought-tolerant seed platforms",
      "Soil-moisture monitoring",
      "Water-rights analytics"
    ],
    "fastPath": [
      "1. Confirm DROUGHT",
      "2. Screen VMI/LNN/CTVA",
      "3. Position or scope research brief on irrigation efficacy"
    ]
  },
  {
    "id": "market_collapse_agri",
    "title": "Agricultural Market Collapse",
    "type": "invest",
    "domains": [
      "agriculture",
      "economy"
    ],
    "pattern": "agri_market",
    "explain": "Commodity-price crash, demand collapse, or export-market loss. Portal diagnosis MARKET_COLLAPSE maps through price-crash, demand-collapse, and export-loss signals.",
    "action": "Position defensively, screen for M&A targets and strong-balance-sheet operators.",
    "valueRange": "10–25% M&A and consolidation returns",
    "saturation": "medium",
    "trigger": "Agriculture stress > 0.50 with price_crash, demand_collapse, or export_loss conditions active.",
    "validation": "Confirm CME futures, USDA ERS, FAS export data.",
    "steps": [
      "Drill into Agriculture portal MARKET_COLLAPSE",
      "Review consolidation treatments",
      "Screen ADM, Bunge (BG), strong ag operators",
      "Position defensively in strong-balance-sheet operators",
      "Scope research brief on commodity collapse recovery patterns"
    ],
    "branch_up": "Deep collapse: M&A consolidation wave.",
    "branch_down": "Recovery: rotate to growth operators.",
    "outcome": "Strong-balance-sheet operators acquire distressed assets. Consolidation accelerates. Research brief benchmarks collapse-to-recovery timelines.",
    "failure": "Quick commodity recovery.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "ADM (ADM), Bunge (BG), Tyson (TSN), Nutrien (NTR). ETFs: MOO, DBA.",
      "research": "Research brief: model commodity-price collapse dynamics and identify which operator balance-sheet characteristics predict M&A success.",
      "build": "Commodity-price analytics, export-market intelligence, farm-M&A platforms."
    },
    "examples": [
      "Agricultural-commodity operators",
      "Farm-M&A platforms",
      "Export-market intelligence",
      "Commodity-price analytics",
      "Distressed-farm-asset funds"
    ],
    "fastPath": [
      "1. Confirm MARKET_COLLAPSE",
      "2. Screen ADM/BG",
      "3. Position defensively or scope research brief on recovery patterns"
    ]
  },
  {
    "id": "equipment_failure",
    "title": "Agricultural Equipment Failure Response",
    "type": "invest",
    "domains": [
      "agriculture",
      "industry"
    ],
    "pattern": "agri_equipment",
    "explain": "Equipment-cost spike, parts shortage, or right-to-repair constraint. Portal diagnosis EQUIPMENT_FAILURE maps through cost-spike, parts-shortage, and right-to-repair signals.",
    "action": "Position in used-equipment markets, precision-ag retrofits, and right-to-repair tooling.",
    "valueRange": "10–20% equipment-services returns",
    "saturation": "low",
    "trigger": "Agriculture stress > 0.40 with cost_spike, parts_shortage, or right_to_repair conditions active.",
    "validation": "Confirm manufacturer guidance, dealer parts data.",
    "steps": [
      "Drill into Agriculture portal EQUIPMENT_FAILURE",
      "Review retrofit treatments",
      "Screen Deere (DE), AGCO (AGCO), Tractor Supply (TSCO)",
      "Position in precision-ag retrofit platforms",
      "Scope research brief on right-to-repair legislation impact and parts-availability constraints"
    ],
    "branch_up": "Sustained cost pressure: used-equipment and retrofit wave.",
    "branch_down": "New equipment affordable: rotate to new-equipment exposure.",
    "outcome": "Used-equipment and retrofit platforms capture cost-sensitive grower demand; research brief tracks right-to-repair policy evolution.",
    "failure": "New-equipment affordability returns.",
    "window": "180 days–5 years",
    "realWorld": {
      "invest": "Deere (DE), AGCO (AGCO), Tractor Supply (TSCO). Retrofit: Raven (now part of CNH), Sentera.",
      "research": "Research brief: quantify right-to-repair legislation impact on equipment costs and measure precision-ag retrofit adoption rates.",
      "build": "Used-equipment marketplaces, precision-ag retrofit tooling, right-to-repair platforms."
    },
    "examples": [
      "Used-equipment marketplaces",
      "Precision-ag retrofit platforms",
      "Right-to-repair tooling",
      "Equipment-sharing cooperatives",
      "Parts-availability analytics"
    ],
    "fastPath": [
      "1. Confirm EQUIPMENT_FAILURE",
      "2. Screen DE/AGCO",
      "3. Position or scope research brief on right-to-repair impact"
    ]
  },
  {
    "id": "pest_outbreak",
    "title": "Pest / Disease Outbreak Response",
    "type": "invest",
    "domains": [
      "agriculture",
      "environment"
    ],
    "pattern": "agri_pest",
    "explain": "Invasive species, crop disease, or livestock-disease outbreak. Portal diagnosis PEST_OUTBREAK maps through invasive-species, crop-disease, and livestock-disease signals.",
    "action": "Position in integrated pest management, biologicals, and livestock-health platforms.",
    "valueRange": "10–25% ag-biologicals and animal-health returns",
    "saturation": "medium",
    "trigger": "Agriculture stress > 0.45 with invasive_species, crop_disease, or livestock_disease conditions active.",
    "validation": "Confirm USDA APHIS, FAO, NAHLN data.",
    "steps": [
      "Drill into Agriculture portal PEST_OUTBREAK",
      "Review biologicals treatments",
      "Screen Corteva (CTVA), Zoetis (ZTS), FMC (FMC)",
      "Position in ag-biologicals",
      "Scope research brief on outbreak-surveillance efficacy and biologicals adoption"
    ],
    "branch_up": "Outbreak spreads: sustained biologicals and animal-health demand.",
    "branch_down": "Containment: shift to preventive investment.",
    "outcome": "Ag-biologicals and animal-health operators capture outbreak-driven demand; research brief benchmarks biological intervention speed vs chemical controls.",
    "failure": "Quick containment.",
    "window": "60 days–3 years",
    "realWorld": {
      "invest": "Corteva (CTVA), FMC (FMC), Zoetis (ZTS), Elanco (ELAN). Biologicals: Marrone Bio, Pivot Bio (private).",
      "research": "Research brief: measure ag-biologicals adoption rates and compare IPM intervention speed and efficacy vs chemical controls.",
      "build": "Outbreak-surveillance, IPM platforms, livestock-health monitoring."
    },
    "examples": [
      "Ag-biologicals platforms",
      "Livestock-health operators",
      "Outbreak-surveillance tooling",
      "IPM services",
      "Crop-disease-monitoring platforms"
    ],
    "fastPath": [
      "1. Confirm PEST_OUTBREAK",
      "2. Screen CTVA/ZTS/FMC",
      "3. Position or scope research brief on biologicals efficacy"
    ]
  },
  {
    "id": "agriculture_data_gap",
    "title": "Agriculture Data Gap → Research",
    "type": "research",
    "domains": [
      "agriculture"
    ],
    "pattern": null,
    "explain": "Agriculture monitoring has gaps. Scope a research brief on data coverage and commission agricultural-intelligence infrastructure.",
    "action": "Commission a research brief mapping data-coverage gaps, then build real-time agriculture-intelligence platforms.",
    "valueRange": "$500K–$10M ag-data infrastructure",
    "saturation": "low",
    "trigger": "Agriculture sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Agriculture feed health",
      "Count OFFLINE sources",
      "Identify which dimension is uncovered",
      "Commission research brief on coverage gap and value of integrated ag-analytics dataset",
      "Build data pipeline as investable analytics product"
    ],
    "branch_up": "Gap persists: build permanent infrastructure.",
    "branch_down": "Sources recover: monitor for recurrence.",
    "outcome": "Agricultural-intelligence platform serving researchers, institutions, and agribusinesses.",
    "failure": "Gro Intelligence/Climate absorb the market.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "research": "Research brief: map agricultural-data coverage gaps and quantify the value of an integrated crop-monitoring + supply-chain-intelligence dataset.",
      "build": "Crop-monitoring, yield-forecasting, livestock-analytics, farm-data aggregation."
    },
    "examples": [
      "Crop-monitoring dashboards",
      "Yield-forecasting platforms",
      "Livestock-analytics",
      "Farm-data aggregation",
      "Agricultural supply-chain intelligence"
    ],
    "fastPath": [
      "1. Check feed health: count offline Agriculture sources",
      "2. Identify which agricultural dimension is uncovered",
      "3. Commission research brief on coverage gaps or build data pipeline"
    ]
  }
];

  window.LIMENAgricultureOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENAgricultureOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
