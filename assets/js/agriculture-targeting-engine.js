/**
 * agriculture-targeting-engine.js — Context-aware targeting for promoted directives
 *
 * Resolves WHO TO TARGET using a tiered model:
 *   Tier 1: Verified entities (domain-aligned companies from portal data)
 *   Tier 2: Entity classes (always present — industry segments)
 *   Tier 3: Example entities (high-confidence, well-known sector players)
 *
 * Filters out mismatched companies (e.g. grain under livestock equipment).
 * Never hallucinates — Tier 3 uses only well-established industry names.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENAgricultureTargetingEngine
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENT TAXONOMY — maps node/directive context to segments
  // ══════════════════════════════════════════════════════════════════════

  var SEGMENTS = {
    commodity_trading: {
      label: 'Agricultural commodity trading desks & exchanges',
      keywords: ['trading', 'commodity', 'futures', 'derivatives', 'market', 'counterparty', 'bilateral', 'contract', 'price', 'volatility', 'risk', 'hedge', 'basis'],
      tier3: [
        { name: 'Cargill', ticker: null },
        { name: 'Archer-Daniels-Midland', ticker: 'ADM' },
        { name: 'Bunge', ticker: 'BG' },
        { name: 'Louis Dreyfus', ticker: null },
        { name: 'COFCO International', ticker: null }
      ]
    },
    grain_storage: {
      label: 'Grain storage & elevator operators',
      keywords: ['storage', 'grain elevator', 'silo', 'bin', 'inventory', 'carry', 'carryover', 'drawdown', 'stockpile', 'warehouse', 'terminal'],
      tier3: [
        { name: 'Archer-Daniels-Midland', ticker: 'ADM' },
        { name: 'Gavilon (Viterra)', ticker: null },
        { name: 'CHS Inc', ticker: 'CHSCP' },
        { name: 'The Andersons', ticker: 'ANDE' }
      ]
    },
    farm_equipment: {
      label: 'Farm equipment & machinery manufacturers',
      keywords: ['equipment', 'machinery', 'tractor', 'combine', 'harvester', 'planter', 'sprayer', 'implement', 'autonomous', 'precision'],
      tier3: [
        { name: 'Deere & Company', ticker: 'DE' },
        { name: 'AGCO Corporation', ticker: 'AGCO' },
        { name: 'CNH Industrial', ticker: 'CNHI' },
        { name: 'Kubota', ticker: 'KUBTY' },
        { name: 'CLAAS', ticker: null }
      ]
    },
    seed_genetics: {
      label: 'Seed genetics & crop breeding companies',
      keywords: ['seed', 'genetics', 'breeding', 'germplasm', 'trait', 'hybrid', 'variety', 'gmo', 'biotech', 'germination'],
      tier3: [
        { name: 'Corteva Agriscience', ticker: 'CTVA' },
        { name: 'Bayer Crop Science', ticker: 'BAYRY' },
        { name: 'Syngenta', ticker: null },
        { name: 'BASF Agricultural', ticker: 'BASFY' },
        { name: 'KWS SAAT', ticker: null }
      ]
    },
    fertilizer: {
      label: 'Fertilizer & nutrient management companies',
      keywords: ['fertilizer', 'nutrient', 'nitrogen', 'phosphate', 'potash', 'urea', 'ammonia', 'soil amendment', 'micronutrient', 'organic fertilizer'],
      tier3: [
        { name: 'Nutrien', ticker: 'NTR' },
        { name: 'CF Industries', ticker: 'CF' },
        { name: 'The Mosaic Company', ticker: 'MOS' },
        { name: 'Yara International', ticker: 'YARIY' },
        { name: 'ICL Group', ticker: 'ICL' }
      ]
    },
    crop_protection: {
      label: 'Crop protection & pest management companies',
      keywords: ['crop protection', 'pesticide', 'herbicide', 'fungicide', 'insecticide', 'pest', 'weed', 'disease', 'ipm', 'biological control'],
      tier3: [
        { name: 'Corteva Agriscience', ticker: 'CTVA' },
        { name: 'Bayer Crop Science', ticker: 'BAYRY' },
        { name: 'Syngenta', ticker: null },
        { name: 'FMC Corporation', ticker: 'FMC' },
        { name: 'AMVAC Chemical', ticker: 'AMVX' }
      ]
    },
    irrigation: {
      label: 'Irrigation & water management operators',
      keywords: ['irrigation', 'water', 'drip', 'pivot', 'sprinkler', 'water management', 'aquifer', 'moisture', 'drought', 'water stress'],
      tier3: [
        { name: 'Lindsay Corporation', ticker: 'LNN' },
        { name: 'Valmont Industries', ticker: 'VMI' },
        { name: 'The Toro Company', ticker: 'TTC' },
        { name: 'Jain Irrigation', ticker: null }
      ]
    },
    food_processing: {
      label: 'Food processing & manufacturing operators',
      keywords: ['processing', 'food processing', 'milling', 'packaging', 'manufacturing', 'food safety', 'traceability', 'quality', 'grading'],
      tier3: [
        { name: 'Tyson Foods', ticker: 'TSN' },
        { name: 'General Mills', ticker: 'GIS' },
        { name: 'Conagra Brands', ticker: 'CAG' },
        { name: 'Ingredion', ticker: 'INGR' },
        { name: 'Lamb Weston', ticker: 'LW' }
      ]
    },
    livestock: {
      label: 'Livestock production & animal health operators',
      keywords: ['livestock', 'cattle', 'poultry', 'swine', 'hog', 'beef', 'animal health', 'feed', 'feedlot', 'ranch', 'calving', 'lambing'],
      tier3: [
        { name: 'Tyson Foods', ticker: 'TSN' },
        { name: 'JBS USA', ticker: null },
        { name: 'Zoetis', ticker: 'ZTS' },
        { name: 'Elanco Animal Health', ticker: 'ELAN' },
        { name: 'Merck Animal Health', ticker: 'MRK' }
      ]
    },
    dairy: {
      label: 'Dairy production & processing operators',
      keywords: ['dairy', 'milk', 'cheese', 'yogurt', 'whey', 'lactose', 'cream', 'butter', 'cooperative'],
      tier3: [
        { name: 'Dairy Farmers of America', ticker: null },
        { name: 'Land O\'Lakes', ticker: null },
        { name: 'Dean Foods (successors)', ticker: null },
        { name: 'Leprino Foods', ticker: null }
      ]
    },
    cold_chain: {
      label: 'Cold chain logistics & distribution operators',
      keywords: ['cold chain', 'cold storage', 'refrigeration', 'transport', 'shipping', 'logistics', 'distribution', 'freight', 'truck', 'rail', 'port', 'terminal'],
      tier3: [
        { name: 'Lineage Logistics', ticker: null },
        { name: 'Americold Realty', ticker: 'COLD' },
        { name: 'XPO Logistics', ticker: 'XPO' },
        { name: 'Werner Enterprises', ticker: 'WERN' }
      ]
    },
    agribusiness: {
      label: 'Diversified agribusiness & farm services',
      keywords: ['agribusiness', 'farm services', 'crop insurance', 'credit', 'loan', 'consulting', 'agronomist', 'soil', 'carbon', 'sustainability', 'policy', 'regulation', 'subsidy', 'government', 'usda'],
      tier3: [
        { name: 'Nutrien', ticker: 'NTR' },
        { name: 'Corteva Agriscience', ticker: 'CTVA' },
        { name: 'Trimble (ag division)', ticker: 'TRMB' },
        { name: 'AGCO Corporation', ticker: 'AGCO' },
        { name: 'FBN (Farmers Business Network)', ticker: null }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // NODE → SEGMENT AFFINITY — which segments each agriculture node maps to
  // ══════════════════════════════════════════════════════════════════════

  var NODE_SEGMENTS = {
    'STRI':  ['commodity_trading', 'grain_storage', 'food_processing'],      // Commodity Markets
    'FORN':  ['cold_chain', 'grain_storage'],                                 // Supply Chain Networks
    'OFC':   ['commodity_trading'],                                            // Market Trading
    'S1':    ['farm_equipment', 'irrigation'],                                 // Production Equipment
    'vmPFC': ['agribusiness'],                                                 // Agricultural Policy
    'CBLM':  ['food_processing', 'cold_chain'],                               // Processing & Distribution
    'M1':    ['farm_equipment', 'irrigation'],                                 // Farm Operations
    'THAL':  ['cold_chain', 'food_processing'],                               // Distribution Networks
    'VTA':   ['seed_genetics', 'crop_protection'],                             // Crop Science
    'PAG':   ['livestock', 'dairy'],                                           // Animal Production
    'NTS':   ['irrigation'],                                                   // Water Systems
    'HIPP':  ['grain_storage', 'cold_chain'],                                  // Storage Systems
    'CC':    ['cold_chain', 'food_processing'],                                // Processing Infrastructure
    'dlPFC': ['agribusiness', 'commodity_trading'],                             // Market Management
    'dACC':  ['commodity_trading', 'agribusiness'],                            // Demand & Pricing
    'ENS':   ['agribusiness', 'crop_protection'],                              // Sustainability
    'CAUD':  ['agribusiness'],                                                 // Carbon & Credits
    'FEF':   ['farm_equipment', 'irrigation'],                                 // Remote Operations
    'BNST':  ['grain_storage', 'cold_chain'],                                  // Inventory Storage
    'EMP':   ['agribusiness', 'fertilizer']                                    // Soil & Carbon
  };

  // Companies that should NEVER appear under certain segments
  var EXCLUSIONS = {
    commodity_trading: ['DE', 'AGCO', 'CNHI', 'LNN', 'VMI'],
    grain_storage:     ['ZTS', 'ELAN', 'CTVA', 'FMC'],
    farm_equipment:    ['ADM', 'BG', 'TSN', 'NTR', 'CF'],
    seed_genetics:     ['DE', 'ADM', 'TSN', 'COLD'],
    fertilizer:        ['DE', 'AGCO', 'TSN', 'ZTS'],
    crop_protection:   ['DE', 'ADM', 'TSN', 'COLD'],
    irrigation:        ['ADM', 'BG', 'TSN', 'NTR'],
    food_processing:   ['DE', 'AGCO', 'LNN', 'NTR'],
    livestock:         ['DE', 'AGCO', 'ADM', 'LNN', 'NTR'],
    dairy:             ['DE', 'AGCO', 'ADM', 'CTVA'],
    cold_chain:        ['DE', 'AGCO', 'NTR', 'CTVA'],
    agribusiness:      ['TSN', 'COLD', 'XPO']
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
    if (path === 'GRANT-ELIGIBLE') executionTargets = ['USDA program officers', 'NRCS conservation divisions', 'State agriculture departments'];
    else if (path === 'PATENTABLE') executionTargets = ['Patent attorneys', 'Technology licensing offices', 'Strategic acquirers'];
    else if (path === 'INVESTABLE') executionTargets = ['Agriculture-focused funds', 'Commodity trading desks', 'Institutional allocators'];

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
    if (segments.length === 0) segments.push('agribusiness');

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

  window.LIMENAgricultureTargetingEngine = { resolveTargets: resolveTargets };
})();
