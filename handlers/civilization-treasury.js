'use strict';

var Gate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Treasury = require('../lib/civilization-treasury-ledger.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'private, no-store');
  res.end(JSON.stringify(body));
}
function queryDomain(req) {
  try {
    var parsed = new URL(req.url || '/api/civilization-treasury', 'https://limenhelix.com');
    return String(parsed.searchParams.get('domain') || '').trim().toLowerCase();
  } catch (_) { return ''; }
}
function createHandler(deps) {
  deps = deps || {};
  var gate = deps.gate || Gate;
  var store = deps.store || Store;
  var treasury = deps.treasury || Treasury;
  return async function handler(req, res) {
    var pass = gate.reqKey(req);
    if (!gate.isMaster(pass)) return gate.deny(res);
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      return send(res, 405, { ok: false, error: 'GET only; treasury mutation is not exposed by this route' });
    }
    try {
      var projection = await treasury.project(store);
      var requested = queryDomain(req);
      if (requested) {
        var account = projection.accounts.find(function (row) { return row.productDomain === requested; });
        if (!account) return send(res, 400, { ok: false, error: 'unknown product domain' });
        return send(res, 200, {
          ok: true, readOnly: true, accountingOnly: true, account: account,
          currency: projection.currency, outboundMoneyAuthorized: false,
          blockers: projection.blockers, generatedAt: projection.generatedAt
        });
      }
      return send(res, 200, { ok: true, readOnly: true, accountingOnly: true, projection: projection });
    } catch (error) {
      return send(res, 503, { ok: false, error: 'civilization-treasury-unavailable',
        outboundMoneyAuthorized: false, detail: String(error && error.message || error) });
    }
  };
}

var handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
