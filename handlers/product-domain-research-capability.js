'use strict';

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Verifier = require('../lib/product-domain-research-capability-verifier.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body));
}

function createHandler(productDomain, deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var auth = deps.cronAuth || CronAuth;
  var verifier = deps.verifier || Verifier;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
    if (!auth.enforce(req, res)) return;
    try {
      var result = await verifier.verifyAndPersist(store, productDomain, Date.now());
      result.authMode = 'cron-write';
      result.commissioningOnly = true;
      result.liveMoney = false;
      return send(res, 200, result);
    } catch (error) {
      return send(res, 503, { ok: false, error: productDomain + '-research-capability-verification-failed',
        detail: String(error && error.message || error), commissioningOnly: true, liveMoney: false });
    }
  };
}

module.exports = { createHandler: createHandler };
