/**
 * recall-digest.js — RECALL SHIELD fulfillment worker. Delivers the free weekly FDA recall digest that
 * /recall-shield promises. Reads the clinic subscribers (leads with interest=recall-shield) + the ranked
 * recalls (medicine:distress), builds one digest email, and sends it via Resend. Cron via recall-digest.yml.
 *
 * SAFETY = ARM SWITCH (mirrors homestead-automail): DRY RUN by default (logs who it WOULD email, sends
 * nothing) until RECALL_DIGEST_ARMED=1 AND RESEND_API_KEY are set. Two gates: arm flag + send key.
 *
 * Consent: recipients opted in on the signup form ("send me free FDA recall alerts"). Every email
 * carries an unsubscribe line. ⚠ Before arming REAL sends, set RECALL_FROM_EMAIL to an address on a
 * Resend-VERIFIED domain (limenhelix.com) for deliverability, and set RECALL_POSTAL_ADDRESS (CAN-SPAM
 * requires a physical postal address in commercial email).
 *
 * Env: LEAD_ADMIN_KEY (read leads + recalls), RESEND_API_KEY, RECALL_FROM_EMAIL, RECALL_POSTAL_ADDRESS,
 * RECALL_DIGEST_ARMED, INGEST_URL, optional RECALL_MAX (recipient cap/run, default 300).
 */
'use strict';
var BASE = process.env.INGEST_URL || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
var RESEND = process.env.RESEND_API_KEY || '';
var FROM = process.env.RECALL_FROM_EMAIL || 'Recall Shield <onboarding@resend.dev>';
var REPLY_TO = process.env.RECALL_REPLY_TO || 'chrishubbel72@gmail.com';
var POSTAL = process.env.RECALL_POSTAL_ADDRESS || '[set RECALL_POSTAL_ADDRESS]';
var ARMED = process.env.RECALL_DIGEST_ARMED === '1';
var MAX = parseInt(process.env.RECALL_MAX || '300', 10);
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function getJSON(path) {
  var r = await fetch(BASE + path, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('GET ' + path + ' -> HTTP ' + r.status);
  return r.json();
}

async function subscribers() {
  if (!KEY) throw new Error('LEAD_ADMIN_KEY required to read subscribers');
  var j = await getJSON('/api/lead?key=' + encodeURIComponent(KEY));
  return ((j && j.leads) || []).filter(function (l) {
    return l && l.consent && !l.test && l.interest === 'recall-shield' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email || '');
  });
}

async function topRecalls(n) {
  var j = await getJSON('/api/medicine-distress?type=ALL&per=100&key=' + encodeURIComponent(KEY));
  var deals = [];
  (j.groups || []).forEach(function (g) { (g.deals || []).forEach(function (d) { deals.push(d); }); });
  deals.sort(function (a, b) { return ((a.tier || 9) - (b.tier || 9)) || ((b.priority || 0) - (a.priority || 0)); });
  return deals.slice(0, n);
}

function buildHTML(recalls) {
  var rows = recalls.map(function (d) {
    var name = d.brand || d.generic || d.product || d.firm || 'Recall';
    var cls = d.signalType === 'classI' ? '#d1495b' : (d.signalType === 'classII' ? '#c9820a' : '#7d8f9c');
    return '<tr>' +
      '<td style="padding:8px 10px;border-top:1px solid #e2e8ee;vertical-align:top"><b>' + esc(String(name).slice(0, 70)) + '</b><br><span style="color:#7d8f9c;font-size:12px">' + esc(d.productType || '') + ' · ' + esc(d.firm || '') + ' · ' + esc(d.date || '') + '</span><br><span style="color:#3f5464;font-size:12px">' + esc(String(d.reason || '').slice(0, 140)) + '</span></td>' +
      '<td style="padding:8px 10px;border-top:1px solid #e2e8ee;color:' + cls + ';font-weight:700;white-space:nowrap">' + esc(d.classification || d.signalType) + '</td>' +
      '</tr>';
  }).join('');
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f1b24">' +
    '<h2 style="margin:0 0 4px">Recall Shield — this week’s FDA recalls</h2>' +
    '<p style="color:#3f5464;font-size:14px;margin:0 0 14px">The drug &amp; device recalls the FDA posted recently, ranked by severity. A backstop for your clinic — not a substitute for your own clinical judgment.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' + rows + '</table>' +
    '<p style="color:#3f5464;font-size:13px;margin:16px 0 4px">Want alerts filtered to only the drugs &amp; devices <b>your</b> clinic uses, plus instant Class I warnings and a compliance log? Reply to this email or book 10 minutes: <a href="https://calendly.com/chrishubbel72/15min">calendly.com/chrishubbel72/15min</a></p>' +
    '<hr style="border:0;border-top:1px solid #e2e8ee;margin:18px 0">' +
    '<p style="color:#7d8f9c;font-size:11px">You’re getting this because you signed up for free FDA recall alerts at limenhelix.com/recall-shield. Data: openFDA. To stop, reply with “unsubscribe”.<br>Recall Shield by LIMEN Helix · ' + esc(POSTAL) + '</p>' +
    '</div>';
}

async function sendOne(to, html) {
  var r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + RESEND },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: 'Recall Shield: this week’s FDA recalls', html: html })
  });
  return r.ok;
}

async function run() {
  var subs = await subscribers();
  var recalls = await topRecalls(12);
  console.log('subscribers: ' + subs.length + ' | recalls in digest: ' + recalls.length);
  if (!subs.length) { console.log('no subscribers - nothing to send'); return; }
  if (!recalls.length) { console.log('no recalls available (has the medicine cron run?) - skipping this week'); return; }
  var html = buildHTML(recalls);

  if (!ARMED || !RESEND) {
    console.log('DRY RUN (armed=' + ARMED + ', resendKey=' + !!RESEND + '). Would email ' + Math.min(subs.length, MAX) + ' clinics:');
    subs.slice(0, 10).forEach(function (s) { console.log('   -> ' + s.email + (s.organization ? ' (' + s.organization + ')' : '')); });
    console.log('To go live: set RECALL_DIGEST_ARMED=1 + RESEND_API_KEY + RECALL_FROM_EMAIL (verified domain) + RECALL_POSTAL_ADDRESS.');
    return;
  }
  var sent = 0, failed = 0;
  var batch = subs.slice(0, MAX);
  for (var i = 0; i < batch.length; i++) {
    try { (await sendOne(batch[i].email, html)) ? sent++ : failed++; } catch (e) { failed++; }
    await wait(120); // stay under Resend rate limits
  }
  console.log('SENT ' + sent + ' / failed ' + failed + ' (cap ' + MAX + ', total subs ' + subs.length + ')');
}
run().catch(function (e) { console.error('RECALL-DIGEST FATAL', e && e.stack || e); process.exit(1); });
