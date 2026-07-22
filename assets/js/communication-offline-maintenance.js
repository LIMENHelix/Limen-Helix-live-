/*
 * communication-offline-maintenance.js  — ADDITIVE reference implementation
 * ----------------------------------------------------------------------------
 * Concrete form of the OFFLINE_CYCLE proposal (docs/communication-offline-cycle-proposal.md).
 * Source (only): LIMEN Helix Comprehensive Neurology Reference — XIII.9, XIII.6, IV.6, XIV.
 *
 * CONTRACT:
 *   - Operates on a DEEP COPY of the passed Communication object. Never mutates the input.
 *   - NEVER writes to disk / never touches assets/data/domains/communication.json.
 *   - Numeric parameters are operator-set; the source document supplies the SHAPE, not the
 *     rates. Defaults below make the pass a verified NO-OP so nothing changes until the
 *     operator deliberately sets values.
 *   - Operation 2 (signal clearance) is SKIPPED with a flag: Communication has no signal-age field.
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    downscaleFactor: 1,      // (0,1]; multiplicative: w' = w * factor. 1 => no-op. operator-set (rate NOT in document).
    consolidateTopK: Infinity, // protect top-K edges by weight from down-scaling. operator-set.
    pruneThreshold: 0        // prune edges with weight <= threshold; 0 => prune nothing (no-op). operator-set.
  };

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function runOfflineMaintenance(communication, params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    var out = deepCopy(communication); // never touch the input
    var edges = Array.isArray(out.edges) ? out.edges : [];
    var report = { operations: {}, paramsUsed: p, wrote: false };

    // ---- Operation 1: global down-scaling + selective consolidation (XIII.9 + XIII.6) ----
    // Faithful to "down-scales synapses globally": proportional multiplicative scaling
    // (w' = w * factor, factor <= 1) -> reduces total drive, preserves relative order/ratios.
    var weighted = edges.filter(function (e) { return typeof e.weight === 'number'; });
    // rank edges by weight desc; top-K are consolidated (protected from down-scaling)
    var ranked = weighted.slice().sort(function (a, b) { return b.weight - a.weight; });
    var protectedSet = new Set(ranked.slice(0, p.consolidateTopK === Infinity ? ranked.length : p.consolidateTopK));
    var totalBefore = weighted.reduce(function (s, e) { return s + e.weight; }, 0);
    var changed = 0;
    weighted.forEach(function (e) {
      if (protectedSet.has(e)) return;                 // consolidated: untouched
      if (p.downscaleFactor === 1) return;             // no-op
      var nw = e.weight * p.downscaleFactor;           // proportional down-scaling (never increases drive)
      if (nw !== e.weight) { e.weight = nw; changed++; }
    });
    var totalAfter = weighted.reduce(function (s, e) { return s + e.weight; }, 0);
    report.operations.downscale = {
      basis: 'XIII.9 global down-scaling + XIII.6 homeostatic scaling (proportional, w*factor)',
      consolidatedProtected: protectedSet.size,
      edgesDownscaled: changed, totalDriveBefore: totalBefore, totalDriveAfter: totalAfter,
      noop: (p.downscaleFactor === 1)
    };

    // ---- Operation 2: signal clearance / termination (IV.6 + XIV) — CANNOT RUN ----
    report.operations.clearance = {
      basis: 'IV.6 termination + XIV excitotoxicity',
      status: 'SKIPPED',
      reason: 'Communication activations carry no age/timestamp/persistence field; nothing to key "stale" on. Not faked. Needs a per-signal last-active field first.'
    };

    // ---- Operation 3: waste clearance / pruning (XIII.9 glymphatic + XIV) ----
    var before = edges.length;
    if (p.pruneThreshold > 0) {
      out.edges = edges.filter(function (e) { return !(typeof e.weight === 'number' && e.weight <= p.pruneThreshold); });
    }
    report.operations.prune = {
      basis: 'XIII.9 glymphatic clearance + XIV neurodegeneration',
      threshold: p.pruneThreshold, edgesBefore: before, edgesAfter: out.edges.length,
      pruned: before - out.edges.length, noop: (p.pruneThreshold <= 0)
    };

    // ---- Operation 4: E/I re-balance check (XIII.1) — REPORT ONLY, no mutation ----
    var inc = {};
    out.edges.forEach(function (e) {
      inc[e.target] = inc[e.target] || { excit: 0, inhib: 0 };
      if (e.type === 'excit') inc[e.target].excit++;
      else if (e.type === 'inhib') inc[e.target].inhib++;
    });
    report.operations.eiCheck = {
      basis: 'XIII.1 E/I balance (report only)',
      caveat: 'Communication inhib edges target canonical nodes outside the 21 activations; do NOT flag seizure risk on activation in-degree alone.',
      perTargetInDegree: inc
    };

    return { maintained: out, report: report };
  }

  var API = { runOfflineMaintenance: runOfflineMaintenance, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.CommunicationOfflineMaintenance) root.CommunicationOfflineMaintenance = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
