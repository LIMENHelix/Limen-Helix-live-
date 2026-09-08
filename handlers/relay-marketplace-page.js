/**
 * Legacy Relay demand-search page.
 *
 * Relay now has exactly two public customer products:
 *   /relay                  Relay Supply (B2C/B2B sourcing)
 *   /marketplace-storefront Relay Marketplace (C2C)
 *
 * This old third storefront overlapped Relay Supply and exposed a separate paid-image
 * path. Keep the historical endpoint stable by redirecting it to the canonical Supply
 * front instead of serving another checkout implementation.
 */
module.exports = async function handler(req, res) {
  if ((req.method || 'GET') !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
  }
  res.statusCode = 308;
  res.setHeader('Location', '/relay');
  res.setHeader('Cache-Control', 'no-store');
  res.end('Redirecting to Relay Supply');
};
