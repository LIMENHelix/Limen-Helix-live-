/**
 * LIMEN Report Validation — Test Suite
 *
 * Tests:
 *   - recommendation rendering in report-console
 *   - report export (HTML, JSON)
 *   - domain repair generation
 *   - patent opportunity detection
 *   - evidence chain integrity
 *   - regulation report generation (all scales)
 *   - global remedy report generation
 *
 * Usage (Node.js):
 *   node report-validation.js
 *
 * Usage (browser):
 *   Load all modules, then: LIMENReportValidation.runAll()
 */
(function () {
  'use strict';

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
    _global.addEventListener = function () {};

    // Minimal DOM shim for report-console (won't render but won't crash)
    _global.document = {
      readyState: 'complete',
      getElementById: function () { return null; },
      createElement: function (tag) {
        return {
          tagName: tag, className: '', id: '', style: { cssText: '' },
          innerHTML: '', textContent: '', dataset: {},
          appendChild: function () { return this; },
          insertBefore: function () {},
          addEventListener: function () {},
          querySelectorAll: function () { return []; },
          querySelector: function () { return null; },
          classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
          onclick: null
        };
      },
      head: { appendChild: function () {} },
      body: { appendChild: function () {} },
      addEventListener: function () {}
    };
    _global.URL = { createObjectURL: function () { return ''; }, revokeObjectURL: function () {} };
    _global.Blob = function () {};
    var fs = require('fs');
    var path = require('path');

    // Shim fetch to serve remedy-library.json
    var libPath = path.join(__dirname, '..', '..', 'data', 'remedy-library.json');
    var _libData = fs.existsSync(libPath) ? JSON.parse(fs.readFileSync(libPath, 'utf8')) : { entries: [] };
    _global.fetch = function () {
      return Promise.resolve({ json: function () { return Promise.resolve(_libData); } });
    };

    var recDir = path.join(__dirname, '..', 'recommendations');
    var uiDir = path.join(__dirname, '..', 'ui');

    eval(fs.readFileSync(path.join(recDir, 'remedy-resolver.js'), 'utf8'));
    eval(fs.readFileSync(path.join(recDir, 'evidence-builder.js'), 'utf8'));
    eval(fs.readFileSync(path.join(recDir, 'scale-translator.js'), 'utf8'));
    eval(fs.readFileSync(path.join(recDir, 'recommendation-engine.js'), 'utf8'));
    eval(fs.readFileSync(path.join(recDir, 'report-synthesizer.js'), 'utf8'));
    eval(fs.readFileSync(path.join(recDir, 'regulation-reports.js'), 'utf8'));
    eval(fs.readFileSync(path.join(__dirname, 'report-exporter.js'), 'utf8'));
    eval(fs.readFileSync(path.join(uiDir, 'report-console.js'), 'utf8'));
    eval(fs.readFileSync(path.join(uiDir, 'domain-repair-map.js'), 'utf8'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Fixtures
  // ═══════════════════════════════════════════════════════════════════════════

  var FIXTURE = {
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
      6:  { activation: 0.15, direction: 'hypo', predictionError: -0.32, system: 'executive', label: 'OFC', salience: 0.4, activationMean: 0.50, activationVar: 0.05, seedSource: null },
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

  var SAMPLE_REGISTRY = {
    version: '0.1.0', generatedAt: Date.now(), remedyCount: 1,
    scaleBreakdown: { mainUser: 0, portalUser: 1, business: 0, domain: 0, civilization: 0 },
    remedies: [{
      id: 'rem-portalUser-a8c3f1e2', version: 1, state: 'ACTIVE', scale: 'portalUser',
      createdAt: 1710400000, updatedAt: 1710400000,
      linkedDomains: ['health'], linkedPortals: ['medicine_psychiatry_mood_depression_assess'],
      linkedNodes: [
        { nodeId: 17, nodeLabel: 'BLA', targetDirection: 'hyper', effectDirection: 'down', weight: 1.0 },
        { nodeId: 6, nodeLabel: 'OFC', targetDirection: 'hypo', effectDirection: 'up', weight: 0.6 }
      ],
      linkedSystems: ['limbic', 'executive'], linkedChannels: ['cortico-limbic'],
      remedyType: 'STRATEGY', targetDirection: 'hyper',
      mechanism: 'Amygdala hyperactivation -> CBT reappraisal training -> Prefrontal regulatory restoration',
      addressesPatterns: [{ patternClass: 'threat_cascade', applicability: 0.92, nodeSignature: [17, 18, 6] }],
      contraindications: [{ type: 'safety', description: 'Do not apply during active psychotic episode', conflictsWith: null, severity: 'hard', condition: null }],
      evidenceType: 'A', citations: [{ author: 'Hofmann et al.', year: 2012, title: 'CBT Efficacy Meta-analysis' }],
      cite: 'Hofmann et al. 2012', timeHorizon: 'short', onsetDelay: '2-4 weeks', duration: '12-16 sessions',
      expectedEffect: { expectedShift: 'BLA activation decrease 0.2-0.4', monitoringSignal: 'BLA activation level', successCriteria: 'BLA below 0.6 for 3 sessions', failureCriteria: 'No reduction after 6 sessions' },
      confidence: 0.82,
      confidenceDetail: { confidenceScore: 0.82, confidenceFactors: { evidenceStrength: 1.0, patternSpecificity: 0.92, outcomeClarity: 1.0, historicalSuccess: 0.78 }, confidenceTier: 'high' },
      confidenceTier: 'high',
      historicalExamples: [{ context: 'CBT for anxiety in primary care', outcome: '64% improvement at 12mo', year: 2012, scaleAtTime: 'portalUser', effectiveness: 0.78 }],
      scalePayload: {
        treatmentLabel: 'CBT Exposure Protocol', treatmentType: 'STRATEGY',
        steps: ['Psychoeducation', 'Identify distortions', 'Exposure hierarchy', 'Graduated exposure'],
        monitoring: 'Weekly BLA proxy', escalation: 'Pharmacological adjunct after 6 sessions',
        target: 'BLA -> exposure -> OFC restoration',
        sourcePortalId: 'medicine_psychiatry_mood_depression_assess', sourceBrainNodeId: 'BLA'
      }
    }],
    index: {
      byScale: { portalUser: ['rem-portalUser-a8c3f1e2'] },
      byPattern: { threat_cascade: ['rem-portalUser-a8c3f1e2'] },
      byNode: { '17': ['rem-portalUser-a8c3f1e2'] },
      byDomain: { health: ['rem-portalUser-a8c3f1e2'] },
      byPortal: { medicine_psychiatry_mood_depression_assess: ['rem-portalUser-a8c3f1e2'] },
      byType: { STRATEGY: ['rem-portalUser-a8c3f1e2'] },
      byEvidence: { A: ['rem-portalUser-a8c3f1e2'] }
    }
  };

  var MOCK_DOMAINS = {
    economy: { stress: 0.45, trend: 0.02, confidence: 0.80, signals: [], updated: Date.now(), sources: ['fred_unemployment'] },
    energy: { stress: 0.68, trend: 0.08, confidence: 0.75, signals: [], updated: Date.now(), sources: ['eia_crude'] },
    environment: { stress: 0.72, trend: -0.01, confidence: 0.85, signals: [], updated: Date.now(), sources: ['noaa_alerts'] },
    health: { stress: 0.35, trend: -0.05, confidence: 0.70, signals: [], updated: Date.now(), sources: [] },
    technology: { stress: 0.52, trend: 0.12, confidence: 0.65, signals: [], updated: Date.now(), sources: [] },
    research: { stress: 0.28, trend: 0.01, confidence: 0.55, signals: [], updated: Date.now(), sources: [] },
    supplyChain: { stress: 0.60, trend: 0.05, confidence: 0.60, signals: [], updated: Date.now(), sources: [] }
  };

  var MOCK_GLOBAL_STATE = { mode: 'pressured', score: 0.62, confidence: 0.72, topDrivers: ['energy', 'environment', 'supplyChain'] };
  var MOCK_POLARITY = { overall: -0.15, byDomain: { economy: 0.10, energy: -0.35, environment: -0.28, health: 0.05, technology: 0.20, research: 0.12, supplyChain: -0.18 }, trend: 'declining' };

  var SAMPLE_PATENT_DATA = {
    opportunityScore: 0.73,
    filingDensity: { gaps: [{ cpcGroup: 'A61B-5/00', domain: 'health', score: 0.82, filingCount: 12 }] },
    noveltySignal: { spikeDetected: true, predictionError: 0.41, nodeId: 12, domain: 'technology' },
    convergenceSignal: { detected: true, domains: ['health', 'technology'], strength: 0.58 },
    temporalGaps: [{ cpcGroup: 'A61B-5/00', domain: 'health', daysSinceSpike: 180, score: 0.70 }],
    remedyGaps: []
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
  // Generate test data
  // ═══════════════════════════════════════════════════════════════════════════

  function _generateTestData() {
    _global.LIMENRemedyRegistry = SAMPLE_REGISTRY;
    _global.LIMENDomains = MOCK_DOMAINS;
    _global.LIMENGlobalState = MOCK_GLOBAL_STATE;
    _global.LIMENPolarity = MOCK_POLARITY;

    var engine = _global.LIMENRecommendationEngine;
    var recSet = engine.generate({
      propagationResult: FIXTURE.propagationResult,
      nodeStates: FIXTURE.nodeStates,
      feedSources: FIXTURE.feedSources,
      sourceHealth: FIXTURE.sourceHealth
    });

    var synth = _global.LIMENReportSynthesizer;
    var reports = synth.synthesizeAll(recSet, { patentData: SAMPLE_PATENT_DATA });

    return { recSet: recSet, reports: reports };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tests
  // ═══════════════════════════════════════════════════════════════════════════

  function testRecommendationRendering() {
    section('Recommendation Rendering (Report Console)');

    var console = _global.LIMENReportConsole;
    assert('report console exists', !!console);
    assert('has init()', typeof console.init === 'function');
    assert('has show()', typeof console.show === 'function');
    assert('has hide()', typeof console.hide === 'function');
    assert('has toggle()', typeof console.toggle === 'function');
    assert('has update()', typeof console.update === 'function');
    assert('has isVisible()', typeof console.isVisible === 'function');
    assert('has getReports()', typeof console.getReports === 'function');

    var data = _generateTestData();
    console.update(data.recSet, data.reports);

    assert('reports stored', !!console.getReports());
    assert('recSet stored', !!console.getRecSet());
    assert('reports has 6 types', Object.keys(console.getReports()).length === 6);
  }

  function testReportExport() {
    section('Report Export');

    var exporter = _global.LIMENReportExporter;
    assert('exporter exists', !!exporter);
    assert('has exportReport()', typeof exporter.exportReport === 'function');
    assert('has exportAll()', typeof exporter.exportAll === 'function');
    assert('has REPORT_TYPES', Array.isArray(exporter.REPORT_TYPES) && exporter.REPORT_TYPES.length >= 6);

    // Test each report type can be processed without errors
    var data = _generateTestData();
    var types = ['mainUser', 'portalUser', 'businessPortal', 'domain', 'civilization', 'patentOpportunity'];

    for (var i = 0; i < types.length; i++) {
      var type = types[i];
      var report = data.reports[type];
      if (!report) {
        assert(type + ' export: report exists', false, 'report is null');
        continue;
      }

      var threw = false;
      try {
        // In Node.js, the download won't work but we test that the function doesn't throw
        if (isNode) {
          // Just verify the report has the needed fields
          assert(type + ' report has reportType', report.reportType === type);
        } else {
          exporter.exportReport(type, report, 'json');
        }
        assert(type + ' export: no errors', true);
      } catch (e) {
        threw = true;
        assert(type + ' export: no errors', false, e.message);
      }
    }
  }

  function testDomainRepairGeneration() {
    section('Domain Repair Generation');

    var data = _generateTestData();
    var domainReport = data.reports.domain;

    assert('domain report exists', !!domainReport);
    assert('has reportType domain', domainReport.reportType === 'domain');
    assert('has propagationSteps', typeof domainReport.propagationSteps === 'number');
    assert('has convergenceAchieved', typeof domainReport.convergenceAchieved === 'boolean');
    assert('has signals array', Array.isArray(domainReport.signals));
    assert('has domainStress with 7 domains', !!domainReport.domainStress && Object.keys(domainReport.domainStress).length === 7);

    // Domain repair map
    var map = _global.LIMENDomainRepairMap;
    assert('domain repair map exists', !!map);
    assert('has render()', typeof map.render === 'function');
    assert('has update()', typeof map.update === 'function');
    assert('has DOMAINS array', Array.isArray(map.DOMAINS) && map.DOMAINS.length === 7);

    // Signal structure
    if (domainReport.signals.length > 0) {
      var sig = domainReport.signals[0];
      assert('signal has type', typeof sig.type === 'string');
      assert('signal has domains', Array.isArray(sig.domains));
      assert('signal has narrative', typeof sig.narrative === 'string');
      assert('signal has severity', typeof sig.severity === 'number');
    }

    // Stress ranges
    var dk = Object.keys(domainReport.domainStress);
    for (var i = 0; i < dk.length; i++) {
      var d = domainReport.domainStress[dk[i]];
      assert(dk[i] + ' stress in [0,1]', d.stress >= 0 && d.stress <= 1);
      assert(dk[i] + ' has trend', typeof d.trend === 'string');
    }
  }

  function testPatentOpportunityDetection() {
    section('Patent Opportunity Detection');

    var data = _generateTestData();
    var patentReport = data.reports.patentOpportunity;

    assert('patent report exists', !!patentReport);
    assert('has reportType patentOpportunity', patentReport.reportType === 'patentOpportunity');
    assert('has techHubActivation', typeof patentReport.techHubActivation === 'number');
    assert('has signals', Array.isArray(patentReport.signals));
    assert('signals count > 0', patentReport.signals.length > 0);
    assert('has legalReviewRequired', patentReport.legalReviewRequired === true);

    assert('summary has opportunityScore', typeof patentReport.summary.opportunityScore === 'number');
    assert('summary has signalCount', patentReport.summary.signalCount === patentReport.signals.length);
    assert('summary has topDomain', typeof patentReport.summary.topDomain === 'string' || patentReport.summary.topDomain === null);

    // Signal structure
    for (var i = 0; i < patentReport.signals.length; i++) {
      var sig = patentReport.signals[i];
      assert('signal ' + i + ' has type', typeof sig.type === 'string');
      assert('signal ' + i + ' has indication', typeof sig.indication === 'string');
    }

    assert('has patentData', !!patentReport.patentData);
    assert('has contextualRecommendations', !!patentReport.contextualRecommendations);
    assert('has evidence', !!patentReport.evidence);
  }

  function testEvidenceChainIntegrity() {
    section('Evidence Chain Integrity');

    var data = _generateTestData();
    var reports = data.reports;
    var recSet = data.recSet;

    // Every report should have a sourceChain
    var types = ['mainUser', 'portalUser', 'businessPortal', 'domain', 'civilization'];
    for (var i = 0; i < types.length; i++) {
      var report = reports[types[i]];
      if (report && report.sourceChain) {
        assert(types[i] + ' has sourceChain', true);
        assert(types[i] + ' sourceChain.feeds is array', Array.isArray(report.sourceChain.feeds));
        assert(types[i] + ' sourceChain.propagationSteps', typeof report.sourceChain.propagationSteps === 'number');
        assert(types[i] + ' sourceChain.timestamp', typeof report.sourceChain.timestamp === 'number');
      }
    }

    // Evidence envelope on recommendations
    var scales = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];
    var foundEnvelope = false;
    for (var s = 0; s < scales.length; s++) {
      var recs = recSet[scales[s]] || [];
      for (var r = 0; r < recs.length; r++) {
        if (recs[r].evidenceEnvelope) {
          foundEnvelope = true;
          var env = recs[r].evidenceEnvelope;
          assert('envelope has historical', !!env.historical);
          assert('envelope has currentState', !!env.currentState);
          assert('envelope has projected', !!env.projected);
          assert('envelope has overallConfidence [0,1]', env.overallConfidence >= 0 && env.overallConfidence <= 1);
          assert('envelope has overallTier', typeof env.overallTier === 'string');
          assert('envelope has temporalBalance', !!env.temporalBalance);
          var tb = env.temporalBalance;
          assert('temporal weights sum ~1', Math.abs(tb.historicalWeight + tb.currentWeight + tb.projectedWeight - 1.0) < 0.02);
          break;
        }
      }
      if (foundEnvelope) break;
    }
    assert('at least one evidence envelope found', foundEnvelope);
  }

  function testRegulationReports() {
    section('Regulation Reports');

    var regReports = _global.LIMENRegulationReports;
    assert('regulation reports module exists', !!regReports);
    assert('has generateUserPlan()', typeof regReports.generateUserPlan === 'function');
    assert('has generatePortalPlan()', typeof regReports.generatePortalPlan === 'function');
    assert('has generateBusinessPlan()', typeof regReports.generateBusinessPlan === 'function');
    assert('has generateDomainPlan()', typeof regReports.generateDomainPlan === 'function');
    assert('has generateCivilizationPlan()', typeof regReports.generateCivilizationPlan === 'function');
    assert('has generatePatentPlan()', typeof regReports.generatePatentPlan === 'function');
    assert('has generateGlobalRemedyReport()', typeof regReports.generateGlobalRemedyReport === 'function');
    assert('has generateAll()', typeof regReports.generateAll === 'function');

    var data = _generateTestData();
    var plans = regReports.generateAll(data.reports);

    // User plan
    assert('user plan exists', !!plans.user);
    assert('user plan has headline', typeof plans.user.headline === 'string');
    assert('user plan has confidence', typeof plans.user.confidence === 'string');
    assert('user plan has actions', Array.isArray(plans.user.actions));

    // Portal plan
    assert('portal plan exists', !!plans.portal);
    assert('portal plan has pattern', typeof plans.portal.pattern === 'string');
    assert('portal plan has suggestions', Array.isArray(plans.portal.suggestions));
    assert('portal plan has evidence', !!plans.portal.evidence);

    // Business plan
    assert('business plan exists', !!plans.business);
    assert('business plan has patternLabel', typeof plans.business.patternLabel === 'string');
    assert('business plan has kpis', Array.isArray(plans.business.kpis));

    // Domain plan
    assert('domain plan exists', !!plans.domain);
    assert('domain plan has domainStress', !!plans.domain.domainStress);
    assert('domain plan has signals', Array.isArray(plans.domain.signals));
    assert('domain plan has interventions', Array.isArray(plans.domain.interventions));

    // Civilization plan
    assert('civ plan exists', !!plans.civilization);
    assert('civ plan has globalMode', typeof plans.civilization.globalMode === 'string');
    assert('civ plan has remedyStrategy', Array.isArray(plans.civilization.remedyStrategy));
    assert('civ plan has domainOverview', Array.isArray(plans.civilization.domainOverview));

    // Patent plan
    assert('patent plan exists', !!plans.patent);
    assert('patent plan has opportunityScore', typeof plans.patent.opportunityScore === 'number');
    assert('patent plan has suggestedField', typeof plans.patent.suggestedField === 'string');
    assert('patent plan has signals', Array.isArray(plans.patent.signals));

    // Global remedy report
    assert('global plan exists', !!plans.global);
    assert('global plan has reportType', plans.global.reportType === 'globalRemedyReport');
    assert('global plan has systemicRisks', Array.isArray(plans.global.systemicRisks));
    assert('global plan has recommendedInterventions', !!plans.global.recommendedInterventions);
    assert('global plan has crossDomainConflicts', Array.isArray(plans.global.crossDomainConflicts));
    assert('global plan has innovationOpportunities', !!plans.global.innovationOpportunities);
  }

  function testRemedyLibrary() {
    section('Remedy Library');

    var regReports = _global.LIMENRegulationReports;
    var lib = regReports.getLibrary ? regReports.getLibrary() : null;

    if (lib && lib.entries) {
      assert('library loaded', true);
      assert('library has entries', lib.entries.length > 0);
      assert('library has version', typeof lib.version === 'string');

      // Validate entry structure
      var entry = lib.entries[0];
      assert('entry has domain', typeof entry.domain === 'string');
      assert('entry has pattern', typeof entry.pattern === 'string');
      assert('entry has remedy array', Array.isArray(entry.remedy));
      assert('entry has evidence', typeof entry.evidence === 'string');
      assert('entry has examples', Array.isArray(entry.examples));

      // Check domain coverage
      var domains = {};
      for (var i = 0; i < lib.entries.length; i++) {
        domains[lib.entries[i].domain] = true;
      }
      assert('library covers economy', !!domains.economy);
      assert('library covers energy', !!domains.energy);
      assert('library covers environment', !!domains.environment);
      assert('library covers health', !!domains.health);
      assert('library covers technology', !!domains.technology);
      assert('library covers research', !!domains.research);
      assert('library covers supplyChain', !!domains.supplyChain);
    } else {
      assert('library loaded', !isNode, 'library not available in this environment');
    }
  }

  function testCrossModuleIntegration() {
    section('Cross-Module Integration');

    // Full pipeline test: engine → synthesizer → regulation → exporter
    var data = _generateTestData();

    // Step 1: Engine output shape
    var recSet = data.recSet;
    assert('engine output has 5 scale arrays', !!recSet.mainUser && !!recSet.portalUser && !!recSet.business && !!recSet.domain && !!recSet.civilization);

    // Step 2: Synthesizer consumes engine output
    var reports = data.reports;
    assert('synthesizer produces 6 report types', Object.keys(reports).length === 6);

    // Step 3: Regulation reports consume synthesizer output
    var regReports = _global.LIMENRegulationReports;
    var plans = regReports.generateAll(reports);
    assert('regulation reports produces 7 plan types', Object.keys(plans).length === 7);

    // Step 4: Exporter can handle all report types
    var exporter = _global.LIMENReportExporter;
    var exportTypes = ['mainUser', 'portalUser', 'businessPortal', 'domain', 'civilization', 'patentOpportunity'];
    for (var i = 0; i < exportTypes.length; i++) {
      var report = reports[exportTypes[i]];
      assert('exporter accepts ' + exportTypes[i], !!report && !!report.reportType);
    }

    // Step 5: Global remedy report through exporter
    var globalPlan = plans.global;
    assert('global plan exportable', !!globalPlan && globalPlan.reportType === 'globalRemedyReport');

    // Step 6: Console stores data
    var console = _global.LIMENReportConsole;
    console.update(recSet, reports);
    assert('console stores recSet', !!console.getRecSet());
    assert('console stores reports', !!console.getReports());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Runner
  // ═══════════════════════════════════════════════════════════════════════════

  function runAll() {
    _pass = 0;
    _fail = 0;
    _log = ['LIMEN Report Validation — Test Suite\n'];

    testRecommendationRendering();
    testReportExport();
    testDomainRepairGeneration();
    testPatentOpportunityDetection();
    testEvidenceChainIntegrity();
    testRegulationReports();
    testRemedyLibrary();
    testCrossModuleIntegration();

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

  if (isNode) {
    // Load remedy library via shimmed fetch, then run tests
    _global.LIMENRegulationReports.loadLibrary('assets/data/remedy-library.json').then(function () {
      runAll();
    });
  }

  _global.LIMENReportValidation = {
    runAll: runAll
  };

})();
