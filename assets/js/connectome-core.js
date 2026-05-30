// =============================================
// LIMEN HELIX — CONNECTOME CORE ENGINE
// Universal self-contained module for any portal
// Extracted from clinical.html — NEVER modify clinical.html
// =============================================

var ConnectomeCore = (function() {
  'use strict';

  // ═══════════════════════════════════════
  // SHARED CONSTANTS
  // ═══════════════════════════════════════

  var TAU = Math.PI * 2;

  // System colors (18 systems) — from clinical.html lines 1262-1281
  var SYS_COLORS = {
    dmn:        {r:201,g:169,b:78},
    salience:   {r:255,g:180,b:60},
    executive:  {r:80,g:140,b:220},
    limbic:     {r:180,g:50,b:50},
    autonomic:  {r:42,g:107,b:90},
    hpa:        {r:200,g:120,b:40},
    plasticity: {r:100,g:180,b:120},
    gutbrain:   {r:140,g:100,b:160},
    entrainment:{r:180,g:160,b:60},
    reward:     {r:220,g:80,b:80},
    motor:      {r:160,g:80,b:60},
    thalamic:   {r:160,g:160,b:160},
    sensory:    {r:120,g:160,b:180},
    language:   {r:180,g:140,b:100},
    basal:      {r:140,g:120,b:80},
    neuromod:   {r:100,g:140,b:140},
    memory:     {r:160,g:120,b:180},
    other:      {r:120,g:120,b:120}
  };

  // Edge types (8 signaling types) — from clinical.html lines 1433-1442
  var EDGE_TYPES = {
    fast:     {speed:[0.012,0.020], rate:0.025, size:[0.8,1.4]},
    excit:    {speed:[0.006,0.012], rate:0.030, size:[1.0,1.8]},
    inhib:    {speed:[0.005,0.009], rate:0.018, size:[0.8,1.3]},
    modul:    {speed:[0.003,0.006], rate:0.012, size:[1.0,1.6]},
    auto:     {speed:[0.002,0.005], rate:0.010, size:[0.8,1.2]},
    hormonal: {speed:[0.001,0.003], rate:0.005, size:[1.2,2.0]},
    peptide:  {speed:[0.001,0.004], rate:0.006, size:[1.0,1.5]},
    plastic:  {speed:[0.001,0.002], rate:0.003, size:[0.6,1.0]}
  };

  // Phase colors for domain overlays — from connectome-renderer.js lines 11-14
  var PHASE_COLORS = {
    P0:'#8B5CF6', P1:'#F59E0B', P2:'#10B981', P3:'#EF4444', P4:'#3B82F6',
    P5:'#EC4899', P6:'#06B6D4', P7:'#F97316', P8:'#84CC16', P9:'#A78BFA', P10:'#E2E8F0'
  };
  var PHASE_TAGLINES = {
    P0:'Source / Substrate', P1:'Emergence', P2:'Nourishment', P3:'Formation',
    P4:'Structure', P5:'Movement', P6:'Coordination', P7:'Regulation',
    P8:'Repair', P9:'Identity', P10:'Return'
  };

  // Phase pulse RGB — EXACT civilization.html lines 105-117
  var PHASE_PULSE_COLORS = {
    P0:  {r:14,  g:165, b:233},
    P1:  {r:6,   g:182, b:212},
    P2:  {r:14,  g:165, b:233},
    P3:  {r:239, g:115, b:70},
    P4:  {r:16,  g:185, b:129},
    P5:  {r:34,  g:197, b:94},
    P6:  {r:16,  g:185, b:129},
    P7:  {r:139, g:92,  b:246},
    P8:  {r:167, g:139, b:250},
    P9:  {r:139, g:92,  b:246},
    P10: {r:234, g:179, b:8}
  };

  // Phase vector helpers — EXACT civilization.html logic
  function initPhaseVector(phaseStr) {
    var vec = {};
    for (var i = 0; i <= 10; i++) vec['P' + i] = 0;
    if (phaseStr && vec.hasOwnProperty(phaseStr)) {
      vec[phaseStr] = 0.75;
      var idx = parseInt(phaseStr.slice(1));
      if (idx > 0) vec['P' + (idx - 1)] = 0.08;
      if (idx < 10) vec['P' + (idx + 1)] = 0.08;
      var assigned = 0.75 + (idx > 0 ? 0.08 : 0) + (idx < 10 ? 0.08 : 0);
      var remaining = 1 - assigned;
      var crumbCount = 11 - (1 + (idx > 0 ? 1 : 0) + (idx < 10 ? 1 : 0));
      var crumb = crumbCount > 0 ? remaining / crumbCount : 0;
      for (var i = 0; i <= 10; i++) {
        var k = 'P' + i;
        if (k !== phaseStr && !(idx > 0 && i === idx - 1) && !(idx < 10 && i === idx + 1)) {
          vec[k] = crumb;
        }
      }
    } else {
      for (var i = 0; i <= 10; i++) vec['P' + i] = 1 / 11;
    }
    return vec;
  }

  function computeInstability(vec) {
    var vals = [];
    for (var k in vec) vals.push(vec[k]);
    vals.sort(function(a, b) { return b - a; });
    return 1 - ((vals[0] || 0) - (vals[1] || 0));
  }

  function getDominantPhase(vec) {
    var best = 'P0', bestV = -1;
    for (var k in vec) {
      if (vec[k] > bestV) { bestV = vec[k]; best = k; }
    }
    return best;
  }

  // EXACT civilization.html lines 185-195
  function getPhaseColor(n) {
    var phase = n.dominant_phase || 'P0';
    var c = PHASE_PULSE_COLORS[phase] || PHASE_PULSE_COLORS.P0;
    var inst = n.instability || 0;
    var sat = Math.max(0.2, 1 - inst * 0.8);
    return {
      r: Math.round(120 + (c.r - 120) * sat),
      g: Math.round(120 + (c.g - 120) * sat),
      b: Math.round(120 + (c.b - 120) * sat)
    };
  }

  // Node descriptions (111 hover tooltips) — from clinical.html lines 1768-1863
  var NODE_DESCRIPTIONS = {
    DMN:'Default Mode Network — self-referential thought, mind-wandering, autobiographical memory, narrative identity. The neural seat of the "self."',
    mPFC:'Medial Prefrontal Cortex — self-referential processing, emotional regulation, value-based decision making. Core DMN hub.',
    PCC:'Posterior Cingulate Cortex — autobiographical memory retrieval, internal narrative, self-reflection. Core DMN hub.',
    PRECUNEUS:'Precuneus — visuospatial imagery, episodic memory, self-consciousness. DMN integration node.',
    AG:'Angular Gyrus — semantic processing, attention reorienting, theory of mind. DMN-language interface.',
    TPOLE:'Temporal Pole — social conceptual knowledge, emotional associations, semantic memory.',
    RSC:'Retrosplenial Cortex — spatial memory, navigation, scene construction, episodic memory encoding.',
    OFC:'Orbitofrontal Cortex — reward valuation, emotional decision-making, social behavior regulation.',
    EC:'Entorhinal Cortex — memory gateway, spatial navigation, hippocampal input/output relay.',
    SN:'Salience Network — detects behaviorally relevant stimuli, switches between DMN and task-positive networks.',
    AI:'Anterior Insula — interoception, emotional awareness, empathy, autonomic monitoring. Salience hub.',
    dACC:'Dorsal Anterior Cingulate — error detection, conflict monitoring, cognitive control, pain processing.',
    TPJ:'Temporoparietal Junction — theory of mind, perspective-taking, self-other distinction.',
    PI:'Posterior Insula — interoceptive processing, pain perception, visceral sensation.',
    ECN:'Executive Control Network — working memory, cognitive flexibility, goal-directed behavior.',
    dlPFC:'Dorsolateral Prefrontal Cortex — working memory, planning, cognitive control, top-down regulation.',
    vlPFC:'Ventrolateral Prefrontal Cortex — inhibitory control, language processing, emotional regulation.',
    FEF:'Frontal Eye Fields — voluntary eye movements, visual attention, spatial awareness.',
    IPS:'Intraparietal Sulcus — spatial attention, numerical processing, visuomotor integration.',
    BLA:'Basolateral Amygdala — threat evaluation, fear learning, emotional memory encoding.',
    CeA:'Central Amygdala — fear expression, autonomic fear responses, defensive behavior output.',
    BNST:'Bed Nucleus of Stria Terminalis — sustained anxiety, threat monitoring, stress hormone regulation.',
    vmPFC:'Ventromedial Prefrontal Cortex — fear extinction, emotional regulation, value-based decisions, safety signaling.',
    PAG:'Periaqueductal Gray — defensive behaviors (freeze/flight/fight), pain modulation, panic responses.',
    EMP:'Empathy Network — shared emotional experience, compassion, social cognition.',
    HIPP:'Hippocampus — memory consolidation, spatial navigation, contextual fear conditioning, pattern separation.',
    VV:'Ventral Vagal Complex — social engagement, calm states, safe connection. Polyvagal "rest and digest."',
    DV:'Dorsal Vagal Complex — freeze/shutdown responses, conservation-withdrawal, immobilization.',
    NTS:'Nucleus Tractus Solitarius — visceral sensory relay, autonomic reflex center, gut-brain interface.',
    SNS:'Sympathetic Nervous System — fight-or-flight activation, arousal, stress mobilization.',
    CARD:'Cardiac Autonomic — heart rate regulation, HRV generation, vagal brake.',
    LAR:'Laryngeal Branch — voice production, vocal prosody, social communication via vagal tone.',
    HPA:'HPA Axis — stress hormone cascade (CRH → ACTH → cortisol), allostatic load accumulation.',
    HYPO:'Hypothalamus — homeostatic regulation, stress response initiation, hormone release, circadian rhythm.',
    PIT:'Pituitary Gland — master endocrine regulator, ACTH release, growth hormone, reproductive hormones.',
    ADR:'Adrenal Glands — cortisol and adrenaline production, stress response execution.',
    NAcc:'Nucleus Accumbens — reward processing, motivation, pleasure, addiction. Dopamine target.',
    VTA:'Ventral Tegmental Area — dopamine production, reward prediction, motivation signaling.',
    STRI:'Striatum — habit formation, motor planning, reward-based learning, procedural memory.',
    CAUD:'Caudate Nucleus — goal-directed behavior, learning, cognitive flexibility. Part of striatum.',
    PUT:'Putamen — motor execution, habit learning, sensorimotor integration.',
    GP:'Globus Pallidus — motor output regulation, movement inhibition/disinhibition.',
    STN:'Subthalamic Nucleus — action suppression, impulse control, deep brain stimulation target for OCD.',
    VP:'Ventral Pallidum — reward and motivation processing, hedonic evaluation.',
    SNIG:'Substantia Nigra — dopamine production for motor control. Degenerates in Parkinson\'s.',
    THAL:'Thalamus — sensory relay hub, cortical-cortical communication, arousal regulation, consciousness gating.',
    MDT:'Mediodorsal Thalamus — prefrontal relay, working memory support, decision-making.',
    ANT:'Anterior Thalamus — memory circuits, hippocampal relay, spatial navigation.',
    PULV:'Pulvinar — visual attention, salience processing, cortical synchronization.',
    LGN:'Lateral Geniculate Nucleus — visual relay from retina to visual cortex.',
    MGN:'Medial Geniculate Nucleus — auditory relay from inferior colliculus to auditory cortex.',
    RAPHE:'Raphe Nuclei — serotonin production, mood regulation, sleep-wake cycling, pain modulation.',
    LC:'Locus Coeruleus — norepinephrine production, arousal, attention, stress response, fight-or-flight.',
    ENDO:'Endocannabinoid System — stress buffering, pain modulation, appetite, mood regulation.',
    OPIOID:'Opioid System — pain relief, reward, social bonding, stress resilience.',
    OXY:'Oxytocin System — social bonding, trust, pair bonding, stress buffering, co-regulation.',
    GABA_GLU:'Excitatory/Inhibitory Balance — GABA (inhibition) vs glutamate (excitation). Disrupted in anxiety, epilepsy, schizophrenia.',
    EI:'E/I Ratio — cortical excitation-inhibition balance. Shifted in autism, anxiety, psychosis.',
    V1:'Primary Visual Cortex — initial visual processing, edge detection, orientation selectivity.',
    A1:'Primary Auditory Cortex — sound processing, frequency mapping, auditory perception.',
    S1:'Primary Somatosensory Cortex — touch, pressure, proprioception, body mapping.',
    M1:'Primary Motor Cortex — voluntary movement execution, motor commands.',
    SMA:'Supplementary Motor Area — movement planning, sequencing, bilateral coordination.',
    CMZ:'Cingulate Motor Zone — motor intention, effort-based decision making.',
    SMN:'Somatomotor Network — body awareness, movement, embodiment, somatic experiencing.',
    BROCA:'Broca\'s Area — speech production, language processing, verbal working memory.',
    WERN:'Wernicke\'s Area — language comprehension, speech perception, semantic processing.',
    LANG:'Language Network — inner speech, narrative processing, self-talk. DMN narrative substrate.',
    STS:'Superior Temporal Sulcus — social perception, voice processing, biological motion, face perception.',
    FG:'Fusiform Gyrus — face recognition, visual word form, object categorization.',
    PIN:'Pineal Gland — melatonin production, circadian rhythm regulation.',
    VEST:'Vestibular System — balance, spatial orientation, motion perception.',
    CBLM:'Cerebellum — motor coordination, timing, error prediction, cognitive sequencing.',
    SC:'Superior Colliculus — visual orienting, saccadic eye movements, multisensory integration.',
    IC:'Inferior Colliculus — auditory processing relay, sound localization.',
    PBN:'Parabrachial Nucleus — taste, pain, visceral sensation relay, arousal, respiratory control.',
    PPN:'Pedunculopontine Nucleus — locomotion, arousal, REM sleep, reward processing.',
    HAB:'Habenula — disappointment signaling, reward prediction error, aversion learning. Hyperactive in depression.',
    OLF:'Olfactory System — smell processing, emotional memory, threat detection.',
    rACC:'Rostral ACC — emotional processing, self-referential thought, conflict resolution.',
    CLAUST:'Claustrum — consciousness integration, cross-modal binding, salience coordination.',
    DISS:'Dissolution — ego dissolution, entropic brain states, psychedelic-induced network disruption.',
    CC:'Corpus Callosum — hemispheric communication, interhemispheric integration.',
    CCorp:'Corpus Callosum — major white matter tract connecting left and right hemispheres.',
    UNC:'Uncinate Fasciculus — connects OFC to temporal lobe. Memory-emotion integration.',
    ARC:'Arcuate Fasciculus — connects Broca\'s and Wernicke\'s areas. Language pathway.',
    DAN:'Dorsal Attention Network — voluntary, top-down attention. Goal-directed focus.',
    VAN:'Ventral Attention Network — involuntary attention reorienting, surprise detection.',
    FPN:'Frontoparietal Network — flexible cognitive control, task switching, adaptive behavior.',
    CON:'Cingulo-Opercular Network — tonic alertness, sustained task maintenance, error monitoring.',
    VERM:'Vermis — emotional processing in cerebellum, fear conditioning, autonomic regulation.',
    NEOCER:'Neocerebellum — cognitive cerebellum, language, working memory, executive support.',
    BDNF:'BDNF/Plasticity — brain-derived neurotrophic factor, neuroplasticity, learning, recovery.',
    MAMM:'Mammillary Bodies — memory consolidation relay, spatial memory, Papez circuit.',
    SEPT:'Septal Nuclei — pleasure, reward modulation, hippocampal theta rhythm.',
    NBM:'Nucleus Basalis of Meynert — acetylcholine supply, cortical arousal, attention.',
    FORN:'Fornix — hippocampal output fiber tract, memory circuit white matter.',
    CING:'Cingulate Cortex — emotion-cognition integration, pain processing, motivation.',
    TrkB:'TrkB Receptor — BDNF receptor, plasticity signaling, antidepressant target.',
    GBA:'Gut-Brain Axis — bidirectional gut-brain signaling, immune-neural interface.',
    ENS:'Enteric Nervous System — second brain, gut motility, local neurotransmitter production.',
    MICRO:'Microbiome — gut bacteria influencing mood, inflammation, neurotransmitter precursors.',
    OSC:'Oscillatory Entrainment — rhythmic neural synchronization, cross-frequency coupling.',
    RF:'Reticular Formation — arousal regulation, sleep-wake transitions, consciousness gating.',
    FRONTO:'Frontoparietal — executive function, attention, cognitive flexibility.',
    GUT:'Gut-Brain — vagal gut-brain communication, microbiome signaling, enteric nervous system.'
  };

  // CSS variable definitions (matching clinical.html)
  var CSS_VARS = {
    '--bg':'#0c0d10','--panel':'#131519','--border':'rgba(201,169,78,0.12)',
    '--gold':'#C9A94E','--gold-dim':'rgba(201,169,78,0.55)','--gold-ghost':'rgba(201,169,78,0.08)',
    '--text':'#dad5c8','--text-dim':'rgba(220,215,200,0.82)','--text-ghost':'rgba(200,195,184,0.4)',
    '--hyper':'#e85454','--hypo':'#4a8fd4','--altered':'#d4a84a',
    '--evidence-a':'#4aaa6a','--evidence-b':'#7a9ad4','--evidence-c':'#c4a44a','--evidence-d':'#8a7a6a',
    '--pharma':'#6aaa9a','--therapy':'#aa7aaa','--somatic':'#aa8a5a','--nutrition':'#6aaa6a','--supplement':'#8a9aaa'
  };

  // Evidence sort order
  var EVIDENCE_ORDER = {A:0,'A-':1,'B+':2,B:3,'B-':4,'C+':5,C:6,D:7};

  // ═══════════════════════════════════════
  // WEIGHT MATRIX NODE MAP (numeric 1-111 ↔ Canvas string IDs)
  // Source: _node_directory.json → connectome-core.js buildNodes()
  // ═══════════════════════════════════════
  var NUM_TO_CANVAS = {
    1:'mPFC',2:'PCC',3:'PRECUNEUS',4:'AG',5:'vmPFC',6:'OFC',7:'RSC',
    8:'AI',9:'ACC',10:'dACC',11:'sgACC',12:'dlPFC',13:'vlPFC',14:'BROCA',
    15:'ECN',16:'SMA',17:'BLA',18:'CeA',19:'BNST',20:'HIPP',21:'EC',
    22:'PRC',23:'PPA',24:'NTS',25:'VV',26:'DV',27:'LC',28:'RAPHE',
    29:'VTA',30:'SNIG',31:'HYPO',32:'PIT',33:'ADR',35:'NAcc',
    36:'CAUD',37:'PUT',38:'GP',39:'STN',40:'MDT',41:'PULV',42:'ANT',
    43:'THAL',44:'V1',45:'V4V5',46:'FG',47:'STS',48:'A1',49:'WERN',
    50:'S1',51:'S2',52:'TPJ',53:'IPL',54:'SPL',55:'IPS',56:'VERM',
    57:'CBLM',58:'NEOCER',59:'PAG',60:'SC',61:'PBN',62:'PPN',63:'PI',
    64:'MI',65:'CLAUST',66:'OLF',67:'SEPT',68:'HAB',69:'M1',70:'PMC',
    71:'SDH',72:'SNS',73:'ENS',75:'ASTRO',76:'NBM',78:'FPC',79:'MFC',
    80:'rPFC',83:'EBA',84:'OSC',87:'OXY',88:'ENDO',89:'OPIOID',
    90:'GABA_GLU',91:'EI',92:'BDNF',93:'TrkB',94:'BBB',96:'SCN',
    97:'PIN',98:'CC',99:'UNC',100:'ARC',101:'CING',103:'VAN',104:'DAN',
    105:'DMNMTL',106:'DMN',109:'EMP',111:'SN'
  };
  var CANVAS_TO_NUM = {};
  for (var _nk in NUM_TO_CANVAS) {
    if (NUM_TO_CANVAS.hasOwnProperty(_nk)) {
      var _cv = NUM_TO_CANVAS[_nk];
      if (_cv && !CANVAS_TO_NUM[_cv]) CANVAS_TO_NUM[_cv] = Number(_nk);
    }
  }

  function sortByEvidence(items) {
    return items.slice().sort(function(a,b) {
      return (EVIDENCE_ORDER[a.evidence]||9) - (EVIDENCE_ORDER[b.evidence]||9);
    });
  }

  // ═══════════════════════════════════════
  // MODULE 1: Canvas (2D Connectome Renderer)
  // ═══════════════════════════════════════

  var Canvas = (function() {
    var canvas, ctx, W, H, CX, CY, DPR;
    var t = 0;
    var NODES = {}, NODE_LIST = [], EDGES = [];
    var PULSES = [], MAX_PULSES = 200;
    var hoveredNode = null, selectedNode = null;
    var galaxyAngle = 0, galaxySpeed = 0.0003;
    var selectedIssue = null;
    var activationLoaded = false, activationData = null, activationMap = {};
    var animRunning = false;
    var onNodeClick = null, onNodeHover = null;
    var domainLabelMap = null; // optional domain-specific labels

    // Propagation visualization state
    var propActive = false;
    var propMap = {};        // Canvas string ID → activation 0-1
    var propHyperSet = {};   // Canvas string ID → true
    var propSeedNodes = {};  // Canvas string ID → true (for bright seed rendering)
    var _propNumSeeds = {};  // numeric seeds for engine
    var _propTimer = null;
    var _propStep = 0;

    function addNode(id, label, sys, angle, radius, size) {
      var n = {id:id, label:label, sys:sys, angle:angle, radius:radius, size:size||4, x:0, y:0, affected:null};
      NODES[id] = n;
      NODE_LIST.push(n);
      return n;
    }

    function addEdge(a, b, w) {
      if (NODES[a] && NODES[b]) EDGES.push({a:a, b:b, w:w||0.3});
    }

    function addTypedEdge(a, b, type) {
      if (NODES[a] && NODES[b]) EDGES.push({a:a, b:b, w:0.3, type:type||'excit'});
    }

    // Build all 111 nodes in polar coordinates
    function S(system, nodes, startAngle, sweep, rMin, rMax) {
      var n = nodes.length;
      for (var i = 0; i < n; i++) {
        var a = startAngle + (sweep * i / Math.max(n-1, 1));
        var r = n === 1 ? (rMin+rMax)/2 : rMin + (rMax-rMin) * (i%2 === 0 ? 0.3 : 0.7);
        addNode(nodes[i][0], nodes[i][1], system, a, r, nodes[i][2]||4);
      }
    }

    function buildNodes() {
      NODES = {}; NODE_LIST = []; EDGES = [];

      // DMN Core
      addNode('DMN', 'DEFAULT MODE\nNETWORK', 'dmn', 0, 0, 12);
      S('dmn', [
        ['mPFC','mPFC',7], ['PCC','PCC',7], ['PRECUNEUS','Precuneus',5],
        ['AG','Angular\nGyrus',4], ['TPOLE','Temporal\nPole',4], ['RSC','Retrosplenial',4],
        ['OFC','OFC',4], ['EC','Entorhinal',3]
      ], 0, TAU*0.9, 0.06, 0.12);

      // Salience
      S('salience', [
        ['SN','Salience\nNetwork',6], ['AI','Anterior\nInsula',6], ['dACC','dACC',5],
        ['TPJ','TPJ',4], ['PI','Posterior\nInsula',3]
      ], TAU*0.02, TAU*0.12, 0.22, 0.34);

      // Executive
      S('executive', [
        ['ECN','Executive\nControl',5], ['dlPFC','dlPFC',6], ['vlPFC','vlPFC',4],
        ['FEF','FEF',3], ['IPS','IPS',3]
      ], TAU*0.14, TAU*0.10, 0.22, 0.34);

      // Limbic
      S('limbic', [
        ['BLA','BLA',6], ['CeA','CeA',4], ['BNST','BNST',4],
        ['vmPFC','vmPFC',6], ['PAG','PAG',4], ['EMP','Empathy',3],
        ['HIPP','Hippocampus',6]
      ], TAU*0.26, TAU*0.14, 0.22, 0.38);

      // Autonomic
      S('autonomic', [
        ['VV','Ventral\nVagal',5], ['DV','Dorsal\nVagal',4], ['NTS','NTS',3],
        ['SNS','Sympathetic',4], ['CARD','Cardiac',3], ['LAR','Laryngeal',2]
      ], TAU*0.42, TAU*0.10, 0.22, 0.36);

      // HPA
      S('hpa', [
        ['HPA','HPA Axis',5], ['HYPO','Hypothalamus',5], ['PIT','Pituitary',3],
        ['ADR','Adrenal',3]
      ], TAU*0.54, TAU*0.08, 0.22, 0.34);

      // Reward
      S('reward', [
        ['NAcc','Nucleus\nAccumbens',6], ['VTA','VTA',5], ['STRI','Striatum',4]
      ], TAU*0.63, TAU*0.06, 0.24, 0.34);

      // Basal Ganglia
      S('basal', [
        ['CAUD','Caudate',4], ['PUT','Putamen',4], ['GP','Globus\nPallidus',3],
        ['STN','STN',3], ['VP','Ventral\nPallidum',3], ['SNIG','Substantia\nNigra',3]
      ], TAU*0.70, TAU*0.08, 0.22, 0.36);

      // Thalamic
      S('thalamic', [
        ['THAL','Thalamus',5], ['MDT','Mediodorsal',3], ['ANT','Anterior\nThalamus',3],
        ['PULV','Pulvinar',3], ['LGN','LGN',2], ['MGN','MGN',2]
      ], TAU*0.80, TAU*0.08, 0.22, 0.34);

      // Neuromodulatory
      S('neuromod', [
        ['RAPHE','Raphe\nNuclei',4], ['LC','Locus\nCoeruleus',4],
        ['ENDO','Endocannabinoid',3], ['OPIOID','Opioid\nSystem',3],
        ['OXY','Oxytocin',3], ['GABA_GLU','E/I\nBalance',4],
        ['EI','E/I\nRatio',3]
      ], TAU*0.90, TAU*0.18, 0.40, 0.48);

      // Sensory
      S('sensory', [
        ['V1','V1',3], ['A1','A1',3], ['S1','S1',3]
      ], TAU*0.15, TAU*0.06, 0.40, 0.44);

      // Motor
      S('motor', [
        ['M1','M1',3], ['SMA','SMA',3], ['CMZ','CMZ',2], ['SMN','Somatomotor',3]
      ], TAU*0.22, TAU*0.06, 0.40, 0.44);

      // Language
      S('language', [
        ['BROCA','Broca',3], ['WERN','Wernicke',3], ['LANG','Language\nNetwork',3],
        ['STS','STS',4], ['FG','Fusiform',4]
      ], TAU*0.37, TAU*0.08, 0.40, 0.48);

      // Memory
      S('memory', [
        ['MAMM','Mammillary',2], ['SEPT','Septal',2], ['NBM','Nucleus\nBasalis',2],
        ['FORN','Fornix',2], ['CING','Cingulum',3]
      ], TAU*0.48, TAU*0.06, 0.40, 0.46);

      // Outer systems
      S('plasticity', [['BDNF','BDNF /\nPlasticity',4], ['TrkB','TrkB',2]], TAU*0.58, TAU*0.03, 0.40, 0.44);
      S('gutbrain', [['GBA','Gut-Brain\nAxis',3], ['ENS','Enteric\nNS',2], ['MICRO','Microbiome',2]], TAU*0.62, TAU*0.04, 0.40, 0.46);
      S('entrainment', [['OSC','Oscillatory',3], ['RF','Reticular\nFormation',3]], TAU*0.68, TAU*0.03, 0.40, 0.44);

      // Remaining individual nodes
      addNode('PIN', 'Pineal', 'other', TAU*0.73, 0.42, 2);
      addNode('VEST', 'Vestibular', 'other', TAU*0.76, 0.42, 2);
      addNode('CBLM', 'Cerebellum', 'other', TAU*0.85, 0.42, 4);
      addNode('SC', 'Superior\nColliculus', 'other', TAU*0.87, 0.44, 2);
      addNode('IC', 'Inferior\nColliculus', 'other', TAU*0.89, 0.44, 2);
      addNode('PBN', 'Parabrachial', 'other', TAU*0.52, 0.44, 3);
      addNode('PPN', 'PPN', 'other', TAU*0.84, 0.46, 2);
      addNode('HAB', 'Habenula', 'reward', TAU*0.66, 0.36, 3);
      addNode('OLF', 'Olfactory', 'sensory', TAU*0.10, 0.44, 2);
      addNode('rACC', 'rACC', 'dmn', TAU*0.95, 0.10, 3);
      addNode('CLAUST', 'Claustrum', 'other', TAU*0.78, 0.36, 3);
      addNode('DISS', 'Dissolution', 'dmn', TAU*0.97, 0.14, 3);
      addNode('CC', 'Corpus\nCallosum', 'other', TAU*0.50, 0.38, 3);
      addNode('CCorp', 'Corpus\nCallosum', 'other', TAU*0.50, 0.38, 3);
      addNode('UNC', 'Uncinate', 'other', TAU*0.34, 0.42, 2);
      addNode('ARC', 'Arcuate', 'language', TAU*0.39, 0.46, 2);
      addNode('DAN', 'Dorsal\nAttention', 'sensory', TAU*0.12, 0.36, 3);
      addNode('VAN', 'Ventral\nAttention', 'salience', TAU*0.06, 0.38, 3);
      addNode('FPN', 'Frontoparietal', 'executive', TAU*0.17, 0.36, 3);
      addNode('CON', 'Cingulo-\nOpercular', 'salience', TAU*0.04, 0.32, 2);
      addNode('VERM', 'Vermis', 'other', TAU*0.86, 0.46, 2);
      addNode('NEOCER', 'Neo-\ncerebellum', 'other', TAU*0.88, 0.46, 2);

      // GAP2 — 20 audit-gap nodes wired into renderer
      addNode('FPC', 'Frontopolar', 'dmn', TAU*0.93, 0.16, 3);
      addNode('DMNMTL', 'DMN Medial\nTemporal', 'dmn', TAU*0.98, 0.18, 3);
      addNode('ACC', 'Anterior\nCingulate', 'salience', TAU*0.09, 0.38, 3);
      addNode('MI', 'Middle\nInsula', 'salience', TAU*0.03, 0.40, 2);
      addNode('sgACC', 'Subgenual\nACC', 'limbic', TAU*0.41, 0.36, 2);
      addNode('IPL', 'Inferior\nParietal', 'executive', TAU*0.19, 0.38, 3);
      addNode('SPL', 'Superior\nParietal', 'executive', TAU*0.21, 0.38, 3);
      addNode('MFC', 'Medial\nFrontal', 'executive', TAU*0.25, 0.36, 2);
      addNode('rPFC', 'Right\nPrefrontal', 'executive', TAU*0.23, 0.36, 2);
      addNode('V4V5', 'V4/V5', 'sensory', TAU*0.11, 0.48, 2);
      addNode('S2', 'S2', 'sensory', TAU*0.20, 0.46, 2);
      addNode('EBA', 'Extrastriate\nBody', 'sensory', TAU*0.13, 0.48, 2);
      addNode('PMC', 'Premotor', 'motor', TAU*0.30, 0.44, 2);
      addNode('PRC', 'Perirhinal', 'memory', TAU*0.55, 0.42, 2);
      addNode('PPA', 'Parahippo-\ncampal', 'memory', TAU*0.56, 0.44, 2);
      addNode('SDH', 'Spinal\nDorsal Horn', 'autonomic', TAU*0.46, 0.40, 2);
      addNode('VIA', 'Visceral\nInteroception', 'autonomic', TAU*0.44, 0.40, 2);
      addNode('SCN', 'Suprachias-\nmatic', 'autonomic', TAU*0.48, 0.36, 2);
      addNode('ASTRO', 'Astrocytes', 'other', TAU*0.82, 0.48, 2);
      addNode('BBB', 'Blood-Brain\nBarrier', 'other', TAU*0.78, 0.48, 2);

      buildEdges();
    }

    function buildEdges() {
      // DMN internal
      addTypedEdge('DMN','mPFC','excit'); addTypedEdge('DMN','PCC','excit');
      addTypedEdge('DMN','PRECUNEUS','excit'); addTypedEdge('DMN','AG','excit');
      addTypedEdge('mPFC','PCC','excit'); addTypedEdge('PCC','PRECUNEUS','excit');
      addTypedEdge('PCC','AG','excit'); addTypedEdge('PCC','HIPP','excit');
      // Prefrontal
      addTypedEdge('mPFC','vmPFC','excit'); addTypedEdge('mPFC','dlPFC','excit');
      addTypedEdge('dlPFC','dACC','excit'); addTypedEdge('dlPFC','vlPFC','excit');
      // Salience
      addTypedEdge('AI','dACC','fast'); addTypedEdge('AI','BLA','fast');
      addTypedEdge('AI','vmPFC','excit');
      // Amygdala
      addTypedEdge('BLA','CeA','fast'); addTypedEdge('BLA','HIPP','fast');
      addTypedEdge('BLA','BNST','excit'); addTypedEdge('vmPFC','BLA','inhib');
      addTypedEdge('vmPFC','NAcc','excit'); addTypedEdge('PAG','CeA','fast');
      addTypedEdge('PAG','DV','fast');
      // Thalamic relay
      addTypedEdge('THAL','dlPFC','fast'); addTypedEdge('THAL','BLA','fast');
      addTypedEdge('THAL','V1','fast');
      // LC
      addTypedEdge('LC','dlPFC','fast'); addTypedEdge('LC','BLA','fast');
      addTypedEdge('LC','dACC','fast');
      // Raphe
      addTypedEdge('RAPHE','mPFC','modul'); addTypedEdge('RAPHE','BLA','modul');
      addTypedEdge('RAPHE','NAcc','modul');
      // Dopamine
      addTypedEdge('VTA','NAcc','modul'); addTypedEdge('NAcc','STRI','excit');
      addTypedEdge('HAB','VTA','inhib'); addTypedEdge('HAB','RAPHE','inhib');
      // Basal ganglia
      addTypedEdge('STRI','CAUD','excit'); addTypedEdge('STRI','PUT','excit');
      addTypedEdge('CAUD','GP','inhib'); addTypedEdge('PUT','GP','inhib');
      addTypedEdge('GP','THAL','inhib'); addTypedEdge('STN','GP','excit');
      // Autonomic
      addTypedEdge('VV','NTS','auto'); addTypedEdge('DV','NTS','auto');
      addTypedEdge('NTS','BLA','auto');
      // HPA
      addTypedEdge('HYPO','PIT','hormonal'); addTypedEdge('PIT','ADR','hormonal');
      addTypedEdge('HYPO','PAG','fast');
      // Hippocampal
      addTypedEdge('HIPP','FORN','excit'); addTypedEdge('FORN','MAMM','excit');
      addTypedEdge('MAMM','ANT','excit');
      // Language
      addTypedEdge('BROCA','WERN','excit'); addTypedEdge('STS','FG','excit');
      addTypedEdge('STS','TPJ','excit');
      // Peptide
      addTypedEdge('OXY','VV','peptide'); addTypedEdge('OXY','BLA','peptide');
      addTypedEdge('ENDO','BLA','peptide'); addTypedEdge('OPIOID','PAG','peptide');
      // Plasticity
      addTypedEdge('BDNF','HIPP','plastic'); addTypedEdge('BDNF','dlPFC','plastic');
      // Gut-brain
      addTypedEdge('GBA','VV','auto'); addTypedEdge('GBA','ENS','auto');
      // Circadian
      addTypedEdge('PIN','HYPO','hormonal');
      // Cerebellar
      addTypedEdge('CBLM','THAL','fast');
      // Brainstem
      addTypedEdge('PBN','NTS','fast'); addTypedEdge('PBN','BLA','fast');
      // GAP2 node connections
      addTypedEdge('FPC','mPFC','excit'); addTypedEdge('FPC','dlPFC','excit');
      addTypedEdge('DMNMTL','HIPP','excit'); addTypedEdge('DMNMTL','EC','excit');
      addTypedEdge('ACC','dACC','excit'); addTypedEdge('ACC','mPFC','excit');
      addTypedEdge('MI','AI','fast'); addTypedEdge('MI','PI','fast');
      addTypedEdge('sgACC','vmPFC','excit'); addTypedEdge('sgACC','BLA','excit');
      addTypedEdge('IPL','AG','excit'); addTypedEdge('IPL','IPS','excit');
      addTypedEdge('SPL','IPS','excit'); addTypedEdge('SPL','FEF','excit');
      addTypedEdge('MFC','dACC','excit'); addTypedEdge('MFC','dlPFC','excit');
      addTypedEdge('rPFC','dlPFC','excit'); addTypedEdge('rPFC','vlPFC','excit');
      addTypedEdge('V4V5','V1','fast'); addTypedEdge('V4V5','FG','excit');
      addTypedEdge('S2','S1','fast'); addTypedEdge('S2','PI','fast');
      addTypedEdge('EBA','FG','excit'); addTypedEdge('EBA','V4V5','excit');
      addTypedEdge('PMC','M1','excit'); addTypedEdge('PMC','SMA','excit');
      addTypedEdge('PRC','EC','excit'); addTypedEdge('PRC','HIPP','excit');
      addTypedEdge('PPA','HIPP','excit'); addTypedEdge('PPA','RSC','excit');
      addTypedEdge('SDH','NTS','auto'); addTypedEdge('SDH','PAG','fast');
      addTypedEdge('VIA','AI','auto'); addTypedEdge('VIA','NTS','auto');
      addTypedEdge('SCN','HYPO','hormonal'); addTypedEdge('SCN','PIN','hormonal');
      addTypedEdge('ASTRO','GABA_GLU','modul'); addTypedEdge('ASTRO','BDNF','plastic');
      addTypedEdge('BBB','ASTRO','modul');
    }

    function getNodeColor(n) {
      // Propagation mode — activation drives rendering
      if (propActive) {
        var act = propMap[n.id] || 0;
        // HYPER from propagation engine
        if (propHyperSet[n.id]) return {r:232, g:84, b:84, a:0.9};
        // Affected nodes stay bright with issue color
        if (selectedIssue && n.affected) {
          var dir = n.affected.dir.toLowerCase();
          if (dir.indexOf('hyper') !== -1 || dir.indexOf('sensitized') !== -1) return {r:232, g:84, b:84, a:0.9};
          if (dir.indexOf('hypo') !== -1 || dir.indexOf('reduced') !== -1 || dir.indexOf('underdeveloped') !== -1) return {r:74, g:143, b:212, a:0.9};
          return {r:212, g:168, b:74, a:0.9};
        }
        // All other nodes: system color, alpha driven by activation
        var c = SYS_COLORS[n.sys] || SYS_COLORS.other;
        if (act > 0) return {r:c.r, g:c.g, b:c.b, a: 0.15 + 0.75 * act};
        return {r:c.r, g:c.g, b:c.b, a:0.15};
      }
      // EXACT clinical.html getNodeColor (lines 1647-1658)
      if (!selectedIssue) {
        var c = SYS_COLORS[n.sys] || SYS_COLORS.other;
        return {r:c.r, g:c.g, b:c.b, a:0.5};
      }
      if (!n.affected) {
        return {r:80, g:80, b:80, a:0.12};
      }
      var dir = n.affected.dir.toLowerCase();
      if (dir.indexOf('hyper') !== -1 || dir.indexOf('sensitized') !== -1) return {r:232, g:84, b:84, a:0.9};
      if (dir.indexOf('hypo') !== -1 || dir.indexOf('reduced') !== -1 || dir.indexOf('underdeveloped') !== -1) return {r:74, g:143, b:212, a:0.9};
      return {r:212, g:168, b:74, a:0.9};
    }

    function layoutNodes() {
      if (!canvas) return;
      var parent = canvas.parentElement;
      if (!parent) return;
      var vw = parent.clientWidth;
      var vh = parent.clientHeight;
      W = vw; H = vh;
      canvas.width = vw * DPR;
      canvas.height = vh * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      CX = vw / 2;
      CY = vh / 2;
    }

    function spawnPulses() {
      EDGES.forEach(function(e) {
        if (PULSES.length >= MAX_PULSES) return;
        var a = NODES[e.a], b = NODES[e.b];
        if (!a || !b) return;
        var et = EDGE_TYPES[e.type] || EDGE_TYPES.excit;
        var rate = et.rate;
        if (selectedIssue) {
          if (a.affected && b.affected) rate *= 1.8;
          else if (a.affected || b.affected) rate *= 0.4;
          else rate *= 0.15;
        }
        if (Math.random() < rate) {
          var dir = Math.random() > 0.5 ? 1 : -1;
          var sMin = et.speed[0], sMax = et.speed[1];
          var szMin = et.size[0], szMax = et.size[1];
          PULSES.push({
            a:e.a, b:e.b, type:e.type,
            progress: dir > 0 ? 0 : 1,
            speed: (sMin + Math.random() * (sMax - sMin)) * dir,
            size: szMin + Math.random() * (szMax - szMin),
            life: 1
          });
        }
      });
    }

    function drawPulses() {
      for (var i = PULSES.length - 1; i >= 0; i--) {
        var p = PULSES[i];
        p.progress += p.speed;
        if (p.progress > 1 || p.progress < 0) { PULSES.splice(i, 1); continue; }
        var na = NODES[p.a], nb = NODES[p.b];
        if (!na || !nb) { PULSES.splice(i, 1); continue; }
        var px = na.x + (nb.x - na.x) * p.progress;
        var py = na.y + (nb.y - na.y) * p.progress;
        var c;
        if (selectedIssue && na.affected && nb.affected) {
          var ca = getNodeColor(na), cb = getNodeColor(nb);
          c = {r:Math.round((ca.r+cb.r)/2), g:Math.round((ca.g+cb.g)/2), b:Math.round((ca.b+cb.b)/2)};
        } else if (selectedIssue && (na.affected || nb.affected)) {
          var src = na.affected ? na : nb;
          c = getNodeColor(src);
        } else {
          var sca = SYS_COLORS[na.sys] || SYS_COLORS.other;
          var scb = SYS_COLORS[nb.sys] || SYS_COLORS.other;
          c = {r:Math.round((sca.r+scb.r)/2), g:Math.round((sca.g+scb.g)/2), b:Math.round((sca.b+scb.b)/2)};
        }
        var alpha = selectedIssue ? (na.affected && nb.affected ? 0.7 : 0.15) : 0.3;
        var edgeFade = Math.min(p.progress * 5, (1 - p.progress) * 5, 1);
        alpha *= edgeFade;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, TAU);
        ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
        ctx.fill();
      }
    }

    function draw() {
      if (!animRunning) return;
      t += 0.016;
      galaxyAngle += galaxySpeed;
      ctx.clearRect(0, 0, W, H);

      var R = Math.min(W, H) * 0.38;
      var maxRadius = Math.min(W, H) * 0.4;
      NODE_LIST.forEach(function(n) {
        var a = n.angle + galaxyAngle;
        var spread = n.radius * R * 1.4;
        if (spread > maxRadius) spread = maxRadius;
        n.x = CX + Math.cos(a) * spread;
        n.y = CY + Math.sin(a) * spread;
      });

      // Draw edges — EXACT clinical.html (lines 1677-1695)
      EDGES.forEach(function(e) {
        var a = NODES[e.a], b = NODES[e.b];
        if (!a || !b) return;
        var ca = getNodeColor(a);
        var cb = getNodeColor(b);
        var alpha = 0.06;
        var lw = 0.5;
        if (propActive) {
          var pA = propMap[a.id] || 0, pB = propMap[b.id] || 0;
          if (pA > 0 && pB > 0) { alpha = Math.min(pA, pB) * 0.4; lw = 0.5 + Math.min(pA, pB) * 1.5; }
          else alpha = 0.02;
        } else if (selectedIssue) {
          if (a.affected && b.affected) { alpha = 0.2; lw = 1.5; }
          else if (a.affected || b.affected) alpha = 0.06;
          else alpha = 0.02;
        }
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(' + Math.round((ca.r+cb.r)/2) + ',' + Math.round((ca.g+cb.g)/2) + ',' + Math.round((ca.b+cb.b)/2) + ',' + alpha + ')';
        ctx.lineWidth = lw;
        ctx.stroke();
      });

      // Spawn and draw neural pulses — EXACT clinical.html
      spawnPulses();
      drawPulses();

      // Draw nodes — EXACT clinical.html (lines 1701-1750)
      NODE_LIST.forEach(function(n) {
        var c = getNodeColor(n);
        var sz = n.size;
        var isHovered = (hoveredNode === n);

        if (propActive && (propMap[n.id] || 0) > 0.3) {
          var pAct = propMap[n.id];
          var glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, sz * 4);
          glow.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (pAct * 0.2) + ')');
          glow.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
          ctx.beginPath();
          ctx.arc(n.x, n.y, sz * 4, 0, TAU);
          ctx.fillStyle = glow;
          ctx.fill();
        } else if (!propActive && selectedIssue && n.affected) {
          var pulse = 1 + Math.sin(t * 2 + n.angle * 5) * 0.15;
          sz *= pulse * 1.3;
          var glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, sz * 4);
          glow.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.2)');
          glow.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
          ctx.beginPath();
          ctx.arc(n.x, n.y, sz * 4, 0, TAU);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        if (isHovered) sz *= 1.5;

        // Node circle — EXACT clinical.html (lines 1724-1728)
        ctx.beginPath();
        ctx.arc(n.x, n.y, sz, 0, TAU);
        ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + c.a + ')';
        ctx.fill();

        // Stroke — EXACT clinical.html (lines 1730-1734)
        if (isHovered || (propActive && (propMap[n.id] || 0) > 0.5) || (!propActive && selectedIssue && n.affected)) {
          ctx.strokeStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + Math.min(c.a + 0.3, 1) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Label — EXACT clinical.html (lines 1736-1749)
        var showLabel = sz > 2.5 || isHovered;
        if (propActive) showLabel = showLabel || (propMap[n.id] || 0) > 0.3;
        else if (selectedIssue) showLabel = showLabel || n.affected;
        if (showLabel) {
          var labelAlpha;
          if (propActive) { labelAlpha = Math.max(0.1, propMap[n.id] || 0); }
          else if (selectedIssue) { labelAlpha = n.affected ? 0.8 : 0.1; }
          else { labelAlpha = 0.35; }
          if (isHovered) labelAlpha = 1;
          ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + labelAlpha + ')';
          var fontSize = Math.max(7, Math.min(sz * 1.3, 13));
          ctx.font = (sz > 5 ? '500 ' : '') + fontSize + 'px IBM Plex Mono';
          ctx.textAlign = 'center';
          var labelOffset = sz > 8 ? sz + 18 : sz + 10;
          var lines = n.label.split('\n');
          lines.forEach(function(line, i) {
            ctx.fillText(line, n.x, n.y + labelOffset + i * (fontSize + 2));
          });
        }
      });

      requestAnimationFrame(draw);
    }

    function getMouseNode(mx, my) {
      var best = null, bestD = 20;
      NODE_LIST.forEach(function(n) {
        var dx = mx - n.x, dy = my - n.y;
        var d = Math.sqrt(dx*dx + dy*dy);
        var hitR = Math.max(n.size * 2, 12);
        if (d < hitR && d < bestD) { best = n; bestD = d; }
      });
      return best;
    }

    function init(opts) {
      opts = opts || {};
      canvas = typeof opts.canvas === 'string' ? document.getElementById(opts.canvas) : opts.canvas;
      if (!canvas) { console.error('ConnectomeCore.Canvas: no canvas element'); return; }
      ctx = canvas.getContext('2d');
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      onNodeClick = opts.onNodeClick || null;
      onNodeHover = opts.onNodeHover || null;
      domainLabelMap = opts.domainLabels || null;

      buildNodes();
      layoutNodes();

      // Mouse events
      canvas.addEventListener('mousemove', function(e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var n = getMouseNode(mx, my);
        hoveredNode = n;
        canvas.style.cursor = n ? 'pointer' : 'default';
        if (onNodeHover) onNodeHover(n);
      });

      canvas.addEventListener('mouseleave', function() {
        hoveredNode = null;
      });

      canvas.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var n = getMouseNode(mx, my);
        selectedNode = n;
        // Notify UI mode manager of node focus
        try {
          window.dispatchEvent(new CustomEvent('limen:node-selected', {
            detail: { nodeId: n ? n.id : null, node: n }
          }));
        } catch (ignore) {}
        // Trigger propagation from clicked node
        if (n && window.LIMENPropagation) {
          if (propActive && propSeedNodes[n.id]) {
            resetPropagation(); // clicking same seed resets
          } else {
            startPropagation(n.id);
          }
        } else if (!n) {
          resetPropagation();
        }
        if (onNodeClick) {
          var idx = null;
          if (n) { for (var i = 0; i < NODE_LIST.length; i++) { if (NODE_LIST[i] === n) { idx = i; break; } } }
          onNodeClick(n, idx, {x: mx, y: my, clientX: e.clientX, clientY: e.clientY, offsetX: e.offsetX, offsetY: e.offsetY});
        }
      });

      window.addEventListener('resize', function() { layoutNodes(); });

      // Start animation
      animRunning = true;
      requestAnimationFrame(draw);
    }

    function loadBase(url, cb) {
      // Base data can be used if switching to JSON-based node definitions
      // For now, nodes are built inline. This fetches brain-connectome.json for compatibility.
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.onload = function() {
        if (cb) cb(null, JSON.parse(xhr.responseText));
      };
      xhr.onerror = function() { if (cb) cb('Failed to load ' + url); };
      xhr.send();
    }

    function applyActivationData() {
      activationMap = {};
      if (!activationData) return;
      // Domain JSONs use activations[].brainNodeId format
      var acts = activationData.activations || [];
      for (var i = 0; i < acts.length; i++) {
        var act = acts[i];
        var n = NODES[act.brainNodeId];
        if (!n) continue;
        n.activated = true;
        n.domainLabel = act.domainLabel || null;
        n.domainDescription = act.domainDescription || '';
        n.domainFunction = act.domainFunction || '';
        n.domainPhase = act.phase || '';
        n.domainGroup = act.group || '';
        n.whyThisNode = act.whyThisNode || null;
        n.treatments = act.treatments || [];
        n.childPortal = act.childPortal || null;
        n.phase_archetype = act.phase_archetype || '';
        n.brainLabel = n.label;
        // Compute phase vector for getPhaseColor — matches civilization.html pipeline
        n.phase_vector = initPhaseVector(n.domainPhase);
        n.dominant_phase = getDominantPhase(n.phase_vector);
        n.instability = computeInstability(n.phase_vector);
        activationMap[act.brainNodeId] = act;
      }
      // Add domain edges
      if (activationData.edges) {
        for (var i = 0; i < activationData.edges.length; i++) {
          var e = activationData.edges[i];
          if (NODES[e.source] && NODES[e.target]) {
            EDGES.push({a: e.source, b: e.target, w: e.weight || 0.5, type: e.type || 'excit', isDomainEdge: true});
          }
        }
      }
      activationLoaded = true;
    }

    function loadActivation(url, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.onload = function() {
        try {
          activationData = JSON.parse(xhr.responseText);
          applyActivationData();
          if (cb) cb(null, activationData);
        } catch(e) { if (cb) cb(e); }
      };
      xhr.onerror = function() { if (cb) cb('Failed to load ' + url); };
      xhr.send();
    }

    function selectIssue(issue) {
      if (window.LIMENHebbian && window.LIMENHebbian.reset) {
        window.LIMENHebbian.reset();
      }
      selectedIssue = issue;
      NODE_LIST.forEach(function(n) { n.affected = null; });
      if (issue && issue.circuits) {
        issue.circuits.forEach(function(c) {
          if (NODES[c.nodeId || c.node]) {
            NODES[c.nodeId || c.node].affected = c;
          }
        });
      }
    }

    function clearIssue() {
      selectedIssue = null;
      NODE_LIST.forEach(function(n) { n.affected = null; });
    }

    function destroy() {
      animRunning = false;
    }

    function getActivatedNodes() {
      var result = [];
      for (var i = 0; i < NODE_LIST.length; i++) {
        if (NODE_LIST[i].activated) result.push({node: NODE_LIST[i], index: i});
      }
      return result;
    }

    function getActivationMap() {
      return activationMap;
    }

    function select(idx) {
      selectedNode = (idx >= 0 && idx < NODE_LIST.length) ? NODE_LIST[idx] : null;
    }

    function deselect() {
      selectedNode = null;
    }

    function centerOn() {
      // No camera panning in 2D galaxy — no-op for API compatibility
    }

    function applyActivation(data) {
      activationData = data;
      applyActivationData();
    }

    // ── Propagation integration ──

    function _propApplyResult(result) {
      propMap = {};
      propHyperSet = {};
      for (var numId in result.activations) {
        if (!result.activations.hasOwnProperty(numId)) continue;
        var cid = NUM_TO_CANVAS[numId];
        if (cid && NODES[cid]) {
          var val = result.activations[numId];
          if (!propMap[cid] || val > propMap[cid]) propMap[cid] = val;
        }
      }
      for (var h = 0; h < result.hyper.length; h++) {
        var hcid = NUM_TO_CANVAS[result.hyper[h]];
        if (hcid) propHyperSet[hcid] = true;
      }
    }

    function _propAnimStep() {
      _propStep++;
      if (_propStep > 5 || !window.LIMENPropagation) return;
      try {
        var _hebbEdges = (window.LIMENHebbian && window.LIMENHebbian.getAdjustedEdges) ? window.LIMENHebbian.getAdjustedEdges() : null;
        var result = window.LIMENPropagation.activate(_propNumSeeds, _hebbEdges, _propStep);
        _propApplyResult(result);
        if (window.LIMENObserver && window.LIMENObserver.update) {
          window.LIMENObserver.update(result.activations);
        }
        if (window.LIMENMemory && window.LIMENMemory.update) {
          window.LIMENMemory.update(result.activations);
        }
        if (window.LIMENCuriosity && window.LIMENCuriosity.update) {
          window.LIMENCuriosity.update(result.activations);
        }
        if (window.LIMENHebbian && window.LIMENHebbian.update) {
          window.LIMENHebbian.update(result.activations);
        }
        if (window.LIMENWorkspace && window.LIMENWorkspace.update) {
          window.LIMENWorkspace.update(result.activations);
        }
        if (window.LIMENWorld && window.LIMENWorld.update) {
          window.LIMENWorld.update(result.activations);
          if (window.LIMENPropagation && window.LIMENPropagation.injectSeeds) {
            window.LIMENPropagation.injectSeeds(window.LIMENWorld.getSeeds());
          }
        }
      } catch(e) { console.warn('Propagation step error:', e); }
      if (_propStep < 5) {
        _propTimer = setTimeout(_propAnimStep, 300);
      }
    }

    function startPropagation(canvasNodeId) {
      resetPropagation();
      if (!window.LIMENPropagation) return;
      var numId = CANVAS_TO_NUM[canvasNodeId];
      if (!numId) return;
      _propNumSeeds = {};
      _propNumSeeds[numId] = 1.0;
      propSeedNodes = {};
      propSeedNodes[canvasNodeId] = true;
      propActive = true;
      _propStep = 0;
      _propAnimStep();
      var btn = document.getElementById('propResetBtn');
      if (btn) btn.style.display = '';
    }

    function startPropagationFromIssue(issue) {
      resetPropagation();
      if (!window.LIMENPropagation || !issue || !issue.circuits) return;
      _propNumSeeds = {};
      propSeedNodes = {};
      issue.circuits.forEach(function(c) {
        var nid = c.nodeId || c.node;
        var numId = CANVAS_TO_NUM[nid];
        if (numId) { _propNumSeeds[numId] = 1.0; propSeedNodes[nid] = true; }
      });
      if (Object.keys(_propNumSeeds).length === 0) return;
      propActive = true;
      _propStep = 0;
      _propAnimStep();
      var btn = document.getElementById('propResetBtn');
      if (btn) btn.style.display = '';
    }

    function resetPropagation() {
      propActive = false;
      propMap = {};
      propHyperSet = {};
      propSeedNodes = {};
      _propNumSeeds = {};
      _propStep = 0;
      if (_propTimer) { clearTimeout(_propTimer); _propTimer = null; }
      if (window.LIMENObserver && window.LIMENObserver.reset) {
        window.LIMENObserver.reset();
      }
      if (window.LIMENMemory && window.LIMENMemory.reset) {
        window.LIMENMemory.reset();
      }
      if (window.LIMENCuriosity && window.LIMENCuriosity.reset) {
        window.LIMENCuriosity.reset();
      }
      if (window.LIMENHebbian && window.LIMENHebbian.reset) {
        window.LIMENHebbian.reset();
      }
      if (window.LIMENWorkspace && window.LIMENWorkspace.reset) {
        window.LIMENWorkspace.reset();
      }
      if (window.LIMENWorld && window.LIMENWorld.reset) {
        window.LIMENWorld.reset();
      }
      var btn = document.getElementById('propResetBtn');
      if (btn) btn.style.display = 'none';
    }

    return {
      init: init,
      loadBase: loadBase,
      loadActivation: loadActivation,
      selectIssue: selectIssue,
      clearIssue: clearIssue,
      layoutNodes: layoutNodes,
      draw: draw,
      getNodeColor: getNodeColor,
      spawnPulses: spawnPulses,
      drawPulses: drawPulses,
      getMouseNode: getMouseNode,
      destroy: destroy,
      getNodes: function() { return NODES; },
      getNodeList: function() { return NODE_LIST; },
      getEdges: function() { return EDGES; },
      getActivatedNodes: getActivatedNodes,
      getActivationMap: getActivationMap,
      select: select,
      deselect: deselect,
      centerOn: centerOn,
      applyActivation: applyActivation,
      startPropagation: startPropagation,
      startPropagationFromIssue: startPropagationFromIssue,
      resetPropagation: resetPropagation
    };
  })();

  // ═══════════════════════════════════════
  // MODULE 2: Brain3D (Three.js Brain Atlas)
  // ═══════════════════════════════════════

  var Brain3D = (function() {
    // MNI coordinates — 111 nodes in MNI space
    var MNI_COORDS = {
      DMN:{x:0,y:8,z:5}, mPFC:{x:0,y:30,z:12}, PCC:{x:0,y:-28,z:20},
      PRECUNEUS:{x:0,y:-32,z:35}, AG:{x:-34,y:-36,z:22}, TPOLE:{x:-36,y:5,z:-22},
      RSC:{x:-6,y:-32,z:10}, OFC:{x:0,y:22,z:-15}, EC:{x:-22,y:-8,z:-22},
      rACC:{x:2,y:25,z:15}, DISS:{x:4,y:-5,z:28},
      SN:{x:32,y:14,z:4}, AI:{x:32,y:16,z:2}, dACC:{x:0,y:20,z:24},
      TPJ:{x:-38,y:-32,z:16}, PI:{x:-34,y:-10,z:5}, CON:{x:28,y:10,z:14},
      VAN:{x:38,y:-30,z:10},
      ECN:{x:34,y:20,z:18}, dlPFC:{x:35,y:22,z:22}, vlPFC:{x:36,y:16,z:2},
      FEF:{x:26,y:0,z:36}, IPS:{x:-26,y:-36,z:30}, FPN:{x:32,y:-34,z:28},
      BLA:{x:-22,y:-4,z:-14}, CeA:{x:-20,y:-2,z:-12}, BNST:{x:-7,y:2,z:-2},
      vmPFC:{x:0,y:28,z:-8}, PAG:{x:0,y:-22,z:-12}, EMP:{x:36,y:-28,z:14},
      HIPP:{x:-26,y:-16,z:-10},
      VV:{x:3,y:-28,z:-18}, DV:{x:0,y:-25,z:-16}, NTS:{x:3,y:-26,z:-18},
      SNS:{x:7,y:-26,z:-16}, CARD:{x:6,y:-22,z:-14}, LAR:{x:5,y:-25,z:-20},
      HPA:{x:0,y:-3,z:-6}, HYPO:{x:0,y:-2,z:-8}, PIT:{x:0,y:-4,z:-14},
      ADR:{x:4,y:-22,z:-16},
      NAcc:{x:-9,y:8,z:-4}, VTA:{x:0,y:-14,z:-10}, STRI:{x:-14,y:4,z:4},
      HAB:{x:3,y:-10,z:2},
      CAUD:{x:-11,y:10,z:8}, PUT:{x:-22,y:4,z:2}, GP:{x:-16,y:0,z:0},
      STN:{x:-9,y:-8,z:-3}, VP:{x:-10,y:2,z:-4}, SNIG:{x:-7,y:-14,z:-8},
      THAL:{x:0,y:-6,z:4}, MDT:{x:-5,y:-7,z:6}, ANT:{x:-3,y:-3,z:8},
      PULV:{x:-8,y:-20,z:6}, LGN:{x:-18,y:-18,z:0}, MGN:{x:-15,y:-18,z:-2},
      RAPHE:{x:0,y:-24,z:-15}, LC:{x:4,y:-28,z:-16}, ENDO:{x:18,y:-12,z:-4},
      OPIOID:{x:-12,y:-22,z:-14}, OXY:{x:-4,y:-4,z:-6}, GABA_GLU:{x:14,y:0,z:12},
      EI:{x:-12,y:4,z:16},
      V1:{x:-6,y:-48,z:2}, A1:{x:-40,y:-22,z:7}, S1:{x:-28,y:-12,z:34},
      OLF:{x:-12,y:16,z:-12},
      M1:{x:-28,y:-8,z:38}, SMA:{x:-4,y:2,z:38}, CMZ:{x:-4,y:-6,z:38},
      SMN:{x:-24,y:-10,z:36},
      BROCA:{x:-38,y:12,z:10}, WERN:{x:-38,y:-34,z:6}, LANG:{x:-38,y:5,z:7},
      STS:{x:-40,y:-18,z:0}, FG:{x:-28,y:-38,z:-12},
      MAMM:{x:0,y:-8,z:-10}, SEPT:{x:0,y:6,z:-2}, NBM:{x:-10,y:2,z:-6},
      FORN:{x:0,y:-3,z:2}, CING:{x:0,y:-6,z:30},
      BDNF:{x:18,y:-22,z:12}, TrkB:{x:22,y:-20,z:15},
      GBA:{x:0,y:-22,z:-15}, ENS:{x:3,y:-24,z:-16}, MICRO:{x:-4,y:-22,z:-15},
      OSC:{x:0,y:-26,z:8}, RF:{x:0,y:-24,z:-12},
      PIN:{x:0,y:-16,z:6}, VEST:{x:10,y:-24,z:-8}, CBLM:{x:0,y:-24,z:-18},
      SC:{x:0,y:-22,z:-4}, IC:{x:0,y:-24,z:-6}, PBN:{x:4,y:-28,z:-12},
      PPN:{x:4,y:-22,z:-10}, CLAUST:{x:-28,y:2,z:2},
      CC:{x:0,y:0,z:12}, CCorp:{x:0,y:0,z:12},
      UNC:{x:-30,y:12,z:-12}, ARC:{x:-36,y:-22,z:16},
      DAN:{x:-22,y:-34,z:32}, VERM:{x:0,y:-22,z:-20}, NEOCER:{x:-14,y:-24,z:-16},
      FPC:{x:-4,y:62,z:4}, DMNMTL:{x:-24,y:-18,z:-18},
      ACC:{x:0,y:30,z:24}, MI:{x:-38,y:0,z:4}, sgACC:{x:0,y:24,z:-8},
      IPL:{x:-40,y:-50,z:46}, SPL:{x:-20,y:-62,z:58}, MFC:{x:0,y:40,z:30},
      rPFC:{x:40,y:44,z:16}, V4V5:{x:-42,y:-72,z:-4}, S2:{x:-52,y:-24,z:18},
      EBA:{x:-48,y:-72,z:4}, PMC:{x:-34,y:-4,z:54}, PRC:{x:-28,y:-12,z:-28},
      PPA:{x:-26,y:-42,z:-10}, SDH:{x:0,y:-38,z:-44}, VIA:{x:2,y:-30,z:-22},
      SCN:{x:0,y:0,z:-14}, ASTRO:{x:12,y:-18,z:14}, BBB:{x:8,y:-14,z:6}
    };

    // 3D-specific node descriptions
    var NODE_DESC = {
      DMN:'Default Mode Network hub — self-referential processing, mind-wandering, autobiographical memory',
      mPFC:'Medial Prefrontal Cortex — self-evaluation, emotional regulation, social cognition',
      PCC:'Posterior Cingulate Cortex — autobiographical memory retrieval, self-reflection',
      PRECUNEUS:'Precuneus — visuospatial imagery, self-awareness, episodic memory',
      AG:'Angular Gyrus — semantic processing, number cognition, spatial attention',
      TPOLE:'Temporal Pole — semantic memory, social-emotional processing, face-name association',
      RSC:'Retrosplenial Cortex — spatial memory, scene construction, navigation',
      OFC:'Orbitofrontal Cortex — reward valuation, decision-making, impulse control',
      EC:'Entorhinal Cortex — memory gateway, grid cells, hippocampal input',
      rACC:'Rostral Anterior Cingulate — emotional processing, conflict monitoring, pain modulation',
      DISS:'Dissociative node — depersonalization, derealization, identity fragmentation',
      SN:'Salience Network hub — detecting relevant stimuli, switching attention',
      AI:'Anterior Insula — interoception, emotional awareness, empathy, disgust',
      dACC:'Dorsal Anterior Cingulate — error detection, conflict monitoring, cognitive control',
      TPJ:'Temporoparietal Junction — theory of mind, perspective-taking, self-other distinction',
      PI:'Posterior Insula — pain processing, body ownership, temperature sensing',
      CON:'Cingulo-Opercular Network — sustained attention, task maintenance',
      VAN:'Ventral Attention Network — stimulus-driven reorienting, surprise detection',
      ECN:'Executive Control Network hub — working memory, planning, flexible cognition',
      dlPFC:'Dorsolateral Prefrontal Cortex — working memory, cognitive flexibility, planning',
      vlPFC:'Ventrolateral Prefrontal Cortex — response inhibition, language selection',
      FEF:'Frontal Eye Fields — voluntary eye movements, visual attention shifts',
      IPS:'Intraparietal Sulcus — visuospatial attention, numerosity, hand-eye coordination',
      FPN:'Frontoparietal Network — flexible task control, adaptive behavior',
      BLA:'Basolateral Amygdala — fear learning, emotional valuation, threat assessment',
      CeA:'Central Nucleus of Amygdala — fear expression, autonomic fear response output',
      BNST:'Bed Nucleus of Stria Terminalis — sustained anxiety, stress response, threat vigilance',
      vmPFC:'Ventromedial Prefrontal Cortex — fear extinction, value-based decisions, emotional regulation',
      PAG:'Periaqueductal Gray — pain modulation, defensive behavior, fight-flight-freeze',
      EMP:'Empathy Network hub — shared emotional experience, compassion, social cognition',
      HIPP:'Hippocampus — episodic memory formation, spatial navigation, contextual fear',
      VV:'Ventral Vagal Complex — social engagement, calm, parasympathetic safety',
      DV:'Dorsal Vagal Complex — immobilization, shutdown, conservation-withdrawal',
      NTS:'Nucleus Tractus Solitarius — visceral sensory relay, baroreceptor input',
      SNS:'Sympathetic Nervous System — fight-or-flight, arousal, energy mobilization',
      CARD:'Cardiac Control Center — heart rate regulation, baroreceptor reflex',
      LAR:'Laryngeal Branch — vocalization, prosody, vagal tone via voice',
      HPA:'HPA Axis hub — stress hormone cascade, cortisol regulation',
      HYPO:'Hypothalamus — homeostasis, hormone release, temperature, hunger, circadian rhythm',
      PIT:'Pituitary Gland — master endocrine gland, hormone secretion into bloodstream',
      ADR:'Adrenal Glands — cortisol and adrenaline release, acute stress response',
      NAcc:'Nucleus Accumbens — reward prediction, motivation, pleasure, addiction circuitry',
      VTA:'Ventral Tegmental Area — dopamine production, reward signaling, motivation',
      STRI:'Striatum — habit formation, reward-based learning, motor program selection',
      HAB:'Habenula — disappointment signal, reward prediction error, aversion processing',
      CAUD:'Caudate Nucleus — goal-directed behavior, procedural learning, OCD circuitry',
      PUT:'Putamen — motor execution, habit learning, implicit memory',
      GP:'Globus Pallidus — motor output gating, basal ganglia output nucleus',
      STN:'Subthalamic Nucleus — impulse control, action suppression, decision threshold',
      VP:'Ventral Pallidum — hedonic processing, reward output, pleasure hotspot',
      SNIG:'Substantia Nigra — dopamine for motor control, Parkinson\'s degeneration site',
      THAL:'Thalamus — sensory relay hub, cortical-cortical communication gateway',
      MDT:'Mediodorsal Thalamus — prefrontal relay, working memory, executive support',
      ANT:'Anterior Thalamic Nuclei — memory circuit relay, Papez circuit node',
      PULV:'Pulvinar — visual attention gating, salience filtering, cortical synchronization',
      LGN:'Lateral Geniculate Nucleus — visual relay from retina to V1',
      MGN:'Medial Geniculate Nucleus — auditory relay from cochlea to A1',
      RAPHE:'Raphe Nuclei — serotonin production, mood regulation, sleep-wake cycle',
      LC:'Locus Coeruleus — norepinephrine production, arousal, attention, stress response',
      ENDO:'Endocannabinoid System — stress buffering, synaptic plasticity, pain modulation',
      OPIOID:'Opioid System — pain relief, reward, social bonding, stress analgesia',
      OXY:'Oxytocin System — bonding, trust, social recognition, maternal behavior',
      GABA_GLU:'GABA/Glutamate Balance — excitatory-inhibitory tone, neural stability',
      EI:'E/I Balance — excitation-inhibition ratio, seizure threshold, cortical gain',
      V1:'Primary Visual Cortex — basic visual processing, edge detection, orientation',
      A1:'Primary Auditory Cortex — sound processing, tonotopic mapping, temporal patterns',
      S1:'Primary Somatosensory Cortex — touch, pressure, proprioception, body mapping',
      OLF:'Olfactory Cortex — smell processing, emotional memory trigger, appetite',
      M1:'Primary Motor Cortex — voluntary movement execution, fine motor control',
      SMA:'Supplementary Motor Area — movement planning, sequencing, bimanual coordination',
      CMZ:'Cingulate Motor Zone — emotionally-driven movement, motor-affect integration',
      SMN:'Somatomotor Network — coordinated body movement, sensorimotor integration',
      BROCA:'Broca\'s Area — speech production, language syntax, verbal working memory',
      WERN:'Wernicke\'s Area — language comprehension, speech perception, semantic processing',
      LANG:'Language Network hub — integrated language processing, inner speech',
      STS:'Superior Temporal Sulcus — voice perception, biological motion, social cues',
      FG:'Fusiform Gyrus — face recognition, visual word form, category-specific processing',
      MAMM:'Mammillary Bodies — memory consolidation, Papez circuit relay, spatial memory',
      SEPT:'Septal Nuclei — pleasure, reward modulation, hippocampal theta rhythm',
      NBM:'Nucleus Basalis of Meynert — acetylcholine supply, cortical arousal, attention',
      FORN:'Fornix — hippocampal output fiber tract, memory circuit white matter',
      CING:'Cingulate Cortex — emotion-cognition integration, pain processing, motivation',
      BDNF:'Brain-Derived Neurotrophic Factor — neuronal growth, synaptic plasticity, survival',
      TrkB:'TrkB Receptor — BDNF receptor, plasticity signaling, antidepressant target',
      GBA:'Gut-Brain Axis hub — bidirectional gut-brain signaling, immune-neural interface',
      ENS:'Enteric Nervous System — second brain, gut motility, local neurotransmitter production',
      MICRO:'Microbiome — gut bacteria influencing mood, inflammation, neurotransmitter precursors',
      OSC:'Oscillatory Entrainment — rhythmic neural synchronization, cross-frequency coupling',
      RF:'Reticular Formation — arousal regulation, sleep-wake transitions, consciousness gating',
      PIN:'Pineal Gland — melatonin production, circadian rhythm, seasonal biology',
      VEST:'Vestibular System — balance, spatial orientation, self-motion perception',
      CBLM:'Cerebellum — motor coordination, timing, error prediction, cognitive sequencing',
      SC:'Superior Colliculus — visual orienting, saccade generation, multisensory integration',
      IC:'Inferior Colliculus — auditory processing relay, sound localization',
      PBN:'Parabrachial Nucleus — pain relay, taste processing, respiratory chemosensation',
      PPN:'Pedunculopontine Nucleus — locomotion, REM sleep, arousal, reward processing',
      CLAUST:'Claustrum — consciousness integration, cross-modal binding, salience coordination',
      CC:'Corpus Callosum — interhemispheric communication, bilateral coordination',
      CCorp:'Corpus Callosum — largest white matter tract, connects left and right hemispheres',
      UNC:'Uncinate Fasciculus — connects OFC to temporal pole, emotional memory pathway',
      ARC:'Arcuate Fasciculus — connects Broca\'s to Wernicke\'s, language pathway',
      DAN:'Dorsal Attention Network — top-down voluntary attention, spatial orienting',
      VERM:'Vermis — cerebellar midline, emotional regulation, postural control',
      NEOCER:'Neocerebellum — cognitive cerebellum, language, working memory support',
      FPC:'Frontopolar Cortex — prospective memory, multitasking, abstract reasoning',
      DMNMTL:'DMN Medial Temporal Lobe — episodic memory retrieval, scene construction, autobiographical recall',
      ACC:'Anterior Cingulate Cortex — conflict monitoring, error detection, emotional-cognitive integration',
      MI:'Middle Insula — interoceptive awareness, autonomic integration, body-state mapping',
      sgACC:'Subgenual Anterior Cingulate — mood regulation, autonomic control, depression target',
      IPL:'Inferior Parietal Lobule — tool use, semantic integration, spatial reasoning',
      SPL:'Superior Parietal Lobule — visuospatial processing, attention shifting, reaching',
      MFC:'Medial Frontal Cortex — social cognition, mentalizing, value computation',
      rPFC:'Right Prefrontal Cortex — sustained attention, inhibitory control, metacognition',
      V4V5:'V4/V5 Complex — color processing, motion perception, visual form',
      S2:'Secondary Somatosensory Cortex — tactile discrimination, pain processing, bilateral integration',
      EBA:'Extrastriate Body Area — body perception, action observation, self-body recognition',
      PMC:'Premotor Cortex — motor planning, action selection, imitation',
      PRC:'Perirhinal Cortex — object recognition memory, familiarity judgments, semantic association',
      PPA:'Parahippocampal Place Area — scene recognition, spatial context, navigation landmarks',
      SDH:'Spinal Dorsal Horn — pain gating, somatosensory relay, reflex integration',
      VIA:'Visceral Interoception Area — gut-brain signals, autonomic awareness, homeostatic drive',
      SCN:'Suprachiasmatic Nucleus — master circadian clock, light entrainment, sleep-wake regulation',
      ASTRO:'Astrocytes — synaptic support, neurotransmitter recycling, blood-brain barrier maintenance',
      BBB:'Blood-Brain Barrier — selective permeability, neuroprotection, drug delivery gating'
    };

    var state = {
      active: false, scene: null, camera: null, renderer: null,
      brainMesh: null, nodeMeshes: {}, edgeLines: [], pulseMeshes: [],
      animId: null, isDragging: false, prevMouse: {x:0, y:0},
      spherical: {theta:0, phi:Math.PI/2.5, radius:160},
      targetSpherical: {theta:0, phi:Math.PI/2.5, radius:160},
      autoRotate: true, clock: 0, selectedNode: null,
      controlsAttached: false, dxOverlay: null, legendCreated: false
    };

    var containerId = 'brain3dContainer';
    var nodesRef = null; // reference to Canvas NODES
    var nodeListRef = null; // reference to Canvas NODE_LIST
    var edgesRef = null;
    var getNodeColorFn = null;
    var selectedIssueFn = null;

    function init(opts) {
      opts = opts || {};
      containerId = opts.containerId || 'brain3dContainer';
      nodesRef = opts.nodes || Canvas.getNodes();
      nodeListRef = opts.nodeList || Canvas.getNodeList();
      edgesRef = opts.edges || Canvas.getEdges();
      getNodeColorFn = opts.getNodeColor || Canvas.getNodeColor;
      selectedIssueFn = opts.getSelectedIssue || function() { return null; };

      if (typeof THREE === 'undefined') {
        console.warn('ConnectomeCore.Brain3D: THREE.js not loaded');
        return;
      }
      initScene();
    }

    function initScene() {
      if (state.scene) return;
      var container = document.getElementById(containerId);
      if (!container) return;
      var w = container.clientWidth;
      var h = container.clientHeight;

      state.scene = new THREE.Scene();
      state.camera = new THREE.PerspectiveCamera(45, w / h, 1, 1000);
      state.camera.position.set(0, 20, 160);
      state.camera.lookAt(0, 0, 0);

      state.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
      state.renderer.setSize(w, h);
      state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      state.renderer.setClearColor(0x0c0d10, 1);
      container.appendChild(state.renderer.domElement);

      // Lights
      state.scene.add(new THREE.AmbientLight(0x405060, 0.7));
      var d1 = new THREE.DirectionalLight(0xc0c8d0, 0.35);
      d1.position.set(50, 80, 100);
      state.scene.add(d1);
      var d2 = new THREE.DirectionalLight(0x6090c0, 0.2);
      d2.position.set(-60, -30, -50);
      state.scene.add(d2);

      // Brain material
      var brainMat = new THREE.MeshPhongMaterial({
        color: 0x7aaed0, transparent: true, opacity: 0.09,
        depthWrite: false, side: THREE.DoubleSide, specular: 0x111111, shininess: 5
      });

      // Placeholder sphere
      var placeholderGeo = new THREE.SphereGeometry(38, 32, 24);
      var placeholderMesh = new THREE.Mesh(placeholderGeo, brainMat.clone());
      placeholderMesh.material.opacity = 0.04;
      state.scene.add(placeholderMesh);
      state.brainMesh = placeholderMesh;

      // Load GLB brain mesh
      loadBrainMesh('models/brain.glb', brainMat, placeholderMesh);

      // Orientation labels
      makeLabel('ANTERIOR', {x:0,y:-2,z:72}, 'rgba(201,169,78,0.22)');
      makeLabel('POSTERIOR', {x:0,y:-2,z:-65}, 'rgba(201,169,78,0.22)');
      makeLabel('LEFT', {x:-70,y:-2,z:0}, 'rgba(201,169,78,0.20)');
      makeLabel('RIGHT', {x:70,y:-2,z:0}, 'rgba(201,169,78,0.20)');
      makeLabel('SUPERIOR', {x:0,y:48,z:0}, 'rgba(201,169,78,0.16)');
      makeLabel('FRONTAL', {x:0,y:25,z:55}, 'rgba(180,160,120,0.13)');
      makeLabel('OCCIPITAL', {x:0,y:5,z:-55}, 'rgba(180,160,120,0.13)');
      makeLabel('TEMPORAL', {x:-55,y:-15,z:0}, 'rgba(180,160,120,0.11)');
      makeLabel('CEREBELLUM', {x:0,y:-44,z:-22}, 'rgba(180,160,120,0.11)');

      // Create node spheres
      createNodeSpheres();
      // Create edge lines
      createEdgeLines();
    }

    function loadBrainMesh(url, brainMat, placeholder) {
      // Inline minimal GLB parser
      var GLTFLoader = (function() {
        function Loader() {}
        Loader.prototype.load = function(url, onLoad, onProgress, onError) {
          var self = this;
          var loader = new THREE.FileLoader(THREE.DefaultLoadingManager);
          loader.setResponseType('arraybuffer');
          loader.load(url, function(data) {
            try { self.parse(data, '', onLoad, onError); }
            catch(e) { if (onError) onError(e); else console.error('GLB parse error:', e); }
          }, onProgress, onError);
        };
        Loader.prototype.parse = function(data, path, onLoad) {
          var dv = new DataView(data);
          if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Not a GLB file');
          var jsonLen = dv.getUint32(12, true);
          var jsonData = new Uint8Array(data, 20, jsonLen);
          var json = JSON.parse(new TextDecoder().decode(jsonData));
          var binOffset = 20 + jsonLen;
          if (binOffset % 4 !== 0) binOffset += 4 - (binOffset % 4);
          binOffset += 8;
          var binData = new Uint8Array(data, binOffset);
          var prim = json.meshes[0].primitives[0];
          function getAcc(idx) {
            var acc = json.accessors[idx];
            var bv = json.bufferViews[acc.bufferView];
            var off = (bv.byteOffset||0) + (acc.byteOffset||0);
            var cnt = acc.count * ({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[acc.type]||1);
            if (acc.componentType === 5126) return new Float32Array(binData.buffer, binData.byteOffset + off, cnt);
            if (acc.componentType === 5125) return new Uint32Array(binData.buffer, binData.byteOffset + off, cnt);
            if (acc.componentType === 5123) return new Uint16Array(binData.buffer, binData.byteOffset + off, cnt);
            return new Float32Array(binData.buffer, binData.byteOffset + off, cnt);
          }
          var positions = getAcc(prim.attributes.POSITION);
          var indices = prim.indices !== undefined ? getAcc(prim.indices) : null;
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          if (indices) geo.setIndex(new THREE.BufferAttribute(indices, 1));
          if (prim.attributes.NORMAL !== undefined) geo.setAttribute('normal', new THREE.Float32BufferAttribute(getAcc(prim.attributes.NORMAL), 3));
          else geo.computeVertexNormals();
          onLoad({scene: new THREE.Mesh(geo, null)});
        };
        return Loader;
      })();

      new GLTFLoader().load(url, function(gltf) {
        state.scene.remove(placeholder);
        var brainGeo = gltf.scene.geometry;
        var pos = brainGeo.attributes.position;
        for (var i = 0; i < pos.count; i++) {
          var oy = pos.getY(i), oz = pos.getZ(i);
          pos.setXYZ(i, pos.getX(i), oz, oy);
        }
        pos.needsUpdate = true;
        brainGeo.computeVertexNormals();
        brainGeo.computeBoundingBox();
        var bb = brainGeo.boundingBox;
        var meshMaxHalf = Math.max(
          Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x)),
          Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y)),
          Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z))
        );
        var BRAIN_SCALE = 62 / meshMaxHalf;
        var realBrain = new THREE.Mesh(brainGeo, brainMat);
        realBrain.scale.set(BRAIN_SCALE, BRAIN_SCALE, BRAIN_SCALE);
        state.scene.add(realBrain);
        state.brainMesh = realBrain;
        var wireMat = new THREE.MeshBasicMaterial({
          color:0x6a94b6, transparent:true, opacity:0.012, wireframe:true, depthWrite:false
        });
        var wireOverlay = new THREE.Mesh(brainGeo.clone(), wireMat);
        wireOverlay.scale.set(BRAIN_SCALE*1.002, BRAIN_SCALE*1.002, BRAIN_SCALE*1.002);
        state.scene.add(wireOverlay);
        console.log('ConnectomeCore: Brain mesh loaded \u2014 ' + pos.count + ' vertices');
      }, undefined, function() {
        console.warn('ConnectomeCore: Brain mesh load failed, keeping placeholder');
      });
    }

    function makeLabel(text, pos, color) {
      var c2 = document.createElement('canvas');
      c2.width = 256; c2.height = 64;
      var cx2 = c2.getContext('2d');
      cx2.fillStyle = 'transparent';
      cx2.fillRect(0, 0, 256, 64);
      cx2.font = '500 24px IBM Plex Mono';
      cx2.textAlign = 'center';
      cx2.textBaseline = 'middle';
      cx2.fillStyle = color || 'rgba(201,169,78,0.25)';
      cx2.fillText(text, 128, 32);
      var tex = new THREE.CanvasTexture(c2);
      var spriteMat = new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false});
      var sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(pos.x, pos.y, pos.z);
      sprite.scale.set(32, 8, 1);
      state.scene.add(sprite);
      return sprite;
    }

    function createNodeSpheres() {
      var nodeScale = 0.85;
      nodeListRef.forEach(function(n) {
        var mni = MNI_COORDS[n.id];
        if (!mni) return;
        var sz = Math.max(n.size * 0.35, 1.0);
        var geo = new THREE.SphereGeometry(sz, 12, 8);
        var sc = SYS_COLORS[n.sys] || SYS_COLORS.other;
        var mat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(sc.r/255, sc.g/255, sc.b/255),
          transparent: true, opacity: 0.6,
          emissive: new THREE.Color(sc.r/510, sc.g/510, sc.b/510),
          shininess: 30
        });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(mni.x * nodeScale, mni.y * nodeScale, mni.z * nodeScale);
        mesh.userData = {nodeId: n.id, baseSize: sz, baseColor: sc};
        state.scene.add(mesh);
        state.nodeMeshes[n.id] = mesh;

        // Glow sphere
        var glowGeo = new THREE.SphereGeometry(sz * 2.5, 8, 6);
        var glowMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(sc.r/255, sc.g/255, sc.b/255),
          transparent: true, opacity: 0, depthWrite: false
        });
        var glowMesh = new THREE.Mesh(glowGeo, glowMat);
        glowMesh.position.copy(mesh.position);
        state.scene.add(glowMesh);
        mesh.userData.glow = glowMesh;
      });
    }

    function createEdgeLines() {
      var nodeScale = 0.85;
      var edgeMat = new THREE.LineBasicMaterial({
        color: 0x555555, transparent: true, opacity: 0.08, depthWrite: false
      });
      edgesRef.forEach(function(e) {
        var mniA = MNI_COORDS[e.a], mniB = MNI_COORDS[e.b];
        if (!mniA || !mniB) return;
        var pts = [];
        pts.push(new THREE.Vector3(mniA.x*nodeScale, mniA.y*nodeScale, mniA.z*nodeScale));
        var mx = (mniA.x+mniB.x)/2*nodeScale + (Math.random()-0.5)*3;
        var my = (mniA.y+mniB.y)/2*nodeScale + (Math.random()-0.5)*3;
        var mz = (mniA.z+mniB.z)/2*nodeScale + (Math.random()-0.5)*3;
        pts.push(new THREE.Vector3(mx, my, mz));
        pts.push(new THREE.Vector3(mniB.x*nodeScale, mniB.y*nodeScale, mniB.z*nodeScale));
        var curve = new THREE.QuadraticBezierCurve3(pts[0], pts[1], pts[2]);
        var geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(12));
        var line = new THREE.Line(geo, edgeMat.clone());
        line.userData = {a: e.a, b: e.b, type: e.type};
        state.scene.add(line);
        state.edgeLines.push(line);
      });
    }

    function updateNodeStates() {
      if (!state.scene) return;
      var issue = selectedIssueFn();
      nodeListRef.forEach(function(n) {
        var mesh = state.nodeMeshes[n.id];
        if (!mesh) return;
        var bc = mesh.userData.baseColor;
        var glow = mesh.userData.glow;
        if (issue && n.affected) {
          var dir = n.affected.dir.toLowerCase();
          var r, g, b;
          if (dir.indexOf('hyper') !== -1 || dir.indexOf('sensitized') !== -1) { r=232; g=84; b=84; }
          else if (dir.indexOf('hypo') !== -1 || dir.indexOf('reduced') !== -1 || dir.indexOf('underdeveloped') !== -1) { r=74; g=143; b=212; }
          else { r=212; g=168; b=74; }
          mesh.material.color.setRGB(r/255, g/255, b/255);
          mesh.material.emissive.setRGB(r/510, g/510, b/510);
          mesh.material.opacity = 0.9;
          mesh.scale.setScalar(1.4);
          if (glow) { glow.material.color.setRGB(r/255, g/255, b/255); glow.material.opacity = 0.1; }
        } else if (issue) {
          mesh.material.color.setRGB(0.2, 0.2, 0.2);
          mesh.material.emissive.setRGB(0.05, 0.05, 0.05);
          mesh.material.opacity = 0.15;
          mesh.scale.setScalar(0.7);
          if (glow) glow.material.opacity = 0;
        } else {
          mesh.material.color.setRGB(bc.r/255, bc.g/255, bc.b/255);
          mesh.material.emissive.setRGB(bc.r/510, bc.g/510, bc.b/510);
          mesh.material.opacity = 0.6;
          mesh.scale.setScalar(1);
          if (glow) glow.material.opacity = 0;
        }
      });
      // Update edges
      state.edgeLines.forEach(function(line) {
        var na = nodesRef[line.userData.a];
        var nb = nodesRef[line.userData.b];
        if (issue) {
          if (na && na.affected && nb && nb.affected) {
            line.material.opacity = 0.25;
            var ca = getNodeColorFn(na);
            line.material.color.setRGB(ca.r/255, ca.g/255, ca.b/255);
          } else if ((na && na.affected) || (nb && nb.affected)) {
            line.material.opacity = 0.06; line.material.color.setRGB(0.3, 0.3, 0.3);
          } else {
            line.material.opacity = 0.02; line.material.color.setRGB(0.2, 0.2, 0.2);
          }
        } else {
          line.material.opacity = 0.08; line.material.color.setRGB(0.33, 0.33, 0.33);
        }
      });
    }

    function animate() {
      if (!state.active) return;
      state.animId = requestAnimationFrame(animate);
      state.clock += 0.016;
      if (state.autoRotate) state.targetSpherical.theta += 0.002;
      state.spherical.theta += (state.targetSpherical.theta - state.spherical.theta) * 0.08;
      state.spherical.phi += (state.targetSpherical.phi - state.spherical.phi) * 0.08;
      state.spherical.radius += (state.targetSpherical.radius - state.spherical.radius) * 0.08;
      var r = state.spherical.radius, theta = state.spherical.theta, phi = state.spherical.phi;
      state.camera.position.set(r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.cos(theta));
      state.camera.lookAt(0, 0, 0);
      // Pulse affected nodes
      var issue = selectedIssueFn();
      if (issue) {
        nodeListRef.forEach(function(n) {
          if (!n.affected) return;
          var mesh = state.nodeMeshes[n.id];
          if (!mesh) return;
          var pulse = 1.3 + Math.sin(state.clock * 2.5 + n.angle * 5) * 0.15;
          mesh.scale.setScalar(pulse);
          if (mesh.userData.glow) {
            mesh.userData.glow.material.opacity = 0.06 + Math.sin(state.clock * 2 + n.angle * 3) * 0.04;
          }
        });
      }
      state.renderer.render(state.scene, state.camera);
    }

    function attachControls() {
      if (state.controlsAttached) return;
      state.controlsAttached = true;
      var idleTimer = null;
      function pauseAutoRotate() {
        state.autoRotate = false;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function() { state.autoRotate = true; }, 10000);
      }
      function isOver3D(ex, ey) {
        if (!state.active) return false;
        var el = document.getElementById(containerId);
        if (!el) return false;
        var r = el.getBoundingClientRect();
        return ex >= r.left && ex <= r.right && ey >= r.top && ey <= r.bottom;
      }
      window.addEventListener('mousedown', function(e) {
        if (!isOver3D(e.clientX, e.clientY)) return;
        state.isDragging = true; pauseAutoRotate();
        state.prevMouse.x = e.clientX; state.prevMouse.y = e.clientY;
      }, true);
      window.addEventListener('mousemove', function(e) {
        if (!state.isDragging) return;
        var dx = e.clientX - state.prevMouse.x;
        var dy = e.clientY - state.prevMouse.y;
        state.targetSpherical.theta -= dx * 0.005;
        state.targetSpherical.phi = Math.max(0.3, Math.min(Math.PI - 0.3, state.targetSpherical.phi - dy * 0.005));
        state.prevMouse.x = e.clientX; state.prevMouse.y = e.clientY;
      }, true);
      window.addEventListener('mouseup', function() { state.isDragging = false; }, true);
      window.addEventListener('wheel', function(e) {
        if (!isOver3D(e.clientX, e.clientY)) return;
        e.preventDefault(); pauseAutoRotate();
        state.targetSpherical.radius = Math.max(80, Math.min(350, state.targetSpherical.radius + e.deltaY * 0.2));
      }, {passive: false, capture: true});

      // Hover raycast
      var hoverRay = new THREE.Raycaster();
      var hoverMouse = new THREE.Vector2();
      var hoverLabel = document.createElement('div');
      hoverLabel.style.cssText = 'position:fixed;background:rgba(8,9,12,0.88);border:1px solid rgba(201,169,78,0.25);padding:4px 10px;pointer-events:none;z-index:9999;border-radius:2px;display:none;font-family:"IBM Plex Mono",monospace;font-size:0.55rem;color:#c9a94e;letter-spacing:1.5px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);';
      document.body.appendChild(hoverLabel);
      var lastHoverCheck = 0;
      window.addEventListener('mousemove', function(e) {
        if (!state.active || !state.scene || state.isDragging) { hoverLabel.style.display = 'none'; return; }
        var now = Date.now();
        if (now - lastHoverCheck < 60) return;
        lastHoverCheck = now;
        var cont = document.getElementById(containerId);
        if (!cont) return;
        var rect = cont.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          hoverLabel.style.display = 'none'; return;
        }
        hoverMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        hoverMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        hoverRay.setFromCamera(hoverMouse, state.camera);
        var meshes = [];
        Object.keys(state.nodeMeshes).forEach(function(k) { meshes.push(state.nodeMeshes[k]); });
        var hits = hoverRay.intersectObjects(meshes, false);
        if (hits.length > 0) {
          var nid = hits[0].object.userData.nodeId;
          var node = nodesRef[nid];
          hoverLabel.textContent = node ? node.label.replace(/\n/g,' ') : nid;
          hoverLabel.style.left = (e.clientX + 14) + 'px';
          hoverLabel.style.top = (e.clientY - 8) + 'px';
          hoverLabel.style.display = 'block';
          cont.style.cursor = 'pointer';
        } else {
          hoverLabel.style.display = 'none';
          cont.style.cursor = state.isDragging ? 'grabbing' : 'grab';
        }
      });

      // Click raycast
      var raycaster = new THREE.Raycaster();
      var mouse2 = new THREE.Vector2();
      var dragDist = 0, downPos = {x:0, y:0};
      window.addEventListener('mousedown', function(e) { downPos.x = e.clientX; downPos.y = e.clientY; dragDist = 0; }, true);
      window.addEventListener('mousemove', function(e) { dragDist += Math.abs(e.clientX - downPos.x) + Math.abs(e.clientY - downPos.y); downPos.x = e.clientX; downPos.y = e.clientY; }, true);
      window.addEventListener('click', function(e) {
        if (!state.active || !state.scene || dragDist > 8) return;
        var cont = document.getElementById(containerId);
        if (!cont) return;
        var rect = cont.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
        mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse2, state.camera);
        var meshes = [];
        Object.keys(state.nodeMeshes).forEach(function(k) { meshes.push(state.nodeMeshes[k]); });
        var hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          var hit = hits[0].object;
          var nid = hit.userData.nodeId;
          if (state.selectedNode && state.nodeMeshes[state.selectedNode]) {
            var old = state.nodeMeshes[state.selectedNode];
            var oldC = old.userData.baseColor;
            old.material.emissive.setRGB(oldC.r/510, oldC.g/510, oldC.b/510);
            old.scale.setScalar(1);
          }
          state.selectedNode = nid;
          hit.material.emissive.setRGB(1, 0.85, 0.3);
          hit.scale.setScalar(1.8);
          try { window.dispatchEvent(new CustomEvent('limen:node-selected', { detail: { nodeId: nid, node: null } })); } catch (ignore) {}
        } else {
          if (state.selectedNode && state.nodeMeshes[state.selectedNode]) {
            var old2 = state.nodeMeshes[state.selectedNode];
            var oldC2 = old2.userData.baseColor;
            old2.material.emissive.setRGB(oldC2.r/510, oldC2.g/510, oldC2.b/510);
            old2.scale.setScalar(1);
          }
          state.selectedNode = null;
          try { window.dispatchEvent(new CustomEvent('limen:node-selected', { detail: { nodeId: null, node: null } })); } catch (ignore) {}
        }
      }, true);
    }

    function toggle(canvas2dEl) {
      state.active = !state.active;
      if (!state.controlsAttached) attachControls();
      var container = document.getElementById(containerId);
      if (state.active) {
        initScene();
        updateNodeStates();
        if (container) container.classList.add('active');
        if (canvas2dEl) canvas2dEl.style.display = 'none';
        var w = container.clientWidth, h = container.clientHeight;
        state.renderer.setSize(w, h);
        state.camera.aspect = w / h;
        state.camera.updateProjectionMatrix();
        animate();
      } else {
        if (container) container.classList.remove('active');
        if (canvas2dEl) canvas2dEl.style.display = '';
        if (state.animId) { cancelAnimationFrame(state.animId); state.animId = null; }
      }
    }

    return {
      MNI_COORDS: MNI_COORDS,
      NODE_DESC: NODE_DESC,
      init: init,
      toggle: toggle,
      animate: animate,
      updateNodeStates: updateNodeStates,
      attachControls: attachControls,
      getState: function() { return state; }
    };
  })();

  // ═══════════════════════════════════════
  // MODULE 3: Layout (Portal Layout Engine)
  // ═══════════════════════════════════════

  var Layout = (function() {

    function generateHTML(config) {
      config = config || {};
      var id = config.id || 'portal';
      var label = config.label || 'Circuit Map';
      var subtitle = config.subtitle || '';
      var disclaimer = config.disclaimer || 'For reference only — does not constitute clinical decision-making.';

      var h = '';

      // Topbar (48px)
      h += '<div class="topbar">';
      h += '<div class="brand">LIMEN <span class="brand-helix">HELIX</span></div>';
      h += '<div class="brand-sep"></div>';
      h += '<div class="domain-title">' + label + '</div>';
      h += '<div style="flex:1"></div>';
      h += '<div class="disclaimer-tag">' + disclaimer + '</div>';
      h += '</div>';

      // Portal nav (28px)
      h += '<div class="portal-nav" id="portalNav"></div>';

      // Main content area
      h += '<div class="main-grid">';

      // Left panel (320px)
      h += '<div class="left-panel" id="leftPanel">';
      h += '<div class="search-box"><input type="text" id="searchInput" placeholder="Search..." autocomplete="off"></div>';
      h += '<div class="issue-list" id="issueList"></div>';
      h += '<div class="panel-stats" id="panelStats"></div>';
      h += '</div>';

      // Center view (1fr)
      h += '<div class="center-view" id="centerView">';
      h += '<canvas id="c"></canvas>';
      h += '<div id="brain3dContainer" class="brain3d-container"></div>';
      h += '<button id="brain3dToggle" class="brain3d-toggle" onclick="ConnectomeCore._handleToggle3D()"><span class="toggle-icon">&#129504;</span> 3D</button>';
      h += '<button id="propResetBtn" class="brain3d-toggle" style="display:none" onclick="ConnectomeCore._handleResetPropagation()">&#8634; RESET</button>';
      h += '<div id="brain3dHint" class="brain3d-hint">DRAG TO ROTATE &middot; SCROLL TO ZOOM &middot; CLICK NODES</div>';
      h += '<div id="tooltip" class="tooltip"></div>';
      h += '<div class="legend" id="legend"></div>';
      h += '</div>';

      // Right panel (400px)
      h += '<div class="right-panel" id="rightPanel">';
      h += '<div class="empty-state" id="emptyState">';
      h += '<div class="empty-icon">&#9678;</div>';
      h += '<div class="empty-text">Select an item from the left panel<br>to view circuit analysis</div>';
      h += '</div>';
      h += '<div class="content-container" id="contentContainer" style="display:none"></div>';
      h += '</div>';

      h += '</div>'; // main-grid

      // Bottom bar (36px)
      h += '<div class="bottom-bar" id="bottomBar">';
      h += '<span id="bottomStats"></span>';
      h += '</div>';

      return h;
    }

    function generateTabs(tabConfig) {
      if (!tabConfig || !tabConfig.length) return '';
      var h = '<div class="workflow-tabs" id="workflowTabs">';
      tabConfig.forEach(function(tab, i) {
        h += '<button class="tab-btn' + (i === 0 ? ' active' : '') + '" data-tab="' + tab.id + '" onclick="ConnectomeCore._handleTabSwitch(\'' + tab.id + '\')">';
        h += '<span class="tab-icon">' + (tab.icon || '') + '</span> ' + tab.label;
        h += '</button>';
      });
      h += '</div>';

      // Tab panels
      tabConfig.forEach(function(tab, i) {
        h += '<div class="tab-panel' + (i === 0 ? ' active' : '') + '" id="tab_' + tab.id + '"></div>';
      });

      return h;
    }

    function switchTab(tabId) {
      // Toggle tab buttons
      var tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });
      // Toggle tab panels
      var panels = document.querySelectorAll('.tab-panel');
      panels.forEach(function(p) {
        p.classList.toggle('active', p.id === 'tab_' + tabId);
      });
    }

    function generateSeverityBar(instruments) {
      if (!instruments || !instruments.length) return '';
      var h = '<div class="severity-bar">';
      instruments.forEach(function(inst) {
        h += '<div class="severity-instrument">';
        h += '<label class="severity-label">' + inst.label + '</label>';
        h += '<input type="number" class="severity-input" id="score_' + inst.id + '" min="' + inst.min + '" max="' + inst.max + '" placeholder="—">';
        h += '<span class="severity-badge" id="badge_' + inst.id + '"></span>';
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    function updateSeverityBadge(instrumentConfig, score) {
      if (!instrumentConfig || !instrumentConfig.thresholds || score === null || score === undefined) return '';
      var result = {label: 'N/A', cssClass: ''};
      instrumentConfig.thresholds.forEach(function(t) {
        if (score >= t.score) result = t;
      });
      return result;
    }

    function generateLegend(config) {
      var items = [
        {color: 'var(--hyper)', label: 'HYPER'},
        {color: 'var(--hypo)', label: 'HYPO'},
        {color: 'var(--altered)', label: 'ALTERED'}
      ];
      if (config && config.legendItems) items = config.legendItems;
      var h = '<div class="legend-items">';
      items.forEach(function(it) {
        h += '<div class="legend-item"><span class="legend-dot" style="background:' + it.color + '"></span>' + it.label + '</div>';
      });
      h += '</div>';
      return h;
    }

    function populateIssueList(issues, categories, container, onSelect) {
      if (!container) return;
      var h = '';
      if (categories) {
        Object.keys(categories).forEach(function(catLabel) {
          h += '<div class="issue-category">' + catLabel + '</div>';
          var ids = categories[catLabel];
          ids.forEach(function(id) {
            var issue = null;
            for (var i = 0; i < issues.length; i++) {
              if (issues[i].id === id) { issue = issues[i]; break; }
            }
            if (!issue) return;
            h += '<div class="dx-item" data-code="' + issue.id + '">';
            h += '<span class="dx-code">' + (issue.code || '') + '</span>';
            h += '<span class="dx-name">' + issue.name + '</span>';
            h += '</div>';
          });
        });
      } else {
        issues.forEach(function(issue) {
          h += '<div class="dx-item" data-code="' + issue.id + '">';
          h += '<span class="dx-code">' + (issue.code || '') + '</span>';
          h += '<span class="dx-name">' + issue.name + '</span>';
          h += '</div>';
        });
      }
      container.innerHTML = h;

      // Bind click events
      container.querySelectorAll('.dx-item').forEach(function(el) {
        el.addEventListener('click', function() {
          var code = el.getAttribute('data-code');
          if (onSelect) onSelect(code);
        });
      });
    }

    function filterIssueList(query) {
      var items = document.querySelectorAll('.dx-item');
      var cats = document.querySelectorAll('.issue-category');
      var q = (query || '').toLowerCase();
      items.forEach(function(el) {
        var name = (el.querySelector('.dx-name') || {}).textContent || '';
        var code = (el.querySelector('.dx-code') || {}).textContent || '';
        el.style.display = (name.toLowerCase().indexOf(q) !== -1 || code.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
      });
      // Show/hide categories based on visible children
      cats.forEach(function(cat) {
        var next = cat.nextElementSibling;
        var anyVisible = false;
        while (next && !next.classList.contains('issue-category')) {
          if (next.style.display !== 'none') anyVisible = true;
          next = next.nextElementSibling;
        }
        cat.style.display = anyVisible ? '' : 'none';
      });
    }

    return {
      generateHTML: generateHTML,
      generateTabs: generateTabs,
      switchTab: switchTab,
      generateSeverityBar: generateSeverityBar,
      updateSeverityBadge: updateSeverityBadge,
      generateLegend: generateLegend,
      populateIssueList: populateIssueList,
      filterIssueList: filterIssueList
    };
  })();

  // ═══════════════════════════════════════
  // MODULE 4: DomainAdapter
  // ═══════════════════════════════════════

  var DomainAdapter = (function() {

    var activeConfig = null;
    var activeIssue = null;

    function validateConfig(config) {
      var required = ['id', 'label', 'issues'];
      var missing = [];
      required.forEach(function(k) {
        if (!config[k]) missing.push(k);
      });
      if (missing.length) {
        console.error('ConnectomeCore: DomainConfig missing required fields: ' + missing.join(', '));
        return false;
      }
      return true;
    }

    function create(config) {
      if (!validateConfig(config)) return null;
      activeConfig = config;
      activeIssue = null;

      // Initialize canvas
      Canvas.init({
        canvas: config.canvasId || 'c',
        onNodeClick: config.onNodeClick || null,
        onNodeHover: config.onNodeHover || null,
        domainLabels: config.domainLabels || null
      });

      // Load propagation weight matrix
      if (window.LIMENPropagation) {
        window.LIMENPropagation.load(config.weightsUrl || 'connectome-weights.json').catch(function(e) {
          console.warn('ConnectomeCore: Propagation weights load failed:', e);
        });
      }

      // Load base data if provided
      if (config.baseDataUrl) {
        Canvas.loadBase(config.baseDataUrl);
      }

      // Load activation data if provided
      if (config.activationUrl) {
        Canvas.loadActivation(config.activationUrl);
      }

      // Initialize 3D if brain mesh URL provided
      if (config.brainMeshUrl && typeof THREE !== 'undefined') {
        Brain3D.init({
          containerId: config.brain3dContainerId || 'brain3dContainer',
          getSelectedIssue: function() { return activeIssue; }
        });
      }

      // Populate issue list
      if (config.issues && config.issues.length) {
        var listEl = document.getElementById(config.issueListId || 'issueList');
        Layout.populateIssueList(config.issues, config.issueCategories, listEl, function(id) {
          controller.selectIssue(id);
        });
      }

      // Bind search
      var searchInput = document.getElementById(config.searchInputId || 'searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          Layout.filterIssueList(searchInput.value);
        });
      }

      // Build tabs
      if (config.tabs && config.tabs.length) {
        var contentContainer = document.getElementById(config.contentContainerId || 'contentContainer');
        if (contentContainer) {
          var tabHtml = Layout.generateTabs(config.tabs);
          contentContainer.insertAdjacentHTML('afterbegin', tabHtml);
        }
      }

      // Update bottom stats
      var bottomStats = document.getElementById('bottomStats');
      if (bottomStats && config.issues) {
        var totalCircuits = 0;
        config.issues.forEach(function(iss) { totalCircuits += (iss.circuits || []).length; });
        bottomStats.textContent = config.issues.length + ' items \u00B7 ' + totalCircuits + ' circuit mappings';
      }

      var controller = {
        selectIssue: function(id) {
          var issue = null;
          for (var i = 0; i < config.issues.length; i++) {
            if (config.issues[i].id === id) { issue = config.issues[i]; break; }
          }
          if (!issue) return;

          // Toggle behavior
          if (activeIssue && activeIssue.id === id) {
            controller.clearIssue();
            return;
          }

          activeIssue = issue;
          Canvas.selectIssue(issue);
          Canvas.startPropagationFromIssue(issue);
          if (Brain3D.getState().active) Brain3D.updateNodeStates();

          // Update active class (support both data-issue-id and data-code attributes)
          document.querySelectorAll('.dx-item').forEach(function(el) {
            el.classList.toggle('active', (el.getAttribute('data-issue-id') || el.getAttribute('data-code')) === id);
          });

          // Show right panel content
          var emptyState = document.getElementById('emptyState');
          var contentContainer = document.getElementById(config.contentContainerId || 'contentContainer');
          if (emptyState) emptyState.style.display = 'none';
          if (contentContainer) contentContainer.style.display = '';

          // Generate tab content
          if (config.tabs) {
            config.tabs.forEach(function(tab) {
              var panel = document.getElementById('tab_' + tab.id);
              if (panel && tab.generator) {
                panel.innerHTML = tab.generator(issue);
              }
            });
          }

          if (config.onIssueSelect) config.onIssueSelect(issue);
        },

        clearIssue: function() {
          activeIssue = null;
          Canvas.clearIssue();
          Canvas.resetPropagation();
          if (Brain3D.getState().active) Brain3D.updateNodeStates();
          document.querySelectorAll('.dx-item').forEach(function(el) {
            el.classList.remove('active');
          });
          var emptyState = document.getElementById('emptyState');
          var contentContainer = document.getElementById(config.contentContainerId || 'contentContainer');
          if (emptyState) emptyState.style.display = '';
          if (contentContainer) contentContainer.style.display = 'none';
        },

        toggle3D: function() {
          var canvas2d = document.getElementById(config.canvasId || 'c');
          Brain3D.toggle(canvas2d);
        },

        generateReport: function() {
          if (activeIssue) return Report.generateSnapshot(activeIssue, config);
          return '';
        },

        getActiveIssue: function() { return activeIssue; },
        getConfig: function() { return activeConfig; },

        destroy: function() {
          Canvas.destroy();
          activeConfig = null;
          activeIssue = null;
        }
      };

      return controller;
    }

    return {
      create: create,
      validateConfig: validateConfig,
      getActiveConfig: function() { return activeConfig; },
      getActiveIssue: function() { return activeIssue; }
    };
  })();

  // ═══════════════════════════════════════
  // MODULE 5: Report (Report/Print System)
  // ═══════════════════════════════════════

  var Report = (function() {

    function generateSnapshot(issue, config) {
      config = config || {};
      var isPatient = config.langMode === 'patient';

      // Top circuits by evidence
      var circuits = sortByEvidence(issue.circuits || []).slice(0, 5);

      // First-line interventions
      var firstLine = [];
      var cats = (config.interventionCategories || [
        {id:'pharma',label:'Rx'},{id:'therapy',label:'Therapy'},
        {id:'somatic',label:'Somatic'},{id:'nutrition',label:'Nutrition'},
        {id:'supplements',label:'Suppl.'}
      ]);
      var interventions = issue.interventions || {};
      cats.forEach(function(cat) {
        var items = sortByEvidence(interventions[cat.id] || []);
        if (items.length > 0 && items[0].evidence && 'AB+A-B'.indexOf(items[0].evidence) !== -1) {
          firstLine.push({cat: cat.label, name: items[0].name, evidence: items[0].evidence});
        }
        if (items.length > 1 && items[1].evidence && 'AB+A-'.indexOf(items[1].evidence) !== -1) {
          firstLine.push({cat: cat.label, name: items[1].name, evidence: items[1].evidence});
        }
      });

      // Red flags
      var redFlags = deriveRedFlags(circuits, issue.name || '');

      // Referrals
      var referrals = deriveReferrals(circuits, issue.name || '');

      // Total intervention count
      var totalInt = 0;
      Object.keys(interventions).forEach(function(k) { totalInt += (interventions[k] || []).length; });

      // Build HTML
      var h = '<div class="snap-card">';
      h += '<div class="snap-header">';
      h += '<div class="snap-title">' + (isPatient ? 'YOUR SUMMARY' : '5-MINUTE SNAPSHOT') + '</div>';
      h += '<div class="snap-badge">Evidence-Tiered \u00B7 Peer-Reviewed \u00B7 Version Controlled</div>';
      h += '</div>';

      h += '<div class="snap-section"><div class="snap-section-title">' + (isPatient ? 'AREAS AFFECTED' : 'CORE CIRCUIT DYSREGULATION') + '</div>';
      circuits.forEach(function(c) {
        var dirLabel = c.dir || 'dysreg';
        var dirClass = (dirLabel === 'hyper') ? 'hyper' : (dirLabel === 'hypo') ? 'hypo' : 'dysreg';
        h += '<div class="snap-circuit">';
        h += '<span class="snap-node">' + (c.nodeId || c.node) + '</span>';
        h += '<span class="snap-dir ' + dirClass + '">' + dirLabel.toUpperCase() + '</span>';
        h += '<span class="snap-detail">' + c.detail + '</span>';
        h += '</div>';
      });
      h += '</div>';

      h += '<div class="snap-section"><div class="snap-section-title">' + (isPatient ? 'TREATMENT OPTIONS' : 'FIRST-LINE INTERVENTIONS (RANKED BY EVIDENCE)') + '</div>';
      if (firstLine.length === 0) {
        h += '<div style="font-size:0.5rem;color:var(--text-ghost);padding:4px 0">See tabs below for all ' + totalInt + ' documented interventions</div>';
      }
      firstLine.forEach(function(f) {
        var evClass = f.evidence.charAt(0) === 'A' ? 'ev-A' : f.evidence.charAt(0) === 'B' ? 'ev-B' : 'ev-C';
        h += '<div class="snap-int">';
        h += '<span class="snap-int-name"><span style="color:var(--text-ghost);font-size:0.4rem;margin-right:6px">' + f.cat + '</span>' + f.name + '</span>';
        h += '<span class="snap-int-ev ' + evClass + '">LEVEL ' + f.evidence + '</span>';
        h += '</div>';
      });
      h += '<div style="font-size:0.4rem;color:var(--text-ghost);margin-top:4px;letter-spacing:1px">' + totalInt + ' total interventions \u2014 see tabs</div>';
      h += '</div>';

      h += '<div class="snap-section"><div class="snap-section-title">' + (isPatient ? 'IMPORTANT SAFETY INFORMATION' : 'RED FLAGS') + '</div>';
      redFlags.forEach(function(f) { h += '<div class="snap-flags">\u26A0 ' + f + '</div>'; });
      h += '</div>';

      h += '<div class="snap-section"><div class="snap-section-title">' + (isPatient ? 'WHEN TO SEEK ADDITIONAL HELP' : 'WHEN TO REFER') + '</div>';
      referrals.forEach(function(r) { h += '<div class="snap-refer">\u2192 ' + r + '</div>'; });
      h += '</div>';

      h += '</div>';
      return h;
    }

    function deriveRedFlags(circuits, name) {
      var flags = [];
      var nm = (name || '').toLowerCase();
      var hasAmygdala = circuits.some(function(c) { var n = c.nodeId||c.node; return n==='BLA'||n==='CeA'||n==='AMYG'; });
      var hasPAG = circuits.some(function(c) { return (c.nodeId||c.node)==='PAG'; });
      var hasHPA = circuits.some(function(c) { var n = c.nodeId||c.node; return n==='HPA'||n==='HYPOTHAL'; });
      var hasvmPFC = circuits.some(function(c) { return (c.nodeId||c.node)==='vmPFC' && c.dir==='hypo'; });
      var hasNAc = circuits.some(function(c) { var n = c.nodeId||c.node; return n==='NAC'||n==='NAc'||n==='NAcc'; });
      if (hasvmPFC) flags.push('Impaired emotional regulation \u2014 assess safety planning');
      if (hasAmygdala && hasHPA) flags.push('Elevated threat circuit + HPA activation \u2014 screen for suicidality/self-harm');
      if (hasNAc) flags.push('Reward circuit involvement \u2014 screen for substance use');
      if (hasPAG) flags.push('PAG activation \u2014 assess for dissociation and freeze states');
      if (nm.indexOf('anorex')!==-1||nm.indexOf('bulimi')!==-1) flags.push('Medical instability risk \u2014 check vitals, electrolytes, BMI');
      if (nm.indexOf('bipolar')!==-1) flags.push('Manic episode risk \u2014 mood charting, medication adherence');
      if (nm.indexOf('schizo')!==-1||nm.indexOf('psycho')!==-1) flags.push('Reality monitoring \u2014 assess hallucinations, delusions, medication adherence');
      if (nm.indexOf('ptsd')!==-1) flags.push('Trauma re-experiencing \u2014 assess nightmares, flashbacks, avoidance');
      if (nm.indexOf('ocd')!==-1) flags.push('Compulsion severity \u2014 assess time spent, functional impairment, insight');
      if (flags.length === 0) flags.push('Standard safety screening at each visit');
      return flags;
    }

    function deriveReferrals(circuits, name) {
      var refs = [];
      var nm = (name || '').toLowerCase();
      var hasAmygdala = circuits.some(function(c) { var n = c.nodeId||c.node; return n==='BLA'||n==='CeA'; });
      var hasvmPFC = circuits.some(function(c) { return (c.nodeId||c.node)==='vmPFC' && c.dir==='hypo'; });
      if (nm.indexOf('anorex')!==-1||nm.indexOf('bulimi')!==-1) refs.push('Eating disorder specialist / higher level of care if BMI <16 or medical instability');
      if (nm.indexOf('schizo')!==-1) refs.push('Psychiatrist for antipsychotic management; ACT team if non-adherent');
      if (nm.indexOf('bipolar')!==-1) refs.push('Psychiatrist for mood stabilizer optimization');
      if (nm.indexOf('ptsd')!==-1) refs.push('Trauma-specialized therapist (PE, CPT, or EMDR-trained)');
      if (nm.indexOf('substance')!==-1||nm.indexOf('alcohol')!==-1||nm.indexOf('opioid')!==-1) refs.push('Addiction medicine / MAT provider');
      if (nm.indexOf('autism')!==-1||nm.indexOf('asd')!==-1) refs.push('Developmental specialist; OT for sensory processing');
      if (hasAmygdala && hasvmPFC) refs.push('Therapy with exposure-based component if not already engaged');
      if (refs.length === 0) refs.push('Specialist referral if inadequate response after 2 adequate trials');
      return refs;
    }

    function generateSOAP(issue, config) {
      config = config || {};
      var date = new Date().toLocaleDateString();
      var name = issue.name || issue.id;
      var circuits = sortByEvidence(issue.circuits || []).slice(0, 5);
      var interventions = issue.interventions || {};
      var cats = (config.interventionCategories || [
        {id:'pharma',label:'Pharmacological'},{id:'therapy',label:'Psychotherapy'},
        {id:'somatic',label:'Somatic/Neuromodulation'},{id:'nutrition',label:'Nutritional'},
        {id:'supplements',label:'Supplement'}
      ]);

      var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + (config.noteTitle || 'SOAP Note') + ' \u2014 ' + name + '</title>';
      h += '<style>';
      h += 'body{font-family:"Courier New",monospace;max-width:700px;margin:40px auto;padding:20px;color:#222;line-height:1.6;font-size:13px}';
      h += 'h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:4px;font-family:Georgia,serif}';
      h += 'h2{font-size:13px;color:#333;margin-top:20px;margin-bottom:6px;text-transform:uppercase;letter-spacing:2px;border-bottom:1px solid #999;padding-bottom:3px}';
      h += '.field{margin:2px 0} .label{font-weight:bold}';
      h += '.writein{border-bottom:1px solid #999;display:inline-block;min-width:200px;height:16px;margin-left:4px}';
      h += '.disclaimer{margin-top:30px;padding-top:12px;border-top:2px solid #333;font-size:9px;color:#999}';
      h += '@media print{body{margin:20px}}';
      h += '</style></head><body>';

      h += '<h1>' + (config.noteTitle || 'Documentation Template') + '</h1>';
      h += '<div class="field"><span class="label">Date:</span> ' + date + '</div>';
      h += '<div class="field"><span class="label">Subject:</span> <span class="writein"></span></div>';
      h += '<div class="field"><span class="label">Prepared by:</span> <span class="writein"></span></div>';
      h += '<div class="field"><span class="label">Item:</span> ' + name + (issue.code ? ' (' + issue.code + ')' : '') + '</div>';

      // Sections
      if (config.report && config.report.sections) {
        config.report.sections.forEach(function(sec) {
          h += '<h2>' + sec.label + '</h2>';
          if (sec.fields) {
            sec.fields.forEach(function(f) {
              if (f.type === 'writein') {
                h += '<div class="field"><span class="label">' + f.label + ':</span> <span class="writein"></span></div>';
              } else if (f.type === 'computed') {
                h += '<div class="field"><span class="label">' + f.label + ':</span> ' + name + '</div>';
              } else {
                h += '<div class="field">' + f.label + '</div>';
              }
            });
          }
        });
      } else {
        // Default SOAP structure
        h += '<h2>Subjective</h2>';
        h += '<div class="field">Presentation consistent with ' + name + '.</div>';
        h += '<div class="field"><span class="label">Chief Concern:</span> <span class="writein"></span></div>';

        h += '<h2>Objective</h2>';
        h += '<div class="field"><span class="label">Assessment:</span> <span class="writein"></span></div>';

        h += '<h2>Assessment</h2>';
        h += '<div class="field"><span class="label">Item:</span> ' + name + '</div>';
        h += '<div class="field" style="margin-top:6px"><span class="label">Circuit Rationale:</span></div>';
        circuits.forEach(function(c) {
          h += '<div class="field" style="margin-left:20px">\u2022 ' + (c.nodeId||c.node) + ' (' + (c.dir||'dysreg') + '): ' + c.detail + ' [Evidence: ' + c.evidence + ']</div>';
        });

        h += '<h2>Plan</h2>';
        cats.forEach(function(cat) {
          var items = sortByEvidence(interventions[cat.id] || []);
          if (items.length > 0 && items[0].evidence && 'AB+A-B'.indexOf(items[0].evidence) !== -1) {
            h += '<div class="field">\u2022 [' + cat.label + '] ' + items[0].name + ' (Evidence Level ' + items[0].evidence + ')</div>';
          }
        });
      }

      var orgName = (config.report && config.report.orgName) || 'LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC';
      var disc = (config.report && config.report.disclaimer) || 'This template is for documentation assistance only.';
      h += '<div class="disclaimer">' + disc + '<br>' + orgName + ' \u00B7 ' + date + '</div>';
      h += '</body></html>';

      var w = window.open('', '_blank');
      if (w) { w.document.write(h); w.document.close(); w.focus(); setTimeout(function() { w.print(); }, 600); }
      return h;
    }

    function copyToEMR(issue, config) {
      config = config || {};
      var date = new Date().toLocaleDateString();
      var name = issue.name || issue.id;
      var circuits = sortByEvidence(issue.circuits || []).slice(0, 6);
      var interventions = issue.interventions || {};
      var cats = (config.interventionCategories || [
        {id:'pharma',label:'Pharmacological'},{id:'therapy',label:'Psychotherapy'},
        {id:'somatic',label:'Somatic/Neuromodulation'},{id:'nutrition',label:'Nutritional'},
        {id:'supplements',label:'Supplement'}
      ]);

      var t = '';
      t += '=== DOCUMENTATION ===\n';
      t += 'Date: ' + date + '\n';
      t += 'Item: ' + name + (issue.code ? ' (' + issue.code + ')' : '') + '\n';
      if (issue.prevalence) t += 'Prevalence: ' + issue.prevalence + '\n';
      t += '\n';

      t += 'SUMMARY:\n';
      t += (issue.summary || 'See circuit analysis below.') + '\n\n';

      t += 'CIRCUIT RATIONALE:\n';
      circuits.forEach(function(c) {
        t += '  - ' + (c.nodeId||c.node) + ' (' + (c.dir||'dysreg').toUpperCase() + '): ' + c.detail + ' [Level ' + c.evidence + ']\n';
      });
      t += '\n';

      t += 'INTERVENTIONS:\n';
      cats.forEach(function(cat) {
        var items = sortByEvidence(interventions[cat.id] || []);
        if (items.length > 0 && items[0].evidence && 'AB+A-B'.indexOf(items[0].evidence) !== -1) {
          t += '  - [' + cat.label + '] ' + items[0].name + ' (Evidence Level ' + items[0].evidence + ')\n';
        }
      });

      t += '\nRED FLAGS:\n';
      var flags = deriveRedFlags(circuits, name);
      flags.forEach(function(f) { t += '  ! ' + f + '\n'; });

      var orgName = (config.report && config.report.orgName) || 'LIMEN HELIX';
      t += '\n---\n';
      t += 'Generated by ' + orgName + ' | Evidence-tiered | ' + date + '\n';

      navigator.clipboard.writeText(t).then(function() {
        console.log('ConnectomeCore: Copied to clipboard');
      }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = t; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      });

      return t;
    }

    function printSnapshot(issue, config) {
      config = config || {};
      var date = new Date().toLocaleDateString();
      var name = issue.name || issue.id;
      var circuits = sortByEvidence(issue.circuits || []).slice(0, 6);
      var interventions = issue.interventions || {};
      var cats = (config.interventionCategories || [
        {id:'pharma',label:'Rx'},{id:'therapy',label:'Therapy'},
        {id:'somatic',label:'Somatic'},{id:'nutrition',label:'Nutrition'},
        {id:'supplements',label:'Suppl.'}
      ]);
      var firstLine = [];
      cats.forEach(function(cat) {
        var items = sortByEvidence(interventions[cat.id] || []);
        for (var i = 0; i < Math.min(2, items.length); i++) {
          if (items[i].evidence && 'AB+A-B'.indexOf(items[i].evidence) !== -1) {
            firstLine.push({cat: cat.label, name: items[i].name, evidence: items[i].evidence});
          }
        }
      });

      var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Snapshot \u2014 ' + name + '</title>';
      h += '<style>';
      h += 'body{font-family:Georgia,serif;max-width:700px;margin:30px auto;padding:20px;color:#222;line-height:1.5}';
      h += 'h1{font-size:22px;border-bottom:2px solid #2e7d32;padding-bottom:6px;margin-bottom:2px}';
      h += '.sub{font-size:12px;color:#666;margin-bottom:12px}';
      h += 'h2{font-size:12px;color:#333;text-transform:uppercase;letter-spacing:2px;margin-top:16px;margin-bottom:6px;border-bottom:1px solid #ccc;padding-bottom:3px}';
      h += '.circuit{margin:3px 0;font-size:12px} .node{font-weight:bold;display:inline-block;min-width:60px}';
      h += '.dir{font-size:10px;padding:1px 4px;border-radius:2px;margin-right:4px}';
      h += '.dir.hyper{color:#c00;background:#fee} .dir.hypo{color:#06c;background:#eef} .dir.dysreg{color:#960;background:#ffd}';
      h += '.int{margin:3px 0;font-size:12px;padding:2px 8px;border-left:2px solid #2e7d32}';
      h += '.flag{margin:3px 0;padding:4px 10px;font-size:12px;border-left:3px solid #c00;background:#fff5f5}';
      h += '.refer{margin:3px 0;padding:4px 10px;font-size:12px;border-left:3px solid #06c;background:#f5f8ff}';
      h += '.footer{margin-top:20px;border-top:2px solid #2e7d32;padding-top:10px;font-size:9px;color:#999}';
      h += '@media print{body{margin:15px}}';
      h += '</style></head><body>';

      h += '<h1>Snapshot</h1>';
      h += '<div class="sub">' + name + (issue.code ? ' \u00B7 ' + issue.code : '') + ' \u00B7 ' + date + '</div>';
      if (issue.summary) h += '<p style="font-size:12px">' + issue.summary + '</p>';

      h += '<h2>Core Circuit Dysregulation</h2>';
      circuits.forEach(function(c) {
        var dc = (c.dir==='hyper')?'hyper':(c.dir==='hypo')?'hypo':'dysreg';
        h += '<div class="circuit"><span class="node">' + (c.nodeId||c.node) + '</span><span class="dir ' + dc + '">' + (c.dir||'dysreg').toUpperCase() + '</span>' + c.detail + '</div>';
      });

      h += '<h2>First-Line Interventions</h2>';
      firstLine.forEach(function(f) {
        h += '<div class="int"><strong>' + f.cat + ':</strong> ' + f.name + ' (Level ' + f.evidence + ')</div>';
      });

      h += '<h2>Red Flags</h2>';
      deriveRedFlags(circuits, name).forEach(function(f) { h += '<div class="flag">\u26A0 ' + f + '</div>'; });

      h += '<h2>When to Refer</h2>';
      deriveReferrals(circuits, name).forEach(function(r) { h += '<div class="refer">\u2192 ' + r + '</div>'; });

      var orgName = (config.report && config.report.orgName) || 'LIMEN HELIX TRANSFORMATIONAL SCIENCES LLC';
      h += '<div class="footer">Evidence-Tiered \u00B7 Peer-Reviewed Sources Embedded \u00B7 Version Controlled<br>';
      h += orgName + ' \u00B7 ' + date + '</div>';
      h += '</body></html>';

      var w = window.open('', '_blank');
      if (w) { w.document.write(h); w.document.close(); w.focus(); setTimeout(function() { w.print(); }, 600); }
      return h;
    }

    function generateReport(issue, config) {
      // Generic report — delegates to snapshot by default
      return generateSnapshot(issue, config);
    }

    return {
      generateSnapshot: generateSnapshot,
      generateSOAP: generateSOAP,
      copyToEMR: copyToEMR,
      printSnapshot: printSnapshot,
      generateReport: generateReport,
      deriveRedFlags: deriveRedFlags,
      deriveReferrals: deriveReferrals
    };
  })();

  // ═══════════════════════════════════════
  // INTERNAL HANDLERS (for HTML onclick)
  // ═══════════════════════════════════════

  function _handleToggle3D() {
    var canvas2d = document.getElementById('c');
    Brain3D.toggle(canvas2d);
    var btn = document.getElementById('brain3dToggle');
    if (btn) {
      if (Brain3D.getState().active) {
        btn.classList.add('active');
        btn.innerHTML = '<span class="toggle-icon">&#9678;</span> 2D';
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '<span class="toggle-icon">&#129504;</span> 3D';
      }
    }
  }

  function _handleTabSwitch(tabId) {
    Layout.switchTab(tabId);
  }

  function _handleResetPropagation() {
    Canvas.resetPropagation();
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    Canvas: Canvas,
    Brain3D: Brain3D,
    Layout: Layout,
    DomainAdapter: DomainAdapter,
    Report: Report,

    // Convenience aliases
    create: function(config) { return DomainAdapter.create(config); },
    sortByEvidence: sortByEvidence,

    // Constants
    SYS_COLORS: SYS_COLORS,
    EDGE_TYPES: EDGE_TYPES,
    PHASE_COLORS: PHASE_COLORS,
    PHASE_TAGLINES: PHASE_TAGLINES,
    PHASE_PULSE_COLORS: PHASE_PULSE_COLORS,
    NODE_DESCRIPTIONS: NODE_DESCRIPTIONS,
    CSS_VARS: CSS_VARS,
    EVIDENCE_ORDER: EVIDENCE_ORDER,
    NUM_TO_CANVAS: NUM_TO_CANVAS,
    CANVAS_TO_NUM: CANVAS_TO_NUM,

    // Internal handlers (referenced by generated HTML)
    _handleToggle3D: _handleToggle3D,
    _handleTabSwitch: _handleTabSwitch,
    _handleResetPropagation: _handleResetPropagation
  };

})();
