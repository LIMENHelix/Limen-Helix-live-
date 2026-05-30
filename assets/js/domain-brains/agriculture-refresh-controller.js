/**
 * agriculture-refresh-controller.js — Agriculture Domain State (shared snapshot consumer)
 *
 * Consumes shared snapshot from LIMENSharedSnapshot instead of fetching independently.
 * Writes to window.LIMENAgricultureFresh (shared state).
 * Dispatches 'limen:agriculture-refresh' event.
 */
(function () {
  'use strict';

  var DOMAIN_KEY = 'agriculture';

  window.LIMENAgricultureFresh = {
    domain: DOMAIN_KEY,
    stress: 0,
    confidence: 0,
    activity: 0,
    maturity: 'EARLY',
    phase: 'p0',
    signals: [],
    sources: [],
    status: 'INIT',
    fetchedAt: null,
    snapshotAge: null,
    snapshotId: null,
    liveCount: 0,
    cycle: 0
  };

  var F = window.LIMENAgricultureFresh;

  function onSnapshot(snap) {
    F.fetchedAt = Date.now();
    F.cycle++;

    if (snap && snap.domains && snap.domains[DOMAIN_KEY]) {
      var d = snap.domains[DOMAIN_KEY];
      F.stress = d.stress || 0;
      F.confidence = d.confidence || 0;
      F.activity = d.activity || 0;
      F.maturity = d.maturity || 'EARLY';
      F.phase = d.phase || 'p0';
      F.signals = d.signals || [];
      F.sources = d.sources || [];
      F.liveCount = d.liveCount || 0;
      F.status = (d.status === 'FALLBACK') ? 'DEGRADED' : 'LIVE';
      F.snapshotAge = snap.meta ? (Date.now() - new Date(snap.meta.fetchedAt).getTime()) : null;
      F.snapshotId = snap.meta ? snap.meta.snapshotId : null;

      try {
        if (window.LIMENDomains && typeof window.LIMENDomains === 'object') {
          window.LIMENDomains[DOMAIN_KEY] = d;
        } else {
          var update = {};
          update[DOMAIN_KEY] = d;
          window.LIMENDomains = update;
        }
      } catch (e) {}
    } else {
      F.status = 'DEGRADED';
    }

    try {
      document.dispatchEvent(new CustomEvent('limen:agriculture-refresh', { detail: F }));
    } catch (e) {
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('limen:agriculture-refresh', true, true, F);
      document.dispatchEvent(evt);
    }
  }

  // Subscribe to shared snapshot engine (no independent fetch)
  if (window.LIMENSharedSnapshot) {
    window.LIMENSharedSnapshot.subscribe(function (type, data) {
      if (type === 'update') onSnapshot(data);
    });
    // Process any already-cached snapshot
    var cached = window.LIMENSharedSnapshot.getSnapshot();
    if (cached) onSnapshot(cached);
  } else {
    // Fallback: if shared engine not loaded, do one direct fetch
    setTimeout(function () {
      fetch('/api/domain-snapshot')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) { if (data) onSnapshot(data); })
        .catch(function () {});
    }, 1000);
  }

  window.LIMENAgricultureRefresh = { refresh: function () { if (window.LIMENSharedSnapshot) window.LIMENSharedSnapshot.requestFresh(); }, state: F };

})();
