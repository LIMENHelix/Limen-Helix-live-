'use strict';

var assert = require('node:assert/strict');
var Observability = require('../lib/autonomy-cycle-observability.js');

var result = {
  ok: true,
  evaluatedAt: 1234,
  rows: [
    { productDomain: 'energy', status: 'PLANNED', reason: null,
      selectedProgram: 'SHORT_VIDEO', priority: 0.71234 },
    { domain: 'finance', stage: 'subject-decision', status: 'NO_ACTION',
      reason: 'subject-domain-video-work-order-not-current' },
    { domain: 'science', status: 'FAILED',
      reason: 'https://provider.invalid/?api_key=must-not-appear' }
  ]
};

var summary = Observability.summarize('communication-video-cycle', result);
assert.equal(summary.rows.length, 3);
assert.equal(summary.rows[0].selectedProgram, 'SHORT_VIDEO');
assert.equal(summary.rows[0].priority, 0.712);
assert.equal(summary.rows[2].reason, 'noncanonical-value-redacted');
assert.equal(summary.reasons['noncanonical-value-redacted'], 1);
assert.equal(summary.secretBearingFieldsIncluded, false);

var line = null;
Observability.emit('communication-video-cycle', result, function (value) { line = value; });
assert.match(line, /^\[autonomy-cycle\] /);
assert.doesNotMatch(line, /must-not-appear|api_key|provider\.invalid/);

console.log('autonomy cycle observability: per-domain gates visible without secret-bearing values');
