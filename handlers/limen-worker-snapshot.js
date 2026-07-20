/**
 * api/limen-worker/snapshot.js — Snapshot cache worker
 *
 * GET /api/limen-worker/snapshot
 *
 * Builds console + opportunities snapshots server-side.
 * Browser fetches these instead of computing everything.
 * Called by cron every 2-5 minutes.
 */

var db = require('../lib/limen-db');
var companyScorer = require('../lib/company-phase-scorer');
var phasePercept = require('../lib/phase-percept');
var groundedStress = require('../lib/grounded-stress');   // SHADOW candidate: stress from node/company distress, not feed volume
var phaseEstimator = require('../lib/phase-estimator');   // SHADOW: precision-weighted P0-P10 belief; grounded-stress is its Adapter B
var energyMarketFeed = require('../lib/energy-market-feed');   // LIVE market channel, ENERGY ONLY (real, validated WTI series; see memory: energy-backfill-first-result)
var feedFractal = require('../lib/feed-fractal');   // typed content channels (content, not article count) + geopolitical extension for real available energy text
var energyOutcomeTracker = require('../lib/energy-outcome-tracker');   // LIVE outcome loop, ENERGY ONLY: records today's forecast, resolves matured ones vs real forward price
var outcomeLedger = require('../lib/outcome-ledger');   // for distressMass() — promotes the fused belief into the LIVE dsum.stress for energy (see inline comment at the call site)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var start = Date.now();

  // ── Phase 25: Priority-aware parallel company scoring ──
  // Deferred until domain health is available (scored after domain snapshot fetch)

  // Fetch latest domain snapshot
  var domainResp;
  try {
    domainResp = await fetch('https://www.limenhelix.com/api/domain-snapshot');
    domainResp = await domainResp.json();
  } catch (e) {
    res.status(500).json({ ok: false, error: 'domain-snapshot fetch failed: ' + e.message });
    return;
  }

  // Fetch latest defense signals
  var defenseResp;
  try {
    defenseResp = await fetch('https://www.limenhelix.com/api/defense-signals');
    defenseResp = await defenseResp.json();
  } catch (e) {
    defenseResp = { signals: [], macroShock: { detected: false } };
  }

  // Build console snapshot
  var domains = domainResp.domains || {};
  var domainSummary = {};
  var stressRanked = [];
  for (var dk in domains) {
    if (!domains.hasOwnProperty(dk)) continue;
    var d = domains[dk];
    // Phase 24X: Server-side provisional phase (supported phases only)
    // P7a/P9/P10/P8 suppressed — require viability/recovery inputs not available server-side
    var sStress = d.stress || 0;
    var sMat = d.maturity || 'EARLY';
    var sConf = d.confidence || 0;
    var phase = 'p0', phaseLabel = 'SOURCE';
    if (sStress >= 0.59 && sMat === 'STRUCTURAL') { phase = 'p5'; phaseLabel = 'ENDURANCE'; }
    else if (sStress >= 0.59 && sMat === 'CONFIRMED') { phase = 'p3'; phaseLabel = 'INSTABILITY'; }
    else if (sStress >= 0.40 && sMat === 'STRUCTURAL') { phase = 'p5'; phaseLabel = 'ENDURANCE'; }
    else if (sStress >= 0.40 && sMat === 'CONFIRMED') { phase = 'p3'; phaseLabel = 'INSTABILITY'; }
    else if (sStress >= 0.25) { phase = 'p2'; phaseLabel = 'RHYTHM'; }
    else if (sStress >= 0.15 && sMat === 'FORMING') { phase = 'p1'; phaseLabel = 'RUPTURE'; }

    domainSummary[dk] = {
      stress: sStress,
      activity: d.activity || 0,
      confidence: sConf,
      maturity: sMat,
      phase: phase,
      phaseLabel: phaseLabel,
      status: d.status || 'UNKNOWN',
      liveCount: d.liveCount || 0,
      topSignal: (d.signals && d.signals[0]) || null,
      sources: (d.sources || []).map(function(s) { return { name: s.name, live: s.live, channel: s.channel || null }; }),
      _channels: d._channels || null,
      _confidence: d._confidence || null
    };
    stressRanked.push({ domain: dk, stress: sStress, activity: d.activity || 0, confidence: sConf, maturity: sMat, phase: phase });
  }
  stressRanked.sort(function(a, b) { return b.stress - a.stress; });

  var consoleSnapshot = {
    generatedAt: Date.now(),
    version: 2,
    domains: domainSummary,
    stressRanked: stressRanked,
    macroShock: defenseResp.macroShock || { detected: false },
    defenseSignals: (defenseResp.signals || []).slice(0, 6),
    domainCount: Object.keys(domains).length,
    liveCount: Object.keys(domains).filter(function(k) { return domains[k].status === 'LIVE'; }).length,
    convergenceSignals: null // populated below
  };

  // ── Phase 25: Score companies (priority scheduler needs domainSummary) ──
  var companyResult = null;
  try {
    companyResult = await companyScorer.scoreBatch(domainSummary);
  } catch (e) {
    companyResult = { scored: [], error: e.message };
  }

  // ── Phase 25: Build domain company join + convergence signals ──
  var convergenceSignals = {};
  try {
    var domainJoin = await companyScorer.buildDomainJoin();
    convergenceSignals = companyScorer.evaluateConvergenceSignals(domainJoin, domainSummary);
    consoleSnapshot.convergenceSignals = convergenceSignals;
    consoleSnapshot.domainCompanyJoin = domainJoin;

    // ── NODE-GROUNDED PHASE (2026-07-17): correct each domain's provisional heuristic
    // phase with the domain's own kernel-scored company nodes (active inference: prior =
    // heuristic, evidence = node phase distribution, precision = coverage x count). When
    // grounded, the node evidence sets the authoritative phase the master AI reads; when
    // evidence is thin the percept ABSTAINS and the heuristic stands (never fabricated).
    // Evidence flows nodes -> snapshot only; a node's own phase is never overwritten.
    var groundedCount = 0, divergentCount = 0;
    var gsGroundedCount = 0, gsDivergentCount = 0;   // grounded-STRESS shadow tallies

    // GROUNDED-STRESS MEMORY (2026-07-19). The CISS-style composite needs two pieces of history the
    // pure compute() cannot hold: the per-channel sample its empirical-CDF ranks against, and the
    // EWMA correlation state. Without them C stays at identity forever and the co-movement term —
    // the entire point of the quadratic form — never engages. Kept deliberately small: one history
    // point per channel per HOUR (not per 15m run) and capped, because Upstash bills bandwidth.
    var GS_HISTORY_CAP = 300;            // ~12.5 days of hourly baseline per channel
    var GS_APPEND_MS = 60 * 60 * 1000;   // append at most hourly
    var gsMem = null;
    try { gsMem = await db.get('grounded_stress_memory'); } catch (me) { gsMem = null; }
    if (!gsMem || typeof gsMem !== 'object' || !gsMem.domains) gsMem = { domains: {}, updatedAt: 0 };
    var gsNow = Date.now();
    var gsMemDirty = false;
    for (var pk in domainSummary) {
      if (!domainSummary.hasOwnProperty(pk)) continue;
      var dsum = domainSummary[pk];
      var joinRow = domainJoin[pk];
      var pcpt = phasePercept.computePercept(
        { phase: dsum.phase, source: 'stress-heuristic' },
        (joinRow && joinRow.companies) || []
      );
      // Always record the reading for transparency (the AI can see abstentions too).
      dsum.phasePrior = pcpt.prior.phase;
      dsum.phaseGrounded = pcpt.grounded;
      dsum.phasePrecision = pcpt.precision;
      dsum.phaseDivergent = pcpt.divergent;
      dsum.phaseSalience = pcpt.salience;
      dsum.phaseEvidence = { scored: pcpt.evidence.scored, coverage: pcpt.evidence.coverage, distribution: pcpt.evidence.distribution };
      if (pcpt.grounded) {
        groundedCount++;
        if (pcpt.divergent) divergentCount++;
        dsum.phase = pcpt.groundedPhase;
        dsum.phaseLabel = phasePercept.labelFor(pcpt.groundedPhase) || dsum.phaseLabel;
        dsum.phaseSource = 'node-grounded';
        // keep stressRanked's phase consistent with the grounded value
        for (var sri = 0; sri < stressRanked.length; sri++) {
          if (stressRanked[sri].domain === pk) { stressRanked[sri].phase = pcpt.groundedPhase; break; }
        }
      } else {
        dsum.phaseSource = 'stress-heuristic';
      }

      // GROUNDED STRESS (SHADOW, 2026-07-18): stress from the domain's kernel-scored company distress
      // (alert flags + distress trajectories + p7a/p7b/p3 counts) — NOT feed volume. Attached for
      // OBSERVATION ONLY; dsum.stress (feed-derived) is unchanged. Abstains on thin company coverage.
      try {
        var gsSlot = gsMem.domains[pk] || (gsMem.domains[pk] = { history: {}, corrState: null, lastAppendTs: 0, phaseCorr: null, outcomeTrack: null });
        // ONE compute pass, via the Adapter B bundle. bundle.composite is the full CISS output.
        var bundle = groundedStress.toBundle(joinRow, { subjectId: pk, history: gsSlot.history, corrState: gsSlot.corrState });
        var gs = bundle.composite || { grounded: false, stress: null, reason: bundle.reason };
        dsum.groundedStress = gs;

        if (gs.grounded) {
          gsSlot.corrState = gs.corrState;                 // carry the CISS EWMA forward
          gsMemDirty = true;
          if (gsNow - (gsSlot.lastAppendTs || 0) >= GS_APPEND_MS) {
            var chans = gs.channels || {};
            for (var chName in chans) {
              if (!chans.hasOwnProperty(chName) || !chans[chName]) continue;
              var arr = gsSlot.history[chName] || (gsSlot.history[chName] = []);
              arr.push(chans[chName].raw);
              if (arr.length > GS_HISTORY_CAP) arr.splice(0, arr.length - GS_HISTORY_CAP);
            }
            gsSlot.lastAppendTs = gsNow;
          }
          if (typeof dsum.stress === 'number') {
            gsGroundedCount++;
            if (Math.abs(gs.stress - dsum.stress) > 0.25) gsDivergentCount++;   // feed vs grounded disagree by >25pp
          }

          // LIVE MARKET CHANNEL (2026-07-20, ENERGY ONLY): the company-node channels above are quarterly-
          // financial-lag by construction (a war this week cannot show up in a 10-Q). This adds a REAL,
          // point-in-time market signal so a live price move is not invisible. Reuses the exact
          // marketStress() function validated on 40y of real WTI (memory: energy-backfill-first-result;
          // precision 0.70, recall 0.08 — a cautious, high-precision channel, correctly weighted as one
          // vote among several, not the level-setter). Fails soft: any fetch/parse error => no channel
          // added, estimator runs on company channels alone exactly as before (never fabricate).
          if (pk === 'energy') {
            try {
              var liveMkt = await energyMarketFeed.getLiveMarketChannel();
              if (liveMkt && liveMkt.reading) {
                bundle.readings.push(liveMkt.reading);
                dsum.marketChannel = { score: liveMkt.score, price: liveMkt.latestPrice, asOf: liveMkt.latestDate, source: liveMkt.source };
                if (gsNow - (gsSlot.lastAppendTs || 0) >= GS_APPEND_MS || !gsSlot.history.marketScore) {
                  var mArr = gsSlot.history.marketScore || (gsSlot.history.marketScore = []);
                  mArr.push(liveMkt.score);
                  if (mArr.length > GS_HISTORY_CAP) mArr.splice(0, mArr.length - GS_HISTORY_CAP);
                }
              } else {
                dsum.marketChannel = { score: null, reason: 'live fetch unavailable this run — estimator falls back to company channels alone' };
              }
            } catch (mfe) { dsum.marketChannel = { score: null, reason: 'market feed error: ' + mfe.message }; }
          }

          // LIVE FEED FRACTAL (2026-07-20, ENERGY ONLY): real per-article headlines from the already-
          // running RSS ingest (limen-worker-ingest.js -> latest_ingest; TTL bumped 300s->1200s in this
          // same change so it reliably survives to this read, was racing its own 15m cron). Filtered to
          // signals whose affectedDomains includes energy, classified by CONTENT (feed-fractal.js), not
          // counted. HONEST SCOPE: the real available text right now is geopolitical (Hormuz/Iran/
          // military), not corporate — feed-fractal's `supply` regex was extended and a new `conflict`
          // category added specifically to classify this real available text. The ORIGINAL corporate
          // categories (workforce/leadership/pricing/demand/competition/litigation/recall/capital)
          // remain UNCONNECTED to any live per-company feed, because none exists yet (company
          // newsFeed[] is empty) — this change does not close that gap, only the geopolitical one.
          if (pk === 'energy') {
            try {
              var ingest = await db.get('latest_ingest');
              var ingestItems = [];
              if (ingest && Array.isArray(ingest.signals)) {
                ingest.signals.forEach(function (sig) {
                  if (!sig || !Array.isArray(sig.affectedDomains) || sig.affectedDomains.indexOf('energy') === -1) return;
                  var quality = sig.confidence === 'HIGH' ? 'real' : (sig.confidence === 'MEDIUM' ? 'event' : 'degraded');
                  (sig.titles || []).forEach(function (title) { ingestItems.push({ text: title, quality: quality }); });
                });
              }
              var feedChannels = feedFractal.toChannels(ingestItems);
              feedChannels.forEach(function (fc) {
                bundle.readings.push(fc);
                if (gsNow - (gsSlot.lastAppendTs || 0) >= GS_APPEND_MS || !gsSlot.history[fc.key]) {
                  var fArr = gsSlot.history[fc.key] || (gsSlot.history[fc.key] = []);
                  fArr.push(fc.value);
                  if (fArr.length > GS_HISTORY_CAP) fArr.splice(0, fArr.length - GS_HISTORY_CAP);
                }
              });
              dsum.feedFractal = {
                itemCount: ingestItems.length,
                channels: feedChannels.map(function (fc) { return { key: fc.key, value: fc.value, typedItems: fc.typedItems }; })
              };
            } catch (ffe) { dsum.feedFractal = { itemCount: 0, reason: 'feed fractal error: ' + ffe.message }; }
          }

          // PHASE ESTIMATOR (SHADOW, 2026-07-19): fuse the domain bundle into a P0-P10 belief via the
          // shared precision-weighted core. Separate corrState (phaseCorr) from the CISS one. peHist is
          // built from WHATEVER channel keys currently have history (not a fixed list) so a newly-
          // appearing feed_* channel (from the fractal above) automatically gets CDF tracking with no
          // further code change.
          try {
            var peHist = {};
            for (var histKey in gsSlot.history) { if (gsSlot.history.hasOwnProperty(histKey)) peHist[histKey] = gsSlot.history[histKey]; }
            var est = phaseEstimator.estimate(bundle, { corrState: gsSlot.phaseCorr, history: peHist, distressComposite: bundle.distressComposite });
            if (est.grounded) gsSlot.phaseCorr = est.corrState;   // persist estimator memory (belief carried forward)
            dsum.phaseBelief = {
              grounded: est.grounded, phaseMAP: est.phaseMAP, confidence: est.confidence, stuck: est.stuck,
              belief: (est.belief || []).map(function (x) { return Math.round(x * 1000) / 1000; })   // rounded for payload; full precision stays in phaseCorr
            };

            // PROMOTE the grounded estimate into the LIVE, DISPLAYED dsum.stress (2026-07-20, ENERGY
            // ONLY). Every commit up to this one deliberately left dsum.stress (feed-volume) untouched —
            // correct DURING the build, but it meant nothing built this session ever reached what the
            // console/domain-brain actually shows (domain-brain-base.js:488 reads dsum.stress directly;
            // it has never referenced groundedStress/phaseBelief). Confirmed live: energy's console was
            // still pinned near 1.0 (feed-volume artifact) throughout, unchanged by any of the fixes.
            //
            // Promote to outcomeLedger.distressMass(est.belief) — NOT groundedStress.stress. The CISS
            // composite (gs.stress) is computed from company channels ONLY, before market/feed channels
            // are pushed onto the bundle, so it structurally cannot see the live crisis signal. The
            // fused belief's distress mass DOES incorporate company+market+feed via the full precision-
            // weighted estimate (bug-fixed today), and it is not a new invented metric — it is the exact
            // `beliefDistress` quantity outcome-ledger.buildForecast() already computes and the outcome
            // loop is already scoring for correctness. The displayed number and the number being
            // validated against real forward outcomes are now the SAME number, not two that could drift.
            //
            // The old value is preserved, not discarded (dsum._legacyFeedStress), for transparency.
            if (pk === 'energy' && est.grounded) {
              dsum._legacyFeedStress = dsum.stress;
              dsum.stress = outcomeLedger.distressMass(est.belief);
              dsum.stressSource = 'node-market-feed-grounded';
              for (var sri2 = 0; sri2 < stressRanked.length; sri2++) {
                if (stressRanked[sri2].domain === pk) { stressRanked[sri2].stress = dsum.stress; break; }
              }
            }

            // LIVE OUTCOME TRACKER (2026-07-20, ENERGY ONLY): records today's forecast + resolves any
            // that have aged past the horizon, against the REAL forward WTI price. Pure core (lib/
            // energy-outcome-tracker.js) reusing the exact functions validated on 40y of history; this
            // worker only persists its state. DATA-STARVED BY CONSTRUCTION: the first live forecast
            // cannot resolve for ~3 weeks. This starts the clock; it is not a result to present as
            // "validated" until resolvedCount is large and a held-out set has been checked.
            if (pk === 'energy' && est.grounded) {
              try {
                var priceReading = (typeof liveMkt !== 'undefined' && liveMkt) ? { v: liveMkt.latestPrice } : null;
                var ot = energyOutcomeTracker.tick(gsSlot.outcomeTrack, gsNow, priceReading, est, bundle.readings, {});
                gsSlot.outcomeTrack = ot.state;
                gsMemDirty = true;
                dsum.outcomeTrack = {
                  recorded: ot.recorded, trackedForecasts: ot.result.trackedForecasts,
                  resolvedCount: ot.result.resolvedCount, pendingCount: ot.result.pendingCount,
                  estimatorHitRate: ot.result.estimatorHitRate, skill: ot.result.skill
                };
              } catch (ote) { dsum.outcomeTrack = { reason: 'outcome tracker error: ' + ote.message }; }
            }
          } catch (pe) { dsum.phaseBelief = { grounded: false, reason: 'estimate error: ' + pe.message }; }
        }
        // Keep the payload light: corrState is memory, not a console field.
        if (dsum.groundedStress) delete dsum.groundedStress.corrState;
      } catch (ge) { dsum.groundedStress = { grounded: false, stress: null, reason: 'compute error: ' + ge.message }; }
    }
    consoleSnapshot.phaseGroundingStats = { grounded: groundedCount, divergent: divergentCount, total: Object.keys(domainSummary).length };
    if (gsMemDirty) {
      gsMem.updatedAt = gsNow;
      try { await db.set('grounded_stress_memory', gsMem, 2592000); } catch (se) { /* memory is an optimisation, never fatal */ }
    }
    var gsBaseline = 0, phaseBeliefCount = 0;
    for (var gk in gsMem.domains) {
      var gh = gsMem.domains[gk] && gsMem.domains[gk].history && gsMem.domains[gk].history.distress;
      if (gh && gh.length > gsBaseline) gsBaseline = gh.length;
    }
    for (var dk2 in domainSummary) {
      if (domainSummary.hasOwnProperty(dk2) && domainSummary[dk2].phaseBelief && domainSummary[dk2].phaseBelief.grounded) phaseBeliefCount++;
    }
    consoleSnapshot.stressGroundingStats = {
      grounded: gsGroundedCount, divergent: gsDivergentCount, total: Object.keys(domainSummary).length,
      baselineDepth: gsBaseline, baselineNeeded: 8, phaseBelief: phaseBeliefCount,
      note: 'SHADOW: CISS-style grounded stress on dsum.groundedStress + P0-P10 phase belief on dsum.phaseBelief (Adapter B -> shared estimator core); feed-derived dsum.stress unchanged. Channels rank against a rolling hourly baseline (baselineDepth); below baselineNeeded they pass through untransformed and the reading is flagged degraded.'
    };
  } catch (e) {
    consoleSnapshot.convergenceSignals = {};
  }

  await db.set('console_snapshot', consoleSnapshot, 1200); // 20m > 15m cron, so it never expires between runs

  // ── Server-side change log: detect and record domain changes ──
  try {
    var prevSnap = await db.get('prev_console_snapshot');
    if (prevSnap && prevSnap.domains) {
      for (var clk in domainSummary) {
        var cur = domainSummary[clk];
        var prev = prevSnap.domains[clk];
        if (!prev) continue;
        var clKey = 'changelog_' + clk;
        var clLog = await db.get(clKey);
        var clEntries = (clLog && clLog.entries) ? clLog.entries : [];
        var clNow = Date.now();

        // Stress shift > 3%
        if (Math.abs((cur.stress||0) - (prev.stress||0)) > 0.03) {
          var dir = cur.stress > prev.stress ? 'rose' : 'fell';
          clEntries.push({ timestamp:clNow, domain:clk, type:'HEALTH_CHANGE', severity: Math.abs(cur.stress-prev.stress)>0.10?'HIGH':'MEDIUM', title:'Stress '+dir+' to '+Math.round(cur.stress*100)+'%', description:Math.round(prev.stress*100)+'% → '+Math.round(cur.stress*100)+'%', metadata:{} });
        }
        // Maturity change
        if (prev.maturity && prev.maturity !== cur.maturity) {
          clEntries.push({ timestamp:clNow, domain:clk, type:'HEALTH_CHANGE', severity:'HIGH', title:'Maturity: '+prev.maturity+' → '+cur.maturity, description:'', metadata:{} });
        }
        // Phase change
        if (prev.phase && prev.phase !== cur.phase) {
          clEntries.push({ timestamp:clNow, domain:clk, type:'HEALTH_CHANGE', severity:'HIGH', title:'Phase: '+prev.phase+' → '+cur.phase, description:'', metadata:{} });
        }

        if (clEntries.length > 500) clEntries = clEntries.slice(-500);
        await db.set(clKey, { entries:clEntries, updatedAt:clNow }, 604800);
      }
    }
    await db.set('prev_console_snapshot', consoleSnapshot, 1800);
  } catch (e) { /* change log non-critical */ }

  // ── Phase 23D-E: Activity-aware opportunity ranking ──
  // rank = stress * confidence * maturityWeight * propagationFactor
  // high stress + high activity → immediate opportunity
  // high stress + low activity → early signal
  // low stress + high activity → crowded / watch
  var MATURITY_WEIGHT = { STRUCTURAL: 1.3, CONFIRMED: 1.0, FORMING: 0.7, EARLY: 0.4 };

  var opportunities = [];
  // Capital-light, own-nothing opportunity TYPES per domain (curate/broker a real distress
  // feed; sell the curation — the telescope/middleman model), NOT "build a platform/SaaS"
  // (capital-heavy). Keyed by runtimeKey. All 20 covered so no domain falls to a generic
  // 'domain-specific solution'. These are opportunity CATEGORIES, not claimed live deals.
  var FAMILIES = {
    governance: ['regulatory-change alert digest', 'public-comment deadline feed', 'compliance-risk watchlist'],
    economy: ['macro-shock early-warning brief', 'sector-slowdown watchlist', 'WARN/layoff signal feed'],
    infrastructure: ['infrastructure-failure incident feed', 'utility outage lead feed', 'permit/inspection distress watchlist'],
    energy: ['utility shutoff-notice lead feed', 'grid-strain alert digest', 'fuel-price volatility brief'],
    agriculture: ['crop-input cost alert feed', 'ag-distress (drought/recall) digest', 'commodity supply-shock brief'],
    industry: ['WARN layoff lead feed', 'plant-closure distress watchlist', 'supplier-failure early warning'],
    research: ['grant-deadline research digest', 'retraction/integrity watch feed', 'emerging-whitespace brief'],
    health: ['adverse-event (openFDA) alert feed', 'drug-recall digest', 'clinical-trial signal brief'],
    education: ['enrollment-decline watchlist', 'district-budget distress feed', 'closure/consolidation alert'],
    technology: ['cyber-incident (CISA KEV) feed', 'outage/breach alert digest', 'tech-layoff signal watchlist'],
    communication: ['newsroom cut/closure feed', 'platform-policy change alert', 'information-integrity brief'],
    culture: ['venue/label distress feed', 'trend-shift early signal brief', 'audience-migration watchlist'],
    defense: ['procurement-notice feed', 'escalation/threat alert digest', 'supplier-risk watchlist'],
    environment: ['hazard/disaster alert feed', 'climate-risk exposure brief', 'compliance-deadline watchlist'],
    religion: ['congregation-decline brief', 'community-need signal feed', 'institutional-distress watchlist'],
    population: ['demographic-shift brief', 'migration/vacancy signal feed', 'service-demand watchlist'],
    supplyChain: ['port/customs disruption feed', 'sanctions/tariff alert digest', 'shipping-route risk brief'],
    law: ['regulatory-enforcement feed', 'litigation-signal watchlist', 'filing-deadline digest'],
    finance: ['distressed-issuer credit watch feed', 'bankruptcy early-warning digest', 'covenant-breach signal brief'],
    intelligence: ['data-breach/leak feed', 'OSINT signal digest', 'anomaly-detection watchlist']
  };

  for (var sdk in domains) {
    var sd = domains[sdk];
    var sdStress = sd.stress || 0;
    var sdConf = sd.confidence || 0;
    var sdActivity = sd.activity || 0;
    var sdMaturity = sd.maturity || 'EARLY';
    var mw = MATURITY_WEIGHT[sdMaturity] || 0.4;

    // Only generate opportunities for domains with meaningful stress or high-confidence signals
    if (sdStress < 0.25 && sdMaturity === 'EARLY') continue;
    if (sdStress < 0.15) continue;

    // Propagation factor: high activity amplifies urgency of stress
    var propagation = 1.0;
    if (sdStress > 0.4 && sdActivity > 0.5) propagation = 1.2; // immediate
    else if (sdStress > 0.4 && sdActivity < 0.2) propagation = 0.8; // early signal, not urgent
    else if (sdStress < 0.25 && sdActivity > 0.5) propagation = 0.5; // crowded/noisy

    var rank = sdStress * sdConf * mw * propagation;

    // Classify opportunity urgency
    var urgency = 'WATCH';
    if (sdStress > 0.5 && sdActivity > 0.3 && sdMaturity !== 'EARLY') urgency = 'IMMEDIATE';
    else if (sdStress > 0.3 && sdConf > 0.5) urgency = 'ACTIVE';
    else if (sdStress > 0.2) urgency = 'EMERGING';

    var families = FAMILIES[sdk] || ['domain-specific solution'];
    for (var fi = 0; fi < families.length; fi++) {
      opportunities.push({
        domain: sdk,
        title: families[fi],
        stress: sdStress,
        confidence: sdConf,
        activity: sdActivity,
        maturity: sdMaturity,
        urgency: urgency,
        rank: Math.round(rank * 1000) / 1000,
        source: 'domain_stress',
        path: fi === 0 ? 'PATENTABLE' : (fi === 1 ? 'INVESTABLE' : 'GRANT-ELIGIBLE')
      });
    }
  }

  // Add macro shock opportunities (these are always high urgency)
  if (defenseResp.signals) {
    for (var msi = 0; msi < defenseResp.signals.length; msi++) {
      var msig = defenseResp.signals[msi];
      if (msig.confidence === 'LOW') continue;
      for (var mdi = 0; mdi < msig.affectedDomains.length; mdi++) {
        var shockDom = msig.affectedDomains[mdi];
        var domConf = (domains[shockDom] && domains[shockDom].confidence) || 0.5;
        opportunities.push({
          domain: shockDom,
          title: msig.eventType.replace(/_/g, ' ').toLowerCase() + ' response',
          stress: msig.magnitude,
          confidence: domConf,
          activity: 0,
          maturity: 'FORMING',
          urgency: msig.magnitude > 0.8 ? 'IMMEDIATE' : 'ACTIVE',
          rank: Math.round(msig.magnitude * msig.confidenceValue * 1000) / 1000,
          source: 'macro_shock',
          path: msig.magnitude > 0.8 ? 'GRANT-ELIGIBLE' : 'INVESTABLE'
        });
      }
    }
  }

  // ── Phase 25: Convergence-driven opportunities (Section 7 output contract) ──
  // Capital-light framing: curate/broker the distress signal (feed/watchlist), not build a platform.
  var CONVERGENCE_OPP_TITLES = {
    CONVERGENCE_TERMINAL: 'terminal-distress deal/lead feed',
    CONVERGENCE_INSTABILITY: 'instability early-warning watchlist',
    DOMAIN_STRUCTURAL: 'structural-regime distress watchlist',
    COMPANY_FAILURE_CLUSTER: 'failure-cluster credit watch feed'
  };
  for (var csk in convergenceSignals) {
    var cs = convergenceSignals[csk];
    opportunities.push({
      domain: cs.domain_id,
      title: CONVERGENCE_OPP_TITLES[cs.primary_signal] || cs.primary_signal,
      stress: cs.domain_stress,
      confidence: cs.provenance.financial_kernel ? 0.95 : 0.7,
      activity: 0,
      maturity: 'CONFIRMED',
      urgency: cs.primary_signal === 'CONVERGENCE_TERMINAL' ? 'IMMEDIATE' : 'ACTIVE',
      rank: cs.primary_signal === 'CONVERGENCE_TERMINAL' ? 0.98 : 0.90,
      source: 'convergence',
      primary_signal: cs.primary_signal,
      secondary_signals: cs.secondary_signals,
      p7a_count: cs.p7a_count,
      p3_count: cs.p3_count,
      mapped_company_count: cs.mapped_company_count,
      p7a_ratio: cs.p7a_ratio,
      p3_ratio: cs.p3_ratio,
      provenance: cs.provenance,
      path: cs.primary_signal === 'CONVERGENCE_TERMINAL' ? 'INVESTABLE' : 'GRANT-ELIGIBLE'
    });
  }

  // Sort by rank (stress * confidence * maturity * propagation)
  opportunities.sort(function(a, b) { return (b.rank || 0) - (a.rank || 0); });

  var oppSnapshot = {
    generatedAt: Date.now(),
    version: 3,
    count: opportunities.length,
    opportunities: opportunities.slice(0, 100)
  };

  await db.set('opportunities_snapshot', oppSnapshot, 1200); // 20m > 15m cron, never expires between runs

  res.status(200).json({
    ok: true,
    backend: db.getBackend(),
    consoleSnapshot: { domains: consoleSnapshot.domainCount, live: consoleSnapshot.liveCount },
    opportunitiesSnapshot: { count: oppSnapshot.count },
    convergenceSignals: Object.keys(convergenceSignals).length,
    companyScored: companyResult,
    macroShock: consoleSnapshot.macroShock.detected,
    processedIn: Date.now() - start + 'ms'
  });
};
