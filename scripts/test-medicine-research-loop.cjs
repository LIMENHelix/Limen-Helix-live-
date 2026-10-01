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
function cycle() { return { domain: 'health', ok: true, startedAt: 100, finishedAt: 110, cursorAfter: 99, domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true }, outwardConsumersDeclared: 1 } }; }
function candidate() { return { domain: 'medicine', subjectId: 'medicine:evidence-synthesis:subject-1', source: 'domain-packet-research', sourceArtifactRef: 'medicine:packet:artifact-1', sourcePacketId: 'medicine:packet-1', sourcePatternSig: 'medicine:research-window-1', topicEvidenceRefs: [{ kind: 'medicine-feed-item', value: 'medicine:feed-1' }], _estimatedCostUsd: 0.30, masterGate: { confidence: 0.82, evidenceQuality: 0.86, uncertainty: 0.18, readiness: 0.82, salience: 0.72, completeness: 1 } }; }
function evaluated(progress) { return { progress: progress, evidenceIds: ['medicine-study-1', 'medicine-dataset-1'], independenceAssessment: { status: 'ESTABLISHED', method: 'ownership-and-syndication-reviewed' }, mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true }, contradictions: [], retractions: [] }; }
(async function () {
  var store = new Store(), now = 1000, item = candidate();
  assert.equal(Policy.ownerFor('research', 'medicine'), 'health');
  var first = await Bridge.select(store, { lane: 'research', candidate: item, domainCycle: cycle(), at: now });
  assert.equal(first.ok, true); assert.equal(first.receipt.status, 'RELEASED'); assert.equal(first.receipt.ownerDomain, 'health'); assert.equal(first.receipt.subjectDomain, 'health');
  var command = await Efference.command(store, { lane: 'research', subjectId: item.subjectId, sourceIdentity: first.receipt.candidate.sourceIdentity, emittedAt: now + 1, attempt: 0 });
  assert.equal(command.ok, true); assert.equal((await Learning.recordCommand(store, { selection: first.receipt, efferenceCopy: command.copy })).ok, true);
  var receipt = await Efference.resolve(store, command.copy, { ok: true, skipped: false, outputId: 'medicine-artifact-1', wordCount: 900 }, now + 2);
  assert.equal(receipt.status, 'EXECUTED'); assert.equal((await store.get(Efference.recordKey(command.copy.id))).receipt.applied, true);
  var returned = await Learning.recordOutcome(store, { eventId: 'medicine-evaluation-1', eventType: 'OUTCOME_RESEARCH_EVALUATED', lane: 'research', ownerDomain: 'health', actionId: command.copy.actionId, ts: now + 100, sourceIdentity: { kind: 'external-evaluator', value: 'panel:medicine:1' }, outcomeData: evaluated('REGRESSION') });
  assert.equal(returned.ok, true); assert.equal(returned.assessment.reward, -1); assert.equal(returned.externalLearningSignal.ownerDomain, 'health'); assert.equal((await Learning._load(store, 'health')).externalLearning.resolvedCount, 1);
  var next = await Bridge.select(store, { lane: 'research', candidate: item, domainCycle: cycle(), at: now + 101 });
  assert.equal(next.ok, true); assert.equal(next.receipt.ownerDomain, 'health'); assert.equal(next.receipt.criticDecision.ranked.some(function (row) { return row.kind === 'generate_research_artifact' && row.historicalN === 1 && row.historicalEffect === -1; }), true);
  assert.equal((await store.get(Learning.stateKey('medicine'))), null); assert.equal((await Learning._load(store, 'health')).outwardGate.outcomeHistory.generate_research_artifact.n, 1);
  await require('./assert-research-business-trace.cjs')(store, 'medicine', 'health', command.copy, now + 200);
  console.log('medicine product brain -> existing health runtime owner: research selection, durable artifact receipt, independent evaluated outcome, owner-scoped next critic PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
