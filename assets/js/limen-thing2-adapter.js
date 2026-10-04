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
function readDomainStress(domainId, state) {
  state = state || {};
  var field = typeof state.finalStress === 'number' ? 'finalStress' : 'stress';
  var stress = state[field];
  var valid = state.status !== 'INIT' && typeof stress === 'number' && Number.isFinite(stress) && stress >= 0 && stress <= 1;
  return {
    domainId: domainId,
    status: valid ? 'OBSERVED' : 'UNKNOWN',
    stress: valid ? stress : null,
    stressPercent: valid ? Math.round(stress * 100) : null,
    source: state.stressSource === 'domain-snapshot' ? 'domain-snapshot' : 'domain-brain',
    sourceField: field,
    updated: state.updated || null,
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

var domainReadings = Object.create(null);
var API = {
  phaseOfSeries: phaseOfSeries,
  readDomainStress: readDomainStress,
  getDomainStress: function (domainId) {
    // Always prefer the current brain, including when the module loads after
    // the first cycle. An old event must not override a newer brain reading.
    var registry = typeof window !== 'undefined' && window.LIMENDomainBrains;
    var brain = registry && typeof registry.get === 'function' && registry.get(domainId);
    if (brain && typeof brain.getState === 'function') return readDomainStress(domainId, brain.getState());
    return domainReadings[domainId] || null;
  },
  ready: true,
  version: 'thing2-adapter-2'
};
if (typeof window !== 'undefined') window.LIMENThing2 = API;
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('limen:domain-brain-update', function (event) {
    var detail = event.detail;
    if (!detail || typeof detail.domainId !== 'string' || !detail.state) return;
    domainReadings[detail.domainId] = readDomainStress(detail.domainId, detail.state);
  });
}
if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') {
  window.dispatchEvent(new CustomEvent('limen:thing2-ready'));
}
export { phaseOfSeries, readDomainStress };
export default API;
