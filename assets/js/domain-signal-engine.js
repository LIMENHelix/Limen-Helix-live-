/**
 * domain-signal-engine.js
 * LIMEN HELIX — Domain Signal Awareness Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Does not replicate kernel logic or compute phi(t).
 *
 * Polls /api/domain-snapshot for real feed data across 7 domains.
 * Each domain has 2 real sources with stress, freshness, and signals.
 * Falls back to heuristic computation if endpoint unavailable.
 *
 * Domains: economy, energy, environment, health, technology, research, supplyChain
 *
 * Output: window.LIMENDomains = { domain: { stress, trend, signals, updated, sources, confidence } }
 * Events: limen:domain-update (every cycle), limen:domain-distress (stress > 0.65)
 *
 * Update frequency: 30 seconds (feed poll) + 5 seconds (UI refresh)
 * Load order: after global-signals.js, before event-narrator.js
 */

(function () {
  'use strict';

  // ─── Domain definitions ──────────────────────────────────────────────────

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  var DISTRESS_THRESHOLD = 0.65;
  var FEED_POLL_MS = 30000;
  var UI_REFRESH_MS = 5000;
  var MATERIAL_CHANGE = 0.05;

  // ─── Stress Normalization ──────────────────────────────────────────────
  // Corrects raw API stress before downstream consumption.
  // Raw stress preserved as rawStress; normalized value becomes stress.

  // Domain-specific dampening for known high-throughput / saturation-prone feeds.
  // Factor < 1.0 dampens volume-driven saturation.
  // Ceiling caps maximum normalized stress from this domain alone.
  var _DOMAIN_DAMPEN = {
    law:           { factor: 0.35, ceiling: 0.70, reason: 'volume-dampened: rule/regulation count' },
    health:        { factor: 0.40, ceiling: 0.75, reason: 'volume-dampened: cumulative event count' },
    communication: { factor: 0.45, ceiling: 0.75, reason: 'volume-dampened: headline count' },
    governance:    { factor: 0.55, ceiling: 0.80, reason: 'tone-dampened: negative tone bias' },
    finance:       { factor: 0.60, ceiling: 0.85, reason: 'volatility-dampened: common market moves' },
    infrastructure:{ factor: 0.50, ceiling: 0.80, reason: 'cyber-dampened: embedded system CVE churn does not indicate compromise; construction-index-dampened: baseline volatility' }
  };

  // Structural-signal overrides for infrastructure: certain engineering constraints are
  // NOT noisy commodity/market signals and must bypass dampening (mirrors energy-brain's
  // grid_stress structural conditions). Raw stress is forced to the floor when a structural
  // threshold is crossed, before saturation dampening is applied.
  //   - grid reserve margin below 10%  → grid_stress (structural, not noisy commodity)
  //   - transmission queue depth >2000 MW → transmission_congestion (engineering constraint)
  var _INFRA_STRUCTURAL = {
    gridStressFloor:           0.65, // reserve margin < 10% always reads as grid_stress
    transmissionCongestFloor:  0.60  // queue depth > 2000 MW always reads as congestion
  };

  // Rolling baseline state (accumulates across feed cycles within session)
  var _baselineState = {}; // domainKey → { samples: [], mean: number }
  var _BASELINE_WINDOW = 12; // ~6 minutes at 30s poll (enough for session deviation)

  // Persistence tracker: how many consecutive cycles above elevated threshold
  var _persistenceCount = {}; // domainKey → number

  // Detect infrastructure structural constraints from a feed object.
  // Returns a forced stress floor (0 if none) — engineering constraints bypass dampening.
  function _infraStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    // Grid reserve margin below 10% ALWAYS triggers grid_stress
    var reserveMargin = (feed.reserveMargin !== undefined) ? feed.reserveMargin
                      : (feed.gridReserveMargin !== undefined) ? feed.gridReserveMargin
                      : null;
    if (reserveMargin !== null && reserveMargin < 0.10) {
      if (_INFRA_STRUCTURAL.gridStressFloor > floor) {
        floor = _INFRA_STRUCTURAL.gridStressFloor;
        reason = 'structural: grid_stress (reserve margin ' + (reserveMargin * 100).toFixed(0) + '% < 10%)';
      }
    }
    // Transmission queue depth > 2000 MW ALWAYS triggers transmission_congestion
    var queueDepth = (feed.transmissionQueueMW !== undefined) ? feed.transmissionQueueMW
                   : (feed.queueDepthMW !== undefined) ? feed.queueDepthMW
                   : null;
    if (queueDepth !== null && queueDepth > 2000) {
      if (_INFRA_STRUCTURAL.transmissionCongestFloor > floor) {
        floor = _INFRA_STRUCTURAL.transmissionCongestFloor;
        reason = 'structural: transmission_congestion (queue ' + Math.round(queueDepth) + ' MW > 2000)';
      } else if (floor > 0) {
        reason += ' + transmission_congestion (' + Math.round(queueDepth) + ' MW)';
      }
    }
    return { floor: floor, reason: reason };
  }

  function _normalizeStress(domainKey, rawStress, feed) {
    // Phase 0: infrastructure structural-signal floor (engineering constraints
    // bypass commodity/market dampening — mirrors energy-brain grid_stress conditions)
    var structural = (domainKey === 'infrastructure') ? _infraStructuralFloor(feed) : { floor: 0, reason: '' };
    if (structural.floor > rawStress) {
      rawStress = structural.floor;
    }

    // Phase 1: domain-specific saturation dampening
    var dampen = _DOMAIN_DAMPEN[domainKey];
    var stress = rawStress;
    var reason = structural.floor > 0 ? structural.reason : 'passthrough';

    if (dampen) {
      // Structural floor (if any) bypasses the saturation factor — it is not a
      // volume/CVE-churn signal, so dampening it would erase the engineering constraint.
      if (structural.floor > 0) {
        stress = Math.max(rawStress, structural.floor);
        reason = structural.reason + ' (dampening bypassed)';
      } else {
        stress = rawStress * dampen.factor;
        reason = dampen.reason;
      }
    }

    // Phase 2: deviation from session baseline (when enough samples exist)
    if (!_baselineState[domainKey]) _baselineState[domainKey] = { samples: [], mean: 0 };
    var bs = _baselineState[domainKey];
    bs.samples.push(rawStress);
    if (bs.samples.length > _BASELINE_WINDOW) bs.samples.shift();

    if (bs.samples.length >= 4) {
      // Compute rolling mean
      var sum = 0;
      for (var bi = 0; bi < bs.samples.length; bi++) sum += bs.samples[bi];
      bs.mean = sum / bs.samples.length;

      // Deviation: how far above the session mean?
      var deviation = rawStress - bs.mean;
      if (deviation > 0.05) {
        // Positive deviation boosts stress proportionally
        var deviationBoost = deviation * 0.3;
        stress = stress + deviationBoost;
        reason += ' + deviation-boost(' + deviation.toFixed(2) + ')';
      }
    }

    // Phase 3: persistence — sustained elevation amplifies
    if (!_persistenceCount[domainKey]) _persistenceCount[domainKey] = 0;
    if (rawStress > 0.50) {
      _persistenceCount[domainKey]++;
    } else {
      _persistenceCount[domainKey] = Math.max(0, _persistenceCount[domainKey] - 1);
    }
    var persistence = _persistenceCount[domainKey];
    if (persistence >= 3) {
      // Sustained elevation: small uplift (max +0.10 at 6+ cycles)
      var persistBoost = Math.min((persistence - 2) * 0.025, 0.10);
      stress = stress + persistBoost;
      reason += ' + persistence(' + persistence + ')';
    }

    // Phase 4: apply ceiling (domain-specific or default 0.95)
    var ceiling = dampen ? dampen.ceiling : 0.95;
    if (stress > ceiling) stress = ceiling;

    // Final clamp
    stress = Math.max(0, Math.min(0.95, Math.round(stress * 1000) / 1000));

    return { stress: stress, rawStress: rawStress, normalizationReason: reason };
  }

  // ─── State ───────────────────────────────────────────────────────────────

  var domains = {};
  var prevStress = {};
  var stressHistory = {};
  var HISTORY_MAX = 10;
  var _feedInterval = null;
  var _uiInterval = null;
  var _prevDistressed = {};
  var _expandedDomain = null;
  var _lastFeedData = null;
  var _feedAlive = false;
  var _sourceAudit = {};

  function _initDomains() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      domains[k] = { stress: 0, trend: 0, signals: [], updated: null, sources: [], confidence: 0 };
      prevStress[k] = 0;
      stressHistory[k] = [];
      _prevDistressed[k] = false;
    }
  }
  _initDomains();

  // ─── Feed polling ──────────────────────────────────────────────────────

  function _fetchDomainSnapshot() {
    return fetch('/api/domain-snapshot')
      .then(function (resp) {
        if (!resp.ok) return null;
        return resp.json();
      })
      .catch(function () { return null; });
  }

  // ─── Stale cache for GDELT-backed domains ──────────────────────────────
  // When GDELT rate-limits, server returns FALLBACK. We preserve last-known-good.
  var _GDELT_DOMAINS = {governance:1, communication:1, culture:1, defense:1, religion:1, intelligence:1};
  var _staleCache = {}; // domainKey → { stress, signals, sources, confidence, cachedAt }
  var _STALE_TTL = 600000; // 10 minutes

  function _applyFeedData(data) {
    if (!data || !data.domains) return;
    _lastFeedData = data;
    _feedAlive = true;

    // Bridge into canonical feed store
    if (window.LIMENFeedState && typeof window.LIMENFeedState.ingest === 'function') {
      window.LIMENFeedState.ingest(data);
    }
    var now = Date.now();

    // Expose server-side source health if available
    if (data.sourceHealth) {
      window.LIMENSourceHealth = data.sourceHealth;
    }

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var feed = data.domains[k];
      if (!feed) continue;

      var rawStress = feed.stress || 0;
      var norm = _normalizeStress(k, rawStress, feed);
      var stress = norm.stress;
      var trend = _computeTrend(k, stress);
      var signals = feed.signals || [];
      var sources = feed.sources || [];
      var confidence = feed.confidence || 0;
      var activity = feed.activity || 0;
      var maturity = feed.maturity || '';
      var status = feed.status || null;
      var liveCount = feed.liveCount || 0;

      // Stale cache logic for GDELT-backed domains
      if (_GDELT_DOMAINS[k]) {
        var isFallback = status === 'FALLBACK' || liveCount === 0;
        var cached = _staleCache[k];

        if (!isFallback && liveCount > 0) {
          // Good data — update cache
          _staleCache[k] = { stress: stress, rawStress: rawStress, signals: signals, sources: sources, confidence: confidence, cachedAt: now };
        } else if (isFallback && cached && (now - cached.cachedAt) < _STALE_TTL) {
          // FALLBACK but we have cached real data — use it as STALE
          stress = cached.stress;
          rawStress = cached.rawStress;
          norm = _normalizeStress(k, rawStress, feed);
          stress = norm.stress;
          signals = cached.signals;
          sources = cached.sources;
          confidence = Math.min(cached.confidence * 0.7, 0.5); // reduce confidence
          status = 'STALE';
          liveCount = 0;
        }
      }

      var delta = Math.abs(stress - prevStress[k]);

      domains[k] = {
        stress: stress,
        rawStress: norm.rawStress,
        normalizationReason: norm.normalizationReason,
        trend: trend,
        signals: signals,
        updated: now,
        sources: sources,
        confidence: confidence,
        activity: activity,
        maturity: maturity,
        cadence: feed.cadence || 'unknown',
        status: status,
        liveCount: liveCount
      };

      // Distress event on threshold crossing (rising edge, material change only)
      if (stress > DISTRESS_THRESHOLD && !_prevDistressed[k] && delta >= MATERIAL_CHANGE) {
        _dispatch('limen:domain-distress', {
          domain: k,
          stress: stress,
          rawStress: norm.rawStress,
          trend: trend,
          signals: signals,
          sources: sources
        });
      }
      _prevDistressed[k] = stress > DISTRESS_THRESHOLD;
      prevStress[k] = stress;
    }

    _rebuildAudit();
    window.LIMENDomains = domains;
    _dispatch('limen:domain-update', { domains: domains, timestamp: now, feedAlive: true });
  }

  // ─── Fallback stress computation (no feed) ──────────────────────────────

  var WORLD_DOMAIN_MAP = {
    economy:     ['economy', 'finance'],
    energy:      ['energy'],
    environment: ['climate'],
    health:      ['health'],
    technology:  ['technology'],
    research:    ['technology', 'health'],
    supplyChain: ['economy', 'energy'],
    governance:     ['economy'],
    infrastructure: ['energy', 'economy'],
    agriculture:    ['climate', 'economy'],
    industry:       ['economy', 'energy'],
    education:      ['technology'],
    communication:  ['technology'],
    culture:        ['economy'],
    defense:        ['economy', 'energy'],
    religion:       ['economy'],
    population:     ['health', 'economy'],
    law:            ['economy'],
    finance:        ['economy'],
    intelligence:   ['technology', 'economy']
  };

  function _computeStressFallback(domainKey) {
    var world = window.LIMENWorld || {};
    var worldDomains = world.domains || {};
    var phase = window.LIMENPhase || {};
    var observer = window.LIMENObserver || {};

    var mappedKeys = WORLD_DOMAIN_MAP[domainKey] || [];
    var sum = 0;
    var count = 0;
    for (var i = 0; i < mappedKeys.length; i++) {
      var wd = worldDomains[mappedKeys[i]];
      if (wd && wd.score !== undefined) {
        sum += wd.score;
        count++;
      }
    }
    var baseScore = count > 0 ? sum / count : 0;

    var entropy = observer.entropy || 0;
    var entropyBoost = entropy * 0.15;

    var phaseModifier = 0;
    if (phase.estimated === 'P3' || phase.estimated === 'P7') {
      phaseModifier = 0.10;
    } else if (phase.estimated === 'P4' || phase.estimated === 'P6') {
      phaseModifier = -0.08;
    } else if (phase.estimated === 'P1') {
      phaseModifier = 0.05;
    }

    var noise = (Math.sin(Date.now() * 0.0001 + domainKey.length * 7) + 1) * 0.02;
    var stress = baseScore + entropyBoost + phaseModifier + noise;
    return Math.max(0, Math.min(1, Math.round(stress * 1000) / 1000));
  }

  function _fallbackUpdate() {
    var now = Date.now();
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var rawStress = _computeStressFallback(k);
      var norm = _normalizeStress(k, rawStress);
      var stress = norm.stress;
      var trend = _computeTrend(k, stress);
      var signals = _getSignalsFallback(k, stress);

      domains[k] = {
        stress: stress,
        rawStress: norm.rawStress,
        normalizationReason: norm.normalizationReason,
        trend: trend,
        signals: signals,
        updated: now,
        sources: [
          { name: 'heuristic', value: null, label: 'internal model', updated: now, live: false }
        ],
        confidence: 0.1,
        cadence: 'fallback'
      };

      if (stress > DISTRESS_THRESHOLD && !_prevDistressed[k]) {
        _dispatch('limen:domain-distress', { domain: k, stress: stress, rawStress: norm.rawStress, trend: trend, signals: signals });
      }
      _prevDistressed[k] = stress > DISTRESS_THRESHOLD;
      prevStress[k] = stress;
    }

    _rebuildAudit();
    window.LIMENDomains = domains;
    _dispatch('limen:domain-update', { domains: domains, timestamp: now, feedAlive: false });
  }

  var SIGNAL_TEMPLATES = {
    economy: [
      { threshold: 0.3, text: 'market volatility detected' },
      { threshold: 0.5, text: 'economic indicator divergence' },
      { threshold: 0.7, text: 'financial stress clustering' },
      { threshold: 0.85, text: 'systemic risk signals elevated' }
    ],
    energy: [
      { threshold: 0.3, text: 'energy price fluctuation' },
      { threshold: 0.5, text: 'supply tightening signals' },
      { threshold: 0.7, text: 'oil volatility spike' },
      { threshold: 0.85, text: 'energy infrastructure strain' }
    ],
    environment: [
      { threshold: 0.3, text: 'environmental monitoring active' },
      { threshold: 0.5, text: 'temperature anomaly detected' },
      { threshold: 0.7, text: 'forest loss alerts' },
      { threshold: 0.85, text: 'ecological tipping indicators' }
    ],
    health: [
      { threshold: 0.3, text: 'health research activity' },
      { threshold: 0.5, text: 'treatment efficacy variance' },
      { threshold: 0.7, text: 'clinical outcome anomalies' },
      { threshold: 0.85, text: 'public health stress indicators' }
    ],
    technology: [
      { threshold: 0.3, text: 'innovation cycle monitoring' },
      { threshold: 0.5, text: 'disruption pattern emerging' },
      { threshold: 0.7, text: 'technology adoption stress' },
      { threshold: 0.85, text: 'infrastructure vulnerability signals' }
    ],
    research: [
      { threshold: 0.3, text: 'research output tracking' },
      { threshold: 0.5, text: 'publication rate shift' },
      { threshold: 0.7, text: 'reproducibility concern signals' },
      { threshold: 0.85, text: 'research integrity anomalies' }
    ],
    supplyChain: [
      { threshold: 0.3, text: 'logistics monitoring active' },
      { threshold: 0.5, text: 'supply delay indicators' },
      { threshold: 0.7, text: 'supply chain disruption detected' },
      { threshold: 0.85, text: 'critical shortages emerging' }
    ],
    governance: [
      { threshold: 0.3, text: 'policy activity detected' },
      { threshold: 0.5, text: 'governance stress indicators rising' },
      { threshold: 0.7, text: 'institutional pressure detected' },
      { threshold: 0.85, text: 'governance stability alerts' }
    ],
    infrastructure: [
      { threshold: 0.3, text: 'infrastructure monitoring active' },
      { threshold: 0.5, text: 'infrastructure strain signals' },
      { threshold: 0.7, text: 'infrastructure degradation detected' },
      { threshold: 0.85, text: 'critical infrastructure failure risk' }
    ],
    agriculture: [
      { threshold: 0.3, text: 'agricultural output tracking' },
      { threshold: 0.5, text: 'crop yield variance detected' },
      { threshold: 0.7, text: 'food supply pressure signals' },
      { threshold: 0.85, text: 'agricultural crisis indicators' }
    ],
    industry: [
      { threshold: 0.3, text: 'industrial production monitoring' },
      { threshold: 0.5, text: 'manufacturing output shift' },
      { threshold: 0.7, text: 'industrial contraction signals' },
      { threshold: 0.85, text: 'systemic industrial stress' }
    ],
    education: [
      { threshold: 0.3, text: 'education metrics tracking' },
      { threshold: 0.5, text: 'enrollment pattern shifts' },
      { threshold: 0.7, text: 'education access disruption' },
      { threshold: 0.85, text: 'systemic education failure signals' }
    ],
    communication: [
      { threshold: 0.3, text: 'information flow monitoring' },
      { threshold: 0.5, text: 'media narrative divergence' },
      { threshold: 0.7, text: 'communication infrastructure strain' },
      { threshold: 0.85, text: 'information integrity crisis' }
    ],
    culture: [
      { threshold: 0.3, text: 'cultural sentiment tracking' },
      { threshold: 0.5, text: 'social cohesion variance' },
      { threshold: 0.7, text: 'cultural fragmentation signals' },
      { threshold: 0.85, text: 'identity crisis indicators' }
    ],
    defense: [
      { threshold: 0.3, text: 'security posture monitoring' },
      { threshold: 0.5, text: 'threat assessment elevated' },
      { threshold: 0.7, text: 'defense readiness pressure' },
      { threshold: 0.85, text: 'strategic security alerts active' }
    ],
    religion: [
      { threshold: 0.3, text: 'institutional sentiment tracking' },
      { threshold: 0.5, text: 'moral framework tension' },
      { threshold: 0.7, text: 'interfaith stress indicators' },
      { threshold: 0.85, text: 'symbolic systems destabilization' }
    ],
    population: [
      { threshold: 0.3, text: 'demographic monitoring active' },
      { threshold: 0.5, text: 'migration pattern shift detected' },
      { threshold: 0.7, text: 'population pressure signals' },
      { threshold: 0.85, text: 'demographic transition stress' }
    ],
    law: [
      { threshold: 0.3, text: 'regulatory activity tracking' },
      { threshold: 0.5, text: 'compliance pressure rising' },
      { threshold: 0.7, text: 'legal system strain detected' },
      { threshold: 0.85, text: 'rule of law integrity alerts' }
    ],
    finance: [
      { threshold: 0.3, text: 'financial market monitoring' },
      { threshold: 0.5, text: 'credit stress indicators' },
      { threshold: 0.7, text: 'financial volatility spike' },
      { threshold: 0.85, text: 'systemic financial risk signals' }
    ],
    intelligence: [
      { threshold: 0.3, text: 'data collection monitoring' },
      { threshold: 0.5, text: 'intelligence gap detected' },
      { threshold: 0.7, text: 'information warfare signals' },
      { threshold: 0.85, text: 'strategic awareness degradation' }
    ]
  };

  function _getSignalsFallback(domainKey, stress) {
    var templates = SIGNAL_TEMPLATES[domainKey] || [];
    var signals = [];
    for (var i = 0; i < templates.length; i++) {
      if (stress >= templates[i].threshold) {
        signals.push(templates[i].text);
      }
    }
    return signals;
  }

  // ─── Source audit + status labels ────────────────────────────────────────

  function _rebuildAudit() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      var sources = d.sources || [];
      var liveCount = 0;
      var fallbackCount = 0;
      for (var s = 0; s < sources.length; s++) {
        if (sources[s].live) liveCount++;
        else fallbackCount++;
      }
      _sourceAudit[k] = {
        domain: k,
        sources: sources,
        freshness: _freshness(d.updated),
        liveCount: liveCount,
        fallbackCount: fallbackCount,
        confidence: d.confidence || 0,
        status: _domainStatusLabel(liveCount, fallbackCount, d.status)
      };
    }
    window.LIMENSourceAudit = _sourceAudit;
  }

  function _domainStatusLabel(liveCount, fallbackCount, serverStatus) {
    // Prefer server-reported status if available
    if (serverStatus) return serverStatus;
    if (liveCount >= 2) return 'LIVE';
    if (liveCount === 1) return 'PARTIAL';
    return 'FALLBACK';
  }

  var STRESS_EXPLANATIONS = {
    economy: {
      high: 'unemployment above historical average or employment contraction detected',
      moderate: 'labor market metrics showing mild pressure',
      low: 'economic indicators within expected range'
    },
    energy: {
      high: 'crude prices significantly above baseline, supply cost pressure',
      moderate: 'energy pricing above normal but within volatility band',
      low: 'energy markets stable'
    },
    environment: {
      high: 'severe weather alerts active or temperature anomalies detected',
      moderate: 'environmental monitoring showing mild deviations',
      low: 'environmental conditions nominal'
    },
    health: {
      high: 'unusually large adverse event reporting base or enforcement activity above baseline',
      moderate: 'health surveillance metrics mildly elevated',
      low: 'health indicators within expected range'
    },
    technology: {
      high: 'rapid patent activity or research volume suggesting disruption cycle',
      moderate: 'innovation metrics showing increased activity',
      low: 'technology sector activity nominal'
    },
    research: {
      high: 'publication rate anomaly or research volume spike',
      moderate: 'research output above seasonal average',
      low: 'research activity within expected range'
    },
    supplyChain: {
      high: 'freight cost index elevated or inventory levels below normal',
      moderate: 'logistics indicators showing mild pressure',
      low: 'supply chain metrics stable'
    },
    governance: {
      high: 'institutional or policy stress indicators significantly elevated',
      moderate: 'governance metrics showing mild pressure',
      low: 'governance indicators within expected range'
    },
    infrastructure: {
      high: 'critical infrastructure degradation or failure risk detected',
      moderate: 'infrastructure strain indicators above baseline',
      low: 'infrastructure systems operating normally'
    },
    agriculture: {
      high: 'crop yield anomalies or food supply pressure detected',
      moderate: 'agricultural output showing seasonal variance',
      low: 'agricultural metrics within expected range'
    },
    industry: {
      high: 'manufacturing contraction or industrial output anomaly',
      moderate: 'industrial production metrics mildly elevated',
      low: 'industrial sector operating normally'
    },
    education: {
      high: 'education access disruption or enrollment anomaly',
      moderate: 'education metrics showing mild deviation',
      low: 'education system operating normally'
    },
    communication: {
      high: 'information integrity crisis or media narrative divergence',
      moderate: 'communication metrics showing elevated activity',
      low: 'information flow within expected range'
    },
    culture: {
      high: 'social cohesion fragmentation or identity crisis indicators',
      moderate: 'cultural sentiment showing mild tension',
      low: 'cultural indicators within expected range'
    },
    defense: {
      high: 'strategic security alerts active or threat level elevated',
      moderate: 'defense readiness indicators above baseline',
      low: 'security posture nominal'
    },
    religion: {
      high: 'symbolic systems destabilization or moral framework tension',
      moderate: 'institutional sentiment showing mild stress',
      low: 'religious and symbolic systems stable'
    },
    population: {
      high: 'demographic transition stress or migration pressure detected',
      moderate: 'population metrics showing mild deviation',
      low: 'demographic indicators within expected range'
    },
    law: {
      high: 'rule of law integrity alerts or compliance crisis',
      moderate: 'regulatory pressure above baseline',
      low: 'legal system operating normally'
    },
    finance: {
      high: 'systemic financial risk or credit stress elevated',
      moderate: 'financial markets showing mild volatility',
      low: 'financial indicators within expected range'
    },
    intelligence: {
      high: 'strategic awareness degradation or information warfare signals',
      moderate: 'intelligence metrics showing elevated activity',
      low: 'data collection operating normally'
    }
  };

  function _getStressExplanation(domainKey, stress) {
    var expl = STRESS_EXPLANATIONS[domainKey];
    if (!expl) return '';
    if (stress > 0.65) return expl.high;
    if (stress > 0.30) return expl.moderate;
    return expl.low;
  }

  // ─── Trend computation ──────────────────────────────────────────────────

  function _computeTrend(domainKey, currentStress) {
    var history = stressHistory[domainKey];
    history.push(currentStress);
    if (history.length > HISTORY_MAX) {
      history.shift();
    }

    if (history.length < 3) return 0;

    var mid = Math.floor(history.length / 2);
    var oldSum = 0;
    var newSum = 0;
    for (var i = 0; i < mid; i++) {
      oldSum += history[i];
    }
    for (var j = mid; j < history.length; j++) {
      newSum += history[j];
    }
    var oldAvg = oldSum / mid;
    var newAvg = newSum / (history.length - mid);
    var trend = Math.round((newAvg - oldAvg) * 1000) / 1000;
    return Math.max(-1, Math.min(1, trend));
  }

  // ─── Feed poll cycle ────────────────────────────────────────────────────

  function _pollFeed() {
    _fetchDomainSnapshot().then(function (data) {
      if (data && data.domains) {
        _applyFeedData(data);
      } else {
        _feedAlive = false;
        if (window.LIMENFeedState && typeof window.LIMENFeedState.ingestFail === 'function') {
          window.LIMENFeedState.ingestFail();
        }
        _fallbackUpdate();
      }
      _renderPanel();
    }).catch(function () {
      _feedAlive = false;
      if (window.LIMENFeedState && typeof window.LIMENFeedState.ingestFail === 'function') {
        window.LIMENFeedState.ingestFail();
      }
      _fallbackUpdate();
      _renderPanel();
    });
  }

  // ─── UI panel ────────────────────────────────────────────────────────────

  // Only render domain panel UI on console/analyst pages
  var _isConsolePage = (function() {
    var p = location.pathname.replace(/^\//, '').replace(/\.html$/, '');
    return p === '' || p === 'civilization' || p === 'connectome';
  })();

  var panelEl = null;

  function _ensurePanel() {
    if (!_isConsolePage) return; // no panel on non-console pages
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'limen-domain-panel';
    panelEl.style.cssText = [
      'position:fixed',
      'top:60px',
      'right:12px',
      'background:rgba(8,9,12,0.92)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:10px 14px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.50rem',
      'letter-spacing:1.5px',
      'z-index:9997',
      'border-radius:2px',
      'pointer-events:auto',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
      'line-height:1.7',
      'min-width:220px',
      'max-height:80vh',
      'overflow-y:auto',
      'display:none',
      'cursor:default'
    ].join(';');
    document.body.appendChild(panelEl);

    panelEl.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== panelEl) {
        if (target.getAttribute && target.getAttribute('data-domain')) {
          var dk = target.getAttribute('data-domain');
          if (_expandedDomain === dk) {
            _expandedDomain = null;
          } else {
            _expandedDomain = dk;
          }
          _renderPanel();
          return;
        }
        target = target.parentNode;
      }
    });
  }

  function _freshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  function _renderPanel() {
    if (!_isConsolePage) return; // data-only on non-console pages
    _ensurePanel();

    // Phase 2 Patch B — Domain Panel suppressed after Domain Health merge (commit c0d42b6d58a).
    // DOM node preserved via _ensurePanel so panel-state-manager, ui-mode-manager,
    // self-health-monitor, and self-repair-engine references keep resolving. Render
    // output, innerHTML writes, and display:block toggles are short-circuited here.
    if (panelEl) panelEl.style.display = 'none';
    return;

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.4)';
    var red = '#e85454';
    var orange = '#d4a44e';
    var green = 'rgba(90,181,160,0.8)';

    var lines = [];
    var hasVisible = false;

    var feedTag = _feedAlive
      ? '<span style="color:' + green + '"> LIVE</span>'
      : '<span style="color:' + red + '"> SIM</span>';
    lines.push('<div style="color:' + gold + ';font-size:0.55rem;margin-bottom:3px">DOMAIN STATUS' + feedTag + '</div>');

    // Cross-domain pressure alerts (reads window.LIMENCrossDomain from detector)
    var _cdActive = (typeof window !== 'undefined' && window.LIMENCrossDomain && window.LIMENCrossDomain.active) ? window.LIMENCrossDomain.active : [];
    if (_cdActive.length > 0) {
      lines.push('<div style="padding:3px 0 5px;border-bottom:1px solid rgba(201,169,78,0.08);margin-bottom:4px">');
      for (var _cdi = 0; _cdi < Math.min(_cdActive.length, 3); _cdi++) {
        var _cd = _cdActive[_cdi];
        var _cdDoms = (_cd.domains || []).join(' \u00d7 ').toUpperCase();
        var _cdStresses = (_cd.stresses || []).map(function(s) { return s.toFixed(2); }).join(' \u00b7 ');
        var _cdColor = _cd.severity > 0.65 ? red : orange;
        lines.push(
          '<div style="font-size:0.38rem;letter-spacing:0.5px;padding:1px 0;color:' + _cdColor + '">' +
          '\u26A1 ' + _cdDoms + ' \u2014 ' + _cdStresses +
          '<span style="color:rgba(200,195,184,0.35);margin-left:4px">' + (_cd.pattern || '') + '</span>' +
          '</div>'
        );
      }
      lines.push('</div>');
    }

    var displayNames = {
      economy: 'ECONOMY',
      energy: 'ENERGY',
      environment: 'ENVIRON',
      health: 'HEALTH',
      technology: 'TECH',
      research: 'RESEARCH',
      supplyChain: 'SUPPLY',
      governance: 'GOV',
      infrastructure: 'INFRA',
      agriculture: 'AGRI',
      industry: 'INDUST',
      education: 'EDU',
      communication: 'COMM',
      culture: 'CULT',
      defense: 'DEF',
      religion: 'RELIG',
      population: 'POP',
      law: 'LAW',
      finance: 'FIN',
      intelligence: 'INTEL'
    };

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (d.stress < 0.05) continue;
      hasVisible = true;

      var pct = Math.round(d.stress * 100);
      var barLen = Math.round(d.stress * 8);
      var bar = '';
      for (var b = 0; b < barLen; b++) bar += '\u2588';

      var barColor = teal;
      if (d.stress > 0.65) barColor = red;
      else if (d.stress > 0.40) barColor = orange;

      var trendArrow = '';
      if (d.trend > 0.03) trendArrow = ' \u2191';
      else if (d.trend < -0.03) trendArrow = ' \u2193';

      var audit = _sourceAudit[k] || {};
      var statusLabel = audit.status || 'FALLBACK';
      var statusColor = green;
      if (statusLabel === 'PARTIAL') statusColor = orange;
      else if (statusLabel === 'FALLBACK') statusColor = red;

      var name = displayNames[k] || k.toUpperCase();
      while (name.length < 8) name += ' ';

      // Balance state indicator
      var balData = (window.LIMENBalance && window.LIMENBalance[k]) || null;
      var balTag = '';
      if (balData) {
        if (balData.state === 'improving') balTag = '<span style="color:' + green + ';font-size:0.38rem;margin-left:3px">\u2191BAL</span>';
        else if (balData.state === 'destabilizing') balTag = '<span style="color:' + red + ';font-size:0.38rem;margin-left:3px">\u2193BAL</span>';
      }

      var freshText = _freshness(d.updated);
      var confShort = d.confidence >= 0.8 ? 'H' : (d.confidence >= 0.4 ? 'M' : 'L');

      // Map signal-engine domain keys to portal domain IDs
      var _portalDomainMap = {health:'medicine',research:'science',supplyChain:'trade',agriculture:'p2_agri'};
      var portalDomain = _portalDomainMap[k] || k;
      var portalLink = '<a href="/portal?domain=' + encodeURIComponent(portalDomain) + '" ' +
        'onclick="event.stopPropagation()" ' +
        'style="color:rgba(201,169,78,0.5);font-size:0.36rem;letter-spacing:1px;text-decoration:none;margin-left:4px" ' +
        'onmouseover="this.style.color=\'rgba(201,169,78,0.9)\'" onmouseout="this.style.color=\'rgba(201,169,78,0.5)\'"' +
        '>\u25B8</a>';

      lines.push(
        '<div data-domain="' + k + '" style="cursor:pointer;padding:1px 0">' +
        '<span style="color:' + dim + '">' + name + '</span>' +
        '<span style="color:' + barColor + '">' + bar + '</span>' +
        '<span style="color:' + dim + '"> ' + pct + '%' + trendArrow + '</span>' +
        '<span style="color:' + statusColor + ';font-size:0.40rem;margin-left:4px">' + statusLabel + '</span>' +
        '<span style="color:' + dim + ';font-size:0.38rem;margin-left:3px">' + confShort + '</span>' +
        balTag +
        portalLink +
        '<br><span style="color:rgba(200,195,184,0.25);font-size:0.36rem;margin-left:8px">' + freshText + '</span>' +
        '</div>'
      );

      if (_expandedDomain === k) {
        lines.push(_buildDetailHTML(k, d));
      }
    }

    // Refresh promotion data before rendering strip
    _promoteToCivilization();

    // Top Actions strip (reads from promotion contract only)
    var _civActions = (window.LIMENCivilizationActions && window.LIMENCivilizationActions.actions) ? window.LIMENCivilizationActions.actions : [];
    if (_civActions.length > 0) {
      var _classIcon = { escalate: '\u26A0', interpret: '\u25C9', observe: '\u25CB', act: '\u25CF' };
      var _showN = Math.min(_civActions.length, 3);
      lines.push('<div style="border-top:1px solid rgba(201,169,78,0.08);padding-top:4px;margin-top:4px">');
      lines.push('<div style="color:' + gold + ';font-size:0.42rem;letter-spacing:1.5px;margin-bottom:2px">TOP ACTIONS</div>');
      for (var _tai = 0; _tai < _showN; _tai++) {
        var _ta = _civActions[_tai];
        var _icon = _classIcon[_ta.action_class] || '\u25CB';
        var _domTag = (_ta.domain || '').slice(0, 6).toUpperCase();
        var _staleTag = _ta.stale ? '<span style="opacity:0.4"> (stale)</span>' : '';
        var _drillUrl = (_ta.drill_target && _ta.drill_target.url) ? _ta.drill_target.url : '#';
        lines.push(
          '<div style="font-size:0.38rem;padding:1px 0;display:flex;align-items:baseline;gap:4px">' +
          '<span style="color:rgba(200,195,184,0.3)">' + _icon + '</span>' +
          '<span style="color:rgba(201,169,78,0.5)">' + _domTag + '</span>' +
          '<span style="color:rgba(200,195,184,0.5);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (_ta.title || '') + _staleTag + '</span>' +
          '<a href="' + _drillUrl + '" onclick="event.stopPropagation()" ' +
          'style="color:rgba(201,169,78,0.4);text-decoration:none;font-size:0.36rem" ' +
          'onmouseover="this.style.color=\'rgba(201,169,78,0.9)\'" onmouseout="this.style.color=\'rgba(201,169,78,0.4)\'"' +
          '>\u25B8</a>' +
          '</div>'
        );
      }
      lines.push('</div>');
    }

    if (!hasVisible) {
      panelEl.style.display = 'none';
      return;
    }

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-domain-panel')) {
      return;
    }
    panelEl.style.display = 'block';
    panelEl.innerHTML = lines.join('');
  }

  function _buildDetailHTML(domainKey, d) {
    var dimmer = 'rgba(200,195,184,0.3)';
    var teal = '#5ab5a0';
    var goldDim = 'rgba(201,169,78,0.5)';
    var red = '#e85454';
    var orange = '#d4a44e';
    var green = 'rgba(90,181,160,0.8)';
    var sectionLabel = 'rgba(201,169,78,0.35)';
    var html = '<div style="margin:4px 0 6px 12px;border-left:1px solid rgba(201,169,78,0.12);padding-left:8px">';

    // Sources section
    var sources = d.sources || [];
    for (var s = 0; s < sources.length; s++) {
      var src = sources[s];
      var liveColor = src.live ? teal : red;
      var liveTag = src.live ? 'LIVE' : 'OFFLINE';
      var freshText = _freshness(src.updated);
      html += '<div style="color:' + dimmer + ';margin-bottom:2px">';
      html += 'Source ' + String.fromCharCode(65 + s) + ': ';
      html += '<span style="color:' + goldDim + '">' + src.name + '</span>';
      html += ' \u2014 <span style="color:' + liveColor + '">' + liveTag + '</span>';
      html += ' \u2014 updated ' + freshText;
      html += '</div>';
    }

    // Raw indicators section
    var hasRaw = false;
    for (var r = 0; r < sources.length; r++) {
      if (sources[r].label && sources[r].live) { hasRaw = true; break; }
    }
    if (hasRaw) {
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Raw indicators:</div>';
      for (var v = 0; v < sources.length; v++) {
        if (sources[v].label && sources[v].live) {
          html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + sources[v].label + '</div>';
        }
      }
    }

    // Computed section
    var confLabel = 'low';
    if (d.confidence >= 0.8) confLabel = 'high';
    else if (d.confidence >= 0.4) confLabel = 'moderate';
    // Data type label
    var dataType = 'inferred from raw feed data';
    var dtColor = teal;
    if (confLabel === 'low') {
      dataType = 'heuristic fallback';
      dtColor = red;
    } else if (confLabel === 'moderate') {
      dataType = 'mixed live + fallback';
      dtColor = orange;
    }
    html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Computed:</div>';
    html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + domainKey + ' stress: ' + d.stress.toFixed(2) + '</div>';
    html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 confidence: ' + confLabel + '</div>';
    html += '<div style="color:' + dtColor + ';padding-left:6px;font-size:0.42rem">\u2022 type: ' + dataType + '</div>';

    // Balance section (from balance-meter.js)
    var bal = (window.LIMENBalance && window.LIMENBalance[domainKey]) || null;
    if (bal) {
      var balColor = dimmer;
      var balLabel = 'neutral';
      if (bal.state === 'improving') { balColor = green; balLabel = 'improving'; }
      else if (bal.state === 'destabilizing') { balColor = red; balLabel = 'destabilizing'; }
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Balance:</div>';
      html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 destabilizing: ' + bal.destabilizing.toFixed(2) + '</div>';
      html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 stabilizing: ' + bal.stabilizing.toFixed(2) + '</div>';
      html += '<div style="color:' + balColor + ';padding-left:6px;font-size:0.42rem">\u2022 net: ' + (bal.net > 0 ? '+' : '') + bal.net.toFixed(2) + ' (' + balLabel + ')</div>';
    }

    // Why elevated section
    var explanation = _getStressExplanation(domainKey, d.stress);
    if (d.stress > 0.15 && explanation) {
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Why elevated:</div>';
      html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + explanation + '</div>';
    }

    // Signals from API
    var signals = d.signals || [];
    if (signals.length > 0) {
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Signals:</div>';
      for (var g = 0; g < signals.length; g++) {
        html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + signals[g] + '</div>';
      }
    }

    // Report polarity section (from report-polarity-engine.js)
    var pol = (window.LIMENPolarity && window.LIMENPolarity[domainKey]) || null;
    if (pol && pol.polarity !== 'uncertain') {
      var toneColor = dimmer;
      if (pol.polarity === 'positive') toneColor = green;
      else if (pol.polarity === 'negative') toneColor = red;
      else if (pol.polarity === 'mixed') toneColor = orange;
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Report tone:</div>';
      html += '<div style="color:' + toneColor + ';padding-left:6px;font-size:0.42rem">\u2022 ' + pol.polarity + ' (net ' + (pol.netTone > 0 ? '+' : '') + pol.netTone.toFixed(2) + ')</div>';
      if (pol.recentPositive.length > 0) {
        html += '<div style="color:' + green + ';padding-left:6px;font-size:0.42rem">+ ' + pol.recentPositive[0] + '</div>';
      }
      if (pol.recentNegative.length > 0) {
        html += '<div style="color:' + red + ';padding-left:6px;font-size:0.42rem">- ' + pol.recentNegative[0] + '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  // ─── Civilization Action Promotion ────────────────────────────────────────
  // Transforms portal-level recommendedTreatments into civilization-safe
  // action contracts. Does NOT render UI — produces a normalized array.
  //
  // Tight gates: evidence >= A-, type must be DIAGNOSTIC/MONITORING/analysis,
  // domain must be stressed or under cross-domain pressure,
  // confidence_composite >= 0.25, max 2 per domain, max 10 total.

  var _PORTAL_DOMAIN_MAP = {health:'medicine',research:'science',supplyChain:'trade',agriculture:'p2_agri'};
  var _EV_SCORE = {'Strong':1.0,'A':1.0,'A-':0.9,'B+':0.7,'Moderate':0.5,'B':0.5,'B-':0.3,'C+':0.1,'C':0,'Limited':0,'None':0};

  var _TYPE_MAP = {
    'MONITORING': { action_class: 'observe', action_type: 'monitor' },
    'monitoring': { action_class: 'observe', action_type: 'monitor' },
    'DIAGNOSTIC': { action_class: 'interpret', action_type: 'investigate' },
    'diagnostic': { action_class: 'interpret', action_type: 'investigate' },
    'analysis':   { action_class: 'interpret', action_type: 'investigate' },
    'ANALYSIS':   { action_class: 'interpret', action_type: 'investigate' }
  };

  var _PROMO_MAX_PER_DOMAIN = 2;
  var _PROMO_MAX_TOTAL = 10;
  var _PROMO_CONF_THRESHOLD = 0.25;
  var _PROMO_EV_MIN = 0.7; // requires A- or better (0.9) or B+ (0.7) — excludes Moderate/B

  function _promoteToCivilization() {
    var ar = window.LIMENAnalystReport;
    var cdState = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) ? window.LIMENCrossDomain.active : [];
    var now = Date.now();

    if (!ar || !ar.domains || ar.domains.length === 0) {
      window.LIMENCivilizationActions = { actions: [], generated_at: now };
      return [];
    }

    // Domains under cross-domain pressure
    var cdDomains = {};
    for (var ci = 0; ci < cdState.length; ci++) {
      var cds = cdState[ci].domains || [];
      for (var cj = 0; cj < cds.length; cj++) cdDomains[cds[cj]] = cdState[ci].pattern || 'cross-domain';
    }

    // Phase 1: collect candidates per domain (pre-capped)
    var candidates = []; // {action, sortKey}

    for (var di = 0; di < ar.domains.length; di++) {
      var dom = ar.domains[di];
      var txs = dom.recommendedTreatments;
      if (!txs || !Array.isArray(txs)) continue;

      var stress = dom.stress || 0;
      var confidence = dom.confidence || 0;
      var rk = dom.runtimeKey || dom.domainId || '';
      var portalDomain = _PORTAL_DOMAIN_MAP[rk] || rk;
      var hasCDPressure = !!cdDomains[rk];

      // ── Domain-level gate: must be stressed OR under cross-domain pressure
      if (stress < 0.40 && !hasCDPressure) continue;

      // Freshness
      var liveData = domains[rk];
      var freshnessFactor = 1.0;
      if (liveData && liveData.updated) {
        var age = now - liveData.updated;
        if (age > 180000) freshnessFactor = 0.3;
        else if (age > 60000) freshnessFactor = 0.8;
      } else {
        freshnessFactor = 0.3;
      }
      var isStale = freshnessFactor < 0.5;

      // Collect this domain's promotable treatments, score them
      var domCandidates = [];

      for (var ti = 0; ti < txs.length; ti++) {
        var tx = txs[ti];
        if (!tx.title) continue;

        var evScore = _EV_SCORE[tx.evidence] !== undefined ? _EV_SCORE[tx.evidence] : 0;
        if (evScore < _PROMO_EV_MIN) continue; // B+/A-/A/Strong only

        var mapped = _TYPE_MAP[tx.type || ''];
        if (!mapped) continue;

        var confComposite = evScore * Math.max(confidence, 0.1) * freshnessFactor;
        if (confComposite < _PROMO_CONF_THRESHOLD) continue;

        // Promotion reason
        var reason = 'high_evidence';
        if (stress >= 0.65 && hasCDPressure) reason = 'cross_domain_distressed';
        else if (stress >= 0.65) reason = 'domain_distressed';
        else if (hasCDPressure) reason = 'cross_domain_pressure';
        else if (stress >= 0.40) reason = 'domain_elevated';

        // Action class (escalate upgrade for severe convergence)
        var actionClass = mapped.action_class;
        var actionType = mapped.action_type;
        if (stress >= 0.65 && evScore >= 0.9 && hasCDPressure) {
          actionClass = 'escalate';
          actionType = 'escalate';
        }

        domCandidates.push({
          id: tx.id || (rk + '_tx_' + ti),
          title: tx.title,
          action_class: actionClass,
          action_type: actionType,
          domain: dom.label || rk,
          domainId: rk,
          stress: stress,
          evidence: tx.evidence || '',
          confidence_composite: Math.round(confComposite * 1000) / 1000,
          promotion_reason: reason,
          stale: isStale,
          drill_target: { type: 'portal', domainId: portalDomain, url: '/portal?domain=' + encodeURIComponent(portalDomain) },
          promoted_at: now
        });
      }

      // Phase 2: per-domain dedup — keep only strongest representative per title prefix
      // (treatments like "X assessment" and "Y assessment" cluster on "assessment")
      domCandidates.sort(function(a, b) { return b.confidence_composite - a.confidence_composite; });
      var seen = {};
      var kept = [];
      for (var ki = 0; ki < domCandidates.length && kept.length < _PROMO_MAX_PER_DOMAIN; ki++) {
        // Cluster key: first 3 significant words of title
        var words = domCandidates[ki].title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(function(w) { return w.length > 2; });
        var clusterKey = words.slice(0, 3).sort().join('_');
        if (seen[clusterKey]) continue;
        seen[clusterKey] = true;
        kept.push(domCandidates[ki]);
      }

      for (var kj = 0; kj < kept.length; kj++) candidates.push(kept[kj]);
    }

    // Phase 3: global sort
    // Priority: cross-domain distressed > distressed > cross-domain > elevated > high_evidence
    // Within same priority: confidence_composite descending
    var reasonOrder = { cross_domain_distressed: 0, domain_distressed: 1, cross_domain_pressure: 2, domain_elevated: 3, high_evidence: 4 };
    var classOrder = { escalate: 0, act: 1, interpret: 2, observe: 3 };

    candidates.sort(function(a, b) {
      var ra = reasonOrder[a.promotion_reason] !== undefined ? reasonOrder[a.promotion_reason] : 9;
      var rb = reasonOrder[b.promotion_reason] !== undefined ? reasonOrder[b.promotion_reason] : 9;
      if (ra !== rb) return ra - rb;
      var ca = classOrder[a.action_class] !== undefined ? classOrder[a.action_class] : 9;
      var cb = classOrder[b.action_class] !== undefined ? classOrder[b.action_class] : 9;
      if (ca !== cb) return ca - cb;
      return b.confidence_composite - a.confidence_composite;
    });

    // Phase 4: global cap
    var promoted = candidates.slice(0, _PROMO_MAX_TOTAL);

    window.LIMENCivilizationActions = { actions: promoted, generated_at: now };
    return promoted;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    if (_feedInterval) return;

    _pollFeed();

    _feedInterval = setInterval(function () {
      if (!document.hidden) _pollFeed();
    }, FEED_POLL_MS);

    _uiInterval = setInterval(function () {
      if (!document.hidden) _renderPanel();
    }, UI_REFRESH_MS);
  }

  function stop() {
    if (_feedInterval) {
      clearInterval(_feedInterval);
      _feedInterval = null;
    }
    if (_uiInterval) {
      clearInterval(_uiInterval);
      _uiInterval = null;
    }
  }

  function reset() {
    _initDomains();
    _lastFeedData = null;
    _feedAlive = false;
    _expandedDomain = null;
    window.LIMENDomains = domains;
    if (panelEl) panelEl.style.display = 'none';
  }

  function update() {
    _pollFeed();
  }

  function getDomains() {
    var copy = {};
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      copy[k] = {
        stress: domains[k].stress,
        trend: domains[k].trend,
        signals: domains[k].signals.slice(),
        updated: domains[k].updated,
        sources: domains[k].sources,
        confidence: domains[k].confidence
      };
    }
    return copy;
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENDomains = domains;
  window.LIMENSourceAudit = _sourceAudit;

  window.LIMENDomainEngine = {
    start: start,
    stop: stop,
    reset: reset,
    update: update,
    getDomains: getDomains
  };

})();
