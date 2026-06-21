/**
 * governance-opportunity-playbooks.js
 *
 * Canonical Governance domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the governance-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENGovernanceOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "constitutional_crisis",
    "title": "Constitutional Crisis Response",
    "type": "advise",
    "domains": [
      "governance",
      "law"
    ],
    "pattern": "governance_constitutional",
    "explain": "Separation-of-powers conflict, emergency-powers overreach, or succession ambiguity. Portal diagnosis CONSTITUTIONAL_CRISIS maps through powers-conflict, emergency-overreach, and succession-ambiguity signals.",
    "action": "Position in legal-advisory, constitutional-scholarship, and democracy-monitoring infrastructure. Review treatment nodes for rule-of-law indicators and institutional-resilience.",
    "valueRange": "Advisory and foundation-funded democracy work",
    "saturation": "low",
    "trigger": "Governance stress > 0.55 with powers_conflict, emergency_overreach, or succession_ambiguity conditions active.",
    "validation": "Confirm Federal Register, court dockets, emergency declarations. Cross-reference law domain.",
    "steps": [
      "Drill into Governance portal CONSTITUTIONAL_CRISIS",
      "Review rule-of-law treatments",
      "Identify democracy-monitoring organizations",
      "Position advisory offerings to institutions",
      "Track foundation funding (Democracy Fund, Ford, Rockefeller Brothers)"
    ],
    "branch_up": "Crisis deepens: sustained democracy-infrastructure investment.",
    "branch_down": "Institutional response resolves: shift to preventive-monitoring.",
    "outcome": "Democracy-monitoring and institutional-resilience organizations see foundation-funding growth.",
    "failure": "Quick institutional resolution. Funding absorbed by status-quo organizations.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Limited public-market exposure.",
      "research": "Research brief: map democracy-monitoring organizations (Democracy Fund, Ford Foundation, Rockefeller Brothers, Hewlett, Knight Foundation) and evaluate institutional-resilience indicators.",
      "build": "Rule-of-law monitoring platforms, institutional-resilience analytics, democracy-indicator tooling."
    },
    "examples": [
      "Rule-of-law monitoring platforms",
      "Democracy-indicator tooling",
      "Institutional-resilience analytics",
      "Constitutional-law advisory",
      "Public-interest litigation support"
    ],
    "fastPath": [
      "1. Confirm CONSTITUTIONAL_CRISIS active",
      "2. Position advisory to institutions",
      "3. Scope a research brief on democracy-monitoring infrastructure and funding landscape"
    ]
  },
  {
    "id": "regime_instability",
    "title": "Regime Instability Response",
    "type": "advise",
    "domains": [
      "governance",
      "intelligence"
    ],
    "pattern": "governance_regime",
    "explain": "Elite fragmentation, coup indicators, or succession crisis. Portal diagnosis REGIME_INSTABILITY maps through elite-fragmentation, coup-indicator, and succession-crisis signals.",
    "action": "Position in political-risk analytics, sovereign-credit monitoring, and crisis-advisory. Review treatment nodes for country-risk intelligence.",
    "valueRange": "$500K–$10M political-risk advisory",
    "saturation": "medium",
    "trigger": "Governance stress > 0.55 with elite_fragmentation, coup_indicator, or succession_crisis conditions active.",
    "validation": "Confirm ICG, Eurasia Group, Economist Intelligence Unit indicators. Cross-reference intelligence domain.",
    "steps": [
      "Drill into Governance portal REGIME_INSTABILITY",
      "Review political-risk treatments",
      "Screen political-risk firms",
      "Position in sovereign-credit hedges",
      "Monitor multilateral response"
    ],
    "branch_up": "Regime change: extended political-risk premium.",
    "branch_down": "Stabilization: rotate out of hedges.",
    "outcome": "Political-risk firms and sovereign-credit analysts see increased corporate and sovereign demand.",
    "failure": "Rapid stabilization.",
    "window": "30 days–3 years",
    "realWorld": {
      "invest": "Political-risk: Eurasia Group (private), Control Risks (private). Public: Palantir (PLTR), FactSet (FDS).",
      "research": "Research brief: assess regime-fragmentation indicators and benchmark political-risk analytics against country-risk intelligence datasets (State Department, USAID, ICG, Eurasia Group).",
      "build": "Political-risk analytics, sovereign-credit monitoring, country-risk intelligence."
    },
    "examples": [
      "Political-risk advisory firms",
      "Sovereign-credit monitoring",
      "Country-risk intelligence platforms",
      "Geopolitical-forecasting analytics",
      "Democracy-support programs"
    ],
    "fastPath": [
      "1. Confirm REGIME_INSTABILITY",
      "2. Screen political-risk offerings (PLTR, FDS)",
      "3. Scope a research brief on regime-fragmentation indicators and political-risk analytics"
    ]
  },
  {
    "id": "policy_failure",
    "title": "Policy Failure Response",
    "type": "advise",
    "domains": [
      "governance",
      "economy"
    ],
    "pattern": "governance_policy",
    "explain": "Major policy failure triggering credibility loss and reform demand. Portal diagnosis POLICY_FAILURE maps through implementation-breakdown, credibility-loss, and reform-demand signals.",
    "action": "Position in policy-implementation tooling, government-tech, and evidence-based policy platforms. Review treatment nodes for accountability and performance-management.",
    "valueRange": "$500K–$20M government-tech contracts",
    "saturation": "medium",
    "trigger": "Governance stress > 0.45 with implementation_breakdown, credibility_loss, or reform_demand conditions active.",
    "validation": "Confirm GAO reports, OIG findings, performance.gov data.",
    "steps": [
      "Drill into Governance portal POLICY_FAILURE",
      "Review accountability treatments",
      "Screen gov-tech primes",
      "Position in implementation-analytics",
      "Track performance.gov and GAO dockets"
    ],
    "branch_up": "Systemic failure: multi-agency modernization wave.",
    "branch_down": "Isolated failure contained: shift to advisory.",
    "outcome": "Gov-tech and policy-implementation vendors capture modernization contracts.",
    "failure": "Political shift deprioritizes reform.",
    "window": "90 days–2 years",
    "realWorld": {
      "invest": "Gov-tech: Tyler Technologies (TYL), Veritone (VERI). Primes: Leidos (LDOS), CACI (CACI), Booz Allen (BAH).",
      "research": "Research brief: evaluate policy-implementation failure modes and benchmark gov-tech modernization programs (GSA 18F, USDS, TMF) for evidence of accountability improvement.",
      "build": "Performance-management platforms, policy-implementation analytics, accountability-monitoring."
    },
    "examples": [
      "Government-tech modernization",
      "Performance-management platforms",
      "Policy-implementation analytics",
      "Accountability-monitoring tooling",
      "Evidence-based-policy infrastructure"
    ],
    "fastPath": [
      "1. Confirm POLICY_FAILURE",
      "2. Screen gov-tech primes (TYL, LDOS, BAH)",
      "3. Scope a research brief on policy-implementation failure and modernization evidence"
    ]
  },
  {
    "id": "corruption_scandal",
    "title": "Corruption Scandal Response",
    "type": "advise",
    "domains": [
      "governance",
      "law"
    ],
    "pattern": "governance_corruption",
    "explain": "Corruption disclosure triggering investigation and integrity-reform demand. Portal diagnosis CORRUPTION_SCANDAL maps through disclosure, investigation, and integrity-gap signals.",
    "action": "Position in transparency tooling, ethics-monitoring, and anti-corruption compliance. Review treatment nodes for disclosure-automation and beneficial-ownership tracking.",
    "valueRange": "10–25% anti-corruption compliance returns",
    "saturation": "low",
    "trigger": "Governance stress > 0.45 with disclosure, investigation, or integrity_gap conditions active.",
    "validation": "Confirm DOJ/SEC/OIG enforcement. Cross-reference law domain.",
    "steps": [
      "Drill into Governance portal CORRUPTION_SCANDAL",
      "Review transparency treatments",
      "Screen anti-corruption tooling",
      "Position in FCPA-compliance platforms",
      "Track DOJ/SEC enforcement pipeline"
    ],
    "branch_up": "Systemic pattern: industry-wide compliance wave.",
    "branch_down": "Isolated case: shift to advisory.",
    "outcome": "Anti-corruption compliance and transparency tooling capture corporate and government demand.",
    "failure": "Case contained. No reform.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Compliance: LexisNexis (RELX), Thomson Reuters (TRI), Refinitiv. Pure-plays: Dow Jones Risk (private).",
      "research": "Research brief: map anti-corruption enforcement patterns (DOJ, SEC, OIG) and benchmark FCPA-compliance and beneficial-ownership tracking solutions.",
      "build": "Beneficial-ownership tracking, FCPA-compliance automation, integrity-monitoring platforms."
    },
    "examples": [
      "FCPA-compliance platforms",
      "Beneficial-ownership tracking",
      "Integrity-monitoring tooling",
      "Whistleblower-protection infrastructure",
      "Transparency and disclosure platforms"
    ],
    "fastPath": [
      "1. Confirm CORRUPTION_SCANDAL",
      "2. Screen FCPA-compliance platforms (RELX, TRI)",
      "3. Scope a research brief on anti-corruption enforcement and integrity-monitoring evidence"
    ]
  },
  {
    "id": "diplomatic_breakdown",
    "title": "Diplomatic Breakdown Response",
    "type": "advise",
    "domains": [
      "governance",
      "defense"
    ],
    "pattern": "governance_diplomatic",
    "explain": "Alliance rupture, treaty withdrawal, or diplomatic-recall cascade. Portal diagnosis DIPLOMATIC_BREAKDOWN maps through alliance-rupture, treaty-withdrawal, and diplomatic-recall signals.",
    "action": "Position in alliance-coordination tooling, strategic-communication, and multilateral advisory. Review treatment nodes for diplomacy-analytics.",
    "valueRange": "$250K–$10M diplomatic and multilateral advisory",
    "saturation": "low",
    "trigger": "Governance stress > 0.45 with alliance_rupture, treaty_withdrawal, or diplomatic_recall conditions active.",
    "validation": "Confirm State Department announcements, UN votes, multilateral statements.",
    "steps": [
      "Drill into Governance portal DIPLOMATIC_BREAKDOWN",
      "Review alliance-coordination treatments",
      "Position in strategic-communication advisory",
      "Track State Department priorities",
      "Monitor multilateral response"
    ],
    "branch_up": "Breakdown cascades: sustained multilateral advisory demand.",
    "branch_down": "Diplomatic recovery: shift to strategic-communication investment.",
    "outcome": "Multilateral-advisory and strategic-communication firms capture State/multilateral demand.",
    "failure": "Quick diplomatic recovery.",
    "window": "30 days–2 years",
    "realWorld": {
      "invest": "Limited public exposure.",
      "research": "Research brief: analyze diplomatic-breakdown indicators and map multilateral-advisory demand (State Department Public Diplomacy, USAID, UN, OAS funding landscape).",
      "build": "Alliance-coordination platforms, diplomacy-analytics tooling, strategic-communication infrastructure."
    },
    "examples": [
      "Alliance-coordination tooling",
      "Diplomacy-analytics platforms",
      "Strategic-communication advisory",
      "Multilateral-coordination infrastructure",
      "Treaty-monitoring platforms"
    ],
    "fastPath": [
      "1. Confirm DIPLOMATIC_BREAKDOWN",
      "2. Position advisory to State/multilateral",
      "3. Scope a research brief on diplomatic-breakdown indicators and multilateral-advisory market"
    ]
  },
  {
    "id": "military_overreach",
    "title": "Military Overreach Response",
    "type": "advise",
    "domains": [
      "governance",
      "defense",
      "law"
    ],
    "pattern": "governance_military",
    "explain": "Civil-military tension, Posse Comitatus concerns, or military-policy overextension. Portal diagnosis MILITARY_OVERREACH maps through civil-military-tension, posse-concerns, and policy-overextension signals.",
    "action": "Position in civil-military oversight tooling, rule-of-law advisory, and defense-accountability platforms.",
    "valueRange": "Advisory and foundation-funded accountability work",
    "saturation": "low",
    "trigger": "Governance stress > 0.45 with civil_military_tension, posse_concerns, or policy_overextension conditions active.",
    "validation": "Confirm DoD IG, congressional oversight, civil-liberties advocacy signals.",
    "steps": [
      "Drill into Governance portal MILITARY_OVERREACH",
      "Review civil-military oversight treatments",
      "Position advisory to oversight bodies",
      "Track congressional hearings",
      "Monitor civil-liberties litigation"
    ],
    "branch_up": "Tension deepens: sustained oversight-infrastructure demand.",
    "branch_down": "Institutional resolution: shift to preventive monitoring.",
    "outcome": "Civil-military oversight and accountability platforms see foundation and congressional-support demand.",
    "failure": "Political resolution. Funding absorbed.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Limited public exposure.",
      "research": "Research brief: assess civil-military tension indicators and map defense-accountability funding landscape (MacArthur Foundation, Hewlett, ACLU-adjacent funders).",
      "build": "Civil-military oversight tooling, defense-accountability analytics, rule-of-law monitoring."
    },
    "examples": [
      "Civil-military oversight platforms",
      "Defense-accountability analytics",
      "Congressional-oversight tooling",
      "Rule-of-law monitoring",
      "Civil-liberties litigation support"
    ],
    "fastPath": [
      "1. Confirm MILITARY_OVERREACH",
      "2. Position advisory to oversight bodies",
      "3. Scope a research brief on civil-military tension and accountability infrastructure"
    ]
  },
  {
    "id": "governance_data_gap",
    "title": "Governance Data Gap → Build",
    "type": "build",
    "domains": [
      "governance"
    ],
    "pattern": null,
    "explain": "Governance monitoring has gaps. Build transparency and accountability platforms.",
    "action": "Build real-time governance-intelligence platforms.",
    "valueRange": "$500K–$10M governance-data infrastructure",
    "saturation": "low",
    "trigger": "Governance sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Governance feed health",
      "Count OFFLINE sources",
      "Identify gap",
      "Build pipeline",
      "Scope research brief on governance-data infrastructure landscape"
    ],
    "branch_up": "Gap persists: build infrastructure.",
    "branch_down": "Sources recover: monitor.",
    "outcome": "Governance-intelligence platform.",
    "failure": "Incumbents absorb.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "research": "Research brief: map governance-data coverage gaps and evaluate legislative-tracking, regulatory-monitoring, and transparency platforms (Democracy Fund, Knight Foundation, Hewlett, Ford open-data landscape).",
      "build": "Legislative-tracking, regulatory-monitoring, governance-transparency platforms."
    },
    "examples": [
      "Legislative-tracking dashboards",
      "Regulatory-monitoring platforms",
      "Governance-transparency tooling",
      "Political-finance intelligence",
      "Public-administration analytics"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify governance-data gap",
      "3. Scope a research brief on governance-transparency infrastructure"
    ]
  }
];

  window.LIMENGovernanceOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENGovernanceOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
