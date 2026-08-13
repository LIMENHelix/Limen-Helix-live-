/**
 * brain-v2/test/domain-function.js — installed is not the same claim as functioning.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var DF = require('../core/domain-function.js');

var tests = 0, failures = 0;
function assert(name, condition, detail) {
  tests++;
  if (condition) console.log('  PASS ' + name);
  else {
    failures++;
    console.error('  FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}
function tick(admitted, rejected, abstained, dysregulated, findings) {
  return {
    steps: [
      { step: 'barrier', admitted: admitted, rejected: rejected },
      { step: 'domain_cycle', abstained: abstained, dysregulated: dysregulated, findings: findings }
    ]
  };
}

console.log('');
console.log('=== DOMAIN FUNCTION EVIDENCE ===');

var s = DF.empty();
assert('DFA1 starts with no tick rather than implying execution',
  s.ticksObserved === 0 && s.missing.join() === 'no_tick_observed');
assert('DFA2 has no score or pathway field',
  s.score === undefined && s.pathway === undefined && /not a pathway count/.test(s.scope));

DF.observe(s, tick(3, 1, false, true, 2));
assert('DFA3 counts admitted and rejected observations separately',
  s.observations.admitted === 3 && s.observations.rejected === 1, JSON.stringify(s.observations));
assert('DFA4 a non-abstained state is an emitted state',
  s.states.emitted === 1 && s.states.abstained === 0, JSON.stringify(s.states));
assert('DFA5 dysregulation and findings are reported, not promoted',
  s.dysregulationsDetected === 1 && s.findingsFired === 2);

DF.observe(s, tick(0, 2, true, false, 0));
assert('DFA6 abstention remains distinct from an emitted state',
  s.states.emitted === 1 && s.states.abstained === 1, JSON.stringify(s.states));
assert('DFA7 counts accumulate over every tick in the cycle',
  s.ticksObserved === 2 && s.observations.rejected === 3);

DF.finalize(s, {
  predictions: { open: 4, resolved: 7 },
  actuation: { executed: 2 },
  outwardConsumersDeclared: 0
});
assert('DFA8 prediction state is copied without re-grading it',
  s.predictions.open === 4 && s.predictions.resolved === 7);
assert('DFA9 internal action is measured separately from outward connection',
  s.internalActionsExecuted === 2 && s.evidence.outwardConnected === false);
assert('DFA10 L3 current evidence is complete only when tick, observation, state and grading all exist',
  s.evidence.l3CurrentEvidenceComplete === true && s.missing.length === 0, JSON.stringify(s));

var abstained = DF.empty();
DF.observe(abstained, tick(4, 0, true, false, 0));
DF.finalize(abstained, { predictions: { resolved: 5 }, actuation: { executed: 1 } });
assert('DFA11 admitted data plus a resolved prediction cannot hide total state abstention',
  abstained.evidence.l3CurrentEvidenceComplete === false &&
  abstained.missing.indexOf('no_non_abstained_state_emitted') >= 0,
  JSON.stringify(abstained.missing));

var rejected = DF.empty();
DF.observe(rejected, tick(0, 6, false, false, 0));
DF.finalize(rejected, { predictions: { resolved: 2 } });
assert('DFA12 a state cannot prove real sensing when every observation was rejected',
  rejected.evidence.realObservationAdmitted === false &&
  rejected.missing.indexOf('no_real_observation_admitted') >= 0);

var ungraded = DF.empty();
DF.observe(ungraded, tick(1, 0, false, false, 0));
DF.finalize(ungraded, { predictions: { open: 3, resolved: 0 } });
assert('DFA13 an open prediction is not a graded prediction',
  ungraded.evidence.predictionGraded === false &&
  ungraded.missing.indexOf('no_resolved_prediction_in_restored_loop') >= 0);

var outward = DF.empty();
DF.observe(outward, tick(1, 0, false, false, 0));
DF.finalize(outward, { predictions: { resolved: 1 }, outwardConsumersDeclared: 2 });
assert('DFA14 outward connection is binary evidence and does not alter the L3 ingredients',
  outward.evidence.outwardConnected === true &&
  outward.outwardConsumersDeclared === 2 &&
  outward.evidence.l3CurrentEvidenceComplete === true);

var malformed = DF.empty();
DF.observe(malformed, tick(-1, NaN, false, false, -3));
DF.finalize(malformed, { predictions: { open: Infinity, resolved: -1 }, actuation: { executed: NaN } });
assert('DFA15 malformed counters cannot manufacture positive evidence',
  malformed.observations.admitted === 0 && malformed.observations.rejected === 0 &&
  malformed.findingsFired === 0 && malformed.predictions.resolved === 0);

var noDomainStep = DF.empty();
DF.observe(noDomainStep, { steps: [{ step: 'barrier', admitted: 1, rejected: 0 }] });
DF.finalize(noDomainStep, { predictions: { resolved: 1 } });
assert('DFA16 a halted tick without domain_cycle does not claim a state',
  noDomainStep.states.emitted === 0 &&
  noDomainStep.missing.indexOf('no_non_abstained_state_emitted') >= 0);

var threw = false;
try { DF.observe({}, tick(1, 0, false, false, 0)); } catch (e) { threw = /summary created by empty/.test(e.message); }
assert('DFA17 callers cannot pass an arbitrary object as the accumulator', threw);

var root = path.join(__dirname, '..', '..');
var runtime = fs.readFileSync(path.join(root, 'lib', 'brain-shadow-runtime.js'), 'utf8');
var handler = fs.readFileSync(path.join(root, 'handlers', 'brain-shadow.js'), 'utf8');
assert('DFA18 the real runtime observes each LOOP.tick report',
  /DOMAIN_FUNCTION\.observe\(report\.domainFunction, tickReport\)/.test(runtime));
assert('DFA19 the real runtime finalizes with predictions and actuation',
  /DOMAIN_FUNCTION\.finalize\(report\.domainFunction/.test(runtime) &&
  /outwardConsumersDeclared: outwardConsumers/.test(runtime));
assert('DFA20 the operator allow-list exposes the evidence instead of dropping it',
  /domainFunction: cyc\.domainFunction \|\| null/.test(handler));
assert('DFA21 the operator note still refuses to call this pathway activation',
  /Neither activates a relationship/.test(handler));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
if (failures) process.exit(1);
