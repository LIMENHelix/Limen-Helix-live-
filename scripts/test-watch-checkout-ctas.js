#!/usr/bin/env node
/**
 * Watch-page Stripe last mile: catalog rungs + static CTAs + GET start.
 *
 * RUN: node scripts/test-watch-checkout-ctas.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var catalog = require('../lib/offer-catalog');
var phaseMap = require('../lib/phase-map');

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
var NEW_DOMAINS = ['energy', 'culture', 'communication', 'industry', 'infrastructure'];

ok('catalog lists all 20 domains', catalog.domains().length === 20, 'got ' + catalog.domains().length);

NEW_DOMAINS.forEach(function (d) {
  var o = catalog.lookup(d, 'p2');
  ok(d + ' has a p2 L1 watch', !!(o && o.priceCents === 400), o ? JSON.stringify(o) : 'missing');
  ok(d + ' metadata domain is itself', !!(o && o.domain === d));
});

ok('industry p1 is $8 event', (catalog.lookup('industry', 'p1') || {}).priceCents === 800);
ok('communication p1 is $8 event', (catalog.lookup('communication', 'p1') || {}).priceCents === 800);
ok('infrastructure p1 is $8 event', (catalog.lookup('infrastructure', 'p1') || {}).priceCents === 800);

// Firewall: existing binders/SKUs stay put.
ok('religion p2 unchanged', (catalog.lookup('religion', 'p2') || {}).name === 'Your Charities, Each Filing');
ok('education p2 unchanged', (catalog.lookup('education', 'p2') || {}).name === 'Your Shortlist, Each Release');
ok('agriculture p2 unchanged', (catalog.lookup('agriculture', 'p2') || {}).priceCents === 400);
ok('law still has six rungs', ['p1','p2','p4','p8','p9','p10'].every(function (r) { return !!catalog.lookup('law', r); }));

NEW_DOMAINS.forEach(function (d) {
  ok(d + ' has a phase-map p2', !!phaseMap.get(d, 'p2'));
});

var sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'phase-registry.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'domain-offers.js'), 'utf8'), sandbox);
var offers = sandbox.window.LIMEN_DOMAIN_OFFERS;
NEW_DOMAINS.forEach(function (d) {
  var o = offers.get(d);
  ok(d + ' client offer is sellable', !!(o && o.p2 && !o.noSource));
});

WATCH.forEach(function (d) {
  var html = fs.readFileSync(path.join(ROOT, d + '.html'), 'utf8');
  var needle = '/api/checkout?start=1&amp;domain=' + d + '&amp;rung=p2';
  ok(d + '.html has a checkout CTA for its own SKU', html.indexOf(needle) !== -1);
  ok(d + '.html does not hardcode another domain CTA', WATCH.filter(function (other) {
    return other !== d && html.indexOf('/api/checkout?start=1&amp;domain=' + other + '&amp;') !== -1;
  }).length === 0);
});

var rail = fs.readFileSync(path.join(ROOT, 'lib', 'stripe-rail.js'), 'utf8');
ok('stripe-rail still accepts only', rail.indexOf('ACCEPTS income') !== -1);
ok('stripe-rail still halts outflow', rail.indexOf('never sends money on its own') !== -1);
ok('subscription metadata is domain-scoped', rail.indexOf('domain: opts.domain') !== -1);

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (s) { this.body = s || ''; }
  };
}

var checkout = require('../handlers/checkout');

function run(req) {
  var res = mockRes();
  return Promise.resolve(checkout(req, res)).then(function () { return res; });
}

run({ method: 'GET', url: '/api/checkout' }).then(function (res) {
  var j = JSON.parse(res.body);
  ok('GET catalog stays 200', res.statusCode === 200);
  ok('GET catalog lists new rungs', j.count >= 45 && j.rungs.some(function (r) { return r.domain === 'energy' && r.rung === 'p2'; }), 'count=' + j.count);
  ok('GET catalog does not start a session', !res.headers.Location);
  return run({ method: 'GET', url: '/api/checkout?start=1&domain=not-a-domain&rung=p2' });
}).then(function (res) {
  var j = JSON.parse(res.body || '{}');
  ok('GET start unknown domain is 400', res.statusCode === 400 && j.ok === false);
  var prevKey = process.env.STRIPE_SECRET_KEY;
  var prevSubs = process.env.STRIPE_SECRET_KEY_SUBS;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY_SUBS;
  return run({ method: 'GET', url: '/api/checkout?start=1&domain=religion&rung=p2' }).then(function (res2) {
    if (prevKey !== undefined) process.env.STRIPE_SECRET_KEY = prevKey;
    if (prevSubs !== undefined) process.env.STRIPE_SECRET_KEY_SUBS = prevSubs;
    var j2 = JSON.parse(res2.body || '{}');
    ok('GET start without a key is 503, not a spend', res2.statusCode === 503 && j2.enabled === false);
  });
}).then(function () {
  console.log('\n' + pass + '/' + (pass + fail) + ' passed');
  process.exitCode = fail ? 1 : 0;
}).catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
