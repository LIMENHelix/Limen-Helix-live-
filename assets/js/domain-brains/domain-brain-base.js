/**
 * domain-brain-base.js — Federated Cognitive Architecture
 *
 * Canonical interface for domain brains. Every domain implements this contract.
 * Each domain brain is a local intelligence organ that:
 *   - ingests domain-specific feeds
 *   - normalizes signals within its own ontology
 *   - scores stress/confidence/activity locally
 *   - derives diagnoses from portal content based on live conditions
 *   - recommends treatments linked to active diagnoses
 *   - surfaces opportunities with capital pathway classification
 *   - emits cross-domain signals upward to civilization layer
 *   - maintains local memory (stress history, outcome tracking)
 *   - computes local phase state
 *
 * State contract (every domain brain exposes):
 *   {
 *     domainId, label, status,
 *     feeds: [{ name, live, value, channel, updated }],
 *     stress, confidence, activity, maturity, phase,
 *     signals: [string],
 *     diagnoses: [{ id, label, summary, active, relevance, circuits }],
 *     treatments: [{ id, label, type, evidence, diagnosisId, relevance }],
 *     opportunities: [{ title, rank, path, urgency }],
 *     companies: [{ ticker, cik, phase, trajectory }],
 *     convergence: { primary_signal, provenance },
 *     crossDomainEmissions: [{ targetDomain, signal, magnitude }],
 *     memory: { stressHistory, phaseHistory, outcomeLog },
 *     updated: timestamp
 *   }
 *
 * Lifecycle:
 *   brain.init() → brain.start() → [brain.cycle() every N seconds] → brain.getState()
 *
 * Exposes: window.LIMENDomainBrainBase
 */
(function () {
  'use strict';

  var CYCLE_INTERVAL = 30000; // 30s default cycle

  // Shared-snapshot consumption guards (module-scope, not per-brain).
  // Domain brains MUST NOT spawn their own /api/domain-snapshot polling
  // fleet — shared-snapshot-engine.js owns the single fetch cycle.
  // These vars exist so that, if LIMENSharedSnapshot is genuinely absent,
  // we issue at most ONE fallback fetch per page lifecycle and warn once.
  var _fallbackSnapshotPromise = null;
  var _fallbackSnapshotWarned = false;

  // Portal-fetch negative cache (module-scope, shared across all brains).
  // _getPortalContent() populates this on static 404 (or eager-mode API
  // failure) so subsequent calls for the same portalKey skip the network
  // for PORTAL_NEG_TTL. Mirrors the pattern in portal-content-resolver.js.
  var _negPortalCache = {};        // portalKey -> timestamp of last failed lookup
  var PORTAL_NEG_TTL = 3600000;    // 1 hour

  // Shared command-board company map: domain -> [{ name, ticker, cik, phase,
  // trajectory }]. Loaded ONCE per page across ALL brain instances and reused.
  // Exists because the client-side console snapshot frequently lacks
  // domainCompanyJoin (only the server cron emits it), starving state.companies
  // for most domains. Generalizes the per-brain fallback that previously lived
  // only in energy-brain. Resolves to {} on any failure (honest empty, no throw).
  // Brain domainId -> command-board `.d` key. Three brains key differently than
  // the command-board dataset (medicine='health', science='research',
  // trade='supplyChain'); without this bridge their fallback finds nothing.
  var _CB_DOMAIN_ALIAS = { health: 'medicine', research: 'science', supplyChain: 'trade' };
  var _cbCompanyMapPromise = null;
  function _loadCommandBoardMap() {
    if (_cbCompanyMapPromise) return _cbCompanyMapPromise;
    _cbCompanyMapPromise = (function () {
      try {
        return fetch('/assets/data/command-board-data.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            var map = {};
            if (!data) return map;
            var arr = Array.isArray(data) ? data
              : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
            for (var i = 0; i < arr.length; i++) {
              var x = arr[i];
              if (!x || !x.d || !x.t) continue;     // need a domain + ticker
              (map[x.d] = map[x.d] || []).push({
                name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr
              });
            }
            return map;
          })
          .catch(function () { return {}; });
      } catch (e) { return Promise.resolve({}); }
    })();
    return _cbCompanyMapPromise;
  }

  // Shared per-domain diagnosis digest loader. The digest (built offline by
  // scripts/build-diagnosis-digest.mjs) rolls up the deep subportal tree's
  // already-authored diagnoses + treatments into one lean file, so the brain
  // can surface the deep tree without fetching ~200 portal files per cycle.
  // One fetch per portalKey per page, cached. Resolves to null on any failure.
  var _digestPromises = {};   // portalKey -> Promise<digest|null>
  function _loadDiagnosisDigest(portalKey) {
    if (_digestPromises[portalKey]) return _digestPromises[portalKey];
    _digestPromises[portalKey] = (function () {
      try {
        return fetch('/assets/data/deep/' + portalKey + '-diagnosis-digest.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      } catch (e) { return Promise.resolve(null); }
    })();
    return _digestPromises[portalKey];
  }

  // ── Canonical node registry (assets/data/canonical-nodes.json) — the ONE source
  //    of truth for what a node IS. Loaded once per page, cached. Powers the
  //    inhibitory brake (no diagnosis may bind to a non-node) + the portals-as-feeds
  //    derivation (a diagnosis is COMPUTED from live feed level x the node's motif
  //    failure-mode, not read from stored text). Degrades safe (empty -> no-op).
  var _canonPromise = null, _canonNodes = null;
  function _loadCanonicalNodes() {
    if (_canonNodes) return Promise.resolve(_canonNodes);
    if (_canonPromise) return _canonPromise;
    _canonPromise = fetch('/assets/data/canonical-nodes.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { _canonNodes = (j && j.nodes) || {}; return _canonNodes; })
      .catch(function () { _canonNodes = {}; return _canonNodes; });
    return _canonPromise;
  }
  function _classifyNode(id, nodes) {
    return (nodes && nodes[id]) || { class: 'unknown', canBindBusiness: false, motif: null, remapTo: 'confirm' };
  }
  // diagnosis = f(live activation, node motif failure-modes). hi/lo = the failure poles.
  function _deriveFailurePole(rec, level, hi, lo) {
    hi = hi == null ? 0.60 : hi; lo = lo == null ? 0.15 : lo;
    var parts = String(rec.failureModes || '').split('/');
    var pole = level >= hi ? 'hyper' : (level <= lo ? 'hypo' : 'regulated');
    var text = pole === 'hyper' ? (parts[0] || '').trim() : pole === 'hypo' ? (parts[1] || '').trim() : 'within regulated range';
    return { motif: rec.motif || null, role: rec.role || null, level: Math.round(level * 1000) / 1000, pole: pole, reading: text };
  }

  // ══════════════════════════════════════════════════════════════════════
  // BASE CLASS
  // ══════════════════════════════════════════════════════════════════════

  function DomainBrainBase(config) {
    this.domainId = config.domainId;
    this.label = config.label || config.domainId;
    this.snapshotKey = config.snapshotKey || config.domainId; // key in domain-snapshot response
    this.portalKey = config.portalKey || config.domainId; // key for fetch-portal API (may differ from domainId)
    this.cycleInterval = config.cycleInterval || CYCLE_INTERVAL;
    this.status = 'INIT';
    this._timer = null;
    this._cycleCount = 0;

    // State contract
    this.state = {
      domainId: this.domainId,
      label: this.label,
      status: 'INIT',
      feeds: [],
      stress: 0,
      confidence: 0,
      activity: 0,
      maturity: 'EARLY',
      phase: 'p0',
      phaseLabel: 'SOURCE',
      signals: [],
      diagnoses: [],
      treatments: [],
      opportunities: [],
      companies: [],
      convergence: null,
      crossDomainEmissions: [],
      biosensor: null,        // always null — biosensor modulation removed 2026-06-18
      memory: {
        stressHistory: [],    // [{ stress, timestamp }] last 200
        phaseHistory: [],     // [{ phase, timestamp }] last 50
        outcomeLog: []        // [{ action, result, timestamp }] last 50
      },
      updated: 0
    };

    // Feed registry — subclasses populate this
    this.feedRegistry = []; // [{ name, fetchFn, channel, parser }]

    // Diagnosis index — maps signal conditions to relevant diagnosis IDs
    this.diagnosisIndex = {}; // { signalCondition: [diagnosisId] }

    // Cross-domain emission rules
    this.emissionRules = []; // [{ targetDomain, condition, signalType, magnitudeFormula }]

    // Portal content cache
    this._portalCache = null;
    this._portalCacheAge = 0;
    this._PORTAL_CACHE_TTL = 300000; // 5 min
  }

  // ══════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════

  DomainBrainBase.prototype.init = function () {
    this.status = 'READY';
    this.state.status = 'READY';
    // Subclasses override to register feeds, diagnosis index, emission rules
  };

  DomainBrainBase.prototype.start = function () {
    var self = this;
    this.status = 'RUNNING';
    this.state.status = 'RUNNING';

    // Initial cycle
    this.cycle();

    // Recurring cycle
    this._timer = setInterval(function () {
      self.cycle();
    }, this.cycleInterval);
  };

  DomainBrainBase.prototype.stop = function () {
    if (this._timer) clearInterval(this._timer);
    this.status = 'STOPPED';
    this.state.status = 'STOPPED';
  };

  DomainBrainBase.prototype.cycle = function () {
    var self = this;
    this._cycleCount++;

    // Sequential pipeline — each step feeds the next
    return this.ingestFeeds()
      .then(function () { return self.normalizeSignals(); })
      .then(function () { return self.scoreStress(); })
      .then(function () { return self.deriveDiagnoses(); })
      .then(function () { return self.recommendTreatments(); })
      .then(function () { return self.surfaceOpportunities(); })
      .then(function () { return self.emitCrossDomainSignals(); })
      .then(function () { return self.updateMemory(); })
      .then(function () {
        try { self._applyRequestSteer(); } catch (e) {}       // re-apply operator steer each cycle (no-op if none)
        try { self._computeGenericKStack(); } catch (e) {}    // generic K-stack -> cognition.neuro (energy self-skips)
        try { self._applyGenericBrakeGate(); } catch (e) {}   // closed loop: brake gates emitted opportunities
        try { self._computeGenericInteroception(); } catch (e) {}  // multimodal interoception (Phase 1): observe-only divergence read (energy self-skips)
        self.state.updated = Date.now();
        self._emitEvent('domain-brain-update', { domainId: self.domainId, state: self.state });
      })
      .catch(function (e) {
        console.warn('[DomainBrain:' + self.domainId + '] Cycle error:', e.message);
      });
  };

  // ══════════════════════════════════════════════════════════════════════
  // INTER-BRAIN SIGNAL RECEPTION
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Receive an external signal from another domain brain via the bus.
   * Accumulates incoming signals — scoreStress() should incorporate them.
   */
  DomainBrainBase.prototype.receiveExternalSignal = function (emission) {
    if (!this._externalSignals) this._externalSignals = [];
    this._externalSignals.push({
      source: emission.sourceDomain,
      signal: emission.signal,
      magnitude: emission.magnitude,
      receivedAt: Date.now()
    });
    // Keep last 20
    if (this._externalSignals.length > 20) this._externalSignals.shift();
  };

  /**
   * Get total external pressure from received signals.
   * Used by scoreStress() to incorporate cross-domain effects.
   */
  DomainBrainBase.prototype.getExternalPressure = function () {
    if (!this._externalSignals || this._externalSignals.length === 0) return 0;
    var now = Date.now();
    var total = 0;
    var count = 0;
    for (var i = 0; i < this._externalSignals.length; i++) {
      var sig = this._externalSignals[i];
      // Decay: signals older than 5 min lose weight
      var age = now - sig.receivedAt;
      var weight = age < 300000 ? 1.0 : Math.max(0, 1.0 - (age - 300000) / 600000);
      total += sig.magnitude * weight;
      count++;
    }
    return count > 0 ? Math.min(0.3, total / count) : 0; // capped at 0.3 — external can't dominate
  };

  // ══════════════════════════════════════════════════════════════════════
  // PIPELINE STEPS (subclasses override these)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Step 1: Ingest feeds
   * Read from domain-specific sources. Update this.state.feeds.
   *
   * Default: consumes the shared snapshot cache populated by
   * shared-snapshot-engine.js (single fetch every 30s, in-flight deduped).
   * Per-brain direct polling of /api/domain-snapshot was removed because
   * 19 brains × 30s spawned ~38 redundant requests/min that flooded the
   * console with 403s when the API was gated.
   */
  DomainBrainBase.prototype.ingestFeeds = function () {
    var self = this;
    var shared = (typeof window !== 'undefined') ? window.LIMENSharedSnapshot : null;
    var dataPromise;

    if (shared && typeof shared.getSnapshot === 'function') {
      var cached = shared.getSnapshot();
      if (cached && cached.domains) {
        // Cached payload available — no fetch.
        dataPromise = Promise.resolve(cached);
      } else if (typeof shared.requestFresh === 'function') {
        // Shared snapshot is the single fetcher. requestFresh() returns
        // the in-flight promise if one is active, otherwise initiates
        // the same single fetch. No new polling loop is started here.
        dataPromise = shared.requestFresh();
      } else {
        dataPromise = Promise.resolve(null);
      }
    } else {
      // Shared snapshot module not loaded — one-shot fallback per page
      // lifecycle. Single fetch, single warning, no recurring polling.
      if (!_fallbackSnapshotPromise) {
        if (!_fallbackSnapshotWarned) {
          _fallbackSnapshotWarned = true;
          console.warn('[DomainBrain] LIMENSharedSnapshot unavailable; one-shot fallback fetch');
        }
        _fallbackSnapshotPromise = fetch('/api/domain-snapshot')
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      }
      dataPromise = _fallbackSnapshotPromise;
    }

    return dataPromise.then(function (data) {
      if (!data || !data.domains) return;
      var d = data.domains[self.snapshotKey];
      if (!d) return;

      self.state.feeds = (d.sources || []).map(function (s) {
        return {
          name: s.name,
          live: s.live,
          value: s.value,
          label: s.label,
          channel: s.channel || 'stress',
          updated: s.updated || Date.now(),
          // per-source signal fields (previously dropped) — sub-topic feed derivation reads these:
          signal: s.signal || '',                                   // latest live headline for this source
          quality: (typeof s.quality === 'number') ? s.quality : null,
          classification: s.classification || null                  // 'real' | 'event' | 'broken'
        };
      });

      // Store raw domain data for later steps
      self._rawDomain = d;
    }).catch(function () {});
  };

  /**
   * Step 2: Normalize signals
   * Parse raw feed data into domain-native signal semantics.
   * Default: copies signals from domain-snapshot.
   */
  DomainBrainBase.prototype.normalizeSignals = function () {
    if (this._rawDomain) {
      this.state.signals = this._rawDomain.signals || [];
    }
    return Promise.resolve();
  };

  /**
   * Step 2b: Read biosensor — REMOVED 2026-06-18.
   * The operator's physiological state has no bearing on a sector domain's
   * stress reading (it conflated "how the operator feels" with "how the sector
   * is doing"). No-op stub kept for any override that calls super.
   */
  DomainBrainBase.prototype.readBiosensor = function () {
    this.state.biosensor = null;
    return Promise.resolve();
  };

  /**
   * Step 3: Score stress
   * Compute local stress/confidence/activity/maturity.
   * Default: copies from domain-snapshot.
   */
  DomainBrainBase.prototype.scoreStress = function () {
    if (this._rawDomain) {
      this.state.stress = this._rawDomain.stress || 0;
      this.state.confidence = this._rawDomain.confidence || 0;
      this.state.activity = this._rawDomain.activity || 0;
      this.state.maturity = this._rawDomain.maturity || 'EARLY';
    }

    // Read phase from snapshot if available
    var snap = this._getSnapshot();
    if (snap && snap.domains && snap.domains[this.snapshotKey]) {
      var sd = snap.domains[this.snapshotKey];
      this.state.phase = sd.phase || 'p0';
      this.state.phaseLabel = sd.phaseLabel || 'SOURCE';
    }

    // Biosensor modulation REMOVED 2026-06-18 — operator biometrics no longer
    // modulate any domain's stress/confidence/activity (see readBiosensor).

    // AFFERENT (continuous integration) — real brain dynamics: afferent input is a graded,
    // continuous summation folded into the domain's activation (stress), base-capped at 0.3.
    // UNIVERSAL here so every domain continuously integrates received cross-domain pressure.
    // The per-domain THRESHOLD firing (extPressure -> a named condition) stays in each domain's
    // normalizeSignals — integrate-and-fire: continuous integration + threshold response.
    // Overriding domains (energy/technology) call this base method, so they get it once here.
    var _ext = (typeof this.getExternalPressure === 'function') ? this.getExternalPressure() : 0;
    this.state._externalPressureApplied = _ext;
    if (_ext > 0) this.state.stress = Math.max(0, Math.min(1, (this.state.stress || 0) + _ext));

    return Promise.resolve();
  };

  /**
   * Step 4: Derive diagnoses
   * Surface relevant diagnoses from portal content based on active conditions.
   * Default: reads top-level issues from portal JSON.
   * Subclasses should override to do condition→content matching.
   */
  DomainBrainBase.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var issues = portal.issues || [];
      self.state.diagnoses = issues.map(function (iss) {
        return {
          id: iss.id,
          label: iss.label,
          summary: iss.summary || '',
          active: false, // subclasses set this based on conditions
          relevance: 0,
          circuits: iss.circuits || [],
          source: 'canonical'
        };
      });
    });
  };

  /**
   * Step 5: Recommend treatments
   * Select treatments linked to active diagnoses.
   * Default: pulls treatments from portal activations.
   */
  DomainBrainBase.prototype.recommendTreatments = function () {
    // Subclasses override to match treatments to active diagnoses
    return Promise.resolve();
  };

  /**
   * Step 6: Surface opportunities
   * Generate domain-specific opportunities from stress + diagnoses + companies.
   * Default: reads from snapshot opportunities.
   */
  DomainBrainBase.prototype.surfaceOpportunities = function () {
    var self = this;
    var snap = this._getSnapshot();
    if (snap && snap.convergenceSignals && snap.convergenceSignals[this.snapshotKey]) {
      self.state.convergence = snap.convergenceSignals[this.snapshotKey];
    }

    // Read companies from domain join
    if (snap && snap.domainCompanyJoin && snap.domainCompanyJoin[this.snapshotKey]) {
      var join = snap.domainCompanyJoin[this.snapshotKey];
      self.state.companies = join.companies || [];
    }

    // Deep-digest augmentation (applies to every domain): inject stress-gated
    // deep diagnoses + treatments from the already-authored subportal tree so
    // the domain's existing opportunity generator surfaces them. Runs every
    // cycle from the cached digest; eventually consistent (the digest loads in
    // the background and starts applying from the next cycle).
    this._applyDeepDigest();

    // LIVE DERIVATION (portals-as-feeds): after the diagnoses are assembled (root + deep),
    // compute each one's reading from (its node's live feed activation x the node's motif
    // failure-mode) and BRAKE any wired to a non-node. Supersedes the stuck baked verbiage.
    this._applyLiveDerivation();

    // Company fallback (applies to every domain): when the snapshot supplied
    // no companies, load the real command-board entities for this domain. This
    // is what was previously hand-wired only in energy-brain — now centralized
    // so all 20 domains (notably environment) get real names instead of an
    // empty list. Subclass surfaceOpportunities() overrides call into this base
    // first, so their own opportunity logic sees a populated state.companies.
    if (!self.state.companies || !self.state.companies.length) {
      return _loadCommandBoardMap().then(function (map) {
        if (!self.state.companies || !self.state.companies.length) {
          var cbKey = _CB_DOMAIN_ALIAS[self.domainId] || self.domainId;
          var list = (map && (map[cbKey] || map[self.domainId] || map[self.snapshotKey])) || [];
          if (list.length) self.state.companies = list;
        }
      });
    }

    return Promise.resolve();
  };

  /**
   * Deep-digest augmentation. Injects a stress-gated, ranked subset of the
   * domain's deep subportal diagnoses (+ their treatments) into state so the
   * subclass opportunity generator — which iterates state.diagnoses generically
   * — surfaces the deep tree, not just the L1 root. Idempotent per cycle:
   * deriveDiagnoses() rebuilds state.diagnoses fresh each cycle, and this
   * re-applies from the cached digest. No network per cycle after first load.
   */
  DomainBrainBase.prototype._applyDeepDigest = function () {
    var self = this;
    var pk = this.portalKey || this.domainId;

    // First cycle(s): digest not cached yet — kick off the one-time load and
    // return. It will be present (and applied) on a subsequent cycle.
    if (!self._deepDigest) {
      _loadDiagnosisDigest(pk).then(function (d) { if (d) self._deepDigest = d; });
      return;
    }

    var list = (self._deepDigest && self._deepDigest.diagnoses) || [];
    if (!list.length) return;

    var stress = self.state.stress || 0;
    if (stress < 0.30) return;                       // only surface deep dx under real stress
    var cap = Math.max(0, Math.min(8, Math.round(stress * 8)));
    if (cap === 0) return;

    if (!Array.isArray(self.state.diagnoses)) self.state.diagnoses = [];
    if (!Array.isArray(self.state.treatments)) self.state.treatments = [];

    // Don't duplicate ids the subclass already produced from the root portal.
    var have = {};
    self.state.diagnoses.forEach(function (d) { if (d && d.id) have[d.id] = true; });

    var EV = { Strong: 3, A: 3, Moderate: 2, B: 2, C: 1, Emerging: 1 };
    // Digest is pre-ranked (richest first); take the first `cap` not already present.
    var added = 0;
    for (var i = 0; i < list.length && added < cap; i++) {
      var d = list[i];
      if (!d || !d.id || have[d.id]) continue;
      have[d.id] = true;
      added++;

      self.state.diagnoses.push({
        id: d.id,
        label: d.label || d.id,
        summary: d.summary || '',
        active: true,
        relevance: Math.min(1, 0.4 + stress * 0.5),
        circuits: (d.circuits || []).map(function (n) { return { nodeId: n }; }),
        source: 'deep-digest',
        subportal: d.slug || null,
        depth: d.depth || null
      });

      (d.tx || []).forEach(function (t, ti) {
        self.state.treatments.push({
          id: 'deep_' + d.id + '_' + ti,
          label: t.l,
          type: t.t || '',
          evidence: t.e || '',
          diagnosisId: d.id,
          relevance: 0.7 + 0.05 * (EV[t.e] || 0),
          source: 'deep-digest'
        });
      });
    }
  };

  // Sub-topic feed router: match a diagnosis to the domain's live sources by token overlap
  // so a sub-portal derives from ITS feeds, not just the domain aggregate. Level = domain
  // stress base, elevated by the matched sources that are LIVE + event-firing + high-quality
  // (a hot sub-topic reads hotter). Returns the level + the matched sources as provenance.
  var _DX_STOP = { the:1, and:1, for:1, with:1, from:1, into:1, this:1, that:1, system:1, systems:1, failure:1, assessment:1, diagnostics:1, core:1, operations:1, management:1, capacity:1, overload:1, quality:1, degradation:1, strategic:1, planning:1, alignment:1, infrastructure:1, development:1, human:1, capital:1, coordination:1, primary:1, secondary:1, tertiary:1, node:1, standards:1, governance:1, monitoring:1, risk:1, profiling:1 };
  function _dxTokens(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (t) { return t.length >= 4 && !_DX_STOP[t] && !/^\d+$/.test(t); });
  }
  DomainBrainBase.prototype._subTopicSignal = function (dx) {
    var feeds = this.state.feeds || [];
    var base = this.state.stress || 0;
    var dxToks = _dxTokens((dx.label || '') + ' ' + (dx.subportal || '') + ' ' + (dx.id || ''));
    if (!dxToks.length || !feeds.length) return { level: base, feeds: [], matched: 0 };
    var matched = [], act = 0, actN = 0;
    for (var i = 0; i < feeds.length; i++) {
      var f = feeds[i], ft = _dxTokens((f.name || '') + ' ' + (f.label || ''));
      if (!dxToks.some(function (t) { return ft.indexOf(t) !== -1; })) continue;
      matched.push({ name: f.name, headline: String(f.signal || f.label || '').slice(0, 120), value: f.value, live: !!f.live, classification: f.classification });
      var q = (typeof f.quality === 'number') ? f.quality : 0.5;
      var ev = (f.classification === 'event') ? 1 : (f.classification === 'broken') ? 0 : 0.5;
      act += q * ev * (f.live ? 1 : 0.3); actN++;
    }
    if (!matched.length) return { level: base, feeds: [], matched: 0 };
    var level = Math.max(0, Math.min(1, base * 0.6 + (actN ? act / actN : 0) * 0.5));
    return { level: level, feeds: matched.slice(0, 4), matched: matched.length };
  };

  // LIVE DERIVATION: every diagnosis gets a reading COMPUTED from (its node's live level x
  // the node's motif failure-mode) + its feed provenance; and any diagnosis wired to a
  // NON-NODE is BRAKED (flagged, not derived). This is the inhibitory brake + the portals-
  // as-feeds substrate operating in the live brain. Additive: never removes baked content,
  // it supersedes it — d.liveReading / d.derived carry the live truth, d.blocked the mis-wire.
  DomainBrainBase.prototype._applyLiveDerivation = function () {
    var self = this;
    if (!_canonNodes) { _loadCanonicalNodes(); return; }   // load once; applies from next cycle
    var nodes = _canonNodes, dg = self.state.diagnoses || [];
    var braked = 0, live = 0;
    for (var i = 0; i < dg.length; i++) {
      var d = dg[i];
      var circ = (d.circuits && d.circuits[0]) || null;
      var nid = circ ? (circ.nodeId || circ) : null;
      if (!nid) { d.derived = null; continue; }
      var rec = _classifyNode(nid, nodes);
      if (!rec.canBindBusiness) {
        d.blocked = true;
        d.blockReason = 'wired to non-node ' + nid + ' (' + rec.class + ' → ' + (rec.remapTo || '?') + ')';
        d.derived = null; braked++;
        continue;
      }
      d.blocked = false;
      var st = self._subTopicSignal(d);
      var der = _deriveFailurePole(rec, st.level);
      der.node = nid; der.feeds = st.feeds; der.matchedFeeds = st.matched;
      der.source = st.matched ? 'live-feed-derived' : 'node-level-derived';
      d.derived = der;
      if (der.pole !== 'regulated' && der.reading) {
        d.liveReading = der.reading;                 // supersedes the stuck baked summary
        d.active = true;
        d.relevance = Math.max(d.relevance || 0, der.level);
        live++;
      }
    }
    self.state._derivation = { braked: braked, liveActive: live, total: dg.length, ts: Date.now() };
  };

  /**
   * Step 7: Emit cross-domain signals
   * Compute effects this domain has on other domains.
   * Subclasses define emission rules.
   */
  DomainBrainBase.prototype.emitCrossDomainSignals = function () {
    var emissions = [];
    for (var i = 0; i < this.emissionRules.length; i++) {
      var rule = this.emissionRules[i];
      if (rule.condition(this.state)) {
        emissions.push({
          sourceDomain: this.domainId,
          targetDomain: rule.targetDomain,
          signal: rule.signalType,
          magnitude: rule.magnitudeFormula(this.state),
          timestamp: Date.now()
        });
      }
    }
    this.state.crossDomainEmissions = emissions;
    return Promise.resolve();
  };

  /**
   * Step 8: Update memory
   * Append to local stress/phase history, prune old entries.
   */
  DomainBrainBase.prototype.updateMemory = function () {
    var mem = this.state.memory;

    // Stress history (last 200 entries = ~100 min at 30s cycle)
    mem.stressHistory.push({ stress: this.state.stress, timestamp: Date.now() });
    if (mem.stressHistory.length > 200) mem.stressHistory.shift();

    // Phase history (last 50 entries)
    var lastPhase = mem.phaseHistory.length > 0 ? mem.phaseHistory[mem.phaseHistory.length - 1].phase : null;
    if (this.state.phase !== lastPhase) {
      mem.phaseHistory.push({ phase: this.state.phase, timestamp: Date.now() });
      if (mem.phaseHistory.length > 50) mem.phaseHistory.shift();
    }

    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════

  DomainBrainBase.prototype._getSnapshot = function () {
    return window.LIMENFastBoot ? window.LIMENFastBoot.getConsoleSnapshotSync() : null;
  };

  DomainBrainBase.prototype._getPortalContent = function (opts) {
    var self = this;
    opts = opts || {};
    // Eager opt-in mirrors portal-content-resolver. Per-cycle brain calls
    // (deriveDiagnoses / recommendTreatments default-pass nothing) → eager
    // is false → static 404 is the end of the road, no /api/fetch-portal
    // request is constructed. Document-side / drill-deeper code may pass
    // {eager:true} to restore the GitHub-backed fallback for deep leaves.
    var eager = !!(opts.eager || opts.recursive);

    if (this._portalCache && (Date.now() - this._portalCacheAge) < this._PORTAL_CACHE_TTL) {
      return Promise.resolve(this._portalCache);
    }
    var pid = this.portalKey || this.domainId;

    // Negative-cache short-circuit: a portalKey that 404'd in the last hour
    // does not get refetched — neither browser console nor network logs a
    // second request. This is the load-bearing guard against the per-brain
    // /api/fetch-portal flood (~38 calls per 30s cycle, page-wide).
    var neg = _negPortalCache[pid];
    if (neg && (Date.now() - neg) < PORTAL_NEG_TTL) {
      return Promise.resolve(self._portalCache || null);
    }

    return fetch('/assets/data/domains/' + pid + '.json')
      .then(function (r) { if (!r.ok) throw new Error('static ' + r.status); return r.json(); })
      .catch(function () {
        if (!eager) {
          // Non-eager (per-cycle brain) path: end of road. Negative-cache
          // and return null without calling /api/fetch-portal. The brain
          // still gets every L1 portal that DID ship in the deploy bundle;
          // missing leaves are treated as optional.
          _negPortalCache[pid] = Date.now();
          return null;
        }
        // Eager only: GitHub-backed API fallback. Non-2xx rejects so the
        // outer .catch can populate the negative cache, suppressing the
        // 404/502 storm that recurs when the GITHUB_TOKEN is rate-limited.
        return fetch('/api/fetch-portal?domainId=' + pid)
          .then(function (r) {
            if (!r.ok) throw new Error('api ' + r.status);
            return r.json();
          })
          .then(function (data) {
            if (data && data.error) throw new Error('api error envelope');
            return data;
          });
      })
      .then(function (data) {
        if (data) {
          self._portalCache = data;
          self._portalCacheAge = Date.now();
        }
        return data;
      })
      .catch(function () {
        _negPortalCache[pid] = Date.now();
        return self._portalCache;
      });
  };

  DomainBrainBase.prototype._emitEvent = function (name, detail) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('limen:' + name, { detail: detail }));
    }
  };

  DomainBrainBase.prototype.getState = function () {
    return this.state;
  };

  // ══════════════════════════════════════════════════════════════════════
  // REQUEST STEERING SURFACE (generic) — the write path the operator AI box uses.
  // A prompt enters as a decaying BIAS, never a command to an effector, never forces
  // a finding. Energy overrides applyRequestBias / getStateSummary with spine-level
  // versions; every other domain uses these generic (view-level re-rank) ones.
  // ══════════════════════════════════════════════════════════════════════
  var DB_BIAS_TTL = 20 * 60 * 1000;   // operator steer relaxes over ~20 min (a task set, not a command)

  DomainBrainBase.prototype._readRequestBiases = function () {
    var rb = this.state._requestBiasRaw;
    if (!rb) return { stressBias: 0, attentionFocus: [], valuationLane: null, active: false };
    var age = Date.now() - (rb.updatedAt || 0);
    var factor = Math.max(0, 1 - age / DB_BIAS_TTL);
    if (factor <= 0) return { stressBias: 0, attentionFocus: [], valuationLane: null, active: false };
    return { stressBias: (rb.stressBias || 0) * factor, attentionFocus: rb.attentionFocus || [], valuationLane: rb.valuationLane || null, active: true, decay: Math.round(factor * 100) / 100 };
  };

  DomainBrainBase.prototype.applyRequestBias = function (bias) {
    bias = bias || {};
    var rb = this.state._requestBiasRaw || { stressBias: 0, attentionFocus: [], valuationLane: null };
    if (bias.clear) rb = { stressBias: 0, attentionFocus: [], valuationLane: null };
    if (typeof bias.stressBias === 'number') rb.stressBias = Math.max(0, Math.min(0.3, bias.stressBias));   // clamped: steer can never dominate
    if (Array.isArray(bias.attentionFocus)) rb.attentionFocus = bias.attentionFocus.slice(0, 5).map(function (x) { return String(x); });
    if (bias.valuationLane === 'INVESTABLE' || bias.valuationLane === 'RESEARCHABLE') rb.valuationLane = bias.valuationLane;
    rb.updatedAt = Date.now();
    this.state._requestBiasRaw = rb;
    try { this._applyRequestSteer(); } catch (e) {}
    return this._readRequestBiases();
  };

  // View-level re-rank of the current opportunities + diagnoses by the active bias.
  // Uses _baseRank so repeated cycles never compound the multiplier.
  DomainBrainBase.prototype._applyRequestSteer = function () {
    var rb = this._readRequestBiases(); if (!rb || !rb.active) return;
    var focus = (rb.attentionFocus || []).map(function (f) { return String(f).toLowerCase(); });
    var lane = rb.valuationLane;
    var opps = this.state.opportunities || [];
    opps.forEach(function (o) {
      if (o._baseRank === undefined) o._baseRank = (typeof o.rank === 'number') ? o.rank : 0;
      var r = o._baseRank;
      var hay = String(o.title || '').toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) r *= 1.4;
      if (lane && o.path === lane) r *= 1.3;
      o.rank = r;
    });
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    var dg = this.state.diagnoses || [];
    dg.forEach(function (d) { var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase(); d._focus = focus.some(function (f) { return f && hay.indexOf(f) !== -1; }) ? 1 : 0; });
    dg.sort(function (a, b) { if ((b._focus || 0) !== (a._focus || 0)) return (b._focus || 0) - (a._focus || 0); if (a.active !== b.active) return a.active ? -1 : 1; return (b.relevance || 0) - (a.relevance || 0); });
  };

  // Bounded control surface (autonomy toggle, capital envelope). No code edits.
  DomainBrainBase.prototype.setDomainConfig = function (cfg) {
    cfg = cfg || {};
    var c = this.state._domainConfig = this.state._domainConfig || { maxConcurrent: 5, lanes: ['INVESTABLE', 'RESEARCHABLE'], autonomy: false };
    if (typeof cfg.autonomy === 'boolean') c.autonomy = cfg.autonomy;
    if (typeof cfg.maxConcurrent === 'number') c.maxConcurrent = Math.max(1, Math.min(12, Math.round(cfg.maxConcurrent)));
    if (Array.isArray(cfg.lanes)) { var allow = cfg.lanes.filter(function (l) { return l === 'INVESTABLE' || l === 'RESEARCHABLE'; }); if (allow.length) c.lanes = allow; }
    return { autonomy: c.autonomy, maxConcurrent: c.maxConcurrent, lanes: c.lanes };
  };

  // Compact domain readout — the context the box/LLM gets so it "knows its own domain".
  DomainBrainBase.prototype.getStateSummary = function () {
    var s = this.state, cog = s.cognition || {}, m = cog.model || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).slice(0, 8).map(function (d) { return { id: d.id, relevance: d.relevance, blocked: !!d.blocked }; });
    var opps = (s.opportunities || []).slice(0, 6).map(function (o) { return { title: o.title, path: o.path, confidence: o.confidence }; });
    var cfg = s._domainConfig || {};
    var intero = s.interoception || null;
    var caveat = (intero && intero.channelCount > 1)
      ? ('multimodal interoception (Phase 1): ' + intero.channelCount + ' channels, confidence-weighted divergence'
         + (intero.salience === 'blind-channel' ? ' — BLIND CHANNEL: ' + intero.attend + ' alarmed while financial calm'
            : intero.salience === 'financial-only' ? ' — financial-only alarm (other channels calm)'
            : ' — channels aligned')
         + '; not yet full predictive-coding active inference')
      : 'readings rest on a single-channel interoceptive layer; multimodal not yet built';
    return {
      domain: this.domainId, label: this.label,
      stress: Math.round((s.stress || 0) * 100) / 100, phase: s.phase || null, phaseLabel: s.phaseLabel || null,
      regulation: (m.regulation && (m.regulation.state || m.regulation)) || null,
      predictionError: (m.predictionError && (typeof m.predictionError === 'object' ? m.predictionError.total : m.predictionError)) || null,
      predictedStress: (typeof m.predictedStress === 'number') ? m.predictedStress : null,
      immune: (cog.immune && cog.immune.immuneState) || null,
      activeDiagnoses: active, topOpportunities: opps,
      config: { autonomy: !!cfg.autonomy, maxConcurrent: cfg.maxConcurrent || 5, lanes: cfg.lanes || ['INVESTABLE', 'RESEARCHABLE'] },
      activeSteering: this._readRequestBiases(),
      interoception: intero ? { salience: intero.salience, attend: intero.attend, divergence: intero.divergence, integrated: intero.integrated, primaryAlarm: intero.primaryAlarm, consensusOther: intero.consensusOther, channelCount: intero.channelCount, uncertainty: intero.uncertainty, channels: intero.channels } : null,
      interoceptionCaveat: caveat
    };
  };

  // ══════════════════════════════════════════════════════════════════════
  // GENERIC K-STACK — energy's advanced brain-dynamics layers, generalized to EVERY
  // domain (energy keeps its own richer version; the guard skips it). Attached to
  // state.cognition.neuro after each cycle (one-cycle lag, recurrent by design). Reads the
  // normalized cognition surface + recurrent model + stress history; advisory analytical
  // layers. The homeostasis layer IS the ADAPTIVE afferent THRESHOLD (Turrigiano scaling).
  // Autonomous emission / capital-fit packaging stay energy-specific (the acting layer).
  // ══════════════════════════════════════════════════════════════════════
  var GK_HOMEO_WINDOW = 60, GK_FORECAST_WINDOW = 12, GK_FORECAST_HORIZON = 8, GK_OUTCOME_BUF = 40, GK_SLOW_RATE = 0.08;
  function gkClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  DomainBrainBase.prototype._computeGenericKStack = function () {
    if (typeof this._runEnergyAutonomousEmission === 'function') return;   // energy has its own richer K-stack
    var st = this.state, cog = st.cognition; if (!cog) return;
    var m = cog.model || {};
    var pe = (m.predictionError && typeof m.predictionError === 'object') ? (m.predictionError.total || 0) : (m.predictionError || 0);
    var reg = (m.regulation && typeof m.regulation === 'object') ? m.regulation : { state: m.regulation };
    var ps = (typeof m.predictedStress === 'number') ? m.predictedStress : (st.stress || 0);
    var imm = cog.immune || {}, con = cog.conscience || {};
    var diags = st.diagnoses || [];
    var hist = ((st.memory && st.memory.stressHistory) || []);
    var cur = (typeof st.stress === 'number') ? st.stress : 0;

    // homeostasis — ADAPTIVE afferent threshold (rolling baseline; Turrigiano synaptic scaling)
    var win = hist.slice(-GK_HOMEO_WINDOW), n = win.length, sum = 0; for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;
    var homeostasis = { baseline: Math.round(baseline * 1000) / 1000, deviation: Math.round((cur - baseline) * 1000) / 1000, scalingFactor: baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1, adaptiveThreshold: Math.round(gkClamp(0.10 * (baseline / 0.5), 0.05, 0.25) * 1000) / 1000, samples: n, note: 'adaptive afferent threshold: baseline-scaled firing threshold' };

    // brake — stop-circuit (advisory)
    var reasons = [];
    if (imm.immuneState === 'alert') reasons.push({ code: 'immune-alert', severity: 'halt' });
    if (reg.stale) reasons.push({ code: 'stale-feeds', severity: 'halt' });
    if (reg.flooding) reasons.push({ code: 'flooding', severity: 'dampen' });
    if (pe > 0.4) reasons.push({ code: 'prediction-error-spike', severity: 'dampen' });
    if (con.conscienceState === 'restrictive' && con.artifactReadinessDecision && !con.artifactReadinessDecision.researchReady && !con.artifactReadinessDecision.investmentReady) reasons.push({ code: 'conscience-no-lane', severity: 'dampen' });
    var halt = reasons.some(function (r) { return r.severity === 'halt'; }), dampen = reasons.some(function (r) { return r.severity === 'dampen'; });
    var brake = { level: halt ? 'halt' : dampen ? 'dampen' : 'clear', reasons: reasons, note: 'stop-circuit (advisory; energy has the gated version)' };

    // gain — neuromodulation (advisory)
    var novelty = gkClamp(pe, 0.05, 0.95);
    var gainControl = { gain: novelty, inhibition: gkClamp(1 - novelty, 0, 0.9), outputScale: gkClamp(1 - gkClamp(1 - novelty, 0, 0.9) * 0.5, 0.4, 1), note: 'graded gain (advisory)' };

    // attention — top-down salience
    var scored = diags.map(function (d) { return { id: d.id, active: !!d.active, salience: Math.round(((d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1) * 1000) / 1000 }; }).sort(function (a, b) { return b.salience - a.salience; });
    var attention = { focus: scored.slice(0, 3), driver: reg.state === 'surprised' ? 'novelty-driven' : 'goal-driven', note: 'attention ranking (advisory)' };

    // inhibition — lateral, winner-take-most
    var active = diags.filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var inhibition = { winner: active[0] ? active[0].id : null, competitors: active.slice(1, 6).map(function (d) { return d.id; }), note: 'winner-take-most (advisory)' };

    // slow model — consolidation track (fast-vs-slow divergence = regime shift)
    var slow = st._gkSlow || { expectedStress: 0.5, samples: 0 };
    slow.expectedStress = gkClamp(slow.expectedStress + GK_SLOW_RATE * (cur - slow.expectedStress), 0, 1); slow.samples++;
    st._gkSlow = slow;
    var slowModel = { expectedStress: Math.round(slow.expectedStress * 1000) / 1000, fastSlowDivergence: Math.round(Math.abs(cur - slow.expectedStress) * 1000) / 1000, regimeShift: Math.abs(cur - slow.expectedStress) > 0.25, samples: slow.samples, note: 'slow consolidation (uses slow rate 0.08)' };

    // truth brake — outcome ledger (this cycle's realized vs LAST cycle's predicted stress)
    var buf = st._gkOutcomeBuf || [];
    if (st._gkPrevPred != null) { buf.push(Math.abs(st._gkPrevPred - cur)); if (buf.length > GK_OUTCOME_BUF) buf.shift(); }
    st._gkPrevPred = ps; st._gkOutcomeBuf = buf;
    var hit = buf.length ? buf.filter(function (e) { return e <= 0.1; }).length / buf.length : null;
    var outcomeLedger = { samples: buf.length, hitRate: hit == null ? null : Math.round(hit * 100) / 100, meanError: buf.length ? Math.round((buf.reduce(function (a, b) { return a + b; }, 0) / buf.length) * 1000) / 1000 : null, note: 'truth brake: forecast-vs-realized calibration (measurement only)' };

    // forecast — forward render with falsifier (trend-projected, calibrated by truth brake)
    var fh = hist.slice(-GK_FORECAST_WINDOW), fn = fh.length, slope = 0;
    if (fn >= 3) { var sx = 0, sy = 0, sxy = 0, sxx = 0; for (var j = 0; j < fn; j++) { var x = j, yy = fh[j].stress || 0; sx += x; sy += yy; sxy += x * yy; sxx += x * x; } var dd = fn * sxx - sx * sx; slope = dd !== 0 ? (fn * sxy - sx * sy) / dd : 0; }
    var projected = gkClamp(cur + slope * GK_FORECAST_HORIZON, 0, 1);
    var direction = slope > 0.005 ? 'rising' : slope < -0.005 ? 'falling' : 'stable';
    var conf = Math.round(gkClamp((1 - pe) * (hit == null ? 0.7 : hit), 0, 1) * 100) / 100;
    var forecast = { direction: direction, projectedStress: Math.round(projected * 1000) / 1000, horizonPeriods: GK_FORECAST_HORIZON, confidence: conf, falsifier: 'stress moves >= 0.1 against the projection within ' + GK_FORECAST_HORIZON + ' periods', note: 'forward render with falsifier (front-run, not nowcast)' };

    var neuro = { version: 1, status: 'generic', homeostasis: homeostasis, brake: brake, gainControl: gainControl, attention: attention, inhibition: inhibition, slowModel: slowModel, outcomeLedger: outcomeLedger, forecast: forecast, note: 'generic K-stack (analytical + gated). Autonomous emission stays energy-specific.' };
    cog.neuro = neuro; st.domainNeuro = neuro;
    return neuro;
  };

  // CLOSED LOOP — the generic brake actually gates this domain's emitted opportunities (not just
  // reports). halt -> hold + zero confidence; dampen -> halve confidence + gain-scaled soft cap.
  // Runs after the generic K-stack in the base cycle. Energy gates its own emission (skipped here).
  // Non-destructive: opportunities are rebuilt fresh each cycle by surfaceOpportunities, so this
  // re-applies from the current brake without compounding.
  DomainBrainBase.prototype._applyGenericBrakeGate = function () {
    if (typeof this._runEnergyAutonomousEmission === 'function') return;   // energy gates its own
    var st = this.state, neuro = st.domainNeuro; if (!neuro || !neuro.brake) return;
    var brake = neuro.brake, opps = st.opportunities || [];
    if (brake.level === 'clear') { st.opportunitiesHeld = false; return; }
    var pen = brake.level === 'halt' ? 0 : 0.5;
    var codes = (brake.reasons || []).map(function (r) { return r.code; }).join(',');
    for (var i = 0; i < opps.length; i++) {
      if (typeof opps[i].confidence === 'number' && pen < 1) opps[i].confidence = Math.round(opps[i].confidence * pen);
      if (brake.level === 'halt') { opps[i].held = true; opps[i].heldReason = codes; }
    }
    st.opportunitiesHeld = (brake.level === 'halt');
    // dampen -> gain-scaled soft cap: mark the ranked tail as gated (non-destructive; consumers may skip)
    var gc = neuro.gainControl;
    if (brake.level === 'dampen' && gc && typeof gc.outputScale === 'number' && gc.outputScale < 1 && opps.length > 1) {
      var keep = Math.max(1, Math.round(opps.length * gc.outputScale));
      for (var k = keep; k < opps.length; k++) opps[k].gainGated = true;
      st._gainGatedCount = Math.max(0, opps.length - keep);
    }
    return { level: brake.level, held: st.opportunitiesHeld };
  };

  // ══════════════════════════════════════════════════════════════════════
  // MULTIMODAL INTEROCEPTION (Phase 1) — generic, EVERY domain (energy self-skips;
  // it keeps its own richer _computeEnergyInteroception). The domain's stress read was
  // single-channel (structured/financial) = alexithymic: the self-model could score
  // itself calm on money while other live channels screamed. This integrates the
  // channels the brain ALREADY computes this cycle (no new data systems) into one
  // confidence-weighted interoceptive read and detects DIVERGENCE — the primary
  // financial channel disagreeing with the consensus of the others. The blind-channel
  // case (financial calm, another channel alarmed) is surfaced via `attend` + logged
  // so "did it flag a real divergence" is measurable (behaviour, not a moved number).
  //
  // North-star discipline: ONE engine + per-domain weight profile (config, not 100
  // systems — the moat surface); explicitly Phase 1 (confidence-weighted + divergence,
  // NOT full predictive-coding active inference); OBSERVE-ONLY — never modifies
  // state.stress or the scoring spine. Additive. Reads cognition.model + the generic
  // K-stack (domainNeuro: outcomeLedger, forecast) computed earlier this cycle.
  //
  // NOTE — this is the PER-BRAIN self-model divergence (internal channels). A separate
  // window-level instrument (interoceptive-divergence.js) logs cross-domain divergence
  // between EXTERNAL channels (polarity/balance/escalation) and records how it resolved;
  // that one is the empirical calibration source for the weight overrides below.
  // ══════════════════════════════════════════════════════════════════════
  var INTERO_DIV_T = 0.22;
  // Per-domain weight profiles. Default mirrors energy's Phase-1 priors. Overrides are
  // the "config not 100 systems" surface — to be CALIBRATED from real divergence-
  // resolution data (interoceptive-divergence.js), never hard-coded as if measured, so
  // the table ships empty until that data exists. Every domain uses the default today.
  var INTERO_WEIGHTS_DEFAULT = { financial: 1.0, prediction: 0.85, regulation: 0.7, metacognitive: 0.75, immune: 0.6, allostatic: 0.6 };
  var INTERO_WEIGHTS_BY_DOMAIN = { /* domainId: { …overrides… } — populated by calibration, not by hand */ };

  DomainBrainBase.prototype._computeGenericInteroception = function () {
    if (typeof this._runEnergyAutonomousEmission === 'function') return;   // energy has its own richer version
    var st = this.state, cog = st.cognition; if (!cog) return;
    var m = cog.model || {}, neuro = st.domainNeuro || cog.neuro || {};
    var cl = function (x) { return Math.max(0, Math.min(1, x)); };
    var r3 = function (x) { return Math.round(x * 1000) / 1000; };
    var W = INTERO_WEIGHTS_BY_DOMAIN[this.domainId] || INTERO_WEIGHTS_DEFAULT;

    var channels = [];

    // 1. FINANCIAL / structured (primary) — the single channel the old caveat named.
    channels.push({ name: 'financial', primary: true, alarm: r3(cl(st.stress || 0)), confidence: 0.9, weight: W.financial, provenance: 'structured stress' });

    // 2. PREDICTION — predictive-coding surprise (is the model surprised?).
    var pe = (m.predictionError && typeof m.predictionError === 'object') ? m.predictionError.total : m.predictionError;
    if (typeof pe === 'number') channels.push({ name: 'prediction', alarm: r3(cl(pe)), confidence: 0.7, weight: W.prediction, provenance: 'model prediction error' });

    // 3. REGULATION — homeostatic set-point (regulated vs surprised/starving/flooding).
    var reg = (m.regulation && typeof m.regulation === 'object') ? m.regulation : { state: m.regulation };
    if (reg.state || reg.starving || reg.flooding) {
      var ra = reg.starving ? 0.8 : (reg.state === 'surprised' ? 0.65 : (reg.flooding ? 0.55 : (/dysreg|alarm|stress/i.test(String(reg.state)) ? 0.7 : 0.15)));
      channels.push({ name: 'regulation', alarm: r3(ra), confidence: 0.6, weight: W.regulation, provenance: 'regulation state (' + (reg.state || (reg.starving ? 'starving' : 'flooding')) + ')' });
    }

    // 4. METACOGNITIVE — truth brake / outcome ledger (am I actually being right?).
    var led = neuro.outcomeLedger || {};
    if (typeof led.hitRate === 'number' && led.samples >= 3) {
      channels.push({ name: 'metacognitive', alarm: r3(cl(1 - led.hitRate)), confidence: led.samples >= 5 ? 0.7 : 0.4, weight: W.metacognitive, provenance: 'realized hit-rate (' + led.samples + ' samples)' });
    }

    // 5. IMMUNE — self-integrity ('active' is often baseline for quarantined synthetic
    //    antigens, so it is down-weighted; only 'alert' screams).
    var im = cog.immune || {};
    if (im.immuneState) {
      var iaMap = { clear: 0, watch: 0.34, active: 0.4, alert: 1.0 };
      var ia = (typeof iaMap[im.immuneState] === 'number') ? iaMap[im.immuneState] : 0.34;
      channels.push({ name: 'immune', alarm: r3(ia), confidence: im.immuneState === 'active' ? 0.4 : 0.6, weight: W.immune, provenance: 'immune state (' + im.immuneState + ')' });
    }

    // 6. ALLOSTATIC — forward render (am I heading somewhere worse than now?).
    var fc = neuro.forecast || null;
    if (fc && typeof fc.projectedStress === 'number') {
      var cur = st.stress || 0;
      var rising = fc.direction === 'rising' || fc.projectedStress > cur;
      var aa = rising ? cl((fc.projectedStress - cur) * 3) : cl((fc.projectedStress - cur) * 1.5);
      channels.push({ name: 'allostatic', alarm: r3(aa), confidence: (typeof fc.confidence === 'number' ? cl(fc.confidence) : 0.4), weight: W.allostatic, provenance: 'forecast (' + (fc.direction || '?') + ')' });
    }

    // ── Integration (confidence × weight; NOT a naive sum) ──
    var primary = channels[0], others = channels.slice(1);
    var wsum = function (arr) { var num = 0, den = 0; for (var i = 0; i < arr.length; i++) { var ew = arr[i].weight * arr[i].confidence; num += arr[i].alarm * ew; den += ew; } return den > 0 ? num / den : 0; };
    var consensusOther = others.length ? wsum(others) : 0;
    var integrated = wsum(channels);
    var alarms = channels.map(function (c) { return c.alarm; });
    var uncertainty = alarms.length ? (Math.max.apply(null, alarms) - Math.min.apply(null, alarms)) : 0;

    // ── Divergence / blind-channel salience ──
    var pa = primary.alarm, divergence = consensusOther - pa;   // positive => calm on money, alarmed elsewhere
    var salience = 'aligned', attend = null;
    if (others.length && divergence >= INTERO_DIV_T && pa < 0.5) {
      var best = null;
      for (var j = 0; j < others.length; j++) {
        if (others[j].alarm < 0.4) continue;
        var sc = others[j].alarm * others[j].confidence;
        if (!best || sc > best._sc) { best = others[j]; best._sc = sc; }
      }
      if (best) { salience = 'blind-channel'; attend = best.name; }
    } else if (pa >= 0.5 && (pa - consensusOther) >= INTERO_DIV_T) {
      salience = 'financial-only';   // money alarmed, other channels calm — financial-specific / possible overreaction
    }

    // ── Behaviour log: record blind-channel flags so "did it flag divergence" is measurable ──
    if (!this._interoLog) this._interoLog = [];
    if (salience === 'blind-channel') {
      this._interoLog.push({ cycle: (m.cycle || this._cycleCount || 0), attend: attend, divergence: r3(divergence), primaryAlarm: r3(pa), consensusOther: r3(consensusOther) });
      if (this._interoLog.length > 20) this._interoLog = this._interoLog.slice(-20);
    }

    var intero = {
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
      recentDivergences: this._interoLog.slice(-8),
      note: 'observe-only; integrates this brain\'s own live channels; does NOT modify stress/scoring; per-domain weight profile; full active inference not yet built'
    };
    st.interoception = intero; cog.interoception = intero; st.domainInteroception = intero;
    return intero;
  };

  // ══════════════════════════════════════════════════════════════════════
  // REGISTRY — civilization layer discovers all active domain brains
  // ══════════════════════════════════════════════════════════════════════

  var _registry = {};

  function registerBrain(brain) {
    _registry[brain.domainId] = brain;
  }

  function getBrain(domainId) {
    return _registry[domainId] || null;
  }

  function getAllBrains() {
    return _registry;
  }

  function getAllStates() {
    var states = {};
    for (var dk in _registry) {
      states[dk] = _registry[dk].getState();
    }
    return states;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENDomainBrainBase = DomainBrainBase;
  window.LIMENDomainBrains = {
    register: registerBrain,
    get: getBrain,
    getAll: getAllBrains,
    getAllStates: getAllStates
  };

})();
