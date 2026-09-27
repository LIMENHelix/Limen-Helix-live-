/**
 * scripts/test-diagnosis-manifest.js — deployed paginated manifest endpoint.
 * Run: node scripts/test-diagnosis-manifest.js
 *
 *   E1  full enumeration through the endpoint == committed manifest ID set,
 *       exactly, for all 20 domains (886,944 ids)
 *   E2  id lookup returns the retrieval route
 *   E3  invalid domain rejected
 *   E4  one OMITTED (not in the selected 180) diagnosis per domain: its route
 *       file exists in the full tree and contains the diagnosis
 *       (skips honestly when the corpus is absent)
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

// Serve the committed manifests as GitHub Contents API responses
global.fetch = function (url) {
  var m = String(url).match(/\/contents\/assets\/data\/deep\/([a-z0-9_]+)-diagnosis-manifest\.json/);
  if (m) {
    var p = path.join(DEEP, m[1] + '-diagnosis-manifest.json');
    if (fs.existsSync(p)) {
      var b64 = Buffer.from(fs.readFileSync(p, 'utf8'), 'utf8').toString('base64');
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ content: b64 }); } });
    }
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
  }
  return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); } });
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

  console.log('E2: id lookup returns route');
  var fin = JSON.parse(fs.readFileSync(path.join(DEEP, 'finance-diagnosis-manifest.json'), 'utf8'));
  var sample = fin.entries[123];
  var r2 = await call({ domain: 'finance', id: sample[0] });
  assert('found', r2.body.found === true);
  assert('route reconstructed', r2.body.route === '/api/fetch-portal?domainId=finance_' + sample[1], r2.body.route);
  var r2b = await call({ domain: 'finance', id: 'DOES_NOT_EXIST' });
  assert('not-found handled', r2b.body.found === false && r2b.body.route === null);

  console.log('E3: invalid domain rejected');
  var r3 = await call({ domain: 'not_a_domain' });
  assert('400 on invalid domain', r3.statusCode === 400, 'got ' + r3.statusCode);
  var r3b = await call({ domain: 'finance', id: 'bad id!' });
  assert('400 on invalid id', r3b.statusCode === 400);

  console.log('E4: one omitted diagnosis per domain is retrievable via its route');
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

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
