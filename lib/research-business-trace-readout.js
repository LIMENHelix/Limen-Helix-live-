'use strict';

// Existing owner-scoped artifact contracts; no dispatch, learning or writes.
var Bridge = require('./autofire-domain-bridge.js');
var Learning = require('./autofire-learning.js');
var Efference = require('./autofire-efference.js');
var EvaluationObserver = require('./research-evaluation-observer.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var ProductContracts = require('./domain-commercial-contracts.js');
function supportsOrigin(origin) { return !!ProductContracts.get(origin); }
var owners = { science: 'research', research: 'research', medicine: 'health', health: 'health', education: 'education', environment: 'environment' };
function text(v) { return typeof v === 'string' && v.trim().length > 0; }
function time(v, now) { return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= now; }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function validRouting(row, owner) {
  var routing = row && row.routing;
  if (!routing) return true; // Older receipts have no explicit origin metadata.
  return routing.observationOnly === true && routing.ownerDomain === owner &&
    supportsOrigin(routing.originDomain) &&
    routing.sourcePacketId === row.candidate.sourcePacketId &&
    routing.sourceArtifactRef === row.candidate.sourceArtifactRef &&
    same(routing.sourceIdentity, row.candidate.sourceIdentity);
}
function decision(row, owner, now) {
  return row && row.schemaVersion === 1 && text(row.id) && row.ownerDomain === owner && row.lane === 'research' &&
    ['RELEASED', 'HELD'].indexOf(row.status) >= 0 && time(row.at, now) && row.candidate &&
    row.authority && row.authority.artifactGenerationOnly === true && row.authority.liveTradingAuthorized === false && validRouting(row, owner);
}
async function read(store, product, now) {
  now = now == null ? Date.now() : now;
  var owner = owners[product];
  var out = { schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: owner, lane: 'research',
    readAt: now, observationOnly: true, externalActionAuthorized: false, status: 'UNOBSERVED',
    reason: 'owner-artifact-records-not-observed', decision: null, command: null };
  try {
    store.assertDurable();
    if (!owner) throw new Error('unsupported-artifact-owner');
    var inputs = await Promise.all([store.lrange(Bridge.LOG_KEY, 0, 999), store.get(Learning.stateKey(owner))]);
    if (!Array.isArray(inputs[0])) throw new Error('artifact-decision-index-invalid');
    var indexes = inputs[0].filter(function (row) { return row && row.ownerDomain === owner && row.lane === 'research'; }).slice(0, 20);
    var decisions = [];
    for (var i = 0; i < indexes.length; i++) {
      if (!text(indexes[i].id)) throw new Error('artifact-decision-index-invalid');
      var d = await store.get('autofire_selection:' + indexes[i].id);
      if (!decision(d, owner, now) || d.id !== indexes[i].id || !same(d, indexes[i])) throw new Error('artifact-decision-readback-invalid');
      decisions.push(d);
    }
    var state = inputs[1], commands = [];
    if (state && (state.stateVersion !== 1 || state.domain !== owner || state.lane !== 'research' || !Array.isArray(state.commands))) throw new Error('artifact-owner-state-invalid');
    var rows = state ? state.commands.slice(-20) : [];
    for (var j = 0; j < rows.length; j++) {
      var index = rows[j];
      if (!index || !text(index.actionId)) throw new Error('artifact-command-index-invalid');
      var cause = await store.get(Learning.causeKey(index.actionId));
      if (!cause || !same(cause, index) || cause.domain !== owner || cause.lane !== 'research' || !text(cause.selectionId) ||
          !text(cause.efferenceCopyId) || !time(cause.emittedAt, now)) throw new Error('artifact-command-cause-invalid');
      var selection = await store.get('autofire_selection:' + cause.selectionId);
      var copy = await store.get(Efference.recordKey(cause.efferenceCopyId));
      if (!decision(selection, owner, cause.emittedAt) || selection.id !== cause.selectionId || selection.status !== 'RELEASED' ||
          !copy || copy.schemaVersion !== Efference.SCHEMA_VERSION || copy.id !== cause.efferenceCopyId || copy.actionId !== cause.actionId ||
          copy.lane !== 'research' || copy.actionKind !== 'generate_research_artifact' || copy.emittedAt !== cause.emittedAt ||
          copy.subjectId !== cause.subjectId || copy.cik !== cause.cik || copy.subjectId !== selection.candidate.subjectId ||
          copy.cik !== selection.candidate.cik || !same(copy.sourceIdentity, selection.candidate.sourceIdentity) ||
          !copy.sourceIdentity || !text(copy.sourceIdentity.kind) || !text(copy.sourceIdentity.value) ||
          ['sourceArtifactRef', 'sourcePatternSig', 'sourcePacketId'].some(function (field) {
            return !cause.decisionTrace || cause.decisionTrace[field] !== (selection.candidate[field] || null);
          }) || ['COMMANDED', 'EXECUTED', 'FAILED', 'UNRESOLVED', 'ABORTED'].indexOf(copy.status) < 0) throw new Error('artifact-command-decision-link-invalid');
      var receipt = null;
      if (copy.status !== 'COMMANDED' && (!time(copy.resolvedAt, now) || copy.resolvedAt < copy.emittedAt)) throw new Error('artifact-resolution-time-invalid');
      if (copy.status === 'EXECUTED') {
        if (!copy.receipt || copy.receipt.applied !== true || !text(copy.receipt.outputId) ||
            !copy.receipt.observedEffect || copy.receipt.observedEffect.artifactPersisted !== true) throw new Error('artifact-persistence-receipt-invalid');
        receipt = { kind: 'PERSISTENCE-RECEIPT', id: copy.receipt.outputId };
      }
      commands.push({ id: copy.id, actionId: copy.actionId, status: copy.status, commandedAt: copy.emittedAt,
        decisionId: cause.selectionId, key: Efference.recordKey(copy.id), sourcePacketId: selection.candidate.sourcePacketId || null,
        artifactGenerationOnly: true, reason: copy.receipt && copy.receipt.reason || null, receipt: receipt });
    }
    decisions.sort(function (a, b) { return b.at - a.at || a.id.localeCompare(b.id); });
    commands.sort(function (a, b) { return b.commandedAt - a.commandedAt || a.id.localeCompare(b.id); });
    var latest = decisions[0];
    out.decision = latest ? { id: latest.id, status: latest.status, decidedAt: latest.at, expiresAt: null,
      key: 'autofire_selection:' + latest.id, packetId: latest.candidate.sourcePacketId || null,
      originDomain: latest.routing && latest.routing.originDomain || null,
      blockers: Array.isArray(latest.reasons) ? latest.reasons.slice(0, 12) : [] } : null;
    out.command = commands[0] || null;
    var productDomain = owner === 'research' ? 'science' : owner === 'health' ? 'medicine' : owner;
    var dispatch = await MotorAuthorization.authorize(store, productDomain, 'research-papers', now);
    out.dispatchGate = { status: dispatch.status, reason: dispatch.reason || null, readAt: now,
      receiptId: dispatch.receiptId || null, observationOnly: true };
    if (out.decision || out.command) { out.status = 'RECORDED'; out.reason = 'artifact persistence is reafference; independent evaluation and revenue remain separate'; }
  } catch (err) { out.status = 'UNAVAILABLE'; out.reason = String(err && err.message || err); out.decision = null; out.command = null; }
  return out;
}
async function readOrigin(store, origin, now) {
  now = now == null ? Date.now() : now;
  var out = { schemaVersion: 'research-origin-trace-readout/1.0', originDomain: origin,
    destinationOwner: 'research', readAt: now, observationOnly: true, externalActionAuthorized: false,
    status: 'UNOBSERVED', reason: 'source-paper-routing-not-observed', routes: [], outcomes: [], command: null };
  try {
    store.assertDurable();
    if (!supportsOrigin(origin)) throw new Error('research-origin-not-supported');
    var index = await store.lrange(Bridge.LOG_KEY, 0, 999);
    if (!Array.isArray(index)) throw new Error('research-origin-index-invalid');
    var matches = index.filter(function (row) { return row && row.routing && row.routing.originDomain === origin; }).slice(0, 20);
    for (var i = 0; i < matches.length; i++) {
      if (!text(matches[i].id)) throw new Error('research-origin-index-invalid');
      var row = await store.get('autofire_selection:' + matches[i].id);
      if (!same(row, matches[i]) || !decision(row, 'research', now) ||
          !row.routing || row.routing.originDomain !== origin || !text(row.routing.sourcePacketId)) {
        throw new Error('research-origin-readback-invalid');
      }
      out.routes.push({ decisionId: row.id, decisionKey: 'autofire_selection:' + row.id,
        destinationOwner: 'research', status: row.status, decidedAt: row.at,
        sourcePacketId: row.routing.sourcePacketId,
        blockers: Array.isArray(row.reasons) ? row.reasons.slice(0, 12) : [] });
    }
    var state = await store.get(Learning.stateKey('research'));
    if (state) {
      if (state.stateVersion !== 1 || state.domain !== 'research' || state.lane !== 'research' ||
          !state.externalLearning || !Array.isArray(state.externalLearning.signals) ||
          !Array.isArray(state.processedOutcomeIds)) throw new Error('research-origin-outcome-state-invalid');
      var signals = state.externalLearning.signals.slice(-20);
      if (signals.length) {
        // The existing owner reader validates every indexed command against its
        // permanent cause, released selection and efference receipt.
        var owned = await read(store, 'science', now);
        if (owned.status === 'UNAVAILABLE') throw new Error(owned.reason);
        var events = await store.lrange(Learning.OUTCOME_LOG_KEY, 0, 1999);
        if (!Array.isArray(events)) throw new Error('research-origin-outcome-index-invalid');
        for (var j = 0; j < signals.length; j++) {
          var signal = signals[j];
          if (!signal || signal.ownerDomain !== 'research' || signal.eventType !== 'OUTCOME_RESEARCH_EVALUATED') continue;
          var cause = await store.get(Learning.causeKey(signal.actionId));
          if (!cause || !state.commands.slice(-20).some(function (c) { return same(c, cause); })) throw new Error('research-origin-outcome-cause-invalid');
          var selection = await store.get('autofire_selection:' + cause.selectionId);
          if (!selection || !selection.routing || selection.routing.originDomain !== origin) continue;
          if (!decision(selection, 'research', now) || selection.status !== 'RELEASED') throw new Error('research-origin-outcome-selection-invalid');
          var event = events.filter(function (e) { return e && e.eventId === signal.eventId; })[0];
          var copy = await store.get(Efference.recordKey(cause.efferenceCopyId));
          if (signal.schemaVersion !== Learning.EXTERNAL_LEARNING_SCHEMA || signal.signalId !== 'els_' + signal.eventId ||
              signal.sourceKind !== 'independent-action-outcome' || signal.lane !== 'research' ||
              !event || Date.parse(event.observedAt) !== event.ts || event.ownerDomain !== 'research' || event.actionId !== cause.actionId ||
              event.eventType !== 'OUTCOME_RESEARCH_EVALUATED' || !text(event.observationId) ||
              !time(event.ts, now) || event.ts !== signal.observedAt || event.ts < cause.emittedAt ||
              state.processedOutcomeIds.indexOf(event.eventId) < 0 || !copy || copy.status !== 'EXECUTED' ||
              !time(copy.resolvedAt, now) || event.ts < copy.resolvedAt ||
              !copy.receipt || copy.receipt.outputId !== event.outputId || !same(signal.sourceIdentity, event.sourceIdentity)) {
            throw new Error('research-origin-outcome-link-invalid');
          }
          var inspected = await EvaluationObserver.inspect(store, [{ observationId: event.observationId }]);
          var admitted = inspected[0];
          if (!admitted || admitted.status !== 'ELIGIBLE' || admitted.event.ownerDomain !== 'science' ||
              ['actionId', 'outputId', 'observationId', 'observedAt', 'eventType'].some(function (key) { return admitted.event[key] !== event[key]; }) ||
              !same(admitted.event.outcomeData, event.outcomeData) || !same(admitted.event.sourceIdentity, event.sourceIdentity)) {
            throw new Error('research-origin-evaluation-readback-invalid');
          }
          var grade = Learning.grade(event);
          if (!grade.graded || grade.outcome !== signal.outcome || grade.reward !== signal.reward) throw new Error('research-origin-outcome-grade-invalid');
          out.outcomes.push({ destinationOwner: 'research', decisionId: selection.id, actionId: event.actionId,
            observationId: event.observationId, sourcePacketId: selection.routing.sourcePacketId,
            outcome: grade.outcome, observedAt: event.ts, sourceIdentity: event.sourceIdentity,
            observationOnly: true, originRewardAuthorized: false, externalActionAuthorized: false });
        }
      }
    }
    out.routes.sort(function (a, b) { return b.decidedAt - a.decidedAt || a.decisionId.localeCompare(b.decisionId); });
    if (out.routes.length) { out.status = 'RECORDED'; out.reason = 'Science owns paper execution; source observes routing only'; }
  } catch (error) { out.status = 'UNAVAILABLE'; out.reason = String(error && error.message || error); out.routes = []; out.outcomes = []; }
  return out;
}
module.exports = { supportsOrigin: supportsOrigin, read: read, readOrigin: readOrigin, owners: owners };
