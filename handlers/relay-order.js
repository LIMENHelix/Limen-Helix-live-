/**
 * relay-order.js — the read behind /relay-order, the Relay order-confirmation page.
 *
 *   GET /api/relay-order?session_id=cs_...   → { ok, orderId, amount, currency, paid }
 *
 * A Relay payment link now redirects the buyer here after payment (after_completion on the
 * link). The page needs exactly one thing: the order reference for the session Stripe just
 * ran. The read goes through lib/relay-finance-bridge — the one file the Relay firewall
 * (scripts/test-relay-firewall.js F6) permits to touch the payment rail — and returns the
 * order id, amount and payment state only. No email, no address, nothing the buyer did not
 * just type into Stripe's own page.
 *
 * FAIL-SOFT by contract: a session that cannot be read (expired id, Stripe unreachable,
 * foreign session) answers 502/404 with a generic line, and the static page renders a
 * plain "payment received" state instead of an error. This route moves no money and writes
 * nothing, so there is nothing to fail closed on except honesty about what it could read.
 */
var bridge = require('../lib/relay-finance-bridge');

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function queryOf(req) {
  try {
    var u = new URL(req.url, 'http://localhost');
    var out = {};
    u.searchParams.forEach(function (v, k) { out[k] = v; });
    return out;
  } catch (e) { return {}; }
}

function createHandler(deps) {
  deps = deps || {};
  var read = deps.orderConfirmation || bridge.orderConfirmation;
  return async function handler(req, res) {
    if ((req.method || 'GET') !== 'GET') return send(res, { ok: false, error: 'GET only' }, 405);
    var sessionId = String(queryOf(req).session_id || '').trim();
    if (!sessionId) return send(res, { ok: false, error: 'session_id is required' }, 400);

    var c;
    try {
      c = await read(sessionId);
    } catch (e) {
      return send(res, { ok: false, error: 'order confirmation unavailable' }, 502);
    }
    if (!c || !c.ok) return send(res, { ok: false, error: 'order confirmation unavailable' }, 502);
    return send(res, {
      ok: true,
      orderId: c.orderId || null,
      amount: c.amount != null ? c.amount : null,
      currency: c.currency || null,
      paid: c.paid === true
    });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
