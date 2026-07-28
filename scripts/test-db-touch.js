#!/usr/bin/env node
/**
 * scripts/test-db-touch.js — prove the freshness instrumentation cannot break a write.
 *
 * lib/db-touch is called from lib/limen-db._redisRequest, which every store write
 * in this repo passes through. A bug there does not degrade a dashboard, it takes
 * down persistence for the whole system. So the properties worth asserting are
 * mostly negative: reads must not be recorded, a failing touch must not fail the
 * write, and the touch must not recurse into itself.
 *
 * RUN: node scripts/test-db-touch.js
 */

'use strict';

process.env.UPSTASH_REDIS_REST_URL = 'http://stub.local';
process.env.UPSTASH_REDIS_REST_TOKEN = 'stub';

var calls = [];
var failNextTouch = false;

globalThis.fetch = async function (url, opts) {
  var body = JSON.parse(opts.body);
  calls.push(body);
  if (failNextTouch && body[0] === 'HSET') {
    failNextTouch = false;
    throw new Error('simulated upstash failure on the touch write');
  }
  return { json: async function () { return { result: body[0] === 'HGETALL' ? [] : 'OK' }; } };
};

var db = require('../lib/limen-db');
var touch = require('../lib/db-touch');

var failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  PASS  ' + name); return; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
}
function hsets() { return calls.filter(function (c) { return c[0] === 'HSET'; }); }
function reset() { calls = []; }

// db-touch coalesces per namespace per process, so each case needs its own.
async function main() {
  console.log('\nnamespaceOf');
  check('limen: prefix keeps two segments', touch.namespaceOf('limen:sales:agg') === 'limen:sales',
        touch.namespaceOf('limen:sales:agg'));
  check('bare key takes one segment', touch.namespaceOf('feedhist:index') === 'feedhist');
  check('empty is null', touch.namespaceOf('') === null);

  console.log('\nwrites are recorded');
  reset();
  var ok = await db.set('t-alpha:one', { a: 1 });
  await new Promise(function (r) { setTimeout(r, 20); });
  check('set() still returns true', ok === true);
  check('a touch was issued', hsets().length === 1, JSON.stringify(hsets()));
  check('touch records the namespace, not the key',
        hsets()[0] && hsets()[0][2] === 'limen:t-alpha', hsets()[0] && hsets()[0][2]);

  console.log('\nreads are NOT recorded');
  reset();
  await db.get('t-beta:one');
  await new Promise(function (r) { setTimeout(r, 20); });
  check('a GET issues no touch', hsets().length === 0, JSON.stringify(hsets()));

  console.log('\ncoalescing');
  reset();
  await db.set('t-gamma:one', 1);
  await new Promise(function (r) { setTimeout(r, 20); });
  await db.set('t-gamma:two', 2);
  await db.set('t-gamma:three', 3);
  await new Promise(function (r) { setTimeout(r, 20); });
  check('three writes to one namespace issue one touch', hsets().length === 1,
        hsets().length + ' touches');

  console.log('\na failing touch does not fail the write');
  reset();
  failNextTouch = true;
  var ok2 = await db.set('t-delta:one', { a: 1 });
  await new Promise(function (r) { setTimeout(r, 30); });
  check('set() still returns true when the touch throws', ok2 === true);
  check('the SET itself was still issued',
        calls.filter(function (c) { return c[0] === 'SET'; }).length === 1);

  console.log('\nno recursion');
  reset();
  await db.set('t-eps:one', 1);
  await new Promise(function (r) { setTimeout(r, 40); });
  check('the touch write does not touch itself', hsets().length === 1,
        hsets().length + ' touches');

  console.log('\nlpush is a write');
  reset();
  await db.lpush('t-zeta:log', { x: 1 });
  await new Promise(function (r) { setTimeout(r, 20); });
  check('lpush issues a touch', hsets().length === 1);

  console.log('\nreadback');
  reset();
  var map = await db.touched();
  check('touched() returns an object', map && typeof map === 'object', typeof map);

  console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'all checks passed'));
  process.exit(failures ? 1 : 0);
}

main().catch(function (e) { console.error('threw: ' + e.message); process.exit(1); });
