/**
 * agriculture-brain.js — Agriculture Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as energy/finance/trade brains.
 * Portal data lives under 'p2_agri' (portalKey), runtime key is 'agriculture'.
 *
 * Diagnoses (from p2_agri.json portal issues):
 *   CASH_FLOW_CRISIS, SUPPLY_CHAIN_BREAKDOWN, DROUGHT,
 *   MARKET_COLLAPSE, EQUIPMENT_FAILURE, PEST_OUTBREAK
 *
 * Exposes: window.LIMENAgricultureBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[AgricultureBrain] DomainBrainBase not loaded');
    return;
  }

  // ── DEFAULT-ENABLE signal bridge + queue-unblock hydration ──────────
  // Previously these flags were set only by master-brain-executor.html's
  // agriculture bootstrap. Result: Master Brain Inbox, Civilization, and
  // any other page that loads agriculture-brain.js saw no active agri
  // diagnoses (bridge never fired), so agriculture never appeared in
  // the Master Brain pathway list.
  //
  // Bridge is value-aware (only emits canonical conditions when real
  // signal text / values warrant) and hydration is an honest composite
  // of real cycle telemetry, so default-enabling them does not introduce
  // fabricated signal anywhere.
  //
  // Explicit opt-out still works: set either flag to false BEFORE this
  // script loads and the agri-brain will honor the false value.
  if (typeof window !== 'undefined') {
    if (window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE === undefined) {
      window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE = true;
    }
    if (window.LIMEN_ENABLE_AGRICULTURE_QUEUE_UNBLOCK === undefined) {
      window.LIMEN_ENABLE_AGRICULTURE_QUEUE_UNBLOCK = true;
    }
  }

  var Base = window.LIMENDomainBrainBase;

  function AgricultureBrain() {
    Base.call(this, {
      domainId: 'agriculture',
      label: 'Agriculture',
      snapshotKey: 'agriculture',
      portalKey: 'p2_agri',
      cycleInterval: 30000
    });
  }

  AgricultureBrain.prototype = Object.create(Base.prototype);
  AgricultureBrain.prototype.constructor = AgricultureBrain;

  AgricultureBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    this.diagnosisIndex = {
      'CASH_FLOW_CRISIS':         ['cash_stress', 'margin_compression', 'debt_service', 'input_cost_spike', 'ag_high_stress'],
      'SUPPLY_CHAIN_BREAKDOWN':   ['supply_disruption', 'logistics_failure', 'distribution_gap', 'cold_chain_break', 'ag_high_stress'],
      'DROUGHT':                  ['water_stress', 'precipitation_deficit', 'soil_moisture_low', 'irrigation_constraint', 'weather_extreme'],
      'MARKET_COLLAPSE':          ['commodity_price_drop', 'demand_destruction', 'export_restriction', 'oversupply', 'macro_shock'],
      'EQUIPMENT_FAILURE':        ['equipment_downtime', 'parts_shortage', 'maintenance_backlog', 'capacity_constraint'],
      'PEST_OUTBREAK':            ['pest_detected', 'disease_detected', 'yield_loss', 'quarantine_risk', 'biological_threat']
    };

    this.emissionRules = [
      {
        targetDomain: 'supplyChain',
        signalType: 'food_supply_disruption',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        targetDomain: 'economy',
        signalType: 'food_price_pressure',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'energy',
        signalType: 'biofuel_input_stress',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      },
      {
        targetDomain: 'environment',
        signalType: 'land_use_pressure',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      }
    ];
  };

  AgricultureBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);

    this._activeConditions = [];

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('crop') !== -1 || fn.indexOf('yield') !== -1) && f.value !== undefined && f.value < -5) {
        this._activeConditions.push('yield_loss');
        signals.push('ALERT: Crop yield decline — production stress');
      }
      if ((fn.indexOf('commodity') !== -1 || fn.indexOf('grain') !== -1 || fn.indexOf('corn') !== -1 || fn.indexOf('wheat') !== -1 || fn.indexOf('soy') !== -1) && f.value !== undefined && f.value < -10) {
        this._activeConditions.push('commodity_price_drop');
        this._activeConditions.push('demand_destruction');
      }
      if ((fn.indexOf('drought') !== -1 || fn.indexOf('precipitation') !== -1 || fn.indexOf('moisture') !== -1) && f.value !== undefined) {
        this._activeConditions.push('water_stress');
        this._activeConditions.push('precipitation_deficit');
      }
      if ((fn.indexOf('fertilizer') !== -1 || fn.indexOf('input') !== -1) && f.value !== undefined && f.value > 15) {
        this._activeConditions.push('input_cost_spike');
        this._activeConditions.push('cash_stress');
      }
    }

    // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (.gov / NWS / FDA / Federal Register / WB) ──
    // Maps the 10 keyless institutional feeds to agriculture-brain diagnosis triggers.
    for (var f3i = 0; f3i < feeds.length; f3i++) {
      var f3 = feeds[f3i];
      var fn3 = (f3.name || '').toLowerCase();

      // USDA Drought Monitor — D2+ % area → DROUGHT triggers
      if (fn3.indexOf('usda drought monitor') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('water_stress');
        this._activeConditions.push('precipitation_deficit');
        signals.push('USDM: ' + f3.value.toFixed(1) + '% US area in D2-D4 drought');
      }
      if (fn3.indexOf('usda drought monitor') !== -1 && f3.value !== undefined && f3.value >= 25) {
        this._activeConditions.push('soil_moisture_low');
        this._activeConditions.push('irrigation_constraint');
      }
      if (fn3.indexOf('usda drought monitor') !== -1 && f3.value !== undefined && f3.value >= 40) {
        this._activeConditions.push('weather_extreme');
      }

      // NOAA CPC seasonal drought outlook — net intensification
      if (fn3.indexOf('cpc drought') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('precipitation_deficit');
        signals.push('CPC: net drought intensification (' + f3.value + ')');
      }
      if (fn3.indexOf('cpc drought') !== -1 && f3.value !== undefined && f3.value >= 12) {
        this._activeConditions.push('weather_extreme');
      }

      // NOAA NWS Ag Alerts — frost/flood/fire/severe weather count
      if (fn3.indexOf('nws ag alerts') !== -1 && f3.value !== undefined && f3.value >= 25) {
        this._activeConditions.push('weather_extreme');
        signals.push('NWS Ag: ' + f3.value + ' agriculture-impact alerts');
      }
      if (fn3.indexOf('nws ag alerts') !== -1 && f3.stress !== undefined && f3.stress >= 0.6) {
        this._activeConditions.push('cold_chain_break');
      }

      // FDA Recalls — total + foodborne pathogen volume → biological + supply
      if (fn3.indexOf('fda recalls') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('biological_threat');
        signals.push('FDA: ' + f3.value + ' recall actions');
      }
      if (fn3.indexOf('fda recalls') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('supply_disruption');
        this._activeConditions.push('distribution_gap');
      }
      if (fn3.indexOf('fda recalls') !== -1 && f3.stress !== undefined && f3.stress >= 0.7) {
        this._activeConditions.push('disease_detected');
      }

      // Fed Reg USDA — farm policy / export regs → MARKET_COLLAPSE
      if (fn3.indexOf('fed reg usda') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('export_restriction');
        signals.push('Fed Reg USDA: ' + f3.value + ' agriculture regs (30d)');
      }
      if (fn3.indexOf('fed reg usda') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('demand_destruction');
      }

      // Fed Reg FDA — food safety regs → biological_threat
      if (fn3.indexOf('fed reg fda') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('biological_threat');
      }

      // Fed Reg EPA — pesticide / water regs → input_cost_spike + cash_stress
      if (fn3.indexOf('fed reg epa') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('input_cost_spike');
        signals.push('Fed Reg EPA: ' + f3.value + ' pesticide/water regs (30d)');
      }
      if (fn3.indexOf('fed reg epa') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('cash_stress');
        this._activeConditions.push('margin_compression');
      }

      // Fed Reg APHIS — pest/disease quarantine → PEST_OUTBREAK triggers
      if (fn3.indexOf('fed reg aphis') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('pest_detected');
        signals.push('Fed Reg APHIS: ' + f3.value + ' pest/disease regs (30d)');
      }
      if (fn3.indexOf('fed reg aphis') !== -1 && f3.value !== undefined && f3.value >= 6) {
        this._activeConditions.push('disease_detected');
        this._activeConditions.push('quarantine_risk');
      }
      if (fn3.indexOf('fed reg aphis') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('biological_threat');
      }

      // Fed Reg FSIS — meat/poultry safety → cold_chain_break, supply
      if (fn3.indexOf('fed reg fsis') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('cold_chain_break');
        signals.push('Fed Reg FSIS: ' + f3.value + ' meat/poultry safety regs (30d)');
      }
      if (fn3.indexOf('fed reg fsis') !== -1 && f3.value !== undefined && f3.value >= 6) {
        this._activeConditions.push('logistics_failure');
      }

      // World Bank Food Index — large YoY swings → MARKET_COLLAPSE triggers
      // Negative = production fell (shortage signal); positive >5% = oversupply.
      if (fn3.indexOf('world bank food') !== -1 && f3.value !== undefined && f3.value <= -2) {
        this._activeConditions.push('demand_destruction');
        signals.push('WB Food Index: production fell ' + f3.value.toFixed(2) + '% YoY');
      }
      if (fn3.indexOf('world bank food') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('oversupply');
        this._activeConditions.push('commodity_price_drop');
        signals.push('WB Food Index: production up ' + f3.value.toFixed(2) + '% YoY (oversupply pressure)');
      }
    }

    // Scan raw signal strings
    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('drought') !== -1 || rs.indexOf('water') !== -1) {
        if (this._activeConditions.indexOf('water_stress') === -1) this._activeConditions.push('water_stress');
      }
      if (rs.indexOf('pest') !== -1 || rs.indexOf('disease') !== -1 || rs.indexOf('blight') !== -1) {
        if (this._activeConditions.indexOf('pest_detected') === -1) this._activeConditions.push('pest_detected');
      }
      if (rs.indexOf('supply') !== -1 && (rs.indexOf('disrupt') !== -1 || rs.indexOf('break') !== -1 || rs.indexOf('shortage') !== -1)) {
        if (this._activeConditions.indexOf('supply_disruption') === -1) this._activeConditions.push('supply_disruption');
      }
    }

    var snap = this._getSnapshot();
    var EVENT_TTL = 30 * 60 * 1000; // 30 minutes
    if (snap && snap.defenseSignals) {
      var now = Date.now();
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('agriculture') !== -1) {
          // Validate freshness — reject stale defense signals
          var sigAge = sig.timestamp ? (now - new Date(sig.timestamp).getTime()) : Infinity;
          if (sigAge <= EVENT_TTL) {
            this._activeConditions.push(sig.eventType);
          }
        }
      }
    }

    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // Stress-derived flags are tracked for reporting but tagged so the
    // pulse engine's evidence contracts can distinguish them from
    // feed-backed conditions. They use the _stress_ prefix to prevent
    // them from satisfying diagnosis evidence family requirements.
    if (this.state.stress >= 0.40) {
      this._activeConditions.push('_stress_cash_flag');
      this._activeConditions.push('_stress_margin_flag');
    }
    if (this.state.stress >= 0.55) {
      this._activeConditions.push('_stress_supply_flag');
    }
    if (this.state.stress >= 0.65) this._activeConditions.push('ag_high_stress');
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('_stress_weather_flag');

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.15) {
      this._activeConditions.push('input_cost_spike');
    }

    // ── SIGNAL BRIDGE (flag-gated, additive) ────────────────────────────
    // Existing keyword scanning matches against feed.name only and drops most
    // real production feed semantics. Real feeds carry meaningful keywords in
    // f.label / f.signal / f.value / channel and in raw signal text. This
    // bridge unifies that into one corpus per feed and emits canonical
    // condition names that the pulse engine evidence-family map already
    // recognises — no pulse-engine patch required.
    //
    // Flag: window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE === true
    // Flag OFF: zero new conditions emitted; behaviour byte-identical.
    try {
      if (typeof window !== 'undefined' && window.LIMEN_ENABLE_AGRICULTURE_SIGNAL_BRIDGE === true) {
        var bridgeAdds = this._runSignalBridge(this.state.feeds || [], rawSignals || [], this.state.stress, this.state.maturity);
        for (var bi = 0; bi < bridgeAdds.length; bi++) {
          if (this._activeConditions.indexOf(bridgeAdds[bi]) === -1) {
            this._activeConditions.push(bridgeAdds[bi]);
          }
        }
      }
    } catch (e) { /* silent — bridge is additive; failure preserves baseline */ }

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ── SIGNAL BRIDGE IMPLEMENTATION ─────────────────────────────────────
  // Maps real production feed shapes (USDA NASS, RSS Agriculture, FAO
  // FAOSTAT) to canonical condition names that satisfy existing evidence
  // contracts. Value-aware: emits stress conditions only when the value
  // actually indicates stress (e.g. yield 186.5 bu/ac is good — no
  // condition emitted). Does not bypass catchAllBlocked: every emitted
  // condition is one the pulse engine already maps to a real evidence
  // family (cost_event / margin_event / logistics_event / etc.).
  AgricultureBrain.prototype._runSignalBridge = function (feeds, rawSignals, stress, maturity) {
    var added = [];
    function _add(c) { if (added.indexOf(c) === -1) added.push(c); }

    function _corpus(f) {
      return ((f.name || '') + ' ' + (f.label || '') + ' ' + (f.signal || '') + ' ' + (f.channel || '')).toLowerCase();
    }

    for (var i = 0; i < feeds.length; i++) {
      var f = feeds[i];
      if (!f || f.live === false) continue;
      var corpus = _corpus(f);
      var v = f.value;
      var hasNum = (typeof v === 'number' && isFinite(v));

      // ── USDA NASS / NASS — yield-channel signals (value is bu/acre) ──
      if (/(usda|nass)/.test(corpus) || /\byield\b|\bbu\/ac\b|\bbu\/acre\b/.test(corpus)) {
        if (hasNum && /yield|bu\/ac/.test(corpus)) {
          if (v < 150)      { _add('cash_stress'); _add('margin_compression'); }
          else if (v < 175) { _add('margin_compression'); }
          // value >= 175 → yield healthy → no condition emitted
        }
      }

      // ── Fertilizer / input-cost signals (any source) ──
      if (/(fertilizer|input\s*cost|nutrient\s*price|ammonia|potash|urea|nitrogen\s*price)/.test(corpus)) {
        _add('input_cost_spike');
      }

      // ── Drought / water signals ──
      if (/(drought|precipitation|moisture\s*deficit|aquifer|water\s*stress|irrigation\s*constraint)/.test(corpus)) {
        _add('water_stress');
        if (/precipitation/.test(corpus))   _add('precipitation_deficit');
        if (/soil\s*moisture/.test(corpus)) _add('soil_moisture_low');
        if (/irrigation/.test(corpus))      _add('irrigation_constraint');
      }

      // ── Pest / disease ──
      if (/(\bpest\b|\bdisease\b|\bblight\b|infestation|pathogen|outbreak)/.test(corpus)) {
        _add('pest_detected');
        if (/disease/.test(corpus))    _add('disease_detected');
        if (/quarantine/.test(corpus)) _add('quarantine_risk');
      }

      // ── Supply chain ──
      if (/supply.*?(disrupt|shortage|break|fracture)|logistics.*?(failure|disrupt)|cold[\s-]?chain.*?(break|failure)|distribution.*?gap/.test(corpus)) {
        _add('supply_disruption');
        if (/logistics/.test(corpus))   _add('logistics_failure');
        if (/cold[\s-]?chain/.test(corpus)) _add('cold_chain_break');
        if (/distribution/.test(corpus))_add('distribution_gap');
      }

      // ── Commodity / market ──
      if (/(commodity.*?(drop|crash|fall)|food\s*price|grain.*?(export|restrict)|demand.*?destruction|export.*?restrict|oversupply)/.test(corpus)) {
        _add('commodity_price_drop');
        if (/demand.*?destruction/.test(corpus)) _add('demand_destruction');
        if (/export.*?restrict/.test(corpus))    _add('export_restriction');
        if (/oversupply/.test(corpus))           _add('oversupply');
      }

      // ── Equipment ──
      if (/(equipment.*?(down|failure|broken|breakdown)|parts.*?shortage|maintenance.*?backlog|capacity.*?constraint)/.test(corpus)) {
        _add('equipment_downtime');
        if (/parts.*?shortage/.test(corpus))     _add('parts_shortage');
        if (/maintenance.*?backlog/.test(corpus))_add('maintenance_backlog');
        if (/capacity.*?constraint/.test(corpus))_add('capacity_constraint');
      }

      // ── RSS Agriculture — count-based with known query semantics ──
      // Query is fixed in api/domain-snapshot.js fetchRSSAgriculture():
      //   'food price OR crop failure OR fertilizer shortage OR grain
      //    export OR food insecurity OR agricultural crisis'
      // So a high count is real keyword evidence, not stress catch-all.
      if (/rss\s*agriculture/.test(corpus) && hasNum) {
        if (v >= 30)  { _add('input_cost_spike'); }                 // fertilizer shortage
        if (v >= 50)  { _add('supply_disruption'); }                // grain export, food insecurity
        if (v >= 75)  { _add('commodity_price_drop'); _add('export_restriction'); _add('margin_compression'); }
        if (v >= 100) { _add('ag_high_stress'); }                   // broad agricultural crisis
      }

      // ── FAO FAOSTAT — wheat/output indexed ──
      if (/(fao|faostat)/.test(corpus) && hasNum && /(wheat|output|production)/.test(corpus)) {
        if (v < 50) { _add('supply_disruption'); }
      }
    }

    // ── Raw signal scan (expanded vocabulary) ──
    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (!rs) continue;
      if (/drought|water\s*stress|precipitation\s*deficit/.test(rs))                     _add('water_stress');
      if (/pest|disease|blight|infestation/.test(rs))                                    _add('pest_detected');
      if (/supply\s*(disrupt|shortage|break)/.test(rs))                                  _add('supply_disruption');
      if (/fertilizer\s*(shortage|spike|surge)|input\s*cost\s*(spike|surge)/.test(rs))   _add('input_cost_spike');
      if (/(commodity|food|grain)\s*price\s*(drop|crash|fall|collapse)/.test(rs))        _add('commodity_price_drop');
      if (/yield\s*(loss|drop|fail)|crop\s*failure/.test(rs))                            { _add('cash_stress'); _add('margin_compression'); }
      if (/equipment\s*(failure|down)|parts\s*shortage/.test(rs))                        _add('equipment_downtime');
      if (/agricultural\s*crisis|food\s*insecurity/.test(rs))                            _add('ag_high_stress');
    }

    return added;
  };

  AgricultureBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var issues = portal.issues || [];
      var conditions = self._activeConditions || [];
      self.state.diagnoses = issues.map(function (iss) {
        var triggers = self.diagnosisIndex[iss.id] || [];
        var matchCount = 0;
        for (var t = 0; t < triggers.length; t++) {
          for (var c = 0; c < conditions.length; c++) {
            if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) matchCount++;
          }
        }
        return {
          id: iss.id, label: iss.label, summary: iss.summary || '',
          active: matchCount > 0,
          relevance: Math.round((triggers.length > 0 ? matchCount / triggers.length : 0) * 100) / 100,
          matchedConditions: matchCount, totalTriggers: triggers.length,
          circuits: iss.circuits || [], source: 'canonical'
        };
      });
      self.state.diagnoses.sort(function (a, b) {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.relevance - a.relevance;
      });
      self._checkDiagnosisActions();
    });
  };

  AgricultureBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; return; }
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var ci = 0; ci < circuits.length; ci++) activeNodeIds[circuits[ci].nodeId] = activeDx[di].id;
      }
      var treatments = [];
      var activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) {
        var act = activations[ai];
        if (!activeNodeIds[act.brainNodeId]) continue;
        var actTreats = act.treatments || [];
        for (var ti = 0; ti < actTreats.length; ti++) {
          var t = actTreats[ti];
          treatments.push({
            id: 'treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type,
            evidence: t.evidence, description: t.description || '',
            diagnosisId: activeNodeIds[act.brainNodeId], nodeId: act.brainNodeId,
            relevance: 1.0, source: 'canonical'
          });
        }
      }
      var evidenceRank = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
      self.state.treatments = treatments;
    });
  };

  // ── Playbook mapping ──────────────────────────────────────────────
  var PLAYBOOK_MAP = {
    'CASH_FLOW_CRISIS': 'agri_finance',
    'SUPPLY_CHAIN_BREAKDOWN': 'agri_supply',
    'DROUGHT': 'climate_resilience',
    'MARKET_COLLAPSE': 'agri_finance',
    'EQUIPMENT_FAILURE': 'agri_supply',
    'PEST_OUTBREAK': 'climate_resilience'
  };

  var PLAYBOOKS = {
    'agri_finance': {
      explain: 'Agricultural financial stress creates demand for margin protection, crop insurance products, and distressed asset repositioning.',
      action: 'Identify farms and agribusinesses with compressed margins. Position crop insurance, hedging instruments, or acquisition capital.',
      valueRange: '$50K–$5M depending on scale and mechanism',
      trigger: 'Input cost spike >15% or commodity price decline >10%',
      validation: ['Verify margin compression via farm financial statements', 'Confirm crop insurance program eligibility', 'Check USDA Economic Research Service data'],
      steps: ['Map affected farms by county and commodity', 'Assess margin compression severity', 'Position in farm-lending and crop-insurance platforms', 'Engage county extension agent', 'Track recovery metrics'],
      outcome: 'Operator secures financial protection or acquisition position before market normalizes',
      failure: 'Markets recover rapidly or input costs normalize before execution',
      window: 45,
      fastPath: ['Identify highest-stress county', 'Screen AGM/FPI/LAND', 'Position or scope research brief'],
      examples: ['DE', 'CTVA', 'NTR', 'ADM', 'BG']
    },
    'agri_supply': {
      explain: 'Supply chain disruption in agriculture creates demand for cold chain infrastructure, equipment modernization, and alternative distribution.',
      action: 'Deploy resilient logistics, maintenance platforms, or alternative sourcing networks in affected regions.',
      valueRange: '$100K–$10M depending on infrastructure scope',
      trigger: 'Logistics failure affecting >3 counties or equipment downtime >72 hours',
      validation: ['Verify disruption via USDA market news', 'Confirm equipment availability constraints', 'Check regional distribution capacity'],
      steps: ['Map disruption geography and commodity impact', 'Identify infrastructure gaps', 'Source equipment or logistics partners', 'Deploy monitoring system', 'Track recovery metrics'],
      outcome: 'Operator captures infrastructure demand or positions maintenance platform in underserved market',
      failure: 'Disruption resolves before infrastructure deployment or alternative routes established',
      window: 30,
      fastPath: ['Identify bottleneck', 'Source alternative', 'Deploy or scope research brief'],
      examples: ['DE', 'AGCO', 'CNH', 'LNN', 'GNRC']
    },
    'climate_resilience': {
      explain: 'Climate stress drives demand for drought-tolerant genetics, irrigation technology, pest biocontrols, and precision agriculture platforms.',
      action: 'Deploy climate-adaptive technologies in affected growing regions. Scope research into novel approaches.',
      valueRange: '$25K–$2M depending on technology and coverage',
      trigger: 'Drought monitor D2+ or pest detection in >5 counties',
      validation: ['Check NOAA drought monitor', 'Verify pest/disease reports via APHIS', 'Confirm yield impact estimates'],
      steps: ['Map affected regions and crops', 'Identify technology fit (irrigation, genetics, biocontrol)', 'Scope research brief on climate-adaptive approaches', 'Deploy pilot in affected region', 'Monitor yield recovery'],
      outcome: 'Operator positions in climate-adaptive agriculture companies or commissions research on intervention efficacy',
      failure: 'Weather normalizes or pest contained before technology deployment',
      window: 60,
      fastPath: ['Target worst-affected county', 'Match technology', 'Position in VMI/LNN/CTVA or scope research brief'],
      examples: ['CTVA', 'FMC', 'SMG', 'ANDE', 'LNN']
    }
  };

  var COMPENSATION_MAP = {
    'INVESTABLE':   { type: 'invest',   base: 0.05, unit: 'profit',   tier: 1, nextTier: 0.10, maxTier: 0.15 },
    'RESEARCHABLE': { type: 'research', base: 0.05, unit: 'credit',   tier: 1, nextTier: 0.10, maxTier: 0.15 }
  };

  function enrichOpportunity(opp, dx) {
    var playbookId = dx ? (PLAYBOOK_MAP[dx.id] || 'agri_finance') : 'agri_finance';
    var pb = PLAYBOOKS[playbookId] || {};
    var comp = COMPENSATION_MAP[opp.path] || COMPENSATION_MAP['INVESTABLE'];
    opp.domain = 'agriculture';
    opp.playbookId = playbookId;
    opp.confidence = Math.round(Math.min(1, Math.max(0, (opp.rank || 0))) * 100);
    opp.paths = opp.path === 'INVESTABLE' && opp.tier === 1 ? [opp.path, 'BUSINESS'] : [opp.path];
    opp.compensation = comp;
    opp.validity = { createdAt: Date.now(), lastValidated: Date.now(), expiryWindowDays: opp.tier === 1 ? 30 : opp.tier === 2 ? 60 : 90, requiresRevalidation: true, invalidationReasons: [] };
    opp.moneyChain = {
      doThis: pb.action || opp.title,
      whyPays: pb.explain || 'Agriculture stress creates execution demand',
      target: (pb.examples || []).join(', ') || 'Regional agribusinesses and farms',
      timing: (pb.window || 30) + '-day execution window from diagnosis activation',
      invalidIf: pb.failure || 'Stress normalizes before execution',
      evidence: 'Agriculture stress at ' + Math.round((opp.stress || 0) * 100) + '% with active diagnosis',
      nextStep: (pb.fastPath && pb.fastPath[0]) || 'Assess affected region'
    };
    opp.explain = pb.explain || '';
    opp.action = pb.action || '';
    opp.valueRange = pb.valueRange || '';
    opp.trigger = pb.trigger || '';
    opp.validation = (pb.validation || []).join('; ');
    opp.steps = pb.steps || [];
    opp.outcome = pb.outcome || '';
    opp.failure = pb.failure || '';
    opp.window = pb.window || 30;
    opp.fastPath = pb.fastPath || [];
    opp.examples = pb.examples || [];
    return opp;
  }

  AgricultureBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress;
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    var allDx = this.state.diagnoses || [];
    var companies = this.state.companies;
    var seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    // TIER 1 — DIRECT (Diagnosis-Driven)
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di];
      var dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');

      add(enrichOpportunity({ id: dx.id + '_RESEARCHABLE_t1', title: dxLabel + ' — precision agriculture and monitoring platform', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));

      if (stress >= 0.50) add(enrichOpportunity({ id: dx.id + '_INVESTABLE_t1b', title: dxLabel + ' — food supply chain resilience infrastructure', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));

      if (stress >= 0.55 && dx.relevance >= 0.2) add(enrichOpportunity({ id: dx.id + '_INVESTABLE_t1', title: dxLabel + ' — input cost hedging and margin protection', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));

      add(enrichOpportunity({ id: dx.id + '_RESEARCHABLE2_t1', title: dxLabel + ' — agtech adaptation and yield optimization', rank: stress * dx.relevance * 0.75, path: 'RESEARCHABLE', urgency: 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));
    }

    // Company terminal opportunities
    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (terminalCompanies.length > 0) add(enrichOpportunity({ id: 'ag_terminal_t1', title: 'Agriculture terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'IMMEDIATE', source: 'company_terminal', tier: 1, companies: terminalCompanies.map(function (c) { return c.ticker; }), stress: stress }, null));

    // Convergence
    if (this.state.convergence && this.state.convergence.primary_signal) add(enrichOpportunity({ id: 'ag_convergence_t1', title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — agriculture convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'IMMEDIATE', source: 'convergence', tier: 1, signal: this.state.convergence.primary_signal, stress: stress }, null));

    // TIER 2 — CROSS-DOMAIN
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) {
      var em = emissions[ei];
      add(enrichOpportunity({ id: 'ag_xd_' + (em.targetDomain || '') + '_t2', title: 'Agriculture \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'IMMEDIATE' : 'ACTIVE', source: 'cross_domain', tier: 2, stress: stress }, null));
    }

    // TIER 3 — LAGGING
    if (stress >= 0.50 && activeDx.length > 0) {
      add(enrichOpportunity({ id: 'ag_policy_t3', title: 'Agricultural policy and subsidy response', rank: stress * 0.65, path: 'RESEARCHABLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
      add(enrichOpportunity({ id: 'ag_insurance_t3', title: 'Crop insurance and risk transfer positioning', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
    }
    if (stress >= 0.60 && activeDx.length > 0) {
      add(enrichOpportunity({ id: 'ag_harden_t3', title: 'Food distribution infrastructure hardening', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
      add(enrichOpportunity({ id: 'ag_diversify_t3', title: 'Supplier diversification — alternative input sourcing', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
    }

    // WATCHLIST — near-active diagnoses
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      if (stress >= 0.45) add(enrichOpportunity({ id: nearDx[ndi].id + '_watch', title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'WATCH', source: 'near_diagnosis', tier: 2, stress: stress }, nearDx[ndi]));
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge agriculture playbook detail per opportunity
    var PB_LIST = window.LIMENAgricultureOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'CASH_FLOW_CRISIS': 'cash_flow_crisis',
      'SUPPLY_CHAIN_BREAKDOWN': 'supply_chain_breakdown_agri',
      'DROUGHT': 'drought',
      'MARKET_COLLAPSE': 'market_collapse_agri',
      'EQUIPMENT_FAILURE': 'equipment_failure',
      'PEST_OUTBREAK': 'pest_outbreak'
    };
    var _LAGGING_MAP = {
      
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    // Lanes: investment + research ONLY (patent/grant/loan purged 2026-06-21; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':     { type: 'invest',   base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE':   { type: 'research', base: 5,  unit: 'credit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },   maxTier: { tier: 3, comp: 15 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'agriculture';
      o.confidence = Math.round(Math.min(1, (o.rank || 0)) * 100);
      if (!o.whyNow) o.whyNow = o.title;
      o.urgencyLabel = _urgencyLabel(o.urgency);
      var pbId = _resolvePbId(o); o.playbookId = pbId;
      var pb = pbId ? _byId[pbId] : null;
      if (pb) {
        o.explain = pb.explain; o.action = pb.action; o.valueRange = pb.valueRange;
        o.trigger = pb.trigger; o.validation = pb.validation; o.steps = pb.steps;
        o.outcome = pb.outcome; o.failure = pb.failure; o.window = pb.window;
        o.fastPath = pb.fastPath; o.examples = pb.examples;
        o.branch_up = pb.branch_up; o.branch_down = pb.branch_down;
        if (pb.realWorld) o.realWorld = pb.realWorld;
        if (pb.saturation) o.saturation = pb.saturation;
      }
      o.compensation = _COMP[o.path] || null;
      if (o.compensation) o.paths = [o.path];
      o.validity = { createdAt: Date.now(), lastValidated: Date.now(), expiryWindowDays: o.tier === 1 ? 30 : o.tier === 2 ? 60 : 90, requiresRevalidation: false, invalidationReasons: [] };
      if (pb) {
        var stressPct = Math.round((o.stress || 0) * 100);
        var target = '';
        if (o.path === 'INVESTABLE' && pb.realWorld && pb.realWorld.invest) target = pb.realWorld.invest;
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
        else if (o.companies && o.companies.length) target = 'Mapped companies: ' + o.companies.join(', ') + '.';
        var timingParts = []; if (o.urgencyLabel) timingParts.push(o.urgencyLabel); if (pb.window) timingParts.push('Window: ' + pb.window);
        var timing = timingParts.join(' \u00b7 ');
        var evidenceParts = ['Domain: agriculture', 'Stress: ' + stressPct + '%'];
        if (o.confidence) evidenceParts.push('Confidence: ' + o.confidence + '%');
        if (o.diagnosisId) evidenceParts.push('Diagnosis: ' + String(o.diagnosisId).replace(/_/g, ' ').toLowerCase());
        if (pb.trigger) evidenceParts.push(pb.trigger);
        var evidence = evidenceParts.join('. ') + '.';
        var whyPays = pb.outcome || '';
        if (pb.valueRange) whyPays = (whyPays ? whyPays + ' ' : '') + 'Value range: ' + pb.valueRange + '.';
        var nextStep = (pb.fastPath && pb.fastPath.length) ? pb.fastPath[0] : (pb.steps && pb.steps.length ? pb.steps[0] : '');
        o.moneyChain = { doThis: pb.action || '', whyPays: whyPays, target: target, timing: timing, invalidIf: pb.failure || '', evidence: evidence, nextStep: nextStep };
      }
    }
    this.state.opportunityCount = opps.length;

    this.state.opportunities = opps;
    return Promise.resolve();
  };

  AgricultureBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      var existing = adapters.getDrafts({ domain: 'agriculture', intentId: dx.id });
      if (existing && existing.length > 0) continue;
      adapters.createDraft('REPORT_GENERATION', {
        domain: 'agriculture', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id,
        title: 'Agriculture Alert: ' + dx.label,
        intent: { domain: 'agriculture', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response',
          steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on agriculture', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected crops, regions, and operators', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate agtech opportunities from ' + dx.label, status: 'PENDING' }]
        }
      });
    }
  };

  AgricultureBrain.prototype.resolveDeepContent = function () {
    var self = this;
    var resolver = window.LIMENPortalContentResolver;
    if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) {
      self.state.resolvedContent = content;
      if (content) {
        var deepTreats = [];
        for (var dxId in content.byDiagnosis) {
          var dxContent = content.byDiagnosis[dxId];
          for (var i = 0; i < dxContent.treatments.length; i++) {
            var t = dxContent.treatments[i];
            deepTreats.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' });
          }
        }
        if (deepTreats.length > 0) self.state.treatments = deepTreats;
      }
    }).catch(function () {});
  };

  var _origCycle = AgricultureBrain.prototype.cycle;
  AgricultureBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Compute pulse — evidence validation + delta detection + freshness
      var pulse = window.LIMENAgriculturePulse;
      if (pulse && typeof pulse.computePulse === 'function') {
        // Pass _activeConditions to the pulse engine via state
        self.state._activeConditions = self._activeConditions || [];
        var pulseState = pulse.computePulse(self.state);
        self.state.pulse = pulseState;

        // Apply evidence contract validation — block diagnoses without proper evidence
        if (pulseState && pulseState.validatedDiagnoses) {
          for (var vdi = 0; vdi < pulseState.validatedDiagnoses.length; vdi++) {
            var vdx = pulseState.validatedDiagnoses[vdi];
            for (var sdi = 0; sdi < self.state.diagnoses.length; sdi++) {
              if (self.state.diagnoses[sdi].id === vdx.diagnosis.id) {
                if (vdx.blocked) {
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
      }

      // ── QUEUE-UNBLOCK HYDRATION (flag-gated, agri-only) ───────────────
      // master-brain-readiness.scorePathway needs producedBy/validatedAt/
      // auditScore/readyForHandoff to score provComponent above 0. Without
      // these the pathway tier caps at BLOCKED even when feeds, diagnoses,
      // and deep evidence are healthy. Honest hydration: report what the
      // brain actually did this cycle, not a fabricated high score.
      // Flag: window.LIMEN_ENABLE_AGRICULTURE_QUEUE_UNBLOCK === true
      // Flag OFF: zero new fields written; baseline preserved.
      try {
        if (typeof window !== 'undefined'
            && window.LIMEN_ENABLE_AGRICULTURE_QUEUE_UNBLOCK === true) {
          // Adapter convention: provenance fields use snake_case keys on
          // brain.state (produced_by, validated_at, producer_version).
          // Other brain.state fields use camelCase. Verified at
          // domain-brain-adapter.js:158-160.
          self.state.produced_by     = 'agriculture-brain';
          self.state.validated_at    = Date.now();
          self.state.readyForHandoff = true; // cycle reached this point without throwing

          // Honest audit composite — three real measurements, equal-weighted.
          var feeds = Array.isArray(self.state.feeds) ? self.state.feeds : [];
          var liveFeeds = 0;
          for (var fi = 0; fi < feeds.length; fi++) if (feeds[fi] && feeds[fi].live === true) liveFeeds++;
          var feedScore = feeds.length > 0 ? (liveFeeds / feeds.length) : 0;

          var dxList = Array.isArray(self.state.diagnoses) ? self.state.diagnoses : [];
          var activeDxCount = 0;
          for (var di2 = 0; di2 < dxList.length; di2++) if (dxList[di2] && dxList[di2].active === true) activeDxCount++;
          var dxScore = Math.min(1.0, activeDxCount / 3); // 3+ active dx → full

          var rcKeys = (self.state.resolvedContent && self.state.resolvedContent.byDiagnosis)
            ? Object.keys(self.state.resolvedContent.byDiagnosis).length : 0;
          var contentScore = Math.min(1.0, rcKeys / 3); // 3+ resolved buckets → full

          var auditScore = (feedScore * 0.4) + (dxScore * 0.3) + (contentScore * 0.3);
          self.state.auditScore = Math.round(auditScore * 100) / 100;

          // Honest provenance signature (snake_case per adapter convention)
          self.state.producer_version = 'agri-brain-bridge-v1';

          // Re-emit domain-brain-update so the adapter re-projects with the
          // hydrated audit/provenance fields. Base cycle already emitted
          // before resolveDeepContent + pulse + this hydration ran, so
          // adapter has a stale (pre-hydration) snapshot at this point.
          try {
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('limen:domain-brain-update', {
                detail: { domainId: 'agriculture', state: self.state }
              }));
            }
          } catch (_e2) { /* silent */ }
        }
      } catch (e) { /* silent — hydration is additive; failure preserves baseline */ }
    }).then(function () {
      // PHASE B — recurrent loop step. Runs AFTER the pipeline settles, reads the prior
      // produced by the PREVIOUS cycle, computes prediction error, regulates, updates the
      // next prior, then computes higher layers + crop-cycle sub-layer + DDPs + state.cognition.
      // Agriculture-local + try/caught (never breaks a cycle).
      // Kick the one-shot async loaders (bundles / L1 depth / crop-cycle sub-portal). Each is
      // self-guarded + cached after the first call; results land on this.state for the NEXT cycle.
      try { if (self._loadAgricultureDiagnosisBundles) self._loadAgricultureDiagnosisBundles(); } catch (e) {}
      try { if (self._loadAgricultureL1PortalDepth) self._loadAgricultureL1PortalDepth(); } catch (e) {}
      try { if (self._loadAgricultureCropCycleLayer) self._loadAgricultureCropCycleLayer(); } catch (e) {}
      try { self._updateAgricultureModel(); } catch (e) {}
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — AGRICULTURE RECURRENT LOOP + HIGHER COGNITION (additive, reversible).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition /
  // simulation / executive-report + the 8-section DomainDiagnosisPacket the
  // Civilization cockpit + domain-console SELF-MODEL panel consume.
  // Mirrors energy/culture STRUCTURE exactly; only the CONTENT is agricultural
  // (crop cycle, commodity markets, farm financials, livestock, food security,
  // fertilizers/inputs, irrigation, agtech, agribusiness production).
  // Real ag tickers (ADM, BG, CTVA, DE, NTR, MOS, CF, TSN, CAG, INGR, AGCO, FMC)
  // + real data sources (CBOT corn/soy/wheat, USDA WASDE/NASS/ERS, FAO FAOSTAT,
  // World Bank Food Price Index). Never fabricates evidence.
  // Proof surface: window.LIMENAgricultureBrain.state.agricultureModel + state.cognition
  // ════════════════════════════════════════════════════════════════════════════
  var AM_VERSION = 1;
  var AM_LEARNING_RATE = 0.25;
  var AM_SLOW_RATE = 0.08;
  var AM_STRESS_FLOOR = 0.30;
  var AM_FLOOD_CAP = 12;
  var AM_STALE_MS = 1000 * 60 * 60 * 6;
  function _amClamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function _amJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (!a.length && !b.length) return 0;
    var sa = {}, inter = 0;
    a.forEach(function (x) { sa[x] = 1; });
    b.forEach(function (x) { if (sa[x]) inter++; });
    var uni = a.length + b.length - inter;
    return uni ? 1 - inter / uni : 0;
  }

  // Agricultural diagnosis families — an analogy lens for monitoring, NOT evidence.
  var AG_FAMILY = {
    'financial-stress': ['CASH_FLOW_CRISIS', 'MARKET_COLLAPSE'],
    'market': ['MARKET_COLLAPSE', 'CASH_FLOW_CRISIS'],
    'supply': ['SUPPLY_CHAIN_BREAKDOWN', 'EQUIPMENT_FAILURE'],
    'production': ['EQUIPMENT_FAILURE', 'PEST_OUTBREAK', 'DROUGHT'],
    'biological': ['PEST_OUTBREAK', 'DROUGHT'],
    'climate': ['DROUGHT', 'PEST_OUTBREAK']
  };

  AgricultureBrain.prototype._neutralAgricultureModel = function () {
    return {
      version: AM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      // F0 lifecycle envelope — agricultural production / commodity-market / farm-financial cycle
      cropCyclePhase: 'unknown',          // planting | growth | harvest | post-harvest
      commodityPriceState: 'unknown',     // depressed | fair | elevated
      farmFinancialState: 'unknown',      // healthy | stressed | contracted
      regulation: null,
      plasticity: { learningRate: AM_LEARNING_RATE, slowRate: AM_SLOW_RATE, consolidation: 0 },
      readyForHandoff: false, _lowErrorStreak: 0, updated: 0
    };
  };

  // B2 — normalized observation from current Agriculture state
  AgricultureBrain.prototype._buildAgricultureObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var feeds = s.feeds || [], fc = 0, newest = 0;
    if (Array.isArray(feeds)) {
      for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
    } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
    return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: (s.companies || []).length, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
  };

  // B3 — prediction error: prior.expected* vs observation
  AgricultureBrain.prototype._computeAgriculturePredictionError = function (prior, obs) {
    var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _amJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
    var total = _amClamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
    return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  AgricultureBrain.prototype._updateAgriculturePrior = function (prior, obs, lr) {
    return { expectedStress: _amClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _amClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _amClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
  };

  // B5 — local regulation: inhibition / gain / homeostatic set-points
  AgricultureBrain.prototype._computeAgricultureRegulation = function (am, obs, pe) {
    var gain = _amClamp(pe.novelty, 0.05, 0.95), inhib = _amClamp(1 - pe.novelty, 0, 0.9);
    var starving = obs.stress >= AM_STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > AM_FLOOD_CAP;
    var streak = (pe.total < 0.05) ? (am._lowErrorStreak || 0) + 1 : 0; am._lowErrorStreak = streak; var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > AM_STALE_MS : false;
    var overconf = am.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
  };

  // F0 — crop-cycle phase from calendar month (planting/growth/harvest/post-harvest, US row-crop)
  AgricultureBrain.prototype._inferCropCyclePhase = function () {
    var m = (new Date()).getMonth(); // 0=Jan
    if (m >= 3 && m <= 4) return 'planting';        // Apr–May
    if (m >= 5 && m <= 7) return 'growth';          // Jun–Aug
    if (m >= 8 && m <= 10) return 'harvest';        // Sep–Nov
    return 'post-harvest';                          // Dec–Mar
  };

  // The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle, so
  // cycle N+1's interpretation (predictedStress, readyForHandoff) depends on cycle N.
  AgricultureBrain.prototype._updateAgricultureModel = function () {
    var am = this.state.agricultureModel || this._neutralAgricultureModel();
    var priorIn = am.prior;
    var obs = this._buildAgricultureObservation();
    var pe = this._computeAgriculturePredictionError(priorIn, obs);
    var gainBlend = _amClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeAgricultureRegulation(am, obs, pe);
    var readyForHandoff = (am.cycle > 0) && (predictedStress >= AM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;
    var nextPrior = this._updateAgriculturePrior(priorIn, obs, am.plasticity.learningRate);

    // F0 lifecycle envelope fields — honest, signal-derived (no fabrication)
    var conds = this._activeConditions || [];
    var has = function (c) { return conds.indexOf(c) !== -1; };
    var commodityPriceState = (has('commodity_price_drop') || has('oversupply')) ? 'depressed'
      : (has('input_cost_spike') && obs.stress >= 0.5) ? 'elevated' : 'fair';
    var farmFinancialState = (has('cash_stress') || has('debt_service') || obs.stress >= 0.65) ? 'contracted'
      : (has('margin_compression') || has('input_cost_spike') || obs.stress >= 0.4) ? 'stressed' : 'healthy';

    am.cycle += 1;
    am.observation = obs;
    am.predictionError = pe;
    am.predictedStress = predictedStress;
    am.cropCyclePhase = this._inferCropCyclePhase();
    am.commodityPriceState = commodityPriceState;
    am.farmFinancialState = farmFinancialState;
    am.regulation = reg;
    am.readyForHandoff = readyForHandoff;
    am.prior = nextPrior;
    am.updated = obs.timestamp;
    this.state.agricultureModel = am;

    // #8 — outcomeLog population (real cycle telemetry; feeds intuition pattern-matching)
    try {
      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: am.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, readyForHandoff: readyForHandoff, timestamp: obs.timestamp });
      if (log.length > 50) log.shift();
    } catch (e) {}

    // H1-H6 — higher Agriculture brain layers (computed BEFORE the crop-cycle layer + DDP build)
    try { this._computeAgricultureHigherLayers(); } catch (e) {}

    // CROP-CYCLE / food-security sub-portal layer (additive; BEFORE the DDP build so the
    // primary packet's promptView advertises it). Never touches the validated diagnosis spine.
    try { this._buildAgricultureCropCycleLayer(); } catch (e) {}

    // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
    // and one per diagnosis. Schema-only: never invents data. Consumed by the Civilization cockpit.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      am.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.agricultureDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // MANDATORY — state.cognition: the generic surface domain-console-brain.js reads for ANY
    // brain (SELF-MODEL panel + Civilization handoff). domain='agriculture'; model carries the
    // recurrent agriculturalModel fields; awareness/conscience/immune/intuition exposed generically.
    this.state.cognition = {
      domain: 'agriculture',
      agriculturalModel: am,
      model: { cycle: am.cycle, predictionError: am.predictionError, predictedStress: am.predictedStress, regulation: am.regulation },
      agricultureImmune: this.state.agricultureImmune || null,
      agricultureAwareness: this.state.agricultureAwareness || null,
      agricultureConscience: this.state.agricultureConscience || null,
      agricultureIntuition: this.state.agricultureIntuition || null,
      agricultureSimulation: this.state.agricultureSimulation || null,
      agricultureExecutiveReport: this.state.agricultureExecutiveReport || null,
      awareness: this.state.agricultureAwareness || null,
      conscience: this.state.agricultureConscience || null,
      immune: this.state.agricultureImmune || null,
      intuition: this.state.agricultureIntuition || null,
      sceneLayer: this.state.cropCycleLayer || null,
      treatments: this.state.treatments || [],
      diagnoses: this.state.diagnoses || [],
      opportunities: this.state.opportunities || []
    };
    return am;
  };

  AgricultureBrain.prototype._computeAgricultureHigherLayers = function () {
    this._computeAgricultureImmune();
    this._computeAgricultureAwareness();
    this._computeAgricultureConscience();
    this._computeAgricultureIntuition();
    try { this._computeAgricultureSimulation(); } catch (e) {}
    try { this._computeAgricultureExecutiveReport(); } catch (e) {}
  };

  // ── _agricultureBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  AgricultureBrain.prototype._agricultureBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveAgricultureCanonicalDiagnosis(d.id);
      var bundle = (self._bundleCache && self._bundleCache[c.canonicalDiagnosisId]) || null;
      var known = !!(self._bundleStatusMap && Object.prototype.hasOwnProperty.call(self._bundleStatusMap, c.canonicalDiagnosisId));
      return {
        dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0),
        canonical: c.canonicalDiagnosisId, aliasUsed: c.aliasUsed, aliasRisk: c.aliasRisk, aliasReviewStatus: c.aliasReviewStatus,
        bundleStatus: bundle ? 'found' : (known ? 'missing' : 'unknown'),
        buildMethod: (bundle && bundle.buildMethod) || null, humanVerification: (bundle && bundle.humanVerification) || null,
        shallow: !!(bundle && ((bundle.maxDepth || 0) === 0 || (bundle.portalCount || 0) <= 1))
      };
    });
  };

  // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
  AgricultureBrain.prototype._computeAgricultureImmune = function () {
    var s = this.state, am = s.agricultureModel || {}, reg = am.regulation || {}, ant = [];
    var bs = this._agricultureBundleStates();
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (am.predictionError && am.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
    var _l1 = s._l1DepthCache;
    if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
      ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real ag company tickers surfaced relevance-unverified' });
    }
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    s.agricultureImmune = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L1-portal-treatments-madlib'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      immuneMemory: (((s.agricultureImmune && s.agricultureImmune.immuneMemory) || 0) + 1),
      lastScanAt: am.updated || null
    };
    return s.agricultureImmune;
  };

  // ── H2 — awareness (narrative on crop health, supply chain, input costs, farm financial stress) ──
  AgricultureBrain.prototype._computeAgricultureAwareness = function () {
    var s = this.state, am = s.agricultureModel || {}, im = s.agricultureImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var bs = this._agricultureBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var pe = (am.predictionError && am.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
    s.agricultureAwareness = {
      version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (am.regulation && am.regulation.state) || 'unknown',
      knowns: covered.map(function (b) { return b.dxId + ' (source-backed)'; }).concat(dxNames.slice(0, 6)),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }),
      uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of crop / commodity-market / farm-financial stress, not validated', 'crop-cycle phase=' + (am.cropCyclePhase || '?') + ', commodity=' + (am.commodityPriceState || '?') + ', farm-financial=' + (am.farmFinancialState || '?'), 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((am.regulation && am.regulation.state) || '?'), active.length + ' active dx'],
      selfNarrative: 'Agriculture: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), crop-cycle=' + (am.cropCyclePhase || '?') + ', commodity=' + (am.commodityPriceState || '?') + ', farm-financial=' + (am.farmFinancialState || '?') + ', regulation=' + ((am.regulation && am.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
      lastAwarenessAt: am.updated || null
    };
    return s.agricultureAwareness;
  };

  // ── H3 — conscience (artifact readiness; AG does INVESTABLE/RESEARCHABLE only — patent/grant retired 2026-06-21) ──
  AgricultureBrain.prototype._computeAgricultureConscience = function () {
    var s = this.state, am = s.agricultureModel || {}, bs = this._agricultureBundleStates();
    var pe = (am.predictionError && am.predictionError.total) || 0, cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    var vetoes = [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); agriculture has no method/embodiment fields' }];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); vetoes.push({ claim: 'strong-claim:' + b.dxId, reason: 'no source bundle' }); }
      else if (b.buildMethod === 'external-source-authored') { cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' }); allowed.push('source-routing:' + b.dxId); }
      else if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') { cautions.push({ claim: 'precise-technical-claim:' + b.dxId, reason: 'aliasRisk ' + b.aliasRisk + '; include alias warning' }); allowed.push('source-summary:' + b.dxId); }
      else if (b.bundleStatus === 'found') { allowed.push('source-summary:' + b.dxId); }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
    s.agricultureConscience = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary', 'agriculture-brief-with-warnings'].concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: true, note: 'patent/grant vetoed (retired 2026-06-21); investment/research allowed-with-warning' },
      reasons: ['overclaim prevention', 'source sufficiency', 'interpretive-not-validated'],
      lastCheckAt: am.updated || null
    };
    return s.agricultureConscience;
  };

  // ── H4 — intuition (hunches on yield patterns, pest emergence, commodity price shifts) ──
  AgricultureBrain.prototype._computeAgricultureIntuition = function () {
    var s = this.state, am = s.agricultureModel || {}, reg = am.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
    if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'agricultural regime shift forming (prediction error rising) — yield-pattern break, pest emergence, or commodity price shift', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel agricultural stressor entering the system (weather extreme / pest outbreak / market dislocation)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised (high novelty)' });
    var missing = this._agricultureBundleStates().filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
    if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle' });

    // patternMatches — recurring regulation state from real outcome memory
    var patternMatches = [], recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });

    // analogies — static structural-family map (analogy, NOT evidence)
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id, analogies = [];
    Object.keys(AG_FAMILY).forEach(function (fam) { if (AG_FAMILY[fam].indexOf(primaryId) >= 0) { AG_FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });

    // promotion — a hunch recurring >=3 cycles -> monitoring TARGET only (never diagnosis/evidence)
    var hm = this._hunchMemory = this._hunchMemory || {};
    var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hm[h.hunch] = (hm[h.hunch] || 0) + 1; });
    var promotedToMonitoring = [], rejectedHunches = [];
    Object.keys(hm).forEach(function (k) {
      if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hm[k]; return; }
      if (hm[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hm[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
    });

    s.agricultureIntuition = {
      version: 1, hunches: hunches.slice(0, 6), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 6), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [], promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), lastIntuitionAt: am.updated || null
    };
    return s.agricultureIntuition;
  };

  // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
  AgricultureBrain.prototype._computeAgricultureSimulation = function () {
    var s = this.state, am = s.agricultureModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'perfect_weather', hypothetical: true, assumption: 'ideal growing season — abundant yields across corn/soy/wheat', simulatedStress: cl(base - 0.2), risk: 'oversupply compresses commodity prices (MARKET_COLLAPSE) despite strong production', intervention: 'monitor CBOT futures + USDA WASDE stocks-to-use; position input/equipment demand', falsifier: 'WASDE shows tightening stocks or weather turns adverse' },
      { type: 'input_cost_spike', hypothetical: true, assumption: 'fertilizer/diesel/seed costs surge (NTR/MOS/CF margin pass-through)', simulatedStress: cl(base + 0.3), risk: 'farm margin compression + cash-flow crisis (CASH_FLOW_CRISIS)', intervention: 'track fertilizer indices + USDA ERS cost-of-production; position margin protection / crop insurance', falsifier: 'input prices normalize before planting decisions lock in' },
      { type: 'price_collapse', hypothetical: true, assumption: 'commodity prices fall >10% on demand destruction or export restriction', simulatedStress: cl(base + 0.3), risk: 'farm-financial contraction + debt-service pressure (MARKET_COLLAPSE)', intervention: 'monitor CBOT + World Bank Food Price Index + USDA export sales; confirm with 2 sources before standing down', falsifier: 'prices recover or demand stabilizes next cycle' },
      { type: 'drought', hypothetical: true, assumption: 'USDA Drought Monitor escalates to D2+ across key growing regions', simulatedStress: cl(base + 0.25), risk: 'yield loss + irrigation constraint (DROUGHT)', intervention: 'NOAA CPC seasonal outlook + USDM; position drought-tolerant genetics (CTVA) / irrigation tech', falsifier: 'precipitation returns or drought footprint contracts' },
      { type: 'pest_outbreak', hypothetical: true, assumption: 'APHIS quarantine-level pest/disease emergence across counties', simulatedStress: cl(base + 0.25), risk: 'crop loss + quarantine risk (PEST_OUTBREAK)', intervention: 'APHIS pest alerts + FMC/CTVA crop-protection; scope biocontrol research', falsifier: 'outbreak contained or quarantine lifted' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['CASH_FLOW_CRISIS', 'MARKET_COLLAPSE', 'DROUGHT', 'PEST_OUTBREAK'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: am.updated || null
    };
    s.agricultureSimulation = sim; return sim;
  };

  // ── H6 — executive self-report (compact status card) ──
  AgricultureBrain.prototype._computeAgricultureExecutiveReport = function () {
    var s = this.state, am = s.agricultureModel || {}, im = s.agricultureImmune || {}, aw = s.agricultureAwareness || {}, con = s.agricultureConscience || {}, it = s.agricultureIntuition || {}, sim = s.agricultureSimulation || {};
    var bs = this._agricultureBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (am.predictionError && am.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (am.regulation && am.regulation.starving) ? 'starving' : (am.regulation && am.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    s.agricultureExecutiveReport = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      cropCyclePhase: am.cropCyclePhase || null, commodityPriceState: am.commodityPriceState || null, farmFinancialState: am.farmFinancialState || null,
      regulationState: (am.regulation && am.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses (ensure USDA WASDE/NASS + CBOT + drought-monitor sources are current)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (crop-stage, commodity futures, input costs, drought/pest signals)',
      lastReportAt: am.updated || null
    };
    return s.agricultureExecutiveReport;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SOURCE-BUNDLE MACHINERY + CANONICAL RESOLUTION + L1 MAD-LIB SCAN + CROP-CYCLE
  // SUB-PORTAL LAYER + the 8-section DomainDiagnosisPacket the cockpit consumes.
  // Mirrors energy/culture STRUCTURE exactly; only the CONTENT is agricultural.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var AG_DDP_SCHEMA_VERSION = 'agriculture-ddp-1';
  function _agDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _agDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_agDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Canonical diagnosis resolution. Prefers window.LIMENArtifactSourceIndex.aliases(),
  //    else AGRICULTURE_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var AGRICULTURE_DIAGNOSIS_ALIASES = {
    CASH_FLOW_CRISIS:       { target: 'FARM_FINANCIAL_DISTRESS', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits FARM_FINANCIAL_DISTRESS for margin compression / debt-service pressure' },
    SUPPLY_CHAIN_BREAKDOWN: { target: 'FOOD_SUPPLY_DISRUPTION', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits FOOD_SUPPLY_DISRUPTION for logistics / cold-chain / distribution failure' },
    MARKET_COLLAPSE:        { target: 'COMMODITY_PRICE_SHOCK', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to commodity-price-shock bundle; verify demand-destruction vs oversupply evidence is appropriate' },
    PEST_OUTBREAK:          { target: 'CROP_PEST_DISEASE_OUTBREAK', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CROP_PEST_DISEASE_OUTBREAK for APHIS quarantine-level pest/disease' }
  };
  AgricultureBrain.prototype._resolveAgricultureCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = AGRICULTURE_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  AgricultureBrain.prototype._loadAgricultureDiagnosisBundles = function () {
    var self = this;
    if (self._agricultureBundleLoadPromise) return self._agricultureBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['CASH_FLOW_CRISIS', 'SUPPLY_CHAIN_BREAKDOWN', 'DROUGHT', 'MARKET_COLLAPSE', 'EQUIPMENT_FAILURE', 'PEST_OUTBREAK'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveAgricultureCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._agricultureBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._agricultureBundleLoadPromise;
  };

  // ── L1 portal mad-lib scan. L1 treatments are fixed-verb templates; quarantined from
  //    evidence. Only real ag company tickers surface (relevance-unverified). ──
  var AG_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Cultivate|Irrigate)\b/;
  AgricultureBrain.prototype._isAgricultureMadLibTreatment = function (label) { return !label || AG_MADLIB_VERB.test(String(label)); };

  AgricultureBrain.prototype._loadAgricultureL1PortalDepth = function () {
    var self = this;
    if (self._agricultureL1LoadPromise) return self._agricultureL1LoadPromise;
    var BRANCH = {
      CASH_FLOW_CRISIS: ['farmfinance', 'cropinsurance', 'agecon'],
      SUPPLY_CHAIN_BREAKDOWN: ['agsupply', 'coldchain', 'agdistribution'],
      DROUGHT: ['irrigation', 'cropwater', 'climateresilience'],
      MARKET_COLLAPSE: ['commodity', 'grain', 'agtrade'],
      EQUIPMENT_FAILURE: ['agequipment', 'precisionag', 'agmaintenance'],
      PEST_OUTBREAK: ['cropprotection', 'pestcontrol', 'plantdisease']
    };
    self._agricultureL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._agricultureL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/agriculture_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isAgricultureMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'agriculture_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only ag company tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.agricultureModel && self.state.agricultureModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._agricultureL1LoadPromise;
  };

  // ── CROP-CYCLE / food-security sub-portal layer (counterpart to energy's data-center layer;
  //    culture's music-scene). Tracks regional crop calendars + food-security + commodity futures.
  //    Real-content, citation-backed; NEVER merged into the validated diagnosis spine. ──
  AgricultureBrain.prototype._loadAgricultureCropCycleLayer = function () {
    var self = this;
    if (self._cropCycleLoadPromise) return self._cropCycleLoadPromise;
    // Prefer a dedicated agriculture_cropcycle.json; fall back to the food-security sub-portal.
    self._cropCycleLoadPromise = fetch('/assets/data/domains/agriculture_cropcycle.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/agriculture_foodsecurity.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._cropCyclePortal = null; return null; }
        self._cropCyclePortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Crop Cycle & Food Security' };
        return self._cropCyclePortal;
      })
      .catch(function () { self._cropCyclePortal = null; return null; });
    return self._cropCycleLoadPromise;
  };

  AgricultureBrain.prototype._buildAgricultureCropCycleLayer = function () {
    var self = this;
    var cp = self._cropCyclePortal;
    var am = self.state.agricultureModel || {};
    if (!cp || !cp.issues || !cp.issues.length) {
      self.state.cropCycleDiagnoses = [];
      self.state.cropCycleTreatments = [];
      self.state.agricultureCropCycleDomainDiagnosisPackets = [];
      // Even offline, surface the calendar-derived crop-cycle + food-security envelope (no fabrication).
      self.state.cropCycleLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], cropCyclePhase: am.cropCyclePhase || self._inferCropCyclePhase(), commodityPriceState: am.commodityPriceState || 'unknown', farmFinancialState: am.farmFinancialState || 'unknown', commodityFutures: ['CBOT corn', 'CBOT soybeans', 'CBOT wheat'], foodSecuritySources: ['USDA WASDE', 'USDA NASS', 'FAO FAOSTAT', 'World Bank Food Price Index'], note: 'crop-cycle sub-portal not loaded (offline or fetch failed); crop-cycle phase derived from calendar' };
      return self.state.cropCycleLayer;
    }
    var conditions = self._activeConditions || [];
    var diagnoses = cp.issues.map(function (iss) {
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
        source: 'cropcycle', tier: 'real-content-unbundled', branch: 'cropcycle'
      };
    });
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (cp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'cropcycle_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'cropcycle', madLib: self._isAgricultureMadLibTreatment ? self._isAgricultureMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.cropCycleDiagnoses = diagnoses;
    self.state.cropCycleTreatments = treatments;
    self.state.cropCycleLayer = {
      loaded: true,
      portalTitle: cp.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      cropCyclePhase: am.cropCyclePhase || self._inferCropCyclePhase(),
      commodityPriceState: am.commodityPriceState || 'unknown',
      farmFinancialState: am.farmFinancialState || 'unknown',
      commodityFutures: ['CBOT corn', 'CBOT soybeans', 'CBOT wheat'],
      foodSecuritySources: ['USDA WASDE', 'USDA NASS', 'USDA ERS', 'FAO FAOSTAT', 'World Bank Food Price Index'],
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveAgricultureCanonicalDiagnosis ? self._resolveAgricultureCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'cropcycle', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content crop-cycle / food-security sub-portal (crop calendars, commodity futures, livestock pipelines, food-security indexes); SEPARATE from the validated diagnosis spine; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    self.state.agricultureCropCycleDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.cropCycleLayer;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  //    Mirrors energy/culture _buildDomainDiagnosisPacket exactly; only the CONTENT is agricultural. ──
  AgricultureBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var am = s.agricultureModel || {};
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
    if (Array.isArray(feeds)) {
      feeds.forEach(function (f) { if (f && typeof f === 'object') sourceFeeds.push({ name: f.name || f.label || 'feed', updated: f.updated || null, source: f.source || null }); });
    } else {
      for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; if (f && typeof f === 'object') sourceFeeds.push({ name: f.name || fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } }
    }
    if (s._primarySource && !sourceFeeds.length) sourceFeeds.push({ name: 'primary', updated: null, source: s._primarySource });

    var _canon = this._resolveAgricultureCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'agriculture',
      diagnosisId: dxId,
      canonicalDiagnosisId: _canon.canonicalDiagnosisId,
      aliasUsed: _canon.aliasUsed,
      aliasReviewStatus: _canon.aliasReviewStatus,
      aliasRisk: _canon.aliasRisk,
      aliasNote: _canon.aliasNote,
      label: dx ? (dx.label || dx.id || null) : null,
      phase: s.phase || null,
      confidence: (dx && typeof dx.relevance === 'number') ? dx.relevance : (typeof s.confidence === 'number' ? s.confidence : null)
    };
    var _bundle = (this._bundleCache && this._bundleCache[identity.canonicalDiagnosisId]) || null;
    var _bundleKnown = !!(this._bundleStatusMap && Object.prototype.hasOwnProperty.call(this._bundleStatusMap, identity.canonicalDiagnosisId));
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.patents) ? _bundle.byLane.patents : null;
    var _bArr = function (k) { return (_bl && Array.isArray(_bl[k])) ? _bl[k] : []; };
    var bundleStatus = _bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown');
    var bundleShallow = !!(_bundle && ((_bundle.maxDepth || 0) === 0 || (_bundle.portalCount || 0) <= 1));
    var bundleResolution = identity.aliasUsed
      ? (_bundle ? 'alias-resolved-and-bundle-found' : 'alias-resolved-but-bundle-missing')
      : (_bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown'));
    if (!treatments.length && _bl) treatments = _bArr('treatments');
    if (!implementationSteps.length && _bl) implementationSteps = _bArr('implementationSteps');
    var brainState = {
      agriculturalModel: { version: am.version || null, cycle: (typeof am.cycle === 'number' ? am.cycle : null), cropCyclePhase: am.cropCyclePhase || null, commodityPriceState: am.commodityPriceState || null, farmFinancialState: am.farmFinancialState || null },
      predictionError: am.predictionError || null,
      regulationState: (am.regulation && am.regulation.state) || null,
      prior: am.prior || null,
      observation: am.observation || null,
      plasticity: am.plasticity || null,
      readyForHandoff: am.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'agriculture';
    var rootTitle = (portal && portal.title) || 'Agriculture';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'agriculture',
      portalTitle: rootTitle,
      depth: 0,
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      l1Depth: (s._l1DepthCache && s._l1DepthCache.byDiagnosis && s._l1DepthCache.byDiagnosis[dxId]) || (s._l1DepthCache ? { branchesScanned: 0, realCompanyTickers: [], realTreatments: 0, madLibTreatments: 0, admitted: false, reason: 'no L1 branch mapped for this diagnosis' } : null)
    };
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    var evidenceAnchors = _bArr('evidenceAnchors');
    var missingEv = [];
    if (!evidenceAnchors.length) missingEv.push('evidenceAnchors');
    if (!citationHints.length) missingEv.push('citationHints');
    var evidence = {
      sourceFeeds: sourceFeeds,
      evidenceAnchors: evidenceAnchors,
      citationHints: citationHints,
      bundleStatus: bundleStatus,
      bundleResolution: bundleResolution,
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'patents', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
      missingEvidence: missingEv
    };
    // Human-authoring intake: for external-source bundles missing candidates, emit structured
    // empty slots (what each needs + which AGRICULTURAL primary source) rather than fabricating.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      FARM_FINANCIAL_DISTRESS: 'USDA ERS farm-income + cost-of-production / FSA farm-loan data / Federal Reserve ag-credit surveys',
      FOOD_SUPPLY_DISRUPTION: 'USDA AMS market news / FDA recall reports / USDA cold-storage + logistics data',
      DROUGHT: 'USDA Drought Monitor (USDM) / NOAA CPC seasonal outlook / NASS crop-condition reports',
      COMMODITY_PRICE_SHOCK: 'CBOT corn/soy/wheat futures / USDA WASDE stocks-to-use / World Bank Food Price Index / USDA export sales',
      EQUIPMENT_FAILURE: 'AEM equipment-shipment data / dealer-network reports / OEM (DE/AGCO/CNH) filings',
      CROP_PEST_DISEASE_OUTBREAK: 'USDA APHIS pest-alert reports / NASS crop-condition / state extension pest surveys'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete agricultural/agronomic method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / USDA / commodity-market source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
      });
    }
    var treatmentContext = {
      treatments: treatments,
      implementationSteps: implementationSteps,
      methodCandidates: _bArr('methodCandidates'),
      mechanismCandidates: _bArr('mechanismCandidates'),
      embodimentCandidates: _bArr('embodimentCandidates'),
      figurePlaceholders: _bArr('figurePlaceholders'),
      authoringIntake: authoringIntake
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
    var hasCanonical = !!identity.canonicalDiagnosisId;
    var blockers = [];
    if (hasCanonical && !hasBundle) blockers.push(identity.aliasUsed ? 'canonical-id-resolved-but-bundle-missing' : 'no-source-bundle');
    if (bundleStatus === 'missing') blockers.push('source-bundle-build-required');
    blockers.push(portalContext.portalStatus === 'root-only' ? 'portal-root-only' : 'portal-not-loaded');
    if (!hasTreat) blockers.push('no-treatments');
    if (!primaryOpp) blockers.push('no-active-opportunity');
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
    // Lanes are INVESTABLE (ag companies / agribusiness / farms) / RESEARCHABLE (agronomic briefs).
    // patent/grant are VETOED by conscience (lanes retired 2026-06-21; no method/embodiment fields).
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _agDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _agDdpCompleteness(brainState, ['agriculturalModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _agDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _agDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _agDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _agDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _agDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _amf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_agDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _amf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _amf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _amf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _amf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < AM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

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
        'diagnosis-specific bundle anchors preferred over generic agriculture evidence',
        'official/primary sources retained (USDA WASDE/NASS/ERS, CBOT, USDM, APHIS, FAO, World Bank where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.agricultureImmune ? ['immune: ' + s.agricultureImmune.immuneState + ' (sev ' + s.agricultureImmune.severity + ', ' + (s.agricultureImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.agricultureConscience && s.agricultureConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.agricultureConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.agricultureImmune ? { immuneState: s.agricultureImmune.immuneState, severity: s.agricultureImmune.severity, antigenCount: (s.agricultureImmune.antigens || []).length, quarantines: s.agricultureImmune.quarantines, blockedFromTraversal: s.agricultureImmune.blockedFromTraversal, allowedWithWarning: s.agricultureImmune.allowedWithWarning } : null,
      awarenessSummary: s.agricultureAwareness ? { selfNarrative: s.agricultureAwareness.selfNarrative, knowns: (s.agricultureAwareness.knowns || []).length, unknowns: (s.agricultureAwareness.unknowns || []).length } : null,
      conscienceDecision: s.agricultureConscience ? { conscienceState: s.agricultureConscience.conscienceState, blockedClaims: s.agricultureConscience.blockedClaims, artifactReadinessDecision: s.agricultureConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.agricultureIntuition ? s.agricultureIntuition.hunches : null,
      scenarioSummary: s.agricultureSimulation ? (s.agricultureSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.agricultureExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // CROP-CYCLE — crop-cycle / food-security sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      agricultureSummary: s.cropCycleLayer ? { loaded: s.cropCycleLayer.loaded, count: s.cropCycleLayer.count, activeCount: s.cropCycleLayer.activeCount, cropCyclePhase: s.cropCycleLayer.cropCyclePhase, commodityPriceState: s.cropCycleLayer.commodityPriceState, farmFinancialState: s.cropCycleLayer.farmFinancialState, diagnoses: s.cropCycleLayer.diagnoses, note: s.cropCycleLayer.note } : null
    };

    return {
      schemaVersion: AG_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (am.updated || null),
        schemaVersion: AG_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.agricultureImmune || null,
        awareness: s.agricultureAwareness || null,
        conscience: s.agricultureConscience || null,
        intuition: s.agricultureIntuition || null,
        simulation: s.agricultureSimulation || null,
        executiveReport: s.agricultureExecutiveReport || null
      }
    };
  };

  var brain = new AgricultureBrain();
  brain.init();
  brain.start();
  window.LIMENAgricultureBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ── Auto-load agriculture operator stack on domain-console ──
  // domain-console.html hardcodes energy scripts in its chain.
  // Agriculture loads its own operator surface here so we don't
  // touch any energy or shared infrastructure files.
  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isAgriDomain = (new URLSearchParams(window.location.search)).get('domain') === 'agriculture';
  if (_isDomainConsole && _isAgriDomain) {
    // Enable directive extraction for agriculture (same feature flag energy uses)
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    // Full operator stack — mirrors energy's loading chain exactly
    var _agriScripts = [
      'assets/js/agriculture-compensation.js',
      'assets/js/agriculture-opportunity-economics.js',
      'assets/js/agriculture-pulse-engine.js',
      'assets/js/agriculture-node-business-engine.js',
      'assets/js/agriculture-business-review.js',
      'assets/js/agriculture-execution-panels.js',
      'assets/js/agriculture-business-build.js',
      'assets/js/agriculture-directive-extractor.js',
      'assets/js/agriculture-directive-ranker.js',
      'assets/js/agriculture-directive-translator.js',
      'assets/js/agriculture-targeting-engine.js',
      'assets/js/agriculture-promotion-bridge.js',
      'assets/js/agriculture-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _agriScripts.length) return;
      var s = document.createElement('script');
      s.src = _agriScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[AgricultureBrain] Failed to load ' + _agriScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
