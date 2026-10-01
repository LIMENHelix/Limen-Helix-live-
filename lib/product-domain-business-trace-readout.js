'use strict';

// Fixed owner contracts, observation only. No dispatch or write methods are used.
var profiles = Object.create(null);
function register(domain, family, lane, fields, statuses) {
  profiles[domain] = { domain: domain, family: family, lane: lane, fields: fields, statuses: statuses,
    decision: require('./' + domain + '-' + family + '-decision.js'),
    executor: require('./' + domain + '-' + family + '-executor.js') };
}
['defense', 'governance'].forEach(function (domain) {
  register(domain, 'publication', 'publication', ['actionId', 'candidateId', 'contentHash', 'sourceFingerprint'],
    ['COMMANDING', 'DISPATCHING', 'PUBLISHED', 'FAILED', 'AMBIGUOUS']);
});
['economy', 'energy', 'technology'].forEach(function (domain) {
  register(domain, 'investment', 'investments', ['actionId', 'requestId', 'symbol', 'side', 'thesisId', 'evidenceHash'],
    ['COMMANDING', 'DISPATCHING', 'PREVIEWED', 'COMMAND_RECEIPTED', 'AMBIGUOUS', 'REFUSED']);
});
var operationStatuses = ['COMMANDING', 'DISPATCHING', 'ACCEPTED', 'FAILED', 'AMBIGUOUS', 'REFUSED', 'HELD_BUDGET'];
register('industry', 'crm', 'crm', ['actionId', 'warnKeyHash', 'companyHash', 'sourceIdentityHash'], operationStatuses);
register('intelligence', 'autopilot', 'autopilot', ['actionId', 'leadHash', 'emailHash', 'subjectDomain', 'actionKind', 'subjectHash', 'contentHash'], operationStatuses);
register('law', 'automail', 'automail', ['actionId', 'parcelHash', 'addressHash', 'contentHash'], operationStatuses);
['infrastructure', 'population'].forEach(function (domain) {
  register(domain, 'real-estate', 'real-estate', ['actionId', 'inquiryId', 'counterpartyEmailHash', 'propertyRefHash',
    'transactionIntent', 'listingUrlHash', 'brainOpportunityId', 'subjectHash', 'contentHash', 'evidenceHash'],
    ['COMMANDING', 'DISPATCHING', 'INQUIRY_ACCEPTED', 'FAILED', 'AMBIGUOUS', 'REFUSED', 'HELD_BUDGET']);
});
var Culture = require('./culture-business-trace-readout.js');
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function recordId(value) { return text(value) || typeof value === 'number' && Number.isFinite(value) && value > 0; }
function timestamp(value, now) { return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now; }
function identity(row, schema, profile) {
  return row && row.schemaVersion === schema && row.productDomain === profile.domain &&
    row.ownerDomain === profile.domain && row.lane === profile.lane;
}
// Bound independent keyed reads; discovery remains a recent window.
async function mapBounded(rows, fn) {
  var result = new Array(rows.length), cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async function () {
    while (cursor < rows.length) { var index = cursor++; result[index] = await fn(rows[index]); }
  }));
  return result;
}
function receipt(command, profile) {
  if (profile.family === 'publication') {
    return command.status === 'PUBLISHED' && command.durableReceiptReadbackVerified === true && text(command.articleId)
      ? { kind: 'OWNED-PUBLICATION', id: command.articleId } : null;
  }
  if (profile.family === 'crm') return command.status === 'ACCEPTED' && command.readbackVerified === true && recordId(command.hubspotCompanyId)
    ? { kind: 'CRM-ACCEPTED', id: String(command.hubspotCompanyId) } : null;
  if (profile.family === 'autopilot') return command.status === 'ACCEPTED' && command.readbackVerified === true && text(command.providerEmailId)
    ? { kind: 'EMAIL-ACCEPTED', id: command.providerEmailId } : null;
  if (profile.family === 'automail') return command.status === 'ACCEPTED' && command.readbackVerified === true && text(command.providerLetterId) && /^ltr_[A-Za-z0-9]+$/.test(command.providerLetterId)
    ? { kind: 'LETTER-ACCEPTED', id: command.providerLetterId } : null;
  if (profile.family === 'real-estate') return command.status === 'INQUIRY_ACCEPTED' && command.readbackVerified === true && text(command.providerEmailId)
    ? { kind: 'INQUIRY-ACCEPTED', id: command.providerEmailId } : null;
  return command.status === 'COMMAND_RECEIPTED' && command.durableReceiptReadbackVerified === true &&
    command.paperOnly === true && command.liveMoney === false && text(command.brokerCommandId) && recordId(command.brokerOrderId) &&
    command.brokerReceipt && recordId(command.brokerReceipt.orderId) && String(command.brokerReceipt.orderId) === String(command.brokerOrderId)
    ? { kind: 'PAPER-ORDER', id: String(command.brokerOrderId) } : null;
}
function boundedInquiry(row) {
  return row && row.nonBinding === true && row.contractAuthorized === false && row.earnestMoneyAuthorized === false &&
    row.fundsTransferAuthorized === false && row.liveMoney === false && typeof row.indicationPriceUsd === 'number' && Number.isFinite(row.indicationPriceUsd) && row.indicationPriceUsd > 0;
}
async function read(store, domain, now) {
  now = now == null ? Date.now() : now;
  if (domain === 'culture') return Culture.read(store, now);
  var profile = profiles[domain];
  var output = { schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: domain,
    lane: profile && profile.lane || null, readAt: now, observationOnly: true, externalActionAuthorized: false,
    status: 'UNOBSERVED', reason: null, decision: null, command: null };
  if (!profile) { output.reason = 'owner-business-trace-reader-not-connected'; return output; }
  var Decision = profile.decision, Executor = profile.executor;
  try {
    store.assertDurable();
    var pendingKey = Executor.PENDING_LOG_KEY || Executor.PENDING_KEY;
    var logs = await Promise.all([store.lrange(Decision.LOG_KEY, 0, 19), store.lrange(Executor.LOG_KEY, 0, 19),
      pendingKey ? store.lrange(pendingKey, 0, 19) : Promise.resolve([])]);
    if (logs.some(function (rows) { return !Array.isArray(rows); })) throw new Error('business-log-invalid');
    var decisions = await mapBounded(logs[0], async function (index) {
      if (!index || !text(index.decisionReceiptId)) throw new Error('decision-index-invalid');
      var d = await store.get(Decision.key(index.decisionReceiptId));
      if (!identity(d, Decision.SCHEMA, profile) || d.decisionReceiptId !== index.decisionReceiptId ||
          ['RELEASED', 'NO_ACTION'].indexOf(d.status) < 0 || !timestamp(d.decidedAt, now)) throw new Error('decision-readback-invalid');
      return d;
    });
    var seen = Object.create(null);
    var indexes = logs[1].concat(logs[2]).filter(function (index) {
      if (!index || !text(index.commandId)) throw new Error('command-index-invalid');
      if (seen[index.commandId]) return false;
      seen[index.commandId] = true; return true;
    });
    var commands = await mapBounded(indexes, async function (index) {
      var c = await store.get(Executor.commandKey(index.commandId));
      if (!identity(c, Executor.SCHEMA, profile) || c.commandId !== index.commandId ||
          profile.statuses.indexOf(c.status) < 0 || !timestamp(c.commandedAt, now) || !text(c.decisionReceiptId) ||
          profile.fields.some(function (field) { return !text(c[field]); }) ||
          (profile.family === 'investment' && (c.paperOnly !== true || c.liveMoney !== false)) ||
          (profile.family === 'real-estate' && !boundedInquiry(c))) throw new Error('command-readback-invalid');
      var cause = await store.get(Decision.key(c.decisionReceiptId));
      if (!identity(cause, Decision.SCHEMA, profile) || cause.decisionReceiptId !== c.decisionReceiptId || cause.status !== 'RELEASED' ||
          profile.fields.some(function (field) { return cause[field] !== c[field]; }) || !timestamp(cause.decidedAt, c.commandedAt) ||
          typeof cause.expiresAt !== 'number' || !Number.isFinite(cause.expiresAt) || c.commandedAt >= cause.expiresAt ||
          (profile.family === 'investment' && (cause.paperOnly !== true || cause.liveMoney !== false)) ||
          (profile.family === 'real-estate' && (!boundedInquiry(cause) || cause.indicationPriceUsd !== c.indicationPriceUsd)) ||
          (profile.family === 'autopilot' && cause.transition !== c.transition)) throw new Error('command-decision-link-invalid');
      return c;
    });
    decisions.sort(function (a, b) { return b.decidedAt - a.decidedAt || a.decisionReceiptId.localeCompare(b.decisionReceiptId); });
    commands.sort(function (a, b) { return b.commandedAt - a.commandedAt || a.commandId.localeCompare(b.commandId); });
    var latest = decisions[0], command = commands[0];
    output.decision = latest ? { id: latest.decisionReceiptId, status: latest.status, decidedAt: latest.decidedAt,
      expiresAt: latest.expiresAt || null, key: Decision.key(latest.decisionReceiptId), packetId: latest[domain + 'PacketId'] || null,
      reason: latest.reason || null, blockers: Array.isArray(latest.blockers) ? latest.blockers.slice(0, 12) : [] } : null;
    output.command = command ? { id: command.commandId, actionId: command.actionId, status: command.status,
      commandedAt: command.commandedAt, key: Executor.commandKey(command.commandId), decisionId: command.decisionReceiptId,
      paperOnly: command.paperOnly === true, nonBinding: profile.family === 'real-estate' && command.nonBinding === true,
      commissioningOnly: command.commissioningOnly === true, reason: command.reason || null,
      receipt: receipt(command, profile) } : null;
    output.status = latest || command ? 'RECORDED' : 'UNOBSERVED';
    output.reason = output.status === 'UNOBSERVED' ? domain + '-business-records-not-observed' : null;
  } catch (error) {
    output.status = 'UNAVAILABLE'; output.reason = String(error && error.message || error);
    output.decision = null; output.command = null;
  }
  return output;
}
module.exports = { read: read, domains: ['culture'].concat(Object.keys(profiles)) };
