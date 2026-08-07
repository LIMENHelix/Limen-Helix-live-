/**
 * audit-onset.js — where does each domain's readable data actually START, and what is
 * unavailable. Read-only. The headline audit measures the whole fixture; this measures the
 * FIRST CYCLE, because a domain whose first readable row is past the 120-row cap does
 * nothing at all on its first cycle and that is invisible in a whole-fixture total.
 */
'use strict';
var fs = require('fs'), path = require('path');
/* Two levels up: this file lives in scripts/brain-audit/. Resolved against __dirname,
   never process.cwd(), so the answer does not depend on where it was invoked from. */
var ROOT = path.join(__dirname, '..', '..');
var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
var HOUR = 3600000;

var res = [];
REG.DOMAINS.forEach(function (d) {
  var binder = require(REG.binderPath(d));
  var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
  var rows = (doc.rows || []).slice().sort(function (a, b) { return a.t - b.t; });

  var firstIdx = -1, firstT = null, readableRows = 0, emptyRows = 0;
  var srcNamesSeen = new Set();
  for (var i = 0; i < rows.length; i++) {
    (rows[i].src || []).forEach(function (s) { srcNamesSeen.add(s.n); });
    var n = Object.keys(binder.readRecorderRow(rows[i]) || {}).length;
    if (n) { readableRows++; if (firstIdx < 0) { firstIdx = i; firstT = rows[i].t; } }
    else emptyRows++;
  }

  // which declared channels never appear as a SOURCE NAME in the fixture at all,
  // vs appear but carry no usable number in the declared recordedField
  var spec = binder.spec();
  var absentSource = [], presentButUnusable = [];
  var occ = {};
  spec.channels.forEach(function (c) { occ[c.key] = 0; });
  rows.forEach(function (r) {
    var rd = binder.readRecorderRow(r) || {};
    Object.keys(rd).forEach(function (k) { if (occ[k] !== undefined) occ[k]++; });
  });
  spec.channels.forEach(function (c) {
    if (occ[c.key] > 0) return;
    if (srcNamesSeen.has(c.name)) presentButUnusable.push(c.key + ' (' + c.name + ', wants ' + c.recordedField + ')');
    else absentSource.push(c.key + ' (' + c.name + ')');
  });

  res.push({
    product: d.product, rows: rows.length,
    firstReadableIdx: firstIdx, cyclesToFirstData: firstIdx < 0 ? null : Math.floor(firstIdx / 120) + 1,
    readableRows: readableRows, emptyRows: emptyRows,
    readablePct: +(100 * readableRows / rows.length).toFixed(1),
    absentSource: absentSource, presentButUnusable: presentButUnusable
  });
});

fs.writeFileSync(path.join(__dirname, 'onset-out.json'), JSON.stringify(res, null, 1));

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function lpad(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }
console.log('domain         rows  1stIdx  cyc  readable  empty  read%   absentSrc  unusable');
res.forEach(function (r) {
  console.log(pad(r.product, 14) + lpad(r.rows, 5) + lpad(r.firstReadableIdx, 8) +
    lpad(r.cyclesToFirstData === null ? '-' : r.cyclesToFirstData, 5) +
    lpad(r.readableRows, 10) + lpad(r.emptyRows, 7) + lpad(r.readablePct, 7) +
    lpad(r.absentSource.length, 11) + lpad(r.presentButUnusable.length, 10));
});
console.log('\n── unavailable inputs, per domain ──');
res.forEach(function (r) {
  if (!r.absentSource.length && !r.presentButUnusable.length) return;
  console.log('\n' + r.product + ':');
  if (r.absentSource.length) console.log('  NEVER IN FEED: ' + r.absentSource.join('; '));
  if (r.presentButUnusable.length) console.log('  IN FEED, NO USABLE NUMBER: ' + r.presentButUnusable.join('; '));
});
