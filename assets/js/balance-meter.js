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

  // ─── Infrastructure-native semantics ──────────────────────────────────────
  // Energy parity: energy-brain.js maps live signal conditions to named
  // domain-native pathways (crude_above_90 / grid_stress / chokepoint …) with
  // weighted contributions, rather than treating stress as a single opaque
  // scalar. Civil infrastructure has its OWN failure/recovery vocabulary —
  // roads/bridges, water & sewer mains, the electric GRID (transmission &
  // distribution reliability), transit/transport, dams & levees, cyber-physical
  // (SCADA / ICS / CISA KEV), construction & public works, deferred maintenance,
  // and capital funding. Crude-price / oil / gas / nuclear / renewable content
  // is NOT used here; those energy primitives are translated to civil ones.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score.
  // This is the same shape as energy's condition→weight mapping, civil content.
  var INFRA_DESTABILIZING = [
    // Cyber-physical threat persistence — SCADA/ICS intrusions that dwell.
    { re: /scada|ics intrusion|cyber-?physical|cisa kev|known exploited|ransomware|control system/i, weight: 0.18, tag: 'cyber_physical_threat' },
    // Transmission / distribution grid reliability — the civil GRID, not fuel.
    { re: /transmission (line )?(fail|outage|congest)|distribution outage|grid reliability|frequency deviation|substation/i, weight: 0.16, tag: 'grid_reliability' },
    // Deferred maintenance acceleration / backlog spike.
    { re: /deferred maintenance|maintenance backlog|repair backlog|state of good repair/i, weight: 0.15, tag: 'deferred_maintenance' },
    // Structural assets in distress — bridges, dams, levees, tunnels.
    { re: /bridge (deficien|closure|fail)|structurally deficient|dam (fail|breach|deficien)|levee (fail|breach)|tunnel (fail|closure)/i, weight: 0.17, tag: 'structural_asset_failure' },
    // Water / sewer mains — breaks, boil-water, treatment failures.
    { re: /water main (break|fail)|sewer (overflow|fail)|boil(-| )water|treatment plant (fail|outage)|lead (service )?line/i, weight: 0.15, tag: 'water_system_failure' },
    // Transit / transport reliability — service collapse, derailment, bridge ban.
    { re: /transit (cut|collapse|breakdown)|derailment|service suspension|weight restriction|load posting/i, weight: 0.13, tag: 'transport_reliability' },
    // Supply-side hardware lead times — transformer / equipment shortage.
    { re: /transformer (shortage|lead time)|equipment (shortage|backorder)|long lead time|procurement delay/i, weight: 0.12, tag: 'equipment_lead_time' }
  ];
  var INFRA_STABILIZING = [
    // Capital funding renewal — appropriations, bonds, IIJA/grant inflow.
    { re: /funding (renew|secured|appropriat)|capital (program|plan) (approv|fund)|bond (issu|approv)|infrastructure (bill|act|grant)|reauthoriz/i, weight: 0.16, tag: 'funding_renewal' },
    // Capacity modernization — upgrades, hardening, resilience build-out.
    { re: /moderniz|capacity (expansion|upgrade)|hardening|resilience (upgrade|invest)|grid (upgrade|hardening)|seismic retrofit/i, weight: 0.14, tag: 'capacity_modernization' },
    // Repair completion rate — backlog being burned down, projects delivered.
    { re: /repair(s)? complet|backlog (reduc|cleared)|project(s)? delivered|restored to service|rehabilitation complet/i, weight: 0.15, tag: 'repair_completion' }
  ];

  // Scan a domain's signal strings against a civil pattern table and return the
  // summed weighted contribution (clamped). Mirrors how energy accumulates its
  // condition-driven pressure, but over civil-native keywords.
  function _infraSignalScore(signals, table) {
    if (!signals || !signals.length) return { score: 0, tags: [] };
    var total = 0;
    var tags = [];
    for (var t = 0; t < table.length; t++) {
      var ent = table[t];
      for (var i = 0; i < signals.length; i++) {
        var s = String(signals[i] || '');
        if (ent.re.test(s)) {
          total += ent.weight;
          tags.push(ent.tag);
          break; // count each pattern at most once
        }
      }
    }
    return { score: _clamp(total, 0, 0.6), tags: tags };
  }

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
      var signals = d.signals || [];

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

      // ── Infrastructure-native destabilizing pathways (energy parity) ──
      // For the infrastructure domain ONLY, add civil-specific pressure from
      // named failure pathways found in the live signal strings (grid reliability,
      // cyber-physical/SCADA threat persistence, deferred-maintenance acceleration,
      // structural-asset failure, water-system failure, transport reliability,
      // equipment lead time). This is the civil analogue of energy's
      // crude_above_*/grid_stress/chokepoint condition weighting.
      var _infraDestabTags = null;
      if (k === 'infrastructure') {
        var _id = _infraSignalScore(signals, INFRA_DESTABILIZING);
        destab += _id.score;
        _infraDestabTags = _id.tags;
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

      // ── Infrastructure-native stabilizing pathways (energy parity) ──
      // Civil recovery vocabulary: capital funding renewal, capacity
      // modernization, and repair completion rate. Mirrors energy's
      // falling-trend / declining-volatility stabilizers but with civil
      // semantics drawn from the live signal strings.
      var _infraStabTags = null;
      if (k === 'infrastructure') {
        var _is = _infraSignalScore(signals, INFRA_STABILIZING);
        stab += _is.score;
        _infraStabTags = _is.tags;
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

      // Surface the civil-native pathways that drove the infrastructure score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'infrastructure') {
        _balance[k].destabilizingFactors = _infraDestabTags || [];
        _balance[k].stabilizingFactors = _infraStabTags || [];
      }

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
