'use strict';

var crypto = require('node:crypto');

function header(req, name) {
  var value = req && req.headers && (req.headers[name] || req.headers[name.toLowerCase()]);
  return Array.isArray(value) ? value[0] : value;
}
function same(a, b) {
  var left = Buffer.from(String(a || ''), 'utf8');
  var right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}
function authorize(req, env) {
  env = env || process.env;
  var expected = env.MEDIA_WORKER_TOKEN || '';
  if (!expected) return { ok: false, status: 503, reason: 'media-worker-token-unconfigured' };
  var supplied = header(req, 'x-limen-media-worker');
  if (!supplied) return { ok: false, status: 401, reason: 'media-worker-token-missing' };
  if (!same(supplied, expected)) return { ok: false, status: 401, reason: 'media-worker-token-mismatch' };
  var workerId = String(header(req, 'x-limen-worker-id') || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(workerId)) {
    return { ok: false, status: 400, reason: 'media-worker-id-invalid' };
  }
  return { ok: true, status: 200, workerId: workerId };
}
function enforce(req, res, env) {
  var result = authorize(req, env);
  if (result.ok) return result;
  res._limenAuthRejected = true; res.statusCode = result.status;
  res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({ ok: false, error: 'media-worker-unauthorized', reason: result.reason }));
  return null;
}

module.exports = { authorize: authorize, enforce: enforce, same: same };
