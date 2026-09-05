'use strict';

/* Narrow paid-provider boundary for an operator-authenticated Finance Preview. */

var StructuredProvider = require('./finance-structured-provider.js');

var MODEL = StructuredProvider.ANTHROPIC_MODEL;
var MAX_OUTPUT_TOKENS = 3000;
var OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'string', const: 'finance-manager-proposal/1.1' },
    id: { type: 'string', description: 'Must be a non-empty proposal identifier.' },
    company: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Must be the exact non-empty supplied company slug.' },
        ticker: { type: 'string', description: 'Must be the exact non-empty supplied company ticker.' }
      },
      required: ['slug', 'ticker'],
      additionalProperties: false
    },
    thesis: { type: 'string', description: 'Must be a non-empty bounded paper thesis grounded in supplied evidence.' },
    invalidation: { type: 'string', description: 'Must be a non-empty condition that invalidates the thesis.' },
    horizonDays: { type: 'integer', enum: [1, 3, 7, 14, 30, 60, 90] },
    scenarios: {
      type: 'array',
      description: 'Must contain two to four scenarios; downstream validation enforces the exact bounds.',
      items: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Must be a non-empty scenario name.' } },
        required: ['name'],
        additionalProperties: false
      }
    },
    projectedMarginRanking: {
      type: 'object',
      properties: {
        metric: { type: 'string', const: 'risk-adjusted-expected-total-return-pct' },
        methodology: { type: 'string', const: 'expectedReturnPct - abs(min(downsideReturnPct, 0)) * (1 - confidence)' },
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              company: {
                type: 'object',
                properties: { slug: { type: 'string' }, ticker: { type: 'string' } },
                required: ['slug', 'ticker'],
                additionalProperties: false
              },
              side: { type: 'string', enum: ['LONG', 'SHORT'] },
              expectedReturnPct: { type: 'number' },
              downsideReturnPct: { type: 'number' },
              confidence: { type: 'number' },
              riskAdjustedMarginPct: { type: 'number' }
            },
            required: ['company', 'side', 'expectedReturnPct', 'downsideReturnPct', 'confidence', 'riskAdjustedMarginPct'],
            additionalProperties: false
          }
        }
      },
      required: ['metric', 'methodology', 'entries'],
      additionalProperties: false
    },
    evidenceRefs: {
      type: 'array',
      description: 'Must contain exactly one semantic, one market, and one network reference; downstream validation enforces the exact set.',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['semantic', 'market', 'network'] },
          sourceIdentity: {
            type: 'object',
            properties: {
              kind: { type: 'string', description: 'Must exactly copy the non-empty supplied identity kind.' },
              value: { type: 'string', description: 'Must exactly copy the non-empty supplied identity value.' }
            },
            required: ['kind', 'value'],
            additionalProperties: false
          }
        },
        required: ['role', 'sourceIdentity'],
        additionalProperties: false
      }
    },
    independenceAssessment: {
      type: 'object',
      properties: {
        status: { type: 'string', const: 'UNASSESSED' },
        reason: { type: 'string', description: 'Must be a non-empty explanation for leaving independence unassessed.' }
      },
      required: ['status', 'reason'],
      additionalProperties: false
    },
    paperOnly: { type: 'boolean', const: true },
    provenance: {
      type: 'object',
      properties: {
        producer: { type: 'string', description: 'Must be a non-empty producer identity.' },
        generatedAt: { type: 'string', description: 'Must be a valid ISO-8601 timestamp.' }
      },
      required: ['producer', 'generatedAt'],
      additionalProperties: false
    }
  },
  required: [
    'schemaVersion', 'id', 'company', 'thesis', 'invalidation',
    'horizonDays', 'scenarios', 'projectedMarginRanking', 'evidenceRefs',
    'independenceAssessment', 'paperOnly', 'provenance'
  ],
  additionalProperties: false
};

function enabled(env) {
  env = env || process.env;
  return env.LIMEN_FINANCE_PREVIEW_ENABLED === '1';
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
    schemaName: 'finance_manager_proposal',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    label: 'Finance Preview provider',
    anthropicModel: MODEL
  });

  return async function provider(input) {
    if (!enabled(env)) return { ok: false, disabled: true, error: 'Finance Preview provider switch is off' };
    calls++;
    if (calls > 1) throw new Error('Finance Preview provider is one-shot');
    return routedProvider(input);
  };
}

module.exports = {
  MODEL: MODEL,
  MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
  OUTPUT_SCHEMA: OUTPUT_SCHEMA,
  enabled: enabled,
  configured: configured,
  readiness: readiness,
  create: create
};
