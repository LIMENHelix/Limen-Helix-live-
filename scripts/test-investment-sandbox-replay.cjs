#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Replay = require('../lib/investment-sandbox-replay.js');

function fixture() {
  return {
    snapshot: { domains: { finance: { sources: [{ name: 'Finnhub' }, { name: 'Alpha Vantage' }] } } },
    brainShadow: { cycles: { finance: {
      domain: 'finance', ok: true, startedAt: 100, finishedAt: 200,
      domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true } }
    } } },
    handoff: { packets: [{
      domainId: 'finance', sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T00:00:00Z',
      truth: { phase: 'p3', stressScore: 0.25, confidence: 0.8, activeDiagnoses: [], opportunities: [], feedHealth: { configured: 2, live: 2 } }
    }] },
    masterInbox: { readyForAutofire: [{
      status: 'READY_TO_FIRE', lane: 'investment', artifactRef: 'acme/investment/0',
      portalSlug: 'acme', portalTicker: 'ACME', patternId: 'pattern-1', phase: 'p3', fireScore: 0.7
    }] }
  };
}

const missing = Replay.summarize(fixture());
assert.equal(missing.simulationOnly, true);
assert.equal(missing.executionMode, 'paper');
assert.equal(missing.liveExecution, false);
assert.equal(missing.brokerOrderSubmitted, false);
assert(missing.blockers.includes('semantic_feed_evidence_not_carried_into_packet'));
assert(missing.blockers.includes('market_data_snapshot_not_supplied'));
assert(missing.blockers.includes('finance_packet_has_no_opportunity'));
assert.equal(missing.finance.candidate, null, 'legacy master inbox must not become a Finance candidate');
assert.equal(missing.finance.feedSourceCount, 2);
assert.equal(missing.status, 'ABSTAINED');

const complete = Replay.summarize(Object.assign(fixture(), {
  marketData: { asOf: '2026-08-24T00:00:00Z', sources: ['provider:paper-fixture'] },
  networkStress: { asOf: '2026-08-24T00:00:00Z', value: 0.1 },
  kernelSnapshot: { phase: 'p3', stressScore: 0.25 }
}));
// Semantic evidence is still deliberately absent in this fixture: adding
// market/network/kernel values must not make an incomplete feed context pass.
assert.equal(complete.status, 'ABSTAINED');
assert.equal(complete.brokerOrderSubmitted, false);

console.log('investment sandbox replay: 10/10 passed');
