/**
 * B11 domain-to-actuator boundary for the only two active autonomous lanes.
 *
 * This module does not turn stress, a headline, a finding, or a kernel phase into
 * an action.  A pre-existing, provenance-bearing candidate must already exist.
 * The owning domain then either releases that candidate to the artifact actuator
 * or holds it with explicit reasons.
 *
 * Research is owned only by an explicitly registered research product brain.
 * Investment is owned only by Finance. Other domains may contribute context but
 * cannot own the command.
 */

'use strict';

var PK = require('../kernel/packet.js');
var PROP = require('../kernel/propose.js');
var SEL = require('../kernel/select.js');

var LANE_POLICY = {
  investment: {
    command: 'generate_investment_artifact',
    owners: ['finance'],
    externalExecution: 'proposal_only',
    horizonsDays: [30, 60, 90]
  },
  research: {
    command: 'generate_research_artifact',
    owners: ['research', 'health', 'education'],
    externalExecution: 'publication_evidence_only',
    requiredMappings: [
      'neurology_to_business_homology',
      'business_to_neurology_homology',
      'kernel_dynamics',
      'p0_p10_proof_and_effects'
    ]
  }
};

var DOMAIN_ALIASES = {
  science: 'research',
  research: 'research',
  medicine: 'health',
  health: 'health',
  education: 'education',
  finance: 'finance'
};

function canonicalDomain(value) {
  return DOMAIN_ALIASES[String(value || '').toLowerCase()] || String(value || '').toLowerCase();
}

function ownerFor(lane, subjectDomain) {
  if (lane === 'investment') return 'finance';
  if (lane !== 'research') return null;
  var d = canonicalDomain(subjectDomain);
  return d === 'research' || d === 'health' || d === 'education' ? d : null;
}

function sourceIdentity(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate.sourceArtifactRef) return { kind: 'master-inbox-artifact', value: candidate.sourceArtifactRef };
  if (candidate.sourcePatternSig) return { kind: 'phase-transition-pattern', value: candidate.sourcePatternSig };
  if (candidate.source && candidate.sourceTransitionAt) {
    return { kind: String(candidate.source), value: String(candidate.sourceTransitionAt) };
  }
  return null;
}

function criticCandidates(policy, candidate, source) {
  var gate = candidate.masterGate || {};
  ['confidence', 'readiness', 'salience', 'completeness'].forEach(function (k) {
    if (typeof gate[k] !== 'number' || !isFinite(gate[k]) || gate[k] < 0 || gate[k] > 1) {
      throw new Error('outward candidate needs masterGate.' + k + ' in [0,1]');
    }
  });
  var cost = typeof candidate._estimatedCostUsd === 'number' && isFinite(candidate._estimatedCostUsd)
    ? candidate._estimatedCostUsd : 0;
  if (cost < 0) throw new Error('estimated cost cannot be negative');

  /* Candidate construction remains in the actor module. The critic below does
     not read rationale or claimed benefits; it reads only the named gate terms. */
  var action = PROP.makeCandidate({
    id: 'cand_outward_' + policy.command,
    kind: policy.command,
    target: source.value,
    parameters: { candidateIdentity: source, artifactOnly: true },
    rationale: 'a provenance-bearing candidate passed the existing master-inbox gate',
    expectedBenefits: ['a reviewable artifact', 'a command/outcome episode with durable identity'],
    expectedHarms: ['paid model cost', 'an evidence-incomplete draft may sound plausible'],
    evidenceQuality: gate.confidence,
    uncertainty: 1 - gate.confidence,
    urgency: gate.salience,
    addressesState: gate.readiness,
    reversibility: 'full',
    cost: cost,
    authority: policy.command === 'generate_investment_artifact'
      ? 'internal:investment_proposal' : 'internal:research_synthesis',
    rollbackPlan: 'retain the receipt, mark the artifact withdrawn, and do not use it as evidence',
    expectedEvaluationMs: 0
  });
  var noAction = PROP.makeCandidate({
    id: 'cand_outward_no_action',
    kind: PROP.KIND.NO_ACTION,
    rationale: 'paid generation must compete with waiting for stronger evidence',
    expectedBenefits: ['no paid request', 'more evidence may arrive'],
    expectedHarms: ['a useful artifact may be delayed'],
    evidenceQuality: 1,
    uncertainty: 0,
    urgency: 0,
    addressesState: Math.max(0.05, 1 - gate.readiness),
    reversibility: 'full',
    cost: 0,
    authority: 'internal:none',
    rollbackPlan: 'nothing to roll back',
    expectedEvaluationMs: 0
  });
  return [action, noAction];
}

function select(spec) {
  spec = spec || {};
  var lane = String(spec.lane || '');
  var policy = LANE_POLICY[lane];
  var candidate = spec.candidate || {};
  var cycle = spec.domainCycle || null;
  var reasons = [];
  var owner = ownerFor(lane, candidate.domain);
  var source = sourceIdentity(candidate);

  if (!policy) reasons.push('lane_not_research_or_investment');
  if (!owner) {
    reasons.push(lane === 'research'
      ? 'research_subject_has_no_registered_research_owner'
      : 'no_declared_owner_for_lane');
  }
  if (!source) reasons.push('candidate_has_no_source_supplied_identity');
  if (!cycle) reasons.push('owning_domain_cycle_missing');
  if (cycle && cycle.ok !== true) reasons.push('owning_domain_cycle_not_ok');
  if (cycle && owner && canonicalDomain(cycle.domain) !== owner) reasons.push('cycle_domain_does_not_match_owner');

  var fn = cycle && cycle.domainFunction;
  if (!fn || !fn.evidence || fn.evidence.l3CurrentEvidenceComplete !== true) {
    reasons.push('owning_domain_has_no_current_l3_evidence');
  }
  if (!fn || !fn.evidence || fn.evidence.outwardConnected !== true) {
    reasons.push('owning_domain_has_no_declared_outward_consumer');
  }

  var criticDecision = null;
  if (!reasons.length) {
    if (!spec.gate || !spec.gate.opts) {
      reasons.push('owning_domain_outward_critic_missing');
    } else {
      try {
        criticDecision = SEL.select(spec.gate, criticCandidates(policy, candidate, source), {
          now: typeof spec.at === 'number' ? spec.at : Date.now(),
          modulation: spec.modulation || {}
        });
        if (criticDecision.outcome !== 'released' || !criticDecision.released ||
            criticDecision.released.kind !== policy.command) {
          reasons.push('brain_b10_did_not_release_command');
        }
      } catch (err) {
        reasons.push('outward_candidate_refused:' + err.message);
      }
    }
  }

  var status = reasons.length ? 'HELD' : 'RELEASED';
  var at = typeof spec.at === 'number' ? spec.at : Date.now();
  var identity = {
    lane: lane,
    ownerDomain: owner,
    cik: candidate.cik || null,
    sourceIdentity: source,
    cycleStartedAt: cycle && cycle.startedAt,
    cursorAfter: cycle && cycle.cursorAfter
  };

  return {
    schemaVersion: 1,
    id: 'sel_' + PK.sha256(PK.canonical(identity)).slice(0, 20),
    at: at,
    status: status,
    lane: lane,
    command: policy ? policy.command : null,
    ownerDomain: owner,
    subjectDomain: canonicalDomain(candidate.domain),
    candidate: {
      cik: candidate.cik || null,
      ticker: candidate.ticker || null,
      sourceIdentity: source,
      source: candidate.source || null
    },
    evidence: cycle ? {
      cycleStartedAt: cycle.startedAt || null,
      cycleFinishedAt: cycle.finishedAt || null,
      cursorAfter: cycle.cursorAfter === undefined ? null : cycle.cursorAfter,
      domainFunction: fn || null,
      relationshipEvidence: cycle.relationshipEvidence || null
    } : null,
    reasons: reasons,
    criticDecision: criticDecision,
    authority: {
      artifactGenerationOnly: true,
      liveTradingAuthorized: false,
      stressDirectlyTriggered: false,
      headlineDirectlyTriggered: false,
      policy: policy || null
    }
  };
}

module.exports = {
  LANE_POLICY: LANE_POLICY,
  canonicalDomain: canonicalDomain,
  ownerFor: ownerFor,
  sourceIdentity: sourceIdentity,
  select: select
};
