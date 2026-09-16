'use strict';

var assert = require('node:assert/strict');

process.env.ADMIN_MASTER = 'test-admin';
process.env.ANTHROPIC_API_KEY = 'test-provider-key';

var Agent = require('../handlers/domain-agent.js');

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader: function (key, value) { this.headers[key] = value; },
    end: function (body) { this.body = body; this.json = JSON.parse(body); }
  };
}

(async function () {
  var captured = null;
  var builds = 0;
  var handler = Agent.createHandler({
    bumpRate: async function () { return { ok: true, n: 1 }; },
    buildBriefing: async function (domain, options) {
      builds++;
      assert.equal(domain, 'culture');
      assert.equal(options.clientModels[0].domain, 'culture');
      return {
        ok: true,
        packet: {
          schemaVersion: 'domain-governor-briefing/1.0',
          packetId: 'dgb_test',
          sourcePacketId: 'civilization_test',
          generatedAt: new Date().toISOString(),
          readiness: { canReason: true, blockers: [] },
          afferentState: { serverObservation: { stress: 0.2 }, clientProjection: { stress: 0.99, role: 'display-advisory-only' } },
          governorPosture: {
            state: 'surprised',
            source: 'same-domain-brain-control-state',
            modulation: { tone: 'curious-qualified', exploration: 'elevated' },
            authority: { role: 'presentation-and-deliberation-modulation-only', mayNotChange: ['facts', 'authority', 'motor-selection'] }
          },
          commercialReflex: {
            status: 'OBSERVED', role: 'same-domain-stress-to-business-work-order', selectsExternalEffect: false,
            state: { productDomain: 'culture', status: 'PLANNED', workOrder: { selectedProgram: 'SHORT_VIDEO', renderContract: { status: 'EVIDENCE_FETCH_REQUIRED' } } },
            latestArtifact: { artifactId: 'dca_culture_1', status: 'ARTIFACT_PREPARED', externalEffectAuthorized: false }
          },
          truthPolicy: { modelNarrativeCannotGrantAuthority: true }
        }
      };
    },
    callModel: async function (system, prompt) {
      captured = { system: system, prompt: prompt };
      return { ok: true, text: JSON.stringify({ answer: 'Grounded.', toolCalls: [] }) };
    }
  });
  var req = {
    method: 'POST',
    body: { domain: 'culture', passcode: 'test-admin', prompt: 'What should this domain attend to?', state: { label: 'Culture', stress: 0.99 } }
  };
  var res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.grounding.packetId, 'dgb_test');
  assert.equal(builds, 1);
  assert.match(captured.system, /SERVER-BUILT CULTURE GOVERNOR PACKET/);
  assert.match(captured.system, /not a master brain/);
  assert.match(captured.system, /state-dependent demeanor/);
  assert.match(captured.system, /same-domain-brain-control-state/);
  assert.match(captured.system, /must never change facts, provenance, confidence/);
  assert.match(captured.system, /Do not roleplay emotions/);
  assert.match(captured.system, /CannotGrantAuthority/);
  assert.match(captured.system, /same-domain-stress-to-business-work-order/);
  assert.match(captured.system, /SHORT_VIDEO/);
  assert.match(captured.system, /headline alone/);
  assert.doesNotMatch(captured.system, /you have no external market or macro feed/i);

  var failed = Agent.createHandler({
    bumpRate: async function () { return { ok: true, n: 1 }; },
    buildBriefing: async function () { return { ok: false, reason: 'domain-grounding-incomplete' }; },
    callModel: async function () { throw new Error('model must not run without grounding'); }
  });
  res = response();
  await failed(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.json.reason, 'domain-grounding-incomplete');

  var staleModelCalls = 0;
  var staleHandler = Agent.createHandler({
    bumpRate: async function () { return { ok: true, n: 1 }; },
    buildBriefing: async function () {
      return {
        ok: true,
        packet: {
          schemaVersion: 'domain-governor-briefing/1.0',
          packetId: 'dgb_stale',
          sourcePacketId: 'civilization_stale',
          generatedAt: new Date().toISOString(),
          readiness: { canReason: false, blockers: ['domain-cognition-stale'] }
        }
      };
    },
    callModel: async function () {
      staleModelCalls++;
      return {
        ok: true,
        text: JSON.stringify({
          answer: 'Cognition is stale; abstaining.',
          toolCalls: [{ type: 'config', autonomy: true }, { type: 'steer', stressBias: 0.3 }]
        })
      };
    }
  });
  res = response();
  await staleHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(staleModelCalls, 1);
  assert.equal(res.json.grounding.canReason, false);
  assert.deepEqual(res.json.toolCalls, []);

  console.log('domain agent grounding: server packet required before model, client state advisory, no model on failed grounding, and stale-cognition tool suppression passed');
})().catch(function (error) { console.error(error); process.exit(1); });
