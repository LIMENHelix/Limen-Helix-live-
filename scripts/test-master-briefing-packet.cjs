#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Briefing = require('../lib/master-briefing-packet.js');

const now = Date.parse('2026-08-27T14:00:00Z');
const headline = {
  title: 'Issuer reports a current operational change',
  publisher: 'SEC',
  publisherLabel: 'SEC',
  feedName: 'SEC EDGAR',
  contentKind: 'headline_title',
  aggregatorItemUrl: 'https://example.test/issuer-record',
  canonicalUrl: null,
  sourceIdentity: { kind: 'headline-title', value: 'finance:SEC EDGAR:7:0' },
  sourceUpdatedAt: '2026-08-27T13:50:00Z',
  recordedAt: '2026-08-27T13:51:00Z',
  publisherIndependence: 'unassessed'
};

const snapshots = {
  console_snapshot: {
    generatedAt: now - 60 * 1000,
    domains: {
      finance: {
        stress: 0.42, confidence: 0.8, activity: 0.6, stressSource: 'direct',
        phase: 'p7a', phaseLabel: 'P7A', phasePrior: 'p2', phaseGrounded: true,
        phaseDivergent: true, phasePrecision: 0.7, phaseSource: 'company-phase-scorer',
        phaseEvidence: { scored: 12, coverage: 0.75, distribution: { p7a: 7, p2: 5 } }
      },
      research: { stress: 0.2, confidence: 0.7, phase: 'p1', phaseGrounded: false, phaseDivergent: false }
    }
  },
  opportunities_snapshot: {
    generatedAt: now - 2 * 60 * 1000,
    opportunities: [
      { domain: 'finance', title: 'Bounded issuer investment candidate', path: 'INVESTABLE', rank: 0.8, confidence: 0.7, source: 'fixture' },
      { domain: 'science', title: 'Research paper candidate', path: 'RESEARCHABLE', rank: 0.5, confidence: 0.6, source: 'fixture' }
    ]
  }
};

function cognition(domain, stress, evidence) {
  return {
    c: {
      stress,
      phase: 'P7A',
      model: { regulation: 'stable' },
      immune: { immuneState: 'active' },
      interoception: { salience: 'primary-only', attend: 'stress', divergence: 0.3, channelCount: 3 },
      serverPacket: {
        schemaVersion: 'civilization-server-packet/1.0',
        packetId: domain + ':packet:1',
        generatedAt: new Date(now - 2 * 60 * 1000).toISOString(),
        truth: {
          feedHealth: { configured: 15, live: 15 },
          semanticEvidence: evidence || [],
          semanticEvidenceMeta: {
            status: evidence && evidence.length ? 'OBSERVED' : 'ABSTAINED',
            reason: evidence && evidence.length ? null : 'no-current-evidence',
            observationsRead: evidence ? evidence.length : 0,
            retrievedAt: new Date(now - 2 * 60 * 1000).toISOString(),
            authority: 'observation-only'
          }
        },
        homologyContext: { abstentions: [] }
      }
    },
    ts: now - 2 * 60 * 1000
  };
}

(async function () {
  let writes = 0;
  const packet = await Briefing.build({
    now,
    clientModels: [
      { domain: 'finance', stress: 0.9, phase: 'p2', salience: 'primary-only' },
      { domain: 'research', stress: 0.25, phase: 'p1', salience: 'aligned' }
    ],
    db: {
      async get(key) { return snapshots[key] || null; },
      async set() { writes++; throw new Error('briefing must be read-only'); }
    },
    async redisMGet(keys) {
      assert.equal(keys.length, 20);
      return {
        'limen:brain:cognition:finance': cognition('finance', 0.4, [headline]),
        'limen:brain:cognition:science': cognition('science', 0.2, [])
      };
    }
  });

  assert.equal(writes, 0);
  assert.equal(packet.domains.length, 20);
  assert.equal(packet.authority.selectsAction, false);
  assert.equal(packet.truthPolicy.thing2DecisionAuthority, false);
  assert.equal(packet.truthPolicy.thing2PredictionAuthority, false);

  const finance = packet.domains.find(row => row.domain === 'finance');
  assert.equal(finance.serverObservation.stress, 0.42, 'server observation must win over the client display projection');
  assert.equal(finance.clientProjection.stressDriftFromServer, 0.48);
  assert.equal(finance.phaseContext.maskingAssessment, 'POSSIBLE_MASKING');
  assert.equal(finance.phaseContext.possibleMasking, true);
  assert.equal(finance.phaseContext.decisionAuthority, false);
  assert.equal(finance.investmentNewsReview.sequence, 'CURRENT_NEWS_FIRST_THEN_THING2_MASKING_CONTEXT');
  assert.equal(finance.investmentNewsReview.status, 'CURRENT_NEWS_PRESENT');
  assert.equal(finance.investmentNewsReview.currentNews[0].title, headline.title);
  assert.equal(finance.investmentNewsReview.currentNews[0].sourceRecordUrl, headline.aggregatorItemUrl);
  assert.equal(finance.investmentNewsReview.maskingConfirmation, 'UNCONFIRMED_REQUIRES_COMPANY_SPECIFIC_NEWS_COMPARISON');
  assert.equal(finance.investmentNewsReview.decisionAuthority, false);

  const science = packet.domains.find(row => row.domain === 'science');
  assert.equal(science.runtimeKey, 'research');
  assert.equal(science.serverObservation.present, true, 'runtime alias must resolve to the science domain');

  const agriculture = packet.domains.find(row => row.domain === 'agriculture');
  assert.equal(agriculture.cognition.present, false);
  assert.equal(agriculture.cognition.semanticEvidence.status, 'ABSTAINED');
  assert.equal(agriculture.investmentNewsReview.status, 'NOT_APPLICABLE');

  console.log('master briefing packet: 20-domain server truth, aliases, current-news-first masking context, and read-only authority passed');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
