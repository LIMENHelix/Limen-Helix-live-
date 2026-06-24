/**
 * civilization/domain-packet-adapter.js
 * LIMEN HELIX — Domain → Civilization packet bridge
 *
 * Civilization is an OBSERVER. Domain brains are the source of truth.
 *
 * For each of the 20 canonical domains this adapter produces ONE normalized
 * packet that Civilization's UI consumes. Brain truth wins; signal-engine
 * data is used only when no brain payload is present, and is clearly marked.
 *
 * READ-ONLY. Does not modify domain state, does not change brain logic,
 * does not rewrite window.LIMENDomains. Audit fields are additive and live
 * on the packet only — never on the domain slot.
 *
 * Reads:
 *   - window.LIMENDomains[id]     (signal-engine + brain-adapter merged slot)
 *   - window.LIMENBalance[id]     (optional)
 *   - window.LIMENPolarity[id]    (optional)
 *
 * Listens:
 *   - limen:domain-update         (signal-engine wrote a snapshot)
 *   - limen:domain-brain-update   (a brain finished a cycle)
 *
 * Provides:
 *   - window.LIMENCivilizationPackets   { [domainId]: Packet }
 *   - window.LIMENCivilizationAdapter   { getAll(), get(id), getOrder() }
 *   - event: limen:civilization-packets-update
 *
 * Packet shape — see PACKET_FIELDS comment below.
 */
(function () {
  'use strict';

  // Canonical 20 domains (mirrors console-clarity DOMAIN_ORDER).
  var DOMAIN_ORDER = [
    'economy', 'energy', 'environment', 'health', 'technology', 'research',
    'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry',
    'education', 'communication', 'culture', 'defense', 'religion',
    'population', 'law', 'finance', 'intelligence'
  ];

  var DOMAIN_LABELS = {
    economy: 'Economy', energy: 'Energy', environment: 'Environment',
    health: 'Health', technology: 'Technology', research: 'Research',
    supplyChain: 'Supply Chain', governance: 'Governance',
    infrastructure: 'Infrastructure', agriculture: 'Agriculture',
    industry: 'Industry', education: 'Education',
    communication: 'Communication', culture: 'Culture',
    defense: 'Defense', religion: 'Religion',
    population: 'Population', law: 'Law',
    finance: 'Finance', intelligence: 'Intelligence'
  };

  // Stale = brain payload older than 6 minutes (TTL on adapter is 5min,
  // but signal-engine snapshot writes every 30s, so a brain that hasn't
  // refreshed within ~6min is treated as stale at the packet layer).
  var BRAIN_STALE_MS = 6 * 60 * 1000;
  var SNAPSHOT_STALE_MS = 5 * 60 * 1000;

  // Throttle rebuilds — bursty event sources should not thrash the UI.
  var REBUILD_THROTTLE_MS = 400;

  var _packets = {};
  var _rebuildTimer = null;
  var _lastRebuildAt = 0;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function _num(v) { return typeof v === 'number' && !isNaN(v) ? v : null; }
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _str(v) { return typeof v === 'string' ? v : null; }
  function _clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function _stressBand(stress) {
    if (stress == null) return 'unknown';
    if (stress >= 0.85) return 'critical';
    if (stress >= 0.65) return 'high';
    if (stress >= 0.40) return 'elevated';
    if (stress >= 0.20) return 'moderate';
    return 'baseline';
  }

  function _activityLevel(slot) {
    var a = _num(slot && slot.activity);
    if (a == null) return null;
    if (a >= 0.7) return 'high';
    if (a >= 0.3) return 'medium';
    if (a > 0)   return 'low';
    return 'idle';
  }

  function _brainAgeMs(slot) {
    var ts = _num(slot && slot.brainUpdatedAt) || _num(slot && slot.brainUpdated);
    if (!ts) return null;
    return Math.max(0, Date.now() - ts);
  }

  function _snapshotAgeMs(slot) {
    var ts = _num(slot && slot.updated);
    if (!ts) return null;
    return Math.max(0, Date.now() - ts);
  }

  // Best-effort registry lookup. Returns the declared-feed count for a
  // domain or null when no registry is loaded. Read-only.
  function _declaredFeedCount(domainId) {
    var reg = (typeof window !== 'undefined') ? window.LIMENDomainRegistry : null;
    if (!reg) return null;
    var entry = null;
    try { entry = reg.getById ? reg.getById(domainId) : null; } catch (e) { entry = null; }
    if (!entry && reg.DOMAINS) {
      for (var i = 0; i < reg.DOMAINS.length; i++) {
        var d = reg.DOMAINS[i];
        if (d && (d.id === domainId || d.civId === domainId || d.runtimeKey === domainId)) {
          entry = d; break;
        }
      }
    }
    if (entry && Array.isArray(entry.feeds)) return entry.feeds.length;
    return null;
  }

  function _hasBrainPayload(slot) {
    if (!slot) return false;
    if (Array.isArray(slot.brainDiagnoses) && slot.brainDiagnoses.length > 0) return true;
    if (Array.isArray(slot.brainTreatments) && slot.brainTreatments.length > 0) return true;
    if (typeof slot.brainStress === 'number') return true;
    if (typeof slot.brainConfidence === 'number') return true;
    if (slot.brainPhase || slot.brainPhaseLabel) return true;
    if (slot.brainStatus || slot.brainUpdated || slot.brainUpdatedAt) return true;
    return false;
  }

  // -----------------------------------------------------------------------
  // Pick top diagnoses (active, weighted) — never invent.
  // -----------------------------------------------------------------------
  function _topDiagnoses(slot, max) {
    var dx = _arr(slot && slot.brainDiagnoses);
    if (dx.length === 0) return [];
    var scored = dx.map(function (d) {
      var rel = _num(d && d.relevance);
      var act = !!(d && d.active);
      // Active dx with relevance dominate; inactive sorted by relevance only.
      var score = (act ? 100 : 0) + (rel == null ? 0 : rel);
      return {
        id: _str(d && d.id) || '',
        label: _str(d && d.label) || _str(d && d.id) || '',
        summary: _str(d && d.summary) || '',
        active: act,
        relevance: rel,
        score: score
      };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, max || 3);
  }

  function _topEvidence(slot, max) {
    var out = [];
    var sources = _arr(slot && slot.sources);
    for (var i = 0; i < sources.length && out.length < (max || 3); i++) {
      var s = sources[i] || {};
      if (!s.label && !s.name) continue;
      out.push({
        kind: 'source',
        label: _str(s.label) || _str(s.name) || '',
        live: !!s.live,
        updated: _num(s.updated)
      });
    }
    var sigs = _arr(slot && slot.signals);
    for (var j = 0; j < sigs.length && out.length < (max || 3); j++) {
      var sg = sigs[j];
      var t = typeof sg === 'string' ? sg : _str(sg && sg.label);
      if (!t) continue;
      out.push({ kind: 'signal', label: t });
    }
    return out;
  }

  // -----------------------------------------------------------------------
  // Audit-only fields (never overwrite domain truth — observer math only)
  // -----------------------------------------------------------------------
  function _computeAudit(slot, brainAge, snapshotAge, sourceType, domainId) {
    var warnings = [];

    // Feed integrity uses the SAME max-of-totals rule as feedHealth so audit
    // warnings (NO_LIVE_FEEDS, LOW_LIVE_FEED_COUNT) reflect the true denom.
    var liveBrain  = _num(slot && slot.brainSourcesLive);
    var totalBrain = _num(slot && slot.brainSourcesTotal);
    var liveSig    = _num(slot && slot.liveCount);
    var sigSources = _arr(slot && slot.sources);
    var sigLiveCnt = sigSources.filter(function (s) { return s && s.live; }).length;
    var declared  = _declaredFeedCount(domainId);
    var totalsArr = [];
    if (declared != null)        totalsArr.push(declared);
    if (sigSources.length > 0)   totalsArr.push(sigSources.length);
    if (totalBrain != null)      totalsArr.push(totalBrain);
    var totalCount = totalsArr.length > 0 ? Math.max.apply(null, totalsArr) : 0;
    var liveCount  = liveBrain != null ? liveBrain
                   : liveSig  != null ? liveSig
                   : sigLiveCnt;
    if (liveCount > totalCount) liveCount = totalCount;
    var feedIntegrity = totalCount > 0 ? _clamp01(liveCount / totalCount) : 0;

    // Coherence: do brain stress and signal-engine stress agree?
    var bs = _num(slot && slot.brainStress);
    var ss = _num(slot && slot.stress);
    var coherenceScore = null;
    if (bs != null && ss != null) {
      coherenceScore = _clamp01(1 - Math.abs(bs - ss));
      if (Math.abs(bs - ss) >= 0.25) warnings.push('BRAIN_DIVERGENT');
    }

    // Cross-domain support: emissions + ingestion volume (capped).
    var emissions = _arr(slot && slot.brainEmissions).length;
    var ingest    = _arr(slot && slot.brainIngest).length;
    var crossDomainSupport = _clamp01((emissions + ingest) / 6);

    // Evidence quality: brain confidence × dx-active fraction × phase confidence (when present).
    var confB = _num(slot && slot.brainConfidence);
    var phaseConf = _num(slot && slot.brainPhaseConfidence);
    var dx = _arr(slot && slot.brainDiagnoses);
    var dxActive = 0;
    for (var di = 0; di < dx.length; di++) if (dx[di] && dx[di].active) dxActive++;
    var dxRatio = dx.length > 0 ? dxActive / dx.length : 0;
    var evidenceQuality;
    if (confB != null) {
      evidenceQuality = confB;
      if (phaseConf != null) evidenceQuality = (evidenceQuality + phaseConf) / 2;
      // Slight uplift when there is at least one active brain diagnosis.
      if (dxRatio > 0) evidenceQuality = _clamp01(evidenceQuality + 0.1 * dxRatio);
    } else {
      var confS = _num(slot && slot.confidence);
      evidenceQuality = confS != null ? confS : 0;
    }

    // Audit confidence: weighted blend of evidence + integrity + coherence.
    var pieces = [];
    if (evidenceQuality != null) pieces.push({ w: 0.5, v: evidenceQuality });
    pieces.push({ w: 0.3, v: feedIntegrity });
    if (coherenceScore != null) pieces.push({ w: 0.2, v: coherenceScore });
    var wsum = 0, vsum = 0;
    for (var pi = 0; pi < pieces.length; pi++) { wsum += pieces[pi].w; vsum += pieces[pi].w * pieces[pi].v; }
    var auditConfidence = wsum > 0 ? _clamp01(vsum / wsum) : 0;

    // Warnings.
    if (sourceType === 'fallback') warnings.push('FALLBACK');
    if (sourceType === 'estimated') warnings.push('PROVISIONAL');
    if (totalCount > 0 && liveCount === 0) warnings.push('NO_LIVE_FEEDS');
    if (totalCount > 0 && liveCount > 0 && (liveCount / totalCount) < 0.34) warnings.push('LOW_LIVE_FEED_COUNT');
    if (slot && slot.status === 'STALE') warnings.push('STALE_SNAPSHOT');
    if (sourceType === 'domain-brain' && brainAge != null && brainAge > BRAIN_STALE_MS) warnings.push('STALE_BRAIN');
    if (sourceType === 'domain-snapshot' && snapshotAge != null && snapshotAge > SNAPSHOT_STALE_MS) warnings.push('STALE_SNAPSHOT');
    if (slot && slot.cadence === 'fallback') warnings.push('HEURISTIC');
    if (sourceType === 'domain-brain' && (!slot.brainFeeds || slot.brainFeeds.length === 0)) warnings.push('BRAIN_NO_FEED_LIST');
    if (evidenceQuality != null && bs != null && bs >= 0.65 && evidenceQuality < 0.4) warnings.push('HIGH_STRESS_LOW_EVIDENCE');

    // Diagnosis-provenance honesty (representation-only — no brain logic
    // changes). When the brain emits ALL diagnoses as active and feed
    // integrity is low, the displayed dx are likely baseline / always-on
    // pushes rather than fresh feed evidence. Flag so the UI can label.
    var dxAll = _arr(slot && slot.brainDiagnoses);
    var dxAllActive = dxAll.length > 0 && dxAll.every(function (d) { return d && d.active; });
    if (dxAllActive && dxAll.length >= 3 && feedIntegrity < 0.5) {
      warnings.push('BASELINE_HEAVY');
    }
    // Stress-derived dx: when brain stress is elevated and evidence quality
    // is mediocre, dx are likely stress-pushed (not feed-evidenced).
    if (bs != null && bs >= 0.5 && evidenceQuality != null && evidenceQuality < 0.5 && dxActive >= 1) {
      warnings.push('STRESS_DERIVED_DX');
    }
    // Low feed provenance — brain reports dx but feeds list is empty/sparse.
    var brainFeedCount = _arr(slot && slot.brainFeeds).length;
    if (dxActive >= 1 && brainFeedCount === 0 && totalCount > 0) {
      warnings.push('LOW_FEED_PROVENANCE');
    }

    return {
      auditConfidence:    auditConfidence,
      evidenceQuality:    evidenceQuality,
      feedIntegrity:      feedIntegrity,
      coherenceScore:     coherenceScore,
      crossDomainSupport: crossDomainSupport,
      auditWarnings:      warnings
    };
  }

  // -----------------------------------------------------------------------
  // Build a single packet for one domain
  // -----------------------------------------------------------------------
  function _buildPacket(domainId) {
    var domains = window.LIMENDomains || {};
    var slot = domains[domainId];

    var hasBrain = _hasBrainPayload(slot);
    var brainAge = _brainAgeMs(slot);
    var snapAge  = _snapshotAgeMs(slot);

    // Determine the source type — domain-brain (truth) preferred.
    var sourceType;
    if (hasBrain && (brainAge == null || brainAge <= BRAIN_STALE_MS)) {
      sourceType = 'domain-brain';
    } else if (hasBrain) {
      sourceType = 'domain-brain-stale';
    } else if (slot && slot.cadence === 'fallback') {
      sourceType = 'fallback';
    } else if (slot && typeof slot.stress === 'number') {
      sourceType = 'domain-snapshot';
    } else {
      sourceType = 'missing';
    }

    // ── DOMAIN TRUTH FIELDS (brain-preferred) ────────────────────────────
    // Each field records its origin so the renderer can tag chips with
    // [brain] / [snap] and the user never confuses domain truth with
    // Civilization-side audit. Brain wins when present.
    var stress = null, stressOrigin = 'unknown';
    if (sourceType.indexOf('domain-brain') === 0 && _num(slot.brainStress) != null) {
      stress = _num(slot.brainStress); stressOrigin = 'brain';
    } else if (slot && typeof slot.stress === 'number') {
      stress = _num(slot.stress); stressOrigin = (slot.cadence === 'fallback') ? 'fallback' : 'snapshot';
    }

    var confidence = null, confidenceOrigin = 'unknown';
    if (sourceType.indexOf('domain-brain') === 0 && _num(slot.brainConfidence) != null) {
      confidence = _num(slot.brainConfidence); confidenceOrigin = 'brain';
    } else if (slot && typeof slot.confidence === 'number') {
      confidence = _num(slot.confidence); confidenceOrigin = 'snapshot';
    }

    // Maturity: prefer brain emission when present, else snapshot.
    var maturity = null, maturityOrigin = 'unknown';
    if (slot && slot.brainMaturity) { maturity = slot.brainMaturity; maturityOrigin = 'brain'; }
    else if (slot && slot.maturity)  { maturity = slot.maturity;      maturityOrigin = 'snapshot'; }

    // Activity: brains do not currently emit a brainActivity field, so this
    // is snapshot/civ-derived. Marking the origin keeps it honest in the UI.
    var activity = null, activityOrigin = 'unknown';
    if (typeof (slot && slot.brainActivity) === 'number') {
      activity = slot.brainActivity; activityOrigin = 'brain';
    } else if (slot && typeof slot.activity === 'number') {
      activity = slot.activity; activityOrigin = 'snapshot';
    }

    // Phase — kernel-derived, brain-only.
    var phase      = slot ? slot.brainPhase : null;
    var phaseLabel = slot ? slot.brainPhaseLabel : null;

    // Active diagnoses + top evidence (always real, never invented)
    var activeDiagnoses = _topDiagnoses(slot, 3);
    var topEvidence     = _topEvidence(slot, 3);

    // Source-depth carry-through (2026-05-25 loop-tightening). The domain brain
    // ALREADY emits these onto the slot via the A–M payload (domain-brain-adapter:
    // brainTreatments / brainOpportunities / brainDirectives); they were dropped
    // here — the #1 open loop. Carry by reference so Civilization + the Main Brain
    // handoff receive treatment/opportunity/directive depth, not just diagnoses.
    var treatments    = _arr(slot && slot.brainTreatments);
    var opportunities = _arr(slot && slot.brainOpportunities);
    var directives    = _arr(slot && slot.brainDirectives);

    // F0 survival shim: carry the recurrent brain model (energy brings energyModel;
    // null for other domains — harmless additive field). Compact + prompt-safe.
    var _emO = function (v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; };
    var _bem = _emO(slot && slot.brainEnergyModel);
    // Infrastructure parity: infrastructure brains emit a recurrent CIVIL-asset
    // lifecycle model (brainInfrastructureModel) that follows the SAME envelope
    // signature as energy's energyModel, so Civilization + the Main Brain consume
    // it identically. The civil model tracks the asset lifecycle (condition
    // trajectory, deferred-maintenance accumulation, capital-funding regulation,
    // failure prediction) rather than neurological cycles. We map its civil field
    // names onto the shared deepBrain envelope. Energy wins when both are present
    // (a slot is single-domain, so they never collide in practice).
    var _bim = _emO(slot && slot.brainInfrastructureModel);
    // Culture parity: culture brains emit a recurrent CULTURAL-VITALITY model
    // (brainCultureModel) that follows the SAME envelope signature as energy's
    // energyModel and infrastructure's infrastructureModel, so Civilization +
    // the Main Brain consume it identically. The culture model tracks the
    // attention economy lifecycle (creative-work production cadence, narrative
    // freedom vs censorship pressure, artist-ecosystem health, cultural-collapse
    // risk — audience disengagement / heritage loss) rather than neurological
    // cycles or civil-asset lifecycles. We map its cultural field names onto the
    // shared deepBrain envelope. Energy/infrastructure win when both are present
    // (a slot is single-domain, so they never collide in practice).
    var _bcm = _emO(slot && slot.brainCultureModel);
    // Finance parity: finance brains emit a recurrent CAPITAL-LIFECYCLE model
    // (brainFinanceModel) that follows the SAME envelope signature as energy's
    // energyModel, infrastructure's infrastructureModel, and culture's
    // cultureModel, so Civilization + the Main Brain consume it identically.
    // The finance model tracks the capital-allocation lifecycle (credit-cycle
    // expansion/contraction cadence, solvency & liquidity stress, funding-source
    // health — wholesale/deposit/equity, and systemic liquidity-crisis risk —
    // funding runs / default cascades) rather than neurological cycles,
    // civil-asset lifecycles, or attention economies. Real signal validation
    // anchors on the large-cap financials JPM, BAC, GS, MS, BLK, V, MA, SCHW,
    // C, WFC. We map its financial field names onto the shared deepBrain
    // envelope. Energy/infrastructure/culture win when both are present
    // (a slot is single-domain, so they never collide in practice).
    //
    // GUARD: this branch is STRICTLY ADDITIVE and lives entirely at the
    // packet/observer layer. It reads only the recurrent capital-lifecycle
    // model the finance brain emits AFTER its validated P3 distress cycle has
    // run; it never touches, reorders, or re-derives the validated
    // scoreStress / deriveDiagnoses spine or any locked scoring path consumed
    // by /api/limen/score or /api/helix/helix-report/score.
    var _bfm = _emO(slot && slot.brainFinanceModel);
    // Economy parity: economy brains emit a recurrent MACROECONOMIC model
    // (brainEconomyModel) that follows the SAME envelope signature as energy's
    // energyModel, infrastructure's infrastructureModel, culture's cultureModel,
    // and finance's financeModel, so Civilization + the Main Brain consume it
    // identically. The economy model tracks the MACRO business cycle (the
    // expansion/recession growth cadence, fiscal & monetary policy regulation —
    // central-bank rate-setting / government spending, aggregate-demand health,
    // and recession risk — output gaps / employment shocks) rather than
    // neurological cycles, civil-asset lifecycles, attention economies, or
    // single-firm capital lifecycles. Economy is the MACRO AGGREGATE and stays
    // DISTINCT from finance (finance = credit, capital markets, banks, solvency
    // of individual institutions; economy = GDP, inflation, employment, money
    // supply, the whole-economy business cycle). Real signal validation anchors
    // on REAL FRED macro series — GDPC1 (Real GDP), CPIAUCSL / PCEPI (inflation),
    // UNRATE / PAYEMS (employment), M2 (money supply), FEDFUNDS (policy rate),
    // DGS10 (10y Treasury), UMCSENT (consumer sentiment), INDPRO (industrial
    // production) — and broad-market proxies SPY, DIA, TLT, GLD, never single
    // company tickers. We map its macroeconomic field names onto the shared
    // deepBrain envelope. Energy/infrastructure/culture/finance win when both
    // are present (a slot is single-domain, so they never collide in practice).
    var _bzm = _emO(slot && slot.brainEconomyModel);
    // Trade / supply-chain parity: trade brains (runtime key 'supplyChain')
    // emit a recurrent LOGISTICS-LIFECYCLE model (brainSupplyChainModel) that
    // follows the SAME envelope signature as energy's energyModel,
    // infrastructure's infrastructureModel, culture's cultureModel, finance's
    // financeModel, and economy's economyModel, so Civilization + the Main
    // Brain consume it identically. The supply-chain model tracks the GOODS-FLOW
    // lifecycle (shipment-throughput cadence across ocean/air/truck/rail —
    // shipmentCycle; shipping-cost / rate / carrier-capacity tightness as the
    // regulation signal — freightCostRegulation; route-constraint + customs-
    // clearance backlog stress and freight network failure risk — predictedStress
    // via routeDisruptionRisk; the prior on logistics throughput / service-level
    // health — priorThroughputHealth) rather than neurological cycles, civil-asset
    // lifecycles, attention economies, single-firm capital lifecycles, or
    // macroeconomic business cycles. Trade is the GOODS-IN-MOTION layer and stays
    // DISTINCT from economy (macro aggregate — GDP/inflation/employment) and from
    // industry (production / factory output). Trade's cross-domain couplings
    // (energy fuel logistics, defense munitions supply, finance working-capital,
    // agriculture food supply) all presume logistics-cost & throughput visibility
    // that only a recurrent model provides. Real signal validation anchors on
    // REAL freight & logistics tickers — FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO,
    // GXO, AMKBY (Maersk), DSDVY (DSV), ODFL — never energy oil/gas/grid tickers,
    // which are another domain's content. We map its logistics field names onto
    // the shared deepBrain envelope. Energy/infrastructure/culture/finance/economy
    // win when both are present (a slot is single-domain, so they never collide
    // in practice).
    var _bsm = _emO(slot && slot.brainSupplyChainModel);
    // Industry parity: industry brains emit a recurrent INDUSTRIAL-PRODUCTION
    // model (brainIndustryModel) that follows the SAME envelope signature as
    // energy's energyModel, infrastructure's infrastructureModel, culture's
    // cultureModel, finance's financeModel, economy's economyModel, and trade's
    // supplyChainModel, so Civilization + the Main Brain consume it identically.
    // The industry model tracks the FACTORY-OUTPUT lifecycle (capacity-utilization
    // trajectory and production-volume cadence — productionCycle; capacity-
    // expansion / investment-vs-depreciation tightness and automation-adoption
    // cadence as the regulation signal — capacityUtilizationRegulation; idle-
    // capacity + supply-chain-resilience shortfall stress and production-shutdown
    // / plant-failure risk — predictedStress via productionContractionRisk; the
    // prior on capacity-utilization / industrial-output health — priorCapacityHealth)
    // rather than neurological cycles, civil-asset lifecycles, attention economies,
    // single-firm capital lifecycles, macroeconomic business cycles, or goods-in-
    // motion logistics. Industry is the FACTORY-OUTPUT / capital-goods PRODUCTION
    // layer and stays DISTINCT from trade (logistics / goods-in-motion — shipment
    // throughput, freight cost), economy (macro aggregate — GDP / inflation /
    // employment), and technology (automation / robotics is a COUPLING into
    // industry, not industry's own substrate). Industry's cross-domain couplings
    // (energy powering plants, trade moving finished goods, technology supplying
    // automation, finance funding capex) all presume capacity & utilization
    // visibility that only a recurrent model provides. Real signal validation
    // anchors on REAL heavy-industry / capital-goods / machinery tickers — CAT,
    // DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV — never energy oil/gas/
    // grid tickers, which are another domain's content. We map its production
    // field names onto the shared deepBrain envelope. Energy/infrastructure/
    // culture/finance/economy/supplyChain win when both are present (a slot is
    // single-domain, so they never collide in practice).
    var _bum = _emO(slot && slot.brainIndustryModel);
    // Environment parity: environment brains emit a recurrent ENVIRONMENTAL-HEALTH
    // model (brainEnvironmentModel) that follows the SAME envelope signature as
    // energy's energyModel, infrastructure's infrastructureModel, culture's
    // cultureModel, finance's financeModel, economy's economyModel, trade's
    // supplyChainModel, and industry's industryModel, so Civilization + the Main
    // Brain consume it identically. The environment model tracks the CLIMATE &
    // ECOSYSTEM lifecycle (climate-cycle phase — warming / stabilization /
    // extremes — and atmospheric CO2 / methane trajectory as climateCycle;
    // regulatory-constraint tightening — emissions caps, discharge permits,
    // remediation mandates — as the regulation signal, climateRegulationState;
    // pollution-stock accumulation + remediation lag, species-loss trajectory,
    // and ecosystem-service degradation stress, with ecological-collapse risk —
    // predictedClimateStress via ecosystemCollapseRisk; the prior on environmental
    // / ecosystem health — priorEnvironmentalHealth) rather than neurological
    // cycles, civil-asset lifecycles, attention economies, single-firm capital
    // lifecycles, macroeconomic business cycles, goods-in-motion logistics, or
    // factory-output production. Environment is the CLIMATE / POLLUTION /
    // ECOSYSTEMS / NATURAL-RESOURCES layer and stays DISTINCT from energy (energy
    // = oil / gas / grid / power generation; environment COUPLES to energy via
    // emissions & carbon markets but is not energy) and from agriculture (land /
    // water use is a COUPLING into environment, not environment's own substrate).
    // Environment's cross-domain couplings (energy emissions, infrastructure
    // climate-resilience, governance regulation, technology pollution-control,
    // agriculture land/water) all presume climate & ecosystem visibility that only
    // a recurrent model provides. Real signal validation anchors on REAL
    // environmental-sector tickers — WM, RSG, WCN, CWST (waste management), AWK,
    // WTRG, XYL (water utilities / treatment), ECL, LIN, APD, DAR, AY (pollution
    // control / remediation / environmental services) — never energy oil/gas/grid
    // tickers, which are another domain's content. We map its environmental field
    // names onto the shared deepBrain envelope. Energy/infrastructure/culture/
    // finance/economy/supplyChain/industry win when both are present (a slot is
    // single-domain, so they never collide in practice).
    var _ben = _emO(slot && slot.brainEnvironmentModel);
    // Governance parity: governance brains emit a recurrent INSTITUTIONAL-LIFECYCLE
    // model (brainGovernanceModel) that follows the SAME envelope signature as
    // energy's energyModel, infrastructure's infrastructureModel, culture's
    // cultureModel, finance's financeModel, economy's economyModel, trade's
    // supplyChainModel, industry's industryModel, and environment's
    // environmentModel, so Civilization + the Main Brain consume it identically.
    // The governance model tracks the POLICY / REGULATION / INSTITUTIONAL
    // lifecycle (policy-regime phase — expansive / stable / restrictive — and the
    // rulemaking / approval-legitimacy trajectory as policyRegimeCycle;
    // regulatory-constraint tightening — statutory mandates, oversight rules,
    // compliance regimes — as the regulation signal, regulatoryConstraintState;
    // institutional-failure / legitimacy-erosion stress — public-approval collapse,
    // oversight breakdown, inter-agency coordination failure — with
    // institutional-collapse risk — predictedStress via institutionalFailureRisk;
    // the prior on oversight-effectiveness / institutional-capacity health —
    // priorInstitutionalHealth) rather than neurological cycles, civil-asset
    // lifecycles, attention economies, single-firm capital lifecycles,
    // macroeconomic business cycles, goods-in-motion logistics, factory-output
    // production, or climate / ecosystem health. Governance is the POLICY /
    // RULEMAKING / OVERSIGHT / DEMOCRATIC-INSTITUTIONS / PUBLIC-FINANCE /
    // RULE-OF-LAW / LEGITIMACY layer and is the institutional REGULATION SOURCE
    // that binds the other domains (energy carbon-regulatory pressure, finance
    // capital rules, environment emissions caps, defense procurement oversight).
    // It stays DISTINCT from economy (macro aggregate — GDP / inflation /
    // employment), from finance (capital markets / credit / solvency), from law
    // (the JUDICIAL / legal-system domain — courts, case law, adjudication), and
    // from intelligence. Governance binds mostly to INSTITUTIONS & INDICATORS, not
    // single companies; where entities are needed, real signal validation anchors
    // on REAL govtech / public-sector identifiers — TYL (Tyler Technologies), MMS
    // (Maximus), BAH (Booz Allen Hamilton), LDOS (Leidos), ACN (Accenture), GDIT
    // (General Dynamics IT) — and on governance INDICES / sources — World Bank WGI
    // (Worldwide Governance Indicators), V-Dem, OECD, GAO, CBO, the Federal
    // Register — never energy oil/gas/grid tickers or fabricated entities, which
    // are another domain's content. We map its institutional field names onto the
    // shared deepBrain envelope. Energy/infrastructure/culture/finance/economy/
    // supplyChain/industry/environment win when both are present (a slot is
    // single-domain, so they never collide in practice).
    var _bgm = _emO(slot && slot.brainGovernanceModel);
    var deepBrain = _bem ? {
      cycle:           _num(_bem.cycle),
      predictionError: _emO(_bem.predictionError),
      regulationState: (_bem.regulation && _bem.regulation.state) || null,
      regulation:      _emO(_bem.regulation),
      readyForHandoff: _bem.readyForHandoff === true,
      predictedStress: _num(_bem.predictedStress),
      prior:           _bem.prior ? { expectedStress: _num(_bem.prior.expectedStress), confidence: _num(_bem.prior.confidence), samples: _num(_bem.prior.samples) } : null,
      domainDiagnosisPacket: _emO(_bem.domainDiagnosisPacket)   // F1: structured DomainDiagnosisPacket schema
    } : _bim ? {
      // Civil-asset lifecycle mapped onto the shared recurrent envelope.
      // assetConditionCycle → cycle, capitalAllocationRegulation → regulation,
      // failureProbability → predictedStress, priorAssetHealth → prior,
      // domainAssetPacket → domainDiagnosisPacket (analogous to domainDiagnosisPacket).
      cycle:           _num(_bim.assetConditionCycle != null ? _bim.assetConditionCycle : _bim.cycle),
      predictionError: _emO(_bim.predictionError),
      regulationState: (_bim.capitalAllocationRegulation && _bim.capitalAllocationRegulation.state)
                       || (_bim.capFundingState && _bim.capFundingState.state)
                       || _str(_bim.capFundingState)
                       || (_bim.regulation && _bim.regulation.state)
                       || null,
      regulation:      _emO(_bim.capitalAllocationRegulation) || _emO(_bim.regulation),
      readyForHandoff: _bim.readyForHandoff === true,
      // failureProbability is the civil predicted-stress signal (failure
      // likelihood of the asset base), carried through unchanged in [0..1].
      predictedStress: _num(_bim.failureProbability != null ? _bim.failureProbability : _bim.predictedStress),
      prior:           (_bim.priorAssetHealth || _bim.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected asset-failure / distress level.
                             expectedStress: _num(p.expectedStress != null ? p.expectedStress : p.expectedFailure),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_bim.priorAssetHealth || _bim.prior)
                       : null,
      // Civil asset-lifecycle telemetry preserved alongside the shared envelope
      // so downstream artifact expansion can feed infrastructure-investment
      // decisions (deferred-maintenance accumulation, depreciation projection).
      depreciationProjection: _num(_bim.depreciationProjection),
      maintenanceDeficitAccum: _num(_bim.maintenanceDeficitAccum),
      domainDiagnosisPacket: _emO(_bim.domainAssetPacket) || _emO(_bim.domainDiagnosisPacket)
    } : _bcm ? {
      // Cultural-vitality lifecycle mapped onto the shared recurrent envelope.
      // attentionCycle → cycle, expressionState → regulation,
      // failureProbability → predictedStress, creativeCapacity → prior,
      // domainCulturePacket → domainDiagnosisPacket (analogous to domainDiagnosisPacket).
      cycle:           _num(_bcm.attentionCycle != null ? _bcm.attentionCycle : _bcm.cycle),
      predictionError: _emO(_bcm.predictionError),
      // expressionState is the cultural regulation signal: narrative freedom
      // vs censorship pressure (analogous to energy's regulationState and
      // infrastructure's capital-funding regulation).
      regulationState: (_bcm.expressionState && _bcm.expressionState.state)
                       || _str(_bcm.expressionState)
                       || (_bcm.regulation && _bcm.regulation.state)
                       || null,
      regulation:      _emO(_bcm.expressionState) || _emO(_bcm.regulation),
      readyForHandoff: _bcm.readyForHandoff === true,
      // failureProbability is the culture predicted-stress signal (cultural
      // collapse risk — audience disengagement, heritage loss), carried
      // through unchanged in [0..1].
      predictedStress: _num(_bcm.failureProbability != null ? _bcm.failureProbability : _bcm.predictedStress),
      // creativeCapacity carries the prior on artist-ecosystem health (the
      // creative-capacity trend), mirroring energy's prior / infrastructure's
      // priorAssetHealth.
      prior:           (_bcm.creativeCapacity || _bcm.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected cultural-vitality distress level. When
                             // creativeCapacity is reported as a health value
                             // ([0..1] high = healthy), invert into a stress
                             // expectation; an explicit expectedStress wins.
                             expectedStress: _num(
                               p.expectedStress != null ? p.expectedStress
                               : (p.expectedDecline != null ? p.expectedDecline
                               : (typeof p.capacity === 'number' ? (1 - _clamp01(p.capacity))
                               : (typeof p === 'number' ? (1 - _clamp01(p)) : null)))
                             ),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_bcm.creativeCapacity || _bcm.prior)
                       : null,
      // Cultural-vitality telemetry preserved alongside the shared envelope so
      // downstream artifact expansion can feed culture-investment decisions
      // (creative-capacity trend, audience-attention erosion).
      creativeCapacityTrend: _num(_bcm.creativeCapacityTrend),
      attentionErosionAccum: _num(_bcm.attentionErosionAccum),
      domainDiagnosisPacket: _emO(_bcm.domainCulturePacket) || _emO(_bcm.domainDiagnosisPacket)
    } : _bfm ? {
      // Capital-allocation / credit lifecycle mapped onto the shared recurrent
      // envelope. creditCycle → cycle, fundingSourceQuality → regulation,
      // liquidityCrisis / systemicSolvencyRisk → predictedStress,
      // priorCapitalHealth → prior, domainFinancePacket → domainDiagnosisPacket.
      cycle:           _num(_bfm.creditCycle != null ? _bfm.creditCycle : _bfm.cycle),
      predictionError: _emO(_bfm.predictionError),
      // fundingSourceQuality is the finance regulation signal: the health of
      // the funding base (deposits / wholesale / equity access) and the
      // tightness of credit supply (analogous to energy's regulationState,
      // infrastructure's capital-funding regulation, and culture's expression
      // state). High quality = stable, diversified, low-cost funding.
      regulationState: (_bfm.fundingSourceQuality && _bfm.fundingSourceQuality.state)
                       || _str(_bfm.fundingSourceQuality)
                       || (_bfm.fundingState && _bfm.fundingState.state)
                       || _str(_bfm.fundingState)
                       || (_bfm.regulation && _bfm.regulation.state)
                       || null,
      regulation:      _emO(_bfm.fundingSourceQuality) || _emO(_bfm.fundingState) || _emO(_bfm.regulation),
      readyForHandoff: _bfm.readyForHandoff === true,
      // liquidityCrisis is the finance predicted-stress signal (likelihood of a
      // funding run / liquidity-crisis / default cascade), carried through
      // unchanged in [0..1]. systemicSolvencyRisk is the broader solvency
      // analogue; either may stand in for predictedStress, liquidityCrisis wins
      // as the more acute near-term signal.
      predictedStress: _num(
        _bfm.liquidityCrisis != null ? _bfm.liquidityCrisis
        : (_bfm.systemicSolvencyRisk != null ? _bfm.systemicSolvencyRisk
        : _bfm.predictedStress)
      ),
      // priorCapitalHealth carries the prior on balance-sheet capital adequacy
      // (the capital-health trend), mirroring energy's prior, infrastructure's
      // priorAssetHealth, and culture's creativeCapacity. When reported as a
      // health value ([0..1] high = healthy / well-capitalized), invert into a
      // stress expectation; an explicit expectedStress wins.
      prior:           (_bfm.priorCapitalHealth || _bfm.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected solvency / liquidity distress level.
                             expectedStress: _num(
                               p.expectedStress != null ? p.expectedStress
                               : (p.expectedDistress != null ? p.expectedDistress
                               : (typeof p.capitalAdequacy === 'number' ? (1 - _clamp01(p.capitalAdequacy))
                               : (typeof p.health === 'number' ? (1 - _clamp01(p.health))
                               : (typeof p === 'number' ? (1 - _clamp01(p)) : null))))
                             ),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_bfm.priorCapitalHealth || _bfm.prior)
                       : null,
      // Capital / credit-liquidity telemetry preserved alongside the shared
      // envelope so downstream artifact expansion can feed finance-investment
      // and systemic-risk decisions (credit-cycle phase, solvency headroom,
      // funding-mix concentration). systemicSolvencyRisk is carried explicitly
      // even when liquidityCrisis drove predictedStress, so the broader
      // solvency view is not lost.
      systemicSolvencyRisk:   _num(_bfm.systemicSolvencyRisk),
      creditCycleTrend:       _num(_bfm.creditCycleTrend),
      liquidityHeadroomTrend: _num(_bfm.liquidityHeadroomTrend),
      domainDiagnosisPacket: _emO(_bfm.domainFinancePacket) || _emO(_bfm.domainDiagnosisPacket)
    } : _bzm ? {
      // Macroeconomic business-cycle lifecycle mapped onto the shared recurrent
      // envelope. macroGrowthCycle → cycle, fiscalMonetaryRegulation → regulation,
      // recessionRisk / recessionaryStress → predictedStress,
      // priorGrowthTrend → prior, domainEconomyPacket → domainDiagnosisPacket.
      cycle:           _num(_bzm.macroGrowthCycle != null ? _bzm.macroGrowthCycle : _bzm.cycle),
      predictionError: _emO(_bzm.predictionError),
      // fiscalMonetaryRegulation is the economy regulation signal: the stance of
      // fiscal & monetary policy — central-bank rate-setting (FEDFUNDS), money
      // supply (M2), government fiscal posture — and how it is steering aggregate
      // demand (analogous to energy's regulationState, infrastructure's
      // capital-funding regulation, culture's expression state, and finance's
      // funding-source quality). Accommodative / neutral / restrictive regime.
      regulationState: (_bzm.fiscalMonetaryRegulation && _bzm.fiscalMonetaryRegulation.state)
                       || _str(_bzm.fiscalMonetaryRegulation)
                       || (_bzm.policyRegime && _bzm.policyRegime.state)
                       || _str(_bzm.policyRegime)
                       || (_bzm.regulation && _bzm.regulation.state)
                       || null,
      regulation:      _emO(_bzm.fiscalMonetaryRegulation) || _emO(_bzm.policyRegime) || _emO(_bzm.regulation),
      readyForHandoff: _bzm.readyForHandoff === true,
      // recessionRisk is the economy predicted-stress signal (likelihood of a
      // recessionary contraction — negative output gap, rising unemployment,
      // demand collapse), carried through unchanged in [0..1]. recessionaryStress
      // is the broader contraction-severity analogue; either may stand in for
      // predictedStress, recessionRisk wins as the more acute near-term signal.
      // An expansionary reading is the low-stress end of the same axis.
      predictedStress: _num(
        _bzm.recessionRisk != null ? _bzm.recessionRisk
        : (_bzm.recessionaryStress != null ? _bzm.recessionaryStress
        : (_bzm.expansionaryStress != null ? _bzm.expansionaryStress
        : _bzm.predictedStress))
      ),
      // priorGrowthTrend carries the prior on aggregate-growth health (the GDP
      // growth trajectory), mirroring energy's prior, infrastructure's
      // priorAssetHealth, culture's creativeCapacity, and finance's
      // priorCapitalHealth. When reported as a growth/health value ([0..1] high =
      // strong expansion / healthy), invert into a stress (recession) expectation;
      // an explicit expectedStress wins.
      prior:           (_bzm.priorGrowthTrend || _bzm.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected recessionary / contraction distress level.
                             expectedStress: _num(
                               p.expectedStress != null ? p.expectedStress
                               : (p.expectedRecession != null ? p.expectedRecession
                               : (typeof p.growthHealth === 'number' ? (1 - _clamp01(p.growthHealth))
                               : (typeof p.growth === 'number' ? (1 - _clamp01(p.growth))
                               : (typeof p === 'number' ? (1 - _clamp01(p)) : null))))
                             ),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_bzm.priorGrowthTrend || _bzm.prior)
                       : null,
      // Macroeconomic telemetry preserved alongside the shared envelope so
      // downstream artifact expansion can feed macro-investment and policy
      // decisions (real GDP growth, inflation, labor market, money & rates,
      // external balance, demand composition). Sourced from REAL FRED series:
      // GDPC1, CPIAUCSL/PCEPI, UNRATE/PAYEMS, M2, FEDFUNDS, DGS10. These are
      // MACRO AGGREGATES — distinct from finance's credit/liquidity signals.
      gdpGrowthTrend:         _num(_bzm.gdpGrowthTrend),
      inflationTrend:         _num(_bzm.inflationTrend),
      employmentTrend:        _num(_bzm.employmentTrend),
      moneySupplyTrend:       _num(_bzm.moneySupplyTrend),
      tradeBalanceTrend:      _num(_bzm.tradeBalanceTrend),
      consumptionTrend:       _num(_bzm.consumptionTrend),
      investmentTrend:        _num(_bzm.investmentTrend),
      domainDiagnosisPacket: _emO(_bzm.domainEconomyPacket) || _emO(_bzm.domainDiagnosisPacket)
    } : _bsm ? {
      // Logistics / goods-flow lifecycle mapped onto the shared recurrent
      // envelope. shipmentCycle → cycle, freightCostRegulation → regulation,
      // routeDisruptionRisk → predictedStress, priorThroughputHealth → prior,
      // domainSupplyChainPacket → domainDiagnosisPacket.
      cycle:           _num(_bsm.shipmentCycle != null ? _bsm.shipmentCycle : _bsm.cycle),
      predictionError: _emO(_bsm.predictionError),
      // freightCostRegulation is the trade regulation signal: the tightness of
      // shipping rates and carrier capacity (ocean/air/truck/rail), and how
      // freight-cost / customs-clearance conditions are steering goods flow
      // (analogous to energy's regulationState, infrastructure's capital-funding
      // regulation, culture's expression state, finance's funding-source quality,
      // and economy's fiscal-monetary regulation). Loose / balanced / tight.
      regulationState: (_bsm.freightCostRegulation && _bsm.freightCostRegulation.state)
                       || _str(_bsm.freightCostRegulation)
                       || (_bsm.carrierCapacityState && _bsm.carrierCapacityState.state)
                       || _str(_bsm.carrierCapacityState)
                       || (_bsm.regulation && _bsm.regulation.state)
                       || null,
      regulation:      _emO(_bsm.freightCostRegulation) || _emO(_bsm.carrierCapacityState) || _emO(_bsm.regulation),
      readyForHandoff: _bsm.readyForHandoff === true,
      // routeDisruptionRisk is the trade predicted-stress signal (likelihood of a
      // freight-network disruption — port congestion, route closure, customs
      // backlog, carrier-capacity shortfall), carried through unchanged in
      // [0..1]. logisticsStress is the broader throughput-degradation analogue;
      // either may stand in for predictedStress, routeDisruptionRisk wins as the
      // more acute near-term signal.
      predictedStress: _num(
        _bsm.routeDisruptionRisk != null ? _bsm.routeDisruptionRisk
        : (_bsm.logisticsStress != null ? _bsm.logisticsStress
        : _bsm.predictedStress)
      ),
      // priorThroughputHealth carries the prior on logistics throughput /
      // service-level health (the freight-throughput trend), mirroring energy's
      // prior, infrastructure's priorAssetHealth, culture's creativeCapacity,
      // finance's priorCapitalHealth, and economy's priorGrowthTrend. When
      // reported as a health value ([0..1] high = strong, on-time throughput),
      // invert into a stress (disruption) expectation; an explicit expectedStress
      // wins.
      prior:           (_bsm.priorThroughputHealth || _bsm.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected freight-disruption / logistics distress level.
                             expectedStress: _num(
                               p.expectedStress != null ? p.expectedStress
                               : (p.expectedDisruption != null ? p.expectedDisruption
                               : (typeof p.throughputHealth === 'number' ? (1 - _clamp01(p.throughputHealth))
                               : (typeof p.serviceLevel === 'number' ? (1 - _clamp01(p.serviceLevel))
                               : (typeof p === 'number' ? (1 - _clamp01(p)) : null))))
                             ),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_bsm.priorThroughputHealth || _bsm.prior)
                       : null,
      // Logistics telemetry preserved alongside the shared envelope so downstream
      // artifact expansion can feed trade / supply-chain decisions (shipping-cost
      // pressure, carrier-capacity utilization, freight-modal-shift adoption,
      // customs-clearance backlog, inventory-accumulation vs throughput / working-
      // capital vs service level). Sourced from REAL freight & logistics tickers:
      // FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL. These are
      // GOODS-IN-MOTION signals — distinct from economy's macro aggregates and
      // industry's production output.
      freightCostTrend:        _num(_bsm.freightCostTrend),
      carrierCapacityTrend:    _num(_bsm.carrierCapacityTrend),
      customsBacklogTrend:     _num(_bsm.customsBacklogTrend),
      modalShiftTrend:         _num(_bsm.modalShiftTrend),
      inventoryThroughputGap:  _num(_bsm.inventoryThroughputGap),
      domainDiagnosisPacket: _emO(_bsm.domainSupplyChainPacket) || _emO(_bsm.domainDiagnosisPacket)
    } : _bum ? {
      // Industrial-production lifecycle mapped onto the shared recurrent envelope.
      // productionCycle → cycle, capacityUtilizationRegulation → regulation,
      // productionContractionRisk → predictedStress, priorCapacityHealth → prior,
      // domainIndustryPacket → domainDiagnosisPacket.
      cycle:           _num(_bum.productionCycle != null ? _bum.productionCycle : _bum.cycle),
      predictionError: _emO(_bum.predictionError),
      // capacityUtilizationRegulation is the industry regulation signal: how
      // capacity expansion (capex / new lines) vs depreciation (idling, plant
      // retirement) and automation-adoption cadence are steering factory output
      // (analogous to energy's regulationState, infrastructure's capital-funding
      // regulation, culture's expression state, finance's funding-source quality,
      // economy's fiscal-monetary regulation, and trade's freight-cost regulation).
      // Underbuilt / balanced / overbuilt utilization regime.
      regulationState: (_bum.capacityUtilizationRegulation && _bum.capacityUtilizationRegulation.state)
                       || _str(_bum.capacityUtilizationRegulation)
                       || (_bum.utilizationState && _bum.utilizationState.state)
                       || _str(_bum.utilizationState)
                       || (_bum.regulation && _bum.regulation.state)
                       || null,
      regulation:      _emO(_bum.capacityUtilizationRegulation) || _emO(_bum.utilizationState) || _emO(_bum.regulation),
      readyForHandoff: _bum.readyForHandoff === true,
      // productionContractionRisk is the industry predicted-stress signal
      // (likelihood of a production contraction — idle capacity, demand collapse
      // for capital goods, supply-chain-resilience shortfall forcing line stoppage,
      // plant failure), carried through unchanged in [0..1]. industrialStress is
      // the broader output-degradation analogue; either may stand in for
      // predictedStress, productionContractionRisk wins as the more acute near-term
      // signal.
      predictedStress: _num(
        _bum.productionContractionRisk != null ? _bum.productionContractionRisk
        : (_bum.industrialStress != null ? _bum.industrialStress
        : _bum.predictedStress)
      ),
      // priorCapacityHealth carries the prior on capacity-utilization / industrial-
      // output health (the production-capacity trend), mirroring energy's prior,
      // infrastructure's priorAssetHealth, culture's creativeCapacity, finance's
      // priorCapitalHealth, economy's priorGrowthTrend, and trade's
      // priorThroughputHealth. When reported as a health value ([0..1] high =
      // strong, well-utilized capacity), invert into a stress (contraction)
      // expectation; an explicit expectedStress wins.
      prior:           (_bum.priorCapacityHealth || _bum.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected production-contraction / idle-capacity distress level.
                             expectedStress: _num(
                               p.expectedStress != null ? p.expectedStress
                               : (p.expectedContraction != null ? p.expectedContraction
                               : (typeof p.capacityHealth === 'number' ? (1 - _clamp01(p.capacityHealth))
                               : (typeof p.utilization === 'number' ? (1 - _clamp01(p.utilization))
                               : (typeof p === 'number' ? (1 - _clamp01(p)) : null))))
                             ),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_bum.priorCapacityHealth || _bum.prior)
                       : null,
      // Industrial-production telemetry preserved alongside the shared envelope so
      // downstream artifact expansion can feed industry / capital-goods decisions
      // (capacity-utilization trend, investment-vs-depreciation balance, automation/
      // robotics-adoption cadence, supply-chain-resilience headroom, maintenance/
      // downtime accumulation, order-backlog vs output). Sourced from REAL heavy-
      // industry / capital-goods / machinery tickers: CAT, DE, GE, HON, MMM, EMR,
      // ITW, ETN, PH, ROK, DOV, GEV. These are FACTORY-OUTPUT / capital-goods
      // PRODUCTION signals — distinct from trade's goods-in-motion logistics,
      // economy's macro aggregates, and technology's automation substrate.
      capacityUtilizationTrend:  _num(_bum.capacityUtilizationTrend),
      investmentDepreciationGap: _num(_bum.investmentDepreciationGap),
      automationAdoptionTrend:   _num(_bum.automationAdoptionTrend),
      supplyChainResilience:     _num(_bum.supplyChainResilience),
      maintenanceDowntimeAccum:  _num(_bum.maintenanceDowntimeAccum),
      orderBacklogTrend:         _num(_bum.orderBacklogTrend),
      domainDiagnosisPacket: _emO(_bum.domainIndustryPacket) || _emO(_bum.domainDiagnosisPacket)
    } : _ben ? {
      // Environmental-health lifecycle mapped onto the shared recurrent envelope.
      // climateCycle → cycle, climateRegulationState → regulation,
      // ecosystemCollapseRisk / predictedClimateStress → predictedStress,
      // priorEnvironmentalHealth → prior, domainEnvironmentPacket → domainDiagnosisPacket.
      cycle:           _num(_ben.climateCycle != null ? _ben.climateCycle : _ben.cycle),
      predictionError: _emO(_ben.predictionError),
      // climateRegulationState is the environment regulation signal: the tightening
      // (or loosening) of environmental constraint — emissions caps, discharge
      // permits, remediation mandates, conservation rules — and how it is steering
      // pollution and ecosystem outcomes (analogous to energy's regulationState,
      // infrastructure's capital-funding regulation, culture's expression state,
      // finance's funding-source quality, economy's fiscal-monetary regulation,
      // trade's freight-cost regulation, and industry's capacity-utilization
      // regulation). Permissive / balanced / restrictive regulatory regime.
      regulationState: (_ben.climateRegulationState && _ben.climateRegulationState.state)
                       || _str(_ben.climateRegulationState)
                       || (_ben.regulatoryConstraintState && _ben.regulatoryConstraintState.state)
                       || _str(_ben.regulatoryConstraintState)
                       || (_ben.regulation && _ben.regulation.state)
                       || null,
      regulation:      _emO(_ben.climateRegulationState) || _emO(_ben.regulatoryConstraintState) || _emO(_ben.regulation),
      readyForHandoff: _ben.readyForHandoff === true,
      // ecosystemCollapseRisk is the environment predicted-stress signal (likelihood
      // of an ecological / environmental-health collapse — pollution-stock overshoot,
      // species-loss tipping point, ecosystem-service degradation, climate-extreme
      // shock), carried through unchanged in [0..1]. predictedClimateStress is the
      // broader climate-stress analogue; either may stand in for predictedStress,
      // ecosystemCollapseRisk wins as the more acute near-term signal.
      predictedStress: _num(
        _ben.ecosystemCollapseRisk != null ? _ben.ecosystemCollapseRisk
        : (_ben.predictedClimateStress != null ? _ben.predictedClimateStress
        : (_ben.environmentalStress != null ? _ben.environmentalStress
        : _ben.predictedStress))
      ),
      // priorEnvironmentalHealth carries the prior on ecosystem / environmental
      // health (the environmental-health trajectory), mirroring energy's prior,
      // infrastructure's priorAssetHealth, culture's creativeCapacity, finance's
      // priorCapitalHealth, economy's priorGrowthTrend, trade's priorThroughputHealth,
      // and industry's priorCapacityHealth. When reported as a health value
      // ([0..1] high = clean air/water/soil, intact biodiversity, low emissions),
      // invert into a stress (degradation) expectation; an explicit expectedStress
      // wins.
      prior:           (_ben.priorEnvironmentalHealth || _ben.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected environmental-degradation / ecosystem-collapse distress level.
                             expectedStress: _num(
                               p.expectedStress != null ? p.expectedStress
                               : (p.expectedDegradation != null ? p.expectedDegradation
                               : (typeof p.environmentalHealth === 'number' ? (1 - _clamp01(p.environmentalHealth))
                               : (typeof p.ecosystemHealth === 'number' ? (1 - _clamp01(p.ecosystemHealth))
                               : (typeof p === 'number' ? (1 - _clamp01(p)) : null))))
                             ),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_ben.priorEnvironmentalHealth || _ben.prior)
                       : null,
      // Environmental telemetry preserved alongside the shared envelope so
      // downstream artifact expansion can feed environment / climate-adaptation
      // decisions (atmospheric CO2 / methane trajectory, air/water/soil pollution
      // stock vs remediation lag, biodiversity / species-loss trajectory,
      // ecosystem-service degradation, carbon-market price, regulatory-constraint
      // tightening). Sourced from REAL environmental-sector tickers: WM, RSG, WCN,
      // CWST, AWK, WTRG, XYL, ECL, LIN, APD, DAR, AY. These are CLIMATE / POLLUTION
      // / ECOSYSTEMS signals — distinct from energy's oil/gas/grid (a coupling via
      // emissions & carbon) and agriculture's land/water use (a coupling).
      atmosphericCarbonTrend:     _num(_ben.atmosphericCarbonTrend),
      pollutionStockTrend:        _num(_ben.pollutionStockTrend),
      remediationLagTrend:        _num(_ben.remediationLagTrend),
      biodiversityTrend:          _num(_ben.biodiversityTrend),
      ecosystemServiceTrend:      _num(_ben.ecosystemServiceTrend),
      carbonMarketTrend:          _num(_ben.carbonMarketTrend),
      regulatoryTighteningTrend:  _num(_ben.regulatoryTighteningTrend),
      domainDiagnosisPacket: _emO(_ben.domainEnvironmentPacket) || _emO(_ben.domainDiagnosisPacket)
    } : _bgm ? {
      // Institutional-lifecycle mapped onto the shared recurrent envelope.
      // policyRegimeCycle → cycle, regulatoryConstraintState → regulation,
      // institutionalFailureRisk → predictedStress, priorInstitutionalHealth → prior,
      // domainGovernancePacket → domainDiagnosisPacket.
      cycle:           _num(_bgm.policyRegimeCycle != null ? _bgm.policyRegimeCycle : _bgm.cycle),
      predictionError: _emO(_bgm.predictionError),
      // regulatoryConstraintState is the governance regulation signal: the
      // tightening (or loosening) of regulatory / statutory constraint —
      // rulemaking volume, compliance mandates, oversight scope — and how the
      // policy regime is steering institutional outcomes (analogous to energy's
      // regulationState, infrastructure's capital-funding regulation, culture's
      // expression state, finance's funding-source quality, economy's fiscal-
      // monetary regulation, trade's freight-cost regulation, industry's
      // capacity-utilization regulation, and environment's climate-regulation
      // state). Expansive / stable / restrictive policy regime.
      regulationState: (_bgm.regulatoryConstraintState && _bgm.regulatoryConstraintState.state)
                       || _str(_bgm.regulatoryConstraintState)
                       || (_bgm.policyRegimeState && _bgm.policyRegimeState.state)
                       || _str(_bgm.policyRegimeState)
                       || (_bgm.regulation && _bgm.regulation.state)
                       || null,
      regulation:      _emO(_bgm.regulatoryConstraintState) || _emO(_bgm.policyRegimeState) || _emO(_bgm.regulation),
      readyForHandoff: _bgm.readyForHandoff === true,
      // institutionalFailureRisk is the governance predicted-stress signal
      // (likelihood of institutional failure / legitimacy erosion — public-
      // approval collapse, oversight breakdown, inter-agency coordination
      // failure, rule-of-law degradation), carried through unchanged in [0..1].
      // legitimacyStress is the broader legitimacy-erosion analogue; either may
      // stand in for predictedStress, institutionalFailureRisk wins as the more
      // acute near-term signal.
      predictedStress: _num(
        _bgm.institutionalFailureRisk != null ? _bgm.institutionalFailureRisk
        : (_bgm.legitimacyStress != null ? _bgm.legitimacyStress
        : (_bgm.governanceStress != null ? _bgm.governanceStress
        : _bgm.predictedStress))
      ),
      // priorInstitutionalHealth carries the prior on oversight-effectiveness /
      // institutional-capacity health (the institutional-integrity trajectory),
      // mirroring energy's prior, infrastructure's priorAssetHealth, culture's
      // creativeCapacity, finance's priorCapitalHealth, economy's priorGrowthTrend,
      // trade's priorThroughputHealth, industry's priorCapacityHealth, and
      // environment's priorEnvironmentalHealth. When reported as a health value
      // ([0..1] high = effective oversight, high legitimacy, strong inter-agency
      // capacity), invert into a stress (institutional-failure) expectation; an
      // explicit expectedStress wins.
      prior:           (_bgm.priorInstitutionalHealth || _bgm.prior)
                       ? (function (p) {
                           return {
                             // expectedStress mirrors energy: here the prior
                             // expected institutional-failure / legitimacy-erosion distress level.
                             expectedStress: _num(
                               p.expectedStress != null ? p.expectedStress
                               : (p.expectedErosion != null ? p.expectedErosion
                               : (typeof p.institutionalHealth === 'number' ? (1 - _clamp01(p.institutionalHealth))
                               : (typeof p.oversightEffectiveness === 'number' ? (1 - _clamp01(p.oversightEffectiveness))
                               : (typeof p === 'number' ? (1 - _clamp01(p)) : null))))
                             ),
                             confidence:     _num(p.confidence),
                             samples:        _num(p.samples)
                           };
                         })(_bgm.priorInstitutionalHealth || _bgm.prior)
                       : null,
      // Institutional telemetry preserved alongside the shared envelope so
      // downstream artifact expansion can feed governance / public-administration
      // decisions (oversight-effectiveness trend on GAO/CBO/IG audit capacity,
      // public-approval / legitimacy trajectory, rulemaking / regulatory-constraint
      // tightening, inter-agency coordination health, public-finance / budget
      // posture, rule-of-law / institutional-integrity trend, political-stability
      // trajectory). Sourced from REAL governance INDICES & govtech identifiers:
      // World Bank WGI, V-Dem, OECD, GAO, CBO, the Federal Register, and the
      // public-sector vendors TYL, MMS, BAH, LDOS, ACN, GDIT. These are POLICY /
      // RULEMAKING / OVERSIGHT / LEGITIMACY signals — distinct from economy's
      // macro aggregates, finance's capital markets, and law's judicial system.
      oversightEffectivenessTrend: _num(_bgm.oversightEffectivenessTrend != null ? _bgm.oversightEffectivenessTrend : _bgm.oversightEffectiveness),
      legitimacyTrend:             _num(_bgm.legitimacyTrend != null ? _bgm.legitimacyTrend : _bgm.legitimacyTrendPrior),
      regulatoryTighteningTrend:   _num(_bgm.regulatoryTighteningTrend),
      interagencyCoordination:     _num(_bgm.interagencyCoordination != null ? _bgm.interagencyCoordination : _bgm.institutionalCapacity),
      publicFinancePosture:        _num(_bgm.publicFinancePosture),
      ruleOfLawTrend:              _num(_bgm.ruleOfLawTrend),
      politicalStabilityTrend:     _num(_bgm.politicalStabilityTrend),
      domainDiagnosisPacket: _emO(_bgm.domainGovernancePacket) || _emO(_bgm.domainDiagnosisPacket)
    } : null;

    // Feed health. Configured count is the MAX of every honest declaration
    // available — the snapshot's full source list (live + dead), the brain's
    // own count, and the registry's declared feeds. Trusting brain alone (or
    // signal-engine alone) under-reports when one knows fewer feeds than the
    // other. We never claim more LIVE than CONFIGURED.
    var liveBrain  = _num(slot && slot.brainSourcesLive);
    var totalBrain = _num(slot && slot.brainSourcesTotal);
    var sigSources = _arr(slot && slot.sources);
    var sigLive    = sigSources.filter(function (s) { return s && s.live; }).length;
    var declaredCount = _declaredFeedCount(domainId);
    var totalCandidates = [];
    if (declaredCount != null) totalCandidates.push(declaredCount);
    if (sigSources.length > 0) totalCandidates.push(sigSources.length);
    if (totalBrain != null)    totalCandidates.push(totalBrain);
    var configured = totalCandidates.length > 0 ? Math.max.apply(null, totalCandidates) : 0;
    var liveCandidate = liveBrain != null ? liveBrain : sigLive;
    var live = Math.min(configured, Math.max(0, liveCandidate));
    var failed = Math.max(0, configured - live);
    var stale = (sourceType === 'domain-brain-stale') ? 1
              : (slot && slot.status === 'STALE') ? 1
              : 0;
    // Origin tag honesty: which signal won? (registry / snapshot / brain)
    var feedHealthOrigin = (declaredCount != null && declaredCount === configured) ? 'registry'
                         : (sigSources.length === configured) ? 'snapshot'
                         : (totalBrain != null && totalBrain === configured) ? 'brain'
                         : 'snapshot';

    // Activity / band / level
    var stressBand    = _stressBand(stress);
    var activityLevel = _activityLevel(slot);

    // Audit-only fields
    var audit = _computeAudit(slot, brainAge, snapAge, sourceType, domainId);

    // Summary line — prefer brain status, fall back to top diagnosis or band text.
    var summaryLine = '';
    if (slot && slot.brainStatus) summaryLine = String(slot.brainStatus);
    else if (activeDiagnoses.length > 0 && activeDiagnoses[0].label) summaryLine = activeDiagnoses[0].label;
    else if (topEvidence.length > 0 && topEvidence[0].label) summaryLine = topEvidence[0].label;
    else if (sourceType === 'missing') summaryLine = 'awaiting domain output';
    else summaryLine = stressBand + ' band';

    // Raw quality
    var realDataCount     = live;
    var fallbackCount     = (sourceType === 'fallback' || sourceType === 'missing') ? 1 : 0;
    var proxyDataCount    = 0;
    if (slot && slot.normalizationReason && /baseline|persistence/i.test(slot.normalizationReason)) {
      proxyDataCount = 1;
      audit.auditWarnings.push('PROXY_HEAVY');
    }

    // ── BACKWARDS-COMPAT FLAT FIELDS + TWO EXPLICIT NAMESPACES ────────────
    // truth.*    — domain truth (brain or snapshot), drives the visible row
    // civAudit.* — observer fields only, never overrides truth
    var phaseLabelOut = phase ? (String(phase).toUpperCase() + (phaseLabel ? ' ' + phaseLabel : '')) : null;

    var truthBlock = {
      // Each field is paired with its origin: 'brain' | 'snapshot' | 'fallback' | 'missing' | 'unknown'.
      stressScore:     stress,
      stressOrigin:    stressOrigin,
      stressBand:      stressBand,

      confidence:      confidence,
      confidenceOrigin: confidenceOrigin,

      maturity:        maturity,
      maturityOrigin:  maturityOrigin,

      activity:        activity,
      activityLevel:   activityLevel,
      activityOrigin:  activityOrigin,

      phase:           phase,
      phaseLabel:      phaseLabelOut,
      phaseOrigin:     phase ? 'brain' : 'unknown',

      activeDiagnoses: activeDiagnoses,
      diagnosesOrigin: activeDiagnoses.length > 0 ? 'brain' : 'unknown',

      topEvidence:     topEvidence,
      summaryLine:     summaryLine,

      treatments:      treatments,
      opportunities:   opportunities,
      directives:      directives,

      feedHealth:      { configured: configured, live: live, failed: failed, stale: stale },
      feedHealthOrigin: feedHealthOrigin
    };

    var civAuditBlock = {
      // Civilization is observer-only. These fields never replace truth.
      role:               'observer',
      sourceType:         sourceType,
      brainAgeMs:         brainAge,
      snapshotAgeMs:      snapAge,
      auditConfidence:    audit.auditConfidence,
      evidenceQuality:    audit.evidenceQuality,
      feedIntegrity:      audit.feedIntegrity,
      coherenceScore:     audit.coherenceScore,
      crossDomainSupport: audit.crossDomainSupport,
      auditWarnings:      audit.auditWarnings,
      auditFlags:         audit.auditWarnings.slice(),
      rawQuality:         { realDataCount: realDataCount, proxyDataCount: proxyDataCount, fallbackCount: fallbackCount }
    };

    return {
      domainId:       domainId,
      domainLabel:    DOMAIN_LABELS[domainId] || domainId,
      timestamp:      Date.now(),

      // ─── Explicit role-separated containers ──────────────
      truth:    truthBlock,
      civAudit: civAuditBlock,

      // ─── Flat fields kept for backwards compatibility with existing
      // consumers (renderer reads both). New consumers should prefer the
      // namespaced fields above.
      stressScore:    stress,
      stressBand:     stressBand,
      confidence:     confidence,
      activityLevel:  activityLevel,
      activeDiagnoses: activeDiagnoses,
      topEvidence:     topEvidence,
      treatments:      treatments,
      opportunities:   opportunities,
      directives:      directives,
      deepBrain:       deepBrain,
      sourceType:     sourceType,
      brainAgeMs:     brainAge,
      snapshotAgeMs:  snapAge,
      feedHealth:     truthBlock.feedHealth,
      phaseLabel:     phaseLabelOut,
      phase:          phase,
      summaryLine:    summaryLine,
      rawQuality:     civAuditBlock.rawQuality,
      auditFlags:     audit.auditWarnings.slice(),
      audit:          {
        auditConfidence:    audit.auditConfidence,
        evidenceQuality:    audit.evidenceQuality,
        feedIntegrity:      audit.feedIntegrity,
        coherenceScore:     audit.coherenceScore,
        crossDomainSupport: audit.crossDomainSupport,
        auditWarnings:      audit.auditWarnings
      }
    };
  }

  // -----------------------------------------------------------------------
  // Rebuild all 20 packets and publish
  // -----------------------------------------------------------------------
  function _rebuild() {
    var next = {};
    for (var i = 0; i < DOMAIN_ORDER.length; i++) {
      var id = DOMAIN_ORDER[i];
      next[id] = _buildPacket(id);
    }
    _packets = next;
    window.LIMENCivilizationPackets = _packets;
    _lastRebuildAt = Date.now();
    try {
      window.dispatchEvent(new CustomEvent('limen:civilization-packets-update', {
        detail: { packets: _packets, timestamp: _lastRebuildAt }
      }));
    } catch (err) { /* ignore — older browsers */ }
  }

  function _scheduleRebuild() {
    if (_rebuildTimer) return;
    _rebuildTimer = setTimeout(function () {
      _rebuildTimer = null;
      try { _rebuild(); } catch (err) { /* observer must never throw */ }
    }, REBUILD_THROTTLE_MS);
  }

  // -----------------------------------------------------------------------
  // Wire up
  // -----------------------------------------------------------------------
  window.addEventListener('limen:domain-update', _scheduleRebuild);
  window.addEventListener('limen:domain-brain-update', _scheduleRebuild);

  // First render — even before any event fires, packets exist (all 20, marked
  // missing) so Civilization renders all rows immediately and fills in.
  _rebuild();
  // Periodic refresh so audit timestamps and stale flags stay current
  // even when no event fires (e.g., domain-only sites where signal-engine idle).
  setInterval(_scheduleRebuild, 5000);

  // -----------------------------------------------------------------------
  // Public API (read-only)
  // -----------------------------------------------------------------------
  window.LIMENCivilizationAdapter = {
    getOrder:       function () { return DOMAIN_ORDER.slice(); },
    getLabels:      function () { var o = {}; for (var k in DOMAIN_LABELS) o[k] = DOMAIN_LABELS[k]; return o; },
    getAll:         function () { return _packets; },
    get:            function (id) { return _packets[id] || null; },
    rebuildNow:     function () { _rebuild(); return _packets; },
    lastRebuildAt:  function () { return _lastRebuildAt; }
  };

  /**
   * PACKET_FIELDS (canonical contract — keep stable)
   *   domainId, domainLabel, timestamp
   *   stressScore (0..1 | null), stressBand
   *   confidence (0..1 | null), activityLevel
   *   activeDiagnoses[]: { id, label, summary, active, relevance, score }
   *   topEvidence[]:     { kind:'source'|'signal', label, live?, updated? }
   *   treatments[]:      domain-brain treatment objects (source-depth carry-through)
   *   opportunities[]:   domain-brain opportunity objects (source-depth carry-through)
   *   directives[]:      domain-brain directive objects (source-depth carry-through)
   *   sourceType: 'domain-brain' | 'domain-brain-stale' | 'domain-snapshot' | 'fallback' | 'missing'
   *   brainAgeMs, snapshotAgeMs
   *   feedHealth: { configured, live, failed, stale }
   *   phase, phaseLabel
   *   summaryLine
   *   rawQuality: { realDataCount, proxyDataCount, fallbackCount }
   *   auditFlags[]
   *   audit: { auditConfidence, evidenceQuality, feedIntegrity, coherenceScore, crossDomainSupport, auditWarnings }
   */
})();
