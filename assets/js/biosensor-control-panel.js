/**
 * biosensor-control-panel.js — LIMEN biosensor LIVE control + readout
 *
 * Floating top-right panel. Three enable buttons (camera rPPG / BLE HRV strap
 * / device motion) and a live readout that subscribes to the fusion engine.
 * Behavioral channel auto-runs on bridge.start(), so it shows live the moment
 * the user moves the mouse or types.
 *
 * Depends on (already loaded by civilization.html / domain-console.html):
 *   - biosensorEngine.js          → window.startBiosensorEngine
 *   - assets/js/biosensor-bridge.js → window.LIMENBiosensorBridge
 *
 * No external CSS. No globals beyond window.LIMENBiosensorPanel.
 * No analytics. No persistence — session RAM only (per CLAUDE.md prime directive).
 */

(function () {
  'use strict';

  if (window.LIMENBiosensorPanel && window.LIMENBiosensorPanel._mounted) return;

  // ── State ────────────────────────────────────────────────────────────────
  var _engine = null;
  var _bridge = null;
  var _root = null;
  var _els  = {};
  var _channels = { behavior: false, camera: false, ble: false, motion: false };
  var _bleDevice = null;
  var _sessionStart = Date.now();
  var _lastRender = 0;
  var _RENDER_MS = 200;          // ~5 Hz UI refresh
  var _collapsed = false;  // Start expanded so the biosensor readout is visible (operator request 2026-06-15).

  // ── Mount ────────────────────────────────────────────────────────────────
  function mount() {
    if (_root) return;
    _root = document.createElement('div');
    _root.id = 'limen-biosensor-panel';
    _root.style.cssText = [
      'position:fixed', 'top:88px', 'right:12px', 'z-index:9998',
      'width:288px', 'background:rgba(10,12,18,0.92)',
      'border:1px solid rgba(201,169,78,0.35)', 'border-radius:8px',
      'font:11px/1.45 ui-monospace,Menlo,Consolas,monospace',
      'color:#e8dec0', 'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
      'backdrop-filter:blur(6px)', '-webkit-backdrop-filter:blur(6px)',
      'user-select:none'
    ].join(';');

    _root.innerHTML =
      '<div id="lbp-head" style="display:flex;align-items:center;justify-content:space-between;'
      + 'padding:8px 10px;border-bottom:1px solid rgba(201,169,78,0.18);cursor:move;">'
      +   '<div style="font-weight:600;color:#c9a94e;letter-spacing:0.06em;font-size:10px;">'
      +     'BIOSENSOR PANEL &middot; <span id="lbp-status">INIT</span>'
      +   '</div>'
      +   '<div style="display:flex;gap:6px;">'
      +     '<button id="lbp-toggle" title="collapse" style="background:transparent;border:1px solid rgba(201,169,78,0.3);'
      +       'color:#c9a94e;border-radius:3px;padding:1px 6px;cursor:pointer;font:inherit;">−</button>'
      +   '</div>'
      + '</div>'
      + '<div id="lbp-body" style="padding:10px;">'
      // Channel buttons row
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">'
      +     channelBtn('camera', 'CAMERA HR (rPPG)')
      +     channelBtn('ble',    'HRV STRAP (BLE)')
      +     channelBtn('motion', 'MOTION')
      +     channelBtn('behavior','BEHAVIOR')
      +   '</div>'
      // Primary readouts
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11px;'
      +       'border-top:1px dashed rgba(201,169,78,0.18);padding-top:8px;">'
      +     readoutRow('Heart Rate',   'hr',    '— bpm')
      +     readoutRow('HRV (RMSSD)',  'hrv',   '— ms')
      +     readoutRow('Archetype',    'arch',  '—')
      +     readoutRow('Regulation',   'reg',   '—')
      +     readoutRow('Confidence',   'conf',  '—')
      +     readoutRow('Tap cadence',  'tap',   '— /s')
      +   '</div>'
      // Bars
      +   '<div style="margin-top:8px;border-top:1px dashed rgba(201,169,78,0.18);padding-top:8px;">'
      +     bar('Arousal',         'arousal')
      +     bar('Coherence',       'coh')
      +     bar('Cognitive Load',  'load')
      +     bar('Valence',         'val', true /* signed */)
      +   '</div>'
      // Live charts (60s rolling windows)
      +   '<div style="margin-top:8px;border-top:1px dashed rgba(201,169,78,0.18);padding-top:6px;">'
      +     '<div id="lbp-chart-state" style="margin-bottom:4px;"></div>'
      +     '<div id="lbp-chart-hr"></div>'
      +   '</div>'
      // Footer
      +   '<div style="margin-top:8px;display:flex;justify-content:space-between;'
      +       'font-size:10px;color:#8a7a4a;border-top:1px dashed rgba(201,169,78,0.18);padding-top:6px;">'
      +     '<span>session <span id="lbp-clock">00:00</span></span>'
      +     '<span id="lbp-device">—</span>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(_root);

    // ── Docked into the top bar (operator request 2026-06-13) ───────────────
    // Don't float over the cockpit: hide the panel by default and toggle it from
    // the topbar's existing biosensor indicator (#ltb-bio). Falls back to simply
    // staying hidden if the topbar isn't present (panel still openable via API).
    _root.style.display = 'block';
    (function dockToTopbar(tries) {
      var dot = document.getElementById('ltb-bio');
      if (!dot) { if (tries < 25) setTimeout(function () { dockToTopbar(tries + 1); }, 120); return; }
      dot.style.cursor = 'pointer';
      dot.title = 'Toggle biosensor panel';
      dot.addEventListener('click', function () {
        _root.style.display = (_root.style.display === 'none') ? 'block' : 'none';
      });
    })(0);

    // Cache references
    _els.status = $('lbp-status');
    _els.body   = $('lbp-body');
    _els.toggle = $('lbp-toggle');
    _els.clock  = $('lbp-clock');
    _els.device = $('lbp-device');
    ['camera','ble','motion','behavior'].forEach(function (k) {
      _els['btn-' + k] = $('lbp-btn-' + k);
    });
    ['hr','hrv','arch','reg','conf','tap'].forEach(function (k) {
      _els['v-' + k] = $('lbp-v-' + k);
    });
    ['arousal','coh','load','val'].forEach(function (k) {
      _els['bar-' + k] = $('lbp-bar-' + k);
      _els['barv-' + k] = $('lbp-barv-' + k);
    });

    // Apply initial collapsed state (set above) — start as a small "+" affordance.
    if (_collapsed) {
      _els.body.style.display = 'none';
      _els.toggle.textContent = '+';
    }

    // Buttons
    _els['btn-camera'].addEventListener('click', function () { enableChannel('camera'); });
    _els['btn-ble'].addEventListener('click',    function () { enableChannel('ble'); });
    _els['btn-motion'].addEventListener('click', function () { enableChannel('motion'); });
    _els['btn-behavior'].addEventListener('click', function () { /* always-on */ });

    _els.toggle.addEventListener('click', function () {
      _collapsed = !_collapsed;
      _els.body.style.display = _collapsed ? 'none' : 'block';
      _els.toggle.textContent = _collapsed ? '+' : '−';
    });

    // Live charts — created if LIMENSparkline is loaded
    if (window.LIMENSparkline) {
      _els.chartState = window.LIMENSparkline.create({
        parent:   $('lbp-chart-state'),
        width:    268, height: 56, windowMs: 60000,
        yLabel:   'arousal · coherence · load',
        series: [
          { id: 'arousal', color: '#df9a9a', range: [0, 1], label: 'arousal' },
          { id: 'coh',     color: '#9adfa1', range: [0, 1], label: 'coh' },
          { id: 'load',    color: '#c9a94e', range: [0, 1], label: 'load' }
        ]
      });
      _els.chartHR = window.LIMENSparkline.create({
        parent:   $('lbp-chart-hr'),
        width:    268, height: 48, windowMs: 60000,
        yLabel:   'heart rate (bpm)',
        series: [
          { id: 'hr', color: '#e8dec0', label: 'HR' }
        ]
      });
    }

    // Drag-to-move
    enableDrag(_root, $('lbp-head'));
  }

  function channelBtn(id, label) {
    return '<button id="lbp-btn-' + id + '" data-state="off" '
      + 'style="background:rgba(201,169,78,0.06);color:#8a7a4a;'
      + 'border:1px solid rgba(201,169,78,0.18);border-radius:4px;'
      + 'padding:5px 7px;font:inherit;font-size:10px;cursor:pointer;'
      + 'letter-spacing:0.04em;text-align:left;">'
      + '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;'
      + 'background:#444;margin-right:5px;vertical-align:middle;" '
      + 'id="lbp-dot-' + id + '"></span>' + label + '</button>';
  }

  function readoutRow(label, id, init) {
    return '<div style="color:#8a7a4a;">' + label + '</div>'
      + '<div id="lbp-v-' + id + '" style="color:#e8dec0;text-align:right;font-variant-numeric:tabular-nums;">'
      + init + '</div>';
  }

  function bar(label, id, signed) {
    return '<div style="margin-bottom:5px;">'
      + '<div style="display:flex;justify-content:space-between;font-size:10px;color:#8a7a4a;">'
      +   '<span>' + label + '</span>'
      +   '<span id="lbp-barv-' + id + '">—</span>'
      + '</div>'
      + '<div style="height:4px;background:rgba(201,169,78,0.08);border-radius:2px;overflow:hidden;'
      +   (signed ? 'position:relative;' : '') + '">'
      +   (signed ?
          '<div style="position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(201,169,78,0.25);"></div>' : '')
      + '<div id="lbp-bar-' + id + '" style="height:100%;background:#c9a94e;width:0%;'
      +   (signed ? 'margin-left:50%;' : '') + 'transition:width 200ms linear,margin-left 200ms linear;"></div>'
      + '</div></div>';
  }

  // ── Channel enablement ───────────────────────────────────────────────────
  function enableChannel(kind) {
    if (!_engine) {
      setBtn(kind, 'fail', 'engine not loaded');
      return;
    }
    var fn = ({
      camera: 'enableCamera',
      ble: 'enableBLE',
      motion: 'enableMotion'
    })[kind];
    if (!fn || typeof _engine[fn] !== 'function') {
      setBtn(kind, 'fail', 'method missing');
      return;
    }
    setBtn(kind, 'pending');
    Promise.resolve(_engine[fn]()).then(function (result) {
      var ok = result && (result.success !== false);
      if (ok) {
        _channels[kind] = true;
        setBtn(kind, 'on', result && result.deviceName ? result.deviceName : null);
        if (kind === 'ble' && result && result.deviceName) {
          _bleDevice = result.deviceName;
          _els.device.textContent = result.deviceName;
        }
      } else {
        var err = (result && result.error) ? String(result.error) : 'unavailable';
        setBtn(kind, 'fail', err);
      }
    }).catch(function (e) {
      setBtn(kind, 'fail', (e && e.message) || 'error');
    });
  }

  function setBtn(kind, state, detail) {
    var btn = _els['btn-' + kind];
    var dot = $('lbp-dot-' + kind);
    if (!btn || !dot) return;
    btn.dataset.state = state;
    var palettes = {
      off:     { bg: 'rgba(201,169,78,0.06)', border: 'rgba(201,169,78,0.18)', text: '#8a7a4a',  dot: '#444' },
      pending: { bg: 'rgba(201,169,78,0.10)', border: 'rgba(201,169,78,0.40)', text: '#c9a94e',  dot: '#c9a94e' },
      on:      { bg: 'rgba(76,176,80,0.14)',  border: 'rgba(76,176,80,0.55)',  text: '#9adfa1',  dot: '#4cb050' },
      fail:    { bg: 'rgba(176,76,76,0.14)',  border: 'rgba(176,76,76,0.55)',  text: '#df9a9a',  dot: '#b04c4c' }
    };
    var p = palettes[state] || palettes.off;
    btn.style.background = p.bg;
    btn.style.borderColor = p.border;
    btn.style.color = p.text;
    dot.style.background = p.dot;
    if (detail) btn.title = detail;
  }

  // ── Live update loop ─────────────────────────────────────────────────────
  function tick() {
    var now = Date.now();
    if (now - _lastRender < _RENDER_MS) return;
    _lastRender = now;

    // Session clock
    var elapsed = Math.floor((now - _sessionStart) / 1000);
    var mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    var ss = String(elapsed % 60).padStart(2, '0');
    _els.clock.textContent = mm + ':' + ss;

    // Pull state
    var state = null;
    if (_engine && typeof _engine.getState === 'function') {
      state = _engine.getState();
    } else if (_bridge && typeof _bridge.getBioState === 'function') {
      state = _bridge.getBioState();
    }
    if (!state) {
      _els.status.textContent = 'WAITING';
      return;
    }
    _els.status.textContent = 'LIVE';

    // Channel dots from engine state
    if (state.channels) {
      ['rppg','ble','motion','behavior'].forEach(function (chan) {
        var c = state.channels[chan];
        if (!c) return;
        var key = chan === 'rppg' ? 'camera' : chan;
        var active = !!(c.active || c.fresh);
        if (active && _channels[key] === false && key !== 'behavior') {
          _channels[key] = true;
          setBtn(key, 'on');
        }
        if (key === 'behavior' && active) {
          _channels.behavior = true;
          setBtn('behavior', 'on');
        }
      });
    } else {
      // Behavior auto-runs as soon as DOM events fire — assume live
      if (!_channels.behavior) { _channels.behavior = true; setBtn('behavior', 'on'); }
    }

    // Numeric readouts
    setText('hr',  state.heartRate ? Math.round(state.heartRate) + ' bpm' : '— bpm');
    setText('hrv', state.hrv ? state.hrv.toFixed(1) + ' ms' : '— ms');
    setText('arch', state.archetype || '—');
    setText('tap', tapRate(state) + ' /s');

    // Regulation + confidence (from bridge if available)
    if (_bridge) {
      var reg = (typeof _bridge.getRegulationState === 'function') ? _bridge.getRegulationState() : null;
      var conf = (typeof _bridge.getConfidence === 'function')    ? _bridge.getConfidence()    : null;
      setText('reg',  reg || '—');
      setText('conf', conf == null ? '—' : (conf * 100).toFixed(0) + '%');
    }

    // Bars
    setBar('arousal', state.arousal);
    setBar('coh',     state.coherence);
    setBar('load',    state.cognitiveLoad);
    setBar('val',     state.valence, true);

    // Charts
    if (_els.chartState) {
      _els.chartState.push({
        arousal: numOrNull(state.arousal),
        coh:     numOrNull(state.coherence),
        load:    numOrNull(state.cognitiveLoad)
      });
    }
    if (_els.chartHR && typeof state.heartRate === 'number' && state.heartRate > 0) {
      _els.chartHR.push({ hr: state.heartRate });
    }
  }

  function numOrNull(v) { return (typeof v === 'number' && !isNaN(v)) ? v : null; }

  function tapRate(state) {
    if (state && state.channels && state.channels.behavior) {
      var b = state.channels.behavior;
      if (typeof b.tapCadence === 'number') return b.tapCadence.toFixed(1);
    }
    return '—';
  }

  function setText(id, val) {
    var el = _els['v-' + id];
    if (el && el.textContent !== val) el.textContent = val;
  }

  function setBar(id, val, signed) {
    var bar = _els['bar-' + id];
    var lab = _els['barv-' + id];
    if (!bar) return;
    if (val == null || isNaN(val)) {
      bar.style.width = '0%';
      if (lab) lab.textContent = '—';
      return;
    }
    if (signed) {
      // val ∈ [-1, 1]; bar centered at 50%
      var pct = Math.max(-1, Math.min(1, val));
      var width = Math.abs(pct) * 50;
      var left = pct >= 0 ? 50 : (50 - width);
      bar.style.marginLeft = left + '%';
      bar.style.width = width + '%';
      if (lab) lab.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2);
    } else {
      var p = Math.max(0, Math.min(1, val));
      bar.style.width = (p * 100).toFixed(0) + '%';
      if (lab) lab.textContent = p.toFixed(2);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function enableDrag(el, handle) {
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    handle.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      var r = el.getBoundingClientRect();
      ox = r.left; oy = r.top;
      el.style.left = ox + 'px';
      el.style.top  = oy + 'px';
      el.style.right = 'auto';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      el.style.left = (ox + e.clientX - sx) + 'px';
      el.style.top  = (oy + e.clientY - sy) + 'px';
    });
    document.addEventListener('mouseup', function () { dragging = false; });
  }

  // ── Engine attach (poll until bridge has wired the engine) ───────────────
  function attach() {
    _bridge = window.LIMENBiosensorBridge || null;
    _engine = window._limenBiosensor || null;

    if (!_engine && _bridge && typeof _bridge.initEngine === 'function') {
      // bridge present but engine not yet wired — bridge.start() (called by
      // limen-bootstrap) creates the engine via initEngine. Ask it to do so
      // now if it hasn't already.
      try { _bridge.initEngine({ camera: false, hud: false }); } catch (e) {}
      _engine = window._limenBiosensor || null;
    }
    if (_engine) {
      // subscribe so our tick() always has fresh state available; engine
      // already polls behavior internally and emits on its own cadence
      try { _engine.subscribe(function () { tick(); }); } catch (e) {}
    }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    mount();

    // Try to attach immediately, then retry until engine is up
    attach();
    var tries = 0;
    var pollId = setInterval(function () {
      if (_engine || tries++ > 60) clearInterval(pollId);
      else attach();
    }, 250);

    // Render loop — independent of engine subscriptions so the panel stays
    // alive (showing session clock + behavior auto-detect) even if no engine
    setInterval(tick, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.LIMENBiosensorPanel = {
    _mounted: true,
    enable: enableChannel,
    getEngine: function () { return _engine; },
    getBridge: function () { return _bridge; }
  };
})();
