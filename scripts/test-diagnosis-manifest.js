/**
 * scripts/test-diagnosis-manifest.js — deployed paginated manifest endpoint.
 * Run: node scripts/test-diagnosis-manifest.js
 *
 *   E1  full enumeration through the endpoint == committed manifest ID set,
 *       exactly, for all 20 domains (886,944 ids)
 *   E2  id lookup returns the retrieval route; ref (blob sha) is consistent
 *       across every page of a traversal
 *   E3  invalid domain / invalid id rejected
 *   E4  one OMITTED (not in the selected 180) diagnosis per domain: its route
 *       file exists in the full tree and contains the diagnosis
 *       (skips honestly when the corpus is absent)
 *   E5  upstream GitHub failure -> 502, never a fake empty-success 200
 *   E6  malformed manifest JSON -> 502, not a crash or empty success
 *   E7  odd page size (7) enumerates with no boundary duplicates or gaps
 *   E8  route guard: a malicious slug suffix cannot leave the expected content
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

global.fetch = function (url, opts) {
  var accept = (opts && opts.headers && opts.headers.Accept) || '';
  var m = String(url).match(/\/contents\/assets\/data\/deep\/([a-z0-9_]+)-diagnosis-manifest\.json/);
  if (!m) return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
  if (globalThis.__UPSTREAM_STATUS != null) {
    var st = globalThis.__UPSTREAM_STATUS;
    return Promise.resolve({ ok: false, status: st, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
  }
  if (accept.indexOf('raw') !== -1) {
    var body = globalThis.__RAW_BODY !== undefined
      ? globalThis.__RAW_BODY
      : (fs.existsSync(path.join(DEEP, m[1] + '-diagnosis-manifest.json'))
          ? fs.readFileSync(path.join(DEEP, m[1] + '-diagnosis-manifest.json'), 'utf8')
          : null);
    if (body === null) return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve({}); } });
  }
  // metadata call
  if (!fs.existsSync(path.join(DEEP, m[1] + '-diagnosis-manifest.json'))) {
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
  }
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ sha: 'testsha-' + m[1] }); }, text: function () { return Promise.resolve(''); } });
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
function call(query) {
  var res = mockRes();
  return handler({ query: query }, res).then(function () { return res; });
}

(async function () {
  console.log('E1: full enumeration == committed ID set (all 20 domains)');
  var totalIds = 0;
  for (var ki = 0; ki < KEYS.length; ki++) {
    var k = KEYS[ki];
    var committed = JSON.parse(fs.readFileSync(path.join(DEEP, k + '-diagnosis-manifest.json'), 'utf8'));
    var seen = {}, page = 0, pages = 1;
    while (page < pages) {
      var r = await call({ domain: k, page: String(page), size: '1000' });
      if (r.statusCode !== 200) { assert(k + ' page ' + page + ' 200', false, 'got ' + r.statusCode); break; }
      pages = r.body.pages;
      (r.body.entries || []).forEach(function (e) { seen[e[0]] = true; });
      page++;
    }
    var committedIds = {};
    (committed.entries || []).forEach(function (e) { committedIds[e[0]] = true; });
    var missing = Object.keys(committedIds).filter(function (id) { return !seen[id]; }).length;
    var extra = Object.keys(seen).filter(function (id) { return !committedIds[id]; }).length;
    totalIds += Object.keys(seen).length;
    assert(k + ': enumerated ' + Object.keys(seen).length + ' == committed, 0 missing/extra',
      missing === 0 && extra === 0 && Object.keys(seen).length === committed.count,
      'missing=' + missing + ' extra=' + extra);
  }
  console.log('    total enumerated across fleet: ' + totalIds);

  console.log('E2: id lookup returns route; ref consistent across pages');
  var fin = JSON.parse(fs.readFileSync(path.join(DEEP, 'finance-diagnosis-manifest.json'), 'utf8'));
  var sample = fin.entries[123];
  var r2 = await call({ domain: 'finance', id: sample[0] });
  assert('found', r2.body.found === true);
  assert('route reconstructed + encoded', r2.body.route === '/api/fetch-portal?domainId=finance_' + encodeURIComponent(sample[1]), r2.body.route);
  assert('ref present on lookup', r2.body.ref === 'testsha-finance', r2.body.ref);
  var r2b = await call({ domain: 'finance', id: 'DOES_NOT_EXIST' });
  assert('not-found handled', r2b.body.found === false && r2b.body.route === null);
  var refA = (await call({ domain: 'finance', page: '0', size: '500' })).body.ref;
  var refB = (await call({ domain: 'finance', page: '3', size: '500' })).body.ref;
  assert('same ref across pages of one traversal', refA === refB && refA === 'testsha-finance', refA + ' vs ' + refB);

  console.log('E3: invalid domain / id rejected');
  assert('400 on invalid domain', (await call({ domain: 'not_a_domain' })).statusCode === 400);
  assert('400 on invalid id', (await call({ domain: 'finance', id: 'bad id!' })).statusCode === 400);

  console.log('E4: one omitted diagnosis per domain retrievable via its route');
  if (fs.existsSync(FULL)) {
    for (var k2 = 0; k2 < KEYS.length; k2++) {
      var key2 = KEYS[k2];
      var digest = JSON.parse(fs.readFileSync(path.join(DEEP, key2 + '-diagnosis-digest.json'), 'utf8'));
      var selected = {};
      (digest.diagnoses || []).forEach(function (d) { selected[d.id] = true; });
      var manifest = JSON.parse(fs.readFileSync(path.join(DEEP, key2 + '-diagnosis-manifest.json'), 'utf8'));
      var omitted = (manifest.entries || []).filter(function (e) { return !selected[e[0]]; });
      assert(key2 + ': omitted diagnoses exist beyond the window', omitted.length > 0, 'window == pool?');
      var probe = omitted[0];
      var routeFile = path.join(FULL, key2 + '_' + probe[1] + '.json');
      var ok = false;
      if (fs.existsSync(routeFile)) {
        var portal = JSON.parse(fs.readFileSync(routeFile, 'utf8'));
        ok = (portal.issues || []).some(function (i) { return i.id === probe[0]; });
      }
      assert(key2 + ': route file exists and contains omitted dx', ok, routeFile);
    }
  } else {
    console.log('  SKIP E4: full tree not present at ' + FULL);
  }

  console.log('E5: upstream failure -> 502, never fake empty-success');
  handler._clearCache();
  globalThis.__UPSTREAM_STATUS = 500;
  var r5 = await call({ domain: 'defense', page: '0' });
  assert('502 on upstream 500', r5.statusCode === 502, 'got ' + r5.statusCode);
  assert('error body, not empty entries', !!r5.body.error && !r5.body.entries);
  globalThis.__UPSTREAM_STATUS = null;
  handler._clearCache();

  console.log('E6: malformed manifest JSON -> 502, not a crash');
  globalThis.__RAW_BODY = 'this is not json';
  handler._clearCache();
  var r6 = await call({ domain: 'law', page: '0' });
  assert('502 on malformed JSON', r6.statusCode === 502, 'got ' + r6.statusCode);
  assert('no fake empty success', !!r6.body.error && !r6.body.entries);
  globalThis.__RAW_BODY = undefined;
  handler._clearCache();

  console.log('E7: odd page size enumerates with no boundary duplicates or gaps');
  var seen7 = {}, dup7 = 0, page7 = 0, pages7 = 1;
  while (page7 < pages7) {
    var r7 = await call({ domain: 'finance', page: String(page7), size: '7' });
    pages7 = r7.body.pages;
    (r7.body.entries || []).forEach(function (e) { if (seen7[e[0]]) dup7++; seen7[e[0]] = true; });
    page7++;
  }
  assert('no boundary duplicates', dup7 === 0, dup7 + ' dups');
  assert('no gaps (count == manifest)', Object.keys(seen7).length === fin.count,
    Object.keys(seen7).length + ' vs ' + fin.count);

  console.log('E8: route guard — malicious slug suffix cannot leave expected content');
  globalThis.__RAW_BODY = JSON.stringify({ domain: 'finance', source: 'x', count: 2, entries: [['GOOD_ID', 'good_suffix', 3], ['EVIL_ID', '../etc/passwd', 3]] });
  handler._clearCache();
  var r8 = await call({ domain: 'finance', id: 'EVIL_ID' });
  assert('malicious suffix -> found:false, route:null', r8.body.found === false && r8.body.route === null, JSON.stringify(r8.body));
  var r8b = await call({ domain: 'finance', id: 'GOOD_ID' });
  assert('clean suffix still routes', r8b.body.found === true && r8b.body.route === '/api/fetch-portal?domainId=finance_good_suffix');
  globalThis.__RAW_BODY = undefined;
  handler._clearCache();

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
