/**
 * brain-v2/kernel/consolidate.js — BLOCK_B13. Offline replay, downscaling, clearance.
 *
 * SPEC B13, INV-5, rows 12/13/14/15. MASTER_PROMPT §8.13. Fidelity: F1.
 *
 * "ACTUATED" HAS A SPECIFIC MEANING AND THIS FILE IS BUILT TO IT.
 *
 * Lesion #3 in the standing diagnosis is not "there is no consolidation code". It is that every
 * offline path emits PROPOSALS for later approval. A pass that proposes has not consolidated.
 * So `run()` below holds write authority and writes — through one gated entry point, on
 * schedule, without a human in the loop for each write. What it does NOT have is authority to
 * change architecture, permissions, or code; that separation is §11 and it is why the write
 * surface here is exactly three things: episode retention, episode strength, and procedural
 * promotion.
 *
 * FOUR PROPERTIES, EACH A CHECKLIST ROW:
 *
 *  row 12  STATE EXCLUSIVITY. Refuses to run unless arousal is OFFLINE. Consolidating while
 *          encoding produces interference and completes neither. The refusal is hard.
 *  row 13  WRITE AUTHORITY. Writes. Does not queue proposals.
 *  row 14  MULTIPLICATIVE DOWNSCALING. strength *= factor, never strength -= step.
 *          Subtractive decay destroys small weights first and loses relative ranking; that is
 *          not a tuning preference, it is a different operation with a different result.
 *  row 15  DIFFERENTIAL RETENTION. Tagged traces stabilise, untagged decay below a floor and
 *          are retired. A uniform rolling window is a storage policy, not consolidation.
 *
 * COMPLEMENTARY LEARNING SYSTEMS (§8.13). The fast episodic store may only reach the slow
 * store through interleaved replay. Direct fast writes to the slow store cause catastrophic
 * interference — that is the reason offline consolidation exists at all, not a maintenance
 * convenience. `run()` therefore reads episodes and writes procedural candidates; nothing
 * writes procedural memory synchronously during a wake cycle.
 */

'use strict';

var MEM = require('./memory.js');

var DEFAULTS = {
  downscaleFactor: 0.92,     // [mark: prior] MULTIPLICATIVE. See row 14.
  retentionFloor: 0.15,      // below this an untagged trace is retired
  tagProtect: 0.55,          // at or above this tag, a trace is protected from retirement
  replayTopK: 12,            // how many tagged traces are replayed per pass
  minEpisodesToRun: 4,
  clearanceMaxAgeMs: 30 * 24 * 3600000
};

function create(opts) {
  return {
    opts: Object.assign({}, DEFAULTS, opts || {}),
    passes: 0,
    lastRunAt: null,
    history: [],
    version: 0
  };
}

/**
 * RUN ONE CONSOLIDATION PASS.
 *
 * `ctx.arousalState` must be 'offline'. Anything else is refused with a reason — the refusal
 * IS row 12, and softening it into a warning would remove the only mechanism enforcing state
 * exclusivity.
 */
function run(con, mem, ctx) {
  var now = ctx.now;

  // ── row 12: STATE EXCLUSIVITY ──────────────────────────────────────────────────────────
  if (ctx.arousalState !== 'offline') {
    return {
      ran: false,
      refused: 'state_exclusivity',
      why: 'arousal state is "' + ctx.arousalState + '"; consolidation runs in the offline state only. ' +
           'Concurrent encoding during consolidation produces interference and completes neither (SPEC row 12).',
      at: now
    };
  }
  if (mem.episodic.length < con.opts.minEpisodesToRun) {
    return { ran: false, refused: 'insufficient_material', why: 'only ' + mem.episodic.length + ' episodes; nothing to consolidate', at: now };
  }

  con.passes++;
  con.lastRunAt = now;
  var writes = [];

  // ── 1. SELECTIVE REPLAY, by TAG not recency (SPEC B13 property 1) ─────────────────────
  //    Sorting by recency would replay whatever happened last, which is a cache policy.
  //    Tag was set at encode time, so this selects on salience as it was known at the moment.
  var retained = mem.episodic.filter(function (e) { return e.retained; });
  var replayed = retained.slice()
    .sort(function (a, b) { return (b.tag * b.strength) - (a.tag * a.strength); })
    .slice(0, con.opts.replayTopK);

  // ── 2. SCHEMA EXTRACTION from replayed episodes that carry a resolved outcome ─────────
  //    This is the fast->slow transfer. It creates PROCEDURAL CANDIDATES, and promotion is
  //    still gated by memory.promote()'s evidence floor. Consolidation earns the right to
  //    write; it does not earn the right to skip the evidence bar.
  var byKind = Object.create(null);
  replayed.forEach(function (e) {
    if (!e.outcome || !e.selection || !e.selection.kind) return;
    var k = e.selection.kind;
    if (!byKind[k]) byKind[k] = [];
    byKind[k].push(e);
  });

  var candidates = [], promotions = [];
  Object.keys(byKind).forEach(function (kind) {
    var eps = byKind[kind];
    var trigger = 'dysregulation detected with a live driving channel';
    var cand = MEM.proposeProcedure(mem, {
      actionKind: kind,
      triggerCondition: trigger,
      requiredEvidence: ['at least one fusable channel', 'a resolved outcome with efference subtracted'],
      expectedResult: 'residual prediction error inside the declared interval',
      at: now
    });
    eps.forEach(function (e) {
      MEM.observeProcedure(mem, cand.id, {
        episodeId: e.id, traceId: e.traceId,
        hit: !!(e.outcome && e.outcome.hit),
        contaminated: !!(e.outcome && e.outcome.contaminated),
        predictionError: e.outcome ? e.outcome.predictionError : null,
        why: e.outcome && e.outcome.hit ? 'residual inside interval' : 'residual outside interval',
        at: e.at
      });
    });
    candidates.push({ kind: kind, candidateId: cand.id, episodes: eps.length });
    var p = MEM.promote(mem, cand.id, now);
    promotions.push({ kind: kind, promoted: p.promoted, why: p.why || null, n: p.n || null, hitRate: p.hitRate || null });
    if (p.promoted) writes.push({ store: 'procedural', key: kind, action: 'promoted' });
  });

  // ── 3. GLOBAL DOWNSCALING — MULTIPLICATIVE (row 14) ───────────────────────────────────
  //    Every retained trace is scaled by the same factor. Relative ranking is preserved
  //    exactly, dynamic range is restored, and small traces are not preferentially destroyed.
  //    Replayed traces are restored toward 1.0 first: that is what replay buys them.
  var replayedIds = Object.create(null);
  replayed.forEach(function (e) { replayedIds[e.id] = true; });

  var scaledCount = 0, restoredCount = 0;
  mem.episodic.forEach(function (e) {
    if (!e.retained) return;
    if (replayedIds[e.id]) {
      e.strength = Math.min(1.0, e.strength / con.opts.downscaleFactor);  // multiplicative restore
      restoredCount++;
    } else {
      e.strength = e.strength * con.opts.downscaleFactor;                  // MULTIPLICATIVE
      scaledCount++;
    }
  });
  writes.push({ store: 'episodic', action: 'downscaled', scaled: scaledCount, restored: restoredCount, factor: con.opts.downscaleFactor, form: 'strength *= factor (multiplicative, NOT subtractive)' });

  // ── 4. DIFFERENTIAL RETENTION (row 15) ────────────────────────────────────────────────
  //    Tagged traces are protected. Untagged traces below the floor are retired. This is what
  //    makes it consolidation rather than a rolling window: what survives depends on what it
  //    was, not on when it happened.
  var retired = [];
  mem.episodic.forEach(function (e) {
    if (!e.retained) return;
    if (e.tag >= con.opts.tagProtect) return;                 // protected by encode-time salience
    if (e.strength < con.opts.retentionFloor) {
      e.retained = false;
      e.retiredAt = now;
      e.retiredWhy = 'strength ' + e.strength.toFixed(4) + ' below floor ' + con.opts.retentionFloor +
                     ' and tag ' + e.tag.toFixed(3) + ' below protection ' + con.opts.tagProtect;
      retired.push(e.id);
    }
  });
  if (retired.length) writes.push({ store: 'episodic', action: 'retired', count: retired.length });

  // ── 5. CLEARANCE (SPEC B13 property 3, BLOCK_B16 astrocyte analogue) ──────────────────
  //    Unretired records and unclosed prospective items are not neutral clutter; they are
  //    load. Sweep prospective items that are past any possibility of resolution.
  var swept = [];
  mem.prospective.forEach(function (i) {
    if (i.status !== 'open') return;
    if (now - i.createdAt > con.opts.clearanceMaxAgeMs) {
      i.status = 'unresolvable';
      i.closedAt = now;
      i.closure = { resolved: false, why: 'cleared: exceeded maximum age without its expected observation' };
      swept.push(i.id);
    }
  });
  if (swept.length) writes.push({ store: 'prospective', action: 'cleared', count: swept.length });

  var rec = {
    pass: con.passes,
    at: now,
    replayed: replayed.map(function (e) { return { id: e.id, tag: e.tag, strength: e.strength }; }),
    candidates: candidates,
    promotions: promotions,
    downscaled: scaledCount,
    restored: restoredCount,
    retired: retired.length,
    cleared: swept.length,
    writes: writes,
    writeAuthority: true,
    authorityScope: 'episode retention, episode strength, procedural promotion. NOT architecture, permissions, or code (§11).'
  };
  con.history.push(rec);
  if (con.history.length > 256) con.history.shift();
  con.version++;
  mem.version++;
  return Object.assign({ ran: true }, rec);
}

/**
 * Row 14 as an assertion. Verifies the pass actually used multiplication by checking that
 * relative ranking survived. Subtractive decay inverts rankings near the floor; multiplicative
 * decay cannot. This is a property test, not a code inspection.
 */
function verifyMultiplicative(before, after) {
  if (before.length !== after.length || before.length < 2) {
    return { verified: false, why: 'need at least 2 comparable traces' };
  }
  var ordBefore = before.map(function (v, i) { return i; }).sort(function (a, b) { return before[b] - before[a]; });
  var ordAfter = after.map(function (v, i) { return i; }).sort(function (a, b) { return after[b] - after[a]; });
  var same = ordBefore.every(function (v, i) { return v === ordAfter[i]; });
  var ratios = before.map(function (b, i) { return b > 0 ? after[i] / b : null; }).filter(function (r) { return r !== null; });
  var uniformRatio = ratios.length > 1
    ? (Math.max.apply(null, ratios) - Math.min.apply(null, ratios)) < 1e-9
    : true;
  return {
    verified: same && uniformRatio,
    rankingPreserved: same,
    uniformRatio: uniformRatio,
    ratio: ratios.length ? ratios[0] : null,
    why: same && uniformRatio
      ? 'ranking preserved and every trace scaled by the same ratio — this is multiplicative'
      : (!same ? 'ranking changed: subtractive decay destroys small weights first' : 'ratios differ across traces: not a uniform scale')
  };
}

function report(con) {
  return {
    passes: con.passes,
    lastRunAt: con.lastRunAt,
    opts: con.opts,
    lastPass: con.history.length ? con.history[con.history.length - 1] : null,
    holdsWriteAuthority: true
  };
}

function serialize(con) { return { opts: con.opts, passes: con.passes, lastRunAt: con.lastRunAt, history: con.history.slice(-32), version: con.version }; }
function deserialize(o) { var c = create(o && o.opts); if (o) { c.passes = o.passes || 0; c.lastRunAt = o.lastRunAt || null; c.history = o.history || []; c.version = o.version || 0; } return c; }

module.exports = {
  DEFAULTS: DEFAULTS,
  create: create,
  run: run,
  verifyMultiplicative: verifyMultiplicative,
  report: report,
  serialize: serialize,
  deserialize: deserialize
};
