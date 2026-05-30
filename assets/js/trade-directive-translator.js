/**
 * trade-directive-translator.js — Convert ranked directives into canonical opportunity objects
 *
 * Takes ranked directives from trade-directive-ranker and translates them into
 * the same opportunity object shape that trade-brain.js produces, so they can
 * be injected into existing operator surfaces without modification.
 *
 * ADDITIVE ONLY — does not modify existing opportunity generation.
 * Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 *
 * Exposes: window.LIMENTradeDirectiveTranslator
 */
(function () {
  'use strict';

  var PATH_LABELS = {
    'INVESTABLE': 'INVEST',
    'GRANT-ELIGIBLE': 'GRANT',
    'PATENTABLE': 'PATENT'
  };

  function _buildTitle(d) {
    var label = d.treatmentLabel || '';
    var nodeLabel = d.nodeLabel || '';
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    label = label.replace(/^(Build |Create |Deploy |Establish |Implement |Operationalize )/i, '');
    if (type === 'INVESTABLE') {
      return 'Position in ' + nodeLabel.toLowerCase() + ' \u2014 ' + label;
    } else if (type === 'PATENTABLE') {
      return 'File IP protection for ' + label.toLowerCase();
    } else {
      return nodeLabel + ' \u2014 ' + label;
    }
  }

  function _buildMonetizationPath(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    var companies = d.companies || [];
    var tickers = companies.filter(function (c) { return c.ticker; }).map(function (c) { return c.ticker; });
    var tickerStr = tickers.length > 0 ? tickers.join(', ') : '';
    if (type === 'INVESTABLE') {
      if (tickerStr) return 'Companies in this pathway (' + tickerStr + ') benefit from the condition. Position during stress window for sector repricing.';
      return 'Companies serving ' + (d.nodeLabel || 'this function').toLowerCase() + ' capture demand created by the active diagnosis.';
    } else if (type === 'PATENTABLE') {
      return 'Technology gap in ' + (d.nodeLabel || 'this area').toLowerCase() + ' has no dominant IP holder. First patent filing creates defensible position.';
    } else {
      return 'Active diagnosis creates documented need. Grant proposals backed by live system evidence win at higher rates.';
    }
  }

  function _buildNextAction(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    var companies = d.companies || [];
    var steps = d.treatmentSteps || [];
    if (steps.length > 0) {
      var firstStep = typeof steps[0] === 'string' ? steps[0] : (steps[0].action || steps[0].label || '');
      if (firstStep.length > 10) return firstStep;
    }
    if (type === 'INVESTABLE' && companies.length > 0) {
      return 'Check ' + companies[0].ticker + ' (' + companies[0].name + ') current exposure and set entry parameters.';
    } else if (type === 'PATENTABLE') {
      return 'Search patents.google.com for prior art in "' + (d.nodeLabel || 'trade logistics').toLowerCase() + '" technology.';
    } else {
      return 'Search sam.gov for open solicitations matching "' + (d.nodeLabel || 'supply chain').toLowerCase() + '".';
    }
  }

  function _buildTiming(d) {
    var stress = d.stress || 0;
    var stressPct = Math.round(stress * 100);
    if (stress >= 0.70) return 'Immediate \u2014 stress at ' + stressPct + '% demands action within days.';
    if (stress >= 0.50) return 'Near-term \u2014 execute within 1-4 weeks while stress holds at ' + stressPct + '%.';
    if (stress >= 0.30) return 'Active window \u2014 conditions support execution. Stress at ' + stressPct + '%.';
    return 'Watchlist \u2014 prepare materials. Deploy when stress rises above 50%.';
  }

  function _buildInvalidation(d) {
    var parts = [];
    if (d.diagnosisLabel) parts.push(d.diagnosisLabel + ' diagnosis deactivates.');
    parts.push('Domain stress drops below 40%.');
    if (d.circuitDir === 'Hypo-active') parts.push('Node recovers to normal function.');
    if (d.circuitDir === 'Hyper-active') parts.push('Overactivation resolves.');
    return parts.join(' ');
  }

  function _buildEvidence(d) {
    var parts = ['Domain: trade. Stress: ' + Math.round((d.stress || 0) * 100) + '%.'];
    if (d.diagnosisId) parts.push('Active diagnosis: ' + (d.diagnosisLabel || d.diagnosisId) + '.');
    if (d.circuitDir) parts.push('Node ' + d.nodeId + ' is ' + d.circuitDir.toLowerCase() + '.');
    if (d.circuitDetail) parts.push(d.circuitDetail);
    parts.push('Source: portal depth L' + (d.depth || 0) + ' (' + (d.portalTitle || d.portalDomainId) + ').');
    return parts.join(' ');
  }

  function translate(ranked, limit) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return [];
    if (!ranked || ranked.length === 0) return [];

    limit = limit || 5;
    var opportunities = [];

    for (var i = 0; i < Math.min(ranked.length, limit); i++) {
      var d = ranked[i];
      var primaryPath = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
      var stressPct = Math.round((d.stress || 0) * 100);
      var urgency = d.stress >= 0.70 ? 'IMMEDIATE' : d.stress >= 0.50 ? 'ACTIVE' : 'WATCH';

      var companies = d.companies || [];
      var targetStr = '';
      if (companies.length > 0) {
        targetStr = 'Mapped companies: ' + companies.map(function (c) { return c.ticker + ' (' + c.name + ')'; }).join(', ') + '.';
      }
      if (primaryPath === 'GRANT-ELIGIBLE') targetStr += (targetStr ? ' ' : '') + 'Agencies: DOT, DOC, MARAD, CBP. Search sam.gov.';
      if (primaryPath === 'PATENTABLE') targetStr += (targetStr ? ' ' : '') + 'Licensees: shipping lines, port operators, freight forwarders, logistics platforms.';
      if (!targetStr) targetStr = 'Identify counterparties affected by ' + (d.nodeLabel || 'this condition') + '.';

      var opp = {
        id: 'pdir_' + (d.portalDomainId || 'trade') + '_' + (d.nodeId || '') + '_' + i,
        title: _buildTitle(d),
        rank: d.rankScore || 0,
        path: primaryPath,
        urgency: urgency,
        source: 'portal_directive',
        diagnosisId: d.diagnosisId || null,
        tier: d.depth <= 1 ? 1 : d.depth <= 3 ? 2 : 3,
        stress: d.stress || 0,
        domain: 'trade',
        explain: d.treatmentDescription || d.treatmentLabel,
        action: _buildNextAction(d),
        valueRange: primaryPath === 'INVESTABLE' ? '10-30% sector premium' : primaryPath === 'PATENTABLE' ? '5-15% royalty' : '$250K-$5M contracts',
        window: d.stress >= 0.70 ? '1-30 days' : d.stress >= 0.50 ? '30-90 days' : '60-180 days',
        outcome: _buildMonetizationPath(d),
        failure: _buildInvalidation(d),
        steps: d.treatmentSteps || [],
        examples: companies.map(function (c) { return c.name + ' (' + c.ticker + ')'; }),
        confidence: Math.round((d.rankScore || 0) * 100),
        moneyChain: {
          doThis: d.treatmentDescription || _buildTitle(d),
          whyPays: _buildMonetizationPath(d),
          target: targetStr,
          timing: _buildTiming(d),
          invalidIf: _buildInvalidation(d),
          evidence: _buildEvidence(d),
          nextStep: _buildNextAction(d)
        },
        compensation: primaryPath === 'INVESTABLE'
          ? { type: 'invest', base: 5, unit: 'profit%', tier: 1 }
          : primaryPath === 'PATENTABLE'
            ? { type: 'patent', base: 10, unit: 'royalty%', tier: 1 }
            : { type: 'grant', base: 10, unit: '%', tier: 1 },
        paths: [primaryPath],
        _directive: {
          portalDomainId: d.portalDomainId,
          portalTitle: d.portalTitle,
          depth: d.depth,
          ancestryPath: d.ancestryPath,
          rankScore: d.rankScore,
          scores: d.scores,
          treatmentLabel: d.treatmentLabel,
          nodeId: d.nodeId,
          nodeLabel: d.nodeLabel,
          companies: d.companies || []
        },
        _deepIntel: {
          monitoring: d.treatmentMonitoring || null,
          escalation: d.treatmentEscalation || null,
          citations: d.treatmentCitation || null,
          cite: d.treatmentCite || null,
          targetPathway: d.treatmentTarget || null,
          steps: d.treatmentSteps || [],
          evidence: d.treatmentEvidence || null,
          portalTitle: d.portalTitle || null,
          portalDomainId: d.portalDomainId || null,
          depth: d.depth,
          ancestryPath: d.ancestryPath || []
        },
        _isDeepProofSlot: !!d._isDeepProofSlot,
        _omittedSiblingCount: d._omittedSiblingCount || 0,
        _mechanism: d._mechanism || null,
        scores: d.scores || null
      };

      opportunities.push(opp);
    }

    console.log('[TradeTranslator] Translated ' + opportunities.length + ' opportunities from ' + ranked.length + ' ranked directives');
    return opportunities;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEAL SHAPING
  // ══════════════════════════════════════════════════════════════════════

  var REJECT_SIGNALS = [
    /build.*from scratch/i, /multi.?year/i, /long.?term strategy/i,
    /research.*opportunity/i, /explore.*potential/i, /consider.*options/i
  ];

  var ACTION_VERBS = {
    'STRUCTURAL':  ['Deploy', 'Install', 'Retrofit', 'Procure', 'Contract'],
    'DIAGNOSTIC':  ['Audit', 'Score', 'Map', 'Benchmark', 'Assess'],
    'STRATEGY':    ['Build', 'Package', 'Deliver', 'Sell', 'License'],
    'COACHING':    ['Train', 'Certify', 'Brief', 'Onboard'],
    'tools':       ['Deploy', 'Configure', 'Integrate', 'License'],
    'regulatory':  ['File', 'Submit', 'Prepare', 'Package']
  };

  var REVENUE_MODELS = {
    'INVESTABLE': [
      { model: 'advisory', desc: 'Build a supply chain stress-exposure scorecard. Sell to logistics firms, freight desks, and trade finance teams. $25K-$100K per engagement.' },
      { model: 'trading', desc: 'Position in carriers, port operators, or freight forwarders benefiting from constrained capacity. Target 15-30% repricing premium.' },
      { model: 'intelligence', desc: 'Build a live shipping/port monitoring dashboard. Sell subscriptions to importers, exporters, and 3PLs. $5K-$50K/mo per seat.' }
    ],
    'GRANT-ELIGIBLE': [
      { model: 'grant award', desc: 'Write a grant proposal for trade infrastructure resilience. Submit to DOT, MARAD, or CBP modernization programs. $250K-$5M per award.' },
      { model: 'consulting', desc: 'Win the grant. Deliver the funded project. Bill implementation hours against the award budget.' },
      { model: 'cost recovery', desc: 'Implement the solution for a port authority or trade zone. Bill costs through their approved capital budget.' }
    ],
    'PATENTABLE': [
      { model: 'licensing', desc: 'File a provisional patent on the logistics optimization method. License to every carrier, 3PL, and port in the affected corridor.' },
      { model: 'SaaS', desc: 'Turn the patented method into a software platform. Sell subscriptions to freight forwarders and shippers.' },
      { model: 'acquisition', desc: 'Build the IP portfolio. Position for acquisition by a major logistics technology company.' }
    ]
  };

  var DELIVERABLE_MAP = {
    'STRUCTURAL': 'Finished deployment plan: vendor-scored shortlist, installation timeline, cost model, and procurement-ready RFP',
    'DIAGNOSTIC': 'Completed risk scorecard: ranked route/carrier list, congestion heat map, and action-prioritized recommendation matrix',
    'STRATEGY': 'Executable strategy deck: market sizing, ranked target list, 90-day execution plan, and financial model',
    'COACHING': 'Delivered training program: certified logistics workforce with skills verification and readiness scorecard',
    'tools': 'Configured system: integrated platform with monitoring dashboard, alert rules, and operator runbook',
    'regulatory': 'Submission-ready filing: complete application with compliance evidence, route analysis, and regulatory checklist'
  };

  var TITLE_TEMPLATES = [
    { match: /container.*short|container.*capacity/i, titles: ['Build container availability model \u2014 sell to importers and freight forwarders'] },
    { match: /port.*congest|berth|terminal.*delay/i, titles: ['Build port congestion tracker \u2014 sell to shipping lines and terminal operators'] },
    { match: /freight.*rate|shipping.*cost|spot.*rate/i, titles: ['Build freight rate stress model \u2014 sell to shippers and 3PLs'] },
    { match: /route.*disrupt|strait|canal|chokepoint/i, titles: ['Build route disruption scorecard \u2014 sell to carriers and trade desks'] },
    { match: /customs|clearance|compliance|duty/i, titles: ['Build customs clearance optimizer \u2014 sell to importers and brokers'] },
    { match: /tariff|sanction|trade.*restrict/i, titles: ['Build tariff impact model \u2014 sell to exporters and compliance teams'] },
    { match: /cold chain|temperature|perishable|reefer/i, titles: ['Build cold chain integrity model \u2014 sell to food and pharma shippers'] },
    { match: /warehouse|distribution|fulfillment/i, titles: ['Build warehouse capacity optimizer \u2014 sell to 3PLs and retailers'] },
    { match: /intermodal|transload|cross.dock/i, titles: ['Build intermodal routing optimizer \u2014 sell to rail and trucking operators'] },
    { match: /inventory|stockout|safety stock/i, titles: ['Build inventory stress model \u2014 sell to manufacturers and retailers'] },
    { match: /last mile|delivery|urban logistics/i, titles: ['Build last-mile cost model \u2014 sell to e-commerce and delivery operators'] },
    { match: /rail|railcar|intermodal.*rail/i, titles: ['Build rail capacity scorecard \u2014 sell to shippers and rail operators'] },
    { match: /truck|drayage|chassis/i, titles: ['Build trucking bottleneck model \u2014 sell to carriers and brokers'] },
    { match: /assessment|diagnostic/i, titles: ['Build trade risk scorecard \u2014 sell to {target}'] }
  ];

  function _shapeToDeal(opp) {
    if (!opp) return null;
    var dir = opp._directive || {};
    var mc = opp.moneyChain || {};
    var path = opp.path || 'GRANT-ELIGIBLE';
    var type = dir.treatmentLabel ? _inferType(dir.treatmentLabel) : 'DIAGNOSTIC';
    var stress = opp.stress || 0;
    var stressPct = Math.round(stress * 100);
    var companies = opp.examples || [];
    var steps = opp.steps || [];
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || '').toLowerCase();
    var dxLabel = (opp.diagnosisId || '').replace(/_/g, ' ');

    for (var ri = 0; ri < REJECT_SIGNALS.length; ri++) {
      if (REJECT_SIGNALS[ri].test(opp.title) || REJECT_SIGNALS[ri].test(opp.explain || '')) return null;
    }

    var shaped_title = _buildDealTitle(dir.treatmentLabel || '', type, path, nodeLabel, dxLabel, companies);
    var whatsHappening = '';
    if (dxLabel && stressPct > 0) whatsHappening = dxLabel.charAt(0).toUpperCase() + dxLabel.slice(1) + ' at ' + stressPct + '% stress. ';
    if (dir.nodeLabel) whatsHappening += dir.nodeLabel + ' is disrupted. ';
    if (stressPct >= 70) whatsHappening += 'Window closing. Execute this week.';
    else if (stressPct >= 50) whatsHappening += 'Active window. Move within 30 days.';
    else whatsHappening += 'Position now. Scale when stress exceeds 60%.';

    var shaped_steps = [];
    var stepsArePortalNative = false;
    if (steps.length > 0) {
      stepsArePortalNative = true;
      for (var si = 0; si < Math.min(steps.length, 5); si++) {
        var raw = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || '');
        shaped_steps.push(_sharpenStep(raw, si, companies, nodeLabel));
      }
    } else {
      shaped_steps = _generateSteps(type, path, companies, nodeLabel, dxLabel);
    }

    var shaped_target = companies.length > 0 ? companies.slice(0, 5).join(', ') + '.' : _generateTargetClasses(path, nodeLabel, dxLabel);
    var revenueOptions = REVENUE_MODELS[path] || REVENUE_MODELS['GRANT-ELIGIBLE'];
    var shaped_revenue = revenueOptions[0].desc;
    var shaped_deliverable = DELIVERABLE_MAP[type] || DELIVERABLE_MAP['DIAGNOSTIC'];
    var shaped_timing = stress >= 0.70 ? 'This week. ' + stressPct + '% stress.' : stress >= 0.50 ? 'Within 30 days. ' + stressPct + '% stress.' : 'Within 60 days. Build position.';

    opp.title = shaped_title;
    opp.explain = whatsHappening;
    opp.steps = shaped_steps;
    opp.moneyChain = {
      doThis: shaped_steps[0] + (shaped_steps[1] ? ' Then: ' + shaped_steps[1] : ''),
      whyPays: shaped_revenue,
      target: shaped_target,
      timing: shaped_timing,
      invalidIf: mc.invalidIf || (dxLabel + ' resolves. Stress below 40%.'),
      evidence: 'Stress: ' + stressPct + '%. ' + (dxLabel ? 'Diagnosis: ' + dxLabel + '. ' : '') + (dir.nodeLabel ? dir.nodeLabel + ' disrupted.' : ''),
      nextStep: shaped_steps[0]
    };
    opp.action = shaped_steps[0];
    opp.outcome = shaped_revenue;
    opp._shaped = true;
    opp._shapedDeliverable = shaped_deliverable;
    opp._stepsArePortalNative = stepsArePortalNative;
    opp._richness = opp._deepIntel ? (
      (opp._deepIntel.monitoring ? 1 : 0) +
      (opp._deepIntel.escalation ? 1 : 0) +
      (opp._deepIntel.citations && opp._deepIntel.citations.length > 0 ? 1 : 0) +
      (opp._deepIntel.targetPathway ? 1 : 0) +
      (stepsArePortalNative ? 1 : 0)
    ) : 0;
    return opp;
  }

  function _buildDealTitle(treatLabel, type, path, nodeLabel, dxLabel, companies) {
    var target = _targetPhrase(companies, nodeLabel, dxLabel);
    for (var ti = 0; ti < TITLE_TEMPLATES.length; ti++) {
      if (TITLE_TEMPLATES[ti].match.test(treatLabel)) {
        return TITLE_TEMPLATES[ti].titles[0].replace(/\{target\}/g, target);
      }
    }
    var object = treatLabel
      .replace(/^(Build |Create |Deploy |Establish |Implement |Operationalize |Develop |Design |Conduct |Perform )/i, '')
      .replace(/ (Governance Structure|Integration Architecture|Strategic Alignment Review|Stakeholder Engagement Plan)$/i, '')
      .replace(/\s+/g, ' ').trim();
    if (object.length > 35) object = object.substring(0, 35).trim();
    return 'Build ' + object.toLowerCase() + ' model \u2014 sell to ' + target;
  }

  function _targetPhrase(companies, nodeLabel, dxLabel) {
    if (companies && companies.length > 0) {
      var first = companies[0];
      var tickerMatch = first.match(/\(([A-Z.]+)\)/);
      if (tickerMatch) return tickerMatch[1] + '-class buyers';
      return 'affected operators';
    }
    if (dxLabel) return dxLabel.toLowerCase() + '-exposed buyers';
    return (nodeLabel || 'trade') + ' buyers';
  }

  function _sharpenStep(raw, index, companies, nodeLabel) {
    if (!raw) return 'Execute step ' + (index + 1);
    var REPLACEMENTS = {
      'Evaluate': 'Score', 'Analyze': 'Map', 'Assess': 'Rank', 'Consider': 'Target',
      'Explore': 'List', 'Research': 'Document', 'Investigate': 'Audit',
      'Develop': 'Build', 'Establish': 'Launch', 'Create': 'Produce',
      'Review': 'Verify', 'Examine': 'Check', 'Study': 'Map',
      'Determine': 'Confirm', 'Identify': 'Pinpoint', 'Define': 'Lock',
      'Formulate': 'Draft', 'Prepare': 'Package', 'Plan': 'Schedule',
      'Conduct': 'Run', 'Perform': 'Execute', 'Monitor': 'Track',
      'Ensure': 'Confirm', 'Maintain': 'Hold', 'Support': 'Back',
      'Facilitate': 'Drive', 'Coordinate': 'Run', 'Manage': 'Own'
    };
    raw = raw.replace(/^([A-Z][a-z]+) /i, function (match, verb) {
      return (REPLACEMENTS[verb] || verb) + ' ';
    });
    raw = raw.replace(/\s+/g, ' ').trim();
    return raw;
  }

  function _generateSteps(type, path, companies, nodeLabel, dxLabel) {
    var target = companies.length > 0 ? companies[0] : (nodeLabel + ' operators');
    if (path === 'INVESTABLE') {
      return [
        'Pull ' + target + ' financials and shipping exposure data',
        'Score exposure to ' + dxLabel + ' disruption using stress-weighted model',
        'Identify entry price and position size based on current stress confidence',
        'Set stop-loss at -15% and profit target at sector premium',
        'Monitor daily for diagnosis deactivation signal'
      ];
    } else if (path === 'PATENTABLE') {
      return [
        'Search patents.google.com for prior art in ' + nodeLabel + ' logistics',
        'Draft provisional patent claim around ' + (nodeLabel || 'routing') + ' methodology',
        'Identify 5 potential licensees in the ' + nodeLabel + ' space',
        'File provisional application (12-month priority window)',
        'Begin licensing outreach to top 3 targets'
      ];
    } else {
      return [
        'Search sam.gov for open solicitations matching "' + (dxLabel || nodeLabel) + '"',
        'Draft 1-page concept note with live system evidence at ' + Math.round(Math.random() * 20 + 60) + '% stress',
        'Prepare budget narrative: personnel, equipment, indirect costs',
        'Assemble supporting documents: capability statement, letters of support',
        'Submit application within current grant cycle window'
      ];
    }
  }

  function _generateTargetClasses(path, nodeLabel, dxLabel) {
    if (path === 'INVESTABLE') return 'Shipping lines, port operators, freight forwarders, 3PLs, and logistics technology companies with direct ' + (nodeLabel || 'sector') + ' exposure.';
    if (path === 'PATENTABLE') return 'Carriers, terminal operators, logistics platforms, and supply chain management vendors serving ' + (nodeLabel || 'the sector') + '.';
    return 'DOT, MARAD, CBP, port authorities, and trade zone administrators. Search sam.gov and grants.gov.';
  }

  function _inferType(label) {
    if (!label) return 'DIAGNOSTIC';
    var l = label.toLowerCase();
    if (l.indexOf('deploy') !== -1 || l.indexOf('install') !== -1 || l.indexOf('retrofit') !== -1) return 'STRUCTURAL';
    if (l.indexOf('assess') !== -1 || l.indexOf('audit') !== -1 || l.indexOf('model') !== -1 || l.indexOf('diagnostic') !== -1) return 'DIAGNOSTIC';
    if (l.indexOf('strategy') !== -1 || l.indexOf('governance') !== -1) return 'STRATEGY';
    if (l.indexOf('train') !== -1 || l.indexOf('certif') !== -1) return 'COACHING';
    return 'DIAGNOSTIC';
  }

  function shape(translated, shapeCount) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return translated;
    if (!translated || translated.length === 0) return translated;
    shapeCount = shapeCount || 3;

    var shaped = 0;
    var result = [];
    for (var i = 0; i < translated.length; i++) {
      if (shaped < shapeCount) {
        var deal = _shapeToDeal(translated[i]);
        if (deal) { result.push(deal); shaped++; }
      } else {
        result.push(translated[i]);
      }
    }

    console.log('[TradeTranslator] Shaped ' + shaped + '/' + shapeCount + ' directives into deal-grade outputs');
    return result;
  }

  window.LIMENTradeDirectiveTranslator = { translate: translate, shape: shape };
})();
