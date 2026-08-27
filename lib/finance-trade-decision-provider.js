'use strict';

/* Narrow paid-provider boundary for one admitted Finance paper candidate. */

var MODEL = 'claude-sonnet-4-6';
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

function bounded(value, limit) {
  var out = typeof value === 'string' ? value : String(value == null ? '' : value);
  return out.slice(0, limit || 300);
}

function rejectionDetail(response, raw) {
  var parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
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
    if (!enabled(env)) return { ok: false, disabled: true, error: 'Finance trade-decision provider switch is off' };
    if (!env.ANTHROPIC_API_KEY) return { ok: false, disabled: true, error: 'ANTHROPIC_API_KEY is not configured' };
    calls++;
    if (calls > 1) throw new Error('Finance trade-decision provider is one-shot');
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
      return {
        ok: false,
        provider: 'anthropic',
        model: MODEL,
        httpStatus: null,
        errorType: 'transport_error',
        error: bounded(e && e.message || e || 'Anthropic transport failed', 300),
        structuredOutput: true
      };
    }
    if (!response || !response.ok) {
      var raw = response && response.text ? await response.text() : '';
      var rejected = rejectionDetail(response, raw);
      return {
        ok: false,
        provider: 'anthropic',
        model: MODEL,
        httpStatus: rejected.httpStatus,
        errorType: rejected.errorType,
        error: rejected.error,
        structuredOutput: true
      };
    }
    var body = await response.json();
    var stopReason = body && body.stop_reason || null;
    if (stopReason !== 'end_turn') {
      return {
        ok: false,
        provider: 'anthropic',
        model: MODEL,
        stopReason: stopReason,
        errorType: stopReason === 'max_tokens' || stopReason === 'model_context_window_exceeded'
          ? 'structured_output_truncated'
          : stopReason === 'refusal' ? 'structured_output_refused' : 'structured_output_incomplete',
        error: 'Anthropic structured output did not complete with end_turn',
        structuredOutput: true,
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
      structuredOutput: true,
      tokensIn: body && body.usage ? body.usage.input_tokens || 0 : 0,
      tokensOut: body && body.usage ? body.usage.output_tokens || 0 : 0
    };
  };
}

module.exports = {
  MODEL: MODEL,
  MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
  FACTOR_NAMES: FACTOR_NAMES,
  OUTPUT_SCHEMA: OUTPUT_SCHEMA,
  enabled: enabled,
  create: create
};
