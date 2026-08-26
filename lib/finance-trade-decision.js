'use strict';

/**
 * Admitted Finance candidate -> sandbox motor-decision boundary.
 *
 * The provider may choose BUY, SELL, SHORT, COVER, or ABSTAIN and explain that choice. It
 * cannot choose size, price, broker, leverage, or execution environment. Those
 * are derived by the deterministic policy below from a fresh Tradier sandbox
 * quote and account snapshot. The result is still only a B10-selected intent;
 * B14 preview and order dispatch remain separate gates.
 */

var crypto = require('node:crypto');
var Admission = require('./finance-paper-admission.js');
var Provider = require('./finance-trade-decision-provider.js');
var PROP = require('../brain-v2/kernel/propose.js');
var SEL = require('../brain-v2/kernel/select.js');
var FinanceMetabolism = require('./finance-resource-metabolism.js');
var FeedConfirmation = require('./finance-feed-confirmation.js');
var PositionInput = require('./finance-position-input.js');

var SCHEMA = 'finance-trade-decision/1.0';
var PROPOSAL_SCHEMA = 'finance-trade-decision-proposal/1.2';
var RECEIPT_SCHEMA = 'finance-trade-decision-receipt/1.0';
var LOG_KEY = 'finance_trade_decision_log';
// Trade-selection receipts are the durable episodic index used by B14 and the
// multiscale learner. They must outlive transient packets and review windows.
var RETENTION_SECONDS = null;
// Tradier's equity API accepts whole-share quantities.  Keep quantity at one,
// but allow a bounded paper candidate whose share price is above the original
// $100 bootstrap ceiling.  This does not alter the separate live-money gate.
var HARD_MAX_NOTIONAL_USD = 500;
var MIN_ACTION_CONFIDENCE = 0.75;
var FACTOR_NAMES = [
  'issuerFeeds', 'quarterlyReporting', 'currentQuote', 'marketPerformance',
  'companyNetworkStress', 'thing0Eligibility', 'thing1ValidatedSignal'
];

var SYSTEM = [
  'You are the LIMEN Finance sandbox motor-decision actor.',
  'Return exactly one JSON object and no markdown.',
  'The schema is finance-trade-decision-proposal/1.2.',
  'Choose BUY, SELL, SHORT, COVER, or ABSTAIN for the supplied company only.',
  'Re-read the supplied exact-issuer feeds, quarterly-report evidence, current quote, historical performance, network stress, and Helix eligibility before deciding. Use only supplied evidence and copy every evidenceRefs entry exactly.',
  'Thing 0 only states whether validated Thing 1 is applicable. Thing 1 may be considered only when explicitly applicable. The Thing 2 snapshot is deliberately withheld from this action decision and is reconciled with Thing 1 only after the proposal is complete.',
  'Assess every required factor with a BULLISH, BEARISH, MIXED, ABSENT, or NOT_APPLICABLE state and a source-grounded reason. No single factor directly authorizes a trade.',
  'Do not choose quantity, price, order type, broker, leverage, options, or live execution. SHORT is sandbox-only and must agree with the supplied projected-margin side.',
  'A paper candidate is not automatically a buy; ABSTAIN is correct when evidence does not justify a position.'
].join(' ');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function key(packetId) { return 'finance_trade_decision:' + packetId; }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function roundUpCent(value) { return Math.ceil(value * 100 - 1e-8) / 100; }
function roundDownCent(value) { return Math.floor(value * 100 + 1e-8) / 100; }

function policy(env) {
  env = env || process.env;
  var configured = Number(env.LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD);
  var cap = Number.isFinite(configured) && configured > 0
    ? Math.min(HARD_MAX_NOTIONAL_USD, configured)
    : HARD_MAX_NOTIONAL_USD;
  return {
    id: 'finance-sandbox-motor-policy/1',
    environment: 'sandbox',
    paperOnly: true,
    liveExecution: false,
    longOnly: false,
    cashOnly: true,
    optionsAllowed: false,
    shortingAllowed: true,
    shortCollateralPolicy: 'tradier-sandbox-preview-required',
    marginAllowed: false,
    maxSharesPerDecision: 1,
    maxGrossNotionalUsd: cap,
    maxQuoteSlippageBps: 20,
    benchmarkSymbol: 'SPY',
    riskLimitPct: 20,
    minimumActionConfidence: MIN_ACTION_CONFIDENCE,
    outcomeHorizonsDays: [1, 3, 7, 14, 30, 60, 90]
  };
}

function identityKey(value) {
  return value && text(value.kind) && text(value.value) ? value.kind + '\u0000' + value.value : null;
}

function evidenceMatches(candidate, proposal) {
  var expected = (candidate && candidate.evidenceRefs || []).map(function (row) {
    return row && row.role + '\u0000' + identityKey(row.sourceIdentity);
  }).filter(Boolean).sort();
  var actual = (proposal && proposal.evidenceRefs || []).map(function (row) {
    return row && row.role + '\u0000' + identityKey(row.sourceIdentity);
  }).filter(Boolean).sort();
  return expected.length > 0 && JSON.stringify(expected) === JSON.stringify(actual);
}

function forbiddenProposalFields(value, path, found) {
  if (!value || typeof value !== 'object') return;
  var forbidden = ['quantity', 'price', 'limitPrice', 'order', 'broker', 'leverage', 'liveExecution',
    'thing2', 'thing2Observed', 'thing2DecisionWeight', 'thing2Role', 'thing2ReconciliationStatus'];
  Object.keys(value).forEach(function (field) {
    var at = path ? path + '.' + field : field;
    if (forbidden.indexOf(field) >= 0) found.push(at);
    forbiddenProposalFields(value[field], at, found);
  });
}

function parseProposal(raw, candidate, evidence) {
  var source = String(raw || '').trim();
  var start = source.indexOf('{'), end = source.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, reason: 'trade_decision_json_required' };
  var value;
  try { value = JSON.parse(source.slice(start, end + 1)); }
  catch (_) { return { ok: false, reason: 'trade_decision_json_invalid' }; }
  var blockers = [];
  if (!value || value.schemaVersion !== PROPOSAL_SCHEMA) blockers.push('trade_decision_schema_required');
  if (['BUY', 'SELL', 'SHORT', 'COVER', 'ABSTAIN'].indexOf(value && value.action) < 0) blockers.push('trade_decision_action_invalid');
  if (!candidate || !value || value.symbol !== candidate.company.ticker) blockers.push('trade_decision_symbol_must_match_candidate');
  if (!Number.isFinite(value && value.confidence) || value.confidence < 0 || value.confidence > 1) blockers.push('trade_decision_confidence_invalid');
  if (!text(value && value.rationale)) blockers.push('trade_decision_rationale_required');
  if (!text(value && value.invalidation)) blockers.push('trade_decision_invalidation_required');
  FACTOR_NAMES.forEach(function (name) {
    var factor = value && value.factorAssessment && value.factorAssessment[name];
    if (!factor || ['BULLISH', 'BEARISH', 'MIXED', 'ABSENT', 'NOT_APPLICABLE'].indexOf(factor.state) < 0 || !text(factor.reason)) {
      blockers.push('trade_decision_factor_assessment_required_' + name);
    }
  });
  var forbidden = [];
  forbiddenProposalFields(value, '', forbidden);
  forbidden.forEach(function (field) { blockers.push('trade_decision_forbidden_field_' + field); });
  if (!evidenceMatches(candidate, value)) blockers.push('trade_decision_evidence_refs_must_match_candidate');
  return blockers.length ? { ok: false, reason: blockers[0], blockers: blockers } : { ok: true, proposal: value };
}

function withoutThing2ForDecision(evidence) {
  var projected = clone(evidence) || {};
  if (projected.helixReport) delete projected.helixReport.thing2;
  if (projected.helixReport) delete projected.helixReport.reconciliation;
  if (projected.interpretationBoundary) {
    Object.keys(projected.interpretationBoundary).forEach(function (key) {
      if (/^thing2/i.test(key)) delete projected.interpretationBoundary[key];
    });
    projected.interpretationBoundary.postDecisionMaskingReconciliationDeferred = true;
  }
  return projected;
}

function postDecisionReconciliation(evidence) {
  var helix = evidence && evidence.helixReport || {};
  var thing2 = helix.thing2 || {};
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

function quarterlyEvidence(rows) {
  return (Array.isArray(rows) ? rows : []).filter(function (row) {
    return !!PositionInput.reportingType(row && row.title);
  }).map(function (row) {
    var next = clone(row);
    next.reportingType = PositionInput.reportingType(next.title);
    return next;
  });
}

async function decisionEvidence(broker, candidate, risk, confirmation, options) {
  options = options || {};
  var symbol = candidate.company.ticker;
  var targetHistory = Object.prototype.hasOwnProperty.call(options, 'marketHistory')
    ? options.marketHistory : await broker.history(symbol, { interval: 'daily' });
  var benchmarkHistory = Object.prototype.hasOwnProperty.call(options, 'benchmarkHistory')
    ? options.benchmarkHistory : await broker.history(risk.benchmarkSymbol, { interval: 'daily' });
  var company = PositionInput.companyByTicker(symbol) || candidate.company;
  var helixReport;
  if (Object.prototype.hasOwnProperty.call(options, 'helixReport')) {
    helixReport = options.helixReport;
  } else {
    try {
      helixReport = await PositionInput.helixReport({
        fetch: options.fetch || global.fetch,
        origin: options.origin || 'https://limenhelix.com',
        idempotencyKey: candidate.sourcePacketId || candidate.id
      }, company);
    } catch (_) { helixReport = null; }
  }
  var issuer = clone(confirmation && confirmation.context && confirmation.context.semanticEvidence || []);
  var performance = PositionInput.marketPerformance(targetHistory, benchmarkHistory);
  var helix = PositionInput.helixSections(helixReport);
  var blockers = [];
  var gaps = [];
  if (!performance.target.observations) blockers.push('target_market_history_required');
  if (!performance.benchmark.observations) blockers.push('benchmark_market_history_required');
  if (!issuer.length) blockers.push('current_exact_issuer_feed_required');
  var reporting = quarterlyEvidence(issuer);
  if (!reporting.length) gaps.push('no_current_quarterly_or_earnings_observation');
  if (!helixReport || !helixReport.request_id) gaps.push('protected_helix_report_unavailable');
  return {
    schemaVersion: 'finance-trade-decision-evidence/1.0',
    status: blockers.length ? 'ABSTAINED' : 'READY',
    blockers: blockers,
    gaps: gaps,
    issuerFeeds: issuer,
    quarterlyReporting: reporting,
    marketPerformance: performance,
    companyNetworkStress: clone(confirmation && confirmation.context && confirmation.context.networkEvidence || []),
    helixReport: helix,
    interpretationBoundary: {
      thing0IsEligibilityOnly: true,
      thing1RequiresValidatedApplicability: true,
      thing2Observed: helix.thing2.observed,
      thing2DecisionWeight: 0,
      thing2Role: 'alignment_and_masking_reconciliation_only',
      thing2ReconciliationStatus: helix.thing2.maskingAssessment,
      thing2LeverageAllowed: false,
      noSingleFactorAuthorizesTrade: true
    }
  };
}

function positionQuantity(account, symbol) {
  var rows = account && Array.isArray(account.positions) ? account.positions : [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].symbol || '').toUpperCase() === symbol) return Number(rows[i].quantity) || 0;
  }
  return 0;
}

function projectedSide(candidate) {
  var rows = candidate && candidate.projectedMarginRanking && candidate.projectedMarginRanking.entries;
  if (!Array.isArray(rows)) return 'LONG';
  var selected = rows.find(function (row) {
    return row && row.company && candidate.company && row.company.slug === candidate.company.slug && row.company.ticker === candidate.company.ticker;
  });
  return selected && selected.side === 'SHORT' ? 'SHORT' : 'LONG';
}

function buildIntent(candidate, proposal, quote, account, risk, benchmarkQuote) {
  if (proposal.action === 'ABSTAIN') return { status: 'ABSTAINED', reason: 'finance_actor_abstained', tradeIntent: null };
  if (proposal.confidence < risk.minimumActionConfidence) {
    return { status: 'ABSTAINED', reason: 'trade_decision_confidence_below_policy_floor', tradeIntent: null };
  }
  var symbol = candidate.company.ticker;
  var held = positionQuantity(account, symbol);
  var rankedSide = projectedSide(candidate);
  var totalCash = Number(account && account.totalCash);
  if (!Number.isFinite(totalCash)) return { status: 'ABSTAINED', reason: 'tradier_total_cash_unmeasured', tradeIntent: null };
  var last = Number(quote && quote.last), bid = Number(quote && quote.bid), ask = Number(quote && quote.ask);
  if (!Number.isFinite(last) || last <= 0) return { status: 'ABSTAINED', reason: 'tradier_quote_unmeasured', tradeIntent: null };
  var benchmarkBaseline = Number(benchmarkQuote && benchmarkQuote.last);
  if (!Number.isFinite(benchmarkBaseline) || benchmarkBaseline <= 0 ||
      String(benchmarkQuote && benchmarkQuote.symbol || '').toUpperCase() !== risk.benchmarkSymbol) {
    return { status: 'ABSTAINED', reason: 'tradier_benchmark_quote_unmeasured', tradeIntent: null };
  }
  var reference, limitPrice, quantity = 1;
  if (proposal.action === 'BUY') {
    if (rankedSide !== 'LONG') return { status: 'ABSTAINED', reason: 'action_conflicts_with_projected_margin_side', tradeIntent: null };
    if (held > 0) return { status: 'ABSTAINED', reason: 'policy_forbids_automatic_averaging', tradeIntent: null };
    if (held < 0) return { status: 'ABSTAINED', reason: 'cover_action_required_for_short_position', tradeIntent: null };
    reference = Number.isFinite(ask) && ask > 0 ? ask : last;
    limitPrice = roundUpCent(reference * (1 + risk.maxQuoteSlippageBps / 10000));
    if (limitPrice > risk.maxGrossNotionalUsd || limitPrice > totalCash) {
      return { status: 'ABSTAINED', reason: 'one_share_exceeds_sandbox_budget', tradeIntent: null };
    }
  } else if (proposal.action === 'SHORT') {
    if (rankedSide !== 'SHORT') return { status: 'ABSTAINED', reason: 'action_conflicts_with_projected_margin_side', tradeIntent: null };
    if (held !== 0) return { status: 'ABSTAINED', reason: 'policy_forbids_automatic_position_stacking', tradeIntent: null };
    if (String(account && account.accountType || '').toLowerCase() !== 'margin') {
      return { status: 'ABSTAINED', reason: 'tradier_margin_account_required_for_paper_short', tradeIntent: null };
    }
    reference = Number.isFinite(bid) && bid > 0 ? bid : last;
    limitPrice = roundDownCent(reference * (1 - risk.maxQuoteSlippageBps / 10000));
    if (limitPrice > risk.maxGrossNotionalUsd) {
      return { status: 'ABSTAINED', reason: 'one_share_exceeds_sandbox_budget', tradeIntent: null };
    }
  } else if (proposal.action === 'COVER') {
    if (held > -1) return { status: 'ABSTAINED', reason: 'short_position_required_for_cover', tradeIntent: null };
    reference = Number.isFinite(ask) && ask > 0 ? ask : last;
    limitPrice = roundUpCent(reference * (1 + risk.maxQuoteSlippageBps / 10000));
    if (limitPrice > risk.maxGrossNotionalUsd || limitPrice > totalCash) {
      return { status: 'ABSTAINED', reason: 'one_share_exceeds_sandbox_budget', tradeIntent: null };
    }
  } else {
    if (held < 1) return { status: 'ABSTAINED', reason: 'long_position_required_for_sell', tradeIntent: null };
    reference = Number.isFinite(bid) && bid > 0 ? bid : last;
    limitPrice = roundDownCent(reference * (1 - risk.maxQuoteSlippageBps / 10000));
  }
  return {
    status: 'INTENT_READY',
    reason: null,
    tradeIntent: {
      symbol: symbol,
      side: proposal.action === 'SHORT' ? 'sell_short' : proposal.action === 'COVER' ? 'buy_to_cover' : proposal.action.toLowerCase(),
      quantity: quantity,
      limitPrice: limitPrice,
      maxNotionalUsd: risk.maxGrossNotionalUsd,
      sourceArtifactId: candidate.id,
      thesisId: candidate.id,
      horizonDays: risk.outcomeHorizonsDays.slice(),
      benchmarkSymbol: risk.benchmarkSymbol,
      benchmarkBaselineValue: benchmarkBaseline,
      riskLimitPct: risk.riskLimitPct
    }
  };
}

function b10(candidate, proposal, tradeIntent, now) {
  var actionKinds = { BUY: 'open_sandbox_long', SELL: 'close_sandbox_long', SHORT: 'open_sandbox_short', COVER: 'close_sandbox_short' };
  var actionKind = actionKinds[proposal.action];
  var actor = PROP.makeCandidate({
    id: 'cand_finance_' + actionKind,
    kind: actionKind,
    target: candidate.company.ticker,
    parameters: { paperOnly: true, sourceArtifactId: candidate.id },
    rationale: 'the independent Finance actor selected a bounded sandbox action from the admitted candidate',
    expectedBenefits: ['a measured paper position episode', '1/3/7/14-day regulation evidence plus 30/60/90-day consolidation evidence'],
    expectedHarms: ['sandbox loss', 'model error', 'market movement before fill'],
    evidenceQuality: proposal.confidence,
    uncertainty: 1 - proposal.confidence,
    urgency: 0.35,
    reversibility: 'partial',
    addressesState: 0.95,
    cost: Math.min(1, tradeIntent.maxNotionalUsd / HARD_MAX_NOTIONAL_USD),
    authority: 'internal:tradier_sandbox_paper',
    rollbackPlan: 'do not submit, cancel an open sandbox order, or close only an established long or short position',
    expectedEvaluationMs: 30 * 24 * 60 * 60 * 1000,
    movesVariable: 'finance.position.' + candidate.company.ticker + '.quantity',
    expectedMagnitude: (proposal.action === 'BUY' || proposal.action === 'COVER') ? tradeIntent.quantity : -tradeIntent.quantity
  });
  var noAction = PROP.makeCandidate({
    id: 'cand_finance_no_trade',
    kind: PROP.KIND.NO_ACTION,
    rationale: 'waiting preserves capital when evidence or policy does not clear the motor threshold',
    expectedBenefits: ['no market exposure', 'more evidence can accumulate'],
    expectedHarms: ['a favorable paper opportunity may pass'],
    evidenceQuality: 1,
    uncertainty: 0,
    urgency: 0,
    reversibility: 'full',
    addressesState: 0.1,
    cost: 0,
    authority: 'internal:none',
    rollbackPlan: 'nothing to roll back',
    expectedEvaluationMs: 0
  });
  var gate = SEL.createGate();
  return SEL.select(gate, [actor, noAction], { now: now, modulation: {} });
}

function selection(candidate, proposal, tradeIntent, decision, now) {
  var released = decision && decision.outcome === 'released' && decision.released &&
    decision.released.candidate && decision.released.candidate.kind !== PROP.KIND.NO_ACTION;
  var identity = { kind: 'finance-paper-candidate', value: candidate.id };
  return {
    schemaVersion: 1,
    id: 'sel_finance_trade_' + hash({ packet: candidate.sourcePacketId || null, candidate: candidate.id, action: proposal.action }).slice(0, 20),
    at: now,
    status: released ? 'RELEASED' : 'HELD',
    lane: 'investment',
    command: 'prepare_tradier_sandbox_order',
    ownerDomain: 'finance',
    subjectDomain: 'finance',
    candidate: {
      cik: candidate.company.cik || null,
      ticker: candidate.company.ticker,
      sourceIdentity: identity,
      source: 'finance-paper-admission'
    },
    evidence: {
      sourcePacketId: candidate.sourcePacketId || null,
      candidateId: candidate.id,
      evidenceRefs: clone(candidate.evidenceRefs),
      actorConfidence: proposal.confidence
    },
    reasons: released ? [] : ['brain_b10_did_not_release_sandbox_trade'],
    criticDecision: decision,
    tradeIntent: released ? clone(tradeIntent) : null,
    authority: {
      artifactGenerationOnly: false,
      paperOnly: true,
      tradierSandboxPreview: true,
      tradierSandboxOrderAutomation: true,
      liveTradingAuthorized: false,
      stressDirectlyTriggered: false,
      headlineDirectlyTriggered: false
    }
  };
}

async function latestPacketId(store) {
  var rows = await store.lrange(Admission.LOG_KEY, 0, 0);
  return rows[0] && rows[0].packetId || null;
}

async function audit(store, broker, packetId, env) {
  store.assertDurable();
  var resolvedPacketId = text(packetId) ? packetId : await latestPacketId(store);
  var admission = resolvedPacketId ? await store.get(Admission.admissionKey(resolvedPacketId)) : null;
  var existing = resolvedPacketId ? await store.get(key(resolvedPacketId)) : null;
  var blockers = [];
  if (!resolvedPacketId) blockers.push('finance_paper_admission_missing');
  if (!admission || admission.status !== 'ADMITTED_TO_PAPER') blockers.push('finance_paper_admission_required');
  if (!admission || !admission.candidate || admission.candidate.status !== 'READY_TO_FIRE') blockers.push('finance_ready_candidate_required');
  var risk = policy(env);
  return {
    schemaVersion: SCHEMA,
    packetId: resolvedPacketId,
    status: existing ? 'ALREADY_DECIDED' : (blockers.length ? 'ABSTAINED' : 'READY_FOR_TRADE_DECISION'),
    blockers: blockers,
    admission: clone(admission),
    receipt: clone(existing),
    policy: risk,
    providerCalled: existing ? existing.providerCalled === true : false,
    brokerReadOnly: true,
    orderPreviewed: existing ? existing.orderPreviewed === true : false,
    orderPlaced: false,
    liveMoney: false
  };
}

async function execute(store, broker, request, options) {
  request = request || {};
  options = options || {};
  var env = options.env || process.env;
  var before = await audit(store, broker, request.packetId, env);
  if (before.receipt) return { ok: true, idempotent: true, receipt: before.receipt, audit: before };
  if (request.approve !== true) return { ok: false, status: 'ABSTAINED', reason: 'explicit_trade_decision_required', audit: before };
  if (before.status !== 'READY_FOR_TRADE_DECISION') {
    return { ok: false, status: 'ABSTAINED', reason: before.blockers[0] || 'trade_decision_not_ready', audit: before };
  }

  var candidate = before.admission.candidate;
  candidate.sourcePacketId = before.packetId;
  var decisionAt = options.now || new Date().toISOString();
  var confirmationCheck = FeedConfirmation.validate(
    options.feedConfirmation, before.packetId, candidate.company, decisionAt
  );
  if (!confirmationCheck.ok) {
    return {
      ok: false,
      status: 'ABSTAINED',
      reason: confirmationCheck.reason,
      receipt: {
        schemaVersion: RECEIPT_SCHEMA,
        packetId: before.packetId,
        candidateId: candidate.id,
        completedAt: decisionAt,
        status: 'ABSTAINED',
        reason: confirmationCheck.reason,
        providerCalled: false,
        brokerReadOnly: true,
        orderPreviewed: false,
        orderPlaced: false,
        feedConfirmation: clone(options.feedConfirmation || null),
        liveMoney: false
      },
      audit: before
    };
  }
  var symbol = candidate.company.ticker;
  var observed = await Promise.all([broker.quote(symbol), broker.quote(before.policy.benchmarkSymbol), broker.accountSnapshot()]);
  var quote = observed[0], benchmarkQuote = observed[1], account = observed[2], risk = before.policy;
  var evidenceOptions = {
    fetch: options.fetch || global.fetch,
    origin: env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com'
  };
  if (Object.prototype.hasOwnProperty.call(options, 'marketHistory')) evidenceOptions.marketHistory = options.marketHistory;
  if (Object.prototype.hasOwnProperty.call(options, 'benchmarkHistory')) evidenceOptions.benchmarkHistory = options.benchmarkHistory;
  if (Object.prototype.hasOwnProperty.call(options, 'helixReport')) evidenceOptions.helixReport = options.helixReport;
  var evidence = await decisionEvidence(broker, candidate, risk, options.feedConfirmation, evidenceOptions);
  var resourceBefore = FinanceMetabolism.evaluate({
    symbol: symbol,
    quote: quote,
    account: account,
    motorPolicy: risk,
    providerCallsUsed: 0,
    env: env
  });
  var commandedAt = decisionAt;
  var commanded = {
    schemaVersion: RECEIPT_SCHEMA,
    packetId: before.packetId,
    candidateId: candidate.id,
    status: 'COMMANDING',
    commandedAt: commandedAt,
    oneShot: true,
    providerCalled: false,
    brokerReadOnly: true,
    orderPreviewed: false,
    orderPlaced: false,
    liveMoney: false,
    resourceMetabolism: { beforeProvider: clone(resourceBefore), afterProvider: null }
  };
  var created = await store.setIfAbsent(key(before.packetId), commanded);
  if (!created) {
    var raced = await store.get(key(before.packetId));
    return { ok: true, idempotent: true, receipt: raced, audit: before };
  }

  if (!resourceBefore.allowsProviderCall) {
    var inhibited = Object.assign({}, commanded, {
      completedAt: options.completedAt || new Date().toISOString(),
      status: 'ABSTAINED',
      reason: resourceBefore.blockers[0] || 'finance_resource_metabolism_inhibited',
      blockers: clone(resourceBefore.blockers),
      proposal: null,
      market: clone(quote),
      account: {
        accountId: account.accountId || null,
        accountType: account.accountType || null,
        totalCash: account.totalCash,
        totalEquity: account.totalEquity,
        candidatePositionQuantity: positionQuantity(account, symbol),
        observedAt: account.observedAt || null
      },
      policy: clone(risk),
      decisionEvidence: clone(evidence),
      tradeIntent: null,
      selection: null,
      safety: {
        oneShot: true, brokerReadOnly: true, orderPreviewed: false,
        orderPlaced: false, paperOnly: true, liveMoney: false
      }
    });
    await store.set(key(before.packetId), inhibited);
    await store.lpush(LOG_KEY, {
      packetId: inhibited.packetId,
      candidateId: inhibited.candidateId,
      completedAt: inhibited.completedAt,
      status: inhibited.status,
      action: null,
      symbol: symbol,
      providerCalled: false
    });
    await store.ltrim(LOG_KEY, 0, 199);
    return { ok: true, idempotent: false, receipt: inhibited, audit: before };
  }

  if (evidence.status !== 'READY') {
    var evidenceHeld = Object.assign({}, commanded, {
      completedAt: options.completedAt || new Date().toISOString(),
      status: 'ABSTAINED',
      reason: evidence.blockers[0] || 'finance_decision_evidence_incomplete',
      blockers: clone(evidence.blockers),
      proposal: null,
      market: clone(quote),
      policy: clone(risk),
      decisionEvidence: clone(evidence),
      tradeIntent: null,
      selection: null,
      safety: { oneShot: true, brokerReadOnly: true, orderPreviewed: false, orderPlaced: false, paperOnly: true, liveMoney: false }
    });
    await store.set(key(before.packetId), evidenceHeld);
    await store.lpush(LOG_KEY, { packetId: evidenceHeld.packetId, candidateId: evidenceHeld.candidateId, completedAt: evidenceHeld.completedAt, status: evidenceHeld.status, action: null, symbol: symbol, providerCalled: false });
    await store.ltrim(LOG_KEY, 0, 199);
    return { ok: true, idempotent: false, receipt: evidenceHeld, audit: before };
  }

  var provider = options.provider || Provider.create({ env: env, fetch: options.fetch || global.fetch });
  var calls = 0, response;
  var requestBody = {
    schemaVersion: 'finance-trade-decision-request/1.0',
    candidate: clone(candidate),
    market: clone(quote),
    account: {
      accountType: account.accountType || null,
      totalCash: account.totalCash,
      totalEquity: account.totalEquity,
      candidatePositionQuantity: positionQuantity(account, symbol)
    },
    policy: clone(risk),
    resourceMetabolism: clone(resourceBefore),
    feedConfirmation: clone(options.feedConfirmation.context),
    decisionEvidence: withoutThing2ForDecision(evidence),
    responseSchema: {
      schemaVersion: PROPOSAL_SCHEMA,
      action: 'BUY | SELL | SHORT | COVER | ABSTAIN',
      symbol: symbol,
      confidence: 'number 0..1',
      rationale: 'source-grounded explanation',
      invalidation: 'what would falsify this action decision',
      factorAssessment: FACTOR_NAMES.reduce(function (out, name) {
        out[name] = { state: 'BULLISH | BEARISH | MIXED | ABSENT | NOT_APPLICABLE', reason: 'source-grounded explanation' };
        return out;
      }, {}),
      evidenceRefs: clone(candidate.evidenceRefs)
    }
  };
  try {
    calls++;
    response = await provider({ system: SYSTEM, prompt: JSON.stringify(requestBody), maxTokens: Provider.MAX_OUTPUT_TOKENS });
  } catch (err) {
    response = { ok: false, error: err && err.message || String(err) };
  }
  var parsed = response && response.ok === true ? parseProposal(response.text, candidate, evidence) : {
    ok: false,
    reason: response && response.disabled ? 'finance_trade_decision_ai_disabled' : 'finance_trade_decision_provider_failed'
  };
  var resourceAfter = FinanceMetabolism.evaluate({
    symbol: symbol,
    quote: quote,
    account: account,
    motorPolicy: risk,
    providerCallsUsed: calls,
    env: env
  });
  var effectiveRisk = Object.assign({}, risk, {
    maxGrossNotionalUsd: Math.min(risk.maxGrossNotionalUsd, resourceBefore.measurements.availableNotionalUsd)
  });
  var intentResult = parsed.ok ? buildIntent(candidate, parsed.proposal, quote, account, effectiveRisk, benchmarkQuote) : {
    status: 'ABSTAINED', reason: parsed.reason, tradeIntent: null
  };
  var critic = intentResult.status === 'INTENT_READY'
    ? b10(candidate, parsed.proposal, intentResult.tradeIntent, Date.parse(commandedAt)) : null;
  var selected = critic ? selection(candidate, parsed.proposal, intentResult.tradeIntent, critic, Date.parse(commandedAt)) : null;
  var finalStatus = selected && selected.status === 'RELEASED' ? 'TRADE_INTENT_SELECTED' : 'ABSTAINED';
  var receipt = {
    schemaVersion: RECEIPT_SCHEMA,
    packetId: before.packetId,
    candidateId: candidate.id,
    commandedAt: commandedAt,
    completedAt: options.completedAt || new Date().toISOString(),
    status: finalStatus,
    reason: finalStatus === 'TRADE_INTENT_SELECTED' ? null : (intentResult.reason || 'brain_b10_held'),
    blockers: clone(parsed.blockers || []),
    providerCalled: calls === 1,
    provider: {
      name: response && response.provider || null,
      model: response && response.model || null,
      tokensIn: response && response.tokensIn || null,
      tokensOut: response && response.tokensOut || null
    },
    proposal: parsed.ok ? clone(parsed.proposal) : null,
    market: clone(quote),
    account: {
      accountId: account.accountId || null,
      accountType: account.accountType || null,
      totalCash: account.totalCash,
      totalEquity: account.totalEquity,
      candidatePositionQuantity: positionQuantity(account, symbol),
      observedAt: account.observedAt || null
    },
    policy: clone(risk),
    resourceMetabolism: {
      beforeProvider: clone(resourceBefore),
      afterProvider: clone(resourceAfter)
    },
    feedConfirmation: clone(options.feedConfirmation),
    decisionEvidence: clone(evidence),
    postDecisionReconciliation: postDecisionReconciliation(evidence),
    tradeIntent: selected && selected.status === 'RELEASED' ? clone(intentResult.tradeIntent) : null,
    selection: clone(selected),
    safety: {
      oneShot: true,
      brokerReadOnly: true,
      orderPreviewed: false,
      orderPlaced: false,
      paperOnly: true,
      liveMoney: false
    }
  };
  await store.set(key(before.packetId), receipt);
  await store.lpush(LOG_KEY, {
    packetId: receipt.packetId,
    candidateId: receipt.candidateId,
    completedAt: receipt.completedAt,
    status: receipt.status,
    action: receipt.proposal && receipt.proposal.action || null,
    symbol: symbol,
    providerCalled: receipt.providerCalled
  });
  await store.ltrim(LOG_KEY, 0, 199);
  return { ok: true, idempotent: false, receipt: receipt, audit: before };
}

module.exports = {
  SCHEMA: SCHEMA,
  PROPOSAL_SCHEMA: PROPOSAL_SCHEMA,
  RECEIPT_SCHEMA: RECEIPT_SCHEMA,
  LOG_KEY: LOG_KEY,
  RETENTION_SECONDS: RETENTION_SECONDS,
  HARD_MAX_NOTIONAL_USD: HARD_MAX_NOTIONAL_USD,
  MIN_ACTION_CONFIDENCE: MIN_ACTION_CONFIDENCE,
  FACTOR_NAMES: FACTOR_NAMES,
  SYSTEM: SYSTEM,
  key: key,
  policy: policy,
  parseProposal: parseProposal,
  quarterlyEvidence: quarterlyEvidence,
  decisionEvidence: decisionEvidence,
  withoutThing2ForDecision: withoutThing2ForDecision,
  postDecisionReconciliation: postDecisionReconciliation,
  positionQuantity: positionQuantity,
  buildIntent: buildIntent,
  b10: b10,
  selection: selection,
  audit: audit,
  execute: execute
};
