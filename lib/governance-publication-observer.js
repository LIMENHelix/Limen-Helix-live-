'use strict';

var crypto = require('node:crypto');
var Executor = require('./governance-publication-executor.js');
var Publisher = require('./governance-publication-publisher.js');

var SCHEMA = 'governance-publication-observation/1.0';
var LOG_KEY = 'governance_publication_observation_log';
var ENGAGEMENT_LOG_KEY = 'governance_publication_engagement_log';
var PREFIX = 'governance_publication_observation:';
var ENGAGEMENT_PREFIX = 'governance_publication_engagement:';

function hash(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function key(id) { return PREFIX + id; }
function engagementKey(id) { return ENGAGEMENT_PREFIX + id; }

function userActivatedBrowser(headers) {
  headers = headers || {};
  var ua = String(headers['user-agent'] || headers['User-Agent'] || '');
  var accept = String(headers.accept || headers.Accept || '');
  var mode = String(headers['sec-fetch-mode'] || ''), destination = String(headers['sec-fetch-dest'] || '');
  var user = String(headers['sec-fetch-user'] || '');
  return /Mozilla\//.test(ua) && /text\/html|\*\/\*/i.test(accept) && mode === 'navigate' && destination === 'document' && user === '?1' &&
    !/(bot|crawler|spider|headless|curl|wget|preview|monitor)/i.test(ua);
}

async function recordSourceClick(store, article, sourceIndex, visitorToken, headers, now) {
  var index = Number(sourceIndex);
  if (!article || article.schemaVersion !== 'governance-publication-article/1.0' || article.published !== true ||
      !Number.isInteger(index) || index < 0 || index >= article.sources.length || !visitorToken) return { ok: false, reason: 'published-article-source-and-visitor-required' };
  var at = Number(now) || Date.now();
  var visitorIdentityHash = hash(String(visitorToken));
  var day = new Date(at).toISOString().slice(0, 10);
  var source = article.sources[index];
  var eventId = 'gpe_' + hash({ article: article.articleId, source: source.sourceIdentity.value, visitor: visitorIdentityHash, day: day }).slice(0, 24);
  var engagementEligible = userActivatedBrowser(headers);
  var event = {
    schemaVersion: 'governance-publication-engagement/1.0',
    eventId: eventId,
    articleId: article.articleId,
    actionId: article.actionId,
    sourceIndex: index,
    sourceIdentityHash: hash(source.sourceIdentity.value),
    visitorIdentityHash: visitorIdentityHash,
    engagementEligible: engagementEligible,
    trafficClassification: engagementEligible ? 'user-activated-browser-request-unverified-human' : 'non-eligible-automated-or-unverified-request',
    eventType: 'SOURCE_LINK_CLICK',
    observedAt: at,
    independentOfPublishResponse: true,
    rawIpStored: false,
    rawUserAgentStored: false,
    liveMoney: false
  };
  var created = await store.setIfAbsent(engagementKey(eventId), event, 90 * 86400);
  var restored = await store.get(engagementKey(eventId));
  if (!restored || restored.eventId !== eventId || restored.actionId !== article.actionId) throw new Error('governance publication engagement readback invalid');
  if (created) { await store.lpush(ENGAGEMENT_LOG_KEY, restored); await store.ltrim(ENGAGEMENT_LOG_KEY, 0, 4999); }
  return { ok: true, duplicate: !created, event: restored, redirectUrl: source.url };
}

async function observePresence(store, command, fetcher, baseUrl) {
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'PUBLISHED' || !command.articleId || !command.contentHash) {
    return { ok: false, status: 'REFUSED', reason: 'published-command-receipt-required', publishEndpointCalled: false };
  }
  var url = String(baseUrl || 'https://limenhelix.com').replace(/\/$/, '') + '/api/governance-publication-public?id=' + encodeURIComponent(command.articleId);
  var response;
  try { response = await fetcher(url, { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'limen-governance-publication-observer/1.0' }, signal: AbortSignal.timeout(15000) }); }
  catch (_) { return { ok: true, status: 'PUBLIC_PRESENCE_PENDING', commandId: command.commandId, articleId: command.articleId, publishEndpointCalled: false }; }
  var body = await response.json().catch(function () { return {}; });
  var article = body && body.article;
  var present = response.ok && article && article.articleId === command.articleId && article.contentHash === command.contentHash;
  var observation = {
    schemaVersion: SCHEMA,
    observationId: 'gpo_' + hash({ command: command.commandId, status: response.status, content: article && article.contentHash }).slice(0, 24),
    commandId: command.commandId, actionId: command.actionId, articleId: command.articleId,
    status: present ? 'PUBLIC_PRESENCE_OBSERVED' : 'PUBLIC_ABSENCE_OR_MISMATCH_OBSERVED',
    httpStatus: response.status, contentHash: article && article.contentHash || null,
    independentPublicRead: true, publishEndpointCalled: false,
    engagementEligible: false, observedAt: Date.now(), liveMoney: false
  };
  var created = await store.setIfAbsent(key(observation.observationId), observation);
  var restored = await store.get(key(observation.observationId));
  if (!restored || restored.status !== observation.status) throw new Error('governance publication presence readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 1999); }
  return restored;
}

async function observeEngagement(store, event, commandsByAction) {
  if (!event || event.schemaVersion !== 'governance-publication-engagement/1.0' || event.eventType !== 'SOURCE_LINK_CLICK') {
    return { ok: false, status: 'REFUSED', reason: 'source-click-event-required' };
  }
  var command = commandsByAction && commandsByAction[event.actionId];
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'PUBLISHED' || command.articleId !== event.articleId) {
    return { ok: false, status: 'REFUSED', reason: 'matching-published-command-required' };
  }
  var observation = {
    schemaVersion: SCHEMA,
    observationId: 'gpo_' + hash({ command: command.commandId, event: event.eventId }).slice(0, 24),
    commandId: command.commandId, actionId: command.actionId, articleId: command.articleId,
    eventId: event.eventId, sourceIdentityHash: event.sourceIdentityHash,
    visitorIdentityHash: event.visitorIdentityHash,
    status: 'SOURCE_CLICK_OBSERVED',
    engagementEligible: event.engagementEligible === true,
    trafficClassification: event.trafficClassification,
    independentOfPublishResponse: true,
    publishEndpointCalled: false,
    observedAt: event.observedAt,
    liveMoney: false
  };
  var created = await store.setIfAbsent(key(observation.observationId), observation);
  var restored = await store.get(key(observation.observationId));
  if (!restored || restored.status !== observation.status) throw new Error('governance publication engagement observation readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 1999); }
  return Object.assign({ ok: true, duplicate: !created }, restored);
}

async function publicAbsent(fetcher, articleId, baseUrl) {
  var url = String(baseUrl || 'https://limenhelix.com').replace(/\/$/, '') + '/api/governance-publication-public?id=' + encodeURIComponent(articleId);
  url += '&verify=' + encodeURIComponent(String(Date.now()));
  try { var response = await fetcher(url, { method: 'GET', headers: { accept: 'application/json', 'cache-control': 'no-cache' }, cache: 'no-store', signal: AbortSignal.timeout(15000) }); return response.status === 404; }
  catch (_) { return false; }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, ENGAGEMENT_LOG_KEY: ENGAGEMENT_LOG_KEY,
  key: key, engagementKey: engagementKey, userActivatedBrowser: userActivatedBrowser, recordSourceClick: recordSourceClick,
  observePresence: observePresence, observeEngagement: observeEngagement, publicAbsent: publicAbsent,
  articleKey: Publisher.articleKey };
