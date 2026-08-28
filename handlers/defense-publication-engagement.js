'use strict';

var crypto = require('node:crypto');
var Store = require('../lib/autofire-efference-store.js');
var Publisher = require('../lib/defense-publication-publisher.js');
var Observer = require('../lib/defense-publication-observer.js');

function cookies(req) {
  var out = {};
  String(req.headers && req.headers.cookie || '').split(';').forEach(function (part) {
    var split = part.indexOf('='); if (split > 0) out[part.slice(0, split).trim()] = part.slice(split + 1).trim();
  });
  return out;
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store, publisher = deps.publisher || Publisher, observer = deps.observer || Observer;
  return async function handler(req, res) {
    res.setHeader('cache-control', 'no-store'); res.setHeader('referrer-policy', 'no-referrer');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    try {
      store.assertDurable();
      var q = Object.fromEntries(new URL(req.url, 'http://local').searchParams);
      var article = q.id && await publisher.getPublic(store, String(q.id));
      if (!article) { res.statusCode = 404; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, error: 'article-not-found' })); }
      var jar = cookies(req), token = jar.limen_publication_visitor;
      if (!token || !/^[a-f0-9]{32}$/.test(token)) {
        token = (deps.randomToken ? deps.randomToken() : crypto.randomBytes(16).toString('hex'));
        res.setHeader('set-cookie', 'limen_publication_visitor=' + token + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax');
      }
      var result = await observer.recordSourceClick(store, article, Number(q.source), token, req.headers || {}, Date.now());
      if (!result.ok) { res.statusCode = 400; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, error: result.reason })); }
      res.statusCode = 302; res.setHeader('location', result.redirectUrl); return res.end();
    } catch (error) {
      res.statusCode = 503; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, error: 'defense-publication-engagement-unavailable' }));
    }
  };
}

var handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
