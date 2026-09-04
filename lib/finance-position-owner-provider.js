'use strict';

/* Strict structured-output boundary for one existing Finance paper position. */

var StructuredProvider = require('./finance-structured-provider.js');

var MODEL = StructuredProvider.ANTHROPIC_MODEL;
var MAX_OUTPUT_TOKENS = 3000;
var FACTOR_NAMES = [
  'issuerFeeds', 'quarterlyReporting', 'marketQuote', 'marketPerformance',
  'companyNetworkStress', 'financeBrainState', 'entryThesis', 'companyLearning',
  'thing0Eligibility', 'thing1ValidatedSignal', 'kernelContext'
];
var FACTOR_SCHEMA = {
  type: 'object',
  properties: {
    state: { type: 'string', enum: ['SUPPORTS_HOLD', 'SUPPORTS_EXIT', 'MIXED', 'UNAVAILABLE'] },
    reason: { type: 'string', description: 'Concise source-grounded reason.' }
  },
  required: ['state', 'reason'],
  additionalProperties: false
};
var OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'string', const: 'finance-position-owner-proposal/1.0' },
    action: { type: 'string', enum: ['HOLD', 'SELL', 'COVER'] },
    symbol: { type: 'string', description: 'Must exactly match the supplied open-position ticker.' },
    confidence: { type: 'number', description: 'A number from 0 through 1; downstream validation enforces the bounds.' },
    rationale: { type: 'string', description: 'Concise source-grounded position rationale.' },
    invalidation: { type: 'string', description: 'Concise condition that would change the position decision.' },
    factorAssessment: {
      type: 'object',
      properties: FACTOR_NAMES.reduce(function (out, name) {
        out[name] = FACTOR_SCHEMA;
        return out;
      }, {}),
      required: FACTOR_NAMES.slice(),
      additionalProperties: false
    }
  },
  required: ['schemaVersion', 'action', 'symbol', 'confidence', 'rationale', 'invalidation', 'factorAssessment'],
  additionalProperties: false
};

function enabled(env) {
  env = env || process.env;
  return env.LIMEN_FINANCE_TRADE_DECISION_ENABLED === '1';
}

function configured(env) { return StructuredProvider.configured(env); }
function readiness(env) { return StructuredProvider.readiness(env); }

function create(options) {
  options = options || {};
  var env = options.env || process.env;
  var calls = 0;
  var routedProvider = StructuredProvider.route({
    env: env,
    fetch: options.fetch || global.fetch,
    schema: OUTPUT_SCHEMA,
    schemaName: 'finance_position_owner_proposal',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    label: 'Finance position-owner provider',
    anthropicModel: MODEL
  });
  return async function provider(input) {
    if (!enabled(env)) return { ok: false, disabled: true, error: 'Finance trade-decision provider switch is off' };
    calls++;
    if (calls > 1) throw new Error('Finance position-owner provider is one-shot');
    return routedProvider(input);
  };
}

module.exports = {
  MODEL: MODEL,
  MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
  FACTOR_NAMES: FACTOR_NAMES,
  OUTPUT_SCHEMA: OUTPUT_SCHEMA,
  enabled: enabled,
  configured: configured,
  readiness: readiness,
  create: create
};
