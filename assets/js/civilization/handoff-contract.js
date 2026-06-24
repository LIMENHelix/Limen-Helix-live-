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
    'sba-loans', 'franchise', 'investments', 'research-papers',
    // ─── Finance-native lanes (additive) ──────────────────────────────────
    // Finance is the canonical source domain for capital-market opportunity.
    // These three lanes give finance-native signal (credit/lending, systemic
    // solvency cascades, funding/liquidity constraints) a home so it is not
    // forced through the generic 'investments' thesis lane. Mirror structure
    // of the existing lanes; only the CONTENT is financial. They never touch
    // the validated P3 distress kernel (Thing1) — they consume already-audited
    // civilization packets exactly like every other lane.
    'credit-facilities', 'systemic-risk', 'capital-access',
    // ─── Defense-native + defense-technology coupling lanes (additive) ────
    // Defense is the canonical source/negotiator domain for military-industrial
    // opportunity. 'defense-procurement' is the defense-ONLY lane (programs of
    // record, weapons-system buys, sustainment/readiness contracts). The three
    // coupling lanes (zero-day-acquisition, firmware-licensing, semiconductor-IP)
    // are EXACTLY the lane names cross-node-opportunity.js emits when technology
    // is CO-ELEVATED with defense at a node (TECH_COUPLING_LANES.defense). Until
    // now those hints were dropped at the handoff gate because no LANE_GATES
    // entry existed — defining them here lets defense-technology coupling route
    // cyber-intelligence / firmware / semiconductor-supply artifacts to the
    // defense negotiator, mirroring energy's energy-efficiency-hardware coupling.
    // Defense IDENTITY stays kinetic/industrial/readiness (LMT, RTX, NOC, GD,
    // BA, LHX, HII, LDOS, BAH, KTOS, AVAV); cyber is the technology coupling,
    // NOT defense's own content, and stays distinct from intelligence collection.
    'defense-procurement', 'zero-day-acquisition', 'firmware-licensing', 'semiconductor-IP',
    // ─── Intelligence-native lanes (additive) ─────────────────────────────
    // Intelligence is the canonical source/negotiator domain for collection,
    // all-source analysis, espionage/counterintelligence, and warning. These
    // lanes give intelligence-native signal a home so it is not forced through
    // defense's kinetic procurement lanes or technology's cyber-tooling lanes.
    //   'intelligence-operations'      — covert operations, collection tasking,
    //       analysis-fusion opportunity routed to the intelligence negotiator
    //       (analogous to 'defense-procurement' for kinetic). Single-domain.
    //   'collection-platform-acquisition' — SIGINT/HUMINT/GEOINT/OSINT platform
    //       upgrades routed to intelligence (analogous to 'defense-procurement'
    //       for weapons systems). Single-domain.
    //   'analysis-fusion-capability'   — all-source fusion / Palantir-style
    //       analysis-platform capability. Inherently multi-domain (intelligence
    //       + technology + research), so NOT single-domain.
    // Intelligence IDENTITY is collection / analysis / espionage / warning —
    // distinct from defense (kinetic/industrial/readiness) and from technology
    // (cyber tooling is a coupling, NOT intelligence's own content). Real intel-
    // sector operators anchor these lanes: PLTR, BAH, LDOS, CACI, SAIC, KBR,
    // VRNT, NICE, VRSK.
    'intelligence-operations', 'collection-platform-acquisition', 'analysis-fusion-capability',
    // ─── Trade / supplyChain coupling lane (additive) ─────────────────────
    // Trade's RUNTIME KEY in this file is 'supplyChain' (URL/portal key is
    // 'trade'; see domain-identity.js dual-naming). Trade IDENTITY = international
    // trade & commerce, exports/imports, tariffs & trade policy, shipping &
    // logistics, supply chains, trade balance, customs, trade agreements,
    // sanctions/embargoes, freight & ports — distinct from economy (macro
    // aggregate) and industry (production).
    //
    // 'supply-chain-mapping' is NOT a new invented lane: cross-node-opportunity.js
    // ALREADY emits it from TECH_COUPLING_LANES.energy and TECH_COUPLING_LANES.research
    // (technology↔energy and technology↔research co-elevation). Until now those
    // emissions were SILENTLY DROPPED at the handoff gate because no LANE_GATES
    // entry existed (recompute() skips any lane absent from LANE_GATES) — exactly
    // the dropped-hint situation the defense coupling block fixed. Defining the
    // gate here gives that already-emitted lane a home, routing supply-chain /
    // logistics-network-mapping artifacts to the trade (supplyChain) negotiator.
    // singleDomainOnly is false: a supply-chain-mapping artifact spans a logistics
    // network across multiple counterparties/sectors, so cross-node multi-domain
    // aggregations are appropriate. Real trade/logistics operators anchor this
    // lane: FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL.
    'supply-chain-mapping'
    // ─── DESIGN NOTE — future trade-native lanes (NOT added now) ──────────
    // Per the wiring-gap analysis: trade currently participates as a SECONDARY
    // participant (via supplyChain in business-grants/sba-loans/franchise/credit-
    // facilities/systemic-risk/capital-access and now supply-chain-mapping), never
    // as a PRIMARY source negotiator the way defense owns 'defense-procurement' or
    // intelligence owns 'intelligence-operations'. A future handoff expansion could
    // add trade-PRIMARY lanes — 'supply-chain-resilience' (trade↔infrastructure:
    // port/freight-network resilience investments), 'logistics-financing'
    // (trade↔finance: working capital / supplier financing), 'trade-compliance-tech'
    // (trade↔technology: customs/EDI/tariff-classification platforms). These are
    // DELIBERATELY NOT added here because no cross-node emitter produces those lane
    // names yet — adding them now would create dead tokens (the dead-token
    // discipline the finance/intelligence blocks observe). Add them only once
    // cross-node-opportunity.js emits them.
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
    'business-grants': { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['agriculture','industry','infrastructure','supplyChain','education','energy','technology'] },
    'research-grants': { minEvidence: 0.55, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['research','education','medicine','health','science','environment'] },
    // nsf-project-pitch — NSF SBIR/STTR Project Pitch lane. Stricter than the
    // generic research-grants gate: NSF demands BOTH technical innovation AND
    // commercial potential, so minConfidence is bumped. Passing this gate only
    // signals "sufficient packet detail exists to attempt a Project Pitch
    // draft." It does NOT signal NSF eligibility, submission readiness, fit
    // with NSF priorities, reviewer alignment, or any prediction of award.
    'nsf-project-pitch': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: false, anyDomain: ['research','technology','medicine','health','science','energy','infrastructure','environment','industry'] },
    'sba-loans':       { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: true,  anyDomain: ['economy','finance','industry','agriculture','supplyChain','infrastructure','technology'] },
    'franchise':       { minEvidence: 0.45, minConfidence: 0.50, singleDomainOnly: true,  anyDomain: ['supplyChain','industry','culture','agriculture'] },
    'investments':     { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['finance','economy','technology','energy','infrastructure'] },
    'research-papers': { minEvidence: 0.40, minConfidence: 0.45, singleDomainOnly: false, anyDomain: ['research','medicine','health','science','education','population','environment'] },
    // ─── Finance-native lane gates (additive) ─────────────────────────────
    // credit-facilities — one borrower / one syndication / one credit line.
    //   singleDomainOnly: a credit facility is a single bounded counterparty
    //   relationship (like sba-loans / a patent), so cross-node multi-domain
    //   aggregations are routed away. Finance-primary, with the lending-
    //   adjacent real-economy domains that originate credit demand.
    'credit-facilities':  { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: true,  anyDomain: ['finance','economy','industry','infrastructure','supplyChain','technology'] },
    // systemic-risk — solvency cascades / contagion / liquidity-spiral signal.
    //   Inherently cross-domain (contagion crosses sector boundaries), so
    //   singleDomainOnly is false. Higher evidence/confidence bar: a systemic-
    //   risk packet asserts cross-sector transmission, which demands stronger
    //   support than a single-name thesis. Passing this gate signals only
    //   "sufficient packet detail to attempt a systemic-risk note" — NOT a
    //   prediction of any crisis, and NOT the validated P3 distress kernel.
    'systemic-risk':      { minEvidence: 0.60, minConfidence: 0.60, singleDomainOnly: false, anyDomain: ['finance','economy','infrastructure','supplyChain','technology'] },
    // capital-access — funding constraints / liquidity gaps / capital-raise
    //   shaped opportunity. Multi-domain-friendly (a capital-access thesis can
    //   span a sector cohort), so singleDomainOnly is false.
    'capital-access':     { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['finance','economy','industry','infrastructure','energy','technology'] },
    // ─── Defense-native + defense-technology coupling lane gates (additive) ──
    // defense-procurement — one program of record / one weapons-system buy /
    //   one sustainment-readiness contract for a single bounded prime or
    //   borrower-equivalent. singleDomainOnly: a procurement artifact represents
    //   a single bounded acquisition (like sba-loans / a patent), so cross-node
    //   multi-domain aggregations are routed away. Defense-primary, with the
    //   industrial-base / readiness-adjacent real-economy domains that originate
    //   defense demand (industry = defense industrial base, infrastructure =
    //   basing/logistics, energy = fuel/strategic-reserve coupling, technology =
    //   weapons-system electronics). Passing this gate signals only "sufficient
    //   packet detail to attempt a procurement note" — NOT contract award, NOT
    //   eligibility, NOT any prediction. Real defense primes: LMT, RTX, NOC, GD,
    //   BA, LHX, HII, LDOS, BAH, KTOS, AVAV. Distinct from intelligence
    //   (collection/analysis) and from technology (cyber is a coupling, below).
    'defense-procurement':   { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['defense','industry','infrastructure','energy','technology'] },
    // zero-day-acquisition — defense↔technology coupling. Fires when technology
    //   is co-elevated with defense at a node (TECH_COUPLING_LANES.defense).
    //   Cyber-intelligence / offensive-capability acquisition shaped opportunity
    //   routed to the defense negotiator. Higher evidence/confidence bar: an
    //   acquisition assertion of an offensive cyber capability demands stronger
    //   support. singleDomainOnly false — coupling is inherently multi-domain
    //   (defense + technology present together). Cyber here is the technology
    //   coupling content, NOT defense's own kinetic identity.
    'zero-day-acquisition':  { minEvidence: 0.60, minConfidence: 0.60, singleDomainOnly: false, anyDomain: ['defense','technology','intelligence','infrastructure'] },
    // firmware-licensing — defense↔technology (and energy↔technology) coupling.
    //   Firmware / embedded-control licensing for weapons-system or platform
    //   electronics routed to the negotiating domain. singleDomainOnly false
    //   (coupling). Mirrors energy's firmware-licensing coupling lane exactly;
    //   the gate is shared because the artifact shape is identical regardless of
    //   whether defense or energy is the co-elevated partner.
    'firmware-licensing':    { minEvidence: 0.55, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['defense','technology','energy','industry','infrastructure'] },
    // semiconductor-IP — defense↔technology (and finance/research↔technology)
    //   coupling. Semiconductor-IP / chip-supply licensing shaped opportunity
    //   (the "semiconductor-supply-chain" concern in the gap spec) routed to the
    //   co-elevated negotiator. singleDomainOnly false (coupling). Shared gate
    //   with the technology/finance/research coupling that already emits this
    //   lane name — additive: defense joins the allowed domains, never replaces.
    'semiconductor-IP':      { minEvidence: 0.55, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['defense','technology','finance','research','industry','infrastructure'] },
    // ─── Intelligence-native lane gates (additive) ────────────────────────
    // intelligence-operations — one bounded covert operation / collection
    //   tasking / analysis-fusion engagement routed to the intelligence
    //   negotiator (analogous to defense-procurement for kinetic). Single-
    //   domain: an operation artifact represents a single bounded engagement,
    //   so cross-node multi-domain aggregations are routed away. Intelligence-
    //   primary, with the collection-adjacent real-economy domains that
    //   originate intelligence demand (defense = mission tasking, technology =
    //   collection sensors/processing, infrastructure = basing/ground stations).
    //   Passing this gate signals only "sufficient packet detail to attempt an
    //   intelligence-operations note" — NOT tasking authority, NOT clearance,
    //   NOT any prediction. Real intel-sector operators: PLTR, BAH, LDOS, CACI,
    //   SAIC, KBR, VRNT, NICE, VRSK. Distinct from defense (kinetic) and from
    //   technology (cyber is a coupling, not intelligence's collection identity).
    'intelligence-operations':         { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['intelligence','defense','technology','infrastructure'] },
    // collection-platform-acquisition — one bounded SIGINT/HUMINT/GEOINT/OSINT
    //   platform upgrade / sensor buy / collection-capability acquisition routed
    //   to the intelligence negotiator (analogous to defense-procurement for
    //   weapons systems). Single-domain: a platform acquisition is a single
    //   bounded buy. Intelligence-primary, with the platform-adjacent domains
    //   that supply collection hardware (defense = ISR platforms, technology =
    //   sensors/payloads, infrastructure = ground stations / downlink).
    'collection-platform-acquisition': { minEvidence: 0.55, minConfidence: 0.60, singleDomainOnly: true,  anyDomain: ['intelligence','defense','technology','infrastructure'] },
    // analysis-fusion-capability — all-source fusion / Palantir-style analysis-
    //   platform capability. Inherently MULTI-domain (fusion combines collection,
    //   compute, and research), so singleDomainOnly is false. Slightly lower bar
    //   than the operations/platform lanes because a fusion-capability note is an
    //   analytic artifact, not a bounded acquisition. Intelligence + technology +
    //   research are the native fusion partners. Passing this gate signals only
    //   "sufficient packet detail to attempt an analysis-fusion-capability note."
    'analysis-fusion-capability':      { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['intelligence','technology','research','defense','infrastructure'] },
    // ─── Trade / supplyChain coupling lane gate (additive) ────────────────
    // supply-chain-mapping — logistics-network / freight-route / supplier-graph
    //   mapping artifact routed to the trade (supplyChain) negotiator. Fires when
    //   technology is co-elevated with energy or research at a node (already
    //   emitted by TECH_COUPLING_LANES.energy / .research in cross-node-opportunity.js),
    //   and is also reachable when an opportunity touches supplyChain directly.
    //   singleDomainOnly false: a supply-chain map spans a logistics network
    //   across multiple counterparties/sectors, so multi-domain cross-node
    //   aggregations are appropriate (unlike sba-loans/franchise which bound a
    //   single entity). Trade-primary, with the logistics-adjacent domains that
    //   originate supply-chain mapping demand (supplyChain = the trade runtime key,
    //   technology = EDI/visibility platforms, infrastructure = ports/freight
    //   corridors, industry = production nodes, energy/research = the co-elevating
    //   technology partners that emit this lane). Passing this gate signals only
    //   "sufficient packet detail to attempt a supply-chain-mapping note" — NOT a
    //   logistics decision, NOT an award, NOT any prediction. Real trade/logistics
    //   operators: FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL.
    //   Distinct from economy (macro aggregate) and industry (production).
    'supply-chain-mapping':            { minEvidence: 0.50, minConfidence: 0.55, singleDomainOnly: false, anyDomain: ['supplyChain','technology','infrastructure','industry','energy','research'] }
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
      case 'credit-facilities': return 'Domains ' + doms + ' indicate credit / lending-shaped opportunity (credit line, syndication, debt facility) for a single bounded counterparty.';
      case 'systemic-risk':     return 'Domains ' + doms + ' show cross-sector solvency / liquidity transmission signal sufficient to attempt a systemic-risk note (not a crisis prediction, not the validated distress kernel).';
      case 'capital-access':    return 'Domains ' + doms + ' indicate funding-constraint / liquidity-gap opportunity (capital access, funding runway, liquidity provision).';
      case 'defense-procurement': return 'Domains ' + doms + ' indicate procurement / sustainment-shaped opportunity for a single bounded acquisition (program of record, weapons-system buy, readiness contract) routed to the defense negotiator — not award, not eligibility.';
      case 'zero-day-acquisition': return 'Domains ' + doms + ' show defense↔technology co-elevation routing a cyber-intelligence / offensive-capability acquisition artifact to the defense negotiator (coupling lane; cyber is the technology coupling, not defense\'s kinetic identity).';
      case 'firmware-licensing':  return 'Domains ' + doms + ' show technology co-elevation routing a firmware / embedded-control licensing artifact for platform or weapons-system electronics to the co-elevated negotiator (defense or energy coupling lane).';
      case 'semiconductor-IP':    return 'Domains ' + doms + ' show technology co-elevation routing a semiconductor-IP / chip-supply licensing artifact (defense semiconductor supply chain) to the co-elevated negotiator (coupling lane).';
      case 'intelligence-operations': return 'Domains ' + doms + ' indicate collection / analysis-fusion / covert-operations-shaped opportunity for a single bounded engagement (collection tasking, all-source analysis, counterintelligence) routed to the intelligence negotiator — not tasking authority, not clearance, not award.';
      case 'collection-platform-acquisition': return 'Domains ' + doms + ' indicate a single bounded SIGINT/HUMINT/GEOINT/OSINT collection-platform upgrade / sensor acquisition routed to the intelligence negotiator (analogous to a weapons-system buy for kinetic) — not an acquisition decision, not eligibility.';
      case 'analysis-fusion-capability': return 'Domains ' + doms + ' indicate all-source fusion / analysis-platform capability opportunity (intelligence + technology + research) sufficient to attempt an analysis-fusion-capability note — an inherently multi-domain analytic artifact, not a bounded acquisition.';
      case 'supply-chain-mapping': return 'Domains ' + doms + ' indicate logistics-network / freight-route / supplier-graph mapping opportunity routed to the trade (supplyChain) negotiator — a multi-domain artifact spanning shipping, customs, ports and supplier relationships; not a logistics decision, not an award, not any prediction.';
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
