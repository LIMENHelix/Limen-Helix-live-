/**
 * lib/brain-shadow-runtime.js — ONE server-side brain runtime, run once per domain.
 *
 * ONE RUNTIME, NOT TWENTY BRAINS. Every domain is executed by the function below, and the
 * only thing that differs between domains is the DESCRIPTOR handed to it: which binder to
 * load, which recorder list to read, which shadow key to persist under. There is no
 * per-domain branch anywhere in this file, and adding one would be the beginning of the
 * failure it exists to avoid — `assets/js/domain-brains/` already went the other way and
 * carries 34 energy-specific overrides. Domain-specific behaviour belongs in the binder
 * (channels, findings, relationships, cadence, efferent) where it is declared data.
 *
 * SHADOW MEANS FOUR THINGS, and each is enforced by construction rather than by intent:
 *
 *   1. PERSISTENCE IS CONFINED. Every write goes through lib/brain-shadow-store, which
 *      throws on any key outside `brain:v2:shadow:<domain>:`. This module never calls the
 *      database directly, so it cannot address production state even by mistake.
 *   2. THERE IS NO OUTWARD ACTUATION — which is NOT the same as no actuation, and the
 *      difference was found by running the test rather than by reading the code. An
 *      earlier draft of this comment claimed the runtime registers nothing. It was wrong:
 *      `LOOP.create` wires FIVE effectors through `wireMotor`, and a 24-row cycle executes
 *      around 23 actions.
 *
 *      All five are confined to the loop's own memory: RAISE_ATTENTION and LOWER_ATTENTION
 *      move a channel's Kalman `rGain`, COLLECT_EVIDENCE defers a cycle, NO_ACTION does
 *      nothing by design, and ESCALATE writes a record and stops for a human.
 *      `kernel/actuate.js` has no transport of its own — it dispatches only to handlers
 *      registered with `register(motor, kind, handler)` — so there is no path from an
 *      executed action to the network. The test proves it by running a full cycle with
 *      `fetch` rigged to throw. Both canaries additionally declare `efferent: null`.
 *   3. NOTHING READS THE RESULTS. The shadow namespace is new and no existing consumer
 *      references it; `test/shadow-runtime.js` proves that by scanning the repository
 *      rather than asserting it in prose.
 *   4. PRODUCTION STATE IS NOT READ EITHER. The only production key touched is the
 *      recorder's `feedhist:<domain>` list, and only through a read-only accessor.
 *
 * INPUT IS RECORDED HISTORY, NOT A LIVE FETCH. The runtime ticks over rows the recorder
 * already stored, newest-cursor style: it replays every row after `lastRowT` and stops.
 * That makes a cycle deterministic and idempotent — running it twice does nothing the
 * second time — and it means the runtime cannot invent an observation, because it can only
 * see what the recorder durably wrote, including the `su` provenance key on the channels
 * that carry one.
 */

'use strict';

var path = require('path');
var LOOP = require('../brain-v2/kernel/loop.js');
var REG = require('../brain-v2/bind/registry.js');
var STORE = require('./brain-shadow-store');

var RUNTIME_VERSION = 'brain-v2-shadow/0.1.0';
var HOUR = 3600000;
/* Cap on rows replayed in one cycle. A cold start with 470 rows of backlog must not run
   until the function times out; it catches up over successive cycles instead, and the
   cursor makes that safe. */
var MAX_ROWS_PER_CYCLE = 120;
var DEFAULT_HORIZON_MS = 6 * HOUR;

/** The canary set. Deliberately two, and deliberately named here rather than "all 20": a
 *  first production run of a new runtime is a canary, not a rollout. */
var CANARY_DOMAINS = ['energy', 'finance'];

function loadBinder(descriptor) {
  return require(path.join(__dirname, '..', 'brain-v2', 'bind', descriptor.binder + '.js'));
}

/**
 * Run one domain's shadow cycle. Returns a report; never throws for domain-level problems,
 * because one domain's bad data must not stop the other nineteen — the error is reported
 * IN the report and persisted, which is the only way a silent per-domain failure becomes
 * visible.
 */
async function runDomain(product, opts) {
  opts = opts || {};
  var startedAt = typeof opts.now === 'number' ? opts.now : Date.now();
  var report = {
    runtime: RUNTIME_VERSION,
    domain: null, product: String(product),
    startedAt: startedAt, finishedAt: null,
    ok: false, error: null,
    rowsAvailable: 0, rowsApplied: 0, ticks: 0,
    cursorBefore: null, cursorAfter: null,
    restored: false,
    provenance: { sourcesSeen: 0, withObservationId: 0, channelsRead: 0 },
    abstentions: [], predictions: { open: 0, resolved: 0 },
    actuation: { effectorsRegistered: 0, executed: 0 }
  };

  try {
    var d = REG.descriptorFor(product);
    if (!d) throw new Error('not one of the twenty canonical domains');
    report.domain = d.snapshot;

    var binder = loadBinder(d);
    var prior = await STORE.readState(d.snapshot);
    report.cursorBefore = (prior && typeof prior.lastRowT === 'number') ? prior.lastRowT : null;

    var spec = {
      domain: d.snapshot,
      /* NO storeDir. kernel/store.js is a filesystem log and this runs on a serverless
         filesystem that does not survive the invocation. State goes to the shadow
         namespace through serialize/restore instead, which is also what makes the
         restart-restoration test meaningful rather than a test of the local disk. */
      brainSpec: binder.spec(),
      horizonMs: typeof opts.horizonMs === 'number' ? opts.horizonMs : DEFAULT_HORIZON_MS,
      vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR }
    };

    var loop = (prior && prior.loop) ? LOOP.restore(spec, prior.loop) : LOOP.create(spec);
    report.restored = !!(prior && prior.loop);

    /* NO EFFECTOR IS REGISTERED. Asserted into the report so a future change that adds one
       shows up as a number in persisted output, not only in a diff. */
    report.actuation.effectorsRegistered = countEffectors(loop);

    var rows = opts.rows || await STORE.readRecorderRows(d.snapshot, 500);
    rows = rows.slice().sort(function (a, b) { return a.t - b.t; });
    report.rowsAvailable = rows.length;

    var cursor = report.cursorBefore;
    var fresh = rows.filter(function (r) { return cursor === null || r.t > cursor; });
    if (fresh.length > MAX_ROWS_PER_CYCLE) fresh = fresh.slice(0, MAX_ROWS_PER_CYCLE);

    fresh.forEach(function (row) {
      var readings = binder.readRecorderRow(row) || {};
      var keys = Object.keys(readings);
      report.provenance.channelsRead += keys.length;
      keys.forEach(function (k) {
        report.provenance.sourcesSeen++;
        if (readings[k] && readings[k].observationId) report.provenance.withObservationId++;
      });
      if (!keys.length) {
        report.abstentions.push({ t: row.t, why: 'binder read no channel from this row' });
        cursor = row.t;
        return;
      }
      LOOP.tick(loop, readings, row.t);
      report.ticks++;
      cursor = row.t;
    });

    report.rowsApplied = fresh.length;
    report.cursorAfter = cursor;
    report.predictions.open = openPredictionCount(loop);
    report.predictions.resolved = resolvedPredictionCount(loop);
    report.actuation.executed = executedCount(loop);

    await STORE.writeState(d.snapshot, {
      runtime: RUNTIME_VERSION,
      domain: d.snapshot,
      lastRowT: cursor,
      savedAt: startedAt,
      loop: LOOP.serialize(loop)
    });
    report.ok = true;
  } catch (e) {
    report.ok = false;
    report.error = (e && e.message) ? e.message : String(e);
  }

  report.finishedAt = typeof opts.now === 'number' ? opts.now : Date.now();
  /* The report is persisted whether or not the cycle succeeded. A failed cycle that leaves
     no trace is indistinguishable from a cycle that never ran. */
  if (report.domain) {
    try { await STORE.writeCycle(report.domain, report); } catch (e) { /* store failure is reported by the caller */ }
  }
  return report;
}

/** Per-domain isolation: one thrown domain cannot take the others with it. */
async function runDomains(products, opts) {
  var list = Array.isArray(products) && products.length ? products : CANARY_DOMAINS;
  var reports = [];
  for (var i = 0; i < list.length; i++) {
    try {
      reports.push(await runDomain(list[i], opts));
    } catch (e) {
      reports.push({
        runtime: RUNTIME_VERSION, product: String(list[i]), domain: null,
        ok: false, error: 'runtime threw outside the domain guard: ' + ((e && e.message) || String(e))
      });
    }
  }
  return {
    runtime: RUNTIME_VERSION,
    ranAt: (typeof opts === 'object' && opts && typeof opts.now === 'number') ? opts.now : Date.now(),
    domains: list,
    ok: reports.every(function (r) { return r.ok; }),
    reports: reports
  };
}

/* ── introspection helpers, tolerant of kernel shape changes ─────────────────
   Each returns 0 rather than throwing if the kernel reorganises: a health number
   that crashes the cycle it is describing is worse than one that reads zero. */
function countEffectors(loop) {
  try {
    var m = loop && loop.motor;
    if (!m) return 0;
    var h = m.handlers || m.effectors || m.subscribers;
    return h ? Object.keys(h).length : 0;
  } catch (e) { return 0; }
}
function executedCount(loop) {
  try { return (loop && loop.motor && loop.motor.executed || []).length; } catch (e) { return 0; }
}
function openPredictionCount(loop) {
  try { return (loop && loop.registry && loop.registry.order || []).length; } catch (e) { return 0; }
}
function resolvedPredictionCount(loop) {
  try { return (loop && loop.registry && loop.registry.resolved || []).length; } catch (e) { return 0; }
}

module.exports = {
  RUNTIME_VERSION: RUNTIME_VERSION,
  CANARY_DOMAINS: CANARY_DOMAINS,
  MAX_ROWS_PER_CYCLE: MAX_ROWS_PER_CYCLE,
  runDomain: runDomain,
  runDomains: runDomains,
  _countEffectors: countEffectors
};
