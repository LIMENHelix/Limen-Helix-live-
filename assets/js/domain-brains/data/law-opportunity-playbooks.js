/**
 * law-opportunity-playbooks.js
 *
 * Canonical Law domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the law-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENLawOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "judicial_crisis",
    "title": "Judicial Crisis Response",
    "type": "advise",
    "domains": [
      "law",
      "governance"
    ],
    "pattern": "law_judicial",
    "explain": "Court capacity collapse, judicial-independence threat, or docket-backlog crisis. Portal diagnosis JUDICIAL_CRISIS maps through capacity-collapse, independence-threat, and backlog-crisis signals.",
    "action": "Position in court-modernization tooling, case-management platforms, and judicial-tech. Review treatment nodes for e-filing and dispute-resolution infrastructure.",
    "valueRange": "$500K–$20M legal-tech / court-modernization contracts",
    "saturation": "medium",
    "trigger": "Law stress > 0.50 with capacity_collapse, independence_threat, or backlog_crisis conditions active.",
    "validation": "Confirm National Center for State Courts, Administrative Office of U.S. Courts, Pew data.",
    "steps": [
      "Drill into Law portal JUDICIAL_CRISIS",
      "Review court-modernization treatments",
      "Screen legal-tech primes (TYL, RELX, Thomson Reuters)",
      "Position in e-filing and case-management",
      "Track NCSC and AOUSC funding"
    ],
    "branch_up": "Crisis deepens: multi-state modernization wave.",
    "branch_down": "Reform stabilizes: shift to efficiency investment.",
    "outcome": "Legal-tech and court-modernization vendors capture state and federal contracts.",
    "failure": "Legislative inaction.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Legal-tech: Tyler Technologies (TYL), RELX (RELX), Thomson Reuters (TRI). Pure-plays: Relativity, Everlaw (private).",
      "apply": "DOJ BJA, State Justice Institute, Administrative Office of U.S. Courts modernization contracts.",
      "build": "Court case-management platforms, e-filing infrastructure, judicial-analytics."
    },
    "examples": [
      "Court case-management systems",
      "E-filing and e-discovery platforms",
      "Judicial-analytics",
      "Alternative dispute resolution (ADR) platforms",
      "Court modernization tooling"
    ],
    "fastPath": [
      "1. Confirm JUDICIAL_CRISIS",
      "2. Screen TYL/RELX",
      "3. Pursue State Justice Institute or BJA contracts"
    ]
  },
  {
    "id": "constitutional_violation",
    "title": "Constitutional Violation Response",
    "type": "advise",
    "domains": [
      "law",
      "governance"
    ],
    "pattern": "law_constitutional",
    "explain": "Rights violation cascade or constitutional challenge wave. Portal diagnosis CONSTITUTIONAL_VIOLATION maps through rights-violation, legal-challenge, and remedy-backlog signals.",
    "action": "Position in public-interest litigation support, legal-analytics, and rights-monitoring tooling.",
    "valueRange": "Foundation-funded and impact-litigation",
    "saturation": "low",
    "trigger": "Law stress > 0.45 with rights_violation, legal_challenge, or remedy_backlog conditions active.",
    "validation": "Confirm ACLU, NAACP LDF, civil-rights-division activity.",
    "steps": [
      "Drill into Law portal CONSTITUTIONAL_VIOLATION",
      "Review public-interest litigation treatments",
      "Position advisory to impact litigators",
      "Track foundation civil-rights funding",
      "Screen legal-analytics platforms"
    ],
    "branch_up": "Violation cascade: sustained impact-litigation demand.",
    "branch_down": "Remedy deployed: shift to preventive monitoring.",
    "outcome": "Public-interest legal-tech and rights-monitoring platforms capture foundation funding.",
    "failure": "Legislative remedy resolves quickly.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Legal-analytics: Lex Machina (via RELX), Fastcase. Pure-plays: Casetext, Everlaw (private).",
      "apply": "Ford Foundation, MacArthur, Open Society, Public Welfare Foundation civil-rights programs.",
      "build": "Impact-litigation support tooling, rights-monitoring platforms, legal-analytics for civil-rights cases."
    },
    "examples": [
      "Impact-litigation platforms",
      "Legal-analytics for civil rights",
      "Rights-monitoring tooling",
      "Public-interest law support",
      "Constitutional-challenge tracking"
    ],
    "fastPath": [
      "1. Confirm CONSTITUTIONAL_VIOLATION",
      "2. Support impact litigators with legal-analytics",
      "3. Pursue Ford or Open Society funding"
    ]
  },
  {
    "id": "regulatory_capture",
    "title": "Regulatory Capture Response",
    "type": "advise",
    "domains": [
      "law",
      "governance",
      "economy"
    ],
    "pattern": "law_regulatory",
    "explain": "Agency capture by regulated industry limiting rule-enforcement. Portal diagnosis REGULATORY_CAPTURE maps through enforcement-gap, industry-influence, and rule-dilution signals.",
    "action": "Position in regulatory-tracking tooling, enforcement-monitoring, and public-interest advocacy.",
    "valueRange": "Advisory and foundation-funded regulatory work",
    "saturation": "low",
    "trigger": "Law stress > 0.40 with enforcement_gap, industry_influence, or rule_dilution conditions active.",
    "validation": "Confirm GAO, OIG, Public Citizen, Revolving Door Project data.",
    "steps": [
      "Drill into Law portal REGULATORY_CAPTURE",
      "Review regulatory-tracking treatments",
      "Position advisory to oversight groups",
      "Track Federal Register comment periods",
      "Monitor revolving-door data"
    ],
    "branch_up": "Capture deepens: sustained oversight demand.",
    "branch_down": "Reform cycle: rotate to rule-implementation tooling.",
    "outcome": "Regulatory-tracking and oversight platforms capture foundation and congressional support.",
    "failure": "Reform cycle absorbs capture.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Regulatory-tracking: FiscalNote (NOTE), Bloomberg Government. Pure-plays: Quorum, RegSkope.",
      "apply": "Public Citizen, Revolving Door Project, Hewlett transparency programs.",
      "build": "Regulatory-comment-tracking platforms, enforcement-analytics, revolving-door monitoring."
    },
    "examples": [
      "Regulatory-tracking platforms",
      "Enforcement-analytics",
      "Revolving-door monitoring",
      "Federal-register comment-analytics",
      "Industry-influence mapping"
    ],
    "fastPath": [
      "1. Confirm REGULATORY_CAPTURE",
      "2. Screen FiscalNote or Quorum",
      "3. Pursue Public Citizen or Hewlett funding"
    ]
  },
  {
    "id": "mass_incarceration",
    "title": "Mass Incarceration Response",
    "type": "fund",
    "domains": [
      "law",
      "population"
    ],
    "pattern": "law_incarceration",
    "explain": "Prison-overcrowding, recidivism, and sentencing-reform pressure. Portal diagnosis MASS_INCARCERATION maps through overcrowding, recidivism, and sentencing-pressure signals.",
    "action": "Position in criminal-justice reform tooling, reentry platforms, and diversion services.",
    "valueRange": "$250K–$10M criminal-justice reform grants",
    "saturation": "low",
    "trigger": "Law stress > 0.45 with overcrowding, recidivism, or sentencing_pressure conditions active.",
    "validation": "Confirm BJS statistics, Vera Institute, Prison Policy Initiative data.",
    "steps": [
      "Drill into Law portal MASS_INCARCERATION",
      "Review reform treatments",
      "Screen reentry and diversion platforms",
      "Apply to BJA Second Chance Act, SAMHSA, Arnold Ventures",
      "Position in criminal-justice reform organizations"
    ],
    "branch_up": "Reform wave: scale diversion and reentry infrastructure.",
    "branch_down": "Political rollback: shift to foundation-only work.",
    "outcome": "Reentry, diversion, and reform platforms capture BJA, SAMHSA, and Arnold Ventures funding.",
    "failure": "Political rollback.",
    "window": "180 days–5 years",
    "realWorld": {
      "invest": "Limited public exposure.",
      "apply": "BJA Second Chance Act, SAMHSA criminal-justice grants, Arnold Ventures, Ford Foundation.",
      "build": "Reentry case-management, diversion-program platforms, recidivism-monitoring."
    },
    "examples": [
      "Reentry case-management platforms",
      "Pretrial diversion infrastructure",
      "Recidivism-monitoring tooling",
      "Sentencing-reform advocacy",
      "Community-corrections platforms"
    ],
    "fastPath": [
      "1. Confirm MASS_INCARCERATION",
      "2. Screen reentry platforms",
      "3. Apply to BJA Second Chance Act"
    ]
  },
  {
    "id": "international_law_breakdown",
    "title": "International Law Breakdown Response",
    "type": "advise",
    "domains": [
      "law",
      "defense",
      "governance"
    ],
    "pattern": "law_international",
    "explain": "Treaty breach, norms erosion, or multilateral-institution collapse. Portal diagnosis INTERNATIONAL_LAW_BREAKDOWN maps through treaty-breach, norms-erosion, and institutional-collapse signals.",
    "action": "Position in international-law advisory, sanctions-compliance, and multilateral monitoring.",
    "valueRange": "$250K–$20M international-law advisory",
    "saturation": "low",
    "trigger": "Law stress > 0.45 with treaty_breach, norms_erosion, or institutional_collapse conditions active.",
    "validation": "Confirm UN, ICJ, WTO dispute data. Cross-reference defense/governance.",
    "steps": [
      "Drill into Law portal INTERNATIONAL_LAW_BREAKDOWN",
      "Review sanctions-compliance treatments",
      "Screen international-law advisory firms",
      "Position in sanctions-screening tooling",
      "Track UN and ICJ dockets"
    ],
    "branch_up": "Breakdown cascades: sustained sanctions and compliance demand.",
    "branch_down": "Multilateral recovery: rotate to compliance maintenance.",
    "outcome": "Sanctions-compliance and international-law tooling capture corporate and government demand.",
    "failure": "Quick multilateral recovery.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Sanctions-screening: LexisNexis (RELX), Thomson Reuters (TRI), Refinitiv.",
      "apply": "State Department, USAID international rule-of-law programs, Open Society international-law work.",
      "build": "Sanctions-screening automation, treaty-compliance tooling, international-dispute analytics."
    },
    "examples": [
      "Sanctions-screening automation",
      "Treaty-compliance platforms",
      "International-dispute analytics",
      "Multilateral-monitoring tooling",
      "Export-controls compliance"
    ],
    "fastPath": [
      "1. Confirm INTERNATIONAL_LAW_BREAKDOWN",
      "2. Screen sanctions-screening tooling",
      "3. Pursue State Department rule-of-law funding"
    ]
  },
  {
    "id": "law_data_gap",
    "title": "Law Data Gap → Build",
    "type": "build",
    "domains": [
      "law"
    ],
    "pattern": null,
    "explain": "Law monitoring has gaps. Build legal-intelligence platforms.",
    "action": "Build real-time legal-intelligence platforms.",
    "valueRange": "$500K–$10M law-data infrastructure",
    "saturation": "low",
    "trigger": "Law sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Law feed health",
      "Count OFFLINE",
      "Identify gap",
      "Build pipeline",
      "Apply to State Justice Institute or foundations"
    ],
    "branch_up": "Gap persists: build.",
    "branch_down": "Sources recover: monitor.",
    "outcome": "Legal-intelligence platform.",
    "failure": "RELX/Thomson Reuters absorb.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "apply": "State Justice Institute, NSF Law and Social Sciences, Ford Foundation.",
      "build": "Court-docket analytics, regulatory-tracking, enforcement monitoring."
    },
    "examples": [
      "Court-docket analytics",
      "Regulatory-tracking dashboards",
      "Enforcement-monitoring",
      "Legal-research AI",
      "Judicial-analytics"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify gap",
      "3. Pursue SJI or NSF LSS"
    ]
  }
];

  window.LIMENLawOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENLawOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
