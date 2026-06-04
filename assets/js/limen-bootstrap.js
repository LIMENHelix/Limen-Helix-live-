/**
 * limen-bootstrap.js
 * LIMEN HELIX — Canonical Bootstrap Loader
 *
 * Single entry point for all advisory module initialization.
 * Console page (civilization) runs the full advisory stack.
 * Connectome page runs a minimal subset (feed + global state only).
 * All other pages load modules passively (no start).
 *
 * Provides: window.LIMENDebug
 * Renders:  stability HUD on console page
 */

(function () {
  'use strict';

  window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

  // ─── Page type detection ──────────────────────────────────────────────

  var pathname = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  var isConsole = pathname === 'civilization.html' || pathname === 'civilization' || pathname === '';
  var isDomainConsole = pathname === 'domain-console.html' || pathname === 'domain-console';
  var isEnergyPage = pathname.indexOf('energy-') === 0;
  var isConnectome = pathname === 'connectome.html' || pathname === 'connectome';
  var isCanonical = isConsole || isConnectome || isDomainConsole || isEnergyPage;

  // ─── Debug object ─────────────────────────────────────────────────────

  var pageType = isConsole ? 'console' : isDomainConsole ? 'domain-console' : isEnergyPage ? 'energy-page' : isConnectome ? 'connectome' : 'passive';

  var debug = {
    loadedModules: [],
    startupErrors: [],
    pageType: pageType,
    initializedAt: null
  };

  window.LIMENDebug = debug;

  // ─── Module registry ──────────────────────────────────────────────────

  // Full advisory stack — started on console page
  var CONSOLE_MODULES = [
    { name: 'phase-estimator',       api: 'LIMENPhaseEstimator' },
    { name: 'feed-store',            api: 'LIMENFeedStore' },
    { name: 'feed-state',            api: 'LIMENFeedState' },
    { name: 'panel-state-manager',   api: 'LIMENPanelState' },
    { name: 'domain-signal-engine',  api: 'LIMENDomainEngine' },
    { name: 'event-narrator',        api: 'LIMENEventNarrator' },
    { name: 'action-suggester',      api: 'LIMENActionSuggester' },
    { name: 'world-signal-ingestor', api: 'LIMENWorldIngestor' },
    { name: 'cross-domain-detector', api: 'LIMENCrossDomainDetector' },
    { name: 'narrative-memory',      api: 'LIMENNarrativeMemoryEngine' },
    { name: 'domain-connectome-map', api: 'LIMENDomainMap' },
    { name: 'discovery-engine',      api: 'LIMENDiscoveryEngine' },
    { name: 'market-stress-triage',  api: 'LIMENMarketStressTriage' },
    { name: 'global-state-engine',   api: 'LIMENGlobalStateEngine' },
    { name: 'balance-meter',         api: 'LIMENBalanceMeter' },
    { name: 'report-polarity-engine',api: 'LIMENReportPolarityEngine' },
    { name: 'self-health-monitor',   api: 'LIMENSelfHealthMonitor' },
    { name: 'self-repair-engine',    api: 'LIMENSelfRepairEngine' },
    { name: 'escalation-console',    api: 'LIMENEscalationConsole' },
    { name: 'decision-memory',       api: 'LIMENDecisionMemoryEngine' },
    { name: 'event-engine',          api: 'LIMENEventEngine' },
    { name: 'timeline-engine',       api: 'LIMENTimelineEngine' },
    { name: 'investigation-engine',  api: 'LIMENInvestigationEngine' },
    { name: 'ui-mode-manager',       api: 'LIMENUIModeManager' },
    { name: 'command-bar',           api: 'LIMENCommandBar' },
    { name: 'biosensor-bridge',     api: 'LIMENBiosensorBridge' },
    // console-narrator (voice) removed
    { name: 'report-console',      api: 'LIMENReportConsole' },
    // philemon removed
    { name: 'console-clarity',     api: 'LIMENClarity' },
    { name: 'phase-domain-adapter', api: 'LIMENPhaseDomainAdapter' },
    { name: 'gap-synthesis-engine', api: 'LIMENGapSynthesis' },
    { name: 'inter-brain-bus', api: 'LIMENInterBrainBus' },
    { name: 'action-selection-gate', api: 'LIMENActionGate' }, // Stage-4 basal-ganglia chokepoint; DARK unless window.LIMEN_ENABLE_ACTION_GATE
    { name: 'live-discoveries', api: 'LIMENLiveDiscoveriesUI' } // Feed→Discovery; DARK unless window.LIMEN_ENABLE_LIVE_DISCOVERIES (folds into console-clarity)
  ];

  // Minimal subset — started on connectome page
  var CONNECTOME_MODULES = [
    { name: 'phase-estimator',       api: 'LIMENPhaseEstimator' },
    { name: 'feed-state',            api: 'LIMENFeedState' },
    { name: 'domain-signal-engine',  api: 'LIMENDomainEngine' },
    { name: 'global-state-engine',   api: 'LIMENGlobalStateEngine' },
    { name: 'phase-domain-adapter', api: 'LIMENPhaseDomainAdapter' }
  ];

  // Non-module components (loaded but not started via .start())
  var PASSIVE_CHECKS = [
    { name: 'connectome-core',    api: 'LIMENConnectome' },
    { name: 'connectome-renderer',api: 'LIMENRenderer' },
    { name: 'observer-node',      api: 'LIMENObserver' },
    { name: 'recommendation-engine', api: 'LIMENRecommendationEngine' },
    { name: 'report-synthesizer',    api: 'LIMENReportSynthesizer' },
    { name: 'report-exporter',       api: 'LIMENReportExporter' },
    { name: 'regulation-reports',    api: 'LIMENRegulationReports' },
    { name: 'domain-repair-map',     api: 'LIMENDomainRepairMap' },
    { name: 'remedy-resolver',       api: 'LIMENRemedyResolver' },
    { name: 'evidence-builder',      api: 'LIMENEvidenceBuilder' },
    { name: 'scale-translator',      api: 'LIMENScaleTranslator' },
    { name: 'fractal-schema',        api: 'LIMENFractalSchema' },
    { name: 'remedy-registry',       api: 'LIMENRemedyRegistryManager' }
  ];

  // ─── Defensive startup ────────────────────────────────────────────────

  function _tryStart(moduleDef) {
    var obj = window[moduleDef.api];

    if (!obj) {
      var msg = '[LIMEN] bootstrap: ' + moduleDef.name + ' not loaded (window.' + moduleDef.api + ' missing)';
      console.warn(msg);
      debug.startupErrors.push({ module: moduleDef.name, error: msg, time: Date.now() });
      return false;
    }

    if (typeof obj.start !== 'function') {
      var msg2 = '[LIMEN] bootstrap: ' + moduleDef.name + ' has no start() method';
      console.warn(msg2);
      debug.startupErrors.push({ module: moduleDef.name, error: msg2, time: Date.now() });
      debug.loadedModules.push(moduleDef.name);
      return true; // loaded but not startable
    }

    try {
      obj.start();
      debug.loadedModules.push(moduleDef.name);
      console.log('[LIMEN] bootstrap: started ' + moduleDef.name);
      return true;
    } catch (e) {
      var msg3 = '[LIMEN] bootstrap: ' + moduleDef.name + ' start() failed — ' + (e.message || e);
      console.error(msg3);
      debug.startupErrors.push({ module: moduleDef.name, error: msg3, time: Date.now() });
      return false;
    }
  }

  function _checkPassive(moduleDef) {
    if (window[moduleDef.api]) {
      debug.loadedModules.push(moduleDef.name);
      return true;
    }
    return false;
  }

  // ─── Stability HUD ───────────────────────────────────────────────────

  function _renderStabilityHUD() {
    var el = document.createElement('div');
    el.id = 'limen-stability-hud';
    el.style.cssText = [
      'position:fixed',
      'top:8px',
      'left:8px',
      'background:rgba(8,9,12,0.88)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:8px 12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.45rem',
      'letter-spacing:1.5px',
      'color:rgba(200,195,184,0.5)',
      'z-index:900',
      'border-radius:2px',
      'line-height:1.8',
      'pointer-events:none'
    ].join(';');

    var checks = [
      { label: 'BOOTSTRAP', ok: true },
      { label: 'CONNECTOME', ok: debug.loadedModules.indexOf('connectome-core') !== -1 },
      { label: 'OBSERVER', ok: debug.loadedModules.indexOf('observer-node') !== -1 },
      { label: 'DOMAIN ENGINE', ok: debug.loadedModules.indexOf('domain-signal-engine') !== -1 },
      { label: 'NARRATOR', ok: debug.loadedModules.indexOf('event-narrator') !== -1 },
      { label: 'REPORT EXPORTER', ok: debug.loadedModules.indexOf('report-exporter') !== -1 },
      { label: 'REPORT CONSOLE', ok: debug.loadedModules.indexOf('report-console') !== -1 },
      { label: 'REMEDY REGISTRY', ok: debug.loadedModules.indexOf('remedy-registry') !== -1 },
      { label: 'FRACTAL SCHEMA', ok: debug.loadedModules.indexOf('fractal-schema') !== -1 },
      // philemon removed
      { label: 'CLARITY', ok: debug.loadedModules.indexOf('console-clarity') !== -1 }
    ];

    var html = '<div style="color:rgba(201,169,78,0.4);margin-bottom:4px">LIMEN STATUS</div>';
    for (var i = 0; i < checks.length; i++) {
      var color = checks[i].ok ? 'rgba(90,181,160,0.7)' : 'rgba(232,84,84,0.7)';
      var sym = checks[i].ok ? '+' : '-';
      html += '<div style="color:' + color + '">[' + sym + '] ' + checks[i].label + '</div>';
    }

    if (debug.startupErrors.length > 0) {
      html += '<div style="color:rgba(232,84,84,0.5);margin-top:4px">' + debug.startupErrors.length + ' error(s)</div>';
    }

    el.innerHTML = html;
    document.body.appendChild(el);

    // Auto-fade after 8 seconds
    setTimeout(function () {
      el.style.transition = 'opacity 2s ease';
      el.style.opacity = '0';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 2000);
    }, 8000);
  }

  // ─── Main bootstrap ──────────────────────────────────────────────────

  function bootstrap() {
    debug.initializedAt = Date.now();

    console.log('[LIMEN] bootstrap: page type = ' + debug.pageType);

    // Check passive components (always)
    for (var p = 0; p < PASSIVE_CHECKS.length; p++) {
      _checkPassive(PASSIVE_CHECKS[p]);
    }

    if (!isCanonical) {
      console.log('[LIMEN] bootstrap: passive mode — advisory modules not started');
      return;
    }

    // Select module set based on page type
    var modules = (isConsole || isDomainConsole) ? CONSOLE_MODULES : (isEnergyPage ? CONNECTOME_MODULES : CONNECTOME_MODULES);

    // Start modules in order
    for (var i = 0; i < modules.length; i++) {
      _tryStart(modules[i]);
    }

    console.log('[LIMEN] bootstrap: ' + debug.loadedModules.length + ' modules loaded, ' + debug.startupErrors.length + ' errors');

    // ─── Report layer readiness ───────────────────────────────────────
    if (window.LIMENReportExporter) {
      console.log('[LIMEN] report exporter ready');
    }
    if (window.LIMENReportConsole) {
      console.log('[LIMEN] report console ready');
    }
    if (window.LIMENRegulationReports) {
      console.log('[LIMEN] regulation reports ready');
      // Load remedy library for regulation plans
      if (typeof window.LIMENRegulationReports.loadLibrary === 'function') {
        window.LIMENRegulationReports.loadLibrary('assets/data/remedy-library.json');
      }
    }

    // Expose window.LIMENReports — initialized as empty object, never null
    window.LIMENReports = {};
    window.addEventListener('limen:report-update', function (e) {
      if (e.detail && e.detail.reports) {
        window.LIMENReports = e.detail.reports;
        console.log('[LIMEN] reports ready', Object.keys(window.LIMENReports));
      }
    });

    // Auto-generate first report set after domain data arrives
    if (isConsole) {
      _scheduleFirstReport();
    }

    // Render stability HUD on console page only
    if (isConsole) {
      _renderStabilityHUD();
      _renderReportButton();
    }
  }

  // ─── First report generation ──────────────────────────────────────────

  function _scheduleFirstReport() {
    // Wait for domain data to arrive, then generate initial reports
    var _firstReportDone = false;

    function _tryGenerate() {
      if (_firstReportDone) return;
      var domains = window.LIMENDomains;
      if (!domains || Object.keys(domains).length === 0) return;
      _firstReportDone = true;
      _generateReports();
    }

    // Try on domain-update events
    window.addEventListener('limen:domain-update', function () {
      _tryGenerate();
    });

    // Also try after a short delay in case domains are already loaded
    setTimeout(function () {
      _tryGenerate();
    }, 5000);
  }

  // ─── Registry harvesting ─────────────────────────────────────────────

  var _registryPopulated = false;
  var _activeTreatments = [];
  var _harvestComplete = false;
  var _reportsGeneratedOnce = false;
  var _reportsRefreshedAfterHarvest = false;

  function _populateRegistry() {
    if (_registryPopulated) return;
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) {
      console.warn('[LIMEN] registry manager not loaded — skipping harvest');
      return;
    }

    var domains = window.LIMENDomains || {};
    var dk = Object.keys(domains);
    if (dk.length === 0) return;

    // Harvest portal domain JSONs for each active domain
    var harvestCount = 0;
    var harvestUrls = [];

    // Build URLs for known domain portals
    for (var i = 0; i < dk.length; i++) {
      harvestUrls.push('assets/data/domains/' + dk[i] + '.json');
    }

    // Also harvest medicine specialty portals (deep portal roots)
    var medicinePortals = [
      'medicine_neurology', 'medicine_metabolic', 'medicine_pediatric_med',
      'medicine_gutbrain', 'medicine_addiction', 'medicine_psychedelic',
      'medicine_diagnostics', 'medicine_psychiatry',
      'medicine_cardiology', 'medicine_oncology', 'medicine_surgery',
      'medicine_emergency', 'medicine_primary'
    ];
    for (var mp = 0; mp < medicinePortals.length; mp++) {
      harvestUrls.push('assets/data/domains/' + medicinePortals[mp] + '.json');
    }

    // Synthetic _LIVE_STRESS diagnosis/treatment fabrication REMOVED.
    // This Civilization-owned bootstrap was inventing "Domain Stress"
    // diagnoses and "Monitor and stabilize" boilerplate treatments for
    // every domain. Civilization is not allowed to fabricate domain truth.
    // Real domain diagnoses/treatments come from sovereign domain brains
    // via window.LIMENDomains[domain].brainDiagnoses / brainTreatments,
    // and from legitimate portal-authored content harvested below.
    // Domain-owned opportunities pages do not consume this registry path
    // (verified), so this removal only affects Civilization-owned surfaces.

    // Fetch portal JSONs asynchronously
    if (harvestUrls.length > 0) {
      mgr.harvestFromUrls(harvestUrls, function (total) {
        if (total > 0) {
          console.log('[LIMEN] registry harvested ' + total + ' portal treatments');
          // Rebuild resolver registry after harvest
          mgr.buildResolverRegistry();
        }
        // Phase 2: re-run regulation with full portal data
        if (window.LIMENDomainRegulationEngine) {
          window.LIMENDomainRegulationEngine.onHarvestComplete();
        }
        _harvestComplete = true;
      });
    }

    // Build resolver registry from what we have so far
    mgr.buildResolverRegistry();
    _registryPopulated = true;
    console.log('[LIMEN] registry populated: ' + harvestCount + ' live diagnoses');
  }

  function _queryRegistryForReports() {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) return { diagnoses: {}, treatments: {}, steps: {} };

    var domains = window.LIMENDomains || {};
    var dk = Object.keys(domains);
    var result = { diagnoses: {}, treatments: {}, steps: {} };

    for (var i = 0; i < dk.length; i++) {
      var domId = dk[i];
      var d = domains[domId];

      // Get diagnoses for this domain
      var dxList = mgr.getDiagnosesForDomain(domId);

      // Get treatments via stress threshold
      var txList = mgr.getTreatmentsOnDomainStress(domId, d.stress || 0);

      // Prioritize treatments
      var domainStress = {};
      domainStress[domId] = d.stress || 0;
      var prioritized = mgr.prioritize(txList, { domainStress: domainStress });

      result.diagnoses[domId] = dxList;
      result.treatments[domId] = prioritized;

      // Collect steps from top treatments
      var domSteps = [];
      for (var ti = 0; ti < Math.min(prioritized.length, 5); ti++) {
        var steps = mgr.getStepsForTreatment(prioritized[ti].id);
        for (var si = 0; si < steps.length; si++) {
          domSteps.push(steps[si]);
        }
      }
      result.steps[domId] = domSteps;
    }

    // Store for debug
    _activeTreatments = [];
    for (var key in result.treatments) {
      if (result.treatments.hasOwnProperty(key)) {
        _activeTreatments = _activeTreatments.concat(result.treatments[key]);
      }
    }

    return result;
  }

  function _generateReports() {
    var synth = window.LIMENReportSynthesizer;
    var engine = window.LIMENRecommendationEngine;
    if (!synth || !engine) {
      console.warn('[LIMEN] report generation skipped — engine or synthesizer not loaded');
      return;
    }

    // Populate registry before generating reports
    _populateRegistry();

    try {
      var prop = window.LIMENPropagation;
      var router = window.LIMENSignalRouter || window.SignalRouter;
      var seeds = {};

      // Gather seeds from signal router if available
      if (router && typeof router.gatherInputs === 'function') {
        var signals = router.gatherInputs();
        var mapper = window.SignalMapper;
        if (mapper && typeof mapper.mapSignals === 'function') {
          seeds = mapper.mapSignals(signals);
        }
      }

      // Run propagation if available
      var propResult = { activations: {}, hyper: [], steps: 0, converged: true };
      if (prop && typeof prop.activate === 'function') {
        propResult = prop.activate(seeds);
      }

      // Build node states from propagation result
      var nodeStates = {};
      var acts = propResult.activations || {};
      var hyper = propResult.hyper || [];
      for (var id in acts) {
        if (!acts.hasOwnProperty(id)) continue;
        nodeStates[id] = {
          activation: acts[id],
          direction: hyper.indexOf(parseInt(id, 10)) >= 0 ? 'hyper' : (acts[id] < 0.2 ? 'hypo' : 'silent'),
          predictionError: 0, system: 'unknown', label: 'node-' + id,
          salience: acts[id], activationMean: 0.3, activationVar: 0.05, seedSource: null
        };
      }

      // Build feed sources from domains
      var feedSources = [];
      var domains = window.LIMENDomains || {};
      var dk = Object.keys(domains);
      for (var i = 0; i < dk.length; i++) {
        var d = domains[dk[i]];
        feedSources.push({
          feedId: dk[i], feedName: dk[i], domain: dk[i],
          stress: d.stress || 0, live: true,
          fetchedAt: d.updated || Date.now(), contributesTo: []
        });
      }

      // Compute source health
      var sourceHealth = 0.5;
      if (dk.length > 0) {
        var total = 0;
        for (var j = 0; j < dk.length; j++) total += (domains[dk[j]].confidence || 0.5);
        sourceHealth = total / dk.length;
      }

      // Query registry for diagnoses/treatments/steps
      var registryData = _queryRegistryForReports();

      // Generate recommendations + reports
      var patentData = window.LIMENPatentOpportunity || null;
      var bundle = synth.generateAndReport({
        propagationResult: propResult,
        nodeStates: nodeStates,
        feedSources: feedSources,
        sourceHealth: sourceHealth
      }, { patentData: patentData });

      // Enrich reports with registry data
      _enrichReportsWithRegistry(bundle.reports, registryData);

      // Assign to global
      window.LIMENReports = bundle.reports;
      console.log('[LIMEN] reports ready', Object.keys(window.LIMENReports));

      // Update console if loaded
      if (window.LIMENReportConsole && typeof window.LIMENReportConsole.update === 'function') {
        window.LIMENReportConsole.update(bundle.recommendations, bundle.reports);
      }

      // Dispatch event for other listeners
      window.dispatchEvent(new CustomEvent('limen:report-update', {
        detail: { recSet: bundle.recommendations, reports: bundle.reports, registryData: registryData }
      }));

      // Trigger regulation engine (Phase 1)
      if (window.LIMENDomainRegulationEngine) {
        window.LIMENDomainRegulationEngine.regulateAll();
      }

      // Run quality assessment after regulation
      if (window.LIMENPortalQualityAssessor) {
        setTimeout(function () { window.LIMENPortalQualityAssessor.assessAll(); }, 500);
      }

      _reportsGeneratedOnce = true;
    } catch (e) {
      console.warn('[LIMEN] report generation failed:', e.message);
    }
  }

  function _enrichReportsWithRegistry(reports, registryData) {
    if (!reports || !registryData) return;

    // Enrich civilization report with per-domain diagnoses/treatments
    if (reports.civilization) {
      reports.civilization.registryDiagnoses = registryData.diagnoses;
      reports.civilization.registryTreatments = registryData.treatments;
      reports.civilization.registrySteps = registryData.steps;
    }

    // Enrich domain report with registry data
    if (reports.domain) {
      reports.domain.registryDiagnoses = registryData.diagnoses;
      reports.domain.registryTreatments = registryData.treatments;
      reports.domain.registrySteps = registryData.steps;
    }

    // Enrich global remedy report
    if (reports.globalRemedyReport) {
      reports.globalRemedyReport.registryDiagnoses = registryData.diagnoses;
      reports.globalRemedyReport.registryTreatments = registryData.treatments;
    }
  }

  // ─── Report button ──────────────────────────────────────────────────

  function _renderReportButton() {
    var btn = document.createElement('button');
    btn.id = 'limen-report-btn';
    btn.textContent = 'GENERATE REPORTS';
    btn.style.cssText = [
      'position:fixed', 'bottom:12px', 'right:12px', 'z-index:8000',
      'background:rgba(201,169,78,0.12)', 'border:1px solid rgba(201,169,78,0.3)',
      'color:#C9A94E', 'padding:8px 16px', 'font-family:"IBM Plex Mono",monospace',
      'font-size:0.6rem', 'letter-spacing:1.5px', 'text-transform:uppercase',
      'cursor:pointer', 'border-radius:3px', 'transition:all 0.2s ease'
    ].join(';');
    btn.onmouseenter = function () { btn.style.background = 'rgba(201,169,78,0.25)'; };
    btn.onmouseleave = function () { btn.style.background = 'rgba(201,169,78,0.12)'; };
    btn.onclick = function () {
      btn.textContent = 'GENERATING...';
      btn.style.opacity = '0.6';
      setTimeout(function () {
        _generateReports();
        var keys = window.LIMENReports ? Object.keys(window.LIMENReports) : [];
        if (keys.length > 0) {
          btn.textContent = 'REPORTS READY (' + keys.length + ')';
          btn.style.borderColor = 'rgba(76,175,80,0.5)';
          btn.style.color = '#4CAF50';
          // Open report console if available
          if (window.LIMENReportConsole && typeof window.LIMENReportConsole.show === 'function') {
            window.LIMENReportConsole.show();
          }
        } else {
          btn.textContent = 'NO DATA — RETRY';
          btn.style.borderColor = 'rgba(244,67,54,0.5)';
          btn.style.color = '#F44336';
        }
        btn.style.opacity = '1';
        // Reset after 5s
        setTimeout(function () {
          btn.textContent = 'GENERATE REPORTS';
          btn.style.borderColor = 'rgba(201,169,78,0.3)';
          btn.style.color = '#C9A94E';
        }, 5000);
      }, 100);
    };
    document.body.appendChild(btn);
  }

  // ─── Clarity report trigger ─────────────────────────────────────────

  window.addEventListener('limen:request-reports', function () {
    _generateReports();
  });

  // Post-harvest report refresh — runs once after the async portal harvest
  // completes AND the initial _generateReports() has finished. Fixes the
  // pre-harvest report staleness race: registry queried before harvest
  // populates it, leaving reports bound to an empty registry until this
  // listener re-runs generation against the now-populated registry.
  window.addEventListener('limen:regulation-ready', function () {
    if (!_reportsGeneratedOnce) return;
    if (!_harvestComplete) return;
    if (_reportsRefreshedAfterHarvest) return;
    _reportsRefreshedAfterHarvest = true;
    _generateReports();
  });

  // ─── Init ─────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // ─── Public API ───────────────────────────────────────────────────────

  // ─── Debug: dumpActiveTreatments ──────────────────────────────────────

  window.dumpActiveTreatments = function () {
    var lines = [];
    lines.push('╔════════════════════════════════════════════════════════╗');
    lines.push('║     ACTIVE TREATMENTS — CURRENT REPORT CYCLE         ║');
    lines.push('╚════════════════════════════════════════════════════════╝');
    lines.push('');

    if (_activeTreatments.length === 0) {
      lines.push('No active treatments. Generate a report first.');
    } else {
      lines.push('Total active treatments: ' + _activeTreatments.length);
      lines.push('');
      for (var i = 0; i < _activeTreatments.length; i++) {
        var t = _activeTreatments[i];
        lines.push('[' + (i + 1) + '] ' + t.id);
        lines.push('    title: ' + (t.title || '').substring(0, 70));
        lines.push('    type: ' + (t.type || '?') + ' | conf: ' + (t.confidence || '?'));
        lines.push('    scale: ' + (t.scaleTags || []).join(',') + ' | time: ' + (t.timeTags || []).join(','));
        lines.push('    steps: ' + (t.steps || []).length);
        if (t.steps && t.steps.length > 0) {
          for (var si = 0; si < Math.min(t.steps.length, 3); si++) {
            lines.push('      [' + t.steps[si].sequence + '] ' + (t.steps[si].action || '').substring(0, 60));
          }
          if (t.steps.length > 3) lines.push('      ... +' + (t.steps.length - 3) + ' more');
        }
        lines.push('');
      }
    }

    // Registry stats
    var mgr = window.LIMENRemedyRegistryManager;
    if (mgr && mgr.stats) {
      var st = mgr.stats();
      lines.push('REGISTRY STATS:');
      lines.push('  treatments: ' + st.treatments);
      lines.push('  diagnoses: ' + st.diagnoses);
      lines.push('  steps: ' + st.steps);
      lines.push('  scanned portals: ' + st.scannedPortals);
    }

    lines.push('═══════════════════════════════════════════════════════');
    var output = lines.join('\n');
    console.log(output);
    return output;
  };

  // ─── Debug: traceProvenance ───────────────────────────────────────

  window.traceProvenance = function (treatmentId) {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr || !mgr.getProvenance) {
      console.log('Registry not loaded.');
      return null;
    }

    // If no ID given, trace all active treatments
    if (!treatmentId) {
      var lines = [];
      lines.push('╔══════════════════════════════════════════════════════╗');
      lines.push('║     PROVENANCE TRACE — ALL ACTIVE TREATMENTS        ║');
      lines.push('╚══════════════════════════════════════════════════════╝');
      lines.push('');
      for (var i = 0; i < _activeTreatments.length; i++) {
        var p = mgr.getProvenance(_activeTreatments[i].id);
        if (p) {
          lines.push('[' + (i + 1) + '] TREATMENT: ' + p.treatment.title);
          for (var c = 0; c < p.chain.length; c++) {
            lines.push('    ' + p.chain[c]);
          }
          lines.push('');
        }
      }
      if (_activeTreatments.length === 0) lines.push('No active treatments. Generate a report first.');
      var output = lines.join('\n');
      console.log(output);
      return output;
    }

    var prov = mgr.getProvenance(treatmentId);
    if (!prov) {
      console.log('Treatment not found: ' + treatmentId);
      return null;
    }
    console.log('PROVENANCE CHAIN:');
    for (var j = 0; j < prov.chain.length; j++) {
      console.log('  ' + prov.chain[j]);
    }
    return prov;
  };

  window.LIMENBootstrap = {
    debug: debug,
    isCanonical: isCanonical,
    isConsole: isConsole,
    isConnectome: isConnectome
  };

})();
