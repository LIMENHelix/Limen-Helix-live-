'use strict';

var assert = require('node:assert/strict');
var path = require('node:path');
var ROOT = path.join(__dirname, '..');
var HANDLER = path.join(ROOT, 'handlers', 'product-domain-learning-state.js');
var STORE = path.join(ROOT, 'lib', 'autofire-efference-store.js');

function response() {
  return { statusCode: 200, body: '', headers: {}, setHeader: function (k, v) { this.headers[k] = v; }, end: function (v) { this.body = v || ''; } };
}
async function invoke(handler, url, method) {
  var res = response();
  await handler({ method: method || 'GET', url: url }, res);
  return { code: res.statusCode, body: JSON.parse(res.body || '{}') };
}

(async function () {
  var replacement = require.cache[require.resolve(STORE)];
  var fail = false;
  var values = {
    'autofire_learning_state:research': {
      stateVersion: 1,
      domain: 'research',
      lane: 'research',
      modulators: {},
      memory: {},
      consolidator: {},
      outwardGate: {},
      externalLearning: {
        schemaVersion: 'product-domain-external-learning/1.0', resolvedCount: 5,
        signals: [1, 2, 3, 4, 5].map(function (n) { return {
          schemaVersion: 'product-domain-external-learning/1.0', signalId: 'els_evt_' + n, eventId: 'evt_' + n, actionId: 'act_' + n,
          ownerDomain: 'research', lane: 'research', eventType: 'OUTCOME_RESEARCH_EVALUATED', observedAt: 995 + n,
          outcome: 'PROGRESS', normalizedCredit: 1, sourceKind: 'independent-action-outcome',
          sourceIdentity: { kind: 'external-evaluator', value: n < 5 ? 'panel:a' : 'panel:b' }
        }; })
      }
    },
    'autofire_learning_state:health': {
      stateVersion: 1,
      domain: 'health',
      lane: 'research',
      modulators: {},
      memory: {},
      consolidator: {},
      outwardGate: {}
    },
    'autofire_learning_state:finance': {
      stateVersion: 999,
      domain: 'finance',
      lane: 'investment',
      modulators: {},
      memory: {},
      consolidator: {},
      outwardGate: {}
    },
    'religion_subscriber_learning_state': {
      schemaVersion: 'religion-subscriber-learning/1.0', domain: 'religion', lane: 'subscriber-email', resolvedCount: 5,
      processedObservationIds: ['o1', 'o2', 'o3', 'o4', 'o5'], lastOutcomeAt: 1000,
      signals: [1, 2, 3, 4, 5].map(function (n) { return {
        schemaVersion: 'product-domain-external-learning/1.0', signalId: 'religion-signal-' + n,
        eventId: 'religion-observation-' + n, actionId: 'religion-action-' + n, ownerDomain: 'religion',
        lane: 'subscriber-email', eventType: 'OUTCOME_SUBSCRIBER_DELIVERED', observedAt: 995 + n,
        outcome: 'delivered', normalizedCredit: 0.5, sourceKind: 'independent-action-outcome',
        sourceIdentity: { kind: 'resend-read-api-mail-server-event', value: 'email-' + n }
      }; })
    },
    'intelligence_autopilot_learning_state': {
      schemaVersion: 'intelligence-autopilot-learning/1.0', domain: 'intelligence', lane: 'autopilot', resolvedCount: 5,
      processedObservationIds: ['i1', 'i2', 'i3', 'i4', 'i5'],
      signals: [1, 2, 3, 4, 5].map(function (n) { return {
        schemaVersion: 'product-domain-external-learning/1.0', signalId: 'intelligence-signal-' + n,
        eventId: 'intelligence-observation-' + n, actionId: 'intelligence-action-' + n, ownerDomain: 'intelligence',
        lane: 'autopilot', eventType: 'OUTCOME_AUTOPILOT_DELIVERED', observedAt: 995 + n,
        outcome: 'delivered', normalizedCredit: 0.5, sourceKind: 'independent-action-outcome',
        sourceIdentity: { kind: 'resend-read-api-mail-server-event', value: 'intelligence-email-' + n }
      }; })
    }
  };
  require.cache[require.resolve(STORE)] = { id: require.resolve(STORE), filename: require.resolve(STORE), loaded: true, exports: {
    assertDurable: function () { if (fail) throw new Error('redis unavailable'); },
    get: async function (key) { return values[key] || null; }
  } };
  delete require.cache[require.resolve(HANDLER)];
  var handler = require(HANDLER);
  try {
    var eligible = await invoke(handler, '/api/product-domain-learning-state?domain=research');
    assert.equal(eligible.code, 200);
    assert.equal(eligible.body.status, 'ELIGIBLE');
    assert.equal(eligible.body.resolvedCount, 5);
    assert.equal(eligible.body.signal.normalizedCredit, 1);
    assert.equal(eligible.body.signal.sourceKind, 'independent-action-outcome');
    assert.equal(eligible.body.learningGate.ready, true);
    assert.equal(eligible.body.learningGate.distinctSources, 2);
    assert.equal(eligible.body.commands, undefined);

    var absent = await invoke(handler, '/api/product-domain-learning-state?domain=agriculture');
    assert.equal(absent.code, 200);
    assert.equal(absent.body.status, 'ABSTAINED');
    assert.equal(absent.body.signal, null);

    var legacy = await invoke(handler, '/api/product-domain-learning-state?domain=health');
    assert.equal(legacy.code, 200);
    assert.equal(legacy.body.status, 'ABSTAINED');
    assert.equal(legacy.body.reason, 'domain-has-no-graded-external-action-outcome');
    assert.equal(legacy.body.signal, null);

    var religion = await invoke(handler, '/api/product-domain-learning-state?domain=religion');
    assert.equal(religion.code, 200);
    assert.equal(religion.body.status, 'ELIGIBLE');
    assert.equal(religion.body.learningGate.ready, true);
    assert.equal(religion.body.signal.lane, 'subscriber-email');
    assert.equal(religion.body.signal.normalizedCredit, 0.5);

    var intelligence = await invoke(handler, '/api/product-domain-learning-state?domain=intelligence');
    assert.equal(intelligence.code, 200);
    assert.equal(intelligence.body.status, 'ELIGIBLE');
    assert.equal(intelligence.body.learningGate.ready, true);
    assert.equal(intelligence.body.signal.lane, 'autopilot');

    var malformed = await invoke(handler, '/api/product-domain-learning-state?domain=finance');
    assert.equal(malformed.code, 503);
    assert.equal(malformed.body.detail, 'malformed autofire learning state for finance');

    var unknown = await invoke(handler, '/api/product-domain-learning-state?domain=unknown');
    assert.equal(unknown.code, 400);
    var method = await invoke(handler, '/api/product-domain-learning-state?domain=research', 'POST');
    assert.equal(method.code, 405);

    fail = true;
    var unavailable = await invoke(handler, '/api/product-domain-learning-state?domain=research');
    assert.equal(unavailable.code, 503);
    console.log('product domain learning state handler: sanitized eligible, abstention, validation, and strict durability passed');
  } finally {
    delete require.cache[require.resolve(HANDLER)];
    if (replacement) require.cache[require.resolve(STORE)] = replacement; else delete require.cache[require.resolve(STORE)];
  }
})().catch(function (error) { console.error(error); process.exit(1); });
