/**
 * LIMEN Global Workspace Architecture
 * Attention competition, broadcast mechanism, thought generator, emotional state.
 *
 * Usage:
 *   LIMENWorkspace.update(activations) — call after each propagation cycle
 *   LIMENWorkspace.reset()             — clear workspace state
 *   window.LIMENWorkspace              — live state object
 *
 * Events:
 *   document 'limen:broadcast' — fires on new attention winner
 */
(function () {
  'use strict';

  var MAX_HISTORY = 20;
  var JITTER_GUARD = 0.05;  // new winner must exceed current by this margin

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

  // Node → domain system mapping
  var NODE_DOMAIN = {
    1:'DMN',2:'DMN',3:'DMN',4:'DMN',5:'DMN',7:'DMN',106:'DMN',105:'DMN',
    8:'Salience',9:'Salience',10:'Salience',11:'Salience',111:'Salience',
    12:'Executive',13:'Executive',14:'Executive',15:'Executive',78:'Executive',79:'Executive',80:'Executive',
    16:'Motor',69:'Motor',70:'Motor',
    17:'Limbic',18:'Limbic',19:'Limbic',20:'Limbic',21:'Limbic',22:'Limbic',23:'Limbic',
    6:'Limbic',59:'Limbic',67:'Limbic',68:'Limbic',
    29:'Reward',30:'Reward',35:'Reward',36:'Reward',37:'Reward',38:'Reward',39:'Reward',
    31:'Autonomic',32:'Autonomic',33:'Autonomic',24:'Autonomic',25:'Autonomic',26:'Autonomic',
    27:'Arousal',28:'Arousal',62:'Arousal',76:'Arousal',
    40:'Thalamic',41:'Thalamic',42:'Thalamic',43:'Thalamic',
    44:'Visual',45:'Visual',46:'Visual',47:'Visual',83:'Visual',
    48:'Auditory',49:'Auditory',
    50:'Somatosensory',51:'Somatosensory',52:'Somatosensory',53:'Somatosensory',54:'Somatosensory',55:'Somatosensory',
    56:'Cerebellar',57:'Cerebellar',58:'Cerebellar',
    92:'Plasticity',93:'Plasticity',75:'Plasticity',94:'Plasticity',
    87:'Neuromodulatory',88:'Neuromodulatory',89:'Neuromodulatory',90:'Neuromodulatory',91:'Neuromodulatory',
    96:'Circadian',97:'Circadian',
    98:'WhiteMatter',99:'WhiteMatter',100:'WhiteMatter',101:'WhiteMatter',
    103:'Attention',104:'Attention',109:'Social',
    60:'Brainstem',61:'Brainstem',63:'Brainstem',64:'Brainstem',65:'Brainstem',66:'Brainstem',71:'Brainstem',
    72:'Peripheral',73:'Peripheral',84:'Oscillatory'
  };

  function resolveName(numId) {
    return NUM_NAMES[numId] || ('N' + numId);
  }

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════

  var workspace = {
    attentionNode: null,
    attentionScore: 0,
    broadcast: {},
    history: [],
    emotion: {
      stress: 0,
      valence: 0,
      arousal: 0
    },
    currentThought: ''
  };

  // ═══════════════════════════════════════
  // 2. ATTENTION COMPETITION
  // ═══════════════════════════════════════

  function _computeAttention(activations) {
    var bestNode = null;
    var bestScore = 0;

    // Build curiosity lookup
    var curiosityMap = {};
    if (window.LIMENCuriosity && window.LIMENCuriosity.hotNodes) {
      for (var ci = 0; ci < window.LIMENCuriosity.hotNodes.length; ci++) {
        var cn = window.LIMENCuriosity.hotNodes[ci];
        curiosityMap[cn.nodeId] = cn.score;
      }
    }

    var totalNodes = 0;
    for (var nodeId in activations) {
      if (!activations.hasOwnProperty(nodeId)) continue;
      totalNodes++;

      var act = activations[nodeId];
      if (act < 0.01) continue; // skip silent nodes

      // Velocity from memory trend
      var velocityScore = 0;
      if (window.LIMENMemory && window.LIMENMemory.getNodeTrend) {
        var trend = window.LIMENMemory.getNodeTrend(nodeId);
        if (trend === 'RISING') velocityScore = 1;
        else if (trend === 'FALLING') velocityScore = 0.3;
        else velocityScore = 0;
      }

      // Novelty: 1 - average activation over history
      var novelty = 1;
      if (window.LIMENMemory && window.LIMENMemory.getHistory) {
        var hist = window.LIMENMemory.getHistory();
        if (hist.length >= 2) {
          var sum = 0;
          var cnt = 0;
          var lookback = Math.min(10, hist.length);
          for (var h = hist.length - lookback; h < hist.length; h++) {
            var hv = hist[h].activations[nodeId];
            if (hv !== undefined) { sum += hv; cnt++; }
          }
          if (cnt > 0) novelty = 1 - (sum / cnt);
        }
      }

      // Curiosity score for this node
      var curiosityScore = curiosityMap[nodeId] || 0;

      // Weighted attention score
      var score = act * 0.5 + velocityScore * 0.2 + novelty * 0.2 + curiosityScore * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestNode = nodeId;
      }
    }

    // Jitter guard: only switch if new winner exceeds current by margin
    if (workspace.attentionNode && bestNode !== workspace.attentionNode) {
      if (bestScore - workspace.attentionScore < JITTER_GUARD) {
        return; // keep current winner
      }
    }

    if (bestNode && bestScore > 0) {
      var isNew = (bestNode !== workspace.attentionNode);
      workspace.attentionNode = bestNode;
      workspace.attentionScore = Math.round(bestScore * 1000) / 1000;

      if (isNew) {
        _broadcast(bestNode, bestScore, activations);
      }
    }
  }

  // ═══════════════════════════════════════
  // 3. BROADCAST MECHANISM
  // ═══════════════════════════════════════

  function _broadcast(nodeId, score, activations) {
    workspace.broadcast = {
      nodeId: nodeId,
      name: resolveName(nodeId),
      domain: NODE_DOMAIN[nodeId] || 'unknown',
      activation: Math.round((activations[nodeId] || 0) * 1000) / 1000,
      significance: Math.round(score * 1000) / 1000,
      timestamp: Date.now()
    };

    workspace.history.push(workspace.broadcast);
    if (workspace.history.length > MAX_HISTORY) workspace.history.shift();

    // Dispatch DOM event
    try {
      document.dispatchEvent(new CustomEvent('limen:broadcast', {
        detail: workspace.broadcast
      }));
    } catch (e) { /* IE fallback — silent */ }
  }

  // ═══════════════════════════════════════
  // 4. THOUGHT GENERATOR
  // ═══════════════════════════════════════

  function _generateThought() {
    if (!workspace.attentionNode) {
      workspace.currentThought = '';
      return;
    }

    var name = resolveName(workspace.attentionNode);
    var sig = workspace.attentionScore > 0.6 ? 'high' : workspace.attentionScore > 0.3 ? 'moderate' : 'low';

    // Get trend
    var trend = 'STABLE';
    if (window.LIMENMemory && window.LIMENMemory.getNodeTrend) {
      trend = window.LIMENMemory.getNodeTrend(workspace.attentionNode);
    }

    var thought = 'Attention: ' + name + '. Significance: ' + sig + '. Trend: ' + trend + '.';

    // Check for conflicts involving attention node
    if (window.LIMENCuriosity && window.LIMENCuriosity.conflicts) {
      for (var i = 0; i < window.LIMENCuriosity.conflicts.length; i++) {
        var c = window.LIMENCuriosity.conflicts[i];
        if (c.nodeA === name) {
          thought += ' Conflict detected with ' + c.nodeB + '.';
          break;
        }
        if (c.nodeB === name) {
          thought += ' Conflict detected with ' + c.nodeA + '.';
          break;
        }
      }
    }

    workspace.currentThought = thought;
  }

  // ═══════════════════════════════════════
  // 5. EMOTIONAL STATE
  // ═══════════════════════════════════════

  function _computeEmotion(activations) {
    var entropy = (window.LIMENObserver && window.LIMENObserver.entropy) || 0;

    var totalNodes = 0;
    var sumAct = 0;
    var highCount = 0;
    var risingCount = 0;
    var fallingCount = 0;

    for (var nodeId in activations) {
      if (!activations.hasOwnProperty(nodeId)) continue;
      totalNodes++;
      var act = activations[nodeId];
      sumAct += act;
      if (act > 0.7) highCount++;
    }

    // Count rising/falling from observer
    if (window.LIMENObserver) {
      risingCount = (window.LIMENObserver.rising_nodes || []).length;
      fallingCount = (window.LIMENObserver.falling_nodes || []).length;
    }

    if (totalNodes === 0) {
      workspace.emotion = { stress: 0, valence: 0, arousal: 0 };
      return;
    }

    // Stress = entropy × cascade probability
    var cascadeProb = highCount / totalNodes;
    var stress = entropy * cascadeProb;
    stress = Math.max(0, Math.min(1, stress));

    // Valence = (rising - falling) / total
    var valence = (risingCount - fallingCount) / totalNodes;
    valence = Math.max(-1, Math.min(1, valence));

    // Arousal = average activation
    var arousal = sumAct / totalNodes;
    arousal = Math.max(0, Math.min(1, arousal));

    workspace.emotion = {
      stress: Math.round(stress * 1000) / 1000,
      valence: Math.round(valence * 1000) / 1000,
      arousal: Math.round(arousal * 1000) / 1000
    };
  }

  function _stressLabel(s) {
    if (s < 0.3) return 'CALM';
    if (s < 0.6) return 'ALERT';
    return 'STRESSED';
  }

  function _valenceLabel(v) {
    if (v < -0.1) return 'NEGATIVE';
    if (v > 0.1) return 'POSITIVE';
    return 'NEUTRAL';
  }

  function _arousalLabel(a) {
    if (a < 0.2) return 'DORMANT';
    if (a < 0.6) return 'ACTIVE';
    return 'HYPERACTIVE';
  }

  // ═══════════════════════════════════════
  // 6. HUD UPDATE
  // ═══════════════════════════════════════

  function _updateHUD() {
    // Extend observer HUD
    var hud = document.getElementById('observer-hud');
    if (hud) {
      var existing = document.getElementById('workspace-hud-lines');
      if (existing) existing.remove();

      if (workspace.attentionNode || workspace.emotion.stress > 0) {
        var dim = 'rgba(201,169,78,0.5)';
        var teal = '#5ab5a0';
        var lines = [];

        if (workspace.attentionNode) {
          var attnName = resolveName(workspace.attentionNode);
          if (attnName.length > 12) attnName = attnName.substring(0, 12);
          lines.push('<span style="color:' + dim + '">ATTENTION </span><span style="color:' + teal + '">' + attnName + '</span>');
        }

        var sLabel = _stressLabel(workspace.emotion.stress);
        var vLabel = _valenceLabel(workspace.emotion.valence);
        lines.push('<span style="color:' + dim + '">EMOTION   </span><span style="color:' + teal + '">' + sLabel + ' / ' + vLabel + '</span>');

        var span = document.createElement('span');
        span.id = 'workspace-hud-lines';
        span.innerHTML = '<br>' + lines.join('<br>');
        hud.appendChild(span);
      }
    }

    // Update dialogue bar: workspace thought takes priority over curiosity dialogue
    _updateDialogueBar();
  }

  function _updateDialogueBar() {
    var bar = document.getElementById('curiosity-dialogue-bar');
    if (!bar) return;

    if (workspace.currentThought) {
      bar.style.display = 'block';
      bar.textContent = '\u203A ' + workspace.currentThought;
      bar.style.opacity = '1';
    }
    // If no workspace thought, curiosity engine manages the bar on its own
  }

  // ═══════════════════════════════════════
  // UPDATE / RESET
  // ═══════════════════════════════════════

  function update(activations) {
    if (!activations) return;
    _computeAttention(activations);
    _generateThought();
    _computeEmotion(activations);
    _updateHUD();
  }

  function reset() {
    workspace.attentionNode = null;
    workspace.attentionScore = 0;
    workspace.broadcast = {};
    workspace.history = [];
    workspace.emotion = { stress: 0, valence: 0, arousal: 0 };
    workspace.currentThought = '';
    var existing = document.getElementById('workspace-hud-lines');
    if (existing) existing.remove();
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  workspace.update = update;
  workspace.reset = reset;

  window.LIMENWorkspace = workspace;

})();
