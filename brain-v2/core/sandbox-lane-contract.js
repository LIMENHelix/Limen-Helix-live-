'use strict';

/*
 * Shared sandbox physiology for outward civilization lanes. These contracts
 * describe what a complete motor loop must eventually receipt and observe.
 * They authorize no network call, publication, message, transaction, or spend.
 */

var SCHEMA_VERSION = 'sandbox-lane-contract/1.0';
var CONTRACTS = {
  'research-papers': { effectClass: 'artifact', nextAction: 'publish-or-consume-in-decision', receipt: 'artifact-receipt', outcome: 'citation-use-or-falsification', rollback: 'withdraw-or-correct' },
  'investments': { effectClass: 'capital-decision', nextAction: 'simulate-position', receipt: 'position-command-receipt', outcome: 'independent-market-resolution', rollback: 'cancel-or-close' },
  'publication': { effectClass: 'public-artifact', nextAction: 'publish', receipt: 'publication-receipt', outcome: 'reach-engagement-or-conversion', rollback: 'unpublish-or-correct' },
  'social': { effectClass: 'public-message', nextAction: 'post', receipt: 'platform-post-receipt', outcome: 'engagement-or-conversion', rollback: 'delete-or-correct' },
  'subscriber-email': { effectClass: 'direct-message', nextAction: 'send-email', receipt: 'delivery-provider-receipt', outcome: 'delivery-click-reply-or-unsubscribe', rollback: 'suppress-or-correct' },
  'automail': { effectClass: 'physical-message', nextAction: 'dispatch-mail', receipt: 'mail-provider-receipt', outcome: 'delivery-or-response', rollback: 'cancel-before-tender-or-suppress' },
  'autopilot': { effectClass: 'bounded-command', nextAction: 'execute-bounded-command', receipt: 'command-receipt', outcome: 'independent-world-measurement', rollback: 'kill-and-compensate' },
  'hero-image': { effectClass: 'media-artifact', nextAction: 'attach-or-publish-media', receipt: 'asset-receipt', outcome: 'usage-engagement-or-conversion', rollback: 'replace-or-remove' },
  'auction': { effectClass: 'marketplace-command', nextAction: 'bid-or-list', receipt: 'marketplace-receipt', outcome: 'win-loss-or-sale', rollback: 'retract-or-close-within-policy' },
  'homestead': { effectClass: 'property-operation', nextAction: 'submit-property-action', receipt: 'property-action-receipt', outcome: 'counterparty-or-service-response', rollback: 'withdraw-or-remediate' },
  'crm': { effectClass: 'relationship-operation', nextAction: 'create-or-update-record', receipt: 'crm-receipt', outcome: 'stage-transition-or-revenue', rollback: 'revert-close-or-suppress' },
  'real-estate': { effectClass: 'property-transaction', nextAction: 'submit-offer-or-listing', receipt: 'counterparty-receipt', outcome: 'accept-decline-or-close', rollback: 'withdraw-or-terminate-under-policy' },
  'broker/order': { effectClass: 'broker-command', nextAction: 'preview-then-submit-order', receipt: 'broker-order-receipt', outcome: 'fill-and-independent-pnl', rollback: 'cancel-or-exit-under-risk-policy' }
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function list() { return Object.keys(CONTRACTS); }
function get(lane) {
  var body = CONTRACTS[lane];
  if (!body) throw new Error('sandbox-lane-contract: unsupported lane ' + lane);
  return Object.assign({ schemaVersion: SCHEMA_VERSION, lane: lane, sandboxOnly: true, externalEffectAuthorized: false }, clone(body));
}

module.exports = { SCHEMA_VERSION: SCHEMA_VERSION, list: list, get: get };
