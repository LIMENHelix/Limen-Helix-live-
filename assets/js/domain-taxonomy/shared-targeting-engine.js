/* AUTO-GENERATED shared taxonomy engine (C6 finance pilot, gen.cjs).
 * Functions are byte-identical to the original finance-targeting-engine.js; data comes from the
 * factory __DATA param. Registers window.LIMENTaxonomy.makeTargetingEngine. */
/**
 * finance-targeting-engine.js — Context-aware targeting for promoted finance directives
 *
 * Resolves WHO TO TARGET using a tiered model:
 *   Tier 1: Verified entities (domain-aligned companies from portal data)
 *   Tier 2: Entity classes (always present — industry segments)
 *   Tier 3: Example entities (high-confidence, well-known sector players)
 *
 * Filters out mismatched companies (e.g. insurance under fintech).
 * Never hallucinates — Tier 3 uses only well-established industry names.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENFinanceTargetingEngine
 */
(function () { window.LIMENTaxonomy = window.LIMENTaxonomy || {}; window.LIMENTaxonomy.makeTargetingEngine = function (__DATA) {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENT TAXONOMY — maps node/directive context to segments
  // ══════════════════════════════════════════════════════════════════════

var SEGMENTS = __DATA["SEGMENTS"];

  // ══════════════════════════════════════════════════════════════════════
  // NODE → SEGMENT AFFINITY — which segments each finance node maps to
  // ══════════════════════════════════════════════════════════════════════

var NODE_SEGMENTS = __DATA["NODE_SEGMENTS"];

  // Companies that should NEVER appear under certain segments
var EXCLUSIONS = __DATA["EXCLUSIONS"];

  // ══════════════════════════════════════════════════════════════════════
  // RESOLVE TARGETS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Resolve targeting for a promoted directive.
   *
   * @param {Object} directive - a promoted opportunity object (post-shaping)
   * @returns {Object} { tier1: [], tier2: [], tier3: [], formatted: string }
   */
  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'GRANT-ELIGIBLE';

    // 1. Determine relevant segments from node mapping + keyword matching
    var relevantSegments = _resolveSegments(nodeId, nodeLabel, treatLabel, dxId);

    // 2. Build Tier 2 — entity classes (always required)
    var tier2 = [];
    for (var si = 0; si < relevantSegments.length; si++) {
      var seg = SEGMENTS[relevantSegments[si]];
      if (seg) tier2.push({ segment: relevantSegments[si], label: seg.label });
    }

    // 3. Build Tier 1 — verified entities from portal data, filtered for alignment
    var tier1 = [];
    var portalCompanies = directive.examples || [];
    var rawCompanies = (directive._directive && directive._directive.companies) || [];
    // Use raw company data if available from directive metadata
    var companyPool = [];
    if (rawCompanies.length > 0) {
      companyPool = rawCompanies;
    } else {
      // Parse from examples format: "Company (TICKER)"
      for (var ei = 0; ei < portalCompanies.length; ei++) {
        var m = portalCompanies[ei].match(/^(.+?)\s*\(([A-Z.]+)\)$/);
        if (m) companyPool.push({ name: m[1], ticker: m[2] });
        else companyPool.push({ name: portalCompanies[ei], ticker: null });
      }
    }

    // Filter: only keep companies aligned with relevant segments
    var validTickers = {};
    for (var sgi = 0; sgi < relevantSegments.length; sgi++) {
      var segKey = relevantSegments[sgi];
      var segTier3 = (SEGMENTS[segKey] || {}).tier3 || [];
      var exclusions = EXCLUSIONS[segKey] || [];
      for (var t3i = 0; t3i < segTier3.length; t3i++) {
        if (segTier3[t3i].ticker) validTickers[segTier3[t3i].ticker] = true;
      }
      // Mark excluded tickers
      for (var exi = 0; exi < exclusions.length; exi++) {
        validTickers[exclusions[exi]] = false;
      }
    }

    for (var ci = 0; ci < companyPool.length; ci++) {
      var co = companyPool[ci];
      var ticker = co.ticker || '';
      // Accept if in valid set or not explicitly excluded
      if (ticker && validTickers[ticker] === false) continue; // explicitly excluded
      if (ticker && validTickers[ticker] === true) {
        tier1.push({ name: co.name, ticker: ticker, source: 'portal_verified' });
      }
    }

    // 4. Build Tier 3 — example entities from segment taxonomy
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
        if (ex.ticker && tier1Tickers[ex.ticker]) continue; // already in tier 1
        tier3.push({ name: ex.name, ticker: ex.ticker, segment: relevantSegments[s3i] });
      }
    }
    // Cap tier 3 at 5
    tier3 = tier3.slice(0, 5);

    // 5. Add execution targets based on path
    var executionTargets = [];
    if (path === 'GRANT-ELIGIBLE') executionTargets = ['CFPB program offices', 'Treasury CDFI fund', 'State banking commissions'];
    else if (path === 'PATENTABLE') executionTargets = ['Patent attorneys', 'Fintech licensing platforms', 'Strategic acquirers'];
    else if (path === 'INVESTABLE') executionTargets = ['Financial sector funds', 'Bank trading desks', 'Institutional allocators'];

    // 6. Format for display
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

  /**
   * Determine relevant industry segments from node + directive context.
   */
  function _resolveSegments(nodeId, nodeLabel, treatLabel, dxId) {
    var segments = [];
    var seen = {};

    // From node mapping (primary)
    var nodeMapped = NODE_SEGMENTS[nodeId] || [];
    for (var ni = 0; ni < nodeMapped.length; ni++) {
      if (!seen[nodeMapped[ni]]) { seen[nodeMapped[ni]] = true; segments.push(nodeMapped[ni]); }
    }

    // From keyword matching against directive/node labels
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

    // Ensure at least one segment
    if (segments.length === 0) segments.push('commercial_banking');

    return segments;
  }

  /**
   * Format targets for display in the WHO TO TARGET block.
   */
  function _format(tier1, tier2, tier3, executionTargets) {
    var parts = [];

    // Tier 2 — entity classes (always first)
    if (tier2.length > 0) {
      var classes = tier2.map(function (t) { return t.label; });
      parts.push(classes.join('. ') + '.');
    }

    // Tier 1 — verified entities
    if (tier1.length > 0) {
      var verified = tier1.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Verified: ' + verified.join(', ') + '.');
    }

    // Tier 3 — examples
    if (tier3.length > 0) {
      var examples = tier3.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Also consider: ' + examples.join(', ') + '.');
    }

    // Execution targets
    if (executionTargets.length > 0) {
      parts.push('Execute via: ' + executionTargets.join(', ') + '.');
    }

    return parts.join(' ');
  }

  function _empty() {
    return { tier1: [], tier2: [], tier3: [], executionTargets: [], formatted: '', segments: [] };
  }

  return { resolveTargets: resolveTargets };
}; })();
