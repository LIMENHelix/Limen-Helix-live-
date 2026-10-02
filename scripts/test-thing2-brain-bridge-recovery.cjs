'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const listeners = {}, decisions = [], storage = new Map();
const win = { LIMENDomains: { energy: { stress: .3, phase: 'anatomical-role' } },
  addEventListener: (type, fn) => { listeners[type] = fn; },
  LIMENDecision: { decide: slot => { decisions.push({ phase: slot.brainKernelPhase, nativePhase: slot.brainPhase, trajectory: slot.brainKernelTrajectory }); return {}; } }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/domain-brain-adapter.js'), 'utf8'), {
  window: win, Date, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) }
});
const state = { domainId: 'energy', phase: 'p4', stress: .6, phaseSource: 'thing2-kernel',
  kernelPhase: 'p7b', kernelTrajectory: 'RECOVERED', kernelCAccum: .7,
  cognition: { domain: 'energy', model: { cycle: 1 } }, diagnoses: [{ id: 'native-dx' }], treatments: [{ id: 'native-tx' }] };
const emit = () => listeners['limen:domain-brain-update']({ detail: { domainId: 'energy', state } });
const before = JSON.stringify(state);
emit();
assert.equal(win.LIMENDomains.energy.brainKernelPhase, 'p7b');
assert.equal(win.LIMENDomains.energy.brainKernelTrajectory, 'RECOVERED');
assert.equal(win.LIMENDomains.energy.brainKernelCt, .7);
assert.equal(JSON.stringify(state), before, 'bridge must not rewrite native state');
state.phaseSource = 'fallback'; // native producer intentionally retains old kernel fields
emit();
for (const key of ['brainKernelPhase', 'brainKernelTrajectory', 'brainKernelCt']) assert.equal(win.LIMENDomains.energy[key], null);
assert.equal(decisions.at(-1).phase, null, 'decision receives no stale kernel vote');
assert.equal(decisions.at(-1).nativePhase, 'p4', 'legitimate native fallback remains');
assert.equal(win.LIMENDomains.energy.phase, 'anatomical-role');
assert.equal(win.LIMENDomains.energy.stress, .3);
assert.equal(win.LIMENDomains.energy.brainDiagnoses[0].id, 'native-dx');
assert.equal(win.LIMENDomains.energy.brainTreatments[0].id, 'native-tx');
assert.ok(storage.has('limen:brain-cognition'), 'existing local cognition mirror persists');
win.LIMENDomains.energy = { stress: .25 };
listeners['limen:domain-update']();
assert.equal(win.LIMENDomains.energy.brainKernelPhase, null, 'cache reapply cannot revive failed source');
assert.equal(win.LIMENDomains.energy.brainKernelTrajectory, null);
state.phaseSource = 'thing2-kernel'; state.kernelPhase = 'p3'; state.kernelTrajectory = 'UNRECOVERED';
emit();
assert.equal(win.LIMENDomains.energy.brainKernelPhase, 'p3');
assert.equal(decisions.at(-1).phase, 'p3', 'new valid source recovers downstream');
assert.equal(win.LIMENDomains.energy.brainPhase, 'p4');
console.log('Thing2 brain bridge: failed-source clearing, cached persistence, recovery, and native fallback preservation passed');
