/**
 * timeline-engine.js
 * LIMEN HELIX — Timeline & Trend Memory
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Maintains a rolling operational history of domain states, events,
 * global state shifts, balance changes, and user actions.
 * Provides temporal context so LIMEN can reference time progression.
 *
 * Depends on: window.LIMENDomains, window.LIMENEvents,
 *             window.LIMENGlobalState, window.LIMENBalance
 * Listens: limen:domain-update, limen:balance-update,
 *          limen:global-state-update, limen:event-start,
 *          limen:event-update, limen:event-end, limen:user-action
 * Emits: limen:timeline-update
 * Output: window.LIMENTimeline
 *
 * Load order: after event-engine.js
 */

(function () {
  'use strict';

  var MAX_ENTRIES = 500;
  var EMIT_MS = 10000;
  var WINDOW_15M = 15 * 60 * 1000;
  var WINDOW_1H = 60 * 60 * 1000;
  var WINDOW_24H = 24 * 60 * 60 * 1000;
  var SNAPSHOT_INTERVAL = 60000; // domain snapshot every 60s

  // ─── State ──────────────────────────────────────────────────────────────

  var _entries = [];
  var _interval = null;
  var _lastSnapshot = 0;
  var _panelEl = null;
  var _expanded = false;

  // ─── Entry recording ───────────────────────────────────────────────────

  function _record(type, label, data) {
    var entry = {
      timestamp: Date.now(),
      type: type,
      label: label,
      severity: data.severity || data.score || data.stress || 0,
      domains: data.domains || (data.domain ? [data.domain] : []),
      confidence: data.confidence || 0
    };
    _entries.push(entry);
    if (_entries.length > MAX_ENTRIES) _entries.shift();
  }

  // ─── Event listeners ───────────────────────────────────────────────────

  function _onDomainUpdate(e) {
    var now = Date.now();
    // Only snapshot domains periodically to avoid flooding
    if (now - _lastSnapshot < SNAPSHOT_INTERVAL) return;
    _lastSnapshot = now;

    var detail = e.detail || {};
    var domains = detail.domains || window.LIMENDomains || {};
    var KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      var d = domains[k];
      if (!d || d.stress < 0.15) continue;
      _record('domain-state', k + ' stress ' + _pct(d.stress), {
        severity: d.stress,
        domain: k,
        confidence: d.confidence || 0
      });
    }
  }

  function _onBalanceUpdate(e) {
    var detail = e.detail;
    if (!detail || !detail.domain) return;
    // Only record material balance changes
    if (detail.state === 'neutral') return;
    _record('balance-change', detail.domain + ' ' + detail.state, {
      severity: Math.abs(detail.net || 0),
      domain: detail.domain,
      confidence: 0.7
    });
  }

  function _onGlobalStateUpdate(e) {
    var detail = e.detail;
    if (!detail) return;
    // Only record on mode change — compare with last global-state entry
    var lastGS = _findLast('global-state');
    if (lastGS && lastGS.label === 'global: ' + detail.mode) return;
    _record('global-state', 'global: ' + detail.mode, {
      score: detail.score || 0,
      confidence: detail.confidence || 0
    });
  }

  function _onEventStart(e) {
    var evt = e.detail;
    if (!evt) return;
    _record('event-start', evt.type, {
      severity: evt.severity,
      domains: evt.domains,
      confidence: evt.confidence
    });
  }

  function _onEventUpdate(e) {
    var evt = e.detail;
    if (!evt) return;
    // Only record significant severity changes (>5%)
    var last = _findLastByLabel('event-update', evt.type);
    if (last && Math.abs((last.severity || 0) - (evt.severity || 0)) < 0.05) return;
    _record('event-update', evt.type, {
      severity: evt.severity,
      domains: evt.domains,
      confidence: evt.confidence
    });
  }

  function _onEventEnd(e) {
    var evt = e.detail;
    if (!evt) return;
    _record('event-end', evt.type, {
      severity: evt.severity || 0,
      domains: evt.domains || [],
      confidence: evt.confidence || 0
    });
  }

  function _onUserAction(e) {
    var detail = e.detail;
    if (!detail) return;
    _record('user-action', detail.action || 'interaction', {
      domain: detail.domain || null,
      confidence: 1
    });
  }

  // ─── Query helpers ─────────────────────────────────────────────────────

  function _getWindow(ms) {
    var cutoff = Date.now() - ms;
    var result = [];
    for (var i = _entries.length - 1; i >= 0; i--) {
      if (_entries[i].timestamp < cutoff) break;
      result.unshift(_entries[i]);
    }
    return result;
  }

  function _findLast(type) {
    for (var i = _entries.length - 1; i >= 0; i--) {
      if (_entries[i].type === type) return _entries[i];
    }
    return null;
  }

  function _findLastByLabel(type, label) {
    for (var i = _entries.length - 1; i >= 0; i--) {
      if (_entries[i].type === type && _entries[i].label === label) return _entries[i];
    }
    return null;
  }

  function _getEventDuration(eventType) {
    // Find first event-start for this type that hasn't ended
    var startTime = null;
    var ended = false;
    for (var i = 0; i < _entries.length; i++) {
      if (_entries[i].type === 'event-start' && _entries[i].label === eventType) {
        startTime = _entries[i].timestamp;
        ended = false;
      }
      if (_entries[i].type === 'event-end' && _entries[i].label === eventType) {
        ended = true;
      }
    }
    if (!startTime || ended) return null;
    return Date.now() - startTime;
  }

  function _getTrend(domainKey, windowMs) {
    var cutoff = Date.now() - (windowMs || WINDOW_15M);
    var entries = [];
    for (var i = _entries.length - 1; i >= 0; i--) {
      if (_entries[i].timestamp < cutoff) break;
      if (_entries[i].type === 'domain-state' && _entries[i].label.indexOf(domainKey) === 0) {
        entries.unshift(_entries[i]);
      }
    }
    if (entries.length < 2) return 'insufficient data';
    var first = entries[0].severity;
    var last = entries[entries.length - 1].severity;
    var diff = last - first;
    if (diff > 0.05) return 'rising';
    if (diff < -0.05) return 'falling';
    return 'stable';
  }

  // ─── Publish ───────────────────────────────────────────────────────────

  function _publish() {
    var now = Date.now();
    var timeline = {
      entries: _entries,
      count: _entries.length,
      last15m: _getWindow(WINDOW_15M),
      last1h: _getWindow(WINDOW_1H),
      updated: now,
      // Convenience methods
      getEventDuration: _getEventDuration,
      getTrend: _getTrend,
      getWindow: _getWindow
    };

    window.LIMENTimeline = timeline;
    _dispatch('limen:timeline-update', {
      count: _entries.length,
      recent: _entries.slice(-5),
      updated: now
    });

    // Persist timeline for refresh survival
    var store = window.LIMENFeedStore;
    if (store) store.saveTimeline(_entries);

    _renderPanel();
  }

  // ─── UI: compact timeline strip ────────────────────────────────────────

  function _ensurePanel() {
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'limen-timeline-strip';
    _panelEl.style.cssText = [
      'position:fixed',
      'bottom:28px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(8,9,12,0.90)',
      'border:1px solid rgba(201,169,78,0.12)',
      'padding:4px 10px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.40rem',
      'letter-spacing:1.2px',
      'z-index:9993',
      'border-radius:2px',
      'pointer-events:auto',
      'box-shadow:0 2px 6px rgba(0,0,0,0.4)',
      'line-height:1.6',
      'display:none',
      'max-width:500px',
      'cursor:pointer',
      'transition:max-height 0.3s ease'
    ].join(';');

    _panelEl.addEventListener('click', function (e) {
      // Don't toggle if clicking inside expanded content links
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
      _expanded = !_expanded;
      _renderPanel();
    });

    document.body.appendChild(_panelEl);
  }

  function _renderPanel() {
    _ensurePanel();

    if (_entries.length === 0) {
      _panelEl.style.display = 'none';
      return;
    }

    var gold = 'rgba(201,169,78,0.4)';
    var teal = '#5ab5a0';
    var red = '#e85454';
    var orange = '#d4a44e';
    var dimText = 'rgba(200,195,184,0.45)';
    var dim = 'rgba(201,169,78,0.3)';

    var recent = _entries.slice(-10);
    var html = '';

    if (!_expanded) {
      // Compact: show last 3 significant entries as a ticker
      var significant = _getSignificant(5);
      html += '<span style="color:' + gold + ';font-size:0.38rem;letter-spacing:2px">TIMELINE</span> ';
      for (var i = 0; i < Math.min(significant.length, 3); i++) {
        var e = significant[i];
        var col = _entryColor(e, teal, orange, red);
        var age = _age(e.timestamp);
        html += '<span style="color:' + col + ';margin-left:6px">';
        html += _typeIcon(e.type) + ' ' + _truncate(e.label, 20);
        html += '</span>';
        html += '<span style="color:' + dim + ';font-size:0.36rem"> ' + age + '</span>';
      }
      if (significant.length === 0) {
        html += '<span style="color:' + dimText + '">no recent activity</span>';
      }
    } else {
      // Expanded: show last 10 entries with detail
      html += '<div style="color:' + gold + ';font-size:0.42rem;letter-spacing:2px;margin-bottom:4px">TIMELINE — RECENT</div>';

      var window15 = _getWindow(WINDOW_15M);
      var window1h = _getWindow(WINDOW_1H);
      html += '<div style="color:' + dimText + ';font-size:0.36rem;margin-bottom:4px">';
      html += 'last 15m: ' + window15.length + ' entries \u2022 last 1h: ' + window1h.length + ' entries';
      html += '</div>';

      var show = recent.slice().reverse();
      for (var j = 0; j < show.length; j++) {
        var entry = show[j];
        var eCol = _entryColor(entry, teal, orange, red);
        var eAge = _age(entry.timestamp);
        var sevPct = entry.severity > 0 ? ' ' + Math.round(entry.severity * 100) + '%' : '';
        var confPct = entry.confidence > 0 ? ' c:' + Math.round(entry.confidence * 100) + '%' : '';

        html += '<div style="margin:1px 0">';
        html += '<span style="color:' + dim + ';font-size:0.36rem">' + eAge + '</span> ';
        html += '<span style="color:' + eCol + '">' + _typeIcon(entry.type) + '</span> ';
        html += '<span style="color:' + dimText + '">' + _truncate(entry.label, 30) + '</span>';
        html += '<span style="color:' + dim + ';font-size:0.36rem">' + sevPct + confPct + '</span>';

        // Show duration for active events
        if (entry.type === 'event-start' || entry.type === 'event-update') {
          var dur = _getEventDuration(entry.label);
          if (dur) {
            html += '<span style="color:' + dimText + ';font-size:0.36rem"> (' + _duration(dur) + ')</span>';
          }
        }

        html += '</div>';
      }
    }

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-timeline-strip')) {
      return;
    }
    _panelEl.style.display = 'block';
    _panelEl.innerHTML = html;
  }

  function _getSignificant(n) {
    var result = [];
    var seen = {};
    for (var i = _entries.length - 1; i >= 0 && result.length < n; i--) {
      var e = _entries[i];
      // Skip domain-state snapshots in compact view
      if (e.type === 'domain-state') continue;
      // Skip duplicate labels
      var key = e.type + ':' + e.label;
      if (seen[key]) continue;
      seen[key] = true;
      result.push(e);
    }
    return result;
  }

  function _entryColor(entry, teal, orange, red) {
    if (entry.type === 'event-end' || entry.type === 'user-action') return teal;
    if (entry.severity > 0.65) return red;
    if (entry.severity > 0.40) return orange;
    return teal;
  }

  function _typeIcon(type) {
    if (type === 'event-start') return '\u25B6';   // ▶
    if (type === 'event-update') return '\u25C6';   // ◆
    if (type === 'event-end') return '\u25A0';      // ■
    if (type === 'global-state') return '\u25CF';   // ●
    if (type === 'balance-change') return '\u2195';  // ↕
    if (type === 'user-action') return '\u2192';     // →
    if (type === 'domain-state') return '\u2022';    // •
    return '\u2022';
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function _rehydrateTimeline() {
    var store = window.LIMENFeedStore;
    if (!store) return;
    var saved = store.loadTimeline();
    if (!saved || saved.length === 0) return;

    // Restore entries, deduplicating by timestamp+type+label
    var seen = {};
    for (var i = 0; i < _entries.length; i++) {
      seen[_entries[i].timestamp + ':' + _entries[i].type + ':' + _entries[i].label] = true;
    }
    var restored = 0;
    for (var j = 0; j < saved.length; j++) {
      var e = saved[j];
      var key = e.timestamp + ':' + e.type + ':' + e.label;
      if (seen[key]) continue;
      _entries.push(e);
      seen[key] = true;
      restored++;
    }
    // Sort by timestamp and enforce max
    _entries.sort(function (a, b) { return a.timestamp - b.timestamp; });
    while (_entries.length > MAX_ENTRIES) _entries.shift();

    if (restored > 0) {
      console.log('[LIMEN] timeline-engine: rehydrated ' + restored + ' entries');
    }
  }

  function start() {
    if (_interval) return;

    // Rehydrate from persisted store
    _rehydrateTimeline();

    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        window.addEventListener('limen:balance-update', _onBalanceUpdate);
        window.addEventListener('limen:global-state-update', _onGlobalStateUpdate);
        window.addEventListener('limen:event-start', _onEventStart);
        window.addEventListener('limen:event-update', _onEventUpdate);
        window.addEventListener('limen:event-end', _onEventEnd);
        window.addEventListener('limen:user-action', _onUserAction);
        _publish();
        _interval = setInterval(function () { if (!document.hidden) _publish(); }, EMIT_MS);
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      window.addEventListener('limen:balance-update', _onBalanceUpdate);
      window.addEventListener('limen:global-state-update', _onGlobalStateUpdate);
      window.addEventListener('limen:event-start', _onEventStart);
      window.addEventListener('limen:event-update', _onEventUpdate);
      window.addEventListener('limen:event-end', _onEventEnd);
      window.addEventListener('limen:user-action', _onUserAction);
      _publish();
      _interval = setInterval(function () { if (!document.hidden) _publish(); }, EMIT_MS);
    }
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:balance-update', _onBalanceUpdate);
    window.removeEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.removeEventListener('limen:event-start', _onEventStart);
    window.removeEventListener('limen:event-update', _onEventUpdate);
    window.removeEventListener('limen:event-end', _onEventEnd);
    window.removeEventListener('limen:user-action', _onUserAction);
    if (_panelEl) _panelEl.style.display = 'none';
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _pct(v) { return Math.round(v * 100) + '%'; }

  function _age(ts) {
    var ms = Date.now() - ts;
    if (ms < 60000) return 'now';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm';
    if (ms < 86400000) return Math.floor(ms / 3600000) + 'h';
    return Math.floor(ms / 86400000) + 'd';
  }

  function _duration(ms) {
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm';
    return Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
  }

  function _truncate(str, max) {
    if (!str) return '';
    if (str.length <= max) return str;
    return str.substring(0, max - 1) + '\u2026';
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENTimeline = {
    entries: [],
    count: 0,
    last15m: [],
    last1h: [],
    updated: null,
    getEventDuration: _getEventDuration,
    getTrend: _getTrend,
    getWindow: _getWindow
  };

  window.LIMENTimelineEngine = {
    start: start,
    stop: stop
  };

})();
