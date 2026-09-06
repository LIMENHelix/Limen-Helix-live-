/**
 * lib/watch-purchase-delivery.js — the send that cannot wait on a domain brain.
 *
 * Stripe Watch checkouts already try the religion/finance B10 motors. Those motors
 * HOLD when cognition is stale or an immune veto is up, so a paid customer can get
 * no mail at all. This module is the fallback: one receipt, one access URL, and a
 * best-effort first briefing. It never grants access (only Stripe flips `active`)
 * and it never moves money.
 *
 * Callers must not put `crm.sendToLead` in handlers/stripe-webhook.js; this file
 * is the send chokepoint so the motor-gate test stays honest.
 */
'use strict';

var crm = require('./crm-send.js');
var digest = require('./digest.js');
var db = require('./limen-db.js');

var SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';
var SEEN_KEY = 'watch:purchase-delivery:v1';
var SEEN_CAP = 400;
var BRIEFING_MS = 3000;

function money(cents) { return '$' + ((cents || 0) / 100).toFixed(2); }
function today() { return new Date().toISOString().slice(0, 10); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }
function accessUrl(domain) { return SITE + '/' + String(domain || '').toLowerCase(); }
function deliveryId(eventId, kind) { return String(eventId || '').trim() + ':' + String(kind || '').trim(); }

async function alreadyDelivered(id, store) {
  if (!id) return false;
  try {
    var seen = await (store || db).get(SEEN_KEY);
    return Array.isArray(seen) && seen.indexOf(id) !== -1;
  } catch (e) { return false; }
}

async function markDelivered(id, store) {
  if (!id) return;
  try {
    var dbx = store || db;
    var seen = await dbx.get(SEEN_KEY);
    if (!Array.isArray(seen)) seen = [];
    seen.unshift(id);
    await dbx.set(SEEN_KEY, seen.slice(0, SEEN_CAP));
  } catch (e) {}
}

function compose(input, briefing) {
  input = input || {};
  var sub = input.subscriber || {};
  var offer = input.offer || null;
  var kind = String(input.kind || 'welcome');
  var paidCents = input.paidCents != null ? input.paidCents : sub.priceCents;
  var url = accessUrl(sub.domain);
  var item = (offer && offer.name) || sub.offer || sub.rung || 'your LIMEN watch';
  var isWelcome = kind === 'welcome';
  var lines = [];
  lines.push(isWelcome ? 'Thanks for subscribing. Your watch is active.' : 'Your subscription renewed. Your watch stays active.');
  lines.push('');
  lines.push('--- RECEIPT ---');
  lines.push('Item:    ' + item + ' (' + (sub.domain || 'watch') + ')');
  lines.push('Paid:    ' + money(paidCents));
  lines.push('Date:    ' + today());
  if (sub.priceCents != null) lines.push('Renews:  monthly, ' + money(sub.priceCents) + ' until cancelled');
  if (sub.subscriptionId) lines.push('Ref:     ' + sub.subscriptionId);
  lines.push('---------------');
  lines.push('');
  if (offer && offer.line) lines.push(offer.line);
  if (sub.watch) lines.push('We are watching: ' + sub.watch);
  if (offer && offer.cadence) lines.push('How often it moves: ' + offer.cadence);
  lines.push('');
  lines.push('YOUR ACCESS');
  lines.push('Open your watch any time: ' + url);
  lines.push('The live tools on that page are yours to use. Paid delivery is this email and the briefings that follow.');
  lines.push('');
  if (briefing && briefing.body) {
    lines.push('--- FIRST BRIEFING ---');
    lines.push(String(briefing.body).trim());
    lines.push('');
  } else {
    lines.push('A live briefing is attached when the source is up. If it is not here, use the watch page above. Later runs send when the figures move.');
    lines.push('');
  }
  lines.push('To cancel, reply to this email and we will stop the subscription.');
  return {
    subject: (isWelcome ? 'Receipt and access: ' : 'Receipt and continued access: ') + item,
    body: lines.join('\n'),
    accessUrl: url
  };
}

function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise).catch(function () { return null; }),
    new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); })
  ]);
}

async function firstBriefing(sub, buildFor, timeoutMs) {
  if (!sub || !sub.domain) return null;
  var builder = buildFor || digest.buildFor;
  var ms = timeoutMs == null ? BRIEFING_MS : timeoutMs;
  var built = await withTimeout(builder(sub), ms);
  return (built && built.body) ? built : null;
}

async function deliver(input) {
  input = input || {};
  var kind = String(input.kind || '').trim();
  var eventId = String(input.eventId || '').trim();
  var sub = input.subscriber;
  if (!eventId || (kind !== 'welcome' && kind !== 'renewal')) {
    return { ok: false, status: 'REFUSED', reason: 'event-and-kind-required', sent: false };
  }
  if (!sub || !sub.domain) {
    return { ok: false, status: 'REFUSED', reason: 'subscriber-required', sent: false };
  }

  var id = deliveryId(eventId, kind);
  var store = input.store || null;
  if (await alreadyDelivered(id, store)) {
    return { ok: true, status: 'DUPLICATE', reason: 'already-delivered', sent: false, replayed: true, accessUrl: accessUrl(sub.domain) };
  }

  var email = String(sub.email || '').trim();
  if (!validEmail(email)) {
    return { ok: false, status: 'NO_EMAIL', reason: 'no-valid-email', sent: false, accessUrl: accessUrl(sub.domain) };
  }

  var send = input.send || function (to, subject, body, options) {
    return crm.sendToLead(to, subject, body, options);
  };

  var briefing = await firstBriefing(sub, input.buildFor, input.briefingTimeoutMs);
  var message = compose(input, briefing);
  var sent = await send(email, message.subject, message.body, {
    idempotencyKey: 'watch-purchase-delivery/' + id
  });

  if (sent && sent.ok) {
    await markDelivered(id, store);
    return {
      ok: true,
      status: 'SENT',
      sent: true,
      providerEmailId: sent.id || null,
      briefingAttached: !!(briefing && briefing.body),
      accessUrl: message.accessUrl
    };
  }
  if (sent && sent.notReady) {
    return {
      ok: false,
      status: 'NOT_READY',
      reason: sent.error || 'email-not-ready',
      sent: false,
      accessUrl: message.accessUrl
    };
  }
  if (sent && sent.suppressed) {
    await markDelivered(id, store);
    return { ok: false, status: 'SUPPRESSED', reason: 'suppressed', sent: false, accessUrl: message.accessUrl };
  }
  return {
    ok: false,
    status: 'FAILED',
    reason: (sent && sent.error) || 'send-failed',
    sent: false,
    accessUrl: message.accessUrl
  };
}

module.exports = {
  SEEN_KEY: SEEN_KEY,
  accessUrl: accessUrl,
  compose: compose,
  firstBriefing: firstBriefing,
  deliver: deliver
};
