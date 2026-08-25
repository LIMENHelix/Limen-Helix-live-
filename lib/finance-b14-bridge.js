'use strict';

/**
 * Finance release -> Tradier B14 bridge.
 *
 * A Finance release is an authorization to prepare an investment artifact. It
 * is not a trade. This bridge therefore requires an explicit trade intent and
 * preserves the release identity into the B14 preview. No symbol, side,
 * quantity, price, or risk limit is inferred from stress, headlines, or a
 * company record.
 */

var B14 = require('./tradier-b14');

function enabled(value) { return value === '1' || value === 'true' || value === 'TRUE'; }
function state(env) {
  env = env || process.env;
  return {
    previewAutonomyEnabled: enabled(env.TRADIER_SANDBOX_AUTONOMY_ENABLED),
    orderAutonomyEnabled: enabled(env.TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED),
    executionEnvironment: 'sandbox',
    productionReachable: false
  };
}

function fail(code, message) {
  var err = new Error(message);
  err.code = code;
  throw err;
}

function releaseIdentity(selection) {
  if (!selection || selection.status !== 'RELEASED') fail('FINANCE_B14_RELEASE_NOT_RELEASED', 'Finance selection is not RELEASED');
  if (selection.lane !== 'investment' || selection.ownerDomain !== 'finance' ||
      ['generate_investment_artifact', 'prepare_tradier_sandbox_order'].indexOf(selection.command) < 0) {
    fail('FINANCE_B14_NOT_FINANCE_RELEASE', 'only a released Finance investment selection may enter this bridge');
  }
  var authority = selection.authority || {};
  if (authority.stressDirectlyTriggered === true || authority.headlineDirectlyTriggered === true) {
    fail('FINANCE_B14_UNSUPPORTED_TRIGGER', 'stress and headlines cannot directly authorize a trade');
  }
  var source = selection.candidate && selection.candidate.sourceIdentity;
  if (!source || !source.value) fail('FINANCE_B14_MISSING_SOURCE_IDENTITY', 'the release must carry a source-supplied identity');
  if (!selection.id) fail('FINANCE_B14_MISSING_SELECTION_ID', 'selection id is required');
  return { selectionId: String(selection.id), sourceIdentity: source, authority: authority };
}

function intentFor(selection, tradeIntent) {
  var identity = releaseIdentity(selection);
  tradeIntent = tradeIntent || {};
  var sourceArtifactId = tradeIntent.sourceArtifactId || identity.sourceIdentity.value;
  if (!sourceArtifactId) fail('FINANCE_B14_MISSING_ARTIFACT_ID', 'trade intent needs a source artifact identity');
  var composed = Object.assign({}, tradeIntent, {
    sourceArtifactId: String(sourceArtifactId),
    selectionId: identity.selectionId,
    ownerDomain: 'finance',
    actionId: selection.criticDecision && selection.criticDecision.released
      ? (selection.criticDecision.released.id || null) : null,
    decisionContext: {
      selectionId: identity.selectionId,
      sourceIdentity: identity.sourceIdentity,
      releaseAt: selection.at,
      cycleEvidence: selection.evidence || null,
      authority: identity.authority
    }
  });
  // Reuse the B14 boundary validator here so a bridge caller cannot create an
  // apparently valid release with a malformed horizon or order envelope.
  return B14.normalizeIntent(composed);
}

async function preview(store, broker, selection, tradeIntent, env, now) {
  var switches = state(env);
  var identity = releaseIdentity(selection);
  if (!switches.previewAutonomyEnabled) {
    return { ok: true, status: 'HELD', reason: 'sandbox-autonomy-switch-off', selectionId: identity.selectionId, switches: switches };
  }
  var intent = intentFor(selection, tradeIntent);
  var record = await B14.createPreview(store, broker, intent, now);
  return {
    ok: true,
    status: 'PREVIEWED',
    orderPlaced: false,
    selectionId: identity.selectionId,
    switches: switches,
    preview: record
  };
}

function executionReadiness(selection, env) {
  var switches = state(env);
  var identity = releaseIdentity(selection);
  var reasons = [];
  if (!switches.orderAutonomyEnabled) reasons.push('order-autonomy-switch-off');
  if (identity.authority.tradierSandboxOrderAutomation !== true) reasons.push('selection-does-not-authorize-sandbox-order-automation');
  return { ready: reasons.length === 0, reasons: reasons, switches: switches, selectionId: identity.selectionId };
}

module.exports = {
  state: state,
  releaseIdentity: releaseIdentity,
  intentFor: intentFor,
  preview: preview,
  executionReadiness: executionReadiness
};
