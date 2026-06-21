/**
 * religion-opportunity-playbooks.js
 *
 * Canonical Religion domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the religion-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENReligionOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "sectarian_conflict",
    "title": "Sectarian Conflict Response",
    "type": "advise",
    "domains": [
      "religion",
      "governance",
      "defense"
    ],
    "pattern": "religion_sectarian",
    "explain": "Inter-group religious conflict with violence risk or social-cohesion collapse. Portal diagnosis SECTARIAN_CONFLICT maps through inter-group-violence, social-cohesion-collapse, and religious-polarization signals.",
    "action": "Position in interfaith-dialogue platforms, religious-freedom advocacy, and conflict-resolution tooling.",
    "valueRange": "Foundation-funded peacebuilding and advisory",
    "saturation": "low",
    "trigger": "Religion stress > 0.55 with inter_group_violence, social_cohesion_collapse, or religious_polarization conditions active.",
    "validation": "Confirm USCIRF, PRRI, Religious Freedom Institute data.",
    "steps": [
      "Drill into Religion portal SECTARIAN_CONFLICT",
      "Review interfaith treatments",
      "Screen peacebuilding organizations",
      "Research USIP, State IRF, Templeton methodologies and evidence base",
      "Position advisory to affected communities"
    ],
    "branch_up": "Conflict escalation: sustained peacebuilding demand.",
    "branch_down": "Reconciliation: shift to preventive advisory.",
    "outcome": "Peacebuilding and interfaith organizations capture State Department, USIP, and foundation support.",
    "failure": "Quick reconciliation.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Limited public exposure.",
      "research": "Conflict-resolution research via USIP, State Department International Religious Freedom (IRF), Templeton Foundation, Carnegie — study evidence base and best practices.",
      "build": "Conflict-resolution platforms, interfaith-dialogue tooling, religious-tension monitoring."
    },
    "examples": [
      "Peacebuilding organizations",
      "Interfaith-dialogue platforms",
      "Religious-tension monitoring",
      "Conflict-resolution tooling",
      "Religious-freedom advocacy"
    ],
    "fastPath": [
      "1. Confirm SECTARIAN_CONFLICT",
      "2. Apply to USIP or State IRF",
      "3. Position advisory to affected communities"
    ]
  },
  {
    "id": "institutional_abuse",
    "title": "Institutional Abuse Response",
    "type": "advise",
    "domains": [
      "religion",
      "law"
    ],
    "pattern": "religion_abuse",
    "explain": "Clergy abuse, institutional cover-up, or religious-accountability failure. Portal diagnosis INSTITUTIONAL_ABUSE maps through abuse-disclosure, cover-up, and accountability-failure signals.",
    "action": "Position in victim-support, religious-accountability, and survivor-advocacy platforms.",
    "valueRange": "Foundation-funded accountability work",
    "saturation": "low",
    "trigger": "Religion stress > 0.45 with abuse_disclosure, cover_up, or accountability_failure conditions active.",
    "validation": "Confirm state attorney general reports, SNAP data, church-accountability databases.",
    "steps": [
      "Drill into Religion portal INSTITUTIONAL_ABUSE",
      "Review survivor-support treatments",
      "Support accountability organizations (SNAP, BishopAccountability.org)",
      "Research Kellogg, Hewlett, Ford, Arnold Ventures victim-support evidence base",
      "Track AG investigations"
    ],
    "branch_up": "Systemic disclosure wave: sustained accountability infrastructure.",
    "branch_down": "Institutional reform: shift to preventive monitoring.",
    "outcome": "Survivor-support and accountability organizations capture foundation and AG-investigation support.",
    "failure": "Institutional absorption without reform.",
    "window": "180 days–5 years",
    "realWorld": {
      "invest": "Limited public exposure.",
      "research": "Review Kellogg Foundation, Hewlett, Ford, Arnold Ventures victim-support research and model programs — study evidence base for accountability infrastructure.",
      "build": "Survivor-support platforms, institutional-accountability tooling, disclosure-tracking."
    },
    "examples": [
      "Survivor-support platforms",
      "Institutional-accountability tooling",
      "Disclosure-tracking databases",
      "Victim-advocacy infrastructure",
      "Reform-monitoring services"
    ],
    "fastPath": [
      "1. Confirm INSTITUTIONAL_ABUSE",
      "2. Support accountability organizations",
      "3. Pursue Kellogg or Hewlett"
    ]
  },
  {
    "id": "radicalization",
    "title": "Radicalization Response",
    "type": "advise",
    "domains": [
      "religion",
      "defense",
      "intelligence"
    ],
    "pattern": "religion_radicalization",
    "explain": "Extremist recruitment, radicalization pipeline, or violent-extremism risk. Portal diagnosis RADICALIZATION maps through extremist-recruitment, pipeline, and violent-extremism-risk signals.",
    "action": "Position in countering-violent-extremism (CVE) platforms, deradicalization services, and online-safety tooling.",
    "valueRange": "$500K–$10M CVE investment and research",
    "saturation": "low",
    "trigger": "Religion stress > 0.50 with extremist_recruitment, radicalization_pipeline, or violent_extremism_risk conditions active.",
    "validation": "Confirm DHS, FBI, NCTC reporting, GIFCT data.",
    "steps": [
      "Drill into Religion portal RADICALIZATION",
      "Review CVE treatments",
      "Screen CVE vendors (Moonshot, Jigsaw)",
      "Research DHS CP3, State CT, Templeton evidence base and investment thesis",
      "Track GIFCT cooperation"
    ],
    "branch_up": "Pipeline expansion: sustained CVE investment and research demand.",
    "branch_down": "Containment: shift to preventive online-safety research.",
    "outcome": "CVE and deradicalization platforms attract investment; research builds evidence base for intervention.",
    "failure": "Containment.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "CVE and online-safety platforms (Moonshot CVE, Jigsaw/Alphabet ventures).",
      "research": "Study DHS Center for Prevention Programs (CP3), State CT Bureau, Templeton CVE evidence base — map intervention models and efficacy data.",
      "build": "CVE platforms, deradicalization services, online-safety tooling for religious-extremism contexts."
    },
    "examples": [
      "CVE platforms",
      "Deradicalization services",
      "Online-safety tooling",
      "Extremism-monitoring",
      "Community-resilience infrastructure"
    ],
    "fastPath": [
      "1. Confirm RADICALIZATION",
      "2. Screen Moonshot or Jigsaw",
      "3. Pursue DHS CP3"
    ]
  },
  {
    "id": "secularization_crisis",
    "title": "Secularization Crisis Response",
    "type": "invest",
    "domains": [
      "religion",
      "population",
      "culture"
    ],
    "pattern": "religion_secularization",
    "explain": "Rapid secularization, institutional decline, or religious-identity loss. Portal diagnosis SECULARIZATION_CRISIS maps through secularization, institutional-decline, and identity-loss signals.",
    "action": "Invest in community-services, spiritual-but-not-religious platforms, and religious-revitalization infrastructure. Research demographic trends and institutional models.",
    "valueRange": "$100K–$5M religious-institution innovation investment",
    "saturation": "low",
    "trigger": "Religion stress > 0.45 with secularization, institutional_decline, or religious_identity_loss conditions active.",
    "validation": "Confirm Pew Research, PRRI, General Social Survey data.",
    "steps": [
      "Drill into Religion portal SECULARIZATION_CRISIS",
      "Review revitalization treatments",
      "Research Lilly Endowment, Templeton investment thesis and denominational models",
      "Position in community-service platforms and religious-institution management tools",
      "Monitor demographic trends via Pew, PRRI, General Social Survey"
    ],
    "branch_up": "Accelerating decline: institutional-reinvention investment accelerates.",
    "branch_down": "Stabilization: shift to community-service infrastructure investment.",
    "outcome": "Religious-institution innovation and community-service platforms attract investment; research guides positioning.",
    "failure": "Decline continues without reform.",
    "window": "180 days–5 years",
    "realWorld": {
      "invest": "Community-service platforms, faith-formation technology, congregation-analytics services — backed by Lilly Endowment, Templeton Foundation.",
      "research": "Study Pew Research, PRRI, General Social Survey on secularization trends; review Lilly Endowment and Templeton denominational capacity-building models.",
      "build": "Community-service platforms, religious-institution management tooling, spiritual-but-not-religious programs."
    },
    "examples": [
      "Community-service platforms",
      "Religious-institution management tooling",
      "Spiritual-but-not-religious programs",
      "Faith-formation technology",
      "Congregation-analytics services"
    ],
    "fastPath": [
      "1. Confirm SECULARIZATION_CRISIS",
      "2. Apply to Lilly Endowment",
      "3. Position advisory to institutions"
    ]
  },
  {
    "id": "theological_schism",
    "title": "Theological Schism Response",
    "type": "advise",
    "domains": [
      "religion",
      "culture"
    ],
    "pattern": "religion_schism",
    "explain": "Intra-denominational split, theological rupture, or doctrinal crisis. Portal diagnosis THEOLOGICAL_SCHISM maps through denomination-split, doctrinal-rupture, and theological-crisis signals.",
    "action": "Position in denominational-mediation, theological-scholarship, and congregation-transition advisory. Research schism patterns and reconciliation evidence.",
    "valueRange": "Advisory and denominational-capacity-building",
    "saturation": "low",
    "trigger": "Religion stress > 0.40 with denomination_split, doctrinal_rupture, or theological_crisis conditions active.",
    "validation": "Confirm denominational polling, conference reports, congregational survey data.",
    "steps": [
      "Drill into Religion portal THEOLOGICAL_SCHISM",
      "Review mediation treatments",
      "Position advisory to denominations",
      "Research Lilly, Templeton, Henry Luce scholarship programs and evidence base",
      "Monitor denominational polling"
    ],
    "branch_up": "Schism formalizes: transition-advisory demand.",
    "branch_down": "Reconciliation: shift to preventive dialogue.",
    "outcome": "Denominational-mediation and transition advisors capture denominational support; research informs best practices.",
    "failure": "Status-quo continuation.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Limited public exposure.",
      "research": "Review Lilly Endowment, Templeton, Henry Luce Foundation religion scholarship — study denominational schism patterns and mediation evidence base.",
      "build": "Denominational-mediation platforms, theological-scholarship infrastructure, congregation-transition advisory."
    },
    "examples": [
      "Denominational-mediation services",
      "Theological-scholarship platforms",
      "Congregation-transition advisory",
      "Doctrinal-conversation tooling",
      "Religious-leadership development"
    ],
    "fastPath": [
      "1. Confirm THEOLOGICAL_SCHISM",
      "2. Position advisory to denominations",
      "3. Pursue Lilly or Henry Luce"
    ]
  },
  {
    "id": "religion_data_gap",
    "title": "Religion Data Gap → Research",
    "type": "research",
    "domains": [
      "religion"
    ],
    "pattern": null,
    "explain": "Religion monitoring has gaps. Research and build religion-and-society intelligence platforms.",
    "action": "Research existing religion-intelligence platforms and data gaps; build targeted infrastructure.",
    "valueRange": "$250K–$5M religion-data infrastructure",
    "saturation": "low",
    "trigger": "Religion sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Religion feed health",
      "Count OFFLINE sources",
      "Identify which dimension is uncovered",
      "Research Templeton, Lilly, Henry Luce existing data infrastructure and gaps",
      "Build targeted pipeline addressing confirmed gap"
    ],
    "branch_up": "Gap persists: build permanent infrastructure.",
    "branch_down": "Sources recover: monitor for recurrence.",
    "outcome": "Religion-and-society intelligence platform serving researchers and institutions.",
    "failure": "Pew/PRRI absorb the gap.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "research": "Survey Templeton Foundation, Lilly Endowment, Henry Luce Foundation existing religion-data infrastructure — identify gaps and build on published methodology.",
      "build": "Religion-and-society analytics, congregation-demographic monitoring, interfaith-sentiment tracking."
    },
    "examples": [
      "Religion-and-society analytics",
      "Congregation-demographic monitoring",
      "Interfaith-sentiment tracking",
      "Religious-polarization indicators",
      "Faith-practice trend analysis"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify gap",
      "3. Pursue Templeton or Lilly"
    ]
  }
];

  window.LIMENReligionOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENReligionOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
