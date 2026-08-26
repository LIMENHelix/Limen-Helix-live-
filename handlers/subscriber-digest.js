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
var motorStore = require('../lib/autofire-efference-store');
var subscriberDecision = require('../lib/religion-subscriber-decision');
var subscriberExecutor = require('../lib/religion-subscriber-executor');

function maxSends() {
  var n = parseInt(process.env.SUBSCRIBER_DIGEST_MAX_SENDS, 10);
  if (!isFinite(n)) n = 5;
  return Math.max(0, Math.min(subscriberExecutor.HARD_MAX_SENDS, n));
}
function numericEnv(name, fallback) { var n = parseFloat(process.env[name]); return isFinite(n) && n >= 0 ? n : fallback; }

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

    var active = reallySend ? await subs.activeListStrict() : await subs.activeList();
    if (active === null) {
      return T.send(res, { ok: false, error: 'Subscriber store unreachable. Sending nothing rather than assuming there are no subscribers.' }, 503);
    }
    if (!active.length) {
      return T.send(res, { ok: true, sent: 0, skipped: 0, subscribers: 0, note: 'No active subscribers yet.' });
    }

    var results = [], executable = [];
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

      var candidate = subscriberDecision.candidate(s, d);
      var decision = await subscriberDecision.decide(motorStore, candidate, Date.now());
      row.decisionStatus = decision.status;
      row.decisionReceiptId = decision.decisionReceiptId || null;
      if (decision.status !== 'RELEASED') {
        row.action = 'brain-held'; row.blockers = decision.blockers || []; skipped++; results.push(row); continue;
      }
      row.action = 'released-pending-motor';
      executable.push({ subscriber: s, digest: d, candidate: candidate, decision: decision, row: row });
      results.push(row);
    }

    var batch = null;
    if (reallySend && executable.length) {
      batch = await subscriberExecutor.execute({
        store: motorStore, now: Date.now(), maxSends: maxSends(),
        emailCostUsd: numericEnv('RELIGION_SUBSCRIBER_EMAIL_USD', null),
        dailyBudgetUsd: numericEnv('RELIGION_SUBSCRIBER_DAILY_BUDGET_USD', null),
        dailySendCap: numericEnv('RELIGION_SUBSCRIBER_DAILY_SEND_CAP', 5),
        specs: executable.map(function (x) { return { candidate: x.candidate, decision: x.decision }; }),
        transport: { send: function (email, subject, body, options) { return crm.sendToLead(email, subject, body, options); } }
      });
      var byAction = {};
      (batch.items || []).forEach(function (item) { byAction[item.actionId] = item; });
      for (var x = 0; x < executable.length; x++) {
        var execution = executable[x], item = byAction[execution.decision.actionId];
        if (!item) { execution.row.action = batch && batch.status === 'HELD' ? 'batch-held' : 'send-cap-held'; execution.row.error = batch && batch.reason || null; skipped++; continue; }
        execution.row.commandId = batch.commandId || null;
        execution.row.providerEmailId = item.providerEmailId || null;
        if (item.status === 'ACCEPTED') {
          var marked = await subs.markSentStrict(execution.subscriber.email, execution.digest.key);
          execution.row.action = marked ? 'sent-receipt-persisted' : 'accepted-mark-sent-pending';
          sent++;
        } else if (item.status === 'BUDGET_HELD') { execution.row.action = 'budget-held'; execution.row.error = item.failure; skipped++; }
        else if (item.status === 'FAILED') { execution.row.action = 'send-failed'; execution.row.error = item.failure; failed++; }
        else { execution.row.action = 'send-ambiguous-no-retry'; execution.row.error = item.failure; failed++; }
      }
    }

    return T.send(res, {
      ok: true,
      mode: reallySend ? 'send' : 'dry-run',
      note: reallySend ? null : 'Dry run. Add &send=1 to actually email subscribers.',
      subscribers: active.length,
      sent: sent, skipped: skipped, failed: failed,
      maxSends: maxSends(),
      batchStatus: batch && batch.status || (reallySend ? 'NO_RELEASED_ACTIONS' : null),
      providerCalls: batch && batch.providerCalls || 0,
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
