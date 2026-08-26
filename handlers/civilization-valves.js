'use strict';

var Gate = require('../lib/admin-gate.js');
var Control = require('../lib/civilization-valve-control.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'private, no-store');
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); } }
    var chunks = [];
    req.on('data', function (x) { chunks.push(x); });
    req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (_) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function createHandler(deps) {
  deps = deps || {};
  var gate = deps.gate || Gate;
  var control = deps.control || Control;
  var store = deps.store;
  var env = deps.env || process.env;
  return async function handler(req, res) {
    var pass = gate.reqKey(req);
    if (!gate.isMaster(pass)) return gate.deny(res);
    var method = String(req.method || 'GET').toUpperCase();
    try {
      if (method === 'GET') {
        return send(res, 200, { ok: true, readOnly: true, topology: await control.snapshot(env, store) });
      }
      if (method !== 'POST') return send(res, 405, { ok: false, error: 'GET or POST required' });
      var body = await readBody(req);
      var valveId = String(body.valveId || '');
      var mode = String(body.mode || '').toUpperCase();
      var receipt = await control.set(valveId, mode, 'master-operator', store, deps.now);
      return send(res, 200, {
        ok: true,
        changed: true,
        receipt: receipt,
        topology: await control.snapshot(env, store),
        note: mode === 'CLOSED'
          ? 'New efferent dispatch is inhibited. Observers and recovery remain open.'
          : 'Eligibility is restored. No action was selected or executed; all domain gates still bind.'
      });
    } catch (error) {
      return send(res, 503, { ok: false, error: 'civilization-valve-control-unavailable', detail: String(error && error.message || error) });
    }
  };
}

var handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;

