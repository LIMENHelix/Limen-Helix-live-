'use strict';

var assert = require('assert');
var O = require('../lib/autofire-outcome-observer');

var article = {
  id: 'article-research-1',
  lane: 'research',
  ownerDomain: 'research',
  outputId: 'eo_research_1',
  actionId: 'act_research_1',
  title: 'A source-grounded study',
  body: 'A persisted research publication receipt.',
  publishedAt: '2026-08-24T00:00:00Z',
  provenance: { generatedAt: '2026-08-23T23:59:00Z' }
};
var now = Date.parse('2026-08-24T01:00:00Z');
var one = O.publicationObservation(article, now);
assert.strictEqual(one.status, 'ELIGIBLE');
assert.strictEqual(one.event.eventType, 'OUTCOME_RESEARCH_PUBLISHED');
assert.strictEqual(one.event.outcomeData.publicationId, article.id);
assert.strictEqual(one.event.outcomeData.publishedAt, '2026-08-24T00:00:00.000Z');
assert.strictEqual(one.event.sourceIdentity.publisher, 'LIMEN Helix owned journal');
assert.ok(/^sha256:[0-9a-f]{64}$/.test(one.event.sourceIdentity.contentHash));
assert.strictEqual(one.event.outcomeData.independenceAssessment.status, 'UNESTABLISHED');

var learning = O.learningEvent(one.event);
assert.ok(/^evt_[0-9a-f]{32}$/.test(learning.eventId));
assert.strictEqual(learning.ts, now);
assert.strictEqual(O.learningEvent(one.event).eventId, learning.eventId);

var inspected = O.inspectArticles([article, Object.assign({}, article, { id: 'non-research', lane: 'investment' }), { id: 'missing-lane' }], now);
assert.strictEqual(inspected.examined, 3);
assert.strictEqual(inspected.eligible, 1);
assert.strictEqual(inspected.events.length, 1);
assert.ok(inspected.abstentions.some(function (x) { return x.reason === 'not-research-lane'; }));

assert.strictEqual(O.publicationObservation(Object.assign({}, article, { actionId: null }), now).reason, 'action-id-missing');
assert.strictEqual(O.publicationObservation(Object.assign({}, article, { publishedAt: 'not-a-date' }), now).reason, 'published-at-invalid');
assert.strictEqual(O.publicationObservation(Object.assign({}, article, { outputId: null }), now).reason, 'output-id-missing');

console.log('autofire outcome observer: 17/17 passed');

