/**
 * attention-direction.js — FIX-0118 regression.
 *
 * Attention is precision. raise_attention must LOWER rGain (lower observation noise,
 * higher attention) and lower_attention must RAISE rGain (higher noise, lower attention).
 * `factor` is the attention multiplier (1.5 raise, 0.5 lower), so both directions divide
 * rGain by the adapted factor. The old lower branch multiplied, which inverted the
 * command and kept the alreadyLowered termination check from ever firing.
 *
 * Also covers the two review cases:
 *   - effective r is clamped, so completion must follow rGain, not r;
 *   - 1.0.0 snapshots can retain inverted attention near the rGain floor.
 *
 * RUN: node brain-v2/test/attention-direction.js
 */
'use strict';

var assert = require('assert');
var LOOP = require('../kernel/loop.js');
var PROP = require('../kernel/propose.js');
var PK = require('../kernel/packet.js');
var C = require('../core/channel.js');

var failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  pass: ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL: ' + name + ' — ' + (e && e.message));
  }
}

function makeSpec(channels) {
  return {
    domain: 'attention-test',
    brainSpec: {
      domain: 'attention-test',
      channels: channels || [{ key: 'src', source: 'fixture', cadenceMs: 60000, units: 'u', r: 0.10 }]
    },
    horizonMs: 60000
  };
}

function freshLoop(channels) {
  return LOOP.create(makeSpec(channels));
}

function fire(loop, kind, factor, gain, key) {
  key = key || 'src';
  var handler = loop.motor.handlers[kind];
  assert.equal(typeof handler, 'function', 'no effector registered for ' + kind);
  var ch = loop.brain.channels.filter(function (c) { return c.key === key; })[0];
  assert.ok(ch, 'no channel ' + key);
  var before = { rGain: ch.rGain, r: ch.r };
  var result = handler({
    action: {
      actionId: kind + '-' + key,
      kind: kind,
      parameters: { channel: key, factor: factor }
    },
    gain: gain === undefined ? 1 : gain,
    now: 1000
  });
  var history = (loop.attention[key] && loop.attention[key].history) || [];
  return {
    result: result,
    ch: ch,
    before: before,
    after: { rGain: ch.rGain, r: ch.r },
    entry: history[history.length - 1] || null
  };
}

/* loop.js step 9, copied so the test fails if the production condition changes. */
function loweredSet(loop) {
  var lowered = {};
  Object.keys(loop.attention).forEach(function (k) {
    var h = loop.attention[k].history || [];
    if (!h.length) return;
    var last = h[h.length - 1];
    var rose = (typeof last.gainTo === 'number' && typeof last.gainFrom === 'number')
      ? last.gainTo > last.gainFrom
      : last.to > last.from;
    if (rose) lowered[k] = true;
  });
  return lowered;
}

function deadCycle() {
  return {
    sensors: [{ key: 'src', state: 'dead', liveness: 'dead' }],
    state: { confidence: 1 },
    dysregulation: { detected: false }
  };
}

console.log('attention direction (FIX-0118)');

check('raise_attention lowers rGain and effective r', function () {
  var out = fire(freshLoop(), PROP.KIND.RAISE_ATTENTION, 1.5, 1);
  assert.ok(out.result.applied === true, JSON.stringify(out.result));
  assert.ok(out.after.rGain < out.before.rGain,
    'rGain did not fall: ' + out.before.rGain + ' -> ' + out.after.rGain);
  assert.ok(out.after.r < out.before.r,
    'effective r did not fall: ' + out.before.r + ' -> ' + out.after.r);
  assert.ok(out.entry && out.entry.to < out.entry.from,
    'history does not record a fall in r');
  assert.equal(out.entry.kind, PROP.KIND.RAISE_ATTENTION);
});

check('lower_attention raises rGain and effective r', function () {
  var out = fire(freshLoop(), PROP.KIND.LOWER_ATTENTION, 0.5, 1);
  assert.ok(out.result.applied === true, JSON.stringify(out.result));
  assert.ok(out.after.rGain > out.before.rGain,
    'rGain did not rise: ' + out.before.rGain + ' -> ' + out.after.rGain);
  assert.ok(out.after.r > out.before.r,
    'effective r did not rise: ' + out.before.r + ' -> ' + out.after.r);
  assert.ok(out.entry && out.entry.to > out.entry.from,
    'history does not record a rise in r');
  assert.equal(out.entry.kind, PROP.KIND.LOWER_ATTENTION);
});

check('lower_attention satisfies the alreadyLowered termination key', function () {
  var loop = freshLoop();
  var out = fire(loop, PROP.KIND.LOWER_ATTENTION, 0.5, 1);
  assert.equal(loweredSet(loop).src, true,
    'a lowered channel would be re-proposed forever: ' + JSON.stringify(out.entry));
});

check('clamped effective r does not hide lower_attention completion', function () {
  var loop = freshLoop([{ key: 'src', source: 'fixture', cadenceMs: 60000, units: 'u', r: 4 }]);
  var ch = loop.brain.channels[0];
  assert.equal(ch.rGain, 1);
  assert.equal(ch.r, 4);

  var first = fire(loop, PROP.KIND.LOWER_ATTENTION, 0.5, 1);
  assert.equal(first.after.rGain, 2, 'rGain did not rise to 2');
  assert.equal(first.after.r, 4, 'effective r should stay clamped at 4');
  assert.equal(first.entry.gainFrom, 1, 'gainFrom not recorded');
  assert.equal(first.entry.gainTo, 2, 'gainTo not recorded');
  assert.equal(loweredSet(loop).src, true,
    'completion key stayed false under a clamped effective r');

  var second = fire(loop, PROP.KIND.LOWER_ATTENTION, 0.5, 1);
  assert.equal(second.after.rGain, 4, 'subsequent lower did not raise rGain');
  assert.equal(second.after.r, 4, 'effective r should remain clamped');
  assert.equal(loweredSet(loop).src, true,
    'completion key regressed across subsequent ticks');
});

check('a completed channel stops producing lower_attention candidates', function () {
  var withLowered = PROP.generate({
    cycle: deadCycle(), now: 0, horizonMs: 1000, alreadyLowered: { src: true }
  });
  var without = PROP.generate({
    cycle: deadCycle(), now: 0, horizonMs: 1000, alreadyLowered: {}
  });
  assert.ok(!withLowered.some(function (c) { return c.kind === PROP.KIND.LOWER_ATTENTION; }),
    'cleanup candidate was re-proposed for an already-lowered channel');
  assert.ok(without.some(function (c) { return c.kind === PROP.KIND.LOWER_ATTENTION; }),
    'dead channel did not produce a cleanup candidate when not lowered');
});

check('adapted gain scales the same way in both directions', function () {
  var raise = fire(freshLoop(), PROP.KIND.RAISE_ATTENTION, 1.5, 0.5);
  var lower = fire(freshLoop(), PROP.KIND.LOWER_ATTENTION, 0.5, 0.5);
  // applied = 1 + (factor - 1) * gain = 1.25 and 0.75 respectively.
  assert.ok(Math.abs(raise.after.rGain - (1 / 1.25)) < 1e-12,
    'raise rGain=' + raise.after.rGain);
  assert.ok(Math.abs(lower.after.rGain - (1 / 0.75)) < 1e-12,
    'lower rGain=' + lower.after.rGain);
});

check('zero adapted gain leaves attention unchanged', function () {
  var out = fire(freshLoop(), PROP.KIND.LOWER_ATTENTION, 0.5, 0);
  assert.equal(out.after.rGain, out.before.rGain,
    'rGain moved with zero commanded gain');
  assert.equal(out.after.r, out.before.r,
    'r moved with zero commanded gain');
});

check('the attention gain clamp still applies', function () {
  var loop = freshLoop();
  loop.brain.channels[0].rGain = 20;    // upper clamp
  var out = fire(loop, PROP.KIND.LOWER_ATTENTION, 0.5, 1);
  assert.equal(out.after.rGain, 20,
    'rGain escaped the upper clamp: ' + out.after.rGain);
});

// ── Saved-state recovery ───────────────────────────────────────────────────
function legacySnapshot(options) {
  options = options || {};
  var channels = [
    { key: 'src', source: 'fixture', cadenceMs: 60000, units: 'u', r: 0.10 },
    { key: 'other', source: 'fixture', cadenceMs: 60000, units: 'u', r: 0.10 }
  ];
  var spec = makeSpec(channels);
  var loop = LOOP.create(spec);
  var src = loop.brain.channels[0];
  var other = loop.brain.channels[1];
  C.setAttentionGain(src, options.srcGain === undefined ? 0.05 : options.srcGain);
  C.setAttentionGain(other, options.otherGain === undefined ? 0.5 : options.otherGain);
  loop.ticks = options.ticks === undefined ? 7 : options.ticks;
  loop.lastTickAt = options.lastTickAt === undefined ? 7 : options.lastTickAt;
  loop.attention.src = {
    rBase: src.rBase,
    history: options.srcHistory || [{
      at: 1, kind: PROP.KIND.LOWER_ATTENTION, from: 0.10, to: src.r,
      gainFrom: 1, gainTo: src.rGain, actionId: 'old-lower'
    }]
  };
  loop.memory.episodic = options.episodic || [
    { id: 'ep-old-lower', actionId: 'old-lower', selection: { kind: PROP.KIND.LOWER_ATTENTION, candidateId: 'cand_lower_src' } }
  ];
  var snap = LOOP.serialize(loop);
  snap.version = options.version || 'brain-v2/kernel/1.0.0';
  return { spec: spec, snap: snap };
}

check('restore recovers a 1.0.0 snapshot stuck at the inverted rGain floor', function () {
  var fixture = legacySnapshot();
  var restored = LOOP.restore(fixture.spec, fixture.snap);
  var src = restored.brain.channels.filter(function (c) { return c.key === 'src'; })[0];
  var other = restored.brain.channels.filter(function (c) { return c.key === 'other'; })[0];

  assert.equal(src.rGain, 1, 'affected channel was not returned to neutral attention');
  assert.equal(restored.ticks, 7, 'unrelated loop state was not preserved');
  assert.equal(other.rGain, 0.5, 'unrelated channel attention was changed');
  assert.ok(restored.attentionRecovery, 'no recovery record');
  assert.deepEqual(restored.attentionRecovery.recovered, ['src'],
    JSON.stringify(restored.attentionRecovery));
  var hist = restored.attention.src.history;
  var last = hist[hist.length - 1];
  assert.equal(last.kind, 'fix0118_recovery', 'no recovery history entry');
  assert.equal(last.gainFrom, 0.05);
  assert.equal(last.gainTo, 1);
  assert.equal(last.at, 7, 'recovery history entry used wall-clock time');
  assert.equal(restored.attentionRecovery.at, 7, 'recovery record used wall-clock time');
  assert.equal(loweredSet(restored).src, true,
    'recovered channel would still be re-proposed');
});

check('restore is deterministic across different wall-clock times', function () {
  var fixture = legacySnapshot();
  var realNow = Date.now;
  try {
    Date.now = function () { return 111111; };
    var first = LOOP.serialize(LOOP.restore(fixture.spec, JSON.parse(JSON.stringify(fixture.snap))));
    Date.now = function () { return 999999; };
    var second = LOOP.serialize(LOOP.restore(fixture.spec, JSON.parse(JSON.stringify(fixture.snap))));
    assert.equal(JSON.stringify(first), JSON.stringify(second),
      'restoring the same snapshot produced different serialized outputs');
    assert.equal(first.attentionRecovery.at, 7,
      'recovery timestamp is not the persisted snapshot time');
  } finally {
    Date.now = realNow;
  }
});

check('restore preserves a legitimate attention change made after the bug', function () {
  var fixture = legacySnapshot({
    srcGain: 0.5,
    srcHistory: [
      { at: 1, kind: PROP.KIND.LOWER_ATTENTION, from: 0.10, to: 0.01,
        gainFrom: 1, gainTo: 0.05, actionId: 'old-lower' },
      { at: 2, kind: PROP.KIND.RAISE_ATTENTION, from: 0.01, to: 0.05,
        gainFrom: 0.05, gainTo: 0.5, actionId: 'new-raise' }
    ],
    episodic: [
      { id: 'ep-old-lower', actionId: 'old-lower', selection: { kind: PROP.KIND.LOWER_ATTENTION } },
      { id: 'ep-new-raise', actionId: 'new-raise', selection: { kind: PROP.KIND.RAISE_ATTENTION } }
    ]
  });
  var restored = LOOP.restore(fixture.spec, fixture.snap);
  var src = restored.brain.channels.filter(function (c) { return c.key === 'src'; })[0];
  assert.equal(src.rGain, 0.5, 'a later legitimate raise was overwritten');
  assert.equal(restored.attentionRecovery, null, 'unchanged state was reported as recovered');
});

check('restore does not migrate a current-version snapshot', function () {
  var fixture = legacySnapshot({ version: LOOP.VERSION, srcGain: 2 });
  var restored = LOOP.restore(fixture.spec, fixture.snap);
  var src = restored.brain.channels.filter(function (c) { return c.key === 'src'; })[0];
  assert.equal(src.rGain, 2, 'current-version attention state was rewritten');
  assert.equal(restored.attentionRecovery, null, 'current version was reported as recovered');
});

check('restore skips a channel whose inverted action cannot be identified', function () {
  var fixture = legacySnapshot({ episodic: [] });
  var restored = LOOP.restore(fixture.spec, fixture.snap);
  var src = restored.brain.channels.filter(function (c) { return c.key === 'src'; })[0];
  assert.equal(src.rGain, 0.05, 'unidentifiable state was rewritten');
  assert.equal(restored.attentionRecovery, null, 'unidentified state was reported as recovered');
});

check('internally generated packets carry the current kernel version', function () {
  var p = PK.create({
    traceId: 't', seq: 0, sourceDomain: 'd', sourceModule: 'm',
    signalKind: PK.KIND.OBSERVATION,
    simulationStatus: PK.STATUS.OBSERVED,
    eventTime: 0, observationTime: 0, processingTime: 0
  });
  assert.equal(p.sourceVersion, LOOP.VERSION,
    'packet default sourceVersion is not the kernel version');

  var loop = freshLoop();
  LOOP.tick(loop, { src: { value: 0.5, eventTime: 1000 } }, 1000);
  var received = loop._received || [];
  assert.ok(received.length > 0, 'no packet was routed');
  assert.ok(received.some(function (r) { return r.direction === PK.DIRECTION.ASCENDING; }),
    'no ascending packet was routed');
  received.forEach(function (r) {
    assert.equal(r.sourceVersion, LOOP.VERSION,
      'routed packet sourceVersion ' + r.sourceVersion);
  });
});

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('attention direction: all checks passed');
