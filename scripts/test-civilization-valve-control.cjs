'use strict';

const assert = require('node:assert/strict');
const Registry = require('../lib/civilization-valve-registry.js');
const Control = require('../lib/civilization-valve-control.js');

function store() {
  const values = new Map(), lists = new Map();
  return {
    values, lists,
    assertDurable() { return true; },
    async get(k) { return values.has(k) ? JSON.parse(JSON.stringify(values.get(k))) : null; },
    async set(k, v) { values.set(k, JSON.parse(JSON.stringify(v))); return true; },
    async lpush(k, v) { const a = lists.get(k) || []; a.unshift(JSON.parse(JSON.stringify(v))); lists.set(k, a); return a.length; },
    async ltrim(k, a, b) { lists.set(k, (lists.get(k) || []).slice(a, b + 1)); return true; }
  };
}

(async function () {
  assert.equal(Registry.LINES.length, 21, 'each external lane has its own line; Finance currently has broker and subscriber lanes');
  assert.equal(new Set(Registry.LINES.map(x => x.id)).size, 21, 'valve identities are unique');
  assert.equal(Registry.get('finance:subscriber-email').ownerDomain, 'finance');
  assert.equal(Registry.forCandidate({ recommendedLane: 'research', domain: 'science' }), 'science:research-papers');
  assert.equal(Registry.forCandidate({ recommendedLane: 'research', domain: 'medicine' }), 'medicine:research-papers');
  assert.equal(Registry.forCandidate({ recommendedLane: 'investment', domain: 'finance' }), 'finance:broker-order');
  assert.equal(Registry.forRoute('trade-auction-cycle'), 'trade:auction');
  assert.equal(Registry.forRoute('finance-position-owner'), 'finance:broker-order');

  const s = store();
  let gate = await Control.authorize('science:research-papers', s);
  assert.equal(gate.allowed, true, 'absent runtime receipt follows the hard gate');
  const closed = await Control.set('science:research-papers', 'CLOSED', 'test-master', s, Date.parse('2026-08-26T19:10:00Z'));
  assert.equal(closed.runtimeMode, 'CLOSED');
  assert.equal((await s.get(Control.key('science:research-papers'))).receiptId, closed.receiptId, 'write is independently read back');
  gate = await Control.authorize('science:research-papers', s);
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, 'domain-runtime-valve-closed');

  await Control.set('science:research-papers', 'OPEN', 'test-master', s, Date.parse('2026-08-26T19:11:00Z'));
  await Control.set(Control.GLOBAL_ID, 'CLOSED', 'test-master', s, Date.parse('2026-08-26T19:12:00Z'));
  gate = await Control.authorize('finance:broker-order', s);
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, 'global-emergency-valve-closed');
  assert.equal(gate.receipt.observersRemainOpen, false);
  assert.equal(gate.receipt.recoveryRemainsOpen, false);
  assert.equal(gate.receipt.displayName, 'NUKE');
  assert.equal(gate.receipt.controlScope, 'EXTERNAL_OPERATOR_ONLY');

  await assert.rejects(
    Control.set(Control.GLOBAL_ID, 'OPEN', 'test-master', s, Date.parse('2026-08-26T19:13:00Z')),
    /cannot reopen directly/
  );
  let activity = await Control.authorizeActivity('brain-cognition-refresh', 'GET', s);
  assert.equal(activity.allowed, false);
  assert.equal(activity.nukeStage, 'NUKED');

  await Control.advanceNuke('DIAGNOSTIC_READ_ONLY', 'test-master', s, Date.parse('2026-08-26T19:13:10Z'));
  assert.equal((await Control.authorizeActivity('audit-ledger', 'GET', s)).allowed, true);
  assert.equal((await Control.authorizeActivity('audit-ledger', 'POST', s)).allowed, false);
  assert.equal((await Control.authorizeActivity('brain-cognition-refresh', 'GET', s)).allowed, false);

  await Control.advanceNuke('SENSING_ONLY', 'test-master', s, Date.parse('2026-08-26T19:13:20Z'));
  assert.equal((await Control.authorizeActivity('limen-worker-ingest', 'GET', s)).allowed, true);
  assert.equal((await Control.authorizeActivity('brain-cognition-refresh', 'GET', s)).allowed, false);

  await Control.advanceNuke('INTERNAL_COGNITION', 'test-master', s, Date.parse('2026-08-26T19:13:30Z'));
  assert.equal((await Control.authorizeActivity('brain-cognition-refresh', 'GET', s)).allowed, true);
  assert.equal((await Control.authorizeActivity('finance-paper-cycle', 'GET', s)).allowed, false);

  await Control.advanceNuke('SANDBOX_MOTOR', 'test-master', s, Date.parse('2026-08-26T19:13:40Z'));
  assert.equal((await Control.authorizeActivity('kernel-experiment', 'POST', s)).allowed, true);
  assert.equal((await Control.authorizeActivity('finance-paper-cycle', 'GET', s)).allowed, false);

  await Control.advanceNuke('DOMAIN_RECOMMISSION', 'test-master', s, Date.parse('2026-08-26T19:13:50Z'));
  gate = await Control.authorize('finance:broker-order', s);
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, 'post-nuke-domain-recommission-required');
  await Control.set('finance:broker-order', 'OPEN', 'test-master', s, Date.parse('2026-08-26T19:14:00Z'));
  assert.equal((await Control.authorize('finance:broker-order', s)).allowed, true);
  assert.equal((await Control.authorize('science:research-papers', s)).reason, 'post-nuke-domain-recommission-required');

  await Control.advanceNuke('OPEN', 'test-master', s, Date.parse('2026-08-26T19:14:10Z'));
  s.values.set('research_paper_developmental_slot:science', {
    schemaVersion: 'research-paper-developmental-authority/1.0', productDomain: 'science', ownerDomain: 'research',
    status: 'ARTIFACT_PERSISTED', paperOnly: true, liveMoney: false, artifactGenerationOnly: true,
    publicationAuthorized: false, outputId: 'science-artifact', resolvedAt: '2026-08-26T19:05:48.084Z'
  });
  s.values.set('finance_sandbox_commissioning', {
    schemaVersion: 'finance-sandbox-commissioning/1.0', status: 'VERIFIED_ZERO_EFFECT_ROLLBACK',
    paperOnly: true, liveMoney: false, effectExecuted: false, executedQuantity: 0,
    verifiedAt: '2026-08-25T18:56:31.865Z'
  });
  const snap = await Control.snapshot({
    LIMEN_AUTONOMY_ENABLED: '1', LIMEN_AI_ENABLED: '1',
    LIMEN_SCIENCE_RESEARCH_DEVELOPMENTAL_ENABLED: '1'
  }, s);
  assert.equal(snap.lines.length, 21);
  assert.equal(snap.emergency.displayName, 'NUKE');
  assert.equal(snap.emergency.internalNeuralHomolog, false);
  assert.deepEqual(snap.emergency.preserves, ['persisted state', 'weights', 'ledgers', 'receipts', 'decision traces']);
  assert.deepEqual(snap.emergency.recoverySequence, Control.NUKE_STAGES);
  assert.equal(snap.buildSummary.sourceChainsImplemented, 21);
  assert.equal(snap.buildSummary.currentJob7Pilots, 3);
  assert.equal(snap.buildSummary.sequencedAfterJobs7And8, 18);
  assert.equal(snap.buildSummary.externallyAutonomous, 0);
  assert.equal(snap.lines.find(x => x.productDomain === 'science').effectiveEligibilityOpen, true);
  assert.equal(snap.lines.find(x => x.productDomain === 'science').build.sequence, 'JOB_7_CURRENT');
  assert.equal(snap.lines.find(x => x.productDomain === 'science').build.durableProof.artifactPersisted, true);
  assert.equal(snap.lines.find(x => x.productDomain === 'medicine').build.durableProof.status, 'NOT_CLAIMED');
  assert.equal(snap.lines.find(x => x.productDomain === 'finance').build.durableProof.verified, true);
  assert.equal(snap.lines.find(x => x.productDomain === 'religion').build.sequence, 'JOB_9_AFTER_JOBS_7_8');
  assert.equal(snap.lines.find(x => x.productDomain === 'medicine').effectiveEligibilityOpen, false);
  assert.equal(JSON.stringify(snap).includes('secret-value'), false, 'snapshot exposes gate booleans, never values');

  const failed = await Control.authorize('science:research-papers', { assertDurable() { throw new Error('down'); } });
  assert.equal(failed.allowed, false);
  assert.equal(failed.reason, 'valve-control-unavailable-fail-closed');
  const controlRoute = await Control.authorizeActivity('civilization-valves', 'GET', { assertDurable() { throw new Error('down'); } });
  assert.equal(controlRoute.allowed, true, 'external operator NUKE route must remain reachable during control-store failure');
  console.log('civilization valve control: 21 local lines, total NUKE suppression, preserved state, ordered re-entry, and post-NUKE recommission passed');
})().catch(function (error) { console.error(error); process.exit(1); });
