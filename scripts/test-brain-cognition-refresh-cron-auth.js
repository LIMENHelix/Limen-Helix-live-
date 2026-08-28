#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

var source = fs.readFileSync('handlers/brain-cognition-refresh.js', 'utf8');
var authImport = source.indexOf("require('../lib/cron-auth.js')");
var authCall = source.indexOf('cronAuth.enforce(req, res)');
var snapshotFetch = source.indexOf("fetch(BASE + '/api/domain-snapshot')");
var firstRedisWrite = source.indexOf('productDomainMotorReceipt.persist(');

assert(authImport >= 0, 'cron auth module must be imported');
assert(authCall >= 0, 'cron auth must be enforced');
assert(authCall < snapshotFetch, 'authentication must precede the first production snapshot fetch');
assert(authCall < firstRedisWrite, 'authentication must precede all motor receipt writes');
assert(!/x-vercel-(cron|signature)/i.test(source), 'caller-controlled Vercel headers must not authorize the worker');
assert(source.includes("res.setHeader('cache-control', 'no-store')"));
assert(source.includes('const num = cognitionProjection.num;'), 'refresh must import the numeric projection helper it calls');
assert(source.includes('const arr = cognitionProjection.arr;'), 'refresh must import the array projection helper it calls');
assert(source.includes('const val = cognitionProjection.val;'), 'refresh must import the nullable-value projection helper it calls');
assert(source.includes("stage: 'domain-refresh'"), 'domain refresh failures must be reported instead of swallowed');
assert(source.includes("stage: 'cognition-store'"), 'cognition persistence failures must be reported');
assert(source.includes("stage: 'domain-learning-read'"), 'the hosted brain must report failures reading its own resolved-outcome memory');
assert(source.includes("target.pathname === '/api/product-domain-learning-state'"), 'the hosted brain sandbox must expose the same domain-owned learning afferent as the browser brain');
assert(source.includes('externalActionLearning:'), 'the compact cognition record must prove whether resolved-outcome memory reached the brain organ');
assert(source.includes('res.statusCode = complete ? 200 : 503;'), 'an incomplete 20-brain refresh must fail its HTTP health signal');
assert(!source.includes('catch (e) {}'), 'refresh must not silently discard named failures');

console.log('brain cognition refresh: fail-closed auth and honest 20-brain persistence status');
