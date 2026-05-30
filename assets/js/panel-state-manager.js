/**
 * panel-state-manager.js
 * LIMEN HELIX — Panel State Authority
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * Single source of truth for panel visibility.
 * Modules render content freely but MUST ask this manager before
 * setting display = 'block'. Dismissed / collapsed / snoozed panels
 * stay hidden until the user or a qualifying event reopens them.
 *
 * States: visible, dismissed, collapsed, snoozed, pinned
 * Auto-open: only for genuinely new events (deduplication by event key)
 *
 * Output: window.LIMENPanelState
 * Events: limen:panel-state-change
 *
 * Load order: BEFORE all advisory modules, after feed-state.js
 */

(function () {
  'use strict';

  // ─── Panel configuration ────────────────────────────────────────────────

  var PANELS = {
    'limen-global-state-badge': { snoozeDuration: 0,      autoOpenable: false },
    'limen-domain-panel':       { snoozeDuration: 0,      autoOpenable: false },
    'limen-escalation-panel':   { snoozeDuration: 120000, autoOpenable: true  },
    'limen-narrator-panel':     { snoozeDuration: 60000,  autoOpenable: true  },
    'limen-systemic-panel':     { snoozeDuration: 0,      autoOpenable: false },
    'limen-stress-strip':       { snoozeDuration: 0,      autoOpenable: false },
    'limen-health-strip':       { snoozeDuration: 0,      autoOpenable: false },
    'limen-connectome-map':     { snoozeDuration: 0,      autoOpenable: false },
    'limen-triage-panel':       { snoozeDuration: 120000, autoOpenable: true  },
    'limen-event-rail':         { snoozeDuration: 0,      autoOpenable: false },
    'limen-timeline-strip':     { snoozeDuration: 0,      autoOpenable: false },
    'limen-investigation-drawer': { snoozeDuration: 0,    autoOpenable: false },
    'limen-feed-inspector':     { snoozeDuration: 0,      autoOpenable: false },
    'limen-snapshot-badge':     { snoozeDuration: 0,      autoOpenable: false }
  };

  // ─── State ──────────────────────────────────────────────────────────────

  var _state = {};       // panelId → { status, snoozedUntil, pinnedAt }
  var _seenEvents = {};  // eventKey → timestamp (deduplication)
  var EVENT_DEDUP_MS = 60000; // same event key won't re-trigger for 60s

  function _initState() {
    for (var id in PANELS) {
      _state[id] = {
        status: 'visible',   // visible | dismissed | collapsed | snoozed
        snoozedUntil: 0,
        pinnedAt: 0
      };
    }
  }
  _initState();

  // ─── Core queries ───────────────────────────────────────────────────────

  function isVisible(panelId) {
    var s = _state[panelId];
    if (!s) return true; // unknown panels default to visible

    // Pinned panels are always visible
    if (s.pinnedAt > 0) return true;

    // Snoozed check
    if (s.status === 'snoozed') {
      if (Date.now() < s.snoozedUntil) return false;
      // Snooze expired — restore
      s.status = 'visible';
    }

    if (s.status === 'dismissed') return false;
    if (s.status === 'collapsed') return false;

    return true;
  }

  function isPinned(panelId) {
    var s = _state[panelId];
    return s && s.pinnedAt > 0;
  }

  function isDismissed(panelId) {
    var s = _state[panelId];
    return s && s.status === 'dismissed';
  }

  function getStatus(panelId) {
    var s = _state[panelId];
    if (!s) return 'visible';
    if (s.pinnedAt > 0) return 'pinned';
    if (s.status === 'snoozed' && Date.now() >= s.snoozedUntil) return 'visible';
    return s.status;
  }

  // ─── State mutations ───────────────────────────────────────────────────

  function dismiss(panelId) {
    var s = _state[panelId];
    if (!s) return;
    s.status = 'dismissed';
    s.pinnedAt = 0;
    _hideEl(panelId);
    _emit(panelId, 'dismissed');
  }

  function collapse(panelId) {
    var s = _state[panelId];
    if (!s) return;
    s.status = 'collapsed';
    _hideEl(panelId);
    _emit(panelId, 'collapsed');
  }

  function expand(panelId) {
    var s = _state[panelId];
    if (!s) return;
    s.status = 'visible';
    _emit(panelId, 'expanded');
  }

  function pin(panelId) {
    var s = _state[panelId];
    if (!s) return;
    s.pinnedAt = Date.now();
    s.status = 'visible';
    _emit(panelId, 'pinned');
  }

  function unpin(panelId) {
    var s = _state[panelId];
    if (!s) return;
    s.pinnedAt = 0;
    _emit(panelId, 'unpinned');
  }

  function snooze(panelId, durationMs) {
    var s = _state[panelId];
    if (!s) return;
    var config = PANELS[panelId];
    var dur = durationMs || (config && config.snoozeDuration) || 60000;
    s.status = 'snoozed';
    s.snoozedUntil = Date.now() + dur;
    s.pinnedAt = 0;
    _hideEl(panelId);
    _emit(panelId, 'snoozed');
  }

  function restore(panelId) {
    var s = _state[panelId];
    if (!s) return;
    s.status = 'visible';
    s.snoozedUntil = 0;
    _emit(panelId, 'restored');
  }

  function restoreAll() {
    for (var id in _state) {
      _state[id].status = 'visible';
      _state[id].snoozedUntil = 0;
    }
    _dispatch('limen:panel-state-change', { action: 'restore-all' });
  }

  // ─── Auto-open discipline ──────────────────────────────────────────────

  function shouldAutoOpen(panelId, eventKey) {
    var config = PANELS[panelId];
    if (!config || !config.autoOpenable) return false;

    var s = _state[panelId];
    if (!s) return false;

    // Pinned panels are already visible
    if (s.pinnedAt > 0) return true;

    // Snoozed panels don't auto-open
    if (s.status === 'snoozed' && Date.now() < s.snoozedUntil) return false;

    // Dismissed panels don't auto-open for routine events
    if (s.status === 'dismissed') return false;

    // Event deduplication
    if (eventKey) {
      var lastSeen = _seenEvents[eventKey];
      if (lastSeen && (Date.now() - lastSeen) < EVENT_DEDUP_MS) return false;
      _seenEvents[eventKey] = Date.now();
    }

    return true;
  }

  // Force auto-open for critical events (overrides dismiss/snooze but not pin)
  function forceOpen(panelId, eventKey) {
    var s = _state[panelId];
    if (!s) return;
    s.status = 'visible';
    s.snoozedUntil = 0;
    if (eventKey) _seenEvents[eventKey] = Date.now();
    _emit(panelId, 'force-opened');
  }

  // ─── UI-mode integration ──────────────────────────────────────────────

  // Called by ui-mode-manager when mode changes.
  // Mode visibility is applied BUT user overrides (dismiss/pin) are preserved.
  function applyModeVisibility(panelId, modeState) {
    var s = _state[panelId];
    if (!s) return;

    // Pinned panels stay visible regardless of mode
    if (s.pinnedAt > 0) return;

    // User-dismissed panels stay dismissed regardless of mode
    if (s.status === 'dismissed') return;

    // Snoozed panels stay snoozed
    if (s.status === 'snoozed' && Date.now() < s.snoozedUntil) return;

    // Otherwise, apply mode visibility
    if (modeState === 'hidden') {
      s.status = 'collapsed'; // mode-hidden, not user-dismissed
    } else if (modeState === 'visible' || modeState === 'micro') {
      if (s.status === 'collapsed') {
        s.status = 'visible'; // mode restored
      }
    }
    // 'auto' panels: restore from mode-collapsed, leave user-dismissed alone
    if (modeState === 'auto') {
      if (s.status === 'collapsed') {
        s.status = 'visible';
      }
    }
  }

  // ─── Cleanup stale dedup entries ──────────────────────────────────────

  function _cleanDedup() {
    var now = Date.now();
    for (var key in _seenEvents) {
      if (now - _seenEvents[key] > EVENT_DEDUP_MS * 5) {
        delete _seenEvents[key];
      }
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────────

  function _hideEl(panelId) {
    var el = document.getElementById(panelId);
    if (el) el.style.display = 'none';
  }

  function _emit(panelId, action) {
    _dispatch('limen:panel-state-change', {
      panelId: panelId,
      action: action,
      status: getStatus(panelId),
      timestamp: Date.now()
    });
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Debug dump ────────────────────────────────────────────────────────

  function dump() {
    var result = {};
    for (var id in _state) {
      result[id] = {
        status: getStatus(id),
        visible: isVisible(id),
        pinned: isPinned(id)
      };
      if (_state[id].snoozedUntil > Date.now()) {
        result[id].snoozedFor = Math.round((_state[id].snoozedUntil - Date.now()) / 1000) + 's';
      }
    }
    return result;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  function start() {
    // Periodic dedup cleanup
    setInterval(_cleanDedup, 60000);
  }

  function stop() {
    // nothing to tear down
  }

  // ─── Public API ────────────────────────────────────────────────────────

  window.LIMENPanelState = {
    isVisible: isVisible,
    isPinned: isPinned,
    isDismissed: isDismissed,
    getStatus: getStatus,
    dismiss: dismiss,
    collapse: collapse,
    expand: expand,
    pin: pin,
    unpin: unpin,
    snooze: snooze,
    restore: restore,
    restoreAll: restoreAll,
    shouldAutoOpen: shouldAutoOpen,
    forceOpen: forceOpen,
    applyModeVisibility: applyModeVisibility,
    dump: dump,
    start: start,
    stop: stop
  };

})();
