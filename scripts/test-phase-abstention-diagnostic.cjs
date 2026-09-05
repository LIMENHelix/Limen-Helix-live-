'use strict';

var assert = require('node:assert/strict');
var estimator = require('../lib/phase-estimator');
var diagnostic = require('../lib/phase-abstention-diagnostic');

var likelihood = [0.01, 0.01, 0.01, 0.01, 0.01, 0.8, 0.03, 0.03, 0.03, 0.03, 0.03];
var bundle = {
  substrate: 'business',
  subjectId: 'audit-fixture',
  readings: [{
    key: 'companyDistress',
    value: 0.4,
    likelihood: likelihood,
    precisionHint: 0.1
  }]
};
var opts = { history: {}, corrState: null, distressComposite: 0.4 };

var actual = estimator.estimate(bundle, opts);
assert.equal(actual.grounded, false);
assert.match(actual.degraded.reason, /^total precision 0\.1 < floor 0\.5/);

var view = diagnostic.inspect(estimator, bundle, opts);
assert.deepEqual(view, {
  diagnosticOnly: true,
  floor: 0.5,
  totalPrecision: 0.1,
  channels: [{
    key: 'companyDistress',
    precision: 0.1,
    informative: true,
    fromHint: true
  }]
});

assert.equal(opts.precisionFloor, undefined, 'caller options must not be mutated');
assert.equal(actual.grounded, false, 'diagnostic replay must not change the authoritative result');
assert.equal(Object.prototype.hasOwnProperty.call(view, 'belief'), false);
assert.equal(Object.prototype.hasOwnProperty.call(view, 'corrState'), false);
assert.equal(diagnostic.inspect(null, bundle, opts), null);

var overrideOpts = { history: {}, corrState: null, precisionFloor: 1 };
var overrideView = diagnostic.inspect(estimator, bundle, overrideOpts);
assert.equal(overrideView.floor, 1, 'diagnostic must report the authoritative override floor');
assert.ok(Math.abs(overrideView.totalPrecision - 0.1) < 1e-12);

var boundaryReadings = [];
for (var i = 0; i < 12; i++) {
  boundaryReadings.push({
    key: 'boundary-' + i,
    value: 0.4,
    likelihood: likelihood,
    precisionHint: 0.499
  });
}
var boundaryBundle = { substrate: 'business', subjectId: 'rounding-boundary', readings: boundaryReadings };
var boundaryActual = estimator.estimate(boundaryBundle, {});
var boundaryView = diagnostic.inspect(estimator, boundaryBundle, {});
var roundedChannelSum = boundaryView.channels.reduce(function (sum, channel) { return sum + channel.precision; }, 0);
assert.equal(boundaryActual.grounded, false);
assert.match(boundaryActual.degraded.reason, /^total precision 0\.499 < floor 0\.5/);
assert.ok(roundedChannelSum > boundaryView.floor, 'fixture must demonstrate rounded-channel contradiction');
assert.ok(boundaryView.totalPrecision < boundaryView.floor, 'unrounded diagnostic total must preserve abstention');
assert.ok(Math.abs(boundaryView.totalPrecision - 0.499) < 1e-12);

console.log('phase abstention diagnostic: effective floor and unrounded total exposed without promotion or estimator memory');
