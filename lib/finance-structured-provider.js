'use strict';

/**
 * Provider-independent structured-output transport for Finance cognition.
 *
 * One logical Finance decision may use Anthropic once and, only when that
 * provider is unavailable, xAI once. This module never interprets a proposal
 * and has no access to broker execution. Deterministic Finance policy remains
 * downstream of this boundary.
 */

var ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
var XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
var ANTHROPIC_MODEL = 'claude-sonnet-4-6';
var DEFAULT_XAI_MODEL = 'grok-4';

function bounded(value, limit) {
  var out = typeof value === 'string' ? value : String(value == null ? '' : value);
  return out.slice(0, limit || 300);
}

function xaiKey(env) {
  env = env || process.env;
  return env.GROK_API_KEY || env.XAI_API_KEY || '';
}

function xaiModel(env) {
  env = env || process.env;
  return env.LIMEN_FINANCE_GROK_MODEL || env.GROK_MODEL || DEFAULT_XAI_MODEL;
}

function configured(env) {
  env = env || process.env;
  return !!(env.ANTHROPIC_API_KEY || xaiKey(env));
}

function readiness(env) {
  env = env || process.env;
  return {
    configured: configured(env),
    anthropicConfigured: !!env.ANTHROPIC_API_KEY,
    xaiConfigured: !!xaiKey(env),
    xaiModel: xaiModel(env)
  };
}

function rejectionDetail(provider, response, raw) {
  var parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
  var detail = parsed && parsed.error || {};
  return {
    ok: false,
    provider: provider,
    httpStatus: response && Number.isFinite(Number(response.status)) ? Number(response.status) : null,
    errorType: bounded(detail.type || detail.code || 'provider_http_error', 80),
    error: bounded(detail.message || raw || provider + ' request failed', 300),
    structuredOutput: true
  };
}

function fallbackReason(result) {
  if (!result || result.ok === true || result.provider !== 'anthropic') return null;
  // An HTTP 200 with an invalid body may already have incurred generation
  // cost, so do not make a second paid attempt for that ambiguous case.
  if (result.errorType === 'transport_error') return 'anthropic_transport_unavailable';
  var status = Number(result.httpStatus);
  if (status === 402) return 'anthropic_payment_required';
  if (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500) return 'anthropic_temporarily_unavailable';
  if (status === 400 && /(credit balance|credits? (?:is|are )?too low|insufficient (?:credit|funds)|billing)/i.test(result.error || '')) {
    return 'anthropic_credit_unavailable';
  }
  return null;
}

function primaryFailure(result, reason) {
  return {
    provider: 'anthropic',
    reason: reason,
    httpStatus: result && Number.isFinite(Number(result.httpStatus)) ? Number(result.httpStatus) : null,
    errorType: bounded(result && result.errorType, 80)
  };
}

async function callAnthropic(options, input, maxTokens) {
  var response;
  try {
    response = await options.fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': options.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.anthropicModel,
        max_tokens: maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
        output_config: { format: { type: 'json_schema', schema: options.schema } }
      })
    });
  } catch (error) {
    return {
      ok: false,
      provider: 'anthropic',
      model: options.anthropicModel,
      httpStatus: null,
      errorType: 'transport_error',
      error: bounded(error && error.message || error || 'Anthropic transport failed', 300),
      structuredOutput: true
    };
  }
  if (!response || !response.ok) {
    var raw = response && response.text ? await response.text() : '';
    return Object.assign(rejectionDetail('anthropic', response, raw), { model: options.anthropicModel });
  }
  var body;
  try { body = await response.json(); }
  catch (error) {
    return {
      ok: false, provider: 'anthropic', model: options.anthropicModel,
      httpStatus: Number(response.status) || null, errorType: 'invalid_response',
      error: bounded(error && error.message || 'Anthropic returned invalid JSON', 300), structuredOutput: true
    };
  }
  var stopReason = body && body.stop_reason || null;
  if (stopReason !== 'end_turn') {
    return {
      ok: false,
      provider: 'anthropic',
      model: options.anthropicModel,
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
    model: body && body.model || options.anthropicModel,
    text: typeof text === 'string' ? text : '',
    stopReason: stopReason,
    structuredOutput: true,
    tokensIn: body && body.usage ? body.usage.input_tokens || 0 : 0,
    tokensOut: body && body.usage ? body.usage.output_tokens || 0 : 0
  };
}

async function callXai(options, input, maxTokens) {
  var model = xaiModel(options.env);
  var response;
  try {
    response = await options.fetch(XAI_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer ' + xaiKey(options.env)
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.prompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: options.schemaName, schema: options.schema, strict: true }
        }
      })
    });
  } catch (error) {
    return {
      ok: false, provider: 'xai', model: model, httpStatus: null,
      errorType: 'transport_error', error: bounded(error && error.message || error || 'xAI transport failed', 300),
      structuredOutput: true
    };
  }
  if (!response || !response.ok) {
    var raw = response && response.text ? await response.text() : '';
    return Object.assign(rejectionDetail('xai', response, raw), { model: model });
  }
  var body;
  try { body = await response.json(); }
  catch (error) {
    return {
      ok: false, provider: 'xai', model: model, httpStatus: Number(response.status) || null,
      errorType: 'invalid_response', error: bounded(error && error.message || 'xAI returned invalid JSON', 300),
      structuredOutput: true
    };
  }
  var choice = body && body.choices && body.choices[0] || null;
  var message = choice && choice.message || null;
  var finishReason = choice && choice.finish_reason || null;
  var refusal = message && message.refusal;
  if (refusal || finishReason !== 'stop') {
    var stopReason = refusal ? 'refusal' : finishReason === 'length' ? 'max_tokens' : finishReason;
    return {
      ok: false,
      provider: 'xai',
      model: body && body.model || model,
      stopReason: stopReason,
      errorType: refusal ? 'structured_output_refused'
        : finishReason === 'length' ? 'structured_output_truncated' : 'structured_output_incomplete',
      error: refusal ? 'xAI refused the structured output request' : 'xAI structured output did not complete with stop',
      structuredOutput: true,
      tokensIn: body && body.usage ? body.usage.prompt_tokens || 0 : 0,
      tokensOut: body && body.usage ? body.usage.completion_tokens || 0 : 0
    };
  }
  return {
    ok: true,
    provider: 'xai',
    model: body && body.model || model,
    text: message && typeof message.content === 'string' ? message.content : '',
    stopReason: finishReason,
    structuredOutput: true,
    tokensIn: body && body.usage ? body.usage.prompt_tokens || 0 : 0,
    tokensOut: body && body.usage ? body.usage.completion_tokens || 0 : 0
  };
}

function route(options) {
  options = options || {};
  var env = options.env || process.env;
  var fetchFn = options.fetch || global.fetch;
  var calls = 0;
  var config = {
    env: env,
    fetch: fetchFn,
    schema: options.schema,
    schemaName: options.schemaName,
    anthropicModel: options.anthropicModel || ANTHROPIC_MODEL
  };
  return async function provider(input) {
    calls++;
    if (calls > 1) throw new Error((options.label || 'Finance structured provider') + ' is one-shot');
    var requested = Number(input && input.maxTokens);
    var maxTokens = Number.isFinite(requested)
      ? Math.min(options.maxOutputTokens, Math.max(1, Math.floor(requested)))
      : options.maxOutputTokens;
    if (!env.ANTHROPIC_API_KEY && !xaiKey(env)) {
      return { ok: false, disabled: true, error: 'No Finance AI provider is configured', providerAttempts: 0, structuredOutput: true };
    }
    if (!env.ANTHROPIC_API_KEY) {
      return Object.assign(await callXai(config, input, maxTokens), {
        providerRoute: 'xai-direct', providerAttempts: 1, fallback: null
      });
    }
    var primary = await callAnthropic(config, input, maxTokens);
    if (primary.ok) {
      return Object.assign(primary, { providerRoute: 'anthropic-primary', providerAttempts: 1, fallback: null });
    }
    var reason = fallbackReason(primary);
    if (!reason || !xaiKey(env)) {
      return Object.assign(primary, { providerRoute: 'anthropic-primary', providerAttempts: 1, fallback: null });
    }
    var alternate = await callXai(config, input, maxTokens);
    return Object.assign(alternate, {
      providerRoute: 'xai-fallback',
      providerAttempts: 2,
      fallback: { used: true, primaryFailure: primaryFailure(primary, reason) }
    });
  };
}

module.exports = {
  ANTHROPIC_ENDPOINT: ANTHROPIC_ENDPOINT,
  XAI_ENDPOINT: XAI_ENDPOINT,
  ANTHROPIC_MODEL: ANTHROPIC_MODEL,
  DEFAULT_XAI_MODEL: DEFAULT_XAI_MODEL,
  xaiKey: xaiKey,
  xaiModel: xaiModel,
  configured: configured,
  readiness: readiness,
  fallbackReason: fallbackReason,
  route: route
};
