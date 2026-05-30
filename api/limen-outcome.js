/**
 * LIMEN Helix — Outcome Event Recorder + Aggregator
 *
 * POST /api/limen-outcome
 *   Records an outcome event for a persisted artifact and updates
 *   per-(lane, domain, cik) aggregate counters in Redis.
 *
 *   Body: {
 *     outputId,           // engine-output id (eo_<lane>_<cik>_<hash>)
 *     eventType,          // SUBMITTED | UNDER_REVIEW | APPROVED |
 *                         // REJECTED | WITHDRAWN | OUTCOME_REVENUE |
 *                         // OUTCOME_PATENT_ISSUED | OUTCOME_GRANT_AWARDED |
 *                         // OUTCOME_FRANCHISE_SIGNED
 *     actor,              // who recorded it (operator email / system)
 *     notes,              // optional free-text
 *     amount,             // optional USD amount for OUTCOME_* events
 *     externalRefId       // optional: USPTO app no., NOFO award id, etc.
 *   }
 *
 * GET /api/limen-outcome?byLane=1
 *   Returns aggregate efficacy per lane: { lane: { submitted, approved,
 *   rejected, withdrawn, approvalRate, sampleSize, dollarsRealized } }.
 *
 * GET /api/limen-outcome?byDomain=1
 *   Same shape, keyed by domainId derived from the artifact's source.
 *
 * GET /api/limen-outcome?cik=<cik>
 *   Per-CIK aggregate.
 *
 * GET /api/limen-outcome?outputId=<id>
 *   Event history for one specific artifact.
 *
 * GET /api/limen-outcome?log=1&limit=50
 *   Most recent outcome events globally.
 *
 * Same Redis-or-memory fallback pattern as /api/limen-engine-output.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!(REDIS_URL && REDIS_TOKEN);

// H6 — Operator auth gate (POST only; GET stays open for dashboards).
// Mirrors api/limen-engine-output.js.
const OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const AUTH_ON = !!OPERATOR_TOKEN;
function checkAuth(req) {
  if (!AUTH_ON) return { ok: true, mode: 'disabled' };
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return { ok: false, reason: 'missing-bearer' };
  const m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!m) return { ok: false, reason: 'malformed-bearer' };
  if (m[1] !== OPERATOR_TOKEN) return { ok: false, reason: 'token-mismatch' };
  return { ok: true, mode: 'operator' };
}

const EVENT_TYPES = new Set([
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN',
  'OUTCOME_REVENUE', 'OUTCOME_PATENT_ISSUED', 'OUTCOME_GRANT_AWARDED',
  'OUTCOME_FRANCHISE_SIGNED', 'OUTCOME_INVESTMENT_PNL',
  'OUTCOME_RESEARCH_PUBLISHED'
]);

// Which event types count as "approved" for approval-rate purposes
const APPROVED_TYPES = new Set(['APPROVED', 'OUTCOME_PATENT_ISSUED',
  'OUTCOME_GRANT_AWARDED', 'OUTCOME_FRANCHISE_SIGNED']);
const REJECTED_TYPES = new Set(['REJECTED', 'WITHDRAWN']);
const SUBMITTED_TYPES = new Set(['SUBMITTED', 'UNDER_REVIEW']);

const LOG_MAX = 5000;
const LANES = ['patent', 'grant', 'sba', 'franchise', 'investment', 'research'];

// In-memory fallback
const _mem = {
  events: [],                       // chronological log
  byOutputId: new Map(),            // outputId → [event]
  byLane: {},                       // lane → counters
  byDomain: {},                     // domain → counters
  byCik: new Map()                  // cik → counters
};
function _emptyCounters() {
  return {
    submitted: 0, underReview: 0, approved: 0, rejected: 0, withdrawn: 0,
    dollarsRealized: 0, eventCount: 0, lastEventAt: null
  };
}

// ── Hashing ──
function hash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  let h1 = 0x811c9dc5; let h2 = 0x84222325;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= c; h2 = (h2 * 0x100000001b3) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) +
         ('00000000' + h2.toString(16)).slice(-8);
}

// ── Redis helpers ──
async function redisCmd(cmd) {
  if (!HAS_REDIS) return { ok: false, error: 'no-redis' };
  try {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify(cmd)
    });
    const j = await r.json();
    return { ok: r.ok, status: r.status, result: j && j.result };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
async function redisSet(key, value, ttlSeconds) {
  const args = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds > 0) args.push('EX', String(ttlSeconds));
  return redisCmd(args);
}
async function redisGet(key) {
  const r = await redisCmd(['GET', key]);
  if (!r.ok || r.result === null || r.result === undefined) return null;
  try { return JSON.parse(r.result); } catch (_) { return r.result; }
}
async function redisIncrBy(key, by) {
  return redisCmd(['INCRBY', key, String(by)]);
}
async function redisLPush(key, value, trimLen) {
  await redisCmd(['LPUSH', key, JSON.stringify(value)]);
  if (trimLen > 0) await redisCmd(['LTRIM', key, '0', String(trimLen - 1)]);
}
async function redisLRange(key, start, stop) {
  const r = await redisCmd(['LRANGE', key, String(start), String(stop)]);
  if (!r.ok || !Array.isArray(r.result)) return [];
  return r.result.map(s => { try { return JSON.parse(s); } catch (_) { return s; } });
}

// ── Fetch the source artifact to learn its lane / domain / cik ──
// We need this to update the right aggregate buckets. Reads from
// /api/limen-engine-output via Redis directly (avoids HTTP self-call).
async function lookupArtifact(outputId) {
  if (!outputId) return null;
  if (HAS_REDIS) {
    return redisGet('limen:engine_output:' + outputId);
  }
  // memory-fallback can't cross-module reach the engine-output _mem map
  // (different Lambda instances). Return null and let the caller use
  // hints from the event body.
  return null;
}

function deriveBuckets(artifact, eventBody) {
  return {
    lane: (artifact && artifact.lane) || eventBody.lane || null,
    domain: (artifact && artifact.payload && artifact.payload.domain) ||
            (artifact && artifact.payload && artifact.payload.domainId) ||
            eventBody.domain || null,
    cik: (artifact && artifact.cik) || eventBody.cik || null
  };
}

// ── Record an outcome event ──
async function recordEvent(body) {
  const validation = validate(body);
  if (!validation.ok) return { ok: false, status: 400, error: validation.reason };

  const artifact = await lookupArtifact(body.outputId);
  const buckets = deriveBuckets(artifact, body);
  const now = Date.now();
  const event = {
    eventId: 'evt_' + hash({ outputId: body.outputId, type: body.eventType, ts: now }),
    outputId: body.outputId,
    eventType: body.eventType,
    actor: body.actor || 'anonymous',
    notes: body.notes || null,
    amount: typeof body.amount === 'number' ? body.amount : null,
    externalRefId: body.externalRefId || null,
    ts: now,
    tsISO: new Date(now).toISOString(),
    lane: buckets.lane,
    domain: buckets.domain,
    cik: buckets.cik
  };

  let storage = 'memory';
  let redisError = null;

  if (HAS_REDIS) {
    // 1. Append to event log per-artifact
    const r1 = await redisLPush('limen:outcome_events:' + body.outputId, event, 200);
    // 2. Append to global event log
    const r2 = await redisLPush('limen:outcome_events_log', event, LOG_MAX);
    // 3. Update aggregate counters (per lane / domain / cik)
    const counterUpdates = [];
    function bump(scope, key) {
      if (!scope || !key) return;
      const base = 'limen:outcome_agg:' + scope + ':' + key;
      if (SUBMITTED_TYPES.has(event.eventType)) counterUpdates.push(base + ':submitted');
      if (APPROVED_TYPES.has(event.eventType)) counterUpdates.push(base + ':approved');
      if (REJECTED_TYPES.has(event.eventType)) counterUpdates.push(base + ':rejected');
      counterUpdates.push(base + ':eventCount');
      if (event.amount && event.amount > 0) counterUpdates.push({ key: base + ':dollarsRealized', amount: event.amount });
    }
    bump('lane', buckets.lane);
    bump('domain', buckets.domain);
    bump('cik', buckets.cik);
    for (const u of counterUpdates) {
      if (typeof u === 'string') await redisIncrBy(u, 1);
      else await redisIncrBy(u.key, u.amount);
    }
    storage = (r1 && r1.ok && r2 && r2.ok) ? 'redis' : 'memory';
    if (storage === 'memory') redisError = (r1 && r1.error) || (r2 && r2.error) || 'unknown';
  }

  if (storage === 'memory') {
    _mem.events.unshift(event);
    if (_mem.events.length > LOG_MAX) _mem.events.length = LOG_MAX;
    if (!_mem.byOutputId.has(event.outputId)) _mem.byOutputId.set(event.outputId, []);
    _mem.byOutputId.get(event.outputId).unshift(event);
    function memBump(scope, key) {
      if (!key) return;
      const m = scope === 'lane' ? _mem.byLane : (scope === 'domain' ? _mem.byDomain : null);
      if (m) {
        m[key] = m[key] || _emptyCounters();
        if (SUBMITTED_TYPES.has(event.eventType)) m[key].submitted++;
        if (APPROVED_TYPES.has(event.eventType)) m[key].approved++;
        if (REJECTED_TYPES.has(event.eventType)) m[key].rejected++;
        m[key].eventCount++;
        m[key].lastEventAt = now;
        if (event.amount) m[key].dollarsRealized += event.amount;
      } else if (scope === 'cik') {
        if (!_mem.byCik.has(key)) _mem.byCik.set(key, _emptyCounters());
        const c = _mem.byCik.get(key);
        if (SUBMITTED_TYPES.has(event.eventType)) c.submitted++;
        if (APPROVED_TYPES.has(event.eventType)) c.approved++;
        if (REJECTED_TYPES.has(event.eventType)) c.rejected++;
        c.eventCount++;
        c.lastEventAt = now;
        if (event.amount) c.dollarsRealized += event.amount;
      }
    }
    memBump('lane', buckets.lane);
    memBump('domain', buckets.domain);
    memBump('cik', buckets.cik);
  }

  return {
    ok: true,
    status: storage === 'redis' ? 201 : 200,
    event: event,
    storage: storage,
    redisError: redisError
  };
}

// ── Read aggregates ──
async function getLaneAggregate() {
  const out = {};
  for (const lane of LANES) {
    out[lane] = await getCountersFor('lane', lane);
  }
  return out;
}
async function getDomainAggregate() {
  if (HAS_REDIS) {
    // Domain keys are dynamic; scan limen:outcome_agg:domain:* by lazy
    // querying known domains. For simplicity, return per-lane only via
    // GET ?byDomain=1&domain=<id>. Domains aren't enumerated server-side.
    return { _note: 'use ?domain=<id> for per-domain counters; full domain scan not implemented' };
  }
  const out = {};
  for (const k of Object.keys(_mem.byDomain)) out[k] = withRate(_mem.byDomain[k]);
  return out;
}
async function getCountersFor(scope, key) {
  if (HAS_REDIS) {
    const base = 'limen:outcome_agg:' + scope + ':' + key;
    const sub = await redisCmd(['GET', base + ':submitted']);
    const app = await redisCmd(['GET', base + ':approved']);
    const rej = await redisCmd(['GET', base + ':rejected']);
    const ec  = await redisCmd(['GET', base + ':eventCount']);
    const dol = await redisCmd(['GET', base + ':dollarsRealized']);
    const c = _emptyCounters();
    c.submitted = parseInt((sub && sub.result) || '0', 10) || 0;
    c.approved  = parseInt((app && app.result) || '0', 10) || 0;
    c.rejected  = parseInt((rej && rej.result) || '0', 10) || 0;
    c.eventCount = parseInt((ec && ec.result) || '0', 10) || 0;
    c.dollarsRealized = parseInt((dol && dol.result) || '0', 10) || 0;
    return withRate(c);
  }
  if (scope === 'lane' && _mem.byLane[key]) return withRate(_mem.byLane[key]);
  if (scope === 'domain' && _mem.byDomain[key]) return withRate(_mem.byDomain[key]);
  if (scope === 'cik' && _mem.byCik.has(key)) return withRate(_mem.byCik.get(key));
  return withRate(_emptyCounters());
}
function withRate(c) {
  const denom = (c.approved + c.rejected) || 0;
  return Object.assign({}, c, {
    approvalRate: denom > 0 ? c.approved / denom : null,
    sampleSize: denom,
    // Lane-efficacy multiplier for Master Brain readiness biasing.
    // Maps approvalRate ∈ [0,1] → [0.5, 1.5] linearly around 0.5.
    // Returns 1.0 (neutral) when sampleSize is 0.
    laneEfficacyMultiplier: denom > 0
      ? Math.max(0.5, Math.min(1.5, 0.5 + (c.approved / denom)))
      : 1.0
  });
}

async function getOutputEvents(outputId, limit) {
  if (HAS_REDIS) {
    return redisLRange('limen:outcome_events:' + outputId, 0, (limit || 50) - 1);
  }
  return (_mem.byOutputId.get(outputId) || []).slice(0, limit || 50);
}

async function getEventLog(limit) {
  if (HAS_REDIS) {
    return redisLRange('limen:outcome_events_log', 0, (limit || 50) - 1);
  }
  return _mem.events.slice(0, limit || 50);
}

// ── Validation ──
function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body-not-object' };
  if (!body.outputId) return { ok: false, reason: 'missing-outputId' };
  if (!body.eventType || !EVENT_TYPES.has(body.eventType)) {
    return { ok: false, reason: 'invalid-eventType', allowed: Array.from(EVENT_TYPES) };
  }
  return { ok: true };
}

// ── Handler ──
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === 'POST') {
    const auth = checkAuth(req);
    if (!auth.ok) {
      res.statusCode = 401;
      res.setHeader('content-type', 'application/json');
      res.setHeader('WWW-Authenticate', 'Bearer realm="limen-outcome"');
      return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
    }
  }

  try {
    if (req.method === 'POST') {
      let body = req.body;
      if (!body) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString('utf8');
        body = raw ? JSON.parse(raw) : {};
      } else if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      const result = await recordEvent(body);
      res.statusCode = result.status;
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-redis-backed', HAS_REDIS ? '1' : '0');
      res.setHeader('x-storage', result.storage || 'memory');
      if (result.redisError) res.setHeader('x-redis-error', String(result.redisError).slice(0, 120));
      return res.end(JSON.stringify(result));
    }

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-redis-backed', HAS_REDIS ? '1' : '0');

      if (url.searchParams.get('byLane') === '1') {
        const agg = await getLaneAggregate();
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, byLane: agg }));
      }
      if (url.searchParams.get('byDomain') === '1') {
        const agg = await getDomainAggregate();
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, byDomain: agg }));
      }
      const domain = url.searchParams.get('domain');
      if (domain) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, domain: domain, counters: await getCountersFor('domain', domain) }));
      }
      const cik = url.searchParams.get('cik');
      if (cik) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, cik: cik, counters: await getCountersFor('cik', cik) }));
      }
      const outputId = url.searchParams.get('outputId');
      if (outputId) {
        const events = await getOutputEvents(outputId, parseInt(url.searchParams.get('limit') || '50', 10));
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, outputId: outputId, events: events, count: events.length }));
      }
      if (url.searchParams.get('log') === '1') {
        const events = await getEventLog(parseInt(url.searchParams.get('limit') || '50', 10));
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, events: events, count: events.length }));
      }

      res.statusCode = 400;
      return res.end(JSON.stringify({
        ok: false,
        error: 'specify ?byLane=1 / ?byDomain=1 / ?domain=<id> / ?cik=<cik> / ?outputId=<id> / ?log=1'
      }));
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
