/**
 * audit-cost.js — per-domain serialized state VALUE size. Read-only, no Redis.
 *
 * Every cycle reads the whole state and writes it back, so the per-domain serialized size,
 * not the tick time, is what scales with domain count. Measured by serializing a real loop
 * after a real 120-row cold cycle.
 *
 * UNIT: UTF-8 length of the serialized state VALUE. NOT bytes on the wire. The Upstash REST
 * transport re-encodes this value and adds an envelope, so it must not be doubled into
 * bandwidth, projected into a bill, or compared with a request-size ceiling. It measures
 * RELATIVE growth, which is what the batch-2 gate turns on. This file printed all three of
 * those derived numbers once; they were withdrawn in review of PR #7.
 */
'use strict';
var fs = require('fs'), path = require('path');
/* Two levels up: this file lives in scripts/brain-audit/. Resolved against __dirname,
   never process.cwd(), so the answer does not depend on where it was invoked from. */
var ROOT = path.join(__dirname, '..', '..');
var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
/* ONE definition of the persisted value, shared with audit-growth so the two cannot drift. */
var ENV = require('./state-envelope.js');
var HOUR = 3600000;

var res = [];
REG.DOMAINS.forEach(function (d) {
  var binder = require(REG.binderPath(d));
  var spec = binder.spec();
  var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
  var rows = (doc.rows || []).slice().sort(function (a, b) { return a.t - b.t; });

  var loop = LOOP.create({ domain: d.snapshot, brainSpec: spec, horizonMs: 6 * HOUR,
    vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR } });

  var ticks = 0;
  rows.slice(0, 120).forEach(function (rw) {
    var rd = binder.readRecorderRow(rw) || {};
    if (Object.keys(rd).length) { LOOP.tick(loop, rd, rw.t); ticks++; }
  });

  /* The exact value the runtime persists, built by the shared helper. */
  var bytes = ENV.envelopeBytes(d.snapshot, ENV.cursorAfterRows(rows, 120), LOOP.serialize(loop));

  res.push({ product: d.product, ticks: ticks,
    stateValueBytes: bytes,
    stateValueKB: +(bytes / 1024).toFixed(1),
    channels: spec.channels.length });
});

fs.writeFileSync(path.join(__dirname, 'cost-out.json'), JSON.stringify(res, null, 1));

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function lpad(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }
console.log('domain          ch  ticks  stateValueKB');
res.forEach(function (r) { console.log(pad(r.product, 15) + lpad(r.channels, 3) + lpad(r.ticks, 7) + lpad(r.stateValueKB, 13)); });

/* DERIVED from the registry, never typed. The first version hardcoded two domains and
   would have kept reporting 'live 2' after batch 1 made it 7. */
var live = REG.INSTALLED_DOMAINS;
var cand = res.filter(function (r) { return live.indexOf(r.product) < 0; });
var sumAll = res.reduce(function (a, r) { return a + r.stateValueKB; }, 0);
var sumCand = cand.reduce(function (a, r) { return a + r.stateValueKB; }, 0);
console.log('\nstate VALUE KB  installed ' + live.length + ': ' + res.filter(function (r) { return live.indexOf(r.product) >= 0; })
  .reduce(function (a, r) { return a + r.stateValueKB; }, 0).toFixed(1) +
  '   not installed ' + cand.length + ': ' + sumCand.toFixed(1) + '   all 20: ' + sumAll.toFixed(1));
console.log('all 20 resident serialized value: ' + (sumAll / 1024).toFixed(2) + ' MB');
console.log('');
console.log('NOT a bandwidth or billing figure. These are serialized VALUE lengths; actual');
console.log('transport bytes are not measured anywhere. See the unit note in the header.');
