/* node-business-guard.js — one canonical brake for the 20 per-domain business
 * engines, applied on the operator console.
 *
 * Each domain-console dynamically loads a window.LIMEN<Domain>BusinessEngine
 * whose hardcoded NODE_DIRECTORY binds ~34 node->business entries, ~30 of them
 * onto NON-nodes (DMN, BDNF, GABA_GLU, ASTRO, BBB, HPA, FPN, STRI, ...). Those
 * are the same phantom bindings lib/node-guard, portal-ui, and connectome-
 * resolver already refuse elsewhere. This closes the last surface: it patches
 * every business engine to read the ONE source of truth (canonical-nodes.json)
 * and refuse a business binding on a non-node — pruning the directory AND
 * filtering runInference output. Loaded once on domain-console.html; covers all
 * 20 domains because that is the only page the engines load on. Degrade-safe.
 */
(function () {
  'use strict';
  var NODES = null, patched = 0, brakedByEngine = {};
  function real(id) { return !!(NODES && NODES[id] && NODES[id].canBindBusiness); }

  function patch(name, eng) {
    if (!eng || eng.__nbGuarded) return;
    eng.__nbGuarded = true;
    var braked = [];
    // 1) prune the hardcoded directory so non-nodes never enter a fresh inference
    var dir = eng.NODE_DIRECTORY;
    if (dir && typeof dir === 'object') {
      for (var k in dir) {
        if (Object.prototype.hasOwnProperty.call(dir, k) && !real(k)) { braked.push(k); delete dir[k]; }
      }
    }
    // 2) filter runInference output (belt + suspenders: also catches cached paths)
    if (typeof eng.runInference === 'function') {
      var orig = eng.runInference.bind(eng);
      eng.runInference = function () {
        var r = orig.apply(null, arguments);
        if (r) ['mapped', 'missing', 'speculative'].forEach(function (key) {
          if (Array.isArray(r[key])) r[key] = r[key].filter(function (e) {
            return real(e && (e.nodeId || e.node || e.brainNodeId || e.id));
          });
        });
        return r;
      };
    }
    patched++; brakedByEngine[name] = braked;
    if (braked.length) console.log('[NodeBusinessGuard] ' + name + ': braked ' + braked.length +
      ' non-node business bindings (' + braked.slice(0, 8).join(',') + (braked.length > 8 ? '…' : '') + ')');
  }

  function scan() {
    if (!NODES) return;
    for (var k in window) {
      try { if (/^LIMEN.*BusinessEngine$/.test(k) && window[k] && typeof window[k] === 'object') patch(k, window[k]); }
      catch (e) { /* cross-origin / getter throw — skip */ }
    }
  }

  fetch('/assets/data/canonical-nodes.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      NODES = (j && j.nodes) || {};
      scan();
      // Engines load dynamically after the brain boots; scan a bounded window.
      var n = 0, t = setInterval(function () { scan(); if (++n > 80) clearInterval(t); }, 750); // ~60s
      window.LIMENNodeBusinessGuard = { rescan: scan, stats: function () { return { enginesPatched: patched, braked: brakedByEngine }; } };
    })
    .catch(function () {});
})();
