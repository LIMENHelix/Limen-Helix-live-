/**
 * LIMEN Observer Node
 * Entropy measurement + temporal state tracking for the connectome.
 *
 * Usage:
 *   LIMENObserver.update(activations)  — call after each propagation cycle
 *   LIMENObserver.reset()              — clear history
 *   window.LIMENObserver               — live state object
 */
(function () {
  'use strict';

  var MAX_HISTORY = 10;
  var RISING_THRESH = 0.1;
  var FALLING_THRESH = -0.1;

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════

  var stateHistory = [];  // [{t, activations, entropy}]

  var observer = {
    entropy: 0.0,
    stability: 'STABLE',
    uncertainty: 0.0,
    unresolved_gaps: 0,
    rising_nodes: [],
    falling_nodes: [],
    timestamp: Date.now()
  };

  // ═══════════════════════════════════════
  // ENTROPY
  // ═══════════════════════════════════════

  function computeEntropy(activations) {
    var vals = [];
    var total = 0;
    for (var k in activations) {
      if (!activations.hasOwnProperty(k)) continue;
      var v = activations[k];
      if (v > 0) {
        vals.push(v);
        total += v;
      }
    }
    if (total === 0 || vals.length === 0) return 0;

    var h = 0;
    for (var i = 0; i < vals.length; i++) {
      var p = vals[i] / total;
      if (p > 0) h -= p * Math.log(p);
    }

    // Normalize to 0-1 range using max possible entropy (uniform distribution)
    var maxH = Math.log(vals.length);
    return maxH > 0 ? h / maxH : 0;
  }

  function stabilityLabel(h) {
    if (h < 0.3) return 'STABLE';
    if (h <= 0.6) return 'TRANSITIONING';
    return 'UNSTABLE';
  }

  // ═══════════════════════════════════════
  // TEMPORAL TRENDS
  // ═══════════════════════════════════════

  function computeTrends(currentActivations) {
    var rising = [];
    var falling = [];

    if (stateHistory.length < 2) return { rising: rising, falling: falling };

    // Compute average activation per node over history
    var avgMap = {};
    var countMap = {};
    for (var s = 0; s < stateHistory.length; s++) {
      var act = stateHistory[s].activations;
      for (var k in act) {
        if (!act.hasOwnProperty(k)) continue;
        avgMap[k] = (avgMap[k] || 0) + act[k];
        countMap[k] = (countMap[k] || 0) + 1;
      }
    }
    for (var ak in avgMap) {
      if (avgMap.hasOwnProperty(ak) && countMap[ak] > 0) {
        avgMap[ak] /= countMap[ak];
      }
    }

    // Compare current to average
    for (var nk in currentActivations) {
      if (!currentActivations.hasOwnProperty(nk)) continue;
      var cur = currentActivations[nk];
      var avg = avgMap[nk] || 0;
      var trend = cur - avg;
      if (trend > RISING_THRESH) {
        rising.push({ id: nk, delta: trend });
      } else if (trend < FALLING_THRESH) {
        falling.push({ id: nk, delta: trend });
      }
    }

    // Sort by magnitude, keep top entries
    rising.sort(function (a, b) { return b.delta - a.delta; });
    falling.sort(function (a, b) { return a.delta - b.delta; });

    return { rising: rising, falling: falling };
  }

  // ═══════════════════════════════════════
  // NODE NAME RESOLUTION
  // ═══════════════════════════════════════

  function resolveNodeName(numId) {
    // Try ConnectomeCore's NUM_TO_CANVAS mapping first
    if (typeof ConnectomeCore !== 'undefined') {
      var canvas = ConnectomeCore.Canvas;
      // The mapping is internal, but numId string IDs match
    }
    // Fallback: use numeric ID as-is (the propagation engine uses numeric IDs)
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
    return NUM_NAMES[numId] || ('N' + numId);
  }

  // ═══════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════

  function update(activations) {
    if (!activations) return;

    var entropy = computeEntropy(activations);
    var stability = stabilityLabel(entropy);

    // Push to history
    var snapshot = { t: Date.now(), activations: {}, entropy: entropy };
    for (var k in activations) {
      if (activations.hasOwnProperty(k)) snapshot.activations[k] = activations[k];
    }
    stateHistory.push(snapshot);
    if (stateHistory.length > MAX_HISTORY) stateHistory.shift();

    // Compute trends
    var trends = computeTrends(activations);

    // Count unresolved gaps (nodes with zero activation)
    var gaps = 0;
    for (var g in activations) {
      if (activations.hasOwnProperty(g) && activations[g] === 0) gaps++;
    }

    // Update live object
    observer.entropy = Math.round(entropy * 1000) / 1000;
    observer.stability = stability;
    observer.uncertainty = Math.round((1 - entropy) * 1000) / 1000;
    observer.unresolved_gaps = gaps;
    observer.rising_nodes = trends.rising.slice(0, 5).map(function (r) {
      return resolveNodeName(r.id);
    });
    observer.falling_nodes = trends.falling.slice(0, 5).map(function (r) {
      return resolveNodeName(r.id);
    });
    observer.timestamp = Date.now();

    // Update HUD
    _updateHUD();
  }

  function reset() {
    stateHistory = [];
    observer.entropy = 0;
    observer.stability = 'STABLE';
    observer.uncertainty = 0;
    observer.unresolved_gaps = 0;
    observer.rising_nodes = [];
    observer.falling_nodes = [];
    observer.timestamp = Date.now();
    _updateHUD();
  }

  // ═══════════════════════════════════════
  // HUD DISPLAY
  // ═══════════════════════════════════════

  var hudEl = null;

  function _ensureHUD() {
    if (hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'observer-hud';
    hudEl.style.cssText = [
      'position:fixed',
      'bottom:12px',
      'left:12px',
      'background:rgba(8,9,12,0.88)',
      'border:1px solid rgba(201,169,78,0.2)',
      'padding:8px 12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.55rem',
      'letter-spacing:1.5px',
      'z-index:9998',
      'border-radius:2px',
      'pointer-events:none',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
      'line-height:1.6',
      'min-width:180px',
      'display:none'
    ].join(';');
    document.body.appendChild(hudEl);
  }

  function _updateHUD() {
    _ensureHUD();
    if (!observer.stability || observer.entropy === 0) {
      hudEl.style.display = 'none';
      return;
    }
    hudEl.style.display = 'block';

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.5)';

    var stabilityColor = teal;
    if (observer.stability === 'TRANSITIONING') stabilityColor = '#d4a44e';
    if (observer.stability === 'UNSTABLE') stabilityColor = '#e85454';

    var lines = [];
    lines.push('<span style="color:' + gold + ';font-size:0.6rem">OBSERVER</span>');
    lines.push('<span style="color:' + dim + '">STABILITY </span><span style="color:' + stabilityColor + '">' + observer.stability + '</span>');
    lines.push('<span style="color:' + dim + '">ENTROPY   </span><span style="color:' + teal + '">' + observer.entropy.toFixed(3) + '</span>');

    if (observer.rising_nodes.length > 0) {
      var r = observer.rising_nodes.slice(0, 3).join(', ');
      lines.push('<span style="color:' + dim + '">RISING    </span><span style="color:' + teal + '">' + r + '</span>');
    }
    if (observer.falling_nodes.length > 0) {
      var f = observer.falling_nodes.slice(0, 3).join(', ');
      lines.push('<span style="color:' + dim + '">FALLING   </span><span style="color:' + teal + '">' + f + '</span>');
    }

    // Write observer lines into a dedicated inner container so child
    // elements appended by other modules (e.g. limen-phase-display) survive.
    var inner = document.getElementById('observer-hud-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.id = 'observer-hud-inner';
      hudEl.insertBefore(inner, hudEl.firstChild);
    }
    inner.innerHTML = lines.join('<br>');
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  observer.update = update;
  observer.reset = reset;
  observer.getHistory = function () { return stateHistory.slice(); };

  window.LIMENObserver = observer;

})();
