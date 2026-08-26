/**
 * crm-send.js — shared email send + suppression for the CRM and the autopilot.
 *
 * ONE compliant send path so email rules (unsubscribe link, postal footer,
 * reply-to, suppression check) can never drift between the manual CRM send and
 * the autonomous autopilot send. Sends via Resend. Requires RESEND_API_KEY and
 * a NON-sandbox RESEND_FROM_EMAIL (a verified domain); otherwise callers get a
 * clear "not ready" and nothing is sent.
 */
var db = require('./limen-db');
var SUPPRESS_KEY = 'crm:suppress';

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }

// Free-mail / provider domains that Resend CANNOT send from (you cannot verify a
// domain you do not own). A from-address on any of these is not sendable.
var UNVERIFIABLE = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|pm|gmx|zoho|mail|yandex|fastmail)\.[a-z.]+>?\s*$/i;
function emailConfig() {
  var apiKey = process.env.RESEND_API_KEY || '';
  var from = process.env.RESEND_FROM_EMAIL || process.env.CRM_FROM_EMAIL || process.env.LEAD_FROM_EMAIL || '';
  var replyTo = process.env.CRM_REPLY_TO || process.env.LEAD_NOTIFY_EMAIL || '';
  var addr = process.env.CRM_SENDER_ADDRESS || '';
  // from may be "Name <user@domain>" or a bare "user@domain" — extract the addr.
  var m = String(from).match(/<([^>]+)>/);
  var fromEmail = (m ? m[1] : from || '').trim();
  var validFrom = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail);
  var reason = null;
  if (!apiKey) reason = 'RESEND_API_KEY not set';
  else if (!from) reason = 'RESEND_FROM_EMAIL not set';
  else if (!validFrom) reason = 'RESEND_FROM_EMAIL is not a valid email address — use user@your-verified-domain (e.g. outreach@send.limenhelix.com), not just the domain';
  else if (/resend\.dev/i.test(fromEmail)) reason = 'from is a resend.dev sandbox — verify your own domain';
  else if (UNVERIFIABLE.test(fromEmail)) reason = 'from is a free-mail domain (e.g. gmail) — Resend cannot send from it; use an address on a domain you verified in Resend';
  var sandbox = !validFrom || /resend\.dev/i.test(fromEmail) || UNVERIFIABLE.test(fromEmail);
  return { hasKey: !!apiKey, from: from, fromEmail: fromEmail, replyTo: replyTo, addr: addr, sandbox: sandbox, ready: !!apiKey && !sandbox, reason: reason, apiKey: apiKey };
}

async function loadSuppress() { return (await db.get(SUPPRESS_KEY)) || {}; }
async function isSuppressed(email) { var s = await loadSuppress(); return !!s[String(email || '').toLowerCase()]; }
async function suppress(email, reason) {
  var s = await loadSuppress(); s[String(email || '').toLowerCase()] = { ts: new Date().toISOString(), reason: reason || 'unsubscribe' };
  await db.set(SUPPRESS_KEY, s); return true;
}

function emailHtml(bodyText, toEmail, cfg) {
  var base = 'https://limenhelix.com/api/crm?action=unsubscribe&e=' + encodeURIComponent(toEmail);
  var body = esc(bodyText).replace(/\n/g, '<br>');
  var footerAddr = cfg.addr ? esc(cfg.addr) : '[sender postal address not configured — set CRM_SENDER_ADDRESS]';
  return '<div style="font-family:sans-serif;font-size:14px;line-height:1.55;color:#111">' + body +
    '<hr style="border:none;border-top:1px solid #ddd;margin:22px 0 10px">' +
    '<div style="font-size:11px;color:#888">' + footerAddr +
    '<br>You received this because we believe it is relevant to you. ' +
    '<a href="' + base + '" style="color:#888">Unsubscribe</a> or reply STOP to opt out.</div></div>';
}

// Returns { ok, id } or { ok:false, error, status }. NEVER throws.
async function sendEmailResend(cfg, toEmail, subject, bodyText, options) {
  options = options || {};
  var payload = {
    from: cfg.from, to: [toEmail], subject: subject,
    html: emailHtml(bodyText, toEmail, cfg),
    text: bodyText + '\n\n---\n' + (cfg.addr || '') + '\nUnsubscribe: https://limenhelix.com/api/crm?action=unsubscribe&e=' + encodeURIComponent(toEmail) + '  (or reply STOP)'
  };
  if (cfg.replyTo) payload.reply_to = cfg.replyTo;
  try {
    var headers = { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.apiKey, 'user-agent': 'limen-helix/1.0' };
    if (options.idempotencyKey) headers['Idempotency-Key'] = String(options.idempotencyKey).slice(0, 256);
    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: headers, body: JSON.stringify(payload)
    });
    var jd = await r.json().catch(function () { return {}; });
    if (!r.ok) return { ok: false, error: (jd && (jd.message || jd.name)) || ('resend ' + r.status), status: r.status,
      providerCalled: true, definitiveFailure: r.status !== 409, ambiguous: r.status === 409 };
    return { ok: true, id: jd && jd.id, providerCalled: true, definitiveFailure: false, ambiguous: false };
  } catch (e) { return { ok: false, error: String(e && e.message || e), providerCalled: true, definitiveFailure: false, ambiguous: true }; }
}

// High-level guarded send used by both surfaces: config + suppression checked.
async function sendToLead(toEmail, subject, bodyText, options) {
  if (!validEmail(toEmail)) return { ok: false, error: 'no valid email', providerCalled: false, definitiveFailure: true };
  var cfg = emailConfig();
  if (!cfg.hasKey) return { ok: false, error: 'RESEND_API_KEY not set', notReady: true, providerCalled: false, definitiveFailure: true };
  if (cfg.sandbox) return { ok: false, error: 'RESEND_FROM_EMAIL unset/sandbox — verify a domain', notReady: true, providerCalled: false, definitiveFailure: true };
  if (await isSuppressed(toEmail)) return { ok: false, error: 'suppressed', suppressed: true, providerCalled: false, definitiveFailure: true };
  var sr = await sendEmailResend(cfg, toEmail, subject, bodyText, options);
  return sr.ok ? { ok: true, id: sr.id, providerCalled: true, ambiguous: false,
    warning: cfg.addr ? null : 'no CRM_SENDER_ADDRESS (CAN-SPAM)' }
    : { ok: false, error: sr.error, status: sr.status, providerCalled: sr.providerCalled === true,
      definitiveFailure: sr.definitiveFailure === true, ambiguous: sr.ambiguous === true };
}

module.exports = { esc, validEmail, emailConfig, loadSuppress, isSuppressed, suppress, emailHtml, sendEmailResend, sendToLead };
