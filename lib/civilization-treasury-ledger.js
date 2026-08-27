'use strict';

/**
 * Durable, double-entry accounting substrate for the twenty sovereign product
 * domains. This module records economic facts and computes account projections.
 * It has no payment, payout, transfer, broker, or provider adapter and cannot
 * authorize money movement.
 */

var crypto = require('node:crypto');

var SCHEMA = 'civilization-treasury-receipt/1.0';
var PROJECTION_SCHEMA = 'civilization-treasury-projection/1.0';
var LOG_KEY = 'civilization_treasury_receipt_log';
var LOG_CAP = 10000;
var OUTBOUND_MONEY_AUTHORIZED = false;
var DOMAINS = Object.freeze([
  'agriculture', 'communication', 'culture', 'defense', 'economy',
  'education', 'energy', 'environment', 'finance', 'governance',
  'industry', 'infrastructure', 'intelligence', 'law', 'medicine',
  'population', 'religion', 'science', 'technology', 'trade'
]);
var DOMAIN_SET = new Set(DOMAINS);
var KINDS = new Set([
  'CONTRIBUTION', 'CAPITALIZATION', 'SALE_CAPTURED', 'SALE_SETTLED',
  'EXPENSE', 'TRANSFER', 'RESERVE', 'RESERVE_RELEASE', 'COMMIT',
  'COMMIT_RELEASE', 'REFUND', 'DISPUTE_HOLD', 'DISPUTE_RELEASE',
  'RECONCILIATION_ADJUSTMENT'
]);
var CASH_BUCKETS = Object.freeze(['available', 'pending', 'reserved', 'committed']);

function domain(value) {
  var d = String(value || '').trim().toLowerCase();
  if (!DOMAIN_SET.has(d)) throw new Error('unknown treasury product domain ' + String(value || ''));
  return d;
}
function cents(value, label, allowZero) {
  var n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || (!allowZero && n === 0)) {
    throw new Error((label || 'amountCents') + ' must be a ' + (allowZero ? 'non-negative' : 'positive') + ' integer');
  }
  return n;
}
function cash(d, bucket) {
  d = domain(d);
  if (CASH_BUCKETS.indexOf(bucket) < 0) throw new Error('unknown cash bucket');
  return 'domain:' + d + ':cash:' + bucket;
}
function obligation(d, kind) {
  d = domain(d);
  kind = String(kind || '').trim().toLowerCase();
  if (kind !== 'statutory-tax' && kind !== 'dispute') throw new Error('unknown obligation bucket');
  return 'domain:' + d + ':obligation:' + kind;
}
function external(name) {
  name = String(name || '').trim().toLowerCase();
  var allowed = ['operator', 'customer', 'stripe-clearing', 'stripe-fees', 'vendor', 'reconciliation'];
  if (allowed.indexOf(name) < 0) throw new Error('unknown external account');
  return 'external:' + name;
}
function accountValid(account) {
  if (/^external:(operator|customer|stripe-clearing|stripe-fees|vendor|reconciliation)$/.test(account)) return true;
  var m = /^domain:([a-z]+):cash:(available|pending|reserved|committed)$/.exec(account);
  if (m) return DOMAIN_SET.has(m[1]);
  m = /^domain:([a-z]+):obligation:(statutory-tax|dispute)$/.exec(account);
  return !!(m && DOMAIN_SET.has(m[1]));
}
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ':' + stable(value[key]);
  }).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function receiptKey(id) { return 'civilization_treasury_receipt:' + id; }
function movement(from, to, amountCents) {
  if (!accountValid(from) || !accountValid(to) || from === to) throw new Error('treasury movement accounts invalid');
  return { from: from, to: to, amountCents: cents(amountCents, 'movement amountCents', false) };
}
function normalizeMetrics(metrics) {
  metrics = metrics || {};
  var out = {};
  ['revenueDeltaCents', 'costCents', 'levyCents', 'contributionCents', 'capitalizationCents'].forEach(function (key) {
    var n = metrics[key] == null ? 0 : Number(metrics[key]);
    if (!Number.isSafeInteger(n) || (key !== 'revenueDeltaCents' && n < 0)) throw new Error('invalid treasury metric ' + key);
    out[key] = n;
  });
  return out;
}
function sameMove(row, from, to) { return row && row.from === from && row.to === to; }
function requireOne(content, from, to, label) {
  if (content.movements.length !== 1 || !sameMove(content.movements[0], from, to)) {
    throw new Error(content.kind + ' account geometry invalid' + (label ? ': ' + label : ''));
  }
  return content.movements[0].amountCents;
}
function noMetricsExcept(metrics, allowed) {
  return Object.keys(metrics).every(function (key) { return allowed.indexOf(key) >= 0 || metrics[key] === 0; });
}
function validateContent(content) {
  var d = content.ownerDomain, m = content.metrics, amount;
  if (content.kind === 'CONTRIBUTION') {
    amount = requireOne(content, external('operator'), cash(d, 'available'));
    if (!content.externalRef || m.contributionCents !== amount || !noMetricsExcept(m, ['contributionCents'])) throw new Error('CONTRIBUTION evidence or metrics invalid');
  } else if (content.kind === 'CAPITALIZATION') {
    amount = requireOne(content, cash('finance', 'available'), cash(d, 'available'));
    if (d === 'finance' || !content.policyRef || m.capitalizationCents !== amount || !noMetricsExcept(m, ['capitalizationCents'])) throw new Error('CAPITALIZATION evidence or metrics invalid');
  } else if (content.kind === 'SALE_CAPTURED') {
    amount = requireOne(content, external('stripe-clearing'), cash(d, 'pending'));
    if (!content.externalRef || m.revenueDeltaCents !== amount || !noMetricsExcept(m, ['revenueDeltaCents'])) throw new Error('SALE_CAPTURED evidence or metrics invalid');
  } else if (content.kind === 'SALE_SETTLED') {
    if (!content.externalRef || !content.movements.every(function (row) {
      return row.from === cash(d, 'pending') && [cash(d, 'available'), external('stripe-fees'),
        obligation(d, 'statutory-tax'), cash('finance', 'available')].indexOf(row.to) >= 0;
    })) throw new Error('SALE_SETTLED account geometry or evidence invalid');
    var fee = 0, levy = 0;
    content.movements.forEach(function (row) {
      if (row.to === external('stripe-fees')) fee += row.amountCents;
      if (row.to === cash('finance', 'available')) levy += row.amountCents;
    });
    if (m.costCents !== fee || m.levyCents !== levy || (levy > 0 && !content.policyRef) ||
        !noMetricsExcept(m, ['costCents', 'levyCents'])) throw new Error('SALE_SETTLED metrics or levy policy invalid');
  } else if (content.kind === 'TRANSFER') {
    if (content.movements.length !== 1 || content.movements[0].from !== cash(d, 'available') ||
        !/^domain:[a-z]+:cash:available$/.test(content.movements[0].to) ||
        content.movements[0].to === cash(d, 'available') || !content.policyRef || !noMetricsExcept(m, [])) {
      throw new Error('TRANSFER account geometry, policy, or metrics invalid');
    }
  } else if (content.kind === 'RESERVE') {
    requireOne(content, cash(d, 'available'), cash(d, 'reserved'));
    if (!content.policyRef || !noMetricsExcept(m, [])) throw new Error('RESERVE policy or metrics invalid');
  } else if (content.kind === 'RESERVE_RELEASE') {
    requireOne(content, cash(d, 'reserved'), cash(d, 'available'));
    if (!content.policyRef || !noMetricsExcept(m, [])) throw new Error('RESERVE_RELEASE policy or metrics invalid');
  } else if (content.kind === 'COMMIT') {
    requireOne(content, cash(d, 'available'), cash(d, 'committed'));
    if (!content.policyRef || !noMetricsExcept(m, [])) throw new Error('COMMIT policy or metrics invalid');
  } else if (content.kind === 'COMMIT_RELEASE') {
    requireOne(content, cash(d, 'committed'), cash(d, 'available'));
    if (!content.policyRef || !noMetricsExcept(m, [])) throw new Error('COMMIT_RELEASE policy or metrics invalid');
  } else if (content.kind === 'EXPENSE') {
    amount = requireOne(content, cash(d, 'available'), external('vendor'));
    if (!content.externalRef || m.costCents !== amount || !noMetricsExcept(m, ['costCents'])) throw new Error('EXPENSE evidence or metrics invalid');
  } else if (content.kind === 'REFUND') {
    if (content.movements.length !== 1 || [cash(d, 'available'), cash(d, 'pending')].indexOf(content.movements[0].from) < 0 ||
        content.movements[0].to !== external('customer') || !content.externalRef ||
        m.revenueDeltaCents !== -content.movements[0].amountCents || !noMetricsExcept(m, ['revenueDeltaCents'])) {
      throw new Error('REFUND account geometry, evidence, or metrics invalid');
    }
  } else if (content.kind === 'DISPUTE_HOLD') {
    requireOne(content, cash(d, 'available'), obligation(d, 'dispute'));
    if (!content.externalRef || !noMetricsExcept(m, [])) throw new Error('DISPUTE_HOLD evidence or metrics invalid');
  } else if (content.kind === 'DISPUTE_RELEASE') {
    requireOne(content, obligation(d, 'dispute'), cash(d, 'available'));
    if (!content.externalRef || !noMetricsExcept(m, [])) throw new Error('DISPUTE_RELEASE evidence or metrics invalid');
  } else if (content.kind === 'RECONCILIATION_ADJUSTMENT') {
    if (content.movements.length !== 1 || !content.externalRef || !content.reason || !noMetricsExcept(m, []) ||
        !((content.movements[0].from === external('reconciliation') && [cash(d, 'pending'), cash(d, 'available')].indexOf(content.movements[0].to) >= 0) ||
          (content.movements[0].to === external('reconciliation') && [cash(d, 'pending'), cash(d, 'available')].indexOf(content.movements[0].from) >= 0))) {
      throw new Error('RECONCILIATION_ADJUSTMENT geometry or evidence invalid');
    }
  }
  return content;
}
function build(spec, now) {
  spec = spec || {};
  var kind = String(spec.kind || '').toUpperCase();
  if (!KINDS.has(kind)) throw new Error('unknown treasury receipt kind');
  var idempotencyKey = String(spec.idempotencyKey || '').trim();
  if (!idempotencyKey || idempotencyKey.length > 300) throw new Error('treasury idempotencyKey required');
  var ownerDomain = domain(spec.ownerDomain);
  var currency = String(spec.currency || 'usd').toLowerCase();
  if (currency !== 'usd') throw new Error('treasury v1 supports usd only');
  var moves = (spec.movements || []).map(function (row) { return movement(row.from, row.to, row.amountCents); });
  if (!moves.length) throw new Error('treasury receipt requires at least one movement');
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var identity = digest({ idempotencyKey: idempotencyKey }).slice(0, 28);
  var content = {
    kind: kind, idempotencyKey: idempotencyKey, ownerDomain: ownerDomain,
    currency: currency, movements: moves, metrics: normalizeMetrics(spec.metrics),
    externalRef: spec.externalRef == null ? null : String(spec.externalRef),
    policyRef: spec.policyRef == null ? null : String(spec.policyRef),
    reason: spec.reason == null ? null : String(spec.reason)
  };
  validateContent(content);
  return Object.assign({
    schemaVersion: SCHEMA,
    receiptId: 'ctr_' + identity,
    contentDigest: digest(content),
    status: 'POSTED',
    recordedAt: new Date(at).toISOString(),
    recordedAtMs: at,
    accountingOnly: true,
    externalEffectExecuted: false,
    outboundMoneyAuthorized: false
  }, content);
}

function emptyDomain(d) {
  return {
    productDomain: d, availableCashCents: 0, pendingCashCents: 0,
    reservedCashCents: 0, committedCashCents: 0,
    recognizedRevenueCents: 0, costsCents: 0, obligationsCents: 0,
    statutoryTaxLiabilityCents: 0, disputeHoldCents: 0,
    civilizationLevyPaidCents: 0, contributionsCents: 0,
    capitalizationReceivedCents: 0, spendableCents: 0
  };
}
function apply(receipts) {
  var balances = Object.create(null);
  var domains = Object.create(null);
  DOMAINS.forEach(function (d) { domains[d] = emptyDomain(d); });
  var seen = new Set();
  (receipts || []).forEach(function (receipt) {
    if (!receipt || receipt.schemaVersion !== SCHEMA || receipt.status !== 'POSTED' || seen.has(receipt.receiptId)) return;
    seen.add(receipt.receiptId);
    receipt.movements.forEach(function (row) {
      balances[row.from] = (balances[row.from] || 0) - row.amountCents;
      balances[row.to] = (balances[row.to] || 0) + row.amountCents;
    });
    var d = domains[receipt.ownerDomain];
    if (d) {
      d.recognizedRevenueCents += receipt.metrics.revenueDeltaCents;
      d.costsCents += receipt.metrics.costCents;
      d.civilizationLevyPaidCents += receipt.metrics.levyCents;
      d.contributionsCents += receipt.metrics.contributionCents;
      d.capitalizationReceivedCents += receipt.metrics.capitalizationCents;
    }
  });
  DOMAINS.forEach(function (d) {
    var row = domains[d];
    row.availableCashCents = balances[cash(d, 'available')] || 0;
    row.pendingCashCents = balances[cash(d, 'pending')] || 0;
    row.reservedCashCents = balances[cash(d, 'reserved')] || 0;
    row.committedCashCents = balances[cash(d, 'committed')] || 0;
    row.statutoryTaxLiabilityCents = balances[obligation(d, 'statutory-tax')] || 0;
    row.disputeHoldCents = balances[obligation(d, 'dispute')] || 0;
    row.obligationsCents = row.statutoryTaxLiabilityCents + row.disputeHoldCents;
    row.spendableCents = Math.max(0, row.availableCashCents);
  });
  return { balances: balances, domains: domains, receiptCount: seen.size };
}
function protectedBalancesNonnegative(state) {
  for (var i = 0; i < DOMAINS.length; i++) {
    var row = state.domains[DOMAINS[i]];
    if (row.availableCashCents < 0 || row.pendingCashCents < 0 || row.reservedCashCents < 0 ||
        row.committedCashCents < 0 || row.statutoryTaxLiabilityCents < 0 || row.disputeHoldCents < 0) return false;
  }
  return true;
}
function assertStore(store) {
  if (!store || typeof store.assertDurable !== 'function' || typeof store.setIfAbsent !== 'function' ||
      typeof store.get !== 'function' || typeof store.set !== 'function' || typeof store.lpush !== 'function' ||
      typeof store.ltrim !== 'function' || typeof store.lrange !== 'function') throw new Error('strict durable treasury store required');
  store.assertDurable();
}
async function rows(store, cap) {
  assertStore(store);
  return store.lrange(LOG_KEY, 0, Math.max(1, Number(cap) || LOG_CAP) - 1);
}
async function project(store, cap) {
  var current = apply(await rows(store, cap));
  return {
    schemaVersion: PROJECTION_SCHEMA,
    generatedAt: new Date().toISOString(),
    currency: 'usd',
    domainCount: DOMAINS.length,
    receiptCount: current.receiptCount,
    accounts: DOMAINS.map(function (d) { return current.domains[d]; }),
    conserved: Object.keys(current.balances).reduce(function (sum, key) { return sum + current.balances[key]; }, 0) === 0,
    protectedBalancesNonnegative: protectedBalancesNonnegative(current),
    outboundMoneyAuthorized: OUTBOUND_MONEY_AUTHORIZED,
    blockers: ['external-balance-reconciliation-not-connected', 'atomic-spend-reservation-not-implemented', 'outbound-payment-adapter-not-authorized'],
    interpretation: 'accounting and reconciliation projection only; no payment or transfer authority'
  };
}
async function post(store, spec, now) {
  assertStore(store);
  var receipt = build(spec, now);
  var key = receiptKey(receipt.receiptId);
  var existing = await store.get(key);
  if (existing) {
    if (existing.contentDigest !== receipt.contentDigest) throw new Error('treasury idempotency conflict');
    if (existing.status === 'POSTED') return { ok: true, duplicate: true, receipt: existing };
  }
  var currentRows = await rows(store, LOG_CAP);
  var candidateState = apply([receipt].concat(currentRows));
  if (!protectedBalancesNonnegative(candidateState)) throw new Error('treasury posting would overdraw a protected domain account');
  if (!existing) {
    var claim = Object.assign({}, receipt, { status: 'CLAIMED' });
    var claimed = await store.setIfAbsent(key, claim);
    if (!claimed) {
      existing = await store.get(key);
      if (!existing || existing.contentDigest !== receipt.contentDigest) throw new Error('treasury idempotency conflict');
      if (existing.status === 'POSTED') return { ok: true, duplicate: true, receipt: existing };
    }
  }
  await store.lpush(LOG_KEY, receipt);
  await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
  await store.set(key, receipt);
  var restored = await store.get(key);
  if (!restored || restored.status !== 'POSTED' || restored.contentDigest !== receipt.contentDigest) {
    throw new Error('treasury receipt readback verification failed');
  }
  return { ok: true, duplicate: false, receipt: restored };
}

function contribution(d, amountCents, idempotencyKey, externalRef) {
  d = domain(d); amountCents = cents(amountCents, 'contribution amountCents', false);
  if (!externalRef) throw new Error('contribution externalRef required');
  return { kind: 'CONTRIBUTION', idempotencyKey: idempotencyKey, ownerDomain: d, externalRef: externalRef,
    movements: [movement(external('operator'), cash(d, 'available'), amountCents)],
    metrics: { contributionCents: amountCents } };
}
function capitalization(toDomain, amountCents, idempotencyKey, policyRef) {
  var to = domain(toDomain); amountCents = cents(amountCents, 'capitalization amountCents', false);
  if (to === 'finance') throw new Error('Finance cannot capitalize itself');
  if (!policyRef) throw new Error('capitalization policyRef required');
  return { kind: 'CAPITALIZATION', idempotencyKey: idempotencyKey, ownerDomain: to, policyRef: policyRef,
    movements: [movement(cash('finance', 'available'), cash(to, 'available'), amountCents)],
    metrics: { capitalizationCents: amountCents } };
}
function saleCaptured(d, grossCents, idempotencyKey, stripeEventId) {
  d = domain(d); grossCents = cents(grossCents, 'sale grossCents', false);
  if (!stripeEventId) throw new Error('sale Stripe event id required');
  return { kind: 'SALE_CAPTURED', idempotencyKey: idempotencyKey, ownerDomain: d, externalRef: stripeEventId,
    movements: [movement(external('stripe-clearing'), cash(d, 'pending'), grossCents)],
    metrics: { revenueDeltaCents: grossCents } };
}
function saleSettled(d, amounts, idempotencyKey, stripeBalanceRef, levyPolicyRef) {
  d = domain(d); amounts = amounts || {};
  var gross = cents(amounts.grossCents, 'settlement grossCents', false);
  var fee = cents(amounts.feeCents || 0, 'settlement feeCents', true);
  var tax = cents(amounts.statutoryTaxCents || 0, 'settlement statutoryTaxCents', true);
  var levy = cents(amounts.levyCents || 0, 'settlement levyCents', true);
  var net = cents(amounts.netCents, 'settlement netCents', true);
  if (fee + tax + levy + net !== gross) throw new Error('settlement components must equal grossCents exactly');
  if (!stripeBalanceRef) throw new Error('settlement Stripe balance reference required');
  if (levy > 0 && !levyPolicyRef) throw new Error('nonzero civilization levy requires policyRef');
  var moves = [];
  if (net) moves.push(movement(cash(d, 'pending'), cash(d, 'available'), net));
  if (fee) moves.push(movement(cash(d, 'pending'), external('stripe-fees'), fee));
  if (tax) moves.push(movement(cash(d, 'pending'), obligation(d, 'statutory-tax'), tax));
  if (levy) moves.push(movement(cash(d, 'pending'), cash('finance', 'available'), levy));
  return { kind: 'SALE_SETTLED', idempotencyKey: idempotencyKey, ownerDomain: d,
    externalRef: stripeBalanceRef, policyRef: levyPolicyRef || null, movements: moves,
    metrics: { costCents: fee, levyCents: levy } };
}
function transfer(fromDomain, toDomain, amountCents, idempotencyKey, policyRef) {
  var from = domain(fromDomain), to = domain(toDomain);
  amountCents = cents(amountCents, 'transfer amountCents', false);
  if (from === to) throw new Error('treasury transfer requires distinct domains');
  if (!policyRef) throw new Error('treasury transfer policyRef required');
  return { kind: 'TRANSFER', idempotencyKey: idempotencyKey, ownerDomain: from, policyRef: policyRef,
    movements: [movement(cash(from, 'available'), cash(to, 'available'), amountCents)] };
}
function bucketMove(kind, d, fromBucket, toBucket, amountCents, idempotencyKey, policyRef) {
  d = domain(d); amountCents = cents(amountCents, kind + ' amountCents', false);
  if (!policyRef) throw new Error(kind + ' policyRef required');
  return { kind: kind, idempotencyKey: idempotencyKey, ownerDomain: d, policyRef: policyRef,
    movements: [movement(cash(d, fromBucket), cash(d, toBucket), amountCents)] };
}
function reserve(d, amountCents, idempotencyKey, policyRef) { return bucketMove('RESERVE', d, 'available', 'reserved', amountCents, idempotencyKey, policyRef); }
function releaseReserve(d, amountCents, idempotencyKey, policyRef) { return bucketMove('RESERVE_RELEASE', d, 'reserved', 'available', amountCents, idempotencyKey, policyRef); }
function commit(d, amountCents, idempotencyKey, policyRef) { return bucketMove('COMMIT', d, 'available', 'committed', amountCents, idempotencyKey, policyRef); }
function releaseCommit(d, amountCents, idempotencyKey, policyRef) { return bucketMove('COMMIT_RELEASE', d, 'committed', 'available', amountCents, idempotencyKey, policyRef); }
function expense(d, amountCents, idempotencyKey, externalRef) {
  d = domain(d); amountCents = cents(amountCents, 'expense amountCents', false);
  if (!externalRef) throw new Error('expense externalRef required');
  return { kind: 'EXPENSE', idempotencyKey: idempotencyKey, ownerDomain: d, externalRef: externalRef,
    movements: [movement(cash(d, 'available'), external('vendor'), amountCents)], metrics: { costCents: amountCents } };
}
function refund(d, sourceBucket, amountCents, idempotencyKey, externalRef) {
  d = domain(d); amountCents = cents(amountCents, 'refund amountCents', false);
  if (sourceBucket !== 'available' && sourceBucket !== 'pending') throw new Error('refund source bucket invalid');
  if (!externalRef) throw new Error('refund externalRef required');
  return { kind: 'REFUND', idempotencyKey: idempotencyKey, ownerDomain: d, externalRef: externalRef,
    movements: [movement(cash(d, sourceBucket), external('customer'), amountCents)], metrics: { revenueDeltaCents: -amountCents } };
}
function dispute(d, release, amountCents, idempotencyKey, externalRef) {
  d = domain(d); amountCents = cents(amountCents, 'dispute amountCents', false);
  if (!externalRef) throw new Error('dispute externalRef required');
  return { kind: release ? 'DISPUTE_RELEASE' : 'DISPUTE_HOLD', idempotencyKey: idempotencyKey,
    ownerDomain: d, externalRef: externalRef, movements: [release
      ? movement(obligation(d, 'dispute'), cash(d, 'available'), amountCents)
      : movement(cash(d, 'available'), obligation(d, 'dispute'), amountCents)] };
}
function reconciliation(d, bucket, signedAmountCents, idempotencyKey, externalRef, reason) {
  d = domain(d); bucket = String(bucket || '');
  if (bucket !== 'available' && bucket !== 'pending') throw new Error('reconciliation bucket invalid');
  var signed = Number(signedAmountCents);
  if (!Number.isSafeInteger(signed) || signed === 0) throw new Error('reconciliation signedAmountCents must be a nonzero integer');
  if (!externalRef || !reason) throw new Error('reconciliation externalRef and reason required');
  var amount = Math.abs(signed);
  return { kind: 'RECONCILIATION_ADJUSTMENT', idempotencyKey: idempotencyKey, ownerDomain: d,
    externalRef: externalRef, reason: reason, movements: [signed > 0
      ? movement(external('reconciliation'), cash(d, bucket), amount)
      : movement(cash(d, bucket), external('reconciliation'), amount)] };
}

module.exports = {
  SCHEMA: SCHEMA, PROJECTION_SCHEMA: PROJECTION_SCHEMA, LOG_KEY: LOG_KEY, LOG_CAP: LOG_CAP,
  DOMAINS: DOMAINS, OUTBOUND_MONEY_AUTHORIZED: OUTBOUND_MONEY_AUTHORIZED,
  cash: cash, obligation: obligation, external: external, movement: movement,
  receiptKey: receiptKey, build: build, apply: apply, rows: rows, project: project, post: post,
  contribution: contribution, capitalization: capitalization, saleCaptured: saleCaptured,
  saleSettled: saleSettled, transfer: transfer, reserve: reserve, releaseReserve: releaseReserve,
  commit: commit, releaseCommit: releaseCommit, expense: expense, refund: refund,
  dispute: dispute, reconciliation: reconciliation
};
