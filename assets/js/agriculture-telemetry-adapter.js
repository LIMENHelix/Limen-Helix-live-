/*
 * agriculture-telemetry-adapter.js  — wires runtime fields to the LIVE Agriculture telemetry source
 * ----------------------------------------------------------------------------
 * Live source: assets/js/agriculture-pulse-engine.js  (window.LIMENAgriculturePulse) — the domain's
 * real "Live Feed Pulse Engine": computePulse(brainState) -> pulseState, getHistory() ->
 * [{stress,confidence,timestamp}]. brainState carries stress, diagnoses[]{id,active},
 * _activeConditions[].  Diagnosis ids == Agriculture issue ids.
 *
 * This adapter maps that live source onto the runtime fields added to agriculture.json, producing a
 * RUNTIME OVERLAY consumed at read-time. It does NOT write live values into agriculture.json (a
 * definition file must not be thrashed every cycle). resolveRuntime() merges defaults + overlay.
 *
 * Grounding: volatility <- XIII.6 (adapts to recent activity); activeTriggers <- V.2; issue/node
 * lastFiredAt/lastActiveAt <- III.3 / IV.6. load/capacity has NO pulse source -> stays null,
 * flagged. Nothing fabricated.
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  /* volatility in [0,1] = mean absolute change in stress across the history window.
   * stress is already [0,1], so its mean abs delta is naturally [0,1] — no magic constant. */
  function deriveVolatility(history) {
    var h = (history || []).filter(function (x) { return x && typeof x.stress === 'number'; });
    if (h.length < 2) return 0; // not enough history to measure change => calm/unknown
    var sum = 0;
    for (var i = 1; i < h.length; i++) sum += Math.abs(h[i].stress - h[i - 1].stress);
    return Math.max(0, Math.min(1, sum / (h.length - 1)));
  }

  /* Map a live pulse cycle onto a runtime overlay.
   * inputs: { agriculture, brainState, pulseState, history, priorOverlay }
   *   - brainState._activeConditions, brainState.diagnoses[]{id,active}
   *   - pulseState.timestamp (Date.now() at the cycle), pulseState.validatedDiagnoses[]
   *   - history from getHistory()
   *   - priorOverlay to carry forward timestamps for signals not firing this cycle */
  function fromPulse(inp) {
    inp = inp || {};
    var agriculture = inp.agriculture || {};
    var bs = inp.brainState || {};
    var ps = inp.pulseState || {};
    var now = (typeof ps.timestamp === 'number') ? ps.timestamp : (bs.timestamp || null);
    var prior = inp.priorOverlay || { activations: {}, issues: {} };

    // --- volatility (metaplasticity) ---
    var volatility = deriveVolatility(inp.history);

    // --- activeTriggers (extinction): real active conditions + active diagnosis ids ---
    var activeDx = [];
    var diags = bs.diagnoses || (ps.validatedDiagnoses || []).map(function (v) { return v.diagnosis; });
    (diags || []).forEach(function (d) { if (d && d.active) activeDx.push(d.id); });
    var conditions = bs._activeConditions || [];
    var activeTriggers = Array.from(new Set([].concat(conditions, activeDx)));

    // --- expand active diagnoses through Agriculture's OWN p2_agri anatomy ---
    // No second alias dataset is needed. The local brain has already classified
    // conditions into active diagnosis ids; each id names a p2_agri issue whose
    // circuit names local activations, and those activations carry the free-text
    // diagnosticTriggers consumed by extinction.
    var expanded = new Set(activeTriggers);
    var activeNodes = new Set();
    (agriculture.issues || []).forEach(function (issue) {
      if (!issue || activeDx.indexOf(issue.id) === -1) return;
      (issue._authored || issue.circuits || []).forEach(function (circuit) {
        if (circuit && circuit.nodeId) activeNodes.add(circuit.nodeId);
      });
    });
    (agriculture.activations || []).forEach(function (activation) {
      if (!activation || !activeNodes.has(activation.brainNodeId)) return;
      (activation.diagnosticTriggers || []).forEach(function (trigger) { expanded.add(trigger); });
    });
    activeTriggers = Array.from(expanded);

    // --- issue.lastFiredAt: active diagnosis fired now; others carried forward ---
    var issuesOverlay = {};
    (agriculture.issues || []).forEach(function (is) {
      var priorT = (prior.issues[is.id] || {}).lastFiredAt || null;
      var firingNow = activeDx.indexOf(is.id) !== -1;
      issuesOverlay[is.id] = { lastFiredAt: firingNow ? now : priorT };
    });

    // --- node.lastActiveAt/lastFiredAt: nodes in the circuit of an active diagnosis are active now ---
    // count how many ACTIVE diagnoses each node participates in (its circuit-participation load proxy)
    var participation = {};
    (agriculture.issues || []).forEach(function (is) {
      if (activeDx.indexOf(is.id) === -1) return;
      var circ = (is._authored || is.circuits || []);
      circ.forEach(function (c) { if (c && c.nodeId) participation[c.nodeId] = (participation[c.nodeId] || 0) + 1; });
    });
    var actsOverlay = {};
    (agriculture.activations || []).forEach(function (a) {
      var p = prior.activations[a.brainNodeId] || {};
      var count = participation[a.brainNodeId] || 0;
      var activeNow = count > 0;
      actsOverlay[a.brainNodeId] = {
        lastFiredAt: activeNow ? now : (p.lastFiredAt || null),
        lastActiveAt: activeNow ? now : (p.lastActiveAt || null),
        // load PROXY: # of simultaneously-active diagnoses whose circuit includes this node.
        // capacity 1 => a node stressed by 2+ concurrent failures reads as overloaded (load>capacity),
        // which is what the retrograde throttle acts on. A proxy (no direct pulse load field), labeled.
        load: count,
        capacity: 1
      };
    });

    return {
      volatility: volatility,
      activeTriggers: activeTriggers,
      lastMaintenanceAt: (prior.lastMaintenanceAt || null), // not a pulse signal; managed by offline pass
      timestamp: now,
      activations: actsOverlay,
      issues: issuesOverlay,
      _bound: ['volatility', 'activeTriggers', 'activeDiagnosis->p2_agri.circuit->diagnosticTriggers', 'issue.lastFiredAt', 'activation.lastFiredAt', 'activation.lastActiveAt'],
      _unbound: { 'activation.load': 'no pulse source', 'activation.capacity': 'no pulse source' }
    };
  }

  /* Merge agriculture.json runtime DEFAULTS with the live OVERLAY -> the runtime state mechanisms read. */
  function resolveRuntime(agriculture, overlay) {
    var base = agriculture.runtime || {};
    var top = Object.assign({}, base, {
      volatility: (overlay && overlay.volatility != null) ? overlay.volatility : (base.volatility || 0),
      activeTriggers: (overlay && overlay.activeTriggers) ? overlay.activeTriggers : (base.activeTriggers != null ? base.activeTriggers : null),
      lastMaintenanceAt: (overlay && overlay.lastMaintenanceAt != null) ? overlay.lastMaintenanceAt : (base.lastMaintenanceAt || null)
    });
    var acts = {}; (agriculture.activations || []).forEach(function (a) {
      acts[a.brainNodeId] = Object.assign({}, a.runtime || {}, (overlay && overlay.activations && overlay.activations[a.brainNodeId]) || {});
    });
    var iss = {}; (agriculture.issues || []).forEach(function (is) {
      iss[is.id] = Object.assign({}, is.runtime || {}, (overlay && overlay.issues && overlay.issues[is.id]) || {});
    });
    return { top: top, activations: acts, issues: iss };
  }

  /* Live convenience (synchronous): caller supplies the agriculture definition + brainState. */
  function fromLive(agriculture, brainState, priorOverlay) {
    var P = (typeof window !== 'undefined' && window.LIMENAgriculturePulse) ? window.LIMENAgriculturePulse : null;
    if (!P) return null;
    return fromPulse({ agriculture: agriculture, brainState: brainState, pulseState: P.getPulse(), history: P.getHistory(), priorOverlay: priorOverlay });
  }

  /* Self-contained live wiring: the adapter loads (and caches) its OWN agriculture definition, so the
   * in-loop call needs only the live brainState. Returns a Promise<overlay|null>. This is the
   * one call the domain brain makes each cycle; it depends on nothing in the brain's data model. */
  var _cache = {};
  function _load(url, key) {
    if (_cache[key]) return Promise.resolve(_cache[key]);
    if (typeof window === 'undefined' && typeof require === 'function') {
      try { var path = require('path'), fs = require('fs'); _cache[key] = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), url.replace(/^\//, '')), 'utf8')); return Promise.resolve(_cache[key]); } catch (e) { return Promise.reject(e); }
    }
    return fetch(url).then(function (r) { return r.json(); }).then(function (v) { _cache[key] = v; return v; });
  }
  function fromLiveCached(brainState, priorOverlay) {
    var P = (typeof window !== 'undefined' && window.LIMENAgriculturePulse) ? window.LIMENAgriculturePulse : null;
    if (!P) return Promise.resolve(null);
    return _load('/assets/data/domains/p2_agri.json', 'agriculture').then(function (agriculture) {
      return fromPulse({ agriculture: agriculture, brainState: brainState, pulseState: P.getPulse(), history: (typeof P.getHistory === 'function') ? P.getHistory() : [], priorOverlay: priorOverlay });
    });
  }

  var API = { deriveVolatility: deriveVolatility, fromPulse: fromPulse, resolveRuntime: resolveRuntime, fromLive: fromLive, fromLiveCached: fromLiveCached };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.AgricultureTelemetryAdapter) root.AgricultureTelemetryAdapter = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
