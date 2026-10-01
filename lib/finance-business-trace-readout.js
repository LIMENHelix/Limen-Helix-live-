'use strict';
var Decision = require('./finance-trade-decision.js');
var Executor = require('./finance-paper-executor.js');
var Learning = require('./autofire-learning.js');
function text(v) { return typeof v === 'string' && v.trim().length > 0; }
function at(v, now) { var n = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(n) && n > 0 && n <= now ? n : null; }
function paper(s) { return s && s.paperOnly === true && s.liveMoney === false; }
async function read(store, now) {
  now = now == null ? Date.now() : now;
  var out = { schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'finance', lane: 'investments',
    readAt: now, observationOnly: true, externalActionAuthorized: false, status: 'UNOBSERVED',
    reason: 'finance-native-business-records-not-observed', decision: null, command: null };
  try {
    store.assertDurable();
    var logs = await Promise.all([store.lrange(Decision.LOG_KEY, 0, 19), store.lrange(Executor.LOG_KEY, 0, 39)]);
    if (logs.some(function (rows) { return !Array.isArray(rows); })) throw new Error('finance-business-index-invalid');
    var packets = [], seen = Object.create(null), decisions = [], commands = [];
    logs[0].concat(logs[1]).forEach(function (index) {
      if (!index || !text(index.packetId)) throw new Error('finance-packet-index-invalid');
      if (!seen[index.packetId]) { seen[index.packetId] = true; packets.push(index.packetId); }
    });
    for (var i = 0; i < packets.length; i++) {
      var packet = packets[i], d = await store.get(Decision.key(packet));
      if (!d || d.schemaVersion !== Decision.RECEIPT_SCHEMA || d.packetId !== packet || !paper(d.safety) ||
          ['TRADE_INTENT_SELECTED', 'ABSTAINED'].indexOf(d.status) < 0 ||
          !at(d.commandedAt, now) || !at(d.completedAt, now) || Date.parse(d.completedAt) < Date.parse(d.commandedAt)) throw new Error('finance-decision-readback-invalid');
      if (d.status === 'TRADE_INTENT_SELECTED' && (!d.selection || d.selection.ownerDomain !== 'finance' || d.selection.lane !== 'investment' ||
          d.selection.status !== 'RELEASED' || !text(d.selection.id) || !d.tradeIntent)) throw new Error('finance-selection-invalid');
      decisions.push({ id: d.selection && d.selection.id || packet, status: d.status, decidedAt: Date.parse(d.completedAt),
        key: Decision.key(packet), packetId: packet, reason: d.reason || null, blockers: Array.isArray(d.blockers) ? d.blockers.slice(0, 12) : [] });
      var claim = await store.get(Executor.claimKey(packet));
      if (!claim) continue;
      if (claim.schemaVersion !== Executor.SCHEMA || claim.packetId !== packet || d.status !== 'TRADE_INTENT_SELECTED' ||
          claim.selectionId !== d.selection.id || claim.oneShot !== true || !paper(claim.safety) || claim.safety.environment !== 'sandbox' ||
          !text(claim.motorReceiptId) || !at(claim.claimedAt, now) || Date.parse(claim.claimedAt) < Date.parse(d.completedAt) ||
          ['CLAIMED', 'COMMAND_RECEIPTED', 'EXECUTION_UNRESOLVED'].indexOf(claim.status) < 0) throw new Error('finance-execution-claim-invalid');
      var command = { id: claim.commandId || 'claim:' + packet, status: claim.status, commandedAt: Date.parse(claim.claimedAt),
        decisionId: claim.selectionId, key: Executor.claimKey(packet), paperOnly: true,
        commissioningOnly: claim.authorizationMode === 'developmental-paper-commissioning', receipt: null, reason: claim.error && claim.error.code || null };
      if (claim.commandId) {
        var c = await store.get('tradier_b14_command:' + claim.commandId);
        var cause = c && c.intent && await store.get(Learning.causeKey(c.intent.actionId));
        if (!c || c.schemaVersion !== 1 || c.commandId !== claim.commandId || c.previewId !== claim.previewId || !at(c.emittedAt, now) ||
            Date.parse(c.emittedAt) < Date.parse(claim.claimedAt) || !c.intent || c.intent.ownerDomain !== 'finance' || c.intent.actionId !== claim.selectionId ||
            c.intent.selectionId !== claim.selectionId || !c.approval || c.approval.ownerDomain !== 'finance' ||
            c.approval.mode !== 'domain-autonomous' || c.approval.authorizationReceiptId !== claim.motorReceiptId ||
            c.approval.authorizationMode !== claim.authorizationMode || !cause || cause.domain !== 'finance' || cause.lane !== 'investment' ||
            cause.selectionId !== claim.selectionId || cause.actionId !== claim.selectionId || cause.emittedAt !== Date.parse(claim.claimedAt) ||
            cause.efferenceCopyId !== 'finance-paper:' + claim.previewId || !c.intent.decisionContext ||
            JSON.stringify(c.intent.decisionContext.sourceIdentity) !== JSON.stringify(d.selection.candidate.sourceIdentity) ||
            ['sourceArtifactRef', 'sourcePatternSig', 'sourcePacketId'].some(function (field) {
              return !cause.decisionTrace || cause.decisionTrace[field] !== (d.selection.candidate[field] || null);
            }) ||
            ['symbol', 'side', 'quantity', 'limitPrice', 'maxNotionalUsd', 'sourceArtifactId'].some(function (field) { return c.intent[field] !== d.tradeIntent[field]; }) ||
            JSON.stringify(c.intent.horizonDays) !== JSON.stringify(d.tradeIntent.horizonDays) ||
            ['COMMAND_PERSISTED', 'DISPATCH_UNRESOLVED', 'DISPATCH_INHIBITED', 'RECEIPT_PERSISTED', 'RECEIPT_RECOVERED',
              'CANCEL_PERSISTED', 'CANCEL_UNRESOLVED', 'CANCEL_RECEIPT_PERSISTED', 'RECONCILED_TERMINAL', 'RECONCILED_UNRESOLVED'].indexOf(c.status) < 0) throw new Error('finance-b14-command-link-invalid');
        command.status = c.status; command.key = 'tradier_b14_command:' + c.commandId;
        if (claim.status === 'COMMAND_RECEIPTED') {
          if (!c.receipt || !text(c.receipt.orderId) || String(claim.orderId) !== c.receipt.orderId || !at(c.receipt.receivedAt, now)) throw new Error('finance-order-receipt-invalid');
          command.receipt = { kind: 'PAPER-ORDER', id: c.receipt.orderId };
        }
      } else if (claim.status === 'COMMAND_RECEIPTED') throw new Error('finance-receipted-command-missing');
      commands.push(command);
    }
    decisions.sort(function (a, b) { return b.decidedAt - a.decidedAt; });
    commands.sort(function (a, b) { return b.commandedAt - a.commandedAt; });
    out.decision = decisions[0] || null; out.command = commands[0] || null;
    if (out.decision || out.command) { out.status = 'RECORDED'; out.reason = 'native Finance sandbox history; order receipt is not fill, profit or revenue'; }
  } catch (err) { out.status = 'UNAVAILABLE'; out.reason = String(err && err.message || err); out.decision = null; out.command = null; }
  return out;
}
module.exports = { read: read };
