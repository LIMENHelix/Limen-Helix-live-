/**
 * recall-digest.js — RECALL SHIELD fulfillment, running ON VERCEL (reuses the RESEND_API_KEY already
 * set in the Vercel env — no GitHub secrets needed). Invoked weekly by a Vercel cron (vercel.json) and
 * manually by the operator with the admin key. Delivers the free weekly FDA recall digest that
 * /recall-shield promises to consented clinic subscribers.
 *
 * SAFETY: DRY RUN (sends nothing, returns a preview) unless RECALL_DIGEST_ARMED=1 AND RESEND_API_KEY.
 * Access: Vercel cron (user-agent vercel-cron) OR ?key=LEAD_ADMIN_KEY. Never publicly triggerable.
 * Defaults need zero extra config: from recall@limenhelix.com (domain verified), reply-to the operator
 * Gmail. Set RECALL_DIGEST_ARMED=1 (+ optional RECALL_POSTAL_ADDRESS for CAN-SPAM) in Vercel to go live.
 */
var db = require('../lib/limen-db');
var unsub = require('../lib/recall-unsub');
function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(o)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function subscribers() {
  var ids = (await db.lrange('leads_index', 0, -1)) || [];
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var l = await db.get('lead:' + ids[i]);
    if (l && l.consent && !l.test && !l.unsubscribed && l.interest === 'recall-shield' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email || '')) out.push(l);
  }
  return out;
}
async function topRecalls(n) {
  var deals = (await db.get('medicine:distress')) || [];
  deals = deals.slice().sort(function (a, b) { return ((a.tier || 9) - (b.tier || 9)) || ((b.priority || 0) - (a.priority || 0)); });
  return deals.slice(0, n);
}
function buildHTML(recalls, postal, unsubUrl) {
  var rows = recalls.map(function (d) {
    var name = d.brand || d.generic || d.product || d.firm || 'Recall';
    var cls = d.signalType === 'classI' ? '#d1495b' : (d.signalType === 'classII' ? '#c9820a' : '#7d8f9c');
    return '<tr><td style="padding:8px 10px;border-top:1px solid #e2e8ee;vertical-align:top"><b>' + esc(String(name).slice(0, 70)) + '</b><br><span style="color:#7d8f9c;font-size:12px">' + esc(d.productType || '') + ' · ' + esc(d.firm || '') + ' · ' + esc(d.date || '') + '</span><br><span style="color:#3f5464;font-size:12px">' + esc(String(d.reason || '').slice(0, 140)) + '</span></td>' +
      '<td style="padding:8px 10px;border-top:1px solid #e2e8ee;color:' + cls + ';font-weight:700;white-space:nowrap">' + esc(d.classification || d.signalType) + '</td></tr>';
  }).join('');
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f1b24">' +
    '<h2 style="margin:0 0 4px">Recall Shield: this week&rsquo;s FDA recalls</h2>' +
    '<p style="color:#3f5464;font-size:14px;margin:0 0 14px">The drug &amp; device recalls the FDA posted recently, ranked by severity. A backstop for your clinic, not a substitute for your own clinical judgment.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' + rows + '</table>' +
    '<p style="color:#3f5464;font-size:13px;margin:16px 0 4px">Want alerts filtered to only the drugs &amp; devices your clinic uses, plus instant Class I warnings and a compliance log? Reply to this email or book 10 minutes: <a href="https://calendly.com/chrishubbel72/15min">calendly.com/chrishubbel72/15min</a></p>' +
    '<hr style="border:0;border-top:1px solid #e2e8ee;margin:18px 0">' +
    '<p style="color:#7d8f9c;font-size:11px">You are getting this because you signed up for free FDA recall alerts at limenhelix.com/recall-shield. Data: openFDA. ' +
    (unsubUrl ? '<a href="' + esc(unsubUrl) + '" style="color:#7d8f9c">Unsubscribe</a> (or reply &ldquo;unsubscribe&rdquo;).' : 'To stop, reply with &ldquo;unsubscribe&rdquo;.') +
    '<br>Recall Shield by LIMEN Helix · ' + esc(postal) + '</p></div>';
}
async function sendOne(to, html, from, reply, resendKey) {
  var r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + resendKey },
    body: JSON.stringify({ from: from, to: [to], reply_to: reply, subject: 'Recall Shield: this week’s FDA recalls', html: html })
  });
  return r.ok;
}

module.exports = async function handler(req, res) {
  var ua = (req.headers && req.headers['user-agent']) || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var isCron = /vercel-cron/i.test(ua);
  if (!isCron && (!ADMIN || q.key !== ADMIN)) return j(res, 403, { ok: false, error: 'Cron or admin key only.' });

  var RESEND = process.env.RESEND_API_KEY || '';
  var FROM = process.env.RECALL_FROM_EMAIL || 'Recall Shield <recall@limenhelix.com>';
  var REPLY = process.env.RECALL_REPLY_TO || 'chrishubbel72@gmail.com';
  var POSTAL = process.env.RECALL_POSTAL_ADDRESS || '';
  var ARMED = process.env.RECALL_DIGEST_ARMED === '1';
  // CAN-SPAM requires a valid physical postal address in every commercial email. Refuse to send
  // (stay dry-run) until one is set — a real address has a number and reasonable length.
  var postalValid = /\d/.test(POSTAL) && POSTAL.replace(/\s+/g, ' ').trim().length >= 12;
  var BASE = 'https://' + ((req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'limenhelix.com');

  var subs = await subscribers();
  var recalls = await topRecalls(12);
  if (!recalls.length) return j(res, 200, { ok: true, sent: 0, note: 'no recalls stored yet — run the openFDA recall signal first', subscribers: subs.length });

  if (!ARMED || !RESEND || !postalValid) {
    return j(res, 200, {
      ok: true, mode: 'dry-run', armed: ARMED, resendKeyPresent: !!RESEND, postalValid: postalValid,
      subscribers: subs.length, recalls: recalls.length,
      wouldEmail: subs.slice(0, 10).map(function (s) { return s.email; }),
      toGoLive: 'set in Vercel: RECALL_DIGEST_ARMED=1, RESEND_API_KEY, and RECALL_POSTAL_ADDRESS (a valid physical mailing address — CAN-SPAM)'
    });
  }
  var sent = 0, failed = 0, cap = Math.min(subs.length, 80);
  for (var i = 0; i < cap; i++) {
    var html = buildHTML(recalls, POSTAL, unsub.url(BASE, subs[i].email));   // per-recipient one-click unsubscribe
    try { (await sendOne(subs[i].email, html, FROM, REPLY, RESEND)) ? sent++ : failed++; } catch (e) { failed++; }
    await wait(120);
  }
  return j(res, 200, { ok: true, mode: 'sent', sent: sent, failed: failed, subscribers: subs.length, from: FROM });
};
