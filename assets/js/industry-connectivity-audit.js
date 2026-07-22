/*
 * industry-connectivity-audit.js  — ADDITIVE, read-only diagnostics
 * ----------------------------------------------------------------------------
 * Implements two cross-ref build-targets as DIAGNOSTICS on Energy's real graph:
 *   - DENSE_RECURRENT_LATERAL_CONNECTIVITY (source: neuro ref II.2/XIII.2/XIII.8; cross-ref:
 *     brain ~80% recurrent/lateral, an org-tree is the broken version).
 *   - DISTRIBUTED_REDUNDANT_CONTROL / diaschisis (source: neuro ref XIV "network, not node, is
 *     the unit of failure"; XIII.8 distributed control).
 *
 * CONTRACT: read-only. Reports; changes nothing. Adding lateral edges or removing single points
 * of failure would edit energy.json, so this module only DIAGNOSES and recommends.
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  function groupMap(energy) {
    var g = {};
    (energy.activations || []).forEach(function (a) { g[a.brainNodeId] = a.group; });
    return g;
  }

  // Weakly-connected-component count over an edge list (undirected).
  function componentCount(nodes, edges) {
    var adj = {}; nodes.forEach(function (n) { adj[n] = []; });
    edges.forEach(function (e) { if (adj[e.source] && adj[e.target]) { adj[e.source].push(e.target); adj[e.target].push(e.source); } });
    var seen = {}, comps = 0;
    nodes.forEach(function (n) {
      if (seen[n]) return; comps++; var stack = [n];
      while (stack.length) { var x = stack.pop(); if (seen[x]) continue; seen[x] = 1; adj[x].forEach(function (y) { if (!seen[y]) stack.push(y); }); }
    });
    return comps;
  }

  var API = {
    /* DENSE_RECURRENT_LATERAL_CONNECTIVITY — how mesh-like vs tree-like is the graph? */
    recurrenceAudit: function (energy) {
      var edges = energy.edges || [];
      var grp = groupMap(energy);
      var pairSeen = {}, reciprocal = 0, lateral = 0, classifiable = 0, unknownGroup = 0;
      var pairs = {};
      edges.forEach(function (e) { pairs[e.source + '|' + e.target] = true; });
      edges.forEach(function (e) {
        // reciprocal / feedback: reverse edge exists
        if (pairs[e.target + '|' + e.source]) reciprocal++;
        // lateral: same group (needs both endpoints in activation set)
        if (grp[e.source] !== undefined && grp[e.target] !== undefined) {
          classifiable++;
          if (grp[e.source] === grp[e.target]) lateral++;
        } else unknownGroup++;
      });
      var recurrentFraction = edges.length ? (reciprocal / edges.length) : 0;
      var lateralFraction = classifiable ? (lateral / classifiable) : 0;
      return {
        edges: edges.length,
        reciprocalEdges: reciprocal, recurrentFraction: recurrentFraction,
        lateralEdges: lateral, lateralFractionOfClassifiable: lateralFraction,
        unknownGroupEdges: unknownGroup,
        crossref_benchmark: '~80% recurrent/lateral in cortex; a pure top-down tree is the broken (cosmetic) version.',
        verdict: recurrentFraction < 0.2 && lateralFraction < 0.2 ? 'TREE-LIKE (siloing risk; below cortical mesh benchmark)' : 'has recurrent/lateral structure',
        note: 'Read-only. Adding lateral/feedback edges would edit energy.json and is left as a recommendation, not applied.'
      };
    },

    /* DISTRIBUTED_REDUNDANT_CONTROL — single points of failure (diaschisis). Brute-force:
     * removing an articulation node increases connected-component count. */
    singlePointsOfFailure: function (energy) {
      var edges = energy.edges || [];
      var nodeSet = {};
      edges.forEach(function (e) { nodeSet[e.source] = 1; nodeSet[e.target] = 1; });
      var nodes = Object.keys(nodeSet);
      var base = componentCount(nodes, edges);
      var spof = [];
      nodes.forEach(function (n) {
        var remainingNodes = nodes.filter(function (x) { return x !== n; });
        var remainingEdges = edges.filter(function (e) { return e.source !== n && e.target !== n; });
        var c = componentCount(remainingNodes, remainingEdges);
        if (c > base) spof.push({ node: n, componentsAfterRemoval: c, baseComponents: base });
      });
      // also flag hubs by degree
      var deg = {}; edges.forEach(function (e) { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });
      var hubs = Object.keys(deg).map(function (n) { return { node: n, degree: deg[n] }; }).sort(function (a, b) { return b.degree - a.degree; }).slice(0, 5);
      return {
        baseComponents: base, articulationNodes: spof, topHubsByDegree: hubs,
        rule: 'XIV diaschisis: network, not node, is the unit of failure. Articulation nodes are brittle single points; high-degree hubs concentrate risk.',
        verdict: spof.length ? spof.length + ' articulation node(s) = single points of failure' : 'no articulation nodes (graph degrades gracefully)',
        note: 'Read-only diagnostic; adding redundant paths is a recommendation, not applied.'
      };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.IndustryConnectivityAudit) root.IndustryConnectivityAudit = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
