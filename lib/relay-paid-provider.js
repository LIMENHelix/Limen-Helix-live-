'use strict';

/**
 * Relay's only seam to the shared paid-provider authority boundary.
 *
 * Relay core remains firewalled from every other subsystem.  This adapter gives
 * its image/search providers the same global AI kill switch, atomic durable
 * reservation, local daily cap and one-hour idempotency protection as the other
 * paid provider lanes without widening that firewall.
 */

var crypto = require('node:crypto');
var boundary = require('./paid-provider-boundary');
var AdapterGuard = require('./civilization-adapter-guard');
var Store = require('./autofire-efference-store');

var SCOPE = 'relay:paid-provider';
var DEFAULT_DAILY_CAP_USD = 1;
var DEFAULT_XAI_IMAGE_COST_USD = 0.20;
var DEFAULT_SEARCH_OPERATION_COST_USD = 0.02;

function positive(value, fallback) {
  var parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function digest(parts) {
  return crypto.createHash('sha256')
    .update(parts.map(function (part) { return String(part || '').trim().toLowerCase(); }).join('\u0000'))
    .digest('hex');
}

function dailyCapUsd() {
  return positive(process.env.RELAY_PROVIDER_DAILY_CAP_USD, DEFAULT_DAILY_CAP_USD);
}

async function reserve(kind, provider, identity, estimatedUsd) {
  await AdapterGuard.checkpoint(Store, 'trade:relay-sourcing', provider + '-' + kind);
  return boundary.reserve({
    kind: 'paid-api',
    scope: SCOPE,
    scopeDailyCapUsd: dailyCapUsd(),
    costUsd: estimatedUsd,
    label: 'Relay ' + provider + ' ' + kind,
    idempotencyKey: 'relay:' + kind + ':' + provider + ':' + digest([provider, kind, identity])
  });
}

function reserveImage(concept) {
  return reserve(
    'image',
    'xai',
    concept,
    positive(process.env.RELAY_XAI_IMAGE_COST_USD, DEFAULT_XAI_IMAGE_COST_USD)
  );
}

function reserveSearch(provider, identity) {
  return reserve(
    'search',
    provider,
    identity,
    positive(process.env.RELAY_SEARCH_OPERATION_COST_USD, DEFAULT_SEARCH_OPERATION_COST_USD)
  );
}

function settle(reservation) {
  return boundary.settle(reservation, { estimatedUsd: reservation && reservation.estUsd });
}

module.exports = {
  reserveImage: reserveImage,
  reserveSearch: reserveSearch,
  settle: settle,
  dailyCapUsd: dailyCapUsd,
  SCOPE: SCOPE,
  DEFAULT_DAILY_CAP_USD: DEFAULT_DAILY_CAP_USD,
  DEFAULT_XAI_IMAGE_COST_USD: DEFAULT_XAI_IMAGE_COST_USD,
  DEFAULT_SEARCH_OPERATION_COST_USD: DEFAULT_SEARCH_OPERATION_COST_USD
};
