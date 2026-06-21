/**
 * science-opportunity-playbooks.js
 *
 * Canonical Science (research) domain opportunity playbook dataset.
 * Domain-owned. Single source of truth consumed by:
 *   - /science-opportunities.html (page-level playbook activation + render)
 *   - assets/js/domain-brains/science-brain.js (brain-side enrichment of
 *     state.opportunities[] so /opportunities.html can project rich fields)
 *
 * Authored to match the science-brain diagnosis vocabulary:
 *   REPLICATION_CRISIS, FUNDING_COLLAPSE, DATA_FRAUD, PARADIGM_CONFLICT,
 *   BRAIN_DRAIN, PUBLICATION_BIAS.
 *
 * Exposes: window.LIMENScienceOpportunityPlaybooks (alias: window.LIMENResearchOpportunityPlaybooks)
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
    {
      id:'replication_crisis', title:'Replication Crisis Response',
      type:'invest', domains:['science','research'],
      pattern:'science_replication',
      explain:'Systemic failure of published findings to replicate across psychology, biomedicine, and social science. Portal diagnosis REPLICATION_CRISIS maps through methodology weakness, statistical misuse, and incentive structures that reward novelty over rigor.',
      action:'Position in reproducibility infrastructure and preregistration platforms. Review treatment nodes for statistical-methods tooling, registered-reports workflows, and computational reproducibility systems. Match to investable tooling or scope a research brief on integrity programs.',
      valueRange:'10\u201325% research-integrity tooling returns',
      saturation:'low',
      trigger:'Research stress > 0.45 with replication_failure, methodology_weakness, or research_stagnation conditions active.',
      validation:'Confirm Retraction Watch / integrity feeds LIVE. Check for active replication-failure coverage in Nature/Science press. Cross-reference health and technology domains for translational impact.',
      steps:['Go to limenhelix.com/domain-console?domain=science \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm REPLICATION_CRISIS is active','Check cross-domain emissions to technology (innovation_pipeline_pressure) and health (clinical_evidence_strain)','Click through to portal \u2192 open REPLICATION_CRISIS detail','Review treatment nodes for statistical rigor, preregistration, and computational reproducibility','Identify reproducibility-platform companies and registered-report infrastructure'],
      branch_up:'Replication failures accelerating across fields: reproducibility infrastructure demand urgent.',
      branch_down:'Major funders mandate preregistration successfully: shift to methodology-training investment.',
      outcome:'Preregistration platforms, computational reproducibility tooling, and statistical-methods software see sustained demand from funders and institutions.',
      failure:'Replication crisis framed as field-specific rather than systemic. Institutions absorb rigor reforms internally without new tooling.',
      window:'90 days\u20133 years',
      realWorld:{invest:'Reproducibility infrastructure: OSF (Center for Open Science partners), Code Ocean, Gigantum-style platforms, computational-notebook vendors.',research:'Research brief: assess the state of preregistration adoption, reproducibility-tooling uptake, and which NIH/NSF rigor mandates are driving demand for registered-reports infrastructure.',build:'Build registered-reports submission infrastructure, reproducibility-audit services, or statistical-methods education tooling.'},
      examples:['Preregistration and registered-reports platforms','Computational reproducibility (containerized environments, notebook archives)','Statistical-methods software and training','Reproducibility-audit services for journals and funders','Code and data deposition infrastructure'],
      fastPath:['1. Confirm REPLICATION_CRISIS active in console diagnosis chain','2. Drill into portal \u2192 review statistical-rigor and preregistration treatments','3. Invest in reproducibility tooling or scope a research brief on rigor-and-reproducibility infrastructure demand']
    },
    {
      id:'funding_collapse', title:'Research Funding Collapse Response',
      type:'invest', domains:['science','research','economy'],
      pattern:'science_funding',
      explain:'Federal research funding contracting, indirect-cost caps threatened, universities facing multi-year budget pressure. Portal diagnosis FUNDING_COLLAPSE maps through grant-decline signals, budget constraint, and talent-loss pressure on institutional research capacity.',
      action:'Position in research-administration tooling and alternative-funding intelligence platforms. Review treatment nodes for funder-mapping, philanthropic research programs, and institutional funding-matching infrastructure.',
      valueRange:'$250K\u2013$5M research-administration and funding-intelligence tooling',
      saturation:'medium',
      trigger:'Research stress > 0.45 with funding_cut, grant_decline, or budget_constraint conditions active.',
      validation:'Confirm NSF/NIH award-feed volume declining or flat year-over-year. Check for indirect-cost-cap news in federal appropriations. Cross-reference industry domain for R&D translation pressure.',
      steps:['Go to limenhelix.com/domain-console?domain=science \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm FUNDING_COLLAPSE is active','Check cross-domain emissions to industry (r_and_d_translation_lag) and economy','Click through to portal \u2192 open FUNDING_COLLAPSE detail','Review treatment nodes for alternative-funders mapping and research-administration infrastructure','Identify research-administration platforms and alternative-funding intelligence firms'],
      branch_up:'Federal appropriations cut or indirect-cost cap imposed: non-federal funding demand spikes.',
      branch_down:'Bridge appropriations restore federal funding: shift to methodology investment rather than structural.',
      outcome:'Research-administration platforms, alternative-funder-matching tools, and institutional capacity services see sustained demand from universities and labs.',
      failure:'Federal funding stabilizes quickly. Institutions absorb pressure via internal reallocation rather than new tooling. Alternative-funder capacity insufficient.',
      window:'30 days\u201318 months',
      realWorld:{invest:'Research-administration platforms (Cayuse, Kuali, InfoReady analog), funder-intelligence services, philanthropic-funding analytics.',research:'Research brief: map alternative-funder landscape (Sloan, Simons, CZI, HHMI, Wellcome Leap, Schmidt Futures, Arnold Ventures) and quantify capacity to absorb federal funding decline by field.',build:'Build alternative-funder-matching platform, indirect-cost-modeling tools for institutions, or research-foundation capacity-building services.'},
      examples:['Grant-matching and funder-intelligence platforms','Research-administration and grants-management software','Philanthropic-research advisory services','Indirect-cost modeling and recovery tools','Research-infrastructure-sharing cooperatives'],
      fastPath:['1. Confirm FUNDING_COLLAPSE active with grant_decline or funding_cut signals','2. Map affected institutions and identify alternative-funder intelligence platforms','3. Position in research-administration tooling or scope a research brief on philanthropic capacity for the field']
    },
    {
      id:'data_fraud', title:'Research Data Integrity Response',
      type:'invest', domains:['science','research','law'],
      pattern:'science_integrity',
      explain:'Retraction surge, image-manipulation scandals, and data-fabrication cases eroding public trust in published research. Portal diagnosis DATA_FRAUD maps through retraction signals, misconduct investigations, and forensic-analysis gaps in peer review.',
      action:'Position in integrity-detection tooling, image-forensics platforms, and post-publication peer-review infrastructure. Review treatment nodes for fraud-detection ML, citation-audit services, and research-integrity training programs.',
      valueRange:'10\u201330% research-integrity tech returns',
      saturation:'low',
      trigger:'Research stress > 0.40 with retraction_surge, data_integrity, or misconduct conditions active.',
      validation:'Confirm Retraction Watch feed LIVE with elevated item counts. Check for image-integrity coverage (Bik, Elisabeth; image-forensics software). Cross-reference law domain for regulatory investigation signals.',
      steps:['Go to limenhelix.com/domain-console?domain=science \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm DATA_FRAUD is active','Check cross-domain emissions to law (regulatory investigation) and health (clinical evidence)','Click through to portal \u2192 open DATA_FRAUD detail','Review treatment nodes for forensic-analysis, ML fraud detection, and post-publication peer review','Identify integrity-platform companies (Proofig-style image forensics, PubPeer-style annotation, ImageTwin)'],
      branch_up:'Multiple high-profile retractions in a single quarter: integrity-tooling demand urgent. Journals and funders mandate screening.',
      branch_down:'Single-institution containment handles cases: shift to training investment over tooling.',
      outcome:'Image-forensics software, post-publication peer-review platforms, and integrity-training providers see demand from journals, funders, and institutions.',
      failure:'Individual cases treated as isolated rather than systemic. Journals absorb forensic screening internally without procuring external tools.',
      window:'30 days\u20132 years',
      realWorld:{invest:'Image-forensics platforms (Proofig-style, ImageTwin), post-publication peer-review tooling, citation-audit services, plagiarism-detection expansion.',research:'Research brief: map the retraction landscape by field and institution, quantify forensic-tooling adoption rates, and benchmark ORI/NIH integrity-training program effectiveness.',build:'Build image-forensics ML service for journals, citation-audit platform, or institutional research-integrity monitoring infrastructure.'},
      examples:['Image-forensics and manipulation detection platforms','Post-publication peer-review and annotation (PubPeer-style)','Citation-audit and reference-integrity services','Research-integrity training and compliance platforms','Data-forensics for clinical trial integrity'],
      fastPath:['1. Confirm DATA_FRAUD active with retraction_surge or misconduct signals','2. Drill into portal \u2192 review forensic-analysis and ML fraud-detection treatments','3. Invest in image-forensics platforms or scope a research brief on integrity-tooling adoption across journals and funders']
    },
    {
      id:'paradigm_conflict', title:'Paradigm Conflict Response',
      type:'invest', domains:['science','research','technology'],
      pattern:'science_paradigm',
      explain:'Established theoretical frameworks challenged by breakthrough claims, with consensus breakdown creating early-mover windows. Portal diagnosis PARADIGM_CONFLICT maps through breakthrough-claim signals, theoretical-dispute coverage, and high-risk/high-reward funding alignment.',
      action:'Position in deep-tech aligned with the emerging paradigm. Review treatment nodes for high-risk/high-reward programs, early-stage deep-tech investment, and paradigm-mapping infrastructure.',
      valueRange:'15\u201350% deep-tech returns on paradigm inflection',
      saturation:'low',
      trigger:'Research stress > 0.40 with breakthrough_claim, paradigm_challenge, or consensus_breakdown conditions active.',
      validation:'Confirm Nature/Science press LIVE with breakthrough-claim coverage. Cross-reference technology domain for patent-filing acceleration in the emerging area. Filter single-lab or conference-season spikes.',
      steps:['Go to limenhelix.com/domain-console?domain=science \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm PARADIGM_CONFLICT is active','Check cross-domain emissions to technology (innovation_pipeline_pressure) and defense (strategic_research_gap)','Click through to portal \u2192 open PARADIGM_CONFLICT detail','Review treatment nodes for high-risk/high-reward funding and paradigm-mapping infrastructure','Identify deep-tech startups and patent filings in the emerging area'],
      branch_up:'Breakthrough replicates across independent labs: full paradigm shift. Accelerate deep-tech positioning.',
      branch_down:'Claim retracts or fails replication: return to prior consensus. Shift to methodology investment.',
      outcome:'Deep-tech ventures aligned with the emerging paradigm attract Series A/B within 12 months. Patent-filing acceleration creates licensing opportunities.',
      failure:'Claim fails independent replication. Single-lab phenomenon. Conference-season publication artifact.',
      window:'14 days\u20133 years',
      realWorld:{invest:'Deep-tech funds (Lux Capital analog), early-stage ventures in emerging paradigm (AI foundation models, quantum, synthetic biology, room-temp superconductors depending on the signal).',research:'Research brief: map the emerging paradigm — independent-replication status, patent-filing acceleration, and DARPA/ARPA-H/NSF EAGER program alignment — to identify the highest-conviction entry points.',build:'Build paradigm-mapping platform for funders, early-signal venture intelligence, or cross-domain breakthrough-detection tooling.'},
      examples:['Deep-tech venture funds and early-stage SAFEs','DARPA-style high-risk/high-reward program tooling','Paradigm-mapping and breakthrough-detection platforms','Cross-institutional replication networks','Patent-filing intelligence for emerging paradigms'],
      fastPath:['1. Confirm PARADIGM_CONFLICT active with breakthrough_claim signals','2. Drill into portal \u2192 review high-risk/high-reward and paradigm-mapping treatments','3. Position in deep-tech funds or scope a research brief on DARPA/ARPA-H/NSF EAGER program alignment with the emerging paradigm']
    },
    {
      id:'brain_drain', title:'Scientific Brain Drain Response',
      type:'invest', domains:['science','research','population'],
      pattern:'science_workforce',
      explain:'Researcher exodus from academic institutions, particularly early-career, driven by funding pressure, visa-policy turbulence, and industry-salary gaps. Portal diagnosis BRAIN_DRAIN maps through talent-loss signals, workforce-gap conditions, and institutional-decline pressure.',
      action:'Position in research-workforce retention infrastructure, academic-to-industry bridge platforms, and institutional capacity-building. Review treatment nodes for researcher-credentialing, mobility-support services, and salary-bridge programs.',
      valueRange:'$500K\u2013$10M workforce-development tooling and investment opportunity',
      saturation:'low',
      trigger:'Research stress > 0.45 with talent_loss, researcher_exodus, workforce_gap, or institutional_decline conditions active.',
      validation:'Confirm researcher-mobility data from AAU, NBER, or institutional reports. Check population domain for migration-related signals. Verify workforce pressure is structural, not single-institution.',
      steps:['Go to limenhelix.com/domain-console?domain=science \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm BRAIN_DRAIN is active','Check cross-domain emissions to population (demographic signals) and industry (r_and_d_translation_lag)','Click through to portal \u2192 open BRAIN_DRAIN detail','Review treatment nodes for researcher-credentialing, visa-support, and academic-to-industry bridge programs','Identify workforce-development platforms and institutional-capacity services'],
      branch_up:'Workforce exodus accelerates across multiple fields: urgent workforce-development response. Institutional collapse risk.',
      branch_down:'Visa policy stabilizes and salary pressure eases: shift to long-term training investment.',
      outcome:'Workforce-retention platforms, academic-to-industry bridge services, and researcher-credentialing infrastructure see sustained demand from institutions and funders.',
      failure:'Mobility absorbed by private sector without crisis. Institutions adapt by consolidation. Public attention fades.',
      window:'90 days\u20135 years',
      realWorld:{invest:'Workforce-credentialing platforms, postdoc-support services, academic-to-industry bridge programs, researcher-mobility analytics.',research:'Research brief: quantify researcher exodus by field and career stage, map visa-policy and salary-gap drivers, and benchmark which credentialing and bridge programs measurably reduce attrition.',build:'Build researcher-credentialing and portability infrastructure, academic-to-industry bridge platform, or institutional workforce-analytics services.'},
      examples:['Postdoc and early-career researcher support platforms','Academic-to-industry bridge and credentialing services','Visa-support and international-researcher mobility','Researcher-salary benchmarking and advocacy','Workforce-analytics for institutions and funders'],
      fastPath:['1. Confirm BRAIN_DRAIN active with talent_loss or researcher_exodus signals','2. Drill into portal \u2192 review credentialing and bridge-program treatments','3. Invest in researcher-credentialing platforms or scope a research brief on workforce-attrition drivers and retention program efficacy']
    },
    {
      id:'publication_bias', title:'Publication Bias & Open Science Response',
      type:'build', domains:['science','research'],
      pattern:'science_openaccess',
      explain:'Negative-result suppression, publication skew toward positive findings, and fragmented open-access landscape distorting the scientific record. Portal diagnosis PUBLICATION_BIAS maps through publication-skew signals, reporting-gap conditions, and data-fragmentation pressure.',
      action:'Position in open-science infrastructure, preprint-server capacity, and negative-results publishing platforms. Review treatment nodes for registered-reports workflows, data-sharing mandates, and meta-research tooling.',
      valueRange:'10\u201320% open-science infrastructure returns',
      saturation:'low',
      trigger:'Research stress > 0.40 with publication_skew, negative_result_suppression, or data_fragmentation conditions active.',
      validation:'Confirm preprint-server volume (arXiv/bioRxiv/medRxiv) vs published literature ratios. Check for open-access mandate policy signals. Cross-reference technology domain for tooling adjacency.',
      steps:['Go to limenhelix.com/domain-console?domain=science \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm PUBLICATION_BIAS is active','Check cross-domain emissions to technology and industry','Click through to portal \u2192 open PUBLICATION_BIAS detail','Review treatment nodes for open-access infrastructure, preprint capacity, and negative-results publishing','Identify open-science platforms and meta-research tooling'],
      branch_up:'Major funder (NIH, Wellcome, ERC) mandates open-access or registered reports: infrastructure demand spikes.',
      branch_down:'Legacy journals retain hold through prestige: shift to institutional-repository investment.',
      outcome:'Preprint servers, open-access infrastructure, and meta-research platforms see sustained demand from funders and institutions.',
      failure:'Open-access policy stalls. Legacy prestige retains incumbent journals. Preprint servers absorb cost without commercial viability.',
      window:'180 days\u20135 years',
      realWorld:{invest:'Open-access publishing infrastructure, preprint-server capacity, data-sharing platforms (Figshare, Zenodo analog), meta-research tooling.',research:'Research brief: quantify negative-result suppression rates by field, map open-access mandate policy signals (NIH, Wellcome, ERC), and identify which infrastructure gaps most limit preprint adoption.',build:'Build negative-results publishing platform, registered-reports infrastructure, or institutional-repository integration services.'},
      examples:['Preprint servers and open-access infrastructure','Negative-results and registered-reports publishing','Data-sharing repositories and archives','Meta-research and synthesis platforms','Institutional-repository integration'],
      fastPath:['1. Confirm PUBLICATION_BIAS active with publication_skew signals','2. Drill into portal \u2192 review open-access and registered-reports treatments','3. Build open-science infrastructure or scope a research brief on NIH/Wellcome open-access mandate adoption rates']
    },
    {
      id:'research_data_gap', title:'Research Data Gap \u2192 Build',
      type:'build', domains:['science','research'],
      pattern:null,
      explain:'Research monitoring has gaps in real-time coverage. Build data infrastructure to fill blind spots in grant awards, preprint volume, retractions, or institutional metrics.',
      action:'Build real-time research-intelligence platforms or grant/publication tracking infrastructure to fill data gaps in the LIMEN research pipeline.',
      valueRange:'$500K\u2013$10M research-data infrastructure opportunity',
      saturation:'low',
      trigger:'Research sources showing DEGRADED or FALLBACK status. Multiple feeds offline (NSF, NIH, PubMed, arXiv, Retraction Watch).',
      validation:'Check feed health panel for offline research data sources. Verify gap is not temporary API maintenance.',
      steps:['Go to limenhelix.com/domain-console?domain=science \u2192 check feed health in SIGNAL INTAKE panel','Count OFFLINE sources \u2014 if 2+ dark, data gap confirmed','Check if alternative open sources exist (OpenAlex, Crossref, ORCID, Dimensions)','Identify which research dimension is uncovered (grants, publications, retractions, workforce)','Build a data pipeline to fill the gap','Scope a research brief on coverage gaps and the investment case for real-time research intelligence infrastructure'],
      branch_up:'Data gap persists across multiple cycles: structural coverage gap. Build permanent infrastructure.',
      branch_down:'Sources recover: temporary API issue. Monitor for recurrence.',
      outcome:'Real-time research-intelligence platform serving funders, institutions, and science-policy analysts.',
      failure:'Existing sources recover. Incumbent platforms (Dimensions, Web of Science) expand. Market too small for independent service.',
      window:'30 days\u201318 months',
      realWorld:{invest:'N/A',research:'Research brief: map coverage gaps in real-time research intelligence (grants, publications, preprints, retractions, workforce) and identify the investment case for open-data infrastructure (NSF, Sloan, CZI focus areas).',build:'Build real-time research intelligence integrating grants, publications, preprints, retractions, and workforce data.'},
      examples:['Real-time grant and publication dashboards','Retraction and integrity monitoring','Researcher-mobility and workforce analytics','Preprint and open-science tracking','Science-policy intelligence platforms'],
      fastPath:['1. Check feed health: are Research sources offline or degraded?','2. Identify which research dimension is uncovered','3. Build a data pipeline and scope a research brief on the investment case for real-time research intelligence infrastructure']
    }
  ];

  window.LIMENScienceOpportunityPlaybooks = PLAYBOOKS;
  // Alias — science-brain uses domainId 'research'
  window.LIMENResearchOpportunityPlaybooks = PLAYBOOKS;

  window.LIMENScienceOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) {
      if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    }
    return null;
  };
})();
