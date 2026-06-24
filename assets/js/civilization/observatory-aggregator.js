/**
 * observatory-aggregator.js — Civilization Opportunity Observatory aggregator
 *
 * READ-ONLY aggregation surface. Subscribes to existing brain output
 * (window.LIMENDomainBrains.getAll()) and projects each brain's
 * state.opportunities[] into a flat in-memory packet list.
 *
 * Network discipline:
 *   - Issues NO HTTP requests.
 *   - Issues NO portal fetches.
 *   - Issues NO /api/* calls.
 *   - Reads only what brain pipelines already produce per cycle.
 *
 * Re-aggregates on:
 *   - 'limen:domain-brain-update' event (per-brain emit)
 *   - 'limen:domain-update' event (signal-engine cross-cycle emit)
 *   - 5s soft-poll fallback (synchronous, no network)
 *
 * Exposes: window.LIMENObservatory
 *   getPackets()           // array of OpportunityPacket
 *   getStatus()            // { ready, brainCount, packetCount, lastUpdate }
 *   subscribe(callback)    // callback(packets) on every refresh
 *   refresh()              // force re-aggregation (sync)
 */
(function () {
  'use strict';

  // ─── Canonical domain map (Patch D2-A3) ────────────────────────────────
  // Mirror of DOMAIN_ALIASES in assets/js/executive/limen-exec-generator.js.
  // Three brains emit non-canonical runtime keys (medicine-brain → 'health',
  // science-brain → 'research', trade-brain → 'supplyChain'); a fourth
  // legacy key 'p2_agri' may surface from internal portal nomenclature.
  // This map canonicalizes packet.domain at the aggregator boundary so all
  // downstream consumers (Observatory UI, packetToOpp, Patent/SBA generators)
  // see canonical domain keys without per-consumer alias logic.
  //
  // INVARIANT: any future addition or removal of a key must be made in BOTH
  // this file and limen-exec-generator.js DOMAIN_ALIASES. When a third
  // consumer needs the same map, extract to a shared module
  // (e.g., assets/js/domain-canonicalizer.js) and load before both.
  var DOMAIN_CANONICAL = {
    health:       'medicine',     // medicine-brain emits domainId 'health'
    research:     'science',      // science-brain emits domainId 'research'
    supplyChain:  'trade',        // trade-brain emits domainId 'supplyChain'
    p2_agri:      'agriculture'   // legacy/internal portal-prefix key
  };
  // science is a PRIMARY source-domain brain (not secondary): science-brain
  // emits domainId 'research' (runtime/snapshot key); gateway uses canonical
  // 'science' (URL/portal key) via the dual-naming pattern in
  // assets/js/domain-identity.js (science.snapshotKey === 'research'). Its
  // brain-emitted opportunities flow into the artifact lanes documented in
  // handoff-contract.js: research-grants, nsf-project-pitch, research-papers,
  // analysis-fusion-capability, semiconductor-IP, supply-chain-mapping. Like
  // medicine-brain (health → medicine, line 42), science negotiates as its own
  // source domain — keep it DISTINCT from technology (applied product dev),
  // medicine (clinical research), and education (academic teaching) couplings.

  var _packets = [];
  var _subscribers = [];
  var _lastUpdate = 0;
  var _ready = false;

  function _readBrains() {
    var registry = window.LIMENDomainBrains;
    if (!registry || typeof registry.getAll !== 'function') return null;
    return registry.getAll() || {};
  }

  function _projectOpp(opp, brain, domainId, idx) {
    // Project a brain-authored opportunity into a packet.
    // Field shape mirrors the existing brain output (agriculture-brain,
    // energy-brain, etc.). Do not derive new state. Do not invent fields.
    //
    // Patch D2-A3: packet.domain is canonicalized via DOMAIN_CANONICAL so
    // downstream consumers always see canonical keys (e.g., medicine,
    // science, trade, agriculture). The original brain-emitted key is
    // preserved in packet.rawDomain for traceability and for search-hay
    // matching.
    var rawDomainKey = opp.domain || domainId;
    return {
      id: opp.id || (domainId + '_opp_' + idx),
      domain: DOMAIN_CANONICAL[rawDomainKey] || rawDomainKey,
      rawDomain: rawDomainKey,
      title: opp.title || '(untitled opportunity)',
      path: opp.path || (opp.paths && opp.paths[0]) || 'UNCLASSIFIED',
      paths: opp.paths || (opp.path ? [opp.path] : []),
      tier: typeof opp.tier === 'number' ? opp.tier : 0,
      urgency: opp.urgency || opp.urgencyLabel || '',
      rank: typeof opp.rank === 'number' ? opp.rank : 0,
      confidence: typeof opp.confidence === 'number' ? opp.confidence : 0,
      stress: typeof opp.stress === 'number' ? opp.stress : (brain.state && brain.state.stress) || 0,
      source: opp.source || '',
      diagnosisId: opp.diagnosisId || opp.nearDiagnosisId || '',
      companies: opp.companies || [],
      whyNow: opp.whyNow || opp.title || '',
      explain: opp.explain || '',
      action: opp.action || '',
      valueRange: opp.valueRange || '',
      window: opp.window || '',
      moneyChain: opp.moneyChain || null,
      compensation: opp.compensation || null,
      validity: opp.validity || null,
      playbookId: opp.playbookId || '',
      trigger: opp.trigger || '',
      validation: opp.validation || '',
      outcome: opp.outcome || '',
      failure: opp.failure || ''
    };
  }

  function _collect() {
    var brains = _readBrains();
    if (!brains) return [];
    var packets = [];
    for (var domainId in brains) {
      if (!brains.hasOwnProperty(domainId)) continue;
      var brain = brains[domainId];
      if (!brain || !brain.state) continue;
      var opps = brain.state.opportunities || [];
      for (var i = 0; i < opps.length; i++) {
        var opp = opps[i];
        if (!opp) continue;
        try {
          packets.push(_projectOpp(opp, brain, domainId, i));
        } catch (e) {
          // Skip malformed opps silently — never crash aggregation.
        }
      }
    }
    return packets;
  }

  function _refresh() {
    var next = _collect();
    var changed = next.length !== _packets.length;
    _packets = next;
    _lastUpdate = Date.now();

    var brains = _readBrains();
    var brainCount = brains ? Object.keys(brains).length : 0;
    _ready = brainCount > 0;

    // Notify subscribers regardless of count change so UI can flip
    // from "warming up" to "0 opportunities yet" to "N opportunities".
    for (var i = 0; i < _subscribers.length; i++) {
      try { _subscribers[i](_packets); } catch (e) { /* swallow */ }
    }
  }

  function getPackets() {
    return _packets;
  }

  function getStatus() {
    var brains = _readBrains();
    var brainCount = brains ? Object.keys(brains).length : 0;
    return {
      ready: _ready,
      brainCount: brainCount,
      packetCount: _packets.length,
      lastUpdate: _lastUpdate
    };
  }

  function subscribe(callback) {
    if (typeof callback === 'function') _subscribers.push(callback);
  }

  function refresh() {
    _refresh();
  }

  window.LIMENObservatory = {
    getPackets: getPackets,
    getStatus: getStatus,
    subscribe: subscribe,
    refresh: refresh
  };

  // Subscribe to brain update events from the existing pipeline.
  // These events are dispatched by domain-brain-base.cycle() and by
  // domain-signal-engine on each cycle.
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('limen:domain-brain-update', _refresh);
    window.addEventListener('limen:domain-update', _refresh);
  }

  // Soft poll covers the case where events drop or fire before this
  // script is loaded. 5s cadence, fully synchronous, no network.
  if (typeof setInterval === 'function') {
    setInterval(_refresh, 5000);
  }

  // Initial pass — usually finds 0 brains; subsequent ticks pick up
  // state as brains complete their first cycle.
  _refresh();

})();
