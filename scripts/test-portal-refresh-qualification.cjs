'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const { applyFinancialRefresh } = await import(pathToFileURL(path.join(__dirname, 'rescore-portals.mjs')));
  const portal = {
    financialHealth: { alert: true },
    opportunitySignals: [{ engine: 'investment', id: 'old-alert' }, { engine: 'research', id: 'research' }]
  };
  applyFinancialRefresh(portal, {
    alert: false, thing0PermitsThing1: false,
    thing0Eligibility: { qualification_status: 'partially_qualified', permits_thing1_use: false }
  }, '2026-10-18T00:00:00Z');
  assert.deepEqual(portal.opportunitySignals.map(s => s.id), ['research']);
  assert.equal(portal.quarantinedOpportunitySignals[0].id, 'old-alert');
  assert.equal(portal.financialHealth.alert, false);
  applyFinancialRefresh(portal, { thing0PermitsThing1: false }, '2026-10-18T00:00:01Z');
  assert.equal(portal.quarantinedOpportunitySignals.length, 1);
  const permitted = { opportunitySignals: [{ engine: 'investment', id: 'valid' }] };
  applyFinancialRefresh(permitted, { thing0PermitsThing1: true }, '2026-10-18T00:00:00Z');
  assert.equal(permitted.opportunitySignals[0].id, 'valid');

  const stale = {
    financialHealth: {
      alert: true, phaseStateLabel: 'P7', pathA: 1.2, pathB: 0.5,
      pathC: 0.4, envelopeStatus: 'ELIGIBLE_NOW'
    }
  };
  applyFinancialRefresh(stale, {
    alert: false, thing0PermitsThing1: false,
    thing0Eligibility: { qualification_status: 'partially_qualified', permits_thing1_use: false }
  }, '2026-10-18T00:00:02Z');
  assert.equal(stale.financialHealth.phaseStateLabel, undefined);
  assert.equal(stale.financialHealth.pathA, undefined);
  assert.equal(stale.financialHealth.pathB, undefined);
  assert.equal(stale.financialHealth.pathC, undefined);
  assert.equal(stale.financialHealth.envelopeStatus, undefined);
  assert.equal(stale.financialHealth.alert, false);

  const keep = { financialHealth: { phaseStateLabel: 'P7' } };
  applyFinancialRefresh(keep, { thing0PermitsThing1: true, validationStatus: 'validated' }, '2026-10-18T00:00:03Z');
  assert.equal(keep.financialHealth.phaseStateLabel, 'P7');
  console.log('portal refresh: refusal quarantines investment evidence atomically; research preserved; stale verdict fields cleared; repeat is idempotent');
})().catch(e => { console.error(e); process.exitCode = 1; });
