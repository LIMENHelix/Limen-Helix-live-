'use strict';

/* Narrow paid-provider boundary for one admitted Finance paper candidate. */

var StructuredProvider = require('./finance-structured-provider.js');

var MODEL = StructuredProvider.ANTHROPIC_MODEL;
var MAX_OUTPUT_TOKENS = 3000;
var FACTOR_NAMES = [
  'issuerFeeds', 'quarterlyReporting', 'currentQuote', 'marketPerformance',
  'companyNetworkStress', 'thing0Eligibility', 'thing1ValidatedSignal'
];
var FACTOR_SCHEMA = {
  type: 'object',
  properties: {
    state: { type: 'string', enum: ['BULLISH', 'BEARISH', 'MIXED', 'ABSENT', 'NOT_APPLICABLE'] },
    reason: { type: 'string', description: 'Concise source-grounded reason, preferably no more than 40 words.' }
  },
  required: ['state', 'reason'],
  additionalProperties: false
};
var OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'string', const: 'finance-trade-decision-proposal/1.2' },
    action: { type: 'string', enum: ['BUY', 'SELL', 'SHORT', 'COVER', 'ABSTAIN'] },
    symbol: { type: 'string', description: 'Must exactly match the supplied candidate ticker.' },
    confidence: { type: 'number', description: 'A number from 0 through 1; downstream validation enforces the bounds.' },
    rationale: { type: 'string', description: 'Concise source-grounded rationale, preferably no more than 80 words.' },
    invalidation: { type: 'string', description: 'Concise falsification condition, preferably no more than 80 words.' },
    factorAssessment: {
      type: 'object',
      properties: FACTOR_NAMES.reduce(function (out, name) {
        out[name] = FACTOR_SCHEMA;
        return out;
      }, {}),
      required: FACTOR_NAMES.slice(),
      additionalProperties: false
    },
    evidenceRefs: {
      type: 'array',
      description: 'Copy the supplied evidence references exactly; downstream validation enforces identity equality.',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['semantic', 'market', 'network'] },
          sourceIdentity: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              value: { type: 'string' }
            },
            required: ['kind', 'value'],
            additionalProperties: false
          }
        },
        required: ['role', 'sourceIdentity'],
        additionalProperties: false
      }
    }
  },
  required: [
    'schemaVersion', 'action', 'symbol', 'confidence', 'rationale',
    'invalidation', 'factorAssessment', 'evidenceRefs'
  ],
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
    schemaName: 'finance_trade_decision_proposal',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    label: 'Finance trade-decision provider',
    anthropicModel: MODEL
  });

  return async function provider(input) {
    if (!enabled(env)) return { ok: false, disabled: true, error: 'Finance trade-decision provider switch is off' };
    calls++;
    if (calls > 1) throw new Error('Finance trade-decision provider is one-shot');
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
