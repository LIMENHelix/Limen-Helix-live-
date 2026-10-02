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
  decision: { id: 'culture-decision-1', status: 'NO_ACTION', immuneRoute: 'QUARANTINE', packetId: 'culture-packet-1', decidedAt: Date.now() },
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
['science', 'medicine', 'education', 'environment'].forEach(function (domain) {
  cognition.cognition[domain] = { ts: Date.now(), c: { businessTrace: {
    schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: { science: 'research', medicine: 'health' }[domain] || domain,
    lane: 'research', status: 'RECORDED', observationOnly: true, externalActionAuthorized: false,
    decision: { id: domain + '-next-held', status: 'HELD', decidedAt: Date.now(), blockers: ['reassessment-required'] },
    command: { id: domain + '-artifact-command', decisionId: domain + '-prior-release', status: 'EXECUTED', commandedAt: Date.now(),
      artifactGenerationOnly: true, receipt: { kind: 'PERSISTENCE-RECEIPT', id: domain + '-artifact' } }
  } } };
});
cognition.count = 18;
cognition.cognition.agriculture.c.businessTrace = {
  schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'agriculture', lane: 'origin-routing',
  observationOnly: true, externalActionAuthorized: false, status: 'ROUTING_ONLY',
  reason: 'Homestead is separate; no Agriculture motor or borrowed reward',
  originRoutes: [
    { destinationOwner: 'finance', lane: 'investment', destinationDecisionId: 'destination-finance-release', status: 'RELEASED', sourcePacketId: 'agri-outward-packet', decidedAt: Date.now() },
    { destinationOwner: 'research', lane: 'research', destinationDecisionId: 'destination-research-held', status: 'HELD', sourcePacketId: 'agri-outward-packet', decidedAt: Date.now(), blockers: ['owner-evidence-incomplete'] }
  ],
  originReturns: { status: 'PARTIAL', failures: [{ ownerDomain: 'finance', reason: 'destination-read-unavailable' }],
    observations: [{ returnId: 'research-origin-return', destinationOwner: 'research', destinationSelectionId: 'research-prior-release', actionId: 'research-owned-action', outcome: 'REGRESSION', observedAt: Date.now(), sourcePackets: ['agri-outward-packet'] }] },
  decision: { id: 'borrowed-destination-decision', status: 'RELEASED' },
  command: { id: 'borrowed-destination-command', receipt: { kind: 'PAPER-ORDER', id: 'borrowed-destination-order' } }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/civilization/execution-observatory.js'), 'utf8'), {
  window, document, Date, setInterval() {},
  fetch: async url => {
    if (fail && url.includes('autofire')) throw Error('audit unavailable');
    return { ok: true, json: async () => url.includes('brain-cognition') ? cognition : {} };
  }
});
(async () => {
  var medicineBusinessBefore = JSON.stringify(cognition.cognition.medicine.c.businessTrace);
  cognition.cognition.medicine.c.researchOriginTrace = {
    schemaVersion: 'research-origin-trace-readout/1.0', originDomain: 'medicine', destinationOwner: 'research',
    observationOnly: true, externalActionAuthorized: false, status: 'RECORDED', reason: 'Science owns paper execution',
    routes: [{ decisionId: 'science-for-medicine', destinationOwner: 'research', status: 'HELD', sourcePacketId: 'medicine-source-packet', decidedAt: Date.now() }]
  };
  cognition.cognition.science.c.businessTrace.decision.originDomain = 'education';
  cognition.cognition.science.c.businessTrace.dispatchGate = { status: 'HELD', reason: 'domain-motor-receipt-missing', readAt: Date.now(), observationOnly: true };
  await window.LIMENExecutionObservatory.refresh();
  var scienceOriginCard = el.innerHTML.split('<span class="exo-domain-name">science</span>')[1].split('</article>')[0];
  assert.match(scienceOriginCard, /origin education/);
  var medicineOriginCard = el.innerHTML.split('<span class="exo-domain-name">medicine</span>')[1].split('</article>')[0];
  assert.match(medicineOriginCard, /papers routed to Science/);
  assert.match(medicineOriginCard, /science-for-medicine/);
  assert.match(medicineOriginCard, /medicine-source-packet/);
  assert.equal(JSON.stringify(cognition.cognition.medicine.c.businessTrace), medicineBusinessBefore);
  cognition.cognition.medicine.c.researchOriginTrace.originDomain = 'education';
  await window.LIMENExecutionObservatory.refresh();
  medicineOriginCard = el.innerHTML.split('<span class="exo-domain-name">medicine</span>')[1].split('</article>')[0];
  assert.doesNotMatch(medicineOriginCard, /science-for-medicine/);
  var sourceView = cognition.cognition.medicine.c.researchOriginTrace;
  sourceView.originDomain = 'medicine';
  for (var mismatch of [{ externalActionAuthorized: true }, { observationOnly: false }, { destinationOwner: 'health' }]) {
    var originalView = Object.assign({}, sourceView);
    Object.assign(sourceView, mismatch);
    await window.LIMENExecutionObservatory.refresh();
    var invalidCard = el.innerHTML.split('<span class="exo-domain-name">medicine</span>')[1].split('</article>')[0];
    assert.doesNotMatch(invalidCard, /science-for-medicine/);
    Object.assign(sourceView, originalView);
  }
  sourceView.status = 'UNAVAILABLE';
  sourceView.reason = 'source-routing-read-unavailable';
  await window.LIMENExecutionObservatory.refresh();
  var unavailableCard = el.innerHTML.split('<span class="exo-domain-name">medicine</span>')[1].split('</article>')[0];
  assert.match(unavailableCard, /source-routing-read-unavailable/);
  assert.doesNotMatch(unavailableCard, /science-for-medicine/);
  sourceView.status = 'RECORDED';
  sourceView.routes[0].decisionId = '<img src=x onerror=alert(1)>';
  await window.LIMENExecutionObservatory.refresh();
  var escapedCard = el.innerHTML.split('<span class="exo-domain-name">medicine</span>')[1].split('</article>')[0];
  assert.doesNotMatch(escapedCard, /<img src=x/);
  assert.match(escapedCard, /&lt;img/);
  delete cognition.cognition.medicine.c.researchOriginTrace;
  assert.match(el.innerHTML, /EXTERNAL-READY/);
  ['science', 'medicine', 'education', 'environment'].forEach(function (domain) {
    var card = el.innerHTML.split('<span class="exo-domain-name">' + domain + '</span>')[1].split('</article>')[0];
    assert.match(card, /PERSISTENCE-RECEIPT/);
    assert.match(card, /reafference; independent evaluation and revenue remain separate/);
    assert.match(card, new RegExp(domain + '-prior-release'));
    ['OBSERVED', 'REVENUE'].forEach(function (stage) {
      assert.match(card, new RegExp('exo-chain-label">' + stage + '</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
    });
  });
  var financeCard = el.innerHTML.split('<span class="exo-domain-name">finance</span>')[1].split('</article>')[0];
  ['DECIDED', 'COMMAND', 'RECEIPT'].forEach(function (stage) {
    assert.match(financeCard, new RegExp('exo-chain-label">' + stage + '</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
  });
  assert.match(financeCard, /internal emission <b>12/);
  assert.match(financeCard, /preparation PERMITTED/);
  cognition.cognition.finance.c.businessTrace = {
    schemaVersion: 'product-domain-business-trace-readout/1.0', ownerDomain: 'finance', lane: 'investments',
    observationOnly: true, externalActionAuthorized: false, status: 'RECORDED',
    reason: 'native Finance sandbox history; order receipt is not fill, profit or revenue',
    decision: { id: 'finance-b10', status: 'TRADE_INTENT_SELECTED', packetId: 'finance-packet', decidedAt: Date.now() },
    command: { id: 'finance-b14', status: 'RECEIPT_PERSISTED', decisionId: 'finance-b10', paperOnly: true,
      commandedAt: Date.now(), receipt: { kind: 'PAPER-ORDER', id: 'finance-paper-order' } }
  };
  await window.LIMENExecutionObservatory.refresh();
  financeCard = el.innerHTML.split('<span class="exo-domain-name">finance</span>')[1].split('</article>')[0];
  assert.match(financeCard, /PAPER-ORDER/);
  assert.match(financeCard, /PAPER ONLY/);
  assert.match(financeCard, /order receipt is not fill, profit or revenue/);
  ['OBSERVED', 'REVENUE'].forEach(function (stage) {
    assert.match(financeCard, new RegExp('exo-chain-label">' + stage + '</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
  });
  delete cognition.cognition.finance.c.businessTrace;
  var financeLearning = cognition.cognition.finance.c.brainOrgans.externalActionLearning;
  cognition.cognition.finance.c.brainOrgans.externalActionLearning = { domain: 'finance', status: 'ELIGIBLE', latestSignalId: 'finance-owned-outcome' };
  await window.LIMENExecutionObservatory.refresh();
  financeCard = el.innerHTML.split('<span class="exo-domain-name">finance</span>')[1].split('</article>')[0];
  assert.match(financeCard, /SIGNAL finance-owned-outcome/);
  cognition.cognition.finance.c.brainOrgans.externalActionLearning.domain = 'research';
  await window.LIMENExecutionObservatory.refresh();
  financeCard = el.innerHTML.split('<span class="exo-domain-name">finance</span>')[1].split('</article>')[0];
  assert.doesNotMatch(financeCard, /SIGNAL finance-owned-outcome/);
  cognition.cognition.finance.c.brainOrgans.externalActionLearning = financeLearning;
  await window.LIMENExecutionObservatory.refresh();
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
  assert.match(cultureCard,/culture-decision-1<\/b> · immune QUARANTINE/);
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
  const failedFinanceCard = el.innerHTML.split('<span class="exo-domain-name">finance</span>')[1].split('</article>')[0];
  assert.match(failedFinanceCard, /WHY THIS IS NOT AUTONOMOUSLY EXTERNAL:[\s\S]*server-cognition-unavailable/);
  assert.doesNotMatch(failedFinanceCard, /none reported/);
  fail = false;
  await window.LIMENExecutionObservatory.refresh();
  assert.match(el.innerHTML, /EXTERNAL-READY/);
  const recoveredFinanceCard = el.innerHTML.split('<span class="exo-domain-name">finance</span>')[1].split('</article>')[0];
  assert.doesNotMatch(recoveredFinanceCard, /server-cognition-unavailable/);
  assert.doesNotMatch(el.innerHTML, /read failure/);
  assert.match(el.innerHTML, /independent-outcome-missing/);
  assert.match(el.innerHTML, /dispatch gate <b>HELD<\/b> · domain-motor-receipt-missing/);
  assert.match(el.innerHTML, /\/api\/product-domain-learning-state\?domain=finance/);
  var agricultureCard = el.innerHTML.split('<span class="exo-domain-name">agriculture</span>')[1].split('</article>')[0];
  assert.match(agricultureCard, /route-return-1/);
  assert.match(agricultureCard, /agri-packet-1/);
  assert.match(agricultureCard, /learning stays with destination; origin observation only/);
  assert.match(agricultureCard, /investment → finance/);
  assert.match(agricultureCard, /research → research/);
  assert.match(agricultureCard, /destination-finance-release/);
  assert.match(agricultureCard, /destination-research-held/);
  assert.match(agricultureCard, /research-origin-return/);
  assert.match(agricultureCard, /finance: destination-read-unavailable/);
  assert.doesNotMatch(agricultureCard, /borrowed-destination/);
  ['DECIDED', 'COMMAND', 'RECEIPT', 'OBSERVED', 'REVENUE'].forEach(function (stage) {
    assert.match(agricultureCard, new RegExp('exo-chain-label">' + stage + '</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
  });
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
  const nativeEvidence = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/audits/continuity-native-feed-spine.json'), 'utf8'));
  const nativeRows = nativeEvidence.domains;
  const nativeAgriculture = nativeRows.find(row => row.productDomain === 'agriculture').primaryIntakeBoundary.nativeReturnBoundary;
  const nativeEnergy = nativeRows.find(row => row.productDomain === 'energy').financeReviewIntake.nativeReturnBoundary;
  assert.equal(nativeAgriculture.observationOnly, true); assert.equal(nativeEnergy.eventFabricated, false);
  delete cognition.cognition.agriculture.c.businessTrace;
  cognition.cognition.agriculture.c.brainOrgans.externalActionLearning = {
    domain: 'agriculture', status: 'ABSTAINED', reason: nativeAgriculture.reason, routedOutcomeReturn: nativeAgriculture
  };
  cognition.cognition.energy.c.brainOrgans.externalActionLearning = {
    domain: 'energy', status: 'ABSTAINED', financialAfferent: { status: nativeEnergy.status, reason: nativeEnergy.reason, signalId: null }
  };
  await window.LIMENExecutionObservatory.refresh();
  agricultureCard = el.innerHTML.split('<span class="exo-domain-name">agriculture</span>')[1].split('</article>')[0];
  energyCard = el.innerHTML.split('<span class="exo-domain-name">energy</span>')[1].split('</article>')[0];
  assert.match(agricultureCard, /agriculture-opportunity-owner-outcomes-not-yet-returned/);
  assert.match(agricultureCard, /routed outcome return <b>ABSTAINED/);
  assert.doesNotMatch(agricultureCard, /route-return-1|research-origin-return|destination-finance-release/);
  assert.match(energyCard, /Finance afferent <b>ABSTAINED/);
  assert.match(energyCard, /energy-has-no-returned-finance-outcome/);
  assert.doesNotMatch(energyCard, /finance-to-energy-1|finance-command-1/);
  for (const card of [agricultureCard, energyCard]) {
    assert.match(card, /exo-chain-label">OBSERVED<\/span><span class="exo-badge exo-unobserved">UNOBSERVED/);
    assert.match(card, /exo-chain-label">REVENUE<\/span><span class="exo-badge exo-unobserved">UNOBSERVED/);
  }
  const distributionView = { schemaVersion: 'domain-commercial-distribution-observation/1.0', productDomain: 'communication',
    status: 'RECORDED', observationOnly: true, externalActionAuthorized: false, reason: 'historical observation',
    decision: { id: 'hold<&>', status: 'NO_ACTION', reason: 'subject-domain-immune-veto', sourcePacketId: 'fixture-packet', artifactId: 'fixture-artifact', key: 'fixture-key' } };
  cognition.cognition.communication.c.distributionObservation = distributionView;
  await window.LIMENExecutionObservatory.refresh();
  assert.match(el.innerHTML, /hold&lt;&amp;&gt;/);
  for (const patch of [{productDomain:'research'}, {externalActionAuthorized:true}, {observationOnly:false}, {status:'UNAVAILABLE'}]) {
    cognition.cognition.communication.c.distributionObservation = {...distributionView, ...patch};
    await window.LIMENExecutionObservatory.refresh();
    assert.doesNotMatch(el.innerHTML, /hold&lt;&amp;&gt;/);
  }

  const videoView={schemaVersion:'domain-commercial-video-observation/1.0',productDomain:'communication',status:'RECORDED',
    observationOnly:true,externalActionAuthorized:false,reason:'historical fixture',subjectDecision:{id:'video<&>',status:'NO_ACTION',subjectRoute:'HOLD',manifestId:'fixture-manifest'},
    channelDecision:{id:'channel-fixture',status:'NO_ACTION',subjectRoute:'PASS',communicationRoute:'QUARANTINE',manifestId:'fixture-manifest'}};
  cognition.cognition.communication.c.videoObservation=videoView;await window.LIMENExecutionObservatory.refresh();
  assert.match(el.innerHTML,/video&lt;&amp;&gt;/);assert.match(el.innerHTML,/Communication immune QUARANTINE/);
  for(const patch of [{productDomain:'research'},{observationOnly:false},{externalActionAuthorized:true},{status:'UNAVAILABLE'}]) {
    cognition.cognition.communication.c.videoObservation={...videoView,...patch};await window.LIMENExecutionObservatory.refresh();
    assert.doesNotMatch(el.innerHTML,/video&lt;&amp;&gt;|channel-fixture/);
  }
  console.log('PASS observatory credit, failed-read readiness and recovery boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
