'use strict';
var assert = require('node:assert/strict');
var Envelope = require('../lib/g0-action-envelope.js');

var now = 1_700_000_000_000;
var sealed = Envelope.seal({
  domainId: 'culture', laneId: 'hero-image', action: 'paper-commissioning',
  payloadHash: Envelope.hash({ n: 1 }),
  idempotencyKey: 'paper/culture/1',
  decisionReceiptId: 'd1', authorizationReceiptId: 'a1',
  comprehensionReceiptId: 'c1', orientationReceiptId: 'o1',
  rollbackReference: 'replace-or-remove',
  outcomeObserverIdentity: 'culture-hero-public-asset-observer/1',
  budgetAuthorization: { budgetId: 'culture-media-budget/1', paperOnly: true, liveMoney: false, spendUsd: 0 },
  now: now
});
assert.equal(sealed.ok, true);
assert.equal(sealed.envelope.liveMoney, false);
assert.equal(Envelope.verify(sealed.envelope, now + 1000).ok, true);
assert.equal(Envelope.verify(sealed.envelope, now + Envelope.MAX_AGE_MS + 1).reason, 'g0-envelope-authority-expired');

var tampered = Object.assign({}, sealed.envelope, { action: 'other' });
assert.equal(Envelope.verify(tampered, now + 1000).ok, false);

var liveMoney = Envelope.seal(Object.assign({}, sealed.envelope, {
  now: now, budgetAuthorization: { budgetId: 'culture-media-budget/1', paperOnly: false, liveMoney: true, spendUsd: 1 }
}));
assert.equal(liveMoney.ok, false);
assert.equal(liveMoney.reason, 'g0-envelope-live-money-refused');

var missing = Envelope.seal({ domainId: 'culture', laneId: 'hero-image', action: 'x' });
assert.equal(missing.ok, false);
console.log('g0 action envelope: seal, verify, expiry, live-money refuse passed');
