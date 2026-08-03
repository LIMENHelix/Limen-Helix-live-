/**
 * brain-v2/corpus/opportunity.js — corpus observations into falsifiable opportunity packets.
 *
 * This is the step the SPEC checklist never measured: mechanism into product. A brain
 * that regulates one domain beautifully and emits nothing a person can act on has met
 * L2/L3 in OWNER_SYSTEM_INTENT.md and not L4.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * WHAT MAKES A CANDIDATE, AND WHY THESE TWO
 *
 * Both are read from fields the corpus actually carries, measured before this file was
 * written, so neither is a metaphor dressed as a signal.
 *
 *   RESEARCH  a node asserting many brain-circuit mappings with a LOW share of graded
 *             evidence. The corpus grades circuits in `issues[].circuits[].evidence`,
 *             and across the energy set most read "Unrated". A node claiming a lot and
 *             grading little is precisely where a grading study buys the most. The
 *             mapping direction is neurology-to-behaviour: the claim is that a brain
 *             node explains a domain failure, and grading it tests that claim.
 *
 *   BUSINESS  a node that is issue-dense and strongly connected — high `issueCount`
 *             against a high mean `edges[].weight`. Whoever operates that subdomain has
 *             a concentrated, well-connected problem. The direction is
 *             business-to-neurology: the operational evidence comes first and the
 *             neural mapping is what the corpus offers as an explanation.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * THE PREDICTION IS FALSIFIABLE AND RESOLVED FROM HELD-OUT DATA
 *
 * Each packet predicts a property of the node's own SUBTREE — files the ranker has not
 * read at prediction time. Resolution re-reads that subtree and measures. So the outcome
 * is real data the predictor did not see, not a mock and not a restatement.
 *
 * It is NOT a market outcome. Nobody bought anything. The honest description is: a
 * corpus-internal, held-out, measurable outcome. It is enough to close the learning loop
 * and demonstrably change ranking; it is not evidence that the opportunity is valuable
 * to a buyer, and `outcomeGrader` says which of the two it is.
 */

'use strict';

var EV = require('./adapter.js').EVIDENCE_TYPE;

var MAPPING_DIRECTION = {
  BUSINESS_TO_NEURO: 'business-to-neurology',
  NEURO_TO_BEHAVIOR: 'neurology-to-behavior'
};

var AUTHORITY = {
  /* Slice 1 emits recommendations only. Nothing here may spend, send, publish or
     contact — that is the conservative default in OWNER_SYSTEM_INTENT.md §5, and an
     opportunity packet is an internal recommendation until a human acts on it. */
  INTERNAL_RECOMMENDATION: 'internal-recommendation-only'
};

/**
 * Score a node against the peer population, using the brain's own departure units.
 *
 * `departures` maps channel -> z from core/brain.js, so a score is expressed in "how
 * unusual against peers" rather than in raw counts. That keeps a 60-issue node and a
 * 0.9-mean-weight node comparable without pretending their units are.
 */
function candidatesFrom(obs, departures, opts) {
  opts = opts || {};
  var minZ = (typeof opts.minZ === 'number') ? opts.minZ : 1.0;
  var out = [];
  var ch = obs.channels;

  function z(k) { var d = departures && departures[k]; return (d && typeof d.z === 'number') ? d.z : null; }

  // ── RESEARCH: claims a lot, grades little ────────────────────────────────────
  var claimCount = (ch.gradedCircuits || 0) + (ch.ungradedCircuits || 0);
  if (claimCount > 0 && ch.evidenceRatio !== null) {
    var zClaims = z('gradedCircuits');
    var ungradedShare = 1 - ch.evidenceRatio;
    if (ungradedShare >= (opts.minUngradedShare || 0.5) && claimCount >= (opts.minClaims || 2)) {
      out.push({
        kind: 'research',
        strength: ungradedShare * Math.log1p(claimCount),
        basis: claimCount + ' circuit claims, ' + (ungradedShare * 100).toFixed(0) + '% ungraded',
        zUsed: zClaims
      });
    }
  }

  // ── BUSINESS: issue-dense and strongly connected ─────────────────────────────
  var zIssues = z('issueCount'), zWeight = z('edgeWeightMean');
  if (zIssues !== null && zIssues >= minZ && ch.edgeCount > 0) {
    out.push({
      kind: 'business',
      strength: zIssues * (1 + (ch.edgeWeightMean || 0)),
      basis: ch.issueCount + ' issues at ' + zIssues.toFixed(2) + ' sd above peers, ' +
             ch.edgeCount + ' edges, mean weight ' + (ch.edgeWeightMean || 0).toFixed(2),
      zUsed: zIssues
    });
  }

  return out;
}

/**
 * Build the packet. Every field is either read from the record or derived from a stated
 * measurement — nothing is asserted without a basis a reader can check.
 */
function packet(obs, cand, ctx) {
  var ch = obs.channels;
  var circuits = [];
  (obs.issues || []).forEach(function (is) {
    (is.circuits || []).forEach(function (c) { circuits.push({ issue: is.id, nodeId: c.nodeId, dir: c.dir, evidenceType: c.evidenceType, stated: c.evidenceStated }); });
  });

  /* The WEAKEST grade present governs the packet. A node holding one measured circuit
     and nine analogies is not a measured claim. */
  var order = [EV.MEASURED, EV.REPORTED, EV.INFERRED, EV.HYPOTHESIS, EV.ANALOGY];
  var weakest = EV.MEASURED, present = {};
  circuits.forEach(function (c) { present[c.evidenceType] = (present[c.evidenceType] || 0) + 1; });
  order.forEach(function (t) { if (present[t]) weakest = t; });
  if (!circuits.length) weakest = EV.ANALOGY;

  var isResearch = cand.kind === 'research';

  /* THE PREDICTION. About the node's SUBTREE, which the ranker has not read. Stated as
     a band so it can be wrong, in the same measure-or-abstain shape the kernel uses. */
  var predicted = isResearch
    ? { variable: 'subtree.meanEvidenceRatio', expected: ch.evidenceRatio, band: 0.25,
        claim: 'children of this node grade evidence at a similar rate to the node itself' }
    : { variable: 'subtree.meanIssueCount', expected: Math.max(0.5, ch.issueCount * 0.25), band: Math.max(1, ch.issueCount * 0.35),
        claim: 'issue density persists into this node\'s children rather than being local to it' };

  return {
    opportunityId: 'opp_' + cand.kind + '_' + obs.sourceRecordId,
    sourceDomain: 'energy',
    sourceRecordId: obs.sourceRecordId,
    evidenceRecordIds: [obs.observationId],
    corpusPath: obs.corpusPath,

    /* WEAKEST-LINK epistemic grade, read from the corpus, never assigned here. */
    evidenceType: weakest,
    evidenceBreakdown: present,

    neuroscienceMapping: circuits.length
      ? circuits.slice(0, 6).map(function (c) { return c.nodeId + '(' + c.dir + ') <- ' + c.issue; }).join('; ')
      : 'none stated in this record',
    /* The mapping is KEPT and LABELLED, never deleted for being an analogy. An analogy
       that names a testable correspondence is the input to a grading study. */
    mappingStatus: weakest === EV.ANALOGY
      ? 'ANALOGY — retained and usable as a research target; not a causal claim'
      : 'GRADED at ' + weakest + ' by the corpus',
    mappingDirection: isResearch ? MAPPING_DIRECTION.NEURO_TO_BEHAVIOR : MAPPING_DIRECTION.BUSINESS_TO_NEURO,

    businessOpportunity: isResearch ? null : {
      what: 'Operational assessment of ' + (obs.title || obs.sourceRecordId) + ': ' + ch.issueCount +
            ' distinct failure modes across ' + ch.edgeCount + ' mapped dependencies.',
      why: cand.basis,
      deliverable: 'A dependency-and-failure brief naming the ' + Math.min(ch.issueCount, 6) +
                   ' highest-connectivity issues and what each one propagates into.'
    },
    researchOpportunity: !isResearch ? null : {
      what: 'Evidence-grading study for ' + (obs.title || obs.sourceRecordId) + '.',
      why: cand.basis,
      deliverable: 'A graded circuit table replacing ' + (present[EV.ANALOGY] || 0) +
                   ' ungraded brain-region mappings with sourced evidence or an explicit refutation.'
    },

    prediction: predicted,
    horizon: { kind: 'corpus-subtree-read', descendantsRequired: 1 },
    uncertainty: {
      evidenceRatio: ch.evidenceRatio,
      claimCount: circuits.length,
      populationZ: cand.zUsed,
      why: 'ranked against ' + ctx.populationN + ' peer nodes; departure in the brain\'s own sd units'
    },

    intendedConsumer: isResearch
      ? 'internal research queue — a grading study, not a customer deliverable'
      : 'internal opportunity queue — a human reviews before any outward contact',
    outcomeGrader: 'corpus-subtree-measurement',
    outcomeGraderNote: 'RESOLVED FROM HELD-OUT CORPUS DATA the ranker had not read at prediction ' +
                       'time. This is a real measurement, NOT a market outcome — nobody bought ' +
                       'anything, and this packet is not evidence that a buyer values it.',
    actionAuthority: AUTHORITY.INTERNAL_RECOMMENDATION,

    rankScore: cand.strength,
    rankBasis: cand.basis
  };
}

module.exports = {
  MAPPING_DIRECTION: MAPPING_DIRECTION,
  AUTHORITY: AUTHORITY,
  candidatesFrom: candidatesFrom,
  packet: packet
};
