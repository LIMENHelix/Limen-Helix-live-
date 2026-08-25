#!/usr/bin/env node
'use strict';

/** Per-domain metabolic/resource ownership over the shared physiology primitive. */

var fs = require('node:fs');
var REG = require('../bind/registry.js');
var LOOP = require('../kernel/loop.js');
var VIT = require('../kernel/vitals.js');

var tests = 0, failures = 0;
function assert(name, condition, detail) {
  tests++;
  if (condition) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var required = [
  'queueDepth', 'recursionDepth', 'eventLoopLagMs', 'memoryBytes', 'computeUnits',
  'errorRate', 'contradictionLoad', 'amplification', 'confidenceDrift',
  'actionFrequency', 'staleStateLoad', 'sourceFailureRate',
  'crossDomainPropagationVolume', 'learningUpdateVolume'
];

console.log('RH: separately owned resource state over the shared physiology primitive');

assert('the §8.16 minimum resource contract is declared exactly once in the shared kernel',
  required.every(function (name) { return VIT.RESOURCE_REQUIREMENTS.indexOf(name) >= 0; }),
  JSON.stringify(VIT.RESOURCE_REQUIREMENTS));

var missing = VIT.resourceState({ queueDepth: 0 }, {});
assert('an unavailable resource is UNMEASURED rather than silently zero',
  missing.complete === false && missing.missing.indexOf('eventLoopLagMs') >= 0 &&
  missing.variables.filter(function (row) { return row.name === 'eventLoopLagMs'; })[0].value === null,
  JSON.stringify(missing));

var domains = [];
REG.INSTALLED_DOMAINS.forEach(function (product) {
  var d = REG.descriptorFor(product);
  var binder = require(REG.binderPath(d));
  var fixture = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
  var rows = Array.isArray(fixture.rows) ? fixture.rows : [];
  var chosen = null, readings = null;
  for (var i = 0; i < rows.length; i++) {
    var candidate = binder.readRecorderRow(rows[i]) || {};
    if (Object.keys(candidate).length) { chosen = rows[i]; readings = candidate; break; }
  }
  if (!chosen) {
    domains.push({ domain: product, ok: false, why: 'no readable fixture row' });
    return;
  }
  var loop = LOOP.create({ domain: d.snapshot, brainSpec: binder.spec(), horizonMs: 3600000 });
  var report = LOOP.tick(loop, readings, chosen.t, {
    eventLoopLagMs: 2.5,
    recursionDepth: 0,
    crossDomainPropagationVolume: 0
  });
  var resource = report.selfModel && report.selfModel.resourceState;
  var names = resource && resource.variables.map(function (row) { return row.name; }) || [];
  domains.push({
    domain: product,
    ok: !!resource && resource.complete === true && resource.ownerDomain === d.snapshot &&
      resource.policyId === 'brain-v2-resource-policy/1:' + d.snapshot &&
      required.every(function (name) { return names.indexOf(name) >= 0; }),
    measured: resource && resource.measured,
    required: resource && resource.required,
    missing: resource && resource.missing
  });
});

assert('all twenty installed loops produce complete measurements with separate domain ownership',
  domains.length === 20 && domains.every(function (row) { return row.ok; }),
  JSON.stringify(domains));

var isolatedEnergy = VIT.create({ ownerDomain: 'energy' });
var isolatedFinance = VIT.create({ ownerDomain: 'finance' });
var isolatedMeasurements = {};
VIT.RESOURCE_REQUIREMENTS.forEach(function (name) { isolatedMeasurements[name] = 0; });
isolatedMeasurements.computeUnits = VIT.DEFAULTS.setPoints.computeUnits.max + 1;
var isolatedBreach = VIT.evaluate(isolatedEnergy, isolatedMeasurements);
VIT.regulate(isolatedEnergy, isolatedBreach, 1);
VIT.regulate(isolatedEnergy, isolatedBreach, 2);
VIT.regulate(isolatedEnergy, isolatedBreach, 3);
assert('one domain resource breach cannot mutate another domain brain',
  isolatedEnergy.degraded === true && isolatedFinance.degraded === false &&
  isolatedEnergy.consecutiveOutOfRange === 3 && isolatedFinance.consecutiveOutOfRange === 0 &&
  isolatedEnergy.ownerDomain === 'energy' && isolatedFinance.ownerDomain === 'finance');

assert('each domain persists its own resource owner and allostatic history',
  VIT.deserialize(VIT.serialize(isolatedEnergy)).ownerDomain === 'energy' &&
  VIT.deserialize(VIT.serialize(isolatedFinance)).ownerDomain === 'finance' &&
  VIT.deserialize(VIT.serialize(isolatedEnergy)).degraded === true &&
  VIT.deserialize(VIT.serialize(isolatedFinance)).degraded === false);

var v = VIT.create();
var measurements = {};
VIT.RESOURCE_REQUIREMENTS.forEach(function (name) { measurements[name] = 0; });
measurements.memoryBytes = VIT.DEFAULTS.setPoints.memoryBytes.max + 1;
measurements.computeUnits = VIT.DEFAULTS.setPoints.computeUnits.max + 1;
measurements.actionFrequency = 1;
measurements.crossDomainPropagationVolume = VIT.DEFAULTS.setPoints.crossDomainPropagationVolume.max + 1;
measurements.learningUpdateVolume = VIT.DEFAULTS.setPoints.learningUpdateVolume.max + 1;
var homeo = VIT.evaluate(v, measurements);
var regulated = VIT.regulate(v, homeo, 1);
var actions = regulated.actions.map(function (row) { return row.action; });
assert('resource breaches produce named recovery responses rather than only alarms',
  ['compact_memory', 'reduce_compute', 'increase_inhibition', 'reduce_propagation', 'lower_learning_rate']
    .every(function (name) { return actions.indexOf(name) >= 0; }),
  JSON.stringify(actions));

VIT.regulate(v, homeo, 2);
var degraded = VIT.regulate(v, homeo, 3);
assert('three consecutive resource breaches enter degraded mode',
  degraded.degraded === true && degraded.actions.some(function (row) { return row.action === 'enter_degraded_mode'; }),
  JSON.stringify(degraded));

var quiet = {};
Object.keys(VIT.DEFAULTS.setPoints).forEach(function (name) { quiet[name] = VIT.DEFAULTS.setPoints[name].target; });
var recovered = VIT.regulate(v, VIT.evaluate(v, quiet), 4);
assert('return to the acceptable range exits degraded mode',
  recovered.degraded === false && recovered.actions.some(function (row) { return row.action === 'exit_degraded_mode'; }),
  JSON.stringify(recovered));

var serialized = VIT.serialize(v);
serialized.lastConfidence = 0.42;
assert('confidence baseline survives restoration for the next drift measurement',
  VIT.deserialize(serialized).lastConfidence === 0.42);

console.log('');
console.log((tests - failures) + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
if (failures) process.exit(1);
