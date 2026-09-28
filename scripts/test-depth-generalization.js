/**
 * scripts/test-depth-generalization.js — reserve-first stratified pick must
 * handle arbitrary represented depths with no structural omission.
 * Run: node scripts/test-depth-generalization.js
 *
 *   D1  sparse high depth (L50 with 2 records) is represented
 *   D2  depth gaps (L2, L7, L42) all represented
 *   D3  a single high-depth record is never dropped
 *   D4  more depths than window seats: total == window, deterministic
 *       ascending-depth reserve rule, no overflow
 *   D5  finance-real distribution lands on exact weighted quotas (stability)
 *   D6  deterministic across repeated runs
 */
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

process.env.BUILD_DIGEST_SKIP_MAIN = '1';

function dx(id, depth) { return { id: id, label: id, depth: depth, tx: [] }; }
function makePool(spec) {
  var out = [];
  Object.keys(spec).forEach(function (dep) {
    for (var i = 0; i < spec[dep]; i++) out.push(dx('D' + dep + '_' + i, Number(dep)));
  });
  return out;   // already ranked: grouped by depth in ascending spec order
}
function hist(picked) {
  var h = {};
  picked.forEach(function (d) { h[d.depth] = (h[d.depth] || 0) + 1; });
  return h;
}

(async function () {
  var mod = await import('../scripts/build-diagnosis-digest.mjs');
  var pick = mod.stratifiedPick;
  assert('stratifiedPick exported', typeof pick === 'function');

  console.log('D1: sparse high depth');
  var p1 = pick(makePool({ 2: 30, 50: 2 }), 180);
  var h1 = hist(p1);
  assert('L50 represented with both records', h1[50] === 2, JSON.stringify(h1));
  assert('window filled', p1.length === 32, 'got ' + p1.length);

  console.log('D2: depth gaps');
  var p2 = pick(makePool({ 2: 30, 7: 3, 42: 4 }), 180);
  var h2 = hist(p2);
  assert('all three depths represented', h2[2] > 0 && h2[7] === 3 && h2[42] === 4, JSON.stringify(h2));

  console.log('D3: single high-depth record never dropped');
  var p3 = pick(makePool({ 2: 30, 99: 1 }), 180);
  assert('the L99 record is selected', hist(p3)[99] === 1);

  console.log('D4: more depths than seats (40 depths, window 180)');
  var spec = {};
  for (var d = 1; d <= 40; d++) spec[d] = 10;
  var p4 = pick(makePool(spec), 180);
  var h4 = hist(p4);
  assert('total == window (no overflow)', p4.length === 180, 'got ' + p4.length);
  var depths = Object.keys(h4).map(Number).sort(function (a, b) { return a - b; });
  assert('ascending-depth reserve: first 36 depths seated, rest zero (documented rule)',
    depths.length === 36 && depths.every(function (d) { return h4[d] === 5; }),
    'seated=' + depths.length + ' first=' + depths[0] + ' last=' + depths[depths.length - 1]);
  assert('deepest overflow depths absent (not silently mixed)', !h4[37] && !h4[40]);

  console.log('D5: finance-real distribution is stable');
  var p5 = pick(makePool({ 2: 30, 3: 50, 4: 40, 5: 35, 6: 25 }), 180);
  var h5 = hist(p5);
  // Weighted quotas {30,40,40,35,25} sum to 170; the unspent L7 band (10) falls
  // back by global rank — with L3 ranked next it lands on {30,50,40,35,25},
  // exactly matching the committed finance digest.
  assert('finance-real distribution {2:30,3:50,4:40,5:35,6:25}',
    h5[2] === 30 && h5[3] === 50 && h5[4] === 40 && h5[5] === 35 && h5[6] === 25, JSON.stringify(h5));

  console.log('D6: determinism');
  var a = JSON.stringify(pick(makePool(spec), 180).map(function (d) { return d.id; }));
  var b = JSON.stringify(pick(makePool(spec), 180).map(function (d) { return d.id; }));
  assert('identical output across runs', a === b);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
