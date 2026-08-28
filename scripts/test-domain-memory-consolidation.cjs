#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

function read(file) { return fs.readFileSync(file, 'utf8'); }

var preview = read('lib/finance-preview-execution.js');
var admission = read('lib/finance-paper-admission.js');
var decision = read('lib/finance-trade-decision.js');
var bridge = read('lib/autofire-domain-bridge.js');
var efference = read('lib/autofire-efference.js');
var financeExecutor = read('lib/finance-paper-executor.js');
var refresh = read('handlers/brain-cognition-refresh.js');

assert(preview.includes('var RETENTION_SECONDS = null;'));
assert(admission.includes('var RETENTION_SECONDS = null;'));
assert(decision.includes('var RETENTION_SECONDS = null;'));
assert(!preview.includes('setIfAbsent(key, commanded, RETENTION_SECONDS)'));
assert(!admission.includes('setIfAbsent(admissionKey(request.packetId), receipt, RETENTION_SECONDS)'));
assert(!decision.includes('set(key(before.packetId), receipt, RETENTION_SECONDS)'));
assert(!bridge.includes("receipt, 180 * 86400"));

assert(!efference.includes('RECORD_TTL_SECONDS'));
assert(efference.includes('PENDING_TTL_SECONDS'), 'only unresolved worklist state may retain a TTL');
assert(efference.includes('db.set(recordKey(id), resolved)'), 'resolved command/reafference engram must be durable');

[
  'lib/autofire-learning.js',
  'lib/agriculture-homestead-learning.js',
  'lib/defense-publication-learning.js',
  'lib/governance-publication-learning.js',
  'lib/industry-crm-learning.js',
  'lib/infrastructure-real-estate-learning.js',
  'lib/intelligence-autopilot-learning.js',
  'lib/population-real-estate-learning.js',
  'lib/religion-subscriber-learning.js',
  'lib/trade-auction-learning.js'
].forEach(function (file) {
  assert(!/365\s*\*\s*86400/.test(read(file)), file + ' must not expire the owning brain learning state');
});

assert(financeExecutor.indexOf('learning.recordCommand') < financeExecutor.indexOf('b14.submitApproved'),
  'Finance must encode the action cause before Tradier paper dispatch');
assert(refresh.includes("target.pathname === '/api/product-domain-learning-state'"),
  'the autonomous hosted runner must return resolved outcome memory to the owning brain');
assert(refresh.includes('companyPatternCount:'), 'cognition must expose receipt that company memory reached the brain');

console.log('domain memory consolidation: transient buffers decay; decision, efference, outcome, and learned engrams persist');
