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
    motorCapabilityEvidence: { verified: true },
    externalValveEvidence: { eligible: true },
    motorReceiptPersistence: { ok: true, gates: { mayDispatchExternal: true } },
    brainOrgans: { commercialReflex: { publicSocialOutcome: { normalizedCredit: 0.75, latestSignalId: 'learning-1' } } }
  }
} } };
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
  console.log('PASS observatory credit, failed-read readiness and recovery boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
