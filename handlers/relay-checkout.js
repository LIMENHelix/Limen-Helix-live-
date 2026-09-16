/**
 * api/relay-checkout — RETIRED.
 *
 * This route minted a real Stripe payment link with NO order record and NO shipping
 * address: a payment through it landed in the finance ledger with nothing to fulfil and
 * nowhere to ship. That money path is closed. Every method returns 410 Gone.
 *
 * The canonical Relay checkout is the storefront's own cart flow, which collects the
 * shipping address, writes the order record, revalidates the supplier against that
 * address and only then takes payment.
 *
 * The route stays REGISTERED so old clients get this answer instead of a 404 they might
 * retry. Nothing here touches Stripe, the finance bridge, the policy ledger or the
 * store: no payment link, no acceptance record, no revenue, no side effect.
 */

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  return sendJSON(res, 410, {
    ok: false,
    gone: true,
    error: 'this checkout has been retired',
    message: 'Please place your order through the Relay storefront checkout. Nothing has been charged.'
  });
};
