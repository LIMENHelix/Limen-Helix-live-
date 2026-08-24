'use strict';

/**
 * Production-shaped, paper-only investment replay preflight.
 *
 * This module does not select a trade, call a model, call a broker, or write
 * state. It joins read-only captures from the domain packet, brain shadow,
 * domain snapshot, and the current master inbox so a sandbox run can report
 * exactly which inputs are present and which are missing.
 */

var MODULE = 'investment-sandbox-replay/1.0';
var Ledger = require('./finance-input-ledger.js');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function array(value) { return Array.isArray(value) ? value : []; }

function financeCycle(shadow) {
  return shadow && shadow.cycles && shadow.cycles.finance || null;
}

function financePacket(handoff) {
  return array(handoff && handoff.packets).filter(function (p) {
    return p && p.domainId === 'finance';
  }).sort(function (a, b) {
    return Date.parse(b.generatedAt || '') - Date.parse(a.generatedAt || '');
  })[0] || null;
}

function financeCandidates(inbox) {
  return array(inbox && inbox.readyForAutofire).filter(function (item) {
    return item && item.status === 'READY_TO_FIRE' && item.lane === 'investment';
  }).slice(0, 25);
}

function financeSources(snapshot) {
  var domain = snapshot && snapshot.domains && snapshot.domains.finance;
  return array(domain && domain.sources);
}

function summarize(input) {
  input = input || {};
  var cycle = financeCycle(input.brainShadow);
  var packet = financePacket(input.handoff);
  var candidates = financeCandidates(input.masterInbox);
  var sources = financeSources(input.snapshot);
  var truth = packet && packet.truth || {};
  var fn = cycle && cycle.domainFunction || {};
  var evidence = fn.evidence || {};
  var blockers = [];

  if (!cycle || cycle.domain !== 'finance' || cycle.ok !== true) blockers.push('finance_cycle_missing_or_not_ok');
  if (!evidence.l3CurrentEvidenceComplete) blockers.push('finance_cycle_l3_evidence_incomplete');
  if (!evidence.outwardConnected) blockers.push('finance_cycle_has_no_outward_consumer');
  if (!packet || packet.sourceType !== 'server-cognition-refresh') blockers.push('finance_packet_missing_or_untrusted');
  if (!array(truth.opportunities).length) blockers.push('finance_packet_has_no_opportunity');
  if (!candidates.length) blockers.push('master_inbox_has_no_ready_investment_candidate');
  if (!sources.length) blockers.push('finance_feed_sources_missing');

  // The current production packet carries feed health and aggregate truth, not
  // the source-level semantic observations needed to draft a thesis.
  var semanticEvidence = input.semanticEvidence || (packet && packet.truth && packet.truth.semanticEvidence);
  if (!array(semanticEvidence).length) {
    blockers.push('semantic_feed_evidence_not_carried_into_packet');
  }

  // The current autofire path does not attach measured market-data values to
  // its candidate. A replay must abstain until a named, timestamped snapshot
  // is supplied by the caller.
  if (!input.marketData || !input.marketData.asOf || !array(input.marketData.sources).length) {
    blockers.push('market_data_snapshot_not_supplied');
  }

  var selected = candidates[0] || null;
  var inputLedger = Ledger.build({
    // Production callers may omit this and use the real clock.  Tests and
    // recorded replays can pin the evaluation instant so freshness decisions
    // remain reproducible rather than drifting as the suite runs later.
    now: input.now || (packet && packet.generatedAt) || undefined,
    financeCycle: cycle,
    financePacket: packet,
    company: selected ? { slug: selected.portalSlug, ticker: selected.portalTicker } : null,
    candidate: selected,
    // The current production packet does not yet carry these records.  Keep
    // the absence explicit so the replay cannot manufacture a ready result.
    semanticEvidence: semanticEvidence,
    marketData: input.marketData,
    networkEvidence: input.networkStress ? [input.networkStress] : [],
    thing1: input.thing1 || { applicable: false, reason: 'not-supplied-by-replay-caller' },
    thing2: input.thing2 || input.kernelSnapshot || { applicable: false, reason: 'not-supplied-by-replay-caller' }
  });
  return {
    schemaVersion: MODULE,
    simulationOnly: true,
    executionMode: 'paper',
    liveExecution: false,
    brokerOrderSubmitted: false,
    inputLedger: {
      status: inputLedger.status,
      blockers: inputLedger.blockers,
      schemaVersion: inputLedger.schemaVersion
    },
    finance: {
      cycle: cycle ? {
        ok: cycle.ok === true,
        startedAt: cycle.startedAt || null,
        finishedAt: cycle.finishedAt || null,
        phase: truth.phase || null,
        stressScore: typeof truth.stressScore === 'number' ? truth.stressScore : null,
        confidence: typeof truth.confidence === 'number' ? truth.confidence : null,
        activeDiagnoses: array(truth.activeDiagnoses).length,
        opportunities: array(truth.opportunities).length,
        l3CurrentEvidenceComplete: evidence.l3CurrentEvidenceComplete === true,
        outwardConnected: evidence.outwardConnected === true
      } : null,
      feedSourceCount: sources.length,
      feedHealth: truth.feedHealth || null,
      candidate: selected ? {
        artifactRef: selected.artifactRef || null,
        portalSlug: selected.portalSlug || null,
        ticker: selected.portalTicker || null,
        patternId: selected.patternId || null,
        phase: selected.phase || null,
        fireScore: selected.fireScore == null ? null : selected.fireScore,
        sourceIdentity: selected.artifactRef ? { kind: 'master-inbox-artifact', value: selected.artifactRef } : null
      } : null
    },
    inputCoverage: {
      domainCycle: !!cycle,
      domainPacket: !!packet,
      sourceFeedRows: sources.length > 0,
      semanticFeedEvidence: !!(packet && packet.truth && array(packet.truth.semanticEvidence).length),
      networkStress: !!input.networkStress,
      kernelSnapshot: !!input.kernelSnapshot,
      bridgePattern: !!(selected && selected.patternId),
      marketData: !!(input.marketData && input.marketData.asOf && array(input.marketData.sources).length)
    },
    blockers: blockers,
    status: blockers.length ? 'ABSTAINED' : 'READY_FOR_PAPER_SIMULATION'
  };
}

module.exports = {
  MODULE: MODULE,
  summarize: summarize,
  financeCycle: financeCycle,
  financePacket: financePacket,
  financeCandidates: financeCandidates
};
