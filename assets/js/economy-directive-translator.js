/**
 * economy-directive-translator.js — Convert ranked directives into canonical opportunity objects
 *
 * Takes ranked directives from economy-directive-ranker and translates them into
 * the same opportunity object shape that economy-brain.js produces, so they can
 * be injected into existing operator surfaces without modification.
 *
 * Translation rules:
 *   - Titles are operator-readable (imperative, specific)
 *   - Summaries are plain English
 *   - Actions are concrete next steps
 *   - Monetization paths are specific to the treatment type + companies
 *   - NO vague language: "explore", "research", "consider", "analyze further"
 *
 * ADDITIVE ONLY — does not modify existing opportunity generation.
 * Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 *
 * Exposes: window.LIMENEconomyDirectiveTranslator
 */
(function () {
  'use strict';

  var PATH_LABELS = {
    'INVESTABLE': 'INVEST',
    'GRANT-ELIGIBLE': 'GRANT',
    'PATENTABLE': 'PATENT'
  };

  /**
   * Generate an imperative, operator-readable title from directive content.
   */
  function _buildTitle(d) {
    var label = d.treatmentLabel || '';
    var nodeLabel = d.nodeLabel || '';
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';

    // Strip generic prefixes
    label = label.replace(/^(Build |Create |Deploy |Establish |Implement |Operationalize )/i, '');

    if (type === 'INVESTABLE') {
      return 'Position in ' + nodeLabel.toLowerCase() + ' \u2014 ' + label;
    } else if (type === 'PATENTABLE') {
      return 'File IP protection for ' + label.toLowerCase();
    } else {
      return nodeLabel + ' \u2014 ' + label;
    }
  }

  /**
   * Generate a concrete monetization path from directive context.
   */
  function _buildMonetizationPath(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    var companies = d.companies || [];
    var tickers = companies.filter(function (c) { return c.ticker; }).map(function (c) { return c.ticker; });
    var tickerStr = tickers.length > 0 ? tickers.join(', ') : '';

    if (type === 'INVESTABLE') {
      if (tickerStr) return 'Companies in this pathway (' + tickerStr + ') benefit from the condition. Position during stress window for sector repricing.';
      return 'Companies serving ' + (d.nodeLabel || 'this function').toLowerCase() + ' capture demand created by the active diagnosis.';
    } else if (type === 'PATENTABLE') {
      return 'Technology gap in ' + (d.nodeLabel || 'this area').toLowerCase() + ' has no dominant IP holder. First patent filing creates defensible position licensable to governments and institutions.';
    } else {
      return 'Active diagnosis creates documented need for ' + (d.nodeLabel || 'this function').toLowerCase() + ' intervention. Grant proposals backed by live system evidence win at higher rates.';
    }
  }

  /**
   * Generate a concrete next action.
   */
  function _buildNextAction(d) {
    var type = (d.suggestedPaths && d.suggestedPaths[0]) || 'GRANT-ELIGIBLE';
    var companies = d.companies || [];
    var steps = d.treatmentSteps || [];

    if (steps.length > 0) {
      var firstStep = typeof steps[0] === 'string' ? steps[0] : (steps[0].action || steps[0].label || '');
      if (firstStep.length > 10) return firstStep;
    }

    if (type === 'INVESTABLE' && companies.length > 0) {
      return 'Check ' + companies[0].ticker + ' (' + companies[0].name + ') current Helix phase and set entry parameters.';
    } else if (type === 'PATENTABLE') {
      return 'Search patents.google.com for prior art in "' + (d.nodeLabel || 'economy').toLowerCase() + '" technology. Draft provisional claim outline.';
    } else {
      return 'Search grants.gov for open solicitations matching "' + (d.nodeLabel || 'economy').toLowerCase() + '". Draft 1-page concept note with system evidence.';
    }
  }

  /**
   * Build timing string from urgency context.
   */
  function _buildTiming(d) {
    var stress = d.stress || 0;
    var stressPct = Math.round(stress * 100);

    if (stress >= 0.70) return 'Immediate \u2014 stress at ' + stressPct + '% demands action within days.';
    if (stress >= 0.50) return 'Near-term \u2014 execute within 1-4 weeks while stress holds at ' + stressPct + '%.';
    if (stress >= 0.30) return 'Active window \u2014 conditions support execution. Stress at ' + stressPct + '%.';
    return 'Watchlist \u2014 prepare materials. Deploy when stress rises above 50%.';
  }

  /**
   * Build invalidation condition.
   */
  function _buildInvalidation(d) {
    var parts = [];
    if (d.diagnosisLabel) parts.push(d.diagnosisLabel + ' diagnosis deactivates.');
    parts.push('Domain stress drops below 40%.');
    if (d.circuitDir === 'Hypo-active') parts.push('Node recovers to normal function \u2014 demand for intervention drops.');
    if (d.circuitDir === 'Hyper-active') parts.push('Overactivation resolves \u2014 emergency response pressure eases.');
    return parts.join(' ');
  }

  /**
   * Build evidence summary from current system state.
   */
  function _buildEvidence(d) {
    var parts = ['Domain: economy. Stress: ' + Math.round((d.stress || 0) * 100) + '%.'];
    if (d.diagnosisId) parts.push('Active diagnosis: ' + (d.diagnosisLabel || d.diagnosisId) + '.');
    if (d.circuitDir) parts.push('Node ' + d.nodeId + ' is ' + d.circuitDir.toLowerCase() + '.');
    if (d.circuitDetail) parts.push(d.circuitDetail);
    parts.push('Source: portal depth L' + (d.depth || 0) + ' (' + (d.portalTitle || d.portalDomainId) + ').');
    return parts.join(' ');
  }

  /**
   * Translate an array of ranked directives into canonical opportunity objects.
   */
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

      // Build the company list for moneyChain target
      var companies = d.companies || [];
      var targetStr = '';
      if (companies.length > 0) {
        targetStr = 'Mapped companies: ' + companies.map(function (c) { return c.ticker + ' (' + c.name + ')'; }).join(', ') + '.';
      }
      if (primaryPath === 'GRANT-ELIGIBLE') targetStr += (targetStr ? ' ' : '') + 'Agencies: Commerce Dept EDA, Treasury, Labor Dept, state economic development agencies. Search grants.gov.';
      if (primaryPath === 'PATENTABLE') targetStr += (targetStr ? ' ' : '') + 'Licensees: economic analytics firms, government agencies, policy research institutes, central banks.';
      if (!targetStr) targetStr = 'Identify counterparties affected by ' + (d.nodeLabel || 'this condition') + '.';

      var opp = {
        // Core identity
        id: 'pdir_' + (d.portalDomainId || 'economy') + '_' + (d.nodeId || '') + '_' + i,
        title: _buildTitle(d),
        rank: d.rankScore || 0,
        path: primaryPath,
        urgency: urgency,
        source: 'portal_directive',
        diagnosisId: d.diagnosisId || null,
        tier: d.depth <= 1 ? 1 : d.depth <= 3 ? 2 : 3,
        stress: d.stress || 0,
        domain: 'economy',

        // Enriched fields
        explain: d.treatmentDescription || d.treatmentLabel,
        action: _buildNextAction(d),
        valueRange: primaryPath === 'INVESTABLE' ? '10-30% sector premium' : primaryPath === 'PATENTABLE' ? '5-15% royalty on licensed implementations' : '$250K-$5M contracts',
        window: d.stress >= 0.70 ? '1-30 days' : d.stress >= 0.50 ? '30-90 days' : '60-180 days',
        outcome: _buildMonetizationPath(d),
        failure: _buildInvalidation(d),
        steps: d.treatmentSteps || [],
        examples: companies.map(function (c) { return c.name + ' (' + c.ticker + ')'; }),
        confidence: Math.round((d.rankScore || 0) * 100),

        // MoneyChain for operator view
        moneyChain: {
          doThis: d.treatmentDescription || _buildTitle(d),
          whyPays: _buildMonetizationPath(d),
          target: targetStr,
          timing: _buildTiming(d),
          invalidIf: _buildInvalidation(d),
          evidence: _buildEvidence(d),
          nextStep: _buildNextAction(d)
        },

        // Compensation model
        compensation: primaryPath === 'INVESTABLE'
          ? { type: 'invest', base: 5, unit: 'profit%', tier: 1 }
          : primaryPath === 'PATENTABLE'
            ? { type: 'patent', base: 10, unit: 'royalty%', tier: 1 }
            : { type: 'grant', base: 10, unit: '%', tier: 1 },

        // Business path detection
        paths: [primaryPath],

        // Portal directive metadata (extra, for traceability)
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

        // Deep child portal intelligence
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

        // Deep proof slot flag
        _isDeepProofSlot: !!d._isDeepProofSlot,
        _omittedSiblingCount: d._omittedSiblingCount || 0,

        // Mechanism classification
        _mechanism: d._mechanism || null,
        scores: d.scores || null
      };

      opportunities.push(opp);
    }

    console.log('[EconomyDirectiveTranslator] Translated ' + opportunities.length + ' opportunities from ' + ranked.length + ' ranked directives');
    return opportunities;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEAL SHAPING — post-translation layer for top directives
  // ══════════════════════════════════════════════════════════════════════

  var REJECT_SIGNALS = [
    /build.*from scratch/i, /multi.?year/i, /long.?term strategy/i,
    /research.*opportunity/i, /explore.*potential/i, /consider.*options/i
  ];

  var ACTION_VERBS = {
    'STRUCTURAL':  ['Deploy', 'Install', 'Integrate', 'Procure', 'Contract'],
    'DIAGNOSTIC':  ['Audit', 'Score', 'Map', 'Benchmark', 'Assess'],
    'STRATEGY':    ['Build', 'Package', 'Deliver', 'Sell', 'License'],
    'COACHING':    ['Train', 'Certify', 'Brief', 'Onboard'],
    'tools':       ['Deploy', 'Configure', 'Integrate', 'License'],
    'regulatory':  ['File', 'Submit', 'Prepare', 'Package'],
    'policy':      ['Draft', 'Submit', 'Propose', 'Implement'],
    'fiscal':      ['Model', 'Score', 'Audit', 'Certify']
  };

  var REVENUE_MODELS = {
    'INVESTABLE': [
      { model: 'advisory', desc: 'Build an economic stress-exposure scorecard for institutions and governments. Sell to central banks, sovereign wealth funds, and policy institutes. $50K-$250K per engagement.' },
      { model: 'positioning', desc: 'Identify underpriced assets in the disrupted economic segment. Position through stress window. Target 15-30% sector premium on macro recovery.' },
      { model: 'intelligence', desc: 'Build a live macroeconomic monitoring dashboard. Sell subscriptions to hedge funds, government agencies, and economic research firms. $10K-$100K/mo per seat.' }
    ],
    'GRANT-ELIGIBLE': [
      { model: 'grant award', desc: 'Write a grant proposal backed by live economic stress data. Submit to Commerce Dept EDA, Treasury, Labor Dept, or state agencies. $250K-$10M per award. 60-180 day cycle.' },
      { model: 'consulting', desc: 'Win the grant. Deliver the funded economic development or policy project. Bill implementation hours at $300-$600/hr against the award budget.' },
      { model: 'cost recovery', desc: 'Implement the solution for a government agency or public institution. Bill costs through their approved economic development budget. Guaranteed recovery.' }
    ],
    'PATENTABLE': [
      { model: 'licensing', desc: 'File a provisional patent on the economic modeling method. License it to every analytics firm and government agency in the affected sector. 5-15% royalty per implementation.' },
      { model: 'SaaS', desc: 'Turn the patented method into an economic intelligence platform. Sell subscriptions. $10K-$100K/mo per institution.' },
      { model: 'acquisition', desc: 'Build the IP portfolio around macroeconomic analytics. Position for acquisition by a data provider or consulting firm. $5M-$100M exit depending on coverage.' }
    ]
  };

  var DELIVERABLE_MAP = {
    'STRUCTURAL': 'Finished deployment plan: vendor-scored shortlist, integration timeline, cost model, and procurement-ready RFP',
    'DIAGNOSTIC': 'Completed economic risk scorecard: ranked exposure list, macro heat map, and action-prioritized recommendation matrix',
    'STRATEGY': 'Executable strategy deck: market sizing, ranked target list, 90-day execution plan, and financial model',
    'COACHING': 'Delivered training program: certified economic analysis workforce with skills verification and readiness scorecard',
    'tools': 'Configured system: integrated economic monitoring platform with dashboard, alert rules, and operator runbook',
    'regulatory': 'Submission-ready filing: complete application with budget narrative, economic evidence, and compliance checklist',
    'policy': 'Policy brief package: impact analysis, implementation roadmap, cost-benefit model, and stakeholder briefing deck',
    'fiscal': 'Fiscal assessment report: debt sustainability analysis, revenue projections, expenditure review, and reform roadmap'
  };

  function _shapeToDeal(opp) {
    if (!opp) return null;

    var dir = opp._directive || {};
    var mc = opp.moneyChain || {};
    var path = opp.path || 'GRANT-ELIGIBLE';
    var type = dir.treatmentLabel ? _inferType(dir.treatmentLabel) : (opp.path === 'PATENTABLE' ? 'DIAGNOSTIC' : 'STRUCTURAL');
    var stress = opp.stress || 0;
    var stressPct = Math.round(stress * 100);
    var companies = opp.examples || [];
    var steps = opp.steps || [];
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || '').toLowerCase();
    var dxLabel = (opp.diagnosisId || '').replace(/_/g, ' ');

    // ── REJECTION FILTER ──
    for (var ri = 0; ri < REJECT_SIGNALS.length; ri++) {
      if (REJECT_SIGNALS[ri].test(opp.title) || REJECT_SIGNALS[ri].test(opp.explain || '')) {
        return null;
      }
    }

    // ── TITLE SHAPING ──
    var shaped_title = _buildDealTitle(dir.treatmentLabel || '', type, path, nodeLabel, dxLabel, companies);

    // ── WHAT'S HAPPENING ──
    var whatsHappening = '';
    if (dxLabel && stressPct > 0) {
      whatsHappening = dxLabel.charAt(0).toUpperCase() + dxLabel.slice(1) + ' at ' + stressPct + '% stress. ';
    }
    if (dir.nodeLabel) {
      whatsHappening += dir.nodeLabel + ' is disrupted \u2014 buyers need solutions now. ';
    }
    if (stressPct >= 70) whatsHappening += 'Window closing. Execute this week.';
    else if (stressPct >= 50) whatsHappening += 'Active window. Move within 30 days.';
    else whatsHappening += 'Position now. Scale when stress exceeds 60%.';

    // ── WHAT TO DO ──
    var shaped_steps = [];
    var stepsArePortalNative = false;
    if (steps.length > 0) {
      stepsArePortalNative = true;
      for (var si = 0; si < Math.min(steps.length, 5); si++) {
        var raw = typeof steps[si] === 'string' ? steps[si] : (steps[si].action || steps[si].label || '');
        shaped_steps.push(_sharpenStep(raw, si, companies, nodeLabel));
      }
    } else {
      stepsArePortalNative = false;
      shaped_steps = _generateSteps(type, path, companies, nodeLabel, dxLabel);
    }

    // ── WHO TO TARGET ──
    var shaped_target = '';
    if (companies.length > 0) {
      shaped_target = companies.slice(0, 5).join(', ') + '.';
    } else {
      shaped_target = _generateTargetClasses(path, nodeLabel, dxLabel);
    }

    // ── HOW MONEY IS MADE ──
    var revenueOptions = REVENUE_MODELS[path] || REVENUE_MODELS['GRANT-ELIGIBLE'];
    var bestRevenue = revenueOptions[0];
    if (type === 'DIAGNOSTIC' && path === 'INVESTABLE') bestRevenue = revenueOptions[1] || revenueOptions[0];
    var shaped_revenue = bestRevenue.desc;

    // ── DELIVERABLE ──
    var shaped_deliverable = DELIVERABLE_MAP[type] || DELIVERABLE_MAP['DIAGNOSTIC'];

    // ── TIMING ──
    var shaped_timing = '';
    if (stress >= 0.70) shaped_timing = 'This week. ' + stressPct + '% stress. Window closing.';
    else if (stress >= 0.50) shaped_timing = 'Within 30 days. ' + stressPct + '% stress. Move now.';
    else if (stress >= 0.30) shaped_timing = 'Within 60 days. Build position. ' + stressPct + '% and rising.';
    else shaped_timing = 'Prepare now. Deploy when stress crosses 50%.';

    // ── OVERWRITE OPPORTUNITY FIELDS ──
    opp.title = shaped_title;
    opp.explain = whatsHappening;
    opp.steps = shaped_steps;
    opp.moneyChain = {
      doThis: shaped_steps[0] + (shaped_steps[1] ? ' Then: ' + shaped_steps[1] : ''),
      whyPays: shaped_revenue,
      target: shaped_target,
      timing: shaped_timing,
      invalidIf: mc.invalidIf || (dxLabel + ' resolves. Stress below 40%. Buyer demand evaporates.'),
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

  // ── Domain-specific title templates ──
  var TITLE_TEMPLATES = [
    { match: /gdp|growth rate|output gap|economic growth/i, titles: ['Build GDP stress model \u2014 sell to central banks and sovereign funds'] },
    { match: /employment|unemployment|labor force|job/i, titles: ['Build employment disruption scorecard \u2014 sell to labor departments and workforce agencies'] },
    { match: /inflation|cpi|price level|cost.?of.?living/i, titles: ['Build inflation persistence model \u2014 sell to central banks and fixed income desks'] },
    { match: /trade balance|import|export|tariff|customs/i, titles: ['Build trade disruption analyzer \u2014 sell to trade policy offices and logistics firms'] },
    { match: /fiscal|budget|government spending|public finance/i, titles: ['Build fiscal sustainability model \u2014 sell to treasury departments and rating agencies'] },
    { match: /monetary|central bank|interest rate|fed fund/i, titles: ['Build monetary policy impact model \u2014 sell to banks and fixed income managers'] },
    { match: /housing|real estate|property|mortgage|rent/i, titles: ['Build housing market stress model \u2014 sell to mortgage lenders and real estate investors'] },
    { match: /consumer|spending|retail|household|disposable/i, titles: ['Build consumer spending tracker \u2014 sell to retailers and consumer goods firms'] },
    { match: /industrial|manufacturing|production|capacity|factory/i, titles: ['Build industrial output monitor \u2014 sell to manufacturers and supply chain operators'] },
    { match: /debt|sovereign|bond|yield|credit rating/i, titles: ['Build sovereign debt stress analyzer \u2014 sell to bond traders and rating agencies'] },
    { match: /labor market|wage|workforce|skill|human capital/i, titles: ['Build labor market intelligence platform \u2014 sell to staffing firms and HR departments'] },
    { match: /capital market|equity|stock|ipo|securities/i, titles: ['Build capital markets stress model \u2014 sell to investment banks and asset managers'] },
    { match: /supply chain|logistics|freight|shipping|distribution/i, titles: ['Build supply chain disruption tracker \u2014 sell to logistics firms and manufacturers'] },
    { match: /energy|oil|gas|utility|electricity|power/i, titles: ['Build energy economics model \u2014 sell to energy firms and utility regulators'] },
    { match: /technology|digital|innovation|automation|ai/i, titles: ['Build tech sector economic impact model \u2014 sell to tech investors and policy institutes'] },
    { match: /productivity|efficiency|total factor/i, titles: ['Build productivity analytics engine \u2014 sell to policy institutes and management consultancies'] },
    { match: /currency|exchange rate|forex|devaluation/i, titles: ['Build currency stress model \u2014 sell to FX desks and treasury departments'] },
    { match: /poverty|inequality|income distribution/i, titles: ['Build economic inequality tracker \u2014 sell to development agencies and policy institutes'] },
    { match: /investment|fdi|capital formation|gross fixed/i, titles: ['Build investment flow analyzer \u2014 sell to sovereign wealth funds and development banks'] },
    { match: /small business|sme|entrepreneurship|startup/i, titles: ['Build SME resilience scorecard \u2014 sell to economic development agencies and lenders'] },
    { match: /assessment|diagnostic/i, titles: ['Build economic sector risk scorecard \u2014 sell to {target}'] }
  ];

  function _buildDealTitle(treatLabel, type, path, nodeLabel, dxLabel, companies) {
    var target = _targetPhrase(companies, nodeLabel, dxLabel);

    for (var ti = 0; ti < TITLE_TEMPLATES.length; ti++) {
      if (TITLE_TEMPLATES[ti].match.test(treatLabel)) {
        return TITLE_TEMPLATES[ti].titles[0].replace(/\{target\}/g, target);
      }
    }

    var object = treatLabel
      .replace(/^(Build |Create |Deploy |Establish |Implement |Operationalize |Develop |Design |Conduct |Perform )/i, '')
      .replace(/ (Governance Structure|Integration Architecture|Strategic Alignment Review|Stakeholder Engagement Plan|Capability Maturity Model|Continuous Improvement Cycle)$/i, '')
      .replace(/ (Assessment & Diagnostics|Assessment and Diagnostics)/i, '')
      .replace(/\s+/g, ' ').trim();
    if (object.length > 35) object = object.substring(0, 35).trim();

    var title = 'Build ' + object.toLowerCase() + ' model \u2014 sell to ' + target;
    var words = title.split(' ');
    if (words.length > 14) title = words.slice(0, 14).join(' ');
    return title;
  }

  function _targetPhrase(companies, nodeLabel, dxLabel) {
    if (companies && companies.length > 0) {
      var first = companies[0];
      var tickerMatch = first.match(/\(([A-Z.]+)\)/);
      if (tickerMatch) return tickerMatch[1] + '-class buyers';
      return 'affected institutions';
    }
    if (dxLabel) return dxLabel.toLowerCase() + '-exposed buyers';
    return (nodeLabel || 'economy') + ' buyers';
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
    raw = raw.replace(/\busing (IMF|WTO|BLS|BEA|OECD|WB|Fed|ECB|BOJ|PBOC) [^,.]+ (framework|methodology|analysis|standards|requirements)/gi, '');
    raw = raw.replace(/\bper [A-Z]+ [0-9]+ /gi, '');
    raw = raw.replace(/\s+/g, ' ').trim();
    return raw;
  }

  function _generateSteps(type, path, companies, nodeLabel, dxLabel) {
    var target = companies.length > 0 ? companies[0] : (nodeLabel + ' institutions');
    if (path === 'INVESTABLE') {
      return [
        'Pull ' + target + ' economic exposure data and Helix phase status',
        'Score vulnerability to ' + dxLabel + ' disruption using stress-weighted model',
        'Identify entry price and position size based on macro stress confidence',
        'Set stop-loss at -15% and profit target at sector premium',
        'Monitor daily for diagnosis deactivation signal'
      ];
    } else if (path === 'PATENTABLE') {
      return [
        'Search patents.google.com for prior art in ' + nodeLabel + ' economic modeling',
        'Draft provisional patent claim around ' + (nodeLabel || 'diagnostic') + ' methodology',
        'Identify 5 potential licensees in the ' + nodeLabel + ' analytics space',
        'File provisional application (12-month priority window)',
        'Begin licensing outreach to top 3 targets'
      ];
    } else {
      return [
        'Search grants.gov for open solicitations matching "' + (dxLabel || nodeLabel) + '"',
        'Draft 1-page concept note with live economic stress evidence',
        'Prepare budget narrative: personnel, technology, indirect costs',
        'Assemble supporting documents: capability statement, economic impact analysis',
        'Submit application within current grant cycle window'
      ];
    }
  }

  function _generateTargetClasses(path, nodeLabel, dxLabel) {
    if (path === 'INVESTABLE') return 'Sovereign wealth funds, central banks, macro hedge funds, and institutional investors with direct ' + (nodeLabel || 'sector') + ' exposure.';
    if (path === 'PATENTABLE') return 'Economic analytics firms, policy research institutes, government agencies, and technology firms serving ' + (nodeLabel || 'the sector') + '.';
    return 'Commerce Dept EDA, Treasury, Labor Dept, state economic development agencies. Public institutions with ' + (nodeLabel || 'infrastructure') + ' mandates.';
  }

  function _inferType(label) {
    if (!label) return 'DIAGNOSTIC';
    var l = label.toLowerCase();
    if (l.indexOf('deploy') !== -1 || l.indexOf('install') !== -1 || l.indexOf('integrate') !== -1) return 'STRUCTURAL';
    if (l.indexOf('assess') !== -1 || l.indexOf('audit') !== -1 || l.indexOf('model') !== -1 || l.indexOf('diagnostic') !== -1) return 'DIAGNOSTIC';
    if (l.indexOf('strategy') !== -1 || l.indexOf('governance') !== -1 || l.indexOf('stakeholder') !== -1) return 'STRATEGY';
    if (l.indexOf('train') !== -1 || l.indexOf('certif') !== -1) return 'COACHING';
    if (l.indexOf('policy') !== -1 || l.indexOf('reform') !== -1 || l.indexOf('regulation') !== -1) return 'policy';
    if (l.indexOf('fiscal') !== -1 || l.indexOf('budget') !== -1 || l.indexOf('tax') !== -1) return 'fiscal';
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
        if (deal) {
          result.push(deal);
          shaped++;
        }
      } else {
        result.push(translated[i]);
      }
    }

    console.log('[EconomyDirectiveTranslator] Shaped ' + shaped + '/' + shapeCount + ' directives into deal-grade outputs');
    return result;
  }

  window.LIMENEconomyDirectiveTranslator = { translate: translate, shape: shape };
})();
