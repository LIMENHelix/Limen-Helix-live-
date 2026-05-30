/**
 * religion-node-business-engine.js — Religion Node-to-Business Assignment Engine
 *
 * RELIGION DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (matches the locked-domain standard):
 *   - Recursively traverses ALL child portal JSONs (depth 0-5, ~18,200 files)
 *   - Covers full 103 operational nodes (19 RELIGION-TOP + 84 RELIGION-OPERATIONAL)
 *   - Excludes the same 20 RI / framework nodes as the locked domains
 *   - Filters generic template treatments before inference
 *
 * Outputs 3 buckets:
 *   MAPPED     - already mapped and active in Religion system
 *   MISSING    - plausible but missing from current Religion mappings
 *   SPECULATIVE - low-confidence or novel suggestions
 *
 * Approval statuses: PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_religion_business_approvals')
 *
 * Self-gates: only runs when ?domain=religion
 * Exposes: window.LIMENReligionBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'religion') return;

  var STORAGE_KEY = 'limen_religion_business_approvals';
  var STORAGE_VERSION_KEY = 'limen_religion_business_approvals_v';
  var STORAGE_VERSION = 2;
  var HIERARCHY_CACHE_KEY = 'limen_religion_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;
  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  // RI / FRAMEWORK NODES — same 20 excluded by all locked domains
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
  // 103-NODE RELIGION DIRECTORY (19 TOP + 84 OPERATIONAL)
  // ══════════════════════════════════════════════════════════════════════

  var NODE_DIRECTORY = {
    'DMN': {
      fullName: 'Default Mode Network', label: 'Religious Imagination & Theology', tier: 'top',
      neuroTranslation: { inNeurology: 'Generates internal narrative, self-referential thought, and imaginative simulation.', inBusiness: 'In religion, theological imagination is the engine of doctrine, apologetics, and comparative religion — the generative layer where belief systems are constructed, revised, and defended.' },
      function: 'Produces systematic theology, comparative religion scholarship, and apologetics',
      dysregulation: 'Doctrinal rigidity, theological echo chambers, inability to engage other traditions, fundamentalist literalism',
      expectedTypes: [
        { type: 'Systematic theology faculty and publishers', reason: 'Oxford University Press theology, Cambridge University Press religion, Baker Academic, Eerdmans, IVP Academic, Fortress Press — the scholarly publishing infrastructure of theological thought', confidence: 0.9 },
        { type: 'Comparative religion research institute', reason: 'Harvard Divinity School, Yale Divinity, University of Chicago Divinity, Georgetown ACMCU, Woolf Institute (Cambridge) — academic centers producing the comparative religion scholarship that shapes interfaith understanding', confidence: 0.88 },
        { type: 'Apologetics and evangelism organization', reason: 'Ravi Zacharias International Ministries (RZIM, under restructuring), Reasonable Faith (William Lane Craig), Desiring God (John Piper), The Gospel Coalition — organizations translating theology into public-facing intellectual engagement', confidence: 0.85 },
        { type: 'Digital theology platform', reason: 'Faithlife/Logos Bible Software, YouVersion Bible App, Olive Tree, Bible Gateway (Zondervan/HarperCollins Christian) — platforms delivering theological content to 500M+ users', confidence: 0.88 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Religious Institutional Strategy', tier: 'top',
      neuroTranslation: { inNeurology: 'Plans complex sequences, maintains working memory, and directs goal-oriented behavior.', inBusiness: 'In religion, institutional strategy covers denominational planning, church planting movements, and mission agency resource allocation.' },
      function: 'Directs denominational strategy, church planting, mission planning, and institutional resource allocation',
      dysregulation: 'Strategic drift, denominational bureaucratic paralysis, failed church plants, mission agency budget crises',
      expectedTypes: [
        { type: 'Church planting network', reason: 'Association of Related Churches (ARC), Stadia Church Planting, SEND Network (NAMB/SBC), Redeemer City to City (Tim Keller), Acts 29 — networks that fund and launch 3,000+ new churches annually in the U.S.', confidence: 0.92 },
        { type: 'Denominational strategy consultancy', reason: 'The Unstuck Group (church consulting), Barna Group (research-driven strategy), Lifeway Research, Auxano (Will Mancini), Vanderbloemen Search Group (church staffing)', confidence: 0.88 },
        { type: 'Mission planning agency', reason: 'International Mission Board (IMB/SBC), Cru (Campus Crusade), YWAM, OMF International, Wycliffe Bible Translators, SIL International — agencies deploying 100K+ missionaries globally', confidence: 0.9 },
        { type: 'Church management SaaS', reason: 'Planning Center Online (6M+ weekly users), Pushpay/Church Community Builder, Tithe.ly, Subsplash, Church Windows — the operational software layer for 300K+ congregations', confidence: 0.9 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Religious Authority & Orthodoxy Control', tier: 'top',
      neuroTranslation: { inNeurology: 'Monitors conflict and errors and signals when adjustment is needed.', inBusiness: 'In religion, authority and orthodoxy control is the enforcement layer — doctrinal enforcement, heresy detection, canonical law, and denominational discipline.' },
      function: 'Enforces doctrinal orthodoxy, manages heresy detection, administers canonical and ecclesiastical law',
      dysregulation: 'Inquisitorial overreach, theological witch hunts, abuse of ecclesiastical authority, cover-up of institutional failures',
      expectedTypes: [
        { type: 'Canon law and ecclesiastical court practice', reason: 'Catholic canon law firms, Rota Romana (Vatican tribunal), Church of England Ecclesiastical Courts, rabbinical courts (batei din), sharia courts — the judicial infrastructure of religious authority', confidence: 0.85 },
        { type: 'Denominational compliance and safeguarding', reason: 'Guidepost Solutions (SBC abuse investigation), Praesidium (abuse prevention), GRACE (Godly Response to Abuse in the Christian Environment), National Catholic Safeguarding Commission — institutional accountability infrastructure', confidence: 0.88 },
        { type: 'Doctrinal enforcement body', reason: 'Vatican Dicastery for the Doctrine of the Faith, SBC Credentials Committee, PCA Standing Judicial Commission, LCMS Commission on Theology, Al-Azhar fatwa committee — bodies that define and enforce orthodoxy', confidence: 0.82 },
        { type: 'Religious freedom legal defense', reason: 'Becket Fund for Religious Liberty, Alliance Defending Freedom (ADF), Liberty Counsel, American Center for Law and Justice (ACLJ) — legal organizations defending institutional religious authority in secular courts', confidence: 0.9 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Interfaith Dialogue & Ecumenism', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates attention and task control across regions in response to changing demands.', inBusiness: 'In religion, interfaith dialogue and ecumenism is the work of coordinating across religious traditions — the institutional infrastructure for inter-religious understanding.' },
      function: 'Coordinates interfaith dialogue, ecumenical councils, and inter-religious cooperation initiatives',
      dysregulation: 'Dialogue theater without substance, ecumenical fatigue, interfaith initiatives captured by political agendas',
      expectedTypes: [
        { type: 'Ecumenical council', reason: 'World Council of Churches (WCC, 352 member churches), Vatican Pontifical Council for Interreligious Dialogue (PCID), National Council of Churches USA, Churches Together in Britain and Ireland', confidence: 0.9 },
        { type: 'Interfaith organization', reason: 'Parliament of the World’s Religions, Interfaith Youth Core (Eboo Patel), King Abdullah bin Abdulaziz International Centre for Interreligious and Intercultural Dialogue (KAICIID), Tony Blair Faith Foundation, Religions for Peace', confidence: 0.88 },
        { type: 'Academic interfaith center', reason: 'Harvard Pluralism Project, Georgetown Berkley Center, Woolf Institute Cambridge, ISNA (Islamic Society of North America) interfaith programs', confidence: 0.85 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Religious Practice Execution', tier: 'top',
      neuroTranslation: { inNeurology: 'Executes voluntary motor commands with precision and timing.', inBusiness: 'In religion, practice execution is the operational layer — worship services, sacraments, rituals, pilgrimage logistics, and ceremonial operations.' },
      function: 'Executes worship services, sacraments, rituals, pilgrimage operations, and ceremonial programs',
      dysregulation: 'Liturgical chaos, sacramental irregularity, pilgrimage safety failures, worship war conflicts',
      expectedTypes: [
        { type: 'Worship technology provider', reason: 'Planning Center Services (worship scheduling), ProPresenter (Renewed Vision), EasyWorship, MediaShout, Proclaim (Faithlife) — software running 200K+ weekly worship services', confidence: 0.9 },
        { type: 'Pilgrimage operations company', reason: 'Saudi Ministry of Hajj (manages 2M+ annual Hajj pilgrims), Camino de Santiago hospitality network, Vatican Pilgrim Office, Kumbh Mela logistics (Indian government), Israel Ministry of Tourism Holy Land programs', confidence: 0.85 },
        { type: 'Church AV and production integrator', reason: 'CCI Solutions, Reach Communications, Mankin Media, Clark ProMedia — audiovisual integrators serving megachurches and large congregations', confidence: 0.82 }
      ]
    },
    'BROCA': {
      fullName: 'Broca’s Area', label: 'Religious Communication & Preaching', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured grammatical language and intentional speech.', inBusiness: 'In religion, communication and preaching is the transmission layer — sermons, religious broadcasting, publishing, and digital content that carries the message.' },
      function: 'Produces sermons, religious broadcasting, publishing, and digital religious content',
      dysregulation: 'Prosperity gospel distortion, cult-of-personality preaching, religious misinformation, broadcasting captured by political agendas',
      expectedTypes: [
        { type: 'Religious broadcasting network', reason: 'Trinity Broadcasting Network (TBN, largest religious TV network globally), Eternal Word Television Network (EWTN, Catholic), Daystar Television, CBN (700 Club), Al Jazeera religion programming, Vatican Media', confidence: 0.92 },
        { type: 'Religious publishing house', reason: 'HarperCollins Christian Publishing (Zondervan, Thomas Nelson), Crossway, Baker Publishing Group, Tyndale House, B&H Publishing (Lifeway/SBC), Dar al-Ifta (Islamic), Artscroll (Jewish)', confidence: 0.88 },
        { type: 'Religious podcast and digital content platform', reason: 'Pray.com, Hallow (Catholic prayer app), The Bible in a Year podcast (Fr. Mike Schmitz), RightNow Media (‘Netflix for churches’), Christianity Today podcast network', confidence: 0.85 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Sacred Text Networks & Scholarship', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multimodal information and supports semantic processing and reading comprehension.', inBusiness: 'In religion, sacred text networks encompass Bible, Quran, Torah, Vedas translation, textual criticism, digital scripture platforms, and scholarly commentary.' },
      function: 'Manages sacred text translation, textual criticism, digital scripture platforms, and scholarly commentary',
      dysregulation: 'Translation wars, textual criticism politicized, digital scripture platforms promoting fringe interpretations',
      expectedTypes: [
        { type: 'Bible translation and distribution', reason: 'Wycliffe Bible Translators, SIL International (linguistics), American Bible Society, United Bible Societies, Gideons International, Biblica (NIV publisher) — organizations translating scripture into 3,000+ languages', confidence: 0.92 },
        { type: 'Digital scripture platform', reason: 'YouVersion Bible App (Life.Church, 600M+ installs), Faithlife/Logos Bible Software, Olive Tree Bible Study, Quran.com, Sefaria (Jewish texts), Vedabase (ISKCON)', confidence: 0.9 },
        { type: 'Textual criticism and biblical studies', reason: 'Society of Biblical Literature (SBL), Tyndale House Cambridge, Dead Sea Scrolls Foundation, Institute for New Testament Textual Research (Münster)', confidence: 0.82 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Religious Finance & Stewardship', tier: 'top',
      neuroTranslation: { inNeurology: 'Makes strategic tradeoff decisions weighing expected outcomes against values.', inBusiness: 'In religion, finance and stewardship encompasses tithing systems, endowment management, waqf administration, zakat collection, church budgets, and institutional financial governance.' },
      function: 'Manages tithing, endowments, waqf, zakat, church budgets, Vatican Bank, and institutional financial governance',
      dysregulation: 'Financial mismanagement, endowment raids, tithing coercion, waqf corruption, Vatican Bank scandals',
      expectedTypes: [
        { type: 'Church giving technology', reason: 'Pushpay (digital giving for 14K+ churches), Tithe.ly (online giving + church management), Subsplash Giving, Vanco (faith-based payment processing), Givelify — platforms processing $10B+ in annual religious donations', confidence: 0.92 },
        { type: 'Religious endowment management', reason: 'Lilly Endowment ($18B+, largest religion-focused foundation), Templeton Foundation ($3.4B), Church Commissioners for England (£10B+), Vatican APSA, waqf authorities (Malaysia, Saudi Arabia, Turkey)', confidence: 0.88 },
        { type: 'Faith-based financial services', reason: 'GuideStone Financial Resources (SBC, $22B AUM), Wespath Benefits and Investments (UMC, $28B), Church Pension Group (Episcopal, $15B), Praxis Mutual Funds (faith-based investing)', confidence: 0.9 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Religious Tradition & Sacred Memory', tier: 'top',
      neuroTranslation: { inNeurology: 'Consolidates new memories and provides spatial-temporal context for experiences.', inBusiness: 'In religion, tradition and sacred memory encompasses liturgical calendar, hagiography, oral tradition, denominational history, and sacred site preservation.' },
      function: 'Preserves liturgical calendar, hagiography, oral tradition, denominational history, and sacred sites',
      dysregulation: 'Tradition ossification, hagiographic distortion, historical revisionism, sacred site destruction',
      expectedTypes: [
        { type: 'Sacred site preservation organization', reason: 'UNESCO World Heritage (religious sites), Aga Khan Trust for Culture (Islamic heritage), World Monuments Fund, ICOMOS, Church Buildings Council (England), National Trust for Historic Preservation (churches)', confidence: 0.88 },
        { type: 'Religious archives and history', reason: 'Vatican Apostolic Archive, Lambeth Palace Library, American Jewish Historical Society, Hartford Seminary archives, Amistad Research Center, Billy Graham Center Archives (Wheaton)', confidence: 0.82 },
        { type: 'Liturgical calendar and worship resource publisher', reason: 'Church Publishing (Episcopal), Augsburg Fortress (ELCA), GIA Publications (Catholic liturgical music), Hope Publishing, CCLI (Christian Copyright Licensing International)', confidence: 0.85 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Religious Ethics & Moral Reasoning', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains top-down executive control over goal-directed behavior.', inBusiness: 'In religion, ethics and moral reasoning encompasses bioethics, just war theory, social teaching, halakhah, sharia, and dharma — the normative frameworks that religious institutions apply to contemporary issues.' },
      function: 'Applies religious ethics to contemporary issues: bioethics, just war, social teaching, halakhah, sharia, dharma',
      dysregulation: 'Ethical relativism within traditions, moral reasoning disconnected from lived experience, ethics weaponized for political purposes',
      expectedTypes: [
        { type: 'Religious bioethics center', reason: 'National Catholic Bioethics Center, Park Ridge Center, Hastings Center (secular but religion-engaged), Islamic Bioethics Project, Jewish law and bioethics programs (Yeshiva University)', confidence: 0.85 },
        { type: 'Social teaching and justice organization', reason: 'Catholic Charities USA, Sojourners, Evangelicals for Social Action, Islamic Relief USA, American Jewish World Service, Tikkun Magazine, Catholic Social Teaching initiatives', confidence: 0.88 },
        { type: 'Religious law advisory', reason: 'Sharia advisory boards (AAOIFI for Islamic finance), Beth Din of America (Jewish law), Catholic canon law consultancies, Hindu dharma councils', confidence: 0.82 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Contemplative Practice & Mysticism', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports self-awareness, episodic memory retrieval, and visuospatial imagery.', inBusiness: 'In religion, contemplative practice and mysticism encompasses meditation, prayer, monasticism, Sufi dhikr, Zen zazen, Kabbalah, and the growing mindfulness industry.' },
      function: 'Supports meditation, prayer traditions, monasticism, Sufi dhikr, Zen zazen, Kabbalah, and mindfulness industry',
      dysregulation: 'Spiritual bypassing, meditation commercialization stripping religious context, monastic decline',
      expectedTypes: [
        { type: 'Meditation and mindfulness platform', reason: 'Headspace, Calm, Insight Timer, Hallow (Catholic), Pray.com, 10% Happier — platforms serving the $5B+ mindfulness market with varying degrees of religious grounding', confidence: 0.9 },
        { type: 'Monastic and retreat center network', reason: 'Trappist monasteries (OCSO), Zen Mountain Monastery, Spirit Rock Meditation Center, Gethsemani Abbey, Taizé Community, Plum Village (Thich Nhat Hanh), Kabbalah Centre', confidence: 0.82 },
        { type: 'Contemplative prayer organization', reason: 'Contemplative Outreach (Centering Prayer, Thomas Keating), World Community for Christian Meditation, Shalem Institute, Center for Action and Contemplation (Richard Rohr)', confidence: 0.8 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Religious Community & Pastoral Care', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates homeostasis, stress response, and basic survival drives.', inBusiness: 'In religion, community and pastoral care is the homeostatic function — parish life, congregational health, chaplaincy, spiritual direction, and the day-to-day care of religious communities.' },
      function: 'Manages parish life, congregational health, chaplaincy, spiritual direction, and pastoral care',
      dysregulation: 'Pastoral burnout, congregational conflict, clergy misconduct, chaplaincy underfunding',
      expectedTypes: [
        { type: 'Chaplaincy service provider', reason: 'Association of Professional Chaplains, National Association of Catholic Chaplains, Neshama Association of Jewish Chaplains, ACPE (Clinical Pastoral Education), Corporate Chaplains of America', confidence: 0.88 },
        { type: 'Congregational health consultancy', reason: 'Barna Group (church health research), Hartford Institute for Religion Research, Natural Church Development (NCD), Healthy Church Solutions, VitalChurch Ministry', confidence: 0.85 },
        { type: 'Pastoral counseling and spiritual direction', reason: 'American Association of Pastoral Counselors, Shalem Institute, Spiritual Directors International, Renovaré (Richard Foster), AAPC-affiliated training centers', confidence: 0.82 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Religious Economics & Sacred Markets', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates expected value of choices and updates preferences based on outcomes.', inBusiness: 'In religion, religious economics encompasses Christian publishing, halal economy, kosher certification, faith-based investing, and the commercial infrastructure of religious practice.' },
      function: 'Manages religious publishing, halal economy, kosher certification, faith-based investing, and sacred commerce',
      dysregulation: 'Prosperity gospel commodification, halal certification fraud, kosher supervision scandals, predatory faith-based financial products',
      expectedTypes: [
        { type: 'Halal economy platform', reason: 'Halal Industry Development Corporation (Malaysia), UAE Halal Certification, JAKIM, Majelis Ulama Indonesia (MUI) — certifiers for the $2.3T global halal economy spanning food, finance, pharma, and cosmetics', confidence: 0.9 },
        { type: 'Kosher certification agency', reason: 'Orthodox Union (OU, largest kosher certifier), OK Kosher, Star-K, Kof-K, Chicago Rabbinical Council (cRc) — agencies certifying $250B+ in annual kosher product sales', confidence: 0.88 },
        { type: 'Christian retail and publishing', reason: 'HarperCollins Christian Publishing ($250M+ revenue), LifeWay Christian Resources, Mardel Christian & Education, Hobby Lobby (faith-based retail), Chick-fil-A Foundation (faith-driven corporate philanthropy)', confidence: 0.88 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Religious Demographics & Church Growth', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes numerical magnitude, spatial attention, and quantitative reasoning.', inBusiness: 'In religion, demographics and church growth encompasses Pew Research Center religion studies, ARDA data, church growth statistics, and the quantitative analysis of religious participation.' },
      function: 'Tracks religious demographics, church growth statistics, and quantitative participation analysis',
      dysregulation: 'Demographic denial, inflated membership reporting, growth metrics gamed for institutional prestige',
      expectedTypes: [
        { type: 'Religious demographics research', reason: 'Pew Research Center Religion & Public Life (the reference standard for U.S. and global religious demographics), ARDA (Association of Religion Data Archives), Barna Group, Lifeway Research, World Christian Database (Gordon-Conwell)', confidence: 0.92 },
        { type: 'Church growth analytics', reason: 'Hartford Institute for Religion Research (National Congregations Study), Faith Communities Today (FACT), Church Answers (Thom Rainer), Exponential (church multiplication), Outreach Magazine 100 Largest/Fastest-Growing lists', confidence: 0.88 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Religious Sensing & Sentiment Detection', tier: 'top',
      neuroTranslation: { inNeurology: 'Receives visceral sensory input and relays autonomic state information.', inBusiness: 'In religion, sensing and sentiment detection encompasses religious freedom monitoring, persecution tracking, and sentiment analysis of religious discourse.' },
      function: 'Monitors religious freedom conditions, persecution events, and sentiment shifts in religious discourse',
      dysregulation: 'Persecution claims inflated for fundraising, sentiment analysis capturing noise not signal, monitoring gaps in closed societies',
      expectedTypes: [
        { type: 'Religious freedom monitoring body', reason: 'U.S. Commission on International Religious Freedom (USCIRF), IRF Ambassador (State Department), Pew Research Center Government Restrictions Index, Forum 18 (Norway)', confidence: 0.92 },
        { type: 'Persecution tracking organization', reason: 'Open Doors World Watch List (ranks 50 worst countries), International Christian Concern (ICC), Aid to the Church in Need, Voice of the Martyrs, Barnabas Fund, CSW (Christian Solidarity Worldwide)', confidence: 0.9 },
        { type: 'Religious sentiment analytics', reason: 'Pew Research Center social media religion analysis, ARDA sentiment tools, Brandwatch/Cision religion topic tracking, Meltwater religious discourse monitoring', confidence: 0.78 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Missionary Activity & Proselytism', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports perspective-taking and theory of mind — understanding others’ viewpoints.', inBusiness: 'In religion, missionary activity and proselytism is the outward-facing growth engine — mission agencies, church planting movements, Bible translation, and the global expansion of religious traditions.' },
      function: 'Deploys mission agencies, church planting movements, Bible translation, and proselytism operations',
      dysregulation: 'Cultural imperialism in missions, proselytism provoking backlash, anti-conversion laws, missionary safety failures',
      expectedTypes: [
        { type: 'Mission sending agency', reason: 'International Mission Board (IMB/SBC, 3,600+ missionaries), Cru (Campus Crusade, 20K+ staff), YWAM (Youth With A Mission), OMF International, Pioneers, Frontiers, SIM — agencies deploying to 190+ countries', confidence: 0.92 },
        { type: 'Bible translation organization', reason: 'Wycliffe Bible Translators, SIL International (linguistics research), American Bible Society, United Bible Societies, The Seed Company, Faith Comes By Hearing (audio scripture)', confidence: 0.9 },
        { type: 'Church planting movement', reason: 'Association of Related Churches (ARC), Stadia, SEND Network (NAMB), Redeemer City to City, New Thing Network, Exponential (church multiplication conference)', confidence: 0.88 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate Cortex', label: 'Religious Freedom & Persecution Response', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates emotional significance and regulates affective responses.', inBusiness: 'In religion, religious freedom and persecution response encompasses USCIRF, IRF Ambassador, Open Doors, persecution monitoring, and the legal and advocacy infrastructure for defending religious liberty.' },
      function: 'Defends religious freedom, monitors persecution, and advocates for religious liberty through legal and diplomatic channels',
      dysregulation: 'Religious freedom claims weaponized against other rights, persecution metrics gamed for fundraising, advocacy disconnected from affected communities',
      expectedTypes: [
        { type: 'Religious freedom legal organization', reason: 'Becket Fund for Religious Liberty, Alliance Defending Freedom (ADF, $100M+ annual budget), Liberty Counsel, ACLJ (Jay Sekulow), First Liberty Institute, International Religious Freedom Roundtable', confidence: 0.92 },
        { type: 'Government religious freedom body', reason: 'USCIRF (U.S. Commission on International Religious Freedom), IRF Ambassador (State Department Office of International Religious Freedom), UK FORB Envoy, EU Special Envoy for FoRB', confidence: 0.9 },
        { type: 'Persecution response organization', reason: 'Open Doors (World Watch List), International Christian Concern, CSW, Barnabas Fund, Voice of the Martyrs, Aid to the Church in Need, Jubilee Campaign', confidence: 0.88 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke’s Area', label: 'Religious Technology & Digital Ministry', tier: 'top',
      neuroTranslation: { inNeurology: 'Comprehends language and processes semantic meaning from auditory and written input.', inBusiness: 'In religion, technology and digital ministry encompasses church management software, streaming worship platforms, AI-assisted theology, and the digital transformation of religious institutions.' },
      function: 'Builds church management software, streaming worship platforms, AI-assisted theology tools, and digital ministry infrastructure',
      dysregulation: 'Technology replacing genuine community, AI-generated sermons lacking pastoral authenticity, digital divide excluding elderly congregants',
      expectedTypes: [
        { type: 'Church management SaaS', reason: 'Planning Center Online (scheduling, giving, check-in for 70K+ churches), Pushpay/Church Community Builder ($200M+ revenue), Tithe.ly (giving + church apps), Subsplash, Realm (ACS Technologies), Breeze ChMS', confidence: 0.92 },
        { type: 'Worship streaming platform', reason: 'Church Online Platform (Life.Church, free), Resi Media (streaming), BoxCast, Livestream/Vimeo OTT, YouTube Live (used by 100K+ congregations), Facebook Live worship', confidence: 0.88 },
        { type: 'AI and digital theology tool', reason: 'Faithlife/Logos Bible Software (AI-powered biblical research), Gloo (church data platform backed by Hobby Lobby family), MinistryPlatform, Text in Church (church SMS), Churchteams', confidence: 0.82 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Clergy & Religious Worker Pipeline', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays auditory information from the inferior colliculus to the auditory cortex.', inBusiness: 'In religion, the clergy and religious worker pipeline encompasses seminary education, ordination processes, ministerial formation, and the supply chain of trained religious professionals.' },
      function: 'Manages seminary education, ordination processes, ministerial formation, and clergy workforce development',
      dysregulation: 'Seminary enrollment collapse, ordination bottleneck, clergy burnout epidemic, bivocational ministry normalization from financial necessity',
      expectedTypes: [
        { type: 'Seminary and theological school', reason: 'Fuller Theological Seminary, Gordon-Conwell, Duke Divinity School, Princeton Theological Seminary, Southern Baptist Theological Seminary, Catholic Theological Union, Jewish Theological Seminary, Hartford International University — ATS (Association of Theological Schools) accredits 270+ institutions', confidence: 0.92 },
        { type: 'Clergy placement and search firm', reason: 'Vanderbloemen Search Group (largest church staffing firm), Slingshot Group, Chemistry Staffing, National Association of Church Personnel Administrators (NACPA)', confidence: 0.85 },
        { type: 'Clergy wellness and formation program', reason: 'Lilly Endowment Thriving in Ministry initiative ($93M), Duke Clergy Health Initiative, Fuller De Pree Center, Pastors.com (Saddleback)', confidence: 0.82 }
      ]
    },
    'OP_CATH_GOV': {
      fullName: 'Catholic Institutional Governance', label: 'Vatican & Diocesan Administration', tier: 'operational',
      neuroTranslation: { inNeurology: 'Central executive hub coordinating long-range institutional policy, resource allocation, and hierarchical command across a massive distributed network.', inBusiness: 'The Vatican Curia and diocesan system is the central nervous system of Catholicism — 1.3B members governed through a hierarchical structure from Rome through national conferences to individual dioceses. When governance fails, the entire downstream system loses coherence.' },
      function: 'Manages Vatican Curia, diocesan operations, and Catholic institutional governance',
      dysregulation: 'Vatican financial scandals (IOR bank investigations, Becciu trial), diocesan bankruptcy filings (27+ U.S. dioceses), governance paralysis during papal transitions, cover-up of abuse by bishops, parish merger resistance',
      expectedTypes: [
        { type: 'Vatican & Diocesan Administration', reason: 'Vatican Dicasteries, USCCB (U.S. Conference of Catholic Bishops), Catholic Health Association, Catholic Charities USA ($4.7B annual revenue), Knights of Columbus ($114B insurance in force)', confidence: 0.85 },
        { type: 'Diocesan chancery and parish pastoral council operations', reason: 'Chancery offices (vicar general, chancellor, tribunal officials) administer each of 196 U.S. dioceses. Canon law requires parish finance councils; pastoral councils recommended. Formation and oversight of these bodies is a native Catholic governance function distinct from Vatican-level Curia operations.', confidence: 0.8 },
        { type: 'Catholic sacramental records and canonical registry systems', reason: 'Every Catholic baptism, confirmation, marriage, and burial must be recorded in parish registers per canon law. Diocesan archives maintain centuries of records. Sacramental record management is a uniquely Catholic institutional function that underpins annulment proceedings, canonical status verification, and genealogical research.', confidence: 0.75 }
      ]
    },
    'OP_CATH_ED': {
      fullName: 'Catholic Education Network', label: 'Catholic Schools & Universities', tier: 'operational',
      neuroTranslation: { inNeurology: 'Long-term knowledge consolidation and cultural transmission — encodes institutional memory and reproduces it across generations through structured learning.', inBusiness: 'Catholic education is the largest private school system on earth — 210K+ schools, 6M+ U.S. students. It reproduces Catholic culture, trains leaders, and generates tuition revenue sustaining parishes. When enrollment drops, parishes lose their anchor institution.' },
      function: 'Operates Catholic K-12 schools and university systems globally',
      dysregulation: 'School closures in Northeast/Midwest (300+ since 2020), tuition affordability crisis, declining religious sisters as teachers, Title IX conflicts at Catholic universities, Ex Corde Ecclesiae compliance disputes',
      expectedTypes: [
        { type: 'Catholic Schools & Universities', reason: 'National Catholic Educational Association (5,600+ schools), Georgetown, Notre Dame, Boston College, Loyola, DePaul, Catholic University — plus Vatican Congregation for Catholic Education overseeing 210K+ schools worldwide', confidence: 0.85 },
        { type: 'Catholic catechetical and faith formation programs', reason: 'RCIA (Rite of Christian Initiation of Adults), CCD/religious education, sacramental preparation (First Communion, Confirmation) — parish-level faith formation programs distinct from the K-12/university school system. National Directory for Catechesis (USCCB) sets standards. Catechist formation is a native Catholic educational pipeline.', confidence: 0.8 }
      ]
    },
    'OP_CATH_REL': {
      fullName: 'Catholic Religious Orders', label: 'Religious Orders & Congregations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Specialized processing clusters operating semi-autonomously — each optimized for a distinct function but reporting to central authority.', inBusiness: 'Religious orders are Catholicism\'s specialized units — Jesuits run universities, Franciscans run social services, Benedictines run monasteries. Their decline (median age 70+, few vocations) threatens the institutions they built.' },
      function: 'Manages Jesuit, Franciscan, Dominican, Benedictine, and other religious order operations',
      dysregulation: 'Vocation crisis (average age of women religious 80+), order mergers and suppressions, monastery closures, property disposition of former convents, contested charism after founder scandals (Legionaries of Christ/Maciel)',
      expectedTypes: [
        { type: 'Religious Orders & Congregations', reason: 'Society of Jesus (Jesuits, 14K+ members), Order of Friars Minor (Franciscans), Order of Preachers (Dominicans), Benedictine Confederation, Sisters of Mercy, Daughters of Charity — orders managing hospitals, schools, and social services globally', confidence: 0.85 },
        { type: 'Religious order vocation recruitment and formation programs', reason: 'Novitiate, postulancy, and formation houses where candidates enter religious life. National Religious Vocation Conference (NRVC), VISION Vocation Network, individual order vocation offices. The vocation pipeline is the existential challenge — median age 80+ for women religious. This is the reproduction function of the orders, distinct from their institutional operations.', confidence: 0.78 }
      ]
    },
    'OP_CATH_ABUSE': {
      fullName: 'Catholic Abuse Response', label: 'Abuse Accountability & Victim Services', tier: 'operational',
      neuroTranslation: { inNeurology: 'Immune surveillance and damage response circuit — detects internal threats, initiates repair cascades, and signals systemic vulnerability.', inBusiness: 'Abuse accountability is the immune system of religious institutions. Catholic settlements exceed $4B in the U.S., with 27+ dioceses in bankruptcy. Demand is permanent: forensic investigation, victim representation, reform consulting, and insurance underwriting.' },
      function: 'Manages abuse investigation, victim compensation, and institutional reform',
      dysregulation: 'Cover-up by bishops (McCarrick, Pell), statute of limitations reform exposing decades of claims, diocesan bankruptcy as litigation strategy, victim re-traumatization, insurance carrier withdrawal',
      expectedTypes: [
        { type: 'Abuse Accountability & Victim Services', reason: 'SNAP (Survivors Network of those Abused by Priests), BishopAccountability.org, Pontifical Commission for the Protection of Minors, state AG investigations (Pennsylvania Grand Jury, Illinois, Maryland), Jeff Anderson & Associates (plaintiff law)', confidence: 0.85 },
        { type: 'Diocesan review board and safe environment compliance', reason: 'Dallas Charter (2002) mandated diocesan review boards, safe environment training for all church volunteers, and background checks. VIRTUS (National Catholic Risk Retention Group) provides the training platform. Annual USCCB audit of diocesan compliance. This is the native Catholic safeguarding infrastructure, distinct from external investigation and victim advocacy.', confidence: 0.82 }
      ]
    },
    'OP_SBC': {
      fullName: 'Southern Baptist Convention Operations', label: 'SBC Denominational Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Large-scale distributed network with voluntary cooperative architecture — each node autonomous but contributing to shared mission through a cooperative program.', inBusiness: 'The SBC (13M+ members, 47K+ churches) operates through a cooperative model. When trust collapses (2022 Guidepost abuse report), the entire funding pipeline contracts.' },
      function: 'Manages SBC cooperative program, mission boards, and denominational infrastructure',
      dysregulation: 'Abuse scandal (2022 Guidepost report), Cooperative Program giving decline, conservative-moderate warfare, missionary recall due to budget shortfalls, seminary enrollment pressure, pastoral burnout',
      expectedTypes: [
        { type: 'SBC Denominational Operations', reason: 'Southern Baptist Convention (13M+ members, 47K+ churches), International Mission Board (IMB), North American Mission Board (NAMB), Lifeway Christian Resources, GuideStone Financial Resources ($22B AUM), six SBC seminaries', confidence: 0.85 },
        { type: 'SBC associational and state convention operations', reason: 'The SBC operates through 1,200+ local associations and 41 state conventions that serve as connective tissue between 47K+ churches and the national body. Associational missionaries, state convention staff, cooperative program allocation — these are denominational-native intermediary structures with their own governance and budgets.', confidence: 0.8 },
        { type: 'SBC seminary and ministerial credentialing', reason: 'Six SBC seminaries (Southern, Southeastern, Southwestern, Midwestern, New Orleans, Gateway) train the pastoral pipeline. Total enrollment 15K+. SBC has no formal ordination requirement but seminary education and associational endorsement are de facto credentialing. The seminaries are the doctrinal gatekeepers of the denomination.', confidence: 0.78 }
      ]
    },
    'OP_UMC': {
      fullName: 'United Methodist Operations', label: 'UMC & Post-Split Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Network undergoing active schism — previously integrated circuits severing connections, requiring complete infrastructure duplication on both sides.', inBusiness: 'The UMC split is the largest denominational fracture in a generation. 7,600+ congregations disaffiliated over LGBTQ+ issues. Both sides must build parallel pension, publishing, and mission infrastructure — years of legal and financial consulting demand.' },
      function: 'Manages UMC restructuring and Global Methodist Church formation',
      dysregulation: 'Property litigation over trust clause, pension fund actuarial stress from split, congregational vote disputes, clergy reassignment chaos, loss of institutional identity',
      expectedTypes: [
        { type: 'UMC & Post-Split Operations', reason: 'United Methodist Church (6.2M U.S. members post-split), Global Methodist Church (new denomination from 7,600+ disaffiliated churches), Wespath Benefits ($28B), United Methodist Publishing House, Africa University, 100+ UMC-related institutions', confidence: 0.85 },
        { type: 'United Methodist itinerant clergy appointment system', reason: 'The UMC uniquely appoints pastors to churches through the bishop and cabinet (district superintendents) — pastors do not apply to churches. Post-split, both UMC and Global Methodist must rebuild appointment systems. Clergy itinerancy is a native Methodist governance mechanism with no Protestant parallel at this scale.', confidence: 0.8 },
        { type: 'Wespath pension and post-split benefits division', reason: 'Wespath Benefits and Investments ($28B) manages clergy pensions, health insurance, and disability for the UMC. The split requires actuarial division, benefit portability, and parallel system construction for Global Methodist. This is a denomination-native financial infrastructure challenge.', confidence: 0.78 }
      ]
    },
    'OP_EVAN_MEGA': {
      fullName: 'Evangelical Megachurch Operations', label: 'Megachurch & Multi-Site Networks', tier: 'operational',
      neuroTranslation: { inNeurology: 'High-output charismatic nodes dominating regional processing through throughput and media amplification — personality-driven, high-energy, high-risk.', inBusiness: 'Megachurches run $50M+ budgets, employ hundreds, and collapse overnight when the founding pastor falls. The business model depends on personality and production quality — creating demand for AV, branding, executive coaching, and succession planning.' },
      function: 'Manages megachurch operations, multi-site campuses, and associated media empires',
      dysregulation: 'Pastoral scandal cascade (Mars Hill, Hillsong, Harvest, Gateway/Robert Morris), financial opacity, personality-cult governance, staff burnout, multi-site fatigue, succession failure',
      expectedTypes: [
        { type: 'Megachurch & Multi-Site Networks', reason: 'Life.Church (Craig Groeschel, YouVersion Bible App), Elevation Church (Steven Furtick), Saddleback Church, Hillsong (post-scandal restructuring), Church of the Highlands, Transformation Church (Michael Todd), Gateway Church — 50+ U.S. megachurches averaging 10K+ weekly attendance', confidence: 0.85 },
        { type: 'Megachurch elder board governance and pastoral succession', reason: 'Independent megachurches lack denominational oversight. Elder/deacon boards are the only governance layer. When founding pastors fall (Mars Hill, Hillsong, Gateway), the board is the institution that must respond — or fails to. Succession planning, board training, and independent church governance are native institutional needs.', confidence: 0.8 },
        { type: 'Multi-site campus pastoral staffing and worship production', reason: 'Multi-site churches operate 5-50+ campuses with campus pastors, centralized sermon video, and production teams. The staffing model (campus pastor vs. teaching pastor vs. executive pastor), worship production infrastructure, and brand management are native to the megachurch operating model.', confidence: 0.78 }
      ]
    },
    'OP_PENT': {
      fullName: 'Pentecostal/Charismatic Operations', label: 'Pentecostal & Charismatic Movement', tier: 'operational',
      neuroTranslation: { inNeurology: 'High-arousal emotionally-driven processing — prioritizes experiential intensity and rapid propagation over deliberative analysis. Fastest-growing subsystem.', inBusiness: 'Pentecostalism grew from zero in 1900 to 600M+ adherents. Its engine is experiential worship, decentralized planting, and prosperity theology. Generates massive demand for worship technology, conference infrastructure, and broadcasting.' },
      function: 'Manages Pentecostal denominations and charismatic movement operations',
      dysregulation: 'Prosperity gospel exploitation, accountability vacuums in independent churches, faith healing fraud, IHOPKC abuse scandal (Mike Bickle), theological drift',
      expectedTypes: [
        { type: 'Pentecostal & Charismatic Movement', reason: 'Assemblies of God (69M+ members globally), Church of God in Christ (COGIC, 6.5M U.S.), International Church of the Foursquare Gospel, Vineyard USA, Bethel Church (Redding, CA), IHOPKC (International House of Prayer)', confidence: 0.85 },
        { type: 'Pentecostal Bible college and ministerial credentialing', reason: 'Assemblies of God operates 20+ endorsed Bible colleges and universities (Southeastern, North Central, Vanguard). COGIC has Saints Academy and C.H. Mason Seminary. Credentialing happens through denominational district councils. This is the native clergy formation pipeline for 600M+ Pentecostals.', confidence: 0.8 },
        { type: 'Pentecostal camp meeting and revival conference operations', reason: 'Camp meetings, revival conferences, and worship gatherings (Azusa Now, Brownsville-style revivals, Bethel conferences, Hillsong Conference) are native Pentecostal institutional events that drive attendance, donation, music sales, and movement identity. The event IS the institution in charismatic Christianity.', confidence: 0.75 }
      ]
    },
    'OP_MAINLINE': {
      fullName: 'Mainline Protestant Operations', label: 'Mainline Denominational Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Legacy processing infrastructure with declining throughput — once-dominant circuits managing graceful degradation and asset reallocation as capacity contracts.', inBusiness: 'Mainline Protestantism built American civic infrastructure. Now losing 1M+ members annually, the contraction itself is the business opportunity: church closure services, property disposition, pension management, restructuring.' },
      function: 'Manages PCUSA, ELCA, Episcopal, UCC, Disciples, and ABC-USA operations',
      dysregulation: 'Membership free-fall (50%+ since 1960s), clergy pension stress, church closure at 1,000+/year, property maintenance backlogs, endowment spend-down',
      expectedTypes: [
        { type: 'Mainline Denominational Management', reason: 'Presbyterian Church (USA) (1.1M members), Evangelical Lutheran Church in America (ELCA, 3M), Episcopal Church (1.6M), United Church of Christ (770K), Christian Church (Disciples), American Baptist Churches — all managing structural contraction', confidence: 0.85 },
        { type: 'Mainline clergy pension and benefits systems', reason: 'Board of Pensions (PCUSA), Portico (ELCA), Church Pension Group (Episcopal, $15B), MMBB (ABC-USA) — each manages clergy retirement, health, and disability. With declining membership, these funds face actuarial stress. Pension management is a native denominational function distinct from general operations.', confidence: 0.82 },
        { type: 'Mainline church closure and property stewardship', reason: 'Denominational property trustees manage the disposition of closing churches — 1,000+ mainline churches close annually. Presbyterian trust clause, Episcopal diocesan property canon, ELCA synod property oversight. The closure process (deconsecration, asset transfer, building sale/conversion) is a native denominational lifecycle function.', confidence: 0.78 }
      ]
    },
    'OP_ORTHODOX': {
      fullName: 'Orthodox Christian Operations', label: 'Orthodox Patriarchates & Jurisdictions', tier: 'operational',
      neuroTranslation: { inNeurology: 'Ancient processing architecture with rigid hierarchy — maintains stability through unchanging protocols but vulnerable to geopolitical disruption at inter-node level.', inBusiness: 'Orthodox Christianity\'s autocephalous structure fractures when geopolitics severs communion — as Russia-Ukraine severed Moscow from Constantinople. Business impact flows through diaspora communities, theological education, and diplomatic channels.' },
      function: 'Manages Ecumenical Patriarchate, Moscow Patriarchate, and autocephalous church operations',
      dysregulation: 'Moscow-Constantinople schism over Ukrainian autocephaly, Russian Orthodox as Kremlin instrument, jurisdictional overlap in diaspora, Ecumenical Patriarchate financial fragility',
      expectedTypes: [
        { type: 'Orthodox Patriarchates & Jurisdictions', reason: 'Ecumenical Patriarchate of Constantinople, Russian Orthodox Church (Moscow Patriarchate, 100M+ members), Orthodox Church of Ukraine (autocephaly dispute), Greek Orthodox Archdiocese of America, Antiochian Orthodox, OCA, Assembly of Canonical Bishops', confidence: 0.85 },
        { type: 'Orthodox theological seminary and clergy formation', reason: 'Holy Cross Greek Orthodox School of Theology, St. Vladimir Orthodox Theological Seminary, St. Tikhon Seminary, Jordanville Holy Trinity Seminary — the Orthodox clergy pipeline in the West. Moscow Theological Academy trains Russian clergy. Each autocephalous church has independent formation. Seminary accreditation through ATS.', confidence: 0.82 },
        { type: 'Orthodox parish life and liturgical practice administration', reason: 'Orthodox parish operations center on the Divine Liturgy — iconography, chanting (no instruments), vestment production, liturgical calendar management, fasting cycle coordination. Pan-Orthodox parish councils (Assembly of Canonical Bishops in USA) manage jurisdictional coordination. This is the worship-native institutional layer.', confidence: 0.78 }
      ]
    },
    'OP_SUNNI': {
      fullName: 'Sunni Institutional Operations', label: 'Sunni Leadership & Al-Azhar Network', tier: 'operational',
      neuroTranslation: { inNeurology: 'Diffuse authority network with no single command node — consensus emerges from competing scholarly centers each claiming interpretive legitimacy.', inBusiness: 'Sunni Islam has no pope. Authority is distributed across Al-Azhar, Diyanet, Saudi Grand Mufti, and OIC. Competition drives theological publishing, fatwa issuance, and institutional investment.' },
      function: 'Manages Sunni institutional authority, Al-Azhar scholarship, and Sunni governance structures',
      dysregulation: 'Al-Azhar-Saudi rivalry, Turkish neo-Ottoman expansion via Diyanet, fatwa inconsistency across jurisdictions, co-optation by authoritarian states, youth radicalization outside institutions',
      expectedTypes: [
        { type: 'Sunni Leadership & Al-Azhar Network', reason: 'Al-Azhar University and Grand Imam (Cairo, 1,000-year institution, Sunni reference authority), Diyanet (Turkey, 100K+ employees), Saudi Grand Mufti, Organisation of Islamic Cooperation (OIC, 57 states), Muslim World League (Makkah)', confidence: 0.85 },
        { type: 'State-operated imam training and mosque supervision', reason: 'Diyanet (Turkey) trains and deploys 100K+ imams with state salary. Egypt licenses khatibs through Al-Azhar certification. Saudi Arabia controls mosque sermon content through Ministry of Islamic Affairs. Each country has a native imam credentialing pipeline that is the clergy formation layer of Sunni Islam.', confidence: 0.82 },
        { type: 'Dar al-Ifta and national fatwa issuance bodies', reason: 'Egypt Dar al-Ifta, Saudi Grand Mufti office, Malaysia JAKIM fatwa committee, Indonesia MUI — national fatwa bodies that issue binding or advisory rulings on contemporary questions. This is the doctrinal adjudication function of Sunni Islam, distinct from institutional authority structures.', confidence: 0.78 }
      ]
    },
    'OP_SHIA': {
      fullName: 'Shia Institutional Operations', label: 'Shia Seminaries & Marji Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Hierarchical authority chain where individual nodes (marjas) attract voluntary allegiance — followers choose which authority to follow, creating competing influence networks.', inBusiness: 'Shia Islam operates through the marja system — senior clerics whose followers pay khums (20% tax) funding seminaries and political operations. Sistani\'s office commands billions. Succession reshuffles funding flows across the entire Shia world.' },
      function: 'Manages Shia hawza seminary system, marja authority, and Shia institutional networks',
      dysregulation: 'Najaf-Qom rivalry, Iranian regime instrumentalization (velayat-e faqih), Sistani succession crisis (age 93+), Hezbollah as parallel governance, sectarian militia funding through religious channels',
      expectedTypes: [
        { type: 'Shia Seminaries & Marji Operations', reason: 'Najaf hawza (Iraq, Grand Ayatollah Sistani), Qom seminary (Iran), Khamenei office (Supreme Leader), Hezbollah social services network, Iraqi Shia shrine endowments (Karbala, Najaf), Bahraini Shia community organizations', confidence: 0.85 },
        { type: 'Shia shrine administration and pilgrimage endowments', reason: 'Karbala and Najaf shrine endowments (Iraq, billions in assets), Mashhad Imam Reza shrine (Iran, Astan Quds Razavi foundation controls massive economic empire), Qom shrine complex — shrine administration is a native Shia institutional function combining pilgrimage logistics, endowment management, and religious authority.', confidence: 0.82 },
        { type: 'Hussainiyya and Shia mourning ritual infrastructure', reason: 'Hussainiyyat (congregation halls) host Muharram/Ashura mourning rituals for millions globally. Procession logistics, matam (ritual mourning) organization, Arbaeen pilgrimage coordination (20M+ walk to Karbala annually — largest annual gathering on earth). This is Shia-native ritual infrastructure with no Sunni parallel.', confidence: 0.8 }
      ]
    },
    'OP_ISLAMIC_FIN': {
      fullName: 'Islamic Finance Operations', label: 'Islamic Banking & Sharia-Compliant Finance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Parallel processing pathway handling the same inputs through an alternative rule set — generating equivalent outputs under different constraints.', inBusiness: 'Islamic finance ($3.9T) processes capital allocation through sharia-compliant structures. Every conventional product needs a sharia equivalent, creating permanent consulting and structuring markets.' },
      function: 'Manages Islamic banking, sukuk markets, takaful insurance, and sharia advisory',
      dysregulation: 'Sharia board independence concerns, sukuk default (Dana Gas), takaful undercapitalization, regulatory inconsistency between Malaysian and GCC standards, form-over-substance allegations',
      expectedTypes: [
        { type: 'Islamic Banking & Sharia-Compliant Finance', reason: 'AAOIFI (Accounting and Auditing Organization for Islamic Financial Institutions), Islamic Development Bank (IsDB, $40B+), Al Rajhi Bank, Kuwait Finance House, Dubai Islamic Bank, Malaysian Islamic finance ecosystem (Bank Negara Malaysia sharia framework)', confidence: 0.85 },
        { type: 'Sharia supervisory board and Islamic jurisprudence for finance', reason: 'Every Islamic bank and sukuk issuance requires sharia board approval. AAOIFI certifies scholars. Boards review product structures against fiqh rulings. Scholar independence (sitting on multiple boards), fatwa consistency, and sharia audit are native religious governance functions within the financial system.', confidence: 0.82 }
      ]
    },
    'OP_HAJJ': {
      fullName: 'Hajj & Umrah Operations', label: 'Pilgrimage Logistics & Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Massive periodic synchronization — millions converge on a single location in precisely timed sequence, requiring extreme coordination and resource marshaling.', inBusiness: 'Hajj is the largest annual human gathering — 2M+ pilgrims in 5 days. Saudi Arabia invested $100B+ in infrastructure. The logistics, technology, and hospitality demand is permanent and growing.' },
      function: 'Manages Hajj and Umrah pilgrimage logistics for 2M+ annual pilgrims',
      dysregulation: 'Stampede disasters (2015 Mina, 2,400+ dead), heat casualties, pandemic closures (2020-2021), visa fraud, construction accidents, crowd management failures',
      expectedTypes: [
        { type: 'Pilgrimage Logistics & Management', reason: 'Saudi Ministry of Hajj and Umrah, Saudi General Authority of Civil Aviation (pilgrimage flights), Makkah Royal Clock Tower (Jabal Omar), Haramain High-Speed Railway, Hajj package tour operators, Nusuk digital platform (Saudi Vision 2030)', confidence: 0.85 },
        { type: 'Mutawwif pilgrim guidance and ritual compliance services', reason: 'Mutawwifin are Saudi-licensed guides who shepherd groups through Hajj rituals (tawaf, sa\'i, wuquf at Arafat, stoning at Jamarat). This is a religion-native role codified in Saudi regulation — the ritual compliance and spiritual guidance layer distinct from infrastructure logistics.', confidence: 0.8 },
        { type: 'Hajj sacrificial animal (hady) and Zamzam administration', reason: 'Islamic Development Bank Adahi project manages 1M+ sacrificial animals during Eid al-Adha. Saudi Zamzam Studies and Research Institute manages water extraction and distribution. These are ritual-obligatory supply chains native only to Hajj.', confidence: 0.75 }
      ]
    },
    'OP_ISLAM_ED': {
      fullName: 'Islamic Education Operations', label: 'Madrasa & Islamic University Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Cultural transmission and knowledge encoding — stores canonical knowledge and reproduces it through structured sequences across generations with variation between institutions.', inBusiness: 'Islamic education spans village Quran schools to Al-Azhar\'s 400K-student system. Madrasa reform is one of the most politically sensitive education markets — the market includes curriculum development, teacher training, EdTech, and reform consulting.' },
      function: 'Manages madrasa networks, Islamic university systems, and Quran memorization programs',
      dysregulation: 'Radicalization in unregulated madrasas (Pakistan, Afghanistan), curriculum stagnation, state co-optation (Turkey Imam Hatip), brain drain, gender access barriers',
      expectedTypes: [
        { type: 'Madrasa & Islamic University Systems', reason: 'Al-Azhar University system (Egypt, 400K+ students), International Islamic University Malaysia, International Islamic University Islamabad, Darul Uloom Deoband (India), Dar al-Mustafa (Yemen), Islamic Online University (Bilal Philips), Zaytuna College (USA)', confidence: 0.85 },
        { type: 'Quran memorization (hifz) schools and ijazah certification', reason: 'Hifz programs train students to memorize the entire Quran (604 pages). Ijazah is the chain-of-transmission certification connecting a reciter back to the Prophet. Dar al-Quran schools, tajweed (recitation) academies, and Qari competitions (International Quran Competition, Dubai) — a native Islamic educational institution with no parallel.', confidence: 0.8 }
      ]
    },
    'OP_ORTHODOX_JEW': {
      fullName: 'Orthodox Jewish Operations', label: 'Orthodox & Haredi Community Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'High-fidelity memory preservation — maintains exact replication with minimal drift, prioritizing accuracy over adaptation.', inBusiness: 'Orthodox and Haredi Judaism is the fastest-growing Jewish segment (6-7 children per family). Its self-contained economic ecosystem creates demand for community infrastructure, education, housing, and kosher services. Chabad alone has 5,000+ centers in 100+ countries.' },
      function: 'Manages Orthodox Jewish community infrastructure, yeshiva systems, and rabbinical courts',
      dysregulation: 'Haredi poverty and welfare dependency, yeshiva education lawsuits (NYC YAFFED), abuse cover-up in insular communities, Hasidic succession disputes (Satmar split), Israeli military exemption controversy',
      expectedTypes: [
        { type: 'Orthodox & Haredi Community Management', reason: 'Orthodox Union (OU, largest kosher certifier + NCSY youth), Agudath Israel of America, Satmar, Chabad-Lubavitch (5,000+ emissaries in 100+ countries), Yeshiva University, Torah Umesorah (day school network), Israeli Chief Rabbinate', confidence: 0.85 },
        { type: 'Kosher certification (hashgacha) and mashgiach supervision', reason: 'OU Kosher certifies 1M+ products. OK, Star-K, Kof-K, and hundreds of local vaadim operate certification. Mashgichim (kosher supervisors) are stationed in food production facilities. Kosher certification is a $24B+ market in the U.S. alone — a religion-native quality assurance system.', confidence: 0.85 },
        { type: 'Mikvah operations and Jewish ritual purity administration', reason: 'Mikvaot (ritual baths) are required for conversion, niddah (family purity), and utensil immersion. Every Orthodox community must build and maintain a mikvah. Mikvah attendance drives community membership. The National Council of Young Israel, OU, and local communities operate 1,000+ mikvaot in the U.S.', confidence: 0.75 }
      ]
    },
    'OP_REFORM_JEW': {
      fullName: 'Reform & Conservative Jewish Operations', label: 'Liberal Judaism & Denominational Services', tier: 'operational',
      neuroTranslation: { inNeurology: 'Adaptive processing circuit modifying inherited protocols for changing environmental inputs — trades strict fidelity for contextual flexibility.', inBusiness: 'Reform and Conservative Judaism represent most affiliated American Jews but face accelerating decline. The opportunity is in institutional adaptation: digital engagement, alternative worship, and merger/restructuring of legacy institutions.' },
      function: 'Manages Reform, Conservative, and Reconstructionist Jewish institutional operations',
      dysregulation: 'Membership decline (URJ lost 30%+), rabbinic placement challenges, HUC campus closures, intermarriage rate (72% non-Orthodox) challenging boundaries, Israel-diaspora conversion recognition tensions',
      expectedTypes: [
        { type: 'Liberal Judaism & Denominational Services', reason: 'Union for Reform Judaism (URJ, 850+ congregations), United Synagogue of Conservative Judaism, Jewish Theological Seminary (JTS), Hebrew Union College (HUC), Reconstructing Judaism, Hadar Institute, Western Wall egalitarian prayer movement', confidence: 0.85 },
        { type: 'Reform/Conservative rabbinical ordination and placement', reason: 'Hebrew Union College (Reform) and Jewish Theological Seminary (Conservative) ordain rabbis. Central Conference of American Rabbis (CCAR) and Rabbinical Assembly (RA) handle placement. With declining congregations, the rabbinical job market is contracting — placement and bi-vocational ministry are native denominational challenges.', confidence: 0.8 }
      ]
    },
    'OP_JEWISH_ORG': {
      fullName: 'Jewish Communal Organizations', label: 'Jewish Federation & Advocacy Network', tier: 'operational',
      neuroTranslation: { inNeurology: 'Distributed resource allocation and threat detection — pools resources, allocates to highest-priority needs, monitors external environment for community threats.', inBusiness: 'The Jewish federation system raises $3B+ annually funding social services to campus programming. Post-October 7 the entire system mobilized security, antisemitism response, and Israel support. Demand is for security consulting, campus programming, and crisis communications.' },
      function: 'Manages Jewish federation system, advocacy organizations, and communal infrastructure',
      dysregulation: 'Post-October 7 campus antisemitism crisis, donor fatigue, Israel advocacy polarization (AIPAC vs. J Street), federation merger pressures, Hillel programming under threat, security cost escalation',
      expectedTypes: [
        { type: 'Jewish Federation & Advocacy Network', reason: 'Jewish Federations of North America (146 federations, $3B+ annual), AIPAC, ADL (Anti-Defamation League), AJC (American Jewish Committee), Hillel International (campus), JFNA, Conference of Presidents of Major American Jewish Organizations', confidence: 0.85 },
        { type: 'Jewish community security and synagogue protection', reason: 'Secure Community Network (SCN, national Jewish security), Community Security Trust (UK), DHS Nonprofit Security Grant Program ($305M in 2024). Post-October 7 and post-Tree of Life shooting (2018), synagogue security is a permanent community-native infrastructure need.', confidence: 0.82 }
      ]
    },
    'OP_HINDU_TEMPLE': {
      fullName: 'Hindu Temple Operations', label: 'Temple Management & Trust Administration', tier: 'operational',
      neuroTranslation: { inNeurology: 'Localized processing and resource accumulation — each node operates autonomously, accumulating wealth proportional to devotional traffic.', inBusiness: 'Hindu temples are devotional spaces and economic engines. TTD (Tirupati) processes $500M+ annually. State endowment boards control 400K+ temples. Diaspora temples manage $10M-$100M in assets. Market: administration, auditing, festival logistics, construction.' },
      function: 'Manages Hindu temple operations, trust administration, and festival logistics',
      dysregulation: 'State fund mismanagement, temple land encroachment, gold audit disputes (Padmanabhaswamy $22B), festival crowd disasters (Vaishno Devi 2022), corruption in board appointments',
      expectedTypes: [
        { type: 'Temple Management & Trust Administration', reason: 'Tirumala Tirupati Devasthanams (TTD, richest Hindu temple trust, $500M+ annual revenue), BAPS Swaminarayan Sanstha (Akshardham temples), ISKCON (600+ centers globally), Hindu Temple of North America network, Endowment Act temples (India state-managed)', confidence: 0.85 },
        { type: 'Temple puja services and priestly (pujari/archaka) training', reason: 'Hindu temple worship requires trained priests (pujaris/archakas) who perform daily pujas, abhishekam, arati, and festival ceremonies. Training happens through guru-shishya lineages and institutions like Tirupati Sri Venkateswara Vedic University. Priest shortage in diaspora temples is acute — a native Hindu institutional pipeline.', confidence: 0.78 }
      ]
    },
    'OP_HINDU_POL': {
      fullName: 'Hindu Nationalist Politics', label: 'BJP-RSS Religious Politics Nexus', tier: 'operational',
      neuroTranslation: { inNeurology: 'Identity hardening circuit — converts fluid cultural identity into rigid political identity, recruiting religious signaling into tribal mobilization.', inBusiness: 'The BJP-RSS ecosystem (6M+ RSS members) is the most successful religious-political mobilization in the modern world. Ram Mandir (Ayodhya, $200M+) was both religious event and political rally. Political risk firms track this nexus for policy on minority rights and investment.' },
      function: 'Monitors BJP-RSS religious mobilization, cow protection vigilantism, and Hindu nationalist institutional operations',
      dysregulation: 'Communal violence (Gujarat 2002, Delhi 2020), cow vigilantism lynchings, anti-conversion law enforcement, bulldozer politics, NRC/CAA discrimination, Kashmir surveillance',
      expectedTypes: [
        { type: 'BJP-RSS Religious Politics Nexus', reason: 'Rashtriya Swayamsevak Sangh (RSS, 6M+ members), Vishva Hindu Parishad (VHP), Bajrang Dal, BJP religious affairs wing, Ram Janmabhoomi Trust (Ayodhya temple), National Commission for Minorities (India), Indian diaspora Hindu organizations (HSS, VHPA)', confidence: 0.85 },
        { type: 'RSS shakha network and Hindu nationalist cadre formation', reason: 'RSS operates 60,000+ daily shakhas (branches) combining physical exercise, ideological instruction, and community organizing. Shakha attendance is the recruitment pipeline for BJP, VHP, and Bajrang Dal cadres. This is the native Hindu nationalist formation system — a ground-level institutional network, not just top-level politics.', confidence: 0.8 }
      ]
    },
    'OP_BUDDHIST': {
      fullName: 'Buddhist Institutional Operations', label: 'Buddhist Monastery & Meditation Centers', tier: 'operational',
      neuroTranslation: { inNeurology: 'Default mode regulation and attentional control — reduces noise, dampens hyperactive threat detection, restores equilibrium through sustained practice.', inBusiness: 'Buddhism operates through monastic institutions (500M+ adherents) and the Western mindfulness industry ($5B+). Monastic Buddhism manages temple economies. Western Buddhism generates demand for apps, retreat centers, teacher training, and corporate programs.' },
      function: 'Manages Buddhist monastery networks, meditation center operations, and mindfulness industry',
      dysregulation: 'Abuse scandals (Shambhala, Sogyal Rinpoche, Zen misconduct), mindfulness commodification, Myanmar monk-led anti-Rohingya violence, Thai temple scandals, ordination decline in Japan/Korea',
      expectedTypes: [
        { type: 'Buddhist Monastery & Meditation Centers', reason: 'Plum Village (Thich Nhat Hanh tradition), Spirit Rock Meditation Center, Insight Meditation Society, Zen Mountain Monastery, Shambhala International (post-scandal), Soka Gakkai International, Fo Guang Shan, Dalai Lama’s Central Tibetan Administration (Dharamsala)', confidence: 0.85 },
        { type: 'Theravada/Mahayana/Vajrayana monastic ordination and sangha governance', reason: 'Buddhist monasticism operates through vinaya (monastic code) with distinct Theravada (Southeast Asia), Mahayana (East Asia), and Vajrayana (Tibetan) ordination lineages. Sangha governance, monk discipline, and ordination validity are native Buddhist institutional functions. Thai Sangha Supreme Council, Tibetan exile monastic system (Dharamsala), and Japanese temple inheritance system are each distinct.', confidence: 0.8 },
        { type: 'Buddhist temple economy and merit-making donation systems', reason: 'Thai temples receive billions through merit-making donations (tambun). Japanese temples manage danka (parish household) systems and cemetery operations. Chinese Buddhist temples operate as tourist attractions generating ticket revenue. Korean temple-stay programs. The temple economy is a native Buddhist institutional system distinct from Western meditation center models.', confidence: 0.78 }
      ]
    },
    'OP_SIKH': {
      fullName: 'Sikh Community Operations', label: 'Gurdwara Management & Sikh Diaspora', tier: 'operational',
      neuroTranslation: { inNeurology: 'Community service and resource sharing — hardwired for egalitarian distribution, prioritizing collective feeding, shelter, and mutual aid.', inBusiness: 'Sikhism\'s institutional identity is built around seva. Golden Temple\'s langar feeds 100K+ daily. Diaspora gurdwaras are community anchors. Demand: gurdwara management, advocacy (hate crime response), and diaspora services.' },
      function: 'Manages gurdwara operations, langar community kitchens, and Sikh diaspora organizations',
      dysregulation: 'Hate crimes (Oak Creek 2012), SGPC political capture (Akali Dal), Khalistan tensions, gurdwara factional disputes, Indian transnational repression (Nijjar assassination, Canada 2023)',
      expectedTypes: [
        { type: 'Gurdwara Management & Sikh Diaspora', reason: 'Shiromani Gurdwara Parbandhak Committee (SGPC, manages Sikh shrines including Golden Temple Amritsar), Sikh Coalition (U.S. advocacy), World Sikh Organization, Khalsa Aid (disaster relief), SikhNet, National Sikh Campaign, Sikh American Legal Defense', confidence: 0.85 },
        { type: 'Langar (community kitchen) operations and seva coordination', reason: 'Every gurdwara operates a langar serving free meals to all visitors regardless of faith — the Golden Temple feeds 100K+ daily. Langar logistics (volunteer coordination, food procurement, kitchen operations) and broader seva (selfless service) programs are the institutional expression of Sikh theology. This is community-native infrastructure.', confidence: 0.78 }
      ]
    },
    'OP_CHRISTIAN_TV': {
      fullName: 'Christian Television Networks', label: 'TBN, EWTN & Religious Broadcasting', tier: 'operational',
      neuroTranslation: { inNeurology: 'High-bandwidth one-to-many broadcast output reaching millions simultaneously with unidirectional messaging.', inBusiness: 'Religious broadcasting is $6B+. TBN reaches 175+ countries. K-LOVE dominates Christian radio. Networks drive donations, book sales, and political mobilization. Founder succession and cord-cutting restructure the space.' },
      function: 'Operates Christian television networks, radio, and streaming platforms',
      dysregulation: 'Prosperity gospel scandals, founder succession crises (Pat Robertson, Paul Crouch), audience aging, cord-cutting, financial opacity, political co-optation',
      expectedTypes: [
        { type: 'TBN, EWTN & Religious Broadcasting', reason: 'Trinity Broadcasting Network (TBN, reaches 175+ countries), EWTN (Catholic, global), Daystar Television, CBN (700 Club, Pat Robertson legacy), K-LOVE/Air1 (EMF Broadcasting, largest Christian radio), Salem Communications, Moody Radio', confidence: 0.85 },
        { type: 'Denominational and church-owned broadcasting operations', reason: 'EWTN (Catholic, global), Moody Radio (Moody Bible Institute), Lutheran Hour Ministries, BBN (Bible Broadcasting Network) — these are institutionally owned by denominations or religious bodies, distinct from independent/commercial networks like TBN. The institutional broadcaster serves as official denominational voice.', confidence: 0.78 }
      ]
    },
    'OP_ISLAMIC_MEDIA': {
      fullName: 'Islamic Media Operations', label: 'Islamic Broadcasting & Digital Content', tier: 'operational',
      neuroTranslation: { inNeurology: 'Multi-frequency broadcast across state-controlled, institutional, and grassroots channels — signal content varies by transmitter.', inBusiness: 'Islamic media spans state broadcasting (Al Jazeera, TRT, Press TV), institutional content (Al-Azhar), and grassroots creators. State rivalry (Saudi-Qatar-Turkey-Iran) drives competing media infrastructure investment serving 1.8B Muslims.' },
      function: 'Manages Islamic media broadcasting, digital content, and social media presence',
      dysregulation: 'State propaganda as religious content, extremist amplification on unmoderated platforms, Telegram radicalization, misinformation about doctrine, competing state narratives',
      expectedTypes: [
        { type: 'Islamic Broadcasting & Digital Content', reason: 'Al Jazeera religion/ethics coverage, TRT World (Turkey), Press TV religion content (Iran), Saudi state media (SPA), Islam Channel (UK), Muslim Central (YouTube, 1M+ subscribers), Yaqeen Institute (academic Islamic content), Bayyinah Institute (Nouman Ali Khan)', confidence: 0.85 },
        { type: 'State-controlled Friday sermon content and khutbah distribution', reason: 'Saudi Ministry of Islamic Affairs, Egypt Awqaf Ministry, Turkey Diyanet all control Friday khutbah (sermon) content distributed to mosques. Diyanet writes the weekly sermon for 90K+ Turkish mosques. This is state-religion media control at the congregational level — a native Islamic institutional function.', confidence: 0.78 }
      ]
    },
    'OP_VATICAN_MEDIA': {
      fullName: 'Vatican Media Operations', label: 'Vatican News & Communications', tier: 'operational',
      neuroTranslation: { inNeurology: 'Official institutional communication output — controlled signal from central authority to all peripheral nodes and external environment.', inBusiness: 'Vatican Media is the communications arm for 1.3B Catholics. @Pontifex reaches 50M+. Vatican News publishes in 39 languages. The 2015 merger of 9 entities created demand for digital transformation consulting and multilingual content infrastructure.' },
      function: 'Manages Vatican News, L’Osservatore Romano, Vatican Radio, and papal digital presence',
      dysregulation: 'Communications failures during abuse response, Vatileaks I and II, message discipline breakdown, social media controversies, translation errors in multilingual communications',
      expectedTypes: [
        { type: 'Vatican News & Communications', reason: 'Vatican Media (Dicastery for Communication), Vatican News (39 languages), L’Osservatore Romano, Vatican Radio, @Pontifex (papal social media, 50M+ followers), CTV (Centro Televisivo Vaticano), Libreria Editrice Vaticana', confidence: 0.85 }
      ]
    },
    'OP_SEMINARY': {
      fullName: 'Seminary Education Operations', label: 'Theological Education & Accreditation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Professional training and calibration facility — takes raw inputs and produces standardized credentialed outputs for field deployment.', inBusiness: 'Seminaries are the credentialing pipeline. ATS accredits 270+ schools. When enrollment drops (30%+ at mainline), the leadership pipeline thins. Market: theological education, online degrees, continuing education, accreditation consulting.' },
      function: 'Manages seminary education, accreditation, and ministerial formation',
      dysregulation: 'Enrollment decline (30%+ at mainline), student debt crisis for low-salary ministry, campus closures (HUC), adjunctification, theological education misaligned with pastoral reality',
      expectedTypes: [
        { type: 'Theological Education & Accreditation', reason: 'Association of Theological Schools (ATS, 270+ accredited schools), Fuller Theological Seminary (largest multidenominational), Southern Baptist Theological Seminary, Gordon-Conwell, Duke Divinity, Princeton Theological Seminary, Catholic Theological Union, Jewish Theological Seminary', confidence: 0.85 },
        { type: 'Clinical Pastoral Education (CPE) and chaplaincy certification', reason: 'CPE (accredited through ACPE) is required for hospital, military, and prison chaplains. 350+ CPE centers in the U.S. Board of Chaplaincy Certification (BCC) credentials professional chaplains. This is the religion-native clinical training pipeline that bridges seminary education and institutional chaplaincy.', confidence: 0.82 },
        { type: 'Denominational ordination and ministerial credentialing bodies', reason: 'Each denomination has its own ordination process — PCUSA Committees on Preparation for Ministry, ELCA candidacy committees, SBC ordination through local church with associational review, Catholic seminary-to-diaconate-to-priesthood. Ordination is the religion-native credentialing gatekeep.', confidence: 0.8 }
      ]
    },
    'OP_MADRASA': {
      fullName: 'Madrasa Education Operations', label: 'Islamic Education Networks', tier: 'operational',
      neuroTranslation: { inNeurology: 'Cultural knowledge encoding and transmission — reproduces canonical knowledge through structured repetition with variation between institutions.', inBusiness: 'Islamic education ranges from village Quran schools to Al-Azhar. Madrasa reform is politically sensitive — Western governments fund programs, states regulate curricula, radical groups exploit unregulated schools. Market: curriculum, teacher training, EdTech, reform consulting.' },
      function: 'Manages madrasa systems, Quran schools, and Islamic education reform',
      dysregulation: 'Radicalization in unregulated madrasas, curriculum stagnation vs. modernization, state co-optation (Turkey Imam Hatip), brain drain, gender barriers',
      expectedTypes: [
        { type: 'Islamic Education Networks', reason: 'Darul Uloom Deoband (India, est. 1866, thousands of affiliated madrasas), Nadwatul Ulama (Lucknow), Pakistani madrasa reform programs, Egyptian madrasa modernization under Al-Azhar, Turkish Imam Hatip schools (Diyanet), Indonesian pesantren network (Nahdlatul Ulama, Muhammadiyah)', confidence: 0.85 }
      ]
    },
    'OP_YESHIVA': {
      fullName: 'Yeshiva Education Operations', label: 'Jewish Religious Education', tier: 'operational',
      neuroTranslation: { inNeurology: 'Intensive pattern-matching and textual analysis — optimized for deep engagement with canonical texts through dialectical reasoning and sustained attention.', inBusiness: 'Yeshiva education is the backbone of Orthodox knowledge production. Torah Umesorah operates 700+ schools. BMG Lakewood is the largest yeshiva outside Israel. NYC YAFFED campaign challenging Hasidic yeshiva quality generated years of regulatory conflict.' },
      function: 'Manages yeshiva day schools, Talmud academies, and Jewish educational institutions',
      dysregulation: 'State regulation lawsuits (NYC YAFFED), inadequate secular education in Haredi yeshivot, tuition crisis ($20K-$40K/year), off-the-derech departures, teacher salary stagnation',
      expectedTypes: [
        { type: 'Jewish Religious Education', reason: 'Torah Umesorah (National Society for Hebrew Day Schools, 700+ schools), Yeshiva University, Bais Yaakov schools, Mir Yeshiva (Jerusalem), BMG Lakewood, Chabad educational network, PJ Library (Harold Grinspoon Foundation, children’s Jewish books)', confidence: 0.85 },
        { type: 'Kollel (post-yeshiva advanced study) and semicha (ordination) programs', reason: 'Kollelim fund married men for full-time Talmud study — BMG Lakewood operates the largest kollel system outside Israel. Semicha (rabbinical ordination) programs at Yeshiva University (RIETS), YCT (Open Orthodox), and Israeli yeshivot credential the next generation of rabbis. This is the advanced clergy formation pipeline.', confidence: 0.78 }
      ]
    },
    'OP_SUNDAY_SCHOOL': {
      fullName: 'Christian Education Operations', label: 'Sunday School & Youth Ministry', tier: 'operational',
      neuroTranslation: { inNeurology: 'Developmental programming — encodes foundational patterns during a critical window, shaping the network\'s baseline assumptions for life.', inBusiness: 'Sunday School and youth ministry are how Christianity reproduces itself. When youth ministry fails, the 20-year pipeline empties. Market: curriculum (Lifeway, Group, Orange), staffing (YoungLife, FCA, InterVarsity), and youth engagement technology.' },
      function: 'Manages Christian education programs, VBS, youth ministry, and discipleship curricula',
      dysregulation: 'Youth disengagement (64% leave per Barna), volunteer collapse, curriculum irrelevance, competition with sports for Sunday, VBS decline, safe-environment compliance burden',
      expectedTypes: [
        { type: 'Sunday School & Youth Ministry', reason: 'Lifeway Christian Resources (VBS, Sunday School curricula), David C Cook, Gospel Light/Urban Ministries, Group Publishing, Orange/ReThink Group (Reggie Joiner), YoungLife, Fellowship of Christian Athletes (FCA), InterVarsity, Navigators', confidence: 0.85 },
        { type: 'Vacation Bible School and children ministry programming', reason: 'VBS serves 4M+ children annually in the U.S. Lifeway, Group Publishing, and Orange produce the curricula. Church children ministry directors are a distinct professional role. AWANA, BSF Kids, and Royal Rangers are para-church programs. This is the age-specific formation layer distinct from general youth ministry.', confidence: 0.78 }
      ]
    },
    'OP_CATH_CHARITY': {
      fullName: 'Catholic Charitable Operations', label: 'Catholic Charities & Relief Services', tier: 'operational',
      neuroTranslation: { inNeurology: 'Large-scale resource distribution — channels surplus to greatest deficit, operating as both aid delivery and institutional legitimacy maintenance.', inBusiness: 'Catholic charities are the largest U.S. private social services after government — $4.7B through Catholic Charities USA, $1B+ through CRS. Market: nonprofit management, government contracts, immigration legal services, disaster logistics.' },
      function: 'Manages Catholic charitable networks and international relief operations',
      dysregulation: 'Government contract dependency creating mission tension, donor fatigue after abuse scandals, competition with secular nonprofits, parish giving decline, volunteer aging',
      expectedTypes: [
        { type: 'Catholic Charities & Relief Services', reason: 'Catholic Charities USA ($4.7B annual, largest U.S. social services network after government), Catholic Relief Services (CRS, $1B+ annual), St. Vincent de Paul Society, Caritas Internationalis (confederation of 162 Catholic relief agencies)', confidence: 0.85 },
        { type: 'Catholic parish-level St. Vincent de Paul and social ministry', reason: 'Society of St. Vincent de Paul operates in 150+ countries with 800K+ volunteers doing person-to-person charity (rent assistance, food, utility bills) through parish-based conferences. Distinct from the national Catholic Charities bureaucracy — this is the congregational-level charitable function.', confidence: 0.78 }
      ]
    },
    'OP_ISLAMIC_CHARITY': {
      fullName: 'Islamic Charitable Operations', label: 'Islamic Relief & Zakat Distribution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Obligatory output circuit — hardwired duty to redistribute resources from surplus to deficit nodes, with redistribution as system stabilizer.', inBusiness: 'Zakat and sadaqah generate $200B-$1T annually. Islamic Relief alone processes $700M+. Market: zakat calculation platforms, humanitarian logistics, compliance (anti-terror financing), Islamic microfinance. Post-9/11 compliance created permanent legal market.' },
      function: 'Manages Islamic charitable organizations, zakat collection, and humanitarian relief',
      dysregulation: 'Terror financing designations (Holy Land Foundation), OFAC/FinCEN compliance burden, distribution transparency challenges, geopolitical weaponization of charity designations',
      expectedTypes: [
        { type: 'Islamic Relief & Zakat Distribution', reason: 'Islamic Relief Worldwide ($700M+ annual), Islamic Relief USA, ICNA Relief, Penny Appeal, Muslim Aid, Zakat Foundation of America, International Islamic Charitable Organization (Kuwait), Qatar Charity', confidence: 0.85 },
        { type: 'Mosque-level sadaqah distribution and community mutual aid', reason: 'Beyond institutional Islamic charities, individual mosques collect and distribute sadaqah (voluntary charity), manage funeral funds, support new Muslim converts, and run food pantries. Mosque boards administer these community-native mutual aid functions. Distinct from international Islamic relief organizations.', confidence: 0.75 }
      ]
    },
    'OP_PROT_CHARITY': {
      fullName: 'Protestant Charitable Operations', label: 'Evangelical & Mainline Relief Organizations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Compassion-driven action — converts empathic signal detection into material resource deployment scaled to emotional intensity.', inBusiness: 'Protestant charities include World Vision ($3.3B), Salvation Army ($3.4B), Compassion ($1B+). These are sophisticated logistics and fundraising operations creating demand for donor technology, development consulting, and disaster response infrastructure.' },
      function: 'Manages Protestant charitable networks and international development',
      dysregulation: 'Proselytization concerns in humanitarian settings, Franklin Graham political controversy, donor fatigue, accountability gaps overseas, evangelism vs. development tension',
      expectedTypes: [
        { type: 'Evangelical & Mainline Relief Organizations', reason: 'World Vision International ($3.3B annual, largest Christian NGO), Compassion International ($1B+), Samaritan’s Purse (Franklin Graham), Salvation Army ($3.4B annual), Habitat for Humanity, MAP International, Feed the Children, Food for the Poor', confidence: 0.85 },
        { type: 'Church-based food pantry and benevolence fund operations', reason: '200K+ U.S. churches operate food pantries, benevolence funds (emergency rent/utility assistance), and clothing closets. Feeding America partners with 60K+ faith-based feeding programs. This is the congregational-level charitable infrastructure distinct from international NGOs like World Vision or Salvation Army.', confidence: 0.78 }
      ]
    },
    'OP_JEWISH_CHARITY': {
      fullName: 'Jewish Charitable Operations', label: 'Jewish Federation & Philanthropic Network', tier: 'operational',
      neuroTranslation: { inNeurology: 'Community self-sustenance and mutual aid — optimized for intra-group resource pooling with strong reciprocity norms.', inBusiness: 'The Jewish philanthropic ecosystem is among the world\'s most sophisticated — 146 federations, major family foundations (Bronfman, Schusterman). Post-October 7 emergency campaigns raised $800M+ in months. Market: philanthropic advisory, endowment management, program evaluation.' },
      function: 'Manages Jewish federation system and philanthropic infrastructure',
      dysregulation: 'Donor concentration risk, generational giving shift, Israel giving politicization, endowment spend-down, competition between federation and independent vehicles',
      expectedTypes: [
        { type: 'Jewish Federation & Philanthropic Network', reason: 'Jewish Federations of North America ($3B+ annual combined), American Jewish Joint Distribution Committee (JDC), HIAS (refugee resettlement), Hadassah, Jewish National Fund (JNF), UJA-Federation of New York ($200M+ annual)', confidence: 0.85 },
        { type: 'Gemilut chasadim (acts of lovingkindness) and bikur cholim societies', reason: 'Jewish community-native mutual aid: gemach (free-loan societies), bikur cholim (visiting the sick), chevra kadisha (burial society), and community eruv maintenance. These are halakhically-mandated communal functions that operate through synagogues and volunteer societies. Distinct from federation-level philanthropy.', confidence: 0.75 }
      ]
    },
    'OP_CANON_LAW': {
      fullName: 'Canon Law Operations', label: 'Catholic & Anglican Ecclesiastical Law', tier: 'operational',
      neuroTranslation: { inNeurology: 'Internal regulatory and adjudication circuit — applies codified rules to resolve disputes and maintain coherence without external authority.', inBusiness: 'Canon law governs 1,752 canons covering annulment to bishop removal. When abuse, property, or doctrinal controversies arise, canon lawyers are practitioners. Market: legal education, tribunal staffing, institutional compliance.' },
      function: 'Manages canon law practice, ecclesiastical tribunals, and church legal affairs',
      dysregulation: 'Canon law weaponized to protect abusers, tribunal backlogs, conflict with civil law in abuse cases, lack of due process, enforcement inconsistency',
      expectedTypes: [
        { type: 'Catholic & Anglican Ecclesiastical Law', reason: 'Vatican Tribunal system (Roman Rota, Apostolic Signatura, Apostolic Penitentiary), Canon Law Society of America, Faculty of Canon Law (Catholic University), Church of England Ecclesiastical Courts, Anglican Communion Office legal advisors', confidence: 0.85 },
        { type: 'Marriage tribunal and annulment adjudication', reason: 'Catholic marriage tribunals process 30K+ annulment cases annually in the U.S. alone. Canon lawyers (JCL/JCD credentialed) serve as judges, defenders of the bond, and advocates. The tribunal system is a fully native Catholic judicial apparatus distinct from general canon law practice.', confidence: 0.82 }
      ]
    },
    'OP_SHARIA_COURTS': {
      fullName: 'Sharia Court Operations', label: 'Islamic Judiciary & Arbitration', tier: 'operational',
      neuroTranslation: { inNeurology: 'Parallel adjudication under alternative rule set — processes disputes through religiously-derived rather than state-derived principles.', inBusiness: 'Sharia courts function as state judiciary in Saudi Arabia, Iran, Pakistan, Malaysia and as voluntary arbitration in UK, Canada, U.S. Market: Islamic legal education, arbitration services, family law mediation, cross-jurisdictional compliance.' },
      function: 'Manages sharia courts, Islamic arbitration, and Islamic family law',
      dysregulation: 'Women\'s rights concerns in divorce/custody, forced arbitration allegations, conflict with civil inheritance law, authoritarian instrumentalization, limited appellate review',
      expectedTypes: [
        { type: 'Islamic Judiciary & Arbitration', reason: 'Saudi Arabia’s General Presidency of the Board of Grievances, Pakistan Federal Shariat Court, Malaysian Syariah Courts, UK Muslim Arbitration Tribunal, Indonesia Religious Courts (Pengadilan Agama), Egypt Grand Mufti’s Dar al-Ifta', confidence: 0.85 },
        { type: 'Islamic family law mediation and marriage/divorce administration', reason: 'Nikah (marriage contract) formalization, mahr (dowry) negotiation, talaq (divorce) procedures, khula (wife-initiated divorce), child custody under Islamic principles — family law is the primary caseload of sharia courts globally. This is the pastoral/judicial intersection native to Islamic communities.', confidence: 0.8 }
      ]
    },
    'OP_BEIT_DIN': {
      fullName: 'Rabbinical Court Operations', label: 'Jewish Law & Bet Din System', tier: 'operational',
      neuroTranslation: { inNeurology: 'Community-internal dispute resolution — resolves conflicts using shared interpretive frameworks rather than external adjudication.', inBusiness: 'Batei din handle Jewish divorce (get), conversion, and commercial disputes. The get process is a critical chokepoint — women denied get become agunot. Market: advocacy, prenuptial agreements, court reform, kosher certification, conversion processes.' },
      function: 'Manages rabbinical courts, Jewish divorce proceedings, and halakhic arbitration',
      dysregulation: 'Agunah crisis, get extortion, Orthodox vs. non-Orthodox jurisdictional disputes, Israeli Rabbinate monopoly, enforcement gaps in secular courts',
      expectedTypes: [
        { type: 'Jewish Law & Bet Din System', reason: 'Beth Din of America (RCA), London Beth Din (United Synagogue), Israeli Chief Rabbinate Rabbinical Courts, Chicago Rabbinical Council (cRc), National Beit Din (Conservative Judaism), International Beit Din', confidence: 0.85 },
        { type: 'Get (Jewish divorce) administration and agunah advocacy', reason: 'A get (religious divorce document) must be given by the husband to the wife before a beit din. Women denied a get become agunot (chained wives). ORA (Organization for the Resolution of Agunot), International Beit Din, and prenuptial agreement campaigns (RCA prenup) address this. The get process is a uniquely Jewish legal chokepoint.', confidence: 0.8 }
      ]
    },
    'OP_REL_FREEDOM_LAW': {
      fullName: 'Religious Freedom Litigation', label: 'First Amendment & International Religious Freedom Law', tier: 'operational',
      neuroTranslation: { inNeurology: 'Boundary defense circuit — activates when external threats to operational autonomy are perceived, mobilizing legal and political resources.', inBusiness: 'Religious freedom litigation is $500M+ in the U.S. Becket Fund, ADF, and First Liberty handle Supreme Court cases reshaping the religion-civil law boundary. Every case generates fees, media, donor mobilization, and policy impact.' },
      function: 'Manages religious freedom litigation, RLUIPA cases, and international religious liberty advocacy',
      dysregulation: 'Culture war entrenchment, litigation cost escalation, international enforcement inconsistency, religious liberty claimed to justify discrimination, donor fatigue',
      expectedTypes: [
        { type: 'First Amendment & International Religious Freedom Law', reason: 'Becket Fund for Religious Liberty (Hobby Lobby v. Burwell, Little Sisters of the Poor), Alliance Defending Freedom (ADF, $100M+ annual), Liberty Counsel, First Liberty Institute, ACLJ, European Centre for Law and Justice, ADF International', confidence: 0.85 },
        { type: 'RLUIPA land use and prisoner religious exercise litigation', reason: 'Religious Land Use and Institutionalized Persons Act (2000) generates 100+ federal cases annually — mosque zoning denials, church parking disputes, prison inmate religious diet/grooming claims. This is a religion-native legal category. Becket Fund, ADF, and DOJ Civil Rights Division handle these cases.', confidence: 0.8 }
      ]
    },
    'OP_CHURCH_REAL_ESTATE': {
      fullName: 'Church Real Estate Operations', label: 'Church Property Management & Disposition', tier: 'operational',
      neuroTranslation: { inNeurology: 'Physical infrastructure management — maintains structural substrate that all other functions depend upon, with deterioration cascading.', inBusiness: '4,000+ U.S. churches close annually. Religious properties are uniquely zoned and emotionally charged. Conversion creates demand for specialized brokers, adaptive reuse architects, preservation consultants, and developers. Steeple-lease programs generate carrier revenue.' },
      function: 'Manages church property portfolios, closure/conversion processes, and religious real estate',
      dysregulation: 'Deferred maintenance on aging buildings, asbestos remediation, historic designation blocking reuse, property disputes during splits, parish merger resistance, burial ground contamination',
      expectedTypes: [
        { type: 'Church Property Management & Disposition', reason: 'National Trust for Historic Preservation (Sacred Places program), Partners for Sacred Places, Church Buildings Council (England), diocesan real estate offices, NNN church property investors (Realty Income O, Spirit Realty), commercial brokers specializing in former church sales', confidence: 0.85 },
        { type: 'Sacred space deconsecration and adaptive reuse', reason: 'Catholic deconsecration requires canonical process before a church can be sold. Protestant denominations have trust clauses governing property disposition. Adaptive reuse (church-to-brewery, church-to-housing, church-to-event space) requires navigating both religious and zoning processes. Deconsecration is a religion-native legal act.', confidence: 0.78 }
      ]
    },
    'OP_MOSQUE_CONST': {
      fullName: 'Mosque Construction Operations', label: 'Mosque Development & Waqf Property', tier: 'operational',
      neuroTranslation: { inNeurology: 'Infrastructure expansion and territorial establishment — builds new physical nodes where the network needs presence, funded by endowment or state investment.', inBusiness: 'Mosque construction is $1B+ globally driven by population growth, diaspora establishment, and state religious diplomacy (Turkey Diyanet). Waqf property ($1T+ global) includes land and buildings. Market: architecture, construction, waqf compliance, community development.' },
      function: 'Manages mosque construction, waqf property administration, and Islamic facility development',
      dysregulation: 'NIMBYism and zoning opposition (RLUIPA cases), waqf mismanagement, Turkish mosque diplomacy as geopolitical instrument, Saudi-funded controversies, factional disputes',
      expectedTypes: [
        { type: 'Mosque Development & Waqf Property', reason: 'Turkish Presidency of Religious Affairs (Diyanet, builds mosques globally), Saudi mosque construction programs, ISNA Development Foundation, Islamic Society of North America real estate, waqf authorities (Malaysia JAWHAR, Singapore MUIS, Bahrain Justice Ministry waqf division)', confidence: 0.85 },
        { type: 'Waqf property administration for mosque endowments', reason: 'Mosques are typically established as waqf — permanently endowed for religious use. Waqf administration for mosques includes property maintenance, rental income from associated waqf commercial properties, and compliance with waqf deed conditions. Distinct from construction — this is the ongoing stewardship function.', confidence: 0.78 }
      ]
    },
    'OP_TEMPLE_TRUST': {
      fullName: 'Temple Trust Operations', label: 'Hindu Temple Trusts & Endowments', tier: 'operational',
      neuroTranslation: { inNeurology: 'Wealth accumulation and devotional resource management — concentrates donations into reserves growing over centuries, requiring fiduciary oversight.', inBusiness: 'Hindu temple trusts manage some of earth\'s richest religious institutions. TTD ($500M+), Padmanabhaswamy ($22B gold), BAPS ($100M+ NJ temple). State boards manage 400K+ temples. Market: auditing, gold valuation, construction, endowment management.' },
      function: 'Manages Hindu temple trusts, endowment administration, and temple construction',
      dysregulation: 'State fund diversion, gold audit disputes, land encroachment, corruption in board appointments, diaspora factional splits',
      expectedTypes: [
        { type: 'Hindu Temple Trusts & Endowments', reason: 'Tirumala Tirupati Devasthanams (TTD, $500M+ annual), Sabarimala Temple Trust, Somnath Trust (Gujarat), BAPS temple construction (Robbinsville NJ $100M+), Hindu Endowments Board (India state-level), Shree Jagannath Temple Administration (Puri)', confidence: 0.85 },
        { type: 'Hindu religious endowment board administration and temple revenue distribution', reason: 'State-level Hindu Religious and Charitable Endowments (HRCE) boards in Tamil Nadu, Andhra Pradesh, Karnataka manage 400K+ temples, collecting and distributing hundi (donation box) revenue. Political appointment of board trustees, temple fund diversion controversies, and Free Hindu Temples movement are native governance issues.', confidence: 0.8 }
      ]
    },
    'OP_HAJJ_TOURISM': {
      fullName: 'Hajj & Islamic Tourism', label: 'Hajj Packages & Islamic Travel', tier: 'operational',
      neuroTranslation: { inNeurology: 'Guided pilgrimage logistics — packages the raw impulse into managed journeys with routing, accommodation, and ritual compliance.', inBusiness: 'Hajj travel is $12B+. Saudi Arabia targets 30M Umrah visitors/year under Vision 2030. Operators sell $5K-$20K+ packages. Market: tour operations, hospitality, digital platforms (Nusuk), transportation.' },
      function: 'Manages Hajj/Umrah package tourism and Islamic travel industry',
      dysregulation: 'Visa fraud and unlicensed operators, overcrowding risk, heat deaths, price gouging, pandemic disruption, geopolitical visa restrictions (Iran-Saudi tensions)',
      expectedTypes: [
        { type: 'Hajj Packages & Islamic Travel', reason: 'Saudi Ministry of Hajj Nusuk platform, Hajj package operators (Air Arabia Hajj, Saudi Arabian Airlines Hajj charter), Islamic tourism certifiers (OIC, CrescentRating), HalalTrip, Muslim-friendly hotel ratings, Zamzam water distribution operations', confidence: 0.85 }
      ]
    },
    'OP_HOLY_LAND': {
      fullName: 'Holy Land Tourism Operations', label: 'Jerusalem, Vatican & Pilgrimage Travel', tier: 'operational',
      neuroTranslation: { inNeurology: 'Multi-tradition convergence node — multiple independent networks claim sacred significance, creating synergy and competition.', inBusiness: 'Holy Land tourism is $5B+ serving Christian, Jewish, and Muslim pilgrims. October 7 collapsed Israel tourism. Market: tour operators, hospitality, pilgrimage logistics, conflict-disruption insurance.' },
      function: 'Manages Christian, Jewish, and interfaith pilgrimage to Holy Land and sacred sites',
      dysregulation: 'October 7 collapse of Israel tourism, Jerusalem holy site disputes, Holy Sepulchre denomination conflicts, overtourism, pilgrim safety in conflict zones',
      expectedTypes: [
        { type: 'Jerusalem, Vatican & Pilgrimage Travel', reason: 'Israel Ministry of Tourism (4.5M visitors/year pre-COVID), Vatican Museums (6M visitors/year), Camino de Santiago (400K+ pilgrims/year), Franciscan Custody of the Holy Land, Educational Opportunities Tours, Insight for Living Tours, Tauck faith-based travel', confidence: 0.85 },
        { type: 'Jerusalem holy site administration and Status Quo governance', reason: 'The Status Quo (1757) governs shared custody of the Holy Sepulchre between Greek Orthodox, Armenian, Catholic, Coptic, Ethiopian, and Syriac churches. Temple Mount/Haram al-Sharif is administered by the Jordanian Waqf with Israeli security. This is the most complex multi-tradition property governance on earth.', confidence: 0.82 }
      ]
    },
    'OP_HINDU_PILGRIMAGE': {
      fullName: 'Hindu Pilgrimage Operations', label: 'Varanasi, Kumbh Mela & Temple Tourism', tier: 'operational',
      neuroTranslation: { inNeurology: 'Massive periodic synchronization with distributed sacred geography — millions travel to specific coordinates on calendrical triggers.', inBusiness: 'Hindu pilgrimage is the world\'s largest by volume. Kumbh Mela (200M+ visitors) is history\'s largest gathering. India invests heavily in infrastructure (Char Dham Highway, Kashi Corridor). Market: construction, logistics, hospitality, crowd management.' },
      function: 'Manages Hindu pilgrimage logistics, Kumbh Mela operations, and temple tourism',
      dysregulation: 'Crowd disasters (Vaishno Devi 2022, Kumbh stampedes), environmental degradation, infrastructure overwhelm, commercialization, political instrumentalization (Kashi Corridor)',
      expectedTypes: [
        { type: 'Varanasi, Kumbh Mela & Temple Tourism', reason: 'Uttar Pradesh Tourism (Varanasi, Prayagraj Kumbh Mela logistics for 200M+ visitors), Uttarakhand Char Dham Yatra Board, Tamil Nadu HRCE (temple tourism), Tirumala Tirupati Devasthanams pilgrimage operations, India Ministry of Tourism pilgrimage circuits', confidence: 0.85 },
        { type: 'Kumbh Mela administration and akhaada (monastic order) coordination', reason: 'Kumbh Mela requires coordination between 13 recognized akhaadas (Hindu monastic orders) who lead the Shahi Snan (royal bathing processions). Akhaada politics, procession order disputes, and the Mela administration (appointed by state government) are native Hindu institutional governance functions.', confidence: 0.78 }
      ]
    },
    'OP_CHURCH_SAAS': {
      fullName: 'Church Management SaaS', label: 'Digital Church Operations Platforms', tier: 'operational',
      neuroTranslation: { inNeurology: 'Digital nervous system — provides communication, scheduling, data management, and coordination substrate for all institutional functions.', inBusiness: 'Church management SaaS is $1B+ serving 300K+ congregations. Planning Center (70K+ churches), Pushpay ($200M+), Tithe.ly lead. COVID made these essential infrastructure — creating recurring revenue and high switching costs.' },
      function: 'Builds and operates church management, giving, and engagement software',
      dysregulation: 'Data privacy concerns, vendor lock-in, integration challenges, small church affordability barriers, technology gap, cybersecurity risk with sensitive pastoral data',
      expectedTypes: [
        { type: 'Digital Church Operations Platforms', reason: 'Planning Center Online (70K+ churches), Pushpay ($200M+ revenue, 14K+ customers), Tithe.ly, Subsplash, ACS Technologies (Realm), Breeze ChMS, Church Windows, FellowshipOne (Bema), Servant Keeper, Church360 (Concordia)', confidence: 0.85 },
        { type: 'Sacramental records and membership roll management', reason: 'Catholic dioceses require canonical record-keeping for every baptism, confirmation, marriage, and burial. Protestant churches maintain membership rolls for voting rights and denominational reporting. This is a religion-native data management function embedded in church management platforms.', confidence: 0.78 }
      ]
    },
    'OP_ONLINE_GIVING': {
      fullName: 'Religious Online Giving', label: 'Digital Donation & Stewardship Tech', tier: 'operational',
      neuroTranslation: { inNeurology: 'Digital payment processing — converts giving impulse into executed transactions through low-friction channels.', inBusiness: 'Religious online giving processes $10B+ annually. Pushpay, Tithe.ly, Givelify dominate. The cash-to-digital shift accelerated in COVID and stuck. Every percentage point of processing on $130B in U.S. religious giving is $1.3B revenue.' },
      function: 'Manages online giving platforms, recurring donation systems, and stewardship analytics',
      dysregulation: 'Processing fee burden on small churches, data portability issues, recurring giving churn, generational gap (boomers prefer cash), crypto giving complexity, PCI compliance',
      expectedTypes: [
        { type: 'Digital Donation & Stewardship Tech', reason: 'Pushpay, Tithe.ly, Givelify (mobile-first), Vanco (payment processing), Kindrid, SecureGive, easyTithe, Blackbaud (faith vertical), Classy (GoFundMe), Network for Good (faith customers)', confidence: 0.85 },
        { type: 'Tithing and stewardship campaign management', reason: 'Annual stewardship campaigns (pledge drives, tithing education, capital campaigns for building projects) are a native church financial operation. Generosity consulting (Horizons Stewardship, RSI), pledge management, and year-end giving pushes are religion-specific revenue functions distinct from payment processing.', confidence: 0.78 }
      ]
    },
    'OP_STREAMING_WORSHIP': {
      fullName: 'Worship Streaming Operations', label: 'Live Stream & Virtual Worship Tech', tier: 'operational',
      neuroTranslation: { inNeurology: 'Remote presence and broadcast extension — allows central processing to reach nodes that cannot physically attend, maintaining connectivity across distance.', inBusiness: '100K+ churches now stream. Church Online Platform, Resi Media, BoxCast lead. Market: hardware, platforms, production services, hybrid worship design. Churches that invested in streaming stabilized; those that didn\'t accelerated decline.' },
      function: 'Manages worship streaming platforms, virtual church infrastructure, and hybrid worship technology',
      dysregulation: 'Viewer passivity replacing participation, streaming cannibalizing attendance, technical failures, bandwidth inequality (rural), volunteer burnout, CCLI streaming license compliance',
      expectedTypes: [
        { type: 'Live Stream & Virtual Worship Tech', reason: 'Church Online Platform (Life.Church, free/open-source), Resi Media (live streaming), BoxCast (church-focused streaming), Vimeo OTT, Living As One (multi-site streaming), ProPresenter (Renewed Vision, worship presentation), EasyWorship', confidence: 0.85 },
        { type: 'Liturgical worship production and ProPresenter operations', reason: 'Worship presentation software (ProPresenter, EasyWorship, MediaShout) manages lyrics, scripture, sermon slides, and video for live services. This is religion-native production technology — the software exists only because weekly worship services need it. CCLI streaming licenses are required for music.', confidence: 0.75 }
      ]
    },
    'OP_PRAYER_APP': {
      fullName: 'Prayer & Devotional Apps', label: 'Digital Prayer & Spiritual Formation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Personal devotional and contemplative circuit — provides guided internal processing that regulates emotion, builds resilience, and maintains network connection.', inBusiness: 'Prayer apps are $500M+. Hallow ($100M+ raised, Catholic) and Pray.com lead. Overlaps with secular mindfulness but serves distinct religious use cases. High daily engagement drives strong retention and subscription revenue.' },
      function: 'Builds prayer apps, devotional platforms, and digital spiritual formation tools',
      dysregulation: 'Commodification of prayer, app-mediated spirituality replacing communal worship, subscription fatigue, data privacy with prayer requests, AI devotional accuracy, secular mindfulness competition',
      expectedTypes: [
        { type: 'Digital Prayer & Spiritual Formation', reason: 'Hallow (Catholic prayer app, $100M+ raised), Pray.com (prayer + sleep), Abide (guided meditation), Lectio 365 (24-7 Prayer), First 5 (Proverbs 31 Ministries), She Reads Truth/He Reads Truth, Echo Prayer, PrayerMate', confidence: 0.85 }
      ]
    },
    'OP_DHS_CVE': {
      fullName: 'DHS CVE Operations', label: 'Countering Violent Extremism Programs', tier: 'operational',
      neuroTranslation: { inNeurology: 'Preventive intervention circuit — detects early radicalization signals and deploys targeted interventions before violent threshold.', inBusiness: 'DHS CVE is $20M+ in annual TVTP grants plus broader CT infrastructure. Market: program design (Booz Allen, RAND), intervention services, social media monitoring, off-ramp programs, evaluation research.' },
      function: 'Manages DHS Targeted Violence and Terrorism Prevention (TVTP) programs',
      dysregulation: 'Community trust deficit (Muslim communities view programs as surveillance), evaluation challenges, political targeting bias, funding instability, First Amendment tensions',
      expectedTypes: [
        { type: 'Countering Violent Extremism Programs', reason: 'DHS Center for Prevention Programs and Partnerships (CP3), TVTP grant program ($20M+ annual), FBI Domestic Terrorism Operations Unit, DOJ Community Relations Service, NCTC (National Counterterrorism Center), Booz Allen Hamilton CVE consulting, Leidos CT analytics', confidence: 0.85 },
        { type: 'Mosque and faith community-based CVE intervention programs', reason: 'DHS TVTP funds community-level programs where imams, pastors, and rabbis serve as intervention partners. Mosque-based mentoring, faith community bystander training, and religious leader de-escalation are religion-native CVE pathways. Distinct from federal program administration.', confidence: 0.78 }
      ]
    },
    'OP_FBI_DT': {
      fullName: 'FBI Domestic Terrorism Operations', label: 'FBI Religious Extremism Investigations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Threat detection and neutralization — identifies radicalized nodes past operational planning threshold and deploys targeted intervention.', inBusiness: 'FBI domestic terrorism investigation is permanent and growing. 200+ JTTFs, DTOU, and intelligence contracts drive demand for CT consulting, analytics, SIGINT/HUMINT support, and academic partnerships.' },
      function: 'Manages FBI investigations of religiously-motivated domestic terrorism',
      dysregulation: 'Informant overreach (entrapment), classification bias, intel sharing failures between federal/local, political pressure on priorities, First Amendment monitoring boundaries',
      expectedTypes: [
        { type: 'FBI Religious Extremism Investigations', reason: 'FBI Domestic Terrorism Operations Unit (DTOU), Joint Terrorism Task Forces (JTTFs, 200+ nationwide), FBI Counterterrorism Division, FBI Intelligence Analysts, George Washington Program on Extremism (academic partner), National Consortium for the Study of Terrorism (START/University of Maryland)', confidence: 0.85 }
      ]
    },
    'OP_EUROPOL_TE': {
      fullName: 'Europol TE-SAT Operations', label: 'European Counter-Terrorism Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Multi-national threat assessment and intelligence sharing — aggregates signals from sovereign subsystems into unified situational awareness.', inBusiness: 'Europol TE-SAT is the European terrorism reference standard. ECTC, EU IRU, and RAN create demand for policy consulting, platform compliance, research, and deradicalization design across 27 states.' },
      function: 'Manages European counter-terrorism assessment and religiously-motivated extremism tracking',
      dysregulation: 'Intelligence sharing barriers, inconsistent extremism definitions, content moderation failures, returning foreign fighters, political instrumentalization of threat levels',
      expectedTypes: [
        { type: 'European Counter-Terrorism Assessment', reason: 'Europol TE-SAT (EU Terrorism Situation and Trend Report), EU Counter-Terrorism Coordinator, Europol European Counter Terrorism Centre (ECTC), EU Internet Referral Unit (EU IRU), Radicalisation Awareness Network (RAN)', confidence: 0.85 }
      ]
    },
    'OP_DERAD': {
      fullName: 'Deradicalization Programs', label: 'Exit Programs & Intervention Services', tier: 'operational',
      neuroTranslation: { inNeurology: 'Rehabilitation and re-integration — reverses radicalization by providing alternative identity frameworks, social connection, and cognitive restructuring.', inBusiness: 'Deradicalization serves government programs, NGOs, and tech-enabled intervention. Saudi Arabia\'s MbN Center, Aarhus Model, EXIT programs, Moonshot CVE, Life After Hate. Market: program design, counselor training, evaluation, digital intervention.' },
      function: 'Manages deradicalization and disengagement programs for religiously-radicalized individuals',
      dysregulation: 'Recidivism (10-20%), ideological vs. behavioral disengagement debate, community resistance, insufficient post-exit support, political controversy over targeting',
      expectedTypes: [
        { type: 'Exit Programs & Intervention Services', reason: 'EXIT programs (Germany, Sweden, Denmark), Saudi Arabia Mohammed bin Naif Counseling and Care Center, Indonesia BNPT deradicalization, UK Prevent/Channel program, Moonshot CVE (tech-enabled intervention), Life After Hate (U.S.), Aarhus Model (Denmark)', confidence: 0.85 },
        { type: 'Religious authority-led theological counter-radicalization', reason: 'Imams in Saudi MbN Center provide theological rebuttals to extremist interpretation. Indonesian BNPT uses pesantren leaders. UK Prevent uses mosque-based mentors. The intervention authority comes from religious standing — this is religion-native deradicalization where the cleric IS the tool.', confidence: 0.8 }
      ]
    },
    'OP_USCIRF': {
      fullName: 'USCIRF Operations', label: 'International Religious Freedom Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'External environment monitoring — scans conditions across territories producing standardized assessments informing central authority\'s response.', inBusiness: 'USCIRF\'s annual report and CPC designations directly affect U.S. foreign policy, trade, and sanctions. Market: policy research, advocacy, diplomatic consulting, USAID/State religious freedom programming.' },
      function: 'Monitors international religious freedom conditions and recommends U.S. policy responses',
      dysregulation: 'Inconsistent enforcement (Saudi as CPC and ally), appointment controversies, limited leverage on worst offenders (China, DPRK), budget constraints, cultural imperialism accusations',
      expectedTypes: [
        { type: 'International Religious Freedom Monitoring', reason: 'U.S. Commission on International Religious Freedom (USCIRF, Congressionally-mandated), State Department Office of International Religious Freedom (IRF), Annual Report on International Religious Freedom, Countries of Particular Concern (CPC) designations', confidence: 0.85 }
      ]
    },
    'OP_OPEN_DOORS': {
      fullName: 'Open Doors Operations', label: 'Christian Persecution Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Persecution detection and alert — monitors hostile conditions targeting a population and generates awareness signals for protective response.', inBusiness: 'Christian persecution monitoring drives advocacy, fundraising, and lobbying. Open Doors\' World Watch List is cited by USCIRF, Congress, and media. Market: research, advocacy campaigns, direct aid, asylum legal assistance.' },
      function: 'Monitors Christian persecution globally through the World Watch List',
      dysregulation: 'Methodology disputes, advocacy fatigue, selective attention to Christian persecution, fundraising leveraging persecution imagery, access challenges in worst countries',
      expectedTypes: [
        { type: 'Christian Persecution Monitoring', reason: 'Open Doors International (World Watch List ranks 50 worst countries), International Christian Concern (ICC), Aid to the Church in Need (ACN), Voice of the Martyrs, Release International, Middle East Concern, Barnabas Fund, CSW (Christian Solidarity Worldwide)', confidence: 0.85 }
      ]
    },
    'OP_PEW_RESTRICT': {
      fullName: 'Pew Restrictions Monitoring', label: 'Government & Social Restrictions Indices', tier: 'operational',
      neuroTranslation: { inNeurology: 'Quantitative environmental assessment — measures external constraint using standardized metrics across 198 territories.', inBusiness: 'Pew\'s GRI and SHI are gold standard for religious freedom measurement. Cited by every government, NGO, and academic institution. ARDA and Forum 18 complement. Market: research methodology, data collection, index construction, policy analysis.' },
      function: 'Tracks government restrictions and social hostilities involving religion globally',
      dysregulation: 'Data lag (annual cycle), measurement challenges in closed societies, weighting debates, government pushback, resource constraints',
      expectedTypes: [
        { type: 'Government & Social Restrictions Indices', reason: 'Pew Research Center Government Restrictions Index (GRI) and Social Hostilities Index (SHI), covering 198 countries; Association of Religion Data Archives (ARDA) restriction measures; Forum 18 (Norway, religious freedom in former Soviet states)', confidence: 0.85 }
      ]
    },
    'OP_PEW_RELIGION': {
      fullName: 'Pew Religion Research', label: 'Pew Religious Landscape Studies', tier: 'operational',
      neuroTranslation: { inNeurology: 'Population census and demographic mapping — provides baseline measurement of system composition, distribution, and trajectory.', inBusiness: 'Pew\'s Religion & Public Life Project produces definitive U.S. and global religious demographics. Religious Landscape Study and Global Religious Futures are cited everywhere. This data drives denominational strategy, church planting, and missionary deployment.' },
      function: 'Produces definitive U.S. and global religious demographics research',
      dysregulation: 'Survey methodology challenges with small minorities, declining response rates, self-report bias, inability to capture nuanced beliefs, data access costs',
      expectedTypes: [
        { type: 'Pew Religious Landscape Studies', reason: 'Pew Research Center Religion & Public Life Project (Religious Landscape Study, Global Religious Futures, America’s Changing Religious Landscape) — the reference standard cited by every government, NGO, and media organization', confidence: 0.85 }
      ]
    },
    'OP_ARDA': {
      fullName: 'ARDA Research Operations', label: 'Association of Religion Data Archives', tier: 'operational',
      neuroTranslation: { inNeurology: 'Data archive and longitudinal memory — stores structured historical records enabling trend analysis and institutional memory across decades.', inBusiness: 'ARDA (Penn State) is the largest free religious data archive. National Congregations Study provides congregation-level data. U.S. Religion Census maps every county. Market: data infrastructure, methodology, analytical tools.' },
      function: 'Maintains religious data archives and congregation-level research datasets',
      dysregulation: 'Funding instability, data standardization challenges, congregation-level gaps, limited non-Christian longitudinal data, access barriers for practitioners',
      expectedTypes: [
        { type: 'Association of Religion Data Archives', reason: 'ARDA (Association of Religion Data Archives, Penn State), National Congregations Study (NCS, Duke/Mark Chaves), U.S. Religion Census (ASARB), World Religion Database (Gordon-Conwell/Boston University), Barna Group church health research', confidence: 0.85 }
      ]
    },
    'OP_BARNA': {
      fullName: 'Barna Group Research', label: 'Church Health & Cultural Research', tier: 'operational',
      neuroTranslation: { inNeurology: 'Cultural diagnostic and sentiment analysis — measures health, engagement, and trajectory of the network\'s relationship with its environment.', inBusiness: 'Barna Group is the most influential applied research firm in the church market. Studies on youth disengagement, pastoral burnout, and cultural trends directly shape strategy. Market: subscription research, custom studies, consulting, speaking/publishing.' },
      function: 'Produces church health, cultural trends, and faith/culture intersection research',
      dysregulation: 'Methodology criticism (sample sizes), findings weaponized in culture war, research-to-implementation gap, client capture bias, declining young adult participation',
      expectedTypes: [
        { type: 'Church Health & Cultural Research', reason: 'Barna Group (founded by George Barna, leading church culture researcher), Lifeway Research (SBC-affiliated, Ed Stetzer), Hartford Institute for Religion Research, PRRI (Public Religion Research Institute, Robert P. Jones), Springtide Research Institute (youth and religion)', confidence: 0.85 }
      ]
    },
    'OP_BIBLE_SOCIETY': {
      fullName: 'Bible Society Operations', label: 'Bible Translation & Distribution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Canonical text production and distribution — ensures foundational operating instructions are available in every language the network requires.', inBusiness: 'Bible translation/distribution is $500M+. Gideons distributed 2B+. Wycliffe/SIL translates into 3,000+ languages. YouVersion (600M+ installs) transformed digital access. Market: translation, printing, platform development, distribution logistics.' },
      function: 'Manages global Bible translation, production, and distribution',
      dysregulation: 'Translation controversy (gender-inclusive language), copyright disputes, digital disruption of print, persecution-context risks, declining engagement despite ubiquitous access',
      expectedTypes: [
        { type: 'Bible Translation & Distribution', reason: 'United Bible Societies (150+ national Bible societies), American Bible Society (est. 1816), Biblica (NIV publisher), Gideons International (2B+ Bibles distributed), The Seed Company, Faith Comes By Hearing (Audio Bible, 1,700+ languages)', confidence: 0.85 },
        { type: 'Scripture translation linguistics and minority language preservation', reason: 'Wycliffe/SIL International deploys 4,000+ linguists for Bible translation into minority languages — often the first written form of those languages. Translation work includes alphabet creation, dictionary development, and literacy programs. Bible translation IS language preservation for 1,000+ minority languages.', confidence: 0.8 }
      ]
    },
    'OP_CHRISTIAN_MUSIC': {
      fullName: 'Christian Music Industry', label: 'Worship Music & CCM Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Emotional regulation and communal synchronization — uses rhythmic auditory input to align emotional states across large groups.', inBusiness: 'Christian music is $1B+. CCLI licenses 250K+ churches. Hillsong, Bethel, Elevation, Maverick City dominate. Capitol CMG is the largest label. Licensing generates recurring fees from every singing church.' },
      function: 'Manages Christian worship music, CCM industry, and licensing',
      dysregulation: 'Worship leader scandals (Hillsong), CCLI compliance gaps, worship homogenization, artist burnout, streaming revenue inadequacy, racial division (CCM vs. gospel)',
      expectedTypes: [
        { type: 'Worship Music & CCM Operations', reason: 'CCLI (Christian Copyright Licensing International, 250K+ churches licensed), Capitol CMG (Universal, Hillsong, Chris Tomlin), Centricity Music, Bethel Music, Elevation Worship, Maverick City Music, Integrity Music, Maranatha! Music', confidence: 0.85 },
        { type: 'CCLI licensing and congregational worship song administration', reason: 'CCLI (Christian Copyright Licensing International) licenses 250K+ churches to project/print song lyrics and stream worship music. CCLI Top 25 list drives which songs churches sing. SongSelect provides chord charts. This is a religion-native intellectual property system that exists nowhere else.', confidence: 0.82 }
      ]
    },
    'OP_PRISON_MINISTRY': {
      fullName: 'Prison Ministry Operations', label: 'Correctional Chaplaincy & Reentry', tier: 'operational',
      neuroTranslation: { inNeurology: 'Rehabilitation and re-integration for isolated nodes — reconnects severed connections providing alternative behavioral programming.', inBusiness: 'Prison ministry serves 2M+ incarcerated. Prison Fellowship operates in 120+ countries. Market: chaplaincy staffing, curriculum, reentry housing, faith-based recidivism reduction programs competing for government funding on outcomes.' },
      function: 'Manages prison ministry, correctional chaplaincy, and faith-based reentry programs',
      dysregulation: 'Proselytization concerns, First Amendment establishment clause challenges, chaplaincy representation imbalances, recidivism measurement challenges, inadequately trained volunteers',
      expectedTypes: [
        { type: 'Correctional Chaplaincy & Reentry', reason: 'Prison Fellowship International (Chuck Colson legacy, 120+ countries), Kairos Prison Ministry, Good News Jail & Prison Ministry, Set Free (California), Celebrate Recovery (Saddleback), Federal Bureau of Prisons chaplaincy, state correctional chaplain systems', confidence: 0.85 },
        { type: 'Denominational endorsement for correctional chaplaincy', reason: 'Every prison chaplain must be endorsed by a recognized denominational body. Federal BOP and state DOCs require endorsement through denominational agencies (SBC NAMB, Catholic Archdiocese for Military Services, JWB Jewish Chaplains Council). Endorsement is the religion-native credentialing gatekeep for institutional chaplaincy.', confidence: 0.8 }
      ]
    },
    'OP_FAITH_BASED_INVEST': {
      fullName: 'Faith-Based Investment', label: 'ESG, SRI & Faith-Aligned Investing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Values-constrained resource allocation — applies ethical filter screening out inputs conflicting with the system\'s moral principles.', inBusiness: 'Faith-based investing is $100B+. GuideStone ($22B), Wespath ($28B), Church Pension ($15B). Praxis, Eventide, Azzad, Ave Maria serve retail. ICCR coordinates shareholder advocacy. Market: ESG screening, sharia compliance, values-aligned portfolios, engagement consulting.' },
      function: 'Manages faith-based investment screening, ESG integration, and values-aligned portfolios',
      dysregulation: 'Greenwashing/faithwashing, performance vs. values tradeoff, inconsistent screening criteria, proxy voting alignment, fossil fuel divestment tension',
      expectedTypes: [
        { type: 'ESG, SRI & Faith-Aligned Investing', reason: 'Praxis Mutual Funds (Mennonite-founded), GuideStone Funds (SBC, $22B), Eventide Asset Management, Inspire Investing, Azzad Asset Management (Islamic), Timothy Plan, Ave Maria Mutual Funds (Catholic), Interfaith Center on Corporate Responsibility (ICCR)', confidence: 0.85 },
        { type: 'Denominational pension fund investment policy and stewardship', reason: 'GuideStone ($22B/SBC), Wespath ($28B/UMC), Church Pension Group ($15B/Episcopal), Board of Pensions (PCUSA) — each denominational pension fund has faith-based investment screens and proxy voting policies shaped by denominational social teaching. Investment policy IS theology in institutional practice.', confidence: 0.8 }
      ]
    },
    'OP_HALAL_CERT': {
      fullName: 'Halal Certification Operations', label: 'Global Halal Certification & Standards', tier: 'operational',
      neuroTranslation: { inNeurology: 'Compliance verification and quality assurance — certifies inputs meet purity standards before consumption pathway.', inBusiness: 'Global halal industry is $2.5T+ across food, cosmetics, pharma, finance. Certification is the gatekeeping mechanism. Market: auditing, lab testing, traceability, halal tourism accreditation. Every company wanting 1.8B Muslim consumers needs certification.' },
      function: 'Manages halal certification, standards development, and compliance auditing',
      dysregulation: 'Certification inconsistency between countries, fraudulent claims, logo counterfeiting, traceability failures, political weaponization (India BJP targeting), cross-contamination liability',
      expectedTypes: [
        { type: 'Global Halal Certification & Standards', reason: 'JAKIM (Malaysia, reference standard), BPJPH (Indonesia), GCC Standardization Organization (GSO), SMIIC (Standards and Metrology Institute for Islamic Countries), IFANCA (Islamic Food and Nutrition Council of America), Islamic Services of America (ISA)', confidence: 0.85 },
        { type: 'Halal slaughter (dhabihah) supervision and slaughterman training', reason: 'Halal slaughter requires a Muslim slaughterman pronouncing bismillah, animal facing qiblah. Certification bodies train and license dhabihun and place supervisors in abattoirs. This is a religion-native ritual practice embedded in the food supply chain.', confidence: 0.8 }
      ]
    },
    'OP_WAQF': {
      fullName: 'Waqf Administration Operations', label: 'Islamic Endowment & Waqf Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Perpetual endowment and intergenerational wealth transfer — locks assets into permanent charitable purpose generating income streams lasting centuries.', inBusiness: 'Waqf assets estimated $1T+ — land, buildings, investments dedicated to permanent purpose. Malaysia, Singapore, Turkey, Kuwait have sophisticated authorities. Market: valuation, investment management, compliance, fintech platforms. Centuries-old asset modernization creates development demand.' },
      function: 'Manages waqf (Islamic endowment) property, investment, and distribution',
      dysregulation: 'Historical loss through colonial confiscation, corruption in administration, underperforming investments, donor intent disputes, preservation vs. modernization tension',
      expectedTypes: [
        { type: 'Islamic Endowment & Waqf Management', reason: 'Malaysia JAWHAR (Department of Awqaf, Zakat, Hajj and Umrah), Singapore MUIS (Majlis Ugama Islam Singapura), Turkish General Directorate of Foundations (Vakıflar), Kuwait Awqaf Public Foundation, Waqf Fund (IDB), global waqf assets estimated $1T+', confidence: 0.85 },
        { type: 'Waqf property development and cash waqf modernization', reason: 'Traditional waqf (land/building endowment) is being modernized through cash waqf, sukuk waqf, and corporate waqf. Malaysia JAWHAR, Singapore MUIS, and IDB Waqf Fund lead innovation. Modernizing centuries-old waqf assets for contemporary revenue generation is a religion-native financial development challenge.', confidence: 0.78 }
      ]
    },
    'OP_ZAKAT': {
      fullName: 'Zakat Collection Operations', label: 'Zakat Collection & Distribution Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Mandatory redistribution — calculates obligatory output from every node above threshold and routes to specified deficit categories.', inBusiness: 'Zakat (2.5% of wealth) is estimated at $200B-$1T potential annually. State systems exist in Malaysia, Indonesia, Saudi, Pakistan. Market: calculation technology, collection platforms, distribution management, compliance auditing.' },
      function: 'Manages zakat (obligatory almsgiving) collection, calculation, and distribution',
      dysregulation: 'Massive collection gap (1-5% of potential), trust deficit in state systems, distribution transparency, eligible category disputes, platform fragmentation, terror financing compliance',
      expectedTypes: [
        { type: 'Zakat Collection & Distribution Systems', reason: 'Malaysia LZNK (state zakat authorities), BAZNAS (Indonesia national zakat body), Saudi General Authority of Zakat, Pakistan’s Zakat and Ushr system, National Zakat Foundation (UK, USA, Canada, Australia), LaZIS (Indonesia), Zakat Foundation of America', confidence: 0.85 },
        { type: 'Zakat-eligible category (asnaf) adjudication and distribution oversight', reason: 'Quran specifies 8 categories of zakat recipients (asnaf). Scholarly debate over modern application (can zakat fund infrastructure? scholarships? microfinance?) is adjudicated by fiqh councils. Distribution oversight ensures compliance with sharia categories — a native religious governance function.', confidence: 0.78 }
      ]
    },
    'OP_ISRAEL_DIASPORA': {
      fullName: 'Israel-Diaspora Relations', label: 'Israel-Diaspora Religious Politics', tier: 'operational',
      neuroTranslation: { inNeurology: 'Bilateral tension between homeland and distributed diaspora — identity, authority, and resource flows create permanent push-pull dynamics.', inBusiness: 'Israeli Chief Rabbinate controls marriage/conversion in Israel but is not recognized by Reform/Conservative. Western Wall disputes, conversion recognition, and Who Is A Jew generate legal, advocacy, and diplomatic demand. Post-October 7 intensified the relationship.' },
      function: 'Manages Israel-diaspora religious tensions, conversion recognition, and Western Wall disputes',
      dysregulation: 'Reform/Conservative non-recognition, Western Wall litigation, conversion crisis, diaspora criticism causing donor revolt, Haredi military exemption resentment',
      expectedTypes: [
        { type: 'Israel-Diaspora Religious Politics', reason: 'Jewish Agency for Israel (JAFI), World Zionist Organization, Israel’s Ministry of Diaspora Affairs, Nativ (conversion in Israel), Women of the Wall, Ne’emanei Torah Va’Avodah (religious pluralism), Hiddush (religious freedom in Israel)', confidence: 0.85 },
        { type: 'Israeli Chief Rabbinate marriage and conversion monopoly', reason: 'The Israeli Rabbinate controls who can marry in Israel (no civil marriage), whose conversions are recognized, and kashrut certification. Non-Orthodox Jews cannot marry through the Rabbinate. This monopoly drives litigation, advocacy (Hiddush, IRAC), and political conflict. A uniquely Israeli religion-state institution.', confidence: 0.82 }
      ]
    },
    'OP_AFRICAN_CHRISTIANITY': {
      fullName: 'African Christianity Operations', label: 'African Independent & Pentecostal Churches', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fastest-growing cluster — high-energy personality-driven nodes rapidly expanding, often bypassing established governance.', inBusiness: 'Africa is where Christianity\'s center shifted. RCCG has 14K+ parishes globally. Prosperity gospel drives massive revenue in extreme poverty contexts. Market: franchise operations, media, conferences, and — increasingly — governance consulting as scandals emerge.' },
      function: 'Manages African independent churches, Pentecostal growth, and prosperity gospel movements',
      dysregulation: 'Prosperity gospel exploitation of poor, pastor-as-CEO without accountability, miracle fraud, tithing pressure on subsistence income, political capture, sexual abuse in unregulated settings',
      expectedTypes: [
        { type: 'African Independent & Pentecostal Churches', reason: 'Redeemed Christian Church of God (RCCG, Pastor Adeboye, 14K+ parishes globally), Winners Chapel (David Oyedepo), Christ Embassy (Chris Oyakhilome), Celestial Church of Christ, Zion Christian Church (ZCC, South Africa, 6M+), MFM (Mountain of Fire), Church of Pentecost (Ghana)', confidence: 0.85 },
        { type: 'African Pentecostal Bible college and pastoral formation', reason: 'Pan Africa Christian University (Kenya), West Africa Theological Seminary, ECWA seminary, RCCG Bible colleges — training the pastoral workforce for the fastest-growing Christianity on earth. African theological education is distinct from Western seminary models.', confidence: 0.78 }
      ]
    },
    'OP_CHINESE_RELIGION': {
      fullName: 'Chinese Religious Operations', label: 'Chinese House Church & State Religion', tier: 'operational',
      neuroTranslation: { inNeurology: 'Suppressed but persistent underground network — operates below detection thresholds, maintaining function through distributed redundancy.', inBusiness: 'China has 60-100M Christians (mostly unregistered house churches), 20M+ Muslims (including persecuted Uyghurs), and CCP Sinicization policy. Market: religious freedom advocacy, underground church support, Uyghur documentation, geopolitical risk consulting.' },
      function: 'Monitors Chinese house church movement, Three-Self Church, and CCP religious policy',
      dysregulation: 'Uyghur genocide, house church crackdown, forced cross removal, CCP rewriting Bible/Quran, mosque demolition, surveillance technology in religious settings, leader detention',
      expectedTypes: [
        { type: 'Chinese House Church & State Religion', reason: 'Three-Self Patriotic Movement (state-approved Protestant), Chinese Catholic Patriotic Association, unregistered house church networks (estimated 60-100M Christians), CCP United Front Work Department religious affairs, Sinicization of religion policy, Uyghur Muslim persecution in Xinjiang', confidence: 0.85 },
        { type: 'Underground house church pastoral training networks', reason: 'Because state-approved seminaries require CCP loyalty, unregistered house churches operate clandestine pastoral training — networks linked to Wang Yi Early Rain Covenant Church, overseas distance programs. This is persecuted-faith continuity infrastructure: the leadership reproduction function under suppression.', confidence: 0.78 }
      ]
    },
    'OP_LATIN_AMERICA_REL': {
      fullName: 'Latin American Religion', label: 'Catholic-Evangelical Competition in Latin America', tier: 'operational',
      neuroTranslation: { inNeurology: 'Competitive displacement — established network (Catholicism) losing share to faster-growing competitor (Pentecostalism) offering higher intensity and lower barriers.', inBusiness: 'Countries 90%+ Catholic in 1970 are now 30%+ evangelical. Brazilian Assembleia de Deus has 22M+. Pentecostal parties hold legislative power. Market: church planting, media, political consulting, Catholic re-evangelization.' },
      function: 'Monitors Catholic-Evangelical competition, liberation theology, and Pentecostal growth in Latin America',
      dysregulation: 'Prosperity gospel exploitation, Pentecostal political corruption, Catholic decline without replacement services, UCKG financial scandals, cultural identity crisis, liberation theology suppression',
      expectedTypes: [
        { type: 'Catholic-Evangelical Competition in Latin America', reason: 'Brazilian Assembleia de Deus (22M+ members), Universal Church of the Kingdom of God (UCKG, Edir Macedo), CELAM (Latin American Episcopal Conference), Pentecostal growth (30%+ of Guatemala, Brazil, Chile now evangelical), Latin American Council of Churches', confidence: 0.85 },
        { type: 'Latin American Pentecostal church planting and denominational formation', reason: 'Assembleia de Deus (Brazil, 22M+), UCKG global expansion, new Latin American denominations forming — church planting at massive scale is reshaping the religious map. This is the denomination-native multiplication function.', confidence: 0.78 }
      ]
    },
    'OP_SOUTH_ASIAN_REL': {
      fullName: 'South Asian Religious Tensions', label: 'India-Pakistan Religious Nexus', tier: 'operational',
      neuroTranslation: { inNeurology: 'Multi-tradition collision zone — overlapping territorial claims create permanent friction with political entrepreneurs exploiting fault lines.', inBusiness: 'South Asia is the most religiously diverse and volatile region — 1.4B people across Hindu, Muslim, Sikh, Buddhist traditions. Market: conflict analysis, political risk, minority rights advocacy, interfaith programming, security services.' },
      function: 'Monitors Hindu-Muslim-Sikh religious tensions in South Asia and diaspora',
      dysregulation: 'Hindu-Muslim violence (Delhi 2020), anti-conversion law enforcement, Kashmir tension, Khalistan separatism, Rohingya persecution, Sri Lankan Buddhist-Muslim violence',
      expectedTypes: [
        { type: 'India-Pakistan Religious Nexus', reason: 'India Ministry of Minority Affairs, Pakistan Ministry of Religious Affairs, India’s National Commission for Minorities, Tablighi Jamaat (Islamic missionary movement, HQ in India), Uniform Civil Code debate, CAA/NRC (Citizenship Amendment Act), Ram Mandir-Babri Masjid resolution', confidence: 0.85 }
      ]
    },
    'OP_MIDEAST_INTERFAITH': {
      fullName: 'Middle East Interfaith', label: 'Abrahamic Interfaith in MENA Region', tier: 'operational',
      neuroTranslation: { inNeurology: 'Diplomatic bridge between hostile networks — builds connections across conflict boundaries requiring sustained investment and trust.', inBusiness: 'Middle East interfaith is high-stakes diplomacy driven by state investment. Abrahamic Family House ($100M+, Abu Dhabi), KAICIID, Document on Human Fraternity. Market: diplomatic programming, conferences, academic centers, curriculum development.' },
      function: 'Manages interfaith initiatives in the Middle East and North Africa',
      dysregulation: 'Interfaith as authoritarian reputation laundering (Saudi, UAE), lack of grassroots buy-in, October 7 destroying trust, tokenism, oil-state funding dependency',
      expectedTypes: [
        { type: 'Abrahamic Interfaith in MENA Region', reason: 'KAICIID (King Abdullah Centre, now in Lisbon), Abrahamic Family House (Abu Dhabi, opened 2023), Marrakesh Declaration (2016, Muslim-minority rights), IFYC programming in MENA, Document on Human Fraternity (Pope Francis + Grand Imam), Alliance of Civilizations (UNAOC)', confidence: 0.85 },
        { type: 'Abrahamic Family House and state-sponsored interfaith institutions', reason: 'Abu Dhabi Abrahamic Family House (mosque, church, synagogue on one campus, opened 2023), KAICIID (Saudi-funded, now Lisbon), Document on Human Fraternity (Pope Francis + Grand Imam) — state-invested interfaith institutions with physical infrastructure and ongoing programming budgets.', confidence: 0.78 }
      ]
    },
    'OP_CHURCH_INSURANCE': {
      fullName: 'Religious Institution Insurance', label: 'Church Mutual, Brotherhood Mutual & Religious Risk', tier: 'operational',
      neuroTranslation: { inNeurology: 'Risk pooling and loss absorption — spreads financial impact across the network preventing single-node catastrophe from propagating.', inBusiness: 'Church insurance is specialized: abuse liability, stained glass valuation, volunteer coverage, pastoral counseling malpractice. Church Mutual, Brotherhood Mutual, GuideOne dominate. Post-abuse, carriers require safeguarding protocols as coverage conditions — creating compliance market.' },
      function: 'Manages insurance coverage for religious institutions, abuse liability, and property protection',
      dysregulation: 'Abuse liability escalation, carrier withdrawal from worst-risk dioceses, premium spikes, coverage disputes over historical claims, aging building property challenges, volunteer workers comp gaps',
      expectedTypes: [
        { type: 'Church Mutual, Brotherhood Mutual & Religious Risk', reason: 'Church Mutual Insurance (largest U.S. church insurer), Brotherhood Mutual Insurance, GuideOne Insurance, Philadelphia Insurance Companies (religious institutions program), Lloyd’s of London syndicates (religious abuse liability), Sovereign Insurance (Canada)', confidence: 0.85 },
        { type: 'Abuse prevention accreditation and church safety certification', reason: 'Church Mutual and Brotherhood Mutual now require SafeChurch, MinistrySafe, or Praesidium accreditation as conditions of coverage. Insurance carriers have become the de facto regulators of church safety standards — requiring background checks, training, and policy adoption. This is religion-native risk management.', confidence: 0.8 }
      ]
    },
    'OP_LILLY': {
      fullName: 'Lilly Endowment Religion Programs', label: 'Lilly Endowment Religious Grantmaking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Dominant resource injection node — single massive endowment funding disproportionate share of the system\'s innovation and support.', inBusiness: 'Lilly Endowment ($18B+) is the largest religion funder on earth. Thriving in Ministry ($93M), Pathways for Tomorrow ($500M). When Lilly funds a program it becomes the standard. Market: grant writing, program design, evaluation, capacity building.' },
      function: 'Manages largest U.S. religion-focused philanthropic grantmaking',
      dysregulation: 'Funding dependency (subsectors collapse on priority shifts), Indianapolis-centric worldview, Christian-Protestant focus, evaluation challenges, grantee zero-sum competition',
      expectedTypes: [
        { type: 'Lilly Endowment Religious Grantmaking', reason: 'Lilly Endowment ($18B+, Indianapolis, largest religion grantmaker in the world), programs include Thriving in Ministry ($93M), Thriving Congregations, Pathways for Tomorrow (seminary support $500M), Youth Theology initiatives', confidence: 0.85 }
      ]
    },
    'OP_TEMPLETON': {
      fullName: 'Templeton Foundation Operations', label: 'Templeton Religion-Science Grantmaking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Science-religion bridge — funds research at the intersection of empirical investigation and ultimate questions, creating new knowledge pathways.', inBusiness: 'Templeton ($3.4B endowment, $200M+ grants/year) funds science-religion dialogue, virtue research, and the Templeton Prize ($1.4M). Market: interdisciplinary research, conferences, academic publishing, program evaluation.' },
      function: 'Manages religion-science intersection research and grantmaking',
      dysregulation: 'Criticism from secular scientists and religious conservatives, grantee dependency, family political conservatism affecting perception, debate over science-religion dialogue authenticity',
      expectedTypes: [
        { type: 'Templeton Religion-Science Grantmaking', reason: 'John Templeton Foundation ($3.4B endowment, $200M+ annual grantmaking), Templeton Religion Trust, Templeton World Charity Foundation, programs include Big Questions, science-religion dialogue, character virtue research, Templeton Prize ($1.4M)', confidence: 0.85 }
      ]
    },
    'OP_HOBBY_LOBBY': {
      fullName: 'Green Family Religious Philanthropy', label: 'Hobby Lobby & Museum of the Bible', tier: 'operational',
      neuroTranslation: { inNeurology: 'Corporate-religious hybrid — commercial enterprise with operating principles driven by owner\'s convictions, blurring secular-religious boundary.', inBusiness: 'Green family (Hobby Lobby $7B+ revenue). Museum of the Bible ($500M). Gloo (church data). Hobby Lobby v. Burwell established corporate religious beliefs under RFRA. Market: faith-based corporate legal advisory, cultural institution management, religious philanthropy.' },
      function: 'Manages Green family faith-based corporate philanthropy and cultural institutions',
      dysregulation: 'Museum provenance scandals (looted Iraqi artifacts), contraceptive mandate controversy, Gloo privacy concerns, profit vs. mission tension, corporate scale advancing specific religious agenda',
      expectedTypes: [
        { type: 'Hobby Lobby & Museum of the Bible', reason: 'Hobby Lobby (Green family, $7B+ revenue, faith-based corporate policy), Museum of the Bible (Washington D.C., $500M), Gloo (church data platform, Green family-backed), Mardel Christian & Education stores, Every Tribe Every Nation (Bible access), Hobby Lobby v. Burwell (Supreme Court religious liberty case)', confidence: 0.85 }
      ]
    },
    'OP_USIP_RELIGION': {
      fullName: 'USIP Religion Programs', label: 'U.S. Institute of Peace Religion & Peacebuilding', tier: 'operational',
      neuroTranslation: { inNeurology: 'Applied peacebuilding research and field implementation — translates academic understanding of religious conflict into operational programs.', inBusiness: 'USIP Religion and Inclusive Societies funds research and field programs. Network for Religious and Traditional Peacemakers coordinates implementers. Market: conflict analysis, program design, field implementation, leader training, monitoring/evaluation.' },
      function: 'Manages religion and peacebuilding research and field programs',
      dysregulation: 'Funding instability across administrations, outcome measurement difficulty, peacebuilding as intelligence cover risk, religious leader resistance, Western methodology bias',
      expectedTypes: [
        { type: 'U.S. Institute of Peace Religion & Peacebuilding', reason: 'U.S. Institute of Peace (USIP) Religion and Inclusive Societies program, USIP’s Peacebuilding in Muslim Societies initiative, Network for Religious and Traditional Peacemakers (Finland), Interfaith Peacebuilding Guide, USIP religion and conflict courses', confidence: 0.85 }
      ]
    },
    'OP_SEARCH_COMMON': {
      fullName: 'Search for Common Ground Religion', label: 'Interfaith Conflict Transformation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Conflict transformation — reframes adversarial dynamics by identifying shared interests and building cooperative pathways.', inBusiness: 'Interfaith conflict transformation operates in 40+ countries. Search for Common Ground, ICG, Mercy Corps, Catholic Peacebuilding Network lead. Market: analysis, dialogue facilitation, media production, academic research. Funded by USAID, European donors, foundations.' },
      function: 'Manages interfaith conflict transformation and peacebuilding programs',
      dysregulation: 'Donor-driven programming, peacebuilding fatigue in chronic zones, tokenistic dialogue, organizational security in conflict zones, evaluation inadequacy',
      expectedTypes: [
        { type: 'Interfaith Conflict Transformation', reason: 'Search for Common Ground (40+ countries), International Crisis Group (religion and conflict analysis), Mercy Corps (interfaith programming), Catholic Peacebuilding Network (Notre Dame), Berkley Center for Religion (Georgetown), Kroc Institute for International Peace Studies (Notre Dame)', confidence: 0.85 }
      ]
    },
    'OP_BLASPHEMY_LAW': {
      fullName: 'Blasphemy Law Monitoring', label: 'Blasphemy & Anti-Conversion Legislation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Speech suppression circuit — enforces boundaries on what can be said about the system, penalizing outputs deemed threatening.', inBusiness: 'Blasphemy/anti-conversion laws exist in 80+ countries. Pakistan\'s 295-C carries death. India has laws in 8+ states. Russia\'s Yarovaya restricts missionary activity. Market: rights monitoring, legal defense, advocacy, academic freedom, asylum support.' },
      function: 'Monitors blasphemy laws, anti-conversion legislation, and state religious regulation',
      dysregulation: 'Accusations as vendetta tool (Pakistan mob violence), extrajudicial killings, chilling effect on scholarship, anti-conversion laws weaponized against minorities, EU hate speech creating unintended censorship',
      expectedTypes: [
        { type: 'Blasphemy & Anti-Conversion Legislation', reason: 'Pakistan Penal Code §295-C (blasphemy, death penalty), Indonesia blasphemy law (Jakarta Governor Ahok case), India anti-conversion laws (8+ states), Russia anti-missionary law (Yarovaya Law), EU hate speech laws intersecting religion, USCIRF blasphemy law monitoring', confidence: 0.85 }
      ]
    },
    'OP_STATE_RELIGION': {
      fullName: 'State Religion Operations', label: 'State Churches & Official Religion Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'State-network fusion — religious processing wired into governing authority with bidirectional control: state funds religion, religion legitimizes state.', inBusiness: 'State-religion systems exist in 40+ countries. Market: church tax collection (Scandinavia, Germany), state-funded education, official chaplaincy, state property management, and minority rights advocacy.' },
      function: 'Monitors state-religion relationships, established churches, and state funding of religion',
      dysregulation: 'State co-optation (Russian Orthodox as Kremlin instrument), church tax resistance (Germany), establishment clause issues, minority persecution in state-religion systems, corruption from funding dependency',
      expectedTypes: [
        { type: 'State Churches & Official Religion Systems', reason: 'Church of England (established, Parliament approves bishops), Denmark Church Tax (Folkekirken), Saudi Arabia state Islam (Grand Mufti, Mutaween), Iran theocracy (Guardian Council, Assembly of Experts), Israel Chief Rabbinate (marriage, kashrut monopoly), Thai Buddhism (Sangha Act)', confidence: 0.85 },
        { type: 'Church tax collection and state-funded religious administration', reason: 'Germany, Denmark, Sweden, Finland, and Switzerland collect church tax through the state revenue system. German Kirchensteuer generates 12B+ euros annually for Catholic and Protestant churches. This is a state-religion administrative function with no parallel in separationist systems.', confidence: 0.8 }
      ]
    },
    'OP_TAX_EXEMPTION': {
      fullName: 'Religious Tax Exemption', label: 'Tax Exemption & Johnson Amendment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Privileged resource retention — system retains resources otherwise extracted by governing authority based on recognized social value.', inBusiness: 'U.S. religious tax exemption worth $71B+ annually. Johnson Amendment restricts political activity. Every exemption challenge generates legal, lobbying, and policy demand. Parsonage allowance affects 300K+ clergy.' },
      function: 'Monitors religious tax exemption status, political activity restrictions, and parsonage allowance',
      dysregulation: 'Calls to revoke exemption for discriminatory organizations, Johnson Amendment ambiguity, parsonage constitutional challenges, megachurch opacity, small church compliance burden, property tax lawsuits',
      expectedTypes: [
        { type: 'Tax Exemption & Johnson Amendment', reason: 'IRS §501(c)(3) religious organization exemption, Johnson Amendment (pulpit political activity restrictions), parsonage allowance (§107), Church Audit Procedures Act, Becket Fund tax exemption defense, International Center for Not-for-Profit Law, state property tax exemptions for houses of worship', confidence: 0.85 },
        { type: 'Parsonage allowance and clergy tax treatment', reason: 'IRC Section 107 allows ordained ministers to exclude housing costs from taxable income — the parsonage allowance affects 300K+ U.S. clergy. Freedom From Religion Foundation has challenged it repeatedly. Clergy dual tax status (self-employed for Social Security, employee for income tax) creates unique filing complexity. Religion-native tax treatment.', confidence: 0.78 }
      ]
    },
    'OP_AI_THEOLOGY': {
      fullName: 'AI & Theology Operations', label: 'AI-Assisted Theology & Digital Ethics', tier: 'operational',
      neuroTranslation: { inNeurology: 'AI interface with religious processing — AI generates theological content, answers doctrine, assists pastoral care in a domain defined by transcendence.', inBusiness: 'AI is entering religion through sermon tools, chatbot advisors, AI prayer, and research. Vatican issued Rome Call for AI Ethics. SBC ERLC produced AI statement. Market: ethics consulting, AI pastoral tools, debate about machine participation in religious functions.' },
      function: 'Monitors AI applications in theology, religious chatbots, and digital ethics',
      dysregulation: 'AI-generated heresy (incoherent outputs as authoritative), deepfake leaders, AI replacing pastoral presence, algorithmic bias, confession/prayer privacy, machine consciousness questions',
      expectedTypes: [
        { type: 'AI-Assisted Theology & Digital Ethics', reason: 'Vatican Pontifical Academy for Life (Rome Call for AI Ethics), Southern Baptist ERLC AI statement, AI-powered sermon tools, ChatGPT theology consultations, Faithlife AI biblical research, BibleAI, ethical AI frameworks from religious traditions', confidence: 0.85 }
      ]
    },
    'OP_RELIGION_DEFENSE': {
      fullName: 'Religion-Defense Nexus', label: 'Military Chaplaincy & Religious Conflict', tier: 'operational',
      neuroTranslation: { inNeurology: 'Religion-military interface — religious processing integrated into military through chaplaincy, moral injury treatment, and faith-based resilience.', inBusiness: 'U.S. Military Chaplain Corps (5,000+) is the largest clergy employer outside denominations. VA chaplaincy serves veterans. Market: chaplaincy staffing, moral injury programs, religious advisor training, military family support.' },
      function: 'Monitors military chaplaincy, religious dimensions of conflict, and faith-based military support',
      dysregulation: 'Religious coercion allegations (MRFF), denomination representation imbalances, moral injury inadequately addressed, religious literacy gaps in leadership, accommodation vs. cohesion tension',
      expectedTypes: [
        { type: 'Military Chaplaincy & Religious Conflict', reason: 'U.S. Military Chaplain Corps (Army, Navy, Air Force combined 5,000+), Armed Forces Chaplains Board, Military Religious Freedom Foundation (MRFF, Mikey Weinstein), National Conference on Ministry to the Armed Forces, VA chaplaincy, NATO religious advisor program', confidence: 0.85 },
        { type: 'Military chaplaincy endorsement and formation', reason: 'Armed Forces Chaplains Board, National Conference on Ministry to the Armed Forces, and 200+ endorsing agencies credential military chaplains. CPE training, unit ministry team operations, and denominational endorsement withdrawal are native religion-military interface functions.', confidence: 0.8 }
      ]
    },
    'OP_RELIGION_HEALTH': {
      fullName: 'Religion-Health Nexus', label: 'Faith-Based Healthcare Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Religion-healthcare fusion — religious institutions operating as delivery systems with values shaping clinical policy and governance.', inBusiness: 'Faith-based systems represent 1 in 6 U.S. hospital beds. CommonSpirit (140+ hospitals), Ascension (139). Catholic directives restricting reproductive care, merger controversies. Market: healthcare management, bioethics, directive compliance, mission integration.' },
      function: 'Manages faith-based healthcare systems and religious health networks',
      dysregulation: 'ERD conflicts with reproductive access, Catholic-secular merger controversies, rural hospital closures, mission vs. market tension, whistleblower claims about directive violations',
      expectedTypes: [
        { type: 'Faith-Based Healthcare Systems', reason: 'CommonSpirit Health (largest U.S. nonprofit health system, Catholic, 140+ hospitals), Ascension Health (Catholic, 139 hospitals), Adventist Health, Baptist Health, Trinity Health, Catholic Health Initiatives, Mercy Health — combined, faith-based hospitals represent 1 in 6 U.S. hospital beds', confidence: 0.85 },
        { type: 'Catholic Ethical and Religious Directives (ERD) compliance', reason: 'Catholic hospitals must follow the ERDs — 77 directives governing reproductive care, end-of-life decisions, sterilization, and cooperation with evil. Bishop approval required for Catholic-secular hospital mergers. ERD compliance officers are a role that exists only in faith-based healthcare. This is religion-native clinical governance.', confidence: 0.82 }
      ]
    },
    'OP_RELIGION_POLITICS': {
      fullName: 'Religion-Politics Nexus', label: 'Religious Lobbying & Political Engagement', tier: 'operational',
      neuroTranslation: { inNeurology: 'Religion-politics interface — the point where conviction converts into mobilization, voter behavior, advocacy, and lobbying.', inBusiness: 'Religious lobbying is $500M+. Faith and Freedom Coalition, FRC, Values Voter Summit dominate conservative. Sojourners, NETWORK serve progressive. Market: voter guides, lobbying compliance, political consulting, GOTV operations.' },
      function: 'Monitors religious lobbying, voter guides, and faith-based political mobilization',
      dysregulation: 'Christian nationalism blurring church-state separation, tax-exempt partisan activity, pulpit endorsements (Johnson Amendment), foreign religious lobbying, voter suppression as values advocacy',
      expectedTypes: [
        { type: 'Religious Lobbying & Political Engagement', reason: 'Faith and Freedom Coalition (Ralph Reed), Family Research Council, Values Voter Summit, Sojourners (progressive evangelical), NETWORK Catholic lobby, Interfaith Alliance, Americans United for Separation of Church and State, Christian Coalition legacy organizations', confidence: 0.85 },
        { type: 'Denominational voter guide and election-season mobilization', reason: 'Faith and Freedom Coalition voter guides (distributed in 100K+ churches), USCCB Forming Consciences for Faithful Citizenship, SBC ERLC issue briefs, Jewish Council for Public Affairs platforms — each denomination produces native voter education materials within Johnson Amendment constraints.', confidence: 0.78 }
      ]
    },
    'OP_CULT_MONITOR': {
      fullName: 'Cult Monitoring Operations', label: 'New Religious Movement Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Anomalous node detection and quarantine — identifies clusters deviating from acceptable parameters becoming harmful to members or network.', inBusiness: 'Cult monitoring tracks 10,000+ high-demand groups. ICSA is the academic reference. Cult Education Institute is the largest database. INFORM provides balanced assessment. Market: exit counseling, legal representation, research, family intervention.' },
      function: 'Monitors cults, new religious movements, and high-demand groups',
      dysregulation: 'Definition disputes (cult vs. NRM), First Amendment protection of abusive groups, reaching isolated members, exit counselor credentialing gaps, social media enabling recruitment, regulatory tool inadequacy (NXIVM)',
      expectedTypes: [
        { type: 'New Religious Movement Monitoring', reason: 'International Cultic Studies Association (ICSA), Cult Education Institute (Rick Ross), INFORM (UK, London School of Economics), Apologetics Index, Freedom of Mind Resource Center (Steven Hassan), ex-member support networks (r/exmormon, r/exjw, r/exmuslim)', confidence: 0.85 }
      ]
    },

    // ── MISSING MAJOR TRADITIONS — macro-civilizational weight correction ──

    'OP_LDS': {
      fullName: 'Church of Jesus Christ of Latter-day Saints', label: 'LDS Church Institutional Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Highly centralized command-and-control architecture with enormous resource reserves — operates with military-grade organizational discipline, top-down prophetic authority, and the largest institutional endowment per capita of any religious body on earth.', inBusiness: 'The LDS Church is the wealthiest religious institution per member in the world. Ensign Peak Advisors manages $100B+ in invested assets. The Church operates a $6B+ annual budget, BYU system (4 campuses, 60K+ students), Deseret Management Corporation (media, insurance, real estate, agribusiness), and a 50K+ full-time missionary force deployed globally. First Presidency authority is absolute — no congregational voting, no financial transparency requirement, no external audit.' },
      function: 'Manages LDS Church global operations, financial empire, and prophetic governance structure',
      dysregulation: 'Ensign Peak $100B whistleblower SEC fine ($5M, 2023), tithing transparency demands from members, declining U.S. growth despite global expansion, faith crisis driven by CES Letter and historical transparency (Gospel Topics Essays), LGBTQ+ policy driving youth exodus, leadership gerontocracy (average apostle age 75+)',
      expectedTypes: [
        { type: 'LDS Church institutional governance and financial management', reason: 'First Presidency and Quorum of the Twelve (15-member governing body), Presiding Bishopric (temporal affairs), Ensign Peak Advisors ($100B+), Deseret Management Corporation (Bonneville International, Deseret News, Beneficial Financial Group, AgReserves), Church Educational System (BYU, BYU-Idaho, BYU-Hawaii, Ensign College)', confidence: 0.90 },
        { type: 'LDS missionary operations and temple administration', reason: 'Missionary Training Centers (Provo, 10+ global sites), 50K+ full-time missionaries, 170+ operating temples with $1M-$100M+ construction costs each, genealogical operations (FamilySearch.org, largest genealogy database on earth, 8B+ records), Bishop storehouse and welfare system (Deseret Industries, LDS Humanitarian Services)', confidence: 0.88 },
        { type: 'LDS real estate and agribusiness operations', reason: 'Church-owned AgReserves (one of largest ranching operations in U.S. and Australia), City Creek Center (Salt Lake City, $1.5B mall), Deseret Ranches (Florida, 290K+ acres), Hawaii Polynesian Cultural Center, Temple Square operations — estimated $35B+ in real estate holdings globally', confidence: 0.82 }
      ]
    },
    'OP_JW': {
      fullName: 'Watchtower Bible and Tract Society', label: 'Jehovah\'s Witness / Watchtower Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Closed-loop high-control processing system — strictly regulates information input, social connections, and behavioral output. Members who deviate from protocol are severed from the network (disfellowshipping) with total social cutoff.', inBusiness: 'Jehovah\'s Witnesses (8.7M publishers, 20M+ attendees) operate through the Watchtower Bible and Tract Society, one of the most centralized and opaque religious organizations. Warwick NY headquarters controls doctrine, publications, Kingdom Hall construction, and judicial committees globally. The organization generates $1B+ annually through donations (no tithing — voluntary contributions), Kingdom Hall sales, and investment income. Legal exposure is massive: child sexual abuse settlements across multiple countries, blood transfusion wrongful death litigation, and shunning/disfellowshipping cases challenging free exercise boundaries.' },
      function: 'Manages Watchtower publishing, Kingdom Hall construction, circuit/district organization, and judicial committee governance',
      dysregulation: 'Australian Royal Commission finding 1,006 perpetrators never reported to police, $35M Montana child abuse verdict (2018), two-witness rule enabling abuse cover-up, disfellowshipping causing family destruction and suicides, blood transfusion deaths (children), Norway government stripping official recognition (2022), Russia banning JW as extremist organization (2017), declining membership in developed countries',
      expectedTypes: [
        { type: 'Watchtower organizational operations and publishing', reason: 'Watchtower Bible and Tract Society of New York/Pennsylvania, Warwick NY world headquarters (built 2016, $1B+ construction), JW.org (most-visited religious website globally), The Watchtower and Awake! magazines (circulation 80M+/issue in 300+ languages), kingdom Hall construction through Regional Building Committees', confidence: 0.88 },
        { type: 'Jehovah\'s Witness judicial governance and legal defense', reason: 'Congregation judicial committees (disfellowshipping tribunals), Branch Committee oversight in 90+ countries, Legal Department (Watchtower in-house counsel handles 1,000+ active cases globally), blood transfusion Hospital Liaison Committees, child safeguarding response to ARC/UK IICSA findings — one of the most legally active religious organizations in the world', confidence: 0.85 },
        { type: 'Ex-JW support and disfellowshipping impact services', reason: 'Ex-JW advocacy (JW Facts, Lloyd Evans, AAWA), disfellowshipping recovery support networks, r/exjw (100K+ members), shunning trauma therapy, cult recovery counseling — the exit pathway creates its own institutional ecosystem because total social cutoff means ex-members need replacement community infrastructure', confidence: 0.78 }
      ]
    },
    'OP_ANGLICAN': {
      fullName: 'Anglican Communion & Church of England', label: 'Anglican Global Communion & CoE Governance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Historically unified network now fracturing along doctrinal fault lines — the original hub (Canterbury) is losing authority as peripheral nodes (Global South) form an alternative governance structure, while the state-church wiring (Parliament) creates unique constraints no other tradition faces.', inBusiness: 'The Anglican Communion (85M members, 165 countries) is splitting. GAFCON (representing 85% of global Anglicans, predominantly African) has effectively separated from Canterbury over same-sex marriage. The Church of England itself is a state church — Parliament approves bishops, Church Commissioners manage \u00a310B+, 16,000 parishes generate massive property and HR obligations. The schism creates demand for property litigation, pension division, institutional restructuring, and parallel governance formation on both sides.' },
      function: 'Manages Church of England state-church governance, Church Commissioners investment portfolio, and Anglican Communion institutional unity',
      dysregulation: 'GAFCON schism (Global South primates refusing Canterbury authority), Church of England attendance collapse (680K average Sunday, down from 1.2M in 2000), safeguarding failures (IICSA report), clergy pension fund stress, 16,000 listed church buildings maintenance crisis (\u00a31B+ backlog), Living in Love and Faith sexuality debate gridlock',
      expectedTypes: [
        { type: 'Church of England institutional governance and state-church administration', reason: 'Archbishops\' Council, General Synod, Church Commissioners (\u00a310B+ assets), Church of England Pensions Board, 42 dioceses, Lambeth Palace operations, Lords Spiritual (26 bishops in House of Lords), Church Buildings Council managing 16,000 listed buildings', confidence: 0.88 },
        { type: 'Anglican Communion and GAFCON schism governance', reason: 'Anglican Consultative Council, Lambeth Conference (decennial), GAFCON (Global Anglican Future Conference, 85% of global Anglicans), Anglican Church in North America (ACNA, U.S. conservative breakaway), Church of Nigeria (Anglican, 18M+), Church of Uganda — the governance split requires parallel institutional infrastructure on both sides', confidence: 0.85 },
        { type: 'Anglican clergy formation and parish operations', reason: 'Church of England ordination training (30+ theological colleges and courses), Common Tenure clergy employment, Parochial Church Councils, parish share system (diocesan funding), Reader/Licensed Lay Ministry, Church Army — the parish operations layer serving 12,500 parishes', confidence: 0.80 }
      ]
    },
    'OP_ADVENTIST': {
      fullName: 'Seventh-day Adventist Church', label: 'Adventist Healthcare, Education & Global Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrated operations network that uniquely fuses healthcare delivery, educational institutions, and religious mission into a single organizational system — the religious conviction (health as sacred duty, Sabbath observance) directly drives the institutional model.', inBusiness: 'The Seventh-day Adventist Church (22M members, 200+ countries) operates the largest integrated Protestant healthcare and education system on earth. Adventist Health ($5B+ revenue, 80+ hospitals in U.S.), Loma Linda University and Medical Center, 8,800+ schools globally (the largest Protestant school system), and ADRA (Adventist Development and Relief Agency). The church\'s health theology (vegetarianism, abstinence, wellness) directly generates the institutional footprint — Loma Linda is a Blue Zone.' },
      function: 'Manages Adventist global healthcare systems, educational institutions, and denominational operations across 200+ countries',
      dysregulation: 'Women\'s ordination debate causing institutional tension (General Conference vote blocking divisions that want to ordain), Adventist Health financial pressures in rural markets, theological identity questions (relationship to broader evangelicalism), Ted Wilson presidency controversies, Saturday Sabbath employment discrimination litigation, declining growth rate in North America and Europe',
      expectedTypes: [
        { type: 'Adventist healthcare system operations', reason: 'Adventist Health ($5B+ revenue, 80+ hospitals, 300+ clinics in U.S.), Loma Linda University Health, AdventHealth (formerly Florida Hospital, 50+ hospitals), Adventist HealthCare (Maryland), global Adventist hospital network in Africa, Asia, Latin America — faith-based healthcare where the religious health theology IS the institutional mission', confidence: 0.90 },
        { type: 'Adventist global education and publishing', reason: 'General Conference Education Department (8,800+ schools, 2M+ students, largest Protestant school system globally), Loma Linda University, Andrews University, Adventist universities on every continent, Pacific Press Publishing, Review and Herald Publishing — education infrastructure exceeds most sovereign nations\' private school systems', confidence: 0.85 },
        { type: 'ADRA humanitarian operations and Adventist world mission', reason: 'Adventist Development and Relief Agency (ADRA, $300M+ annual, 130+ countries), Adventist World Radio, Hope Channel television network, Global Mission (frontier missionary deployment), Adventist Volunteer Service — the overseas operations arm of a church that operates more institutions in more countries than most NGOs', confidence: 0.82 }
      ]
    },
    'OP_COPTIC': {
      fullName: 'Coptic & Oriental Orthodox Churches', label: 'Coptic Patriarchate & Oriental Orthodox Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Ancient processing lineage that predates the dominant network architecture (Eastern Orthodox/Catholic) — maintains distinct protocols, separate hierarchy, and operates under sustained external threat in its homeland while building diaspora redundancy.', inBusiness: 'The Coptic Orthodox Church (12M+ in Egypt, 2M+ diaspora) is the largest Christian community in the Middle East and the most persecuted major Christian body. Pope Tawadros II governs from Cairo. Church bombings (2011, 2017), forced displacement, and state discrimination drive a permanent security, advocacy, and diaspora institution-building market. The broader Oriental Orthodox family (Coptic, Ethiopian, Armenian, Syriac, Indian) totals 60M+, each with independent governance. The Ethiopian Orthodox Tewahedo Church (40M+) recently survived its own schism crisis.' },
      function: 'Manages Coptic Orthodox patriarchate operations, Egyptian Christian community protection, and Oriental Orthodox inter-church relations',
      dysregulation: 'Church bombings (Palm Sunday 2017, 45 dead; Cairo cathedral 2016), systematic discrimination in Egypt (church building permit obstruction, kidnapping of Coptic women), diaspora identity tension (assimilation vs. preservation), Ethiopian Tewahedo schism (2023 breakaway synod), Armenian Apostolic Church navigating genocide recognition and Artsakh displacement',
      expectedTypes: [
        { type: 'Coptic Orthodox patriarchate and diocesan governance', reason: 'Coptic Orthodox Patriarchate of Alexandria (Pope Tawadros II), 100+ dioceses in Egypt, Coptic Orthodox Archdioceses in North America, UK, Australia, Coptic monasteries (Wadi Natrun, est. 4th century), Coptic Theological Seminary, Coptic Sunday School movement — institutional governance of the oldest continuous Christian tradition', confidence: 0.85 },
        { type: 'Coptic and Middle Eastern Christian persecution response', reason: 'Coptic Solidarity (U.S. advocacy), International Coptic Diaspora Congress, Barnabas Fund (supports persecuted church including Copts), ICC reporting on Egyptian persecution, USCIRF Egypt country monitoring, church security infrastructure in Egypt — the persecution-response ecosystem is a permanent institutional market', confidence: 0.82 },
        { type: 'Oriental Orthodox family inter-church operations', reason: 'Ethiopian Orthodox Tewahedo Church (40M+ members, massive institutional system including 35,000+ parishes), Armenian Apostolic Church (Echmiadzin and Cilicia catholicosates), Syriac Orthodox Church, Malankara Orthodox Syrian Church (India, 2.5M) — distinct from Eastern Orthodox, these churches have their own seminaries, governance, and diaspora institutions', confidence: 0.78 }
      ]
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIERARCHY TRAVERSAL AND BUSINESS INFERENCE
  // ══════════════════════════════════════════════════════════════════════

  function _getNodeDir() { return NODE_DIRECTORY; }

  // Invalidate stale v1 cache (treatment-based shape -> node-directory shape)
  (function migrateStorage() {
    try {
      var currentV = parseInt(localStorage.getItem(STORAGE_VERSION_KEY) || '0', 10);
      if (currentV < STORAGE_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
        console.log('[ReligionBusinessEngine] Cleared stale v' + currentV + ' approval cache -> v' + STORAGE_VERSION);
      }
    } catch (e) {}
  })();

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
      status: status, reason: reason || '', nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator', submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(), reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  // ══════════════════════════════════════════════════════════════════════
  // HIERARCHY TRAVERSAL — portal-depth company/treatment/diagnosis harvest
  // ══════════════════════════════════════════════════════════════════════

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) {
      return callback(_hierarchyCache);
    }
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
    var brain = brains.get('religion');
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
        for (var di = 0; di < dx.length; di++) { result.nodeDiagnoses[nid][dx[di]] = true; }
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

  function getReligionState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('religion');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getReligionState();
    var activeDx = (state && state.diagnoses) ? state.diagnoses.filter(function (d) { return d.active; }) : [];
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('religion') : null;
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

    for (var nodeId in NODE_DIRECTORY) {
      if (RI_NODES[nodeId]) continue;
      var dir = NODE_DIRECTORY[nodeId];
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
      for (var tk in existingCos) { mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')'); }

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
            var mc2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) mc2++;
            }
            if (mc2 >= 2) { alreadyMapped = true; break; }
          }
        }

        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Religion tied to ' + dir.label + '. This means the system can surface real companies, funds, or organizations operating in this space when Religion stress conditions fire.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: eligible for future portal path mapping and audit tracking within Religion. You are telling the system this is a real business category worth watching in the religious economy.';
          else consequence = 'If approved: recorded as a valid Religion mapping for audit tracking. Lower confidence \u2014 the system thinks this business type is plausible but wants your confirmation before surfacing it in the operator queue.';
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
          nodeLabel: dir.label, nodeFunction: dir.function,
          plainFunction: dir.function, dysregulation: dir.dysregulation || '',
          plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type, reason: expected.reason,
          confidence: expected.confidence, nodeActive: nodeActive,
          alreadyMapped: alreadyMapped, existingCompanies: mappedCompanyNames,
          approval: approval, approvalRequired: showButtons,
          variantState: variantState, approvalConsequence: consequence,
          tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' + (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
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
      var seen = {}; var out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped); missing = dedupeExact(missing); speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var ta = a.tier === 'top' ? 0 : 1, tb = b.tier === 'top' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);

    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  function getApprovedMappings() {
    var result = runInference(_hierarchyCache);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) {
      if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    }
    return approved;
  }

  window.LIMENReligionBusinessEngine = {
    runInference: function () { return runInference(_hierarchyCache); },
    runInferenceWithHierarchy: runInference,
    loadFullHierarchy: loadFullHierarchy,
    getApprovedMappings: getApprovedMappings,
    getNodeDirectory: _getNodeDir,
    setApprovalStatus: setApprovalStatus,
    getApprovalStatus: getApprovalStatus,
    loadApprovals: loadApprovals,
    isGenericTreatment: isGenericTreatment,
    NODE_COUNT: Object.keys(NODE_DIRECTORY).length
  };

  loadFullHierarchy(function () {
    console.log('[ReligionBusinessEngine] Hierarchy loaded');
  });

  console.log('[ReligionBusinessEngine] ' + Object.keys(NODE_DIRECTORY).length + ' nodes loaded (' +
    Object.values(NODE_DIRECTORY).filter(function(n) { return n.tier === 'top'; }).length + ' top, ' +
    Object.values(NODE_DIRECTORY).filter(function(n) { return n.tier === 'operational'; }).length + ' operational)');
})();
