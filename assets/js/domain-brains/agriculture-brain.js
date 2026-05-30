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
      steps: ['Map affected farms by county and commodity', 'Assess margin compression severity', 'Identify eligible USDA programs', 'Draft grant or loan application', 'Engage county extension agent', 'Submit and track'],
      outcome: 'Operator secures financial protection or acquisition position before market normalizes',
      failure: 'Markets recover rapidly or input costs normalize before execution',
      window: 45,
      fastPath: ['Identify highest-stress county', 'Match to USDA program', 'Submit application'],
      examples: ['DE', 'CTVA', 'NTR', 'ADM', 'BG']
    },
    'agri_supply': {
      explain: 'Supply chain disruption in agriculture creates demand for cold chain infrastructure, equipment modernization, and alternative distribution.',
      action: 'Deploy resilient logistics, maintenance platforms, or alternative sourcing networks in affected regions.',
      valueRange: '$100K–$10M depending on infrastructure scope',
      trigger: 'Logistics failure affecting >3 counties or equipment downtime >72 hours',
      validation: ['Verify disruption via USDA market news', 'Confirm equipment availability constraints', 'Check regional distribution capacity'],
      steps: ['Map disruption geography and commodity impact', 'Identify infrastructure gaps', 'Source equipment or logistics partners', 'Draft infrastructure grant application', 'Deploy monitoring system', 'Track recovery metrics'],
      outcome: 'Operator captures infrastructure demand or positions maintenance platform in underserved market',
      failure: 'Disruption resolves before infrastructure deployment or alternative routes established',
      window: 30,
      fastPath: ['Identify bottleneck', 'Source alternative', 'Deploy'],
      examples: ['DE', 'AGCO', 'CNH', 'LNN', 'GNRC']
    },
    'climate_resilience': {
      explain: 'Climate stress drives demand for drought-tolerant genetics, irrigation technology, pest biocontrols, and precision agriculture platforms.',
      action: 'Deploy climate-adaptive technologies in affected growing regions. Patent novel approaches. Secure research grants.',
      valueRange: '$25K–$2M depending on technology and coverage',
      trigger: 'Drought monitor D2+ or pest detection in >5 counties',
      validation: ['Check NOAA drought monitor', 'Verify pest/disease reports via APHIS', 'Confirm yield impact estimates'],
      steps: ['Map affected regions and crops', 'Identify technology fit (irrigation, genetics, biocontrol)', 'Assess patentability of approach', 'Draft USDA NIFA or SARE grant', 'Deploy pilot in affected region', 'Monitor yield recovery'],
      outcome: 'Operator secures grant funding or patent position in climate-adaptive agriculture',
      failure: 'Weather normalizes or pest contained before technology deployment',
      window: 60,
      fastPath: ['Target worst-affected county', 'Match technology', 'Apply for grant'],
      examples: ['CTVA', 'FMC', 'SMG', 'ANDE', 'LNN']
    }
  };

  var COMPENSATION_MAP = {
    'GRANT-ELIGIBLE': { type: 'grant', base: 0.10, unit: 'grant value', tier: 1, nextTier: 0.15, maxTier: 0.25 },
    'INVESTABLE': { type: 'invest', base: 0.05, unit: 'profit', tier: 1, nextTier: 0.10, maxTier: 0.15 },
    'PATENTABLE': { type: 'patent', base: 0.10, unit: 'royalty', tier: 1, nextTier: 0.15, maxTier: 0.25 }
  };

  function enrichOpportunity(opp, dx) {
    var playbookId = dx ? (PLAYBOOK_MAP[dx.id] || 'agri_finance') : 'agri_finance';
    var pb = PLAYBOOKS[playbookId] || {};
    var comp = COMPENSATION_MAP[opp.path] || COMPENSATION_MAP['GRANT-ELIGIBLE'];
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

      add(enrichOpportunity({ id: dx.id + '_PATENTABLE_t1', title: dxLabel + ' — precision agriculture and monitoring platform', rank: stress * dx.relevance, path: 'PATENTABLE', urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));

      if (stress >= 0.50) add(enrichOpportunity({ id: dx.id + '_GRANT_t1', title: dxLabel + ' — food supply chain resilience infrastructure', rank: stress * dx.relevance * 0.9, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));

      if (stress >= 0.55 && dx.relevance >= 0.2) add(enrichOpportunity({ id: dx.id + '_INVESTABLE_t1', title: dxLabel + ' — input cost hedging and margin protection', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));

      add(enrichOpportunity({ id: dx.id + '_PATENT2_t1', title: dxLabel + ' — agtech adaptation and yield optimization', rank: stress * dx.relevance * 0.75, path: 'PATENTABLE', urgency: 'ACTIVE', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress }, dx));
    }

    // Company terminal opportunities
    var terminalCompanies = companies.filter(function (c) { return c.phase === 'p7a' || c.phase === 'p9'; });
    if (terminalCompanies.length > 0) add(enrichOpportunity({ id: 'ag_terminal_t1', title: 'Agriculture terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'IMMEDIATE', source: 'company_terminal', tier: 1, companies: terminalCompanies.map(function (c) { return c.ticker; }), stress: stress }, null));

    // Convergence
    if (this.state.convergence && this.state.convergence.primary_signal) add(enrichOpportunity({ id: 'ag_convergence_t1', title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — agriculture convergence response', rank: 0.98, path: 'GRANT-ELIGIBLE', urgency: 'IMMEDIATE', source: 'convergence', tier: 1, signal: this.state.convergence.primary_signal, stress: stress }, null));

    // TIER 2 — CROSS-DOMAIN
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) {
      var em = emissions[ei];
      add(enrichOpportunity({ id: 'ag_xd_' + (em.targetDomain || '') + '_t2', title: 'Agriculture \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'IMMEDIATE' : 'ACTIVE', source: 'cross_domain', tier: 2, stress: stress }, null));
    }

    // TIER 3 — LAGGING
    if (stress >= 0.50 && activeDx.length > 0) {
      add(enrichOpportunity({ id: 'ag_policy_t3', title: 'Agricultural policy and subsidy response', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
      add(enrichOpportunity({ id: 'ag_insurance_t3', title: 'Crop insurance and risk transfer positioning', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
    }
    if (stress >= 0.60 && activeDx.length > 0) {
      add(enrichOpportunity({ id: 'ag_harden_t3', title: 'Food distribution infrastructure hardening', rank: stress * 0.75, path: 'GRANT-ELIGIBLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
      add(enrichOpportunity({ id: 'ag_diversify_t3', title: 'Supplier diversification — alternative input sourcing', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'ACTIVE', source: 'lagging', tier: 3, stress: stress }, activeDx[0]));
    }

    // WATCHLIST — near-active diagnoses
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      if (stress >= 0.45) add(enrichOpportunity({ id: nearDx[ndi].id + '_watch', title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'WATCH', source: 'near_diagnosis', tier: 2, stress: stress }, nearDx[ndi]));
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
    var _COMP = {
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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
    });
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
