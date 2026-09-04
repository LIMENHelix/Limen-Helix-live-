#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Provider = require('../lib/finance-position-owner-provider.js');

(async function () {
  assert.equal(Provider.enabled({ LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1' }), true);
  assert.equal(Provider.configured({ GROK_API_KEY: 'fixture' }), true);
  assert.deepEqual(Provider.OUTPUT_SCHEMA.properties.action.enum, ['HOLD', 'SELL', 'COVER']);
  assert.deepEqual(Provider.OUTPUT_SCHEMA.properties.factorAssessment.required, Provider.FACTOR_NAMES);
  assert.equal(Provider.OUTPUT_SCHEMA.properties.schemaVersion.const, 'finance-position-owner-proposal/1.0');

  const requests = [];
  const provider = Provider.create({
    env: {
      LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1',
      ANTHROPIC_API_KEY: 'anthropic-fixture',
      GROK_API_KEY: 'grok-fixture'
    },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url.includes('anthropic.com')) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'grok-4',
          choices: [{ finish_reason: 'stop', message: { content: '{"action":"HOLD"}', refusal: null } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        })
      };
    }
  });
  const result = await provider({ system: 'system', prompt: 'prompt' });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.response_format.json_schema.name, 'finance_position_owner_proposal');
  assert.deepEqual(requests[1].body.response_format.json_schema.schema, Provider.OUTPUT_SCHEMA);
  assert.equal(result.ok, true);
  assert.equal(result.providerRoute, 'xai-fallback');
  assert.equal(result.providerAttempts, 2);
  await assert.rejects(() => provider({ system: 'again', prompt: 'again' }), /one-shot/);

  console.log('finance position owner provider: owner-specific schema, bounded fallback, and one-shot routing passed');
}()).catch(error => { console.error(error); process.exitCode = 1; });
