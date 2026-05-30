/**
 * energy-directive-ranker.js — Score and rank extracted directive candidates
 *
 * Depth-aware ranking that prevents shallow L0 items from dominating when
 * richer L1-L5 directives exist. Specificity and treatment richness are
 * weighted strongly enough that a deep, well-evidenced directive can outrank
 * a shallow diagnosis-circuit item.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENEnergyDirectiveRanker
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

  // Mechanism definitions: each has a label, description, and signal patterns
  // Patterns are tested against concatenated directive text (label + description + node + target + steps)
  var MECHANISMS = {
    supply_disruption:    { label: 'Supply Disruption',     signals: ['supply', 'shortage', 'disruption', 'embargo', 'cutoff', 'curtail', 'scarcity', 'outage', 'shut down', 'shutdown', 'reserves', 'strategic reserve', 'stockpile'] },
    price_dislocation:    { label: 'Price Dislocation',     signals: ['price', 'pricing', 'repric', 'cost', 'margin', 'premium', 'spike', 'volatil', 'futures', 'spot', 'forward', 'spread', 'basis', 'value-at-risk', 'var ', 'market surveillance'] },
    contract_mispricing:  { label: 'Contract Mispricing',   signals: ['contract', 'bilateral', 'counterparty', 'hedge', 'renegotiat', 'settlement', 'credit', 'default', 'exposure', 'procurement', 'tender', 'offtake'] },
    logistics_constraint: { label: 'Logistics Constraint',  signals: ['pipeline', 'transport', 'throughput', 'routing', 'reroute', 'bottleneck', 'congestion', 'capacity', 'terminal', 'port', 'shipping', 'tanker', 'rail', 'truck', 'logistics', 'midstream'] },
    refining_shift:       { label: 'Refining Shift',        signals: ['refin', 'crude assay', 'blend', 'feedstock', 'distillation', 'cracking', 'yield', 'process control', 'catalyst', 'downstream', 'petrochemical', 'product slate'] },
    inventory_imbalance:  { label: 'Inventory Imbalance',   signals: ['inventory', 'storage', 'drawdown', 'build', 'reserve', 'buffer', 'stockpile', 'days of supply', 'tank', 'cavern', 'spr'] },
    production_impact:    { label: 'Production Impact',     signals: ['production', 'extraction', 'drilling', 'well', 'output', 'generation', 'capacity factor', 'ramp', 'baseload', 'dispatch', 'autonomous', 'mining', 'depletion'] },
    infrastructure_stress:{ label: 'Infrastructure Stress',  signals: ['infrastructure', 'grid', 'transmission', 'distribution', 'hardening', 'resilience', 'substation', 'transformer', 'relay', 'protection', 'fault', 'blackout', 'data center', 'hyperscale', 'compute', 'load growth', 'interconnection', 'queue', 'capacity constraint', 'peak demand', 'congestion', 'curtailment'] },
    policy_response:      { label: 'Policy Response',       signals: ['regulatory', 'regulation', 'policy', 'mandate', 'compliance', 'subsidy', 'incentive', 'tariff', 'sanction', 'moratorium', 'emergency order', 'strategic petroleum'] },
    market_structure:     { label: 'Market Structure',      signals: ['trading', 'commodity', 'exchange', 'clearing', 'settlement', 'market design', 'auction', 'dispatch', 'merit order', 'capacity market', 'ancillary'] }
  };

  // Which mechanisms are VALID for each diagnosis
  var DX_VALID_MECHANISMS = {
    'OIL_SHOCK':               ['supply_disruption', 'price_dislocation', 'contract_mispricing', 'logistics_constraint', 'refining_shift', 'inventory_imbalance', 'production_impact'],
    'GRID_COLLAPSE':           ['infrastructure_stress', 'supply_disruption', 'production_impact', 'market_structure', 'policy_response'],
    'PIPELINE_DISRUPTION':     ['logistics_constraint', 'supply_disruption', 'contract_mispricing', 'infrastructure_stress', 'inventory_imbalance'],
    'NUCLEAR_INCIDENT':        ['production_impact', 'supply_disruption', 'infrastructure_stress', 'policy_response'],
    'RENEWABLE_INTERMITTENCY': ['supply_disruption', 'production_impact', 'inventory_imbalance', 'infrastructure_stress', 'market_structure']
  };

  // Patterns that indicate NO valid mechanism (social/policy drift)
  var DRIFT_SIGNALS = ['equity program', 'assistance program', 'social program', 'community engagement', 'stakeholder alignment', 'workforce development', 'cultural program', 'certification program', 'training curriculum', 'coaching program', 'onboarding', 'outreach', 'awareness campaign'];

  /**
   * Classify a directive's primary and secondary economic mechanism.
   * Returns { primary: string|null, secondary: string|null, score: 0-1, label: string, isDrift: boolean }
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
    else if (primary) score = 0.2 + Math.min(0.15, primary.hits * 0.03); // mechanism found but not valid for this dx
    // Drift penalty
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
   * Replaces pure keyword matching with structural classification.
   */
  function _scoreEconomicRelevance(d) {
    var mech = classifyMechanism(d);
    // Attach classification to directive for downstream use
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

      // 1. Diagnosis proximity — still valuable but reduced for shallow items
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
      //    This is now the strongest single factor.
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
      // richness range: 0 (shallow L0) to 1.0 (full depth)

      // 8. Depth factor — softer penalty, compensated by richness
      var depthIdx = Math.min(d.depth || 0, DEPTH_FACTOR.length - 1);
      var depthPenalty = DEPTH_FACTOR[depthIdx];
      // Rich deep items get depth penalty relief
      if (richness >= 0.5) depthPenalty = Math.min(1, depthPenalty + 0.10);
      if (richness >= 0.8) depthPenalty = Math.min(1, depthPenalty + 0.10);

      // SHALLOW PENALTY — if on a diagnosis circuit but has zero richness,
      // reduce effective dxProximity. Being on the right node doesn't help
      // if the treatment is empty.
      var effectiveDxProx = dxProximity;
      if (dxProximity >= 0.8 && richness < 0.15) {
        effectiveDxProx = 0.5; // still relevant, but not dominant
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

      // Apply depth penalty AND economic relevance as multiplier
      // Low econ relevance (<0.3) further reduces score by 40%
      var econMultiplier = econRelevance < 0.3 ? 0.6 : econRelevance < 0.5 ? 0.85 : 1.0;
      var rankScore = raw * depthPenalty * econMultiplier;

      // ── PROOF SCORE — how convincing is this as a demonstration item ──
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

    console.log('[DirectiveRanker] Ranked ' + directives.length + '. Top: ' +
      (directives[0] ? directives[0].rankScore + ' (rich=' + directives[0]._richness + ', proof=' + directives[0].proofScore + ') ' + directives[0].treatmentLabel.substring(0, 50) : 'none'));

    return directives;
  }

  window.LIMENEnergyDirectiveRanker = { rank: rank };
})();
