/**
 * api/subscriber-digest.js — send paying subscribers what they bought.
 *
 *   GET /api/subscriber-digest?key=...            → DRY RUN. Builds every digest, sends none.
 *   GET /api/subscriber-digest?key=...&send=1     → actually sends.
 *   (Vercel's scheduler is authorised by its own header and DOES send.)
 *
 * Same posture as the poster: a dry run is the default for a manual call, so hitting this URL
 * in a browser cannot mail your customers.
 *
 * DELIVERY IS GATED ON `active`, which only the Stripe webhook sets. If the subscriber store
 * is unreachable this sends NOTHING rather than assuming an empty list, because "cannot read
 * who is paying" must not silently become "nobody is paying".
 *
 * ONLY ON CHANGE. Each digest carries a key derived from its figures; if it matches what that
 * subscriber last received, they are skipped. A daily email that says the same thing every day
 * is how a paid alert gets filtered to spam.
 */
var T = require('../lib/tool-fetch');
var subs = require('../lib/subscriptions');
var digest = require('../lib/digest');
var crm = require('../lib/crm-send');

function cronHit(req) {
  var h = req.headers || {};
  // Matches the pattern already proven by handlers/autopilot.js. CRON_SECRET is spoof-proof
  // and wins when set; otherwise Vercel identifies itself with a header. It sends
  // x-vercel-signature, NOT x-vercel-cron, on this project, and checking only the latter is
  // why every scheduled run returned 401 while the endpoint looked perfectly healthy.
  if (process.env.CRON_SECRET) return h['authorization'] === 'Bearer ' + process.env.CRON_SECRET;
  return !!(h['x-vercel-cron'] || h['x-vercel-signature']);
}

var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];

function authorized(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (nm) { return process.env[nm] ? String(process.env[nm]).trim() : ''; }).filter(Boolean);
  if (!configured.length) return { ok: false, cron: false };
  var cron = cronHit(req);
  if (cron) return { ok: true, cron: true };
  if (supplied && configured.indexOf(supplied) !== -1) return { ok: true, cron: false };
  return { ok: false, cron: false };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    var auth = authorized(req);
    if (!auth.ok) {
      return T.send(res, { ok: false, error: 'Not authorized. Pass ?key= or call from the Vercel scheduler.' }, 401);
    }

    // The scheduler sends for real; a manual call must ask for it.
    var reallySend = auth.cron || q.send === '1';

    var active = await subs.activeList();
    if (active === null) {
      return T.send(res, { ok: false, error: 'Subscriber store unreachable. Sending nothing rather than assuming there are no subscribers.' }, 503);
    }
    if (!active.length) {
      return T.send(res, { ok: true, sent: 0, skipped: 0, subscribers: 0, note: 'No active subscribers yet.' });
    }

    var results = [];
    var sent = 0, skipped = 0, failed = 0;

    for (var i = 0; i < active.length; i++) {
      var s = active[i];
      var row = { email: s.email, domain: s.domain, rung: s.rung, personal: null, action: null };
      var d = null;
      try { d = await digest.buildFor(s); } catch (e) { d = null; row.error = e.message; }

      if (!d) { row.action = 'nothing-to-say'; skipped++; results.push(row); continue; }
      row.personal = d.personal;
      row.subject = d.subject;

      if (s.lastSentKey && s.lastSentKey === d.key) {
        row.action = 'unchanged-since-last-send';
        skipped++; results.push(row); continue;
      }

      if (!reallySend) {
        row.action = 'would-send';
        row.preview = d.body.split('\n').slice(0, 3).join(' / ').slice(0, 180);
        results.push(row); continue;
      }

      try {
        var r = await crm.sendToLead(s.email, d.subject, d.body);
        if (r && r.ok === false) { row.action = 'send-failed'; row.error = r.reason || r.error; failed++; }
        else { await subs.markSent(s.email, d.key); row.action = 'sent'; sent++; }
      } catch (e) {
        row.action = 'send-failed'; row.error = e.message; failed++;
      }
      results.push(row);
    }

    return T.send(res, {
      ok: true,
      mode: reallySend ? 'send' : 'dry-run',
      note: reallySend ? null : 'Dry run. Add &send=1 to actually email subscribers.',
      subscribers: active.length,
      sent: sent, skipped: skipped, failed: failed,
      personalisedDomains: digest.PERSONAL_DOMAINS,
      results: results
    });
  } catch (e) {
    return T.send(res, { ok: false, error: e.message || 'handler error' }, 500);
  }
};

// Outward-acting: this sends something into the world on a timer. Records every
// run AND consults the veto first, which is a separate structure that can cancel
// it without this handler being changed or redeployed.
module.exports = require('../lib/heartbeat').guard('subscriber-digest', module.exports);
