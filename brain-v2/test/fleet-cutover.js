/**
 * brain-v2/test/fleet-cutover.js — the operator fleet is driven by brain-v2
 * evidence and cannot be steered by retired browser-brain telemetry.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var READOUT = require('../core/operator-readout.js');
var SIGNALS = require('../../lib/fleet-signals.js');
var DECISION = require('../../lib/fleet-decision.js');
var FLEET = require('../../lib/operator-fleet.js');

var tests = 0, failures = 0;
function assert(name, condition, detail) {
  tests++;
  if (condition) console.log('  PASS ' + name);
  else {
    failures++;
    console.error('  FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function measured(options) {
  options = options || {};
  var cycle = READOUT.fromCycle({
    domain: options.domain || 'energy',
    cycleAt: options.cycleAt || 1234,
    cycle: 8,
    state: {
      abstained: false,
      departure: options.departure === undefined ? -1.5 : options.departure,
      confidence: options.confidence === undefined ? 0.8 : options.confidence,
      totalPrecision: 4
    },
    sensors: [],
    dysregulation: {
      detected: options.detected === true,
      departure: options.departure === undefined ? -1.5 : options.departure,
      drivers: [],
      basis: 'declared brain-v2 evidence'
    },
    findings: options.findings || [],
    candidates: [],
    blind: options.blind || [],
    divergence: { pairs: 0, comparable: 0, detected: false, divergences: [], skipped: [] }
  });
  return {
    ok: true,
    runtime: 'brain-v2-shadow/0.1.0',
    domain: options.domain || 'energy',
    product: options.domain || 'energy',
    startedAt: 1000,
    finishedAt: 2000,
    rowsAvailable: 20,
    rowsApplied: 1,
    ticks: 1,
    restored: true,
    abstentions: [],
    provenance: { channelsRead: 4 },
    operatorRead: cycle,
    predictions: { open: 2, resolved: 3 },
    calibration: { status: 'MEASURED' },
    relationshipEvidence: [],
    domainFunction: { ticksObserved: 1 }
  };
}

console.log('');
console.log('=== BRAIN V2 OPERATOR FLEET CUTOVER ===');

var report = measured({
  departure: -1.5,
  detected: true,
  findings: [{ id: 'LOW_SIDE_FAILURE', active: true, triggeredBy: ['x'] }],
  blind: [{ what: 'y', why: 'missing' }]
});
var state = SIGNALS.adaptCycle(
  { id: 'energy' },
  report,
  [{ title: 'Separate business lead', rank: 9 }]
);

assert('FC1 adapter names brain-v2 as authority', state.brainAuthority === 'brain-v2');
assert('FC2 signed fused departure is preserved', state.brainDeparture === -1.5);
assert('FC3 a measured non-abstained state is ready', state.brainV2Ready === true);
assert('FC4 active findings cross without becoming opportunities',
  state.brainFindings[0].id === 'LOW_SIDE_FAILURE' &&
  state.brainOpportunities[0].title === 'Separate business lead');
assert('FC5 blindness remains evidence coverage, not a veto',
  state.brainBlind[0].what === 'y' && state.brainCognition === undefined);
assert('FC6 retired stress and phase fields are not manufactured',
  state.brainStress === undefined && state.brainPhase === undefined);

var decision = DECISION.decide(state);
assert('FC7 measured dysregulation requests review', decision.posture === 'escalate');
assert('FC8 adequate measured confidence opens only the human gate',
  decision.boundedAction === 'open-human-gate');
assert('FC9 the finding, not the business lead, is the review choice',
  /LOW_SIDE_FAILURE/.test(decision.choice) && !/business lead/i.test(decision.choice));
assert('FC10 negative departure has magnitude without losing direction',
  /-1\.50/.test(decision.situation));

var poisonedLegacy = DECISION.decide({
  brainDomainId: 'energy',
  brainStress: 1,
  brainPhase: 'p9',
  brainCognition: {
    immune: { immuneState: 'alert' },
    conscience: { conscienceState: 'restrictive' }
  },
  brainV2Ready: false
});
assert('FC11 retired high stress cannot manufacture escalation',
  poisonedLegacy.posture === 'monitor');
assert('FC12 retired immune and conscience cannot manufacture a veto',
  poisonedLegacy.vetoed === false && poisonedLegacy.cautioned === false);

var clean = SIGNALS.adaptCycle({ id: 'energy' }, measured({
  departure: 0.25,
  detected: false,
  findings: []
}), []);
clean.brainCognition = { conscience: { conscienceState: 'restrictive' } };
var cleanDecision = DECISION.decide(clean);
assert('FC13 retired restrictive cognition cannot override a measured clean state',
  cleanDecision.posture === 'hold');

var lowConfidence = SIGNALS.adaptCycle({ id: 'energy' }, measured({
  departure: 1.4,
  confidence: 0.2,
  detected: true
}), []);
var lowDecision = DECISION.decide(lowConfidence);
assert('FC14 low confidence retains concern but stops at recommendation',
  lowDecision.posture === 'escalate' &&
  lowDecision.boundedAction === 'recommend' &&
  lowDecision.cautioned === true);

var opportunityOnly = SIGNALS.adaptCycle({ id: 'energy' }, measured({
  departure: 0.1,
  detected: false
}), [{ title: 'Own-nothing service', rank: 5 }]);
var opportunityDecision = DECISION.decide(opportunityOnly);
assert('FC15 an opportunity remains a recommendation',
  opportunityDecision.posture === 'act' &&
  opportunityDecision.boundedAction === 'recommend');
assert('FC16 an opportunity is not described as a finding',
  opportunityDecision.choice === 'Own-nothing service' &&
  !/finding|dysregulation/i.test(opportunityDecision.rationale.join(' ')));

var noMeasurement = SIGNALS.adaptCycle(
  { id: 'energy' },
  null,
  [{ title: 'Unmeasured lead', rank: 10 }]
);
assert('FC17 opportunity volume cannot stand in for a measured brain state',
  DECISION.decide(noMeasurement).posture === 'monitor');

var fleetStates = { energy: state };
var run = FLEET.runFleet(fleetStates, '2026-08-18T00:00:00Z');
assert('FC18 all twenty named operators still run', run.operators.length === 20);
var energy = run.operators.filter(function (operator) {
  return operator.domain === 'energy';
})[0];
assert('FC19 measured brain-v2 state is the live-signal criterion',
  energy.hasLiveSignal === true);
assert('FC20 signed low-side departure produces positive salience',
  energy.salience > 0);
assert('FC21 system synthesis reports signal magnitude, not stress',
  typeof run.system.systemSignal === 'number' &&
  run.system.systemStress === undefined);

var legacyRun = FLEET.runFleet({
  energy: { brainDomainId: 'energy', brainStress: 1, brainV2Ready: false }
}, '2026-08-18T00:00:00Z');
var legacyEnergy = legacyRun.operators.filter(function (operator) {
  return operator.domain === 'energy';
})[0];
assert('FC22 legacy stress cannot mark an operator live',
  legacyEnergy.hasLiveSignal === false && legacyEnergy.salience === 0);

(async function () {
  var keys = [];
  var loaded = await SIGNALS.loadStates({
    readCycle: async function (key) {
      keys.push(key);
      return key === 'energy' ? report : null;
    },
    getSnapshot: async function () {
      return {
        generatedAt: 333,
        opportunities: [{ domain: 'energy', title: 'Lead', rank: 2 }]
      };
    }
  });

  assert('FC23 loader returns all twenty operator states',
    Object.keys(loaded.states).length === 20);
  assert('FC24 loader reports one measured ready state honestly',
    loaded.meta.readyCount === 1 && loaded.states.energy.brainV2Ready === true);
  assert('FC25 aliases resolve through registry snapshot identities',
    keys.indexOf('health') >= 0 &&
    keys.indexOf('research') >= 0 &&
    keys.indexOf('supplyChain') >= 0);
  assert('FC26 loader metadata declares brain-v2 authority',
    loaded.meta.authority === 'brain-v2');

  var isolated = await SIGNALS.loadStates({
    readCycle: async function (key) {
      if (key === 'energy') throw new Error('energy read failed');
      return null;
    },
    getSnapshot: async function () { return null; }
  });
  assert('FC27 one domain read failure does not erase the other nineteen',
    Object.keys(isolated.states).length === 20 && isolated.meta.errors.length === 1);
  assert('FC28 failed domain remains explicit and unmeasured',
    isolated.states.energy.brainV2Ready === false);

  var root = path.join(__dirname, '..', '..');
  function source(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var signalSource = source('lib/fleet-signals.js');
  var decisionSource = source('lib/fleet-decision.js');
  var fleetHandler = source('handlers/fleet.js');
  var control = source('assets/js/control.js');

  assert('FC29 production adapter reads confined brain-v2 cycles',
    /STORE\.readCycle/.test(signalSource) &&
    /READOUT\.publicReport/.test(signalSource));
  assert('FC30 production adapter no longer reads legacy cognition or console snapshot',
    !/brain:cognition|console_snapshot|domain-snapshot/.test(signalSource));
  assert('FC31 decision code does not consume retired telemetry',
    !/brainStress|brainPhase|brainCognition|immuneState|conscienceState/.test(decisionSource));
  assert('FC32 fleet API declares its authority',
    /authority: 'brain-v2'/.test(fleetHandler));
  assert('FC33 operator board renders fused departure rather than relabelling it stress',
    /mean \|fused departure\|/.test(control) &&
    !/system stress/.test(control));

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  if (failures) process.exit(1);
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exit(1);
});
