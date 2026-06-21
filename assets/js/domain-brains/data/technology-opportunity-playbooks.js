/**
 * technology-opportunity-playbooks.js
 *
 * Canonical Technology domain opportunity playbook dataset. Domain-owned.
 * Extracted verbatim from technology-opportunities.html.
 *
 * Exposes: window.LIMENTechnologyOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    id:'cyber_attack', title:'Major Cyber Attack Response',
    type:'invest', domains:['technology','defense','finance'],
    pattern:'technology_cyber',
    explain:'Coordinated cyber assault on critical infrastructure. Portal diagnosis CYBER_ATTACK maps through CeA (incident response), CC (network infrastructure), DMN (cloud services), HIPP (database integrity), FORN (blockchain audit).',
    action:'Drill into the Technology portal CYBER_ATTACK diagnosis. Review treatment nodes for threat detection, incident response, network hardening, and recovery. Match to cybersecurity investments.',
    valueRange:'10\u201340% cybersecurity returns',
    saturation:'medium',
    trigger:'Technology stress > 0.20 with cyber_breach or network_intrusion conditions active.',
    validation:'Confirm CISA/NVD data LIVE. Check defense domain for cyber_threat emissions. Drill into portal node CeA and CC for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=technology \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CYBER_ATTACK is active','Check cross-domain emissions to defense and finance','Click through to portal \u2192 open CYBER_ATTACK detail','Review implicated nodes: CeA (response), CC (network), DMN (cloud), HIPP (data)','Read treatments \u2192 identify detection, response, and hardening interventions','Identify cybersecurity companies in node/entity mappings'],
    branch_up:'Attack campaign ongoing: cybersecurity spending accelerates across sectors.',
    branch_down:'Breach contained, patched: acute phase passes. Shift to resilience positioning.',
    outcome:'Cybersecurity, threat detection, and incident response companies see rapid demand.',
    failure:'Attack proves limited. No sustained spending increase. One-time incident.',
    window:'7 days\u201318 months',
    realWorld:{invest:'CrowdStrike (CRWD), Palo Alto (PANW), SentinelOne (S), Fortinet (FTNT), Zscaler (ZS).',research:'Review CISA Known Exploited Vulnerabilities catalog and NIST CSF for detection and response frameworks.'},
    examples:['Endpoint detection and response (CrowdStrike, SentinelOne)','Network security (Palo Alto, Fortinet)','Zero-trust architecture (Zscaler, Okta)','Incident response and forensics','Threat intelligence platforms'],
    fastPath:['1. Confirm CYBER_ATTACK active in console','2. Drill into portal \u2192 review CeA and CC node treatments','3. Invest in cybersecurity (CRWD, PANW, FTNT) or research CISA KEV and NIST CSF frameworks']
  },
  {
    id:'ai_alignment', title:'AI Alignment Failure Response',
    type:'invest', domains:['technology','governance','communication'],
    pattern:'technology_ai',
    explain:'AI systems exhibiting misaligned behavior. Portal diagnosis AI_ALIGNMENT_FAILURE maps through FPN (capability boundaries), autonomous operation, bias amplification, and oversight gaps.',
    action:'Drill into the Technology portal AI_ALIGNMENT_FAILURE diagnosis. Review treatment nodes for AI safety, alignment research, governance frameworks, and oversight systems. Match to AI safety investments.',
    valueRange:'10\u201330% AI safety/governance returns',
    saturation:'medium',
    trigger:'Technology stress > 0.30 with ai_misalignment or autonomy_overreach conditions active.',
    validation:'Check arXiv CS for AI safety publications. Confirm governance domain cross-pressure. Drill into portal node FPN for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=technology \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm AI_ALIGNMENT_FAILURE is active','Check cross-domain emissions to governance and communication','Click through to portal \u2192 open AI_ALIGNMENT_FAILURE detail','Review treatment nodes for safety, alignment, and governance interventions','Identify AI safety companies and research organizations','Position in AI governance and responsible development infrastructure'],
    branch_up:'Alignment failures increasing: AI safety and governance demand accelerates.',
    branch_down:'Industry self-regulation succeeds: acute pressure eases. Monitor for recurrence.',
    outcome:'AI safety, governance, and audit companies see sustained demand as AI capabilities expand.',
    failure:'AI systems prove more alignable than feared. Self-regulation adequate.',
    window:'6 months\u20135 years',
    realWorld:{invest:'AI infrastructure: NVIDIA (NVDA), Microsoft (MSFT), Anthropic (private). AI safety tools.',research:'Review NSF AI safety publications, NIST AI Risk Management Framework (AI RMF), arXiv CS alignment papers.'},
    examples:['AI safety and alignment research organizations','AI audit and bias detection tools','AI governance and compliance platforms','Responsible AI development frameworks','AI interpretability and explainability systems'],
    fastPath:['1. Confirm AI_ALIGNMENT_FAILURE active with ai_misalignment signals','2. Drill into portal \u2192 review FPN and oversight node treatments','3. Invest in AI safety infrastructure or research NIST AI RMF and arXiv alignment literature']
  },
  {
    id:'infrastructure_collapse', title:'Digital Infrastructure Collapse Response',
    type:'invest', domains:['technology','infrastructure','finance'],
    pattern:'technology_infra',
    explain:'Critical digital infrastructure failure. Portal diagnosis INFRASTRUCTURE_COLLAPSE maps through system failures, outage cascades, cloud disruptions, and dependency chains.',
    action:'Drill into the Technology portal INFRASTRUCTURE_COLLAPSE diagnosis. Review treatment nodes for redundancy, resilience, and recovery. Match to cloud and infrastructure investments.',
    valueRange:'10\u201325% infrastructure resilience returns',
    saturation:'medium',
    trigger:'Technology stress > 0.35 with system_failure or outage_cascade conditions active.',
    validation:'Check infrastructure domain for digital_infrastructure_strain emissions. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=technology \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm INFRASTRUCTURE_COLLAPSE is active','Check cross-domain emissions to infrastructure and finance','Click through to portal \u2192 open INFRASTRUCTURE_COLLAPSE detail','Review treatment nodes for redundancy, multi-cloud, and recovery','Identify cloud and infrastructure resilience companies','Position in disaster recovery and multi-provider systems'],
    branch_up:'Infrastructure degradation persistent: resilience spending accelerates.',
    branch_down:'Outage contained: acute event. Shift to redundancy investment.',
    outcome:'Cloud resilience, disaster recovery, and infrastructure monitoring companies see demand.',
    failure:'Outage was localized and temporary. No sustained infrastructure investment.',
    window:'7 days\u201318 months',
    realWorld:{invest:'Cloud infrastructure: AWS/AMZN, Microsoft/MSFT, Google/GOOGL. Monitoring: Datadog (DDOG).',research:'Review CISA critical infrastructure resilience frameworks and NIST SP 800-34 continuity guidance.'},
    examples:['Cloud infrastructure and multi-provider solutions','Infrastructure monitoring (Datadog, Dynatrace)','Disaster recovery and business continuity','Edge computing and distributed systems','Network redundancy and failover'],
    fastPath:['1. Confirm INFRASTRUCTURE_COLLAPSE active with outage signals','2. Drill into portal \u2192 review redundancy and recovery treatments','3. Invest in cloud resilience (DDOG, NET) or research CISA infrastructure frameworks']
  },
  {
    id:'chip_shortage', title:'Chip Shortage Response',
    type:'invest', domains:['technology','industry','economy'],
    pattern:'technology_semiconductor',
    explain:'Semiconductor supply constraints. Portal diagnosis CHIP_SHORTAGE maps through supply constraints, manufacturing bottlenecks, and component scarcity across the technology stack.',
    action:'Drill into the Technology portal CHIP_SHORTAGE diagnosis. Review treatment nodes for supply diversification, onshoring, and alternative architectures. Match to semiconductor investments.',
    valueRange:'10\u201340% semiconductor/onshoring returns',
    saturation:'medium',
    trigger:'Technology stress > 0.35 with semiconductor_gap or supply_constraint conditions active.',
    validation:'Check industry domain for cross-pressure. Confirm semiconductor supply data. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=technology \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CHIP_SHORTAGE is active','Check cross-domain emissions to industry and economy','Click through to portal \u2192 open CHIP_SHORTAGE detail','Review treatment nodes for supply diversification and onshoring','Identify semiconductor and fab companies','Position in foundry, packaging, and equipment companies'],
    branch_up:'Shortage deepening: onshoring and alternative fab demand accelerates.',
    branch_down:'Supply normalizes: seasonal or one-time disruption. Unwind premium positions.',
    outcome:'Semiconductor equipment, foundry, and packaging companies see sustained demand.',
    failure:'Supply recovers quickly. Inventory overshoot. Demand destruction.',
    window:'30 days\u20132 years',
    realWorld:{invest:'NVIDIA (NVDA), TSMC (TSM), ASML, AMD, Intel (INTC), Applied Materials (AMAT).',research:'Review SIA (Semiconductor Industry Association) supply chain reports and NIST semiconductor roadmap publications.'},
    examples:['Semiconductor foundries (TSMC, Samsung, Intel)','Equipment makers (ASML, Applied Materials, Lam Research)','Chip designers (NVIDIA, AMD, Qualcomm)','Packaging and testing (Amkor, ASE)','Supply chain monitoring and analytics'],
    fastPath:['1. Confirm CHIP_SHORTAGE active with semiconductor_gap signals','2. Drill into portal \u2192 review supply and manufacturing treatments','3. Invest in semiconductor companies (NVDA, TSM, ASML) or research SIA supply chain and NIST roadmap data']
  },
  {
    id:'platform_monopoly', title:'Platform Monopoly Response',
    type:'invest', domains:['technology','law','governance'],
    pattern:'technology_monopoly',
    explain:'Market concentration and platform lock-in suppressing innovation. Portal diagnosis PLATFORM_MONOPOLY maps through competitive distortion, innovation suppression, and platform dominance.',
    action:'Drill into the Technology portal PLATFORM_MONOPOLY diagnosis. Review treatment nodes for competition policy, interoperability, and alternative platforms. Match to independent tech investments.',
    valueRange:'10\u201325% alternative platform / interop returns',
    saturation:'medium',
    trigger:'Technology stress > 0.30 with market_concentration or platform_lock_in conditions active.',
    validation:'Check law domain for tech_regulation_pressure emissions. Confirm antitrust activity. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=technology \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm PLATFORM_MONOPOLY is active','Check cross-domain emissions to law and governance','Click through to portal \u2192 open PLATFORM_MONOPOLY detail','Review treatment nodes for competition, interoperability, and open alternatives','Identify independent technology platforms and open-source companies','Position in decentralized, open-source, and interoperable alternatives'],
    branch_up:'Antitrust action progressing: alternative platforms and interop demand rises.',
    branch_down:'Monopoly entrenched: regulation fails. Shift to working within platform ecosystems.',
    outcome:'Independent platforms, open-source companies, and interoperability tools see growth.',
    failure:'Monopoly power proves durable. Regulatory capture blocks reform.',
    window:'1\u20135 years',
    realWorld:{invest:'Open-source: Red Hat/IBM, GitLab (GTLB), MongoDB (MDB). Decentralized: various.',research:'Review FTC and EU competition authority reports on platform market power; research open-standard interoperability literature.'},
    examples:['Open-source platforms and tools','Decentralized and federated systems','Data portability and interoperability','Independent cloud and infrastructure','Open-standard protocol implementations'],
    fastPath:['1. Confirm PLATFORM_MONOPOLY active with market_concentration signals','2. Drill into portal \u2192 review competition and interop treatments','3. Invest in open-source alternatives (GTLB, MDB) or research FTC/EU platform competition literature']
  },
  {
    id:'technology_data_gap', title:'Technology Data Gap \u2192 Research',
    type:'research', domains:['technology'],
    pattern:null,
    explain:'Technology monitoring has gaps in coverage. Research available public data sources and observability frameworks to fill the gap.',
    action:'Identify the uncovered technology dimension. Research open data sources: CISA KEV, NVD, arXiv CS, USPTO patent datasets, SIA supply reports. Map what is available vs missing.',
    valueRange:'Intelligence quality improvement \u2014 feeds LIMEN signal fidelity',
    saturation:'low',
    trigger:'Technology sources showing DEGRADED or FALLBACK status.',
    validation:'Check feed health for offline technology data sources.',
    steps:['Go to limenhelix.com/domain-console?domain=technology \u2192 check feed health','Count OFFLINE sources','Identify which tech dimension is uncovered','Research public data sources covering that dimension','Document findings and recommended integration path'],
    branch_up:'Data gap persists: identify best available public source as interim feed.',
    branch_down:'Sources recover: monitor for recurrence.',
    outcome:'Improved technology signal coverage serving security intelligence, investment positioning, and policy analysis.',
    failure:'Sources recover. Gap was transient.',
    window:'30 days\u201318 months',
    realWorld:{invest:'N/A',research:'CISA KEV, NVD vulnerability feeds, arXiv CS, USPTO bulk patent datasets, SIA semiconductor reports, NIST standards publications \u2014 all public, no application required.'},
    examples:['Patent activity and IP filing trend research','Vulnerability and CVE monitoring (NVD/CISA)','AI capability and safety literature (arXiv)','Semiconductor supply monitoring (SIA reports)','Open-source health and dependency tracking'],
    fastPath:['1. Check feed health: are Technology sources offline?','2. Identify which tech dimension is uncovered','3. Research public sources (CISA, NVD, arXiv, USPTO bulk data) covering that dimension']
  }
  ];

  window.LIMENTechnologyOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENTechnologyOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
