/**
 * scripts/test-diagnosis-manifest.js — deployed paginated manifest endpoint.
 * Run: node scripts/test-diagnosis-manifest.js
 *
 *   E1  full enumeration == committed ID set (all 20 domains, 886,944)
 *   E2  id lookup + route + ref present; ref identical across pages
 *   A1  SNAPSHOT CONSISTENCY: manifest mutates upstream between page 1 and
 *       page 2 — ?ref pinning still serves the original blob
 *   B   ECONOMICS: full 38-page domain traversal makes exactly 2 upstream
 *       calls and downloads the manifest bytes exactly once (measured)
 *   C   malformed blob is NOT cached (no poison); ref/domain mismatch -> 409
 *   E3  invalid domain / id / ref rejected
 *   E4  one omitted diagnosis per domain retrievable via its route (corpus)
 *   E5  upstream failure -> 502, never fake empty-success
 *   E7  odd page size (7) — no boundary duplicates or gaps
 *   E8  route guard — traversal/host/query-escape suffixes contained
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets/data/deep');
var FULL = process.env.LIMEN_FULL_DOMAINS_DIR || 'C:\\Users\\Chris\\Limen-Helix\\assets\\data\\domains';
var KEYS = [
  'p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
];

process.env.GITHUB_TOKEN = 'test-token';

var SHA = {}; KEYS.forEach(function (k, i) { SHA[k] = (i + 1).toString(16).padStart(40, '0'); });
var NEW_SHA = 'f'.repeat(40);
var BAD_SHA = 'b'.repeat(40);
var EVIL_SHA = 'e'.repeat(40);

var BLOBS = {}, fetchCalls = [], upstreamBytes = 0;
function blobBody(sha) {
  var o = globalThis.__BLOB_OVERRIDE;
  if (o && Object.prototype.hasOwnProperty.call(o, sha)) return o[sha];
  return BLOBS[sha];
}
function resp(st) {
  return Promise.resolve({ ok: st === 200, status: st, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
}
global.fetch = function (url, opts) {
  var u = String(url);
  fetchCalls.push(u);
  var blobM = u.match(/\/git\/blobs\/(.+)$/);
  if (blobM) {
    if (globalThis.__UPSTREAM_STATUS != null) return resp(globalThis.__UPSTREAM_STATUS);
    var body = blobBody(blobM[1]);
    if (body === undefined || body === null) return resp(404);
    upstreamBytes += Buffer.byteLength(body);
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve({}); } });
  }
  var cm = u.match(/\/contents\/assets\/data\/deep\/([a-z0-9_]+)-diagnosis-manifest\.json/);
  if (cm) {
    if (globalThis.__UPSTREAM_STATUS != null) return resp(globalThis.__UPSTREAM_STATUS);
    var sha = (globalThis.__SHA_OVERRIDE && globalThis.__SHA_OVERRIDE[cm[1]]) || (SHA[cm[1]]);
    if (blobBody(sha) === undefined) return resp(404);
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ sha: sha }); }, text: function () { return Promise.resolve(''); } });
  }
  return resp(500);
};

var handler = require(path.join(ROOT, 'handlers', 'diagnosis-manifest.js'));
function mockRes() {
  return {
    statusCode: 200, body: null, headers: {},
    status: function (c) { this.statusCode = c; return this; },
    setHeader: function (k, v) { this.headers[k] = v; },
    json: function (o) { this.body = o; return this; }
  };
}
function call(query) { var res = mockRes(); return handler({ query: query }, res).then(function () { return res; }); }
function reset() { handler._clearCache(); fetchCalls = []; upstreamBytes = 0; globalThis.__UPSTREAM_STATUS = null; globalThis.__SHA_OVERRIDE = null; globalThis.__BLOB_OVERRIDE = null; }

(async function () {
  KEYS.forEach(function (k) { BLOBS[SHA[k]] = fs.readFileSync(path.join(DEEP, k + '-diagnosis-manifest.json'), 'utf8'); });

  console.log('E1: full enumeration == committed ID set (all 20 domains)');
  var totalIds = 0;
  for (var ki = 0; ki < KEYS.length; ki++) {
    var k = KEYS[ki];
    var committed = JSON.parse(BLOBS[SHA[k]]);
    var seen = {}, page = 0, pages = 1;
    while (page < pages) {
      var r = await call({ domain: k, page: String(page), size: '1000' });
      if (r.statusCode !== 200) { assert(k + ' page ' + page, false, 'got ' + r.statusCode); break; }
      pages = r.body.pages;
      (r.body.entries || []).forEach(function (e) { seen[e[0]] = true; });
      page++;
    }
    var committedIds = {};
    (committed.entries || []).forEach(function (e) { committedIds[e[0]] = true; });
    var missing = Object.keys(committedIds).filter(function (id) { return !seen[id]; }).length;
    var extra = Object.keys(seen).filter(function (id) { return !committedIds[id]; }).length;
    totalIds += Object.keys(seen).length;
    assert(k + ': enumerated == committed, 0 missing/extra',
      missing === 0 && extra === 0 && Object.keys(seen).length === committed.count,
      'missing=' + missing + ' extra=' + extra);
  }
  console.log('    total enumerated across fleet: ' + totalIds);

  console.log('E2: id lookup + route + ref consistency across pages');
  var fin = JSON.parse(BLOBS[SHA.finance]);
  var sample = fin.entries[123];
  var r2 = await call({ domain: 'finance', id: sample[0] });
  assert('found + route encoded', r2.body.found === true && r2.body.route === '/api/fetch-portal?domainId=finance_' + encodeURIComponent(sample[1]));
  assert('ref present', r2.body.ref === SHA.finance);
  var refA = (await call({ domain: 'finance', page: '0', size: '500' })).body.ref;
  var refB = (await call({ domain: 'finance', page: '3', size: '500' })).body.ref;
  assert('same ref across pages', refA === refB && refA === SHA.finance);

  console.log('A1: snapshot consistency — upstream mutates between page 1 and page 2');
  reset(); KEYS.forEach(function (k) { BLOBS[SHA[k]] = BLOBS[SHA[k]] || fs.readFileSync(path.join(DEEP, k + '-diagnosis-manifest.json'), 'utf8'); });
  var p1 = await call({ domain: 'finance', page: '0', size: '1000' });
  var pinnedRef = p1.body.ref;
  // upstream publishes a NEW manifest (different blob)
  var mutated = JSON.parse(BLOBS[SHA.finance]);
  mutated.entries = mutated.entries.slice(0, 10);
  mutated.count = 10;
  globalThis.__SHA_OVERRIDE = { finance: NEW_SHA };
  globalThis.__BLOB_OVERRIDE = { [NEW_SHA]: JSON.stringify(mutated) };
  var p2pinned = await call({ domain: 'finance', page: '1', size: '1000', ref: pinnedRef });
  assert('pinned page 2 serves ORIGINAL blob', p2pinned.body.count === fin.count && p2pinned.body.ref === pinnedRef,
    'count=' + p2pinned.body.count);
  var p2unpinned = await call({ domain: 'finance', page: '1', size: '1000' });
  assert('unpinned page 2 within meta-TTL ALSO serves the old blob (warm consistency)',
    p2unpinned.body.count === fin.count && p2unpinned.body.ref === pinnedRef,
    'count=' + p2unpinned.body.count);
  handler._clearCache();   // simulate meta-TTL expiry
  var p3fresh = await call({ domain: 'finance', page: '1', size: '1000' });
  assert('after refresh the new blob resolves (mutation was real)',
    p3fresh.body.count === 10 && p3fresh.body.ref === NEW_SHA,
    'count=' + p3fresh.body.count);

  console.log('B: economics — full domain traversal (measured)');
  reset();
  var pages38 = Math.ceil(fin.count / 1000);
  var first = await call({ domain: 'finance', page: '0', size: '1000' });
  var ref38 = first.body.ref;
  for (var pg = 1; pg < pages38; pg++) await call({ domain: 'finance', page: String(pg), size: '1000', ref: ref38 });
  var metaCalls = fetchCalls.filter(function (u) { return u.indexOf('/contents/') !== -1; }).length;
  var blobCalls = fetchCalls.filter(function (u) { return u.indexOf('/git/blobs/') !== -1; }).length;
  console.log('    ' + pages38 + ' pages: ' + metaCalls + ' metadata + ' + blobCalls + ' blob calls, ' + (upstreamBytes / 1e6).toFixed(1) + 'MB upstream');
  assert('exactly 1 metadata call', metaCalls === 1, String(metaCalls));
  assert('exactly 1 blob download', blobCalls === 1, String(blobCalls));
  assert('manifest bytes transferred exactly once', upstreamBytes === Buffer.byteLength(BLOBS[SHA.finance]),
    upstreamBytes + ' vs ' + Buffer.byteLength(BLOBS[SHA.finance]));

  console.log('C: malformed blob not cached; ref/domain mismatch -> 409');
  reset();
  globalThis.__BLOB_OVERRIDE = { [BAD_SHA]: 'not json' };
  var rc = await call({ domain: 'finance', ref: BAD_SHA });
  assert('malformed blob -> 502', rc.statusCode === 502, 'got ' + rc.statusCode);
  globalThis.__BLOB_OVERRIDE = { [BAD_SHA]: BLOBS[SHA.finance] };
  var rc2 = await call({ domain: 'finance', ref: BAD_SHA });
  assert('not poisoned: fixed body succeeds on retry', rc2.statusCode === 200, 'got ' + rc2.statusCode);
  var rm = await call({ domain: 'defense', ref: SHA.finance });
  assert('ref/domain mismatch -> 409', rm.statusCode === 409, 'got ' + rm.statusCode);
  globalThis.__BLOB_OVERRIDE = null;

  console.log('E3: invalid domain / id / ref rejected');
  assert('400 invalid domain', (await call({ domain: 'nope' })).statusCode === 400);
  assert('400 invalid id', (await call({ domain: 'finance', id: 'bad id!' })).statusCode === 400);
  assert('400 invalid ref', (await call({ domain: 'finance', ref: 'notasha' })).statusCode === 400);

  console.log('E4: one omitted diagnosis per domain retrievable via its route');
  if (fs.existsSync(FULL)) {
    for (var k2 = 0; k2 < KEYS.length; k2++) {
      var key2 = KEYS[k2];
      var digest = JSON.parse(fs.readFileSync(path.join(DEEP, key2 + '-diagnosis-digest.json'), 'utf8'));
      var selected = {};
      (digest.diagnoses || []).forEach(function (d) { selected[d.id] = true; });
      var manifest = JSON.parse(fs.readFileSync(path.join(DEEP, key2 + '-diagnosis-manifest.json'), 'utf8'));
      var omitted = (manifest.entries || []).filter(function (e) { return !selected[e[0]]; });
      assert(key2 + ': omitted exist beyond window', omitted.length > 0);
      var probe = omitted[0];
      var routeFile = path.join(FULL, key2 + '_' + probe[1] + '.json');
      var ok = fs.existsSync(routeFile) &&
        (JSON.parse(fs.readFileSync(routeFile, 'utf8')).issues || []).some(function (i) { return i.id === probe[0]; });
      assert(key2 + ': route file contains omitted dx', ok, routeFile);
    }
  } else { console.log('  SKIP E4: full tree not present'); }

  console.log('E5: upstream failure -> 502, never fake empty-success');
  reset();
  globalThis.__UPSTREAM_STATUS = 500;
  var r5 = await call({ domain: 'defense', page: '0' });
  assert('502 on upstream 500', r5.statusCode === 502 && !!r5.body.error && !r5.body.entries);
  globalThis.__UPSTREAM_STATUS = null;

  console.log('E7: odd page size (7) — boundary integrity');
  reset();
  var seen7 = {}, dup7 = 0, page7 = 0, pages7 = 1, ref7 = null;
  while (page7 < pages7) {
    var q = { domain: 'finance', page: String(page7), size: '7' };
    if (ref7) q.ref = ref7;
    var r7 = await call(q);
    ref7 = r7.body.ref;
    pages7 = r7.body.pages;
    (r7.body.entries || []).forEach(function (e) { if (seen7[e[0]]) dup7++; seen7[e[0]] = true; });
    page7++;
  }
  assert('no boundary duplicates', dup7 === 0, dup7 + ' dups');
  assert('no gaps', Object.keys(seen7).length === fin.count, Object.keys(seen7).length + ' vs ' + fin.count);

  console.log('E8: tainted manifest (traversal/host/encoded/query-escape suffixes) rejected wholesale');
  reset();
  var evilManifest = JSON.stringify({ domain: 'finance', source: 'x', count: 5, entries: [
    ['GOOD', 'good_suffix', 3],
    ['E1', '../etc/passwd', 3],
    ['E2', '..%2f..%2fsecret', 3],
    ['E3', 'https://evil.example/x', 3],
    ['E4', 'a?x=1&y=2', 3]
  ] });
  globalThis.__BLOB_OVERRIDE = { [EVIL_SHA]: evilManifest };
  var blobCalls8 = fetchCalls.filter(function (u) { return u.indexOf('/git/blobs/') !== -1; }).length;
  var r8 = await call({ domain: 'finance', page: '0', ref: EVIL_SHA });
  assert('tainted manifest -> 422 (entry-slug-shape)', r8.statusCode === 422 && /entry-slug-shape/.test(r8.body.reason || ''), JSON.stringify(r8.body));
  await call({ domain: 'finance', id: 'E1', ref: EVIL_SHA });
  var blobCalls8b = fetchCalls.filter(function (u) { return u.indexOf('/git/blobs/') !== -1; }).length;
  assert('tainted blob never cached (every call re-fetches)', blobCalls8b === blobCalls8 + 2, blobCalls8 + ' -> ' + blobCalls8b);
  globalThis.__BLOB_OVERRIDE = null;

  console.log('A2: raw content is fetched by the EXACT metadata sha (branch move cannot swap bodies)');
  reset();
  var shaCallsBefore = fetchCalls.length;
  await call({ domain: 'finance', page: '0', size: '1000' });
  var newCalls = fetchCalls.slice(shaCallsBefore);
  var metaIdx = newCalls.findIndex(function (u) { return u.indexOf('/contents/') !== -1; });
  var blobIdx = newCalls.findIndex(function (u) { return u.indexOf('/git/blobs/') !== -1; });
  assert('metadata call precedes content call', metaIdx !== -1 && blobIdx !== -1 && blobIdx > metaIdx, JSON.stringify(newCalls));
  assert('content call targets the blob API by exact sha', newCalls[blobIdx].indexOf('/git/blobs/' + SHA.finance) !== -1, newCalls[blobIdx]);
  var branchQualified = newCalls.slice(metaIdx + 1).filter(function (u) { return u.indexOf('diagnosis-manifest.json') !== -1; });
  assert('no branch-qualified content request after metadata', branchQualified.length === 0, JSON.stringify(branchQualified));

  console.log('A3: cache-cleared pages across separate handler instances honor the pin');
  reset();
  var i1 = await call({ domain: 'defense', page: '0', size: '500' });
  handler._clearCache();                       // simulate a different serverless instance
  var i2 = await call({ domain: 'defense', page: '1', size: '500', ref: i1.body.ref });
  handler._clearCache();                       // and a third
  var i3 = await call({ domain: 'defense', page: '2', size: '500', ref: i1.body.ref });
  assert('same ref across instances', i2.body.ref === i1.body.ref && i3.body.ref === i1.body.ref);
  var inst1 = JSON.stringify((await call({ domain: 'defense', page: '1', size: '500', ref: i1.body.ref })).body.entries);
  assert('identical page content across instances', JSON.stringify(i2.body.entries) === inst1);

  console.log('A4: full fleet pagination with ONE immutable ref per domain');
  reset();
  var fleetOk = true, fleetTotal = 0;
  for (var k4 = 0; k4 < KEYS.length; k4++) {
    var key4 = KEYS[k4];
    var firstPage = await call({ domain: key4, page: '0', size: '1000' });
    var ref4 = firstPage.body.ref;
    var committed4 = JSON.parse(BLOBS[ref4]);
    var seen4 = {}, pages4 = firstPage.body.pages;
    firstPage.body.entries.forEach(function (e) { seen4[e[0]] = true; });
    for (var pg4 = 1; pg4 < pages4; pg4++) {
      var rp = await call({ domain: key4, page: String(pg4), size: '1000', ref: ref4 });
      if (rp.body.ref !== ref4) fleetOk = false;
      (rp.body.entries || []).forEach(function (e) { seen4[e[0]] = true; });
    }
    fleetTotal += Object.keys(seen4).length;
    assert(key4 + ': pinned fleet enumeration == committed (' + committed4.count + ')',
      Object.keys(seen4).length === committed4.count &&
      (committed4.entries || []).every(function (e) { return seen4[e[0]]; }),
      'seen=' + Object.keys(seen4).length);
  }
  assert('one immutable ref per domain across all pages', fleetOk);
  console.log('    fleet pinned total: ' + fleetTotal + ' ids');

  console.log('S1-S5: schema gate — invalid blobs rejected WITHOUT cache admission');
  console.log('N1: ref spelling is normalized — uppercase and lowercase share one cache entry');
  handler._clearCache();
  fetchCalls = [];
  var upper = SHA.finance.toUpperCase();
  var rn1 = await call({ domain: 'finance', ref: upper });
  assert('uppercase ref accepted and normalized in response', rn1.statusCode === 200 && rn1.body.ref === SHA.finance, rn1.body.ref);
  var blobsAfterFirst = fetchCalls.filter(function (u) { return u.indexOf('/git/blobs/') !== -1; }).length;
  var rn2 = await call({ domain: 'finance', ref: SHA.finance });
  var blobsAfterSecond = fetchCalls.filter(function (u) { return u.indexOf('/git/blobs/') !== -1; }).length;
  assert('lowercase spelling hits the same cache entry (no second download)', blobsAfterSecond === blobsAfterFirst,
    blobsAfterFirst + ' -> ' + blobsAfterSecond);
  function schemaCase(name, body, expectReason) {
    return (async function () {
      handler._clearCache();
      fetchCalls = [];
      var sha = 'd'.repeat(40);
      globalThis.__BLOB_OVERRIDE = { [sha]: body };
      var r = await call({ domain: 'finance', ref: sha });
      assert(name + ' -> 422', r.statusCode === 422, 'got ' + r.statusCode + ' :: ' + JSON.stringify(r.body));
      if (expectReason) assert(name + ' reason: ' + expectReason, (r.body.reason || '').indexOf(expectReason) !== -1, r.body.reason);
      var blobCallsBefore = fetchCalls.filter(function (u) { return u.indexOf('/git/blobs/') !== -1; }).length;
      await call({ domain: 'finance', ref: sha });
      var blobCallsAfter = fetchCalls.filter(function (u) { return u.indexOf('/git/blobs/') !== -1; }).length;
      assert(name + ': NOT admitted to cache (re-fetched)', blobCallsAfter === blobCallsBefore + 1,
        blobCallsBefore + ' -> ' + blobCallsAfter);
      globalThis.__BLOB_OVERRIDE = null;
    })();
  }
  await schemaCase('S1 arbitrary valid-JSON blob', JSON.stringify({ hello: 'world', entries: 'nope' }), 'manifest-domain');
  await schemaCase('S2 no-domain manifest', JSON.stringify({ count: 1, entries: [['X', 'y', 2]] }), 'manifest-domain');
  await schemaCase('S3 count mismatch', JSON.stringify({ domain: 'finance', count: 99, entries: [['X', 'y', 2]] }), 'count-missing-or-mismatch');
  await schemaCase('S3b count missing', JSON.stringify({ domain: 'finance', entries: [['X', 'y', 2]] }), 'count-missing-or-mismatch');
  await schemaCase('S3c count nonnumeric', JSON.stringify({ domain: 'finance', count: 'two', entries: [['X', 'y', 2]] }), 'count-missing-or-mismatch');
  await schemaCase('S4 bad entry shape', JSON.stringify({ domain: 'finance', count: 2, entries: [['X', 'y', 2], [42, 'y', 2]] }), 'entry-id-shape');

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
