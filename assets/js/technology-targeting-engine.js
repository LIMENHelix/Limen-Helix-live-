/**
 * technology-targeting-engine.js — Context-aware targeting for promoted Technology directives
 * Exposes: window.LIMENTechnologyTargetingEngine
 */
(function () {
  'use strict';

  var SEGMENTS = {
    federal_tech_agencies: {
      label: 'Federal technology / security agencies',
      keywords: ['CISA', 'NSA', 'DARPA', 'IARPA', 'NIST', 'NSF CISE', 'DHS', 'FBI Cyber', 'DoD', 'USCYBERCOM', 'federal AI', 'SBIR', 'STTR'],
      tier3: [
        { name: 'CISA (Cybersecurity and Infrastructure Security Agency)', ticker: null },
        { name: 'DARPA (Defense Advanced Research Projects Agency)', ticker: null },
        { name: 'NIST (National Institute of Standards and Technology)', ticker: null },
        { name: 'NSF CISE (Computer and Information Science and Engineering)', ticker: null },
        { name: 'NSA / USCYBERCOM', ticker: null }
      ]
    },
    hyperscalers: {
      label: 'Hyperscale cloud and platform providers',
      keywords: ['AWS', 'Azure', 'GCP', 'Google Cloud', 'Oracle Cloud', 'hyperscaler', 'cloud provider', 'region', 'availability zone'],
      tier3: [
        { name: 'Amazon Web Services (AWS)', ticker: 'AMZN' },
        { name: 'Microsoft Azure', ticker: 'MSFT' },
        { name: 'Google Cloud Platform', ticker: 'GOOGL' },
        { name: 'Oracle Cloud Infrastructure', ticker: 'ORCL' },
        { name: 'IBM Cloud', ticker: 'IBM' }
      ]
    },
    cybersecurity_vendors: {
      label: 'Cybersecurity product and service vendors',
      keywords: ['CrowdStrike', 'Palo Alto', 'SentinelOne', 'Zscaler', 'cybersecurity', 'EDR', 'XDR', 'SIEM', 'SOC', 'zero-trust', 'MSSP', 'SASE'],
      tier3: [
        { name: 'CrowdStrike Holdings', ticker: 'CRWD' },
        { name: 'Palo Alto Networks', ticker: 'PANW' },
        { name: 'Zscaler', ticker: 'ZS' },
        { name: 'SentinelOne', ticker: 'S' },
        { name: 'Fortinet', ticker: 'FTNT' }
      ]
    },
    ai_infrastructure: {
      label: 'AI / ML infrastructure and foundation model providers',
      keywords: ['OpenAI', 'Anthropic', 'GPU', 'LLM', 'foundation model', 'inference', 'training', 'AI infrastructure', 'model', 'Hugging Face', 'NVIDIA'],
      tier3: [
        { name: 'NVIDIA', ticker: 'NVDA' },
        { name: 'Microsoft (OpenAI partnership)', ticker: 'MSFT' },
        { name: 'Google DeepMind', ticker: 'GOOGL' },
        { name: 'Anthropic', ticker: null },
        { name: 'OpenAI', ticker: null }
      ]
    },
    semiconductor: {
      label: 'Semiconductor and chip supply chain',
      keywords: ['chip', 'semiconductor', 'TSMC', 'foundry', 'fabrication', 'lithography', 'Taiwan', 'ASML', 'wafer', 'node'],
      tier3: [
        { name: 'NVIDIA', ticker: 'NVDA' },
        { name: 'Taiwan Semiconductor Manufacturing (TSMC)', ticker: 'TSM' },
        { name: 'Advanced Micro Devices', ticker: 'AMD' },
        { name: 'ASML Holding', ticker: 'ASML' },
        { name: 'Intel', ticker: 'INTC' }
      ]
    },
    big_tech_platforms: {
      label: 'Big tech platforms and consumer infrastructure',
      keywords: ['Meta', 'Apple', 'Alphabet', 'Amazon', 'Microsoft', 'platform', 'app store', 'social', 'search', 'marketplace'],
      tier3: [
        { name: 'Apple', ticker: 'AAPL' },
        { name: 'Alphabet (Google)', ticker: 'GOOGL' },
        { name: 'Meta Platforms', ticker: 'META' },
        { name: 'Amazon', ticker: 'AMZN' },
        { name: 'Microsoft', ticker: 'MSFT' }
      ]
    },
    enterprise_saas: {
      label: 'Enterprise SaaS and data platforms',
      keywords: ['Salesforce', 'ServiceNow', 'Snowflake', 'Databricks', 'Workday', 'SaaS', 'enterprise software', 'ERP', 'CRM'],
      tier3: [
        { name: 'Salesforce', ticker: 'CRM' },
        { name: 'ServiceNow', ticker: 'NOW' },
        { name: 'Snowflake', ticker: 'SNOW' },
        { name: 'Databricks', ticker: null },
        { name: 'Workday', ticker: 'WDAY' }
      ]
    },
    devtools_platforms: {
      label: 'Developer tools, infrastructure, and DevOps platforms',
      keywords: ['GitHub', 'GitLab', 'HashiCorp', 'Datadog', 'Cloudflare', 'Vercel', 'devtools', 'observability', 'CI/CD', 'kubernetes'],
      tier3: [
        { name: 'Cloudflare', ticker: 'NET' },
        { name: 'Datadog', ticker: 'DDOG' },
        { name: 'GitLab', ticker: 'GTLB' },
        { name: 'HashiCorp', ticker: null },
        { name: 'MongoDB', ticker: 'MDB' }
      ]
    },
    regulators_standards: {
      label: 'Technology regulators and standards bodies',
      keywords: ['FTC', 'FCC', 'DOJ', 'EU AI Act', 'GDPR', 'ISO 27001', 'NIST CSF', 'SOC 2', 'FedRAMP', 'antitrust'],
      tier3: [
        { name: 'FTC (Federal Trade Commission)', ticker: null },
        { name: 'FCC (Federal Communications Commission)', ticker: null },
        { name: 'European Commission (EU AI Act)', ticker: null },
        { name: 'NIST Cybersecurity Framework', ticker: null },
        { name: 'FedRAMP Program Management Office', ticker: null }
      ]
    },
    tech_investors: {
      label: 'Technology VCs, growth equity, and strategic investors',
      keywords: ['VC', 'venture', 'a16z', 'Sequoia', 'Founders Fund', 'Tiger', 'Thrive', 'In-Q-Tel', 'corporate venture', 'growth equity'],
      tier3: [
        { name: 'Andreessen Horowitz (a16z)', ticker: null },
        { name: 'Sequoia Capital', ticker: null },
        { name: 'Founders Fund', ticker: null },
        { name: 'In-Q-Tel', ticker: null },
        { name: 'NVIDIA NVentures', ticker: 'NVDA' }
      ]
    }
  };

  // Map Technology top brain nodes to segments
  var NODE_SEGMENTS = {
    'dlPFC':     ['ai_infrastructure', 'cybersecurity_vendors'],      // Strategic AI decision
    'M1':        ['devtools_platforms'],                              // Action execution / CI/CD
    'FPN':       ['hyperscalers', 'enterprise_saas'],                 // Coordination / cloud
    'NEOCER':    ['ai_infrastructure'],                               // Higher processing / neural nets
    'CeA':       ['cybersecurity_vendors'],                           // Threat response
    'DMN':       ['big_tech_platforms'],                              // Default / platform layer
    'CC':        ['hyperscalers', 'devtools_platforms'],              // Interconnect / integration
    'THAL':      ['hyperscalers'],                                    // Routing / relay
    'STRI':      ['ai_infrastructure'],                               // Reward / model training
    'HIPP':      ['enterprise_saas'],                                 // Memory / data platforms
    'FG':        ['ai_infrastructure'],                               // Recognition / computer vision
    'ECN':       ['cybersecurity_vendors'],                           // Executive control / zero-trust
    'FORN':      ['enterprise_saas'],                                 // Data pipelines
    'PRECUNEUS': ['big_tech_platforms'],                              // Reflection / social
    'CBLM':      ['devtools_platforms'],                              // Fine motor / tooling
    'S1':        ['cybersecurity_vendors'],                           // Sensory / detection
    'dACC':      ['cybersecurity_vendors', 'regulators_standards'],   // Conflict / compliance
    'TPJ':       ['big_tech_platforms'],                              // Perspective / social platforms
    'MGN':       ['devtools_platforms'],                              // Relay / middleware
    'UNC':       ['enterprise_saas']                                  // Integration / CRM
  };

  var EXCLUSIONS = {
    federal_tech_agencies: ['CRWD', 'PANW', 'ZS', 'S', 'FTNT', 'NVDA', 'AMZN', 'MSFT', 'GOOGL', 'META', 'AAPL']
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
    if (path === 'INVESTABLE') executionTargets = ['Tech-focused VCs', 'CISO advisory boards', 'Corporate ventures (NVentures, M12, GV)'];
    else if (path === 'RESEARCHABLE') executionTargets = ['NIST publications portal', 'arXiv CS section', 'IEEE Xplore and ACM Digital Library', 'Domain-specific research databases'];

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
    if (segments.length === 0) segments.push('enterprise_saas');
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

  window.LIMENTechnologyTargetingEngine = { resolveTargets: resolveTargets };
})();
