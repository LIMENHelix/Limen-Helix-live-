/**
 * brain-v2/test/restart-child.js — one half of the restart-persistence proof (TEST 13).
 *
 *   node test/restart-child.js <storeDir> <fromRow> <toRow> [--fresh]
 *
 * Runs ticks in a SEPARATE OS PROCESS and exits. The parent then starts another process which
 * restores from the store and continues. Doing it in-process would prove only that an object
 * survived a function call; the whole claim is that state survives the process dying, so the
 * process has to actually die.
 *
 * Prints one JSON line to stdout so the parent can compare across the process boundary.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var LOOP = require('../kernel/loop.js');
var BIND = require('../bind/energy.js');
var ST = require('../kernel/store.js');

var storeDir = process.argv[2];
var fromRow = parseInt(process.argv[3], 10);
var toRow = parseInt(process.argv[4], 10);
var fresh = process.argv.indexOf('--fresh') >= 0;

if (fresh && fs.existsSync(storeDir)) fs.rmSync(storeDir, { recursive: true, force: true });

var rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'energy-recorder.json'), 'utf8'))
  .rows.slice().sort(function (a, b) { return a.t - b.t; });

var spec = {
  domain: 'energy',
  storeDir: storeDir,
  brainSpec: BIND.spec(),
  horizonMs: 6 * 3600000,
  vitalsOpts: { learningPeriodMs: 3600000, homeostaticPeriodMs: 24 * 3600000 }
};

var snap = ST.loadSnapshot(ST.open(storeDir));
var restored = !!(snap && snap.state && !fresh);
var loop = restored ? LOOP.restore(spec, snap.state) : LOOP.create(spec);

var ticksBefore = loop.ticks;
for (var i = fromRow; i < toRow && i < rows.length; i++) {
  var r = BIND.readRecorderRow(rows[i]);
  var keyed = {};
  Object.keys(r).forEach(function (k) { keyed[k] = { value: r[k].value, eventTime: rows[i].t }; });
  LOOP.tick(loop, keyed, rows[i].t);
}

var s = LOOP.serialize(loop);
process.stdout.write(JSON.stringify({
  pid: process.pid,
  restored: restored,
  ticksBefore: ticksBefore,
  ticksAfter: loop.ticks,
  predictions: Object.keys(loop.registry.predictions).length,
  resolvedPredictions: loop.registry.resolved.length,
  openProspective: loop.memory.prospective.filter(function (x) { return x.status === 'open'; }).length,
  episodes: loop.memory.episodic.length,
  forwardModelUpdates: loop.forwardModel.history.length,
  forwardModelKeys: Object.keys(loop.forwardModel.models),
  gateDecisions: loop.gate.decisions,
  gateStops: loop.gate.stops,
  motorExecuted: loop.motor.executed.filter(function (x) { return x.executionStatus === 'executed'; }).length,
  logRecords: loop.store.count,
  channelR: loop.brain.channels.reduce(function (a, c) { a[c.key] = c.r; return a; }, {}),
  stateHash: require('../kernel/packet.js').sha256(require('../kernel/packet.js').canonical({
    channels: s.channels, registry: s.registry, memoryVersion: s.memory.version, fm: s.forwardModel.models
  }))
}) + '\n');
