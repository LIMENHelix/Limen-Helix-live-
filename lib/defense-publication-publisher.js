'use strict';

var Source = require('./defense-publication-source.js');
var INDEX_KEY = 'defense_publication_public_index';
var ARTICLE_PREFIX = 'defense_publication_article:';

function articleKey(articleId) { return ARTICLE_PREFIX + articleId; }

async function publish(store, candidate, actionId, now) {
  if (!Source.validate(candidate) || !actionId) return { ok: false, definitiveFailure: true, error: 'validated-candidate-and-action-required', providerCalled: false };
  var at = Number(now) || Date.now();
  var articleId = 'def_' + Source.hash({ action: actionId, content: candidate.contentHash }).slice(0, 24);
  var article = {
    schemaVersion: 'defense-publication-article/1.0',
    articleId: articleId,
    actionId: actionId,
    productDomain: 'defense', ownerDomain: 'defense', lane: 'publication',
    title: candidate.title, summary: candidate.summary, body: candidate.body, disclaimer: candidate.disclaimer,
    sources: candidate.sources,
    contentHash: candidate.contentHash,
    sourceFingerprint: candidate.sourceFingerprint,
    defensePacketId: candidate.defensePacketId,
    brainSelection: candidate.brainSelection,
    stressScore: candidate.stressScore,
    phase: candidate.phase,
    diagnoses: candidate.diagnoses,
    status: 'PUBLISHED', published: true,
    publishedAt: new Date(at).toISOString(),
    publicPath: '/defense-briefs?id=' + encodeURIComponent(articleId),
    providerCalled: false,
    liveMoney: false
  };
  var created = await store.setIfAbsent(articleKey(articleId), article);
  var restored = await store.get(articleKey(articleId));
  if (!restored || restored.articleId !== articleId || restored.contentHash !== candidate.contentHash || restored.published !== true) throw new Error('defense publication article readback invalid');
  if (created) {
    await store.lpush(INDEX_KEY, { articleId: articleId, actionId: actionId, publishedAt: article.publishedAt });
    await store.ltrim(INDEX_KEY, 0, 499);
  }
  return { ok: true, articleId: articleId, publicPath: article.publicPath, created: created, providerCalled: false };
}

async function unpublish(store, articleId, recoveryId, now) {
  var article = await store.get(articleKey(articleId));
  if (!article || article.articleId !== articleId) return { ok: false, definitiveFailure: true, error: 'article-not-found', providerCalled: false };
  article.published = false;
  article.status = 'UNPUBLISHED';
  article.recoveryId = recoveryId;
  article.unpublishedAt = new Date(Number(now) || Date.now()).toISOString();
  await store.set(articleKey(articleId), article);
  var restored = await store.get(articleKey(articleId));
  if (!restored || restored.published !== false || restored.recoveryId !== recoveryId) throw new Error('defense publication unpublish readback invalid');
  return { ok: true, articleId: articleId, providerCalled: false };
}

async function getPublic(store, articleId) {
  var article = await store.get(articleKey(articleId));
  return article && article.published === true && article.status === 'PUBLISHED' ? article : null;
}

async function listPublic(store, limit) {
  var refs = await store.lrange(INDEX_KEY, 0, Math.max(0, Math.min(100, Number(limit) || 20) - 1));
  var out = [];
  for (var i = 0; i < refs.length; i++) {
    var article = refs[i] && await getPublic(store, refs[i].articleId);
    if (article) out.push(article);
  }
  return out;
}

module.exports = { INDEX_KEY: INDEX_KEY, ARTICLE_PREFIX: ARTICLE_PREFIX, articleKey: articleKey, publish: publish, unpublish: unpublish, getPublic: getPublic, listPublic: listPublic };
