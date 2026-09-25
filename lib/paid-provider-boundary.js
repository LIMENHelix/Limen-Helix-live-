'use strict';

/**
 * Common paid-provider authority boundary.
 *
 * Every caller must name a local scope, an explicit daily cap, and a stable
 * idempotency key.  The global AI switch is checked before the atomic spend
 * reservation.  Settlement is conservative: ambiguous provider failures keep
 * the estimate charged instead of reopening budget after a possibly-billed call.
 */

var killSwitch = require('./ai-kill-switch');
var spendMeter = require('./spend-meter');

async function reserve(options) {
  options = options || {};
  if (await killSwitch.spendDisabled()) {
    return { ok: false, disabled: true, reason: 'AI spend disabled (env kill switch or operator pause)' };
  }
  if (!options.scope || !Number.isFinite(Number(options.scopeDailyCapUsd)) || Number(options.scopeDailyCapUsd) <= 0) {
    return { ok: false, reason: 'Paid provider scope and positive daily cap are required.' };
  }
  if (!options.idempotencyKey) {
    return { ok: false, reason: 'Paid provider idempotency key is required.' };
  }
  return spendMeter.reserve(Object.assign({}, options, {
    requireBudget: true,
    scopeDailyCapUsd: Number(options.scopeDailyCapUsd)
  }));
}

async function settle(reservation, actual) {
  if (!reservation || !reservation.id) return { ok: false, reason: 'Paid provider reservation is required.' };
  actual = Object.assign({}, actual || {});
  if (actual.estimatedUsd == null) actual.estimatedUsd = reservation.estUsd;
  return spendMeter.settle(reservation.id, actual);
}

module.exports = { reserve: reserve, settle: settle };
