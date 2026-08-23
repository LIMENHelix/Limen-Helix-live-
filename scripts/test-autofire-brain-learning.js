'use strict';

var POLICY = require('../brain-v2/core/outward-action-policy.js');
var BRIDGE = require('../lib/autofire-domain-bridge.js');
var LEARN = require('../lib/autofire-learning.js');
var SELECT = require('../brain-v2/kernel/select.js');

var passed = 0;
function assert(name, ok, detail) {
  if (!ok) throw new Error('FAIL ' + name + (detail ? ': ' + detail : ''));
  passed++;
}

function FakeStore() { this.values = Object.create(null); this.lists = Object.create(null); }
FakeStore.prototype.assertDurable = function () { return true; };
FakeStore.prototype.get = async function (k) { return this.values[k] === undefined ? null : JSON.parse(JSON.stringify(this.values[k])); };
FakeStore.prototype.set = async function (k, v) { this.values[k] = JSON.parse(JSON.stringify(v)); return true; };
FakeStore.prototype.del = async function (k) { delete this.values[k]; return 1; };
FakeStore.prototype.lpush = async function (k, v) { if (!this.lists[k]) this.lists[k] = []; this.lists[k].unshift(JSON.parse(JSON.stringify(v))); return this.lists[k].length; };
FakeStore.prototype.ltrim = async function (k, s, e) { this.lists[k] = (this.lists[k] || []).slice(s, e + 1); return true; };
FakeStore.prototype.lrange = async function (k, s, e) { return JSON.parse(JSON.stringify((this.lists[k] || []).slice(s, e + 1))); };

function cycle(domain) {
  return {
    domain: domain, ok: true, startedAt: 100, finishedAt: 110, cursorAfter: 99,
    relationshipEvidence: null,
    domainFunction: {
      evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true },
      outwardConsumersDeclared: 1
    }
  };
}

function candidate(domain, n) {
  return {
    cik: String(1000 + (n || 0)), ticker: 'T' + (n || 0), domain: domain,
    source: 'master-inbox', sourceArtifactRef: domain + '/research/' + (n || 0),
    _estimatedCostUsd: 0.30,
    masterGate: { confidence: 0.95, readiness: 0.95, salience: 0.90, completeness: 1 }
  };
}

function copy(lane, n) {
  return {
    id: 'eff_' + lane + '_' + n,
    actionId: 'act_' + lane + '_' + n,
    traceId: 'trace_' + lane + '_' + n,
    emittedAt: 1000 + n
  };
}

function fullResearchData(progress) {
  return {
    progress: progress,
    evidenceIds: ['doi:10.1/example', 'pmid:123'],
    independenceAssessment: { status: 'ESTABLISHED', method: 'ownership-and-syndication-reviewed' },
    mappingCoverage: {
      neurology_to_business_homology: true,
      business_to_neurology_homology: true,
      kernel_dynamics: true,
      p0_p10_proof_and_effects: true
    },
    contradictions: [], retractions: []
  };
}

function investmentData(horizon, pnl, ret, benchmark, breach) {
  return {
    horizonDays: horizon, investedAmount: 100, netPnl: pnl,
    returnPct: ret, benchmarkReturnPct: benchmark,
    maxDrawdownPct: -2, riskBreach: breach,
    executionMode: 'paper', brokerOrderId: 'paper-order-' + horizon
  };
}

async function main() {
  assert('investment owner is finance', POLICY.ownerFor('investment', 'technology') === 'finance');
  assert('science canonicalizes to research', POLICY.ownerFor('research', 'science') === 'research');
  assert('medicine canonicalizes to health', POLICY.ownerFor('research', 'medicine') === 'health');
  assert('trade cannot own research', POLICY.ownerFor('research', 'trade') === null);

  var held = POLICY.select({ lane: 'research', candidate: candidate('trade', 0), domainCycle: null, at: 1 });
  assert('non-science research is held', held.status === 'HELD');
  assert('hold names domain mismatch', held.reasons.indexOf('research_subject_not_science_or_medicine') >= 0);

  var released = POLICY.select({
    lane: 'research', candidate: candidate('medicine', 1), domainCycle: cycle('health'),
    gate: SELECT.createGate(), modulation: {}, at: 2
  });
  assert('medicine research releases with current brain evidence', released.status === 'RELEASED', released.reasons.join(','));
  assert('B10 critic released the artifact rather than READY_TO_FIRE executing itself',
    released.criticDecision && released.criticDecision.outcome === 'released' &&
    released.criticDecision.released.kind === 'generate_research_artifact');
  assert('release is artifact-only', released.authority.artifactGenerationOnly === true);
  assert('release never authorizes live trading', released.authority.liveTradingAuthorized === false);
  assert('stress did not directly trigger', released.authority.stressDirectlyTriggered === false);
  assert('headline did not directly trigger', released.authority.headlineDirectlyTriggered === false);

  var noL3 = POLICY.select({
    lane: 'investment', candidate: candidate('technology', 2),
    domainCycle: { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: false, outwardConnected: true } } }, at: 3
  });
  assert('missing L3 evidence holds investment', noL3.status === 'HELD');

  var store = new FakeStore();
  var bridged = await BRIDGE.select(store, { lane: 'research', candidate: candidate('medicine', 1), domainCycle: cycle('health'), at: 4 });
  assert('bridge persists selection', bridged.ok && store.values['autofire_selection:' + bridged.receipt.id]);
  assert('bridge appends selection log', store.lists[BRIDGE.LOG_KEY].length === 1);

  var refused = await LEARN.recordCommand(store, { selection: held, efferenceCopy: copy('research', 0) });
  assert('held selection cannot become command episode', refused.ok === false);

  var cmd = await LEARN.recordCommand(store, { selection: bridged.receipt, efferenceCopy: copy('research', 1) });
  assert('released command enters durable learning', cmd.ok === true);
  var health = await LEARN._load(store, 'health');
  assert('command created one episode', health.memory.episodic.length === 1);
  assert('episode carries action identity', health.memory.episodic[0].actionId === copy('research', 1).actionId);
  assert('episode carries efference identity', health.memory.episodic[0].efferenceCopyId === copy('research', 1).id);

  var pub = await LEARN.recordOutcome(store, {
    eventId: 'evt_pub', eventType: 'OUTCOME_RESEARCH_PUBLISHED', lane: 'research', ownerDomain: 'health',
    actionId: copy('research', 1).actionId, ts: 2000, outcomeData: { evidenceIds: ['doi:x'] }
  });
  assert('publication event is preserved', pub.ok === true);
  assert('publication alone does not update B12', pub.b12Updated === false);
  assert('publication reason is explicit', pub.assessment.reasons[0] === 'publication_is_observation_not_proof_of_progress');

  var badResearch = LEARN.grade({ eventType: 'OUTCOME_RESEARCH_EVALUATED', lane: 'research', outcomeData: { progress: 'PROGRESS', evidenceIds: ['x'], mappingCoverage: fullResearchData('PROGRESS').mappingCoverage } });
  assert('research without independence is ungraded', badResearch.graded === false);

  var goodResearch = LEARN.grade({ eventType: 'OUTCOME_RESEARCH_EVALUATED', lane: 'research', outcomeData: fullResearchData('PROGRESS') });
  assert('fully evidenced research progress is graded', goodResearch.graded === true);
  assert('research progress reward is explicit +1', goodResearch.reward === 1);

  var missingInvestment = LEARN.grade({ eventType: 'OUTCOME_INVESTMENT_PNL', lane: 'investment', outcomeData: { netPnl: 1 } });
  assert('incomplete investment terms are ungraded', missingInvestment.graded === false);
  assert('missing horizon is named', missingInvestment.reasons.indexOf('horizonDays_must_be_30_60_or_90') >= 0);
  var win = LEARN.grade({ eventType: 'OUTCOME_INVESTMENT_PNL', lane: 'investment', outcomeData: investmentData(30, 5, 5, 2, false) });
  assert('profit plus outperformance is success', win.outcome === 'SUCCESS' && win.reward === 1);
  var loss = LEARN.grade({ eventType: 'OUTCOME_INVESTMENT_PNL', lane: 'investment', outcomeData: investmentData(60, -1, -1, -3, false) });
  assert('absolute loss is failure even if benchmark was worse', loss.outcome === 'FAILURE' && loss.reward === -1);
  var breach = LEARN.grade({ eventType: 'OUTCOME_INVESTMENT_PNL', lane: 'investment', outcomeData: investmentData(90, 5, 5, 2, true) });
  assert('risk breach is failure despite profit', breach.outcome === 'FAILURE');

  // Five independent command/outcome episodes cross the existing B13 evidence floor.
  for (var i = 10; i < 15; i++) {
    var bridgedInvestment = await BRIDGE.select(store, {
      lane: 'investment', candidate: candidate('technology', i), domainCycle: cycle('finance'), at: 3000 + i
    });
    assert('investment candidate ' + i + ' passes the persistent B10 gate',
      bridgedInvestment.ok && bridgedInvestment.receipt.status === 'RELEASED',
      bridgedInvestment.ok ? bridgedInvestment.receipt.reasons.join(',') : bridgedInvestment.error);
    var sel = bridgedInvestment.receipt;
    var cp = copy('investment', i);
    var cr = await LEARN.recordCommand(store, { selection: sel, efferenceCopy: cp });
    assert('investment command ' + i + ' recorded', cr.ok === true);
    var er = await LEARN.recordOutcome(store, {
      eventId: 'evt_inv_' + i, eventType: 'OUTCOME_INVESTMENT_PNL', lane: 'investment', ownerDomain: 'finance',
      actionId: cp.actionId, ts: 4000 + i, outcomeData: investmentData(i < 12 ? 30 : (i < 14 ? 60 : 90), 5, 5, 2, false)
    });
    assert('investment outcome ' + i + ' updates B12', er.ok && er.b12Updated === true);
  }
  var finance = await LEARN._load(store, 'finance');
  assert('five real rewards entered B12 history', finance.modulators.rewardHistory.length === 5);
  assert('five commands and five returned outcomes remain episodic before consolidation', finance.memory.episodic.length === 10);

  var consolidated = await LEARN.consolidateDomain(store, 'finance', 9999);
  assert('B13 ran in offline state', consolidated.result.ran === true);
  finance = await LEARN._load(store, 'finance');
  assert('B13 promoted repeated successful investment procedure', Object.keys(finance.memory.procedural).length === 1);
  var policy = finance.memory.procedural[Object.keys(finance.memory.procedural)[0]];
  assert('promoted policy remains internally scoped', policy.permissions.length === 1 && policy.permissions[0] === 'internal:attention');
  assert('promotion did not authorize trading', policy.permissions.indexOf('trade') < 0);

  var observationCount = finance.memory.candidates[0].observations.length;
  await LEARN.consolidateDomain(store, 'finance', 19999);
  finance = await LEARN._load(store, 'finance');
  assert('a second consolidation cannot count the same five episodes again',
    finance.memory.candidates[0].observations.length === observationCount,
    String(finance.memory.candidates[0].observations.length));
  assert('resolved outcomes reached the same persistent B10 critic used on the next command',
    finance.outwardGate.outcomeHistory.generate_investment_artifact.n === 5,
    JSON.stringify(finance.outwardGate.outcomeHistory));

  var swept = await LEARN.sweepOutcomes(store, 100);
  assert('outcome sweep is idempotent', swept.ok && swept.processed === 0 && swept.duplicates >= 6);

  console.log(passed + '/' + passed + ' passed');
}

main().catch(function (err) { console.error(err.stack || err); process.exit(1); });
