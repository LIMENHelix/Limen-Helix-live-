/**
 * Separate, deterministic outcome source for the read-only civilization
 * rehearsal.
 *
 * Rows are loaded before commands are submitted and carry their own identity,
 * timestamp, variable, and source stream. The source never derives an outcome
 * from a command, handoff, diagnosis, or originating-domain observation. It
 * is synthetic fixture data, not a provider or world observation.
 */
'use strict';

var MODULE_ID = 'brain-v2/core/sandbox-outcome-source';
var SCHEMA_VERSION = 'sandbox-outcome-source/1.0';
var RESULT_SOURCE = 'sandbox-counterfactual';
var INDEPENDENCE = 'originating-domain-observation';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fail(message) { throw new Error(MODULE_ID + ': ' + message); }

function validateStore(store) {
  if (!store || typeof store.append !== 'function' || typeof store.read !== 'function') {
    fail('a sandbox store with append(record) and read() is required');
  }
}

function validateRow(row) {
  if (!row || typeof row !== 'object') fail('world row must be an object');
  if (typeof row.observationId !== 'string' || !row.observationId) fail('world row observationId is required');
  if (typeof row.sourceStream !== 'string' || !row.sourceStream) fail('world row sourceStream is required');
  if (row.sourceType !== 'sandbox-world-fixture') fail('world row sourceType must be sandbox-world-fixture');
  if (typeof row.variable !== 'string' || !row.variable) fail('world row variable is required');
  if (typeof row.observedDelta !== 'number' || !isFinite(row.observedDelta)) fail('world row observedDelta must be finite');
  if (typeof row.observedAt !== 'number' || !isFinite(row.observedAt)) fail('world row observedAt must be finite');
}

function create(opts) {
  opts = opts || {};
  validateStore(opts.store);
  if (!Array.isArray(opts.rows) || !opts.rows.length) fail('rows are required');
  var rows = opts.rows.map(function (row) { validateRow(row); return clone(row); });
  return { schemaVersion: SCHEMA_VERSION, store: opts.store, rows: rows, cursor: 0, consumed: 0 };
}

function observe(source, command, receivedAt) {
  if (!command || typeof command.commandId !== 'string' || !command.commandId) fail('persisted command is required');
  if (command.status !== 'RECEIPT_PERSISTED') fail('command receipt must be persisted before observation');
  if (source.cursor >= source.rows.length) fail('sandbox world stream is exhausted');
  var row = source.rows[source.cursor];
  // Persist the source record without command identity. This is the boundary
  // that proves the observation existed independently of the command.
  source.store.append({
    bridgeSchemaVersion: SCHEMA_VERSION,
    module: MODULE_ID,
    type: 'sandbox_external_observation',
    observation: clone(row)
  });
  source.cursor += 1;
  source.consumed += 1;
  return {
    outcomeId: 'sandbox-outcome-' + row.observationId,
    sourceObservationId: row.observationId,
    sourceStream: row.sourceStream,
    sourceType: RESULT_SOURCE,
    independentOf: INDEPENDENCE,
    observedDelta: row.observedDelta,
    observedAt: row.observedAt,
    receivedAt: receivedAt
  };
}

function report(source) {
  return {
    schemaVersion: SCHEMA_VERSION,
    available: source.rows.length,
    consumed: source.consumed,
    pending: source.rows.length - source.consumed,
    sourceType: 'sandbox-world-fixture',
    boundary: 'synthetic fixture only; no provider, broker, network, cron, or production state'
  };
}

module.exports = {
  MODULE_ID: MODULE_ID,
  SCHEMA_VERSION: SCHEMA_VERSION,
  create: create,
  observe: observe,
  report: report,
  RESULT_SOURCE: RESULT_SOURCE,
  INDEPENDENCE: INDEPENDENCE
};
