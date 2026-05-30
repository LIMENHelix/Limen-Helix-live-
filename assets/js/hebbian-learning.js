/**
 * LIMEN Hebbian Learning Layer
 * Runtime adaptive weights with decay. Resets on page reload.
 *
 * Usage:
 *   LIMENHebbian.update(activations) — apply learning rule after propagation
 *   LIMENHebbian.getWeight(nodeA, nodeB) — delta-adjusted weight
 *   LIMENHebbian.getAdjustedEdges() — full edge list with deltas applied
 *   LIMENHebbian.reset() — clear all deltas
 *   window.LIMENHebbian — live state object
 */
(function () {
  'use strict';

  var ETA = 0.01;           // learning rate
  var DECAY = 0.995;        // per-cycle decay
  var CLAMP_MIN = -0.2;
  var CLAMP_MAX = 0.2;
  var TRACK_THRESH = 0.05;  // |delta| threshold for HUD count

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
  // BASE EDGES (loaded from connectome-weights.json)
  // ═══════════════════════════════════════

  var baseEdges = null;      // original edge array from JSON
  var baseWeightMap = {};    // "from_to" → base weight
  var graphLoaded = false;

  function _edgeKey(a, b) {
    return String(a) + '_' + String(b);
  }

  function loadGraph() {
    if (graphLoaded) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'connectome-weights.json', true);
    xhr.onload = function () {
      if (xhr.status !== 200) return;
      try {
        var data = JSON.parse(xhr.responseText);
        baseEdges = data.edges || [];
        _buildBaseMap();
        graphLoaded = true;
      } catch (e) { /* silent */ }
    };
    xhr.send();
  }

  function _buildBaseMap() {
    baseWeightMap = {};
    for (var i = 0; i < baseEdges.length; i++) {
      var e = baseEdges[i];
      baseWeightMap[_edgeKey(e.from, e.to)] = e.weight;
      if (e.bidirectional) {
        baseWeightMap[_edgeKey(e.to, e.from)] = e.weight;
      }
    }
  }

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════

  var hebbian = {
    deltas: {},
    strengthened: [],
    weakened: []
  };

  // ═══════════════════════════════════════
  // 1. HEBBIAN LEARNING RULE
  // ═══════════════════════════════════════

  function update(activations) {
    if (!activations || !graphLoaded || !baseEdges) return;

    // Apply Hebbian rule to each edge
    for (var i = 0; i < baseEdges.length; i++) {
      var e = baseEdges[i];
      var actA = activations[e.from] || 0;
      var actB = activations[e.to] || 0;

      // Forward direction
      var keyFwd = _edgeKey(e.from, e.to);
      var dFwd = hebbian.deltas[keyFwd] || 0;
      dFwd += ETA * actA * actB;    // Hebbian: strengthen co-active
      dFwd *= DECAY;                 // decay
      dFwd = Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, dFwd)); // clamp
      if (Math.abs(dFwd) < 0.0001) {
        delete hebbian.deltas[keyFwd];
      } else {
        hebbian.deltas[keyFwd] = dFwd;
      }

      // Reverse direction (if bidirectional)
      if (e.bidirectional) {
        var keyRev = _edgeKey(e.to, e.from);
        var dRev = hebbian.deltas[keyRev] || 0;
        dRev += ETA * actB * actA;
        dRev *= DECAY;
        dRev = Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, dRev));
        if (Math.abs(dRev) < 0.0001) {
          delete hebbian.deltas[keyRev];
        } else {
          hebbian.deltas[keyRev] = dRev;
        }
      }
    }

    // Update edge tracking lists
    _updateTracking();
    _updateHUD();
  }

  // ═══════════════════════════════════════
  // 2. EDGE STRENGTH TRACKING
  // ═══════════════════════════════════════

  function _updateTracking() {
    var entries = [];
    for (var key in hebbian.deltas) {
      if (!hebbian.deltas.hasOwnProperty(key)) continue;
      var delta = hebbian.deltas[key];
      var parts = key.split('_');
      var baseW = baseWeightMap[key] || 0;
      entries.push({
        nodeA: resolveName(parts[0]),
        nodeB: resolveName(parts[1]),
        delta: Math.round(delta * 1000) / 1000,
        effectiveWeight: Math.round((baseW + delta) * 1000) / 1000
      });
    }

    // Top 5 strengthened (highest positive delta)
    entries.sort(function (a, b) { return b.delta - a.delta; });
    hebbian.strengthened = entries.slice(0, 5).filter(function (e) { return e.delta > 0; });

    // Top 5 weakened (most negative delta)
    entries.sort(function (a, b) { return a.delta - b.delta; });
    hebbian.weakened = entries.slice(0, 5).filter(function (e) { return e.delta < 0; });
  }

  // ═══════════════════════════════════════
  // 3. WEIGHT ACCESS
  // ═══════════════════════════════════════

  function getWeight(nodeA, nodeB) {
    var key = _edgeKey(nodeA, nodeB);
    var base = baseWeightMap[key];
    if (base === undefined) return 0;
    var delta = hebbian.deltas[key] || 0;
    return base + delta;
  }

  function getAdjustedEdges() {
    if (!baseEdges) return null;
    var adjusted = [];
    for (var i = 0; i < baseEdges.length; i++) {
      var e = baseEdges[i];
      var key = _edgeKey(e.from, e.to);
      var delta = hebbian.deltas[key] || 0;
      adjusted.push({
        from: e.from,
        to: e.to,
        weight: e.weight + delta,
        type: e.type,
        bidirectional: e.bidirectional
      });
    }
    return adjusted;
  }

  // ═══════════════════════════════════════
  // 4. HUD UPDATE
  // ═══════════════════════════════════════

  function _updateHUD() {
    var hud = document.getElementById('observer-hud');
    if (!hud) return;

    var existing = document.getElementById('hebbian-hud-lines');
    if (existing) existing.remove();

    // Count edges with significant deltas
    var learnedCount = 0;
    for (var k in hebbian.deltas) {
      if (hebbian.deltas.hasOwnProperty(k) && Math.abs(hebbian.deltas[k]) > TRACK_THRESH) {
        learnedCount++;
      }
    }

    if (learnedCount === 0 && hebbian.strengthened.length === 0) return;

    var dim = 'rgba(201,169,78,0.5)';
    var teal = '#5ab5a0';
    var lines = [];

    lines.push('<span style="color:' + dim + '">LEARNED   </span><span style="color:' + teal + '">' + learnedCount + '</span>');

    if (hebbian.strengthened.length > 0) {
      var top = hebbian.strengthened[0];
      lines.push('<span style="color:' + dim + '">STRONGEST </span><span style="color:' + teal + '">' + top.nodeA + ' \u2194 ' + top.nodeB + '</span>');
    }

    var span = document.createElement('span');
    span.id = 'hebbian-hud-lines';
    span.innerHTML = '<br>' + lines.join('<br>');
    hud.appendChild(span);
  }

  // ═══════════════════════════════════════
  // 5. RESET
  // ═══════════════════════════════════════

  function reset() {
    hebbian.deltas = {};
    hebbian.strengthened = [];
    hebbian.weakened = [];
    var existing = document.getElementById('hebbian-hud-lines');
    if (existing) existing.remove();
  }

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════

  loadGraph();

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  hebbian.update = update;
  hebbian.reset = reset;
  hebbian.getWeight = getWeight;
  hebbian.getAdjustedEdges = getAdjustedEdges;

  window.LIMENHebbian = hebbian;

})();
