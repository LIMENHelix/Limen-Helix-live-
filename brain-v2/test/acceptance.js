/**
 * brain-v2/test/acceptance.js — the five tests from CONTRACT.md.
 * Until these pass on adversarial input, brain-v2 is scaffolding, not a brain.
 *   node brain-v2/test/acceptance.js
 */
'use strict';
var B = require('../core/brain.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n         ' + detail : '')); }
}

var HOUR = 3600000;
function mk(findings) {
  return B.createBrain({
    domain: 'energy',
    levelsPerSensor: 3,
    channels: [
      { key: 'crude',   source: 'FRED DCOILWTICO', cadenceMs: 24 * HOUR, units: '0-1' },
      { key: 'gridRss', source: 'GNews grid',      cadenceMs: HOUR,      units: '0-1' },
      { key: 'kev',     source: 'CISA KEV',        cadenceMs: 24 * HOUR, units: '0-1' }
    ],
    findings: findings || [
      { id: 'OIL_SHOCK',    requires: ['crude'],           test: function (v) { return v.crude > 0.8; } },
      { id: 'GRID_STRESS',  requires: ['gridRss'],         test: function (v) { return v.gridRss > 0.7; } },
      { id: 'COMPOUND',     requires: ['crude', 'gridRss'], test: function (v) { return v.crude > 0.6 && v.gridRss > 0.6; } }
    ]
  });
}

console.log('\n=== 1. STARVED: every sensor absent => zero findings, zero defaults ===');
(function () {
  var b = mk(), out = null;
  for (var i = 0; i < 10; i++) out = B.cycle(b, {}, i * HOUR);
  ok('emits no findings', out.findings.length === 0, JSON.stringify(out.findings));
  ok('state abstains', !!out.state.abstained, JSON.stringify(out.state));
  ok('every sensor reported absent', out.sensors.every(function (s) { return s.state === 'absent'; }));
  ok('blind[] names all 3', out.blind.length === 3);
  ok('no sensor claims to be measured', out.sensors.every(function (s) { return s.state !== 'measured'; }));
  ok('uncertainty GREW while blind', out.sensors.every(function (s) { return s.variance > 1.0; }),
     'variances: ' + out.sensors.map(function (s) { return s.variance.toFixed(2); }).join(', '));
})();

console.log('\n=== 2. ONE SENSOR: only findings that sensor supports appear ===');
(function () {
  var b = mk(), out = null;
  for (var i = 0; i < 12; i++) out = B.cycle(b, { crude: { value: 0.85 + (i % 3) * 0.02 } }, i * HOUR);
  var ids = out.findings.map(function (f) { return f.id; });
  ok('OIL_SHOCK fires', ids.indexOf('OIL_SHOCK') !== -1, JSON.stringify(ids));
  ok('GRID_STRESS does NOT fire (its sensor never spoke)', ids.indexOf('GRID_STRESS') === -1);
  ok('COMPOUND does NOT fire (needs two, has one)', ids.indexOf('COMPOUND') === -1);
  ok('unevaluated findings land in candidates', out.candidates.some(function (c) { return c.triggerSource === 'unevaluated'; }));
  ok('fired finding names its trigger', out.findings.every(function (f) { return Array.isArray(f.triggeredBy) && f.triggeredBy.length; }));
})();

console.log('\n=== 3. DEAD CHANNEL: a constant is dead, not calm ===');
(function () {
  var b = mk(), out = null;
  for (var i = 0; i < 14; i++) out = B.cycle(b, { gridRss: { value: 0.5042 } }, i * HOUR);
  var g = out.sensors.filter(function (s) { return s.key === 'gridRss'; })[0];
  ok('flagged dead', g.state === 'dead' && g.liveness === 'dead', JSON.stringify({ state: g.state, liveness: g.liveness }));
  ok('refused for fusion', g.fusable === false);
  ok('GRID_STRESS never fires off a constant', out.findings.every(function (f) { return f.id !== 'GRID_STRESS'; }));
  ok('appears in blind[] with a reason', out.blind.some(function (x) { return x.what === 'gridRss' && /dead, not calm/.test(x.why || ''); }));
})();

console.log('\n=== 4. R3 CARDINALITY CAP is asserted, not documented ===');
(function () {
  var many = [];
  for (var i = 0; i < 200; i++) many.push({ id: 'DX_' + i, requires: ['crude'], test: function () { return true; } });
  var threw = false, msg = '';
  try { mk(many); } catch (e) { threw = true; msg = e.message; }
  ok('200 findings on 3 sensors is rejected', threw, 'no throw');
  ok('error states the arithmetic', /R3 violation/.test(msg) && /distinguishable states/.test(msg), msg);
  var okSmall = false;
  try { mk([{ id: 'A', requires: ['crude'], test: function () { return true; } }]); okSmall = true; } catch (e) {}
  ok('a library within the cap is accepted', okSmall);
})();

console.log('\n=== 5. EFFERENT + DETERMINISM ===');
(function () {
  var b = mk(), out = B.cycle(b, { crude: { value: 0.5 } }, 0);
  ok('declares having no consumer rather than implying one', out.efferent.declaredNone === true && /stated rather than implied/.test(out.efferent.why));

  var b2 = B.createBrain({
    domain: 'energy', channels: [{ key: 'crude', cadenceMs: HOUR }], findings: [],
    efferent: [{ id: 'POST /api/brain-cognition', gated: 'header token' }]
  });
  var o2 = B.cycle(b2, { crude: { value: 0.5 } }, 0);
  ok('declares a real consumer when one exists', o2.efferent.declaredNone === false && o2.efferent.consumers.length === 1);

  // same inputs -> same bytes (R9 precondition)
  function run() {
    var br = mk(), o = null;
    for (var i = 0; i < 20; i++) o = B.cycle(br, i % 2 ? { crude: { value: 0.3 + i * 0.01 } } : { gridRss: { value: 0.4 + i * 0.02 } }, i * HOUR);
    return JSON.stringify(o);
  }
  ok('two identical runs produce identical output', run() === run());

  var o3 = B.cycle(mk(), { crude: { value: 0.9 } }, 0);
  ok('every non-abstaining state names its basis', o3.state.abstained || (!!o3.state.basis && Array.isArray(o3.state.basisOf)));
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
