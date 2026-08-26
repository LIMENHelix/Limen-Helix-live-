'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Decision = require('../lib/defense-publication-decision.js');
var Executor = require('../lib/defense-publication-executor.js');
var Observer = require('../lib/defense-publication-observer.js');

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
  try {
    var decisions = (await Store.lrange(Decision.LOG_KEY, 0, 19)).filter(function (row) { return row && row.schemaVersion === Decision.SCHEMA; }).map(function (row) {
      return { decisionReceiptId: row.decisionReceiptId, actionId: row.actionId, status: row.status, reason: row.reason || null,
        blockers: row.blockers || [], defensePacketId: row.defensePacketId, decidedAt: row.decidedAt, providerCalled: false, liveMoney: false };
    });
    var commands = (await Store.lrange(Executor.LOG_KEY, 0, 19)).filter(function (row) { return row && row.schemaVersion === Executor.SCHEMA; }).map(function (row) {
      return { commandId: row.commandId, actionId: row.actionId, status: row.status, articleId: row.articleId || null,
        publicPath: row.publicPath || null, durableReceiptReadbackVerified: row.durableReceiptReadbackVerified === true,
        commandedAt: row.commandedAt, liveMoney: false };
    });
    var observations = (await Store.lrange(Observer.LOG_KEY, 0, 19)).filter(function (row) { return row && row.schemaVersion === Observer.SCHEMA; }).map(function (row) {
      return { observationId: row.observationId, actionId: row.actionId, articleId: row.articleId, status: row.status,
        engagementEligible: row.engagementEligible === true, independentOfPublishResponse: row.independentOfPublishResponse === true,
        observedAt: row.observedAt, liveMoney: false };
    });
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, schemaVersion: 'defense-publication-status/1.0', productDomain: 'defense', ownerDomain: 'defense', lane: 'publication',
      switchEnabled: process.env.DEFENSE_PUBLICATION_ENABLED === '1', decisions: decisions, commands: commands, observations: observations,
      readOnly: true, providerCalledByRead: false, liveMoney: false }));
  } catch (error) {
    res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'defense-publication-status-unavailable', readOnly: true }));
  }
};
