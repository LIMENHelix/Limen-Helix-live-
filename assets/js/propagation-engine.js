/**
 * LIMEN Propagation Engine
 * Spreading activation on the 432-edge connectome weight matrix.
 *
 * window.LIMENPropagation.activate(seed_activations) → activation_vector
 * window.LIMENPropagation.detectGaps(domain_activations_array) → { never_activated, always_activated, orphan_candidates }
 */
(function () {
  'use strict';

  var TIMESTEPS = 5;
  var DECAY = 0.85;
  var SYNAPSE_GAIN = 0.4;
  var MOD_GAIN = 0.2;
  var SILENCE = 0.05;
  var HYPER = 0.95;
  var LATERAL_THRESH = 0.7;
  var LATERAL_SUPPRESS = 0.85;
  var NODE_COUNT = 123;

  // --- adjacency cache (built once) ---
  var adjacency = null;   // adjacency[targetId] = [ { from, weight, type } ]  (incoming)
  var excitNeighbors = null; // excitNeighbors[nodeId] = [ neighborId, ... ]  (outgoing excit for lateral inhibition)
  var edgesRaw = null;
  var allNodeIds = null;

  function ensureAdjacency(edges) {
    if (adjacency && edgesRaw === edges) return;
    edgesRaw = edges;
    adjacency = {};
    excitNeighbors = {};
    allNodeIds = [];
    for (var i = 1; i <= NODE_COUNT; i++) {
      adjacency[i] = [];
      excitNeighbors[i] = [];
      allNodeIds.push(i);
    }
    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e];
      // forward direction: edge.from → edge.to
      adjacency[edge.to].push({ from: edge.from, weight: edge.weight, type: edge.type });
      if (edge.type === 'excit') excitNeighbors[edge.from].push(edge.to);
      // if bidirectional, also edge.to → edge.from
      if (edge.bidirectional) {
        adjacency[edge.from].push({ from: edge.to, weight: edge.weight, type: edge.type });
        if (edge.type === 'excit') excitNeighbors[edge.to].push(edge.from);
      }
    }
  }

  /**
   * Run spreading activation.
   * @param {Object} seedActivations  — { nodeId: activation (0–1) }
   * @param {Array}  [edges]          — override edge list (defaults to fetched connectome-weights.json)
   * @returns {{ activations: Object, hyper: number[] }}
   */
  function activate(seedActivations, edges, steps) {
    if (!edges) {
      if (!_cachedEdges) throw new Error('Call LIMENPropagation.load() first or pass edges directly.');
      edges = _cachedEdges;
    }
    ensureAdjacency(edges);

    // initialise activation vector
    var act = {};
    for (var i = 0; i < allNodeIds.length; i++) {
      var id = allNodeIds[i];
      act[id] = seedActivations[id] || 0;
    }

    var hyperSet = {};

    steps = (steps != null) ? steps : TIMESTEPS;
    for (var t = 0; t < steps; t++) {
      var next = {};
      for (var n = 0; n < allNodeIds.length; n++) {
        var nid = allNodeIds[n];
        var val = act[nid] * DECAY;
        var incoming = adjacency[nid];
        for (var j = 0; j < incoming.length; j++) {
          var inp = incoming[j];
          var neighborAct = act[inp.from];
          if (neighborAct === 0) continue;
          if (inp.type === 'excit') {
            val += neighborAct * inp.weight * SYNAPSE_GAIN;
          } else if (inp.type === 'inhib') {
            val -= neighborAct * inp.weight * SYNAPSE_GAIN;
          } else if (inp.type === 'modulatory') {
            val *= (1 + neighborAct * inp.weight * MOD_GAIN);
          }
        }
        // clamp
        if (val < 0) val = 0;
        if (val > 1) val = 1;
        // silence threshold
        if (val < SILENCE) val = 0;
        // hyper flag
        if (val > HYPER) hyperSet[nid] = true;
        next[nid] = val;
      }
      // lateral inhibition: highly active nodes suppress their excitatory neighbors
      for (var li = 0; li < allNodeIds.length; li++) {
        var liId = allNodeIds[li];
        if (next[liId] > LATERAL_THRESH) {
          var neighbors = excitNeighbors[liId];
          for (var ln = 0; ln < neighbors.length; ln++) {
            var nbId = neighbors[ln];
            if (nbId !== liId) next[nbId] *= LATERAL_SUPPRESS;
          }
        }
      }
      act = next;
    }

    var hyper = [];
    for (var h in hyperSet) {
      if (hyperSet.hasOwnProperty(h)) hyper.push(Number(h));
    }

    return { activations: act, hyper: hyper };
  }

  /**
   * Detect research gaps across multiple seed sets.
   * @param {Array<Object>} domainActivationsArray — array of seed activation objects
   * @param {Array}         [edges]
   * @returns {{ never_activated: number[], always_activated: number[], orphan_candidates: number[] }}
   */
  function detectGaps(domainActivationsArray, edges) {
    if (!edges) {
      if (!_cachedEdges) throw new Error('Call LIMENPropagation.load() first or pass edges directly.');
      edges = _cachedEdges;
    }
    ensureAdjacency(edges);

    var activatedCounts = {};
    for (var i = 0; i < allNodeIds.length; i++) {
      activatedCounts[allNodeIds[i]] = 0;
    }

    var total = domainActivationsArray.length;
    for (var d = 0; d < total; d++) {
      var result = activate(domainActivationsArray[d], edges);
      for (var n = 0; n < allNodeIds.length; n++) {
        var nid = allNodeIds[n];
        if (result.activations[nid] > 0) {
          activatedCounts[nid]++;
        }
      }
    }

    var never_activated = [];
    var always_activated = [];
    for (var k = 0; k < allNodeIds.length; k++) {
      var id = allNodeIds[k];
      if (activatedCounts[id] === 0) never_activated.push(id);
      if (activatedCounts[id] === total) always_activated.push(id);
    }

    // Orphan candidates: nodes with no incoming edges in the adjacency
    var orphan_candidates = [];
    for (var o = 0; o < allNodeIds.length; o++) {
      var oid = allNodeIds[o];
      if (adjacency[oid].length === 0) orphan_candidates.push(oid);
    }

    return {
      never_activated: never_activated,
      always_activated: always_activated,
      orphan_candidates: orphan_candidates
    };
  }

  // --- edge loading ---
  var _cachedEdges = null;

  function load(url) {
    url = url || 'connectome-weights.json';
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _cachedEdges = data.edges;
        ensureAdjacency(_cachedEdges);
        return _cachedEdges;
      });
  }

  // --- public API ---
  window.LIMENPropagation = {
    activate: activate,
    detectGaps: detectGaps,
    load: load
  };
})();
