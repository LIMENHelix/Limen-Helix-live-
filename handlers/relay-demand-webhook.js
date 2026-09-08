/**
 * relay-demand-webhook.js — LEGACY Stripe webhook: retired, registration kept.
 *
 * This endpoint used to mark orders paid, book margin, and queue supplier
 * purchases on verified checkout.session.completed events. That behavior is
 * RETIRED: the keys it wrote belong elsewhere. `relay:orders` is the Trade
 * domain's shared marketplace store (lib/relay-marketplace.js), off-limits to
 * Relay, whose own orders live under `relay:store:orders` (lib/relay-store.js).
 * Real payment reconciliation already exists: lib/relay-engine.js polls
 * lib/relay-finance-bridge.paymentStatus(), which requires payment_status
 * 'paid' AND status 'complete'. Nothing here mutates anything.
 *
 * The route stays REGISTERED in api/[...route].js because the Stripe dashboard
 * endpoint registration pointing at this URL is unverified; a removed route
 * would turn Stripe's retries into 404 retry storms.
 *
 * AUTHENTICATED BY STRIPE SIGNATURE, fail closed, exactly as before retirement:
 * the RAW request body is verified against the STRIPE_WEBHOOK_SECRET family
 * via lib/relay-finance-bridge's seam (the only Relay file allowed to touch
 * stripe-rail — scripts/test-relay-firewall.js pins that). No configured
 * secret → 503. Missing or invalid signature → 403. Only VERIFIED payloads are
 * parsed. A verified event of any type — including checkout.session.completed —
 * gets a 200 acknowledging receipt and stating that nothing was mutated.
 * No idempotency machinery is needed: there is no state to double-apply.
 */

// Signature verification goes through the finance bridge seam — the only Relay file
// allowed to touch stripe-rail (scripts/test-relay-firewall.js pins that).
const bridge = require('../lib/relay-finance-bridge');

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// Read the EXACT bytes. Buffer concat, not string concatenation, so a multi-byte
// character split across two chunks cannot corrupt the payload the HMAC is over.
function readRaw(req) {
  return new Promise(function (resolve) {
    if (typeof req.body === 'string') return resolve(req.body);
    if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
    var chunks = [];
    var size = 0;
    req.on('data', function (c) {
      var b = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += b.length;
      if (size <= 1048576) chunks.push(b);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', function () { resolve(''); });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { error: 'Method not allowed' });
  }

  var raw = await readRaw(req);
  var sig = req.headers && (req.headers['stripe-signature'] || req.headers['Stripe-Signature']);

  // FAIL CLOSED. A webhook with no configured secret cannot be authenticated, so it is
  // refused — same rule as handlers/relay-stripe-webhook.js.
  if (!bridge.webhookConfigured()) {
    console.error('[relay-demand-webhook] refused: no Stripe webhook secret is set');
    return sendJSON(res, 503, { error: 'webhook not configured' });
  }

  var ver = bridge.verifyWebhookSignature(raw, sig);
  if (!ver.ok) {
    console.warn('[relay-demand-webhook] refused: ' + ver.error);
    return sendJSON(res, 403, { error: 'invalid signature' });
  }

  // Only VERIFIED payloads are parsed. This endpoint is retired: no order is
  // marked paid, no ledger entry is written, no purchase is queued, regardless
  // of event type. Reconciliation lives in lib/relay-engine.js via
  // relay-finance-bridge.paymentStatus().
  try { JSON.parse(raw); }
  catch (e) { return sendJSON(res, 400, { error: 'invalid JSON' }); }

  return sendJSON(res, 200, { received: true, retired: true, mutated: false });
};
