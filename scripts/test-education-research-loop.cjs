#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Policy = require('../brain-v2/core/outward-action-policy.js');
var Bridge = require('../lib/autofire-domain-bridge.js');
var Learning = require('../lib/autofire-learning.js');
var Efference = require('../lib/autofire-efference.js');

function Store() { this.values = Object.create(null); this.lists = Object.create(null); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values[key] === undefined ? null : JSON.parse(JSON.stringify(this.values[key])); };
Store.prototype.set = async function (key, value) { this.values[key] = JSON.parse(JSON.stringify(value)); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values[key] !== undefined) return false; this.values[key] = JSON.parse(JSON.stringify(value)); return true; };
Store.prototype.del = async function (key) { delete this.values[key]; return 1; };
Store.prototype.lpush = async function (key, value) { (this.lists[key] || (this.lists[key] = [])).unshift(JSON.parse(JSON.stringify(value))); return this.lists[key].length; };
Store.prototype.ltrim = async function (key, start, end) { this.lists[key] = (this.lists[key] || []).slice(start, end + 1); return true; };
Store.prototype.lrange = async function (key, start, end) { return JSON.parse(JSON.stringify((this.lists[key] || []).slice(start, end < 0 ? undefined : end + 1))); };

function cycle() {
  return { domain: 'education', ok: true, startedAt: 100, finishedAt: 110, cursorAfter: 99,
    domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true }, outwardConsumersDeclared: 1 } };
}
function candidate() {
  return { domain: 'education', subjectId: 'education:evidence-synthesis:subject-1',
    source: 'domain-packet-research', sourceArtifactRef: 'education:packet:artifact-1',
    sourcePacketId: 'education:packet-1', sourcePatternSig: 'education:research-window-1',
    topicEvidenceRefs: [{ kind: 'education-feed-item', value: 'education:feed-1' }],
    _estimatedCostUsd: 0.30,
    masterGate: { confidence: 0.82, evidenceQuality: 0.86, uncertainty: 0.18, readiness: 0.82, salience: 0.72, completeness: 1 } };
}
function evaluated(progress) {
  return { progress: progress, evidenceIds: ['education-study-1', 'education-dataset-1'],
    independenceAssessment: { status: 'ESTABLISHED', method: 'ownership-and-syndication-reviewed' },
    mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true,
      kernel_dynamics: true, p0_p10_proof_and_effects: true }, contradictions: [], retractions: [] };
}

(async function () {
  var store = new Store(), now = 1000, item = candidate();
  var first = await Bridge.select(store, { lane: 'research', candidate: item, domainCycle: cycle(), at: now });
  assert.equal(first.ok, true);
  assert.equal(first.receipt.status, 'RELEASED');
  assert.equal(first.receipt.ownerDomain, 'education');
  assert.equal(first.receipt.subjectDomain, 'education');

  var command = await Efference.command(store, { lane: 'research', subjectId: item.subjectId,
    sourceIdentity: first.receipt.candidate.sourceIdentity, emittedAt: now + 1, attempt: 0 });
  assert.equal(command.ok, true);
  var learnedCommand = await Learning.recordCommand(store, { selection: first.receipt, efferenceCopy: command.copy });
  assert.equal(learnedCommand.ok, true);
  var receipt = await Efference.resolve(store, command.copy, { ok: true, skipped: false, outputId: 'education-artifact-1', wordCount: 900 }, now + 2);
  assert.equal(receipt.status, 'EXECUTED');
  var persistedReceipt = await store.get(Efference.recordKey(command.copy.id));
  assert.equal(persistedReceipt.receipt.applied, true);

  var returned = await Learning.recordOutcome(store, { eventId: 'education-evaluation-1',
    eventType: 'OUTCOME_RESEARCH_EVALUATED', lane: 'research', ownerDomain: 'education',
    actionId: command.copy.actionId, ts: now + 100, sourceIdentity: { kind: 'external-evaluator', value: 'panel:education:1' },
    outcomeData: evaluated('REGRESSION') });
  assert.equal(returned.ok, true);
  assert.equal(returned.assessment.graded, true);
  assert.equal(returned.assessment.reward, -1);
  assert.equal(returned.externalLearningSignal.ownerDomain, 'education');
  assert.equal((await Learning._load(store, 'education')).externalLearning.resolvedCount, 1);

  var next = await Bridge.select(store, { lane: 'research', candidate: item, domainCycle: cycle(), at: now + 101 });
  assert.equal(next.ok, true);
  assert.equal(next.receipt.ownerDomain, 'education');
  assert.notEqual(next.receipt.id, first.receipt.id, 'later evaluation must have its own durable decision episode');
  assert.deepEqual(await store.get('autofire_selection:' + first.receipt.id), first.receipt,
    'the earlier command cause remains unchanged after learning and reevaluation');
  assert.equal(next.receipt.criticDecision.ranked.some(function (row) {
    return row.kind === 'generate_research_artifact' && row.historicalN === 1 && row.historicalEffect === -1;
  }), true, 'the next Education selection consumes its own returned research outcome');
  assert.equal((await Learning._load(store, 'education')).outwardGate.outcomeHistory.generate_research_artifact.n, 1);

  assert.equal(next.receipt.policySelectionId, first.receipt.policySelectionId,
    'the original policy candidate identity is retained without changing brain policy');
  var priorCause = await store.get(Learning.causeKey(command.copy.actionId));
  assert.equal(priorCause.selectionId, first.receipt.id);
  var retryStore = new Store();
  retryStore.values['autofire_selection:' + first.receipt.id] = JSON.parse(JSON.stringify(first.receipt));
  var replay = await Bridge.select(retryStore, { lane: 'research', candidate: item, domainCycle: cycle(), at: now });
  assert.equal(replay.ok, true);
  assert.equal(replay.receipt.id, first.receipt.id, 'an identical decision snapshot retains its episode identity');
  await store.ltrim(Bridge.LOG_KEY, 0, 0);
  assert.deepEqual(await store.get('autofire_selection:' + priorCause.selectionId), first.receipt,
    'index decay does not remove the addressable command decision');
  var broken = new Store();
  broken.setIfAbsent = async function () { return false; };
  var failed = await Bridge.select(broken, { lane: 'research', candidate: item, domainCycle: cycle(), at: now });
  assert.equal(failed.ok, false);
  assert.match(failed.detail, /selection episode readback failed/);
  assert.equal((broken.lists[Bridge.LOG_KEY] || []).length, 0, 'missing keyed decision cannot be advertised in the index');
  var corrupt = new Store();
  corrupt.setIfAbsent = async function (key, value) { this.values[key] = Object.assign({}, value, { ownerDomain: 'finance' }); return false; };
  var conflict = await Bridge.select(corrupt, { lane: 'research', candidate: item, domainCycle: cycle(), at: now });
  assert.equal(conflict.ok, false);
  assert.match(conflict.detail, /selection episode readback failed/);

  console.log('education research loop: sovereign selection -> durable efference/artifact receipt -> independent evaluated outcome -> next Education critic consumes own learning PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
