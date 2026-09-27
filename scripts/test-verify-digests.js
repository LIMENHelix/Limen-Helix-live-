/**
 * scripts/verify-digests.js — per-domain validation of rebuilt diagnosis digests
 * and their identity/route manifests. Run: node scripts/verify-digests.js
 *
 *   V1  all 20 digests present
 *   V2  every digest declares source: 'full-tree'
 *   V3  EVERY treatment explicitly classified (syn 0/1/2) — zero undefined
 *   V4  counts self-consistent (diagnosisCount, tx-per-dx cap)
 *   V5  every digest spans multiple depths
 *   V6  manifest per domain: exists, count == diagnosisTotalAvailable, every
 *       selected id present, zero duplicate ids
 *   V7  SUBSTANTIATION: every syn===0 (verified-eligible) record is checked
 *       individually against its source portal file — the treatment must exist
 *       there with a non-empty citation AND implementation steps
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
var TX_CAP = { finance: 6 };

var files = fs.readdirSync(DEEP).filter(function (f) { return f.endsWith('-diagnosis-digest.json'); });
assert('V1: all 20 digests present', files.length === 20, 'found ' + files.length);

var badSource = [], badSyn = 0, badCount = [], shallowOnly = [];
var totalTx = 0, totalSyn = 0, totalVer = 0, totalUnk = 0;
var manifestIssues = [];
var synZeroRecords = [];   // {domain, slug, label}

console.log('\n  DOMAIN'.padEnd(17) + 'DX'.padStart(5) + 'TX'.padStart(6) + 'SCAFF'.padStart(7) + 'UNKN'.padStart(6) + 'VERIF'.padStart(7) + '  DEPTHS');
KEYS.forEach(function (k) {
  var j;
  try { j = JSON.parse(fs.readFileSync(path.join(DEEP, k + '-diagnosis-digest.json'), 'utf8')); }
  catch (e) { badSource.push(k + ' (unreadable)'); return; }
  if (j.source !== 'full-tree') badSource.push(k + ' source=' + j.source);
  var dxs = j.diagnoses || [];
  if (j.diagnosisCount !== dxs.length) badCount.push(k + ' diagnosisCount mismatch');
  var cap = TX_CAP[k] || 2;
  var syn = 0, ver = 0, unk = 0, depths = {};
  dxs.forEach(function (d) {
    depths[d.depth] = true;
    (d.tx || []).forEach(function (t) {
      if (t.syn !== 0 && t.syn !== 1 && t.syn !== 2) badSyn++;
      else if (t.syn === 1) syn++;
      else if (t.syn === 2) { unk++; }
      else { ver++; synZeroRecords.push({ domain: k, slug: d.slug, label: t.l }); }
      if ((d.tx || []).length > cap) badCount.push(k + '/' + d.id + ' over cap');
    });
  });
  if (Object.keys(depths).length < 2) shallowOnly.push(k);
  totalTx += syn + ver + unk; totalSyn += syn; totalVer += ver; totalUnk += unk;
  console.log('  ' + k.padEnd(16) + String(dxs.length).padStart(5) + String(syn + ver + unk).padStart(6) +
    String(syn).padStart(7) + String(unk).padStart(6) + String(ver).padStart(7) + '  ' + JSON.stringify(Object.keys(depths).sort()));

  // V6 — manifest
  var mf = path.join(DEEP, k + '-diagnosis-manifest.json');
  if (!fs.existsSync(mf)) { manifestIssues.push(k + ' manifest missing'); return; }
  var m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  if (m.count !== j.diagnosisTotalAvailable) manifestIssues.push(k + ' manifest ' + m.count + ' != available ' + j.diagnosisTotalAvailable);
  var ids = {}, dupes = 0;
  (m.entries || []).forEach(function (e) { if (ids[e[0]]) dupes++; ids[e[0]] = true; });
  if (dupes) manifestIssues.push(k + ' ' + dupes + ' duplicate ids');
  var missingSel = dxs.filter(function (d) { return !ids[d.id]; }).length;
  if (missingSel) manifestIssues.push(k + ' ' + missingSel + ' selected ids absent from manifest');
});

assert('V2: every digest is full-tree sourced', badSource.length === 0, badSource.join('; '));
assert('V3: EVERY treatment explicitly classified (syn 0/1/2), zero undefined', badSyn === 0, badSyn + ' unclassified');
assert('V4: counts self-consistent', badCount.length === 0, badCount.slice(0, 3).join('; '));
assert('V5: every digest spans multiple depths', shallowOnly.length === 0, shallowOnly.join('; '));
assert('V6: manifests complete and consistent (count==available, no dupes, selected ⊆ manifest)',
  manifestIssues.length === 0, manifestIssues.slice(0, 4).join('; '));

// V7 — substantiate every verified-eligible record against its source portal file.
// Requires the full tree (local path / LIMEN_FULL_DOMAINS_DIR); on CI runners
// without the corpus this is an HONEST SKIP, not a pass.
var unsubstantiated = 0, examples = [];
if (fs.existsSync(FULL)) {
  console.log('\n  V7: substantiating ' + synZeroRecords.length + ' verified-eligible records against source files...');
  var fileCache = {};
  var srcFile = function (slug) {
    if (!(slug in fileCache)) {
      var p = path.join(FULL, slug + '.json');
      try { fileCache[slug] = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { fileCache[slug] = null; }
    }
    return fileCache[slug];
  };
  synZeroRecords.forEach(function (r) {
    var j = srcFile(r.slug);
    var found = false;
    if (j) {
      (j.activations || []).forEach(function (a) {
        (a.treatments || []).forEach(function (t) {
          if (t.label === r.label && t.cite && String(t.cite).length > 3 && Array.isArray(t.steps) && t.steps.length > 0) found = true;
        });
      });
    }
    if (!found) { unsubstantiated++; if (examples.length < 3) examples.push(r.domain + '/' + r.slug + ' :: ' + r.label); }
  });
  assert('V7: every syn=0 record substantiated in source (cite + steps present)',
    unsubstantiated === 0, unsubstantiated + ' failed; e.g. ' + examples.join(' | '));
} else {
  console.log('\n  SKIP V7: full tree not present at ' + FULL + ' (substantiation requires the corpus)');
}

console.log('\n  FLEET: ' + totalTx + ' treatments · ' + totalSyn + ' scaffold · ' + totalUnk + ' unknown · ' + totalVer + ' verified-eligible');
console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
