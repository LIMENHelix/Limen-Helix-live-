'use strict';

var assert = require('node:assert/strict');
var Governor = require('../lib/domain-governor-briefing.js');

function civilization(domain, now, overrides) {
  var row = {
    domain: domain,
    serverObservation: { present: true, stress: 0.2, observedAt: new Date(now).toISOString() },
    cognition: {
      present: true, observedAt: new Date(now).toISOString(), stale: false,
      packetId: 'packet-' + domain, feedHealth: { configured: 2, live: 2 },
      semanticEvidence: { status: 'OBSERVED', headlines: [] }
    },
    investmentNewsReview: { status: 'NOT_APPLICABLE' },
    phaseContext: { thing2Role: 'contextual masking comparison only', decisionAuthority: false },
    opportunities: [],
    clientProjection: { present: true, stress: 0.99, role: 'display-advisory-only' }
  };
  Object.assign(row, overrides || {});
  return {
    packetId: 'civilization-' + now,
    authority: { observes: true, selectsAction: false },
    readErrors: [],
    domains: [row]
  };
}

(async function () {
  var now = Date.now();
  var ready = await Governor.build('culture', {
    now: now,
    briefingBuilder: async function () { return civilization('culture', now); },
    env: {}
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.packet.domainId, 'culture');
  assert.equal(ready.packet.structuralBrain.file, 'assets/js/domain-brains/culture-brain.js');
  assert.equal(ready.packet.structuralBrain.coreComplete, true);
  assert.equal(ready.packet.p0p10.phases.length, 11);
  assert(ready.packet.p0p10.phases.some(function (phase) { return phase.earned; }));
  assert.equal(ready.packet.operationalLoop.sourceChainComplete, true);
  assert(ready.packet.operationalLoop.codePaths.executor.includes('handlers/hero-image.js'));
  assert.equal(ready.packet.afferentState.clientProjection.role, 'display-advisory-only');
  assert.equal(ready.packet.truthPolicy.clientProjectionAdvisoryOnly, true);
  assert.equal(ready.packet.truthPolicy.paperEvidenceIsNotProductionCapability, true);
  assert.equal(ready.packet.readiness.canReason, true);
  assert.equal(ready.packet.readiness.canDispatchExternal, false);
  assert.match(ready.packet.readiness.dispatchAuthority, /B10-B14/);
  assert.equal(ready.packet.motorRuntime.status, 'UNOBSERVED');

  var missing = await Governor.build('culture', {
    now: now,
    briefingBuilder: async function () {
      return civilization('culture', now, {
        cognition: { present: false, observedAt: null, stale: true },
        serverObservation: { present: false }
      });
    },
    env: {}
  });
  assert.equal(missing.ok, true);
  assert.equal(missing.packet.readiness.canReason, false);
  assert(missing.packet.readiness.blockers.includes('domain-cognition-absent'));
  assert(missing.packet.readiness.blockers.includes('domain-server-observation-absent'));

  var stale = await Governor.build('culture', {
    now: now,
    briefingBuilder: async function () {
      return civilization('culture', now, {
        cognition: { present: true, observedAt: new Date(now - Governor.MAX_COGNITION_AGE_MS - 1).toISOString(), stale: false }
      });
    },
    env: {}
  });
  assert.equal(stale.packet.readiness.canReason, false);
  assert(stale.packet.readiness.blockers.includes('domain-cognition-stale'));

  assert.equal((await Governor.build('not-a-domain', { briefingBuilder: async function () { throw new Error('must not run'); } })).reason, 'unknown-product-domain');
  assert.equal(Governor.canonical('health'), 'medicine');
  assert.equal(Governor.domainLines('finance', {}).length, 2);

  console.log('domain governor briefing: server grounding, separate brain/code/economics topology, aliases, freshness, and no narrative authority passed');
})().catch(function (error) { console.error(error); process.exit(1); });
