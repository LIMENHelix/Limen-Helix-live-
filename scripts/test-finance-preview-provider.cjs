#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Provider = require('../lib/finance-preview-provider.js');

(async function () {
  assert.equal(Provider.enabled({ LIMEN_FINANCE_PREVIEW_ENABLED: '0' }), false);
  assert.equal(Provider.enabled({ LIMEN_FINANCE_PREVIEW_ENABLED: '1' }), true);

  let network = 0;
  const off = Provider.create({ env: {}, fetch: async () => { network++; } });
  assert.equal((await off({})).disabled, true);
  assert.equal(network, 0);

  const missing = Provider.create({ env: { LIMEN_FINANCE_PREVIEW_ENABLED: '1' }, fetch: async () => { network++; } });
  assert.equal((await missing({})).disabled, true);
  assert.equal(network, 0);

  let sent;
  const provider = Provider.create({
    env: { LIMEN_FINANCE_PREVIEW_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async (url, options) => {
      network++;
      sent = { url, options, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ content: [{ text: '{"paperOnly":true}' }], stop_reason: 'end_turn', usage: { input_tokens: 12, output_tokens: 7 } }) };
    }
  });
  const result = await provider({ system: 'system', prompt: 'prompt', maxTokens: 99999 });
  assert.equal(network, 1);
  assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(sent.body.model, Provider.MODEL);
  assert.equal(sent.body.max_tokens, Provider.MAX_OUTPUT_TOKENS);
  assert.equal(sent.body.output_config.format.type, 'json_schema');
  assert.deepEqual(sent.body.output_config.format.schema, Provider.OUTPUT_SCHEMA);
  assert.equal(sent.body.output_config.format.schema.additionalProperties, false);
  assert.equal(sent.body.output_config.format.schema.properties.horizonDays.enum.join(','), '30,60,90');
  assert.equal(sent.body.output_config.format.schema.properties.paperOnly.const, true);
  assert.equal(sent.options.headers['x-api-key'], 'test-only');
  assert.equal(result.ok, true);
  assert.equal(result.text, '{"paperOnly":true}');
  assert.equal(result.tokensIn, 12);
  assert.equal(result.tokensOut, 7);
  assert.equal(result.stopReason, 'end_turn');
  await assert.rejects(() => provider({ system: 'again', prompt: 'again' }), /one-shot/);
  assert.equal(network, 1);

  const truncated = Provider.create({
    env: { LIMEN_FINANCE_PREVIEW_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async () => ({ ok: true, json: async () => ({ content: [{ text: '{' }], stop_reason: 'max_tokens', usage: { input_tokens: 5, output_tokens: 3 } }) })
  });
  const truncatedResult = await truncated({ system: 'system', prompt: 'prompt' });
  assert.equal(truncatedResult.ok, false);
  assert.equal(truncatedResult.stopReason, 'max_tokens');
  assert.equal(truncatedResult.tokensOut, 3);

  const refused = Provider.create({
    env: { LIMEN_FINANCE_PREVIEW_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async () => ({ ok: true, json: async () => ({ content: [{ text: 'cannot comply' }], stop_reason: 'refusal', usage: {} }) })
  });
  const refusedResult = await refused({ system: 'system', prompt: 'prompt' });
  assert.equal(refusedResult.ok, false);
  assert.equal(refusedResult.stopReason, 'refusal');

  console.log('finance preview provider: structured JSON, one-shot, refusal, and truncation guards passed');
}()).catch(e => { console.error(e); process.exitCode = 1; });
