/**
 * brain-v2/interocept/culture.js — CULTURE's own interoception. INDIVIDUAL.
 *
 * Three structural measures this brain takes OF ITSELF, from its own declarations in
 * bind/culture.js only. No new feeds, no labels, no thresholds, no scoring, no activation.
 *
 *   1. LATENCY FLOOR — a finding cannot fire sooner than its slowest required channel.
 *   2. DIASCHISIS — which findings lose their basis when one channel goes dark.
 *   3. RESERVE — worst-case knockout depth, measured by progressive lesion.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT CULTURE MEASURES ABOUT ITSELF (measured 2026-08-15).
 *
 * ZERO findings over SIXTEEN channels. This brain has no detector at all.
 *
 * All three measures return the degenerate case, and the degenerate case is the finding:
 *   - latency floor is UNDEFINED, because there is nothing that can fire;
 *   - diaschisis is zero for every channel, because no channel feeds anything;
 *   - worst-case knockout depth is 0, because the domain is already at zero findings.
 *
 * Fifteen of the sixteen channels are `r7` article-recency counts. bind/culture.js declined
 * to build findings on them, which is the correct call — a finding on an article count
 * reports publishing volume as a cultural condition. So the emptiness here is a deliberate
 * abstention, not an oversight, and this file's job is to keep it VISIBLE rather than let a
 * fully-wired sixteen-channel domain read as a working brain.
 *
 * A knockout depth of 0 must never be read as robustness. It is the opposite: there is
 * nothing left to knock out.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var BINDER = require('../bind/culture.js');

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
    domain: 'culture', findings: per,
    fastestMs: known.length ? Math.min.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    slowestMs: known.length ? Math.max.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    // Explicit, so a null floor is never mistaken for an instant one.
    noDetector: FINDINGS.length === 0,
    note: FINDINGS.length === 0
      ? 'UNDEFINED: this domain declares no findings, so there is no error it can surface at any latency.'
      : 'Floor set by cadence alone. A finding cannot surface faster than its slowest required channel refreshes.'
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
    domain: 'culture', channels: per,
    loadBearingCount: loadBearing.length,
    silentCount: per.length - loadBearing.length,
    totalChannels: per.length,
    note: 'Every channel is silent: this domain declares no findings, so no channel loss produces an observable deficit.'
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
    domain: 'culture', worstCaseKnockout: order.length, order: order,
    unreachableFindings: surviving.map(function (f) { return f.id; }),
    totalFindings: FINDINGS.length,
    alreadyBlind: FINDINGS.length === 0,
    note: FINDINGS.length === 0
      ? 'Depth 0 because the domain is ALREADY at zero findings. This is blindness, not robustness.'
      : 'worstCaseKnockout is how many ADVERSARIALLY CHOSEN channel losses take this domain to zero findings.'
  };
}

function report() {
  return {
    domain: 'culture',
    latency: latency(), diaschisis: diaschisis(), reserve: reserve(),
    interpretive: true, activates: false
  };
}

module.exports = {
  domain: 'culture',
  latency: latency, diaschisis: diaschisis, reserve: reserve, report: report
};
