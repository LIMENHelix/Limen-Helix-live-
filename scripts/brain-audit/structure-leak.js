/**
 * scripts/brain-audit/structure-leak.js — WHICH subtree still grows after compaction.
 *
 *   node scripts/brain-audit/structure-leak.js [domain] [cycles]
 *
 * replay-compaction's sentinel counts keys plus array entries recursively. That count is
 * immune to numeric width, so when it rises the state is genuinely gaining NODES and some
 * collection is uncapped. The sentinel proves THAT it grew; it cannot say WHERE, and a
 * verdict that names no collection cannot be acted on.
 *
 * This runs the same real loop and the same real compaction, attributes the node count to
 * each path, and prints the paths whose count differs between an early and a late cycle.
 * A path gaining roughly one node per cycle is accumulating one record per cycle.
 *
 * Read-only and offline: the redis module is replaced by an in-memory store before the
 * store is first required, so this never reaches a real instance.
 */

'use strict';

var path = require('path'), fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

var MEM = Object.create(null);
var fake = {
  NAMESPACE_PREFIX: 'limen:', assertConfigured: function () { return true; },
  get: async function (k) { return MEM[k] === undefined ? null : MEM[k]; },
  set: async function (k, v) { MEM[k] = v; return true; },
  setNX: async function (k, v) {
    if (Object.prototype.hasOwnProperty.call(MEM, k)) return false;
    MEM[k] = v; return true;
  },
  lpush: async function () { return 1; },
  lrange: async function () { return []; },
  ltrim: async function () { return true; }
};
var rp = require.resolve(path.join(ROOT, 'lib', 'brain-shadow-redis.js'));
require.cache[rp] = { id: rp, filename: rp, loaded: true, exports: fake };

var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
var COMPACT = require(path.join(ROOT, 'brain-v2', 'kernel', 'compact.js'));
var ARCHIVE = require(path.join(ROOT, 'lib', 'brain-shadow-archive.js'));

var PRODUCT = process.argv[2] || 'population';
var CYCLES = parseInt(process.argv[3], 10) || 120;
var ROWS_PER_CYCLE = 120;
/* Depth 2 by default: deep enough to name a COLLECTION, shallow enough that per-record keys
   collapse into it. At record depth every id reads as 0 -> n simply because ids churn. */
var DEPTH = parseInt(process.argv[4], 10) || 2;

/** Nodes under each path, to DEPTH so the report names a collection rather than a record. */
function attribute(v, prefix, depth, out) {
  if (v === null || typeof v !== 'object') return 1;
  var total, i, keys, j;
  if (Array.isArray(v)) {
    total = v.length;
    for (i = 0; i < v.length; i++) total += attribute(v[i], prefix, depth + 1, out) - 1;
  } else {
    keys = Object.keys(v);
    total = keys.length;
    for (j = 0; j < keys.length; j++) {
      var child = prefix ? prefix + '.' + keys[j] : keys[j];
      var sub = attribute(v[keys[j]], depth < DEPTH ? child : prefix, depth + 1, out);
      total += sub - 1;
      if (depth < DEPTH) out[child] = (out[child] || 0) + sub;
    }
  }
  return total;
}

function syntheticTail(template, n, seedBase) {
  var seed = seedBase;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var names = (template.src || []).map(function (s) { return s.n; });
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({ t: template.t + (i + 1) * 3600000, src: names.map(function (nm, j) {
      return { n: nm, ch: 'stress', l: 1, v: +(10 + 5 * Math.sin(i / 7 + j) + rnd()).toFixed(4) };
    }) });
  }
  return out;
}

async function main() {
  var d = REG.descriptorFor(PRODUCT);
  if (!d) throw new Error('unknown domain ' + PRODUCT);
  var binder = require(REG.binderPath(d));
  var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
  var rows = doc.rows.slice().sort(function (a, b) { return a.t - b.t; });
  var need = CYCLES * ROWS_PER_CYCLE;
  if (rows.length < need) rows = rows.concat(syntheticTail(rows[rows.length - 1], need - rows.length, 7919));

  var spec = { domain: d.snapshot, brainSpec: binder.spec(), horizonMs: 6 * 3600000,
    vitalsOpts: { learningPeriodMs: 3600000, homeostaticPeriodMs: 24 * 3600000 } };

  var snap = null, shots = {}, series = [];
  var EARLY = Math.floor(CYCLES * 0.6), LATE = CYCLES;

  for (var c = 0; c < CYCLES; c++) {
    var loop = snap ? LOOP.restore(spec, snap) : LOOP.create(spec);
    var batch = rows.slice(c * ROWS_PER_CYCLE, (c + 1) * ROWS_PER_CYCLE);
    for (var i = 0; i < batch.length; i++) {
      var rd = binder.readRecorderRow(batch[i]) || {};
      if (Object.keys(rd).length) LOOP.tick(loop, rd, batch[i].t);
    }
    var hot = LOOP.serialize(loop);
    var plan = COMPACT.plan(hot, {});
    if (plan.retiredCount) {
      var head = hot.archiveHead || { sequence: 0, hash: null };
      var seq = (head.sequence || 0) + 1;
      var w = await ARCHIVE.writeChunk(d.snapshot, seq, head.hash || null, plan.retired);
      hot = plan.apply({ sequence: seq, hash: w.hash, totals: plan.totals,
        consumedHorizon: plan.consumedHorizon });
    }
    snap = hot;
    var perCycle = Object.create(null);
    attribute(hot, '', 0, perCycle);
    series.push({ cycle: c + 1, episodic: perCycle['memory.episodic'] || 0,
      episodicRecords: (hot.memory && hot.memory.episodic || []).length });
    if (c + 1 === EARLY || c + 1 === LATE) shots[c + 1] = perCycle;
  }

  var a = shots[EARLY], b = shots[LATE], span = LATE - EARLY;
  var rowsOut = [];
  Object.keys(b).forEach(function (k) {
    var delta = (b[k] || 0) - (a[k] || 0);
    if (delta !== 0) rowsOut.push({ path: k, early: a[k] || 0, late: b[k] || 0, delta: delta,
      perCycle: delta / span });
  });
  /* Report only the paths that actually moved, deepest-growth first. A parent and its child
     both appear: the parent is the sum, so the deepest row naming a collection is the one to
     act on. */
  rowsOut.sort(function (x, y) { return Math.abs(y.delta) - Math.abs(x.delta); });

  console.log('STRUCTURE ATTRIBUTION — ' + PRODUCT + ' (' + d.snapshot + '), cycles ' +
    EARLY + ' -> ' + LATE + ' (' + span + ' cycles apart)');
  console.log('Node counts, so numeric width cannot explain a rise.');
  console.log('');
  if (!rowsOut.length) { console.log('  nothing changed: every attributed path is flat'); return; }
  console.log('  ' + 'path'.padEnd(48) + 'early'.padStart(10) + 'late'.padStart(10) +
    'delta'.padStart(9) + 'per cycle'.padStart(11));
  rowsOut.slice(0, 25).forEach(function (r) {
    console.log('  ' + r.path.padEnd(48) + String(r.early).padStart(10) +
      String(r.late).padStart(10) + String(r.delta).padStart(9) +
      r.perCycle.toFixed(3).padStart(11));
  });
  var totalDelta = (b[''] || 0);
  /* TWO WINDOWS CANNOT TELL OSCILLATION FROM GROWTH, which is exactly how this audit
     produced a different verdict at 40, 60 and 100 cycles. The full series can: a capped
     collection whose RECORD count is flat and whose node count wanders inside a band has an
     OLS slope near zero and increments of both signs. */
  var post = series.slice(Math.floor(series.length * 0.6));
  var n = post.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
  post.forEach(function (p, i) { sx += i; sy += p.episodic; sxy += i * p.episodic; sxx += i * i; });
  var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  var vals = post.map(function (p) { return p.episodic; });
  var recs = post.map(function (p) { return p.episodicRecords; });
  var ups = 0, downs = 0;
  for (var q = 1; q < vals.length; q++) { if (vals[q] > vals[q - 1]) ups++; else if (vals[q] < vals[q - 1]) downs++; }
  console.log('');
  console.log('FULL SERIES, post-warm-up (' + n + ' cycles):');
  console.log('  memory.episodic NODES   min ' + Math.min.apply(null, vals) +
    '  max ' + Math.max.apply(null, vals) + '  band ' + (Math.max.apply(null, vals) - Math.min.apply(null, vals)) +
    '  OLS ' + slope.toFixed(4) + ' nodes/cycle');
  console.log('  memory.episodic RECORDS min ' + Math.min.apply(null, recs) +
    '  max ' + Math.max.apply(null, recs) + (Math.min.apply(null, recs) === Math.max.apply(null, recs) ? '  (FLAT: the cap holds)' : ''));
  console.log('  increments up ' + ups + ' / down ' + downs +
    (ups && downs ? '  -> both signs, so this wanders rather than accumulates' : '  -> one direction only'));
  console.log('');
  console.log('largest mover: ' + rowsOut[0].path + '  ' + rowsOut[0].perCycle.toFixed(3) +
    ' nodes/cycle' + (totalDelta ? '' : ''));
}

main().catch(function (e) { console.error('THREW: ' + (e && e.stack || e)); process.exit(1); });
