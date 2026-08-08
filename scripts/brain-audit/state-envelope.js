/**
 * scripts/brain-audit/state-envelope.js — ONE definition of the persisted state value.
 *
 * `lib/brain-shadow-runtime.js` writes this shape through `STORE.writeState`:
 *
 *   { runtime, domain, lastRowT, savedAt, loop }
 *
 * audit-cost and audit-growth both need its size. They had two definitions of it, and
 * audit-growth measured `LOOP.serialize(loop)` ALONE while labelling the result the stored
 * state value, so its numbers were smaller than the thing production stores and did not
 * agree with audit-cost at the same depth. Two copies of one idea disagreeing is the defect
 * this file exists to remove: there is now one shape, and both callers import it.
 *
 * Pure. No filesystem, no clock, no Redis.
 *
 * UNIT: UTF-8 byte length of the serialized VALUE. NOT bytes on the wire. The Upstash REST
 * transport re-encodes the value and adds an envelope, so this must not be doubled into
 * bandwidth, projected into a bill, or compared with a request-size ceiling. Transport
 * bytes, bandwidth, billing and request-size headroom all remain unmeasured.
 */
'use strict';

/** Mirrors lib/brain-shadow-runtime.js RUNTIME_VERSION. */
var RUNTIME_VERSION = 'brain-v2-shadow/0.1.0';

/**
 * A FIXED 13-DIGIT EPOCH. The runtime stores `startedAt`, a millisecond timestamp, so the
 * field is 13 characters wide; `savedAt: 0` would be one and understate every total. Fixed
 * rather than `Date.now()` so reruns diff cleanly.
 */
var SAVED_AT = 1786000000000;

/**
 * Build the exact value the runtime persists.
 *
 * @param {string} domain      snapshot key, as the runtime writes it
 * @param {number|null} lastRowT  the CURSOR at this point: the `t` of the last row consumed,
 *                             including rows that produced no reading, because the runtime
 *                             advances the cursor on abstention too
 * @param {object} loopState   the result of LOOP.serialize(loop)
 */
function envelope(domain, lastRowT, loopState) {
  return {
    runtime: RUNTIME_VERSION,
    domain: domain,
    lastRowT: lastRowT === undefined ? null : lastRowT,
    savedAt: SAVED_AT,
    loop: loopState
  };
}

/** UTF-8 byte length of the serialized envelope. Buffer.byteLength, never String.length. */
function envelopeBytes(domain, lastRowT, loopState) {
  return Buffer.byteLength(JSON.stringify(envelope(domain, lastRowT, loopState)), 'utf8');
}

/** The cursor after consuming the first `n` rows: the runtime advances it per ROW, not per tick. */
function cursorAfterRows(rows, n) {
  if (!rows || !rows.length || n <= 0) return null;
  return rows[Math.min(n, rows.length) - 1].t;
}

module.exports = {
  RUNTIME_VERSION: RUNTIME_VERSION,
  SAVED_AT: SAVED_AT,
  envelope: envelope,
  envelopeBytes: envelopeBytes,
  cursorAfterRows: cursorAfterRows
};
