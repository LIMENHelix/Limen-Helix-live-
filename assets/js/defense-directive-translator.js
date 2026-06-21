/**
 * defense-directive-translator.js — Convert ranked Defense directives into opportunity objects
 * Carries _omittedSiblingCount through. Exposes: window.LIMENDefenseDirectiveTranslator
 */
(function () {
  'use strict';

  var PATH_LABELS = { 'INVESTABLE': 'INVEST', 'RESEARCHABLE': 'RESEARCH' };

  function _buildTitle(d) {
    var label = d.treatmentLabel || '';
    var nodeLabel = d.nodeLabel || '';
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'RESEARCHABLE';
    label = label.replace(/^(Build |Create |Deploy |Establish |Implement |Operationalize )/i, '');
    if (type === 'INVESTABLE') return 'Position in ' + nodeLabel.toLowerCase() + ' \u2014 ' + label;
    if (type === 'RESEARCHABLE') return 'Research ' + label.toLowerCase() + ' \u2014 ' + nodeLabel;
    return nodeLabel + ' \u2014 ' + label;
  }

  function _buildMonetizationPath(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'RESEARCHABLE';
    var companies = d.companies || [];
    var tickers = companies.filter(function (c) { return c.ticker; }).map(function (c) { return c.ticker; });
    var tickerStr = tickers.length > 0 ? tickers.join(', ') : '';
    if (type === 'INVESTABLE') {
      if (tickerStr) return 'Firms in this pathway (' + tickerStr + ') benefit from the defense condition. Position during stress window for repricing.';
      return 'Firms serving ' + (d.nodeLabel || 'this function').toLowerCase() + ' capture demand created by the active diagnosis.';
    }
    if (type === 'RESEARCHABLE') return 'Defense gap in ' + (d.nodeLabel || 'this area').toLowerCase() + ' is under-researched. First published analysis creates advisory positioning with DoD programme offices.';
    return 'Firms serving ' + (d.nodeLabel || 'this function').toLowerCase() + ' capture demand created by the active diagnosis.';
  }

  function _buildNextAction(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'RESEARCHABLE';
    var companies = d.companies || [];
    var steps = d.treatmentSteps || [];
    if (steps.length > 0) {
      var firstStep = typeof steps[0] === 'string' ? steps[0] : (steps[0].action || steps[0].label || '');
      if (firstStep.length > 10) return firstStep;
    }
    if (type === 'INVESTABLE' && companies.length > 0) return 'Check ' + companies[0].ticker + ' (' + companies[0].name + ') current defense exposure.';
    if (type === 'RESEARCHABLE') return 'Search DoD CDAO, DARPA, IARPA, DIU, and allied research programme databases for active solicitations matching "' + (d.nodeLabel || 'defense').toLowerCase() + '".';
    return 'Survey defense prime and vendor landscape for ' + (d.nodeLabel || 'this function').toLowerCase() + ' capabilities and investment positioning.';
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
    var parts = ['Domain: defense. Stress: ' + Math.round((d.stress || 0) * 100) + '%.'];
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
      var primaryPath = (d.suggestedPaths && d.suggestedPaths[0]) || 'RESEARCHABLE';
      var urgency = d.stress >= 0.70 ? 'IMMEDIATE' : d.stress >= 0.50 ? 'ACTIVE' : 'WATCH';

      var companies = d.companies || [];
      var targetStr = '';
      if (companies.length > 0) targetStr = 'Mapped firms: ' + companies.map(function (c) { return c.ticker + ' (' + c.name + ')'; }).join(', ') + '.';
      if (primaryPath === 'RESEARCHABLE') targetStr += (targetStr ? ' ' : '') + 'Research outlets: DoD CDAO, DARPA, IARPA, DIU, AFWERX, NavalX, NATO STO, allied research programmes.';
      if (!targetStr) targetStr = 'Identify counterparties affected by ' + (d.nodeLabel || 'this condition') + '.';

      opportunities.push({
        id: 'pdir_' + (d.portalDomainId || 'defense') + '_' + (d.nodeId || '') + '_' + i,
        title: _buildTitle(d),
        rank: d.rankScore || 0,
        path: primaryPath,
        urgency: urgency,
        source: 'portal_directive',
        diagnosisId: d.diagnosisId || null,
        tier: d.depth <= 1 ? 1 : d.depth <= 3 ? 2 : 3,
        stress: d.stress || 0,
        domain: 'defense',
        explain: d.treatmentDescription || d.treatmentLabel,
        action: _buildNextAction(d),
        valueRange: primaryPath === 'INVESTABLE' ? '10-25% sector premium' : '$500K-$5M defense research contracts',
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
        compensation: primaryPath === 'INVESTABLE' ? { type: 'invest', base: 5, unit: 'profit%', tier: 1 } : { type: 'research', base: 8, unit: 'cite%', tier: 1 },
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
    console.log('[DefenseTranslator] Translated ' + opportunities.length);
    return opportunities;
  }

  // ── DEAL SHAPING ──

  var REJECT_SIGNALS = [/build.*from scratch/i, /multi.?year/i, /long.?term strategy/i, /research.*opportunity/i, /explore.*potential/i, /consider.*options/i];

  var REVENUE_MODELS = {
    'INVESTABLE': [
      { model: 'advisory', desc: 'Build a defense sector exposure scorecard. Sell to defense primes, sovereign wealth funds, and family offices with global security exposure. $100K-$1M per engagement.' },
      { model: 'trading', desc: 'Position in defense primes (LMT, RTX, NOC, GD), European defense (BA., HO, RHM), drone / autonomous systems, and uranium / nuclear. Target 20-40% sector premium during sustained tension.' },
      { model: 'intelligence', desc: 'Build a global threat-monitoring and defense procurement intelligence dashboard. Sell to defense ministries, primes, and sovereign procurement offices worldwide.' }
    ],
    'RESEARCHABLE': [
      { model: 'research brief', desc: 'Produce a defense technology or threat landscape research brief. Submit to DARPA, IARPA, AFRL, ONR, ARO, ARL, NATO STO, EU EDF, AUKUS Pillar 2, UK DASA, or allied defence research agencies as advisory input.' },
      { model: 'advisory', desc: 'Deliver the research. Bill against research retainer or fixed deliverable. Defense research engagements typically 6–18 months with follow-on options.' },
      { model: 'intelligence product', desc: 'Convert the research into an intelligence product. Distribute to defence ministries, primes, and sovereign procurement offices through Direct Commercial Sales or advisory contracts.' }
    ]
  };

  var TITLE_TEMPLATES = [
    { match: /invasion|incursion|territorial|force projection|tank|artillery|amphibious/i, titles: ['Build battlespace awareness + sustainment platform \u2014 sell to allied defense ministries and primes'] },
    { match: /cyber|hack|apt|wiper|sabotage|critical infrastructure|scada|ics/i, titles: ['Build offensive / defensive cyber capability \u2014 sell to Cyber Command, DARPA, allied SOCs'] },
    { match: /nuclear|warhead|icbm|slbm|launch|silo|enrichment|iaea|proliferation/i, titles: ['Build strategic deterrence analysis + verification tooling \u2014 sell to DoD OUSD(P), IAEA, EU NUC'] },
    { match: /intelligence|sigint|humint|osint|surveillance|reconnaissance|estimate/i, titles: ['Build OSINT / multi-INT analysis platform \u2014 sell to IC, allied intel services, defense primes'] },
    { match: /logistics|supply chain|munitions|sustainment|sealift|airlift|spare parts/i, titles: ['Build defense logistics / sustainment platform \u2014 sell to DLA, NATO NSPA, allied support commands'] },
    { match: /protest|riot|civil unrest|martial|insurrection/i, titles: ['Build civil disturbance / domestic security analysis \u2014 sell to national guards, civil protection agencies'] },
    { match: /arms sale|fms|export license|itar|defense contract|procurement|rfp/i, titles: ['Build defense procurement intelligence + bid support \u2014 sell to primes and exporters'] },
    { match: /space|satellite|asat|orbital|gps jamming|space domain/i, titles: ['Build space domain awareness + counter-space capability \u2014 sell to Space Force, allied space commands'] },
    { match: /drone|uav|loitering|kamikaze|autonomous|swarm|fpv|shahed|switchblade/i, titles: ['Build counter-UAS or autonomous strike capability \u2014 sell to Army, Marines, allied land forces'] },
    { match: /nato|alliance|coalition|aukus|quad|five eyes|treaty|article 5/i, titles: ['Build alliance interoperability + coalition C2 platform \u2014 sell to NATO ACT, AUKUS, EU EDA'] },
    { match: /assessment|diagnostic/i, titles: ['Build defense risk scorecard \u2014 sell to {target}'] }
  ];

  function _shapeToDeal(opp) {
    if (!opp) return null;
    var dir = opp._directive || {};
    var mc = opp.moneyChain || {};
    var path = opp.path || 'RESEARCHABLE';
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
    var revenueOptions = REVENUE_MODELS[path] || REVENUE_MODELS['RESEARCHABLE'];
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
    return (nodeLabel || 'defense') + ' decision-makers';
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
        'Score exposure to ' + dxLabel + ' using stress-weighted defense model',
        'Identify entry price and position size based on current stress confidence',
        'Set stop-loss at -15% and profit target at sector premium',
        'Monitor weekly for diagnosis deactivation signal'
      ];
    }
    if (path === 'RESEARCHABLE') {
      return [
        'Survey DARPA, IARPA, DIU, and AFWERX programme databases for active topics matching "' + (dxLabel || nodeLabel) + '"',
        'Conduct literature review: existing research, capability gaps, and vendor landscape in ' + (nodeLabel || 'this domain'),
        'Draft a 1-page research concept note referencing live defense stress indicators',
        'Identify 3–5 target research customers (DoD programme offices, allied defence agencies, or think-tanks)',
        'Submit research brief and pursue advisory retainer or research contract'
      ];
    }
    return [
      'Survey defense prime and vendor landscape for ' + (dxLabel || nodeLabel) + ' capabilities',
      'Identify investment entry points (equities, ETFs, or direct advisory engagements)',
      'Map sector exposure and position sizing based on current stress confidence',
      'Set monitoring triggers and stop conditions for the thesis',
      'Execute position and track against diagnosis deactivation signal'
    ];
  }

  function _generateTargetClasses(path, nodeLabel, dxLabel) {
    if (path === 'INVESTABLE') return 'Defense primes (LMT, RTX, NOC, GD), allied defense vendors, and cyber / ISR pure-plays with direct ' + (nodeLabel || 'sector') + ' exposure.';
    if (path === 'RESEARCHABLE') return 'DoD CDAO, DARPA, IARPA, DIU, AFWERX, NavalX, NATO STO, EU EDF, AUKUS Pillar 2, UK DASA, and allied defence research programmes.';
    return 'Defense sector counterparties and research customers relevant to ' + (nodeLabel || 'this function') + '.';
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
    console.log('[DefenseTranslator] Shaped ' + shaped + '/' + shapeCount);
    return result;
  }

  window.LIMENDefenseDirectiveTranslator = { translate: translate, shape: shape };
})();
