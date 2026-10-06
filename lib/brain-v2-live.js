/**
 * lib/brain-v2-live.js — drive the brain-v2 closed loop against LIVE recorder rows.
 *
 * WHY THIS EXISTS
 * brain-v2/run.js replays a cached fixture offline. This module is the production
 * driver: it advances the same kernel one recorder batch at a time, reading live
 * rows from the same Redis history /api/feed-record serves, and persists the
 * serialized loop so the next invocation resumes where this one stopped.
 *
 * OBSERVATIONAL, NOT AUTHORITATIVE. Nothing here writes domain stress, portal
 * scores, or any user-visible number. Predictions registered by this loop are
 * scored against later rows and calibrated — they are a measurement instrument.
 * The only authority the production scores accept remains the validated path
 * (bk-scorer / VALIDATION_LOCK.json). See BRAIN_V2_LIVE_WIRE.md.
 *
 * WATERMARK, NOT lastTickAt
 * The kernel assumes non-decreasing `now`. Rows arriving during the offline
 * window (02:00–04:00 UTC) are consolidated over, not ticked, so loop.lastTickAt
 * does NOT advance past them. Re-presenting them later would tick backwards in
 * time. So progress is a separate `watermark` (max row.t presented to the loop),
 * stored in the SAME db value as the state — one write, no crash window where
 * the watermark claims rows the state never saw.
 *
 * NO FILESYSTEM. spec.storeDir is deliberately never set: kernel/store.js is
 * required by loop.js but ST.open() is only called when storeDir is present.
 * Do not add storeDir here — /tmp is not persistent on Vercel and the write
 * would silently vanish between invocations.
 *
 * ENERGY ONLY, for now. Energy is the only binder backed by a measured fixture
 * (bind/registry.js: BOUND vs MANIFEST_ONLY). Other domains must not be wired
 * until their binders are bound to observed channels.
 */

'use strict';

var LOOP = require('../brain-v2/kernel/loop.js');
var VIT = require('../brain-v2/kernel/vitals.js');

var HOUR = 3600000;

function stateKey(domain) { return 'brain_v2:' + domain; }

/**
 * specFor — the same loop specification run.js uses, minus storeDir.
 */
function specFor(binder, domain) {
  return {
    domain: domain,
    brainSpec: binder.spec(),
    horizonMs: 6 * HOUR,          // predictions resolve six recorded hours later
    vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR }
  };
}

/**
 * open — restore the loop for `domain` from `db`, or create a fresh one.
 * Returns { loop, record } where record is the stored {state, watermark} or null.
 */
async function open(db, binder, domain) {
  var spec = specFor(binder, domain);
  var record = await db.get(stateKey(domain));
  if (record && record.state) {
    return { loop: LOOP.restore(spec, record.state), record: record, fresh: false };
  }
  return { loop: LOOP.create(spec), record: null, fresh: true };
}

/**
 * advance — present `rows` (recorder rows, any order) to the loop, oldest first,
 * skipping everything at or below the watermark. Arousal window and consolidation
 * mirror run.js exactly: 02:00–04:00 UTC is offline; consolidation runs there and
 * nothing is encoded. Persists {state, watermark} in one db write.
 *
 * Returns a summary. Throws on kernel errors — the caller decides how to report.
 */
async function advance(db, binder, domain, rows, opts) {
  opts = opts || {};
  var maxTicks = opts.maxTicks || 48;   // bound one invocation; cron catches up next run
  var opened = await open(db, binder, domain);
  var loop = opened.loop;
  var watermark = (opened.record && typeof opened.record.watermark === 'number')
    ? opened.record.watermark : null;

  var valid = (rows || []).slice().filter(function (r) { return r && typeof r.t === 'number'; });
  var unseen = valid.filter(function (r) { return watermark === null || r.t > watermark; });
  var batch = unseen.slice(0, maxTicks);

  var stats = {
    domain: domain,
    fresh: opened.fresh,
    resumedFromTick: loop.ticks || 0,
    presented: valid.length,
    skippedOld: valid.length - unseen.length,
    newRows: batch.length,
    deferredOverCap: unseen.length - batch.length,
    ticks: 0, consolidations: 0,
    predictionsRegistered: 0, predictionsResolved: 0, predictionHits: 0,
    predictionsUnresolvable: 0,
    errors: []
  };

  for (var i = 0; i < batch.length; i++) {
    var row = batch[i];
    var now = row.t;

    // Arousal cycle — identical to run.js: 20h awake, 02:00–04:00 UTC offline.
    var hourOfDay = new Date(now).getUTCHours();
    var wantOffline = (hourOfDay >= 2 && hourOfDay < 4);
    if (wantOffline && loop.vitals.arousal !== VIT.AROUSAL.OFFLINE) {
      VIT.setArousal(loop.vitals, VIT.AROUSAL.OFFLINE, now, 'scheduled offline window');
      var c = LOOP.consolidate(loop, now);
      if (c.ran) stats.consolidations++;
    } else if (!wantOffline && loop.vitals.arousal !== VIT.AROUSAL.WAKE) {
      VIT.setArousal(loop.vitals, VIT.AROUSAL.WAKE, now, 'offline window ended');
    }
    if (loop.vitals.arousal === VIT.AROUSAL.OFFLINE) {
      watermark = Math.max(watermark || 0, now);   // progress without encoding
      continue;
    }

    var readings = binder.readRecorderRow(row);
    var keyed = {};
    Object.keys(readings).forEach(function (k) {
      keyed[k] = { value: readings[k].value, eventTime: now };
    });

    var rep = LOOP.tick(loop, keyed, now);
    stats.ticks++;

    var pr = (rep.steps || []).filter(function (s) { return s.step === 'predict'; })[0] || {};
    if (pr.predictionId) stats.predictionsRegistered++;

    var rs = (rep.steps || []).filter(function (s) { return s.step === 'resolve'; })[0] || {};
    (rs.detail || []).forEach(function (r) {
      if (r.observable === false || r.status === 'expired') { stats.predictionsUnresolvable++; return; }
      if (r.observable) {
        stats.predictionsResolved++;
        if (r.hit) stats.predictionHits++;
      }
    });

    watermark = Math.max(watermark || 0, now);
  }

  // One write: state and watermark move together or not at all.
  await db.set(stateKey(domain), {
    version: 1,
    savedAt: Date.now(),
    watermark: watermark,
    state: LOOP.serialize(loop)
  });

  stats.watermark = watermark;
  stats.ticksTotal = loop.ticks || 0;
  return stats;
}

/**
 * readState — the stored {state, watermark} for `domain`, or null.
 */
async function readState(db, domain) {
  return db.get(stateKey(domain));
}

module.exports = { stateKey: stateKey, specFor: specFor, open: open, advance: advance, readState: readState };
