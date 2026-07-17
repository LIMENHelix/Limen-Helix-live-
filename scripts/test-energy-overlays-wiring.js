/**
 * scripts/test-energy-overlays-wiring.js — prove the 6 formerly-inert neuro overlay
 * modules (+ connectivity recurrenceAudit) are now WIRED on energy in shadow
 * (run: node scripts/test-energy-overlays-wiring.js).
 *
 *   T1  all 7 modules load + _computeEnergyOverlays produces a shadow readout
 *   T2  metaplasticity receives volatility → adapts the other modules' knobs (non-noop)
 *   T3  extinction proposes retiring an activation whose trigger is gone (proposal-only)
 *   T4  retrograde throttle fires for an overloaded receiver node
 *   T5  PE-compressor compresses the calm interoception channels (management-by-exception)
 *   T6  offline maintenance down-scales non-protected edges on a COPY, prunes nothing (threshold 0)
 *   T7  recurrence audit + incomplete-circuit audit return verdicts (the half-dead exports, now live)
 *   T8  SHADOW discipline: energy.json def untouched, live edge weights untouched
 *   T9  arming toggle: _actuation.overlays flips the `armed` flag (default false)
 */
var fs = require('fs');
var path = require('path');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var win = { location: { pathname: '/', search: '' }, LIMENDomainBrains: { register: function () {} }, addEventListener: function () {} };
global.window = win;
function BaseStub(cfg) {
  this.config = cfg || {};
  this.state = { stress: 0.6, phase: 'p2', diagnoses: [], opportunities: [], companies: [], memory: { stressHistory: [] }, confidence: 0.8 };
  this._externalSignals = [];
}
BaseStub.prototype.init = function () {}; BaseStub.prototype.start = function () {};
BaseStub.prototype.getExternalPressure = function () { return 0.1; };
win.LIMENDomainBrainBase = BaseStub;
global.fetch = function () { return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } }); };

function loadScript(rel) { eval(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
// the 7 overlay modules (attach to global.window) + prerequisites for energy-brain
loadScript('assets/js/limen-k4-selfconsistency.js');
loadScript('assets/js/limen-plasticity.js');
loadScript('assets/js/limen-active-inference.js');
loadScript('assets/js/limen-phase-percept.js');
loadScript('assets/js/energy-metaplasticity.js');
loadScript('assets/js/energy-extinction.js');
loadScript('assets/js/energy-retrograde-throttle.js');
loadScript('assets/js/energy-prediction-error-compressor.js');
loadScript('assets/js/energy-offline-maintenance.js');
loadScript('assets/js/energy-neuro-substrate.js');
loadScript('assets/js/energy-connectivity-audit.js');
assert('all 7 overlay modules attached to window', !!(win.EnergyMetaplasticity && win.EnergyExtinction && win.EnergyRetrogradeThrottle && win.EnergyPredictionErrorCompressor && win.EnergyOfflineMaintenance && win.EnergyNeuroSubstrate && win.EnergyConnectivityAudit));

var loaded = true, err = null;
try { loadScript('assets/js/domain-brains/energy-brain.js'); } catch (e) { loaded = false; err = e; }
assert('energy-brain.js loads + self-instantiates', loaded && !!win.LIMENEnergyBrain, err && err.message);
if (!loaded || !win.LIMENEnergyBrain) { console.error('cannot continue'); process.exit(1); }
var brain = win.LIMENEnergyBrain;

// ── fixtures ──────────────────────────────────────────────────────
// energy runtime def with real non-zero gains (matches energy.json runtime.params shape)
var edges = [];
for (var i = 0; i < 10; i++) edges.push({ source: 'N' + i, target: 'N' + ((i + 1) % 10), type: i % 3 === 0 ? 'inhib' : 'excit', weight: (i + 1) / 10 });
brain._energyDef = {
  runtime: { params: { offlineDownscaleFactor: 0.95, offlineConsolidateTopK: 8, offlinePruneThreshold: 0,
    refractoryAbsoluteWindow: 900000, predictionErrorThreshold: 0.1, retrogradeThrottleGain: 0.2, metaplasticityGain: 0.2 } },
  activations: [
    { brainNodeId: 'STN', group: 'g1', diagnosticTriggers: ['trigger_gone'] },      // trigger absent → extinction candidate
    { brainNodeId: 'M1', group: 'g1', diagnosticTriggers: ['trigger_here'] },        // trigger active → not a candidate
    { brainNodeId: 'THAL', group: 'g2', diagnosticTriggers: [] }                     // no trigger → skipped
  ],
  edges: edges,
  issues: [
    { id: 'GRID_COLLAPSE', _authored: [{ nodeId: 'THAL' }, { nodeId: 'vmPFC' }] },   // vmPFC regulatory → complete
    { id: 'OIL_SHOCK', _authored: [{ nodeId: 'M1' }, { nodeId: 'THAL' }] }           // no regulatory partner → INCOMPLETE
  ]
};
brain._activeConditions = ['trigger_here'];
brain._runtimeOverlay = {
  volatility: 0.4,
  activeTriggers: ['trigger_here'],
  activations: { N2: { load: 2, capacity: 1 }, N5: { load: 1, capacity: 1 } }        // N2 overloaded → retrograde throttle
};
brain.state.energyInteroception = { channels: [
  { name: 'financial', alarm: 0.9 }, { name: 'prediction', alarm: 0.5 },
  { name: 'regulation', alarm: 0.5 }, { name: 'immune', alarm: 0.5 }               // 3 near-baseline → compressed
] };
brain.state.cognition = {};
brain._actuation = brain._actuation || {}; brain._actuation.overlays = false;
brain._refractoryBaseWindow = 900000;
brain._refractoryParams = { absoluteWindow: 900000, relativeWindow: 3600000, overrideThreshold: 0.9 };
brain._refractoryLimiter = { params: { absoluteWindow: 900000 } };   // stub live limiter (fire() reads .params each call)
var edgesBeforeJSON = JSON.stringify(brain._energyDef.edges);

// ── T1 ──
console.log('T1: overlay pass produces a shadow readout');
var o = brain._computeEnergyOverlays();
assert('shadow mode, armed:false', o && o.mode === 'shadow' && o.armed === false, JSON.stringify(o && { mode: o.mode, armed: o.armed }));
assert('volatility bridged from telemetry overlay (0.4)', o.volatility === 0.4);

// ── T2 metaplasticity ──
console.log('T2: metaplasticity adapts the other knobs from volatility');
assert('metaplasticity non-noop', o.metaplasticity.noop === false && o.metaplasticity.changes.length > 0, JSON.stringify(o.metaplasticity.changes));
assert('offline downscale factor adapted below 0.95', o.metaplasticity.adapted.offlineDownscaleFactor < 0.95, o.metaplasticity.adapted.offlineDownscaleFactor);

// ── T3 extinction ──
console.log('T3: extinction proposes retiring the stale-trigger activation');
assert('exactly 1 extinction candidate (STN)', o.extinction.count === 1 && o.extinction.candidates[0].node === 'STN', JSON.stringify(o.extinction.candidates));
assert('extinction is proposal-only', /PROPOSAL-ONLY/.test(o.extinction.actuation));

// ── T4 retrograde ──
console.log('T4: retrograde throttle fires for the overloaded receiver');
assert('at least 1 throttle action (receiver N2)', o.retrograde.throttled >= 1 && o.retrograde.actions.some(function (a) { return a.receiver === 'N2'; }), JSON.stringify(o.retrograde.actions));

// ── T5 PE compression ──
console.log('T5: PE-compressor compresses the calm channels');
assert('some interoception channels compressed', o.peCompression.compressed >= 1 && o.peCompression.propagated >= 1, JSON.stringify(o.peCompression.summary));

// ── T6 offline maintenance ──
console.log('T6: offline maintenance down-scales on a copy, prunes nothing');
assert('non-protected edges down-scaled', o.offlineMaintenance.downscaled >= 1, 'downscaled=' + o.offlineMaintenance.downscaled);
assert('nothing pruned (threshold 0)', o.offlineMaintenance.pruned === 0);

// ── T7 structural diagnostics ──
console.log('T7: recurrence + incomplete-circuit audits (formerly-dead exports)');
assert('recurrence verdict present', typeof o.recurrence.verdict === 'string' && o.recurrence.verdict.length > 0);
assert('incomplete-circuit audit: 1 INCOMPLETE (OIL_SHOCK)', o.incompleteCount === 1 && o.incompleteCircuits.filter(function (v) { return v.verdict === 'INCOMPLETE_CIRCUIT'; })[0].issue === 'OIL_SHOCK', JSON.stringify(o.incompleteCircuits.map(function (v) { return [v.issue, v.verdict]; })));

// ── T8 shadow discipline ──
console.log('T8: SHADOW — energy def + live weights untouched');
assert('energy def edges unchanged (offline ran on a copy)', JSON.stringify(brain._energyDef.edges) === edgesBeforeJSON);

// ── T9 arming actuation: metaplasticity → refractory dead-time (in-place, bounded) ──
console.log('T9: arming raises the refractory dead-time in place (bounded, fail-toward-quiet)');
brain._actuation.overlays = true;
var o2 = brain._computeEnergyOverlays();
assert('mode armed', o2.mode === 'armed' && o2.armed === true);
var applied = o2.applied.refractoryAbsoluteWindow;
assert('refractory window raised above base', applied > 900000, 'applied=' + applied);
assert('within +20% clamp (fail-toward-quiet)', applied <= 900000 * 1.2, 'applied=' + applied);
assert('applied IN PLACE to live limiter params (no re-init)', brain._refractoryLimiter.params.absoluteWindow === applied);
assert('applied to _refractoryParams too', brain._refractoryParams.absoluteWindow === applied);

// ── T10 clamp holds at max volatility ──
console.log('T10: clamp holds even at max volatility');
brain._runtimeOverlay.volatility = 1;
var o3 = brain._computeEnergyOverlays();
assert('never exceeds +20% ceiling', o3.applied.refractoryAbsoluteWindow <= 900000 * 1.2 + 1);

// ── T11 removal mechanisms never actuate, even when armed ──
console.log('T11: extinction + offline pruning stay PROPOSAL-ONLY when armed');
assert('extinction still proposal-only (candidates present, nothing removed)', o3.extinction.count >= 1 && /PROPOSAL-ONLY/.test(o3.extinction.actuation));
assert('offline prunes nothing (threshold 0)', o3.offlineMaintenance.pruned === 0);
assert('energy def edges STILL unchanged after arming', JSON.stringify(brain._energyDef.edges) === edgesBeforeJSON);

// ── T12 disarm reverts the window ──
console.log('T12: disarm restores the base refractory window');
brain._actuation.overlays = false;
var o4 = brain._computeEnergyOverlays();
assert('reverts to base 900000', brain._refractoryParams.absoluteWindow === 900000 && brain._refractoryLimiter.params.absoluteWindow === 900000);
assert('mode back to shadow', o4.mode === 'shadow');

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
