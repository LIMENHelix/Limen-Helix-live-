/**
 * api/brain-cognition.js — server-backed feed for the 20 domain brains' self-models.
 *
 * Each domain brain assembles state.cognition (immune/awareness/conscience/intuition + the
 * recurrent model) every cycle. The authenticated server cognition scheduler writes a
 * COMPACT projection here; the System Vitals page GETs the whole map so the self-models
 * render live and cross-device (no need to have the cockpit open in this browser).
 *
 *   POST /api/brain-cognition   body { domain, cognition, token } → privileged harness write. Token-gated.
 *   GET  /api/brain-cognition   → { ok, cognition: { domain: { c, ts } }, count }
 *
 * Storage: per-domain Redis keys 'limen:brain:cognition:<domain>' (mget on read) — avoids the
 * read-modify-write race when 20 domains POST concurrently. Low-sensitivity telemetry
 * (immune state / regulation / narrative — no PII, no leads). Guardrail: stores + serves a
 * readout only; nothing here acts, files, or contacts anyone.
 */
const { redisSet, redisGet, redisMGet } = require('../lib/redis-kv.js');
const businessStore = require('../lib/autofire-efference-store.js');
const businessTrace = require('../lib/product-domain-business-trace-readout.js');

const PREFIX = 'limen:brain:cognition:';
const TTL = 3 * 3600; // 3h — telemetry; expires if the brains stop running
const TOKEN = process.env.BRAIN_COGNITION_TOKEN || process.env.BIOSENSOR_TOKEN || '';   // no committed fallback: POST fails closed when unset

// canonical 20-domain order (energy reference first)
const DOMAINS = ['energy','infrastructure','culture','finance','economy','technology','defense','intelligence','trade','industry','environment','governance','agriculture','communication','medicine','education','population','science','law','religion'];

async function readMissingBusinessTrace(domain) {
  const now = Date.now(); let timer;
  try {
    return await Promise.race([businessTrace.read(businessStore, domain, now), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('business-trace-read-timeout')), 10000);
    })]);
  } catch (error) {
    return { schemaVersion: 'product-domain-business-trace-readout/1.0',
      ownerDomain: { medicine: 'health', science: 'research', trade: 'supplyChain' }[domain] || domain,
      readAt: now, observationOnly: true, externalActionAuthorized: false, status: 'UNAVAILABLE',
      reason: error && error.message === 'business-trace-read-timeout' ? error.message : 'business-trace-read-unavailable',
      decision: null, command: null };
  } finally { clearTimeout(timer); }
}

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
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-brain-token');
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  var m = (req.method || 'GET').toUpperCase();

  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (m === 'GET') {
    var keys = DOMAINS.map(function (d) { return PREFIX + d; });
    var vals = {};
    try { vals = await redisMGet(keys) || {}; } catch (e) { vals = {}; }
    var map = {}, count = 0, newest = 0;
    await Promise.all(DOMAINS.map(async function (domain) {
      var v = vals[PREFIX + domain];   // redisMGet returns { key: parsedValue }
      if (v && v.c) {
        map[domain] = v;
        count++; if (v.ts > newest) newest = v.ts;
        // An older scheduler snapshot may lack the already implemented owning
        // business readout. Read it without writing or renewing brain freshness.
        if (!v.c.businessTrace) map[domain] = Object.assign({}, v, {
          c: Object.assign({}, v.c, { businessTrace: await readMissingBusinessTrace(domain) })
        });
      }
    }));
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, cognition: map, count: count, newest: newest || null }));
  }

  if (m === 'POST') {
    var body = await readBody(req);
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var tok = req.headers['x-brain-token'] || (body && body.token);
    if (!TOKEN || tok !== TOKEN) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'unauthorized' })); }
    var domain = String(body && body.domain || '').toLowerCase();
    if (DOMAINS.indexOf(domain) < 0) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'unknown domain' })); }
    var cog = body && body.cognition;
    if (!cog || typeof cog !== 'object') { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'no cognition' })); }
    var entry = { c: cog, ts: Date.now() };
    var r = await redisSet(PREFIX + domain, entry, TTL);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, stored: !!(r && r.ok), domain: domain }));
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
};
