/**
 * communication-opportunity-playbooks.js
 *
 * Canonical Communication domain opportunity playbook dataset.
 * Domain-owned. Single source of truth consumed by:
 *   - /communication-opportunities.html (page-level playbook activation + render)
 *   - assets/js/domain-brains/communication-brain.js (brain-side enrichment of
 *     state.opportunities[] so /opportunities.html can project rich fields)
 *
 * Content extracted verbatim from the in-file PLAYBOOKS literal that previously
 * lived inside communication-opportunities.html (commit aa8f0bfa and earlier).
 * No narrative has been rewritten. No Civilization-authored text added.
 *
 * Exposes: window.LIMENCommunicationOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
    {
      id:'disinformation_crisis', title:'Disinformation Crisis Response',
      type:'invest', domains:['communication','intelligence','governance'],
      pattern:'communication_disinfo',
      explain:'Systematic spread of false information through media and social platforms. Portal diagnosis DISINFORMATION_CRISIS maps through NAcc (amplification loops), TPJ (critical evaluation), dACC (conflict monitoring), BROCA (journalistic quality).',
      action:'Drill into the Communication portal DISINFORMATION_CRISIS diagnosis. Review treatment nodes for verification systems, amplification controls, and counter-narrative infrastructure. Match to content-integrity investments.',
      valueRange:'10\u201330% content-integrity tech returns',
      saturation:'medium',
      trigger:'Communication stress > 0.40 with misinformation_spread or disinformation_campaign conditions active.',
      validation:'Confirm NewsAPI / RSS Media data LIVE. Check intelligence domain for information_contamination signals. Drill into portal node NAcc and TPJ for treatment evidence.',
      steps:['Go to limenhelix.com/domain-console?domain=communication \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm DISINFORMATION_CRISIS is active','Check cross-domain emissions to intelligence and governance','Click through to portal \u2192 open DISINFORMATION_CRISIS detail','Review implicated nodes: NAcc (amplification), TPJ (evaluation), dACC (monitoring)','Read treatments \u2192 identify verification and content-integrity interventions','Identify misinformation detection companies in node/entity mappings'],
      branch_up:'Disinformation campaign intensifying: content integrity and verification demand accelerates.',
      branch_down:'Campaign identified and countered: acute phase passes. Shift to resilience building.',
      outcome:'Content verification, fact-checking, and platform integrity companies see demand growth.',
      failure:'Disinformation campaign limited in reach. Existing platforms self-correct. Public resilience holds.',
      window:'7 days\u20132 years',
      realWorld:{invest:'Content integrity: Cloudflare (NET), CrowdStrike (CRWD). Platform moderation tools.',research:'Academic literature on disinformation detection, media literacy, and platform integrity. GDELT, First Draft, and MIT Media Lab research corpora.',build:'Build disinformation detection, content verification, or media literacy platforms.'},
      examples:['Fact-checking and verification platforms','Content provenance and authentication','Bot detection and coordinated inauthentic behavior analysis','Media literacy programs and tools','Counter-narrative infrastructure'],
      fastPath:['1. Confirm DISINFORMATION_CRISIS active in console','2. Drill into portal \u2192 review NAcc and TPJ node treatments','3. Invest in content-integrity tech (NET, CRWD) or review media literacy and verification literature']
    },
    {
      id:'telecom_failure', title:'Telecommunications Failure Response',
      type:'invest', domains:['communication','infrastructure','technology'],
      pattern:'communication_telecom',
      explain:'Collapse or severe degradation of telecommunications infrastructure. Portal diagnosis TELECOM_FAILURE maps through CC (connectivity), THAL (network routing), A1 (signal reception), STS (data throughput).',
      action:'Drill into the Communication portal TELECOM_FAILURE diagnosis. Review treatment nodes for network redundancy, infrastructure hardening, and emergency communication. Match to telecom resilience investments.',
      valueRange:'10\u201325% telecom infrastructure returns',
      saturation:'medium',
      trigger:'Communication stress > 0.50 with infrastructure_failure or network_disruption conditions active.',
      validation:'Check infrastructure domain cross-pressure. Confirm network outage data. Drill into portal node CC and THAL for treatment evidence.',
      steps:['Go to limenhelix.com/domain-console?domain=communication \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm TELECOM_FAILURE is active','Check cross-domain emissions to infrastructure and technology','Click through to portal \u2192 open TELECOM_FAILURE detail','Review implicated nodes: CC (connectivity), THAL (routing), A1 (signal)','Identify telecom infrastructure and resilience companies','Position in network redundancy and emergency communication systems'],
      branch_up:'Infrastructure degradation persistent: telecom resilience spending accelerates.',
      branch_down:'Network restored, outage contained: acute phase. Shift to redundancy investment.',
      outcome:'Telecom resilience, network infrastructure, and emergency communication companies see demand.',
      failure:'Outage was localized and temporary. No sustained infrastructure investment follows.',
      window:'7 days\u201318 months',
      realWorld:{invest:'Telecom infrastructure: American Tower (AMT), Crown Castle (CCI), Lumen Technologies (LUMN).',research:'FCC telecom reliability reports, NTIA broadband infrastructure studies, IEEE network resilience research.',build:'Build network monitoring, outage detection, or emergency communication platforms.'},
      examples:['Cell tower and network infrastructure operators','Satellite communication providers','Emergency and mesh networking systems','Network monitoring and outage detection','Broadband resilience and redundancy'],
      fastPath:['1. Confirm TELECOM_FAILURE active with network_disruption signals','2. Drill into portal \u2192 review CC and THAL node treatments','3. Invest in telecom infrastructure (AMT, CCI) or research FCC/NTIA broadband resilience programs']
    },
    {
      id:'censorship_overreach', title:'Censorship Overreach Response',
      type:'advise', domains:['communication','law','governance'],
      pattern:'communication_censorship',
      explain:'Government or platform censorship exceeding legitimate bounds. Portal diagnosis CENSORSHIP_OVERREACH maps through speech restriction, content suppression, and regulatory overreach nodes.',
      action:'Drill into the Communication portal CENSORSHIP_OVERREACH diagnosis. Review treatment nodes for speech protection, platform accountability, and transparency. Assess advisory and advocacy pathways.',
      valueRange:'Advisory and foundation-funded programs',
      saturation:'low',
      trigger:'Communication stress > 0.50 with speech_restriction or content_suppression conditions active.',
      validation:'Check law domain for speech_regulatory_pressure emissions. Confirm governance cross-pressure. Drill into portal for treatment specifics.',
      steps:['Go to limenhelix.com/domain-console?domain=communication \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CENSORSHIP_OVERREACH is active','Check cross-domain emissions to law and governance','Click through to portal \u2192 open CENSORSHIP_OVERREACH detail','Review treatment nodes for speech protection and transparency','Identify press freedom and digital rights organizations','Assess advocacy, legal defense, or technology pathway'],
      branch_up:'Censorship expanding: press freedom and privacy-tech demand increases.',
      branch_down:'Court strikes down overreach: speech protections restored. Monitor for recurrence.',
      outcome:'Privacy-tech, encrypted communication, and press freedom infrastructure see demand.',
      failure:'Political dynamics restore speech protections without external intervention.',
      window:'30 days\u20132 years',
      realWorld:{invest:'Encrypted communications: Signal Foundation. VPN and privacy: NordVPN parent, Cloudflare (NET).',research:'CPJ and RSF press freedom indices, Freedom House internet freedom reports, academic censorship measurement literature.',build:'Build censorship detection, circumvention, or transparency monitoring tools.'},
      examples:['Encrypted communication platforms','VPN and circumvention tools','Press freedom monitoring and advocacy','Platform transparency and accountability','Digital rights and speech protection'],
      fastPath:['1. Confirm CENSORSHIP_OVERREACH active with speech_restriction signals','2. Drill into portal \u2192 review speech and transparency treatments','3. Support press freedom organizations, invest in privacy infrastructure, or research digital rights literature']
    },
    {
      id:'media_monopoly', title:'Media Monopoly Response',
      type:'invest', domains:['communication','law','governance'],
      pattern:'communication_monopoly',
      explain:'Concentration of media ownership undermining editorial diversity and information ecosystem health. Portal diagnosis MEDIA_MONOPOLY maps through market concentration, editorial capture, and platform dominance.',
      action:'Drill into the Communication portal MEDIA_MONOPOLY diagnosis. Review treatment nodes for competition policy, editorial independence, and platform interoperability. Match to independent media and interoperability investments.',
      valueRange:'10\u201320% independent media / interop returns',
      saturation:'medium',
      trigger:'Communication stress > 0.45 with market_concentration or platform_dominance conditions active.',
      validation:'Check media ownership concentration data. Confirm law domain cross-pressure. Drill into portal for treatment evidence.',
      steps:['Go to limenhelix.com/domain-console?domain=communication \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm MEDIA_MONOPOLY is active','Check cross-domain emissions to law and governance','Click through to portal \u2192 open MEDIA_MONOPOLY detail','Review treatment nodes for competition, interoperability, and editorial independence','Identify independent media platforms and interoperability companies','Assess whether investment, policy advocacy, or build pathway fits'],
      branch_up:'Consolidation deepening: independent media and interop demand accelerates.',
      branch_down:'Antitrust action breaks monopoly: market opens. Shift to emerging platform positioning.',
      outcome:'Independent media platforms and interoperability systems see growth during concentration periods.',
      failure:'Monopoly power entrenched. Regulatory capture prevents intervention. Audience adapts.',
      window:'6 months\u20135 years',
      realWorld:{invest:'Independent media platforms and tools. Content creator economy (Substack, etc.).',research:'FTC media concentration studies, Pew Research media ownership reports, academic media pluralism literature.',build:'Build interoperability, content portability, or editorial independence infrastructure.'},
      examples:['Independent media and journalism platforms','Content creator and newsletter tools','Interoperability and data portability','Media diversity and pluralism advocacy','Local and community journalism support'],
      fastPath:['1. Confirm MEDIA_MONOPOLY active with market_concentration signals','2. Drill into portal \u2192 review competition and interoperability treatments','3. Invest in independent media platforms or research media pluralism and antitrust literature']
    },
    {
      id:'cyber_propaganda', title:'Cyber Propaganda Response',
      type:'invest', domains:['communication','intelligence','defense'],
      pattern:'communication_cyber',
      explain:'Coordinated online influence operations using bots, deepfakes, and platform manipulation. Portal diagnosis CYBER_PROPAGANDA maps through narrative manipulation, bot amplification, and coordinated inauthentic behavior.',
      action:'Drill into the Communication portal CYBER_PROPAGANDA diagnosis. Review treatment nodes for bot detection, deepfake identification, and platform integrity. Match to information-integrity investments.',
      valueRange:'10\u201330% information-integrity tech returns',
      saturation:'medium',
      trigger:'Communication stress > 0.50 with bot_amplification or coordinated_inauthentic conditions active.',
      validation:'Check intelligence domain for information contamination signals. Confirm defense cross-pressure. Drill into portal for treatment evidence.',
      steps:['Go to limenhelix.com/domain-console?domain=communication \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CYBER_PROPAGANDA is active','Check cross-domain emissions to intelligence and defense','Click through to portal \u2192 open CYBER_PROPAGANDA detail','Review treatment nodes for bot detection, deepfake analysis, and platform integrity','Identify information-integrity and cybersecurity companies','Position in detection, attribution, and counter-influence platforms'],
      branch_up:'Propaganda campaign escalating: detection and counter-influence demand urgent.',
      branch_down:'Campaign attributed and contained: acute phase passes. Shift to structural hardening.',
      outcome:'Bot detection, deepfake analysis, and platform integrity companies see demand growth.',
      failure:'Campaign limited in impact. Platforms self-correct. Attribution resolves quickly.',
      window:'7 days\u20132 years',
      realWorld:{invest:'Information integrity: Cloudflare (NET), CrowdStrike (CRWD), Palo Alto (PANW).',research:'Stanford Internet Observatory, EU DisinfoLab, Oxford Internet Institute influence-operations research.',build:'Build bot detection, deepfake identification, or influence-attribution platforms.'},
      examples:['Bot and fake account detection platforms','Deepfake identification and content authentication','Influence operation attribution tools','Platform integrity and trust systems','Social media monitoring and analysis'],
      fastPath:['1. Confirm CYBER_PROPAGANDA active with bot_amplification signals','2. Drill into portal \u2192 review detection and attribution treatments','3. Invest in information-integrity platforms (NET, CRWD, PANW) or research influence-operations attribution literature']
    },
    {
      id:'communication_data_gap', title:'Communication Data Gap \u2192 Research',
      type:'research', domains:['communication'],
      pattern:null,
      explain:'Communication monitoring has gaps in real-time coverage. Research existing media monitoring infrastructure and identify approaches to fill information ecosystem blind spots.',
      action:'Research real-time media monitoring, social signal aggregation, and disinformation tracking literature to understand data gap scope and proven approaches.',
      valueRange:'Research outputs: architecture reference + vendor landscape + data-source map',
      saturation:'low',
      trigger:'Communication sources showing DEGRADED or FALLBACK status. Multiple feeds offline.',
      validation:'Check feed health panel for offline communication data sources. Verify gap is not temporary.',
      steps:['Go to limenhelix.com/domain-console?domain=communication \u2192 check feed health','Count OFFLINE sources \u2192 if 2+ dark, data gap confirmed','Review GDELT, Media Cloud, and academic media measurement literature for existing approaches','Identify which communication dimension is uncovered','Research available APIs: GDELT, media data providers, social monitoring services','Map the data gap and document recommended data pipeline architecture'],
      branch_up:'Data gap persists: structural media coverage gap. Research permanent infrastructure solutions.',
      branch_down:'Sources recover: temporary API issue. Monitor for recurrence.',
      outcome:'Research brief on media monitoring architecture serving newsrooms, researchers, and government agencies.',
      failure:'Existing sources recover. Adequate coverage restored without structural gap.',
      window:'30 days\u201318 months',
      realWorld:{invest:'N/A',research:'GDELT project, Media Cloud (MIT/Harvard), academic media measurement literature, NewsGuard, Meltwater, and Brandwatch coverage landscape for data architecture reference.'},
      examples:['Real-time media monitoring dashboards','Social media signal aggregation','Disinformation tracking and mapping','Platform health and integrity monitoring','News ecosystem diversity analytics'],
      fastPath:['1. Check feed health: are Communication sources offline?','2. Identify which media dimension is uncovered','3. Research GDELT and Media Cloud documentation \u2192 map available data sources']
    }
  ];

  window.LIMENCommunicationOpportunityPlaybooks = PLAYBOOKS;

  // Lookup helper: playbook by id
  window.LIMENCommunicationOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) {
      if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    }
    return null;
  };
})();
