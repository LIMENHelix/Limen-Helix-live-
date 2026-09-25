'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var phaseSpec = require('../lib/phase-spec.js');
var Regulation = require('../lib/domain-business-regulation.js');

var ROOT = path.join(__dirname, '..');
var raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/domain-business-regulation.json'), 'utf8'));
var expected = phaseSpec.PHASES.map(function (phase) { return phase.code; });

assert.equal(raw.schemaVersion, 'domain-business-stress-regulation/1.0');
assert.equal(raw._meta.namespace, 'businessStressRegulation');
assert.equal(raw._meta.phaseNamespace, 'domainCyclePhase');
assert.equal(raw._meta.capitalNamespace, 'businessCapitalBand');
assert.equal(raw._meta.mode, 'SHADOW_ONLY');
assert.deepEqual(raw.phases.map(function (row) { return row.phase; }), expected,
  'regulation contract must cover canonical P0-P10 exactly once and in order');

raw.phases.forEach(function (row, index) {
  var canonical = phaseSpec.PHASES[index];
  assert.equal(row.title, canonical.title, row.phase + ' title must come from the canonical phase registry');
  assert.equal(row.cycleState, canonical.state, row.phase + ' cycle state must come from the canonical phase registry');
  ['businessPosture', 'effectCeiling', 'capitalPromotion', 'businessResponse', 'exitEvidence'].forEach(function (field) {
    assert.equal(typeof row[field], 'string', row.phase + ' missing ' + field);
    assert.ok(row[field].trim(), row.phase + ' has blank ' + field);
  });
});

for (var i = 0; i <= 100; i++) {
  var stress = Regulation.stressPolicy(i / 100);
  assert.ok(stress && stress.id !== 'unknown', 'stress ' + i + '% must map to exactly one measured band');
}
assert.equal(Regulation.stressPolicy(0.399999).id, 'regulated');
assert.equal(Regulation.stressPolicy(0.4).id, 'elevated');
assert.equal(Regulation.stressPolicy(0.699999).id, 'elevated');
assert.equal(Regulation.stressPolicy(0.7).id, 'high');
assert.equal(Regulation.stressPolicy(0.849999).id, 'high');
assert.equal(Regulation.stressPolicy(0.85).id, 'acute');
assert.equal(Regulation.stressPolicy(null).id, 'unknown');
assert.equal(Regulation.normalizePhase('phase 10 renewal'), 'P10');
assert.equal(Regulation.normalizePhase('p11'), null);

var now = Date.parse('2026-09-25T16:00:00Z');
var health = {
  status: 'pass',
  observedAt: new Date(now - 1000).toISOString(),
  layers: { process: 'pass', scheduler: 'pass', execution: 'pass', governance: 'pass' }
};
var eligible = Regulation.evaluate({
  phase: 'P2', stress: 0.2, runtimeHealth: health, contractRatified: true,
  verifierFresh: true, reversible: true, rollbackRefVerified: true,
  actionClass: 'STANDARD', capitalPromotion: false, now: now
});
assert.equal(eligible.status, 'ELIGIBLE_FOR_GATE');
assert.equal(eligible.gateAdmissionEligible, true);
assert.equal(eligible.externalEffectAuthorized, false, 'eligibility may never be reported as authorization');
assert.equal(eligible.spendAuthorizedUsd, 0);

var missingHealth = Regulation.evaluate({ phase: 'P2', stress: 0.2 });
assert.equal(missingHealth.status, 'BLOCKED');
assert.ok(missingHealth.reasons.includes('four-layer-runtime-health-not-fresh-pass'));

var halted = Regulation.evaluate({ phase: 'P5', stress: 0.2, operatorHalt: true, runtimeHealth: health, now: now });
assert.equal(halted.status, 'HALTED');
assert.equal(halted.gateAdmissionEligible, false);

var acute = Regulation.evaluate({
  phase: 'P5', stress: 0.9, runtimeHealth: health, contractRatified: true,
  verifierFresh: true, reversible: true, rollbackRefVerified: true, actionClass: 'STABILIZATION', now: now
});
assert.equal(acute.status, 'BLOCKED');
assert.ok(acute.reasons.includes('acute-stress-circuit-breaker'));

var fracture = Regulation.evaluate({
  phase: 'P3', stress: 0.2, runtimeHealth: health, contractRatified: true,
  verifierFresh: true, reversible: true, rollbackRefVerified: true, actionClass: 'STANDARD', now: now
});
assert.equal(fracture.status, 'PROPOSE_ONLY');
assert.equal(fracture.phaseEffectCeiling, 'STABILIZE_ONLY');

var irreversible = Regulation.evaluate({
  phase: 'P5', stress: 0.2, runtimeHealth: health, contractRatified: true,
  verifierFresh: true, reversible: false, rollbackRefVerified: false, actionClass: 'STANDARD', now: now
});
assert.equal(irreversible.status, 'PROPOSE_ONLY');
assert.ok(irreversible.reasons.includes('reversibility-missing-or-unverified'));

var unfunded = Regulation.evaluate({
  phase: 'P5', stress: 0.2, runtimeHealth: health, contractRatified: true,
  verifierFresh: true, reversible: true, rollbackRefVerified: true,
  actionClass: 'STANDARD', capitalPromotion: true, reconciledFunding: false, now: now
});
assert.equal(unfunded.status, 'PROPOSE_ONLY');
assert.ok(unfunded.reasons.includes('capital-promotion-lacks-reconciled-funding'));

var acuteUnratified = Regulation.evaluate({
  phase: 'P2', stress: 0.9, runtimeHealth: health, contractRatified: false,
  verifierFresh: false, reversible: true, rollbackRefVerified: true,
  actionClass: 'STANDARD', now: now
});
assert.equal(acuteUnratified.status, 'BLOCKED', 'a missing contract must not downgrade an acute block');
assert.ok(acuteUnratified.reasons.includes('acute-stress-circuit-breaker'));

var unknownStress = Regulation.evaluate({
  phase: 'P2', stress: null, runtimeHealth: health, contractRatified: true,
  verifierFresh: true, reversible: true, rollbackRefVerified: true,
  actionClass: 'STANDARD', now: now
});
assert.equal(unknownStress.status, 'PROPOSE_ONLY');
assert.ok(unknownStress.reasons.includes('stress-unmeasured-or-invalid'));

var threshold = Regulation.evaluate({
  phase: 'P9', stress: 0.2, runtimeHealth: health, contractRatified: true,
  verifierFresh: true, reversible: true, rollbackRefVerified: true,
  actionClass: 'STANDARD', now: now
});
assert.equal(threshold.status, 'BLOCKED');
assert.ok(threshold.reasons.includes('phase-circuit-breaker'));

var staleHealth = JSON.parse(JSON.stringify(health));
staleHealth.observedAt = new Date(now - raw._meta.runtimeHealthMaxAgeMs - 1).toISOString();
var stale = Regulation.evaluate({
  phase: 'P2', stress: 0.2, runtimeHealth: staleHealth, contractRatified: true,
  verifierFresh: true, reversible: true, rollbackRefVerified: true,
  actionClass: 'STANDARD', now: now
});
assert.equal(stale.status, 'BLOCKED');
assert.ok(stale.reasons.includes('four-layer-runtime-health-not-fresh-pass'));

console.log('domain business regulation: canonical P0-P10 + stress overlay + fail-closed governance: PASS');
