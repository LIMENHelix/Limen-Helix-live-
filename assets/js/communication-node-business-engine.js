/**
 * communication-node-business-engine.js — Communication Node-to-Business Assignment Engine
 *
 * COMMUNICATION DOMAIN ONLY. Full-hierarchy inference layer.
 * 103 operational nodes mapped (20 COMMUNICATION-TOP + 83 COMMUNICATION-OPERATIONAL).
 * Excludes the same 20 RI / framework nodes as locked domains.
 * (123 total brain nodes - 20 RI exclusions = 103 operational.)
 *
 * Self-gates: only runs when ?domain=communication
 * Exposes: window.LIMENCommunicationBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'communication') return;

  var STORAGE_KEY = 'limen_communication_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_communication_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

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
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // 20 COMMUNICATION-TOP (full neuroTranslation) + 83 COMMUNICATION-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── COMMUNICATION-TOP NODES (20) — full detail with neuroTranslation ──
    'BROCA': {
      fullName: 'Broca\u2019s Area', label: 'News Production & Speech Output', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces grammatical, intentional speech and structured language output.', inBusiness: 'In communication, news production and speech output is what turns observations into the structured stories, posts, and broadcasts that audiences actually consume.' },
      function: 'Produces, edits, and broadcasts the structured stories and statements that reach an audience',
      dysregulation: 'Newsroom layoffs, news deserts, garbled messaging, missed editorial deadlines',
      expectedTypes: [
        { type: 'Digital news publisher', reason: 'NYT, WaPo, The Atlantic \u2014 produces structured journalism daily', confidence: 0.92 },
        { type: 'Local news startup / co-op', reason: 'Block Club Chicago, The 19th, Local News Lab', confidence: 0.85 },
        { type: 'Newsroom AI assistant', reason: 'Speeds up writing, fact-checking, and headline generation for journalists', confidence: 0.88 },
        { type: 'PR / corporate communications agency', reason: 'Edelman, Weber Shandwick, Brunswick \u2014 produces executive messaging', confidence: 0.82 },
        { type: 'Press release / wire service', reason: 'PR Newswire, Business Wire, Cision', confidence: 0.78 }
      ]
    },
    'A1': {
      fullName: 'Primary Auditory Cortex', label: 'Audio Channels & Podcasting', tier: 'top',
      neuroTranslation: { inNeurology: 'Receives and processes raw sound input from the inner ear.', inBusiness: 'In communication, audio channels and podcasting are the surface where spoken information enters the audience\u2019s attention.' },
      function: 'Delivers spoken-word content (radio, podcasts, audio news, voice messaging) to listeners',
      dysregulation: 'Audio bot fatigue, ad-load fatigue, poor discoverability, deepfake voice contamination',
      expectedTypes: [
        { type: 'Podcast platform / network', reason: 'Spotify, Apple Podcasts, iHeart, Wondery', confidence: 0.92 },
        { type: 'Audio news producer', reason: 'NPR, BBC, Daily Wire \u2014 daily news in audio form', confidence: 0.85 },
        { type: 'Voice deepfake detection vendor', reason: 'Pindrop, Reality Defender \u2014 protects against fake voice clones', confidence: 0.85 },
        { type: 'Podcast measurement / attribution', reason: 'Podtrac, Magellan AI, Chartable', confidence: 0.78 },
        { type: 'AI voice / TTS platform', reason: 'ElevenLabs, Resemble AI, Wellsaid \u2014 generates synthetic voiceover', confidence: 0.85 }
      ]
    },
    'NAcc': {
      fullName: 'Nucleus Accumbens', label: 'Engagement & Reward Loops', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes reward prediction and the dopamine-driven motivation to repeat behavior.', inBusiness: 'In communication, engagement and reward loops are what makes a feed addictive \u2014 the like, the comment, the next-video autoplay.' },
      function: 'Drives the engagement and reward signals that keep audiences coming back',
      dysregulation: 'Engagement collapse, audience fatigue, attention arms race, dark patterns',
      expectedTypes: [
        { type: 'Audience analytics platform', reason: 'Parse.ly, Chartbeat, Tubular \u2014 measures what holds attention', confidence: 0.92 },
        { type: 'Recommender / ranking system', reason: 'TikTok, YouTube, Instagram engineering teams', confidence: 0.90 },
        { type: 'Creator monetization platform', reason: 'Patreon, Substack, Beehiiv \u2014 turns audience attention into revenue', confidence: 0.88 },
        { type: 'Push notification / re-engagement', reason: 'OneSignal, Iterable, Braze', confidence: 0.78 }
      ]
    },
    'CC': {
      fullName: 'Corpus Callosum', label: 'Cross-Platform Distribution', tier: 'top',
      neuroTranslation: { inNeurology: 'Connects the brain\u2019s two hemispheres so information flows between them.', inBusiness: 'In communication, cross-platform distribution is what moves a story from one channel to another \u2014 from a press release to social to TV to print to podcast.' },
      function: 'Distributes content across multiple channels and platforms simultaneously',
      dysregulation: 'Distribution silos, channel-specific failures, syndication breakdown, paywall fragmentation',
      expectedTypes: [
        { type: 'Cross-platform publishing tool', reason: 'Hootsuite, Buffer, Sprout Social, Sprinklr', confidence: 0.90 },
        { type: 'Content syndication network', reason: 'Outbrain, Taboola, Yahoo News Network', confidence: 0.78 },
        { type: 'Press release wire / distribution', reason: 'PR Newswire, Business Wire, GlobeNewswire', confidence: 0.82 },
        { type: 'Multi-channel CMS', reason: 'WordPress VIP, Brightspot, Arc XP', confidence: 0.85 }
      ]
    },
    'FEF': {
      fullName: 'Frontal Eye Field', label: 'Attention Steering & Headlines', tier: 'top',
      neuroTranslation: { inNeurology: 'Directs eye movement toward what the brain decides is worth looking at.', inBusiness: 'In communication, attention steering and headlines is the editorial work of pointing the audience\u2019s eyes at the right thing first.' },
      function: 'Steers audience attention through headlines, thumbnails, and homepage curation',
      dysregulation: 'Clickbait, headline fatigue, homepage abandonment, doomscroll',
      expectedTypes: [
        { type: 'Headline testing / optimization tool', reason: 'Optimizely, A/B headline tools used by Vox, BuzzFeed', confidence: 0.85 },
        { type: 'Homepage editorial CMS', reason: 'Editorial dashboards used by NYT, WaPo, Guardian', confidence: 0.85 },
        { type: 'Feed ranking platform', reason: 'TikTok / Instagram / YouTube feed engineering', confidence: 0.88 },
        { type: 'Attention analytics service', reason: 'Heatmap, attention-time tracking for newsrooms', confidence: 0.78 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Editorial Strategy & Coordination', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates attention and decision making across changing demands.', inBusiness: 'In communication, editorial strategy and coordination is the newsroom-wide planning that decides what gets covered and who covers it.' },
      function: 'Coordinates editorial strategy across desks, beats, and channels',
      dysregulation: 'Strategy drift, beat blindness, missed coordination on big stories, siloed desks',
      expectedTypes: [
        { type: 'Newsroom workflow / collaboration tool', reason: 'Slack newsroom integrations, Notion editorial templates', confidence: 0.85 },
        { type: 'Editorial calendar / planning software', reason: 'Airtable, ContentCal, CoSchedule', confidence: 0.82 },
        { type: 'Newsroom analytics dashboard', reason: 'Chartbeat newsroom, Parse.ly editorial', confidence: 0.85 },
        { type: 'Editorial consultancy', reason: 'Helps newsrooms restructure beats and workflows', confidence: 0.75 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke\u2019s Area', label: 'Comprehension & Translation', tier: 'top',
      neuroTranslation: { inNeurology: 'Decodes language and turns sound or text into meaning.', inBusiness: 'In communication, comprehension and translation is the work of making information understandable across languages, reading levels, and cultures.' },
      function: 'Translates and adapts content for different audiences, languages, and accessibility needs',
      dysregulation: 'Translation gaps, comprehension barriers, accessibility failures, lost in localization',
      expectedTypes: [
        { type: 'Localization / translation platform', reason: 'Lokalise, Phrase, Smartling, DeepL Pro', confidence: 0.90 },
        { type: 'AI translation / dubbing service', reason: 'Synthesia, Papercup, HeyGen \u2014 multilingual video', confidence: 0.85 },
        { type: 'Plain-language / accessibility tool', reason: 'Hemingway Editor, Grammarly Business, Readable', confidence: 0.80 },
        { type: 'Closed captioning / subtitle service', reason: 'Rev, 3Play Media, Otter.ai for media', confidence: 0.85 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Audience Value & Subscription Decisions', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates the expected value of choices and updates preferences from experience.', inBusiness: 'In communication, audience value and subscription decisions is where readers decide what they\u2019ll pay for, what they\u2019ll subscribe to, and what they\u2019ll churn.' },
      function: 'Manages subscription, paywall, and audience value decisions for publishers and platforms',
      dysregulation: 'Subscription churn, paywall drop-off, value perception decline, ad-blockalypse',
      expectedTypes: [
        { type: 'Subscription management platform', reason: 'Piano, Zuora, Recurly, Memberful', confidence: 0.90 },
        { type: 'Paywall optimization service', reason: 'Piano, Pico \u2014 dynamic paywall and audience targeting', confidence: 0.85 },
        { type: 'Subscriber retention / churn analytics', reason: 'Profitwell, ChurnZero, Mixpanel for retention', confidence: 0.82 },
        { type: 'Reader revenue consultancy', reason: 'INMA, FT Strategies \u2014 helps publishers grow subscriptions', confidence: 0.75 }
      ]
    },
    'vlPFC': {
      fullName: 'Ventrolateral Prefrontal Cortex', label: 'Content Moderation & Inhibition', tier: 'top',
      neuroTranslation: { inNeurology: 'Inhibits inappropriate responses and applies rules to behavior.', inBusiness: 'In communication, content moderation and inhibition is the work of stopping harmful, illegal, or rule-breaking content before it reaches the audience.' },
      function: 'Reviews and removes content that violates platform policies, laws, or editorial standards',
      dysregulation: 'Moderation backlog, false positives, harmful content slipping through, moderator burnout',
      expectedTypes: [
        { type: 'Content moderation platform', reason: 'ActiveFence, Hive, Spectrum Labs', confidence: 0.92 },
        { type: 'Trust and safety BPO', reason: 'TaskUs, Teleperformance, Concentrix', confidence: 0.85 },
        { type: 'AI moderation / classifier', reason: 'OpenAI Moderation, Perspective API, Hive AI', confidence: 0.90 },
        { type: 'Trust and safety consultancy', reason: 'Tremau, Integrity Institute, Cinder', confidence: 0.78 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Standards & Editorial Conflict', tier: 'top',
      neuroTranslation: { inNeurology: 'Monitors conflict and errors, signaling that something needs correction.', inBusiness: 'In communication, standards and editorial conflict is the work of catching factual errors, ethical violations, and policy gaps before they go public.' },
      function: 'Enforces editorial standards, ethics policies, and corrections workflows',
      dysregulation: 'Corrections backlog, ethics violations, missed disclosures, standards erosion',
      expectedTypes: [
        { type: 'Fact-checking organization', reason: 'PolitiFact, Snopes, FactCheck.org, Logically', confidence: 0.92 },
        { type: 'Editorial standards consultancy', reason: 'Trusting News, Trust Project, NewsGuard', confidence: 0.85 },
        { type: 'Corrections / transparency tool', reason: 'NewsLynx, Repustate, internal newsroom CMSes', confidence: 0.75 },
        { type: 'Newsroom ombudsman service', reason: 'Independent reader advocates and ethics auditors', confidence: 0.72 }
      ]
    },
    'LANG': {
      fullName: 'Language Network', label: 'Language Models & NLU Infrastructure', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates the distributed language network across cortical regions.', inBusiness: 'In communication, language models and NLU infrastructure is the AI substrate that now reads, summarizes, generates, and routes information at scale.' },
      function: 'Provides the language model infrastructure that reads, writes, and routes information',
      dysregulation: 'Hallucination, training-data contamination, language model misuse, bias amplification',
      expectedTypes: [
        { type: 'LLM API provider', reason: 'OpenAI, Anthropic, Cohere, Mistral, Google Gemini', confidence: 0.95 },
        { type: 'NLU / intent recognition platform', reason: 'Rasa, Dialogflow, AssemblyAI', confidence: 0.85 },
        { type: 'Newsroom AI tool', reason: 'AP Newsroom AI, Reuters Lynx Insight, Bloomberg Cyborg', confidence: 0.85 },
        { type: 'Summarization / content brief tool', reason: 'Summari, Otter, Glean for newsrooms', confidence: 0.80 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum (whole)', label: 'Production Workflow Refinement', tier: 'top',
      neuroTranslation: { inNeurology: 'Refines motor and cognitive actions through prediction-error correction.', inBusiness: 'In communication, production workflow refinement is the polish step that turns rough copy or raw audio into a finished, publishable piece.' },
      function: 'Refines drafts, edits audio and video, and runs the polish step before publication',
      dysregulation: 'Quality regressions, editing bottlenecks, unfinished work shipping live',
      expectedTypes: [
        { type: 'Video editing platform', reason: 'Adobe Premiere, DaVinci Resolve, Descript, Capcut', confidence: 0.90 },
        { type: 'Audio editing platform', reason: 'Descript, Hindenburg, Adobe Audition, Reaper', confidence: 0.88 },
        { type: 'AI editing assistant', reason: 'Descript Studio Sound, Adobe Enhance Speech', confidence: 0.85 },
        { type: 'Production management for studios', reason: 'Studiobinder, Frame.io, Wipster', confidence: 0.80 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Audio Routing & Distribution', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays auditory information from the inner ear to the auditory cortex.', inBusiness: 'In communication, audio routing and distribution is the plumbing that moves recorded audio from creators to listeners across podcasts, radio, and streaming.' },
      function: 'Routes audio content from producers to listeners through hosting, distribution, and CDN',
      dysregulation: 'Audio CDN failures, hosting outages, RSS feed corruption, ad insertion bugs',
      expectedTypes: [
        { type: 'Podcast hosting platform', reason: 'Megaphone, Libsyn, Acast, Buzzsprout, Transistor', confidence: 0.92 },
        { type: 'Dynamic audio ad insertion', reason: 'Triton Digital, Megaphone Targeted Marketplace, AdsWizz', confidence: 0.85 },
        { type: 'Audio CDN / edge caching', reason: 'Cloudflare, Fastly audio delivery', confidence: 0.78 }
      ]
    },
    'V1': {
      fullName: 'Primary Visual Cortex', label: 'Visual Content & Image Production', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes incoming visual input from the eyes into structured patterns.', inBusiness: 'In communication, visual content and image production is the work of producing the photographs, illustrations, and graphics that anchor every story.' },
      function: 'Produces, sources, and licenses the photography, illustration, and graphics in published work',
      dysregulation: 'Image rights violations, AI deepfake confusion, missing alt text, inaccessible visuals',
      expectedTypes: [
        { type: 'Stock photo / image marketplace', reason: 'Getty Images, Shutterstock, Adobe Stock', confidence: 0.92 },
        { type: 'AI image generation platform', reason: 'Midjourney, Adobe Firefly, Ideogram, Imagen', confidence: 0.88 },
        { type: 'Photo desk / wire service', reason: 'AP Images, Reuters Pictures, AFP', confidence: 0.85 },
        { type: 'Image authenticity / C2PA tool', reason: 'Truepic, Content Credentials, Adobe Content Authenticity', confidence: 0.85 }
      ]
    },
    'STS': {
      fullName: 'Superior Temporal Sulcus', label: 'Social Signal & Sentiment Reading', tier: 'top',
      neuroTranslation: { inNeurology: 'Reads social cues from voice, face, and motion to infer intent.', inBusiness: 'In communication, social signal and sentiment reading is the work of figuring out what an audience actually feels about a story or brand.' },
      function: 'Analyzes audience sentiment, social signals, and reaction patterns',
      dysregulation: 'Sentiment blindness, social listening gaps, missed backlash, late crisis detection',
      expectedTypes: [
        { type: 'Social listening / sentiment platform', reason: 'Brandwatch, Meltwater, Sprout Social, Talkwalker', confidence: 0.90 },
        { type: 'Crisis communications service', reason: 'Edelman crisis, Levick, Sard Verbinnen', confidence: 0.82 },
        { type: 'PR measurement / earned media analytics', reason: 'Onclusive, Cision, Critical Mention', confidence: 0.85 },
        { type: 'Reputation monitoring service', reason: 'BrandYourself, ReputationDefender, Review Trackers', confidence: 0.78 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Audience Perspective & Diverse Voices', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports perspective-taking and theory of mind \u2014 seeing the world from someone else\u2019s view.', inBusiness: 'In communication, audience perspective and diverse voices is the practice of understanding and representing the audiences a newsroom or platform serves.' },
      function: 'Brings audience and community perspectives into editorial decisions and platform design',
      dysregulation: 'Audience disconnection, blind spots, missed communities, parachute journalism',
      expectedTypes: [
        { type: 'Audience research / community engagement', reason: 'Hearken, Groundsource, GroundTruth Project', confidence: 0.85 },
        { type: 'Diversity / representation audit service', reason: 'Maynard Institute audits, RJI consulting', confidence: 0.78 },
        { type: 'Reader survey / feedback platform', reason: 'Letterhead, Pico, Salty', confidence: 0.78 },
        { type: 'Community moderation platform', reason: 'OpenWeb, Coral by Vox Media', confidence: 0.82 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Strategic Communications Leadership', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains working memory and goal-directed reasoning over abstract plans.', inBusiness: 'In communication, strategic communications leadership is the executive function of a newsroom or comms department \u2014 setting the plan, defending the budget, and answering to the board.' },
      function: 'Sets the long-range strategy for a newsroom, comms team, or platform',
      dysregulation: 'Strategy drift, mission collapse, budget cuts, executive turnover',
      expectedTypes: [
        { type: 'Communications strategy consultancy', reason: 'Brunswick, FGS Global, Sard Verbinnen', confidence: 0.85 },
        { type: 'Media management consultancy', reason: 'McKinsey Media Practice, BCG TMT, FT Strategies', confidence: 0.82 },
        { type: 'Executive media training service', reason: 'Public Relations Society, Edelman Trust training', confidence: 0.75 },
        { type: 'Newsroom transformation advisor', reason: 'INMA, World Editors Forum, Reuters Institute', confidence: 0.78 }
      ]
    },
    'RAPHE': {
      fullName: 'Raphe Nuclei', label: 'Tone Regulation & Mood of Coverage', tier: 'top',
      neuroTranslation: { inNeurology: 'Releases serotonin, regulating mood, tone, and arousal across the brain.', inBusiness: 'In communication, tone regulation and mood of coverage is the editorial work of setting whether a story feels alarming, hopeful, neutral, or constructive.' },
      function: 'Regulates the emotional tone and framing of coverage across a publication',
      dysregulation: 'Doom-and-gloom fatigue, false-balance anxiety, mood-swing coverage, framing bias',
      expectedTypes: [
        { type: 'Solutions journalism organization', reason: 'Solutions Journalism Network, Constructive Institute', confidence: 0.85 },
        { type: 'Constructive news platform', reason: 'Reasons to be Cheerful, Future Crunch, Positive News', confidence: 0.78 },
        { type: 'Editorial framing consultancy', reason: 'Frameworks Institute, Media Cause', confidence: 0.75 },
        { type: 'Audience wellbeing research', reason: 'News Avoidance research at Reuters Institute', confidence: 0.72 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Face / Visual Authenticity & Deepfake Detection', tier: 'top',
      neuroTranslation: { inNeurology: 'Specializes in recognizing faces, objects, and complex visual patterns.', inBusiness: 'In communication, face and visual authenticity is the work of telling real images from fake ones \u2014 a problem that has exploded with generative AI.' },
      function: 'Verifies visual authenticity, detects deepfakes, and certifies image and video provenance',
      dysregulation: 'Deepfake confusion, fabricated evidence, manipulated photos passing as real',
      expectedTypes: [
        { type: 'Deepfake detection vendor', reason: 'Reality Defender, Truepic, Sentinel AI, DeepMedia', confidence: 0.92 },
        { type: 'Image / video forensics service', reason: 'Amped Software, Cellebrite, Belkasoft', confidence: 0.85 },
        { type: 'C2PA / Content Credentials platform', reason: 'Adobe Content Authenticity Initiative, Truepic', confidence: 0.88 },
        { type: 'Newsroom verification team service', reason: 'Bellingcat, Storyful, AFP Fact Check', confidence: 0.85 }
      ]
    },
    'GABA_GLU': {
      fullName: 'GABA / Glutamate Balance', label: 'Virality & Amplification Throttling', tier: 'top',
      neuroTranslation: { inNeurology: 'Balances excitatory and inhibitory signaling so the system doesn\u2019t over- or under-react.', inBusiness: 'In communication, virality and amplification throttling is the work of deciding how fast and how widely to let a piece of content spread.' },
      function: 'Manages amplification, virality limits, and circuit-breaker controls on platform spread',
      dysregulation: 'Viral misinformation, runaway hashtag trends, algorithmic over-amplification',
      expectedTypes: [
        { type: 'Algorithmic amplification audit service', reason: 'Stanford Internet Observatory, ISD, Logically', confidence: 0.82 },
        { type: 'Viral content tracking tool', reason: 'CrowdTangle, NewsWhip, BuzzSumo, Talkwalker', confidence: 0.85 },
        { type: 'Circuit breaker / friction tool for platforms', reason: 'Internal trust-and-safety teams at Meta, Google, X', confidence: 0.78 }
      ]
    },

    // ── COMMUNICATION-OPERATIONAL NODES (83) — 2 business types each ──
    'ADR':       { fullName: 'Adrenal', label: 'Crisis Comms Surge Capacity', tier: 'operational', function: 'Provides surge crisis communications when a newsroom or brand is under acute reputational stress', dysregulation: 'Crisis fatigue', expectedTypes: [{ type: 'Crisis PR firm', reason: 'Edelman crisis, Levick, Sard Verbinnen', confidence: 0.85 }, { type: 'Incident response retainer', reason: 'On-call comms support for breaking events', confidence: 0.80 }] },
    'AG':        { fullName: 'Angular Gyrus', label: 'Cross-Source Synthesis', tier: 'operational', function: 'Integrates information across multiple sources into coherent analysis', dysregulation: 'Synthesis breakdown', expectedTypes: [{ type: 'Investigative journalism nonprofit', reason: 'ProPublica, ICIJ, OCCRP', confidence: 0.85 }, { type: 'Intelligence-style analysis tool', reason: 'Quid, Primer, Recorded Future for journalism', confidence: 0.80 }] },
    'AI':        { fullName: 'Anterior Insula', label: 'Audience Risk Triage', tier: 'operational', function: 'Triages audience and reputational risk signals across a brand or newsroom', dysregulation: 'Risk blindness', expectedTypes: [{ type: 'Reputation risk monitoring', reason: 'BrandYourself, Onclusive risk module', confidence: 0.78 }, { type: 'Crisis early-warning service', reason: 'Watches for emerging brand crises', confidence: 0.78 }] },
    'ANT':       { fullName: 'Anterior Thalamus', label: 'Headline Attention Routing', tier: 'operational', function: 'Routes editor attention to the most urgent stories', dysregulation: 'Attention sprawl', expectedTypes: [{ type: 'Editor dashboard / news triage tool', reason: 'NewsWhip Spike, Trends24, Echobox', confidence: 0.78 }] },
    'ARC':       { fullName: 'Arcuate Fasciculus', label: 'Speech-to-Text Bridging', tier: 'operational', function: 'Connects spoken word to written transcript for journalism and content production', dysregulation: 'Transcription gap', expectedTypes: [{ type: 'Transcription / ASR platform', reason: 'Otter.ai, Rev, Trint, Descript', confidence: 0.90 }] },
    'BDNF':      { fullName: 'Brain-Derived Neurotrophic Factor', label: 'Journalism Skills & Training', tier: 'operational', function: 'Supports continuous training and skill development for reporters and editors', dysregulation: 'Skill atrophy', expectedTypes: [{ type: 'Journalism school / training institute', reason: 'Poynter NewsU, Knight Center, Reuters Institute', confidence: 0.85 }, { type: 'Newsroom upskilling provider', reason: 'Training in data, video, security, audience', confidence: 0.78 }] },
    'BLA':       { fullName: 'Basolateral Amygdala', label: 'Backlash Pattern Memory', tier: 'operational', function: 'Learns from past backlash and crisis episodes to anticipate future ones', dysregulation: 'Repeat reputational damage', expectedTypes: [{ type: 'Reputation pattern analytics', reason: 'Tracks how past crises played out and what worked', confidence: 0.75 }] },
    'BNST':      { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Sustained Brand Anxiety Monitoring', tier: 'operational', function: 'Watches for slow-burning brand sentiment decay', dysregulation: 'Slow brand erosion missed', expectedTypes: [{ type: 'Long-term brand sentiment tracker', reason: 'YouGov BrandIndex, Brand Keys', confidence: 0.78 }] },
    'CARD':      { fullName: 'Cardiovascular System', label: 'Distribution Heartbeat / Uptime', tier: 'operational', function: 'Provides uptime and heartbeat monitoring for distribution channels', dysregulation: 'Channel outages', expectedTypes: [{ type: 'Channel uptime monitoring', reason: 'Pingdom, StatusCake for newsroom infrastructure', confidence: 0.78 }] },
    'CAUD':      { fullName: 'Caudate Nucleus', label: 'Editorial Workflow Automation', tier: 'operational', function: 'Automates repetitive newsroom and content workflows', dysregulation: 'Manual overload', expectedTypes: [{ type: 'Newsroom automation platform', reason: 'Bots for boilerplate stories (AP Wordsmith, Automated Insights)', confidence: 0.82 }, { type: 'Editorial workflow tool', reason: 'Airtable, Notion, Trello for newsrooms', confidence: 0.78 }] },
    'CING':     { fullName: 'Cingulate Cortex (general)', label: 'Newsroom Postmortem & Culture', tier: 'operational', function: 'Runs postmortems on coverage that went wrong and shapes newsroom culture', dysregulation: 'Repeat editorial mistakes', expectedTypes: [{ type: 'Editorial review / postmortem tool', reason: 'Internal newsroom review processes', confidence: 0.72 }] },
    'CeA':       { fullName: 'Central Amygdala', label: 'Threat & Hostile Actor Detection', tier: 'operational', function: 'Detects hostile actors targeting journalists and platforms', dysregulation: 'Journalist harassment', expectedTypes: [{ type: 'Journalist safety platform', reason: 'Block Party, RSF safety, OnlineSOS', confidence: 0.85 }, { type: 'Targeted harassment defense service', reason: 'Defends reporters and creators from coordinated attacks', confidence: 0.80 }] },
    'CLAUST':   { fullName: 'Claustrum', label: 'Cross-Story Correlation', tier: 'operational', function: 'Correlates stories across desks to find global patterns', dysregulation: 'Siloed coverage', expectedTypes: [{ type: 'Story clustering / topic modeling', reason: 'Quid, Primer, NewsWhip topic clusters', confidence: 0.78 }] },
    'CMZ':       { fullName: 'Central Midbrain Zone', label: 'Arousal & Breaking-News Mode', tier: 'operational', function: 'Switches a newsroom into breaking news / high-alert mode', dysregulation: 'Constant breaking-news mode burnout', expectedTypes: [{ type: 'Breaking news desk tooling', reason: 'Slack alerting, breaking news dashboards', confidence: 0.70 }] },
    'CON':       { fullName: 'Cingulo-opercular Network', label: 'Sustained Beat Coverage', tier: 'operational', function: 'Maintains sustained, long-term beat coverage of important topics', dysregulation: 'Beat abandonment', expectedTypes: [{ type: 'Beat reporting nonprofit', reason: 'Marshall Project, Chalkbeat, The 19th, Grist', confidence: 0.85 }] },
    'DAN':       { fullName: 'Dorsal Attention Network', label: 'Goal-Directed Newsroom Focus', tier: 'operational', function: 'Directs newsroom attention toward editorial goals', dysregulation: 'Distraction by viral noise', expectedTypes: [{ type: 'Editorial focus / planning consultancy', reason: 'Helps newsrooms stay on mission', confidence: 0.72 }] },
    'DISS':      { fullName: 'Dissociation', label: 'Crisis Comms Chaos Drill', tier: 'operational', function: 'Runs simulated crisis comms drills before real crises hit', dysregulation: 'Untested response', expectedTypes: [{ type: 'Crisis simulation / tabletop service', reason: 'Edelman, Levick crisis simulation', confidence: 0.78 }] },
    'DMN':       { fullName: 'Default Mode Network', label: 'Always-On Audience Surface', tier: 'operational', function: 'Provides the always-on background surface where users return for news and updates', dysregulation: 'Background app fatigue', expectedTypes: [{ type: 'Mobile news app', reason: 'Apple News, Google News, SmartNews, Flipboard', confidence: 0.88 }] },
    'DV':        { fullName: 'Dorsal Vagal Complex', label: 'Graceful Sunsetting of Coverage', tier: 'operational', function: 'Handles the graceful shutdown of coverage areas no longer being staffed', dysregulation: 'Ghost beats', expectedTypes: [{ type: 'Editorial archive / sunset workflow', reason: 'Tools for migrating and archiving abandoned coverage', confidence: 0.65 }] },
    'EC':        { fullName: 'Entorhinal Cortex', label: 'Source Memory / Background Files', tier: 'operational', function: 'Maintains source files, background dossiers, and contact lists', dysregulation: 'Source rot', expectedTypes: [{ type: 'Newsroom CRM / source management', reason: 'Muck Rack, RelSci, internal source databases', confidence: 0.78 }] },
    'ECN':       { fullName: 'Executive Control Network', label: 'Comms Identity & Access Control', tier: 'operational', function: 'Controls who can publish, post, or speak on behalf of a brand or newsroom', dysregulation: 'Rogue posts, account hijack', expectedTypes: [{ type: 'Social media access management', reason: 'Hootsuite governance, Sprinklr permissions, SocialFlow', confidence: 0.80 }] },
    'EI':        { fullName: 'Excitatory/Inhibitory Balance', label: 'Engagement Throttling', tier: 'operational', function: 'Balances engagement signals so a single hot story doesn\u2019t crowd out everything else', dysregulation: 'Algorithmic dominance', expectedTypes: [{ type: 'Editorial diversity tool', reason: 'Ensures homepage and feed diversity', confidence: 0.70 }] },
    'EMP':       { fullName: 'Empathy Circuit', label: 'Audience-Empathic Coverage Service', tier: 'operational', function: 'Helps newsrooms cover trauma and sensitive topics with care', dysregulation: 'Re-traumatization', expectedTypes: [{ type: 'Trauma-informed reporting training', reason: 'Dart Center for Journalism and Trauma', confidence: 0.82 }] },
    'ENDO':      { fullName: 'Endocrine System', label: 'Scheduled Publishing & Cron Jobs', tier: 'operational', function: 'Schedules newsletters, alerts, and recurring posts', dysregulation: 'Missed sends', expectedTypes: [{ type: 'Newsletter platform', reason: 'Substack, Beehiiv, Mailchimp, Klaviyo', confidence: 0.85 }] },
    'ENS':       { fullName: 'Enteric Nervous System', label: 'Autonomous News Bots', tier: 'operational', function: 'Runs autonomous publishing agents that operate without human oversight on each post', dysregulation: 'Hallucinated bot stories', expectedTypes: [{ type: 'AI news generation agent', reason: 'Agent platforms generating financial / sports / weather posts', confidence: 0.75 }] },
    'FORN':      { fullName: 'Fornix', label: 'Source Material Pipelines', tier: 'operational', function: 'Moves source material between archives, files, and active reporting', dysregulation: 'Lost research', expectedTypes: [{ type: 'Document management for journalism', reason: 'DocumentCloud, Pinpoint, Aleph', confidence: 0.85 }] },
    'GBA':       { fullName: 'Gut-Brain Axis', label: 'Audience Feedback Loops', tier: 'operational', function: 'Maintains feedback loops between audience reaction and editorial decisions', dysregulation: 'Editorial echo chamber', expectedTypes: [{ type: 'Audience feedback platform', reason: 'Hearken, Pico, GroundSource', confidence: 0.78 }] },
    'GP':        { fullName: 'Globus Pallidus', label: 'Publish Approval Gating', tier: 'operational', function: 'Gates publication through editorial approvals', dysregulation: 'Approval bypass', expectedTypes: [{ type: 'Editorial workflow / approval system', reason: 'Built into CMSes like Arc XP, Brightspot, WordPress VIP', confidence: 0.80 }] },
    'HAB':       { fullName: 'Habenula', label: 'Failed-Story Postmortem Loop', tier: 'operational', function: 'Tracks stories that backfired and propagates the lesson', dysregulation: 'Repeat failures', expectedTypes: [{ type: 'Editorial postmortem service', reason: 'Internal review of botched stories', confidence: 0.70 }] },
    'HIPP':      { fullName: 'Hippocampus', label: 'Newsroom Archive & Memory', tier: 'operational', function: 'Stores and retrieves the newsroom\u2019s historical record', dysregulation: 'Archive rot', expectedTypes: [{ type: 'News archive platform', reason: 'NewsBank, Factiva, ProQuest, LexisNexis', confidence: 0.85 }, { type: 'Internal newsroom search', reason: 'Elastic-based newsroom intranet search', confidence: 0.78 }] },
    'HPA':       { fullName: 'HPA Axis', label: 'Crisis Escalation Chain', tier: 'operational', function: 'Manages multi-level escalation when a comms crisis escalates', dysregulation: 'Escalation breakdown', expectedTypes: [{ type: 'Crisis comms playbook platform', reason: 'Documents and triggers escalation paths', confidence: 0.72 }] },
    'HYPO':      { fullName: 'Hypothalamus', label: 'Editorial Homeostasis Controller', tier: 'operational', function: 'Maintains baseline newsroom output rate and budget homeostasis', dysregulation: 'Drift from publication rhythm', expectedTypes: [{ type: 'Editorial cadence dashboard', reason: 'Tracks publishing rate, beat coverage, output', confidence: 0.72 }] },
    'IC':        { fullName: 'Inferior Colliculus', label: 'Audio Ingest Middleware', tier: 'operational', function: 'Ingests and routes audio streams from sources to production', dysregulation: 'Dropped audio', expectedTypes: [{ type: 'Audio routing / live ingest tool', reason: 'Skype TX, Comrex, Tieline for radio', confidence: 0.75 }] },
    'IPS':       { fullName: 'Intraparietal Sulcus', label: 'Data Journalism & Visualization', tier: 'operational', function: 'Runs data journalism workflows and visualization production', dysregulation: 'Bad chart, broken dataset', expectedTypes: [{ type: 'Data visualization platform', reason: 'Datawrapper, Flourish, Tableau, Observable', confidence: 0.92 }, { type: 'Data journalism toolkit', reason: 'OpenRefine, Mapbox, R/Python notebooks for journalists', confidence: 0.85 }] },
    'LAR':       { fullName: 'Laryngeal Cortex', label: 'Outbound Voice & Statement Channel', tier: 'operational', function: 'Sends outbound voice messages, statements, and broadcasts', dysregulation: 'Off-message statements', expectedTypes: [{ type: 'Spokesperson / executive comms tool', reason: 'Press kit hosting, statement libraries', confidence: 0.72 }] },
    'LC':        { fullName: 'Locus Coeruleus', label: 'Wire Service Alerts', tier: 'operational', function: 'Broadcasts urgent wire alerts that demand newsroom attention', dysregulation: 'Alert storms', expectedTypes: [{ type: 'Wire service', reason: 'AP, Reuters, Bloomberg, AFP', confidence: 0.92 }, { type: 'Breaking news alert tool', reason: 'NewsWhip, Echobox', confidence: 0.78 }] },
    'LGN':       { fullName: 'Lateral Geniculate Nucleus', label: 'Visual Stream Ingest', tier: 'operational', function: 'Ingests visual streams (live video, broadcast feeds)', dysregulation: 'Video drops', expectedTypes: [{ type: 'Live video streaming platform', reason: 'LiveU, Quicklink, vMix, Cloudflare Stream', confidence: 0.80 }] },
    'M1':        { fullName: 'Primary Motor Cortex', label: 'Publication Execution', tier: 'operational', function: 'Executes the actual publish action across CMSes', dysregulation: 'Failed publishes', expectedTypes: [{ type: 'Headless CMS', reason: 'Sanity, Contentful, Strapi, Storyblok', confidence: 0.85 }] },
    'MAMM':      { fullName: 'Mammillary Bodies', label: 'Long-Term Story Archive', tier: 'operational', function: 'Archives long-term story memory and old coverage', dysregulation: 'Archive loss', expectedTypes: [{ type: 'Web archive service', reason: 'Internet Archive, Archive.today, Webrecorder', confidence: 0.82 }] },
    'MDT':       { fullName: 'Mediodorsal Thalamus', label: 'AI Output Gating', tier: 'operational', function: 'Gates AI-generated comms output through human review', dysregulation: 'Unsupervised AI output', expectedTypes: [{ type: 'Editorial AI guardrails tool', reason: 'Reviews AI-generated content before publication', confidence: 0.75 }] },
    'MICRO':     { fullName: 'Microglia', label: 'Disinformation Cleanup Crew', tier: 'operational', function: 'Identifies and removes disinformation from a publisher\u2019s ecosystem', dysregulation: 'Disinfo accumulation', expectedTypes: [{ type: 'Misinformation tracker', reason: 'NewsGuard, Logically, Graphika', confidence: 0.85 }, { type: 'Pre-bunking content service', reason: 'Inoculation campaigns vs. known false claims', confidence: 0.78 }] },
    'NBM':       { fullName: 'Nucleus Basalis of Meynert', label: 'Editorial Cadence & Velocity', tier: 'operational', function: 'Sets editorial cadence and publication velocity', dysregulation: 'Velocity collapse', expectedTypes: [{ type: 'Newsroom metrics platform', reason: 'Chartbeat, Parse.ly, Permutive', confidence: 0.85 }] },
    'NEOCER':    { fullName: 'Neocerebellum', label: 'Fine Editorial Tuning', tier: 'operational', function: 'Refines headlines, leads, and pull quotes for maximum reader impact', dysregulation: 'Bland or off-tone pieces', expectedTypes: [{ type: 'Headline / copy AI tool', reason: 'Jasper, Copy.ai, Writer for newsrooms', confidence: 0.80 }] },
    'NTS':       { fullName: 'Nucleus Tractus Solitarius', label: 'Reader Telemetry Aggregation', tier: 'operational', function: 'Aggregates reader behavior signals across the publication', dysregulation: 'Noisy metrics', expectedTypes: [{ type: 'Reader analytics platform', reason: 'Chartbeat, Parse.ly, Tinypass / Piano', confidence: 0.85 }] },
    'OLF':       { fullName: 'Olfactory System', label: 'Pattern-Match Disinfo Sniffing', tier: 'operational', function: 'Detects subtle disinformation patterns by analogy to past episodes', dysregulation: 'Novel disinfo missed', expectedTypes: [{ type: 'Network analysis / OSINT tool', reason: 'Maltego, Hunchly, Bellingcat methods', confidence: 0.78 }] },
    'OPIOID':    { fullName: 'Opioid System', label: 'Audience Comfort & Wellbeing Content', tier: 'operational', function: 'Provides comfort, wellbeing, and feel-good content to balance hard news', dysregulation: 'News fatigue, churn', expectedTypes: [{ type: 'Lifestyle / wellbeing publisher', reason: 'Apartment Therapy, Well+Good, Goop', confidence: 0.75 }] },
    'OSC':       { fullName: 'Neural Oscillators', label: 'Newsroom Scheduling Rhythms', tier: 'operational', function: 'Maintains scheduled rhythms (daily roundups, weekly newsletters)', dysregulation: 'Schedule slip', expectedTypes: [{ type: 'Newsletter / send scheduling tool', reason: 'Beehiiv, Mailchimp, Substack scheduling', confidence: 0.78 }] },
    'OXY':       { fullName: 'Oxytocin System', label: 'Trust & Reader Loyalty', tier: 'operational', function: 'Builds long-term trust and loyalty between a publication and its readers', dysregulation: 'Trust collapse', expectedTypes: [{ type: 'Reader engagement / trust platform', reason: 'Trusting News, Trust Project, NewsGuard', confidence: 0.82 }] },
    'PAG':       { fullName: 'Periaqueductal Gray', label: 'Crisis Lockdown Mode', tier: 'operational', function: 'Triggers lockdown mode when a major crisis hits a newsroom or platform', dysregulation: 'Lockdown failure', expectedTypes: [{ type: 'Crisis response platform', reason: 'In-house tools that lock down comments and surface emergency content', confidence: 0.70 }] },
    'PBN':       { fullName: 'Parabrachial Nucleus', label: 'Capacity Signaling', tier: 'operational', function: 'Signals capacity constraints (out of bandwidth, out of attention) to upstream', dysregulation: 'Silent overload', expectedTypes: [{ type: 'Newsroom capacity planning tool', reason: 'Tracks reporter bandwidth and assignment load', confidence: 0.70 }] },
    'PCC':       { fullName: 'Posterior Cingulate Cortex', label: 'Retrospective Coverage Analytics', tier: 'operational', function: 'Provides retrospective analytics on past coverage performance', dysregulation: 'Historical blindness', expectedTypes: [{ type: 'Long-term analytics dashboard', reason: 'Analyzes performance of past coverage', confidence: 0.75 }] },
    'PI':        { fullName: 'Posterior Insula', label: 'Newsroom Internal State Monitoring', tier: 'operational', function: 'Monitors the newsroom\u2019s internal health (morale, burnout, output)', dysregulation: 'Burnout missed', expectedTypes: [{ type: 'Workforce wellbeing platform', reason: 'Employee health tools applied to newsrooms', confidence: 0.72 }] },
    'PIN':       { fullName: 'Pineal Gland', label: 'Scheduled Publishing Rhythms', tier: 'operational', function: 'Runs scheduled / time-gated publishing windows', dysregulation: 'Embargo break', expectedTypes: [{ type: 'Embargo management tool', reason: 'Used by wire services and PR distribution', confidence: 0.70 }] },
    'PIT':       { fullName: 'Pituitary Gland', label: 'Press Release Broadcast', tier: 'operational', function: 'Broadcasts press releases and corporate announcements', dysregulation: 'Silent releases', expectedTypes: [{ type: 'Press release distribution', reason: 'PR Newswire, Business Wire, GlobeNewswire', confidence: 0.85 }] },
    'PPN':       { fullName: 'Pedunculopontine Nucleus', label: 'Continuous Coverage Engine', tier: 'operational', function: 'Runs continuous coverage of long-running stories (elections, wars, epidemics)', dysregulation: 'Coverage gaps', expectedTypes: [{ type: 'Live blog / live update tool', reason: 'Live blog tools used by Guardian, BBC, NYT', confidence: 0.80 }] },
    'PRECUNEUS': { fullName: 'Precuneus', label: 'Self-Reflection & Newsroom Analytics', tier: 'operational', function: 'Provides self-reflective analytics on the newsroom\u2019s own behavior', dysregulation: 'Self-awareness gap', expectedTypes: [{ type: 'Newsroom KPI dashboard', reason: 'Internal performance tracking', confidence: 0.78 }] },
    'PULV':      { fullName: 'Pulvinar', label: 'Critical-Story Attention Weighting', tier: 'operational', function: 'Weights newsroom attention by story criticality', dysregulation: 'Critical story missed', expectedTypes: [{ type: 'Story prioritization tool', reason: 'Internal newsroom triage software', confidence: 0.72 }] },
    'PUT':       { fullName: 'Putamen', label: 'Habit-Formed Editorial Routines', tier: 'operational', function: 'Enforces habitual editorial routines and style consistency', dysregulation: 'Style drift', expectedTypes: [{ type: 'Style guide / linting tool', reason: 'Vale, Acrolinx, Hemingway for newsrooms', confidence: 0.78 }] },
    'RF':        { fullName: 'Reticular Formation', label: 'Wake-from-Idle Push Alerts', tier: 'operational', function: 'Wakes audiences from idle with breaking-news push alerts', dysregulation: 'Push notification fatigue', expectedTypes: [{ type: 'Push notification platform', reason: 'OneSignal, Iterable, Braze, Airship', confidence: 0.85 }] },
    'RSC':       { fullName: 'Retrosplenial Cortex', label: 'Topic / Beat Mapping', tier: 'operational', function: 'Maps the topic terrain a newsroom covers', dysregulation: 'Topic blindness', expectedTypes: [{ type: 'Topic taxonomy / tagging tool', reason: 'IPTC topics, Trint topic models, Quid', confidence: 0.72 }] },
    'S1':        { fullName: 'Primary Somatosensory Cortex', label: 'Audience Telemetry & Sensing', tier: 'operational', function: 'Collects raw user telemetry (clicks, scroll, dwell)', dysregulation: 'Blind spots', expectedTypes: [{ type: 'User analytics platform', reason: 'FullStory, LogRocket, Hotjar for publishers', confidence: 0.82 }] },
    'SC':        { fullName: 'Superior Colliculus', label: 'Orient-to-Breaking Dashboards', tier: 'operational', function: 'Orients newsroom attention to new breaking events fast', dysregulation: 'Dashboard overload', expectedTypes: [{ type: 'Breaking news dashboard', reason: 'NewsWhip Spike, CrowdTangle, Trends24', confidence: 0.82 }] },
    'SEPT':      { fullName: 'Septal Nuclei', label: 'Source Trust Chains', tier: 'operational', function: 'Maintains chains of source trust and verification', dysregulation: 'Bad source chain', expectedTypes: [{ type: 'Source verification platform', reason: 'Newsroom internal source vetting tools', confidence: 0.72 }] },
    'SMA':       { fullName: 'Supplementary Motor Area', label: 'Pre-Publication Checks', tier: 'operational', function: 'Runs pre-publication checks (grammar, links, legal, fact-check)', dysregulation: 'Bad pre-flight', expectedTypes: [{ type: 'Pre-publication QA tool', reason: 'Internal CMS workflows, Grammarly Business', confidence: 0.78 }] },
    'SMN':       { fullName: 'Somatomotor Network', label: 'Physical Broadcast Operations', tier: 'operational', function: 'Runs physical broadcast operations (TV studios, radio booths)', dysregulation: 'Hardware failure', expectedTypes: [{ type: 'Broadcast equipment vendor', reason: 'Sony Broadcast, Grass Valley, Avid', confidence: 0.78 }] },
    'SN':        { fullName: 'Salience Network', label: 'Story Salience Detection', tier: 'operational', function: 'Surfaces the most salient stories of the day', dysregulation: 'Salience blindness', expectedTypes: [{ type: 'Trending content detector', reason: 'NewsWhip, Trends24, Echobox', confidence: 0.82 }] },
    'SNIG':      { fullName: 'Substantia Nigra', label: 'Newsroom Initiative Momentum', tier: 'operational', function: 'Initiates and sustains newsroom transformation initiatives', dysregulation: 'Initiative paralysis', expectedTypes: [{ type: 'Newsroom transformation consultancy', reason: 'INMA, FT Strategies, Knight Foundation programs', confidence: 0.75 }] },
    'SNS':       { fullName: 'Sympathetic Nervous System', label: 'All-Hands Crisis Mobilization', tier: 'operational', function: 'Mobilizes all-hands response to a major news event', dysregulation: 'Mobilization fatigue', expectedTypes: [{ type: 'Major story command tool', reason: 'Internal newsroom incident command software', confidence: 0.72 }] },
    'STN':       { fullName: 'Subthalamic Nucleus', label: 'Publish Hold / Embargo Lock', tier: 'operational', function: 'Holds publication until embargo or legal sign-off lifts', dysregulation: 'Embargo break', expectedTypes: [{ type: 'Embargo / hold management tool', reason: 'Built into wire services and CMS workflows', confidence: 0.70 }] },
    'STRI':      { fullName: 'Striatum', label: 'Editorial Reward Shaping', tier: 'operational', function: 'Shapes editorial incentives and rewards (bylines, bonuses, recognition)', dysregulation: 'Misaligned rewards', expectedTypes: [{ type: 'Editorial performance management', reason: 'Internal newsroom HR systems', confidence: 0.68 }] },
    'THAL':      { fullName: 'Thalamus', label: 'Distribution Routing & Edge', tier: 'operational', function: 'Routes content traffic across the global edge', dysregulation: 'Distribution failure', expectedTypes: [{ type: 'CDN provider for media', reason: 'Cloudflare, Fastly, Akamai for publishers', confidence: 0.85 }] },
    'TPOLE':     { fullName: 'Temporal Pole', label: 'Brand Memory & Newsroom Identity', tier: 'operational', function: 'Maintains the brand identity and institutional memory of a publication', dysregulation: 'Brand drift', expectedTypes: [{ type: 'Brand management platform', reason: 'Frontify, Bynder for newsroom brand systems', confidence: 0.70 }] },
    'TrkB':      { fullName: 'Tropomyosin receptor kinase B', label: 'Editorial Experimentation', tier: 'operational', function: 'Enables safe editorial experimentation (new beats, formats, products)', dysregulation: 'No experimentation', expectedTypes: [{ type: 'Editorial A/B / experimentation platform', reason: 'Statsig, Eppo, Optimizely for newsrooms', confidence: 0.78 }] },
    'UNC':       { fullName: 'Uncinate Fasciculus', label: 'Reader CRM & Subscriber Relationship', tier: 'operational', function: 'Operates reader CRM, subscriber lists, and relationship workflows', dysregulation: 'Subscriber attrition', expectedTypes: [{ type: 'Reader CRM platform', reason: 'Letterhead, Salesforce Media Cloud', confidence: 0.78 }] },
    'VAN':       { fullName: 'Ventral Attention Network', label: 'Interrupt Handling for Breaking News', tier: 'operational', function: 'Handles interrupt-style breaking news that demands immediate coverage', dysregulation: 'Missed interrupt', expectedTypes: [{ type: 'Breaking news desk tool', reason: 'Internal newsroom alerting', confidence: 0.72 }] },
    'VERM':      { fullName: 'Cerebellar Vermis', label: 'Core Production Reliability', tier: 'operational', function: 'Runs core production reliability (CMS, publishing, archive uptime)', dysregulation: 'Production outages', expectedTypes: [{ type: 'CMS managed hosting', reason: 'WordPress VIP, Brightspot, Pantheon for media', confidence: 0.78 }] },
    'VEST':      { fullName: 'Vestibular System', label: 'Editorial Drift Detection', tier: 'operational', function: 'Detects drift between editorial intent and what is being published', dysregulation: 'Mission drift', expectedTypes: [{ type: 'Editorial audit service', reason: 'Periodic external audits of coverage vs. mission', confidence: 0.72 }] },
    'VP':        { fullName: 'Ventral Pallidum', label: 'Story Sunsetting & Archive Workflow', tier: 'operational', function: 'Handles graceful sunsetting of beats, products, and old content', dysregulation: 'Zombie beats', expectedTypes: [{ type: 'Editorial sunset workflow', reason: 'Migration and archival tooling', confidence: 0.65 }] },
    'VTA':       { fullName: 'Ventral Tegmental Area', label: 'Source Incentive & Bounty Programs', tier: 'operational', function: 'Incentivizes external tipsters and crowdsourced sources', dysregulation: 'Source dropoff', expectedTypes: [{ type: 'SecureDrop / whistleblower platform', reason: 'SecureDrop, Hush Line, GlobaLeaks', confidence: 0.85 }] },
    'VV':        { fullName: 'Ventral Vagal Complex', label: 'Calm-State Long-Form Engine', tier: 'operational', function: 'Runs the calm, long-form journalism systems', dysregulation: 'Long-form decay', expectedTypes: [{ type: 'Long-form publishing platform', reason: 'The Atlantic, New Yorker, Substack long-form', confidence: 0.75 }] },
    'mPFC':      { fullName: 'Medial Prefrontal Cortex', label: 'Editorial Quality Engineering', tier: 'operational', function: 'Runs quality engineering across newsroom output', dysregulation: 'Quality regressions', expectedTypes: [{ type: 'Editorial QA service', reason: 'Internal newsroom QA processes', confidence: 0.72 }] },
    'rACC':      { fullName: 'Rostral Anterior Cingulate', label: 'Story Review & Quality Feedback', tier: 'operational', function: 'Runs story review and quality feedback across the newsroom', dysregulation: 'Review bottleneck', expectedTypes: [{ type: 'Editorial review tool', reason: 'Internal CMS review workflows', confidence: 0.72 }] },
    'vmPFC':     { fullName: 'Ventromedial Prefrontal Cortex', label: 'Editorial Tradeoff Decisions', tier: 'operational', function: 'Makes strategic editorial tradeoff decisions (cover vs. skip, depth vs. speed)', dysregulation: 'Decision paralysis', expectedTypes: [{ type: 'Editorial planning consultancy', reason: 'Helps editors make hard tradeoff calls', confidence: 0.72 }] }
  };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveApprovals(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
  function approvalKey(nodeId, businessType) { return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50); }
  function getApprovalStatus(nodeId, businessType) { return loadApprovals()[approvalKey(nodeId, businessType)] || null; }

  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status, reason: reason || '', nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(), reviewer: reviewerRole || 'operator'
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
        _hierarchyCache = cached; _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}
    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('communication');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = { nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {}, nodeLabels: {}, nodeDepths: {}, allActivations: [] };

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
          if (!result.nodeCompanies[nid][tk]) result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
        }
        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
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

  function getCommunicationState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('communication');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getCommunicationState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();
    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('communication') : null;
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
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Communication.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: this business type becomes eligible for future portal path mapping within Communication.';
          else consequence = 'If approved: this business type is recorded as a valid Communication mapping. Requires further validation.';
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) variantState = 'MISSING';
        else if (!alreadyMapped) variantState = 'PROPOSED';
        else variantState = 'MAPPED';

        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey, nodeId: nodeId, nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label, nodeFunction: dir.function, plainFunction: dir.function,
          dysregulation: dir.dysregulation || '', plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type, reason: expected.reason, confidence: expected.confidence,
          nodeActive: nodeActive, alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames, approval: approval,
          approvalRequired: showButtons, variantState: variantState,
          approvalConsequence: consequence, tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) { entry.bucket = 'MAPPED'; mapped.push(entry); }
        else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}, out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped); missing = dedupeExact(missing); speculative = dedupeExact(speculative);

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
    for (var i = 0; i < all.length; i++) if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    return approved;
  }

  window.LIMENCommunicationBusinessEngine = {
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

  loadFullHierarchy(function () { console.log('[CommunicationBusinessEngine] Hierarchy loaded'); });
  console.log('[CommunicationBusinessEngine] Loaded \u2014 103-node communication business engine');
})();
