/**
 * economy-targeting-engine.js — Context-aware targeting for promoted economy directives
 *
 * Resolves WHO TO TARGET using a tiered model:
 *   Tier 1: Verified entities (domain-aligned companies from portal data)
 *   Tier 2: Entity classes (always present — industry segments)
 *   Tier 3: Example entities (high-confidence, well-known sector players)
 *
 * Filters out mismatched companies (e.g. tech under real_estate).
 * Never hallucinates — Tier 3 uses only well-established industry names.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENEconomyTargetingEngine
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENT TAXONOMY — maps node/directive context to segments
  // ══════════════════════════════════════════════════════════════════════

  var SEGMENTS = {
    macro_advisory: {
      label: 'Macroeconomic advisory & policy research firms',
      keywords: ['macro', 'gdp', 'economic growth', 'output gap', 'recession', 'expansion', 'business cycle', 'aggregate demand', 'national accounts'],
      tier3: [
        { name: 'McKinsey Global Institute', ticker: null },
        { name: 'Brookings Institution', ticker: null },
        { name: 'Peterson Institute', ticker: null },
        { name: 'Oxford Economics', ticker: null },
        { name: 'IHS Markit (S&P Global)', ticker: 'SPGI' }
      ]
    },
    central_banking: {
      label: 'Central banks & monetary policy institutions',
      keywords: ['central bank', 'monetary policy', 'interest rate', 'quantitative easing', 'tightening', 'fed', 'reserve', 'inflation target', 'money supply'],
      tier3: [
        { name: 'Federal Reserve System', ticker: null },
        { name: 'European Central Bank', ticker: null },
        { name: 'Bank of England', ticker: null },
        { name: 'Bank of Japan', ticker: null },
        { name: 'IMF', ticker: null }
      ]
    },
    labor_analytics: {
      label: 'Labor market analytics & workforce development firms',
      keywords: ['labor', 'employment', 'unemployment', 'workforce', 'job market', 'wage', 'human capital', 'skill gap', 'automation', 'gig economy'],
      tier3: [
        { name: 'ADP', ticker: 'ADP' },
        { name: 'Robert Half', ticker: 'RHI' },
        { name: 'ManpowerGroup', ticker: 'MAN' },
        { name: 'LinkedIn (Microsoft)', ticker: 'MSFT' },
        { name: 'Bureau of Labor Statistics', ticker: null }
      ]
    },
    consumer_goods: {
      label: 'Consumer goods & retail sector firms',
      keywords: ['consumer', 'retail', 'spending', 'household', 'disposable income', 'demand', 'purchasing power', 'cost of living', 'consumer confidence'],
      tier3: [
        { name: 'Walmart', ticker: 'WMT' },
        { name: 'Amazon', ticker: 'AMZN' },
        { name: 'Procter & Gamble', ticker: 'PG' },
        { name: 'Costco', ticker: 'COST' },
        { name: 'Target', ticker: 'TGT' }
      ]
    },
    real_estate: {
      label: 'Real estate & housing market firms',
      keywords: ['housing', 'real estate', 'property', 'mortgage', 'rent', 'construction', 'home price', 'residential', 'commercial real estate'],
      tier3: [
        { name: 'Zillow Group', ticker: 'ZG' },
        { name: 'Redfin', ticker: 'RDFN' },
        { name: 'CBRE Group', ticker: 'CBRE' },
        { name: 'Prologis', ticker: 'PLD' },
        { name: 'National Association of Realtors', ticker: null }
      ]
    },
    trade_policy: {
      label: 'Trade policy & international commerce institutions',
      keywords: ['trade', 'tariff', 'import', 'export', 'balance of payments', 'customs', 'protectionism', 'free trade', 'supply chain', 'logistics'],
      tier3: [
        { name: 'World Trade Organization', ticker: null },
        { name: 'US Trade Representative', ticker: null },
        { name: 'FedEx', ticker: 'FDX' },
        { name: 'UPS', ticker: 'UPS' },
        { name: 'Maersk', ticker: null }
      ]
    },
    fiscal_advisory: {
      label: 'Fiscal policy & government finance advisory',
      keywords: ['fiscal', 'budget', 'deficit', 'government spending', 'tax', 'austerity', 'stimulus', 'public debt', 'treasury', 'appropriation'],
      tier3: [
        { name: 'Congressional Budget Office', ticker: null },
        { name: 'Government Accountability Office', ticker: null },
        { name: 'Deloitte Government', ticker: null },
        { name: 'KPMG Government', ticker: null },
        { name: 'World Bank', ticker: null }
      ]
    },
    monetary_instruments: {
      label: 'Monetary instruments & fixed income market firms',
      keywords: ['bond', 'yield', 'treasury', 'sovereign debt', 'credit rating', 'fixed income', 'debt instrument', 'money market', 'duration'],
      tier3: [
        { name: 'PIMCO', ticker: null },
        { name: 'BlackRock', ticker: 'BLK' },
        { name: 'Vanguard', ticker: null },
        { name: "Moody's", ticker: 'MCO' },
        { name: 'S&P Global', ticker: 'SPGI' }
      ]
    },
    industrial_production: {
      label: 'Industrial production & manufacturing firms',
      keywords: ['industrial', 'manufacturing', 'production', 'capacity', 'factory', 'output', 'PMI', 'supply chain', 'automation'],
      tier3: [
        { name: 'Caterpillar', ticker: 'CAT' },
        { name: 'General Electric', ticker: 'GE' },
        { name: '3M Company', ticker: 'MMM' },
        { name: 'Honeywell', ticker: 'HON' },
        { name: 'Siemens', ticker: null }
      ]
    },
    technology_sector: {
      label: 'Technology sector & digital economy firms',
      keywords: ['technology', 'digital', 'innovation', 'automation', 'ai', 'software', 'platform', 'data', 'cloud', 'semiconductor'],
      tier3: [
        { name: 'Microsoft', ticker: 'MSFT' },
        { name: 'Alphabet (Google)', ticker: 'GOOGL' },
        { name: 'NVIDIA', ticker: 'NVDA' },
        { name: 'Salesforce', ticker: 'CRM' },
        { name: 'Oracle', ticker: 'ORCL' }
      ]
    },
    energy_economics: {
      label: 'Energy economics & utility sector firms',
      keywords: ['energy', 'oil', 'gas', 'utility', 'electricity', 'power', 'renewable', 'fossil fuel', 'energy price', 'opec'],
      tier3: [
        { name: 'ExxonMobil', ticker: 'XOM' },
        { name: 'Chevron', ticker: 'CVX' },
        { name: 'NextEra Energy', ticker: 'NEE' },
        { name: 'Duke Energy', ticker: 'DUK' },
        { name: 'International Energy Agency', ticker: null }
      ]
    },
    debt_markets: {
      label: 'Debt markets & sovereign credit institutions',
      keywords: ['debt', 'sovereign', 'credit', 'downgrade', 'refinancing', 'maturity', 'spread', 'default', 'restructuring', 'bailout'],
      tier3: [
        { name: 'IMF', ticker: null },
        { name: 'World Bank', ticker: null },
        { name: 'Fitch Ratings', ticker: null },
        { name: "Moody's", ticker: 'MCO' },
        { name: 'S&P Global Ratings', ticker: 'SPGI' }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // NODE → SEGMENT AFFINITY — which segments each economy node maps to
  // ══════════════════════════════════════════════════════════════════════

  var NODE_SEGMENTS = {
    'STRI':  ['industrial_production', 'consumer_goods'],             // Core Production & Distribution
    'FORN':  ['trade_policy', 'industrial_production'],               // Trade Networks & Logistics
    'OFC':   ['monetary_instruments', 'debt_markets'],                // Capital & Debt Markets
    'S1':    ['consumer_goods', 'labor_analytics'],                   // Consumer Demand & Employment
    'vmPFC': ['fiscal_advisory', 'macro_advisory'],                   // Fiscal & Macro Policy
    'CBLM':  ['macro_advisory', 'central_banking'],                   // Economic Modeling & Forecasting
    'M1':    ['industrial_production', 'technology_sector'],          // Innovation & Industrial Growth
    'THAL':  ['consumer_goods', 'real_estate'],                       // Domestic Market Distribution
    'VTA':   ['technology_sector', 'labor_analytics'],                // Digital Economy & Labor Tech
    'PAG':   ['real_estate', 'energy_economics'],                     // Real Assets & Energy
    'NTS':   ['macro_advisory', 'fiscal_advisory'],                   // Policy Research & Analysis
    'HIPP':  ['technology_sector', 'monetary_instruments'],           // Economic Data & Analytics
    'CC':    ['consumer_goods', 'trade_policy'],                      // Commerce & Trade Flows
    'dlPFC': ['fiscal_advisory', 'central_banking'],                  // Regulatory & Monetary Oversight
    'dACC':  ['debt_markets', 'macro_advisory'],                      // Risk Assessment & Rating
    'ENS':   ['central_banking', 'fiscal_advisory'],                  // Monetary & Fiscal Coordination
    'CAUD':  ['technology_sector', 'labor_analytics'],                // Innovation & Workforce Disruption
    'FEF':   ['energy_economics', 'industrial_production'],           // Energy & Industrial Investment
    'BNST':  ['real_estate', 'debt_markets'],                         // Real Estate Finance & Debt
    'EMP':   ['macro_advisory', 'trade_policy']                       // Global Economic Infrastructure
  };

  // Companies that should NEVER appear under certain segments
  var EXCLUSIONS = {
    macro_advisory:        ['WMT', 'AMZN', 'PG', 'CAT', 'XOM', 'ZG'],
    central_banking:       ['WMT', 'AMZN', 'CAT', 'GE', 'ZG', 'RDFN'],
    labor_analytics:       ['XOM', 'CVX', 'PLD', 'CBRE', 'CAT', 'NEE'],
    consumer_goods:        ['CAT', 'GE', 'XOM', 'CVX', 'CBRE', 'PLD'],
    real_estate:           ['WMT', 'AMZN', 'MSFT', 'GOOGL', 'NVDA', 'ADP'],
    trade_policy:          ['ZG', 'RDFN', 'CBRE', 'PLD', 'NEE', 'DUK'],
    fiscal_advisory:       ['WMT', 'AMZN', 'NVDA', 'ZG', 'RDFN', 'XOM'],
    monetary_instruments:  ['WMT', 'CAT', 'GE', 'ZG', 'FDX', 'UPS'],
    industrial_production: ['ZG', 'RDFN', 'CBRE', 'ADP', 'RHI', 'MAN'],
    technology_sector:     ['CAT', 'XOM', 'CVX', 'PLD', 'CBRE', 'WMT'],
    energy_economics:      ['WMT', 'AMZN', 'ADP', 'RHI', 'ZG', 'RDFN'],
    debt_markets:          ['WMT', 'AMZN', 'CAT', 'GE', 'ZG', 'NVDA']
  };

  // ══════════════════════════════════════════════════════════════════════
  // RESOLVE TARGETS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Resolve targeting for a promoted directive.
   */
  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'GRANT-ELIGIBLE';

    // 1. Determine relevant segments
    var relevantSegments = _resolveSegments(nodeId, nodeLabel, treatLabel, dxId);

    // 2. Build Tier 2 — entity classes
    var tier2 = [];
    for (var si = 0; si < relevantSegments.length; si++) {
      var seg = SEGMENTS[relevantSegments[si]];
      if (seg) tier2.push({ segment: relevantSegments[si], label: seg.label });
    }

    // 3. Build Tier 1 — verified entities from portal data
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

    // 4. Build Tier 3 — example entities
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

    // 5. Execution targets based on path
    var executionTargets = [];
    if (path === 'GRANT-ELIGIBLE') executionTargets = ['Commerce Dept EDA program offices', 'Treasury economic development fund', 'State economic development agencies'];
    else if (path === 'PATENTABLE') executionTargets = ['Patent attorneys', 'Economic analytics licensing platforms', 'Strategic acquirers'];
    else if (path === 'INVESTABLE') executionTargets = ['Macro hedge funds', 'Sovereign wealth funds', 'Institutional allocators'];

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

    if (segments.length === 0) segments.push('macro_advisory');

    return segments;
  }

  /**
   * Format targets for display.
   */
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

  window.LIMENEconomyTargetingEngine = { resolveTargets: resolveTargets };
})();
