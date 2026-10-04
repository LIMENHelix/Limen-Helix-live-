import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Load the actual browser ES modules without changing repository module mode.
const kernel = fs.readFileSync('assets/js/limen-thing2-kernel.js', 'utf8');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const adapter = fs.readFileSync('assets/js/limen-thing2-adapter.js', 'utf8')
  .replace("'./limen-thing2-kernel.js'", JSON.stringify(moduleUrl(kernel)));
const win = new EventTarget();
globalThis.window = win;
let ready = false;
win.addEventListener('limen:thing2-ready', () => { ready = true; });
const { default: api, readDomainStress, phaseOfSeries } = await import(moduleUrl(adapter));
assert.equal(ready, true);

const domains = ['energy', 'finance', 'agriculture', 'technology', 'trade', 'industry', 'economy',
  'education', 'infrastructure', 'science', 'medicine', 'environment', 'defense', 'intelligence',
  'communication', 'population', 'governance', 'law', 'culture', 'religion'];
// Exercise the real base pipeline, not numeric state fixtures. Include the
// owning keys used by medicine, science and trade without changing registries.
let snapshot = null, fresh = true, errors = 0;
let request = () => Promise.resolve(null);
win.LIMENSharedSnapshot = {
  getSnapshot: () => snapshot, requestFresh: () => request(),
  isFresh: () => fresh, getDiagnostics: () => ({ errors })
};
const brainContext = vm.createContext({
  window: win, console: { log() {}, warn() {}, error() {} }, CustomEvent, Date,
  document: { head: { appendChild() {} }, createElement: () => ({}),
    getElementById: () => null, querySelector: () => null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {} },
  fetch: async () => ({ ok: false, json: async () => ({}) }),
  setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}
});
vm.runInContext(fs.readFileSync('assets/js/domain-brains/domain-brain-base.js', 'utf8'), brainContext);
function actualBrain(domain) {
  // Suppress only the bottom-of-file browser auto-boot. Keep the actual
  // constructor, init, ingest, normalization, scoring and cycle overrides.
  const filename = 'assets/js/domain-brains/' + domain + '-brain.js';
  const source = fs.readFileSync(filename, 'utf8');
  const boot = /var brain = new (\w+Brain)\(\);/;
  assert.match(source, boot);
  vm.runInContext(source.replace(boot, (_, name) => 'window.__TestBrainConstructor = ' + name + '; return;'), brainContext, { filename });
  return new win.__TestBrainConstructor();
}
const keys = { medicine: 'health', science: 'research', trade: 'supplyChain' };
const brains = {};
function measured(key, stress) {
  const updated = Date.now();
  return { stress, stressUsable: true, stressBasis: 'measured', status: 'LIVE', updated,
    sources: [{ name: key + '-feed', live: true, channel: 'stress',
      classification: 'real', value: stress, updated }] };
}
function unknown(key, context) {
  const reading = api.getDomainStress(key);
  assert.equal(reading.status, 'UNKNOWN', context);
  assert.equal(reading.stressPercent, null, context);
}
for (const domain of domains) {
  const key = keys[domain] || domain;
  const brain = actualBrain(domain);
  assert.equal(brain.domainId, key);
  assert.notEqual(brain.constructor, win.LIMENDomainBrainBase, 'must exercise the real subclass');
  brains[key] = brain;
  win.LIMENDomainBrains.register(brain);
  snapshot = null;
  unknown(key, domain + ' INIT');
  brain.init();
  unknown(key, domain + ' READY');
  let resolve;
  request = () => new Promise(done => { resolve = done; });
  const cycle = brain.cycle.bind(brain);
  let pending;
  brain.cycle = () => (pending = cycle());
  brain.start();
  assert.equal(brain.state.status, 'RUNNING');
  assert.equal(brain.state.updated, 0);
  assert.equal(brain.state.feeds.length, 0);
  unknown(key, domain + ' pre-first-cycle RUNNING');
  resolve(null);
  await pending;
  assert.ok(brain.state.updated > 0, 'a completed missing-snapshot cycle still has a timestamp');
  unknown(key, domain + ' missing snapshot cycle');
  request = () => Promise.reject(new Error('snapshot failed'));
  await brain.cycle();
  unknown(key, domain + ' failed snapshot cycle');
  const source = measured(key, 0);
  snapshot = { domains: { [key]: source } };
  unknown(key, domain + ' source exists but is not consumed');
  await brain.cycle();
  assert.equal(api.getDomainStress(key).stressPercent, 0, domain + ' measured zero');
  assert.equal(brain.state.stressObservation.sourceRecord, source);
  snapshot.domains[key] = measured(key, 0.42);
  unknown(key, domain + ' replacement source needs a cycle');
  await brain.cycle();
  const before = structuredClone(brain.state);
  assert.equal(api.getDomainStress(key).stressPercent, 42, domain + ' successful cycle');
  assert.deepEqual(structuredClone(brain.state), before, 'adapter must not mutate or rescore');
  const externalPressure = brain.getExternalPressure;
  brain.getExternalPressure = () => 0.3;
  snapshot.domains[key] = measured(key, 0.2);
  await brain.cycle();
  const pressured = api.getDomainStress(key);
  assert.equal(pressured.status, 'OBSERVED', domain + ' snapshot label');
  assert.equal(pressured.stress, 0.2, domain + ' exactly source-bound');
  assert.equal(pressured.stressPercent, 20);
  assert.equal(pressured.brainStress.status, 'DERIVED');
  assert.ok(pressured.brainStress.stress >= 0.5, domain + ' integrated pressure plus any domain floor');
  if (domain === 'education' || domain === 'finance') assert.equal(pressured.brainStress.stress, 0.5);
  assert.ok(Math.abs(pressured.brainStress.components.domainAdjustmentAndClipping -
    (pressured.brainStress.stress - 0.2 - 0.3)) < 1e-12);
  assert.equal(pressured.brainStress.components.snapshotStress, 0.2);
  assert.equal(pressured.brainStress.components.crossDomainPressure, 0.3);
  brain.getExternalPressure = externalPressure;
  fresh = false;
  unknown(key, domain + ' stale shared snapshot');
  fresh = true; errors = 1;
  unknown(key, domain + ' failed refresh retaining cached snapshot');
  errors = 0;
  for (const fallback of [
    { stressUsable: false, stressBasis: 'simulated', status: 'FALLBACK' },
    { stressUsable: false, stressBasis: 'activity-fallback' },
    { stressUsable: false, stressBasis: 'clamped' },
    { updated: Date.now() - 300001 },
    { sources: [] }
  ]) {
    snapshot.domains[key] = { ...measured(key, 0), ...fallback };
    await brain.cycle();
    unknown(key, domain + ' stale/fallback-only source');
  }
  snapshot.domains[key] = measured(key, 0.42);
  await brain.cycle();
  const score = brain.scoreStress;
  brain.scoreStress = () => Promise.reject(new Error('cycle failed after ingestion'));
  await brain.cycle();
  unknown(key, domain + ' failed scoring cycle');
  assert.equal(brain.state.stressObservation, null);
  brain.scoreStress = score;
  snapshot = { domains: {} };
  await brain.cycle();
  unknown(key, domain + ' missing domain after previous observation');
  assert.equal(brain.state.stressObservation, null);
  brain.stop();
}
assert.equal(api.getDomainStress('unknown').status, 'UNKNOWN');
for (const status of [undefined, 'INIT', 'READY', 'RUNNING']) {
  assert.equal(readDomainStress('energy', { stress: 0, status }).status, 'UNKNOWN');
}
for (const stress of [undefined, null, NaN, Infinity, -0.1, 1.1, '0.5']) {
  assert.equal(readDomainStress('energy', { stress }).stressPercent, null);
}
assert.equal(phaseOfSeries([1, 2]).reason, 'insufficient-history');
assert.equal(phaseOfSeries([0.1, 0.2, 0.3, 0.2, 0.5, 0.7, 0.6, 0.8], { positive: false }).validated, false);
const energy = brains.energy;
snapshot = { domains: { energy: measured('energy', 0.42) } };
await energy.cycle();
snapshot = null;
// Exercise the real console render and update listeners with offline DOM and
// fetch substitutes. The percentage must follow Thing 2's current domain value.
const view = { innerHTML: '', style: {}, childNodes: [], querySelector: () => null, querySelectorAll: () => [] };
const document = {
  readyState: 'complete', head: { appendChild() {} }, addEventListener() {},
  querySelector: () => null,
  getElementById: id => id === 'clarity-view' ? view : null,
  createTextNode: text => ({ text }),
  createElement: () => ({ innerHTML: '', appendChild(node) { this.innerHTML = String(node.text).replaceAll('&', '&amp;').replaceAll('<', '&lt;'); } })
};
win.LIMENDomainIsolator = { isDomainScoped: () => true, getActiveDomain: () => 'energy', getResolvedKey: () => 'energy', getDomainLabel: () => 'Energy' };
vm.runInNewContext(fs.readFileSync('assets/js/domain-brains/domain-console-brain.js', 'utf8'), {
  window: win, document, console: { log() {}, warn() {}, error() {} },
  fetch: () => Promise.reject(new Error('offline fixture')), requestAnimationFrame: fn => fn(),
  setInterval, clearInterval, setTimeout, Date
});
await new Promise(resolve => setImmediate(resolve));
assert.match(view.innerHTML, /stress reading unavailable/);
assert.doesNotMatch(view.innerHTML, /data-stress-source="thing2-domain-stress"/);
snapshot = { domains: { energy: measured('energy', 0) } };
await energy.cycle();
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress"[^>]*>0%/);
snapshot.domains.energy = measured('energy', 0.42);
await energy.cycle();
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress"[^>]*>42%/);
snapshot.domains.energy = measured('energy', 0.63);
await energy.cycle();
win.dispatchEvent(new CustomEvent('limen:domain-brain-update', { detail: { domainId: 'energy', state: energy.state } }));
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress"[^>]*>63%/);
const energyPressure = energy.getExternalPressure;
energy.getExternalPressure = () => 0.3;
snapshot.domains.energy = measured('energy', 0.2);
await energy.cycle();
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress" data-stress-status="DERIVED"[^>]*>50%/);
assert.match(view.innerHTML, /data-stress-source="domain-snapshot" data-stress-status="OBSERVED">20%/);
assert.doesNotMatch(view.innerHTML, /data-stress-status="OBSERVED"[^>]*>50%/);
const truthful = api.getDomainStress('energy');
assert.equal(readDomainStress('energy', energy.state, { ...truthful.observation, value: 0.5 }).status, 'UNKNOWN');
energy.getExternalPressure = energyPressure;
snapshot = null;
request = () => Promise.resolve(null);
await energy.cycle();
win.dispatchEvent(new CustomEvent('limen:domain-brain-update', { detail: { domainId: 'energy', state: energy.state } }));
assert.match(view.innerHTML, /stress reading unavailable/);
assert.doesNotMatch(view.innerHTML, /0%/);
snapshot = { domains: { energy: measured('energy', 0.42) } };
await energy.cycle();
delete win.LIMENThing2;
win.dispatchEvent(new CustomEvent('limen:domain-brain-update', { detail: { domainId: 'energy', state: energy.state } }));
assert.match(view.innerHTML, /stress reading unavailable/);
win.LIMENThing2 = api;
win.dispatchEvent(new CustomEvent('limen:thing2-ready'));
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress"[^>]*>42%/);
delete globalThis.window;
console.log('PASS: actual subclasses for all 20 domains; measured 20% + pressure 30pp is derived 50%; startup, missing/failed/stale/fallback sources, measured zero, successful cycles, and console provenance');
