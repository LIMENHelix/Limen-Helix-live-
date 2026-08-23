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
var RESEARCH_OWNERS = ['research', 'health'];
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
  requiredString(input.outputId, 'outputId');
  requiredString(input.actionId, 'actionId');
  requiredString(input.observationId, 'observationId');
  requiredString(input.observedAt, 'observedAt');
  if (!RESEARCH_OWNERS.includes(owner) && owner !== 'finance') fail('OUTCOME_OWNER_UNSUPPORTED', 'ownerDomain is not an active research/investment owner');
  return {
    schemaVersion: SCHEMA_VERSION,
    eventType: null,
    lane: lane,
    ownerDomain: owner,
    outputId: String(input.outputId),
    actionId: String(input.actionId),
    observationId: String(input.observationId),
    observedAt: String(input.observedAt)
  };
}

function buildResearchPublication(input) {
  input = input || {};
  var owner = requiredString(input.ownerDomain, 'ownerDomain');
  var event = base(input, 'research', owner);
  if (RESEARCH_OWNERS.indexOf(owner) < 0) fail('OUTCOME_RESEARCH_OWNER_REQUIRED', 'research ownerDomain must be research or health');
  var source = requiredIdentity(input.sourceIdentity, 'sourceIdentity');
  requiredString(source.publisher, 'sourceIdentity.publisher');
  requiredString(source.url, 'sourceIdentity.url');
  requiredString(source.retrievedAt, 'sourceIdentity.retrievedAt');
  requiredString(source.contentHash, 'sourceIdentity.contentHash');
  event.eventType = 'OUTCOME_RESEARCH_PUBLISHED';
  event.sourceIdentity = source;
  event.outcomeData = {
    publicationId: requiredString(input.publicationId, 'publicationId'),
    publishedAt: requiredString(input.publishedAt, 'publishedAt'),
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
  if (RESEARCH_OWNERS.indexOf(owner) < 0) fail('OUTCOME_RESEARCH_OWNER_REQUIRED', 'research ownerDomain must be research or health');
  var source = requiredIdentity(input.sourceIdentity, 'sourceIdentity');
  var d = input.outcomeData || {};
  if (!['PROGRESS', 'REGRESSION', 'NO_CHANGE'].includes(d.progress)) fail('OUTCOME_PROGRESS_REQUIRED', 'progress must be PROGRESS, REGRESSION, or NO_CHANGE');
  if (!Array.isArray(d.evidenceIds) || !d.evidenceIds.length) fail('OUTCOME_EVIDENCE_IDS_REQUIRED', 'evidenceIds are required');
  if (!d.independenceAssessment || d.independenceAssessment.status !== 'ESTABLISHED') fail('OUTCOME_INDEPENDENCE_REQUIRED', 'independenceAssessment.status must be ESTABLISHED');
  var coverage = d.mappingCoverage || {};
  MAPPINGS.forEach(function (mapping) { if (coverage[mapping] !== true) fail('OUTCOME_MAPPING_REQUIRED', 'mappingCoverage.' + mapping + ' must be true'); });
  event.eventType = 'OUTCOME_RESEARCH_EVALUATED';
  event.sourceIdentity = source;
  event.outcomeData = {
    progress: d.progress,
    evidenceIds: d.evidenceIds.map(String),
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
  var benchmark = requiredIdentity(input.benchmarkIdentity, 'benchmarkIdentity');
  requiredFinite(input.benchmarkBaselineValue, 'benchmarkBaselineValue');
  requiredFinite(input.benchmarkObservedValue, 'benchmarkObservedValue');
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
