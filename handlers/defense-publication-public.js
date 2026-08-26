'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Publisher = require('../lib/defense-publication-publisher.js');

function project(article) {
  return {
    schemaVersion: article.schemaVersion, articleId: article.articleId, actionId: article.actionId,
    productDomain: 'defense', ownerDomain: 'defense', lane: 'publication',
    title: article.title, summary: article.summary, body: article.body, disclaimer: article.disclaimer,
    sources: article.sources, contentHash: article.contentHash, brainSelection: article.brainSelection,
    stressScore: article.stressScore, phase: article.phase, diagnoses: article.diagnoses,
    publishedAt: article.publishedAt, publicPath: article.publicPath, liveMoney: false
  };
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store, publisher = deps.publisher || Publisher;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'public, max-age=30, stale-while-revalidate=60');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    try {
      store.assertDurable();
      var q = Object.fromEntries(new URL(req.url, 'http://local').searchParams);
      if (q.id) {
        res.setHeader('cache-control', 'no-store');
        var article = await publisher.getPublic(store, String(q.id));
        if (!article) { res.statusCode = 404; return res.end(JSON.stringify({ ok: false, error: 'article-not-found' })); }
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, article: project(article), readOnly: true }));
      }
      var list = await publisher.listPublic(store, Math.max(1, Math.min(50, Number(q.limit) || 20)));
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, articles: list.map(project), readOnly: true }));
    } catch (error) {
      res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'defense-publication-public-unavailable' }));
    }
  };
}

var handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.project = project;
