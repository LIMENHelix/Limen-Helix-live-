'use strict';

/**
 * Public, sanitized, read-only state of the autonomous Finance paper loop.
 *
 * This endpoint exists so the operator does not need a reusable secret merely
 * to answer whether the scheduled chain reached preview, admission, decision,
 * broker command, position ownership, and outcome observation.  It never
 * exposes prompts, rationales, account balances, credentials, or live-money
 * controls, and it never contacts the broker or writes the durable store.
 */

var Store = require('../lib/autofire-efference-store.js');
var Redis = require('../lib/redis-kv.js');
var Preview = require('../lib/finance-preview-execution.js');
var Admission = require('../lib/finance-paper-admission.js');
var Decision = require('../lib/finance-trade-decision.js');
var Executor = require('../lib/finance-paper-executor.js');
var Commissioning = require('../lib/finance-sandbox-commissioning.js');
var PositionOwner = require('../lib/finance-position-owner.js');
var B14 = require('../lib/tradier-b14.js');

function project(record, fields) {
  if (!record) return null;
  var out = {};
  fields.forEach(function (field) {
    if (record[field] !== undefined) out[field] = record[field];
  });
  return out;
}

function packetId(entry) {
  var packet = entry && entry.c && entry.c.serverPacket;
  return packet && typeof packet.packetId === 'string' ? packet.packetId : null;
}

function company(receipt) {
  var selected = receipt && receipt.selectedCompany;
  if (!selected) return null;
  return { ticker: selected.ticker || null, name: selected.name || null, cik: selected.cik || null };
}

async function snapshot(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var redisGet = deps.redisGet || Redis.redisGet;
  store.assertDurable();
  var cognition = await redisGet('limen:brain:cognition:finance');
  var id = packetId(cognition);
  var rows = await Promise.all([
    store.get(Commissioning.KEY),
    id ? store.get(Preview.receiptKey(id)) : null,
    id ? store.get(Admission.admissionKey(id)) : null,
    id ? store.get(Decision.key(id)) : null,
    id ? store.get(Executor.claimKey(id)) : null,
    store.lrange(PositionOwner.LOG_KEY, 0, 0),
    store.lrange(B14.ACTIVE_COMMAND_INDEX || 'tradier_b14_active_commands', 0, 49)
  ]);
  var preview = rows[1], decision = rows[3], execution = rows[4];
  var active = Array.isArray(rows[6]) ? rows[6].filter(function (row) { return row && row.commandId; }) : [];
  return {
    ok: true,
    schemaVersion: 'finance-paper-status/1.0',
    measuredAt: new Date().toISOString(),
    packetId: id,
    packetGeneratedAt: cognition && cognition.c && cognition.c.serverPacket && cognition.c.serverPacket.generatedAt || null,
    chain: {
      commissioning: project(rows[0], ['status', 'verifiedAt', 'commandId', 'effectExecuted', 'executedQuantity']),
      preview: preview ? Object.assign(project(preview, ['status', 'completedAt', 'providerCalled', 'reason']), { company: company(preview) }) : null,
      admission: project(rows[2], ['status', 'admittedAt']),
      decision: decision ? {
        status: decision.status || null,
        completedAt: decision.completedAt || null,
        providerCalled: decision.providerCalled === true,
        action: decision.proposal && decision.proposal.action || null,
        symbol: decision.tradeIntent && decision.tradeIntent.symbol || decision.market && decision.market.symbol || null,
        reason: decision.reason || null
      } : null,
      execution: execution ? {
        status: execution.status || null,
        completedAt: execution.completedAt || null,
        commandId: execution.commandId || null,
        orderId: execution.orderId || null,
        orderPlaced: !!execution.orderId,
        reason: execution.error && execution.error.code || null
      } : null,
      positionOwner: rows[5] && rows[5][0] ? project(rows[5][0], ['status', 'completedAt', 'symbol', 'openingCommandId', 'commandId', 'orderId', 'reason', 'orderPlaced']) : null,
      activeBrokerCommands: active.length
    },
    boundaries: {
      executionMode: 'tradier-sandbox',
      paperOnly: true,
      liveMoney: false,
      credentialsExposed: false,
      accountBalancesExposed: false,
      brokerContactedByThisRead: false,
      storeWrittenByThisRead: false
    }
  };
}

function createHandler(deps) {
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    try {
      res.statusCode = 200;
      return res.end(JSON.stringify(await snapshot(deps)));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({
        ok: false,
        error: 'finance-paper-status-unavailable',
        detail: String(error && error.message || error),
        paperOnly: true,
        liveMoney: false
      }));
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.snapshot = snapshot;
handler.packetId = packetId;
module.exports = handler;
