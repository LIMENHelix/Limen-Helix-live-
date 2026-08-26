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
  assert.equal(gate.receipt.observersRemainOpen, true);
  assert.equal(gate.receipt.recoveryRemainsOpen, true);

  await Control.set(Control.GLOBAL_ID, 'OPEN', 'test-master', s, Date.parse('2026-08-26T19:13:00Z'));
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
  console.log('civilization valve control: 21 separate lane lines across 20 brains, verified receipts, emergency inhibition, and fail-closed dispatch passed');
})().catch(function (error) { console.error(error); process.exit(1); });
