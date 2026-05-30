/**
 * LIMEN Curiosity Engine
 * Gap detection, signal conflict detector, internal dialogue.
 *
 * Usage:
 *   LIMENCuriosity.update(activations) — call after each propagation cycle
 *   LIMENCuriosity.reset()             — clear all state
 *   window.LIMENCuriosity              — live state object
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════
  // NODE NAME MAP
  // ═══════════════════════════════════════

  var NUM_NAMES = {
    1:'mPFC',2:'PCC',3:'Precuneus',4:'AG',5:'vmPFC',6:'OFC',7:'RSC',
    8:'AI',9:'ACC',10:'dACC',11:'sgACC',12:'dlPFC',13:'vlPFC',14:'Broca',
    15:'ECN',16:'SMA',17:'BLA',18:'CeA',19:'BNST',20:'HIPP',21:'EC',
    22:'PRC',23:'PPA',24:'NTS',25:'VV',26:'DV',27:'LC',28:'Raphe',
    29:'VTA',30:'SNig',31:'Hypo',32:'Pit',33:'ADR',35:'NAcc',
    36:'Caud',37:'Put',38:'GP',39:'STN',40:'MDT',41:'Pulv',42:'ANT',
    43:'Thal',44:'V1',45:'V4/V5',46:'FG',47:'STS',48:'A1',49:'Wern',
    50:'S1',51:'S2',52:'TPJ',53:'IPL',54:'SPL',55:'IPS',56:'Verm',
    57:'CBLM',58:'NeoCer',59:'PAG',60:'SC',61:'PBN',62:'PPN',63:'PI',
    64:'MI',65:'Claust',66:'OLF',67:'Sept',68:'Hab',69:'M1',70:'PMC',
    71:'SDH',72:'SNS',73:'ENS',75:'Astro',76:'NBM',78:'FPC',79:'MFC',
    80:'rPFC',83:'EBA',84:'Gamma',87:'OXY',88:'Endo',89:'Opioid',
    90:'GABA',91:'EI',92:'BDNF',93:'TrkB',94:'BBB',96:'SCN',
    97:'Pineal',98:'CC',99:'UNC',100:'ARC',101:'Cing',103:'VAN',104:'DAN',
    105:'DMN-MTL',106:'DMN',109:'EMP',111:'SN'
  };

  function resolveName(numId) {
    return NUM_NAMES[numId] || ('N' + numId);
  }

  // ═══════════════════════════════════════
  // GRAPH DATA (loaded from connectome-weights.json)
  // ═══════════════════════════════════════

  var edges = [];           // [{from, to, weight, type, bidirectional}]
  var adjacency = {};       // nodeId → [{peer, type, weight}]
  var degreeCentrality = {};// nodeId → normalized 0-1
  var graphLoaded = false;

  function loadGraph() {
    if (graphLoaded) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'connectome-weights.json', true);
    xhr.onload = function () {
      if (xhr.status !== 200) return;
      try {
        var data = JSON.parse(xhr.responseText);
        edges = data.edges || [];
        _buildAdjacency();
        graphLoaded = true;
      } catch (e) { /* silent */ }
    };
    xhr.send();
  }

  function _buildAdjacency() {
    adjacency = {};
    var rawDegree = {};
    var maxDegree = 0;

    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var f = String(e.from);
      var t = String(e.to);

      if (!adjacency[f]) adjacency[f] = [];
      adjacency[f].push({ peer: t, type: e.type, weight: e.weight });
      rawDegree[f] = (rawDegree[f] || 0) + 1;

      if (e.bidirectional) {
        if (!adjacency[t]) adjacency[t] = [];
        adjacency[t].push({ peer: f, type: e.type, weight: e.weight });
        rawDegree[t] = (rawDegree[t] || 0) + 1;
      }
    }

    // Find max degree for normalization
    for (var nk in rawDegree) {
      if (rawDegree.hasOwnProperty(nk) && rawDegree[nk] > maxDegree) {
        maxDegree = rawDegree[nk];
      }
    }

    // Normalize to 0-1
    degreeCentrality = {};
    for (var dk in rawDegree) {
      if (rawDegree.hasOwnProperty(dk)) {
        degreeCentrality[dk] = maxDegree > 0 ? rawDegree[dk] / maxDegree : 0;
      }
    }
  }

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════

  var mappedNodes = {};      // nodeId → true if seen in any diagnosis circuit
  var dialogueIndex = 0;
  var dialogueTimer = null;
  var lastActivations = {};

  var curiosity = {
    hotNodes: [],
    conflicts: [],
    dialogue: []
  };

  // ═══════════════════════════════════════
  // 1. CURIOSITY SCORING
  // ═══════════════════════════════════════

  function _computeCuriosity(activations) {
    if (!graphLoaded) { curiosity.hotNodes = []; return; }

    // Track which nodes have been activated (diagnosis-mapped)
    for (var ak in activations) {
      if (activations.hasOwnProperty(ak) && activations[ak] > 0.1) {
        mappedNodes[ak] = true;
      }
    }

    var scores = [];
    for (var nodeId in degreeCentrality) {
      if (!degreeCentrality.hasOwnProperty(nodeId)) continue;

      var importance = degreeCentrality[nodeId];
      var act = activations[nodeId] || 0;
      var propFailure = 1 - act;

      // data_missing: 1 if never seen, 0.5 if seen but low, 0 if well-mapped
      var dataMissing = 1;
      if (mappedNodes[nodeId]) dataMissing = act > 0.3 ? 0 : 0.5;

      var score = importance * propFailure * dataMissing;
      if (score > 0.01) {
        scores.push({
          nodeId: nodeId,
          name: resolveName(nodeId),
          score: Math.round(score * 1000) / 1000
        });
      }
    }

    scores.sort(function (a, b) { return b.score - a.score; });
    curiosity.hotNodes = scores.slice(0, 5);
  }

  // ═══════════════════════════════════════
  // 2. SIGNAL CONFLICT DETECTOR
  // ═══════════════════════════════════════

  function _detectConflicts(activations) {
    curiosity.conflicts = [];
    if (!graphLoaded) return;

    var HYPER_THRESH = 0.7;

    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var f = String(e.from);
      var t = String(e.to);
      var actF = activations[f] || 0;
      var actT = activations[t] || 0;

      // Inhibition conflict: two connected nodes both hyper
      if (actF >= HYPER_THRESH && actT >= HYPER_THRESH) {
        curiosity.conflicts.push({
          nodeA: resolveName(f),
          nodeB: resolveName(t),
          type: 'inhibition',
          severity: Math.round(Math.min(actF, actT) * 1000) / 1000
        });
      }

      // Structural conflict: connected nodes diverging (one rising, one falling)
      if (window.LIMENMemory) {
        var trendF = window.LIMENMemory.getNodeTrend(f);
        var trendT = window.LIMENMemory.getNodeTrend(t);
        if ((trendF === 'RISING' && trendT === 'FALLING') ||
            (trendF === 'FALLING' && trendT === 'RISING')) {
          var sev = Math.abs((actF - actT));
          curiosity.conflicts.push({
            nodeA: resolveName(f),
            nodeB: resolveName(t),
            type: 'structural',
            severity: Math.round(Math.min(1, sev) * 1000) / 1000
          });
        }
      }
    }

    // Sort by severity, keep top conflicts
    curiosity.conflicts.sort(function (a, b) { return b.severity - a.severity; });
    if (curiosity.conflicts.length > 10) {
      curiosity.conflicts = curiosity.conflicts.slice(0, 10);
    }
  }

  // ═══════════════════════════════════════
  // 3. INTERNAL DIALOGUE
  // ═══════════════════════════════════════

  function _generateDialogue(activations) {
    var statements = [];

    // Curiosity alert
    if (curiosity.hotNodes.length > 0 && curiosity.hotNodes[0].score > 0.7) {
      statements.push(curiosity.hotNodes[0].name + ' requires attention.');
    }

    // Conflict alerts
    if (curiosity.conflicts.length > 0) {
      var c = curiosity.conflicts[0];
      statements.push('Conflict detected between ' + c.nodeA + ' and ' + c.nodeB + '.');
    }

    // Entropy instability
    if (window.LIMENObserver && window.LIMENObserver.stability === 'UNSTABLE') {
      statements.push('System instability increasing.');
    }

    // Rising cascade
    if (window.LIMENObserver && window.LIMENObserver.rising_nodes &&
        window.LIMENObserver.rising_nodes.length >= 3) {
      statements.push(window.LIMENObserver.rising_nodes.length + ' pathways activating.');
    }

    // Falling cascade
    if (window.LIMENObserver && window.LIMENObserver.falling_nodes &&
        window.LIMENObserver.falling_nodes.length >= 3) {
      statements.push('Cascade suppression detected.');
    }

    // Keep max 3
    curiosity.dialogue = statements.slice(0, 3);
  }

  // ═══════════════════════════════════════
  // 4. HUD + DIALOGUE BAR
  // ═══════════════════════════════════════

  function _updateHUD() {
    // Extend observer HUD
    var hud = document.getElementById('observer-hud');
    if (hud) {
      var existing = document.getElementById('curiosity-hud-lines');
      if (existing) existing.remove();

      if (curiosity.conflicts.length > 0 || curiosity.hotNodes.length > 0) {
        var dim = 'rgba(201,169,78,0.5)';
        var teal = '#5ab5a0';
        var lines = [];

        if (curiosity.conflicts.length > 0) {
          lines.push('<span style="color:' + dim + '">CONFLICTS </span><span style="color:' + teal + '">' + curiosity.conflicts.length + '</span>');
        }
        if (curiosity.hotNodes.length > 0) {
          lines.push('<span style="color:' + dim + '">CURIOUS   </span><span style="color:' + teal + '">' + curiosity.hotNodes[0].name + '</span>');
        }

        var span = document.createElement('span');
        span.id = 'curiosity-hud-lines';
        span.innerHTML = '<br>' + lines.join('<br>');
        hud.appendChild(span);
      }
    }

    // Dialogue bar
    _updateDialogueBar();
  }

  var dialogueBar = null;

  function _ensureDialogueBar() {
    if (dialogueBar) return;
    dialogueBar = document.createElement('div');
    dialogueBar.id = 'curiosity-dialogue-bar';
    dialogueBar.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'background:rgba(8,9,12,0.92)',
      'border-top:1px solid rgba(201,169,78,0.15)',
      'padding:6px 16px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.5rem',
      'letter-spacing:1.5px',
      'color:#c9a94e',
      'z-index:9997',
      'pointer-events:none',
      'transition:opacity 0.8s ease',
      'opacity:0',
      'display:none',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis'
    ].join(';');
    document.body.appendChild(dialogueBar);
  }

  function _updateDialogueBar() {
    _ensureDialogueBar();

    if (curiosity.dialogue.length === 0) {
      dialogueBar.style.display = 'none';
      dialogueBar.style.opacity = '0';
      if (dialogueTimer) { clearInterval(dialogueTimer); dialogueTimer = null; }
      return;
    }

    dialogueBar.style.display = 'block';
    dialogueIndex = 0;
    _showDialogueStatement();

    // Cycle statements every 5 seconds
    if (dialogueTimer) clearInterval(dialogueTimer);
    if (curiosity.dialogue.length > 1) {
      dialogueTimer = setInterval(function () {
        dialogueBar.style.opacity = '0';
        setTimeout(function () {
          dialogueIndex = (dialogueIndex + 1) % curiosity.dialogue.length;
          _showDialogueStatement();
        }, 400);
      }, 5000);
    }
  }

  function _showDialogueStatement() {
    if (!dialogueBar || curiosity.dialogue.length === 0) return;
    dialogueBar.textContent = '\u203A ' + curiosity.dialogue[dialogueIndex];
    dialogueBar.style.opacity = '1';
  }

  // ═══════════════════════════════════════
  // UPDATE / RESET
  // ═══════════════════════════════════════

  function update(activations) {
    if (!activations) return;
    if (!graphLoaded) { loadGraph(); return; }

    lastActivations = activations;
    _computeCuriosity(activations);
    _detectConflicts(activations);
    _generateDialogue(activations);
    _updateHUD();
  }

  function reset() {
    curiosity.hotNodes = [];
    curiosity.conflicts = [];
    curiosity.dialogue = [];
    lastActivations = {};
    dialogueIndex = 0;
    if (dialogueTimer) { clearInterval(dialogueTimer); dialogueTimer = null; }
    if (dialogueBar) {
      dialogueBar.style.display = 'none';
      dialogueBar.style.opacity = '0';
    }
    var existing = document.getElementById('curiosity-hud-lines');
    if (existing) existing.remove();
  }

  // ═══════════════════════════════════════
  // INIT — load graph on script load
  // ═══════════════════════════════════════

  loadGraph();

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  curiosity.update = update;
  curiosity.reset = reset;

  window.LIMENCuriosity = curiosity;

})();
