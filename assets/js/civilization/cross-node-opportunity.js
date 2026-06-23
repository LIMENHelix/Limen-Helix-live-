/**
 * civilization/cross-node-opportunity.js
 * LIMEN HELIX — Cross-node opportunity discovery (read-only).
 *
 * Reads:
 *   - assets/data/brain-node-domains.json  (neurological node → domain mappings)
 *   - LIMENCivilizationPackets             (per-domain audited truth)
 *   - LIMENCrossDomainAuditState           (cross-domain corroboration)
 *
 * Emits structured opportunity candidates with HONEST classification:
 *   {
 *     id, type, summary,
 *     nodes:    [{ name, role, domain, label }, ...],
 *     domains:  ['economy', 'governance', ...],
 *     evidenceQuality, confidence, urgency,
 *     rationale, provenance, lanes
 *   }
 *
 * Types — never lie about strength:
 *   - 'direct'         : a single domain at a node with active brain dx + good evidence
 *   - 'cross-domain'   : multiple domains at the same node aligning (corroborated)
 *   - 'inferred'       : domain elevated at a node, evidence quality middling
 *   - 'white-space'    : node exists in mapping but no active evidence — gap
 *   - 'speculative'    : weak / single-flag — surfaced but flagged
 *
 * Lanes (artifact lane recommendations) — see handoff-contract.js.
 *
 * Provides:
 *   window.LIMENCrossNodeOpportunity.recompute() → list
 *   window.LIMENCrossNodeOpportunity.get()       → last
 *   window.LIMENCrossNodeOpportunity.forDomain(id)
 *   event 'limen:cross-node-opportunity-update'
 */
(function () {
  'use strict';

  var ELEVATED        = 0.45;
  var EVIDENCE_GOOD   = 0.55;
  var EVIDENCE_MID    = 0.35;
  var URGENCY_HIGH    = 0.65;
  var URGENCY_LOW     = 0.30;
  var REBUILD_DEBOUNCE = 700;

  var _nodeMap = null;
  var _list    = [];
  var _byDomain = {};
  var _timer   = null;
  var _idCounter = 0;

  // ─── Source data load (brain-node-domains.json) ─────────────────────────
  // We don't bundle the JSON inline — fetch once and cache. If fetch fails
  // we degrade to empty (observer must never throw). Browser-only.
  function _loadNodeMap() {
    if (_nodeMap || typeof fetch !== 'function') return Promise.resolve(_nodeMap || {});
    return fetch('assets/data/brain-node-domains.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { _nodeMap = j || {}; return _nodeMap; })
      .catch(function () { _nodeMap = {}; return _nodeMap; });
  }

  function _packets() {
    var ad = (typeof window !== 'undefined') ? window.LIMENCivilizationAdapter : null;
    if (ad && typeof ad.getAll === 'function') return ad.getAll() || {};
    return (typeof window !== 'undefined' && window.LIMENCivilizationPackets) || {};
  }

  function _stress(p)   { return p && typeof p.stressScore === 'number' ? p.stressScore : null; }
  function _evidence(p) { return p && p.audit && typeof p.audit.evidenceQuality === 'number' ? p.audit.evidenceQuality : null; }
  function _flags(p)    { return Array.isArray(p && p.auditFlags) ? p.auditFlags : []; }

  // Lane heuristics — domains have natural artifact-lane affinities.
  // This is a HINT only; handoff-contract refines based on evidence.
  var DOMAIN_LANE_HINTS = {
    technology:    ['patents', 'research-papers'],
    research:      ['research-papers', 'research-grants'],
    medicine:      ['research-papers', 'patents', 'research-grants'],
    health:        ['research-papers', 'research-grants'],
    energy:        ['patents', 'sba-loans', 'business-grants'],
    industry:      ['patents', 'sba-loans'],
    agriculture:   ['business-grants', 'sba-loans', 'patents'],
    economy:       ['sba-loans', 'investments'],
    finance:       ['investments'],
    education:     ['research-grants', 'business-grants'],
    science:       ['research-grants', 'research-papers'],
    governance:    ['copyrights'],
    law:           ['copyrights'],
    defense:       ['patents'],
    intelligence:  ['copyrights', 'research-papers'],
    communication: ['copyrights'],
    culture:       ['copyrights', 'franchise'],
    religion:      ['copyrights'],
    population:    ['research-papers'],
    environment:   ['research-grants', 'patents'],
    infrastructure:['patents', 'research-grants', 'research-papers', 'business-grants', 'sba-loans'],
    supplyChain:   ['business-grants', 'sba-loans', 'franchise']
  };

  function _laneHints(domains) {
    var bag = {};
    for (var i = 0; i < domains.length; i++) {
      var lanes = DOMAIN_LANE_HINTS[domains[i]] || [];
      for (var j = 0; j < lanes.length; j++) bag[lanes[j]] = (bag[lanes[j]] || 0) + 1;
    }
    return Object.keys(bag).sort(function (a, b) { return bag[b] - bag[a]; });
  }

  function _genId() {
    return 'opp-' + Date.now().toString(36) + '-' + (++_idCounter).toString(36);
  }

  // ─── Build opportunities from one neurological node ─────────────────────
  function _opportunitiesAtNode(nodeName, nodeMappings, packets) {
    if (!Array.isArray(nodeMappings) || nodeMappings.length === 0) return [];
    var elevatedHere = [];
    var allDomains = [];
    for (var i = 0; i < nodeMappings.length; i++) {
      var m = nodeMappings[i];
      if (!m || !m.domain) continue;
      var p = packets[m.domain];
      var s = _stress(p), e = _evidence(p), flags = _flags(p);
      var entry = { name: nodeName, role: m.role || '', domain: m.domain, label: m.label || m.domain,
                    stress: s, evidence: e, flags: flags, packet: p };
      allDomains.push(entry);
      if (s != null && s >= ELEVATED) elevatedHere.push(entry);
    }
    var out = [];

    // CROSS-DOMAIN at this node — 2+ elevated domains corroborated by node.
    if (elevatedHere.length >= 2) {
      var avgEv = elevatedHere.reduce(function (a, x) { return a + (x.evidence || 0); }, 0) / elevatedHere.length;
      var avgStress = elevatedHere.reduce(function (a, x) { return a + (x.stress || 0); }, 0) / elevatedHere.length;
      var domains = elevatedHere.map(function (x) { return x.domain; });
      var conf = Math.min(0.95, avgEv * 0.7 + Math.min(1, elevatedHere.length / 4) * 0.3);
      out.push({
        id:              _genId(),
        type:            'cross-domain',
        nodes:           [{ name: nodeName, role: elevatedHere[0].role, domain: 'multi', label: 'multi' }],
        domains:         domains,
        evidenceQuality: avgEv,
        confidence:      conf,
        urgency:         avgStress,
        summary:         elevatedHere.length + ' domains elevated at ' + nodeName +
                         ' (' + domains.join(' + ') + ')',
        rationale:       'Multiple domains active at the same neurological node — cross-system opportunity. Roles: ' +
                         elevatedHere.map(function (x) { return x.domain + '=' + x.role; }).join(' | '),
        provenance:      'node_map:' + nodeName + '; brain-truth packets',
        lanes:           _laneHints(domains),
        warn:            avgEv < EVIDENCE_MID ? 'EVIDENCE_THIN' : null
      });
    }

    // DIRECT — single elevated domain at node with strong evidence.
    for (var di = 0; di < elevatedHere.length; di++) {
      var d = elevatedHere[di];
      if (d.evidence == null || d.evidence < EVIDENCE_GOOD) continue;
      // Already produced cross-domain — skip duplicate single-domain emit
      // when this domain is part of a cross-domain group
      if (elevatedHere.length >= 2) continue;
      out.push({
        id:              _genId(),
        type:            'direct',
        nodes:           [{ name: nodeName, role: d.role, domain: d.domain, label: d.label }],
        domains:         [d.domain],
        evidenceQuality: d.evidence,
        confidence:      Math.min(0.9, d.evidence * 0.8 + Math.min(1, (d.stress || 0) / 0.8) * 0.2),
        urgency:         d.stress,
        summary:         d.domain + ' active at ' + nodeName + ' (' + d.role + ')',
        rationale:       'Single-domain elevation at ' + nodeName + ' with strong feed-grounded evidence.',
        provenance:      'node_map:' + nodeName + '; ' + d.domain + ' packet',
        lanes:           _laneHints([d.domain]),
        warn:            null
      });
    }

    // INFERRED — single elevated, mid-quality evidence.
    for (var ii = 0; ii < elevatedHere.length; ii++) {
      var e2 = elevatedHere[ii];
      if (e2.evidence == null || e2.evidence >= EVIDENCE_GOOD) continue;
      if (e2.evidence < EVIDENCE_MID) continue;
      if (elevatedHere.length >= 2) continue;
      out.push({
        id:              _genId(),
        type:            'inferred',
        nodes:           [{ name: nodeName, role: e2.role, domain: e2.domain, label: e2.label }],
        domains:         [e2.domain],
        evidenceQuality: e2.evidence,
        confidence:      Math.min(0.7, e2.evidence * 0.7),
        urgency:         e2.stress,
        summary:         e2.domain + ' likely active at ' + nodeName + ' (' + e2.role + ')',
        rationale:       'Stress elevated but evidence quality mid-range — likely real, needs corroboration.',
        provenance:      'node_map:' + nodeName + '; ' + e2.domain + ' packet (mid-quality)',
        lanes:           _laneHints([e2.domain]),
        warn:            'EVIDENCE_MID'
      });
    }

    // SPECULATIVE — flagged dx but very weak provenance.
    for (var sp = 0; sp < allDomains.length; sp++) {
      var d3 = allDomains[sp];
      var fls = d3.flags || [];
      var hasWeak = fls.indexOf('LOW_FEED_PROVENANCE') >= 0 ||
                    fls.indexOf('STRESS_DERIVED_DX')   >= 0 ||
                    fls.indexOf('BASELINE_HEAVY')      >= 0;
      if (!hasWeak) continue;
      // Avoid duplicate — only emit speculative when no stronger entry
      // already exists for that domain at this node.
      if (elevatedHere.indexOf(d3) >= 0 && d3.evidence != null && d3.evidence >= EVIDENCE_MID) continue;
      out.push({
        id:              _genId(),
        type:            'speculative',
        nodes:           [{ name: nodeName, role: d3.role, domain: d3.domain, label: d3.label }],
        domains:         [d3.domain],
        evidenceQuality: d3.evidence != null ? d3.evidence : 0,
        confidence:      0.2,
        urgency:         d3.stress != null ? d3.stress * 0.5 : 0,
        summary:         d3.domain + ' flag at ' + nodeName + ' (weak provenance)',
        rationale:       'Domain flagged ' + fls.join(',') + ' — opportunity surface only, weak evidence.',
        provenance:      'node_map:' + nodeName + '; ' + d3.domain + ' packet flags=' + fls.join('|'),
        lanes:           _laneHints([d3.domain]),
        warn:            'WEAK_PROVENANCE'
      });
    }

    // WHITE-SPACE — node has mappings but no active evidence anywhere.
    if (elevatedHere.length === 0) {
      var anyData = allDomains.some(function (x) { return x.stress != null; });
      if (anyData) {
        var weakDomains = allDomains.filter(function (x) { return x.stress != null && x.stress < ELEVATED; })
                                    .map(function (x) { return x.domain; });
        if (weakDomains.length >= 2) {
          out.push({
            id:              _genId(),
            type:            'white-space',
            nodes:           [{ name: nodeName, role: nodeMappings[0].role, domain: 'multi', label: 'multi' }],
            domains:         weakDomains,
            evidenceQuality: 0,
            confidence:      0.15,
            urgency:         0,
            summary:         nodeName + ' connects ' + weakDomains.length + ' quiet domains — possible white-space',
            rationale:       'Node has multi-domain mapping but no domain currently elevated — opportunity for novel synthesis.',
            provenance:      'node_map:' + nodeName + '; quiet-domain inference',
            lanes:           _laneHints(weakDomains),
            warn:            'NO_DIRECT_EVIDENCE'
          });
        }
      }
    }
    return out;
  }

  // ─── Recompute ──────────────────────────────────────────────────────────
  function recompute() {
    return _loadNodeMap().then(function (map) {
      var packets = _packets();
      _idCounter = 0;
      var all = [];
      var nodeNames = Object.keys(map);
      for (var i = 0; i < nodeNames.length; i++) {
        var name = nodeNames[i];
        if (name.charAt(0) === '_') continue; // skip schema markers
        all = all.concat(_opportunitiesAtNode(name, map[name], packets));
      }
      // Sort: cross-domain first (highest urgency × confidence), then direct,
      // then inferred, then speculative, then white-space.
      var typeRank = { 'cross-domain': 0, 'direct': 1, 'inferred': 2, 'speculative': 3, 'white-space': 4 };
      all.sort(function (a, b) {
        var ra = typeRank[a.type] || 9, rb = typeRank[b.type] || 9;
        if (ra !== rb) return ra - rb;
        return (b.confidence * (b.urgency || 0.1)) - (a.confidence * (a.urgency || 0.1));
      });
      _list = all;

      // Index by domain for forDomain() lookup.
      _byDomain = {};
      for (var k = 0; k < all.length; k++) {
        var doms = all[k].domains || [];
        for (var di = 0; di < doms.length; di++) {
          if (!_byDomain[doms[di]]) _byDomain[doms[di]] = [];
          _byDomain[doms[di]].push(all[k]);
        }
      }

      if (typeof window !== 'undefined') window.LIMENCrossNodeOpportunityState = { list: _list, timestamp: Date.now() };
      try {
        if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('limen:cross-node-opportunity-update', { detail: { list: _list, timestamp: Date.now() } }));
        }
      } catch (e) { /* observer-only */ }
      return _list;
    });
  }

  function _scheduleRebuild() {
    if (_timer) return;
    _timer = setTimeout(function () {
      _timer = null;
      try { recompute(); } catch (err) { /* observer-only */ }
    }, REBUILD_DEBOUNCE);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('limen:civilization-packets-update', _scheduleRebuild);
    setTimeout(function () { try { recompute(); } catch (e) {} }, 1200);

    window.LIMENCrossNodeOpportunity = {
      recompute: recompute,
      get:       function () { return _list.slice(); },
      forDomain: function (id) { return (_byDomain[id] || []).slice(); }
    };
  }
})();
