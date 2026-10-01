'use strict';
// Identified fixtures only: execute the real selection/command/outcome/read
// consumers, never a provider, broker, publication or Agriculture motor.
const assert = require('node:assert/strict');
const Bridge = require('../lib/autofire-domain-bridge.js');
const Learning = require('../lib/autofire-learning.js');
const Efference = require('../lib/autofire-efference.js');
const Autofire = require('../handlers/limen-worker-autofire.js');
const Projection = require('../lib/brain-cognition-compact.js');
class Store {
  constructor(values) { this.values = new Map(values || []); this.lists = new Map(); this.failCause = false; this.failReturn = false; }
  assertDurable() {}
  async get(key) { return this.values.has(key) ? JSON.parse(JSON.stringify(this.values.get(key))) : null; }
  async set(key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); return true; }
  async setIfAbsent(key, value) { if (this.failCause && key.startsWith('autofire_learning_cause:')) return false;
    if (this.failReturn && key.startsWith('autofire_routed_outcome_receipt:')) return false;
    if (this.values.has(key)) return false; return this.set(key, value); }
  async lpush(key, value) { const rows = this.lists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); this.lists.set(key, rows); return rows.length; }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return true; }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
}
const cycle = owner => ({ domain: owner, ok: true, startedAt: 100, cursorAfter: 99,
  domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true } } });
const candidate = lane => Autofire.selectionCandidate({ domain: 'agriculture', recommendedLane: lane,
  subjectId: 'agriculture:identified-opportunity-1', source: 'master-inbox', id: 'agri-opportunity-1',
  sourceArtifactRef: 'agriculture:opportunity:1', sourcePacketId: 'agriculture:server-packet-1',
  masterGate: { confidence: 0.95, readiness: 0.95, salience: 0.95, completeness: 1 } });
const evaluated = progress => ({ progress, evidenceIds: ['independent-study-1'],
  independenceAssessment: { status: 'ESTABLISHED' },
  mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true,
    kernel_dynamics: true, p0_p10_proof_and_effects: true } });
(async () => {
  const store = new Store();
  const incompleteCycle = cycle('research'); incompleteCycle.startedAt = 99;
  incompleteCycle.domainFunction.evidence.l3CurrentEvidenceComplete = false;
  const held = await Bridge.select(store, { lane: 'research', candidate: candidate('research'), domainCycle: incompleteCycle, at: 999 });
  assert.equal(held.receipt.status, 'HELD');
  assert.equal((await Learning.recordCommand(store, { selection: held.receipt,
    efferenceCopy: { id: 'held-copy', actionId: 'held-action', emittedAt: 999 } })).error, 'command_has_no_released_domain_selection');
  const selected = await Bridge.select(store, { lane: 'research', candidate: candidate('research'), domainCycle: cycle('research'), at: 1000 });
  assert.equal(selected.receipt.status, 'RELEASED');
  assert.equal(selected.receipt.ownerDomain, 'research');
  assert.equal(selected.receipt.routing.originDomain, 'agriculture');
  assert.equal((await store.get('autofire_selection:' + selected.receipt.id)).routing.sourcePacketId, 'agriculture:server-packet-1');
  const command = await Efference.command(store, { lane: 'research', subjectId: 'agriculture:identified-opportunity-1',
    sourceIdentity: selected.receipt.candidate.sourceIdentity, emittedAt: 1001 });
  assert.equal(command.ok, true);
  store.failCause = true;
  const spec = { selection: selected.receipt, efferenceCopy: command.copy };
  assert.equal((await Learning.recordCommand(store, spec)).ok, false, 'no dispatchable success without cause readback');
  store.failCause = false;
  assert.equal((await Learning.recordCommand(store, spec)).ok, true, 'retry repairs cause after state-only write');
  const persistedCause = await store.get(Learning.causeKey(command.copy.actionId));
  assert.equal(persistedCause.decisionTrace.sourceDomains[0].sourceDomain, 'agriculture');
  assert.equal(persistedCause.decisionTrace.sourceDomains[0].sourcePacketId, 'agriculture:server-packet-1');
  const output = await Efference.resolve(store, command.copy, { ok: true, skipped: false, outputId: 'fixture-research-artifact-1', wordCount: 900 }, 1002);
  assert.equal(output.status, 'EXECUTED');
  const event = { eventId: 'independent-evaluation-1', eventType: 'OUTCOME_RESEARCH_EVALUATED',
    ownerDomain: 'research', lane: 'research', actionId: command.copy.actionId, ts: 1100,
    sourceIdentity: { kind: 'external-evaluator', value: 'independent-panel-1' }, outcomeData: evaluated('REGRESSION') };
  const incomplete = await Learning.recordOutcome(store, { ...event, eventId: 'incomplete-evaluation', outcomeData: { progress: 'PROGRESS' } });
  assert.equal(incomplete.assessment.graded, false);
  assert.equal((await Learning.readAgricultureReturns(store)).returnedCount, 0);
  const result = await Learning.recordOutcome(store, event);
  assert.equal(result.ok, true); assert.equal(result.assessment.reward, -1);
  assert.equal(result.routedOutcome.ownerDomain, 'research');
  assert.equal(result.routedOutcome.authority.originRewardAuthorized, false);
  assert.equal(result.externalLearningSignal.ownerDomain, 'research');
  assert.equal((await Learning.recordOutcome(store, event)).duplicate, true);
  const restarted = new Store([...store.values]);
  const returned = await Learning.readAgricultureReturns(restarted);
  assert.equal(returned.status, 'OBSERVED'); assert.equal(returned.returnedCount, 1);
  assert.equal(returned.latest.actionId, command.copy.actionId);
  assert.equal(returned.latest.sourceDomains[0].opportunityId, 'agri-opportunity-1');
  const rollover = await restarted.get(Learning.stateKey('research')); rollover.commands = []; rollover.processedOutcomeIds = [];
  await restarted.set(Learning.stateKey('research'), rollover);
  assert.equal((await Learning.readAgricultureReturns(restarted)).returnedCount, 1, 'permanent cause survives bounded episode/index decay');
  assert.equal((await Learning.recordOutcome(restarted, event)).duplicate, true, 'permanent routed receipt prevents reward replay after index decay');
  assert.equal((await Learning._load(restarted, 'research')).externalLearning.resolvedCount, 1);
  const expiredIndexes = new Store([...restarted.values]);
  const oldState = await expiredIndexes.get(Learning.stateKey('research')); oldState.routedOutcomes = [];
  await expiredIndexes.set(Learning.stateKey('research'), oldState);
  assert.equal((await Learning.recordOutcome(expiredIndexes, event)).duplicate, true,
    'permanent receipt prevents reward replay after all bounded return indexes decay');
  const next = await Bridge.select(restarted, { lane: 'research', candidate: candidate('research'), domainCycle: cycle('research'), at: 1101 });
  assert.equal(next.receipt.ownerDomain, 'research');
  assert(next.receipt.criticDecision.ranked.some(row => row.kind === 'generate_research_artifact' && row.historicalEffect === -1));
  assert.equal(await restarted.get(Learning.stateKey('agriculture')), null, 'no borrowed Agriculture learner');
  const wrongOwner = await Learning.recordOutcome(restarted, { ...event, eventId: 'wrong-owner', ownerDomain: 'health' });
  assert.equal(wrongOwner.ok, false); assert.equal(wrongOwner.error, 'outcome_command_owner_or_lane_mismatch');
  const changedOrigin = JSON.parse(JSON.stringify(selected.receipt)); changedOrigin.routing.sourcePacketId = 'different-packet';
  assert.equal((await Learning.recordCommand(restarted, { selection: changedOrigin, efferenceCopy: command.copy })).error, 'command_origin_provenance_mismatch');

  // Finance's sovereign decision supplies sourceDomains through its existing
  // selection evidence (rather than the research worker routing seam).
  const investment = await Bridge.select(restarted, { lane: 'investment', candidate: candidate('investment'), domainCycle: cycle('finance'), at: 1200 });
  investment.receipt.evidence.sourceDomains = [{ sourceDomain: 'agriculture', sourcePacketId: 'agri-finance-packet-1', opportunityId: 'agri-investment-1' }];
  delete investment.receipt.routing;
  const financeCopy = { id: 'fixture-finance-efference', actionId: 'fixture-finance-action', emittedAt: 1201 };
  assert.equal((await Learning.recordCommand(restarted, { selection: investment.receipt, efferenceCopy: financeCopy })).ok, true);
  const pnl = await Learning.recordOutcome(restarted, { eventId: 'independent-paper-account-1', actionId: financeCopy.actionId,
    ownerDomain: 'finance', lane: 'investment', eventType: 'OUTCOME_INVESTMENT_PNL', ts: 1300,
    sourceIdentity: { kind: 'tradier-sandbox-account-and-market', value: 'fixture-independent-account-1' },
    outcomeData: { horizonDays: 30, investedAmount: 100, netPnl: 10, returnPct: 10, benchmarkReturnPct: 1,
      maxDrawdownPct: 0, riskBreach: false, executionMode: 'paper', brokerOrderId: 'fixture-paper-order-1' } });
  assert.equal(pnl.routedOutcome.ownerDomain, 'finance');
  assert.equal(pnl.routedOutcome.ownerLearningApplied, false, 'single PNL is observation, not a qualified investment cohort');
  assert.equal((await Learning.readAgricultureReturns(restarted)).returnedCount, 2);
  const view = Projection.learningReadout({ domain: 'agriculture', status: 'ABSTAINED', resolvedCount: 0,
    learningGate: { ready: false }, routedOutcomeReturn: await Learning.readAgricultureReturns(restarted) });
  assert.equal(view.latestSignalId, null); assert.equal(view.learningGate.ready, false);
  assert.equal(view.routedOutcomeReturn.latest.ownerDomain, 'finance');
  const storePath = require.resolve('../lib/autofire-efference-store.js');
  const handlerPath = require.resolve('../handlers/product-domain-learning-state.js');
  const originalStoreModule = require.cache[storePath], originalHandlerModule = require.cache[handlerPath];
  try {
    require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: restarted };
    delete require.cache[handlerPath];
    const handler = require(handlerPath);
    const response = { statusCode: 200, setHeader() {}, end(value) { this.body = JSON.parse(value); } };
    await handler({ method: 'GET', url: '/api/product-domain-learning-state?domain=agriculture' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, 'ABSTAINED');
    assert.equal(response.body.signal, null);
    assert.equal(response.body.learningGate.ready, false);
    assert.equal(response.body.routedOutcomeReturn.returnedCount, 2);
    assert.equal(response.body.routedOutcomeReturn.latest.ownerDomain, 'finance');
  } finally {
    if (originalStoreModule) require.cache[storePath] = originalStoreModule; else delete require.cache[storePath];
    if (originalHandlerModule) require.cache[handlerPath] = originalHandlerModule; else delete require.cache[handlerPath];
  }
  restarted.failReturn = true;
  const progressEvent = { ...event, eventId: 'independent-progress-2', ts: 1400, outcomeData: evaluated('PROGRESS') };
  const failedReceipt = await Learning.recordOutcome(restarted, progressEvent);
  assert.equal(failedReceipt.ok, false); assert.equal(failedReceipt.queuedForRetry, true);
  assert.equal((await Learning._load(restarted, 'research')).externalLearning.resolvedCount, 2);
  restarted.failReturn = false;
  const recoveredReceipt = await Learning.recordOutcome(restarted, progressEvent);
  assert.equal(recoveredReceipt.ok, true); assert.equal(recoveredReceipt.duplicate, true);
  assert.equal((await Learning._load(restarted, 'research')).externalLearning.resolvedCount, 2,
    'repair of the durable return receipt cannot duplicate the already-applied reward');
  assert.equal((await Learning.readAgricultureReturns(restarted)).latest.outcome, 'PROGRESS');
  const state = await restarted.get(Learning.stateKey('finance')); state.routedOutcomes[0].ownerDomain = 'health';
  await restarted.set(Learning.stateKey('finance'), state);
  const partial = await Learning.readAgricultureReturns(restarted);
  assert.equal(partial.status, 'PARTIAL'); assert.equal(partial.returnedCount, 2);
  assert.equal(partial.failures[0].ownerDomain, 'finance', 'bad Finance return cannot hide or adopt the valid Research observation');
  const legacyStore = new Store();
  const unlabeled = { ...candidate('research'), domain: 'research' }; delete unlabeled.originDomain;
  const legacySelection = await Bridge.select(legacyStore, { lane: 'research', candidate: unlabeled, domainCycle: cycle('research'), at: 1500 });
  assert.equal(legacySelection.receipt.routing, undefined, 'do not infer an origin from an artifact string or old metadata');
  const legacyCopy = { id: 'legacy-copy', actionId: 'legacy-action', emittedAt: 1501 };
  assert.equal((await Learning.recordCommand(legacyStore, { selection: legacySelection.receipt, efferenceCopy: legacyCopy })).ok, true);
  assert.equal((await Learning.recordOutcome(legacyStore, { ...event, eventId: 'legacy-event', actionId: legacyCopy.actionId, ts: 1502 })).ok, true);
  assert.equal((await Learning.readAgricultureReturns(legacyStore)).returnedCount, 0);
  console.log('PASS Agriculture routed source -> sovereign decision -> durable command/fixture receipt -> independent outcome -> owner learning/next critic -> origin observation, with replay and fail-closed boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
