/**
 * brain-v2/interocept/technology.js — TECHNOLOGY's own interoception. INDIVIDUAL.
 *
 * Three structural measures this brain takes OF ITSELF, from its own declarations in
 * bind/technology.js only. No new feeds, no labels, no thresholds, no scoring, no
 * activation.
 *
 *   1. LATENCY FLOOR — a finding cannot fire sooner than its slowest required channel.
 *   2. DIASCHISIS — which findings lose their basis when one channel goes dark.
 *   3. RESERVE — worst-case knockout depth, measured by progressive lesion.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT TECHNOLOGY MEASURES ABOUT ITSELF (measured 2026-08-15).
 *
 * THREE findings over TEN channels, and only TWO channels carry them: `cisaKev` and
 * `nvdCves`. Both are vulnerability counts, both refresh daily, so the latency floor is 1d
 * across all three findings.
 *
 * The third finding, VULNERABILITY_COUNTS_CO_DEPARTING, requires BOTH channels. That makes
 * it strictly more fragile than either single-channel finding: it is the first thing lost
 * to any lesion on either side. Worst-case knockout depth is 2 — lose cisaKev and nvdCves
 * and this brain is blind, with eight channels still reporting normally.
 *
 * This domain shares `cisaKev` with law and intelligence. That is a CORRELATED lesion:
 * one upstream outage removes the load-bearing channel from three of twenty brains
 * simultaneously, and all three would continue to look healthy. Correlated failure across
 * domains is not visible from inside any single domain's own numbers, which is exactly why
 * each domain states its shared dependency here rather than assuming someone aggregates it.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var BINDER = require('../bind/technology.js');

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
      unknownCadence: unknown
    };
  });
  var known = per.filter(function (p) { return p.floorMs !== null; });
  return {
    domain: 'technology', findings: per,
    fastestMs: known.length ? Math.min.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    slowestMs: known.length ? Math.max.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    note: 'Floor set by cadence alone. A finding cannot surface faster than its slowest required channel refreshes.'
  };
}

function diaschisis() {
  var per = CHANNELS.map(function (c) {
    var lostFindings = FINDINGS.filter(function (f) {
      return (f.requires || []).indexOf(c.key) >= 0;
    }).map(function (f) { return f.id; });
    var lostRels = RELATIONSHIPS.filter(function (r) {
      return r.a === c.key || r.b === c.key;
    }).map(function (r) { return r.id || (r.a + '~' + r.b); });
    return {
      key: c.key, findingsLost: lostFindings, relationshipsLost: lostRels,
      silent: lostFindings.length === 0 && lostRels.length === 0
    };
  });
  var loadBearing = per.filter(function (p) { return !p.silent; });
  return {
    domain: 'technology', channels: per,
    loadBearingCount: loadBearing.length,
    silentCount: per.length - loadBearing.length,
    totalChannels: per.length,
    note: 'Deficit is measured at the FINDINGS a channel feeds, not at the channel. A silent channel can go dark with no observable change.'
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
    domain: 'technology', worstCaseKnockout: order.length, order: order,
    unreachableFindings: surviving.map(function (f) { return f.id; }),
    totalFindings: FINDINGS.length,
    note: 'worstCaseKnockout is how many ADVERSARIALLY CHOSEN channel losses take this domain to zero findings. Not a guarantee for random losses.'
  };
}

function report() {
  return {
    domain: 'technology',
    latency: latency(), diaschisis: diaschisis(), reserve: reserve(),
    interpretive: true, activates: false
  };
}

module.exports = {
  domain: 'technology',
  latency: latency, diaschisis: diaschisis, reserve: reserve, report: report
};
