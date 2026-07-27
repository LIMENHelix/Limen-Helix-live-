/**
 * lib/heartbeat.js — the spike log, and the veto that sits across the outward paths.
 *
 * WHY THIS EXISTS
 * Of the 18 scheduled jobs in this repo, exactly one (limen-worker-ingest, via
 * handlers/limen-health.js) could answer "did you actually run?". Everything else
 * fired into the dark. You could read vercel.json and know what was SUPPOSED to
 * happen; nothing recorded what DID. This records it.
 *
 * TWO JOBS, AND THEY ARE DELIBERATELY DIFFERENT ORGANS
 *
 *   1. beat() / wrap()  — afferent. Every run writes {at, ok, ms} to a capped log.
 *      That log is the substrate the /main-brain render layer animates: one beat is one
 *      spike, repeated co-firing thickens an edge, silence starves one to nothing.
 *      The render layer takes NOTHING ELSE as input. No ambient pulse, no idle
 *      animation, no free parameter. If this log is empty the brain draws dark,
 *      because a lively picture with no events behind it would be a fabricated
 *      signal wearing a nice coat, which is the one thing this project does not do.
 *
 *   2. allowed() / guard() — the veto. A SEPARATE structure, downstream of the
 *      thing that generates the action, with authority to cancel it. That
 *      separation is the whole point and it is not decoration: in the brain the
 *      inhibitory stop path is anatomically distinct from the executive that
 *      proposes, because an organ that could only ever agree with itself has no
 *      brake. Here the fleet proposes and the crons act; the valve is neither, and
 *      it can stop both.
 *
 * WHICH JOBS GET A VALVE
 * Only the ones that act on the world without asking: social-cron (posts publicly
 * 8x/day), subscriber-digest (emails subscribers), autopilot and automail (send).
 * Today stopping any of those means editing vercel.json and redeploying. Inward
 * jobs that only compute and store do NOT get a valve; a switch that can silently
 * turn off your own senses is a liability, not a safety feature.
 *
 * FAILS OPEN ON READS, CLOSED ON NOTHING
 * A heartbeat must never be the reason a job dies, so every write swallows its
 * error. The valve deliberately does the same: if Redis is unreachable we cannot
 * prove a valve was shut, and a job silently ceasing to run because the ledger
 * blinked is a worse failure than one extra post. Unreachable means "no valve was
 * set", which is the state the system shipped in.
 */

var db = require('./limen-db');

// Latest state per job. One small object, read constantly by the panel.
var LAST = 'hb:last:';
// The spike stream. Capped: Upstash bills bandwidth and this is polled.
var SPIKES = 'hb:spikes';
var SPIKE_CAP = 300;
// Valve state per job. Absent = open, which is how the system runs today.
var VALVE = 'hb:valve:';

// Jobs that act outward. Only these may be vetoed; see the header.
var OUTWARD = ['social-cron', 'subscriber-digest', 'autopilot', 'automail'];

function now() { return Date.now(); }

/**
 * Record one run. Never throws, never rejects: a job's success must not depend
 * on the ledger being up.
 *
 * job    — stable id, matches the handler name so the panel can join to routes
 * fields — { ok, ms, note, wrote }  wrote = key(s) touched, which is what lets
 *          the harness draw an edge from this job to whoever reads that key.
 */
async function beat(job, fields) {
  if (!job) return;
  fields = fields || {};
  var row = {
    at: now(),
    job: String(job),
    ok: fields.ok !== false,
    ms: (typeof fields.ms === 'number') ? Math.round(fields.ms) : null,
    note: fields.note ? String(fields.note).slice(0, 200) : null,
    wrote: Array.isArray(fields.wrote) ? fields.wrote.slice(0, 8) : null
  };
  try { await db.set(LAST + row.job, row); } catch (e) {}
  try { await db.lpush(SPIKES, row); } catch (e) {}
  // Trim on a sample rather than every write: two round trips per cron run x 18
  // jobs x every 5 minutes is real bandwidth for a list that only needs to stay
  // roughly capped. lpush here returns true, not a length, so we cannot trim on
  // an exact threshold without paying for an extra read.
  if (Math.random() < 0.12) {
    try { await db.ltrim(SPIKES, 0, SPIKE_CAP - 1); } catch (e) {}
  }
  return row;
}

/**
 * Is this job permitted to act? Only meaningful for OUTWARD jobs; anything else
 * is always allowed, so callers cannot accidentally gate their own senses.
 */
async function allowed(job) {
  if (OUTWARD.indexOf(String(job)) < 0) return { open: true, reason: 'not an outward job' };
  var v = null;
  try { v = await db.get(VALVE + job); } catch (e) {
    // Ledger unreachable. We cannot prove a veto exists, and a job that stops
    // running because Redis hiccuped is a silent outage. See header.
    return { open: true, reason: 'valve unreadable, defaulting to the shipped state' };
  }
  if (!v || v.open !== false) return { open: true, reason: null };
  return { open: false, reason: v.reason || 'closed from the panel', at: v.at || null };
}

/** Shut or open a valve. Refuses jobs that have no valve, rather than inventing one. */
async function setValve(job, open, reason) {
  job = String(job);
  if (OUTWARD.indexOf(job) < 0) {
    return { ok: false, error: job + ' has no valve: only outward-acting jobs do (' + OUTWARD.join(', ') + ')' };
  }
  var row = { open: open !== false, at: now(), reason: reason ? String(reason).slice(0, 200) : null };
  try { await db.set(VALVE + job, row); } catch (e) {
    return { ok: false, error: 'could not write the valve: ' + (e.message || 'unknown') };
  }
  return { ok: true, job: job, valve: row };
}

/**
 * Wrap an inward handler so every run records itself. One line at the export.
 * Timing and outcome are observed, not self-reported: ok comes from whether the
 * handler threw and what status it actually set on the response.
 */
function wrap(job, handler) {
  return async function (req, res) {
    var t0 = now();
    try {
      var out = await handler(req, res);
      var code = res && typeof res.statusCode === 'number' ? res.statusCode : 200;
      await beat(job, { ok: code < 400, ms: now() - t0, note: code >= 400 ? 'status ' + code : null });
      return out;
    } catch (e) {
      await beat(job, { ok: false, ms: now() - t0, note: (e && e.message) || 'threw' });
      throw e;
    }
  };
}

/**
 * Wrap an OUTWARD handler: same recording, plus the veto is consulted BEFORE the
 * handler runs. A shut valve is a 200 with acted:false, not an error, because a
 * deliberate stop is a normal outcome and should not page anyone.
 */
function guard(job, handler) {
  return async function (req, res) {
    var gate = await allowed(job);
    if (!gate.open) {
      await beat(job, { ok: true, ms: 0, note: 'vetoed: ' + (gate.reason || 'valve shut') });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        ok: true, acted: false, vetoed: true, job: job,
        reason: gate.reason || 'valve shut', at: gate.at || null
      }));
    }
    return wrap(job, handler)(req, res);
  };
}

/**
 * Read the ledger. `limit` keeps the polled payload small: the panel pulls the
 * full window once, then a short tail on each poll and merges by timestamp.
 */
async function read(jobs, limit) {
  limit = Math.max(1, Math.min(SPIKE_CAP, limit || 60));
  var spikes = [];
  try { spikes = (await db.lrange(SPIKES, 0, limit - 1)) || []; } catch (e) {}
  var last = {};
  var valves = {};
  var names = Array.isArray(jobs) ? jobs : [];
  for (var i = 0; i < names.length; i++) {
    try { last[names[i]] = await db.get(LAST + names[i]); } catch (e) { last[names[i]] = null; }
  }
  for (var k = 0; k < OUTWARD.length; k++) {
    try { valves[OUTWARD[k]] = (await db.get(VALVE + OUTWARD[k])) || { open: true }; }
    catch (e) { valves[OUTWARD[k]] = { open: true, unreadable: true }; }
  }
  return { at: now(), spikes: spikes, last: last, valves: valves, cap: SPIKE_CAP };
}

module.exports = {
  beat: beat,
  wrap: wrap,
  guard: guard,
  allowed: allowed,
  setValve: setValve,
  read: read,
  OUTWARD: OUTWARD,
  SPIKE_CAP: SPIKE_CAP
};
