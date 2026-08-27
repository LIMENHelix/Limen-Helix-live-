#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Provider = require('../lib/finance-trade-decision-provider.js');

(async function () {
  assert.equal(Provider.enabled({ LIMEN_FINANCE_TRADE_DECISION_ENABLED: '0' }), false);
  assert.equal(Provider.enabled({ LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1' }), true);

  let network = 0;
  const off = Provider.create({ env: {}, fetch: async () => { network++; } });
  assert.equal((await off({})).disabled, true);
  assert.equal(network, 0);

  let sent;
  const provider = Provider.create({
    env: { LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async (url, options) => {
      network++;
      sent = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          content: [{ text: '{"action":"ABSTAIN"}' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 12, output_tokens: 7 }
        })
      };
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
  assert.deepEqual(sent.body.output_config.format.schema.properties.action.enum, ['BUY', 'SELL', 'SHORT', 'COVER', 'ABSTAIN']);
  assert.deepEqual(sent.body.output_config.format.schema.properties.factorAssessment.required, Provider.FACTOR_NAMES);
  assert.equal(JSON.stringify(sent.body.output_config.format.schema).includes('minLength'), false);
  assert.equal(sent.options.headers['x-api-key'], 'test-only');
  assert.equal(result.ok, true);
  assert.equal(result.structuredOutput, true);
  assert.equal(result.stopReason, 'end_turn');
  assert.equal(result.tokensOut, 7);
  await assert.rejects(() => provider({ system: 'again', prompt: 'again' }), /one-shot/);
  assert.equal(network, 1);

  const truncated = Provider.create({
    env: { LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async () => ({
      ok: true,
      json: async () => ({ content: [{ text: '{' }], stop_reason: 'max_tokens', usage: { input_tokens: 5, output_tokens: 3000 } })
    })
  });
  const truncatedResult = await truncated({ system: 'system', prompt: 'prompt' });
  assert.equal(truncatedResult.ok, false);
  assert.equal(truncatedResult.errorType, 'structured_output_truncated');
  assert.equal(truncatedResult.stopReason, 'max_tokens');
  assert.equal(truncatedResult.tokensOut, 3000);

  const refused = Provider.create({
    env: { LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async () => ({ ok: true, json: async () => ({ content: [], stop_reason: 'refusal', usage: {} }) })
  });
  const refusedResult = await refused({ system: 'system', prompt: 'prompt' });
  assert.equal(refusedResult.ok, false);
  assert.equal(refusedResult.errorType, 'structured_output_refused');

  const rejected = Provider.create({
    env: { LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { type: 'invalid_request_error', message: 'Unsupported schema' } })
    })
  });
  const rejectedResult = await rejected({ system: 'system', prompt: 'prompt' });
  assert.equal(rejectedResult.ok, false);
  assert.equal(rejectedResult.httpStatus, 400);
  assert.equal(rejectedResult.errorType, 'invalid_request_error');
  assert.equal(rejectedResult.error, 'Unsupported schema');

  const transportFailed = Provider.create({
    env: { LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1', ANTHROPIC_API_KEY: 'test-only' },
    fetch: async () => { throw new Error('connection reset'); }
  });
  const transportResult = await transportFailed({ system: 'system', prompt: 'prompt' });
  assert.equal(transportResult.ok, false);
  assert.equal(transportResult.errorType, 'transport_error');

  console.log('finance trade decision provider: structured JSON, one-shot, truncation, refusal, and diagnostics passed');
}()).catch(e => { console.error(e); process.exitCode = 1; });
