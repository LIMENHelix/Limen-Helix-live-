/**
 * inter-brain-bus.js — Cross-Domain Nervous System
 *
 * Routes emissions between domain brains. When energy emits
 * "fuel_cost_transmission" to supplyChain, this bus:
 *   1. Collects the emission
 *   2. Delivers it to the target brain (if registered)
 *   3. The target brain incorporates it as an external stress modifier
 *   4. Civilization layer sees the full propagation map
 *
 * Routing is domain-AGNOSTIC: any brain that publishes
 * state.crossDomainEmissions participates. The examples below document the
 * FINANCE wiring so the credit/liquidity/solvency channel is not silent in
 * the cross-domain nervous system. (No finance-specific routing code is
 * required — finance plugs in exactly like energy/infrastructure/culture.)
 *
 * Cross-domain examples — OTHER → FINANCE (finance as a target):
 *   energy         → finance  (commodity_dislocation / fuel_cost_transmission
 *                              → fuel & input costs erode coverage ratios →
 *                              credit stress at fuel-heavy borrowers)
 *   infrastructure → finance  (FUNDING_COLLAPSE / maintenance_deficit
 *                              → maintenance backlog & deferred capex →
 *                              project-finance funding squeeze, downgrade risk)
 *   governance     → finance  (regulatory tightening / policy_shock
 *                              → capital-access squeeze, higher compliance &
 *                              funding cost, primary-market access narrows)
 *   supplyChain    → finance  (logistics_constraint → working-capital strain,
 *                              receivables stretch → liquidity_constraint)
 *
 * Cross-domain examples — FINANCE → OTHER (finance as a source). Finance
 * emits three native signals when ≥1 validated/active diagnosis is present:
 *   finance → energy        (credit_spread       → widening spreads raise the
 *                            cost of capital for capex-heavy energy issuers)
 *   finance → infrastructure(solvency_stress     → bank/lender solvency stress
 *                            → project funding withdrawn, refinancing risk)
 *   finance → economy       (liquidity_constraint→ funding-market liquidity
 *                            squeeze → broad credit contraction)
 *   finance → industry      (credit_spread       → higher financing cost →
 *                            production/expansion drag)
 *   Real finance issuers behind these signals: JPM, BAC, C, WFC, GS, MS,
 *   SCHW, BLK, KKR, BX, V, MA. (credit_spread = market-priced default risk;
 *   solvency_stress = capital/coverage erosion; liquidity_constraint =
 *   funding-access squeeze.) These are SIGNAL examples only — the validated
 *   Thing1 P3 distress kernel remains the sole scoring authority; the bus
 *   merely transports already-scored emissions.
 *
 * Also detects:
 *   - Propagation chains (A→B→C)
 *   - Co-activation (multiple domains emitting simultaneously)
 *   - Causal loops (A→B→A, e.g. energy→finance→energy via cost-of-capital)
 *   - Regime-level cascade (>3 domains in emission chain)
 *
 * Exposes: window.LIMENInterBrainBus
 */
(function () {
  'use strict';

  var MAX_HISTORY = 200;
  var CASCADE_THRESHOLD = 3; // domains in chain = cascade

  // ══════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════

  var _emissions = [];          // current cycle emissions
  var _history = [];            // rolling history of all emissions
  var _propagationMap = {};     // source → [{ target, signal, magnitude }]
  var _receivedSignals = {};    // target → [{ source, signal, magnitude, timestamp }]
  var _cascadeDetected = false;
  var _causalLoops = [];

  // ══════════════════════════════════════════════════════════════════════
  // COLLECTION — gather emissions from all active brains
  // ══════════════════════════════════════════════════════════════════════

  function collectEmissions() {
    var brains = window.LIMENDomainBrains ? window.LIMENDomainBrains.getAll() : {};
    _emissions = [];
    _propagationMap = {};

    for (var dk in brains) {
      var brain = brains[dk];
      var state = brain.getState();
      var emissions = state.crossDomainEmissions || [];

      for (var i = 0; i < emissions.length; i++) {
        var em = emissions[i];
        _emissions.push(em);

        // Build propagation map
        if (!_propagationMap[em.sourceDomain]) _propagationMap[em.sourceDomain] = [];
        _propagationMap[em.sourceDomain].push({
          target: em.targetDomain,
          signal: em.signal,
          magnitude: em.magnitude,
          timestamp: em.timestamp
        });

        // Record in history
        _history.push({
          source: em.sourceDomain,
          target: em.targetDomain,
          signal: em.signal,
          magnitude: em.magnitude,
          timestamp: em.timestamp || Date.now()
        });
      }
    }

    // Prune history
    if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DELIVERY — route emissions to target brains
  // ══════════════════════════════════════════════════════════════════════

  function deliverEmissions() {
    var brains = window.LIMENDomainBrains ? window.LIMENDomainBrains.getAll() : {};
    _receivedSignals = {};

    for (var i = 0; i < _emissions.length; i++) {
      var em = _emissions[i];
      var target = em.targetDomain;

      // Accumulate received signals per target
      if (!_receivedSignals[target]) _receivedSignals[target] = [];
      _receivedSignals[target].push({
        source: em.sourceDomain,
        signal: em.signal,
        magnitude: em.magnitude,
        timestamp: em.timestamp
      });

      // If target brain exists, inject the signal
      var targetBrain = brains[target];
      if (targetBrain && targetBrain.receiveExternalSignal) {
        targetBrain.receiveExternalSignal(em);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // CASCADE / LOOP DETECTION
  // ══════════════════════════════════════════════════════════════════════

  function detectCascades() {
    _cascadeDetected = false;
    _causalLoops = [];

    // Find chains: A→B, B→C, C→D...
    var chains = [];
    for (var source in _propagationMap) {
      var targets = _propagationMap[source];
      for (var i = 0; i < targets.length; i++) {
        var chain = [source, targets[i].target];
        _extendChain(chain, 0);
        if (chain.length >= CASCADE_THRESHOLD) {
          chains.push(chain.slice());
        }
      }
    }

    if (chains.length > 0) {
      _cascadeDetected = true;
    }

    // Find loops: A→B→A
    for (var src in _propagationMap) {
      var tgts = _propagationMap[src];
      for (var j = 0; j < tgts.length; j++) {
        var tgt = tgts[j].target;
        // Does tgt emit back to src?
        if (_propagationMap[tgt]) {
          for (var k = 0; k < _propagationMap[tgt].length; k++) {
            if (_propagationMap[tgt][k].target === src) {
              _causalLoops.push({ a: src, b: tgt, magnitudeAB: tgts[j].magnitude, magnitudeBA: _propagationMap[tgt][k].magnitude });
            }
          }
        }
      }
    }
  }

  function _extendChain(chain, depth) {
    if (depth > 5) return; // prevent infinite recursion
    var last = chain[chain.length - 1];
    var targets = _propagationMap[last];
    if (!targets) return;

    for (var i = 0; i < targets.length; i++) {
      var next = targets[i].target;
      // Avoid revisiting (except for loop detection)
      if (chain.indexOf(next) === -1) {
        chain.push(next);
        _extendChain(chain, depth + 1);
        return; // follow first chain only
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // FULL CYCLE — called periodically or on brain-update events
  // ══════════════════════════════════════════════════════════════════════

  function cycle() {
    collectEmissions();
    deliverEmissions();
    detectCascades();

    // Emit event for civilization layer
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('limen:inter-brain-cycle', {
        detail: {
          emissionCount: _emissions.length,
          propagationMap: _propagationMap,
          receivedSignals: _receivedSignals,
          cascadeDetected: _cascadeDetected,
          causalLoops: _causalLoops,
          timestamp: Date.now()
        }
      }));
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // START — listen for brain updates, run cycle after each
  // ══════════════════════════════════════════════════════════════════════

  var _started = false;
  var _cycleTimer = null;

  function start() {
    if (_started) return;
    _started = true;

    // Run cycle after any brain updates
    window.addEventListener('limen:domain-brain-update', function () {
      cycle();
    });

    // Also run on a fixed interval as backup
    _cycleTimer = setInterval(cycle, 30000);

    // Initial cycle
    setTimeout(cycle, 5000);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENInterBrainBus = {
    start: start,
    cycle: cycle,
    getEmissions: function () { return _emissions; },
    getHistory: function () { return _history; },
    getPropagationMap: function () { return _propagationMap; },
    getReceivedSignals: function (domainId) { return domainId ? (_receivedSignals[domainId] || []) : _receivedSignals; },
    isCascade: function () { return _cascadeDetected; },
    getCausalLoops: function () { return _causalLoops; },
    getState: function () {
      return {
        emissionCount: _emissions.length,
        activeChains: Object.keys(_propagationMap).length,
        cascadeDetected: _cascadeDetected,
        loopCount: _causalLoops.length,
        historyDepth: _history.length
      };
    }
  };

})();
