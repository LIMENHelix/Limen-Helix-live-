/**
 * LIMEN Helix — Super-Brain Base
 *
 * Shared lifecycle for the four super-brains in the fractal-recursive
 * system: MasterLivingBrain, CivilizationSuperBrain, ConnectomeSuperBrain,
 * and any future top-level brain that wraps a substrate (e.g., per-company
 * super-brains at the business level).
 *
 * Domain brains (the 20 producers under assets/js/domain-brains/) extend
 * a different base (domain-brain-base.js) — that contract predates this
 * one and remains unchanged. Super-brains BRIDGE domain output into the
 * pattern envelope; they do not replace the domain stack.
 *
 * Lifecycle:
 *   1. constructor(brainId, brainKind, opts) — set identity + intervals
 *   2. subscribeTo([brainIds]) — listen for upstream patterns
 *   3. start() — begin cycle interval; immediately cycle once
 *   4. cycle() — pure compute: inputs → kernels block → pattern → emit
 *   5. runEngines(pattern) — produce + persist engine artifacts
 *   6. stop() — clean up subscriptions + interval
 *
 * Subclasses override:
 *   _computeKernels(inputs)    → returns the two-kernel readout block
 *   _computePattern(kernels, inputs) → returns pattern projection
 *   _decideEngines(envelope)   → returns engine descriptors to fire (or [])
 *
 * Exposed via window.LIMENSuperBrainBase.
 *
 * Depends on: LIMENPatternEnvelope, LIMENPatternBroker.
 */
(function (root) {
  'use strict';

  var Envelope = root.LIMENPatternEnvelope;
  var Broker = root.LIMENPatternBroker;
  if (!Envelope || !Broker) {
    console.error('[LIMENSuperBrainBase] requires LIMENPatternEnvelope + LIMENPatternBroker');
    return;
  }

  /**
   * @param {string} brainId   stable identifier (e.g., 'civilization', 'master', 'connectome')
   * @param {string} brainKind one of: 'master', 'civilization', 'connectome'
   * @param {object} options   { cycleIntervalMs, autoStart, configSig, operator, engineRunner }
   */
  function SuperBrainBase(brainId, brainKind, options) {
    if (!(this instanceof SuperBrainBase)) {
      return new SuperBrainBase(brainId, brainKind, options);
    }
    options = options || {};

    this.brainId = String(brainId);
    this.brainKind = String(brainKind);
    this.cycleIntervalMs = options.cycleIntervalMs > 0 ? options.cycleIntervalMs : 5000;
    this.configSig = options.configSig || null;
    this.operator = options.operator || null;
    this.engineRunner = options.engineRunner || null; // function(envelope, descriptor) → Promise

    this._cycleId = 0;
    this._lastEnvelope = null;
    this._prevSig = null;
    this._upstreamCache = {};        // brainId → latest envelope
    this._unsubscribers = [];
    this._timer = null;
    this._running = false;
    this._inCycle = false;
    this._degradeReasons = [];

    // Register with the broker on construction so subscribers can find us
    // even before our first cycle.
    Broker.register(this.brainId, this.brainKind, {
      cycleIntervalMs: this.cycleIntervalMs
    });

    if (options.autoStart === true) {
      this.start();
    }
  }

  // ── Subscriptions ──────────────────────────────────────────────────
  SuperBrainBase.prototype.subscribeTo = function (brainIds) {
    var self = this;
    if (!Array.isArray(brainIds)) brainIds = [brainIds];
    brainIds.forEach(function (id) {
      if (!id || id === self.brainId) return;
      var off = Broker.subscribe(self.brainId, id, function (env) {
        self._upstreamCache[id] = env;
        // Opt-in immediate re-cycle on upstream change. Subclasses can
        // throttle in _shouldRecycleOnUpstream.
        if (self._shouldRecycleOnUpstream(id, env)) {
          self.cycle();
        }
      });
      self._unsubscribers.push(off);
    });
    return this;
  };

  // Subclasses can override to throttle re-cycles. Default: only re-cycle
  // if the upstream brain's pattern signature changed AND we're already
  // running.
  SuperBrainBase.prototype._shouldRecycleOnUpstream = function (brainId, env) {
    return this._running && env && env.pattern && env.pattern.signature;
  };

  // ── Lifecycle ──────────────────────────────────────────────────────
  SuperBrainBase.prototype.start = function () {
    if (this._running) return this;
    this._running = true;
    var self = this;
    // Fire once immediately so consumers don't wait the full interval.
    Promise.resolve().then(function () { self.cycle(); });
    this._timer = setInterval(function () { self.cycle(); }, this.cycleIntervalMs);
    return this;
  };

  SuperBrainBase.prototype.stop = function () {
    if (!this._running) return this;
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    while (this._unsubscribers.length) {
      try { (this._unsubscribers.pop())(); } catch (_) {}
    }
    return this;
  };

  // ── Core cycle ─────────────────────────────────────────────────────
  SuperBrainBase.prototype.cycle = function () {
    if (this._inCycle) return null; // re-entrancy guard
    this._inCycle = true;
    try {
      this._cycleId++;
      this._degradeReasons = [];

      var inputs = this._collectInputs();
      var kernels;
      var pattern;
      try {
        kernels = this._computeKernels(inputs);
      } catch (e) {
        this._degradeReasons.push({ phase: 'kernels', error: String(e && e.message || e) });
        kernels = Envelope.emptyKernels();
      }
      try {
        pattern = this._computePattern(kernels, inputs);
      } catch (e2) {
        this._degradeReasons.push({ phase: 'pattern', error: String(e2 && e2.message || e2) });
        pattern = { salience: 0, operators: Envelope.emptyOperators(), nodes: {}, bindings: [], crossDomainAffinities: [], artifacts: [] };
      }

      var env = Envelope.create(this.brainId, this.brainKind, {
        cycleId: this._cycleId,
        ts: Date.now(),
        prevSig: this._prevSig
      });
      env.kernels = kernels || Envelope.emptyKernels();
      env.pattern.salience = clamp(pattern.salience, 0, 1);
      env.pattern.operators = mergeOperators(env.pattern.operators, pattern.operators || {});
      env.pattern.nodes = pattern.nodes || {};
      env.pattern.bindings = Array.isArray(pattern.bindings) ? pattern.bindings : [];
      env.pattern.crossDomainAffinities = Array.isArray(pattern.crossDomainAffinities) ? pattern.crossDomainAffinities : [];
      env.pattern.artifacts = Array.isArray(pattern.artifacts) ? pattern.artifacts : [];

      // Record upstream provenance
      for (var id in this._upstreamCache) {
        if (this._upstreamCache.hasOwnProperty(id)) {
          Envelope.recordInput(env, this._upstreamCache[id]);
        }
      }

      // Apply degradation flag if any phase fell back (H5)
      if (this._degradeReasons.length) {
        for (var i = 0; i < this._degradeReasons.length; i++) {
          Envelope.degrade(env, JSON.stringify(this._degradeReasons[i]));
        }
      }

      // Seal — finalize signature + chain (H1)
      Envelope.seal(env, {
        configSig: this.configSig,
        operator: this.operator
      });

      // Decide which engines to fire BEFORE emit — gives subclass a chance
      // to attach artifact references to the pattern before downstream
      // brains see it. Engines fire async; results bind back next cycle.
      var engineDescriptors = [];
      try {
        engineDescriptors = this._decideEngines(env) || [];
      } catch (e3) {
        this._degradeReasons.push({ phase: 'engine-decide', error: String(e3 && e3.message || e3) });
      }

      // Emit pattern first (downstream brains see current state immediately)
      Broker.emit(env);
      this._lastEnvelope = env;
      this._prevSig = env.pattern.signature;

      // Fire engines (async — results bind back via runEngines callback
      // which can call recordArtifact on the next envelope).
      if (engineDescriptors.length && typeof this.engineRunner === 'function') {
        this._fireEngines(env, engineDescriptors);
      }

      return env;
    } finally {
      this._inCycle = false;
    }
  };

  // Collect latest envelopes from upstream cache + return shaped object
  // for subclasses to read.
  SuperBrainBase.prototype._collectInputs = function () {
    var inputs = { byBrain: {}, count: 0 };
    for (var id in this._upstreamCache) {
      if (this._upstreamCache.hasOwnProperty(id)) {
        inputs.byBrain[id] = this._upstreamCache[id];
        inputs.count++;
      }
    }
    return inputs;
  };

  // ── Subclass hooks (override these) ────────────────────────────────
  SuperBrainBase.prototype._computeKernels = function (_inputs) {
    return Envelope.emptyKernels();
  };

  SuperBrainBase.prototype._computePattern = function (_kernels, _inputs) {
    return {
      salience: 0,
      operators: Envelope.emptyOperators(),
      nodes: {},
      bindings: [],
      crossDomainAffinities: [],
      artifacts: []
    };
  };

  SuperBrainBase.prototype._decideEngines = function (_envelope) {
    return [];
  };

  // ── Engine firing ──────────────────────────────────────────────────
  SuperBrainBase.prototype._fireEngines = function (envelope, descriptors) {
    var self = this;
    for (var i = 0; i < descriptors.length; i++) {
      (function (descriptor) {
        var maybePromise;
        try {
          maybePromise = self.engineRunner(envelope, descriptor);
        } catch (err) {
          console.error('[' + self.brainId + '] engineRunner threw:', err);
          return;
        }
        if (!maybePromise || typeof maybePromise.then !== 'function') return;
        maybePromise.then(function (result) {
          if (result && result.outputId) {
            self._pendingArtifacts = self._pendingArtifacts || [];
            self._pendingArtifacts.push({
              engineId: descriptor.engineId || ('engine-' + descriptor.lane),
              lane: descriptor.lane,
              status: result.status || 'READY_TO_SIGN',
              outputId: result.outputId,
              sig: result.persistedSig || null,
              cik: descriptor.cik || null,
              ts: Date.now()
            });
          }
        }).catch(function (err) {
          console.error('[' + self.brainId + '] engine ' + descriptor.lane + ' failed:', err);
        });
      })(descriptors[i]);
    }
  };

  // Subclasses can drain pending artifacts into the next pattern.
  SuperBrainBase.prototype._drainPendingArtifacts = function () {
    var pending = this._pendingArtifacts || [];
    this._pendingArtifacts = [];
    return pending;
  };

  // ── Accessors ──────────────────────────────────────────────────────
  SuperBrainBase.prototype.getLatest = function () {
    return this._lastEnvelope;
  };

  SuperBrainBase.prototype.getCycleCount = function () {
    return this._cycleId;
  };

  // ── Helpers ────────────────────────────────────────────────────────
  function clamp(n, lo, hi) {
    n = +n;
    if (!isFinite(n)) return 0;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function mergeOperators(base, incoming) {
    var keys = Envelope.OPERATOR_KEYS;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var inc = incoming[k];
      if (inc && typeof inc === 'object') {
        base[k] = {
          readiness: clamp(inc.readiness, 0, 1),
          salience:  clamp(inc.salience,  0, 1),
          evidence:  clamp(inc.evidence,  0, 1),
          gateSignal: inc.gateSignal !== undefined ? inc.gateSignal : null
        };
      }
    }
    return base;
  }

  root.LIMENSuperBrainBase = SuperBrainBase;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
