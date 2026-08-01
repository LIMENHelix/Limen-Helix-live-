/**
 * brain-v2/test/cadence.js — SPEC row 27, cadence derived rather than declared.
 *
 *   node brain-v2/test/cadence.js
 *
 * The distinction the whole feature rests on: the interval between OBSERVATIONS is
 * the poll rate, a fact about our scheduler. The interval between CHANGES is the rate
 * the source can actually answer at. Measuring the first and calling it cadence would
 * make a daily series polled hourly read as hourly, and every horizon downstream would
 * be wrong by 24x.
 */

'use strict';

var CH = require('../core/channel.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var HOUR = 3600000, DAY = 24 * HOUR;

// ── T1: the poll rate is not the cadence ──────────────────────────────────────
(function () {
  console.log('T1: a daily series polled hourly measures DAILY, not hourly');
  var ch = CH.createChannel({ key: 'daily', cadenceMs: DAY });
  var t = 1e12, v = 100;
  // 20 days, polled every hour. The value only changes once a day.
  for (var d = 0; d < 20; d++) {
    for (var h = 0; h < 24; h++) CH.observe(ch, v, t + d * DAY + h * HOUR);
    v += 5;
  }
  var c = CH.inferCadence(ch);
  assert('measured, not abstained', c.state === 'measured', JSON.stringify(c));
  assert('cadence reads ~24h despite 480 observations', Math.abs(c.cadenceMs - DAY) < HOUR,
    (c.cadenceMs / HOUR).toFixed(1) + 'h');
  assert('it counted changes, not polls', c.changes === 20, String(c.changes));
  assert('and it agrees with the declared 24h', !c.disagreesWithDeclared, JSON.stringify(c.ratio));
})();

// ── T2: a wrongly declared channel is caught ──────────────────────────────────
(function () {
  console.log('T2: a channel declared daily that moves hourly is flagged');
  var ch = CH.createChannel({ key: 'fast', cadenceMs: DAY });
  var t = 1e12;
  for (var i = 0; i < 40; i++) CH.observe(ch, 50 + i, t + i * HOUR);   // changes every hour
  var c = CH.inferCadence(ch);
  assert('measured ~1h', Math.abs(c.cadenceMs - HOUR) < 60000, (c.cadenceMs / HOUR).toFixed(2) + 'h');
  assert('flagged as disagreeing with the manifest', c.disagreesWithDeclared === true, JSON.stringify(c.ratio));
  assert('the reason states both numbers', /declared 24h, measured/.test(c.why), c.why);
})();

// ── T3: abstention below the evidence floor ───────────────────────────────────
(function () {
  console.log('T3: too few changes abstains to the declared prior');
  var ch = CH.createChannel({ key: 'thin', cadenceMs: DAY });
  var t = 1e12;
  for (var i = 0; i < 3; i++) CH.observe(ch, 10 + i, t + i * DAY);
  var c = CH.inferCadence(ch);
  assert('abstained', c.state === 'abstained', JSON.stringify(c));
  assert('falls back to the DECLARED cadence', c.cadenceMs === DAY);
  assert('and labels it a prior, not a measurement', c.source === 'declared' && /is a prior/.test(c.why), c.why);
})();

// ── T4: a frozen channel never claims a cadence ───────────────────────────────
(function () {
  console.log('T4: a value that never changes yields no cadence at all');
  var ch = CH.createChannel({ key: 'frozen', cadenceMs: DAY });
  var t = 1e12;
  for (var i = 0; i < 100; i++) CH.observe(ch, 100, t + i * HOUR);   // constant
  var c = CH.inferCadence(ch);
  assert('abstained despite 100 observations', c.state === 'abstained', JSON.stringify(c));
  assert('exactly one change recorded (the first reading)', c.changes === 1, String(c.changes));
})();

// ── T5: measured cadence drives uncertainty growth ────────────────────────────
(function () {
  console.log('T5: uncertainty grows against the MEASURED period, not the declared one');
  // Two channels, identical declarations. One actually moves hourly.
  var slow = CH.createChannel({ key: 'slow', cadenceMs: DAY, q: 0.02 });
  var fast = CH.createChannel({ key: 'fast', cadenceMs: DAY, q: 0.02 });
  var t = 1e12;
  for (var d = 0; d < 12; d++) CH.observe(slow, 50 + d, t + d * DAY);      // genuinely daily
  for (var i = 0; i < 40; i++) CH.observe(fast, 50 + i, t + i * HOUR);     // actually hourly

  assert('slow measures ~24h', Math.abs(CH.effectiveCadence(slow) - DAY) < HOUR);
  assert('fast measures ~1h', Math.abs(CH.effectiveCadence(fast) - HOUR) < 60000);

  // Now go silent on both for the same wall-clock stretch.
  var pSlow = slow.P, pFast = fast.P;
  CH.predict(slow, slow.lastObsAt + 3 * DAY);
  CH.predict(fast, fast.lastObsAt + 3 * DAY);
  var grewSlow = slow.P - pSlow, grewFast = fast.P - pFast;

  assert('both went more uncertain', grewSlow > 0 && grewFast > 0);
  /* Three days of silence is 3 periods for the daily channel and 72 for the hourly
     one, so the fast channel must go blind far faster. Under the old declared-only
     rule they would have grown identically, which is the bug this closes. */
  assert('the fast channel goes uncertain far faster for the same silence',
    grewFast > grewSlow * 10, 'slow +' + grewSlow.toFixed(4) + '  fast +' + grewFast.toFixed(4));
})();

// ── T6: real recorded data ────────────────────────────────────────────────────
(function () {
  console.log('T6: against 362 hours of real recorded energy');
  var B = require('../core/brain.js'), BIND = require('../bind/energy.js'), fs = require('fs'), path = require('path');
  var rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'energy-recorder.json'), 'utf8'))
    .rows.slice().sort(function (a, b) { return a.t - b.t; });
  var brain = B.createBrain(BIND.spec()), out = null;
  rows.forEach(function (r) { out = B.cycle(brain, BIND.readRecorderRow(r), r.t); });

  var measured = out.sensors.filter(function (s) { return s.cadence.state === 'measured'; });
  var disagree = measured.filter(function (s) { return s.cadence.disagreesWithDeclared; });

  assert('some channels earned a measured cadence', measured.length >= 4, String(measured.length));
  assert('every sensor carries a cadence verdict', out.sensors.every(function (s) { return !!s.cadence && !!s.cadence.state; }));
  assert('channels that never move abstain rather than inventing a period',
    out.sensors.filter(function (s) { return s.state === 'dead'; })
      .every(function (s) { return s.cadence.state === 'abstained'; }));
  /* This is a finding, not a fixture: three channels declared daily change every
     1-4h in the recorded history. Asserting it holds keeps the finding from
     quietly disappearing if the manifest is edited. */
  assert('the manifest disagreement is still detected', disagree.length >= 3,
    disagree.map(function (s) { return s.key + ' ' + s.cadence.ratio.toFixed(2) + 'x'; }).join(', '));
  console.log('      declared-vs-measured disagreements: ' +
    disagree.map(function (s) { return s.key + ' (' + (s.cadence.cadenceMs / HOUR).toFixed(1) + 'h vs 24h declared)'; }).join(', '));
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
