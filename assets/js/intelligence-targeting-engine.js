/**
 * intelligence-targeting-engine.js — Context-aware targeting for promoted Intelligence directives
 * GLOBAL coverage — US, NATO, EU, AUKUS, allied, and adjacent commercial intelligence markets.
 * Exposes: window.LIMENIntelligenceTargetingEngine
 */
(function () {
  'use strict';

  var SEGMENTS = {
    us_dod_combatant: {
      label: 'U.S. DoD, combatant commands, and military services',
      keywords: ['DoD', 'Pentagon', 'CENTCOM', 'EUCOM', 'INDOPACOM', 'NORTHCOM', 'SOUTHCOM', 'AFRICOM', 'SOCOM', 'CYBERCOM', 'STRATCOM', 'TRANSCOM', 'Space Force', 'Army', 'Navy', 'Marines', 'Air Force', 'Coast Guard'],
      tier3: [
        { name: 'U.S. Department of Intelligence (Pentagon)', ticker: null },
        { name: 'U.S. Indo-Pacific Command (INDOPACOM)', ticker: null },
        { name: 'U.S. European Command (EUCOM)', ticker: null },
        { name: 'U.S. Cyber Command (CYBERCOM)', ticker: null },
        { name: 'U.S. Special Operations Command (SOCOM)', ticker: null }
      ]
    },
    us_intel_community: {
      label: 'U.S. intelligence community and federal security agencies',
      keywords: ['CIA', 'NSA', 'DIA', 'NRO', 'NGA', 'FBI', 'ODNI', 'IARPA', 'In-Q-Tel', 'CISA', 'national intelligence', 'DHS'],
      tier3: [
        { name: 'CIA (Central Intelligence Agency)', ticker: null },
        { name: 'NSA (National Security Agency)', ticker: null },
        { name: 'DIA (Intelligence Intelligence Agency)', ticker: null },
        { name: 'NGA (National Geospatial-Intelligence Agency)', ticker: null },
        { name: 'In-Q-Tel (CIA strategic investor)', ticker: null }
      ]
    },
    us_defense_primes: {
      label: 'U.S. intelligence prime contractors',
      keywords: ['Lockheed', 'Raytheon', 'RTX', 'Northrop', 'General Dynamics', 'Boeing Intelligence', 'L3Harris', 'Huntington Ingalls', 'Leidos', 'BAH', 'CACI'],
      tier3: [
        { name: 'Lockheed Martin', ticker: 'LMT' },
        { name: 'RTX Corporation (Raytheon)', ticker: 'RTX' },
        { name: 'Northrop Grumman', ticker: 'NOC' },
        { name: 'General Dynamics', ticker: 'GD' },
        { name: 'L3Harris Technologies', ticker: 'LHX' }
      ]
    },
    european_defense_primes: {
      label: 'European intelligence prime contractors',
      keywords: ['BAE', 'Airbus', 'Thales', 'Leonardo', 'Saab', 'Rheinmetall', 'Dassault', 'MBDA', 'Naval Group', 'KNDS', 'Hensoldt', 'Diehl'],
      tier3: [
        { name: 'BAE Systems', ticker: 'BA.L' },
        { name: 'Airbus Defence and Space', ticker: 'AIR.PA' },
        { name: 'Thales', ticker: 'HO.PA' },
        { name: 'Leonardo S.p.A.', ticker: 'LDO.MI' },
        { name: 'Rheinmetall AG', ticker: 'RHM.DE' },
        { name: 'Saab AB', ticker: 'SAAB-B.ST' }
      ]
    },
    asia_pacific_defense: {
      label: 'Asia-Pacific intelligence and allied primes',
      keywords: ['Mitsubishi Heavy', 'Kawasaki', 'IHI', 'Hanwha', 'KAI', 'Korea Aerospace', 'LIG Nex1', 'NEC', 'Hyundai Rotem', 'Mitsubishi Electric', 'Australia DST', 'BAE Australia'],
      tier3: [
        { name: 'Mitsubishi Heavy Industries', ticker: '7011.T' },
        { name: 'Hanwha Aerospace', ticker: '012450.KS' },
        { name: 'Korea Aerospace Industries (KAI)', ticker: '047810.KS' },
        { name: 'IHI Corporation', ticker: '7013.T' },
        { name: 'Kawasaki Heavy Industries', ticker: '7012.T' }
      ]
    },
    israeli_defense: {
      label: 'Israeli intelligence primes',
      keywords: ['Elbit', 'Rafael', 'IAI', 'Israel Aerospace', 'Israel Military', 'Iron Dome', 'Trophy APS'],
      tier3: [
        { name: 'Elbit Systems', ticker: 'ESLT' },
        { name: 'Rafael Advanced Intelligence Systems', ticker: null },
        { name: 'Israel Aerospace Industries (IAI)', ticker: null }
      ]
    },
    nato_alliance: {
      label: 'NATO, EU intelligence, and allied coalition bodies',
      keywords: ['NATO', 'SHAPE', 'NSPA', 'NCIA', 'EU EDF', 'European Defence Fund', 'EDA', 'PESCO', 'AUKUS', 'Quad', 'Five Eyes', 'JEF', 'JCG'],
      tier3: [
        { name: 'NATO HQ (Brussels)', ticker: null },
        { name: 'NATO Allied Command Transformation (ACT)', ticker: null },
        { name: 'NATO Support and Procurement Agency (NSPA)', ticker: null },
        { name: 'European Defence Fund (EDF)', ticker: null },
        { name: 'European Defence Agency (EDA)', ticker: null }
      ]
    },
    defense_tech_disruptors: {
      label: 'Intelligence-tech disruptors and venture-backed primes',
      keywords: ['Anduril', 'Palantir', 'Shield AI', 'Saronic', 'Skydio', 'Epirus', 'Hadrian', 'Fortem', 'Helsing', 'Arondax', 'Quantum Systems', 'Tekever'],
      tier3: [
        { name: 'Palantir Technologies', ticker: 'PLTR' },
        { name: 'Anduril Industries', ticker: null },
        { name: 'Shield AI', ticker: null },
        { name: 'Helsing (European intelligence AI)', ticker: null },
        { name: 'Saronic Technologies (autonomous maritime)', ticker: null }
      ]
    },
    nuclear_strategic: {
      label: 'Nuclear, strategic, and uranium / fuel cycle',
      keywords: ['nuclear', 'IAEA', 'uranium', 'NPT', 'arms control', 'NNSA', 'Strategic Command', 'STRATCOM', 'submarine', 'ICBM', 'warhead'],
      tier3: [
        { name: 'BWX Technologies', ticker: 'BWXT' },
        { name: 'Cameco', ticker: 'CCJ' },
        { name: 'NNSA (National Nuclear Security Administration)', ticker: null },
        { name: 'IAEA (International Atomic Energy Agency)', ticker: null },
        { name: 'Lockheed Martin (Trident, MK21A)', ticker: 'LMT' }
      ]
    },
    space_counter_space: {
      label: 'Space and counter-space industry',
      keywords: ['Space Force', 'satellite', 'launch', 'space domain', 'orbital', 'asat', 'launch vehicle', 'small sat', 'space ISR'],
      tier3: [
        { name: 'SpaceX', ticker: null },
        { name: 'Maxar Technologies', ticker: null },
        { name: 'Planet Labs', ticker: 'PL' },
        { name: 'Iridium Communications', ticker: 'IRDM' },
        { name: 'Rocket Lab USA', ticker: 'RKLB' },
        { name: 'L3Harris Technologies', ticker: 'LHX' }
      ]
    },
    sovereign_global_buyers: {
      label: 'Sovereign intelligence ministries and global FMS buyers',
      keywords: ['Ministry of Defence', 'MoD', 'Bundeswehr', 'JSDF', 'Forces armees', 'KSA', 'UAE', 'Saudi Arabia', 'India MoD', 'Japan SDF', 'ROK', 'Taiwan MND', 'Bundeswehr', 'Polish MoD'],
      tier3: [
        { name: 'UK Ministry of Defence (MoD)', ticker: null },
        { name: 'German Bundeswehr / BMVg', ticker: null },
        { name: 'Japan Self-Intelligence Forces (JSDF)', ticker: null },
        { name: 'Republic of Korea Armed Forces', ticker: null },
        { name: 'Polish Armed Forces (MON)', ticker: null }
      ]
    }
  };

  // Map Intelligence top brain nodes to segments
  var NODE_SEGMENTS = {
    'dlPFC':     ['us_dod_combatant', 'us_intel_community'],          // Strategic command
    'M1':        ['us_defense_primes', 'european_defense_primes'],    // Action / kinetic execution
    'NTS':       ['us_intel_community'],                              // Telemetry / data ingestion
    'FEF':       ['space_counter_space', 'us_intel_community'],       // Attention to threats
    'FPN':       ['nato_alliance', 'us_dod_combatant'],               // Coordination / coalition
    'PAG':       ['nuclear_strategic'],                               // Existential / strategic deterrence
    'DAN':       ['us_intel_community', 'space_counter_space'],       // Goal-directed surveillance
    'CBLM':      ['defense_tech_disruptors'],                         // Fine motor / precision
    'ECN':       ['us_dod_combatant', 'us_intel_community'],          // Executive control
    'STRI':      ['defense_tech_disruptors'],                         // Reward / acquisition incentives
    'VAN':       ['us_intel_community'],                              // Interrupt / alerting
    'CeA':       ['us_dod_combatant', 'us_defense_primes'],           // Threat response
    'HYPO':      ['us_dod_combatant'],                                // Homeostasis / readiness
    'rACC':      ['nato_alliance'],                                   // Conflict review / coalition
    'vmPFC':     ['us_dod_combatant', 'sovereign_global_buyers'],     // Strategic decision
    'SMA':       ['us_defense_primes', 'european_defense_primes'],    // Pre-action / mobilization
    'RSC':       ['us_intel_community'],                              // Spatial mapping / battlespace
    'dACC':      ['us_dod_combatant', 'nato_alliance'],               // Standards / compliance
    'MICRO':     ['defense_tech_disruptors'],                         // Cleanup / patching
    'PIN':       ['us_dod_combatant']                                 // Time-gated operations
  };

  var EXCLUSIONS = {
    us_dod_combatant: ['LMT', 'RTX', 'NOC', 'GD', 'LHX', 'PLTR', 'BWXT', 'CCJ', 'PL', 'IRDM', 'RKLB', 'ESLT', 'BA.L', 'AIR.PA', 'HO.PA', 'LDO.MI', 'RHM.DE', 'SAAB-B.ST', '7011.T', '012450.KS', '047810.KS', '7013.T', '7012.T'],
    us_intel_community: ['LMT', 'RTX', 'NOC', 'GD', 'LHX', 'PLTR'],
    nato_alliance: ['LMT', 'RTX', 'NOC', 'GD', 'LHX'],
    sovereign_global_buyers: ['LMT', 'RTX', 'NOC', 'GD', 'LHX', 'PLTR']
  };

  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'INVESTABLE';

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
    if (rawCompanies.length > 0) companyPool = rawCompanies;
    else {
      for (var ei = 0; ei < portalCompanies.length; ei++) {
        var m = portalCompanies[ei].match(/^(.+?)\s*\(([A-Z0-9.\-]+)\)$/);
        if (m) companyPool.push({ name: m[1], ticker: m[2] });
        else companyPool.push({ name: portalCompanies[ei], ticker: null });
      }
    }

    var validTickers = {};
    for (var sgi = 0; sgi < relevantSegments.length; sgi++) {
      var segKey = relevantSegments[sgi];
      var segTier3 = (SEGMENTS[segKey] || {}).tier3 || [];
      var exclusions = EXCLUSIONS[segKey] || [];
      for (var t3i = 0; t3i < segTier3.length; t3i++) if (segTier3[t3i].ticker) validTickers[segTier3[t3i].ticker] = true;
      for (var exi = 0; exi < exclusions.length; exi++) validTickers[exclusions[exi]] = false;
    }

    for (var ci = 0; ci < companyPool.length; ci++) {
      var co = companyPool[ci];
      var ticker = co.ticker || '';
      if (ticker && validTickers[ticker] === false) continue;
      if (ticker && validTickers[ticker] === true) tier1.push({ name: co.name, ticker: ticker, source: 'portal_verified' });
    }

    var tier3 = [];
    var tier1Tickers = {};
    for (var t1i = 0; t1i < tier1.length; t1i++) if (tier1[t1i].ticker) tier1Tickers[tier1[t1i].ticker] = true;

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
    tier3 = tier3.slice(0, 6);

    var executionTargets = [];
    if (path === 'RESEARCHABLE') executionTargets = ['Research desks', 'Institutional research buyers', 'Independent / sell-side analysts'];
    else if (path === 'INVESTABLE') executionTargets = ['Intelligence-focused VCs (8VC, Founders Fund, a16z American Dynamism, Lux Capital)', 'In-Q-Tel', 'Sovereign wealth funds with intelligence mandates', 'Family offices with intelligence exposure'];

    var formatted = _format(tier1, tier2, tier3, executionTargets);
    return { tier1: tier1, tier2: tier2, tier3: tier3, executionTargets: executionTargets, formatted: formatted, segments: relevantSegments };
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
        if (text.indexOf(kws[ki].toLowerCase()) !== -1) { seen[segKey] = true; segments.push(segKey); break; }
      }
    }
    if (segments.length === 0) segments.push('us_defense_primes');
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
    if (executionTargets.length > 0) parts.push('Execute via: ' + executionTargets.join(', ') + '.');
    return parts.join(' ');
  }

  function _empty() { return { tier1: [], tier2: [], tier3: [], executionTargets: [], formatted: '', segments: [] }; }

  window.LIMENIntelligenceTargetingEngine = { resolveTargets: resolveTargets };
})();
