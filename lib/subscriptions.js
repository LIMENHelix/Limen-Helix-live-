/**
 * lib/subscriptions.js — who bought what, and whether they are still paying.
 *
 * THE ONE RULE: delivery is gated on `active`, and only Stripe flips that bit. A record is
 * written when Stripe says a checkout completed, and cleared when Stripe says the
 * subscription ended or a renewal failed. Nothing in our own UI can grant access, because the
 * moment it can, a bug in the UI becomes free product.
 *
 * Email is the identity. It is what Stripe collects, what we deliver to, and what the buyer
 * would use to ask about their account, so keying on it avoids inventing a second id that has
 * to be reconciled with Stripe's.
 *
 * Storage is one Redis object rather than a key per subscriber. Upstash bills bandwidth, this
 * list is small for a long time, and a single read is what the digest cron needs anyway. If it
 * ever outgrows that, the shape here is what changes, not the callers.
 */
var db = require('./limen-db');

var KEY = 'subs:v1';

function norm(email) { return String(email || '').trim().toLowerCase(); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }

async function all() {
  try {
    var s = await db.get(KEY);
    return (s && typeof s === 'object') ? s : {};
  } catch (e) {
    return null;   // null means UNREACHABLE, which is not the same as "nobody subscribes"
  }
}

async function save(map) {
  try { await db.set(KEY, map); return true; } catch (e) { return false; }
}

/** Every currently-paying subscriber. Returns null if the store cannot be read. */
async function activeList() {
  var m = await all();
  if (m === null) return null;
  return Object.keys(m).map(function (k) { return m[k]; }).filter(function (s) { return s && s.active; });
}

async function get(email) {
  var m = await all();
  if (!m) return null;
  return m[norm(email)] || null;
}

/**
 * Activate from a verified Stripe event. Called ONLY by the webhook.
 * Re-subscribing after a cancellation reactivates the same record and keeps the original
 * `since`, so the history of a returning customer is not silently rewritten.
 */
async function activate(o) {
  var email = norm(o.email);
  if (!validEmail(email)) return { ok: false, reason: 'invalid email' };
  var m = await all();
  if (m === null) return { ok: false, reason: 'subscriber store unreachable' };

  var prev = m[email] || null;
  m[email] = {
    email: email,
    domain: o.domain || (prev && prev.domain) || null,
    rung: o.rung || (prev && prev.rung) || null,
    offer: o.offer || (prev && prev.offer) || null,
    watch: o.watch != null ? o.watch : (prev ? prev.watch : null),
    priceCents: o.priceCents != null ? o.priceCents : (prev ? prev.priceCents : null),
    subscriptionId: o.subscriptionId || (prev && prev.subscriptionId) || null,
    customerId: o.customerId || (prev && prev.customerId) || null,
    active: true,
    since: (prev && prev.since) || new Date().toISOString(),
    activatedAt: new Date().toISOString(),
    endedAt: null,
    lastSentAt: (prev && prev.lastSentAt) || null,
    lastSentKey: (prev && prev.lastSentKey) || null
  };
  var okSave = await save(m);
  if (!okSave) return { ok: false, reason: 'could not write subscriber store' };
  return { ok: true, subscriber: m[email], returning: !!prev };
}

/**
 * Stop delivery. Keeps the record with active:false rather than deleting it, so a returning
 * customer keeps their history and so "who cancelled" is answerable at all.
 */
async function deactivate(match, reason) {
  var m = await all();
  if (m === null) return { ok: false, reason: 'subscriber store unreachable' };
  var hits = [];
  Object.keys(m).forEach(function (k) {
    var s = m[k];
    if (!s) return;
    var isMatch = (match.email && norm(match.email) === s.email) ||
                  (match.subscriptionId && match.subscriptionId === s.subscriptionId) ||
                  (match.customerId && match.customerId === s.customerId);
    if (!isMatch || !s.active) return;
    s.active = false;
    s.endedAt = new Date().toISOString();
    s.endedReason = reason || 'stripe';
    hits.push(s.email);
  });
  if (!hits.length) return { ok: true, changed: 0 };
  var okSave = await save(m);
  if (!okSave) return { ok: false, reason: 'could not write subscriber store' };
  return { ok: true, changed: hits.length, emails: hits };
}

/** Record that a digest went out, so the cron does not send the same thing twice. */
async function markSent(email, sendKey) {
  var m = await all();
  if (m === null) return false;
  var s = m[norm(email)];
  if (!s) return false;
  s.lastSentAt = new Date().toISOString();
  s.lastSentKey = sendKey || null;
  return save(m);
}

async function stats() {
  var m = await all();
  if (m === null) return { ok: false, reason: 'subscriber store unreachable' };
  var list = Object.keys(m).map(function (k) { return m[k]; }).filter(Boolean);
  var active = list.filter(function (s) { return s.active; });
  var mrrCents = active.reduce(function (t, s) { return t + (s.priceCents || 0); }, 0);
  var byDomain = {};
  active.forEach(function (s) { byDomain[s.domain || 'unknown'] = (byDomain[s.domain || 'unknown'] || 0) + 1; });
  return {
    ok: true, total: list.length, active: active.length,
    cancelled: list.length - active.length,
    mrrCents: mrrCents, byDomain: byDomain
  };
}

module.exports = {
  all: all, activeList: activeList, get: get, activate: activate,
  deactivate: deactivate, markSent: markSent, stats: stats,
  validEmail: validEmail, norm: norm
};
