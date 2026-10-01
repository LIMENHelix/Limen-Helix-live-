'use strict';

// Observation only. Read authoritative keyed records behind bounded discovery
// logs; never publish prompts, asset URLs, accounts or execution authority.
var Decision = require('./culture-hero-decision.js');
var Executor = require('./culture-hero-executor.js');
function identity(row, schema) {
  return row && row.schemaVersion === schema && row.productDomain === 'culture' &&
    row.ownerDomain === 'culture' && row.lane === 'hero-image';
}
function timestamp(value, now) { return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now; }
async function read(store, now) {
  now = now == null ? Date.now() : now;
  var output = { schemaVersion: 'culture-business-trace-readout/1.0', ownerDomain: 'culture',
    lane: 'hero-image', readAt: now, observationOnly: true, externalActionAuthorized: false,
    status: 'UNOBSERVED', reason: null, decision: null, command: null };
  try {
    store.assertDurable();
    var logs = await Promise.all([store.lrange(Decision.LOG_KEY, 0, 19),
      store.lrange(Executor.LOG_KEY, 0, 19), store.lrange(Executor.PENDING_LOG_KEY, 0, 19)]);
    if (logs.some(function (rows) { return !Array.isArray(rows); })) throw new Error('business-log-invalid');
    var decisions = [], commands = [], seen = Object.create(null);
    for (var i = 0; i < logs[0].length; i++) {
      var index = logs[0][i];
      if (!index || typeof index.decisionReceiptId !== 'string' || !index.decisionReceiptId) throw new Error('decision-index-invalid');
      var d = await store.get(Decision.key(index.decisionReceiptId));
      if (!identity(d, Decision.SCHEMA) || d.decisionReceiptId !== index.decisionReceiptId ||
          ['RELEASED', 'NO_ACTION'].indexOf(d.status) < 0 || !timestamp(d.decidedAt, now)) throw new Error('decision-readback-invalid');
      decisions.push(d);
    }
    var indexes = logs[1].concat(logs[2]);
    for (var j = 0; j < indexes.length; j++) {
      var cindex = indexes[j];
      if (!cindex || typeof cindex.commandId !== 'string' || !cindex.commandId) throw new Error('command-index-invalid');
      if (seen[cindex.commandId]) continue;
      seen[cindex.commandId] = true;
      var c = await store.get(Executor.commandKey(cindex.commandId));
      if (!identity(c, Executor.SCHEMA) || c.commandId !== cindex.commandId || c.actionId !== c.commandId ||
          ['DISPATCHING', 'GENERATED', 'FAILED', 'AMBIGUOUS'].indexOf(c.status) < 0 || !timestamp(c.commandedAt, now) ||
          typeof c.decisionReceiptId !== 'string' || !c.decisionReceiptId ||
          typeof c.promptHash !== 'string' || !c.promptHash) throw new Error('command-readback-invalid');
      var cause = await store.get(Decision.key(c.decisionReceiptId));
      if (!identity(cause, Decision.SCHEMA) || cause.decisionReceiptId !== c.decisionReceiptId || cause.status !== 'RELEASED' ||
          cause.promptHash !== c.promptHash || !timestamp(cause.decidedAt, c.commandedAt) ||
          typeof cause.expiresAt !== 'number' || !Number.isFinite(cause.expiresAt) || c.commandedAt > cause.expiresAt) throw new Error('command-decision-link-invalid');
      commands.push(c);
    }
    decisions.sort(function (a, b) { return b.decidedAt - a.decidedAt; });
    commands.sort(function (a, b) { return b.commandedAt - a.commandedAt; });
    var latest = decisions[0], command = commands[0];
    output.decision = latest ? { id: latest.decisionReceiptId, status: latest.status,
      decidedAt: latest.decidedAt, expiresAt: latest.expiresAt || null, key: Decision.key(latest.decisionReceiptId),
      packetId: latest.culturePacketId || null, reason: latest.reason || null, blockers: (latest.blockers || []).slice(0, 12) } : null;
    output.command = command ? { id: command.commandId, status: command.status, commandedAt: command.commandedAt,
      key: Executor.commandKey(command.commandId), decisionId: command.decisionReceiptId,
      providerReceiptId: command.providerAccepted === true && command.receipt && typeof command.receipt.providerRequestId === 'string'
        ? command.receipt.providerRequestId : null } : null;
    output.status = latest || command ? 'RECORDED' : 'UNOBSERVED';
    output.reason = output.status === 'UNOBSERVED' ? 'culture-business-records-not-observed' : null;
    return output;
  } catch (error) {
    output.status = 'UNAVAILABLE'; output.reason = String(error && error.message || error);
    output.decision = null; output.command = null;
    return output;
  }
}
module.exports = { read: read };
