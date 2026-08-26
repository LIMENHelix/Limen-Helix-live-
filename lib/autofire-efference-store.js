/**
 * Strict Redis store for research/investment motor and efference boundaries.
 *
 * This deliberately does not use lib/limen-db. That module keeps public pages
 * available by falling back to process memory, which is useful for display data
 * and fatal for the claim made here: the command copy must survive the serverless
 * process that dispatched the provider request.
 *
 * Only the explicitly enumerated actuator/recovery namespaces below are addressable. Missing credentials,
 * transport failures, non-2xx responses, Redis errors, malformed replies, and
 * unexpected result shapes all throw. There is no memory fallback.
 */

'use strict';

var NAMESPACE_PREFIX = 'limen:';
var EXACT_KEYS = {
  autofire_efference_log: true,
  autofire_efference_pending_log: true,
  autofire_selection_log: true,
  autofire_learning_outcome_log: true,
  finance_preview_log: true,
  finance_paper_admission_log: true,
  finance_trade_decision_log: true,
  finance_paper_execution_log: true,
  finance_sandbox_commissioning: true,
  tradier_b14_log: true,
  tradier_b14_active_commands: true,
  product_domain_motor_receipt_log: true,
  research_evaluation_input_log: true,
  research_artifact_recovery_log: true,
  research_paper_developmental_log: true,
  communication_social_command_log: true,
  communication_social_decision_log: true,
  communication_social_pending_log: true,
  communication_social_recovery_log: true,
  communication_social_observation_log: true,
  culture_hero_decision_log: true,
  culture_hero_command_log: true,
  culture_hero_pending_log: true,
  culture_hero_observation_log: true,
  culture_hero_recovery_log: true,
  culture_hero_suppression_catalog: true,
  'hero:img:v1': true,
  'hero:img:count:v1': true,
  religion_subscriber_decision_log: true,
  religion_subscriber_command_log: true,
  religion_subscriber_pending_log: true,
  religion_subscriber_observation_log: true,
  religion_subscriber_recovery_log: true,
  religion_subscriber_suppression_catalog: true,
  religion_subscriber_learning_state: true,
  religion_revenue_fulfillment_pending: true,
  law_automail_decision_log: true,
  law_automail_command_log: true,
  law_automail_pending_log: true,
  law_automail_observation_log: true,
  law_automail_recovery_log: true,
  intelligence_autopilot_decision_log: true,
  intelligence_autopilot_command_log: true,
  intelligence_autopilot_pending_log: true,
  intelligence_autopilot_observation_log: true,
  intelligence_autopilot_recovery_log: true,
  intelligence_autopilot_suppression_catalog: true,
  intelligence_autopilot_learning_state: true,
  agriculture_homestead_worklist: true,
  agriculture_homestead_decision_log: true,
  agriculture_homestead_command_log: true,
  agriculture_homestead_pending_log: true,
  agriculture_homestead_observation_log: true,
  agriculture_homestead_recovery_log: true,
  agriculture_homestead_suppression_catalog: true,
  agriculture_homestead_learning_state: true,
  industry_crm_worklist: true,
  industry_crm_decision_log: true,
  industry_crm_command_log: true,
  industry_crm_pending_log: true,
  industry_crm_observation_log: true,
  industry_crm_recovery_log: true,
  industry_crm_suppression_catalog: true,
  industry_crm_learning_state: true,
  defense_publication_decision_log: true,
  defense_publication_command_log: true,
  defense_publication_pending_log: true,
  defense_publication_public_index: true,
  defense_publication_engagement_log: true,
  defense_publication_observation_log: true,
  defense_publication_recovery_log: true,
  defense_publication_suppression_catalog: true,
  defense_publication_learning_state: true,
  governance_publication_decision_log: true,
  governance_publication_command_log: true,
  governance_publication_pending_log: true,
  governance_publication_public_index: true,
  governance_publication_engagement_log: true,
  governance_publication_observation_log: true,
  governance_publication_recovery_log: true,
  governance_publication_suppression_catalog: true,
  governance_publication_learning_state: true,
  infrastructure_real_estate_worklist: true,
  infrastructure_real_estate_decision_log: true,
  infrastructure_real_estate_command_log: true,
  infrastructure_real_estate_pending_log: true,
  infrastructure_real_estate_observation_log: true,
  infrastructure_real_estate_recovery_log: true,
  infrastructure_real_estate_suppression_catalog: true,
  infrastructure_real_estate_learning_state: true,
  population_real_estate_worklist: true,
  population_real_estate_decision_log: true,
  population_real_estate_command_log: true,
  population_real_estate_pending_log: true,
  population_real_estate_observation_log: true,
  population_real_estate_recovery_log: true,
  population_real_estate_suppression_catalog: true,
  population_real_estate_learning_state: true,
  'crm:worklist': true,
  'subs:v1': true,
  engine_output_log: true
};
var PREFIXES = [
  'autofire_efference:',
  'autofire_forward_model:',
  'autofire_efference_pending:',
  'autofire_selection:',
  'autofire_learning_state:',
  'autofire_learning_cause:',
  'finance_preview:',
  'finance_paper_admission:',
  'finance_trade_decision:',
  'finance_paper_execution_claim:',
  'finance_paper_developmental_slot:',
  'tradier_b14_preview:',
  'tradier_b14_command:',
  'tradier_b14_claim:',
  'tradier_investment_observation:',
  'product_domain_motor_receipt:',
  'product_domain_motor_capability:',
  'research_evaluation_input:',
  'research_artifact_recovery:',
  'research_paper_developmental_slot:',
  'communication_social_command:',
  'communication_social_decision:',
  'communication_social_motor_claim:',
  'communication_social_recovery:',
  'communication_social_observation:',
  'culture_hero_decision:',
  'culture_hero_motor_claim:',
  'culture_hero_command:',
  'culture_hero_observation:',
  'culture_hero_recovery:',
  'religion_subscriber_decision:',
  'religion_subscriber_motor_claim:',
  'religion_subscriber_command:',
  'religion_subscriber_action:',
  'religion_subscriber_observation:',
  'religion_subscriber_recovery:',
  'religion_subscriber_learning_cause:',
  'religion_subscriber_budget_slot:',
  'religion_revenue_fulfillment:',
  'law_automail_decision:',
  'law_automail_command:',
  'law_automail_action:',
  'law_automail_motor_claim:',
  'law_automail_budget_slot:',
  'law_automail_observation:',
  'law_automail_recovery:',
  'intelligence_autopilot_decision:',
  'intelligence_autopilot_command:',
  'intelligence_autopilot_action:',
  'intelligence_autopilot_motor_claim:',
  'intelligence_autopilot_observation:',
  'intelligence_autopilot_recovery:',
  'intelligence_autopilot_learning_cause:',
  'intelligence_autopilot_budget_slot:',
  'agriculture_homestead_task:',
  'agriculture_homestead_decision:',
  'agriculture_homestead_command:',
  'agriculture_homestead_action:',
  'agriculture_homestead_motor_claim:',
  'agriculture_homestead_budget_slot:',
  'agriculture_homestead_observation:',
  'agriculture_homestead_recovery:',
  'agriculture_homestead_learning_cause:',
  'industry_crm_task:',
  'industry_crm_decision:',
  'industry_crm_command:',
  'industry_crm_action:',
  'industry_crm_motor_claim:',
  'industry_crm_budget_slot:',
  'industry_crm_observation:',
  'industry_crm_recovery:',
  'industry_crm_learning_cause:',
  'defense_publication_decision:',
  'defense_publication_command:',
  'defense_publication_action:',
  'defense_publication_motor_claim:',
  'defense_publication_budget_slot:',
  'defense_publication_article:',
  'defense_publication_engagement:',
  'defense_publication_observation:',
  'defense_publication_recovery:',
  'defense_publication_learning_cause:',
  'governance_publication_decision:',
  'governance_publication_command:',
  'governance_publication_action:',
  'governance_publication_motor_claim:',
  'governance_publication_budget_slot:',
  'governance_publication_article:',
  'governance_publication_engagement:',
  'governance_publication_observation:',
  'governance_publication_recovery:',
  'governance_publication_learning_cause:',
  'infrastructure_real_estate_task:',
  'infrastructure_real_estate_decision:',
  'infrastructure_real_estate_command:',
  'infrastructure_real_estate_action:',
  'infrastructure_real_estate_motor_claim:',
  'infrastructure_real_estate_budget_slot:',
  'infrastructure_real_estate_observation:',
  'infrastructure_real_estate_recovery:',
  'infrastructure_real_estate_learning_cause:',
  'population_real_estate_task:',
  'population_real_estate_decision:',
  'population_real_estate_command:',
  'population_real_estate_action:',
  'population_real_estate_motor_claim:',
  'population_real_estate_budget_slot:',
  'population_real_estate_observation:',
  'population_real_estate_recovery:',
  'population_real_estate_learning_cause:',
  'crm:state:',
  'engine_output:'
];

function assertKey(key) {
  if (typeof key !== 'string' || !key) {
    throw new Error('autofire efference store: key must be a non-empty string');
  }
  if (EXACT_KEYS[key]) return key;
  for (var i = 0; i < PREFIXES.length; i++) {
    if (key.indexOf(PREFIXES[i]) === 0 && key.length > PREFIXES[i].length) return key;
  }
  throw new Error('autofire efference store: refusing key outside the actuator namespace: ' + key);
}

function credentials() {
  var url = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('autofire efference store: Redis is not configured; refusing process-memory persistence');
  }
  return { url: url, token: token };
}

async function command(method, args) {
  var cred = credentials();
  var response;
  try {
    response = await fetch(cred.url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cred.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([method].concat(args || []))
    });
  } catch (err) {
    throw new Error('autofire efference store: ' + method + ' transport failed: ' +
      ((err && err.message) || String(err)));
  }
  if (!response || typeof response.status !== 'number' ||
      response.status < 200 || response.status >= 300) {
    throw new Error('autofire efference store: ' + method + ' returned HTTP ' +
      (response && response.status));
  }

  var text;
  try { text = await response.text(); }
  catch (err) {
    throw new Error('autofire efference store: ' + method + ' response body unreadable: ' + err.message);
  }
  var data;
  try { data = JSON.parse(text); }
  catch (_) {
    throw new Error('autofire efference store: ' + method + ' returned non-JSON');
  }
  if (data && data.error) {
    throw new Error('autofire efference store: ' + method + ' rejected by Redis: ' + data.error);
  }
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'result')) {
    throw new Error('autofire efference store: ' + method + ' returned no result field');
  }
  return data.result;
}

function physicalKey(key) { return NAMESPACE_PREFIX + assertKey(key); }

function assertDurable() {
  credentials();
  return true;
}

async function get(key) {
  var result = await command('GET', [physicalKey(key)]);
  if (result === null || result === undefined) return null;
  if (typeof result !== 'string') {
    throw new Error('autofire efference store: GET returned a non-string value');
  }
  try { return JSON.parse(result); }
  catch (_) { throw new Error('autofire efference store: GET returned invalid JSON'); }
}

async function set(key, value, ttlSeconds) {
  var args = [physicalKey(key), JSON.stringify(value)];
  if (ttlSeconds) args.push('EX', String(ttlSeconds));
  var result = await command('SET', args);
  if (result !== 'OK') {
    throw new Error('autofire efference store: SET returned ' + JSON.stringify(result) + ', expected "OK"');
  }
  return true;
}

async function setIfAbsent(key, value, ttlSeconds) {
  var args = [physicalKey(key), JSON.stringify(value), 'NX'];
  if (ttlSeconds) args.push('EX', String(ttlSeconds));
  var result = await command('SET', args);
  if (result === null) return false;
  if (result !== 'OK') {
    throw new Error('autofire efference store: SET NX returned ' + JSON.stringify(result) + ', expected "OK" or null');
  }
  return true;
}

async function del(key) {
  var result = await command('DEL', [physicalKey(key)]);
  if (typeof result !== 'number' || !isFinite(result) || result < 0) {
    throw new Error('autofire efference store: DEL returned an invalid count');
  }
  return result;
}

async function lpush(key, value) {
  var result = await command('LPUSH', [physicalKey(key), JSON.stringify(value)]);
  if (typeof result !== 'number' || !isFinite(result) || result < 1) {
    throw new Error('autofire efference store: LPUSH returned an invalid list length');
  }
  return result;
}

async function ltrim(key, start, stop) {
  var result = await command('LTRIM', [physicalKey(key), String(start), String(stop)]);
  if (result !== 'OK') {
    throw new Error('autofire efference store: LTRIM returned ' + JSON.stringify(result) + ', expected "OK"');
  }
  return true;
}

async function lrange(key, start, stop) {
  var result = await command('LRANGE', [physicalKey(key), String(start), String(stop)]);
  if (!Array.isArray(result)) {
    throw new Error('autofire efference store: LRANGE returned a non-array value');
  }
  return result.map(function (value) {
    if (typeof value !== 'string') {
      throw new Error('autofire efference store: LRANGE item is not a string');
    }
    try { return JSON.parse(value); }
    catch (_) { throw new Error('autofire efference store: LRANGE item is invalid JSON'); }
  });
}

module.exports = {
  NAMESPACE_PREFIX: NAMESPACE_PREFIX,
  assertKey: assertKey,
  assertDurable: assertDurable,
  get: get,
  set: set,
  setIfAbsent: setIfAbsent,
  del: del,
  lpush: lpush,
  ltrim: ltrim,
  lrange: lrange
};
