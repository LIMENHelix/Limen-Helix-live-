#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Metabolism = require('../lib/finance-resource-metabolism.js');

const motorPolicy = {
  environment: 'sandbox', paperOnly: true, liveExecution: false,
  cashOnly: true, longOnly: true, marginAllowed: false,
  optionsAllowed: false, shortingAllowed: false, maxGrossNotionalUsd: 100
};
const quote = { symbol: 'RKLB', last: 68.28, bid: 68.2, ask: 68.3 };
const account = { totalCash: 1000, totalEquity: 1000, positions: [], orders: [] };

assert.deepEqual(Metabolism.DOMAIN_BRAIN_CAPABILITY, {
  schemaVersion: 'domain-brain-capability/1.0', domain: 'finance', capability: 'resourceMetabolism'
});

const available = Metabolism.evaluate({ symbol: 'RKLB', quote, account, motorPolicy, providerCallsUsed: 0, env: {} });
assert.equal(available.ownerDomain, 'finance');
assert.equal(available.state, 'AVAILABLE');
assert.equal(available.allowsProviderCall, true);
assert.equal(available.measurements.availableNotionalUsd, 100);
assert.equal(available.measurements.providerCallsRemaining, 1);

const reserved = Metabolism.evaluate({
  symbol: 'RKLB', quote, account, motorPolicy, providerCallsUsed: 0,
  env: { LIMEN_FINANCE_SANDBOX_RESERVE_USD: '950' }
});
assert.equal(reserved.measurements.availableNotionalUsd, 50);

const refractory = Metabolism.evaluate({ symbol: 'RKLB', quote, account, motorPolicy, providerCallsUsed: 1, env: {} });
assert.equal(refractory.allowsProviderCall, false);
assert(refractory.blockers.includes('finance_resource_provider_refractory'));
assert(refractory.recovery.includes('wait_for_a_fresh_packet'));

const duplicate = Metabolism.evaluate({
  symbol: 'RKLB', quote,
  account: Object.assign({}, account, { orders: [{ symbol: 'RKLB', status: 'open' }] }),
  motorPolicy, providerCallsUsed: 0, env: {}
});
assert(duplicate.blockers.includes('finance_resource_duplicate_open_order_inhibited'));

const missing = Metabolism.evaluate({ symbol: 'RKLB', quote: {}, account: {}, motorPolicy, providerCallsUsed: 0, env: {} });
assert.equal(missing.state, 'INHIBITED');
assert(missing.blockers.includes('finance_resource_total_cash_unmeasured'));
assert(missing.blockers.includes('finance_resource_total_equity_unmeasured'));
assert(missing.blockers.includes('finance_resource_quote_unmeasured'));

const decisionSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'finance-trade-decision.js'), 'utf8');
assert(/FinanceMetabolism\.evaluate\(/.test(decisionSource), 'Finance decision path must execute its resource metabolism');
assert(/resourceMetabolism:\s*\{/.test(decisionSource), 'Finance receipt must carry before/after metabolic state');

console.log('finance resource metabolism: passed');
