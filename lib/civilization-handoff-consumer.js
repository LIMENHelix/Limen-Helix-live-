'use strict';

/* Trusted packet -> durable, idempotent handoff consumer.  No provider,
 * broker, publication, live-money, or activation authority lives here. */

var MODULE_ID = 'civilization-handoff-consumer';
var ACTIVE_LANES = ['investments', 'research-papers'];
var packetContract = require('./civilization-server-packet.js');

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function text(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }

/* Only an explicitly canonical lane is eligible.  In particular, path names
 * such as INVESTABLE/RESEARCHABLE are not silently translated here. */
function explicitLanes(opportunity) {
  var values = [];
  ['lane', 'activeLane', 'artifactLane'].forEach(function (field) {
    if (typeof opportunity[field] === 'string') values.push(opportunity[field].trim());
  });
  ['lanes', 'artifactLanes'].forEach(function (field) {
    if (Array.isArray(opportunity[field])) values = values.concat(opportunity[field].filter(function (v) { return typeof v === 'string'; }).map(function (v) { return v.trim(); }));
  });
  var out = [];
  values.forEach(function (v) { if (ACTIVE_LANES.indexOf(v) >= 0 && out.indexOf(v) < 0) out.push(v); });
  return out;
}

function abstention(code, opportunity) {
  return { code: code, opportunityId: text(opportunity && opportunity.id), title: text(opportunity && opportunity.title) };
}

function createConsumer(opts) {
  opts = opts || {};
  if (!opts.store || typeof opts.store.setNx !== 'function' || typeof opts.store.add !== 'function') {
    throw new Error(MODULE_ID + ': strict store is required');
  }
  var store = opts.store;

  async function consumePacket(input) {
    var packet;
    try { packet = packetContract.buildPacket(input); }
    catch (e) { return { ok: false, packetId: null, error: { code: e.code || 'PACKET_INVALID', message: e.message }, abstentions: [], failures: [] }; }

    var result = { ok: true, packetId: packet.packetId, packetCreated: false, handoffsCreated: 0, abstentions: [], failures: [] };
    try {
      result.packetCreated = await store.setNx(store.packetKey(packet.packetId), packet);
      await store.add(store.packetIndexKey, packet.packetId);
    } catch (e) {
      return { ok: false, packetId: packet.packetId, error: { code: e.code || 'PACKET_PERSISTENCE_FAILED', message: e.message }, abstentions: [], failures: [] };
    }

    var opportunities = packet.truth.opportunities;
    for (var i = 0; i < opportunities.length; i++) {
      var opportunity = opportunities[i];
      var lanes = explicitLanes(opportunity || {});
      if (lanes.length === 0) { result.abstentions.push(abstention('lane-unassigned', opportunity)); continue; }
      if (lanes.length > 1) { result.abstentions.push(abstention('lane-ambiguous', opportunity)); continue; }
      var handoff;
      try { handoff = packetContract.toHandoff(packet, lanes[0], opportunity); }
      catch (e) { result.failures.push({ code: e.code || 'HANDOFF_INVALID', message: e.message, opportunityId: text(opportunity && opportunity.id) }); continue; }
      try {
        var created = await store.setNx(store.handoffKey(handoff.handoffId), handoff);
        await store.add(store.handoffIndexKey, handoff.handoffId);
        if (created) result.handoffsCreated++;
      } catch (e) {
        result.failures.push({ code: e.code || 'HANDOFF_PERSISTENCE_FAILED', message: e.message, handoffId: handoff.handoffId });
      }
    }
    if (result.failures.length) result.ok = false;
    return result;
  }

  return { consumePacket: consumePacket, explicitLanes: explicitLanes, ACTIVE_LANES: ACTIVE_LANES.slice(), clone: clone };
}

module.exports = { MODULE_ID: MODULE_ID, ACTIVE_LANES: ACTIVE_LANES.slice(), explicitLanes: explicitLanes, createConsumer: createConsumer };
