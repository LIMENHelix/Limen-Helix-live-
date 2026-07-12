/**
 * culture-node-business-engine.js — Culture Node-to-Business Assignment Engine
 *
 * CULTURE / RESEARCH DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (matches the locked-domain standard):
 *   - Recursively traverses ALL child portal JSONs (depth 0-5, ~18,200 files)
 *   - Covers full 103 operational nodes (19 CULTURE-TOP + 84 CULTURE-OPERATIONAL)
 *   - Excludes the same 20 RI / framework nodes as the locked domains
 *   - Filters generic template treatments before inference
 *
 * Outputs 3 buckets:
 *   MAPPED     - already mapped and active in Culture system
 *   MISSING    - plausible but missing from current Culture mappings
 *   SPECULATIVE - low-confidence or novel suggestions
 *
 * Approval statuses: PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_culture_business_approvals')
 *
 * Self-gates: only runs when ?domain=culture or ?domain=research
 * Exposes: window.LIMENCultureBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'culture' && _dom !== 'research') return;

  var STORAGE_KEY = 'limen_culture_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_culture_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

  // ══════════════════════════════════════════════════════════════════════
  // RI / FRAMEWORK NODES — same 20 excluded by all locked domains
  // ══════════════════════════════════════════════════════════════════════

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  var GENERIC_TREATMENT_PATTERNS = [
    'Deploy Technology Integration Integrated Technology Platform',
    'Deploy KPI Tracking Integrated Technology Platform',
    'Deploy Innovation Pipeline Integrated Technology Platform',
    'Deploy Trend Analysis Integrated Technology Platform',
    'Deploy Scalability Integrated Technology Platform',
    'Deploy Baseline Assessment Integrated Technology Platform',
    'Deploy Reporting Integrated Technology Platform',
    'Deploy Sustainability Integrated Technology Platform',
    'Deploy Cost Optimization Integrated Technology Platform',
    'Deploy Process Improvement Integrated Technology Platform',
    'Deploy Benchmarking Integrated Technology Platform',
    'Deploy Data Collection Integrated Technology Platform',
    'Deploy Delivery Integrated Technology Platform',
    'Deploy Risk Mitigation Integrated Technology Platform',
    'Deploy Resource Planning Integrated Technology Platform',
    'Deploy Execution Integrated Technology Platform',
    'Deploy Stakeholder Coordination Integrated Technology Platform',
    'Deploy Timeline Management Integrated Technology Platform'
  ];
  var _genericSet = {};
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) {
    _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;
  }

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal filtering') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal correlation') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('root cause analysis') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // 19 CULTURE-TOP (full neuroTranslation) + 84 CULTURE-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

    var NODE_BUSINESS_DIRECTORY = {
      // ── CULTURE-TOP NODES (19) ──
      "DMN": {
        fullName: "Default Mode Network", label: "Cultural Imagination & Mythmaking", tier: 'top',
        neuroTranslation: { inNeurology: "Active during internally-directed imagination, narrative construction, and long-range creative planning.", inBusiness: "In culture, mythmaking is the generation of founding narratives, creative IP, cultural worldbuilding, and long-arc storytelling that defines civilizations." },
        function: "Generates cultural narratives, mythologies, creative IP, and long-arc storytelling frameworks",
        dysregulation: "Loss of mythic imagination, derivative storytelling, cultural amnesia, inability to generate new founding narratives",
        expectedTypes: [
          { type: "Cultural IP studio", reason: "Disney, Pixar, Marvel Studios, Lucasfilm for mythic narrative creation and cultural worldbuilding at civilizational scale", confidence: 0.95 },
          { type: "Literary agency", reason: "William Morris Endeavor (WME), Creative Artists Agency (CAA), ICM Partners for narrative talent pipeline and cultural IP origination", confidence: 0.88 },
          { type: "Cultural think tank", reason: "Aspen Institute Cultural Strategy Group, Sundance Institute, PEN America for cultural narrative leadership and mythmaking discourse", confidence: 0.85 },
          { type: "Interactive narrative platform", reason: "Roblox, Unity, Epic Games for next-generation cultural worldbuilding and interactive mythmaking", confidence: 0.82 },
        ]
      },
      "dlPFC": {
        fullName: "Dorsolateral Prefrontal Cortex", label: "Cultural Strategy & Policy", tier: 'top',
        neuroTranslation: { inNeurology: "Executive control center for working memory, planning, and strategic reasoning.", inBusiness: "In culture, strategy and policy determine arts funding priorities, cultural diplomacy agendas, heritage protection laws, and institutional governance of cultural resources." },
        function: "Directs cultural strategy, arts policy, cultural diplomacy, and institutional governance",
        dysregulation: "Policy paralysis, funding misallocation, cultural diplomacy failures, institutional gridlock",
        expectedTypes: [
          { type: "Cultural policy organization", reason: "NEA, NEH, Americans for the Arts, National Assembly of State Arts Agencies for federal and state cultural policy", confidence: 0.92 },
          { type: "Cultural diplomacy body", reason: "U.S. State Department Bureau of Educational and Cultural Affairs, British Council, Goethe-Institut for cultural diplomacy strategy", confidence: 0.88 },
          { type: "Foundation cultural strategy", reason: "Ford Foundation, Mellon Foundation, MacArthur Foundation cultural strategy and grantmaking programs", confidence: 0.9 },
          { type: "Cultural consulting firm", reason: "Lord Cultural Resources, AEA Consulting, TDC (The Design Commission) for cultural strategy advisory", confidence: 0.82 },
        ]
      },
      "dACC": {
        fullName: "Dorsal Anterior Cingulate Cortex", label: "Cultural Quality & Critique", tier: 'top',
        neuroTranslation: { inNeurology: "Monitors conflict, detects errors, and triggers adaptive responses.", inBusiness: "In culture, quality and critique ensure artistic standards, editorial integrity, curatorial rigor, and cultural production excellence." },
        function: "Monitors cultural quality standards, critical review, curatorial rigor, and editorial integrity",
        dysregulation: "Declining critical standards, unchecked derivative output, loss of curatorial rigor, editorial collapse",
        expectedTypes: [
          { type: "Cultural criticism outlet", reason: "The New York Times Arts, The New Yorker, The Art Newspaper, Pitchfork for authoritative cultural critique", confidence: 0.9 },
          { type: "Awards body", reason: "Academy of Motion Picture Arts and Sciences (Oscars), Recording Academy (Grammys), Pulitzer Prize Board for cultural quality benchmarking", confidence: 0.88 },
          { type: "Curatorial institution", reason: "MoMA, Tate Modern, Smithsonian American Art Museum for curatorial standards and cultural quality governance", confidence: 0.92 },
          { type: "Film festival", reason: "Sundance, Cannes, Venice, Toronto (TIFF), Tribeca for independent quality gatekeeping and cultural discovery", confidence: 0.85 },
        ]
      },
      "FPN": {
        fullName: "Frontoparietal Network", label: "Cross-Cultural Integration & Translation", tier: 'top',
        neuroTranslation: { inNeurology: "Flexibly integrates information from multiple brain systems for complex task management.", inBusiness: "In culture, cross-cultural integration translates artistic and narrative traditions across languages, geographies, and demographics." },
        function: "Integrates and translates cultural content across languages, markets, geographies, and demographics",
        dysregulation: "Cultural balkanization, failed localization, offensive mistranslation, loss of cross-cultural dialogue",
        expectedTypes: [
          { type: "Global streaming localizer", reason: "Netflix global localization (dubbing/subtitling in 30+ languages), Disney+ Hotstar, Spotify localization for cross-cultural content delivery", confidence: 0.92 },
          { type: "Translation technology", reason: "Duolingo (language learning), Google Translate, DeepL for cultural content accessibility across language barriers", confidence: 0.88 },
          { type: "Cultural exchange organization", reason: "UNESCO, Fulbright Program, Japan Foundation, Alliance Francaise for institutional cross-cultural bridge-building", confidence: 0.85 },
          { type: "Multicultural media company", reason: "Bilibili (China-West bridge), MercadoLibre (Latin American cultural commerce), Coupang (K-culture global distribution)", confidence: 0.82 },
        ]
      },
      "M1": {
        fullName: "Primary Motor Cortex", label: "Cultural Production", tier: 'top',
        neuroTranslation: { inNeurology: "Executes voluntary movement, translating intention into physical action.", inBusiness: "In culture, production is the execution of creative vision into film, music, art, performance, games, and physical cultural products." },
        function: "Executes cultural production across film, music, art, performance, gaming, and publishing",
        dysregulation: "Production bottlenecks, content drought, creative pipeline collapse, execution failure",
        expectedTypes: [
          { type: "Major content studio", reason: "Disney Studios, Warner Bros., Universal Pictures, Sony Pictures, Paramount for film and TV cultural production at scale", confidence: 0.95 },
          { type: "Music label", reason: "Universal Music Group, Sony Music, Warner Music Group for recorded music production and artist development", confidence: 0.92 },
          { type: "Gaming studio", reason: "Take-Two Interactive, Electronic Arts, Roblox Corporation for interactive cultural production", confidence: 0.88 },
          { type: "Live production company", reason: "Live Nation, AEG Presents, MSG Entertainment for live cultural event production", confidence: 0.9 },
        ]
      },
      "BROCA": {
        fullName: "Broca's Area", label: "Cultural Publishing & Broadcasting", tier: 'top',
        neuroTranslation: { inNeurology: "Controls speech production and language output.", inBusiness: "In culture, publishing and broadcasting are the dissemination channels for cultural content to mass audiences." },
        function: "Disseminates cultural content through publishing, broadcasting, streaming, and digital distribution",
        dysregulation: "Distribution bottlenecks, platform censorship, broadcasting monopoly, access inequality",
        expectedTypes: [
          { type: "Streaming platform", reason: "Netflix, Spotify, YouTube, Roku, Disney+ for mass cultural content distribution", confidence: 0.95 },
          { type: "Publishing house", reason: "Penguin Random House, HarperCollins, Simon & Schuster for literary cultural publishing", confidence: 0.88 },
          { type: "Broadcasting network", reason: "NBC (Comcast), CBS (Paramount), BBC, PBS for cultural broadcasting infrastructure", confidence: 0.85 },
          { type: "Digital publishing platform", reason: "Wix, Squarespace, Substack, Medium for independent cultural publishing", confidence: 0.82 },
        ]
      },
      "AG": {
        fullName: "Angular Gyrus", label: "Cultural Knowledge Networks & Archives", tier: 'top',
        neuroTranslation: { inNeurology: "Integrates multi-modal information, supports semantic processing and reading comprehension.", inBusiness: "In culture, knowledge networks and archives preserve, organize, and make accessible the accumulated cultural heritage of civilizations." },
        function: "Preserves and organizes cultural archives, museum collections, library systems, and heritage databases",
        dysregulation: "Archive degradation, knowledge fragmentation, cultural amnesia, institutional memory loss",
        expectedTypes: [
          { type: "National cultural archive", reason: "Smithsonian Institution (19 museums, 9 research centers), Library of Congress, National Archives for U.S. cultural memory", confidence: 0.95 },
          { type: "Heritage digitization service", reason: "Google Arts & Culture, Internet Archive, HathiTrust for digital cultural preservation at scale", confidence: 0.9 },
          { type: "Museum technology provider", reason: "Axiell, Gallery Systems (TMS), MuseumPlus for collections management and cultural data infrastructure", confidence: 0.82 },
          { type: "Conservation institute", reason: "Getty Conservation Institute, Smithsonian Conservation Biology Institute, Winterthur for heritage conservation science", confidence: 0.88 },
        ]
      },
      "vmPFC": {
        fullName: "Ventromedial Prefrontal Cortex", label: "Cultural Funding & Patronage", tier: 'top',
        neuroTranslation: { inNeurology: "Evaluates reward, risk, and value to guide decision-making.", inBusiness: "In culture, funding and patronage evaluate which cultural projects merit investment, from NEA grants to foundation philanthropy to corporate sponsorship." },
        function: "Allocates cultural funding through grants, philanthropy, corporate sponsorship, and public investment",
        dysregulation: "Funding drought, misallocation to vanity projects, politicized grantmaking, patronage capture",
        expectedTypes: [
          { type: "Federal arts agency", reason: "NEA ($207M annual budget), NEH ($180M annual budget), IMLS for federal cultural funding allocation", confidence: 0.95 },
          { type: "Cultural foundation", reason: "Ford Foundation ($16B endowment, major arts funder), Mellon Foundation ($8B, humanities focus), MacArthur Foundation (genius grants), Kresge Foundation (arts)", confidence: 0.92 },
          { type: "Corporate cultural sponsor", reason: "Bloomberg Philanthropies (arts), Bank of America Art Conservation Project, JPMorgan Chase cultural sponsorship programs", confidence: 0.85 },
          { type: "Crowdfunding cultural platform", reason: "Kickstarter (creative projects), Patreon (artist patronage), GoFundMe (community cultural campaigns)", confidence: 0.8 },
        ]
      },
      "HIPP": {
        fullName: "Hippocampus", label: "Cultural Memory & Tradition", tier: 'top',
        neuroTranslation: { inNeurology: "Forms new memories, consolidates short-term to long-term storage, enables spatial navigation.", inBusiness: "In culture, memory and tradition maintain continuity of practices, rituals, histories, and shared narratives across generations." },
        function: "Maintains cultural continuity through tradition preservation, oral history, ritual practice, and generational knowledge transfer",
        dysregulation: "Tradition collapse, generational disconnection, historical revisionism, cultural amnesia",
        expectedTypes: [
          { type: "Folklife center", reason: "Smithsonian Center for Folklife and Cultural Heritage, American Folklife Center (Library of Congress) for living tradition documentation", confidence: 0.92 },
          { type: "Oral history organization", reason: "StoryCorps, Oral History Association, USC Shoah Foundation for narrative memory preservation", confidence: 0.88 },
          { type: "Heritage tourism operator", reason: "Airbnb Experiences (cultural immersion), National Trust for Historic Preservation, Colonial Williamsburg Foundation", confidence: 0.85 },
          { type: "Cultural education institution", reason: "Juilliard, Curtis Institute, Royal Academy of Arts for master-apprentice tradition transmission", confidence: 0.82 },
        ]
      },
      "ECN": {
        fullName: "Executive Control Network", label: "Cultural Standards & Curation", tier: 'top',
        neuroTranslation: { inNeurology: "Top-down control system that directs attention, inhibits impulses, and maintains task focus.", inBusiness: "In culture, standards and curation determine what is exhibited, published, performed, and canonized." },
        function: "Sets cultural standards through curation, canon formation, exhibition programming, and editorial selection",
        dysregulation: "Canon ossification, curatorial groupthink, exclusionary gatekeeping, standards erosion",
        expectedTypes: [
          { type: "Major museum curator", reason: "Metropolitan Museum of Art, MoMA, Guggenheim, National Gallery for curatorial standard-setting", confidence: 0.92 },
          { type: "Literary editor/publisher", reason: "The New Yorker, Paris Review, Granta, n+1 for literary curation and standards", confidence: 0.88 },
          { type: "Film programmer", reason: "Sundance Film Festival, Cannes Directors' Fortnight, Criterion Collection for film canon curation", confidence: 0.85 },
          { type: "Playlist curator", reason: "Spotify Editorial (playlists reach 100M+ listeners), Apple Music curation, Pitchfork Best New Music for music standards", confidence: 0.82 },
        ]
      },
      "PRECUNEUS": {
        fullName: "Precuneus", label: "Cultural Theory & Aesthetics", tier: 'top',
        neuroTranslation: { inNeurology: "Supports self-reflection, consciousness, episodic memory retrieval, and spatial reasoning.", inBusiness: "In culture, theory and aesthetics provide the intellectual frameworks through which art is understood, evaluated, and contextualized." },
        function: "Develops cultural theory, aesthetic frameworks, art philosophy, and critical discourse",
        dysregulation: "Theory-practice disconnect, aesthetic relativism, critical theory capture, intellectual ossification",
        expectedTypes: [
          { type: "Cultural studies program", reason: "Harvard Department of Visual and Environmental Studies, Yale School of Art, Columbia Arts and Sciences for aesthetic theory", confidence: 0.88 },
          { type: "Art theory publication", reason: "October, Artforum, e-flux, Texte zur Kunst for cutting-edge cultural theory discourse", confidence: 0.85 },
          { type: "Aesthetics research institute", reason: "Getty Research Institute, Warburg Institute, Clark Art Institute for deep aesthetic scholarship", confidence: 0.9 },
          { type: "Cultural philosophy publisher", reason: "MIT Press, Duke University Press, Verso Books for cultural theory publishing", confidence: 0.82 },
        ]
      },
      "HYPO": {
        fullName: "Hypothalamus", label: "Living Culture & Community Practice", tier: 'top',
        neuroTranslation: { inNeurology: "Regulates homeostasis, hunger, thirst, temperature, and basic survival drives.", inBusiness: "In culture, living culture and community practice are the daily rituals, food traditions, gathering customs, and embodied practices that sustain cultural identity at the grassroots level." },
        function: "Sustains living cultural practices: food traditions, community gatherings, folk customs, and embodied cultural knowledge",
        dysregulation: "Community practice collapse, food tradition loss, gathering space elimination, cultural rootlessness",
        expectedTypes: [
          { type: "Community cultural center", reason: "YMCA/YWCA cultural programs, Boys & Girls Clubs, community centers, public libraries as cultural practice spaces", confidence: 0.85 },
          { type: "Cultural food enterprise", reason: "Eataly, local farmers markets, cultural food festivals, Slow Food International for food tradition preservation", confidence: 0.82 },
          { type: "Community arts organization", reason: "Local arts councils (4,500+ in U.S.), community theaters, folk music societies, craft guilds for grassroots cultural practice", confidence: 0.88 },
          { type: "Cultural gathering platform", reason: "Meetup.com cultural groups, Airbnb Experiences community hosts, Eventbrite cultural events for modern gathering infrastructure", confidence: 0.8 },
        ]
      },
      "OFC": {
        fullName: "Orbitofrontal Cortex", label: "Cultural Economics & Valuation", tier: 'top',
        neuroTranslation: { inNeurology: "Encodes expected value, processes reward prediction, and updates value representations.", inBusiness: "In culture, economics and valuation determine the monetary value of cultural assets: art markets, entertainment revenues, cultural IP licensing, and heritage tourism economics." },
        function: "Values cultural assets through art markets, entertainment economics, cultural IP pricing, and heritage tourism revenue",
        dysregulation: "Art market bubbles, cultural IP undervaluation, entertainment revenue collapse, heritage tourism decline",
        expectedTypes: [
          { type: "Auction house", reason: "Sotheby's, Christie's, Phillips for fine art and cultural artifact valuation and transaction", confidence: 0.92 },
          { type: "Entertainment economics firm", reason: "PwC Global Entertainment & Media, Deloitte TMT, EY Media & Entertainment for cultural industry valuation", confidence: 0.88 },
          { type: "Cultural IP licensing firm", reason: "Authentic Brands Group, Iconix Brand Group, Hasbro licensing for cultural IP monetization", confidence: 0.85 },
          { type: "Cultural tourism analytics", reason: "Tourism Economics (Oxford Economics), World Travel & Tourism Council, UN World Tourism Organization cultural tourism data", confidence: 0.82 },
        ]
      },
      "IPS": {
        fullName: "Intraparietal Sulcus", label: "Cultural Analytics & Audience Measurement", tier: 'top',
        neuroTranslation: { inNeurology: "Processes numerical and spatial information, supports attention allocation and magnitude estimation.", inBusiness: "In culture, analytics and audience measurement quantify cultural participation, streaming metrics, box office data, and audience demographics." },
        function: "Measures cultural participation, audience demographics, streaming data, box office metrics, and cultural sentiment",
        dysregulation: "Measurement gaps, algorithmic distortion, audience mischaracterization, data-driven creative homogenization",
        expectedTypes: [
          { type: "Entertainment measurement firm", reason: "Nielsen (TV ratings, streaming), Comscore (box office, digital), Luminate (music data) for cultural audience measurement", confidence: 0.95 },
          { type: "Streaming analytics", reason: "Spotify for Artists analytics, Netflix internal data, YouTube Analytics for creator-facing cultural metrics", confidence: 0.9 },
          { type: "Cultural survey organization", reason: "NEA Survey of Public Participation in the Arts, Pew Research Center cultural surveys, Gallup social data", confidence: 0.88 },
          { type: "Social listening platform", reason: "Brandwatch, Sprout Social, Talkwalker for cultural trend measurement across social platforms", confidence: 0.82 },
        ]
      },
      "NTS": {
        fullName: "Nucleus Tractus Solitarius", label: "Cultural Sensing & Trend Detection", tier: 'top',
        neuroTranslation: { inNeurology: "Primary relay for visceral sensory information, detecting internal physiological signals.", inBusiness: "In culture, sensing and trend detection identify emerging cultural movements, aesthetic shifts, and grassroots creative energy before they reach mainstream awareness." },
        function: "Detects emerging cultural trends, aesthetic shifts, grassroots movements, and creative innovations",
        dysregulation: "Trend blindness, late adoption, cultural surprise, failure to detect grassroots movements",
        expectedTypes: [
          { type: "Trend forecasting agency", reason: "WGSN, Trendalytics, Fashion Snoops, Heuritech for cultural and aesthetic trend prediction", confidence: 0.9 },
          { type: "Cultural trend media", reason: "Hypebeast, Complex, Highsnobiety, Dazed for emerging cultural movement coverage", confidence: 0.88 },
          { type: "Social media trend analytics", reason: "TikTok Creative Center, Instagram Trends, Twitter/X Trending for real-time cultural pulse", confidence: 0.85 },
          { type: "Futurist consultancy", reason: "Sparks & Honey, Faith Popcorn's BrainReserve, Foresight Factory for cultural futures research", confidence: 0.82 },
        ]
      },
      "TPJ": {
        fullName: "Temporoparietal Junction", label: "Intercultural Dialogue & Diplomacy", tier: 'top',
        neuroTranslation: { inNeurology: "Supports theory of mind, empathy, and perspective-taking.", inBusiness: "In culture, intercultural dialogue and diplomacy build understanding across cultural boundaries through exchange programs, diplomatic cultural initiatives, and cross-cultural collaboration." },
        function: "Facilitates intercultural understanding through cultural exchange, diplomacy, translation, and cross-cultural collaboration",
        dysregulation: "Cultural misunderstanding escalation, failed diplomacy, xenophobia amplification, cross-cultural communication breakdown",
        expectedTypes: [
          { type: "Cultural exchange program", reason: "Fulbright Program, International Visitor Leadership Program (IVLP), AFS Intercultural Programs for structured cultural diplomacy", confidence: 0.92 },
          { type: "Intercultural organization", reason: "UNESCO Division of Cultural Expressions and Creative Industries, British Council, Japan Foundation, Confucius Institute for intercultural bridge-building", confidence: 0.88 },
          { type: "Translation and localization service", reason: "Duolingo, Google Translate, RWS (translation services) for cultural content accessibility", confidence: 0.85 },
          { type: "Multicultural media platform", reason: "Netflix global content (190 countries), Spotify global playlists, YouTube global creators for cross-cultural content distribution", confidence: 0.82 },
        ]
      },
      "rACC": {
        fullName: "Rostral Anterior Cingulate Cortex", label: "Cultural Ethics & Sensitivity Review", tier: 'top',
        neuroTranslation: { inNeurology: "Processes emotional conflict, evaluates social norms, and mediates between cognitive and emotional responses.", inBusiness: "In culture, ethics and sensitivity review ensure cultural production respects communities, avoids harmful stereotypes, and navigates contentious cultural terrain responsibly." },
        function: "Evaluates cultural production for ethical standards, sensitivity, community impact, and responsible representation",
        dysregulation: "Insensitivity scandals, cultural appropriation crises, representation failures, ethical blind spots",
        expectedTypes: [
          { type: "Cultural sensitivity consultancy", reason: "Illuminative (Native representation), Color of Change (Black representation), GLAAD (LGBTQ+ representation) for cultural production review", confidence: 0.88 },
          { type: "Ethics board/review body", reason: "Studio cultural consultants, sensitivity readers (publishing), museum ethics committees for pre-release cultural review", confidence: 0.85 },
          { type: "Cultural rights organization", reason: "PEN America, ACLU Arts Censorship Project, Index on Censorship for cultural ethics advocacy and defense", confidence: 0.9 },
          { type: "Diversity analytics firm", reason: "Annenberg Inclusion Initiative, McKinsey Diversity report, Geena Davis Institute for cultural representation measurement", confidence: 0.82 },
        ]
      },
      "WERN": {
        fullName: "Wernicke's Area", label: "Cultural Technology & Digital Platforms", tier: 'top',
        neuroTranslation: { inNeurology: "Processes language comprehension, enabling understanding of spoken and written communication.", inBusiness: "In culture, technology and digital platforms are the infrastructure through which cultural content is created, distributed, consumed, and preserved in the digital age." },
        function: "Builds and maintains digital cultural infrastructure: platforms, tools, AR/VR, AI creative tools, and digital preservation systems",
        dysregulation: "Platform monopoly, algorithmic cultural distortion, digital divide, technology-driven homogenization",
        expectedTypes: [
          { type: "Cultural platform operator", reason: "Meta (Instagram, Facebook cultural communities), Alphabet (YouTube), Snap (AR cultural expression), Pinterest (cultural curation) for digital cultural infrastructure", confidence: 0.95 },
          { type: "Creative tools company", reason: "Adobe (Creative Suite), Unity (3D cultural production), Roblox (user-generated cultural content), Canva (democratized design) for cultural creation technology", confidence: 0.92 },
          { type: "AI creative technology", reason: "OpenAI (DALL-E, ChatGPT creative tools), Anthropic (Claude for cultural writing), Midjourney (AI art), Runway (AI video) for AI-augmented cultural creation", confidence: 0.85 },
          { type: "Digital preservation technology", reason: "Internet Archive (Wayback Machine), Google Arts & Culture, Europeana for digital cultural heritage preservation infrastructure", confidence: 0.88 },
        ]
      },
      "MGN": {
        fullName: "Medial Geniculate Nucleus", label: "Creative Workforce & Artist Pipeline", tier: 'top',
        neuroTranslation: { inNeurology: "Primary auditory relay, processing sound information before it reaches cortex.", inBusiness: "In culture, the creative workforce and artist pipeline develop, train, and sustain the human talent that produces cultural content." },
        function: "Develops and sustains the creative workforce: artist training, MFA programs, residencies, mentorship, and talent pipeline management",
        dysregulation: "Artist pipeline collapse, training program defunding, creative brain drain, talent concentration in few cities",
        expectedTypes: [
          { type: "Arts education institution", reason: "Juilliard, RISD, CalArts, Berklee College of Music, Royal College of Art for elite creative talent development", confidence: 0.92 },
          { type: "Artist residency program", reason: "MacDowell, Yaddo, Ucross, Skowhegan School for mid-career artist development and creative incubation", confidence: 0.88 },
          { type: "Creative workforce development", reason: "CreativeFuture, ArtPlace America (concluded but model), state arts agency workforce programs for creative sector employment", confidence: 0.85 },
          { type: "Talent management agency", reason: "WME, CAA, UTA, Endeavor for professional creative talent pipeline management and career development", confidence: 0.9 },
        ]
      },
      // ── CULTURE-OPERATIONAL NODES (84) ──
      "DMN-OP1": {
        parentId: "DMN", label: "Cultural IP Development Lab", tier: 'operational',
        function: "Develops new cultural intellectual property franchises and narrative universes",
        expectedTypes: [
          { type: "IP development studio", reason: "Disney Imagineering, Marvel Creative Committee, Lucasfilm Story Group for franchise cultural IP creation", confidence: 0.9 },
        ]
      },
      "DMN-OP2": {
        parentId: "DMN", label: "Mythology & Worldbuilding Studio", tier: 'operational',
        function: "Creates mythological frameworks and cultural worldbuilding for media, gaming, and themed experiences",
        expectedTypes: [
          { type: "Worldbuilding consultancy", reason: "Roblox creator ecosystem, Epic Games MetaHuman, Unity digital worlds for immersive cultural worldbuilding", confidence: 0.85 },
        ]
      },
      "DMN-OP3": {
        parentId: "DMN", label: "Cultural Futures & Scenario Lab", tier: 'operational',
        function: "Models long-range cultural scenarios for demographic shifts, technology impacts, and creative evolution",
        expectedTypes: [
          { type: "Cultural futures research", reason: "Institute for the Future, Nesta cultural futures, Long Now Foundation for long-arc cultural scenario planning", confidence: 0.82 },
        ]
      },
      "DMN-OP4": {
        parentId: "DMN", label: "Oral Tradition & Storytelling Collective", tier: 'operational',
        function: "Preserves and innovates oral storytelling traditions across cultures",
        expectedTypes: [
          { type: "Oral storytelling organization", reason: "The Moth, StoryCorps, National Storytelling Festival for living oral tradition", confidence: 0.85 },
        ]
      },
      "dlPFC-OP1": {
        parentId: "dlPFC", label: "Federal Arts Funding Desk", tier: 'operational',
        function: "Manages NEA/NEH grant tracking, application support, and federal cultural funding intelligence",
        expectedTypes: [
          { type: "Federal arts funding", reason: "NEA, NEH, IMLS for federal cultural investment allocation and grant program management", confidence: 0.92 },
        ]
      },
      "dlPFC-OP2": {
        parentId: "dlPFC", label: "State & Local Cultural Policy Unit", tier: 'operational',
        function: "Tracks state arts council budgets, municipal cultural plans, and local heritage ordinances",
        expectedTypes: [
          { type: "State arts agency", reason: "National Assembly of State Arts Agencies (NASAA), state arts councils (50+) for regional cultural policy", confidence: 0.88 },
        ]
      },
      "dlPFC-OP3": {
        parentId: "dlPFC", label: "Cultural Diplomacy Operations", tier: 'operational',
        function: "Coordinates international cultural exchange, soft power programs, and cultural treaty compliance",
        expectedTypes: [
          { type: "Cultural diplomacy program", reason: "Fulbright Program, Kennedy Center International, Meridian International for cultural diplomacy operations", confidence: 0.85 },
        ]
      },
      "dlPFC-OP4": {
        parentId: "dlPFC", label: "Heritage Protection Legal Unit", tier: 'operational',
        function: "Manages cultural property law, NAGPRA compliance, antiquities trafficking prosecution, and heritage protection enforcement",
        expectedTypes: [
          { type: "Cultural property law firm", reason: "Hogan Lovells cultural property practice, Sullivan & Cromwell art law, AAMD archaeological guidelines for heritage legal protection", confidence: 0.82 },
        ]
      },
      "dACC-OP1": {
        parentId: "dACC", label: "Literary & Arts Criticism Desk", tier: 'operational',
        function: "Produces authoritative cultural criticism for literature, visual arts, performance, and music",
        expectedTypes: [
          { type: "Cultural criticism publication", reason: "The New York Review of Books, London Review of Books, Artforum for critical discourse", confidence: 0.88 },
        ]
      },
      "dACC-OP2": {
        parentId: "dACC", label: "Awards & Recognition Unit", tier: 'operational',
        function: "Administers cultural awards programs and merit-based recognition systems",
        expectedTypes: [
          { type: "Awards administration", reason: "Pulitzer Board, Academy of Motion Picture Arts, National Book Foundation for cultural merit recognition", confidence: 0.9 },
        ]
      },
      "dACC-OP3": {
        parentId: "dACC", label: "Peer Review & Juried Selection", tier: 'operational',
        function: "Manages peer-reviewed grant evaluation, juried exhibition selection, and competitive cultural program admissions",
        expectedTypes: [
          { type: "Peer review body", reason: "NEA peer review panels, MacArthur Foundation Fellows selection, Guggenheim Fellowship juries for merit-based cultural evaluation", confidence: 0.85 },
        ]
      },
      "dACC-OP4": {
        parentId: "dACC", label: "Cultural Standards Compliance", tier: 'operational',
        function: "Monitors content rating systems, broadcast standards, and cultural production compliance",
        expectedTypes: [
          { type: "Standards body", reason: "MPAA ratings, ESRB game ratings, FCC broadcast standards for cultural content classification", confidence: 0.82 },
        ]
      },
      "FPN-OP1": {
        parentId: "FPN", label: "Translation & Localization Hub", tier: 'operational',
        function: "Manages cultural content translation, dubbing, subtitling, and cultural adaptation across markets",
        expectedTypes: [
          { type: "Localization service", reason: "Netflix localization (30+ languages), Duolingo content team, RWS TransPerfect for cultural content adaptation", confidence: 0.9 },
        ]
      },
      "FPN-OP2": {
        parentId: "FPN", label: "Cultural Bridge Programming", tier: 'operational',
        function: "Designs cross-cultural collaboration projects, co-productions, and cultural exchange residencies",
        expectedTypes: [
          { type: "Cultural co-production", reason: "European Broadcasting Union co-productions, Netflix international originals, BBC-HBO partnerships for cross-cultural content", confidence: 0.85 },
        ]
      },
      "FPN-OP3": {
        parentId: "FPN", label: "Diaspora Cultural Network", tier: 'operational',
        function: "Connects diaspora communities with heritage cultures through digital platforms and cultural programming",
        expectedTypes: [
          { type: "Diaspora platform", reason: "Coupang (Korean diaspora commerce), Bilibili (Chinese cultural diaspora), MercadoLibre (Latin American diaspora commerce)", confidence: 0.82 },
        ]
      },
      "FPN-OP4": {
        parentId: "FPN", label: "Multicultural Content Strategy", tier: 'operational',
        function: "Develops content strategies for multicultural audiences across demographics and geographies",
        expectedTypes: [
          { type: "Multicultural marketing", reason: "Zeta Global multicultural targeting, The Trade Desk diverse audience segments, Nielsen diverse audience measurement", confidence: 0.85 },
        ]
      },
      "FPN-OP5": {
        parentId: "FPN", label: "Indigenous Language Revitalization", tier: 'operational',
        function: "Supports endangered and indigenous language preservation through technology and education programs",
        expectedTypes: [
          { type: "Language revitalization", reason: "Duolingo endangered languages (Hawaiian, Navajo), Endangered Languages Project (Google), First Peoples' Cultural Council", confidence: 0.88 },
        ]
      },
      "M1-OP1": {
        parentId: "M1", label: "Film & Television Production", tier: 'operational',
        function: "Manages film and TV cultural production across studios, streamers, and independent producers",
        expectedTypes: [
          { type: "Film/TV production", reason: "Disney Studios, Netflix Studios, Warner Bros., A24, Neon for film and TV cultural production", confidence: 0.92 },
        ]
      },
      "M1-OP2": {
        parentId: "M1", label: "Music Production & Recording", tier: 'operational',
        function: "Oversees recorded music production, studio operations, and music technology",
        expectedTypes: [
          { type: "Music production", reason: "Universal Music Group, Sony Music, Warner Music Group, Spotify Studios for music cultural production", confidence: 0.9 },
        ]
      },
      "M1-OP3": {
        parentId: "M1", label: "Visual Arts & Exhibition Production", tier: 'operational',
        function: "Manages exhibition design, art installation, gallery production, and public art commissions",
        expectedTypes: [
          { type: "Exhibition production", reason: "Smithsonian Exhibits, Metropolitan Museum production, Gagosian Gallery for exhibition cultural production", confidence: 0.85 },
        ]
      },
      "M1-OP4": {
        parentId: "M1", label: "Gaming & Interactive Production", tier: 'operational',
        function: "Produces cultural gaming content, interactive experiences, and virtual world cultural programming",
        expectedTypes: [
          { type: "Gaming production", reason: "Take-Two Interactive, Electronic Arts, Roblox Studios, Epic Games for interactive cultural production", confidence: 0.88 },
        ]
      },
      "M1-OP5": {
        parentId: "M1", label: "Live Performance Production", tier: 'operational',
        function: "Produces concerts, theater, dance, festivals, and live cultural events",
        expectedTypes: [
          { type: "Live production", reason: "Live Nation Production, AEG Live, Broadway League producers, Lincoln Center for the Performing Arts", confidence: 0.9 },
        ]
      },
      "BROCA-OP1": {
        parentId: "BROCA", label: "Streaming Distribution Ops", tier: 'operational',
        function: "Manages content delivery across streaming platforms and digital distribution channels",
        expectedTypes: [
          { type: "Streaming distribution", reason: "Netflix, Disney+, Spotify, YouTube Premium, Amazon Prime Video for cultural content streaming distribution", confidence: 0.92 },
        ]
      },
      "BROCA-OP2": {
        parentId: "BROCA", label: "Publishing & Print Distribution", tier: 'operational',
        function: "Manages book publishing, magazine distribution, and print cultural content delivery",
        expectedTypes: [
          { type: "Publishing distribution", reason: "Penguin Random House, Ingram Content Group, Amazon Books for literary cultural distribution", confidence: 0.85 },
        ]
      },
      "BROCA-OP3": {
        parentId: "BROCA", label: "Broadcast & Cable Operations", tier: 'operational',
        function: "Manages television broadcasting, cable network operations, and linear cultural programming",
        expectedTypes: [
          { type: "Broadcast operations", reason: "Comcast/NBCU broadcast, Paramount CBS network, Disney ABC, PBS for cultural broadcasting infrastructure", confidence: 0.85 },
        ]
      },
      "BROCA-OP4": {
        parentId: "BROCA", label: "Podcast & Audio Distribution", tier: 'operational',
        function: "Manages podcast, audiobook, and audio cultural content distribution",
        expectedTypes: [
          { type: "Audio distribution", reason: "Spotify podcasts, Apple Podcasts, Audible (Amazon), iHeartMedia for audio cultural distribution", confidence: 0.82 },
        ]
      },
      "AG-OP1": {
        parentId: "AG", label: "Museum Collections Management", tier: 'operational',
        function: "Manages physical and digital museum collections, accession, and deaccession processes",
        expectedTypes: [
          { type: "Collections management", reason: "Smithsonian collections (155M+ objects), Metropolitan Museum, Getty Museum for institutional cultural collections", confidence: 0.92 },
        ]
      },
      "AG-OP2": {
        parentId: "AG", label: "Digital Archive Operations", tier: 'operational',
        function: "Manages digital preservation, format migration, metadata standards, and digital cultural archive maintenance",
        expectedTypes: [
          { type: "Digital archive", reason: "Internet Archive (800B+ web pages), Google Arts & Culture (2,000+ institutions), HathiTrust (17M+ volumes)", confidence: 0.9 },
        ]
      },
      "AG-OP3": {
        parentId: "AG", label: "Library & Research Services", tier: 'operational',
        function: "Manages cultural research library operations, interlibrary coordination, and reference services",
        expectedTypes: [
          { type: "Cultural library", reason: "Library of Congress (170M+ items), New York Public Library, British Library for cultural research infrastructure", confidence: 0.88 },
        ]
      },
      "AG-OP4": {
        parentId: "AG", label: "Heritage Database & Catalog Systems", tier: 'operational',
        function: "Maintains cultural heritage databases, union catalogs, and provenance research systems",
        expectedTypes: [
          { type: "Heritage database", reason: "Art Loss Register, UNESCO Memory of the World, OCLC WorldCat for cultural heritage data infrastructure", confidence: 0.82 },
        ]
      },
      "vmPFC-OP1": {
        parentId: "vmPFC", label: "Grant Program Management", tier: 'operational',
        function: "Administers cultural grant applications, review, disbursement, and impact reporting",
        expectedTypes: [
          { type: "Grant management", reason: "NEA grant programs, Mellon Foundation grantmaking, Kresge Foundation arts programs for cultural grant administration", confidence: 0.9 },
        ]
      },
      "vmPFC-OP2": {
        parentId: "vmPFC", label: "Corporate Sponsorship Desk", tier: 'operational',
        function: "Manages corporate cultural sponsorship partnerships, naming rights, and brand-culture collaborations",
        expectedTypes: [
          { type: "Cultural sponsorship", reason: "Bloomberg Philanthropies arts, Bank of America museums, Mastercard Priceless cultural experiences for corporate cultural sponsorship", confidence: 0.85 },
        ]
      },
      "vmPFC-OP3": {
        parentId: "vmPFC", label: "Individual Donor & Patron Relations", tier: 'operational',
        function: "Manages high-net-worth cultural patronage, planned giving, and donor stewardship",
        expectedTypes: [
          { type: "Cultural patronage", reason: "Museum trustee boards (Met, MoMA, Smithsonian), opera patrons, symphony donors for cultural patronage relationships", confidence: 0.85 },
        ]
      },
      "vmPFC-OP4": {
        parentId: "vmPFC", label: "Cultural Impact Investment", tier: 'operational',
        function: "Manages social impact investing in cultural enterprises, creative economy funds, and cultural real estate",
        expectedTypes: [
          { type: "Cultural impact fund", reason: "Upstart Co-Lab (creative economy investing), Kresge Foundation social investment, CDFIs with cultural focus for impact cultural capital", confidence: 0.8 },
        ]
      },
      "HIPP-OP1": {
        parentId: "HIPP", label: "Oral History & Testimony Archive", tier: 'operational',
        function: "Records, preserves, and distributes oral histories and cultural testimony",
        expectedTypes: [
          { type: "Oral history", reason: "StoryCorps (600K+ interviews), USC Shoah Foundation (55K+ testimonies), Smithsonian oral history for cultural memory", confidence: 0.9 },
        ]
      },
      "HIPP-OP2": {
        parentId: "HIPP", label: "Ritual & Ceremony Preservation", tier: 'operational',
        function: "Documents and supports living cultural rituals, ceremonies, and seasonal traditions",
        expectedTypes: [
          { type: "Ritual preservation", reason: "Smithsonian Folklife Festival, UNESCO Living Heritage programs, National Trust heritage events for cultural ritual continuity", confidence: 0.85 },
        ]
      },
      "HIPP-OP3": {
        parentId: "HIPP", label: "Generational Knowledge Transfer", tier: 'operational',
        function: "Facilitates master-apprentice programs, elder-youth cultural transmission, and heritage skill training",
        expectedTypes: [
          { type: "Knowledge transfer", reason: "NEA National Heritage Fellowships, folk and traditional arts apprenticeships, cultural master classes for generational cultural transmission", confidence: 0.85 },
        ]
      },
      "HIPP-OP4": {
        parentId: "HIPP", label: "Historic Preservation Operations", tier: 'operational',
        function: "Manages physical historic preservation, adaptive reuse, and heritage building maintenance",
        expectedTypes: [
          { type: "Historic preservation", reason: "National Trust for Historic Preservation, Advisory Council on Historic Preservation, State Historic Preservation Offices for built heritage", confidence: 0.88 },
        ]
      },
      "ECN-OP1": {
        parentId: "ECN", label: "Museum Exhibition Programming", tier: 'operational',
        function: "Plans and schedules museum exhibitions, traveling shows, and gallery rotations",
        expectedTypes: [
          { type: "Exhibition programming", reason: "Smithsonian Traveling Exhibition Service (SITES), AAM exhibition booking, Art Exhibitions Organized for cultural exhibition logistics", confidence: 0.88 },
        ]
      },
      "ECN-OP2": {
        parentId: "ECN", label: "Editorial & Publishing Curation", tier: 'operational',
        function: "Curates literary and journalistic content for publication, anthology, and canon formation",
        expectedTypes: [
          { type: "Editorial curation", reason: "Best American series editors, Granta Best Young writers, National Book Award longlist for literary canon curation", confidence: 0.85 },
        ]
      },
      "ECN-OP3": {
        parentId: "ECN", label: "Film & Media Programming", tier: 'operational',
        function: "Curates film festival programming, streaming platform recommendations, and broadcast scheduling",
        expectedTypes: [
          { type: "Film programming", reason: "Sundance programmers, Criterion Channel curation, Netflix recommendation engine for cultural film curation", confidence: 0.85 },
        ]
      },
      "ECN-OP4": {
        parentId: "ECN", label: "Music Playlist & Radio Curation", tier: 'operational',
        function: "Curates music playlists, radio programming, and algorithmic discovery for cultural music distribution",
        expectedTypes: [
          { type: "Music curation", reason: "Spotify editorial playlists (RapCaviar, Today's Top Hits), Apple Music curation team, NPR Music for cultural music gatekeeping", confidence: 0.88 },
        ]
      },
      "PRECUNEUS-OP1": {
        parentId: "PRECUNEUS", label: "Aesthetic Philosophy Research", tier: 'operational',
        function: "Conducts research in aesthetic theory, art philosophy, and cultural interpretation frameworks",
        expectedTypes: [
          { type: "Aesthetic research", reason: "Getty Research Institute, Institute of Fine Arts (NYU), Courtauld Institute for aesthetic scholarship", confidence: 0.85 },
        ]
      },
      "PRECUNEUS-OP2": {
        parentId: "PRECUNEUS", label: "Cultural Criticism Publication", tier: 'operational',
        function: "Publishes cultural criticism, art theory, and aesthetic discourse across media",
        expectedTypes: [
          { type: "Cultural criticism", reason: "Artforum, e-flux, October, Frieze for contemporary cultural theory publication", confidence: 0.85 },
        ]
      },
      "PRECUNEUS-OP3": {
        parentId: "PRECUNEUS", label: "Design Theory & Practice", tier: 'operational',
        function: "Develops design theory, design thinking methodology, and applied aesthetics for cultural production",
        expectedTypes: [
          { type: "Design theory", reason: "IDEO cultural design practice, Pentagram, Sagmeister & Walsh for applied cultural design theory", confidence: 0.82 },
        ]
      },
      "HYPO-OP1": {
        parentId: "HYPO", label: "Community Arts Programming", tier: 'operational',
        function: "Delivers grassroots arts programming, community workshops, and participatory cultural events",
        expectedTypes: [
          { type: "Community arts", reason: "Local arts councils, community theaters, YMCAs, Boys & Girls Clubs for grassroots cultural programming", confidence: 0.85 },
        ]
      },
      "HYPO-OP2": {
        parentId: "HYPO", label: "Food & Culinary Tradition Unit", tier: 'operational',
        function: "Preserves and promotes food traditions, culinary heritage, and cultural food practices",
        expectedTypes: [
          { type: "Culinary heritage", reason: "Slow Food International, James Beard Foundation, Smithsonian Food History for culinary cultural preservation", confidence: 0.85 },
        ]
      },
      "HYPO-OP3": {
        parentId: "HYPO", label: "Cultural Festival Operations", tier: 'operational',
        function: "Produces cultural festivals, street fairs, heritage celebrations, and community cultural gatherings",
        expectedTypes: [
          { type: "Festival production", reason: "National Endowment for the Arts folk festivals, Smithsonian Folklife Festival, local heritage festival organizations", confidence: 0.82 },
        ]
      },
      "HYPO-OP4": {
        parentId: "HYPO", label: "Public Space & Placemaking", tier: 'operational',
        function: "Designs and activates cultural public spaces, plazas, parks, and community gathering infrastructure",
        expectedTypes: [
          { type: "Cultural placemaking", reason: "Project for Public Spaces, ArtPlace America model, National Recreation and Park Association for cultural space activation", confidence: 0.8 },
        ]
      },
      "HYPO-OP5": {
        parentId: "HYPO", label: "Craft & Maker Economy", tier: 'operational',
        function: "Supports artisan craft, maker spaces, cultural manufacturing, and handmade goods economy",
        expectedTypes: [
          { type: "Maker economy", reason: "Etsy (handmade marketplace), local maker spaces, American Craft Council, Penland School of Craft for cultural craft economy", confidence: 0.85 },
        ]
      },
      "OFC-OP1": {
        parentId: "OFC", label: "Art Market Intelligence", tier: 'operational',
        function: "Tracks art auction results, gallery sales, and secondary market pricing for cultural asset valuation",
        expectedTypes: [
          { type: "Art market data", reason: "Artnet (price database), ArtTactic (analytics), Art Basel/UBS Art Market Report for cultural asset market intelligence", confidence: 0.88 },
        ]
      },
      "OFC-OP2": {
        parentId: "OFC", label: "Entertainment Revenue Analytics", tier: 'operational',
        function: "Analyzes box office, streaming, live event, and gaming revenue for cultural industry economics",
        expectedTypes: [
          { type: "Entertainment economics", reason: "Comscore (box office), Luminate (music revenue), SuperData/Nielsen (gaming) for cultural revenue analytics", confidence: 0.9 },
        ]
      },
      "OFC-OP3": {
        parentId: "OFC", label: "Cultural IP Licensing & Royalties", tier: 'operational',
        function: "Manages cultural intellectual property licensing, royalty collection, and rights administration",
        expectedTypes: [
          { type: "IP licensing", reason: "ASCAP, BMI, SESAC (music rights), Copyright Clearance Center, Harry Fox Agency for cultural IP royalty administration", confidence: 0.88 },
        ]
      },
      "OFC-OP4": {
        parentId: "OFC", label: "Heritage Tourism Economics", tier: 'operational',
        function: "Analyzes cultural tourism revenue, heritage site economics, and cultural destination development",
        expectedTypes: [
          { type: "Cultural tourism", reason: "World Travel & Tourism Council, Tourism Economics (Oxford), National Trust heritage tourism for cultural destination economics", confidence: 0.82 },
        ]
      },
      "IPS-OP1": {
        parentId: "IPS", label: "Audience Measurement Operations", tier: 'operational',
        function: "Operates cultural audience measurement panels, surveys, and digital tracking systems",
        expectedTypes: [
          { type: "Audience measurement", reason: "Nielsen (TV/streaming), Comscore (digital), SRDS (media planning) for cultural audience quantification", confidence: 0.92 },
        ]
      },
      "IPS-OP2": {
        parentId: "IPS", label: "Cultural Sentiment Analysis", tier: 'operational',
        function: "Analyzes public sentiment toward cultural events, trends, and institutions using social and survey data",
        expectedTypes: [
          { type: "Sentiment analytics", reason: "Brandwatch, Talkwalker, Morning Consult cultural polling for cultural sentiment measurement", confidence: 0.85 },
        ]
      },
      "IPS-OP3": {
        parentId: "IPS", label: "Streaming & Digital Metrics", tier: 'operational',
        function: "Tracks streaming plays, downloads, engagement metrics, and digital cultural consumption patterns",
        expectedTypes: [
          { type: "Streaming metrics", reason: "Spotify for Artists, YouTube Analytics, Netflix Top 10, Apple Music charts for digital cultural consumption data", confidence: 0.9 },
        ]
      },
      "IPS-OP4": {
        parentId: "IPS", label: "Cultural Participation Surveys", tier: 'operational',
        function: "Conducts periodic surveys of cultural participation, arts engagement, and cultural consumption patterns",
        expectedTypes: [
          { type: "Cultural survey", reason: "NEA Survey of Public Participation in the Arts, Americans for the Arts public opinion, Pew cultural surveys", confidence: 0.88 },
        ]
      },
      "NTS-OP1": {
        parentId: "NTS", label: "Emerging Artist & Movement Detection", tier: 'operational',
        function: "Identifies emerging artists, cultural movements, and grassroots creative trends before mainstream awareness",
        expectedTypes: [
          { type: "Emerging talent scout", reason: "Spotify RADAR program, YouTube Music Foundry, Sundance Labs, Skowhegan emerging artist programs", confidence: 0.88 },
        ]
      },
      "NTS-OP2": {
        parentId: "NTS", label: "Social Media Cultural Pulse", tier: 'operational',
        function: "Monitors cultural conversation on social platforms for emerging trends, controversies, and cultural shifts",
        expectedTypes: [
          { type: "Social cultural monitoring", reason: "TikTok Creative Center trends, Instagram cultural hashtags, Reddit cultural communities, Twitter/X trending topics", confidence: 0.85 },
        ]
      },
      "NTS-OP3": {
        parentId: "NTS", label: "Fashion & Design Trend Forecasting", tier: 'operational',
        function: "Forecasts aesthetic and design trends in fashion, interior, architecture, and visual culture",
        expectedTypes: [
          { type: "Trend forecasting", reason: "WGSN, Trendalytics, Pantone Color Institute for aesthetic and cultural trend prediction", confidence: 0.88 },
        ]
      },
      "NTS-OP4": {
        parentId: "NTS", label: "Cultural Technology Scouting", tier: 'operational',
        function: "Identifies emerging technologies that will transform cultural production, distribution, and consumption",
        expectedTypes: [
          { type: "Cultural tech scouting", reason: "Sparks & Honey cultural innovation, Knight Foundation tech for culture, MIT Media Lab cultural computing for emerging cultural technology", confidence: 0.82 },
        ]
      },
      "TPJ-OP1": {
        parentId: "TPJ", label: "International Cultural Exchange Ops", tier: 'operational',
        function: "Manages artist exchanges, cultural delegation programs, and international residency placements",
        expectedTypes: [
          { type: "Cultural exchange ops", reason: "Fulbright artist exchanges, CEC ArtsLink, Asian Cultural Council for international cultural exchange operations", confidence: 0.88 },
        ]
      },
      "TPJ-OP2": {
        parentId: "TPJ", label: "Intercultural Conflict Mediation", tier: 'operational',
        function: "Mediates cultural disputes, heritage repatriation negotiations, and intercultural misunderstanding resolution",
        expectedTypes: [
          { type: "Cultural mediation", reason: "UNESCO mediation services, NAGPRA consultation processes, cultural property repatriation negotiations", confidence: 0.85 },
        ]
      },
      "TPJ-OP3": {
        parentId: "TPJ", label: "Cultural Accessibility & Inclusion", tier: 'operational',
        function: "Ensures cultural content and experiences are accessible across ability, language, and socioeconomic barriers",
        expectedTypes: [
          { type: "Cultural accessibility", reason: "NEA accessibility guidelines, ADA cultural compliance, Smithsonian accessibility programs for inclusive cultural access", confidence: 0.85 },
        ]
      },
      "TPJ-OP4": {
        parentId: "TPJ", label: "Immigration & Diaspora Cultural Services", tier: 'operational',
        function: "Supports cultural integration, diaspora community connections, and immigrant cultural preservation",
        expectedTypes: [
          { type: "Diaspora cultural service", reason: "International Rescue Committee cultural programs, local diaspora cultural organizations, heritage language schools", confidence: 0.8 },
        ]
      },
      "rACC-OP1": {
        parentId: "rACC", label: "Content Sensitivity Review", tier: 'operational',
        function: "Reviews cultural content for sensitivity, stereotyping, and community impact before release",
        expectedTypes: [
          { type: "Sensitivity review", reason: "Studio cultural consultants, publishing sensitivity readers, museum community advisory boards for pre-release cultural review", confidence: 0.85 },
        ]
      },
      "rACC-OP2": {
        parentId: "rACC", label: "Cultural Appropriation Assessment", tier: 'operational',
        function: "Evaluates cultural production for appropriation risks and recommends respectful engagement frameworks",
        expectedTypes: [
          { type: "Appropriation assessment", reason: "Illuminative (Native representation), GLAAD media guide, Disability:IN cultural guidelines for appropriation risk assessment", confidence: 0.85 },
        ]
      },
      "rACC-OP3": {
        parentId: "rACC", label: "Representation Analytics", tier: 'operational',
        function: "Measures representation of diverse communities in cultural production across media, museums, and institutions",
        expectedTypes: [
          { type: "Representation measurement", reason: "Annenberg Inclusion Initiative, Geena Davis Institute, Color of Change Hollywood Diversity for cultural representation analytics", confidence: 0.88 },
        ]
      },
      "rACC-OP4": {
        parentId: "rACC", label: "Cultural Ethics Policy Development", tier: 'operational',
        function: "Develops ethical guidelines for cultural institutions, platforms, and content creators",
        expectedTypes: [
          { type: "Ethics policy", reason: "AAM Code of Ethics, ICOM ethical guidelines, SAA archival ethics for institutional cultural ethics frameworks", confidence: 0.82 },
        ]
      },
      "WERN-OP1": {
        parentId: "WERN", label: "Social Platform Cultural Ops", tier: 'operational',
        function: "Manages cultural community features, content policies, and creator tools on social media platforms",
        expectedTypes: [
          { type: "Social platform ops", reason: "Meta cultural communities, YouTube creator tools, TikTok cultural content, Snap AR cultural lenses for platform cultural operations", confidence: 0.9 },
        ]
      },
      "WERN-OP2": {
        parentId: "WERN", label: "AR/VR Cultural Experience Development", tier: 'operational',
        function: "Builds augmented and virtual reality cultural experiences for museums, heritage sites, and performances",
        expectedTypes: [
          { type: "AR/VR cultural tech", reason: "Apple Vision Pro cultural apps, Meta Quest museum experiences, Snap AR cultural lenses, Google Arts & Culture AR for immersive cultural tech", confidence: 0.85 },
        ]
      },
      "WERN-OP3": {
        parentId: "WERN", label: "AI Creative Tools Operations", tier: 'operational',
        function: "Manages AI-powered creative tools for cultural production: text, image, music, and video generation",
        expectedTypes: [
          { type: "AI creative tools", reason: "Adobe Firefly, OpenAI DALL-E, Midjourney, Runway ML, Suno AI for AI-augmented cultural creation tools", confidence: 0.85 },
        ]
      },
      "WERN-OP4": {
        parentId: "WERN", label: "Digital Preservation Infrastructure", tier: 'operational',
        function: "Maintains digital preservation systems, format migration tools, and long-term cultural data storage",
        expectedTypes: [
          { type: "Digital preservation", reason: "Internet Archive infrastructure, Library of Congress digital preservation, Digital Preservation Coalition for cultural data longevity", confidence: 0.88 },
        ]
      },
      "WERN-OP5": {
        parentId: "WERN", label: "Creator Economy Platform Ops", tier: 'operational',
        function: "Manages creator monetization tools, direct-to-fan platforms, and cultural creator business infrastructure",
        expectedTypes: [
          { type: "Creator economy", reason: "Patreon, Substack, Kickstarter, Ko-fi, Gumroad for cultural creator direct-to-audience business infrastructure", confidence: 0.85 },
        ]
      },
      "MGN-OP1": {
        parentId: "MGN", label: "MFA & Conservatory Programs", tier: 'operational',
        function: "Manages graduate-level arts education programs in visual arts, music, theater, film, and creative writing",
        expectedTypes: [
          { type: "Graduate arts education", reason: "Yale School of Art, Juilliard, CalArts, Iowa Writers' Workshop, RISD for elite cultural talent education", confidence: 0.9 },
        ]
      },
      "MGN-OP2": {
        parentId: "MGN", label: "Artist Residency & Fellowship Ops", tier: 'operational',
        function: "Administers artist residency placements, fellowship awards, and creative retreat programs",
        expectedTypes: [
          { type: "Residency administration", reason: "MacDowell, Yaddo, Ucross Foundation, Headlands Center for the Arts for mid-career creative incubation", confidence: 0.88 },
        ]
      },
      "MGN-OP3": {
        parentId: "MGN", label: "Youth Arts Education Pipeline", tier: 'operational',
        function: "Develops K-12 arts education programs, youth cultural participation, and early creative talent identification",
        expectedTypes: [
          { type: "Youth arts education", reason: "Americans for the Arts afterschool programs, Kennedy Center education, Lincoln Center education for youth cultural pipeline", confidence: 0.85 },
        ]
      },
      "MGN-OP4": {
        parentId: "MGN", label: "Creative Workforce Development", tier: 'operational',
        function: "Manages cultural sector employment programs, freelance artist support, and creative economy workforce data",
        expectedTypes: [
          { type: "Creative workforce", reason: "CreativeFuture workforce programs, W.A.G.E. (Working Artists and the Greater Economy), cultural sector employment initiatives", confidence: 0.82 },
        ]
      },
      "MGN-OP5": {
        parentId: "MGN", label: "Talent Management & Agency Ops", tier: 'operational',
        function: "Manages professional creative talent representation, booking, and career development",
        expectedTypes: [
          { type: "Talent management", reason: "WME, CAA, UTA, ICM Partners for professional creative talent pipeline management", confidence: 0.88 },
        ]
      },
      "OFC-OP5": {
        parentId: "OFC", label: "Cultural Insurance & Risk Valuation", tier: 'operational',
        function: "Manages insurance valuation for cultural assets, fine art, and heritage properties",
        expectedTypes: [
          { type: "Cultural insurance", reason: "AXA Art Insurance, Hiscox fine art, Chubb cultural property for cultural asset risk valuation and coverage", confidence: 0.85 },
        ]
      },
      "PRECUNEUS-OP4": {
        parentId: "PRECUNEUS", label: "Cultural Semiotics & Symbol Analysis", tier: 'operational',
        function: "Analyzes cultural symbols, visual language, and semiotic systems across civilizations",
        expectedTypes: [
          { type: "Semiotic analysis", reason: "Brand semiotics consultancies, museum interpretive teams, cultural studies departments for cultural symbol analysis", confidence: 0.8 },
        ]
      },
      "HYPO-OP6": {
        parentId: "HYPO", label: "Cultural Wellness & Mindfulness Practice", tier: 'operational',
        function: "Supports cultural wellness traditions, mindfulness programs, and therapeutic cultural practices",
        expectedTypes: [
          { type: "Cultural wellness", reason: "Lululemon community wellness, Headspace cultural mindfulness, Calm cultural programs, yoga tradition preservation organizations", confidence: 0.82 },
        ]
      },
      "M1-OP6": {
        parentId: "M1", label: "Performing Arts & Dance Production", tier: 'operational',
        function: "Produces ballet, modern dance, opera, and theatrical performing arts cultural content",
        expectedTypes: [
          { type: "Performing arts production", reason: "Lincoln Center for the Performing Arts, Kennedy Center, Royal Opera House, American Ballet Theatre for performing arts cultural production", confidence: 0.88 },
        ]
      },
    };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveApprovals(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function approvalKey(nodeId, businessType) {
    return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);
  }
  function getApprovalStatus(nodeId, businessType) {
    var approvals = loadApprovals();
    return approvals[approvalKey(nodeId, businessType)] || null;
  }
  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status, reason: reason || '',
      nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(),
      reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) return callback(_hierarchyCache);
    try {
      var cached = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY));
      if (cached && cached._age && (Date.now() - cached._age) < HIERARCHY_TTL) {
        _hierarchyCache = cached;
        _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}

    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('culture');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = {
      nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {},
      nodeLabels: {}, nodeDepths: {}, allActivations: []
    };

    function processActivations(acts, depth) {
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i];
        var nid = a.brainNodeId;
        if (RI_NODES[nid]) continue;

        if (!result.nodeCompanies[nid]) result.nodeCompanies[nid] = {};
        if (!result.nodeTreatments[nid]) result.nodeTreatments[nid] = {};
        if (!result.nodeDiagnoses[nid]) result.nodeDiagnoses[nid] = {};
        if (!result.nodeLabels[nid]) result.nodeLabels[nid] = a.domainLabel || nid;
        if (!result.nodeDepths[nid]) result.nodeDepths[nid] = {};
        result.nodeDepths[nid][depth] = true;

        var cos = a.companies || [];
        for (var ci = 0; ci < cos.length; ci++) {
          var tk = cos[ci].ticker_or_id || cos[ci].name;
          if (!result.nodeCompanies[nid][tk]) {
            result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
          }
        }

        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) {
            result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
          }
        }

        var dx = a.diagnosticTriggers || [];
        for (var di = 0; di < dx.length; di++) result.nodeDiagnoses[nid][dx[di]] = true;

        result.allActivations.push({ brainNodeId: nid, depth: depth, label: a.domainLabel, companiesCount: cos.length });
      }
    }

    processActivations(topLevel.activations || [], 0);

    result._age = Date.now();
    _hierarchyCache = result;
    _hierarchyCacheAge = Date.now();

    try { sessionStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(result)); } catch (e) {}

    callback(result);
  }

  function getCultureState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('culture');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getCultureState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('culture') : null;
      var portal = brain ? brain._portalCache : null;
      if (portal && portal.activations) {
        for (var ai = 0; ai < portal.activations.length; ai++) {
          var act = portal.activations[ai];
          var nid = act.brainNodeId;
          if (!nodeCompanyIndex[nid]) nodeCompanyIndex[nid] = {};
          var cos = act.companies || [];
          for (var ci = 0; ci < cos.length; ci++) {
            var tk = cos[ci].ticker_or_id || cos[ci].name;
            nodeCompanyIndex[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason };
          }
        }
      }
    }

    var mapped = [], missing = [], speculative = [];

    for (var nodeId in NODE_BUSINESS_DIRECTORY) {
      if (RI_NODES[nodeId]) continue;
      var dir = NODE_BUSINESS_DIRECTORY[nodeId];
      var expectedTypes = dir.expectedTypes || [];
      var nodeActive = false;

      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var cci = 0; cci < circuits.length; cci++) {
          if (circuits[cci].nodeId === nodeId) { nodeActive = true; break; }
        }
        if (nodeActive) break;
      }

      var existingCos = nodeCompanyIndex[nodeId] || {};
      var mappedCompanyNames = [];
      for (var tk in existingCos) mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')');

      for (var ti = 0; ti < expectedTypes.length; ti++) {
        var expected = expectedTypes[ti];
        var key = approvalKey(nodeId, expected.type);
        var approval = approvals[key] || null;

        var alreadyMapped = false;
        var typeWords = expected.type.toLowerCase().split(/\s+/);
        for (var mi = 0; mi < mappedCompanyNames.length; mi++) {
          var compLower = mappedCompanyNames[mi].toLowerCase();
          var matchCount = 0;
          for (var wi = 0; wi < typeWords.length; wi++) {
            if (typeWords[wi].length > 3 && compLower.indexOf(typeWords[wi]) !== -1) matchCount++;
          }
          if (matchCount >= 2) { alreadyMapped = true; break; }
        }

        if (!alreadyMapped) {
          for (var ck in existingCos) {
            var fr = (existingCos[ck].reason || '').toLowerCase();
            var matchCount2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) matchCount2++;
            }
            if (matchCount2 >= 2) { alreadyMapped = true; break; }
          }
        }

        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) {
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Culture. It will appear as a valid target in investment and research opportunities tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Culture.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Culture mapping for audit tracking. Requires further validation.';
          }
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) {
          variantState = 'MISSING';
        } else if (!alreadyMapped) {
          variantState = 'PROPOSED';
        } else {
          variantState = 'MAPPED';
        }
        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey,
          nodeId: nodeId,
          nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label,
          nodeFunction: dir.function,
          plainFunction: dir.function,
          dysregulation: dir.dysregulation || '',
          plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type,
          reason: expected.reason,
          confidence: expected.confidence,
          nodeActive: nodeActive,
          alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames,
          approval: approval,
          approvalRequired: showButtons,
          variantState: variantState,
          approvalConsequence: consequence,
          tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) {
          entry.bucket = 'MAPPED';
          mapped.push(entry);
        } else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}; var out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped);
    missing = dedupeExact(missing);
    speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var tierOrder = { 'top': 0, 'operational': 1 };
      var ta = tierOrder[a.tier] || 1, tb = tierOrder[b.tier] || 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);

    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) {
      if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    }
    return approved;
  }

  window.LIMENCultureBusinessEngine = {
    runInference: function () { return runInference(_hierarchyCache); },
    runInferenceWithHierarchy: runInference,
    loadFullHierarchy: loadFullHierarchy,
    getApprovedMappings: getApprovedMappings,
    setApprovalStatus: setApprovalStatus,
    getApprovalStatus: getApprovalStatus,
    loadApprovals: loadApprovals,
    NODE_DIRECTORY: NODE_BUSINESS_DIRECTORY,
    RI_NODES: RI_NODES,
    isGenericTreatment: isGenericTreatment
  };

  loadFullHierarchy(function () { console.log('[CultureBusinessEngine] Hierarchy loaded'); });

  console.log('[CultureBusinessEngine] Loaded \u2014 103-node full-hierarchy culture business assignment engine');

})();
