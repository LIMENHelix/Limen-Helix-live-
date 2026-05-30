/**
 * communication-targeting-engine.js — Context-aware targeting for promoted Communication directives
 * Exposes: window.LIMENCommunicationTargetingEngine
 */
(function () {
  'use strict';

  var SEGMENTS = {
    federal_comms_regulators: {
      label: 'Federal communications and information regulators',
      keywords: ['FCC', 'NTIA', 'FTC', 'USAGM', 'Voice of America', 'Section 230', 'broadcast license', 'spectrum', 'public broadcasting', 'CPB', 'VOA', 'RFE'],
      tier3: [
        { name: 'FCC (Federal Communications Commission)', ticker: null },
        { name: 'NTIA (National Telecommunications and Information Administration)', ticker: null },
        { name: 'FTC Bureau of Consumer Protection', ticker: null },
        { name: 'USAGM (U.S. Agency for Global Media)', ticker: null },
        { name: 'Corporation for Public Broadcasting (CPB)', ticker: null }
      ]
    },
    big_tech_platforms: {
      label: 'Big Tech communication platforms and gatekeepers',
      keywords: ['Meta', 'Facebook', 'Instagram', 'WhatsApp', 'YouTube', 'TikTok', 'X', 'Twitter', 'Reddit', 'Snap', 'LinkedIn', 'platform', 'social media'],
      tier3: [
        { name: 'Meta Platforms', ticker: 'META' },
        { name: 'Alphabet (YouTube)', ticker: 'GOOGL' },
        { name: 'Snap', ticker: 'SNAP' },
        { name: 'Reddit', ticker: 'RDDT' },
        { name: 'Pinterest', ticker: 'PINS' }
      ]
    },
    telecom_carriers: {
      label: 'Telecom carriers and connectivity providers',
      keywords: ['carrier', 'wireless', 'broadband', 'fiber', 'ISP', '5G', 'Verizon', 'AT&T', 'T-Mobile', 'Comcast', 'Charter', 'spectrum auction', 'submarine cable'],
      tier3: [
        { name: 'Verizon Communications', ticker: 'VZ' },
        { name: 'AT&T', ticker: 'T' },
        { name: 'T-Mobile US', ticker: 'TMUS' },
        { name: 'Comcast', ticker: 'CMCSA' },
        { name: 'Charter Communications', ticker: 'CHTR' }
      ]
    },
    media_publishers: {
      label: 'News publishers, broadcasters, and traditional media',
      keywords: ['newspaper', 'publisher', 'broadcaster', 'NYT', 'WSJ', 'Washington Post', 'CNN', 'MSNBC', 'Fox', 'Reuters', 'AP', 'Bloomberg', 'newsroom', 'editorial'],
      tier3: [
        { name: 'New York Times Company', ticker: 'NYT' },
        { name: 'News Corp', ticker: 'NWSA' },
        { name: 'Warner Bros. Discovery', ticker: 'WBD' },
        { name: 'Comcast NBCUniversal', ticker: 'CMCSA' },
        { name: 'Fox Corporation', ticker: 'FOXA' }
      ]
    },
    creator_platforms: {
      label: 'Creator economy platforms and direct-to-audience tools',
      keywords: ['creator', 'newsletter', 'podcast', 'subscription', 'paywall', 'membership', 'Substack', 'Patreon', 'Beehiiv', 'Ghost', 'Medium', 'Spotify'],
      tier3: [
        { name: 'Substack', ticker: null },
        { name: 'Patreon', ticker: null },
        { name: 'Beehiiv', ticker: null },
        { name: 'Spotify Technology', ticker: 'SPOT' },
        { name: 'Cloudflare (creator infrastructure)', ticker: 'NET' }
      ]
    },
    trust_safety_vendors: {
      label: 'Trust, safety, and content moderation vendors',
      keywords: ['trust and safety', 'content moderation', 'fact check', 'misinformation detection', 'deepfake', 'authenticity', 'provenance', 'C2PA', 'NewsGuard', 'Logically'],
      tier3: [
        { name: 'ActiveFence', ticker: null },
        { name: 'Hive (content moderation AI)', ticker: null },
        { name: 'NewsGuard', ticker: null },
        { name: 'Logically', ticker: null },
        { name: 'TrustLab', ticker: null }
      ]
    },
    foundations_research: {
      label: 'Foundations, NGOs, and academic institutions in information policy',
      keywords: ['Knight Foundation', 'Pew Research', 'Reuters Institute', 'Shorenstein', 'Tow Center', 'Stanford Internet Observatory', 'Oxford Internet Institute', 'press freedom'],
      tier3: [
        { name: 'Knight Foundation', ticker: null },
        { name: 'Pew Research Center', ticker: null },
        { name: 'Reuters Institute (Oxford)', ticker: null },
        { name: 'Stanford Internet Observatory', ticker: null },
        { name: 'Tow Center for Digital Journalism (Columbia)', ticker: null }
      ]
    },
    cdn_edge_infra: {
      label: 'CDN, edge, and content delivery infrastructure',
      keywords: ['CDN', 'edge', 'content delivery', 'Cloudflare', 'Fastly', 'Akamai', 'distribution', 'caching', 'origin'],
      tier3: [
        { name: 'Cloudflare', ticker: 'NET' },
        { name: 'Fastly', ticker: 'FSLY' },
        { name: 'Akamai Technologies', ticker: 'AKAM' },
        { name: 'Limelight Networks', ticker: 'EGIO' },
        { name: 'Amazon CloudFront (AWS)', ticker: 'AMZN' }
      ]
    },
    advertising_supply: {
      label: 'Digital advertising and ad-tech supply chain',
      keywords: ['ad tech', 'programmatic', 'DSP', 'SSP', 'Google Ads', 'TheTradeDesk', 'Magnite', 'DoubleVerify', 'IAS', 'attribution', 'measurement'],
      tier3: [
        { name: 'The Trade Desk', ticker: 'TTD' },
        { name: 'Alphabet (Google Ads)', ticker: 'GOOGL' },
        { name: 'Meta (Facebook Ads)', ticker: 'META' },
        { name: 'Magnite', ticker: 'MGNI' },
        { name: 'DoubleVerify', ticker: 'DV' }
      ]
    },
    civil_society: {
      label: 'Civil society, press freedom, and information rights orgs',
      keywords: ['ACLU', 'EFF', 'Reporters Without Borders', 'CPJ', 'press freedom', 'free expression', 'whistleblower', 'access now', 'article 19'],
      tier3: [
        { name: 'Electronic Frontier Foundation (EFF)', ticker: null },
        { name: 'Committee to Protect Journalists (CPJ)', ticker: null },
        { name: 'Reporters Without Borders (RSF)', ticker: null },
        { name: 'Access Now', ticker: null },
        { name: 'ACLU Speech, Privacy, and Technology Project', ticker: null }
      ]
    }
  };

  // Map Communication top brain nodes to segments
  var NODE_SEGMENTS = {
    'BROCA':     ['media_publishers', 'creator_platforms'],          // Speech production
    'A1':        ['telecom_carriers', 'creator_platforms'],          // Auditory / podcasts
    'NAcc':      ['advertising_supply', 'creator_platforms'],        // Reward / engagement
    'CC':        ['cdn_edge_infra', 'telecom_carriers'],             // Interconnect / cross-traffic
    'FEF':       ['big_tech_platforms', 'trust_safety_vendors'],     // Attention direction
    'FPN':       ['big_tech_platforms', 'media_publishers'],         // Coordination of channels
    'WERN':      ['media_publishers', 'foundations_research'],       // Comprehension
    'OFC':       ['advertising_supply', 'big_tech_platforms'],       // Value / preference
    'vlPFC':     ['trust_safety_vendors', 'civil_society'],          // Inhibition / moderation
    'dACC':      ['trust_safety_vendors', 'federal_comms_regulators'],// Conflict / policy
    'LANG':      ['media_publishers', 'foundations_research'],       // Language network
    'CBLM':      ['big_tech_platforms'],                             // Fine coordination
    'MGN':       ['telecom_carriers'],                               // Auditory relay
    'V1':        ['big_tech_platforms', 'media_publishers'],         // Visual primary
    'STS':       ['trust_safety_vendors', 'foundations_research'],   // Social perception
    'TPJ':       ['civil_society', 'foundations_research'],          // Perspective taking
    'dlPFC':     ['federal_comms_regulators', 'foundations_research'],// Strategic decision
    'RAPHE':     ['trust_safety_vendors'],                           // Mood tone
    'FG':        ['trust_safety_vendors', 'big_tech_platforms'],     // Recognition / deepfake
    'GABA_GLU':  ['big_tech_platforms']                              // Excitation balance / virality
  };

  var EXCLUSIONS = {
    federal_comms_regulators: ['META', 'GOOGL', 'SNAP', 'RDDT', 'PINS', 'VZ', 'T', 'TMUS', 'CMCSA', 'CHTR', 'NYT', 'NWSA', 'WBD', 'FOXA', 'NET', 'FSLY', 'AKAM', 'TTD', 'MGNI', 'DV', 'AMZN', 'SPOT']
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
    if (rawCompanies.length > 0) companyPool = rawCompanies;
    else {
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
    tier3 = tier3.slice(0, 5);

    var executionTargets = [];
    if (path === 'GRANT-ELIGIBLE') executionTargets = ['Knight Foundation Local News program', 'NSF Convergence Accelerator (Information Integrity)', 'NTIA broadband and digital equity grants', 'DARPA SemaFor (semantic forensics)', 'CPB content and journalism grants'];
    else if (path === 'PATENTABLE') executionTargets = ['Patent attorneys (telecom, signal processing, ML)', 'Platform licensors', 'Standards bodies (IETF, W3C, ITU)', 'Strategic acquirers in trust and safety / ad-tech'];
    else if (path === 'INVESTABLE') executionTargets = ['Media-focused VCs (Lerer Hippeau, Lightspeed)', 'Telecom infrastructure funds', 'Ad-tech / trust-and-safety strategic investors'];

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
    if (segments.length === 0) segments.push('media_publishers');
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

  window.LIMENCommunicationTargetingEngine = { resolveTargets: resolveTargets };
})();
