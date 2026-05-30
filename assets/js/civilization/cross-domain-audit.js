/**
 * civilization/cross-domain-audit.js
 * LIMEN HELIX — Cross-domain audit / deciphering observer (read-only).
 *
 * Civilization is an OBSERVER. This module DOES NOT decide truth, does not
 * mutate domain slots, does not edit packets. It reads
 *   window.LIMENCivilizationPackets / LIMENCivilizationAdapter.getAll()
 * and emits structured cross-domain audit findings:
 *
 *   findings = {
 *     corroborations:      [...], // groups of domains stress-aligned
 *     divergences:         [...], // pairs whose stress diverges materially
 *     proxyHeavy:          [...], // domains with low evidence quality
 *     underfed:            [...], // domains with very low live-feed integrity
 *     baselineHeavy:       [...], // BASELINE_HEAVY flag from packet
 *     evidenceWeak:        [...], // LOW_FEED_PROVENANCE / STRESS_DERIVED_DX
 *     convergence:         [...], // multi-domain elevated + corroborated
 *     comparisons:         [...], // pairwise evidence-quality contrasts
 *     nodeSharedAffinities:[...]  // neurological co-binding findings —
 *                                  // elevated domain A's active diagnosis
 *                                  // engages brain node N; emits the OTHER
 *                                  // business domains that canonically bind
 *                                  // a role at N (per brain-node-domains.json),
 *                                  // with their current stress. Encodes the
 *                                  // load-bearing claim that pattern transfer
 *                                  // between business and neurology flows
 *                                  // through shared node membership, not
 *                                  // through hardcoded affinity groups.
 *   }
 *
 * Read-only. Provides:
 *   window.LIMENCrossDomainAudit.recompute() → findings
 *   window.LIMENCrossDomainAudit.get()       → last findings
 *   event 'limen:cross-domain-audit-update' on rebuild
 */
(function () {
  'use strict';

  // Affinity groups — domains that share systemic exposure. Empirical, edit-
  // safe: changing here only affects which corroborations get computed, never
  // raw domain truth. Conservatively scoped to avoid spurious clusters.
  var AFFINITY_GROUPS = [
    { id: 'energy_chain',   domains: ['energy', 'infrastructure', 'supplyChain'] },
    { id: 'rule_of_law',    domains: ['law', 'governance', 'defense'] },
    { id: 'economic_core',  domains: ['economy', 'finance', 'industry'] },
    { id: 'human_systems',  domains: ['health', 'population', 'medicine'] },
    { id: 'knowledge_arc',  domains: ['research', 'education', 'technology'] },
    { id: 'culture_arc',    domains: ['culture', 'religion', 'communication'] },
    { id: 'environment_arc',domains: ['environment', 'agriculture', 'energy'] }
  ];

  // Tunables — keep conservative; this is a deciphering layer not a noise
  // amplifier.
  var STRESS_AGREE_BAND   = 0.10; // group members within ±0.10 stress = agreement
  var DIVERGE_THRESHOLD   = 0.30; // pairs with >=0.30 stress gap = divergence
  var ELEVATED_THRESHOLD  = 0.45; // stress >=0.45 = elevated
  var EVIDENCE_LOW        = 0.40; // evidenceQuality < 0.40 = weak evidence
  var FEED_INTEGRITY_LOW  = 0.34; // feedIntegrity < 1/3 = underfed
  var REBUILD_DEBOUNCE_MS = 600;

  var _last = null;
  var _timer = null;

  // ─── Brain-node taxonomy (loaded once, cached for the page session) ──────
  // Each entry in brain-node-domains.json maps a node to one or more
  // {domain, label, role} business bindings. We invert this once at module
  // init into NODE_TO_DOMAINS so the audit can answer "given brain node N
  // is engaged by stressed domain A, which other business domains also
  // canonically bind a role at N, and what role?"
  //
  // This replaces (well, supplements — both run in parallel) the static
  // AFFINITY_GROUPS list above. Static groups encode operator priors;
  // node-shared affinities encode neurology. Both findings emit; consumers
  // pick which lens to display.
  var _NODE_TO_DOMAINS = null;
  var _taxonomyLoadAttempted = false;

  // Map raw business-domain labels in brain-node-domains.json to the
  // domain ids used in LIMENCivilizationAdapter. Keep conservative:
  // unmapped entries pass through unchanged.
  var TAXONOMY_DOMAIN_ALIASES = {
    'business':              'economy',   // generic 'business' rolls up to economy
    'addiction':             'medicine',
    'neurology':             'medicine',
    'psychedelic':           'medicine',
    'metabolic':             'medicine',
    'pediatric':             'medicine',
    'contemplative':         'religion',
    'provider':              'medicine',
    'p2_agri':               'agriculture',
    'research':              'science',
    'supplyChain':           'trade'      // brain.domainId('trade') uses portal-key 'supplyChain'
  };

  function _normalizeTaxDomain(d) {
    if (!d) return null;
    return TAXONOMY_DOMAIN_ALIASES[d] || d;
  }

  function _loadTaxonomy() {
    if (_NODE_TO_DOMAINS || _taxonomyLoadAttempted) return;
    _taxonomyLoadAttempted = true;
    fetch('/assets/data/brain-node-domains.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || typeof j !== 'object') return;
        var idx = {};
        for (var node in j) {
          if (node.charAt(0) === '_') continue;
          var entries = j[node];
          if (!Array.isArray(entries)) continue;
          var list = [];
          var seen = {};
          for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (!e || !e.domain) continue;
            var norm = _normalizeTaxDomain(e.domain);
            if (!norm || seen[norm]) continue;  // dedup by normalized domain
            seen[norm] = true;
            list.push({ domain: norm, role: e.role || '', label: e.label || '' });
          }
          if (list.length > 0) idx[node] = list;
        }
        _NODE_TO_DOMAINS = idx;
        // Trigger a rebuild now that the taxonomy is available so the first
        // findings emission carries node-shared affinities.
        _scheduleRebuild();
      })
      .catch(function () { /* observer-only; silent fail */ });
  }

  function _allPackets() {
    var adapter = (typeof window !== 'undefined') ? window.LIMENCivilizationAdapter : null;
    if (adapter && typeof adapter.getAll === 'function') return adapter.getAll() || {};
    return (typeof window !== 'undefined' && window.LIMENCivilizationPackets) || {};
  }

  function _stress(pkt)   { return pkt && typeof pkt.stressScore === 'number' ? pkt.stressScore : null; }
  function _evidence(pkt) { return pkt && pkt.audit && typeof pkt.audit.evidenceQuality === 'number' ? pkt.audit.evidenceQuality : null; }
  function _integrity(pkt){ return pkt && pkt.audit && typeof pkt.audit.feedIntegrity === 'number'   ? pkt.audit.feedIntegrity   : null; }
  function _flags(pkt)    { return Array.isArray(pkt && pkt.auditFlags) ? pkt.auditFlags : []; }

  // ─── Corroboration ──────────────────────────────────────────────────────
  // For each affinity group, are members within STRESS_AGREE_BAND of each
  // other AND elevated together? Only emits non-trivial findings.
  function _corroborations(packets) {
    var out = [];
    for (var i = 0; i < AFFINITY_GROUPS.length; i++) {
      var grp = AFFINITY_GROUPS[i];
      var present = [];
      for (var j = 0; j < grp.domains.length; j++) {
        var p = packets[grp.domains[j]];
        var s = _stress(p);
        if (s != null) present.push({ id: grp.domains[j], stress: s, packet: p });
      }
      if (present.length < 2) continue;
      var min = Math.min.apply(null, present.map(function (x) { return x.stress; }));
      var max = Math.max.apply(null, present.map(function (x) { return x.stress; }));
      var avg = present.reduce(function (a, x) { return a + x.stress; }, 0) / present.length;
      var spread = max - min;
      var elevated = present.filter(function (x) { return x.stress >= ELEVATED_THRESHOLD; });
      // Corroboration requires at least 2 members elevated and tight spread.
      if (elevated.length >= 2 && spread <= STRESS_AGREE_BAND) {
        var summary = elevated.map(function (e) { return e.id; }).join(' + ') +
          ' aligning at ' + Math.round(avg * 100) + '% stress (Δ' + (spread * 100).toFixed(0) + '%)';
        out.push({
          groupId:        grp.id,
          domains:        elevated.map(function (e) { return e.id; }),
          allInGroup:     present.map(function (x) { return x.id; }),
          avgStress:      avg,
          spread:         spread,
          summary:        summary,
          confidence:     Math.max(0, 1 - (spread / STRESS_AGREE_BAND)) * Math.min(1, elevated.length / 3)
        });
      }
    }
    return out;
  }

  // ─── Divergence ─────────────────────────────────────────────────────────
  // Pairs of domains whose stress differs by >= DIVERGE_THRESHOLD. Only
  // emits pairs where at least one side is elevated (else low/low pairs
  // would dominate).
  function _divergences(packets) {
    var ids = Object.keys(packets);
    var out = [];
    for (var a = 0; a < ids.length; a++) {
      for (var b = a + 1; b < ids.length; b++) {
        var pA = packets[ids[a]], pB = packets[ids[b]];
        var sA = _stress(pA), sB = _stress(pB);
        if (sA == null || sB == null) continue;
        var gap = Math.abs(sA - sB);
        if (gap < DIVERGE_THRESHOLD) continue;
        if (sA < ELEVATED_THRESHOLD && sB < ELEVATED_THRESHOLD) continue;
        // Heuristic: only emit "interesting" divergences for domain pairs
        // that share an affinity group. Skip noise across unrelated domains.
        var related = false;
        for (var gi = 0; gi < AFFINITY_GROUPS.length; gi++) {
          var g = AFFINITY_GROUPS[gi];
          if (g.domains.indexOf(ids[a]) >= 0 && g.domains.indexOf(ids[b]) >= 0) { related = true; break; }
        }
        if (!related) continue;
        var hi = sA >= sB ? ids[a] : ids[b];
        var lo = hi === ids[a] ? ids[b] : ids[a];
        out.push({
          domainA: ids[a], stressA: sA,
          domainB: ids[b], stressB: sB,
          gap:     gap,
          summary: hi + ' (' + Math.round(Math.max(sA, sB) * 100) + '%) diverging from ' +
                   lo + ' (' + Math.round(Math.min(sA, sB) * 100) + '%)'
        });
      }
    }
    out.sort(function (x, y) { return y.gap - x.gap; });
    return out.slice(0, 5);
  }

  // ─── Quality lists ──────────────────────────────────────────────────────
  function _qualityLists(packets) {
    var proxyHeavy = [], underfed = [], baselineHeavy = [], evidenceWeak = [];
    var ids = Object.keys(packets);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], p = packets[id];
      var ev = _evidence(p), fi = _integrity(p), flags = _flags(p);
      if (ev != null && ev < EVIDENCE_LOW) {
        proxyHeavy.push({ domain: id, evidenceQuality: ev, summary: id + ' evidence quality ' + Math.round(ev * 100) + '% — proxy-heavy' });
      }
      if (fi != null && fi < FEED_INTEGRITY_LOW) {
        underfed.push({ domain: id, feedIntegrity: fi, summary: id + ' feed integrity ' + Math.round(fi * 100) + '% — under-fed' });
      }
      if (flags.indexOf('BASELINE_HEAVY') >= 0) {
        baselineHeavy.push({ domain: id, summary: id + ' diagnoses appear baseline-heavy (low feed evidence)' });
      }
      if (flags.indexOf('LOW_FEED_PROVENANCE') >= 0 || flags.indexOf('STRESS_DERIVED_DX') >= 0) {
        evidenceWeak.push({ domain: id, flags: flags.filter(function (f) { return f === 'LOW_FEED_PROVENANCE' || f === 'STRESS_DERIVED_DX'; }), summary: id + ' diagnoses lack feed provenance' });
      }
    }
    return { proxyHeavy: proxyHeavy, underfed: underfed, baselineHeavy: baselineHeavy, evidenceWeak: evidenceWeak };
  }

  // ─── Convergence — multi-domain elevated AND corroborated by ≥1 group ──
  function _convergence(packets, corroborations) {
    var elev = [];
    var ids = Object.keys(packets);
    for (var i = 0; i < ids.length; i++) {
      var s = _stress(packets[ids[i]]);
      if (s != null && s >= ELEVATED_THRESHOLD) elev.push(ids[i]);
    }
    if (elev.length < 3) return [];
    if (corroborations.length === 0) return [];
    return [{
      domains:    elev,
      groups:     corroborations.map(function (c) { return c.groupId; }),
      summary:    elev.length + ' domains elevated with ' + corroborations.length +
                  ' affinity-group corroboration' + (corroborations.length === 1 ? '' : 's'),
      confidence: Math.min(1, corroborations.reduce(function (a, c) { return a + c.confidence; }, 0) / corroborations.length)
    }];
  }

  // ─── Pairwise comparisons (e.g. medicine vs religion evidence) ──────────
  function _comparisons(packets) {
    var rivals = [
      ['medicine', 'religion'],
      ['research', 'communication'],
      ['economy', 'governance'],
      ['defense', 'law'],
      ['energy', 'environment']
    ];
    var out = [];
    for (var i = 0; i < rivals.length; i++) {
      var a = rivals[i][0], b = rivals[i][1];
      var pA = packets[a], pB = packets[b];
      var eA = _evidence(pA), eB = _evidence(pB);
      if (eA == null || eB == null) continue;
      var diff = eA - eB;
      if (Math.abs(diff) < 0.15) continue;
      var stronger = diff > 0 ? a : b;
      var weaker   = diff > 0 ? b : a;
      out.push({
        stronger: stronger, weaker: weaker,
        diff: Math.abs(diff),
        summary: stronger + ' is stronger than ' + weaker + ' in evidence quality (Δ ' + Math.round(Math.abs(diff) * 100) + '%)'
      });
    }
    return out;
  }

  // ─── Node-shared affinities (neurology-grounded) ────────────────────────
  // For each elevated domain A, find the brain nodes its active diagnoses
  // touch via portal.issues[].circuits[].nodeId. Then look up which OTHER
  // business domains canonically bind a role at that same node (per
  // brain-node-domains.json). Emits one finding per (elevated_domain,
  // brain_node) tuple, with the sibling domains attached + their current
  // stress for visibility.
  //
  // Sources of circuit-node truth, in priority order:
  //   1. window.LIMENDomains[id].state.diagnoses[].circuits[].nodeId
  //      (already populated by every domain brain per cycle)
  //   2. activeDiagnoses on the packet — only carries labels, no circuits;
  //      we'd need a portal fetch to resolve, which the observer must not
  //      do. Skip if (1) unavailable.
  //
  // Why this matters: this is the mechanism by which neurology and business
  // share signal. A grid-collapse stress in energy ENGAGES THAL (thalamus /
  // routing). THAL is the same node finance binds for "Trade Agreements"
  // and medicine binds for "Diagnostic Routing." When energy is stressed
  // at THAL, the audit surfaces the canonical co-bindings so downstream
  // engines (patent / grant / opportunity surfacing) can read the
  // neurological adjacency without re-deriving it.
  function _domainBrainState(domainId) {
    var brains = (typeof window !== 'undefined') ? window.LIMENDomains : null;
    if (!brains) return null;
    var b = brains[domainId];
    if (!b || !b.state) return null;
    return b.state;
  }

  function _circuitNodesForDomain(domainId) {
    var state = _domainBrainState(domainId);
    if (!state || !Array.isArray(state.diagnoses)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < state.diagnoses.length; i++) {
      var dx = state.diagnoses[i];
      if (!dx || !dx.active) continue;
      var circuits = Array.isArray(dx.circuits) ? dx.circuits : [];
      for (var j = 0; j < circuits.length; j++) {
        var c = circuits[j];
        if (!c || !c.nodeId) continue;
        var key = c.nodeId;
        if (seen[key]) continue;
        seen[key] = true;
        out.push({
          nodeId: c.nodeId,
          diagnosisId:    dx.id || '',
          diagnosisLabel: dx.label || dx.id || '',
          dir:            c.dir || '',
          detail:         c.detail || '',
          evidence:       c.evidence || ''
        });
      }
    }
    return out;
  }

  function _nodeSharedAffinities(packets) {
    var out = [];
    if (!_NODE_TO_DOMAINS) return out;

    var ids = Object.keys(packets);
    for (var i = 0; i < ids.length; i++) {
      var srcId = ids[i];
      var p = packets[srcId];
      var sStress = _stress(p);
      if (sStress == null || sStress < ELEVATED_THRESHOLD) continue;

      var nodes = _circuitNodesForDomain(srcId);
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        var siblings = _NODE_TO_DOMAINS[node.nodeId];
        if (!siblings || siblings.length === 0) continue;

        var shared = [];
        for (var k = 0; k < siblings.length; k++) {
          var sib = siblings[k];
          if (sib.domain === srcId) continue;   // skip self
          var sibPkt = packets[sib.domain];
          var sibStress = _stress(sibPkt);
          shared.push({
            domain:     sib.domain,
            role:       sib.role,
            label:      sib.label,
            stress:     sibStress,
            elevated:   sibStress != null && sibStress >= ELEVATED_THRESHOLD,
            packetSeen: !!sibPkt
          });
        }
        if (shared.length === 0) continue;

        // Sort siblings: elevated first, then by stress desc
        shared.sort(function (a, b) {
          if (a.elevated !== b.elevated) return a.elevated ? -1 : 1;
          return (b.stress || 0) - (a.stress || 0);
        });

        var elevatedSiblings = shared.filter(function (s) { return s.elevated; });
        var summary = srcId + ' stressed at brain node ' + node.nodeId +
                      ' (' + (node.diagnosisLabel || 'active dx') + ')' +
                      ' — ' + shared.length + ' business domain' +
                      (shared.length === 1 ? '' : 's') +
                      ' canonically co-bound at this node' +
                      (elevatedSiblings.length > 0
                        ? '; ' + elevatedSiblings.length + ' also elevated: ' +
                          elevatedSiblings.map(function (s) { return s.domain; }).join(', ')
                        : '');

        out.push({
          source:           srcId,
          sourceStress:     sStress,
          brainNode:        node.nodeId,
          diagnosisId:      node.diagnosisId,
          diagnosisLabel:   node.diagnosisLabel,
          circuitDir:       node.dir,
          circuitDetail:    node.detail,
          circuitEvidence:  node.evidence,
          sharedWith:       shared,
          elevatedSiblings: elevatedSiblings.length,
          summary:          summary
        });
      }
    }

    // Sort findings: source stress desc, then elevated-sibling count desc
    out.sort(function (a, b) {
      if (b.elevatedSiblings !== a.elevatedSiblings) return b.elevatedSiblings - a.elevatedSiblings;
      return (b.sourceStress || 0) - (a.sourceStress || 0);
    });
    return out;
  }

  function recompute() {
    var packets = _allPackets();
    var corroborations = _corroborations(packets);
    var divergences   = _divergences(packets);
    var quality       = _qualityLists(packets);
    var convergence   = _convergence(packets, corroborations);
    var comparisons   = _comparisons(packets);
    var nodeShared    = _nodeSharedAffinities(packets);
    _last = {
      timestamp:           Date.now(),
      domainCount:         Object.keys(packets).length,
      corroborations:      corroborations,
      divergences:         divergences,
      proxyHeavy:          quality.proxyHeavy,
      underfed:            quality.underfed,
      baselineHeavy:       quality.baselineHeavy,
      evidenceWeak:        quality.evidenceWeak,
      convergence:         convergence,
      comparisons:         comparisons,
      nodeSharedAffinities: nodeShared,
      taxonomyLoaded:      !!_NODE_TO_DOMAINS
    };
    if (typeof window !== 'undefined') window.LIMENCrossDomainAuditState = _last;
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('limen:cross-domain-audit-update', { detail: _last }));
      }
    } catch (err) { /* observer must never throw */ }
    return _last;
  }

  function _scheduleRebuild() {
    if (_timer) return;
    _timer = setTimeout(function () {
      _timer = null;
      try { recompute(); } catch (err) { /* observer-only */ }
    }, REBUILD_DEBOUNCE_MS);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('limen:civilization-packets-update', _scheduleRebuild);
    // Initial best-effort rebuild — packets may not exist yet; harmless if so.
    setTimeout(function () { try { recompute(); } catch (e) {} }, 800);
    // Kick off the brain-node taxonomy load. When it lands, the loader
    // schedules a rebuild so the first findings emission that includes
    // nodeSharedAffinities happens automatically.
    _loadTaxonomy();

    window.LIMENCrossDomainAudit = {
      recompute: recompute,
      get:       function () { return _last; },
      taxonomyLoaded: function () { return !!_NODE_TO_DOMAINS; }
    };
  }
})();
