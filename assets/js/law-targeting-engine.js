/**
 * law-targeting-engine.js — Context-aware targeting for promoted Law directives
 *
 * Resolves WHO TO TARGET using a tiered model:
 *   Tier 1: Verified entities (domain-aligned firms from portal data)
 *   Tier 2: Entity classes (always present — industry segments)
 *   Tier 3: Example entities (high-confidence well-known sector players)
 *
 * Filters out mismatched firms. Never hallucinates — Tier 3 uses only
 * well-established names in legaltech / regtech / compliance.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENLawTargetingEngine
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENT TAXONOMY — maps node/directive context to segments
  // ══════════════════════════════════════════════════════════════════════

  var SEGMENTS = {
    biglaw: {
      label: 'AmLaw 100 / global law firms',
      keywords: ['biglaw', 'AmLaw', 'global law firm', 'partnership', 'litigation department', 'transactional', 'Cravath', 'Skadden', 'Latham'],
      tier3: [
        { name: 'Kirkland & Ellis', ticker: null },
        { name: 'Latham & Watkins', ticker: null },
        { name: 'Skadden Arps', ticker: null },
        { name: 'DLA Piper', ticker: null },
        { name: 'Baker McKenzie', ticker: null }
      ]
    },
    regtech_compliance: {
      label: 'Regtech and compliance technology platforms',
      keywords: ['regtech', 'compliance', 'KYC', 'AML', 'sanctions screening', 'monitoring', 'reporting automation', 'regulatory technology'],
      tier3: [
        { name: 'NICE Actimize', ticker: 'NICE' },
        { name: 'Verafin (Nasdaq)', ticker: 'NDAQ' },
        { name: 'ComplyAdvantage', ticker: null },
        { name: 'Refinitiv World-Check', ticker: null },
        { name: 'Thomson Reuters', ticker: 'TRI' }
      ]
    },
    ediscovery: {
      label: 'E-discovery and document review platforms',
      keywords: ['e-discovery', 'ediscovery', 'document review', 'litigation support', 'predictive coding', 'TAR', 'review platform'],
      tier3: [
        { name: 'Relativity', ticker: null },
        { name: 'DISCO (Cs Disco)', ticker: 'LAW' },
        { name: 'Everlaw', ticker: null },
        { name: 'Logikcull', ticker: null },
        { name: 'Reveal', ticker: null }
      ]
    },
    legal_research: {
      label: 'Legal research and analytics providers',
      keywords: ['legal research', 'case law', 'westlaw', 'lexisnexis', 'analytics', 'precedent', 'citator', 'legal database'],
      tier3: [
        { name: 'Thomson Reuters (Westlaw)', ticker: 'TRI' },
        { name: 'RELX (LexisNexis)', ticker: 'RELX' },
        { name: 'Bloomberg Law', ticker: null },
        { name: 'Fastcase', ticker: null },
        { name: 'Casetext', ticker: null }
      ]
    },
    courts_judiciary: {
      label: 'Court systems and judicial administration',
      keywords: ['court', 'judiciary', 'docket', 'judge', 'clerk', 'court administration', 'case management system', 'AOUSC', 'NCSC', 'state court'],
      tier3: [
        { name: 'Tyler Technologies', ticker: 'TYL' },
        { name: 'Thomson Reuters Court Mgmt', ticker: 'TRI' },
        { name: 'Journal Technologies', ticker: null },
        { name: 'CourtListener / Free Law Project', ticker: null },
        { name: 'PACER (US Courts)', ticker: null }
      ]
    },
    enforcement_agencies: {
      label: 'Federal and state enforcement agencies',
      keywords: ['DOJ', 'SEC', 'CFPB', 'FTC', 'OSHA', 'EPA', 'enforcement', 'investigation', 'prosecution', 'attorney general'],
      tier3: [
        { name: 'DOJ (Department of Justice)', ticker: null },
        { name: 'SEC (Securities & Exchange Commission)', ticker: null },
        { name: 'CFPB (Consumer Financial Protection Bureau)', ticker: null },
        { name: 'FTC (Federal Trade Commission)', ticker: null },
        { name: 'State Attorneys General', ticker: null }
      ]
    },
    immigration_practice: {
      label: 'Immigration law firms and visa services',
      keywords: ['immigration', 'visa', 'H1B', 'asylum', 'deportation', 'naturalization', 'USCIS', 'green card', 'EB-5'],
      tier3: [
        { name: 'Fragomen', ticker: null },
        { name: 'Berry Appleman & Leiden', ticker: null },
        { name: 'Boundless Immigration', ticker: null },
        { name: 'USCIS (Immigration Services)', ticker: null }
      ]
    },
    criminal_defense: {
      label: 'Criminal defense and public defender systems',
      keywords: ['criminal defense', 'public defender', 'sentencing', 'prosecution', 'appellate', 'post-conviction', 'reentry', 'pardon'],
      tier3: [
        { name: 'NACDL (Criminal Defense)', ticker: null },
        { name: 'NLADA (Legal Aid)', ticker: null },
        { name: 'Vera Institute', ticker: null },
        { name: 'Innocence Project', ticker: null }
      ]
    },
    corporate_legal_ops: {
      label: 'Corporate legal operations and in-house counsel',
      keywords: ['legal ops', 'in-house counsel', 'general counsel', 'matter management', 'spend management', 'contract lifecycle', 'CLM'],
      tier3: [
        { name: 'Ironclad', ticker: null },
        { name: 'DocuSign CLM', ticker: 'DOCU' },
        { name: 'Icertis', ticker: null },
        { name: 'SimpleLegal', ticker: null },
        { name: 'CLOC (Corporate Legal Ops Consortium)', ticker: null }
      ]
    },
    international_trade_law: {
      label: 'International trade and sanctions counsel',
      keywords: ['international trade', 'sanctions', 'OFAC', 'BIS', 'export control', 'FCPA', 'CBP', 'WTO', 'treaty', 'cross-border'],
      tier3: [
        { name: 'Akin Gump', ticker: null },
        { name: 'Hogan Lovells', ticker: null },
        { name: 'WilmerHale', ticker: null },
        { name: 'Crowell & Moring', ticker: null }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // NODE → SEGMENT AFFINITY — which segments each law node maps to
  // (uses brain node IDs that appear in law.json activations)
  // ══════════════════════════════════════════════════════════════════════

  var NODE_SEGMENTS = {
    'BLA':       ['criminal_defense', 'enforcement_agencies'],     // Criminal Law (basolateral amygdala)
    'dlPFC':     ['biglaw', 'corporate_legal_ops'],                // Constitutional / planning
    'vlPFC':     ['regtech_compliance', 'corporate_legal_ops'],    // Compliance ops
    'OFC':       ['regtech_compliance', 'enforcement_agencies'],   // Regulatory valuation
    'vmPFC':     ['international_trade_law', 'biglaw'],            // Treaty / agreement
    'HIPP':      ['legal_research', 'ediscovery'],                 // Memory / precedent
    'THAL':      ['courts_judiciary'],                             // Routing / clerk
    'M1':        ['enforcement_agencies'],                         // Execution / police
    'AI':        ['regtech_compliance'],                           // Diagnostic classification
    'dACC':      ['courts_judiciary', 'corporate_legal_ops'],      // Conflict resolution
    'TPJ':       ['international_trade_law', 'immigration_practice'], // Cross-border
    'STN':       ['regtech_compliance', 'enforcement_agencies'],   // Compliance governance
    'LC':        ['regtech_compliance', 'biglaw'],                 // Regulation strategy
    'PRECUNEUS': ['regtech_compliance'],                           // Compliance analysis
    'CC':        ['corporate_legal_ops', 'biglaw']                 // Cross-functional
  };

  var EXCLUSIONS = {
    biglaw:                  ['CFPB', 'SEC', 'DOJ', 'FTC'],
    regtech_compliance:      [],
    ediscovery:              [],
    courts_judiciary:        [],
    criminal_defense:        ['SEC', 'CFPB']
  };

  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'GRANT-ELIGIBLE';

    var relevantSegments = _resolveSegments(nodeId, nodeLabel, treatLabel, dxId);

    var tier2 = [];
    for (var si = 0; si < relevantSegments.length; si++) {
      var seg = SEGMENTS[relevantSegments[si]];
      if (seg) tier2.push({ segment: relevantSegments[si], label: seg.label });
    }

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

    var executionTargets = [];
    if (path === 'GRANT-ELIGIBLE') executionTargets = ['DOJ program officers', 'NIJ research grants', 'BJA criminal-justice grants', 'SJI court-improvement grants', 'State court systems'];
    else if (path === 'PATENTABLE') executionTargets = ['Patent attorneys', 'Legaltech and regtech licensors', 'Strategic acquirers in legaltech'];
    else if (path === 'INVESTABLE') executionTargets = ['Legaltech-focused funds', 'Regtech investors', 'Compliance-software allocators'];

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
        if (text.indexOf(kws[ki].toLowerCase()) !== -1) {
          seen[segKey] = true;
          segments.push(segKey);
          break;
        }
      }
    }

    if (segments.length === 0) segments.push('regtech_compliance');

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

  window.LIMENLawTargetingEngine = { resolveTargets: resolveTargets };
})();
