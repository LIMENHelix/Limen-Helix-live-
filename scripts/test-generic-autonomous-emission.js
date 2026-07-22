/**
 * scripts/test-generic-autonomous-emission.js — the generic autonomous-emission PORT.
 * (run: node scripts/test-generic-autonomous-emission.js)
 *
 * Proves the two HARD safety properties + the fail-safes:
 *   T1  research (RESEARCHABLE) emits to the INTERNAL stream state.domainEmitted
 *   T2  investment (INVESTABLE) is STAGED for sign-off, never emitted
 *   T3  ZERO outward calls (no fetch / sendBeacon) — emission is a computation, not an action
 *   T4  brake != clear ⇒ fail-safe holds EVERYTHING (emittedCount 0)
 *   T5  window.LIMEN_DOMAIN_AUTONOMY = false ⇒ autonomy-off, nothing emits
 *   T6  energy self-skips the generic path (returns null)
 */
var fs = require('fs');
var path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var win = { location: { pathname: '/', search: '' }, addEventListener: function () {}, dispatchEvent: function () {}, CustomEvent: function () {} };
global.window = win;
var fetchCalls = 0, beaconCalls = 0;
global.fetch = win.fetch = function () { fetchCalls++; return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };
global.navigator = win.navigator = { sendBeacon: function () { beaconCalls++; return true; } };
function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/domain-brains/domain-brain-base.js');
var Base = win.LIMENDomainBrainBase;
assert('base loaded', !!Base);

function mkBrain(domainId) {
  var b = new Base({ domainId: domainId, label: domainId, snapshotKey: domainId, cycleInterval: 30000 });
  b.state.opportunities = [
    { id: 'r1', title: 'Research call A', path: 'RESEARCHABLE', confidence: 70, whyNow: 'signal A' },
    { id: 'i1', title: 'Invest call B', path: 'INVESTABLE', confidence: 60, whyNow: 'signal B', companies: ['ACME'] },
    { id: 'r2', title: 'Research call C', path: 'RESEARCHABLE', confidence: 55 },
    { id: 'h1', title: 'Held call', path: 'RESEARCHABLE', confidence: 90, held: true }   // held ⇒ excluded
  ];
  b.state.domainNeuro = { brake: { level: 'clear' }, forecast: { direction: 'rising', projectedStress: 0.6, horizonPeriods: 6, falsifier: 'x', confidence: 0.5 } };
  return b;
}

// T1/T2/T3 — clear brake, autonomy on
console.log('T1-T3: research emits internal, investment staged, zero outward calls');
win.LIMEN_DOMAIN_AUTONOMY = true;
fetchCalls = 0; beaconCalls = 0;
var law = mkBrain('law');
var queue = law._computeGenericEmissionQueue();
var emit = law._runGenericAutonomousEmission();
assert('queue packaged non-held INVEST+RESEARCH (3, not the held one)', queue.queued === 3, JSON.stringify(queue.queued));
assert('investment package carries requiresSignoff', queue.packages.some(function (p) { return p.lane === 'INVESTABLE' && p.requiresSignoff === true; }));
assert('research emitted to INTERNAL stream state.domainEmitted', Array.isArray(law.state.domainEmitted) && law.state.domainEmitted.length === 2, JSON.stringify(law.state.domainEmitted && law.state.domainEmitted.length));
assert('emitted are RESEARCHABLE only', emit.emitted.every(function (p) { return p.lane === 'RESEARCHABLE'; }) && emit.emittedCount === 2);
assert('investment STAGED for sign-off, not emitted', emit.staged.some(function (p) { return p.lane === 'INVESTABLE' && p.status === 'staged-for-signoff'; }));
assert('ZERO outward calls during emission (no fetch, no sendBeacon)', fetchCalls === 0 && beaconCalls === 0, 'fetch=' + fetchCalls + ' beacon=' + beaconCalls);

// T4 — brake fail-safe
console.log('T4: non-clear brake holds everything (fail-safe)');
var law2 = mkBrain('law');
law2.state.domainNeuro.brake.level = 'halt';
law2._computeGenericEmissionQueue();
var emitHalt = law2._runGenericAutonomousEmission();
assert('brake halt ⇒ holdReason brake-halt', emitHalt.holdReason === 'brake-halt', emitHalt.holdReason);
assert('brake halt ⇒ nothing emitted', emitHalt.emittedCount === 0 && (!law2.state.domainEmitted || law2.state.domainEmitted.length === 0));

// T5 — autonomy off
console.log('T5: autonomy toggle off holds everything');
win.LIMEN_DOMAIN_AUTONOMY = false;
var law3 = mkBrain('law');
law3._computeGenericEmissionQueue();
var emitOff = law3._runGenericAutonomousEmission();
assert('autonomy off ⇒ holdReason autonomy-off', emitOff.holdReason === 'autonomy-off');
assert('autonomy off ⇒ nothing emitted', emitOff.emittedCount === 0);
win.LIMEN_DOMAIN_AUTONOMY = true;

// T6 — energy self-skips
console.log('T6: energy self-skips the generic emission path');
var en = mkBrain('energy');
en._runEnergyAutonomousEmission = function () {};   // mark as energy
assert('energy _computeGenericEmissionQueue returns null', en._computeGenericEmissionQueue() === null);
assert('energy _runGenericAutonomousEmission returns null', en._runGenericAutonomousEmission() === null);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
