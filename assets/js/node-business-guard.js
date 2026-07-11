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

  // P1: an honest confidence is a function of LIVE feed data-quality, not a
  // fabricated float. Derive it from the engine's domain in window.LIMENDomains,
  // degrading to <=0.20 when the feed is dead/fallback (the finance-opportunities
  // pattern). One value per domain — the per-type ordering keeps the old float as
  // an unvalidated analogyStrength, never presented as earned confidence.
  function domainOf(engineName) { return String(engineName || '').replace(/^LIMEN/, '').replace(/BusinessEngine$/, '').toLowerCase(); }
  function domainQuality(engineName) {
    var D = (window.LIMENDomains || {})[domainOf(engineName)];
    if (!D) return 0.15;
    var status = D.status || 'UNKNOWN';
    var stress = typeof D.stress === 'number' ? D.stress : 0;
    if (status === 'FALLBACK' || status === 'UNKNOWN' || stress <= 0.01) return 0.15; // dead feed
    if (status === 'PARTIAL') return Math.min(0.50, 0.20 + stress * 0.30);
    return Math.min(0.85, 0.35 + stress * 0.50); // LIVE — scales w/ signal, never near-certainty
  }
  function honestConf(c, cap) {
    if (c && typeof c === 'object' && typeof c.confidence === 'number' && c.analogyStrength === undefined) {
      c.analogyStrength = c.confidence;              // fabricated float -> internal ordering only
      c.confidence = cap;                            // displayed value -> live data-quality
      c.confidenceBasis = 'live feed data-quality (status x stress)';
      c.unvalidated = true;
    }
  }

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
    entry.isomorphismTier = rec.tier || null;
    entry.fractalWeight = !!rec.fractalWeight;
    // Tier B: a no-motif REAL node is a PROCESSING node (real computation, not a
    // control loop). It is not an 'unvalidated analogy' — it has a real role +
    // failure modes; its business mapping is a FUNCTIONAL analogy, not one of the
    // 12 control-loop isomorphisms. Classify + surface its honest role, don't null it.
    if (rec.motif) {
      entry.businessFunction = rec.businessFunction || null;
      entry.mappingClass = rec.fractalWeight ? 'fractal-bearing (M6/M8/M11)' : 'T3 control-law (doctrine-neutral)';
      entry.nodeKind = 'control';
    } else if (rec.role) {
      entry.businessFunction = rec.businessFunction || rec.role;
      entry.mappingClass = 'processing node — functional analogy (not a control motif)';
      entry.nodeKind = 'processing';
      entry.role = rec.role;
      if (rec.failureModes) entry.failureModes = rec.failureModes;
    } else {
      entry.businessFunction = null;
      entry.mappingClass = 'unvalidated analogy';
      entry.nodeKind = 'unclassified';
    }
  }
  // P3: wire the defensible node->motif->FUNCTION forward into what the review
  // actually renders. The card shows neuroTranslation.inBusiness + a confidence;
  // prepend the canonical motif function + class so the product surfaces the docs'
  // structural layer, not just the private flat-dictionary guess (kept as context).
  function surfaceCanonical(entry, cap) {
    if (!entry || typeof entry !== 'object') return;
    if (entry.businessFunction && entry.motif && entry.neuroTranslation && !entry.neuroTranslation._canon) {
      var tag = '[' + entry.motif + ' · ' + (entry.mappingClass || '') + '] ';
      entry.neuroTranslation.inBusiness = tag + entry.businessFunction + ' — ' + (entry.neuroTranslation.inBusiness || '');
      entry.neuroTranslation._canon = true;
    }
    // top-level card confidence (review reads entry.confidence) -> honest data-quality
    if (typeof entry.confidence === 'number' && entry.analogyStrength === undefined) {
      entry.analogyStrength = entry.confidence; entry.confidence = cap;
      entry.confidenceBasis = 'live feed data-quality (status x stress)'; entry.unvalidated = true;
    }
  }
  // A1/P1: relabel + honest-ify the fabricated per-type confidence floats.
  function unvalidateLists(entry, cap) {
    ['companies', 'expectedTypes', 'types', 'firms'].forEach(function (L) { if (Array.isArray(entry && entry[L])) entry[L].forEach(function (c) { honestConf(c, cap); markGeneric(c); }); });
  }

  function patch(name, eng) {
    if (!eng || eng.__nbGuarded) return;
    eng.__nbGuarded = true;
    var braked = [];
    // 1) prune non-nodes, then enrich each REAL entry with the defensible motif layer
    //    and flag its node->company guesses as unvalidated.
    var cap0 = domainQuality(name);
    var dir = eng.NODE_DIRECTORY;
    if (dir && typeof dir === 'object') {
      for (var k in dir) {
        if (!Object.prototype.hasOwnProperty.call(dir, k)) continue;
        if (!real(k)) { braked.push(k); delete dir[k]; continue; }
        enrich(dir[k], k); surfaceCanonical(dir[k], cap0); unvalidateLists(dir[k], cap0);
      }
    }
    // 2) filter runInference output + enrich/flag each surviving result. cap is
    //    recomputed per call so the displayed confidence tracks LIVE feed quality.
    if (typeof eng.runInference === 'function') {
      var orig = eng.runInference.bind(eng);
      eng.runInference = function () {
        var r = orig.apply(null, arguments);
        var cap = domainQuality(name);
        if (r) ['mapped', 'missing', 'speculative'].forEach(function (key) {
          if (!Array.isArray(r[key])) return;
          r[key] = r[key].filter(function (e) { return real(e && (e.nodeId || e.node || e.brainNodeId || e.id)); });
          r[key].forEach(function (e) { enrich(e, e && (e.nodeId || e.node || e.brainNodeId || e.id)); surfaceCanonical(e, cap); unvalidateLists(e, cap); });
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
