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
const states = Object.fromEntries(domains.map((domain, i) => [domain, {
  stress: i / 20, updated: 1000 + i, kernelPhase: 'p2',
  feeds: [{ name: domain + '-feed', live: true, channel: 'stress', updated: 1000 + i }],
  memory: { stressHistory: [], phaseHistory: [], outcomeLog: [] }
}]));
for (const domain of domains) {
  const state = states[domain];
  const before = JSON.stringify(state);
  win.dispatchEvent(new CustomEvent('limen:domain-brain-update', { detail: { domainId: domain, state } }));
  const reading = api.getDomainStress(domain);
  assert.equal(reading.stress, state.stress);
  assert.equal(reading.stressPercent, Math.round(state.stress * 100));
  assert.equal(reading.feeds[0].name, domain + '-feed');
  assert.equal(reading.validated, false);
  assert.equal(JSON.stringify(state), before, 'routing must not mutate the brain');
}
assert.equal(api.getDomainStress('unknown'), null);
for (const stress of [undefined, null, NaN, Infinity, -0.1, 1.1, '0.5']) {
  assert.equal(readDomainStress('energy', { stress }).stressPercent, null);
}
assert.equal(readDomainStress('energy', { stress: 0 }).stressPercent, 0);
assert.equal(readDomainStress('energy', { stress: 0, status: 'INIT' }).status, 'UNKNOWN');
assert.equal(readDomainStress('energy', { stress: 0.2, stressSource: 'domain-snapshot' }).source, 'domain-snapshot');
assert.equal(readDomainStress('energy', { stress: 1 }).stressPercent, 100);
assert.equal(readDomainStress('energy', { stress: 0.2, finalStress: 0.63 }).stressPercent, 63);
assert.equal(readDomainStress('energy', { stress: 0.2, finalStress: NaN }).status, 'UNKNOWN');
assert.doesNotThrow(() => readDomainStress('energy', { stress: 0.2, feeds: [null] }));

// Registry readback also works after a missed first event, and takes precedence
// over a previously cached cycle. No second feed-pressure addition occurs.
win.LIMENDomainBrains = { get: domain => states[domain] && { getState: () => states[domain] } };
states.energy.stress = 0.42;
assert.equal(api.getDomainStress('energy').stressPercent, 42);
assert.equal(api.getDomainStress('finance').stressPercent, 5);
assert.equal(phaseOfSeries([1, 2]).reason, 'insufficient-history');
assert.equal(phaseOfSeries([0.1, 0.2, 0.3, 0.2, 0.5, 0.7, 0.6, 0.8], { positive: false }).validated, false);

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
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress"[^>]*>42%/);
states.energy.finalStress = 0.63;
win.dispatchEvent(new CustomEvent('limen:domain-brain-update', { detail: { domainId: 'energy', state: states.energy } }));
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress"[^>]*>63%/);
states.energy.finalStress = NaN;
win.dispatchEvent(new CustomEvent('limen:domain-brain-update', { detail: { domainId: 'energy', state: states.energy } }));
assert.match(view.innerHTML, /stress reading unavailable/);
assert.doesNotMatch(view.innerHTML, /0%/);
delete states.energy.finalStress;
delete win.LIMENThing2;
win.dispatchEvent(new CustomEvent('limen:domain-brain-update', { detail: { domainId: 'energy', state: states.energy } }));
assert.match(view.innerHTML, /stress reading unavailable/);
win.LIMENThing2 = api;
win.dispatchEvent(new CustomEvent('limen:thing2-ready'));
assert.match(view.innerHTML, /data-stress-source="thing2-domain-stress"[^>]*>42%/);
delete globalThis.window;
console.log('PASS: all 20 domains, missing data, unchanged phase API, and console percentages');
