'use strict';

/**
 * Communication video is a separate business lane from Communication social.
 * Its private YouTube receipt proves provider acceptance only; it must not be
 * projected onto the Bluesky capability pair or treated as public outcome.
 */

var Command = require('./communication-video-command.js');
var Upload = require('./communication-video-upload-bridge.js');

async function audit(store, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var commands = await store.lrange(Command.LOG_KEY, 0, 999), receipts = await store.lrange(Upload.RECEIPT_LOG, 0, 999);
  var receipt = receipts.filter(function (row) { return row && row.schemaVersion === Upload.RECEIPT_SCHEMA && row.status === 'UPLOADED_PRIVATE' && row.readbackVerified === true && row.providerCalled === true; })[0] || null;
  var command = receipt && commands.filter(function (row) { return row && row.commandId === receipt.commandId; })[0] || null;
  return { schemaVersion: 'communication-video-capability-audit/1.0', productDomain: 'communication', ownerDomain: 'communication',
    lane: 'video-publication', measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    executor: { verified: !!receipt, evidenceReceiptId: receipt && receipt.receiptId || null, commandId: command && command.commandId || null,
      privateProviderReceipt: !!receipt, publiclyVisible: receipt ? receipt.publiclyVisible === true : false },
    independentOutcomeObserver: { verified: false, reason: 'video-private-provider-receipt-without-independent-outcome', evidenceReceiptId: null },
    status: 'HELD', reason: receipt ? 'video-private-provider-receipt-without-independent-outcome' : 'video-provider-receipt-missing',
    capabilityPairPersisted: false, commandsExamined: commands.length, receiptsExamined: receipts.length };
}

module.exports = { audit: audit };
