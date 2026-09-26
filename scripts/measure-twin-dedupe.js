/**
 * scripts/measure-twin-dedupe.js — joint selection + cross-diagnosis dedupe.
 * Run: node scripts/measure-twin-dedupe.js
 *
 * Invariants under test (finance L1, all 6 root dx active, quota 200/dx):
 *   D1  totals match an independent full-pool replication
 *   D2  no duplicate (nodeId|label) identities across packages
 *   D3  conservation: totalUnique + duplicatesRemoved == totalTreatmentsPreDedupe
 *   D4  every selected entity carries its complete full-pool diagnosisIds set
 *   D5  order-independence: shuffled activeDx -> identical memberships and totals
 *   D6  aggregates (anchors/steps) derive from the selected set
 *   D7  package + combined counts describe the retained set; pool provenance kept
 *   D8  BACKFILL: every diagnosis fills its quota unless unique candidates are
 *       genuinely exhausted (SYSTEMIC_CONTAGION no longer starves at 1/200)
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

var finance = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/domains/finance.json'), 'utf8'));
var issueIds = (finance.issues || []).map(function (i) { return i.id; });
console.log('  finance root issues: ' + JSON.stringify(issueIds));

function key(t) { return (t.nodeId || '') + '|' + (t.label || ''); }
var QUOTA = 200;

(async function () {
  // ── Independent replication over FULL pools (dedupe-free resolveForDiagnosis) ──
  var pools = {};
  for (var ii = 0; ii < issueIds.length; ii++) {
    pools[issueIds[ii]] = await resolver.resolveForDiagnosis(issueIds[ii], { eager: false });
  }
  var expectedAssoc = {};
  issueIds.forEach(function (id) {
    pools[id].forEach(function (t) {
      var k = key(t);
      if (!expectedAssoc[k]) expectedAssoc[k] = [];
      if (expectedAssoc[k].indexOf(id) === -1) expectedAssoc[k].push(id);
    });
  });
  var expClaimed = {}, expSelected = {}, expPre = 0, expUnique = 0;
  issueIds.slice().sort().forEach(function (id) {
    expPre += Math.min(QUOTA, pools[id].length);
    var sel = [];
    for (var pi = 0; pi < pools[id].length && sel.length < QUOTA; pi++) {
      var t = pools[id][pi], k = key(t);
      if (expClaimed[k]) continue;
      expClaimed[k] = id;
      sel.push(t);
    }
    expSelected[id] = sel;
    expUnique += sel.length;
  });
  var expPool = issueIds.reduce(function (n, id) { return n + pools[id].length; }, 0);

  // ── Resolver under test ──
  var state = { domainId: 'finance', diagnoses: issueIds.map(function (id) { return { id: id, active: true }; }) };
  var combined = await resolver.resolveForBrain(state, {});

  var perDx = {};
  Object.keys(combined.byDiagnosis).forEach(function (id) { perDx[id] = (combined.byDiagnosis[id].treatments || []).length; });
  console.log('\n  MEASURED (L1, 6 dx active, quota 200/dx, full-pool backfill)');
  console.log('    per-dx selected: ' + JSON.stringify(perDx));
  console.log('    expected (replication): ' + JSON.stringify(Object.keys(expSelected).reduce(function (o, id) { o[id] = expSelected[id].length; return o; }, {})));
  console.log('    totalUnique=' + combined.totalUnique + ' duplicatesRemoved=' + combined.duplicatesRemoved +
    ' preDedupe=' + combined.totalTreatmentsPreDedupe + ' pool=' + combined.totalPoolTreatments);

  console.log('\nD1: totals match independent full-pool replication');
  assert('totalUnique == replication', combined.totalUnique === expUnique, combined.totalUnique + ' vs ' + expUnique);
  assert('duplicatesRemoved == pre - unique', combined.duplicatesRemoved === expPre - expUnique,
    combined.duplicatesRemoved + ' vs ' + (expPre - expUnique));
  console.log('D2: no duplicate identities across packages');
  var seen = {}, dups = 0;
  Object.keys(combined.byDiagnosis).forEach(function (id) {
    (combined.byDiagnosis[id].treatments || []).forEach(function (t) {
      if (seen[key(t)]) dups++; seen[key(t)] = true;
    });
  });
  assert('zero duplicate (nodeId|label)', dups === 0, dups + ' dups');
  console.log('D3: conservation');
  assert('preDedupe == replication pre', combined.totalTreatmentsPreDedupe === expPre,
    combined.totalTreatmentsPreDedupe + ' vs ' + expPre);
  assert('unique + removed == pre', combined.totalUnique + combined.duplicatesRemoved === combined.totalTreatmentsPreDedupe);
  console.log('D4: complete full-pool association sets');
  var assocBad = 0;
  Object.keys(combined.byDiagnosis).forEach(function (id) {
    (combined.byDiagnosis[id].treatments || []).forEach(function (t) {
      var expected = (expectedAssoc[key(t)] || []).slice().sort();
      var actual = (t.diagnosisIds || []).slice().sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) assocBad++;
      if (actual.indexOf(id) === -1) assocBad++;
    });
  });
  assert('every entity carries complete diagnosisIds (incl. host)', assocBad === 0, assocBad + ' mismatches');
  console.log('D5: order-independence');
  var combined2 = await resolver.resolveForBrain({ domainId: 'finance', diagnoses: issueIds.slice().reverse().map(function (id) { return { id: id, active: true }; }) }, {});
  var mem1 = {}, mem2 = {};
  Object.keys(combined.byDiagnosis).forEach(function (id) {
    (combined.byDiagnosis[id].treatments || []).forEach(function (t) { mem1[key(t)] = id + '|' + (t.diagnosisIds || []).join('+'); });
  });
  Object.keys(combined2.byDiagnosis).forEach(function (id) {
    (combined2.byDiagnosis[id].treatments || []).forEach(function (t) { mem2[key(t)] = id + '|' + (t.diagnosisIds || []).join('+'); });
  });
  var memBad = Object.keys(mem1).filter(function (k) { return mem1[k] !== mem2[k]; }).length;
  assert('memberships+hosts identical under shuffle', memBad === 0 && combined2.totalUnique === combined.totalUnique,
    memBad + ' mismatches');
  console.log('D6: aggregates derive from the selected set');
  var anchorBad = 0, stepBad = 0, anchorSum = 0, stepSum = 0;
  Object.keys(combined.byDiagnosis).forEach(function (id) {
    var pkg = combined.byDiagnosis[id];
    var labels = {}, cites = {};
    (pkg.treatments || []).forEach(function (t) {
      labels[(t.label || '') + '@' + (t.nodeId || '')] = true;
      if (t.cite) cites[t.cite] = true;
    });
    (pkg.implementationSteps || []).forEach(function (s) { stepSum++; if (!labels[(s.treatmentLabel || '') + '@' + (s.nodeId || '')]) stepBad++; });
    (pkg.evidenceAnchors || []).forEach(function (a) { anchorSum++; if (!cites[a.text]) anchorBad++; });
  });
  assert('every step references a selected treatment', stepBad === 0, stepBad + ' orphans');
  assert('every anchor cites a selected treatment', anchorBad === 0, anchorBad + ' orphans');
  assert('combined aggregates == package concats', combined.allEvidenceAnchors.length === anchorSum && combined.allImplementationSteps.length === stepSum);
  console.log('D7: counts describe the retained set; pool provenance kept');
  var countOk = true, sumSel = 0;
  Object.keys(combined.byDiagnosis).forEach(function (id) {
    var pkg = combined.byDiagnosis[id], n = (pkg.treatments || []).length;
    sumSel += n;
    if (pkg.totalTreatments !== n || pkg.deepTreatments !== n) countOk = false;
  });
  assert('package counts == retained set', countOk);
  assert('combined totals == package sums == totalUnique', combined.totalTreatments === sumSel && combined.totalDeep === sumSel && combined.totalTreatments === combined.totalUnique);
  assert('pool provenance == full-pool sum', combined.totalPoolTreatments === expPool, combined.totalPoolTreatments + ' vs ' + expPool);

  console.log('D8: backfill — quota filled unless unique candidates genuinely exhausted');
  var perDxOk = true;
  Object.keys(combined.byDiagnosis).forEach(function (id) {
    var n = (combined.byDiagnosis[id].treatments || []).length;
    if (n !== expSelected[id].length) perDxOk = false;
    if (n < QUOTA) {
      // genuine exhaustion: every unselected pool entity must be claimed elsewhere
      var selKeys = {};
      (combined.byDiagnosis[id].treatments || []).forEach(function (t) { selKeys[key(t)] = true; });
      var free = pools[id].filter(function (t) { return !expClaimed[key(t)] || selKeys[key(t)]; });
      // every pool entity is either selected here or claimed by another dx
      var unclaimed = pools[id].filter(function (t) { return !selKeys[key(t)] && !expClaimed[key(t)]; });
      if (unclaimed.length > 0) { perDxOk = false; console.error('    ' + id + ': ' + unclaimed.length + ' unclaimed candidates despite unfilled quota'); }
    }
  });
  assert('every dx matches replication quota-fill', perDxOk);
  var sc = (combined.byDiagnosis.SYSTEMIC_CONTAGION || { treatments: [] }).treatments.length;
  var scExp = (expSelected.SYSTEMIC_CONTAGION || []).length;
  console.log('    SYSTEMIC_CONTAGION: ' + sc + ' selected (was 1 pre-backfill), replication expects ' + scExp);
  assert('SYSTEMIC_CONTAGION backfilled from its pool', sc === scExp && sc > 1, sc + ' vs ' + scExp);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
