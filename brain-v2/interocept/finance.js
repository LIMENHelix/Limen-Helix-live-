/**
 * brain-v2/interocept/finance.js — FINANCE's own interoception. INDIVIDUAL.
 *
 * Three structural measures this brain takes OF ITSELF, from its own declarations in
 * bind/finance.js only. No new feeds, no labels, no thresholds, no scoring, no activation.
 * Nothing here touches the six-identity pathway gate, and nothing here can activate one.
 *
 *   1. LATENCY FLOOR — a finding cannot fire sooner than its slowest required channel.
 *   2. DIASCHISIS — which findings AND RELATIONSHIPS lose their basis when a channel dies.
 *   3. RESERVE — worst-case knockout depth, measured by progressive lesion.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT FINANCE MEASURES ABOUT ITSELF (measured 2026-08-15).
 *
 * FIVE findings and THREE declared relationships over THIRTEEN channels; FOUR channels are
 * load-bearing. Latency floor is 1h at the fastest — the quickest detection floor of any
 * domain in the system — and 1d at the slowest.
 *
 * The three relationships form a TRIANGLE over the same latent: massiveSpy~finnhub,
 * massiveSpy~alphaVantage, finnhub~alphaVantage. Three vendors quoting one market is the
 * only place in the system where disagreement between instruments is fully triangulated,
 * and it is why VENDOR_DISAGREEMENT exists as a finding rather than being averaged away.
 *
 * That triangle is also this domain's specific fragility. `finnhub` carries two findings
 * (MARKET_DISLOCATION, SYSTEMIC_FINANCIAL_STRESS) plus two of the three relationships, so
 * losing it costs both detection and the ability to tell which surviving vendor is wrong.
 * A domain that can no longer detect vendor disagreement will silently trust whichever
 * feed remains, which is a worse state than knowing it is blind.
 *
 * Worst-case knockout depth 3 of 13.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var BINDER = require('../bind/finance.js');

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
    domain: 'finance', findings: per,
    fastestMs: known.length ? Math.min.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    slowestMs: known.length ? Math.max.apply(null, known.map(function (p) { return p.floorMs; })) : null,
    note: 'Floor set by cadence alone. A conjunctive finding is bound by the SLOWER of its channels, so pairing a 1h channel with a 1d channel yields a 1d floor.'
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
      key: c.key,
      findingsLost: lostFindings,
      relationshipsLost: lostRels,
      relationshipOnly: lostFindings.length === 0 && lostRels.length > 0,
      silent: lostFindings.length === 0 && lostRels.length === 0
    };
  });
  var loadBearing = per.filter(function (p) { return !p.silent; });
  return {
    domain: 'finance', channels: per,
    loadBearingCount: loadBearing.length,
    relationshipOnlyCount: per.filter(function (p) { return p.relationshipOnly; }).length,
    silentCount: per.length - loadBearing.length,
    totalChannels: per.length,
    note: 'Losing a vendor channel can leave the finding count intact while removing the ability to tell WHICH surviving vendor is wrong. That is the deficit this measure exists to expose.'
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
    domain: 'finance', worstCaseKnockout: order.length, order: order,
    unreachableFindings: surviving.map(function (f) { return f.id; }),
    totalFindings: FINDINGS.length,
    note: 'worstCaseKnockout counts FINDINGS only. Relationship loss is not counted; see diaschisis().relationshipOnly.'
  };
}

function report() {
  return {
    domain: 'finance',
    latency: latency(), diaschisis: diaschisis(), reserve: reserve(),
    interpretive: true, activates: false
  };
}

module.exports = {
  domain: 'finance',
  latency: latency, diaschisis: diaschisis, reserve: reserve, report: report
};
