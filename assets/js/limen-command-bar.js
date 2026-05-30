/**
 * limen-command-bar.js
 * LIMEN HELIX — Global Command Palette
 *
 * Command bar for fast navigation and system control. Invoke programmatically
 * via window.LIMENCommandBar.open() — keyboard binding removed.
 * Fuzzy search, arrow key navigation, enter to execute, escape to close.
 *
 * Provides: window.LIMENCommandBar
 * Load order: after all advisory modules, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────────

  var _overlayEl = null;
  var _inputEl = null;
  var _listEl = null;
  var _isOpen = false;
  var _results = [];
  var _selectedIdx = 0;

  // ─── Command registry ──────────────────────────────────────────────────

  var COMMANDS = [
    // Navigation
    { id: 'nav-console',      label: 'Go Console',              category: 'Navigation',    keywords: 'go console home civilization' },
    { id: 'nav-connectome',   label: 'Go Connectome',           category: 'Navigation',    keywords: 'go connectome galaxy map atlas' },
    { id: 'open-signals',     label: 'Open Signals Mode',       category: 'Navigation',    keywords: 'open signals mode view' },
    { id: 'open-triage',      label: 'Open Triage Mode',        category: 'Navigation',    keywords: 'open triage crisis mode' },
    { id: 'open-map',         label: 'Open Map Mode',           category: 'Navigation',    keywords: 'open map explore mode' },
    { id: 'open-panels',      label: 'Open Panel Manager',      category: 'Navigation',    keywords: 'open panels manager toggle' },

    // System
    { id: 'reset-feeds',      label: 'Reset Feeds',             category: 'System',        keywords: 'reset feeds refresh data' },
    { id: 'refresh-snapshot',  label: 'Refresh Snapshot',        category: 'System',        keywords: 'refresh snapshot feed reload' },
    { id: 'show-feed-health',  label: 'Show Feed Health',        category: 'System',        keywords: 'show feed health status' },
    { id: 'show-panel-state',  label: 'Show Panel State',        category: 'System',        keywords: 'show panel state dump debug' },
    { id: 'show-system-health',label: 'Show System Health',      category: 'System',        keywords: 'show system health monitor status' },
    { id: 'show-snapshot',     label: 'Show Snapshot',           category: 'System',        keywords: 'show snapshot data dump' },
    { id: 'reset-view',       label: 'Reset View',              category: 'System',        keywords: 'reset view panels restore default' },

    // Investigations
    { id: 'inv-energy',       label: 'Investigate Energy',      category: 'Investigation', keywords: 'investigate energy domain' },
    { id: 'inv-economy',      label: 'Investigate Economy',     category: 'Investigation', keywords: 'investigate economy domain' },
    { id: 'inv-supply',       label: 'Investigate Supply Chain', category: 'Investigation', keywords: 'investigate supply chain logistics trade' },
    { id: 'inv-environment',  label: 'Investigate Environment', category: 'Investigation', keywords: 'investigate environment climate' },
    { id: 'inv-technology',   label: 'Investigate Technology',  category: 'Investigation', keywords: 'investigate technology tech' },
    { id: 'inv-health',       label: 'Investigate Health',      category: 'Investigation', keywords: 'investigate health medicine' },
    { id: 'inv-governance',   label: 'Investigate Governance',  category: 'Investigation', keywords: 'investigate governance politics' },
    { id: 'inv-finance',      label: 'Investigate Finance',     category: 'Investigation', keywords: 'investigate finance banking capital' },

    // Nodes
    { id: 'focus-governance',  label: 'Focus Node: Governance',  category: 'Nodes',         keywords: 'focus node governance' },
    { id: 'focus-economy',     label: 'Focus Node: Economy',     category: 'Nodes',         keywords: 'focus node economy' },
    { id: 'focus-infrastructure',label:'Focus Node: Infrastructure',category:'Nodes',        keywords: 'focus node infrastructure infra' },
    { id: 'focus-energy',      label: 'Focus Node: Energy',      category: 'Nodes',         keywords: 'focus node energy power' },
    { id: 'focus-agriculture', label: 'Focus Node: Agriculture', category: 'Nodes',         keywords: 'focus node agriculture farming' },
    { id: 'focus-industry',    label: 'Focus Node: Industry',    category: 'Nodes',         keywords: 'focus node industry manufacturing' },
    { id: 'focus-science',     label: 'Focus Node: Science',     category: 'Nodes',         keywords: 'focus node science research' },
    { id: 'focus-medicine',    label: 'Focus Node: Medicine',    category: 'Nodes',         keywords: 'focus node medicine health' },
    { id: 'focus-education',   label: 'Focus Node: Education',   category: 'Nodes',         keywords: 'focus node education' },
    { id: 'focus-technology',  label: 'Focus Node: Technology',  category: 'Nodes',         keywords: 'focus node technology tech' },
    { id: 'focus-communication',label:'Focus Node: Communication',category:'Nodes',          keywords: 'focus node communication comms' },
    { id: 'focus-culture',     label: 'Focus Node: Culture',     category: 'Nodes',         keywords: 'focus node culture arts' },
    { id: 'focus-defense',     label: 'Focus Node: Defense',     category: 'Nodes',         keywords: 'focus node defense military' },
    { id: 'focus-environment', label: 'Focus Node: Environment', category: 'Nodes',         keywords: 'focus node environment climate' },
    { id: 'focus-religion',    label: 'Focus Node: Religion',    category: 'Nodes',         keywords: 'focus node religion spiritual' },
    { id: 'focus-population',  label: 'Focus Node: Population',  category: 'Nodes',         keywords: 'focus node population demographics' },
    { id: 'focus-trade',       label: 'Focus Node: Trade',       category: 'Nodes',         keywords: 'focus node trade logistics' },
    { id: 'focus-law',         label: 'Focus Node: Law',         category: 'Nodes',         keywords: 'focus node law regulation' },
    { id: 'focus-finance',     label: 'Focus Node: Finance',     category: 'Nodes',         keywords: 'focus node finance banking' },
    { id: 'focus-intelligence',label: 'Focus Node: Intelligence',category: 'Nodes',         keywords: 'focus node intelligence data' }
  ];

  // ─── Fuzzy search ──────────────────────────────────────────────────────

  function _fuzzyMatch(query, text) {
    query = query.toLowerCase();
    text = text.toLowerCase();
    if (text.indexOf(query) !== -1) return 2;
    var qi = 0;
    for (var ti = 0; ti < text.length && qi < query.length; ti++) {
      if (text[ti] === query[qi]) qi++;
    }
    return qi === query.length ? 1 : 0;
  }

  function _search(query) {
    if (!query || query.length === 0) {
      return COMMANDS.slice(0, 12);
    }
    var scored = [];
    for (var i = 0; i < COMMANDS.length; i++) {
      var cmd = COMMANDS[i];
      var labelScore = _fuzzyMatch(query, cmd.label);
      var kwScore = _fuzzyMatch(query, cmd.keywords);
      var catScore = _fuzzyMatch(query, cmd.category);
      var best = Math.max(labelScore, kwScore, catScore);
      if (best > 0) {
        scored.push({ cmd: cmd, score: best, labelScore: labelScore });
      }
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.labelScore - a.labelScore;
    });
    var out = [];
    for (var i = 0; i < Math.min(scored.length, 12); i++) {
      out.push(scored[i].cmd);
    }
    return out;
  }

  // ─── Command execution ─────────────────────────────────────────────────

  function _execute(cmd) {
    _close();

    switch (cmd.id) {
      // Navigation
      case 'nav-console':
        window.location.href = '/civilization.html';
        break;
      case 'nav-connectome':
        if (window.LIMENUIState) window.LIMENUIState.setConnectomeContext({});
        else sessionStorage.setItem('limen_connectome_context', '{}');
        window.location.href = '/connectome.html';
        break;
      case 'open-signals':
        if (window.LIMENUIMode) window.LIMENUIMode.setMode('signals');
        break;
      case 'open-triage':
        if (window.LIMENUIMode) window.LIMENUIMode.setMode('triage');
        break;
      case 'open-map':
        if (window.LIMENUIMode) window.LIMENUIMode.setMode('map');
        break;
      case 'open-panels':
        // Toggle panel manager via the mode bar button
        var panelBtn = document.querySelector('#limen-mode-bar [data-action="panels"]');
        if (panelBtn) panelBtn.click();
        break;

      // System
      case 'reset-feeds':
        if (window.LIMENFeedState && window.LIMENFeedState.reset) window.LIMENFeedState.reset();
        console.log('[LIMEN CMD] Feeds reset');
        break;
      case 'refresh-snapshot':
        if (window.LIMENFeedState && window.LIMENFeedState.refresh) window.LIMENFeedState.refresh();
        console.log('[LIMEN CMD] Snapshot refreshed');
        break;
      case 'show-feed-health':
        if (window.LIMENFeedState) console.log('[LIMEN CMD] Feed State:', JSON.stringify(window.LIMENFeedState, null, 2));
        break;
      case 'show-panel-state':
        if (window.LIMENPanelState && window.LIMENPanelState.dump) {
          console.log('[LIMEN CMD] Panel State:', JSON.stringify(window.LIMENPanelState.dump(), null, 2));
        }
        break;
      case 'show-system-health':
        if (window.LIMENSelfHealth) console.log('[LIMEN CMD] System Health:', JSON.stringify(window.LIMENSelfHealth, null, 2));
        break;
      case 'show-snapshot':
        if (window.LIMENFeedState && window.LIMENFeedState.getSnapshot) {
          console.log('[LIMEN CMD] Snapshot:', JSON.stringify(window.LIMENFeedState.getSnapshot(), null, 2));
        }
        break;
      case 'reset-view':
        if (window.LIMENUIMode) window.LIMENUIMode.resetView();
        break;

      default:
        // Investigation commands
        if (cmd.id.indexOf('inv-') === 0) {
          var domain = cmd.id.slice(4);
          if (domain === 'supply') domain = 'supplyChain';
          _triggerInvestigation(domain);
        }
        // Focus node commands
        if (cmd.id.indexOf('focus-') === 0) {
          var nodeId = cmd.id.slice(6);
          _triggerFocusNode(nodeId);
        }
        break;
    }
  }

  function _triggerInvestigation(domain) {
    try {
      window.dispatchEvent(new CustomEvent('limen:investigate-request', { detail: { domain: domain } }));
    } catch (e) { /* silent */ }
    console.log('[LIMEN CMD] Investigation requested: ' + domain);
  }

  function _triggerFocusNode(nodeId) {
    // Navigate to connectome with focus
    if (window.LIMENUIState) {
      window.LIMENUIState.setConnectomeContext({ focusDomain: nodeId });
    } else {
      sessionStorage.setItem('limen_connectome_context', JSON.stringify({ focusDomain: nodeId }));
    }
    window.location.href = '/connectome.html';
  }

  // ─── DOM ────────────────────────────────────────────────────────────────

  function _createOverlay() {
    if (_overlayEl) return;

    _overlayEl = document.createElement('div');
    _overlayEl.id = 'limen-command-overlay';
    _overlayEl.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'background:rgba(3,5,10,0.88)',
      'display:none',
      'justify-content:center',
      'align-items:flex-start',
      'padding-top:min(18vh,140px)'
    ].join(';');

    var modal = document.createElement('div');
    modal.id = 'limen-command-modal';
    modal.style.cssText = [
      'width:min(520px,90vw)',
      'background:rgba(8,10,16,0.96)',
      'border:1px solid rgba(201,169,78,0.15)',
      'border-radius:4px',
      'box-shadow:0 8px 40px rgba(0,0,0,0.6)',
      'overflow:hidden',
      'font-family:"IBM Plex Mono",monospace'
    ].join(';');

    // Input row
    var inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(201,169,78,0.08)';

    var prefix = document.createElement('span');
    prefix.style.cssText = 'color:rgba(201,169,78,0.4);font-size:0.55rem;letter-spacing:2px;margin-right:8px';
    prefix.textContent = '>';

    _inputEl = document.createElement('input');
    _inputEl.type = 'text';
    _inputEl.placeholder = 'Type a command...';
    _inputEl.style.cssText = [
      'flex:1',
      'background:none',
      'border:none',
      'outline:none',
      'color:rgba(200,195,184,0.85)',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.65rem',
      'letter-spacing:0.5px',
      'caret-color:rgba(201,169,78,0.6)'
    ].join(';');

    var hint = document.createElement('span');
    hint.style.cssText = 'color:rgba(200,195,184,0.2);font-size:0.38rem;letter-spacing:1px;margin-left:8px';
    hint.textContent = 'ESC';

    inputWrap.appendChild(prefix);
    inputWrap.appendChild(_inputEl);
    inputWrap.appendChild(hint);

    // Results list
    _listEl = document.createElement('div');
    _listEl.id = 'limen-command-results';
    _listEl.style.cssText = 'max-height:min(360px,50vh);overflow-y:auto;padding:4px 0;scrollbar-width:thin;scrollbar-color:rgba(201,169,78,0.1) transparent';

    modal.appendChild(inputWrap);
    modal.appendChild(_listEl);
    _overlayEl.appendChild(modal);
    document.body.appendChild(_overlayEl);

    // Events
    _inputEl.addEventListener('input', function () {
      _selectedIdx = 0;
      _renderResults();
    });

    _inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _selectedIdx = Math.min(_selectedIdx + 1, _results.length - 1);
        _renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _selectedIdx = Math.max(_selectedIdx - 1, 0);
        _renderResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_results[_selectedIdx]) {
          _execute(_results[_selectedIdx]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        _close();
      }
    });

    _overlayEl.addEventListener('click', function (e) {
      if (e.target === _overlayEl) _close();
    });
  }

  function _renderResults() {
    var query = _inputEl ? _inputEl.value.trim() : '';
    _results = _search(query);

    var gold = 'rgba(201,169,78,';
    var dim = 'rgba(200,195,184,';
    var teal = 'rgba(90,181,160,';

    var html = '';
    var lastCat = '';

    for (var i = 0; i < _results.length; i++) {
      var cmd = _results[i];
      var isSelected = i === _selectedIdx;

      if (cmd.category !== lastCat) {
        lastCat = cmd.category;
        html += '<div style="padding:6px 16px 2px;font-size:0.36rem;letter-spacing:2px;color:' + gold + '0.3);text-transform:uppercase">' + cmd.category + '</div>';
      }

      var bg = isSelected ? 'rgba(201,169,78,0.06)' : 'transparent';
      var border = isSelected ? '1px solid rgba(201,169,78,0.1)' : '1px solid transparent';
      var textColor = isSelected ? dim + '0.9)' : dim + '0.55)';

      html += '<div class="limen-cmd-item" data-idx="' + i + '" style="' +
        'padding:7px 16px;' +
        'margin:1px 4px;' +
        'border-radius:2px;' +
        'background:' + bg + ';' +
        'border:' + border + ';' +
        'cursor:pointer;' +
        'font-size:0.50rem;' +
        'letter-spacing:0.8px;' +
        'color:' + textColor + ';' +
        'transition:background 0.15s' +
      '">' + cmd.label + '</div>';
    }

    if (_results.length === 0) {
      html = '<div style="padding:16px;text-align:center;font-size:0.42rem;color:' + dim + '0.3)">No matching commands</div>';
    }

    _listEl.innerHTML = html;

    // Bind clicks
    var items = _listEl.querySelectorAll('.limen-cmd-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'));
        if (_results[idx]) _execute(_results[idx]);
      });
      items[j].addEventListener('mouseenter', function () {
        _selectedIdx = parseInt(this.getAttribute('data-idx'));
        _renderResults();
      });
    }

    // Scroll selected into view
    var sel = _listEl.querySelector('[data-idx="' + _selectedIdx + '"]');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  // ─── Open / Close ──────────────────────────────────────────────────────

  function _open() {
    if (_isOpen) return;
    _createOverlay();
    _isOpen = true;
    _overlayEl.style.display = 'flex';
    _overlayEl.style.pointerEvents = 'auto';
    _inputEl.value = '';
    _selectedIdx = 0;
    _renderResults();
    // Focus input — use rAF + setTimeout to ensure overlay is painted first
    requestAnimationFrame(function () {
      setTimeout(function () {
        if (_inputEl) _inputEl.focus();
      }, 0);
    });
  }

  function _close() {
    if (!_isOpen) return;
    _isOpen = false;
    if (_inputEl) _inputEl.blur();
    if (_overlayEl) {
      _overlayEl.style.display = 'none';
      _overlayEl.style.pointerEvents = 'none';
    }
  }

  function toggle() {
    if (_isOpen) _close(); else _open();
  }

  // ─── Keyboard shortcut ─────────────────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    // Escape closes (Ctrl+K binding removed — invoke via window.LIMENCommandBar.open()).
    if (e.key === 'Escape' && _isOpen) {
      e.preventDefault();
      _close();
    }
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  function start() {
    _createOverlay();
    console.log('[LIMEN] command-bar: ready');
  }

  function stop() {
    _close();
    if (_overlayEl && _overlayEl.parentNode) _overlayEl.parentNode.removeChild(_overlayEl);
    _overlayEl = null;
    _inputEl = null;
    _listEl = null;
  }

  // ─── Public API ────────────────────────────────────────────────────────

  window.LIMENCommandBar = {
    start: start,
    stop: stop,
    open: _open,
    close: _close,
    toggle: toggle,
    isOpen: function () { return _isOpen; }
  };

})();
