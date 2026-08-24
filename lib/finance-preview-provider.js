'use strict';

/* Narrow paid-provider boundary for an operator-authenticated Finance Preview. */

var MODEL = 'claude-sonnet-4-6';
var MAX_OUTPUT_TOKENS = 3000;

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
        messages: [{ role: 'user', content: input.prompt }]
      })
    });
    if (!response || !response.ok) {
      var detail = response && response.text ? await response.text() : '';
      return { ok: false, provider: 'anthropic', model: MODEL,
        error: 'anthropic HTTP ' + (response && response.status) + ': ' + String(detail).slice(0, 300) };
    }
    var body = await response.json();
    var text = body && body.content && body.content[0] ? body.content[0].text : '';
    return {
      ok: true,
      provider: 'anthropic',
      model: MODEL,
      text: typeof text === 'string' ? text : '',
      tokensIn: body && body.usage ? body.usage.input_tokens || 0 : 0,
      tokensOut: body && body.usage ? body.usage.output_tokens || 0 : 0
    };
  };
}

module.exports = { MODEL: MODEL, MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS, enabled: enabled, create: create };
