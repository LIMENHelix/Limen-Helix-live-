'use strict';

var Intake = require('./research-evaluation-intake.js');
var Outcome = require('./autofire-outcome-contract.js');

function inspect(store, entries) {
  return Promise.all((Array.isArray(entries) ? entries : []).map(async function (entry) {
    var observationId = entry && entry.observationId;
    if (!observationId) return { status: 'ABSTAINED', reason: 'log-entry-observation-id-missing' };
    var record = await store.get(Intake.key(observationId));
    if (!record || record.schemaVersion !== Intake.SCHEMA || record.status !== 'ADMITTED' || !record.event) {
      return { status: 'ABSTAINED', observationId: observationId, reason: 'admitted-evaluation-readback-missing' };
    }
    var event = record.event;
    var admission = record.admissionEvidence || {};
    var evidence = Array.isArray(admission.evidenceRecords) ? admission.evidenceRecords : [];
    var identityKey = function (value) { return value && value.kind && value.value ? String(value.kind).toLowerCase() + ':' + String(value.value).toLowerCase() : null; };
    var publicationKey = identityKey(admission.publicationIdentity);
    var evaluatorKey = identityKey(admission.evaluatorIdentity);
    var evidenceKeys = evidence.map(function (row) { return identityKey(row.sourceIdentity); });
    var evidenceIds = evidence.map(function (row) { return row.id; });
    if (!publicationKey || !evaluatorKey || evaluatorKey === publicationKey || evidence.length < 2 ||
        evidenceKeys.some(function (key) { return !key || key === publicationKey || key === evaluatorKey; }) ||
        new Set(evidenceKeys).size !== evidenceKeys.length ||
        !event.outcomeData || JSON.stringify(event.outcomeData.evidenceIds || []) !== JSON.stringify(evidenceIds)) {
      return { status: 'ABSTAINED', observationId: observationId, reason: 'evaluation-source-separation-readback-invalid' };
    }
    if (event.schemaVersion !== Outcome.SCHEMA_VERSION || event.eventType !== 'OUTCOME_RESEARCH_EVALUATED' ||
        event.observationId !== observationId || identityKey(event.sourceIdentity) !== evaluatorKey ||
        (event.ownerDomain !== 'science' && event.ownerDomain !== 'medicine')) {
      return { status: 'ABSTAINED', observationId: observationId, reason: 'evaluation-event-contract-invalid' };
    }
    return {
      status: 'ELIGIBLE', observationId: observationId, intakeId: record.intakeId, event: event,
      recoveryContext: { evaluatorIdentity: admission.evaluatorIdentity, evidenceRecords: evidence }
    };
  }));
}

module.exports = { inspect: inspect };
