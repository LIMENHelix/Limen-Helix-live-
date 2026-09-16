'use strict';

/**
 * Provider adapter for the domain-bound Governor language faculty.
 *
 * There is one stateless inference surface, not one resident model per domain.
 * The caller supplies a server-built packet for exactly one owning brain. Provider
 * selection cannot change that identity, grant authority, or bypass the spend gate.
 *
 * Selection is explicit:
 *   DOMAIN_AGENT_PROVIDER=hf          -> Hugging Face only
 *   DOMAIN_AGENT_PROVIDER=anthropic   -> Anthropic only
 *   DOMAIN_AGENT_PROVIDER=auto        -> HF only when both HF_TOKEN and an explicit
 *                                        DOMAIN_AGENT_HF_MODEL exist; otherwise Anthropic
 *
 * HF intentionally has no hard-coded model. Changing a model is a commissioning
 * decision because quality, structured-output support, and price vary by provider.
 * The token must include Hugging Face's `Inference Providers` permission; repository
 * read access alone is insufficient.
 */
var anthropicCall = require('./anthropic-call');
var killSwitch = require('./ai-kill-switch');
var meter = require('./spend-meter');

var HF_ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
var DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function boundedInt(value, fallback, min, max) {
  var n = parseInt(value, 10);
  if (!isFinite(n)) n = fallback;
  return Math.max(min, Math.min(max, n));
}

function resolve(env) {
  env = env || process.env;
  var requested = text(env.DOMAIN_AGENT_PROVIDER || 'auto').toLowerCase();
  var hfToken = text(env.HF_TOKEN || env.HUGGING_FACE_HUB_TOKEN);
  var hfModel = text(env.DOMAIN_AGENT_HF_MODEL);
  var anthropicKey = text(env.ANTHROPIC_API_KEY);
  var hfReady = !!(hfToken && hfModel);
  var anthropicReady = !!anthropicKey;

  if (requested === 'hf' || requested === 'huggingface' || requested === 'hugging-face') {
    return hfReady
      ? { ok: true, name: 'huggingface', model: hfModel, route: 'hf-explicit' }
      : { ok: false, requested: 'huggingface', reason: !hfToken ? 'HF_TOKEN is unset.' : 'DOMAIN_AGENT_HF_MODEL is unset.' };
  }
  if (requested === 'anthropic') {
    return anthropicReady
      ? { ok: true, name: 'anthropic', model: text(env.DOMAIN_AGENT_MODEL) || DEFAULT_ANTHROPIC_MODEL, route: 'anthropic-explicit' }
      : { ok: false, requested: 'anthropic', reason: 'ANTHROPIC_API_KEY is unset.' };
  }
  if (requested !== 'auto') {
    return { ok: false, requested: requested, reason: 'Unsupported DOMAIN_AGENT_PROVIDER. Use auto, hf, or anthropic.' };
  }
  if (hfReady) return { ok: true, name: 'huggingface', model: hfModel, route: 'hf-auto' };
  if (anthropicReady) return { ok: true, name: 'anthropic', model: text(env.DOMAIN_AGENT_MODEL) || DEFAULT_ANTHROPIC_MODEL, route: 'anthropic-auto' };
  return { ok: false, requested: 'auto', reason: 'No commissioned domain-agent provider is configured.' };
}

function estimatedInputTokens(system, user) {
  return Math.ceil((String(system || '').length + String(user || '').length) / 4);
}

async function callHuggingFace(options) {
  options = options || {};
  var env = options.env || process.env;
  var config = options.config || resolve(env);
  var fetchImpl = options.fetchImpl || fetch;
  var spendGate = options.killSwitch || killSwitch;
  var spendMeter = options.meter || meter;
  var maxTokens = boundedInt(env.DOMAIN_AGENT_MAX_TOKENS, 768, 64, 2048);

  if (!config.ok || config.name !== 'huggingface') {
    return { ok: false, refused: true, detail: config.reason || 'Hugging Face is not selected.' };
  }
  try {
    if (await spendGate.spendDisabled()) {
      return { ok: false, refused: true, disabled: true, detail: 'AI spend is disabled or paused by the operator.' };
    }
  } catch (error) {
    return { ok: false, refused: true, disabled: true, detail: 'Could not read the AI spend gate; refusing to call Hugging Face.' };
  }

  var reservation = await spendMeter.reserve({
    kind: 'ai',
    model: config.model,
    inputTokens: estimatedInputTokens(options.system, options.user),
    outputTokens: maxTokens,
    label: 'domain-agent:huggingface'
  });
  if (!reservation.ok) return { ok: false, refused: true, detail: reservation.reason, budget: reservation };

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, boundedInt(env.DOMAIN_AGENT_TIMEOUT_MS, 45000, 1000, 120000));
  var json = null;
  var status = 0;
  var transportError = null;
  try {
    var headers = {
      'content-type': 'application/json',
      authorization: 'Bearer ' + text(env.HF_TOKEN || env.HUGGING_FACE_HUB_TOKEN)
    };
    var billTo = text(env.DOMAIN_AGENT_HF_BILL_TO);
    if (billTo) headers['X-HF-Bill-To'] = billTo;
    var response = await fetchImpl(HF_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: String(options.system || '') },
          { role: 'user', content: String(options.user || '') }
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    status = response.status;
    json = await response.json().catch(function () { return null; });
  } catch (error) {
    transportError = String(error && error.message || error || 'Hugging Face transport failed');
  } finally {
    clearTimeout(timer);
  }

  var usage = json && json.usage;
  await spendMeter.settle(reservation.id, usage ? {
    model: config.model,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0
  } : { costUsd: 0 });

  if (transportError) return { ok: false, provider: 'huggingface', model: config.model, detail: transportError };
  if (status < 200 || status >= 300) {
    return { ok: false, provider: 'huggingface', model: config.model, status: status, detail: 'Hugging Face returned HTTP ' + status + '.' };
  }
  var choice = json && Array.isArray(json.choices) ? json.choices[0] : null;
  var content = choice && choice.message && choice.message.content;
  if (!text(content)) return { ok: false, provider: 'huggingface', model: config.model, status: status, detail: 'Hugging Face returned no message content.' };
  return { ok: true, provider: 'huggingface', model: config.model, route: config.route, text: String(content), usage: usage || null };
}

async function call(options) {
  options = options || {};
  var env = options.env || process.env;
  var config = resolve(env);
  if (!config.ok) return { ok: false, refused: true, detail: config.reason, provider: config.requested || null };
  if (config.name === 'huggingface') return callHuggingFace(Object.assign({}, options, { config: config }));

  var maxTokens = boundedInt(env.DOMAIN_AGENT_MAX_TOKENS, 1024, 64, 2048);
  var result = await anthropicCall.callAnthropic({
    apiKey: text(env.ANTHROPIC_API_KEY),
    label: 'domain-agent:anthropic',
    timeoutMs: boundedInt(env.DOMAIN_AGENT_TIMEOUT_MS, 45000, 1000, 120000),
    body: {
      model: config.model,
      max_tokens: maxTokens,
      output_config: { effort: 'low' },
      system: String(options.system || ''),
      messages: [{ role: 'user', content: String(options.user || '') }]
    }
  });
  return Object.assign({}, result, { provider: 'anthropic', model: config.model, route: config.route });
}

module.exports = {
  call: call,
  callHuggingFace: callHuggingFace,
  resolve: resolve,
  estimatedInputTokens: estimatedInputTokens,
  HF_ENDPOINT: HF_ENDPOINT,
  DEFAULT_ANTHROPIC_MODEL: DEFAULT_ANTHROPIC_MODEL
};
