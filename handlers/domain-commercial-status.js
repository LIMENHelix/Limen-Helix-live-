'use strict';

/** Protected, read-only view of one or all sovereign commercial reflexes. */
var Gate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/domain-commercial-lanes.js');

function query(req) {
  try { return new URL(req.url, 'http://local').searchParams; }
  catch (_) { return new URLSearchParams(''); }
}

function compact(state) {
  if (!state) return null;
  return {
    schemaVersion: state.schemaVersion,
    productDomain: state.productDomain,
    ownerDomain: state.ownerDomain,
    status: state.status,
    reason: state.reason || null,
    packetId: state.packetId || null,
    phase: state.phase == null ? null : state.phase,
    priority: state.priority == null ? null : state.priority,
    evaluatedAt: state.evaluatedAt || null,
    persistedAt: state.persistedAt || null,
    readbackVerified: state.readbackVerified === true,
    homology: state.homology || null,
    intent: state.intent ? {
      intentId: state.intent.intentId,
      status: state.intent.status,
      selectedProgram: state.intent.selectedProgram,
      cadence: state.intent.cadence,
      intensity: state.intent.intensity,
      audience: state.intent.audience,
      offerRungs: state.intent.offerRungs,
      renderContract: state.intent.renderContract,
      evidence: state.intent.evidence,
      admittedKnowledgeRefs: state.intent.admittedKnowledgeRefs,
      plannedAt: state.intent.plannedAt,
      externalEffectAuthorized: false
    } : null,
    externalEffectAuthorized: false,
    providerCalled: false,
    spendUsd: 0
  };
}

function createHandler(deps) {
  deps = deps || {};
  var gate = deps.gate || Gate;
  var store = deps.store || Store;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'private, no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    var params = query(req);
    var domain = String(params.get('domain') || '').toLowerCase();
    var pass = gate.reqKey(req);
    if (domain) {
      var lane = Lanes.get(domain);
      if (!lane) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'known product domain required' })); }
      if (!gate.hasDomain(pass, lane.contract.ownerDomain) && !gate.hasDomain(pass, domain)) return gate.deny(res);
    } else if (!gate.isMaster(pass)) return gate.deny(res);
    try {
      store.assertDurable();
      var domains = domain ? [domain] : Lanes.DOMAINS.slice();
      var rows = [];
      for (var i = 0; i < domains.length; i++) {
        var selected = Lanes.get(domains[i]);
        var pair = await Promise.all([
          store.get(selected.contract.stateKey),
          store.get(selected.contract.artifactStateKey)
        ]);
        var artifact = pair[1];
        var validArtifact = artifact && artifact.schemaVersion === 'domain-commercial-artifact/1.0' &&
          artifact.productDomain === selected.contract.productDomain && artifact.ownerDomain === selected.contract.ownerDomain &&
          artifact.status === 'ARTIFACT_PREPARED' && artifact.externalEffectAuthorized === false;
        rows.push({ domain: domains[i], state: compact(pair[0]), artifact: validArtifact ? artifact : null });
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        schemaVersion: 'domain-commercial-status/1.0',
        measuredAt: new Date().toISOString(),
        domains: rows,
        readOnly: true,
        providerCalled: false,
        externalEffectAuthorized: false
      }));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'domain-commercial-status-unavailable', detail: String(error && error.message || error) }));
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.compact = compact;
module.exports = handler;
