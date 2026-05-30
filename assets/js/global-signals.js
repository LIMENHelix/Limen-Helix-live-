/**
 * LIMEN Global Signal Aggregator
 * World snapshot, domain scoring, signal-to-node translation, world HUD.
 *
 * Usage:
 *   LIMENWorld.update(activations) — call after each propagation cycle
 *   LIMENWorld.reset()             — clear state
 *   LIMENWorld.getSeeds()          — seed activations from world signals
 *   window.LIMENWorld              — live state object
 *
 * Events:
 *   document 'limen:worldsignal' — fires when any domain crosses 0.7
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════
  // DOMAIN → NODE MAPPINGS (numeric IDs from propagation engine)
  // ═══════════════════════════════════════

  // Each domain maps to the connectome nodes most relevant to it.
  // Scores are computed as average activation of these nodes.
  var DOMAIN_NODES = {
    economy:     [6, 12, 35, 36, 37],       // OFC, dlPFC, NAcc, Caud, Put
    technology:  [12, 13, 15, 55, 78],       // dlPFC, vlPFC, ECN, IPS, FPC
    geopolitics: [9, 10, 17, 18, 59],        // ACC, dACC, BLA, CeA, PAG
    energy:      [31, 32, 33, 27, 96],       // Hypo, Pit, ADR, LC, SCN
    health:      [31, 92, 93, 94, 75],       // Hypo, BDNF, TrkB, BBB, Astro
    governance:  [9, 12, 13, 78, 79],        // ACC, dlPFC, vlPFC, FPC, MFC
    climate:     [31, 73, 24, 25, 26],       // Hypo, ENS, NTS, VV, DV
    finance:     [6, 5, 35, 29, 68]          // OFC, vmPFC, NAcc, VTA, Hab
  };

  // Highest-degree hub per domain (for seed injection)
  var DOMAIN_HUBS = {
    economy:     6,    // OFC
    technology:  12,   // dlPFC
    geopolitics: 9,    // ACC
    energy:      31,   // Hypothalamus
    health:      31,   // Hypothalamus
    governance:  9,    // ACC
    climate:     31,   // Hypothalamus
    finance:     6     // OFC
  };

  var DOMAIN_KEYS = ['economy','technology','geopolitics','energy','health','governance','climate','finance'];

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════

  var prevScores = {};  // domain → previous score for trend detection

  var world = {
    snapshot: {},
    domains: {},
    lastUpdated: null,
    updateInterval: 180000
  };

  // Initialize domains
  function _initDomains() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      world.domains[k] = { score: 0, trend: 'STABLE', label: 'STABLE' };
      prevScores[k] = 0;
    }
  }
  _initDomains();

  // ═══════════════════════════════════════
  // 2. SIGNAL SOURCES — domain scoring
  // ═══════════════════════════════════════

  function _scoreDomains(activations) {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var domain = DOMAIN_KEYS[i];
      var nodes = DOMAIN_NODES[domain];
      var sum = 0;
      var count = 0;

      for (var n = 0; n < nodes.length; n++) {
        var val = activations[nodes[n]];
        if (val !== undefined) {
          sum += val;
          count++;
        }
      }

      var score = count > 0 ? sum / count : 0;
      score = Math.max(0, Math.min(1, score));
      score = Math.round(score * 1000) / 1000;

      // Trend detection
      var prev = prevScores[domain] || 0;
      var delta = score - prev;
      var trend = 'STABLE';
      if (delta > 0.05) trend = 'RISING';
      else if (delta < -0.05) trend = 'FALLING';

      // Label
      var label = 'STABLE';
      if (score > 0.7) label = 'HIGH STRESS';
      else if (score > 0.4) label = 'ELEVATED';
      else if (score > 0.2) label = 'MODERATE';

      prevScores[domain] = score;

      world.domains[domain] = {
        score: score,
        trend: trend,
        label: label
      };

      // Broadcast if crossing high threshold
      if (score > 0.7 && prev <= 0.7) {
        _dispatchWorldSignal(domain, score, trend);
      }
    }

    world.lastUpdated = Date.now();
  }

  // ═══════════════════════════════════════
  // 3. SIGNAL → NODE TRANSLATION
  // ═══════════════════════════════════════

  function getSeeds() {
    var seeds = [];
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var domain = DOMAIN_KEYS[i];
      var d = world.domains[domain];
      if (d.score > 0.3) {
        var hubNode = DOMAIN_HUBS[domain];
        seeds.push({
          nodeId: hubNode,
          seedActivation: Math.round(d.score * 0.3 * 1000) / 1000
        });
      }
    }
    return seeds;
  }

  // ═══════════════════════════════════════
  // 4. WORLD HUD PANEL
  // ═══════════════════════════════════════

  var hudEl = null;

  function _ensureHUD() {
    if (hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'world-hud';
    hudEl.style.cssText = [
      'position:fixed',
      'bottom:12px',
      'right:12px',
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

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.5)';
    var red = '#e85454';

    var lines = [];
    var hasVisible = false;

    lines.push('<span style="color:' + gold + ';font-size:0.6rem">WORLD SIGNALS</span>');

    var displayOrder = ['economy','energy','geopolitics','finance','technology','health','governance','climate'];
    for (var i = 0; i < displayOrder.length; i++) {
      var k = displayOrder[i];
      var d = world.domains[k];
      if (d.score <= 0.2) continue;
      hasVisible = true;

      var labelColor = teal;
      if (d.label === 'HIGH STRESS') labelColor = red;
      else if (d.label === 'ELEVATED') labelColor = '#d4a44e';

      var pad = k.toUpperCase();
      while (pad.length < 11) pad += ' ';
      pad = pad.substring(0, 11);

      lines.push('<span style="color:' + dim + '">' + pad + ' </span><span style="color:' + labelColor + '">' + d.label + '</span>');
    }

    if (!hasVisible) {
      hudEl.style.display = 'none';
      return;
    }

    hudEl.style.display = 'block';
    hudEl.innerHTML = lines.join('<br>');
  }

  // ═══════════════════════════════════════
  // 5. BROADCAST INTEGRATION
  // ═══════════════════════════════════════

  function _dispatchWorldSignal(domain, score, trend) {
    try {
      document.dispatchEvent(new CustomEvent('limen:worldsignal', {
        detail: { domain: domain, score: score, trend: trend }
      }));
    } catch (e) { /* silent */ }
  }

  // Listen for world signals in workspace attention competition
  // (workspace will read world.domains directly on its next cycle)

  // ═══════════════════════════════════════
  // UPDATE / RESET
  // ═══════════════════════════════════════

  function update(activations) {
    if (!activations) return;
    world.snapshot = activations;
    _scoreDomains(activations);
    _updateHUD();
  }

  function reset() {
    _initDomains();
    prevScores = {};
    world.snapshot = {};
    world.lastUpdated = null;
    if (hudEl) {
      hudEl.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  world.update = update;
  world.reset = reset;
  world.getSeeds = getSeeds;

  window.LIMENWorld = world;

})();
