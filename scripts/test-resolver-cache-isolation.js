/**
 * scripts/test-resolver-cache-isolation.js — selection must not mutate the shared
 * treatment cache. Run: node scripts/test-resolver-cache-isolation.js
 *
 * Defect (review repro): Defense resolves CYBER_ATTACK alone; Technology later
 * resolves CYBER_ATTACK + DATA_BREACH. Because selection attached diagnosisIds
 * to the SHARED _deepTreatmentCache objects, the already-returned Defense package
 * retroactively gained DATA_BREACH. Selection now clones before attaching.
 *
 *   C1  first brain's returned package is byte-identical after the second resolve
 *   C2  second brain's entities carry their own correct association sets
 *   C3  cache objects themselves carry no per-call fields
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
var win = { location: { pathname: '/', search: '' }, addEventListener: function () {} };
global.window = win;
global.fetch = function (url) {
  var u = String(url);
  var m = u.match(/\/assets\/data\/domains\/([A-Za-z0-9_]+)\.json/);
  var file = m ? path.join(ROOT, 'assets/data/domains', m[1] + '.json') : null;
  if (file && fs.existsSync(file)) {
    var data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
  }
  return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
};
win.fetch = global.fetch;

eval(fs.readFileSync(path.join(ROOT, 'assets/js/domain-brains/portal-content-resolver.js'), 'utf8'));
var resolver = win.LIMENPortalContentResolver;
assert('resolver loaded', !!resolver);

(async function () {
  var r1 = await resolver.resolveForBrain({
    domainId: 'defense',
    diagnoses: [{ id: 'CYBER_ATTACK', active: true }]
  }, {});
  assert('defense package resolved', !!(r1 && r1.byDiagnosis.CYBER_ATTACK));
  var before = JSON.stringify((r1.byDiagnosis.CYBER_ATTACK.treatments || []).map(function (t) {
    return [t.nodeId, t.label, t.diagnosisIds];
  }));

  var r2 = await resolver.resolveForBrain({
    domainId: 'technology',
    diagnoses: [{ id: 'CYBER_ATTACK', active: true }, { id: 'DATA_BREACH', active: true }]
  }, {});
  assert('technology package resolved', !!(r2 && r2.byDiagnosis.CYBER_ATTACK && r2.byDiagnosis.DATA_BREACH));

  var after = JSON.stringify((r1.byDiagnosis.CYBER_ATTACK.treatments || []).map(function (t) {
    return [t.nodeId, t.label, t.diagnosisIds];
  }));
  console.log('C1: first brain\'s package unchanged after second brain resolves overlapping dx');
  assert('defense package byte-identical (no retroactive mutation)', before === after);
  assert('defense treatments carry only CYBER_ATTACK', (r1.byDiagnosis.CYBER_ATTACK.treatments || []).every(function (t) {
    return (t.diagnosisIds || []).indexOf('DATA_BREACH') === -1;
  }));

  console.log('C2: second brain carries its own correct associations');
  var techShared = (r2.byDiagnosis.CYBER_ATTACK.treatments || []).filter(function (t) {
    return (t.diagnosisIds || []).length > 1;
  });
  assert('technology sees shared associations where they exist', techShared.length === 0 || techShared.every(function (t) {
    return t.diagnosisIds.indexOf('CYBER_ATTACK') !== -1 && t.diagnosisIds.indexOf('DATA_BREACH') !== -1;
  }));

  console.log('C3: cache objects carry no per-call fields');
  var cache = resolver.getCache();
  assert('treatment cache populated', cache.treatments > 0, JSON.stringify(cache));
  var cacheContaminated = 0;
  ['CYBER_ATTACK::d0', 'DATA_BREACH::d0'].forEach(function (ck) {
    // resolve again and compare object identity of pool entries vs package entries
  });
  // Direct check: package entries must not be the same object references as a
  // fresh resolveForDiagnosis pool entries.
  var pool = await resolver.resolveForDiagnosis('CYBER_ATTACK', { eager: false });
  var pkgTx = r2.byDiagnosis.CYBER_ATTACK.treatments || [];
  var sharedRefs = 0;
  pkgTx.forEach(function (pt) {
    if (pool.indexOf(pt) !== -1) sharedRefs++;
  });
  assert('package entries are clones, not cache references', sharedRefs === 0, sharedRefs + ' shared refs');
  assert('pool entries carry no diagnosisIds from prior calls', pool.every(function (t) { return t.diagnosisIds === undefined; }));

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
