'use strict';

/** Durable intake for separately supplied Science/Medicine evaluations. */

var crypto = require('node:crypto');
var Adapter = require('./research-evaluation-input-adapter.js');

var SCHEMA = 'research-evaluation-intake/1.0';
var LOG_KEY = 'research_evaluation_input_log';
var LOG_CAP = 1000;
var TTL_SECONDS = 365 * 86400;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function key(observationId) { return 'research_evaluation_input:' + String(observationId); }

async function persist(store, input, now) {
  try {
    if (!store || typeof store.assertDurable !== 'function') throw new Error('strict-store-required');
    store.assertDurable();
    var built = Adapter.build(input);
    if (built.status !== 'EVALUATED' || !built.event) {
      return { ok: false, admitted: false, error: 'evaluation-input-refused', blockers: built.blockers || [] };
    }
    var event = built.event;
    var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    var record = {
      schemaVersion: SCHEMA,
      intakeId: 'rei_' + hash({ ownerDomain: event.ownerDomain, observationId: event.observationId }).slice(0, 24),
      status: 'ADMITTED',
      ownerDomain: event.ownerDomain,
      outputId: event.outputId,
      actionId: event.actionId,
      observationId: event.observationId,
      event: event,
      admissionEvidence: {
        publicationIdentity: input.publication.sourceIdentity,
        evaluatorIdentity: input.evaluation.sourceIdentity,
        evidenceRecords: input.evaluation.evidenceRecords.map(function (record) {
          return { id: record.id, sourceIdentity: record.sourceIdentity, retrievedAt: record.retrievedAt };
        })
      },
      admittedAt: at
    };
    var recordKey = key(event.observationId);
    var inserted = await store.setIfAbsent(recordKey, record, TTL_SECONDS);
    var restored = await store.get(recordKey);
    if (!restored || restored.schemaVersion !== SCHEMA || restored.intakeId !== record.intakeId || restored.status !== 'ADMITTED') {
      throw new Error('evaluation-input-readback-failed');
    }
    if (inserted) {
      await store.lpush(LOG_KEY, { intakeId: record.intakeId, observationId: record.observationId, ownerDomain: record.ownerDomain, admittedAt: record.admittedAt });
      await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
    }
    return { ok: true, admitted: true, duplicate: !inserted, key: recordKey, record: restored };
  } catch (error) {
    return { ok: false, admitted: false, error: 'evaluation-input-not-durable', detail: String(error && error.message || error) };
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, LOG_CAP: LOG_CAP, TTL_SECONDS: TTL_SECONDS, key: key, persist: persist };
