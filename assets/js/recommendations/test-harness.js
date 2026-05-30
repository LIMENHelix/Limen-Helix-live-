/**
 * LIMEN Recommendation Runtime — Test Harness
 *
 * Self-contained test runner for the recommendation scaffold.
 * Runs in browser (load after all 4 recommendation modules) or
 * in Node.js with the provided shim setup.
 *
 * Usage (browser):
 *   <script src="recommendations/remedy-resolver.js"></script>
 *   <script src="recommendations/evidence-builder.js"></script>
 *   <script src="recommendations/scale-translator.js"></script>
 *   <script src="recommendations/recommendation-engine.js"></script>
 *   <script src="recommendations/test-harness.js"></script>
 *   <script>LIMENTestHarness.runAll();</script>
 *
 * Usage (Node.js):
 *   node test-harness.js
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Node.js compatibility shim
  // ═══════════════════════════════════════════════════════════════════════════

  var isNode = typeof window === 'undefined';
  var _global = isNode ? global : window;

  if (isNode) {
    // Shim browser globals
    _global.window = _global;
    _global.localStorage = {
      _store: {},
      getItem: function (k) { return this._store[k] || null; },
      setItem: function (k, v) { this._store[k] = v; },
      removeItem: function (k) { delete this._store[k]; }
    };
    _global.CustomEvent = function (name, opts) { this.type = name; this.detail = (opts && opts.detail) || null; };
    _global.dispatchEvent = function () {};

    // Load modules
    var fs = require('fs');
    var path = require('path');
    var dir = __dirname || '.';
    eval(fs.readFileSync(path.join(dir, 'remedy-resolver.js'), 'utf8'));
    eval(fs.readFileSync(path.join(dir, 'evidence-builder.js'), 'utf8'));
    eval(fs.readFileSync(path.join(dir, 'scale-translator.js'), 'utf8'));
    eval(fs.readFileSync(path.join(dir, 'recommendation-engine.js'), 'utf8'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Test fixtures — simulated propagation + node states
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fixture 1: Threat cascade — limbic hyperactivation
   * BLA(17), CeA(18) hyper; OFC(6) hypo; seeded by environment stress
   */
  var FIXTURE_THREAT_CASCADE = {
    propagationResult: {
      activations: {
        17: 0.82, 18: 0.71, 54: 0.69, 6: 0.15, 9: 0.55,
        12: 0.30, 1: 0.20, 31: 0.45, 73: 0.10
      },
      hyper: [17, 18, 54],
      steps: 8,
      convergenceStep: 6,
      converged: true
    },
    nodeStates: {
      17: { activation: 0.82, direction: 'hyper', predictionError: 0.35, system: 'limbic', label: 'BLA', salience: 0.9, activationMean: 0.45, activationVar: 0.08, seedSource: 'noaa_alerts' },
      18: { activation: 0.71, direction: 'hyper', predictionError: 0.28, system: 'limbic', label: 'CeA', salience: 0.75, activationMean: 0.38, activationVar: 0.06, seedSource: null },
      54: { activation: 0.69, direction: 'hyper', predictionError: 0.15, system: 'limbic', label: 'HPC-tail', salience: 0.6, activationMean: 0.40, activationVar: 0.05, seedSource: null },
      6:  { activation: 0.15, direction: 'hypo',  predictionError: -0.32, system: 'executive', label: 'OFC', salience: 0.4, activationMean: 0.50, activationVar: 0.05, seedSource: null },
      9:  { activation: 0.55, direction: 'hyper', predictionError: 0.12, system: 'salience', label: 'ACC', salience: 0.65, activationMean: 0.42, activationVar: 0.07, seedSource: null },
      12: { activation: 0.30, direction: 'silent', predictionError: 0.05, system: 'executive', label: 'DLPFC', salience: 0.3, activationMean: 0.35, activationVar: 0.04, seedSource: null },
      1:  { activation: 0.20, direction: 'silent', predictionError: 0.02, system: 'dmn', label: 'mPFC', salience: 0.2, activationMean: 0.30, activationVar: 0.03, seedSource: null },
      31: { activation: 0.45, direction: 'hyper', predictionError: 0.18, system: 'hpa', label: 'HYPO', salience: 0.5, activationMean: 0.30, activationVar: 0.06, seedSource: 'eia_crude' },
      73: { activation: 0.10, direction: 'silent', predictionError: 0.0, system: 'autonomic', label: 'ENS', salience: 0.1, activationMean: 0.15, activationVar: 0.02, seedSource: null }
    },
    feedSources: [
      { feedId: 'noaa_alerts', feedName: 'NOAA Alerts', domain: 'environment', value: 42, stress: 0.78, live: true, fetchedAt: Date.now() - 5000, contributesTo: [17, 54] },
      { feedId: 'eia_crude', feedName: 'EIA Crude Oil', domain: 'energy', value: 87.50, stress: 0.55, live: true, fetchedAt: Date.now() - 8000, contributesTo: [31] },
      { feedId: 'fred_unemployment', feedName: 'FRED Unemployment', domain: 'economy', value: 3.8, stress: 0.35, live: true, fetchedAt: Date.now() - 15000, contributesTo: [6, 12] }
    ],
    sourceHealth: 1.0
  };

  /**
   * Fixture 2: Cross-domain resonance — multi-domain stress activation
   * HYPO(31), ENS(73), AI(8) all hyper; multiple hot clusters
   */
  var FIXTURE_CROSS_DOMAIN = {
    propagationResult: {
      activations: {
        31: 0.72, 73: 0.61, 8: 0.54, 6: 0.48,
        12: 0.42, 17: 0.35, 32: 0.55, 33: 0.50
      },
      hyper: [31, 73, 8],
      steps: 10,
      convergenceStep: null,
      converged: false
    },
    nodeStates: {
      31: { activation: 0.72, direction: 'hyper', predictionError: 0.45, system: 'hpa', label: 'HYPO', salience: 0.85, activationMean: 0.35, activationVar: 0.12, seedSource: 'eia_crude' },
      73: { activation: 0.61, direction: 'hyper', predictionError: 0.20, system: 'autonomic', label: 'ENS', salience: 0.6, activationMean: 0.28, activationVar: 0.08, seedSource: null },
      8:  { activation: 0.54, direction: 'hyper', predictionError: 0.15, system: 'salience', label: 'AI', salience: 0.7, activationMean: 0.35, activationVar: 0.06, seedSource: null },
      6:  { activation: 0.48, direction: 'hyper', predictionError: 0.08, system: 'executive', label: 'OFC', salience: 0.5, activationMean: 0.40, activationVar: 0.05, seedSource: null },
      12: { activation: 0.42, direction: 'hyper', predictionError: 0.10, system: 'executive', label: 'DLPFC', salience: 0.4, activationMean: 0.35, activationVar: 0.04, seedSource: null },
      17: { activation: 0.35, direction: 'silent', predictionError: 0.05, system: 'limbic', label: 'BLA', salience: 0.3, activationMean: 0.30, activationVar: 0.03, seedSource: null },
      32: { activation: 0.55, direction: 'hyper', predictionError: 0.22, system: 'hpa', label: 'PIT', salience: 0.55, activationMean: 0.25, activationVar: 0.09, seedSource: null },
      33: { activation: 0.50, direction: 'hyper', predictionError: 0.18, system: 'hpa', label: 'ADR', salience: 0.5, activationMean: 0.22, activationVar: 0.08, seedSource: null }
    },
    feedSources: [
      { feedId: 'eia_crude', feedName: 'EIA Crude Oil', domain: 'energy', value: 95.40, stress: 0.68, live: true, fetchedAt: Date.now() - 3000, contributesTo: [31] },
      { feedId: 'noaa_alerts', feedName: 'NOAA Alerts', domain: 'environment', value: 38, stress: 0.60, live: true, fetchedAt: Date.now() - 10000, contributesTo: [73] },
      { feedId: 'fred_unemployment', feedName: 'FRED Unemployment', domain: 'economy', stress: 0.52, live: false, fetchedAt: Date.now() - 600000, contributesTo: [6, 12] }
    ],
    sourceHealth: 0.67
  };

  /**
   * Sample remedy registry for testing.
   * Matches remedy-schema.json contract exactly.
   */
  var SAMPLE_REGISTRY = {
    version: '0.1.0',
    generatedAt: Date.now(),
    remedyCount: 2,
    scaleBreakdown: { mainUser: 0, portalUser: 1, business: 0, domain: 0, civilization: 1 },
    remedies: [
      {
        id: 'rem-portalUser-a8c3f1e2',
        version: 1,
        state: 'ACTIVE',
        scale: 'portalUser',
        createdAt: 1710400000,
        updatedAt: 1710400000,
        linkedDomains: ['health'],
        linkedPortals: ['medicine_psychiatry_mood_depression_assess'],
        linkedNodes: [
          { nodeId: 17, nodeLabel: 'BLA', targetDirection: 'hyper', effectDirection: 'down', weight: 1.0 },
          { nodeId: 6, nodeLabel: 'OFC', targetDirection: 'hypo', effectDirection: 'up', weight: 0.6 }
        ],
        linkedSystems: ['limbic', 'executive'],
        linkedChannels: ['cortico-limbic'],
        remedyType: 'STRATEGY',
        targetDirection: 'hyper',
        mechanism: 'Amygdala hyperactivation -> CBT reappraisal training -> Prefrontal regulatory restoration',
        addressesPatterns: [
          { patternClass: 'threat_cascade', applicability: 0.92, nodeSignature: [17, 18, 6] },
          { patternClass: 'regulation_failure', applicability: 0.55, nodeSignature: [17, 6] }
        ],
        contraindications: [
          { type: 'safety', description: 'Do not apply during active psychotic episode', conflictsWith: null, severity: 'hard', condition: null },
          { type: 'temporal_conflict', description: 'Allow pharmacological stabilization before beginning exposure', conflictsWith: null, severity: 'soft', condition: null }
        ],
        evidenceType: 'A',
        citations: [{ author: 'Hofmann et al.', year: 2012, title: 'CBT Efficacy Meta-analysis' }],
        cite: 'Hofmann et al. 2012',
        timeHorizon: 'short',
        onsetDelay: '2-4 weeks',
        duration: '12-16 sessions',
        expectedEffect: {
          expectedShift: 'BLA activation decrease 0.2-0.4',
          monitoringSignal: 'BLA activation level',
          successCriteria: 'BLA below 0.6 for 3 sessions',
          failureCriteria: 'No reduction after 6 sessions'
        },
        confidence: 0.82,
        confidenceDetail: {
          confidenceScore: 0.82,
          confidenceFactors: { evidenceStrength: 1.0, patternSpecificity: 0.92, outcomeClarity: 1.0, historicalSuccess: 0.78 },
          confidenceTier: 'high'
        },
        confidenceTier: 'high',
        historicalExamples: [
          { context: 'CBT for anxiety in primary care', outcome: '64% improvement at 12mo', year: 2012, scaleAtTime: 'portalUser', effectiveness: 0.78 }
        ],
        scalePayload: {
          treatmentLabel: 'CBT Exposure Protocol',
          treatmentType: 'STRATEGY',
          steps: ['Psychoeducation', 'Identify distortions', 'Exposure hierarchy', 'Graduated exposure'],
          monitoring: 'Weekly BLA proxy',
          escalation: 'Pharmacological adjunct after 6 sessions',
          target: 'BLA -> exposure -> OFC restoration',
          sourcePortalId: 'medicine_psychiatry_mood_depression_assess',
          sourceBrainNodeId: 'BLA'
        }
      },
      {
        id: 'rem-civilization-c7e2d4a1',
        version: 1,
        state: 'ACTIVE',
        scale: 'civilization',
        createdAt: 1710400000,
        updatedAt: 1710400000,
        linkedDomains: ['energy', 'environment', 'economy'],
        linkedPortals: [],
        linkedNodes: [
          { nodeId: 31, nodeLabel: 'HYPO', targetDirection: 'hyper', effectDirection: 'stabilize', weight: 0.8 },
          { nodeId: 73, nodeLabel: 'ENS', targetDirection: 'hyper', effectDirection: 'down', weight: 0.6 }
        ],
        linkedSystems: ['hpa', 'autonomic'],
        linkedChannels: ['hpa-axis', 'gut-brain'],
        remedyType: 'STRUCTURAL',
        targetDirection: 'hyper',
        mechanism: 'Cross-domain stress -> Coordinated regulatory framework -> Systemic stabilization',
        addressesPatterns: [
          { patternClass: 'cross_domain_resonance', applicability: 0.85, nodeSignature: [31, 73, 8] },
          { patternClass: 'phase_transition', applicability: 0.60, nodeSignature: [31] }
        ],
        contraindications: [
          { type: 'resource_conflict', description: 'Cannot coordinate three bodies during active crisis', conflictsWith: null, severity: 'conditional', condition: null }
        ],
        evidenceType: 'Moderate',
        citations: [],
        cite: 'Structural analogy from 2008 crisis response',
        timeHorizon: 'structural',
        onsetDelay: '6-18 months',
        duration: 'Permanent institutional change',
        expectedEffect: {
          expectedShift: 'Resonance decrease from >0.7 to <0.4',
          monitoringSignal: 'Cross-domain resonance score',
          successCriteria: 'Resonance below 0.4 for 4 quarters',
          failureCriteria: 'Resonance exceeds 0.8 despite intervention'
        },
        confidence: 0.52,
        confidenceDetail: {
          confidenceScore: 0.52,
          confidenceFactors: { evidenceStrength: 0.60, patternSpecificity: 0.85, outcomeClarity: 1.0, historicalSuccess: 0.45 },
          confidenceTier: 'low'
        },
        confidenceTier: 'low',
        historicalExamples: [
          { context: 'Post-2008 cross-sector coordination', outcome: 'Reduced contagion but added compliance costs', year: 2010, scaleAtTime: 'civilization', effectiveness: 0.45 }
        ],
        scalePayload: {
          systemicAction: 'Establish cross-domain regulatory coordination framework',
          affectedDomains: ['energy', 'environment', 'economy'],
          resonanceThreshold: 0.7,
          phaseTransition: false,
          stabilityTarget: 0.55,
          precedent: 'Dodd-Frank 2010 model'
        }
      }
    ],
    index: {
      byScale: { portalUser: ['rem-portalUser-a8c3f1e2'], civilization: ['rem-civilization-c7e2d4a1'] },
      byPattern: { threat_cascade: ['rem-portalUser-a8c3f1e2'], cross_domain_resonance: ['rem-civilization-c7e2d4a1'] },
      byNode: { '17': ['rem-portalUser-a8c3f1e2'], '31': ['rem-civilization-c7e2d4a1'] },
      byDomain: { health: ['rem-portalUser-a8c3f1e2'], energy: ['rem-civilization-c7e2d4a1'] },
      byPortal: { medicine_psychiatry_mood_depression_assess: ['rem-portalUser-a8c3f1e2'] },
      byType: { STRATEGY: ['rem-portalUser-a8c3f1e2'], STRUCTURAL: ['rem-civilization-c7e2d4a1'] },
      byEvidence: { A: ['rem-portalUser-a8c3f1e2'], Moderate: ['rem-civilization-c7e2d4a1'] }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Test runner
  // ═══════════════════════════════════════════════════════════════════════════

  var _pass = 0;
  var _fail = 0;
  var _log = [];

  function assert(name, condition, detail) {
    if (condition) {
      _pass++;
      _log.push('  PASS: ' + name);
    } else {
      _fail++;
      _log.push('  FAIL: ' + name + (detail ? ' — ' + detail : ''));
    }
  }

  function section(name) {
    _log.push('\n── ' + name + ' ──');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tests
  // ═══════════════════════════════════════════════════════════════════════════

  function testRemedyResolver() {
    section('Remedy Resolver');

    // Install sample registry
    _global.LIMENRemedyRegistry = SAMPLE_REGISTRY;

    var resolver = _global.LIMENRemedyResolver;
    assert('resolver exists', !!resolver);

    // Test: resolve portalUser for threat_cascade (should find CBT remedy)
    var result = resolver.resolve({
      patternClass: 'threat_cascade',
      scale: 'portalUser',
      affectedNodes: [17, 18, 54],
      dominantDirection: 'hyper',
      nodeStates: FIXTURE_THREAT_CASCADE.nodeStates,
      sourceHealth: 1.0
    });
    assert('portalUser threat_cascade found remedies', result.selectedRemedies.length > 0);
    assert('found CBT remedy', result.selectedRemedies[0] && result.selectedRemedies[0].remedyId === 'rem-portalUser-a8c3f1e2');
    assert('not a fallback', !result.isFallback);
    assert('has composite score', result.selectedRemedies[0] && result.selectedRemedies[0].compositeScore > 0);

    // Test: resolve mainUser for threat_cascade (no remedy in registry → fallback)
    var mainResult = resolver.resolve({
      patternClass: 'threat_cascade',
      scale: 'mainUser',
      affectedNodes: [17, 18],
      dominantDirection: 'hyper',
      nodeStates: {},
      sourceHealth: 1.0
    });
    assert('mainUser threat_cascade is fallback', mainResult.isFallback);
    assert('fallback has warning', mainResult.fallback && mainResult.fallback.warning && mainResult.fallback.warning.length > 0);

    // Test: resolve civilization for cross_domain_resonance
    var civResult = resolver.resolve({
      patternClass: 'cross_domain_resonance',
      scale: 'civilization',
      affectedNodes: [31, 73, 8],
      dominantDirection: 'hyper',
      nodeStates: FIXTURE_CROSS_DOMAIN.nodeStates,
      sourceHealth: 0.67
    });
    assert('civilization cross_domain found remedies', civResult.selectedRemedies.length > 0);

    // Test: gap accumulation
    var gap = resolver.accumulateGap({ patternClass: 'phase_transition', scale: 'mainUser', affectedNodes: [12], fallbackLevel: 3, timestamp: Date.now(), frequency: 1 });
    assert('gap accumulated', gap && gap.frequency >= 1);

    // Test: constants exposed for verification
    assert('14 adjacent patterns', Object.keys(resolver._ADJACENT_PATTERNS).length === 14);
    assert('selection weights sum ~1', Math.abs(
      resolver._SELECTION_WEIGHTS.applicability + resolver._SELECTION_WEIGHTS.nodeMatch +
      resolver._SELECTION_WEIGHTS.confidence + resolver._SELECTION_WEIGHTS.evidence - 1.0) < 0.01);
  }

  function testEvidenceBuilder() {
    section('Evidence Builder');

    var builder = _global.LIMENEvidenceBuilder;
    assert('builder exists', !!builder);

    // Test: build envelope for threat cascade
    var envelope = builder.build({
      recommendationId: 'rec-test-001',
      pattern: {
        patternClass: 'threat_cascade',
        affectedNodes: [17, 18, 54],
        affectedSystems: ['limbic'],
        dominantDirection: 'hyper',
        timeHorizon: 'immediate',
        hotClusters: [{ nodes: [17, 18, 54], system: 'limbic', meanAct: 0.74, peakNode: 17 }],
        coldGaps: [],
        predictionViolations: [],
        oscillatingNodes: []
      },
      nodeStates: FIXTURE_THREAT_CASCADE.nodeStates,
      feedSources: FIXTURE_THREAT_CASCADE.feedSources,
      propagationResult: FIXTURE_THREAT_CASCADE.propagationResult
    });

    assert('envelope has recommendationId', envelope.recommendationId === 'rec-test-001');
    assert('envelope has generatedAt', typeof envelope.generatedAt === 'number');
    assert('envelope has historical', !!envelope.historical);
    assert('envelope has currentState', !!envelope.currentState);
    assert('envelope has projected', !!envelope.projected);
    assert('envelope has overallConfidence', typeof envelope.overallConfidence === 'number' && envelope.overallConfidence >= 0 && envelope.overallConfidence <= 1);
    assert('envelope has overallTier', ['high', 'moderate', 'low', 'insufficient'].indexOf(envelope.overallTier) >= 0);
    assert('envelope has uncertaintyStatement', typeof envelope.uncertaintyStatement === 'string' && envelope.uncertaintyStatement.length > 0);
    assert('envelope has temporalBalance', !!envelope.temporalBalance);
    assert('temporal weights sum ~1', Math.abs(envelope.temporalBalance.historicalWeight + envelope.temporalBalance.currentWeight + envelope.temporalBalance.projectedWeight - 1.0) < 0.01);
    assert('envelope has display', !!envelope.display);

    // Current state checks
    var cs = envelope.currentState;
    assert('feedSnapshot populated', cs.feedSnapshot.length > 0);
    assert('nodeSnapshot populated', cs.nodeSnapshot.length > 0);
    assert('dataQuality present', !!cs.dataQuality);
    assert('dataQuality has qualityGrade', ['full', 'high', 'degraded', 'poor'].indexOf(cs.dataQuality.qualityGrade) >= 0);
    assert('propagationSnapshot present', !!cs.propagationSnapshot);
    assert('propagationSnapshot converged', cs.propagationSnapshot.converged === true);

    // Projected evidence checks
    var proj = envelope.projected;
    assert('projections array exists', Array.isArray(proj.projections));
    assert('dominant trajectory set', typeof proj.dominantTrajectory === 'string');
    assert('method statement present', proj.methodStatement.length > 0);

    // Test: analogue storage
    var analogue = builder.storeAnalogue(
      { patternClass: 'threat_cascade', affectedNodes: [17, 18], affectedSystems: ['limbic'], dominantDirection: 'hyper' },
      FIXTURE_THREAT_CASCADE.nodeStates,
      FIXTURE_THREAT_CASCADE.feedSources,
      FIXTURE_THREAT_CASCADE.propagationResult
    );
    assert('analogue stored', analogue && analogue.id && analogue.id.startsWith('pa-'));

    // Test: cosine similarity
    var sim = builder._cosineSimilarity({ 1: 0.5, 2: 0.5 }, { 1: 0.5, 2: 0.5 });
    assert('self-similarity = 1', Math.abs(sim - 1.0) < 0.001);
    var sim2 = builder._cosineSimilarity({ 1: 1, 2: 0 }, { 1: 0, 2: 1 });
    assert('orthogonal similarity = 0', Math.abs(sim2) < 0.001);

    // Test: staleness
    assert('fresh staleness', builder._staleness(Date.now() - 5000) === 'fresh');
    assert('stale staleness', builder._staleness(Date.now() - 1000000) === 'stale');
    assert('expired staleness', builder._staleness(Date.now() - 3600000) === 'expired');

    // Test: tier from score
    assert('tier high', builder._tierFromScore(0.80) === 'high');
    assert('tier moderate', builder._tierFromScore(0.60) === 'moderate');
    assert('tier low', builder._tierFromScore(0.42) === 'low');
    assert('tier insufficient', builder._tierFromScore(0.30) === 'insufficient');
  }

  function testScaleTranslator() {
    section('Scale Translator');

    var translator = _global.LIMENScaleTranslator;
    assert('translator exists', !!translator);

    // Test: scale applicability
    var sa = translator._SCALE_APPLICABILITY;
    assert('14 pattern classes in applicability', Object.keys(sa).length === 14);
    assert('threat_cascade all-scale', sa.threat_cascade.mainUser && sa.threat_cascade.civilization);
    assert('cross_domain_resonance domain+civ only', !sa.cross_domain_resonance.mainUser && sa.cross_domain_resonance.domain && sa.cross_domain_resonance.civilization);

    // Test: translate single scale
    var result = translator.translate({
      pattern: {
        patternClass: 'threat_cascade',
        affectedNodes: [17, 18, 54],
        affectedSystems: ['limbic'],
        dominantDirection: 'hyper',
        dominantChannel: 'cortico-limbic'
      },
      scale: 'mainUser',
      remedies: [],
      fallback: null,
      confidence: 0.5
    });
    assert('mainUser translation produced', !!result);
    assert('has actions', result._actions && result._actions.length > 0);
    assert('mainUser action is pace/awareness', ['pace_adjustment', 'behavior_suggestion', 'focus_redirect', 'awareness_prompt'].indexOf(result._actions[0].type) >= 0);

    // Test: non-applicable scale returns null
    var nullResult = translator.translate({
      pattern: { patternClass: 'cross_domain_resonance', affectedNodes: [31], affectedSystems: ['hpa'], dominantDirection: 'hyper' },
      scale: 'mainUser',
      remedies: [],
      confidence: 0
    });
    assert('non-applicable scale returns null', nullResult === null);

    // Test: conflict detection
    var conflicts = translator.detectConflicts([
      { scale: 'portalUser', affectedNodes: [17, 6], dominantDirection: 'hyper', confidence: 0.75, timeHorizon: 'short' },
      { scale: 'business',   affectedNodes: [17, 12], dominantDirection: 'hypo', confidence: 0.60, timeHorizon: 'medium' }
    ]);
    assert('conflict detected', conflicts.length > 0);
    assert('conflict type is direction_conflict', conflicts[0].type === 'direction_conflict');
    assert('conflict has resolution', !!conflicts[0].resolution && !!conflicts[0].resolution.strategy);
  }

  function testRecommendationEngine() {
    section('Recommendation Engine');

    var engine = _global.LIMENRecommendationEngine;
    assert('engine exists', !!engine);

    // Test: pattern detection
    var patterns = engine.detectPatterns(
      FIXTURE_THREAT_CASCADE.propagationResult,
      FIXTURE_THREAT_CASCADE.nodeStates
    );
    assert('patterns detected', patterns.length > 0);
    assert('first pattern is threat_cascade', patterns[0].patternClass === 'threat_cascade');
    assert('affected nodes includes BLA(17)', patterns[0].affectedNodes.indexOf(17) >= 0);
    assert('dominant direction is hyper', patterns[0].dominantDirection === 'hyper');

    // Test: full pipeline — threat cascade
    var recSet = engine.generate({
      propagationResult: FIXTURE_THREAT_CASCADE.propagationResult,
      nodeStates:        FIXTURE_THREAT_CASCADE.nodeStates,
      feedSources:       FIXTURE_THREAT_CASCADE.feedSources,
      sourceHealth:      1.0
    });
    assert('recommendation set generated', !!recSet);
    assert('has generatedAt', typeof recSet.generatedAt === 'number');
    assert('has mainUser array', Array.isArray(recSet.mainUser));
    assert('has portalUser array', Array.isArray(recSet.portalUser));
    assert('has business array', Array.isArray(recSet.business));
    assert('has domain array', Array.isArray(recSet.domain));
    assert('has civilization array', Array.isArray(recSet.civilization));

    // Check we got at least one recommendation at some scale
    var totalRecs = recSet.mainUser.length + recSet.portalUser.length + recSet.business.length + recSet.domain.length + recSet.civilization.length;
    assert('at least 1 recommendation generated', totalRecs > 0, 'got ' + totalRecs);

    // Validate recommendation structure
    var sampleRec = recSet.mainUser[0] || recSet.portalUser[0] || recSet.business[0] || recSet.domain[0] || recSet.civilization[0];
    if (sampleRec) {
      assert('rec has id', typeof sampleRec.id === 'string');
      assert('rec has scale', typeof sampleRec.scale === 'string');
      assert('rec has patternClass', typeof sampleRec.patternClass === 'string');
      assert('rec has affectedNodes', Array.isArray(sampleRec.affectedNodes));
      assert('rec has affectedSystems', Array.isArray(sampleRec.affectedSystems));
      assert('rec has confidence', typeof sampleRec.confidence === 'number');
      assert('rec has confidenceDetail', !!sampleRec.confidenceDetail);
      assert('rec has timeHorizon', typeof sampleRec.timeHorizon === 'string');
      assert('rec has urgency', typeof sampleRec.urgency === 'number');
      assert('rec has recommendedActions', Array.isArray(sampleRec.recommendedActions));
      assert('rec has conflicts', Array.isArray(sampleRec.conflicts));
      assert('rec has evidenceEnvelope', !!sampleRec.evidenceEnvelope);
      assert('rec has state GENERATED', sampleRec.state === 'GENERATED');
    }

    // Test: full pipeline — cross-domain resonance
    var recSet2 = engine.generate({
      propagationResult: FIXTURE_CROSS_DOMAIN.propagationResult,
      nodeStates:        FIXTURE_CROSS_DOMAIN.nodeStates,
      feedSources:       FIXTURE_CROSS_DOMAIN.feedSources,
      sourceHealth:      0.67
    });
    assert('cross-domain set generated', !!recSet2);
    var totalRecs2 = recSet2.mainUser.length + recSet2.portalUser.length + recSet2.business.length + recSet2.domain.length + recSet2.civilization.length;
    assert('cross-domain produced recs', totalRecs2 > 0, 'got ' + totalRecs2);

    // Test: lifecycle
    if (sampleRec) {
      var activated = engine.activate(sampleRec);
      assert('lifecycle: activated', activated.state === 'ACTIVE');
      var confirmed = engine.confirm(sampleRec.id);
      assert('lifecycle: confirmed', confirmed && confirmed.state === 'CONFIRMED');
      var acted = engine.act(sampleRec.id);
      assert('lifecycle: acted', acted && acted.state === 'ACTED');
      var expired = engine.expire(sampleRec.id);
      assert('lifecycle: expired', expired && expired.state === 'EXPIRED');
    }

    // Test: constants
    assert('14 pattern classes', engine._PATTERN_CLASSES.length === 14);
    assert('5 confidence thresholds', Object.keys(engine._CONFIDENCE_THRESHOLDS).length === 5);
    assert('5 max active caps', Object.keys(engine._MAX_ACTIVE).length === 5);
  }

  function testSampleOutputs() {
    section('Sample Recommendation Objects (all 5 scales)');

    _global.LIMENRemedyRegistry = SAMPLE_REGISTRY;

    var recSet = _global.LIMENRecommendationEngine.generate({
      propagationResult: FIXTURE_THREAT_CASCADE.propagationResult,
      nodeStates:        FIXTURE_THREAT_CASCADE.nodeStates,
      feedSources:       FIXTURE_THREAT_CASCADE.feedSources,
      sourceHealth:      1.0
    });

    var scales = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];
    for (var i = 0; i < scales.length; i++) {
      var s = scales[i];
      var recs = recSet[s];
      _log.push('\n  [' + s + '] ' + recs.length + ' recommendation(s)');
      for (var j = 0; j < recs.length; j++) {
        var r = recs[j];
        _log.push('    ├─ id: ' + r.id);
        _log.push('    ├─ pattern: ' + r.patternClass);
        _log.push('    ├─ confidence: ' + r.confidence + ' (' + r.confidenceDetail.confidenceTier + ')');
        _log.push('    ├─ urgency: ' + r.urgency);
        _log.push('    ├─ timeHorizon: ' + r.timeHorizon);
        _log.push('    ├─ actions: ' + r.recommendedActions.length);
        if (r.recommendedActions.length > 0) {
          _log.push('    │  └─ ' + (r.recommendedActions[0].text || r.recommendedActions[0].label || r.recommendedActions[0].type));
        }
        _log.push('    ├─ evidence tier: ' + (r.evidenceEnvelope ? r.evidenceEnvelope.overallTier : 'n/a'));
        _log.push('    └─ conflicts: ' + r.conflicts.length);
      }
      if (recs.length === 0) {
        _log.push('    └─ (pattern not applicable at this scale, or below confidence threshold)');
      }
    }

    if (recSet.conflicts && recSet.conflicts.length > 0) {
      _log.push('\n  Cross-scale conflicts: ' + recSet.conflicts.length);
      for (var c = 0; c < recSet.conflicts.length; c++) {
        _log.push('    ├─ ' + recSet.conflicts[c].type + ': ' + recSet.conflicts[c].scaleA + ' vs ' + recSet.conflicts[c].scaleB);
        _log.push('    └─ resolution: ' + recSet.conflicts[c].resolution.strategy);
      }
    }

    assert('sample output complete', true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Runner
  // ═══════════════════════════════════════════════════════════════════════════

  function runAll() {
    _pass = 0;
    _fail = 0;
    _log = ['LIMEN Recommendation Runtime — Test Harness\n'];

    testRemedyResolver();
    testEvidenceBuilder();
    testScaleTranslator();
    testRecommendationEngine();
    testSampleOutputs();

    _log.push('\n════════════════════════════════════════');
    _log.push(_pass + '/' + (_pass + _fail) + ' tests PASS');
    if (_fail > 0) _log.push(_fail + ' FAILED');
    _log.push('════════════════════════════════════════');

    var output = _log.join('\n');
    if (isNode) {
      console.log(output);
      process.exit(_fail > 0 ? 1 : 0);
    } else {
      console.log(output);
    }

    return { pass: _pass, fail: _fail, log: _log };
  }

  // Auto-run in Node.js
  if (isNode) {
    runAll();
  }

  // Browser API
  _global.LIMENTestHarness = {
    runAll:   runAll,
    fixtures: {
      THREAT_CASCADE: FIXTURE_THREAT_CASCADE,
      CROSS_DOMAIN:   FIXTURE_CROSS_DOMAIN,
      SAMPLE_REGISTRY: SAMPLE_REGISTRY
    }
  };

})();
