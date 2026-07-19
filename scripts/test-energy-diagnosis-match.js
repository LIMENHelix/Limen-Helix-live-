/**
 * scripts/test-energy-diagnosis-match.js — P0 fix: exact trigger match + clamped relevance
 * (was substring match + double-count). Run: node scripts/test-energy-diagnosis-match.js
 *
 *   T1  substring does NOT match: condition 'grid' must not trigger 'grid_stress'
 *   T2  exact match works: condition 'grid_stress' triggers, relevance = matched/total
 *   T3  duplicate conditions can't push relevance above 1.0 (count-once + clamp)
 */
var fs = require('fs'), path = require('path');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

var win = { location: { pathname: '/', search: '' }, LIMENDomainBrains: { register: function () {} }, addEventListener: function () {} };
global.window = win;
function BaseStub(cfg) { this.config = cfg || {}; this.state = { stress: 0.6, diagnoses: [], opportunities: [], companies: [], memory: { stressHistory: [] }, confidence: 0.8 }; this._externalSignals = []; }
BaseStub.prototype.init = function () {}; BaseStub.prototype.start = function () {}; BaseStub.prototype.getExternalPressure = function () { return 0; };
win.LIMENDomainBrainBase = BaseStub;
global.fetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };
function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
loadScript('assets/js/domain-brains/energy-brain.js');
var brain = win.LIMENEnergyBrain;
assert('energy brain loaded', !!brain);

// stub the portal + the diagnosis index (GRID_COLLAPSE needs two triggers to hold)
brain._getPortalContent = function () { return Promise.resolve({ issues: [{ id: 'GRID_COLLAPSE', label: 'Grid Collapse', summary: '' }] }); };
brain.diagnosisIndex = { GRID_COLLAPSE: ['grid_stress', 'weather_extreme'] };

function run(conditions) {
  brain._activeConditions = conditions;
  return brain.deriveDiagnoses().then(function () { return brain.state.diagnoses[0]; });
}

(async function () {
  console.log('T1: substring must NOT match');
  var d1 = await run(['grid']);   // 'grid' is a substring of 'grid_stress' — must NOT count
  assert('substring "grid" does not match trigger "grid_stress"', d1.matchedConditions === 0 && d1.active === false, JSON.stringify(d1));
  assert('relevance 0 when nothing matches', d1.relevance === 0);

  console.log('T2: exact match works');
  var d2 = await run(['grid_stress']);   // 1 of 2 triggers
  assert('exact condition matches', d2.matchedConditions === 1 && d2.active === true);
  assert('relevance = 1/2 = 0.5', d2.relevance === 0.5, 'rel=' + d2.relevance);

  console.log('T3: duplicate conditions cannot push relevance above 1.0');
  var d3 = await run(['grid_stress', 'grid_stress', 'weather_extreme', 'weather_extreme', 'grid_stress']);
  assert('each trigger counted once ⇒ matchCount = 2 (both triggers)', d3.matchedConditions === 2, 'mc=' + d3.matchedConditions);
  assert('relevance clamped to 1.0 (not 2.5)', d3.relevance === 1, 'rel=' + d3.relevance);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
