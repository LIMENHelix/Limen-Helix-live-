/**
 * defense-opportunity-playbooks.js
 *
 * Canonical Defense domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the defense-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENDefenseOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "invasion_response",
    "title": "Invasion / Territorial Aggression Response",
    "type": "invest",
    "domains": [
      "defense",
      "governance",
      "intelligence"
    ],
    "pattern": "defense_invasion",
    "explain": "Active or imminent territorial aggression triggering alliance mobilization, supplemental defense appropriations, and acute procurement demand. Portal diagnosis INVASION maps through force-readiness, ISR coverage gaps, and munitions-stockpile depletion.",
    "action": "Position in prime contractors, munitions producers, and ISR operators aligned with the theater. Review treatment nodes for munitions-production surge, air/missile defense hardening, and alliance interoperability.",
    "valueRange": "10–30% defense-sector returns over 12–24 months",
    "saturation": "medium",
    "trigger": "Defense stress > 0.55 with territorial_incursion, alliance_mobilization, or force_posture_elevation conditions active.",
    "validation": "Confirm DoD CDAO / theater command reporting. Cross-reference intelligence domain for signals-intelligence corroboration. Verify supplemental-appropriations signals from Congress.",
    "steps": [
      "Drill into Defense portal INVASION diagnosis",
      "Review munitions-production and ISR treatment nodes",
      "Map theater to prime-contractor exposure (LMT, RTX, NOC, GD)",
      "Track supplemental-appropriations bills on appropriations committees",
      "Position ahead of FY supplemental authorization"
    ],
    "branch_up": "Conflict persists > 90 days: sustained procurement tail. Long-duration contractor positioning.",
    "branch_down": "Ceasefire or de-escalation: acute phase ends. Shift to munitions-replenishment tail.",
    "outcome": "Prime contractors and munitions producers see multi-year order backlog growth. ISR and air-defense operators capture rapid-procurement contracts.",
    "failure": "Rapid diplomatic resolution. Existing stockpiles cover surge without new procurement. Budget reshuffled rather than expanded.",
    "window": "30 days–3 years",
    "realWorld": {
      "invest": "Prime contractors: Lockheed Martin (LMT), RTX Corp (RTX), Northrop Grumman (NOC), General Dynamics (GD). Munitions: BAE Systems, Rheinmetall. ISR: L3Harris (LHX), Palantir (PLTR).",
      "research": "Research defense-industrial readiness: munitions production-capacity analysis, ISR data-fusion tooling evaluation, alliance-interoperability technology assessment. Track DoD OT activity via DIU, Army xTechSearch, and AFWERX as procurement-context signals."
    },
    "examples": [
      "Prime-contractor equity exposure",
      "Munitions-production capacity expansion",
      "ISR data-fusion and targeting",
      "Air and missile defense hardening",
      "Alliance interoperability tooling"
    ],
    "fastPath": [
      "1. Confirm INVASION active with territorial_incursion signals",
      "2. Map theater to prime-contractor exposure",
      "3. Position in ITA/LMT/RTX or pursue DoD OT agreement via DIU"
    ]
  },
  {
    "id": "cyber_attack_defense",
    "title": "Defense Cyber Attack Response",
    "type": "invest",
    "domains": [
      "defense",
      "technology",
      "intelligence"
    ],
    "pattern": "defense_cyber",
    "explain": "Nation-state cyber intrusion targeting defense networks, critical infrastructure, or weapons-system supply chain. Portal diagnosis CYBER_ATTACK maps through network-intrusion, zero-day exploitation, and supply-chain compromise.",
    "action": "Position in defense-grade cybersecurity, zero-trust platforms, and CMMC-aligned compliance tooling. Review treatment nodes for endpoint hardening, network segmentation, and adversary-attribution services.",
    "valueRange": "15–40% defense-cybersecurity returns",
    "saturation": "medium",
    "trigger": "Defense stress > 0.50 with cyber_breach, network_intrusion, or supply_chain_compromise conditions active.",
    "validation": "Confirm CISA advisories or DoD cyber-command disclosures. Cross-reference technology domain for corroborating breach signals.",
    "steps": [
      "Drill into Defense portal CYBER_ATTACK diagnosis",
      "Review zero-trust and endpoint-hardening treatments",
      "Identify CMMC-compliant vendors for DoD supply chain",
      "Position in defense-cybersecurity primes and pure-plays",
      "Track CISA emergency directives for procurement momentum"
    ],
    "branch_up": "Attack attribution confirms nation-state campaign: full defense-cyber procurement wave.",
    "branch_down": "Isolated incident contained: shift to preventive hardening investment.",
    "outcome": "Defense-cybersecurity vendors capture CMMC Level 2/3 compliance contracts and DoD zero-trust rollouts.",
    "failure": "Attack contained without broader procurement response. Existing contracts absorb remediation.",
    "window": "7 days–2 years",
    "realWorld": {
      "invest": "Defense-cyber: Palo Alto Networks (PANW), CrowdStrike (CRWD), SentinelOne (S), Palantir (PLTR). Prime cyber: Booz Allen (BAH), Leidos (LDOS), CACI (CACI).",
      "research": "Research defense-cyber threat landscape: zero-trust platform capability analysis, CMMC compliance tooling evaluation, adversary-attribution methodology. Monitor DoD CMMC ecosystem and CISA advisory activity as procurement-context signals."
    },
    "examples": [
      "Defense-grade endpoint detection and response",
      "Zero-trust network architecture tooling",
      "CMMC compliance automation",
      "Adversary attribution and threat intelligence",
      "Supply-chain-security monitoring"
    ],
    "fastPath": [
      "1. Confirm CYBER_ATTACK active with network_intrusion signals",
      "2. Screen CMMC-compliant defense-cyber vendors",
      "3. Position in HACK/CIBR ETFs or DoD cyber-OTA contracting"
    ]
  },
  {
    "id": "nuclear_threat",
    "title": "Nuclear Threat / Escalation Response",
    "type": "invest",
    "domains": [
      "defense",
      "intelligence",
      "governance"
    ],
    "pattern": "defense_nuclear",
    "explain": "Elevated nuclear-posture signals, strategic-forces alerting, or non-proliferation breakdown. Portal diagnosis NUCLEAR_THREAT maps through posture-elevation, deterrence-failure, and counter-proliferation gap signals.",
    "action": "Position in nuclear-modernization primes, non-proliferation monitoring, and consequence-management infrastructure. Review treatment nodes for strategic-systems modernization and early-warning capability.",
    "valueRange": "Long-duration strategic-modernization contracts",
    "saturation": "low",
    "trigger": "Defense stress > 0.60 with nuclear_posture_elevation, deterrence_failure, or counter_proliferation_gap conditions active.",
    "validation": "Confirm NNSA/STRATCOM posture signals. Cross-reference intelligence for corroborating indicators. Verify non-proliferation monitoring feeds.",
    "steps": [
      "Drill into Defense portal NUCLEAR_THREAT diagnosis",
      "Review strategic-modernization and early-warning treatments",
      "Identify NNSA/STRATCOM prime contractors",
      "Position in long-duration modernization programs (Sentinel, B-21, Columbia)",
      "Monitor non-proliferation funding pools"
    ],
    "branch_up": "Sustained posture elevation: multi-decade modernization acceleration.",
    "branch_down": "Diplomatic de-escalation: shift to monitoring and non-proliferation research.",
    "outcome": "Strategic-systems modernization primes and non-proliferation monitoring operators capture multi-decade contract backlogs.",
    "failure": "Posture normalizes quickly. Funding absorbed by conventional forces instead.",
    "window": "90 days–10 years",
    "realWorld": {
      "invest": "Strategic modernization: Northrop Grumman (NOC, Sentinel, B-21), General Dynamics (GD, Columbia-class), Lockheed Martin (LMT), BWX Technologies (BWXT).",
      "research": "Research nuclear deterrence and non-proliferation technology: monitoring platform capability analysis, nuclear-materials tracking systems evaluation, early-warning sensor network assessment. Track NNSA and DTRA program activity as procurement-context signals."
    },
    "examples": [
      "Strategic-systems modernization primes",
      "Non-proliferation monitoring platforms",
      "Nuclear-materials tracking and accountability",
      "Early-warning sensor and detection networks",
      "Consequence-management infrastructure"
    ],
    "fastPath": [
      "1. Confirm NUCLEAR_THREAT active with posture_elevation signals",
      "2. Screen strategic-modernization primes",
      "3. Position in NOC/BWXT or pursue NNSA/DTRA contracts"
    ]
  },
  {
    "id": "intelligence_failure_defense",
    "title": "Defense Intelligence Failure Response",
    "type": "invest",
    "domains": [
      "defense",
      "intelligence"
    ],
    "pattern": "defense_intelligence_gap",
    "explain": "Warning-failure, surprise-event, or ISR-collection gap exposing adversary intent. Portal diagnosis INTELLIGENCE_FAILURE maps through collection-gap, analytic-distortion, and early-warning breakdown.",
    "action": "Position in AI-enabled ISR analytics, data-fusion platforms, and open-source intelligence (OSINT) tooling. Review treatment nodes for all-source fusion and anomaly-detection infrastructure.",
    "valueRange": "$500K–$50M intelligence-analytics contracts",
    "saturation": "medium",
    "trigger": "Defense stress > 0.50 with collection_gap, warning_failure, or analytic_distortion conditions active.",
    "validation": "Confirm DoD CDAO or ODNI disclosures. Cross-reference intelligence domain for corroborating signals.",
    "steps": [
      "Drill into Defense portal INTELLIGENCE_FAILURE diagnosis",
      "Review all-source fusion and anomaly-detection treatments",
      "Identify AI/ML ISR primes and pure-plays",
      "Position in DoD CDAO contract ecosystem",
      "Research OTA and DoD innovation pipeline for emerging tooling (DIU, DARPA, IARPA)"
    ],
    "branch_up": "Systemic warning-failure: major analytics-procurement wave.",
    "branch_down": "Single-incident containment: shift to smaller-scale analytics investment and research.",
    "outcome": "AI-ISR analytics vendors capture CDAO and combatant-command contracts. OSINT and data-fusion platforms see sustained demand.",
    "failure": "Incident reframed as process failure rather than capability gap. No new tooling procurement.",
    "window": "30 days–3 years",
    "realWorld": {
      "invest": "Palantir (PLTR), L3Harris (LHX), Booz Allen (BAH), Leidos (LDOS), Rhombus Power. ISR pure-plays: Maxar, Planet Labs (PL), BlackSky (BKSY).",
      "research": "Research intelligence analytics and ISR technology: all-source fusion platform assessment, AI-enabled anomaly detection evaluation, OSINT aggregation methodology. Monitor DoD CDAO and IARPA program activity as procurement-context signals."
    },
    "examples": [
      "AI-enabled ISR analytics",
      "All-source data-fusion platforms",
      "OSINT aggregation and exploitation",
      "Geospatial intelligence (GEOINT)",
      "Warning-indicator monitoring"
    ],
    "fastPath": [
      "1. Confirm INTELLIGENCE_FAILURE active with collection_gap signals",
      "2. Screen AI-ISR primes and pure-plays",
      "3. Pursue DIU OTA or DoD CDAO contract vehicle"
    ]
  },
  {
    "id": "logistics_collapse_defense",
    "title": "Defense Logistics Collapse Response",
    "type": "invest",
    "domains": [
      "defense",
      "trade",
      "industry"
    ],
    "pattern": "defense_logistics",
    "explain": "Munitions-stockpile depletion, sustainment-capacity shortfall, or critical-supplier failure. Portal diagnosis LOGISTICS_COLLAPSE maps through production-base erosion, surge-capacity gap, and organic-sustainment shortfall.",
    "action": "Position in munitions-production primes, sustainment operators, and defense-industrial-base onshoring. Review treatment nodes for production-capacity expansion and critical-minerals sourcing.",
    "valueRange": "15–35% defense-industrial-base returns",
    "saturation": "low",
    "trigger": "Defense stress > 0.45 with stockpile_depletion, production_base_erosion, or critical_supplier_failure conditions active.",
    "validation": "Confirm DoD OIB/DLA stockpile reports. Cross-reference trade/industry domains for supply-chain corroboration.",
    "steps": [
      "Drill into Defense portal LOGISTICS_COLLAPSE diagnosis",
      "Review production-capacity and critical-minerals treatments",
      "Identify primes with surge-capacity exposure",
      "Position ahead of Defense Production Act Title III awards",
      "Monitor DLA/AMC contract vehicles"
    ],
    "branch_up": "Stockpile depletion compounds: multi-year industrial-base investment wave.",
    "branch_down": "Surge met via draw-down: shift to long-term capacity investment.",
    "outcome": "Munitions producers and industrial-base operators capture DPA Title III awards and long-duration sustainment contracts.",
    "failure": "Draw-down covers surge. International-partner capacity fills gap. No domestic investment wave.",
    "window": "60 days–5 years",
    "realWorld": {
      "invest": "Munitions: Northrop Grumman (NOC, Lake City), BAE Systems, General Dynamics Ordnance. Sustainment: KBR (KBR), Huntington Ingalls (HII). Critical minerals: MP Materials (MP), USA Rare Earth.",
      "research": "Research defense industrial base and supply chain: munitions-production automation technology, critical-minerals sourcing analysis, defense sustainment analytics platforms. Track DPA Title III and DoD IBAS activity as procurement-context signals."
    },
    "examples": [
      "Munitions production-capacity expansion",
      "Defense sustainment and depot operations",
      "Critical-minerals sourcing and processing",
      "Industrial-base onshoring platforms",
      "Supply-chain resilience tooling"
    ],
    "fastPath": [
      "1. Confirm LOGISTICS_COLLAPSE active with stockpile_depletion signals",
      "2. Screen munitions producers and sustainment primes",
      "3. Research DPA Title III and DoD IBAS as procurement-context signals; position in munitions producers ahead of awards"
    ]
  },
  {
    "id": "civil_unrest_defense",
    "title": "Civil Unrest / Homeland Response",
    "type": "invest",
    "domains": [
      "defense",
      "governance",
      "law"
    ],
    "pattern": "defense_homeland",
    "explain": "Domestic unrest or homeland-security emergency requiring DSCA, National Guard mobilization, or FEMA support. Portal diagnosis CIVIL_UNREST maps through homeland-threat, DSCA-activation, and interagency-coordination gap.",
    "action": "Position in homeland-security tooling, public-safety analytics, and emergency-management platforms. Review treatment nodes for interagency coordination and consequence management.",
    "valueRange": "$500K–$50M homeland-security contracts",
    "saturation": "medium",
    "trigger": "Defense stress > 0.45 with homeland_threat, dsca_activation, or interagency_coordination_gap conditions active.",
    "validation": "Confirm DHS/FEMA activation. Cross-reference governance domain for executive-action signals. Verify state-level mobilization.",
    "steps": [
      "Drill into Defense portal CIVIL_UNREST diagnosis",
      "Review interagency-coordination and consequence-management treatments",
      "Identify DHS/FEMA/National Guard contract vehicles",
      "Position in homeland-security analytics and emergency-management",
      "Research DHS BAA and FEMA preparedness programme priorities as investment-context signals"
    ],
    "branch_up": "Sustained unrest: multi-state mobilization and long-duration homeland contracts.",
    "branch_down": "Event contained within 30 days: shift to preventive analytics investment.",
    "outcome": "Homeland-security vendors capture DHS, FEMA, and state Emergency-Management contracts. Public-safety analytics see demand from municipalities. Position in Leidos, CACI, SAIC, Booz Allen, and Motorola Solutions ahead of awards.",
    "failure": "Event resolves without federal activation. State resources absorb response without new procurement.",
    "window": "14 days–18 months",
    "realWorld": {
      "invest": "Homeland prime: Leidos (LDOS), CACI (CACI), SAIC (SAIC), Booz Allen (BAH). Analytics: Palantir (PLTR), Motorola Solutions (MSI).",
      "research": "Research homeland-security technology: emergency-management platform evaluation, interagency-coordination tooling analysis, public-safety analytics methodology. DHS S&T BAA and FEMA preparedness program activity are procurement-context signals."
    },
    "examples": [
      "Emergency-management coordination platforms",
      "Public-safety analytics and predictive tooling",
      "Interagency information-sharing infrastructure",
      "Crisis-communication and alerting systems",
      "Consequence-management logistics"
    ],
    "fastPath": [
      "1. Confirm CIVIL_UNREST active with dsca_activation signals",
      "2. Screen DHS/FEMA prime contractors and homeland-security analytics vendors",
      "3. Research DHS S&T programme priorities and FEMA preparedness contract vehicles for investment positioning"
    ]
  },
  {
    "id": "defense_data_gap",
    "title": "Defense Data Gap → Research",
    "type": "research",
    "domains": [
      "defense"
    ],
    "pattern": null,
    "explain": "Defense monitoring has gaps in posture, procurement, or industrial-base coverage. Research the landscape and produce intelligence to fill blind spots.",
    "action": "Research real-time defense-intelligence platforms, procurement-forecast tooling, or industrial-base monitoring — assess capability gaps and publish findings.",
    "valueRange": "$500K–$10M defense-research and intelligence contracts",
    "saturation": "low",
    "trigger": "Defense sources showing DEGRADED or FALLBACK status. Multiple feeds offline.",
    "validation": "Check feed health. Verify gap is structural, not maintenance.",
    "steps": [
      "Check feed health in Defense SIGNAL INTAKE",
      "Count OFFLINE sources",
      "Identify uncovered dimension (posture, procurement, industrial-base)",
      "Research incumbent platforms and capability gaps (Govini, BAH, Palantir)",
      "Publish research brief and pitch to DoD CDAO, DIU, or DARPA as advisory input"
    ],
    "branch_up": "Gap persists: convert research into sustained intelligence advisory.",
    "branch_down": "Sources recover: archive research. Redeploy on next gap.",
    "outcome": "Defense-intelligence research serving DoD, combatant commands, and defense-industry analysts.",
    "failure": "Incumbent platforms absorb gap. Research remains unpublished. No engagement.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "research": "Defense procurement analytics research, industrial-base monitoring assessment, posture-intelligence gap analysis — deliverable to DoD CDAO, DIU, DARPA, or allied defense research programmes."
    },
    "examples": [
      "Procurement-forecast analytics research",
      "Industrial-base monitoring assessment",
      "Posture and deployment-intelligence gap analysis",
      "Contract-vehicle landscape mapping",
      "Defense supply-chain resilience research"
    ],
    "fastPath": [
      "1. Check Defense feed health and identify the uncovered dimension",
      "2. Survey incumbent platforms (Govini, BAH, Palantir) for coverage gaps",
      "3. Draft research brief and pitch to DoD CDAO or DIU as advisory input"
    ]
  }
];

  window.LIMENDefenseOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENDefenseOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
