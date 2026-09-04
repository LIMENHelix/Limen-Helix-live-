'use strict';

var assert = require('node:assert/strict');

var snapshot = {
  generatedAt: Date.now(),
  domains: {
    energy: {
      stress: 0.4,
      _legacyFeedStress: 1,
      stressSource: 'node-market-feed-grounded',
      marketChannel: { score: 0.5, price: 70 },
      feedFractal: { itemCount: 1 },
      phaseBelief: { grounded: true, belief: [1], phaseMAP: 0, confidence: 1, stuck: 0 },
      outcomeTrack: { trackedForecasts: 1, resolvedCount: 0, pendingCount: 1 }
    },
    law: {
      stress: 0.5,
      feedFractal: { itemCount: 1 },
      phaseBelief: {
        grounded: false,
        reason: 'total precision 0.42 < floor 0.5 — abstain',
        degraded: { reason: 'total precision 0.42 < floor 0.5 — abstain' },
        channels: null
      }
    }
  }
};

global.fetch = async function () {
  return { status: 200, text: async function () { return JSON.stringify(snapshot); } };
};

(async function () {
  var organ = await import('./sense/organ-stress-promotion.mjs?telemetry-test=1');
  var result = await organ.sense();

  assert.deepEqual(result.metrics.abstainingDomains, ['law']);
  assert.equal(
    result.metrics['law.phaseBeliefAbstention'].reason,
    'total precision 0.42 < floor 0.5 — abstain'
  );
  assert.equal(result.metrics['law.phaseBeliefAbstention'].channels, null);
  assert(result.attention.some(function (item) {
    return item.issue === 'law phaseBelief estimator abstained'
      && item.action.includes('total precision 0.42 < floor 0.5 — abstain');
  }));
  assert.equal(result.metrics.probes['energy:phase-belief'], 100);

  console.log('stress promotion telemetry: abstaining domains observed without entering promotion score');
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
