#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Context = require('../lib/finance-manager-context.js');
const Ledger = require('../lib/finance-input-ledger.js');
const Prompt = require('../lib/finance-manager-prompt.js');
const Runner = require('../lib/finance-manager-runner.js');

const semanticId = 'finance:runner:semantic';
const marketId = 'finance:runner:market';
const networkId = 'finance:runner:network';
const cycle = { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true } } };
const semantic = [{ sourceIdentity: { kind: 'publisher-item', value: semanticId }, recordedAt: '2026-08-24T16:00:00Z', publisher: 'Official feed', feedName: 'Official feed', title: 'Named event', canonicalUrl: 'https://example.test/event' }];
const market = { asOf: '2026-08-24T16:01:00Z', sources: ['paper-market'], quotes: [{ symbol: 'EX', price: 10, observedAt: '2026-08-24T16:01:00Z', sourceIdentity: { kind: 'market-quote', value: marketId } }] };
const network = [{ asOf: '2026-08-24T16:00:30Z', value: 0.1, sourceIdentity: { kind: 'network', value: networkId } }];
const managerContext = Context.build({ financeCycle: cycle, company: { slug: 'example_co', ticker: 'EX' }, observations: semantic, marketData: market, networkEvidence: network, kernelContext: { applicable: false, reason: 'not-applicable' } });
const ledger = Ledger.build({ financeCycle: cycle, financePacket: { sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:01:00Z' }, company: { slug: 'example_co', ticker: 'EX' }, semanticEvidence: semantic, marketData: market, networkEvidence: network, thing1: { applicable: false, reason: 'not-supplied' }, thing2: { applicable: false, reason: 'not-supplied' }, candidate: null, now: '2026-08-24T16:01:00Z' });
assert.equal(ledger.status, 'READY_FOR_MANAGER_REVIEW');

const proposal = { schemaVersion: Prompt.RESPONSE_SCHEMA, id: 'runner-proposal', company: { slug: 'example_co', ticker: 'EX' }, thesis: 'Bounded paper review.', invalidation: 'Invalidate on correction.', horizonDays: 30, scenarios: [{ name: 'base' }, { name: 'downside' }], evidenceRefs: [{ role: 'semantic', sourceIdentity: { kind: 'publisher-item', value: semanticId } }, { role: 'market', sourceIdentity: { kind: 'market-quote', value: marketId } }, { role: 'network', sourceIdentity: { kind: 'network', value: networkId } }], independenceAssessment: { status: 'UNASSESSED', reason: 'Not established.' }, paperOnly: true, provenance: { producer: 'runner-test', generatedAt: '2026-08-24T16:02:00Z' } };

(async function () {
  let calls = 0;
  const result = await Runner.run({ managerContext, ledger }, { provider: async function (input) { calls++; assert.equal(input.request.schemaVersion, Prompt.REQUEST_SCHEMA); assert.match(input.prompt, /finance-manager-request\/1\.0/); return { ok: true, provider: 'fixture', model: 'fixture', text: JSON.stringify(proposal) }; } });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'PAPER_CANDIDATE');
  assert.equal(result.candidate.liveExecution, false);
  assert.equal(result.candidate.blockers.length, 0);
  assert.equal(result.proposal.provenance.managerResponseSchema, Prompt.RESPONSE_SCHEMA);

  const disabled = await Runner.run({ managerContext, ledger }, { provider: async function () { return { ok: false, disabled: true }; } });
  assert.equal(disabled.status, 'ABSTAINED');
  assert.equal(disabled.reason, 'finance_manager_ai_disabled');

  const noLedger = await Runner.run({ managerContext, ledger: { schemaVersion: Ledger.SCHEMA, status: 'ABSTAINED' } }, { provider: async function () { throw new Error('must not call'); } });
  assert.equal(noLedger.status, 'ABSTAINED');
  assert.equal(noLedger.reason, 'finance_input_ledger_not_ready');

  const badResponse = await Runner.run({ managerContext, ledger }, { provider: async function () { return { ok: true, text: 'not json' }; } });
  assert.equal(badResponse.status, 'ABSTAINED');
  assert.equal(badResponse.reason, 'manager_response_must_be_json');

  console.log('finance manager runner: 12/12 passed');
})().catch(function (e) { console.error(e && e.stack || e); process.exit(1); });
