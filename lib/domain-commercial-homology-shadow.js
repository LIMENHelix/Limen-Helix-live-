'use strict';

/*
 * Shadow-only admission check for the canonical neurology/business homology.
 * It observes what the current commercial reflex would do and records whether
 * canonical evidence would admit the same internal plan. It does not alter the
 * decision, enqueue work, call a provider, spend, or authorize an effect.
 */

var SCHEMA = 'domain-commercial-homology-shadow/1.0';
var CONTEXT_SCHEMA = 'civilization-homology-context/1.0';

function list(value) { return Array.isArray(value) ? value : []; }

function inspect(packet) {
  var context = packet && packet.homologyContext;
  var blockers = [];
  if (!context || context.schemaVersion !== CONTEXT_SCHEMA || context.status !== 'OBSERVATIONAL' || context.contextOnly !== true) {
    blockers.push('canonical-homology-context-missing-or-invalid');
    return { eligible: false, blockers: blockers };
  }
  if (!context.identity || context.identity.domainId !== packet.domainId) blockers.push('canonical-domain-identity-mismatch');
  if (!context.identity || !list(context.identity.companies).length) blockers.push('canonical-company-identity-unestablished');
  if (!context.phase || !context.phase.value || !list(context.phase.evidence).length) blockers.push('canonical-phase-evidence-unestablished');
  if (!list(context.brainNodes).length) blockers.push('canonical-brain-node-context-unestablished');
  if (!context.regulation || context.regulation.state === 'UNOBSERVED' || !context.regulation.regulatedVariable) {
    blockers.push('canonical-regulated-variable-unestablished');
  }
  var mappings = context.mappings || {};
  if (!mappings.neurology_to_business_homology || mappings.neurology_to_business_homology.status !== 'PRESENT') {
    blockers.push('neurology-to-business-mapping-unestablished');
  }
  if (!mappings.business_to_neurology_homology || mappings.business_to_neurology_homology.status !== 'PRESENT') {
    blockers.push('business-to-neurology-mapping-unestablished');
  }
  if (!mappings.p0_p10_proof_and_effects || mappings.p0_p10_proof_and_effects.status !== 'PRESENT') {
    blockers.push('p0-p10-effect-proof-unestablished');
  }
  return { eligible: blockers.length === 0, blockers: blockers };
}

function compare(packet, currentResult) {
  var admission = inspect(packet);
  var currentDecision = currentResult && currentResult.status || 'ABSTAINED';
  var shadowDecision = admission.eligible ? currentDecision : 'ABSTAINED';
  return {
    schemaVersion: SCHEMA,
    mode: 'SHADOW_ONLY',
    currentDecision: currentDecision,
    shadowDecision: shadowDecision,
    wouldChange: shadowDecision !== currentDecision,
    eligible: admission.eligible,
    blockers: admission.blockers,
    externalEffectAuthorized: false,
    providerCalled: false,
    spendUsd: 0
  };
}

module.exports = { SCHEMA: SCHEMA, CONTEXT_SCHEMA: CONTEXT_SCHEMA, inspect: inspect, compare: compare };
