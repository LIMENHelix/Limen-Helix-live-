/**
 * LIMEN Ingest Client — Phase 14
 *
 * Client-side handler for /api/limen-ingest responses.
 * Stores audit/events in localStorage, emits app events,
 * merges normalized delta into domain signal path.
 *
 * Exposes: window.LIMENIngest
 *
 * Events emitted:
 *   limen:external-signal-ingested  { domain, type, source, appliedDelta, deduped }
 *
 * Owned storage keys:
 *   limen_ingest_events  — recent ingest log (max 200)
 *   limen_ingest_audit   — counters
 */
(function () {
  'use strict';

  var EVENTS_KEY = 'limen_ingest_events';
  var AUDIT_KEY = 'limen_ingest_audit';
  var MAX_EVENTS = 200;
  var EVENT_VERSION = 1;

  function _emit(name, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      detail.eventVersion = EVENT_VERSION;
      detail.timestamp = Date.now();
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }
  }

  function _getEvents() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function _getAudit() {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  // Send ingest request to API and process response
  function ingest(payload) {
    return fetch('/api/limen-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function (r) { return r.json(); })
    .then(function (result) {
      if (result.accepted) {
        _recordAccepted(result);
        // Merge delta into domain signal path if not deduped
        if (!result.deduped && result.appliedDelta > 0) {
          _applyDelta(result.domain, result.appliedDelta, result);
        }
      } else {
        _recordRejected(result);
      }
      return result;
    })
    .catch(function (err) {
      return { accepted: false, error: 'NETWORK_ERROR', message: err.message };
    });
  }

  // Synchronous ingest for testing (no fetch, processes pre-validated result)
  function processResult(result) {
    if (result.accepted) {
      _recordAccepted(result);
      if (!result.deduped && result.appliedDelta > 0) {
        _applyDelta(result.domain, result.appliedDelta, result);
      }
    } else {
      _recordRejected(result);
    }
    return result;
  }

  function _recordAccepted(result) {
    // Store event
    var events = _getEvents();
    events.push({
      id: result.id,
      timestamp: result.receivedAt || Date.now(),
      domain: result.domain,
      type: result.type,
      source: result.source,
      title: result.title || '',
      summary: result.summary || '',
      magnitude: result.magnitude,
      appliedDelta: result.appliedDelta,
      deduped: result.deduped,
      accepted: true,
      reason: null
    });
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

    // Update audit
    var audit = _getAudit();
    audit.accepted = (audit.accepted || 0) + 1;
    if (result.deduped) audit.deduped = (audit.deduped || 0) + 1;
    if (!audit.byDomain) audit.byDomain = {};
    audit.byDomain[result.domain] = (audit.byDomain[result.domain] || 0) + 1;
    if (!audit.byType) audit.byType = {};
    audit.byType[result.type] = (audit.byType[result.type] || 0) + 1;
    if (!audit.bySource) audit.bySource = {};
    audit.bySource[result.source] = (audit.bySource[result.source] || 0) + 1;
    audit.lastIngestAt = Date.now();
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));

    // Emit app event
    _emit('limen:external-signal-ingested', {
      domain: result.domain,
      type: result.type,
      source: result.source,
      appliedDelta: result.appliedDelta,
      deduped: result.deduped,
      ingestId: result.id
    });
  }

  function _recordRejected(result) {
    var audit = _getAudit();
    audit.rejected = (audit.rejected || 0) + 1;
    audit.lastIngestAt = Date.now();
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));
  }

  // Merge normalized delta into existing domain signal path
  // Does NOT replace stress — nudges it via LIMENDomains
  function _applyDelta(domain, delta, result) {
    var domains = window.LIMENDomains || {};
    if (!domains[domain]) return;

    // Additive nudge, capped at 1.0
    var current = domains[domain].stress || 0;
    var nudged = Math.min(1.0, current + delta);
    domains[domain].stress = Math.round(nudged * 1000) / 1000;

    // Add to domain signals if array exists
    if (domains[domain].signals && Array.isArray(domains[domain].signals)) {
      domains[domain].signals.push({
        type: 'external_' + result.type,
        text: (result.title || result.type) + ' (via ' + result.source + ')',
        severity: delta > 0.15 ? 'high' : (delta > 0.08 ? 'medium' : 'low')
      });
      // Keep last 10 signals
      if (domains[domain].signals.length > 10) {
        domains[domain].signals = domains[domain].signals.slice(-10);
      }
    }

    console.log('[LIMEN Ingest] Applied delta ' + delta + ' to ' + domain + ': ' + current.toFixed(3) + ' → ' + nudged.toFixed(3));
  }

  function getIngestAudit() {
    return _getAudit();
  }

  function getRecentEvents(limit) {
    return _getEvents().slice(-(limit || 20));
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENIngest = {
    ingest: ingest,
    processResult: processResult,
    getIngestAudit: getIngestAudit,
    getRecentEvents: getRecentEvents
  };

})();
