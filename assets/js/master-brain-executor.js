/**
 * master-brain-executor.js — Five-lane executor.
 *
 * Pure consumer of LIMENMasterBrainReadiness.collectPathways() + window.LIMENDomains.
 * Assembles per-lane packet objects from live pathway intelligence.
 *
 * Five packet families in this architecture:
 *   PATENT          — rendered this pass
 *   GRANT           — rendered this pass
 *   SBA / LENDER    — contract defined + inspector only this pass; render Pass 2
 *   BUSINESS PLAN   — contract defined + inspector only this pass; render Pass 3
 *   DIRECTIVES      — contract defined + inspector only this pass; render Pass 4
 *
 * This module does NOT:
 *   - fabricate legal claim language
 *   - fabricate prior-art or novelty assertions
 *   - fabricate grant eligibility or RFP/NOFO matches
 *   - fabricate SBA eligibility, borrower fit, lender readiness, or
 *     underwriting readiness
 *   - fabricate investor-readiness, market viability, or commercial
 *     validation for business plans
 *   - command action via directives
 *   - produce filing-ready documents
 *   - touch any kernel, brain, adapter, or report path
 *
 * Qualification gates per lane:
 *   patent        — tier in {READY, NEAR_READY} AND opportunities[].engine === 'patent'
 *   grant         — tier in {READY, NEAR_READY} AND opportunities[].engine === 'grant'
 *   sba           — tier in {READY, NEAR_READY} AND weak business-anchor signal
 *                   (see _pathwayHasCompanyAnchor)
 *   business_plan — tier in {READY, NEAR_READY}   (planning-eligible only)
 *   directives    — tier in {READY, NEAR_READY}   (applies to every qualifying pathway)
 *
 * Exposes: window.LIMENMasterBrainExecutor
 */
(function () {
  'use strict';

  function _num(v, d) { return typeof v === 'number' && isFinite(v) ? v : (d != null ? d : null); }

  // ── Qualification ─────────────────────────────────────────────────────

  function _pathwayEngineSet(pathway) {
    var set = {};
    var opps = Array.isArray(pathway.opportunities) ? pathway.opportunities : [];
    for (var i = 0; i < opps.length; i++) {
      if (opps[i] && opps[i].engine) set[opps[i].engine] = true;
    }
    return set;
  }

  // WEAK BUSINESS-ANCHOR SIGNAL.
  // Returns true when any pathway leaf opportunity carries at least one
  // company ticker. This is intentionally a weak signal. It does NOT imply
  // SBA borrower fit, SBA eligibility, lender readiness, or underwriting
  // readiness. Stronger borrower-shape validation is deferred to the SBA
  // render / underwriting pass.
  function _pathwayHasCompanyAnchor(pathway) {
    var opps = Array.isArray(pathway.opportunities) ? pathway.opportunities : [];
    for (var i = 0; i < opps.length; i++) {
      var cs = opps[i] && opps[i].companies;
      if (Array.isArray(cs) && cs.length > 0) return true;
    }
    return false;
  }

  function qualifiesForLane(pathway, lane) {
    if (!pathway || !pathway.salience) return false;
    var tier = pathway.salience.tier;
    if (tier !== 'READY' && tier !== 'NEAR_READY') return false;
    // Engine-tag gates (unchanged): patent, grant
    if (lane === 'patent' || lane === 'grant') return !!_pathwayEngineSet(pathway)[lane];
    // SBA: tier + weak business-anchor signal. See _pathwayHasCompanyAnchor
    // comment — this is not an eligibility or borrower-shape gate.
    if (lane === 'sba') return _pathwayHasCompanyAnchor(pathway);
    // Business plan: tier-only; qualifies the pathway as PLANNING-ELIGIBLE
    // only. Does NOT imply investor-readiness, market viability, commercial
    // validation, or funding-readiness.
    // Directives: tier-only; applies to every qualifying pathway (the
    // "what-do-I-do-with-this" packet).
    if (lane === 'business_plan' || lane === 'directives') return true;
    return false;
  }

  function collectQueue(lane) {
    var R = (typeof window !== 'undefined') ? window.LIMENMasterBrainReadiness : null;
    if (!R || typeof R.collectPathways !== 'function') return [];
    var pathways = R.collectPathways();
    var out = [];
    for (var i = 0; i < pathways.length; i++) {
      if (qualifiesForLane(pathways[i], lane)) out.push(pathways[i]);
    }
    return out;
  }

  // Hard disqualification reasons only — every entry corresponds to a gate
  // actually enforced by qualifiesForLane() or by the underlying readiness
  // tier computation. Advisory substrate-quality warnings (e.g. THIN
  // density) are NOT included here and must be surfaced by the consumer as
  // a separately-labeled advisory layer.
  function hardDequalReasons(pathway, lane) {
    var out = [];
    if (!pathway) {
      out.push('pathway no longer emitted by collectPathways() \u2014 diagnosis deactivated or posture gate closed');
      return out;
    }
    var sal = pathway.salience || {};
    if (sal.tier !== 'READY' && sal.tier !== 'NEAR_READY') {
      out.push('tier dropped to ' + (sal.tier || 'unknown'));
    }
    if (lane === 'patent' || lane === 'grant') {
      var eng = _pathwayEngineSet(pathway);
      if (!eng[lane]) out.push('no leaf opportunity tagged for ' + lane + ' engine this cycle');
    } else if (lane === 'sba') {
      if (!_pathwayHasCompanyAnchor(pathway)) {
        out.push('no weak business-anchor signal on pathway (no opportunity with non-empty companies[])');
      }
    }
    if (sal.gates && sal.gates.nodes && sal.gates.nodes.open === false) {
      out.push('no deep-treatment substrate (nodes gate closed \u2014 contributes to BLOCKED tier)');
    }
    return out;
  }

  // ── Density classifier (transparent, rules-based) ─────────────────────

  function _allDeepTreatments(pathway) {
    var byNode = pathway.deepTreatmentsByNode || {};
    var all = [];
    for (var nid in byNode) {
      if (!byNode.hasOwnProperty(nid)) continue;
      var list = byNode[nid] || [];
      for (var i = 0; i < list.length; i++) all.push(list[i]);
    }
    return all;
  }

  function classifyDensity(pathway) {
    var all = _allDeepTreatments(pathway);
    var deep = all.length;
    var mon = 0, esc = 0, cite = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i].monitoring) mon++;
      if (all[i].escalation) esc++;
      if (all[i].cite) cite++;
    }
    var impacted = 0;
    var nodes = pathway.nodes || [];
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j] && nodes[j].treatmentCount > 0) impacted++;
    }
    var missing = (pathway.salience && Array.isArray(pathway.salience.missing))
      ? pathway.salience.missing.length : 0;
    var level;
    if (deep >= 6 && mon >= 3 && cite >= 4 && impacted >= 2) level = 'HIGH';
    else if (deep >= 3 && (mon >= 1 || cite >= 2) && impacted >= 1) level = 'PARTIAL';
    else level = 'THIN';
    var reason = deep + ' deep treatments \u00b7 ' + mon + ' w/ monitoring \u00b7 ' +
                 esc + ' w/ escalation \u00b7 ' + cite + ' w/ citations \u00b7 ' +
                 impacted + ' impacted nodes \u00b7 ' + missing + ' missing-proof items';
    return { level: level, deep: deep, monitoring: mon, escalation: esc, cite: cite, impacted: impacted, missing: missing, reason: reason };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  var _EVIDENCE_RANK = { 'A': 5, 'STRONG': 5, 'B': 4, 'MODERATE': 4, 'C': 2, 'EMERGING': 2 };

  function _topDeepTreatments(pathway, cap) {
    var all = _allDeepTreatments(pathway).slice();
    all.sort(function (a, b) {
      var ra = _EVIDENCE_RANK[(a.evidence || '').toString().toUpperCase()] || 1;
      var rb = _EVIDENCE_RANK[(b.evidence || '').toString().toUpperCase()] || 1;
      return rb - ra;
    });
    return all.slice(0, cap || 6);
  }

  function _claimTypeCandidates(treatments) {
    var has = { method: false, apparatus: false, system: false, composition: false };
    for (var i = 0; i < treatments.length; i++) {
      var t = treatments[i] || {};
      var blob = ((t.label || '') + ' ' + (t.type || '') + ' ' + (t.description || '')).toLowerCase();
      if (/\b(monitor|detect|measure|assess|diagnos|protocol|procedure|method|approach|algorithm)\b/.test(blob)) has.method = true;
      if (/\b(device|instrument|apparatus|hardware|module)\b/.test(blob)) has.apparatus = true;
      if (/\b(system|network|grid|infrastructure|platform)\b/.test(blob)) has.system = true;
      if (/\b(composition|formulation|material|compound|agent)\b/.test(blob)) has.composition = true;
    }
    var out = [];
    if (has.method)      out.push('method');
    if (has.apparatus)   out.push('apparatus');
    if (has.system)      out.push('system');
    if (has.composition) out.push('composition');
    if (!out.length)     out.push('method');
    return out;
  }

  var _FUNDING_CANDIDATES = {
    energy:         ['DOE ARPA-E', 'DOE EERE', 'NSF ENG', 'DOE SBIR/STTR'],
    medicine:       ['NIH', 'HRSA', 'CDC', 'AHRQ', 'PCORI'],
    finance:        ['Treasury OFR', 'NSF SBE', 'NIST'],
    science:        ['NSF', 'NIH', 'DOE Office of Science', 'DARPA'],
    education:      ['U.S. Dept. of Education', 'NSF EDU', 'IES'],
    agriculture:    ['USDA NIFA', 'USDA ARS', 'NSF BIO'],
    infrastructure: ['USDOT', 'DOE', 'EPA', 'NSF ENG'],
    environment:    ['EPA', 'NSF GEO', 'NOAA', 'DOE'],
    technology:     ['NSF CISE', 'DARPA', 'IARPA', 'NIST'],
    communication:  ['NSF', 'NIST', 'FCC', 'DARPA'],
    intelligence:   ['IARPA', 'NGA', 'ODNI'],
    defense:        ['DARPA', 'DoD', 'ONR', 'AFRL', 'ARL'],
    governance:     ['NSF SBE', 'State Dept', 'USAID'],
    law:            ['DOJ OJP', 'NSF SBE', 'NIJ'],
    population:     ['NIH NICHD', 'HUD', 'CDC'],
    religion:       [],
    culture:        ['NEH', 'NEA', 'IMLS'],
    economy:        ['NSF SBE', 'Treasury', 'SBA'],
    industry:       ['NIST MEP', 'DOE AMO', 'EDA'],
    trade:          ['USTR', 'U.S. Commerce', 'EDA']
  };

  function _fundingCandidates(domain) {
    var arr = _FUNDING_CANDIDATES[domain];
    return Array.isArray(arr) ? arr.slice() : [];
  }

  function _workingTitle(pathway, lane) {
    var dx = pathway.diagnosis || {};
    var domain = (pathway.domain || 'general');
    var dxText = (dx.label || dx.id || 'pathway response').toString();
    if (lane === 'patent') {
      return 'Working Title (draft): System and method for ' + dxText.toLowerCase() + ' \u2014 ' + domain + ' domain';
    }
    return 'Working Title (draft): ' + dxText + ' intervention framework \u2014 ' + domain + ' domain';
  }

  function _impactedNodes(pathway) {
    var out = [];
    var nodes = pathway.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n && n.treatmentCount > 0) out.push({
        nodeId: n.nodeId, nodeLabel: n.nodeLabel, inCircuits: n.inCircuits,
        treatmentCount: n.treatmentCount, hasDepthCount: n.hasDepthCount,
        deepCoverageRatio: n.deepCoverageRatio
      });
    }
    return out;
  }

  function _ledger(pathway, ds) {
    var R = (typeof window !== 'undefined') ? window.LIMENMasterBrainReadiness : null;
    if (R && typeof R.buildLedger === 'function') return R.buildLedger(pathway, ds);
    return null;
  }

  // ── Constants (honest framing strings, reused across assemblers) ──────

  var _HONEST_EMBODIMENT_FRAME = 'Working substrate only \u2014 human elaboration required to filing-grade claim language. Not a legal claim.';
  var _HONEST_FUNDING_FRAME    = 'Candidate Agency Family (Unverified). Eligibility and active RFP/NOFO match require human verification.';
  var _FIGURE_FRAME            = 'DRAWING REQUIRED \u2014 Not generated. Human inventor or draftsperson must produce.';
  var _CLAIM_SKEL_FRAME        = 'SKELETON ONLY \u2014 NOT FILING-GRADE CLAIM LANGUAGE. Human attorney drafting required.';
  var _BUDGET_PLACE_FRAME      = '[TBD \u2014 human budget formulation required]';
  var _TBD_FRAME               = '[TBD \u2014 human definition required]';

  var _PATENT_DISCLAIMER = 'This substrate is structured application assembly, not a finished patent application. External filing is not automated. No claim language is generated. Human review is required at every gated item above.';
  var _GRANT_DISCLAIMER  = 'This substrate is structured application assembly, not a finished grant proposal. External portal submission is not automated. No eligibility claim is made. Human review is required at every gated item above.';

  var _SBA_DISCLAIMER = 'This substrate is structured SBA / lender application assembly, not a finished loan package. Qualification here uses a WEAK business-anchor signal only (pathway includes at least one company leaf). This does NOT imply SBA borrower fit, SBA eligibility, lender readiness, or underwriting readiness. External submission is not automated. No creditworthiness, eligibility, or loan-approval assertion is made. Stronger borrower-shape validation is deferred to the SBA render / underwriting pass. Human lender and underwriter review is required at every gated item above.';
  var _BP_DISCLAIMER  = 'This substrate is a PLANNING SCAFFOLD only. Qualification here is tier-only: the pathway is active and has deep substrate. This does NOT imply investor-readiness, market viability, commercial validation, or funding-readiness. No market claims, financial projections, or go-to-market assertions are fabricated. Human strategy, financial modeling, commercial validation, and writing are required at every gated item above.';
  var _DIR_DISCLAIMER = 'This is a structured directives packet derived from current pathway state. It does not command action. It enumerates lane qualification, recommends artifact assembly, and identifies human roles required. No automated execution. NOT YET OPERATOR-ACTIONABLE in this pass \u2014 rendered directives view lands in Pass 4.';

  var _PRIOR_ART_FLAGS = [
    'External prior-art search required \u2014 system has no patent-office corpus access.',
    'Portal-cited treatments may overlap with existing filings; independent IP review required.',
    'Mechanism novelty is not established by this substrate alone.'
  ];

  var _PATENT_REVIEW = [
    { item: 'External prior-art search', gating: true },
    { item: 'Inventor identification and attribution', gating: true },
    { item: 'Claim drafting to filing-grade language', gating: true },
    { item: 'Reduction-to-practice documentation', gating: true },
    { item: 'Specification drafting', gating: true },
    { item: 'PTO compliance review', gating: true },
    { item: 'Inventor signatures / assignment', gating: true }
  ];
  var _GRANT_REVIEW = [
    { item: 'Eligibility verification for each funding candidate', gating: true },
    { item: 'Active RFP/NOFO match and deadline alignment',        gating: true },
    { item: 'PI / institutional identification',                   gating: true },
    { item: 'Budget formulation and justification',                gating: true },
    { item: 'Statutory and programmatic compliance review',        gating: true },
    { item: 'Institutional signoff',                               gating: true }
  ];

  var _SBA_USE_OF_PROCEEDS = [
    { category: 'Working Capital',                   placeholder: _TBD_FRAME },
    { category: 'Equipment / Fixed Assets',          placeholder: _TBD_FRAME },
    { category: 'Inventory',                         placeholder: _TBD_FRAME },
    { category: 'Real Estate / Tenant Improvements', placeholder: _TBD_FRAME },
    { category: 'Debt Refinance',                    placeholder: _TBD_FRAME }
  ];
  var _SBA_DOCS_CHECKLIST = [
    { item: 'SBA Form 1919 (Borrower Information Form)',        gating: true },
    { item: 'SBA Form 413 (Personal Financial Statement)',      gating: true },
    { item: 'Business tax returns (3 years)',                   gating: true },
    { item: 'Personal tax returns (3 years)',                   gating: true },
    { item: 'Historical P&L and balance sheet',                 gating: true },
    { item: 'Business debt schedule',                           gating: true },
    { item: 'Cash flow projections (24 months)',                gating: true },
    { item: 'Business plan document',                           gating: true },
    { item: 'Articles of organization / incorporation',         gating: true },
    { item: 'Operating agreement / bylaws',                     gating: true },
    { item: 'Business license(s) and permits',                  gating: true },
    { item: 'Lease or property documents (if applicable)',      gating: true }
  ];
  var _SBA_FINANCIALS_CHECKLIST = [
    { item: 'Historical P&L (3 years)',                         gating: true },
    { item: 'Balance sheet (current)',                          gating: true },
    { item: 'Interim financial statement (YTD)',                gating: true },
    { item: 'Aging of accounts receivable / payable',           gating: true },
    { item: 'Projected P&L (3 years forward)',                  gating: true },
    { item: 'Projected cash flow (monthly, 12 months)',         gating: true }
  ];
  var _SBA_DEBT_SCAFFOLD = [
    { line_item: 'Existing term debt',               placeholder: '[TBD]' },
    { line_item: 'Revolving credit / lines',         placeholder: '[TBD]' },
    { line_item: 'Equipment finance',                placeholder: '[TBD]' },
    { line_item: 'Vendor / trade debt',              placeholder: '[TBD]' },
    { line_item: 'Owner loans / related-party debt', placeholder: '[TBD]' }
  ];
  var _SBA_COLLATERAL_SCAFFOLD = [
    { line_item: 'Real estate collateral',           placeholder: '[TBD]' },
    { line_item: 'Equipment collateral',             placeholder: '[TBD]' },
    { line_item: 'Accounts receivable collateral',   placeholder: '[TBD]' },
    { line_item: 'Inventory collateral',             placeholder: '[TBD]' },
    { line_item: 'Personal guarantees',              placeholder: 'Required by SBA program' },
    { line_item: 'Cash collateral',                  placeholder: '[TBD]' }
  ];
  var _SBA_REVIEW = [
    { item: 'Legal entity formation verification',                     gating: true },
    { item: 'Ownership structure and K-1 / cap table reconciliation',  gating: true },
    { item: 'Tax return compilation and consistency check',            gating: true },
    { item: 'Debt service coverage ratio calculation',                 gating: true },
    { item: 'Collateral appraisal and lien position review',           gating: true },
    { item: 'SBA program eligibility verification',                    gating: true },
    { item: 'Lender underwriting and credit decision',                 gating: true },
    { item: 'Personal guarantor financial review',                     gating: true }
  ];

  var _BP_MILESTONES = [
    { phase: 'Quarter 1', placeholder: '[HUMAN-DEFINED: founding team, legal formation, MVP scope]' },
    { phase: 'Quarter 2', placeholder: '[HUMAN-DEFINED: MVP build, initial customer discovery]' },
    { phase: 'Quarter 3', placeholder: '[HUMAN-DEFINED: beta launch, first revenue]' },
    { phase: 'Quarter 4', placeholder: '[HUMAN-DEFINED: product-market-fit signals, seed raise]' },
    { phase: 'Year 2',    placeholder: '[HUMAN-DEFINED: scale, channel expansion, team growth]' },
    { phase: 'Year 3',    placeholder: '[HUMAN-DEFINED: profitability, strategic optionality]' }
  ];
  var _BP_FINANCIALS = [
    { line_item: 'Revenue Year 1',       placeholder: '[TBD]' },
    { line_item: 'Revenue Year 2',       placeholder: '[TBD]' },
    { line_item: 'Revenue Year 3',       placeholder: '[TBD]' },
    { line_item: 'COGS',                 placeholder: '[TBD]' },
    { line_item: 'OpEx',                 placeholder: '[TBD]' },
    { line_item: 'EBITDA',               placeholder: '[TBD]' },
    { line_item: 'Capital requirements', placeholder: '[TBD]' },
    { line_item: 'Breakeven point',      placeholder: '[TBD]' },
    { line_item: 'Burn rate / runway',   placeholder: '[TBD]' }
  ];
  var _BP_REVIEW = [
    { item: 'Market size research (TAM / SAM / SOM)',   gating: true },
    { item: 'Competitive analysis',                     gating: true },
    { item: 'Unit economics and financial model',       gating: true },
    { item: 'Go-to-market strategy',                    gating: true },
    { item: 'Team composition and founder bios',        gating: true },
    { item: 'Capital structure and funding plan',       gating: true },
    { item: 'Legal entity formation and IP assignment', gating: true },
    { item: 'Narrative synthesis and investor deck',    gating: true }
  ];

  var _DIR_HUMAN_ROLES = [
    { role: 'Domain Operator',           responsibility: 'Review pathway context and confirm executor intent' },
    { role: 'Patent Attorney / IP Lead', responsibility: 'If patent lane pursued \u2014 claim drafting and filing strategy' },
    { role: 'Grants Coordinator',        responsibility: 'If grant lane pursued \u2014 RFP/NOFO match, eligibility, budget' },
    { role: 'Financial Officer',         responsibility: 'If SBA/BP pursued \u2014 financial modeling, projections' },
    { role: 'Legal Counsel',             responsibility: 'If SBA/BP pursued \u2014 entity formation, operating agreement' },
    { role: 'Executive Decision-maker',  responsibility: 'Approve / Refuse / Wait on packet assemblies' }
  ];
  var _DIR_REVIEW = [
    { item: 'Operator confirmation of pathway intent',       gating: true },
    { item: 'Lane selection and priority assignment',        gating: true },
    { item: 'Human role assignment per artifact',            gating: true },
    { item: 'Approval / refusal / wait decision per packet', gating: true }
  ];

  function _projectMech(t) {
    return {
      label: t.label, type: t.type, evidence: t.evidence,
      description: t.description, cite: t.cite,
      steps: t.steps, monitoring: t.monitoring, escalation: t.escalation,
      nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth
    };
  }

  // ── Agriculture node-business proof enrichment (flag-gated, additive) ──
  // Flag: window.LIMEN_ENABLE_AGRICULTURE_NODE_BUSINESS_DOSSIERS === true
  // Scope: Agriculture domain only. Flag OFF preserves byte-for-byte output.

  function _agricultureNodeBusinessEnabled(pathway) {
    return !!(typeof window !== 'undefined'
      && window.LIMEN_ENABLE_AGRICULTURE_NODE_BUSINESS_DOSSIERS === true
      && pathway && pathway.domain === 'agriculture');
  }

  function _projectMechWide(t) {
    var base = _projectMech(t);
    if (t.citation !== undefined) base.citation = t.citation;
    if (t.target !== undefined) base.target = t.target;
    if (t.depth !== undefined) base.depth = t.depth;
    if (Array.isArray(t.ancestryPath)) base.ancestryPath = t.ancestryPath.slice();
    if (t.portalDomainId !== undefined) base.portalDomainId = t.portalDomainId;
    if (t.portalTitle !== undefined) base.portalTitle = t.portalTitle;
    base.treatmentSteps = Array.isArray(t.steps) ? t.steps.slice()
      : (Array.isArray(t.treatmentSteps) ? t.treatmentSteps.slice() : []);
    base.treatmentMonitoring = (t.monitoring !== undefined) ? t.monitoring
      : (t.treatmentMonitoring !== undefined ? t.treatmentMonitoring : null);
    base.treatmentEscalation = (t.escalation !== undefined) ? t.escalation
      : (t.treatmentEscalation !== undefined ? t.treatmentEscalation : null);
    return base;
  }

  function _buildAgricultureNodeBusinessBindings(pathway) {
    var engineMissing = [];
    var bizEngine = (typeof window !== 'undefined') ? window.LIMENAgricultureBusinessEngine : null;
    var tgtEngine = (typeof window !== 'undefined') ? window.LIMENAgricultureTargetingEngine : null;
    var nodeDir = bizEngine && bizEngine.NODE_DIRECTORY;
    var resolveTargets = (tgtEngine && typeof tgtEngine.resolveTargets === 'function') ? tgtEngine.resolveTargets : null;
    if (!nodeDir) engineMissing.push('LIMENAgricultureBusinessEngine.NODE_DIRECTORY not loaded — SCAFFOLD only');
    if (!resolveTargets) engineMissing.push('LIMENAgricultureTargetingEngine.resolveTargets not loaded — SCAFFOLD only');

    var activatedNodes = {};
    var nodes = Array.isArray(pathway.nodes) ? pathway.nodes : [];
    for (var ni = 0; ni < nodes.length; ni++) {
      var n = nodes[ni];
      if (n && n.nodeId) activatedNodes[n.nodeId] = { nodeMeta: n };
    }
    var dx = pathway.diagnosis || {};
    var circuits = Array.isArray(dx.circuits) ? dx.circuits : [];
    for (var ci = 0; ci < circuits.length; ci++) {
      var cNid = circuits[ci] && circuits[ci].nodeId;
      if (cNid && !activatedNodes[cNid]) activatedNodes[cNid] = { nodeMeta: { nodeId: cNid, nodeLabel: null, treatmentCount: 0 } };
    }

    var deepByNode = pathway.deepTreatmentsByNode || {};
    var bindings = [];
    var aimCounter = 0;

    for (var nid in activatedNodes) {
      if (!activatedNodes.hasOwnProperty(nid)) continue;
      var nodeMeta = activatedNodes[nid].nodeMeta || {};
      var dir = nodeDir ? nodeDir[nid] : null;

      var binding = {
        activatedNodeId: nid,
        nodeFullName: dir ? (dir.fullName || null) : null,
        nodeLabel: dir ? (dir.label || null) : (nodeMeta.nodeLabel || null),
        neuroTranslation: dir ? (dir.neuroTranslation || null) : null,
        nodeFunction: dir ? (dir.function || null) : null,
        nodeDysregulation: dir ? (dir.dysregulation || null) : null,
        diagnosisId: dx.id || null,
        diagnosisLabel: dx.label || dx.id || null,
        tier: dir ? (dir.tier || 'operational') : null,
        mappedBusinesses: [],
        targetCompanies: [],
        marketAnalog: null,
        deepTreatments: [],
        citedEvidence: [],
        claimCandidates: [],
        specificAims: [],
        operatorTasks: [],
        missing_proof: []
      };

      if (!dir) {
        binding.missing_proof.push('node ' + nid + ' not present in LIMENAgricultureBusinessEngine.NODE_DIRECTORY — UNKNOWN mapping');
      } else {
        var expected = Array.isArray(dir.expectedTypes) ? dir.expectedTypes : [];
        for (var ei = 0; ei < expected.length; ei++) {
          var exp = expected[ei] || {};
          binding.mappedBusinesses.push({
            type: exp.type || null,
            reason: exp.reason || null,
            confidence: (typeof exp.confidence === 'number') ? exp.confidence : null
          });
        }
        if (binding.mappedBusinesses.length === 0) {
          binding.missing_proof.push('no expectedTypes for node ' + nid + ' in NODE_DIRECTORY');
        }
      }

      var deepList = Array.isArray(deepByNode[nid]) ? deepByNode[nid] : [];
      var seenCites = {};
      for (var ti = 0; ti < deepList.length; ti++) {
        var dt = deepList[ti] || {};
        binding.deepTreatments.push(_projectMechWide(dt));
        var citeKey = dt.cite || dt.citation || null;
        if (citeKey && !seenCites[citeKey]) {
          seenCites[citeKey] = true;
          binding.citedEvidence.push({
            cite: citeKey,
            nodeId: dt.nodeId || nid,
            nodeLabel: dt.nodeLabel || binding.nodeLabel,
            depth: (dt.depth != null) ? dt.depth : null,
            ancestryPath: Array.isArray(dt.ancestryPath) ? dt.ancestryPath.slice() : null,
            portalDomainId: (dt.portalDomainId != null) ? dt.portalDomainId : null,
            portalTitle: (dt.portalTitle != null) ? dt.portalTitle : null
          });
        }
      }
      if (binding.deepTreatments.length === 0) {
        binding.missing_proof.push('no deep treatments bound to node ' + nid + ' from deepTreatmentsByNode');
      }

      if (resolveTargets) {
        try {
          var topForNode = deepList[0] || {};
          var proxyDirective = {
            _directive: {
              nodeId: nid,
              nodeLabel: binding.nodeLabel || '',
              treatmentLabel: topForNode.label || '',
              companies: []
            },
            diagnosisId: dx.id || '',
            examples: [],
            path: 'GRANT-ELIGIBLE'
          };
          var resolved = resolveTargets(proxyDirective);
          if (resolved) {
            var combined = (Array.isArray(resolved.tier1) ? resolved.tier1 : []).concat(Array.isArray(resolved.tier3) ? resolved.tier3 : []);
            for (var tc = 0; tc < combined.length; tc++) {
              var coT = combined[tc] || {};
              binding.targetCompanies.push({
                name: coT.name || null,
                ticker: coT.ticker || null,
                source: coT.source || 'segment_taxonomy',
                segment: coT.segment || null
              });
            }
            if (Array.isArray(resolved.tier2) && resolved.tier2.length) {
              binding.marketAnalog = resolved.tier2.map(function (t2) { return t2.label; }).filter(Boolean).join(' · ');
            }
          }
          if (binding.targetCompanies.length === 0 && !binding.marketAnalog) {
            binding.missing_proof.push('targeting engine returned no tier1/tier2/tier3 for node ' + nid);
          }
        } catch (err) {
          binding.missing_proof.push('resolveTargets() threw for node ' + nid + ': ' + ((err && err.message) ? err.message : 'unknown'));
        }
      } else {
        binding.missing_proof.push('targeting engine unavailable — targetCompanies/marketAnalog not derived for node ' + nid);
      }

      binding.claimCandidates = _claimTypeCandidates(deepList);

      if (binding.nodeFunction || binding.nodeDysregulation || binding.nodeLabel) {
        aimCounter++;
        var monCount = 0;
        for (var mti = 0; mti < deepList.length; mti++) if (deepList[mti] && deepList[mti].monitoring) monCount++;
        binding.specificAims.push({
          aimOrdinal: aimCounter,
          aim: 'Aim ' + aimCounter + ': At ' + (binding.nodeLabel || nid)
            + ', address ' + (binding.nodeDysregulation || 'identified dysregulation')
            + ' via ' + (binding.nodeFunction || 'node function restoration'),
          activatedNodeId: nid,
          diagnosisId: binding.diagnosisId,
          evidenceCount: binding.citedEvidence.length,
          monitoringPlanCount: monCount,
          honest_framing: 'Specific aim skeleton derived from node function + dysregulation; human PI refinement required.'
        });
      }

      binding.operatorTasks.push({
        task: 'Confirm activation of node ' + nid + (binding.nodeLabel ? ' (' + binding.nodeLabel + ')' : ''),
        role: 'Domain Operator',
        gating: true
      });
      if (binding.mappedBusinesses.length > 0) {
        binding.operatorTasks.push({
          task: 'Validate mapped business types: ' + binding.mappedBusinesses.map(function (m) { return m.type; }).filter(Boolean).join('; '),
          role: 'Domain Operator',
          gating: true
        });
      }
      if (binding.targetCompanies.length > 0) {
        binding.operatorTasks.push({
          task: 'Confirm target companies: ' + binding.targetCompanies.slice(0, 5).map(function (c) { return (c.name || '?') + (c.ticker ? ' (' + c.ticker + ')' : ''); }).join(', '),
          role: 'Domain Operator',
          gating: true
        });
      }
      if (binding.claimCandidates.length > 0) {
        binding.operatorTasks.push({
          task: 'Draft filing-grade language for claim types: ' + binding.claimCandidates.join(', '),
          role: 'Patent Attorney / IP Lead',
          gating: true
        });
      }

      bindings.push(binding);
    }

    return { bindings: bindings, engineMissing: engineMissing };
  }

  function _agricultureMarketSurface(bindings) {
    var out = [];
    for (var i = 0; i < bindings.length; i++) {
      var b = bindings[i];
      out.push({
        activatedNodeId: b.activatedNodeId,
        nodeLabel: b.nodeLabel,
        marketAnalog: b.marketAnalog,
        mappedBusinessTypes: b.mappedBusinesses.map(function (m) { return m.type; }).filter(Boolean),
        targetCompanies: b.targetCompanies.map(function (c) { return { name: c.name, ticker: c.ticker || null }; })
      });
    }
    return out;
  }

  function _agriculturePatentStrategyByNode(bindings) {
    var out = [];
    for (var i = 0; i < bindings.length; i++) {
      var b = bindings[i];
      out.push({
        activatedNodeId: b.activatedNodeId,
        nodeLabel: b.nodeLabel,
        nodeFunction: b.nodeFunction,
        nodeDysregulation: b.nodeDysregulation,
        claimCandidates: b.claimCandidates.slice(),
        deepTreatmentCount: b.deepTreatments.length,
        citedEvidenceCount: b.citedEvidence.length,
        mappedBusinessCount: b.mappedBusinesses.length,
        targetCompanyCount: b.targetCompanies.length,
        operatorTasks: b.operatorTasks.slice()
      });
    }
    return out;
  }

  function _agricultureSpecificAimsByNode(bindings) {
    var out = [];
    for (var i = 0; i < bindings.length; i++) {
      var aims = bindings[i].specificAims || [];
      for (var ai = 0; ai < aims.length; ai++) out.push(aims[ai]);
    }
    return out;
  }

  function _agricultureCoverageMatrix(bindings, engineMissing) {
    var withBinding = 0, withTargets = 0, withDeep = 0;
    for (var i = 0; i < bindings.length; i++) {
      var b = bindings[i];
      if (b.mappedBusinesses && b.mappedBusinesses.length > 0) withBinding++;
      if ((b.targetCompanies && b.targetCompanies.length > 0) || b.marketAnalog) withTargets++;
      if (b.deepTreatments && b.deepTreatments.length > 0) withDeep++;
    }
    var engineGap = Array.isArray(engineMissing) && engineMissing.length > 0;
    return {
      activated_nodes: bindings.length,
      nodes_with_binding: withBinding,
      nodes_with_targets: withTargets,
      nodes_with_deep_evidence: withDeep,
      engine_missing: Array.isArray(engineMissing) ? engineMissing.slice() : [],
      status: engineGap ? 'SCAFFOLD' : (bindings.length > 0 && withBinding > 0 ? 'DERIVED' : 'SCAFFOLD')
    };
  }

  function _attachAgricultureNodeBusiness(out, pathway, lane) {
    var nb = _buildAgricultureNodeBusinessBindings(pathway);
    out.node_business_bindings = nb.bindings;
    out.market_surface = _agricultureMarketSurface(nb.bindings);
    out.coverage_matrix = _agricultureCoverageMatrix(nb.bindings, nb.engineMissing);
    if (lane === 'patent') out.patent_strategy_by_node = _agriculturePatentStrategyByNode(nb.bindings);
    if (lane === 'grant')  out.specific_aims_by_node   = _agricultureSpecificAimsByNode(nb.bindings);
    var anyBound = false;
    for (var i = 0; i < nb.bindings.length; i++) {
      if (nb.bindings[i].mappedBusinesses && nb.bindings[i].mappedBusinesses.length > 0) { anyBound = true; break; }
    }
    if (!anyBound || (nb.engineMissing && nb.engineMissing.length > 0)) out.operator_review_required = true;
  }

  // ── Packet-only helpers ───────────────────────────────────────────────

  function _technicalField(pathway) {
    var domain = pathway.domain || 'general';
    var dx = pathway.diagnosis || {};
    var dxText = (dx.label || dx.id || 'a domain phenomenon').toString();
    return 'The ' + domain + ' domain, specifically systems and methods relating to ' + dxText.toLowerCase() + '.';
  }

  function _backgroundContext(pathway, ledger) {
    var dx = pathway.diagnosis || {};
    var active = (ledger && ledger.whatFired) ? ledger.whatFired : [];
    var lines = [];
    if (dx.summary) lines.push(dx.summary);
    if (active.length) lines.push('Current operating context exhibits the following observed conditions: ' + active.join(', ') + '.');
    if (!lines.length) lines.push('Background context not yet derivable from available pathway data.');
    return lines;
  }

  function _figurePlaceholders(pathway, topTx) {
    var nodes = (pathway.nodes || []).filter(function (n) { return n.treatmentCount > 0; }).slice(0, 3);
    var figs = [];
    if (nodes.length > 0) figs.push({ ordinal: 1, caption: 'Block diagram of ' + (nodes[0].nodeLabel || nodes[0].nodeId) + ' (primary impacted node).', honest_framing: _FIGURE_FRAME });
    if (topTx.length > 0) figs.push({ ordinal: figs.length + 1, caption: 'Process flow for: ' + (topTx[0].label || 'top mechanism candidate') + '.', honest_framing: _FIGURE_FRAME });
    if (nodes.length > 1) figs.push({ ordinal: figs.length + 1, caption: 'Cross-section / circuit map of impacted node set: ' + nodes.map(function (n) { return n.nodeLabel || n.nodeId; }).join(', ') + '.', honest_framing: _FIGURE_FRAME });
    return figs;
  }

  function _claimSkeletons(claimTypes, topTx) {
    var topMech = topTx[0] || {};
    var topLabel = (topMech.label || 'the disclosed mechanism').toString().toLowerCase();
    var out = [];
    for (var i = 0; i < claimTypes.length; i++) {
      var ct = claimTypes[i], skeleton;
      if (ct === 'method')      skeleton = '1. A method for ' + topLabel + ', comprising: [STEP a \u2014 to be drafted by human; reference mechanism steps above]; [STEP b \u2014 to be drafted by human]; [STEP c \u2014 to be drafted by human].';
      else if (ct === 'apparatus') skeleton = '1. An apparatus for ' + topLabel + ', comprising: [COMPONENT a \u2014 to be drafted by human]; [COMPONENT b \u2014 to be drafted by human]; configured to [FUNCTION \u2014 to be drafted by human].';
      else if (ct === 'system')    skeleton = '1. A system for ' + topLabel + ', comprising: [SUBSYSTEM a \u2014 to be drafted by human]; [SUBSYSTEM b \u2014 to be drafted by human]; communicatively coupled to [INTERFACE \u2014 to be drafted by human].';
      else if (ct === 'composition') skeleton = '1. A composition for ' + topLabel + ', comprising: [COMPONENT \u2014 to be drafted by human]; in proportions of [RATIOS \u2014 to be drafted by human].';
      else skeleton = '1. A claim of type "' + ct + '" \u2014 skeleton not generated.';
      out.push({ claim_type: ct, skeleton: skeleton, honest_framing: _CLAIM_SKEL_FRAME });
    }
    return out;
  }

  function _needSignificance(pathway, ledger) {
    var dx = pathway.diagnosis || {};
    var emissions = pathway.emissions || [];
    var lines = [];
    var rel = (typeof dx.relevance === 'number') ? dx.relevance.toFixed(2) : '?';
    lines.push('The ' + (pathway.domain || 'subject') + ' domain currently exhibits diagnosis-level activation of "' + (dx.label || dx.id) + '" with relevance ' + rel + '.');
    if (emissions.length) lines.push('This activation modulates downstream pressure on ' + emissions.length + ' adjacent domain(s): ' + emissions.map(function (e) { return e.targetDomain; }).join(', ') + '.');
    var active = (ledger && ledger.whatFired) ? ledger.whatFired : [];
    if (active.length) lines.push('Observed contributing conditions: ' + active.join(', ') + '.');
    return lines;
  }

  function _implementationPlan(topTx) {
    return topTx.map(function (t, idx) {
      return { ordinal: idx + 1, mechanism: t.label, node_anchor: t.nodeLabel || t.nodeId, step_count: Array.isArray(t.steps) ? t.steps.length : 0, steps: Array.isArray(t.steps) ? t.steps.slice() : [], monitoring: t.monitoring || null, escalation: t.escalation || null };
    });
  }

  function _timelineMilestones() {
    return [
      { phase: 'Months 0\u20133',  placeholder: 'Project initiation, baseline measurement, IRB / regulatory clearances [HUMAN-DEFINED]' },
      { phase: 'Months 3\u20139',  placeholder: 'Intervention rollout, primary monitoring data collection [HUMAN-DEFINED]' },
      { phase: 'Months 9\u201318', placeholder: 'Mid-cycle evaluation, intervention tuning, escalation handling [HUMAN-DEFINED]' },
      { phase: 'Months 18\u201324',placeholder: 'Outcome assessment, dissemination, sustainability planning [HUMAN-DEFINED]' }
    ];
  }

  function _budgetScaffold() {
    return [
      { line_item: 'Personnel (PI, Co-I, staff)', placeholder: _BUDGET_PLACE_FRAME },
      { line_item: 'Equipment / Instrumentation', placeholder: _BUDGET_PLACE_FRAME },
      { line_item: 'Materials and Supplies',      placeholder: _BUDGET_PLACE_FRAME },
      { line_item: 'Travel and Dissemination',    placeholder: _BUDGET_PLACE_FRAME },
      { line_item: 'Subawards / Consultants',     placeholder: _BUDGET_PLACE_FRAME },
      { line_item: 'Indirect Costs (F&A)',        placeholder: '[TBD \u2014 institution rate]' }
    ];
  }

  // ── PATENT SUBSTRATE ──────────────────────────────────────────────────

  function assemblePatentSubstrate(pathway, ds) {
    ds = ds || {};
    var topTx = _topDeepTreatments(pathway, 6);
    var ledger = _ledger(pathway, ds);
    var dx = pathway.diagnosis || {};
    var impacted = _impactedNodes(pathway);
    var opps = pathway.opportunities || [];
    var companies = {};
    for (var i = 0; i < opps.length; i++) {
      var cs = opps[i].companies || [];
      for (var j = 0; j < cs.length; j++) if (cs[j]) companies[cs[j]] = true;
    }
    var crossScale = [];
    (pathway.emissions || []).forEach(function (e) { if (e && e.targetDomain) crossScale.push(e.targetDomain); });
    (pathway.ingest    || []).forEach(function (k) { if (k && k.sourceDomain) crossScale.push(k.sourceDomain); });
    var phaseStr = (pathway.posture && pathway.posture.phase) ? pathway.posture.phase : '?';
    var density = classifyDensity(pathway);

    var patentOut = {
      id: pathway.id + '_patent',
      lane: 'patent',
      generated_at: Date.now(),
      pathway_ref: {
        id: pathway.id, domain: pathway.domain,
        tier:  pathway.salience && pathway.salience.tier,
        score: pathway.salience && pathway.salience.score
      },
      density: density,
      working_title: _workingTitle(pathway, 'patent'),
      problem_statement: {
        diagnosis_label: dx.label || dx.id,
        summary: dx.summary || '(diagnosis summary not provided)',
        affected_domain: pathway.domain,
        relevance: dx.relevance,
        matched_conditions: dx.matchedConditions,
        total_triggers:     dx.totalTriggers
      },
      domain_posture: pathway.posture || null,
      active_conditions: (ledger && ledger.whatFired) ? ledger.whatFired.slice() : [],
      impacted_nodes: impacted,
      mechanism_candidates: topTx.map(_projectMech),
      claim_type_candidates: _claimTypeCandidates(topTx),
      embodiments_outline: topTx.map(function (t, idx) {
        return {
          ordinal: idx + 1,
          based_on: t.label,
          node_anchor: t.nodeLabel || t.nodeId,
          evidence_grade: t.evidence || null,
          honest_framing: _HONEST_EMBODIMENT_FRAME
        };
      }),
      operator_targets: {
        companies: Object.keys(companies),
        primary_domain: pathway.domain,
        cross_scale_contexts: crossScale
      },
      prior_art_flags: _PRIOR_ART_FLAGS.slice(),
      truth_ledger: ledger,
      evidence_envelope: pathway.audit || null,
      missing_proof: (pathway.salience && pathway.salience.missing) ? pathway.salience.missing.slice() : [],
      open_questions: [
        'Has this mechanism been reduced to practice?',
        'Is there an inventor or inventive entity identified?',
        'What is the claimed novelty vs. portal-cited prior treatments?',
        'Provisional vs. non-provisional strategy given domain phase ' + phaseStr + '?'
      ],
      requires_human_review: _PATENT_REVIEW.slice(),
      honest_disclaimer: _PATENT_DISCLAIMER
    };
    if (_agricultureNodeBusinessEnabled(pathway)) {
      _attachAgricultureNodeBusiness(patentOut, pathway, 'patent');
    }
    return patentOut;
  }

  // ── GRANT SUBSTRATE ───────────────────────────────────────────────────

  function assembleGrantSubstrate(pathway, ds) {
    ds = ds || {};
    var topTx = _topDeepTreatments(pathway, 6);
    var ledger = _ledger(pathway, ds);
    var dx = pathway.diagnosis || {};
    var impacted = _impactedNodes(pathway);
    var emissions = pathway.emissions || [];
    var ingest    = pathway.ingest    || [];
    var density = classifyDensity(pathway);

    var grantOut = {
      id: pathway.id + '_grant',
      lane: 'grant',
      generated_at: Date.now(),
      pathway_ref: {
        id: pathway.id, domain: pathway.domain,
        tier:  pathway.salience && pathway.salience.tier,
        score: pathway.salience && pathway.salience.score
      },
      density: density,
      working_title: _workingTitle(pathway, 'grant'),
      problem_statement: {
        diagnosis_label: dx.label || dx.id,
        summary: dx.summary || '(diagnosis summary not provided)',
        affected_domain: pathway.domain,
        relevance: dx.relevance,
        matched_conditions: dx.matchedConditions,
        total_triggers:     dx.totalTriggers
      },
      domain_posture: pathway.posture || null,
      active_conditions: (ledger && ledger.whatFired) ? ledger.whatFired.slice() : [],
      affected_systems: {
        primary_domain: pathway.domain,
        downstream_domains: emissions.map(function (e) { return { domain: e.targetDomain, signal: e.signalType, magnitude: e.magnitude }; }),
        upstream_pressure:  ingest.map(function (k)    { return { from_domain: k.sourceDomain, signal: k.signalType, magnitude: k.magnitude }; })
      },
      intervention_nodes: impacted,
      intervention_mechanism: topTx.map(_projectMech),
      measurable_outcomes: topTx.filter(function (t) { return t.monitoring; }).map(function (t) {
        return { outcome_source: t.label, monitoring_plan: t.monitoring, escalation_plan: t.escalation || null };
      }),
      public_good_framing: {
        primary_domain: pathway.domain,
        affected_populations: 'Derived from ' + pathway.domain + ' domain scope; human verification of specific population counts required.',
        cross_scale_rationale: emissions.length
          ? 'Intervention in ' + pathway.domain + ' modulates downstream pressure on: ' + emissions.map(function (e) { return e.targetDomain; }).join(', ') + '.'
          : 'Primary intervention is contained within the ' + pathway.domain + ' domain at present.'
      },
      funding_target_candidates: _fundingCandidates(pathway.domain).map(function (a) {
        return { agency: a, honest_framing: _HONEST_FUNDING_FRAME };
      }),
      truth_ledger: ledger,
      evidence_envelope: pathway.audit || null,
      missing_proof: (pathway.salience && pathway.salience.missing) ? pathway.salience.missing.slice() : [],
      open_questions: [
        'Does an active RFP/NOFO match this intervention scope and timeline?',
        'Who is the principal investigator and what institutional home applies?',
        'Has eligibility against each funding candidate been verified?',
        'What is the proposed budget line by intervention node?',
        'What is the measurable baseline for the monitored outcomes?'
      ],
      requires_human_review: _GRANT_REVIEW.slice(),
      honest_disclaimer: _GRANT_DISCLAIMER
    };
    if (_agricultureNodeBusinessEnabled(pathway)) {
      _attachAgricultureNodeBusiness(grantOut, pathway, 'grant');
    }
    return grantOut;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PACKET ASSEMBLERS — five-lane executor
  // Patent and Grant: rendered in this pass.
  // SBA, Business Plan, Directives: contracts defined and live here;
  //   rendered view lands in Passes 2–4. Each returns a complete structured
  //   object that can be assembled against live pathway data for
  //   architecture review and console inspection today.
  // ══════════════════════════════════════════════════════════════════════

  function assemblePatentPacket(pathway, ds) {
    var s = assemblePatentSubstrate(pathway, ds);
    var topTx = _topDeepTreatments(pathway, 6);
    s.technical_field     = _technicalField(pathway);
    s.background_context  = _backgroundContext(pathway, s.truth_ledger);
    s.figure_placeholders = _figurePlaceholders(pathway, topTx);
    s.claim_skeletons     = _claimSkeletons(s.claim_type_candidates, topTx);
    return s;
  }

  function assembleGrantPacket(pathway, ds) {
    var s = assembleGrantSubstrate(pathway, ds);
    var topTx = _topDeepTreatments(pathway, 6);
    s.need_significance    = _needSignificance(pathway, s.truth_ledger);
    s.implementation_plan  = _implementationPlan(topTx);
    s.timeline_milestones  = _timelineMilestones();
    s.budget_scaffold      = _budgetScaffold();
    return s;
  }

  // ── SBA / LENDER PACKET ───────────────────────────────────────────────

  function assembleSBAPacket(pathway, ds) {
    ds = ds || {};
    var ledger = _ledger(pathway, ds);
    var dx = pathway.diagnosis || {};
    var density = classifyDensity(pathway);
    var companies = [];
    (pathway.opportunities || []).forEach(function (o) {
      (o.companies || []).forEach(function (c) { if (c && companies.indexOf(c) === -1) companies.push(c); });
    });
    var active = (ledger && ledger.whatFired) ? ledger.whatFired : [];
    var strengths = [];
    strengths.push((pathway.domain || '?') + ' domain at tier ' + ((pathway.salience && pathway.salience.tier) || '?') + ' with score ' + ((pathway.salience && pathway.salience.score != null) ? pathway.salience.score.toFixed(2) : '?'));
    var nodeCount = (pathway.nodes || []).filter(function (n) { return n.treatmentCount > 0; }).length;
    strengths.push(nodeCount + ' impacted node(s) with portal-backed treatment coverage');
    if (companies.length) strengths.push('Operator anchor(s): ' + companies.join(', '));
    var risks = (pathway.salience && Array.isArray(pathway.salience.missing)) ? pathway.salience.missing.slice() : [];

    return {
      id: pathway.id + '_sba',
      lane: 'sba',
      generated_at: Date.now(),
      pathway_ref: { id: pathway.id, domain: pathway.domain, tier: pathway.salience && pathway.salience.tier, score: pathway.salience && pathway.salience.score },
      density: density,
      working_title: 'Working Title (draft): SBA / Lender Memo \u2014 ' + (dx.label || dx.id || 'pathway') + ' opportunity in ' + (pathway.domain || 'general'),
      operator_actionable: false,
      operator_actionable_note: 'Contract defined; rendered SBA packet body has not landed yet. Approval and print are disabled because no visible operator surface exists \u2014 not because of user error or click state. Render implementation lands in Pass 2.',
      qualification_note: 'Qualification uses a WEAK business-anchor signal only (pathway includes at least one company leaf). Does NOT imply SBA borrower fit, SBA eligibility, lender readiness, or underwriting readiness. Stronger borrower-shape validation is deferred to the SBA render / underwriting pass.',
      business_summary: {
        diagnosis_context: { diagnosis_label: dx.label || dx.id, summary: dx.summary || '(diagnosis summary not provided)', relevance: dx.relevance, matched_conditions: dx.matchedConditions, total_triggers: dx.totalTriggers },
        market_need: 'Derived from active conditions: ' + (active.length ? active.join(', ') : '(no active conditions forwarded)') + '. Primary affected domain: ' + (pathway.domain || 'general') + '.',
        summary_paragraph_frame: 'Human synthesis required \u2014 do not auto-paragraph.'
      },
      use_of_proceeds: _SBA_USE_OF_PROCEEDS.map(function (u) { return { category: u.category, placeholder: u.placeholder }; }),
      borrower_placeholders: {
        legal_entity:          _TBD_FRAME,
        ein:                   '[TBD]',
        owner_names:           _TBD_FRAME,
        ownership_percentages: '[TBD]',
        personal_guarantees:   '[TBD \u2014 lender will require]',
        principal_residence:   '[TBD]'
      },
      business_model: {
        derived_from_pathway: (pathway.domain || '?') + ' domain operator response to "' + (dx.label || dx.id || '?') + '"',
        revenue_sources:      [_TBD_FRAME],
        customer_segments:    [_TBD_FRAME],
        channels:             [_TBD_FRAME]
      },
      revenue_model: {
        projection_lines: ['[TBD \u2014 human financial modeling required]'],
        honest_framing:   'Revenue projection not generated. Human financial modeling required.'
      },
      required_docs_checklist:     _SBA_DOCS_CHECKLIST.slice(),
      financials_checklist:        _SBA_FINANCIALS_CHECKLIST.slice(),
      debt_obligations_scaffold:   _SBA_DEBT_SCAFFOLD.map(function (x) { return { line_item: x.line_item, placeholder: x.placeholder }; }),
      collateral_support_scaffold: _SBA_COLLATERAL_SCAFFOLD.map(function (x) { return { line_item: x.line_item, placeholder: x.placeholder }; }),
      lender_memo_substrate: {
        strengths_from_pathway:     strengths,
        risks_from_missing_proof:   risks,
        honest_framing:             'Lender memo draft not generated. Human underwriter review required. SBA loan program selection (7(a) / 504 / Microloan / Express) requires human eligibility assessment.'
      },
      truth_ledger: ledger,
      evidence_envelope: pathway.audit || null,
      missing_proof: risks,
      open_questions: [
        'What is the legal entity and ownership structure?',
        'What is the exact use of proceeds and total dollar amount?',
        'What is the repayment source and debt service coverage ratio?',
        'What collateral is available and how is it valued?',
        'Which SBA loan program fits (7(a) / 504 / Microloan / Express)?',
        'Has the borrower previously defaulted on a federal loan?'
      ],
      requires_human_review: _SBA_REVIEW.slice(),
      honest_disclaimer: _SBA_DISCLAIMER
    };
  }

  // ── BUSINESS PLAN PACKET ──────────────────────────────────────────────

  function assembleBusinessPlanPacket(pathway, ds) {
    ds = ds || {};
    var ledger = _ledger(pathway, ds);
    var topTx = _topDeepTreatments(pathway, 6);
    var dx = pathway.diagnosis || {};
    var density = classifyDensity(pathway);
    var companies = [];
    (pathway.opportunities || []).forEach(function (o) { (o.companies || []).forEach(function (c) { if (c && companies.indexOf(c) === -1) companies.push(c); }); });
    var emissions = pathway.emissions || [];
    var ingest = pathway.ingest || [];
    var active = (ledger && ledger.whatFired) ? ledger.whatFired : [];
    var rel = (typeof dx.relevance === 'number') ? dx.relevance.toFixed(2) : '?';
    var stepsFlat = [];
    topTx.forEach(function (t) { if (Array.isArray(t.steps)) t.steps.forEach(function (s) { stepsFlat.push(s); }); });
    var impacted = (pathway.nodes || []).filter(function (n) { return n.treatmentCount > 0; });

    return {
      id: pathway.id + '_business_plan',
      lane: 'business_plan',
      generated_at: Date.now(),
      pathway_ref: { id: pathway.id, domain: pathway.domain, tier: pathway.salience && pathway.salience.tier, score: pathway.salience && pathway.salience.score },
      density: density,
      working_title: 'Working Title (draft): Business Plan \u2014 ' + (dx.label || dx.id || 'pathway') + ' opportunity in ' + (pathway.domain || 'general'),
      operator_actionable: false,
      operator_actionable_note: 'Contract defined; rendered Business Plan packet body has not landed yet. Approval and print are disabled because no visible operator surface exists \u2014 not because of user error or click state. Render implementation lands in Pass 3.',
      qualification_note: 'Qualification is PLANNING-ELIGIBLE only (tier-only gate). Does NOT imply investor-readiness, market viability, commercial validation, or funding-readiness. Output is a planning scaffold only.',
      executive_summary: {
        diagnosis_context:     dx.label || dx.id,
        opportunity_statement: 'Derived from pathway activation: ' + (pathway.domain || 'subject') + ' domain at tier ' + ((pathway.salience && pathway.salience.tier) || '?') + ' exhibits active diagnosis "' + (dx.label || dx.id) + '" with relevance ' + rel + '.',
        honest_framing:        'Executive summary paragraph not generated. Human synthesis required to turn this substrate into an investor-facing narrative.'
      },
      problem_opportunity: {
        problem_statement:     dx.summary || '(diagnosis summary not provided)',
        opportunity_statement: 'Based on active conditions (' + (active.length ? active.join(', ') : 'none forwarded') + '), the ' + (pathway.domain || 'subject') + ' domain presents an operator opportunity anchored at ' + (impacted.length ? (impacted[0].nodeLabel || impacted[0].nodeId) : 'an unresolved node') + '.'
      },
      diagnosis_backed_market_context: {
        primary_domain:     pathway.domain,
        active_conditions:  active.slice(),
        cross_scale_rationale: emissions.length ? ('Intervention modulates ' + emissions.length + ' downstream domain(s): ' + emissions.map(function (e) { return e.targetDomain; }).join(', ') + '.') : 'Primary intervention is contained within the ' + (pathway.domain || 'subject') + ' domain.',
        upstream_pressure:  ingest.map(function (k) { return { from_domain: k.sourceDomain, signal: k.signalType, magnitude: k.magnitude }; }),
        downstream_effects: emissions.map(function (e) { return { domain: e.targetDomain, signal: e.signalType, magnitude: e.magnitude }; }),
        tam_sam_som:        '[TBD \u2014 external market research required]',
        honest_framing:     'Market size (TAM/SAM/SOM) not computed. External market research required.'
      },
      offer_solution: {
        mechanism_candidates: topTx.map(_projectMech),
        node_anchors:         impacted.map(function (n) { return { nodeId: n.nodeId, nodeLabel: n.nodeLabel, treatmentCount: n.treatmentCount, hasDepthCount: n.hasDepthCount }; }),
        honest_framing:       'Offer articulation not generated. Human product/service definition required.'
      },
      business_model: {
        revenue_sources:   [_TBD_FRAME],
        customer_segments: [_TBD_FRAME],
        channels:          [_TBD_FRAME],
        key_resources:     [_TBD_FRAME],
        key_partners:      [_TBD_FRAME],
        cost_structure:    [_TBD_FRAME],
        honest_framing:    'Business model canvas scaffold only. Human strategy definition required.'
      },
      operations_implementation: {
        intervention_nodes:   impacted.map(function (n) { return { nodeId: n.nodeId, nodeLabel: n.nodeLabel, treatmentCount: n.treatmentCount }; }),
        implementation_steps: stepsFlat.slice(0, 20),
        honest_framing:       'Operational detail beyond intervention steps requires human definition.'
      },
      gtm_customer_logic: {
        target_operators:      companies.slice(),
        cross_scale_contexts:  emissions.map(function (e) { return e.targetDomain; }).concat(ingest.map(function (k) { return k.sourceDomain; })),
        go_to_market_approach: '[TBD \u2014 human marketing/sales strategy required]',
        customer_validation:   '[TBD \u2014 human discovery required]',
        honest_framing:        'GTM strategy not fabricated. Human marketing / sales definition required.'
      },
      milestones:             _BP_MILESTONES.slice(),
      financial_model_scaffold: _BP_FINANCIALS.slice(),
      risk_missing_proof:     (pathway.salience && Array.isArray(pathway.salience.missing)) ? pathway.salience.missing.slice() : [],
      truth_ledger:           ledger,
      evidence_envelope:      pathway.audit || null,
      open_questions: [
        'What is the entity structure and cap table?',
        'Who is the founding team and what is their relevant experience?',
        'What is the target market size (TAM / SAM / SOM) from external research?',
        'What is the pricing strategy and unit economics?',
        'What is the capital requirement and funding sequence (pre-seed / seed / Series A)?',
        'What is the competitive landscape and defensibility thesis?'
      ],
      requires_human_review:  _BP_REVIEW.slice(),
      honest_disclaimer:      _BP_DISCLAIMER
    };
  }

  // ── DIRECTIVES / EXECUTION PACKET ─────────────────────────────────────

  function assembleDirectivesPacket(pathway, ds) {
    ds = ds || {};
    var ledger = _ledger(pathway, ds);
    var dx = pathway.diagnosis || {};
    var density = classifyDensity(pathway);
    var sal = pathway.salience || {};
    var audit = pathway.audit || {};
    var emissions = pathway.emissions || [];
    var ingest = pathway.ingest || [];
    var posture = pathway.posture || {};
    var phaseStr = posture.phase ? String(posture.phase).toUpperCase() : 'P0';
    var stress = (typeof posture.stress === 'number') ? posture.stress.toFixed(2) : '?';
    var trend = posture.stressTrend || 'stable';

    var lanes = ['patent', 'grant', 'sba', 'business_plan'];
    var artifacts = lanes.map(function (l) {
      var q = qualifiesForLane(pathway, l);
      var reason;
      if (q) reason = 'qualifies';
      else if (l === 'patent' || l === 'grant') reason = 'no leaf opportunity tagged for ' + l + ' engine this cycle';
      else if (l === 'sba')  reason = 'no weak business-anchor signal on pathway';
      else reason = 'tier gate not satisfied';
      return { packet_lane: l, qualifies: q, reason: reason };
    });

    var recs = [
      { action: 'Review pathway truth ledger',                     role: 'Domain Operator',             condition: 'always' },
      { action: 'Confirm diagnosis activation is current',         role: 'Domain Operator',             condition: 'always' }
    ];
    if (qualifiesForLane(pathway, 'patent'))        recs.push({ action: 'Assemble PATENT packet',         role: 'Patent Attorney / IP Lead',  condition: 'patent-lane qualified' });
    if (qualifiesForLane(pathway, 'grant'))         recs.push({ action: 'Assemble GRANT packet',          role: 'Grants Coordinator',         condition: 'grant-lane qualified' });
    if (qualifiesForLane(pathway, 'sba'))           recs.push({ action: 'Assemble SBA packet',            role: 'Financial Officer / Founder', condition: 'sba-lane qualified' });
    if (qualifiesForLane(pathway, 'business_plan')) recs.push({ action: 'Assemble BUSINESS PLAN packet',  role: 'Founder / Strategy',         condition: 'business-plan-lane qualified' });

    return {
      id: pathway.id + '_directives',
      lane: 'directives',
      generated_at: Date.now(),
      pathway_ref: { id: pathway.id, domain: pathway.domain, tier: sal.tier, score: sal.score },
      density: density,
      working_title: 'Directive (current cycle): ' + (dx.label || dx.id || 'pathway') + ' in ' + (pathway.domain || 'general'),
      operator_actionable: false,
      operator_actionable_note: 'Contract defined; rendered Directives packet body has not landed yet. Approval and print are disabled because no visible operator surface exists \u2014 not because of user error or click state. Render implementation lands in Pass 4.',
      why_this_matters_now: {
        phase_posture:        posture,
        salience_score:       sal.score,
        salience_tier:        sal.tier,
        transitions:          pathway.transitions || null,
        cross_scale_pressure: { emissions_count: emissions.length, ingest_count: ingest.length, summary: 'downstream targets: ' + emissions.map(function (e) { return e.targetDomain; }).join(', ') + (ingest.length ? ' | upstream sources: ' + ingest.map(function (k) { return k.sourceDomain; }).join(', ') : '') },
        urgency_rationale:    'phase ' + phaseStr + ' \u00b7 stress ' + stress + ' (' + trend + ')' + (posture.maturity === 'STRUCTURAL' ? ' \u00b7 STRUCTURAL maturity' : ''),
        honest_framing:       'Urgency is a derived rationale, not a command. Human executor decides priority.'
      },
      what_changed:             (ledger && ledger.whatChanged)             ? ledger.whatChanged.slice()             : [],
      what_fired:               (ledger && ledger.whatFired)               ? ledger.whatFired.slice()               : [],
      what_nodes_matter:        (ledger && ledger.whatNodesMattered)       ? ledger.whatNodesMattered.slice()       : [],
      what_branches_support_it: (ledger && ledger.whatBranchesSupportedIt) ? ledger.whatBranchesSupportedIt.slice() : [],
      what_to_do_next: {
        recommended_actions: recs,
        honest_framing:      'Recommendations derived from pathway field presence and per-lane qualification. Priority and assignment are human decisions.'
      },
      artifacts_to_assemble: artifacts,
      what_would_falsify:    (ledger && ledger.whatWouldFalsify) ? ledger.whatWouldFalsify.slice() : [],
      what_remains_blocked: {
        missing_proof:    (sal.missing || []).slice(),
        self_audit_gap:    (audit.readyForHandoff == null) ? 'No self-audit signal from domain' : null,
        provenance_gap:    (audit.producedBy && audit.validatedAt) ? null : 'Missing provenance signature',
        audit_score_gap:   (audit.auditScore == null) ? 'No audit score from domain' : null,
        feed_evidence_gap: (audit.sourcesLive == null || audit.sourcesLive === 0) ? 'No live feed evidence derivable' : null
      },
      human_role_required:   _DIR_HUMAN_ROLES.slice(),
      truth_ledger:          ledger,
      evidence_envelope:     audit,
      requires_human_review: _DIR_REVIEW.slice(),
      honest_disclaimer:     _DIR_DISCLAIMER
    };
  }

  window.LIMENMasterBrainExecutor = {
    collectQueue: collectQueue,
    qualifiesForLane: qualifiesForLane,
    hardDequalReasons: hardDequalReasons,
    classifyDensity: classifyDensity,
    assemblePatentSubstrate: assemblePatentSubstrate,
    assembleGrantSubstrate: assembleGrantSubstrate,
    assemblePatentPacket: assemblePatentPacket,
    assembleGrantPacket: assembleGrantPacket,
    assembleSBAPacket: assembleSBAPacket,
    assembleBusinessPlanPacket: assembleBusinessPlanPacket,
    assembleDirectivesPacket: assembleDirectivesPacket
  };
})();
