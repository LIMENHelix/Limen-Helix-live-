#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Guard = require('../lib/civilization-adapter-guard.js');
const Control = require('../lib/civilization-valve-control.js');
const Registry = require('../lib/civilization-valve-registry.js');

function store() {
  const values = new Map(), lists = new Map();
  return {
    values,
    assertDurable() { return true; },
    async get(key) { return values.has(key) ? JSON.parse(JSON.stringify(values.get(key))) : null; },
    async set(key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
    async lpush(key, value) { const rows = lists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); lists.set(key, rows); return rows.length; },
    async ltrim() { return true; }
  };
}

const bindings = [
  { file: 'handlers/limen-worker-autofire.js', guard: 'civilizationAdapterGuard.checkpoint', effect: "fetch(BASE + '/api/expand-artifact-claude'", valves: ['education:research-papers', 'environment:research-papers', 'medicine:research-papers', 'science:research-papers'] },
  { file: 'lib/tradier-b14.js', guard: 'AdapterGuard.checkpoint', effect: 'broker.placeOrder(orderRequest)', valves: ['economy:investments', 'energy:investments', 'finance:broker-order', 'technology:investments'] },
  { file: 'lib/agriculture-homestead-executor.js', effect: 'input.transport.send', valves: ['agriculture:homestead'] },
  { file: 'lib/communication-social-executor.js', effect: 'platform.postToBluesky', valves: ['communication:social'] },
  { file: 'lib/culture-hero-executor.js', effect: 'provider.generate', valves: ['culture:hero-image'] },
  { file: 'lib/defense-publication-executor.js', effect: '.publish(store, candidate', valves: ['defense:publication'] },
  { file: 'lib/finance-subscriber-executor.js', effect: 'transport.send', valves: ['finance:subscriber-email'] },
  { file: 'lib/governance-publication-executor.js', effect: '.publish(store, candidate', valves: ['governance:publication'] },
  { file: 'lib/industry-crm-executor.js', effect: 'i.provider.create', valves: ['industry:crm'] },
  { file: 'lib/infrastructure-real-estate-executor.js', effect: 'input.transport.send', valves: ['infrastructure:real-estate'] },
  { file: 'lib/intelligence-autopilot-executor.js', effect: 'input.transport.send', valves: ['intelligence:autopilot'] },
  { file: 'lib/law-automail-executor.js', effect: 'input.provider.create', valves: ['law:automail'] },
  { file: 'lib/population-real-estate-executor.js', effect: 'input.transport.send', valves: ['population:real-estate'] },
  { file: 'lib/religion-subscriber-executor.js', effect: 'transport.send', valves: ['religion:subscriber-email'] },
  { file: 'lib/trade-auction-executor.js', effect: 'i.marketplace.createListing', valves: ['trade:auction'] }
];

(async function () {
  assert.equal(Guard.investmentValve('finance'), 'finance:broker-order');
  assert.equal(Guard.investmentValve('energy'), 'energy:investments');
  assert.equal(Guard.investmentValve('unknown'), null);

  const s = store();
  const open = await Guard.checkpoint(s, 'finance:subscriber-email', 'test-email', Date.parse('2026-08-27T15:00:00Z'));
  assert.equal(open.allowed, true);
  assert.equal(open.authority, 'last-moment-inhibition-only');
  assert.equal(open.checkedAt, '2026-08-27T15:00:00.000Z');

  await Control.set('finance:subscriber-email', 'CLOSED', 'test', s);
  await assert.rejects(Guard.checkpoint(s, 'finance:subscriber-email', 'test-email'), error => {
    assert.equal(error.code, Guard.INHIBITED);
    assert.equal(error.providerCalled, false);
    assert.equal(error.valveReason, 'domain-runtime-valve-closed');
    return true;
  });

  const globalStore = store();
  await Control.set(Control.GLOBAL_ID, 'CLOSED', 'test', globalStore);
  await assert.rejects(Guard.checkpoint(globalStore, 'trade:auction', 'test-listing'), error => {
    assert.equal(error.code, Guard.INHIBITED);
    assert.equal(error.providerCalled, false);
    assert.equal(error.valveReason, 'global-emergency-valve-closed');
    return true;
  });

  const root = path.resolve(__dirname, '..');
  const covered = new Set();
  bindings.forEach(binding => {
    const source = fs.readFileSync(path.join(root, binding.file), 'utf8');
    const guardToken = binding.guard || 'AdapterGuard).checkpoint';
    const guardAt = source.indexOf(guardToken);
    const effectAt = source.indexOf(binding.effect, guardAt + guardToken.length);
    assert(guardAt >= 0, binding.file + ' must contain its last-moment adapter guard');
    assert(effectAt > guardAt, binding.file + ' must check the valve before its external effect');
    binding.valves.forEach(id => covered.add(id));
  });
  assert.deepEqual(Array.from(covered).sort(), Registry.LINES.map(row => row.id).sort(),
    'all 21 sovereign external lane valves must reach a co-timed effect checkpoint');

  console.log('civilization adapter guard: all 21 lane valves inhibit at the last moment before their external effect');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
