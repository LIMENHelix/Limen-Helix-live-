'use strict';
var Gate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/agriculture-homestead-executor.js');
var Observer = require('../lib/agriculture-homestead-observer.js');
var Recovery = require('../lib/agriculture-homestead-recovery.js');
module.exports = async function (req, res) { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); if (String(req.method || '').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); } var pass = Gate.reqKey(req); if (!Gate.hasDomain(pass, 'agriculture')) return Gate.deny(res); try { var body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}, command = await Store.get(Executor.commandKey(body.commandId)), observation = body.providerInboundEmailId ? await Store.get(Observer.key(body.providerInboundEmailId)) : null, result = await Recovery.recover({ store: Store, command: command, observation: observation, trigger: body.trigger, now: Date.now() }); res.statusCode = result.status === 'REFUSED' ? 400 : 200; return res.end(JSON.stringify(result)); } catch (error) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'agriculture-homestead-recovery-unavailable', detail: String(error && error.message || error) })); } };
