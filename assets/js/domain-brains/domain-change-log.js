/**
 * domain-change-log.js — Unified Change Log System
 *
 * Single canonical change log used across all domain console pages.
 * Append-only, time-ordered, domain-scoped.
 *
 * Change types:
 *   EVENT_CHANGE      — signal detected, cluster change, macro shock
 *   HEALTH_CHANGE     — stress delta, confidence shift, phase/maturity change
 *   DIAGNOSIS_CHANGE  — diagnosis activated/resolved/priority shift
 *   TREATMENT_CHANGE  — treatment added/promoted/pathway updated
 *   OPPORTUNITY_CHANGE — opportunity created/rank change/status change
 *   EXECUTION_CHANGE  — action started/submitted/completed
 *   OUTCOME_CHANGE    — funding secured/revenue/deal closed/rejection
 *
 * Each entry: { timestamp, domain, type, severity, title, description, metadata }
 *
 * Page filters:
 *   STATE        → EVENT_CHANGE + HEALTH_CHANGE
 *   INTELLIGENCE → DIAGNOSIS_CHANGE + TREATMENT_CHANGE
 *   EXECUTION    → OPPORTUNITY_CHANGE + EXECUTION_CHANGE + OUTCOME_CHANGE
 *
 * Exposes: window.LIMENChangeLog
 */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'limen_changelog_';
  var MAX_ENTRIES = 200;

  var TYPES = {
    EVENT_CHANGE: 'EVENT_CHANGE',
    HEALTH_CHANGE: 'HEALTH_CHANGE',
    DIAGNOSIS_CHANGE: 'DIAGNOSIS_CHANGE',
    TREATMENT_CHANGE: 'TREATMENT_CHANGE',
    OPPORTUNITY_CHANGE: 'OPPORTUNITY_CHANGE',
    EXECUTION_CHANGE: 'EXECUTION_CHANGE',
    OUTCOME_CHANGE: 'OUTCOME_CHANGE'
  };

  var SEVERITIES = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };

  var PAGE_FILTERS = {
    STATE: [TYPES.EVENT_CHANGE, TYPES.HEALTH_CHANGE],
    INTELLIGENCE: [TYPES.DIAGNOSIS_CHANGE, TYPES.TREATMENT_CHANGE],
    EXECUTION: [TYPES.OPPORTUNITY_CHANGE, TYPES.EXECUTION_CHANGE, TYPES.OUTCOME_CHANGE]
  };

  var TYPE_COLORS = {
    EVENT_CHANGE: '#4a8fd4',
    HEALTH_CHANGE: '#e85454',
    DIAGNOSIS_CHANGE: '#FF9800',
    TREATMENT_CHANGE: '#5ab5a0',
    OPPORTUNITY_CHANGE: '#C9A94E',
    EXECUTION_CHANGE: '#8B5CF6',
    OUTCOME_CHANGE: '#22C55E'
  };

  // ══════════════════════════════════════════════════════════════════════

  function _getLog(domain) {
    try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + domain) || '[]'); }
    catch (e) { return []; }
  }

  function _setLog(domain, log) {
    if (log.length > MAX_ENTRIES) log = log.slice(-MAX_ENTRIES);
    try { localStorage.setItem(STORAGE_PREFIX + domain, JSON.stringify(log)); } catch (e) {}
  }

  /**
   * Append a change entry. Never overwrites.
   */
  function append(domain, type, severity, title, description, metadata) {
    var log = _getLog(domain);
    log.push({
      timestamp: Date.now(),
      domain: domain,
      type: type,
      severity: severity || SEVERITIES.LOW,
      title: title,
      description: description || '',
      metadata: metadata || {}
    });
    _setLog(domain, log);
  }

  /**
   * Get full log for a domain, latest first.
   */
  function getAll(domain) {
    return _getLog(domain).reverse();
  }

  /**
   * Get filtered log for a page view.
   */
  function getForPage(domain, page) {
    var filters = PAGE_FILTERS[page] || [];
    return getAll(domain).filter(function (e) {
      return filters.indexOf(e.type) !== -1;
    });
  }

  /**
   * Detect changes between previous and current state.
   * Automatically appends detected changes.
   */
  function detectAndLog(domain, prevState, currentDom, currentSnap, currentJoin) {
    if (!prevState) return;

    var sd = (currentSnap.domains || {})[domain] || {};
    var join = currentJoin || {};
    var now = Date.now();

    // HEALTH: Stress delta > 3%
    var prevStress = prevState.stress || 0;
    var curStress = currentDom.stress || 0;
    if (Math.abs(curStress - prevStress) > 0.03) {
      var dir = curStress > prevStress ? 'rose' : 'fell';
      append(domain, TYPES.HEALTH_CHANGE,
        Math.abs(curStress - prevStress) > 0.10 ? SEVERITIES.HIGH : SEVERITIES.MEDIUM,
        'Stress ' + dir + ' to ' + Math.round(curStress * 100) + '%',
        Math.round(prevStress * 100) + '% → ' + Math.round(curStress * 100) + '%',
        { prevStress: prevStress, curStress: curStress });
    }

    // HEALTH: Maturity change
    if (prevState.maturity && prevState.maturity !== currentDom.maturity) {
      append(domain, TYPES.HEALTH_CHANGE, SEVERITIES.HIGH,
        'Maturity: ' + prevState.maturity + ' → ' + currentDom.maturity, '',
        { prev: prevState.maturity, cur: currentDom.maturity });
    }

    // HEALTH: Phase change
    if (prevState.phase && prevState.phase !== sd.phase) {
      append(domain, TYPES.HEALTH_CHANGE, SEVERITIES.HIGH,
        'Phase: ' + (prevState.phase || '?') + ' → ' + (sd.phase || '?'), '',
        { prev: prevState.phase, cur: sd.phase });
    }

    // HEALTH: Confidence shift > 5%
    var prevConf = prevState.confidence || 0;
    var curConf = currentDom.confidence || 0;
    if (Math.abs(curConf - prevConf) > 0.05) {
      append(domain, TYPES.HEALTH_CHANGE, SEVERITIES.LOW,
        'Confidence: ' + Math.round(prevConf * 100) + '% → ' + Math.round(curConf * 100) + '%', '',
        { prev: prevConf, cur: curConf });
    }

    // EVENT: Signal count change
    var prevSigs = (prevState.signals || []).length;
    var curSigs = (currentDom.signals || []).length;
    if (curSigs !== prevSigs) {
      append(domain, TYPES.EVENT_CHANGE, curSigs > prevSigs ? SEVERITIES.MEDIUM : SEVERITIES.LOW,
        'Signals: ' + prevSigs + ' → ' + curSigs, '',
        { prev: prevSigs, cur: curSigs });
    }

    // EVENT: Feed status change
    var prevFeeds = prevState.sources || [];
    var curFeeds = currentDom.sources || [];
    for (var fi = 0; fi < curFeeds.length; fi++) {
      var cf = curFeeds[fi];
      var pf = null;
      for (var pi = 0; pi < prevFeeds.length; pi++) {
        if (prevFeeds[pi].name === cf.name) { pf = prevFeeds[pi]; break; }
      }
      if (pf && pf.live !== cf.live) {
        append(domain, TYPES.EVENT_CHANGE, cf.live ? SEVERITIES.LOW : SEVERITIES.HIGH,
          cf.name + ': ' + (pf.live ? 'LIVE' : 'DOWN') + ' → ' + (cf.live ? 'LIVE' : 'DOWN'), '',
          { feed: cf.name, wasLive: pf.live, isLive: cf.live });
      }
    }

    // OPPORTUNITY: Company phase change
    var prevCos = prevState.companies || [];
    var curCos = (join.companies || []);
    for (var ci = 0; ci < curCos.length; ci++) {
      var cc = curCos[ci];
      var pc = null;
      for (var pci = 0; pci < prevCos.length; pci++) {
        if (prevCos[pci].ticker === cc.ticker) { pc = prevCos[pci]; break; }
      }
      if (pc && pc.phase !== cc.phase) {
        var isTerm = cc.phase === 'p7a' || cc.phase === 'p9';
        append(domain, TYPES.OPPORTUNITY_CHANGE, isTerm ? SEVERITIES.HIGH : SEVERITIES.MEDIUM,
          cc.ticker + ' phase: ' + pc.phase + ' → ' + cc.phase, '',
          { ticker: cc.ticker, prev: pc.phase, cur: cc.phase });
      }
    }
  }

  /**
   * Fetch persistent log from server API.
   * Returns a Promise that resolves to entries array.
   */
  function fetchFromServer(domain, page, limit, offset) {
    limit = limit || 50;
    offset = offset || 0;
    var url = '/api/limen-changelog?domain=' + domain;
    if (page) url += '&page=' + page;
    url += '&limit=' + limit + '&offset=' + offset;
    return fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) { return data.ok ? data.entries : []; })
      .catch(function() { return []; });
  }

  /**
   * Write to server API (fire-and-forget).
   */
  function writeToServer(domain, type, severity, title, description, metadata, pageContext) {
    fetch('/api/limen-changelog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain, type: type, severity: severity, title: title, description: description || '', metadata: metadata || {}, page_context: pageContext || null })
    }).catch(function() {});
  }

  /**
   * Append locally AND write to server.
   */
  var _origAppend = append;
  append = function(domain, type, severity, title, description, metadata) {
    _origAppend(domain, type, severity, title, description, metadata);
    writeToServer(domain, type, severity, title, description, metadata);
  };

  /**
   * Render change log HTML for a given page filter.
   * Uses local entries first, server entries loaded async.
   */
  function renderHTML(domain, page, maxEntries) {
    maxEntries = maxEntries || 25;
    var entries = getForPage(domain, page);
    if (entries.length === 0) return '<div style="font-size:0.34rem;color:rgba(200,195,184,0.2);letter-spacing:1px;padding:4px 0">Loading change history...</div>';

    var h = '';
    for (var i = 0; i < Math.min(entries.length, maxEntries); i++) {
      var e = entries[i];
      var color = TYPE_COLORS[e.type] || '#888';
      var sevBorder = e.severity === 'HIGH' ? color : (e.severity === 'MEDIUM' ? color + '88' : color + '44');
      var time = new Date(e.timestamp).toLocaleTimeString();
      var date = new Date(e.timestamp).toLocaleDateString();

      h += '<div style="padding:3px 6px;margin:2px 0;font-size:0.3rem;border-left:2px solid ' + sevBorder + ';background:' + color + '05">';
      h += '<span style="font-size:0.22rem;color:rgba(200,195,184,0.25)">' + date + ' ' + time + '</span> ';
      h += '<span style="color:' + color + '">' + e.title + '</span>';
      if (e.description) h += '<span style="color:rgba(200,195,184,0.3)"> — ' + e.description + '</span>';
      h += '</div>';
    }
    if (entries.length > maxEntries) {
      h += '<div style="font-size:0.26rem;color:rgba(200,195,184,0.2);margin-top:4px">' + (entries.length - maxEntries) + ' older entries</div>';
    }
    return h;
  }

  /**
   * Render from server (async). Returns Promise<string>.
   * Use this for persistent historical views.
   */
  function renderFromServer(domain, page, maxEntries) {
    return fetchFromServer(domain, page, maxEntries || 50).then(function(entries) {
      if (!entries || entries.length === 0) return '<div style="font-size:0.34rem;color:rgba(200,195,184,0.2);letter-spacing:1px;padding:4px 0">No persistent history yet</div>';
      var h = '';
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var color = TYPE_COLORS[e.type] || '#888';
        var sevBorder = e.severity === 'HIGH' ? color : (e.severity === 'MEDIUM' ? color + '88' : color + '44');
        var time = new Date(e.timestamp).toLocaleTimeString();
        var date = new Date(e.timestamp).toLocaleDateString();
        h += '<div style="padding:3px 6px;margin:2px 0;font-size:0.3rem;border-left:2px solid ' + sevBorder + ';background:' + color + '05">';
        h += '<span style="font-size:0.22rem;color:rgba(200,195,184,0.25)">' + date + ' ' + time + '</span> ';
        h += '<span style="color:' + color + '">' + e.title + '</span>';
        if (e.description) h += '<span style="color:rgba(200,195,184,0.3)"> — ' + e.description + '</span>';
        h += '</div>';
      }
      return h;
    });
  }

  // ══════════════════════════════════════════════════════════════════════

  window.LIMENChangeLog = {
    append: append,
    getAll: getAll,
    getForPage: getForPage,
    detectAndLog: detectAndLog,
    renderHTML: renderHTML,
    renderFromServer: renderFromServer,
    fetchFromServer: fetchFromServer,
    writeToServer: writeToServer,
    TYPES: TYPES,
    SEVERITIES: SEVERITIES,
    PAGE_FILTERS: PAGE_FILTERS,
    TYPE_COLORS: TYPE_COLORS
  };

})();
