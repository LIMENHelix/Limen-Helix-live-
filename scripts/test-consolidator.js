/**
 * scripts/test-consolidator.js — the CONSOLIDATOR (hippocampus component 3), propose-only.
 * Run: node scripts/test-consolidator.js
 *
 *   T1  calibration: resolution rate, direction hit-rate, per-direction reliability
 *   T2  Brier abstains honestly when forecasts carry no confidence; computes when they do
 *   T3  weightDrift: stable vs oscillating vs runaway from persisted snapshot diagnostics
 *   T4  buildProposal: insufficient-data below the min-resolved floor
 *   T5  buildProposal: low hit-rate ⇒ recalibrate; overconfidence ⇒ downscale (proposed, not applied)
 *   T6  buildProposal: runaway drift ⇒ freeze/rollback; stable+good ⇒ promotion-candidate
 *   T7  EVERY proposal is applied:false + requiresHumanReview:true (propose-only invariant)
 *   T8  handler contract: ?run=1 builds + stores a proposal; ?domain reads it; applies nothing
 */
var C = require('../lib/consolidator');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

// synthetic resolver output: 10 resolved, 6 hits; a 'rising' bias that misses
function mkResolve(nHit, nMiss, pending, dir) {
  var resolved = [];
  for (var i = 0; i < nHit; i++) resolved.push({ madeAt: 1000 + i, direction: dir || 'rising', hit: 1 });
  for (var j = 0; j < nMiss; j++) resolved.push({ madeAt: 5000 + j, direction: dir || 'rising', hit: 0 });
  var n = resolved.length;
  return { resolved: resolved, resolvedCount: n, pendingCount: pending || 0, externalHitRate: n ? Math.round((nHit / n) * 10000) / 10000 : null };
}

console.log('T1: calibration basics');
var r1 = mkResolve(6, 4, 3);
var c1 = C.calibration([], r1);
assert('resolvedCount 10', c1.resolvedCount === 10);
assert('resolutionRate = 10/13', Math.abs(c1.resolutionRate - 0.7692) < 1e-3, 'rate=' + c1.resolutionRate);
assert('directionHitRate 0.6', c1.directionHitRate === 0.6, 'hr=' + c1.directionHitRate);
assert('per-direction reliability present', c1.byDirection.rising && c1.byDirection.rising.hitRate === 0.6);

console.log('T2: Brier abstains without confidence, computes with it');
assert('brier null when no confidence', c1.brier === null && /no confidence/.test(c1.brierNote));
var fc = [{ madeAt: 1000, confidence: 0.9 }, { madeAt: 1001, confidence: 0.9 }, { madeAt: 5000, confidence: 0.9 }];  // 2 hits @0.9, 1 miss @0.9
var r2 = { resolved: [{ madeAt: 1000, direction: 'rising', hit: 1 }, { madeAt: 1001, direction: 'rising', hit: 1 }, { madeAt: 5000, direction: 'rising', hit: 0 }], resolvedCount: 3, pendingCount: 0, externalHitRate: 0.6667 };
var c2 = C.calibration(fc, r2);
// brier = mean[(0.9-1)^2, (0.9-1)^2, (0.9-0)^2] = mean[0.01,0.01,0.81] = 0.2767
assert('brier computed from confidence', Math.abs(c2.brier - 0.2767) < 1e-3, 'brier=' + c2.brier);
assert('overconfidence = meanConf - hitRate (~0.233)', Math.abs(c2.overconfidence - (0.9 - 0.6667)) < 1e-3, 'oc=' + c2.overconfidence);

console.log('T3: weightDrift stable / oscillating / runaway');
function snap(diag) { return { layers: { K5: { diag: diag } } }; }
var driftNone = C.weightDrift([]);
assert('no history ⇒ available:false', driftNone.available === false);
var stableHist = [snap({ driftFromSeed: 0.2, oscillating: false, runaway: false, stable: true }), snap({ driftFromSeed: 0.1, oscillating: false, runaway: false, stable: true })];
var dS = C.weightDrift(stableHist);
assert('stable history ⇒ stability stable', dS.available && dS.stability === 'stable');
assert('driftDelta newest-minus-oldest (0.2-0.1=0.1)', Math.abs(dS.layers.K5.driftDelta - 0.1) < 1e-9, 'dd=' + dS.layers.K5.driftDelta);
var runHist = [snap({ driftFromSeed: 0.9, oscillating: false, runaway: true, stable: false })];
assert('runaway flagged', C.weightDrift(runHist).stability === 'runaway');
assert('oscillating flagged', C.weightDrift([snap({ driftFromSeed: 0.5, oscillating: true, runaway: false, stable: false })]).stability === 'oscillating');

console.log('T4: insufficient-data below the floor');
var p4 = C.buildProposal('energy', C.calibration([], mkResolve(2, 1, 0)), null, { now: 111 });
assert('status insufficient-data', p4.status === 'insufficient-data');
assert('generatedAt threaded (no Date in lib)', p4.generatedAt === 111);

console.log('T5: low hit-rate ⇒ recalibrate; overconfidence ⇒ downscale (proposed)');
var p5 = C.buildProposal('finance', c2Extend(), null, { now: 1 });
function c2Extend() { var c = C.calibration(mkFcConf(9, 9), mkResolveConf(3, 9)); return c; }
function mkFcConf(hits, total) { var a = []; for (var i = 0; i < total; i++) a.push({ madeAt: i, confidence: 0.9 }); return a; }
// `base` is the always-stable baseline the resolver now reports alongside the hit
// rate. Default 0 so these fixtures describe a MOVING series, where a good hit rate
// really is skill. T6b below covers the degenerate case where it is not.
function mkResolveConf(hits, total, base) {
  var res = []; for (var i = 0; i < total; i++) res.push({ madeAt: i, direction: 'rising', hit: i < hits ? 1 : 0 });
  var hr = Math.round((hits / total) * 10000) / 10000, b = (base == null) ? 0 : base;
  return { resolved: res, resolvedCount: total, pendingCount: 0, externalHitRate: hr,
           alwaysStableRate: b, skill: Math.round((hr - b) * 10000) / 10000,
           directional: { n: total, hits: hits, hitRate: hr, signAccuracy: hr } };
}
assert('proposed status', p5.status === 'proposed');
assert('recalibrate-forecast rec present (hitRate 0.33 < 0.4)', p5.recommendations.some(function (r) { return r.kind === 'recalibrate-forecast'; }), JSON.stringify(p5.recommendations.map(function (r) { return r.kind; })));
assert('downscale-confidence rec present (overconfident)', p5.recommendations.some(function (r) { return r.kind === 'downscale-confidence'; }));

console.log('T6: runaway ⇒ freeze; stable+good ⇒ promotion-candidate');
var goodCalib = C.calibration([], mkResolveConf(8, 10));   // hit-rate 0.8
var pRun = C.buildProposal('energy', goodCalib, { available: true, stability: 'runaway', layers: {} }, { now: 1 });
assert('runaway ⇒ freeze-or-rollback', pRun.recommendations.some(function (r) { return r.kind === 'freeze-or-rollback'; }));
var pProm = C.buildProposal('energy', goodCalib, { available: true, stability: 'stable', layers: {} }, { now: 1 });
assert('stable + hit-rate 0.8 + POSITIVE skill ⇒ promotion-candidate', pProm.recommendations.some(function (r) { return r.kind === 'promotion-candidate'; }));

// T6b — the degeneracy the promotion gate exists to catch. A domain whose stress
// scalar never moves scores a hit rate of exactly 1.0 by calling "stable" forever.
// Eight of the twenty live domains have zero variance across the whole recorded
// history, and eleven produce no directional call at all. It must NOT be proposed for
// arming on the strength of a constant.
console.log('T6b: a perfect hit-rate with ZERO skill is not a promotion candidate');
var flatCalib = C.calibration([], mkResolveConf(10, 10, 1));   // hit-rate 1.0, baseline 1.0 ⇒ skill 0
assert('skill computed as 0', flatCalib.skill === 0, JSON.stringify(flatCalib.skill));
var pFlat = C.buildProposal('law', flatCalib, { available: true, stability: 'stable', layers: {} }, { now: 1 });
assert('hit-rate 1.0 but NOT a promotion candidate',
  !pFlat.recommendations.some(function (r) { return r.kind === 'promotion-candidate'; }),
  JSON.stringify(pFlat.recommendations.map(function (r) { return r.kind; })));
assert('flagged no-skill instead', pFlat.recommendations.some(function (r) { return r.kind === 'no-skill'; }),
  JSON.stringify(pFlat.recommendations.map(function (r) { return r.kind; })));
assert('and says why in plain terms', /abstention, not competence/.test(flatCalib.skillNote || ''), flatCalib.skillNote);

// T6c — a resolver result with no baseline at all (older stored proposals) must be
// treated as "cannot promote", never as skill 0 passing the gate by accident.
console.log('T6c: a missing baseline blocks promotion rather than defaulting');
var noBase = C.calibration([], { resolved: mkResolveConf(8, 10).resolved, resolvedCount: 10, pendingCount: 0, externalHitRate: 0.8 });
assert('skill is null, not 0', noBase.skill === null, JSON.stringify(noBase.skill));
var pNoBase = C.buildProposal('energy', noBase, { available: true, stability: 'stable', layers: {} }, { now: 1 });
assert('not a promotion candidate', !pNoBase.recommendations.some(function (r) { return r.kind === 'promotion-candidate'; }));

console.log('T7: propose-only invariant on EVERY proposal + recommendation');
[p4, p5, pRun, pProm, pFlat, pNoBase].forEach(function (p, i) {
  assert('proposal[' + i + '] applied:false + requiresHumanReview:true', p.applied === false && p.requiresHumanReview === true);
  assert('proposal[' + i + '] every rec applied:false', p.recommendations.every(function (r) { return r.applied === false; }));
});

console.log('T8: handler contract (in-memory db) — builds, reads, applies nothing');
(async function () {
  var db = require('../lib/limen-db');
  await db.set('feedhist:index', ['energy']);
  // seed a forecast that will resolve as a hit, and matching recorder truth 6h later
  var t0 = 1700000000000;
  await db.lpush('forecasthist:energy', { madeAt: t0, direction: 'rising', currentStress: 0.4 });
  await db.lpush('feedhist:energy', { t: t0 + 6 * 3600 * 1000, s: 0.7 });   // rose ⇒ hit
  var handler = require('../handlers/feed-consolidate');
  function call(url) { return new Promise(function (resolve) { var res = { setHeader: function () {}, statusCode: 200, end: function (b) { resolve({ status: res.statusCode, json: JSON.parse(b) }); } }; handler({ method: 'GET', url: url, headers: {} }, res); }); }
  var run = await call('/api/feed-consolidate?run=1');
  assert('run ok + built >=1', run.json.ok && run.json.built >= 1, JSON.stringify(run.json));
  assert('handler applied nothing', run.json.appliedAnything === false);
  var read = await call('/api/feed-consolidate?domain=energy');
  assert('read returns a stored proposal', read.json.ok && read.json.report && read.json.report.applied === false, JSON.stringify(read.json).slice(0, 200));
  var bad = await call('/api/feed-consolidate');
  assert('no run + no domain ⇒ 400', bad.status === 400);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
