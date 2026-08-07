/**
 * audit-readiness.js — READ-ONLY readiness audit of all 20 domains.
 *
 * Writes nothing, touches no network, touches no Redis. Measures the fixtures that PR #4
 * recorded from production feed history, using the SAME binder call the runtime uses
 * (binder.readRecorderRow) and the SAME kernel loop, so the numbers describe the real path
 * rather than a helper written for the audit.
 *
 * Store I/O is excluded from the cycle-cost measurement on purpose: lib/brain-shadow-store
 * is strict Redis with no memory fallback and this session has no credentials. What is
 * measured is the compute half, which is the part that scales with domain count.
 */
'use strict';

var fs = require('fs');
var path = require('path');
/* Two levels up: this file lives in scripts/brain-audit/. Resolved against __dirname,
   never process.cwd(), so the answer does not depend on where it was invoked from. */
var ROOT = path.join(__dirname, '..', '..');
var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));

var MAX_ROWS_PER_CYCLE = 120;      // mirrors lib/brain-shadow-runtime.js
var HOUR = 3600000;
var DEFAULT_HORIZON_MS = 6 * HOUR;
var MIN_DISTINCT = 6;              // the analyzer's relationship gate, both sides
var NOW = Date.parse('2026-08-06T16:36:00Z');   // merge time of 2ead52f2; fixed, not Date.now()

var out = [];

REG.DOMAINS.forEach(function (d) {
  var row = {
    product: d.product, snapshot: d.snapshot, aliased: d.aliased,
    state: null, binderOk: false, loadError: null,
    channels: 0, relationships: 0, findings: 0,
    rows: 0, firstT: null, lastT: null, spanH: null, ageH: null,
    channelsRead: 0, channelsUnread: [], unreadNames: [],
    suChannels: 0, distinctTotal: 0, perChannel: [],
    rels: [], relsEligible: 0,
    tickMs: null, ticks: 0, abstained: 0, rowsInFirstCycle: 0,
    throws: null, notes: []
  };

  var insp = REG.inspect(d.snapshot);
  row.state = insp.state;
  row.binderOk = !!insp.binder && !insp.loadError;
  row.loadError = insp.loadError || null;
  row.channels = insp.channels || 0;
  row.relationships = insp.relationships || 0;
  row.findings = insp.findings || 0;
  if (insp.fixtureWhy) row.notes.push(insp.fixtureWhy);

  if (!row.binderOk) { out.push(row); return; }

  var binder = require(REG.binderPath(d));
  var spec = binder.spec();
  var fp = REG.fixturePath(d);
  if (!fs.existsSync(fp)) { row.notes.push('no fixture file'); out.push(row); return; }

  var doc;
  try { doc = JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { row.notes.push('fixture unparseable: ' + e.message); out.push(row); return; }

  var rows = (doc.rows || []).slice().sort(function (a, b) { return a.t - b.t; });
  row.rows = rows.length;
  if (rows.length) {
    row.firstT = rows[0].t; row.lastT = rows[rows.length - 1].t;
    row.spanH = +((row.lastT - row.firstT) / HOUR).toFixed(1);
    row.ageH = +((NOW - row.lastT) / HOUR).toFixed(1);
  }

  // ── per-channel occurrence / identity measurement over EVERY row ──────────
  var occ = {}, withSu = {}, distinct = {};
  spec.channels.forEach(function (c) { occ[c.key] = 0; withSu[c.key] = 0; distinct[c.key] = new Set(); });

  var threw = null;
  for (var i = 0; i < rows.length; i++) {
    var readings;
    try { readings = binder.readRecorderRow(rows[i]) || {}; }
    catch (e) { threw = 'row ' + i + ': ' + e.message; break; }
    Object.keys(readings).forEach(function (k) {
      if (occ[k] === undefined) return;
      occ[k]++;
      var oid = readings[k].observationId;
      if (oid !== undefined && oid !== null && oid !== '') { withSu[k]++; distinct[k].add(String(oid)); }
    });
  }
  row.throws = threw;

  spec.channels.forEach(function (c) {
    var n = distinct[c.key].size;
    if (occ[c.key] > 0) row.channelsRead++;
    else { row.channelsUnread.push(c.key); row.unreadNames.push(c.name); }
    if (withSu[c.key] > 0) row.suChannels++;
    row.distinctTotal += n;
    row.perChannel.push({ key: c.key, name: c.name, occ: occ[c.key], withSu: withSu[c.key], distinct: n });
  });

  // ── relationship eligibility: BOTH sides need >= 6 distinct identities ────
  (spec.relationships || []).forEach(function (r) {
    var a = distinct[r.a] ? distinct[r.a].size : 0;
    var b = distinct[r.b] ? distinct[r.b].size : 0;
    var ok = a >= MIN_DISTINCT && b >= MIN_DISTINCT;
    if (ok) row.relsEligible++;
    row.rels.push({ latent: r.latent, a: r.a, b: r.b, aDistinct: a, bDistinct: b, eligible: ok });
  });

  // ── cycle cost: the runtime's exact inner loop, cold start, 120-row cap ───
  try {
    var loop = LOOP.create({
      domain: d.snapshot,
      brainSpec: spec,
      horizonMs: DEFAULT_HORIZON_MS,
      vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR }
    });
    var fresh = rows.slice(0, MAX_ROWS_PER_CYCLE);
    row.rowsInFirstCycle = fresh.length;
    var t0 = process.hrtime.bigint();
    fresh.forEach(function (rw) {
      var rd = binder.readRecorderRow(rw) || {};
      if (!Object.keys(rd).length) { row.abstained++; return; }
      LOOP.tick(loop, rd, rw.t);
      row.ticks++;
    });
    var t1 = process.hrtime.bigint();
    row.tickMs = +(Number(t1 - t0) / 1e6).toFixed(1);
  } catch (e) {
    row.notes.push('LOOP failed: ' + e.message);
    row.tickMs = null;
  }

  out.push(row);
});

fs.writeFileSync(path.join(__dirname, 'audit-out.json'), JSON.stringify(out, null, 1));

// ── console summary ──────────────────────────────────────────────────────────
function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function lpad(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

console.log('domain        state         ch  rd  un  su  dist  rel elig  rows  spanH  ageH  ticks  ms    throws');
out.forEach(function (r) {
  console.log(
    pad(r.product, 13) + pad(r.state, 14) +
    lpad(r.channels, 2) + lpad(r.channelsRead, 4) + lpad(r.channelsUnread.length, 4) +
    lpad(r.suChannels, 4) + lpad(r.distinctTotal, 6) + lpad(r.relationships, 5) + lpad(r.relsEligible, 5) +
    lpad(r.rows, 6) + lpad(r.spanH === null ? '-' : r.spanH, 7) + lpad(r.ageH === null ? '-' : r.ageH, 6) +
    lpad(r.ticks, 7) + lpad(r.tickMs === null ? '-' : r.tickMs, 6) + '  ' + (r.throws || ''));
});

var live = ['energy', 'finance'];
var cand = out.filter(function (r) { return live.indexOf(r.product) < 0; });
console.log('\ntotal domains: ' + out.length + '  live: 2  candidates: ' + cand.length);
console.log('bound: ' + out.filter(function (r) { return r.state === 'bound'; }).length +
            '  manifest-only: ' + out.filter(function (r) { return r.state === 'manifest-only'; }).length +
            '  unbound: ' + out.filter(function (r) { return r.state === 'unbound'; }).length);
console.log('candidates with 0 unread channels: ' + cand.filter(function (r) { return r.channelsUnread.length === 0; }).length);
console.log('candidates with any source identity: ' + cand.filter(function (r) { return r.suChannels > 0; }).length);
console.log('candidates with any eligible relationship: ' + cand.filter(function (r) { return r.relsEligible > 0; }).length);
console.log('total declared relationships across candidates: ' + cand.reduce(function (a, r) { return a + r.relationships; }, 0));
console.log('sum of candidate cycle ms: ' + cand.reduce(function (a, r) { return a + (r.tickMs || 0); }, 0).toFixed(1));
