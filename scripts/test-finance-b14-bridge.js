'use strict';

var bridge = require('../lib/finance-b14-bridge');
var Decision = require('../lib/finance-trade-decision');

var checks = 0;
function assert(name, condition) {
  checks++;
  if (!condition) throw new Error('FAIL ' + checks + ': ' + name);
  console.log('PASS ' + name);
}

function store() {
  var values = new Map();
  return {
    values: values,
    assertDurable: function () { return true; },
    get: async function (key) { return values.has(key) ? values.get(key) : null; },
    set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
    setIfAbsent: async function (key, value) { if (values.has(key)) return false; values.set(key, JSON.parse(JSON.stringify(value))); return true; },
    lpush: async function () { return 1; },
    ltrim: async function () { return true; }
  };
}

function broker() {
  var calls = [];
  return {
    calls: calls,
    accountSnapshot: async function () { calls.push('account'); return { accountId: 'VA60523798', accountType: 'margin', totalCash: 1000, pendingCash: 0, unclearedFunds: 0, totalEquity: 1000, positions: [], orders: [] }; },
    previewOrder: async function (request) { calls.push('preview'); return { status: 'ok', result: true, cost: 501, commission: 1, fees: 0, request: request }; },
    placeOrder: async function () { calls.push('place'); throw new Error('must not place in bridge preview'); }
  };
}

function release(overrides) {
  return Object.assign({
    id: 'sel_finance_1', status: 'RELEASED', lane: 'investment', ownerDomain: 'finance',
    command: 'generate_investment_artifact', at: 100,
    candidate: { sourceIdentity: { kind: 'master-inbox-artifact', value: 'investment:apple:artifact-1' } },
    criticDecision: { released: { id: 'cand-action-1' } },
    evidence: { domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } },
    authority: { artifactGenerationOnly: true, liveTradingAuthorized: false, stressDirectlyTriggered: false, headlineDirectlyTriggered: false }
  }, overrides || {});
}

var intent = { symbol: 'SPY', side: 'buy', quantity: 1, limitPrice: 500, maxNotionalUsd: 510, horizonDays: [30, 60, 90] };

function decisionReceipt(packetId, overrides) {
  return Object.assign({
    schemaVersion: Decision.RECEIPT_SCHEMA,
    packetId: packetId,
    status: 'TRADE_INTENT_SELECTED',
    selection: release({ command: 'prepare_tradier_sandbox_order' }),
    tradeIntent: intent,
    safety: { brokerReadOnly: true, orderPreviewed: false, orderPlaced: false, paperOnly: true, liveMoney: false }
  }, overrides || {});
}

async function rejected(fn) {
  try { await fn(); return null; } catch (err) { return err; }
}

async function main() {
  assert('the switch is fail-closed by default', bridge.state({}).previewAutonomyEnabled === false && bridge.state({}).orderAutonomyEnabled === false);
  assert('the preview switch accepts only explicit enable values', bridge.state({ TRADIER_SANDBOX_AUTONOMY_ENABLED: '1' }).previewAutonomyEnabled === true && bridge.state({ TRADIER_SANDBOX_AUTONOMY_ENABLED: 'yes' }).previewAutonomyEnabled === false);
  assert('a held selection cannot enter the bridge', (await rejected(function () { return bridge.releaseIdentity(release({ status: 'HELD' })); })).code === 'FINANCE_B14_RELEASE_NOT_RELEASED');
  assert('a non-Finance release cannot enter the investment bridge', (await rejected(function () { return bridge.releaseIdentity(release({ ownerDomain: 'economy' })); })).code === 'FINANCE_B14_NOT_FINANCE_RELEASE');
  assert('stress cannot directly authorize a trade', (await rejected(function () { return bridge.releaseIdentity(release({ authority: { stressDirectlyTriggered: true } })); })).code === 'FINANCE_B14_UNSUPPORTED_TRIGGER');
  assert('source identity is mandatory', (await rejected(function () { return bridge.releaseIdentity(release({ candidate: {} })); })).code === 'FINANCE_B14_MISSING_SOURCE_IDENTITY');
  assert('a B10-selected sandbox motor decision may enter the preview bridge', bridge.releaseIdentity(release({ command: 'prepare_tradier_sandbox_order' })).selectionId === 'sel_finance_1');

  var built = bridge.intentFor(release(), intent);
  assert('intent preserves the released selection identity', built.selectionId === 'sel_finance_1' && built.sourceArtifactId === 'investment:apple:artifact-1');
  assert('intent carries the critic action identity and Finance owner', built.actionId === 'cand-action-1' && built.ownerDomain === 'finance');
  assert('intent preserves decision context without inventing market fields', built.decisionContext.sourceIdentity.value === 'investment:apple:artifact-1' && built.decisionContext.authority.liveTradingAuthorized === false);
  assert('arbitrary horizons are rejected', (await rejected(function () { return bridge.intentFor(release(), Object.assign({}, intent, { horizonDays: [7] })); })).code === 'TRADIER_B14_INVALID_HORIZONS');

  var offStore = store();
  var offBroker = broker();
  var held = await bridge.preview(offStore, offBroker, release(), intent, {});
  assert('switch off holds before touching Redis or Tradier', held.status === 'HELD' && held.reason === 'sandbox-autonomy-switch-off' && offBroker.calls.length === 0 && offStore.values.size === 0);

  var onStore = store();
  var onBroker = broker();
  var preview = await bridge.preview(onStore, onBroker, release(), intent, { TRADIER_SANDBOX_AUTONOMY_ENABLED: '1' }, 1000);
  assert('switch on creates a broker preview but no order', preview.status === 'PREVIEWED' && preview.orderPlaced === false && onBroker.calls.join(',') === 'account,preview');
  assert('preview carries Finance release provenance into B14', preview.preview.intent.selectionId === 'sel_finance_1' && preview.preview.intent.actionId === 'cand-action-1' && preview.preview.intent.ownerDomain === 'finance');
  assert('preview retains source artifact identity', preview.preview.intent.sourceArtifactId === 'investment:apple:artifact-1');

  var noAuthority = bridge.executionReadiness(release(), { TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED: '1' });
  assert('order switch alone cannot bypass release authority', noAuthority.ready === false && noAuthority.reasons.indexOf('selection-does-not-authorize-sandbox-order-automation') >= 0);
  var authorized = bridge.executionReadiness(release({ authority: { tradierSandboxOrderAutomation: true } }), { TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED: '1' });
  assert('the readiness contract reports when both explicit gates are present', authorized.ready === true && authorized.reasons.length === 0);

  var receiptStore = store();
  var receiptBroker = broker();
  var missing = await bridge.previewDecision(receiptStore, receiptBroker, 'packet-missing', { TRADIER_SANDBOX_AUTONOMY_ENABLED: '1' });
  assert('a missing durable Finance decision holds before broker access', missing.status === 'HELD' && missing.reason === 'finance-decision-receipt-missing' && receiptBroker.calls.length === 0);

  await receiptStore.set(Decision.key('packet-abstain'), decisionReceipt('packet-abstain', { status: 'ABSTAINED', selection: null, tradeIntent: null }));
  var abstained = await bridge.previewDecision(receiptStore, receiptBroker, 'packet-abstain', { TRADIER_SANDBOX_AUTONOMY_ENABLED: '1' });
  assert('an abstained Finance decision cannot be converted into a B14 preview', abstained.status === 'HELD' && abstained.reason === 'finance-decision-abstained' && receiptBroker.calls.length === 0);

  await receiptStore.set(Decision.key('packet-selected'), decisionReceipt('packet-selected'));
  var fromReceipt = await bridge.previewDecision(receiptStore, receiptBroker, 'packet-selected', { TRADIER_SANDBOX_AUTONOMY_ENABLED: '1' }, 2000);
  assert('B14 preview reads the durable B10 selection and intent by packet identity', fromReceipt.status === 'PREVIEWED' && fromReceipt.packetId === 'packet-selected' && fromReceipt.preview.intent.selectionId === 'sel_finance_1');
  assert('receipt-backed preview still touches only account and broker preview', receiptBroker.calls.join(',') === 'account,preview');

  console.log('\n' + checks + '/' + checks + ' passed');
}

main().catch(function (err) { console.error(err && err.stack || err); process.exit(1); });
