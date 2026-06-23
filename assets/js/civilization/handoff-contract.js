/**
 * civilization/handoff-contract.js
 * LIMEN HELIX — Civilization → Main Brain handoff packet producer.
 *
 * Civilization produces structured per-lane packets that the Main Brain can
 * consume to auto-generate artifacts. This module is a PRODUCER. It does
 * not generate artifacts itself — that lives in the Main Brain executor /
 * generators (limen-package-generator, oib-assembler, etc.).
 *
 * Read-only sources:
 *   LIMENCivilizationPackets       (per-domain audited truth)
 *   LIMENCrossDomainAuditState     (cross-domain audit findings)
 *   LIMENCrossNodeOpportunityState (cross-node opportunities)
 *
 * Produces:
 *   { lane, packets: [HandoffPacket, ...] } per artifact lane
 *
 * Lanes:
 *   patents, copyrights, business-grants, research-grants, nsf-project-pitch,
 *   sba-loans, franchise, investments, research-papers
 *
 * HandoffPacket shape:
 *   {
 *     opportunityId, lane,
 *     sourceDomains:  [...],
 *     sourceDiagnoses:[{ domain, label, summary, relevance }, ...],
 *     sourceTreatments:[{ domain, treatment }, ...],   // domain-brain treatment depth
 *     supportingNodes:[{ name, role }, ...],
 *     rationale, evidenceQuality, urgency, confidence,
 *     why, summary,
 *     readyForGeneration   // boolean — passes lane-specific minimum gate
 *   }
 *
 * Volume realism: NO output quotas. If nothing crosses a lane's gate, the
 * lane returns []. We never fabricate opportunity abundance.
 *
 * Provides:
 *   window.LIMENMainBrainHandoff.recompute()
 *   window.LIMENMainBrainHandoff.get()
 *   window.LIMENMainBrainHandoff.byLane(lane)
 *   window.LIMENMainBrainHandoff.summary()
 *   event 'limen:main-brain-handoff-update'
 */
(function () {
  'use strict';

  var REBUILD_DEBOUNCE = 800;

  var LANES = [
    'patents', 'copyrights', 'business-grants', 'research-grants',
    'nsf-project-pitch',
    'sba-loans', 'franchise', 'investments', 'research-papers'
  ];

  // ─── Lane gates — minimum quality requirements per artifact type ────────
  // Conservative: only "readyForGeneration" if the gate is genuinely passed.
  // Below the gate, the packet still emits but with readyForGeneration=false
  // so Main Brain can decide.
  //
  // singleDomainOnly: when true, the lane only accepts opportunities whose
  // sourceDomains is exactly one domain. Multi-domain cross-node aggregations
  // are NEVER appropriate for these lanes because each artifact represents
  // a single bounded entity:
  //   - patents:      one invention, one technical mechanism, one inventor set
  //   - franchise:    one replicable unit operating in one regulated FDD scope
  //   - investments:  one thesis, one position-sized bet
  //   - sba-loans:    one borrower entity, one SBA 7(a)/504 file
  // Cross-node multi-domain opportunities still emit packets for the
  // explicitly multi-domain-friendly lanes (research-papers, research-grants,
  // nsf-project-pitch, business-grants, copyrights) so signal is never lost
  // — only routed away from lanes where it would produce garbage filings.
  var LANE_GATES = {
    'patents':         { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['technology','energy','infrastructure','industry','medicine','defense','agriculture'] },
    'copyrights':      { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: false, anyDomain: ['culture','communication','religion','governance','law','intelligence'] },
    'business-grants': { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['agriculture','industry','infrastructure','supplyChain','education','energy'] },
    'research-grants': { minEvidence: 0.55, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['research','education','medicine','health','science','environment'] },
    // nsf-project-pitch — NSF SBIR/STTR Project Pitch lane. Stricter than the
    // generic research-grants gate: NSF demands BOTH technical innovation AND
    // commercial potential, so minConfidence is bumped. Passing this gate only
    // signals "sufficient packet detail exists to attempt a Project Pitch
    // draft." It does NOT signal NSF eligibility, submission readiness, fit
    // with NSF priorities, reviewer alignment, or any prediction of award.
    'nsf-project-pitch': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: false, anyDomain: ['research','technology','medicine','health','science','energy','infrastructure','environment','industry'] },
    'sba-loans':       { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: true,  anyDomain: ['economy','finance','industry','agriculture','supplyChain','infrastructure'] },
    'franchise':       { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: true,  anyDomain: ['supplyChain','industry','culture','agriculture'] },
    'investments':     { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['finance','economy','technology','energy','infrastructure'] },
    'research-papers': { minEvidence: 0.40, minConfidence: 0.45, singleDomainOnly: false, anyDomain: ['research','medicine','health','science','education','population','environment'] }
  };

  var _last = { lanes: {}, timestamp: 0, totalPackets: 0 };
  var _timer = null;

  function _packets() {
    var ad = (typeof window !== 'undefined') ? window.LIMENCivilizationAdapter : null;
    if (ad && typeof ad.getAll === 'function') return ad.getAll() || {};
    return (typeof window !== 'undefined' && window.LIMENCivilizationPackets) || {};
  }
  function _crossDomainAudit() {
    return (typeof window !== 'undefined' && window.LIMENCrossDomainAuditState) || null;
  }
  function _opportunities() {
    var st = (typeof window !== 'undefined' && window.LIMENCrossNodeOpportunityState) || null;
    return (st && Array.isArray(st.list)) ? st.list : [];
  }

  // Top diagnoses per opportunity's source domains.
  function _diagnosesFor(domains, packets) {
    var out = [];
    for (var i = 0; i < domains.length; i++) {
      var p = packets[domains[i]];
      var dx = (p && Array.isArray(p.activeDiagnoses)) ? p.activeDiagnoses : [];
      for (var j = 0; j < Math.min(dx.length, 2); j++) {
        if (!dx[j] || !dx[j].label) continue;
        out.push({
          domain:    domains[i],
          id:        dx[j].id || '',
          label:     dx[j].label,
          summary:   dx[j].summary || '',
          relevance: dx[j].relevance != null ? dx[j].relevance : null,
          active:    !!dx[j].active
        });
      }
    }
    return out;
  }

  // Source treatments per opportunity's domains — carries domain-brain treatment
  // depth into the Main Brain handoff (the civilization packet previously dropped
  // treatments, so this was unavailable). Bounded to keep the handoff actionable.
  // (2026-05-25 loop-tightening — pairs with domain-packet-adapter carry-through.)
  function _treatmentsFor(domains, packets) {
    var out = [];
    for (var i = 0; i < domains.length; i++) {
      var p = packets[domains[i]];
      var tx = (p && Array.isArray(p.treatments)) ? p.treatments : [];
      for (var j = 0; j < tx.length && out.length < 24; j++) {
        if (!tx[j]) continue;
        out.push({ domain: domains[i], treatment: tx[j] });
      }
    }
    return out;
  }

  function _supportingNodes(opp) {
    return (opp && Array.isArray(opp.nodes)) ? opp.nodes.slice() : [];
  }

  function _whyLane(lane, opp) {
    var doms = (opp.domains || []).join(' + ');
    switch (lane) {
      case 'patents':         return 'Domains ' + doms + ' produce technical / methodological output amenable to invention disclosure.';
      case 'copyrights':      return 'Domains ' + doms + ' produce textual / expressive output suitable for copyright registration.';
      case 'business-grants': return 'Domains ' + doms + ' indicate operational opportunity matching small-business / sectoral grant criteria.';
      case 'research-grants': return 'Domains ' + doms + ' indicate research-funding opportunity (NSF/NIH/foundation tracks).';
      case 'nsf-project-pitch': return 'Domains ' + doms + ' carry technical innovation plus commercial-potential signal sufficient to attempt an NSF SBIR/STTR Project Pitch draft (not eligibility, not readiness).';
      case 'sba-loans':       return 'Domains ' + doms + ' indicate financing-shaped opportunity matching SBA 7(a) / 504 criteria.';
      case 'franchise':       return 'Domains ' + doms + ' indicate replication-shaped opportunity (FTC Franchise Rule applies).';
      case 'investments':     return 'Domains ' + doms + ' indicate investable thesis with measurable upside / regulatory tail.';
      case 'research-papers': return 'Domains ' + doms + ' have evidence and pattern density supporting publishable analysis.';
    }
    return '';
  }

  function _packetForLane(lane, opp, packets) {
    var gate = LANE_GATES[lane];
    if (!gate) return null;
    var domains = (opp && opp.domains) || [];

    // Single-domain gate: lanes representing a single bounded entity (patent,
    // franchise unit, investment thesis, SBA borrower file) cannot accept
    // multi-domain cross-node aggregations. Cross-node opportunities still
    // emit packets for multi-domain-friendly lanes (research-papers,
    // research-grants, business-grants, copyrights, nsf-project-pitch) so
    // their signal is preserved — only routed away from lanes where they
    // would produce garbage filings (e.g., a patent draft titled "8 domains
    // elevated at mPFC" is not a patentable invention).
    if (gate.singleDomainOnly === true && domains.length !== 1) return null;

    // Lane domain affinity — the opportunity must touch at least one allowed
    // domain for the lane (else patent for religion is silly).
    var hit = false;
    for (var i = 0; i < domains.length; i++) {
      if (gate.anyDomain.indexOf(domains[i]) >= 0) { hit = true; break; }
    }
    if (!hit) return null;

    var ev   = opp.evidenceQuality != null ? opp.evidenceQuality : 0;
    var conf = opp.confidence      != null ? opp.confidence      : 0;
    var ready = ev >= gate.minEvidence && conf >= gate.minConfidence;

    var diagnoses = _diagnosesFor(opp.domains || [], packets);

    return {
      opportunityId:    opp.id,
      lane:             lane,
      sourceDomains:    (opp.domains || []).slice(),
      sourceDiagnoses:  diagnoses,
      sourceTreatments: _treatmentsFor(opp.domains || [], packets),
      supportingNodes:  _supportingNodes(opp),
      rationale:        opp.rationale || '',
      evidenceQuality:  ev,
      urgency:          opp.urgency != null ? opp.urgency : 0,
      confidence:       conf,
      why:              _whyLane(lane, opp),
      summary:          opp.summary || '',
      provenance:       opp.provenance || '',
      type:             opp.type || 'unknown',
      warn:             opp.warn || null,
      readyForGeneration: ready,
      gateUsed:         { minEvidence: gate.minEvidence, minConfidence: gate.minConfidence },
      // F0: carry the recurrent brain model from the source domain's packet (energy).
      deepBrain:        (function () { var ds = opp.domains || []; for (var di = 0; di < ds.length; di++) { var pk = packets && packets[ds[di]]; if (pk && pk.deepBrain) return pk.deepBrain; } return null; })()
    };
  }

  // ─── Recompute ──────────────────────────────────────────────────────────
  function recompute() {
    var packets = _packets();
    var opps    = _opportunities();
    var lanes   = {};
    var total   = 0;

    for (var li = 0; li < LANES.length; li++) lanes[LANES[li]] = [];

    for (var oi = 0; oi < opps.length; oi++) {
      var opp = opps[oi];
      // Lane recommendation comes from the opportunity itself (lanes[]) and
      // is then validated against lane gates.
      var oppLanes = Array.isArray(opp.lanes) && opp.lanes.length > 0 ? opp.lanes : LANES;
      for (var li2 = 0; li2 < oppLanes.length; li2++) {
        var lane = oppLanes[li2];
        if (!LANE_GATES[lane]) continue;
        var pkt = _packetForLane(lane, opp, packets);
        if (pkt) {
          lanes[lane].push(pkt);
          total++;
        }
      }
    }

    // Sort each lane by readyForGeneration first, then confidence × evidence.
    for (var lk in lanes) {
      lanes[lk].sort(function (a, b) {
        if (a.readyForGeneration !== b.readyForGeneration) return a.readyForGeneration ? -1 : 1;
        return (b.confidence * b.evidenceQuality) - (a.confidence * a.evidenceQuality);
      });
    }

    _last = { lanes: lanes, timestamp: Date.now(), totalPackets: total };
    if (typeof window !== 'undefined') window.LIMENMainBrainHandoffState = _last;

    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('limen:main-brain-handoff-update', { detail: _last }));
      }
    } catch (e) { /* observer-only */ }
    return _last;
  }

  function _scheduleRebuild() {
    if (_timer) return;
    _timer = setTimeout(function () {
      _timer = null;
      try { recompute(); } catch (err) { /* observer-only */ }
    }, REBUILD_DEBOUNCE);
  }

  function _laneSummary() {
    var out = [];
    for (var li = 0; li < LANES.length; li++) {
      var lane = LANES[li];
      var arr = (_last.lanes && _last.lanes[lane]) || [];
      var ready = arr.filter(function (p) { return p.readyForGeneration; }).length;
      out.push({ lane: lane, total: arr.length, readyForGeneration: ready, pending: arr.length - ready });
    }
    return out;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('limen:civilization-packets-update', _scheduleRebuild);
    window.addEventListener('limen:cross-node-opportunity-update', _scheduleRebuild);
    setTimeout(function () { try { recompute(); } catch (e) {} }, 1500);

    window.LIMENMainBrainHandoff = {
      recompute: recompute,
      get:       function () { return _last; },
      byLane:    function (lane) { return ((_last.lanes && _last.lanes[lane]) || []).slice(); },
      lanes:     function () { return LANES.slice(); },
      summary:   _laneSummary
    };
  }
})();
