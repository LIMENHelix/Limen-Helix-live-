'use strict';
var AdminGate = require('../lib/admin-gate.js'); var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/law-automail-executor.js'); var Observer = require('../lib/law-automail-outcome-observer.js'); var Recovery = require('../lib/law-automail-recovery.js');
function bodyOf(req) { if (!req.body) return {}; return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
function provider(apiKey, fetcher) { var auth = 'Basic ' + Buffer.from(apiKey + ':').toString('base64'), url = function (id) { return 'https://api.lob.com/v1/letters/' + encodeURIComponent(id); };
  return { cancel: async function (id) { try { var r = await fetcher(url(id), { method: 'DELETE', headers: { authorization: auth, accept: 'application/json', 'user-agent': 'limen-helix/1.0' } });
      var b = await r.json().catch(function () { return {}; }); return { ok: r.ok, deleted: b.deleted === true, error: b.error && (b.error.message || b.error), ambiguous: r.status >= 500 }; }
    catch (error) { return { ok: false, error: String(error && error.message || error), ambiguous: true }; } },
    read: async function (id) { try { var r = await fetcher(url(id), { method: 'GET', headers: { authorization: auth, accept: 'application/json', 'user-agent': 'limen-helix/1.0' } });
      var b = await r.json().catch(function () { return {}; }); return { ok: r.ok && b.id === id, deleted: b.deleted === true, state: b.status || null }; }
    catch (_) { return { ok: false, deleted: false }; } } }; }
function createHandler(deps) { deps = deps || {}; var store = deps.store || Store, gate = deps.adminGate || AdminGate, recovery = deps.recovery || Recovery;
  return async function handler(req, res) { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || '').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }
    var pass = gate.reqKey(req); if (!gate.hasDomain(pass, 'law')) return gate.deny(res);
    try { var body = bodyOf(req), command = await store.get(Executor.commandKey(body.commandId)), observation = command && command.providerLetterId ? await store.get(Observer.key(command.providerLetterId)) : null;
      var apiKey = deps.apiKey || process.env.LOB_API_KEY; if (!apiKey) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, status: 'HELD', reason: 'lob-credential-unavailable', liveMoney: false })); }
      var result = await recovery.recover({ store: store, command: command, observation: observation, trigger: body.trigger, now: Date.now(),
        provider: deps.provider || provider(apiKey, deps.fetch || global.fetch) }); res.statusCode = result.status === 'REFUSED' ? 400 : 200; return res.end(JSON.stringify(result)); }
    catch (error) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'law-automail-recovery-unavailable', detail: String(error && error.message || error), liveMoney: false })); } };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('law-automail-recovery', handler); module.exports.createHandler = createHandler;
