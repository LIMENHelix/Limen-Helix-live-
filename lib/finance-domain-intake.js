'use strict';

/*
 * Finance-owned reader for sovereign-domain financial emissions.
 *
 * This module reads the existing durable civilization packets.  It does not
 * create a shared execution lane, select a company, choose a side or size an
 * order, and it has no broker/provider authority.  Every source opportunity
 * remains preserved in `records`; `financeRelevant` is only an explicit
 * classification used to give Finance bounded context for its own review.
 */

var HandoffStore = require('./civilization-handoff-store.js');

var SCHEMA = 'finance-domain-intake/1.0';
var MAX_PACKETS = 24;
var MAX_RECORDS = 96;
var MAX_EMISSIONS_PER_PACKET = 32;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function iso(value) { return text(value) && Number.isFinite(Date.parse(value)); }
function upper(value) { return text(value) ? String(value).trim().toUpperCase() : null; }

function packetTime(packet) {
  var at = Date.parse(packet && packet.generatedAt || '');
  return Number.isFinite(at) ? at : 0;
}

function opportunityPath(opportunity) {
  return upper(opportunity && (opportunity.path || opportunity.lane || opportunity.activeLane));
}

function opportunityRelevant(opportunity) {
  var path = opportunityPath(opportunity);
  return path === 'INVESTABLE' || path === 'INVESTMENTS' || path === 'INVESTMENT';
}

function identity(packet) {
  var source = packet && packet.sourceIdentity || {};
  return source && text(source.snapshotId) && text(source.refreshId) && text(source.producer)
    ? clone(source) : null;
}

function sourceRecord(packet, kind, value, payload, relevant, reason) {
  return {
    schemaVersion: SCHEMA,
    recordId: packet.packetId + ':' + kind + ':' + value,
    sourceDomain: packet.domainId,
    sourcePacketId: packet.packetId,
    sourceIdentity: identity(packet),
    sourceDomainLane: kind === 'opportunity' ? (payload.path || payload.lane || null) : null,
    recordKind: kind,
    opportunityId: kind === 'opportunity' ? (payload.id || null) : null,
    emissionId: kind === 'emission' ? (payload.id || value) : null,
    targetDomain: kind === 'emission' ? (payload.targetDomain || null) : null,
    financialRelevance: relevant ? 'FINANCE_REVIEW_CONTEXT' : 'PRESERVED_FOR_LATER_REVIEW',
    relevanceReason: reason,
    authority: {
      sourceMayDescribe: true,
      sourceMayDecideInvestment: false,
      financeDecisionRequired: true,
      executionInstruction: false
    },
    payload: clone(payload),
    generatedAt: packet.generatedAt
  };
}

function packetRecords(packet) {
  var out = [];
  var truth = packet && packet.truth || {};
  list(truth.opportunities).slice(0, MAX_EMISSIONS_PER_PACKET).forEach(function (opportunity, index) {
    if (!opportunity || typeof opportunity !== 'object') return;
    var relevant = opportunityRelevant(opportunity);
    out.push(sourceRecord(packet, 'opportunity', opportunity.id || String(index), opportunity, relevant,
      relevant ? 'explicit-investable-domain-opportunity' : 'domain-opportunity-retained-without-finance-routing'));
  });
  list(truth.crossDomainEmissions).slice(0, MAX_EMISSIONS_PER_PACKET).forEach(function (emission, index) {
    if (!emission || typeof emission !== 'object') return;
    var targeted = upper(emission.targetDomain) === 'FINANCE' || emission.financiallyRelevant === true;
    out.push(sourceRecord(packet, 'emission', emission.id || String(index), emission, targeted,
      targeted ? 'explicit-finance-targeted-emission' : 'cross-domain-signal-preserved-without-finance-routing'));
  });
  return out;
}

function abstained(reason, extra) {
  return Object.assign({
    schemaVersion: SCHEMA,
    status: 'ABSTAINED',
    reason: reason,
    records: [],
    financeRelevant: [],
    abstentions: [],
    packetsRead: 0
  }, extra || {});
}

async function read(store, options) {
  options = options || {};
  store = store || HandoffStore.createStore(options.storeOptions);
  if (!store || typeof store.members !== 'function' || typeof store.get !== 'function') {
    return abstained('finance-domain-intake-store-unavailable');
  }
  if (typeof store.configured === 'function' && !store.configured()) {
    return abstained('finance-domain-intake-durable-store-unconfigured');
  }
  var ids;
  try {
    ids = await store.members(store.packetIndexKey);
  } catch (error) {
    return abstained('finance-domain-intake-packet-index-unavailable', {
      detail: String(error && error.code || error && error.message || error)
    });
  }
  ids = list(ids).slice().sort(function (a, b) { return String(a).localeCompare(String(b)); });
  var packets = [], abstentions = [];
  for (var i = 0; i < ids.length && packets.length < MAX_PACKETS; i++) {
    var packet;
    try { packet = await store.get(store.packetKey(ids[i])); }
    catch (error) {
      abstentions.push({ packetId: ids[i], reason: 'packet-read-failed', detail: String(error && error.message || error) });
      continue;
    }
    if (!packet) {
      abstentions.push({ packetId: ids[i], reason: 'packet-missing' });
      continue;
    }
    if (packet.packetId !== ids[i]) {
      abstentions.push({ packetId: ids[i], reason: 'packet-key-identity-mismatch' });
      continue;
    }
    if (!text(packet.packetId) || !text(packet.domainId) || packet.domainId === 'finance' ||
        packet.sourceType !== 'server-cognition-refresh' || !iso(packet.generatedAt) || !identity(packet)) {
      abstentions.push({ packetId: packet.packetId || ids[i], reason: 'packet-not-a-trusted-non-finance-domain-packet' });
      continue;
    }
    packets.push(packet);
  }
  packets.sort(function (a, b) { return packetTime(b) - packetTime(a); });
  var records = [], relevant = [];
  packets.forEach(function (packet) {
    packetRecords(packet).forEach(function (record) {
      if (records.length >= MAX_RECORDS) return;
      records.push(record);
      if (record.financialRelevance === 'FINANCE_REVIEW_CONTEXT' && relevant.length < MAX_RECORDS) relevant.push(record);
    });
  });
  return {
    schemaVersion: SCHEMA,
    status: 'OBSERVED',
    reason: null,
    packetsRead: packets.length,
    packets: packets.map(function (packet) {
      return { packetId: packet.packetId, domainId: packet.domainId, generatedAt: packet.generatedAt, sourceIdentity: identity(packet) };
    }),
    records: records,
    financeRelevant: relevant,
    abstentions: abstentions,
    authority: {
      ownerDomain: 'finance',
      sourceDomainsRemainSovereign: true,
      sourceDomainsMayNotIssueBrokerageInstruction: true,
      financeMustReevaluate: true,
      brokerTouched: false,
      orderPlaced: false,
      liveMoney: false
    }
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_PACKETS: MAX_PACKETS,
  MAX_RECORDS: MAX_RECORDS,
  opportunityRelevant: opportunityRelevant,
  packetRecords: packetRecords,
  read: read,
  abstained: abstained
};

