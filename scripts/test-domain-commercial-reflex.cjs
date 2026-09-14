'use strict';

var assert = require('node:assert/strict');
var Contracts = require('../lib/domain-commercial-contracts.js');
var Lanes = require('../lib/domain-commercial-lanes.js');
var Reflex = require('../lib/domain-commercial-reflex.js');
var Artifact = require('../lib/domain-commercial-artifact.js');
var Handler = require('../handlers/domain-commercial-reflex.js');
var ArtifactHandler = require('../handlers/domain-commercial-artifact-prep.js');
var Status = require('../handlers/domain-commercial-status.js');

function memory() {
  var values = Object.create(null), lists = Object.create(null);
  return {
    values: values,
    lists: lists,
    assertDurable: function () { return true; },
    get: async function (key) { return values[key] == null ? null : JSON.parse(JSON.stringify(values[key])); },
    set: async function (key, value) { values[key] = JSON.parse(JSON.stringify(value)); return true; },
    setIfAbsent: async function (key, value) {
      if (values[key] != null) return false;
      values[key] = JSON.parse(JSON.stringify(value)); return true;
    },
    replaceIfValue: async function (key, expected, value) {
      if (JSON.stringify(values[key]) !== JSON.stringify(expected)) return false;
      values[key] = JSON.parse(JSON.stringify(value)); return true;
    },
    lpush: async function (key, value) {
      (lists[key] || (lists[key] = [])).unshift(JSON.parse(JSON.stringify(value)));
      return lists[key].length;
    },
    ltrim: async function (key, start, stop) {
      lists[key] = (lists[key] || []).slice(start, stop + 1); return true;
    },
    lrange: async function (key, start, stop) {
      return JSON.parse(JSON.stringify((lists[key] || []).slice(start, stop + 1)));
    },
    lrem: async function (key, count, value) {
      var target = JSON.stringify(value), removed = 0;
      lists[key] = (lists[key] || []).filter(function (row) {
        if ((count === 0 || removed < count) && JSON.stringify(row) === target) { removed++; return false; }
        return true;
      });
      return removed;
    }
  };
}

function cognition(domain, now, suffix, opts) {
  opts = opts || {};
  var contract = Contracts.get(domain);
  return {
    ts: now,
    c: {
      domain: contract.ownerDomain,
      stress: opts.stress == null ? 0.64 : opts.stress,
      phase: opts.phase || 'P4 SIGNAL',
      awareness: { humanReviewRequired: !!opts.humanReviewRequired },
      interoception: { divergence: 0.22 },
      brainOrgans: {
        resourceMetabolism: {
          state: opts.metabolism || 'AVAILABLE',
          gates: { mayRunInternalCycle: opts.mayRunInternalCycle !== false }
        }
      },
      serverPacketPersistence: { ok: opts.durable !== false },
      serverPacket: {
        schemaVersion: 'civilization-domain-packet/1.0',
        packetId: domain + ':packet:' + suffix,
        domainId: domain,
        sourceType: 'server-cognition-refresh',
        generatedAt: new Date(now - 1000).toISOString(),
        truth: {
          stressScore: opts.stress == null ? 0.64 : opts.stress,
          phase: opts.phase || 'p4',
          feedHealth: { configured: 4, live: opts.live == null ? 4 : opts.live },
          semanticEvidenceMeta: {
            status: opts.semanticStatus || 'OBSERVED',
            ownerDomain: domain,
            sourceDomain: contract.ownerDomain,
            schemaVersion: 'domain-semantic-packet/1.0'
          },
          semanticEvidence: [0, 1, 2].map(function (index) {
            return {
              sourceIdentity: { kind: 'headline-title', value: domain + ':' + suffix + ':' + index },
              title: domain + ' current source ' + suffix + ' ' + index,
              publisher: 'Publisher ' + index,
              feedName: 'Feed ' + index,
              sourceUpdatedAt: new Date(now - index * 60000).toISOString(),
              recordedAt: new Date(now).toISOString(),
              sourceRecordId: 'https://example.test/' + domain + '/' + suffix + '/' + index
            };
          }),
          opportunities: [{ id: domain + '-opportunity-' + suffix, held: false }],
          treatments: [{ id: domain + '-treatment-' + suffix, evidence: 'admitted' }],
          directives: [{ id: domain + '-directive-' + suffix, authority: 'internal' }]
        }
      }
    }
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader: function (key, value) { this.headers[key] = value; },
    end: function (body) { this.body = body || ''; return this; }
  };
}

(async function () {
  var now = Date.now();
  assert.equal(Contracts.DOMAINS.length, 20);
  assert.equal(Object.keys(Contracts.CONTRACTS).length, 20);
  assert.equal(Object.keys(Lanes.LANES).length, 20);
  Contracts.DOMAINS.forEach(function (domain) {
    var contract = Contracts.get(domain);
    assert.equal(contract.productDomain, domain);
    assert.ok(contract.allowedPrograms.includes('SUBSCRIBER_BRIEF'));
    assert.ok(contract.allowedPrograms.includes('PUBLIC_ARTICLE'));
    assert.ok(contract.allowedPrograms.includes('SHORT_VIDEO'));
    assert.ok(contract.offerRungs.length > 0);
    assert.match(contract.stateKey, new RegExp(':' + domain + '$'));
    assert.match(contract.intentQueue, new RegExp(':' + domain + '$'));
    assert.match(contract.artifactStateKey, new RegExp(':' + domain + '$'));
  });

  var finance = Lanes.get('finance');
  var first = finance.evaluate(cognition('finance', now, 'a'), null, now);
  assert.equal(first.status, 'PLANNED');
  assert.equal(first.intent.productDomain, 'finance');
  assert.equal(first.intent.ownerDomain, 'finance');
  assert.equal(first.intent.externalEffectAuthorized, false);
  assert.equal(first.intent.renderContract.status, 'EVIDENCE_FETCH_REQUIRED');
  assert.equal(first.intent.renderContract.sourceLinkedSignalBriefPermitted, true);
  assert.equal(first.intent.evidence[0].authority, 'topic-lead-only');
  assert.equal(first.intent.evidence[0].fullTextVerified, false);
  assert.equal(first.homology.basalGangliaSelection, 'DISINHIBIT_INTERNAL_PREPARATION_ONLY');
  assert.equal(first.homology.motorCortex, 'WRITE_AHEAD_INTENT');
  assert.equal(first.homology.reafference, 'AWAITING_INDEPENDENT_EXTERNAL_OUTCOME');

  var store = memory();
  var restored = await finance.persist(store, first);
  assert.equal(restored.readbackVerified, true);
  assert.equal(restored.intent.intentId, first.intent.intentId);
  assert.equal(restored.lastPlannedIntentId, first.intent.intentId);
  assert.equal(store.lists[finance.contract.intentQueue][0].intent.intentId, first.intent.intentId);
  var duplicate = await finance.persist(store, first);
  assert.equal(duplicate.intent.intentId, first.intent.intentId);
  assert.equal(Object.keys(store.values).filter(function (key) { return key.indexOf(finance.contract.intentPrefix) === 0; }).length, 1);
  var older = finance.evaluate(cognition('finance', now - 60000, 'older'), null, now - 60000);
  var olderResult = await finance.persist(store, older);
  assert.equal(olderResult.intent.intentId, first.intent.intentId);
  assert.equal((await store.get(finance.contract.stateKey)).intent.intentId, first.intent.intentId);

  var prepared = Artifact.build(finance.contract, restored, now + 1000);
  assert.equal(prepared.status, 'ARTIFACT_PREPARED');
  assert.equal(prepared.artifact.productDomain, 'finance');
  assert.equal(prepared.artifact.intentId, restored.intent.intentId);
  assert.equal(prepared.artifact.truthBoundary.fullTextRead, false);
  assert.equal(prepared.artifact.truthBoundary.titleClaimsAttributedOnly, true);
  assert.equal(prepared.artifact.externalEffectAuthorized, false);
  assert.match(prepared.artifact.body, /What the feeds surfaced/);
  assert.match(prepared.artifact.body, /not claims that LIMEN independently verified/);
  var preparedRestored = await Artifact.persist(store, finance.contract, prepared);
  assert.equal(preparedRestored.artifactId, prepared.artifact.artifactId);
  assert.equal((await store.get(finance.contract.artifactStateKey)).contentHash, prepared.artifact.contentHash);
  assert.equal((await Artifact.persist(store, finance.contract, prepared)).artifactId, prepared.artifact.artifactId);
  var renewedAt = now + Artifact.freshnessMs(restored.intent.cadence) + 1;
  var renewed = Artifact.build(finance.contract, restored, renewedAt);
  assert.notEqual(renewed.artifact.artifactId, prepared.artifact.artifactId,
    'an expired partial artifact attempt receives a new deterministic freshness identity');
  assert.equal(renewed.artifact.contentHash, prepared.artifact.contentHash,
    'freshness renewal never changes customer content identity');
  assert(renewed.artifact.freshnessExpiresAt > renewedAt);
  var equivalentState = JSON.parse(JSON.stringify(restored));
  equivalentState.intent.intentId = 'different-internal-intent-same-customer-content';
  var equivalentArtifact = Artifact.build(finance.contract, equivalentState, now + 1000);
  assert.equal(equivalentArtifact.artifact.contentHash, prepared.artifact.contentHash);
  assert.notEqual(equivalentArtifact.artifact.artifactId, prepared.artifact.artifactId);
  var foreignState = Object.assign({}, restored, { productDomain: 'energy' });
  assert.equal(Artifact.build(finance.contract, foreignState, now + 1000).reason, 'domain-commercial-identity-mismatch');

  var second = finance.evaluate(cognition('finance', now + 60000, 'a'), restored, now + 60000);
  assert.equal(second.status, 'ABSTAINED');
  assert.equal(second.reason, 'no-meaningful-afferent-or-stress-change');
  var changed = finance.evaluate(cognition('finance', now + 120000, 'b'), restored, now + 120000);
  assert.equal(changed.status, 'ABSTAINED');
  assert.equal(changed.reason, 'commercial-cadence-inhibited');
  assert.equal(changed.pendingEvidenceFingerprint != null, true);
  var elapsed = now + Reflex.cadenceIntervalMs(first.intent.cadence) + 1;
  var eligible = finance.evaluate(cognition('finance', elapsed, 'b'), restored, elapsed);
  assert.equal(eligible.status, 'PLANNED');
  assert.notEqual(eligible.intent.intentId, first.intent.intentId);

  var outageStore = memory();
  var beforeOutage = await finance.persist(outageStore,
    finance.evaluate(cognition('finance', now, 'outage-a'), null, now));
  var outage = await finance.persist(outageStore,
    finance.evaluate(cognition('finance', now + 60000, 'outage-b', { live: 0 }), beforeOutage, now + 60000));
  assert.equal(outage.status, 'ABSTAINED');
  assert.equal(outage.lastPlannedAt, beforeOutage.lastPlannedAt);
  assert.equal(outage.lastPlannedIntentId, beforeOutage.intent.intentId);
  assert.deepEqual(outage.plannedHistory, beforeOutage.plannedHistory);
  assert.equal(outage.evidenceFingerprint, beforeOutage.evidenceFingerprint);
  var recoveredInsideCadence = finance.evaluate(
    cognition('finance', now + 120000, 'outage-c', { stress: 0.9 }), outage, now + 120000);
  assert.equal(recoveredInsideCadence.reason, 'commercial-cadence-inhibited');
  var racedArtifactCycle = await ArtifactHandler.run({ now: now + 180000, store: outageStore });
  assert.equal(racedArtifactCycle.rows.find(function (row) { return row.productDomain === 'finance'; }).status,
    'ARTIFACT_PREPARED', 'queued plan survives a newer mutable abstention state');
  assert.equal((outageStore.lists[finance.contract.intentQueue] || []).length, 0,
    'successfully prepared queued work is acknowledged');
  var consumedFallback = await ArtifactHandler.nextPlannedState(outageStore, finance.contract,
    now + Artifact.freshnessMs(beforeOutage.intent.cadence) + 1);
  assert.equal(consumedFallback, null,
    'the mutable PLANNED observation cannot renew an already prepared and acknowledged intent');
  delete outageStore.values[finance.contract.artifactStateKey];
  assert.equal(await ArtifactHandler.nextPlannedState(outageStore, finance.contract,
    now + Artifact.freshnessMs(beforeOutage.intent.cadence) + 1), null,
  'the durable artifact log also prevents consumed migration fallback replay');

  var backlogStore = memory();
  var backlogOld = finance.evaluate(cognition('finance', now - 120000, 'backlog-old'), null, now - 120000);
  var backlogNew = finance.evaluate(cognition('finance', now - 60000, 'backlog-new'), null, now - 60000);
  await finance.persist(backlogStore, backlogOld);
  await finance.persist(backlogStore, backlogNew);
  var backlogCycle = await ArtifactHandler.run({ now: now, store: backlogStore });
  assert.equal(backlogCycle.rows.find(function (row) { return row.productDomain === 'finance'; }).intentId,
    backlogNew.intent.intentId, 'newest queued plan is prepared first');
  assert.equal((backlogStore.lists[finance.contract.intentQueue] || []).length, 0,
    'older superseded plans are acknowledged with the prepared newest plan');

  var partialAckStore = memory();
  var partialOld = finance.evaluate(cognition('finance', now - 120000, 'partial-old'), null, now - 120000);
  var partialNew = finance.evaluate(cognition('finance', now - 60000, 'partial-new'), null, now - 60000);
  await finance.persist(partialAckStore, partialOld); await finance.persist(partialAckStore, partialNew);
  var durableLrem = partialAckStore.lrem, lremCalls = 0;
  partialAckStore.lrem = async function (key, count, value) {
    lremCalls++;
    if (lremCalls === 2) throw new Error('simulated partial acknowledgement failure');
    return durableLrem(key, count, value);
  };
  var partialFirst = await ArtifactHandler.run({ now: now, store: partialAckStore });
  assert.equal(partialFirst.rows.find(function (row) { return row.productDomain === 'finance'; }).status, 'FAILED');
  var newestArtifact = await partialAckStore.get(finance.contract.artifactStateKey);
  assert.equal(newestArtifact.intentId, partialNew.intent.intentId);
  partialAckStore.lrem = durableLrem;
  await ArtifactHandler.run({ now: now + 1000, store: partialAckStore });
  assert.equal((await partialAckStore.get(finance.contract.artifactStateKey)).intentId, partialNew.intent.intentId,
    'an older partial-cleanup remainder cannot replace newer customer inventory');
  assert.equal((partialAckStore.lists[finance.contract.intentQueue] || []).length, 0,
    'a later cycle safely retires the superseded remainder');

  var tiedStore = memory();
  var tiedA = JSON.parse(JSON.stringify(restored));
  tiedA.intent.intentId = 'intent-same-ms-a';
  tiedA.intent.plannedAt = now;
  var tiedZ = JSON.parse(JSON.stringify(restored));
  tiedZ.intent.intentId = 'intent-same-ms-z';
  tiedZ.intent.plannedAt = now;
  var tiedNewer = Artifact.build(finance.contract, tiedZ, now + 2000);
  var tiedOlderPreparedLater = Artifact.build(finance.contract, tiedA, now + 3000);
  await Artifact.persist(tiedStore, finance.contract, tiedNewer);
  await Artifact.persist(tiedStore, finance.contract, tiedOlderPreparedLater);
  assert.equal((await tiedStore.get(finance.contract.artifactStateKey)).intentId, tiedZ.intent.intentId,
    'the intent-id tie-breaker prevents an equal-timestamp older plan from replacing current inventory');

  var staleEvidence = cognition('finance', now, 'stale-evidence');
  staleEvidence.c.serverPacket.truth.semanticEvidence.forEach(function (row) {
    row.sourceUpdatedAt = new Date(now - Reflex.MAX_EVIDENCE_AGE_MS - 1).toISOString();
  });
  assert.equal(finance.evaluate(staleEvidence, null, now).reason, 'owning-domain-has-no-admitted-topic-leads');
  var futureEvidence = cognition('finance', now, 'future-evidence');
  futureEvidence.c.serverPacket.truth.semanticEvidence.forEach(function (row) {
    row.sourceUpdatedAt = new Date(now + Reflex.MAX_FUTURE_EVIDENCE_SKEW_MS + 1).toISOString();
  });
  assert.equal(finance.evaluate(futureEvidence, null, now).reason, 'owning-domain-has-no-admitted-topic-leads');

  var capPrior = Object.assign({}, restored, {
    evidenceFingerprint: 'old-fingerprint', lastStress: 0.2,
    lastPlannedAt: now - 3 * 60 * 60 * 1000,
    plannedHistory: [now - 23 * 60 * 60 * 1000, now - 10 * 60 * 60 * 1000, now - 3 * 60 * 60 * 1000]
  });
  var capped = finance.evaluate(cognition('finance', now, 'cap', { stress: 0.9 }), capPrior, now);
  assert.equal(capped.status, 'ABSTAINED');
  assert.equal(capped.reason, 'commercial-daily-artifact-cap-reached');

  assert.equal(finance.evaluate(cognition('finance', now, 'c', { live: 0 }), null, now).reason,
    'owning-domain-live-feeds-unavailable');
  assert.equal(finance.evaluate(cognition('finance', now, 'c', { durable: false }), null, now).reason,
    'owning-domain-server-packet-not-durable');
  assert.equal(finance.evaluate(cognition('finance', now, 'c', { metabolism: 'STARVED' }), null, now).reason,
    'owning-domain-resource-metabolism-inhibited');
  assert.equal(finance.evaluate(cognition('finance', now, 'c', { humanReviewRequired: true }), null, now).reason,
    'owning-domain-human-review-veto');

  var bad = cognition('finance', now, 'bad');
  bad.c.domain = 'energy';
  assert.equal(finance.evaluate(bad, null, now).reason, 'owning-domain-cognition-missing-or-mismatched');
  assert.throws(function () { Reflex.evaluate(null, bad, null, now); }, /exact domain commercial contract required/);

  var allStore = memory();
  var records = Object.create(null);
  Contracts.DOMAINS.forEach(function (domain) { records['limen:brain:cognition:' + domain] = cognition(domain, now, 'all'); });
  var cycle = await Handler.run({
    now: now,
    store: allStore,
    redisGet: async function (key) { return records[key] || null; }
  });
  assert.equal(cycle.ok, true);
  assert.equal(cycle.domains, 20);
  assert.equal(cycle.planned, 20);
  assert.equal(cycle.failed, 0);
  assert.equal(cycle.boundaries.providerCalled, false);
  assert.equal(new Set(cycle.rows.map(function (row) { return row.intentId; })).size, 20);
  assert.equal(Object.keys(allStore.values).filter(function (key) { return /^domain_commercial:state:/.test(key); }).length, 20);
  assert.equal(Contracts.DOMAINS.filter(function (domain) {
    return (allStore.lists[Contracts.get(domain).intentQueue] || []).length > 0;
  }).length, 20);

  var artifactCycle = await ArtifactHandler.run({ now: now + 2000, store: allStore });
  assert.equal(artifactCycle.ok, true);
  assert.equal(artifactCycle.domains, 20);
  assert.equal(artifactCycle.prepared, 20);
  assert.equal(artifactCycle.failed, 0);
  assert.equal(artifactCycle.boundaries.externalProviderCalled, false);
  assert.equal(new Set(artifactCycle.rows.map(function (row) { return row.artifactId; })).size, 20);
  assert.equal(Object.keys(allStore.values).filter(function (key) { return /^domain_commercial:artifact-state:/.test(key); }).length, 20);
  assert.equal(Contracts.DOMAINS.filter(function (domain) {
    return (allStore.lists[Contracts.get(domain).intentQueue] || []).length > 0;
  }).length, 0);

  var handler = Handler.createHandler({
    now: now,
    store: memory(),
    redisGet: async function (key) { return records[key] || null; },
    cronAuth: { enforce: function (req, res) {
      if (req.headers.authorization === 'Bearer test') return true;
      res._limenAuthRejected = true; res.statusCode = 401; res.end('{}'); return false;
    } }
  });
  var denied = response();
  await handler({ method: 'GET', url: '/api/domain-commercial-reflex', headers: {} }, denied);
  assert.equal(denied.statusCode, 401);
  var allowed = response();
  await handler({ method: 'GET', url: '/api/domain-commercial-reflex', headers: { authorization: 'Bearer test' } }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(JSON.parse(allowed.body).domains, 20);

  var gate = {
    reqKey: function () { return 'master'; },
    isMaster: function (pass) { return pass === 'master'; },
    hasDomain: function () { return true; },
    deny: function (res) { res.statusCode = 403; return res.end('{}'); }
  };
  var status = Status.createHandler({ gate: gate, store: allStore });
  var statusRes = response();
  await status({ method: 'GET', url: '/api/domain-commercial-status?domain=medicine', headers: {} }, statusRes);
  var statusBody = JSON.parse(statusRes.body);
  assert.equal(statusRes.statusCode, 200);
  assert.equal(statusBody.domains.length, 1);
  assert.equal(statusBody.domains[0].state.productDomain, 'medicine');
  assert.equal(statusBody.domains[0].state.externalEffectAuthorized, false);
  assert.equal(statusBody.domains[0].artifact.productDomain, 'medicine');
  assert.equal(statusBody.domains[0].artifact.status, 'ARTIFACT_PREPARED');

  console.log('domain commercial reflex: 20 sovereign lanes, homology, novelty, write-ahead, source-linked artifacts and auth PASS');
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exit(1);
});
