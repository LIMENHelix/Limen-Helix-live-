'use strict';
var assert = require('node:assert/strict');
var Bridge = require('../lib/lead-pipeline-bridge.js');

function DB() { this.map = new Map(); }
DB.prototype.get = async function (k) { return this.map.has(k) ? structuredClone(this.map.get(k)) : null; };
DB.prototype.set = async function (k, v) { this.map.set(k, structuredClone(v)); return true; };

(async function () {
  var db = new DB();
  var captured = await Bridge.capture({ eventId: 'front-form-1', name: 'Alex Buyer', email: 'Alex@Example.org',
    domain: 'finance', rung: 'p2', source: 'public-domain-form', consent: true, recordAcquisition: false }, { db: db });
  assert.equal(captured.ok, true); assert.equal(captured.newLead, true);
  var lead = await db.get('leadgen:lead:' + captured.leadId);
  assert.equal(lead.email, 'alex@example.org'); assert.equal(lead.domain, 'finance'); assert(lead.offers.includes('finance:p2'));
  var state = await db.get('crm:state:' + captured.leadId);
  assert.equal(state.status, 'new'); assert.equal(state.name, 'Alex Buyer');
  assert.deepEqual(await db.get('crm:worklist'), [captured.leadId]);
  assert.equal(await db.get('sales:agg'), null);

  var sameIdentity = await Bridge.capture({ eventId: 'checkout-2', email: 'alex@example.org', domain: 'finance', rung: 'p3',
    source: 'stripe-checkout-start', consent: true, recordAcquisition: true }, { db: db });
  assert.equal(sameIdentity.leadId, captured.leadId); assert.equal(sameIdentity.newLead, false);
  assert.equal((await db.get('leadgen:index')).length, 1);

  var enrolled = await Bridge.enroll({ eventId: 'evt_checkout_1', name: 'Alex Buyer', email: 'alex@example.org',
    domain: 'finance', rung: 'p3', revenueCents: 800, subscriptionId: 'sub_secret' }, { db: db });
  assert.equal(enrolled.ok, true); assert.equal(enrolled.status, 'enrolled'); assert.equal(enrolled.directCheckout, true);
  state = await db.get('crm:state:' + captured.leadId);
  assert.equal(state.status, 'enrolled'); assert.equal(state.appointmentRequired, false); assert.equal(state.showRequired, false);
  assert.equal((await db.get('leadgen:lead:' + captured.leadId)).status, 'enrolled');
  assert.equal(state.revenueCents, 800); assert.equal(JSON.stringify(state).includes('sub_secret'), false);
  var replay = await Bridge.enroll({ eventId: 'evt_checkout_1', email: 'alex@example.org', domain: 'finance', rung: 'p3', revenueCents: 800 }, { db: db });
  assert.equal(replay.duplicate, true); assert.equal((await db.get('crm:state:' + captured.leadId)).revenueCents, 800);
  console.log('lead pipeline bridge: public capture, identity join, CRM enrollment, and idempotent replay passed');
})().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });
