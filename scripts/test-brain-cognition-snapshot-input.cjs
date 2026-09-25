'use strict';

var assert = require('node:assert/strict');
var Input = require('../lib/brain-cognition-snapshot-input.js');

(function () {
  var now = Date.now();
  var domain = {
    meta: { snapshotId: 'domain-1', fetchedAt: now - 1000 },
    domains: {
      finance: { stress: 0.53, phase: 'p0', phaseLabel: 'SOURCE', sources: [] },
      health: { stress: 0.14, phase: 'p0', phaseLabel: 'SOURCE', sources: [] },
      research: { stress: 0.15, phase: 'p0', phaseLabel: 'SOURCE', sources: [] },
      supplyChain: { stress: 0.94, phase: 'p0', phaseLabel: 'SOURCE', sources: [] }
    }
  };
  var consoleSnapshot = {
    generatedAt: now - 2000,
    domains: {
      finance: { phase: 'p8', phaseLabel: 'GROWTH', phaseSource: 'node-grounded', phaseGrounded: true, phaseDivergent: true, phasePrior: 'p4', phaseEvidence: { scored: 6 } },
      health: { phase: 'p4', phaseLabel: 'FORM', phaseSource: 'node-grounded', phaseGrounded: true, phaseEvidence: { scored: 9 } },
      research: { phase: 'p4', phaseLabel: 'FORM', phaseSource: 'node-grounded', phaseGrounded: true, phaseEvidence: { scored: 4 } },
      supplyChain: { phase: 'p4', phaseLabel: 'FORM', phaseSource: 'node-grounded', phaseGrounded: true, phaseEvidence: { scored: 7 } }
    },
    domainCompanyJoin: {
      finance: { companies: [{ cik: '1601548' }] },
      health: { companies: [{ cik: '1' }] },
      research: { companies: [{ cik: '2' }] },
      supplyChain: { companies: [{ cik: '3' }] }
    },
    convergenceSignals: { finance: { primary_signal: 'DOMAIN_STRUCTURAL' } }
  };

  var result = Input.merge(domain, consoleSnapshot, now);
  assert.equal(result.evidence.status, 'OBSERVED');
  assert.equal(result.snapshot.domains.finance.phase, 'p8');
  assert.equal(result.snapshot.domains.finance.stress, 0.53, 'console merge must not replace live stress');
  assert.equal(result.snapshot.domainCompanyJoin.medicine.companies[0].cik, '1');
  assert.equal(result.snapshot.domainCompanyJoin.science.companies[0].cik, '2');
  assert.equal(result.snapshot.domainCompanyJoin.trade.companies[0].cik, '3');
  assert.equal(domain.domains.finance.phase, 'p0', 'input must not be mutated');

  var stale = Input.merge(domain, Object.assign({}, consoleSnapshot, { generatedAt: now - Input.MAX_CONSOLE_AGE_MS - 1 }), now);
  assert.equal(stale.evidence.status, 'ABSTAINED');
  assert.equal(stale.evidence.reason, 'console-snapshot-stale');
  assert.equal(stale.snapshot.domains.finance.phase, 'p0');
  assert.deepEqual(stale.snapshot.domainCompanyJoin, {});

  console.log('brain cognition snapshot input: all tests passed');
})();
