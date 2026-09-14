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
var religionLearning = require('../lib/religion-subscriber-learning.js');
var intelligenceLearning = require('../lib/intelligence-autopilot-learning.js');
var agricultureLearning = require('../lib/agriculture-homestead-learning.js');
var industryLearning = require('../lib/industry-crm-learning.js');
var defenseLearning = require('../lib/defense-publication-learning.js');
var governanceLearning = require('../lib/governance-publication-learning.js');
var infrastructureLearning = require('../lib/infrastructure-real-estate-learning.js');
var populationLearning = require('../lib/population-real-estate-learning.js');
var tradeLearning = require('../lib/trade-auction-learning.js');
var communicationLearning = require('../lib/communication-social-learning.js');
var cultureLearning = require('../lib/culture-hero-learning.js');
var lawLearning = require('../lib/law-automail-learning.js');
var softSubscriberLanes = require('../lib/soft-domain-subscriber-lanes.js');

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

function compactCompanyPatterns(state) {
  return Object.keys(state && state.companyPatterns || {}).map(function (key) {
    var row = state.companyPatterns[key] || {};
    return {
      schemaVersion: row.schemaVersion || null,
      companyId: row.companyId || key,
      cik: row.cik || null,
      ticker: row.ticker || null,
      resolvedCount: Number(row.resolvedCount || 0),
      outcomes: row.outcomes || null,
      horizons: row.horizons || null,
      means: row.means || null,
      failureModes: row.failureModes || null,
      recommendation: row.recommendation || null,
      lastResolvedAt: row.lastResolvedAt || null
    };
  }).sort(function (a, b) {
    return Number(b.lastResolvedAt || 0) - Number(a.lastResolvedAt || 0);
  }).slice(0, 50);
}

async function readPrimary(domain) {
  store.assertDurable();
  if (domain === 'defense') return defenseLearning.readForBrain(store);
  if (domain === 'governance') return governanceLearning.readForBrain(store);
  if (domain === 'infrastructure') return infrastructureLearning.readForBrain(store);
  if (domain === 'population') return populationLearning.readForBrain(store);
  if (domain === 'supplyChain') return tradeLearning.readForBrain(store);
  if (domain === 'agriculture') return agricultureLearning.readForBrain(store);
  if (domain === 'industry') return industryLearning.readForBrain(store);
  if (domain === 'religion') return religionLearning.readForBrain(store);
  if (domain === 'intelligence') return intelligenceLearning.readForBrain(store);
  if (domain === 'communication') return communicationLearning.readForBrain(store);
  if (domain === 'culture') return cultureLearning.readForBrain(store);
  if (domain === 'law') return lawLearning.readForBrain(store);
  /* Use the learner's strict compatibility loader. States written before the
     external-learning seam are still valid durable brain state; the loader
     supplies an empty externalLearning block in memory without writing Redis.
     Truly malformed owner/lane/kernel state continues to fail closed. */
  var state = await learning._load(store, domain);
  var external = state.externalLearning;
  var signal = external.signals.length ? external.signals[external.signals.length - 1] : null;
  if (!signal) return Object.assign(
    abstained(domain, 'domain-has-no-graded-external-action-outcome', external.resolvedCount),
    { companyPatterns: compactCompanyPatterns(state) }
  );
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
    },
    companyPatterns: compactCompanyPatterns(state)
  };
}

function compactLaneReadout(row) {
  return {
    productDomain: row.productDomain || null,
    lane: row.signal && row.signal.lane || row.lane || null,
    status: row.status,
    reason: row.reason || null,
    resolvedCount: Number(row.resolvedCount || 0),
    ready: !!(row.learningGate && row.learningGate.ready),
    signalId: row.signal && row.signal.signalId || null,
    observedAt: row.signal && row.signal.observedAt || null
  };
}

function validateSubscriberReadout(domain, productDomain, row) {
  if (!row || row.schemaVersion !== learning.EXTERNAL_LEARNING_SCHEMA || row.domain !== domain ||
      row.productDomain !== productDomain || ['ELIGIBLE', 'ABSTAINED'].indexOf(row.status) < 0 ||
      !Number.isInteger(row.resolvedCount) || row.resolvedCount < 0 || !row.learningGate ||
      typeof row.learningGate.ready !== 'boolean' || !Number.isInteger(row.learningGate.distinctSources) ||
      row.learningGate.distinctSources < 0 ||
      row.learningGate.ready !== (row.resolvedCount >= 5 && row.learningGate.distinctSources >= 2)) {
    throw new Error('domain-subscriber-learning-readout-invalid');
  }
  if (row.status === 'ABSTAINED') {
    if (row.signal !== null) throw new Error('domain-subscriber-learning-readout-invalid');
    return row;
  }
  var signal = row.signal;
  if (!signal || signal.schemaVersion !== learning.EXTERNAL_LEARNING_SCHEMA || signal.ownerDomain !== domain ||
      signal.productDomain !== productDomain || signal.lane !== 'subscriber-email' ||
      signal.sourceKind !== 'independent-action-outcome' || !validSource(signal.sourceIdentity) ||
      typeof signal.normalizedCredit !== 'number' || signal.normalizedCredit < 0 || signal.normalizedCredit > 1 ||
      !signal.signalId || !signal.eventId || !signal.actionId || !signal.eventType || !signal.outcome ||
      typeof signal.observedAt !== 'number' || !Number.isFinite(signal.observedAt)) {
    throw new Error('domain-subscriber-learning-signal-invalid');
  }
  return row;
}

function mergeReadouts(domain, rows) {
  var eligible = rows.filter(function (row) { return row && row.status === 'ELIGIBLE' && row.signal; });
  var readyEligible = eligible.filter(function (row) { return row.learningGate && row.learningGate.ready; });
  var candidates = readyEligible.length ? readyEligible : eligible;
  var selected = candidates.slice().sort(function (a, b) {
    return Number(b.signal.observedAt || 0) - Number(a.signal.observedAt || 0);
  })[0] || null;
  var resolvedCount = rows.reduce(function (sum, row) { return sum + Number(row && row.resolvedCount || 0); }, 0);
  var readyRows = rows.filter(function (row) { return row && row.learningGate && row.learningGate.ready; });
  var primary = rows[0] || abstained(domain, 'domain-has-no-graded-external-action-outcome', 0);
  return {
    schemaVersion: learning.EXTERNAL_LEARNING_SCHEMA,
    domain: domain,
    status: selected ? 'ELIGIBLE' : 'ABSTAINED',
    reason: selected ? null : 'domain-has-no-graded-external-action-outcome',
    resolvedCount: resolvedCount,
    learningGate: {
      ready: !!(selected && selected.learningGate && selected.learningGate.ready),
      minimumResolved: 5,
      distinctSources: Number(selected && selected.learningGate && selected.learningGate.distinctSources || 0),
      minimumDistinctSources: 2,
      independentlyQualifiedLanes: readyRows.length,
      selectedLane: selected && selected.signal && selected.signal.lane || null
    },
    signal: selected ? selected.signal : null,
    companyPatterns: primary.companyPatterns,
    laneReadouts: rows.map(compactLaneReadout)
  };
}

async function read(domain) {
  var primary = await readPrimary(domain);
  var productDomain = domain === 'health' ? 'medicine' : domain;
  var subscriberLane = softSubscriberLanes.get(productDomain);
  if (!subscriberLane) return primary;
  var subscriber = validateSubscriberReadout(domain, productDomain, await subscriberLane.learning.readForBrain(store));
  return mergeReadouts(domain, [primary, subscriber]);
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
module.exports.readPrimary = readPrimary;
module.exports.mergeReadouts = mergeReadouts;
module.exports.DOMAINS = DOMAINS.slice();
module.exports.compactCompanyPatterns = compactCompanyPatterns;
module.exports.validateSubscriberReadout = validateSubscriberReadout;
