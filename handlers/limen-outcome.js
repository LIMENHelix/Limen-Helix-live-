/**
 * LIMEN Helix — Outcome Event Recorder + Aggregator
 *
 * POST /api/limen-outcome
 *   Records an outcome event for a persisted artifact and updates
 *   per-(lane, domain, cik) aggregate counters in Redis.
 *
 *   Body: {
 *     outputId,           // engine-output id (eo_<lane>_<cik>_<hash>)
 *     commandId,          // optional reconciled Tradier B14 command id for investment P&L
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
 * A reconciled Tradier command may supply commandId instead of outputId for
 * OUTCOME_INVESTMENT_PNL. The caller must still provide the explicit paper
 * outcome terms; reconciliation supplies identity, not P&L or benchmark data.
 * Same Redis-or-memory fallback pattern as /api/limen-engine-output.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!(REDIS_URL && REDIS_TOKEN);

// H6 — Operator auth gate (POST only; GET stays open for dashboards).
// Mirrors api/limen-engine-output.js.
const OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const AUTH_ON = !!OPERATOR_TOKEN;
const LEARNING_TOKEN = OPERATOR_TOKEN || process.env.CRON_SECRET || '';
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
  'OUTCOME_RESEARCH_PUBLISHED', 'OUTCOME_RESEARCH_EVALUATED'
]);
const LEARNING_EVENT_TYPES = new Set([
  'OUTCOME_INVESTMENT_PNL', 'OUTCOME_RESEARCH_PUBLISHED', 'OUTCOME_RESEARCH_EVALUATED'
]);
const autofireLearning = require('../lib/autofire-learning');
const efferenceStore = require('../lib/autofire-efference-store');
const tradierB14 = require('../lib/tradier-b14');

// Which event types count as "approved" for approval-rate purposes
const APPROVED_TYPES = new Set(['APPROVED', 'OUTCOME_PATENT_ISSUED',
  'OUTCOME_GRANT_AWARDED', 'OUTCOME_FRANCHISE_SIGNED']);
const REJECTED_TYPES = new Set(['REJECTED', 'WITHDRAWN']);
const SUBMITTED_TYPES = new Set(['SUBMITTED', 'UNDER_REVIEW']);

const LOG_MAX = 5000;
const LANES = ['investment', 'research']; // patent/grant/sba/franchise lanes retired

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
  const pushed = await redisCmd(['LPUSH', key, JSON.stringify(value)]);
  if (trimLen > 0 && pushed && pushed.ok) {
    await redisCmd(['LTRIM', key, '0', String(trimLen - 1)]);
  }
  // recordEvent uses this receipt to distinguish durable Redis persistence
  // from the per-process memory fallback. Returning undefined made every
  // successful Redis write report storage:'memory' and duplicated it locally.
  return pushed;
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

async function lookupTradierCommand(commandId) {
  if (!commandId) return { command: null, error: null };
  try {
    return { command: await tradierB14.read(efferenceStore, commandId), error: null };
  } catch (err) {
    // A durable-store outage is not the same as an unknown command. Keep the
    // distinction visible so callers do not mistake an infrastructure failure
    // for a missing outcome identity.
    return { command: null, error: String(err && err.message || err) };
  }
}

function deriveBuckets(artifact, eventBody, command) {
  const intent = command && command.intent || {};
  return {
    lane: (artifact && artifact.lane) || eventBody.lane || (intent.ownerDomain === 'finance' ? 'investment' : null),
    domain: (artifact && artifact.payload && artifact.payload.domain) ||
            (artifact && artifact.payload && artifact.payload.domainId) ||
            eventBody.domain || intent.ownerDomain || null,
    cik: (artifact && artifact.cik) || eventBody.cik || null
  };
}

// ── Record an outcome event ──
async function recordEvent(body) {
  const validation = validate(body);
  if (!validation.ok) return { ok: false, status: 400, error: validation.reason };

  const commandId = body.commandId ? String(body.commandId) : null;
  const commandLookup = await lookupTradierCommand(commandId);
  if (commandLookup.error) {
    return { ok: false, status: 503, error: 'tradier-command-lookup-failed', detail: commandLookup.error };
  }
  const command = commandLookup.command;
  if (commandId && !command) return { ok: false, status: 404, error: 'tradier-command-not-found' };
  if (commandId && body.eventType !== 'OUTCOME_INVESTMENT_PNL') {
    return { ok: false, status: 400, error: 'tradier-command-outcome-must-be-investment-pnl' };
  }
  if (commandId && (!command.receipt || !command.receipt.orderId ||
      !/^RECONCILED_/.test(String(command.status || '')) || !command.reafference)) {
    return { ok: false, status: 409, error: 'tradier-command-not-reconciled' };
  }
  const outputId = body.outputId || (commandId ? 'tradier-command:' + commandId : null);
  const artifact = await lookupArtifact(outputId);
  const buckets = deriveBuckets(artifact, body, command);
  const commandIntent = command && command.intent || {};
  const outcomeData = body.outcomeData && typeof body.outcomeData === 'object'
    ? JSON.parse(JSON.stringify(body.outcomeData)) : null;
  // Autonomous observers retry on a cron cadence. A source observation id is
  // the idempotency key; do not append the same receipt or teach it twice.
  if (HAS_REDIS && body.observationId) {
    const prior = await redisLRange('limen:outcome_events:' + outputId, 0, LOG_MAX - 1);
    const duplicate = prior.find(function (item) {
      return item && item.observationId === String(body.observationId);
    });
    if (duplicate) return { ok: true, status: 200, duplicate: true, event: duplicate, storage: 'redis' };
  }
  if (commandId && outcomeData) {
    if (outcomeData.executionMode !== 'paper') {
      return { ok: false, status: 400, error: 'tradier-command-outcome-must-be-paper' };
    }
    if (outcomeData.brokerOrderId && String(outcomeData.brokerOrderId) !== String(command.receipt.orderId)) {
      return { ok: false, status: 400, error: 'broker-order-id-does-not-match-tradier-command' };
    }
    outcomeData.brokerOrderId = String(command.receipt.orderId);
  }
  const now = Date.now();
  const observedMs = body.observedAt && Number.isFinite(Date.parse(String(body.observedAt)))
    ? Date.parse(String(body.observedAt)) : null;
  const event = {
    schemaVersion: body.schemaVersion || null,
    // Observer retries use observationId to get a stable identity. Legacy
    // manual posts retain their time-based identity because they have no
    // source observation identity.
    eventId: 'evt_' + hash({
      outputId: outputId,
      commandId: commandId,
      type: body.eventType,
      observationId: body.observationId || null,
      ts: body.observationId ? (body.observedAt || null) : now
    }),
    outputId: outputId,
    commandId: commandId,
    eventType: body.eventType,
    actor: body.actor || 'anonymous',
    notes: body.notes || null,
    amount: typeof body.amount === 'number' ? body.amount : null,
    externalRefId: body.externalRefId || null,
    ts: observedMs === null ? now : observedMs,
    tsISO: new Date(observedMs === null ? now : observedMs).toISOString(),
    observationId: body.observationId || null,
    observedAt: body.observedAt || null,
    lane: buckets.lane,
    domain: buckets.domain,
    cik: buckets.cik,
    // Carries command identity across the later reward/outcome path without
    // conflating the two learning signals. Artifact persistence is B14's
    // supervised self-effect observation; submission/publication/P&L here is a
    // later outcome and may teach reward, never rewrite the efference copy.
    efferenceCopyId: (artifact && artifact.payload && artifact.payload.autofire &&
      artifact.payload.autofire.efferenceCopyId) || body.efferenceCopyId || null,
    actionId: (artifact && artifact.payload && artifact.payload.autofire &&
      artifact.payload.autofire.actionId) || body.actionId || commandIntent.actionId || null,
    ownerDomain: (artifact && artifact.payload && artifact.payload.autofire &&
      artifact.payload.autofire.ownerDomain) || body.ownerDomain || commandIntent.ownerDomain || null,
    selectionId: commandIntent.selectionId || body.selectionId || null,
    sourceArtifactId: commandIntent.sourceArtifactId || body.sourceArtifactId || null,
    /* Raw, named terms are preserved. Learning derives only the explicit
       categorical rule in lib/autofire-learning; no opaque composite score is
       stored or accepted here. */
    outcomeData: outcomeData
  };

  let storage = 'memory';
  let redisError = null;

  if (HAS_REDIS) {
    // 1. Append to event log per-artifact
    const r1 = await redisLPush('limen:outcome_events:' + outputId, event, 200);
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
  if (!body.eventType || !EVENT_TYPES.has(body.eventType)) {
    return { ok: false, reason: 'invalid-eventType', allowed: Array.from(EVENT_TYPES) };
  }
  if (!body.outputId && !body.commandId) return { ok: false, reason: 'missing-outputId-or-commandId' };
  return { ok: true };
}

// ── Handler ──
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  res.setHeader('x-learning-auth-mode', LEARNING_TOKEN ? 'enforced' : 'fail-closed');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
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
      /* Legacy outcome POSTs retain their existing optional operator gate. The
         three events allowed to teach B10/B12/B13 fail closed and use the
         already-configured CRON_SECRET when no separate operator token exists.
         A public page must never be able to write reward into the brain. */
      if (LEARNING_EVENT_TYPES.has(body && body.eventType)) {
        if (!LEARNING_TOKEN) {
          res.statusCode = 503;
          res.setHeader('content-type', 'application/json');
          return res.end(JSON.stringify({ ok: false, error: 'learning-outcome-auth-not-configured' }));
        }
        const learningHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
        const learningMatch = /^Bearer\s+(.+)$/i.exec(String(learningHeader || '').trim());
        if (!learningMatch || learningMatch[1] !== LEARNING_TOKEN) {
          res.statusCode = 401;
          res.setHeader('content-type', 'application/json');
          return res.end(JSON.stringify({ ok: false, error: 'unauthorized-learning-outcome' }));
        }
      }
      const auth = checkAuth(req);
      if (!auth.ok) {
        res.statusCode = 401;
        res.setHeader('content-type', 'application/json');
        res.setHeader('WWW-Authenticate', 'Bearer realm="limen-outcome"');
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
      }
      const result = await recordEvent(body);
      if (result.ok && result.event &&
          ['OUTCOME_INVESTMENT_PNL', 'OUTCOME_RESEARCH_PUBLISHED', 'OUTCOME_RESEARCH_EVALUATED'].indexOf(result.event.eventType) >= 0) {
        result.learning = await autofireLearning.recordOutcome(efferenceStore, result.event);
        result.learningAccepted = result.learning.ok === true || result.learning.queuedForRetry === true;
        if (!result.learningAccepted) result.status = 503;
        else if (!result.learning.ok) result.status = 202;
      }
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

// Internal cron observers use the same durable event and learning path as the
// authenticated endpoint. This is intentionally not reachable through HTTP;
// the handler remains the only public boundary.
module.exports.recordAutonomousOutcome = async function recordAutonomousOutcome(event) {
  if (!event || typeof event !== 'object') return { ok: false, status: 400, error: 'event-not-object' };
  const body = {
    outputId: event.outputId,
    commandId: event.commandId,
    actionId: event.actionId,
    eventType: event.eventType,
    lane: event.lane,
    ownerDomain: event.ownerDomain,
    observationId: event.observationId,
    observedAt: event.observedAt,
    schemaVersion: event.schemaVersion,
    outcomeData: event.outcomeData,
    sourceIdentity: event.sourceIdentity
  };
  const result = await recordEvent(body);
  if (result.ok && result.event && LEARNING_EVENT_TYPES.has(result.event.eventType)) {
    result.learning = await autofireLearning.recordOutcome(efferenceStore, result.event);
    result.learningAccepted = result.learning.ok === true || result.learning.queuedForRetry === true;
    if (!result.learningAccepted) result.status = 503;
    else if (!result.learning.ok) result.status = 202;
  }
  return result;
};
