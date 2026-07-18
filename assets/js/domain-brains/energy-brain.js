/**
 * energy-brain.js — Energy Domain Cognitive Engine
 *
 * First domain brain implementation. Extends DomainBrainBase.
 *
 * Feeds: EIA petroleum, Polygon crude, EIA natural gas, FRED gasoline,
 *        Yahoo XLE/USO/UNG ETFs, Baker Hughes rig count, RSS energy crisis
 *
 * Diagnosis matching: maps live signal conditions to the 27K+ energy portal files
 *   OIL_SHOCK → crude > $90 OR strait disruption
 *   GRID_COLLAPSE → grid stress + infrastructure
 *   PIPELINE_DISRUPTION → chokepoint + port events
 *   RENEWABLE_INTERMITTENCY → weather + generation mix
 *   NUCLEAR_INCIDENT → nuclear threat cluster
 *
 * Cross-domain emissions:
 *   energy → supplyChain (fuel cost transmission)
 *   energy → finance (commodity dislocation)
 *   energy → agriculture (input cost pressure)
 *   energy → industry (production cost impact)
 *
 * Actions:
 *   When convergence fires → draft investment research
 *   When company hits P7a → draft investor memo
 *   When diagnosis activates → draft research opportunity
 *
 * Exposes: window.LIMENEnergyBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[EnergyBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  // ══════════════════════════════════════════════════════════════════════
  // ENERGY BRAIN
  // ══════════════════════════════════════════════════════════════════════

  function EnergyBrain() {
    Base.call(this, {
      domainId: 'energy',
      label: 'Energy',
      snapshotKey: 'energy',
      cycleInterval: 30000
    });
  }

  // Inherit from base
  EnergyBrain.prototype = Object.create(Base.prototype);
  EnergyBrain.prototype.constructor = EnergyBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register feeds, diagnosis index, emission rules
  // ══════════════════════════════════════════════════════════════════════

  EnergyBrain.prototype.init = function () {
    Base.prototype.init.call(this);
    this._loadCommandBoardCompanies();   // C6-followup: wire real company entities (state.companies was starved)
    this._loadBrainSignals();            // 2026-06-19: distress now comes ONLY from the validated Thing pipeline (no fake phase data)
    this._loadDiagnosisBundles();        // G1: load real artifact-source bundles (only ones that exist)
    this._loadL1PortalDepth();           // J1: scan L1 portal branches (treatments are mad-lib -> NOT admitted; only real tickers surfaced, relevance-unverified)
    this._loadDatacenterDiagnoses();     // DC: load the data-center sub-portal (real-content, unbundled) as an additive brain LAYER — never merged into the validated 6-diagnosis spine
    try { this._initEnergyPlasticity(); } catch (e) {}   // THREE-FACTOR PLASTICITY (SHADOW) - learnable K-layer weights, hydrated from /api/brain-weights
    try { this._initEnergyActiveInference(); } catch (e) {}   // ACTIVE INFERENCE v1 (SHADOW) - Gaussian beliefs over (level, slope) + EFE action advisory

    // ── OVERLAY ACTUATION (2026-07-12): the neuro-substrate overlay now feeds ONE decision.
    // Scope = refractory de-dup only (operator-approved). Grounded in the Neurology Reference
    // III.3 refractory mechanism, via the already-loaded energy-refractory-limiter.js module
    // (absolute dead-time + relative raised-threshold; a stronger stimulus can still fire).
    // REDUCED-SENSITIVITY weighting: override bar raised 0.8 -> 0.9 so only strong re-fires break
    // through (less chatter). Windows keep the doc ratio 1:4. Fully reversible: flip refractory=false.
    // These MIRROR assets/data/domains/energy.json runtime.params (the brain runs in its own context
    // and does not load that file); keep the two in sync when tuning.
    this._actuation = { refractory: true, servo: true, eiBrake: true, phase: true, phasePercept: true, overlays: true, plasticityLive: true };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set; not in the document)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio preserved)
      overrideThreshold: 0.9      // reduced sensitivity: was 0.8; only stress >= 0.9 re-fires in-window
    };
    this._refractoryBaseWindow = this._refractoryParams.absoluteWindow;   // ARM baseline: metaplasticity may raise (never lower) this, bounded; disarm restores it

    // ── THING2 RECURSIVE-PHASE KERNEL as the phase source (2026-07-13, operator-approved) ──
    // The phase-coherence router and phase-transition self-consistency calibration previously read s.phase (a naive
    // per-cycle guess / static PHASE_M lineage). We now feed those from the REAL Thing2 kernel
    // (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries), which runs the
    // validated financial phase pipeline over this domain's own stress trajectory. The kernel is
    // PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    // posture only (interpretive:true, validated:false); we never surface it as validated.
    // Fallback: if the adapter is absent or history < 8, _kernelPhase stays null and s.phase is used.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:energy'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }

    // Diagnosis → signal condition mapping
    // These map live conditions to which diagnoses become active
    this.diagnosisIndex = {
      'OIL_SHOCK':                ['crude_above_90', 'crude_above_100', 'STRAIT_DISRUPTION', 'OIL_SHOCK', 'REFINERY_ATTACK', 'SANCTIONS', 'energy_high_stress'],
      'GRID_COLLAPSE':            ['grid_stress', 'infrastructure_cross', 'CYBER_ATTACK', 'weather_extreme', 'structural_stress'],
      'PIPELINE_DISRUPTION':      ['STRAIT_DISRUPTION', 'PORT_DISRUPTION', 'TANKER_THREAT', 'chokepoint'],
      'RENEWABLE_INTERMITTENCY':  ['weather_extreme', 'generation_mix', 'storage_low'],
      'NUCLEAR_INCIDENT':         ['NUCLEAR_THREAT', 'MILITARY_ESCALATION'],
      'SYSTEMIC_ENERGY_STRESS':   ['energy_high_stress', 'structural_stress', 'macro_shock'],
      // DC layer — activation conditions for the data-center diagnoses (real-content sub-portal)
      'ENERGY_DATACENTER_GRID_STRAIN':  ['grid_stress', 'infrastructure_cross', 'energy_high_stress', 'structural_stress'],
      'ENERGY_DATACENTER_WATER_STRESS': ['weather_extreme', 'structural_stress']
    };

    // Cross-domain emission rules — GATED: require at least 1 active diagnosis
    // Emissions from stress alone without diagnosis are suppressed
    this.emissionRules = [
      {
        targetDomain: 'supplyChain',
        signalType: 'fuel_cost_transmission',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.6); }
      },
      {
        targetDomain: 'finance',
        signalType: 'commodity_dislocation',
        condition: function (s) { return s.stress >= 0.65 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'agriculture',
        signalType: 'input_cost_pressure',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      },
      {
        targetDomain: 'industry',
        signalType: 'production_cost_impact',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      // ── ENERGY → POPULATION (energy-poverty / household-energy-burden coupling) ──
      // Mirrors the energy→agriculture input-cost transmission link. Energy price &
      // grid stress raise the household energy burden, which propagates to the
      // population domain as migration pressure (climate migration on grid failure +
      // energy-cost-driven relocation), healthcare-access risk (energy-dependent
      // medical devices), and residential-stability risk. The population brain reads
      // this as a demographic INPUT signal, not an energy-production signal. The
      // received magnitude is interpreted there against REAL demographic sources
      // (US Census ACS energy-burden %, heating/cooling load, Pew climate-migration
      // surveys) — this rule only transmits the coupling strength, never energy
      // content. Routed stronger when the stress is grid/renewable-intermittency-led
      // (the failure modes that translate most directly into household energy burden).
      {
        targetDomain: 'population',
        signalType: 'energy_poverty_household_burden',
        condition: function (s) {
          var hasDx = s.diagnoses && s.diagnoses.some(function (d) { return d.active; });
          if (!(s.stress >= 0.55 && hasDx)) return false;
          // Require a household-energy-burden-relevant pathway: grid stress,
          // renewable intermittency, structural stress, or crude price shock.
          var conds = (s.diagnoses || []).filter(function (d) { return d.active; })
            .reduce(function (acc, d) { return acc.concat(d.id || ''); }, []);
          var burdenPathway = conds.some(function (id) {
            return id === 'GRID_COLLAPSE' || id === 'RENEWABLE_INTERMITTENCY' ||
                   id === 'SYSTEMIC_ENERGY_STRESS' || id === 'OIL_SHOCK';
          });
          return burdenPathway;
        },
        magnitudeFormula: function (s) {
          // Base household-energy-burden coupling on overall energy stress, then
          // amplify (per the gap's magnitude spec) when the driving pathway is a
          // grid-stress or renewable-intermittency failure — the modes that hit the
          // residential heating/cooling load hardest. stress * 0.35 when grid/
          // renewable, otherwise a softer crude-price-driven burden (stress * 0.25).
          var active = (s.diagnoses || []).filter(function (d) { return d.active; });
          var gridLed = active.some(function (d) {
            return d.id === 'GRID_COLLAPSE' || d.id === 'RENEWABLE_INTERMITTENCY';
          });
          var factor = gridLed ? 0.35 : 0.25;
          return Math.min(1, s.stress * factor);
        }
      }
    ];
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2 OVERRIDE: Normalize signals into energy-native semantics
  // ══════════════════════════════════════════════════════════════════════

  // ─── Crude-price source guard (Patch D2-E2) ────────────────────────────
  // Gate the canonical-price block so only legitimate crude/oil price feeds
  // produce $/bbl labels and crude_above_* conditions. NOAA/NWS/CISA/news/
  // count feeds may still feed the institutional condition block below —
  // they are NOT removed, only barred from being misread as crude prices.
  function isCrudePriceFeed(f) {
    var identity = String([
      f && f.name,
      f && f.label,
      f && f.channel
    ].filter(Boolean).join(' ')).toLowerCase();

    var denied = /noaa|nws|weather|alert|cisa|kev|cve|vulnerab|ransomware|federal register|fed reg|news|rss|article|document|advisory|recall|count/.test(identity);
    if (denied) return false;

    return /crude|wti|brent|opec|petroleum|eia petroleum|fred crude|reference basket|oil price|petroleum price/.test(identity);
  }

  EnergyBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);

    this._activeConditions = [];

    // ── FEED DEDUP: resolve to single canonical crude price ──
    var feeds = this.state.feeds;
    var oilPrices = [];
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var _v = Number(f && f.value);
      if (f && f.live && Number.isFinite(_v) && _v > 10 && isCrudePriceFeed(f)) {
        oilPrices.push({ name: f.name, value: _v, updated: f.updated || 0 });
      }
    }

    // Select primary (most recent) and check for divergence
    var canonicalPrice = null;
    var primarySource = null;
    if (oilPrices.length > 0) {
      oilPrices.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      canonicalPrice = oilPrices[0].value;
      primarySource = oilPrices[0].name;

      // Divergence check: if sources differ by > $10, flag and reduce confidence
      if (oilPrices.length >= 2) {
        var divergence = Math.abs(oilPrices[0].value - oilPrices[1].value);
        if (divergence > 10) {
          signals.push('WARNING: feed divergence $' + divergence.toFixed(0) + ' between ' + oilPrices[0].name + ' ($' + oilPrices[0].value.toFixed(0) + ') and ' + oilPrices[1].name + ' ($' + oilPrices[1].value.toFixed(0) + ')');
          // Use higher price as canonical (conservative for stress)
          canonicalPrice = Math.max(oilPrices[0].value, oilPrices[1].value);
          primarySource = oilPrices[0].value >= oilPrices[1].value ? oilPrices[0].name : oilPrices[1].name;
        }
      }
    }

    // Store canonical price on state for consumers
    this.state._canonicalCrudePrice = canonicalPrice;
    this.state._primarySource = primarySource;
    this.state._feedDivergence = oilPrices.length >= 2 ? Math.abs(oilPrices[0].value - oilPrices[oilPrices.length - 1].value) : 0;

    // ── OIL PRICE CONDITIONS — from canonical price only ──
    if (canonicalPrice) {
      signals.push(primarySource + ': $' + canonicalPrice.toFixed(2) + '/bbl');
      if (canonicalPrice > 90) {
        this._activeConditions.push('crude_above_90');
        signals.push('ELEVATED: crude above $90/bbl — supply pressure');
      }
      if (canonicalPrice > 100) {
        this._activeConditions.push('crude_above_100');
        signals.push('CRITICAL: crude above $100/bbl — crisis-level pricing');
      }
    }

    // ── EVENT CLUSTERS — with timestamp validation and diagnosis mapping ──
    var snap = this._getSnapshot();
    var now = Date.now();
    var EVENT_TTL = 30 * 60 * 1000; // 30 minutes — events must be recent
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (!sig.affectedDomains || sig.affectedDomains.indexOf('energy') === -1) continue;

        // Timestamp validation — reject stale events
        var sigAge = sig.timestamp ? (now - sig.timestamp) : Infinity;
        var sigFresh = sigAge < EVENT_TTL;
        var label = sigFresh ? 'ACTIVE' : 'STALE';

        if (sigFresh) {
          // Map event types to specific diagnosis conditions
          var et = sig.eventType;
          this._activeConditions.push(et);

          // Explicit event → diagnosis family mapping
          if (et === 'NUCLEAR_THREAT' || et === 'MILITARY_ESCALATION') {
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — nuclear pathway');
          }
          if (et === 'STRAIT_DISRUPTION' || et === 'PORT_DISRUPTION' || et === 'TANKER_THREAT') {
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — pipeline/shipping pathway');
          }
          if (et === 'REFINERY_ATTACK' || et === 'SANCTIONS' || et === 'OIL_SHOCK') {
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — oil supply pathway');
          }
          if (et === 'CYBER_ATTACK') {
            this._activeConditions.push('grid_stress'); // CYBER_ATTACK on energy = grid threat
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — grid pathway');
          }
        } else {
          signals.push('EXPIRED: ' + (sig.eventType || '').replace(/_/g, ' ').toLowerCase() + ' (age: ' + Math.round(sigAge / 60000) + 'm) — ignored');
        }
      }
    }

    // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (RSS counts + Federal Register + reused NWS/CISA) ──
    // Maps the 15 keyless feeds to energy-brain diagnosis triggers.
    for (var f3i = 0; f3i < feeds.length; f3i++) {
      var f3 = feeds[f3i];
      var fn3 = (f3.name || '').toLowerCase();

      // EIA Weekly Petroleum Status — RSS article count is news-pressure proxy.
      // Patch D2-E3: article counts must NOT push crude_above_* (those are
      // price-level conditions reserved for D2-E2-guarded canonical-price
      // feeds). Article count maps to soft systemic stress instead.
      if (fn3.indexOf('eia weekly petroleum') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('energy_high_stress');
        signals.push('EIA Petroleum: ' + f3.value + ' articles — news pressure');
      }
      if (fn3.indexOf('eia weekly petroleum') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('structural_stress');
      }

      // EIA Natural Gas Weekly
      if (fn3.indexOf('eia natural gas') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('chokepoint');
        signals.push('EIA Natural Gas: ' + f3.value + ' articles — gas supply pressure');
      }

      // EIA Electricity Monthly — generation mix / grid pressure
      if (fn3.indexOf('eia electricity') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('generation_mix');
        signals.push('EIA Electricity: ' + f3.value + ' articles');
      }
      if (fn3.indexOf('eia electricity') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('grid_stress');
      }

      // IEA Energy News — broad institutional
      if (fn3.indexOf('iea energy') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('energy_high_stress');
        signals.push('IEA: ' + f3.value + ' articles');
      }

      // OPEC Reference Basket — RSS article count is news-pressure proxy.
      // Patch D2-E3: article counts must NOT push OIL_SHOCK or SANCTIONS
      // (those are event-level conditions). Article count maps to soft
      // systemic stress instead. A genuine OPEC reference-basket price feed
      // (numeric $/bbl) would be picked up by the D2-E2-guarded canonical
      // crude block, which positively matches 'opec' / 'reference basket'.
      if (fn3.indexOf('opec') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('energy_high_stress');
        signals.push('OPEC: ' + f3.value + ' articles — news pressure');
      }
      if (fn3.indexOf('opec') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('structural_stress');
      }

      // Solar Industry News — renewable / generation_mix
      if (fn3.indexOf('solar industry') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('generation_mix');
      }

      // Wind Energy News — renewable / weather-dependent generation
      if (fn3.indexOf('wind energy') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('generation_mix');
        this._activeConditions.push('storage_low');
      }

      // Nuclear Energy News — RSS article count is news-pressure proxy.
      // Patch D2-E3: news article counts must NOT push NUCLEAR_THREAT or
      // MILITARY_ESCALATION (those are event-level conditions reserved for
      // fresh defenseSignals events and Fed Reg NRC regulatory documents).
      // Article count maps to soft systemic stress instead.
      if (fn3.indexOf('nuclear energy') !== -1 && f3.value !== undefined && f3.value >= 20) {
        this._activeConditions.push('energy_high_stress');
        signals.push('Nuclear News: ' + f3.value + ' articles — news pressure');
      }
      if (fn3.indexOf('nuclear energy') !== -1 && f3.value !== undefined && f3.value >= 50) {
        this._activeConditions.push('structural_stress');
      }

      // Grid Reliability (FERC/NERC) — GRID_COLLAPSE primary
      if (fn3.indexOf('grid reliability') !== -1 && f3.value !== undefined && f3.value >= 20) {
        this._activeConditions.push('grid_stress');
        signals.push('Grid Reliability: ' + f3.value + ' articles');
      }
      if (fn3.indexOf('grid reliability') !== -1 && f3.value !== undefined && f3.value >= 50) {
        this._activeConditions.push('infrastructure_cross');
      }

      // LNG Market News — RSS article count is supply-pressure proxy.
      // Patch D2-E3: news article counts must NOT push STRAIT_DISRUPTION
      // (event-level condition reserved for fresh defenseSignals events).
      // Article count maps to chokepoint (supply-chain pressure) instead.
      if (fn3.indexOf('lng market') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('chokepoint');
        signals.push('LNG Market: ' + f3.value + ' articles — supply pressure');
      }

      // Coal Transition News — generation_mix retirement signal
      if (fn3.indexOf('coal transition') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('generation_mix');
        this._activeConditions.push('structural_stress');
      }

      // NOAA NWS Alerts (reused from supplyChain) — weather → GRID_COLLAPSE
      if (fn3.indexOf('nws alerts') !== -1 && f3.value !== undefined && f3.value >= 100) {
        this._activeConditions.push('weather_extreme');
        signals.push('NWS: ' + f3.value + ' active alerts — grid weather risk');
      }
      if (fn3.indexOf('nws alerts') !== -1 && f3.stress !== undefined && f3.stress >= 0.5) {
        this._activeConditions.push('grid_stress');
      }

      // CISA KEV (reused from supplyChain) — cyber → GRID_COLLAPSE
      if (fn3.indexOf('cisa kev') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('CYBER_ATTACK');
        signals.push('CISA KEV: ' + f3.value + ' new exploited CVEs (30d)');
      }
      if (fn3.indexOf('cisa kev') !== -1 && f3.value !== undefined && f3.value >= 25) {
        this._activeConditions.push('grid_stress');
      }

      // Fed Reg NRC — Nuclear Regulatory Commission → NUCLEAR_INCIDENT
      if (fn3.indexOf('fed reg nrc') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('NUCLEAR_THREAT');
        signals.push('Fed Reg NRC: ' + f3.value + ' nuclear regulatory docs (30d)');
      }
      if (fn3.indexOf('fed reg nrc') !== -1 && f3.value !== undefined && f3.value >= 6) {
        this._activeConditions.push('MILITARY_ESCALATION');
      }

      // Fed Reg DOE — Department of Energy → SYSTEMIC_ENERGY_STRESS
      if (fn3.indexOf('fed reg doe') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('energy_high_stress');
        signals.push('Fed Reg DOE: ' + f3.value + ' DOE regulatory docs (30d)');
      }
      if (fn3.indexOf('fed reg doe') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('structural_stress');
      }
    }

    // Macro shock
    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // ── NO STRESS-ONLY CATCH-ALLS ──
    // energy_high_stress and structural_stress are tracked for reporting
    // but they do NOT activate specific diagnoses (enforced by evidence contracts)
    if (this.state.stress >= 0.70) this.state._stressFlag = 'HIGH';
    else if (this.state.stress >= 0.50) this.state._stressFlag = 'ELEVATED';
    else this.state._stressFlag = 'NORMAL';

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 3 OVERRIDE: Score stress — K1 afferent integration (closed loop)
  // Base scoreStress reads stress from the snapshot; every OTHER domain then folds in
  // received cross-domain pressure. Energy previously did not. This restores it:
  // getExternalPressure() (base-capped at 0.3, decayed) is added to stress live each cycle.
  // ══════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype.scoreStress = function () {
    var self = this;
    return Base.prototype.scoreStress.call(this).then(function () {
      // Capture the snapshot's stress-threshold phase BEFORE any node-grounded arming
      // overwrites s.phase later this cycle. This is the honest "what the prior-only
      // heuristic reported" baseline for the shadow comparison, and it is reset from
      // the snapshot every cycle here (so arming s.phase never feeds back as the prior).
      self._phaseHeuristicRaw = self.state.phase;
      // Base already folded afferent (external pressure) into stress and set
      // _externalPressureApplied. Add ONLY the operator request-steer bias here, keeping the
      // combined injection <= 0.3 so steer never dominates perception.
      var ext = self.state._externalPressureApplied || 0;
      // K1 (learned): re-scale the afferent pressure the base applied at weight 1.0, once the layer earns it.
      var _W1 = self._learnedVec('K1_pressure', [1.0]);
      if (_W1[0] !== 1 && ext > 0) self.state.stress = Math.max(0, Math.min(1, (self.state.stress || 0) + (_W1[0] - 1) * ext));
      var rb = self._readRequestBiases ? self._readRequestBiases() : { stressBias: 0 };
      var reqDelta = Math.max(0, Math.min(0.3 - ext, rb.stressBias || 0));
      self.state._requestStressApplied = reqDelta;
      if (reqDelta > 0) self.state.stress = Math.max(0, Math.min(1, (self.state.stress || 0) + reqDelta));
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4 OVERRIDE: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  EnergyBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var issues = portal.issues || [];
      var conditions = self._activeConditions || [];

      self.state.diagnoses = issues.map(function (iss) {
        // Check if this diagnosis matches any active conditions
        var triggers = self.diagnosisIndex[iss.id] || [];
        var matchCount = 0;
        for (var t = 0; t < triggers.length; t++) {
          for (var c = 0; c < conditions.length; c++) {
            if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) {
              matchCount++;
            }
          }
        }

        var active = matchCount > 0;
        var relevance = triggers.length > 0 ? matchCount / triggers.length : 0;

        return {
          id: iss.id,
          label: iss.label,
          summary: iss.summary || '',
          active: active,
          relevance: Math.round(relevance * 100) / 100,
          matchedConditions: matchCount,
          totalTriggers: triggers.length,
          circuits: iss.circuits || [],
          source: 'canonical'
        };
      });

      // Sort: active diagnoses first, then by relevance
      self.state.diagnoses.sort(function (a, b) {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.relevance - a.relevance;
      });

      // After deriving diagnoses, trigger actions for newly activated ones
      self._checkDiagnosisActions();
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 5 OVERRIDE: Recommend treatments for active diagnoses
  // ══════════════════════════════════════════════════════════════════════

  EnergyBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) {
        self.state.treatments = [];
        return;
      }

      // Pull treatments from activations that match active diagnosis circuits
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var ci = 0; ci < circuits.length; ci++) {
          activeNodeIds[circuits[ci].nodeId] = activeDx[di].id;
        }
      }

      var treatments = [];
      var activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) {
        var act = activations[ai];
        var nodeId = act.brainNodeId;
        if (!activeNodeIds[nodeId]) continue;

        var actTreats = act.treatments || [];
        for (var ti = 0; ti < actTreats.length; ti++) {
          var t = actTreats[ti];
          treatments.push({
            id: 'treat_' + nodeId + '_' + ti,
            label: t.label,
            type: t.type,
            evidence: t.evidence,
            description: t.description || '',
            diagnosisId: activeNodeIds[nodeId],
            nodeId: nodeId,
            relevance: 1.0,
            source: 'canonical'
          });
        }
      }

      // Sort by evidence grade
      var evidenceRank = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) {
        return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0);
      });

      self.state.treatments = treatments;
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 6 OVERRIDE: Surface opportunities with capital classification
  // ══════════════════════════════════════════════════════════════════════

  // C6-followup: state.companies was starved — the server snapshot does not emit
  // domainCompanyJoin yet, so the base populator finds nothing. Load this domain's
  // real entities from command-board-data ONCE and use them as a fallback. Guarded:
  // on any failure _cbEnergyCompanies stays [] and behavior is unchanged (no breakage).
  EnergyBrain.prototype._loadCommandBoardCompanies = function () {
    var self = this;
    if (self._cbEnergyCompanies) return;            // one-shot
    self._cbEnergyCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbEnergyCompanies = arr
            .filter(function (x) { return x && x.d === 'energy' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
        })
        .catch(function () {});
    } catch (e) {}
  };

  // 2026-06-19: distress signals come ONLY from the validated Thing pipeline
  // (/api/brain-signals → publish gate → lib/thing-formulas). NEVER from the raw
  // command-board `phase`/`ds` (those are degenerate/noise). One-shot load; on any
  // failure _pubSignals stays {} → zero distressed-positioning opportunities (honest).
  EnergyBrain.prototype._loadBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                   // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=energy')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.publishable) return;
          var m = {};
          j.publishable.forEach(function (s) { if (s.ticker) m[s.ticker] = s; });
          self._pubSignals = m;                     // {} today (gate abstains on degenerate data)
        })
        .catch(function () {});
    } catch (e) {}
  };

  EnergyBrain.prototype.surfaceOpportunities = function () {
    // Call base to get companies + convergence
    Base.prototype.surfaceOpportunities.call(this);

    // C6-followup: if the snapshot didn't supply companies, fall back to real
    // command-board entities so opportunities are real, not scaffold.
    if ((!this.state.companies || !this.state.companies.length) && this._cbEnergyCompanies && this._cbEnergyCompanies.length) {
      this.state.companies = this._cbEnergyCompanies;
    }

    var opps = [];
    var stress = this.state.stress;
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    var allDx = this.state.diagnoses || [];
    var phase = this.state.phase;
    var companies = this.state.companies;
    var seen = {}; // dedupe by thesis, not by type

    function add(o) {
      var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen[key]) return;
      seen[key] = true;
      opps.push(o);
    }

    // ═══ TIER 1 — DIRECT (diagnosis-driven) ═══
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di];
      var dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');

      // Monitoring platform
      add({
        title: dxLabel + ' — monitoring and response platform',
        rank: stress * dx.relevance,
        path: 'RESEARCHABLE',
        urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Resilience infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — resilience infrastructure deployment',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
          urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Sector hedging
      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({
          title: dxLabel + ' — sector hedging and exposure management',
          rank: stress * 0.85,
          path: 'INVESTABLE',
          urgency: 'ACTIVE',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Technology adaptation
      add({
        title: dxLabel + ' — adaptive technology and automation',
        rank: stress * dx.relevance * 0.75,
        path: 'RESEARCHABLE',
        urgency: 'ACTIVE',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Company-driven — distress comes ONLY from the validated Thing pipeline
    // (_pubSignals), NEVER from the raw command-board `phase` (that field is noise:
    // NEE=p3 vs DUK=p0 for near-identical utilities). _pubSignals is {} until real
    // per-company scoring is validated, so these stay silent rather than fabricate.
    var pub = this._pubSignals || {};
    var terminalCompanies = companies.filter(function (c) { var s = pub[c.ticker]; return s && s.band === 'elevated'; });
    if (terminalCompanies.length > 0) {
      add({
        title: 'Energy elevated-distress company positioning',
        rank: 0.95,
        path: 'INVESTABLE',
        urgency: 'IMMEDIATE',
        source: 'company_terminal', tier: 1,
        companies: terminalCompanies.map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Moderate-distress companies (validated signal only)
    var stressedCompanies = companies.filter(function (c) { var s = pub[c.ticker]; return s && s.band === 'moderate'; });
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({
        title: 'Energy moderate-distress company selection',
        rank: stress * 0.80,
        path: 'INVESTABLE',
        urgency: 'ACTIVE',
        source: 'company_stressed', tier: 1,
        companies: stressedCompanies.slice(0, 5).map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Convergence
    if (this.state.convergence && this.state.convergence.primary_signal) {
      add({
        title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — energy convergence response',
        rank: 0.98,
        path: this.state.convergence.primary_signal === 'CONVERGENCE_TERMINAL' ? 'INVESTABLE' : 'RESEARCHABLE',
        urgency: 'IMMEDIATE',
        source: 'convergence', tier: 1,
        signal: this.state.convergence.primary_signal,
        stress: stress
      });
    }

    // ═══ TIER 2 — CROSS-DOMAIN (requires active diagnosis) ═══
    if (activeDx.length > 0) {
      var emissions = this.state.crossDomainEmissions || [];
      for (var ei = 0; ei < emissions.length; ei++) {
        var em = emissions[ei];
        var targetLabel = (em.targetDomain || '').replace(/_/g, ' ');
        var sigLabel = (em.signal || em.signalType || '').replace(/_/g, ' ');

        add({
          title: 'Energy \u2192 ' + targetLabel + ' transmission \u2014 ' + sigLabel + ' response',
          rank: (em.magnitude || 0.5) * stress * 0.8,
          path: 'INVESTABLE',
          urgency: em.magnitude > 0.6 ? 'IMMEDIATE' : 'ACTIVE',
          source: 'cross_domain', tier: 2,
          diagnosisId: activeDx[0].id,
          stress: stress
        });
      }
    }

    // ═══ TIER 3 — LAGGING (requires active diagnosis) ═══
    if (activeDx.length > 0 && stress >= 0.50) {
      add({
        title: 'Energy policy and regulatory response \u2014 permitting and compliance',
        rank: stress * 0.65,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'ACTIVE' : 'WATCH',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });

      add({
        title: 'Energy substitution acceleration \u2014 alternative fuel and storage',
        rank: stress * 0.70,
        path: 'RESEARCHABLE',
        urgency: 'ACTIVE',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });
    }

    if (activeDx.length > 0 && stress >= 0.60) {
      add({
        title: 'Grid and transmission hardening \u2014 infrastructure capital deployment',
        rank: stress * 0.75,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });

      add({
        title: 'Energy bottleneck positioning \u2014 constrained-capacity operators',
        rank: stress * 0.72,
        path: 'INVESTABLE',
        urgency: 'ACTIVE',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });
    }

    // Medium-confidence diagnoses (not active but close) → watchlist opportunities
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      var nd = nearDx[ndi];
      if (stress >= 0.45) {
        add({
          title: (nd.label || nd.id || '').replace(/_/g, ' ') + ' — early-stage monitoring position',
          rank: stress * (nd.relevance || 0.1) * 0.5,
          path: 'RESEARCHABLE',
          urgency: 'WATCH',
          source: 'near_diagnosis', tier: 2,
          diagnosisId: nd.id, stress: stress
        });
      }
    }

    // ═══ DATA-CENTER DIAGNOSIS LAYER → opportunities (real-content, bundle-backed) ═══
    // INVESTABLE / monitoring only — the DC bundles carry NO method/embodiment/figure
    // candidates, so only the investment lane is offered (consistent with the H3 conscience
    // veto). Companies are the real tickers mapped to each diagnosis's circuit nodes.
    var dcDiags = this.state.datacenterDiagnoses || [];
    var dcPortal = this._dcPortal;
    if (dcDiags.length && dcPortal) {
      var nodeCos = {};
      (dcPortal.activations || []).forEach(function (a) { if (a.brainNodeId) nodeCos[a.brainNodeId] = (a.companies || []).map(function (c) { return c.ticker_or_id || c.name; }); });
      for (var dci = 0; dci < dcDiags.length; dci++) {
        var ddx = dcDiags[dci];
        var dlab = (ddx.label || ddx.id || '').replace(/_/g, ' ');
        var cosSet = {};
        (ddx.circuits || []).forEach(function (c) { (nodeCos[c.nodeId] || []).forEach(function (tk) { cosSet[tk] = true; }); });
        var coList = Object.keys(cosSet);
        if (ddx.active) {
          add({
            title: dlab + ' — data-center infrastructure positioning',
            rank: stress * (ddx.relevance || 0.5) * 0.9,
            path: 'INVESTABLE',
            urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
            source: 'datacenter_diagnosis', diagnosisId: ddx.id, tier: 1, stress: stress,
            companies: coList, datacenter: true, bundleBacked: true
          });
          add({
            title: dlab + ' — monitoring and response platform',
            rank: stress * (ddx.relevance || 0.5) * 0.7,
            path: 'INVESTABLE',
            urgency: 'ACTIVE',
            source: 'datacenter_diagnosis', diagnosisId: ddx.id, tier: 1, stress: stress,
            companies: coList, datacenter: true, bundleBacked: true
          });
        } else if (stress >= 0.45) {
          add({
            title: dlab + ' — data-center demand monitoring (early-stage)',
            rank: stress * (ddx.relevance || 0.1) * 0.5,
            path: 'INVESTABLE',
            urgency: 'WATCH',
            source: 'datacenter_diagnosis', diagnosisId: ddx.id, tier: 2, stress: stress,
            companies: coList, datacenter: true, bundleBacked: true
          });
        }
      }
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // ── K2/K6/K7 CLOSED — apply attention boost, lateral inhibition, and gain-scaled
    // output cap from the PRIOR cycle's neuro layers (no-op on cycle 1). Recurrent by design.
    opps = this._applyNeuroGating(opps);

    // ═══ CANONICAL ENRICHMENT — merge playbook detail into each opportunity ═══
    // This is the single upstream enrichment point. Console, Opportunities page,
    // and Operator all read from state.opportunities and get the same object.

    // Diagnosis → playbook ID mapping
    var _PB_MAP = {
      'OIL_SHOCK': 'infra_demand', 'GRID_COLLAPSE': 'infra_demand',
      'PIPELINE_DISRUPTION': 'infra_demand', 'RENEWABLE_INTERMITTENCY': 'climate_energy',
      'NUCLEAR_INCIDENT': 'infra_demand', 'SYSTEMIC_ENERGY_STRESS': 'infra_demand',
      'ENERGY_DATACENTER_GRID_STRAIN': 'infra_demand', 'ENERGY_DATACENTER_WATER_STRESS': 'climate_energy'
    };
    var _SRC_MAP = {
      'company_terminal': 'infra_demand', 'company_stressed': 'infra_demand',
      'convergence': 'climate_energy', 'cross_domain': 'econ_supply', 'lagging': 'infra_demand',
      'datacenter_diagnosis': 'infra_demand'
    };

    // Playbook detail registry (inline — matches energy-opportunities.html playbooks)
    var _PB_DETAIL = {
      'infra_demand': {
        explain: 'Energy infrastructure stress is creating demand for grid resilience, generation capacity, and pipeline hardening. Companies and technologies that address structural energy gaps are positioned to capture premium pricing and procurement.',
        action: 'Position in energy infrastructure companies. Research the operators and technologies addressing grid resilience gaps.',
        valueRange: '10-30% sector premium',
        trigger: 'Energy stress > 0.50 with active diagnosis firing against live feed data.',
        validation: 'Confirm crude price feed LIVE. Check infrastructure stress. Verify diagnosis is evidence-grounded, not catch-all.',
        steps: ['Check Energy console — verify diagnosis is ACTIVE with evidence', 'Check PULSE panel — confirm feeds are FRESH', 'Review suggested targets — verify HELIX VALIDATED status', 'For INVEST: open investment console with target ticker', 'For RESEARCH: scope a brief on the exposed operators + technology gaps'],
        outcome: 'Energy infrastructure companies outperform during sustained stress. Research briefs build an information edge on the operators capturing the gap.',
        failure: 'Stress resolves quickly. Crude returns to baseline. Diagnosis deactivates. Seasonal or transient pattern.',
        window: '1-90 days',
        fastPath: ['1. Verify Energy stress > 50% with active diagnosis', '2. Check feed freshness in PULSE panel', '3. Execute: INVEST (position) or RESEARCH (brief on exposed operators)'],
        examples: ['NextEra Energy (NEE)', 'Duke Energy (DUK)', 'Quanta Services (PWR)', 'XLE Energy ETF', 'Enterprise Products (EPD)']
      },
      'climate_energy': {
        explain: 'Renewable energy transition is accelerating due to policy, pricing, or intermittency stress. Clean energy companies, storage technology, and nuclear alternatives are capturing capital flows.',
        action: 'Position in clean energy ETFs and individual renewable companies. Research the clean energy deployment landscape and the operators leading it.',
        valueRange: '15-40% clean energy sector returns',
        trigger: 'Renewable intermittency or climate policy signals active. Energy stress with clean energy convergence.',
        validation: 'Confirm renewable generation data. Check policy signals from governance domain. Verify transition is structural.',
        steps: ['Check Energy console for RENEWABLE_INTERMITTENCY or convergence signals', 'Verify clean energy policy signals from Governance domain', 'Review ICLN/TAN ETF performance for trend confirmation', 'For INVEST: position in FSLR, ENPH, CEG, or clean energy ETFs', 'For RESEARCH: scope a brief on battery/storage/grid technology gaps + the operators closing them'],
        outcome: 'Clean energy sector captures transition capital. Storage and grid modernization see accelerated procurement.',
        failure: 'Policy reversal. Fossil fuel price collapse reduces transition urgency. Technology setbacks.',
        window: '7-180 days',
        fastPath: ['1. Check if RENEWABLE_INTERMITTENCY or convergence is active', '2. Check ICLN/TAN on Yahoo Finance for confirmation', '3. Execute: buy FSLR/ENPH or produce a research brief on the transition operators'],
        examples: ['First Solar (FSLR)', 'Enphase Energy (ENPH)', 'Constellation Energy (CEG)', 'ICLN Clean Energy ETF', 'Cameco (CCJ)']
      },
      'econ_supply': {
        explain: 'Energy supply pressure is transmitting economic cost burden across sectors. Companies with pricing power or supply chain resilience benefit from the pass-through.',
        action: 'Position in integrated energy majors with pricing power. Monitor for downstream sector rotation.',
        valueRange: '10-25% energy major returns during supply pressure',
        trigger: 'Cross-domain energy emission firing. Supply chain and economy receiving energy stress signals.',
        validation: 'Confirm energy stress is transmitting to other domains via emissions. Check economy/supply chain domain stress.',
        steps: ['Check Energy console for active cross-domain emissions', 'Verify Economy and Supply Chain domains showing elevated stress', 'Confirm integrated majors have pricing power (check Helix reports)', 'For INVEST: position in XOM, CVX, COP', 'For RESEARCH: brief the supply-chain pass-through and the operators with pricing power', 'Monitor for downstream sector weakness (industrials, transport)'],
        outcome: 'Integrated energy companies capture margin expansion. A research brief maps the supply-chain pass-through and the beneficiaries.',
        failure: 'Supply pressure resolves. Demand destruction offsets pricing power. Government intervention caps prices.',
        window: '1-60 days',
        fastPath: ['1. Check Energy emissions to Economy/Supply Chain', '2. Check XOM/CVX on Yahoo Finance', '3. Buy integrated majors or produce a research brief on the pass-through beneficiaries'],
        examples: ['Exxon Mobil (XOM)', 'Chevron (CVX)', 'ConocoPhillips (COP)', 'Schlumberger (SLB)', 'HYG High Yield Bond ETF']
      }
    };

    for (var ei = 0; ei < opps.length; ei++) {
      var o = opps[ei];
      // Stable ID: diagnosis + path + tier hash
      o.id = (o.diagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);

      // Map to playbook
      var pbId = (o.diagnosisId && _PB_MAP[o.diagnosisId]) ? _PB_MAP[o.diagnosisId] : (_SRC_MAP[o.source] || null);
      o.playbookId = pbId;

      // Enrich with playbook detail
      var detail = pbId ? (_PB_DETAIL[pbId] || null) : null;
      if (detail) {
        o.explain = detail.explain;
        o.action = detail.action;
        o.valueRange = detail.valueRange;
        o.trigger = detail.trigger;
        o.validation = detail.validation;
        o.steps = detail.steps;
        o.outcome = detail.outcome;
        o.failure = detail.failure;
        o.window = detail.window;
        o.fastPath = detail.fastPath;
        o.examples = detail.examples;
      }

      // Domain metadata
      o.domain = 'energy';
      o.confidence = Math.round(Math.min(1, Math.max(0, (o.rank || 0))) * 100);
      o.whyNow = o.title;

      // ── COMPENSATION MODEL ──
      // Lanes: investment + research ONLY (patent/grant/loan purged 2026-06-21; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
      var _COMP = {
        'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
        'RESEARCHABLE': { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },     maxTier: { tier: 3, comp: 15 } }
      };
      o.compensation = _COMP[o.path] || { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 outcomes' }, maxTier: { tier: 3, comp: 15 } };

      // Business-type opportunities get business compensation
      var titleLow = (o.title || '').toLowerCase();
      var isBizType = titleLow.indexOf('infrastructure') !== -1 || titleLow.indexOf('platform') !== -1 || titleLow.indexOf('system') !== -1 || titleLow.indexOf('monitoring') !== -1 || titleLow.indexOf('deployment') !== -1 || titleLow.indexOf('grid') !== -1 || titleLow.indexOf('hardening') !== -1 || o.source === 'lagging';
      if (isBizType) {
        o.paths = [o.path, 'BUSINESS'];
        o.compensation_business = { type: 'business', base: 20, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 25, requirement: '3 businesses launched' }, maxTier: { tier: 3, comp: 35 } };
      } else {
        o.paths = [o.path];
      }

      // ── VALIDITY LIFECYCLE ──
      o.validity = {
        createdAt: Date.now(),
        lastValidated: Date.now(),
        expiryWindowDays: o.tier === 1 ? 30 : o.tier === 2 ? 60 : 90,
        requiresRevalidation: false,
        invalidationReasons: []
      };

      // ── WHY THIS MAKES MONEY (execution intelligence per opportunity) ──
      var stressPct = Math.round((o.stress || 0) * 100);
      var confPct = o.confidence || 0;
      var dxLabel = (o.diagnosisId || '').replace(/_/g, ' ').toLowerCase();
      var titleLc = (o.title || '').toLowerCase();
      var src = o.source || '';
      var compList = (o.companies && o.companies.length) ? o.companies.join(', ') : '';
      var exList = (o.examples && o.examples.length) ? o.examples.join(', ') : '';

      // ── DO THIS (imperative, opportunity-specific) ──
      var doThis = '';
      if (src === 'company_terminal') {
        doThis = 'Review the energy companies LIMEN\'s validated distress screen flags as ELEVATED (' + (compList || 'see company list') + '). Verify each against current filings before any position; this is a screen, not a recommendation.';
      } else if (src === 'company_stressed') {
        doThis = 'Review the energy companies flagged MODERATE by the validated distress screen (' + (compList || 'see company list') + '). Look for recovery catalysts or further deterioration; verify independently.';
      } else if (src === 'convergence') {
        if (o.path === 'INVESTABLE') doThis = 'Multiple stress signals are converging. Position in diversified energy exposure (' + (exList || 'broad energy ETFs') + ') to capture systemic repricing across the sector.';
        else doThis = 'Convergence stress warrants a research brief. Document the overlapping disruptions and the systemic mechanism connecting them — a cross-vector analysis that maps the affected operators and the repricing path.';
      } else if (src === 'cross_domain') {
        doThis = 'Energy stress is transmitting into adjacent sectors. Position in cross-sector beneficiaries — companies with pricing power or supply-chain resilience that profit from energy cost pass-through. Monitor ' + (exList || 'integrated majors, pipeline operators') + '.';
      } else if (src === 'diagnosis' && o.path === 'RESEARCHABLE') {
        if (titleLc.indexOf('monitoring') !== -1 || titleLc.indexOf('response') !== -1) doThis = 'Produce a research brief on ' + dxLabel + ' monitoring/response systems. Map real-time detection methods, automated alerting, and adaptive response protocols, and which operators are deploying them.';
        else if (titleLc.indexOf('adaptive') !== -1 || titleLc.indexOf('automation') !== -1) doThis = 'Research adaptive automation approaches to ' + dxLabel + ' conditions. Document the gap between current manual response protocols and AI/ML-driven systems, and identify the vendors and operators closing it.';
        else doThis = 'Identify the specific technology gap created by ' + dxLabel + '. Draft a research brief on the solution architecture and the companies positioned to capture the white space.';
      } else if (src === 'diagnosis' && o.path === 'INVESTABLE') {
        doThis = 'Open hedging positions against ' + dxLabel + ' exposure. Use sector ETFs and individual names (' + (exList || 'energy sector leaders') + '). Size for the stress level — ' + stressPct + '% stress warrants meaningful allocation.';
      } else if (src === 'lagging' && o.path === 'RESEARCHABLE') {
        doThis = 'Produce a research brief on alternative fuel or long-duration storage technology that addresses the substitution gap. Focus on the specific failure mode the current energy mix cannot cover and the operators/technologies positioned to fill it.';
      } else if (src === 'lagging' && titleLc.indexOf('grid') !== -1) {
        doThis = 'Position in grid hardening and transmission infrastructure companies. Target utilities, EPC contractors, and grid hardware vendors accelerating capex in response to stress. Monitor ' + (exList || 'Quanta Services (PWR), EATON, Hubbell') + '.';
      } else if (src === 'lagging' && titleLc.indexOf('bottleneck') !== -1) {
        doThis = 'Identify constrained-capacity operators benefiting from the bottleneck. These companies have pricing power because supply cannot expand fast enough. Position in pipeline operators, LNG terminals, and capacity-constrained utilities.';
      } else if (src === 'near_diagnosis') {
        doThis = 'This diagnosis is not yet active but showing early signals. Set up a monitoring position — small paper allocation or watchlist entry. Be ready to scale if the diagnosis activates.';
      } else {
        doThis = o.action || ('Execute on ' + (o.title || 'this opportunity') + ' via the ' + (o.path || '').replace(/-/g, ' ').toLowerCase() + ' path.');
      }

      // ── WHY THIS PAYS (monetization path) ──
      var whyPays = '';
      if (o.path === 'INVESTABLE') {
        if (src === 'company_terminal') whyPays = 'Companies the validated screen flags as elevated-distress are often mispriced — restructuring, acquisition, or recovery can re-rate them. Validated structural-distress signal only; not a price target, not advice.';
        else if (src === 'company_stressed') whyPays = 'Moderate-distress names can trade at a fear discount that recovery re-rates. Validated screen signal only — verify independently; not advice.';
        else if (src === 'cross_domain') whyPays = 'Cross-sector transmission means energy costs flow into margins of downstream companies. Integrated majors and pipeline operators capture the spread. ' + (o.valueRange || '10-25% sector premium during sustained stress') + '.';
        else if (titleLc.indexOf('grid') !== -1 || titleLc.indexOf('hardening') !== -1) whyPays = 'Grid hardening is mandatory capex — utilities must spend regardless of macro conditions. EPC firms and hardware vendors see revenue acceleration. ' + (o.valueRange || '15-30% infrastructure premium') + '.';
        else if (titleLc.indexOf('bottleneck') !== -1) whyPays = 'Capacity constraints create pricing power. Operators with constrained assets earn premium margins until new capacity comes online (typically 2-5 years). ' + (o.valueRange || '20-40% margin expansion') + '.';
        else whyPays = 'Market repricing follows confirmed stress. Companies positioned to benefit see re-rating as the diagnosis persists. ' + (o.valueRange || '10-30% sector premium') + '.';
      } else if (o.path === 'RESEARCHABLE') {
        if (titleLc.indexOf('monitoring') !== -1) whyPays = 'A monitoring/response research brief is sellable to utilities, grid operators, and analysts tracking the affected region — and surfaces the investable operators building the detection methodology. ' + (o.valueRange || 'institutional research credit') + '.';
        else if (titleLc.indexOf('storage') !== -1 || titleLc.indexOf('substitution') !== -1) whyPays = 'Storage and alternative-fuel research addresses a structural gap that will persist for decades. The brief maps the technologies and the utilities, storage integrators, and EPC firms positioned to capture it. ' + (o.valueRange || 'institutional research credit') + '.';
        else if (titleLc.indexOf('adaptive') !== -1 || titleLc.indexOf('automation') !== -1) whyPays = 'Automation for energy stress response has no dominant incumbent. A research brief on the landscape identifies the first-movers and the operators worth positioning in. ' + (o.valueRange || 'institutional research credit') + '.';
        else whyPays = 'Technology gaps exposed by ' + dxLabel + ' are under-analyzed. A research brief builds an information edge on the operators and vendors closing them. ' + (o.valueRange || 'institutional research credit') + '.';
      } else {
        whyPays = o.valueRange ? ('Value range: ' + o.valueRange) : 'Revenue generated through direct service delivery to entities affected by the diagnosed condition.';
      }

      // ── TARGET (specific counterparties) ──
      var target = '';
      if (compList) target = 'Mapped companies: ' + compList + '.';
      if (exList && !compList) target = (target ? target + ' ' : '') + 'Target names: ' + exList + '.';
      if (o.path === 'RESEARCHABLE') target += (target ? ' ' : '') + 'Research buyers/subjects: utilities, grid operators, EPC firms, storage integrators, energy management platforms, sector analysts.';
      else if (o.path === 'INVESTABLE' && !compList && !exList) target = 'Screen energy sector for companies with direct exposure to ' + dxLabel + '. Prioritize those with capex commitments, contracted revenue, or regulatory mandates.';
      if (!target) target = 'Identify counterparties directly affected by ' + (o.title || 'this condition') + '.';

      // ── TIMING (context-specific) ──
      var timing = '';
      if (o.urgency === 'IMMEDIATE') timing = 'Immediate — stress at ' + stressPct + '% demands action within days, not weeks.';
      else if (o.urgency === 'ACTIVE') timing = 'Near-term — execute within 1-4 weeks while stress holds at ' + stressPct + '%.';
      else if (o.urgency === 'WATCH') timing = 'Watchlist — monitor for activation trigger. Prepare execution materials now, deploy when diagnosis confirms.';
      else timing = o.window || 'Execute within the current stress window.';
      if (o.path === 'RESEARCHABLE' && timing.indexOf('brief') === -1) timing += ' Research brief: 1-3 weeks to produce while the diagnosis is live.';

      // ── INVALID IF (disconfirming conditions) ──
      var invalidIf = '';
      if (src === 'company_terminal') invalidIf = 'The validated distress signal clears (band drops below elevated) or domain stress falls below 40%.';
      else if (src === 'company_stressed') invalidIf = 'The distress band resolves to low, or deteriorates to elevated (downside, not recovery).';
      else if (src === 'cross_domain') invalidIf = 'Cross-domain transmission stops — energy stress contained without downstream propagation. Receiving domains absorb the shock without repricing.';
      else if (src === 'convergence') invalidIf = 'Convergence signals decouple — individual stresses resolve independently. No systemic amplification observed.';
      else if (src === 'near_diagnosis') invalidIf = 'Diagnosis fails to activate. Feed evidence contradicts the emerging signal. Stress falls below 45%.';
      else invalidIf = (o.failure || 'Diagnosis deactivates. Stress drops below 50%. Feed evidence contradicts the thesis.') + (stressPct < 55 ? ' Current stress (' + stressPct + '%) is near invalidation threshold — monitor closely.' : '');

      // ── EVIDENCE (current system state) ──
      var evidence = 'Domain: energy. Stress: ' + stressPct + '%.';
      if (confPct) evidence += ' Confidence: ' + confPct + '%.';
      if (o.diagnosisId) evidence += ' Active diagnosis: ' + dxLabel + '.';
      if (src === 'cross_domain') evidence += ' Cross-domain emission detected — energy stress propagating to adjacent sectors.';
      if (src === 'convergence') evidence += ' Multiple stress vectors converging — systemic risk elevated.';
      if (compList) evidence += ' Mapped companies: ' + compList + '.';
      evidence += ' ' + (o.trigger || 'Live feed data confirms current conditions.');

      // ── NEXT EXECUTION STEP ──
      var nextStep = '';
      if (o.path === 'INVESTABLE') {
        if (compList) nextStep = 'Pull up ' + o.companies[0] + ' on the investment console. Verify Helix phase and set entry parameters.';
        else if (exList) nextStep = 'Check ' + o.examples[0] + ' current price and Helix validation status. Set alert for entry signal.';
        else nextStep = 'Run sector screen for companies with highest exposure to ' + dxLabel + '. Build a 5-name watchlist.';
      } else if (o.path === 'RESEARCHABLE') {
        nextStep = 'Scope a research brief on "' + (dxLabel || 'energy stress response') + '" — frame the question from the live diagnosis, then pull primary sources (EIA/IEA/NERC/FERC) and map the exposed operators.';
      } else {
        nextStep = (o.fastPath && o.fastPath.length) ? o.fastPath[0] : 'Open opportunity detail and begin execution checklist.';
      }

      o.moneyChain = {
        doThis: doThis,
        whyPays: whyPays,
        target: target,
        timing: timing,
        invalidIf: invalidIf,
        evidence: evidence,
        nextStep: nextStep
      };
    }

    // HALT BRAKE - hold / dampen the opportunity set when the stop-circuit is engaged (prior cycle).
    opps = this._applyEmissionBrake(opps);

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;

    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // ACTION PIPELINE — the brain acts, not just thinks
  // ══════════════════════════════════════════════════════════════════════

  EnergyBrain.prototype._checkDiagnosisActions = function () {
    // HALT BRAKE - do not emit action drafts while the stop-circuit is engaged (prior cycle).
    var _brake = this.state.energyBrake;
    if (_brake && _brake.suppressActions) { this.state._brakeHeldActions = (this.state._brakeHeldActions || 0) + 1; return; }
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    // Check if action adapters are available
    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    // Lazy-init the refractory limiter (III.3) from the doc-grounded module. Best-effort:
    // if the module is not loaded or actuation is off, the gate is simply skipped (prior behavior).
    if (!this._refractoryLimiter && this._actuation && this._actuation.refractory &&
        typeof window !== 'undefined' && window.EnergyRefractoryLimiter) {
      try { this._refractoryLimiter = new window.EnergyRefractoryLimiter.RefractoryLimiter(this._refractoryParams); } catch (_e) { this._refractoryLimiter = null; }
    }

    // For each newly active diagnosis, create action drafts
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];

      // Only create drafts if we haven't already for this diagnosis
      var existingDrafts = adapters.getDrafts({ domain: 'energy', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

      // REFRACTORY GATE (III.3, overlay-driven): once this diagnosis has emitted, suppress
      // re-emission within the dead-time unless stress clears the (reduced-sensitivity) override
      // bar. Uses the overlay/pulse timestamp so it tracks live time. The diagnosis stays active
      // and displayed — only the duplicate DRAFT is withheld. Never breaks the cycle.
      if (this._refractoryLimiter) {
        try {
          var _now = (this._runtimeOverlay && this._runtimeOverlay.timestamp) ||
                     (this.state.pulse && this.state.pulse.timestamp) ||
                     ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0);
          var _verdict = this._refractoryLimiter.fire(dx.id, _now, this.state.stress);
          if (!_verdict.allowed) {
            this.state._refractorySuppressed = (this.state._refractorySuppressed || 0) + 1;
            continue;
          }
        } catch (_e) { /* gate is best-effort; fall through to normal emission */ }
      }

      // Draft a report for this diagnosis
      adapters.createDraft('REPORT_GENERATION', {
        domain: 'energy',
        sourceType: 'domain_brain',
        sourceId: dx.id,
        intentId: dx.id,
        title: 'Energy Alert: ' + dx.label,
        intent: {
          domain: 'energy',
          title: dx.label,
          status: 'ACTIVE',
          priority: this.state.stress,
          progress: 0,
          strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on energy operations', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected companies and infrastructure', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate capital opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  /**
   * Resolve deep portal content for all active diagnoses.
   * Populates this.state.resolvedContent with citations, steps, monitoring.
   */
  EnergyBrain.prototype.resolveDeepContent = function () {
    var self = this;
    var resolver = window.LIMENPortalContentResolver;
    if (!resolver) return Promise.resolve();

    return resolver.resolveForBrain(this.state).then(function (content) {
      self.state.resolvedContent = content;
      if (content) {
        // Update treatments with deep versions
        var deepTreats = [];
        for (var dxId in content.byDiagnosis) {
          var dxContent = content.byDiagnosis[dxId];
          for (var i = 0; i < dxContent.treatments.length; i++) {
            var t = dxContent.treatments[i];
            deepTreats.push({
              id: 'deep_' + t.nodeId + '_' + i,
              label: t.label,
              type: t.type,
              evidence: t.evidence,
              description: t.description,
              cite: t.cite,
              steps: t.steps,
              monitoring: t.monitoring,
              escalation: t.escalation,
              diagnosisId: dxId,
              nodeId: t.nodeId,
              nodeLabel: t.nodeLabel,
              hasDepth: t.hasDepth,
              source: 'canonical_deep'
            });
          }
        }
        if (deepTreats.length > 0) self.state.treatments = deepTreats;
      }
    }).catch(function () {});
  };

  // Override cycle to include deep content resolution + pulse computation
  var _origCycle = EnergyBrain.prototype.cycle;
  EnergyBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Compute pulse — evidence validation + delta detection + freshness
      var pulse = window.LIMENEnergyPulse;
      if (pulse && typeof pulse.computePulse === 'function') {
        // Pass _activeConditions to the pulse engine via state
        self.state._activeConditions = self._activeConditions || [];
        var pulseState = pulse.computePulse(self.state);
        self.state.pulse = pulseState;

        // Apply evidence contract validation — block diagnoses without proper evidence
        if (pulseState && pulseState.validatedDiagnoses) {
          for (var vdi = 0; vdi < pulseState.validatedDiagnoses.length; vdi++) {
            var vdx = pulseState.validatedDiagnoses[vdi];
            // Find matching diagnosis in state and update active flag
            for (var sdi = 0; sdi < self.state.diagnoses.length; sdi++) {
              if (self.state.diagnoses[sdi].id === vdx.diagnosis.id) {
                if (vdx.blocked) {
                  // Evidence contract blocked this — deactivate
                  self.state.diagnoses[sdi].active = false;
                  self.state.diagnoses[sdi].blocked = true;
                  self.state.diagnoses[sdi].blockReason = vdx.reason;
                } else {
                  self.state.diagnoses[sdi].blocked = false;
                  self.state.diagnoses[sdi].evidenceReason = vdx.reason;
                }
                break;
              }
            }
          }
          // Re-sort after validation
          self.state.diagnoses.sort(function (a, b) {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return b.relevance - a.relevance;
          });
        }

        // Neuro-substrate telemetry: map the live pulse -> runtime overlay (additive, best-effort).
        // Self-contained (adapter loads its own energy def); async fire-and-forget; never breaks the cycle.
        try {
          if (window.EnergyTelemetryAdapter && typeof window.EnergyTelemetryAdapter.fromLiveCached === 'function') {
            window.EnergyTelemetryAdapter.fromLiveCached(self.state, self._runtimeOverlay || null)
              .then(function (ov) { if (ov) self._runtimeOverlay = ov; })
              .catch(function () {});
          }
        } catch (_e) { /* overlay is best-effort */ }
      }
    }).then(function () {
      // PHASE B — recurrent loop step. Runs AFTER the pipeline settles, reads the
      // prior produced by the PREVIOUS cycle, computes prediction error, regulates,
      // and updates the next prior. Energy-local + try/caught (never breaks a cycle).
      try { self._updateEnergyModel(); } catch (e) {}
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — ENERGY RECURRENT LOOP v1 (energy-local, additive, reversible)
  // Converts re-running inference into a recurrent loop:
  //   prior → observation → prediction error → bounded update → next prior.
  // Proof surface: window.LIMENEnergyBrain.state.energyModel
  // ════════════════════════════════════════════════════════════════════════════
  var EM_VERSION = 1;
  var EM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var EM_SLOW_RATE = 0.08;              // slow consolidation (reserved for rebuild/cron)
  var EM_STRESS_FLOOR = 0.30;           // below this → no handoff
  var EM_FLOOD_CAP = 12;                // opportunity-flood threshold
  var EM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness

  function _emClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _emJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    var seen = {};
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  EnergyBrain.prototype._neutralEnergyModel = function () {
    return {
      version: EM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: EM_LEARNING_RATE, slowRate: EM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  // B2 — normalized observation from current Energy state
  EnergyBrain.prototype._buildObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var feeds = s.feeds || {}, feedCount = 0, newest = 0;
    for (var k in feeds) { if (feeds.hasOwnProperty(k)) { feedCount++; var u = feeds[k] && feeds[k].updated; if (u && u > newest) newest = u; } }
    return {
      stress: typeof s.stress === 'number' ? s.stress : 0,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: Math.min(1, feedCount / 8),
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  // B3 — prediction error: prior.expected* vs observation
  EnergyBrain.prototype._computePredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _emJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    // K5 CLOSED - deep-perception error now sourced from the perception-depth layer (prior cycle; 0 on cycle 1)
    var _pd = this.state.energyPerceptionDepth;
    var portalError = (_pd && typeof _pd.portalErrorEstimate === 'number') ? _pd.portalErrorEstimate : 0;
    // K5 weights: the LEARNED vector once the layer has earned live control (self-gated), else the seed.
    var W5 = this._learnedVec('K5_pe', [0.35, 0.2, 0.25, 0.15, 0.05]);
    var total = _emClamp(W5[0] * stressError + W5[1] * signalError + W5[2] * diagnosisError + W5[3] * opportunityError + W5[4] * portalError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, portalError: portalError, novelty: novelty };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  EnergyBrain.prototype._updatePrior = function (prior, obs, lr) {
    return {
      expectedStress: _emClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _emClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _emClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // B5 — local regulation: inhibition / gain / homeostatic set-points
  EnergyBrain.prototype._computeRegulation = function (em, obs, pe) {
    var gain = _emClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _emClamp(1 - pe.novelty, 0, 0.9);
    var _W2 = this._learnedVec('K2_gain', [0.5]);                 // K2 (learned): inhibition→outputScale coupling
    var outputScale = _emClamp(1 - inhibition * _W2[0], 0.4, 1);
    var starving = obs.stress >= EM_STRESS_FLOOR && obs.opportunityCount === 0;
    // K2 stability - hysteresis so flooding does not flip each cycle at the boundary (fixes oscillation):
    // engages above the cap, releases only below 75% of it.
    var floodOn = em._floodingOn || false;
    var flooding = floodOn ? (obs.opportunityCount > EM_FLOOD_CAP * 0.75) : (obs.opportunityCount > EM_FLOOD_CAP);
    em._floodingOn = flooding;
    var streak = (pe.total < 0.05) ? (em._lowErrorStreak || 0) + 1 : 0;
    em._lowErrorStreak = streak;
    var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > EM_STALE_MS : false;
    var overconfident = em.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconfident, state: label };
  };

  // The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle,
  // so cycle N+1's interpretation (predictedStress, readyForHandoff) depends on cycle N.
  EnergyBrain.prototype._updateEnergyModel = function () {
    var em = this.state.energyModel || this._neutralEnergyModel();
    var priorIn = em.prior;                                   // carried from last cycle
    var obs = this._buildObservation();
    var pe = this._computePredictionError(priorIn, obs);      // prior vs now

    // reads prior BEFORE the final decision (Kalman-style blend, not raw obs):
    var gainBlend = _emClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeRegulation(em, obs, pe);

    // K8 CLOSED - homeostatic set-point: handoff gates on a 50/50 blend of the fixed floor
    // and the adaptive baseline (prior cycle; needs >=10 samples, else the fixed floor).
    // K8 stability - bound the adaptive floor to at most +0.15 above the fixed floor so a
    // sustained-stress baseline cannot ratchet the handoff gate out of reach.
    var _hm = this.state.energyHomeostasis;
    var _floor = (_hm && typeof _hm.adaptiveBaseline === 'number' && _hm.samples >= 10)
      ? (function (self) { var _W8 = self._learnedVec('K8_floor', [0.5, 0.5]); return _emClamp(Math.min(_W8[0] * EM_STRESS_FLOOR + _W8[1] * _hm.adaptiveBaseline, EM_STRESS_FLOOR + 0.15), 0.15, 0.6); })(this) : EM_STRESS_FLOOR;
    em._effectiveFloor = _floor;

    // a FINAL decision that depends on the prior, not just on raw obs:
    var readyForHandoff = (em.cycle > 0) && (predictedStress >= _floor) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // K4 CLOSED - credit assignment routed through the central honest reward gate
    // (window.LIMENK4.credit). Energy is NOT externalRewardEligible: it has no external
    // realized-outcome label, so externalOutcome is ALWAYS null and its credit is
    // self-consistency calibration only (interpretive), NEVER reward. The gate enforces the
    // preemption: external-reward(4) > phase-consistency(3) > call-consistency(2) >
    // stress-consistency(1) > none. Pure math, no AI/network on the cycle.
    var _om = this.state.energyOutcomeModel, _led = this.state.energyOutcomeLedger;
    var _lr = em.plasticity.learningRate;
    // thing2 realized phase transition: did a predicted transition actually occur over time.
    // This is SELF-CONSISTENCY calibration (interpretive), NOT external reward. validated =>
    // P3/P7 family gate. One-cycle lag (reads prior energyPhaseDynamics); live only when the
    // phase actuation is on (else energyPhaseDynamics.transition is absent).
    var _pt = (this.state.energyPhaseDynamics || {}).transition;
    var _ptActive = !!(this._actuation && this._actuation.phase && _pt && _pt.hit !== null);
    // Signal built from what the brain already computed. externalOutcome MUST be null.
    var _sig = {
      externalOutcome: null,                                              // NOT eligible: self-consistency only, never reward
      phaseValidated: !!(_pt && _pt.validated),                           // P3/P7 family gate for phase-consistency tier
      phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,           // thing2 transition hit (interpretive)
      callHitRate: (_led && typeof _led.callHitRate === 'number') ? _led.callHitRate : null,   // TRUTH BRAKE ledger
      callSamples: (_led && typeof _led.resolvedSamples === 'number') ? _led.resolvedSamples : 0,
      stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,            // stress self-prediction
      stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
    };
    var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
      ? window.LIMENK4.credit(_sig) : null;
    var _hit, _creditSource, _isReward;
    if (_k4) {
      _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
      _creditSource = _k4.creditSource;
      _isReward = !!_k4.isReward;                                         // ALWAYS false for energy (not externalRewardEligible)
    } else {
      // FALLBACK (gate absent) - prior credit behavior preserved, same preemption, in-line.
      var _phaseReward = _ptActive && !!_pt.validated;
      var _fromLedger = !_phaseReward && !!(_led && typeof _led.callHitRate === 'number' && _led.resolvedSamples >= 3);
      _hit = _phaseReward ? (_pt.hit ? 1 : 0)
        : _fromLedger ? _led.callHitRate
        : (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null;
      _creditSource = _phaseReward ? 'phase-consistency' : (_fromLedger ? 'call-consistency' : (_hit !== null ? 'stress-consistency' : 'none'));
      _isReward = false;                                                  // self-consistency only; never reward
    }
    var _W4 = this._learnedVec('K4_lr', [1.0]);                   // K4 (learned): miss→learning-rate boost gain
    if (_hit !== null) _lr = _emClamp(_lr * (1 + _W4[0] * (1 - _hit)), EM_SLOW_RATE, 0.6);
    em._effectiveLearningRate = _lr;
    em._creditSource = _creditSource;
    em._creditIsReward = _isReward;                                       // honest flag: false unless a real external outcome fed the gate
    var nextPrior = this._updatePrior(priorIn, obs, _lr); // → next cycle reads this

    em.cycle += 1;
    em.observation = obs;
    em.predictionError = pe;
    em.predictedStress = predictedStress;
    em.regulation = reg;
    em.readyForHandoff = readyForHandoff;
    em.prior = nextPrior;
    em.updated = obs.timestamp;
    this.state.energyModel = em;

    // H1-H6 — higher Energy brain layers (domain-level, computed once per cycle
    // BEFORE the DDP build so the packet can embed their compact summaries).
    try { this._computeEnergyHigherLayers(); } catch (e) {}

    // DC — data-center diagnosis layer (additive; BEFORE the DDP build so the primary
    // packet's promptView advertises it). Never touches the validated 6-diagnosis spine.
    try { this._buildDatacenterLayer(); } catch (e) {}

    // PHASE K - neuro-completion layers (additive, advisory; never rewires the spine).
    // Runs after higher-layers + DC so it reads the current cognition surface and DC layer.
    try { this._computeEnergyNeuroLayers(); } catch (e) {}

    // F1 — build the DomainDiagnosisPacket (schema) for the primary diagnosis,
    // and expose one per diagnosis. Schema-only: never invents data.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      em.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.energyDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // #8 — populate outcomeLog meaningfully (was declared but NEVER written)
    try {
      var mem = this.state.memory;
      if (mem && mem.outcomeLog) {
        mem.outcomeLog.push({ cycle: em.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, readyForHandoff: readyForHandoff, regulation: reg.state, timestamp: obs.timestamp });
        if (mem.outcomeLog.length > 50) mem.outcomeLog.shift();
      }
    } catch (e) {}

    return em;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // F1 — ENERGY DomainDiagnosisPacket SCHEMA (schema-only; NEVER invents data).
  // Builds the canonical 8-section contract from whatever Energy already has.
  // Absent fields are EXPLICIT null / [] / 'missing' — never silently omitted.
  // ════════════════════════════════════════════════════════════════════════════
  var DDP_SCHEMA_VERSION = 'energy-ddp-1';
  function _ddpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _ddpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_ddpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // F3 — canonical diagnosis resolution. Mirrors the civ-layer DIAGNOSIS_ALIAS_MAP;
  // prefers window.LIMENArtifactSourceIndex.aliases() when loaded (single source of
  // truth), else falls back to this local 2-entry map. Non-aliased diagnoses are
  // canonical to themselves. Never asserts a bundle exists.
  // Each alias carries human-review metadata. G1c-A added PIPELINE_DISRUPTION as a
  // human-approved (medium-risk) alias; the other two are corpus-native aliases.
  var ENERGY_DIAGNOSIS_ALIASES = {
    RENEWABLE_INTERMITTENCY: { target: 'INTERMITTENCY_SPIKE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits INTERMITTENCY_SPIKE for renewable intermittency' },
    GRID_COLLAPSE: { target: 'GRID_FREQUENCY_INSTABILITY', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits GRID_FREQUENCY_INSTABILITY (infrastructure) for grid collapse' },
    PIPELINE_DISRUPTION: { target: 'PIPELINE_RUPTURE_EVENT', reviewStatus: 'human-approved', risk: 'medium', note: 'pipeline disruption mapped to rupture-event bundle; verify that rupture-specific evidence is appropriate for broader disruption claims' }
  };
  EnergyBrain.prototype._resolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = ENERGY_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // G1 — load REAL source bundles (one-shot, async). Only files that actually exist
  // resolve to 'found'; 404s are 'missing'. Never fabricates a bundle.
  EnergyBrain.prototype._loadDiagnosisBundles = function () {
    var self = this;
    if (self._bundleLoadPromise) return self._bundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['GRID_COLLAPSE', 'RENEWABLE_INTERMITTENCY', 'OIL_SHOCK', 'PIPELINE_DISRUPTION', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS', 'ENERGY_DATACENTER_GRID_STRAIN', 'ENERGY_DATACENTER_WATER_STRESS'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }   // resolve diagnosis -> canonical before fetch (PIPELINE_DISRUPTION -> PIPELINE_RUPTURE_EVENT)
    self._bundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._bundleLoadPromise;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE J1 — REAL L1 PORTAL DEPTH (honest finding: L1 treatments are 100% mad-lib).
  // The mad-lib treatment vocabulary uses a FIXED verb family. C1's original list missed
  // 6 verbs (Calibrate/Evaluate/Streamline/Institutionalize/Configure/Monitor) — once added,
  // 100% of L1 treatments classify as template. So L1 treatments are NOT admitted as evidence;
  // only the real company tickers are surfaced (relevance-unverified, never into evidenceAnchors).
  // ════════════════════════════════════════════════════════════════════════════
  var MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  EnergyBrain.prototype._isMadLibTreatment = function (label) { return !label || MADLIB_VERB.test(String(label)); };

  EnergyBrain.prototype._loadL1PortalDepth = function () {
    var self = this;
    if (self._l1LoadPromise) return self._l1LoadPromise;
    var BRANCH = { GRID_COLLAPSE: ['grid', 'transmission', 'gridmod'], RENEWABLE_INTERMITTENCY: ['solar', 'hydro', 'storage', 'offgrid'], PIPELINE_DISRUPTION: ['pipeline'], OIL_SHOCK: ['fossil'], NUCLEAR_INCIDENT: ['nuclear'], SYSTEMIC_ENERGY_STRESS: ['grid', 'energytrans', 'power'] };   // J1 L1-mad-lib scanner — the 6 CANONICAL branches only (DC branch is carried on the DC layer itself, not scanned here)
    self._l1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._l1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/energy_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'energy_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only company tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.energyModel && self.state.energyModel.updated) || null };   // on state (like energyImmune) so the DDP builder + immune read it via this.state
      return self.state._l1DepthCache;
    });
    return self._l1LoadPromise;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DC — DATA-CENTER DIAGNOSIS LAYER (additive brain layer; mirrors the H1-H7 pattern).
  // The data-center sub-portal (energy_datacenter.json) carries REAL, hand-authored,
  // citation-backed diagnoses + treatments (NOT the mad-lib cortex) but has NO external
  // source bundle yet. We surface them as a SEPARATE first-class layer — they are NEVER
  // merged into the validated 6-diagnosis spine (state.diagnoses stays 6) and never enter
  // evidenceAnchors. Each gets a DDP (canonical-to-self, bundleStatus 'missing' = honest),
  // its real treatments, and a compact promptView summary the finalizer already forwards.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._loadDatacenterDiagnoses = function () {
    var self = this;
    if (self._dcLoadPromise) return self._dcLoadPromise;
    self._dcLoadPromise = fetch('/assets/data/domains/energy_datacenter.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (!data) { self._dcPortal = null; return null; }
        self._dcPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Data Centers' };
        return self._dcPortal;
      })
      .catch(function () { self._dcPortal = null; return null; });
    return self._dcLoadPromise;
  };

  // Build the data-center layer once per cycle (called from _updateEnergyModel BEFORE the
  // main DDP build so the primary packet's promptView can advertise it). Pure read of the
  // cached sub-portal; on any absence everything stays empty/neutral (offline-safe).
  EnergyBrain.prototype._buildDatacenterLayer = function () {
    var self = this;
    var dc = self._dcPortal;
    if (!dc || !dc.issues || !dc.issues.length) {
      self.state.datacenterDiagnoses = [];
      self.state.datacenterTreatments = [];
      self.state.datacenterDomainDiagnosisPackets = [];
      self.state.datacenterLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'data-center sub-portal not loaded (offline or fetch failed)' };
      return self.state.datacenterLayer;
    }
    var conditions = self._activeConditions || [];
    // 1) diagnoses (activation via the same condition-match logic as the canonical spine)
    var diagnoses = dc.issues.map(function (iss) {
      var triggers = (self.diagnosisIndex && self.diagnosisIndex[iss.id]) || [];
      var matchCount = 0;
      for (var t = 0; t < triggers.length; t++) {
        for (var c = 0; c < conditions.length; c++) {
          if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++;
        }
      }
      return {
        id: iss.id, label: iss.label, summary: iss.summary || '',
        active: matchCount > 0,
        relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0,
        circuits: iss.circuits || [],
        source: 'datacenter', tier: 'real-content-unbundled', branch: 'datacenter'
      };
    });
    // 2) treatments — pull from the data-center node activations whose brainNodeId is in a
    //    diagnosis circuit. These are hand-authored + citation-backed (real, not mad-lib).
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (dc.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'dc_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'datacenter', madLib: self._isMadLibTreatment ? self._isMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.datacenterDiagnoses = diagnoses;
    self.state.datacenterTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView; computed BEFORE the DC DDPs)
    self.state.datacenterLayer = {
      loaded: true,
      portalTitle: dc.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCanonicalDiagnosis ? self._resolveCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bs = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'datacenter', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bs, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (hand-authored, citation-backed) sub-portal diagnoses; SEPARATE from the validated 6-diagnosis spine; no external source bundle yet (build-required); never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.datacenterDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.datacenterLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE H1-H6 — HIGHER ENERGY BRAIN LAYERS (energy-local, additive, domain-level).
  // Computed once per cycle BEFORE the DDP build; each emits a COMPACT summary that the
  // DDP embeds in promptView (forwarded to the finalizer by G2) + the full object in audit.
  // Never fabricates evidence; intuition/simulation are explicitly labelled unverified/hypothetical.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._energyBundleStates = function () {
    var self = this; var diags = this.state.diagnoses || [];
    return diags.map(function (d) {
      var c = self._resolveCanonicalDiagnosis(d.id);
      var bundle = (self._bundleCache && self._bundleCache[c.canonicalDiagnosisId]) || null;
      var known = !!(self._bundleStatusMap && Object.prototype.hasOwnProperty.call(self._bundleStatusMap, c.canonicalDiagnosisId));
      return { dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0),
        canonical: c.canonicalDiagnosisId, aliasUsed: c.aliasUsed, aliasRisk: c.aliasRisk, aliasReviewStatus: c.aliasReviewStatus,
        bundleStatus: bundle ? 'found' : (known ? 'missing' : 'unknown'),
        buildMethod: (bundle && bundle.buildMethod) || null, humanVerification: (bundle && bundle.humanVerification) || null,
        shallow: !!(bundle && ((bundle.maxDepth || 0) === 0 || (bundle.portalCount || 0) <= 1)) };
    });
  };

  // H1 — formal immune system
  EnergyBrain.prototype._computeEnergyImmune = function () {
    var s = this.state, em = s.energyModel || {}, reg = em.regulation || {}, bs = this._energyBundleStates();
    var ant = [{ type: 'synthetic-portal-contamination', severity: 'medium', action: 'quarantine', note: 'L2 ~98% synthetic (C1)' }];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (em.predictionError && em.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'unsupported-artifact-readiness-risk', severity: 'low', action: 'flag' });
    // J1 — L1 portal treatments are mad-lib templates; the brain now KNOWS this (not just L2)
    var _l1 = s._l1DepthCache;
    if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
      ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real tickers surfaced relevance-unverified' });
    }
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L2-synthetic-portal-content', 'L1-portal-treatments-madlib', 'L1-L2-mad-lib-treatments'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      immuneMemory: (((s.energyImmune && s.energyImmune.immuneMemory) || 0) + 1),
      lastScanAt: em.updated || null
    };
    s.energyImmune = im; return im;
  };

  // H2 — awareness / metacognition
  EnergyBrain.prototype._computeEnergyAwareness = function () {
    var s = this.state, em = s.energyModel || {}, im = s.energyImmune || {}, bs = this._energyBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var prev = s.energyAwareness || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (em.regulation && em.regulation.state) || 'unknown',
      knowns: covered.map(function (b) { return b.dxId + ' (source-backed' + (b.buildMethod === 'external-source-authored' ? ', external' : '') + ')'; }),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }),
      uncertainties: ['L1 portal treatments are mad-lib templates (NOT real depth); L2 synthetic + blocked', 'real company tickers exist in L1 but node-bindings are templated (relevance-unverified)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).concat(['L2-traversal', 'L1-portal-treatments']),
      confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((em.regulation && em.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, coverageNow: covered.length },
      humanReviewRequired: hv.map(function (b) { return b.dxId; }),
      selfNarrative: 'Energy: ' + covered.length + '/' + bs.length + ' source-backed, ' + active.length + ' active dx, immune=' + (im.immuneState || '?') + ', portal-below-L1 quarantined, ' + hv.length + ' need human verification.',
      lastAwarenessAt: em.updated || null, _pe: pe
    };
    s.energyAwareness = aw; return aw;
  };

  // H3 — conscience / veto (overclaim + source-sufficiency + harm-prevention)
  EnergyBrain.prototype._computeEnergyConscience = function () {
    var s = this.state, em = s.energyModel || {}, bs = this._energyBundleStates();
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    // retired-lane veto removed 2026-07-14: patent/grant are dead lanes, so vetoing them forced
    // conscienceState 'restrictive' every cycle regardless of real signal. Real vetoes (missing
    // source bundles) still populate below and drive restrictive honestly.
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); vetoes.push({ claim: 'strong-claim:' + b.dxId, reason: 'no source bundle' }); }
      else if (b.buildMethod === 'external-source-authored') { cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' }); allowed.push('source-routing:' + b.dxId); }
      else if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') { cautions.push({ claim: 'precise-technical-claim:' + b.dxId, reason: 'aliasRisk ' + b.aliasRisk + '; include alias warning' }); allowed.push('source-summary:' + b.dxId); }
      else if (b.bundleStatus === 'found') { allowed.push('source-summary:' + b.dxId); }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
    var con = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary'].concat(hasFound ? ['investment-memo-with-warnings'] : []).concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound, note: 'patent/grant vetoed (no candidate fields); investment/research allowed-with-warning only for source-backed diagnoses' },
      reasons: ['overclaim prevention', 'source sufficiency', 'human-verification preservation'],
      lastCheckAt: em.updated || null
    };
    s.energyConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled unverified)
  EnergyBrain.prototype._computeEnergyIntuition = function () {
    var s = this.state, em = s.energyModel || {}, reg = em.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'regime shift forming (prediction error rising)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel stressor entering the system', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty)', verifyIf: 'a specific diagnosis activates with source support', falsifyIf: 'novelty subsides next cycle' });
    var missing = this._energyBundleStates().filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
    if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real source bundle is built', falsifyIf: 'diagnosis deactivates' });

    // J3 — patternMatches: recurring regulation state + phase oscillation from real memory
    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });
    var ph = (s.memory && s.memory.phaseHistory) || [], ph5 = ph.slice(-4).map(function (x) { return x.phase; });
    if (ph5.length >= 4 && ph5[3] === ph5[1] && ph5[2] === ph5[0] && ph5[0] !== ph5[1]) patternMatches.push({ pattern: 'phase oscillation ' + ph5.slice(-2).join('<->'), label: 'PATTERN', evidenceStatus: 'UNVERIFIED' });

    // J3 — analogies: static structural-family map (analogy, NOT evidence)
    var FAMILY = { 'supply-disruption': ['OIL_SHOCK', 'PIPELINE_DISRUPTION'], 'reliability': ['GRID_COLLAPSE', 'SYSTEMIC_ENERGY_STRESS', 'ENERGY_DATACENTER_GRID_STRAIN'], 'intermittency': ['RENEWABLE_INTERMITTENCY'], 'safety-incident': ['NUCLEAR_INCIDENT'], 'datacenter-load': ['ENERGY_DATACENTER_GRID_STRAIN', 'ENERGY_DATACENTER_WATER_STRESS'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id;
    var analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });

    // J3 — promotion: a hunch recurring >=3 cycles -> monitoring TARGET only (never diagnosis/evidence); vanished hunches -> rejected (falsifier path)
    var hm = this._hunchMemory = this._hunchMemory || {};
    var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hm[h.hunch] = (hm[h.hunch] || 0) + 1; });
    var promotedToMonitoring = [], rejectedHunches = [];
    Object.keys(hm).forEach(function (k) {
      if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hm[k]; return; }
      if (hm[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hm[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
    });

    var it = {
      version: 1, hunches: hunches.slice(0, 3), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [],   // NEVER auto-promoted — verification is a human/source step
      promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), lastIntuitionAt: em.updated || null
    };
    s.energyIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  EnergyBrain.prototype._computeEnergySimulation = function () {
    var s = this.state, em = s.energyModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'worsen', hypothetical: true, assumption: 'stressor intensifies', simulatedStress: cl(base + 0.2), risk: 'cascade toward systemic energy stress', intervention: 'monitor reserve margin / supply (NERC/EIA)', falsifier: 'stress flat or falling next cycle' },
      { type: 'stabilize', hypothetical: true, assumption: 'stressor holds', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence', falsifier: 'stress moves materially' },
      { type: 'recover', hypothetical: true, assumption: 'stressor reverses', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation', intervention: 'confirm with 2 independent sources before standing down', falsifier: 'stress re-rises' },
      { type: 'supply-shock', hypothetical: true, assumption: 'oil/gas supply disruption', simulatedStress: cl(base + 0.3), risk: 'price spike + sectoral propagation (OIL_SHOCK)', intervention: 'track EIA STEO / IEA OMR / SPR', falsifier: 'inventories stable' },
      { type: 'grid-stress', hypothetical: true, assumption: 'reserve-margin erosion', simulatedStress: cl(base + 0.25), risk: 'cascading blackout (GRID_COLLAPSE)', intervention: 'NERC reliability assessment', falsifier: 'margins above target' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['OIL_SHOCK', 'GRID_COLLAPSE', 'SYSTEMIC_ENERGY_STRESS'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: em.updated || null
    };
    s.energySimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  EnergyBrain.prototype._computeEnergyExecutiveReport = function () {
    var s = this.state, em = s.energyModel || {}, im = s.energyImmune || {}, aw = s.energyAwareness || {}, con = s.energyConscience || {}, it = s.energyIntuition || {}, sim = s.energySimulation || {}, bs = this._energyBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : covered < bs.length ? 'source-limited' : (em.regulation && em.regulation.starving) ? 'starving' : (em.regulation && em.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (em.regulation && em.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: covered < bs.length ? 'build/verify source for uncovered diagnoses' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources',
      lastReportAt: em.updated || null
    };
    s.energyExecutiveReport = rep; return rep;
  };

  EnergyBrain.prototype._computeEnergyHigherLayers = function () {
    this._computeEnergyImmune();
    this._computeEnergyAwareness();
    this._computeEnergyConscience();
    this._computeEnergyIntuition();
    this._computeEnergySimulation();
    this._computeEnergyExecutiveReport();
    // Assemble the generic cognition surface the console SELF-MODEL panel renders. Energy
    // computes all six higher layers but historically never exposed state.cognition, so its
    // own immune/awareness/conscience/intuition were computed-but-invisible (every PORTED
    // domain renders this; the reference domain didn't). Additive — reads the already-computed
    // energy* layers, never touches the validated scoring spine.
    var em = this.state.energyModel || {};
    this.state.cognition = {
      domain: 'energy',
      model: { cycle: em.cycle, predictionError: em.predictionError, predictedStress: em.predictedStress, regulation: em.regulation },
      awareness: this.state.energyAwareness || null,
      conscience: this.state.energyConscience || null,
      immune: this.state.energyImmune || null,
      intuition: this.state.energyIntuition || null,
      simulation: this.state.energySimulation || null,
      executiveReport: this.state.energyExecutiveReport || null
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K - ENERGY NEURO-COMPLETION LAYERS (energy-local, additive, reversible).
  // Fills the brain functions the self-model map flagged as missing or open-loop:
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning, K5 deep-perception depth, K6 attention,
  //   K7 lateral inhibition, K8 homeostatic set-point.
  // ADVISORY BY DESIGN: every layer COMPUTES and EXPOSES its signal on state, but
  // NONE rewires the existing scoring spine (stress, prior update, opportunity
  // output, portalError). Each carries a `wouldChange` naming the one existing line
  // that closes its loop, gated on operator approval. Reads cached state only; adds
  // no network calls. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════
  var EK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized samples
  var EK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point

  // K1 - afferent inter-brain integration. The loop every OTHER domain has and energy
  // lacks: receiveExternalSignal()/getExternalPressure() write _externalSignals but the
  // energy pipeline never reads them. This surfaces received cross-domain pressure and
  // the stress delta it WOULD add, without touching stress.
  EnergyBrain.prototype._computeEnergyAfferent = function () {
    var s = this.state, em = s.energyModel || {};
    var raw = this._externalSignals || [];
    var now = Date.now();
    var bySource = {}, active = 0;
    for (var i = 0; i < raw.length; i++) {
      var sig = raw[i];
      var age = now - (sig.receivedAt || now);
      var weight = age < 300000 ? 1 : Math.max(0, 1 - (age - 300000) / 600000);
      if (weight <= 0) continue;
      active++;
      var k = sig.source || 'unknown';
      if (!bySource[k]) bySource[k] = { source: k, signals: [], weightedMagnitude: 0 };
      bySource[k].signals.push(sig.signal);
      bySource[k].weightedMagnitude += (sig.magnitude || 0) * weight;
    }
    var pressure = (typeof this.getExternalPressure === 'function') ? this.getExternalPressure() : 0;
    var contributors = Object.keys(bySource).map(function (kk) { return bySource[kk]; })
      .sort(function (a, b) { return b.weightedMagnitude - a.weightedMagnitude; });
    var af = {
      version: 1,
      externalPressure: Math.round(pressure * 1000) / 1000,      // base-capped at 0.3
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,                                           // K1 CLOSED - folded into stress by the scoreStress override
      appliedStressDelta: Math.round(((this.state._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,     // matches appliedStressDelta once a cycle has run
      note: 'CLOSED: the energy scoreStress override adds externalPressure to stress each cycle (matches the other 18 domains).',
      lastAfferentAt: em.updated || now
    };
    s.energyAfferent = af; return af;
  };

  // K2 - neuromodulatory gain application. reg.gain/inhibition/outputScale are computed
  // by _computeRegulation but only gain reaches predictedStress (via the duplicated
  // gainBlend). This shows the graded output modulation on opportunities without applying it.
  EnergyBrain.prototype._computeEnergyGainControl = function () {
    var s = this.state, em = s.energyModel || {}, reg = em.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : 1;
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: outputScale,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,                        // gain-scaled ranked cut (advisory)
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend)', 'opportunity output (via _applyNeuroGating cap)'],
      unappliedTargets: ['stress', 'treatment surfacing'],
      shadow: false,
      lastGatedCount: (this.state._neuroGatedCount || 0),
      note: 'CLOSED: outputScale caps ranked opportunity output in surfaceOpportunities via _applyNeuroGating.',
      lastGainAt: em.updated || Date.now()
    };
    s.energyGainControl = gc; return gc;
  };

  // K3 - slow consolidation / long-term plasticity. EM_SLOW_RATE was defined but never
  // used ("reserved for rebuild/cron"). This maintains a PARALLEL slow-weight track that
  // never touches em.prior; fast-vs-slow divergence is a real regime-shift indicator.
  EnergyBrain.prototype._consolidateEnergySlowModel = function () {
    var s = this.state, em = s.energyModel || {}, obs = em.observation || null;
    var slow = s.energySlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: EM_SLOW_RATE, note: 'parallel slow-weight track (EM_SLOW_RATE); does NOT touch em.prior'
    };
    if (obs) {
      var r = this._learnedVec('K3_slow', [EM_SLOW_RATE])[0], w = slow.slow;   // K3 (learned): slow-consolidation rate (advisory track)
      w.expectedStress = _emClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _emClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (em.prior && typeof em.prior.expectedStress === 'number') ? em.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;             // fast prior pulled far from slow baseline
    slow.updated = em.updated || Date.now();
    s.energySlowModel = slow; return slow;
  };

  // K4 - outcome / credit learning. outcomeLog stored predictions but nothing reconciled
  // them against realized values. This compares each cycle's predictedStress against the
  // NEXT cycle's realized stress (the online forward-prediction loop the map said was
  // absent). Measurement only; not yet fed back into learning.
  EnergyBrain.prototype._scoreEnergyOutcomes = function () {
    var s = this.state, em = s.energyModel || {};
    var buf = this._energyOutcomeBuffer = this._energyOutcomeBuffer || [];
    var obs = em.observation || null;
    if (this._energyPrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._energyPrevPrediction, realized: obs.stress, err: Math.abs(this._energyPrevPrediction - obs.stress) });
      if (buf.length > EK_OUTCOME_BUFFER) buf.shift();
    }
    this._energyPrevPrediction = (typeof em.predictedStress === 'number') ? em.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                    // fraction within 0.1 of realized
      loopType: 'online-continuous (predicted-vs-next-realized); distinct from any offline supervised calibration',
      creditAssignmentActive: (n >= 5),
      effectiveLearningRate: ((this.state.energyModel || {})._effectiveLearningRate) || null,
      note: 'CLOSED: hitRate scales the effective learning rate in _updateEnergyModel (>=5 samples) so persistent mis-prediction speeds adaptation.',
      lastOutcomeAt: em.updated || Date.now()
    };
    s.energyOutcomeModel = om; return om;
  };

  // K5 - deep hierarchical perception. _computePredictionError hardcodes portalError=0
  // ("no live portal traversal yet, Phase C"). This aggregates the depth the brain HAS
  // (from existing L1 + DC caches, no new fetches) and estimates the portalError the
  // recurrent model currently zeroes out.
  EnergyBrain.prototype._computeEnergyPerceptionDepth = function () {
    var s = this.state, em = s.energyModel || {};
    var l1 = s._l1DepthCache || null;
    var dc = s.datacenterLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: '~98% synthetic (immune-blocked)' },
      { level: 'DC', name: 'datacenter-subportal', status: (dc && dc.loaded) ? 'loaded' : 'absent', activeCount: (dc && dc.activeCount) || 0 }
    ];
    var loadedDepth = (dc && dc.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((dc && dc.count) ? dc.count : 0);
    var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,                     // consumed by _computePredictionError (weight 0.05)
      note: 'CLOSED: _computePredictionError folds portalErrorEstimate into total (weight 0.05). Perception still stops at L1 (L2 quarantined); no new fetches.',
      lastDepthAt: em.updated || Date.now()
    };
    s.energyPerceptionDepth = pd; return pd;
  };

  // K6 - attention / selective routing. No mechanism biases which inputs/diagnoses the
  // brain prioritizes. This ranks top-down salience (active + relevance + novelty) and
  // names focus vs suppressed, without gating the pipeline.
  EnergyBrain.prototype._computeEnergyAttention = function () {
    var s = this.state, em = s.energyModel || {}, reg = em.regulation || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = (rb.attentionFocus || []).map(function (f) { return String(f).toLowerCase(); });
    var _W6 = this._learnedVec('K6_attention', [0.5, 0.4, 0.1, 0.5]);   // K6 (learned): activeBase, relevanceWeight, peWeight, focusBoost
    var scored = (s.diagnoses || []).map(function (d) {
      var sal = (d.active ? _W6[0] : 0) + (d.relevance || 0) * _W6[1] + pe * _W6[2];
      var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += _W6[3];   // operator steer: attention focus boost
      return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
    }).sort(function (a, b) { return b.salience - a.salience; });
    var at = {
      version: 1,
      driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
      focus: scored.slice(0, 3),
      suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
      broadenUnderSurprise: reg.state === 'surprised',
      note: 'CLOSED: focus[] boosts opportunity rank in surfaceOpportunities via _applyNeuroGating.',
      lastAttentionAt: em.updated || Date.now()
    };
    s.energyAttention = at; return at;
  };

  // K7 - lateral inhibition (microcircuit). reg.inhibition is computed but unused. This
  // shows the winner-take-most ranking it implies among competing active diagnoses.
  EnergyBrain.prototype._computeEnergyInhibition = function () {
    var s = this.state, em = s.energyModel || {}, reg = em.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var _W7 = this._learnedVec('K7_inhib', [1.0]);               // K7 (learned): lateral-inhibition suppress weight
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * _W7[0] * 1000) / 1000 }; }).slice(0, 6),
      note: 'CLOSED: non-winner diagnoses are down-weighted in surfaceOpportunities via _applyNeuroGating (suppressBy).',
      lastInhibitionAt: em.updated || Date.now()
    };
    s.energyInhibition = li; return li;
  };

  // K8 - homeostatic set-point (microcircuit). Energy uses fixed constants
  // (EM_STRESS_FLOOR/EM_FLOOD_CAP) as set-points. This maintains an adaptive baseline
  // (Turrigiano-style scaling) alongside them, without replacing the fixed floor.
  EnergyBrain.prototype._computeEnergyHomeostasis = function () {
    var s = this.state, em = s.energyModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-EK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                              // adaptive set-point vs fixed EM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: EM_STRESS_FLOOR,                                 // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                                // synaptic-scaling multiplier
      samples: n,
      effectiveFloor: ((this.state.energyModel || {})._effectiveFloor) || null,
      note: 'CLOSED: readyForHandoff gates on a 50/50 blend of EM_STRESS_FLOOR and adaptiveBaseline (>=10 samples) via em._effectiveFloor.',
      lastHomeostasisAt: em.updated || Date.now()
    };
    s.energyHomeostasis = hm; return hm;
  };

  // ── REGULATE-TO-TARGET SERVO + E/I BRAKE ACTUATION (2026-07-13, operator-approved) ─────────────
  // Neuro Ref V.2/XII (set-point homeostasis/allostasis) + XIII.1 (E/I: inhibition scales with
  // drive - the doc's most-repeated invariant). Closes the two gaps the audit flagged: K8 only
  // adapted a handoff FLOOR (alert, not regulate); the E/I module was observe-only. This is the real
  // sensor->controller->effector->feedback loop: sensor = drive + K8 deviation; controller = PI
  // (fast proportional + bounded slow integral, the HPA fast+slow arms); effector = a proportional
  // dampening of emission the HALT brake then applies. Additive, reversible (this._actuation.servo/
  // eiBrake=false), affects ONLY emission confidence (same channel the brake already uses); never
  // rewrites stress/scoring/diagnoses/energy.json.
  EnergyBrain.prototype._computeEnergyServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, em = s.energyModel || {}, reg = em.regulation || {}, hm = s.energyHomeostasis || {};
    // SENSOR: excitatory drive (stress + how many things fire at once) vs current inhibition
    var stress = (typeof s.finalStress === 'number') ? s.finalStress : (typeof s.stress === 'number' ? s.stress : 0);
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // the live term (was inverse-surprise)
    var FLOOR = 0.15;
    // TARGET (allostatic set-point): inhibition must track drive (E/I), and rise with deviation above
    // the adaptive baseline (K8). This is regulate-TO-target, not just alert-on-deviation.
    var deviation = Math.max(0, (typeof hm.deviationFromBaseline === 'number') ? hm.deviationFromBaseline : 0);
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                              // >0 => under-braked for the drive/regime
    // CONTROLLER: bounded integral (slow arm) + proportional (fast arm)
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking; never disinhibit
    // EFFECTOR: proportional dampening of emission (the brake consumes this)
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.energyServo = servo;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.servo = servo;   // additive: new key only
    return servo;
  };

  // ── PHASE-COHERENCE ROUTER + PHASE-TRANSITION SELF-CONSISTENCY CALIBRATION (2026-07-13, operator-approved) ─
  // The bridge for the two mechanisms the neurology audit called IMPOSSIBLE on a raw feed:
  //  #3 communication-through-coherence: P0-P10 IS the phase variable, so Energy couples to domains
  //     whose PHASE is coherent with its own (patent Section 3.4 Loop 1 coupling matrix M, thing2
  //     lineage). Positive M = same excitability window = communicate.
  //  #4 phase-transition self-consistency calibration (interpretive, NOT external reward): a realized
  //     phase TRANSITION over time (Thing2 "goes through time") is an INTERPRETIVE self-consistency
  //     signal, never a ground-truth external reward. The P3/P7 family only gates the phase-consistency
  //     tier inside the central K4 gate; Energy is not externalRewardEligible, so this never becomes
  //     reward and never fabricates a validated learning signal. Deterministic, no AI, no writes to energy.json.
  // Per-cycle: append the domain's primary STRESS scalar (finalStress/stress; up=bad) to the
  // persistent series, cap at 60, persist, then run the Thing2 kernel over it to derive an
  // interpretive P0-P10 phase. Deterministic pure-math (no network/AI). On any failure or when
  // the adapter/history is unavailable, _kernelPhase is set to null and the caller falls back to
  // s.phase. seriesSource = STRESS (positive:false) because the scalar rises with distress.
  EnergyBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    var scalar = (typeof s.finalStress === 'number') ? s.finalStress
               : (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:energy', JSON.stringify(this._phaseSeries));
          }
        } catch (e2) {}
      }
    } catch (e) {}

    this._kernelPhase = null;
    s.phaseSource = 'fallback';
    try {
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries.length >= 8) {
        var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });  // STRESS: up = worse
        if (_kp && _kp.phase) {
          this._kernelPhase = _kp.phase;
          s.kernelPhase = _kp.phase;
          s.kernelTrajectory = _kp.trajectory;
          s.kernelCAccum = _kp.cAccumulator;
          s.phaseSource = 'thing2-kernel';
        }
      }
    } catch (e3) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
  };

  EnergyBrain.prototype._computeEnergyPhaseDynamics = function () {
    var s = this.state;
    // Refresh the Thing2 kernel phase from this domain's stress trajectory (pure math, guarded).
    try { this._updatePhaseKernel(); } catch (e) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
    // patent Section 3.4 Loop 1 phase-coupling matrix M (thing2 lineage). Positive = coherent.
    var PHASE_M = {
      p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
      p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
      p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
      p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
      p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
      p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
      p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
    };
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };  // recursion-arc BREAKING family = more-distressed
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PRIOR (top-down expectation): the Thing2 kernel phase over this domain's stress
    // trajectory; fall back to the snapshot s.phase when the kernel is unavailable.
    var kernelPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);

    // NODE-EVIDENCE CORRECTION (active inference, 2026-07-17): correct the kernel prior with
    // the domain's own kernel-scored node phases (state.companies from domainCompanyJoin).
    // When the evidence is grounded (enough scored nodes) it sets the AUTHORITATIVE phase;
    // when thin, the percept abstains and we hold the kernel prior. Evidence flows nodes ->
    // brain only; we never write a node's phase. The router + transition below then run on
    // the authoritative phase, so phase dynamics is grounded, not prior-only.
    var percept = null;
    try { percept = this._computeEnergyPhasePercept(kernelPhase, this._kernelPhase != null ? 'thing2-kernel' : 'fallback'); } catch (ePP) { percept = null; }
    var armPercept = !!(this._actuation && this._actuation.phasePercept);
    var grounded = !!(percept && percept.grounded);
    var myPhase = (armPercept && grounded) ? norm(percept.groundedPhase) : kernelPhase;   // AUTHORITATIVE

    // (A) COHERENCE ROUTER - couple to co-phased, stressed domains
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'energy') return;
        var d = doms[k] || {};
        var op = norm(d.brainPhase || d.phase || (d.brain && d.brain.phase));
        var st = (typeof d.brainStress === 'number') ? d.brainStress : (typeof d.stress === 'number' ? d.stress : 0);
        if (!op) return;
        var coh = (row[op] != null) ? row[op] : (op === myPhase ? 0.04 : 0);
        if (coh > 0 && st > 0.5) { coupled.push({ domain: k, phase: op, coherence: coh, stress: Math.round(st * 100) / 100 }); }
      });
      coupled.sort(function (a, b) { return (b.coherence * b.stress) - (a.coherence * a.stress); });
      couplingStrength = coupled.reduce(function (a, c) { return a + c.coherence * c.stress; }, 0);
    }

    // (B) PHASE-TRANSITION SELF-CONSISTENCY CALIBRATION (interpretive, NOT reward) - did a predicted transition actually occur (through time)?
    var hist = this._phaseHistory = this._phaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var reward = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var fc = s.energyForecast || {};
      var predictedUp = fc.direction === 'rising' ||
        (typeof fc.projectedStress === 'number' && typeof s.stress === 'number' && fc.projectedStress > s.stress);
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      reward = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'self-consistency calibration (P3/P7 family, interpretive)' : 'self-consistency calibration (advisory, interpretive)' };
    }
    hist.push({ phase: myPhase, t: (s.energyModel && s.energyModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 2, myPhase: myPhase,
      priorPhase: kernelPhase,                        // the kernel/heuristic PRIOR before node grounding
      grounded: grounded,                             // did node evidence ground (and possibly correct) the phase?
      phaseSource: grounded ? 'node-grounded' : (s.phaseSource || 'fallback'),
      phasePercept: percept ? { groundedPhase: percept.groundedPhase, precision: percept.precision,
        scored: (percept.evidence && percept.evidence.scored) || 0, divergent: percept.divergent, salience: percept.salience } : null,
      kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: reward,
      note: 'ARMED: authoritative phase = node-grounded percept when the domain has enough kernel-scored companies (evidence -> brain), else the Thing2 kernel/heuristic prior (percept abstains). The coherence router + phase-transition calibration run on the authoritative phase. Interpretive, NOT external reward.'
    };
    s.energyPhaseDynamics = out;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.phaseDynamics = out;

    // ARM: set the authoritative phase every downstream consumer reads (DDP packet, console,
    // cross-domain coupling, handoff). Reversible via this._actuation.phasePercept=false, which
    // reverts to the prior-only heuristic. Only writes when grounded — a thin-evidence domain
    // keeps the heuristic rather than being handed a fabricated phase. s.phase is reset from the
    // snapshot next cycle (scoreStress), so this never becomes its own prior.
    if (armPercept && grounded) {
      s.phase = myPhase;
      s.phaseLabel = ENERGY_PHASE_LABELS[myPhase] || s.phaseLabel;
      s.phaseSource = 'node-grounded';
    }
    return out;
  };

  // Assemble the neuro-completion surface (mirrors _computeEnergyHigherLayers). Runs all
  // K-layers, stores each on state (like energyImmune/energyAwareness), and attaches a
  // compact roll-up to state.cognition ADDITIVELY (new key `neuro`; existing keys untouched).
  EnergyBrain.prototype._computeEnergyNeuroLayers = function () {
    this._computeEnergyAfferent();          // K1 - afferent inter-brain input
    this._computeEnergyGainControl();       // K2 - neuromodulatory gain application
    this._consolidateEnergySlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreEnergyOutcomes();            // K4 - outcome / credit learning
    this._computeEnergyPerceptionDepth();   // K5 - deep hierarchical perception
    this._computeEnergyAttention();         // K6 - attention / selective routing
    this._computeEnergyInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeEnergyHomeostasis();       // K8 - adaptive set-point (microcircuit)
    try { if (this._actuation && this._actuation.servo) this._computeEnergyServo(); } catch (e) {}   // REGULATE-TO-TARGET SERVO (actuated) - reads K8 deviation, drives inhibition toward drive-target
    this._scoreEnergyCallOutcomes();        // STEP 2 - truth brake (before brake: feeds calibration)
    this._computeEnergyBrake();             // HALT BRAKE - stop-circuit (reads ledger calibration)
    this._computeEnergyForecast();          // STEP 4 - forward render (reads ledger calibration)
    try { if (this._actuation && this._actuation.phase) this._computeEnergyPhaseDynamics(); } catch (e) {}   // PHASE-COHERENCE ROUTER + PHASE-TRANSITION SELF-CONSISTENCY CALIBRATION (actuated) - reads the fresh forecast
    this._computeEnergyEmissionQueue();     // STEP 5 - capital-fit packaging (reads forecast + brake)
    this._runEnergyAutonomousEmission();    // STEP 6 - autonomous emission (fail-safe on brake; capital staged)
    this._computeEnergyInteroception();     // MULTIMODAL INTEROCEPTION (Phase 1) - observe-only divergence readout
    try { this._computeEnergyPlasticity(); } catch (e) {}   // THREE-FACTOR PLASTICITY (SHADOW) - reads fresh ledger + K4 credit; touches no live path
    try { this._computeEnergyActiveInference(); } catch (e) {}   // ACTIVE INFERENCE v1 (SHADOW) - belief update + EFE action selection; advisory only
    try { this._computeEnergyOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (SHADOW) - feeds the 6 formerly-inert modules + recurrenceAudit live inputs; proposals only, nothing actuates
    // NOTE: the phase percept is now computed + ARMED inside _computeEnergyPhaseDynamics (above),
    // where it corrects the kernel prior and drives the router/transition on the grounded phase.
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'closed',                     // all K-loops wired into the scoring spine (recurrent, one-cycle lag)
      brake: s.energyBrake || null,         // stop-circuit state (halt/dampen/clear)
      outcomeLedger: s.energyOutcomeLedger || null,   // STEP 2 truth brake
      forecast: s.energyForecast || null,             // STEP 4 forward render
      emissionQueue: s.energyEmissionQueue || null,   // STEP 5 capital-fit packaging
      autoEmission: s.energyAutoEmission || null,      // STEP 6 autonomous emission
      interoception: s.energyInteroception || null,    // MULTIMODAL INTEROCEPTION (Phase 1) - observe-only
      plasticity: s.energyPlasticity || null,           // THREE-FACTOR PLASTICITY (SHADOW) - learned weights + diagnostics
      activeInference: s.energyActiveInference || null, // ACTIVE INFERENCE v1 (SHADOW) - beliefs + EFE action advisory
      phasePercept: s.energyPhasePercept || null,       // PHASE PERCEPT (SHADOW) - node-grounded domain phase + prediction error
      overlays: s.energyOverlays || null,               // NEURO-SUBSTRATE OVERLAY WIRING (SHADOW) - metaplasticity/extinction/throttle/PE/offline/recurrence proposals
      afferent: s.energyAfferent || null,
      gainControl: s.energyGainControl || null,
      slowModel: s.energySlowModel || null,
      outcomeModel: s.energyOutcomeModel || null,
      perceptionDepth: s.energyPerceptionDepth || null,
      attention: s.energyAttention || null,
      inhibition: s.energyInhibition || null,
      homeostasis: s.energyHomeostasis || null,
      closedLoops: [
        'K1 afferent -> scoreStress (externalPressure folded into stress)',
        'K2 gain -> surfaceOpportunities (outputScale caps ranked output)',
        'K4 outcome -> _updateEnergyModel (hitRate scales learning rate)',
        'K5 portalError -> _computePredictionError (weight 0.05)',
        'K6 attention -> surfaceOpportunities (focus boosts rank)',
        'K7 inhibition -> surfaceOpportunities (non-winner down-weight)',
        'K8 set-point -> readyForHandoff (blended adaptive floor)'
      ]
    };
    // E/I balance + self-audit advisories (observe-only; Neuro Ref XIII.1 + XIV). Guarded,
    // never mutates stress/scoring/energy.json. Fills the two biggest audit gaps.
    try { neuro.regulation = this._computeEnergyRegulationAdvisories(); } catch (e) { neuro.regulation = null; }
    s.energyNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // REWARD-GATED LOCAL PLASTICITY (three-factor, SHADOW MODE) - 2026-07-16.
  // Each K-layer's hand-set weighted sum becomes a small LEARNABLE vector updated
  // by Δw = η·pre·post·modulator via assets/js/limen-plasticity.js. The modulator
  // is the SAME central honest credit gate K4 already uses (window.LIMENK4.credit)
  // — reused, not rebuilt — centered into an RPE-like signal. For energy that
  // signal is SELF-CONSISTENCY CALIBRATION (isReward:false), NEVER external
  // reward; the label rides every snapshot. Eligibility traces bridge the truth
  // brake's 3-20 cycle resolution delay. SHADOW: learned weights compute + log
  // would-be outputs; every live path still reads the static constants. Arming is
  // a separate operator-gated change conditioned on diag.stable (see module).
  // Persistence (Phase 0): weights hydrate from /api/brain-weights on boot and
  // snapshot back every PLAST_PERSIST_EVERY cycles + on tab hide, so learning
  // survives tab close (the recorder's durable-memory fix, one layer deeper).
  // ════════════════════════════════════════════════════════════════════════════
  var PLAST_PERSIST_EVERY = 10;   // cycles between snapshots (~5 min at 30s)
  var PLAST_TOKEN_KEY = 'limen:brainwts:token';   // operator-set localStorage key; absent = persistence off (compute-only)

  EnergyBrain.prototype._initEnergyPlasticity = function () {
    var P = (typeof window !== 'undefined' && window.LIMENPLASTICITY) ? window.LIMENPLASTICITY
      : (typeof module !== 'undefined' ? (function () { try { return require('../limen-plasticity.js'); } catch (e) { return null; } })() : null);
    this._plasticity = null;
    if (!P) return;   // module not on this page: brain runs exactly as before
    // Seeds = the CURRENT live static constants (verified against the code they shadow).
    // Changing a seed here invalidates the stored posterior for that layer (hydrate resets it) - deliberate.
    var layers = {
      K1_pressure: P.createLayer({ name: 'K1-afferent-pressure', seed: [1.0], labels: ['externalPressureWeight'],
        eta: 0.02, modScale: 1.0, traceDecay: 0.85, priorLambda: 0.002, minW: 0, maxW: 1.5 }),
      K2_gain: P.createLayer({ name: 'K2-output-scale', seed: [0.5], labels: ['inhibitionToScale'],
        eta: 0.02, modScale: 1.0, traceDecay: 0.85, priorLambda: 0.002, minW: 0, maxW: 1.0 }),
      K3_slow: P.createLayer({ name: 'K3-slow-rate', seed: [0.08], labels: ['slowConsolidationRate'],
        eta: 0.005, modScale: 0.5, traceDecay: 0.9, priorLambda: 0.001, minW: 0.01, maxW: 0.3 }),
      K4_lr: P.createLayer({ name: 'K4-lr-boost', seed: [1.0], labels: ['missToLrBoost'],
        eta: 0.02, modScale: 1.0, traceDecay: 0.85, priorLambda: 0.002, minW: 0, maxW: 2.0 }),
      K5_pe: P.createLayer({ name: 'K5-prediction-error', seed: [0.35, 0.2, 0.25, 0.15, 0.05],
        labels: ['stressError', 'signalError', 'diagnosisError', 'opportunityError', 'portalError'],
        eta: 0.03, modScale: 1.0, traceDecay: 0.8, priorLambda: 0.003, minW: 0, maxW: 0.8 }),
      K6_attention: P.createLayer({ name: 'K6-salience', seed: [0.5, 0.4, 0.1, 0.5],
        labels: ['activeBase', 'relevanceWeight', 'peWeight', 'focusBoost'],
        eta: 0.03, modScale: 1.0, traceDecay: 0.8, priorLambda: 0.003, minW: 0, maxW: 1.0 }),
      K7_inhib: P.createLayer({ name: 'K7-lateral-inhibition', seed: [1.0], labels: ['suppressWeight'],
        eta: 0.02, modScale: 1.0, traceDecay: 0.85, priorLambda: 0.002, minW: 0, maxW: 1.5 }),
      K8_floor: P.createLayer({ name: 'K8-floor-blend', seed: [0.5, 0.5], labels: ['fixedFloorShare', 'adaptiveBaselineShare'],
        eta: 0.02, modScale: 1.0, traceDecay: 0.85, priorLambda: 0.002, minW: 0.1, maxW: 0.9 })
    };
    this._plasticity = { P: P, layers: layers, mod: P.createModulator(), hydrated: false, hydrateResult: null, lastPersistCycle: 0, persistEnabled: false, persistFailures: 0 };

    // Phase 0 HYDRATE: reload the learned posterior from Redis (async; cycles
    // before arrival run from seeds; shape/seed mismatches reset honestly).
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/api/brain-weights?domain=energy').then(function (r) { return r.json(); }).then(function (j) {
          if (!self._plasticity) return;
          if (j && j.ok && j.snapshot) {
            self._plasticity.hydrateResult = P.hydrate(self._plasticity.layers, j.snapshot);
            P.hydrateModulator(self._plasticity.mod, j.snapshot);
            self._plasticity.hydrated = true;
          } else {
            self._plasticity.hydrateResult = { restored: [], reset: [], note: 'no stored snapshot (first run)' };
            self._plasticity.hydrated = true;
          }
        }).catch(function () { self._plasticity.hydrateResult = { restored: [], reset: [], note: 'hydrate fetch failed; running from seeds' }; });
      } catch (e) {}
    }
    // Persist on tab hide so the last partial window isn't lost.
    if (typeof document !== 'undefined' && document.addEventListener) {
      try {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') { try { self._persistEnergyPlasticity(true); } catch (e) {} }
        });
      } catch (e) {}
    }
  };

  // EXTERNAL OUTCOME (the RESOLVER): the modulator's external reward. Forecasts are emitted
  // SERVER-SIDE by the /api/feed-resolve?emit=1 cron (tab-independent, token-independent — derived
  // from recorded feed truth, not user input) and graded vs the recorder there. This client only
  // GETs the resolved externalHitRate (throttled ~hourly, open, $0/no AI, never the 30s tick) and
  // feeds it to the K4 gate as externalOutcome once >=MIN_EXT_RESOLVED forecasts resolve, else
  // abstains to self-consistency. No token needed here — the whole resolver loop self-sustains.
  var EXT_RESOLVE_EVERY = 120;   // ~1h at 30s; the resolver only changes hourly, so no need to poll faster
  var MIN_EXT_RESOLVED = 5;      // treat as reward only once >=5 forecasts have resolved (else self-consistency)
  EnergyBrain.prototype._refreshExternalOutcome = function () {
    var s = this.state, em = s.energyModel || {};
    if (typeof fetch !== 'function') return;
    var cyc = em.cycle || 0;
    if ((cyc - (this._lastExtCycle || 0)) < EXT_RESOLVE_EVERY && this._lastExtCycle) return;
    this._lastExtCycle = cyc;
    var self = this;
    try {
      fetch('/api/feed-resolve?domain=energy').then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) self._externalOutcome = { hit: (typeof j.externalHitRate === 'number') ? j.externalHitRate : null, resolvedCount: j.resolvedCount || 0, at: (em.cycle || 0) };
      }).catch(function () {});
    } catch (e) {}
  };

  // A K-layer's LEARNED weights take over the live computation only when the layer has EARNED it;
  // otherwise the hand-set seed, exactly as before. Automatic self-gate (no manual flip):
  //   plasticityLive actuation on + module loaded + this layer's diagnostics STABLE (converged,
  //   no oscillation/runaway) + the modulator is on a REAL external reward (resolver, not self-
  //   consistency) + drift from seed bounded. Degrade-safe (returns seed on any gap) + reversible
  //   (_actuation.plasticityLive=false forces seed everywhere).
  EnergyBrain.prototype._learnedVec = function (layerKey, seed) {
    try {
      var pl = this._plasticity; if (!pl || !pl.layers) return seed;
      var layer = pl.layers[layerKey]; if (!layer || !layer.w || layer.w.length !== seed.length) return seed;
      if (!this._actuation || this._actuation.plasticityLive === false) { layer._blend = 0; return seed; }
      var d = layer.diag || {};
      // HARD preconditions: must be converged AND on a real external reward (not self-consistency).
      if (!d.stable || !this._plasticityRewardActive) { layer._blend = 0; return seed; }
      // GRADED CONFIDENCE-WEIGHTED ARBITRATION between two controllers (learned vs seed), not a binary
      // relay. Trust the learned model in proportion to (1 - drift/0.5); the learned weights stay intact,
      // so as drift falls again w rises smoothly and the layer re-arms. NOT extinction: there is no stored
      // "was suppressed" memory that could later resurface (renewal/relapse) — w is a function of the
      // instantaneous drift only. The linear ramp is a stated engineering choice; the literature usually
      // drives arbitration weight by relative reliability/uncertainty, for which drift is a proxy, not the
      // same quantity. w=1 at drift 0; w=0 at drift>=0.5.
      var drift = (typeof d.driftFromSeed === 'number') ? d.driftFromSeed : 0;
      var w = Math.max(0, Math.min(1, 1 - drift / 0.5));
      layer._blend = Math.round(w * 1000) / 1000;
      if (w <= 0) return seed;
      if (w >= 1) return layer.w;
      var out = new Array(seed.length);
      for (var i = 0; i < seed.length; i++) out[i] = (1 - w) * seed[i] + w * layer.w[i];
      return out;
    } catch (e) { return seed; }
  };

  EnergyBrain.prototype._computeEnergyPlasticity = function () {
    var pl = this._plasticity;
    var s = this.state, em = s.energyModel || {};
    if (!pl || !pl.P) { s.energyPlasticity = { version: 1, mode: 'off', note: 'limen-plasticity.js not loaded on this page' }; return null; }
    try { this._refreshExternalOutcome(); } catch (e) {}
    var P = pl.P, L = pl.layers;
    var obs = em.observation || {}, pe = em.predictionError || {};
    var reg = em.regulation || {};
    var led = s.energyOutcomeLedger || {};      // FRESH: _scoreEnergyCallOutcomes ran earlier this call
    var om = s.energyOutcomeModel || {};
    var hm = s.energyHomeostasis || {};
    var at = s.energyAttention || {};
    var li = s.energyInhibition || {};
    var af = s.energyAfferent || {};

    // ── Modulator: the SAME honest gate K4 uses, recomputed on the fresh ledger.
    // (em stores _creditSource/_effectiveLearningRate but not the numeric credit,
    // so we re-call the pure gate function rather than duplicating its logic.)
    var pt = (s.energyPhaseDynamics || {}).transition;
    var ptActive = !!(this._actuation && this._actuation.phase && pt && pt.hit !== null);
    // EXTERNAL OUTCOME: the resolver's forecast-vs-realized-feed hit-rate, used as TRUE reward ONLY
    // once >=MIN_EXT_RESOLVED forecasts have resolved; otherwise abstain (null) and the gate falls
    // back to self-consistency calibration (honest). This is what grounds the modulator in reality.
    var extO = this._externalOutcome;
    var extOutcome = (extO && typeof extO.hit === 'number' && (extO.resolvedCount || 0) >= MIN_EXT_RESOLVED)
      ? { hit: extO.hit } : null;
    var k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
      ? window.LIMENK4.credit({
          externalOutcome: extOutcome,                              // RESOLVER: external feed-truth reward when resolved; else null (self-consistency)
          phaseValidated: !!(pt && pt.validated),
          phaseTransitionHit: ptActive ? (pt.hit ? 1 : 0) : null,
          callHitRate: (typeof led.callHitRate === 'number') ? led.callHitRate : null,
          callSamples: led.resolvedSamples || 0,
          stressSelfPred: (typeof om.hitRate === 'number') ? om.hitRate : null,
          stressSamples: om.samples || 0
        })
      : null;
    // NOTE: freshness keys on ledger resolvedSamples increasing. The ledger caps at
    // EK_LEDGER_MAX by slicing oldest entries, so the count can dip and re-cross a
    // value (rare double-teach). Acceptable in shadow; revisit before arming.
    // Freshness keys on the MONOTONIC cumulative resolution count (resolvedTotal), NOT the windowed
    // resolvedSamples — the ledger caps at EK_LEDGER_MAX and slices oldest, so the windowed count can
    // dip (theoretical double-teach) and, worse, SATURATES near the cap once armed (learning freezes).
    // The monotonic total makes both impossible. (This is the "revisit before arming" gate, resolved.)
    var modRead = P.readModulator(pl.mod, k4, (typeof led.resolvedTotal === 'number' ? led.resolvedTotal : (led.resolvedSamples || 0)));
    this._plasticityRewardActive = !!(k4 && k4.isReward);   // true only when the resolver's external outcome fed the gate (tier 4)

    // ── Per-layer pre/post from what THIS cycle actually computed (post = the
    // LIVE static output; shadow weights never drive activity in shadow mode).
    var diags = s.diagnoses || [];
    var activeDx = diags.filter(function (d) { return d.active; });
    var meanRel = activeDx.length ? activeDx.reduce(function (a, d) { return a + (d.relevance || 0); }, 0) / activeDx.length : 0;
    var focusN = (at.focus || []).length;
    var topSal = focusN ? (at.focus.reduce(function (a, f) { return a + (f.salience || 0); }, 0) / focusN) : 0;
    var comps = li.competitors || [];
    var meanSuppress = comps.length ? comps.reduce(function (a, c) { return a + (c.suppressBy || 0); }, 0) / comps.length : 0;
    var slow = (s.energySlowModel || {}).slow || {};
    var slowDelta = Math.abs((obs.stress || 0) - (slow.expectedStress || 0.5));
    var credit = (k4 && typeof k4.credit === 'number') ? k4.credit : null;

    var feeds = {
      K1_pressure: { pre: [af.externalPressure || 0], post: af.appliedStressDelta || 0 },
      K2_gain: { pre: [reg.inhibition || 0], post: 1 - (typeof reg.outputScale === 'number' ? reg.outputScale : 1) },
      K3_slow: { pre: [slowDelta], post: 0.08 * slowDelta },
      K4_lr: { pre: [credit === null ? 0 : (1 - credit)], post: em._effectiveLearningRate || 0 },
      K5_pe: { pre: [pe.stressError || 0, pe.signalError || 0, pe.diagnosisError || 0, pe.opportunityError || 0, pe.portalError || 0], post: pe.total || 0 },
      K6_attention: { pre: [activeDx.length ? 1 : 0, meanRel, pe.total || 0, 0], post: topSal },
      K7_inhib: { pre: [(reg.inhibition || 0) * meanRel], post: meanSuppress },
      K8_floor: { pre: [EM_STRESS_FLOOR, (typeof hm.adaptiveBaseline === 'number' ? hm.adaptiveBaseline : 0.5)], post: em._effectiveFloor || EM_STRESS_FLOOR }
    };

    // All eight K-layers are now WIRED to consume learned weights in the live path via _learnedVec
    // (K1 afferent re-scale, K2 outputScale, K3 slow-rate [advisory], K4 lr-boost, K5 prediction-error,
    // K6 salience, K7 lateral-inhibition, K8 floor-blend). Each self-arms only when its own diag passes.
    var WIRED = { K1_pressure: true, K2_gain: true, K3_slow: true, K4_lr: true, K5_pe: true, K6_attention: true, K7_inhib: true, K8_floor: true };
    var layersOut = {}, anyOsc = false, anyRun = false, allStable = true, liveLayers = [];
    for (var k in L) {
      if (!L.hasOwnProperty(k)) continue;
      var layer = L[k], f = feeds[k];
      P.tick(layer, f.pre, f.post);                                   // eligibility + prior shrinkage, every cycle
      if (modRead.fresh && modRead.rpe !== null) P.applyModulator(layer, modRead.rpe);   // three-factor apply on NEW outcomes only
      var shadow = P.shadowSum(layer, f.pre);                         // the would-be learned output
      // GRADED gate: _learnedVec sets layer._blend in [0,1] = how much the learned weights drive live.
      this._learnedVec(k, layer.seed);
      var blend = (typeof layer._blend === 'number') ? layer._blend : 0;
      var live = !!WIRED[k] && blend > 0;                             // live = the learned trace has any grip on the real path
      if (live) liveLayers.push(k);
      layersOut[k] = {
        w: layer.w.map(function (x) { return Math.round(x * 10000) / 10000; }),
        labels: layer.labels, updates: layer.updates,
        shadowOutput: shadow, staticOutput: Math.round((f.post) * 10000) / 10000,
        wouldChangeBy: (shadow === null) ? null : Math.round((shadow - f.post) * 10000) / 10000,
        wired: !!WIRED[k], live: live, blend: (!!WIRED[k]) ? blend : 0,  // blend = graded arm weight (0=seed, 1=fully learned)
        diag: layer.diag
      };
      if (layer.diag.oscillating) anyOsc = true;
      if (layer.diag.runaway) anyRun = true;
      if (!layer.diag.stable) allStable = false;
    }

    s.energyPlasticity = {
      version: 1,
      mode: liveLayers.length ? 'armed' : 'shadow',                   // 'armed' once a wired layer passes the self-gate and drives the live path
      liveLayers: liveLayers,                                         // layers whose LEARNED weights are driving the live computation now
      rewardActive: !!this._plasticityRewardActive,                   // is the modulator on the resolver's external reward (a gate precondition)?
      isReward: !!(k4 && k4.isReward),                                // TRUE once the resolver's external outcome is used (>=MIN_EXT_RESOLVED); else false (self-consistency)
      creditSource: (k4 && k4.creditSource) || 'none',
      creditTier: (k4 && k4.tier) || 0,
      externalOutcome: extOutcome ? { hit: extOutcome.hit, resolvedCount: (extO && extO.resolvedCount) || 0, source: 'resolver (forecast-vs-recorded-feed-truth, forward-only)' }
        : { active: false, resolvedCount: (extO && extO.resolvedCount) || 0, note: 'ABSTAINING: <' + MIN_EXT_RESOLVED + ' resolved forecasts — modulator falls back to self-consistency until the resolver accrues' },
      modulator: { fresh: modRead.fresh, rpe: modRead.rpe, credit: credit, baseline: pl.mod.baseline, events: pl.mod.events,
        latencyNote: 'truth-brake calls resolve 3-20 cycles after emission; eligibility traces bridge the gap' },
      layers: layersOut,
      convergence: { allStable: allStable, anyOscillating: anyOsc, anyRunaway: anyRun,
        armGate: 'a wired layer arms ITSELF (learned weights drive the live path) when diag.stable + rewardActive + drift<0.5; no manual flip. Reversible via _actuation.plasticityLive=false.' },
      persistence: { hydrated: pl.hydrated, hydrateResult: pl.hydrateResult, enabled: pl.persistEnabled, failures: pl.persistFailures },
      note: 'THREE-FACTOR: dw = eta*pre*post*modulator; modulator = the RESOLVER external outcome once >=' + MIN_EXT_RESOLVED + ' resolve, else self-consistency. Wired layers (K5) SELF-ARM into the live path once stable + on external reward + drift-bounded; until then they read the seed (safe). liveLayers lists what is driving live now.'
    };

    // Phase 0 PERSIST: throttled snapshot so learning survives tab close.
    if ((em.cycle || 0) - pl.lastPersistCycle >= PLAST_PERSIST_EVERY) {
      pl.lastPersistCycle = em.cycle || 0;
      try { this._persistEnergyPlasticity(false); } catch (e) {}
    }
    return s.energyPlasticity;
  };

  EnergyBrain.prototype._persistEnergyPlasticity = function (isUnload) {
    var pl = this._plasticity;
    if (!pl || !pl.P || typeof fetch !== 'function') return;
    var token = null;
    try { token = (typeof localStorage !== 'undefined' && localStorage) ? localStorage.getItem(PLAST_TOKEN_KEY) : null; } catch (e) {}
    pl.persistEnabled = !!token;
    if (!token) return;   // operator has not enabled persistence on this browser: compute-only (honest, not an error)
    var snap = pl.P.serialize(pl.layers, pl.mod, { domain: 'energy', cycle: (this.state.energyModel || {}).cycle || 0 });
    var body = JSON.stringify({ domain: 'energy', snapshot: snap });
    try {
      if (isUnload && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // sendBeacon cannot set headers; token rides the body (handler accepts body.token).
        var withTok = JSON.stringify({ domain: 'energy', snapshot: snap, token: token });
        navigator.sendBeacon('/api/brain-weights', new Blob([withTok], { type: 'application/json' }));
        return;
      }
      fetch('/api/brain-weights', { method: 'POST', headers: { 'content-type': 'application/json', 'x-brain-token': token }, body: body })
        .then(function (r) { if (!r.ok) pl.persistFailures++; })
        .catch(function () { pl.persistFailures++; });
    } catch (e) { pl.persistFailures++; }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVE INFERENCE v1 (SHADOW) - 2026-07-16. Stage 1 of 3: real belief-updating
  // (exact Bayes over hidden level+slope of the stress trajectory) + expected-
  // free-energy action selection over the brain's EXISTING single observed
  // channel, via assets/js/limen-active-inference.js. The observation space is
  // deliberately narrow at this stage (that is the staging, not a gap). The
  // selected action is LOGGED next to what the brain actually did — nothing here
  // gates emission, attention, or the brake. Stages 2 (hand-widen observations
  // from recorded feed history) and 3 (tune model params through the three-factor
  // substrate) come only after this stage shows end-to-end agreement in shadow.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._initEnergyActiveInference = function () {
    var A = (typeof window !== 'undefined' && window.LIMENACTIVEINFERENCE) ? window.LIMENACTIVEINFERENCE
      : (typeof module !== 'undefined' ? (function () { try { return require('../limen-active-inference.js'); } catch (e) { return null; } })() : null);
    this._activeInference = A ? { A: A, ai: A.create({ level0: 0.5 }) } : null;
  };

  EnergyBrain.prototype._computeEnergyActiveInference = function () {
    var box = this._activeInference;
    var s = this.state, em = s.energyModel || {};
    if (!box || !box.A) { s.energyActiveInference = { version: 1, mode: 'off', note: 'limen-active-inference.js not loaded on this page' }; return null; }
    var A = box.A, ai = box.ai;
    var obs = (typeof s.stress === 'number') ? s.stress : null;
    A.updateBeliefs(ai, obs);                                       // free-energy belief update (exact for this model)
    var led = s.energyOutcomeLedger || {};
    var sel = A.selectAction(ai, {
      setpoint: (em._effectiveFloor != null) ? em._effectiveFloor : 0.35,   // K8 homeostatic target as prior preference
      callHitRate: (typeof led.callHitRate === 'number') ? led.callHitRate : null,
      brakeActive: !!((s.energyBrake || {}).halt)
    });
    // What the brain ACTUALLY did this cycle (shadow comparison, the stage-1 proof metric)
    var eq = s.energyEmissionQueue || {};
    var emittedN = ((eq.packages || eq.queue || []).length) || 0;
    var actual = ((s.energyBrake || {}).halt) ? 'hold-emission'
      : (emittedN > 0) ? 'emit-call'
      : ((s.energyAttention || {}).broadenUnderSurprise) ? 'broaden-attention' : 'observe';
    s.energyActiveInference = {
      version: 1,
      mode: 'shadow',                                               // advisory only; no live path reads this
      selected: sel.selected, selectedMaps: sel.selectedMaps,
      actualBehavior: actual,
      agreement: sel.selected === actual,                           // stage-1 proof metric, tracked over cycles
      actions: sel.actions,
      beliefs: sel.beliefs,
      preference: sel.preference,
      stage: '1 of 3: single-channel generative model (hand-specified). Stage 2 = hand-widen observations from recorded feed history; stage 3 = tune params via the three-factor substrate.',
      note: 'ACTIVE INFERENCE (interpretive, shadow): beliefs are a posterior over the stress trajectory, NOT a market call; action selection is advisory and gated on nothing.'
    };
    return s.energyActiveInference;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING (SHADOW) - 2026-07-17. The six previously-INERT
  // overlay modules (metaplasticity, extinction, retrograde-throttle, PE-compressor,
  // offline-maintenance, neuro-substrate) + connectivity recurrenceAudit were loaded on
  // domain-console but had no call site. Their inputs already exist: the telemetry adapter
  // (_runtimeOverlay, computed each cycle at the pulse step) produces volatility, alias-
  // expanded activeTriggers, and per-node load/capacity. This pass BRIDGES those inputs to
  // all seven modules and logs their proposals on state.energyOverlays. SHADOW: nothing is
  // applied to the live brain or energy.json. The metaplasticity->offline/PE loop is closed
  // in-shadow (adapted knobs feed the offline + PE computations). ARMING: _actuation.overlays
  // (default false) would let the NON-destructive proposals actuate (a future operator step);
  // extinction retirement + offline pruning EDIT/REMOVE STRUCTURE and stay PROPOSAL-ONLY forever
  // (human-gated). Evidence flows in, proposals flow out; nothing removes structure autonomously.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._loadEnergyDef = function () {
    // Lazily fetch the energy runtime definition (activations/edges/issues/runtime.params) ONCE,
    // cached on this._energyDef. Node/test callers may set this._energyDef directly. Browser:
    // fire-and-forget; the first cycle returns null and overlays compute from the next cycle.
    if (this._energyDef) return this._energyDef;
    if (this._energyDefLoading) return null;
    this._energyDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/energy.json').then(function (r) { return r.json(); })
          .then(function (def) { self._energyDef = def; })
          .catch(function () { self._energyDefLoading = false; });
      } catch (e) { this._energyDefLoading = false; }
    }
    return null;
  };

  EnergyBrain.prototype._computeEnergyOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('EnergyMetaplasticity', '../energy-metaplasticity.js');
    var EXT = mod('EnergyExtinction', '../energy-extinction.js');
    var RETRO = mod('EnergyRetrogradeThrottle', '../energy-retrograde-throttle.js');
    var PEC = mod('EnergyPredictionErrorCompressor', '../energy-prediction-error-compressor.js');
    var OFF = mod('EnergyOfflineMaintenance', '../energy-offline-maintenance.js');
    var NS = mod('EnergyNeuroSubstrate', '../energy-neuro-substrate.js');
    var CONN = mod('EnergyConnectivityAudit', '../energy-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.energyOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on domain-console)' };
      return null;
    }
    var def = this._loadEnergyDef();
    if (!def) { s.energyOverlays = { version: 1, mode: 'loading', note: 'energy.json runtime def loading; overlays compute next cycle' }; return null; }

    var armed = !!(this._actuation && this._actuation.overlays);
    var ov = this._runtimeOverlay || {};
    var params = (def.runtime && def.runtime.params) || {};

    // 1. VOLATILITY (XIII.6) — from the telemetry overlay, else derived from stress history.
    var volatility = (typeof ov.volatility === 'number') ? ov.volatility : (function () {
      var h = ((s.memory && s.memory.stressHistory) || []).slice(-12), sum = 0;
      for (var i = 1; i < h.length; i++) sum += Math.abs((h[i].stress || 0) - (h[i - 1].stress || 0));
      return h.length > 1 ? Math.max(0, Math.min(1, sum / (h.length - 1))) : 0;
    })();

    // 2. METAPLASTICITY (BCM, XIII.6) — volatility adapts the change-thresholds of the other mechanisms.
    var meta = META.adaptParams(
      { offlineDownscaleFactor: params.offlineDownscaleFactor, refractoryAbsoluteWindow: params.refractoryAbsoluteWindow, predictionErrorThreshold: params.predictionErrorThreshold },
      { gain: (typeof params.metaplasticityGain === 'number') ? params.metaplasticityGain : 0, volatility: volatility }
    );
    var adapted = meta.adapted || {};

    // 3. EXTINCTION (V.2) — retire activations whose alias-expanded triggers are all absent now. PROPOSAL-ONLY.
    var activeTriggers = ov.activeTriggers || this._activeConditions || [];
    var ext = EXT.proposeExtinction(def, activeTriggers);

    // 4. RETROGRADE THROTTLE (IV.5) — overloaded receiver nodes (load/capacity>1 from the overlay proxy) dial back senders.
    var overload = {}, actsOv = ov.activations || {};
    Object.keys(actsOv).forEach(function (nid) {
      var a = actsOv[nid], cap = (a && a.capacity) || 1;
      if (a && typeof a.load === 'number' && cap > 0 && a.load / cap > 1) overload[nid] = a.load / cap;
    });
    var retro = RETRO.computeThrottle(def, { overload: overload, throttleGain: (typeof params.retrogradeThrottleGain === 'number') ? params.retrogradeThrottleGain : 0 });

    // 5. PREDICTION-ERROR COMPRESSION (XIII.5/.7, management-by-exception) — propagate only the
    //    surprising interoception channels; summarize the calm ones. Threshold = metaplasticity-adapted.
    var chans = ((s.energyInteroception && s.energyInteroception.channels) || []).map(function (c) { return { id: c.name, observed: c.alarm }; });
    var baseline = chans.length ? chans.reduce(function (a, c) { return a + (c.observed || 0); }, 0) / chans.length : 0;
    var peThresh = (typeof adapted.predictionErrorThreshold === 'number') ? adapted.predictionErrorThreshold : (params.predictionErrorThreshold || 0);
    var pec = PEC.compress(chans, { threshold: peThresh, predictor: 'baseline', baseline: baseline });

    // 6. OFFLINE MAINTENANCE (XIII.9 down-scale/consolidate/prune) on a DEEP COPY — proposal only,
    //    never writes energy.json. Uses the metaplasticity-adapted downscale factor (closed self-tuning loop).
    var off = OFF.runOfflineMaintenance(def, {
      downscaleFactor: (typeof adapted.offlineDownscaleFactor === 'number') ? adapted.offlineDownscaleFactor : (params.offlineDownscaleFactor || 1),
      consolidateTopK: (typeof params.offlineConsolidateTopK === 'number') ? params.offlineConsolidateTopK : Infinity,
      pruneThreshold: (typeof params.offlinePruneThreshold === 'number') ? params.offlinePruneThreshold : 0
    });

    // 7. STRUCTURAL DIAGNOSTICS — recurrence (mesh vs tree; XIII.2) + incomplete-circuit audit (XIV). Read-only.
    var recurrence = CONN.recurrenceAudit(def);
    var incompleteCircuits = (def.issues || []).map(function (is) { return NS.validateIncompleteCircuit(is); });
    var incompleteCount = incompleteCircuits.filter(function (v) { return v.verdict === 'INCOMPLETE_CIRCUIT'; }).length;

    s.energyOverlays = {
      version: 1,
      mode: 'shadow',                       // computed + logged; NOTHING applied to the live brain or energy.json
      armed: armed,                         // _actuation.overlays; when true, non-destructive proposals may actuate (future, operator-gated)
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits energy.json — human-gated forever)' },
      retrograde: { actions: retro.actions, throttled: retro.actions.length, noop: retro.noop },
      peCompression: { compressed: pec.summary.compressedCount, propagated: pec.propagated.length, ratio: pec.compressionRatio, summary: pec.summary },
      offlineMaintenance: { downscaled: (off.report.operations.downscale || {}).edgesDownscaled, pruned: (off.report.operations.prune || {}).pruned, report: off.report, actuation: 'PROPOSAL-ONLY on a deep copy; pruning is human-gated forever' },
      recurrence: { verdict: recurrence.verdict, recurrentFraction: recurrence.recurrentFraction, lateralFraction: recurrence.lateralFractionOfClassifiable },
      incompleteCircuits: incompleteCircuits, incompleteCount: incompleteCount
    };

    // ── ACTUATION (armed) ─────────────────────────────────────────────────────
    // The ONLY overlay proposal with a live consumer is metaplasticity -> the refractory
    // dead-time (the refractory limiter is the one behaviour-affecting overlay). Retrograde
    // throttle has no live edge-weight consumer; PE-compression targets observe-only
    // interoception; extinction + offline pruning REMOVE STRUCTURE and never actuate. So arming
    // = closing the metaplasticity->refractory homeostatic loop, and nothing else.
    // SAFETY: metaplasticity only ever RAISES the window (more conservative / fewer duplicate
    // drafts); we clamp to [base, 1.2*base] (fail-toward-quiet) and write it IN PLACE on the live
    // limiter's params (read each fire(), so no re-init, no event-log reset, no draft burst).
    // Disarm restores the base window. Fully reversible via _actuation.overlays=false.
    var applied = { refractoryAbsoluteWindow: null };
    var base = this._refractoryBaseWindow || (this._refractoryParams && this._refractoryParams.absoluteWindow) || 900000;
    if (armed) {
      var wantRaw = (typeof adapted.refractoryAbsoluteWindow === 'number') ? adapted.refractoryAbsoluteWindow : base;
      var want = Math.max(base, Math.min(base * 1.2, wantRaw));   // only raise, +20% ceiling
      if (this._refractoryParams) this._refractoryParams.absoluteWindow = want;
      if (this._refractoryLimiter && this._refractoryLimiter.params) this._refractoryLimiter.params.absoluteWindow = want;  // in-place; no log reset
      applied.refractoryAbsoluteWindow = want;
    } else {
      // disarmed: restore the base window so nothing lingers
      if (this._refractoryParams && this._refractoryParams.absoluteWindow !== base) this._refractoryParams.absoluteWindow = base;
      if (this._refractoryLimiter && this._refractoryLimiter.params && this._refractoryLimiter.params.absoluteWindow !== base) this._refractoryLimiter.params.absoluteWindow = base;
    }
    s.energyOverlays.mode = armed ? 'armed' : 'shadow';
    s.energyOverlays.applied = applied;
    s.energyOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.energyOverlays.note = 'OVERLAY WIRING: the 6 formerly-inert modules + recurrenceAudit receive live inputs (volatility/activeTriggers/load) and compute each cycle. ARMED: metaplasticity raises the refractory dead-time with volatility (in-place, clamped, reversible). Everything else is proposal/observe-only; removal mechanisms never actuate.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.energyOverlays;
    return s.energyOverlays;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE PERCEPT (SHADOW) - 2026-07-17. The domain phase as an INFERENCE grounded
  // in node evidence, via assets/js/limen-phase-percept.js. Today the live phase is
  // a stress-threshold heuristic (prior-only) that discards the kernel-scored node
  // phases already arriving on state.companies (each carries .phase + .scored from
  // domainCompanyJoin). This computes the would-be phase as a precision-weighted
  // posterior: prior = the brain's own expected phase (energyPhaseDynamics.myPhase,
  // Thing2 kernel or fallback); evidence = the scored nodes' phase distribution;
  // precision = coverage x count-saturation. Under thin evidence it ABSTAINS (holds
  // the prior, flagged ungrounded) rather than fabricate. SHADOW: logged next to the
  // live phase (wouldChange); nothing here sets state.phase / state.phaseLabel.
  // CAUSAL RULE: evidence flows nodes -> brain only; the brain never writes a node's
  // phase. Grounding flows in; nothing hallucinates outward.
  // ════════════════════════════════════════════════════════════════════════════
  // Canonical P0–P10 recursion-arc register (matches domain-console-brain.js).
  var ENERGY_PHASE_LABELS = { p0: 'SOURCE', p1: 'RUPTURE', p2: 'RHYTHM', p3: 'INSTABILITY', p4: 'STABILISATION',
    p5: 'ENDURANCE', p6: 'ORDER', p7: 'DIVERGENCE', p7a: 'TERMINAL', p7b: 'SEPARATION', p8: 'PIVOT', p9: 'COLLAPSE', p10: 'RESURRECTION' };

  // Compute the phase percept from a given prior + the node evidence on state.companies.
  // Pure/observational: sets state.energyPhasePercept and returns it. Does NOT arm s.phase
  // (arming is the caller's job, in _computeEnergyPhaseDynamics, once the authoritative
  // phase is known). priorPhase/priorSource optional (falls back to phase dynamics / s.phase).
  EnergyBrain.prototype._computeEnergyPhasePercept = function (priorPhase, priorSource) {
    var s = this.state;
    var PH = (typeof window !== 'undefined' && window.LIMENPHASE) ? window.LIMENPHASE
      : (typeof module !== 'undefined' ? (function () { try { return require('../limen-phase-percept.js'); } catch (e) { return null; } })() : null);
    if (!PH) { s.energyPhasePercept = { version: 1, mode: 'off', note: 'limen-phase-percept.js not loaded on this page' }; return null; }

    // PRIOR: the brain's own generative-model phase (kernel-driven when available, else the
    // snapshot heuristic). Top-down expectation, never evidence. Passed in by phase dynamics;
    // falls back to the prior stored on energyPhaseDynamics / s.phase for a standalone call.
    if (priorPhase == null) {
      var pd = s.energyPhaseDynamics || {};
      priorPhase = pd.priorPhase || pd.myPhase || s.phase || 'p0';
      priorSource = priorSource || pd.phaseSource || s.phaseSource || 'fallback';
    }

    // EVIDENCE: the kernel-scored node phases already on state.companies (from
    // domainCompanyJoin). The module counts ONLY entries with scored===true + a real phase.
    var percept = PH.computePercept({ phase: priorPhase, source: priorSource || 'fallback' }, s.companies || []);

    // SHADOW comparison against the prior-only heuristic the live system reported before
    // grounding (captured at scoreStress, so it is never the armed value).
    var livePhase = String(this._phaseHeuristicRaw || s.phase || 'p0').toLowerCase();
    percept.livePhase = livePhase;
    percept.liveLabel = s.phaseLabel || null;
    percept.groundedLabel = percept.grounded ? (ENERGY_PHASE_LABELS[percept.groundedPhase] || null) : null;
    percept.wouldChange = percept.grounded && (percept.groundedPhase !== livePhase);
    percept.armed = !!(this._actuation && this._actuation.phasePercept);

    // Behaviour log: record grounded divergences so "did node evidence correct the
    // prior" is measurable over time (mirrors the interoception blind-channel log).
    if (!this._energyPhaseLog) this._energyPhaseLog = [];
    if (percept.divergent) {
      this._energyPhaseLog.push({ cycle: (s.energyModel && s.energyModel.cycle) || 0,
        prior: percept.prior.phase, grounded: percept.groundedPhase, precision: percept.precision,
        error: percept.predictionError.magnitude, scored: percept.evidence.scored });
      if (this._energyPhaseLog.length > 20) this._energyPhaseLog = this._energyPhaseLog.slice(-20);
    }
    percept.divergenceLog = this._energyPhaseLog.slice(-5);

    s.energyPhasePercept = percept;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.phasePercept = percept;   // additive
    return percept;
  };

  // ── E/I BALANCE + SELF-AUDIT ADVISORIES (additive, observe-only, 2026-07-13) ──────────────
  // Closes two of the biggest gaps the neurology-reference audit found: (1) the E/I balance
  // invariant (XIII.1 - inhibition must scale with drive; the doc's most-repeated rule), and
  // (2) actually CONSUMING the self-audit (XIV connectivity / single-points-of-failure) that was
  // computed-and-discarded. Deterministic, no AI, no writes. The brain now SEES its own runaway
  // risk + brittle nodes each cycle. Actuating these into the live brake is a separate,
  // operator-scoped step (same discipline as the refractory limiter, commit 2e6f0c11).
  EnergyBrain.prototype._computeEnergyRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance - is inhibition tracking drive?
    try {
      var EI = (typeof window !== 'undefined' && window.EnergyEIBalance) || null;
      if (!EI && typeof require === 'function') { try { EI = require('../energy-ei-balance.js'); } catch (_e) {} }
      if (EI && typeof EI.assessFromState === 'function') out.eiBalance = EI.assessFromState(s);
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit - CONSUME the connectivity / SPOF audit (was inert). Guarded on presence.
    // Edges (81) live in energy.json, NOT in the live snapshot (_rawDomain carries signals/stress
    // only) - the earlier version read _rawDomain.edges and got null every cycle. Lazily fetch +
    // cache them once (browser fire-and-forget, matching the DC loader; server via require) so the
    // audit runs on the REAL graph. First browser cycle = loading; then it consumes.
    try {
      var self = this;
      var edges = (s._rawDomain && Array.isArray(s._rawDomain.edges) && s._rawDomain.edges) ||
                  (Array.isArray(s.edges) && s.edges) || this._energyEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._energyEdgesPromise) {
          this._energyEdgesPromise = fetch('/assets/data/domains/energy.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._energyEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/energy.json'); if (ed && Array.isArray(ed.edges)) { this._energyEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      var CA = (typeof window !== 'undefined' && window.EnergyConnectivityAudit) || null;
      if (!CA && typeof require === 'function') { try { CA = require('../energy-connectivity-audit.js'); } catch (_e) {} }
      if (CA && edges && edges.length && typeof CA.singlePointsOfFailure === 'function') {
        var audit = CA.singlePointsOfFailure({ edges: edges });
        var spof = (audit && audit.articulationNodes) || [];
        out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: spof.length, spof: spof.slice(0, 5),
          verdict: (audit && audit.verdict) || null, topHubs: (audit && audit.topHubsByDegree) || [] };
      } else {
        out.selfAudit = { consumed: false, note: edges ? 'connectivity-audit not loaded' : 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    return out;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // MULTIMODAL INTEROCEPTION (Phase 1) - the north-star first slice, for energy.
  // Energy's stress read was single-channel (financial) = alexithymic: the self-
  // model could score itself calm on money while other live channels screamed.
  // This integrates the channels energy ALREADY computes (no new data systems) into
  // one confidence-weighted interoceptive read and, crucially, detects DIVERGENCE:
  // the primary financial channel disagreeing with the consensus of the others.
  // The blind-channel case (financial calm, another channel alarmed) is surfaced +
  // logged for behaviour measurement (did it flag a real divergence).
  //
  // Per the north-star discipline: ONE engine + per-domain weight profile (config,
  // not systems); explicitly Phase 1 (confidence-weighted + divergence, NOT full
  // predictive-coding active inference); OBSERVE-ONLY - never modifies state.stress
  // or the scoring spine. Additive. Reads the layers computed above this cycle.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._computeEnergyInteroception = function () {
    var s = this.state, em = s.energyModel || {};
    var cl = function (x) { return Math.max(0, Math.min(1, x)); };
    var r3 = function (x) { return Math.round(x * 1000) / 1000; };

    // ENERGY's per-domain weight profile (other domains would carry different weights;
    // this is the "config not 100 systems" moat surface).
    var W = { financial: 1.0, prediction: 0.85, regulation: 0.7, metacognitive: 0.75, immune: 0.6, allostatic: 0.6 };

    var channels = [];

    // 1. FINANCIAL (primary / structured) - the channel the old caveat named.
    channels.push({ name: 'financial', primary: true, alarm: r3(cl(s.stress || 0)), confidence: 0.9, weight: W.financial, provenance: 'structured stress-drivers' });

    // 2. PREDICTION (predictive-coding surprise) - is the model surprised?
    var pe = (em.predictionError && typeof em.predictionError.total === 'number') ? em.predictionError.total : null;
    if (pe !== null) channels.push({ name: 'prediction', alarm: r3(cl(pe)), confidence: 0.7, weight: W.prediction, provenance: 'model prediction error' });

    // 3. REGULATION (homeostatic set-point) - regulated vs surprised/starving.
    var reg = em.regulation || {};
    if (reg.state || reg.starving || reg.flooding) {
      var ra = reg.starving ? 0.8 : (reg.state === 'surprised' ? 0.65 : (reg.flooding ? 0.55 : (/dysreg|alarm|stress/i.test(String(reg.state)) ? 0.7 : 0.15)));
      channels.push({ name: 'regulation', alarm: r3(ra), confidence: 0.6, weight: W.regulation, provenance: 'regulation state (' + (reg.state || (reg.starving ? 'starving' : 'flooding')) + ')' });
    }

    // 4. METACOGNITIVE (truth brake / outcome ledger) - am I actually being right?
    var led = s.energyOutcomeLedger || {};
    if (typeof led.callHitRate === 'number' && led.resolvedSamples >= 3) {
      channels.push({ name: 'metacognitive', alarm: r3(cl(1 - led.callHitRate)), confidence: led.resolvedSamples >= 5 ? 0.7 : 0.4, weight: W.metacognitive, provenance: 'realized call hit-rate (' + led.resolvedSamples + ' resolved)' });
    }

    // 5. IMMUNE (self-integrity) - chronically 'active' at baseline (quarantined
    //    synthetic-portal antigen), so 'active' is down-weighted; only 'alert' screams.
    var im = s.energyImmune || {};
    if (im.immuneState) {
      var iaMap = { clear: 0, watch: 0.34, active: 0.4, alert: 1.0 };
      var ia = (typeof iaMap[im.immuneState] === 'number') ? iaMap[im.immuneState] : 0.34;
      channels.push({ name: 'immune', alarm: r3(ia), confidence: im.immuneState === 'active' ? 0.4 : 0.6, weight: W.immune, provenance: 'immune state (' + im.immuneState + ')' });
    }

    // 6. ALLOSTATIC (forward render) - am I heading somewhere worse than now?
    var fc = s.energyForecast || null;
    if (fc && typeof fc.projectedStress === 'number') {
      var rising = fc.direction === 'rising' || fc.projectedStress > (s.stress || 0);
      var aa = rising ? cl((fc.projectedStress - (s.stress || 0)) * 3) : cl((fc.projectedStress - (s.stress || 0)) * 1.5);
      channels.push({ name: 'allostatic', alarm: r3(aa), confidence: (typeof fc.confidence === 'number' ? cl(fc.confidence) : 0.4), weight: W.allostatic, provenance: 'forecast (' + (fc.direction || '?') + ')' });
    }

    // ── Integration (confidence x weight; NOT a naive sum) ──
    var primary = channels[0];
    var others = channels.slice(1);
    var wsum = function (arr) {
      var num = 0, den = 0;
      for (var i = 0; i < arr.length; i++) { var ew = arr[i].weight * arr[i].confidence; num += arr[i].alarm * ew; den += ew; }
      return den > 0 ? num / den : 0;
    };
    var consensusOther = others.length ? wsum(others) : 0;
    var integrated = wsum(channels);
    var alarms = channels.map(function (c) { return c.alarm; });
    var uncertainty = alarms.length ? (Math.max.apply(null, alarms) - Math.min.apply(null, alarms)) : 0;

    // ── Divergence / blind-channel salience ──
    var DIV_T = 0.22;
    var pa = primary.alarm;
    var divergence = consensusOther - pa;   // positive => calm on money, alarmed elsewhere (blind spot)
    var salience = 'aligned', attend = null;
    if (others.length && divergence >= DIV_T && pa < 0.5) {
      // loudest non-financial channel that clears a meaningful floor
      var best = null;
      for (var j = 0; j < others.length; j++) {
        if (others[j].alarm < 0.4) continue;
        var sc = others[j].alarm * others[j].confidence;
        if (!best || sc > best._sc) { best = others[j]; best._sc = sc; }
      }
      if (best) { salience = 'blind-channel'; attend = best.name; }
    } else if (pa >= 0.5 && (pa - consensusOther) >= DIV_T) {
      salience = 'financial-only';   // money alarmed, other channels calm - financial-specific / possible overreaction
    }

    // ── Behaviour log: record blind-channel flags so "did it flag divergence" is measurable ──
    if (!this._energyInteroLog) this._energyInteroLog = [];
    if (salience === 'blind-channel') {
      this._energyInteroLog.push({ cycle: em.cycle || 0, attend: attend, divergence: r3(divergence), primaryAlarm: r3(pa), consensusOther: r3(consensusOther) });
      if (this._energyInteroLog.length > 20) this._energyInteroLog = this._energyInteroLog.slice(-20);
    }

    s.energyInteroception = {
      version: 1,
      method: 'phase1-weighted-divergence',    // NOT full predictive-coding active inference
      observeOnly: true,                        // never modifies stress / scoring
      channels: channels.map(function (c) { return { name: c.name, alarm: c.alarm, confidence: c.confidence, weight: c.weight, provenance: c.provenance }; }),
      channelCount: channels.length,
      primary: 'financial',
      primaryAlarm: r3(pa),
      consensusOther: r3(consensusOther),
      integrated: r3(integrated),
      divergence: r3(divergence),
      uncertainty: r3(uncertainty),
      salience: salience,                        // 'blind-channel' | 'financial-only' | 'aligned'
      attend: attend,                            // loudest ignored channel, or null
      recentDivergences: this._energyInteroLog.slice(-8),
      note: 'observe-only; integrates energy\'s own live channels; does NOT modify stress/scoring; per-domain weight profile; full active inference not yet built'
    };
    // Alias into the canonical generic field so the brain->civilization adapter and the
    // master brain see interoception uniformly across all 20 domains (energy computes its
    // own richer version above; the other 19 use the base _computeGenericInteroception).
    s.interoception = s.energyInteroception;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.interoception = s.energyInteroception;
    return s.energyInteroception;
  };

  // K2/K6/K7 loop-closure helper - applied by surfaceOpportunities after the rank sort.
  // Reads the PRIOR cycle's neuro layers (null on cycle 1 -> returns opps unchanged).
  EnergyBrain.prototype._applyNeuroGating = function (opps) {
    var s = this.state;
    var inh = s.energyInhibition || null, att = s.energyAttention || null, gc = s.energyGainControl || null;
    var rb = this._readRequestBiases ? this._readRequestBiases() : {};
    var laneBias = (rb && rb.valuationLane) ? rb.valuationLane : null;
    if (!inh && !att && !gc && !laneBias) { s._neuroGatedCount = 0; return opps; }
    // operator steer: lane preference (INVESTABLE vs RESEARCHABLE) boosts rank before the cap
    if (laneBias) opps.forEach(function (o) { if (o.path === laneBias) o.rank = (o.rank || 0) * 1.3; });
    // K7 lateral inhibition - down-weight opportunities tied to non-winner diagnoses
    if (inh && inh.competitors && inh.competitors.length) {
      var sup = {}; inh.competitors.forEach(function (c) { sup[c.id] = c.suppressBy || 0; });
      opps.forEach(function (o) { if (o.diagnosisId && sup[o.diagnosisId]) o.rank = Math.max(0, (o.rank || 0) * (1 - sup[o.diagnosisId])); });
    }
    // K6 attention - boost opportunities tied to focus diagnoses
    if (att && att.focus && att.focus.length) {
      var foc = {}; att.focus.forEach(function (f) { foc[f.id] = f.salience || 0; });
      opps.forEach(function (o) { if (o.diagnosisId && foc[o.diagnosisId]) o.rank = (o.rank || 0) * (1 + 0.15 * foc[o.diagnosisId]); });
    }
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });   // re-rank after re-weighting
    // K2 gain - cap ranked output to the gain-scaled count
    s._neuroGatedCount = 0;
    if (gc && typeof gc.outputScale === 'number' && gc.outputScale < 1 && opps.length > 1) {
      var cap = Math.max(1, Math.round(opps.length * gc.outputScale));
      // PHASE-COHERENCE ACTUATION: coherent coupling to stressed, co-phased peers opens the
      // processing window (comm-through-coherence) -> surface +1 (bounded, reversible via _actuation.phase).
      var pd = s.energyPhaseDynamics;
      if (this._actuation && this._actuation.phase && pd && pd.couplingStrength > 0.15) cap = Math.min(opps.length, cap + 1);
      if (cap < opps.length) { s._neuroGatedCount = opps.length - cap; opps = opps.slice(0, cap); }
    }
    return opps;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // HALT BRAKE (stop-circuit) - the prerequisite for any autonomous emission.
  // The governor layers (immune / conscience / regulation / pulse) previously only
  // ANNOTATED danger. This converts them into an actual brake: on a danger state,
  // emission is halted or dampened, not just flagged. Computed each cycle end from the
  // already-computed governor layers; CONSUMED next cycle by _checkDiagnosisActions
  // (action drafts) and _applyEmissionBrake (opportunities). Recurrent, one-cycle lag.
  // Fail-open when brake state is absent (cycle 1) - to be flipped to fail-safe when
  // autonomous emission is turned on. Additive; never rewrites the scoring spine.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._computeEnergyBrake = function () {
    var s = this.state, em = s.energyModel || {}, reg = em.regulation || {};
    var im = s.energyImmune || {}, con = s.energyConscience || {};
    var diags = s.diagnoses || [];
    var activeUnblocked = diags.filter(function (d) { return d.active && !d.blocked; });
    var reasons = [];
    // full-halt conditions - acting here would be unsafe or unsupported
    if (im.immuneState === 'alert') reasons.push({ code: 'immune-alert', severity: 'halt', detail: 'immune severity ' + (im.severity || '?') });
    if (reg.stale) reasons.push({ code: 'stale-feeds', severity: 'halt', detail: 'feeds older than staleness window' });
    if (diags.length && activeUnblocked.length === 0) reasons.push({ code: 'no-evidence-backed-diagnosis', severity: 'halt', detail: 'all active diagnoses blocked by the evidence contract' });
    // dampen conditions - emit but at reduced confidence, hold for review.
    // NOTE: immune is chronically 'active' (baseline quarantined synthetic-portal antigen), so
    // 'active' is NOT a dampen trigger; only acute 'alert' halts. Acute uncertainty is caught by
    // the prediction-error spike below, decoupled from the baseline antigen load.
    var pe = (em.predictionError && em.predictionError.total) || 0;
    if (pe > 0.4) reasons.push({ code: 'prediction-error-spike', severity: 'dampen', detail: 'predictionError ' + (Math.round(pe * 1000) / 1000) });
    if (reg.flooding) reasons.push({ code: 'opportunity-flood', severity: 'dampen', detail: 'opportunity count above flood cap' });
    if (con.conscienceState === 'restrictive' && con.artifactReadinessDecision && !con.artifactReadinessDecision.researchReady && !con.artifactReadinessDecision.investmentReady) reasons.push({ code: 'conscience-no-lane', severity: 'dampen', detail: 'no artifact lane cleared by conscience' });
    // TRUTH BRAKE feed - poor realized calibration dampens emission
    var led = s.energyOutcomeLedger || {};
    if (typeof led.callHitRate === 'number' && led.resolvedSamples >= 5 && led.callHitRate < 0.34) reasons.push({ code: 'poor-call-calibration', severity: 'dampen', detail: 'realized call hit-rate ' + led.callHitRate + ' over ' + led.resolvedSamples + ' resolved' });
    // E/I BRAKE ACTUATION (Neuro Ref XIII.1): the brake now scales PROPORTIONALLY with drive via the
    // regulate-to-target servo - inhibition that does not track drive raises the brake continuously,
    // not just in discrete steps. Reversible (this._actuation.eiBrake). Effector = emission dampening.
    var servo = s.energyServo || null, eiFactor = 1;
    if (this._actuation && this._actuation.eiBrake && servo) {
      if (typeof servo.emissionFactor === 'number') eiFactor = servo.emissionFactor;
      if (servo.state === 'runaway-risk') reasons.push({ code: 'ei-imbalance', severity: 'dampen', detail: 'inhibition ' + servo.inhibition + ' below target ' + servo.target + ' (drive ' + servo.drive + ')' });
    }
    var halt = reasons.some(function (r) { return r.severity === 'halt'; });
    var dampen = reasons.some(function (r) { return r.severity === 'dampen'; });
    var level = halt ? 'halt' : dampen ? 'dampen' : 'clear';
    var brake = {
      version: 1,
      level: level,
      engaged: halt,
      dampen: dampen,
      reasons: reasons,
      suppressActions: halt,                                   // block action-draft emission entirely
      suppressOpportunities: halt,                             // hold opportunities from (future) autonomous emission
      confidencePenalty: Math.min(halt ? 0 : dampen ? 0.5 : 1, eiFactor),   // discrete governor penalty blended with PROPORTIONAL E/I dampening (min = strongest brake wins)
      eiFactor: (Math.round(eiFactor * 1000) / 1000),          // the proportional E/I contribution (1 = no E/I dampening)
      note: level === 'clear' ? 'stop-circuit clear - emission allowed'
        : level === 'halt' ? 'STOP-CIRCUIT ENGAGED - action emission halted, opportunities held'
        : 'stop-circuit dampening - confidence reduced, emission held for review',
      lastBrakeAt: em.updated || Date.now()
    };
    s.energyBrake = brake; return brake;
  };

  // Consumed by surfaceOpportunities (end): applies the prior cycle's brake to the
  // opportunity set. Halt -> hold + zero confidence; dampen -> halve confidence.
  EnergyBrain.prototype._applyEmissionBrake = function (opps) {
    var brake = this.state.energyBrake;
    if (!brake || brake.level === 'clear') { this.state.opportunitiesHeld = false; return opps; }
    var pen = (typeof brake.confidencePenalty === 'number') ? brake.confidencePenalty : 1;
    var codes = (brake.reasons || []).map(function (r) { return r.code; }).join(',');
    for (var i = 0; i < opps.length; i++) {
      if (pen < 1 && typeof opps[i].confidence === 'number') opps[i].confidence = Math.round(opps[i].confidence * pen);
      if (brake.suppressOpportunities) { opps[i].held = true; opps[i].heldReason = codes; }
    }
    this.state.opportunitiesHeld = !!brake.suppressOpportunities;
    return opps;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 - TRUTH BRAKE (outcome ledger). K4 learned from stress self-prediction;
  // this learns from whether a CALL held up. Each non-held surfaced opportunity is
  // tracked to confirmed / falsified against realized stress + diagnosis persistence.
  // callHitRate feeds K4 credit assignment and the halt brake. Additive; own ledger.
  // ════════════════════════════════════════════════════════════════════════════
  var EK_LEDGER_CONFIRM = 3;      // cycles a call must hold to confirm
  var EK_LEDGER_MAXAGE = 20;      // cycles before an open call expires
  var EK_LEDGER_DELTA = 0.1;      // stress drop that falsifies a persistence call
  var EK_LEDGER_MAX = 60;         // ledger cap
  var EK_FORECAST_HORIZON = 8;    // periods projected forward
  var EK_FORECAST_WINDOW = 12;    // history window for the trend
  var EK_EMIT_MAXCONCURRENT = 3;  // solo capital-fit: few decision-ready calls

  EnergyBrain.prototype._scoreEnergyCallOutcomes = function () {
    var s = this.state, em = s.energyModel || {};
    var led = this._energyCallLedger = this._energyCallLedger || [];
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var activeIds = {};
    (s.diagnoses || []).forEach(function (d) { if (d.active) activeIds[d.id] = true; });
    // 1) resolve open calls against what actually unfolded
    for (var i = 0; i < led.length; i++) {
      var c = led[i];
      if (c.status !== 'open') continue;
      c.age = (c.age || 0) + 1;
      var dxGone = c.diagnosisId && !activeIds[c.diagnosisId];
      if (cur <= c.emitStress - EK_LEDGER_DELTA || dxGone) { c.status = 'falsified'; c.resolvedStress = cur; this._energyResolvedTotal = (this._energyResolvedTotal || 0) + 1; }
      else if (c.age >= EK_LEDGER_CONFIRM && cur >= c.emitStress) { c.status = 'confirmed'; c.resolvedStress = cur; this._energyResolvedTotal = (this._energyResolvedTotal || 0) + 1; }
      else if (c.age >= EK_LEDGER_MAXAGE) { c.status = 'expired'; c.resolvedStress = cur; }
    }
    // 2) register new calls from current NON-HELD top opportunities (dedupe by diagnosis+path)
    var open = {};
    led.forEach(function (c) { if (c.status === 'open') open[c.key] = true; });
    var opps = (s.opportunities || []).filter(function (o) { return !o.held; }).slice(0, 3);
    for (var j = 0; j < opps.length; j++) {
      var o = opps[j];
      var key = (o.diagnosisId || o.source || 'opp') + '|' + (o.path || '');
      if (open[key]) continue;
      led.push({ id: 'call_' + key + '_' + (em.cycle || 0), key: key, diagnosisId: o.diagnosisId || null, path: o.path || null, emitStress: cur, emitCycle: em.cycle || 0, status: 'open', age: 0, thesis: 'elevated stress persists / diagnosis holds' });
      open[key] = true;
    }
    if (led.length > EK_LEDGER_MAX) this._energyCallLedger = led = led.slice(-EK_LEDGER_MAX);
    // 3) calibration
    var confirmed = 0, falsified = 0, openN = 0, expired = 0;
    led.forEach(function (c) { if (c.status === 'confirmed') confirmed++; else if (c.status === 'falsified') falsified++; else if (c.status === 'open') openN++; else expired++; });
    var resolved = confirmed + falsified;
    var ledger = {
      version: 1, open: openN, confirmed: confirmed, falsified: falsified, expired: expired,
      resolvedSamples: resolved,                                  // WINDOWED (can dip when the ledger caps) — do NOT use for plasticity freshness
      resolvedTotal: this._energyResolvedTotal || 0,              // MONOTONIC cumulative resolutions — the correct plasticity-freshness clock (no saturation, no double-teach)
      callHitRate: resolved >= 1 ? Math.round((confirmed / resolved) * 100) / 100 : null,
      note: 'TRUTH BRAKE: each surfaced call resolved to confirmed/falsified vs realized stress + diagnosis persistence; callHitRate feeds K4 + the halt brake.',
      lastLedgerAt: em.updated || Date.now()
    };
    s.energyOutcomeLedger = ledger; return ledger;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 4 - FORWARD RENDERING. The emitted artifact becomes a forecast with an
  // explicit falsifier (front-run), not a nowcast. Projects the stress trajectory
  // from the learned trend; confidence is scaled by the truth brake's realized
  // calibration. Uses only history + prior + ledger already on state. No new fetches.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._computeEnergyForecast = function () {
    var s = this.state, em = s.energyModel || {};
    var hist = ((s.memory && s.memory.stressHistory) || []).slice(-EK_FORECAST_WINDOW);
    var n = hist.length, cur = (typeof s.stress === 'number') ? s.stress : 0, slope = 0;
    if (n >= 3) {
      var sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (var i = 0; i < n; i++) { var x = i, y = hist[i].stress || 0; sx += x; sy += y; sxy += x * y; sxx += x * x; }
      var d = (n * sxx - sx * sx);
      slope = d !== 0 ? (n * sxy - sx * sy) / d : 0;
    }
    var projected = Math.max(0, Math.min(1, cur + slope * EK_FORECAST_HORIZON));
    var direction = slope > 0.005 ? 'rising' : slope < -0.005 ? 'falling' : 'stable';
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var led = s.energyOutcomeLedger || {};
    var calib = (typeof led.callHitRate === 'number') ? led.callHitRate : null;
    var conf = Math.round(Math.max(0, Math.min(1, (1 - pe) * (calib === null ? 0.7 : calib))) * 100) / 100;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primary = active[0] || null;
    var fc = {
      version: 1, horizonPeriods: EK_FORECAST_HORIZON,
      currentStress: Math.round(cur * 1000) / 1000, projectedStress: Math.round(projected * 1000) / 1000,
      direction: direction, slope: Math.round(slope * 10000) / 10000, confidence: conf,
      primaryDiagnosis: primary ? primary.id : null,
      falsifier: direction === 'rising'
        ? 'stress falls >= ' + EK_LEDGER_DELTA + ' below current within ' + EK_FORECAST_HORIZON + ' periods, or ' + (primary ? primary.id : 'primary dx') + ' deactivates'
        : direction === 'falling'
        ? 'stress rises >= ' + EK_LEDGER_DELTA + ' above current within ' + EK_FORECAST_HORIZON + ' periods'
        : 'stress moves >= ' + EK_LEDGER_DELTA + ' either way within ' + EK_FORECAST_HORIZON + ' periods',
      calibratedBy: calib === null ? 'uncalibrated (default 0.7)' : 'call-ledger hitRate ' + calib,
      note: 'FORWARD call with falsifier - the front-run artifact, not a nowcast.',
      lastForecastAt: em.updated || Date.now()
    };
    s.energyForecast = fc; return fc;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 5 - CAPITAL-FIT PACKAGING. Autonomy for a SOLO operator means FEWER,
  // decision-ready calls, not more. Prunes to the few non-held, allowed-lane calls a
  // solo operator can act on; packages each with forecast + falsifier + instrument +
  // moneyChain. Investment packages carry requiresSignoff (financial gate).
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._computeEnergyEmissionQueue = function () {
    var s = this.state, em = s.energyModel || {}, brake = s.energyBrake || {};
    var cfg = this._energyCapitalConfig = this._energyCapitalConfig || { maxConcurrent: EK_EMIT_MAXCONCURRENT, lanes: ['INVESTABLE', 'RESEARCHABLE'] };
    var fc = s.energyForecast || null;
    var pool = (s.opportunities || []).filter(function (o) { return !o.held && o.path && cfg.lanes.indexOf(o.path) !== -1; });
    var queue = pool.slice(0, cfg.maxConcurrent).map(function (o) {
      var capital = (o.path === 'INVESTABLE');
      return {
        id: o.id, title: o.title, lane: o.path, confidence: o.confidence,
        forecast: fc ? { direction: fc.direction, projectedStress: fc.projectedStress, horizonPeriods: fc.horizonPeriods, falsifier: fc.falsifier, confidence: fc.confidence } : null,
        thesis: o.whyNow || o.title, moneyChain: o.moneyChain || null,
        instrument: (o.companies && o.companies.length) ? o.companies : (o.examples || []),
        requiresSignoff: capital,                       // FINANCIAL GATE: capital always human
        decision: capital ? 'commit-capital? (human sign-off required)' : 'research emit (autonomous-eligible)',
        brakeLevel: brake.level || 'clear'
      };
    });
    var q = { version: 1, maxConcurrent: cfg.maxConcurrent, poolSize: pool.length, queued: queue.length, prunedOut: Math.max(0, pool.length - queue.length), packages: queue, note: 'capital-fit: pruned to the few decision-ready calls a solo operator can act on; investment requires sign-off, research is autonomous-eligible.', lastQueueAt: em.updated || Date.now() };
    s.energyEmissionQueue = q; return q;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 6 - AUTONOMOUS EMISSION (financially gated). Research packages emit
  // autonomously into the operator stream; investment packages ALWAYS stage for
  // sign-off. FAIL-SAFE: with autonomy on, anything other than a clear brake holds
  // everything. Flag window.LIMEN_ENERGY_AUTONOMY (default on). Internal stream only
  // (audience of one) - no external distribution, freeze-safe.
  // ════════════════════════════════════════════════════════════════════════════
  EnergyBrain.prototype._runEnergyAutonomousEmission = function () {
    var s = this.state, em = s.energyModel || {}, brake = s.energyBrake || null;
    var on = (typeof window !== 'undefined' && typeof window.LIMEN_ENERGY_AUTONOMY !== 'undefined') ? !!window.LIMEN_ENERGY_AUTONOMY : true;
    var emitted = [], staged = [], holdReason = null;
    if (!on) holdReason = 'autonomy-off';
    else if (!brake || brake.level !== 'clear') holdReason = 'brake-' + (brake ? brake.level : 'absent');   // FAIL-SAFE
    var q = (s.energyEmissionQueue && s.energyEmissionQueue.packages) || [];
    if (!holdReason) {
      for (var i = 0; i < q.length; i++) {
        var p = q[i];
        if (p.requiresSignoff) { p.status = 'staged-for-signoff'; staged.push(p); }   // FINANCIAL GATE
        else { p.status = 'emitted'; emitted.push(p); }                               // research: autonomous
      }
    } else {
      for (var k = 0; k < q.length; k++) { q[k].status = 'held'; staged.push(q[k]); }
    }
    if (emitted.length) {
      var stream = this.state.energyEmitted = this.state.energyEmitted || [];
      for (var e = 0; e < emitted.length; e++) stream.push({ at: em.updated || Date.now(), cycle: em.cycle || 0, title: emitted[e].title, lane: emitted[e].lane, forecast: emitted[e].forecast });
      if (stream.length > 50) this.state.energyEmitted = stream.slice(-50);
    }
    var out = {
      version: 1, autonomy: on, holdReason: holdReason,
      emittedCount: emitted.length, stagedCount: staged.length, emitted: emitted, staged: staged,
      note: holdReason ? ('emission held: ' + holdReason + ' (fail-safe)') : 'autonomous research emission live; investment staged for sign-off',
      lastEmissionAt: em.updated || Date.now()
    };
    s.energyAutoEmission = out; return out;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // REQUEST STEERING SURFACE - the ONLY write path the operator AI box may use.
  // A prompt enters as a decaying BIAS at the contract's injection points (never a
  // command to an effector, never forces a finding). Config is a bounded control
  // surface (autonomy toggle, capital envelope). Source code is NOT reachable here.
  // ════════════════════════════════════════════════════════════════════════════
  var EK_BIAS_TTL = 20 * 60 * 1000;   // operator steer relaxes over ~20 min (a task set, not a permanent command)

  EnergyBrain.prototype._readRequestBiases = function () {
    var rb = this.state._requestBiasRaw;
    if (!rb) return { stressBias: 0, attentionFocus: [], valuationLane: null, active: false };
    var age = Date.now() - (rb.updatedAt || 0);
    var factor = Math.max(0, 1 - age / EK_BIAS_TTL);
    if (factor <= 0) return { stressBias: 0, attentionFocus: [], valuationLane: null, active: false };
    return { stressBias: (rb.stressBias || 0) * factor, attentionFocus: rb.attentionFocus || [], valuationLane: rb.valuationLane || null, active: true, decay: Math.round(factor * 100) / 100, setAt: rb.updatedAt };
  };

  // Steer (bias) - clamped by construction so a bad/hostile prompt cannot exceed bounds.
  EnergyBrain.prototype.applyRequestBias = function (bias) {
    bias = bias || {};
    var rb = this.state._requestBiasRaw || { stressBias: 0, attentionFocus: [], valuationLane: null };
    if (bias.clear) rb = { stressBias: 0, attentionFocus: [], valuationLane: null };
    if (typeof bias.stressBias === 'number') rb.stressBias = Math.max(0, Math.min(0.3, bias.stressBias));   // cap: steer can never dominate perception
    if (Array.isArray(bias.attentionFocus)) rb.attentionFocus = bias.attentionFocus.slice(0, 5).map(function (x) { return String(x); });
    if (bias.valuationLane === 'INVESTABLE' || bias.valuationLane === 'RESEARCHABLE') rb.valuationLane = bias.valuationLane;
    rb.updatedAt = Date.now();
    this.state._requestBiasRaw = rb;
    return this._readRequestBiases();
  };

  // Config - bounded control surface (autonomy on/off, capital envelope). No code edits.
  EnergyBrain.prototype.setEnergyConfig = function (cfg) {
    cfg = cfg || {};
    this._energyCapitalConfig = this._energyCapitalConfig || { maxConcurrent: EK_EMIT_MAXCONCURRENT, lanes: ['INVESTABLE', 'RESEARCHABLE'] };
    if (typeof cfg.autonomy === 'boolean' && typeof window !== 'undefined') window.LIMEN_ENERGY_AUTONOMY = cfg.autonomy;
    if (typeof cfg.maxConcurrent === 'number') this._energyCapitalConfig.maxConcurrent = Math.max(1, Math.min(8, Math.round(cfg.maxConcurrent)));
    if (Array.isArray(cfg.lanes)) { var allow = cfg.lanes.filter(function (l) { return l === 'INVESTABLE' || l === 'RESEARCHABLE'; }); if (allow.length) this._energyCapitalConfig.lanes = allow; }
    return { autonomy: (typeof window !== 'undefined') ? !!window.LIMEN_ENERGY_AUTONOMY : true, maxConcurrent: this._energyCapitalConfig.maxConcurrent, lanes: this._energyCapitalConfig.lanes };
  };

  // Compact domain readout - the context the box/LLM gets so it "knows its own domain".
  EnergyBrain.prototype.getEnergyStateSummary = function () {
    var s = this.state, em = s.energyModel || {}, n = s.energyNeuro || {}, pd = s.energyPhaseDynamics || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).map(function (d) { return { id: d.id, relevance: d.relevance, blocked: !!d.blocked }; });
    var opps = (s.opportunities || []).slice(0, 6).map(function (o) { return { title: o.title, path: o.path, confidence: o.confidence, held: !!o.held }; });
    var cfg = this._energyCapitalConfig || {};
    return {
      domain: 'energy',
      stress: Math.round((s.stress || 0) * 100) / 100, phase: s.phase || null, stressFlag: s._stressFlag || null,
      // NODE-GROUNDED PHASE: phase is grounded in the domain's own kernel-scored companies when phaseGrounded;
      // phaseDivergent = the grounded phase disagrees with the stress heuristic (phasePrior) = the real signal.
      phaseGrounded: !!pd.grounded, phaseSource: pd.phaseSource || null, phasePrior: pd.priorPhase || null,
      phaseDivergent: !!(pd.phasePercept && pd.phasePercept.divergent),
      phasePrecision: (pd.phasePercept && typeof pd.phasePercept.precision === 'number') ? pd.phasePercept.precision : null,
      regulation: (em.regulation && em.regulation.state) || null,
      predictionError: (em.predictionError && em.predictionError.total) || null,
      predictedStress: (typeof em.predictedStress === 'number') ? Math.round(em.predictedStress * 100) / 100 : null,
      activeDiagnoses: active, topOpportunities: opps,
      forecast: n.forecast ? { direction: n.forecast.direction, projectedStress: n.forecast.projectedStress, confidence: n.forecast.confidence, falsifier: n.forecast.falsifier } : null,
      brake: n.brake ? { level: n.brake.level, reasons: (n.brake.reasons || []).map(function (r) { return r.code; }) } : null,
      outcomeLedger: n.outcomeLedger ? { callHitRate: n.outcomeLedger.callHitRate, confirmed: n.outcomeLedger.confirmed, falsified: n.outcomeLedger.falsified } : null,
      autoEmission: n.autoEmission ? { autonomy: n.autoEmission.autonomy, emittedCount: n.autoEmission.emittedCount, holdReason: n.autoEmission.holdReason } : null,
      config: { autonomy: (typeof window !== 'undefined' && typeof window.LIMEN_ENERGY_AUTONOMY !== 'undefined') ? !!window.LIMEN_ENERGY_AUTONOMY : true, maxConcurrent: cfg.maxConcurrent || 3, lanes: cfg.lanes || ['INVESTABLE', 'RESEARCHABLE'] },
      activeSteering: this._readRequestBiases(),
      interoception: n.interoception ? {
        salience: n.interoception.salience,
        divergence: n.interoception.divergence,
        attend: n.interoception.attend,
        primaryAlarm: n.interoception.primaryAlarm,
        consensusOther: n.interoception.consensusOther,
        channels: (n.interoception.channels || []).map(function (c) { return { name: c.name, alarm: c.alarm, confidence: c.confidence }; }),
        method: n.interoception.method
      } : null,
      interoceptionCaveat: n.interoception
        ? 'multi-channel interoception is Phase 1 (confidence-weighted across ' + n.interoception.channelCount + ' live channels + divergence detection, observe-only); full predictive-coding active inference not yet built'
        : 'stress read rests on a single-channel (financial) interoceptive layer; multimodal not yet built'
    };
  };

  EnergyBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var em = s.energyModel || {};
    var portal = s._portalCache || null;
    var dxId = dx ? (dx.id || null) : null;

    var allTreat = Array.isArray(s.treatments) ? s.treatments : [];
    var treatments = allTreat.filter(function (t) { return !dxId || t.diagnosisId === dxId; });
    var implementationSteps = [];
    for (var ti = 0; ti < treatments.length; ti++) { if (Array.isArray(treatments[ti].steps)) implementationSteps = implementationSteps.concat(treatments[ti].steps); }

    var allOpp = Array.isArray(s.opportunities) ? s.opportunities : [];
    var opps = allOpp.filter(function (o) { return !dxId || o.diagnosisId === dxId; });
    var primaryOpp = opps[0] || null;
    var mc = primaryOpp && primaryOpp.moneyChain ? primaryOpp.moneyChain : null;

    if (primaryOpp && Array.isArray(primaryOpp.steps)) implementationSteps = implementationSteps.concat(primaryOpp.steps);
    if (primaryOpp && Array.isArray(primaryOpp.fastPath)) implementationSteps = implementationSteps.concat(primaryOpp.fastPath);

    var feeds = s.feeds || {}, sourceFeeds = [];
    for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; sourceFeeds.push({ name: fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } }
    if (s._primarySource && !sourceFeeds.length) sourceFeeds.push({ name: 'primary', updated: null, source: s._primarySource });

    var _canon = this._resolveCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'energy',
      diagnosisId: dxId,
      canonicalDiagnosisId: _canon.canonicalDiagnosisId,   // F3: civ alias map or canonical-to-self
      aliasUsed: _canon.aliasUsed,                          // F3
      aliasReviewStatus: _canon.aliasReviewStatus,          // G1c: human-approved | corpus-aliased | null
      aliasRisk: _canon.aliasRisk,                          // G1c
      aliasNote: _canon.aliasNote,                          // G1c
      label: dx ? (dx.label || dx.id || null) : null,
      phase: s.phase || null,
      confidence: (dx && typeof dx.relevance === 'number') ? dx.relevance : (typeof s.confidence === 'number' ? s.confidence : null)
    };
    // G1 — real source bundle for this canonical id (shipped only when it exists; NEVER fabricated).
    var _bundle = (this._bundleCache && this._bundleCache[identity.canonicalDiagnosisId]) || null;
    var _bundleKnown = !!(this._bundleStatusMap && Object.prototype.hasOwnProperty.call(this._bundleStatusMap, identity.canonicalDiagnosisId));
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.investments) ? _bundle.byLane.investments : null;
    var _bArr = function (k) { return (_bl && Array.isArray(_bl[k])) ? _bl[k] : []; };
    var bundleStatus = _bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown');
    var bundleShallow = !!(_bundle && ((_bundle.maxDepth || 0) === 0 || (_bundle.portalCount || 0) <= 1));
    var bundleResolution = identity.aliasUsed
      ? (_bundle ? 'alias-resolved-and-bundle-found' : 'alias-resolved-but-bundle-missing')
      : (_bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown'));
    if (!treatments.length && _bl) treatments = _bArr('treatments');             // backfill from REAL bundle only
    if (!implementationSteps.length && _bl) implementationSteps = _bArr('implementationSteps');
    var brainState = {
      energyModel: { version: em.version || null, cycle: (typeof em.cycle === 'number' ? em.cycle : null) },
      predictionError: em.predictionError || null,
      regulationState: (em.regulation && em.regulation.state) || null,
      prior: em.prior || null,
      observation: em.observation || null,
      plasticity: em.plasticity || null,
      readyForHandoff: em.readyForHandoff === true
    };
    // F2: domain-identity portal fields are KNOWN facts (this IS the energy root),
    // so they populate from constants even when the brain has not cached L0 content yet.
    var rootId = (portal && portal.domainId) || 'energy';
    var rootTitle = (portal && portal.title) || 'Energy';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'energy',
      portalTitle: rootTitle,
      depth: 0,                               // brain operates at the root level only
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',  // L0 cached vs not-yet; never deeper (Phase C)
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)   // G1: bundle's own corpus source (distinct from energy root)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      // J1 — L1 scan result for this diagnosis: treatments are mad-lib (NOT admitted); only real tickers surface, relevance-unverified
      l1Depth: (s._l1DepthCache && s._l1DepthCache.byDiagnosis && s._l1DepthCache.byDiagnosis[dxId]) || (s._l1DepthCache ? { branchesScanned: 0, realCompanyTickers: [], realTreatments: 0, madLibTreatments: 0, admitted: false, reason: 'no L1 branch mapped for this diagnosis' } : null)
    };
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    var evidenceAnchors = _bArr('evidenceAnchors');   // G1: REAL bundle anchors only (empty if no bundle)
    var missingEv = [];
    if (!evidenceAnchors.length) missingEv.push('evidenceAnchors');
    if (!citationHints.length) missingEv.push('citationHints');
    var evidence = {
      sourceFeeds: sourceFeeds,               // real — brain ingests these
      evidenceAnchors: evidenceAnchors,       // real bundle anchors (empty when no bundle)
      citationHints: citationHints,           // real source/feed names only (no invention)
      bundleStatus: bundleStatus,             // G1: found | missing | unknown
      bundleResolution: bundleResolution,     // G1: alias-resolved-and-bundle-found, etc.
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'investments', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,   // G1d: surface external-source provenance
      missingEvidence: missingEv
    };
    // J2 — human-authoring intake: for external-source bundles missing invention candidates, emit
    // structured empty slots (what each needs + which primary source) rather than fabricating them.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = { GRID_FREQUENCY_INSTABILITY: 'NERC reliability standards / IEEE 1547 / utility filings', INTERMITTENCY_SPIKE: 'NREL / IEA PVPS / ISO interconnection studies', PIPELINE_RUPTURE_EVENT: 'PHMSA incident reports / API 1160 / 49 CFR 192', OIL_SHOCK: 'EIA STEO / IEA OMR / OPEC MOMR / patent literature', NUCLEAR_INCIDENT: 'IAEA INES / NRC event reports / 10 CFR / patent literature', SYSTEMIC_ENERGY_STRESS: 'NERC reliability assessments / FERC orders / EIA' };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete technical method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / patent source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
      });
    }
    var treatmentContext = {
      treatments: treatments,                 // real: brain-resolved, else real bundle treatments
      implementationSteps: implementationSteps,
      methodCandidates: _bArr('methodCandidates'),         // G1: REAL bundle only (empty if bundle lacks)
      mechanismCandidates: _bArr('mechanismCandidates'),
      embodimentCandidates: _bArr('embodimentCandidates'),
      figurePlaceholders: _bArr('figurePlaceholders'),
      authoringIntake: authoringIntake        // J2: empty-slot requests for human authoring (external-source bundles)
    };
    var operatorContext = {
      targets: (primaryOpp && primaryOpp._resolvedTargets) ? primaryOpp._resolvedTargets : (mc && mc.target ? [mc.target] : []),
      monitoring: (treatments.length && treatments[0].monitoring) ? treatments[0].monitoring : null,
      escalation: (treatments.length && treatments[0].escalation) ? treatments[0].escalation : null,
      invalidIf: mc ? (mc.invalidIf || null) : null,
      nextStep: mc ? (mc.nextStep || null) : null
    };
    var hasTreat = treatments.length > 0;
    var hasBundle = (bundleStatus === 'found');
    var hasCanonical = !!identity.canonicalDiagnosisId;   // F3: now always resolves (alias or self)
    var blockers = [];
    if (hasCanonical && !hasBundle) blockers.push(identity.aliasUsed ? 'canonical-id-resolved-but-bundle-missing' : 'no-source-bundle');
    if (bundleStatus === 'missing') blockers.push('source-bundle-build-required');   // G1b: real check found no bundle → needs build/import (no auto-alias)
    blockers.push(portalContext.portalStatus === 'root-only' ? 'portal-root-only' : 'portal-not-loaded');
    if (!hasTreat) blockers.push('no-treatments');
    if (!primaryOpp) blockers.push('no-active-opportunity');
    // artifact lanes from REAL opportunity path/compensation (present only on the gated console)
    var lanesIn = [];
    if (primaryOpp && primaryOpp.path) lanesIn.push(primaryOpp.path);
    if (primaryOpp && Array.isArray(primaryOpp.paths)) lanesIn = lanesIn.concat(primaryOpp.paths);
    if (primaryOpp && primaryOpp.compensation && primaryOpp.compensation.type) lanesIn.push(primaryOpp.compensation.type);
    var seenLane = {}, artifactLanes = [];
    for (var li = 0; li < lanesIn.length; li++) { if (lanesIn[li] && !seenLane[lanesIn[li]]) { seenLane[lanesIn[li]] = true; artifactLanes.push(lanesIn[li]); } }
    var readinessReasons = [];
    if (hasBundle) readinessReasons.push('source bundle found (' + bundleResolution + (bundleShallow ? ', root-only' : '') + ', evidenceAnchors=' + evidenceAnchors.length + ')');
    if (hasTreat) readinessReasons.push('treatments present (' + treatments.length + ')');
    if (primaryOpp) readinessReasons.push('opportunity present (path=' + (primaryOpp.path || '?') + ')');
    if (sourceFeeds.length) readinessReasons.push('source feeds present (' + sourceFeeds.length + ')');
    var ready = hasTreat && hasBundle && hasCanonical;
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan lanes purged 2026-06-21 (also vetoed by H3 conscience)
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _ddpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _ddpCompleteness(brainState, ['energyModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _ddpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _ddpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _ddpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _ddpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _ddpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_ddpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _cm('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _cm('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _cm('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _cm('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

    var warnings = [];
    if (portalContext.portalStatus === 'root-only') warnings.push('portalContext is root-only (no deep portal cortex)');
    if (portalContext.portalStatus === 'pending') warnings.push('root portal not yet cached on the brain (domain identity used)');
    if (identity.aliasUsed) warnings.push('alias-resolved; verify source appropriateness');
    if (bundleStatus === 'missing') warnings.push('source bundle missing (no artifact-source bundle for this diagnosis)');
    if (bundleStatus === 'unknown') warnings.push('source bundle not yet checked');
    if (bundleStatus === 'found' && _bundle && _bundle.buildMethod === 'external-source-authored') warnings.push('external-source-authored; human-verification-required (' + (_bundle.humanVerification || 'required') + ')');
    else if (bundleStatus === 'found' && bundleShallow) warnings.push('source-bundle-root-only (real bundle but portalCount<=1 / maxDepth 0)');
    var _emptyCand = [];
    if (!treatmentContext.methodCandidates.length) _emptyCand.push('method');
    if (!treatmentContext.mechanismCandidates.length) _emptyCand.push('mechanism');
    if (!treatmentContext.embodimentCandidates.length) _emptyCand.push('embodiment');
    if (!treatmentContext.figurePlaceholders.length) _emptyCand.push('figure');
    if (_emptyCand.length) warnings.push((bundleStatus === 'found' ? 'bundle found but ' : 'no bundle — ') + 'candidate types still empty: ' + _emptyCand.join(',') + ' (not invented)');
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < EM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

    // G2 — prompt-facing trimming/prioritization. FULL data above is preserved; this is a
    // bounded, diagnosis-relevant subset for the finalizer prompt. Never trims scalars/warnings.
    var G2_CAPS = { evidenceAnchors: 8, treatments: 8, implementationSteps: 8, mechanismCandidates: 6, methodCandidates: 6, embodimentCandidates: 6, figurePlaceholders: 6, citationHints: 8, sourceFeeds: 8 };
    function _g2cap(arr, n) { arr = Array.isArray(arr) ? arr : []; return { sel: arr.slice(0, n), omitted: Math.max(0, arr.length - n) }; }
    var _g2ea = _g2cap(evidenceAnchors, G2_CAPS.evidenceAnchors);
    var _g2tr = _g2cap(treatmentContext.treatments, G2_CAPS.treatments);
    var _g2is = _g2cap(treatmentContext.implementationSteps, G2_CAPS.implementationSteps);
    var _g2mc = _g2cap(treatmentContext.mechanismCandidates, G2_CAPS.mechanismCandidates);
    var _g2md = _g2cap(treatmentContext.methodCandidates, G2_CAPS.methodCandidates);
    var _g2em = _g2cap(treatmentContext.embodimentCandidates, G2_CAPS.embodimentCandidates);
    var _g2fg = _g2cap(treatmentContext.figurePlaceholders, G2_CAPS.figurePlaceholders);
    var _g2ch = _g2cap(citationHints, G2_CAPS.citationHints);
    var _g2sf = _g2cap(sourceFeeds, G2_CAPS.sourceFeeds);
    var promptView = {
      compact: true,
      caps: G2_CAPS,
      selectedEvidenceAnchors: _g2ea.sel,
      selectedTreatments: _g2tr.sel,
      selectedImplementationSteps: _g2is.sel,
      selectedMechanismCandidates: _g2mc.sel,
      selectedMethodCandidates: _g2md.sel,
      selectedEmbodimentCandidates: _g2em.sel,
      selectedFigurePlaceholders: _g2fg.sel,
      selectedCitationHints: _g2ch.sel,
      selectedSourceFeeds: _g2sf.sel,
      omittedCounts: { evidenceAnchors: _g2ea.omitted, treatments: _g2tr.omitted, implementationSteps: _g2is.omitted, mechanismCandidates: _g2mc.omitted, methodCandidates: _g2md.omitted, embodimentCandidates: _g2em.omitted, figurePlaceholders: _g2fg.omitted, citationHints: _g2ch.omitted, sourceFeeds: _g2sf.omitted },
      priorityReasons: [
        'diagnosis-specific bundle anchors preferred over generic energy evidence',
        'official/primary sources retained (EIA/IEA/OPEC/IAEA/NRC/NERC/FERC where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.energyImmune ? ['immune: ' + s.energyImmune.immuneState + ' (sev ' + s.energyImmune.severity + ', ' + (s.energyImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.energyConscience && s.energyConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.energyConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),   // never trimmed (alias / external-source / root-only / canonical / bundle / immune / conscience)
      retainedBlockers: artifactContext.blockers,
      // H1-H6 — compact higher-layer summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.energyImmune ? { immuneState: s.energyImmune.immuneState, severity: s.energyImmune.severity, antigenCount: (s.energyImmune.antigens || []).length, quarantines: s.energyImmune.quarantines, blockedFromTraversal: s.energyImmune.blockedFromTraversal, allowedWithWarning: s.energyImmune.allowedWithWarning } : null,
      awarenessSummary: s.energyAwareness ? { selfNarrative: s.energyAwareness.selfNarrative, knowns: (s.energyAwareness.knowns || []).length, unknowns: (s.energyAwareness.unknowns || []).length, humanReviewRequired: s.energyAwareness.humanReviewRequired } : null,
      conscienceDecision: s.energyConscience ? { conscienceState: s.energyConscience.conscienceState, blockedClaims: s.energyConscience.blockedClaims, artifactReadinessDecision: s.energyConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.energyIntuition ? s.energyIntuition.hunches : null,
      scenarioSummary: s.energySimulation ? (s.energySimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.energyExecutiveReport || null,
      // J1 — L1 depth verdict (real tickers only; treatments mad-lib, not admitted) ; J2 — authoring intake count
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // DC — data-center diagnosis layer (real-content sub-portal, SEPARATE from the validated spine, no bundle yet)
      datacenterSummary: s.datacenterLayer && s.datacenterLayer.loaded ? { count: s.datacenterLayer.count, activeCount: s.datacenterLayer.activeCount, diagnoses: s.datacenterLayer.diagnoses, note: s.datacenterLayer.note } : null
    };

    return {
      schemaVersion: DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (em.updated || null),
        schemaVersion: DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        // H1-H6 — full higher-layer objects (audit only; NOT forwarded to the finalizer prompt)
        immune: s.energyImmune || null,
        awareness: s.energyAwareness || null,
        conscience: s.energyConscience || null,
        intuition: s.energyIntuition || null,
        simulation: s.energySimulation || null,
        executiveReport: s.energyExecutiveReport || null
      }
    };
  };

  /**
   * Generate an investor memo for energy terminal company positioning.
   */
  EnergyBrain.prototype.generateInvestorMemo = function (opportunityIndex) {
    var opp = this.state.opportunities[opportunityIndex || 0];
    if (!opp) return null;

    var pkg = window.LIMENPackageGenerator;
    if (!pkg) return null;

    return pkg.generatePackage({
      domain: 'energy',
      title: opp.title,
      stress: opp.stress,
      sourceType: opp.source,
      confidence: this.state.confidence
    }, 'investor');
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  var brain = new EnergyBrain();
  brain.init();
  brain.start();

  window.LIMENEnergyBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD ENERGY OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isEnergyDomain = (new URLSearchParams(window.location.search)).get('domain') === 'energy';
  if (_isDomainConsole && _isEnergyDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _energyScripts = [
      'assets/js/energy-compensation.js',
      'assets/js/energy-claim-ledger.js',
      'assets/js/energy-claim-flow.js',
      'assets/js/energy-opportunity-economics.js',
      'assets/js/energy-pulse-engine.js',
      'assets/js/energy-operator-panel.js',
      'assets/js/energy-node-business-engine.js',
      'assets/js/energy-business-review.js',
      'assets/js/energy-execution-panels.js',
      'assets/js/energy-business-build.js',
      'assets/js/energy-directive-extractor.js',
      'assets/js/energy-directive-ranker.js',
      'assets/js/energy-directive-translator.js',
      'assets/js/energy-targeting-engine.js',
      'assets/js/energy-promotion-bridge.js',
      'assets/js/energy-clarity-operator.js',
      'assets/js/energy-connectivity-audit.js',
      'assets/js/energy-ei-balance.js'
    ];
    (function loadNext(i) {
      if (i >= _energyScripts.length) return;
      var s = document.createElement('script');
      s.src = _energyScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[EnergyBrain] Failed to load ' + _energyScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

})();
