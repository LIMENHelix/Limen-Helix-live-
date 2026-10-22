#!/usr/bin/env node
'use strict';

/**
 * FIX-0103 focused regression: relay CSV import authentication and SSRF.
 *
 * Run: node scripts/test-fix0103-relay-ssrf.js
 *
 * Everything here is local. DNS, outbound requests and listing writes are
 * stubbed. No production endpoint is contacted and no exploit payload is sent.
 */

const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const TEST_KEY = 'fix0103-local-test-only-key';
const ROOT = path.join(__dirname, '..');
process.env.RELAY_ADMIN_KEY = TEST_KEY;

const handler = require('../handlers/relay-csv-import');
const T = handler._test;

let passed = 0;
function pass(name) {
  passed++;
  console.log('  PASS ' + name);
}

const CSV = 'title,price,imageUrl\nWidget,10,https://images.example.com/widget.jpg';

function makeReq(opts) {
  opts = opts || {};
  const req = {
    method: opts.method || 'POST',
    headers: opts.headers || {},
    url: opts.url || '/api/relay-csv-import',
    resumed: false,
    body: opts.body
  };
  req.resume = function () { req.resumed = true; };
  req.on = function () {};
  req.destroy = function () {};
  return req;
}

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    raw: '',
    ended: false,
    body: null,
    setHeader: function (name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end: function (body) {
      this.raw = body == null ? '' : String(body);
      this.ended = true;
      try { this.body = JSON.parse(this.raw); } catch (e) { this.body = null; }
    }
  };
  return res;
}

function fakeMarketplace() {
  const calls = [];
  return {
    calls: calls,
    createListing: async function (data) {
      calls.push(data);
      return Object.assign({ id: 'lst_test_' + calls.length, status: 'active' }, data);
    }
  };
}

function fakeImageFetcher() {
  const state = { calls: 0 };
  state.fn = async function () {
    state.calls++;
    return 'data:image/jpeg;base64,AAAA';
  };
  return state;
}

function validBody(extra) {
  return Object.assign({
    csv: CSV,
    marketplaceId: 'market-1',
    sellerId: 'seller-1',
    downloadImages: true,
    delayMs: 100
  }, extra || {});
}

async function runHandler(req, deps) {
  const res = makeRes();
  await handler(req, res, deps);
  return res;
}

function publicLookup() {
  return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
}

function lookupFor(addresses) {
  return function () { return Promise.resolve(addresses); };
}

function fakeResponse(opts) {
  opts = opts || {};
  const res = new EventEmitter();
  res.statusCode = opts.status || 200;
  res.headers = opts.headers || {};
  res.socket = { remoteAddress: opts.remote || '93.184.216.34' };
  res.destroy = function () { res.destroyed = true; };
  res.resume = function () {};
  const chunks = opts.chunks || [];
  queueMicrotask(function () {
    for (let i = 0; i < chunks.length; i++) res.emit('data', Buffer.from(chunks[i]));
    if (!res.destroyed) res.emit('end');
  });
  return res;
}

function requestScript(script) {
  return function requestImpl(target, options, callback) {
    const req = new EventEmitter();
    req.destroy = function () { req.destroyed = true; };
    req.setTimeout = function () {};
    req.end = function () {
      queueMicrotask(function () {
        try { script({ target: target, options: options, callback: callback, req: req }); }
        catch (e) { req.emit('error', e); }
      });
    };
    return req;
  };
}

async function rejectsNeutral(name, promise) {
  await assert.rejects(promise, function (err) {
    assert.strictEqual(err && err.message, 'image_unavailable');
    return true;
  });
  pass(name);
}

(async function main() {
  console.log('FIX-0103 authorization');

  // Server credential unset: reject before any side effect, without naming config.
  delete process.env.RELAY_ADMIN_KEY;
  {
    const market = fakeMarketplace();
    const image = fakeImageFetcher();
    const res = await runHandler(
      makeReq({ headers: { 'x-relay-admin-key': TEST_KEY }, body: validBody() }),
      { marketplace: market, downloadImage: image.fn }
    );
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(market.calls.length, 0);
    assert.strictEqual(image.calls, 0);
    assert.ok(!/RELAY_ADMIN_KEY/.test(res.raw));
    assert.ok(!/data:image/.test(res.raw));
    pass('server credential unset fails closed before side effects');
  }
  process.env.RELAY_ADMIN_KEY = TEST_KEY;

  // Missing client credential.
  {
    const market = fakeMarketplace();
    const image = fakeImageFetcher();
    const res = await runHandler(makeReq({ body: validBody() }),
      { marketplace: market, downloadImage: image.fn });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(market.calls.length, 0);
    assert.strictEqual(image.calls, 0);
    assert.ok(!/data:image/.test(res.raw));
    pass('missing client credential is 401 with no fetch or mutation');
  }

  // Wrong client credential.
  {
    const market = fakeMarketplace();
    const image = fakeImageFetcher();
    const res = await runHandler(
      makeReq({ headers: { 'x-relay-admin-key': 'wrong-key' }, body: validBody() }),
      { marketplace: market, downloadImage: image.fn }
    );
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(market.calls.length, 0);
    assert.strictEqual(image.calls, 0);
    assert.ok(!res.raw.includes('wrong-key'));
    assert.ok(!res.raw.includes(TEST_KEY));
    pass('wrong client credential is 403 with no fetch or mutation');
  }

  // Query-string credential must be ignored.
  {
    const market = fakeMarketplace();
    const res = await runHandler(
      makeReq({ url: '/api/relay-csv-import?key=' + TEST_KEY, body: validBody() }),
      { marketplace: market, downloadImage: fakeImageFetcher().fn }
    );
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(market.calls.length, 0);
    pass('query-string credential is ignored');
  }

  // Correct header reaches authorized processing.
  {
    const market = fakeMarketplace();
    const image = fakeImageFetcher();
    const res = await runHandler(
      makeReq({ headers: { 'x-relay-admin-key': TEST_KEY }, body: validBody() }),
      { marketplace: market, downloadImage: image.fn }
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(market.calls.length, 1);
    assert.strictEqual(image.calls, 1);
    assert.strictEqual(res.body.created, 1);
    assert.ok(!/data:image/.test(res.raw), 'authorized response must not echo base64');
    pass('correct header reaches processing and returns a bounded response');
  }

  // Unauthorized request must not read attacker-controlled body content.
  {
    let bodyRead = false;
    const guardedBody = {};
    Object.defineProperty(guardedBody, 'csv', {
      get: function () { bodyRead = true; return CSV; }
    });
    const res = await runHandler(makeReq({ body: guardedBody }),
      { marketplace: fakeMarketplace(), downloadImage: fakeImageFetcher().fn });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(bodyRead, false);
    pass('unauthorized request does not parse the body');
  }

  // OPTIONS must not grant an origin or require the credential.
  {
    const res = await runHandler(makeReq({ method: 'OPTIONS' }), {});
    assert.strictEqual(res.statusCode, 204);
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    assert.ok(/x-relay-admin-key/.test(res.headers['access-control-allow-headers']));
    pass('OPTIONS is 204 without an origin grant');
  }

  // Non-POST is rejected without auth data.
  {
    const res = await runHandler(makeReq({ method: 'GET' }), {});
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(res.headers.allow, 'POST, OPTIONS');
    pass('non-POST method is 405');
  }

  console.log('FIX-0103 SSRF policy');

  const prohibited = [
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '100.64.0.1',
    '169.254.169.254', '0.0.0.0', '224.0.0.1', '240.0.0.1',
    '::1', 'fc00::1', 'fe80::1', 'fec0::1', 'ff02::1', '::', '2001:db8::1',
    '::ffff:10.0.0.1', '64:ff9b::1'
  ];
  prohibited.forEach(function (address) {
    assert.strictEqual(T.isProhibitedAddress(address), true, address);
  });
  assert.strictEqual(T.isProhibitedAddress('8.8.8.8'), false);
  assert.strictEqual(T.isProhibitedAddress('2606:4700:4700::1111'), false);
  pass('address policy blocks loopback, private, link-local, metadata, CGNAT, multicast and reserved ranges');

  await rejectsNeutral('HTTP is rejected',
    T.validateImageUrl('http://images.example.com/x', publicLookup));
  await rejectsNeutral('data URI is rejected',
    T.validateImageUrl('data:image/jpeg;base64,AAAA', publicLookup));
  await rejectsNeutral('embedded URL credentials are rejected',
    T.validateImageUrl('https://user:pass@images.example.com/x', publicLookup));
  await rejectsNeutral('localhost name is rejected',
    T.validateImageUrl('https://localhost/x', publicLookup));
  await rejectsNeutral('loopback IPv4 literal is rejected',
    T.validateImageUrl('https://127.0.0.1/x', publicLookup));
  await rejectsNeutral('private IPv4 literal is rejected',
    T.validateImageUrl('https://10.0.0.1/x', publicLookup));
  await rejectsNeutral('link-local metadata literal is rejected',
    T.validateImageUrl('https://169.254.169.254/latest/meta-data/', publicLookup));
  await rejectsNeutral('loopback IPv6 literal is rejected',
    T.validateImageUrl('https://[::1]/x', publicLookup));
  await rejectsNeutral('prohibited IPv6 literal is rejected',
    T.validateImageUrl('https://[fc00::1]/x', publicLookup));
  await rejectsNeutral('hostname resolving to a prohibited address is rejected',
    T.validateImageUrl('https://images.example.com/x',
      lookupFor([{ address: '127.0.0.1', family: 4 }])));
  await rejectsNeutral('mixed DNS answers containing a prohibited address are rejected',
    T.validateImageUrl('https://images.example.com/x',
      lookupFor([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }])));
  await rejectsNeutral('DNS failure is neutral',
    T.validateImageUrl('https://images.example.com/x', async function () {
      throw new Error('secret-dns-detail');
    }));
  await rejectsNeutral('empty DNS answers are rejected',
    T.validateImageUrl('https://images.example.com/x', lookupFor([])));
  await rejectsNeutral('numeric host representation is rejected',
    T.validateImageUrl('https://2130706433/x', publicLookup));
  await rejectsNeutral('hex host representation is rejected',
    T.validateImageUrl('https://0x7f000001/x', publicLookup));

  {
    const checked = await T.validateImageUrl('https://images.example.com/x.jpg', publicLookup);
    assert.strictEqual(checked.host, 'images.example.com');
    assert.strictEqual(checked.addresses.length, 1);
    pass('allowed public HTTPS image URL passes validation');
  }

  console.log('FIX-0103 image fetch containment');

  {
    const data = await T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.callback(fakeResponse({
          headers: { 'content-type': 'image/jpeg' },
          chunks: ['abc']
        }));
      })
    });
    assert.strictEqual(data, 'data:image/jpeg;base64,YWJj');
    pass('allowed HTTPS image fixture passes');
  }

  {
    let calls = 0;
    await rejectsNeutral('redirect to a prohibited destination is rejected',
      T.downloadImage('https://images.example.com/x.jpg', {
        lookup: publicLookup,
        request: requestScript(function (ctx) {
          calls++;
          ctx.callback(fakeResponse({
            status: 302,
            headers: { location: 'https://127.0.0.1/x' }
          }));
        })
      }));
    assert.strictEqual(calls, 1);
  }

  {
    let calls = 0;
    await rejectsNeutral('redirect to HTTP is rejected',
      T.downloadImage('https://images.example.com/x.jpg', {
        lookup: publicLookup,
        request: requestScript(function (ctx) {
          calls++;
          ctx.callback(fakeResponse({
            status: 302,
            headers: { location: 'http://images.example.com/x' }
          }));
        })
      }));
    assert.strictEqual(calls, 1);
  }

  {
    let calls = 0;
    await rejectsNeutral('excessive redirects are rejected',
      T.downloadImage('https://images.example.com/x.jpg', {
        lookup: publicLookup,
        request: requestScript(function (ctx) {
          calls++;
          ctx.callback(fakeResponse({
            status: 302,
            headers: { location: 'https://images.example.com/next' }
          }));
        })
      }));
    assert.strictEqual(calls, T.MAX_REDIRECTS + 1);
  }

  await rejectsNeutral('timeout fails closed',
    T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.req.emit('timeout');
      })
    }));

  await rejectsNeutral('oversized streaming response stops at the cap',
    T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.callback(fakeResponse({
          headers: { 'content-type': 'image/jpeg' },
          chunks: [Buffer.alloc(T.MAX_IMAGE_BYTES + 1, 1)]
        }));
      })
    }));

  await rejectsNeutral('declared content length above the cap is rejected',
    T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.callback(fakeResponse({
          headers: {
            'content-type': 'image/jpeg',
            'content-length': String(T.MAX_IMAGE_BYTES + 1)
          },
          chunks: ['abc']
        }));
      })
    }));

  await rejectsNeutral('non-image content type is rejected',
    T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.callback(fakeResponse({
          headers: { 'content-type': 'text/html' },
          chunks: ['<html>']
        }));
      })
    }));

  await rejectsNeutral('prohibited remote socket address is rejected',
    T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.callback(fakeResponse({
          headers: { 'content-type': 'image/jpeg' },
          chunks: ['abc'],
          remote: '10.0.0.1'
        }));
      })
    }));

  await rejectsNeutral('network errors do not disclose response bytes',
    T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.req.emit('error', new Error('secret-body-bytes'));
      })
    }));

  await rejectsNeutral('empty image response is rejected',
    T.downloadImage('https://images.example.com/x.jpg', {
      lookup: publicLookup,
      request: requestScript(function (ctx) {
        ctx.callback(fakeResponse({
          headers: { 'content-type': 'image/jpeg' },
          chunks: []
        }));
      })
    }));

  console.log('FIX-0103 compatibility and static checks');

  {
    const market = fakeMarketplace();
    const res = await runHandler(
      makeReq({ headers: { 'x-relay-admin-key': TEST_KEY }, body: validBody({ downloadImages: false }) }),
      { marketplace: market, downloadImage: fakeImageFetcher().fn }
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.created, 1);
    assert.strictEqual(res.body.failed, 0);
    assert.strictEqual(market.calls.length, 1);
    assert.ok(!/data:image/.test(res.raw));
    pass('valid authorized import still produces a bounded result');
  }

  {
    const market = fakeMarketplace();
    const failing = { calls: 0 };
    failing.fn = async function () { failing.calls++; throw new Error('secret-image-bytes'); };
    const res = await runHandler(
      makeReq({ headers: { 'x-relay-admin-key': TEST_KEY }, body: validBody() }),
      { marketplace: market, downloadImage: failing.fn }
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.created, 1);
    assert.strictEqual(res.body.imagesFailed, 1);
    assert.strictEqual(market.calls.length, 1);
    assert.ok(!/secret-image-bytes/.test(res.raw));
    pass('image failure is neutral and does not fail the authorized listing');
  }

  {
    const header = 'title,price\n';
    const rows = Array.from({ length: T.MAX_IMPORT_ROWS + 1 }, function (_, i) {
      return 'Widget ' + i + ',10';
    }).join('\n');
    const res = await runHandler(
      makeReq({
        headers: { 'x-relay-admin-key': TEST_KEY },
        body: validBody({ csv: header + rows, downloadImages: false })
      }),
      { marketplace: fakeMarketplace(), downloadImage: fakeImageFetcher().fn }
    );
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'row limit exceeded');
    pass('authorized import is bounded by the row limit');
  }

  {
    const res = await runHandler(
      makeReq({
        headers: { 'x-relay-admin-key': TEST_KEY },
        body: validBody({ csv: 'x'.repeat(T.MAX_CSV_BYTES + 1), downloadImages: false })
      }),
      { marketplace: fakeMarketplace(), downloadImage: fakeImageFetcher().fn }
    );
    assert.strictEqual(res.statusCode, 413);
    assert.strictEqual(res.body.error, 'payload too large');
    pass('authorized import is bounded by the payload limit');
  }

  {
    const source = fs.readFileSync(path.join(ROOT, 'handlers/relay-csv-import.js'), 'utf8');
    assert.ok(/timingSafeEqual/.test(source));
    assert.ok(/x-relay-admin-key/.test(source));
    assert.ok(!/access-control-allow-origin/i.test(source));
    pass('source uses a timing-safe header check and grants no CORS origin');
  }

  {
    const route = fs.readFileSync(path.join(ROOT, 'api/[...route].js'), 'utf8');
    assert.ok(route.indexOf("'relay-csv-import': require('../handlers/relay-csv-import')") >= 0);
    pass('route registration is unchanged');
  }

  {
    const demo = fs.readFileSync(path.join(ROOT, 'scraper-relay-demo.js'), 'utf8');
    assert.ok(!new RegExp(TEST_KEY).test(demo), 'test key must not be embedded in the demo');
    assert.ok(/process\.env\.RELAY_ADMIN_KEY/.test(demo));
    assert.ok(/x-relay-admin-key/.test(demo));
    pass('demo reads the credential from its environment and sends the dedicated header');
  }

  delete process.env.RELAY_ADMIN_KEY;
  console.log('FIX-0103 PASS: ' + passed + ' checks');
})().catch(function (err) {
  console.error('FIX-0103 FAIL:', err && err.stack || err);
  process.exit(1);
});
