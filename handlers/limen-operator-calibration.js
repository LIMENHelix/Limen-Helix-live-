/**
 * LIMEN HELIX — Operator Calibration + State Publish endpoint
 *
 *  POST /api/limen-operator-calibration
 *    Body (one of):
 *      { type: 'state_publish',  packet: humanStatePacket, ts }
 *      { type: 'self_report',    reportedAccurate: bool, packet, notes?, ts }
 *      { type: 'refusal_log',    verdict: contextGateVerdict, ts }
 *
 *  GET  /api/limen-operator-calibration?type=latest-state
 *    Returns the most recently published humanStatePacket. Used by
 *    server-side workers (autofire / multipass) to consult operator
 *    state before firing.
 *
 *  GET  /api/limen-operator-calibration?type=calibration-deltas
 *    Returns aggregated self-report accuracy per HUMAN_P* phase, with
 *    suggested threshold adjustments. Read by the client to tune the
 *    derived-state classifier over time.
 *
 *  GET  /api/limen-operator-calibration?type=audit&limit=50
 *    Returns recent calibration events (self_report + refusal_log).
 *
 *  POST is auth-gated via LIMEN_OPERATOR_TOKEN bearer.
 *  GET is open for dashboards but does NOT return raw packets to
 *  unauthenticated callers — falls back to coarse summary.
 *
 *  Storage: Upstash Redis when configured, in-process fallback otherwise.
 *  Memory fallback is per-Lambda-instance — fine for dev, not for prod
 *  cross-worker reads. Workers should treat null-from-GET as
 *  "no recent state" and proceed with default policy.
 *
 *  Per CLAUDE.md prime directive: this endpoint is for the SINGLE
 *  authenticated operator only. There is no multi-user model. Packets
 *  are NOT cross-correlated, NOT used for analytics, NOT exposed
 *  externally. Auth-gated POST + scoped Redis keys ensure single-
 *  operator scope.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!(REDIS_URL && REDIS_TOKEN);
const OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const AUTH_ON = !!OPERATOR_TOKEN;

const PACKET_TTL_SEC = 600;       // latest-state expires after 10min
const HISTORY_MAX = 1000;
const SELF_REPORT_MAX = 500;
const REFUSAL_LOG_MAX = 1000;

const HUMAN_PHASES = [
  'HUMAN_P0_BASELINE', 'HUMAN_P1_AROUSAL_RISE', 'HUMAN_P2_FOCUSED_FLOW',
  'HUMAN_P3_FRAGMENTATION', 'HUMAN_P4_OVERLOAD', 'HUMAN_P5_DEPLETION',
  'HUMAN_P6_RECOVERY', 'HUMAN_P7_REDLINE'
];

// ── In-memory fallback ──
const _mem = {
  latestPacket: null,
  packetHistory: [],
  selfReports: [],
  refusalLog: []
};

function checkAuth(req) {
  if (!AUTH_ON) return { ok: true, mode: 'disabled' };
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return { ok: false, reason: 'missing-bearer' };
  const m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!m) return { ok: false, reason: 'malformed-bearer' };
  if (m[1] !== OPERATOR_TOKEN) return { ok: false, reason: 'token-mismatch' };
  return { ok: true, mode: 'operator' };
}

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
    return { ok: false, error: String((e && e.message) || e) };
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
async function redisLPush(key, value, trimLen) {
  await redisCmd(['LPUSH', key, JSON.stringify(value)]);
  if (trimLen > 0) await redisCmd(['LTRIM', key, '0', String(trimLen - 1)]);
}
async function redisLRange(key, start, stop) {
  const r = await redisCmd(['LRANGE', key, String(start), String(stop)]);
  if (!r.ok || !Array.isArray(r.result)) return [];
  return r.result.map(s => { try { return JSON.parse(s); } catch (_) { return s; } });
}

// ── Handlers per event type ──
async function recordStatePublish(body) {
  if (!body || !body.packet || typeof body.packet !== 'object') {
    return { ok: false, status: 400, error: 'missing-packet' };
  }
  const record = {
    type: 'state_publish',
    ts: body.ts || Date.now(),
    packet: body.packet
  };
  let storage = 'memory';
  if (HAS_REDIS) {
    const r1 = await redisSet('limen:operator:latest_packet', record, PACKET_TTL_SEC);
    const r2 = redisLPush('limen:operator:packet_history', record, HISTORY_MAX);
    await r2;
    storage = (r1 && r1.ok) ? 'redis' : 'memory';
  }
  if (storage === 'memory') {
    _mem.latestPacket = record;
    _mem.packetHistory.unshift(record);
    if (_mem.packetHistory.length > HISTORY_MAX) _mem.packetHistory.length = HISTORY_MAX;
  }
  return { ok: true, status: 201, storage, type: 'state_publish' };
}

async function recordSelfReport(body) {
  if (typeof body.reportedAccurate !== 'boolean') {
    return { ok: false, status: 400, error: 'missing-reportedAccurate' };
  }
  if (!body.packet || !body.packet.phase) {
    return { ok: false, status: 400, error: 'missing-packet-phase' };
  }
  const record = {
    type: 'self_report',
    ts: body.ts || Date.now(),
    reportedAccurate: body.reportedAccurate,
    phase: body.packet.phase,
    confidence: body.packet.confidence || 0,
    derivedState: body.packet.derivedState || {},
    identityVersion: body.packet.identityVersion || null,
    notes: body.notes || null
  };
  let storage = 'memory';
  if (HAS_REDIS) {
    await redisLPush('limen:operator:self_reports', record, SELF_REPORT_MAX);
    // Increment phase accuracy counters
    const base = 'limen:operator:phase_accuracy:' + record.phase;
    await redisCmd(['INCR', base + ':' + (record.reportedAccurate ? 'accurate' : 'inaccurate')]);
    storage = 'redis';
  } else {
    _mem.selfReports.unshift(record);
    if (_mem.selfReports.length > SELF_REPORT_MAX) _mem.selfReports.length = SELF_REPORT_MAX;
  }
  return { ok: true, status: 201, storage, type: 'self_report', record };
}

async function recordRefusalLog(body) {
  if (!body.verdict || !body.verdict.reason) {
    return { ok: false, status: 400, error: 'missing-verdict' };
  }
  const record = {
    type: 'refusal_log',
    ts: body.ts || Date.now(),
    verdict: body.verdict
  };
  if (HAS_REDIS) {
    await redisLPush('limen:operator:refusal_log', record, REFUSAL_LOG_MAX);
    return { ok: true, status: 201, storage: 'redis', type: 'refusal_log' };
  }
  _mem.refusalLog.unshift(record);
  if (_mem.refusalLog.length > REFUSAL_LOG_MAX) _mem.refusalLog.length = REFUSAL_LOG_MAX;
  return { ok: true, status: 201, storage: 'memory', type: 'refusal_log' };
}

// ── GETs ──
async function getLatestState() {
  if (HAS_REDIS) {
    const r = await redisGet('limen:operator:latest_packet');
    return r;
  }
  return _mem.latestPacket;
}

async function getCalibrationDeltas() {
  const out = { byPhase: {}, suggestions: [], generatedAt: Date.now() };
  for (const phase of HUMAN_PHASES) {
    let accurate = 0, inaccurate = 0;
    if (HAS_REDIS) {
      const a = await redisCmd(['GET', 'limen:operator:phase_accuracy:' + phase + ':accurate']);
      const i = await redisCmd(['GET', 'limen:operator:phase_accuracy:' + phase + ':inaccurate']);
      accurate = parseInt((a && a.result) || '0', 10) || 0;
      inaccurate = parseInt((i && i.result) || '0', 10) || 0;
    } else {
      for (const r of _mem.selfReports) {
        if (r.phase !== phase) continue;
        if (r.reportedAccurate) accurate++; else inaccurate++;
      }
    }
    const total = accurate + inaccurate;
    const accuracyRate = total > 0 ? accurate / total : null;
    out.byPhase[phase] = { accurate, inaccurate, total, accuracyRate };

    // Suggestion: if accuracy < 0.5 with sample >= 10, recommend
    // tightening the classifier threshold for this phase (return delta
    // hint; the client decides whether to apply it).
    if (accuracyRate !== null && total >= 10 && accuracyRate < 0.5) {
      out.suggestions.push({
        phase,
        action: 'tighten_threshold',
        accuracyRate,
        sampleSize: total,
        note: 'Operator reports this phase classification is inaccurate >50% of the time. Consider narrowing the trigger conditions for this phase.'
      });
    } else if (accuracyRate !== null && total >= 20 && accuracyRate > 0.85) {
      out.suggestions.push({
        phase,
        action: 'thresholds_well_calibrated',
        accuracyRate,
        sampleSize: total,
        note: 'High operator-reported accuracy. No tuning required.'
      });
    }
  }
  return out;
}

async function getAudit(limit) {
  const lim = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
  if (HAS_REDIS) {
    const sr = await redisLRange('limen:operator:self_reports', 0, lim - 1);
    const rl = await redisLRange('limen:operator:refusal_log', 0, lim - 1);
    return { selfReports: sr, refusalLog: rl };
  }
  return {
    selfReports: _mem.selfReports.slice(0, lim),
    refusalLog: _mem.refusalLog.slice(0, lim)
  };
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

  try {
    if (req.method === 'POST') {
      const auth = checkAuth(req);
      if (!auth.ok) {
        res.statusCode = 401;
        res.setHeader('content-type', 'application/json');
        res.setHeader('WWW-Authenticate', 'Bearer realm="limen-operator-calibration"');
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
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

      let result;
      switch (body && body.type) {
        case 'state_publish':  result = await recordStatePublish(body); break;
        case 'self_report':    result = await recordSelfReport(body);   break;
        case 'refusal_log':    result = await recordRefusalLog(body);   break;
        default: result = { ok: false, status: 400, error: 'invalid-type', allowed: ['state_publish','self_report','refusal_log'] };
      }
      res.statusCode = result.status || 200;
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-redis-backed', HAS_REDIS ? '1' : '0');
      return res.end(JSON.stringify(result));
    }

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const type = url.searchParams.get('type') || 'latest-state';
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-redis-backed', HAS_REDIS ? '1' : '0');

      // For latest-state, require auth — packets contain biosensor signals
      // (mild, but not for the open web).
      if (type === 'latest-state') {
        const auth = checkAuth(req);
        if (!auth.ok) {
          // Return a coarse summary instead of refusing — dashboards can
          // still see liveness without raw signals.
          res.statusCode = 200;
          return res.end(JSON.stringify({ ok: true, mode: 'coarse', available: false }));
        }
        const latest = await getLatestState();
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, latest }));
      }

      if (type === 'calibration-deltas') {
        const deltas = await getCalibrationDeltas();
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, deltas }));
      }

      if (type === 'audit') {
        const auth = checkAuth(req);
        if (!auth.ok) {
          res.statusCode = 401;
          res.setHeader('WWW-Authenticate', 'Bearer realm="limen-operator-calibration"');
          return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
        }
        const audit = await getAudit(url.searchParams.get('limit'));
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, audit }));
      }

      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'invalid-type', allowed: ['latest-state','calibration-deltas','audit'] }));
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String((err && err.message) || err) }));
  }
};
