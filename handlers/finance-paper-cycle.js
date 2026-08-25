'use strict';

/**
 * Cron-authenticated Finance paper loop.
 *
 * Runs after each cognition refresh and advances only the current durable
 * Finance packet. Every stage remains independently one-shot/idempotent. The
 * loop stops on any abstention or held gate; only a released paper intent can
 * reach the Tradier sandbox executor. Live brokerage is not imported here and
 * remains unreachable through the hardcoded sandbox transport.
 */

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Preview = require('../lib/finance-preview-execution.js');
var PreviewProvider = require('../lib/finance-preview-provider.js');
var Admission = require('../lib/finance-paper-admission.js');
var Decision = require('../lib/finance-trade-decision.js');
var DecisionProvider = require('../lib/finance-trade-decision-provider.js');
var Broker = require('../lib/tradier-sandbox.js');
var Executor = require('../lib/finance-paper-executor.js');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function summary(stage, packetId, receipt, extra) {
  return Object.assign({
    ok: true,
    stage: stage,
    packetId: packetId || null,
    status: receipt && receipt.status || null,
    reason: receipt && receipt.reason || null,
    paperOnly: true,
    liveMoney: false
  }, extra || {});
}

function createHandler(deps) {
  deps = deps || {};
  var cronAuth = deps.cronAuth || CronAuth;
  var store = deps.store || Store;
  var preview = deps.preview || Preview;
  var previewProvider = deps.previewProvider || PreviewProvider;
  var admission = deps.admission || Admission;
  var decision = deps.decision || Decision;
  var decisionProvider = deps.decisionProvider || DecisionProvider;
  var broker = deps.broker || Broker;
  var executor = deps.executor || Executor;
  var env = deps.env || process.env;
  var fetchFn = deps.fetch || global.fetch;

  return async function handler(req, res) {
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      return send(res, 405, { ok: false, error: 'cron GET only' });
    }
    if (!cronAuth.enforce(req, res)) return;
    try {
      store.assertDurable();
      if (!previewProvider.enabled(env) || !decisionProvider.enabled(env)) {
        return send(res, 200, summary('switch-gate', null, null, {
          status: 'HELD',
          reason: !previewProvider.enabled(env) ? 'finance-preview-switch-off' : 'finance-trade-decision-switch-off',
          orderPlaced: false
        }));
      }
      if (!env.ANTHROPIC_API_KEY || !broker.configured()) {
        return send(res, 200, summary('configuration-gate', null, null, {
          status: 'HELD',
          reason: !env.ANTHROPIC_API_KEY ? 'finance-provider-unconfigured' : 'tradier-sandbox-unconfigured',
          orderPlaced: false
        }));
      }

      var bundle = await preview.productionInput({
        fetch: fetchFn,
        origin: env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com',
        token: env.BRAIN_SHADOW_TOKEN || ''
      });
      var audit = preview.audit(bundle);
      var packetId = audit.packetId;
      if (audit.status !== 'READY_FOR_MANAGER_REVIEW' || !packetId) {
        return send(res, 200, summary('preview-readiness', packetId, null, {
          status: 'HELD', reason: 'finance-preview-inputs-not-ready', blockers: audit.blockers || {}, orderPlaced: false
        }));
      }

      var previewReceipt = await store.get(preview.receiptKey(packetId));
      if (!previewReceipt) {
        var previewResult = await preview.execute(store, bundle, { approve: true, packetId: packetId }, {
          providerOptions: { env: env, fetch: fetchFn }
        });
        previewReceipt = previewResult && previewResult.receipt;
      }
      if (!previewReceipt || previewReceipt.status !== 'PAPER_CANDIDATE') {
        return send(res, 200, summary('manager-preview', packetId, previewReceipt, {
          orderPlaced: false,
          providerCalled: !!(previewReceipt && previewReceipt.providerCalled),
          selectedCompany: previewReceipt && previewReceipt.selectedCompany || null
        }));
      }

      var admissionResult = await admission.execute(store, { approve: true, packetId: packetId });
      var admissionReceipt = admissionResult && admissionResult.receipt;
      if (!admissionReceipt || admissionReceipt.status !== 'ADMITTED_TO_PAPER') {
        return send(res, 200, summary('paper-admission', packetId, admissionReceipt, { orderPlaced: false }));
      }

      var decisionResult = await decision.execute(store, broker, { approve: true, packetId: packetId }, {
        env: env, fetch: fetchFn
      });
      var decisionReceipt = decisionResult && decisionResult.receipt;
      if (!decisionReceipt || decisionReceipt.status !== 'TRADE_INTENT_SELECTED') {
        return send(res, 200, summary('trade-decision', packetId, decisionReceipt, {
          orderPlaced: false,
          providerCalled: !!(decisionReceipt && decisionReceipt.providerCalled),
          action: decisionReceipt && decisionReceipt.proposal && decisionReceipt.proposal.action || null
        }));
      }

      var execution = await executor.execute({ store: store, broker: broker, packetId: packetId, env: env });
      return send(res, 200, summary('paper-execution', packetId, execution, {
        status: execution.status,
        reason: execution.reason || null,
        orderPlaced: execution.orderPlaced === true,
        commandId: execution.command && execution.command.commandId || execution.claim && execution.claim.commandId || null,
        orderId: execution.claim && execution.claim.orderId || null
      }));
    } catch (error) {
      return send(res, 503, {
        ok: false,
        status: 'CYCLE_UNRESOLVED',
        error: error && error.message || String(error),
        errorCode: error && error.code || 'FINANCE_PAPER_CYCLE_FAILED',
        paperOnly: true,
        orderPlaced: false,
        liveMoney: false
      });
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
module.exports = handler;
