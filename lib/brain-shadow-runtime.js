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
 *   3. NO PRE-EXISTING CONSUMER READS THE RESULTS. Stated precisely, because the earlier
 *      wording ("nothing reads the results") became false the moment this PR added
 *      `/api/brain-shadow`: that endpoint IS a reader. It is a NEW, token-gated OPERATOR
 *      read, and it is the only one. What is guaranteed is that no pre-existing site
 *      surface, UI page, decision path or scoring consumer reads shadow state, which
 *      `test/shadow-runtime.js` proves by scanning the repository.
 *   4. PRODUCTION STATE IS NOT READ EITHER. The only production key touched is the
 *      recorder's `feedhist:<domain>` list, and only through a read-only accessor.
 *
 * INPUT IS RECORDED HISTORY, NOT A LIVE FETCH. The runtime ticks over rows the recorder
 * already stored, newest-cursor style: it replays every row after `lastRowT` and stops. It
 * cannot invent an observation, because it can only see what the recorder durably wrote,
 * including the `su` provenance key on the channels that carry one.
 *
 * IDEMPOTENT FOR SEQUENTIAL DUPLICATES ONLY. A second call AFTER the first has finished
 * finds no rows past the stored cursor and applies nothing. Two cycles running CONCURRENTLY
 * would both read the same cursor and both apply the same rows, because there is no lock:
 * read-modify-write on the state key is not atomic here. That is acceptable at the current
 * cadence — one cron, hourly, two domains — and it is written down rather than implied,
 * because "idempotent" unqualified would be read as concurrency-safe. A lock is the fix
 * when a second trigger becomes possible, not a claim to make in its absence.
 */

'use strict';

var path = require('path');
var LOOP = require('../brain-v2/kernel/loop.js');
var REG = require('../brain-v2/bind/registry.js');
var STORE = require('./brain-shadow-store');
/* The persisted state SHAPE and the runtime version live in one module, so the audit
   scripts measure the envelope this actually writes rather than a hand-kept copy of it. */
var STATE = require('./brain-shadow-state');
var ARCHIVE = require('./brain-shadow-archive');
var COMPACT = require('../brain-v2/kernel/compact.js');
var EVIDENCE = require('../brain-v2/core/relationship-evidence.js');
var DOMAIN_FUNCTION = require('../brain-v2/core/domain-function.js');
var CALENDARS = require('../brain-v2/bind/calendars.js').CALENDARS;

var RUNTIME_VERSION = STATE.RUNTIME_VERSION;
var HOUR = 3600000;
/* Cap on rows replayed in one cycle. A cold start with 470 rows of backlog must not run
   until the function times out; it catches up over successive cycles instead, and the
   cursor makes that safe. */
var MAX_ROWS_PER_CYCLE = 120;
var DEFAULT_HORIZON_MS = 6 * HOUR;

/**
 * THE INSTALLED SET IS NOT DECLARED HERE. It is `registry.INSTALLED_DOMAINS`, and this
 * module reads it rather than keeping a copy.
 *
 * It used to be a literal in this file, which meant the runtime owned operational
 * membership while the registry owned domain identity. Two lists, two authors, and the
 * failure they produce is quiet: add a domain to the runtime, forget the health handler,
 * and the cron executes a domain that the operator read reports as absent. Membership is
 * registry data for the same reason the alias map is.
 */
var INSTALLED_DOMAINS = REG.INSTALLED_DOMAINS;

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
    /**
     * COLD-START PREFIX SKIP, reported so it is observable rather than inferred from a row
     * count. Null means the policy did not run at all, which is the case for every restored
     * cycle and for every domain that has not opted in. `applied:false` with a `why` means it
     * ran and declined, and those two states must stay distinguishable: a domain silently
     * NOT skipping is the exact bug the policy exists to fix.
     */
    coldStartSkip: null,
    /**
     * LEGACY PROSPECTIVE REPAIR, from LOOP.restore. Non-null only on a restored cycle, and
     * reported because it MUTATES restored state: it closes prospective checks stranded by the
     * colliding-id defect whose predictions are already terminal. A repair that changes stored
     * learning state and reports nothing is indistinguishable from data loss when someone later
     * asks why an open count dropped.
     *
     * Expect a one-off spike on the first cycle after deploy per domain, then zeroes.
     */
    prospectiveRepair: null,
    /**
     * COMPARABILITY OF THIS DOMAIN'S DECLARED RELATIONSHIPS, over the recorded WINDOW.
     *
     * An OBSERVATION, not a decision. Nothing reads it, no pathway turns on it, no state is
     * written from it and no threshold is affected. It answers "could this pair be tested at
     * all, and on how many sessions", which until now could only be answered by running a
     * script by hand against a downloaded fixture.
     *
     * MEASURED OVER THE WINDOW AND NOT THE CYCLE, deliberately. In steady state a cycle
     * applies one row, so a cycle-scoped answer would be asking whether six sessions can be
     * found in one hour. Comparability is a property of the history available, so it is
     * measured across the rows already read. Nothing is ticked and the cursor does not move.
     *
     * Null for a domain declaring no relationships, which is eighteen of the twenty.
     */
    relationshipEvidence: null,
    /**
     * WHAT THIS DOMAIN ACTUALLY DID, kept apart from installation and pathway counts.
     * Derived from kernel tick reports already produced in this cycle; observational only.
     */
    domainFunction: DOMAIN_FUNCTION.empty(),
    // Latest bounded brain-v2 state for the operator surface; null until a tick completes.
    operatorRead: null,
    provenance: { sourcesSeen: 0, withObservationId: 0, channelsRead: 0 },
    abstentions: [], predictions: { open: 0, resolved: 0 },
    actuation: { effectorsRegistered: 0, executed: 0 },
    /**
     * UTF-8 byte length of the serialized state VALUE accepted by SET. Measured by the store
     * on the exact string it passed in, not estimated here from the object. Null until a
     * state write succeeds, so a failed cycle reports null rather than a number describing a
     * payload that never landed.
     *
     * WHAT THIS IS NOT, and the distinction is not pedantry. It is NOT the number of bytes
     * that crossed the network. The REST transport wraps this value in a JSON command array
     * and escapes it again, and a GET carries its own response envelope, so the wire figure
     * is strictly larger by an amount this module does not observe. Do not double it for
     * read-plus-write bandwidth, do not multiply it into a billing estimate, and do not
     * compare it against an HTTP request-size ceiling. Each of those needs transport-layer
     * measurement, which belongs to the bounded-state milestone.
     *
     * WHAT IT IS GOOD FOR: relative growth of hot state, per domain, over cycles. That is
     * the quantity the batch-2 gate turns on, and nothing was measuring it at all.
     */
    stateValueBytes: null,
    /* Compaction, reported per cycle so the gate is observable from the operator read
       rather than inferred. beforeBytes/afterBytes bracket the archive write. */
    compaction: { ran: false, retired: 0, archivedSequence: null, beforeBytes: null, afterBytes: null }
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
    /* Set by LOOP.restore, so it exists only when state was actually restored. */
    if (loop._prospectiveRepair) report.prospectiveRepair = loop._prospectiveRepair;

    /**
     * FIVE INTERNAL EFFECTORS ARE REGISTERED by `wireMotor`, and the count is persisted so
     * a change shows up as a number in stored output rather than only in a diff. The
     * baseline is taken BEFORE any tick so the per-cycle execution count below is this
     * cycle's work and not a total restored from the previous one.
     */
    report.actuation.effectorsRegistered = countEffectors(loop);
    report.actuation.kinds = effectorKinds(loop);
    var executedBefore = executedCount(loop);

    var rows = opts.rows || await STORE.readRecorderRows(d.snapshot, 500);
    rows = rows.slice().sort(function (a, b) { return a.t - b.t; });
    report.rowsAvailable = rows.length;

    var cursor = report.cursorBefore;

    /**
     * COLD-START PREFIX SKIP. Descriptor-driven; this function names no domain.
     *
     * A domain whose oldest recorded rows predate its own channels abstains on every one of
     * them, so at a 120-row cap it can burn three cycles reporting a healthy nothing. When
     * the descriptor opts in, the cold-start cursor is placed immediately before the first
     * row THIS binder reads anything from, so the first cycle ticks and is falsifiable.
     *
     * COLD START ONLY — guarded on `cursor === null`. A restored brain's stored cursor is
     * never touched by this, which is what keeps restoration authoritative.
     *
     * FAILS CLOSED, and this guard matters more than the feature. If the binder reads
     * NOTHING in the whole window, the cursor is left exactly as it was. Advancing it would
     * consume the entire visible history of a domain whose binder is broken and report a
     * clean cycle over zero rows, which is the same class of silent-success defect as a
     * read-back guard that passes because the write went to memory.
     *
     * The cursor lands at `firstReadable.t - 1` rather than at the previous row's `t`, so
     * rows sharing a timestamp with the first readable row cannot be filtered out by the
     * strict `>` below. Those siblings abstain harmlessly; excluding real readings would not
     * be harmless.
     */
    if (cursor === null && d.coldStartSkipsUnreadablePrefix) {
      var firstReadableIdx = -1;
      for (var ci = 0; ci < rows.length; ci++) {
        var probe = binder.readRecorderRow(rows[ci]) || {};
        if (Object.keys(probe).length) { firstReadableIdx = ci; break; }
      }
      if (firstReadableIdx > 0) {
        cursor = rows[firstReadableIdx].t - 1;
        report.coldStartSkip = {
          applied: true, skippedRows: firstReadableIdx,
          cursorSetTo: cursor, firstReadableT: rows[firstReadableIdx].t, why: null
        };
      } else {
        report.coldStartSkip = {
          applied: false, skippedRows: 0, cursorSetTo: null, firstReadableT: null,
          why: firstReadableIdx === 0
            ? 'first row is already readable; nothing to skip'
            : 'binder read no channel from any of the ' + rows.length +
              ' rows in the window, so the cursor was left untouched rather than consuming them'
        };
      }
    }

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
      var tickReport = LOOP.tick(loop, readings, row.t);
      DOMAIN_FUNCTION.observe(report.domainFunction, tickReport);
      if (tickReport && tickReport.operatorRead) report.operatorRead = tickReport.operatorRead;
      report.ticks++;
      cursor = row.t;
    });

    report.rowsApplied = fresh.length;
    report.cursorAfter = cursor;

    /**
     * ISOLATED FROM THE CYCLE. This is a read-only assessment and must never be able to fail a
     * cycle that otherwise succeeded: the domain's sensing, state and cursor are already
     * settled by this point. A throw here is recorded as an evidence-side error and nothing
     * more, which is the same per-domain isolation the batch already requires of domains.
     */
    try {
      var rels = (binder.spec().relationships || []);
      report.relationshipEvidence = rels.length ? EVIDENCE.evaluate(binder, rows, CALENDARS) : null;
    } catch (e) {
      report.relationshipEvidence = [{ error: String((e && e.message) || e) }];
    }
    report.predictions.open = openPredictionCount(loop);
    report.predictions.resolved = resolvedPredictionCount(loop);
    /**
     * THIS CYCLE'S EXECUTIONS. The subtraction from a pre-tick baseline is what makes that
     * true, and it is kept even though it currently subtracts zero, because the reason it
     * subtracts zero is a property of another module that could change.
     *
     * THE MOTOR'S EXECUTION LOG IS NOT PERSISTED. `ACT.serialize` keeps opts, effectors,
     * backlog and version — not `executed` — so a restored loop starts its log empty and
     * there is NO lifetime actuation count available from stored state. That is recorded
     * here rather than papered over with a plausible-looking total: a field named
     * `executedTotal` would have been read as "since this domain began", and it would have
     * meant "since the last cold start", which is a different and much smaller number.
     */
    report.actuation.executed = Math.max(0, executedCount(loop) - executedBefore);
    report.actuation.executedLogPersisted = false;

    var efferent = spec.brainSpec.efferent;
    var outwardConsumers = Array.isArray(efferent)
      ? efferent.length
      : (efferent && typeof efferent === 'object' ? Object.keys(efferent).length : 0);
    report.domainFunction = DOMAIN_FUNCTION.finalize(report.domainFunction, {
      predictions: report.predictions,
      actuation: report.actuation,
      outwardConsumersDeclared: outwardConsumers
    });

    /**
     * COMPACT, ARCHIVE, THEN WRITE. The order is the safety property: records are durable in
     * the archive and read back before hot state stops carrying them. If the archive write
     * or its read-back throws, this cycle fails and hot state is left exactly as it was,
     * which is recoverable. The reverse order would destroy history and report ok.
     */
    var hot = LOOP.serialize(loop);
    report.compaction.beforeBytes =
      Buffer.byteLength(JSON.stringify(STATE.stateEnvelope(d.snapshot, cursor, startedAt, hot)), 'utf8');

    var planned = COMPACT.plan(hot, {});
    if (planned.retiredCount > 0) {
      var head = hot.archiveHead || { sequence: 0, hash: null };
      var nextSeq = (head.sequence || 0) + 1;
      var written = await ARCHIVE.writeChunk(d.snapshot, nextSeq, head.hash || null, planned.retired);
      hot = planned.apply({
        sequence: nextSeq,
        hash: written.hash,
        totals: planned.totals,
        consumedHorizon: planned.consumedHorizon,
        /* Cumulative, so the head states what the archive holds without reading it. */
        retired: {
          episodic: ((head.retired && head.retired.episodic) || 0) + written.counts.episodic,
          prospective: ((head.retired && head.retired.prospective) || 0) + written.counts.prospective,
          predictions: ((head.retired && head.retired.predictions) || 0) + written.counts.predictions,
          consumed: ((head.retired && head.retired.consumed) || 0) + written.counts.consumed,
          attention: ((head.retired && head.retired.attention) || 0) + written.counts.attention
        }
      });
      report.compaction.ran = true;
      report.compaction.retired = planned.retiredCount;
      report.compaction.archivedSequence = nextSeq;
      report.compaction.reusedChunk = written.reused;
    }

    report.stateValueBytes = await STORE.writeState(d.snapshot,
      STATE.stateEnvelope(d.snapshot, cursor, startedAt, hot));
    report.compaction.afterBytes = report.stateValueBytes;
    /* Reported from the COMPACTED state, so the number an operator reads already includes
       retired resolutions. Calibration that got younger after compaction would be the
       defect this carries the counters to prevent. */
    report.calibration = COMPACT.calibrationWithArchive(hot);
    report.ok = true;
  } catch (e) {
    report.ok = false;
    report.error = (e && e.message) ? e.message : String(e);
  }

  report.finishedAt = typeof opts.now === 'number' ? opts.now : Date.now();
  /**
   * The report is persisted whether or not the cycle succeeded, because a failed cycle
   * that leaves no trace is indistinguishable from a cycle that never ran.
   *
   * A FAILURE TO PERSIST IS NOT SWALLOWED. An earlier version caught this and moved on,
   * which meant a cycle could compute correctly, fail to store anything, and still return
   * ok:true — the exact "reports durable success while persisting nothing" failure this
   * runtime is supposed to make impossible. If the report cannot be written, the cycle is
   * not ok and says why.
   */
  if (report.domain) {
    try {
      await STORE.writeCycle(report.domain, report);
    } catch (e) {
      report.ok = false;
      report.error = (report.error ? report.error + '; ' : '') +
        'cycle report could not be persisted: ' + ((e && e.message) || String(e));
    }
  }
  return report;
}

/** Per-domain isolation: one thrown domain cannot take the others with it. */
async function runDomains(products, opts) {
  var list = Array.isArray(products) && products.length ? products : INSTALLED_DOMAINS;
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
function effectorMap(loop) {
  var m = loop && loop.motor;
  if (!m) return null;
  return m.handlers || m.effectors || m.subscribers || null;
}
function countEffectors(loop) {
  try { var h = effectorMap(loop); return h ? Object.keys(h).length : 0; } catch (e) { return 0; }
}
/* The action kinds this runtime is willing to have wired. Persisted per cycle and asserted
   in the test, so an effector added later is visible in stored output rather than only in
   a diff someone has to notice. */
function effectorKinds(loop) {
  try { var h = effectorMap(loop); return h ? Object.keys(h).sort() : []; } catch (e) { return []; }
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
  /* Re-exported, not re-declared: same array object as registry.INSTALLED_DOMAINS. */
  INSTALLED_DOMAINS: INSTALLED_DOMAINS,
  MAX_ROWS_PER_CYCLE: MAX_ROWS_PER_CYCLE,
  runDomain: runDomain,
  runDomains: runDomains,
  _countEffectors: countEffectors
};
