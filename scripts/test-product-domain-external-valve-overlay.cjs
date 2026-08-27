'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Overlay = require('../lib/product-domain-external-valve-overlay.js');
const Registry = require('../lib/civilization-valve-registry.js');

function store(records) {
  const rows = new Map(Object.entries(records || {}));
  return {
    assertDurable() {},
    async get(key) { return rows.has(key) ? rows.get(key) : null; }
  };
}

function brain(overrides) {
  const b = {
    domainId: 'finance',
    state: {},
    resourceAuthority: {
      ownerDomain: 'finance',
      switches: { internalCycle: true, internalEmission: true, externalAction: true, spend: false, capital: false }
    },
    motorAuthority: {
      ownerDomain: 'finance', externalValveId: 'finance:broker-order', lane: 'broker/order',
      switches: { prepare: true, simulate: true, external: true }
    }
  };
  if (overrides) Object.assign(b, overrides);
  return b;
}

const openFinance = {
  LIMEN_FINANCE_PREVIEW_ENABLED: '1',
  LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1',
  TRADIER_SANDBOX_AUTONOMY_ENABLED: '1',
  TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED: '1'
};

(async function () {
  let b = brain();
  let out = await Overlay.apply(store(), 'finance', b, {});
  assert.equal(out.eligible, false);
  assert.equal(out.reason, 'domain-external-hard-gates-closed');
  assert.equal(b.resourceAuthority.switches.externalAction, false);
  assert.equal(b.motorAuthority.switches.external, false);

  b = brain();
  out = await Overlay.apply(store(), 'finance', b, openFinance);
  assert.equal(out.eligible, true);
  assert.equal(out.hardGatesOpen, true);
  assert.equal(out.runtimeValveOpen, true);
  assert.equal(b.resourceAuthority.switches.externalAction, true);
  assert.equal(b.motorAuthority.switches.external, true);
  assert.equal(b.resourceAuthority.switches.spend, false, 'valve eligibility cannot grant spend');
  assert.equal(b.resourceAuthority.switches.capital, false, 'valve eligibility cannot grant capital');

  const closed = {
    schemaVersion: 'civilization-valve-receipt/1.0',
    valveId: 'finance:broker-order', runtimeMode: 'CLOSED',
    receiptId: 'valve_closed_test', changedAt: new Date().toISOString()
  };
  b = brain();
  out = await Overlay.apply(store({ 'civilization_valve:finance:broker-order': closed }), 'finance', b, openFinance);
  assert.equal(out.eligible, false);
  assert.equal(out.reason, 'domain-runtime-valve-closed');
  assert.equal(b.resourceAuthority.switches.externalAction, false);
  assert.equal(b.motorAuthority.switches.external, false);

  b = brain();
  b.motorAuthority.lane = 'publication';
  out = await Overlay.apply(store(), 'finance', b, openFinance);
  assert.equal(out.reason, 'domain-external-lane-mismatch');

  b = brain();
  b.motorAuthority.ownerDomain = 'economy';
  out = await Overlay.apply(store(), 'finance', b, openFinance);
  assert.equal(out.reason, 'domain-external-owner-mismatch');

  b = brain();
  out = await Overlay.apply(null, 'finance', b, openFinance);
  assert.equal(out.reason, 'strict-store-required');
  assert.equal(b.resourceAuthority.switches.externalAction, false);
  assert.equal(b.motorAuthority.switches.external, false);

  // The control seam is declared by each sovereign source file. It is not a
  // second shared decision registry and it introduces no routine env switch.
  const dir = path.join(__dirname, '../assets/js/domain-brains');
  const files = fs.readdirSync(dir).filter(name => /^[a-z]+-brain\.js$/.test(name) && name !== 'domain-brain-base.js').sort();
  assert.equal(files.length, 20);
  for (const name of files) {
    const productDomain = name.replace(/-brain\.js$/, '');
    const source = fs.readFileSync(path.join(dir, name), 'utf8');
    const match = source.match(/this\.motorAuthority\s*=\s*\{[^\n]*ownerDomain:\s*'([^']+)'[^\n]*externalValveId:\s*'([^']+)'[^\n]*lane:\s*'([^']+)'/);
    assert.ok(match, productDomain + ' must declare its local external valve');
    const line = Registry.get(match[2]);
    assert.ok(line, productDomain + ' valve must resolve in the physical line registry');
    assert.equal(line.productDomain, productDomain);
    assert.equal(line.ownerDomain, match[1]);
    assert.equal(line.lane, match[3]);
    assert.doesNotMatch(source, /externalEnableEnv/, productDomain + ' must not require a routine operator enable switch');
  }

  console.log('product-domain external valves: 20 sovereign declarations, automatic eligibility, fail-closed circuit breakers, no spend/capital grant');
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
