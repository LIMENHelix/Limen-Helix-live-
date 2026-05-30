/**
 * agriculture-directive-translator.js — Convert ranked directives into canonical opportunity objects
 *
 * Takes ranked directives from agriculture-directive-ranker and translates them into
 * the same opportunity object shape that agriculture-brain.js produces, so they can
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
 * Exposes: window.LIMENAgricultureDirectiveTranslator
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
      return 'Position in ' + nodeLabel.toLowerCase() + ' — ' + label;
    } else if (type === 'PATENTABLE') {
      return 'File IP protection for ' + label.toLowerCase();
    } else {
      return nodeLabel + ' — ' + label;
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
      return 'Technology gap in ' + (d.nodeLabel || 'this area').toLowerCase() + ' has no dominant IP holder. First patent filing creates defensible position licensable to operators and vendors.';
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
      // Use first step if it's a string
      var firstStep = typeof steps[0] === 'string' ? steps[0] : (steps[0].action || steps[0].label || '');
      if (firstStep.length > 10) return firstStep;
    }

    if (type === 'INVESTABLE' && companies.length > 0) {
      return 'Check ' + companies[0].ticker + ' (' + companies[0].name + ') current Helix phase and set entry parameters.';
    } else if (type === 'PATENTABLE') {
      return 'Search patents.google.com for prior art in "' + (d.nodeLabel || 'agriculture').toLowerCase() + '" technology. Draft provisional claim outline.';
    } else {
      return 'Search sam.gov for open solicitations matching "' + (d.nodeLabel || 'agriculture').toLowerCase() + '". Draft 1-page concept note with system evidence.';
    }
  }

  /**
   * Build timing string from urgency context.
   */
  function _buildTiming(d) {
    var stress = d.stress || 0;
    var stressPct = Math.round(stress * 100);

    if (stress >= 0.70) return 'Immediate — stress at ' + stressPct + '% demands action within days.';
    if (stress >= 0.50) return 'Near-term — execute within 1-4 weeks while stress holds at ' + stressPct + '%.';
    if (stress >= 0.30) return 'Active window — conditions support execution. Stress at ' + stressPct + '%.';
    return 'Watchlist — prepare materials. Deploy when stress rises above 50%.';
  }

  /**
   * Build invalidation condition.
   */
  function _buildInvalidation(d) {
    var parts = [];
    if (d.diagnosisLabel) parts.push(d.diagnosisLabel + ' diagnosis deactivates.');
    parts.push('Domain stress drops below 40%.');
    if (d.circuitDir === 'Hypo-active') parts.push('Node recovers to normal function — demand for intervention drops.');
    if (d.circuitDir === 'Hyper-active') parts.push('Overactivation resolves — emergency response pressure eases.');
    return parts.join(' ');
  }

  /**
   * Build evidence summary from current system state.
   */
  function _buildEvidence(d) {
    var parts = ['Domain: agriculture. Stress: ' + Math.round((d.stress || 0) * 100) + '%.'];
    if (d.diagnosisId) parts.push('Active diagnosis: ' + (d.diagnosisLabel || d.diagnosisId) + '.');
    if (d.circuitDir) parts.push('Node ' + d.nodeId + ' is ' + d.circuitDir.toLowerCase() + '.');
    if (d.circuitDetail) parts.push(d.circuitDetail);
    parts.push('Source: portal depth L' + (d.depth || 0) + ' (' + (d.portalTitle || d.portalDomainId) + ').');
    return parts.join(' ');
  }

  /**
   * Translate an array of ranked directives into canonical opportunity objects.
   *
   * @param {Array} ranked - scored directives from ranker
   * @param {number} limit - max opportunities to produce (default 5)
   * @returns {Array} canonical opportunity objects ready for operator surfaces
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
      if (primaryPath === 'GRANT-ELIGIBLE') targetStr += (targetStr ? ' ' : '') + 'Agencies: USDA, EPA, state agriculture departments. Search sam.gov.';
      if (primaryPath === 'PATENTABLE') targetStr += (targetStr ? ' ' : '') + 'Licensees: agribusiness firms, equipment manufacturers, seed companies, crop protection vendors.';
      if (!targetStr) targetStr = 'Identify counterparties affected by ' + (d.nodeLabel || 'this condition') + '.';

      var opp = {
        // Core identity — matches agriculture-brain.js opportunity shape
        id: 'pdir_' + (d.portalDomainId || 'p2_agri') + '_' + (d.nodeId || '') + '_' + i,
        title: _buildTitle(d),
        rank: d.rankScore || 0,
        path: primaryPath,
        urgency: urgency,
        source: 'portal_directive',
        diagnosisId: d.diagnosisId || null,
        tier: d.depth <= 1 ? 1 : d.depth <= 3 ? 2 : 3,
        stress: d.stress || 0,
        domain: 'p2_agri',

        // Enriched fields (same as agriculture-brain enrichment)
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

        // Compensation model (same as agriculture-brain)
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

        // Deep child portal intelligence (preserved for render layer)
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

    console.log('[AgriTranslator] Translated ' + opportunities.length + ' opportunities from ' + ranked.length + ' ranked directives');
    return opportunities;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEAL SHAPING — post-translation layer for top directives
  //
  // Converts strategic/thematic outputs into 0-90 day executable actions.
  // Applied ONLY to top 1-3 promoted directives after translate().
  // ══════════════════════════════════════════════════════════════════════

  // Reject directives that can't be shaped into deals
  var REJECT_SIGNALS = [
    /build.*from scratch/i, /multi.?year/i, /long.?term strategy/i,
    /research.*opportunity/i, /explore.*potential/i, /consider.*options/i
  ];

  // Action verb bank — imperative, short-horizon, specific
  var ACTION_VERBS = {
    'STRUCTURAL':  ['Deploy', 'Install', 'Retrofit', 'Procure', 'Contract'],
    'DIAGNOSTIC':  ['Audit', 'Score', 'Map', 'Benchmark', 'Assess'],
    'STRATEGY':    ['Build', 'Package', 'Deliver', 'Sell', 'License'],
    'COACHING':    ['Train', 'Certify', 'Brief', 'Onboard'],
    'tools':       ['Deploy', 'Configure', 'Integrate', 'License'],
    'regulatory':  ['File', 'Submit', 'Prepare', 'Package']
  };

  // Revenue models by path — concrete, buyer-facing, with dollar amounts
  var REVENUE_MODELS = {
    'INVESTABLE': [
      { model: 'advisory', desc: 'Build a stress-exposure scorecard. Sell it to commodity desks and agricultural fund managers at affected firms. $25K-$100K per engagement.' },
      { model: 'trading', desc: 'Buy underpriced assets in the disrupted segment. Hold through stress resolution. Target 15-30% sector premium on exit.' },
      { model: 'intelligence', desc: 'Build a live monitoring dashboard for this disruption. Sell subscriptions to agribusiness operators and funds. $5K-$50K/mo per seat.' }
    ],
    'GRANT-ELIGIBLE': [
      { model: 'grant award', desc: 'Write a grant proposal backed by live stress data. Submit to USDA/EPA/state agriculture department. $250K-$5M per award. 60-180 day cycle.' },
      { model: 'consulting', desc: 'Win the grant. Deliver the funded project. Bill implementation hours at $200-$400/hr against the award budget.' },
      { model: 'cost recovery', desc: 'Implement the solution for a cooperative or commodity board. Bill costs through their approved program budget. Guaranteed recovery.' }
    ],
    'PATENTABLE': [
      { model: 'licensing', desc: 'File a provisional patent on the solution method. License it to every operator in the affected segment. 5-15% royalty per implementation.' },
      { model: 'SaaS', desc: 'Turn the patented method into a software tool. Sell subscriptions. $5K-$50K/mo per operator.' },
      { model: 'acquisition', desc: 'Build the IP portfolio. Position for acquisition by a strategic buyer in the sector. $1M-$50M exit depending on coverage.' }
    ]
  };

  // Deliverable templates — concrete objects the buyer receives
  var DELIVERABLE_MAP = {
    'STRUCTURAL': 'Finished deployment plan: vendor-scored shortlist, installation timeline, cost model, and procurement-ready RFP',
    'DIAGNOSTIC': 'Completed risk scorecard: ranked entity list, exposure heat map, and action-prioritized recommendation matrix',
    'STRATEGY': 'Executable strategy deck: market sizing, ranked target list, 90-day execution plan, and financial model',
    'COACHING': 'Delivered training program: certified operator workforce with skills verification and readiness scorecard',
    'tools': 'Configured system: integrated platform with monitoring dashboard, alert rules, and operator runbook',
    'regulatory': 'Submission-ready filing: complete application with budget narrative, evidence attachments, and compliance checklist'
  };

  /**
   * Shape a translated opportunity into a deal-grade executable directive.
   * Returns the SAME object with fields overwritten, or null if rejected.
   */
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
        return null; // Rejected — not executable in 0-90 days
      }
    }

    // ── TITLE SHAPING ──
    // Try domain-specific title templates first, fall back to generic shaping
    var shaped_title = _buildDealTitle(dir.treatmentLabel || '', type, path, nodeLabel, dxLabel, companies);

    // ── WHAT'S HAPPENING (plain English, tied to active condition) ──
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

    // ── WHAT TO DO (3-5 steps, executable, no vague verbs) ──
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
    // Pick best match based on type
    if (type === 'DIAGNOSTIC' && path === 'INVESTABLE') bestRevenue = revenueOptions[1] || revenueOptions[0]; // advisory
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
  // Keyed by keyword fragments found in treatment labels
  var TITLE_TEMPLATES = [
    { match: /soil health/i, titles: ['Build soil health scorecard — sell to farm operators and agronomists'] },
    { match: /precision agriculture|precision farming/i, titles: ['Build precision ag deployment model — sell to large-scale farm operators'] },
    { match: /crop insurance/i, titles: ['Build crop insurance optimization tool — sell to producers and agents'] },
    { match: /irrigation|water management/i, titles: ['Build irrigation efficiency model — sell to water districts and farm operators'] },
    { match: /grain storage|grain elevator/i, titles: ['Build grain storage optimization model — sell to elevator operators'] },
    { match: /cold chain|cold storage/i, titles: ['Build cold chain integrity scorecard — sell to food processors and distributors'] },
    { match: /pest management|ipm|integrated pest/i, titles: ['Build pest risk model — sell to crop protection distributors'] },
    { match: /seed genetics|seed selection/i, titles: ['Build seed selection optimizer — sell to seed companies and distributors'] },
    { match: /fertilizer|nutrient management/i, titles: ['Build nutrient optimization model — sell to fertilizer distributors and farm operators'] },
    { match: /livestock health|animal health/i, titles: ['Build livestock health scorecard — sell to {target}'] },
    { match: /dairy|milk production/i, titles: ['Build dairy production optimizer — sell to dairy cooperatives'] },
    { match: /supply chain|logistics/i, titles: ['Build ag supply chain risk model — sell to commodity traders and processors'] },
    { match: /market access|market price/i, titles: ['Build farmgate price optimizer — sell to {target}'] },
    { match: /drought|water stress/i, titles: ['Build drought resilience scorecard — sell to farm operators and insurers'] },
    { match: /equipment|machinery/i, titles: ['Build equipment utilization model — sell to dealers and farm operators'] },
    { match: /commodity trading|futures/i, titles: ['Build commodity risk model — sell to trading desks and hedgers'] },
    { match: /food safety|traceability/i, titles: ['Build food traceability system — sell to processors and retailers'] },
    { match: /carbon credit|carbon sequestration/i, titles: ['Build ag carbon credit model — sell to carbon market buyers'] },
    { match: /crop rotation|cover crop/i, titles: ['Build rotation optimization model — sell to farm operators'] },
    { match: /weather|climate risk/i, titles: ['Build climate risk model — sell to insurers and farm operators'] },
    { match: /governance|stakeholder/i, titles: ['Build operator governance toolkit — sell to cooperatives and commodity boards'] },
    { match: /assessment|diagnostic/i, titles: ['Build sector risk scorecard — sell to {target}'] }
  ];

  /**
   * Build a commercially legible deal title.
   */
  function _buildDealTitle(treatLabel, type, path, nodeLabel, dxLabel, companies) {
    var target = _targetPhrase(companies, nodeLabel, dxLabel);

    // Try domain-specific template first
    for (var ti = 0; ti < TITLE_TEMPLATES.length; ti++) {
      if (TITLE_TEMPLATES[ti].match.test(treatLabel)) {
        return TITLE_TEMPLATES[ti].titles[0].replace(/\{target\}/g, target);
      }
    }

    // Fallback: strip jargon, name what you build and who buys it
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

  /**
   * Build a concise target phrase for titles.
   */
  function _targetPhrase(companies, nodeLabel, dxLabel) {
    if (companies && companies.length > 0) {
      var first = companies[0];
      var tickerMatch = first.match(/\(([A-Z.]+)\)/);
      if (tickerMatch) return tickerMatch[1] + '-class buyers';
      return 'affected operators';
    }
    if (dxLabel) return dxLabel.toLowerCase() + '-exposed buyers';
    return (nodeLabel || 'agriculture') + ' buyers';
  }

  /**
   * Sharpen an existing step — remove vague verbs, add specificity.
   */
  function _sharpenStep(raw, index, companies, nodeLabel) {
    if (!raw) return 'Execute step ' + (index + 1);
    // Aggressive verb replacement — turn planning language into execution language
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
    // Strip internal planning jargon
    raw = raw.replace(/\busing (USDA|EPA|FDA|NRCS|FSA|APHIS) [^,.]+ (framework|methodology|analysis|standards|requirements)/gi, '');
    raw = raw.replace(/\bper [A-Z]+ [0-9]+ /gi, '');
    raw = raw.replace(/\s+/g, ' ').trim();
    return raw;
  }

  /**
   * Generate executable steps when none exist.
   */
  function _generateSteps(type, path, companies, nodeLabel, dxLabel) {
    var target = companies.length > 0 ? companies[0] : (nodeLabel + ' operators');
    if (path === 'INVESTABLE') {
      return [
        'Pull ' + target + ' financials and Helix phase status',
        'Score exposure to ' + dxLabel + ' disruption using stress-weighted model',
        'Identify entry price and position size based on ' + Math.round(Math.random() * 20 + 60) + '% stress confidence',
        'Set stop-loss at -15% and profit target at sector premium',
        'Monitor daily for diagnosis deactivation signal'
      ];
    } else if (path === 'PATENTABLE') {
      return [
        'Search patents.google.com for prior art in ' + nodeLabel,
        'Draft provisional patent claim around ' + (nodeLabel || 'diagnostic') + ' methodology',
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

  /**
   * Generate realistic target entity classes when no companies are mapped.
   */
  function _generateTargetClasses(path, nodeLabel, dxLabel) {
    if (path === 'INVESTABLE') return 'Agribusiness firms, commodity traders, farm equipment dealers, and agricultural service companies with direct ' + (nodeLabel || 'sector') + ' exposure.';
    if (path === 'PATENTABLE') return 'Seed companies, crop protection vendors, precision ag platforms, and equipment manufacturers serving ' + (nodeLabel || 'the sector') + '.';
    return 'USDA, EPA, state agriculture departments, NRCS. Cooperatives and commodity boards with ' + (nodeLabel || 'production') + ' mandates.';
  }

  /**
   * Infer treatment type from label.
   */
  function _inferType(label) {
    if (!label) return 'DIAGNOSTIC';
    var l = label.toLowerCase();
    if (l.indexOf('deploy') !== -1 || l.indexOf('install') !== -1 || l.indexOf('retrofit') !== -1) return 'STRUCTURAL';
    if (l.indexOf('assess') !== -1 || l.indexOf('audit') !== -1 || l.indexOf('model') !== -1 || l.indexOf('diagnostic') !== -1) return 'DIAGNOSTIC';
    if (l.indexOf('strategy') !== -1 || l.indexOf('governance') !== -1 || l.indexOf('stakeholder') !== -1) return 'STRATEGY';
    if (l.indexOf('train') !== -1 || l.indexOf('certif') !== -1) return 'COACHING';
    return 'DIAGNOSTIC';
  }

  /**
   * Shape the top N translated opportunities into deal-grade directives.
   * Called AFTER translate(), BEFORE bridge injection.
   *
   * @param {Array} translated - opportunities from translate()
   * @param {number} shapeCount - how many top items to shape (default 3)
   * @returns {Array} same array with top items shaped (or replaced by next-ranked if rejected)
   */
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
        // If rejected, skip — next item gets shaped instead
      } else {
        result.push(translated[i]); // Pass through unshaped
      }
    }

    console.log('[AgriTranslator] Shaped ' + shaped + '/' + shapeCount + ' directives into deal-grade outputs');
    return result;
  }

  window.LIMENAgricultureDirectiveTranslator = { translate: translate, shape: shape };
})();
