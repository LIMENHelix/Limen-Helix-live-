// Offline F-02 regression: bound raw blob bytes BEFORE buffering/parsing/cache.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const handler = require('../handlers/diagnosis-manifest.js');
const LIMIT = 8 * 1024 * 1024;
const SHA = 'a'.repeat(40);
const VALID = Buffer.from(JSON.stringify({ domain: 'finance', count: 1, entries: [['DX', 'portal', 1]], source: 'test' }));
const originalFetch = global.fetch;
const originalToken = process.env.GITHUB_TOKEN;
process.env.GITHUB_TOKEN = 'offline-test-token';
let passed = 0, failed = 0;

// highWaterMark=0 makes reads observable: rejection must cancel without asking
// for the next chunk. No remote fetch or actual 65 MB fixture is needed.
function upstream(chunks, length, failAt = -1, cancelFails = false) {
  const stats = { reads: 0, bytes: 0, cancelled: 0, texts: 0 };
  let index = 0;
  const body = new ReadableStream({
    pull(controller) {
      stats.reads++;
      if (index === failAt) throw new Error('offline interrupted body');
      if (index === chunks.length) return controller.close();
      const chunk = chunks[index++];
      stats.bytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() { stats.cancelled++; if (cancelFails) throw new Error('offline cancel failed'); }
  }, { highWaterMark: 0 });
  const response = new Response(body, { headers: length === undefined ? {} : { 'content-length': String(length) } });
  const text = response.text.bind(response);
  response.text = () => { stats.texts++; return text(); };
  return { response, stats };
}

function padded(total) {
  const chunks = [VALID];
  const spaces = Buffer.alloc(64 * 1024, 32);
  for (let remaining = total - VALID.length; remaining > 0; remaining -= spaces.length) {
    chunks.push(spaces.subarray(0, Math.min(remaining, spaces.length)));
  }
  return chunks;
}

async function call(query = { domain: 'finance', ref: SHA }) {
  const result = { code: 200, headers: {}, status(code) { this.code = code; return this; },
    setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; } };
  await handler({ query }, result);
  return result;
}

async function test(name, run) {
  handler._clearCache();
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}

function rejected(result) {
  assert.equal(result.code, 502);
  assert.equal(result.body.status, 'manifest-body-too-large');
  assert.equal(result.body.entries, undefined);
  assert.equal(result.headers['Cache-Control'], undefined);
}

(async () => {
  // Instrument only allocations made by the handler, not Fetch/Node internals.
  // Hold all readers at their second read so capacities coexist concurrently.
  // These are deterministic buffer-capacity assertions, NOT process RSS claims.
  for (const declared of [undefined, LIMIT]) {
    await test('16 concurrent tiny invalid refs allocate proportionally; declared=' + declared, async () => {
      const capacities = [], waiting = [], n = 16, bytes = Buffer.from('{"hello":"x"}');
      const module = { exports: {} };
      const sandbox = { module, process: { env: { GITHUB_TOKEN: 'offline' } }, TextDecoder, Uint8Array,
        Buffer: { allocUnsafe(size) { capacities.push(size); return Buffer.allocUnsafe(size); } },
        fetch: async () => ({ ok: true, status: 200, headers: { get: () => declared === undefined ? null : String(declared) },
          body: { getReader() {
            let sent = false;
            return { async read() {
              if (!sent) { sent = true; return { done: false, value: bytes }; }
              return new Promise(resolve => { waiting.push(resolve); if (waiting.length === n) waiting.forEach(r => r({ done: true })); });
            }, cancel: async () => {}, releaseLock() {} };
          } }
        }) };
      vm.runInNewContext(fs.readFileSync(require.resolve('../handlers/diagnosis-manifest.js'), 'utf8'), sandbox);
      const results = await Promise.all(Array.from({ length: n }, async (_, i) => {
        const res = { status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; }, setHeader() { assert.fail('invalid body must not be cacheable'); } };
        await module.exports({ query: { domain: 'finance', ref: (i + 1).toString(16).padStart(40, '0') } }, res);
        return res;
      }));
      assert.ok(results.every(r => r.code === 422));
      const total = capacities.reduce((a, b) => a + b, 0);
      console.log('  concurrent=' + n + ' bodyBytes=' + bytes.length + ' requestedBufferBytes=' + total);
      assert.ok(total <= n * Math.max(64, bytes.length * 2), 'aggregate requested capacity scales with actual tiny bodies, not the8MiB cap: ' + total);
      assert.ok(Math.max(...capacities) <= Math.max(64, bytes.length * 2));
    });
  }
  await test('fragmented growth is geometric and preserves all bytes', async () => {
    const capacities = [], bytes = Buffer.from(JSON.stringify({ domain: 'finance', count: 0, entries: [], source: 'é'.repeat(10000) }));
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 17) chunks.push(bytes.subarray(i, i + 17));
    const module = { exports: {} }, fixture = upstream(chunks);
    vm.runInNewContext(fs.readFileSync(require.resolve('../handlers/diagnosis-manifest.js'), 'utf8'), {
      module, process: { env: { GITHUB_TOKEN: 'offline' } }, TextDecoder, Uint8Array,
      Buffer: { allocUnsafe(size) { capacities.push(size); return Buffer.allocUnsafe(size); } },
      fetch: async () => fixture.response
    });
    const res = { status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
    await module.exports({ query: { domain: 'finance', ref: SHA } }, res);
    assert.equal(res.code, 200); assert.equal(res.body.source, 'é'.repeat(10000));
    assert.ok(capacities.reduce((a, b) => a + b, 0) < 4 * bytes.length, 'cumulative allocation must be linear, not per-chunk quadratic');
    assert.ok(Math.max(...capacities) < 2 * bytes.length);
    assert.ok(capacities.every(c => c <= LIMIT));
  });
  for (const length of [65 * 1024 * 1024, '99999999999999999999999999']) {
    await test('oversized declared length ' + length + ': reject before first read', async () => {
      const fixture = upstream([VALID], length);
      global.fetch = async () => fixture.response;
      const result = await call();
      assert.equal(fixture.stats.texts, 0, 'must not use unbounded Response.text()');
      rejected(result);
      assert.equal(fixture.stats.reads, 0);
      assert.equal(fixture.stats.cancelled, 1);
    });
  }

  for (const length of [undefined, '1', 'not-a-size', '-1']) {
    await test('unknown/false length ' + length + ': stop at actual byte overflow', async () => {
      const chunks = [...padded(LIMIT), Buffer.from(' '), Buffer.from('unread tail')];
      const fixture = upstream(chunks, length);
      global.fetch = async () => fixture.response;
      const result = await call();
      assert.equal(fixture.stats.texts, 0, 'must not buffer all chunks');
      rejected(result);
      assert.equal(fixture.stats.bytes, LIMIT + 1);
      assert.equal(fixture.stats.reads, chunks.length - 1);
      assert.equal(fixture.stats.cancelled, 1);
      assert.equal(fixture.response.body.locked, false);
    });
  }

  for (const length of [undefined, LIMIT]) {
    await test('exact 8 MiB valid body accepted with length ' + length, async () => {
      const fixture = upstream(padded(LIMIT), length);
      global.fetch = async () => fixture.response;
      const result = await call();
      assert.equal(result.code, 200);
      assert.deepEqual(result.body.entries, [['DX', 'portal', 1]]);
      assert.equal(result.body.ref, SHA);
      assert.equal(fixture.stats.bytes, LIMIT);
      assert.equal(fixture.stats.texts, 0);
      assert.equal(fixture.stats.cancelled, 0);
      assert.equal(fixture.response.body.locked, false);
    });
  }

  await test('limit counts UTF-8 bytes, not characters', async () => {
    const prefix = Buffer.from('{"source":"');
    const fixture = upstream([prefix, Buffer.from('é'.repeat(LIMIT / 2)), Buffer.from('","domain":"finance","count":0,"entries":[]}')]);
    global.fetch = async () => fixture.response;
    rejected(await call());
    assert.equal(fixture.stats.reads, 2);
    assert.equal(fixture.stats.cancelled, 1);
  });

  await test('UTF-8 split across chunks and BOM retain Response.text semantics', async () => {
    const bytes = Buffer.from('\ufeff' + JSON.stringify({ domain: 'finance', count: 0, entries: [], source: 'é🌱' }));
    const fixture = upstream(Array.from(bytes, byte => Uint8Array.of(byte)));
    global.fetch = async () => fixture.response;
    const result = await call();
    assert.equal(result.code, 200);
    assert.equal(result.body.source, 'é🌱');
    assert.equal(fixture.stats.texts, 0);
  });

  await test('rejected size is not cached; valid retry is cached by exact SHA', async () => {
    const fixtures = [upstream([VALID], LIMIT + 1), upstream([VALID])];
    let requests = 0;
    global.fetch = async url => { assert.ok(url.endsWith('/git/blobs/' + SHA)); return fixtures[requests++].response; };
    rejected(await call());
    assert.equal((await call()).code, 200);
    assert.equal((await call()).code, 200);
    assert.equal(requests, 2);
  });

  await test('stream overflow is not cached, including false content length', async () => {
    let requests = 0;
    global.fetch = async () => { requests++; return upstream(padded(LIMIT + 1), '1').response; };
    rejected(await call());
    rejected(await call());
    assert.equal(requests, 2);
  });

  await test('metadata-selected blob is bounded by the same reader', async () => {
    const fixture = upstream([VALID], LIMIT + 1);
    const urls = [];
    global.fetch = async url => { urls.push(url); return url.includes('/contents/') ? Response.json({ sha: SHA }) : fixture.response; };
    rejected(await call({ domain: 'finance' }));
    assert.equal(urls.length, 2);
    assert.ok(urls[1].endsWith('/git/blobs/' + SHA));
    assert.equal(fixture.stats.reads, 0);
  });

  await test('interrupted body is honest uncached 502, not success or internal 500', async () => {
    let requests = 0;
    global.fetch = async () => { requests++; return upstream([VALID], undefined, 1).response; };
    for (let i = 0; i < 2; i++) {
      const result = await call();
      assert.equal(result.code, 502);
      assert.equal(result.body.status, 'manifest-body-read-failed');
      assert.equal(result.body.entries, undefined);
    }
    assert.equal(requests, 2);
  });

  for (const declared of [true, false]) {
    await test('cancellation failure cannot obscure size rejection: header=' + declared, async () => {
      const fixture = upstream(declared ? [VALID] : padded(LIMIT + 1), declared ? LIMIT + 1 : undefined, -1, true);
      global.fetch = async () => fixture.response;
      rejected(await call());
      assert.equal(fixture.stats.cancelled, 1);
      assert.equal(fixture.response.body.locked, false);
    });
  }

  await test('small malformed body remains uncached malformed-json 502', async () => {
    let requests = 0;
    global.fetch = async () => { requests++; return upstream([Buffer.from('not JSON')]).response; };
    for (let i = 0; i < 2; i++) {
      const result = await call();
      assert.equal(result.code, 502);
      assert.equal(result.body.status, 'malformed-manifest-json');
    }
    assert.equal(requests, 2);
  });
})().catch(error => { failed++; console.error(error.stack); }).finally(() => {
  global.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
  handler._clearCache();
  console.log(`${passed}/${passed + failed} passed`);
  process.exitCode = failed ? 1 : 0;
});
