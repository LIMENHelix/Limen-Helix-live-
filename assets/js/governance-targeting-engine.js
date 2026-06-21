/**
 * governance-targeting-engine.js — Context-aware targeting for promoted Governance directives
 * GLOBAL coverage — US federal, state, multilateral, NGO, civic-tech, and policy investor segments.
 * Exposes: window.LIMENGovernanceTargetingEngine
 */
(function () {
  'use strict';

  var SEGMENTS = {
    us_federal_oversight: {
      label: 'U.S. federal oversight and accountability bodies',
      keywords: ['GAO', 'OIG', 'inspector general', 'CRS', 'CBO', 'Congressional', 'OMB', 'GSA', 'OPM'],
      tier3: [
        { name: 'Government Accountability Office (GAO)', ticker: null },
        { name: 'Congressional Research Service (CRS)', ticker: null },
        { name: 'Office of Management and Budget (OMB)', ticker: null },
        { name: 'Congressional Budget Office (CBO)', ticker: null },
        { name: 'Federal Inspector General community (CIGIE)', ticker: null }
      ]
    },
    state_local_govt: {
      label: 'State, local, and municipal government',
      keywords: ['state government', 'governor', 'state legislature', 'city council', 'mayor', 'county commission', 'NCSL', 'NACo', 'NLC'],
      tier3: [
        { name: 'National Conference of State Legislatures (NCSL)', ticker: null },
        { name: 'National Association of Counties (NACo)', ticker: null },
        { name: 'National League of Cities (NLC)', ticker: null },
        { name: 'Council of State Governments (CSG)', ticker: null },
        { name: 'International City/County Management Association (ICMA)', ticker: null }
      ]
    },
    democracy_ngo: {
      label: 'Democracy, governance, and rule-of-law NGOs',
      keywords: ['NDI', 'IRI', 'NED', 'Freedom House', 'Carnegie Endowment', 'IFES', 'IDEA', 'Democracy Fund', 'Brookings', 'CEPA'],
      tier3: [
        { name: 'National Democratic Institute (NDI)', ticker: null },
        { name: 'International Republican Institute (IRI)', ticker: null },
        { name: 'National Endowment for Democracy (NED)', ticker: null },
        { name: 'Freedom House', ticker: null },
        { name: 'International IDEA', ticker: null },
        { name: 'IFES (International Foundation for Electoral Systems)', ticker: null }
      ]
    },
    civic_tech_vendors: {
      label: 'Civic-tech and govtech platform vendors',
      keywords: ['Tyler Technologies', 'Granicus', 'CivicPlus', 'Accela', 'OpenGov', 'Bloomerang', 'NIC', 'GovTech', 'Code for America'],
      tier3: [
        { name: 'Tyler Technologies', ticker: 'TYL' },
        { name: 'Granicus', ticker: null },
        { name: 'CivicPlus', ticker: null },
        { name: 'Accela', ticker: null },
        { name: 'OpenGov', ticker: null }
      ]
    },
    multilateral_orgs: {
      label: 'Multilateral and intergovernmental organizations',
      keywords: ['United Nations', 'UN ', 'UNDP', 'World Bank', 'IMF', 'OECD', 'WTO', 'ASEAN', 'African Union', 'EU Commission', 'European Council', 'OSCE'],
      tier3: [
        { name: 'United Nations Development Programme (UNDP)', ticker: null },
        { name: 'World Bank Governance Global Practice', ticker: null },
        { name: 'OECD Public Governance Directorate', ticker: null },
        { name: 'European Commission Directorate-General for Justice', ticker: null },
        { name: 'OSCE Office for Democratic Institutions and Human Rights (ODIHR)', ticker: null }
      ]
    },
    election_integrity: {
      label: 'Election integrity and voter access organizations',
      keywords: ['Brennan Center', 'Verified Voting', 'Center for Election Innovation', 'CEIR', 'Election Assistance Commission', 'EAC', 'ballot', 'voter registration'],
      tier3: [
        { name: 'Brennan Center for Justice', ticker: null },
        { name: 'Verified Voting Foundation', ticker: null },
        { name: 'Center for Election Innovation and Research (CEIR)', ticker: null },
        { name: 'U.S. Election Assistance Commission (EAC)', ticker: null },
        { name: 'Voting Rights Lab', ticker: null }
      ]
    },
    anti_corruption: {
      label: 'Anti-corruption and transparency organizations',
      keywords: ['Transparency International', 'Global Integrity', 'OCCRP', 'ICIJ', 'Sunlight', 'Public Citizen', 'Project on Government Oversight', 'POGO'],
      tier3: [
        { name: 'Transparency International', ticker: null },
        { name: 'Organized Crime and Corruption Reporting Project (OCCRP)', ticker: null },
        { name: 'International Consortium of Investigative Journalists (ICIJ)', ticker: null },
        { name: 'Project on Government Oversight (POGO)', ticker: null },
        { name: 'Public Citizen', ticker: null }
      ]
    },
    policy_thinktanks: {
      label: 'Policy think tanks and research institutions',
      keywords: ['Brookings', 'Heritage Foundation', 'AEI', 'CAP', 'Center for American Progress', 'Cato', 'RAND', 'Urban Institute', 'Manhattan Institute', 'New America'],
      tier3: [
        { name: 'Brookings Institution', ticker: null },
        { name: 'Heritage Foundation', ticker: null },
        { name: 'American Enterprise Institute (AEI)', ticker: null },
        { name: 'Center for American Progress (CAP)', ticker: null },
        { name: 'Cato Institute', ticker: null },
        { name: 'RAND Corporation', ticker: null }
      ]
    },
    legal_advocacy: {
      label: 'Legal advocacy and civil liberties organizations',
      keywords: ['ACLU', 'EFF', 'Electronic Frontier', 'Lawyers Committee', 'Southern Poverty Law', 'Common Cause', 'Citizens for Responsibility', 'CREW'],
      tier3: [
        { name: 'American Civil Liberties Union (ACLU)', ticker: null },
        { name: 'Electronic Frontier Foundation (EFF)', ticker: null },
        { name: 'Lawyers\u2019 Committee for Civil Rights', ticker: null },
        { name: 'Common Cause', ticker: null },
        { name: 'Citizens for Responsibility and Ethics in Washington (CREW)', ticker: null }
      ]
    },
    political_risk_consultancies: {
      label: 'Political risk consultancies and intelligence firms',
      keywords: ['Eurasia Group', 'Stratfor', 'Control Risks', 'RANE', 'Teneo', 'Hakluyt', 'Maplecroft', 'IHS Markit Country Risk'],
      tier3: [
        { name: 'Eurasia Group', ticker: null },
        { name: 'Control Risks', ticker: null },
        { name: 'RANE Network', ticker: null },
        { name: 'Stratfor (RANE)', ticker: null },
        { name: 'Teneo', ticker: null }
      ]
    },
    sovereign_creditors: {
      label: 'Sovereign creditors, rating agencies, and bondholders',
      keywords: ['Moody\u2019s', 'S&P', 'Fitch', 'sovereign rating', 'credit rating', 'debt restructuring', 'Paris Club', 'IMF Article IV', 'sovereign default'],
      tier3: [
        { name: 'Moody\u2019s Investors Service', ticker: 'MCO' },
        { name: 'S&P Global Ratings', ticker: 'SPGI' },
        { name: 'Fitch Ratings', ticker: null },
        { name: 'IMF Sovereign Debt department', ticker: null },
        { name: 'Paris Club', ticker: null }
      ]
    }
  };

  // Map Governance top brain nodes to segments
  var NODE_SEGMENTS = {
    'dlPFC':     ['us_federal_oversight', 'policy_thinktanks'],         // Strategic policy direction
    'BROCA':     ['policy_thinktanks', 'democracy_ngo'],                // Policy production
    'OFC':       ['us_federal_oversight'],                              // Value / budget decisions
    'TPJ':       ['democracy_ngo', 'civic_tech_vendors'],               // Constituent perspective
    'FPN':       ['us_federal_oversight', 'multilateral_orgs'],         // Coordination
    'vmPFC':     ['policy_thinktanks', 'us_federal_oversight'],         // Strategic decisions
    'dACC':      ['us_federal_oversight', 'anti_corruption'],           // Conflict / compliance
    'ECN':       ['us_federal_oversight', 'legal_advocacy'],            // Authority and control
    'NAcc':      ['election_integrity'],                                // Reward / voter incentives
    'DMN':       ['state_local_govt', 'civic_tech_vendors'],            // Default state
    'SMA':       ['us_federal_oversight'],                              // Operational planning
    'STRI':      ['anti_corruption', 'civic_tech_vendors'],             // Acquisition / contracts
    'THAL':      ['us_federal_oversight'],                              // Information routing
    'AG':        ['policy_thinktanks', 'multilateral_orgs'],            // Cross-domain synthesis
    'CAUD':      ['civic_tech_vendors'],                                // Workflow / automation
    'CeA':       ['legal_advocacy', 'anti_corruption'],                 // Threat / oversight reaction
    'LANG':      ['multilateral_orgs', 'policy_thinktanks'],            // Treaty / multilingual
    'HIPP':      ['us_federal_oversight', 'policy_thinktanks'],         // Institutional memory
    'SN':        ['political_risk_consultancies'],                      // Salience / risk detection
    'FG':        ['election_integrity', 'civic_tech_vendors']           // Recognition / verification
  };

  var EXCLUSIONS = {
    us_federal_oversight: ['TYL', 'MCO', 'SPGI'],
    democracy_ngo:        ['TYL', 'MCO', 'SPGI']
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
    else if (path === 'INVESTABLE') executionTargets = ['Govtech-focused VCs (Govtech Fund, Founders Fund civic, Andreessen Horowitz American Dynamism)', 'Strategic acquirers (Tyler, Constellation Software public sector, Roper)'];

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
    if (segments.length === 0) segments.push('policy_thinktanks');
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

  window.LIMENGovernanceTargetingEngine = { resolveTargets: resolveTargets };
})();
