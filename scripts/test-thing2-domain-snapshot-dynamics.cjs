'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
let now = 1790964000000;
class Clock extends Date { static now() { return now; } }
const events = [];
const win = { LIMENDomains: {}, dispatchEvent: e => events.push(e), addEventListener: () => {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/kernel/limen-phase-domain-adapter.js'), 'utf8'), {
  window: win, Date: Clock, CustomEvent: function(type, init) { this.type = type; this.detail = init.detail; }
});
const api = win.LIMENPhaseDomainAdapter;
function sample(stress, extra = {}) {
  now += 10000;
  win.LIMENDomains.energy = { stress, confidence: .8, maturity: 'STRUCTURAL', trend: 0, updated: now, ...extra };
  api.update();
  return api.getAnnotation('energy');
}
sample(.2);
let a = sample(.8);
assert.equal(a.phaseTrajectory, 'ESCALATING');
assert.match(a.trajectoryBasis, /stress.*not phase rank/);
a = sample(.5, { trend: -.03 });
assert.equal(a.phase, 'p4', 'existing declining-from-elevated rule stays in place');
assert.equal(a.phaseTrajectory, 'DECLINING', 'P3 to P4 is declining stress, regardless of label ordering');
assert.equal(a.observationTimestamp, now);
assert.match(a.observationTimeBasis, /publisher observation date unverified/);
const length = api.getStressHistory('energy').length;
const sourceTime = a.observationTimestamp;
now += 5000;
api.update(); api.update();
assert.equal(api.getStressHistory('energy').length, length, 'duplicate reads cannot manufacture persistence');
assert.equal(api.getAnnotation('energy').observationTimestamp, sourceTime, 'read time cannot replace snapshot time');

for (let i = 0; i < 20; i++) sample(.2);
let confirmed = false;
for (let i = 0; i < 25; i++) { a = sample(.95); confirmed ||= a.breakProxyConfirmed; }
assert.ok(confirmed, 'actual distinct snapshot sequence still reaches the existing break confirmation');
const count = a.breakConfirmCount, n = a.snapshotSamples;
for (let i = 0; i < 10; i++) api.update();
assert.equal(api.getAnnotation('energy').breakConfirmCount, count);
assert.equal(api.getAnnotation('energy').snapshotSamples, n);

const lastTime = win.LIMENDomains.energy.updated;
win.LIMENDomains.energy.updated = lastTime - 1;
api.update();
assert.equal(api.getAnnotation('energy').phase, null);
assert.equal(api.getStressHistory('energy').length, n);
win.LIMENDomains.energy.updated = lastTime;
win.LIMENDomains.energy.stress = .4;
api.update();
assert.equal(api.getAnnotation('energy').reason, 'stale-or-conflicting-snapshot');
for (const stress of [null, undefined, NaN, Infinity, true, '0.5', -1, 2]) {
  a = sample(stress);
  assert.equal(a.phase, null, 'unmeasured/invalid stress cannot become P0');
  assert.equal(a.priorityMod, 0);
}
a = sample(.4);
assert.ok(a.phase, 'valid observation recovers without resetting history');
assert.equal(a.phaseTrajectory, 'DECLINING');
sample(.4, { updated: now + 50000 });
assert.equal(api.getAnnotation('energy').phase, null, 'future timestamp refused');
sample(.4, { updated: null });
assert.equal(api.getAnnotation('energy').phase, null, 'missing snapshot date refused');

win.LIMENDomains.other = { stress: .8, confidence: .8, updated: now };
win.LIMENCrossDomain = { active: [{ domains: ['energy', 'other'], severity: .6, confidence: .5 }] };
a = sample(.4);
assert.equal(a.recursivePressure, .24);
win.LIMENCrossDomain.active[0].confidence = 0;
assert.equal(sample(.4).recursivePressure, 0, 'zero confidence must not default to .5');
win.LIMENCrossDomain.active[0].confidence = .5;
win.LIMENCrossDomain.active[0].domains.push('other');
assert.equal(sample(.4).recursivePressure, .24, 'repeated domain within a pattern cannot double its weight');
for (const value of [undefined, null, NaN, Infinity, -1, 2]) {
  win.LIMENCrossDomain.active[0].confidence = value;
  assert.equal(sample(.4).recursivePressure, 0, 'invalid coupling confidence contributes no invented evidence');
}
win.LIMENCrossDomain.active[0].confidence = .5;
assert.equal(sample(.4).recursivePressure, .24, 'coupling recovers after valid evidence returns');
assert.equal(events.at(-1).detail.annotations.energy.phase, a.phase);
console.log('Thing2 domain snapshots: measured direction, replay/refusal/recovery, real break confirmations, and confidence-weighted pressure passed');
