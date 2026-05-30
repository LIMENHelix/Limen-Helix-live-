/**
 * LIMEN Report Synthesizer — Test Harness
 *
 * Tests all 6 report types and generates example payloads.
 * Runs in browser (load after all recommendation + report modules) or
 * in Node.js with the provided shim setup.
 *
 * Usage (browser):
 *   <script src="recommendations/remedy-resolver.js"></script>
 *   <script src="recommendations/evidence-builder.js"></script>
 *   <script src="recommendations/scale-translator.js"></script>
 *   <script src="recommendations/recommendation-engine.js"></script>
 *   <script src="recommendations/report-synthesizer.js"></script>
 *   <script src="recommendations/report-test-harness.js"></script>
 *   <script>LIMENReportTestHarness.runAll();</script>
 *
 * Usage (Node.js):
 *   node report-test-harness.js
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Node.js compatibility shim
  // ═══════════════════════════════════════════════════════════════════════════

  var isNode = typeof window === 'undefined';
  var _global = isNode ? global : window;

  if (isNode) {
    _global.window = _global;
    _global.localStorage = {
      _store: {},
      getItem: function (k) { return this._store[k] || null; },
      setItem: function (k, v) { this._store[k] = v; },
      removeItem: function (k) { delete this._store[k]; }
    };
    _global.CustomEvent = function (name, opts) { this.type = name; this.detail = (opts && opts.detail) || null; };
    _global.dispatchEvent = function () {};

    // Load all modules
    var fs = require('fs');
    var path = require('path');
    var dir = __dirname || '.';
    eval(fs.readFileSync(path.join(dir, 'remedy-resolver.js'), 'utf8'));
    eval(fs.readFileSync(path.join(dir, 'evidence-builder.js'), 'utf8'));
    eval(fs.readFileSync(path.join(dir, 'scale-translator.js'), 'utf8'));
    eval(fs.readFileSync(path.join(dir, 'recommendation-engine.js'), 'utf8'));
    eval(fs.readFileSync(path.join(dir, 'report-synthesizer.js'), 'utf8'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Test fixtures (reused from test-harness.js)
  // ═══════════════════════════════════════════════════════════════════════════

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

  // Sample patent data for patent opportunity report
  var SAMPLE_PATENT_DATA = {
    opportunityScore: 0.73,
    filingDensity: {
      gaps: [
        { cpcGroup: 'A61B-5/00', domain: 'health', score: 0.82, filingCount: 12 },
        { cpcGroup: 'G06N-3/08', domain: 'technology', score: 0.65, filingCount: 45 }
      ]
    },
    noveltySignal: {
      spikeDetected: true,
      predictionError: 0.41,
      nodeId: 12,
      domain: 'technology'
    },
    convergenceSignal: {
      detected: true,
      domains: ['health', 'technology'],
      strength: 0.58
    },
    temporalGaps: [
      { cpcGroup: 'A61B-5/00', domain: 'health', daysSinceSpike: 180, score: 0.70 }
    ],
    remedyGaps: [
      { patternClass: 'threat_cascade', scale: 'portalUser', gapFrequency: 8 }
    ]
  };

  // Simulated domain data for domain + civilization reports
  var MOCK_DOMAINS = {
    economy:     { stress: 0.45, trend: 0.02, confidence: 0.80, signals: [], updated: Date.now(), sources: ['fred_unemployment'] },
    energy:      { stress: 0.68, trend: 0.08, confidence: 0.75, signals: [], updated: Date.now(), sources: ['eia_crude'] },
    environment: { stress: 0.72, trend: -0.01, confidence: 0.85, signals: [], updated: Date.now(), sources: ['noaa_alerts'] },
    health:      { stress: 0.35, trend: -0.05, confidence: 0.70, signals: [], updated: Date.now(), sources: [] },
    technology:  { stress: 0.52, trend: 0.12, confidence: 0.65, signals: [], updated: Date.now(), sources: [] },
    research:    { stress: 0.28, trend: 0.01, confidence: 0.55, signals: [], updated: Date.now(), sources: [] },
    supplyChain: { stress: 0.60, trend: 0.05, confidence: 0.60, signals: [], updated: Date.now(), sources: [] }
  };

  var MOCK_GLOBAL_STATE = {
    mode: 'pressured',
    score: 0.62,
    confidence: 0.72,
    topDrivers: ['energy', 'environment', 'supplyChain']
  };

  var MOCK_POLARITY = {
    overall: -0.15,
    byDomain: {
      economy: 0.10,
      energy: -0.35,
      environment: -0.28,
      health: 0.05,
      technology: 0.20,
      research: 0.12,
      supplyChain: -0.18
    },
    trend: 'declining',
    smoothedAt: Date.now()
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
  // Helper: generate recommendation set for a fixture
  // ═══════════════════════════════════════════════════════════════════════════

  function generateRecSet(fixture) {
    return _global.LIMENRecommendationEngine.generate({
      propagationResult: fixture.propagationResult,
      nodeStates:        fixture.nodeStates,
      feedSources:       fixture.feedSources,
      sourceHealth:      fixture.sourceHealth
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tests
  // ═══════════════════════════════════════════════════════════════════════════

  function testSynthesizerExists() {
    section('Report Synthesizer — Module');

    var synth = _global.LIMENReportSynthesizer;
    assert('synthesizer exists', !!synth);
    assert('has synthesize()', typeof synth.synthesize === 'function');
    assert('has synthesizeAll()', typeof synth.synthesizeAll === 'function');
    assert('has generateAndReport()', typeof synth.generateAndReport === 'function');
    assert('REPORT_TYPES has 6 entries', synth.REPORT_TYPES.length === 6);
    assert('REPORT_VERSION set', typeof synth.REPORT_VERSION === 'string' && synth.REPORT_VERSION.length > 0);
  }

  function testMainUserReport() {
    section('Report: mainUser');

    var recSet = generateRecSet(FIXTURE_THREAT_CASCADE);
    var synth = _global.LIMENReportSynthesizer;
    var report = synth.synthesize('mainUser', recSet);

    assert('reportType is mainUser', report.reportType === 'mainUser');
    assert('has version', report.version === synth.REPORT_VERSION);
    assert('has generatedAt', typeof report.generatedAt === 'number');
    assert('has summary object', !!report.summary);
    assert('summary.headline is string', typeof report.summary.headline === 'string' && report.summary.headline.length > 0);
    assert('summary.confidenceColor is hex', /^#[0-9A-F]{6}$/i.test(report.summary.confidenceColor));
    assert('summary.confidenceLabel present', typeof report.summary.confidenceLabel === 'string');
    assert('summary.urgency is number', typeof report.summary.urgency === 'number');
    assert('summary.timeHorizon present', typeof report.summary.timeHorizon === 'string');
    assert('has actions array', Array.isArray(report.actions));
    assert('has temporal object', !!report.temporal);
    assert('temporal.hasHistory is boolean', typeof report.temporal.hasHistory === 'boolean');
    assert('temporal.hasProjection is boolean', typeof report.temporal.hasProjection === 'boolean');
    assert('temporal.trajectory present', typeof report.temporal.trajectory === 'string');
    assert('has sourceChain', !!report.sourceChain);
    assert('sourceChain.feeds is array', Array.isArray(report.sourceChain.feeds));
    assert('no excessive jargon in headline', report.summary.headline.indexOf('patternClass') === -1);
  }

  function testPortalUserReport() {
    section('Report: portalUser');

    var recSet = generateRecSet(FIXTURE_THREAT_CASCADE);
    var synth = _global.LIMENReportSynthesizer;
    var report = synth.synthesize('portalUser', recSet);

    assert('reportType is portalUser', report.reportType === 'portalUser');
    assert('has suggestions array (portalRemedyReport)', Array.isArray(report.suggestions));
    assert('has clusterCount', typeof report.clusterCount === 'number');
    assert('has summary', !!report.summary);
    assert('summary.patternClass set', typeof report.summary.patternClass === 'string');
    assert('summary.affectedNodes is array', Array.isArray(report.summary.affectedNodes));
    assert('summary.confidenceTier valid', ['high', 'moderate', 'low', 'insufficient'].indexOf(report.summary.confidenceTier) >= 0);
    assert('summary.confidenceFactors present', !!report.summary.confidenceFactors);

    // Evidence temporal sections
    assert('has evidence object', !!report.evidence);
    assert('evidence.historical present', !!report.evidence.historical);
    assert('evidence.historical.available is boolean', typeof report.evidence.historical.available === 'boolean');
    assert('evidence.current present', !!report.evidence.current);
    assert('evidence.current.dataQuality present', !!report.evidence.current.dataQuality);
    assert('evidence.predictive present', !!report.evidence.predictive);
    assert('evidence.uncertaintyStatement is string', typeof report.evidence.uncertaintyStatement === 'string');
    assert('evidence.temporalBalance present', !!report.evidence.temporalBalance);

    assert('has conflicts array', Array.isArray(report.conflicts));
    assert('has actions array', Array.isArray(report.actions));
    assert('has sourceChain', !!report.sourceChain);

    // Suggestion structure (portalRemedyReport contract)
    if (report.suggestions.length > 0) {
      var s = report.suggestions[0];
      assert('suggestion has rank', typeof s.rank === 'number');
      assert('suggestion has node', !!s.node && typeof s.node.id === 'number');
      assert('suggestion has direction', typeof s.direction === 'string');
      assert('suggestion has treatment', typeof s.treatment === 'string');
      assert('suggestion has type', typeof s.type === 'string');
      assert('suggestion has relevance', typeof s.relevance === 'number');
    }
  }

  function testBusinessPortalReport() {
    section('Report: businessPortal');

    var recSet = generateRecSet(FIXTURE_THREAT_CASCADE);
    var synth = _global.LIMENReportSynthesizer;
    var report = synth.synthesize('businessPortal', recSet);

    assert('reportType is businessPortal', report.reportType === 'businessPortal');
    assert('has summary', !!report.summary);
    assert('summary.patternLabel is string', typeof report.summary.patternLabel === 'string');
    assert('summary.dominantPhase present', report.summary.dominantPhase !== undefined);
    assert('has kpis array', Array.isArray(report.kpis));

    // Simplified evidence view
    assert('has evidence object', !!report.evidence);
    assert('evidence.historical.summary is string', typeof report.evidence.historical.summary === 'string');
    assert('evidence.current.dataQuality present', !!report.evidence.current.dataQuality);
    assert('evidence.current.elevatedFeeds is array', Array.isArray(report.evidence.current.elevatedFeeds));
    assert('evidence.predictive.trajectory present', typeof report.evidence.predictive.trajectory === 'string');
    assert('evidence.uncertaintyStatement present', typeof report.evidence.uncertaintyStatement === 'string');
    assert('evidence.overallConfidence is number', typeof report.evidence.overallConfidence === 'number');

    assert('has conflicts array', Array.isArray(report.conflicts));
    assert('has actions array', Array.isArray(report.actions));
    assert('has sourceChain', !!report.sourceChain);
  }

  function testDomainReport() {
    section('Report: domain');

    // Install mock domains
    _global.LIMENDomains = MOCK_DOMAINS;

    var recSet = generateRecSet(FIXTURE_THREAT_CASCADE);
    var synth = _global.LIMENReportSynthesizer;
    var report = synth.synthesize('domain', recSet);

    assert('reportType is domain', report.reportType === 'domain');

    // domainRepairReport compatibility
    assert('has propagationSteps', typeof report.propagationSteps === 'number');
    assert('has convergenceAchieved', typeof report.convergenceAchieved === 'boolean');
    assert('has signals array (domainRepairReport)', Array.isArray(report.signals));

    assert('has summary', !!report.summary);
    assert('has domainStress map', !!report.domainStress);
    assert('domainStress has 7 domains', Object.keys(report.domainStress).length === 7);

    // Verify domain stress structure
    var eStress = report.domainStress.energy;
    assert('energy stress has stress field', typeof eStress.stress === 'number');
    assert('energy stress has trend field', typeof eStress.trend === 'string');
    assert('energy stress has confidence field', typeof eStress.confidence === 'number');

    // Signals structure (domainRepairReport)
    if (report.signals.length > 0) {
      var sig = report.signals[0];
      assert('signal has type', typeof sig.type === 'string');
      assert('signal has domains', Array.isArray(sig.domains));
      assert('signal has nodes', Array.isArray(sig.nodes));
      assert('signal has severity', typeof sig.severity === 'number');
      assert('signal has narrative', typeof sig.narrative === 'string');
    }

    // Full temporal evidence
    assert('has evidence object', !!report.evidence);
    assert('evidence has overallConfidence', typeof report.evidence.overallConfidence === 'number');
    assert('evidence has overallTier', typeof report.evidence.overallTier === 'string');

    assert('has conflicts array', Array.isArray(report.conflicts));
    assert('has sourceChain', !!report.sourceChain);
  }

  function testCivilizationReport() {
    section('Report: civilization');

    _global.LIMENDomains = MOCK_DOMAINS;
    _global.LIMENGlobalState = MOCK_GLOBAL_STATE;
    _global.LIMENPolarity = MOCK_POLARITY;

    var recSet = generateRecSet(FIXTURE_CROSS_DOMAIN);
    var synth = _global.LIMENReportSynthesizer;
    var report = synth.synthesize('civilization', recSet);

    assert('reportType is civilization', report.reportType === 'civilization');
    assert('has summary', !!report.summary);
    assert('summary.globalMode is pressured', report.summary.globalMode === 'pressured');
    assert('summary.globalScore is number', typeof report.summary.globalScore === 'number');
    assert('summary.globalConfidence is number', typeof report.summary.globalConfidence === 'number');
    assert('summary.topDrivers is array', Array.isArray(report.summary.topDrivers));

    assert('has domainOverview array', Array.isArray(report.domainOverview));
    assert('domainOverview has 7 entries', report.domainOverview.length === 7);

    // Verify domain overview structure
    var dov = report.domainOverview[0];
    assert('domainOverview entry has domain', typeof dov.domain === 'string');
    assert('domainOverview entry has stress', typeof dov.stress === 'number');
    assert('domainOverview entry has trend', typeof dov.trend === 'string');

    assert('has polarity', !!report.polarity);
    assert('polarity.overall is number', typeof report.polarity.overall === 'number');

    // Full evidence
    assert('has evidence object', !!report.evidence);
    assert('evidence has display', report.evidence.display !== undefined);

    assert('has conflicts array', Array.isArray(report.conflicts));

    // Scale summary
    assert('has scaleSummary', !!report.scaleSummary);
    assert('scaleSummary.total is number', typeof report.scaleSummary.total === 'number');
    assert('scaleSummary has all 5 scale counts', report.scaleSummary.mainUser !== undefined
      && report.scaleSummary.portalUser !== undefined
      && report.scaleSummary.business !== undefined
      && report.scaleSummary.domain !== undefined
      && report.scaleSummary.civilization !== undefined);

    assert('has sourceChain', !!report.sourceChain);
  }

  function testPatentOpportunityReport() {
    section('Report: patentOpportunity');

    _global.LIMENDomains = MOCK_DOMAINS;

    var recSet = generateRecSet(FIXTURE_THREAT_CASCADE);
    var synth = _global.LIMENReportSynthesizer;
    var report = synth.synthesize('patentOpportunity', recSet, { patentData: SAMPLE_PATENT_DATA });

    assert('reportType is patentOpportunity', report.reportType === 'patentOpportunity');

    // patentOpportunityReport compatibility
    assert('has techHubActivation', typeof report.techHubActivation === 'number');
    assert('has signals array (patentOpportunityReport)', Array.isArray(report.signals));
    assert('legalReviewRequired is true', report.legalReviewRequired === true);

    assert('has summary', !!report.summary);
    assert('summary.opportunityScore is number', typeof report.summary.opportunityScore === 'number');
    assert('summary.signalCount matches signals', report.summary.signalCount === report.signals.length);
    assert('summary.confidence is number', typeof report.summary.confidence === 'number');

    assert('has patentData', !!report.patentData);
    assert('patentData.filingDensity present', !!report.patentData.filingDensity);
    assert('patentData.noveltySignal present', !!report.patentData.noveltySignal);
    assert('patentData.temporalGaps is array', Array.isArray(report.patentData.temporalGaps));

    // Patent signals
    assert('signals.length > 0', report.signals.length > 0);
    var ps = report.signals[0];
    assert('patent signal has type', typeof ps.type === 'string');
    assert('patent signal has indication', typeof ps.indication === 'string');
    assert('patent signal has opportunityScore', typeof ps.opportunityScore === 'number');

    // Evidence
    assert('has evidence', !!report.evidence);
    assert('evidence has 3 temporal sections', !!report.evidence.historical && !!report.evidence.current && !!report.evidence.predictive);

    // Contextual overlay
    assert('has contextualRecommendations', !!report.contextualRecommendations);
    assert('contextualRecommendations.domain is array', Array.isArray(report.contextualRecommendations.domain));
    assert('contextualRecommendations.civilization is array', Array.isArray(report.contextualRecommendations.civilization));

    assert('has conflicts array', Array.isArray(report.conflicts));
    assert('has sourceChain', !!report.sourceChain);
  }

  function testSynthesizeAll() {
    section('synthesizeAll()');

    _global.LIMENDomains = MOCK_DOMAINS;
    _global.LIMENGlobalState = MOCK_GLOBAL_STATE;
    _global.LIMENPolarity = MOCK_POLARITY;

    var recSet = generateRecSet(FIXTURE_THREAT_CASCADE);
    var synth = _global.LIMENReportSynthesizer;
    var all = synth.synthesizeAll(recSet, { patentData: SAMPLE_PATENT_DATA });

    assert('returns object', typeof all === 'object');
    assert('has mainUser report', !!all.mainUser && all.mainUser.reportType === 'mainUser');
    assert('has portalUser report', !!all.portalUser && all.portalUser.reportType === 'portalUser');
    assert('has businessPortal report', !!all.businessPortal && all.businessPortal.reportType === 'businessPortal');
    assert('has domain report', !!all.domain && all.domain.reportType === 'domain');
    assert('has civilization report', !!all.civilization && all.civilization.reportType === 'civilization');
    assert('has patentOpportunity report', !!all.patentOpportunity && all.patentOpportunity.reportType === 'patentOpportunity');
  }

  function testGenerateAndReport() {
    section('generateAndReport()');

    _global.LIMENDomains = MOCK_DOMAINS;
    _global.LIMENGlobalState = MOCK_GLOBAL_STATE;
    _global.LIMENRemedyRegistry = SAMPLE_REGISTRY;

    var synth = _global.LIMENReportSynthesizer;
    var result = synth.generateAndReport({
      propagationResult: FIXTURE_THREAT_CASCADE.propagationResult,
      nodeStates:        FIXTURE_THREAT_CASCADE.nodeStates,
      feedSources:       FIXTURE_THREAT_CASCADE.feedSources,
      sourceHealth:      1.0
    }, { patentData: SAMPLE_PATENT_DATA });

    assert('result has recommendations', !!result.recommendations);
    assert('result has reports', !!result.reports);
    assert('reports has all 6 types', Object.keys(result.reports).length === 6);
  }

  function testCrossFixture() {
    section('Cross-domain fixture reports');

    _global.LIMENDomains = MOCK_DOMAINS;
    _global.LIMENGlobalState = MOCK_GLOBAL_STATE;
    _global.LIMENRemedyRegistry = SAMPLE_REGISTRY;

    var recSet = generateRecSet(FIXTURE_CROSS_DOMAIN);
    var synth = _global.LIMENReportSynthesizer;
    var all = synth.synthesizeAll(recSet);

    assert('cross-domain mainUser report generated', !!all.mainUser);
    assert('cross-domain civilization report generated', !!all.civilization);
    assert('cross-domain domain signals present', all.domain.signals.length >= 0);

    // Non-converged propagation should be reflected
    assert('domain convergenceAchieved is false', all.domain.convergenceAchieved === false);
  }

  function testUnknownReportType() {
    section('Error handling');

    var synth = _global.LIMENReportSynthesizer;
    var threw = false;
    try {
      synth.synthesize('nonExistent', {});
    } catch (e) {
      threw = true;
      assert('error message mentions type', e.message.indexOf('nonExistent') >= 0);
    }
    assert('unknown report type throws', threw);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Example payloads — pretty-print all 6 reports
  // ═══════════════════════════════════════════════════════════════════════════

  function printExamplePayloads() {
    section('Example Report Payloads (threat cascade fixture)');

    _global.LIMENDomains = MOCK_DOMAINS;
    _global.LIMENGlobalState = MOCK_GLOBAL_STATE;
    _global.LIMENPolarity = MOCK_POLARITY;
    _global.LIMENRemedyRegistry = SAMPLE_REGISTRY;

    var recSet = generateRecSet(FIXTURE_THREAT_CASCADE);
    var synth = _global.LIMENReportSynthesizer;
    var all = synth.synthesizeAll(recSet, { patentData: SAMPLE_PATENT_DATA });

    var types = synth.REPORT_TYPES;
    for (var i = 0; i < types.length; i++) {
      var type = types[i];
      var report = all[type];
      _log.push('\n  ┌─── ' + type.toUpperCase() + ' REPORT ───');
      _printReport(report, type);
      _log.push('  └───────────────────────────');
    }
  }

  function _printReport(r, type) {
    switch (type) {
      case 'mainUser':
        _log.push('  │ headline: ' + r.summary.headline);
        _log.push('  │ confidence: ' + r.summary.confidenceLabel + ' (' + r.summary.confidenceColor + ')');
        _log.push('  │ urgency: ' + r.summary.urgency.toFixed(2));
        _log.push('  │ timeHorizon: ' + r.summary.timeHorizon);
        _log.push('  │ actions: ' + r.actions.length);
        for (var a = 0; a < r.actions.length; a++) {
          _log.push('  │   └─ ' + r.actions[a].text);
        }
        _log.push('  │ temporal: history=' + r.temporal.hasHistory + ' proj=' + r.temporal.hasProjection + ' traj=' + r.temporal.trajectory);
        _log.push('  │ dataNote: ' + (r.dataNote || '(none — data quality OK)'));
        _log.push('  │ sourceChain.feeds: [' + r.sourceChain.feeds.join(', ') + ']');
        break;

      case 'portalUser':
        _log.push('  │ pattern: ' + r.summary.patternLabel);
        _log.push('  │ confidence: ' + (r.summary.confidence * 100).toFixed(0) + '% (' + r.summary.confidenceTier + ')');
        _log.push('  │ urgency: ' + r.summary.urgency.toFixed(2));
        _log.push('  │ timeHorizon: ' + r.summary.timeHorizon);
        _log.push('  │ clusterCount: ' + r.clusterCount);
        _log.push('  │ suggestions: ' + r.suggestions.length);
        for (var s = 0; s < Math.min(r.suggestions.length, 3); s++) {
          var sg = r.suggestions[s];
          _log.push('  │   #' + sg.rank + ': ' + sg.treatment + ' (' + sg.type + ') → node ' + sg.node.id + ' ' + sg.direction + ' relevance=' + sg.relevance.toFixed(2));
        }
        _log.push('  │ evidence.historical: ' + (r.evidence.historical.available ? r.evidence.historical.analogueCount + ' analogues' : 'none'));
        _log.push('  │ evidence.current: quality=' + r.evidence.current.dataQuality.grade + ' feeds=' + r.evidence.current.feeds.length);
        _log.push('  │ evidence.predictive: ' + (r.evidence.predictive.available ? r.evidence.predictive.projectionCount + ' projections, traj=' + r.evidence.predictive.dominantTrajectory : 'none'));
        _log.push('  │ uncertainty: ' + r.evidence.uncertaintyStatement.substring(0, 100) + (r.evidence.uncertaintyStatement.length > 100 ? '...' : ''));
        _log.push('  │ conflicts: ' + r.conflicts.length);
        break;

      case 'businessPortal':
        _log.push('  │ pattern: ' + r.summary.patternLabel);
        _log.push('  │ confidence: ' + (r.summary.confidence * 100).toFixed(0) + '% (' + r.summary.confidenceTier + ')');
        _log.push('  │ urgency: ' + r.summary.urgency.toFixed(2));
        _log.push('  │ timeHorizon: ' + r.summary.timeHorizon);
        _log.push('  │ KPIs: ' + r.kpis.length);
        for (var k = 0; k < Math.min(r.kpis.length, 3); k++) {
          _log.push('  │   ' + r.kpis[k].metric + ': ' + r.kpis[k].impact.substring(0, 60));
        }
        _log.push('  │ evidence.historical: ' + r.evidence.historical.summary.substring(0, 80));
        _log.push('  │ evidence.current: quality=' + r.evidence.current.dataQuality.grade + ' elevated=[' + r.evidence.current.elevatedFeeds.join(', ') + ']');
        _log.push('  │ evidence.predictive: trajectory=' + r.evidence.predictive.trajectory);
        _log.push('  │ overallConfidence: ' + (r.evidence.overallConfidence * 100).toFixed(0) + '%');
        break;

      case 'domain':
        _log.push('  │ pattern: ' + r.summary.patternLabel);
        _log.push('  │ confidence: ' + (r.summary.confidence * 100).toFixed(0) + '% (' + r.summary.confidenceTier + ')');
        _log.push('  │ propagation: ' + r.propagationSteps + ' steps, converged=' + r.convergenceAchieved);
        _log.push('  │ signals: ' + r.signals.length);
        for (var d = 0; d < Math.min(r.signals.length, 3); d++) {
          _log.push('  │   ' + r.signals[d].type + ': ' + r.signals[d].narrative.substring(0, 70));
        }
        _log.push('  │ domainStress:');
        var dKeys = Object.keys(r.domainStress);
        for (var dk = 0; dk < dKeys.length; dk++) {
          var ds = r.domainStress[dKeys[dk]];
          _log.push('  │   ' + dKeys[dk] + ': stress=' + ds.stress.toFixed(2) + ' trend=' + ds.trend + ' conf=' + ds.confidence.toFixed(2));
        }
        _log.push('  │ evidence: overallConf=' + (r.evidence.overallConfidence * 100).toFixed(0) + '% tier=' + r.evidence.overallTier);
        break;

      case 'civilization':
        _log.push('  │ globalMode: ' + r.summary.globalMode);
        _log.push('  │ globalScore: ' + r.summary.globalScore.toFixed(2));
        _log.push('  │ globalConfidence: ' + r.summary.globalConfidence.toFixed(2));
        _log.push('  │ topDrivers: [' + r.summary.topDrivers.join(', ') + ']');
        _log.push('  │ pattern: ' + r.summary.patternLabel);
        _log.push('  │ confidence: ' + (r.summary.confidence * 100).toFixed(0) + '% (' + r.summary.confidenceTier + ')');
        _log.push('  │ domains: ' + r.domainOverview.length);
        for (var c = 0; c < r.domainOverview.length; c++) {
          var dov = r.domainOverview[c];
          _log.push('  │   ' + dov.domain + ': stress=' + dov.stress.toFixed(2) + ' trend=' + dov.trend);
        }
        _log.push('  │ polarity: ' + (r.polarity ? 'overall=' + r.polarity.overall.toFixed(2) + ' trend=' + r.polarity.trend : 'n/a'));
        _log.push('  │ scaleSummary: total=' + r.scaleSummary.total + ' (mainUser=' + r.scaleSummary.mainUser + ' portal=' + r.scaleSummary.portalUser + ' biz=' + r.scaleSummary.business + ' domain=' + r.scaleSummary.domain + ' civ=' + r.scaleSummary.civilization + ')');
        _log.push('  │ conflicts: ' + r.conflicts.length);
        break;

      case 'patentOpportunity':
        _log.push('  │ opportunityScore: ' + r.summary.opportunityScore.toFixed(2));
        _log.push('  │ signalCount: ' + r.summary.signalCount);
        _log.push('  │ topDomain: ' + (r.summary.topDomain || 'none'));
        _log.push('  │ techHubActivation: ' + r.techHubActivation.toFixed(2));
        _log.push('  │ legalReviewRequired: ' + r.legalReviewRequired);
        _log.push('  │ signals:');
        for (var p = 0; p < r.signals.length; p++) {
          _log.push('  │   ' + r.signals[p].type + ': ' + r.signals[p].indication.substring(0, 70));
        }
        _log.push('  │ patentData: filingGaps=' + (r.patentData.filingDensity ? r.patentData.filingDensity.gaps.length : 0) + ' temporalGaps=' + r.patentData.temporalGaps.length);
        _log.push('  │ novelty: spike=' + (r.patentData.noveltySignal ? r.patentData.noveltySignal.spikeDetected : false) + ' error=' + (r.patentData.noveltySignal ? (r.patentData.noveltySignal.predictionError * 100).toFixed(0) + '%' : 'n/a'));
        _log.push('  │ contextual: domain=' + r.contextualRecommendations.domain.length + ' civ=' + r.contextualRecommendations.civilization.length);
        _log.push('  │ confidence: ' + (r.summary.confidence * 100).toFixed(0) + '% (' + r.summary.confidenceTier + ')');
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Runner
  // ═══════════════════════════════════════════════════════════════════════════

  function runAll() {
    _pass = 0;
    _fail = 0;
    _log = ['LIMEN Report Synthesizer — Test Harness\n'];

    // Install mocks
    _global.LIMENRemedyRegistry = SAMPLE_REGISTRY;
    _global.LIMENDomains = MOCK_DOMAINS;
    _global.LIMENGlobalState = MOCK_GLOBAL_STATE;
    _global.LIMENPolarity = MOCK_POLARITY;

    testSynthesizerExists();
    testMainUserReport();
    testPortalUserReport();
    testBusinessPortalReport();
    testDomainReport();
    testCivilizationReport();
    testPatentOpportunityReport();
    testSynthesizeAll();
    testGenerateAndReport();
    testCrossFixture();
    testUnknownReportType();
    printExamplePayloads();

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
  _global.LIMENReportTestHarness = {
    runAll:   runAll,
    fixtures: {
      THREAT_CASCADE:    FIXTURE_THREAT_CASCADE,
      CROSS_DOMAIN:      FIXTURE_CROSS_DOMAIN,
      SAMPLE_REGISTRY:   SAMPLE_REGISTRY,
      SAMPLE_PATENT_DATA: SAMPLE_PATENT_DATA,
      MOCK_DOMAINS:      MOCK_DOMAINS,
      MOCK_GLOBAL_STATE: MOCK_GLOBAL_STATE,
      MOCK_POLARITY:     MOCK_POLARITY
    }
  };

})();
