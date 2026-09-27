/**
 * scripts/measure-depth-rotation.js — depth reachability under NARROW windows.
 * Run: node scripts/measure-depth-rotation.js
 *
 * Review finding: round-robin always started at the shallowest bucket, so with
 * cap < number of represented depths the deepest levels were NEVER reachable
 * (cap 3 over 5 depths -> permanently L2-L4). The rotating cursor advances the
 * starting depth (and within-bucket offset) each cycle.
 *
 *   R1  every cycle surfaces exactly `cap` deep diagnoses
 *   R2  ALL represented depths become reachable within ceil(5/3)+1 = 3 cycles
 *   R3  within-bucket pagination varies the selected diagnoses across cycles
 *   R4  determinism: a fresh brain with the same inputs repeats the same schedule
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');

function makeBrain() {
  var store = {};
  var win = {
    location: { pathname: '/', search: '' },
    LIMENDomainBrains: { register: function () {} },
    addEventListener: function () {},
    dispatchEvent: function () {}
  };
  global.window = win;
  global.localStorage = {
    getItem: function (k) { return store[k] != null ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  win.localStorage = global.localStorage;
  global.setInterval = function () { return 0; };
  win.setInterval = global.setInterval;
  global.document = { createElement: function () { return {}; }, head: { appendChild: function () {} }, addEventListener: function () {} };
  win.document = global.document;
  global.fetch = function (url) {
    var u = String(url);
    var file = null;
    if (u.indexOf('/assets/data/domains/finance.json') !== -1) file = path.join(ROOT, 'assets/data/domains/finance.json');
    if (u.indexOf('/assets/data/deep/finance-diagnosis-digest.json') !== -1) file = path.join(ROOT, 'assets/data/deep/finance-diagnosis-digest.json');
    if (file && fs.existsSync(file)) {
      var data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
    }
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
  };
  win.fetch = global.fetch;
  win.LIMENPortalContentResolver = { resolveForBrain: function () { return Promise.resolve(null); } };

  function loadScript(rel) { eval(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  loadScript('assets/js/limen-k4-selfconsistency.js');
  loadScript('assets/js/limen-plasticity.js');
  loadScript('assets/js/limen-active-inference.js');
  loadScript('assets/js/domain-brains/domain-brain-base.js');
  loadScript('assets/js/domain-brains/finance-brain.js');
  var brain = win.LIMENFinanceBrain;
  brain.state.feeds = [
    { name: 'VIX Volatility Index', value: 45, live: true },
    { name: '10Y Treasury Yield', value: 6.1, live: true }
  ];
  return brain;
}

async function schedule(brain, cycles) {
  var out = [];
  for (var c = 0; c < cycles; c++) {
    await brain.cycle();
    var deep = (brain.state.diagnoses || []).filter(function (d) { return d.source === 'deep-digest' && d.active; });
    out.push(deep.map(function (d) { return { id: d.id, depth: String(d.depth || 'x') }; }));
  }
  return out;
}

(async function () {
  var brain = makeBrain();
  assert('finance brain loaded', !!brain);
  var CYCLES = 8;
  var sched = await schedule(brain, CYCLES);

  console.log('\n  SCHEDULE (cap 3, depths per cycle):');
  sched.forEach(function (s, i) {
    console.log('    cycle ' + (i + 1) + ': [' + s.map(function (d) { return 'L' + d.depth; }).join(', ') + ']');
  });

  console.log('\nR1: window size == cap every cycle (after warm-up)');
  var sized = sched.slice(1).every(function (s) { return s.length === 3; });
  assert('cycles 2..8 each surface exactly 3', sized, sched.map(function (s) { return s.length; }).join(','));

  console.log('R2: ALL depths reachable within 3 cycles (bounded)');
  var digestDepths = { '2': true, '3': true, '4': true, '5': true, '6': true };
  for (var w = 1; w <= 3; w++) {
    var seen = {};
    sched.slice(1, 1 + w).forEach(function (s) { s.forEach(function (d) { seen[d.depth] = true; }); });
    var missing = Object.keys(digestDepths).filter(function (k) { return !seen[k]; });
    console.log('    after cycle ' + (1 + w) + ': depths=' + JSON.stringify(Object.keys(seen).sort()) + (missing.length ? ' missing=' + JSON.stringify(missing) : ''));
    if (missing.length === 0) { assert('all 5 depths reached within ' + w + ' pick-cycles (<= 3)', true); w = 99; break; }
    if (w === 3) assert('all 5 depths reached within 3 pick-cycles', false, 'missing=' + JSON.stringify(missing));
  }

  console.log('R3: within-bucket pagination varies selection across cycles');
  var allIds = {};
  sched.slice(1).forEach(function (s) { s.forEach(function (d) { allIds[d.id] = true; }); });
  var distinct = Object.keys(allIds).length;
  assert('more than 3 distinct diagnoses across cycles (rotation rotates)', distinct > 3, distinct + ' distinct');

  console.log('R4: determinism — fresh brain repeats the same schedule');
  var brain2 = makeBrain();
  var sched2 = await schedule(brain2, 4);
  var s1 = JSON.stringify(sched.slice(0, 4).map(function (s) { return s.map(function (d) { return d.id; }); }));
  var s2 = JSON.stringify(sched2.map(function (s) { return s.map(function (d) { return d.id; }); }));
  assert('identical schedule across fresh instances', s1 === s2);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
