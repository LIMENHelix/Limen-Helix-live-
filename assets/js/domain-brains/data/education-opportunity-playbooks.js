/**
 * education-opportunity-playbooks.js
 *
 * Canonical Education domain opportunity playbook dataset.
 * Domain-owned. Consumed by:
 *   - /education-opportunities.html (page-level activation + render)
 *   - assets/js/domain-brains/education-brain.js (brain-side enrichment)
 *
 * Content extracted verbatim from the in-file PLAYBOOKS literal that
 * previously lived inside education-opportunities.html.
 *
 * Exposes: window.LIMENEducationOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    id:'funding_crisis', title:'Funding Crisis Response',
    type:'fund', domains:['education','governance','economy'],
    pattern:'education_funding',
    explain:'Education budgets collapsing. Portal diagnosis FUNDING_CRISIS maps through budget shortfall, resource scarcity, infrastructure degradation, and institutional decline.',
    action:'Drill into Education portal FUNDING_CRISIS diagnosis. Review treatment nodes for funding stabilization, resource reallocation, and infrastructure investment.',
    valueRange:'$1M\u201350M education grants / institutional investment',
    saturation:'medium',
    trigger:'Education stress > 0.20 with budget_shortfall or resource_scarcity conditions active.',
    validation:'Confirm World Bank Education / OpenAlex data LIVE. Check governance for education_policy_pressure emissions.',
    steps:['Go to limenhelix.com/domain-console?domain=education \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm FUNDING_CRISIS active','Click through to portal \u2192 open FUNDING_CRISIS detail','Review treatment nodes for funding and infrastructure interventions','Search grants.gov for Department of Education grants'],
    branch_up:'Funding crisis deepening: institutional capacity investment urgent.',
    branch_down:'Budget restored: acute phase passes. Shift to efficiency and modernization.',
    outcome:'Edtech, institutional support, and education infrastructure see demand.',
    failure:'Funding restored quickly. No sustained institutional investment.',
    window:'30 days\u20133 years',
    realWorld:{invest:'Edtech: Coursera (COUR), Duolingo (DUOL), Instructure (INST).',apply:'Department of Education grants via grants.gov.',build:'Build education funding analytics or resource optimization platforms.'},
    examples:['Edtech and learning management platforms','Education funding analytics','Resource optimization and allocation tools','School infrastructure modernization','Teacher support and professional development'],
    fastPath:['1. Confirm FUNDING_CRISIS active','2. Drill into portal \u2192 review funding and resource treatments','3. Invest in edtech (COUR, DUOL) or apply for DOE grants']
  },
  {
    id:'teacher_shortage', title:'Teacher Shortage Response',
    type:'invest', domains:['education','economy','population'],
    pattern:'education_workforce',
    explain:'Teacher pipeline collapsing. Portal diagnosis TEACHER_SHORTAGE maps through workforce gap, retention failure, recruitment deficit, and burnout.',
    action:'Drill into Education portal TEACHER_SHORTAGE. Review treatments for recruitment, retention, compensation, and support.',
    valueRange:'10\u201325% workforce platform returns / education grants',
    saturation:'medium',
    trigger:'Education stress > 0.30 with workforce_gap or retention_failure conditions active.',
    validation:'Check economy domain for workforce_preparation_gap emissions.',
    steps:['Go to limenhelix.com/domain-console?domain=education \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm TEACHER_SHORTAGE active','Click through to portal \u2192 open TEACHER_SHORTAGE detail','Review recruitment, retention, and support treatments','Identify workforce and education companies in node mappings'],
    branch_up:'Shortage persisting: alternative certification and support platforms in high demand.',
    branch_down:'Compensation reform attracts teachers: shortage eases.',
    outcome:'Teacher recruitment, alternative certification, and support platforms see sustained demand.',
    failure:'Automation reduces teacher demand. Policy reversal.',
    window:'6 months\u20135 years',
    realWorld:{invest:'Education workforce: Coursera (COUR), Guild Education (private).',apply:'DOE teacher preparation grants.',build:'Build teacher recruitment or professional development platforms.'},
    examples:['Teacher recruitment and matching platforms','Alternative certification programs','Professional development and coaching','Burnout prevention and wellness tools','Substitute and flexible staffing systems'],
    fastPath:['1. Confirm TEACHER_SHORTAGE active','2. Drill into portal \u2192 review recruitment and retention treatments','3. Invest in education workforce platforms or apply for DOE grants']
  },
  {
    id:'achievement_gap', title:'Achievement Gap Response',
    type:'fund', domains:['education','population','governance'],
    pattern:'education_equity',
    explain:'Outcome disparities widening. Portal diagnosis ACHIEVEMENT_GAP maps through outcome disparity, access inequality, performance decline.',
    action:'Drill into Education portal ACHIEVEMENT_GAP. Review treatments for equity, access expansion, and targeted interventions.',
    valueRange:'$500K\u201310M equity and access grants',
    saturation:'low',
    trigger:'Education stress > 0.20 with outcome_disparity or access_inequality conditions active.',
    validation:'Check population domain for human_capital_strain emissions.',
    steps:['Go to limenhelix.com/domain-console?domain=education \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm ACHIEVEMENT_GAP active','Click through to portal \u2192 open ACHIEVEMENT_GAP detail','Review equity, access, and intervention treatments','Search grants.gov for Title I or equity grants'],
    branch_up:'Gap widening: targeted intervention in high demand.',
    branch_down:'Policy interventions close gap: shift to sustainability.',
    outcome:'Equity-focused edtech, tutoring, and access programs see demand.',
    failure:'Political shift deprioritizes equity.',
    window:'1\u20135 years',
    realWorld:{invest:'Adaptive learning platforms.',apply:'Title I, IDEA, or state equity grants via grants.gov.',build:'Build adaptive learning or personalized intervention platforms.'},
    examples:['Adaptive and personalized learning','Diagnostic assessment and progress monitoring','Tutoring and intervention programs','Access and connectivity expansion','Multilingual and culturally responsive tools'],
    fastPath:['1. Confirm ACHIEVEMENT_GAP active','2. Drill into portal \u2192 review equity treatments','3. Apply for Title I or equity grants']
  },
  {
    id:'accreditation_failure', title:'Accreditation Failure Response',
    type:'advise', domains:['education','law','governance'],
    pattern:'education_quality',
    explain:'Quality standards eroding. Portal diagnosis ACCREDITATION_FAILURE maps through quality degradation, standards erosion, oversight failure.',
    action:'Drill into Education portal ACCREDITATION_FAILURE. Review treatments for quality assurance and standards reform.',
    valueRange:'Advisory and institutional reform',
    saturation:'low',
    trigger:'Education stress > 0.35 with quality_degradation or standards_erosion conditions active.',
    validation:'Check law domain cross-pressure.',
    steps:['Go to limenhelix.com/domain-console?domain=education \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm ACCREDITATION_FAILURE active','Click through to portal \u2192 open ACCREDITATION_FAILURE detail','Review quality assurance and standards treatments'],
    branch_up:'Quality crisis deepening: accreditation reform demand increases.',
    branch_down:'Standards restored: acute phase passes.',
    outcome:'Quality assurance and accreditation technology see demand.',
    failure:'Status quo maintained.',
    window:'6 months\u20133 years',
    realWorld:{invest:'Credential verification platforms.',apply:'Accreditation reform grants.',build:'Build credential verification or quality monitoring platforms.'},
    examples:['Credential verification and blockchain transcripts','Quality assurance platforms','Accreditation management systems','Institutional effectiveness analytics','Student outcome tracking'],
    fastPath:['1. Confirm ACCREDITATION_FAILURE active','2. Drill into portal \u2192 review quality treatments','3. Build credential verification tools']
  },
  {
    id:'technology_disruption', title:'Education Technology Disruption',
    type:'invest', domains:['education','technology'],
    pattern:'education_tech',
    explain:'Technology disrupting traditional education. Portal diagnosis TECHNOLOGY_DISRUPTION maps through digital divide, platform transition, pedagogical mismatch.',
    action:'Drill into Education portal TECHNOLOGY_DISRUPTION. Review treatments for digital access, adaptive platforms, and pedagogical innovation.',
    valueRange:'10\u201330% edtech returns',
    saturation:'medium',
    trigger:'Education stress > 0.30 with digital_divide or platform_transition conditions active.',
    validation:'Check technology domain for edtech_demand_pressure emissions.',
    steps:['Go to limenhelix.com/domain-console?domain=education \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm TECHNOLOGY_DISRUPTION active','Click through to portal \u2192 open TECHNOLOGY_DISRUPTION detail','Review digital access and adaptive learning treatments','Identify edtech companies in node mappings'],
    branch_up:'Digital transformation accelerating: edtech demand sustained.',
    branch_down:'Traditional models stabilize: hybrid approach.',
    outcome:'Edtech platforms, adaptive learning, and digital access see growth.',
    failure:'Technology adoption stalls.',
    window:'6 months\u20135 years',
    realWorld:{invest:'Coursera (COUR), Duolingo (DUOL), Instructure (INST).',apply:'NSF education technology grants.',build:'Build adaptive learning or AI tutoring platforms.'},
    examples:['Adaptive learning and AI tutoring','Learning management systems','Digital classroom tools','Assessment and analytics','Accessibility and universal design'],
    fastPath:['1. Confirm TECHNOLOGY_DISRUPTION active','2. Drill into portal \u2192 review adaptive and digital treatments','3. Invest in edtech (COUR, DUOL, INST)']
  },
  {
    id:'education_data_gap', title:'Education Data Gap',
    type:'build', domains:['education'],
    pattern:null,
    explain:'Education monitoring has gaps. Build education analytics infrastructure.',
    action:'Build education outcome tracking or institutional health monitoring.',
    valueRange:'$500K\u201310M education data infrastructure',
    saturation:'low',
    trigger:'Education sources showing DEGRADED or FALLBACK status.',
    validation:'Check feed health for offline education data sources.',
    steps:['Check feed health','Count OFFLINE sources','Identify uncovered dimension','Build a data pipeline','Apply to NSF or DOE'],
    branch_up:'Data gap persists: build permanent infrastructure.',
    branch_down:'Sources recover: monitor.',
    outcome:'Education analytics platform.',
    failure:'Sources recover.',
    window:'30 days\u201318 months',
    realWorld:{invest:'N/A',apply:'NSF or DOE education data grants.',build:'Build education outcome tracking.'},
    examples:['Student outcome tracking','Institutional health monitoring','Workforce readiness assessment','Education equity measurement','Teacher effectiveness analytics'],
    fastPath:['1. Check feed health','2. Identify uncovered dimension','3. Build pipeline and apply to NSF or DOE']
  }
  ];

  window.LIMENEducationOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENEducationOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
