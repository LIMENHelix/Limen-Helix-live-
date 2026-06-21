/**
 * population-opportunity-playbooks.js
 *
 * Canonical Population domain opportunity playbook dataset.
 * Domain-owned. Single source of truth consumed by:
 *   - /population-opportunities.html (page-level playbook activation + render)
 *   - assets/js/domain-brains/population-brain.js (brain-side enrichment of
 *     state.opportunities[] so /opportunities.html can project rich fields)
 *
 * Content extracted verbatim from the in-file PLAYBOOKS literal that previously
 * lived inside population-opportunities.html. No narrative rewritten. No
 * Civilization-authored text added.
 *
 * Exposes: window.LIMENPopulationOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
    {
      id:'population_collapse', title:'Population Collapse',
      type:'invest', domains:['population','economy'],
      pattern:'population_demographic',
      explain:'Fertility rates far below replacement. Labor force shrinking, dependency ratios inverting, economic contraction looming. Portal diagnosis POPULATION_COLLAPSE maps this through OXY (birth rates), SEPT (family structure), M1 (labor force), RAPHE (aging burden), VTA (youth cohort), RSC (rural depopulation).',
      action:'Drill into the Population portal POPULATION_COLLAPSE diagnosis. Review treatment nodes for workforce stabilization, pro-natalist policy support, eldercare capacity, and immigration integration. Identify which node circuits are most stressed and match treatments to investable or research pathways.',
      valueRange:'Structural \u2014 5\u201315 year demographic transition',
      saturation:'low',
      trigger:'Population stress > 0.40 with aging_skew, fertility_decline, or dependency_ratio conditions active.',
      validation:'Confirm World Bank / UN population data LIVE. Check fertility rate trends. Verify dependency ratio trajectory. Drill into portal node RAPHE and M1 for treatment evidence levels.',
      steps:['Go to limenhelix.com/domain-console?domain=population \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm POPULATION_COLLAPSE is active with matched conditions','Click through to portal \u2192 open POPULATION_COLLAPSE diagnosis detail','Review implicated nodes: OXY (births), M1 (labor), RAPHE (aging), SEPT (family)','Read treatments at each node \u2192 note evidence level (Strong/Moderate/Emerging)','Identify which treatments map to investable companies, grantable programs, or buildable platforms'],
      branch_up:'Dependency ratio rising 3+ cycles: structural demographic collapse confirmed. Long-duration eldercare and automation positioning.',
      branch_down:'Immigration policy or pro-natalist incentives stabilize ratios: acute pressure eases. Shift to integration services.',
      outcome:'Eldercare, workforce automation, and demographic planning systems see sustained multi-decade demand.',
      failure:'Pro-natalist policy reverses fertility decline faster than projected. Immigration fills labor gaps.',
      window:'1\u201315 years (structural)',
      realWorld:{invest:'Eldercare operators, home health platforms, workforce automation companies.',research:'Demographic forecasting tools for municipal and healthcare planning; academic programs in population dynamics and labor economics.'},
      examples:['Eldercare and home health infrastructure','Workforce retraining and automation','Pro-natalist policy support systems','Pension and retirement system modernization','Rural community revitalization programs'],
      fastPath:['1. Confirm POPULATION_COLLAPSE active in console diagnosis chain','2. Drill into portal \u2192 review OXY and RAPHE node treatments','3. Match strongest-evidence treatments to investment or research pathways']
    },
    {
      id:'mass_migration', title:'Mass Migration Crisis',
      type:'research', domains:['population','law','governance'],
      pattern:'population_migration',
      explain:'Climate displacement, conflict, and economic desperation driving unprecedented population movements. Portal diagnosis MASS_MIGRATION maps through VEST (migration flows), CeA (refugee surge), dlPFC (urban planning), TPJ (intercultural empathy), OFC (income distribution).',
      action:'Drill into the Population portal MASS_MIGRATION diagnosis. Review treatment nodes for reception capacity, integration services, housing, and policy stabilization. Match treatments to investment or research pathways.',
      valueRange:'$500K\u2013$10M government/NGO contracts and programs',
      saturation:'medium',
      trigger:'Population stress > 0.45 with migration_surge, displacement_event, or border_pressure conditions active.',
      validation:'Check UN displacement data. Confirm defense or law domain cross-signals. Drill into portal node VEST and CeA for treatment specifics and evidence levels.',
      steps:['Go to limenhelix.com/domain-console?domain=population \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm MASS_MIGRATION is active','Check cross-domain emissions to law (migration_policy_pressure) and governance','Click through to portal \u2192 open MASS_MIGRATION diagnosis detail','Review implicated nodes: VEST (flows), CeA (refugees), dlPFC (urban planning)','Read treatments \u2192 identify reception, integration, and housing interventions','Match to investable integration platforms or research programs (UNHCR, IOM, academic migration centers)'],
      branch_up:'Displacement persists 3+ months: structural crisis. Scale integration services and housing.',
      branch_down:'Migration flow stabilizes: acute phase passes. Shift to long-term integration and credential recognition.',
      outcome:'Integration service providers, settlement infrastructure, and policy support systems see sustained demand.',
      failure:'Migration flow reverses. Political backlash redirects funding to enforcement over integration.',
      window:'7 days\u20132 years',
      realWorld:{invest:'Language platforms, housing developers in receiving areas, workforce integration tech.',research:'Research brief: assess reception-capacity models and integration-program efficacy across host countries \u2014 which interventions measurably improve outcomes.',build:'Migration intake processing, integration case management, or credential recognition platforms.'},
      examples:['Settlement and reception infrastructure','Language and cultural integration platforms','Legal aid and documentation services','Housing for displaced populations','Workforce credential recognition systems'],
      fastPath:['1. Confirm MASS_MIGRATION active in console diagnosis chain','2. Drill into portal \u2192 review VEST and CeA node treatments','3. Scope a research brief on refugee integration outcomes or invest in settlement-infrastructure companies']
    },
    {
      id:'aging_crisis', title:'Aging Crisis',
      type:'invest', domains:['population','health'],
      pattern:'population_aging',
      explain:'Dependency ratios inverting as populations age. Healthcare, pension, and caregiving systems approaching insolvency. Portal diagnosis AGING_CRISIS maps through RAPHE (elder burden), CARD (chronic disease), M1 (workforce decline), AG (skill obsolescence), SEPT (family caregiving), OFC (pension funding).',
      action:'Drill into the Population portal AGING_CRISIS diagnosis. Review treatment nodes for eldercare capacity, chronic disease management, pension reform, and workforce retention. Identify which treatments have strongest evidence and match to investment or grant pathways.',
      valueRange:'10\u201340% healthcare/eldercare infrastructure returns',
      saturation:'medium',
      trigger:'Population stress > 0.45 with aging_skew, dependency_ratio, or healthcare_overload conditions active.',
      validation:'Confirm aging demographic data from World Bank/UN. Check health domain for corroborating signals. Drill into portal node RAPHE and CARD for treatment evidence.',
      steps:['Go to limenhelix.com/domain-console?domain=population \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm AGING_CRISIS is active','Check cross-domain emissions to economy (labor_demand_shift)','Click through to portal \u2192 open AGING_CRISIS diagnosis detail','Review implicated nodes: RAPHE (aging), CARD (chronic disease), M1 (workforce)','Read treatments at each node with evidence levels','Identify eldercare, chronic disease, and pension companies in node/company mappings'],
      branch_up:'Aging trend accelerating: automation and care infrastructure become urgent. Long-duration positioning.',
      branch_down:'Immigration or workforce participation policy offsets aging pressure: shift to integration services.',
      outcome:'Eldercare, chronic disease management, and pension technology companies see sustained structural demand.',
      failure:'Medical advances extend healthy working years. Immigration fills care workforce gaps.',
      window:'1\u201310 years (structural)',
      realWorld:{invest:'Eldercare operators, chronic disease management, home health. Examples: Amedisys, Humana, CVS Health.',research:'Research brief: model eldercare demand curves and evaluate which chronic-disease management interventions reduce hospitalization rates.',build:'Eldercare coordination platforms, chronic disease monitoring, pension planning tools.'},
      examples:['Eldercare and long-term care operators','Chronic disease management platforms','Home health and telemedicine for seniors','Pension and retirement technology','Workforce retention and retraining for older workers'],
      fastPath:['1. Confirm AGING_CRISIS active in console diagnosis chain','2. Drill into portal \u2192 review RAPHE and CARD node treatments','3. Match strongest-evidence treatments to eldercare investments or scope an aging-demand research brief']
    },
    {
      id:'urbanization_overload', title:'Urbanization Overload',
      type:'invest', domains:['population','infrastructure'],
      pattern:'population_urban',
      explain:'Megacities growing beyond infrastructure capacity. Housing crisis, transit collapse, and service gaps accelerating. Portal diagnosis URBANIZATION_OVERLOAD maps through dlPFC (urban planning), AI (density stress), RSC (rural depopulation), VEST (commuting), TPJ (social cohesion), OFC (housing inequality).',
      action:'Drill into the Population portal URBANIZATION_OVERLOAD diagnosis. Review treatment nodes for housing supply, transit, density management, and service delivery. Match treatments to investment, procurement, or build pathways.',
      valueRange:'10\u201330% urban infrastructure returns',
      saturation:'medium',
      trigger:'Population stress > 0.45 with city_overcrowding, housing_shortage, or density_spike conditions active.',
      validation:'Check urban density data. Confirm infrastructure domain cross-pressure. Drill into portal node dlPFC and AI for treatment specifics.',
      steps:['Go to limenhelix.com/domain-console?domain=population \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm URBANIZATION_OVERLOAD is active','Check cross-domain emissions to infrastructure (population_capacity_strain)','Click through to portal \u2192 open URBANIZATION_OVERLOAD diagnosis detail','Review implicated nodes: dlPFC (planning), AI (density), RSC (rural loss)','Read treatments \u2192 identify housing, transit, and service delivery interventions','Match to investable companies or HUD/World Bank urbanization grants'],
      branch_up:'Housing shortage deepens 3+ cycles: structural supply deficit. Long-duration housing and infrastructure positioning.',
      branch_down:'Remote work or decentralization policy reduces urban pressure: shift to suburban/exurban infrastructure.',
      outcome:'Housing developers, urban transit operators, and smart city platforms see sustained demand in high-growth metro areas.',
      failure:'Remote work permanently reduces urban density pressure. Government overbuilds. Demand shifts to rural.',
      window:'30 days\u20135 years',
      realWorld:{invest:'Homebuilders, urban transit, proptech. Examples: D.R. Horton, Lennar, Procore.',research:'Research brief: map urban density thresholds and evaluate which housing-supply interventions most effectively reduce affordability pressure.',build:'Urban density monitoring, housing demand forecasting, or service delivery optimization platforms.'},
      examples:['Homebuilders and affordable housing developers','Urban transit and infrastructure operators','Smart city and proptech platforms','Water and waste infrastructure for growing cities','Community service delivery optimization'],
      fastPath:['1. Confirm URBANIZATION_OVERLOAD active in console diagnosis chain','2. Drill into portal \u2192 review dlPFC and AI node treatments','3. Invest in housing/urban infrastructure companies or scope a density-management research brief']
    },
    {
      id:'pandemic_shock', title:'Pandemic Demographic Shock',
      type:'invest', domains:['population','health'],
      pattern:'population_pandemic',
      explain:'Infectious disease outbreaks causing sudden mortality spikes, fertility disruption, and population displacement. Portal diagnosis PANDEMIC_DEMOGRAPHIC_SHOCK maps through CARD (excess mortality), OXY (birth rate suppression), ECN (vital registration), AI (density transmission), CeA (displacement).',
      action:'Drill into the Population portal PANDEMIC_DEMOGRAPHIC_SHOCK diagnosis. Review treatment nodes for outbreak response, healthcare surge capacity, demographic impact mitigation, and population displacement management.',
      valueRange:'10\u201350% healthcare/diagnostic returns during pandemic events',
      saturation:'high during events',
      trigger:'Population stress > 0.50 with disease_spread, mortality_anomaly, or healthcare_overload conditions active.',
      validation:'Check WHO/CDC epidemiological data. Confirm health domain corroboration. Drill into portal node CARD and AI for treatment evidence.',
      steps:['Go to limenhelix.com/domain-console?domain=population \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm PANDEMIC_DEMOGRAPHIC_SHOCK is active','Check signals for disease_spread, mortality_anomaly, healthcare_overload','Cross-check health domain for corroborating outbreak signals','Click through to portal \u2192 open PANDEMIC_DEMOGRAPHIC_SHOCK detail','Review implicated nodes: CARD (mortality), OXY (fertility), AI (density)','Identify diagnostic, treatment, and public health companies in node mappings'],
      branch_up:'Outbreak expanding: healthcare surge and diagnostic demand urgent. Position immediately.',
      branch_down:'Outbreak contained: acute phase passes. Shift to long-term demographic recovery and preventive health.',
      outcome:'Diagnostic, healthcare surge, and public health infrastructure see rapid demand during pandemic events.',
      failure:'Outbreak contained quickly. Government manages without private sector surge. Excess mortality minimal.',
      window:'7 days\u201318 months',
      realWorld:{invest:'Diagnostic companies, healthcare operators, telemedicine. Examples: Abbott, HCA, Teladoc.',research:'Research brief: model pandemic demographic-shock severity curves and evaluate which preparedness investments reduce mortality and fertility disruption.',build:'Outbreak detection, contact tracing, or demographic impact monitoring platforms.'},
      examples:['Diagnostic and testing companies','Healthcare surge capacity operators','Telemedicine and remote care platforms','Public health surveillance systems','Demographic impact tracking and vital registration'],
      fastPath:['1. Confirm PANDEMIC_DEMOGRAPHIC_SHOCK active with disease_spread signals','2. Drill into portal \u2192 review CARD and AI node treatments','3. Invest in diagnostic/healthcare companies or scope a pandemic-preparedness research brief']
    },
    {
      id:'population_data_gap', title:'Population Data Gap \u2192 Research',
      type:'research', domains:['population'],
      pattern:null,
      explain:'Population monitoring has gaps in real-time coverage. Build data infrastructure to fill demographic blind spots.',
      action:'Build real-time demographic monitoring, health surveillance, or migration tracking platforms to fill data gaps in the LIMEN population pipeline.',
      valueRange:'$500K\u2013$10M data infrastructure opportunity',
      saturation:'low',
      trigger:'Population sources showing DEGRADED or FALLBACK status. Multiple feeds offline.',
      validation:'Check feed health panel for offline population data sources. Verify gap is not temporary (API maintenance).',
      steps:['Go to limenhelix.com/domain-console?domain=population \u2192 check feed health in SIGNAL INTAKE panel','Count OFFLINE sources \u2192 if 2+ sources dark, data gap confirmed','Check if alternative open data sources exist (data.gov, WHO, census APIs)','Identify which demographic dimension is uncovered (health, migration, housing, workforce)','Scope a research brief quantifying the gap and benchmarking existing data-infrastructure approaches','Commission or build a monitoring pipeline to fill the coverage blind spot'],
      branch_up:'Data gap persists across multiple cycles: structural coverage gap. Build permanent infrastructure.',
      branch_down:'Sources recover: temporary API issue. Monitor for recurrence.',
      outcome:'Real-time demographic data platform serving government, healthcare, and planning sectors.',
      failure:'Existing sources recover. Government builds own platform. Market too small for private investment.',
      window:'30 days\u201318 months',
      realWorld:{invest:'N/A',research:'Research brief: map population-data coverage gaps and evaluate the value of an integrated demographic-analytics dataset for government, healthcare, and planning sectors.',build:'Build real-time demographic monitoring integrating census, health, migration, and housing data.'},
      examples:['Real-time demographic dashboards','Health surveillance and outbreak detection','Migration flow monitoring','Housing market and density tracking','Workforce participation analytics'],
      fastPath:['1. Check feed health: are Population sources offline or degraded?','2. Identify which demographic dimension is uncovered','3. Scope a research brief on demographic data-coverage gaps and commission or build a monitoring pipeline']
    }
  ];

  window.LIMENPopulationOpportunityPlaybooks = PLAYBOOKS;

  window.LIMENPopulationOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) {
      if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    }
    return null;
  };
})();
