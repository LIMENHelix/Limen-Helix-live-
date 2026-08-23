#!/usr/bin/env node
'use strict';

/*
 * B9/row-24 evidence seam. Uses two different domain binders and their own
 * recorded fixtures. The shared latent is deliberately the same published USGS
 * Earthquake count; this is a real recorded edge, not an independence claim.
 */

var fs = require('fs');
var L = require('../brain-v2/kernel/lateral.js');
var envBinder = require('../brain-v2/bind/environment.js');
var tradeBinder = require('../brain-v2/bind/trade.js');

var env = JSON.parse(fs.readFileSync(__dirname + '/../brain-v2/fixtures/environment-recorder.json', 'utf8')).rows;
var trade = JSON.parse(fs.readFileSync(__dirname + '/../brain-v2/fixtures/supplyChain-recorder.json', 'utf8')).rows;
var byT = Object.create(null);
trade.forEach(function (row) { byT[row.t] = row; });
var pairs = [];
env.forEach(function (row) {
  var other = byT[row.t];
  if (!other) return;
  var a = envBinder.readRecorderRow(row).earthquakes;
  var b = tradeBinder.readRecorderRow(other).earthquakes;
  if (a && b && typeof a.value === 'number' && typeof b.value === 'number') pairs.push({ t: row.t, a: a.value, b: b.value });
});

var bus = L.createBus({ influenceCap: 0.5 });
L.register(bus, 'environment', pairs[0].t);
L.register(bus, 'supplyChain', pairs[0].t);
L.link(bus, 'environment', 'supplyChain', { at: pairs[0].t, latent: 'USGS Earthquakes / 24h', why: 'same source/key/units in two distinct domain binders' });
var delivered = 0, equal = 0;
pairs.forEach(function (p) {
  var r = L.publish(bus, 'environment', {
    latent: 'USGS Earthquakes / 24h', value: p.a, precision: 1 / 0.15,
    why: 'recorded fixture observation; source identity is the shared USGS feed'
  }, p.t);
  delivered += r.delivered.length;
  if (p.a === p.b) equal++;
});
var received = L.receive(bus, 'supplyChain', 1 / 0.15);
var echoed = L.publish(bus, 'supplyChain', {
  latent: 'USGS Earthquakes / 24h', value: pairs[0].b, precision: 1 / 0.15,
  why: 'recorded receiver observation; relay attempt must not count environment as independent'
}, pairs[0].t + 1, { inheritedFrom: bus.inbox.supplyChain[0] });

function ok(name, condition) {
  if (!condition) { console.error('FAIL ' + name); process.exitCode = 1; }
  else console.log('PASS ' + name);
}
ok('two distinct binders contributed recorded observations', pairs.length >= 100);
ok('the declared shared-source edge delivered traffic', delivered === pairs.length);
ok('the two binders agree on the shared source value', equal === pairs.length);
ok('receiver enforces its own precision budget', received.admitted.length === 0 && received.usedPrecision === 0 && received.capped.length > 0);
ok('a relay back toward the origin is refused as an echo', echoed.delivered.length === 0 && echoed.refused.some(function (x) { return /ECHO/.test(x.why); }));
ok('report keeps the independence caveat', L.report(bus).satisfiesRow24 === false);
console.log(JSON.stringify({
  recordedPairs: pairs.length,
  delivered: delivered,
  admitted: received.admitted.length,
  capped: received.capped.length,
  equalSourceValues: equal,
  echoRefused: bus.metrics.echoRefused,
  independence: 'not established: both domains read the same USGS source',
  row24: 'not complete'
}, null, 2));
