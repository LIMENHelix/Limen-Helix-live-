'use strict';

/**
 * stripe-income-book.js — one Stripe charge, one income entry, durable everywhere.
 *
 * THE SINGLE WRITER for Stripe-sourced income into finance:ledger, and the claim
 * authority every other Stripe booking (sales:agg cash, handled-event dedup) must
 * pass through. Two layers of dedup, both atomic SET NX claims in Redis:
 *
 *   limen:stripe:handled:v1:<eventId>        30-day TTL — webhook redelivery of the
 *                                            SAME event id replays nothing.
 *   limen:stripe:charge-booked:<chargeKey>   90-day TTL — a second event TYPE about
 *                                            the same charge (checkout.session.completed
 *                                            then payment_intent.succeeded) books nothing.
 *   limen:stripe:charge-booked:sales-agg:<key>  90-day TTL — the same claim for the
 *                                            sales aggregate, which is a different book.
 *
 * FAIL CLOSED. When Redis is configured, any storage failure THROWS. The caller's
 * 500 makes Stripe retry, which is safe; writing on an unreadable claim store is how
 * a charge gets booked twice. With no Redis configured (local/test), process memory
 * keeps the same contract but is not advertised as durable.
 *
 * BACKWARD COMPATIBILITY. Entries written by the old non-idempotent code carry
 * meta.id set to the Stripe object id and no claim key. Before writing, the ledger
 * itself is scanned for those ids, so a redelivery of something booked before this
 * module existed is recognised as a duplicate instead of booked again.
 *
 * C2C EXCLUSION. Relay Marketplace payments (metadata.orderId + metadata.marketplace)
 * settle through handlers/relay-stripe-webhook.js, which books commission + franchise
 * fee. Booking the gross here as well counted the same sale twice, so the generic
 * booker refuses C2C events with a named reason.
 */
var db = require('./limen-db');
var ledger = require('./finance-ledger');

var MEM = new Map();
var HANDLED_PREFIX = 'limen:stripe:handled:v1:';
var CHARGE_PREFIX = 'limen:stripe:charge-booked:';
var STATS_KEY = 'stripe:income:stats';
var HANDLED_TTL = 30 * 86400;
var CHARGE_TTL = 90 * 86400;

function _redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function _redis(method, args) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 5000);
  try {
    var r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([method].concat(args || [])),
      signal: controller.signal
    });
    if (!r.ok) throw new Error('redis-http-' + r.status);
    var j = await r.json();
    if (j && j.error) throw new Error('redis-command-error: ' + String(j.error).slice(0, 160));
    return j ? j.result : null;
  } finally {
    clearTimeout(timer);
  }
}

function _memGet(k) {
  var row = MEM.get(k);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) { MEM.delete(k); return null; }
  return row.value;
}

async function _claim(key, value, ttlSeconds) {
  var row = Object.assign({ state: 'processing', at: new Date().toISOString() }, value);
  if (!_redisConfigured()) {
    if (_memGet(key)) return { claimed: false, record: _memGet(key) };
    MEM.set(key, { value: row, expiresAt: Date.now() + ttlSeconds * 1000 });
    return { claimed: true, record: row };
  }
  var won = await _redis('SET', [key, JSON.stringify(row), 'NX', 'EX', String(ttlSeconds)]);
  if (won === 'OK') return { claimed: true, record: row };
  var raw = await _redis('GET', [key]);
  var prior = null;
  try { prior = raw ? JSON.parse(raw) : null; } catch (e) { prior = null; }
  return { claimed: false, record: prior };
}

async function _complete(key, value, ttlSeconds) {
  var row = Object.assign({ state: 'complete', at: new Date().toISOString() }, value);
  if (!_redisConfigured()) { MEM.set(key, { value: row, expiresAt: Date.now() + ttlSeconds * 1000 }); return row; }
  await _redis('SET', [key, JSON.stringify(row), 'EX', String(ttlSeconds)]);
  return row;
}

async function _release(key) {
  if (!_redisConfigured()) { MEM.delete(key); return; }
  await _redis('DEL', [key]);
}

// ── Handled-event dedup (replaces the 400-entry seen list, which evicted and replayed) ──
async function claimEvent(eventId, type) {
  return _claim(HANDLED_PREFIX + eventId, { eventId: eventId, type: type || null }, HANDLED_TTL);
}
async function completeEvent(eventId, result) {
  return _complete(HANDLED_PREFIX + eventId, { eventId: eventId, result: result == null ? null : result }, HANDLED_TTL);
}
async function releaseEvent(eventId) {
  return _release(HANDLED_PREFIX + eventId);
}

// ── Charge-level dedup. scope '' is the finance-ledger book; 'sales-agg' the funnel book. ──
async function claimCharge(scope, chargeKey, value) {
  return _claim(CHARGE_PREFIX + (scope ? scope + ':' : '') + chargeKey, value || { chargeId: chargeKey }, CHARGE_TTL);
}
async function completeCharge(scope, chargeKey, value) {
  return _complete(CHARGE_PREFIX + (scope ? scope + ':' : '') + chargeKey, value || { chargeId: chargeKey }, CHARGE_TTL);
}
async function releaseCharge(scope, chargeKey) {
  return _release(CHARGE_PREFIX + (scope ? scope + ':' : '') + chargeKey);
}

/**
 * The id one charge is known by across event types. checkout.session.completed in
 * payment mode carries payment_intent; payment_intent.succeeded IS that id; invoices
 * and charges name their charge. A subscription-mode session has no payment_intent,
 * so its subscription id stands in — renewal money arrives on different objects.
 */
function chargeKeyFor(evt) {
  var obj = (evt && evt.data && evt.data.object) || {};
  if (obj.charge) return String(obj.charge);
  if (obj.latest_charge) return String(obj.latest_charge);
  if (obj.payment_intent) return String(obj.payment_intent);
  var id = String(obj.id || '');
  if (/^(pi|ch|in)_/.test(id)) return id;
  if (obj.subscription) return String(obj.subscription);
  return id || null;
}

/** Relay C2C payments are settled by the relay webhook, which books commission + fee only. */
function isRelayC2C(meta) {
  return !!(meta && meta.orderId && meta.marketplace);
}

/** Old entries name the Stripe object id in meta.id; new ones also carry meta.chargeId. */
async function _ledgerHas(chargeKey, objectId) {
  var wanted = [chargeKey, objectId].filter(Boolean).map(String);
  if (!wanted.length) return null;
  var events;
  if (_redisConfigured()) events = await db.lrangeStrict('finance:ledger', 0, 4999);
  else events = await db.lrange('finance:ledger', 0, 4999);
  if (!Array.isArray(events)) throw new Error('finance:ledger unreadable');
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    if (!e || e.type !== 'income') continue;
    var m = e.meta || {};
    if (wanted.indexOf(String(m.chargeId)) !== -1 || wanted.indexOf(String(m.id)) !== -1) return e;
  }
  return null;
}

// ── Observability: booked-per-stream and duplicate-suppressed counters. Best effort. ──
async function _bump(fn) {
  try {
    var s = (await db.get(STATS_KEY)) || {};
    fn(s);
    s.updatedAt = new Date().toISOString();
    await db.set(STATS_KEY, s);
  } catch (e) {}
}
async function stats() {
  try { return (await db.get(STATS_KEY)) || { booked: {}, duplicatesSuppressed: 0 }; }
  catch (e) { return { booked: {}, duplicatesSuppressed: 0, unreadable: true }; }
}

/**
 * Book one Stripe income event into finance:ledger, at most once per charge.
 * Throws on storage failure (fail closed). Never books C2C gross or the
 * subscription-invoice shadow of an already-booked checkout.
 */
async function bookIncome(evt) {
  var t = evt && evt.type;
  if (t !== 'checkout.session.completed' && t !== 'payment_intent.succeeded') {
    return { ok: true, booked: false, ignored: t || 'unknown' };
  }
  var obj = (evt.data && evt.data.object) || {};
  var meta = obj.metadata || {};

  if (isRelayC2C(meta)) {
    return { ok: true, booked: false, excluded: 'relay-c2c',
      reason: 'relay-c2c settlement books commission+fee; gross must not book here' };
  }
  if (t === 'payment_intent.succeeded' && obj.invoice) {
    return { ok: true, booked: false, excluded: 'subscription-invoice',
      reason: 'subscription money books through the checkout.session.completed path' };
  }

  var chargeKey = chargeKeyFor(evt);
  if (!chargeKey) return { ok: true, booked: false, reason: 'no-charge-key' };

  var claim = await claimCharge('', chargeKey, { chargeId: chargeKey, eventId: evt.id || null });
  if (!claim.claimed) {
    await _bump(function (s) { s.duplicatesSuppressed = (s.duplicatesSuppressed || 0) + 1; });
    return { ok: true, booked: false, duplicate: true, chargeId: chargeKey,
      entry: (claim.record && claim.record.entry) || null };
  }

  try {
    var legacy = await _ledgerHas(chargeKey, obj.id);
    if (legacy) {
      await completeCharge('', chargeKey, { chargeId: chargeKey, eventId: evt.id || null, legacy: true, entry: legacy });
      await _bump(function (s) { s.duplicatesSuppressed = (s.duplicatesSuppressed || 0) + 1; });
      return { ok: true, booked: false, duplicate: true, legacy: true, chargeId: chargeKey, entry: legacy };
    }

    var amount = (obj.amount_total || obj.amount_received || obj.amount || 0) / 100;
    var streamId = meta.streamId || null;
    var entry = await ledger.record({
      type: 'income', streamId: streamId, amount: amount, currency: obj.currency || 'usd',
      source: 'stripe:' + t,
      meta: { id: obj.id, chargeId: chargeKey, eventId: evt.id || null }
    });
    await completeCharge('', chargeKey, {
      chargeId: chargeKey, eventId: evt.id || null, streamId: streamId,
      amountCents: Math.round(amount * 100), book: 'finance:ledger', entry: entry
    });
    await _bump(function (s) {
      s.booked = s.booked || {};
      var k = streamId || '_unattributed';
      s.booked[k] = (s.booked[k] || 0) + 1;
    });
    return { ok: true, booked: true, chargeId: chargeKey, amount: amount, streamId: streamId };
  } catch (e) {
    // Hand the claim back so Stripe's retry can finish the booking; holding it
    // would turn a transient failure into a permanently lost income entry.
    try { await releaseCharge('', chargeKey); } catch (_) {}
    throw e;
  }
}

module.exports = {
  claimEvent: claimEvent,
  completeEvent: completeEvent,
  releaseEvent: releaseEvent,
  claimCharge: claimCharge,
  completeCharge: completeCharge,
  releaseCharge: releaseCharge,
  chargeKeyFor: chargeKeyFor,
  isRelayC2C: isRelayC2C,
  bookIncome: bookIncome,
  stats: stats,
  STATS_KEY: STATS_KEY
};
