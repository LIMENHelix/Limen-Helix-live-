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
          updated: s.updated || Date.now()
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
