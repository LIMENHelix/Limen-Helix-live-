#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Handler = require('../handlers/master-agent.js');

const packet = {
  schemaVersion: 'master-briefing-evidence/1.0',
  packetId: 'master-briefing:test',
  generatedAt: '2026-08-27T14:00:00.000Z',
  authority: { observes: true, selectsAction: false, movesCapital: false },
  truthPolicy: { clientProjectionAdvisoryOnly: true, thing2DecisionAuthority: false },
  freshness: { consoleStale: false },
  coverage: { expectedDomains: 20, serverObservedDomains: 20 },
  readErrors: [],
  domains: [{
    domain: 'finance',
    serverObservation: { stress: 0.42, stressSource: 'direct' },
    cognition: {
      present: true, observedAt: '2026-08-27T13:58:00.000Z', stale: false,
      packetId: 'finance:1', regulation: 'stable', immune: 'active',
      interoception: { salience: 'primary-only' }, feedHealth: { configured: 15, live: 15 },
      semanticEvidence: { status: 'OBSERVED', observationsRead: 1, authority: 'observation-only' }
    },
    investmentNewsReview: {
      sequence: 'CURRENT_NEWS_FIRST_THEN_THING2_MASKING_CONTEXT',
      status: 'CURRENT_NEWS_PRESENT',
      currentNews: [{ title: 'Current issuer news', publisher: 'SEC' }],
      thing2PossibleMasking: true,
      maskingConfirmation: 'UNCONFIRMED_REQUIRES_COMPANY_SPECIFIC_NEWS_COMPARISON',
      decisionAuthority: false
    },
    phaseContext: { maskingAssessment: 'POSSIBLE_MASKING', decisionAuthority: false, predictionAuthority: false },
    opportunities: [{ title: 'Candidate', authority: 'candidate-only; not validated and not authorized' }],
    clientProjection: { role: 'display-advisory-only' }
  }]
};

const projection = Handler._test.promptProjection(packet);
assert.equal(projection.domains[0].currentNewsFirst.currentNews[0].title, 'Current issuer news');

const prompt = Handler._test.systemPrompt(packet);
assert(prompt.includes('CURRENT_NEWS_FIRST_THEN_THING2_MASKING_CONTEXT'));
assert(prompt.includes('present currentNewsFirst.currentNews BEFORE the Thing 2'));
assert(prompt.includes('Divergence means possible masking, never confirmed masking'));
assert(prompt.includes("'primary-only'"));
assert(prompt.includes('Thing 2 does not predict, confirm, rank, size, authorize, buy, sell, veto, or add confidence'));
assert(!prompt.includes('real audited financials run through the validated distress kernel'));
assert(!prompt.includes('rests on real audited company financials'));
assert(!prompt.includes('NO external market, price, macro feed'));
assert(prompt.length < 80000);

console.log('master agent evidence prompt: current news precedes possible-masking context and Thing 2 has zero authority');
