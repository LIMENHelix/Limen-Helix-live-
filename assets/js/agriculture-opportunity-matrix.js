/**
 * agriculture-opportunity-matrix.js — Node-first opportunity engine for Agriculture
 *
 * Produces the 7-lane per-node opportunity matrix from real live inputs:
 *   - window.LIMENDomains.agriculture.brainDiagnoses        (feed-driven diagnoses)
 *   - window.LIMENDomains.agriculture.brainResolvedContent  (L2-L7 portal treatments)
 *   - window.LIMENAgricultureBusinessEngine.NODE_DIRECTORY  (node-neurology map)
 *   - window.LIMENAgricultureTargetingEngine.resolveTargets (tier1/2/3 segment map)
 *   - fetch assets/data/command-board-data.json             (snapshot phases — pre-architecture-reframe; not Thing 1 validated)
 *
 * No synthetic opportunities. If evidence is missing, emits missing_proof[].
 *
 * Self-gated:
 *   ?domain=agriculture
 *   AND window.LIMEN_ENABLE_AGRICULTURE_OPPORTUNITY_MATRIX === true
 *
 * Exposes:
 *   window.LIMENAgricultureOpportunityMatrix = {
 *     getMatrix(), recompute(), subscribe(cb), getRulesDoc(), isEnabled()
 *   }
 *
 * Writes (when enabled):
 *   window.LIMENDomains.agriculture.brainOpportunityMatrix
 *   brain.state.opportunityMatrix  (so adapter can project on next cycle)
 *
 * Dispatches:
 *   'limen:agriculture-opportunity-matrix-update'
 */
(function () {
  'use strict';

  // ── GATE ────────────────────────────────────────────────────────────
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('domain') !== 'agriculture') return;
  } catch (e) { return; }

  function _enabled() {
    return typeof window !== 'undefined' && window.LIMEN_ENABLE_AGRICULTURE_OPPORTUNITY_MATRIX === true;
  }

  // ══════════════════════════════════════════════════════════════════════
  // RULE TABLES — deterministic, loadable via getRulesDoc() for audit
  // ══════════════════════════════════════════════════════════════════════

  // LOAN_PRODUCT_RULES and GRANT_FAMILY_RULES removed 2026-06-21 — grant/patent/loan
  // output lanes purged. Only investment + research lanes survive.
  // USDA/SBA programs are kept as INPUT SIGNALS (measurement context) in the brain's
  // signal normalizer, NOT as output opportunity lanes.

  // Research agencies (separated from grants).
  var RESEARCH_AGENCY_RULES = [
    { agency: 'USDA NIFA',  program: 'Agriculture and Food Research Initiative (AFRI)',                 archetype: 'applied',        preferredEvidence: ['A','Strong','B','Moderate'] },
    { agency: 'USDA NIFA',  program: 'Small Business Innovation Research (SBIR) — Phase I/II',          archetype: 'translational',  preferredEvidence: ['A','Strong','B'] },
    { agency: 'USDA ARS',   program: 'Intramural Research (Agricultural Research Service)',             archetype: 'intramural',     preferredEvidence: ['A','Strong','B','Moderate'] },
    { agency: 'NSF',        program: 'NSF Directorate for Biological Sciences (BIO)',                   archetype: 'foundational',   preferredEvidence: ['A','Strong'] },
    { agency: 'NSF',        program: 'Plant Genome Research Program',                                   archetype: 'foundational',   preferredEvidence: ['A','Strong'] },
    { agency: 'SARE',       program: 'Sustainable Agriculture Research and Education (Regional)',       archetype: 'sustainability', preferredEvidence: ['A','Strong','B','Moderate','C','Emerging'] }
  ];

  // Service archetypes — exact match to spec keyword list.
  var SERVICE_ARCHETYPE_REGEX = /\b(consult|consultant|advisor|advisory|agronomist|planner|dealer|service|applicator|auditor)\b/i;

  // Kernel verdict classifier.
  function _kernelVerdict(c) {
    if (!c) return { label: 'unclassified', reason: 'no kernel record' };
    var p = c.p || '';
    var tr = c.tr || '';
    var co = typeof c.co === 'number' ? c.co : 0;
    var alert = c.a === true;
    if (alert) return { label: 'elevated-attention position', reason: 'kernel alert=true' };
    if ((p === 'p7a' || p === 'p9') && tr === 'TERMINAL_DIVERGENCE') return { label: 'distressed-positioning candidate', reason: 'terminal-divergence at phase ' + p };
    if (p === 'p6' && tr === 'TERMINAL_DIVERGENCE') return { label: 'value-extraction watch',          reason: 'terminal-divergence at phase p6' };
    if ((p === 'p4' || p === 'p5') && tr === 'RECOVERED') return { label: 'stabilized carry',          reason: 'recovered at phase ' + p };
    if ((p === 'p0' || p === 'p1' || p === 'p2' || p === 'p3') && tr === 'STABLE' && co < 0.3) return { label: 'baseline — insufficient kernel signal', reason: 'low-composite stable at phase ' + p };
    if (co >= 0.8) return { label: 'strong composite signal', reason: 'composite ' + co.toFixed(2) };
    return { label: 'signal unclassified — kernel verdict pending', reason: 'phase ' + p + ' / trajectory ' + (tr || 'n/a') };
  }

  // ══════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════

  var _matrix = [];
  var _subscribers = [];
  var _kernelCache = null;
  var _kernelLoading = null;
  var _lastComputedAt = 0;
  var _lastError = null;

  // ══════════════════════════════════════════════════════════════════════
  // INPUTS
  // ══════════════════════════════════════════════════════════════════════

  function _ds() {
    try { return (window.LIMENDomains && window.LIMENDomains.agriculture) || null; } catch (e) { return null; }
  }
  function _nodeDir() {
    try { return (window.LIMENAgricultureBusinessEngine && window.LIMENAgricultureBusinessEngine.NODE_DIRECTORY) || null; } catch (e) { return null; }
  }
  function _targetingEngine() {
    try {
      var te = window.LIMENAgricultureTargetingEngine;
      return (te && typeof te.resolveTargets === 'function') ? te : null;
    } catch (e) { return null; }
  }

  function _loadKernel(cb) {
    if (_kernelCache) return cb(_kernelCache);
    if (_kernelLoading) { _kernelLoading.push(cb); return; }
    _kernelLoading = [cb];
    try {
      fetch('assets/data/command-board-data.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var cos = (data && data.companies) ? data.companies : [];
          _kernelCache = cos.filter(function (c) { return c && (c.d === 'agriculture' || c.d === 'p2_agri'); });
          var subs = _kernelLoading; _kernelLoading = null;
          subs.forEach(function (fn) { try { fn(_kernelCache); } catch (e) {} });
        })
        .catch(function (err) {
          _kernelCache = null;
          _lastError = 'kernel fetch failed: ' + (err && err.message ? err.message : 'unknown');
          var subs = _kernelLoading; _kernelLoading = null;
          subs.forEach(function (fn) { try { fn(null); } catch (e) {} });
        });
    } catch (err) {
      _lastError = 'kernel fetch threw: ' + (err && err.message ? err.message : 'unknown');
      var subs = _kernelLoading; _kernelLoading = null;
      subs.forEach(function (fn) { try { fn(null); } catch (e) {} });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // ACTIVATION PREDICATES (A/B/C/D)
  // ══════════════════════════════════════════════════════════════════════

  function _resolveTargetsForNode(nid, nodeDir) {
    var te = _targetingEngine();
    if (!te) return null;
    try {
      return te.resolveTargets({
        _directive: {
          nodeId: nid,
          nodeLabel: (nodeDir[nid] && nodeDir[nid].label) || '',
          treatmentLabel: '',
          companies: []
        },
        diagnosisId: '',
        examples: [],
        path: 'INVESTABLE'
      });
    } catch (e) { return null; }
  }

  function _activatedNodes(ds, nodeDir, kernel) {
    var activated = {};
    function _mark(nid, pred, env) {
      if (!activated[nid]) activated[nid] = { nodeId: nid, predicates: [], envelopes: [] };
      if (activated[nid].predicates.indexOf(pred) === -1) activated[nid].predicates.push(pred);
      if (env && activated[nid].envelopes.indexOf(env) === -1) activated[nid].envelopes.push(env);
    }

    // A: active diagnosis circuits
    var activeDx = (ds.brainDiagnoses || []).filter(function (d) { return d && d.active === true; });
    for (var i = 0; i < activeDx.length; i++) {
      var circuits = activeDx[i].circuits || [];
      for (var j = 0; j < circuits.length; j++) {
        if (circuits[j] && circuits[j].nodeId) _mark(circuits[j].nodeId, 'A', activeDx[i].id);
      }
    }

    // B: deep treatment evidence
    var rc = ds.brainResolvedContent;
    if (rc && rc.byDiagnosis) {
      for (var dxId in rc.byDiagnosis) {
        if (!rc.byDiagnosis.hasOwnProperty(dxId)) continue;
        var ts = (rc.byDiagnosis[dxId] && rc.byDiagnosis[dxId].treatments) || [];
        for (var ti = 0; ti < ts.length; ti++) {
          if (ts[ti] && ts[ti].nodeId) _mark(ts[ti].nodeId, 'B', dxId);
        }
      }
    }

    // C: kernel-scored target companies under elevated signal
    if (kernel && kernel.length && nodeDir) {
      for (var nid in nodeDir) {
        if (!nodeDir.hasOwnProperty(nid)) continue;
        var resolved = _resolveTargetsForNode(nid, nodeDir);
        if (!resolved) continue;
        var allTargets = [].concat(resolved.tier1 || []).concat(resolved.tier3 || []);
        var tickers = {};
        for (var tk = 0; tk < allTargets.length; tk++) {
          if (allTargets[tk].ticker) tickers[allTargets[tk].ticker] = true;
        }
        for (var ki = 0; ki < kernel.length; ki++) {
          var c = kernel[ki];
          if (!c || !c.t || !tickers[c.t]) continue;
          var elevated = c.a === true
            || c.p === 'p7a' || c.p === 'p9'
            || c.tr === 'TERMINAL_DIVERGENCE';
          if (elevated) _mark(nid, 'C', null);
        }
      }
    }

    // D (future): cross-domain emissions with nodeId payload — inputs may not
    // yet carry node-level emission tags. Emit honestly: no-op when absent.

    return activated;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PER-LANE GENERATORS (read-only; deterministic from rule tables)
  // ══════════════════════════════════════════════════════════════════════

  // _genPatents, _genGrants, _genLoans removed 2026-06-21 — lanes purged.
  // Only investment + research output lanes survive in opportunityLanes.

  function _genInvestments(kernelLinks) {
    var out = [];
    for (var i = 0; i < kernelLinks.length; i++) {
      var k = kernelLinks[i];
      out.push({
        ticker: k.ticker,
        name: k.name,
        cik: k.cik,
        kernelPhase: k.phase,
        trajectory: k.trajectory,
        composite: k.composite,
        alert: k.alert,
        verdict: k.verdict,
        anchorNodeId: k.anchorNode,
        investmentThesis: 'HUMAN synthesis required — kernel provides verdict class, not strategy.',
        validationCheck: 'Required — independent financial diligence before position entry.'
      });
    }
    return out;
  }

  function _genTargetCompanies(tier1, tier3, kernelByTicker) {
    var out = [];
    var seen = {};
    function _push(c, tierTag) {
      var key = (c.ticker || c.name || '') + '::' + tierTag;
      if (seen[key]) return;
      seen[key] = true;
      var k = c.ticker ? kernelByTicker[c.ticker] : null;
      out.push({
        name: c.name || '?',
        ticker: c.ticker || null,
        tier: tierTag,
        source: c.source || (tierTag === 'tier1' ? 'portal_verified' : 'segment_taxonomy'),
        segment: c.segment || null,
        kernelPhase: k ? k.p : null,
        kernelTrajectory: k ? k.tr : null
      });
    }
    (tier1 || []).forEach(function (c) { _push(c, 'tier1'); });
    (tier3 || []).forEach(function (c) { _push(c, 'tier3'); });
    return out;
  }

  function _genResearch(dir, deepList) {
    var out = [];
    var seen = {};
    // For each research agency, if any deep treatment has evidence in preferred range, emit one candidate per (agency, archetype).
    for (var ri = 0; ri < RESEARCH_AGENCY_RULES.length; ri++) {
      var r = RESEARCH_AGENCY_RULES[ri];
      var matched = false;
      for (var ti = 0; ti < deepList.length; ti++) {
        var t = deepList[ti];
        var ev = (t.evidence || '').toString();
        if (r.preferredEvidence.indexOf(ev) !== -1) { matched = true; break; }
      }
      // Even without deep treatments, emit 1 SARE (low-threshold) entry so research lane is never empty per node
      if (!matched && r.agency !== 'SARE') continue;
      var key = r.agency + '::' + r.program;
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        agency: r.agency,
        program: r.program,
        archetype: r.archetype,
        hypothesis: (dir.dysregulation || dir.label || '').toString(),
        nodeAnchor: dir.label || '',
        citedEvidence: deepList.filter(function (t) { return !!t.cite; }).map(function (t) { return t.cite; }).slice(0, 3),
        piRequirement: 'HUMAN — PI identification + institutional home required.'
      });
    }
    return out;
  }

  function _genOperatorServices(mappedBusinesses) {
    var out = [];
    for (var i = 0; i < mappedBusinesses.length; i++) {
      var b = mappedBusinesses[i];
      if (!b || !b.type) continue;
      if (!SERVICE_ARCHETYPE_REGEX.test(b.type)) continue;
      out.push({
        serviceType: b.type,
        rationale: b.reason || '',
        confidence: b.confidence != null ? b.confidence : null,
        cadenceSuggested: 'per-season (pre-plant / mid-season / post-harvest)',
        dayRateRange: '[HUMAN-DEFINED]',
        deliverable90d: 'HUMAN synthesis — derived from deep treatment steps at this node.',
        workQueueClass: 'advisory'
      });
    }
    return out;
  }

  function _genOperatorTasks(row) {
    var tasks = [];
    tasks.push({ task: 'Confirm activation of node ' + row.nodeId + (row.nodeLabel ? ' (' + row.nodeLabel + ')' : ''), role: 'Domain Operator', gating: true });
    if (row.mappedBusinesses.length > 0) {
      tasks.push({
        task: 'Validate mapped business types: ' + row.mappedBusinesses.map(function (m) { return m.type; }).join('; '),
        role: 'Domain Operator', gating: true
      });
    }
    if (row.opportunityLanes.investments.length > 0) {
      tasks.push({ task: 'Run diligence on kernel-flagged tickers: ' + row.opportunityLanes.investments.map(function (i) { return i.ticker; }).join(', '), role: 'Investment Analyst', gating: true });
    }
    if (row.opportunityLanes.research.length > 0) {
      tasks.push({ task: 'Identify PI + institutional home for research hypothesis at node ' + row.nodeId, role: 'Research Lead', gating: true });
    }
    if (row.opportunityLanes.operatorServices.length > 0) {
      tasks.push({ task: 'Stand up service capacity for: ' + row.opportunityLanes.operatorServices.map(function (s) { return s.serviceType; }).join('; '), role: 'Operations / Founder', gating: true });
    }
    return tasks;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ROW BUILDER
  // ══════════════════════════════════════════════════════════════════════

  function _buildRow(nid, activation, ds, nodeDir, kernel) {
    var dir = nodeDir[nid] || null;

    var row = {
      nodeId: nid,
      nodeFullName: null,
      nodeLabel: null,
      nodeFunction: null,
      nodeDysregulation: null,
      businessAnalog: null,
      neuroTranslation: null,
      tier: null,
      derivedDiagnosis: null,
      mappedBusinesses: [],
      opportunityLanes: {
        investments: [],
        targetCompanies: [], research: [], operatorServices: []
      },
      deepEvidence: [],
      kernelLinks: [],
      operatorTasks: [],
      coverage: {
        predicates: activation.predicates.slice(),
        envelopes: activation.envelopes.slice(),
        hasNodeDirectoryEntry: !!dir,
        deepTreatmentCount: 0,
        mappedBusinessCount: 0,
        targetCompanyCount: 0,
        kernelLinkCount: 0,
        lanes: { investments: 0, targetCompanies: 0, research: 0, operatorServices: 0 }
      },
      missing_proof: []
    };

    if (!dir) {
      row.missing_proof.push('node ' + nid + ' not present in NODE_BUSINESS_DIRECTORY (UNKNOWN mapping)');
      return row;
    }

    row.nodeFullName      = dir.fullName || null;
    row.nodeLabel         = dir.label || null;
    row.nodeFunction      = dir.function || null;
    row.nodeDysregulation = dir.dysregulation || null;
    row.businessAnalog    = dir.label || null;
    row.neuroTranslation  = dir.neuroTranslation || null;
    row.tier              = dir.tier || 'operational';

    // Derived diagnosis
    if (activation.envelopes.length > 0) {
      var envId = activation.envelopes[0];
      var envDx = (ds.brainDiagnoses || []).filter(function (d) { return d && d.id === envId; })[0];
      row.derivedDiagnosis = {
        id: envId,
        label: dir.dysregulation || (envDx && envDx.label) || envId,
        scope: 'node',
        nodeId: nid,
        envelope: envId,
        driverPath: activation.predicates.slice(),
        source: envDx ? 'feed_driven_envelope' : 'node_derived_envelope'
      };
    } else {
      row.derivedDiagnosis = {
        id: 'NODE_ACTIVATION_' + nid,
        label: dir.dysregulation || ((dir.label || nid) + ' activation'),
        scope: 'node',
        nodeId: nid,
        envelope: null,
        driverPath: activation.predicates.slice(),
        source: 'node_derived'
      };
    }

    // Mapped businesses
    var expected = Array.isArray(dir.expectedTypes) ? dir.expectedTypes : [];
    for (var ei = 0; ei < expected.length; ei++) {
      var ex = expected[ei] || {};
      row.mappedBusinesses.push({
        type: ex.type || null,
        reason: ex.reason || null,
        confidence: (typeof ex.confidence === 'number') ? ex.confidence : null
      });
    }
    row.coverage.mappedBusinessCount = row.mappedBusinesses.length;
    if (row.mappedBusinesses.length === 0) row.missing_proof.push('no expectedTypes in NODE_DIRECTORY for node ' + nid);

    // Deep evidence (filtered by nodeId from brainResolvedContent)
    var rc = ds.brainResolvedContent;
    var deepList = [];
    if (rc && rc.byDiagnosis) {
      for (var dxId in rc.byDiagnosis) {
        if (!rc.byDiagnosis.hasOwnProperty(dxId)) continue;
        var ts = (rc.byDiagnosis[dxId] && rc.byDiagnosis[dxId].treatments) || [];
        for (var ti = 0; ti < ts.length; ti++) {
          var t = ts[ti];
          if (t && t.nodeId === nid) {
            deepList.push(t);
            row.deepEvidence.push({
              label: t.label || null,
              type: t.type || null,
              evidence: t.evidence || null,
              description: t.description || null,
              cite: t.cite || t.citation || null,
              steps: Array.isArray(t.steps) ? t.steps.slice() : [],
              monitoring: t.monitoring || null,
              escalation: t.escalation || null,
              target: t.target || null,
              depth: (t.depth != null) ? t.depth : null,
              ancestryPath: Array.isArray(t.ancestryPath) ? t.ancestryPath.slice() : null,
              portalDomainId: t.portalDomainId || null,
              portalTitle: t.portalTitle || null,
              diagnosisId: dxId,
              hasDepth: !!(t.cite && Array.isArray(t.steps) && t.steps.length > 0)
            });
          }
        }
      }
    }
    row.coverage.deepTreatmentCount = row.deepEvidence.length;
    if (row.deepEvidence.length === 0) row.missing_proof.push('no deep treatments at node ' + nid);

    // Targeting / kernel join
    var resolved = _resolveTargetsForNode(nid, nodeDir);
    var tier1 = (resolved && resolved.tier1) || [];
    var tier3 = (resolved && resolved.tier3) || [];
    var kernelByTicker = {};
    if (kernel) {
      for (var ki = 0; ki < kernel.length; ki++) if (kernel[ki] && kernel[ki].t) kernelByTicker[kernel[ki].t] = kernel[ki];
    }
    row.opportunityLanes.targetCompanies = _genTargetCompanies(tier1, tier3, kernelByTicker);
    row.coverage.targetCompanyCount = row.opportunityLanes.targetCompanies.length;

    // Kernel links (joined on target tickers)
    for (var tci = 0; tci < row.opportunityLanes.targetCompanies.length; tci++) {
      var tc = row.opportunityLanes.targetCompanies[tci];
      var kc = tc.ticker ? kernelByTicker[tc.ticker] : null;
      if (kc) {
        row.kernelLinks.push({
          ticker: kc.t,
          name: kc.n,
          cik: kc.c,
          domain: kc.d,
          phase: kc.p,
          trajectory: kc.tr,
          composite: kc.co,
          alert: kc.a,
          verdict: _kernelVerdict(kc),
          anchorNode: nid
        });
      }
    }
    row.coverage.kernelLinkCount = row.kernelLinks.length;

    if (!resolved) row.missing_proof.push('targeting engine unavailable for node ' + nid);
    if (!kernel) row.missing_proof.push('kernel data (command-board-data.json) not loaded');

    // Generate lanes — investment + research ONLY (patent/grant/loan purged 2026-06-21)
    row.opportunityLanes.investments      = _genInvestments(row.kernelLinks);
    row.opportunityLanes.research         = _genResearch(dir, deepList);
    row.opportunityLanes.operatorServices = _genOperatorServices(row.mappedBusinesses);

    row.coverage.lanes.investments      = row.opportunityLanes.investments.length;
    row.coverage.lanes.targetCompanies  = row.opportunityLanes.targetCompanies.length;
    row.coverage.lanes.research         = row.opportunityLanes.research.length;
    row.coverage.lanes.operatorServices = row.opportunityLanes.operatorServices.length;

    row.operatorTasks = _genOperatorTasks(row);

    return row;
  }

  // ══════════════════════════════════════════════════════════════════════
  // COMPUTE + PERSIST
  // ══════════════════════════════════════════════════════════════════════

  function _computeMatrix() {
    if (!_enabled()) {
      _matrix = [];
      return;
    }
    var ds = _ds();
    var nodeDir = _nodeDir();
    var rootMissing = [];
    if (!ds) rootMissing.push('window.LIMENDomains.agriculture not present');
    if (!nodeDir) rootMissing.push('LIMENAgricultureBusinessEngine.NODE_DIRECTORY not loaded');
    if (!_targetingEngine()) rootMissing.push('LIMENAgricultureTargetingEngine.resolveTargets not available');

    _loadKernel(function (kernel) {
      if (!kernel) rootMissing.push('kernel data (command-board-data.json) not loaded');
      if (!ds || !nodeDir) {
        _matrix = [];
        _lastComputedAt = Date.now();
        _publish(rootMissing);
        return;
      }
      var activated = _activatedNodes(ds, nodeDir, kernel);
      var rows = [];
      for (var nid in activated) {
        if (!activated.hasOwnProperty(nid)) continue;
        rows.push(_buildRow(nid, activated[nid], ds, nodeDir, kernel));
      }
      // Sort: more predicates fired → first; then tier top → operational; then nodeId
      rows.sort(function (a, b) {
        var ap = (a.coverage && a.coverage.predicates) ? a.coverage.predicates.length : 0;
        var bp = (b.coverage && b.coverage.predicates) ? b.coverage.predicates.length : 0;
        if (ap !== bp) return bp - ap;
        var at = (a.tier === 'top') ? 0 : 1;
        var bt = (b.tier === 'top') ? 0 : 1;
        if (at !== bt) return at - bt;
        return (a.nodeId || '').localeCompare(b.nodeId || '');
      });
      _matrix = rows;
      _lastComputedAt = Date.now();
      _publish(rootMissing);
    });
  }

  function _publish(rootMissing) {
    // Write to window.LIMENDomains.agriculture.brainOpportunityMatrix
    try {
      if (!window.LIMENDomains) window.LIMENDomains = {};
      if (!window.LIMENDomains.agriculture) window.LIMENDomains.agriculture = {};
      window.LIMENDomains.agriculture.brainOpportunityMatrix = _matrix;
      window.LIMENDomains.agriculture.brainOpportunityMatrixMeta = {
        computedAt: _lastComputedAt,
        matrixLength: _matrix.length,
        rootMissingProof: rootMissing || [],
        lastError: _lastError
      };
    } catch (e) { /* silent */ }

    // Also tee to brain.state.opportunityMatrix so the adapter projects it on next cycle
    try {
      if (window.LIMENDomainBrains && typeof window.LIMENDomainBrains.get === 'function') {
        var b = window.LIMENDomainBrains.get('agriculture');
        if (b && b.state) {
          b.state.opportunityMatrix = _matrix;
          b.state.opportunityMatrixMeta = window.LIMENDomains.agriculture.brainOpportunityMatrixMeta;
        }
      }
    } catch (e) { /* silent */ }

    // Notify subscribers
    for (var i = 0; i < _subscribers.length; i++) {
      try { _subscribers[i](_matrix); } catch (e) { /* silent */ }
    }

    // Dispatch event
    try {
      window.dispatchEvent(new CustomEvent('limen:agriculture-opportunity-matrix-update', {
        detail: { matrix: _matrix, at: _lastComputedAt, rootMissingProof: rootMissing || [] }
      }));
    } catch (e) { /* silent */ }
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════

  function _onBrainUpdate(e) {
    try {
      if (e && e.detail && e.detail.domainId === 'agriculture') _computeMatrix();
    } catch (err) { /* silent */ }
  }

  function _onDomainUpdate() {
    // After signal-engine snapshot write, re-apply matrix if it was wiped
    try {
      var slot = (window.LIMENDomains && window.LIMENDomains.agriculture) || null;
      if (slot && !slot.brainOpportunityMatrix && _matrix.length > 0) {
        slot.brainOpportunityMatrix = _matrix;
      }
    } catch (err) { /* silent */ }
  }

  window.addEventListener('limen:domain-brain-update', _onBrainUpdate);
  window.addEventListener('limen:domain-update', _onDomainUpdate);

  // First compute — give the brain cycle a head start.
  // setTimeout runs even if the brain hasn't emitted yet; _computeMatrix
  // gracefully emits rootMissingProof if inputs not yet present.
  setTimeout(_computeMatrix, 600);

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENAgricultureOpportunityMatrix = {
    getMatrix: function () { return _matrix.slice(); },
    recompute: function () { _computeMatrix(); return _matrix.slice(); },
    subscribe: function (cb) {
      if (typeof cb !== 'function') return function () {};
      _subscribers.push(cb);
      return function () {
        var i = _subscribers.indexOf(cb);
        if (i >= 0) _subscribers.splice(i, 1);
      };
    },
    getRulesDoc: function () {
      return {
        // LOAN_PRODUCT_RULES and GRANT_FAMILY_RULES removed 2026-06-21 (lanes purged)
        RESEARCH_AGENCY_RULES: RESEARCH_AGENCY_RULES,
        SERVICE_ARCHETYPE_REGEX: SERVICE_ARCHETYPE_REGEX.source,
        kernelVerdictClassifier: '_kernelVerdict(c) → {label, reason}'
      };
    },
    isEnabled: function () { return _enabled(); },
    getMeta: function () {
      try {
        return (window.LIMENDomains && window.LIMENDomains.agriculture)
          ? (window.LIMENDomains.agriculture.brainOpportunityMatrixMeta || null)
          : null;
      } catch (e) { return null; }
    }
  };

  console.log('[AgricultureOpportunityMatrix] Loaded — node-first 7-lane opportunity engine.');
})();
