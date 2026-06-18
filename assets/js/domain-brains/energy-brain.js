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
 *   When convergence fires → draft grant application
 *   When company hits P7a → draft investor memo
 *   When diagnosis activates → draft patent opportunity
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
    this._loadDiagnosisBundles();        // G1: load real artifact-source bundles (only ones that exist)

    // Diagnosis → signal condition mapping
    // These map live conditions to which diagnoses become active
    this.diagnosisIndex = {
      'OIL_SHOCK':                ['crude_above_90', 'crude_above_100', 'STRAIT_DISRUPTION', 'OIL_SHOCK', 'REFINERY_ATTACK', 'SANCTIONS', 'energy_high_stress'],
      'GRID_COLLAPSE':            ['grid_stress', 'infrastructure_cross', 'CYBER_ATTACK', 'weather_extreme', 'structural_stress'],
      'PIPELINE_DISRUPTION':      ['STRAIT_DISRUPTION', 'PORT_DISRUPTION', 'TANKER_THREAT', 'chokepoint'],
      'RENEWABLE_INTERMITTENCY':  ['weather_extreme', 'generation_mix', 'storage_low'],
      'NUCLEAR_INCIDENT':         ['NUCLEAR_THREAT', 'MILITARY_ESCALATION'],
      'SYSTEMIC_ENERGY_STRESS':   ['energy_high_stress', 'structural_stress', 'macro_shock']
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
        path: 'PATENTABLE',
        urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Resilience infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — resilience infrastructure deployment',
          rank: stress * dx.relevance * 0.9,
          path: 'GRANT-ELIGIBLE',
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
        path: 'PATENTABLE',
        urgency: 'ACTIVE',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Company-driven
    var terminalCompanies = companies.filter(function (c) { return c.phase === 'p7a' || c.phase === 'p9'; });
    if (terminalCompanies.length > 0) {
      add({
        title: 'Energy terminal company distressed positioning',
        rank: 0.95,
        path: 'INVESTABLE',
        urgency: 'IMMEDIATE',
        source: 'company_terminal', tier: 1,
        companies: terminalCompanies.map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Stressed but non-terminal companies
    var stressedCompanies = companies.filter(function (c) { return c.phase === 'p3' || c.phase === 'p5'; });
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({
        title: 'Energy stressed-but-operating company selection',
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
        path: this.state.convergence.primary_signal === 'CONVERGENCE_TERMINAL' ? 'INVESTABLE' : 'GRANT-ELIGIBLE',
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
        path: 'GRANT-ELIGIBLE',
        urgency: stress > 0.70 ? 'ACTIVE' : 'WATCH',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });

      add({
        title: 'Energy substitution acceleration \u2014 alternative fuel and storage',
        rank: stress * 0.70,
        path: 'PATENTABLE',
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
          path: 'PATENTABLE',
          urgency: 'WATCH',
          source: 'near_diagnosis', tier: 2,
          diagnosisId: nd.id, stress: stress
        });
      }
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // ═══ CANONICAL ENRICHMENT — merge playbook detail into each opportunity ═══
    // This is the single upstream enrichment point. Console, Opportunities page,
    // and Operator all read from state.opportunities and get the same object.

    // Diagnosis → playbook ID mapping
    var _PB_MAP = {
      'OIL_SHOCK': 'infra_demand', 'GRID_COLLAPSE': 'infra_demand',
      'PIPELINE_DISRUPTION': 'infra_demand', 'RENEWABLE_INTERMITTENCY': 'climate_energy',
      'NUCLEAR_INCIDENT': 'infra_demand', 'SYSTEMIC_ENERGY_STRESS': 'infra_demand'
    };
    var _SRC_MAP = {
      'company_terminal': 'infra_demand', 'company_stressed': 'infra_demand',
      'convergence': 'climate_energy', 'cross_domain': 'econ_supply', 'lagging': 'infra_demand'
    };

    // Playbook detail registry (inline — matches energy-opportunities.html playbooks)
    var _PB_DETAIL = {
      'infra_demand': {
        explain: 'Energy infrastructure stress is creating demand for grid resilience, generation capacity, and pipeline hardening. Companies and technologies that address structural energy gaps are positioned to capture premium pricing and procurement.',
        action: 'Position in energy infrastructure companies. Search sam.gov for DOE/FERC procurement. Check patent gaps in grid resilience.',
        valueRange: '10-30% sector premium / $250K-$5M contracts',
        trigger: 'Energy stress > 0.50 with active diagnosis firing against live feed data.',
        validation: 'Confirm crude price feed LIVE. Check infrastructure stress. Verify diagnosis is evidence-grounded, not catch-all.',
        steps: ['Check Energy console — verify diagnosis is ACTIVE with evidence', 'Check PULSE panel — confirm feeds are FRESH', 'Review suggested targets — verify HELIX VALIDATED status', 'For INVEST: open investment console with target ticker', 'For GRANT: search sam.gov for DOE + relevant keywords', 'For PATENT: search patents.google.com for technology gaps'],
        outcome: 'Energy infrastructure companies outperform during sustained stress. Grant awards within 90-180 days. Patent filings secure IP in underexplored areas.',
        failure: 'Stress resolves quickly. Crude returns to baseline. Diagnosis deactivates. Seasonal or transient pattern.',
        window: '1-90 days',
        fastPath: ['1. Verify Energy stress > 50% with active diagnosis', '2. Check feed freshness in PULSE panel', '3. Execute: INVEST (position), GRANT (sam.gov), or PATENT (uspto.gov)'],
        examples: ['NextEra Energy (NEE)', 'Duke Energy (DUK)', 'Quanta Services (PWR)', 'XLE Energy ETF', 'Enterprise Products (EPD)']
      },
      'climate_energy': {
        explain: 'Renewable energy transition is accelerating due to policy, pricing, or intermittency stress. Clean energy companies, storage technology, and nuclear alternatives are capturing capital flows.',
        action: 'Position in clean energy ETFs and individual renewable companies. Check DOE grant programs for clean energy deployment.',
        valueRange: '15-40% clean energy sector returns',
        trigger: 'Renewable intermittency or climate policy signals active. Energy stress with clean energy convergence.',
        validation: 'Confirm renewable generation data. Check policy signals from governance domain. Verify transition is structural.',
        steps: ['Check Energy console for RENEWABLE_INTERMITTENCY or convergence signals', 'Verify clean energy policy signals from Governance domain', 'Review ICLN/TAN ETF performance for trend confirmation', 'For INVEST: position in FSLR, ENPH, CEG, or clean energy ETFs', 'For GRANT: search grants.gov for DOE clean energy programs', 'For PATENT: search battery/storage/grid technology gaps'],
        outcome: 'Clean energy sector captures transition capital. Storage and grid modernization see accelerated procurement.',
        failure: 'Policy reversal. Fossil fuel price collapse reduces transition urgency. Technology setbacks.',
        window: '7-180 days',
        fastPath: ['1. Check if RENEWABLE_INTERMITTENCY or convergence is active', '2. Check ICLN/TAN on Yahoo Finance for confirmation', '3. Execute: buy FSLR/ENPH or apply for DOE grants'],
        examples: ['First Solar (FSLR)', 'Enphase Energy (ENPH)', 'Constellation Energy (CEG)', 'ICLN Clean Energy ETF', 'Cameco (CCJ)']
      },
      'econ_supply': {
        explain: 'Energy supply pressure is transmitting economic cost burden across sectors. Companies with pricing power or supply chain resilience benefit from the pass-through.',
        action: 'Position in integrated energy majors with pricing power. Monitor for downstream sector rotation.',
        valueRange: '10-25% energy major returns during supply pressure',
        trigger: 'Cross-domain energy emission firing. Supply chain and economy receiving energy stress signals.',
        validation: 'Confirm energy stress is transmitting to other domains via emissions. Check economy/supply chain domain stress.',
        steps: ['Check Energy console for active cross-domain emissions', 'Verify Economy and Supply Chain domains showing elevated stress', 'Confirm integrated majors have pricing power (check Helix reports)', 'For INVEST: position in XOM, CVX, COP', 'For GRANT: search for supply chain resilience programs', 'Monitor for downstream sector weakness (industrials, transport)'],
        outcome: 'Integrated energy companies capture margin expansion. Supply chain resilience programs accelerate.',
        failure: 'Supply pressure resolves. Demand destruction offsets pricing power. Government intervention caps prices.',
        window: '1-60 days',
        fastPath: ['1. Check Energy emissions to Economy/Supply Chain', '2. Check XOM/CVX on Yahoo Finance', '3. Buy integrated majors or apply for supply resilience grants'],
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
      var _COMP = {
        'GRANT-ELIGIBLE': { type: 'grant', base: 10, unit: '%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' }, maxTier: { tier: 3, comp: 25 } },
        'INVESTABLE':     { type: 'invest', base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
        'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' }, maxTier: { tier: 3, comp: 25 } }
      };
      o.compensation = _COMP[o.path] || { type: 'grant', base: 10, unit: '%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 outcomes' }, maxTier: { tier: 3, comp: 25 } };

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
        doThis = 'Open distressed-asset positions in terminal-phase energy companies (' + (compList || 'see company list') + '). Set stop-loss at -15%. Target restructuring or acquisition premium.';
      } else if (src === 'company_stressed') {
        doThis = 'Screen stressed-but-operating energy companies (' + (compList || 'see company list') + ') for entry. These are not terminal — look for recovery catalysts, management action, or sector tailwind re-rating.';
      } else if (src === 'convergence') {
        if (o.path === 'INVESTABLE') doThis = 'Multiple stress signals are converging. Position in diversified energy exposure (' + (exList || 'broad energy ETFs') + ') to capture systemic repricing across the sector.';
        else doThis = 'Convergence stress creates grant eligibility. Prepare a multi-vector resilience proposal that addresses the overlapping disruptions — agencies prioritize systemic solutions.';
      } else if (src === 'cross_domain') {
        doThis = 'Energy stress is transmitting into adjacent sectors. Position in cross-sector beneficiaries — companies with pricing power or supply-chain resilience that profit from energy cost pass-through. Monitor ' + (exList || 'integrated majors, pipeline operators') + '.';
      } else if (src === 'diagnosis' && o.path === 'PATENTABLE') {
        if (titleLc.indexOf('monitoring') !== -1 || titleLc.indexOf('response') !== -1) doThis = 'File a provisional patent for a ' + dxLabel + ' monitoring/response system. Focus on real-time detection, automated alerting, and adaptive response protocols. Search USPTO/Google Patents for prior art gaps.';
        else if (titleLc.indexOf('adaptive') !== -1 || titleLc.indexOf('automation') !== -1) doThis = 'File a provisional patent for adaptive automation technology that responds to ' + dxLabel + ' conditions. Target the gap between current manual response protocols and what AI/ML-driven systems could handle autonomously.';
        else doThis = 'Identify the specific technology gap created by ' + dxLabel + '. Draft a provisional patent claim around the solution architecture. Search patents.google.com for white space.';
      } else if (src === 'diagnosis' && o.path === 'GRANT-ELIGIBLE') {
        doThis = 'Prepare a grant proposal for ' + dxLabel + ' resilience infrastructure. Target DOE, FERC, and state energy office programs. Frame around critical infrastructure protection and grid reliability mandates.';
      } else if (src === 'diagnosis' && o.path === 'INVESTABLE') {
        doThis = 'Open hedging positions against ' + dxLabel + ' exposure. Use sector ETFs and individual names (' + (exList || 'energy sector leaders') + '). Size for the stress level — ' + stressPct + '% stress warrants meaningful allocation.';
      } else if (src === 'lagging' && o.path === 'GRANT-ELIGIBLE') {
        doThis = 'Map the permitting and regulatory bottlenecks created by energy stress. Prepare a compliance-focused grant application targeting DOE/FERC infrastructure modernization or state-level resilience programs.';
      } else if (src === 'lagging' && o.path === 'PATENTABLE') {
        doThis = 'File a provisional patent around alternative fuel or long-duration storage technology that addresses the substitution gap. Focus on the specific failure mode the current energy mix cannot cover.';
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
        if (src === 'company_terminal') whyPays = 'Terminal-phase companies are priced for worst case. Any restructuring, acquisition, or sector recovery creates 30-80% upside from distressed entry. Risk is bounded by stop-loss.';
        else if (src === 'company_stressed') whyPays = 'Stressed-but-operating companies trade at a fear discount. Recovery to normal operations reprices equity 15-40% higher. Sector tailwind from infrastructure spending accelerates the timeline.';
        else if (src === 'cross_domain') whyPays = 'Cross-sector transmission means energy costs flow into margins of downstream companies. Integrated majors and pipeline operators capture the spread. ' + (o.valueRange || '10-25% sector premium during sustained stress') + '.';
        else if (titleLc.indexOf('grid') !== -1 || titleLc.indexOf('hardening') !== -1) whyPays = 'Grid hardening is mandatory capex — utilities must spend regardless of macro conditions. EPC firms and hardware vendors see revenue acceleration. ' + (o.valueRange || '15-30% infrastructure premium') + '.';
        else if (titleLc.indexOf('bottleneck') !== -1) whyPays = 'Capacity constraints create pricing power. Operators with constrained assets earn premium margins until new capacity comes online (typically 2-5 years). ' + (o.valueRange || '20-40% margin expansion') + '.';
        else whyPays = 'Market repricing follows confirmed stress. Companies positioned to benefit see re-rating as the diagnosis persists. ' + (o.valueRange || '10-30% sector premium') + '.';
      } else if (o.path === 'GRANT-ELIGIBLE') {
        if (src === 'lagging') whyPays = 'Regulatory response creates dedicated funding pools. Permitting/compliance grants are less competitive than technology grants — higher win rate. ' + (o.valueRange || '$250K-$5M per award') + '.';
        else if (src === 'convergence') whyPays = 'Convergence events trigger emergency and supplemental funding. Multi-vector proposals score higher because agencies want systemic solutions. ' + (o.valueRange || '$500K-$10M for systemic proposals') + '.';
        else whyPays = 'Active diagnosis creates documented need. Grant proposals backed by live system evidence and measurable stress data win at higher rates. ' + (o.valueRange || '$250K-$5M contracts via DOE/FERC/state programs') + '.';
      } else if (o.path === 'PATENTABLE') {
        if (titleLc.indexOf('monitoring') !== -1) whyPays = 'Monitoring/response IP is licensable to every utility and grid operator in the affected region. Recurring royalty revenue from each licensee. Patent creates a moat around the detection methodology.';
        else if (titleLc.indexOf('storage') !== -1 || titleLc.indexOf('substitution') !== -1) whyPays = 'Storage and alternative fuel patents address a structural gap that will persist for decades. Licensable to utilities, storage integrators, and EPC firms building the next generation of energy infrastructure.';
        else if (titleLc.indexOf('adaptive') !== -1 || titleLc.indexOf('automation') !== -1) whyPays = 'Automation IP for energy stress response has no dominant incumbent. First-mover patent position creates licensing revenue from utilities, grid operators, and energy management platforms.';
        else whyPays = 'Technology gaps exposed by ' + dxLabel + ' have no existing IP coverage. First patent filing creates defensible position. Licensable to utilities, contractors, and technology vendors. ' + (o.valueRange || '5-15% royalty on licensed implementations') + '.';
      } else {
        whyPays = o.valueRange ? ('Value range: ' + o.valueRange) : 'Revenue generated through direct service delivery to entities affected by the diagnosed condition.';
      }

      // ── TARGET (specific counterparties) ──
      var target = '';
      if (compList) target = 'Mapped companies: ' + compList + '.';
      if (exList && !compList) target = (target ? target + ' ' : '') + 'Target names: ' + exList + '.';
      if (o.path === 'GRANT-ELIGIBLE') target += (target ? ' ' : '') + 'Agencies: DOE, FERC, state energy offices, ARPA-E. Search sam.gov and grants.gov.';
      else if (o.path === 'PATENTABLE') target += (target ? ' ' : '') + 'Licensees: utilities, grid operators, EPC firms, storage integrators, energy management platforms.';
      else if (o.path === 'INVESTABLE' && !compList && !exList) target = 'Screen energy sector for companies with direct exposure to ' + dxLabel + '. Prioritize those with capex commitments, contracted revenue, or regulatory mandates.';
      if (!target) target = 'Identify counterparties directly affected by ' + (o.title || 'this condition') + '.';

      // ── TIMING (context-specific) ──
      var timing = '';
      if (o.urgency === 'IMMEDIATE') timing = 'Immediate — stress at ' + stressPct + '% demands action within days, not weeks.';
      else if (o.urgency === 'ACTIVE') timing = 'Near-term — execute within 1-4 weeks while stress holds at ' + stressPct + '%.';
      else if (o.urgency === 'WATCH') timing = 'Watchlist — monitor for activation trigger. Prepare execution materials now, deploy when diagnosis confirms.';
      else timing = o.window || 'Execute within the current stress window.';
      if (o.path === 'GRANT-ELIGIBLE' && timing.indexOf('grant') === -1) timing += ' Grant cycles: 60-180 days from submission to award.';
      if (o.path === 'PATENTABLE' && timing.indexOf('patent') === -1) timing += ' Provisional patent filing: 2-4 weeks to prepare, 12-month priority window.';

      // ── INVALID IF (disconfirming conditions) ──
      var invalidIf = '';
      if (src === 'company_terminal') invalidIf = 'Companies exit terminal phase (restructuring succeeds or sector recovers before entry). Domain stress drops below 40%.';
      else if (src === 'company_stressed') invalidIf = 'Companies enter terminal phase (downside, not recovery). Stress resolves too quickly for re-rating to materialize.';
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
      } else if (o.path === 'GRANT-ELIGIBLE') {
        nextStep = 'Search sam.gov for open solicitations matching "' + (dxLabel || 'energy resilience') + '". Draft a 1-page concept note with system evidence.';
      } else if (o.path === 'PATENTABLE') {
        nextStep = 'Search patents.google.com for prior art in "' + (dxLabel || 'energy stress response') + '" technology. Draft provisional patent claim outline.';
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

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;

    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // ACTION PIPELINE — the brain acts, not just thinks
  // ══════════════════════════════════════════════════════════════════════

  EnergyBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    // Check if action adapters are available
    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    // For each newly active diagnosis, create action drafts
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];

      // Only create drafts if we haven't already for this diagnosis
      var existingDrafts = adapters.getDrafts({ domain: 'energy', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

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
    var portalError = 0; // honest 0 — no live portal traversal yet (Phase C)
    var total = _emClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
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
    var outputScale = _emClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= EM_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.opportunityCount > EM_FLOOD_CAP;
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

    // a FINAL decision that depends on the prior, not just on raw obs:
    var readyForHandoff = (em.cycle > 0) && (predictedStress >= EM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    var nextPrior = this._updatePrior(priorIn, obs, em.plasticity.learningRate); // → next cycle reads this

    em.cycle += 1;
    em.observation = obs;
    em.predictionError = pe;
    em.predictedStress = predictedStress;
    em.regulation = reg;
    em.readyForHandoff = readyForHandoff;
    em.prior = nextPrior;
    em.updated = obs.timestamp;
    this.state.energyModel = em;

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
    var known = ['GRID_COLLAPSE', 'RENEWABLE_INTERMITTENCY', 'OIL_SHOCK', 'PIPELINE_DISRUPTION', 'NUCLEAR_INCIDENT', 'SYSTEMIC_ENERGY_STRESS'];
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
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.patents) ? _bundle.byLane.patents : null;
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
        : null
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
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'patents', shallow: bundleShallow } : null,
      missingEvidence: missingEv
    };
    var treatmentContext = {
      treatments: treatments,                 // real: brain-resolved, else real bundle treatments
      implementationSteps: implementationSteps,
      methodCandidates: _bArr('methodCandidates'),         // G1: REAL bundle only (empty if bundle lacks)
      mechanismCandidates: _bArr('mechanismCandidates'),
      embodimentCandidates: _bArr('embodimentCandidates'),
      figurePlaceholders: _bArr('figurePlaceholders')
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
      patentReady: ready, grantReady: ready, sbaReady: false,
      investmentReady: !!(hasTreat && primaryOpp), researchReady: hasTreat,
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
    if (bundleStatus === 'found' && bundleShallow) warnings.push('source-bundle-root-only (real bundle but portalCount<=1 / maxDepth 0)');
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

    return {
      schemaVersion: DDP_SCHEMA_VERSION,
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
        proofTier: proofTier
      }
    };
  };

  /**
   * Generate a real grant application for an energy opportunity.
   * Uses deep portal content: citations, steps, monitoring protocols.
   */
  EnergyBrain.prototype.generateGrantApplication = function (opportunityIndex) {
    var opp = this.state.opportunities[opportunityIndex || 0];
    if (!opp) return null;

    var pkg = window.LIMENPackageGenerator;
    if (!pkg) return null;

    // Enrich with resolved deep content
    var oppData = {
      domain: 'energy',
      title: opp.title,
      stress: opp.stress,
      sourceType: opp.source,
      confidence: this.state.confidence,
      resolvedContent: this.state.resolvedContent || null
    };

    return pkg.generatePackage(oppData, 'grant');
  };

  /**
   * Generate a patent provisional draft for an energy innovation.
   */
  EnergyBrain.prototype.generatePatentDraft = function (opportunityIndex) {
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
    }, 'patent');
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
      'assets/js/energy-clarity-operator.js'
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
