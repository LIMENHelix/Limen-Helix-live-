/**
 * culture-opportunity-playbooks.js
 *
 * Canonical Culture domain opportunity playbook dataset. Domain-owned.
 * Extracted verbatim from culture-opportunities.html.
 *
 * Exposes: window.LIMENCultureOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    id:'cultural_erasure', title:'Cultural Erasure Response',
    type:'invest', domains:['culture','population','governance'],
    pattern:'culture_erasure',
    explain:'Systematic loss of cultural identity, heritage, and social cohesion. Portal diagnosis CULTURAL_ERASURE maps through identity fracture, symbolic disunity, and cultural loss nodes.',
    action:'Drill into the Culture portal CULTURAL_ERASURE diagnosis. Review treatment nodes for identity restoration, heritage preservation, and cohesion rebuilding. Match to investable cultural-platform companies or scope a research brief.',
    valueRange:'Investable cultural-platform & creative-economy companies',
    saturation:'low',
    trigger:'Culture stress > 0.20 with identity_fracture or cultural_loss conditions active.',
    validation:'Confirm Event Registry / RSS Culture data LIVE. Check population domain for identity shifts. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=culture \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CULTURAL_ERASURE is active','Check cross-domain emissions to communication and governance','Click through to portal \u2192 open CULTURAL_ERASURE detail','Review treatment nodes for identity restoration and heritage preservation','Identify cultural-platform and creative-economy companies','Position in those companies or commission a research brief on preservation efficacy'],
    branch_up:'Cultural loss accelerating: preservation and restoration demand urgent.',
    branch_down:'Community revitalization succeeds: acute phase passes. Shift to sustainability.',
    outcome:'Cultural preservation organizations, heritage institutions, and community platforms see sustained funding.',
    failure:'Cultural adaptation proceeds without intervention. Public interest shifts.',
    window:'6 months\u20135 years',
    realWorld:{invest:'Cultural platforms and creative economy companies.',research:'Research brief: measure cultural-identity loss and benchmark preservation-program efficacy across regions.',build:'Build digital heritage archives, cultural mapping, or identity documentation platforms.'},
    examples:['Heritage preservation and digital archive projects','Cultural mapping and documentation platforms','Community identity and storytelling tools','Language preservation technology','Indigenous and minority cultural support'],
    fastPath:['1. Confirm CULTURAL_ERASURE active in console','2. Drill into portal \u2192 review identity and heritage treatments','3. Position in cultural-preservation companies or scope a research brief']
  },
  {
    id:'heritage_destruction', title:'Heritage Destruction Response',
    type:'invest', domains:['culture','defense','governance'],
    pattern:'culture_heritage',
    explain:'Physical destruction of cultural heritage sites, monuments, or archives. Portal diagnosis HERITAGE_DESTRUCTION maps through heritage loss, monument destruction, and archive degradation.',
    action:'Drill into the Culture portal HERITAGE_DESTRUCTION diagnosis. Review treatment nodes for emergency preservation, restoration, and digital documentation. Match to digital-preservation companies or scope a research brief.',
    valueRange:'Digital-preservation & 3D-scanning technology companies',
    saturation:'low',
    trigger:'Culture stress > 0.35 with heritage_loss or monument_destruction conditions active.',
    validation:'Check defense domain for conflict signals. Confirm heritage destruction reports. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=culture \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm HERITAGE_DESTRUCTION is active','Check cross-domain emissions to defense and governance','Click through to portal \u2192 open HERITAGE_DESTRUCTION detail','Review treatment nodes for emergency preservation and digital documentation','Identify digital-preservation and restoration-technology companies','Position in those companies or scope a heritage-risk research brief'],
    branch_up:'Destruction ongoing: emergency preservation and documentation critical.',
    branch_down:'Conflict stabilizes: shift from emergency to long-term restoration.',
    outcome:'Heritage restoration, digital documentation, and emergency preservation see demand.',
    failure:'Heritage already lost beyond recovery. Funding redirected to other priorities.',
    window:'7 days\u20135 years',
    realWorld:{invest:'Digital preservation and 3D scanning technology companies.',research:'Research brief: assess heritage-loss risk and the cost-effectiveness of 3D documentation vs physical restoration.',build:'Build 3D heritage documentation, cultural site monitoring, or restoration planning tools.'},
    examples:['3D scanning and digital heritage documentation','Cultural site monitoring and early warning','Heritage restoration project management','Archive digitization and preservation','Cultural property protection and tracking'],
    fastPath:['1. Confirm HERITAGE_DESTRUCTION active with heritage_loss signals','2. Drill into portal \u2192 review preservation and documentation treatments','3. Position in digital-preservation companies or scope a research brief']
  },
  {
    id:'censorship_response', title:'Censorship Response',
    type:'advise', domains:['culture','law','communication'],
    pattern:'culture_censorship',
    explain:'Suppression of cultural expression, creative output, or public discourse. Portal diagnosis CENSORSHIP maps through expression suppression, narrative monopolization, and interpretive narrowing.',
    action:'Drill into the Culture portal CENSORSHIP diagnosis. Review treatment nodes for expression protection, narrative diversity, and creative freedom. Assess advocacy and legal defense pathways.',
    valueRange:'Independent-publishing & creative-platform companies; research brief',
    saturation:'low',
    trigger:'Culture stress > 0.40 with expression_suppression or narrative_monopolization conditions active.',
    validation:'Check law and communication domains for cross-pressure. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=culture \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CENSORSHIP is active','Check cross-domain emissions to law and communication','Click through to portal \u2192 open CENSORSHIP detail','Review treatment nodes for expression protection and narrative diversity','Identify independent-publishing and creative-platform companies','Position in those companies or scope an expression-resilience research brief'],
    branch_up:'Censorship expanding: creative freedom infrastructure in high demand.',
    branch_down:'Courts or public pressure restores expression: acute phase passes.',
    outcome:'Creative freedom advocacy, alternative publishing, and expression platforms see demand.',
    failure:'Political dynamics restore expression without external intervention.',
    window:'30 days\u20132 years',
    realWorld:{invest:'Independent publishing and creative platforms (Substack, Spotify).',research:'Research brief: track expression-suppression patterns and the reach/resilience of alternative distribution channels.',build:'Build censorship monitoring, alternative distribution, or creative freedom platforms.'},
    examples:['Independent publishing and distribution platforms','Creative freedom advocacy organizations','Alternative media and expression channels','Arts censorship monitoring and documentation','Legal defense for creative expression'],
    fastPath:['1. Confirm CENSORSHIP active with expression_suppression signals','2. Drill into portal \u2192 review expression and narrative treatments','3. Support creative freedom organizations or build alternative platforms']
  },
  {
    id:'identity_crisis', title:'Identity Crisis Response',
    type:'invest', domains:['culture','religion','population'],
    pattern:'culture_identity',
    explain:'Fracture in shared cultural identity, value systems, and social cohesion. Portal diagnosis IDENTITY_CRISIS maps through identity fracture, value conflict, tribal segmentation, and norm instability.',
    action:'Drill into the Culture portal IDENTITY_CRISIS diagnosis. Review treatment nodes for cohesion rebuilding, dialogue facilitation, and identity integration. Match to community-platform companies or scope a research brief.',
    valueRange:'Community-platform & social-bridging technology companies',
    saturation:'low',
    trigger:'Culture stress > 0.30 with identity_fracture or value_conflict conditions active.',
    validation:'Check religion and population domains for cross-pressure. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=culture \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm IDENTITY_CRISIS is active','Check cross-domain emissions to religion and population','Click through to portal \u2192 open IDENTITY_CRISIS detail','Review treatment nodes for cohesion rebuilding and dialogue facilitation','Identify community-platform and social-bridging companies','Position in those companies or scope a social-cohesion research brief'],
    branch_up:'Identity fracture deepening: community cohesion programs in high demand.',
    branch_down:'Social dialogue succeeds: acute polarization eases. Shift to maintenance.',
    outcome:'Community dialogue platforms, social bridging programs, and cohesion infrastructure see demand.',
    failure:'Identity fracture becomes normalized. Funding shifts to other priorities.',
    window:'6 months\u20135 years',
    realWorld:{invest:'Community platforms and social bridging technology.',research:'Research brief: quantify social-cohesion decline and evaluate which dialogue interventions measurably move it.',build:'Build intercultural dialogue, community engagement, or identity integration platforms.'},
    examples:['Intercultural dialogue and bridge-building programs','Community engagement and participation platforms','Social cohesion measurement and tracking','Identity integration and storytelling tools','Civic participation and shared-identity programs'],
    fastPath:['1. Confirm IDENTITY_CRISIS active with identity_fracture or value_conflict','2. Drill into portal \u2192 review cohesion and dialogue treatments','3. Position in community-platform companies or scope a research brief']
  },
  {
    id:'creative_stagnation', title:'Creative Stagnation Response',
    type:'invest', domains:['culture','education','communication'],
    pattern:'culture_creative',
    explain:'Decline in cultural production, creative output, and audience engagement. Portal diagnosis CREATIVE_STAGNATION maps through participation decay, audience collapse, and creative weakness.',
    action:'Drill into the Culture portal CREATIVE_STAGNATION diagnosis. Review treatment nodes for creative ecosystem support, audience rebuilding, and institutional revitalization. Match to creative-economy companies or scope a research brief.',
    valueRange:'10\u201325% creative-economy returns (SPOT, ETSY, creator platforms)',
    saturation:'medium',
    trigger:'Culture stress > 0.30 with participation_decay or creative_weakness conditions active.',
    validation:'Check education domain for norm_transmission_pressure emissions. Drill into portal for treatment evidence.',
    steps:['Go to limenhelix.com/domain-console?domain=culture \u2192 check CLARITY','Expand DIAGNOSES \u2192 confirm CREATIVE_STAGNATION is active','Check cross-domain emissions to education and communication','Click through to portal \u2192 open CREATIVE_STAGNATION detail','Review treatment nodes for creative support and audience engagement','Identify creative-economy companies and creator platforms','Position in those companies or scope an audience-rebuilding research brief'],
    branch_up:'Creative decline deepening: arts infrastructure and creator economy demand accelerates.',
    branch_down:'Creative revival takes hold: stagnation reverses. Shift to scaling support.',
    outcome:'Creative platforms, arts infrastructure, and audience engagement tools see demand.',
    failure:'Creative economy self-corrects. Public taste shifts. Institutional funding adequate.',
    window:'6 months\u20133 years',
    realWorld:{invest:'Creative economy: Spotify (SPOT), Etsy (ETSY), content creator platforms.',research:'Research brief: model creator-economy participation decay and the audience-rebuilding levers that work.',build:'Build creative ecosystem tools, audience analytics, or arts funding platforms.'},
    examples:['Content creator and artist support platforms','Audience analytics and engagement tools','Arts funding and patronage infrastructure','Creative collaboration and production tools','Cultural venue and event management systems'],
    fastPath:['1. Confirm CREATIVE_STAGNATION active with participation_decay signals','2. Drill into portal \u2192 review creative support and audience treatments','3. Invest in creative economy (SPOT, ETSY) or scope a research brief']
  },
  {
    id:'culture_data_gap', title:'Culture Data Gap \u2192 Build',
    type:'build', domains:['culture'],
    pattern:null,
    explain:'Cultural monitoring has gaps in real-time coverage. Build cultural analytics infrastructure.',
    action:'Build real-time cultural analytics, social cohesion monitoring, or creative ecosystem tracking platforms.',
    valueRange:'$500K\u2013$10M cultural data infrastructure',
    saturation:'low',
    trigger:'Culture sources showing DEGRADED or FALLBACK status.',
    validation:'Check feed health for offline culture data sources.',
    steps:['Go to limenhelix.com/domain-console?domain=culture \u2192 check feed health','Count OFFLINE sources','Identify which cultural dimension is uncovered','Build a data pipeline as an investable analytics product'],
    branch_up:'Data gap persists: build permanent infrastructure.',
    branch_down:'Sources recover: monitor for recurrence.',
    outcome:'Cultural analytics platform serving researchers, institutions, and policymakers.',
    failure:'Sources recover. Market too small.',
    window:'30 days\u201318 months',
    realWorld:{invest:'N/A',research:'Research brief: map cultural-data coverage gaps and the value of an integrated cultural-analytics dataset.',build:'Build cultural analytics integrating social cohesion, participation, and creative ecosystem data.'},
    examples:['Cultural participation analytics','Social cohesion measurement','Creative economy tracking','Heritage and identity monitoring','Audience and engagement analytics'],
    fastPath:['1. Check feed health: are Culture sources offline?','2. Identify which cultural dimension is uncovered','3. Build a data pipeline as an investable analytics product']
  }
  ];

  window.LIMENCultureOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENCultureOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
