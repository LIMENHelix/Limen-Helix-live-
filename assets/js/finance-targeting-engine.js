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
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENT TAXONOMY — maps node/directive context to segments
  // ══════════════════════════════════════════════════════════════════════

  var SEGMENTS = {
    commercial_banking: {
      label: 'Commercial & retail banking institutions',
      keywords: ['banking', 'deposit', 'lending', 'loan', 'credit facility', 'commercial bank', 'retail bank', 'checking', 'savings', 'branch', 'consumer credit'],
      tier3: [
        { name: 'JPMorgan Chase', ticker: 'JPM' },
        { name: 'Bank of America', ticker: 'BAC' },
        { name: 'Wells Fargo', ticker: 'WFC' },
        { name: 'Citigroup', ticker: 'C' },
        { name: 'U.S. Bancorp', ticker: 'USB' }
      ]
    },
    investment_banking: {
      label: 'Investment banks & capital markets firms',
      keywords: ['investment bank', 'capital markets', 'M&A', 'merger', 'acquisition', 'underwriting', 'IPO', 'advisory', 'deal', 'syndication', 'structured finance'],
      tier3: [
        { name: 'Goldman Sachs', ticker: 'GS' },
        { name: 'Morgan Stanley', ticker: 'MS' },
        { name: 'Charles Schwab', ticker: 'SCHW' },
        { name: 'Raymond James', ticker: 'RJF' }
      ]
    },
    insurance: {
      label: 'Insurance carriers & reinsurers',
      keywords: ['insurance', 'underwrite', 'premium', 'claims', 'actuarial', 'reinsurance', 'casualty', 'property', 'life insurance', 'annuity', 'loss ratio'],
      tier3: [
        { name: 'Berkshire Hathaway', ticker: 'BRK.B' },
        { name: 'Progressive', ticker: 'PGR' },
        { name: 'Allstate', ticker: 'ALL' },
        { name: 'MetLife', ticker: 'MET' },
        { name: 'AIG', ticker: 'AIG' }
      ]
    },
    asset_management: {
      label: 'Asset managers & wealth management firms',
      keywords: ['asset management', 'wealth', 'portfolio', 'fund', 'AUM', 'allocation', 'fiduciary', 'ETF', 'mutual fund', 'index', 'passive', 'active management'],
      tier3: [
        { name: 'BlackRock', ticker: 'BLK' },
        { name: 'Charles Schwab', ticker: 'SCHW' },
        { name: 'T. Rowe Price', ticker: 'TROW' },
        { name: 'Invesco', ticker: 'IVZ' },
        { name: 'Franklin Templeton', ticker: 'BEN' }
      ]
    },
    fintech: {
      label: 'Financial technology & digital finance platforms',
      keywords: ['fintech', 'digital', 'neobank', 'blockchain', 'crypto', 'DeFi', 'robo-advisor', 'embedded finance', 'open banking', 'API banking', 'digital wallet', 'BNPL'],
      tier3: [
        { name: 'Block (Square)', ticker: 'SQ' },
        { name: 'PayPal', ticker: 'PYPL' },
        { name: 'Affirm', ticker: 'AFRM' },
        { name: 'SoFi Technologies', ticker: 'SOFI' },
        { name: 'Upstart', ticker: 'UPST' }
      ]
    },
    private_equity: {
      label: 'Private equity & alternative investment firms',
      keywords: ['private equity', 'buyout', 'leveraged', 'LBO', 'portfolio company', 'carried interest', 'fund of funds', 'secondary', 'co-invest', 'GP', 'LP'],
      tier3: [
        { name: 'KKR', ticker: 'KKR' },
        { name: 'Apollo Global', ticker: 'APO' },
        { name: 'Blackstone', ticker: 'BX' },
        { name: 'Carlyle Group', ticker: 'CG' },
        { name: 'Ares Management', ticker: 'ARES' }
      ]
    },
    venture_capital: {
      label: 'Venture capital & growth equity firms',
      keywords: ['venture capital', 'seed', 'series A', 'series B', 'startup', 'growth equity', 'early stage', 'pre-IPO', 'angel', 'incubator', 'accelerator'],
      tier3: [
        { name: 'Andreessen Horowitz (a16z)', ticker: null },
        { name: 'Sequoia Capital', ticker: null },
        { name: 'Accel Partners', ticker: null },
        { name: 'Benchmark Capital', ticker: null },
        { name: 'Lightspeed Venture Partners', ticker: null }
      ]
    },
    exchanges_clearing: {
      label: 'Exchanges, clearinghouses & market infrastructure',
      keywords: ['exchange', 'clearing', 'settlement', 'market structure', 'order book', 'matching engine', 'CCP', 'central counterparty', 'listing', 'dark pool', 'ATS'],
      tier3: [
        { name: 'Intercontinental Exchange', ticker: 'ICE' },
        { name: 'CME Group', ticker: 'CME' },
        { name: 'Nasdaq', ticker: 'NDAQ' },
        { name: 'Cboe Global Markets', ticker: 'CBOE' }
      ]
    },
    rating_agencies: {
      label: 'Credit rating agencies & financial data providers',
      keywords: ['rating', 'credit rating', 'sovereign', 'bond rating', 'credit score', 'FICO', 'analytics', 'benchmark', 'financial data', 'credit assessment'],
      tier3: [
        { name: 'S&P Global', ticker: 'SPGI' },
        { name: "Moody's", ticker: 'MCO' }
      ]
    },
    payments: {
      label: 'Payment networks & processing firms',
      keywords: ['payment', 'transaction', 'card', 'interchange', 'merchant', 'acquiring', 'issuing', 'POS', 'contactless', 'wire', 'ACH', 'real-time payment', 'remittance'],
      tier3: [
        { name: 'Visa', ticker: 'V' },
        { name: 'Mastercard', ticker: 'MA' },
        { name: 'American Express', ticker: 'AXP' },
        { name: 'Discover Financial', ticker: 'DFS' }
      ]
    },
    mortgage: {
      label: 'Mortgage lenders & real estate finance',
      keywords: ['mortgage', 'home loan', 'origination', 'servicing', 'MBS', 'agency', 'conforming', 'non-conforming', 'REIT', 'housing', 'refinance', 'securitization'],
      tier3: [
        { name: 'Rocket Companies', ticker: 'RKT' },
        { name: 'UWM Holdings', ticker: 'UWMC' },
        { name: 'Annaly Capital', ticker: 'NLY' },
        { name: 'AGNC Investment', ticker: 'AGNC' }
      ]
    },
    regulatory: {
      label: 'Financial regulators & oversight bodies',
      keywords: ['regulatory', 'compliance', 'supervision', 'examination', 'enforcement', 'capital requirement', 'Basel', 'Dodd-Frank', 'stress test', 'AML', 'KYC', 'BSA', 'sanction'],
      tier3: [
        { name: 'SEC', ticker: null },
        { name: 'FDIC', ticker: null },
        { name: 'OCC', ticker: null },
        { name: 'FINRA', ticker: null },
        { name: 'CFPB', ticker: null }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // NODE → SEGMENT AFFINITY — which segments each finance node maps to
  // ══════════════════════════════════════════════════════════════════════

  var NODE_SEGMENTS = {
    'STRI':  ['commercial_banking', 'mortgage'],                          // Core Banking & Lending
    'FORN':  ['payments', 'exchanges_clearing'],                          // Payment Networks & Rails
    'OFC':   ['exchanges_clearing', 'investment_banking'],                // Capital Markets Trading
    'S1':    ['commercial_banking', 'regulatory'],                        // Deposit & Liquidity
    'vmPFC': ['regulatory', 'rating_agencies'],                           // Financial Regulation
    'CBLM':  ['asset_management', 'private_equity'],                      // Portfolio Construction
    'M1':    ['investment_banking', 'private_equity'],                     // Deal Origination
    'THAL':  ['commercial_banking', 'fintech'],                           // Credit Distribution
    'VTA':   ['fintech', 'payments'],                                     // Digital Finance
    'PAG':   ['insurance', 'mortgage'],                                   // Risk Underwriting
    'NTS':   ['asset_management', 'venture_capital'],                     // Fund Operations
    'HIPP':  ['fintech', 'exchanges_clearing'],                           // Market Data & Analytics
    'CC':    ['payments', 'commercial_banking'],                          // Transaction Processing
    'dlPFC': ['regulatory', 'rating_agencies'],                           // Compliance & Oversight
    'dACC':  ['insurance', 'rating_agencies'],                            // Risk Assessment
    'ENS':   ['regulatory', 'commercial_banking'],                        // Capital Adequacy
    'CAUD':  ['venture_capital', 'fintech'],                              // Innovation & Disruption
    'FEF':   ['private_equity', 'venture_capital'],                       // Alternative Investments
    'BNST':  ['mortgage', 'insurance'],                                   // Securitization & Hedging
    'EMP':   ['asset_management', 'exchanges_clearing']                   // Market Infrastructure
  };

  // Companies that should NEVER appear under certain segments
  var EXCLUSIONS = {
    commercial_banking: ['SQ', 'PYPL', 'AFRM', 'SOFI', 'UPST', 'KKR', 'APO', 'BX'],
    investment_banking: ['RKT', 'UWMC', 'PYPL', 'SQ', 'AFRM'],
    insurance:          ['SQ', 'PYPL', 'GS', 'MS', 'KKR', 'ICE', 'CME'],
    asset_management:   ['RKT', 'UWMC', 'AFRM', 'UPST', 'SQ'],
    fintech:            ['JPM', 'BAC', 'WFC', 'BRK.B', 'NLY', 'AGNC', 'MCO', 'SPGI'],
    private_equity:     ['V', 'MA', 'RKT', 'UWMC', 'PYPL', 'SQ', 'PGR', 'ALL'],
    venture_capital:    ['JPM', 'BAC', 'WFC', 'V', 'MA', 'BRK.B', 'NLY', 'AGNC'],
    exchanges_clearing: ['RKT', 'UWMC', 'BRK.B', 'PGR', 'ALL', 'MET'],
    rating_agencies:    ['SQ', 'PYPL', 'RKT', 'UWMC', 'KKR', 'APO'],
    payments:           ['GS', 'MS', 'KKR', 'APO', 'BX', 'NLY', 'AGNC', 'RKT'],
    mortgage:           ['GS', 'MS', 'SQ', 'PYPL', 'ICE', 'CME', 'NDAQ'],
    regulatory:         ['SQ', 'PYPL', 'KKR', 'APO', 'BX', 'V', 'MA']
  };

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

  window.LIMENFinanceTargetingEngine = { resolveTargets: resolveTargets };
})();
