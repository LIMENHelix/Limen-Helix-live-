/**
 * LIMEN Defense Signal Engine — Phase 14B
 *
 * Polls /api/defense-signals, processes classified RSS clusters,
 * feeds normalized signals into existing domain signal path.
 *
 * Replaces ACLED-dependent defense sensing with:
 *   Primary: Google News RSS keyword clustering
 *   Baseline: UCDP (future)
 *   Fallback: ACLED (demoted)
 *
 * Systemic shock detection triggers cross-domain escalation.
 */
(function () {
  'use strict';

  var POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  var ENDPOINT = '/api/defense-signals';
  var _pollTimer = null;
  var _lastPollAt = 0;
  var _lastSignals = [];
  var _macroShock = false;

  function _emit(name, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      detail.eventVersion = 1;
      detail.timestamp = Date.now();
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    }
  }

  function poll() {
    return fetch(ENDPOINT)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _lastPollAt = Date.now();
        _lastSignals = data.signals || [];
        _macroShock = data.macroShock && data.macroShock.detected;

        console.log('[LIMEN Defense] ' + data.totalArticles + ' articles, ' +
          data.signals.length + ' signal clusters, macro shock: ' + _macroShock);

        // Feed each domain signal through existing ingestion path
        var domainSignals = data.domainSignals || [];
        for (var di = 0; di < domainSignals.length; di++) {
          var ds = domainSignals[di];
          _applyDefenseSignal(ds);
        }

        // Macro shock event
        if (_macroShock) {
          _emit('limen:macro-shock-detected', {
            domains: data.macroShock.domains,
            affectedDomainCount: data.macroShock.affectedDomainCount,
            signals: data.signals.filter(function(s) { return s.confidence !== 'LOW'; }).map(function(s) {
              return s.eventType + ' (' + s.confidence + ', ' + s.articleCount + ' articles)';
            })
          });
          console.log('[LIMEN Defense] MACRO SHOCK: ' + data.macroShock.domains.join(', '));
        }

        return data;
      })
      .catch(function (err) {
        console.error('[LIMEN Defense] Poll failed:', err.message);
        return null;
      });
  }

  function _applyDefenseSignal(ds) {
    var domains = window.LIMENDomains || {};
    if (!domains[ds.domain]) return;

    // Compute bounded delta from normalized magnitude
    // Scale: magnitude is already 0-1 from the API, cap applied effect
    var delta = Math.min(0.25, ds.normalizedMagnitude * 0.3);
    if (delta < 0.01) return; // ignore noise

    // Apply additive nudge (same path as limen-ingest)
    var current = domains[ds.domain].stress || 0;
    var nudged = Math.min(1.0, current + delta);
    domains[ds.domain].stress = Math.round(nudged * 1000) / 1000;

    // Add to signals array
    if (domains[ds.domain].signals && Array.isArray(domains[ds.domain].signals)) {
      var topEvent = ds.events[0];
      domains[ds.domain].signals.push({
        type: 'defense_' + (topEvent ? topEvent.type.toLowerCase() : 'signal'),
        text: _buildSignalText(ds),
        severity: ds.maxConfidence === 'HIGH' ? 'high' : (ds.maxConfidence === 'MEDIUM' ? 'medium' : 'low')
      });
      if (domains[ds.domain].signals.length > 10) {
        domains[ds.domain].signals = domains[ds.domain].signals.slice(-10);
      }
    }

    console.log('[LIMEN Defense] DELTA APPLIED: ' + ds.domain + ' +' + delta.toFixed(3) +
      ' (' + current.toFixed(3) + ' -> ' + nudged.toFixed(3) + ') source=RSS_CLUSTER conf=' + ds.maxConfidence);

    // Emit through standard path
    _emit('limen:external-signal-ingested', {
      domain: ds.domain,
      type: 'defense_cluster',
      source: 'rss_news',
      appliedDelta: delta,
      deduped: false,
      confidence: ds.maxConfidence,
      eventTypes: ds.events.map(function(e) { return e.type; })
    });
  }

  function _buildSignalText(ds) {
    var parts = [];
    for (var ei = 0; ei < Math.min(ds.events.length, 2); ei++) {
      var e = ds.events[ei];
      parts.push(e.type.replace(/_/g, ' ').toLowerCase() + ' (' + e.articleCount + ' articles)');
    }
    return parts.join(' + ') + ' · ' + ds.maxConfidence + ' confidence';
  }

  // Start polling
  function start() {
    if (_pollTimer) return;
    poll(); // immediate first poll
    _pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    console.log('[LIMEN Defense] Signal engine started (every ' + (POLL_INTERVAL_MS / 1000) + 's)');
  }

  function stop() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  function getStatus() {
    return {
      running: !!_pollTimer,
      lastPollAt: _lastPollAt,
      signalCount: _lastSignals.length,
      macroShock: _macroShock,
      signals: _lastSignals
    };
  }

  // Auto-start on load
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 3000); });
    } else {
      setTimeout(start, 3000);
    }
  }

  window.LIMENDefenseSignals = {
    start: start,
    stop: stop,
    poll: poll,
    getStatus: getStatus
  };

})();
