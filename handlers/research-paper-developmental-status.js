'use strict';

/** Public, sanitized, read-only status for the two developmental research slots. */

var Store = require('../lib/autofire-efference-store.js');
var Developmental = require('../lib/research-paper-developmental-authority.js');

var STATUSES = {
  CLAIMED: true,
  ARTIFACT_PERSISTED: true,
  ATTEMPT_RESOLVED_NO_ARTIFACT: true
};

function boundedTime(value) {
  var at = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
}
function publicStatus(productDomain, record) {
  var identity = Developmental.OWNERS[productDomain];
  if (!identity) throw new Error('research-developmental-owner-invalid');
  if (!record) return {
    productDomain: productDomain,
    ownerDomain: identity.ownerDomain,
    status: 'NOT_CLAIMED',
    claimedAt: null,
    resolvedAt: null,
    providerCalled: false,
    outputId: null,
    viewerUrl: null,
    budgetDebitEstimateUsd: 0,
    artifactGenerationOnly: true,
    publicationAuthorized: false,
    externalPublication: false,
    paperOnly: true,
    liveMoney: false
  };
  if (record.schemaVersion !== Developmental.SCHEMA || !STATUSES[record.status] ||
      record.productDomain !== productDomain || record.ownerDomain !== identity.ownerDomain ||
      record.contractId !== identity.contractId || record.lane !== identity.lane ||
      record.budgetId !== identity.budgetId || record.artifactGenerationOnly !== true ||
      record.publicationAuthorized !== false || record.saleAuthorized !== false ||
      record.paperOnly !== true || record.liveMoney !== false) {
    throw new Error('research-developmental-state-invalid');
  }
  var outputId = record.status === 'ARTIFACT_PERSISTED' && typeof record.outputId === 'string' &&
    /^[A-Za-z0-9:._-]+$/.test(record.outputId) ? record.outputId : null;
  if (record.status === 'ARTIFACT_PERSISTED' && (!outputId || record.externalPublication !== false)) {
    throw new Error('research-developmental-artifact-state-invalid');
  }
  var spend = Number(record.budgetDebitEstimateUsd || 0);
  if (!Number.isFinite(spend) || spend < 0 || spend > Developmental.ESTIMATED_CALL_BUDGET_USD) {
    throw new Error('research-developmental-budget-state-invalid');
  }
  return {
    productDomain: productDomain,
    ownerDomain: identity.ownerDomain,
    status: record.status,
    claimedAt: boundedTime(record.claimedAt),
    resolvedAt: boundedTime(record.resolvedAt),
    providerCalled: record.providerCalled === true,
    outputId: outputId,
    viewerUrl: outputId ? 'https://limenhelix.com/helix-artifact?id=' + encodeURIComponent(outputId) : null,
    budgetDebitEstimateUsd: spend,
    artifactGenerationOnly: true,
    publicationAuthorized: false,
    externalPublication: false,
    paperOnly: true,
    liveMoney: false
  };
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET');
      return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    try {
      store.assertDurable();
      var rows = await Promise.all(['science', 'medicine'].map(async function (domain) {
        return publicStatus(domain, await store.get(Developmental.slotKey(domain)));
      }));
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        schemaVersion: 'research-paper-developmental-status/1.0',
        domains: rows,
        paperOnly: true,
        liveMoney: false,
        measuredAt: new Date().toISOString()
      }));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({
        ok: false,
        error: 'research-paper-developmental-status-unavailable',
        paperOnly: true,
        liveMoney: false
      }));
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.publicStatus = publicStatus;
module.exports = handler;
