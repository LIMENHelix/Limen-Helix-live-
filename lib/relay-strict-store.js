/**
 * relay-strict-store.js — atomic read-modify-write for the three Relay keys whose values
 * are money state: the autonomy ledger and the store's listings/orders maps.
 *
 * WHY limen-db CANNOT DO THIS: db.get/db.set is a forgiving whole-blob GET → mutate → SET
 * with no compare-and-set, and it falls back to warm process memory on any Redis error.
 * Two lambdas reserving spend against the same ledger snapshot both commit, and the later
 * SET drops the earlier reservation — money authorised against a ceiling that no longer
 * exists. A money-critical mutation needs an atomic compare-and-replace, and it needs to
 * FAIL CLOSED when the store cannot provide one.
 *
 * THE CONTRACT
 *   read(key)            → parsed value or null. Throws when the store cannot answer.
 *   mutate(key, fn)      → bounded optimistic-concurrency loop. Each attempt re-reads,
 *                          hands fn the FRESH value, and commits only if nothing changed
 *                          underneath (Lua GET==expected → SET). fn returns
 *                          { write:true, value, result } to commit or { result } to
 *                          answer without writing. Resolves
 *                          { committed:true, wrote, result, attempts } or
 *                          { committed:false, conflict:true } when every attempt lost
 *                          the race — the caller decides, but for money that is a refusal.
 *
 * ONLY these physical keys are accepted; anything else throws:
 *   limen:relay:autonomy-ledger, limen:relay:store:listings, limen:relay:store:orders
 *
 * STORAGE MODES, same key and same JSON shapes in both, so existing data reads as-is:
 *   Redis configured (production): direct Upstash REST, GET + EVAL, strict errors. A
 *     transport or command failure THROWS — there is no process-memory fallback for a
 *     mutation, because that fallback is exactly how a lost update becomes a spent dollar.
 *   No Redis configured (local/test): delegates to limen-db's in-memory backend, which is
 *     where the rest of the suite's fixtures live, under a per-key mutex so the
 *     read-modify-write is still atomic within the process. Like
 *     relay-c2c-idempotency.js, this mode is not advertised as durable.
 *
 * Tests inject a fake with _setClient({ get, eval }) — GET/EVAL with async yield points
 * between them, so real interleavings can be produced without a server.
 */
const db = require('./limen-db');

const ALLOWED = {
  'limen:relay:autonomy-ledger': 'relay:autonomy-ledger',
  'limen:relay:store:listings': 'relay:store:listings',
  'limen:relay:store:orders': 'relay:store:orders'
};

// GET returns false for a missing key, which cannot ride in ARGV, so the expected value
// for "absent" is the empty string and the script normalises before comparing.
const CAS_SCRIPT =
  "local cur = redis.call('GET', KEYS[1]) " +
  "if cur == false then cur = '' end " +
  "if cur == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]) return 1 else return 0 end";

const TIMEOUT_MS = 5000;

let _client = null;   // injected test client; null means resolve from env

function _checkKey(key) {
  if (!ALLOWED[key]) throw new Error('relay-strict-store: key not allowed: ' + String(key));
}

function _redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Command-level strictness, same shape as relay-c2c-idempotency: any failure throws. */
async function _redis(args) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args),
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

async function _getRaw(key) {
  if (_client) return _client.get(key);
  return _redis(['GET', key]);
}

async function _casRaw(key, expectedRaw, newRaw) {
  const args = [CAS_SCRIPT, '1', key, expectedRaw == null ? '' : expectedRaw, newRaw];
  const res = _client ? await _client.eval(CAS_SCRIPT, [key], [expectedRaw == null ? '' : expectedRaw, newRaw])
                      : await _redis(['EVAL'].concat(args));
  return res === 1 || res === '1';
}

// ── local/test memory mode ──────────────────────────────────────────────────
// Per-key async mutex: in a single process this makes the whole read-modify-write
// atomic, which is all a per-lambda memory backend can ever promise.
const _locks = new Map();
function _withLock(key, fn) {
  const prev = _locks.get(key) || Promise.resolve();
  const next = prev.then(fn);
  _locks.set(key, next.catch(function () {}));
  return next;
}

function _parse(raw, key) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw;   // memory mode hands back objects
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('relay-strict-store: unparseable value at ' + key);
  }
}

async function read(key) {
  _checkKey(key);
  if (!_client && !_redisConfigured()) return db.get(ALLOWED[key]);
  return _parse(await _getRaw(key), key);
}

/**
 * mutate(key, fn, opts) — fn(current, { attempt }) may be async. It receives a value it
 * may freely mutate (a fresh parse in Redis mode, a deep copy in memory mode) and answers
 * { write:true, value, result } or { result } for a no-write outcome.
 */
async function mutate(key, fn, opts) {
  _checkKey(key);
  const attempts = Math.max(1, parseInt(opts && opts.attempts, 10) || 5);

  if (!_client && !_redisConfigured()) {
    return _withLock(key, async function () {
      for (let i = 0; i < attempts; i++) {
        const cur = await db.get(ALLOWED[key]);
        const copy = cur == null ? null : JSON.parse(JSON.stringify(cur));
        const out = await fn(copy, { attempt: i });
        if (!out || out.write !== true) {
          return { committed: true, wrote: false, result: out ? out.result : undefined, attempts: i + 1 };
        }
        await db.set(ALLOWED[key], out.value === undefined ? null : out.value);
        return { committed: true, wrote: true, result: out.result, attempts: i + 1 };
      }
      return { committed: false, conflict: true, result: null, attempts: attempts };
    });
  }

  for (let i = 0; i < attempts; i++) {
    const raw = await _getRaw(key);              // strict: an outage throws here
    const cur = _parse(raw, key);
    const out = await fn(cur, { attempt: i });
    if (!out || out.write !== true) {
      return { committed: true, wrote: false, result: out ? out.result : undefined, attempts: i + 1 };
    }
    const nextRaw = JSON.stringify(out.value === undefined ? null : out.value);
    if (nextRaw === (raw == null ? 'null' : raw)) {
      return { committed: true, wrote: false, result: out.result, attempts: i + 1 };
    }
    if (await _casRaw(key, raw, nextRaw)) {
      return { committed: true, wrote: true, result: out.result, attempts: i + 1 };
    }
  }
  return { committed: false, conflict: true, result: null, attempts: attempts };
}

function _setClient(client) { _client = client || null; }
function _resetClient() { _client = null; }

module.exports = {
  ALLOWED_KEYS: Object.keys(ALLOWED),
  CAS_SCRIPT,
  read,
  mutate,
  _setClient,
  _resetClient
};
