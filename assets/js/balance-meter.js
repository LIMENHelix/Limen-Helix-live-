/**
 * balance-meter.js
 * LIMEN HELIX — Domain Balance Meter
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Tracks both destabilizing and stabilizing pressure per domain.
 * Computes net balance so LIMEN reveals recovery, not only danger.
 *
 * Depends on: window.LIMENDomains, window.LIMENSourceAudit
 * Listens: limen:domain-update
 * Emits: limen:balance-update (every cycle), limen:balance-shift (state change)
 * Output: window.LIMENBalance
 *
 * Load order: after domain-signal-engine.js
 */

(function () {
  'use strict';

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var HISTORY_MAX = 12;

  // ─── State ───────────────────────────────────────────────────────────────

  var _balance = {};
  var _stressHistory = {};
  var _prevState = {};

  function _init() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      _balance[k] = { destabilizing: 0, stabilizing: 0, net: 0, state: 'neutral' };
      _stressHistory[k] = [];
      _prevState[k] = 'neutral';
    }
  }
  _init();

  // ─── Balance computation ──────────────────────────────────────────────

  function _compute() {
    var domains = window.LIMENDomains || {};
    var shifts = [];

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (!d) continue;

      var stress = d.stress || 0;
      var trend = d.trend || 0;
      var confidence = d.confidence || 0;

      // Track stress history for volatility + trajectory
      _stressHistory[k].push(stress);
      if (_stressHistory[k].length > HISTORY_MAX) _stressHistory[k].shift();

      // ─── Destabilizing score ────────────────────────────────────
      // High stress, rising trend, high volatility = destabilizing
      var destab = 0;

      // Current stress level (primary factor)
      destab += stress * 0.55;

      // Rising trend amplifies
      if (trend > 0.02) {
        destab += trend * 2.0;
      }

      // Volatility (std dev of recent history)
      var vol = _stddev(_stressHistory[k]);
      destab += vol * 1.5;

      // Low confidence means less trust in data, slight destab
      if (confidence < 0.3 && stress > 0.3) {
        destab += 0.05;
      }

      destab = _clamp(destab, 0, 1);

      // ─── Stabilizing score ─────────────────────────────────────
      // Falling trend, reducing volatility, improving trajectory = stabilizing
      var stab = 0;

      // Falling trend is stabilizing
      if (trend < -0.02) {
        stab += Math.abs(trend) * 2.5;
      }

      // Low and stable stress is stabilizing
      if (stress < 0.30) {
        stab += (0.30 - stress) * 0.8;
      }

      // Decreasing volatility over time
      if (_stressHistory[k].length >= 6) {
        var olderVol = _stddev(_stressHistory[k].slice(0, Math.floor(_stressHistory[k].length / 2)));
        var newerVol = _stddev(_stressHistory[k].slice(Math.floor(_stressHistory[k].length / 2)));
        if (olderVol > newerVol + 0.01) {
          stab += (olderVol - newerVol) * 3.0;
        }
      }

      // Trajectory: if stress was higher before and is now lower
      if (_stressHistory[k].length >= 4) {
        var older = _avg(_stressHistory[k].slice(0, 3));
        var newer = _avg(_stressHistory[k].slice(-3));
        if (older > newer + 0.02) {
          stab += (older - newer) * 2.0;
        }
      }

      // High confidence in low-stress data is stabilizing
      if (confidence > 0.7 && stress < 0.40) {
        stab += 0.08;
      }

      stab = _clamp(stab, 0, 1);

      // ─── Net balance ───────────────────────────────────────────
      var net = _round(stab - destab);
      destab = _round(destab);
      stab = _round(stab);

      // State label
      var state = 'neutral';
      if (net > 0.08) state = 'improving';
      else if (net < -0.08) state = 'destabilizing';

      _balance[k] = {
        destabilizing: destab,
        stabilizing: stab,
        net: net,
        state: state
      };

      // Detect state shift
      if (_prevState[k] !== state) {
        shifts.push({ domain: k, from: _prevState[k], to: state, net: net });
        _prevState[k] = state;
      }
    }

    window.LIMENBalance = _balance;
    _dispatch('limen:balance-update', { balance: _balance, updated: Date.now() });

    // Emit shifts
    for (var s = 0; s < shifts.length; s++) {
      _dispatch('limen:balance-shift', shifts[s]);
    }
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    _compute();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        _compute();
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      _compute();
    }
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function _round(v) { return Math.round(v * 100) / 100; }

  function _avg(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function _stddev(arr) {
    if (arr.length < 2) return 0;
    var mean = _avg(arr);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      var diff = arr[i] - mean;
      sum += diff * diff;
    }
    return Math.sqrt(sum / arr.length);
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENBalance = _balance;

  window.LIMENBalanceMeter = {
    start: start,
    stop: stop
  };

})();
