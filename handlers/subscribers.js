/**
 * api/subscribers.js — read-only view of who is paying, and who tried to.
 *
 *   GET /api/subscribers?key=...   → roster, MRR, per-domain counts, recent checkout intents
 *
 * READ ONLY. Nothing here activates, cancels, refunds or emails. Access is a fact about what
 * Stripe has been paid, so it is set by the webhook and by nothing else; this only reports it.
 *
 * Shows INTENTS as well as subscribers. Someone who opened checkout and did not finish is the
 * most useful lead on the site, and without this they are invisible.
 *
 * An unreachable store is reported as unreachable, never as "no subscribers".
 */
var T = require('../lib/tool-fetch');
var subs = require('../lib/subscriptions');
var db = require('../lib/limen-db');
var digest = require('../lib/digest');

var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];

function authorized(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; }).filter(Boolean);
  if (!configured.length) return false;
  return !!(supplied && configured.indexOf(supplied) !== -1);
}

module.exports = async function handler(req, res) {
  try {
    if (!authorized(req)) {
      return T.send(res, { ok: false, error: 'Not authorized. Pass ?key= with an admin key.' }, 401);
    }

    var map = await subs.all();
    if (map === null) {
      return T.send(res, { ok: false, error: 'Subscriber store unreachable. This is not the same as having no subscribers.' }, 503);
    }

    var list = Object.keys(map).map(function (k) { return map[k]; }).filter(Boolean);
    list.sort(function (a, b) { return String(b.activatedAt || b.since || '').localeCompare(String(a.activatedAt || a.since || '')); });

    var stats = await subs.stats();

    var intents = [];
    try {
      var raw = await db.get('subs:intents:v1');
      if (Array.isArray(raw)) intents = raw.slice(0, 25);
    } catch (e) {}

    return T.send(res, {
      ok: true,
      generatedAt: new Date().toISOString(),
      stats: stats.ok ? {
        active: stats.active, cancelled: stats.cancelled, total: stats.total,
        mrrCents: stats.mrrCents, byDomain: stats.byDomain
      } : null,
      personalisedDomains: digest.PERSONAL_DOMAINS,
      subscribers: list.map(function (s) {
        return {
          email: s.email, domain: s.domain, rung: s.rung, offer: s.offer,
          watch: s.watch, priceCents: s.priceCents, active: s.active,
          personal: digest.isPersonal(s.domain),
          since: s.since, activatedAt: s.activatedAt, endedAt: s.endedAt, endedReason: s.endedReason,
          lastSentAt: s.lastSentAt,
          subscriptionId: s.subscriptionId
        };
      }),
      intents: intents
    });
  } catch (e) {
    return T.send(res, { ok: false, error: e.message || 'handler error' }, 500);
  }
};
