'use strict';

/* Narrow paid-provider boundary for an operator-authenticated Finance Preview. */

var MODEL = 'claude-sonnet-4-6';
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

function bounded(value, limit) {
  var out = typeof value === 'string' ? value : String(value == null ? '' : value);
  return out.slice(0, limit || 300);
}

function rejectionDetail(response, raw) {
  var parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
  var detail = parsed && parsed.error || {};
  return {
    httpStatus: response && Number.isFinite(Number(response.status)) ? Number(response.status) : null,
    errorType: bounded(detail.type || 'provider_http_error', 80),
    error: bounded(detail.message || raw || 'Anthropic request failed', 300)
  };
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
    var response;
    try {
      response = await fetchFn('https://api.anthropic.com/v1/messages', {
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
    } catch (e) {
      var transport = {
        ok: false,
        provider: 'anthropic',
        model: MODEL,
        httpStatus: null,
        errorType: 'transport_error',
        error: bounded(e && e.message || e || 'Anthropic transport failed', 300)
      };
      console.error('[finance-preview-provider] Anthropic transport failed', {
        errorType: transport.errorType,
        error: transport.error
      });
      return transport;
    }
    if (!response || !response.ok) {
      var raw = response && response.text ? await response.text() : '';
      var rejected = rejectionDetail(response, raw);
      console.error('[finance-preview-provider] Anthropic request rejected', rejected);
      return {
        ok: false,
        provider: 'anthropic',
        model: MODEL,
        httpStatus: rejected.httpStatus,
        errorType: rejected.errorType,
        error: rejected.error
      };
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
