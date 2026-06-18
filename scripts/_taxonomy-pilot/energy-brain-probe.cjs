/**
 * energy-brain-probe.cjs — RUNTIME proof for the Energy Functional Brain Audit.
 * Loads the REAL domain-brain-base.js + energy-brain.js in a stubbed vm, serves the
 * real local portal JSON via a fetch stub, runs TWO real cycles, and reports what the
 * brain actually produces + whether a recurrent prior / prediction-error exists at runtime.
 * Read-only. Run: node scripts/_taxonomy-pilot/energy-brain-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./lib.cjs');

const ROOT = path.join(__dirname, '..', '..');
const A = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ── fetch stub: serve real local /assets/data files; everything else = 404 ──
function makeFetch() {
  return function (url) {
    var u = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    var rel = u.replace(/^\//, '');
    var p = path.join(ROOT, rel);
    if ((rel.startsWith('assets/data/') ) && fs.existsSync(p)) {
      var txt = fs.readFileSync(p, 'utf8');
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(txt)); }, text: function () { return Promise.resolve(txt); } });
    }
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve(null); }, text: function () { return Promise.resolve(''); } });
  };
}

function makeCtx() {
  var doc = { createElement: function () { return { style: {}, set textContent(v){}, set innerHTML(v){}, appendChild: function(){}, addEventListener: function(){} }; },
    getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    addEventListener: function () {}, head: { appendChild: function () {} }, body: { appendChild: function () {} }, dispatchEvent: function(){} };
  var loc = { pathname: '/civilization.html', search: '', href: 'https://limenhelix.com/civilization.html' }; // NOT domain-console → bare-brain path
  var win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc,
    LIMENDomainBrains: { register: function(){}, list: [] },
    LIMENActionAdapters: { getDrafts: function(){ return []; }, createDraft: function(){} },
    addEventListener: function(){}, dispatchEvent: function(){}, CustomEvent: function(){ return {}; },
    setTimeout: function(){ return 0; }, setInterval: function(){ return 0; }, clearInterval: function(){}, clearTimeout: function(){} };
  var sandbox = { window: win, document: doc, location: loc, navigator: { userAgent: 'probe' },
    console: { log: function(){}, warn: function(){}, error: function(){}, info: function(){} },
    Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Boolean: Boolean,
    RegExp: RegExp, Promise: Promise, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
    URLSearchParams: URLSearchParams, Map: Map, Set: Set, fetch: makeFetch(),
    setTimeout: function(){ return 0; }, setInterval: function(){ return 0; }, clearInterval: function(){}, clearTimeout: function(){},
    CustomEvent: function(){ return {}; } };
  sandbox.globalThis = sandbox; sandbox.self = sandbox; win.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  return sandbox;
}

function load(ctx, f) { vm.runInContext(A(f), ctx, { filename: f }); }

function snapshot(state) {
  var clone = {}; try { clone = JSON.parse(JSON.stringify(state)); } catch (e) {}
  return clone;
}

(async function () {
  var ctx = makeCtx();
  load(ctx, 'assets/js/domain-brains/domain-brain-base.js');
  load(ctx, 'assets/js/domain-brains/energy-brain.js');   // auto-instantiates window.LIMENEnergyBrain
  var brain = ctx.window.LIMENEnergyBrain;

  console.log('\n================ ENERGY BRAIN — RUNTIME PROBE ================\n');
  console.log('brain instantiated:', !!brain, '| has cycle():', !!(brain && brain.cycle), '| snapshotKey:', brain && brain.snapshotKey);

  // run two real cycles
  await brain.cycle();
  var s1 = snapshot(brain.state);
  await brain.cycle();
  var s2 = snapshot(brain.state);

  var stateKeys = Object.keys(brain.state || {});
  console.log('\n--- after 2 real cycles ---');
  console.log('state keys:', stateKeys.join(', '));
  console.log('diagnoses:', (s1.diagnoses||[]).length, '| active:', (s1.diagnoses||[]).filter(function(d){return d.active;}).length,
              '| treatments:', (s1.treatments||[]).length, '| opportunities:', (s1.opportunities||[]).length,
              '| companies:', (s1.companies||[]).length, '| stress:', s1.stress, '| phase:', s1.phase);
  if ((s1.diagnoses||[]).length) console.log('diagnosis ids:', s1.diagnoses.map(function(d){return d.id+(d.active?'*':'');}).join(', '));

  // Q4/Q5 runtime: do prior / prediction-error / model fields exist at runtime?
  var recurrentFields = ['energyModel','prior','predictionError','expectedSignals','expectedDiagnoses','expectedStress','expectedOpportunities','priorState','surprise'];
  var present = recurrentFields.filter(function(k){ return brain.state && (k in brain.state); });
  console.log('\nQ4/Q5 recurrent/prediction fields present in state:', present.length ? present.join(', ') : 'NONE');

  // memory substrate
  var mem = (brain.state && brain.state.memory) || (brain.memory) || {};
  console.log('memory.stressHistory len:', (mem.stressHistory||[]).length, '| phaseHistory len:', (mem.phaseHistory||[]).length, '| outcomeLog len:', (mem.outcomeLog||[]).length);

  // Q3/Q5 runtime: is cycle2 different from cycle1 given identical inputs? (plasticity vs re-run)
  function stripVolatile(o){ var c=JSON.parse(JSON.stringify(o)); delete c.updated; delete c.lastCycle; return c; }
  var diff = L.deepDiff(stripVolatile(s1), stripVolatile(s2));
  console.log('\nQ3/Q5 cycle2 vs cycle1 (volatile stripped):', diff.length===0 ? 'IDENTICAL (re-run, NOT learning — no plasticity)' : (diff.length+' field diffs'));
  if (diff.length) diff.slice(0,6).forEach(function(d){ console.log('   '+d.path+'  c1='+JSON.stringify(d.a)+'  c2='+JSON.stringify(d.b)); });

  // sample the emitted opportunity shape (for Q10/Q14)
  if ((s1.opportunities||[]).length) {
    console.log('\nemitted opportunity[0] field keys:', Object.keys(s1.opportunities[0]).join(', '));
  } else {
    console.log('\nemitted opportunities: 0 (none surfaced this run)');
  }
  // ── PHASE B PROOF: recurrent loop (prior re-enters; error converges/spikes) ──
  console.log('\n================ PHASE B — RECURRENT LOOP PROOF ================');
  var em0 = brain.state.energyModel;
  console.log('energyModel present after real cycles:', !!em0, '| keys:', em0 ? Object.keys(em0).join(',') : 'NONE');

  // Controlled, deterministic test: reset to neutral, then drive stress.
  brain.state.energyModel = brain._neutralEnergyModel();
  if ((brain.state.diagnoses || [])[0]) brain.state.diagnoses[0].active = true; // give diagnosisCount>0
  function step(stress, label) {
    brain.state.stress = stress;
    var em = brain._updateEnergyModel();
    console.log('  ' + label + ' stress=' + stress +
      ' | priorExpStress(before-read)=' + 'n/a' +
      ' | stressError=' + em.predictionError.stressError.toFixed(4) +
      ' | peTotal=' + em.predictionError.total.toFixed(4) +
      ' | nextPrior.expStress=' + em.prior.expectedStress.toFixed(4) +
      ' | reg=' + em.regulation.state +
      ' | readyForHandoff=' + em.readyForHandoff);
    return { se: em.predictionError.stressError, prior: em.prior.expectedStress, cycle: em.cycle };
  }
  console.log('\n-- stable input (0.70 x3): prediction error must DECREASE (prior is consumed) --');
  var a = step(0.70, 'c1');
  var b = step(0.70, 'c2');
  var c = step(0.70, 'c3');
  console.log('\n-- changed input (0.20): prediction error must INCREASE (surprise) --');
  var d = step(0.20, 'c4');

  var stableConverges = (b.se < a.se) && (c.se < b.se);
  var changeSpikes = d.se > c.se;
  var priorMoved = Math.abs(c.prior - 0.5) > 0.05;
  var diagsIntact = (brain.state.diagnoses || []).length === 6;
  var exposed = !!(brain.state && brain.state.energyModel);

  console.log('\n--- ACCEPTANCE ---');
  console.log('  [' + (stableConverges ? 'PASS' : 'FAIL') + '] stable input -> prediction error decreases (cycle N consumes cycle N-1 prior)');
  console.log('  [' + (changeSpikes ? 'PASS' : 'FAIL') + '] changed input -> prediction error increases');
  console.log('  [' + (priorMoved ? 'PASS' : 'FAIL') + '] prior updated from neutral 0.5 toward observed (now ' + c.prior.toFixed(3) + ')');
  console.log('  [' + (diagsIntact ? 'PASS' : 'FAIL') + '] six diagnoses still emit');
  console.log('  [' + (exposed ? 'PASS' : 'FAIL') + '] window.LIMENEnergyBrain.state.energyModel exposed');
  console.log('  outcomeLog now populated:', (brain.state.memory && brain.state.memory.outcomeLog || []).length, 'entries');
  var allPass = stableConverges && changeSpikes && priorMoved && diagsIntact && exposed;
  console.log('\nPHASE B: ' + (allPass ? 'PASS ✓ — Energy LEARNS (error changes from the prior, not a growing log)' : 'FAIL ✗'));
  console.log('\n================ END PROBE ================\n');
  process.exit(allPass ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
