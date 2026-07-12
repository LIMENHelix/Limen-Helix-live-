/*
 * energy-telemetry-adapter.js  — wires runtime fields to the LIVE Energy telemetry source
 * ----------------------------------------------------------------------------
 * Live source: assets/js/energy-pulse-engine.js  (window.LIMENEnergyPulse) — the domain's
 * real "Live Feed Pulse Engine": computePulse(brainState) -> pulseState, getHistory() ->
 * [{stress,confidence,timestamp}]. brainState carries stress, diagnoses[]{id,active},
 * _activeConditions[].  Diagnosis ids == Energy issue ids.
 *
 * This adapter maps that live source onto the runtime fields added to energy.json, producing a
 * RUNTIME OVERLAY consumed at read-time. It does NOT write live values into energy.json (a
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
   * inputs: { energy, brainState, pulseState, history, priorOverlay }
   *   - brainState._activeConditions, brainState.diagnoses[]{id,active}
   *   - pulseState.timestamp (Date.now() at the cycle), pulseState.validatedDiagnoses[]
   *   - history from getHistory()
   *   - priorOverlay to carry forward timestamps for signals not firing this cycle */
  function fromPulse(inp) {
    inp = inp || {};
    var energy = inp.energy || {};
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

    // --- expand activeTriggers via the grounded alias table so extinction matches the
    //     activations' free-text diagnosticTriggers instead of retiring everything ---
    var al = inp.aliases;
    if (al) {
      var expanded = new Set(activeTriggers);
      conditions.forEach(function (c) {
        var e = al.conditionCodes && al.conditionCodes[c];
        if (e && e.diagnosticTriggers) e.diagnosticTriggers.forEach(function (t) { expanded.add(t); });
      });
      activeDx.forEach(function (id) {
        var e = al.diagnoses && al.diagnoses[id];
        if (e && e.diagnosticTriggers) e.diagnosticTriggers.forEach(function (t) { expanded.add(t); });
      });
      activeTriggers = Array.from(expanded);
    }

    // --- issue.lastFiredAt: active diagnosis fired now; others carried forward ---
    var issuesOverlay = {};
    (energy.issues || []).forEach(function (is) {
      var priorT = (prior.issues[is.id] || {}).lastFiredAt || null;
      var firingNow = activeDx.indexOf(is.id) !== -1;
      issuesOverlay[is.id] = { lastFiredAt: firingNow ? now : priorT };
    });

    // --- node.lastActiveAt/lastFiredAt: nodes in the circuit of an active diagnosis are active now ---
    // count how many ACTIVE diagnoses each node participates in (its circuit-participation load proxy)
    var participation = {};
    (energy.issues || []).forEach(function (is) {
      if (activeDx.indexOf(is.id) === -1) return;
      var circ = (is._authored || is.circuits || []);
      circ.forEach(function (c) { if (c && c.nodeId) participation[c.nodeId] = (participation[c.nodeId] || 0) + 1; });
    });
    var actsOverlay = {};
    (energy.activations || []).forEach(function (a) {
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
      _bound: ['volatility', 'activeTriggers', 'issue.lastFiredAt', 'activation.lastFiredAt', 'activation.lastActiveAt'],
      _unbound: { 'activation.load': 'no pulse source', 'activation.capacity': 'no pulse source', 'activeTriggers->diagnosticTriggers match': 'condition-code vocabulary != activation.diagnosticTriggers free-text; needs an alias table before extinction can match (authoring item, not guessed)' }
    };
  }

  /* Merge energy.json runtime DEFAULTS with the live OVERLAY -> the runtime state mechanisms read. */
  function resolveRuntime(energy, overlay) {
    var base = energy.runtime || {};
    var top = Object.assign({}, base, {
      volatility: (overlay && overlay.volatility != null) ? overlay.volatility : (base.volatility || 0),
      activeTriggers: (overlay && overlay.activeTriggers) ? overlay.activeTriggers : (base.activeTriggers != null ? base.activeTriggers : null),
      lastMaintenanceAt: (overlay && overlay.lastMaintenanceAt != null) ? overlay.lastMaintenanceAt : (base.lastMaintenanceAt || null)
    });
    var acts = {}; (energy.activations || []).forEach(function (a) {
      acts[a.brainNodeId] = Object.assign({}, a.runtime || {}, (overlay && overlay.activations && overlay.activations[a.brainNodeId]) || {});
    });
    var iss = {}; (energy.issues || []).forEach(function (is) {
      iss[is.id] = Object.assign({}, is.runtime || {}, (overlay && overlay.issues && overlay.issues[is.id]) || {});
    });
    return { top: top, activations: acts, issues: iss };
  }

  /* Live convenience (synchronous): caller supplies the energy definition + brainState. */
  function fromLive(energy, brainState, priorOverlay) {
    var P = (typeof window !== 'undefined' && window.LIMENEnergyPulse) ? window.LIMENEnergyPulse : null;
    if (!P) return null;
    return fromPulse({ energy: energy, brainState: brainState, pulseState: P.getPulse(), history: P.getHistory(), priorOverlay: priorOverlay });
  }

  /* Self-contained live wiring: the adapter loads (and caches) its OWN energy definition, so the
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
    var P = (typeof window !== 'undefined' && window.LIMENEnergyPulse) ? window.LIMENEnergyPulse : null;
    if (!P) return Promise.resolve(null);
    return Promise.all([
      _load('/assets/data/domains/energy.json', 'energy'),
      _load('/assets/data/energy-condition-trigger-aliases.json', 'aliases').catch(function () { return null; }) // best-effort
    ]).then(function (res) {
      return fromPulse({ energy: res[0], aliases: res[1], brainState: brainState, pulseState: P.getPulse(), history: (typeof P.getHistory === 'function') ? P.getHistory() : [], priorOverlay: priorOverlay });
    });
  }

  var API = { deriveVolatility: deriveVolatility, fromPulse: fromPulse, resolveRuntime: resolveRuntime, fromLive: fromLive, fromLiveCached: fromLiveCached };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.EnergyTelemetryAdapter) root.EnergyTelemetryAdapter = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
