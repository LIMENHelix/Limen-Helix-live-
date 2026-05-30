/**
 * governance-directive-translator.js — Convert ranked Governance directives into opportunity objects
 * Carries _omittedSiblingCount through. Exposes: window.LIMENGovernanceDirectiveTranslator
 */
(function () {
  'use strict';

  var PATH_LABELS = { 'INVESTABLE': 'INVEST', 'GRANT-ELIGIBLE': 'GRANT', 'PATENTABLE': 'PATENT' };

  function _buildTitle(d) {
    var label = d.treatmentLabel || '';
    var nodeLabel = d.nodeLabel || '';
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    label = label.replace(/^(Build |Create |Deploy |Establish |Implement |Operationalize )/i, '');
    if (type === 'INVESTABLE') return 'Position in ' + nodeLabel.toLowerCase() + ' \u2014 ' + label;
    if (type === 'PATENTABLE') return 'File IP protection for ' + label.toLowerCase();
    return nodeLabel + ' \u2014 ' + label;
  }

  function _buildMonetizationPath(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    var companies = d.companies || [];
    var tickers = companies.filter(function (c) { return c.ticker; }).map(function (c) { return c.ticker; });
    var tickerStr = tickers.length > 0 ? tickers.join(', ') : '';
    if (type === 'INVESTABLE') {
      if (tickerStr) return 'Firms in this pathway (' + tickerStr + ') benefit from the governance condition. Position during stress window for repricing.';
      return 'Firms serving ' + (d.nodeLabel || 'this function').toLowerCase() + ' capture demand created by the active diagnosis.';
    }
    if (type === 'PATENTABLE') return 'Governance gap in ' + (d.nodeLabel || 'this area').toLowerCase() + ' has no dominant IP holder. First filing creates defensible edtech position.';
    return 'Active diagnosis creates documented governance need. Grant proposals backed by live system evidence win at higher rates.';
  }

  function _buildNextAction(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    var companies = d.companies || [];
    var steps = d.treatmentSteps || [];
    if (steps.length > 0) {
      var firstStep = typeof steps[0] === 'string' ? steps[0] : (steps[0].action || steps[0].label || '');
      if (firstStep.length > 10) return firstStep;
    }
    if (type === 'INVESTABLE' && companies.length > 0) return 'Check ' + companies[0].ticker + ' (' + companies[0].name + ') current governance exposure.';
    if (type === 'PATENTABLE') return 'Search patents.google.com for prior art in "' + (d.nodeLabel || 'edtech').toLowerCase() + '" governance.';
    return 'Search grants.gov, ED.gov, IES grants for solicitations matching "' + (d.nodeLabel || 'governance').toLowerCase() + '".';
  }

  function _buildTiming(d) {
    var stress = d.stress || 0;
    var stressPct = Math.round(stress * 100);
    if (stress >= 0.70) return 'Immediate \u2014 stress at ' + stressPct + '% demands action within days.';
    if (stress >= 0.50) return 'Near-term \u2014 execute within 1-4 weeks.';
    if (stress >= 0.30) return 'Active window \u2014 conditions support execution. Stress at ' + stressPct + '%.';
    return 'Watchlist \u2014 prepare materials. Deploy when stress rises above 50%.';
  }

  function _buildInvalidation(d) {
    var parts = [];
    if (d.diagnosisLabel) parts.push(d.diagnosisLabel + ' diagnosis deactivates.');
    parts.push('Domain stress drops below 40%.');
    return parts.join(' ');
  }

  function _buildEvidence(d) {
    var parts = ['Domain: governance. Stress: ' + Math.round((d.stress || 0) * 100) + '%.'];
    if (d.diagnosisId) parts.push('Active diagnosis: ' + (d.diagnosisLabel || d.diagnosisId) + '.');
    if (d.circuitDir) parts.push('Node ' + d.nodeId + ' is ' + d.circuitDir.toLowerCase() + '.');
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
      var urgency = d.stress >= 0.70 ? 'IMMEDIATE' : d.stress >= 0.50 ? 'ACTIVE' : 'WATCH';

      var companies = d.companies || [];
      var targetStr = '';
      if (companies.length > 0) targetStr = 'Mapped firms: ' + companies.map(function (c) { return c.ticker + ' (' + c.name + ')'; }).join(', ') + '.';
      if (primaryPath === 'GRANT-ELIGIBLE') targetStr += (targetStr ? ' ' : '') + 'Agencies: US Dept of Governance, IES, NSF EHR, Gates Foundation, Walton, Carnegie. Search grants.gov, ies.ed.gov.';
      if (primaryPath === 'PATENTABLE') targetStr += (targetStr ? ' ' : '') + 'Licensees: edtech vendors, LMS providers, assessment companies, K-12 districts, university IT.';
      if (!targetStr) targetStr = 'Identify counterparties affected by ' + (d.nodeLabel || 'this condition') + '.';

      opportunities.push({
        id: 'pdir_' + (d.portalDomainId || 'governance') + '_' + (d.nodeId || '') + '_' + i,
        title: _buildTitle(d),
        rank: d.rankScore || 0,
        path: primaryPath,
        urgency: urgency,
        source: 'portal_directive',
        diagnosisId: d.diagnosisId || null,
        tier: d.depth <= 1 ? 1 : d.depth <= 3 ? 2 : 3,
        stress: d.stress || 0,
        domain: 'governance',
        explain: d.treatmentDescription || d.treatmentLabel,
        action: _buildNextAction(d),
        valueRange: primaryPath === 'INVESTABLE' ? '10-25% sector premium' : primaryPath === 'PATENTABLE' ? '5-15% royalty' : '$250K-$5M governance grants',
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
        compensation: primaryPath === 'INVESTABLE' ? { type: 'invest', base: 5, unit: 'profit%', tier: 1 } : primaryPath === 'PATENTABLE' ? { type: 'patent', base: 10, unit: 'royalty%', tier: 1 } : { type: 'grant', base: 10, unit: '%', tier: 1 },
        paths: [primaryPath],
        _directive: {
          portalDomainId: d.portalDomainId, portalTitle: d.portalTitle,
          depth: d.depth, ancestryPath: d.ancestryPath,
          rankScore: d.rankScore, scores: d.scores,
          treatmentLabel: d.treatmentLabel, nodeId: d.nodeId,
          nodeLabel: d.nodeLabel, companies: d.companies || []
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
          depth: d.depth, ancestryPath: d.ancestryPath || []
        },
        _isDeepProofSlot: !!d._isDeepProofSlot,
        _omittedSiblingCount: d._omittedSiblingCount || 0,
        _mechanism: d._mechanism || null,
        scores: d.scores || null
      });
    }
    console.log('[GovernanceTranslator] Translated ' + opportunities.length);
    return opportunities;
  }

  // ── DEAL SHAPING ──

  var REJECT_SIGNALS = [/build.*from scratch/i, /multi.?year/i, /long.?term strategy/i, /research.*opportunity/i, /explore.*potential/i, /consider.*options/i];

  var REVENUE_MODELS = {
    'INVESTABLE': [
      { model: 'advisory', desc: 'Build a governance and political risk scorecard. Sell to corporate boards, sovereign wealth funds, family offices, multilaterals, and NGOs with policy exposure. $50K-$500K per engagement.' },
      { model: 'trading', desc: 'Position in companies and ETFs exposed to regulatory cycles, election outcomes, sovereign debt risk, and policy shocks. Track event-driven repricing windows.' },
      { model: 'intelligence', desc: 'Build a live policy / regulatory / election monitoring dashboard. Sell to government affairs teams, lobbying firms, NGOs, and corporate strategy desks.' }
    ],
    'GRANT-ELIGIBLE': [
      { model: 'grant award', desc: 'Write a democracy / governance / institutional resilience proposal. Submit to NED, USAID DRG, NDI, IRI, Open Society Foundations, Hewlett Foundation, Carnegie Endowment, Ford Foundation. $250K-$5M per award.' },
      { model: 'consulting', desc: 'Win the grant. Deliver the funded democracy or governance program. Bill implementation hours.' },
      { model: 'cost recovery', desc: 'Deploy the program at a partner government agency, NGO, or international organization. Bill through approved program budgets.' }
    ],
    'PATENTABLE': [
      { model: 'licensing', desc: 'File patents on novel govtech, civic-tech, or election security tools. License to civic-tech vendors and election authorities.' },
      { model: 'SaaS', desc: 'Turn the patented method into a govtech platform. Sell subscriptions to government agencies, lobbyists, and policy researchers.' },
      { model: 'acquisition', desc: 'Build the IP portfolio. Position for acquisition by Tyler Technologies, Granicus, Civic Plus, or other govtech consolidators.' }
    ]
  };

  var TITLE_TEMPLATES = [
    { match: /capture|revolving door|oligarch|special interest/i, titles: ['Build a regulatory capture monitoring service \u2014 sell to oversight orgs and watchdog groups'] },
    { match: /paralysis|gridlock|deadlock|shutdown|filibuster/i, titles: ['Build a policy gridlock impact tracker \u2014 sell to lobbyists and corporate government affairs'] },
    { match: /trust|legitimacy|approval|disillusion/i, titles: ['Build a public trust / legitimacy monitoring platform \u2014 sell to political campaigns and NGOs'] },
    { match: /corruption|bribe|kickback|fraud|graft|self-dealing/i, titles: ['Build an anti-corruption investigation platform \u2014 sell to journalists, NGOs, and oversight bodies'] },
    { match: /constitutional|separation of powers|judicial|court packing|emergency power/i, titles: ['Build a constitutional risk monitoring service \u2014 sell to legal scholars, foundations, and democracy NGOs'] },
    { match: /election|voter|ballot|gerrymander|redistrict/i, titles: ['Build an election integrity / voter access platform \u2014 sell to election authorities and civil rights orgs'] },
    { match: /oversight|inspector general|whistleblower|gao|inquiry/i, titles: ['Build an oversight and inspector general support platform \u2014 sell to IG offices and Congressional staff'] },
    { match: /diplomacy|sanction|embargo|treaty|bilateral/i, titles: ['Build a diplomatic / sanctions intelligence platform \u2014 sell to corporate compliance and foreign policy desks'] },
    { match: /civil liberty|civil rights|surveillance|press freedom|protest/i, titles: ['Build a civil liberties monitoring service \u2014 sell to ACLU, EFF, foundations, journalist orgs'] },
    { match: /debt ceiling|fiscal|austerity|deficit|bailout|sovereign debt/i, titles: ['Build a sovereign debt and fiscal risk service \u2014 sell to bond investors and rating agencies'] },
    { match: /assessment|diagnostic/i, titles: ['Build a governance risk scorecard \u2014 sell to {target}'] }
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
        shaped_steps.push(_sharpenStep(raw, si));
      }
    } else {
      shaped_steps = _generateSteps(type, path, companies, nodeLabel, dxLabel);
    }

    var shaped_target = companies.length > 0 ? companies.slice(0, 5).join(', ') + '.' : _generateTargetClasses(path, nodeLabel, dxLabel);
    var revenueOptions = REVENUE_MODELS[path] || REVENUE_MODELS['GRANT-ELIGIBLE'];
    var shaped_revenue = revenueOptions[0].desc;

    opp.title = shaped_title;
    opp.explain = whatsHappening;
    opp.steps = shaped_steps;
    opp.moneyChain = {
      doThis: shaped_steps[0] + (shaped_steps[1] ? ' Then: ' + shaped_steps[1] : ''),
      whyPays: shaped_revenue,
      target: shaped_target,
      timing: stress >= 0.70 ? 'This week. ' + stressPct + '% stress.' : stress >= 0.50 ? 'Within 30 days. ' + stressPct + '% stress.' : 'Within 60 days. Build position.',
      invalidIf: mc.invalidIf || (dxLabel + ' resolves. Stress below 40%.'),
      evidence: 'Stress: ' + stressPct + '%. ' + (dxLabel ? 'Diagnosis: ' + dxLabel + '. ' : '') + (dir.nodeLabel ? dir.nodeLabel + ' disrupted.' : ''),
      nextStep: shaped_steps[0]
    };
    opp.action = shaped_steps[0];
    opp.outcome = shaped_revenue;
    opp._shaped = true;
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
      if (TITLE_TEMPLATES[ti].match.test(treatLabel)) return TITLE_TEMPLATES[ti].titles[0].replace(/\{target\}/g, target);
    }
    var object = treatLabel.replace(/^(Build |Create |Deploy |Establish |Implement |Operationalize |Develop |Design |Conduct |Perform )/i, '').replace(/\s+/g, ' ').trim();
    if (object.length > 35) object = object.substring(0, 35).trim();
    return 'Build ' + object.toLowerCase() + ' tool \u2014 sell to ' + target;
  }

  function _targetPhrase(companies, nodeLabel, dxLabel) {
    if (companies && companies.length > 0) {
      var first = companies[0];
      var tickerMatch = first.match(/\(([A-Z.]+)\)/);
      if (tickerMatch) return tickerMatch[1] + '-class buyers';
      return 'affected school systems';
    }
    if (dxLabel) return dxLabel.toLowerCase() + '-exposed districts';
    return (nodeLabel || 'governance') + ' decision-makers';
  }

  function _sharpenStep(raw, index) {
    if (!raw) return 'Execute step ' + (index + 1);
    var REPLACEMENTS = { 'Evaluate': 'Score', 'Analyze': 'Map', 'Assess': 'Rank', 'Consider': 'Target', 'Explore': 'List', 'Research': 'Document', 'Investigate': 'Audit', 'Develop': 'Build', 'Establish': 'Launch', 'Create': 'Produce', 'Review': 'Verify', 'Examine': 'Check', 'Study': 'Map', 'Determine': 'Confirm', 'Identify': 'Pinpoint', 'Define': 'Lock', 'Formulate': 'Draft', 'Prepare': 'Package', 'Plan': 'Schedule', 'Conduct': 'Run', 'Perform': 'Execute' };
    raw = raw.replace(/^([A-Z][a-z]+) /i, function (match, verb) { return (REPLACEMENTS[verb] || verb) + ' '; });
    return raw.replace(/\s+/g, ' ').trim();
  }

  function _generateSteps(type, path, companies, nodeLabel, dxLabel) {
    var target = companies.length > 0 ? companies[0] : (nodeLabel + ' districts');
    if (path === 'INVESTABLE') {
      return [
        'Pull ' + target + ' enrollment, revenue, and ESSER spending from public filings',
        'Score exposure to ' + dxLabel + ' using stress-weighted governance model',
        'Identify entry price and position size based on current stress confidence',
        'Set stop-loss at -15% and profit target at sector premium',
        'Monitor weekly for diagnosis deactivation signal'
      ];
    }
    if (path === 'PATENTABLE') {
      return [
        'Search patents.google.com for prior art in ' + nodeLabel + ' edtech',
        'Draft provisional patent claim around ' + (nodeLabel || 'learning method') + ' approach',
        'Identify 5 potential licensees in LMS / assessment / district SaaS space',
        'File provisional application (12-month priority window)',
        'Begin licensing outreach to top 3 targets'
      ];
    }
    return [
      'Search grants.gov, ies.ed.gov, NSF EHR for solicitations matching "' + (dxLabel || nodeLabel) + '"',
      'Draft 1-page concept note with live system evidence at ' + Math.round(Math.random() * 20 + 60) + '% stress',
      'Prepare budget narrative: personnel, governance, indirect costs',
      'Assemble supporting documents: capability statement, letters of support',
      'Submit application within current grant cycle window'
    ];
  }

  function _generateTargetClasses(path, nodeLabel, dxLabel) {
    if (path === 'INVESTABLE') return 'EdTech vendors, LMS providers, assessment companies, online program managers, higher-ed services with direct ' + (nodeLabel || 'sector') + ' exposure.';
    if (path === 'PATENTABLE') return 'LMS providers (Canvas, Schoology, PowerSchool), assessment companies (NWEA, Curriculum Associates), district SaaS, instructional content publishers.';
    return 'US Department of Governance, IES (Institute of Governance Sciences), NSF EHR, NIH, Gates Foundation, Walton Family Foundation, Carnegie Corporation. Search grants.gov, ies.ed.gov.';
  }

  function _inferType(label) {
    if (!label) return 'DIAGNOSTIC';
    var l = label.toLowerCase();
    if (l.indexOf('deploy') !== -1 || l.indexOf('install') !== -1 || l.indexOf('implement') !== -1) return 'STRUCTURAL';
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
      if (shaped < shapeCount) { var deal = _shapeToDeal(translated[i]); if (deal) { result.push(deal); shaped++; } }
      else result.push(translated[i]);
    }
    console.log('[GovernanceTranslator] Shaped ' + shaped + '/' + shapeCount);
    return result;
  }

  window.LIMENGovernanceDirectiveTranslator = { translate: translate, shape: shape };
})();
