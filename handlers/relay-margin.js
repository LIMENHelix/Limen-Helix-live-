// CJ Sourced Finds only. Shopify has its own prices and supplier terms.
const crypto = require('node:crypto');
const pricing = require('../lib/relay-pricing-settings');
function send(res, code, value) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(value));
}
function authorized(pass) {
  if (typeof pass !== 'string' || !pass) return false;
  return [process.env.RELAY_MARGIN_KEY, process.env.RELAY_ADMIN_KEY,
    process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY].some(function (expected) {
    if (!expected) return false;
    const a = Buffer.from(pass), b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
async function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 8192) throw new Error('Request too large'); }
  return JSON.parse(raw || '{}');
}
module.exports = async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  const q = new URL(req.url, 'http://local').searchParams;
  if (method === 'GET' && q.has('set')) return send(res, 405, {ok:false,error:'Reload this page. Saving now requires an authenticated POST.'});
  if (method !== 'GET' && method !== 'POST') return send(res, 405, {ok:false,error:'Method not allowed'});
  try {
    if (method === 'GET') return send(res, 200, await pricing.current());
    const body = await bodyOf(req);
    if (!authorized(body.passcode)) return send(res, 403, {ok:false,error:'Enter your Relay admin key or LIMEN operator passcode.'});
    if (typeof body.margin !== 'number' || !Number.isFinite(body.margin) || body.margin < 0.05 || body.margin > 1.5) {
      return send(res, 400, {ok:false,error:'Markup must be between 5% and 150%.'});
    }
    if (body.action !== 'preview' && body.action !== 'save') return send(res, 400, {ok:false,error:'Unknown action'});
    return send(res, 200, await pricing.change(body.margin, body.reprice === true, body.action === 'save'));
  } catch (_) {
    return send(res, 503, {ok:false,error:'Pricing could not be confirmed. Reload before retrying; no success has been reported.'});
  }
};
