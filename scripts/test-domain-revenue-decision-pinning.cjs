'use strict';

var assert = require('node:assert/strict');
var RevenueDecision = require('../lib/domain-revenue-decision.js');
var Lanes = require('../lib/sovereign-domain-subscriber-lanes.js');
var FinanceDecision = require('../lib/finance-subscriber-decision.js');

function digest(domain, owner, key, body, sourceMode, sourceRef) {
  return { subject: domain + ' briefing', body: body, key: key,
    revenueDecision: RevenueDecision.create({ productDomain: domain, ownerDomain: owner,
      sourceMode: sourceMode, sourceRef: sourceRef, digestKey: key,
      contentHash: RevenueDecision.hash(body) }) };
}
function subscriber(domain) {
  return { email: domain + '@example.test', domain: domain, active: true,
    subscriptionId: 'sub-' + domain, customerId: 'cus-' + domain };
}

(function () {
  var body = 'A source-grounded domain revenue read.';
  var valid = digest('culture', 'culture', 'culture-live-1', body,
    RevenueDecision.MODES.DOMAIN_WIDE_LIVE_READ, 'culture-live');
  assert.equal(RevenueDecision.validate(valid.revenueDecision, 'culture', 'culture'), true);
  assert.equal(RevenueDecision.validate(Object.assign({}, valid.revenueDecision, { productDomain: 'finance' }), 'culture', 'culture'), false);
  assert.equal(RevenueDecision.validate(Object.assign({}, valid.revenueDecision, { contentHash: 'tampered' }), 'culture', 'culture'), false);

  var lane = Lanes.get('culture');
  assert.equal(lane.decision.candidate(subscriber('culture'), { subject: valid.subject, body: valid.body, key: valid.key }), null,
    'missing revenue pin must not enter a sovereign lane');
  assert(lane.decision.candidate(subscriber('culture'), valid), 'valid exact-domain revenue pin must enter the lane');
  var foreign = digest('finance', 'finance', valid.key, body,
    RevenueDecision.MODES.DOMAIN_WIDE_LIVE_READ, 'finance-live');
  assert.equal(lane.decision.candidate(subscriber('culture'), foreign), null,
    'foreign product revenue pin must not cross a domain lane');

  var finance = digest('finance', 'finance', 'finance-live-1', body,
    RevenueDecision.MODES.DOMAIN_WIDE_LIVE_READ, 'finance-live');
  assert(FinanceDecision.candidate(subscriber('finance'), finance));
  assert.equal(FinanceDecision.candidate(subscriber('finance'), { subject: finance.subject, body: finance.body, key: finance.key }), null);
  console.log('domain revenue decision pinning: exact source, owner, content and lane identity enforced PASS');
})();
