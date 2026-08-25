'use strict';

const assert = require('node:assert/strict');
const Intake = require('../lib/research-evaluation-intake.js');
const Observer = require('../lib/research-evaluation-observer.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values.has(key)) return false; this.values.set(key, value); return true; };
Store.prototype.get = async function (key) { return this.values.get(key) || null; };
Store.prototype.lpush = async function (key, value) { const list = this.lists.get(key) || []; list.unshift(value); this.lists.set(key, list); return true; };
Store.prototype.ltrim = async function (key, start, stop) { this.lists.set(key, (this.lists.get(key) || []).slice(start, stop + 1)); return true; };

const input = {
  publication: {
    ownerDomain: 'science', outputId: 'eo_science_1', actionId: 'act_science_1', observationId: 'eval_obs_1', publicationId: 'doi:10.1/original',
    observedAt: '2026-08-25T00:00:00Z', publishedAt: '2026-08-20T00:00:00Z',
    sourceIdentity: { kind: 'external-publication', value: 'doi:10.1/original', publisher: 'Original Journal', url: 'https://original.test', retrievedAt: '2026-08-25T00:00:00Z', contentHash: 'sha256:original' }
  },
  evaluation: {
    progress: 'NO_CHANGE',
    sourceIdentity: { kind: 'external-evaluator', value: 'evaluator:independent-panel-1', retrievedAt: '2026-08-25T00:30:00Z' },
    evidenceRecords: [
      { id: 'replication-1', sourceIdentity: { kind: 'external-study', value: 'doi:10.2/replication' }, retrievedAt: '2026-08-25T01:00:00Z', claim: 'Independent replication did not materially change the result.' },
      { id: 'dataset-1', sourceIdentity: { kind: 'external-dataset', value: 'dataset:independent-1' }, retrievedAt: '2026-08-25T01:01:00Z', claim: 'Independent data review found no directional change.' }
    ],
    independenceAssessment: { status: 'ESTABLISHED', method: 'identity-separation', basis: 'Two source identities differ from the publication and each other.' },
    mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true },
    contradictions: [], retractions: []
  }
};

(async function () {
  const store = new Store();
  const first = await Intake.persist(store, input, 1000);
  assert.equal(first.ok, true);
  assert.equal(first.admitted, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.record.event.eventType, 'OUTCOME_RESEARCH_EVALUATED');
  assert.equal(store.lists.get(Intake.LOG_KEY).length, 1);

  const duplicate = await Intake.persist(store, input, 2000);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(store.lists.get(Intake.LOG_KEY).length, 1);

  const inspected = await Observer.inspect(store, store.lists.get(Intake.LOG_KEY));
  assert.equal(inspected.length, 1);
  assert.equal(inspected[0].status, 'ELIGIBLE');
  assert.equal(inspected[0].event.ownerDomain, 'science');

  const bad = JSON.parse(JSON.stringify(input));
  bad.evaluation.evidenceRecords = bad.evaluation.evidenceRecords.slice(0, 1);
  const refused = await Intake.persist(store, bad, 3000);
  assert.equal(refused.ok, false);
  assert(refused.blockers.includes('at_least_two_independent_evidence_records_required'));

  const nonDurable = await Intake.persist({}, input, 4000);
  assert.equal(nonDurable.ok, false);
  assert.equal(nonDurable.error, 'evaluation-input-not-durable');
  console.log('research evaluation intake: durable admission, idempotency, source separation, and observer readback passed');
})().catch(function (error) { console.error(error); process.exit(1); });
