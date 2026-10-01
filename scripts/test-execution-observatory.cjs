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
