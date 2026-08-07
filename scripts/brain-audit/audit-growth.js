/**
 * audit-growth.js — does the serialized state VALUE grow with ticks? Read-only, no Redis.
 *
 * audit-cost.js measured one 120-row cycle. Production runs hourly for weeks. If the value
 * grows without bound, every future cycle carries it, because each cycle reads the whole
 * state and writes it back. Measured at 120 / 240 / 360 / full replay.
 *
 * UNIT: UTF-8 length of the serialized state VALUE. NOT bytes on the wire. The Upstash REST
 * transport re-encodes this value and adds an envelope, so it must not be doubled into
 * bandwidth, projected into a bill, or compared with a request-size ceiling. It measures
 * RELATIVE growth, which is what the batch-2 gate turns on. This file printed a bandwidth
 * and a monthly figure once; both were withdrawn in review of PR #7.
 */
'use strict';
var fs = require('fs'), path = require('path');
/* Two levels up: this file lives in scripts/brain-audit/. Resolved against __dirname,
   never process.cwd(), so the answer does not depend on where it was invoked from. */
var ROOT = path.join(__dirname, '..', '..');
var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
var HOUR = 3600000;

var MARKS = [120, 240, 360];
var res = [];

REG.DOMAINS.forEach(function (d) {
  var binder = require(REG.binderPath(d));
  var spec = binder.spec();
  var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
  var rows = (doc.rows || []).slice().sort(function (a, b) { return a.t - b.t; });

  var loop = LOOP.create({ domain: d.snapshot, brainSpec: spec, horizonMs: 6 * HOUR,
    vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR } });

  var sizes = {}, ticks = 0;
  for (var i = 0; i < rows.length; i++) {
    var rd = binder.readRecorderRow(rows[i]) || {};
    if (Object.keys(rd).length) { LOOP.tick(loop, rd, rows[i].t); ticks++; }
    if (MARKS.indexOf(i + 1) >= 0) sizes['r' + (i + 1)] = +(JSON.stringify(LOOP.serialize(loop)).length / 1024).toFixed(1);
  }
  sizes.full = +(JSON.stringify(LOOP.serialize(loop)).length / 1024).toFixed(1);
  res.push({ product: d.product, rows: rows.length, ticks: ticks, sizes: sizes });
});

fs.writeFileSync(path.join(__dirname, 'growth-out.json'), JSON.stringify(res, null, 1));

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function lpad(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }
console.log('domain          ticks   @120KB  @240KB  @360KB  fullKB   growth120->full');
res.forEach(function (r) {
  var g = (r.sizes.r120 && r.sizes.full) ? (r.sizes.full / r.sizes.r120).toFixed(2) + 'x' : '-';
  console.log(pad(r.product, 15) + lpad(r.ticks, 5) + lpad(r.sizes.r120 || '-', 9) +
    lpad(r.sizes.r240 || '-', 8) + lpad(r.sizes.r360 || '-', 8) + lpad(r.sizes.full, 8) + lpad(g, 17));
});
var maxFull = Math.max.apply(null, res.map(function (r) { return r.sizes.full; }));
var sumFull = res.reduce(function (a, r) { return a + r.sizes.full; }, 0);
console.log('\nlargest single-domain state at full replay: ' + maxFull.toFixed(1) + ' KB  (' + (maxFull / 1024).toFixed(2) + ' MB)');
console.log('all 20 at full replay: ' + (sumFull / 1024).toFixed(2) + ' MB');
console.log('');
console.log('NOT a bandwidth or billing figure. These are serialized VALUE lengths; actual');
console.log('transport bytes are not measured anywhere. See the unit note in the header.');
