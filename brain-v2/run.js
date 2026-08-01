/**
 * brain-v2/run.js — drive the closed loop over REAL recorded energy history.
 *
 *   node brain-v2/run.js [rows] [--ablate=module] [--fresh] [--trace]
 *
 * Data: brain-v2/fixtures/energy-recorder.json, a cached pull of
 * https://limenhelix.com/api/feed-record?read=energy&n=400 — 362 hourly rows, real readings.
 * Cached rather than fetched live so every run is reproducible and offline.
 *
 * STATED LIMITATION, carried forward from replay-energy.js: the recorder stores each source's
 * SATURATED `value`, not `recent7d`. So this replay runs on the worse input by construction,
 * and anything it shows about channel liveness is a LOWER bound on how much the saturation
 * matters, not an estimate of it.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var LOOP = require('./kernel/loop.js');
var BIND = require('./bind/energy.js');
var VIT = require('./kernel/vitals.js');
var PRED = require('./kernel/predict.js');
var MOD = require('./kernel/modulators.js');
var CX = require('./kernel/connectome.js');
var ACT = require('./kernel/actuate.js');
var ST = require('./kernel/store.js');

var args = process.argv.slice(2);
var N = parseInt(args.filter(function (a) { return /^\d+$/.test(a); })[0], 10) || 362;
var ablate = (args.filter(function (a) { return a.indexOf('--ablate=') === 0; })[0] || '').split('=')[1] || null;
var fresh = args.indexOf('--fresh') >= 0;
var showTrace = args.indexOf('--trace') >= 0;

var FIX = path.join(__dirname, 'fixtures', 'energy-recorder.json');
var STORE_DIR = path.join(__dirname, 'state', ablate ? 'run-ablate-' + ablate : 'run');

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

if (fresh && fs.existsSync(STORE_DIR)) fs.rmSync(STORE_DIR, { recursive: true, force: true });

var fixture = JSON.parse(fs.readFileSync(FIX, 'utf8'));
var rows = fixture.rows.slice().sort(function (a, b) { return a.t - b.t; }).slice(0, N);

var HOUR = 3600000;
var spec = {
  domain: 'energy',
  storeDir: STORE_DIR,
  brainSpec: BIND.spec(),
  horizonMs: 6 * HOUR,          // predictions resolve six recorded hours later
  vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR }
};

var snap = ST.loadSnapshot(ST.open(STORE_DIR));
var loop = (snap && snap.state && !fresh) ? LOOP.restore(spec, snap.state) : LOOP.create(spec);
if (ablate) LOOP.ablate(loop, ablate, true);

console.log('=== BRAIN-V2 CLOSED LOOP over real recorded energy ===');
console.log('  rows       : ' + rows.length + '  (' + new Date(rows[0].t).toISOString().slice(0, 16).replace('T', ' ') +
            ' -> ' + new Date(rows[rows.length - 1].t).toISOString().slice(0, 16).replace('T', ' ') + ')');
console.log('  store      : ' + STORE_DIR);
console.log('  resumed    : ' + (snap && !fresh ? 'yes, from tick ' + (snap.state.ticks || 0) : 'no, fresh'));
console.log('  ablation   : ' + (ablate || 'none'));
console.log('  horizon    : ' + (spec.horizonMs / HOUR) + 'h');
console.log('');

var stats = {
  ticks: 0, admitted: 0, rejected: 0, abstained: 0, dysregulated: 0,
  predictions: 0, resolved: 0, hits: 0, unresolvable: 0, contaminated: 0,
  released: 0, held: 0, executed: 0, failed: 0, deadAxon: 0,
  byKind: {}, byHoldReason: {}, consolidations: 0
};
var lastRep = null, firstFullTrace = null;

rows.forEach(function (row, i) {
  var now = row.t;

  // Arousal cycle: 20 hours awake, then an offline window for consolidation.
  // The rhythm is BLOCK_B3 (a cadence that runs without input) and it is what makes the
  // offline state exist at all; without it consolidation has no permitted window.
  var hourOfDay = new Date(now).getUTCHours();
  var wantOffline = (hourOfDay >= 2 && hourOfDay < 4);
  if (wantOffline && loop.vitals.arousal !== VIT.AROUSAL.OFFLINE) {
    VIT.setArousal(loop.vitals, VIT.AROUSAL.OFFLINE, now, 'scheduled offline window');
    var c = LOOP.consolidate(loop, now);
    if (c.ran) {
      stats.consolidations++;
      if (showTrace) console.log('  [consolidate] pass ' + c.pass + ': replayed ' + c.replayed.length +
        ', downscaled ' + c.downscaled + ', retired ' + c.retired + ', promotions ' +
        c.promotions.filter(function (p) { return p.promoted; }).length);
    }
  } else if (!wantOffline && loop.vitals.arousal !== VIT.AROUSAL.WAKE) {
    VIT.setArousal(loop.vitals, VIT.AROUSAL.WAKE, now, 'offline window ended');
  }
  if (loop.vitals.arousal === VIT.AROUSAL.OFFLINE) return;   // state exclusivity: no encoding

  var readings = BIND.readRecorderRow(row);
  var keyed = {};
  Object.keys(readings).forEach(function (k) { keyed[k] = { value: readings[k].value, eventTime: now }; });

  var rep = LOOP.tick(loop, keyed, now);
  lastRep = rep;
  stats.ticks++;

  var bar = rep.steps.filter(function (s) { return s.step === 'barrier'; })[0] || {};
  stats.admitted += bar.admitted || 0;
  stats.rejected += bar.rejected || 0;

  var dc = rep.steps.filter(function (s) { return s.step === 'domain_cycle'; })[0] || {};
  if (dc.abstained) stats.abstained++;
  if (dc.dysregulated) stats.dysregulated++;

  var pr = rep.steps.filter(function (s) { return s.step === 'predict'; })[0] || {};
  if (pr.predictionId) stats.predictions++;

  var rs = rep.steps.filter(function (s) { return s.step === 'resolve'; })[0] || {};
  (rs.detail || []).forEach(function (r) {
    if (r.observable === false || r.status === 'expired') { stats.unresolvable++; return; }
    if (r.observable) {
      stats.resolved++;
      if (r.hit) stats.hits++;
      if (r.contaminated) stats.contaminated++;
    }
  });

  var sel = rep.steps.filter(function (s) { return s.step === 'select'; })[0] || {};
  if (sel.outcome === 'released') {
    stats.released++;
    stats.byKind[sel.released] = (stats.byKind[sel.released] || 0) + 1;
  } else if (sel.outcome === 'held') {
    stats.held++;
    var reason = (sel.pathway || 'unknown');
    stats.byHoldReason[reason] = (stats.byHoldReason[reason] || 0) + 1;
  }

  var ac = rep.steps.filter(function (s) { return s.step === 'actuate'; })[0] || {};
  if (ac.status === 'executed') stats.executed++;
  if (ac.status === 'failed') { stats.failed++; if (ac.why && ac.why.indexOf('no effector') >= 0) stats.deadAxon++; }

  // Keep the first tick that ran the whole path, for the audit trace.
  if (!firstFullTrace && ac.status === 'executed') firstFullTrace = rep;

  if (showTrace && i % 40 === 0) {
    console.log('  [' + padL(i, 4) + '] ' + new Date(now).toISOString().slice(5, 16).replace('T', ' ') +
      '  dep=' + (dc.departure === null ? ' abst' : padL(dc.departure.toFixed(2), 5)) +
      '  live=' + padL(dc.fusable, 2) + '/' + padL((dc.fusable || 0) + (dc.blind || 0), 2) +
      '  sel=' + pad(sel.outcome || '-', 9) + (sel.released ? pad(sel.released, 18) : pad('', 18)) +
      '  exec=' + pad(ac.status || '-', 9));
  }
});

// ── REPORT ────────────────────────────────────────────────────────────────────────────────
console.log('');
console.log('=== RUN TOTALS (' + stats.ticks + ' ticks) ===');
console.log('  observations admitted / rejected : ' + stats.admitted + ' / ' + stats.rejected);
console.log('  cycles abstained                 : ' + stats.abstained);
console.log('  cycles dysregulated              : ' + stats.dysregulated);
console.log('  predictions registered           : ' + stats.predictions);
console.log('  predictions resolved             : ' + stats.resolved + '  (hits ' + stats.hits + ')');
console.log('  predictions unresolvable/expired : ' + stats.unresolvable);
console.log('  resolutions flagged contaminated : ' + stats.contaminated + '  (self-caused > half the movement)');
console.log('  actions released / held          : ' + stats.released + ' / ' + stats.held);
Object.keys(stats.byHoldReason).forEach(function (k) { console.log('      held via ' + pad(k, 14) + stats.byHoldReason[k]); });
Object.keys(stats.byKind).forEach(function (k) { console.log('      released  ' + pad(k, 18) + stats.byKind[k]); });
console.log('  executed / failed / dead-axon    : ' + stats.executed + ' / ' + stats.failed + ' / ' + stats.deadAxon);
console.log('  consolidation passes             : ' + stats.consolidations);

console.log('');
console.log('=== CHANNEL INVENTORY (BLOCK_B17, INV-13) ===');
var inv = lastRep.selfModel.channelInventory;
console.log('  ' + inv.statement);
console.log('  confidence: ' + lastRep.selfModel.confidence.value.toFixed(4) + ' [' + lastRep.selfModel.confidence.status + ']');
console.log('  ' + lastRep.selfModel.confidence.why);

console.log('');
console.log('=== FORWARD MODEL (BLOCK_B14) ===');
var fm = PRED.forwardModelReport(loop.forwardModel);
if (!fm.models.length) console.log('  no models — no action ever declared a variable it moves');
fm.models.forEach(function (m) {
  console.log('  ' + pad(m.key, 46) + ' gain=' + padL(m.gain.toFixed(4), 8) + ' n=' + padL(m.n, 3) +
    ' rmse=' + padL(m.rmse === null ? 'n/a' : m.rmse.toFixed(4), 8) + '  [' + m.status + ']');
});
console.log('  supervised updates: ' + fm.updates);

console.log('');
console.log('=== MODULATOR ORTHOGONALITY (SPEC row 11) ===');
var orth = MOD.orthogonalityCheck(loop.modulators);
console.log('  ' + orth.why);
orth.pairs.filter(function (p) { return p.status === 'MEASURED'; }).forEach(function (p) {
  console.log('    ' + pad(p.pair, 24) + ' r=' + padL(p.r === null ? 'const' : p.r.toFixed(3), 7) + ' n=' + p.n + (p.verdict ? '  ' + p.verdict : ''));
});

console.log('');
console.log('=== CALIBRATION ===');
var cal = PRED.calibration(loop.registry);
console.log('  ' + JSON.stringify(cal));

console.log('');
console.log('=== CONNECTOME ===');
var cxm = CX.snapshotMetrics(loop.connectome);
console.log('  in/out ' + cxm.metrics.in + '/' + cxm.metrics.out + '  amplification ' +
  (cxm.amplification.ratio === null ? 'n/a' : cxm.amplification.ratio.toFixed(3)) +
  (cxm.amplification.alarm ? '  ALARM' : '') + '  queue ' + cxm.queueDepth);
console.log('  dropped ' + cxm.metrics.dropped + '  deduped ' + cxm.metrics.deduped + '  expired ' +
  cxm.metrics.expired + '  hopExceeded ' + cxm.metrics.hopExceeded + '  backpressure ' + cxm.metrics.backpressure);
console.log('  INV-7 reciprocity: ascending ' + cxm.reciprocity.ascending + ', descending ' +
  cxm.reciprocity.descending + ', lateral ' + cxm.reciprocity.lateral + ' -> ' +
  (cxm.reciprocity.satisfiesINV7 ? 'SATISFIED' : 'OPEN LOOPS: ' + cxm.reciprocity.openLoops.join(', ')));

console.log('');
console.log('=== MOTOR (BLOCK_B11) ===');
var mr = ACT.report(loop.motor, rows[rows.length - 1].t);
console.log('  executed ' + mr.executed + '  failed ' + mr.failed + '  backlog ' + mr.backlog + '  ceiling: ' + mr.throughputCeiling);
mr.effectors.forEach(function (e) {
  console.log('    ' + pad(e.id, 6) + ' fired=' + padL(e.fired, 4) + ' gain=' + e.gain.toFixed(3) +
    ' consecutive=' + e.consecutive + ' lastKind=' + (e.lastKind || '-'));
});
console.log('  listener audit: ' + JSON.stringify(ACT.listenerAudit(loop.motor, Object.keys(stats.byKind))));

console.log('');
console.log('=== MEMORY ===');
console.log('  ' + JSON.stringify(lastRep.memory));

console.log('');
console.log('=== HOMEOSTASIS / SELF-MODEL ===');
console.log('  degraded: ' + lastRep.selfModel.degraded + (lastRep.selfModel.degradedReason ? ' (' + lastRep.selfModel.degradedReason + ')' : ''));
console.log('  timescale separation: ' + lastRep.selfModel.timescaleSeparation.why);
lastRep.selfModel.homeostasis.drives.filter(function (d) { return d.status === 'MEASURED'; }).forEach(function (d) {
  console.log('    ' + pad(d.variable, 20) + padL(typeof d.value === 'number' ? d.value.toFixed(3) : d.value, 9) +
    '  target ' + d.target + ' +/-' + d.band + (d.inBand ? '  in band' : '  DRIVE ' + d.drive.toFixed(3)) + (d.breached ? '  BREACH' : ''));
});
console.log('  blind spots: ' + lastRep.selfModel.blindSpots.length);
lastRep.selfModel.blindSpots.slice(0, 6).forEach(function (b) { console.log('    ' + pad(b.channel, 14) + b.why); });

console.log('');
console.log('=== PERSISTENCE ===');
console.log('  ' + JSON.stringify(ST.stats(loop.store)));

if (firstFullTrace) {
  console.log('');
  console.log('=== ONE COMPLETE AUDIT TRACE: ' + firstFullTrace.traceId + ' ===');
  firstFullTrace.steps.forEach(function (s) {
    var body = Object.keys(s).filter(function (k) { return k !== 'step'; })
      .map(function (k) { return k + '=' + short(s[k]); }).join('  ');
    console.log('  ' + pad(s.step, 15) + body.slice(0, 150));
  });
}

function short(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') { var s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 57) + '...' : s; }
  var t = String(v);
  return t.length > 60 ? t.slice(0, 57) + '...' : t;
}
