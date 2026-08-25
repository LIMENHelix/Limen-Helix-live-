'use strict';

/**
 * Operator boundary for Tradier sandbox B14 accounting.
 *
 * POST action=preview creates no order. POST action=submit requires the master
 * credential and the exact confirmation stored with that preview. POST
 * action=cancel requires the master credential and the exact rollback
 * confirmation stored on the command. POST action=reconcile and GET reads are
 * observational. Production brokerage is impossible because the broker
 * transport hardcodes sandbox.tradier.com.
 */

var adminGate = require('../lib/admin-gate');
var store = require('../lib/autofire-efference-store');
var broker = require('../lib/tradier-sandbox');
var b14 = require('../lib/tradier-b14');

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limen-Pass');
  res.setHeader('Cache-Control', 'no-store');

  var method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return res.status(200).end();
  var pass = adminGate.reqKey(req);
  if (!adminGate.hasDomain(pass, 'finance')) return adminGate.deny(res);

  try {
    if (method === 'GET') {
      var commandId = req.query && req.query.commandId;
      if (!commandId) return res.status(400).json({ ok: false, error: 'commandId is required' });
      var record = await b14.read(store, commandId);
      return record
        ? res.status(200).json({ ok: true, broker: 'tradier', environment: 'sandbox', record: record })
        : res.status(404).json({ ok: false, error: 'command not found' });
    }
    if (method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });
    var body = bodyOf(req);
    if (body.action === 'preview') {
      var preview = await b14.createPreview(store, broker, body.intent);
      return res.status(200).json({ ok: true, broker: 'tradier', environment: 'sandbox', orderPlaced: false, preview: preview });
    }
    if (body.action === 'submit') {
      if (!adminGate.isMaster(pass)) return adminGate.deny(res);
      var command = await b14.submitApproved(store, broker, body);
      return res.status(200).json({ ok: true, broker: 'tradier', environment: 'sandbox', paper: true, command: command });
    }
    if (body.action === 'reconcile') {
      var reconciled = await b14.reconcile(store, broker, body.commandId);
      return res.status(200).json({ ok: true, broker: 'tradier', environment: 'sandbox', command: reconciled });
    }
    if (body.action === 'cancel') {
      if (!adminGate.isMaster(pass)) return adminGate.deny(res);
      var canceled = await b14.cancelApproved(store, broker, body);
      return res.status(200).json({ ok: true, broker: 'tradier', environment: 'sandbox', paper: true, command: canceled });
    }
    return res.status(400).json({ ok: false, error: 'action must be preview, submit, reconcile, or cancel' });
  } catch (err) {
    var code = err && err.code || '';
    var status = /^TRADIER_B14_(INVALID|CONFIRMATION|CANCEL_|MAX_|CASH_|SHORTING|PREVIEW_)/.test(code) ? 400
      : code === 'TRADIER_B14_ALREADY_SUBMITTED' || code === 'TRADIER_B14_COMMAND_UNRESOLVED' ? 409
      : code === 'TRADIER_B14_COMMAND_NOT_FOUND' ? 404
      : 503;
    return res.status(status).json({
      ok: false,
      broker: 'tradier',
      environment: 'sandbox',
      error: err && err.message || 'Tradier B14 operation failed',
      errorCode: code || 'TRADIER_B14_FAILED',
      commandId: err && err.commandId || null
    });
  }
};
