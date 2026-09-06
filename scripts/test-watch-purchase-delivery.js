#!/usr/bin/env node
/**
 * Every Watch SKU must produce a customer-facing delivery: email body with
 * receipt + access URL, and every Watch page must load the return-access script.
 *
 * RUN: node scripts/test-watch-purchase-delivery.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('node:assert/strict');
var catalog = require('../lib/offer-catalog');
var delivery = require('../lib/watch-purchase-delivery');

var ROOT = path.join(__dirname, '..');
var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

var WATCH = [
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
];

function Mem() { this.values = {}; }
Mem.prototype.get = async function (k) { return this.values[k] == null ? null : JSON.parse(JSON.stringify(this.values[k])); };
Mem.prototype.set = async function (k, v) { this.values[k] = JSON.parse(JSON.stringify(v)); return true; };

(async function () {
  var offers = [];
  catalog.domains().forEach(function (domain) {
    var rungs = catalog.CATALOG[domain].rungs;
    Object.keys(rungs).forEach(function (rung) {
      offers.push(catalog.lookup(domain, rung));
    });
  });
  ok('catalog has sellable rungs', offers.length >= 20, 'got ' + offers.length);
  ok('every Watch domain has at least one rung', WATCH.every(function (d) { return !!catalog.lookup(d, 'p2') || Object.keys(catalog.CATALOG[d].rungs).length > 0; }));

  offers.forEach(function (offer) {
    var msg = delivery.compose({
      kind: 'welcome',
      subscriber: { email: 'buyer@example.com', domain: offer.domain, rung: offer.rung, offer: offer.name, priceCents: offer.priceCents, subscriptionId: 'sub_test' },
      offer: offer,
      paidCents: offer.priceCents
    }, null);
    ok(offer.domain + '/' + offer.rung + ' receipt names the SKU', msg.body.indexOf(offer.name) !== -1);
    ok(offer.domain + '/' + offer.rung + ' receipt includes access URL', msg.body.indexOf('https://limenhelix.com/' + offer.domain) !== -1);
    ok(offer.domain + '/' + offer.rung + ' receipt includes paid amount', msg.body.indexOf('$' + (offer.priceCents / 100).toFixed(2)) !== -1);
    ok(offer.domain + '/' + offer.rung + ' subject is receipt+access', msg.subject.indexOf('Receipt and access') === 0);
  });

  var store = new Mem();
  var sends = [];
  var sent = await delivery.deliver({
    eventId: 'evt_1', kind: 'welcome',
    subscriber: { email: 'buyer@example.com', domain: 'energy', rung: 'p2', offer: 'Utility rate watch', priceCents: 400 },
    offer: catalog.lookup('energy', 'p2'),
    paidCents: 400,
    store: store,
    briefingTimeoutMs: 20,
    buildFor: async function () { return { subject: 'brief', body: 'EIA rate moved.' }; },
    send: async function (to, subject, body, options) {
      sends.push({ to: to, subject: subject, body: body, options: options });
      return { ok: true, id: 're_1' };
    }
  });
  ok('welcome send reports SENT', sent.status === 'SENT' && sent.sent === true, JSON.stringify(sent));
  ok('welcome send attaches briefing', sent.briefingAttached === true);
  ok('welcome send uses Resend idempotency key', sends[0].options.idempotencyKey === 'watch-purchase-delivery/evt_1:welcome');
  ok('welcome body has briefing', sends[0].body.indexOf('EIA rate moved.') !== -1);

  var replay = await delivery.deliver({
    eventId: 'evt_1', kind: 'welcome',
    subscriber: { email: 'buyer@example.com', domain: 'energy', rung: 'p2', priceCents: 400 },
    store: store,
    send: async function () { sends.push({ replay: true }); return { ok: true, id: 're_2' }; }
  });
  ok('replay is duplicate, not a second send', replay.status === 'DUPLICATE' && sends.length === 1, JSON.stringify(replay));

  var noMail = await delivery.deliver({
    eventId: 'evt_2', kind: 'welcome',
    subscriber: { domain: 'culture', rung: 'p2' },
    store: new Mem()
  });
  ok('missing email still returns the access URL', noMail.status === 'NO_EMAIL' && noMail.accessUrl === 'https://limenhelix.com/culture');

  var notReady = await delivery.deliver({
    eventId: 'evt_3', kind: 'renewal',
    subscriber: { email: 'buyer@example.com', domain: 'finance', rung: 'p2', priceCents: 400 },
    store: new Mem(),
    buildFor: async function () { return null; },
    send: async function () { return { ok: false, notReady: true, error: 'RESEND_API_KEY not set' }; }
  });
  ok('Resend-not-ready is honest, not a fake send', notReady.status === 'NOT_READY' && notReady.sent === false);

  var webhook = fs.readFileSync(path.join(ROOT, 'handlers', 'stripe-webhook.js'), 'utf8');
  ok('webhook loads watch-purchase-delivery', webhook.indexOf("require('../lib/watch-purchase-delivery')") !== -1);
  ok('webhook still enqueues the domain motor', webhook.indexOf('welcomeMotor.enqueueAndAttempt({') !== -1);
  ok('webhook falls back when motor does not complete', webhook.indexOf("welcome.status !== 'COMPLETED'") !== -1);
  ok('webhook falls back on renewal too', webhook.indexOf("renewal.status !== 'COMPLETED'") !== -1);
  ok('webhook never calls crm.sendToLead', webhook.indexOf('crm.sendToLead') === -1);
  ok('welcome copy names the live access URL', webhook.indexOf("SITE + '/' + sub.domain") !== -1);

  var accessJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'watch-purchase-access.js'), 'utf8');
  ok('access script reads bought=', accessJs.indexOf("q.get('bought')") !== -1);
  ok('access script never talks to Stripe', accessJs.indexOf('checkout.stripe') === -1 && accessJs.indexOf('/api/checkout') === -1);

  WATCH.forEach(function (d) {
    var html = fs.readFileSync(path.join(ROOT, d + '.html'), 'utf8');
    ok(d + '.html loads purchase-access script', html.indexOf('/assets/js/watch-purchase-access.js') !== -1);
  });

  var gen = fs.readFileSync(path.join(ROOT, 'scripts', 'gen-domain-fronts.cjs'), 'utf8');
  ok('front generator keeps the access script', gen.indexOf('watch-purchase-access.js') !== -1);

  var rail = fs.readFileSync(path.join(ROOT, 'lib', 'stripe-rail.js'), 'utf8');
  ok('outflow halt untouched', rail.indexOf('never sends money on its own') !== -1);

  if (fail) {
    console.log('\nwatch purchase delivery: ' + pass + ' passed, ' + fail + ' failed');
    process.exit(1);
  }
  console.log('\nwatch purchase delivery: ' + pass + ' passed');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
