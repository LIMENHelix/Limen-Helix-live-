/**
 * brain-v2/interocept/medicine.js — MEDICINE's own interoception. INDIVIDUAL.
 *
 * Three structural measures this brain takes OF ITSELF, from its own declarations in
 * bind/medicine.js only. No new feeds, no labels, no thresholds, no scoring, no activation.
 * Nothing here emits a clinical claim, a diagnosis, or a recommendation of any kind.
 *
 *   1. LATENCY FLOOR — a finding cannot fire sooner than its slowest required channel.
 *   2. DIASCHISIS — which findings lose their basis when one channel goes dark.
 *   3. RESERVE — worst-case knockout depth, measured by progressive lesion.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT MEDICINE MEASURES ABOUT ITSELF (measured 2026-08-15).
 *
 * FIVE findings over FIFTEEN channels, THREE load-bearing: `adverseEvents`, `drugRecalls`
 * and `drugShortages`. All three are openFDA-family counts of regulatory artefacts —
 * reported adverse events, issued recalls, listed shortages — and all three refresh daily,
 * so every latency floor here is 1d with no spread at all.
 *
 * `drugShortages` carries THREE of the five findings (SUPPLY_SHORTAGE,
 * SAFETY_AND_SUPPLY_TOGETHER, SYSTEMIC_HEALTH_STRESS) and is the first lesion target.
 * Worst-case knockout depth is 3 of 15.
 *
 * THE CAUTION THIS DOMAIN SPECIFICALLY NEEDS. These channels count REPORTS, not incidence.
 * An adverse-event count rises when reporting rises, and the two are not separable from
 * inside this brain. That distinction matters more here than anywhere else in the system,
 * because a count of reports presented as a health condition is the kind of error that
 * would be read as clinical. This module measures the instrument only, and nothing it
 * returns is a statement about health.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var BINDER = require('../bind/medicine.js');

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
    domain: 'medicine', findings: per,
    fastestMs: known.length ? Math.min.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    slowestMs: known.length ? Math.max.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    note: 'Uniform 1d floor across all findings. Latency is not this domain limitation; report-vs-incidence is.'
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
    domain: 'medicine', channels: per,
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
    domain: 'medicine', worstCaseKnockout: order.length, order: order,
    unreachableFindings: surviving.map(function (f) { return f.id; }),
    totalFindings: FINDINGS.length,
    note: 'worstCaseKnockout is how many ADVERSARIALLY CHOSEN channel losses take this domain to zero findings. Not a guarantee for random losses.'
  };
}

function report() {
  return {
    domain: 'medicine',
    latency: latency(), diaschisis: diaschisis(), reserve: reserve(),
    interpretive: true, activates: false
  };
}

module.exports = {
  domain: 'medicine',
  latency: latency, diaschisis: diaschisis, reserve: reserve, report: report
};
