'use strict';

// Existing owner-scoped artifact contracts; no dispatch, learning or writes.
var Bridge = require('./autofire-domain-bridge.js');
var Learning = require('./autofire-learning.js');
var Efference = require('./autofire-efference.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var owners = { science: 'research', research: 'research', medicine: 'health', health: 'health', education: 'education', environment: 'environment' };
function text(v) { return typeof v === 'string' && v.trim().length > 0; }
function time(v, now) { return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= now; }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function validRouting(row, owner) {
  var routing = row && row.routing;
  if (!routing) return true; // Older receipts have no explicit origin metadata.
  return routing.observationOnly === true && routing.ownerDomain === owner &&
    ['agriculture', 'science', 'medicine', 'education', 'environment'].indexOf(routing.originDomain) >= 0 &&
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
module.exports = { read: read, owners: owners };
