/**
 * intelligence-opportunity-playbooks.js
 *
 * Canonical Intelligence domain opportunity playbook dataset. Domain-owned.
 * Extracted verbatim from intelligence-opportunities.html.
 *
 * Exposes: window.LIMENIntelligenceOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    id:'intelligence_failure', title:'Intelligence Failure Response',
    type:'invest', domains:['intelligence','defense','governance'],
    pattern:'intelligence_failure',
    explain:'Failure to detect, assess, or communicate a significant threat before it materializes. Portal diagnosis INTELLIGENCE_FAILURE maps through CLAUST (fusion failure), dACC (threat monitoring), PRECUNEUS (predictive analysis), dlPFC (strategic coordination), ECN (data analytics), EMP (human intelligence).',
    action:'Drill into the Intelligence portal INTELLIGENCE_FAILURE diagnosis. Review treatment nodes for collection expansion, fusion improvement, analytical debiasing, and dissemination reform. Match treatments to observability investments or government contracts.',
    valueRange:'10\u201340% cybersecurity/intelligence-tech returns / $1M\u2013$50M government contracts',
    saturation:'medium',
    trigger:'Intelligence stress > 0.40 with signal_blindness, collection_gap, or weak_anomaly_detection conditions active.',
    validation:'Confirm RSS Intel / Tavily data LIVE. Check defense domain for threat_visibility emissions. Drill into portal node CLAUST and dACC for treatment evidence levels.',
    steps:['Go to limenhelix.com/domain-console?domain=intelligence \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm INTELLIGENCE_FAILURE is active with matched conditions','Click through to portal \u2192 open INTELLIGENCE_FAILURE diagnosis detail','Review implicated nodes: CLAUST (fusion), dACC (monitoring), PRECUNEUS (prediction)','Read treatments at each node \u2192 note evidence levels','Identify observability and intelligence-fusion companies in node/entity mappings','Search sam.gov for intelligence modernization or analytics contracts'],
    branch_up:'Collection gaps persisting 3+ cycles: structural blindness. Long-duration observability positioning.',
    branch_down:'New collection capabilities deployed: gap closes. Shift to analytics and fusion.',
    outcome:'Intelligence-tech, observability, and data fusion companies see sustained demand as agencies modernize.',
    failure:'Threat environment normalizes. Budget cuts reduce intelligence spending. Gap was temporary.',
    window:'30 days\u20133 years',
    realWorld:{invest:'Intelligence analytics: Palantir (PLTR), Booz Allen Hamilton (BAH), Leidos (LDOS), CrowdStrike (CRWD).',apply:'Search sam.gov for IC modernization, analytics, or threat detection contracts.',build:'Build anomaly detection, intelligence fusion, or early warning platforms.'},
    examples:['Intelligence fusion platforms (Palantir, Booz Allen)','Threat detection and anomaly analysis (CrowdStrike, Recorded Future)','Data analytics and pattern recognition','Early warning and predictive systems','Human intelligence network support'],
    fastPath:['1. Confirm INTELLIGENCE_FAILURE active in console diagnosis chain','2. Drill into portal \u2192 review CLAUST and dACC node treatments','3. Invest in intelligence-tech (PLTR, BAH, CRWD) or search sam.gov for IC contracts']
  },
  {
    id:'surveillance_scandal', title:'Mass Surveillance Scandal Response',
    type:'advise', domains:['intelligence','law','communication'],
    pattern:'intelligence_oversight',
    explain:'Intelligence agencies exceeded legal authority with bulk domestic surveillance. Public trust collapses. Portal diagnosis MASS_SURVEILLANCE_SCANDAL maps through DAN (surveillance expansion), A1 (signals collection), rACC (oversight failure), ECN (data analytics), IPS (cryptographic capabilities).',
    action:'Drill into the Intelligence portal MASS_SURVEILLANCE_SCANDAL diagnosis. Review treatment nodes for oversight reform, privacy protection, and accountability mechanisms. Identify privacy-tech investments and oversight reform pathways.',
    valueRange:'Privacy-tech growth / oversight reform grants',
    saturation:'low',
    trigger:'Intelligence stress > 0.50 with oversight_failure, privacy_violation, or bulk_collection_excess conditions active.',
    validation:'Check law domain for institutional_rights_restriction emissions. Confirm communication domain cross-pressure. Drill into portal node DAN and rACC for treatment specifics.',
    steps:['Go to limenhelix.com/domain-console?domain=intelligence \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm MASS_SURVEILLANCE_SCANDAL is active','Check cross-domain emissions to law and communication','Click through to portal \u2192 open MASS_SURVEILLANCE_SCANDAL detail','Review implicated nodes: DAN (surveillance), rACC (oversight), IPS (crypto)','Identify privacy-tech and oversight reform opportunities','Assess whether advisory, investment, or policy reform pathway fits'],
    branch_up:'Scandal deepening: oversight reform and privacy-tech demand accelerates.',
    branch_down:'Reform legislation passes: surveillance constrained. Shift to compliance monitoring.',
    outcome:'Privacy-tech, encryption, and oversight platforms see demand growth during scandal aftermath.',
    failure:'Public attention shifts. Reform blocked by security arguments. Status quo restored.',
    window:'7 days\u20132 years',
    realWorld:{invest:'Privacy and encryption: Cloudflare (NET), Palo Alto (PANW), Zscaler (ZS).',apply:'Foundation grants for privacy advocacy and oversight reform.',build:'Build privacy audit, surveillance transparency, or oversight compliance platforms.'},
    examples:['Privacy and encryption infrastructure','Surveillance oversight and audit tools','Transparency and accountability platforms','Civil liberties advocacy technology','Secure communication systems'],
    fastPath:['1. Confirm MASS_SURVEILLANCE_SCANDAL active in console','2. Drill into portal \u2192 review DAN and rACC node treatments','3. Invest in privacy-tech (NET, PANW) or support oversight reform']
  },
  {
    id:'cyber_espionage', title:'Cyber Espionage Response',
    type:'invest', domains:['intelligence','technology','defense'],
    pattern:'intelligence_cyber',
    explain:'Adversarial penetration of intelligence networks, critical infrastructure, or strategic systems. Portal diagnosis CYBER_ESPIONAGE maps through IPS (cryptographic systems), DAN (surveillance networks), ECN (data analytics), CLAUST (classified networks), EMP (human sources).',
    action:'Drill into the Intelligence portal CYBER_ESPIONAGE diagnosis. Review treatment nodes for network hardening, counterintelligence, and secure communications. Match to cybersecurity investments.',
    valueRange:'10\u201340% cybersecurity returns',
    saturation:'medium',
    trigger:'Intelligence stress > 0.45 with adversarial_penetration, network_intrusion, or compromised_channel conditions active.',
    validation:'Check technology domain for observability_trust_pressure emissions. Confirm defense cross-signals. Drill into portal node IPS and DAN for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=intelligence \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CYBER_ESPIONAGE is active','Check cross-domain emissions to defense and technology','Click through to portal \u2192 open CYBER_ESPIONAGE detail','Review implicated nodes: IPS (crypto), DAN (surveillance), CLAUST (classified nets)','Identify cybersecurity companies in node/entity mappings','Position in threat detection, zero-trust, and secure communications'],
    branch_up:'Espionage campaign ongoing: cybersecurity spending accelerates across government and enterprise.',
    branch_down:'Breach contained, attribution established: acute phase passes. Shift to hardening and resilience.',
    outcome:'Cybersecurity, zero-trust, and threat intelligence companies see rapid demand during espionage events.',
    failure:'Breach proves limited in scope. No sustained spending increase. One-time incident.',
    window:'7 days\u201318 months',
    realWorld:{invest:'CrowdStrike (CRWD), Palo Alto (PANW), SentinelOne (S), Booz Allen (BAH), Leidos (LDOS).',apply:'CISA or DOD cybersecurity contracts via sam.gov.',build:'Build threat detection, zero-trust architecture, or counterespionage platforms.'},
    examples:['Threat intelligence and detection (CrowdStrike, Recorded Future)','Zero-trust architecture (Zscaler, Okta)','Secure communications (Signal protocol implementations)','Counterintelligence platforms','Network forensics and incident response'],
    fastPath:['1. Confirm CYBER_ESPIONAGE active with adversarial_penetration signals','2. Drill into portal \u2192 review IPS and DAN node treatments','3. Invest in cybersecurity (CRWD, PANW, S) or apply for CISA contracts']
  },
  {
    id:'foreign_interference', title:'Foreign Interference Response',
    type:'invest', domains:['intelligence','communication','governance'],
    pattern:'intelligence_interference',
    explain:'Foreign actors manipulating information, elections, or policy through covert influence operations. Portal diagnosis FOREIGN_INTERFERENCE maps through EMP (covert agents), DAN (monitoring), PRECUNEUS (narrative manipulation), dlPFC (policy influence), CLAUST (attribution).',
    action:'Drill into the Intelligence portal FOREIGN_INTERFERENCE diagnosis. Review treatment nodes for disinformation detection, attribution, and counter-influence. Match to information integrity investments.',
    valueRange:'10\u201325% information-integrity tech returns / government contracts',
    saturation:'medium',
    trigger:'Intelligence stress > 0.50 with narrative_manipulation, information_contamination, or adversarial_penetration conditions active.',
    validation:'Check communication domain for information_contamination_risk emissions. Confirm governance cross-pressure. Drill into portal node EMP and PRECUNEUS for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=intelligence \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm FOREIGN_INTERFERENCE is active','Check cross-domain emissions to communication and governance','Click through to portal \u2192 open FOREIGN_INTERFERENCE detail','Review implicated nodes: EMP (covert), DAN (monitoring), PRECUNEUS (narrative)','Identify disinformation detection and attribution companies','Position in information integrity and counter-influence infrastructure'],
    branch_up:'Interference campaign expanding: election season or geopolitical escalation amplifies demand.',
    branch_down:'Attribution established, diplomatic response: acute phase passes. Shift to structural hardening.',
    outcome:'Disinformation detection, content authentication, and attribution platforms see demand growth.',
    failure:'Interference campaign limited in impact. Public resilience higher than expected. Political will fades.',
    window:'30 days\u20132 years',
    realWorld:{invest:'Information integrity: Cloudflare (NET), Palo Alto (PANW), CrowdStrike (CRWD).',apply:'State Department or DHS counter-influence grants. CISA election security programs.',build:'Build disinformation detection, content authentication, or influence-attribution platforms.'},
    examples:['Disinformation detection and content moderation','Election integrity and authentication systems','Attribution and influence-tracking platforms','Social media monitoring and bot detection','Counter-narrative and media literacy tools'],
    fastPath:['1. Confirm FOREIGN_INTERFERENCE active with narrative_manipulation signals','2. Drill into portal \u2192 review EMP and PRECUNEUS node treatments','3. Invest in information-integrity platforms or apply for CISA/State Department programs']
  },
  {
    id:'whistleblower_crisis', title:'Whistleblower Crisis Response',
    type:'advise', domains:['intelligence','law'],
    pattern:'intelligence_whistleblower',
    explain:'Classified information exposed by insiders, revealing institutional failures or abuses. Portal diagnosis WHISTLEBLOWER_CRISIS maps through trust boundary breaches, oversight failures, and institutional exposure.',
    action:'Drill into the Intelligence portal WHISTLEBLOWER_CRISIS diagnosis. Review treatment nodes for leak containment, institutional reform, and oversight strengthening. Assess advisory and policy reform pathways.',
    valueRange:'Advisory and institutional reform programs',
    saturation:'low',
    trigger:'Intelligence stress > 0.55 with leaked_signals, institutional_exposure, or trust_boundary_breach conditions active.',
    validation:'Check law domain cross-pressure. Confirm communication domain signals. Drill into portal for treatment specifics.',
    steps:['Go to limenhelix.com/domain-console?domain=intelligence \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm WHISTLEBLOWER_CRISIS is active','Check cross-domain emissions to law and communication','Click through to portal \u2192 open WHISTLEBLOWER_CRISIS detail','Review treatment nodes for institutional reform and oversight strengthening','Assess whether advisory, policy reform, or security-hardening pathway fits','Identify secure-communication and insider-threat companies'],
    branch_up:'Institutional exposure deepening: reform demand and security hardening accelerate.',
    branch_down:'Leak contained, reform enacted: acute phase passes. Monitor for recurrence.',
    outcome:'Insider threat detection, secure communications, and institutional oversight systems see demand.',
    failure:'Crisis contained without structural reform. Public attention shifts. Status quo restored.',
    window:'7 days\u20132 years',
    realWorld:{invest:'Insider threat detection and secure comms platforms.',apply:'Foundation grants for intelligence oversight and accountability reform.',build:'Build insider threat detection, secure whistleblower channels, or institutional audit platforms.'},
    examples:['Insider threat detection platforms','Secure whistleblower and reporting channels','Institutional audit and accountability tools','Classified information management','Security clearance and trust verification'],
    fastPath:['1. Confirm WHISTLEBLOWER_CRISIS active with leaked_signals','2. Drill into portal \u2192 review trust-boundary and oversight treatments','3. Invest in insider-threat detection or advise on institutional reform']
  },
  {
    id:'intelligence_data_gap', title:'Intelligence Data Gap \u2192 Build',
    type:'build', domains:['intelligence'],
    pattern:null,
    explain:'Intelligence monitoring has gaps in real-time coverage. Build observability infrastructure to fill strategic blind spots.',
    action:'Build real-time threat monitoring, OSINT aggregation, or intelligence fusion platforms to fill data gaps in the LIMEN intelligence pipeline.',
    valueRange:'$500K\u2013$10M intelligence data infrastructure opportunity',
    saturation:'low',
    trigger:'Intelligence sources showing DEGRADED or FALLBACK status. Multiple feeds offline.',
    validation:'Check feed health panel for offline intelligence data sources. Verify gap is not temporary.',
    steps:['Go to limenhelix.com/domain-console?domain=intelligence \u2192 check feed health in SIGNAL INTAKE','Count OFFLINE sources \u2192 if 2+ dark, data gap confirmed','Check if alternative OSINT sources exist (threat feeds, government APIs)','Identify which intelligence dimension is uncovered (cyber, geopolitical, signals, human)','Build a data pipeline to fill the gap','Apply to IARPA or NSF for intelligence data infrastructure grants'],
    branch_up:'Data gap persists: structural intelligence coverage gap. Build permanent infrastructure.',
    branch_down:'Sources recover: temporary API issue. Monitor for recurrence.',
    outcome:'Real-time intelligence data platform serving government, defense, and enterprise security sectors.',
    failure:'Existing sources recover. Government builds own platform. Market too classified for private entry.',
    window:'30 days\u201318 months',
    realWorld:{invest:'N/A',apply:'IARPA, NSF, or DARPA grants for intelligence data infrastructure.',build:'Build OSINT aggregation, threat intelligence fusion, or anomaly detection platforms.'},
    examples:['OSINT aggregation and analysis platforms','Threat intelligence feed normalization','Geopolitical risk monitoring','Cyber threat indicator tracking','Strategic early warning dashboards'],
    fastPath:['1. Check feed health: are Intelligence sources offline or degraded?','2. Identify which intelligence dimension is uncovered','3. Build a data pipeline and apply to IARPA or DARPA for funding']
  }
  ];

  window.LIMENIntelligenceOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENIntelligenceOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
