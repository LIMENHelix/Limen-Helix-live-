/**
 * report-polarity-engine.js
 * LIMEN HELIX — Report Polarity Engine
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Classifies domain signals, cross-domain patterns, and driver text
 * as positive/negative/mixed/uncertain using keyword-based polarity scoring.
 * No language model dependency — lightweight lexicon matching only.
 *
 * Depends on: window.LIMENDomains, window.LIMENCrossDomain
 * Listens: limen:domain-update, limen:cross-domain-signal
 * Emits: limen:report-polarity (per domain, on polarity shift)
 * Output: window.LIMENPolarity
 *
 * Load order: after cross-domain-detector.js
 */

(function () {
  'use strict';

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var HISTORY_MAX = 20;

  // ─── Polarity lexicon ────────────────────────────────────────────────────

  var NEGATIVE_TERMS = [
    'stress', 'elevated', 'spike', 'surge', 'decline', 'drop', 'fall',
    'disruption', 'pressure', 'strain', 'tightening', 'shortages',
    'volatility', 'anomaly', 'concern', 'risk', 'vulnerability',
    'contraction', 'deterioration', 'collapse', 'crisis', 'shock',
    'adverse', 'enforcement', 'recall', 'warning', 'severe', 'extreme',
    'unstable', 'fragmented', 'escalating', 'destabilizing', 'worsening',
    'deficit', 'inflation', 'unemployment', 'loss', 'threat'
  ];

  var POSITIVE_TERMS = [
    'improving', 'recovery', 'stable', 'growth', 'expansion', 'progress',
    'innovation', 'acceleration', 'opportunity', 'resilience', 'strength',
    'emerging', 'advancement', 'breakthrough', 'discovery', 'resolution',
    'stabilizing', 'recovering', 'adaptive', 'reduced', 'contained',
    'nominal', 'balanced', 'healthy', 'strong', 'robust', 'positive',
    'active', 'monitoring', 'tracking', 'research', 'publication',
    'patent', 'filing', 'trial', 'therapy', 'treatment'
  ];

  var UNCERTAIN_TERMS = [
    'simulated', 'fallback', 'unavailable', 'unknown', 'heuristic',
    'internal model', 'no live'
  ];

  // ─── State ───────────────────────────────────────────────────────────────

  var _polarity = {};
  var _signalHistory = {};
  var _prevTone = {};

  function _init() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      _polarity[k] = {
        positiveWeight: 0,
        negativeWeight: 0,
        netTone: 0,
        polarity: 'uncertain',
        confidence: 0,
        recentPositive: [],
        recentNegative: [],
        updated: null
      };
      _signalHistory[k] = [];
      _prevTone[k] = 'uncertain';
    }
  }
  _init();

  // ─── Scoring ─────────────────────────────────────────────────────────────

  function _scoreText(text) {
    if (!text) return { pos: 0, neg: 0, unc: 0 };
    var lower = text.toLowerCase();
    var pos = 0;
    var neg = 0;
    var unc = 0;

    for (var i = 0; i < NEGATIVE_TERMS.length; i++) {
      if (lower.indexOf(NEGATIVE_TERMS[i]) !== -1) neg++;
    }
    for (var j = 0; j < POSITIVE_TERMS.length; j++) {
      if (lower.indexOf(POSITIVE_TERMS[j]) !== -1) pos++;
    }
    for (var u = 0; u < UNCERTAIN_TERMS.length; u++) {
      if (lower.indexOf(UNCERTAIN_TERMS[u]) !== -1) unc++;
    }

    return { pos: pos, neg: neg, unc: unc };
  }

  function _classifyDomain(domainKey) {
    var domains = window.LIMENDomains || {};
    var d = domains[domainKey];
    if (!d) return;

    var totalPos = 0;
    var totalNeg = 0;
    var totalUnc = 0;
    var posSignals = [];
    var negSignals = [];

    // Score domain signals
    var signals = d.signals || [];
    for (var s = 0; s < signals.length; s++) {
      var sc = _scoreText(signals[s]);
      totalPos += sc.pos;
      totalNeg += sc.neg;
      totalUnc += sc.unc;
      if (sc.pos > sc.neg) posSignals.push(signals[s]);
      else if (sc.neg > sc.pos) negSignals.push(signals[s]);
    }

    // Score source labels
    var sources = d.sources || [];
    for (var r = 0; r < sources.length; r++) {
      if (sources[r].label) {
        var lsc = _scoreText(sources[r].label);
        totalPos += lsc.pos;
        totalNeg += lsc.neg;
        totalUnc += lsc.unc;
        if (lsc.pos > lsc.neg) posSignals.push(sources[r].label);
        else if (lsc.neg > lsc.pos) negSignals.push(sources[r].label);
      }
    }

    // Factor in trend as a signal
    var trend = d.trend || 0;
    if (trend < -0.03) {
      totalPos += 1; // falling stress is positive
      posSignals.push('stress trend declining');
    } else if (trend > 0.03) {
      totalNeg += 1; // rising stress is negative
      negSignals.push('stress trend rising');
    }

    // Factor in balance if available
    var bal = (window.LIMENBalance && window.LIMENBalance[domainKey]) || null;
    if (bal) {
      if (bal.state === 'improving') {
        totalPos += 2;
        posSignals.push('balance improving');
      } else if (bal.state === 'destabilizing') {
        totalNeg += 2;
        negSignals.push('balance destabilizing');
      }
    }

    // Store in history for EMA smoothing
    _signalHistory[domainKey].push({ pos: totalPos, neg: totalNeg, unc: totalUnc });
    if (_signalHistory[domainKey].length > HISTORY_MAX) _signalHistory[domainKey].shift();

    // EMA weights across history
    var emaPos = 0;
    var emaNeg = 0;
    var emaUnc = 0;
    var alpha = 0.3;
    var hist = _signalHistory[domainKey];
    for (var h = 0; h < hist.length; h++) {
      var w = Math.pow(1 - alpha, hist.length - 1 - h) * alpha;
      emaPos += hist[h].pos * w;
      emaNeg += hist[h].neg * w;
      emaUnc += hist[h].unc * w;
    }

    // Normalize to 0-1
    var total = emaPos + emaNeg + emaUnc;
    var posWeight = total > 0 ? _round(emaPos / total) : 0;
    var negWeight = total > 0 ? _round(emaNeg / total) : 0;
    var netTone = _round(posWeight - negWeight);

    // Classify
    var polarity = 'uncertain';
    var confidence = 0;
    if (totalUnc > totalPos + totalNeg) {
      polarity = 'uncertain';
      confidence = 0.3;
    } else if (Math.abs(netTone) < 0.10) {
      polarity = 'mixed';
      confidence = _round(0.4 + Math.min(total * 0.05, 0.4));
    } else if (netTone > 0.10) {
      polarity = 'positive';
      confidence = _round(0.5 + posWeight * 0.4);
    } else {
      polarity = 'negative';
      confidence = _round(0.5 + negWeight * 0.4);
    }

    // Limit signal lists
    posSignals = posSignals.slice(0, 3);
    negSignals = negSignals.slice(0, 3);

    _polarity[domainKey] = {
      positiveWeight: posWeight,
      negativeWeight: negWeight,
      netTone: netTone,
      polarity: polarity,
      confidence: _clamp(confidence, 0, 1),
      recentPositive: posSignals,
      recentNegative: negSignals,
      updated: Date.now()
    };

    // Emit on polarity shift
    if (_prevTone[domainKey] !== polarity) {
      _dispatch('limen:report-polarity', {
        domain: domainKey,
        polarity: polarity,
        confidence: confidence,
        drivers: polarity === 'positive' ? posSignals : negSignals,
        sourceType: 'signal',
        updated: Date.now()
      });
      _prevTone[domainKey] = polarity;
    }
  }

  // ─── Compute all ─────────────────────────────────────────────────────────

  function _computeAll() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      _classifyDomain(DOMAIN_KEYS[i]);
    }
    window.LIMENPolarity = _polarity;
  }

  // ─── Cross-domain signal handler ─────────────────────────────────────────

  function _onCrossDomainSignal(e) {
    var sig = e.detail;
    if (!sig || !sig.domains) return;
    // Cross-domain signals inject extra negative weight into involved domains
    for (var i = 0; i < sig.domains.length; i++) {
      var k = sig.domains[i];
      if (_signalHistory[k]) {
        _signalHistory[k].push({ pos: 0, neg: 2, unc: 0 });
        if (_signalHistory[k].length > HISTORY_MAX) _signalHistory[k].shift();
      }
    }
  }

  // ─── Event listeners ─────────────────────────────────────────────────────

  function _onDomainUpdate() {
    _computeAll();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        window.addEventListener('limen:cross-domain-signal', _onCrossDomainSignal);
        _computeAll();
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      window.addEventListener('limen:cross-domain-signal', _onCrossDomainSignal);
      _computeAll();
    }
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:cross-domain-signal', _onCrossDomainSignal);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function _round(v) { return Math.round(v * 100) / 100; }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENPolarity = _polarity;

  window.LIMENReportPolarityEngine = {
    start: start,
    stop: stop
  };

})();
