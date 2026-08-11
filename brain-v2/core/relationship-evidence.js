/**
 * brain-v2/core/relationship-evidence.js — WHAT THE RECORDED WINDOW CAN AND CANNOT TEST.
 *
 * Joins the three pieces that were built separately and never yet spoke: a binder's DECLARED
 * relationships, its channels' DECLARED reference intervals, and `core/comparability.js`.
 * For each declared pair it answers one question — is this comparable, and on how many
 * sessions — and it answers it about the RECORDED WINDOW rather than about a cycle.
 *
 * THIS ACTIVATES NOTHING. It grades no divergence, moves no threshold, writes no state and
 * feeds no decision. It is an OBSERVER: the same posture the shadow runtime already takes
 * toward the domains it senses. A pair reading `eligible:true` here has cleared the
 * comparability gate and nothing else; the evidence gate is separate and remains shut.
 *
 * WHY THE WINDOW AND NOT THE CYCLE. In steady state a cycle applies one row, so evaluating a
 * cycle's fresh rows would ask whether six sessions can be found in one hour. Comparability
 * is a property of the history that is available, so it is measured over the whole window the
 * runtime already read. Nothing is ticked and no cursor moves: this is a read.
 */

'use strict';

var CMP = require('./comparability.js');
var RT = require('./reference-time.js');

/**
 * Collect each channel's readings across the window, oldest first.
 *
 * A row is read through the BINDER, so this sees exactly what the runtime sees — including
 * `recordedAt`, which is what lets the gate tell a restatement from a contradiction.
 */
function readingsByChannel(binder, rows) {
  var out = Object.create(null);
  var ordered = (rows || []).slice().sort(function (a, b) { return a.t - b.t; });
  ordered.forEach(function (row) {
    var readings = binder.readRecorderRow(row) || {};
    Object.keys(readings).forEach(function (k) {
      (out[k] || (out[k] = [])).push({
        identity: readings[k].observationId,
        value: readings[k].value,
        recordedAt: readings[k].recordedAt
      });
    });
  });
  return out;
}

/**
 * Evaluate every declared relationship a binder carries.
 *
 *   binder     a bind/* module
 *   rows       recorder rows, any order
 *   calendars  { <id>: calendar }, as bind/calendars.js declares them
 *
 * Returns one entry per declared relationship, always, including the ones that abstain. A
 * relationship missing from the report would read as passing.
 */
function evaluate(binder, rows, calendars) {
  var spec = binder.spec();
  var byKey = Object.create(null);
  (spec.channels || []).forEach(function (c) { byKey[c.key] = c; });
  var readings = readingsByChannel(binder, rows);

  /* One side's observations, plus why any reading could not be placed. `side.ok:false` is a
     DECLARATION problem and is reported before the gate is asked, because the gate would
     otherwise report the same fault in its own vocabulary and lose which channel caused it. */
  function sideFor(key) {
    var ch = byKey[key];
    if (!ch) return { ok: false, why: 'channel_not_declared_by_this_binder', key: key };
    var ri = ch.referenceInterval;
    if (!ri) return { ok: false, why: 'channel_declares_no_referenceInterval', key: key };
    var cal = (calendars || {})[ri.calendar];
    var derived = RT.observationsFor(readings[key] || [], ri.observedAt, cal, CMP.instantForLocal);
    return {
      ok: true, key: key,
      spec: { referenceInterval: ri },
      observations: derived.observations,
      readingsSeen: (readings[key] || []).length,
      placed: derived.observations.length,
      dropped: derived.dropped
    };
  }

  return (spec.relationships || []).map(function (rel) {
    var a = sideFor(rel.a), b = sideFor(rel.b);
    var base = { a: rel.a, b: rel.b, latent: rel.latent, expect: rel.expect };

    if (!a.ok || !b.ok) {
      /* Named per side, because "not comparable" without saying which half is undeclared
         sends a reader to look at both. */
      return Object.assign(base, {
        comparable: false, eligible: false,
        why: (!a.ok ? a.why : b.why),
        blockedBy: [!a.ok ? rel.a : null, !b.ok ? rel.b : null].filter(Boolean).join(' + '),
        alignedSessions: 0, revisedSessions: 0, minAligned: CMP.MIN_ALIGNED,
        placed: { a: a.ok ? a.placed : 0, b: b.ok ? b.placed : 0 },
        dropped: { a: a.ok ? a.dropped : null, b: b.ok ? b.dropped : null },
        abstentions: {}
      });
    }

    var v = CMP.evaluate(a, b, calendars);
    return Object.assign(base, {
      comparable: v.comparable, eligible: v.eligible, why: v.why, blockedBy: null,
      alignedSessions: v.alignedSessions, revisedSessions: v.revisedSessions || 0,
      minAligned: v.minAligned,
      /* How many readings each side contributed and how many the declared rule could place.
         A rule that fits nothing looks identical to a channel with no data without these. */
      placed: { a: a.placed, b: b.placed },
      seen: { a: a.readingsSeen, b: b.readingsSeen },
      dropped: { a: a.dropped, b: b.dropped },
      abstentions: v.abstentions || {}
    });
  });
}

module.exports = { evaluate: evaluate, readingsByChannel: readingsByChannel };
