/**
 * api/limen-autoqueue.js — Fire-ready queue read endpoint
 *
 * GET /api/limen-autoqueue
 *   Returns the operator-facing fire-ready queue written by
 *   limen-worker-autoqueue. Each entry recommends an engine lane
 *   for a CIK based on its most recent phase transition.
 *
 *   Query params:
 *     limit       max entries (default 50, cap 200)
 *     status      filter to status (PENDING | FIRED | DISMISSED | EXPIRED)
 *     domain      filter to one domain
 *     lane        filter to one engine lane
 *     salience    filter to HIGH | MEDIUM | LOW
 *     min_score   minimum salienceScore [0..1]
 *
 *   No auth (read-only operator surface). State mutations (mark FIRED
 *   or DISMISSED) flow through PATCH /api/limen-autoqueue?cik=...&lane=...
 *   which IS auth-gated when LIMEN_OPERATOR_TOKEN is set.
 */

var db = require('./lib/limen-db');

var AUTOQUEUE_KEY = 'autoqueue';
var OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
var AUTH_ON = !!OPERATOR_TOKEN;

function checkAuth(req) {
  if (!AUTH_ON) return { ok: true };
  var header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return { ok: false, reason: 'missing-bearer' };
  var m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!m) return { ok: false, reason: 'malformed-bearer' };
  if (m[1] !== OPERATOR_TOKEN) return { ok: false, reason: 'token-mismatch' };
  return { ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === 'GET') {
      var url = new URL(req.url, 'http://localhost');
      var limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
      var status = url.searchParams.get('status');
      var domain = url.searchParams.get('domain');
      var lane = url.searchParams.get('lane');
      var salience = url.searchParams.get('salience');
      var minScore = parseFloat(url.searchParams.get('min_score') || '0') || 0;

      var queue = await db.get(AUTOQUEUE_KEY);
      if (!Array.isArray(queue)) queue = [];

      var filtered = queue;
      if (status) filtered = filtered.filter(function (q) { return q.status === status; });
      if (domain) filtered = filtered.filter(function (q) { return q.domain === domain; });
      if (lane) filtered = filtered.filter(function (q) { return q.recommendedLane === lane; });
      if (salience) filtered = filtered.filter(function (q) { return q.salience === salience.toUpperCase(); });
      if (minScore > 0) filtered = filtered.filter(function (q) { return (q.salienceScore || 0) >= minScore; });

      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'public, max-age=20');
      return res.end(JSON.stringify({
        ok: true,
        generatedAt: Date.now(),
        total: queue.length,
        returned: Math.min(filtered.length, limit),
        filters: { limit: limit, status: status, domain: domain, lane: lane, salience: salience, min_score: minScore },
        queue: filtered.slice(0, limit)
      }));
    }

    if (req.method === 'PATCH') {
      // Mark an entry as FIRED or DISMISSED (operator action).
      var auth = checkAuth(req);
      if (!auth.ok) {
        res.statusCode = 401;
        res.setHeader('content-type', 'application/json');
        res.setHeader('WWW-Authenticate', 'Bearer realm="limen-autoqueue"');
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
      }
      var body = req.body;
      if (!body) {
        var chunks = [];
        for await (var c of req) chunks.push(c);
        var raw = Buffer.concat(chunks).toString('utf8');
        body = raw ? JSON.parse(raw) : {};
      } else if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      var cik = body.cik;
      var lane2 = body.lane;
      var newStatus = String(body.status || '').toUpperCase();
      if (!cik || !lane2 || ['FIRED', 'DISMISSED', 'EXPIRED'].indexOf(newStatus) === -1) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: 'bad-request', expected: 'cik, lane, status (FIRED|DISMISSED|EXPIRED)' }));
      }
      var q2 = await db.get(AUTOQUEUE_KEY);
      if (!Array.isArray(q2)) q2 = [];
      var changed = 0;
      for (var i = 0; i < q2.length; i++) {
        if (q2[i].cik === cik && q2[i].recommendedLane === lane2 && q2[i].status === 'PENDING') {
          q2[i].status = newStatus;
          q2[i].actionedAt = Date.now();
          q2[i].actionedBy = body.actor || 'operator';
          changed++;
        }
      }
      await db.set(AUTOQUEUE_KEY, q2, 14 * 86400);
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: true, changed: changed, newStatus: newStatus }));
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'GET, PATCH');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
