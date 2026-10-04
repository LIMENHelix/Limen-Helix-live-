// ═══════════════════════════════════════════════════════════════════
// limen-thing2-adapter.js — makes the Thing 2 recursive phase kernel
// callable from the classic-script domain brains.
//
// WHY: limen-thing2-kernel.js is an ES MODULE that exports runLimenPipeline
// (a financial-company phase scorer over {Revenue,OCF,Cash,Debt} quarters).
// The domain brains are classic scripts and cannot import it, and most
// domains have a health/stress trajectory, not financial quarters. This
// adapter (a) imports the kernel, (b) maps a domain's own metric trajectory
// into the kernel's input, (c) runs the REAL kernel, and (d) exposes the
// result on window.LIMENThing2 for the brains to consume as their phase.
//
// HONESTY (hard): output is INTERPRETIVE PHASE POSTURE only. It is NEVER
// validated for a non-financial substrate. This adapter never surfaces the
// kernel's `alert`; it returns interpretive:true, validated:false. Thing 1
// (api/thing1) remains the only validated path. We do NOT modify kernel math.
// ═══════════════════════════════════════════════════════════════════
import { runLimenPipeline, getDominantPhase } from './limen-thing2-kernel.js';

// n quarter keys ("YYYYQn"), oldest first, ending at the current quarter.
function _recentQuarters(n) {
  var now = (typeof Date !== 'undefined') ? new Date() : null;
  var y = now ? now.getFullYear() : 2025;
  var q = now ? Math.floor(now.getMonth() / 3) : 0;   // 0..3
  var keys = [];
  for (var i = n - 1; i >= 0; i--) {
    var qi = q - i, yy = y;
    while (qi < 0) { qi += 4; yy -= 1; }
    keys.push(yy + 'Q' + (qi + 1));
  }
  return keys;
}

// Map a univariate metric array (oldest->newest) into positive LEVEL series
// (the kernel takes level series and computes its own log-diffs). health = the
// up-is-good axis; stress = its inverse (drives the debt/risk features).
function _levels(vals, positive) {
  var out = vals.map(function (v) { var x = Number(v); return isFinite(x) ? x : 0; });
  var min = Math.min.apply(null, out), max = Math.max.apply(null, out);
  var span = (max - min) || 1;
  var health = out.map(function (v) { var h = (v - min) / span; if (!positive) h = 1 - h; return 10 + 100 * h; });
  var stress = health.map(function (h) { return 130 - h; });
  return { health: health, stress: stress };
}

// input: array of numbers (a domain metric over time, oldest->newest), OR
//        { Revenue, OCF, Cash, Debt } arrays for a domain that truly has them, OR
//        { series:[...], positive:bool }.
// opts.positive (default true) = up-is-good for a univariate series.
function phaseOfSeries(input, opts) {
  opts = opts || {};
  try {
    var companyData, nlen;
    var multi = input && !Array.isArray(input) && (input.Revenue || input.OCF || input.Cash || input.Debt);
    if (multi) {
      nlen = Math.max((input.Revenue || []).length, (input.OCF || []).length, (input.Cash || []).length, (input.Debt || []).length);
      if (nlen < 8) return { phase: null, reason: 'insufficient-history', n: nlen, interpretive: true, validated: false };
      var keysM = _recentQuarters(nlen);
      companyData = {};
      ['Revenue', 'OCF', 'Cash', 'Debt'].forEach(function (m) {
        if (input[m] && input[m].length) {
          companyData[m] = {};
          var off = keysM.length - input[m].length;
          input[m].forEach(function (v, i) { companyData[m][keysM[off + i]] = Number(v); });
        }
      });
    } else {
      var vals = Array.isArray(input) ? input : (input && input.series) || [];
      nlen = vals.length;
      if (nlen < 8) return { phase: null, reason: 'insufficient-history', n: nlen, interpretive: true, validated: false };
      var positive = opts.positive !== false;
      var L = _levels(vals, positive);
      var keys = _recentQuarters(nlen);
      companyData = { Revenue: {}, OCF: {}, Cash: {}, Debt: {} };
      for (var i = 0; i < nlen; i++) {
        var qk = keys[i];
        companyData.Revenue[qk] = L.health[i];
        companyData.OCF[qk] = L.health[i];
        companyData.Cash[qk] = L.health[i];
        companyData.Debt[qk] = L.stress[i];
      }
    }
    var res = runLimenPipeline(companyData, {});
    var rows = res.rows || [];
    var last = rows[rows.length - 1] || null;
    // interpretive phase distribution of the current row (for the coherence router)
    var dist = {};
    if (last) ['p0','p1','p2','p3','p4','p5','p6','p7a','p7b','p8','p9','p10'].forEach(function (p) { dist[p] = last[p] || 0; });
    return {
      phase: getDominantPhase(last),        // interpretive P0-P10 posture (current)
      distribution: dist,
      cAccumulator: last ? (last.C_t || 0) : 0,
      trajectory: res.trajectory,           // STABLE / MILD_STRESS / RECOVERED / UNRECOVERED / TERMINAL_DIVERGENCE
      n: rows.length,
      interpretive: true,                   // NEVER validated for non-financial substrate
      validated: false
    };
  } catch (e) {
    return { phase: null, reason: 'error:' + (e && e.message), interpretive: true, validated: false };
  }
}

// A domain owns its feed integration. Route its completed reading unchanged:
// feeds are provenance, not a second additive stress contribution. Percentages
// describe that observed reading, never a phase probability or financial alert.
function readDomainStress(domainId, state, observation) {
  state = state || {};
  var stress = state.stress;
  var valid = observation && observation.status === 'OBSERVED' &&
    observation.domainId === domainId && observation.source === 'domain-snapshot' &&
    observation.stressUsable === true && observation.stressBasis === 'measured' &&
    observation.cycleCompletedAt === state.updated && observation.value === stress &&
    typeof state.updated === 'number' && state.updated > 0 &&
    state.updated <= Date.now() && Date.now() - state.updated < 60000 &&
    typeof stress === 'number' && Number.isFinite(stress) && stress >= 0 && stress <= 1;
  return {
    domainId: domainId,
    status: valid ? 'OBSERVED' : 'UNKNOWN',
    stress: valid ? stress : null,
    stressPercent: valid ? Math.round(stress * 100) : null,
    source: 'domain-brain',
    sourceField: 'stress',
    observation: valid ? observation : null,
    updated: valid ? state.updated : null,
    feeds: (Array.isArray(state.feeds) ? state.feeds : []).filter(function (feed) {
      return feed && typeof feed === 'object';
    }).map(function (feed) {
      return { name: feed.name || null, live: feed.live === true, channel: feed.channel || null, updated: feed.updated || null };
    }),
    phase: state.kernelPhase || null,
    trajectory: state.kernelTrajectory || null,
    interpretive: true,
    validated: false
  };
}

// Readiness belongs to the consumed source, never to INIT/READY/RUNNING or a
// numeric default. The existing server contract explicitly identifies measured
// stress. The same source must still be current, and a completed owning-brain
// cycle must explicitly attest the displayed value. No scoring or history is changed.
function observationOfBrain(domainId, brain, state) {
  var shared = typeof window !== 'undefined' && window.LIMENSharedSnapshot;
  if (!shared || typeof shared.getSnapshot !== 'function' ||
      typeof shared.isFresh !== 'function' || !shared.isFresh()) return null;
  var diagnostics = typeof shared.getDiagnostics === 'function' && shared.getDiagnostics();
  if (diagnostics && diagnostics.errors > 0) return null;
  var snapshot = shared.getSnapshot();
  var source = snapshot && snapshot.domains && snapshot.domains[brain.snapshotKey];
  if (!source || source !== brain._rawDomain || source.stressUsable !== true ||
      source.stressBasis !== 'measured' || source.simulated === true ||
      (source.status !== 'LIVE' && source.status !== 'PARTIAL')) return null;
  var now = Date.now();
  function current(time, maxAge) {
    return typeof time === 'number' && Number.isFinite(time) && time > 0 && time <= now && now - time < maxAge;
  }
  var proof = state.stressObservation;
  if (!proof || proof.source !== 'domain-snapshot' || proof.sourceDomain !== brain.snapshotKey ||
      proof.sourceRecord !== source || proof.cycle !== brain._cycleCount ||
      proof.value !== state.stress || proof.cycleCompletedAt !== state.updated ||
      !current(state.updated, 60000) || !current(source.updated, 300000) ||
      source.updated > state.updated || typeof source.stress !== 'number' ||
      !Number.isFinite(source.stress) || source.stress < 0 || source.stress > 1) return null;
  var drivers = (Array.isArray(source.sources) ? source.sources : []).filter(function (feed) {
    return feed && feed.live === true && feed.channel === 'stress' && feed.classification === 'real' &&
      typeof feed.name === 'string' && feed.name.length > 0 && current(feed.updated, 300000);
  });
  if (!drivers.length) return null;
  return {
    status: 'OBSERVED', domainId: domainId, source: 'domain-snapshot',
    stressUsable: true, stressBasis: 'measured', value: state.stress,
    sourceUpdatedAt: source.updated, cycleCompletedAt: state.updated,
    cycle: proof.cycle, sourceNames: drivers.map(function (feed) { return feed.name; })
  };
}

var API = {
  phaseOfSeries: phaseOfSeries,
  readDomainStress: readDomainStress,
  getDomainStress: function (domainId) {
    var registry = typeof window !== 'undefined' && window.LIMENDomainBrains;
    var brain = registry && typeof registry.get === 'function' && registry.get(domainId);
    if (!brain || typeof brain.getState !== 'function') return readDomainStress(domainId, null);
    var state = brain.getState();
    return readDomainStress(domainId, state, observationOfBrain(domainId, brain, state));
  },
  ready: true,
  version: 'thing2-adapter-3'
};
if (typeof window !== 'undefined') window.LIMENThing2 = API;
if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
  window.dispatchEvent(new CustomEvent('limen:thing2-ready'));
}
export { phaseOfSeries, readDomainStress };
export default API;
