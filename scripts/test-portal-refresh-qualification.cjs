'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const {
    applyFinancialRefresh, hasThing0Qualification, hasThing1Provenance,
    shouldRescoreStaleOnly
  } = await import(pathToFileURL(path.join(__dirname, 'rescore-portals.mjs')));
  const coherentT1 = {
    status: 'validated', available: true, effectiveStatus: 'validated',
    kernelId: 'limen_backtest.py', thing0Qualification: 'qualified',
    thing0PermitsThing1Use: true
  };
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
    thing1Validation: coherentT1
  }, '2026-10-18T00:00:00Z');
  assert.equal(permitted.opportunitySignals[0].id, 'valid');

  /* Legacy provenance that claims validated+available without the protected
     identity and canonical Thing Zero fields must not keep a signal active. */
  const legacy = {
    opportunitySignals: [
      { engine: 'investment', id: 'legacy' },
      { engine: 'research', id: 'research-keep' }
    ]
  };
  applyFinancialRefresh(legacy, {
    validationStatus: 'validated',
    thing1Validation: { status: 'validated', available: true }
  }, '2026-10-18T00:00:00Z');
  assert.deepEqual(legacy.opportunitySignals.map(s => s.id), ['research-keep']);
  assert.equal(legacy.quarantinedOpportunitySignals[0].id, 'legacy');

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
      pathC: 0.4, envelopeStatus: 'ELIGIBLE_NOW',
      revenueLast4Q: 77, operatingCashFlow: 12, netLoss: -3
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
  /* Authored fundamentals are not kernel verdict fields. */
  assert.equal(stale.financialHealth.revenueLast4Q, 77);
  assert.equal(stale.financialHealth.operatingCashFlow, 12);
  assert.equal(stale.financialHealth.netLoss, -3);

  const fundamentals = {
    financialHealth: {
      revenueLast4Q: 123, operatingCashFlow: 45, netLoss: -6,
      phaseStateLabel: 'P7', pathA: 1.2, envelopeStatus: 'ELIGIBLE_NOW'
    }
  };
  applyFinancialRefresh(fundamentals, {
    validationStatus: 'validated',
    thing1Validation: coherentT1,
    pathA: 0.2
  }, '2026-10-18T00:00:02Z');
  assert.equal(fundamentals.financialHealth.revenueLast4Q, 123);
  assert.equal(fundamentals.financialHealth.operatingCashFlow, 45);
  assert.equal(fundamentals.financialHealth.netLoss, -6);
  assert.equal(fundamentals.financialHealth.pathA, 0.2);
  assert.equal(fundamentals.financialHealth.phaseStateLabel, undefined);
  assert.equal(fundamentals.financialHealth.envelopeStatus, undefined);

  /* A validated refresh also replaces the verdict object, so stale path and
     phase fields cannot survive beside fresh scores. */
  const keep = {
    financialHealth: {
      phaseStateLabel: 'P7', pathA: 1.2, pathB: 0.5, pathC: 0.4,
      pathAThreshold: 1.1, envelopeStatus: 'ELIGIBLE_NOW'
    }
  };
  applyFinancialRefresh(keep, {
    validationStatus: 'validated',
    thing1Validation: coherentT1,
    pathA: 0.2, pathB: 0.1, pathC: 0.0,
    pathAThreshold: 1.1, pathBThreshold: 1.5, pathCThreshold: 1.5,
    inEnvelope: true
  }, '2026-10-18T00:00:03Z');
  assert.equal(keep.financialHealth.pathA, 0.2);
  assert.equal(keep.financialHealth.pathB, 0.1);
  assert.equal(keep.financialHealth.pathAThreshold, 1.1);
  assert.equal(keep.financialHealth.phaseStateLabel, undefined);
  assert.equal(keep.financialHealth.envelopeStatus, undefined);
  assert.equal(keep.financialHealth.validationStatus, 'validated');

  const now = new Date();
  const currentQ = now.getUTCFullYear() + 'Q' + (Math.floor(now.getUTCMonth() / 3) + 1);
  const validatedT1 = coherentT1;
  const qualifiedT0 = { qualification_status: 'qualified', permits_thing1_use: true };
  const recent = (t0, t1) => ({
    financialHealth: {
      latestQuarter: currentQ,
      thing1Validation: t1,
      thing0Eligibility: t0
    }
  });

  /* Skip requires BOTH affirmative provenances. */
  assert.equal(shouldRescoreStaleOnly(recent(qualifiedT0, validatedT1)), false,
    'recent record with validated Thing 1 and qualified/permitted Thing 0 should be skipped');
  assert.equal(shouldRescoreStaleOnly(recent(qualifiedT0, { status: 'validated', available: true })), true,
    'legacy Thing 1 provenance without the new evidence must be rescored');

  /* Missing Thing 0 evidence, even with a recent validated Thing 1. */
  assert.equal(shouldRescoreStaleOnly(recent(undefined, validatedT1)), true,
    'missing Thing 0 evidence must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent({}, validatedT1)), true,
    'empty Thing 0 object must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent('qualified', validatedT1)), true,
    'non-object Thing 0 evidence must be rescored');

  /* Malformed, contradictory and non-permitting Thing 0 evidence. */
  assert.equal(shouldRescoreStaleOnly(recent({ qualification_status: { value: 'qualified' }, permits_thing1_use: true }, validatedT1)), true,
    'object-valued qualification_status must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent({ qualification_status: ['qualified'], permits_thing1_use: true }, validatedT1)), true,
    'array-valued qualification_status must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent({ qualification_status: 'QUALIFIED', permits_thing1_use: true }, validatedT1)), true,
    'non-canonical qualification_status must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent({ qualification_status: 'not_qualified', permits_thing1_use: true }, validatedT1)), true,
    'refused Thing 0 with a stray permit must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent({ qualification_status: 'qualified' }, validatedT1)), true,
    'qualified Thing 0 without a permit must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent({ qualification_status: 'qualified', permits_thing1_use: false }, validatedT1)), true,
    'qualified Thing 0 with a false permit must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent({ qualification_status: 'partially_qualified', permits_thing1_use: false }, validatedT1)), true,
    'partial Thing 0 qualification must be rescored');

  /* Thing 1 must also be affirmative. */
  assert.equal(shouldRescoreStaleOnly(recent(qualifiedT0, undefined)), true,
    'missing Thing 1 provenance must be rescored');
  assert.equal(shouldRescoreStaleOnly(recent(qualifiedT0, { status: 'unvalidated_after_modification', available: false })), true,
    'recent unvalidated Thing 1 must be retried');
  assert.equal(shouldRescoreStaleOnly(recent(qualifiedT0, { status: 'validated', available: false })), true,
    'validated but unavailable Thing 1 must be retried');
  assert.equal(shouldRescoreStaleOnly(recent(qualifiedT0, { status: 'not_permitted_by_thing0', available: false })), true,
    'recent refusal must be retried');

  /* An old quarter is rescored regardless of provenance. */
  assert.equal(shouldRescoreStaleOnly({
    financialHealth: { latestQuarter: '2000Q1', thing1Validation: validatedT1, thing0Eligibility: qualifiedT0 }
  }), true, 'old portal must be rescored');

  /* A successful provenance migration is idempotent: the first run writes the
     evidence, and the second --stale-only run skips the same record. */
  const migrated = { financialHealth: { latestQuarter: currentQ } };
  applyFinancialRefresh(migrated, {
    latestQuarter: currentQ,
    validationStatus: 'validated',
    thing1Validation: validatedT1,
    thing0Eligibility: qualifiedT0,
    thing0PermitsThing1: true
  }, '2026-10-19T00:00:00Z');
  assert.equal(shouldRescoreStaleOnly(migrated), false,
    'second stale-only run after successful provenance migration should skip');
  assert.equal(shouldRescoreStaleOnly(migrated), false,
    'stale-only migration check must be idempotent');

  assert.equal(hasThing0Qualification({}), false);
  assert.equal(hasThing0Qualification({ thing0Eligibility: qualifiedT0 }), true);
  assert.equal(hasThing0Qualification({ thing0Eligibility: { qualification_status: 'not_qualified', permits_thing1_use: true } }), false);
  assert.equal(hasThing1Provenance({}), false);
  assert.equal(hasThing1Provenance({ thing1Validation: validatedT1 }), true);
  assert.equal(hasThing1Provenance({ thing1Validation: { status: 'unvalidated_after_modification', available: false } }), false);
  console.log('portal refresh: Thing 1 provenance gates investment and stale-only migration; Thing 0 qualification gates stale-only skips; refusal clears stale verdict fields; research preserved; repeat is idempotent');
})().catch(e => { console.error(e); process.exitCode = 1; });
