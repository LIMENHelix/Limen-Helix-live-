/**
 * assets/js/portfolio-context.js
 * LIMEN Portfolio Context Layer
 *
 * Modular mapping from assets/tickers back to LIMEN domains,
 * plus portfolio concentration analysis and opportunity overlap detection.
 *
 * PAPER TRADING CONTEXT ONLY — no execution, no live trading.
 *
 * Consumed by: investment-console.html, opportunities.html
 * Depends on: paper positions/orders already fetched by caller
 */
(function() {
'use strict';

// ═══════════════════════════════════════════════════
// 1. ASSET → DOMAIN MAPPING
// ═══════════════════════════════════════════════════
// Heuristic first-pass. Each ticker maps to one or more LIMEN domains
// and a thematic cluster label. Easy to expand.

var TICKER_DOMAINS = {
  // Energy / Infrastructure
  XLE:   { domains: ['energy','industry'],       theme: 'energy',         label: 'Energy Select SPDR' },
  IYT:   { domains: ['supplyChain','industry'],  theme: 'logistics',      label: 'Transportation ETF' },
  NEE:   { domains: ['energy','industry'],       theme: 'energy',         label: 'NextEra Energy' },
  EPD:   { domains: ['energy','supplyChain'],    theme: 'energy',         label: 'Enterprise Products' },
  FLNC:  { domains: ['energy','technology'],     theme: 'energy',         label: 'Fluence Energy' },

  // Clean Energy / Climate
  ICLN:  { domains: ['energy','environment'],    theme: 'clean-energy',   label: 'Global Clean Energy' },
  TAN:   { domains: ['energy','environment'],    theme: 'clean-energy',   label: 'Solar ETF' },
  FSLR:  { domains: ['energy','environment'],    theme: 'clean-energy',   label: 'First Solar' },

  // Finance / Economy
  TLT:   { domains: ['finance','economy'],       theme: 'macro-defense',  label: 'Long-Term Bonds' },
  GLD:   { domains: ['finance','economy'],       theme: 'macro-defense',  label: 'Gold' },
  SPY:   { domains: ['finance','economy'],       theme: 'broad-market',   label: 'S&P 500' },
  SDS:   { domains: ['finance','economy'],       theme: 'macro-hedge',    label: '2x Inverse S&P' },
  SH:    { domains: ['finance','economy'],       theme: 'macro-hedge',    label: 'Inverse S&P' },
  HYG:   { domains: ['finance','economy'],       theme: 'credit',         label: 'High Yield Bonds' },
  JNK:   { domains: ['finance','economy'],       theme: 'credit',         label: 'Junk Bonds' },
  XLF:   { domains: ['finance','economy'],       theme: 'financials',     label: 'Financial Select SPDR' },

  // Cybersecurity / Law / Compliance
  PANW:  { domains: ['law','finance','technology'], theme: 'cyber-compliance', label: 'Palo Alto Networks' },
  HACK:  { domains: ['law','defense','technology'], theme: 'cybersecurity',    label: 'Cybersecurity ETF' },
  CRWD:  { domains: ['defense','technology'],       theme: 'cybersecurity',    label: 'CrowdStrike' },

  // Defense / Intelligence
  ITA:   { domains: ['defense','governance'],    theme: 'defense',        label: 'Defense ETF' },
  PLTR:  { domains: ['defense','intelligence','governance'], theme: 'intelligence', label: 'Palantir' },
  BAH:   { domains: ['governance','intelligence'], theme: 'gov-services', label: 'Booz Allen Hamilton' },

  // Health / Biotech / Research
  XBI:   { domains: ['health','research'],       theme: 'biotech',        label: 'Biotech ETF' },
  IBB:   { domains: ['health','research'],       theme: 'biotech',        label: 'Biotech Index' },
  VEEV:  { domains: ['health','technology'],     theme: 'health-tech',    label: 'Veeva Systems' },

  // Technology / Research
  ARKK:  { domains: ['technology','research'],   theme: 'innovation',     label: 'ARK Innovation' },
  QTEC:  { domains: ['technology','research'],   theme: 'tech',           label: 'Tech Select' },
  NVDA:  { domains: ['technology','research'],   theme: 'ai-compute',     label: 'NVIDIA' },
  IONQ:  { domains: ['technology','research'],   theme: 'quantum',        label: 'IonQ' },

  // Infrastructure / Industrial
  PAVE:  { domains: ['industry','governance'],   theme: 'infrastructure', label: 'Infrastructure ETF' },
  XLI:   { domains: ['industry','economy'],      theme: 'industrial',     label: 'Industrial Select SPDR' },
  HON:   { domains: ['industry','technology'],   theme: 'industrial',     label: 'Honeywell' },
  ROK:   { domains: ['industry','technology'],   theme: 'automation',     label: 'Rockwell Automation' },

  // Agriculture
  MOO:   { domains: ['agriculture','economy'],   theme: 'agriculture',    label: 'Agriculture ETF' },
  DBA:   { domains: ['agriculture','economy'],   theme: 'agriculture',    label: 'Farm Commodities' },
  DE:    { domains: ['agriculture','technology'],theme: 'agtech',         label: 'Deere & Co' },
  COLD:  { domains: ['supplyChain','agriculture'], theme: 'cold-chain',   label: 'Americold Realty' },

  // Communication / Culture
  NET:   { domains: ['communication','technology'], theme: 'digital-infra', label: 'Cloudflare' },

  // Education
  COUR:  { domains: ['education','technology'],  theme: 'edtech',         label: 'Coursera' },
  DUOL:  { domains: ['education','technology'],  theme: 'edtech',         label: 'Duolingo' }
};

// Opportunity → domain mapping (mirrors playbook domains)
var OPP_DOMAINS = {
  infra_demand:    ['energy','supplyChain','industry'],
  fin_law:         ['finance','law'],
  health_research: ['health','research'],
  tech_research:   ['technology','research'],
  climate_energy:  ['energy','environment'],
  econ_supply:     ['economy','supplyChain'],
  gov_econ:        ['governance','economy'],
  industry_econ:   ['industry','economy'],
  defense_intel:   ['defense','intelligence'],
  agri_pop:        ['agriculture','population'],
  supply_agri:     ['supplyChain','agriculture'],
  intel_gov:       ['intelligence','governance'],
  fin_econ:        ['finance','economy'],
  comm_culture:    ['communication','culture'],
  edu_research:    ['education','research']
};

// Theme labels for display
var THEME_LABELS = {
  'energy': 'Energy', 'clean-energy': 'Clean Energy', 'logistics': 'Logistics',
  'macro-defense': 'Defensive Macro', 'macro-hedge': 'Macro Hedge', 'broad-market': 'Broad Market',
  'credit': 'Credit', 'financials': 'Financials', 'cyber-compliance': 'Cyber/Compliance',
  'cybersecurity': 'Cybersecurity', 'defense': 'Defense', 'intelligence': 'Intelligence',
  'gov-services': 'Gov Services', 'biotech': 'Biotech', 'health-tech': 'Health Tech',
  'innovation': 'Innovation', 'tech': 'Technology', 'ai-compute': 'AI/Compute',
  'quantum': 'Quantum', 'infrastructure': 'Infrastructure', 'industrial': 'Industrial',
  'automation': 'Automation', 'agriculture': 'Agriculture', 'agtech': 'AgTech',
  'cold-chain': 'Cold Chain', 'digital-infra': 'Digital Infra', 'edtech': 'EdTech'
};

// ═══════════════════════════════════════════════════
// 2. PORTFOLIO EXPOSURE ANALYZER
// ═══════════════════════════════════════════════════

/**
 * Analyze portfolio exposure from paper positions and orders.
 * @param {Object} positions - symbol → position object (from /api/paper-positions)
 * @param {Object} orders    - symbol → order object (from /api/paper-orders)
 * @returns {Object} analysis result
 */
function analyzePortfolio(positions, orders) {
  var domainExposure = {};  // domain → { symbols: [], totalValue: 0 }
  var themeExposure = {};   // theme → { symbols: [], count: 0 }
  var heldSymbols = [];

  // Process open positions
  for (var sym in positions) {
    var pos = positions[sym];
    if (Number(pos.qty) <= 0) continue;
    heldSymbols.push(sym);
    var mapping = TICKER_DOMAINS[sym];
    if (!mapping) continue;
    var val = Math.abs(Number(pos.marketValue) || 0);

    // Domain exposure
    for (var di = 0; di < mapping.domains.length; di++) {
      var dom = mapping.domains[di];
      if (!domainExposure[dom]) domainExposure[dom] = { symbols: [], totalValue: 0 };
      domainExposure[dom].symbols.push(sym);
      domainExposure[dom].totalValue += val;
    }

    // Theme exposure
    var th = mapping.theme;
    if (!themeExposure[th]) themeExposure[th] = { symbols: [], count: 0 };
    themeExposure[th].symbols.push(sym);
    themeExposure[th].count++;
  }

  // Also consider filled orders for symbols not currently held (previously traded)
  var tradedSymbols = [];
  for (var osym in orders) {
    var ord = orders[osym];
    if (ord.status === 'filled' && heldSymbols.indexOf(osym) === -1) {
      tradedSymbols.push(osym);
    }
  }

  // Concentration analysis
  var totalValue = 0;
  for (var d in domainExposure) totalValue += domainExposure[d].totalValue;
  // Deduplicate: each dollar counted once across domains (assets map to multiple domains)
  // Use position-level total instead
  var rawTotal = 0;
  for (var ps in positions) {
    if (Number(positions[ps].qty) > 0) rawTotal += Math.abs(Number(positions[ps].marketValue) || 0);
  }

  var domainConcentration = {};
  for (var dc in domainExposure) {
    var pct = rawTotal > 0 ? (domainExposure[dc].totalValue / rawTotal * 100) : 0;
    domainConcentration[dc] = {
      symbols: domainExposure[dc].symbols,
      value: domainExposure[dc].totalValue,
      pct: Math.round(pct),
      level: pct > 50 ? 'HIGH' : pct > 25 ? 'MODERATE' : 'LOW'
    };
  }

  var themeConcentration = {};
  var totalThemeCount = heldSymbols.length;
  for (var tc in themeExposure) {
    var tPct = totalThemeCount > 0 ? (themeExposure[tc].count / totalThemeCount * 100) : 0;
    themeConcentration[tc] = {
      symbols: themeExposure[tc].symbols,
      count: themeExposure[tc].count,
      pct: Math.round(tPct),
      label: THEME_LABELS[tc] || tc
    };
  }

  // Top domain
  var topDomain = null, topPct = 0;
  for (var td in domainConcentration) {
    if (domainConcentration[td].pct > topPct) {
      topPct = domainConcentration[td].pct;
      topDomain = td;
    }
  }

  return {
    heldSymbols: heldSymbols,
    tradedSymbols: tradedSymbols,
    domainExposure: domainConcentration,
    themeExposure: themeConcentration,
    totalPositions: heldSymbols.length,
    totalValue: rawTotal,
    topDomain: topDomain,
    topDomainPct: topPct
  };
}

// ═══════════════════════════════════════════════════
// 3. OPPORTUNITY OVERLAP ANALYZER
// ═══════════════════════════════════════════════════

/**
 * Analyze how an opportunity relates to existing portfolio.
 * @param {string} oppId        - playbook ID
 * @param {Array}  oppDomains   - opportunity's LIMEN domains
 * @param {Array}  oppTickers   - tickers suggested for this opportunity
 * @param {Object} portfolio    - result of analyzePortfolio()
 * @returns {Object} overlap analysis
 */
function analyzeOverlap(oppId, oppDomains, oppTickers, portfolio) {
  if (!portfolio || portfolio.totalPositions === 0) {
    return {
      directOverlap: [],
      domainOverlap: [],
      thematicOverlap: [],
      newDomains: oppDomains.slice(),
      newThemes: [],
      verdict: 'CLEAN_ENTRY',
      warnings: [],
      diversifies: true
    };
  }

  // Direct overlap: tickers already held
  var directOverlap = [];
  for (var i = 0; i < oppTickers.length; i++) {
    if (portfolio.heldSymbols.indexOf(oppTickers[i]) !== -1) {
      directOverlap.push(oppTickers[i]);
    }
  }

  // Domain overlap: opportunity domains that already have paper exposure
  var domainOverlap = [];
  var newDomains = [];
  for (var di = 0; di < oppDomains.length; di++) {
    if (portfolio.domainExposure[oppDomains[di]]) {
      domainOverlap.push({
        domain: oppDomains[di],
        currentPct: portfolio.domainExposure[oppDomains[di]].pct,
        currentSymbols: portfolio.domainExposure[oppDomains[di]].symbols
      });
    } else {
      newDomains.push(oppDomains[di]);
    }
  }

  // Thematic overlap: check if opportunity themes match held themes
  var thematicOverlap = [];
  var newThemes = [];
  var seenThemes = {};
  for (var ti = 0; ti < oppTickers.length; ti++) {
    var tm = TICKER_DOMAINS[oppTickers[ti]];
    if (!tm) continue;
    if (seenThemes[tm.theme]) continue;
    seenThemes[tm.theme] = true;
    if (portfolio.themeExposure[tm.theme]) {
      thematicOverlap.push({
        theme: tm.theme,
        label: THEME_LABELS[tm.theme] || tm.theme,
        currentSymbols: portfolio.themeExposure[tm.theme].symbols
      });
    } else {
      newThemes.push(THEME_LABELS[tm.theme] || tm.theme);
    }
  }

  // Build warnings
  var warnings = [];
  if (directOverlap.length > 0) {
    warnings.push('DIRECT OVERLAP: Already hold ' + directOverlap.join(', '));
  }
  if (domainOverlap.length > 0) {
    for (var oi = 0; oi < domainOverlap.length; oi++) {
      var o = domainOverlap[oi];
      if (o.currentPct >= 40) {
        warnings.push('HIGH ' + o.domain.toUpperCase() + ' CONCENTRATION (' + o.currentPct + '% of paper book)');
      } else if (o.currentPct >= 20) {
        warnings.push('EXISTING ' + o.domain.toUpperCase() + ' EXPOSURE (' + o.currentPct + '%)');
      }
    }
  }
  if (thematicOverlap.length > 0 && directOverlap.length === 0) {
    warnings.push('OVERLAPS CURRENT ' + thematicOverlap.map(function(t){ return t.label.toUpperCase(); }).join(', ') + ' POSITIONING');
  }

  // Determine verdict
  var diversifies = newDomains.length > 0 || newThemes.length > 0;
  var verdict;
  if (directOverlap.length > 0 && domainOverlap.length === oppDomains.length) {
    verdict = 'FULL_OVERLAP';
  } else if (domainOverlap.length > 0 && directOverlap.length > 0) {
    verdict = 'SIGNIFICANT_OVERLAP';
  } else if (domainOverlap.length > 0) {
    verdict = 'DOMAIN_OVERLAP';
  } else if (thematicOverlap.length > 0) {
    verdict = 'THEMATIC_OVERLAP';
  } else {
    verdict = diversifies ? 'DIVERSIFIES' : 'CLEAN_ENTRY';
  }

  if (diversifies && warnings.length === 0) {
    warnings.push('DIVERSIFIES CURRENT PAPER BOOK' + (newDomains.length > 0 ? ' (adds ' + newDomains.join(', ').toUpperCase() + ')' : ''));
  }

  return {
    directOverlap: directOverlap,
    domainOverlap: domainOverlap,
    thematicOverlap: thematicOverlap,
    newDomains: newDomains,
    newThemes: newThemes,
    verdict: verdict,
    warnings: warnings,
    diversifies: diversifies
  };
}

// ═══════════════════════════════════════════════════
// 4. CONNECTOME SUPPORT ANALYZER
// ═══════════════════════════════════════════════════

/**
 * Analyze connectome node overlap between current portfolio and opportunity.
 * @param {Array}  oppDomains   - opportunity's LIMEN domains
 * @param {Object} portfolio    - result of analyzePortfolio()
 * @returns {Object} { reinforced: [], newBranches: [], coverage }
 */
function analyzeConnectomeOverlap(oppDomains, portfolio) {
  if (!portfolio || portfolio.totalPositions === 0) {
    return { reinforced: [], newBranches: oppDomains.slice(), coverage: 'NEW' };
  }

  var reinforced = [];
  var newBranches = [];

  for (var i = 0; i < oppDomains.length; i++) {
    var dom = oppDomains[i];
    if (portfolio.domainExposure[dom]) {
      reinforced.push(dom);
    } else {
      newBranches.push(dom);
    }
  }

  var coverage;
  if (newBranches.length === oppDomains.length) coverage = 'NEW_BRANCH';
  else if (reinforced.length === oppDomains.length) coverage = 'REINFORCES';
  else coverage = 'MIXED';

  return { reinforced: reinforced, newBranches: newBranches, coverage: coverage };
}

// ═══════════════════════════════════════════════════
// 5. PUBLIC API
// ═══════════════════════════════════════════════════

window.LIMENPortfolioContext = {
  TICKER_DOMAINS: TICKER_DOMAINS,
  OPP_DOMAINS: OPP_DOMAINS,
  THEME_LABELS: THEME_LABELS,
  analyzePortfolio: analyzePortfolio,
  analyzeOverlap: analyzeOverlap,
  analyzeConnectomeOverlap: analyzeConnectomeOverlap,

  /**
   * Get domains for a ticker.
   * @param {string} ticker
   * @returns {Array} domain IDs
   */
  getDomainsForTicker: function(ticker) {
    var m = TICKER_DOMAINS[ticker];
    return m ? m.domains.slice() : [];
  },

  /**
   * Get theme for a ticker.
   * @param {string} ticker
   * @returns {string|null}
   */
  getThemeForTicker: function(ticker) {
    var m = TICKER_DOMAINS[ticker];
    return m ? m.theme : null;
  },

  /**
   * Get all tickers mapped to a domain.
   * @param {string} domain
   * @returns {Array} ticker strings
   */
  getTickersForDomain: function(domain) {
    var result = [];
    for (var t in TICKER_DOMAINS) {
      if (TICKER_DOMAINS[t].domains.indexOf(domain) !== -1) result.push(t);
    }
    return result;
  },

  /**
   * Quick concentration badge for an opportunity.
   * @param {string} oppId
   * @param {Object} portfolio - from analyzePortfolio()
   * @returns {Object} { text, color, level }
   */
  quickBadge: function(oppId, portfolio) {
    if (!portfolio || portfolio.totalPositions === 0) {
      return { text: '', color: '#555', level: 'none' };
    }
    var oppDoms = OPP_DOMAINS[oppId] || [];
    var overlap = 0;
    for (var i = 0; i < oppDoms.length; i++) {
      if (portfolio.domainExposure[oppDoms[i]]) overlap++;
    }
    if (overlap === 0) {
      return { text: 'DIVERSIFIES', color: '#5ab5a0', level: 'diversify' };
    }
    if (overlap === oppDoms.length) {
      var maxPct = 0;
      for (var j = 0; j < oppDoms.length; j++) {
        var de = portfolio.domainExposure[oppDoms[j]];
        if (de && de.pct > maxPct) maxPct = de.pct;
      }
      if (maxPct >= 40) return { text: 'HIGH CONCENTRATION', color: '#e85454', level: 'high' };
      return { text: 'ADDS TO EXISTING', color: '#C9A94E', level: 'overlap' };
    }
    return { text: 'PARTIAL OVERLAP', color: '#C9A94E', level: 'partial' };
  }
};

})();
