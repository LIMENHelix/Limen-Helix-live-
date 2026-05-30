/**
 * ui-mode-manager.js
 * LIMEN HELIX — Front-End Decongestion Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Controls panel visibility, collapsibility, and UI modes
 * to keep the connectome node field clear and interactive.
 *
 * Modes: MAP (exploration), SIGNALS (monitoring), TRIAGE (crisis)
 *
 * Provides: window.LIMENUIMode
 * Listens: limen:node-focus, limen:escalation-shift
 * Emits: limen:ui-mode-change
 *
 * Load order: after all advisory modules, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────

  var MODES = ['map', 'signals', 'triage'];

  // Panel registry: id → config
  var PANELS = {
    'limen-global-state-badge': { label: 'GLOBAL STATE', group: 'status',    defaultCollapsed: true },
    'limen-domain-panel':       { label: 'DOMAINS',      group: 'data',      defaultCollapsed: true },

    'limen-narrator-panel':     { label: 'NARRATOR',     group: 'narrator',  defaultCollapsed: false },
    'limen-systemic-panel':     { label: 'SYSTEMIC',     group: 'data',      defaultCollapsed: true },
    'limen-stress-strip':       { label: 'MARKET',       group: 'status',    defaultCollapsed: false },
    'limen-health-strip':       { label: 'HEALTH',       group: 'debug',     defaultCollapsed: true },
    'limen-connectome-map':     { label: 'DOMAIN MAP',   group: 'data',      defaultCollapsed: true },
    'limen-triage-panel':       { label: 'TRIAGE CARD',  group: 'triage',    defaultCollapsed: true },
    'limen-event-rail':         { label: 'EVENTS',       group: 'data',      defaultCollapsed: false },
    'limen-timeline-strip':     { label: 'TIMELINE',     group: 'data',      defaultCollapsed: false },
    'limen-investigation-drawer': { label: 'INVESTIGATE', group: 'triage',  defaultCollapsed: true }
  };

  // Which panels are visible per mode
  var MODE_VISIBILITY = {
    map: {
      'limen-global-state-badge': 'micro',
      'limen-domain-panel':       'hidden',

      'limen-narrator-panel':     'auto',
      'limen-systemic-panel':     'hidden',
      'limen-stress-strip':       'micro',
      'limen-health-strip':       'hidden',
      'limen-connectome-map':     'hidden',
      'limen-triage-panel':       'hidden',
      'limen-event-rail':         'micro',
      'limen-timeline-strip':     'hidden',
      'limen-investigation-drawer': 'hidden'
    },
    signals: {
      'limen-global-state-badge': 'visible',
      'limen-domain-panel':       'visible',

      'limen-narrator-panel':     'auto',
      'limen-systemic-panel':     'visible',
      'limen-stress-strip':       'visible',
      'limen-health-strip':       'hidden',
      'limen-connectome-map':     'hidden',
      'limen-triage-panel':       'hidden',
      'limen-event-rail':         'visible',
      'limen-timeline-strip':     'visible',
      'limen-investigation-drawer': 'auto'
    },
    triage: {
      'limen-global-state-badge': 'visible',
      'limen-domain-panel':       'micro',

      'limen-narrator-panel':     'visible',
      'limen-systemic-panel':     'visible',
      'limen-stress-strip':       'visible',
      'limen-health-strip':       'visible',
      'limen-connectome-map':     'hidden',
      'limen-triage-panel':       'auto',
      'limen-event-rail':         'visible',
      'limen-timeline-strip':     'visible',
      'limen-investigation-drawer': 'auto'
    }
  };

  // ─── State ──────────────────────────────────────────────────────────────

  var _mode = 'signals';
  var _pinned = {};          // panelId → true if user pinned
  var _manualHidden = {};    // panelId → true if user manually hid
  var _focusedNode = null;
  var _barEl = null;
  var _managerEl = null;
  var _managerOpen = false;
  var _microEls = {};        // panelId → micro-indicator element
  var _origStyles = {};      // panelId → original cssText snapshot

  // ─── Mode switching ─────────────────────────────────────────────────────

  function setMode(mode) {
    if (MODES.indexOf(mode) === -1) return;
    _mode = mode;
    _applyMode();
    _updateBar();
    _dispatch('limen:ui-mode-change', { mode: mode });
    // Persist user-chosen mode across navigation
    if (window.LIMENUIState) window.LIMENUIState.save({ uiMode: mode });
    _debugLog();
  }

  function getMode() {
    return _mode;
  }

  function _applyMode() {
    var vis = MODE_VISIBILITY[_mode] || {};
    var ps = window.LIMENPanelState;

    for (var panelId in PANELS) {
      var state = vis[panelId] || 'hidden';

      // Delegate to panel state manager if available
      if (ps && typeof ps.applyModeVisibility === 'function') {
        ps.applyModeVisibility(panelId, state);
      }

      // Skip pinned panels (check panel state manager first, fall back to local)
      var isPinned = ps ? ps.isPinned(panelId) : _pinned[panelId];
      if (isPinned) {
        _showPanel(panelId);
        _hideMicro(panelId);
        continue;
      }

      // Skip dismissed/snoozed panels (panel state manager authority)
      if (ps && !ps.isVisible(panelId)) {
        _hidePanel(panelId);
        _hideMicro(panelId);
        continue;
      }

      // Skip manually hidden panels (legacy fallback)
      if (!ps && _manualHidden[panelId]) {
        _hidePanel(panelId);
        continue;
      }

      if (state === 'visible') {
        _showPanel(panelId);
        _hideMicro(panelId);
      } else if (state === 'micro') {
        _hidePanel(panelId);
        _showMicro(panelId);
      } else if (state === 'auto') {
        // Auto: let the module control visibility, but ensure pointer safety
        _hideMicro(panelId);
      } else {
        _hidePanel(panelId);
        _hideMicro(panelId);
      }
    }

    // Connectome dimming in triage mode
    var canvas = document.getElementById('c');
    if (canvas) {
      canvas.style.opacity = (_mode === 'triage') ? '0.7' : '1';
      canvas.style.transition = 'opacity 0.5s ease';
    }
  }

  // ─── Panel show/hide ────────────────────────────────────────────────────

  function _showPanel(panelId) {
    var el = document.getElementById(panelId);
    if (!el) return;
    el.style.display = '';
    el.style.pointerEvents = 'auto';
    // Ensure panels don't have excessive z-index that blocks everything
    _ensurePointerSafety(el);
  }

  function _hidePanel(panelId) {
    var el = document.getElementById(panelId);
    if (!el) return;
    el.style.display = 'none';
  }

  function _ensurePointerSafety(el) {
    // Panels should only capture clicks inside their bounds
    // They should NOT have transparent regions blocking the canvas
    if (el.style.width === '100%' || el.style.width === '100vw') {
      el.style.width = 'auto';
    }
  }

  // ─── Micro indicators ──────────────────────────────────────────────────

  function _showMicro(panelId) {
    // DOMAINS micro indicator removed — global navigation now lives in the
    // top bar (assets/js/limen-topbar.js).
    if (panelId === 'limen-domain-panel') return;
    var micro = _microEls[panelId];
    if (!micro) {
      micro = _createMicro(panelId);
      if (!micro) return;
    }
    micro.style.display = 'block';
  }

  function _hideMicro(panelId) {
    var micro = _microEls[panelId];
    if (micro) micro.style.display = 'none';
  }

  function _createMicro(panelId) {
    var config = PANELS[panelId];
    if (!config) return null;

    var el = document.createElement('div');
    el.className = 'limen-micro-indicator';
    el.setAttribute('data-panel', panelId);

    var positions = {
      'limen-global-state-badge': 'top:8px;left:50%;transform:translateX(-50%)',
      'limen-domain-panel':       'top:60px;right:12px',

      'limen-systemic-panel':     'top:60px;left:12px',
      'limen-stress-strip':       'bottom:12px;left:12px',
      'limen-health-strip':       'bottom:12px;right:12px',
      'limen-triage-panel':       'bottom:60px;left:50%;transform:translateX(-50%)',
      'limen-connectome-map':     'bottom:60px;right:12px',
      'limen-event-rail':         'top:60px;left:50%;transform:translateX(-50%)',
      'limen-timeline-strip':     'bottom:28px;left:50%;transform:translateX(-50%)'
    };

    el.style.cssText = [
      'position:fixed',
      positions[panelId] || 'top:8px;left:8px',
      'background:rgba(8,9,12,0.85)',
      'border:1px solid rgba(201,169,78,0.12)',
      'padding:3px 8px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.40rem',
      'letter-spacing:1.5px',
      'color:rgba(201,169,78,0.4)',
      'z-index:9990',
      'border-radius:2px',
      'cursor:pointer',
      'pointer-events:auto',
      'display:none',
      'transition:background 0.2s'
    ].join(';');

    el.textContent = _getMicroText(panelId);

    el.addEventListener('mouseenter', function () {
      el.style.background = 'rgba(8,9,12,0.95)';
      el.style.borderColor = 'rgba(201,169,78,0.3)';
    });
    el.addEventListener('mouseleave', function () {
      el.style.background = 'rgba(8,9,12,0.85)';
      el.style.borderColor = 'rgba(201,169,78,0.12)';
    });

    // Click to expand the actual panel temporarily
    el.addEventListener('click', function () {
      var pid = el.getAttribute('data-panel');
      _showPanel(pid);
      _hideMicro(pid);
      // Auto-hide after 12 seconds unless pinned
      setTimeout(function () {
        if (!_pinned[pid]) {
          _applyMode();
        }
      }, 12000);
    });

    document.body.appendChild(el);
    _microEls[panelId] = el;
    return el;
  }

  function _getMicroText(panelId) {
    if (panelId === 'limen-global-state-badge') {
      var gs = window.LIMENGlobalState || {};
      return 'GLOBAL: ' + (gs.mode || 'STABLE').toUpperCase();
    }
    if (panelId === 'limen-domain-panel') {
      return 'DOMAINS (7)';
    }
    if (panelId === 'limen-stress-strip') {
      return 'MARKET';
    }
    var config = PANELS[panelId];
    return config ? config.label : panelId;
  }

  // Update micro indicator text periodically
  function _refreshMicros() {
    for (var pid in _microEls) {
      var el = _microEls[pid];
      if (el && el.style.display !== 'none') {
        el.textContent = _getMicroText(pid);
      }
    }
  }

  // ─── Node focus ─────────────────────────────────────────────────────────

  function _onNodeFocus(nodeId) {
    _focusedNode = nodeId;

    if (!nodeId) {
      // Returning from focus — restore mode
      _applyMode();
      _debugLog();
      return;
    }

    // Minimize non-essential panels during focus
    for (var panelId in PANELS) {
      if (panelId === 'limen-narrator-panel') continue;
      if (_pinned[panelId]) continue;
      _hidePanel(panelId);
      _hideMicro(panelId);
    }
    _debugLog();
  }

  // Listen for node clicks from connectome
  function _hookNodeClicks() {
    // The connectome dispatches click via onNodeClick callback
    // We listen for a custom event instead
    window.addEventListener('limen:node-selected', function (e) {
      var detail = e.detail || {};
      _onNodeFocus(detail.nodeId || null);
    });

    // Also hook canvas clicks to detect deselect
    var canvas = document.getElementById('c');
    if (canvas) {
      canvas.addEventListener('click', function (e) {
        // Short delay to let connectome process the click first
        setTimeout(function () {
          // Check if connectome has a selected node
          // If not, clear our focus
          _dispatch('limen:node-focus-check', {});
        }, 100);
      });
    }
  }

  // ─── Toggle bar ─────────────────────────────────────────────────────────

  function _createBar() {
    if (_barEl) return;
    _barEl = document.createElement('div');
    _barEl.id = 'limen-mode-bar';
    _barEl.style.cssText = [
      'position:fixed',
      'bottom:4px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(8,9,12,0.88)',
      'border:1px solid rgba(201,169,78,0.12)',
      'padding:4px 6px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.42rem',
      'letter-spacing:1.5px',
      'z-index:9998',
      'border-radius:2px',
      'pointer-events:auto',
      'display:flex',
      'gap:2px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
    ].join(';');

    var buttons = [
      { id: 'map',     label: 'MAP' },
      { id: 'signals', label: 'SIGNALS' },
      { id: 'triage',  label: 'TRIAGE' },
      { id: 'panels',  label: 'PANELS' },
      { id: 'reset',   label: 'RESET' }
    ];

    for (var i = 0; i < buttons.length; i++) {
      var btn = document.createElement('button');
      btn.setAttribute('data-action', buttons[i].id);
      btn.textContent = buttons[i].label;
      btn.style.cssText = [
        'background:rgba(201,169,78,0.06)',
        'border:1px solid rgba(201,169,78,0.12)',
        'color:rgba(201,169,78,0.5)',
        'font-family:"IBM Plex Mono",monospace',
        'font-size:0.42rem',
        'letter-spacing:1.5px',
        'padding:3px 8px',
        'cursor:pointer',
        'border-radius:2px',
        'transition:background 0.2s,color 0.2s,border-color 0.2s'
      ].join(';');

      btn.addEventListener('mouseenter', function () {
        this.style.background = 'rgba(201,169,78,0.15)';
        this.style.borderColor = 'rgba(201,169,78,0.3)';
      });
      btn.addEventListener('mouseleave', function () {
        var act = this.getAttribute('data-action');
        var isActive = (act === _mode);
        this.style.background = isActive ? 'rgba(201,169,78,0.12)' : 'rgba(201,169,78,0.06)';
        this.style.borderColor = isActive ? 'rgba(201,169,78,0.25)' : 'rgba(201,169,78,0.12)';
      });

      btn.addEventListener('click', function () {
        var act = this.getAttribute('data-action');
        if (act === 'panels') {
          _toggleManager();
        } else if (act === 'reset') {
          _resetView();
        } else {
          setMode(act);
        }
      });

      _barEl.appendChild(btn);
    }

    document.body.appendChild(_barEl);
    _updateBar();
  }

  function _updateBar() {
    if (!_barEl) return;
    var buttons = _barEl.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var act = buttons[i].getAttribute('data-action');
      var isActive = (act === _mode);
      buttons[i].style.background = isActive ? 'rgba(201,169,78,0.12)' : 'rgba(201,169,78,0.06)';
      buttons[i].style.color = isActive ? 'rgba(201,169,78,0.8)' : 'rgba(201,169,78,0.5)';
      buttons[i].style.borderColor = isActive ? 'rgba(201,169,78,0.25)' : 'rgba(201,169,78,0.12)';
    }
  }

  // ─── Panel manager overlay ──────────────────────────────────────────────

  function _toggleManager() {
    _managerOpen = !_managerOpen;
    if (_managerOpen) {
      _showManager();
    } else {
      _hideManager();
    }
  }

  function _showManager() {
    if (!_managerEl) {
      _managerEl = document.createElement('div');
      _managerEl.id = 'limen-panel-manager';
      _managerEl.style.cssText = [
        'position:fixed',
        'bottom:36px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(8,9,12,0.95)',
        'border:1px solid rgba(201,169,78,0.2)',
        'padding:10px 14px',
        'font-family:"IBM Plex Mono",monospace',
        'font-size:0.42rem',
        'letter-spacing:1.2px',
        'z-index:9999',
        'border-radius:2px',
        'pointer-events:auto',
        'box-shadow:0 4px 16px rgba(0,0,0,0.6)',
        'min-width:200px'
      ].join(';');
      document.body.appendChild(_managerEl);
    }
    _renderManager();
    _managerEl.style.display = 'block';
  }

  function _hideManager() {
    if (_managerEl) _managerEl.style.display = 'none';
    _managerOpen = false;
  }

  function _renderManager() {
    if (!_managerEl) return;

    var gold = 'rgba(201,169,78,0.5)';
    var teal = '#5ab5a0';
    var dim = 'rgba(200,195,184,0.4)';

    var html = '<div style="color:' + gold + ';font-size:0.45rem;margin-bottom:6px;letter-spacing:2px">PANEL MANAGER</div>';

    var panelIds = Object.keys(PANELS);
    for (var i = 0; i < panelIds.length; i++) {
      var pid = panelIds[i];
      var config = PANELS[pid];
      var el = document.getElementById(pid);
      var isVisible = el && el.style.display !== 'none';
      var ps = window.LIMENPanelState;
      var isPinned = ps ? ps.isPinned(pid) : !!_pinned[pid];

      var toggleColor = isVisible ? teal : dim;
      var toggleSymbol = isVisible ? '+' : '-';
      var pinLabel = isPinned ? ' [pinned]' : '';

      html += '<div style="margin:2px 0;display:flex;justify-content:space-between;align-items:center">';
      html += '<span style="color:' + toggleColor + ';cursor:pointer" data-toggle="' + pid + '">';
      html += '[' + toggleSymbol + '] ' + config.label;
      html += '</span>';
      html += '<span style="color:' + dim + ';cursor:pointer;font-size:0.38rem" data-pin="' + pid + '">' + (isPinned ? 'unpin' : 'pin') + '</span>';
      html += '</div>';
    }

    _managerEl.innerHTML = html;

    // Bind toggle clicks
    var toggles = _managerEl.querySelectorAll('[data-toggle]');
    for (var t = 0; t < toggles.length; t++) {
      toggles[t].addEventListener('click', function () {
        var pid = this.getAttribute('data-toggle');
        var ps = window.LIMENPanelState;
        var el = document.getElementById(pid);
        if (el && el.style.display !== 'none') {
          if (ps) { ps.dismiss(pid); } else { _manualHidden[pid] = true; }
          _hidePanel(pid);
        } else {
          if (ps) { ps.restore(pid); } else { delete _manualHidden[pid]; }
          _showPanel(pid);
        }
        _renderManager();
      });
    }

    // Bind pin clicks
    var pins = _managerEl.querySelectorAll('[data-pin]');
    for (var p = 0; p < pins.length; p++) {
      pins[p].addEventListener('click', function () {
        var pid = this.getAttribute('data-pin');
        var ps = window.LIMENPanelState;
        if (ps) {
          if (ps.isPinned(pid)) { ps.unpin(pid); }
          else { ps.pin(pid); }
        } else {
          if (_pinned[pid]) { delete _pinned[pid]; }
          else { _pinned[pid] = true; delete _manualHidden[pid]; }
        }
        _renderManager();
        _applyMode();
      });
    }
  }

  // ─── Reset view ─────────────────────────────────────────────────────────

  function _resetView() {
    _focusedNode = null;
    _pinned = {};
    _manualHidden = {};
    var ps = window.LIMENPanelState;
    if (ps && typeof ps.restoreAll === 'function') ps.restoreAll();
    _hideManager();
    _applyMode();
    _debugLog();
  }

  // ─── Pointer safety ────────────────────────────────────────────────────

  function _enforcePointerSafety() {
    // Ensure all panels only capture events within their visual bounds
    // Sync pointer-events with actual display state
    var allPanels = document.querySelectorAll('[id^="limen-"]');
    for (var i = 0; i < allPanels.length; i++) {
      var el = allPanels[i];
      // Skip the mode bar, manager, and command bar (they manage their own pointer state)
      if (el.id === 'limen-mode-bar' || el.id === 'limen-panel-manager') continue;
      if (el.id.indexOf('limen-command') === 0) continue;
      if (el.id === 'limen-investigation-drawer') continue;
      // Hidden panels don't need pointer events; visible panels must have them
      if (el.style.display === 'none') {
        el.style.pointerEvents = 'none';
      } else {
        el.style.pointerEvents = 'auto';
      }
    }
  }

  // ─── Debug log ──────────────────────────────────────────────────────────

  function _debugLog() {
    var openPanels = [];
    for (var pid in PANELS) {
      var el = document.getElementById(pid);
      if (el && el.style.display !== 'none') {
        openPanels.push(PANELS[pid].label);
      }
    }
    console.log(
      '[LIMEN UI] mode=' + _mode +
      ' | panels=' + (openPanels.length > 0 ? openPanels.join(', ') : 'none') +
      ' | focus=' + (_focusedNode || 'none') +
      ' | pointer-safe=active'
    );
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    // Restore user-chosen mode from prior navigation
    if (window.LIMENUIState) {
      var saved = window.LIMENUIState.restore({ samePageType: true });
      if (saved && saved.uiMode && MODES.indexOf(saved.uiMode) !== -1) {
        _mode = saved.uiMode;
      }
    }

    _createBar();
    _hookNodeClicks();

    // Initial mode application with delay to let panels render first
    setTimeout(function () {
      _applyMode();
      _updateBar();
      _enforcePointerSafety();
      _debugLog();
    }, 2000);

    // Periodic micro-indicator refresh
    setInterval(function () {
      _refreshMicros();
      _enforcePointerSafety();
    }, 8000);

    // Close panel manager on outside click
    document.addEventListener('click', function (e) {
      if (!_managerOpen) return;
      if (_managerEl && _managerEl.contains(e.target)) return;
      if (_barEl && _barEl.contains(e.target)) return;
      _hideManager();
    });
  }

  function stop() {
    if (_barEl && _barEl.parentNode) _barEl.parentNode.removeChild(_barEl);
    if (_managerEl && _managerEl.parentNode) _managerEl.parentNode.removeChild(_managerEl);
    for (var pid in _microEls) {
      if (_microEls[pid] && _microEls[pid].parentNode) {
        _microEls[pid].parentNode.removeChild(_microEls[pid]);
      }
    }
    _barEl = null;
    _managerEl = null;
    _microEls = {};
    // Restore all panels to visible
    for (var p in PANELS) {
      _showPanel(p);
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENUIMode = {
    setMode: setMode,
    getMode: getMode,
    resetView: _resetView,
    focusNode: _onNodeFocus
  };

  window.LIMENUIModeManager = {
    start: start,
    stop: stop
  };

})();
