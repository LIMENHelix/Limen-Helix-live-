'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const domains = ['energy','infrastructure','culture','finance','economy','technology','defense','intelligence','trade','industry','environment','governance','agriculture','communication','medicine','education','population','science','law','religion'];
const prefix = 'limen:brain:cognition:';
const snapshots = Object.fromEntries(domains.map(domain => [prefix + domain, { ts: Date.now() - 1000,
  c: { domain, stress: 0.25, phase: 'STABILISATION', immune: { immuneState: 'RETAINED' } } }]));
snapshots[prefix + 'culture'].ts = Date.now() - 4 * 3600000;
const records = new Map(), logs = new Map(); let fail = false, stall = false, writes = 0, reads = 0;
const store = { assertDurable() { if (fail) throw Error('durable-read-unavailable'); },
  async get(key) { reads++; return records.get(key) || null; },
  async lrange(key, start, stop) { reads++; if (stall && key === Decision.LOG_KEY) return new Promise(() => {}); return (logs.get(key) || []).slice(start, stop + 1); } };
for (const method of ['set', 'setNx', 'setIfAbsent', 'compareAndSet', 'lpush', 'ltrim', 'del']) store[method] = async () => { writes++; throw Error('GET attempted write'); };
for (const [file, exports] of [['lib/redis-kv.js', { redisMGet: async () => snapshots, redisGet: async () => null,
  redisSet: async () => { writes++; throw Error('GET attempted cognition write'); } }], ['lib/autofire-efference-store.js', store]]) {
  const id = require.resolve(path.join(root, file)); require.cache[id] = { id, filename: id, loaded: true, exports };
}
const Decision = require('../lib/culture-hero-decision.js');
const id = 'culture-observation-held';
const decision = { schemaVersion: Decision.SCHEMA, productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
  decisionReceiptId: id, status: 'NO_ACTION', culturePacketId: 'culture-native-packet', decidedAt: Date.now() - 1000,
  reason: 'culture-immune-quarantine', blockers: ['culture-immune-quarantine'],
  immuneRouting: { schemaVersion: 'immune-routing/1.0', route: 'QUARANTINE' } };
records.set(Decision.key(id), decision); logs.set(Decision.LOG_KEY, [{ decisionReceiptId: id }]);
const handler = require('../handlers/brain-cognition.js');
async function invoke(method = 'GET', body) {
  const headers = {}; let result;
  const res = { setHeader(key, value) { headers[key] = value; }, end(text) { result = JSON.parse(text); } };
  await handler({ method, headers: {}, body }, res);
  return { status: res.statusCode, body: result, headers };
}
(async () => {
  const before = JSON.stringify(snapshots);
  const response = await invoke();
  assert.equal(response.status, 200); assert.equal(response.body.count, 20);
  assert.deepEqual(Object.keys(response.body.cognition), domains, 'parallel reads retain canonical domain order');
  assert.equal(response.body.cognition.culture.c.businessTrace.status, 'RECORDED');
  assert.equal(response.body.cognition.culture.c.businessTrace.decision.id, id);
  assert.equal(response.body.cognition.culture.c.businessTrace.decision.immuneRoute, 'QUARANTINE');
  assert.equal(response.headers['cache-control'], 'no-store');
  for (const domain of domains) {
    const entry = response.body.cognition[domain], trace = entry.c.businessTrace;
    assert.equal(trace.ownerDomain, { medicine: 'health', science: 'research', trade: 'supplyChain' }[domain] || domain);
    assert.equal(trace.observationOnly, true); assert.equal(trace.externalActionAuthorized, false);
    assert.equal(entry.ts, snapshots[prefix + domain].ts, 'a fresh business read cannot renew the brain timestamp');
    assert.deepEqual(entry.c.immune, snapshots[prefix + domain].c.immune);
  }
  assert.equal(JSON.stringify(snapshots), before, 'GET must not mutate stored brain objects');
  const element = { innerHTML: '' }, ui = { addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/civilization/execution-observatory.js'), 'utf8'), {
    window: ui, document: { readyState: 'loading', addEventListener() {}, getElementById: name => name === 'execution-observatory' ? element : null },
    Date, setInterval() {}, fetch: async url => ({ ok: true, json: async () => String(url).includes('brain-cognition') ? response.body : {} })
  });
  await ui.LIMENExecutionObservatory.refresh();
  const card = element.innerHTML.split('<span class="exo-domain-name">culture</span>')[1].split('</article>')[0];
  assert(card.includes(id)); assert(card.includes('immune QUARANTINE')); assert(card.includes('server-cognition-stale-or-invalid-timestamp'));
  assert(card.includes('· read ' + new Date(response.body.cognition.culture.c.businessTrace.readAt).toLocaleString()));
  assert(card.includes('exo-chain-label">REVENUE</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
  decision.ownerDomain = 'finance';
  const foreign = (await invoke()).body.cognition.culture.c.businessTrace;
  assert.equal(foreign.status, 'UNAVAILABLE'); assert.equal(foreign.decision, null); assert.equal(foreign.command, null);
  decision.ownerDomain = 'culture';
  fail = true; assert.equal((await invoke()).body.cognition.culture.c.businessTrace.status, 'UNAVAILABLE'); fail = false;
  assert.equal((await invoke()).body.cognition.culture.c.businessTrace.status, 'RECORDED');
  const nativeTimer = global.setTimeout; let guard;
  global.setTimeout = (fn, delay) => nativeTimer(fn, delay === 10000 ? 20 : delay);
  try {
    stall = true;
    const timeout = await Promise.race([invoke(), new Promise((_, reject) => { guard = nativeTimer(() => reject(Error('unbounded business trace read')), 250); })]);
    assert.equal(timeout.body.cognition.culture.c.businessTrace.status, 'UNAVAILABLE');
    assert.equal(timeout.body.cognition.culture.c.businessTrace.reason, 'business-trace-read-timeout');
  } finally { stall = false; global.setTimeout = nativeTimer; clearTimeout(guard); }
  for (const domain of domains) snapshots[prefix + domain].c.businessTrace = {
    schemaVersion: 'product-domain-business-trace-readout/1.0', status: 'UNAVAILABLE', reason: 'retained-scheduler-read',
    ownerDomain: { medicine: 'health', science: 'research', trade: 'supplyChain' }[domain] || domain,
    observationOnly: true, externalActionAuthorized: false };
  const readsBefore = reads; const retained = await invoke();
  assert.equal(reads, readsBefore, 'an existing scheduler business readout is retained without a second read');
  assert.equal(retained.body.cognition.culture.c.businessTrace.reason, 'retained-scheduler-read');
  assert.equal((await invoke('POST', { domain: 'culture', cognition: {} })).status, 401);
  assert.equal(writes, 0);
  console.log('PASS actual cognition GET twenty owning business readers, immutable timestamps, current-read preservation, refusal/recovery and renderer separation');
})().catch(error => { console.error(error); process.exitCode = 1; });
