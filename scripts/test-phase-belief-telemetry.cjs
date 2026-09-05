'use strict';

var assert = require('node:assert/strict');
var telemetry = require('../lib/phase-belief-telemetry');

var abstained = telemetry.build({
  grounded: false,
  phaseMAP: 4,
  confidence: 0,
  stuck: null,
  belief: [0.11111, 0.22222],
  degraded: {
    reason: 'total precision 0.42 < floor 0.5 — abstain',
    untransformedChannels: true
  },
  corrState: { secret: 'must not escape' }
}, {
  diagnosticOnly: true,
  floor: 0.5,
  totalPrecision: 0.42,
  channels: [
    { key: 'distress', precision: 0.12, informative: true, fromHint: false },
    { key: 'marketScore', precision: 0.3, informative: true, fromHint: true }
  ],
  belief: ['must not escape'],
  corrState: { secret: 'must not escape' }
});

assert.equal(abstained.grounded, false);
assert.equal(abstained.reason, 'total precision 0.42 < floor 0.5 — abstain');
assert.deepEqual(abstained.degraded, {
  reason: 'total precision 0.42 < floor 0.5 — abstain',
  untransformedChannels: true,
  selfConsistencyPrecision: null,
  uninformativeChannels: null
});
assert.deepEqual(abstained.belief, [0.111, 0.222]);
assert.equal(Object.prototype.hasOwnProperty.call(abstained, 'corrState'), false);
assert.deepEqual(abstained.precisionDiagnostic, {
  diagnosticOnly: true,
  floor: 0.5,
  totalPrecision: 0.42,
  channels: [
    { key: 'distress', precision: 0.12, informative: true, fromHint: false },
    { key: 'marketScore', precision: 0.3, informative: true, fromHint: true }
  ]
});
assert.equal(Object.prototype.hasOwnProperty.call(abstained.precisionDiagnostic, 'belief'), false);
assert.equal(Object.prototype.hasOwnProperty.call(abstained.precisionDiagnostic, 'corrState'), false);

var grounded = telemetry.build({
  grounded: true,
  phaseMAP: 7,
  confidence: 0.75,
  stuck: 0.2,
  belief: [0.1, 0.9],
  channels: [
    { key: 'distress', precision: 1.25, informative: true, fromHint: true },
    { key: 'unison', precision: 0, informative: false, fromHint: false }
  ],
  degraded: { selfConsistencyPrecision: true, uninformativeChannels: 1, note: 'not copied into payload' }
});

assert.equal(grounded.reason, null);
assert.deepEqual(grounded.channels, [
  { key: 'distress', precision: 1.25, informative: true, fromHint: true },
  { key: 'unison', precision: 0, informative: false, fromHint: false }
]);
assert.equal(grounded.degraded.selfConsistencyPrecision, true);
assert.equal(grounded.degraded.uninformativeChannels, 1);
assert.equal(Object.prototype.hasOwnProperty.call(grounded.degraded, 'note'), false);
assert.equal(grounded.precisionDiagnostic, null);

var malformed = telemetry.build(null);
assert.equal(malformed.grounded, false);
assert.equal(malformed.reason, 'estimator abstained without a reason');
assert.equal(malformed.channels, null);
assert.equal(malformed.precisionDiagnostic, null);

console.log('phase belief telemetry: abstention reason, bounded degradation, and channel precision preserved; estimator memory excluded');
