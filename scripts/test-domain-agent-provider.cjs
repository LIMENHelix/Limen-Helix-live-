'use strict';

var assert = require('node:assert/strict');
var Provider = require('../lib/domain-agent-provider.js');

(async function () {
  var resolved = Provider.resolve({
    DOMAIN_AGENT_PROVIDER: 'auto',
    HF_TOKEN: 'secret-token',
    DOMAIN_AGENT_HF_MODEL: 'org/small-governor-model',
    ANTHROPIC_API_KEY: 'anthropic-fallback-must-not-win'
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.name, 'huggingface');
  assert.equal(resolved.route, 'hf-auto');

  var missing = Provider.resolve({ DOMAIN_AGENT_PROVIDER: 'hf', HF_TOKEN: 'secret-token' });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /DOMAIN_AGENT_HF_MODEL/);

  var calls = [];
  var settled = [];
  var result = await Provider.callHuggingFace({
    env: {
      HF_TOKEN: 'secret-token',
      DOMAIN_AGENT_HF_MODEL: 'org/small-governor-model',
      DOMAIN_AGENT_HF_BILL_TO: 'LIMEN-Helix',
      DOMAIN_AGENT_MAX_TOKENS: '256'
    },
    config: { ok: true, name: 'huggingface', model: 'org/small-governor-model', route: 'hf-explicit' },
    system: 'SERVER-BUILT ENERGY GOVERNOR PACKET',
    user: 'What changed?',
    killSwitch: { spendDisabled: async function () { return false; } },
    meter: {
      reserve: async function (record) {
        assert.equal(record.kind, 'ai');
        assert.equal(record.model, 'org/small-governor-model');
        return { ok: true, id: 'rsv-test' };
      },
      settle: async function (id, usage) { settled.push({ id: id, usage: usage }); return { ok: true }; }
    },
    fetchImpl: async function (url, options) {
      calls.push({ url: url, options: options });
      return {
        status: 200,
        json: async function () {
          return {
            choices: [{ message: { content: '{"answer":"Grounded.","toolCalls":[]}' } }],
            usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 }
          };
        }
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, 'huggingface');
  assert.equal(result.model, 'org/small-governor-model');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, Provider.HF_ENDPOINT);
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-token');
  assert.equal(calls[0].options.headers['X-HF-Bill-To'], 'LIMEN-Helix');
  var body = JSON.parse(calls[0].options.body);
  assert.equal(body.messages[0].role, 'system');
  assert.match(body.messages[0].content, /ENERGY GOVERNOR PACKET/);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(settled.length, 1);
  assert.equal(settled[0].usage.inputTokens, 20);
  assert.equal(JSON.stringify(result).includes('secret-token'), false);

  var blockedFetches = 0;
  var blocked = await Provider.callHuggingFace({
    env: { HF_TOKEN: 'secret-token', DOMAIN_AGENT_HF_MODEL: 'org/model' },
    config: { ok: true, name: 'huggingface', model: 'org/model', route: 'hf-explicit' },
    system: 'packet', user: 'question',
    killSwitch: { spendDisabled: async function () { return true; } },
    meter: { reserve: async function () { throw new Error('must not reserve'); }, settle: async function () {} },
    fetchImpl: async function () { blockedFetches++; }
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.disabled, true);
  assert.equal(blockedFetches, 0);

  console.log('domain agent provider: explicit HF selection, server packet transport, spend gate, metering, billing scope, and secret hygiene passed');
})().catch(function (error) { console.error(error); process.exit(1); });
