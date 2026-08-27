'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var Treasury = require('../lib/civilization-treasury-ledger.js');

function storeDouble() {
  var values = new Map(), lists = new Map();
  return {
    values: values, lists: lists,
    assertDurable: function () { return true; },
    get: async function (key) { return values.has(key) ? values.get(key) : null; },
    set: async function (key, value) { values.set(key, value); return true; },
    setIfAbsent: async function (key, value) {
      if (values.has(key)) return false;
      values.set(key, value); return true;
    },
    lpush: async function (key, value) {
      var list = lists.get(key) || []; list.unshift(value); lists.set(key, list); return list.length;
    },
    ltrim: async function (key, start, stop) {
      var list = lists.get(key) || []; lists.set(key, list.slice(start, stop + 1)); return true;
    },
    lrange: async function (key, start, stop) {
      var list = lists.get(key) || []; return list.slice(start, stop === -1 ? undefined : stop + 1);
    }
  };
}

async function main() {
  assert.equal(Treasury.DOMAINS.length, 20);
  assert.equal(new Set(Treasury.DOMAINS).size, 20);
  assert.equal(Treasury.OUTBOUND_MONEY_AUTHORIZED, false);
  await assert.rejects(function () { return Treasury.post({}, {}); }, /strict durable treasury store required/);

  var db = storeDouble();
  var financeContribution = Treasury.contribution('finance', 100000, 'operator:finance:seed:1', 'bank-receipt:seed:1');
  var first = await Treasury.post(db, financeContribution, 1000);
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.receipt.externalEffectExecuted, false);
  assert.equal(first.receipt.outboundMoneyAuthorized, false);
  assert.equal((await Treasury.post(db, financeContribution, 2000)).duplicate, true);
  await assert.rejects(function () {
    return Treasury.post(db, Treasury.contribution('finance', 99999, 'operator:finance:seed:1', 'bank-receipt:seed:1'), 3000);
  }, /idempotency conflict/);

  await Treasury.post(db, Treasury.capitalization('science', 20000, 'finance:science:allocation:1', 'allocation-policy:v1'), 4000);
  await assert.rejects(function () {
    return Treasury.post(db, Treasury.capitalization('medicine', 90000, 'finance:medicine:allocation:overdraw', 'allocation-policy:v1'), 5000);
  }, /overdraw/);

  await Treasury.post(db, Treasury.saleCaptured('religion', 1200, 'stripe:event:checkout_1', 'evt_checkout_1'), 6000);
  await Treasury.post(db, Treasury.saleSettled('religion', {
    grossCents: 1200, feeCents: 60, statutoryTaxCents: 100, levyCents: 100, netCents: 940
  }, 'stripe:settlement:txn_1', 'txn_1', 'civilization-levy:v1'), 7000);

  var projection = await Treasury.project(db);
  assert.equal(projection.domainCount, 20);
  assert.equal(projection.receiptCount, 4);
  assert.equal(projection.conserved, true);
  assert.equal(projection.protectedBalancesNonnegative, true);
  assert.equal(projection.outboundMoneyAuthorized, false);
  var byDomain = Object.fromEntries(projection.accounts.map(function (row) { return [row.productDomain, row]; }));
  assert.equal(byDomain.finance.availableCashCents, 80100);
  assert.equal(byDomain.science.availableCashCents, 20000);
  assert.equal(byDomain.religion.pendingCashCents, 0);
  assert.equal(byDomain.religion.availableCashCents, 940);
  assert.equal(byDomain.religion.recognizedRevenueCents, 1200);
  assert.equal(byDomain.religion.costsCents, 60);
  assert.equal(byDomain.religion.statutoryTaxLiabilityCents, 100);
  assert.equal(byDomain.religion.civilizationLevyPaidCents, 100);
  assert.equal(byDomain.agriculture.availableCashCents, 0);
  assert.equal(byDomain.agriculture.recognizedRevenueCents, 0);

  await Treasury.post(db, Treasury.transfer('science', 'medicine', 5000,
    'science:medicine:transfer:1', 'inter-domain-transfer-policy:v1'), 8000);
  projection = await Treasury.project(db);
  byDomain = Object.fromEntries(projection.accounts.map(function (row) { return [row.productDomain, row]; }));
  assert.equal(byDomain.science.availableCashCents, 15000);
  assert.equal(byDomain.medicine.availableCashCents, 5000);
  assert.equal(byDomain.finance.availableCashCents, 80100);

  await Treasury.post(db, Treasury.reserve('science', 2000, 'science:reserve:1', 'science-reserve-policy:v1'), 8100);
  await Treasury.post(db, Treasury.releaseReserve('science', 500, 'science:reserve-release:1', 'science-reserve-policy:v1'), 8200);
  await Treasury.post(db, Treasury.commit('science', 1000, 'science:commit:1', 'science-commit-policy:v1'), 8300);
  await Treasury.post(db, Treasury.releaseCommit('science', 250, 'science:commit-release:1', 'science-commit-policy:v1'), 8400);
  await Treasury.post(db, Treasury.expense('science', 1000, 'science:expense:1', 'vendor-receipt:1'), 8500);
  await Treasury.post(db, Treasury.dispute('science', false, 500, 'science:dispute-hold:1', 'stripe-dispute:1'), 8600);
  await Treasury.post(db, Treasury.dispute('science', true, 200, 'science:dispute-release:1', 'stripe-dispute:1'), 8700);
  await Treasury.post(db, Treasury.refund('religion', 'available', 200, 'religion:refund:1', 'stripe-refund:1'), 8800);
  await Treasury.post(db, Treasury.reconciliation('medicine', 'available', 100,
    'medicine:reconciliation:add:1', 'bank-reconciliation:1', 'exact confirmed adjustment'), 8900);
  await Treasury.post(db, Treasury.reconciliation('medicine', 'available', -50,
    'medicine:reconciliation:subtract:1', 'bank-reconciliation:2', 'exact confirmed adjustment'), 8950);
  projection = await Treasury.project(db);
  byDomain = Object.fromEntries(projection.accounts.map(function (row) { return [row.productDomain, row]; }));
  assert.equal(byDomain.science.availableCashCents, 11450);
  assert.equal(byDomain.science.reservedCashCents, 1500);
  assert.equal(byDomain.science.committedCashCents, 750);
  assert.equal(byDomain.science.disputeHoldCents, 300);
  assert.equal(byDomain.science.costsCents, 1000);
  assert.equal(byDomain.religion.availableCashCents, 740);
  assert.equal(byDomain.religion.recognizedRevenueCents, 1000);
  assert.equal(byDomain.medicine.availableCashCents, 5050);
  assert.deepEqual(projection.blockers, [
    'external-balance-reconciliation-not-connected',
    'atomic-spend-reservation-not-implemented',
    'outbound-payment-adapter-not-authorized'
  ]);

  await assert.rejects(function () {
    return Treasury.post(db, Treasury.saleSettled('religion', {
      grossCents: 500, feeCents: 50, statutoryTaxCents: 0, levyCents: 0, netCents: 450
    }, 'stripe:settlement:without-capture', 'txn_missing'), 9000);
  }, /overdraw/);
  assert.throws(function () {
    Treasury.saleSettled('religion', {
      grossCents: 1200, feeCents: 60, statutoryTaxCents: 100, levyCents: 100, netCents: 941
    }, 'stripe:settlement:bad-math', 'txn_bad', 'civilization-levy:v1');
  }, /components must equal/);
  assert.throws(function () {
    Treasury.saleSettled('religion', {
      grossCents: 1200, feeCents: 60, statutoryTaxCents: 100, levyCents: 100, netCents: 940
    }, 'stripe:settlement:no-policy', 'txn_no_policy');
  }, /requires policyRef/);
  assert.throws(function () {
    Treasury.build({ kind: 'EXPENSE', idempotencyKey: 'malicious:1', ownerDomain: 'science',
      movements: [Treasury.movement(Treasury.cash('finance', 'available'), Treasury.external('vendor'), 1)],
      metrics: { costCents: 1 }, externalRef: 'fake' });
  }, /account geometry invalid/);

  var source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'civilization-treasury-ledger.js'), 'utf8');
  assert.equal(/fetch\s*\(|require\(['"].*stripe|require\(['"].*paypal|placeOrder\s*\(|createPayment\w*\s*\(|createPayout\w*\s*\(/i.test(source), false,
    'treasury ledger must contain no external money adapter');
  assert(source.includes('outboundMoneyAuthorized: false'));

  console.log('civilization treasury ledger: 20 sovereign projections, conserved receipts, idempotency, no shared-balance copying, no money authority');
}

main().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
