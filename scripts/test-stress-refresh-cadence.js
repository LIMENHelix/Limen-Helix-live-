#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var root = path.join(__dirname, '..');
var vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
var cron = (vercel.crons || []).find(function (row) {
  return row.path === '/api/limen-worker-stress-refresh';
});
assert(cron, 'stress refresh cron must exist');
assert.equal(cron.schedule, '0,30 * * * *');

var handler = fs.readFileSync(path.join(root, 'handlers', 'limen-worker-stress-refresh.js'), 'utf8');
var ttl = /var TTL = (\d+);/.exec(handler);
assert(ttl, 'stress refresh TTL must be declared');
assert(Number(ttl[1]) > 2 * 30 * 60,
  'TTL must survive one missed half-hour run and remain live until the following slot');

var harness = fs.readFileSync(path.join(root, 'lib', 'harness-map.js'), 'utf8');
assert(harness.includes("job: 'limen-worker-stress-refresh',source: 'vercel', schedule: '0,30 * * * *'"));

console.log('stress refresh cadence: half-hour producer and missed-run-safe TTL passed');
