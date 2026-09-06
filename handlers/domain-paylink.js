'use strict';

/**
 * api/domain-paylink.js — mint a Stripe payment link for ANY of the twenty domains.
 *
 *   POST /api/domain-paylink   { domain, name, amountCents }   → { ok, url, ... }
 *   GET  /api/domain-paylink                                    → every minted link
 *   GET  /api/domain-paylink?domain=medicine                    → one domain's links
 *
 * This is the missing step that puts Stripe on every domain. The rail could already
 * stamp a domain onto a link and the webhook could already book a marked sale into that
 * domain's treasury account; nothing called it with a domain. Now this does.
 *
 * WHY A PAYMENT LINK. It is a hosted URL. A domain drops it into any page, button or
 * email as an href, with no checkout code, no keys and no integration on the selling
 * page. Stripe hosts the payment form and owns the price.
 *
 * THE PRICE NEVER COMES FROM THE BUYER. It is set here, at mint time, by an operator
 * holding the master key, and then lives on Stripe's Price object. The buying page
 * cannot alter it, because the buying page is just a link.
 *
 * ALL TWENTY, INCLUDING THE ONES WITH NOTHING TO SELL. communication, culture, energy,
 * industry and infrastructure have no catalog rung. They can still mint a link for
 * whatever they decide to sell, which is the entire point: a domain does not need a
 * pre-declared subscription product to take money.
 *
 * MASTER KEY ONLY. Minting creates real Stripe objects on a live account and publishes a
 * URL that charges real cards. That is an outward action, so it sits behind the same gate
 * as the treasury and is never reachable from a public page.
 */

var Gate = require('../lib/admin-gate.js');
var stripeRail = require('../lib/stripe-rail.js');
var Treasury = require('../lib/civilization-treasury-ledger.js');
var db = require('../lib/limen-db.js');

var LINKS_KEY = 'domain:paylinks:v1';
var MAX_NAME = 120;

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'private, no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var chunks = '';
    req.on('data', function (c) { chunks += c; if (chunks.length > 64000) chunks = chunks.slice(0, 64000); });
    req.on('end', function () {
      try { resolve(JSON.parse(chunks || '{}')); } catch (_) { resolve({}); }
    });
    req.on('error', function () { resolve({}); });
  });
}

function queryParam(req, name) {
  try {
    var u = new URL(req.url || '/', 'https://limenhelix.com');
    return String(u.searchParams.get(name) || '').trim();
  } catch (_) { return ''; }
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * The idempotency key for a mint.
 *
 * A live Stripe account accumulates a Product and a Price for every call, and those
 * cannot be cleaned up from here. Re-POSTing the same offer must return the link that
 * already exists rather than minting a second identical one, so the key is exactly the
 * three things that define the offer.
 */
function linkKey(domain, name, amountCents) {
  return domain + ':' + slug(name) + ':' + amountCents;
}

function createHandler(deps) {
  deps = deps || {};
  var gate = deps.gate || Gate;
  var rail = deps.rail || stripeRail;
  var treasury = deps.treasury || Treasury;
  var store = deps.store || db;

  return async function handler(req, res) {
    var pass = gate.reqKey(req);
    if (!gate.isMaster(pass)) return gate.deny(res);

    var method = String(req.method || 'GET').toUpperCase();

    if (method === 'GET') {
      var all = (await store.get(LINKS_KEY)) || {};
      var wanted = queryParam(req, 'domain').toLowerCase();
      var rows = Object.keys(all).map(function (k) { return all[k]; });
      if (wanted) rows = rows.filter(function (r) { return r.domain === wanted; });
      /* Every domain is listed, including the ones holding no links, so an empty account
         is visibly empty rather than absent. */
      var byDomain = {};
      treasury.DOMAINS.forEach(function (d) { byDomain[d] = []; });
      rows.forEach(function (r) { if (byDomain[r.domain]) byDomain[r.domain].push(r); });
      return send(res, 200, {
        ok: true,
        stripeLive: rail.hasKey(),
        keyMode: rail.keyMode(),
        domains: treasury.DOMAINS.length,
        totalLinks: rows.length,
        byDomain: byDomain
      });
    }

    if (method !== 'POST') {
      return send(res, 405, { ok: false, error: 'GET to list, POST to mint' });
    }

    var body = await readBody(req);
    var domain = String(body.domain || '').trim().toLowerCase();
    var name = String(body.name || '').trim().slice(0, MAX_NAME);
    var amountCents = Number(body.amountCents);

    if (treasury.DOMAINS.indexOf(domain) < 0) {
      return send(res, 400, {
        ok: false,
        error: 'domain must be one of the twenty product domains',
        domains: treasury.DOMAINS
      });
    }
    if (!name) return send(res, 400, { ok: false, error: 'name is required; it is what the buyer sees on the Stripe page' });
    if (!Number.isSafeInteger(amountCents) || amountCents < 50) {
      return send(res, 400, { ok: false, error: 'amountCents must be a whole number of cents, at least 50' });
    }
    if (!rail.hasKey()) {
      return send(res, 503, { ok: false, error: 'no Stripe key on this deployment; nothing was minted' });
    }

    var key = linkKey(domain, name, amountCents);
    var existing = (await store.get(LINKS_KEY)) || {};
    if (existing[key] && existing[key].url) {
      return send(res, 200, Object.assign({ ok: true, reused: true }, existing[key]));
    }

    var minted = await rail.createPaymentLink({
      domain: domain,
      name: name,
      amountCents: amountCents,
      streamId: body.streamId || ''
    });
    if (!minted.ok) return send(res, 502, { ok: false, error: minted.error || 'stripe refused the link' });

    var row = {
      key: key, domain: domain, name: name, amountCents: amountCents,
      url: minted.url, paymentLinkId: minted.paymentLinkId,
      priceId: minted.priceId, productId: minted.productId,
      booksToTreasury: minted.booksToTreasury === true,
      mintedAt: new Date().toISOString()
    };

    /* Persisted AFTER Stripe confirms, so the store never advertises a link that does not
       exist. The reverse order would leave a dead URL in the listing on a failed mint. */
    existing[key] = row;
    await store.set(LINKS_KEY, existing);

    return send(res, 200, Object.assign({ ok: true, reused: false }, row));
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.LINKS_KEY = LINKS_KEY;
module.exports._linkKey = linkKey;
