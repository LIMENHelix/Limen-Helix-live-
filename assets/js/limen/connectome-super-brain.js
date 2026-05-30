/**
 * LIMEN Helix — Connectome Super-Brain
 *
 * Turns the static brain-node-domains.json + connectome-node-registry
 * lookup into a LIVING substrate. Subscribes to upstream emissions
 * (civilization, master, domain brains via broker.subscribeAll),
 * propagates activation across the 123-node graph using stress-weighted
 * edge logic, and emits its own connectome pattern with current
 * activation state, dark/hot regions, and cross-domain affinities.
 *
 * This is the layer the original audit called "static lookup, not living
 * substrate." This module is what makes it living.
 *
 * Exposed via window.LIMENConnectomeSuperBrain.
 *
 * Depends on: LIMENPatternEnvelope, LIMENPatternBroker, LIMENSuperBrainBase.
 * Optional fetch: /assets/data/brain-node-domains.json (loaded once at init)
 * Optional fetch: /assets/data/connectome-node-registry.json (loaded once)
 */
(function (root) {
  'use strict';

  var Envelope = root.LIMENPatternEnvelope;
  var Broker = root.LIMENPatternBroker;
  var Base = root.LIMENSuperBrainBase;
  if (!Envelope || !Broker || !Base) {
    console.error('[ConnectomeSuperBrain] missing dependencies');
    return;
  }

  // Decay constant per cycle. Higher = activation fades faster.
  var DECAY_PER_CYCLE = 0.18;
  // Activation bump per upstream-pattern node mention.
  var BUMP_PER_MENTION = 0.12;
  // Cross-binding propagation weight (how much activation spreads to bound nodes).
  var PROPAGATE_FRACTION = 0.05;

  function ConnectomeSuperBrain(options) {
    if (!(this instanceof ConnectomeSuperBrain)) {
      return new ConnectomeSuperBrain(options);
    }
    options = options || {};
    Base.call(this, 'connectome', 'connectome', Object.assign({
      cycleIntervalMs: 7000
    }, options));

    this._nodeDomains = null;       // brainNodeId → { roles: {domain: roleLabel} }
    this._activations = {};         // brainNodeId → activationWeight 0..1
    this._lastActivationAt = {};    // brainNodeId → ts
    this._loaded = false;
    this._loadError = null;
    this._totalMentions = 0;

    var self = this;
    this._loadNodeDirectory().then(function () {
      // Subscribe to ALL emissions so connectome can ingest from any brain.
      Broker.subscribeAll('connectome:ingest', function (env) {
        self._ingestUpstream(env);
      });
    });
  }
  ConnectomeSuperBrain.prototype = Object.create(Base.prototype);
  ConnectomeSuperBrain.prototype.constructor = ConnectomeSuperBrain;

  // ── Loader ─────────────────────────────────────────────────────────
  ConnectomeSuperBrain.prototype._loadNodeDirectory = function () {
    var self = this;
    if (typeof fetch !== 'function') {
      this._loadError = 'fetch-unavailable';
      return Promise.resolve();
    }
    return fetch('/assets/data/brain-node-domains.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        var idx = {};
        if (json && typeof json === 'object') {
          Object.keys(json).forEach(function (nodeId) {
            var v = json[nodeId];
            if (Array.isArray(v)) {
              // Canonical shape: array of { domain, label, role } mappings.
              // Collapse into the { domain: roleLabel } map the propagation +
              // affinity logic expects. Previously this fell into the object
              // branch below, where v.roles === undefined => {} => the
              // cross-domain propagation and crossDomainAffinities silently
              // no-op'd for every node. (See 2026-05-25 audit.)
              var roles = {};
              for (var mi = 0; mi < v.length; mi++) {
                var m = v[mi];
                if (m && typeof m === 'object' && m.domain) {
                  roles[m.domain] = m.role || m.label || m.domain;
                }
              }
              idx[nodeId] = { label: nodeId, roles: roles, aliases: [] };
              self._activations[nodeId] = 0;
            } else if (v && typeof v === 'object') {
              // Legacy / object shape fallback ({ label, roles|domainRoles }).
              idx[nodeId] = {
                label: v.label || v.name || nodeId,
                roles: v.roles || v.domainRoles || {},
                aliases: v.aliases || []
              };
              self._activations[nodeId] = 0;
            }
          });
        }
        self._nodeDomains = idx;
        self._loaded = true;
      })
      .catch(function (err) {
        self._loadError = String(err && err.message || err);
        self._nodeDomains = {};
      });
  };

  // ── Ingest upstream patterns ───────────────────────────────────────
  ConnectomeSuperBrain.prototype._ingestUpstream = function (env) {
    if (!env || !env.pattern) return;
    if (env.brainId === this.brainId) return; // don't ingest self

    var nodes = env.pattern.nodes || {};
    var bumped = 0;
    for (var nodeId in nodes) {
      if (!nodes.hasOwnProperty(nodeId)) continue;
      var n = nodes[nodeId];
      var weight = (n && typeof n.weight === 'number') ? n.weight : 0.5;
      this._activations[nodeId] = Math.min(1, (this._activations[nodeId] || 0) + BUMP_PER_MENTION * weight);
      this._lastActivationAt[nodeId] = Date.now();
      bumped++;
    }
    if (bumped > 0) this._totalMentions += bumped;
  };

  // ── Decay + propagation per cycle ──────────────────────────────────
  ConnectomeSuperBrain.prototype._decayAndPropagate = function () {
    var newActivations = {};
    var keys = Object.keys(this._activations);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = this._activations[k] * (1 - DECAY_PER_CYCLE);
      if (v < 0.001) v = 0;
      newActivations[k] = v;
    }
    // Cross-binding propagation: nodes that share a domain role get a
    // fractional activation transfer from active siblings.
    if (this._nodeDomains) {
      var domainNodes = {}; // domain → [{nodeId, weight}]
      for (var nodeId in this._nodeDomains) {
        if (!this._nodeDomains.hasOwnProperty(nodeId)) continue;
        var roles = this._nodeDomains[nodeId].roles || {};
        for (var d in roles) {
          if (!roles.hasOwnProperty(d)) continue;
          if (!domainNodes[d]) domainNodes[d] = [];
          domainNodes[d].push({ nodeId: nodeId, w: this._activations[nodeId] || 0 });
        }
      }
      for (var dom in domainNodes) {
        if (!domainNodes.hasOwnProperty(dom)) continue;
        var siblings = domainNodes[dom];
        var totalActivation = 0;
        for (var s = 0; s < siblings.length; s++) totalActivation += siblings[s].w;
        if (totalActivation < 0.05) continue;
        var share = (totalActivation * PROPAGATE_FRACTION) / siblings.length;
        for (var s2 = 0; s2 < siblings.length; s2++) {
          newActivations[siblings[s2].nodeId] = Math.min(1, (newActivations[siblings[s2].nodeId] || 0) + share);
        }
      }
    }
    this._activations = newActivations;
  };

  // ── Kernel readout: connectome-scope activation summary ────────────
  ConnectomeSuperBrain.prototype._computeKernels = function (_inputs) {
    this._decayAndPropagate();

    var kernels = Envelope.emptyKernels();

    var activeCount = 0;
    var hotCount = 0;
    var totalActivation = 0;
    var peak = { node: null, weight: 0 };
    for (var nodeId in this._activations) {
      if (!this._activations.hasOwnProperty(nodeId)) continue;
      var w = this._activations[nodeId];
      if (w > 0.05) activeCount++;
      if (w > 0.5) hotCount++;
      totalActivation += w;
      if (w > peak.weight) peak = { node: nodeId, weight: w };
    }
    var totalNodes = Object.keys(this._nodeDomains || {}).length || 1;
    var systemicLoad = totalActivation / totalNodes;
    var trajectory = systemicLoad > 0.40 ? 'ESCALATING' : (systemicLoad < 0.15 ? 'STABLE' : 'WATCH');

    kernels.thing2 = {
      kernelId: 'connectome-activation-kernel-v1',
      kernelVersion: '1.0.0',
      dominantPhase: peak.node ? ('node-' + peak.node) : null,
      phaseConfidence: clamp(peak.weight, 0, 1),
      phaseVector: { activeNodes: activeCount, hotNodes: hotCount, totalNodes: totalNodes },
      stress: clamp(systemicLoad, 0, 1),
      trajectory: trajectory,
      coupling: {
        mode: 'connectome_propagation',
        source: 'subscribeAll',
        intrinsic: null,
        coupled: null,
        biasContributions: null
      },
      interpretiveOnly: true
    };

    kernels.thing1 = {
      kernelId: 'connectome-validated-stub',
      kernelVersion: null,
      validationStatus: 'unavailable',
      alert: null,
      distressBand: null,
      narrativeSafe: ['Connectome-level validated kernel not yet wired.']
    };

    return kernels;
  };

  // ── Pattern projection ─────────────────────────────────────────────
  ConnectomeSuperBrain.prototype._computePattern = function (kernels, _inputs) {
    // Build the nodes map for downstream consumers. Cap to top N to keep
    // pattern envelopes lean — downstream brains can request full state
    // via getActivations().
    var TOP_N = 64;
    var entries = [];
    for (var nodeId in this._activations) {
      if (!this._activations.hasOwnProperty(nodeId)) continue;
      var w = this._activations[nodeId];
      if (w > 0.01) entries.push({ nodeId: nodeId, weight: w });
    }
    entries.sort(function (a, b) { return b.weight - a.weight; });
    entries = entries.slice(0, TOP_N);

    var nodes = {};
    var crossDomainAffinities = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var info = (this._nodeDomains || {})[e.nodeId] || {};
      nodes[e.nodeId] = {
        weight: e.weight,
        role: info.label || e.nodeId,
        state: e.weight > 0.5 ? 'hot' : (e.weight > 0.2 ? 'active' : 'warm'),
        sources: []
      };
      // Surface this node's cross-domain bindings as affinities
      var roles = info.roles || {};
      var roleKeys = Object.keys(roles);
      for (var r = 0; r < Math.min(roleKeys.length, 3); r++) {
        crossDomainAffinities.push({
          domain: roleKeys[r],
          role: roles[roleKeys[r]],
          strength: e.weight,
          nodeId: e.nodeId
        });
      }
    }

    // Operators block — connectome contributes to phase-tracking + auditing
    var operators = Envelope.emptyOperators();
    var hotShare = entries.length ? (entries.filter(function(x){return x.weight > 0.5;}).length / entries.length) : 0;
    operators.phaseTracking = { readiness: 1, salience: kernels.thing2.stress, evidence: 0.8, gateSignal: kernels.thing2.dominantPhase };
    operators.phaseLogic    = { readiness: 0.7, salience: hotShare, evidence: 0.6, gateSignal: kernels.thing2.trajectory };
    operators.auditing      = { readiness: this._loaded ? 1 : 0, salience: 0.5, evidence: this._loaded ? 1 : 0, gateSignal: this._loadError };
    operators.reporting     = { readiness: 0.6, salience: 0.3, evidence: 0.5, gateSignal: null };
    // Connectome doesn't directly produce engine artifacts; salience is informational.
    operators.patents       = { readiness: 0, salience: hotShare * 0.4, evidence: 0.3, gateSignal: null };
    operators.grants        = { readiness: 0, salience: hotShare * 0.4, evidence: 0.3, gateSignal: null };
    operators.investments   = { readiness: 0, salience: kernels.thing2.stress * 0.6, evidence: 0.3, gateSignal: null };

    return {
      salience: clamp(0.4 * kernels.thing2.stress + 0.6 * hotShare, 0, 1),
      operators: operators,
      nodes: nodes,
      bindings: [],
      crossDomainAffinities: crossDomainAffinities,
      artifacts: this._drainPendingArtifacts(),
      _meta: {
        loaded: this._loaded,
        totalNodes: Object.keys(this._nodeDomains || {}).length,
        activeNodes: entries.length,
        totalMentionsIngested: this._totalMentions,
        loadError: this._loadError
      }
    };
  };

  ConnectomeSuperBrain.prototype._decideEngines = function (_envelope) {
    return []; // connectome is observational
  };

  // Public: get full activation state (not just top-N)
  ConnectomeSuperBrain.prototype.getActivations = function () {
    return Object.assign({}, this._activations);
  };

  function clamp(n, lo, hi) {
    n = +n;
    if (!isFinite(n)) return 0;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  root.LIMENConnectomeSuperBrain = ConnectomeSuperBrain;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
