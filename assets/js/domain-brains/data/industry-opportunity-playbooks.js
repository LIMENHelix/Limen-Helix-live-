/**
 * industry-opportunity-playbooks.js
 *
 * Canonical Industry domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the industry-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENIndustryOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "supply_chain_collapse_industry",
    "title": "Manufacturing Supply Chain Collapse",
    "type": "invest",
    "domains": [
      "industry",
      "trade"
    ],
    "pattern": "industry_supply",
    "explain": "Manufacturing input shortage, component-scarcity, or supplier-failure. Portal diagnosis SUPPLY_CHAIN_COLLAPSE maps through input-shortage, component-scarcity, and supplier-failure signals.",
    "action": "Position in manufacturing-resilience, supplier-diversification, and reshoring-finance.",
    "valueRange": "15–30% industrial returns",
    "saturation": "medium",
    "trigger": "Industry stress > 0.45 with input_shortage, component_scarcity, or supplier_failure conditions active.",
    "validation": "Confirm ISM, FRED manufacturing, PMI sub-indices.",
    "steps": [
      "Drill into Industry portal SUPPLY_CHAIN_COLLAPSE",
      "Review resilience treatments",
      "Screen reshoring primes (CAT, DE, ETN)",
      "Position in PAVE/XLI",
      "Track DPA Title III, CHIPS, BIL"
    ],
    "branch_up": "Compound disruption: multi-year reshoring wave.",
    "branch_down": "Resolution: shift to efficiency investment.",
    "outcome": "Industrial reshoring and supplier-diversification platforms capture structural flows.",
    "failure": "Quick resolution.",
    "window": "60 days–5 years",
    "realWorld": {
      "invest": "Caterpillar (CAT), Deere (DE), Eaton (ETN), Parker Hannifin (PH). ETFs: PAVE, XLI.",
      "apply": "DPA Title III, CHIPS Act, BIL domestic-content grants, EDA Tech Hubs.",
      "build": "Multi-tier supply-chain visibility, supplier-diversification platforms, reshoring-finance tooling."
    },
    "examples": [
      "Industrial reshoring equities",
      "Multi-tier supply-chain visibility",
      "Supplier-diversification tooling",
      "Reshoring-finance platforms",
      "Manufacturing-resilience analytics"
    ],
    "fastPath": [
      "1. Confirm SUPPLY_CHAIN_COLLAPSE",
      "2. Position in PAVE/XLI",
      "3. Pursue DPA Title III or CHIPS"
    ]
  },
  {
    "id": "automation_failure",
    "title": "Automation Failure Response",
    "type": "invest",
    "domains": [
      "industry",
      "technology"
    ],
    "pattern": "industry_automation",
    "explain": "Automation breakdown, robotic-system failure, or AI-in-manufacturing misalignment. Portal diagnosis AUTOMATION_FAILURE maps through robot-failure, system-integration-gap, and ai-misalignment signals.",
    "action": "Position in industrial automation, predictive-maintenance, and human-robot-collaboration tooling.",
    "valueRange": "15–30% industrial-automation returns",
    "saturation": "medium",
    "trigger": "Industry stress > 0.45 with robot_failure, system_integration_gap, or ai_misalignment conditions active.",
    "validation": "Confirm ARC Advisory, A3 Robotics, IFR data.",
    "steps": [
      "Drill into Industry portal AUTOMATION_FAILURE",
      "Review automation treatments",
      "Screen Rockwell (ROK), Siemens, ABB, Emerson (EMR)",
      "Position in automation ETFs (ROBO, IRBO)",
      "Track DoE Advanced Manufacturing"
    ],
    "branch_up": "Systemic breakdown: industrial-automation modernization wave.",
    "branch_down": "Isolated failure: shift to preventive maintenance.",
    "outcome": "Industrial-automation and predictive-maintenance vendors capture procurement.",
    "failure": "Isolated containment.",
    "window": "60 days–3 years",
    "realWorld": {
      "invest": "Rockwell Automation (ROK), Siemens (SIE.DE), ABB (ABB), Emerson (EMR), Symbotic (SYM). ETFs: ROBO, IRBO.",
      "apply": "DOE Advanced Manufacturing Office, NIST Manufacturing USA, EDA Manufacturing.",
      "build": "Predictive-maintenance platforms, industrial-AI tooling, human-robot collaboration."
    },
    "examples": [
      "Industrial-automation primes",
      "Predictive-maintenance platforms",
      "Human-robot collaboration tooling",
      "Industrial-AI services",
      "Robotics ETFs"
    ],
    "fastPath": [
      "1. Confirm AUTOMATION_FAILURE",
      "2. Screen ROK/SIE/ABB",
      "3. Pursue DOE AMO or NIST Manufacturing USA"
    ]
  },
  {
    "id": "toxic_spill_industry",
    "title": "Industrial Toxic Spill Response",
    "type": "invest",
    "domains": [
      "industry",
      "environment",
      "law"
    ],
    "pattern": "industry_toxic",
    "explain": "Industrial discharge, chemical spill, or environmental-liability event. Portal diagnosis TOXIC_SPILL maps through discharge, chemical-spill, and liability signals.",
    "action": "Position in environmental-remediation, industrial-compliance, and incident-response tooling.",
    "valueRange": "15–30% remediation returns",
    "saturation": "medium",
    "trigger": "Industry stress > 0.45 with discharge, chemical_spill, or liability conditions active.",
    "validation": "Confirm EPA TRI, OSHA incidents, CSB reports.",
    "steps": [
      "Drill into Industry portal TOXIC_SPILL",
      "Review remediation treatments",
      "Position in Clean Harbors (CLH), US Ecology",
      "Screen industrial-compliance (Sphera, Enablon)",
      "Track EPA enforcement"
    ],
    "branch_up": "Systemic discharge pattern: regulatory wave.",
    "branch_down": "Single-incident containment: preventive investment.",
    "outcome": "Remediation and compliance vendors capture corporate-liability and EPA-driven demand.",
    "failure": "Quick containment.",
    "window": "30 days–3 years",
    "realWorld": {
      "invest": "Clean Harbors (CLH), US Ecology, Perma-Pipe (PPIH). Compliance: Sphera, Enablon (private).",
      "apply": "EPA Superfund, DOE remediation, state hazardous-waste programs.",
      "build": "Industrial-emissions monitoring, compliance-automation, incident-response platforms."
    },
    "examples": [
      "Environmental-remediation operators",
      "Industrial-emissions monitoring",
      "Compliance-automation platforms",
      "Incident-response tooling",
      "Hazardous-waste management"
    ],
    "fastPath": [
      "1. Confirm TOXIC_SPILL",
      "2. Position in CLH",
      "3. Pursue EPA Superfund"
    ]
  },
  {
    "id": "quality_crisis",
    "title": "Quality Crisis Response",
    "type": "invest",
    "domains": [
      "industry",
      "law"
    ],
    "pattern": "industry_quality",
    "explain": "Product-recall wave, QA-failure, or safety-certification breakdown. Portal diagnosis QUALITY_CRISIS maps through recall, qa-failure, and safety-cert-breakdown signals.",
    "action": "Position in QA-automation, recall-management tooling, and product-traceability platforms.",
    "valueRange": "10–25% QA-tech returns",
    "saturation": "low",
    "trigger": "Industry stress > 0.40 with recall, qa_failure, or safety_cert_breakdown conditions active.",
    "validation": "Confirm CPSC recalls, FDA recalls, NHTSA data.",
    "steps": [
      "Drill into Industry portal QUALITY_CRISIS",
      "Review traceability treatments",
      "Screen ETQ, Sparta Systems, MasterControl",
      "Position in QA-tech pure-plays",
      "Track CPSC/FDA/NHTSA"
    ],
    "branch_up": "Recall wave: QA-tech procurement wave.",
    "branch_down": "Isolated incident: preventive investment.",
    "outcome": "QA-automation and traceability vendors capture manufacturer and regulator demand.",
    "failure": "Isolated resolution.",
    "window": "60 days–2 years",
    "realWorld": {
      "invest": "QA-tech: ETQ (private), Sparta Systems (private), MasterControl (private). Public: Honeywell (HON), Rockwell (ROK).",
      "apply": "NIST Manufacturing Extension Partnership, DOE AMO quality programs.",
      "build": "Product-traceability platforms, QA-automation tooling, recall-management infrastructure."
    },
    "examples": [
      "QA-automation platforms",
      "Product-traceability tooling",
      "Recall-management systems",
      "Safety-certification tracking",
      "Quality-analytics services"
    ],
    "fastPath": [
      "1. Confirm QUALITY_CRISIS",
      "2. Screen QA-tech primes",
      "3. Pursue NIST MEP"
    ]
  },
  {
    "id": "workforce_shortage_industry",
    "title": "Industrial Workforce Shortage",
    "type": "fund",
    "domains": [
      "industry",
      "education",
      "population"
    ],
    "pattern": "industry_workforce",
    "explain": "Skilled-trades shortage, apprenticeship-collapse, or workforce-demographic decline. Portal diagnosis WORKFORCE_SHORTAGE maps through skilled-trades, apprenticeship-collapse, and demographic-decline signals.",
    "action": "Position in workforce-development, apprenticeship-tech, and skilled-trades training platforms.",
    "valueRange": "$500K–$20M workforce-development grants",
    "saturation": "low",
    "trigger": "Industry stress > 0.45 with skilled_trades_gap, apprenticeship_collapse, or workforce_demographic_decline conditions active.",
    "validation": "Confirm BLS JOLTS, manufacturing-skills-gap reports, DOL apprenticeship data.",
    "steps": [
      "Drill into Industry portal WORKFORCE_SHORTAGE",
      "Review workforce treatments",
      "Screen Guild Education, RethinkEd, Pathstream",
      "Apply to DOL apprenticeship grants",
      "Track CHIPS/BIL workforce allocations"
    ],
    "branch_up": "Shortage deepens: workforce-development investment wave.",
    "branch_down": "Automation offsets: shift to training for automation.",
    "outcome": "Workforce-development and apprenticeship platforms capture DOL and employer demand.",
    "failure": "Automation resolves.",
    "window": "180 days–5 years",
    "realWorld": {
      "invest": "Workforce-tech: Guild Education (private), Penn Foster (private). Public: Stride (LRN), Adecco.",
      "apply": "DOL apprenticeship grants, CHIPS Act workforce, BIL workforce, NSF Advanced Technological Education.",
      "build": "Skilled-trades training platforms, apprenticeship-management tooling, workforce-analytics."
    },
    "examples": [
      "Skilled-trades training platforms",
      "Apprenticeship-management tooling",
      "Workforce-analytics services",
      "Manufacturing-education platforms",
      "Industry-academic partnerships"
    ],
    "fastPath": [
      "1. Confirm WORKFORCE_SHORTAGE",
      "2. Screen workforce-tech platforms",
      "3. Pursue DOL apprenticeship or CHIPS workforce"
    ]
  },
  {
    "id": "industry_data_gap",
    "title": "Industry Data Gap → Build",
    "type": "build",
    "domains": [
      "industry"
    ],
    "pattern": null,
    "explain": "Industry monitoring has gaps. Build industrial-intelligence platforms.",
    "action": "Build real-time industrial-intelligence platforms.",
    "valueRange": "$500K–$10M industry-data infrastructure",
    "saturation": "low",
    "trigger": "Industry sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Industry feed health",
      "Count OFFLINE",
      "Identify gap",
      "Build pipeline",
      "Apply to NIST or DOE"
    ],
    "branch_up": "Gap persists: build.",
    "branch_down": "Sources recover: monitor.",
    "outcome": "Industrial-intelligence platform.",
    "failure": "Incumbents absorb.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "apply": "NIST Manufacturing USA, DOE AMO, EDA Tech Hubs.",
      "build": "Manufacturing-data aggregation, supply-chain intelligence, industrial-AI platforms."
    },
    "examples": [
      "Manufacturing-data aggregation",
      "Industrial supply-chain intelligence",
      "Capacity-utilization analytics",
      "Equipment-effectiveness monitoring",
      "Industrial-AI platforms"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify gap",
      "3. Pursue NIST MUSA or DOE AMO"
    ]
  }
];

  window.LIMENIndustryOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENIndustryOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
