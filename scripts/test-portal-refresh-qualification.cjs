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
  /* The gate is Thing 1 provenance. A Thing 0 refusal appears as
     not_permitted_by_thing0; the investment rule does not inspect Thing 0. */
  applyFinancialRefresh(portal, {
    alert: false, validationStatus: 'not_permitted_by_thing0',
    thing0PermitsThing1: false,
    thing1Validation: { status: 'not_permitted_by_thing0', available: false },
    thing0Eligibility: { qualification_status: 'partially_qualified', permits_thing1_use: false }
  }, '2026-10-18T00:00:00Z');
  assert.deepEqual(portal.opportunitySignals.map(s => s.id), ['research']);
  assert.equal(portal.quarantinedOpportunitySignals[0].id, 'old-alert');
  assert.equal(portal.quarantinedOpportunitySignals[0].quarantineReason, 'thing1_not_validated');
  assert.equal(portal.financialHealth.alert, false);
  applyFinancialRefresh(portal, {
    validationStatus: 'not_permitted_by_thing0',
    thing1Validation: { status: 'not_permitted_by_thing0', available: false }
  }, '2026-10-18T00:00:01Z');
  assert.equal(portal.quarantinedOpportunitySignals.length, 1);

  const permitted = { opportunitySignals: [{ engine: 'investment', id: 'valid' }] };
  applyFinancialRefresh(permitted, {
    validationStatus: 'validated',
    thing1Validation: { status: 'validated', available: true }
  }, '2026-10-18T00:00:00Z');
  assert.equal(permitted.opportunitySignals[0].id, 'valid');

  const unvalidated = {
    opportunitySignals: [
      { engine: 'investment', id: 'stale-alert' },
      { engine: 'research', id: 'research-keep' }
    ]
  };
  applyFinancialRefresh(unvalidated, {
    validationStatus: 'unvalidated_after_modification',
    thing1Validation: { status: 'unvalidated_after_modification', available: false }
  }, '2026-10-18T00:00:00Z');
  assert.deepEqual(unvalidated.opportunitySignals.map(s => s.id), ['research-keep']);
  assert.equal(unvalidated.quarantinedOpportunitySignals[0].id, 'stale-alert');
  assert.equal(unvalidated.quarantinedOpportunitySignals[0].quarantineReason, 'thing1_not_validated');

  const stale = {
    financialHealth: {
      alert: true, phaseStateLabel: 'P7', pathA: 1.2, pathB: 0.5,
      pathC: 0.4, envelopeStatus: 'ELIGIBLE_NOW'
    }
  };
  applyFinancialRefresh(stale, {
    alert: false, validationStatus: 'not_permitted_by_thing0',
    thing0PermitsThing1: false,
    thing1Validation: { status: 'not_permitted_by_thing0', available: false },
    thing0Eligibility: { qualification_status: 'partially_qualified', permits_thing1_use: false }
  }, '2026-10-18T00:00:02Z');
  assert.equal(stale.financialHealth.phaseStateLabel, undefined);
  assert.equal(stale.financialHealth.pathA, undefined);
  assert.equal(stale.financialHealth.pathB, undefined);
  assert.equal(stale.financialHealth.pathC, undefined);
  assert.equal(stale.financialHealth.envelopeStatus, undefined);
  assert.equal(stale.financialHealth.alert, false);

  const keep = { financialHealth: { phaseStateLabel: 'P7' } };
  applyFinancialRefresh(keep, {
    validationStatus: 'validated',
    thing1Validation: { status: 'validated', available: true }
  }, '2026-10-18T00:00:03Z');
  assert.equal(keep.financialHealth.phaseStateLabel, 'P7');
  console.log('portal refresh: Thing 1 provenance gates investment; refusal clears stale verdict fields; research preserved; repeat is idempotent');
})().catch(e => { console.error(e); process.exitCode = 1; });
