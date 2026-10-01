'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const el = { innerHTML: '' };
let fail = false;
const window = { addEventListener() {} };
const document = {
  readyState: 'loading', addEventListener() {},
  getElementById(id) { return id === 'execution-observatory' ? el : null; }
};
const cognition = { count: 1, newest: Date.now(), cognition: { finance: {
  ts: Date.now(), c: {
    motorCapabilityEvidence: { verified: true, validUntil: Date.now() + 60000 },
    externalValveEvidence: { eligible: true },
    motorReceiptPersistence: { ok: true, gates: { mayDispatchExternal: true } },
    brainOrgans: { externalActionLearning: {
      domain: 'finance', status: 'ABSTAINED', reason: 'independent-outcome-missing', resolvedCount: 0,
      learningGate: { ready: false }
    }, commercialReflex: { publicSocialOutcome: { normalizedCredit: 0.75, latestSignalId: 'learning-1' } } }
  }
} } };
cognition.cognition.energy = { ts: Date.now(), c: { brainOrgans: { externalActionLearning: {
  domain: 'energy', status: 'ABSTAINED', reason: 'no-owned-motor-outcome', resolvedCount: 0,
  financialAfferent: { status: 'ELIGIBLE', signalId: 'finance-to-energy-1', actionId: 'finance-command-1' }
} } } };
cognition.count = 2;
cognition.cognition.agriculture = { ts: Date.now(), c: { brainOrgans: { externalActionLearning: {
  domain: 'agriculture', status: 'ABSTAINED', reason: 'agriculture-routed-outcomes-are-observation-only',
  learningGate: { ready: false }, routedOutcomeReturn: { status: 'OBSERVED', returnedCount: 1, observationOnly: true,
    latest: { returnId: 'route-return-1', ownerDomain: 'research', actionId: 'research-action-1',
      sourceDomains: [{ sourceDomain: 'agriculture', sourcePacketId: 'agri-packet-1' }] } }
} } } };
cognition.count = 3;
cognition.cognition.finance.c.brainOrgans.autonomousInternalEmission = { emittedCount: 12, stagedCount: 3 };
cognition.cognition.finance.c.motorReceiptPersistence.gates.mayPrepare = true;
cognition.cognition.culture = { ts: Date.now(), c: { businessTrace: {
  schemaVersion: 'culture-business-trace-readout/1.0', ownerDomain: 'culture', lane: 'hero-image',
  status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
  decision: { id: 'culture-decision-1', status: 'NO_ACTION', packetId: 'culture-packet-1', decidedAt: Date.now() },
  command: { id: 'culture-command-1', status: 'AMBIGUOUS', decisionId: 'culture-prior-decision', commandedAt: Date.now(), providerReceiptId: null }
} } };
cognition.count = 4;
cognition.cognition.economy = { ts: Date.now(), c: { businessTrace: {
  schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'economy', lane: 'investments',
  status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
  decision: { id: 'economy-decision-1', status: 'RELEASED', packetId: 'economy-packet-1' },
  command: { id: 'economy-command-1', status: 'COMMAND_RECEIPTED', decisionId: 'economy-decision-1', paperOnly: true,
    receipt: { kind: 'PAPER-ORDER', id: 'paper-order-1' } }
} } };
cognition.cognition.defense = { ts: Date.now(), c: { businessTrace: {
  schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'defense', lane: 'publication',
  status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
  command: { id: 'defense-command-1', status: 'PUBLISHED', decisionId: 'defense-decision-1',
    receipt: { kind: 'OWNED-PUBLICATION', id: 'owned-article-1' } }
} } };
cognition.count = 6;
var operationKinds = { industry: 'CRM-ACCEPTED', intelligence: 'EMAIL-ACCEPTED', law: 'LETTER-ACCEPTED',
  infrastructure: 'INQUIRY-ACCEPTED', population: 'INQUIRY-ACCEPTED' };
Object.keys(operationKinds).forEach(function (domain) {
  cognition.cognition[domain] = { ts: Date.now(), c: { businessTrace: {
    schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: domain,
    status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
    decision: { id: domain + '-decision', status: 'NO_ACTION', reason: 'independent-negative-outcome', blockers: ['reassessment-required'] },
    command: { id: domain + '-command', status: 'ACCEPTED', decisionId: domain + '-prior-decision',
      nonBinding: /population|infrastructure/.test(domain), commissioningOnly: domain === 'intelligence',
      receipt: { kind: operationKinds[domain], id: domain + '-receipt' } }
  } } };
});
cognition.count = 11;
cognition.cognition.trade = { ts: Date.now(), c: { businessTrace: {
  schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'supplyChain', lane: 'auction',
  status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
  command: { id: 'trade-command', status: 'LISTED', decisionId: 'trade-decision', listingOnly: true,
    receipt: { kind: 'OWNED-LISTING', id: 'listing-001' } }
} } };
cognition.cognition.communication = { ts: Date.now(), c: { businessTrace: {
  schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'communication', lane: 'social',
  status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
  command: { id: 'social-command', status: 'POSTED', decisionId: 'social-decision', receipt: { kind: 'PLATFORM-POST', id: 'at://fixture/post/1' } }
} } };
cognition.cognition.religion = { ts: Date.now(), c: { businessTrace: {
  schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'religion', lane: 'subscriber-email',
  status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
  command: { id: 'batch-command', status: 'RECEIPTS_PERSISTED', receipt: { kind: 'EMAIL-BATCH', id: 'batch-command', acceptedCount: 1, itemCount: 2 },
    items: [{ actionId: 'item-1', decisionId: 'item-decision-1', status: 'ACCEPTED', receipt: { id: 'email-1', commandId: 'original-batch' } },
      { actionId: 'item-2', decisionId: 'item-decision-2', status: 'BUDGET_HELD', receipt: null }] }
} } };
cognition.count = 14;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/civilization/execution-observatory.js'), 'utf8'), {
  window, document, Date, setInterval() {},
  fetch: async url => {
    if (fail && url.includes('autofire')) throw Error('audit unavailable');
    return { ok: true, json: async () => url.includes('brain-cognition') ? cognition : {} };
  }
});
(async () => {
  await window.LIMENExecutionObservatory.refresh();
  assert.match(el.innerHTML, /EXTERNAL-READY/);
  var financeCard = el.innerHTML.split('<span class="exo-domain-name">finance</span>')[1].split('</article>')[0];
  ['DECIDED', 'COMMAND', 'RECEIPT'].forEach(function (stage) {
    assert.match(financeCard, new RegExp('exo-chain-label">' + stage + '</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
  });
  assert.match(financeCard, /internal emission <b>12/);
  assert.match(financeCard, /preparation PERMITTED/);
  var tradeCard = el.innerHTML.split('<span class="exo-domain-name">trade</span>')[1].split('</article>')[0];
  assert.match(tradeCard, /OWNED-LISTING/); assert.match(tradeCard, /sale, order acceptance and payment are not authorized/);
  var religionCard = el.innerHTML.split('<span class="exo-domain-name">religion</span>')[1].split('</article>')[0];
  assert.match(religionCard, /EMAIL-BATCH/); assert.match(religionCard, /BUDGET_HELD/); assert.match(religionCard, /original-batch/);
  ['trade', 'religion', 'communication'].forEach(function (domain) {
    var card = el.innerHTML.split('<span class="exo-domain-name">' + domain + '</span>')[1].split('</article>')[0];
    ['OBSERVED', 'REVENUE'].forEach(function (stage) { assert.match(card, new RegExp('exo-chain-label">' + stage + '</span><span class="exo-badge exo-unobserved">UNOBSERVED')); });
  });
  Object.keys(operationKinds).forEach(function (domain) {
    var card = el.innerHTML.split('<span class="exo-domain-name">' + domain + '</span>')[1].split('</article>')[0];
    assert.match(card, new RegExp(operationKinds[domain])); assert.match(card, new RegExp(domain + '-prior-decision'));
    assert.match(card, /independent-negative-outcome/); assert.match(card, /reassessment-required/);
    ['OBSERVED', 'REVENUE'].forEach(function (stage) {
      assert.match(card, new RegExp('exo-chain-label">' + stage + '</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
    });
    if (/population|infrastructure/.test(domain)) assert.match(card, /NON-BINDING INQUIRY/);
    if (domain === 'intelligence') assert.match(card, /COMMISSIONING ONLY/);
  });
  var economyCard = el.innerHTML.split('<span class="exo-domain-name">economy</span>')[1].split('</article>')[0];
  assert.match(economyCard, /PAPER-ORDER/); assert.match(economyCard, /PAPER ONLY/);
  assert.match(economyCard, /exo-badge exo-paper">PAPER/);
  assert.doesNotMatch(economyCard, /PROVIDER-ACCEPTED/);
  assert.match(economyCard, /exo-chain-label">REVENUE<\/span><span class="exo-badge exo-unobserved">UNOBSERVED/);
  var defenseCard = el.innerHTML.split('<span class="exo-domain-name">defense</span>')[1].split('</article>')[0];
  assert.match(defenseCard, /OWNED-PUBLICATION/); assert.match(defenseCard, /owned-article-1/);
  assert.match(defenseCard, /exo-chain-label">OBSERVED<\/span><span class="exo-badge exo-unobserved">UNOBSERVED/);
  cognition.cognition.economy.c.businessTrace.ownerDomain = 'finance';
  await window.LIMENExecutionObservatory.refresh();
  economyCard = el.innerHTML.split('<span class="exo-domain-name">economy</span>')[1].split('</article>')[0];
  assert.doesNotMatch(economyCard, /PAPER-ORDER/);
  cognition.cognition.economy.c.businessTrace.ownerDomain = 'economy';
  await window.LIMENExecutionObservatory.refresh();
  var cultureCard = el.innerHTML.split('<span class="exo-domain-name">culture</span>')[1].split('</article>')[0];
  assert.match(cultureCard, /RECORDED NO_ACTION/); assert.match(cultureCard, /RECORDED AMBIGUOUS/);
  assert.doesNotMatch(cultureCard, /exo-badge exo-paper">PAPER/, 'unverified capability does not establish paper execution');
  assert.match(cultureCard, /culture-prior-decision/);
  assert.doesNotMatch(cultureCard, /PROVIDER-ACCEPTED/);
  cognition.cognition.culture.c.businessTrace.command.providerReceiptId = 'provider-culture-1';
  cognition.cognition.culture.c.businessTrace.command.status = 'GENERATED';
  await window.LIMENExecutionObservatory.refresh();
  assert.match(el.innerHTML, /PROVIDER-ACCEPTED/);
  cognition.cognition.culture.c.businessTrace.status = 'UNAVAILABLE';
  await window.LIMENExecutionObservatory.refresh();
  assert.doesNotMatch(el.innerHTML, /PROVIDER-ACCEPTED/);
  assert.match(el.innerHTML, /learning credit <b>0.75<\/b> \(not revenue\)/);
  assert.doesNotMatch(el.innerHTML, /CREDIT 0.75/);
  assert.match(el.innerHTML, /exo-chain-label">REVENUE<\/span><span class="exo-badge exo-unobserved">UNOBSERVED/);
  fail = true;
  await window.LIMENExecutionObservatory.refresh();
  assert.match(el.innerHTML, /audit unavailable/);
  assert.doesNotMatch(el.innerHTML, /EXTERNAL-READY/);
  assert.doesNotMatch(el.innerHTML, /learning credit <b>0.75/);
  fail = false;
  await window.LIMENExecutionObservatory.refresh();
  assert.match(el.innerHTML, /EXTERNAL-READY/);
  assert.doesNotMatch(el.innerHTML, /read failure/);
  assert.match(el.innerHTML, /independent-outcome-missing/);
  assert.match(el.innerHTML, /\/api\/product-domain-learning-state\?domain=finance/);
  var agricultureCard = el.innerHTML.split('<span class="exo-domain-name">agriculture</span>')[1].split('</article>')[0];
  assert.match(agricultureCard, /route-return-1/);
  assert.match(agricultureCard, /agri-packet-1/);
  assert.match(agricultureCard, /learning stays with destination; origin observation only/);
  assert.match(agricultureCard, /exo-chain-label">OBSERVED<\/span><span class="exo-badge exo-unobserved">UNOBSERVED/);
  var energyCard = el.innerHTML.split('<span class="exo-domain-name">energy</span>')[1].split('</article>')[0];
  assert.match(energyCard, /finance-to-energy-1/);
  assert.match(energyCard, /separate from motor authority/);
  assert.match(energyCard, /exo-chain-label">OBSERVED<\/span><span class="exo-badge exo-unobserved">UNOBSERVED/,
    'a Finance afferent cannot claim an independently observed Energy motor result');
  cognition.cognition.finance.ts = Date.now() - 3 * 3600 * 1000 - 1;
  await window.LIMENExecutionObservatory.refresh();
  assert.doesNotMatch(el.innerHTML, /EXTERNAL-READY/);
  assert.match(el.innerHTML, /server-cognition-stale-or-invalid-timestamp/);
  cognition.cognition.finance.ts = Date.now() + 60000;
  await window.LIMENExecutionObservatory.refresh();
  assert.doesNotMatch(el.innerHTML, /EXTERNAL-READY/);
  cognition.cognition.finance.ts = Date.now();
  cognition.cognition.finance.c.motorCapabilityEvidence.validUntil = Date.now() - 1;
  await window.LIMENExecutionObservatory.refresh();
  assert.doesNotMatch(el.innerHTML, /EXTERNAL-READY/);
  assert.match(el.innerHTML, /capability-expiry-missing-or-expired/);
  console.log('PASS observatory credit, failed-read readiness and recovery boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
