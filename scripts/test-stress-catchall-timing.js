/**
 * scripts/test-stress-catchall-timing.js — stress catch-all flags must reflect
 * CURRENT-cycle stress/maturity. Run: node scripts/test-stress-catchall-timing.js
 *
 * Defect: _stress_finance_high/_stress_structural/_stress_systemic were computed in
 * normalizeSignals (step 2), which runs BEFORE scoreStress (step 3) — so they read
 * PREVIOUS-cycle stress. SYSTEMIC_CONTAGION (catchAllBlocked:false, allowed to fire
 * from stress) activated one cycle late on escalation and persisted one cycle late
 * after recovery.
 *
 *   T1  escalation: stress crosses 0.70 this cycle -> SYSTEMIC_CONTAGION active THIS cycle
 *   T2  recovery: stress falls below 0.70 this cycle (was high) -> inactive THIS cycle
 *   T3  systemic threshold: current 0.85 -> _stress_systemic present
 *   T4  structural maturity this cycle -> _stress_structural present
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var ROOT = path.join(__dirname, '..');
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

function loadScript(rel) { eval(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
loadScript('assets/js/domain-brains/domain-brain-base.js');
loadScript('assets/js/domain-brains/finance-brain.js');

var brain = win.LIMENFinanceBrain;
var Base = win.LIMENDomainBrainBase;
assert('finance brain loaded', !!brain && !!Base);

// Script current-cycle scoring per scenario. Finance's override calls
// Base.prototype.scoreStress then appends flags — so stubbing Base's method
// controls exactly what "this cycle's scoring" produced.
var scripted = { stress: 0, maturity: 'EARLY' };
Base.prototype.scoreStress = function () {
  this.state.stress = scripted.stress;
  this.state.maturity = scripted.maturity;
  return Promise.resolve();
};

function contagion() {
  return (brain.state.diagnoses || []).filter(function (d) { return d.id === 'SYSTEMIC_CONTAGION'; })[0] || {};
}
function flags() { return (brain._activeConditions || []).filter(function (c) { return c.charAt(0) === '_'; }); }

(async function () {
  console.log('T1: escalation — stress crosses 0.70 THIS cycle');
  brain.state.stress = 0.40;             // previous cycle was calm
  scripted.stress = 0.75;                // current-cycle scoring crosses threshold
  await brain.cycle();
  assert('_stress_finance_high present this cycle', flags().indexOf('_stress_finance_high') !== -1, JSON.stringify(flags()));
  assert('SYSTEMIC_CONTAGION active THIS cycle (not one late)', contagion().active === true, JSON.stringify(contagion()));

  console.log('T2: recovery — stress falls below 0.70 THIS cycle (was high)');
  brain.state.stress = 0.85;             // previous cycle was critical (pre-fix would have carried flags)
  scripted.stress = 0.50;
  await brain.cycle();
  assert('no _stress_ flags persist', flags().length === 0, JSON.stringify(flags()));
  assert('SYSTEMIC_CONTAGION cleared THIS cycle (not one late)', contagion().active === false, JSON.stringify(contagion()));

  console.log('T3: systemic threshold — current 0.85');
  scripted.stress = 0.85;
  await brain.cycle();
  assert('_stress_finance_high present', flags().indexOf('_stress_finance_high') !== -1);
  assert('_stress_systemic present at >= 0.80', flags().indexOf('_stress_systemic') !== -1, JSON.stringify(flags()));

  console.log('T4: structural maturity this cycle');
  scripted.stress = 0.40;
  scripted.maturity = 'STRUCTURAL';
  await brain.cycle();
  assert('_stress_structural present', flags().indexOf('_stress_structural') !== -1, JSON.stringify(flags()));
  assert('SYSTEMIC_CONTAGION active via structural trigger', contagion().active === true);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) { console.error('TEST CRASH', e && e.stack || e); process.exit(1); });
