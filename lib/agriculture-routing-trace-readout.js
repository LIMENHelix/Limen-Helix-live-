'use strict';
var Bridge = require('./autofire-domain-bridge.js');
var Learning = require('./autofire-learning.js');
function text(v) { return typeof v === 'string' && v.trim().length > 0; }
function time(v, now) { return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= now; }
async function read(store, now) {
  now = now == null ? Date.now() : now;
  var out = { schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'agriculture', lane: 'origin-routing',
    readAt: now, observationOnly: true, externalActionAuthorized: false, status: 'ROUTING_ONLY',
    reason: 'Agriculture routes investment to Finance and research to Research; Homestead is separate; no Agriculture motor or borrowed reward',
    decision: null, command: null, originRoutes: [], originReturns: null };
  try {
    store.assertDurable();
    var inputs = await Promise.all([store.lrange(Bridge.LOG_KEY, 0, 999), Learning.readAgricultureReturns(store)]);
    if (!Array.isArray(inputs[0])) throw new Error('agriculture-routing-index-invalid');
    var indexes = inputs[0].filter(function (row) { return row && row.routing && row.routing.originDomain === 'agriculture'; }).slice(0, 20);
    for (var i = 0; i < indexes.length; i++) {
      var index = indexes[i];
      if (!text(index.id)) throw new Error('agriculture-routing-index-invalid');
      var row = await store.get('autofire_selection:' + index.id);
      var route = row && row.routing, candidate = row && row.candidate;
      if (!row || JSON.stringify(row) !== JSON.stringify(index) || row.schemaVersion !== 1 || !time(row.at, now) ||
          ['RELEASED', 'HELD'].indexOf(row.status) < 0 || !route || route.originDomain !== 'agriculture' ||
          route.observationOnly !== true || route.ownerDomain !== row.ownerDomain ||
          !((row.lane === 'investment' && row.ownerDomain === 'finance') || (row.lane === 'research' && row.ownerDomain === 'research')) ||
          !candidate || !(text(route.sourcePacketId) || text(route.sourceArtifactRef)) ||
          route.sourcePacketId !== candidate.sourcePacketId || route.sourceArtifactRef !== candidate.sourceArtifactRef ||
          !route.sourceIdentity || !text(route.sourceIdentity.kind) || !text(route.sourceIdentity.value) ||
          JSON.stringify(route.sourceIdentity) !== JSON.stringify(candidate.sourceIdentity)) throw new Error('agriculture-routing-readback-invalid');
      out.originRoutes.push({ destinationOwner: row.ownerDomain, lane: row.lane, destinationDecisionId: row.id,
        destinationDecisionKey: 'autofire_selection:' + row.id, status: row.status, decidedAt: row.at,
        sourcePacketId: route.sourcePacketId || null, opportunityId: route.opportunityId || null,
        blockers: Array.isArray(row.reasons) ? row.reasons.slice(0, 12) : [] });
    }
    out.originRoutes.sort(function (a, b) { return b.decidedAt - a.decidedAt; });
    var returned = inputs[1];
    if (!returned || returned.originDomain !== 'agriculture' || returned.observationOnly !== true || !Array.isArray(returned.observations)) throw new Error('agriculture-return-readout-invalid');
    var observations = returned.observations.map(function (row) {
      if (!time(row.observedAt, now)) throw new Error('agriculture-return-time-invalid');
      return { returnId: row.returnId, destinationOwner: row.ownerDomain, lane: row.lane,
        destinationSelectionId: row.selectionId, actionId: row.actionId, observedAt: row.observedAt,
        outcome: row.outcome, sourcePackets: row.sourceDomains.map(function (ref) { return ref.sourcePacketId || ref.sourceArtifactRef; }) };
    });
    out.originReturns = { status: returned.status, reason: returned.reason, returnedCount: returned.returnedCount,
      observations: observations, failures: returned.failures };
    if (!out.originRoutes.length) out.reason += '; explicit outward selection not observed in bounded index';
    if (returned.status === 'PARTIAL') out.reason += '; destination outcome read incomplete';
  } catch (err) {
    out.status = 'UNAVAILABLE'; out.reason = String(err && err.message || err); out.originRoutes = []; out.originReturns = null;
  }
  return out;
}
module.exports = { read: read };
