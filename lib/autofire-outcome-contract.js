'use strict';

/**
 * Versioned input contract for later B11/B14 outcome observers.
 *
 * This module only validates and normalizes an externally identified
 * observation. It does not fetch, publish, trade, grade, activate, or write
 * storage. A producer must call one of the builders and then persist the
 * returned event through the authenticated outcome path.
 */

var SCHEMA_VERSION = 'autofire-outcome-observation/1.0';
// Research outcomes are owned by the research lane and by the two domains
// that actually conduct research in this system. The old research/health
// aliases remain accepted for backward-compatible publication receipts.
var RESEARCH_OWNERS = ['research', 'health', 'science', 'medicine', 'education'];
var HORIZONS = [30, 60, 90];
var MAPPINGS = [
  'neurology_to_business_homology',
  'business_to_neurology_homology',
  'kernel_dynamics',
  'p0_p10_proof_and_effects'
];
var FORBIDDEN = new Set([
  'stress', 'score', 'sentiment', 'articleCount', 'headlineCount',
  'promotion', 'activation', 'pathwayActivation', 'consolidationScore'
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function finite(value) { return typeof value === 'number' && isFinite(value); }
function fail(code, message) {
  var err = new Error(message);
  err.code = code;
  throw err;
}
function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail('OUTCOME_' + name.toUpperCase() + '_REQUIRED', name + ' is required');
  return value.trim();
}
function requiredTimestamp(value, name) {
  var normalized = requiredString(value, name);
  var parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) fail('OUTCOME_' + name.toUpperCase() + '_INVALID', name + ' must be a parseable timestamp');
  return new Date(parsed).toISOString();
}
function requiredFinite(value, name) {
  if (!finite(value)) fail('OUTCOME_' + name.toUpperCase() + '_REQUIRED', name + ' must be finite');
  return value;
}
function requiredIdentity(value, name) {
  if (!value || typeof value !== 'object') fail('OUTCOME_' + name.toUpperCase() + '_REQUIRED', name + ' identity is required');
  requiredString(value.kind, name + '.kind');
  requiredString(value.value, name + '.value');
  return clone(value);
}
function rejectForbidden(value, path) {
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach(function (key) {
    if (FORBIDDEN.has(key)) fail('OUTCOME_FORBIDDEN_FIELD', (path || 'input') + '.' + key + ' cannot create an outcome');
    rejectForbidden(value[key], (path || 'input') + '.' + key);
  });
}
function base(input, lane, owner) {
  input = input || {};
  rejectForbidden(input, 'input');
  var outputId = requiredString(input.outputId, 'outputId');
  var actionId = requiredString(input.actionId, 'actionId');
  var observationId = requiredString(input.observationId, 'observationId');
  var observedAt = requiredTimestamp(input.observedAt, 'observedAt');
  if (!RESEARCH_OWNERS.includes(owner) && owner !== 'finance') fail('OUTCOME_OWNER_UNSUPPORTED', 'ownerDomain is not an active research/investment owner');
  var event = {
    schemaVersion: SCHEMA_VERSION,
    eventType: null,
    lane: lane,
    ownerDomain: owner,
    outputId: outputId,
    actionId: actionId,
    observationId: observationId,
    observedAt: observedAt
  };
  if (input.commandId !== undefined && input.commandId !== null) event.commandId = requiredString(input.commandId, 'commandId');
  return event;
}

function buildResearchPublication(input) {
  input = input || {};
  var owner = requiredString(input.ownerDomain, 'ownerDomain');
  var event = base(input, 'research', owner);
  if (RESEARCH_OWNERS.indexOf(owner) < 0) fail('OUTCOME_RESEARCH_OWNER_REQUIRED', 'research ownerDomain must be a registered research product or runtime owner');
  var source = requiredIdentity(input.sourceIdentity, 'sourceIdentity');
  requiredString(source.publisher, 'sourceIdentity.publisher');
  requiredString(source.url, 'sourceIdentity.url');
  source.retrievedAt = requiredTimestamp(source.retrievedAt, 'sourceIdentity.retrievedAt');
  requiredString(source.contentHash, 'sourceIdentity.contentHash');
  event.eventType = 'OUTCOME_RESEARCH_PUBLISHED';
  event.sourceIdentity = source;
  event.outcomeData = {
    publicationId: requiredString(input.publicationId, 'publicationId'),
    publishedAt: requiredTimestamp(input.publishedAt, 'publishedAt'),
    sourceIdentity: source,
    independenceAssessment: input.independenceAssessment
      ? clone(input.independenceAssessment)
      : { status: 'UNESTABLISHED', reason: 'publication receipt alone does not establish independence' }
  };
  return event;
}

function buildResearchEvaluation(input) {
  input = input || {};
  var owner = requiredString(input.ownerDomain, 'ownerDomain');
  var event = base(input, 'research', owner);
  if (RESEARCH_OWNERS.indexOf(owner) < 0) fail('OUTCOME_RESEARCH_OWNER_REQUIRED', 'research ownerDomain must be a registered research product or runtime owner');
  var source = requiredIdentity(input.sourceIdentity, 'sourceIdentity');
  source.retrievedAt = requiredTimestamp(source.retrievedAt, 'sourceIdentity.retrievedAt');
  var d = input.outcomeData || {};
  if (!['PROGRESS', 'REGRESSION', 'NO_CHANGE'].includes(d.progress)) fail('OUTCOME_PROGRESS_REQUIRED', 'progress must be PROGRESS, REGRESSION, or NO_CHANGE');
  if (!Array.isArray(d.evidenceIds) || !d.evidenceIds.length) fail('OUTCOME_EVIDENCE_IDS_REQUIRED', 'evidenceIds are required');
  var evidenceIds = d.evidenceIds.map(function (id, index) {
    return requiredString(id, 'evidenceIds[' + index + ']');
  });
  if (!d.independenceAssessment || d.independenceAssessment.status !== 'ESTABLISHED') fail('OUTCOME_INDEPENDENCE_REQUIRED', 'independenceAssessment.status must be ESTABLISHED');
  requiredString(d.independenceAssessment.method, 'independenceAssessment.method');
  requiredString(d.independenceAssessment.basis, 'independenceAssessment.basis');
  if (d.contradictions !== undefined && !Array.isArray(d.contradictions)) fail('OUTCOME_CONTRADICTIONS_INVALID', 'contradictions must be an array when supplied');
  if (d.retractions !== undefined && !Array.isArray(d.retractions)) fail('OUTCOME_RETRACTIONS_INVALID', 'retractions must be an array when supplied');
  var coverage = d.mappingCoverage || {};
  MAPPINGS.forEach(function (mapping) { if (coverage[mapping] !== true) fail('OUTCOME_MAPPING_REQUIRED', 'mappingCoverage.' + mapping + ' must be true'); });
  event.eventType = 'OUTCOME_RESEARCH_EVALUATED';
  event.sourceIdentity = source;
  event.outcomeData = {
    progress: d.progress,
    evidenceIds: evidenceIds,
    independenceAssessment: clone(d.independenceAssessment),
    mappingCoverage: clone(coverage),
    contradictions: Array.isArray(d.contradictions) ? clone(d.contradictions) : [],
    retractions: Array.isArray(d.retractions) ? clone(d.retractions) : [],
    sourceIdentity: source
  };
  return event;
}

function buildInvestmentPnl(input, options) {
  input = input || {};
  options = options || {};
  var owner = requiredString(input.ownerDomain || 'finance', 'ownerDomain');
  if (owner !== 'finance') fail('OUTCOME_INVESTMENT_OWNER_REQUIRED', 'investment ownerDomain must be finance');
  var event = base(input, 'investment', owner);
  var d = input.outcomeData || {};
  if (HORIZONS.indexOf(d.horizonDays) < 0) fail('OUTCOME_HORIZON_REQUIRED', 'horizonDays must be 30, 60, or 90');
  if (d.executionMode !== 'paper' && d.executionMode !== 'live') fail('OUTCOME_EXECUTION_MODE_REQUIRED', 'executionMode must be paper or live');
  if (d.executionMode === 'live' && options.allowLive !== true) fail('OUTCOME_LIVE_DISABLED', 'live investment outcome observer is disabled');
  ['investedAmount', 'netPnl', 'returnPct', 'benchmarkReturnPct', 'maxDrawdownPct'].forEach(function (name) { requiredFinite(d[name], name); });
  if (typeof d.riskBreach !== 'boolean') fail('OUTCOME_RISK_BREACH_REQUIRED', 'riskBreach must be boolean');
  requiredString(d.brokerOrderId, 'brokerOrderId');
  var source = requiredIdentity(input.sourceIdentity, 'sourceIdentity');
  requiredString(source.provider, 'sourceIdentity.provider');
  requiredString(source.accountId, 'sourceIdentity.accountId');
  requiredString(source.snapshotId, 'sourceIdentity.snapshotId');
  source.retrievedAt = requiredTimestamp(source.retrievedAt, 'sourceIdentity.retrievedAt');
  var benchmark = requiredIdentity(input.benchmarkIdentity, 'benchmarkIdentity');
  benchmark.retrievedAt = requiredTimestamp(benchmark.retrievedAt, 'benchmarkIdentity.retrievedAt');
  requiredFinite(input.benchmarkBaselineValue, 'benchmarkBaselineValue');
  requiredFinite(input.benchmarkObservedValue, 'benchmarkObservedValue');
  if (input.commandId !== undefined && input.commandId !== null) event.commandId = requiredString(input.commandId, 'commandId');
  var terms = input.sourceTerms || {};
  ['executedQuantity', 'averageFillPrice', 'positionMarketValue', 'fees'].forEach(function (name) {
    requiredFinite(terms[name], 'sourceTerms.' + name);
  });
  if (terms.executedQuantity <= 0 || terms.averageFillPrice <= 0 || terms.positionMarketValue <= 0 || terms.fees < 0) {
    fail('OUTCOME_SOURCE_TERMS_INVALID', 'sourceTerms must describe a positive filled position and non-negative fees');
  }
  var side = terms.side === undefined ? 'buy' : terms.side;
  if (side !== 'buy' && side !== 'sell_short') fail('OUTCOME_INVESTMENT_SIDE_INVALID', 'sourceTerms.side must be buy or sell_short');
  var invested = terms.executedQuantity * terms.averageFillPrice;
  var derivedNet = side === 'sell_short'
    ? invested - terms.positionMarketValue - terms.fees
    : terms.positionMarketValue - invested - terms.fees;
  var derivedReturn = invested > 0 ? (derivedNet / invested) * 100 : NaN;
  var rawBenchmarkReturn = input.benchmarkBaselineValue > 0
    ? ((input.benchmarkObservedValue - input.benchmarkBaselineValue) / input.benchmarkBaselineValue) * 100 : NaN;
  var derivedBenchmarkReturn = side === 'sell_short' ? -rawBenchmarkReturn : rawBenchmarkReturn;
  function closeEnough(actual, expected, name) {
    if (!finite(actual) || !finite(expected) || Math.abs(actual - expected) > 1e-8 * Math.max(1, Math.abs(expected))) {
      fail('OUTCOME_' + name.toUpperCase() + '_MISMATCH', name + ' does not match source terms');
    }
  }
  closeEnough(d.investedAmount, invested, 'investedAmount');
  closeEnough(d.netPnl, derivedNet, 'netPnl');
  closeEnough(d.returnPct, derivedReturn, 'returnPct');
  closeEnough(d.benchmarkReturnPct, derivedBenchmarkReturn, 'benchmarkReturnPct');
  event.eventType = 'OUTCOME_INVESTMENT_PNL';
  event.sourceIdentity = source;
  event.outcomeData = {
    horizonDays: d.horizonDays,
    investedAmount: d.investedAmount,
    netPnl: d.netPnl,
    returnPct: d.returnPct,
    benchmarkReturnPct: d.benchmarkReturnPct,
    maxDrawdownPct: d.maxDrawdownPct,
    riskBreach: d.riskBreach,
    executionMode: d.executionMode,
    brokerOrderId: d.brokerOrderId,
    sourceTerms: {
      executedQuantity: terms.executedQuantity,
      averageFillPrice: terms.averageFillPrice,
      positionMarketValue: terms.positionMarketValue,
      side: side,
      fees: terms.fees
    },
    benchmarkIdentity: benchmark,
    benchmarkBaselineValue: input.benchmarkBaselineValue,
    benchmarkObservedValue: input.benchmarkObservedValue,
    observationAt: event.observedAt,
    sourceIdentity: source
  };
  return event;
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  MAPPINGS: MAPPINGS.slice(),
  buildResearchPublication: buildResearchPublication,
  buildResearchEvaluation: buildResearchEvaluation,
  buildInvestmentPnl: buildInvestmentPnl
};
