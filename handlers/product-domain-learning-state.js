'use strict';

/**
 * Read-only external action/outcome signal for one sovereign product brain.
 *
 * This exposes no command, prompt, account, or full episodic memory. It reads
 * only the owning domain's strict durable learning key and returns the latest
 * independently sourced, already-graded signal. Missing evidence abstains.
 */

var store = require('../lib/autofire-efference-store.js');
var learning = require('../lib/autofire-learning.js');

var DOMAINS = [
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'health', 'industry',
  'infrastructure', 'intelligence', 'law', 'population', 'religion', 'research',
  'supplyChain', 'technology'
];

function validSource(value) {
  return value && typeof value === 'object' && typeof value.kind === 'string' && value.kind.trim() &&
    typeof value.value === 'string' && value.value.trim();
}

function abstained(domain, reason, resolvedCount) {
  return {
    schemaVersion: learning.EXTERNAL_LEARNING_SCHEMA,
    domain: domain,
    status: 'ABSTAINED',
    reason: reason,
    resolvedCount: Number(resolvedCount || 0),
    learningGate: { ready: false, minimumResolved: 5, distinctSources: 0, minimumDistinctSources: 2 },
    signal: null
  };
}

async function read(domain) {
  store.assertDurable();
  /* Use the learner's strict compatibility loader. States written before the
     external-learning seam are still valid durable brain state; the loader
     supplies an empty externalLearning block in memory without writing Redis.
     Truly malformed owner/lane/kernel state continues to fail closed. */
  var state = await learning._load(store, domain);
  var external = state.externalLearning;
  var signal = external.signals.length ? external.signals[external.signals.length - 1] : null;
  if (!signal) return abstained(domain, 'domain-has-no-graded-external-action-outcome', external.resolvedCount);
  if (signal.schemaVersion !== learning.EXTERNAL_LEARNING_SCHEMA || signal.ownerDomain !== domain ||
      signal.sourceKind !== 'independent-action-outcome' || !validSource(signal.sourceIdentity) ||
      typeof signal.normalizedCredit !== 'number' || signal.normalizedCredit < 0 || signal.normalizedCredit > 1 ||
      !signal.signalId || !signal.eventId || !signal.actionId || typeof signal.observedAt !== 'number') {
    throw new Error('domain-action-learning-signal-invalid');
  }
  var sourceKeys = Object.create(null);
  external.signals.forEach(function (row) {
    if (row && validSource(row.sourceIdentity)) {
      sourceKeys[String(row.sourceIdentity.kind).toLowerCase() + ':' + String(row.sourceIdentity.value).toLowerCase()] = true;
    }
  });
  var distinctSources = Object.keys(sourceKeys).length;
  var resolvedCount = Number(external.resolvedCount || 0);
  return {
    schemaVersion: learning.EXTERNAL_LEARNING_SCHEMA,
    domain: domain,
    status: 'ELIGIBLE',
    reason: null,
    resolvedCount: resolvedCount,
    learningGate: {
      ready: resolvedCount >= 5 && distinctSources >= 2,
      minimumResolved: 5,
      distinctSources: distinctSources,
      minimumDistinctSources: 2
    },
    signal: {
      signalId: signal.signalId,
      eventId: signal.eventId,
      actionId: signal.actionId,
      lane: signal.lane,
      eventType: signal.eventType,
      observedAt: signal.observedAt,
      outcome: signal.outcome,
      normalizedCredit: signal.normalizedCredit,
      sourceKind: signal.sourceKind,
      sourceIdentity: signal.sourceIdentity
    }
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
  }
  var domain = null;
  try { domain = new URL(req.url, 'http://local').searchParams.get('domain'); } catch (_) {}
  if (DOMAINS.indexOf(domain) < 0) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'known product domain required' }));
  }
  try {
    var result = await read(domain);
    res.statusCode = 200;
    return res.end(JSON.stringify(Object.assign({ ok: true }, result)));
  } catch (error) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: 'domain-action-learning-unavailable', detail: String(error && error.message || error) }));
  }
};

module.exports.read = read;
module.exports.DOMAINS = DOMAINS.slice();
