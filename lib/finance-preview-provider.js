'use strict';

/* Narrow paid-provider boundary for an operator-authenticated Finance Preview. */

var MODEL = 'claude-sonnet-4-6';
var MAX_OUTPUT_TOKENS = 3000;
var OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'string', const: 'finance-manager-proposal/1.0' },
    id: { type: 'string', minLength: 1 },
    company: {
      type: 'object',
      properties: {
        slug: { type: 'string', minLength: 1 },
        ticker: { type: 'string', minLength: 1 }
      },
      required: ['slug', 'ticker'],
      additionalProperties: false
    },
    thesis: { type: 'string', minLength: 1 },
    invalidation: { type: 'string', minLength: 1 },
    horizonDays: { type: 'integer', enum: [30, 60, 90] },
    scenarios: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        properties: { name: { type: 'string', minLength: 1 } },
        required: ['name'],
        additionalProperties: false
      }
    },
    evidenceRefs: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['semantic', 'market', 'network'] },
          sourceIdentity: {
            type: 'object',
            properties: {
              kind: { type: 'string', minLength: 1 },
              value: { type: 'string', minLength: 1 }
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
        reason: { type: 'string', minLength: 1 }
      },
      required: ['status', 'reason'],
      additionalProperties: false
    },
    paperOnly: { type: 'boolean', const: true },
    provenance: {
      type: 'object',
      properties: {
        producer: { type: 'string', minLength: 1 },
        generatedAt: { type: 'string', minLength: 1 }
      },
      required: ['producer', 'generatedAt'],
      additionalProperties: false
    }
  },
  required: [
    'schemaVersion', 'id', 'company', 'thesis', 'invalidation',
    'horizonDays', 'scenarios', 'evidenceRefs',
    'independenceAssessment', 'paperOnly', 'provenance'
  ],
  additionalProperties: false
};

function enabled(env) {
  env = env || process.env;
  return env.LIMEN_FINANCE_PREVIEW_ENABLED === '1';
}

function create(options) {
  options = options || {};
  var env = options.env || process.env;
  var fetchFn = options.fetch || global.fetch;
  var calls = 0;

  return async function provider(input) {
    if (!enabled(env)) return { ok: false, disabled: true, error: 'Finance Preview provider switch is off' };
    if (!env.ANTHROPIC_API_KEY) return { ok: false, disabled: true, error: 'ANTHROPIC_API_KEY is not configured' };
    calls++;
    if (calls > 1) throw new Error('Finance Preview provider is one-shot');
    var requested = Number(input && input.maxTokens);
    var maxTokens = Number.isFinite(requested)
      ? Math.min(MAX_OUTPUT_TOKENS, Math.max(1, Math.floor(requested)))
      : MAX_OUTPUT_TOKENS;
    var response = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: OUTPUT_SCHEMA
          }
        }
      })
    });
    if (!response || !response.ok) {
      var detail = response && response.text ? await response.text() : '';
      return { ok: false, provider: 'anthropic', model: MODEL,
        error: 'anthropic HTTP ' + (response && response.status) + ': ' + String(detail).slice(0, 300) };
    }
    var body = await response.json();
    var stopReason = body && body.stop_reason || null;
    if (stopReason === 'max_tokens' || stopReason === 'refusal') {
      return {
        ok: false,
        provider: 'anthropic',
        model: MODEL,
        stopReason: stopReason,
        error: stopReason === 'max_tokens'
          ? 'anthropic structured output was truncated'
          : 'anthropic refused the structured output request',
        tokensIn: body && body.usage ? body.usage.input_tokens || 0 : 0,
        tokensOut: body && body.usage ? body.usage.output_tokens || 0 : 0
      };
    }
    var text = body && body.content && body.content[0] ? body.content[0].text : '';
    return {
      ok: true,
      provider: 'anthropic',
      model: MODEL,
      text: typeof text === 'string' ? text : '',
      stopReason: stopReason,
      tokensIn: body && body.usage ? body.usage.input_tokens || 0 : 0,
      tokensOut: body && body.usage ? body.usage.output_tokens || 0 : 0
    };
  };
}

module.exports = {
  MODEL: MODEL,
  MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
  OUTPUT_SCHEMA: OUTPUT_SCHEMA,
  enabled: enabled,
  create: create
};
