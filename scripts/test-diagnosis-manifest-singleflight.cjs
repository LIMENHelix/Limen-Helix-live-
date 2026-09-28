'use strict';
// Offline same-process concurrency proof: no GitHub traffic or RSS claims.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../handlers/diagnosis-manifest.js'), 'utf8');
const SHA = 'a'.repeat(40), OTHER = 'b'.repeat(40);
const valid = (id = 'DX') => JSON.stringify({ domain: 'finance', count: 2, entries: [[id, 'first', 2], ['SECOND', 'second', 2]] });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness(reply) {
  const gate = deferred(), stats = { fetches: 0, parses: 0, decodes: 0, validations: 0, metadata: 0 };
  const context = vm.createContext({ module: { exports: {} }, process: { env: { GITHUB_TOKEN: 'offline' } },
    Buffer, Uint8Array, stats,
    JSON: { parse(text) { stats.parses++; return JSON.parse(text); } },
    TextDecoder: class { decode(bytes) { stats.decodes++; return new TextDecoder().decode(bytes); } },
    fetch: async url => {
      if (url.includes('/contents/')) { stats.metadata++; return { ok: true, json: async () => ({ sha: SHA.toUpperCase() }) }; }
      stats.fetches++; const attempt = stats.fetches;
      await gate.promise;
      return reply(String(url).split('/').pop(), attempt);
    } });
  vm.runInContext(source, context);
  vm.runInContext('const originalValidate = validateManifest; validateManifest = m => { stats.validations++; return originalValidate(m); };', context);
  async function call(query = { domain: 'finance', ref: SHA }) {
    const res = { headers: {}, status(code) { this.code = code; return this; },
      setHeader(k, v) { this.headers[k] = v; }, json(body) { this.body = body; return this; } };
    await context.module.exports({ query }, res); return res;
  }
  return { stats, gate, call, idle: () => vm.runInContext('typeof _blobInflight === "undefined" ? 0 : _blobInflight.size', context) };
}
async function burst(h, queries) {
  const work = (queries || Array.from({ length: 16 }, (_, i) => ({ domain: 'finance', ref: i % 2 ? SHA : SHA.toUpperCase() }))).map(h.call);
  await Promise.resolve(); h.gate.resolve(); return Promise.all(work);
}
let passed = 0, failed = 0;
async function test(name, run) { try { await run(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
(async () => {
  await test('16 identical multi-MiB cold requests share one fetch/decode/parse/validation', async () => {
    const body = valid().padEnd(2 * 1024 * 1024, ' ');
    const h = harness(() => new Response(body));
    const results = await burst(h);
    console.log('  cold16 fetches=' + h.stats.fetches + ' parses=' + h.stats.parses);
    assert.ok(results.every(r => r.code === 200));
    for (const r of results) assert.deepEqual(r.body, results[0].body);
    assert.deepEqual(h.stats, { fetches: 1, parses: 1, decodes: 1, validations: 1, metadata: 0 });
    assert.equal(h.idle(), 0, 'successful in-flight promise released');
    await burst(h); assert.equal(h.stats.fetches, 1, 'warm immutable cache retained');
  });
  const failures = [
    ['404', () => new Response('', { status: 404 }), 404, 0],
    ['503', () => new Response('', { status: 503 }), 502, 0],
    ['fetch rejection', () => { throw new Error('offline unavailable'); }, 500, 0],
    ['malformed JSON', () => new Response('{bad'), 502, 1],
    ['invalid schema', () => new Response('{"hello":"world"}'), 422, 1],
    ['oversized header', () => new Response('x', { headers: { 'content-length': String(8 * 1024 * 1024 + 1) } }), 502, 0],
    ['body read failure', () => new Response(new ReadableStream({ pull() { throw new Error('offline read failed'); } })), 502, 0]
  ];
  for (const [name, response, status, parses] of failures) await test(name + ': shared failure clears flight and permits retry', async () => {
    let failing = true;
    const h = harness(() => failing ? response() : new Response(valid()));
    const results = await burst(h);
    assert.ok(results.every(r => r.code === status));
    for (const r of results) { assert.deepEqual(r.body, results[0].body); assert.equal(r.headers['Cache-Control'], undefined); }
    assert.equal(h.stats.fetches, 1); assert.equal(h.stats.parses, parses); assert.equal(h.idle(), 0);
    failing = false;
    const retried = await burst(h);
    assert.ok(retried.every(r => r.code === 200));
    assert.equal(h.stats.fetches, 2); assert.equal(h.stats.parses, parses + 1); assert.equal(h.idle(), 0);
  });
  await test('different SHAs are isolated; failure of one cannot poison the other', async () => {
    let failing = true;
    const h = harness(sha => new Response(sha === SHA && failing ? '{bad' : valid(sha === SHA ? 'A' : 'B')));
    const queries = Array.from({ length: 32 }, (_, i) => ({ domain: 'finance', ref: i % 2 ? SHA : OTHER }));
    const results = await burst(h, queries);
    assert.equal(h.stats.fetches, 2); assert.equal(h.stats.parses, 2);
    results.forEach((r, i) => { assert.equal(r.code, i % 2 ? 502 : 200); if (!(i % 2)) assert.equal(r.body.entries[0][0], 'B'); });
    failing = false; const next = await burst(h, queries);
    next.forEach((r, i) => { assert.equal(r.code, 200); assert.equal(r.body.entries[0][0], i % 2 ? 'A' : 'B'); });
    assert.equal(h.stats.fetches, 3); assert.equal(h.stats.parses, 3); assert.equal(h.idle(), 0);
  });
  await test('shared blob keeps per-caller domain, page and ID results separate', async () => {
    const h = harness(() => new Response(valid()));
    const results = await burst(h, [
      { domain: 'finance', ref: SHA, page: '0', size: '1' },
      { domain: 'finance', ref: SHA, page: '1', size: '1' },
      { domain: 'finance', ref: SHA, id: 'SECOND' },
      { domain: 'p2_agri', ref: SHA },
      { domain: 'finance' } // metadata returns uppercase SHA; same blob load
    ]);
    assert.equal(h.stats.fetches, 1); assert.equal(h.stats.parses, 1); assert.equal(h.stats.metadata, 1);
    assert.equal(results[0].body.entries[0][0], 'DX'); assert.equal(results[1].body.entries[0][0], 'SECOND');
    assert.equal(results[2].body.route, '/api/fetch-portal?domainId=finance_second');
    assert.equal(results[3].code, 409); assert.equal(results[3].headers['Cache-Control'], undefined);
    assert.deepEqual(results[4].body.entries, JSON.parse(valid()).entries);
  });
  await test('successful flights are not retained past FIFO cache eviction', async () => {
    const h = harness(() => new Response(valid())); h.gate.resolve();
    for (let i = 1; i <= 51; i++) await h.call({ domain: 'finance', ref: i.toString(16).padStart(40, '0') });
    assert.equal(h.stats.fetches, 51); assert.equal(h.idle(), 0);
    await h.call({ domain: 'finance', ref: '1'.padStart(40, '0') });
    assert.equal(h.stats.fetches, 52); assert.equal(h.stats.parses, 52); assert.equal(h.idle(), 0);
  });
  console.log(passed + '/' + (passed + failed) + ' manifest single-flight checks passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
