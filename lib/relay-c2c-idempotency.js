/**
 * relay-c2c-idempotency.js — durable one-shot guards for C2C money/auth actions.
 *
 * Redis is used directly for SET NX because limen-db intentionally exposes only forgiving
 * GET/SET helpers. A checkout guard that silently falls back to warm process memory during
 * a Redis outage is not a guard: two lambdas can both charge. When Redis is configured,
 * transport/command failures throw and callers fail closed before an external side effect.
 *
 * With no Redis configured (local/test), a process-memory implementation keeps the same
 * contract. That mode is not advertised as durable production idempotency.
 */
const crypto = require('node:crypto');

const MEM = new Map();
const PREFIX = 'limen:relay:c2c:idempotency:';

function _redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function _hash(v) {
  return crypto.createHash('sha256').update(String(v || ''), 'utf8').digest('hex');
}

function _key(scope, idempotencyKey) {
  const s = String(scope || 'default').replace(/[^a-z0-9:_-]/gi, '').slice(0, 48) || 'default';
  return PREFIX + s + ':' + _hash(idempotencyKey).slice(0, 48);
}

async function _redis(method, args) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 5000);
  try {
    const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([method].concat(args || [])),
      signal: controller.signal
    });
    if (!r.ok) throw new Error('redis-http-' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error('redis-command-error: ' + String(j.error).slice(0, 160));
    return j ? j.result : null;
  } finally {
    clearTimeout(timer);
  }
}

function _memGet(k) {
  const row = MEM.get(k);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) { MEM.delete(k); return null; }
  return row.value;
}

function _memSet(k, value, ttlSeconds, nx) {
  if (nx && _memGet(k)) return false;
  MEM.set(k, { value: value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  return true;
}

async function read(scope, idempotencyKey) {
  if (!idempotencyKey) return null;
  const k = _key(scope, idempotencyKey);
  if (!_redisConfigured()) return _memGet(k);
  const raw = await _redis('GET', [k]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { throw new Error('idempotency-record-unparseable'); }
}

/**
 * Claim an idempotency key before side effects.
 * Returns {claimed:true} exactly once; duplicates receive the existing record.
 */
async function claim(scope, idempotencyKey, ttlSeconds) {
  if (!idempotencyKey) throw new Error('idempotency key required');
  const ttl = Math.max(60, parseInt(ttlSeconds, 10) || 900);
  const k = _key(scope, idempotencyKey);
  const row = { state: 'processing', startedAt: new Date().toISOString() };

  if (!_redisConfigured()) {
    const won = _memSet(k, row, ttl, true);
    return won ? { claimed: true, record: row } : { claimed: false, record: _memGet(k) };
  }

  const won = await _redis('SET', [k, JSON.stringify(row), 'NX', 'EX', String(ttl)]);
  if (won === 'OK') return { claimed: true, record: row };
  return { claimed: false, record: await read(scope, idempotencyKey) };
}

async function complete(scope, idempotencyKey, result, ttlSeconds) {
  if (!idempotencyKey) throw new Error('idempotency key required');
  const ttl = Math.max(300, parseInt(ttlSeconds, 10) || 86400);
  const k = _key(scope, idempotencyKey);
  const row = {
    state: 'complete',
    completedAt: new Date().toISOString(),
    result: result == null ? null : result
  };
  if (!_redisConfigured()) { _memSet(k, row, ttl, false); return row; }
  await _redis('SET', [k, JSON.stringify(row), 'EX', String(ttl)]);
  return row;
}

async function release(scope, idempotencyKey) {
  if (!idempotencyKey) return;
  const k = _key(scope, idempotencyKey);
  if (!_redisConfigured()) { MEM.delete(k); return; }
  await _redis('DEL', [k]);
}

module.exports = { claim, complete, release, read, _key };
