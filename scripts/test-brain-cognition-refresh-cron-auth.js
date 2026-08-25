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

console.log('brain cognition refresh cron auth: fail-closed credential gate precedes production reads and writes');
