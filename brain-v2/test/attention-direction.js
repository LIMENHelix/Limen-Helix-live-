/**
 * attention-direction.js — FIX-0118 regression.
 *
 * Attention is precision. raise_attention must LOWER rGain (lower observation noise,
 * higher attention) and lower_attention must RAISE rGain (higher noise, lower attention).
 * `factor` is the attention multiplier (1.5 raise, 0.5 lower), so both directions divide
 * rGain by the adapted factor. The old lower branch multiplied, which inverted the
 * command and kept the alreadyLowered termination check from ever firing.
 *
 * RUN: node brain-v2/test/attention-direction.js
 */
'use strict';

var assert = require('assert');
var LOOP = require('../kernel/loop.js');
var PROP = require('../kernel/propose.js');

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

function freshLoop() {
  return LOOP.create({
    domain: 'attention-test',
    brainSpec: {
      domain: 'attention-test',
      channels: [{ key: 'src', source: 'fixture', cadenceMs: 60000, units: 'u', r: 0.10 }]
    },
    horizonMs: 60000
  });
}

function fire(loop, kind, factor, gain) {
  var handler = loop.motor.handlers[kind];
  assert.equal(typeof handler, 'function', 'no effector registered for ' + kind);
  var ch = loop.brain.channels[0];
  var before = { rGain: ch.rGain, r: ch.r };
  var result = handler({
    action: { actionId: kind + '-1', parameters: { channel: 'src', factor: factor } },
    gain: gain === undefined ? 1 : gain,
    now: 1000
  });
  var history = (loop.attention.src && loop.attention.src.history) || [];
  return {
    result: result,
    ch: ch,
    before: before,
    after: { rGain: ch.rGain, r: ch.r },
    entry: history[history.length - 1] || null
  };
}

console.log('attention direction (FIX-0118)');

check('raise_attention lowers rGain and effective r', function () {
  var loop = freshLoop();
  var out = fire(loop, PROP.KIND.RAISE_ATTENTION, 1.5, 1);
  assert.ok(out.result.applied === true, JSON.stringify(out.result));
  assert.ok(out.after.rGain < out.before.rGain,
    'rGain did not fall: ' + out.before.rGain + ' -> ' + out.after.rGain);
  assert.ok(out.after.r < out.before.r,
    'effective r did not fall: ' + out.before.r + ' -> ' + out.after.r);
  assert.ok(out.entry && out.entry.to < out.entry.from,
    'history does not record a fall in r');
});

check('lower_attention raises rGain and effective r', function () {
  var loop = freshLoop();
  var out = fire(loop, PROP.KIND.LOWER_ATTENTION, 0.5, 1);
  assert.ok(out.result.applied === true, JSON.stringify(out.result));
  assert.ok(out.after.rGain > out.before.rGain,
    'rGain did not rise: ' + out.before.rGain + ' -> ' + out.after.rGain);
  assert.ok(out.after.r > out.before.r,
    'effective r did not rise: ' + out.before.r + ' -> ' + out.after.r);
  assert.ok(out.entry && out.entry.to > out.entry.from,
    'history does not record a rise in r');
});

check('lower_attention now satisfies the alreadyLowered termination key', function () {
  var loop = freshLoop();
  fire(loop, PROP.KIND.LOWER_ATTENTION, 0.5, 1);
  var h = loop.attention.src.history;
  var last = h[h.length - 1];
  var lowered = {};
  if (h.length && last.to > last.from) lowered.src = true;   // loop.js step 9
  assert.equal(lowered.src, true,
    'a lowered channel would be re-proposed forever: ' + JSON.stringify(last));
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
  var loop = freshLoop();
  var out = fire(loop, PROP.KIND.LOWER_ATTENTION, 0.5, 0);
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

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('attention direction: all checks passed');
