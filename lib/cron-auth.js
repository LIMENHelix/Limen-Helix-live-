'use strict';

/**
 * Fail-closed authentication for Vercel cron handlers.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
 * configured. User-Agent and x-vercel-* headers are not credentials and must
 * never authorize a state-changing worker.
 */
function authorize(req) {
  var secret = process.env.CRON_SECRET || '';
  if (!secret) return { ok: false, status: 503, reason: 'cron-secret-unconfigured' };

  var header = req && req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return { ok: false, status: 401, reason: 'missing-bearer' };
  if (String(header) !== 'Bearer ' + secret) {
    return { ok: false, status: 401, reason: 'token-mismatch' };
  }
  return { ok: true, status: 200, mode: 'cron-secret' };
}

function enforce(req, res) {
  var auth = authorize(req);
  if (auth.ok) return true;
  // Authentication rejection is not a job run and must not mutate even the
  // observability ledger. heartbeat.wrap() recognizes this marker.
  res._limenAuthRejected = true;
  res.statusCode = auth.status;
  res.setHeader('content-type', 'application/json');
  if (auth.status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="limen-cron"');
  res.end(JSON.stringify({ ok: false, error: 'cron-unauthorized', reason: auth.reason }));
  return false;
}

module.exports = { authorize: authorize, enforce: enforce };
