'use strict';
var Admin = require('../lib/admin-gate.js'), Store = require('../lib/autofire-efference-store.js'), Broker = require('../lib/tradier-sandbox.js');
var Executor = require('../lib/energy-investment-executor.js'), Recovery = require('../lib/energy-investment-recovery.js');
module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  if (String(req.method || '').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }
  if (!Admin.hasDomain(Admin.reqKey(req), 'energy')) return Admin.deny(res);
  try { var body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; var command = await Store.get(Executor.commandKey(body.commandId));
    var result = await Recovery.recover({ store: Store, command: command, trigger: body.trigger, broker: Broker, env: process.env, now: Date.now() });
    res.statusCode = result.status === 'REFUSED' ? 400 : 200; return res.end(JSON.stringify(result));
  } catch (error) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'energy-investment-recovery-unavailable', detail: String(error && error.message || error), liveMoney: false })); }
};
