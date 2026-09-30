'use strict';

var assert = require('node:assert/strict');
var Verifier = require('../lib/product-domain-research-capability-verifier.js');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Intake = require('../lib/research-evaluation-intake.js');
var Learning = require('../lib/autofire-learning.js');

function Store(seed) {
  this.values = new Map(Object.entries(seed || {}));
  this.lists = new Map();
  this.writes = [];
}
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? this.values.get(key) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); this.writes.push(key); return true; };
Store.prototype.lrange = async function (key, start, stop) { return (this.lists.get(key) || []).slice(start, stop + 1); };
Store.prototype.lpush = async function (key, value) { var row = this.lists.get(key) || []; row.unshift(JSON.parse(JSON.stringify(value))); this.lists.set(key, row); return row.length; };
Store.prototype.ltrim = async function () { return true; };

var DOMAINS = [
  ['science', 'research'], ['medicine', 'health'], ['education', 'education'], ['environment', 'environment']
];
function motor(domain, owner, now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: 'pdmr_' + domain + '_current', productDomain: domain, ownerDomain: owner,
    contractId: domain + '-motor/1', lane: 'research-papers', contracts: {
      decision: 'research-artifact-decision/1', budget: domain + '-research-budget/1', receipt: 'artifact-receipt',
      independentOutcome: 'citation-use-or-falsification', rollback: 'withdraw-or-correct'
    }, measuredAt: now, status: 'HELD' };
}
function fixture(domain, owner, now) {
  var m = motor(domain, owner, now), actionId = 'act_' + domain + '_1', efx = 'efx_' + domain + '_1', outputId = 'eo_' + domain + '_1', observationId = 'eval_' + domain + '_1', eventId = 'evt_' + domain + '_1', recoveryId = 'rar_' + domain + '_1';
  var event = { schemaVersion: 'autofire-outcome-observation/1.0', eventType: 'OUTCOME_RESEARCH_EVALUATED', lane: 'research', ownerDomain: domain,
    outputId: outputId, actionId: actionId, observationId: observationId, eventId: eventId, observedAt: new Date(1050).toISOString(),
    sourceIdentity: { kind: 'external-evaluator', value: 'panel:' + domain }, outcomeData: {
      evidenceIds: ['evidence-' + domain + '-a', 'evidence-' + domain + '-b'], progress: 'PROGRESS',
      independenceAssessment: { status: 'ESTABLISHED', method: 'separate organizations', basis: 'distinct identities' },
      mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true }
    } };
  var record = { schemaVersion: Intake.SCHEMA, intakeId: 'rei_' + domain, status: 'ADMITTED', ownerDomain: owner, outputId: outputId, actionId: actionId, observationId: observationId, event: event,
    admissionEvidence: { publicationIdentity: { kind: 'publisher', value: 'journal:' + domain }, evaluatorIdentity: event.sourceIdentity, evidenceRecords: [
      { id: 'evidence-' + domain + '-a', sourceIdentity: { kind: 'study', value: domain + ':a' }, retrievedAt: new Date(900).toISOString() },
      { id: 'evidence-' + domain + '-b', sourceIdentity: { kind: 'dataset', value: domain + ':b' }, retrievedAt: new Date(920).toISOString() }
    ] }, admittedAt: 950 };
  var learning = Learning._fresh(owner, 'research'); learning.processedOutcomeIds = [eventId];
  var store = new Store({
    [Motor.receiptKey(domain)]: m,
    [Intake.key(observationId)]: record,
    ['autofire_learning_state:' + owner]: learning,
    ['autofire_efference:' + efx]: { schemaVersion: 1, id: efx, actionId: actionId, actionKind: 'generate_research_artifact', lane: 'research', status: 'EXECUTED', emittedAt: 1000, receipt: { applied: true, outputId: outputId } },
    ['engine_output:' + outputId]: { outputId: outputId, lane: 'research', status: 'WITHDRAWN', contentHash: 'hash-' + domain, payload: { autofire: { productDomain: domain, ownerDomain: owner, productMotorReceiptId: m.receiptId, efferenceCopyId: efx, actionId: actionId } } },
    ['research_artifact_recovery:' + observationId]: { schemaVersion: 'research-artifact-recovery/1.0', recoveryId: recoveryId, status: 'WITHDRAWN', productDomain: domain, ownerDomain: owner, lane: 'research-papers', outputId: outputId, actionId: actionId, observationId: observationId, resolvedAt: 1100, receipt: { readbackVerified: true, contentHashUnchanged: true } }
  });
  store.lists.set('autofire_efference_log', [{ type: 'REAFFERENCE', efferenceCopyId: efx }]);
  store.lists.set(Intake.LOG_KEY, [{ intakeId: record.intakeId, observationId: observationId, ownerDomain: owner }]);
  store.lists.set('research_artifact_recovery_log', [{ recoveryId: recoveryId, status: 'WITHDRAWN', productDomain: domain, ownerDomain: owner, lane: 'research-papers', outputId: outputId, actionId: actionId, observationId: observationId }]);
  return store;
}

(async function () {
  for (var i = 0; i < DOMAINS.length; i++) {
    var domain = DOMAINS[i][0], owner = DOMAINS[i][1], now = 5000;
    var held = new Store({ [Motor.receiptKey(domain)]: motor(domain, owner, now) });
    var heldResult = await Verifier.verifyAndPersist(held, domain, now);
    assert.equal(heldResult.status, 'HELD', domain);
    assert.deepEqual(held.writes, [], domain);

    var store = fixture(domain, owner, now);
    var result = await Verifier.verifyAndPersist(store, domain, now);
    assert.equal(result.status, 'VERIFIED', domain);
    assert.deepEqual(store.writes, [Cap.capabilityKey(domain, Cap.EXECUTOR), Cap.capabilityKey(domain, Cap.OBSERVER)], domain);
    assert.equal((await Cap.verifyPair(store, await store.get(Motor.receiptKey(domain)), now)).ok, true, domain);
  }
  console.log('Research capability promotion: Science, Medicine, Education and Environment remain held without the complete artifact/evaluation/withdrawal chain and verify only historical readback evidence');
}()).catch(function (error) { console.error(error); process.exitCode = 1; });
