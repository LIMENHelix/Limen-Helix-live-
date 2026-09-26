/**
 * scripts/verify-digests.js — per-domain validation of rebuilt diagnosis digests.
 * Run: node scripts/verify-digests.js
 *
 * Acceptance (PR #386 review): scan ALL treatment identities in every digest and
 * prove only affirmatively classified records can receive verified status.
 *
 *   V1  all 20 digests present
 *   V2  every digest declares source: 'full-tree'
 *   V3  EVERY treatment carries explicit classification (syn === 0 or 1) — no
 *       undefined provenance anywhere in the fleet
 *   V4  counts are self-consistent (diagnosisCount == diagnoses.length,
 *       tx per diagnosis within its domain cap)
 *   V5  every digest spans >1 represented depth (stratified, not shallow-only)
 * Prints the per-domain verified-eligible (syn=0) vs scaffold (syn=1) table.
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets/data/deep');
var KEYS = [
  'p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
];
var TX_CAP = { finance: 6 };

var files = fs.readdirSync(DEEP).filter(function (f) { return f.endsWith('-diagnosis-digest.json'); });
assert('V1: all 20 digests present', files.length === 20, 'found ' + files.length);

var totalTx = 0, totalSyn = 0, totalVer = 0, badSource = [], badSyn = 0, badCount = [], shallowOnly = [];
console.log('\n  DOMAIN'.padEnd(17) + 'DX'.padStart(5) + 'TX'.padStart(6) + 'SCAFFOLD'.padStart(10) + 'VERIFIABLE'.padStart(12) + '  DEPTHS');
KEYS.forEach(function (k) {
  var file = k + '-diagnosis-digest.json';
  var j;
  try { j = JSON.parse(fs.readFileSync(path.join(DEEP, file), 'utf8')); } catch (e) { badSource.push(k + ' (unreadable)'); return; }
  if (j.source !== 'full-tree') badSource.push(k + ' source=' + j.source);
  var dxs = j.diagnoses || [];
  if (j.diagnosisCount !== dxs.length) badCount.push(k + ' diagnosisCount mismatch');
  var cap = TX_CAP[k] || 2;
  var syn = 0, ver = 0, depths = {};
  dxs.forEach(function (d) {
    depths[d.depth] = true;
    if (!Array.isArray(d.tx)) { badCount.push(k + '/' + d.id + ' tx not array'); return; }
    if (d.tx.length > cap) badCount.push(k + '/' + d.id + ' tx ' + d.tx.length + ' > cap ' + cap);
    d.tx.forEach(function (t) {
      if (t.syn !== 0 && t.syn !== 1) badSyn++;
      else if (t.syn === 1) syn++;
      else ver++;
    });
  });
  if (Object.keys(depths).length < 2) shallowOnly.push(k + ' depths=' + JSON.stringify(Object.keys(depths)));
  totalTx += syn + ver; totalSyn += syn; totalVer += ver;
  console.log('  ' + k.padEnd(16) + String(dxs.length).padStart(5) + String(syn + ver).padStart(6) +
    String(syn).padStart(10) + String(ver).padStart(12) + '  ' + JSON.stringify(Object.keys(depths).sort()));
});

assert('V2: every digest is full-tree sourced', badSource.length === 0, badSource.join('; '));
assert('V3: EVERY treatment explicitly classified (syn 0/1), zero undefined', badSyn === 0, badSyn + ' unclassified');
assert('V4: counts self-consistent', badCount.length === 0, badCount.slice(0, 3).join('; '));
assert('V5: every digest spans multiple depths', shallowOnly.length === 0, shallowOnly.join('; '));

console.log('\n  FLEET: ' + totalTx + ' treatments · ' + totalSyn + ' scaffold · ' + totalVer + ' verified-eligible');
console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
