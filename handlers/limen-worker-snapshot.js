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
var domainMarketFeed = require('../lib/domain-market-feed');   // LIVE market channel for the other 19, off each domain's curated basket
var domainBaskets = require('../lib/domain-baskets');          // the baskets themselves, shared with handlers/<domain>-markets.js
var feedFractal = require('../lib/feed-fractal');   // typed content channels (content, not article count) + geopolitical extension for real available energy text
var energyOutcomeTracker = require('../lib/energy-outcome-tracker');   // LIVE outcome loop, ENERGY ONLY: records today's forecast, resolves matured ones vs real forward price
var outcomeLedger = require('../lib/outcome-ledger');   // for distressMass() — promotes the fused belief into the LIVE dsum.stress for energy (see inline comment at the call site)

// STRESS-SOURCE PROMOTION allowlist (2026-07-20 port, task: energy-parity rollout). Which domains
// get dsum.stress promoted to the fused precision-weighted belief instead of the feed-volume
// legacy value. Starts as energy-only — IDENTICAL behavior to before this change. Two candidate
// auto-gates (require agreement with the legacy value; require phaseBelief.confidence above a
// threshold) were checked against real live data before writing this and both were WRONG:
// energy's own verified promotion is 0.21 vs a legacy of 1.0 (a 0.79 disagreement — the point of
// promoting), and energy's confidence (0.482) is the LOWEST of all 20 domains while the flagged
// anomaly domain (population) has one of the HIGHEST (0.9), because this confidence formula
// inversely tracks channel count, not trustworthiness. No numeric gate here is validated, so the
// gate is procedural: widen this allowlist only after adding a domain and checking 2 consecutive
// live ticks (the same check that caught the post-deploy false alarm in ENERGY_REFERENCE.md
// §N.10), not by a formula. Settable without a redeploy via env var.
//
// 2026-07-22 — ENERGY-PARITY ROLLOUT (operator-directed): widened the default from energy-only
// to ALL 20 domains. This is SAFE because promotion is double-gated: a domain only promotes when
// `isStressPromotionEligible(pk) && est.grounded` — a data-thin domain whose estimator can't
// ground simply ABSTAINS (keeps the legacy feed reading) rather than publish an ungrounded number.
// It replaces the KNOWN-BAD feed-volume stress with grounded company/phase distress wherever the
// data supports it. CAVEAT (honest): this skips the per-domain 2-tick verification the note above
// recommends. Mitigation: env-reversible (set STRESS_PROMOTION_DOMAINS=energy to revert instantly,
// no redeploy) and organ-stress-promotion.mjs auto-discovers + probes every promoted domain, so a
// bad promotion surfaces as an operator-attention item next tick.
var STRESS_PROMOTION_DOMAINS = (process.env.STRESS_PROMOTION_DOMAINS
  ? process.env.STRESS_PROMOTION_DOMAINS.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
  : ['agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy',
     'environment', 'finance', 'governance', 'health', 'industry', 'infrastructure', 'intelligence',
     'law', 'population', 'religion', 'research', 'supplyChain', 'technology']);
function isStressPromotionEligible(pk) { return STRESS_PROMOTION_DOMAINS.indexOf(pk) !== -1; }

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
      // Carry the top signal's real article link + originating feed through to the cached
      // snapshot the public fronts read. Null when the feed gave no link (most non-RSS
      // sources) — the front then falls back to linking the source itself, never invents one.
      topSignalUrl: (d.signalLinks && d.signalLinks[0]) || null,
      topSignalSource: (d.signalSources && d.signalSources[0]) || null,
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
    // CADENCE IS NOT HOURLY (corrected 2026-07-25 from measurement, not from the code's intent).
    // GS_APPEND_MS gates on `>= 1h elapsed` but is only EVALUATED when the 15-min worker cron
    // fires, so an append lands on the first tick at or past 60 min. That adds up to one full tick
    // of drift per cycle: measured gaps 74.98 min (14:36 -> 15:51) and 74.4 min (15:51 -> 17:05).
    // Real cadence is 60-75 min, so 300 samples is 12.5 to 15.6 DAYS depending on cron jitter, not
    // the flat 12.5 the old comment claimed. Do not treat sample count as a stand-in for a time
    // horizon here; it is only a faithful proxy while sampling is uniform, and it already isn't.
    var GS_HISTORY_CAP = 300;            // 12.5-15.6 days at the measured 60-75 min cadence
    var GS_APPEND_MS = 60 * 60 * 1000;   // FLOOR on the gap, not the period (cron quantises it up)
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
          // APPEND-ORDERING FIX (2026-07-25). The loop below advances gsSlot.lastAppendTs to gsNow.
          // The marketScore block and the feed block further down then re-tested that SAME field, so
          // by the time they ran their gate read `0 >= GS_APPEND_MS` — always false. Their only other
          // escape (`!gsSlot.history[key]`) is true exactly once, at array creation. So after their
          // first ever sample those channels could NEVER append again, and at length 1 they also sit
          // below CDF_MIN_SAMPLE (8), meaning they could never be rank-transformed either: frozen
          // AND permanently untransformable. Confirmed live before the fix — energy carried
          // distress=118 against marketScore=1 and feed_supply=1, i.e. the channels specifically
          // added to carry live external signal (a war this week cannot show up in a 10-Q) were the
          // only ones not accumulating. Decide ONCE, before any mutation, and reuse that decision.
          var gsShouldAppend = (gsNow - (gsSlot.lastAppendTs || 0)) >= GS_APPEND_MS;
          if (gsShouldAppend) {
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
          //
          // GENERALIZED 2026-07-28 FROM ENERGY-ONLY TO ALL 20. The reason is measured, not
          // aspirational: in the live channel store `distress` carries ONE distinct value across
          // 182 samples in every domain and `granularity` likewise, so 70% of composite weight is
          // a constant, while `marketScore` was the one channel demonstrated to carry information
          // and it existed for a single domain. Energy was not better designed, it was better
          // INSTRUMENTED. Every domain already had a curated ticker basket in
          // handlers/<domain>-markets.js driving display quotes off a public keyless feed; this
          // routes that same data into the estimator as an equal-weight index scored by the SAME
          // validated marketStress(). Measured across all 20 baskets before wiring: 20 distinct
          // scores, range 0.041-0.371, with technology and infrastructure high on real drawdowns
          // of 19.2% and 10.1%. Energy keeps its FRED WTI spot series, which is a truer instrument
          // for it than an equity basket.
          if (pk === 'energy') {
            try {
              var liveMkt = await energyMarketFeed.getLiveMarketChannel();
              if (liveMkt && liveMkt.reading) {
                bundle.readings.push(liveMkt.reading);
                dsum.marketChannel = { score: liveMkt.score, price: liveMkt.latestPrice, asOf: liveMkt.latestDate, source: liveMkt.source };
                if (gsShouldAppend || !gsSlot.history.marketScore) {
                  var mArr = gsSlot.history.marketScore || (gsSlot.history.marketScore = []);
                  mArr.push(liveMkt.score);
                  if (mArr.length > GS_HISTORY_CAP) mArr.splice(0, mArr.length - GS_HISTORY_CAP);
                }
              } else {
                dsum.marketChannel = { score: null, reason: 'live fetch unavailable this run — estimator falls back to company channels alone' };
              }
            } catch (mfe) { dsum.marketChannel = { score: null, reason: 'market feed error: ' + mfe.message }; }
          } else {
            // Every non-energy domain: equal-weight index of its own basket, same scorer, same
            // append discipline, same abstain discipline. Returns null (no channel, no history
            // append, estimator unchanged) on a thin basket or any fetch failure — a missing
            // channel is a lower-precision estimate, never a fabricated one.
            try {
              var domMkt = await domainMarketFeed.getLiveMarketChannel(pk, domainBaskets.get(pk));
              if (domMkt && domMkt.reading) {
                bundle.readings.push(domMkt.reading);
                dsum.marketChannel = { score: domMkt.score, index: domMkt.latestPrice, asOf: domMkt.latestDate,
                  source: domMkt.source, tickersLive: domMkt.tickersLive, tickersRequested: domMkt.tickersRequested };
                if (gsShouldAppend || !gsSlot.history.marketScore) {
                  var dArr = gsSlot.history.marketScore || (gsSlot.history.marketScore = []);
                  dArr.push(domMkt.score);
                  if (dArr.length > GS_HISTORY_CAP) dArr.splice(0, dArr.length - GS_HISTORY_CAP);
                }
              } else {
                dsum.marketChannel = { score: null, reason: 'basket index unavailable this run (thin basket or fetch failure) — estimator falls back to company channels alone' };
              }
            } catch (dmfe) { dsum.marketChannel = { score: null, reason: 'domain market feed error: ' + dmfe.message }; }
          }

          // LIVE FEED FRACTAL (2026-07-20, ENERGY ONLY originally; PORTED 2026-07-20 to run for every
          // domain): real per-article headlines from the already-running RSS ingest
          // (limen-worker-ingest.js -> latest_ingest; TTL bumped 300s->1200s in this same change so it
          // reliably survives to this read, was racing its own 15m cron). Filtered to signals whose
          // affectedDomains includes THIS domain (was hardcoded to 'energy' — the mechanism itself
          // (feed-fractal.js) is domain-agnostic, only this filter was hardcoded), classified by
          // CONTENT, not counted. HONEST SCOPE: the real available text right now is mostly
          // geopolitical (Hormuz/Iran/military) and mostly tagged as affecting energy — other domains
          // will correctly get itemCount:0 (abstain) until latest_ingest actually carries their text;
          // that is correct behavior, not a bug to force. The ORIGINAL corporate categories
          // (workforce/leadership/pricing/demand/competition/litigation/recall/capital) remain
          // UNCONNECTED to any live per-company feed for every domain, because none exists yet
          // (company newsFeed[] is empty) — this change does not close that gap, only the
          // per-domain filtering literal.
          {
            try {
              var ingest = await db.get('latest_ingest');
              var ingestItems = [];
              if (ingest && Array.isArray(ingest.signals)) {
                ingest.signals.forEach(function (sig) {
                  if (!sig || !Array.isArray(sig.affectedDomains) || sig.affectedDomains.indexOf(pk) === -1) return;
                  var quality = sig.confidence === 'HIGH' ? 'real' : (sig.confidence === 'MEDIUM' ? 'event' : 'degraded');
                  (sig.titles || []).forEach(function (title) { ingestItems.push({ text: title, quality: quality }); });
                });
              }
              var feedChannels = feedFractal.toChannels(ingestItems);
              feedChannels.forEach(function (fc) {
                bundle.readings.push(fc);
                if (gsShouldAppend || !gsSlot.history[fc.key]) {
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
            // Promote to a CONFIDENCE-WEIGHTED blend of the fused belief's distress mass and the CISS
            // floor (outcomeLedger.promotedStress). Rationale: distressMass(belief) incorporates
            // company+market+feed via the full precision-weighted estimate, so it CAN see a live crisis
            // the company-only CISS misses — BUT it sums 5 of the 11 arc phases, so a DIFFUSE (low-
            // confidence) belief smears across them and saturates near 1.0. Live 2026-07-24 that put
            // agriculture/finance (confidence ~0.13, CISS ~0.25) at 0.98, above energy (0.80) — the
            // system displaying uncertainty as maximum distress. promotedStress trusts the belief's
            // mass to the extent the belief is concentrated (confidence) and blends the rest toward the
            // grounded CISS; a genuine concentrated signal still climbs with no ceiling. The number
            // displayed and the number the outcome loop scores (beliefDistress) share the same belief,
            // so they track the same crisis; the display is just no longer allowed to saturate on doubt.
            //
            // The old value is preserved, not discarded (dsum._legacyFeedStress), for transparency.
            //
            // PORT (2026-07-20): eligibility now reads the STRESS_PROMOTION_DOMAINS allowlist above
            // instead of a hardcoded 'energy' literal, so this can widen to other domains without a
            // redeploy. Default allowlist is energy-only — no behavior change until the operator
            // explicitly widens it.
            if (isStressPromotionEligible(pk) && est.grounded) {
              dsum._legacyFeedStress = dsum.stress;
              dsum._beliefDistressRaw = outcomeLedger.distressMass(est.belief);   // pre-blend mass, kept for transparency
              dsum.stress = outcomeLedger.promotedStress(
                est.belief, est.confidence,
                (gs && typeof gs.stress === 'number') ? gs.stress : null);
              dsum.stressSource = 'node-market-feed-grounded';
              for (var sri2 = 0; sri2 < stressRanked.length; sri2++) {
                if (stressRanked[sri2].domain === pk) { stressRanked[sri2].stress = dsum.stress; break; }
              }
            }

            // LIVE OUTCOME TRACKER (2026-07-20, ENERGY ONLY originally; PORTED 2026-07-20 to run for
            // every domain): records today's forecast + resolves any that have aged past the horizon,
            // against a REAL forward price reading. Pure core (lib/energy-outcome-tracker.js — the
            // module is domain-agnostic despite its name: it takes no domain argument, all state is
            // per-domain already via gsSlot which is keyed by pk) reusing the exact functions
            // validated on 40y of WTI history. DATA-STARVED BY CONSTRUCTION: the first live forecast
            // cannot resolve for ~3 weeks. This starts the clock; it is not a result to present as
            // "validated" until resolvedCount is large and a held-out set has been checked.
            //
            // priceReading is DORMANT-BY-DESIGN for every domain except energy: it is only ever
            // sourced from `liveMkt` (the energy-only live market channel above), and `pk === 'energy'`
            // is checked explicitly here — NOT just `typeof liveMkt !== 'undefined'` — because `liveMkt`
            // is declared with `var` inside an energy-only block and would otherwise still hold
            // energy's stale value on every subsequent domain in this same loop (var hoisting, not
            // block-scoped). Until a domain gets its own live market/index series (Phase B, not
            // fabricated here), its tracker runs with priceReading=null: the mechanism executes and
            // reports trackedForecasts:0, nothing is silently skipped, nothing is invented.
            if (est.grounded) {
              try {
                var priceReading = (pk === 'energy' && typeof liveMkt !== 'undefined' && liveMkt) ? { v: liveMkt.latestPrice } : null;
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

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('limen-worker-snapshot', module.exports);
