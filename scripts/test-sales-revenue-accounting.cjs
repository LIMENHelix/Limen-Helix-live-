'use strict';
var assert = require('node:assert/strict');
var Sales = require('../lib/sales-engine.js');

(function () {
  var agg = Sales.emptyAgg();
  Sales.applyEvent(agg, { transitionId: 'source>leads', from: 'source', to: 'leads', unit: 'lead-gen-marketing', won: true, costCents: 0 });
  // Payment-rail enrollments carry exact collected cash on the unit. They do
  // not use __enroll, which is reserved for configured/simulated deal values.
  agg['shows>enrollments'] = { subscriptions: { attempts: 1, wins: 1, costCents: 0, revenueCents: 1200 } };
  var funnel = Sales.computeFunnel(agg);
  assert.equal(funnel.stageCounts.leads, 1);
  assert.equal(funnel.stageCounts.enrollments, 1);
  assert.equal(funnel.actualRevenueCents, 1200);
  assert.equal(funnel.estimatedRevenueCents, 0);
  assert.equal(funnel.revenueCents, 1200);

  Sales.applyEvent(agg, { transitionId: 'shows>enrollments', from: 'shows', to: 'enrollments', unit: 'closing', won: true, costCents: 0, dealSize: 'small' });
  funnel = Sales.computeFunnel(agg);
  assert.equal(funnel.actualRevenueCents, 1200);
  assert.equal(funnel.estimatedRevenueCents, Sales.defaultConfig().dealValueCents.small);
  assert.equal(funnel.revenueCents, 1200 + Sales.defaultConfig().dealValueCents.small);
  console.log('sales revenue accounting: exact payment cash and configured estimates remain distinct');
})();
