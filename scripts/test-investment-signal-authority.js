#!/usr/bin/env node
'use strict';

/**
 * test-investment-signal-authority.js — persisted investment signals surface
 * only under the established effective Thing One authority contract.
 *
 * A signal is active only when the current portal has thing1Validation
 * status=validated and available=true, AND the signal's frozen evidence names
 * a validated Thing One run. Retained but non-authoritative signals are
 * returned as withheld, never active.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const A = require('../assets/js/investment-signal-authority.js');

const ROOT = path.join(__dirname, '..');
const portalsDir = path.join(ROOT, 'assets', 'data', 'companies');

// ── Exact JBHT reproduction ───────────────────────────────────────────────
const jb = JSON.parse(fs.readFileSync(path.join(portalsDir, 'jb_hunt.json'), 'utf8'));
assert.strictEqual(jb.financialHealth.thing1Validation, undefined,
  'JBHT fixture changed: current Thing One provenance is now present');
assert.strictEqual(jb.financialHealth.validationStatus, 'ingestion_suspect');
const jbPart = A.partitionOpportunitySignals(jb);
assert.strictEqual(jbPart.active.length, 0, 'JBHT persisted investment signal surfaced');
assert.strictEqual(jbPart.withheld.length, 1);
assert.strictEqual(jbPart.withheld[0].signal.subType, 'distress-short-candidate');
assert.strictEqual(jbPart.withheld[0].signal.estimatedValue, 'high-confidence');
assert.strictEqual(jbPart.withheld[0].reason, 'current_thing1_not_authorized');
assert.ok(/Validated kernel alert/.test(jbPart.withheld[0].signal.message));

// ── Current corpus: 15 persisted, 0 active, 15 withheld ───────────────────
let totalSignals = 0;
let investmentSignals = 0;
let investmentPortals = 0;
let activeInvestment = 0;
let withheldInvestment = 0;
let otherEngineSignals = 0;
for (const f of fs.readdirSync(portalsDir).filter((x) => x.endsWith('.json'))) {
  let co;
  try { co = JSON.parse(fs.readFileSync(path.join(portalsDir, f), 'utf8')); }
  catch (e) { continue; }
  const sigs = Array.isArray(co.opportunitySignals) ? co.opportunitySignals : [];
  const inv = sigs.filter((s) => s && s.engine === 'investment');
  totalSignals += sigs.length;
  otherEngineSignals += sigs.length - inv.length;
  if (inv.length) investmentPortals++;
  investmentSignals += inv.length;
  const part = A.partitionOpportunitySignals(co);
  activeInvestment += part.active.filter((s) => s && s.engine === 'investment').length;
  withheldInvestment += part.withheld.length;
  assert.strictEqual(part.active.filter((s) => s && s.engine === 'investment').length,
    A.portalThing1Authorized(co) ? inv.filter(A.signalFrozenValidated).length : 0);
  assert.strictEqual(part.active.filter((s) => !s || s.engine !== 'investment').length,
    sigs.length - inv.length, 'a non-investment engine signal was dropped in ' + co.slug);
}
assert.strictEqual(investmentSignals, 15);
assert.strictEqual(investmentPortals, 14);
assert.strictEqual(activeInvestment, 0, 'a persisted legacy investment signal is still active');
assert.strictEqual(withheldInvestment, 15);
assert.strictEqual(otherEngineSignals, totalSignals - investmentSignals);
assert.ok(otherEngineSignals > 2000, 'unrelated engine signals were not preserved');

// ── Coherent validated control ────────────────────────────────────────────
const validSignal = {
  engine: 'investment', subType: 'distress-short-candidate',
  evidence: { validationStatus: 'validated', thing1ValidationStatus: 'validated' }
};
const coherentProvenance = {
  status: 'validated', available: true, effectiveStatus: 'validated',
  kernelId: 'limen_backtest.py', thing0Qualification: 'qualified',
  thing0PermitsThing1Use: true
};
const coherent = {
  financialHealth: { thing1Validation: coherentProvenance },
  opportunitySignals: [validSignal, { engine: 'research', id: 'r1' }]
};
const coherentPart = A.partitionOpportunitySignals(coherent);
assert.strictEqual(coherentPart.active.length, 2);
assert.strictEqual(coherentPart.withheld.length, 0);
assert.strictEqual(A.portalThing1Authorized(coherent), true);

// ── Each half of the contract is required ─────────────────────────────────
const currentOnly = {
  financialHealth: { thing1Validation: coherentProvenance },
  opportunitySignals: [{ engine: 'investment', evidence: {} }]
};
assert.strictEqual(A.partitionOpportunitySignals(currentOnly).active.length, 0,
  'missing frozen provenance surfaced an investment signal');
assert.strictEqual(A.partitionOpportunitySignals(currentOnly).withheld[0].reason,
  'frozen_provenance_not_validated');

const frozenOnly = {
  financialHealth: {},
  opportunitySignals: [{ engine: 'investment', evidence: { validationStatus: 'validated' } }]
};
assert.strictEqual(A.partitionOpportunitySignals(frozenOnly).active.length, 0,
  'missing current Thing One authority surfaced an investment signal');
assert.strictEqual(A.partitionOpportunitySignals(frozenOnly).withheld[0].reason,
  'current_thing1_not_authorized');

const legacyProvenance = {
  financialHealth: { thing1Validation: { status: 'validated', available: true } },
  opportunitySignals: [{ engine: 'investment', evidence: { validationStatus: 'validated' } }]
};
assert.strictEqual(legacyProvenance.financialHealth.thing1Validation.kernelId, undefined);
assert.strictEqual(A.partitionOpportunitySignals(legacyProvenance).active.length, 0,
  'legacy provenance without the new evidence surfaced an investment signal');
assert.strictEqual(A.partitionOpportunitySignals(legacyProvenance).withheld[0].reason,
  'current_thing1_not_authorized');

const nonInvestment = {
  financialHealth: {},
  opportunitySignals: [{ engine: 'research', id: 'r2' }]
};
assert.strictEqual(A.partitionOpportunitySignals(nonInvestment).active.length, 1,
  'a non-investment engine signal was withheld');

// ── Input immutability ────────────────────────────────────────────────────
const before = JSON.stringify(jb);
A.partitionOpportunitySignals(jb);
assert.strictEqual(JSON.stringify(jb), before, 'partition mutated the portal');

// ── Every production consumer uses the shared gate ────────────────────────
const portalHtml = fs.readFileSync(path.join(ROOT, 'company-portal.html'), 'utf8');
assert.ok(portalHtml.includes('assets/js/investment-signal-authority.js'));
assert.ok(portalHtml.includes('partitionOpportunitySignals'));
assert.ok(portalHtml.includes('Withheld · non-actionable'));
const portalUi = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'company-portal-ui.js'), 'utf8');
assert.ok(portalUi.includes('partitionOpportunitySignals'));
assert.ok(portalUi.includes('WITHHELD · NON-ACTIONABLE'));
const engine = fs.readFileSync(path.join(ROOT, 'scripts', 'run-investment-engine.js'), 'utf8');
assert.ok(engine.includes('portalThing1Authorized'),
  'the write gate does not share the read authority contract');

console.log('investment signal authority: 15 persisted, 0 active, 15 withheld; coherent control active; unrelated engines preserved');
