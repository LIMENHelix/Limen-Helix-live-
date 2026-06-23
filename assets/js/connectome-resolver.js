/**
 * assets/js/connectome-resolver.js
 * LIMEN Connectome Opportunity Resolver
 *
 * Adapter layer that bridges feed domain signals into connectome node
 * activations and enriches opportunities with node-level context.
 *
 * This module is NOT a kernel. It does NOT score, classify phases,
 * compute trajectories, or act as scoring authority.
 * All scoring authority belongs to limen-helix-api/limen_backtest_kernel.js
 * (the Thing 2 lineage v4 patent kernel, extracted from bk-scorer.js).
 *
 * This module DOES:
 *   - Map feed domain IDs to connectome domain IDs
 *   - Load the 111-node directory (brain-node-domains.json)
 *   - Activate nodes based on which feed domains are stressed
 *   - Extract business mappings from node roles
 *   - Load domain detail (activations, treatments) on demand
 *   - Enrich opportunity objects with connectome context
 *   - Relay to Thing 2 v4 patent kernel via adapter chain (DISABLED)
 *
 * Flow: feed signal → connectome domain mapping → node activation
 *       → business mapping / diagnosis enrichment → enriched opportunity
 *
 * Depends on:
 *   - assets/data/brain-node-domains.json (precomputed node→domain lookup)
 *   - window.LIMENDomains (live feed state from domain-signal-engine)
 */
(function() {
'use strict';

// ═══════════════════════════════════════════════════
// 1. FEED-TO-CONNECTOME DOMAIN BRIDGE
// ═══════════════════════════════════════════════════
// Feed system uses 20 IDs. Connectome uses ~22. This bridge maps between them.

var FEED_TO_CONNECTOME = {
  // Direct matches
  economy:        ['economy'],
  energy:         ['energy'],
  environment:    ['environment'],
  technology:     ['technology'],
  education:      ['education'],
  governance:     ['governance'],
  industry:       ['industry'],
  infrastructure: ['infrastructure'],
  population:     ['population'],
  religion:       ['religion'],
  // Renamed / semantic mappings
  health:         ['medicine', 'metabolic'],
  // ADDITIVE (cognition port, finance gap 2 — fintech/AI-research → finance circuit):
  //   research/science stress (fintech, algo accounting, AI risk management) now
  //   activates the dedicated finance circuit in addition to the science circuit,
  //   so finance can see research-origin stress and propagate a correction.
  research:       ['science', 'finance'],
  law:            ['legal'],
  // ADDITIVE (cognition port, finance gap 2 — trade finance → finance circuit):
  //   trade stress (payment systems, credit for shipments, collateral for goods)
  //   now also activates the dedicated finance circuit. Trade without trade finance
  //   = supply-chain freeze (2008, 2020 COVID); finance must see the trade signal.
  supplyChain:    ['trade', 'finance'],
  // ADDITIVE (cognition port, finance gap 1 — dedicated finance circuit):
  //   finance feed signal previously relayed through 'economy' ONLY, which made
  //   finance stress at the signal origin undershoot — it never propagated through
  //   the dedicated finance circuit. The 'finance' connectome domain exists in
  //   brain-node-domains.json (123 node-participations) but the resolver ignored it.
  //   We keep the 'economy' relay (validated path, never removed) and ADD 'finance'
  //   so the full finance circuit can activate. The sub-domain IDs in the gap spec
  //   (stock/bond/banking/forex/insurance) are intentionally NOT mapped: they are
  //   not real connectome domains in the node directory and would be dead routes
  //   that activate zero nodes. The single 'finance' connectome domain is the
  //   dedicated multi-circuit relay.
  finance:        ['economy', 'finance'],
  communication:  ['technology'],
  culture:        ['culture', 'religion', 'education'],
  defense:        ['governance'],
  intelligence:   ['governance', 'science'],
  agriculture:    ['environment', 'trade']
};

// ═══════════════════════════════════════════════════
// 1b. MACRO INDICATOR SERIES BINDING (ADDITIVE — economy gap 1)
// ═══════════════════════════════════════════════════
// The resolver maps feed domains → connectome domains → node activations, but
// previously held NO explicit binding of REAL macro statistics to the specific
// connectome nodes that sense them. Economy is the MACRO AGGREGATE and stays
// DISTINCT from finance (capital markets / credit / banks). This registry binds
// REAL FRED series IDs + broad-market index proxies (never single-company
// tickers, never fabricated) to the economy connectome nodes they sense, so the
// kernel/reporting/diagnosis layers can drill from abstract 'economy stress'
// into the ACTUAL economic statistic that triggered it
// (e.g. labor-markets node activated → UNRATE spiked → unemployment-shock origin).
//
// Each entry: { series, node, role (macro identity label), nodeRole (the real
// role the node plays in brain-node-domains.json), label, threshold, dir,
// kind ('fred' | 'market'), policyPath }.
//   - threshold = the macro level above/below which the node is considered stressed.
//   - dir = 'high' (stress when value ABOVE threshold) | 'low' (stress when BELOW).
//   - policyPath = 'fiscal' | 'monetary' | 'market' | 'real' (see gap 2 split).
// This is annotation/registry metadata ONLY — the resolver does NOT score it.
var MACRO_INDICATOR_BINDING = {
  // ── Growth / output (real economy) ──
  GDPC1:    { series: 'GDPC1',    node: 'LGN',   role: 'GDP Output',            nodeRole: 'Agricultural Finance Assessment & Diagnostics', label: 'Real GDP',               threshold: -2.5,    dir: 'low',  kind: 'fred',   policyPath: 'real' },
  GDP:      { series: 'GDP',      node: 'LGN',   role: 'GDP Output',            nodeRole: 'Agricultural Finance Assessment & Diagnostics', label: 'Nominal GDP',            threshold: 0,       dir: 'low',  kind: 'fred',   policyPath: 'real' },
  INDPRO:   { series: 'INDPRO',   node: 'STN',   role: 'Industrial Production', nodeRole: 'Efficiency Modeling Systems',                  label: 'Industrial Production',  threshold: -2,      dir: 'low',  kind: 'fred',   policyPath: 'real' },
  // ── Inflation (price stability) ──
  CPIAUCSL: { series: 'CPIAUCSL', node: 'HPA',   role: 'Inflation & Deflation', nodeRole: 'Agricultural Trade — Optimization & Innovation', label: 'CPI',                  threshold: 3.2,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  PCEPI:    { series: 'PCEPI',    node: 'HPA',   role: 'Inflation & Deflation', nodeRole: 'Agricultural Trade — Optimization & Innovation', label: 'PCE Deflator',         threshold: 2.5,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  // ── Employment / labor markets ──
  UNRATE:   { series: 'UNRATE',   node: 'RSC',   role: 'Labor Markets',         nodeRole: 'Crop Economics Technology & Innovation',       label: 'Unemployment Rate',      threshold: 5.5,     dir: 'high', kind: 'fred',   policyPath: 'real' },
  PAYEMS:   { series: 'PAYEMS',   node: 'RSC',   role: 'Labor Markets',         nodeRole: 'Crop Economics Technology & Innovation',       label: 'Nonfarm Payrolls',       threshold: -200000, dir: 'low',  kind: 'fred',   policyPath: 'real' },
  // ── Sentiment (consumer / business) ──
  UMCSENT:  { series: 'UMCSENT',  node: 'mPFC',  role: 'Consumer Spending',     nodeRole: 'Benchmarking',                                 label: 'Consumer Sentiment',     threshold: 60,      dir: 'low',  kind: 'fred',   policyPath: 'real' },
  // ── Monetary policy (Fed / central bank / rates) ──
  FEDFUNDS: { series: 'FEDFUNDS', node: 'STS',   role: 'Monetary Policy',       nodeRole: 'Baseline Calibration Operations',              label: 'Fed Funds Rate',         threshold: 5.5,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  DGS10:    { series: 'DGS10',    node: 'STS',   role: 'Monetary Policy',       nodeRole: 'Baseline Calibration Operations',              label: '10Y Treasury Yield',     threshold: 4.5,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  // ── Broad-market proxies (index ETFs — NOT single companies) ──
  SPY:      { series: 'SPY',      node: 'ASTRO', role: 'Capital Markets',       nodeRole: 'econ livestock — Signal Acquisition',          label: 'Broad Market (S&P 500)', threshold: -15,     dir: 'low',  kind: 'market', policyPath: 'market' },
  DIA:      { series: 'DIA',      node: 'NTS',   role: 'Capital Markets',       nodeRole: 'Protocol Development Evaluation',               label: 'Equity Risk (Dow 30)',   threshold: -12,     dir: 'low',  kind: 'market', policyPath: 'market' },
  TLT:      { series: 'TLT',      node: 'BDNF',  role: 'Debt Markets',          nodeRole: 'Agricultural Finance Infrastructure & Capacity', label: 'Long Yields (20Y+ Tsy)', threshold: 4.5,    dir: 'high', kind: 'market', policyPath: 'market' },
  GLD:      { series: 'GLD',      node: 'PUT',   role: 'Safe-Haven Hedge',      nodeRole: 'Land Tenure — Optimization & Innovation',      label: 'Gold Hedge',             threshold: 2000,    dir: 'high', kind: 'market', policyPath: 'market' }
};

// ── FISCAL vs MONETARY POLICY TRANSMISSION (ADDITIVE — economy gap 2) ──
// The existing FEED_TO_CONNECTOME['finance'] = ['economy','finance'] mapping does
// NOT distinguish FISCAL (Treasury / OMB / Congress: spending, taxes, debt
// issuance) from MONETARY (Fed / central bank: rates, balance sheet, EFFR)
// policy paths. They transmit through DIFFERENT pathways and should light up
// DIFFERENT nodes: a government-spending shock activates governance + economy
// (fiscal multiplier → employment → consumption), whereas a rate hike activates
// economy + finance (credit channel). We do NOT alter the validated 'finance'
// relay (which stays ['economy','finance']); we ADD a parallel policy-path
// registry that upstream code (domain-signal-engine separating Treasury MTS /
// Cash Balance / Debt Outstanding sources from Fed Monetary Press / Fed Reg /
// NY Fed EFFR sources) can use to route a policy shock to the correct nodes.
// Resolving by policy path is OPT-IN (resolvePolicyPath) — the default resolve()
// pipeline is unchanged.
var MACRO_POLICY_PATH = {
  // Fiscal = Treasury / OMB / Congress. Adds 'governance' so budget, tax, and
  // spending authority can route through the governance circuit independently of
  // the monetary credit channel. Economy = the macro aggregate it ultimately hits.
  fiscal:   { connectomeDomains: ['economy', 'governance', 'finance'], indicators: ['GDP', 'GDPC1', 'UNRATE', 'PAYEMS', 'INDPRO'], sources: ['Treasury MTS', 'Treasury Cash Balance', 'Treasury Debt Outstanding', 'OMB'] },
  // Monetary = Fed / central bank. Keeps the validated economy + finance credit
  // channel (rate hikes → credit conditions → capital markets).
  monetary: { connectomeDomains: ['economy', 'finance'],               indicators: ['FEDFUNDS', 'DGS10', 'CPIAUCSL', 'PCEPI'],     sources: ['Fed Monetary Press', 'Fed Reg', 'NY Fed EFFR'] }
};

// Reverse lookup: connectome node → macro indicators it senses (for diagnosis drill-down).
var NODE_TO_MACRO_INDICATOR = {};
for (var _mk in MACRO_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(MACRO_INDICATOR_BINDING, _mk)) continue;
  var _mb = MACRO_INDICATOR_BINDING[_mk];
  if (!NODE_TO_MACRO_INDICATOR[_mb.node]) NODE_TO_MACRO_INDICATOR[_mb.node] = [];
  NODE_TO_MACRO_INDICATOR[_mb.node].push(_mb);
}

// Reverse: connectome domain → feed domains (for display)
var CONNECTOME_TO_FEED = {};
for (var fk in FEED_TO_CONNECTOME) {
  var targets = FEED_TO_CONNECTOME[fk];
  for (var ti = 0; ti < targets.length; ti++) {
    if (!CONNECTOME_TO_FEED[targets[ti]]) CONNECTOME_TO_FEED[targets[ti]] = [];
    if (CONNECTOME_TO_FEED[targets[ti]].indexOf(fk) === -1) CONNECTOME_TO_FEED[targets[ti]].push(fk);
  }
}

// Stress threshold for node activation (preprocessing filter, not a score)
var STRESS_ACTIVATION_THRESHOLD = 0.35;

// ═══════════════════════════════════════════════════
// 2. NODE DIRECTORY (loaded from brain-node-domains.json)
// ═══════════════════════════════════════════════════

var _nodeDirectory = null;
var _directoryLoaded = false;
var _directoryLoading = false;
var _directoryCallbacks = [];

function loadNodeDirectory(callback) {
  if (_directoryLoaded) { callback(_nodeDirectory); return; }
  _directoryCallbacks.push(callback);
  if (_directoryLoading) return;
  _directoryLoading = true;

  fetch('/assets/data/brain-node-domains.json')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      _nodeDirectory = data || {};
      _directoryLoaded = true;
      _directoryLoading = false;
      for (var i = 0; i < _directoryCallbacks.length; i++) _directoryCallbacks[i](_nodeDirectory);
      _directoryCallbacks = [];
    })
    .catch(function() {
      _nodeDirectory = {};
      _directoryLoaded = true;
      _directoryLoading = false;
      for (var i = 0; i < _directoryCallbacks.length; i++) _directoryCallbacks[i](_nodeDirectory);
      _directoryCallbacks = [];
    });
}

// ═══════════════════════════════════════════════════
// 3. DOMAIN DETAIL CACHE (loaded from domain JSONs on demand)
// ═══════════════════════════════════════════════════

var _domainDetailCache = {};

function loadDomainDetail(connectomeDomainId, callback) {
  if (_domainDetailCache[connectomeDomainId]) {
    callback(_domainDetailCache[connectomeDomainId]);
    return;
  }
  fetch('/assets/data/domains/' + connectomeDomainId + '.json')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data) {
        _domainDetailCache[connectomeDomainId] = {
          activations: data.activations || [],
          issues: data.issues || [],
          title: data.title || connectomeDomainId,
          phase: data.phase || 'P3'
        };
      } else {
        _domainDetailCache[connectomeDomainId] = { activations: [], issues: [], title: connectomeDomainId, phase: 'P3' };
      }
      callback(_domainDetailCache[connectomeDomainId]);
    })
    .catch(function() {
      _domainDetailCache[connectomeDomainId] = { activations: [], issues: [], title: connectomeDomainId, phase: 'P3' };
      callback(_domainDetailCache[connectomeDomainId]);
    });
}

// ═══════════════════════════════════════════════════
// 4. NODE ACTIVATION ENGINE
// ═══════════════════════════════════════════════════
// Maps stressed feed domains → connectome domains → activated nodes.
// activationStrength is the raw feed stress value passed through,
// NOT a computed score. It is annotation metadata for display only.

/**
 * Given stressed feed domains, find which connectome nodes are activated.
 * @param {Array} stressedFeedDomains - [{id, stress, status}]
 * @returns {Array} sorted node activations
 */
function activateNodes(stressedFeedDomains) {
  if (!_nodeDirectory) return [];

  // Map feed domains → connectome domains
  var activeConnectomeDomains = {};
  for (var i = 0; i < stressedFeedDomains.length; i++) {
    var fd = stressedFeedDomains[i];
    var mapped = FEED_TO_CONNECTOME[fd.id] || [];
    for (var j = 0; j < mapped.length; j++) {
      if (!activeConnectomeDomains[mapped[j]]) activeConnectomeDomains[mapped[j]] = [];
      activeConnectomeDomains[mapped[j]].push({ feedDomain: fd.id, stress: fd.stress });
    }
  }

  // Find nodes that participate in active connectome domains
  var nodeActivations = {};
  for (var nodeId in _nodeDirectory) {
    var nodeDomains = _nodeDirectory[nodeId];
    var matchedDomains = [];
    var totalStrength = 0;

    for (var nd = 0; nd < nodeDomains.length; nd++) {
      var domEntry = nodeDomains[nd];
      if (activeConnectomeDomains[domEntry.domain]) {
        var feedSources = activeConnectomeDomains[domEntry.domain];
        for (var fs = 0; fs < feedSources.length; fs++) {
          matchedDomains.push({
            connectomeDomain: domEntry.domain,
            role: domEntry.role,
            label: domEntry.label,
            feedDomain: feedSources[fs].feedDomain,
            stress: feedSources[fs].stress
          });
          totalStrength += feedSources[fs].stress;
        }
      }
    }

    if (matchedDomains.length > 0) {
      nodeActivations[nodeId] = {
        nodeId: nodeId,
        domains: matchedDomains,
        // activationStrength is avg raw feed stress — annotation only, not a score
        activationStrength: Math.min(1.0, totalStrength / matchedDomains.length),
        domainCount: matchedDomains.length,
        crossDomainNode: _countUnique(matchedDomains.map(function(d){ return d.feedDomain; })) > 1
      };
    }
  }

  // Sort by cross-domain first, then by activation strength
  var sorted = Object.keys(nodeActivations).map(function(k){ return nodeActivations[k]; });
  sorted.sort(function(a, b) {
    if (a.crossDomainNode !== b.crossDomainNode) return b.crossDomainNode ? 1 : -1;
    return b.activationStrength - a.activationStrength;
  });

  return sorted;
}

function _countUnique(arr) {
  var seen = {};
  for (var i = 0; i < arr.length; i++) seen[arr[i]] = true;
  return Object.keys(seen).length;
}

// ═══════════════════════════════════════════════════
// 4b. DIAGNOSIS-AWARE ACTIVATION (additive)
// ═══════════════════════════════════════════════════
// Walks window.LIMENDomains[dk].brainDiagnoses[] where dx.active === true
// and extracts per-circuit node activations carrying the diagnosis binding.
// Merged with the stress-based activateNodes() output in resolve().
// Produces entries with the same shape as activateNodes() plus a new
// optional diagnosisBindings[] array. Returns a Map<nodeId, entry>.
// Zero behavior change if no brain emits brainDiagnoses.

function _collectDiagnosisActivations(doms) {
  var out = new Map();
  if (!doms || typeof doms !== 'object') return out;
  var seenSources = {}; // nodeId -> { sourceDomain: true } for crossDomainNode detection

  for (var dk in doms) {
    if (!Object.prototype.hasOwnProperty.call(doms, dk)) continue;
    var d = doms[dk];
    var dxList = (d && Array.isArray(d.brainDiagnoses)) ? d.brainDiagnoses : [];
    for (var di = 0; di < dxList.length; di++) {
      var dx = dxList[di];
      if (!dx || dx.active !== true) continue;
      var circuits = Array.isArray(dx.circuits) ? dx.circuits : [];
      for (var ci = 0; ci < circuits.length; ci++) {
        var c = circuits[ci];
        if (!c || !c.nodeId) continue;
        var nid = c.nodeId;

        var binding = {
          diagnosisId:      dx.id || null,
          diagnosisLabel:   dx.label || null,
          circuitRole:      c.detail || null,
          circuitDirection: c.dir || null,
          circuitEvidence:  c.evidence || null,
          sourceDomain:     dk
        };

        var connDomArr = FEED_TO_CONNECTOME[dk];
        var connDom = (connDomArr && connDomArr.length) ? connDomArr[0] : dk;
        var strength = (typeof dx.relevance === 'number') ? dx.relevance : 0;
        var synthDomainEntry = {
          connectomeDomain: connDom,
          role:             c.detail || dx.label || '',
          label:            dx.label || '',
          feedDomain:       dk,
          stress:           strength
        };

        if (!out.has(nid)) {
          seenSources[nid] = {};
          seenSources[nid][dk] = true;
          out.set(nid, {
            nodeId: nid,
            domains: [synthDomainEntry],
            activationStrength: Math.min(1.0, strength),
            domainCount: 1,
            crossDomainNode: false,
            diagnosisBindings: [binding]
          });
        } else {
          var existing = out.get(nid);
          existing.domains.push(synthDomainEntry);
          existing.diagnosisBindings.push(binding);
          existing.activationStrength = Math.min(1.0, Math.max(existing.activationStrength, strength));
          seenSources[nid][dk] = true;
          existing.crossDomainNode = Object.keys(seenSources[nid]).length > 1;
          existing.domainCount = existing.domains.length;
        }
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════
// 5. OPPORTUNITY ENRICHMENT
// ═══════════════════════════════════════════════════
// Enriches existing playbook opportunities with connectome node context.
// No scoring. Node/business/diagnosis data only.

/**
 * Enrich an existing playbook opportunity with connectome data.
 * @param {Object} opp - existing opportunity from _activateOpportunities()
 * @param {Array} nodeActivations - from activateNodes()
 * @param {Object} feedSnapshot - raw feed domain data { domainId: { stress, status } }
 * @returns {Object} enriched opportunity with connectome fields
 */
function enrichOpportunity(opp, nodeActivations, feedSnapshot) {
  var pb = opp.pb;
  var oppDomains = pb.domains || [];

  // Find nodes relevant to this opportunity's domains
  var relevantNodes = [];
  for (var i = 0; i < nodeActivations.length; i++) {
    var node = nodeActivations[i];
    var isRelevant = false;
    for (var j = 0; j < node.domains.length; j++) {
      if (oppDomains.indexOf(node.domains[j].feedDomain) !== -1) {
        isRelevant = true;
        break;
      }
    }
    if (isRelevant) relevantNodes.push(node);
  }

  // Top 8 most activated nodes for this opportunity
  var topNodes = relevantNodes.slice(0, 8);

  // Build business mappings from node roles
  var businessMappings = [];
  var seenRoles = {};
  for (var ni = 0; ni < topNodes.length; ni++) {
    var nd = topNodes[ni].domains;
    for (var ndi = 0; ndi < nd.length; ndi++) {
      var roleKey = nd[ndi].role;
      if (!seenRoles[roleKey] && oppDomains.indexOf(nd[ndi].feedDomain) !== -1) {
        seenRoles[roleKey] = true;
        businessMappings.push({
          nodeId: topNodes[ni].nodeId,
          role: nd[ndi].role,
          domain: nd[ndi].connectomeDomain,
          label: nd[ndi].label,
          strength: topNodes[ni].activationStrength
        });
      }
    }
  }
  businessMappings.sort(function(a, b) { return b.strength - a.strength; });

  // Connectome-derived stressor summary (descriptive, not a score)
  var stressorSummary = '';
  if (topNodes.length > 0) {
    var topRoles = topNodes.slice(0, 3).map(function(n) {
      var primaryRole = n.domains[0] ? n.domains[0].role : n.nodeId;
      return primaryRole + ' (' + n.nodeId + ')';
    });
    stressorSummary = 'Node activation: ' + topRoles.join(', ');
  }

  // Feed domain snapshot for display (pass-through, not scored)
  var feedContext = {};
  for (var di = 0; di < oppDomains.length; di++) {
    var dk = oppDomains[di];
    var fd = feedSnapshot[dk];
    if (fd) {
      feedContext[dk] = {
        stress: fd.stress || 0,
        status: fd.status || 'UNKNOWN'
      };
    }
  }

  return {
    // Preserve all original fields
    pb: opp.pb,
    confidence: opp.confidence,
    urgency: opp.urgency,
    whyNow: opp.whyNow,
    status: opp.status,
    quality: opp.quality,
    // Connectome enrichment (annotation only — no scores)
    connectome: {
      nodes: topNodes.map(function(n) {
        // ADDITIVE (economy gap 1): attach the REAL macro indicators this node
        // senses (FRED series / market proxy) so 'this node lit up' becomes
        // traceable to which ACTUAL economic statistic triggered it.
        var macroInd = (NODE_TO_MACRO_INDICATOR[n.nodeId] || []).map(function(m) {
          return { series: m.series, label: m.label, role: m.role, threshold: m.threshold, dir: m.dir, kind: m.kind, policyPath: m.policyPath };
        });
        // ADDITIVE (economy gap 3): distinguish contagion source. A node sourced
        // ONLY from the economy macro-aggregate (transitively, with no direct feed
        // stress in the opportunity's own domains) is flagged as upstream-economy
        // contagion vs. direct feed stress, so enrichment surfaces WHY it lit up.
        var srcDomains = n.domains.map(function(d) { return d.feedDomain; });
        var hasDirect = false;
        for (var _si = 0; _si < srcDomains.length; _si++) {
          if (oppDomains.indexOf(srcDomains[_si]) !== -1 && srcDomains[_si] !== 'economy') { hasDirect = true; break; }
        }
        var econOnly = srcDomains.indexOf('economy') !== -1 && !hasDirect;
        return {
          id: n.nodeId,
          strength: Math.round(n.activationStrength * 100) / 100,
          crossDomain: n.crossDomainNode,
          roles: n.domains.slice(0, 3).map(function(d) { return d.role; }),
          feedDomains: srcDomains.filter(function(v, i, a) { return a.indexOf(v) === i; }),
          diagnosisBindings: Array.isArray(n.diagnosisBindings) ? n.diagnosisBindings.slice() : [],
          macroIndicators: macroInd,
          activationOrigin: econOnly ? 'ECONOMY_CONTAGION' : (hasDirect ? 'DIRECT_FEED' : 'TRANSITIVE')
        };
      }),
      nodeCount: topNodes.length,
      totalActivated: relevantNodes.length,
      crossDomainNodes: topNodes.filter(function(n) { return n.crossDomainNode; }).length,
      stressorSummary: stressorSummary,
      businessMappings: businessMappings.slice(0, 6),
      feedContext: feedContext,
      source: relevantNodes.length > 0 ? 'CONNECTOME' : 'DOMAIN_ONLY'
    }
  };
}

// ═══════════════════════════════════════════════════
// 6. FULL RESOLVE PIPELINE
// ═══════════════════════════════════════════════════

/**
 * Run the resolver pipeline. No scoring — mapping and enrichment only.
 * @param {Array} opportunities - raw opportunities from _activateOpportunities()
 * @returns {Array} enriched opportunities
 */
function resolve(opportunities) {
  if (!_directoryLoaded || !_nodeDirectory) return opportunities;

  var doms = window.LIMENDomains || {};

  // Identify stressed domains (simple threshold filter, not scoring)
  var stressedDomains = [];
  for (var dk in doms) {
    var d = doms[dk];
    var stress = d.stress || 0;
    if (stress >= STRESS_ACTIVATION_THRESHOLD) {
      stressedDomains.push({ id: dk, stress: stress, status: d.status });
    }
  }

  // Activate connectome nodes from stressed domains (existing path — fallback).
  var stressActivations = activateNodes(stressedDomains);

  // NEW: diagnosis-aware activation from window.LIMENDomains[*].brainDiagnoses.
  // Additive — zero behavior change when no brain emits brainDiagnoses.
  var dxActivationMap = _collectDiagnosisActivations(doms);

  // Merge: stress activations receive any matching diagnosisBindings from
  // dxActivationMap. Diagnosis-only activations (nodes named by an active
  // circuit but not in any stressed domain's static map) are appended with
  // their synthesized domain entry so the enrichOpportunity relevance
  // filter — which matches on domains[].feedDomain — can see them.
  var merged = [];
  var coveredNodeIds = {};
  for (var si = 0; si < stressActivations.length; si++) {
    var a = stressActivations[si];
    var dxEntry = dxActivationMap.get(a.nodeId);
    var bindings = dxEntry ? dxEntry.diagnosisBindings.slice() : [];
    // Shallow clone to avoid mutating the original stress activation object.
    merged.push({
      nodeId: a.nodeId,
      domains: a.domains,
      activationStrength: a.activationStrength,
      domainCount: a.domainCount,
      crossDomainNode: a.crossDomainNode,
      diagnosisBindings: bindings
    });
    coveredNodeIds[a.nodeId] = true;
  }
  dxActivationMap.forEach(function(v, nid) {
    if (!coveredNodeIds[nid]) merged.push(v);
  });

  // Re-sort using the existing rule: cross-domain first, then by strength.
  merged.sort(function(a, b) {
    if (a.crossDomainNode !== b.crossDomainNode) return b.crossDomainNode ? 1 : -1;
    return b.activationStrength - a.activationStrength;
  });

  // Build feed snapshot for pass-through (unchanged)
  var feedSnapshot = {};
  for (var fk in doms) {
    feedSnapshot[fk] = { stress: doms[fk].stress || 0, status: doms[fk].status || 'UNKNOWN' };
  }

  // Enrich each opportunity with connectome context
  var enriched = [];
  for (var i = 0; i < opportunities.length; i++) {
    enriched.push(enrichOpportunity(opportunities[i], merged, feedSnapshot));
  }

  // Store for external access (kernel adapter consumer reads nodeActivations).
  // The added diagnosisBindings field is ignored by the existing kernel chain.
  _lastResolve = {
    nodeActivations: merged,
    stressedDomains: stressedDomains,
    resolvedAt: Date.now()
  };

  return enriched;
}

var _lastResolve = null;

// ═══════════════════════════════════════════════════
// 6b. POLICY-PATH RESOLUTION (ADDITIVE — economy gap 2, OPT-IN)
// ═══════════════════════════════════════════════════
// Activates connectome nodes for a FISCAL or MONETARY policy shock, routing
// through the distinct connectome-domain set in MACRO_POLICY_PATH so fiscal and
// monetary transmission light up different circuits. This is a separate opt-in
// entry point; the default resolve() pipeline (above) is unchanged. No scoring —
// activation is the pass-through stress annotation, same as activateNodes().

/**
 * Resolve node activations for a single policy path ('fiscal' | 'monetary').
 * @param {String} path - 'fiscal' or 'monetary'
 * @param {Number} stress - raw stress value [0..1] for this policy shock
 * @returns {Object} { path, connectomeDomains, indicators, nodes }
 */
function resolvePolicyPath(path, stress) {
  var cfg = MACRO_POLICY_PATH[path];
  if (!cfg) return { path: path, connectomeDomains: [], indicators: [], nodes: [] };
  var s = (typeof stress === 'number') ? stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed
  // domain per connectome domain in the policy path's domain set.
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'POLICY' }; });
  // Map the synthetic feed ids straight through (they already ARE connectome
  // domain ids; activateNodes resolves via FEED_TO_CONNECTOME, so direct-match
  // entries — economy/finance/governance — route 1:1).
  var nodes = activateNodes(synth);
  // Annotate each node with the macro indicators on this policy path.
  var indSet = cfg.indicators.map(function(id) { return MACRO_INDICATOR_BINDING[id]; }).filter(Boolean);
  return {
    path: path,
    connectomeDomains: cfg.connectomeDomains.slice(),
    indicators: indSet,
    sources: (cfg.sources || []).slice(),
    nodes: nodes
  };
}

// ═══════════════════════════════════════════════════
// 7. KERNEL ADAPTER RELAY (DISABLED)
// ═══════════════════════════════════════════════════
// Formerly routed opportunity stress through:
//   connectome-kernel-adapter.js → /api/kernel-experiment → kernel-output-interpreter.js
// That public arbitrary-input scoring endpoint has been removed (410 Gone).
// connectome-kernel-adapter.callKernel() now returns an error pointing
// callers to POST /api/helix-report/score (CIK + safe context only).
// This module never contained kernel math.

/**
 * (DISABLED) Run kernel for an opportunity via the adapter chain.
 * The adapter no longer reaches a kernel. Callers receive an error.
 * Requires LIMENKernelAdapter and LIMENKernelInterpreter to be loaded.
 * @param {Object} feedSnapshot - { domainId: { stress, status } }
 * @param {Array} nodeActivations - from activateNodes()
 * @param {Array} oppDomains - opportunity domain IDs
 * @param {Function} callback - (kernelAnnotation)
 */
function runKernelForOpportunity(feedSnapshot, nodeActivations, oppDomains, callback) {
  if (!window.LIMENKernelAdapter || !window.LIMENKernelInterpreter) {
    callback({ available: false, reason: 'Adapter/interpreter not loaded', experiment: true });
    return;
  }

  var stressData = {
    domains: feedSnapshot,
    nodeActivations: nodeActivations,
    oppDomains: oppDomains
  };

  window.LIMENKernelAdapter.run(stressData, function(err, result) {
    if (err || !result.kernelOutput) {
      callback({
        available: false,
        reason: err || 'Kernel returned no output',
        proxyMapping: result ? result.proxyMapping : null,
        experiment: true
      });
      return;
    }
    var interpreted = window.LIMENKernelInterpreter.interpret(result.kernelOutput, result.proxyMapping);
    callback(interpreted);
  });
}

// ═══════════════════════════════════════════════════
// 8. DOMAIN DETAIL LOADER
// ═══════════════════════════════════════════════════

/**
 * Load full domain detail (activations, issues, treatments) for specific nodes.
 * @param {Array} nodeIds - array of brain node IDs
 * @param {Array} connectomeDomains - connectome domain IDs to check
 * @param {Function} callback - receives { nodeId: { activations, treatments, diagnosticTriggers } }
 */
function loadNodeDetails(nodeIds, connectomeDomains, callback) {
  if (!connectomeDomains || connectomeDomains.length === 0) { callback({}); return; }

  var pending = connectomeDomains.length;
  var domainData = {};

  function handleLoaded(cd, data) {
    domainData[cd] = data;
    if (--pending > 0) return;

    var result = {};
    for (var ni = 0; ni < nodeIds.length; ni++) {
      var nid = nodeIds[ni];
      result[nid] = { activations: [], treatments: [], diagnosticTriggers: [], groups: [] };
      for (var cdKey in domainData) {
        var acts = domainData[cdKey].activations || [];
        for (var ai = 0; ai < acts.length; ai++) {
          if (acts[ai].brainNodeId === nid) {
            result[nid].activations.push({
              domain: cdKey,
              domainTitle: domainData[cdKey].title,
              label: acts[ai].domainLabel,
              description: acts[ai].domainDescription || '',
              function: acts[ai].domainFunction || '',
              group: acts[ai].group,
              phase: acts[ai].phase,
              weight: acts[ai].weight
            });
            if (acts[ai].diagnosticTriggers) {
              for (var dti = 0; dti < acts[ai].diagnosticTriggers.length; dti++) {
                if (result[nid].diagnosticTriggers.indexOf(acts[ai].diagnosticTriggers[dti]) === -1) {
                  result[nid].diagnosticTriggers.push(acts[ai].diagnosticTriggers[dti]);
                }
              }
            }
            if (acts[ai].treatments) {
              for (var tri = 0; tri < acts[ai].treatments.length; tri++) {
                result[nid].treatments.push({
                  domain: cdKey,
                  label: acts[ai].treatments[tri].label,
                  type: acts[ai].treatments[tri].type,
                  evidence: acts[ai].treatments[tri].evidence,
                  description: (acts[ai].treatments[tri].description || '').substring(0, 80)
                });
              }
            }
            if (acts[ai].group && result[nid].groups.indexOf(acts[ai].group) === -1) {
              result[nid].groups.push(acts[ai].group);
            }
          }
        }
      }
    }
    callback(result);
  }

  for (var i = 0; i < connectomeDomains.length; i++) {
    (function(cd) {
      loadDomainDetail(cd, function(data) { handleLoaded(cd, data); });
    })(connectomeDomains[i]);
  }
}

// ═══════════════════════════════════════════════════
// 9. PUBLIC API
// ═══════════════════════════════════════════════════

window.LIMENConnectomeResolver = {
  // Core pipeline
  loadDirectory: loadNodeDirectory,
  resolve: resolve,
  isReady: function() { return _directoryLoaded; },

  // Individual components (mapping/enrichment only)
  activateNodes: activateNodes,
  enrichOpportunity: enrichOpportunity,

  // Detail loading
  loadNodeDetails: loadNodeDetails,

  // Kernel adapter relay — EXPERIMENTAL ANNOTATION ONLY
  // (DISABLED) Formerly called Thing 2 v4 patent kernel via adapter chain; adapter is now neutralized
  runKernelForOpportunity: runKernelForOpportunity,

  // Mappings
  FEED_TO_CONNECTOME: FEED_TO_CONNECTOME,
  CONNECTOME_TO_FEED: CONNECTOME_TO_FEED,
  STRESS_ACTIVATION_THRESHOLD: STRESS_ACTIVATION_THRESHOLD,

  // Macro indicator bindings (economy gap 1) — REAL FRED series + market proxies
  MACRO_INDICATOR_BINDING: MACRO_INDICATOR_BINDING,
  NODE_TO_MACRO_INDICATOR: NODE_TO_MACRO_INDICATOR,
  getMacroIndicatorsForNode: function(nodeId) { return NODE_TO_MACRO_INDICATOR[nodeId] || []; },

  // Fiscal vs monetary policy transmission (economy gap 2) — opt-in
  MACRO_POLICY_PATH: MACRO_POLICY_PATH,
  resolvePolicyPath: resolvePolicyPath,

  // Last resolve state
  getLastResolve: function() { return _lastResolve; },

  // Utility: get connectome domains for a feed domain
  getConnectomeDomains: function(feedDomainId) {
    return FEED_TO_CONNECTOME[feedDomainId] || [];
  },

  // Utility: format node activation summary for display
  formatNodeSummary: function(enrichedOpp) {
    var c = enrichedOpp.connectome;
    if (!c || c.nodeCount === 0) return 'No connectome nodes activated';
    var parts = [];
    parts.push(c.totalActivated + ' node' + (c.totalActivated > 1 ? 's' : '') + ' activated');
    if (c.crossDomainNodes > 0) parts.push(c.crossDomainNodes + ' cross-domain');
    return parts.join(' · ');
  }
};

})();
