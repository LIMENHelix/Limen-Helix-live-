'use strict';

// Actual browser consumers in isolated local fixtures; no provider or business execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bootstrapSource = fs.readFileSync('assets/js/limen-bootstrap.js', 'utf8');
const defenseSource = fs.readFileSync('assets/js/feeds/limen-defense-signal-engine.js', 'utf8');
const quiet = { log() {}, warn() {}, error() {} };

function bootstrap({ enabled, instrument, report = true, brokenRequired = false } = {}) {
  const listeners = new Map();
  const started = [];
  const window = { location: { pathname: '/domain-console.html' }, addEventListener() {} };
  // Unrelated advisory modules are startup-only stubs; no diagnoses or decisions injected.
  for (const match of bootstrapSource.matchAll(/api: '([^']+)'/g)) {
    window[match[1]] = { start() { started.push(match[1]); } };
  }
  if (report) window.LIMENReportConsole = { init() { throw Error('Report must self-initialize'); } };
  else delete window.LIMENReportConsole;
  if (!instrument) delete window.LIMENInteroception;
  window.LIMEN_ENABLE_INTEROCEPTION = enabled;
  if (brokenRequired) window.LIMENFeedStore.start = () => { throw Error('required fixture failure'); };
  const document = { readyState: 'loading', addEventListener(name, cb) { listeners.set(name, cb); } };
  vm.runInNewContext(bootstrapSource, { window, document, console: quiet, setTimeout() {}, setInterval() {} });
  listeners.get('DOMContentLoaded')();
  return { debug: window.LIMENDebug, started };
}

for (const enabled of [undefined, false]) {
  for (const instrument of [false, true]) {
    const result = bootstrap({ enabled, instrument });
    assert.equal(result.debug.startupErrors.length, 0);
    assert.ok(result.debug.loadedModules.includes('report-console'));
    assert.ok(!result.started.includes('LIMENInteroception'));
    assert.ok(!result.debug.loadedModules.includes('interoceptive-divergence'));
    assert.equal(result.debug.skippedModules[0].reason, 'disabled');
  }
}
assert.ok(bootstrap({ enabled: true }).debug.startupErrors.some(e => e.module === 'interoceptive-divergence'));
assert.ok(bootstrap({ enabled: true, instrument: true }).started.includes('LIMENInteroception'));
assert.ok(bootstrap({ report: false }).debug.startupErrors.some(e => e.module === 'report-console'));
assert.ok(bootstrap({ brokenRequired: true }).debug.startupErrors.some(e => e.error.includes('required fixture failure')));

async function defense() {
  let now = 1000;
  let response;
  let parsed = 0;
  const emitted = [];
  class Clock extends Date { static now() { return now; } }
  const window = { LIMENDomains: { defense: { stress: 0.1, signals: [] } }, dispatchEvent(e) { emitted.push(e); } };
  vm.runInNewContext(defenseSource, { window, document: { readyState: 'loading', addEventListener() {} }, console: quiet,
    Date: Clock, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setTimeout() {}, setInterval() {}, clearInterval() {}, fetch: async () => {
      if (response instanceof Error) throw response;
      return { ok: response.status === 200, status: response.status, async json() { parsed++; return response.body; } };
    } });
  const engine = window.LIMENDefenseSignals;
  const fail = async (value, expected) => {
    const before = JSON.stringify(engine.getStatus());
    const domainBefore = JSON.stringify(window.LIMENDomains);
    const eventsBefore = emitted.length;
    const statusBefore = engine.getStatus();
    response = value; now += 1000;
    assert.equal(await engine.poll(), null);
    const after = engine.getStatus();
    assert.equal(after.lastPollAt, statusBefore.lastPollAt, before);
    assert.equal(JSON.stringify(after.signals), JSON.stringify(statusBefore.signals));
    assert.equal(after.macroShock, statusBefore.macroShock);
    assert.match(after.lastPollError, expected);
    assert.equal(JSON.stringify(window.LIMENDomains), domainBefore);
    assert.equal(emitted.length, eventsBefore);
  };
  await fail({ status: 404, body: { ok: false } }, /HTTP 404/);
  assert.equal(parsed, 0, 'failed HTTP responses must not be interpreted as signals');
  assert.equal(engine.getStatus().lastPollAt, 0, 'unavailable first read stays unobserved');
  await fail({ status: 200, body: {} }, /invalid signal arrays/);
  await fail({ status: 200, body: { signals: [], domainSignals: {} } }, /invalid signal arrays/);
  await fail(new Error('offline fixture'), /offline fixture/);

  const valid = { totalArticles: 2, signals: [{ eventType: 'DEFENSE_EVENT', confidence: 'HIGH', articleCount: 2 }],
    domainSignals: [{ domain: 'defense', normalizedMagnitude: 0.2, maxConfidence: 'HIGH',
      events: [{ type: 'DEFENSE_EVENT', articleCount: 2 }] }], macroShock: { detected: true, domains: ['defense'], affectedDomainCount: 1 } };
  response = { status: 200, body: valid }; now += 1000;
  assert.equal(await engine.poll(), valid);
  assert.equal(engine.getStatus().lastPollAt, now);
  assert.equal(engine.getStatus().lastPollError, null);
  assert.equal(window.LIMENDomains.defense.stress, 0.16);
  assert.ok(emitted.some(e => e.type === 'limen:external-signal-ingested'));
  assert.ok(emitted.some(e => e.type === 'limen:macro-shock-detected'));
  await fail({ status: 503, body: { signals: [], domainSignals: [] } }, /HTTP 503/);
  response = { status: 200, body: { totalArticles: 0, signals: [], domainSignals: [], macroShock: { detected: false } } };
  now += 1000;
  assert.ok(await engine.poll());
  assert.equal(engine.getStatus().lastPollError, null);
  assert.equal(engine.getStatus().lastPollAt, now);
  assert.equal(engine.getStatus().signalCount, 0);
  assert.equal(engine.getStatus().macroShock, false);
}

defense().then(() => console.log('PASS console startup: disabled/passive registration, required failures, unavailable reads, retained observation and recovery'))
  .catch(error => { console.error(error); process.exitCode = 1; });
