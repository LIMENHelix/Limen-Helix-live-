/**
 * market-stress-triage.js
 * LIMEN HELIX — Live Market Stress Triage
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Real-time market signal polling with interactive decision surface.
 * Uses public APIs with simulated fallback.
 *
 * Stress channels: marketStress, liquidityStress, energyStress
 * Update interval: 10 seconds
 *
 * Events emitted:
 *   limen:market-stress-update  — every cycle
 *   limen:market-stress-alert   — when combined stress > threshold
 *   limen:user-action           — when user selects a response
 *
 * Load order: after event-narrator.js, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────

  var POLL_INTERVAL = 10000;
  var FETCH_TIMEOUT = 4000;
  var ALERT_THRESHOLD = 0.60;
  var HISTORY_MAX = 10;

  // Node indices in civilization.html NODES array
  var NODE_MAP = {
    economy: 1,
    energy: 3,
    finance: 18,
    trade: 16,
    defense: 12,
    infrastructure: 2,
    industry: 5,
    technology: 9,
    science: 6
  };

  // Stress channel → node mapping for visual effects
  var CHANNEL_NODES = {
    market: ['economy', 'finance', 'trade'],
    liquidity: ['finance', 'economy', 'infrastructure'],
    energy: ['energy', 'industry', 'trade']
  };

  // ─── State ──────────────────────────────────────────────────────────────

  var _interval = null;
  var _state = {
    marketStress: 0,
    liquidityStress: 0,
    energyStress: 0,
    drivers: [],
    updated: null,
    mode: 'neutral',
    alertActive: false
  };
  var _prevState = { marketStress: 0, liquidityStress: 0, energyStress: 0 };
  var _history = [];
  var _cycleCount = 0;
  var _lastAlertTime = 0;
  var _hudEl = null;
  var _stripEl = null;

  // ─── Feed source ─────────────────────────────────────────────────────────

  var _rawFeed = { spxChange: null, vix: null, oilChange: null, yield10yChange: null, simulated: true };

  function _fetchSnapshot() {
    return new Promise(function (resolve) {
      var aborted = false;
      var timer = setTimeout(function () {
        aborted = true;
        resolve(null);
      }, FETCH_TIMEOUT);

      fetch('/api/market-snapshot').then(function (r) {
        clearTimeout(timer);
        if (!aborted && r.ok) {
          r.json().then(function (data) { resolve(data); }).catch(function () { resolve(null); });
        } else if (!aborted) {
          resolve(null);
        }
      }).catch(function () {
        clearTimeout(timer);
        if (!aborted) resolve(null);
      });
    });
  }

  // ─── Simulated fallback ─────────────────────────────────────────────────

  function _simulatedSignals() {
    var t = Date.now() * 0.0001;
    var spChange = Math.sin(t) * 1.5 + Math.sin(t * 2.7) * 0.8;
    var vix = 18 + Math.sin(t * 0.8 + 1) * 8 + Math.random() * 2;
    var oilChange = Math.sin(t * 1.3 + 2) * 3 + Math.random() * 0.5;
    var yieldChange = Math.sin(t * 0.6 + 3) * 0.15 + Math.random() * 0.05;

    return {
      sp500Change: Math.round(spChange * 100) / 100,
      vix: Math.round(vix * 100) / 100,
      oilChange: Math.round(oilChange * 100) / 100,
      yieldChange: Math.round(yieldChange * 1000) / 1000,
      simulated: true
    };
  }

  // ─── Stress computation ─────────────────────────────────────────────────

  function _computeStress(signals) {
    var drivers = [];

    // Market stress: driven by S&P decline + VIX elevation
    var spFactor = 0;
    if (signals.sp500Change !== undefined) {
      spFactor = _clamp(-signals.sp500Change / 3, 0, 1);
      if (signals.sp500Change < -1) drivers.push('market decline ' + signals.sp500Change.toFixed(1) + '%');
      if (signals.sp500Change > 1) drivers.push('market rally +' + signals.sp500Change.toFixed(1) + '%');
    }

    var vixFactor = 0;
    if (signals.vix !== undefined) {
      vixFactor = _clamp((signals.vix - 15) / 30, 0, 1);
      if (signals.vix > 22) drivers.push('volatility elevated VIX ' + signals.vix.toFixed(1));
    }

    var marketStress = _clamp(spFactor * 0.5 + vixFactor * 0.5, 0, 1);

    // Liquidity stress: driven by yield moves + VIX
    var yieldFactor = 0;
    if (signals.yieldChange !== undefined) {
      yieldFactor = _clamp(Math.abs(signals.yieldChange) / 0.2, 0, 1);
      if (Math.abs(signals.yieldChange) > 0.05) {
        var dir = signals.yieldChange > 0 ? 'rising' : 'falling';
        drivers.push('yield ' + dir + ' ' + (signals.yieldChange > 0 ? '+' : '') + signals.yieldChange.toFixed(3));
      }
    }

    var liquidityStress = _clamp(yieldFactor * 0.6 + vixFactor * 0.4, 0, 1);

    // Energy stress: driven by oil price moves
    var oilFactor = 0;
    if (signals.oilChange !== undefined) {
      oilFactor = _clamp(Math.abs(signals.oilChange) / 4, 0, 1);
      if (Math.abs(signals.oilChange) > 1) {
        var oDir = signals.oilChange > 0 ? 'spike' : 'drop';
        drivers.push('oil ' + oDir + ' ' + (signals.oilChange > 0 ? '+' : '') + signals.oilChange.toFixed(1) + '%');
      }
    }

    var energyStress = _clamp(oilFactor * 0.7 + spFactor * 0.3, 0, 1);

    // Apply mode modifiers from user choices
    if (_state.mode === 'defensive') {
      marketStress = marketStress * 0.75;
      drivers.push('defensive posture active');
    } else if (_state.mode === 'opportunity') {
      energyStress = energyStress * 0.8;
      drivers.push('opportunity lens active');
    } else if (_state.mode === 'observing') {
      drivers.push('observation mode');
    }

    if (drivers.length === 0) {
      drivers.push('signals nominal');
    }

    return {
      marketStress: _round(marketStress),
      liquidityStress: _round(liquidityStress),
      energyStress: _round(energyStress),
      drivers: drivers
    };
  }

  // ─── Main update cycle ──────────────────────────────────────────────────

  function _update() {
    _cycleCount++;

    _fetchSnapshot().then(function (snapshot) {
      var signals;

      if (snapshot && snapshot.updated) {
        // Map endpoint response to internal signal shape
        signals = {
          sp500Change: snapshot.spxChange,
          vix: snapshot.vix,
          oilChange: snapshot.oilChange,
          yieldChange: snapshot.yield10yChange,
          simulated: snapshot.simulated || false
        };
        // Store raw feed for strip display
        _rawFeed = {
          spxChange: snapshot.spxChange,
          vix: snapshot.vix,
          oilChange: snapshot.oilChange,
          yield10yChange: snapshot.yield10yChange,
          simulated: snapshot.simulated || false
        };
        // Use server-provided drivers if available
        if (snapshot.drivers && snapshot.drivers.length > 0) {
          signals._serverDrivers = snapshot.drivers;
        }
      } else {
        signals = _simulatedSignals();
        _rawFeed = {
          spxChange: signals.sp500Change,
          vix: signals.vix,
          oilChange: signals.oilChange,
          yield10yChange: signals.yieldChange,
          simulated: true
        };
      }

      _processSignals(signals);
    }).catch(function () {
      var sim = _simulatedSignals();
      _rawFeed = { spxChange: sim.sp500Change, vix: sim.vix, oilChange: sim.oilChange, yield10yChange: sim.yieldChange, simulated: true };
      _processSignals(sim);
    });
  }

  function _processSignals(signals) {
    // Save previous
    _prevState.marketStress = _state.marketStress;
    _prevState.liquidityStress = _state.liquidityStress;
    _prevState.energyStress = _state.energyStress;

    // Compute stress
    var result = _computeStress(signals);

    // Smooth with EMA (alpha 0.4 — responsive but not jumpy)
    _state.marketStress = _round(_state.marketStress * 0.6 + result.marketStress * 0.4);
    _state.liquidityStress = _round(_state.liquidityStress * 0.6 + result.liquidityStress * 0.4);
    _state.energyStress = _round(_state.energyStress * 0.6 + result.energyStress * 0.4);
    _state.drivers = result.drivers;
    _state.updated = Date.now();

    // Apply visual effects to connectome nodes
    _applyVisualEffects();

    // Render live strip
    _renderStrip();

    // Emit update event
    _dispatch('limen:market-stress-update', {
      marketStress: _state.marketStress,
      liquidityStress: _state.liquidityStress,
      energyStress: _state.energyStress,
      drivers: _state.drivers,
      mode: _state.mode,
      updated: _state.updated
    });

    // Check alert threshold
    var combined = (_state.marketStress + _state.liquidityStress + _state.energyStress) / 3;
    var materialChange = Math.abs(_state.marketStress - _prevState.marketStress) > 0.05 ||
                         Math.abs(_state.liquidityStress - _prevState.liquidityStress) > 0.05 ||
                         Math.abs(_state.energyStress - _prevState.energyStress) > 0.05;

    if (combined > ALERT_THRESHOLD && materialChange && Date.now() - _lastAlertTime > 30000) {
      _lastAlertTime = Date.now();
      _state.alertActive = true;
      _dispatch('limen:market-stress-alert', {
        marketStress: _state.marketStress,
        liquidityStress: _state.liquidityStress,
        energyStress: _state.energyStress,
        drivers: _state.drivers,
        combined: _round(combined)
      });
      _showDecisionCard();
    }

    // Log every 3rd cycle
    if (_cycleCount % 3 === 0) {
      console.log('[LIMEN] triage: M=' + (_state.marketStress * 100).toFixed(0) +
        '% L=' + (_state.liquidityStress * 100).toFixed(0) +
        '% E=' + (_state.energyStress * 100).toFixed(0) +
        '% mode=' + _state.mode +
        (signals && signals.simulated ? ' (sim)' : ' (live)'));
    }
  }

  // ─── Visual effects on connectome nodes ─────────────────────────────────

  function _applyVisualEffects() {
    if (typeof NODES === 'undefined' || !NODES) return;

    var channels = {
      market: _state.marketStress,
      liquidity: _state.liquidityStress,
      energy: _state.energyStress
    };

    for (var channel in CHANNEL_NODES) {
      var nodeIds = CHANNEL_NODES[channel];
      var stress = channels[channel];

      for (var i = 0; i < nodeIds.length; i++) {
        var idx = NODE_MAP[nodeIds[i]];
        if (idx === undefined || !NODES[idx]) continue;

        var node = NODES[idx];
        if (!node.stress_vector) continue;

        // Map stress channels to existing stress_vector slots
        if (channel === 'market') {
          node.stress_vector.demand = _clamp(stress * 0.9, 0, 1);
          node.stress_vector.solvency = _clamp(stress * 0.7, 0, 1);
        } else if (channel === 'liquidity') {
          node.stress_vector.liquidity = _clamp(stress * 0.9, 0, 1);
          node.stress_vector.funding = _clamp(stress * 0.6, 0, 1);
        } else if (channel === 'energy') {
          node.stress_vector.ops = _clamp(stress * 0.8, 0, 1);
        }

        // Recompute total stress
        var sv = node.stress_vector;
        var sum = 0;
        var count = 0;
        for (var k in sv) {
          if (sv.hasOwnProperty(k)) {
            sum += sv[k];
            count++;
          }
        }
        node.total_stress = count > 0 ? sum / count : 0;
      }
    }

    // Apply mode-specific visual emphasis
    if (_state.mode === 'defensive') {
      _emphasisNodes(['defense', 'infrastructure'], 0.15);
      _dimNodes(['trade', 'finance'], 0.4);
    } else if (_state.mode === 'opportunity') {
      _emphasisNodes(['energy', 'technology', 'science'], 0.15);
    }
  }

  function _emphasisNodes(nodeIds, boostAmount) {
    if (typeof NODES === 'undefined') return;
    for (var i = 0; i < nodeIds.length; i++) {
      var idx = NODE_MAP[nodeIds[i]];
      if (idx !== undefined && NODES[idx]) {
        // Increase node radius slightly for emphasis
        if (!NODES[idx]._baseR) NODES[idx]._baseR = NODES[idx].r;
        NODES[idx].r = NODES[idx]._baseR * (1 + boostAmount);
      }
    }
  }

  function _dimNodes(nodeIds, dimFactor) {
    if (typeof NODES === 'undefined') return;
    for (var i = 0; i < nodeIds.length; i++) {
      var idx = NODE_MAP[nodeIds[i]];
      if (idx !== undefined && NODES[idx]) {
        if (!NODES[idx]._baseR) NODES[idx]._baseR = NODES[idx].r;
        NODES[idx].r = NODES[idx]._baseR * dimFactor;
      }
    }
  }

  function _resetNodeSizes() {
    if (typeof NODES === 'undefined') return;
    for (var key in NODE_MAP) {
      var idx = NODE_MAP[key];
      if (idx !== undefined && NODES[idx] && NODES[idx]._baseR) {
        NODES[idx].r = NODES[idx]._baseR;
      }
    }
  }

  // ─── Live stress strip ──────────────────────────────────────────────────

  function _renderStrip() {
    if (!_stripEl) {
      _stripEl = document.createElement('div');
      _stripEl.id = 'limen-stress-strip';
      _stripEl.style.cssText = [
        'position:fixed',
        'bottom:12px',
        'left:12px',
        'background:rgba(8,9,12,0.88)',
        'border:1px solid rgba(201,169,78,0.15)',
        'padding:8px 14px',
        'font-family:"IBM Plex Mono",monospace',
        'font-size:0.45rem',
        'letter-spacing:1.5px',
        'z-index:950',
        'border-radius:2px',
        'line-height:2.0',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(_stripEl);
    }

    // Raw feed line
    var feedParts = [];
    var dimFeed = 'rgba(200,195,184,0.35)';
    if (_rawFeed.spxChange !== null) {
      var spxColor = _rawFeed.spxChange < 0 ? 'rgba(232,84,84,0.7)' : 'rgba(90,181,160,0.6)';
      feedParts.push('<span style="color:' + spxColor + '">SPX ' + (_rawFeed.spxChange >= 0 ? '+' : '') + _rawFeed.spxChange.toFixed(2) + '%</span>');
    }
    if (_rawFeed.vix !== null) {
      var vixColor = _rawFeed.vix > 22 ? 'rgba(232,84,84,0.7)' : 'rgba(200,195,184,0.5)';
      feedParts.push('<span style="color:' + vixColor + '">VIX ' + _rawFeed.vix.toFixed(1) + '</span>');
    }
    if (_rawFeed.oilChange !== null) {
      var oilColor = Math.abs(_rawFeed.oilChange) > 1 ? 'rgba(212,175,55,0.7)' : 'rgba(200,195,184,0.5)';
      feedParts.push('<span style="color:' + oilColor + '">OIL ' + (_rawFeed.oilChange >= 0 ? '+' : '') + _rawFeed.oilChange.toFixed(1) + '%</span>');
    }
    if (_rawFeed.yield10yChange !== null) {
      var yldColor = Math.abs(_rawFeed.yield10yChange) > 0.05 ? 'rgba(212,175,55,0.7)' : 'rgba(200,195,184,0.5)';
      feedParts.push('<span style="color:' + yldColor + '">10Y ' + (_rawFeed.yield10yChange >= 0 ? '+' : '') + _rawFeed.yield10yChange.toFixed(3) + '</span>');
    }

    var html = '';

    // Feed ticker row
    if (feedParts.length > 0) {
      html += '<div style="color:' + dimFeed + ';margin-bottom:6px;font-size:0.4rem;letter-spacing:1px">';
      html += feedParts.join(' <span style="color:rgba(200,195,184,0.15)">|</span> ');
      if (_rawFeed.simulated) html += ' <span style="color:rgba(232,84,84,0.5);letter-spacing:1px">SIMULATED DATA</span>';
      html += '</div>';
    }

    // Stress bars
    var bars = [
      { label: 'MARKET', val: _state.marketStress },
      { label: 'LIQUIDITY', val: _state.liquidityStress },
      { label: 'ENERGY', val: _state.energyStress }
    ];

    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      var pct = Math.round(b.val * 100);
      var color = b.val > 0.65 ? 'rgba(232,84,84,0.8)' :
                  b.val > 0.40 ? 'rgba(212,175,55,0.8)' :
                  'rgba(90,181,160,0.7)';
      var barWidth = Math.round(b.val * 60);

      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<span style="color:rgba(200,195,184,0.5);width:70px">' + b.label + '</span>';
      html += '<span style="display:inline-block;width:60px;height:4px;background:rgba(200,195,184,0.08);border-radius:2px;overflow:hidden">';
      html += '<span style="display:block;width:' + barWidth + 'px;height:100%;background:' + color + ';transition:width 0.8s ease"></span>';
      html += '</span>';
      html += '<span style="color:' + color + ';width:30px;text-align:right">' + pct + '%</span>';
      html += '</div>';
    }

    // Mode indicator
    if (_state.mode !== 'neutral') {
      var modeColor = _state.mode === 'defensive' ? 'rgba(100,116,139,0.6)' :
                      _state.mode === 'opportunity' ? 'rgba(90,181,160,0.6)' :
                      'rgba(200,195,184,0.4)';
      html += '<div style="color:' + modeColor + ';margin-top:2px;font-size:0.4rem;letter-spacing:2px">' + _state.mode.toUpperCase() + '</div>';
    }

    html += '<div style="color:rgba(200,195,184,0.15);font-size:0.3rem;letter-spacing:1.5px;margin-top:3px">HEURISTIC</div>';

    _stripEl.innerHTML = html;
  }

  // ─── Decision card ──────────────────────────────────────────────────────

  function _showDecisionCard() {
    // Check triage memory for repeated patterns
    var observeCount = 0;
    var defenseCount = 0;
    for (var h = 0; h < _history.length; h++) {
      if (_history[h].action === 'hold and observe') observeCount++;
      if (_history[h].action === 'rotate toward defense') defenseCount++;
    }

    var bodyLines = ['Market stress is rising.'];
    if (observeCount >= 3) {
      bodyLines.push('Repeated observation posture detected.');
    }
    if (defenseCount >= 3) {
      bodyLines.push('Persistent defensive posture noted.');
    }

    var drivers = _state.drivers.slice(0, 4);

    // Build narrator-compatible message via custom event
    _dispatch('limen:triage-decision', {
      title: 'LIMEN OBSERVATION',
      body: bodyLines.join(' '),
      drivers: drivers,
      options: [
        { label: 'rotate toward defense', type: 'defensive' },
        { label: 'investigate energy opportunity', type: 'opportunity' },
        { label: 'hold and observe', type: 'observing' }
      ],
      context: {
        marketStress: _state.marketStress,
        liquidityStress: _state.liquidityStress,
        energyStress: _state.energyStress
      }
    });

    // Also render directly if narrator is not available
    _renderDecisionPanel(bodyLines.join(' '), drivers);
  }

  // ─── Self-contained decision panel ──────────────────────────────────────

  var _panelEl = null;
  var _panelTimer = null;

  function _renderDecisionPanel(body, drivers) {
    if (_panelEl && _panelEl.style.display === 'block') return; // Already showing

    if (!_panelEl) {
      _panelEl = document.createElement('div');
      _panelEl.id = 'limen-triage-panel';
      _panelEl.style.cssText = [
        'position:fixed',
        'bottom:60px',
        'left:50%',
        'transform:translateX(-50%) translateY(20px)',
        'background:rgba(8,9,12,0.94)',
        'border:1px solid rgba(201,169,78,0.25)',
        'padding:16px 20px',
        'font-family:"IBM Plex Mono",monospace',
        'font-size:0.50rem',
        'letter-spacing:1.2px',
        'z-index:10000',
        'border-radius:3px',
        'box-shadow:0 4px 20px rgba(0,0,0,0.6)',
        'line-height:1.7',
        'min-width:280px',
        'max-width:400px',
        'display:none',
        'opacity:0',
        'transition:opacity 0.4s ease, transform 0.4s ease'
      ].join(';');
      document.body.appendChild(_panelEl);
    }

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.5)';
    var text = 'rgba(200,195,184,0.75)';

    var html = '';
    html += '<div style="color:' + gold + ';font-size:0.55rem;letter-spacing:2px;margin-bottom:8px">LIMEN OBSERVATION</div>';
    html += '<div style="color:' + text + ';margin-bottom:8px">' + _esc(body) + '</div>';

    if (drivers.length > 0) {
      html += '<div style="color:' + dim + ';margin-bottom:6px">Drivers:</div>';
      for (var i = 0; i < drivers.length; i++) {
        html += '<div style="color:' + text + ';padding-left:8px">\u2022 ' + _esc(drivers[i]) + '</div>';
      }
    }

    html += '<div style="color:' + dim + ';margin-top:10px;margin-bottom:6px">Choose a response:</div>';

    var actions = [
      { label: 'rotate toward defense', mode: 'defensive' },
      { label: 'investigate energy opportunity', mode: 'opportunity' },
      { label: 'hold and observe', mode: 'observing' }
    ];

    for (var j = 0; j < actions.length; j++) {
      html += '<button class="triage-action" data-action="' + _esc(actions[j].label) + '" data-mode="' + actions[j].mode + '" style="' +
        'display:block;width:100%;text-align:left;background:rgba(201,169,78,0.06);' +
        'border:1px solid rgba(201,169,78,0.15);color:' + teal + ';' +
        'font-family:IBM Plex Mono,monospace;font-size:0.48rem;letter-spacing:1.2px;' +
        'padding:6px 10px;margin:3px 0;cursor:pointer;border-radius:2px;' +
        'transition:background 0.2s,border-color 0.2s' +
        '">[ ' + _esc(actions[j].label) + ' ]</button>';
    }

    _panelEl.innerHTML = html;

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-triage-panel')) {
      return;
    }

    _panelEl.style.display = 'block';
    _panelEl.style.pointerEvents = 'auto';

    requestAnimationFrame(function () {
      _panelEl.style.opacity = '1';
      _panelEl.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Attach click handlers
    var btns = _panelEl.querySelectorAll('.triage-action');
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', _onActionClick);
      btns[b].addEventListener('mouseenter', function () {
        this.style.background = 'rgba(201,169,78,0.12)';
        this.style.borderColor = 'rgba(201,169,78,0.3)';
      });
      btns[b].addEventListener('mouseleave', function () {
        this.style.background = 'rgba(201,169,78,0.06)';
        this.style.borderColor = 'rgba(201,169,78,0.15)';
      });
    }

    // Auto-dismiss after 25 seconds
    if (_panelTimer) clearTimeout(_panelTimer);
    _panelTimer = setTimeout(_dismissPanel, 25000);
  }

  function _onActionClick(e) {
    var btn = e.currentTarget;
    var action = btn.getAttribute('data-action');
    var mode = btn.getAttribute('data-mode');

    // Reset visual effects from previous mode
    _resetNodeSizes();

    // Set new mode
    _state.mode = mode;

    // Record in history
    var record = {
      timestamp: Date.now(),
      action: action,
      context: {
        marketStress: _state.marketStress,
        liquidityStress: _state.liquidityStress,
        energyStress: _state.energyStress
      },
      resultingMode: mode
    };

    _history.push(record);
    if (_history.length > HISTORY_MAX) _history.shift();
    window.LIMENTriageMemory = _history.slice();

    // Emit user action
    _dispatch('limen:user-action', {
      action: action,
      source: 'market-stress-triage',
      context: record.context
    });

    console.log('[LIMEN] triage: user chose "' + action + '" → mode=' + mode);

    _dismissPanel();

    // Immediate visual update
    _applyVisualEffects();
    _renderStrip();
  }

  function _dismissPanel() {
    if (_panelTimer) {
      clearTimeout(_panelTimer);
      _panelTimer = null;
    }

    // Snooze through panel state manager
    if (window.LIMENPanelState && typeof window.LIMENPanelState.snooze === 'function') {
      window.LIMENPanelState.snooze('limen-triage-panel', 120000);
    }

    if (_panelEl) {
      _panelEl.style.opacity = '0';
      _panelEl.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function () {
        _panelEl.style.display = 'none';
        _panelEl.style.pointerEvents = 'none';
      }, 400);
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;
    console.log('[LIMEN] market-stress-triage: starting');
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        _update();
        _interval = setInterval(function () { if (!document.hidden) _update(); }, POLL_INTERVAL);
      });
    } else {
      _update();
      _interval = setInterval(function () { if (!document.hidden) _update(); }, POLL_INTERVAL);
    }
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    if (_stripEl && _stripEl.parentNode) {
      _stripEl.parentNode.removeChild(_stripEl);
      _stripEl = null;
    }
    _dismissPanel();
    _resetNodeSizes();
  }

  function getState() {
    return {
      marketStress: _state.marketStress,
      liquidityStress: _state.liquidityStress,
      energyStress: _state.energyStress,
      drivers: _state.drivers.slice(),
      mode: _state.mode,
      alertActive: _state.alertActive,
      updated: _state.updated
    };
  }

  function getHistory() {
    return _history.slice();
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function _round(val) {
    return Math.round(val * 100) / 100;
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENTriageMemory = [];

  window.LIMENMarketStressTriage = {
    start: start,
    stop: stop,
    getState: getState,
    getHistory: getHistory
  };

})();
