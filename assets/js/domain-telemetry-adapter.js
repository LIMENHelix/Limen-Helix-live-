/*
 * domain-telemetry-adapter.js  — GENERIC (domain-parameterized) telemetry adapter
 * ----------------------------------------------------------------------------
 * The reusable version of energy-telemetry-adapter.js, for ALL domains beyond Energy.
 * Maps a domain's live pulse (window.LIMEN{Domain}Pulse) onto a runtime overlay, consumed
 * at read-time. Loads the domain's own {domain}.json + {domain}-condition-trigger-aliases.json.
 * Energy keeps its own adapter (already deployed); this serves finance + the batched waves.
 *
 * Grounding identical to the Energy adapter: volatility<-XIII.6, activeTriggers<-V.2 (alias-
 * expanded), lastFired/lastActive<-III.3/IV.6, load proxy = active-diagnosis participation.
 * Advisory only: produces an overlay; never mutates the brain or the domain file.
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  function deriveVolatility(history) {
    var h = (history || []).filter(function (x) { return x && typeof x.stress === 'number'; });
    if (h.length < 2) return 0;
    var sum = 0; for (var i = 1; i < h.length; i++) sum += Math.abs(h[i].stress - h[i - 1].stress);
    return Math.max(0, Math.min(1, sum / (h.length - 1)));
  }

  function fromPulse(inp) {
    inp = inp || {};
    var dom = inp.domain || {}, bs = inp.brainState || {}, ps = inp.pulseState || {}, al = inp.aliases;
    var now = (typeof ps.timestamp === 'number') ? ps.timestamp : (bs.timestamp || null);
    var prior = inp.priorOverlay || { activations: {}, issues: {} };

    var volatility = deriveVolatility(inp.history);

    var activeDx = [];
    var diags = bs.diagnoses || (ps.validatedDiagnoses || []).map(function (v) { return v.diagnosis; });
    (diags || []).forEach(function (d) { if (d && d.active) activeDx.push(d.id); });
    var conditions = bs._activeConditions || [];
    var activeTriggers = Array.from(new Set([].concat(conditions, activeDx)));
    if (al) {
      var expanded = new Set(activeTriggers);
      conditions.forEach(function (c) { var e = al.conditionCodes && al.conditionCodes[c]; if (e && e.diagnosticTriggers) e.diagnosticTriggers.forEach(function (t) { expanded.add(t); }); });
      activeDx.forEach(function (id) { var e = al.diagnoses && al.diagnoses[id]; if (e && e.diagnosticTriggers) e.diagnosticTriggers.forEach(function (t) { expanded.add(t); }); });
      activeTriggers = Array.from(expanded);
    }

    var issuesOverlay = {};
    (dom.issues || []).forEach(function (is) {
      var priorT = (prior.issues[is.id] || {}).lastFiredAt || null;
      issuesOverlay[is.id] = { lastFiredAt: (activeDx.indexOf(is.id) !== -1) ? now : priorT };
    });

    var participation = {};
    (dom.issues || []).forEach(function (is) {
      if (activeDx.indexOf(is.id) === -1) return;
      (is._authored || is.circuits || []).forEach(function (c) { if (c && c.nodeId) participation[c.nodeId] = (participation[c.nodeId] || 0) + 1; });
    });
    var actsOverlay = {};
    (dom.activations || []).forEach(function (a) {
      var p = prior.activations[a.brainNodeId] || {}, count = participation[a.brainNodeId] || 0, activeNow = count > 0;
      actsOverlay[a.brainNodeId] = {
        lastFiredAt: activeNow ? now : (p.lastFiredAt || null),
        lastActiveAt: activeNow ? now : (p.lastActiveAt || null),
        load: count, capacity: 1
      };
    });

    return { volatility: volatility, activeTriggers: activeTriggers, lastMaintenanceAt: (prior.lastMaintenanceAt || null), timestamp: now, activations: actsOverlay, issues: issuesOverlay };
  }

  function resolveRuntime(dom, overlay) {
    var base = dom.runtime || {};
    var top = Object.assign({}, base, {
      volatility: (overlay && overlay.volatility != null) ? overlay.volatility : (base.volatility || 0),
      activeTriggers: (overlay && overlay.activeTriggers) ? overlay.activeTriggers : (base.activeTriggers != null ? base.activeTriggers : null),
      lastMaintenanceAt: (overlay && overlay.lastMaintenanceAt != null) ? overlay.lastMaintenanceAt : (base.lastMaintenanceAt || null)
    });
    var acts = {}; (dom.activations || []).forEach(function (a) { acts[a.brainNodeId] = Object.assign({}, a.runtime || {}, (overlay && overlay.activations && overlay.activations[a.brainNodeId]) || {}); });
    var iss = {}; (dom.issues || []).forEach(function (is) { iss[is.id] = Object.assign({}, is.runtime || {}, (overlay && overlay.issues && overlay.issues[is.id]) || {}); });
    return { top: top, activations: acts, issues: iss };
  }

  var _cache = {};
  function _load(url, key) {
    if (_cache[key]) return Promise.resolve(_cache[key]);
    if (typeof window === 'undefined' && typeof require === 'function') {
      try { var path = require('path'), fs = require('fs'); _cache[key] = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), url.replace(/^\//, '')), 'utf8')); return Promise.resolve(_cache[key]); } catch (e) { return Promise.reject(e); }
    }
    return fetch(url).then(function (r) { return r.json(); }).then(function (v) { _cache[key] = v; return v; });
  }
  function _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* The one call a domain brain makes each cycle. domainId e.g. 'finance'. */
  function fromLiveCached(domainId, brainState, priorOverlay) {
    var g = (typeof window !== 'undefined') ? window['LIMEN' + _cap(domainId) + 'Pulse'] : null;
    if (!g) return Promise.resolve(null);
    return Promise.all([
      _load('/assets/data/domains/' + domainId + '.json', domainId),
      _load('/assets/data/' + domainId + '-condition-trigger-aliases.json', domainId + '-aliases').catch(function () { return null; })
    ]).then(function (res) {
      return fromPulse({ domain: res[0], aliases: res[1], brainState: brainState, pulseState: g.getPulse(), history: (typeof g.getHistory === 'function') ? g.getHistory() : [], priorOverlay: priorOverlay });
    });
  }

  var API = { deriveVolatility: deriveVolatility, fromPulse: fromPulse, resolveRuntime: resolveRuntime, fromLiveCached: fromLiveCached };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.DomainTelemetryAdapter) root.DomainTelemetryAdapter = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
