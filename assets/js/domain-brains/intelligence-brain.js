/**
 * intelligence-brain.js — Intelligence Domain Cognitive Engine
 *
 * Portal issues: INTELLIGENCE_FAILURE, MASS_SURVEILLANCE_SCANDAL, CYBER_ESPIONAGE,
 *                WHISTLEBLOWER_CRISIS, FOREIGN_INTERFERENCE
 *
 * Cross-domain emissions:
 *   intelligence → defense (threat visibility / adversarial intent)
 *   intelligence → communication (narrative manipulation / information contamination)
 *   intelligence → governance (institutional blind spots / coordination weakness)
 *   intelligence → finance (strategic risk visibility / hidden exposure)
 *   intelligence → technology (observability and trust-boundary pressure)
 *
 * Exposes: window.LIMENIntelligenceBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[IntelligenceBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function IntelligenceBrain() {
    Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
       domainId: 'intelligence', label: 'Intelligence', snapshotKey: 'intelligence', cycleInterval: 30000 });
    this.resourceAuthority = { ownerDomain: 'intelligence', policyId: 'intelligence-resource/1', lanes: ['research', 'publication'], budgets: { computeUnitsPerCycle: 512, queueCapacity: 64 }, switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false } };
  }
  IntelligenceBrain.prototype = Object.create(Base.prototype);
  IntelligenceBrain.prototype.constructor = IntelligenceBrain;

  IntelligenceBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── THING2 RECURSIVE PHASE KERNEL (2026-07-13) — the coherence router + phase-transition self-consistency calibration (interpretive)
    //    previously read s.phase (a naive per-cycle guess / static PHASE_M lineage). We now feed those
    //    from the REAL Thing2 kernel (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries),
    //    which runs the validated financial phase pipeline over this domain's own STRESS trajectory. The
    //    kernel is PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    //    posture only (interpretive:true, validated:false); we never surface it as validated.
    //    Fallback: if the adapter is absent or history < 8, _kernelPhase stays null and s.phase is used.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:intelligence'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }

    // ── One-shot cognition loaders (mirror defense/technology init): real entities,
    //    validated distress signals, real source bundles, L1 mad-lib scan, collection-posture sub-layer. ──
    try { this._loadIntelligenceCommandBoardCompanies(); } catch (e) {}  // real intelligence-sector entities (state.companies starved)
    try { this._loadIntelligenceBrainSignals(); } catch (e) {}           // distress ONLY from the validated Thing pipeline
    try { this._loadIntelligenceDiagnosisBundles(); } catch (e) {}       // load real artifact-source bundles (only ones that exist)
    try { this._loadIntelligenceL1PortalDepth(); } catch (e) {}          // scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._loadIntelligenceSublayer(); } catch (e) {}               // collection-posture / threat-warning sub-portal (ODNI/GAO/CISA/Bellingcat)

    // ── ACTUATION (2026-07-13) — port of the Energy brain's actuated depth, validity-gated per domain.
    // The 30s cycle stays 100% DETERMINISTIC: every method below is pure computation over live state +
    // one cached STATIC edge fetch (intelligence.json). NO paid-AI / LLM call runs on the cycle, ever.
    //
    // VALIDITY GATE (why each is TRUE here — intelligence has real, controllable effectors):
    //   refractory:true  Effector = the REPORT_GENERATION action-draft this brain already emits
    //                    (_checkDiagnosisActions). Dead-time de-dup of a diagnosis re-firing is a real,
    //                    honest behaviour. Neuro Ref III.3 (refractory period).
    //   servo:true       Effector = this brain's OWN emission output (opportunity confidence). Sensor =
    //                    excitatory drive (stress + live conditions + active dx) vs current inhibition
    //                    (im.regulation.inhibition — a real term this brain computes). PI controller
    //                    (fast proportional + bounded slow integral). Neuro Ref XIII.1 / V.2 / XII.
    //   eiBrake:true     Effector = emission dampening + action-draft gating. The servo's emissionFactor
    //                    feeds a stop-circuit brake (halt/dampen/clear). Inhibition-tracks-drive is the
    //                    doc's most-repeated invariant (XIII.1). Honest: it regulates ONLY this brain's
    //                    own output, never rewrites stress/scoring/diagnoses/intelligence.json.
    //   phase:true       Router = phase-coherence coupling to co-phased stressed peers (patent M matrix,
    //                    advisory). Credit = a realized phase TRANSITION is SELF-CONSISTENCY CALIBRATION
    //                    (interpretive), NEVER external reward — even on the Thing1-validated P3/P7 family.
    //                    K4 credit routes through the central honest gate (window.LIMENK4.credit); the
    //                    P3/P7 family only gates the phase-consistency TIER, it never makes the signal a
    //                    reward. Intelligence is NOT externalRewardEligible, so isReward is always false.
    // All four are fully reversible (flip any flag to false). MIRRORS assets/data/domains/intelligence.json
    // runtime intent; the brain runs in its own context and keeps its own copy.
    this._actuation = { overlays: true, refractory: true, servo: true, eiBrake: true, phase: true };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio preserved, mirrors Energy)
      overrideThreshold: 0.9      // reduced sensitivity: only stress >= 0.9 re-fires in-window
    };

    this.diagnosisIndex = {
      'INTELLIGENCE_FAILURE':         ['signal_blindness', 'collection_gap', 'low_observability', 'weak_anomaly_detection', 'analytic_distortion', 'intelligence_high_stress', 'structural_stress'],
      'MASS_SURVEILLANCE_SCANDAL':    ['oversight_failure', 'trust_boundary_breach', 'privacy_violation', 'bulk_collection_excess', 'intelligence_high_stress'],
      'CYBER_ESPIONAGE':              ['adversarial_penetration', 'compromised_channel', 'deception_exposure', 'leaked_signals', 'network_intrusion', 'macro_shock'],
      'WHISTLEBLOWER_CRISIS':         ['trust_boundary_breach', 'leaked_signals', 'oversight_failure', 'institutional_exposure', 'narrative_capture'],
      'FOREIGN_INTERFERENCE':         ['adversarial_penetration', 'deception_exposure', 'narrative_manipulation', 'information_contamination', 'coordination_failure', 'macro_shock']
    };

    this.emissionRules = [
      { targetDomain: 'defense', signalType: 'threat_visibility_pressure', condition: function (s) { return s.stress >= 0.15; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.6); } },
      { targetDomain: 'communication', signalType: 'information_contamination_risk', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'governance', signalType: 'coordination_blind_spot', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'finance', signalType: 'strategic_risk_visibility', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'technology', signalType: 'observability_trust_pressure', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } }
    ];
  };

  IntelligenceBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — intelligence always has observability pressure
    this._activeConditions.push('collection_gap');
    this._activeConditions.push('low_observability');
    signals.push('BASELINE: Persistent intelligence collection and observability posture pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('intel') !== -1 || fn.indexOf('espionage') !== -1 || fn.indexOf('surveillance') !== -1 || fn.indexOf('security') !== -1 || fn.indexOf('national') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('signal_blindness');
        this._activeConditions.push('weak_anomaly_detection');
        signals.push('FEED: Intelligence signal activity — ' + (f.label || f.value));
      }
      if ((fn.indexOf('cyber') !== -1 || fn.indexOf('hack') !== -1 || fn.indexOf('breach') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('adversarial_penetration');
        this._activeConditions.push('network_intrusion');
        signals.push('ELEVATED: Cyber threat signal detected');
      }

      // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (CISA KEV / Federal Register / OFAC) ──
      // Distinct collection methodologies from RSS keyword feeds — different ceilings.

      // CISA KEV — curated newly-exploited CVEs → CYBER_ESPIONAGE
      if (fn.indexOf('cisa kev') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('compromised_channel');
        signals.push('CISA KEV: ' + f.value + ' newly-exploited CVEs (30d)');
      }
      if (fn.indexOf('cisa kev') !== -1 && f.value !== undefined && f.value >= 25) {
        this._activeConditions.push('adversarial_penetration');
        this._activeConditions.push('network_intrusion');
      }

      // Fed Reg FBI — investigative regulatory volume → INTEL_FAILURE / SURVEILLANCE
      if (fn.indexOf('fed reg fbi') !== -1 && f.value !== undefined && f.value >= 1) {
        this._activeConditions.push('privacy_violation');
        signals.push('Fed Reg FBI: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg fbi') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('weak_anomaly_detection');
      }
      if (fn.indexOf('fed reg fbi') !== -1 && f.value !== undefined && f.value >= 8) {
        this._activeConditions.push('bulk_collection_excess');
      }

      // The Intercept NatSec — whistleblower/surveillance journalism beat
      // → WHISTLEBLOWER_CRISIS triggers (leaked_signals, institutional_exposure)
      if (fn.indexOf('intercept') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('leaked_signals');
        this._activeConditions.push('institutional_exposure');
        signals.push('The Intercept: ' + f.value + ' surveillance/whistleblower articles');
      }
      if (fn.indexOf('intercept') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('narrative_capture');
      }

      // Lawfare NatSec — surveillance-law critique / oversight analysis
      // → MASS_SURVEILLANCE_SCANDAL trigger (oversight_failure)
      if (fn.indexOf('lawfare') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('oversight_failure');
        signals.push('Lawfare: ' + f.value + ' NatSec law/policy articles');
      }
      if (fn.indexOf('lawfare') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('trust_boundary_breach');
      }

      // Bellingcat OSINT — open-source investigations → FOREIGN_INTERFERENCE
      if (fn.indexOf('bellingcat') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('deception_exposure');
        signals.push('Bellingcat: ' + f.value + ' OSINT investigation articles');
      }

      // Fed Reg CIA — foreign intel regulatory → FOREIGN_INTERFERENCE / INTEL_FAILURE
      if (fn.indexOf('fed reg cia') !== -1 && f.value !== undefined && f.value >= 1) {
        this._activeConditions.push('analytic_distortion');
        signals.push('Fed Reg CIA: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg cia') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('coordination_failure');
      }

      // Fed Reg NSA — signals intel regulatory → MASS_SURVEILLANCE_SCANDAL
      if (fn.indexOf('fed reg nsa') !== -1 && f.value !== undefined && f.value >= 1) {
        this._activeConditions.push('bulk_collection_excess');
        signals.push('Fed Reg NSA: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg nsa') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('oversight_failure');
        this._activeConditions.push('trust_boundary_breach');
      }

      // OFAC Recent Actions — sanctions / counterintelligence overlap
      // → FOREIGN_INTERFERENCE (sanctions often respond to interference / espionage)
      if (fn.indexOf('ofac') !== -1 && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('deception_exposure');
        signals.push('OFAC: ' + f.value + ' sanctions designation signals');
      }
      if (fn.indexOf('ofac') !== -1 && f.value !== undefined && f.value >= 30) {
        this._activeConditions.push('narrative_manipulation');
        this._activeConditions.push('information_contamination');
      }
    }

    // RSS article signals — catch generic "N articles on intelligence" patterns
    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('espionage') !== -1 || rs.indexOf('spy') !== -1 || rs.indexOf('infiltrat') !== -1) {
        if (this._activeConditions.indexOf('adversarial_penetration') === -1) this._activeConditions.push('adversarial_penetration');
        if (this._activeConditions.indexOf('deception_exposure') === -1) this._activeConditions.push('deception_exposure');
      }
      if (rs.indexOf('surveillance') !== -1 || rs.indexOf('bulk collection') !== -1 || rs.indexOf('privacy') !== -1) {
        if (this._activeConditions.indexOf('bulk_collection_excess') === -1) this._activeConditions.push('bulk_collection_excess');
        if (this._activeConditions.indexOf('privacy_violation') === -1) this._activeConditions.push('privacy_violation');
      }
      if (rs.indexOf('leak') !== -1 || rs.indexOf('whistleblow') !== -1 || rs.indexOf('classified') !== -1) {
        if (this._activeConditions.indexOf('leaked_signals') === -1) this._activeConditions.push('leaked_signals');
        if (this._activeConditions.indexOf('institutional_exposure') === -1) this._activeConditions.push('institutional_exposure');
      }
      if (rs.indexOf('disinformation') !== -1 || rs.indexOf('foreign influence') !== -1 || rs.indexOf('interference') !== -1 || rs.indexOf('manipulation') !== -1) {
        if (this._activeConditions.indexOf('narrative_manipulation') === -1) this._activeConditions.push('narrative_manipulation');
        if (this._activeConditions.indexOf('information_contamination') === -1) this._activeConditions.push('information_contamination');
      }
      if (rs.indexOf('cyber') !== -1 || rs.indexOf('breach') !== -1 || rs.indexOf('intrusion') !== -1) {
        if (this._activeConditions.indexOf('network_intrusion') === -1) this._activeConditions.push('network_intrusion');
        if (this._activeConditions.indexOf('compromised_channel') === -1) this._activeConditions.push('compromised_channel');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('intelligence') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'intelligence') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'intelligence' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    // ── CIRCULARITY CUT (2026-07-24) — no condition may be manufactured from this
    //    domain's own stress scalar. normalizeSignals runs BEFORE scoreStress, so these
    //    gates read the PREVIOUS cycle's stress: the resulting "active diagnosis" restated
    //    one number instead of adding evidence, and because emissions are gated on an
    //    active diagnosis and peers fold received pressure back into stress, it closed a
    //    feedback ring carrying no new information. Reground to a real feed to restore a
    //    condition; never re-derive one from stress.
    //    SURVIVES on real feeds/events : 7: coordination_failure, analytic_distortion, weak_anomaly_detection, signal_blindness, narrative_capture, oversight_failure, trust_boundary_breach
    //    REMOVED, no other source in this file : 2: intelligence_high_stress, structural_stress

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('trust_boundary_breach');
    if (extPressure >= 0.20) this._activeConditions.push('adversarial_penetration');

    this.state.signals = signals;
    console.log('[IntelligenceBrain] normalizeSignals: ' + this._activeConditions.length + ' conditions, ' + signals.length + ' signals, stress=' + this.state.stress);
    return Promise.resolve();
  };

  IntelligenceBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) { console.warn('[IntelligenceBrain] deriveDiagnoses: NO PORTAL DATA'); return; }
      var issues = portal.issues || [], conditions = self._activeConditions || [];
      self.state.diagnoses = issues.map(function (iss) {
        var triggers = self.diagnosisIndex[iss.id] || [], matchCount = 0;
        for (var t = 0; t < triggers.length; t++) for (var c = 0; c < conditions.length; c++) if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) matchCount++;
        return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: Math.round((triggers.length > 0 ? matchCount / triggers.length : 0) * 100) / 100, matchedConditions: matchCount, totalTriggers: triggers.length, circuits: iss.circuits || [], source: 'canonical' };
      });
      self.state.diagnoses.sort(function (a, b) { if (a.active !== b.active) return a.active ? -1 : 1; return b.relevance - a.relevance; });
      var activeDxCount = self.state.diagnoses.filter(function (d) { return d.active; }).length;
      console.log('[IntelligenceBrain] deriveDiagnoses: ' + self.state.diagnoses.length + ' total, ' + activeDxCount + ' active, conditions=' + (self._activeConditions || []).length);
      if (self._activeConditions && self._activeConditions.length > 0 && activeDxCount === 0) console.error('[IntelligenceBrain] PIPELINE BREAK: conditions exist but 0 diagnoses active');
      self._checkDiagnosisActions();
      // Neuro-substrate telemetry (advisory): brain state (pulse-less capable) -> runtime overlay via generic adapter.
      try {
        if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
          window.DomainTelemetryAdapter.fromLiveCached("intelligence", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
    });
  };

  IntelligenceBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; console.log('[IntelligenceBrain] recommendTreatments: 0 active diagnoses, treatments=[]'); return; }
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) { var circuits = activeDx[di].circuits || []; for (var ci = 0; ci < circuits.length; ci++) activeNodeIds[circuits[ci].nodeId] = activeDx[di].id; }
      var treatments = [], activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) { var act = activations[ai]; if (!activeNodeIds[act.brainNodeId]) continue; var actTreats = act.treatments || []; for (var ti = 0; ti < actTreats.length; ti++) { var t = actTreats[ti]; treatments.push({ id: 'treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', diagnosisId: activeNodeIds[act.brainNodeId], nodeId: act.brainNodeId, relevance: 1.0, source: 'canonical' }); } }
      var eR = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (eR[b.evidence] || 0) - (eR[a.evidence] || 0); });
      self.state.treatments = treatments;
      console.log('[IntelligenceBrain] recommendTreatments: ' + treatments.length + ' treatments from ' + activeDx.length + ' active diagnoses');
      if (activeDx.length > 0 && treatments.length === 0) console.error('[IntelligenceBrain] PIPELINE BREAK: diagnoses active but 0 treatments resolved');
    });
  };

  IntelligenceBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — observability and anomaly detection expansion', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — intelligence fusion and coordination infrastructure', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — counterintelligence and trust-boundary hardening', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — disinformation detection and narrative integrity', rank: stress * dx.relevance * 0.75, path: 'RESEARCHABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    // Intelligence entities come from command-board-data (real intelligence-sector tickers) with a
    // canonical fallback (PLTR/BAH/LDOS/CACI/SAIC/KBR/VRNT/NICE/VRSK). Distress band ('elevated') is
    // applied ONLY from the validated Thing pipeline (_pubSignals) — never inferred from raw phase.
    var coList = (companies && companies.length) ? companies : (this._cbIntelligenceCompanies || []);
    var pub = this._pubSignals || {};
    var termCo = coList.filter(function (c) { var p = c && c.ticker && pub[c.ticker]; return p && p.band === 'elevated'; });
    var stressedCo = coList.filter(function (c) { var p = c && c.ticker && pub[c.ticker]; return p && (p.band === 'elevated' || p.band === 'watch'); });
    if (termCo.length > 0) add({ title: 'Intelligence terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (stress >= 0.55 && activeDx.length > 0 && coList.length > 0) {
      add({ title: 'Collection surge — SIGINT/HUMINT platform positioning', rank: stress * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'company_surge', tier: 1, companies: coList.slice(0, 6).map(function (c) { return c.ticker; }).filter(Boolean), stress: stress });
      add({ title: 'Counterintelligence and insider-risk capability acceleration', rank: stress * 0.82, path: 'INVESTABLE', urgency: 'medium', source: 'company_surge', tier: 1, companies: coList.map(function (c) { return c.ticker; }).filter(Boolean).slice(0, 4), stress: stress });
      add({ title: 'All-source analysis and threat-warning fusion programs', rank: stress * 0.78, path: 'RESEARCHABLE', urgency: 'medium', source: 'company_surge', tier: 1, companies: coList.map(function (c) { return c.ticker; }).filter(Boolean).slice(0, 5), stress: stress });
    }
    if (stressedCo.length > 0) add({ title: 'Intelligence-sector contractor stress monitoring', rank: 0.6, path: 'RESEARCHABLE', urgency: 'watching', source: 'company_stressed', tier: 2, companies: stressedCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — intelligence convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Intelligence \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Cybersecurity and threat intelligence infrastructure', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'cyber_infra', stress: stress });
      add({ title: 'Intelligence oversight and accountability systems', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'oversight', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Data fusion and multi-source intelligence platforms', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'data_fusion', stress: stress });
      add({ title: 'Strategic early warning and predictive analysis systems', rank: stress * 0.72, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'early_warning', stress: stress });
      add({ title: 'Trust verification and secure communication infrastructure', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'trust_verify', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    // ── PHASE-COHERENCE WINDOW (actuated, phase) — coherent coupling to co-phased, stressed peers opens
    //    the processing window (communication-through-coherence, patent M matrix): surface up to +1
    //    cross-domain watch opportunity that the un-coupled brain would not raise. Advisory router,
    //    bounded rank, reversible. Reads the PRIOR cycle's intelligencePhaseDynamics (one-cycle lag).
    try {
      var _pd = this.state.intelligencePhaseDynamics;
      if (this._actuation && this._actuation.phase && _pd && _pd.couplingStrength > 0.15 && _pd.coupled && _pd.coupled.length) {
        var _c = _pd.coupled[0];
        add({ title: 'Phase-coherent coupling to ' + _c.domain + ' (' + _c.phase + ') — cross-domain intelligence watch', rank: Math.min(0.5, _pd.couplingStrength), path: 'RESEARCHABLE', urgency: 'watching', source: 'phase_coherence', tier: 2, stress: stress, coupledDomain: _c.domain, coupledPhase: _c.phase });
      }
    } catch (e) {}

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge intelligence playbook detail per opportunity
    var PB_LIST = window.LIMENIntelligenceOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'INTELLIGENCE_FAILURE': 'intelligence_failure',
      'MASS_SURVEILLANCE_SCANDAL': 'surveillance_scandal',
      'CYBER_ESPIONAGE': 'cyber_espionage',
      'WHISTLEBLOWER_CRISIS': 'whistleblower_crisis',
      'FOREIGN_INTERFERENCE': 'foreign_interference'
    };
    var _LAGGING_MAP = {
      'cyber_infra': 'cyber_espionage',
      'data_fusion': 'intelligence_failure',
      'early_warning': 'intelligence_failure',
      'oversight': 'surveillance_scandal',
      'trust_verify': 'whistleblower_crisis'
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5,  unit: 'cite/credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 research outputs published' }, maxTier: { tier: 3, comp: 20 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'intelligence';
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
        var evidenceParts = ['Domain: intelligence', 'Stress: ' + stressPct + '%'];
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
    // ── E/I EMISSION BRAKE (actuated, eiBrake) — apply the PRIOR cycle's servo-derived proportional
    //    dampening to opportunity confidence (and hold on halt). Runs on the enriched opps (o.confidence
    //    is set above). Additive to the generic brake gate; effector = this brain's own emission only.
    try { if (this._actuation && this._actuation.eiBrake) this._applyIntelligenceEmissionBrake(opps); } catch (e) {}

    this.state.opportunityCount = opps.length;

    this.state.opportunities = opps;
    return Promise.resolve();
  };

  // Consumed by surfaceOpportunities (end): applies the prior cycle's E/I brake to the opportunity set.
  // halt -> hold + zero-factor confidence; dampen/E-I -> proportional confidence dampening. Non-destructive
  // (opps are rebuilt fresh each cycle). Only ever REDUCES emission — the safe direction for a killswitch.
  IntelligenceBrain.prototype._applyIntelligenceEmissionBrake = function (opps) {
    var brake = this.state.intelligenceBrake;
    if (!brake || brake.level === 'clear') { this.state._intelligenceOpportunitiesHeld = false; return opps; }
    var pen = (typeof brake.confidencePenalty === 'number') ? brake.confidencePenalty : 1;
    var codes = (brake.reasons || []).map(function (r) { return r.code; }).join(',');
    for (var i = 0; i < opps.length; i++) {
      if (pen < 1 && typeof opps[i].confidence === 'number') { opps[i].confidence = Math.round(opps[i].confidence * pen); opps[i]._eiApplied = true; }
      if (brake.suppressOpportunities) { opps[i].held = true; opps[i].heldReason = codes; }
    }
    this.state._intelligenceOpportunitiesHeld = !!brake.suppressOpportunities;
    return opps;
  };

  IntelligenceBrain.prototype._checkDiagnosisActions = function () {
    // HALT BRAKE (actuated, eiBrake) — do not emit action drafts while the PRIOR cycle's stop-circuit
    // is engaged. Reads state.intelligenceBrake (computed at the end of the previous cycle). Never
    // throws; if the brake is absent (cycle 1) behaviour is unchanged.
    var _brake = this.state.intelligenceBrake;
    if (this._actuation && this._actuation.eiBrake && _brake && _brake.suppressActions) {
      this.state._intelligenceBrakeHeldActions = (this.state._intelligenceBrakeHeldActions || 0) + 1;
      return;
    }
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    var _now = (this._runtimeOverlay && this._runtimeOverlay.timestamp) || (this.state.pulse && this.state.pulse.timestamp) || ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0);
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'intelligence', intentId: dx.id }).length > 0) continue;
      // REFRACTORY GATE (III.3, actuated) — once a diagnosis has emitted a draft, suppress re-emission
      // within the dead-time unless stress clears the (reduced-sensitivity) override bar. The diagnosis
      // stays active/displayed; only the duplicate DRAFT is withheld. Deterministic; best-effort.
      if (this._actuation && this._actuation.refractory) {
        try {
          if (!this._intelligenceRefractoryAllows(dx.id, _now, this.state.stress)) {
            this.state._intelligenceRefractorySuppressed = (this.state._intelligenceRefractorySuppressed || 0) + 1;
            continue;
          }
        } catch (_e) { /* gate is best-effort; fall through to normal emission */ }
      }
      adapters.createDraft('REPORT_GENERATION', { domain: 'intelligence', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Intelligence Alert: ' + dx.label, intent: { domain: 'intelligence', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on intelligence systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify compromised channels and collection gaps', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate hardening and observability opportunities', status: 'PENDING' }] } });
    }
  };

  // ── REFRACTORY LIMITER (III.3, inline — no external module dependency; self-contained + deterministic).
  //    Absolute dead-time (no re-fire) + relative raised-threshold window (a stronger stimulus can still
  //    fire) + full recovery after the relative window. Mirrors Energy's LIMENRefractoryLimiter math. ──
  IntelligenceBrain.prototype._intelligenceRefractoryAllows = function (dxId, now, stress) {
    if (!this._refractoryState) this._refractoryState = {};
    var p = this._refractoryParams || { absoluteWindow: 900000, relativeWindow: 3600000, overrideThreshold: 0.9 };
    var last = this._refractoryState[dxId];
    if (last == null) { this._refractoryState[dxId] = now; return true; }         // first fire
    var dt = now - last;
    if (dt >= p.relativeWindow) { this._refractoryState[dxId] = now; return true; } // fully recovered
    if (dt < p.absoluteWindow) return false;                                        // absolute dead-time
    if ((typeof stress === 'number' ? stress : 0) >= p.overrideThreshold) { this._refractoryState[dxId] = now; return true; } // strong re-fire
    return false;                                                                   // relative window, sub-threshold
  };

  IntelligenceBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  // ── COGNITION PORT (GUARD: reads the validated spine — state.{stress,diagnoses,opportunities,feeds} —
  //    and writes ONLY NEW keys: state.intelligenceModel, state.intelligence{Immune,Awareness,Conscience,
  //    Intuition,Simulation,ExecutiveReport}, state.cognition, state.collectionPostureLayer. NEVER alters
  //    scoreStress or deriveDiagnoses. The recurrent update is try/catch-guarded so it can never break the cycle.) ──
  var _origCycle = IntelligenceBrain.prototype.cycle;
  IntelligenceBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Higher cognition: predictive self-model + metacognition (runs AFTER diagnoses settle)
      try { self._updateIntelligenceModel(); } catch (e) {}
      try { self._computeIntelligenceOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from energy 2026-07-21): invokes intelligence's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes intelligence's OWN modules
  // (window.Intelligence{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against intelligence's OWN runtime def
  // (intelligence.json runtime.params + edges/issues/activations). SHADOW: writes state.intelligenceOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // intelligence console), 'loading' until intelligence.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  IntelligenceBrain.prototype._loadIntelligenceDef = function () {
    if (this._intelligenceDef) return this._intelligenceDef;
    if (this._intelligenceDefLoading) return null;
    this._intelligenceDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/intelligence.json').then(function (r) { return r.json(); })
          .then(function (def) { self._intelligenceDef = def; })
          .catch(function () { self._intelligenceDefLoading = false; });
      } catch (e) { this._intelligenceDefLoading = false; }
    }
    return null;
  };

  IntelligenceBrain.prototype._computeIntelligenceOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('IntelligenceMetaplasticity', '../intelligence-metaplasticity.js');
    var EXT = mod('IntelligenceExtinction', '../intelligence-extinction.js');
    var RETRO = mod('IntelligenceRetrogradeThrottle', '../intelligence-retrograde-throttle.js');
    var PEC = mod('IntelligencePredictionErrorCompressor', '../intelligence-prediction-error-compressor.js');
    var OFF = mod('IntelligenceOfflineMaintenance', '../intelligence-offline-maintenance.js');
    var NS = mod('IntelligenceNeuroSubstrate', '../intelligence-neuro-substrate.js');
    var CONN = mod('IntelligenceConnectivityAudit', '../intelligence-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.intelligenceOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the intelligence console)' };
      return null;
    }
    var def = this._loadIntelligenceDef();
    if (!def) { s.intelligenceOverlays = { version: 1, mode: 'loading', note: 'intelligence.json runtime def loading; overlays compute next cycle' }; return null; }

    var armed = !!(this._actuation && this._actuation.overlays);
    var ov = this._runtimeOverlay || {};
    var params = (def.runtime && def.runtime.params) || {};

    var volatility = (typeof ov.volatility === 'number') ? ov.volatility : (function () {
      var h = ((s.memory && s.memory.stressHistory) || []).slice(-12), sum = 0;
      for (var i = 1; i < h.length; i++) sum += Math.abs((h[i].stress || 0) - (h[i - 1].stress || 0));
      return h.length > 1 ? Math.max(0, Math.min(1, sum / (h.length - 1))) : 0;
    })();

    var meta = META.adaptParams(
      { offlineDownscaleFactor: params.offlineDownscaleFactor, refractoryAbsoluteWindow: params.refractoryAbsoluteWindow, predictionErrorThreshold: params.predictionErrorThreshold },
      { gain: (typeof params.metaplasticityGain === 'number') ? params.metaplasticityGain : 0, volatility: volatility }
    );
    var adapted = meta.adapted || {};

    var activeTriggers = ov.activeTriggers || this._activeConditions || [];
    var ext = EXT.proposeExtinction(def, activeTriggers);

    var overload = {}, actsOv = ov.activations || {};
    Object.keys(actsOv).forEach(function (nid) {
      var a = actsOv[nid], cap = (a && a.capacity) || 1;
      if (a && typeof a.load === 'number' && cap > 0 && a.load / cap > 1) overload[nid] = a.load / cap;
    });
    var retro = RETRO.computeThrottle(def, { overload: overload, throttleGain: (typeof params.retrogradeThrottleGain === 'number') ? params.retrogradeThrottleGain : 0 });

    var intero = s.intelligenceInteroception || (s.cognition && s.cognition.interoception) || {};
    var chans = ((intero.channels) || []).map(function (c) { return { id: c.name, observed: c.alarm }; });
    var baseline = chans.length ? chans.reduce(function (a, c) { return a + (c.observed || 0); }, 0) / chans.length : 0;
    var peThresh = (typeof adapted.predictionErrorThreshold === 'number') ? adapted.predictionErrorThreshold : (params.predictionErrorThreshold || 0);
    var pec = PEC.compress(chans, { threshold: peThresh, predictor: 'baseline', baseline: baseline });

    var off = OFF.runOfflineMaintenance(def, {
      downscaleFactor: (typeof adapted.offlineDownscaleFactor === 'number') ? adapted.offlineDownscaleFactor : (params.offlineDownscaleFactor || 1),
      consolidateTopK: (typeof params.offlineConsolidateTopK === 'number') ? params.offlineConsolidateTopK : Infinity,
      pruneThreshold: (typeof params.offlinePruneThreshold === 'number') ? params.offlinePruneThreshold : 0
    });

    var recurrence = CONN.recurrenceAudit(def);
    var incompleteCircuits = (def.issues || []).map(function (is) { return NS.validateIncompleteCircuit(is); });
    var incompleteCount = incompleteCircuits.filter(function (v) { return v.verdict === 'INCOMPLETE_CIRCUIT'; }).length;

    s.intelligenceOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits intelligence.json — human-gated forever)' },
      retrograde: { actions: retro.actions, throttled: retro.actions.length, noop: retro.noop },
      peCompression: { compressed: pec.summary.compressedCount, propagated: pec.propagated.length, ratio: pec.compressionRatio, summary: pec.summary },
      offlineMaintenance: { downscaled: (off.report.operations.downscale || {}).edgesDownscaled, pruned: (off.report.operations.prune || {}).pruned, report: off.report, actuation: 'PROPOSAL-ONLY on a deep copy; pruning is human-gated forever' },
      recurrence: { verdict: recurrence.verdict, recurrentFraction: recurrence.recurrentFraction, lateralFraction: recurrence.lateralFractionOfClassifiable },
      incompleteCircuits: incompleteCircuits, incompleteCount: incompleteCount
    };

    var applied = { refractoryAbsoluteWindow: null };
    var base = this._refractoryBaseWindow || (this._refractoryParams && this._refractoryParams.absoluteWindow) || 900000;
    if (armed) {
      var wantRaw = (typeof adapted.refractoryAbsoluteWindow === 'number') ? adapted.refractoryAbsoluteWindow : base;
      var want = Math.max(base, Math.min(base * 1.2, wantRaw));
      if (this._refractoryParams) this._refractoryParams.absoluteWindow = want;
      if (this._refractoryLimiter && this._refractoryLimiter.params) this._refractoryLimiter.params.absoluteWindow = want;
      applied.refractoryAbsoluteWindow = want;
    } else {
      if (this._refractoryParams && this._refractoryParams.absoluteWindow !== base) this._refractoryParams.absoluteWindow = base;
      if (this._refractoryLimiter && this._refractoryLimiter.params && this._refractoryLimiter.params.absoluteWindow !== base) this._refractoryLimiter.params.absoluteWindow = base;
    }
    s.intelligenceOverlays.mode = armed ? 'armed' : 'shadow';
    s.intelligenceOverlays.applied = applied;
    s.intelligenceOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.intelligenceOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): intelligence runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on intelligence.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.intelligenceOverlays;
    return s.intelligenceOverlays;
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIGHER COGNITION — predictive self-model + metacognition (intelligence).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition /
  // simulation / executive-report. Mirrors defense/technology STRUCTURE exactly;
  // only the CONTENT is intelligence (collection SIGINT/HUMINT/GEOINT/OSINT,
  // all-source analysis & assessment, espionage & counterintelligence, surveillance
  // & reconnaissance, threat warning, covert action, information/influence ops,
  // security clearance & insider risk).
  // ══════════════════════════════════════════════════════════════════════
  var IM_VERSION = 1;
  var IM_LEARNING_RATE = 0.25;
  var IM_SLOW_RATE = 0.08;
  var IM_STRESS_FLOOR = 0.30;
  var IM_FLOOD_CAP = 12;
  var IM_STALE_MS = 1000 * 60 * 60 * 6;
  var _imClamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var _imJaccardDistance = function (a, b) {
    a = a || []; b = b || [];
    if (!a.length && !b.length) return 0;
    var sa = {}, inter = 0;
    a.forEach(function (x) { sa[x] = 1; });
    b.forEach(function (x) { if (sa[x]) inter++; });
    var uni = a.length + b.length - inter;
    return uni ? 1 - inter / uni : 0;
  };

  (function () {
    var P = IntelligenceBrain.prototype;

    // Intelligence diagnosis families — an analogy lens for monitoring, NOT evidence.
    var FAMILY = {
      'collection': ['INTELLIGENCE_FAILURE', 'CYBER_ESPIONAGE'],
      'oversight': ['MASS_SURVEILLANCE_SCANDAL', 'WHISTLEBLOWER_CRISIS'],
      'adversary': ['CYBER_ESPIONAGE', 'FOREIGN_INTERFERENCE'],
      'narrative': ['FOREIGN_INTERFERENCE', 'MASS_SURVEILLANCE_SCANDAL'],
      'insider': ['WHISTLEBLOWER_CRISIS', 'INTELLIGENCE_FAILURE']
    };

    P._neutralIntelligenceModel = function () {
      return { version: IM_VERSION, cycle: 0, prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, plasticity: { learningRate: IM_LEARNING_RATE, slowRate: IM_SLOW_RATE, consolidation: 0 }, readyForHandoff: false, _lowErrorStreak: 0, updated: 0 };
    };
    P._buildIntelligenceObservation = function () {
      var s = this.state || {};
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      // signal = breadth of live intelligence feeds (CISA KEV/Fed Reg FBI-CIA-NSA/Intercept/Lawfare/Bellingcat/OFAC + feed freshness)
      var feeds = s.feeds || [], fc = 0, newest = 0;
      if (Array.isArray(feeds)) {
        for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
      } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
      // companyCount = INTELLIGENCE-SECTOR ENTITIES (collection/analysis/integration contractors)
      var companyCount = (s.companies || []).length;
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: companyCount, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
    };
    P._computeIntelligencePredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _imJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var total = _imClamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
    };
    P._updateIntelligencePrior = function (prior, obs, lr) {
      return { expectedStress: _imClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _imClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _imClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    P._computeIntelligenceRegulation = function (im, obs, pe) {
      var gain = _imClamp(pe.novelty, 0.05, 0.95), inhib = _imClamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= IM_STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > IM_FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (im._lowErrorStreak || 0) + 1 : 0; im._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > IM_STALE_MS : false;
      var overconf = im.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };

    // ── RECURRENT STEP — the proof surface (state.intelligenceModel) the Civilization cockpit reads ──
    P._updateIntelligenceModel = function () {
      var im = this.state.intelligenceModel || this._neutralIntelligenceModel();
      var priorIn = im.prior;
      var obs = this._buildIntelligenceObservation();
      var pe = this._computeIntelligencePredictionError(priorIn, obs);
      var gainBlend = _imClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeIntelligenceRegulation(im, obs, pe);
      var readyForHandoff = (im.cycle > 0) && (predictedStress >= IM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;
      // ── K4 CREDIT ASSIGNMENT — routed through the central honest reward gate (window.LIMENK4.credit).
      //    Intelligence is NOT externalRewardEligible: it has no external realized-outcome label, so
      //    externalOutcome is ALWAYS null and its credit is SELF-CONSISTENCY CALIBRATION only
      //    (interpretive), NEVER reward. The gate enforces the preemption: external-reward(4) >
      //    phase-consistency(3) > call-consistency(2) > stress-consistency(1) > none. A realized thing2
      //    phase transition is SELF-CONSISTENCY (interpretive), never reward — even on the P3/P7 family.
      //    Pure math, no AI/network on the 30s cycle. One-cycle lag (reads the PRIOR cycle's
      //    intelligencePhaseDynamics / intelligenceOutcomeModel). Reversible via _actuation.phase.
      var _om = this.state.intelligenceOutcomeModel;
      var _lr = im.plasticity.learningRate;
      // thing2 realized phase transition: did a predicted transition actually occur over time. This is
      // SELF-CONSISTENCY calibration (interpretive), NOT external reward. validated => P3/P7 family gates
      // the phase-consistency TIER only. Live only when phase actuation is on (else transition is absent).
      var _pt = (this.state.intelligencePhaseDynamics || {}).transition;
      var _ptActive = !!(this._actuation && this._actuation.phase && _pt && _pt.hit !== null);
      // Signal built from what the brain already computed. externalOutcome MUST be null (not eligible).
      var _sig = {
        externalOutcome: null,                                              // NOT eligible: self-consistency only, never reward
        phaseValidated: !!(_pt && _pt.validated),                           // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
        phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,           // thing2 transition hit (interpretive self-consistency)
        callHitRate: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,   // TRUTH BRAKE ledger (self-prediction handle)
        callSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0,
        stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,          // stress self-prediction
        stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
      };
      var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
        ? window.LIMENK4.credit(_sig) : null;
      var _hit, _creditSource, _isReward;
      if (_k4) {
        _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
        _creditSource = _k4.creditSource;
        _isReward = !!_k4.isReward;                                         // ALWAYS false for intelligence (not externalRewardEligible)
      } else {
        // FALLBACK (gate absent) — prior credit behaviour preserved, same preemption, in-line. All tiers
        // here are self-consistency calibration (interpretive); none is ever reward.
        var _phaseReward = _ptActive && !!_pt.validated;
        var _fromLedger = !_phaseReward && !!(_om && typeof _om.callHitRate === 'number' && _om.samples >= 3);
        _hit = _phaseReward ? (_pt.hit ? 1 : 0)
          : _fromLedger ? _om.callHitRate
          : (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null;
        _creditSource = _phaseReward ? 'phase-consistency' : (_fromLedger ? 'call-consistency' : (_hit !== null ? 'stress-consistency' : 'none'));
        _isReward = false;                                                  // self-consistency only; never reward
      }
      if (_hit !== null) _lr = _imClamp(_lr * (1 + (1 - _hit)), IM_SLOW_RATE, 0.6);
      im._effectiveLearningRate = _lr;
      im._creditSource = _creditSource;
      im._creditIsReward = _isReward;                                       // honest flag: false unless a real external outcome fed the gate
      var nextPrior = this._updateIntelligencePrior(priorIn, obs, _lr);
      im.cycle += 1; im.observation = obs; im.predictionError = pe; im.predictedStress = predictedStress; im.regulation = reg; im.readyForHandoff = readyForHandoff; im.prior = nextPrior; im.updated = obs.timestamp;
      this.state.intelligenceModel = im;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: im.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      try { this._computeIntelligenceHigherLayers(); } catch (e) {}

      // ── K1-K8 NEURO-COMPLETION STACK (2026-07-13) — port of Energy's closed-loop K-stack, intelligence-native.
      //    Runs AFTER the recurrent model + higher layers settle (each K reads state.intelligenceModel /
      //    observation / regulation / diagnoses) and BEFORE the servo/brake/phase actuation, in the SAME
      //    K1..K8 order Energy uses. 100% DETERMINISTIC: pure computation over cached live state; NO AI/LLM
      //    fetch, ever. Each K COMPUTES and EXPOSES its signal on state (intelligenceAfferent/GainControl/
      //    SlowModel/OutcomeModel/PerceptionDepth/Attention/Inhibition/Homeostasis); none rewrites the
      //    validated scoring spine (stress/prior/diagnoses/opportunity output) — additive + reversible.
      try { this._computeIntelligenceNeuroLayers(); } catch (e) {}

      // ── ACTUATION (2026-07-13) — regulate-to-target servo + E/I brake + phase dynamics + self-audit.
      //    Computed AFTER the higher layers (the brake reads immune/conscience) and stored for CONSUMPTION
      //    next cycle by _checkDiagnosisActions (action-draft gate + refractory) and surfaceOpportunities
      //    (proportional E/I emission dampening + phase-coherence window). Each behind its _actuation flag;
      //    all deterministic, no AI, no writes to intelligence.json.
      try { if (this._actuation && this._actuation.servo) this._computeIntelligenceServo(); } catch (e) {}     // SERVO first (brake reads its emissionFactor)
      try { if (this._actuation && this._actuation.eiBrake) this._computeIntelligenceBrake(); } catch (e) {}   // E/I HALT/DAMPEN brake (reads servo + immune + conscience + regulation)
      try { if (this._actuation && this._actuation.phase) this._computeIntelligencePhaseDynamics(); } catch (e) {} // PHASE router + transition self-consistency calibration (stored for next cycle's K4 credit hook)
      try { this._computeIntelligenceRegulationAdvisories(); } catch (e) {}                                     // E/I balance read + self-audit (SPOF over the real edge graph)

      // COLLECTION POSTURE — collection-gap / threat-warning sub-portal layer (additive; BEFORE the DDP build
      // so the primary packet's promptView advertises it). Never touches the validated spine.
      try { this._buildIntelligenceCollectionPostureLayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
      // and one per diagnosis. Schema-only: never invents data. Consumed by the Civilization cockpit.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        im.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.intelligenceDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}

      // state.cognition — generic surface domain-console-brain.js reads for ANY brain.
      this.state.cognition = {
        domain: 'intelligence',
        intelligenceModel: im,
        model: { cycle: im.cycle, predictionError: im.predictionError, predictedStress: im.predictedStress, regulation: im.regulation },
        intelligenceImmune: this.state.intelligenceImmune || null,
        intelligenceAwareness: this.state.intelligenceAwareness || null,
        intelligenceConscience: this.state.intelligenceConscience || null,
        intelligenceIntuition: this.state.intelligenceIntuition || null,
        intelligenceSimulation: this.state.intelligenceSimulation || null,
        intelligenceExecutiveReport: this.state.intelligenceExecutiveReport || null,
        awareness: this.state.intelligenceAwareness || null,
        conscience: this.state.intelligenceConscience || null,
        immune: this.state.intelligenceImmune || null,
        intuition: this.state.intelligenceIntuition || null,
        servo: this.state.intelligenceServo || null,                         // actuated: regulate-to-target PI controller
        brake: this.state.intelligenceBrake || null,                         // actuated: E/I stop-circuit (halt/dampen/clear)
        phaseDynamics: this.state.intelligencePhaseDynamics || null,         // actuated: coherence router + P3/P7 transition self-consistency calibration (interpretive, never reward)
        regulation: this.state.intelligenceRegulation || null,               // E/I balance read + self-audit (SPOF)
        neuro: this.state.intelligenceNeuro || null,                         // K1-K8 neuro-completion stack (advisory, exposed)
        sceneLayer: this.state.collectionPostureLayer || null,
        collectionPostureLayer: this.state.collectionPostureLayer || null,
        treatments: this.state.treatments || [],
        diagnoses: this.state.diagnoses || [],
        opportunities: this.state.opportunities || []
      };
      return im;
    };

    P._computeIntelligenceHigherLayers = function () {
      this._computeIntelligenceImmune(); this._computeIntelligenceAwareness(); this._computeIntelligenceConscience(); this._computeIntelligenceIntuition();
      try { this._computeIntelligenceSimulation(); } catch (e) {}
      try { this._computeIntelligenceExecutiveReport(); } catch (e) {}
    };

    // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
    P._computeIntelligenceImmune = function () {
      var s = this.state, im = s.intelligenceModel || {}, reg = im.regulation || {}, ant = [];
      var bs = (typeof this._intelligenceBundleStates === 'function') ? this._intelligenceBundleStates() : [];
      bs.forEach(function (b) {
        if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
        if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
        if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
        if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      });
      var pe = (im.predictionError && im.predictionError.total) || 0;
      if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
      if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
      if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
      if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
      var _l1 = s._l1DepthCache;
      if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real intelligence-sector contractor tickers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.intelligenceImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: im.updated || null
      };
      return s.intelligenceImmune;
    };
    // ── H2 — awareness (narrative on collection gaps / observability / adversary posture) ──
    P._computeIntelligenceAwareness = function () {
      var s = this.state, im = s.intelligenceModel || {}, imm = s.intelligenceImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var pe = (im.predictionError && im.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      s.intelligenceAwareness = {
        version: 1, selfState: imm.immuneState === 'alert' ? 'guarded' : (im.regulation && im.regulation.state) || 'unknown',
        knowns: dxNames.slice(0, 6),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of collection/observability/adversary pressure, not validated', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        confidenceDrivers: ['regulation ' + ((im.regulation && im.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Intelligence: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((im.regulation && im.regulation.state) || '?') + ', immune=' + (imm.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: im.updated || null
      };
      return s.intelligenceAwareness;
    };
    // ── H3 — conscience (artifact readiness; INTELLIGENCE does INVESTABLE/RESEARCHABLE only — no patent/grant
    //    per 2026 rules; PLUS a dual-use / export-control veto (ITAR/EAR) on SIGINT/HUMINT/surveillance dx) ──
    P._computeIntelligenceConscience = function () {
      var s = this.state, im = s.intelligenceModel || {}, pe = (im.predictionError && im.predictionError.total) || 0, cautions = [];
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var sensitiveActive = active.some(function (d) { return d.id === 'CYBER_ESPIONAGE' || d.id === 'FOREIGN_INTERFERENCE' || d.id === 'MASS_SURVEILLANCE_SCANDAL'; });
      var imm = s.intelligenceImmune || {};
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      if (im.regulation && im.regulation.starving) cautions.push({ claim: 'opportunity-claim', reason: 'stress without grounded opportunity (starving)' });
      cautions.push({ claim: 'high-PE-collection-claim', reason: 'collection-posture claims require validated source evidence, not feed-driven inference' });
      var conscienceState = (imm.immuneState === 'alert' || (sensitiveActive && pe > 0.4)) ? 'restrictive' : (sensitiveActive || pe > 0.25) ? 'cautious' : 'open';
      var vetoes = [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); intelligence surfaces source-grounded collection/threat-warning briefs, not filings' }];
      if (sensitiveActive) vetoes.push({ claim: 'dual-use-export', reason: 'espionage/surveillance/foreign-interference diagnosis active — ITAR/EAR export-control risk (SIGINT/HUMINT collection equipment, surveillance/intercept systems, cryptologic tooling); no export-restricted claims' });
      var blockedClaims = ['patent-claim', 'grant-claim'];
      if (sensitiveActive) blockedClaims.push('export-restricted');
      s.intelligenceConscience = {
        version: 1, conscienceState: conscienceState,
        vetoes: vetoes, cautions: cautions.slice(0, 8),
        allowedClaims: ['source-summary', 'intelligence-collection-brief-with-warnings'],
        blockedClaims: blockedClaims,
        artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, exportReady: !sensitiveActive, note: 'patent/grant vetoed; investment/research allowed-with-warning; export-restricted (ITAR/EAR) claims vetoed while an espionage/surveillance/foreign-interference diagnosis is active' },
        reasons: ['overclaim prevention', 'interpretive-not-validated', 'dual-use / export-control conscientiousness'],
        lastCheckAt: im.updated || null
      };
      return s.intelligenceConscience;
    };
    // ── H4 — intuition (hunches on regime shifts in collection success / adversary tradecraft) ──
    P._computeIntelligenceIntuition = function () {
      var s = this.state, im = s.intelligenceModel || {}, reg = im.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'emerging regime shift in collection success / adversary tradecraft (prediction error rising) — new attack surface, novel deception, or a counterintelligence cycle entering feeds (CISA KEV surge, Intercept/Bellingcat disclosure spike, OFAC counterintel designations)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel intelligence stressor entering the feed (collection blind spot, espionage exposure, surveillance-oversight rupture, foreign influence campaign)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED' }); }); } });
      s.intelligenceIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), lastAt: im.updated || null };
      return s.intelligenceIntuition;
    };
    // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
    P._computeIntelligenceSimulation = function () {
      var s = this.state, im = s.intelligenceModel || {};
      var base = typeof s.stress === 'number' ? s.stress : 0;
      function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
      var scenarios = [
        { type: 'collection_blind_spot', hypothetical: true, assumption: 'a key target goes dark across SIGINT/HUMINT, opening a collection blind spot during a fast-moving crisis', simulatedStress: cl(base + 0.35), risk: 'signal blindness / collection gap (INTELLIGENCE_FAILURE)', intervention: 'multi-INT retasking / OSINT surge / partner-liaison sharing', falsifier: 'redundant collection channels restore coverage and warning timelines hold' },
        { type: 'espionage_penetration', hypothetical: true, assumption: 'an adversary penetrates a collection channel or recruits an insider, compromising sources and methods', simulatedStress: cl(base + 0.4), risk: 'compromised channel / adversarial penetration (CYBER_ESPIONAGE)', intervention: 'counterintelligence damage assessment / source protection / channel re-hardening', falsifier: 'CI review confirms no active penetration and channel integrity verifies clean' },
        { type: 'oversight_rupture', hypothetical: true, assumption: 'a bulk-collection program is exposed, triggering an oversight and legitimacy crisis', simulatedStress: cl(base + 0.3), risk: 'oversight failure / trust-boundary breach (MASS_SURVEILLANCE_SCANDAL)', intervention: 'minimization-procedure review / FISA-court transparency / IG audit', falsifier: 'oversight bodies confirm program lawfulness and public trust stabilizes' },
        { type: 'insider_leak', hypothetical: true, assumption: 'a cleared insider exfiltrates classified material to the press', simulatedStress: cl(base + 0.28), risk: 'leaked signals / institutional exposure (WHISTLEBLOWER_CRISIS)', intervention: 'insider-risk program / continuous-evaluation / data-loss-prevention', falsifier: 'damage contained, no further exfiltration, and clearance controls verify intact' },
        { type: 'foreign_influence_surge', hypothetical: true, assumption: 'a coordinated foreign influence operation floods the information environment ahead of an election', simulatedStress: cl(base + 0.32), risk: 'narrative manipulation / information contamination (FOREIGN_INTERFERENCE)', intervention: 'attribution / disinformation detection / inter-agency + platform coordination', falsifier: 'influence operation attributed and inoculated before measurable effect' },
        { type: 'analytic_distortion', hypothetical: true, assumption: 'groupthink / politicization degrades all-source assessment on a high-stakes question', simulatedStress: cl(base + 0.22), risk: 'analytic distortion / coordination failure (INTELLIGENCE_FAILURE)', intervention: 'red-teaming / structured analytic techniques / dissent channels', falsifier: 'alternative-analysis review confirms assessment robustness' }
      ];
      var sim = {
        version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
        simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
        simulatedDiagnoses: ['INTELLIGENCE_FAILURE', 'CYBER_ESPIONAGE', 'MASS_SURVEILLANCE_SCANDAL', 'FOREIGN_INTERFERENCE'], simulatedOpportunities: [],
        risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
        falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: im.updated || null
      };
      s.intelligenceSimulation = sim; return sim;
    };
    // ── H6 — executive self-report (compact status card) ──
    P._computeIntelligenceExecutiveReport = function () {
      var s = this.state, im = s.intelligenceModel || {}, imm = s.intelligenceImmune || {}, aw = s.intelligenceAwareness || {}, con = s.intelligenceConscience || {}, it = s.intelligenceIntuition || {}, sim = s.intelligenceSimulation || {};
      var bs = (typeof this._intelligenceBundleStates === 'function') ? this._intelligenceBundleStates() : [];
      var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
      var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var strongest = active[0] || (s.diagnoses || [])[0] || null;
      var pe = (im.predictionError && im.predictionError.total) || 0;
      var status = imm.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (im.regulation && im.regulation.starving) ? 'starving' : (im.regulation && im.regulation.state === 'surprised') ? 'surprised' : 'healthy';
      var rep = {
        version: 1, brainStatus: status,
        strongestDiagnosis: strongest ? strongest.id : null,
        strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
        confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
        regulationState: (im.regulation && im.regulation.state) || null, immuneState: imm.immuneState || null,
        awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
        intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
        collectionDecision: (im.regulation && im.regulation.state === 'calm' && status === 'healthy') ? 'posture-nominal' : (status === 'starving' || status === 'surprised') ? 'posture-elevated' : 'posture-watch',
        artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
        nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses (ensure espionage/surveillance/foreign-interference sources are current)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (CISA KEV exploit velocity, ODNI/GAO oversight findings, Intercept/Bellingcat disclosures, OFAC counterintel designations)',
        lastReportAt: im.updated || null
      };
      s.intelligenceExecutiveReport = rep; return rep;
    };
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — INTELLIGENCE NEURO-COMPLETION LAYERS (intelligence-local, additive, reversible).
  // Direct port of Energy's K1-K8 closed-loop stack, reading THIS domain's state/edges:
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (self-consistency / truth-brake calibration — NO external reward),
  //   K5 deep-perception depth, K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // ADVISORY BY DESIGN: every layer COMPUTES and EXPOSES its signal on state; none rewires the
  // validated scoring spine (stress, prior update, opportunity output). Reads cached state only;
  // adds NO network / AI / LLM call. Never fabricates evidence. Uses the module-scope IM_* constants
  // (IM_SLOW_RATE / IM_STRESS_FLOOR / IM_FLOOD_CAP / _imClamp) already defined above.
  // ════════════════════════════════════════════════════════════════════════════
  var IK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized samples
  var IK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point

  // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure
  // (getExternalPressure, base-capped at 0.3) and the per-source weighted magnitude of the
  // _externalSignals buffer. Intelligence folds external pressure into normalizeSignals as
  // trust-boundary / adversarial-penetration conditions; this exposes the integrated afferent read.
  IntelligenceBrain.prototype._computeIntelligenceAfferent = function () {
    var s = this.state, im = s.intelligenceModel || {};
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
      integrated: true,                                           // K1 — afferent read closed via normalizeSignals ext-pressure conditions
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'Received cross-domain pressure is folded into normalizeSignals (extPressure -> trust_boundary_breach / adversarial_penetration conditions). K1 exposes the integrated afferent read.',
      lastAfferentAt: im.updated || now
    };
    s.intelligenceAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. reg.gain/inhibition set the graded output modulation;
  // this shows the gain-scaled ranked cut it implies on the opportunity set (advisory — the E/I
  // brake, not this, applies the actual emission dampening).
  IntelligenceBrain.prototype._computeIntelligenceGainControl = function () {
    var s = this.state, im = s.intelligenceModel || {}, reg = im.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : _imClamp(1 - (reg.inhibition || 0), 0.2, 1);
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: Math.round(outputScale * 1000) / 1000,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,                        // gain-scaled ranked cut (advisory)
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend in _updateIntelligenceModel)'],
      unappliedTargets: ['opportunity output (E/I brake owns emission dampening)', 'stress', 'treatment surfacing'],
      shadow: true,
      note: 'ADVISORY: exposes the gain-scaled opportunity cut. Actual emission dampening is owned by the E/I brake (_applyIntelligenceEmissionBrake).',
      lastGainAt: im.updated || Date.now()
    };
    s.intelligenceGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity (IM_SLOW_RATE). Maintains a PARALLEL slow-weight
  // track that never touches im.prior; fast-vs-slow divergence is a real regime-shift indicator.
  IntelligenceBrain.prototype._consolidateIntelligenceSlowModel = function () {
    var s = this.state, im = s.intelligenceModel || {}, obs = im.observation || null;
    var slow = s.intelligenceSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: IM_SLOW_RATE, note: 'parallel slow-weight track (IM_SLOW_RATE); does NOT touch im.prior'
    };
    if (obs) {
      var r = IM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _imClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _imClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (im.prior && typeof im.prior.expectedStress === 'number') ? im.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;             // fast prior pulled far from slow baseline
    slow.updated = im.updated || Date.now();
    s.intelligenceSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning: SELF-CONSISTENCY / TRUTH-BRAKE calibration. Compares each cycle's
  // predictedStress against the NEXT cycle's realized stress (online forward-prediction). This is a
  // realized-stress self-prediction check ONLY — NOT an external / dopaminergic reward. The validated
  // phase-transition credit hook lives separately in _updateIntelligenceModel; K4 never fabricates a
  // reward. Measurement + calibration read; exposed on state, does not rewrite the learning rate here.
  IntelligenceBrain.prototype._scoreIntelligenceOutcomes = function () {
    var s = this.state, im = s.intelligenceModel || {};
    var buf = this._intelligenceOutcomeBuffer = this._intelligenceOutcomeBuffer || [];
    var obs = im.observation || null;
    if (this._intelligencePrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._intelligencePrevPrediction, realized: obs.stress, err: Math.abs(this._intelligencePrevPrediction - obs.stress) });
      if (buf.length > IK_OUTCOME_BUFFER) buf.shift();
    }
    this._intelligencePrevPrediction = (typeof im.predictedStress === 'number') ? im.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the self-forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                    // fraction within 0.1 of realized
      callHitRate: n ? Math.round((hits / n) * 100) / 100 : null,               // truth-brake calibration handle (self-prediction, not reward)
      loopType: 'online-continuous self-consistency (predicted-vs-next-realized stress); TRUTH BRAKE, not an external reward',
      creditAssignmentActive: (n >= 5),
      effectiveLearningRate: (im._effectiveLearningRate) || null,
      note: 'SELF-CONSISTENCY: measures whether this brain’s own stress self-prediction is realized. No dopaminergic/external reward is fabricated; the validated P3/P7 phase-transition credit hook is separate (_updateIntelligenceModel).',
      lastOutcomeAt: im.updated || Date.now()
    };
    s.intelligenceOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. Aggregates the depth the brain HAS (L1 branch scan + the
  // collection-posture / threat-warning sub-portal, no new fetches) and estimates the portalError
  // (blocked/synthetic vs admissible content) the recurrent model would otherwise zero out.
  IntelligenceBrain.prototype._computeIntelligencePerceptionDepth = function () {
    var s = this.state, im = s.intelligenceModel || {};
    var l1 = s._l1DepthCache || null;
    var cp = s.intelligenceCollectionPostureLayer || s.collectionPostureLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var cpCount = (cp && (cp.count || (cp.diagnoses && cp.diagnoses.length))) || 0;
    var cpLoaded = !!(cp && cp.loaded);
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: '~98% synthetic (immune-blocked)' },
      { level: 'CP', name: 'collection-posture-subportal', status: cpLoaded ? 'loaded' : 'absent', activeCount: (cp && cp.activeCount) || 0 }
    ];
    var loadedDepth = cpLoaded ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + cpCount;
    var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'Perception stops at L1 + the collection-posture sub-portal (L2 quarantined as mad-lib/synthetic); no new fetches. portalErrorEstimate = blocked/(admissible+blocked).',
      lastDepthAt: im.updated || Date.now()
    };
    s.intelligencePerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + novelty, plus an
  // operator attention-focus boost) and names focus vs suppressed, without gating the pipeline.
  IntelligenceBrain.prototype._computeIntelligenceAttention = function () {
    var s = this.state, im = s.intelligenceModel || {}, reg = im.regulation || {};
    var pe = (im.predictionError && im.predictionError.total) || 0;
    var rb = (typeof this._readRequestBiases === 'function') ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = ((rb && rb.attentionFocus) || []).map(function (f) { return String(f).toLowerCase(); });
    var scored = (s.diagnoses || []).map(function (d) {
      var sal = (d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1;
      var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += 0.5;   // operator steer: attention focus boost
      return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
    }).sort(function (a, b) { return b.salience - a.salience; });
    var at = {
      version: 1,
      driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
      focus: scored.slice(0, 3),
      suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
      broadenUnderSurprise: reg.state === 'surprised',
      note: 'ADVISORY: top-down salience ranking over active diagnoses; does not gate the pipeline.',
      lastAttentionAt: im.updated || Date.now()
    };
    s.intelligenceAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). reg.inhibition implies a winner-take-most ranking among
  // competing active diagnoses; this exposes the winner and the suppress-weight on each competitor.
  IntelligenceBrain.prototype._computeIntelligenceInhibition = function () {
    var s = this.state, im = s.intelligenceModel || {}, reg = im.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most ranking implied by reg.inhibition among competing active diagnoses.',
      lastInhibitionAt: im.updated || Date.now()
    };
    s.intelligenceInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Maintains an adaptive stress baseline (Turrigiano-style
  // synaptic scaling) alongside the fixed IM_STRESS_FLOOR, without replacing the fixed floor.
  IntelligenceBrain.prototype._computeIntelligenceHomeostasis = function () {
    var s = this.state, im = s.intelligenceModel || {};
    var hist = (s.memory && s.memory.stressHistory) || [];
    if ((!hist || !hist.length) && s.memory && Array.isArray(s.memory.outcomeLog)) {
      hist = s.memory.outcomeLog.map(function (r) { return { stress: r.stress }; });   // fall back to the outcome log's realized stress
    }
    var win = (hist || []).slice(-IK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                              // adaptive set-point vs fixed IM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: IM_STRESS_FLOOR,                                 // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                                // synaptic-scaling multiplier
      samples: n,
      note: 'ADVISORY: adaptive stress baseline (synaptic scaling) alongside the fixed IM_STRESS_FLOOR; consumed by the servo as the allostatic deviation term.',
      lastHomeostasisAt: im.updated || Date.now()
    };
    s.intelligenceHomeostasis = hm; return hm;
  };

  // Orchestrator — runs all eight K-layers in the SAME K1..K8 order Energy uses, then rolls a compact
  // summary onto state.cognition ADDITIVELY (new key `neuro`; existing cognition keys untouched). Called
  // from _updateIntelligenceModel AFTER the higher layers and BEFORE the servo/brake/phase actuation.
  IntelligenceBrain.prototype._computeIntelligenceNeuroLayers = function () {
    this._computeIntelligenceAfferent();          // K1 - afferent inter-brain input
    this._computeIntelligenceGainControl();       // K2 - neuromodulatory gain application
    this._consolidateIntelligenceSlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreIntelligenceOutcomes();            // K4 - outcome / credit learning (self-consistency / truth-brake)
    this._computeIntelligencePerceptionDepth();   // K5 - deep hierarchical perception
    this._computeIntelligenceAttention();         // K6 - attention / selective routing
    this._computeIntelligenceInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeIntelligenceHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'advisory-exposed',                 // K-loops computed + exposed each cycle; scoring spine untouched
      afferent: s.intelligenceAfferent || null,
      gainControl: s.intelligenceGainControl || null,
      slowModel: s.intelligenceSlowModel || null,
      outcomeModel: s.intelligenceOutcomeModel || null,
      perceptionDepth: s.intelligencePerceptionDepth || null,
      attention: s.intelligenceAttention || null,
      inhibition: s.intelligenceInhibition || null,
      homeostasis: s.intelligenceHomeostasis || null
    };
    s.intelligenceNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE COGNITION PARITY — fallback loaders, source-bundle machinery, L1 mad-lib
  // scan, collection-posture / threat-warning sub-portal layer, and the 8-section DomainDiagnosisPacket the
  // Civilization cockpit consumes. Mirrors defense/technology STRUCTURE exactly; only the
  // CONTENT is intelligence (collection SIGINT/HUMINT/GEOINT/OSINT, all-source analysis, espionage
  // & counterintelligence, surveillance & reconnaissance, threat warning, covert action,
  // information/influence ops, clearance & insider risk). Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var INT_DDP_SCHEMA_VERSION = 'intelligence-ddp-1';
  function _intDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _intDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_intDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Fallback: real intelligence-sector entities from command-board-data (state.companies starved). One-shot. ──
  IntelligenceBrain.prototype._loadIntelligenceCommandBoardCompanies = function () {
    var self = this;
    if (self._cbIntelligenceCompanies) return;            // one-shot
    self._cbIntelligenceCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbIntelligenceCompanies = arr
            .filter(function (x) { return x && x.d === 'intelligence' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
          // Real-ticker fallback so opportunity discovery is grounded even if the board lacks
          // intelligence rows. These are real intelligence-sector entities (collection/analysis/
          // integration contractors + surveillance/investigation analytics).
          if (!self._cbIntelligenceCompanies.length) {
            self._cbIntelligenceCompanies = [
              { name: 'Palantir Technologies', ticker: 'PLTR' }, { name: 'Booz Allen Hamilton', ticker: 'BAH' }, { name: 'Leidos', ticker: 'LDOS' },
              { name: 'CACI International', ticker: 'CACI' }, { name: 'SAIC', ticker: 'SAIC' }, { name: 'KBR', ticker: 'KBR' },
              { name: 'Verint Systems', ticker: 'VRNT' }, { name: 'NICE Ltd', ticker: 'NICE' }, { name: 'Verisk Analytics', ticker: 'VRSK' }
            ];
          }
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Distress signals come ONLY from the validated Thing pipeline. One-shot. ──
  IntelligenceBrain.prototype._loadIntelligenceBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                  // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=intelligence')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.publishable) return;
          var m = {};
          j.publishable.forEach(function (s) { if (s.ticker) m[s.ticker] = s; });
          self._pubSignals = m;                    // {} today (gate abstains on degenerate data)
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Canonical diagnosis resolution. Prefers window.LIMENArtifactSourceIndex.aliases(),
  //    else INTELLIGENCE_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var INTELLIGENCE_DIAGNOSIS_ALIASES = {
    INTELLIGENCE_FAILURE:      { target: 'INTELLIGENCE_FAILURE', reviewStatus: null, risk: 'low', note: 'canonical to self (collection/analysis sense)' },
    MASS_SURVEILLANCE_SCANDAL: { target: 'MASS_SURVEILLANCE_SCANDAL', reviewStatus: null, risk: 'low', note: 'canonical to self (oversight/bulk-collection sense)' },
    CYBER_ESPIONAGE:           { target: 'CYBER_ESPIONAGE', reviewStatus: null, risk: 'low', note: 'canonical to self (espionage/counterintelligence sense; cyber tooling is a coupling, not the identity)' },
    WHISTLEBLOWER_CRISIS:      { target: 'WHISTLEBLOWER_CRISIS', reviewStatus: null, risk: 'low', note: 'canonical to self (insider-risk / leaked-signals sense)' },
    FOREIGN_INTERFERENCE:      { target: 'FOREIGN_INTERFERENCE', reviewStatus: null, risk: 'low', note: 'canonical to self (influence-ops / deception sense)' }
  };
  IntelligenceBrain.prototype._resolveIntelligenceCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = INTELLIGENCE_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target && target !== dxId) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: (target || dxId), aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  IntelligenceBrain.prototype._loadIntelligenceDiagnosisBundles = function () {
    var self = this;
    if (self._intelligenceBundleLoadPromise) return self._intelligenceBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['INTELLIGENCE_FAILURE', 'MASS_SURVEILLANCE_SCANDAL', 'CYBER_ESPIONAGE', 'WHISTLEBLOWER_CRISIS', 'FOREIGN_INTERFERENCE'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveIntelligenceCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._intelligenceBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._intelligenceBundleLoadPromise;
  };

  // ── _intelligenceBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  IntelligenceBrain.prototype._intelligenceBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveIntelligenceCanonicalDiagnosis(d.id);
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

  // ── L1 portal mad-lib scan. L1 treatments are fixed-verb templates; quarantined from
  //    evidence. Only real intelligence-sector contractor tickers surface (relevance-unverified). ──
  var INTELLIGENCE_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Harden|Collect|Analyze|Surveil|Attribute|Detect|Counter)\b/;
  IntelligenceBrain.prototype._isIntelligenceMadLibTreatment = function (label) { return !label || INTELLIGENCE_MADLIB_VERB.test(String(label)); };

  IntelligenceBrain.prototype._loadIntelligenceL1PortalDepth = function () {
    var self = this;
    if (self._intelligenceL1LoadPromise) return self._intelligenceL1LoadPromise;
    var BRANCH = {
      INTELLIGENCE_FAILURE: ['all_source_analysis', 'osint', 'humint'],
      MASS_SURVEILLANCE_SCANDAL: ['signals_intelligence', 'oversight', 'privacy'],
      CYBER_ESPIONAGE: ['cyber_counterintelligence', 'incident_response', 'threat_intelligence'],
      WHISTLEBLOWER_CRISIS: ['insider_risk', 'clearance', 'data_loss_prevention'],
      FOREIGN_INTERFERENCE: ['influence_operations', 'attribution', 'geoint']
    };
    self._intelligenceL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._intelligenceL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/intelligence_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isIntelligenceMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'intelligence_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only intelligence-sector contractor tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.intelligenceModel && self.state.intelligenceModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._intelligenceL1LoadPromise;
  };

  // ── COLLECTION-POSTURE / THREAT-WARNING sub-portal layer (counterpart to defense's readiness;
  //    energy's data-center; technology's innovation). Collection coverage by INT discipline + blind-spot
  //    map + counterintelligence/threat-warning posture = the canonical intelligence sub-portal: real-content,
  //    source-anchored (ODNI/GAO/CISA/Bellingcat) collection diagnoses + treatments. NEVER merged into the
  //    validated spine; never fabricated. ──
  IntelligenceBrain.prototype._loadIntelligenceSublayer = function () {
    var self = this;
    if (self._collectionLoadPromise) return self._collectionLoadPromise;
    // Prefer a dedicated intelligence-collection-index.json; fall back to an intelligence_collection sub-portal.
    // Both share the issues/activations shape. Graceful 404.
    self._collectionLoadPromise = fetch('/assets/data/intelligence-collection-index.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/intelligence_collection.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._collectionPortal = null; return null; }
        self._collectionPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Collection Posture & Threat Warning' };
        return self._collectionPortal;
      })
      .catch(function () { self._collectionPortal = null; return null; });
    return self._collectionLoadPromise;
  };

  IntelligenceBrain.prototype._buildIntelligenceCollectionPostureLayer = function () {
    var self = this;
    var sp = self._collectionPortal;
    if (!sp || !sp.issues || !sp.issues.length) {
      self.state.collectionDiagnoses = [];
      self.state.collectionTreatments = [];
      self.state.intelligenceCollectionDomainDiagnosisPackets = [];
      self.state.intelligenceCollectionPostureLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], collectionPostureState: 'unknown', note: 'intelligence collection-posture/threat-warning sub-portal not loaded (offline or fetch failed); ODNI/GAO/CISA/Bellingcat real-source index expected' };
      self.state.collectionPostureLayer = self.state.intelligenceCollectionPostureLayer;
      return self.state.intelligenceCollectionPostureLayer;
    }
    var conditions = self._activeConditions || [];
    // 1) diagnoses — same condition-match logic as the canonical spine
    var diagnoses = sp.issues.map(function (iss) {
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
        source: 'collection', tier: 'real-content-unbundled', branch: 'collection'
      };
    });
    // 2) treatments — pull from collection node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (sp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'collection_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'collection', madLib: self._isIntelligenceMadLibTreatment ? self._isIntelligenceMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.collectionDiagnoses = diagnoses;
    self.state.collectionTreatments = treatments;
    // posture state — blind / monitoring / aware / overexposed derived from stress + active collection diagnoses
    var stress = typeof self.state.stress === 'number' ? self.state.stress : 0;
    var activeCollection = diagnoses.filter(function (d) { return d.active; }).length;
    var collectionPostureState = (stress >= 0.65 || activeCollection >= 3) ? 'overexposed' : (stress >= 0.45 || activeCollection >= 2) ? 'aware' : (stress >= 0.25 || activeCollection >= 1) ? 'monitoring' : 'blind';
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.intelligenceCollectionPostureLayer = {
      loaded: true,
      portalTitle: sp.title,
      count: diagnoses.length,
      activeCount: activeCollection,
      collectionPostureState: collectionPostureState,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveIntelligenceCanonicalDiagnosis ? self._resolveIntelligenceCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'collection', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (collection-posture/threat-warning) sub-portal diagnoses for the live collection surface (coverage by INT discipline SIGINT/HUMINT/GEOINT/OSINT, blind-spot map, counterintelligence posture, threat-warning readiness) anchored to ODNI/GAO/CISA/Bellingcat; SEPARATE from the validated diagnosis spine; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    self.state.collectionPostureLayer = self.state.intelligenceCollectionPostureLayer;
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.intelligenceCollectionDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.intelligenceCollectionPostureLayer;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  //    Mirrors defense/technology's _buildDomainDiagnosisPacket exactly; only the CONTENT is intelligence. ──
  IntelligenceBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var im = s.intelligenceModel || {};
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

    var _canon = this._resolveIntelligenceCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'intelligence',
      diagnosisId: dxId,
      canonicalDiagnosisId: _canon.canonicalDiagnosisId,   // alias map or canonical-to-self
      aliasUsed: _canon.aliasUsed,
      aliasReviewStatus: _canon.aliasReviewStatus,          // human-approved | corpus-aliased | null
      aliasRisk: _canon.aliasRisk,
      aliasNote: _canon.aliasNote,
      label: dx ? (dx.label || dx.id || null) : null,
      phase: s.phase || null,
      confidence: (dx && typeof dx.relevance === 'number') ? dx.relevance : (typeof s.confidence === 'number' ? s.confidence : null)
    };
    // Real source bundle for this canonical id (shipped only when it exists; NEVER fabricated).
    var _bundle = (this._bundleCache && this._bundleCache[identity.canonicalDiagnosisId]) || null;
    var _bundleKnown = !!(this._bundleStatusMap && Object.prototype.hasOwnProperty.call(this._bundleStatusMap, identity.canonicalDiagnosisId));
    // patent lane retired (investment + research only) — read the research-papers lane instead
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
      intelligenceModel: { version: im.version || null, cycle: (typeof im.cycle === 'number' ? im.cycle : null) },
      predictionError: im.predictionError || null,
      regulationState: (im.regulation && im.regulation.state) || null,
      prior: im.prior || null,
      observation: im.observation || null,
      plasticity: im.plasticity || null,
      readyForHandoff: im.readyForHandoff === true
    };
    // Domain-identity portal fields are KNOWN facts (this IS the intelligence root).
    var rootId = (portal && portal.domainId) || 'intelligence';
    var rootTitle = (portal && portal.title) || 'Intelligence';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'intelligence',
      portalTitle: rootTitle,
      depth: 0,                               // brain operates at the root level only
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      l1Depth: (s._l1DepthCache && s._l1DepthCache.byDiagnosis && s._l1DepthCache.byDiagnosis[dxId]) || (s._l1DepthCache ? { branchesScanned: 0, realCompanyTickers: [], realTreatments: 0, madLibTreatments: 0, admitted: false, reason: 'no L1 branch mapped for this diagnosis' } : null)
    };
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    var evidenceAnchors = _bArr('evidenceAnchors');   // REAL bundle anchors only (empty if no bundle)
    var missingEv = [];
    if (!evidenceAnchors.length) missingEv.push('evidenceAnchors');
    if (!citationHints.length) missingEv.push('citationHints');
    var evidence = {
      sourceFeeds: sourceFeeds,
      evidenceAnchors: evidenceAnchors,
      citationHints: citationHints,
      bundleStatus: bundleStatus,
      bundleResolution: bundleResolution,
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'investments', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
      missingEvidence: missingEv
    };
    // Human-authoring intake: for external-source bundles missing candidates, emit structured
    // empty slots (what each needs + which INTELLIGENCE primary source) rather than fabricating.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      INTELLIGENCE_FAILURE: 'ODNI Annual Threat Assessment / GAO oversight reports / 9-11 & WMD commission findings / congressional intelligence-committee reviews / RUSI/IISS analysis',
      MASS_SURVEILLANCE_SCANDAL: 'FISA-court opinions / PCLOB reports / IG/IC audits / EFF & ACLU documentation / Lawfare surveillance-law analysis',
      CYBER_ESPIONAGE: 'CISA Known Exploited Vulnerabilities / NSA-CISA advisories / MITRE ATT&CK / Mandiant/CrowdStrike threat reports / DOJ counterintelligence indictments',
      WHISTLEBLOWER_CRISIS: 'IG whistleblower-disclosure records / Insider Threat program (NITTF) guidance / The Intercept reporting / continuous-evaluation / DLP audit data',
      FOREIGN_INTERFERENCE: 'ODNI election-security assessments / Bellingcat OSINT investigations / OFAC interference designations / platform threat reports / EU DisinfoLab'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete collection/analysis/counterintelligence method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific platform/program/tradecraft embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / intelligence-oversight source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    var _con = s.intelligenceConscience || {};
    var _exportReady = _con.artifactReadinessDecision ? (_con.artifactReadinessDecision.exportReady !== false) : true;
    // Lanes are INVESTABLE (intelligence-sector contractors / collection-analysis firms) / RESEARCHABLE (collection briefs).
    // patent/grant are VETOED by conscience (lanes retired 2026-06-21); export-restricted vetoed on espionage/surveillance/foreign-interference dx.
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      exportReady: _exportReady,                                // false while an espionage/surveillance/foreign-interference diagnosis is active (ITAR/EAR)
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _intDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _intDdpCompleteness(brainState, ['intelligenceModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _intDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _intDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _intDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _intDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _intDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _imf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_intDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _imf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _imf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _imf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _imf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < IM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');
    if (!_exportReady) warnings.push('export-restricted claims vetoed (ITAR/EAR dual-use export-control risk; espionage/surveillance/foreign-interference diagnosis active)');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

    // Prompt-facing trimming/prioritization. FULL data above is preserved; this is a bounded,
    // diagnosis-relevant subset for the finalizer prompt. Never trims scalars/warnings.
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
        'diagnosis-specific bundle anchors preferred over generic intelligence evidence',
        'official/primary sources retained (ODNI/GAO/CISA/Bellingcat/OFAC/Intercept where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.intelligenceImmune ? ['immune: ' + s.intelligenceImmune.immuneState + ' (sev ' + s.intelligenceImmune.severity + ', ' + (s.intelligenceImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.intelligenceConscience && s.intelligenceConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.intelligenceConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // higher-layer compact summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.intelligenceImmune ? { immuneState: s.intelligenceImmune.immuneState, severity: s.intelligenceImmune.severity, antigenCount: (s.intelligenceImmune.antigens || []).length, quarantines: s.intelligenceImmune.quarantines, blockedFromTraversal: s.intelligenceImmune.blockedFromTraversal, allowedWithWarning: s.intelligenceImmune.allowedWithWarning } : null,
      awarenessSummary: s.intelligenceAwareness ? { selfNarrative: s.intelligenceAwareness.selfNarrative, knowns: (s.intelligenceAwareness.knowns || []).length, uncertainties: (s.intelligenceAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.intelligenceConscience ? { conscienceState: s.intelligenceConscience.conscienceState, blockedClaims: s.intelligenceConscience.blockedClaims, artifactReadinessDecision: s.intelligenceConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.intelligenceIntuition ? s.intelligenceIntuition.hunches : null,
      scenarioSummary: s.intelligenceSimulation ? (s.intelligenceSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.intelligenceExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // COLLECTION POSTURE — collection-gap / threat-warning sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      collectionSummary: s.intelligenceCollectionPostureLayer && s.intelligenceCollectionPostureLayer.loaded ? { count: s.intelligenceCollectionPostureLayer.count, activeCount: s.intelligenceCollectionPostureLayer.activeCount, collectionPostureState: s.intelligenceCollectionPostureLayer.collectionPostureState, diagnoses: s.intelligenceCollectionPostureLayer.diagnoses, note: s.intelligenceCollectionPostureLayer.note } : null
    };

    return {
      schemaVersion: INT_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (im.updated || null),
        schemaVersion: INT_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.intelligenceImmune || null,
        awareness: s.intelligenceAwareness || null,
        conscience: s.intelligenceConscience || null,
        intuition: s.intelligenceIntuition || null,
        simulation: s.intelligenceSimulation || null,
        executiveReport: s.intelligenceExecutiveReport || null
      }
    };
  };

  // ══════════════════════════════════════════════════════════════════════
  // ACTUATION METHODS (ported + adapted from energy-brain.js; read INTELLIGENCE's own state/edges)
  // ══════════════════════════════════════════════════════════════════════

  // ── REGULATE-TO-TARGET SERVO (actuated, servo). Neuro Ref XIII.1 (E/I: inhibition scales with drive) +
  //    V.2/XII (set-point homeostasis/allostasis). Real sensor->controller->effector->feedback loop:
  //    sensor = drive vs current inhibition; controller = PI (fast proportional + bounded slow integral,
  //    the HPA fast+slow arms); effector = a proportional dampening of emission the E/I brake consumes.
  //    Additive, reversible; only ADDS braking (never disinhibits); never rewrites stress/scoring. ──
  IntelligenceBrain.prototype._computeIntelligenceServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, im = s.intelligenceModel || {}, reg = im.regulation || {};
    // SENSOR: excitatory drive (stress + how many conditions/diagnoses fire at once) vs current inhibition
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // the live regulation term
    var FLOOR = 0.15;
    // TARGET (allostatic set-point): inhibition must track drive (E/I), and rise with deviation above the
    // adaptive baseline (generic K-stack homeostasis; falls back to the model prior). regulate-TO-target.
    var homeo = (s.domainNeuro && s.domainNeuro.homeostasis) || null;
    var deviation = Math.max(0, (homeo && typeof homeo.deviation === 'number') ? homeo.deviation : (stress - ((im.prior && im.prior.expectedStress) || 0.5)));
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                              // >0 => under-braked for the drive/regime
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));             // EFFECTOR: proportional dampening
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.intelligenceServo = servo; return servo;
  };

  // ── E/I HALT/DAMPEN BRAKE (actuated, eiBrake). The governor layers (immune/conscience/regulation)
  //    previously only ANNOTATED danger; this converts them into an actual stop-circuit, and folds in the
  //    servo's PROPORTIONAL E/I emissionFactor (Neuro Ref XIII.1) so inhibition that does not track drive
  //    raises the brake continuously, not just in discrete steps. Consumed next cycle by
  //    _checkDiagnosisActions (action drafts) and _applyIntelligenceEmissionBrake (opportunities). ──
  IntelligenceBrain.prototype._computeIntelligenceBrake = function () {
    var s = this.state, im = s.intelligenceModel || {}, reg = im.regulation || {};
    var imm = s.intelligenceImmune || {}, con = s.intelligenceConscience || {};
    var diags = s.diagnoses || [];
    var activeUnblocked = diags.filter(function (d) { return d.active && !d.blocked; });
    var reasons = [];
    if (imm.immuneState === 'alert') reasons.push({ code: 'immune-alert', severity: 'halt', detail: 'immune severity ' + (imm.severity || '?') });
    if (reg.stale) reasons.push({ code: 'stale-feeds', severity: 'halt', detail: 'feeds older than staleness window' });
    if (diags.length && activeUnblocked.length === 0) reasons.push({ code: 'no-active-diagnosis', severity: 'halt', detail: 'no active unblocked diagnosis' });
    var pe = (im.predictionError && im.predictionError.total) || 0;
    if (pe > 0.4) reasons.push({ code: 'prediction-error-spike', severity: 'dampen', detail: 'predictionError ' + (Math.round(pe * 1000) / 1000) });
    if (reg.flooding) reasons.push({ code: 'opportunity-flood', severity: 'dampen', detail: 'opportunity count above flood cap' });
    if (con.conscienceState === 'restrictive' && con.artifactReadinessDecision && !con.artifactReadinessDecision.researchReady && !con.artifactReadinessDecision.investmentReady) reasons.push({ code: 'conscience-no-lane', severity: 'dampen', detail: 'no artifact lane cleared by conscience' });
    // E/I proportional term from the servo (Neuro Ref XIII.1)
    var servo = s.intelligenceServo || null, eiFactor = 1;
    if (this._actuation && this._actuation.eiBrake && servo) {
      if (typeof servo.emissionFactor === 'number') eiFactor = servo.emissionFactor;
      if (servo.state === 'runaway-risk') reasons.push({ code: 'ei-imbalance', severity: 'dampen', detail: 'inhibition ' + servo.inhibition + ' below target ' + servo.target + ' (drive ' + servo.drive + ')' });
    }
    var halt = reasons.some(function (r) { return r.severity === 'halt'; });
    var dampen = reasons.some(function (r) { return r.severity === 'dampen'; });
    var level = halt ? 'halt' : dampen ? 'dampen' : 'clear';
    var brake = {
      version: 1, level: level, engaged: halt, dampen: dampen, reasons: reasons,
      suppressActions: halt, suppressOpportunities: halt,
      confidencePenalty: Math.min(halt ? 0 : dampen ? 0.5 : 1, eiFactor),   // discrete governor penalty blended with proportional E/I (strongest brake wins)
      eiFactor: (Math.round(eiFactor * 1000) / 1000),
      note: level === 'clear' ? 'stop-circuit clear — emission allowed'
        : level === 'halt' ? 'STOP-CIRCUIT ENGAGED — action emission halted, opportunities held'
        : 'stop-circuit dampening — confidence reduced (discrete governor blended with proportional E/I)',
      lastBrakeAt: im.updated || Date.now()
    };
    s.intelligenceBrake = brake; return brake;
  };

  // ── PHASE-COHERENCE ROUTER + PHASE-TRANSITION SELF-CONSISTENCY (actuated, phase). Router: couple to
  //    co-phased, stressed peers (patent Section 3.4 Loop 1 coupling matrix M; thing2 lineage) — advisory.
  //    Credit: a realized phase TRANSITION is SELF-CONSISTENCY CALIBRATION (interpretive), NEVER external
  //    reward — even on the Thing1-validated P3/P7 family. The P3/P7 family only gates the phase-consistency
  //    TIER in the central K4 gate (window.LIMENK4.credit); it never makes the signal a reward.
  //    Deterministic; no AI; no writes to intelligence.json. Stored for next cycle's K4 credit hook. ──
  // ── THING2 KERNEL PHASE (pure math, guarded). Per-cycle: append the domain's primary STRESS scalar
  //    (finalStress/stress; up=bad) to the persistent series, cap at 60, persist, then run the REAL Thing2
  //    kernel over it to derive an interpretive P0-P10 phase. Deterministic (no network/AI). On any failure
  //    or when the adapter/history (<8) is unavailable, _kernelPhase = null and the caller falls back to
  //    s.phase. seriesSource = STRESS (positive:false) because the scalar rises with distress. ──
  IntelligenceBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    var scalar = (typeof s.finalStress === 'number') ? s.finalStress
               : (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:intelligence', JSON.stringify(this._phaseSeries));
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

  IntelligenceBrain.prototype._computeIntelligencePhaseDynamics = function () {
    var s = this.state;
    // Refresh the Thing2 kernel phase from this domain's stress trajectory (pure math, guarded).
    try { this._updatePhaseKernel(); } catch (e) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
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
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 kernel phase (interpretive, from this domain's stress trajectory) for BOTH the
    // coherence router and the phase-transition self-consistency calibration; fall back to the existing s.phase when the kernel
    // is unavailable (adapter missing / history < 8 / error) — the fallback path is unchanged.
    var myPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);

    // (A) COHERENCE ROUTER — couple to co-phased, stressed domains (advisory)
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'intelligence') return;
        var d = doms[k] || {};
        var op = norm(d.brainPhase || d.phase || (d.brain && d.brain.phase));
        var st = (typeof d.brainStress === 'number') ? d.brainStress : (typeof d.stress === 'number' ? d.stress : 0);
        if (!op) return;
        var coh = (row[op] != null) ? row[op] : (op === myPhase ? 0.04 : 0);
        if (coh > 0 && st > 0.5) coupled.push({ domain: k, phase: op, coherence: coh, stress: Math.round(st * 100) / 100 });
      });
      coupled.sort(function (a, b) { return (b.coherence * b.stress) - (a.coherence * a.stress); });
      couplingStrength = coupled.reduce(function (a, c) { return a + c.coherence * c.stress; }, 0);
    }

    // (B) PHASE-TRANSITION SELF-CONSISTENCY — did a predicted transition actually occur (through time)?
    //     This is interpretive self-consistency calibration, NEVER external reward.
    var hist = this._phaseHistory = this._phaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var fc = (s.domainNeuro && s.domainNeuro.forecast) || {};    // generic K-stack forecast
      var predictedUp = fc.direction === 'rising' ||
        (typeof fc.projectedStress === 'number' && typeof s.stress === 'number' && fc.projectedStress > s.stress);
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      transition = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'self-consistency calibration (P3/P7 phase, interpretive)' : 'advisory-self-consistency' };
    }
    hist.push({ phase: myPhase, t: (s.intelligenceModel && s.intelligenceModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, myPhase: myPhase,
      phaseSource: s.phaseSource || 'fallback',       // 'thing2-kernel' when the real kernel drove myPhase, else 'fallback'
      kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: transition,
      note: 'phase-coherence router (patent M matrix; advisory) + phase-transition self-consistency calibration (thing2 lineage; interpretive, NEVER external reward — even on P3/P7). K4 credit routes through the central honest gate; P3/P7 only gates the phase-consistency tier. myPhase from Thing2 kernel when available, else s.phase fallback.'
    };
    s.intelligencePhaseDynamics = out; return out;
  };

  // ── E/I BALANCE READ + SELF-AUDIT (advisory, observe-only). (1) Is inhibition tracking drive (XIII.1)?
  //    (2) CONSUME the connectivity / single-points-of-failure audit over intelligence.json's REAL edge
  //    graph (80 edges) — edges are NOT in the live snapshot, so lazily fetch + cache once (deterministic
  //    STATIC JSON, no AI). The brain SEES its own runaway risk + brittle nodes each cycle. No writes. ──
  IntelligenceBrain.prototype._computeIntelligenceRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true }, self = this;
    // (1) E/I balance
    try {
      var servo = s.intelligenceServo || null;
      out.eiBalance = servo ? { drive: servo.drive, inhibition: servo.inhibition, target: servo.target, error: servo.error, balanced: servo.state === 'balanced', state: servo.state, rule: 'Neuro Ref XIII.1: inhibition must scale with excitatory drive.' } : null;
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit — SPOF over the real edge graph
    try {
      var edges = (Array.isArray(s.edges) && s.edges) || this._intelligenceEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._intelligenceEdgesPromise) {
          this._intelligenceEdgesPromise = fetch('/assets/data/domains/intelligence.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._intelligenceEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/intelligence.json'); if (ed && Array.isArray(ed.edges)) { this._intelligenceEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      if (edges && edges.length) {
        var audit = this._intelligenceSPOF(edges);
        out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: audit.articulationNodes.length, spof: audit.articulationNodes.slice(0, 5), verdict: audit.verdict, topHubs: audit.topHubsByDegree };
      } else {
        out.selfAudit = { consumed: false, note: edges ? 'no edges' : 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    s.intelligenceRegulation = out; return out;
  };

  // ── SPOF / articulation-node audit (inline; mirrors limen-connectivity-audit.singlePointsOfFailure).
  //    Deterministic O(V·(V+E)) over ~40 nodes / 80 edges = a few thousand ops/cycle. No AI, no I/O. ──
  IntelligenceBrain.prototype._intelligenceSPOF = function (edges) {
    function componentCount(nodes, edgeList) {
      var adj = {}; nodes.forEach(function (n) { adj[n] = []; });
      edgeList.forEach(function (e) { if (adj[e.source] && adj[e.target]) { adj[e.source].push(e.target); adj[e.target].push(e.source); } });
      var seen = {}, comps = 0;
      nodes.forEach(function (n) {
        if (seen[n]) return; comps++; var stack = [n];
        while (stack.length) { var x = stack.pop(); if (seen[x]) continue; seen[x] = 1; adj[x].forEach(function (y) { if (!seen[y]) stack.push(y); }); }
      });
      return comps;
    }
    var nodeSet = {}; edges.forEach(function (e) { nodeSet[e.source] = 1; nodeSet[e.target] = 1; });
    var nodes = Object.keys(nodeSet);
    var base = componentCount(nodes, edges);
    var spof = [];
    nodes.forEach(function (n) {
      var rn = nodes.filter(function (x) { return x !== n; });
      var re = edges.filter(function (e) { return e.source !== n && e.target !== n; });
      var c = componentCount(rn, re);
      if (c > base) spof.push({ node: n, componentsAfterRemoval: c, baseComponents: base });
    });
    var deg = {}; edges.forEach(function (e) { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });
    var hubs = Object.keys(deg).map(function (n) { return { node: n, degree: deg[n] }; }).sort(function (a, b) { return b.degree - a.degree; }).slice(0, 5);
    return { baseComponents: base, articulationNodes: spof, topHubsByDegree: hubs,
      verdict: spof.length ? spof.length + ' articulation node(s) = single points of failure' : 'no articulation nodes (graph degrades gracefully)' };
  };

  // ══════════════════════════════════════════════════════════════════════
  // AI SLOT (operator-triggered ONLY; NEVER called from the 30s cycle) — COST-SAFE STUB
  // ──────────────────────────────────────────────────────────────────────
  // Generative node->business authoring / semantic mapping is a genuine "code-cannot-do-this" slot.
  // It is DELIBERATELY never invoked by cycle(): the 30s loop is 100% deterministic and makes NO
  // paid-AI calls. This runs ONLY on an explicit operator trigger and routes through a SERVER endpoint
  // that is killswitch-gated server-side (lib/ai-kill-switch spendDisabled()). No API key is ever in
  // client code. Guarded: it refuses unless an explicit operator trigger flag is passed, and degrades
  // to a null no-op if the server declines (killswitch engaged / endpoint absent).
  // ══════════════════════════════════════════════════════════════════════
  IntelligenceBrain.prototype.authorNodeBusinessBrief = function (opts) {
    opts = opts || {};
    if (!opts.operatorTriggered) return Promise.reject(new Error('AI slot is operator-triggered only; never auto-run on the cycle'));
    if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch available'));
    // Server enforces the killswitch (spendDisabled()); the client passes NO key and no model config.
    return fetch('/api/intelligence-node-business', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'intelligence', nodeId: opts.nodeId || null, diagnosisId: opts.diagnosisId || null })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  };

  var brain = new IntelligenceBrain(); brain.init(); brain.start();
  window.LIMENIntelligenceBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD INTELLIGENCE OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('intelligence-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isIntelligenceDomain = _domParam === 'intelligence';
  if (_isDomainConsole && _isIntelligenceDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _intelligenceScripts = [
      'assets/js/intelligence-compensation.js',
      'assets/js/intelligence-claim-ledger.js',
      'assets/js/intelligence-claim-flow.js',
      'assets/js/intelligence-opportunity-economics.js',
      'assets/js/intelligence-pulse-engine.js',
      'assets/js/intelligence-operator-panel.js',
      'assets/js/intelligence-node-business-engine.js',
      'assets/js/intelligence-business-review.js',
      'assets/js/intelligence-execution-panels.js',
      'assets/js/intelligence-business-build.js',
      'assets/js/intelligence-directive-extractor.js',
      'assets/js/intelligence-directive-ranker.js',
      'assets/js/intelligence-directive-translator.js',
      'assets/js/intelligence-targeting-engine.js',
      'assets/js/intelligence-promotion-bridge.js',
      'assets/js/intelligence-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _intelligenceScripts.length) return;
      var s = document.createElement('script');
      s.src = _intelligenceScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[IntelligenceBrain] Failed to load ' + _intelligenceScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
