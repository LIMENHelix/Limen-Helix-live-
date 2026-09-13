'use strict';

/**
 * Desk-query observations return to the owning Governor as afferent input.
 * Does not dispatch a motor. Public desks stay live if this store is down.
 */

var crypto = require('node:crypto');
var Lanes = require('./g0-lane-registry.js');

var SCHEMA = 'g0-desk-afferent/1.0';
var PREFIX = 'g0_desk_afferent:';
var LOG_KEY = 'g0_desk_afferent_log';
var STATE = 'g0_desk_afferent_state:';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }

async function record(store, input) {
  input = input || {};
  var spec = Lanes.get(input.domainId);
  if (!spec) return { ok: false, reason: 'desk-domain-not-in-scope' };
  var tool = text(input.tool) || spec.deskTool;
  var query = text(input.query);
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var observationId = 'g0da_' + hash({ domain: spec.productDomain, tool: tool, query: query, at: now }).slice(0, 24);
  var row = {
    schemaVersion: SCHEMA,
    observationId: observationId,
    domainId: spec.productDomain,
    ownerDomain: spec.ownerDomain,
    desk: spec.desk,
    tool: tool,
    queryHash: query ? hash(query) : null,
    sourceKind: 'desk-read',
    independentOfMotor: true,
    observedAt: now,
    resultOk: input.resultOk !== false
  };
  if (!store || typeof store.set !== 'function') return { ok: true, skipped: true, reason: 'afferent-store-absent', observationId: observationId };
  try {
    store.assertDurable();
    await store.set(PREFIX + observationId, row);
    var restored = await store.get(PREFIX + observationId);
    if (!restored || restored.observationId !== observationId) throw new Error('desk afferent readback invalid');
    var state = await store.get(STATE + spec.productDomain) || {
      schemaVersion: SCHEMA, domainId: spec.productDomain, resolvedCount: 0, lastObservationId: null
    };
    state.resolvedCount = Number(state.resolvedCount || 0) + 1;
    state.lastObservationId = observationId;
    state.lastObservedAt = now;
    await store.set(STATE + spec.productDomain, state);
    await store.lpush(LOG_KEY, { observationId: observationId, domainId: spec.productDomain, observedAt: now });
    await store.ltrim(LOG_KEY, 0, 499);
    return { ok: true, observationId: observationId, resolvedCount: state.resolvedCount };
  } catch (error) {
    return { ok: true, skipped: true, reason: 'afferent-store-unavailable', detail: String(error && error.message || error) };
  }
}

async function latest(store, domain) {
  if (!store) return null;
  return store.get(STATE + String(domain || ''));
}

function note(domainId, query, tool) {
  try {
    var store = require('./autofire-efference-store.js');
    return record(store, { domainId: domainId, query: query, tool: tool }).catch(function () {
      return { ok: true, skipped: true };
    });
  } catch (_) {
    return Promise.resolve({ ok: true, skipped: true });
  }
}

module.exports = { SCHEMA: SCHEMA, PREFIX: PREFIX, LOG_KEY: LOG_KEY, STATE: STATE, record: record, latest: latest, note: note };
