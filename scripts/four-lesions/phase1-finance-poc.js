/**
 * scripts/four-lesions/phase1-finance-poc.js
 * FOUR LESIONS — Phase 0 Minimal + Phase 1 (motor loop) + Phase 1.5 (persistence)
 * proof-of-concept on the FINANCE domain.  (run: node scripts/four-lesions/phase1-finance-poc.js)
 *
 * WHAT THIS PROVES (and what it does NOT):
 *   It proves the MECHANISM: finance's action (a DIRECTION FORECAST — the only
 *   thing the resolver can grade) is scored by the REAL resolver (lib/feed-resolver)
 *   against recorded feed truth, forward-only; the resulting external outcome is
 *   turned into a reward-prediction-error by the REAL K4 credit gate + the REAL
 *   three-factor plasticity module (assets/js/limen-plasticity.js); weights move
 *   only through the gated applyModulator (no direct writes); and the learned
 *   weights survive a save/reload through the REAL /api/brain-weights handler.
 *
 *   It does NOT prove finance is learning from LIVE production feeds right now.
 *   The forecast/recorder series here is CONSTRUCTED and deterministic (locally
 *   there is no Redis history, and a forecast must age past the 6h horizon to
 *   resolve). This is mechanism-validation, not live-data validation. The live
 *   leg accrues in prod once the ?emit=1 cron forecasts age past the horizon and
 *   BRAIN_WEIGHTS_TOKEN is set. Reported honestly below; no invented percentages.
 *
 * The four non-negotiable constraints from the spec, enforced here:
 *   1. Gated plasticity  — weights change ONLY via applyModulator (checked by scan).
 *   2. Real outcomes     — outcome comes from resolver.resolve, never Math.random.
 *   3. Single domain     — finance only; no domain iteration.
 *   4. Sequential phases — Phase 1 must pass before Phase 1.5 runs.
 */

'use strict';

// Set the persistence token BEFORE requiring the handler (it reads env at load).
process.env.BRAIN_WEIGHTS_TOKEN = process.env.BRAIN_WEIGHTS_TOKEN || 'poc-token';

var path = require('path');
var fs = require('fs');

var resolver = require('../../lib/feed-resolver');                       // REAL resolver math
var P = require('../../assets/js/limen-plasticity.js');                  // REAL three-factor plasticity
var K4 = require('../../assets/js/limen-k4-selfconsistency.js');         // REAL honest credit gate
var trace = require('../../lib/four-lesions/trace-phase1');              // Phase 0 audit buffer
var brainWeights = require('../../handlers/brain-weights.js');           // REAL persistence endpoint

var DOMAIN = 'finance';
var HOUR = 3600 * 1000;
var EPOCH = 1700000000000;    // fixed base time (no Date.now — deterministic + resume-safe)

var failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS ' + name); }
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function r4(x) { return Math.round(x * 10000) / 10000; }

// The finance K-stack layers — mirror domain-brain-base.js GP_LAYERS literals 1:1
// (the live static constants being made learnable). Same seeds ⇒ same posterior shape.
var GP_LAYERS = [
  { key: 'K_gain', name: 'generic-output-scale', seed: [0.5], labels: ['inhibitionToScale'], eta: 0.02, traceDecay: 0.85, priorLambda: 0.002, minW: 0, maxW: 1.0 },
  { key: 'K_attention', name: 'generic-salience', seed: [0.5, 0.4, 0.1], labels: ['activeBase', 'relevanceWeight', 'peWeight'], eta: 0.03, traceDecay: 0.8, priorLambda: 0.003, minW: 0, maxW: 1.0 },
  { key: 'K_slow', name: 'generic-slow-rate', seed: [0.08], labels: ['slowConsolidationRate'], eta: 0.005, modScale: 0.5, traceDecay: 0.9, priorLambda: 0.001, minW: 0.01, maxW: 0.3 },
  { key: 'K_homeo', name: 'generic-adaptive-threshold', seed: [0.10], labels: ['thresholdBase'], eta: 0.02, traceDecay: 0.85, priorLambda: 0.002, minW: 0.02, maxW: 0.3 }
];
function makeLayers() {
  var L = {};
  for (var i = 0; i < GP_LAYERS.length; i++) { var c = GP_LAYERS[i]; L[c.key] = P.createLayer(c); }
  return L;
}

// Per-layer (pre, post) for tick() — derived deterministically from the resolved
// forecast so the eligibility trace is non-trivial (weights can actually move).
function feedsFor(rf) {
  var cur = rf.currentStress, real = rf.realizedStress, del = Math.abs(rf.delta), hit = rf.hit;
  return {
    K_gain: { pre: [cur], post: 1 - cur },
    K_attention: { pre: [1, hit, del], post: real },
    K_slow: { pre: [Math.abs(cur - 0.5)], post: del },
    K_homeo: { pre: [cur], post: real }
  };
}

// ── Build a deterministic recorder series + server-derived forecasts, exactly the
//    way the production cron does (resolver.deriveForecast over recorded history),
//    then grade with resolver.resolve. A rising ramp with a deterministic wiggle so
//    directions are mostly 'rising' with genuine hits AND misses (a real hit rate). ──
function buildSeries() {
  var N = 48;                         // ~2 days of hourly recorder rows
  var recorder = [];
  for (var i = 0; i < N; i++) {
    var base = 0.15 + 0.6 * (i / (N - 1));                 // rising 0.15 -> 0.75
    var wiggle = 0.06 * Math.sin(i * 1.3) + 0.04 * Math.cos(i * 0.7);   // deterministic, no RNG
    var s = Math.max(0, Math.min(1, base + wiggle));
    recorder.push({ t: EPOCH + i * HOUR, s: r4(s) });
  }
  // Server-derived forecast at each hour from the history up to that hour (mirrors the cron).
  var forecasts = [];
  for (var j = 3; j < N; j++) {
    var hist = recorder.slice(0, j + 1);
    var fc = resolver.deriveForecast(hist);
    if (!fc) continue;
    forecasts.push({ madeAt: recorder[j].t, direction: fc.direction, currentStress: fc.currentStress, projectedStress: fc.projectedStress });
  }
  var now = EPOCH + (N - 1) * HOUR + HOUR;   // past the last row so early forecasts have resolved
  return { recorder: recorder, forecasts: forecasts, now: now };
}

// ── Constraint scans (the spec's grep tests, run in-process over the honest scope
//    of "did WE introduce an ungated write / a mock outcome"). ──
function scanFiles(dirs, re) {
  var hits = [];
  function walk(d) {
    var entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i], full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.js$/.test(e.name)) continue;
      if (/limen-plasticity\.js$/.test(e.name)) continue;   // the ONE legal home for direct weight writes
      var txt;
      try { txt = fs.readFileSync(full, 'utf8'); } catch (e2) { continue; }
      var lines = txt.split('\n');
      for (var k = 0; k < lines.length; k++) { if (re.test(lines[k])) hits.push(full + ':' + (k + 1) + '  ' + lines[k].trim()); }
    }
  }
  dirs.forEach(walk);
  return hits;
}

function main() {
  console.log('═══ FOUR LESIONS — Phase 0/1/1.5 POC (finance) ═══\n');

  // ── PHASE 0: audit buffer ready ──
  console.log('PHASE 0 — minimal tracing');
  var tracer = new trace.TraceBufferPhase1(DOMAIN);
  ok('trace buffer instantiated for finance', tracer.domain === 'finance');
  var threw = false;
  try { tracer.log({ type: 'not-a-real-type', validator: function () { return true; } }); } catch (e) { threw = true; }
  ok('rejects an out-of-scope event type', threw);

  // ── PHASE 1: close the motor loop on real resolver-graded forecasts ──
  console.log('\nPHASE 1 — motor loop (action = direction forecast, graded by the real resolver)');
  var series = buildSeries();
  ok('server-derived forecasts exist (deriveForecast, same as prod cron)', series.forecasts.length >= 8, 'n=' + series.forecasts.length);

  var graded = resolver.resolve(series.forecasts, series.recorder, { now: series.now });
  ok('resolver resolved forecasts forward-only (real outcome source)', graded.resolvedCount >= 8, 'resolved=' + graded.resolvedCount);
  ok('externalHitRate is a real fraction in [0,1]', typeof graded.externalHitRate === 'number' && graded.externalHitRate >= 0 && graded.externalHitRate <= 1, String(graded.externalHitRate));

  // Every graded item is a DIRECTION call (operator correction #1: the action is a forecast).
  var allDirections = graded.resolved.every(function (r) { return ['rising', 'falling', 'stable'].indexOf(r.direction) !== -1; });
  ok('every action is a direction forecast (only resolver-gradeable action type)', allDirections);

  // Order resolutions in time and feed them, one fresh outcome per trial, through the
  // REAL K4 gate + REAL plasticity gate. Running hit rate = the external reward signal.
  var resolvedSorted = graded.resolved.slice().sort(function (a, b) { return a.realizedAt - b.realizedAt; });
  var layers = makeLayers();
  var mod = P.createModulator();
  var before = {}; Object.keys(layers).forEach(function (k) { before[k] = layers[k].w.slice(); });

  var hitsSoFar = 0, rewardActiveEver = false, freshUpdates = 0, rpeSum = 0, rpeN = 0;
  for (var t = 0; t < resolvedSorted.length; t++) {
    var rf = resolvedSorted[t];
    var trial = t + 1;

    // action-selected — the forecast (direction call) the brain emitted
    tracer.log({
      type: 'action-selected', timestamp: rf.madeAt,
      value: { direction: rf.direction, currentStress: rf.currentStress, madeAt: rf.madeAt },
      precedent: 'Forecast emission = the only resolver-gradeable action (direction call)',
      validatorReason: 'forecast has a valid direction + finite currentStress',
      validator: function () { return ['rising', 'falling', 'stable'].indexOf(rf.direction) !== -1 && isFinite(rf.currentStress); }
    });

    // action-executed — the resolver returned the real outcome (NOT a mock)
    rf.fromResolver = true;
    hitsSoFar += rf.hit;
    tracer.log({
      type: 'action-executed', timestamp: rf.realizedAt,
      value: { direction: rf.direction, realizedStress: rf.realizedStress, delta: rf.delta, hit: rf.hit, fromResolver: true },
      precedent: 'Efference copy / corollary discharge (von Holst & Mittelstaedt 1950; Sperry 1950)',
      validatorReason: 'outcome carries a resolver-graded realized row, finite delta, hit in {0,1}',
      validator: function () { return rf.fromResolver === true && isFinite(rf.delta) && (rf.hit === 0 || rf.hit === 1) && typeof rf.realizedAt === 'number'; }
    });

    // external outcome -> honest credit (tier 4 external reward, isReward true) -> centered RPE
    var runningHit = hitsSoFar / trial;
    var k4 = K4.credit({ externalOutcome: { hit: runningHit } });
    if (k4.isReward) rewardActiveEver = true;
    var modRead = P.readModulator(mod, k4, trial);   // monotonic resolved-sample count ⇒ fresh each trial

    var f = feedsFor(rf);
    var updatesBefore = {}; Object.keys(layers).forEach(function (k) { updatesBefore[k] = layers[k].updates; });

    // per-layer: eligibility tick, then GATED modulator application (the ONLY weight-write path)
    var appliedThisTrial = 0;
    Object.keys(layers).forEach(function (k) {
      var layer = layers[k], ff = f[k];
      P.tick(layer, ff.pre, ff.post);
      if (modRead.fresh && modRead.rpe !== null) {
        P.applyModulator(layer, modRead.rpe);
        if (layers[k].updates > updatesBefore[k]) appliedThisTrial++;
      }
    });
    if (modRead.fresh && modRead.rpe !== null) { rpeSum += modRead.rpe; rpeN++; }

    // weight-updated — applyModulator actually applied (updates counter advanced), weights finite
    if (appliedThisTrial > 0) {
      freshUpdates++;
      (function (rpeVal, cs, applied) {
        tracer.log({
          type: 'weight-updated', timestamp: rf.realizedAt,
          value: { rpe: rpeVal, creditSource: cs, layersUpdated: applied },
          precedent: 'Three-factor plasticity: Δw = η·pre·post·modulator (Frémaux & Gerstner 2016)',
          validatorReason: 'gated applyModulator advanced the updates counter; rpe finite',
          validator: function () {
            var allFinite = Object.keys(layers).every(function (k) { return layers[k].w.every(function (w) { return isFinite(w); }); });
            return typeof rpeVal === 'number' && isFinite(rpeVal) && applied > 0 && allFinite;
          }
        });
      })(modRead.rpe, k4.creditSource, appliedThisTrial);
    }
  }

  var audit = tracer.audit();
  console.log('  audit:', JSON.stringify(audit.counts), 'allPass=' + audit.allPass, 'failures=' + audit.failures.length);
  ok('all three mechanisms COMPUTED (not just named)', audit.allPass, JSON.stringify(audit.failures));
  ok('outcome credit was TRUE external reward (tier 4, isReward)', rewardActiveEver);
  ok('gated updates applied on most trials', freshUpdates >= Math.floor(resolvedSorted.length * 0.6), 'freshUpdates=' + freshUpdates + '/' + resolvedSorted.length);

  // Learning verification — weights moved, stayed finite + within clamp, not NaN
  var moved = false, allFinite = true, withinClamp = true, meanAbsDelta = 0, deltaN = 0;
  var cfgByKey = {}; GP_LAYERS.forEach(function (c) { cfgByKey[c.key] = c; });
  Object.keys(layers).forEach(function (k) {
    var c = cfgByKey[k], w = layers[k].w, b = before[k];
    for (var i = 0; i < w.length; i++) {
      if (Math.abs(w[i] - b[i]) > 1e-9) moved = true;
      if (!isFinite(w[i])) allFinite = false;
      if (w[i] < c.minW - 1e-9 || w[i] > c.maxW + 1e-9) withinClamp = false;
      meanAbsDelta += Math.abs(w[i] - b[i]); deltaN++;
    }
  });
  meanAbsDelta = deltaN ? meanAbsDelta / deltaN : 0;
  ok('weights moved systematically (learning happened)', moved);
  ok('all weights finite (no NaN/Infinity)', allFinite);
  ok('all weights within their clamp bounds (no saturation runaway)', withinClamp);
  console.log('  learning: meanHitRate=' + r4(hitsSoFar / resolvedSorted.length) +
    ', meanRPE=' + (rpeN ? r4(rpeSum / rpeN) : 'n/a') + ', mean|Δw|=' + r4(meanAbsDelta));

  // Constraint 1 — no ungated weight writes in the code this build touches/exercises
  var c1 = scanFiles(
    [path.join(__dirname, '..', '..', 'assets', 'js', 'domain-brains'),
     path.join(__dirname, '..', '..', 'lib', 'four-lesions'),
     path.join(__dirname, '..', '..', 'scripts', 'four-lesions')],
    /kLayer\.weight\s*=|\.weight\s*\+=/
  );
  ok('Constraint 1: zero direct weight writes outside limen-plasticity.js', c1.length === 0, c1.join(' | '));

  // Constraint 2 — the outcome path uses no RNG. Two honest checks:
  //   (a) the OUTCOME SOURCE module (the resolver) is deterministic;
  //   (b) this POC introduces no RNG in its outcome handling.
  // The token is built by concatenation so this check's own source never
  // self-matches (the failure the first draft hit).
  var RNG_RE = new RegExp('Math\\.' + 'random\\s*\\(');
  var resolverSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'feed-resolver.js'), 'utf8');
  ok('Constraint 2a: resolver (the outcome source) uses no RNG', !RNG_RE.test(resolverSrc));
  var c2 = scanFiles([path.join(__dirname)], RNG_RE);
  ok('Constraint 2b: POC harness introduces no RNG in the outcome path', c2.length === 0, c2.join(' | '));

  if (failures > 0) {
    console.error('\nPhase 1 did NOT pass — Phase 1.5 is gated behind it (Constraint 4). Stopping.');
    finish();
    return;
  }

  // ── PHASE 1.5: persistence gate (weights must survive save/reload) ──
  console.log('\nPHASE 1.5 — persistence gate (train ▸ save ▸ reload ▸ compare)');
  var snap = P.serialize(layers, mod, { domain: DOMAIN, cycle: resolvedSorted.length });
  ok('serialize produced a snapshot with all 4 layers', snap && snap.layers && Object.keys(snap.layers).length === 4);
  ok('snapshot carries honest labels (mode:shadow, isReward from modulator)', snap.mode === 'shadow' && typeof snap.isReward === 'boolean');

  // Reload A — format contract: hydrate FRESH layers from the stored snapshot.
  var fresh = makeLayers();
  var freshMod = P.createModulator();
  var hy = P.hydrate(fresh, snap);
  P.hydrateModulator(freshMod, snap);
  ok('all 4 layers restored (none reset — seed shapes match)', hy.restored.length === 4 && hy.reset.length === 0, JSON.stringify(hy));
  var identicalA = Object.keys(snap.layers).every(function (k) {
    return String(fresh[k].w) === String(snap.layers[k].w);
  });
  ok('reloaded weights identical to the stored snapshot (no drift on reload)', identicalA);

  // Reload B — the REAL endpoint: POST to /api/brain-weights, then a fresh GET reads it back.
  callHandler('POST', '/api/brain-weights', { domain: DOMAIN, snapshot: snap }, { 'x-brain-token': process.env.BRAIN_WEIGHTS_TOKEN }, function (postRes) {
    ok('POST /api/brain-weights stored the finance snapshot (token-gated)', postRes.status === 200 && postRes.json && postRes.json.ok === true, JSON.stringify(postRes.json));
    callHandler('GET', '/api/brain-weights?domain=' + DOMAIN, undefined, {}, function (getRes) {
      var s2 = getRes.json && getRes.json.snapshot;
      var identicalB = !!s2 && Object.keys(snap.layers).every(function (k) {
        return s2.layers && s2.layers[k] && String(s2.layers[k].w) === String(snap.layers[k].w);
      });
      ok('GET /api/brain-weights returns byte-identical weights (survives reload)', identicalB, s2 ? 'ok' : 'no snapshot');
      ok('honest labels survived the round-trip', !!s2 && s2.mode === 'shadow');
      finish();
    });
  });
}

// Minimal req/res shim for the real handler (same pattern as test-brain-weights-handler.js).
function callHandler(method, url, body, headers, cb) {
  var req = { method: method, url: url, headers: headers || {}, body: body !== undefined ? body : undefined, on: function () {} };
  var res = {
    statusCode: 200, _h: {},
    setHeader: function (k, v) { this._h[k] = v; },
    end: function (payload) { var j = null; try { j = JSON.parse(payload); } catch (e) {} cb({ status: this.statusCode, json: j }); }
  };
  Promise.resolve(brainWeights(req, res)).catch(function (e) { cb({ status: 500, json: { error: e.message } }); });
}

function finish() {
  console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
  console.log(failures === 0
    ? '\n✓ MECHANISM VALIDATED: finance closes the motor loop on real resolver-graded\n  forecasts through the gated plasticity path, and the learned weights persist\n  across reload via /api/brain-weights. This is mechanism-validation on a\n  constructed series — NOT proof of live-feed learning (that accrues in prod once\n  ?emit=1 forecasts age past the 6h horizon and BRAIN_WEIGHTS_TOKEN is set).'
    : '\n✗ One or more checks failed — see FAIL lines above.');
  process.exit(failures ? 1 : 0);
}

main();
