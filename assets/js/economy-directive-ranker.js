/**
 * economy-directive-ranker.js — Score and rank extracted directive candidates
 *
 * Depth-aware ranking that prevents shallow L0 items from dominating when
 * richer L1-L5 directives exist. Specificity and treatment richness are
 * weighted strongly enough that a deep, well-evidenced directive can outrank
 * a shallow diagnosis-circuit item.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENEconomyDirectiveRanker
 */
(function () {
  'use strict';

  var EVIDENCE_SCORE = {
    'Strong': 1.0, 'A': 1.0,
    'Moderate': 0.7, 'B': 0.7,
    'Emerging': 0.4, 'C': 0.4,
    'Limited': 0.2, 'D': 0.2
  };

  var TYPE_ACTION_MAP = {
    'STRUCTURAL':  { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.9 },
    'DIAGNOSTIC':  { paths: ['PATENTABLE', 'GRANT-ELIGIBLE'], weight: 0.7 },
    'STRATEGY':    { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.85 },
    'strategy':    { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.85 },
    'regulatory':  { paths: ['GRANT-ELIGIBLE'], weight: 0.8 },
    'tools':       { paths: ['PATENTABLE', 'INVESTABLE'], weight: 0.75 },
    'coaching':    { paths: ['GRANT-ELIGIBLE'], weight: 0.5 },
    'COACHING':    { paths: ['GRANT-ELIGIBLE'], weight: 0.5 },
    'culture':     { paths: ['GRANT-ELIGIBLE'], weight: 0.4 },
    'diplomatic':  { paths: ['GRANT-ELIGIBLE'], weight: 0.45 },
    'structural':  { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.9 }
  };

  var ROLE_WEIGHT = {
    'executor': 1.0, 'router': 0.9, 'allocator': 0.85, 'gatekeeper': 0.8,
    'signal_detector': 0.75, 'buffer': 0.7, 'amplifier': 0.65,
    'stabilizer': 0.6, 'arbitrator': 0.55
  };

  // Softer depth penalty — don't crush L2-L4 items
  var DEPTH_FACTOR = [1.0, 0.97, 0.92, 0.85, 0.75, 0.65, 0.55];

  // ══════════════════════════════════════════════════════════════════════
  // MECHANISM CLASSIFICATION ENGINE
  //
  // Each diagnosis defines structural economic mechanisms.
  // Directives are classified by mechanism, not just keywords.
  // No mechanism match → severe penalty / anchor ineligible.
  // ══════════════════════════════════════════════════════════════════════

  var MECHANISMS = {
    demand_contraction:     { label: 'Demand Contraction',        signals: ['demand', 'consumption', 'consumer spending', 'retail', 'gdp', 'output gap', 'aggregate demand', 'purchasing'] },
    inflation_persistence:  { label: 'Inflation Persistence',     signals: ['inflation', 'cpi', 'price level', 'cost push', 'wage price', 'stagflation', 'hyperinflation', 'deflation'] },
    credit_tightening:      { label: 'Credit Tightening',         signals: ['credit', 'lending', 'loan', 'mortgage', 'interest rate', 'spread', 'default', 'banking'] },
    trade_disruption:       { label: 'Trade Disruption',          signals: ['trade', 'tariff', 'import', 'export', 'balance of payments', 'protectionism', 'supply chain', 'customs'] },
    fiscal_stress:          { label: 'Fiscal Stress',             signals: ['fiscal', 'budget', 'deficit', 'government spending', 'tax', 'austerity', 'stimulus', 'public debt'] },
    labor_market_shift:     { label: 'Labor Market Shift',        signals: ['labor', 'employment', 'unemployment', 'wage', 'workforce', 'job', 'automation', 'gig economy'] },
    monetary_policy_impact: { label: 'Monetary Policy Impact',    signals: ['monetary', 'central bank', 'fed', 'interest rate', 'quantitative', 'tightening', 'easing', 'reserve'] },
    structural_reform:      { label: 'Structural Reform',         signals: ['reform', 'deregulation', 'privatization', 'liberalization', 'productivity', 'innovation', 'infrastructure'] },
    debt_service_pressure:  { label: 'Debt Service Pressure',     signals: ['debt', 'sovereign', 'bond', 'yield', 'credit rating', 'downgrade', 'refinancing', 'maturity'] },
    capital_flow_reversal:  { label: 'Capital Flow Reversal',     signals: ['capital flow', 'foreign investment', 'fdi', 'portfolio outflow', 'currency', 'reserve', 'flight', 'repatriation'] }
  };

  // Which mechanisms are VALID for each diagnosis
  var DX_VALID_MECHANISMS = {
    'RECESSION':       ['demand_contraction', 'labor_market_shift', 'credit_tightening', 'monetary_policy_impact', 'fiscal_stress', 'structural_reform'],
    'HYPERINFLATION':  ['inflation_persistence', 'monetary_policy_impact', 'fiscal_stress', 'capital_flow_reversal', 'trade_disruption', 'demand_contraction'],
    'BANKING_CRISIS':  ['credit_tightening', 'debt_service_pressure', 'monetary_policy_impact', 'capital_flow_reversal', 'fiscal_stress', 'demand_contraction'],
    'TRADE_WAR':       ['trade_disruption', 'demand_contraction', 'inflation_persistence', 'capital_flow_reversal', 'labor_market_shift', 'structural_reform'],
    'DEBT_CRISIS':     ['debt_service_pressure', 'fiscal_stress', 'capital_flow_reversal', 'credit_tightening', 'monetary_policy_impact', 'inflation_persistence'],
    'MARKET_CRASH':    ['capital_flow_reversal', 'credit_tightening', 'demand_contraction', 'debt_service_pressure', 'monetary_policy_impact', 'fiscal_stress']
  };

  // Patterns that indicate NO valid mechanism (social/policy drift)
  var DRIFT_SIGNALS = ['equity program', 'assistance program', 'social program', 'community engagement', 'stakeholder alignment', 'workforce development', 'cultural program', 'certification program', 'training curriculum', 'coaching program', 'onboarding', 'outreach', 'awareness campaign'];

  /**
   * Classify a directive's primary and secondary economic mechanism.
   */
  function classifyMechanism(d) {
    var text = ((d.treatmentLabel || '') + ' ' + (d.treatmentDescription || '') + ' '
      + (d.nodeLabel || '') + ' ' + (d.treatmentTarget || '') + ' '
      + ((d.treatmentSteps || []).join ? (d.treatmentSteps || []).join(' ') : '')).toLowerCase();

    // Check for drift
    var driftHits = 0;
    for (var di = 0; di < DRIFT_SIGNALS.length; di++) {
      if (text.indexOf(DRIFT_SIGNALS[di]) !== -1) driftHits++;
    }
    if (driftHits >= 2) {
      return { primary: null, secondary: null, score: 0, label: 'DRIFT', isDrift: true };
    }

    // Score each mechanism by signal hits
    var scored = [];
    var mechKeys = Object.keys(MECHANISMS);
    for (var mi = 0; mi < mechKeys.length; mi++) {
      var mkey = mechKeys[mi];
      var mech = MECHANISMS[mkey];
      var hits = 0;
      for (var si = 0; si < mech.signals.length; si++) {
        if (text.indexOf(mech.signals[si]) !== -1) hits++;
      }
      if (hits > 0) scored.push({ key: mkey, label: mech.label, hits: hits });
    }

    scored.sort(function (a, b) { return b.hits - a.hits; });

    var primary = scored.length > 0 ? scored[0] : null;
    var secondary = scored.length > 1 ? scored[1] : null;

    // Check if primary mechanism is valid for this diagnosis
    var dxId = (d.diagnosisId || '').toUpperCase();
    var validMechs = DX_VALID_MECHANISMS[dxId] || [];
    var primaryValid = primary && validMechs.indexOf(primary.key) !== -1;
    var secondaryValid = secondary && validMechs.indexOf(secondary.key) !== -1;

    // If primary is invalid but secondary is valid, swap
    if (!primaryValid && secondaryValid) {
      var tmp = primary; primary = secondary; secondary = tmp;
      primaryValid = true;
    }

    // Score: valid primary = high, invalid = low
    var score = 0;
    if (primaryValid) score = 0.5 + Math.min(0.4, primary.hits * 0.08);
    else if (primary) score = 0.2 + Math.min(0.15, primary.hits * 0.03);
    if (driftHits > 0) score = Math.max(0, score - driftHits * 0.1);

    return {
      primary: primary ? primary.key : null,
      primaryLabel: primary ? primary.label : null,
      secondary: secondary ? secondary.key : null,
      secondaryLabel: secondary ? secondary.label : null,
      score: Math.max(0, Math.min(1, score)),
      label: primary ? primary.label : (driftHits > 0 ? 'DRIFT' : 'UNCLASSIFIED'),
      isDrift: driftHits >= 2,
      isValid: primaryValid
    };
  }

  /**
   * Score economic relevance using mechanism classification.
   */
  function _scoreEconomicRelevance(d) {
    var mech = classifyMechanism(d);
    d._mechanism = mech;
    return mech.score;
  }

  /**
   * Score and rank an array of extracted directives.
   */
  function rank(directives) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return [];
    if (!directives || directives.length === 0) return [];

    for (var i = 0; i < directives.length; i++) {
      var d = directives[i];

      // 0. Economic relevance — diagnosis-specific alignment
      var econRelevance = _scoreEconomicRelevance(d);

      // 1. Diagnosis proximity
      var dxProximity = d.diagnosisId ? 1.0 : 0.3;

      // 2. Evidence strength
      var circuitEvidence = EVIDENCE_SCORE[d.circuitEvidence] || 0.3;
      var treatEvidence = EVIDENCE_SCORE[d.treatmentEvidence] || 0.3;

      // 3. Execution readiness
      var typeInfo = TYPE_ACTION_MAP[d.treatmentType] || TYPE_ACTION_MAP['STRUCTURAL'];
      var executionScore = typeInfo.weight;

      // 4. Node role
      var roleScore = ROLE_WEIGHT[d.functionalRole] || 0.5;

      // 5. Urgency
      var urgencyScore = Math.min(1, (d.stress || 0) * 1.2);

      // 6. Monetization potential
      var monetizationScore = 0.2;
      if (d.companies && d.companies.length > 0) {
        var avgBinding = 0;
        for (var ci = 0; ci < d.companies.length; ci++) avgBinding += (d.companies[ci].bindingStrength || 0);
        avgBinding = avgBinding / d.companies.length;
        monetizationScore = 0.2 + (avgBinding * 0.8);
      }

      // 7. TREATMENT RICHNESS — the key differentiator between shallow and deep
      var richness = 0;
      var hasRealSteps = d.treatmentSteps && d.treatmentSteps.length > 0;
      var hasMonitoring = !!d.treatmentMonitoring;
      var hasEscalation = !!d.treatmentEscalation;
      var hasCitations = !!(d.treatmentCite || (d.treatmentCitation && d.treatmentCitation.length > 0));
      var hasTarget = !!d.treatmentTarget;
      var hasDescription = d.treatmentDescription && d.treatmentDescription.length > 80;

      if (hasRealSteps) richness += 0.25;
      if (hasMonitoring) richness += 0.20;
      if (hasEscalation) richness += 0.15;
      if (hasCitations) richness += 0.20;
      if (hasTarget) richness += 0.10;
      if (hasDescription) richness += 0.10;

      // 8. Depth factor
      var depthIdx = Math.min(d.depth || 0, DEPTH_FACTOR.length - 1);
      var depthPenalty = DEPTH_FACTOR[depthIdx];
      if (richness >= 0.5) depthPenalty = Math.min(1, depthPenalty + 0.10);
      if (richness >= 0.8) depthPenalty = Math.min(1, depthPenalty + 0.10);

      // SHALLOW PENALTY
      var effectiveDxProx = dxProximity;
      if (dxProximity >= 0.8 && richness < 0.15) {
        effectiveDxProx = 0.5;
      }

      // Composite score — richness + economic relevance are the heaviest factors
      var raw = (
        effectiveDxProx * 0.10 +
        circuitEvidence * 0.05 +
        treatEvidence * 0.06 +
        executionScore * 0.08 +
        roleScore * 0.03 +
        urgencyScore * 0.10 +
        monetizationScore * 0.08 +
        richness * 0.22 +
        econRelevance * 0.18 +
        (d.branchRelevance || 0) * 0.04 +
        Math.min(0.06, (d.depth || 0) * 0.015 * richness)
      );

      var econMultiplier = econRelevance < 0.3 ? 0.6 : econRelevance < 0.5 ? 0.85 : 1.0;
      var rankScore = raw * depthPenalty * econMultiplier;

      // ── PROOF SCORE ──
      var proofScore = (
        richness * 0.40 +
        (hasRealSteps ? 0.15 : 0) +
        (hasCitations ? 0.15 : 0) +
        (hasMonitoring ? 0.10 : 0) +
        (d.depth >= 1 ? 0.10 : 0) +
        (d.depth >= 2 ? 0.10 : 0)
      );

      d.scores = {
        dxProximity: effectiveDxProx,
        circuitEvidence: circuitEvidence,
        treatEvidence: treatEvidence,
        execution: executionScore,
        role: roleScore,
        urgency: urgencyScore,
        monetization: monetizationScore,
        richness: richness,
        econRelevance: econRelevance,
        depthPenalty: depthPenalty,
        econMultiplier: econMultiplier,
        proofScore: Math.round(proofScore * 1000) / 1000,
        raw: Math.round(raw * 1000) / 1000
      };
      d.rankScore = Math.round(rankScore * 1000) / 1000;
      d.proofScore = Math.round(proofScore * 1000) / 1000;
      d.suggestedPaths = typeInfo.paths;

      // Metadata flags for downstream
      d._hasRealSteps = hasRealSteps;
      d._hasMonitoring = hasMonitoring;
      d._hasEscalation = hasEscalation;
      d._hasCitations = hasCitations;
      d._richness = richness;
    }

    directives.sort(function (a, b) { return b.rankScore - a.rankScore; });

    console.log('[EconomyDirectiveRanker] Ranked ' + directives.length + '. Top: ' +
      (directives[0] ? directives[0].rankScore + ' (rich=' + directives[0]._richness + ', proof=' + directives[0].proofScore + ') ' + directives[0].treatmentLabel.substring(0, 50) : 'none'));

    return directives;
  }

  window.LIMENEconomyDirectiveRanker = { rank: rank };
})();
