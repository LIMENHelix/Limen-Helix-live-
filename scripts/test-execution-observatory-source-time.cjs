'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Packet = require('../lib/civilization-server-packet.js');
const domains = ['energy','infrastructure','culture','finance','economy','technology','defense','intelligence','trade','industry','environment','governance','agriculture','communication','medicine','education','population','science','law','religion'];
const now = Date.now();
const cognition = {};
const input = { cognition: { model: { cycle: 1 } }, stress: 0.35, confidence: 0.8, phase: 'p2', feeds: [{ live: true }] };
const sources = [
  { name: 'old statistic', live: true, fetchedAt: now, sourceUpdatedAt: '2021-03-01' },
  { name: 'content identity', live: true, fetchedAt: now, sourceUpdatedAt: 'rss:sha256:1234' },
  { name: 'yearly statistic', live: true, fetchedAt: now, sourceUpdatedAt: '2022' },
  { name: 'missing publisher date', live: true, fetchedAt: now },
  { name: 'future publisher date', live: true, fetchedAt: now, sourceUpdatedAt: '2999-01-01' },
  { name: '<img src=x>', live: true, fetchedAt: now + 3600000, sourceUpdatedAt: '2021-02-30' }
];
domains.forEach(domain => {
  const evidence = Packet.feedSourceEvidence(domain, { sources });
  const packet = Packet.fromBrainState(domain, input, { snapshotId: 'freshness-fixture', fetchedAt: now }, 'freshness-read', new Date(now).toISOString(), { feedSourceEvidence: evidence });
  cognition[domain] = { ts: now, c: { serverPacket: packet } };
});
const el = { innerHTML: '' };
const window = { addEventListener() {} };
const document = { readyState: 'loading', addEventListener() {}, getElementById() { return el; } };
const calls = [];
let fail = false;
const fetch = async (url, options) => {
  calls.push({ url, method: options && options.method || 'GET' });
  if (fail) throw Error('fixture-read-failed');
  return { ok: true, json: async () => url.includes('brain-cognition') ? { count: 20, newest: now, cognition } : {} };
};
vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/civilization/execution-observatory.js'), 'utf8'), { window, document, fetch, AbortController, setTimeout, clearTimeout, setInterval() {} });
const card = domain => el.innerHTML.split('<span class="exo-domain-name">' + domain + '</span>')[1].split('</article>')[0];
(async () => {
  const before = JSON.stringify(cognition);
  await window.LIMENExecutionObservatory.refresh();
  domains.forEach(domain => {
    const html = card(domain);
    assert.match(html, /publisher date <b>2021-03-01<\/b>/);
    assert.match(html, new RegExp('retrieved <b>' + new Date(now).toISOString().replace(/[.]/g, '\\.') + '<\\/b>'));
    assert.match(html, /publisher period <b>2022<\/b> · observation age unverified/);
    assert.match(html, /rss:sha256:1234<\/b> · observation date unverified/);
    assert.match(html, /publisher observation date <b>UNOBSERVED<\/b>/);
    assert.match(html, /2999-01-01<\/b> · FUTURE — observation date unverified/);
    assert.match(html, /2021-02-30<\/b> · observation date unverified/);
    assert.match(html, /retrieved <b>UNVERIFIED<\/b>/);
    assert.match(html, /&lt;img src=x&gt;/);
    assert.doesNotMatch(html, /<img src=x>|EXTERNAL-READY/);
    assert.match(html, /stress 0.35 · conf 0.80/);
  });
  assert.equal(JSON.stringify(cognition), before, 'projection cannot mutate brain, packet or source evidence');
  const evidence = cognition.science.c.serverPacket.truth.feedSourceEvidence;
  for (const mutation of [{ ownerDomain: 'finance' }, { schemaVersion: 'forged' }, { authority: 'effect-authority' }, { status: 'UNAVAILABLE' }]) {
    const original = { ...evidence };
    Object.assign(evidence, mutation);
    await window.LIMENExecutionObservatory.refresh();
    assert.match(card('science'), /source observation time <b>UNOBSERVED<\/b>/);
    assert.doesNotMatch(card('science'), /old statistic|2021-03-01|rss:sha256/);
    Object.assign(evidence, original);
  }
  fail = true;
  await window.LIMENExecutionObservatory.refresh();
  assert.doesNotMatch(el.innerHTML, /old statistic|2021-03-01|rss:sha256/);
  fail = false;
  await window.LIMENExecutionObservatory.refresh();
  assert.match(card('science'), /publisher date <b>2021-03-01<\/b>/);
  assert.equal(JSON.stringify(cognition), before);
  assert.ok(calls.every(call => call.method === 'GET' && ['/api/brain-cognition','/api/limen-autofire-log?limit=50'].includes(call.url)), 'no added source, provider or write requests');
  console.log('source-time observatory: twenty actual packet producers, independent retrieval/publisher dates, refusal and recovery passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
