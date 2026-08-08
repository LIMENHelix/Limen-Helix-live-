/**
 * audit-unbounded.js — classify every collection in LOOP.serialize() by HOW it is bounded.
 *
 * Read-only. Writes nothing, no network, no Redis.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THE FIRST VERSION OF THIS SCRIPT CALLED ELEVEN COLLECTIONS "UNBOUNDED" AND WAS WRONG.
 *
 * It replayed 470 ticks and called anything still rising unbounded. Several of those
 * collections are capped at 512, and a 470-tick replay cannot observe a cap of 512: the
 * curve is still a straight line when the fixture runs out. Growth observed over a horizon
 * shorter than the cap is not evidence of unboundedness, and treating it as such would have
 * put compaction policy on collections that already trim themselves.
 *
 * Two changes fix that:
 *   1. CODE INSPECTION decides the class, not the curve. Each cap below was read out of the
 *      kernel and is cited by file and line.
 *   2. A DETERMINISTIC SYNTHETIC REPLAY runs past 1,500 ticks so a 256 or 512 cap visibly
 *      plateaus instead of being extrapolated.
 *
 * The synthetic replay is a property test of the data structures. It is NOT production
 * evidence and no figure from it belongs in DELIVERY_STATE as a production measurement.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/brain-audit/audit-unbounded.js [domain] [--synthetic N]
 */
'use strict';

var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
var HOUR = 3600000;

/**
 * THE CLASSES, and why the middle two are not compaction targets.
 *
 *   ROLLING     a cap exists in the kernel and the structure trims itself. Compacting these
 *               would add a second policy on top of one that already works.
 *   CUMULATIVE  a keyed map. Bounded per key, but the KEY SET grows, so it is bounded only
 *               as long as the key space is. Needs semantics, not a window.
 *   ACTIVE      records that may never be retired at all: an OPEN prediction or an
 *               unresolved prospective item is live state, not history.
 *   GROWING     no cap found by inspection. The compaction targets.
 */
var CLASS = {
  'forwardModel.history':      ['ROLLING',    'slice(-512), brain-v2/kernel/predict.js:559'],
  'modulators.series':         ['ROLLING',    'slice(-256) per key, brain-v2/kernel/modulators.js:334-335'],
  'modulators.rewardHistory':  ['ROLLING',    'slice(-256), brain-v2/kernel/modulators.js:334'],
  'modulators.surpriseHistory':['ROLLING',    'slice(-256), brain-v2/kernel/modulators.js:334'],
  'efferences':                ['ROLLING',    'shift above 512, brain-v2/kernel/loop.js:660'],
  'routed':                    ['ROLLING',    'ROUTED_WINDOW = 512, brain-v2/kernel/loop.js:853,861'],
  'varHistory':                ['ROLLING',    'VAR_WINDOW = 48 per key, brain-v2/kernel/loop.js:896,912'],
  'divergences.closed':        ['ROLLING',    'CLOSED_CAP = 512, brain-v2/core/divergence.js:184,795'],
  'consolidator.history':      ['ROLLING',    'slice(-32), brain-v2/kernel/consolidate.js:243'],

  'memory.episodeIndex':       ['CUMULATIVE', 'traceId -> [indices]; indices point INTO episodic, so retirement must rebuild it'],
  'forwardModel.consumed':     ['CUMULATIVE', 'efference id -> true; this is DUPLICATE-LEARNING PREVENTION. Dropping an id lets the same efference train the model twice'],
  'forwardModel.meta':         ['CUMULATIVE', 'metaplasticity applied[key]; per learning key, not per tick'],
  'attention':                 ['CUMULATIVE', 'per-source history, pushed with no cap, brain-v2/kernel/loop.js:177'],

  'memory.episodic':           ['GROWING',    'push with no cap, brain-v2/kernel/memory.js:112'],
  'memory.prospective':        ['GROWING',    'push with no cap, brain-v2/kernel/memory.js:305. OPEN items are ACTIVE and may never be retired'],
  'registry.predictions':      ['GROWING',    'reg.predictions[id] = p, no cap, brain-v2/kernel/predict.js:110'],
  'registry.order':            ['GROWING',    'reg.order.push, no cap, brain-v2/kernel/predict.js:111'],
  'registry.resolved':         ['GROWING',    'reg.resolved.push, no cap, brain-v2/kernel/predict.js:205. CALIBRATION recomputes from this list (predict.js:215), so retirement MUST preserve cumulative statistics']
};

var args = process.argv.slice(2);
var DOMAIN = args.find(function (a) { return a.indexOf('--') !== 0; }) || 'finance';
var synIdx = args.indexOf('--synthetic');
var SYNTHETIC = synIdx >= 0 ? (parseInt(args[synIdx + 1], 10) || 1600) : 0;

var d = REG.descriptorFor(DOMAIN);
var binder = require(REG.binderPath(d));
var spec = binder.spec();
var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
var rows = (doc.rows || []).slice().sort(function (a, b) { return a.t - b.t; });

/**
 * DETERMINISTIC SYNTHETIC ROWS. Seeded LCG, never Math.random, so two runs produce
 * byte-identical input and the plateau is reproducible. Values move so channels stay live;
 * the shape mirrors what handlers/feed-record.js writes.
 */
function synthetic(n, template) {
  var seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var names = (template.src || []).map(function (s) { return s.n; });
  var base = template.t, out = [];
  for (var i = 0; i < n; i++) {
    out.push({
      t: base + (i + 1) * 3600000,
      src: names.map(function (nm, j) {
        return { n: nm, ch: 'stress', l: 1, v: +(10 + 5 * Math.sin(i / 7 + j) + rnd()).toFixed(4) };
      })
    });
  }
  return out;
}

var replay = rows.slice();
if (SYNTHETIC) replay = replay.concat(synthetic(SYNTHETIC, rows[rows.length - 1]));

var MARKS = SYNTHETIC
  ? [120, 470, 800, 1200, rows.length + SYNTHETIC]
  : [60, 120, 240, 360, 470];

var loop = LOOP.create({
  domain: d.snapshot, brainSpec: spec, horizonMs: 6 * HOUR,
  vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR }
});

function bytes(v) { return Buffer.byteLength(JSON.stringify(v === undefined ? null : v), 'utf8'); }
function profile(state) {
  var out = {};
  Object.keys(state).forEach(function (k) {
    out[k] = bytes(state[k]);
    var v = state[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.keys(v).forEach(function (k2) {
        if (v[k2] && typeof v[k2] === 'object') out[k + '.' + k2] = bytes(v[k2]);
      });
    }
  });
  return out;
}

var samples = [], ticks = 0;
for (var i = 0; i < replay.length; i++) {
  var rd = binder.readRecorderRow(replay[i]) || {};
  if (Object.keys(rd).length) { LOOP.tick(loop, rd, replay[i].t); ticks++; }
  if (MARKS.indexOf(i + 1) >= 0) samples.push({ rows: i + 1, ticks: ticks, size: profile(LOOP.serialize(loop)) });
}

var first = samples[0], last = samples[samples.length - 1];
var prev = samples[samples.length - 2];
function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function lp(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

console.log('\nDOMAIN ' + DOMAIN + ' (' + d.snapshot + ')   ' +
  (SYNTHETIC ? 'fixture ' + rows.length + ' rows + ' + SYNTHETIC + ' DETERMINISTIC SYNTHETIC rows'
             : 'fixture only, ' + rows.length + ' rows'));
if (SYNTHETIC) console.log('SYNTHETIC REPLAY IS A STRUCTURE TEST, NOT PRODUCTION EVIDENCE.');
console.log('ticks at marks: ' + samples.map(function (s) { return s.ticks; }).join(', ') + '\n');

console.log(pad('key', 28) + samples.map(function (s) { return lp('@' + s.rows, 10); }).join('') +
  lp('last-leg', 10) + '  class      basis');
console.log('-'.repeat(120));

var targets = [];
Object.keys(last.size).sort(function (a, b) { return last.size[b] - last.size[a]; }).forEach(function (k) {
  if (last.size[k] < 1024) return;
  if (/^channels\.\d+$/.test(k)) return;
  var cls = CLASS[k] ? CLASS[k][0] : null;
  var basis = CLASS[k] ? CLASS[k][1] : 'not classified; inspect before acting';
  var leg = (last.size[k] || 0) - (prev.size[k] || 0);
  if (!cls) cls = leg > 0 ? 'GROWING?' : 'flat?';
  if (cls === 'GROWING') targets.push({ key: k, bytes: last.size[k] });
  console.log(pad(k, 28) + samples.map(function (s) { return lp(s.size[k] || 0, 10); }).join('') +
    lp(leg, 10) + '  ' + pad(cls, 11) + basis.slice(0, 60));
});

console.log('\nPLATEAU CHECK on the ROLLING windows (last leg should be ~0):');
Object.keys(CLASS).filter(function (k) { return CLASS[k][0] === 'ROLLING' && last.size[k]; })
  .forEach(function (k) {
    var leg = (last.size[k] || 0) - (prev.size[k] || 0);
    console.log('  ' + pad(k, 28) + lp(last.size[k], 9) + ' B   last leg ' + lp(leg, 8) +
      '   ' + (Math.abs(leg) <= Math.max(64, last.size[k] * 0.02) ? 'PLATEAUED' : 'still moving'));
  });

console.log('\nCOMPACTION TARGETS (class GROWING), largest first:');
targets.sort(function (a, b) { return b.bytes - a.bytes; })
  .forEach(function (t) { console.log('  ' + pad(t.key, 28) + lp(t.bytes, 10) + ' B'); });
console.log('\nCUMULATIVE maps need semantics, not a window:');
Object.keys(CLASS).filter(function (k) { return CLASS[k][0] === 'CUMULATIVE'; })
  .forEach(function (k) { console.log('  ' + pad(k, 28) + lp(last.size[k] || 0, 10) + ' B   ' + CLASS[k][1]); });
