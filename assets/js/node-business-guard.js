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
  var NODES = null, GENERIC = null, patched = 0, brakedByEngine = {};
  function real(id) { return !!(NODES && NODES[id] && NODES[id].canBindBusiness); }

  // A4: a business TYPE recycled across >=2 domain engines cannot be a node-SPECIFIC
  // signal. Stamp nonSpecific so nothing presents a generic category as an earned
  // node->company mapping. (A4's bulk was the phantom non-node clones, braked in A3.)
  function markGeneric(c) {
    if (c && typeof c === 'object' && GENERIC && c.type && GENERIC[c.type]) { c.nonSpecific = true; }
  }

  // A2/C1: attach the DEFENSIBLE motif->function layer to a business entry so the
  // engine renders node->motif->function (structural, from the docs) alongside the
  // empirical guess. fractalWeight/tier let the UI mark true cross-domain transfer
  // (M6/M8/M11) vs T3 control-law universality vs unvalidated analogy.
  function enrich(entry, id) {
    var rec = NODES[id]; if (!rec || !entry || typeof entry !== 'object') return;
    entry.motif = rec.motif || null;
    entry.businessFunction = rec.businessFunction || null;
    entry.isomorphismTier = rec.tier || null;
    entry.fractalWeight = !!rec.fractalWeight;
    entry.mappingClass = rec.fractalWeight ? 'fractal-bearing (M6/M8/M11)' : (rec.motif ? 'T3 control-law (doctrine-neutral)' : 'unvalidated analogy');
  }
  // A1: a fabricated confidence float on a node->company GUESS is the forbidden
  // anti-pattern. Keep the number (internal ordering) but relabel it honestly as an
  // UNVALIDATED analogy strength so nothing presents it as earned confidence.
  function unvalidate(c) {
    if (c && typeof c === 'object' && typeof c.confidence === 'number' && c.analogyStrength === undefined) { c.analogyStrength = c.confidence; c.unvalidated = true; }
  }
  function unvalidateLists(entry) {
    ['companies', 'expectedTypes', 'types', 'firms'].forEach(function (L) { if (Array.isArray(entry && entry[L])) entry[L].forEach(function (c) { unvalidate(c); markGeneric(c); }); });
  }

  function patch(name, eng) {
    if (!eng || eng.__nbGuarded) return;
    eng.__nbGuarded = true;
    var braked = [];
    // 1) prune non-nodes, then enrich each REAL entry with the defensible motif layer
    //    and flag its node->company guesses as unvalidated.
    var dir = eng.NODE_DIRECTORY;
    if (dir && typeof dir === 'object') {
      for (var k in dir) {
        if (!Object.prototype.hasOwnProperty.call(dir, k)) continue;
        if (!real(k)) { braked.push(k); delete dir[k]; continue; }
        enrich(dir[k], k); unvalidateLists(dir[k]);
      }
    }
    // 2) filter runInference output + enrich/flag each surviving result.
    if (typeof eng.runInference === 'function') {
      var orig = eng.runInference.bind(eng);
      eng.runInference = function () {
        var r = orig.apply(null, arguments);
        if (r) ['mapped', 'missing', 'speculative'].forEach(function (key) {
          if (!Array.isArray(r[key])) return;
          r[key] = r[key].filter(function (e) { return real(e && (e.nodeId || e.node || e.brainNodeId || e.id)); });
          r[key].forEach(function (e) { enrich(e, e && (e.nodeId || e.node || e.brainNodeId || e.id)); unvalidate(e); unvalidateLists(e); });
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

  fetch('/assets/data/generic-business-types.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (g) { GENERIC = {}; ((g && g.generic) || []).forEach(function (t) { GENERIC[t] = true; }); })
    .catch(function () { GENERIC = {}; });

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
