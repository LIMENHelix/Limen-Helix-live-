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
 * Cross-domain examples — OTHER → ECONOMY (economy as a target). Economy is
 * the MACRO AGGREGATE (GDP/inflation/employment/sentiment/policy/business
 * cycle) and is DISTINCT from finance (capital markets / credit / banks). It
 * is bound to BROAD MACRO INDICATORS — real FRED series and broad-market
 * proxies, never single-company tickers. Economy was previously a SOURCE only
 * (it emits to finance/supplyChain/energy/governance); these are its missing
 * RETURN paths so the macro feedback loop is not silent in the bus:
 *   finance     → economy  (liquidity_constraint → funding-market liquidity
 *                           squeeze raises the cost of capital → capex &
 *                           working-capital pullback → slower GDP growth,
 *                           softer employment. Macro reads: GDPC1 (real GDP),
 *                           FEDFUNDS / DGS10 (policy & term rates), PAYEMS /
 *                           UNRATE (labor), broad-market proxies SPY / DIA /
 *                           TLT. Finance also natively emits credit_transmission
 *                           to economy — same return channel.)
 *   supplyChain → economy  (logistics_constraint → supply disruption raises
 *                           input costs and compresses throughput → demand
 *                           shock + cost-push inflation. Macro reads: CPIAUCSL
 *                           / PCEPI (price level), INDPRO (industrial
 *                           production), UMCSENT (consumer sentiment).)
 *   energy      → economy  (commodity_shock → fuel_cost_transmission /
 *                           commodity_dislocation → fuel & power cost spike →
 *                           headline inflation pass-through, real-income drag
 *                           on consumption. Macro reads: CPIAUCSL / PCEPI,
 *                           GLD as a broad inflation/commodity proxy.)
 *   These modify economy's PRIOR growth expectation and stress calculation
 *   AFTER the validated P3 kernel runs — they are external stress modifiers
 *   ingested via the base receiveExternalSignal handler, NOT a second scorer.
 *
 * Cross-domain examples — OTHER → DEFENSE (defense as a target). Defense is the
 * KINETIC / INDUSTRIAL / READINESS domain (military spending & procurement, the
 * defense industrial base, geopolitical conflict & deterrence, weapons systems,
 * military readiness, alliances & basing, electronic/kinetic warfare, strategic
 * deterrence). It is DISTINCT from intelligence (collection / analysis /
 * espionage) and from technology (cyber is a COUPLING, not defense's identity).
 * Defense was previously documented as a SOURCE only (it emits to governance/
 * economy/technology/intelligence — see defense-brain.js emissionRules); these
 * are its missing RETURN paths so the readiness/deterrence channel is not silent
 * in the bus:
 *   infrastructure → defense (SCADA_vulnerability / grid_resilience_pressure →
 *                             base & depot power/water reliability erodes →
 *                             military operation reliability risk, degraded CBRN
 *                             defense posture, continuity-of-operations gap)
 *   technology     → defense (zero_day_disclosure / cyber_threat_vector →
 *                             weapons-system & C2 exploitation risk → a kinetic
 *                             vulnerability in fielded platforms, not a data
 *                             breach — the cyber→kinetic coupling)
 *   energy         → defense (fuel_security_strain / strategic_reserve_pressure
 *                             / commodity_dislocation → JP-8 & bunker fuel cost
 *                             and supply strain → military logistics constraint,
 *                             sortie-rate & sustainment readiness gap)
 *   These modify defense's PRIOR readiness/threat-posture expectation and stress
 *   calculation AFTER the validated P3 kernel runs — external stress modifiers
 *   ingested via the base receiveExternalSignal handler, NOT a second scorer.
 *
 * Cross-domain examples — DEFENSE → OTHER (defense as a source). Defense emits
 * native signals when ≥1 active diagnosis is present (defense-brain.js):
 *   defense → governance   (security_policy_pressure    → threat escalation
 *                           forces security/posture policy response)
 *   defense → economy      (defense_spending_drag       → procurement surge /
 *                           crowd-out shifts the macro spending mix)
 *   defense → technology   (defense_tech_demand         → R&D pull on sensors,
 *                           autonomy, hypersonics, electronic warfare)
 *   defense → intelligence (threat_assessment_pressure  → kinetic posture
 *                           raises collection & analysis tasking demand)
 *   And the missing OUTBOUND coupling paths to energy/infrastructure (the return
 *   side of the energy→defense / infrastructure→defense inbound mirrors above —
 *   defense couples to energy via fuel logistics & strategic-reserve management
 *   and to infrastructure via grid resilience for military operations, WITHOUT
 *   taking on oil/gas/grid as its own identity):
 *   defense → energy        (strategic_reserve_mobilization / fuel_security_posture
 *                           → wartime / high-readiness fuel mobilization and
 *                           strategic-petroleum-reserve drawdown reshape fuel
 *                           demand & security posture for capex-heavy energy
 *                           issuers — the outbound mirror of energy's native
 *                           fuel_cost_transmission path)
 *   defense → infrastructure(energy_infrastructure_hardening_mandate → readiness
 *                           drives grid-resilience, communications-infrastructure
 *                           and base-infrastructure hardening requirements for
 *                           military continuity-of-operations)
 *   Real defense issuers behind these signals (defense industrial base
 *   procurement & readiness signaling): LMT, RTX, NOC, GD, BA, LHX, HII, LDOS,
 *   BAH, KTOS, AVAV. (readiness_gap = sustainment/sortie-rate shortfall;
 *   force_projection = deployable-capacity pressure; deterrence_failure =
 *   strategic-stability erosion.) SIGNAL examples only — the validated Thing1 P3
 *   distress kernel remains the sole scoring authority; the bus merely transports
 *   already-scored emissions.
 *
 * Cross-domain examples — ECONOMY → OTHER (economy as a source). Economy emits
 * native macro signals when ≥1 active diagnosis is present (economy-brain.js):
 *   economy → finance      (credit_conditions_shift   → macro deterioration
 *                           tightens credit conditions / repricing)
 *   economy → supplyChain  (demand_throughput_pressure → softer final demand
 *                           cascades to order books & throughput)
 *   economy → energy       (demand_consumption_shift   → cycle turn shifts
 *                           power/fuel consumption)
 *   economy → governance   (policy_response_pressure   → fiscal/monetary
 *                           response pressure: FEDFUNDS path, fiscal stance)
 *   Macro anchors behind economy emissions (REAL FRED series + broad-market
 *   proxies, never fabricated tickers): GDP, GDPC1, CPIAUCSL, PCEPI, UNRATE,
 *   PAYEMS, FEDFUNDS, DGS10, UMCSENT, INDPRO; SPY, DIA, TLT, GLD. The
 *   recession/expansion business cycle is the macro regime these traverse —
 *   e.g. finance liquidity crisis → higher cost of capital → slower GDP →
 *   weaker employment → dampened consumer spending → amplified cycle (the
 *   return loop economy must close). SIGNAL examples only — Thing1 P3 remains
 *   the sole scoring authority; the bus merely transports scored emissions.
 *
 * Also detects:
 *   - Propagation chains (A→B→C)
 *   - Co-activation (multiple domains emitting simultaneously)
 *   - Causal loops (A→B→A, e.g. energy→finance→energy via cost-of-capital;
 *     finance→economy→finance via cost-of-capital→GDP→credit conditions)
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
