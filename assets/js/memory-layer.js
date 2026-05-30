/**
 * LIMEN Memory Layer + Prediction Layer
 * Temporal state buffer, momentum model, oscillation detection.
 *
 * Usage:
 *   LIMENMemory.update(activations)  — call after each propagation cycle
 *   LIMENMemory.reset()              — clear all state
 *   LIMENMemory.getNodeTrend(nodeId) — 'RISING' | 'FALLING' | 'STABLE'
 *   LIMENMemory.getHistory()         — full state buffer
 *   LIMENMemory.getPrediction(nodeId)— predicted next activation
 *   LIMENMemory.risingPredictions    — top 3 predicted risers
 *   LIMENMemory.fallingPredictions   — top 3 predicted fallers
 *   LIMENMemory.oscillatingNodes     — nodeIds oscillating 3+ times
 */
(function () {
  'use strict';

  var MAX_HISTORY = 20;
  var TREND_WINDOW = 10;
  var RISING_THRESH = 0.1;
  var FALLING_THRESH = -0.1;

  // ═══════════════════════════════════════
  // NODE NAME MAP (same as observer-node.js)
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
  // STATE
  // ═══════════════════════════════════════

  var stateHistory = [];     // [{t, activations:{}, entropy, timestamp}]
  var prevVelocities = {};   // nodeId → previous velocity (for acceleration)

  var memory = {
    risingPredictions: [],
    fallingPredictions: [],
    oscillatingNodes: []
  };

  // ═══════════════════════════════════════
  // 1. MEMORY LAYER — temporal state buffer
  // ═══════════════════════════════════════

  function update(activations) {
    if (!activations) return;

    // Compute entropy (reuse observer's value if available)
    var entropy = 0;
    if (window.LIMENObserver && window.LIMENObserver.entropy) {
      entropy = window.LIMENObserver.entropy;
    }

    // Snapshot current state
    var snapshot = { t: stateHistory.length, activations: {}, entropy: entropy, timestamp: Date.now() };
    for (var k in activations) {
      if (activations.hasOwnProperty(k)) snapshot.activations[k] = activations[k];
    }
    stateHistory.push(snapshot);
    if (stateHistory.length > MAX_HISTORY) stateHistory.shift();

    // Run prediction and pattern detection
    _computePredictions(activations);
    _detectOscillations();

    // Update observer HUD with memory data
    _updateObserverHUD();
  }

  function reset() {
    stateHistory = [];
    prevVelocities = {};
    memory.risingPredictions = [];
    memory.fallingPredictions = [];
    memory.oscillatingNodes = [];
    _updateObserverHUD();
  }

  function getHistory() {
    return stateHistory.slice();
  }

  // ═══════════════════════════════════════
  // PER-NODE TREND
  // ═══════════════════════════════════════

  function getNodeTrend(nodeId) {
    if (stateHistory.length < 2) return 'STABLE';

    // Average over last TREND_WINDOW states
    var start = Math.max(0, stateHistory.length - TREND_WINDOW);
    var sum = 0;
    var count = 0;
    for (var i = start; i < stateHistory.length; i++) {
      var val = stateHistory[i].activations[nodeId];
      if (val !== undefined) {
        sum += val;
        count++;
      }
    }
    if (count === 0) return 'STABLE';

    var avg = sum / count;
    var current = stateHistory[stateHistory.length - 1].activations[nodeId] || 0;
    var trend = current - avg;

    if (trend > RISING_THRESH) return 'RISING';
    if (trend < FALLING_THRESH) return 'FALLING';
    return 'STABLE';
  }

  // ═══════════════════════════════════════
  // 2. PREDICTION LAYER — momentum model
  // ═══════════════════════════════════════

  function _computePredictions(activations) {
    if (stateHistory.length < 2) {
      memory.risingPredictions = [];
      memory.fallingPredictions = [];
      return;
    }

    var prevState = stateHistory[stateHistory.length - 2];
    var predictions = [];

    for (var nodeId in activations) {
      if (!activations.hasOwnProperty(nodeId)) continue;

      var current = activations[nodeId];
      var previous = prevState.activations[nodeId] || 0;

      // Velocity = change from previous step
      var velocity = current - previous;

      // Acceleration = change in velocity
      var prevVel = prevVelocities[nodeId] || 0;
      var acceleration = velocity - prevVel;

      // Store velocity for next cycle
      prevVelocities[nodeId] = velocity;

      // Predict next value: current + velocity + acceleration
      var predicted = current + velocity + acceleration;
      predicted = Math.max(0, Math.min(1, predicted)); // clamp 0-1

      var delta = predicted - current;

      predictions.push({
        nodeId: nodeId,
        name: resolveName(nodeId),
        current: Math.round(current * 1000) / 1000,
        predicted: Math.round(predicted * 1000) / 1000,
        delta: Math.round(delta * 1000) / 1000
      });
    }

    // Top 3 rising (highest positive delta)
    predictions.sort(function (a, b) { return b.delta - a.delta; });
    memory.risingPredictions = predictions.slice(0, 3).filter(function (p) { return p.delta > 0; });

    // Top 3 falling (most negative delta)
    predictions.sort(function (a, b) { return a.delta - b.delta; });
    memory.fallingPredictions = predictions.slice(0, 3).filter(function (p) { return p.delta < 0; });
  }

  // ═══════════════════════════════════════
  // 3. PATTERN DETECTION — oscillation
  // ═══════════════════════════════════════

  function _detectOscillations() {
    memory.oscillatingNodes = [];

    if (stateHistory.length < 4) return;

    // Scan last 10 states for per-node direction changes
    var window = Math.min(stateHistory.length, TREND_WINDOW);
    var start = stateHistory.length - window;

    // Collect all nodeIds seen
    var allNodes = {};
    for (var s = start; s < stateHistory.length; s++) {
      for (var nk in stateHistory[s].activations) {
        if (stateHistory[s].activations.hasOwnProperty(nk)) allNodes[nk] = true;
      }
    }

    for (var nodeId in allNodes) {
      if (!allNodes.hasOwnProperty(nodeId)) continue;

      // Build direction sequence for this node
      var flips = 0;
      var lastDir = 0; // -1 falling, 0 flat, 1 rising
      for (var i = start + 1; i < stateHistory.length; i++) {
        var prev = stateHistory[i - 1].activations[nodeId] || 0;
        var cur = stateHistory[i].activations[nodeId] || 0;
        var diff = cur - prev;
        var dir = 0;
        if (diff > 0.01) dir = 1;
        else if (diff < -0.01) dir = -1;

        if (lastDir !== 0 && dir !== 0 && dir !== lastDir) {
          flips++;
        }
        if (dir !== 0) lastDir = dir;
      }

      // Oscillating if 3+ direction reversals
      if (flips >= 3) {
        memory.oscillatingNodes.push(nodeId);
      }
    }
  }

  // ═══════════════════════════════════════
  // 4. HUD UPDATE — extend observer HUD
  // ═══════════════════════════════════════

  function _updateObserverHUD() {
    var hud = document.getElementById('observer-hud');
    if (!hud) return;

    // Remove any previous memory lines
    var existing = document.getElementById('memory-hud-lines');
    if (existing) existing.remove();

    // Only show if we have prediction data
    if (memory.risingPredictions.length === 0 &&
        memory.fallingPredictions.length === 0 &&
        memory.oscillatingNodes.length === 0) return;

    var dim = 'rgba(201,169,78,0.5)';
    var teal = '#5ab5a0';
    var lines = [];

    if (memory.risingPredictions.length > 0) {
      var names = memory.risingPredictions.slice(0, 2).map(function (p) { return p.name; }).join(', ');
      lines.push('<span style="color:' + dim + '">PREDICT\u2191 </span><span style="color:' + teal + '">' + names + '</span>');
    }
    if (memory.fallingPredictions.length > 0) {
      var names = memory.fallingPredictions.slice(0, 2).map(function (p) { return p.name; }).join(', ');
      lines.push('<span style="color:' + dim + '">PREDICT\u2193 </span><span style="color:' + teal + '">' + names + '</span>');
    }
    if (memory.oscillatingNodes.length > 0) {
      lines.push('<span style="color:' + dim + '">OSCILLATE </span><span style="color:' + teal + '">' + memory.oscillatingNodes.length + ' nodes</span>');
    }

    if (lines.length > 0) {
      var span = document.createElement('span');
      span.id = 'memory-hud-lines';
      span.innerHTML = '<br>' + lines.join('<br>');
      hud.appendChild(span);
    }
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  memory.update = update;
  memory.reset = reset;
  memory.getHistory = getHistory;
  memory.getNodeTrend = getNodeTrend;
  memory.getPrediction = function (nodeId) {
    for (var i = 0; i < memory.risingPredictions.length; i++) {
      if (memory.risingPredictions[i].nodeId === nodeId) return memory.risingPredictions[i].predicted;
    }
    for (var j = 0; j < memory.fallingPredictions.length; j++) {
      if (memory.fallingPredictions[j].nodeId === nodeId) return memory.fallingPredictions[j].predicted;
    }
    // Compute on demand if not in top lists
    if (stateHistory.length < 2) return 0;
    var current = stateHistory[stateHistory.length - 1].activations[nodeId] || 0;
    var previous = stateHistory[stateHistory.length - 2].activations[nodeId] || 0;
    var velocity = current - previous;
    var prevVel = prevVelocities[nodeId] || 0;
    var acceleration = velocity - prevVel;
    var predicted = current + velocity + acceleration;
    return Math.max(0, Math.min(1, Math.round(predicted * 1000) / 1000));
  };

  window.LIMENMemory = memory;

})();
