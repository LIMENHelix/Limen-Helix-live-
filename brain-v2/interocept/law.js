/**
 * brain-v2/interocept/law.js — LAW's own interoception. INDIVIDUAL to this domain.
 *
 * WHAT THIS IS. Three structural measures a brain can take OF ITSELF, computed only from
 * this domain's own declarations in bind/law.js. No new feeds, no labels, no thresholds,
 * no scoring, no activation. Nothing here creates a candidate, a stress value, a diagnosis
 * or a pathway. These are observations about the instrument, not about the world.
 *
 *   1. LATENCY FLOOR — the fastest this domain can possibly surface an error.
 *      A finding cannot fire sooner than its slowest required channel refreshes. That is a
 *      hard physical floor set by cadence, independent of how good the predicate is.
 *      Source of the idea: the error-related negativity is fast (~100ms) and its VALUE is
 *      its latency, not its amplitude. A monitor that is correct but late is not a monitor.
 *
 *   2. DIASCHISIS — which findings and relationships lose their basis when one channel
 *      goes dark. Named for the neurological fact that a lesion depresses REMOTE,
 *      undamaged tissue, so measuring only at the damage site understates the injury.
 *      Here the remote units are the findings that silently stop being computable.
 *
 *   3. RESERVE — worst-case knockout depth: the minimum number of channel losses that
 *      takes this domain to zero live findings. Reserve is measured by progressive
 *      knockout, not asserted.
 *
 * WHY THIS FILE IS NOT SHARED. Each domain brain owns its own interoception, the same way
 * each owns its own binder. The numbers below are only meaningful against LAW's channel
 * set, and a generic table over 20 domains would hide exactly the fact this domain most
 * needs to state.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT LAW MEASURES ABOUT ITSELF, stated plainly (measured 2026-08-15).
 *
 * ONE finding over FIFTEEN channels. Fourteen channels are load-free: they are recorded,
 * they cost fetches, and no finding depends on any of them. Losing any of the fourteen
 * changes nothing this brain can say.
 *
 * The single finding is NEW_KEV_30D_DEPARTURE on `cisaKev`, and — as bind/law.js already
 * says at length — it is about software vulnerabilities, not law. So this domain's entire
 * error-detection capacity rests on one channel that does not measure its own subject.
 *
 * Worst-case knockout depth is therefore 1. One channel going dark blinds the domain
 * completely, and because the other fourteen keep reporting, the outage looks like health.
 * That is the precise failure this file exists to make visible.
 *
 * Latency floor: 1d, bounded by cisaKev's daily cadence.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var BINDER = require('../bind/law.js');

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
  return null;   // channel not declared in this domain
}

function human(ms) {
  if (ms === null || ms === undefined) return 'unknown';
  if (ms >= YEAR) return Math.round(ms / YEAR) + 'y';
  if (ms >= MONTH) return Math.round(ms / MONTH) + 'mo';
  if (ms >= WEEK) return Math.round(ms / WEEK) + 'w';
  if (ms >= DAY) return Math.round(ms / DAY) + 'd';
  return Math.round(ms / HOUR) + 'h';
}

/**
 * 1. LATENCY FLOOR. Per finding: the slowest cadence among the channels it requires.
 * A missing/unknown cadence makes the floor UNKNOWN rather than optimistic — an
 * unmeasurable floor must never be reported as a fast one.
 */
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
      id: f.id,
      requires: reqs.slice(),
      floorMs: unknown.length ? null : slowestMs,
      floorHuman: unknown.length ? 'unknown' : human(slowestMs),
      boundBy: unknown.length ? null : boundBy,
      unknownCadence: unknown
    };
  });
  var known = per.filter(function (p) { return p.floorMs !== null; });
  return {
    domain: 'law',
    findings: per,
    fastestMs: known.length ? Math.min.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    slowestMs: known.length ? Math.max.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    note: 'Floor set by cadence alone. A finding cannot surface faster than its slowest required channel refreshes.'
  };
}

/**
 * 2. DIASCHISIS. Per channel: what stops being computable if it goes dark.
 * `silent:true` marks a channel no finding and no relationship depends on — recorded, but
 * load-free. Silence is not an error; publishing it is the point.
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
      silent: lostFindings.length === 0 && lostRels.length === 0
    };
  });
  var loadBearing = per.filter(function (p) { return !p.silent; });
  return {
    domain: 'law',
    channels: per,
    loadBearingCount: loadBearing.length,
    silentCount: per.length - loadBearing.length,
    totalChannels: per.length,
    note: 'Deficit is measured at the FINDINGS a channel feeds, not at the channel. A silent channel can go dark with no observable change, which is why an outage here can look like health.'
  };
}

/**
 * 3. RESERVE. Worst-case knockout depth by greedy progressive lesion: repeatedly remove
 * the channel that currently carries the most surviving findings until none survive.
 * Greedy is an UPPER BOUND on the true minimum; for the small requirement sets declared
 * here it is exact, and it is reported as worst-case either way.
 */
function reserve() {
  var surviving = FINDINGS.map(function (f) { return { id: f.id, req: (f.requires || []).slice() }; });
  var order = [];
  while (surviving.length) {
    var count = {};
    surviving.forEach(function (f) {
      f.req.forEach(function (k) { count[k] = (count[k] || 0) + 1; });
    });
    var keys = Object.keys(count);
    if (!keys.length) break;   // a finding with no declared requirement cannot be knocked out
    keys.sort(function (x, y) { return count[y] - count[x] || (x < y ? -1 : 1); });
    var pick = keys[0];
    var killed = surviving.filter(function (f) { return f.req.indexOf(pick) >= 0; }).map(function (f) { return f.id; });
    order.push({ channel: pick, findingsKilled: killed });
    surviving = surviving.filter(function (f) { return f.req.indexOf(pick) < 0; });
  }
  return {
    domain: 'law',
    worstCaseKnockout: order.length,
    order: order,
    unreachableFindings: surviving.map(function (f) { return f.id; }),
    totalFindings: FINDINGS.length,
    note: 'worstCaseKnockout is how many ADVERSARIALLY CHOSEN channel losses take this domain to zero findings. It is not a survivability guarantee for random losses.'
  };
}

function report() {
  return {
    domain: 'law',
    latency: latency(),
    diaschisis: diaschisis(),
    reserve: reserve(),
    interpretive: true,      // structural self-measurement; never a validated claim
    activates: false         // this module cannot create candidates, stress or pathways
  };
}

module.exports = {
  domain: 'law',
  latency: latency,
  diaschisis: diaschisis,
  reserve: reserve,
  report: report
};
