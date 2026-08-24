'use strict';

/**
 * Read-only source observer for the first real B11/B14 receipt class.
 *
 * The owned journal is a publication receipt, not research progress.  This
 * adapter therefore emits OUTCOME_RESEARCH_PUBLISHED only after a persisted
 * article carries a research lane, command identity, and a content-addressed
 * publication identity.  It never emits OUTCOME_RESEARCH_EVALUATED and never
 * turns publication volume into reward.
 */

var crypto = require('node:crypto');
var contract = require('./autofire-outcome-contract');

var JOURNAL_BASE = 'https://limenhelix.com/journal#';

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function iso(value, name) {
  var parsed = typeof value === 'number' && Number.isFinite(value)
    ? value : Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return { ok: false, reason: name + '-invalid' };
  return { ok: true, value: new Date(parsed).toISOString(), ms: parsed };
}

function text(article) {
  return JSON.stringify({
    id: article.id || null,
    title: article.title || null,
    preview: article.preview || null,
    body: article.body || null,
    sourceCard: article.sourceCard || null,
    provenance: article.provenance || null
  });
}

function abstain(article, reason) {
  return {
    status: 'ABSTAINED',
    reason: reason,
    articleId: article && article.id ? String(article.id) : null
  };
}

/**
 * Turn one already-persisted owned-site article into a contract event.
 * No network or storage is touched here; callers decide whether the source
 * record is durable and how the event is delivered to the learning consumer.
 */
function publicationObservation(article, now) {
  article = article || {};
  if (article.lane !== 'research') return abstain(article, 'not-research-lane');
  if (!article.id) return abstain(article, 'publication-id-missing');
  if (!article.outputId) return abstain(article, 'output-id-missing');
  if (!article.actionId) return abstain(article, 'action-id-missing');
  var published = iso(article.publishedAt, 'published-at');
  if (!published.ok) return abstain(article, published.reason);
  var observed = iso(now === undefined ? Date.now() : now, 'observed-at');
  if (!observed.ok) return abstain(article, observed.reason);

  var url = JOURNAL_BASE + encodeURIComponent(String(article.id));
  var contentHash = 'sha256:' + hash(text(article));
  var ownerDomain = article.ownerDomain || 'research';
  try {
    var event = contract.buildResearchPublication({
      outputId: String(article.outputId),
      actionId: String(article.actionId),
      observationId: 'owned-site-publication:' + String(article.id),
      observedAt: observed.value,
      ownerDomain: ownerDomain,
      publicationId: String(article.id),
      publishedAt: published.value,
      sourceIdentity: {
        kind: 'owned-site-publication',
        value: url,
        publisher: 'LIMEN Helix owned journal',
        url: url,
        retrievedAt: observed.value,
        contentHash: contentHash
      }
    });
    return { status: 'ELIGIBLE', event: event, contentHash: contentHash };
  } catch (err) {
    return abstain(article, err && err.code ? err.code : 'publication-contract-refused');
  }
}

/**
 * Add the event fields used by autofire-learning without changing the
 * contract payload.  The event id is stable across observer retries.
 */
function learningEvent(event) {
  var id = 'evt_' + hash({
    outputId: event.outputId,
    actionId: event.actionId,
    eventType: event.eventType,
    observationId: event.observationId
  }).slice(0, 32);
  var ts = Date.parse(event.observedAt);
  return Object.assign({}, event, {
    eventId: id,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    tsISO: new Date(Number.isFinite(ts) ? ts : Date.now()).toISOString()
  });
}

function inspectArticles(articles, now) {
  articles = Array.isArray(articles) ? articles : [];
  var eligible = [];
  var abstentions = [];
  for (var i = 0; i < articles.length; i++) {
    var result = publicationObservation(articles[i], now);
    if (result.status === 'ELIGIBLE') eligible.push(learningEvent(result.event));
    else abstentions.push(result);
  }
  return {
    examined: articles.length,
    eligible: eligible.length,
    events: eligible,
    abstentions: abstentions
  };
}

module.exports = {
  JOURNAL_BASE: JOURNAL_BASE,
  publicationObservation: publicationObservation,
  learningEvent: learningEvent,
  inspectArticles: inspectArticles
};
