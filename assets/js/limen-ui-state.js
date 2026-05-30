/**
 * limen-ui-state.js
 * LIMEN HELIX — Canonical Runtime State Persistence
 *
 * One namespaced sessionStorage key for cross-page navigation continuity.
 * Does NOT touch feed-store localStorage (limen_feed_*).
 *
 * ═══ CANONICAL STATE SHAPE ═══
 *
 *   {
 *     // Navigation context
 *     focusDomain:    string|null,   // active civilization domain (e.g., "economy")
 *     selectedNodeId: string|null,   // brain node ID selected in portal (e.g., "dlPFC")
 *     selectedIssueId:string|null,   // issue ID selected in portal (e.g., "CASH_FLOW_CRISIS")
 *
 *     // UI mode
 *     uiMode:         string|null,   // "MAP"|"SIGNALS"|"TRIAGE" — console mode bar state
 *
 *     // Investigation drawer
 *     invDrawerOpen:  boolean,       // drawer visible?
 *     invActiveId:    string|null,   // event ID of active investigation
 *     invScrollTop:   number,        // scroll offset for drawer restore
 *
 *     // Metadata (auto-set by save())
 *     _ts:            number,        // Date.now() at last save
 *     _page:          string,        // source page pathname
 *     _pageType:      string         // "console"|"connectome"|"portal"|"other"
 *   }
 *
 * ═══ RULES ═══
 * - TTL: 5 minutes. Stale state returns null on restore().
 * - Connectome context: separate key, 2-min TTL, consume-and-clear.
 * - save() merges — callers write only the fields they own.
 * - restore({ samePageType: true }) scopes to console/portal/connectome.
 * - No field is ever auto-populated on restore — consumers decide what to act on.
 *
 * Provides: window.LIMENUIState
 * Load order: BEFORE ui-mode-manager, investigation-engine, portal-ui
 */

(function () {
  'use strict';

  var KEY = 'limen_ui_state';
  var TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ─── Core read/write ──────────────────────────────────────────────────

  function _read() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj._ts) return null;
      // Expire stale state
      if (Date.now() - obj._ts > TTL_MS) {
        sessionStorage.removeItem(KEY);
        return null;
      }
      return obj;
    } catch (e) {
      return null;
    }
  }

  function _write(obj) {
    try {
      obj._ts = Date.now();
      obj._page = window.location.pathname.replace(/^\//, '').replace(/\/$/, '') || 'index';
      obj._pageType = _pageType(obj._page);
      sessionStorage.setItem(KEY, JSON.stringify(obj));
    } catch (e) { /* quota or private mode — silent */ }
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Save a set of UI state fields. Merges with existing state.
   * @param {Object} fields — key/value pairs to persist
   */
  function save(fields) {
    var current = _read() || {};
    for (var k in fields) {
      if (fields.hasOwnProperty(k)) {
        current[k] = fields[k];
      }
    }
    _write(current);
  }

  /**
   * Restore previously saved state.
   * @param {Object} opts
   * @param {boolean} opts.samePage — if true, only restore if saved from the same page path
   * @param {boolean} opts.samePageType — if true, only restore if saved from same page type
   *                                      (console, connectome, portal)
   * @returns {Object|null}
   */
  function restore(opts) {
    opts = opts || {};
    var obj = _read();
    if (!obj) return null;

    if (opts.samePage) {
      var currentPage = window.location.pathname.replace(/^\//, '').replace(/\/$/, '') || 'index';
      if (obj._page !== currentPage) return null;
    }

    if (opts.samePageType) {
      var savedType = _pageType(obj._page || '');
      var currentType = _pageType(window.location.pathname);
      if (savedType !== currentType) return null;
    }

    return obj;
  }

  /**
   * Clear a specific field from persisted state.
   */
  function clear(field) {
    var obj = _read();
    if (!obj) return;
    delete obj[field];
    _write(obj);
  }

  /**
   * Clear all persisted UI state.
   */
  function clearAll() {
    sessionStorage.removeItem(KEY);
  }

  // ─── Page type classification ─────────────────────────────────────────

  function _pageType(pathname) {
    var p = pathname.replace(/^\//, '').replace(/\/$/, '');
    if (p === '' || p === 'civilization.html' || p === 'civilization') return 'console';
    if (p === 'connectome.html' || p === 'connectome') return 'connectome';
    if (p.indexOf('_portal') !== -1 || p === 'portal.html' || p === 'portal') return 'portal';
    return 'other';
  }

  // ─── Enhanced connectome context handoff ──────────────────────────────

  var CTX_KEY = 'limen_connectome_context';
  var CTX_TTL_MS = 2 * 60 * 1000; // 2 minutes — short for navigation handoffs

  /**
   * Write a connectome navigation context for the destination page.
   * @param {Object} context — { focusDomain, focusNode, sourcePage, issueId, ... }
   */
  function setConnectomeContext(context) {
    try {
      context._ts = Date.now();
      context._source = window.location.pathname.replace(/^\//, '').replace(/\/$/, '') || 'index';
      sessionStorage.setItem(CTX_KEY, JSON.stringify(context));
      // Mirror focusDomain into canonical state for cross-page continuity
      if (context.focusDomain) {
        save({ focusDomain: context.focusDomain });
      }
    } catch (e) { /* silent */ }
  }

  /**
   * Read and consume the connectome context. Returns null if expired or missing.
   * The context is cleared after reading to prevent stale re-reads on refresh.
   * @param {Object} opts
   * @param {boolean} opts.peek — if true, do not clear after reading
   * @returns {Object|null}
   */
  function getConnectomeContext(opts) {
    opts = opts || {};
    try {
      var raw = sessionStorage.getItem(CTX_KEY);
      if (!raw) return null;
      var ctx = JSON.parse(raw);
      if (!ctx || !ctx._ts) return null;
      // Expire stale contexts
      if (Date.now() - ctx._ts > CTX_TTL_MS) {
        sessionStorage.removeItem(CTX_KEY);
        return null;
      }
      // Consume: clear after reading unless peeking
      if (!opts.peek) {
        sessionStorage.removeItem(CTX_KEY);
      }
      return ctx;
    } catch (e) {
      return null;
    }
  }

  // ─── Snapshot: returns the canonical shape with defaults ──────────────

  function snapshot() {
    var obj = _read() || {};
    return {
      focusDomain:    obj.focusDomain    || null,
      selectedNodeId: obj.selectedNodeId  || null,
      selectedIssueId:obj.selectedIssueId || null,
      uiMode:         obj.uiMode         || null,
      invDrawerOpen:  !!obj.invDrawerOpen,
      invActiveId:    obj.invActiveId     || null,
      invScrollTop:   obj.invScrollTop    || 0,
      _ts:            obj._ts            || null,
      _page:          obj._page          || null,
      _pageType:      obj._pageType      || null
    };
  }

  // ─── Export ───────────────────────────────────────────────────────────

  window.LIMENUIState = {
    save: save,
    restore: restore,
    clear: clear,
    clearAll: clearAll,
    snapshot: snapshot,
    getPageType: function () { return _pageType(window.location.pathname); },
    setConnectomeContext: setConnectomeContext,
    getConnectomeContext: getConnectomeContext
  };

})();
