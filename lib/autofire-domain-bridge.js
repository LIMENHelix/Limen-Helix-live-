/** Durable B11 release/hold receipt around brain-v2's outward action policy. */

'use strict';

var POLICY = require('../brain-v2/core/outward-action-policy.js');
var LEARNING = require('./autofire-learning.js');

var LOG_KEY = 'autofire_selection_log';
var LOG_CAP = 1000;

async function select(store, spec) {
  try {
    store.assertDurable();
    var owner = POLICY.ownerFor(spec && spec.lane, spec && spec.candidate && spec.candidate.domain);
    var context = owner ? await LEARNING.selectionContext(store, owner) : null;
    var receipt = POLICY.select(Object.assign({}, spec, context || {}));
    await store.set('autofire_selection:' + receipt.id, receipt, 180 * 86400);
    await store.lpush(LOG_KEY, receipt);
    await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
    /* The receipt lands first. If critic-state persistence then fails, dispatch
       still fails closed, but the attempted decision remains auditable. The
       reverse order could mutate the critic and leave no receipt at all. */
    if (owner && context) await LEARNING.persistSelectionGate(store, owner, context.gate);
    return { ok: true, receipt: receipt };
  } catch (err) {
    return { ok: false, error: 'outward_decision_not_fully_durable', detail: (err && err.message) || String(err) };
  }
}

module.exports = { LOG_KEY: LOG_KEY, select: select };
