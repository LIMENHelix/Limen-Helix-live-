/**
 * scripts/measure-twin-dedupe.js — Exp 3: twin-diagnosis duplication in the resolver.
 * Run: node scripts/measure-twin-dedupe.js
 *
 * BANKING_CRISIS/CREDIT_CHANNEL_BREAK and MARKET_CRASH/EQUITY_WEALTH_SHOCK resolve
 * identical portal roots (portal-content-resolver.js DIAGNOSIS_PORTAL_MAP), so when
 * both twins are active the same treatments enter combined.byDiagnosis twice under
 * different diagnosisIds — the double-count defect from the spec (A4.1).
 *
 * Measures over the REAL resolver + REAL deployed L1-L3 files (non-eager, L1):
 *   pre-total     = sum of per-dx capped treatment arrays (what consumers iterate)
 *   unique        = dedupe by (nodeId|label) across dx packages
 *   duplicates    = pre - unique
 * Then asserts the resolver's dedupe fields report exactly those numbers and that
 * no (nodeId|label) key survives in two packages.
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

(async function () {
  var state = { domainId: 'finance', diagnoses: issueIds.map(function (id) { return { id: id, active: true }; }) };

  // Independent pre-dedupe measurement: resolveForDocument does NOT dedupe, so
  // resolving each dx separately with the same 200 cap gives the true pre total.
  var pre = 0, uniqueSet = {};
  var perDx = {};
  for (var ii = 0; ii < issueIds.length; ii++) {
    var single = await resolver.resolveForDocument(issueIds[ii], 200, { eager: false });
    perDx[issueIds[ii]] = single.treatments.length;
    pre += single.treatments.length;
    single.treatments.forEach(function (t) { uniqueSet[key(t)] = true; });
  }
  var unique = Object.keys(uniqueSet).length;

  var combined = await resolver.resolveForBrain(state, {});

  // cross-package surviving duplicates (post-dedupe this must be 0)
  var stillDuplicated = 0;
  var seenBy = {};
  Object.keys(combined.byDiagnosis).forEach(function (dxId) {
    (combined.byDiagnosis[dxId].treatments || []).forEach(function (t) {
      var k = key(t);
      if (seenBy[k] && seenBy[k] !== dxId) stillDuplicated++;
      seenBy[k] = seenBy[k] || dxId;
    });
  });

  console.log('\n  MEASURED (L1, all ' + issueIds.length + ' root dx active, cap 200/dx)');
  console.log('    per-dx treatments: ' + JSON.stringify(perDx));
  console.log('    pre-dedupe total (independent):  ' + pre);
  console.log('    unique (nodeId|label): ' + unique);
  console.log('    duplicates:        ' + (pre - unique));
  console.log('    resolver reports:  totalTreatments=' + combined.totalTreatments +
    ' totalUnique=' + combined.totalUnique + ' duplicatesRemoved=' + combined.duplicatesRemoved +
    ' totalTreatmentsPreDedupe=' + combined.totalTreatmentsPreDedupe);

  console.log('\nD1: dedupe accounting exists and matches independent measurement');
  assert('totalUnique field present', typeof combined.totalUnique === 'number');
  assert('duplicatesRemoved field present', typeof combined.duplicatesRemoved === 'number');
  assert('totalUnique == measured unique', combined.totalUnique === unique, combined.totalUnique + ' vs ' + unique);
  assert('duplicatesRemoved == measured duplicates', combined.duplicatesRemoved === pre - unique,
    combined.duplicatesRemoved + ' vs ' + (pre - unique));
  console.log('D2: no surviving cross-dx duplicates');
  assert('zero (nodeId|label) keys in two packages', stillDuplicated === 0, stillDuplicated + ' survivors');
  console.log('D3: conservation — pre-dedupe total preserved for audit');
  assert('totalTreatmentsPreDedupe == independent pre', combined.totalTreatmentsPreDedupe === pre,
    combined.totalTreatmentsPreDedupe + ' vs ' + pre);
  assert('totalUnique + duplicatesRemoved == pre', combined.totalUnique + combined.duplicatesRemoved === pre,
    combined.totalUnique + '+' + combined.duplicatesRemoved + ' vs ' + pre);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
