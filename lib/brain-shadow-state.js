/**
 * lib/brain-shadow-state.js — the PRODUCTION contract for the persisted shadow state value.
 *
 * One owner for the runtime version and for the shape written to
 * `brain:v2:shadow:<domain>:state`:
 *
 *   { runtime, domain, lastRowT, savedAt, loop }
 *
 * WHY THIS IS A MODULE AND NOT A LITERAL IN TWO PLACES. `lib/brain-shadow-runtime.js`
 * builds that object to persist it; `scripts/brain-audit/*` builds it to measure it. While
 * the audit kept its own copy of the shape AND its own copy of the version string, the
 * "exact production envelope" it claimed to measure could drift from the one production
 * writes without anything failing. It already had: the audit measured the loop alone and
 * called it the state value. Removing the second copy is the fix; keeping the copies in
 * sync by hand is the defect.
 *
 * PURE. No filesystem, no network, no clock. `savedAt` is supplied by the caller: the
 * runtime passes its real cycle start, the audit passes a fixed constant so reruns diff
 * cleanly. Nothing here reads a clock, so nothing here can make a measurement
 * irreproducible.
 */

'use strict';

/** THE version. `brain-shadow-runtime` re-exports this rather than declaring its own. */
var RUNTIME_VERSION = 'brain-v2-shadow/0.1.0';

/**
 * Build the value persisted by `STORE.writeState`.
 *
 * @param {string} domain        snapshot key
 * @param {number|null} lastRowT the cursor: `t` of the last row consumed, including rows
 *                               that produced no reading, because the runtime advances the
 *                               cursor on abstention too
 * @param {number} savedAt       epoch ms
 * @param {object} loop          result of LOOP.serialize(loop)
 */
function stateEnvelope(domain, lastRowT, savedAt, loop) {
  return {
    runtime: RUNTIME_VERSION,
    domain: domain,
    lastRowT: lastRowT,
    savedAt: savedAt,
    loop: loop
  };
}

module.exports = {
  RUNTIME_VERSION: RUNTIME_VERSION,
  stateEnvelope: stateEnvelope
};
