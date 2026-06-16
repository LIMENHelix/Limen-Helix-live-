/**
 * api/biosensor-state.js — bridge for the EXTERNAL biosensor tracker site.
 *
 * The operator's separate biosensor app (own repo, runs on localhost / its own host)
 * POSTs the human's live regulation state here; LIMEN pages GET it so the cockpit
 * reflects the operator. This is how the outside tracker "connects to" LIMEN.
 *
 *   POST /api/biosensor-state   body {hr,hrv,arousal,coherence,cognitiveLoad,valence,phase,token}
 *                               → stores the latest state in Redis (TTL 30s). Token-gated.
 *   GET  /api/biosensor-state   → { ok, state }  (LIMEN pages poll this)
 *
 * Storage: Upstash key 'limen:biosensor:state', TTL 30s (stale ⇒ "no signal").
 * SECURITY: light shared token on POST (BIOSENSOR_TOKEN env; fallback constant for local
 * testing). Data is HR/phase only (low-sensitivity). CORS open so the outside site can post.
 * Guardrail: stores + serves a readout only — nothing here acts, files, or contacts anyone.
 */
const { redisSet, redisGet } = require('../lib/redis-kv.js');

const KEY = 'limen:biosensor:state';
const TTL = 30;
const TOKEN = process.env.BIOSENSOR_TOKEN || 'limen-bio-209913';

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var d = '';
    req.on('data', function (c) { d += c; });
    req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-bio-token');
  res.setHeader('content-type', 'application/json');
  var m = (req.method || 'GET').toUpperCase();

  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (m === 'GET') {
    var state = await redisGet(KEY);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, state: state || null }));
  }

  if (m === 'POST') {
    var body = await readBody(req);
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var tok = req.headers['x-bio-token'] || (body && body.token);
    if (tok !== TOKEN) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'bad token' })); }
    var state = {
      ts: Date.now(),
      hr: Number(body.hr) || 0, hrv: Number(body.hrv) || 0,
      arousal: Number(body.arousal) || 0, coherence: Number(body.coherence) || 0,
      cognitiveLoad: Number(body.cognitiveLoad) || 0, valence: Number(body.valence) || 0,
      phase: (body.phase && typeof body.phase === 'object') ? body.phase : null
    };
    var r = await redisSet(KEY, state, TTL);
    res.statusCode = r && r.ok ? 200 : 200; // store best-effort; still ack
    return res.end(JSON.stringify({ ok: true, stored: !!(r && r.ok) }));
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
};
