/**
 * Finance-owned server-side resource metabolism.
 *
 * This is not the product Brain v2 or the shadow kernel's process telemetry. It is the Finance domain's
 * own capital, account, quote, order-congestion, and provider-call budget gate.
 * It is pure and performs no broker, Redis, or provider I/O.
 */

'use strict';

var DOMAIN_BRAIN_CAPABILITY = Object.freeze({
  schemaVersion: 'domain-brain-capability/1.0',
  domain: 'finance',
  capability: 'resourceMetabolism'
});

var POLICY_ID = 'finance-resource-metabolism/1.0';
var HARD_PROVIDER_CALLS_PER_PACKET = 1;
var HARD_MAX_NOTIONAL_USD = 100;

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function envNumber(env, name, fallback) {
  var value = Number(env && env[name]);
  return finite(value) && value >= 0 ? value : fallback;
}

function policy(env) {
  var reserve = envNumber(env, 'LIMEN_FINANCE_SANDBOX_RESERVE_USD', 0);
  var configuredNotional = envNumber(env, 'LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD', HARD_MAX_NOTIONAL_USD);
  return {
    id: POLICY_ID,
    ownerDomain: 'finance',
    environment: 'sandbox',
    paperOnly: true,
    minimumUncommittedCashUsd: reserve,
    maxGrossNotionalUsd: Math.min(HARD_MAX_NOTIONAL_USD, configuredNotional || HARD_MAX_NOTIONAL_USD),
    maxProviderCallsPerPacket: HARD_PROVIDER_CALLS_PER_PACKET,
    duplicateOpenOrderInhibited: true,
    marginConsumptionAllowed: false,
    negativeCashAllowed: false
  };
}

function candidatePosition(account, symbol) {
  var positions = account && Array.isArray(account.positions) ? account.positions : [];
  for (var i = 0; i < positions.length; i++) {
    if (String(positions[i].symbol || '').toUpperCase() === symbol) return Number(positions[i].quantity) || 0;
  }
  return 0;
}

function openCandidateOrders(account, symbol) {
  var terminal = ['filled', 'canceled', 'cancelled', 'rejected', 'expired'];
  return (account && Array.isArray(account.orders) ? account.orders : []).filter(function (order) {
    return String(order.symbol || '').toUpperCase() === symbol &&
      terminal.indexOf(String(order.status || '').toLowerCase()) < 0;
  });
}

function evaluate(input) {
  input = input || {};
  var account = input.account || {};
  var quote = input.quote || {};
  var motor = input.motorPolicy || {};
  var p = policy(input.env || {});
  var symbol = String(input.symbol || quote.symbol || '').toUpperCase();
  var cash = Number(account.totalCash);
  var equity = Number(account.totalEquity);
  var last = Number(quote.last);
  var bid = Number(quote.bid);
  var ask = Number(quote.ask);
  var quoteReference = finite(ask) && ask > 0 ? ask : (finite(last) && last > 0 ? last : null);
  var providerCallsUsed = Number(input.providerCallsUsed) || 0;
  var orders = openCandidateOrders(account, symbol);
  var blockers = [];

  if (!symbol) blockers.push('finance_resource_symbol_required');
  if (!finite(cash)) blockers.push('finance_resource_total_cash_unmeasured');
  if (!finite(equity)) blockers.push('finance_resource_total_equity_unmeasured');
  if (finite(cash) && cash < 0) blockers.push('finance_resource_negative_cash_inhibited');
  if (finite(equity) && equity < 0) blockers.push('finance_resource_negative_equity_inhibited');
  if (quoteReference === null) blockers.push('finance_resource_quote_unmeasured');
  if (providerCallsUsed >= p.maxProviderCallsPerPacket) blockers.push('finance_resource_provider_refractory');
  if (orders.length) blockers.push('finance_resource_duplicate_open_order_inhibited');
  if (motor.environment !== 'sandbox' || motor.paperOnly !== true || motor.liveExecution !== false) {
    blockers.push('finance_resource_sandbox_policy_required');
  }
  if (motor.cashOnly !== true || motor.longOnly !== true || motor.marginAllowed !== false ||
      motor.optionsAllowed !== false || motor.shortingAllowed !== false) {
    blockers.push('finance_resource_bounded_instrument_policy_required');
  }

  var availableCash = finite(cash) ? Math.max(0, cash - p.minimumUncommittedCashUsd) : 0;
  var motorCap = finite(motor.maxGrossNotionalUsd) && motor.maxGrossNotionalUsd > 0
    ? motor.maxGrossNotionalUsd : 0;
  var availableNotional = Math.min(availableCash, p.maxGrossNotionalUsd, motorCap);
  if (!(availableNotional > 0)) blockers.push('finance_resource_no_uncommitted_cash');

  var state = blockers.length ? 'INHIBITED' : 'AVAILABLE';
  return {
    schemaVersion: 'finance-resource-state/1.0',
    ownerDomain: 'finance',
    policyId: p.id,
    state: state,
    allowsProviderCall: blockers.length === 0,
    allowsMotorIntent: blockers.length === 0,
    blockers: blockers,
    measurements: {
      symbol: symbol || null,
      totalCashUsd: finite(cash) ? cash : null,
      totalEquityUsd: finite(equity) ? equity : null,
      minimumUncommittedCashUsd: p.minimumUncommittedCashUsd,
      availableCashUsd: availableCash,
      availableNotionalUsd: availableNotional,
      quoteLastUsd: finite(last) ? last : null,
      quoteBidUsd: finite(bid) ? bid : null,
      quoteAskUsd: finite(ask) ? ask : null,
      candidatePositionQuantity: candidatePosition(account, symbol),
      openCandidateOrders: orders.length,
      providerCallsUsed: providerCallsUsed,
      providerCallsRemaining: Math.max(0, p.maxProviderCallsPerPacket - providerCallsUsed)
    },
    setPoints: p,
    recovery: blockers.map(function (reason) {
      if (reason === 'finance_resource_provider_refractory') return 'wait_for_a_fresh_packet';
      if (reason === 'finance_resource_duplicate_open_order_inhibited') return 'resolve_or_cancel_the_existing_sandbox_order';
      if (reason === 'finance_resource_no_uncommitted_cash') return 'restore_cash_above_the_finance_reserve';
      if (reason.indexOf('quote_') >= 0) return 'refresh_the_tradier_sandbox_quote';
      if (reason.indexOf('cash_') >= 0 || reason.indexOf('equity_') >= 0) return 'refresh_the_tradier_sandbox_account';
      return 'hold_motor_output_and_reaudit';
    })
  };
}

module.exports = {
  DOMAIN_BRAIN_CAPABILITY: DOMAIN_BRAIN_CAPABILITY,
  POLICY_ID: POLICY_ID,
  HARD_PROVIDER_CALLS_PER_PACKET: HARD_PROVIDER_CALLS_PER_PACKET,
  HARD_MAX_NOTIONAL_USD: HARD_MAX_NOTIONAL_USD,
  policy: policy,
  evaluate: evaluate
};
