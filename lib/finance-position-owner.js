'use strict';

/**
 * Finance brain owner for an already-open Tradier sandbox position.
 *
 * The owner may HOLD, SELL a measured long, or COVER a measured short.  It
 * cannot add exposure.  Stress, headlines, reports, and kernel context are
 * required to be assessed separately and none may directly authorize the
 * motor act.  Any exit still crosses B10, the Finance motor capability gate,
 * B14 preview/efference persistence, and the sandbox-only broker receipt.
 */

var crypto = require('node:crypto');
var Provider = require('./finance-trade-decision-provider.js');
var B14 = require('./tradier-b14.js');
var Bridge = require('./finance-b14-bridge.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var DevelopmentalAuthorization = require('./finance-paper-developmental-authority.js');
var Learning = require('./autofire-learning.js');
var PROP = require('../brain-v2/kernel/propose.js');
var SEL = require('../brain-v2/kernel/select.js');

var SCHEMA = 'finance-position-owner/1.0';
var PROPOSAL_SCHEMA = 'finance-position-owner-proposal/1.0';
var RECEIPT_SCHEMA = 'finance-position-owner-receipt/1.0';
var LOG_KEY = 'finance_position_owner_log';
var DEFAULT_CADENCE_MS = 60 * 60 * 1000;
var MIN_CADENCE_MS = 15 * 60 * 1000;
var MAX_CADENCE_MS = 24 * 60 * 60 * 1000;
var MIN_EXIT_CONFIDENCE = 0.75;

var SYSTEM = [
  'You are the LIMEN Finance brain owner of one existing Tradier sandbox position.',
  'Return exactly one JSON object and no markdown using finance-position-owner-proposal/1.0.',
  'For a long position choose HOLD or SELL; for a short position choose HOLD or COVER. Never add exposure.',
  'Assess issuer feeds, quarterly/earnings evidence, current and historical market performance, company-network stress, current Finance brain state, entry thesis, learned company outcomes, Thing 0 eligibility, applicable validated Thing 1, and established kernel context separately.',
  'An unavailable factor must be marked UNAVAILABLE. Stress, a headline, a report, or a kernel pattern alone must never determine the action.',
  'The Thing 2 snapshot is deliberately withheld from this position decision. It is reconciled with Thing 1 only after the HOLD, SELL, or COVER proposal is complete and cannot affect confidence, sizing, leverage, or execution.',
  'HOLD is correct when the combined supplied evidence does not justify a bounded exit.'
].join(' ');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function finite(value) { return Number.isFinite(Number(value)); }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function on(value) { return value === '1' || value === 'true' || value === 'TRUE'; }
function enabled(env) { return on((env || process.env).LIMEN_FINANCE_POSITION_OWNER_ENABLED); }
function cadenceMs(env) {
  var value = Number((env || process.env).LIMEN_FINANCE_POSITION_REVIEW_MINUTES) * 60 * 1000;
  return Number.isFinite(value) ? Math.max(MIN_CADENCE_MS, Math.min(MAX_CADENCE_MS, value)) : DEFAULT_CADENCE_MS;
}
function reviewKey(openingCommandId, now, env) {
  var cadence = cadenceMs(env);
  return 'finance_position_review:' + String(openingCommandId) + ':' + Math.floor(Number(now) / cadence);
}
function roundUpCent(value) { return Math.ceil(value * 100 - 1e-8) / 100; }
function roundDownCent(value) { return Math.floor(value * 100 + 1e-8) / 100; }

function factorNames() {
  return ['issuerFeeds', 'quarterlyReporting', 'marketQuote', 'marketPerformance', 'companyNetworkStress', 'financeBrainState', 'entryThesis', 'companyLearning', 'thing0Eligibility', 'thing1ValidatedSignal', 'kernelContext'];
}

function parseProposal(raw, context) {
  var source = String(raw || '').trim();
  var start = source.indexOf('{'), end = source.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, reason: 'position_owner_json_required' };
  var value;
  try { value = JSON.parse(source.slice(start, end + 1)); }
  catch (_) { return { ok: false, reason: 'position_owner_json_invalid' }; }
  var blockers = [];
  var quantity = Number(context && context.position && context.position.quantity);
  var allowed = quantity > 0 ? ['HOLD', 'SELL'] : ['HOLD', 'COVER'];
  if (!value || value.schemaVersion !== PROPOSAL_SCHEMA) blockers.push('position_owner_schema_required');
  if (allowed.indexOf(value && value.action) < 0) blockers.push('position_owner_action_invalid_for_position');
  if (!context || value.symbol !== context.company.ticker) blockers.push('position_owner_symbol_mismatch');
  if (!finite(value && value.confidence) || Number(value.confidence) < 0 || Number(value.confidence) > 1) blockers.push('position_owner_confidence_invalid');
  if (!text(value && value.rationale)) blockers.push('position_owner_rationale_required');
  if (!text(value && value.invalidation)) blockers.push('position_owner_invalidation_required');
  ['thing2', 'thing2Observed', 'thing2DecisionWeight', 'thing2Role', 'thing2ReconciliationStatus'].forEach(function (field) {
    if (value && Object.prototype.hasOwnProperty.call(value, field)) blockers.push('position_owner_thing2_decision_field_forbidden');
  });
  var factors = value && value.factorAssessment;
  factorNames().forEach(function (name) {
    var row = factors && factors[name];
    if (!row || ['SUPPORTS_HOLD', 'SUPPORTS_EXIT', 'MIXED', 'UNAVAILABLE'].indexOf(row.state) < 0 || !text(row.reason)) {
      blockers.push('position_owner_factor_' + name + '_required');
    }
  });
  return blockers.length ? { ok: false, reason: blockers[0], blockers: blockers } : { ok: true, proposal: value };
}

function decisionContext(context) {
  var projected = clone(context) || {};
  if (projected.helixReport) delete projected.helixReport.thing2;
  if (projected.helixReport) delete projected.helixReport.reconciliation;
  projected.interpretationBoundary = projected.interpretationBoundary || {};
  Object.keys(projected.interpretationBoundary).forEach(function (key) {
    if (/^thing2/i.test(key)) delete projected.interpretationBoundary[key];
  });
  projected.interpretationBoundary.postDecisionMaskingReconciliationDeferred = true;
  return projected;
}

function postDecisionReconciliation(context) {
  var helix = context && context.helixReport || {}, thing2 = helix.thing2 || {};
  return {
    sequence: 'thing1_result_then_thing2_snapshot',
    thing1Applicable: !!(helix.thing1 && helix.thing1.applicable),
    snapshotObserved: thing2.observed === true,
    status: thing2.maskingAssessment || 'unassessed',
    agreesWithThing1: thing2.agreesWithThing1 === undefined ? 'indeterminate' : thing2.agreesWithThing1,
    role: 'alignment_and_masking_reconciliation_only',
    decisionWeight: 0,
    leverageAllowed: false,
    appliedAfterProposal: true
  };
}

function openOrders(account, symbol) {
  var terminal = { filled: true, canceled: true, cancelled: true, rejected: true, expired: true };
  return (account && Array.isArray(account.orders) ? account.orders : []).filter(function (row) {
    return String(row && row.symbol || '').toUpperCase() === symbol && !terminal[String(row && row.status || '').toLowerCase()];
  });
}

function buildExitIntent(context, proposal) {
  if (proposal.action === 'HOLD') return { status: 'HELD', reason: 'finance_position_owner_held', intent: null };
  if (Number(proposal.confidence) < MIN_EXIT_CONFIDENCE) return { status: 'HELD', reason: 'position_exit_confidence_below_policy_floor', intent: null };
  var position = context.position;
  var quote = context.currentQuote;
  var quantity = Number(position.quantity);
  var side = quantity > 0 ? 'sell' : 'buy_to_cover';
  if ((side === 'sell' && proposal.action !== 'SELL') || (side === 'buy_to_cover' && proposal.action !== 'COVER')) {
    return { status: 'HELD', reason: 'position_exit_side_mismatch', intent: null };
  }
  var reference = side === 'sell'
    ? (finite(quote.bid) && Number(quote.bid) > 0 ? Number(quote.bid) : Number(quote.last))
    : (finite(quote.ask) && Number(quote.ask) > 0 ? Number(quote.ask) : Number(quote.last));
  var limitPrice = side === 'sell' ? roundDownCent(reference * 0.998) : roundUpCent(reference * 1.002);
  var exitQuantity = Math.min(1, Math.abs(Math.trunc(quantity)));
  if (!exitQuantity) return { status: 'HELD', reason: 'whole_share_exit_quantity_unavailable', intent: null };
  return {
    status: 'READY',
    reason: null,
    intent: {
      symbol: context.company.ticker,
      side: side,
      quantity: exitQuantity,
      limitPrice: limitPrice,
      maxNotionalUsd: Math.max(500, roundUpCent(limitPrice * exitQuantity * 1.01)),
      sourceArtifactId: 'position-review:' + context.entry.openingCommandId + ':' + context.evidenceFingerprint.slice(0, 16),
      thesisId: context.entry.decision && context.entry.decision.candidateId || context.entry.openingCommandId,
      benchmarkSymbol: null,
      benchmarkBaselineValue: null,
      riskLimitPct: null,
      horizonDays: [1],
      ownerDomain: 'finance',
      decisionContext: {
        role: 'position-exit',
        parentOpeningCommandId: context.entry.openingCommandId,
        evidenceFingerprint: context.evidenceFingerprint,
        thing2Observed: !!(context.helixReport && context.helixReport.thing2 && context.helixReport.thing2.observed),
        thing2DecisionWeight: 0,
        thing2Role: 'alignment_and_masking_reconciliation_only',
        thing2ReconciliationStatus: context.helixReport && context.helixReport.thing2 && context.helixReport.thing2.maskingAssessment || 'unassessed'
      }
    }
  };
}

function selectExit(context, proposal, intent, selectionContext, now) {
  var actor = PROP.makeCandidate({
    id: 'cand_finance_position_exit_' + hash({ opening: context.entry.openingCommandId, fingerprint: context.evidenceFingerprint }).slice(0, 20),
    kind: proposal.action === 'SELL' ? 'close_sandbox_long' : 'close_sandbox_short',
    target: context.company.ticker,
    parameters: { paperOnly: true, parentOpeningCommandId: context.entry.openingCommandId },
    rationale: proposal.rationale,
    expectedBenefits: ['bounded regulation of an existing paper position', 'realized outcome attribution to the opening decision'],
    expectedHarms: ['paper loss realization', 'premature exit', 'market movement before fill'],
    evidenceQuality: Number(proposal.confidence),
    uncertainty: 1 - Number(proposal.confidence),
    urgency: 0.7,
    reversibility: 'partial',
    addressesState: 0.98,
    cost: 0.05,
    authority: 'internal:tradier_sandbox_paper',
    rollbackPlan: 'cancel only the unfilled remainder; never recreate exposure automatically',
    expectedEvaluationMs: 24 * 60 * 60 * 1000,
    movesVariable: 'finance.position.' + context.company.ticker + '.quantity',
    expectedMagnitude: intent.side === 'sell' ? -intent.quantity : intent.quantity
  });
  var noAction = PROP.makeCandidate({
    id: 'cand_finance_position_hold_' + context.company.ticker,
    kind: PROP.KIND.NO_ACTION,
    rationale: 'hold preserves the measured position when the exit case does not clear the Finance gate',
    expectedBenefits: ['avoid unsupported turnover'], expectedHarms: ['continued paper exposure'],
    evidenceQuality: 1, uncertainty: 0, urgency: 0, reversibility: 'full',
    addressesState: 0.15, cost: 0, authority: 'internal:none', rollbackPlan: 'nothing to roll back', expectedEvaluationMs: 0
  });
  var gate = selectionContext && selectionContext.gate || SEL.createGate();
  var critic = SEL.select(gate, [actor, noAction], {
    now: now,
    modulation: selectionContext && selectionContext.modulation || {}
  });
  var released = critic && critic.outcome === 'released' && critic.released && critic.released.candidate && critic.released.candidate.kind !== PROP.KIND.NO_ACTION;
  var selection = {
    schemaVersion: 1,
    id: 'sel_finance_position_' + hash({ actor: actor.id, at: now }).slice(0, 20),
    at: now,
    status: released ? 'RELEASED' : 'HELD',
    lane: 'investment',
    command: 'close_tradier_sandbox_position',
    ownerDomain: 'finance',
    subjectDomain: 'finance',
    candidate: {
      cik: context.company.cik,
      ticker: context.company.ticker,
      sourceIdentity: { kind: 'finance-opening-command', value: context.entry.openingCommandId }
    },
    evidence: {
      evidenceFingerprint: context.evidenceFingerprint,
      issuerEvidence: context.currentIssuerEvidence.map(function (row) { return row.sourceIdentity; }),
      networkEvidence: context.companyNetworkStress && context.companyNetworkStress.sourceIdentity || null,
      brainPacketId: context.financeBrain.packetId,
      actorConfidence: Number(proposal.confidence)
    },
    reasons: released ? [] : ['brain_b10_did_not_release_position_exit'],
    criticDecision: critic,
    tradeIntent: released ? clone(intent) : null,
    authority: {
      paperOnly: true,
      tradierSandboxPreview: true,
      tradierSandboxOrderAutomation: true,
      liveTradingAuthorized: false,
      stressDirectlyTriggered: false,
      headlineDirectlyTriggered: false,
      quarterlyReportDirectlyTriggered: false,
      kernelDirectlyTriggered: false,
      thing2Observed: !!(context.helixReport && context.helixReport.thing2 && context.helixReport.thing2.observed),
      thing2DecisionWeight: 0,
      thing2Role: 'alignment_and_masking_reconciliation_only',
      thing2ReconciliationStatus: context.helixReport && context.helixReport.thing2 && context.helixReport.thing2.maskingAssessment || 'unassessed'
    }
  };
  return { critic: critic, selection: selection, gate: gate };
}

async function log(store, row) {
  await store.lpush(LOG_KEY, row);
  await store.ltrim(LOG_KEY, 0, 499);
}

async function execute(options) {
  options = options || {};
  var store = options.store;
  var broker = options.broker;
  var env = options.env || process.env;
  var now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  var input = options.input;
  var context = input && input.context;
  if (!store || typeof store.assertDurable !== 'function') throw new Error('Finance position owner requires a durable store');
  store.assertDurable();
  if (!enabled(env)) return { ok: true, status: 'HELD', reason: 'finance-position-owner-switch-off', providerCalled: false, orderPlaced: false, paperOnly: true, liveMoney: false };
  if (!input || input.status !== 'READY_FOR_POSITION_REVIEW' || !context) {
    return { ok: true, status: 'ABSTAINED', reason: input && input.blockers && input.blockers[0] || 'position-owner-input-not-ready', blockers: input && input.blockers || [], providerCalled: false, orderPlaced: false, paperOnly: true, liveMoney: false };
  }
  var symbol = context.company.ticker;
  if (openOrders(options.account, symbol).length) {
    return { ok: true, status: 'HELD', reason: 'position-owner-open-order-inhibited', symbol: symbol, providerCalled: false, orderPlaced: false, paperOnly: true, liveMoney: false };
  }
  var switches = Bridge.state(env);
  var key = reviewKey(context.entry.openingCommandId, now, env);
  var existing = await store.get(key);
  if (existing) return { ok: true, idempotent: true, status: existing.status, receipt: existing, providerCalled: existing.providerCalled === true, orderPlaced: !!existing.orderId, paperOnly: true, liveMoney: false };
  var commandedAt = new Date(now).toISOString();
  var receipt = {
    schemaVersion: RECEIPT_SCHEMA,
    reviewId: 'fpr_' + hash({ key: key, fingerprint: context.evidenceFingerprint }).slice(0, 24),
    reviewKey: key,
    openingCommandId: context.entry.openingCommandId,
    symbol: symbol,
    status: 'COMMANDING',
    commandedAt: commandedAt,
    evidenceFingerprint: context.evidenceFingerprint,
    providerCalled: false,
    orderPlaced: false,
    paperOnly: true,
    liveMoney: false
  };
  var claimed = await store.setIfAbsent(key, receipt);
  if (!claimed) {
    existing = await store.get(key);
    return { ok: true, idempotent: true, status: existing && existing.status || 'ALREADY_CLAIMED', receipt: existing, providerCalled: !!(existing && existing.providerCalled), orderPlaced: !!(existing && existing.orderId), paperOnly: true, liveMoney: false };
  }

  try {
    var provider = options.provider || Provider.create({ env: env, fetch: options.fetch || global.fetch });
    var request = {
      schemaVersion: 'finance-position-owner-request/1.0',
      context: decisionContext(context),
      allowedAction: Number(context.position.quantity) > 0 ? 'HOLD | SELL' : 'HOLD | COVER',
      responseSchema: {
        schemaVersion: PROPOSAL_SCHEMA,
        action: Number(context.position.quantity) > 0 ? 'HOLD | SELL' : 'HOLD | COVER',
        symbol: symbol,
        confidence: 'number 0..1',
        rationale: 'combined source-grounded explanation',
        invalidation: 'what would change this position decision',
        factorAssessment: factorNames().reduce(function (out, name) {
          out[name] = { state: 'SUPPORTS_HOLD | SUPPORTS_EXIT | MIXED | UNAVAILABLE', reason: 'source-grounded reason' };
          return out;
        }, {})
      }
    };
    var response;
    try { response = await provider({ system: SYSTEM, prompt: JSON.stringify(request), maxTokens: Provider.MAX_OUTPUT_TOKENS }); }
    catch (providerError) { response = { ok: false, error: providerError && providerError.message || String(providerError) }; }
    receipt.providerCalled = true;
    receipt.provider = { name: response && response.provider || null, model: response && response.model || null, tokensIn: response && response.tokensIn || null, tokensOut: response && response.tokensOut || null };
    var parsed = response && response.ok === true ? parseProposal(response.text, context) : { ok: false, reason: 'position_owner_provider_failed' };
    if (!parsed.ok) {
      receipt.status = 'ABSTAINED';
      receipt.reason = parsed.reason;
      receipt.blockers = parsed.blockers || [];
      receipt.completedAt = new Date().toISOString();
      await store.set(key, receipt); await log(store, clone(receipt));
      return { ok: true, status: receipt.status, receipt: receipt, providerCalled: true, orderPlaced: false, paperOnly: true, liveMoney: false };
    }
    receipt.proposal = clone(parsed.proposal);
    receipt.postDecisionReconciliation = postDecisionReconciliation(context);
    var intentResult = buildExitIntent(context, parsed.proposal);
    if (intentResult.status !== 'READY') {
      receipt.status = 'HELD';
      receipt.reason = intentResult.reason;
      receipt.completedAt = new Date().toISOString();
      await store.set(key, receipt); await log(store, clone(receipt));
      return { ok: true, status: receipt.status, receipt: receipt, providerCalled: true, orderPlaced: false, paperOnly: true, liveMoney: false };
    }
    var learningContext = await Learning.selectionContext(store, 'finance');
    var selected = selectExit(context, parsed.proposal, intentResult.intent, learningContext, now);
    await Learning.persistSelectionGate(store, 'finance', selected.gate);
    receipt.selection = clone(selected.selection);
    receipt.tradeIntent = clone(intentResult.intent);
    if (selected.selection.status !== 'RELEASED') {
      receipt.status = 'HELD'; receipt.reason = 'brain_b10_did_not_release_position_exit'; receipt.completedAt = new Date().toISOString();
      await store.set(key, receipt); await log(store, clone(receipt));
      return { ok: true, status: receipt.status, receipt: receipt, providerCalled: true, orderPlaced: false, paperOnly: true, liveMoney: false };
    }
    if (!switches.previewAutonomyEnabled || !switches.orderAutonomyEnabled) {
      receipt.status = 'HELD';
      receipt.reason = !switches.previewAutonomyEnabled ? 'sandbox-autonomy-switch-off' : 'order-autonomy-switch-off';
      receipt.completedAt = new Date().toISOString();
      await store.set(key, receipt); await log(store, clone(receipt));
      return { ok: true, status: receipt.status, receipt: receipt, providerCalled: true, orderPlaced: false, paperOnly: true, liveMoney: false };
    }
    var motor = await (options.motorAuthorization || MotorAuthorization).authorize(store, 'finance', 'broker/order', now);
    if (!motor.authorized) motor = await (options.developmentalAuthorization || DevelopmentalAuthorization).authorize(store, context.financeBrain.packetId, env, now);
    if (!motor.authorized) {
      receipt.status = 'HELD'; receipt.reason = motor.reason || 'finance-product-motor-held'; receipt.motorAuthorization = clone(motor); receipt.completedAt = new Date().toISOString();
      await store.set(key, receipt); await log(store, clone(receipt));
      return { ok: true, status: receipt.status, receipt: receipt, providerCalled: true, orderPlaced: false, paperOnly: true, liveMoney: false };
    }
    var releasedAction = selected.selection.criticDecision.released;
    var actionId = releasedAction && (releasedAction.candidateId || releasedAction.candidate && releasedAction.candidate.id);
    intentResult.intent.selectionId = selected.selection.id;
    intentResult.intent.actionId = actionId;
    intentResult.intent.decisionContext.selectionId = selected.selection.id;
    var b14 = options.b14 || B14;
    var preview = await b14.createPreview(store, broker, intentResult.intent, now);
    var learned = await Learning.recordCommand(store, {
      selection: selected.selection,
      efferenceCopy: { id: 'finance-position:' + preview.previewId, actionId: actionId, traceId: receipt.reviewId, emittedAt: now }
    });
    if (!learned || learned.ok !== true) {
      var learningError = new Error(learned && (learned.detail || learned.error) || 'Finance position command learning was not durable');
      learningError.code = 'FINANCE_POSITION_COMMAND_LEARNING_NOT_DURABLE';
      throw learningError;
    }
    var command = await b14.submitApproved(store, broker, { previewId: preview.previewId, confirmation: preview.confirmationSummary }, now);
    receipt.status = 'EXIT_COMMAND_RECEIPTED';
    receipt.reason = null;
    receipt.previewId = preview.previewId;
    receipt.commandId = command.commandId;
    receipt.orderId = command.receipt && command.receipt.orderId || null;
    receipt.motorAuthorization = clone(motor);
    receipt.rollback = clone(command.rollback || null);
    receipt.completedAt = new Date().toISOString();
    receipt.orderPlaced = true;
    await store.set(key, receipt); await log(store, clone(receipt));
    return { ok: true, status: receipt.status, receipt: receipt, command: command, providerCalled: true, orderPlaced: true, paperOnly: true, liveMoney: false };
  } catch (error) {
    receipt.status = 'REVIEW_UNRESOLVED';
    receipt.reason = error && error.code || 'FINANCE_POSITION_OWNER_FAILED';
    receipt.error = { code: error && error.code || 'FINANCE_POSITION_OWNER_FAILED', message: String(error && error.message || error) };
    receipt.completedAt = new Date().toISOString();
    await store.set(key, receipt); await log(store, clone(receipt));
    throw error;
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  PROPOSAL_SCHEMA: PROPOSAL_SCHEMA,
  RECEIPT_SCHEMA: RECEIPT_SCHEMA,
  LOG_KEY: LOG_KEY,
  DEFAULT_CADENCE_MS: DEFAULT_CADENCE_MS,
  MIN_EXIT_CONFIDENCE: MIN_EXIT_CONFIDENCE,
  SYSTEM: SYSTEM,
  enabled: enabled,
  cadenceMs: cadenceMs,
  reviewKey: reviewKey,
  parseProposal: parseProposal,
  decisionContext: decisionContext,
  postDecisionReconciliation: postDecisionReconciliation,
  buildExitIntent: buildExitIntent,
  selectExit: selectExit,
  execute: execute
};
