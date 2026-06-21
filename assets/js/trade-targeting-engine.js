/**
 * trade-targeting-engine.js — Context-aware targeting for promoted directives
 *
 * Resolves WHO TO TARGET using a tiered model:
 *   Tier 1: Verified entities (domain-aligned companies from portal data)
 *   Tier 2: Entity classes (always present — industry segments)
 *   Tier 3: Example entities (high-confidence, well-known sector players)
 *
 * Filters out mismatched companies (e.g. container shipping under customs brokerage).
 * Never hallucinates — Tier 3 uses only well-established industry names.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENTradeTargetingEngine
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENT TAXONOMY — maps node/directive context to segments
  // ══════════════════════════════════════════════════════════════════════

  var SEGMENTS = {
    container_shipping: {
      label: 'Container shipping lines & vessel operators',
      keywords: ['container', 'shipping', 'vessel', 'carrier', 'liner', 'TEU', 'sailing', 'booking', 'slot', 'alliance', 'ocean'],
      tier3: [
        { name: 'ZIM Integrated Shipping', ticker: 'ZIM' },
        { name: 'Matson Inc', ticker: 'MATX' },
        { name: 'Maersk', ticker: 'AMKBY' },
        { name: 'Hapag-Lloyd', ticker: 'HLAG.DE' },
        { name: 'Evergreen Marine', ticker: null }
      ]
    },
    freight_trucking: {
      label: 'Trucking carriers & freight brokers',
      keywords: ['trucking', 'truck', 'drayage', 'chassis', 'LTL', 'FTL', 'truckload', 'freight', 'broker', 'carrier', 'driver', 'fleet'],
      tier3: [
        { name: 'Knight-Swift Transport', ticker: 'KNX' },
        { name: 'XPO Inc', ticker: 'XPO' },
        { name: 'J.B. Hunt Transport', ticker: 'JBHT' },
        { name: 'Werner Enterprises', ticker: 'WERN' },
        { name: 'Old Dominion Freight', ticker: 'ODFL' }
      ]
    },
    rail_intermodal: {
      label: 'Rail operators & intermodal service providers',
      keywords: ['rail', 'railroad', 'intermodal', 'railcar', 'terminal', 'transload', 'cross-dock', 'CSX', 'UP', 'BNSF', 'NS'],
      tier3: [
        { name: 'Union Pacific', ticker: 'UNP' },
        { name: 'CSX Corporation', ticker: 'CSX' },
        { name: 'Norfolk Southern', ticker: 'NSC' },
        { name: 'Canadian National', ticker: 'CNI' }
      ]
    },
    port_terminal: {
      label: 'Port authorities & terminal operators',
      keywords: ['port', 'terminal', 'berth', 'stevedore', 'longshoreman', 'crane', 'anchorage', 'quay', 'wharf', 'harbor'],
      tier3: [
        { name: 'Port of Los Angeles', ticker: null },
        { name: 'Port of Long Beach', ticker: null },
        { name: 'Georgia Ports Authority', ticker: null },
        { name: 'SSA Marine', ticker: null }
      ]
    },
    logistics_3pl: {
      label: 'Third-party logistics & supply chain management',
      keywords: ['logistics', '3PL', 'supply chain', 'fulfillment', 'distribution', 'warehouse', 'cold chain', 'last mile', 'forwarding'],
      tier3: [
        { name: 'C.H. Robinson', ticker: 'CHRW' },
        { name: 'Expeditors International', ticker: 'EXPD' },
        { name: 'GXO Logistics', ticker: 'GXO' },
        { name: 'Ryder System', ticker: 'R' },
        { name: 'Echo Global Logistics', ticker: null }
      ]
    },
    warehousing: {
      label: 'Warehouse operators & industrial REITs',
      keywords: ['warehouse', 'storage', 'distribution center', 'DC', 'REIT', 'industrial', 'cold storage', 'reefer', 'inventory'],
      tier3: [
        { name: 'Prologis', ticker: 'PLD' },
        { name: 'Rexford Industrial', ticker: 'REXR' },
        { name: 'Americold Realty', ticker: 'COLD' },
        { name: 'STAG Industrial', ticker: 'STAG' }
      ]
    },
    air_freight: {
      label: 'Air cargo carriers & express operators',
      keywords: ['air', 'cargo', 'express', 'aircraft', 'freighter', 'FedEx', 'UPS', 'DHL', 'air freight'],
      tier3: [
        { name: 'FedEx', ticker: 'FDX' },
        { name: 'United Parcel Service', ticker: 'UPS' },
        { name: 'Atlas Air', ticker: null },
        { name: 'Air Transport Services', ticker: 'ATSG' }
      ]
    },
    customs_compliance: {
      label: 'Customs brokers & trade compliance firms',
      keywords: ['customs', 'broker', 'compliance', 'tariff', 'duty', 'clearance', 'origin', 'HTS', 'sanction', 'OFAC', 'CBP', 'regulation'],
      tier3: [
        { name: 'Expeditors International', ticker: 'EXPD' },
        { name: 'Livingston International', ticker: null },
        { name: 'Flexport', ticker: null },
        { name: 'Descartes Systems', ticker: 'DSGX' }
      ]
    },
    trade_policy: {
      label: 'Government trade agencies & regulatory bodies',
      keywords: ['policy', 'government', 'USTR', 'DOC', 'ITC', 'WTO', 'trade agreement', 'treaty', 'sanction', 'embargo', 'quota'],
      tier3: [
        { name: 'USTR (Trade Representative)', ticker: null },
        { name: 'DOC (Dept of Commerce)', ticker: null },
        { name: 'CBP (Customs & Border)', ticker: null },
        { name: 'MARAD (Maritime Admin)', ticker: null }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // NODE → SEGMENT AFFINITY — which segments each trade node maps to
  // ══════════════════════════════════════════════════════════════════════

  var NODE_SEGMENTS = {
    'NTS':   ['container_shipping'],                                     // Container Shipping
    'FEF':   ['air_freight'],                                             // Air Freight
    'CBLM':  ['rail_intermodal'],                                         // Rail Transport
    'M1':    ['freight_trucking'],                                        // Trucking
    'THAL':  ['port_terminal'],                                           // Port Operations
    'OFC':   ['customs_compliance'],                                      // Customs & Tariffs
    'dlPFC': ['logistics_3pl'],                                           // Supply Chain Management
    'HIPP':  ['warehousing'],                                             // Warehousing
    'S1':    ['logistics_3pl', 'freight_trucking'],                       // Last-Mile Delivery
    'HYPO':  ['warehousing', 'logistics_3pl'],                            // Cold Chain
    'vmPFC': ['trade_policy', 'customs_compliance'],                      // Trade Agreements
    'NAcc':  ['container_shipping', 'customs_compliance'],                // Commodity Exchanges
    'CC':    ['logistics_3pl', 'air_freight'],                            // Freight Forwarding
    'ECN':   ['warehousing', 'logistics_3pl'],                            // Inventory Management
    'FPN':   ['logistics_3pl', 'freight_trucking'],                       // Logistics Technology
    'PIN':   ['trade_policy'],                                            // Trade Policy
    'WERN':  ['trade_policy', 'customs_compliance'],                      // Trade Zones
    'LANG':  ['trade_policy'],                                            // WTO
    'TPJ':   ['customs_compliance', 'logistics_3pl'],                     // Cross-Border Commerce
    'CARD':  ['logistics_3pl']                                            // Services Trade
  };

  // Companies that should NEVER appear under certain segments
  var EXCLUSIONS = {
    container_shipping: ['KNX', 'JBHT', 'ODFL', 'PLD'],
    freight_trucking:   ['ZIM', 'MATX', 'AMKBY', 'PLD', 'COLD'],
    rail_intermodal:    ['ZIM', 'MATX', 'FDX', 'UPS'],
    port_terminal:      ['KNX', 'JBHT', 'FDX', 'UPS'],
    air_freight:        ['ZIM', 'MATX', 'KNX', 'PLD'],
    customs_compliance: ['ZIM', 'MATX', 'KNX', 'PLD']
  };

  // ══════════════════════════════════════════════════════════════════════
  // RESOLVE TARGETS
  // ══════════════════════════════════════════════════════════════════════

  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'INVESTABLE';

    var relevantSegments = _resolveSegments(nodeId, nodeLabel, treatLabel, dxId);

    // Tier 2 — entity classes
    var tier2 = [];
    for (var si = 0; si < relevantSegments.length; si++) {
      var seg = SEGMENTS[relevantSegments[si]];
      if (seg) tier2.push({ segment: relevantSegments[si], label: seg.label });
    }

    // Tier 1 — verified entities from portal data
    var tier1 = [];
    var portalCompanies = directive.examples || [];
    var rawCompanies = (directive._directive && directive._directive.companies) || [];
    var companyPool = [];
    if (rawCompanies.length > 0) {
      companyPool = rawCompanies;
    } else {
      for (var ei = 0; ei < portalCompanies.length; ei++) {
        var m = portalCompanies[ei].match(/^(.+?)\s*\(([A-Z.]+)\)$/);
        if (m) companyPool.push({ name: m[1], ticker: m[2] });
        else companyPool.push({ name: portalCompanies[ei], ticker: null });
      }
    }

    var validTickers = {};
    for (var sgi = 0; sgi < relevantSegments.length; sgi++) {
      var segKey = relevantSegments[sgi];
      var segTier3 = (SEGMENTS[segKey] || {}).tier3 || [];
      var exclusions = EXCLUSIONS[segKey] || [];
      for (var t3i = 0; t3i < segTier3.length; t3i++) {
        if (segTier3[t3i].ticker) validTickers[segTier3[t3i].ticker] = true;
      }
      for (var exi = 0; exi < exclusions.length; exi++) {
        validTickers[exclusions[exi]] = false;
      }
    }

    for (var ci = 0; ci < companyPool.length; ci++) {
      var co = companyPool[ci];
      var ticker = co.ticker || '';
      if (ticker && validTickers[ticker] === false) continue;
      if (ticker && validTickers[ticker] === true) {
        tier1.push({ name: co.name, ticker: ticker, source: 'portal_verified' });
      }
    }

    // Tier 3 — example entities from segment taxonomy
    var tier3 = [];
    var tier1Tickers = {};
    for (var t1i = 0; t1i < tier1.length; t1i++) {
      if (tier1[t1i].ticker) tier1Tickers[tier1[t1i].ticker] = true;
    }

    for (var s3i = 0; s3i < relevantSegments.length; s3i++) {
      var seg3 = SEGMENTS[relevantSegments[s3i]];
      if (!seg3) continue;
      var examples = seg3.tier3 || [];
      for (var e3i = 0; e3i < Math.min(examples.length, 3); e3i++) {
        var ex = examples[e3i];
        if (ex.ticker && tier1Tickers[ex.ticker]) continue;
        tier3.push({ name: ex.name, ticker: ex.ticker, segment: relevantSegments[s3i] });
      }
    }
    tier3 = tier3.slice(0, 5);

    // Execution targets based on path
    var executionTargets = [];
    if (path === 'RESEARCHABLE') executionTargets = ['Research desks', 'Institutional research buyers', 'Independent / sell-side analysts'];
    else if (path === 'INVESTABLE') executionTargets = ['Transportation-focused funds', 'Freight trading desks', 'Logistics PE allocators'];

    var formatted = _format(tier1, tier2, tier3, executionTargets);

    return {
      tier1: tier1,
      tier2: tier2,
      tier3: tier3,
      executionTargets: executionTargets,
      formatted: formatted,
      segments: relevantSegments
    };
  }

  function _resolveSegments(nodeId, nodeLabel, treatLabel, dxId) {
    var segments = [];
    var seen = {};

    var nodeMapped = NODE_SEGMENTS[nodeId] || [];
    for (var ni = 0; ni < nodeMapped.length; ni++) {
      if (!seen[nodeMapped[ni]]) { seen[nodeMapped[ni]] = true; segments.push(nodeMapped[ni]); }
    }

    var text = (nodeLabel + ' ' + treatLabel + ' ' + dxId).toLowerCase();
    for (var segKey in SEGMENTS) {
      if (seen[segKey]) continue;
      var kws = SEGMENTS[segKey].keywords;
      for (var ki = 0; ki < kws.length; ki++) {
        if (text.indexOf(kws[ki]) !== -1) {
          seen[segKey] = true;
          segments.push(segKey);
          break;
        }
      }
    }

    if (segments.length === 0) segments.push('logistics_3pl');

    return segments;
  }

  function _format(tier1, tier2, tier3, executionTargets) {
    var parts = [];
    if (tier2.length > 0) {
      var classes = tier2.map(function (t) { return t.label; });
      parts.push(classes.join('. ') + '.');
    }
    if (tier1.length > 0) {
      var verified = tier1.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Verified: ' + verified.join(', ') + '.');
    }
    if (tier3.length > 0) {
      var examples = tier3.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Also consider: ' + examples.join(', ') + '.');
    }
    if (executionTargets.length > 0) {
      parts.push('Execute via: ' + executionTargets.join(', ') + '.');
    }
    return parts.join(' ');
  }

  function _empty() {
    return { tier1: [], tier2: [], tier3: [], executionTargets: [], formatted: '', segments: [] };
  }

  window.LIMENTradeTargetingEngine = { resolveTargets: resolveTargets };
})();
