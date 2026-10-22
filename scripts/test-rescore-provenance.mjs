#!/usr/bin/env node
/**
 * test-rescore-provenance.mjs — persisted Thing One availability is fail-closed.
 *
 * `available: true` requires the protected scorer identity, exactly validated
 * status, structurally valid and qualified Thing Zero with an explicit permit,
 * and no fingerprint, envelope or interpretive refusal. Every other case
 * persists available:false with an explicit refusal reason, and the investment
 * signal gate refuses to surface a persisted signal.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  deriveThing1Authority,
  toFinancialHealth,
  hasThing1Provenance,
  applyFinancialRefresh,
  shouldRescoreStaleOnly
} from './rescore-portals.mjs';

const require = createRequire(import.meta.url);
const gate = require('../assets/js/investment-signal-authority.js');
const ISO = '2026-10-22T00:00:00.000Z';

function response(overrides) {
  return Object.assign({
    kernel_id: 'limen_backtest.py',
    validation_status: 'validated',
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
    in_envelope: true,
    interpretive_only: false,
    envelope_status_code: null,
    fingerprint_status: { state: 'match' },
    composite_score: 0.5,
    alert: false,
    history_quarters: 40,
    latest_quarter: '2026Q2',
    dominant_phase: 'p4'
  }, overrides);
}

const cases = [
  ['missing kernel ID', response({ kernel_id: undefined }), 'kernel_id_missing'],
  ['blank kernel ID', response({ kernel_id: '   ' }), 'kernel_id_missing'],
  ['wrong kernel ID', response({ kernel_id: 'phase_engine.py' }), 'kernel_id_wrong:phase_engine.py'],
  ['missing Thing Zero', response({ thing0_eligibility: null }), 'thing0_missing'],
  ['malformed Thing Zero string', response({ thing0_eligibility: 'qualified' }), 'thing0_malformed'],
  ['malformed Thing Zero object', response({ thing0_eligibility: {} }), 'thing0_malformed'],
  ['partial Thing Zero', response({
    thing0_eligibility: { qualification_status: 'partially_qualified', permits_thing1_use: true }
  }), 'thing0_not_qualified:partially_qualified'],
  ['not-qualified Thing Zero', response({
    thing0_eligibility: { qualification_status: 'not_qualified', permits_thing1_use: true }
  }), 'thing0_not_qualified:not_qualified'],
  ['missing permit', response({
    thing0_eligibility: { qualification_status: 'qualified' }
  }), 'thing0_permission_missing'],
  ['false permit', response({
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: false }
  }), 'thing0_permission_false'],
  ['contradictory stray permit', response({
    thing0_eligibility: {
      qualification_status: 'qualified',
      permits_thing1_use: false,
      permitsThing1Use: true
    }
  }), 'thing0_evidence_contradictory'],
  ['unvalidated', response({ validation_status: 'unvalidated_after_modification' }),
    'validation_not_validated:unvalidated_after_modification'],
  ['explicit Thing Zero refusal', response({
    validation_status: 'not_permitted_by_thing0',
    thing0_eligibility: { qualification_status: 'not_qualified', permits_thing1_use: false }
  }), 'validation_not_validated:not_permitted_by_thing0'],
  ['fingerprint refusal', response({ fingerprint_status: { state: 'mismatch' } }),
    'fingerprint_refused:mismatch'],
  ['envelope refusal', response({ in_envelope: false }), 'envelope_refused:out_of_envelope'],
  ['interpretive refusal', response({ interpretive_only: true }), 'interpretive_refusal']
];

for (const [label, r, expectedReason] of cases) {
  const authority = deriveThing1Authority(r);
  assert.strictEqual(authority.available, false, label + ' was available');
  assert.strictEqual(authority.effectiveStatus, expectedReason, label + ': ' + authority.effectiveStatus);
  assert.strictEqual(authority.refusalReason, expectedReason);

  const fh = toFinancialHealth(r, ISO);
  assert.strictEqual(fh.thing1Validation.available, false, label + ' persisted available');
  assert.strictEqual(fh.thing1Validation.effectiveStatus, expectedReason);
  assert.strictEqual(fh.thing1Validation.refusalReason, expectedReason);
  assert.strictEqual(fh.thing1Validation.source, 'api/limen/score');
  assert.strictEqual(fh.thing1Validation.runAt, ISO);
  assert.ok(fh.thing1Validation.raw, label + ' lost raw diagnostics');
  assert.strictEqual(hasThing1Provenance(fh), false, label + ' passed the stale-only provenance test');

  const portal = {
    financialHealth: fh,
    opportunitySignals: [{
      engine: 'investment', id: 'persisted-' + label,
      evidence: { validationStatus: 'validated', thing1ValidationStatus: 'validated' }
    }]
  };
  assert.strictEqual(gate.portalThing1Authorized(portal), false, label + ' passed the investment gate');
  assert.strictEqual(gate.partitionOpportunitySignals(portal).active.length, 0,
    label + ' surfaced a persisted investment signal');
  assert.strictEqual(gate.partitionOpportunitySignals(portal).withheld.length, 1);
}

// ── Fully coherent control ────────────────────────────────────────────────
const coherent = response({});
const authority = deriveThing1Authority(coherent);
assert.strictEqual(authority.available, true);
assert.strictEqual(authority.effectiveStatus, 'validated');
assert.strictEqual(authority.refusalReason, null);
assert.strictEqual(authority.kernelId, 'limen_backtest.py');
assert.strictEqual(authority.thing0Qualification, 'qualified');
assert.strictEqual(authority.thing0PermitsThing1Use, true);

const coherentFh = toFinancialHealth(coherent, ISO);
assert.strictEqual(coherentFh.thing1Validation.available, true);
assert.strictEqual(coherentFh.thing1Validation.kernelId, 'limen_backtest.py');
assert.strictEqual(coherentFh.thing1Validation.thing0Qualification, 'qualified');
assert.strictEqual(coherentFh.thing1Validation.thing0PermitsThing1Use, true);
assert.strictEqual(hasThing1Provenance(coherentFh), true);

const coherentPortal = {
  financialHealth: coherentFh,
  opportunitySignals: [{
    engine: 'investment', id: 'coherent',
    evidence: { validationStatus: 'validated', thing1ValidationStatus: 'validated' }
  }]
};
assert.strictEqual(gate.portalThing1Authorized(coherentPortal), true);
assert.strictEqual(gate.partitionOpportunitySignals(coherentPortal).active.length, 1);

// Legacy provenance without the new evidence abstains.
const legacyFh = {
  thing1Validation: { status: 'validated', available: true, source: 'api/limen/score' }
};
assert.strictEqual(hasThing1Provenance(legacyFh), false);
assert.strictEqual(gate.portalThing1Authorized({ financialHealth: legacyFh }), false);

// ── Authored fundamentals preserved; signals quarantined only when refused ─
const authored = { revenueLast4Q: [1, 2, 3], margins: { gross: 0.4 }, warningSignals: ['w'] };
const refusedPortal = {
  financialHealth: Object.assign({}, authored),
  opportunitySignals: [
    { engine: 'investment', id: 'legacy', evidence: {} },
    { engine: 'research', id: 'research' }
  ]
};
applyFinancialRefresh(refusedPortal, toFinancialHealth(cases[0][1], ISO), ISO);
assert.deepStrictEqual(refusedPortal.financialHealth.revenueLast4Q, [1, 2, 3]);
assert.deepStrictEqual(refusedPortal.financialHealth.margins, { gross: 0.4 });
assert.deepStrictEqual(refusedPortal.opportunitySignals.map((s) => s.id), ['research']);
assert.strictEqual(refusedPortal.quarantinedOpportunitySignals[0].id, 'legacy');

const coherentPortal2 = {
  financialHealth: Object.assign({}, authored),
  opportunitySignals: [{ engine: 'investment', id: 'keep', evidence: {} }]
};
applyFinancialRefresh(coherentPortal2, coherentFh, ISO);
assert.deepStrictEqual(coherentPortal2.financialHealth.revenueLast4Q, [1, 2, 3]);
assert.deepStrictEqual(coherentPortal2.opportunitySignals.map((s) => s.id), ['keep']);
assert.strictEqual(coherentPortal2.quarantinedOpportunitySignals, undefined);

// Stale-only rescore decisions follow the same provenance.
assert.strictEqual(shouldRescoreStaleOnly({ financialHealth: coherentFh }), false);
assert.strictEqual(shouldRescoreStaleOnly({ financialHealth: legacyFh }), true);

console.log('rescore provenance: coherent control available; ' + cases.length +
  ' version-skew/refusal cases fail closed and stay withheld');
