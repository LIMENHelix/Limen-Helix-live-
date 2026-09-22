'use strict';

/**
 * subscriber-delivery-health.js — the subscriber silence watchdog (PR-007).
 *
 * THE GAP THIS CLOSES. Non-personalized domains deliver only when a fresh artifact
 * exists; when lib/digest buildFor returns null the digest takes the
 * 'nothing-to-say' skip path and tells nobody. A paying subscriber could receive
 * nothing for weeks with no signal to anyone. This module makes "paid but
 * unserved" a recorded, countable, operator-visible exception instead of silent
 * churn.
 *
 * TWO STORES (both via lib/limen-db, i.e. the limen: prefix):
 *
 *   subs:delivery-health:v1     per-domain map. The digest handler writes it on
 *                               every real (send) run, on BOTH the delivery and
 *                               the skip path:
 *                                 { lastDelivered: ISO|null  — last ACTUAL send,
 *                                   silentSkips: n           — nothing-to-say skips,
 *                                   activeCount: n           — active subscribers,
 *                                   state: 'delivered'|'silent'|'unknown',
 *                                   lastRunAt: ISO, updatedAt: ISO }
 *                               Plus a reserved `_observer` key carrying the last
 *                               store-outage marker (state 'unknown').
 *   subs:silence-exceptions:v1  map keyed `<domain>:<YYYY-MM-DD>` (UTC day). One
 *                               exception per domain per day — a second evaluation
 *                               the same day dedups on the key and never re-raises.
 *                                 { key, domain, day, status: 'open'|'cleared',
 *                                   reason, silenceDays, lastDelivered,
 *                                   silentSkips, activeCount, anchor,
 *                                   raisedAt, clearedAt, clearedReason }
 *                               Delivery resumption clears open exceptions for the
 *                               domain, both here (on the delivery record) and in
 *                               the observer pass (reconciliation).
 *
 * STORE OUTAGES ARE NOT SILENCE. The observer pass reads the subscriber store
 * STRICTLY (no process-memory fallback may stand in for "who is paying") and the
 * two health stores with getStrict (an outage must not read as an empty map). Any
 * unreadable store records an explicit 'unknown' health state and raises NOTHING:
 * a fail-silent observer is wrong here, and a store outage must never mint false
 * exceptions against paying customers.
 *
 * OPERATOR DECISION: the silence threshold is env SUBSCRIBER_SILENCE_DAYS,
 * default 7.
 */
var db = require('./limen-db');
var subs = require('./subscriptions');
var strictStore = require('./autofire-efference-store');

var HEALTH_KEY = 'subs:delivery-health:v1';
var EXCEPTIONS_KEY = 'subs:silence-exceptions:v1';
var EXCEPTIONS_CAP = 500;
var OBSERVER_META_KEY = '_observer';
var DEFAULT_SILENCE_DAYS = 7;
var DAY_MS = 86400000;

function silenceDays(env) {
  var raw = (env || process.env).SUBSCRIBER_SILENCE_DAYS;
  var n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_SILENCE_DAYS;
}

function dayKey(now) {
  return new Date(Number(now) || Date.now()).toISOString().slice(0, 10);
}

function asMap(value) {
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

/* Mark open exceptions for one domain cleared. Mutates the map; returns keys. */
function clearOpen(map, domain, at, reason) {
  var cleared = [];
  Object.keys(map).forEach(function (k) {
    var x = map[k];
    if (x && x.domain === domain && x.status === 'open') {
      x.status = 'cleared';
      x.clearedAt = at;
      x.clearedReason = reason || 'delivery-resumed';
      cleared.push(k);
    }
  });
  return cleared;
}

/** Delivery resumption auto-clears: called from the digest's delivery path. */
async function clearExceptions(domain, now, reason) {
  var map;
  try { map = await db.get(EXCEPTIONS_KEY); } catch (e) { return []; }
  map = asMap(map);
  var cleared = clearOpen(map, String(domain || '').toLowerCase(), new Date(Number(now) || Date.now()).toISOString(), reason);
  if (cleared.length) { try { await db.set(EXCEPTIONS_KEY, map); } catch (e) {} }
  return cleared;
}

/**
 * Record one real digest run for one motor domain. Called for EVERY domain the
 * run touched, delivery or skip. Fail-soft by contract: health recording must
 * never break, delay-fail, or change what the digest itself does.
 */
async function recordRun(domain, run) {
  domain = String(domain || '').toLowerCase();
  if (!domain) return { ok: false, reason: 'no-domain' };
  run = run || {};
  var now = Number(run.now) || Date.now();
  var at = new Date(now).toISOString();

  var health;
  try { health = asMap(await db.get(HEALTH_KEY)); } catch (e) { health = {}; }
  var prev = (health[domain] && typeof health[domain] === 'object') ? health[domain] : {};
  var delivered = Math.max(0, Number(run.delivered) || 0);
  var silent = Math.max(0, Number(run.silent) || 0);

  var entry = {
    lastDelivered: prev.lastDelivered || null,
    silentSkips: Math.max(0, Number(prev.silentSkips) || 0),
    activeCount: run.activeCount != null ? Math.max(0, Number(run.activeCount) || 0)
      : Math.max(0, Number(prev.activeCount) || 0),
    state: prev.state || 'unknown',
    lastRunAt: at,
    updatedAt: prev.updatedAt || null
  };
  if (delivered > 0) {
    entry.lastDelivered = at;                    // timestamp of the last ACTUAL send
    entry.state = 'delivered';
    entry.updatedAt = at;
  } else if (silent > 0) {
    entry.silentSkips += silent;                 // cumulative nothing-to-say skips
    entry.state = 'silent';
    entry.updatedAt = at;
  }
  health[domain] = entry;

  var ok;
  try { ok = await db.set(HEALTH_KEY, health); } catch (e) { ok = false; }

  var cleared = [];
  if (delivered > 0) cleared = await clearExceptions(domain, now, 'delivery-resumed');
  return { ok: ok !== false, domain: domain, entry: entry, clearedExceptions: cleared };
}

/** Record the explicit 'unknown' state a store outage demands. Fail-soft. */
async function markUnknown(reason, at) {
  try {
    var health = asMap(await db.get(HEALTH_KEY));
    Object.keys(health).forEach(function (k) {
      if (k === OBSERVER_META_KEY || !health[k] || typeof health[k] !== 'object') return;
      health[k].state = 'unknown';
      health[k].updatedAt = at;
    });
    health[OBSERVER_META_KEY] = { state: 'unknown', reason: String(reason || 'store-unreachable').slice(0, 300), at: at };
    await db.set(HEALTH_KEY, health);
  } catch (e) {}
}

/**
 * The observer pass. Evaluates every domain that has at least one active
 * subscriber — independent of the observer cron's 7-domain daily rotation,
 * because a domain only visited once a week could otherwise sit silent for six
 * days before anyone looked.
 *
 * A domain is silent when its last actual delivery (or, if it has never
 * delivered, its oldest active subscriber's subscription start) is older than
 * SUBSCRIBER_SILENCE_DAYS. Silent → one exception keyed domain+day. Not silent →
 * any open exception for the domain clears (delivery resumption, reconciled).
 */
async function check(opts) {
  opts = opts || {};
  var store = opts.store || strictStore;
  var env = opts.env || process.env;
  var now = Number(opts.now) || Date.now();
  var days = silenceDays(env);
  var at = new Date(now).toISOString();

  async function unknown(reason) {
    await markUnknown(reason, at);
    return { ok: false, status: 'UNKNOWN', reason: reason, silenceDays: days,
      evaluatedAt: at, domains: [], raised: [], cleared: [], open: null };
  }

  var active;
  try {
    store.assertDurable();
    active = await subs.activeListStrict(store);
  } catch (e) {
    return unknown('subscriber-store-unreachable: ' + ((e && e.message) || e));
  }

  var health;
  try { health = asMap(await db.getStrict(HEALTH_KEY)); }
  catch (e) { return unknown('delivery-health-store-unreachable: ' + ((e && e.message) || e)); }

  var exceptions;
  try { exceptions = asMap(await db.getStrict(EXCEPTIONS_KEY)); }
  catch (e) { return unknown('silence-exception-store-unreachable: ' + ((e && e.message) || e)); }

  var byDomain = {};
  (active || []).forEach(function (s) {
    var d = String(s && s.domain || '').toLowerCase();
    if (!d) return;
    (byDomain[d] || (byDomain[d] = [])).push(s);
  });

  var thresholdMs = days * DAY_MS;
  var day = dayKey(now);
  var domains = Object.keys(byDomain).sort();
  var evaluated = [], raised = [], cleared = [];

  for (var i = 0; i < domains.length; i++) {
    var d = domains[i], members = byDomain[d];
    var h = (health[d] && typeof health[d] === 'object') ? health[d] : null;

    // A domain whose health is 'unknown' (a prior store outage) is never a
    // basis for an exception: unknown is not silence.
    if (h && h.state === 'unknown') {
      evaluated.push({ domain: d, status: 'unknown', activeCount: members.length });
      continue;
    }

    var lastDeliveredMs = h && h.lastDelivered ? Date.parse(h.lastDelivered) : NaN;
    var anchorMs = Number.isFinite(lastDeliveredMs) ? lastDeliveredMs : null;
    if (anchorMs === null) {
      for (var m = 0; m < members.length; m++) {
        var t = Date.parse(members[m].since || members[m].activatedAt || '');
        if (Number.isFinite(t) && (anchorMs === null || t < anchorMs)) anchorMs = t;
      }
    }
    if (anchorMs === null) {
      evaluated.push({ domain: d, status: 'no-anchor', activeCount: members.length });
      continue;
    }

    if ((now - anchorMs) > thresholdMs) {
      var key = d + ':' + day;
      evaluated.push({ domain: d, status: 'silent', activeCount: members.length,
        lastDelivered: Number.isFinite(lastDeliveredMs) ? new Date(lastDeliveredMs).toISOString() : null,
        anchor: new Date(anchorMs).toISOString() });
      if (!exceptions[key]) {
        exceptions[key] = {
          key: key, domain: d, day: day, status: 'open',
          reason: 'no-delivery-in-' + days + '-days',
          silenceDays: days,
          lastDelivered: Number.isFinite(lastDeliveredMs) ? new Date(lastDeliveredMs).toISOString() : null,
          silentSkips: h ? Math.max(0, Number(h.silentSkips) || 0) : 0,
          activeCount: members.length,
          anchor: new Date(anchorMs).toISOString(),
          raisedAt: at
        };
        raised.push(d);
      }
    } else {
      evaluated.push({ domain: d, status: 'served', activeCount: members.length,
        lastDelivered: Number.isFinite(lastDeliveredMs) ? new Date(lastDeliveredMs).toISOString() : null });
      cleared = cleared.concat(clearOpen(exceptions, d, at, 'delivery-resumed'));
    }
  }

  // Capped: an unbounded exception log is a second outage. Cleared records go first.
  var keys = Object.keys(exceptions);
  if (keys.length > EXCEPTIONS_CAP) {
    keys.sort(function (a, b) {
      var xa = exceptions[a], xb = exceptions[b];
      var oa = xa && xa.status === 'open' ? 1 : 0, ob = xb && xb.status === 'open' ? 1 : 0;
      if (oa !== ob) return oa - ob;
      return String((xa && xa.raisedAt) || '').localeCompare(String((xb && xb.raisedAt) || ''));
    });
    while (keys.length > EXCEPTIONS_CAP) { delete exceptions[keys.shift()]; }
  }

  var writeOk;
  try { writeOk = await db.set(EXCEPTIONS_KEY, exceptions); } catch (e) { writeOk = false; }

  var open = Object.keys(exceptions).filter(function (k) { return exceptions[k] && exceptions[k].status === 'open'; }).length;
  return { ok: writeOk !== false, status: 'OBSERVED', silenceDays: days, evaluatedAt: at,
    domains: evaluated, raised: raised, cleared: cleared, open: open };
}

/** Read-only bundle for the admin /api/subscribers JSON. Fail-soft per section. */
async function operatorSummary(env) {
  var out = { ok: true, silenceDays: silenceDays(env || process.env),
    health: {}, observer: null, exceptions: { total: 0, open: 0, recent: [] } };
  try {
    var h = asMap(await db.get(HEALTH_KEY));
    Object.keys(h).forEach(function (k) {
      if (k === OBSERVER_META_KEY) out.observer = h[k];
      else out.health[k] = h[k];
    });
  } catch (e) { out.healthUnreadable = true; }
  try {
    var map = asMap(await db.get(EXCEPTIONS_KEY));
    var list = Object.keys(map).map(function (k) { return map[k]; }).filter(Boolean);
    list.sort(function (a, b) { return String(b.raisedAt || '').localeCompare(String(a.raisedAt || '')); });
    out.exceptions = {
      total: list.length,
      open: list.filter(function (x) { return x.status === 'open'; }).length,
      recent: list.slice(0, 10)
    };
  } catch (e) { out.exceptions = { total: null, open: null, recent: [], unreadable: true }; }
  return out;
}

module.exports = {
  recordRun: recordRun,
  check: check,
  clearExceptions: clearExceptions,
  operatorSummary: operatorSummary,
  silenceDays: silenceDays,
  dayKey: dayKey,
  HEALTH_KEY: HEALTH_KEY,
  EXCEPTIONS_KEY: EXCEPTIONS_KEY,
  DEFAULT_SILENCE_DAYS: DEFAULT_SILENCE_DAYS
};
