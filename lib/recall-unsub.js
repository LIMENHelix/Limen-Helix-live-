/**
 * lib/recall-unsub.js — shared one-click unsubscribe token for the Recall Shield digest.
 *
 * The digest email embeds a per-recipient link /api/recall-unsubscribe?e=<email>&t=<token>;
 * the handler verifies the token before marking the lead unsubscribed. Token = HMAC of the
 * lowercased email under a stable secret, so the same email always yields the same link and
 * a stranger can't unsubscribe an address they don't know. Reply-"unsubscribe" stays as a
 * human fallback either way (CAN-SPAM).
 */
'use strict';
var crypto = require('crypto');

function secret() {
  return process.env.RECALL_UNSUB_SECRET || process.env.LEAD_ADMIN_KEY || 'recall-shield-unsub-v1';
}
function norm(email) { return String(email == null ? '' : email).trim().toLowerCase(); }
function token(email) {
  return crypto.createHmac('sha256', secret()).update(norm(email)).digest('hex').slice(0, 20);
}
function url(base, email) {
  return String(base || 'https://limenhelix.com').replace(/\/$/, '') +
    '/api/recall-unsubscribe?e=' + encodeURIComponent(norm(email)) + '&t=' + token(email);
}
module.exports = { token: token, url: url, norm: norm };
