/**
 * execution-tracking.js — Post-Execution Tracking (Lightweight)
 *
 * Additive module. Stores execution records in localStorage.
 * Adds TRACK buttons to opportunity cards and investment console.
 * Shows status badges (IN PROGRESS / SUBMITTED / WON / LOST / CLOSED).
 *
 * No backend dependency. Pure localStorage.
 *
 * Exposes: window.LIMENExecutionTracking
 */
(function () {
  'use strict';

  var STORE_KEY = 'LIMEN_EXECUTION_TRACKING';

  // ── PERSISTENCE ─────────────────────────────────────────────────────

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }

  function saveAll(records) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(records)); } catch (e) {}
  }

  function findByOppId(oppId) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].oppId === oppId) return all[i];
    }
    return null;
  }

  // ── CORE FUNCTIONS ──────────────────────────────────────────────────

  /**
   * Create a new execution record for an opportunity.
   * @param {object} opportunity - { id, title, type }
   * @returns {object} the created record
   */
  function createExecutionRecord(opportunity) {
    var existing = findByOppId(opportunity.id);
    if (existing) return existing; // don't duplicate

    var record = {
      id: 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      oppId: opportunity.id,
      title: opportunity.title || '',
      type: (opportunity.type || 'unknown').toLowerCase(),
      status: 'in_progress',
      timestamp: Date.now(),
      outcome_value: null,
      notes: ''
    };

    var all = loadAll();
    all.push(record);
    saveAll(all);
    return record;
  }

  /**
   * Update status of an execution record.
   * @param {string} id - execution record id
   * @param {string} status - in_progress|submitted|approved|rejected|closed
   */
  function updateExecutionStatus(id, status) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].status = status;
        all[i].lastUpdated = Date.now();
        saveAll(all);
        return all[i];
      }
    }
    return null;
  }

  /**
   * Attach outcome to a record.
   * @param {string} id - execution record id
   * @param {*} value - outcome value
   * @param {string} notes - outcome notes
   */
  function attachOutcome(id, value, notes) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].outcome_value = value;
        all[i].notes = notes || '';
        all[i].lastUpdated = Date.now();
        saveAll(all);
        return all[i];
      }
    }
    return null;
  }

  /**
   * Get all execution records.
   */
  function getAllRecords() {
    return loadAll();
  }

  // ── STYLES ──────────────────────────────────────────────────────────

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.let-track-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;font-family:inherit;font-size:0.28rem;letter-spacing:1.5px;text-transform:uppercase;background:rgba(74,143,212,0.08);border:1px solid rgba(74,143,212,0.2);color:#4a8fd4;border-radius:2px;cursor:pointer;transition:all 0.15s;margin-top:4px}',
      '.let-track-btn:hover{background:rgba(74,143,212,0.15);border-color:rgba(74,143,212,0.4)}',
      '.let-track-btn.tracked{background:rgba(90,181,160,0.08);border-color:rgba(90,181,160,0.2);color:#5ab5a0;cursor:default}',
      '.let-badge{display:inline-block;font-size:0.24rem;letter-spacing:1.5px;padding:1px 5px;border-radius:2px;margin-left:6px;font-family:inherit}',
      '.let-badge-in_progress{color:#4a8fd4;border:1px solid rgba(74,143,212,0.25);background:rgba(74,143,212,0.06)}',
      '.let-badge-submitted{color:#C9A94E;border:1px solid rgba(201,169,78,0.25);background:rgba(201,169,78,0.06)}',
      '.let-badge-approved,.let-badge-won{color:#5ab5a0;border:1px solid rgba(90,181,160,0.25);background:rgba(90,181,160,0.06)}',
      '.let-badge-rejected,.let-badge-lost{color:#e85454;border:1px solid rgba(232,84,84,0.25);background:rgba(232,84,84,0.06)}',
      '.let-badge-closed{color:#908878;border:1px solid rgba(144,136,120,0.25);background:rgba(144,136,120,0.06)}',
      '.let-status-menu{position:absolute;background:#0e1018;border:1px solid rgba(201,169,78,0.15);border-radius:3px;padding:4px 0;z-index:10000;min-width:140px}',
      '.let-status-option{padding:4px 12px;font-size:0.30rem;color:#b0a898;cursor:pointer;letter-spacing:1px}',
      '.let-status-option:hover{background:rgba(201,169,78,0.06);color:#e8e3d9}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── UI RENDERING ────────────────────────────────────────────────────

  function renderBadge(status) {
    if (!status) return '';
    var label = status.toUpperCase().replace(/_/g, ' ');
    return '<span class="let-badge let-badge-' + status + '">' + label + '</span>';
  }

  function renderTrackButton(oppId, oppTitle, oppType) {
    var existing = findByOppId(oppId);
    if (existing) {
      return '<span class="let-track-btn tracked">\u2713 TRACKING' + renderBadge(existing.status) + '</span>';
    }
    return '<button class="let-track-btn" data-let-track="' + oppId + '" data-let-title="' + (oppTitle || '').replace(/"/g, '&quot;') + '" data-let-type="' + (oppType || '') + '">\u25CB TRACK</button>';
  }

  // ── STATUS CHANGE DROPDOWN ──────────────────────────────────────────

  var STATUSES = ['in_progress', 'submitted', 'approved', 'rejected', 'closed'];

  function openStatusMenu(badgeEl, recordId) {
    // Close any existing
    var existing = document.querySelector('.let-status-menu');
    if (existing) existing.remove();

    var rect = badgeEl.getBoundingClientRect();
    var menu = document.createElement('div');
    menu.className = 'let-status-menu';
    menu.style.top = (rect.bottom + 2) + 'px';
    menu.style.left = rect.left + 'px';

    for (var i = 0; i < STATUSES.length; i++) {
      var opt = document.createElement('div');
      opt.className = 'let-status-option';
      opt.textContent = STATUSES[i].toUpperCase().replace(/_/g, ' ');
      opt.setAttribute('data-let-status', STATUSES[i]);
      opt.setAttribute('data-let-record', recordId);
      menu.appendChild(opt);
    }

    document.body.appendChild(menu);

    menu.addEventListener('click', function (e) {
      var status = e.target.getAttribute('data-let-status');
      var rid = e.target.getAttribute('data-let-record');
      if (status && rid) {
        updateExecutionStatus(rid, status);
        menu.remove();
        // Refresh cards
        injectIntoCards();
      }
    });

    // Close on outside click
    setTimeout(function () {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 10);
  }

  // ── INJECT INTO OPPORTUNITY CARDS ───────────────────────────────────

  function injectIntoCards() {
    injectStyles();
    var cards = document.querySelectorAll('.opp-card[data-id]');
    cards.forEach(function (card) {
      var oppId = card.getAttribute('data-id');
      if (!oppId) return;

      // Remove old track buttons if re-injecting
      var oldBtn = card.querySelector('[data-let-track], .let-track-btn');
      if (oldBtn) oldBtn.remove();

      // Get type from badge
      var badge = card.querySelector('.opp-card-type');
      var type = badge ? badge.textContent.trim().toLowerCase() : '';
      var title = '';
      var titleEl = card.querySelector('.opp-card-title');
      if (titleEl) title = titleEl.textContent.trim();

      var html = renderTrackButton(oppId, title, type);
      var div = document.createElement('div');
      div.style.marginTop = '4px';
      div.innerHTML = html;
      card.appendChild(div);
    });

    // Wire track button clicks
    document.querySelectorAll('[data-let-track]').forEach(function (btn) {
      if (btn.getAttribute('data-let-wired')) return;
      btn.setAttribute('data-let-wired', '1');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var oppId = this.getAttribute('data-let-track');
        var oppTitle = this.getAttribute('data-let-title');
        var oppType = this.getAttribute('data-let-type');
        createExecutionRecord({ id: oppId, title: oppTitle, type: oppType });
        injectIntoCards(); // re-render
      });
    });

    // Wire badge clicks for status change
    document.querySelectorAll('.let-track-btn.tracked .let-badge').forEach(function (badge) {
      if (badge.getAttribute('data-let-wired')) return;
      badge.setAttribute('data-let-wired', '1');
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', function (e) {
        e.stopPropagation();
        var btn = this.closest('.let-track-btn');
        var card = btn ? btn.closest('.opp-card[data-id]') : null;
        if (!card) return;
        var oppId = card.getAttribute('data-id');
        var record = findByOppId(oppId);
        if (record) openStatusMenu(this, record.id);
      });
    });
  }

  // ── INJECT INTO INVESTMENT CONSOLE ──────────────────────────────────

  function injectIntoInvestmentConsole() {
    injectStyles();
    // Look for the verdict section in investment console
    var verdictEl = document.querySelector('.ic-verdict');
    if (!verdictEl || verdictEl.getAttribute('data-let-injected')) return;
    verdictEl.setAttribute('data-let-injected', '1');

    // Get opp id from URL
    var params = new URLSearchParams(window.location.search);
    var oppId = params.get('opp');
    if (!oppId) return;

    var html = renderTrackButton(oppId, '', 'invest');
    var div = document.createElement('div');
    div.style.cssText = 'margin-top:8px;text-align:center';
    div.innerHTML = html;
    verdictEl.appendChild(div);

    // Wire
    var btn = div.querySelector('[data-let-track]');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        createExecutionRecord({ id: oppId, title: document.title, type: 'invest' });
        div.innerHTML = renderTrackButton(oppId, '', 'invest');
      });
    }
  }

  // ── AUTO-INJECT ─────────────────────────────────────────────────────

  function autoInject() {
    injectIntoCards();
    injectIntoInvestmentConsole();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(autoInject, 2200); });
  } else {
    setTimeout(autoInject, 2200);
  }

  window.addEventListener('limen:domain-update', function () { setTimeout(autoInject, 600); });

  // ── PUBLIC API ──────────────────────────────────────────────────────

  window.LIMENExecutionTracking = {
    createExecutionRecord: createExecutionRecord,
    updateExecutionStatus: updateExecutionStatus,
    attachOutcome: attachOutcome,
    getAllRecords: getAllRecords,
    findByOppId: findByOppId,
    renderBadge: renderBadge,
    injectIntoCards: injectIntoCards,
    injectIntoInvestmentConsole: injectIntoInvestmentConsole
  };

  console.log('[LIMENExecutionTracking] Loaded — post-execution tracking ready');
})();
