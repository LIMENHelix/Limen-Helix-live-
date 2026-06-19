/**
 * communication-brain.js — Communication Domain Cognitive Engine
 *
 * Portal issues: DISINFORMATION_CRISIS, TELECOM_FAILURE, CENSORSHIP_OVERREACH,
 *                MEDIA_MONOPOLY, CYBER_PROPAGANDA
 *
 * Emissions: intelligence, governance, culture, law, population
 * Exposes: window.LIMENCommunicationBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[CommunicationBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function CommunicationBrain() {
    Base.call(this, { domainId: 'communication', label: 'Communication', snapshotKey: 'communication', cycleInterval: 30000 });
  }
  CommunicationBrain.prototype = Object.create(Base.prototype);
  CommunicationBrain.prototype.constructor = CommunicationBrain;

  CommunicationBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    this.diagnosisIndex = {
      'DISINFORMATION_CRISIS':  ['misinformation_spread', 'disinformation_campaign', 'narrative_manipulation', 'amplification_bias', 'signal_degradation', 'communication_high_stress', 'macro_shock'],
      'TELECOM_FAILURE':        ['infrastructure_failure', 'network_disruption', 'connectivity_loss', 'service_outage', 'communication_high_stress'],
      'CENSORSHIP_OVERREACH':   ['speech_restriction', 'content_suppression', 'platform_censorship', 'regulatory_overreach', 'information_control'],
      'MEDIA_MONOPOLY':         ['market_concentration', 'editorial_capture', 'audience_fragmentation', 'echo_chamber', 'platform_dominance', 'structural_stress'],
      'CYBER_PROPAGANDA':       ['narrative_manipulation', 'bot_amplification', 'coordinated_inauthentic', 'information_contamination', 'disinformation_campaign', 'macro_shock']
    };

    this.emissionRules = [
      { targetDomain: 'intelligence', signalType: 'information_contamination_signal', condition: function (s) { return s.stress >= 0.15; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'governance', signalType: 'public_perception_pressure', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'culture', signalType: 'narrative_identity_shaping', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'law', signalType: 'speech_regulatory_pressure', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'population', signalType: 'behavioral_informational_influence', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } }
    ];
  };

  CommunicationBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — communication always has signal degradation and amplification pressure
    this._activeConditions.push('signal_degradation');
    this._activeConditions.push('amplification_bias');
    signals.push('BASELINE: Persistent information ecosystem signal degradation and amplification pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('newsapi') !== -1 || fn.indexOf('headlines') !== -1) && f.value !== undefined && f.value > 0) {
        if (f.value >= 50) this._activeConditions.push('amplification_bias');
        if (f.value >= 30) this._activeConditions.push('narrative_manipulation');
        signals.push('FEED: NewsAPI headlines \u2014 ' + (f.label || f.value + ' articles'));
      }
      if (fn.indexOf('rss media') !== -1 && f.value !== undefined && f.value > 0) {
        if (f.value >= 20) this._activeConditions.push('signal_degradation');
        signals.push('FEED: RSS media \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('press freedom') !== -1 || fn.indexOf('rsf') !== -1 || fn.indexOf('cpj') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('speech_restriction');
        this._activeConditions.push('content_suppression');
        if (f.value >= 5) this._activeConditions.push('regulatory_overreach');
        signals.push('FEED: Press freedom incident \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('snopes') !== -1 || fn.indexOf('politifact') !== -1 || fn.indexOf('fact check') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('misinformation_spread');
        if (f.value >= 10) this._activeConditions.push('disinformation_campaign');
        signals.push('FEED: Fact check throughput \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('cloudflare radar') !== -1 || fn.indexOf('netblocks') !== -1 || fn.indexOf('outage') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('network_disruption');
        if (f.value >= 3) this._activeConditions.push('connectivity_loss');
        if (f.value >= 5) this._activeConditions.push('infrastructure_failure');
        signals.push('FEED: Connectivity outage events \u2014 ' + (f.label || f.value));
      }

      // \u2500\u2500 INSTITUTIONAL FEED-DERIVED CONDITIONS (Federal Register + CISA) \u2500\u2500

      // Fed Reg FCC \u2014 telecom regulatory volume \u2192 TELECOM_FAILURE / CENSORSHIP_OVERREACH
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('infrastructure_failure');
        signals.push('Fed Reg FCC: ' + f.value + ' telecom regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('regulatory_overreach');
        this._activeConditions.push('content_suppression');
      }

      // Fed Reg FTC \u2014 antitrust/media merger regulatory \u2192 MEDIA_MONOPOLY
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('market_concentration');
        signals.push('Fed Reg FTC: ' + f.value + ' antitrust/media docs (30d)');
      }
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('platform_dominance');
        this._activeConditions.push('editorial_capture');
      }

      // CISA Advisories \u2014 cyber/network \u2192 CYBER_PROPAGANDA / TELECOM_FAILURE
      if (fn.indexOf('cisa advisories') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('network_disruption');
        signals.push('CISA Advisories: ' + f.value + ' active advisories');
      }
      if (fn.indexOf('cisa advisories') !== -1 && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('connectivity_loss');
        this._activeConditions.push('information_contamination');
      }

      // BBC World News \u2014 editorial international news volume \u2192 broad amplification signal
      if (fn.indexOf('bbc world') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('amplification_bias');
        signals.push('BBC World News: ' + f.value + ' items \u2014 editorial international cadence');
      }
      if (fn.indexOf('bbc world') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('narrative_manipulation');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('disinformation') !== -1 || rs.indexOf('misinformation') !== -1 || rs.indexOf('fake news') !== -1) {
        if (this._activeConditions.indexOf('misinformation_spread') === -1) this._activeConditions.push('misinformation_spread');
        if (this._activeConditions.indexOf('disinformation_campaign') === -1) this._activeConditions.push('disinformation_campaign');
      }
      if (rs.indexOf('censor') !== -1 || rs.indexOf('suppress') !== -1 || rs.indexOf('ban') !== -1 || rs.indexOf('restrict') !== -1) {
        if (this._activeConditions.indexOf('speech_restriction') === -1) this._activeConditions.push('speech_restriction');
        if (this._activeConditions.indexOf('content_suppression') === -1) this._activeConditions.push('content_suppression');
      }
      if (rs.indexOf('outage') !== -1 || rs.indexOf('telecom') !== -1 || rs.indexOf('internet shutdown') !== -1 || rs.indexOf('blackout') !== -1) {
        if (this._activeConditions.indexOf('network_disruption') === -1) this._activeConditions.push('network_disruption');
        if (this._activeConditions.indexOf('connectivity_loss') === -1) this._activeConditions.push('connectivity_loss');
      }
      if (rs.indexOf('monopol') !== -1 || rs.indexOf('consolidat') !== -1 || rs.indexOf('merger') !== -1) {
        if (this._activeConditions.indexOf('market_concentration') === -1) this._activeConditions.push('market_concentration');
        if (this._activeConditions.indexOf('platform_dominance') === -1) this._activeConditions.push('platform_dominance');
      }
      if (rs.indexOf('bot') !== -1 || rs.indexOf('troll') !== -1 || rs.indexOf('propaganda') !== -1 || rs.indexOf('influence operation') !== -1) {
        if (this._activeConditions.indexOf('bot_amplification') === -1) this._activeConditions.push('bot_amplification');
        if (this._activeConditions.indexOf('coordinated_inauthentic') === -1) this._activeConditions.push('coordinated_inauthentic');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('communication') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'communication') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'communication' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    if (this.state.stress >= 0.20) { this._activeConditions.push('echo_chamber'); this._activeConditions.push('audience_fragmentation'); }
    if (this.state.stress >= 0.35) { this._activeConditions.push('communication_high_stress'); this._activeConditions.push('information_contamination'); }
    if (this.state.stress >= 0.50) { this._activeConditions.push('narrative_manipulation'); this._activeConditions.push('regulatory_overreach'); }
    if (this.state.stress >= 0.60) { this._activeConditions.push('content_suppression'); this._activeConditions.push('platform_dominance'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('information_control');
    if (extPressure >= 0.20) this._activeConditions.push('editorial_capture');

    this.state.signals = signals;
    return Promise.resolve();
  };

  CommunicationBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var issues = portal.issues || [], conditions = self._activeConditions || [];
      self.state.diagnoses = issues.map(function (iss) {
        var triggers = self.diagnosisIndex[iss.id] || [], matchCount = 0;
        for (var t = 0; t < triggers.length; t++) for (var c = 0; c < conditions.length; c++) if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) matchCount++;
        return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: Math.round((triggers.length > 0 ? matchCount / triggers.length : 0) * 100) / 100, matchedConditions: matchCount, totalTriggers: triggers.length, circuits: iss.circuits || [], source: 'canonical' };
      });
      self.state.diagnoses.sort(function (a, b) { if (a.active !== b.active) return a.active ? -1 : 1; return b.relevance - a.relevance; });
      self._checkDiagnosisActions();
    });
  };

  CommunicationBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; return; }
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) { var circuits = activeDx[di].circuits || []; for (var ci = 0; ci < circuits.length; ci++) activeNodeIds[circuits[ci].nodeId] = activeDx[di].id; }
      var treatments = [], activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) { var act = activations[ai]; if (!activeNodeIds[act.brainNodeId]) continue; var actTreats = act.treatments || []; for (var ti = 0; ti < actTreats.length; ti++) { var t = actTreats[ti]; treatments.push({ id: 'treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', diagnosisId: activeNodeIds[act.brainNodeId], nodeId: act.brainNodeId, relevance: 1.0, source: 'canonical' }); } }
      var eR = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (eR[b.evidence] || 0) - (eR[a.evidence] || 0); });
      self.state.treatments = treatments;
    });
  };

  CommunicationBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — content verification and trust infrastructure', rank: stress * dx.relevance, path: 'PATENTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — platform integrity and moderation systems', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — signal filtering and prioritization technology', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — communication resilience and interoperability', rank: stress * dx.relevance * 0.75, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Communication terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — communication convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Communication \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Misinformation detection and counter-narrative infrastructure', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'misinfo_detect', stress: stress });
      add({ title: 'Media literacy and information resilience programs', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'media_literacy', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Secure communication and encrypted messaging infrastructure', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'secure_comms', stress: stress });
      add({ title: 'Content authentication and provenance tracking systems', rank: stress * 0.72, path: 'PATENTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'content_auth', stress: stress });
      add({ title: 'Telecom resilience and network redundancy infrastructure', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'telecom_resilience', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // ═══ CANONICAL ENRICHMENT — merge communication playbook detail per opportunity ═══
    // Playbooks are loaded from assets/js/domain-brains/data/communication-opportunity-playbooks.js.
    // All narrative (explain/action/valueRange/trigger/validation/steps/outcome/failure/
    // window/fastPath/examples/branch_up/branch_down/realWorld) is domain-authored.
    // moneyChain is composed from those fields + live state readouts — no new prose.
    var PB_LIST = window.LIMENCommunicationOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];

    // Diagnosis → playbook id
    var _PB_MAP = {
      'DISINFORMATION_CRISIS': 'disinformation_crisis',
      'TELECOM_FAILURE':       'telecom_failure',
      'CENSORSHIP_OVERREACH':  'censorship_overreach',
      'MEDIA_MONOPOLY':        'media_monopoly',
      'CYBER_PROPAGANDA':      'cyber_propaganda'
    };
    // Lagging aliases coined by this brain → playbook id (domain-authored mapping)
    var _LAGGING_MAP = {
      'misinfo_detect':     'disinformation_crisis',
      'media_literacy':     'disinformation_crisis',
      'secure_comms':       'censorship_overreach',
      'content_auth':       'disinformation_crisis',
      'telecom_resilience': 'telecom_failure'
    };

    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }

    function _urgencyLabel(u) {
      if (u === 'high') return 'IMMEDIATE';
      if (u === 'medium') return 'ACTIVE';
      if (u === 'watching') return 'WATCH';
      return (u || '').toUpperCase();
    }

    // Compensation model (mirrors infrastructure-brain's per-path model)
    var _COMP = {
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
    };

    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];

      // Stable id + domain metadata
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'communication';
      o.confidence = Math.round(Math.min(1, (o.rank || 0)) * 100);
      if (!o.whyNow) o.whyNow = o.title;
      // Normalize urgency to contract vocabulary for central-page projection
      o.urgencyLabel = _urgencyLabel(o.urgency);

      // Map to playbook + attach narrative (only if legitimate mapping exists)
      var pbId = _resolvePbId(o);
      o.playbookId = pbId;
      var pb = pbId ? _byId[pbId] : null;

      if (pb) {
        o.explain     = pb.explain;
        o.action      = pb.action;
        o.valueRange  = pb.valueRange;
        o.trigger     = pb.trigger;
        o.validation  = pb.validation;
        o.steps       = pb.steps;
        o.outcome     = pb.outcome;
        o.failure     = pb.failure;
        o.window      = pb.window;
        o.fastPath    = pb.fastPath;
        o.examples    = pb.examples;
        o.branch_up   = pb.branch_up;
        o.branch_down = pb.branch_down;
        if (pb.realWorld) o.realWorld = pb.realWorld;
        if (pb.saturation) o.saturation = pb.saturation;
      }

      // Compensation (applies to all, path-based)
      o.compensation = _COMP[o.path] || null;
      if (o.compensation) o.paths = [o.path];

      // Validity lifecycle (tier-scaled expiry, matching contract)
      o.validity = {
        createdAt: Date.now(),
        lastValidated: Date.now(),
        expiryWindowDays: o.tier === 1 ? 30 : o.tier === 2 ? 60 : 90,
        requiresRevalidation: false,
        invalidationReasons: []
      };

      // moneyChain — composed strictly from playbook fields + live state. No new prose.
      if (pb) {
        var stressPct = Math.round((o.stress || 0) * 100);
        var target = '';
        if (o.path === 'INVESTABLE' && pb.realWorld && pb.realWorld.invest) target = pb.realWorld.invest;
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
        else if (o.companies && o.companies.length) target = 'Mapped companies: ' + o.companies.join(', ') + '.';

        var timingParts = [];
        if (o.urgencyLabel) timingParts.push(o.urgencyLabel);
        if (pb.window) timingParts.push('Window: ' + pb.window);
        var timing = timingParts.join(' \u00b7 ');

        var evidenceParts = ['Domain: communication', 'Stress: ' + stressPct + '%'];
        if (o.confidence) evidenceParts.push('Confidence: ' + o.confidence + '%');
        if (o.diagnosisId) evidenceParts.push('Diagnosis: ' + String(o.diagnosisId).replace(/_/g, ' ').toLowerCase());
        if (pb.trigger) evidenceParts.push(pb.trigger);
        var evidence = evidenceParts.join('. ') + '.';

        var whyPays = pb.outcome || '';
        if (pb.valueRange) whyPays = (whyPays ? whyPays + ' ' : '') + 'Value range: ' + pb.valueRange + '.';

        var nextStep = (pb.fastPath && pb.fastPath.length) ? pb.fastPath[0] : (pb.steps && pb.steps.length ? pb.steps[0] : '');

        o.moneyChain = {
          doThis:    pb.action || '',
          whyPays:   whyPays,
          target:    target,
          timing:    timing,
          invalidIf: pb.failure || '',
          evidence:  evidence,
          nextStep:  nextStep
        };
      }
    }

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;
    return Promise.resolve();
  };

  CommunicationBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'communication', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'communication', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Communication Alert: ' + dx.label, intent: { domain: 'communication', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on information ecosystem', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected channels, platforms, and audiences', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate integrity and resilience opportunities', status: 'PENDING' }] } }); }
  };

  CommunicationBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = CommunicationBrain.prototype.cycle;
  CommunicationBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

  var brain = new CommunicationBrain(); brain.init(); brain.start();
  window.LIMENCommunicationBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD COMMUNICATION OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('communication-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isCommunicationDomain = _domParam === 'communication';
  if (_isDomainConsole && _isCommunicationDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _communicationScripts = [
      'assets/js/communication-compensation.js',
      'assets/js/communication-claim-ledger.js',
      'assets/js/communication-claim-flow.js',
      'assets/js/communication-opportunity-economics.js',
      'assets/js/communication-pulse-engine.js',
      'assets/js/communication-operator-panel.js',
      'assets/js/communication-node-business-engine.js',
      'assets/js/communication-business-review.js',
      'assets/js/communication-execution-panels.js',
      'assets/js/communication-business-build.js',
      'assets/js/communication-directive-extractor.js',
      'assets/js/communication-directive-ranker.js',
      'assets/js/communication-directive-translator.js',
      'assets/js/communication-targeting-engine.js',
      'assets/js/communication-promotion-bridge.js',
      'assets/js/communication-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _communicationScripts.length) return;
      var s = document.createElement('script');
      s.src = _communicationScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[CommunicationBrain] Failed to load ' + _communicationScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
