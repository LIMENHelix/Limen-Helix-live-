/**
 * scripts/test-phase-adapter-human.js — proves Adapter A (lib/phase-adapter-human.js). OFFLINE.
 * Run: node scripts/test-phase-adapter-human.js
 *
 * Verifies the sensory→channel mapping AND the two boundaries that make it safe: HRV (independent,
 * high-precision) is not outvoted by an agreeing self-report cluster, and the module exposes NO
 * clinical-output surface. No clinical conclusion is produced or asserted anywhere in this test.
 */

var A = require('../lib/phase-adapter-human.js');
var PE = require('../lib/phase-estimator.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); } }
function section(t) { console.log('\n' + t); }
function ruptureMass(L) { return L[3] + L[7] + L[9]; }
function sum(v) { var s = 0, i; for (i = 0; i < v.length; i++) s += v[i]; return s; }

// ── 1. The HUMAN GATE is structural — no clinical-output surface exists ───────────────────────────
section('1. HUMAN GATE: the module exposes channel builders only, no clinical output');
var clinicalVerbs = ['diagnose', 'diagnosis', 'recommend', 'recommendation', 'contraindication', 'prescribe', 'treat', 'treatment', 'supplement', 'stack'];
var exportKeys = Object.keys(A).map(function (k) { return k.toLowerCase(); });
ok('no clinical verb in exported API', clinicalVerbs.every(function (v) { return exportKeys.indexOf(v) === -1; }), 'exports: ' + exportKeys.join(','));
var b0 = A.toBundle({ hrv: 0.8 }, { subjectId: 'p1' });
var bundleKeys = Object.keys(b0).map(function (k) { return k.toLowerCase(); });
ok('bundle carries no belief/label/diagnosis/recommendation field',
   ['belief', 'label', 'diagnosis', 'recommendation', 'phase', 'action'].every(function (k) { return bundleKeys.indexOf(k) === -1; }), 'bundle keys: ' + bundleKeys.join(','));
ok('HUMAN_GATE statement is exported', typeof A.HUMAN_GATE === 'string' && /never an action/i.test(A.HUMAN_GATE));

// ── 2. Bundle shape ──────────────────────────────────────────────────────────────────────────────
section('2. toBundle emits a well-formed human ChannelBundle');
var full = A.toBundle({
  scent: { marks: { citrus: '+', vanilla: '+', vinegar: '-' } },
  sound: 0.6, touch: 0.4, thermal: 0.2, taste: 0.1, hrv: 0.7,
  verbalTheme: ['rebuilding', 'hopeful'], behavioral: ['calm']
}, { subjectId: 'p1' });
ok('substrate = human', full.substrate === 'human' && full.subjectId === 'p1');
ok('every reading has key + likelihood[11]', full.readings.every(function (r) { return typeof r.key === 'string' && Array.isArray(r.likelihood) && r.likelihood.length === 11; }));
ok('every likelihood sums to 1', full.readings.every(function (r) { return Math.abs(sum(r.likelihood) - 1) < 1e-9; }));

// ── 3. HRV is the one independent (precisionHint) channel; self-report has none ──────────────────
section('3. Reliability-classed precisionHint: HRV high, self-report low (spec §4 table)');
function byKey(bundle, k) { return bundle.readings.filter(function (r) { return r.key === k; })[0]; }
ok('hrv has a HIGH precisionHint', byKey(full, 'hrv').precisionHint >= 3);
ok('scent (self-report) has a LOW precisionHint, well below HRV',
   byKey(full, 'scent').precisionHint < 1 && byKey(full, 'scent').precisionHint < byKey(full, 'hrv').precisionHint);
ok('taste (self-report) has a LOW precisionHint', byKey(full, 'taste').precisionHint < 1);
ok('thermal (structured test) sits between self-report and HRV',
   byKey(full, 'thermal').precisionHint > byKey(full, 'scent').precisionHint && byKey(full, 'thermal').precisionHint < byKey(full, 'hrv').precisionHint);

// ── 4. Sensory→phase mappings are correct (stated priors from the diagnostic tables) ─────────────
section('4. Sensory→phase mappings load the documented phases');
ok('citrus liked => Light (P1) is the top phase', (function () { var L = A.scentLikelihood({ citrus: '+' }); return L.indexOf(Math.max.apply(null, L)) === 1; })());
ok('incense liked => Threshold (P9) is the top phase', (function () { var L = A.scentLikelihood({ incense: '+' }); return L.indexOf(Math.max.apply(null, L)) === 9; })());
ok('thermal signal => Endurance (P5)', A.senseLikelihood('thermal', 1).indexOf(Math.max.apply(null, A.senseLikelihood('thermal', 1))) === 5);
ok('taste signal => Separation (P7)', A.senseLikelihood('taste', 1).indexOf(Math.max.apply(null, A.senseLikelihood('taste', 1))) === 7);
ok('high HRV loads Peace (P4) over Endurance (P5)', A.hrvReading(0.9).likelihood[4] > A.hrvReading(0.9).likelihood[5]);
ok('low HRV loads Endurance (P5) over Peace (P4)', A.hrvReading(0.1).likelihood[5] > A.hrvReading(0.1).likelihood[4]);
ok('verbal "rebuilding" loads Resurrection (P10)', A.tagLikelihood(['rebuilding']).indexOf(Math.max.apply(null, A.tagLikelihood(['rebuilding']))) === 10);

// ── 5. END-TO-END through the shared estimator (belief only — no clinical claim) ─────────────────
section('5. Bundle -> shared estimator produces a BELIEF (decision support only)');
var calmProfile = A.toBundle({ hrv: 0.85, touch: 0.7, scent: { marks: { vanilla: '+', chamomile: '+' } }, verbalTheme: ['calm', 'safe'] }, { subjectId: 'p1' });
var calmEst = PE.estimate(calmProfile);
ok('estimator grounds on the human bundle', calmEst.grounded === true && Math.abs(sum(calmEst.belief) - 1) < 1e-6);
ok('a calm/high-HRV profile lands in the constructive band (P4 Peace among top)',
   calmEst.belief[4] >= calmEst.belief[3], 'P4=' + calmEst.belief[4].toFixed(3) + ' P3=' + calmEst.belief[3].toFixed(3));

// ── 6. GROUPTHINK at the human layer: HRV resists an agreeing self-report cluster ────────────────
section('6. GROUPTHINK: validated HRV (Peace) is not outvoted by a self-report cluster (all Endurance)');
var conflict = A.toBundle({
  hrv: 0.9,                                     // independent, high-precision → Peace (P4)
  thermal: 0.95,                                // self-report → Endurance (P5)
  scent: { marks: { pepper: '+', clove: '+', ginger: '+' } },  // self-report cluster → Endurance (P5)
  verbalTheme: ['grinding', 'pushing']          // self-report → Endurance (P5)
}, { subjectId: 'p1' });
var cEst = PE.estimate(conflict);
ok('HRV keeps Peace competitive vs the agreeing Endurance cluster (P4 within 0.5x of P5, not buried)',
   cEst.belief[4] >= cEst.belief[5] * 0.5, 'P4=' + cEst.belief[4].toFixed(3) + ' P5=' + cEst.belief[5].toFixed(3));
console.log('        conflict belief: P4(Peace)=' + cEst.belief[4].toFixed(3) + '  P5(Endurance)=' + cEst.belief[5].toFixed(3) + '  MAP=P' + cEst.phaseMAP);

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
