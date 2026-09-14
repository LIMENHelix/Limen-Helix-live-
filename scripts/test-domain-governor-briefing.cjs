'use strict';

var assert = require('node:assert/strict');
var Governor = require('../lib/domain-governor-briefing.js');
var CommercialLanes = require('../lib/domain-commercial-lanes.js');

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
  assert.equal(ready.packet.commercialReflex.status, 'UNOBSERVED');

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

  var treasuryRange = null;
  var fakeStore = {
    assertDurable: function () {},
    get: async function () { return null; },
    setIfAbsent: async function () { return true; },
    set: async function () {},
    lpush: async function () {},
    ltrim: async function () {},
    lrange: async function (key, start, end) {
      if (key === 'civilization_treasury_receipt_log') treasuryRange = { start: start, end: end };
      return [];
    }
  };
  var withTreasury = await Governor.build('culture', {
    now: now,
    briefingBuilder: async function () { return civilization('culture', now); },
    store: fakeStore,
    env: {}
  });
  assert.equal(withTreasury.ok, true);
  assert.deepEqual(treasuryRange, { start: 0, end: 9999 });

  var cultureLane = CommercialLanes.get('culture');
  var reflexState = {
    schemaVersion: 'domain-commercial-reflex/1.0',
    productDomain: 'culture',
    ownerDomain: 'culture',
    status: 'PLANNED',
    packetId: 'culture-cognition-1',
    phase: 4,
    priority: 0.72,
    evaluatedAt: now - 1000,
    persistedAt: now - 900,
    readbackVerified: true,
    lastPlannedIntentId: 'dci_culture_1',
    homology: { basalGangliaSelection: 'DISINHIBIT_INTERNAL_PREPARATION_ONLY' },
    intent: {
      intentId: 'dci_culture_1', status: 'PLANNED', selectedProgram: 'SHORT_VIDEO',
      allowedPrograms: ['SUBSCRIBER_BRIEF', 'PUBLIC_ARTICLE', 'SHORT_VIDEO', 'MEDIA_RELEASE_REVIEW'],
      cadence: 'IMMEDIATE', intensity: { band: 'SURGE', maxArtifacts24h: 3 },
      audience: ['culture subscriber'], offerRungs: [{ rung: 'p2', priceUsd: 4 }],
      evidence: [{ title: 'Observed title', authority: 'topic-lead-only', fullTextVerified: false }],
      admittedKnowledgeRefs: { opportunities: [], treatments: [], directives: [] },
      renderContract: { status: 'EVIDENCE_FETCH_REQUIRED' }, plannedAt: now - 1000
    }
  };
  var reflexStore = Object.assign({}, fakeStore, {
    get: async function (key) {
      if (key === cultureLane.contract.stateKey) return reflexState;
      if (key === cultureLane.contract.artifactStateKey) return {
        schemaVersion: 'domain-commercial-artifact/1.0', artifactId: 'dca_culture_1',
        status: 'ARTIFACT_PREPARED', productDomain: 'culture', ownerDomain: 'culture',
        intentId: 'dci_culture_1', subject: 'Culture signal brief', body: 'Source-linked body',
        contentHash: 'culture-hash', freshnessExpiresAt: now + 60000, externalEffectAuthorized: false
      };
      return null;
    }
  });
  var withReflex = await Governor.build('culture', {
    now: now,
    briefingBuilder: async function () { return civilization('culture', now); },
    store: reflexStore,
    env: {}
  });
  assert.equal(withReflex.packet.commercialReflex.status, 'OBSERVED');
  assert.equal(withReflex.packet.commercialReflex.state.productDomain, 'culture');
  assert.equal(withReflex.packet.commercialReflex.state.workOrder.selectedProgram, 'SHORT_VIDEO');
  assert.equal(withReflex.packet.commercialReflex.state.workOrder.evidence[0].fullTextVerified, false);
  assert.equal(withReflex.packet.commercialReflex.state.externalEffectAuthorized, false);
  assert.equal(withReflex.packet.commercialReflex.latestArtifact.artifactId, 'dca_culture_1');

  var expiredReflexStore = Object.assign({}, reflexStore, {
    get: async function (key) {
      if (key === cultureLane.contract.stateKey) return reflexState;
      if (key === cultureLane.contract.artifactStateKey) return {
        schemaVersion: 'domain-commercial-artifact/1.0', artifactId: 'dca_expired',
        status: 'ARTIFACT_PREPARED', productDomain: 'culture', ownerDomain: 'culture',
        freshnessExpiresAt: now - 1, externalEffectAuthorized: false
      };
      return null;
    }
  });
  var expiredReflex = await Governor.build('culture', {
    now: now, briefingBuilder: async function () { return civilization('culture', now); },
    store: expiredReflexStore, env: {}
  });
  assert.equal(expiredReflex.packet.commercialReflex.latestArtifact, null);

  var supersededArtifactStore = Object.assign({}, reflexStore, {
    get: async function (key) {
      if (key === cultureLane.contract.stateKey) return Object.assign({}, reflexState, {
        lastPlannedIntentId: 'dci_culture_newer_unprepared'
      });
      if (key === cultureLane.contract.artifactStateKey) return {
        schemaVersion: 'domain-commercial-artifact/1.0', artifactId: 'dca_culture_old',
        status: 'ARTIFACT_PREPARED', productDomain: 'culture', ownerDomain: 'culture',
        intentId: 'dci_culture_1', subject: 'Old Culture brief', body: 'Old source-linked body',
        contentHash: 'old-culture-hash', freshnessExpiresAt: now + 60000, externalEffectAuthorized: false
      };
      return null;
    }
  });
  var supersededArtifact = await Governor.build('culture', {
    now: now, briefingBuilder: async function () { return civilization('culture', now); },
    store: supersededArtifactStore, env: {}
  });
  assert.equal(supersededArtifact.packet.commercialReflex.status, 'OBSERVED');
  assert.equal(supersededArtifact.packet.commercialReflex.latestArtifact, null,
    'governor cannot present an older artifact after a newer plan exists');

  var staleStateStore = Object.assign({}, reflexStore, {
    get: async function (key) {
      if (key === cultureLane.contract.stateKey) return Object.assign({}, reflexState, {
        evaluatedAt: now - Governor.MAX_COMMERCIAL_WORK_AGE_MS - 1,
        intent: Object.assign({}, reflexState.intent, { plannedAt: now - Governor.MAX_COMMERCIAL_WORK_AGE_MS - 1 })
      });
      return null;
    }
  });
  var staleCommercial = await Governor.build('culture', {
    now: now, briefingBuilder: async function () { return civilization('culture', now); },
    store: staleStateStore, env: {}
  });
  assert.equal(staleCommercial.packet.commercialReflex.status, 'UNOBSERVED');
  assert.equal(staleCommercial.packet.commercialReflex.reason, 'domain-commercial-reflex-stale');
  assert.equal(staleCommercial.packet.commercialReflex.state, null);

  var foreignReflexStore = Object.assign({}, fakeStore, {
    get: async function (key) {
      if (key !== cultureLane.contract.stateKey) return null;
      return Object.assign({}, reflexState, { productDomain: 'finance' });
    }
  });
  var foreignReflex = await Governor.build('culture', {
    now: now,
    briefingBuilder: async function () { return civilization('culture', now); },
    store: foreignReflexStore,
    env: {}
  });
  assert.equal(foreignReflex.packet.commercialReflex.status, 'QUARANTINED');
  assert.equal(foreignReflex.packet.commercialReflex.state, null);

  console.log('domain governor briefing: server grounding, separate brain/code/economics topology, domain-local commercial work orders, full treasury projection, aliases, freshness, and no narrative authority passed');
})().catch(function (error) { console.error(error); process.exit(1); });
