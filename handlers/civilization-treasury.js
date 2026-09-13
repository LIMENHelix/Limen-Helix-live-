'use strict';

var Gate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Treasury = require('../lib/civilization-treasury-ledger.js');
var StripeBalance = require('../lib/stripe-balance-source.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'private, no-store');
  res.end(JSON.stringify(body));
}
function query(req) {
  try {
    var parsed = new URL(req.url || '/api/civilization-treasury', 'https://limenhelix.com');
    return { domain: String(parsed.searchParams.get('domain') || '').trim().toLowerCase(),
      includeStripe: parsed.searchParams.get('includeStripe') === '1' };
  } catch (_) { return { domain: '', includeStripe: false }; }
}
function createHandler(deps) {
  deps = deps || {};
  var gate = deps.gate || Gate;
  var store = deps.store || Store;
  var treasury = deps.treasury || Treasury;
  var stripeBalance = deps.stripeBalance || StripeBalance;
  return async function handler(req, res) {
    var pass = gate.reqKey(req);
    if (!gate.isMaster(pass)) return gate.deny(res);
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      return send(res, 405, { ok: false, error: 'GET only; treasury mutation is not exposed by this route' });
    }
    try {
      var projection = await treasury.project(store);
      var requested = query(req);
      if (requested.domain) {
        var account = projection.accounts.find(function (row) { return row.productDomain === requested.domain; });
        if (!account) return send(res, 400, { ok: false, error: 'unknown product domain' });
        var stripe = requested.includeStripe
          ? await stripeBalance.read(requested.domain, { env: deps.env || process.env, fetch: deps.fetch, now: deps.now }) : null;
        return send(res, 200, {
          ok: true, readOnly: true, accountingOnly: true, account: account,
          stripeBalance: stripe,
          currency: projection.currency, outboundMoneyAuthorized: false,
          blockers: projection.blockers, generatedAt: projection.generatedAt
        });
      }
      var platformStripe = requested.includeStripe
        ? await stripeBalance.read('finance', { env: deps.env || process.env, fetch: deps.fetch, now: deps.now }) : null;
      return send(res, 200, { ok: true, readOnly: true, accountingOnly: true,
        projection: projection, stripeBalance: platformStripe,
        stripeScope: platformStripe ? 'FINANCE_PLATFORM_ONLY_NOT_COPIED_TO_DOMAINS' : null });
    } catch (error) {
      return send(res, 503, { ok: false, error: 'civilization-treasury-unavailable',
        outboundMoneyAuthorized: false, detail: String(error && error.message || error) });
    }
  };
}

var handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
