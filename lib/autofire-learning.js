/**
 * B12/B13 learning for research/investment commands.
 *
 * Command episodes are written at release time. Later outcome events are kept
 * separate from the command's supervised persistence error, graded by explicit
 * lane rules, and fed to the real brain-v2 modulator and memory mechanisms.
 * Hourly consolidation runs only in the declared offline pass.
 */

'use strict';

var MOD = require('../brain-v2/kernel/modulators.js');
var MEM = require('../brain-v2/kernel/memory.js');
var CON = require('../brain-v2/kernel/consolidate.js');
var SEL = require('../brain-v2/kernel/select.js');
var POLICY = require('../brain-v2/core/outward-action-policy.js');

var STATE_VERSION = 1;
var STATE_TTL = 365 * 86400;
var OUTCOME_LOG_KEY = 'autofire_learning_outcome_log';
var OUTCOME_LOG_CAP = 2000;
var DOMAINS = ['finance', 'research', 'health'];
var INVESTMENT_HORIZONS = [30, 60, 90];
var RESEARCH_MAPPINGS = POLICY.LANE_POLICY.research.requiredMappings;

function stateKey(domain) { return 'autofire_learning_state:' + domain; }

function fresh(domain, lane) {
  return {
    stateVersion: STATE_VERSION,
    domain: domain,
    lane: lane,
    modulators: MOD.serialize(MOD.create()),
    memory: MEM.serialize(MEM.create()),
    consolidator: CON.serialize(CON.create()),
    outwardGate: SEL.serialize(SEL.createGate()),
    commands: [],
    processedOutcomeIds: [],
    lastCommandAt: null,
    lastOutcomeAt: null,
    lastConsolidatedAt: null
  };
}

function laneForDomain(domain) { return domain === 'finance' ? 'investment' : 'research'; }

function validState(value, domain) {
  return value && value.stateVersion === STATE_VERSION && value.domain === domain &&
    value.lane === laneForDomain(domain) && value.modulators && value.memory &&
    value.consolidator && value.outwardGate;
}

async function load(store, domain) {
  var value = await store.get(stateKey(domain));
  if (!value) return fresh(domain, laneForDomain(domain));
  if (!validState(value, domain)) throw new Error('malformed autofire learning state for ' + domain);
  return value;
}

async function save(store, state) {
  await store.set(stateKey(state.domain), state, STATE_TTL);
  return state;
}

function trim(list, n) { return list.length > n ? list.slice(list.length - n) : list; }

function last(list, fallback) {
  return Array.isArray(list) && list.length ? list[list.length - 1] : fallback;
}

async function selectionContext(store, domain) {
  var state = await load(store, domain);
  var m = MOD.deserialize(state.modulators);
  return {
    gate: SEL.deserialize(state.outwardGate),
    modulation: {
      vigor: last(m.series.daTonic, 0),
      patience: last(m.series.fiveHT, 0),
      unexpectedUncertainty: last(m.series.ne, 0)
    }
  };
}

async function persistSelectionGate(store, domain, gate) {
  var state = await load(store, domain);
  state.outwardGate = SEL.serialize(gate);
  await save(store, state);
  return true;
}

async function recordCommand(store, spec) {
  try {
    store.assertDurable();
    if (!spec || !spec.selection || spec.selection.status !== 'RELEASED') {
      return { ok: false, error: 'command_has_no_released_domain_selection' };
    }
    if (!spec.efferenceCopy || !spec.efferenceCopy.actionId || !spec.efferenceCopy.id) {
      return { ok: false, error: 'command_has_no_efference_identity' };
    }
    var domain = spec.selection.ownerDomain;
    if (DOMAINS.indexOf(domain) < 0) return { ok: false, error: 'unsupported_owner_domain' };
    var state = await load(store, domain);
    var duplicate = state.commands.filter(function (c) { return c.actionId === spec.efferenceCopy.actionId; })[0];
    if (duplicate) return { ok: true, duplicate: true, command: duplicate };

    var mem = MEM.deserialize(state.memory);
    var at = spec.efferenceCopy.emittedAt;
    var ep = MEM.encode(mem, {
      traceId: spec.efferenceCopy.traceId || spec.efferenceCopy.id,
      at: at,
      domain: domain,
      state: { departure: null, confidence: null, source: 'outward_selection_receipt' },
      sensors: [], blind: [], findings: [], surprise: 0,
      selection: { kind: spec.selection.command, candidateId: spec.selection.id },
      actionId: spec.efferenceCopy.actionId,
      efferenceCopyId: spec.efferenceCopy.id,
      causalParents: [spec.selection.id]
    });
    ep.procedureContext = {
      triggerCondition: 'a provenance-bearing candidate was released by the owning domain outward gate',
      requiredEvidence: [
        'owning domain current L3 evidence complete',
        'declared outward consumer',
        'source-supplied candidate identity'
      ],
      contraindications: spec.selection.reasons || [],
      expectedResult: spec.selection.lane === 'investment'
        ? 'a persisted investment artifact followed by graded 30/60/90-day outcomes'
        : 'a persisted research artifact followed by publication and separately graded progress evidence'
    };

    var command = {
      selectionId: spec.selection.id,
      actionId: spec.efferenceCopy.actionId,
      efferenceCopyId: spec.efferenceCopy.id,
      episodeId: ep.id,
      lane: spec.selection.lane,
      domain: domain,
      cik: spec.selection.candidate.cik,
      emittedAt: at
    };
    state.memory = MEM.serialize(mem);
    state.commands.push(command);
    state.commands = trim(state.commands, 512);
    state.lastCommandAt = at;
    await save(store, state);
    return { ok: true, duplicate: false, command: command };
  } catch (err) {
    return { ok: false, error: 'command_learning_not_durable', detail: (err && err.message) || String(err) };
  }
}

function finite(v) { return typeof v === 'number' && isFinite(v); }

function gradeInvestment(event) {
  var d = event.outcomeData || {};
  var missing = [];
  if (INVESTMENT_HORIZONS.indexOf(d.horizonDays) < 0) missing.push('horizonDays_must_be_30_60_or_90');
  if (!finite(d.investedAmount) || d.investedAmount <= 0) missing.push('investedAmount_required');
  if (!finite(d.netPnl)) missing.push('netPnl_required');
  if (!finite(d.returnPct)) missing.push('returnPct_required');
  if (!finite(d.benchmarkReturnPct)) missing.push('benchmarkReturnPct_required');
  if (!finite(d.maxDrawdownPct)) missing.push('maxDrawdownPct_required');
  if (typeof d.riskBreach !== 'boolean') missing.push('riskBreach_required');
  if (!d.executionMode || ['paper', 'live'].indexOf(d.executionMode) < 0) missing.push('executionMode_required');
  if (!d.brokerOrderId) missing.push('brokerOrderId_required');
  if (missing.length) return { graded: false, reasons: missing, reward: null };

  var excess = d.returnPct - d.benchmarkReturnPct;
  var outcome;
  if (d.riskBreach || d.netPnl < 0 || excess < 0) outcome = 'FAILURE';
  else if (d.netPnl > 0 && excess > 0) outcome = 'SUCCESS';
  else outcome = 'NEUTRAL';
  return {
    graded: true,
    outcome: outcome,
    reward: outcome === 'SUCCESS' ? 1 : (outcome === 'FAILURE' ? -1 : 0),
    terms: {
      horizonDays: d.horizonDays,
      investedAmount: d.investedAmount,
      netPnl: d.netPnl,
      returnPct: d.returnPct,
      benchmarkReturnPct: d.benchmarkReturnPct,
      excessReturnPct: excess,
      maxDrawdownPct: d.maxDrawdownPct,
      riskBreach: d.riskBreach,
      executionMode: d.executionMode,
      brokerOrderId: d.brokerOrderId
    },
    rule: 'SUCCESS only when net P&L and benchmark-relative return are both positive with no risk breach; FAILURE on loss, underperformance, or risk breach; otherwise NEUTRAL'
  };
}

function gradeResearch(event) {
  if (event.eventType === 'OUTCOME_RESEARCH_PUBLISHED') {
    return {
      graded: false,
      reward: null,
      reasons: ['publication_is_observation_not_proof_of_progress'],
      rule: 'a published study is evidence to evaluate; publication count alone cannot teach reward'
    };
  }
  var d = event.outcomeData || {};
  var missing = [];
  if (['PROGRESS', 'REGRESSION', 'NO_CHANGE'].indexOf(d.progress) < 0) missing.push('progress_required');
  if (!Array.isArray(d.evidenceIds) || !d.evidenceIds.length) missing.push('evidenceIds_required');
  if (!d.independenceAssessment || d.independenceAssessment.status !== 'ESTABLISHED') {
    missing.push('independence_not_established');
  }
  var coverage = d.mappingCoverage || {};
  RESEARCH_MAPPINGS.forEach(function (name) { if (coverage[name] !== true) missing.push('mapping_missing:' + name); });
  if (missing.length) return { graded: false, reasons: missing, reward: null };
  return {
    graded: true,
    outcome: d.progress,
    reward: d.progress === 'PROGRESS' ? 1 : (d.progress === 'REGRESSION' ? -1 : 0),
    terms: {
      evidenceIds: d.evidenceIds.slice(),
      independenceAssessment: d.independenceAssessment,
      mappingCoverage: coverage,
      contradictions: Array.isArray(d.contradictions) ? d.contradictions.slice() : [],
      retractions: Array.isArray(d.retractions) ? d.retractions.slice() : []
    },
    rule: 'publication alone is ungraded; progress requires evidence identity, established independence, and all four declared homology/kernel mappings'
  };
}

function grade(event) {
  if (event.lane === 'investment' && event.eventType === 'OUTCOME_INVESTMENT_PNL') return gradeInvestment(event);
  if (event.lane === 'research' &&
      (event.eventType === 'OUTCOME_RESEARCH_PUBLISHED' || event.eventType === 'OUTCOME_RESEARCH_EVALUATED')) {
    return gradeResearch(event);
  }
  return { graded: false, reward: null, reasons: ['event_not_a_lane_learning_outcome'] };
}

async function processOutcome(store, event) {
  var domain = event.ownerDomain;
  if (DOMAINS.indexOf(domain) < 0) return { ok: false, error: 'outcome_has_no_supported_owner_domain' };
  var state = await load(store, domain);
  if (state.processedOutcomeIds.indexOf(event.eventId) >= 0) {
    return { ok: true, duplicate: true, eventId: event.eventId };
  }
  var command = state.commands.filter(function (c) { return c.actionId === event.actionId; })[0];
  if (!command) return { ok: false, error: 'outcome_has_no_recorded_command', eventId: event.eventId };

  var assessment = grade(event);
  var mem = MEM.deserialize(state.memory);
  /* One command may legitimately have several later observations: publication,
     then an evaluated research result, or investment results at 30/60/90 days.
     Do not overwrite the command episode's first outcome slot. Each returned
     observation becomes its own causally-linked episode instead. */
  var outcomeEpisode = MEM.encode(mem, {
    traceId: event.eventId,
    at: event.ts,
    domain: domain,
    state: { departure: null, confidence: null, source: 'external_outcome' },
    sensors: [], blind: [], findings: [], surprise: assessment.graded ? Math.abs(assessment.reward) : 0,
    selection: { kind: 'generate_' + event.lane + '_artifact', candidateId: command.selectionId },
    actionId: event.actionId,
    efferenceCopyId: command.efferenceCopyId,
    causalParents: [command.episodeId]
  });
  outcomeEpisode.procedureContext = {
    triggerCondition: 'a provenance-bearing candidate was released by the owning domain outward gate',
    requiredEvidence: [
      'owning domain current L3 evidence complete',
      'declared outward consumer',
      event.lane === 'investment' ? 'graded 30/60/90-day investment terms' : 'independently assessed research evidence with all four mappings'
    ],
    contraindications: [],
    expectedResult: event.lane === 'investment'
      ? 'positive net P&L and benchmark-relative return without a risk breach'
      : 'evidence-qualified progress, with contradiction and retraction preserved'
  };
  outcomeEpisode.externalObservation = {
    eventId: event.eventId,
    eventType: event.eventType,
    assessment: assessment
  };
  if (assessment.graded) {
    outcomeEpisode.outcome = {
      hit: assessment.reward > 0,
      graded: true,
      reward: assessment.reward,
      assessment: assessment,
      eventId: event.eventId,
      eventType: event.eventType,
      at: event.ts
    };
  }

  var modulation = null;
  if (assessment.graded) {
    var modulators = MOD.deserialize(state.modulators);
    modulation = MOD.daPhasic(modulators, {
      state: 'command:' + command.lane,
      nextState: 'outcome:' + assessment.outcome,
      reward: assessment.reward,
      patience: 0.5
    });
    MOD.daTonic(modulators);
    state.modulators = MOD.serialize(modulators);
    var outwardGate = SEL.deserialize(state.outwardGate);
    SEL.recordOutcome(outwardGate, 'generate_' + command.lane + '_artifact', assessment.reward, event.ts);
    state.outwardGate = SEL.serialize(outwardGate);
  }
  state.memory = MEM.serialize(mem);
  state.processedOutcomeIds.push(event.eventId);
  state.processedOutcomeIds = trim(state.processedOutcomeIds, 2000);
  state.lastOutcomeAt = event.ts;
  await save(store, state);
  return {
    ok: true,
    duplicate: false,
    eventId: event.eventId,
    assessment: assessment,
    b12Updated: assessment.graded,
    rewardPredictionError: modulation ? modulation.value : null,
    episodeLinked: true,
    outcomeEpisodeId: outcomeEpisode.id
  };
}

async function recordOutcome(store, event) {
  var logged = false;
  try {
    store.assertDurable();
    if (!event || !event.eventId || !event.actionId) return { ok: false, error: 'outcome_identity_incomplete' };
    await store.lpush(OUTCOME_LOG_KEY, event);
    await store.ltrim(OUTCOME_LOG_KEY, 0, OUTCOME_LOG_CAP - 1);
    logged = true;
    return await processOutcome(store, event);
  } catch (err) {
    return { ok: false, queuedForRetry: logged, error: 'outcome_learning_failed', detail: (err && err.message) || String(err) };
  }
}

async function sweepOutcomes(store, limit) {
  var events = await store.lrange(OUTCOME_LOG_KEY, 0, Math.max(0, (limit || 100) - 1));
  var processed = 0, duplicates = 0, failed = [];
  for (var i = events.length - 1; i >= 0; i--) {
    try {
      var r = await processOutcome(store, events[i]);
      if (r.ok && r.duplicate) duplicates++;
      else if (r.ok) processed++;
      else failed.push({ eventId: events[i].eventId, error: r.error });
    } catch (err) {
      failed.push({ eventId: events[i].eventId, error: (err && err.message) || String(err) });
    }
  }
  return { ok: failed.length === 0, examined: events.length, processed: processed, duplicates: duplicates, failed: failed };
}

async function consolidateDomain(store, domain, now) {
  var state = await load(store, domain);
  var mem = MEM.deserialize(state.memory);
  var con = CON.deserialize(state.consolidator);
  var result = CON.run(con, mem, { now: now, arousalState: 'offline' });
  state.memory = MEM.serialize(mem);
  state.consolidator = CON.serialize(con);
  if (result.ran) state.lastConsolidatedAt = now;
  await save(store, state);
  return { domain: domain, result: result };
}

async function consolidateAll(store, now) {
  store.assertDurable();
  var out = [];
  for (var i = 0; i < DOMAINS.length; i++) out.push(await consolidateDomain(store, DOMAINS[i], now));
  return { ok: true, at: now, domains: out };
}

module.exports = {
  STATE_VERSION: STATE_VERSION,
  DOMAINS: DOMAINS,
  INVESTMENT_HORIZONS: INVESTMENT_HORIZONS,
  OUTCOME_LOG_KEY: OUTCOME_LOG_KEY,
  stateKey: stateKey,
  ownerFor: POLICY.ownerFor,
  grade: grade,
  recordCommand: recordCommand,
  recordOutcome: recordOutcome,
  sweepOutcomes: sweepOutcomes,
  consolidateDomain: consolidateDomain,
  consolidateAll: consolidateAll,
  selectionContext: selectionContext,
  persistSelectionGate: persistSelectionGate,
  _fresh: fresh,
  _load: load
};
