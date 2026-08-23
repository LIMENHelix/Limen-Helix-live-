/**
 * Sandbox-only B13/B17 consumer for the research/investment motor bridge.
 *
 * It consumes the already-persisted sandbox outcome stream, then records the
 * episode and derives B17's rate from history strictly before the current
 * outcome. Consolidation is explicit and offline-only. Nothing here reaches a
 * provider, broker, cron, production store, or live domain state.
 */
'use strict';

var MEM = require('../kernel/memory.js');
var CON = require('../kernel/consolidate.js');
var META = require('./metaplasticity.js');
var BR = require('./sandbox-motor-bridge.js');

var MODULE_ID = 'brain-v2/core/sandbox-learning-bridge';
var SCHEMA_VERSION = 'sandbox-learning-bridge/1.0';

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function fail(message) { throw new Error(MODULE_ID + ': ' + message); }

function create(opts) {
  opts = opts || {};
  if (!opts.motorBridge) fail('motorBridge is required');
  return {
    schemaVersion: SCHEMA_VERSION,
    motorBridge: opts.motorBridge,
    memory: opts.memory || MEM.create(),
    consolidator: opts.consolidator || CON.create(),
    metaLedger: opts.metaLedger || META.createLedger(),
    outcomesConsumed: 0
  };
}

/** Consume a completed sandbox result. The evaluation is explicitly sandbox data. */
function consume(learning, result, evaluation, now) {
  if (!result || !result.command || !result.outcome) fail('completed motor result is required');
  if (!evaluation || typeof evaluation.hit !== 'boolean' || typeof evaluation.predictionError !== 'number' || !isFinite(evaluation.predictionError)) {
    fail('sandbox evaluation must carry boolean hit and finite predictionError');
  }
  var command = result.command;
  var outcome = result.outcome;
  var key = command.lane + ':' + command.variable;
  var beforeLedger = clone(META.serializeLedger(learning.metaLedger));
  var beforeMemory = clone(MEM.serialize(learning.memory));
  var rate = META.rateFor(learning.metaLedger, key);
  var record = META.record(learning.metaLedger, key, evaluation.predictionError);
  var episode = MEM.encode(learning.memory, {
    traceId: command.opportunityId,
    at: command.issuedAt,
    domain: command.sourceDomains[0],
    state: { departure: outcome.observedDelta },
    sensors: [],
    surprise: Math.min(1, Math.abs(evaluation.predictionError)),
    dysregulation: { detected: false },
    selection: { kind: command.lane },
    actionId: command.commandId,
    efferenceCopyId: command.efferenceCopy && command.efferenceCopy.id || null
  });
  var linked = MEM.linkOutcome(learning.memory, command.commandId, {
    hit: evaluation.hit,
    contaminated: false,
    predictionError: evaluation.predictionError,
    sourceType: outcome.sourceType,
    independentOf: outcome.independentOf,
    at: now
  });
  if (!linked.linked) fail('sandbox outcome could not link to episode: ' + linked.why);

  try {
    learning.motorBridge.store.append({
      bridgeSchemaVersion: SCHEMA_VERSION,
      module: MODULE_ID,
      type: 'sandbox_learning_observation',
      commandId: command.commandId,
      outcomeId: outcome.outcomeId,
      sourceType: outcome.sourceType,
      independentOf: outcome.independentOf,
      episodeId: episode.id,
      key: key,
      rate: rate,
      rateState: rate.state,
      rateNBefore: rate.n,
      recorded: record.recorded,
      evaluation: clone(evaluation),
      at: now
    });
  } catch (e) {
    /* The learning record is the durability boundary for B13/B17. Restore the
       in-memory structures if it cannot be appended. */
    learning.metaLedger = META.restoreLedger(beforeLedger);
    learning.memory = MEM.deserialize(beforeMemory);
    throw e;
  }
  learning.outcomesConsumed++;
  return { episode: clone(episode), linked: linked, rate: clone(rate), recorded: clone(record) };
}

function consolidate(learning, now, arousalState) {
  var beforeMemory = clone(MEM.serialize(learning.memory));
  var beforeCon = clone(CON.serialize(learning.consolidator));
  var state = arousalState || 'offline';
  var result = CON.run(learning.consolidator, learning.memory, { now: now, arousalState: state });
  if (!result.ran) return clone(result);
  try {
    learning.motorBridge.store.append({
      bridgeSchemaVersion: SCHEMA_VERSION,
      module: MODULE_ID,
      type: 'sandbox_consolidation',
      pass: result.pass,
      replayed: result.replayed,
      promotions: result.promotions,
      writes: result.writes,
      at: now
    });
  } catch (e) {
    learning.memory = MEM.deserialize(beforeMemory);
    learning.consolidator = CON.deserialize(beforeCon);
    throw e;
  }
  return clone(result);
}

function report(learning, now) {
  return {
    schemaVersion: SCHEMA_VERSION,
    outcomesConsumed: learning.outcomesConsumed,
    memory: MEM.report(learning.memory, now),
    consolidator: CON.report(learning.consolidator),
    metaplasticity: META.report(learning.metaLedger),
    boundary: 'sandbox only; consumes sandbox-counterfactual outcomes; no provider, broker, spend, cron, or production state'
  };
}

function serialize(learning) {
  return {
    schemaVersion: SCHEMA_VERSION,
    motorBridge: BR.serialize(learning.motorBridge),
    memory: MEM.serialize(learning.memory),
    consolidator: CON.serialize(learning.consolidator),
    metaLedger: META.serializeLedger(learning.metaLedger),
    outcomesConsumed: learning.outcomesConsumed
  };
}

function restore(snapshot, opts) {
  if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION) fail('snapshot schema must be ' + SCHEMA_VERSION);
  var motor = BR.restore(snapshot.motorBridge, { store: opts && opts.store });
  var learning = create({
    motorBridge: motor,
    memory: MEM.deserialize(snapshot.memory),
    consolidator: CON.deserialize(snapshot.consolidator),
    metaLedger: META.restoreLedger(snapshot.metaLedger)
  });
  learning.outcomesConsumed = snapshot.outcomesConsumed || 0;
  return learning;
}

module.exports = {
  MODULE_ID: MODULE_ID,
  SCHEMA_VERSION: SCHEMA_VERSION,
  create: create,
  consume: consume,
  consolidate: consolidate,
  report: report,
  serialize: serialize,
  restore: restore
};
