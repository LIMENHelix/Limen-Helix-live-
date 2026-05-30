/**
 * LIMEN Simulation Engine — Phase 12 (Honest Forecast Infrastructure)
 *
 * Three real capabilities:
 *   1. Baseline trajectory extrapolation from observed history
 *   2. Connectome propagation simulation from stress seeds
 *   3. Plan comparison scaffolding with sparse-data honesty
 *
 * Does NOT pretend to predict intervention outcomes the data cannot support.
 * Confidence is constrained by actual evidence depth.
 *
 * Exposes: window.LIMENSimulation
 *
 * Events emitted:
 *   limen:simulation-created    { simulationId, domain, type, confidence, trigger }
 *   limen:forecast-memory-updated { key, factor, samples }
 *
 * Reads from (does not modify):
 *   window.LIMENDomains         — current stress
 *   window.LIMENLongMemory      — daily history, baselines, regimes
 *   window.LIMENExecutive       — plan memory, active intents
 *   window.LIMENPropagation     — connectome activation (if available)
 *   localStorage:limen_stress_history       — short-term 5-min snapshots
 *   localStorage:limen_stress_history_long  — daily snapshots
 *
 * Owned storage keys (writes limited to these three):
 *   limen_simulations       — recent simulation results (max 50)
 *   limen_forecast_memory   — bounded accuracy tracking
 *   limen_simulation_audit  — meta counters
 */
(function () {
  'use strict';

  var SIM_KEY = 'limen_simulations';
  var FORECAST_MEM_KEY = 'limen_forecast_memory';
  var SIM_AUDIT_KEY = 'limen_simulation_audit';

  var MAX_SIMULATIONS = 50;
  var MIN_INTRADAY_FOR_FORECAST = 6;   // 30 min of 5-min snapshots
  var MIN_DAILY_FOR_FORECAST = 3;
  var MIN_DAILY_FOR_WEEKLY = 7;
  var MIN_SAMPLES_FOR_NUMERICAL = 5;   // plan-memory samples before showing numbers
  var EVENT_VERSION = 1;

  // Bounded learning constants (same family as pathway/plan weights)
  var OUTCOME_SCORE = { HIT: 1.0, PARTIAL: 0.5, MISS: 0.0 };
  var MIN_SAMPLES_FOR_EFFECT = 3;

  // ── Helpers ──

  function _emit(eventName, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      detail.eventVersion = EVENT_VERSION;
      detail.timestamp = Date.now();
      window.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
    }
  }

  function _uid() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  }

  function _getStore(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (e) { return fallback; }
  }

  function _linReg(values) {
    if (values.length < 2) return { slope: 0, r2: 0 };
    var n = values.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (var i = 0; i < n; i++) {
      sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i; sumY2 += values[i] * values[i];
    }
    var denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, r2: 0 };
    var slope = (n * sumXY - sumX * sumY) / denom;
    // R-squared
    var meanY = sumY / n;
    var ssTot = 0, ssRes = 0;
    for (var j = 0; j < n; j++) {
      var predicted = meanY + slope * (j - (n - 1) / 2);
      ssRes += (values[j] - predicted) * (values[j] - predicted);
      ssTot += (values[j] - meanY) * (values[j] - meanY);
    }
    var r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
    return { slope: Math.round(slope * 100000) / 100000, r2: Math.round(r2 * 100) / 100 };
  }

  function _computeFactor(bucket) {
    if (!bucket || bucket.samples === 0) return 1.0;
    var avg = bucket.weightedSum / bucket.samples;
    return Math.round((0.8 + avg * 0.4) * 100) / 100;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 1: BASELINE FORECAST
  // ══════════════════════════════════════════════════════════════════════

  function forecastBaseline(domain, options) {
    options = options || {};
    var domains = window.LIMENDomains || {};
    var currentStress = (domains[domain] && domains[domain].stress) || 0;

    // Gather intraday data (short-term 5-min snapshots)
    var stHistory = _getStore('limen_stress_history', { snapshots: [] });
    var intradayValues = [];
    for (var si = 0; si < stHistory.snapshots.length; si++) {
      var snap = stHistory.snapshots[si];
      if (snap.d && snap.d[domain] !== undefined) intradayValues.push(snap.d[domain]);
    }

    // Gather daily data (long-term memory)
    var longMem = window.LIMENLongMemory;
    var dailyValues = [];
    if (longMem && longMem.getHistory) {
      var dailyHistory = longMem.getHistory(365);
      for (var di = 0; di < dailyHistory.length; di++) {
        if (dailyHistory[di].domains && dailyHistory[di].domains[domain] !== undefined) {
          dailyValues.push(dailyHistory[di].domains[domain]);
        }
      }
    }

    // Compute slopes
    var slopeShort = null, slopeDaily = null;
    var r2Short = 0, r2Daily = 0;
    if (intradayValues.length >= MIN_INTRADAY_FOR_FORECAST) {
      var regShort = _linReg(intradayValues.slice(-24)); // last 2 hours max
      slopeShort = regShort.slope;
      r2Short = regShort.r2;
    }
    if (dailyValues.length >= MIN_DAILY_FOR_FORECAST) {
      var regDaily = _linReg(dailyValues);
      slopeDaily = regDaily.slope;
      r2Daily = regDaily.r2;
    }

    // Determine supported horizon
    var horizonSupported = 'insufficient';
    if (dailyValues.length >= MIN_DAILY_FOR_WEEKLY) horizonSupported = '7d';
    else if (dailyValues.length >= MIN_DAILY_FOR_FORECAST) horizonSupported = '3d';
    else if (intradayValues.length >= MIN_INTRADAY_FOR_FORECAST) horizonSupported = 'intraday';

    // Direction from best available slope
    var bestSlope = slopeDaily !== null ? slopeDaily : slopeShort;
    var direction = 'FLAT';
    if (bestSlope !== null) {
      direction = Math.abs(bestSlope) < 0.003 ? 'FLAT' : (bestSlope > 0 ? 'UP' : 'DOWN');
    }
    var magnitude = bestSlope !== null ? Math.round(Math.abs(bestSlope) * 1000) / 1000 : 0;

    // Confidence: multi-factor
    var confidence = 0;
    var confidenceReason = [];
    // History depth
    if (dailyValues.length >= 14) { confidence += 0.25; }
    else if (dailyValues.length >= 7) { confidence += 0.15; }
    else if (dailyValues.length >= 3) { confidence += 0.08; }
    else { confidenceReason.push('LOW_DAILY_HISTORY'); }
    // Intraday depth
    if (intradayValues.length >= 24) { confidence += 0.15; }
    else if (intradayValues.length >= 6) { confidence += 0.08; }
    else { confidenceReason.push('LOW_INTRADAY_HISTORY'); }
    // Model fit (R-squared)
    var bestR2 = Math.max(r2Short || 0, r2Daily || 0);
    confidence += bestR2 * 0.3;
    if (bestR2 < 0.3) confidenceReason.push('POOR_MODEL_FIT');
    // Signal agreement (intraday and daily agree on direction)
    if (slopeShort !== null && slopeDaily !== null) {
      if ((slopeShort > 0) === (slopeDaily > 0)) { confidence += 0.15; }
      else { confidence -= 0.1; confidenceReason.push('DIRECTION_DISAGREEMENT'); }
    }
    // Forecast memory calibration
    var fmem = _getForecastMemory('baseline::' + domain);
    if (fmem && fmem.samples >= MIN_SAMPLES_FOR_EFFECT) {
      confidence *= fmem.factor;
    }
    confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;

    // Label
    var label = 'INSUFFICIENT_DATA';
    if (horizonSupported !== 'insufficient') {
      label = confidence >= 0.5 ? 'FORECAST' : 'TRAJECTORY_HINT';
    }

    var evidenceLevel = confidence >= 0.6 ? 'MODERATE' : (confidence >= 0.3 ? 'LOW' : 'NONE');

    var result = {
      id: 'sim_baseline_' + _uid(),
      type: 'BASELINE_FORECAST',
      domain: domain,
      horizonSupported: horizonSupported,
      currentStress: currentStress,
      slopeShort: slopeShort,
      slopeDaily: slopeDaily,
      r2Short: r2Short,
      r2Daily: r2Daily,
      projectedDirection: direction,
      projectedMagnitude: magnitude,
      confidence: confidence,
      confidenceReason: confidenceReason,
      evidenceLevel: evidenceLevel,
      label: label,
      intradaySamples: intradayValues.length,
      dailySamples: dailyValues.length,
      createdAt: Date.now()
    };

    _storeSim(result);
    _emit('limen:simulation-created', {
      simulationId: result.id, domain: domain, type: 'BASELINE_FORECAST',
      confidence: confidence, trigger: 'forecastBaseline'
    });

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 2: CONNECTOME PROPAGATION SIMULATION
  // ══════════════════════════════════════════════════════════════════════

  // Domain → primary connectome node IDs (numeric, from connectome-weights.json)
  var DOMAIN_SEED_NODES = {
    energy: [60, 61, 42],      // THAL, dlPFC, BLA mapped to numeric
    health: [91, 55, 54],      // NTS, AI, HIPP
    finance: [42, 43, 44],     // BLA, vmPFC, NAcc
    technology: [61, 60, 62],  // dlPFC, THAL, BDNF
    defense: [42, 63, 64],     // BLA, PAG, dACC
    environment: [91, 60, 55], // NTS, THAL, AI
    education: [54, 65, 66],   // HIPP, PCC, DMN
    governance: [61, 64, 43],  // dlPFC, dACC, mPFC
    industry: [60, 61, 67],    // THAL, dlPFC, GP
    trade: [60, 61, 44]        // THAL, dlPFC, NAcc
  };

  // Reverse map: node ID → domain(s)
  var NODE_TO_DOMAIN = {};
  (function () {
    for (var d in DOMAIN_SEED_NODES) {
      var nodes = DOMAIN_SEED_NODES[d];
      for (var i = 0; i < nodes.length; i++) {
        if (!NODE_TO_DOMAIN[nodes[i]]) NODE_TO_DOMAIN[nodes[i]] = [];
        if (NODE_TO_DOMAIN[nodes[i]].indexOf(d) === -1) NODE_TO_DOMAIN[nodes[i]].push(d);
      }
    }
  })();

  function simulatePropagation(seedDomains, options) {
    options = options || {};
    var steps = options.steps || 3;
    var intensity = options.intensity || null;
    var domains = window.LIMENDomains || {};

    // Build seed activations from domain stress
    var seeds = {};
    for (var si = 0; si < seedDomains.length; si++) {
      var sd = seedDomains[si];
      var nodes = DOMAIN_SEED_NODES[sd];
      if (!nodes) continue;
      var stress = intensity || (domains[sd] && domains[sd].stress) || 0.5;
      for (var ni = 0; ni < nodes.length; ni++) {
        seeds[nodes[ni]] = Math.max(seeds[nodes[ni]] || 0, stress);
      }
    }

    // Use real propagation engine if available
    var propagation = window.LIMENPropagation;
    var activations = {};
    var usedReal = false;

    if (propagation && propagation.activate) {
      try {
        var result = propagation.activate(seeds, null, steps);
        activations = result.activations || {};
        usedReal = true;
      } catch (e) {
        // Fall through to topology-only estimate
      }
    }

    // If propagation engine unavailable, use topology-based estimate
    if (!usedReal) {
      // Simple: seed nodes activate at full, their mapped domains get proportional pressure
      for (var nodeId in seeds) {
        activations[nodeId] = seeds[nodeId];
      }
    }

    // Map activations back to domains
    var domainPressure = {};
    for (var nid in activations) {
      var act = activations[nid];
      if (act < 0.05) continue; // silence threshold
      var mappedDomains = NODE_TO_DOMAIN[nid] || [];
      for (var mi = 0; mi < mappedDomains.length; mi++) {
        var md = mappedDomains[mi];
        if (seedDomains.indexOf(md) !== -1) continue; // skip seed domains
        domainPressure[md] = Math.max(domainPressure[md] || 0, act);
      }
    }

    // Sort downstream by pressure
    var downstream = [];
    for (var dp in domainPressure) {
      downstream.push({ domain: dp, pressure: Math.round(domainPressure[dp] * 1000) / 1000 });
    }
    downstream.sort(function (a, b) { return b.pressure - a.pressure; });

    // Confidence: topology is real, but node-to-domain mapping is approximate
    var confidence = usedReal ? 0.74 : 0.45;
    var confidenceReason = usedReal ? ['TOPOLOGY_GROUNDED'] : ['TOPOLOGY_ESTIMATE_ONLY'];
    if (seedDomains.length > 3) { confidence -= 0.1; confidenceReason.push('MANY_SEEDS'); }

    var sim = {
      id: 'sim_prop_' + _uid(),
      type: 'PROPAGATION_SIMULATION',
      seedDomains: seedDomains,
      steps: steps,
      intensity: intensity,
      downstream: downstream.slice(0, 10),
      totalActivatedNodes: Object.keys(activations).filter(function (k) { return activations[k] > 0.05; }).length,
      usedRealPropagation: usedReal,
      confidence: Math.round(confidence * 100) / 100,
      confidenceReason: confidenceReason,
      evidenceLevel: usedReal ? 'MODERATE' : 'LOW',
      createdAt: Date.now()
    };

    _storeSim(sim);
    _emit('limen:simulation-created', {
      simulationId: sim.id, domain: seedDomains[0] || '', type: 'PROPAGATION_SIMULATION',
      confidence: sim.confidence, trigger: 'simulatePropagation'
    });

    return sim;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 3: CANDIDATE PLAN COMPARISON (scaffold, low-authority)
  // ══════════════════════════════════════════════════════════════════════

  function compareCandidatePlans(plans, context) {
    context = context || {};
    var domain = context.domain || '';
    var exec = window.LIMENExecutive;

    var scored = plans.map(function (plan) {
      var score = 0;
      var evidenceLevel = 'NONE';
      var riskFlags = [];
      var fitLabel = 'UNRANKED';

      // Factor 1: pathway grounding (does plan target grounded nodes?)
      var grounded = !!DOMAIN_SEED_NODES[domain];
      if (grounded) { score += 0.25; }
      else { riskFlags.push('UNGROUNDED_PATHWAY'); }

      // Factor 2: regime alignment (does plan match current regime?)
      var longMem = window.LIMENLongMemory;
      if (longMem && longMem.getRegime) {
        var regime = longMem.getRegime(domain, 30);
        if (plan.strategyType === 'stabilization' && (regime === 'EXTREME' || regime === 'ELEVATED')) {
          score += 0.20; fitLabel = 'BETTER_ALIGNMENT';
        } else if (plan.strategyType === 'opportunity_capture' && regime === 'NORMAL') {
          score += 0.15; fitLabel = 'BETTER_ALIGNMENT';
        } else if (regime === 'INSUFFICIENT_DATA') {
          riskFlags.push('REGIME_UNKNOWN');
        } else {
          score += 0.05; fitLabel = 'NEUTRAL_FIT';
        }
      } else {
        riskFlags.push('NO_LONG_MEMORY');
      }

      // Factor 3: propagation containment (does plan address high-propagation domain?)
      var propSim = simulatePropagation([domain], { steps: 2 });
      var containment = propSim.downstream.length > 0 ? Math.min(0.2, propSim.downstream[0].pressure * 0.3) : 0;
      score += containment;
      if (propSim.downstream.length > 3) {
        fitLabel = fitLabel === 'BETTER_ALIGNMENT' ? 'BETTER_CONTAINMENT' : fitLabel;
        score += 0.05;
      }

      // Factor 4: plan-memory factor (if available)
      if (exec && exec.getPlanConfidence) {
        var planConf = exec.getPlanConfidence(plan.strategyType, domain, context.regime);
        if (planConf.samples >= MIN_SAMPLES_FOR_NUMERICAL) {
          score *= planConf.factor;
          evidenceLevel = planConf.confidence === 'HIGH' ? 'MODERATE' : 'LOW';
        } else {
          riskFlags.push('LOW_PLAN_SAMPLES');
          evidenceLevel = 'NONE';
        }
      } else {
        riskFlags.push('NO_EXECUTIVE_DATA');
        evidenceLevel = 'NONE';
      }

      // No causal model flag
      riskFlags.push('NO_CAUSAL_MODEL');

      var confidence = Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;

      return {
        id: plan.id || plan.strategyType,
        strategyType: plan.strategyType,
        rank: 0,
        fitLabel: fitLabel || 'NEUTRAL_FIT',
        confidence: confidence,
        evidenceLevel: evidenceLevel,
        riskFlags: riskFlags,
        score: score
      };
    });

    // Rank
    scored.sort(function (a, b) { return b.score - a.score; });
    for (var ri = 0; ri < scored.length; ri++) {
      scored[ri].rank = ri + 1;
      delete scored[ri].score; // internal only
    }

    var winner = scored.length > 0 ? scored[0].id : null;
    var sim = {
      id: 'sim_compare_' + _uid(),
      type: 'PLAN_COMPARISON',
      domain: domain,
      plans: scored,
      winner: winner,
      summary: 'Ranked by contextual fit and containment, not proven impact.',
      evidenceLevel: scored.length > 0 ? scored[0].evidenceLevel : 'NONE',
      createdAt: Date.now()
    };

    _storeSim(sim);
    return sim;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 4: FORECAST MEMORY
  // ══════════════════════════════════════════════════════════════════════

  function _getForecastMemory(key) {
    var mem = _getStore(FORECAST_MEM_KEY, {});
    return key ? (mem[key] || null) : mem;
  }

  function recordForecastOutcome(input) {
    // input: { simulationId, domain, type, predictedDirection, actualDirection, predictedMagnitude, actualMagnitude }
    var mem = _getStore(FORECAST_MEM_KEY, {});
    var key = (input.type || 'baseline') + '::' + (input.domain || 'unknown');

    if (!mem[key]) {
      mem[key] = { samples: 0, weightedSum: 0, factor: 1.0, avgAbsError: 0, directionHitRate: 0, totalAbsError: 0, directionHits: 0, lastUpdatedAt: 0 };
    }

    var entry = mem[key];

    // Direction hit
    var dirHit = input.predictedDirection === input.actualDirection;
    entry.directionHits = (entry.directionHits || 0) + (dirHit ? 1 : 0);

    // Magnitude error
    var absError = Math.abs((input.predictedMagnitude || 0) - (input.actualMagnitude || 0));
    entry.totalAbsError = (entry.totalAbsError || 0) + absError;

    // Outcome score for bounded learning
    var score = dirHit ? (absError < 0.1 ? 1.0 : 0.5) : 0.0;
    entry.samples++;
    entry.weightedSum += score;

    // Derived
    entry.factor = _computeFactor(entry);
    entry.avgAbsError = Math.round(entry.totalAbsError / entry.samples * 1000) / 1000;
    entry.directionHitRate = Math.round(entry.directionHits / entry.samples * 100) / 100;
    entry.lastUpdatedAt = Date.now();

    // Low-sample attenuation for factor
    if (entry.samples < MIN_SAMPLES_FOR_EFFECT) {
      entry.factor = Math.round((1.0 + (entry.factor - 1.0) * (entry.samples / MIN_SAMPLES_FOR_EFFECT)) * 100) / 100;
    }
    entry.factor = Math.max(0.8, Math.min(1.2, entry.factor));

    localStorage.setItem(FORECAST_MEM_KEY, JSON.stringify(mem));

    _emit('limen:forecast-memory-updated', {
      key: key, factor: entry.factor, samples: entry.samples,
      simulationId: input.simulationId || '', domain: input.domain || '',
      trigger: 'recordForecastOutcome'
    });

    return entry;
  }

  function getForecastMemory(key) {
    return _getForecastMemory(key);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 5: EXPLAIN FORECAST
  // ══════════════════════════════════════════════════════════════════════

  function explainForecast(simulationId) {
    var sims = _getStore(SIM_KEY, []);
    var sim = null;
    for (var i = 0; i < sims.length; i++) {
      if (sims[i].id === simulationId) { sim = sims[i]; break; }
    }
    if (!sim) return { error: 'SIMULATION_NOT_FOUND' };

    var explanation = {
      id: sim.id,
      type: sim.type,
      confidence: sim.confidence,
      evidenceLevel: sim.evidenceLevel || 'UNKNOWN'
    };

    if (sim.type === 'BASELINE_FORECAST') {
      explanation.factors = [];
      if (sim.intradaySamples < MIN_INTRADAY_FOR_FORECAST) {
        explanation.factors.push('Insufficient intraday data (' + sim.intradaySamples + ' samples, need ' + MIN_INTRADAY_FOR_FORECAST + ')');
      } else {
        explanation.factors.push('Intraday slope: ' + sim.slopeShort + ' (R²=' + sim.r2Short + ')');
      }
      if (sim.dailySamples < MIN_DAILY_FOR_FORECAST) {
        explanation.factors.push('Insufficient daily history (' + sim.dailySamples + ' days, need ' + MIN_DAILY_FOR_FORECAST + ')');
      } else {
        explanation.factors.push('Daily slope: ' + sim.slopeDaily + ' over ' + sim.dailySamples + ' days (R²=' + sim.r2Daily + ')');
      }
      explanation.factors.push('Label: ' + sim.label + ' (not a prediction unless confidence >= 0.5)');
    } else if (sim.type === 'PROPAGATION_SIMULATION') {
      explanation.factors = [
        'Used real propagation engine: ' + sim.usedRealPropagation,
        'Seed domains: ' + sim.seedDomains.join(', '),
        'Activated ' + sim.totalActivatedNodes + ' nodes over ' + sim.steps + ' steps',
        sim.downstream.length + ' downstream domains exposed'
      ];
    } else if (sim.type === 'PLAN_COMPARISON') {
      explanation.factors = [
        'Ranked by contextual fit, not proven causation',
        sim.plans.length + ' plans compared',
        'Winner: ' + sim.winner + ' (evidence: ' + sim.evidenceLevel + ')'
      ];
      explanation.uncertaintyFlags = [];
      for (var pi = 0; pi < sim.plans.length; pi++) {
        var flags = sim.plans[pi].riskFlags || [];
        for (var fi = 0; fi < flags.length; fi++) {
          if (explanation.uncertaintyFlags.indexOf(flags[fi]) === -1) {
            explanation.uncertaintyFlags.push(flags[fi]);
          }
        }
      }
    }

    if (sim.confidenceReason) explanation.confidenceReason = sim.confidenceReason;

    return explanation;
  }

  // ══════════════════════════════════════════════════════════════════════
  // STORAGE + AUDIT
  // ══════════════════════════════════════════════════════════════════════

  function _storeSim(sim) {
    var sims = _getStore(SIM_KEY, []);
    sims.push(sim);
    if (sims.length > MAX_SIMULATIONS) sims = sims.slice(-MAX_SIMULATIONS);
    localStorage.setItem(SIM_KEY, JSON.stringify(sims));

    // Update audit
    var audit = _getStore(SIM_AUDIT_KEY, { totalRun: 0, byType: {}, avgConfidence: 0, totalConfidence: 0 });
    audit.totalRun++;
    audit.byType[sim.type] = (audit.byType[sim.type] || 0) + 1;
    audit.totalConfidence = (audit.totalConfidence || 0) + (sim.confidence || 0);
    audit.avgConfidence = Math.round(audit.totalConfidence / audit.totalRun * 100) / 100;
    audit.lastRunAt = Date.now();
    localStorage.setItem(SIM_AUDIT_KEY, JSON.stringify(audit));
  }

  function getRecentSimulations(limit) {
    var sims = _getStore(SIM_KEY, []);
    return sims.slice(-(limit || 10));
  }

  function getSimulationAudit() {
    var audit = _getStore(SIM_AUDIT_KEY, { totalRun: 0, byType: {}, avgConfidence: 0 });
    // Add forecast memory summary
    var fmem = _getStore(FORECAST_MEM_KEY, {});
    var fmKeys = Object.keys(fmem);
    var weakDomains = [];
    for (var fi = 0; fi < fmKeys.length; fi++) {
      var fm = fmem[fmKeys[fi]];
      if (fm.samples >= MIN_SAMPLES_FOR_EFFECT && fm.directionHitRate < 0.5) {
        weakDomains.push(fmKeys[fi]);
      }
    }
    audit.forecastMemoryEntries = fmKeys.length;
    audit.weakForecastDomains = weakDomains;
    return audit;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENSimulation = {
    forecastBaseline: forecastBaseline,
    simulatePropagation: simulatePropagation,
    compareCandidatePlans: compareCandidatePlans,
    recordForecastOutcome: recordForecastOutcome,
    getForecastMemory: getForecastMemory,
    getRecentSimulations: getRecentSimulations,
    getSimulationAudit: getSimulationAudit,
    explainForecast: explainForecast
  };

})();
