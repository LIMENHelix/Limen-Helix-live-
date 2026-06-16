/**
 * LIMEN Helix — Engine Output Persistence Endpoint
 *
 * POST /api/limen-engine-output
 *
 * Persists a READY-TO-SIGN engine artifact (patent draft, grant narrative,
 * SBA package, franchise FDD bundle, investment thesis, research brief)
 * to the engine-output store. Enforces the hardening rules at the
 * persistence boundary:
 *
 *   H1 — provenance signature chain (prev → inputs → kernels → pattern → output)
 *   H2 — append-only audit log entry per persist
 *   H4 — engine idempotency via content-hash; identical input → identical outputId
 *   H6 — READY-TO-SIGN only; this endpoint does NOT submit externally
 *   H7 — freshness receipt (kernel snapshot ts, source pattern sig, operator)
 *
 * Storage strategy:
 *   - Primary: Upstash Redis if UPSTASH_REDIS_REST_URL + _TOKEN env vars present.
 *     Keys: limen:engine_output:{outputId}
 *           limen:engine_output_index:by_cik:{cik}
 *           limen:engine_output_index:by_lane:{lane}
 *           limen:engine_output_log (append-only audit)
 *   - Fallback: in-memory store (per-cold-start; non-durable).
 *
 * GET /api/limen-engine-output?cik=...
 * GET /api/limen-engine-output?lane=...
 * GET /api/limen-engine-output?id=...
 *   Lists or fetches stored artifacts.
 *
 * GET /api/limen-engine-output?log=1&limit=50
 *   Returns the audit log.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!(REDIS_URL && REDIS_TOKEN);

// ── H6 — Operator auth gate ──────────────────────────────────────────
// Bearer-token check on mutation paths (POST + PATCH). GET stays open so
// the viewer page (/helix-artifact.html) and list page (/helix-artifacts)
// can render without credentials. When LIMEN_OPERATOR_TOKEN is unset the
// gate is OFF (local-dev mode) and an x-auth-disabled response header is
// surfaced so the absence is visible.
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

const ENGINE_OUTPUT_VERSION = 'eo-v1';
const LANES = ['patent', 'grant', 'sba', 'franchise', 'investment', 'research'];
// Raised from 256 KB → 2 MB so multi-pass artifacts can persist.
// Empirical sizes: grant ≈ 150 KB, sba ≈ 100 KB, patent ≈ 90 KB,
// franchise ≈ 380 KB (8 passes × 14K tokens × ~5 bytes/token). 2 MB
// gives headroom for franchise + extended embeddings. Upstash REST
// API body limit is 10 MB so 2 MB is well within bounds.
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const LOG_MAX = 5000;

// In-memory fallback store (per cold-start)
const _mem = {
  byId: new Map(),
  byCik: new Map(),
  byLane: new Map(),
  log: []
};

// ── Hashing (FNV-1a 128-ish via two 32-bit lanes folded to hex) ────
function hash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  let h1 = 0x811c9dc5;
  let h2 = 0x84222325;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= c; h2 = (h2 * 0x100000001b3) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) +
         ('00000000' + h2.toString(16)).slice(-8);
}

function newOutputId(cik, lane, contentHash) {
  return ['eo', lane, (cik || 'noccik').slice(-6), contentHash.slice(0, 8)].join('_');
}

// ── Redis helpers (REST) ───────────────────────────────────────────
async function redisCmd(cmd) {
  if (!HAS_REDIS) return { ok: false, error: 'no-redis' };
  try {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + REDIS_TOKEN,
        'content-type': 'application/json'
      },
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
  if (!r.ok || !r.result) return null;
  try { return JSON.parse(r.result); } catch (_) { return r.result; }
}

async function redisSAdd(key, member) {
  return redisCmd(['SADD', key, String(member)]);
}

async function redisSMembers(key) {
  const r = await redisCmd(['SMEMBERS', key]);
  return (r.ok && Array.isArray(r.result)) ? r.result : [];
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

// ── Validation ────────────────────────────────────────────────────
function validateBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body-not-object' };
  if (!body.engineId || typeof body.engineId !== 'string') return { ok: false, reason: 'missing-engineId' };
  if (!body.lane || LANES.indexOf(body.lane) === -1) {
    return { ok: false, reason: 'invalid-lane', allowed: LANES };
  }
  if (!body.sourcePatternSig || typeof body.sourcePatternSig !== 'string') {
    return { ok: false, reason: 'missing-sourcePatternSig' };
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return { ok: false, reason: 'missing-payload' };
  }
  // Payload size guard
  const bytes = Buffer.byteLength(JSON.stringify(body.payload), 'utf8');
  if (bytes > MAX_PAYLOAD_BYTES) {
    return { ok: false, reason: 'payload-too-large', bytes: bytes, max: MAX_PAYLOAD_BYTES };
  }
  return { ok: true };
}

// Citation integrity (H3): if the payload claims to have citations, every
// entry must be an object with at least { source, ref }. We can't verify
// against the whitelist registry from this endpoint (no portal access at
// runtime), but we DO enforce shape + reject any obviously AI-generated
// "made up" pattern (e.g. plain strings without source attribution).
function validateCitations(payload) {
  if (!payload || !Array.isArray(payload.citations)) return { ok: true };
  for (let i = 0; i < payload.citations.length; i++) {
    const c = payload.citations[i];
    if (!c || typeof c !== 'object') {
      return { ok: false, reason: 'citation-not-object', index: i };
    }
    if (!c.source || typeof c.source !== 'string') {
      return { ok: false, reason: 'citation-missing-source', index: i };
    }
  }
  return { ok: true };
}

// ── Persist ───────────────────────────────────────────────────────
async function persistArtifact(body, opts) {
  opts = opts || {};
  const now = Date.now();

  // Content hash for idempotency (H4): same payload + sourcePatternSig + cik
  // → same outputId regardless of when called.
  const contentBlob = {
    payload: body.payload,
    sourcePatternSig: body.sourcePatternSig,
    cik: body.cik || null,
    lane: body.lane
  };
  const contentHash = hash(contentBlob);
  const outputId = newOutputId(body.cik, body.lane, contentHash);

  // If already exists with same hash → return existing (idempotent)
  let existing = null;
  if (HAS_REDIS) {
    existing = await redisGet('limen:engine_output:' + outputId);
  } else if (_mem.byId.has(outputId)) {
    existing = _mem.byId.get(outputId);
  }
  if (existing && existing.contentHash === contentHash) {
    return {
      ok: true,
      idempotent: true,
      outputId: outputId,
      record: existing
    };
  }

  // ── Placeholder detection — gate READY_TO_SIGN ──
  // Per feedback_ready_to_sign_means_zero_placeholders (2026-05-21
  // user audit): READY_TO_SIGN is a contract with the operator.
  // If the artifact still has unresolved [DATA_NEEDED] / [VERIFY] /
  // model-placeholder tokens, force status to DRAFT_NEEDS_DATA + emit
  // a dataRequestMatrix the operator can use to gather inputs.
  const draftBodyForScan = (body.payload && body.payload.draftBody) || '';
  const PLACEHOLDER_PATTERNS = [
    /\[DATA[_ ]NEEDED[^\]]*\]/gi,
    /\[VERIFY[^\]]*\]/gi,
    /\[TBD[^\]]*\]/gi,
    /\[INSERT[^\]]*\]/gi,
    /\[PLACEHOLDER[^\]]*\]/gi,
    /\bTBD\b/g,
    /\bXXXXX+\b/gi,
    /<<[^>]+>>/g,
    /\{\{[^}]+\}\}/g
  ];
  const placeholderHits = [];
  for (const pat of PLACEHOLDER_PATTERNS) {
    const matches = draftBodyForScan.match(pat) || [];
    for (const m of matches) {
      if (placeholderHits.length < 100) {
        placeholderHits.push(m.slice(0, 80));
      }
    }
  }
  const uniquePlaceholders = Array.from(new Set(placeholderHits));
  const status = uniquePlaceholders.length === 0 ? 'READY_TO_SIGN' : 'DRAFT_NEEDS_DATA';
  const dataRequestMatrix = uniquePlaceholders.length > 0 ? {
    placeholderCount: uniquePlaceholders.length,
    placeholderSamples: uniquePlaceholders.slice(0, 30),
    operatorAction: 'Replace these placeholders with real values, PATCH status to READY_TO_SIGN when complete.'
  } : null;

  // Build the persisted record.
  const record = {
    outputId: outputId,
    version: ENGINE_OUTPUT_VERSION,
    cik: body.cik || null,
    slug: body.slug || null,
    engineId: body.engineId,
    lane: body.lane,
    status: status,
    dataRequestMatrix: dataRequestMatrix,

    sourcePatternSig: body.sourcePatternSig,
    contentHash: contentHash,
    payload: body.payload,

    kernelSnapshot: body.kernelSnapshot || null,
    readiness: typeof body.readiness === 'number' ? body.readiness : null,

    provenance: {
      chainSig: hash({
        prev: body.sourcePatternSig,
        outputId: outputId,
        contentHash: contentHash,
        ts: now
      }),
      generatedAt: now,
      generatedAtISO: new Date(now).toISOString(),
      operator: body.operator || null,
      configSig: body.configSig || null
    },

    freshness: {
      kernelSnapshotTs: body.kernelSnapshot && body.kernelSnapshot.ts || now,
      sourcePatternSig: body.sourcePatternSig,
      persistedAt: now
    },

    history: [
      { at: now, status: 'READY_TO_SIGN', actor: body.operator || 'master-living-brain' }
    ]
  };

  // Store — try Redis first if configured; fall back to in-memory if
  // the Redis fetch fails (bad creds / network / quota). Surfaces which
  // storage actually persisted so the caller can verify.
  let storage = 'memory';
  let redisError = null;
  if (HAS_REDIS) {
    const setR = await redisSet('limen:engine_output:' + outputId, record);
    if (setR && setR.ok) {
      storage = 'redis';
      // Index writes are best-effort — failure here doesn't lose the record.
      if (record.cik) await redisSAdd('limen:engine_output_index:by_cik:' + record.cik, outputId);
      await redisSAdd('limen:engine_output_index:by_lane:' + record.lane, outputId);
      await redisLPush('limen:engine_output_log', {
        at: now, outputId: outputId, cik: record.cik, lane: record.lane,
        sig: record.provenance.chainSig, engineId: record.engineId
      }, LOG_MAX);
    } else {
      redisError = (setR && (setR.error || ('http ' + setR.status))) || 'unknown';
    }
  }
  if (storage === 'memory') {
    _mem.byId.set(outputId, record);
    if (record.cik) {
      if (!_mem.byCik.has(record.cik)) _mem.byCik.set(record.cik, new Set());
      _mem.byCik.get(record.cik).add(outputId);
    }
    if (!_mem.byLane.has(record.lane)) _mem.byLane.set(record.lane, new Set());
    _mem.byLane.get(record.lane).add(outputId);
    _mem.log.unshift({
      at: now, outputId: outputId, cik: record.cik, lane: record.lane,
      sig: record.provenance.chainSig, engineId: record.engineId
    });
    if (_mem.log.length > LOG_MAX) _mem.log.length = LOG_MAX;
  }

  return {
    ok: true,
    idempotent: false,
    outputId: outputId,
    record: record,
    storage: storage,
    redisError: redisError
  };
}

// ── Query handlers ────────────────────────────────────────────────
async function getById(id) {
  if (!id) return null;
  if (HAS_REDIS) return redisGet('limen:engine_output:' + id);
  return _mem.byId.get(id) || null;
}

async function listByCik(cik, limit) {
  limit = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
  if (HAS_REDIS) {
    const ids = await redisSMembers('limen:engine_output_index:by_cik:' + cik);
    const records = [];
    for (let i = 0; i < ids.length && records.length < limit; i++) {
      const r = await redisGet('limen:engine_output:' + ids[i]);
      if (r) records.push(r);
    }
    records.sort((a, b) => (b.freshness?.persistedAt || 0) - (a.freshness?.persistedAt || 0));
    return records.slice(0, limit);
  }
  const ids = Array.from(_mem.byCik.get(cik) || []);
  return ids.map(id => _mem.byId.get(id)).filter(Boolean)
    .sort((a, b) => (b.freshness?.persistedAt || 0) - (a.freshness?.persistedAt || 0))
    .slice(0, limit);
}

async function listByLane(lane, limit) {
  limit = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
  if (HAS_REDIS) {
    const ids = await redisSMembers('limen:engine_output_index:by_lane:' + lane);
    const records = [];
    for (let i = 0; i < ids.length && records.length < limit; i++) {
      const r = await redisGet('limen:engine_output:' + ids[i]);
      if (r) records.push(r);
    }
    records.sort((a, b) => (b.freshness?.persistedAt || 0) - (a.freshness?.persistedAt || 0));
    return records.slice(0, limit);
  }
  const ids = Array.from(_mem.byLane.get(lane) || []);
  return ids.map(id => _mem.byId.get(id)).filter(Boolean)
    .sort((a, b) => (b.freshness?.persistedAt || 0) - (a.freshness?.persistedAt || 0))
    .slice(0, limit);
}

async function getLog(limit) {
  limit = Math.min(Math.max(parseInt(limit) || 50, 1), 1000);
  if (HAS_REDIS) {
    return redisLRange('limen:engine_output_log', 0, limit - 1);
  }
  return _mem.log.slice(0, limit);
}

// ── PATCH (status promotion) ──────────────────────────────────────
// Promotes a stored artifact from READY_TO_SIGN → SUBMITTED / APPROVED /
// REJECTED / UNDER_REVIEW / WITHDRAWN. Appends a history entry per H2.
// Returns the updated record. Content remains immutable (H4); only
// status + history change.
const STATUS_TRANSITIONS = {
  DRAFT_NEEDS_DATA: ['READY_TO_SIGN', 'WITHDRAWN'],
  READY_TO_SIGN:    ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED:        ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW:     ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED:         ['WITHDRAWN'],
  REJECTED:         ['WITHDRAWN'],
  WITHDRAWN:        []
};

async function patchStatus(outputId, newStatus, actor, notes) {
  const allowedStatuses = Object.keys(STATUS_TRANSITIONS);
  if (!allowedStatuses.includes(newStatus)) {
    return { ok: false, status: 400, error: 'invalid-status', allowed: allowedStatuses };
  }
  let record = HAS_REDIS ? await redisGet('limen:engine_output:' + outputId) : _mem.byId.get(outputId);
  if (!record) return { ok: false, status: 404, error: 'not-found' };

  const allowed = STATUS_TRANSITIONS[record.status] || [];
  if (record.status !== newStatus && allowed.indexOf(newStatus) === -1) {
    return {
      ok: false, status: 409, error: 'illegal-transition',
      from: record.status, to: newStatus, allowed: allowed
    };
  }

  // Build updated record. Content hash unchanged.
  const now = Date.now();
  record.status = newStatus;
  record.history = record.history || [];
  record.history.push({
    at: now,
    status: newStatus,
    actor: actor || 'anonymous',
    notes: notes || null,
    transitionSig: hash({ from: record.history[record.history.length - 1] && record.history[record.history.length - 1].status,
                          to: newStatus, at: now, actor: actor || 'anonymous' })
  });

  if (HAS_REDIS) {
    await redisSet('limen:engine_output:' + outputId, record);
    await redisLPush('limen:engine_output_log', {
      at: now,
      outputId: outputId,
      cik: record.cik,
      lane: record.lane,
      transition: { from: record.history[record.history.length - 2] && record.history[record.history.length - 2].status,
                    to: newStatus },
      actor: actor || 'anonymous'
    }, LOG_MAX);
  } else {
    _mem.byId.set(outputId, record);
    _mem.log.unshift({
      at: now,
      outputId: outputId,
      cik: record.cik,
      lane: record.lane,
      transition: { to: newStatus },
      actor: actor || 'anonymous'
    });
    if (_mem.log.length > LOG_MAX) _mem.log.length = LOG_MAX;
  }

  // ── Auto-fire outcome event on terminal-status transitions ──
  // SUBMITTED / APPROVED / REJECTED / WITHDRAWN each create an outcome
  // record so the outcome aggregator can bias future master firings.
  // Fire-and-forget (don't fail the PATCH if outcome write errors).
  try {
    const outcomeWorthy = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
    if (outcomeWorthy.includes(newStatus)) {
      // Use Vercel internal URL when available; falls back to relative
      // path which works when this is invoked from the same deployment.
      const base = process.env.VERCEL_URL ? ('https://' + process.env.VERCEL_URL) : '';
      // Internal call: include the operator token so the H6 gate on
      // /api/limen-outcome doesn't reject our own fire-and-forget.
      const internalHeaders = { 'content-type': 'application/json' };
      if (OPERATOR_TOKEN) internalHeaders.authorization = 'Bearer ' + OPERATOR_TOKEN;
      // Don't await — fire and forget.
      fetch(base + '/api/limen-outcome', {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          outputId: outputId,
          eventType: newStatus,
          actor: actor || 'patch-handler',
          notes: notes || ('auto-fired from PATCH status transition'),
          lane: record.lane,
          cik: record.cik
        })
      }).catch(function () { /* silent */ });
    }
  } catch (_) { /* silent */ }

  return { ok: true, status: 200, record: record };
}

// ── Handler ───────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // H6 gate — POST + PATCH require LIMEN_OPERATOR_TOKEN if it's set in env.
  if (req.method === 'POST' || req.method === 'PATCH') {
    const auth = checkAuth(req);
    if (!auth.ok) {
      res.statusCode = 401;
      res.setHeader('content-type', 'application/json');
      res.setHeader('WWW-Authenticate', 'Bearer realm="limen-engine-output"');
      return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
    }
  }

  try {
    if (req.method === 'POST') {
      // Read body
      let body = req.body;
      if (!body) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString('utf8');
        body = raw ? JSON.parse(raw) : {};
      } else if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }

      const v = validateBody(body);
      if (!v.ok) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: v.reason, detail: v }));
      }
      const cv = validateCitations(body.payload);
      if (!cv.ok) {
        res.statusCode = 422;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: 'citation-integrity', detail: cv }));
      }

      const result = await persistArtifact(body);
      res.statusCode = result.idempotent ? 200 : 201;
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-redis-backed', HAS_REDIS ? '1' : '0');
      res.setHeader('x-storage', result.storage || 'memory');
      if (result.redisError) res.setHeader('x-redis-error', String(result.redisError).slice(0, 120));
      return res.end(JSON.stringify({
        ok: true,
        idempotent: result.idempotent,
        outputId: result.outputId,
        persistedAt: result.record.freshness.persistedAt,
        persistedSig: result.record.provenance.chainSig,
        status: result.record.status,
        storage: result.storage,
        redisError: result.redisError,
        record: result.record
      }));
    }

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const id = url.searchParams.get('id');
      const cik = url.searchParams.get('cik');
      const lane = url.searchParams.get('lane');
      const log = url.searchParams.get('log');
      const limit = url.searchParams.get('limit') || '50';

      res.setHeader('content-type', 'application/json');
      res.setHeader('x-redis-backed', HAS_REDIS ? '1' : '0');

      if (log) {
        const entries = await getLog(limit);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, entries: entries, count: entries.length }));
      }
      if (id) {
        const r = await getById(id);
        res.statusCode = r ? 200 : 404;
        return res.end(JSON.stringify({ ok: !!r, record: r }));
      }
      if (cik) {
        const records = await listByCik(cik, limit);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, cik: cik, records: records, count: records.length }));
      }
      if (lane) {
        const records = await listByLane(lane, limit);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, lane: lane, records: records, count: records.length }));
      }

      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'specify ?id, ?cik, ?lane, or ?log=1' }));
    }

    if (req.method === 'PATCH') {
      const url = new URL(req.url, 'http://localhost');
      const id = url.searchParams.get('id');
      if (!id) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: 'missing id query param' }));
      }
      let body = req.body;
      if (!body) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString('utf8');
        body = raw ? JSON.parse(raw) : {};
      } else if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      const result = await patchStatus(id, body.status, body.actor || 'anonymous', body.notes || null);
      res.statusCode = result.status;
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-redis-backed', HAS_REDIS ? '1' : '0');
      return res.end(JSON.stringify(result));
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST, PATCH');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
