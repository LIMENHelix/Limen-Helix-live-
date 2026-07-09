/**
 * recall-unsubscribe.js — one-click unsubscribe for the Recall Shield free digest (CAN-SPAM).
 *
 * GET /api/recall-unsubscribe?e=<email>&t=<token>. Verifies the token (lib/recall-unsub), then
 * marks every matching recall-shield lead unsubscribed in Redis so the digest worker skips it.
 * Public by design (unsubscribe links must work without a login); the token gates it so a
 * stranger can't unsubscribe an address they don't know. Never emails, never exposes the list.
 */
'use strict';
var db = require('../lib/limen-db');
var unsub = require('../lib/recall-unsub');

function page(res, code, title, msg) {
  res.statusCode = code;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' · Recall Shield</title>' +
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;color:#0f1b24">' +
    '<div style="font-weight:800;letter-spacing:.3px">RECALL <span style="color:#0e9d8f">SHIELD</span></div>' +
    '<p style="font-size:17px;margin-top:22px">' + msg + '</p>' +
    '<p style="color:#7d8f9c;font-size:13px;margin-top:24px">Recall Shield by <a href="/" style="color:#0b7f74">LIMEN Helix</a> · data source: openFDA</p></div>');
}

module.exports = async function handler(req, res) {
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var email = unsub.norm(q.e), t = String(q.t || '');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return page(res, 400, 'Unsubscribe', 'That unsubscribe link is incomplete. Reply to any Recall Shield email with &ldquo;unsubscribe&rdquo; and we&rsquo;ll take you off by hand.');
  }
  if (t !== unsub.token(email)) {
    return page(res, 403, 'Unsubscribe', 'This unsubscribe link is invalid or has expired. Reply to any Recall Shield email with &ldquo;unsubscribe&rdquo; and we&rsquo;ll remove you.');
  }

  var n = 0;
  try {
    var ids = (await db.lrange('leads_index', 0, -1)) || [];
    for (var i = 0; i < ids.length; i++) {
      var l = await db.get('lead:' + ids[i]);
      if (l && unsub.norm(l.email) === email && l.interest === 'recall-shield' && !l.unsubscribed) {
        l.unsubscribed = true; l.unsubscribedAt = Date.now();
        try { await db.set('lead:' + ids[i], l); n++; } catch (e) {}
      }
    }
  } catch (e) { /* fall through to a friendly page — never 500 an unsubscribe */ }

  return page(res, 200, 'Unsubscribed',
    'You&rsquo;re unsubscribed from the Recall Shield digest' + (n ? '' : ' (or were already off the list)') +
    '. You won&rsquo;t receive further emails. Changed your mind? You can sign up again anytime at <a href="/recall-shield" style="color:#0b7f74">limenhelix.com/recall-shield</a>.');
};
