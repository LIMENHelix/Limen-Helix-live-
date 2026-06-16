/**
 * api/limen-self-pulse.js — Manual enqueue for any CIK + lane
 *
 * Lets the operator (or LIMEN itself, when self-bootstrapping its
 * own patent/grant/SBA artifacts) inject an entry into the autoqueue
 * without waiting for a natural phase transition. The multi-pass +
 * single-call autofire workers pick it up on their next cron tick
 * and generate the artifact as READY_TO_SIGN.
 *
 * POST /api/limen-self-pulse
 *   { cik, lane, salience, [from], [to], [direction], [note] }
 *
 *   Auth-gated when LIMEN_OPERATOR_TOKEN is set in env.
 *
 *   Lane must be one of: investment | research
 *   Salience defaults to HIGH (so autofire picks it up).
 *   from/to phases default to 'n/a' since this isn't from a transition.
 *
 *   Returns the queued entry + current queue size.
 *
 * GET /api/limen-self-pulse
 *   Returns examples + auth state.
 */

var db = require('../lib/limen-db');

var AUTOQUEUE_KEY = 'autoqueue';
var AUTOQUEUE_TTL = 14 * 86400;
var AUTOQUEUE_MAX = 200;

var OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
var AUTH_ON = !!OPERATOR_TOKEN;

var VALID_LANES = ['investment', 'research']; // patent/grant/sba/franchise lanes retired
var VALID_SALIENCE = ['HIGH', 'MEDIUM', 'LOW'];

function checkAuth(req) {
  if (!AUTH_ON) return { ok: true };
  var h = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!h) return { ok: false, reason: 'missing-bearer' };
  var m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) return { ok: false, reason: 'malformed-bearer' };
  if (m[1] !== OPERATOR_TOKEN) return { ok: false, reason: 'token-mismatch' };
  return { ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: true,
      endpoint: '/api/limen-self-pulse',
      description: 'Inject an autoqueue entry to trigger autofire without waiting for a phase transition.',
      method: 'POST',
      body: { cik: '0000000999', lane: 'investment | research', salience: 'HIGH', from: '(optional)', to: '(optional)', note: '(optional)' },
      validLanes: VALID_LANES,
      validSalience: VALID_SALIENCE,
      authMode: AUTH_ON ? 'enforced' : 'disabled'
    }));
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
  }

  // Auth
  var auth = checkAuth(req);
  if (!auth.ok) {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json');
    res.setHeader('WWW-Authenticate', 'Bearer realm="limen-self-pulse"');
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
  }

  // Body parse
  var body = req.body;
  if (!body) {
    var chunks = [];
    for await (var c of req) chunks.push(c);
    var raw = Buffer.concat(chunks).toString('utf8');
    try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = {}; }
  } else if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  var cik = String(body.cik || '').replace(/^0+/, '') || null;
  var lane = String(body.lane || '').toLowerCase();
  var salience = String(body.salience || 'HIGH').toUpperCase();

  if (!cik) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'missing cik' }));
  }
  if (VALID_LANES.indexOf(lane) === -1) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'invalid lane', validLanes: VALID_LANES }));
  }
  if (VALID_SALIENCE.indexOf(salience) === -1) salience = 'HIGH';

  var entry = {
    queuedAt: Date.now(),
    cik: cik,
    ticker: body.ticker || null,
    entity_name: body.entity_name || null,
    domain: body.domain || null,
    from: body.from || 'n/a',
    to: body.to || 'n/a',
    direction: body.direction || 'manual',
    magnitude: 0,
    recommendedLane: lane,
    salience: salience,
    salienceScore: salience === 'HIGH' ? 0.85 : salience === 'MEDIUM' ? 0.5 : 0.2,
    source: 'self-pulse',
    sourceNote: body.note || null,
    status: 'PENDING'
  };

  var queue = await db.get(AUTOQUEUE_KEY);
  if (!Array.isArray(queue)) queue = [];

  // Don't add if there's already a PENDING entry for this (cik, lane)
  var dup = queue.find(function (q) {
    return q.cik === cik && q.recommendedLane === lane && q.status === 'PENDING';
  });
  if (dup) {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: true, alreadyPending: true, entry: dup, queueSize: queue.length
    }));
  }

  // ── Force override ──
  // If body.force=true and there's a FIRED entry for this (cik, lane),
  // also clear the per-(cik, lane) autofire dedupe key so the next
  // multipass / single-call tick can re-fire. Use when an earlier
  // fire was mis-routed (wrong stage template) and the operator wants
  // a fresh artifact before the natural 24h dedupe expires.
  if (body.force === true) {
    var clearedDedupe = [];
    // Both worker classes share the same prefix
    var keyA = 'autofire_cik_lane_dedupe_' + cik + '_' + lane;
    try { await db.set(keyA, null, 1); clearedDedupe.push(keyA); } catch (_) {}
    // Mark any existing FIRED entries as DISMISSED so they don't
    // confuse the operator (the actual artifact stays in engine-output;
    // only the autoqueue tracking entry transitions)
    var nFired = 0;
    for (var qi = 0; qi < queue.length; qi++) {
      if (queue[qi].cik === cik && queue[qi].recommendedLane === lane && queue[qi].status === 'FIRED') {
        queue[qi].status = 'DISMISSED';
        queue[qi].actionedAt = Date.now();
        queue[qi].actionedBy = 'self-pulse-force';
        queue[qi].dismissReason = 'force-rerun-by-operator';
        nFired++;
      }
    }
    entry.forceRerun = true;
    entry.forceRerunClearedKeys = clearedDedupe;
    entry.forceRerunDismissedPriorFired = nFired;
  }

  queue.unshift(entry);
  if (queue.length > AUTOQUEUE_MAX) queue = queue.slice(0, AUTOQUEUE_MAX);
  await db.set(AUTOQUEUE_KEY, queue, AUTOQUEUE_TTL);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  return res.end(JSON.stringify({
    ok: true, enqueued: entry, queueSize: queue.length
  }));
};
