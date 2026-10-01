/** Durable B11 release/hold receipt around brain-v2's outward action policy. */

'use strict';

var POLICY = require('../brain-v2/core/outward-action-policy.js');
var LEARNING = require('./autofire-learning.js');
var crypto = require('node:crypto');

var LOG_KEY = 'autofire_selection_log';
var LOG_CAP = 1000;

async function select(store, spec) {
  try {
    store.assertDurable();
    var owner = POLICY.ownerFor(spec && spec.lane, spec && spec.candidate && spec.candidate.domain);
    var context = owner ? await LEARNING.selectionContext(store, owner) : null;
    var receipt = POLICY.select(Object.assign({}, spec, context || {}));
    // Routing provenance is observation metadata, not a change to the owning
    // policy. Keep the origin that the worker supplied before normalization.
    var candidate = spec && spec.candidate || {};
    var origin = candidate.originDomain || candidate.domain;
    if (origin === 'agriculture' && receipt.candidate && receipt.candidate.sourceIdentity) {
      receipt.routing = {
        originDomain: origin, ownerDomain: receipt.ownerDomain,
        sourcePacketId: receipt.candidate.sourcePacketId,
        sourceArtifactRef: receipt.candidate.sourceArtifactRef,
        opportunityId: candidate.id || null,
        sourceIdentity: receipt.candidate.sourceIdentity,
        observationOnly: true
      };
    }
    // The policy ID identifies a candidate/cycle, not a decision episode. A
    // later critic evaluation must not overwrite an earlier command's cause.
    // Keep that policy identity while addressing the complete business snapshot.
    receipt.policySelectionId = receipt.id;
    receipt.id = 'sel_episode_' + crypto.createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
    // Selection receipts are append-only decision episodes. Capped indexes may
    // roll over, but the addressable episode must remain available to outcomes.
    var key = 'autofire_selection:' + receipt.id;
    await store.setIfAbsent(key, receipt);
    if (JSON.stringify(await store.get(key)) !== JSON.stringify(receipt)) {
      throw new Error('selection episode readback failed');
    }
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
