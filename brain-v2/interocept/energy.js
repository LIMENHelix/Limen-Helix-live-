/**
 * brain-v2/interocept/energy.js — ENERGY's own interoception. INDIVIDUAL.
 *
 * Three structural measures this brain takes OF ITSELF, from its own declarations in
 * bind/energy.js only. No new feeds, no labels, no thresholds, no scoring, no activation.
 *
 *   1. LATENCY FLOOR — a finding cannot fire sooner than its slowest required channel.
 *   2. DIASCHISIS — which findings AND RELATIONSHIPS lose their basis when a channel dies.
 *   3. RESERVE — worst-case knockout depth, measured by progressive lesion.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT ENERGY MEASURES ABOUT ITSELF (measured 2026-08-15).
 *
 * The richest brain in the system: SIX findings and SEVEN declared relationships over
 * EIGHTEEN channels, with NINE channels load-bearing. Latency floor is 1d for all six
 * findings — uniform, because every channel this domain depends on is daily.
 *
 * ENERGY IS THE DOMAIN THAT PROVES WHY DIASCHISIS NEEDS ITS OWN MEASURE.
 *
 * Four of its channels — eiaPetro, massiveOil, coal, and the second half of several pairs —
 * feed NO finding but DO carry declared relationships. Losing `eiaPetro` kills zero
 * findings, so a finding-only audit reports no deficit at all. What it actually destroys is
 * the fredCrude~eiaPetro comparison: the domain loses its ability to notice that its two
 * oil instruments DISAGREE, while continuing to report the same number of findings as
 * before. That is textbook diaschisis — the damage is real, remote, and invisible at the
 * lesion site.
 *
 * Five findings pair two channels each (GRID_COLLAPSE, PIPELINE_DISRUPTION,
 * RENEWABLE_INTERMITTENCY, NUCLEAR_INCIDENT, SYSTEMIC_ENERGY_STRESS), so most of this
 * brain's detection is conjunctive and therefore more fragile than its channel count
 * suggests. Worst-case knockout depth is 5 of 18.
 *
 * `fredCrude` is the single most load-bearing channel: it carries OIL_SHOCK,
 * SYSTEMIC_ENERGY_STRESS, and two relationships. It is this domain's first lesion target.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var BINDER = require('../bind/energy.js');

var SPEC = BINDER.spec ? BINDER.spec() : BINDER;
var CHANNELS = SPEC.channels || [];
var FINDINGS = SPEC.findings || [];
var RELATIONSHIPS = SPEC.relationships || [];

var HOUR = 3600000;
var DAY = 24 * HOUR;
var WEEK = 7 * DAY;
var MONTH = 30 * DAY;
var YEAR = 365 * DAY;

function cadenceOf(key) {
  for (var i = 0; i < CHANNELS.length; i++) {
    if (CHANNELS[i].key === key) {
      var c = CHANNELS[i].cadenceMs;
      return (typeof c === 'number' && isFinite(c) && c > 0) ? c : null;
    }
  }
  return null;
}

function human(ms) {
  if (ms === null || ms === undefined) return 'unknown';
  if (ms >= YEAR) return Math.round(ms / YEAR) + 'y';
  if (ms >= MONTH) return Math.round(ms / MONTH) + 'mo';
  if (ms >= WEEK) return Math.round(ms / WEEK) + 'w';
  if (ms >= DAY) return Math.round(ms / DAY) + 'd';
  return Math.round(ms / HOUR) + 'h';
}

function latency() {
  var per = FINDINGS.map(function (f) {
    var reqs = f.requires || [];
    var slowestMs = null, boundBy = null, unknown = [];
    reqs.forEach(function (k) {
      var c = cadenceOf(k);
      if (c === null) { unknown.push(k); return; }
      if (slowestMs === null || c > slowestMs) { slowestMs = c; boundBy = k; }
    });
    return {
      id: f.id, requires: reqs.slice(),
      floorMs: unknown.length ? null : slowestMs,
      floorHuman: unknown.length ? 'unknown' : human(slowestMs),
      boundBy: unknown.length ? null : boundBy,
      unknownCadence: unknown,
      conjunctive: reqs.length > 1
    };
  });
  var known = per.filter(function (p) { return p.floorMs !== null; });
  return {
    domain: 'energy', findings: per,
    fastestMs: known.length ? Math.min.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    slowestMs: known.length ? Math.max.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    note: 'Floor set by cadence alone. A conjunctive finding is bound by the SLOWER of its two channels, never the faster.'
  };
}

/**
 * DIASCHISIS. Energy is the domain where `relationshipsLost` carries real weight, so a
 * channel is only `silent` when it feeds NEITHER a finding NOR a relationship. A channel
 * that kills no finding but kills a relationship is reported as `relationshipOnly` — the
 * deficit a finding-only audit would miss entirely.
 */
function diaschisis() {
  var per = CHANNELS.map(function (c) {
    var lostFindings = FINDINGS.filter(function (f) {
      return (f.requires || []).indexOf(c.key) >= 0;
    }).map(function (f) { return f.id; });
    var lostRels = RELATIONSHIPS.filter(function (r) {
      return r.a === c.key || r.b === c.key;
    }).map(function (r) { return r.id || (r.a + '~' + r.b); });
    return {
      key: c.key,
      findingsLost: lostFindings,
      relationshipsLost: lostRels,
      relationshipOnly: lostFindings.length === 0 && lostRels.length > 0,
      silent: lostFindings.length === 0 && lostRels.length === 0
    };
  });
  var loadBearing = per.filter(function (p) { return !p.silent; });
  return {
    domain: 'energy', channels: per,
    loadBearingCount: loadBearing.length,
    relationshipOnlyCount: per.filter(function (p) { return p.relationshipOnly; }).length,
    silentCount: per.length - loadBearing.length,
    totalChannels: per.length,
    note: 'relationshipOnly channels lose the domain its ability to detect instrument DISAGREEMENT while the finding count stays unchanged. That deficit is invisible at the lesion site.'
  };
}

function reserve() {
  var surviving = FINDINGS.map(function (f) { return { id: f.id, req: (f.requires || []).slice() }; });
  var order = [];
  while (surviving.length) {
    var count = {};
    surviving.forEach(function (f) { f.req.forEach(function (k) { count[k] = (count[k] || 0) + 1; }); });
    var keys = Object.keys(count);
    if (!keys.length) break;
    keys.sort(function (x, y) { return count[y] - count[x] || (x < y ? -1 : 1); });
    var pick = keys[0];
    var killed = surviving.filter(function (f) { return f.req.indexOf(pick) >= 0; }).map(function (f) { return f.id; });
    order.push({ channel: pick, findingsKilled: killed });
    surviving = surviving.filter(function (f) { return f.req.indexOf(pick) < 0; });
  }
  return {
    domain: 'energy', worstCaseKnockout: order.length, order: order,
    unreachableFindings: surviving.map(function (f) { return f.id; }),
    totalFindings: FINDINGS.length,
    note: 'worstCaseKnockout counts FINDINGS only. Relationship loss is not counted here; see diaschisis().relationshipOnly for the deficit this measure cannot see.'
  };
}

function report() {
  return {
    domain: 'energy',
    latency: latency(), diaschisis: diaschisis(), reserve: reserve(),
    interpretive: true, activates: false
  };
}

module.exports = {
  domain: 'energy',
  latency: latency, diaschisis: diaschisis, reserve: reserve, report: report
};
