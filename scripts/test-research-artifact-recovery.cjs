'use strict';

var assert = require('node:assert/strict');
var Recovery = require('../lib/research-artifact-recovery.js');

function Store(seed) {
  this.values = new Map(Object.entries(seed || {}));
  this.lists = new Map();
  this.sets = [];
}
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? this.values.get(key) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); this.sets.push(key); return true; };
Store.prototype.setIfAbsent = async function (key, value) {
  if (this.values.has(key)) return false;
  this.values.set(key, JSON.parse(JSON.stringify(value)));
  return true;
};
Store.prototype.lpush = async function (key, value) {
  var list = this.lists.get(key) || [];
  list.unshift(JSON.parse(JSON.stringify(value)));
  this.lists.set(key, list);
  return list.length;
};
Store.prototype.ltrim = async function (key, start, stop) {
  this.lists.set(key, (this.lists.get(key) || []).slice(start, stop + 1));
  return true;
};

function event(overrides) {
  var base = {
    schemaVersion: 'autofire-outcome-observation/1.0',
    eventType: 'OUTCOME_RESEARCH_EVALUATED',
    lane: 'research',
    ownerDomain: 'science',
    outputId: 'eo_research_000001_deadbeef',
    actionId: 'act_abc123',
    observationId: 'eval_science_retraction_1',
    observedAt: '2026-08-25T12:00:00.000Z',
    sourceIdentity: { kind: 'external-evaluator', value: 'panel:independent-1' },
    outcomeData: {
      progress: 'REGRESSION',
      evidenceIds: ['publisher-notice-1', 'replication-1'],
      independenceAssessment: { status: 'ESTABLISHED', method: 'separate organizations', basis: 'distinct identities' },
      mappingCoverage: {
        neurologyToBusiness: true,
        businessToNeurology: true,
        kernelDynamics: true,
        p0p10ProofEffects: true
      },
      contradictions: [],
      retractions: [{
        retractionId: 'ret_notice_1',
        evidenceId: 'publisher-notice-1',
        publicationId: 'doi:10.1/original',
        retractedAt: '2026-08-25T10:00:00.000Z',
        reason: 'publisher formally retracted the underlying publication',
        sourceIdentity: {
          kind: 'publisher-retraction',
          value: 'doi:10.1/original#retraction',
          publisher: 'Independent Journal',
          url: 'https://journal.example/retraction/1',
          contentHash: 'sha256:retraction-notice-1',
          retrievedAt: '2026-08-25T11:00:00.000Z'
        }
      }]
    }
  };
  return Object.assign(base, overrides || {});
}

function recoveryContext() {
  return {
    evaluatorIdentity: { kind: 'external-evaluator', value: 'panel:independent-1' },
    evidenceRecords: [
      {
        id: 'publisher-notice-1',
        sourceIdentity: { kind: 'publisher-retraction', value: 'doi:10.1/original#retraction' },
        retrievedAt: '2026-08-25T11:00:00.000Z'
      },
      {
        id: 'replication-1',
        sourceIdentity: { kind: 'external-study', value: 'doi:10.2/replication' },
        retrievedAt: '2026-08-25T11:05:00.000Z'
      }
    ]
  };
}

function artifact(overrides) {
  var base = {
    outputId: 'eo_research_000001_deadbeef',
    version: 'eo-v1',
    lane: 'research',
    status: 'READY_TO_SIGN',
    contentHash: 'artifact-content-hash',
    payload: { autofire: {
      ownerDomain: 'research',
      productDomain: 'science',
      productMotorReceiptId: 'pdmr_science_original',
      efferenceCopyId: 'efx_abc123',
      actionId: 'act_abc123'
    } },
    history: [{ at: 1, status: 'READY_TO_SIGN', actor: 'autofire-worker' }]
  };
  return Object.assign(base, overrides || {});
}

function efference(overrides) {
  return Object.assign({
    schemaVersion: 1,
    id: 'efx_abc123',
    actionId: 'act_abc123',
    actionKind: 'generate_research_artifact',
    lane: 'research',
    status: 'EXECUTED',
    receipt: { applied: true, outputId: 'eo_research_000001_deadbeef' }
  }, overrides || {});
}

function seeded(overrides) {
  var seed = {
    'engine_output:eo_research_000001_deadbeef': artifact(),
    'autofire_efference:efx_abc123': efference()
  };
  return new Store(Object.assign(seed, overrides || {}));
}

async function authorize(store, productDomain, lane) {
  assert.equal(productDomain, 'science');
  assert.equal(lane, 'research-papers');
  return { authorized: true, receiptId: 'pdmr_science_current', ownerDomain: 'research', lane: lane };
}

(async function () {
  var noRetraction = event({ outcomeData: Object.assign({}, event().outcomeData, { retractions: [] }) });
  var untouched = seeded();
  var abstained = await Recovery.recover(untouched, noRetraction, Date.parse(noRetraction.observedAt), authorize);
  assert.equal(abstained.status, 'ABSTAINED');
  assert.equal(abstained.applied, false);
  assert.equal(untouched.sets.length, 0);

  var stringRetraction = event({ outcomeData: Object.assign({}, event().outcomeData, { retractions: ['retracted'] }) });
  var malformed = await Recovery.recover(seeded(), stringRetraction, Date.parse(stringRetraction.observedAt), authorize, recoveryContext());
  assert.equal(malformed.status, 'ABSTAINED');
  assert.equal(malformed.reason, 'explicit-retraction-evidence-invalid');

  var heldCalls = 0;
  var heldStore = seeded();
  var held = await Recovery.recover(heldStore, event(), Date.parse(event().observedAt), async function () {
    heldCalls++;
    return { authorized: false, reason: 'external-dispatch-gate-closed' };
  }, recoveryContext());
  assert.equal(held.status, 'HELD');
  assert.equal(held.applied, false);
  assert.equal(heldCalls, 1);
  assert.equal(heldStore.values.has(Recovery.commandKey(event().observationId)), false);

  var wrongOwnerStore = seeded({
    'engine_output:eo_research_000001_deadbeef': artifact({ payload: { autofire: {
      ownerDomain: 'health', productDomain: 'medicine', productMotorReceiptId: 'pdmr_medicine',
      efferenceCopyId: 'efx_abc123', actionId: 'act_abc123'
    } } })
  });
  var refused = await Recovery.recover(wrongOwnerStore, event(), Date.parse(event().observedAt), authorize, recoveryContext());
  assert.equal(refused.status, 'REFUSED');
  assert.equal(refused.reason, 'artifact-domain-identity-mismatch');
  assert.equal(wrongOwnerStore.values.has(Recovery.commandKey(event().observationId)), false);

  var store = seeded();
  var result = await Recovery.recover(store, event(), Date.parse(event().observedAt), authorize, recoveryContext());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'WITHDRAWN');
  assert.equal(result.applied, true);
  assert.equal(result.readbackVerified, true);
  assert.equal(result.ownerDomain, 'research');
  assert.equal(result.productDomain, 'science');
  var withdrawn = await store.get('engine_output:' + event().outputId);
  assert.equal(withdrawn.status, 'WITHDRAWN');
  assert.equal(withdrawn.contentHash, 'artifact-content-hash');
  assert.equal(withdrawn.history.length, 2);
  assert.equal(withdrawn.history[1].recoveryId, result.recoveryId);
  var receipt = await store.get(Recovery.commandKey(event().observationId));
  assert.equal(receipt.status, 'WITHDRAWN');
  assert.equal(receipt.receipt.readbackVerified, true);
  assert.equal(receipt.receipt.contentHashUnchanged, true);
  assert.equal(store.lists.get(Recovery.LOG_KEY).length, 1);
  assert.equal(store.lists.get(Recovery.ENGINE_LOG_KEY).length, 1);

  var duplicate = await Recovery.recover(store, event(), Date.parse(event().observedAt) + 1000, authorize, recoveryContext());
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await store.get('engine_output:' + event().outputId)).history.length, 2);

  var interruptedCommand = JSON.parse(JSON.stringify(receipt));
  interruptedCommand.status = 'COMMANDED';
  interruptedCommand.resolvedAt = null;
  interruptedCommand.receipt = null;
  interruptedCommand.commandedAt = Date.parse(event().observedAt);
  var restarted = seeded({
    'engine_output:eo_research_000001_deadbeef': withdrawn,
    'research_artifact_recovery:eval_science_retraction_1': interruptedCommand
  });
  var resumed = await Recovery.recover(
    restarted, event(), Date.parse(event().observedAt) + Recovery.COMMAND_TIMEOUT_MS + 1,
    authorize, recoveryContext());
  assert.equal(resumed.status, 'WITHDRAWN');
  assert.equal((await restarted.get('engine_output:' + event().outputId)).history.length, 2);
  assert.equal((await restarted.get(Recovery.commandKey(event().observationId))).receipt.fromStatus, 'READY_TO_SIGN');

  var wrongAction = event({ actionId: 'act_other' });
  var wrongActionResult = await Recovery.recover(seeded(), wrongAction, Date.parse(wrongAction.observedAt), authorize, recoveryContext());
  assert.equal(wrongActionResult.status, 'REFUSED');
  assert.equal(wrongActionResult.reason, 'action-causal-record-missing');

  var lateStore = seeded();
  lateStore.values.delete('autofire_efference:efx_abc123');
  lateStore.values.set('autofire_learning_cause:act_abc123', {
    selectionId: 'sel_research_1', actionId: 'act_abc123', efferenceCopyId: 'efx_abc123',
    episodeId: 'ep_research_1', lane: 'research', domain: 'research', cik: '000001', emittedAt: 1
  });
  var late = await Recovery.recover(lateStore, event(), Date.parse(event().observedAt), authorize, recoveryContext());
  assert.equal(late.status, 'WITHDRAWN');
  assert.equal((await lateStore.get(Recovery.commandKey(event().observationId))).causalRecordKind, 'permanent-action-link');

  var unlinked = recoveryContext();
  unlinked.evidenceRecords[0].sourceIdentity.value = 'different:notice';
  var unlinkedResult = await Recovery.recover(seeded(), event(), Date.parse(event().observedAt), authorize, unlinked);
  assert.equal(unlinkedResult.status, 'ABSTAINED');
  assert.equal(unlinkedResult.reason, 'explicit-retraction-evidence-invalid');

  console.log('research artifact recovery: explicit retraction, owner/action binding, authorization, durable command, readback, and idempotency passed');
})().catch(function (error) { console.error(error); process.exit(1); });
