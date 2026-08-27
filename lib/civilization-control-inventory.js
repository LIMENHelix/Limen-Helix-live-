'use strict';

/**
 * Full control-plane inventory. These categories are intentionally distinct:
 * runtime valves are operator-controlled inhibitors; deployment controls are
 * hard env gates/limits; crons are cadence pumps; condition/diagnosis gates,
 * B0-B17, and P0-P10 are computed physiology and must never become manual
 * truth overrides.
 */

var Registry = require('./civilization-valve-registry.js');
var PhaseSpec = require('./phase-spec.js');
var Crons = require('./civilization-cadence-manifest.js');

var TRIGGER_TABLES = {
  communication: require('../assets/data/communication-condition-trigger-aliases.json'),
  culture: require('../assets/data/culture-condition-trigger-aliases.json'),
  defense: require('../assets/data/defense-condition-trigger-aliases.json'),
  economy: require('../assets/data/economy-condition-trigger-aliases.json'),
  education: require('../assets/data/education-condition-trigger-aliases.json'),
  energy: require('../assets/data/energy-condition-trigger-aliases.json'),
  environment: require('../assets/data/environment-condition-trigger-aliases.json'),
  finance: require('../assets/data/finance-condition-trigger-aliases.json'),
  governance: require('../assets/data/governance-condition-trigger-aliases.json'),
  industry: require('../assets/data/industry-condition-trigger-aliases.json'),
  infrastructure: require('../assets/data/infrastructure-condition-trigger-aliases.json'),
  intelligence: require('../assets/data/intelligence-condition-trigger-aliases.json'),
  law: require('../assets/data/law-condition-trigger-aliases.json'),
  medicine: require('../assets/data/medicine-condition-trigger-aliases.json'),
  population: require('../assets/data/population-condition-trigger-aliases.json'),
  religion: require('../assets/data/religion-condition-trigger-aliases.json'),
  science: require('../assets/data/science-condition-trigger-aliases.json'),
  technology: require('../assets/data/technology-condition-trigger-aliases.json'),
  trade: require('../assets/data/trade-condition-trigger-aliases.json')
};

// Agriculture is intentionally not duplicated into an alias table. Its local
// brain classifies 27 emitted condition codes into six diagnosis ids; those ids
// resolve directly through assets/data/domains/p2_agri.json issue circuits.
// Tests derive both counts from the real sources so these lightweight production
// metadata cannot drift while keeping the 5.4 MB p2_agri JSON family out of this
// serverless control-plane bundle.
var LOCAL_TRIGGER_PATHS = {
  agriculture: {
    status: 'MAPPED_LOCAL_P2_AGRI',
    conditionCount: 27,
    diagnosisCount: 6,
    source: 'assets/js/domain-brains/agriculture-brain.js + assets/data/domains/p2_agri.json'
  }
};

var EXTRA_ENV_CONTROLS = [
  'AGENT_BUDGET_USD', 'ANTHROPIC_MAX_TOKENS', 'AUTOFIRE_MAX_PER_TICK', 'COACH_DAILY_CAP', 'COACH_MAX_TOKENS',
  'DOMAIN_AGENT_DAILY_CAP', 'DOMAIN_AGENT_MAX_TOKENS', 'ENERGY_AGENT_DAILY_CAP', 'ENERGY_AGENT_MAX_TOKENS',
  'LEAD_ENRICH_PAID_ENABLED', 'LIMEN_AGENT_BOXES_DISABLED', 'LIMEN_AI_TOKENS_PER_TICK',
  'LIMEN_AUTONOMY_DAILY_USD', 'LIMEN_DAILY_BUDGET_USD', 'MASTER_AGENT_DAILY_CAP',
  'MAIL_LIMIT', 'MASTER_AGENT_MAX_TOKENS', 'RA_MAX_DATES', 'RECIPROCITY_MAX_TOKENS', 'SOCIAL_MAX_POSTS_PER_DAY',
  'STUDIO_DAILY_CAP', 'STUDIO_MAX_TOKENS',

  'AGRICULTURE_HOMESTEAD_DAILY_BUDGET_USD', 'AGRICULTURE_HOMESTEAD_DAILY_REQUEST_CAP',
  'DEFENSE_PUBLICATION_DAILY_BUDGET_USD', 'DEFENSE_PUBLICATION_DAILY_CAP', 'DEFENSE_PUBLICATION_OPERATION_COST_USD',
  'ECONOMY_INVESTMENT_RECOVERY_ENABLED', 'LIMEN_ECONOMY_INVESTMENT_DEVELOPMENTAL_ENABLED',
  'ECONOMY_INVESTMENT_DAILY_ORDER_CAP', 'ECONOMY_INVESTMENT_MAX_NOTIONAL_USD',
  'ENERGY_INVESTMENT_RECOVERY_ENABLED', 'LIMEN_ENERGY_INVESTMENT_DEVELOPMENTAL_ENABLED',
  'ENERGY_INVESTMENT_DAILY_ORDER_CAP', 'ENERGY_INVESTMENT_MAX_NOTIONAL_USD',
  'GOVERNANCE_PUBLICATION_DAILY_BUDGET_USD', 'GOVERNANCE_PUBLICATION_DAILY_CAP', 'GOVERNANCE_PUBLICATION_OPERATION_COST_USD',
  'INDUSTRY_CRM_DAILY_BUDGET_USD', 'INDUSTRY_CRM_DAILY_OPERATION_CAP', 'INDUSTRY_CRM_OPERATION_COST_USD',
  'INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED', 'INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL',
  'INFRASTRUCTURE_REAL_ESTATE_DAILY_BUDGET_USD', 'INFRASTRUCTURE_REAL_ESTATE_DAILY_REQUEST_CAP', 'INFRASTRUCTURE_REAL_ESTATE_MAX_INDICATION_USD',
  'LAW_AUTOMAIL_DAILY_LETTER_CAP', 'LIMEN_FINANCE_PAPER_ADMISSION_ENABLED',
  'LIMEN_FINANCE_PAPER_COMMISSIONING_ENABLED', 'LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD',
  'LIMEN_FINANCE_SANDBOX_RESERVE_USD',
  'POPULATION_REAL_ESTATE_DAILY_BUDGET_USD', 'POPULATION_REAL_ESTATE_DAILY_REQUEST_CAP', 'POPULATION_REAL_ESTATE_MAX_INDICATION_USD',
  'RELIGION_SUBSCRIBER_DAILY_BUDGET_USD', 'RELIGION_SUBSCRIBER_DAILY_SEND_CAP',
  'LIMEN_EDUCATION_RESEARCH_DEVELOPMENTAL_ENABLED', 'LIMEN_ENVIRONMENT_RESEARCH_DEVELOPMENTAL_ENABLED',
  'LIMEN_MEDICINE_RESEARCH_DEVELOPMENTAL_ENABLED', 'LIMEN_SCIENCE_RESEARCH_DEVELOPMENTAL_ENABLED',
  'TECHNOLOGY_INVESTMENT_RECOVERY_ENABLED', 'LIMEN_TECHNOLOGY_INVESTMENT_DEVELOPMENTAL_ENABLED',
  'TECHNOLOGY_INVESTMENT_DAILY_ORDER_CAP', 'TECHNOLOGY_INVESTMENT_MAX_NOTIONAL_USD',
  'TRADE_AUCTION_DAILY_BUDGET_USD', 'TRADE_AUCTION_DAILY_LISTING_CAP',
  'TRADE_AUCTION_MAX_RESERVE_USD', 'TRADE_AUCTION_OPERATION_COST_USD'
];

var BRAIN_BLOCKS = [
  ['B0', 'Afferent interface'], ['B1', 'Boundary / sanitization'], ['B2', 'Reflex layer'],
  ['B3', 'Central pattern generators'], ['B4', 'Arousal / global gain'], ['B5', 'Interoception'],
  ['B6', 'Homeostatic set-points'], ['B7', 'Thalamic gate + TRN'], ['B8', 'Cortical microcircuit'],
  ['B9', 'Hierarchy and inter-areal wiring'], ['B10', 'Action selection'], ['B11', 'Motor path'],
  ['B12', 'Neuromodulatory outcome weighting'], ['B13', 'Offline consolidation and clearance'],
  ['B14', 'Forward model and efference copy'], ['B15', 'Episodic memory'],
  ['B16', 'Substrate maintenance'], ['B17', 'Metaplasticity and self-model']
].map(function (row) { return { id: row[0], label: row[1], authority: 'COMPUTED_NOT_MANUAL' }; });

function unique(values) { return Array.from(new Set(values)).sort(); }
function keys(value) { return value && typeof value === 'object' ? Object.keys(value) : []; }
function inferDomain(name) {
  var lower = String(name || '').toLowerCase();
  var domains = unique(Registry.LINES.map(function (x) { return x.productDomain; }));
  return domains.find(function (domain) { return lower.indexOf(domain + '_') >= 0; }) ||
    (lower.indexOf('research_') >= 0 ? 'science/medicine' : 'global');
}
function kind(name) {
  if (/(?:API_KEY|TOKEN|SECRET|PASSWORD|ACCOUNT|EMAIL|_FROM)$/.test(name)) return 'credential-readiness';
  if (/DISABLED$/.test(name)) return 'deployment-inhibitor';
  if (/(?:ENABLED|AUTONOMY_ENABLED|ORDER_AUTONOMY_ENABLED)$/.test(name)) return 'deployment-switch';
  if (/(?:BUDGET|CAP|LIMIT|MAX_|MIN_|TOKENS_PER_TICK|RESERVE|OPERATION_COST)/.test(name)) return 'budget-or-bound';
  return 'deployment-configuration';
}
function envState(name, env) {
  var raw = (env || process.env)[name];
  var configured = raw !== undefined && raw !== null && String(raw) !== '';
  var k = kind(name), open;
  if (k === 'deployment-inhibitor') open = !configured || String(raw) !== '1';
  else if (k === 'deployment-switch') open = String(raw || '') === '1';
  else if (k === 'budget-or-bound') open = configured && Number(raw) > 0;
  else open = configured;
  return { configured: configured, open: open };
}
function cronKind(path) {
  if (/outcome-observer|position-owner/.test(path)) return 'OUTCOME_OBSERVER';
  if (/cycle|autofire|social-cron|subscriber-digest|hero-image|autopilot/.test(path)) return 'MOTOR_OR_DECISION';
  if (/ingest|snapshot|stress-refresh|feed-record|domain-text-read/.test(path)) return 'SENSING';
  if (/brain|score|resolve|sleep/.test(path)) return 'COGNITION_OR_MAINTENANCE';
  return 'OTHER';
}
function triggerInventory() {
  return unique(Registry.LINES.map(function (line) { return line.productDomain; })).map(function (domain) {
    var table = TRIGGER_TABLES[domain];
    var local = LOCAL_TRIGGER_PATHS[domain];
    return {
      domain: domain,
      portalIdentity: domain === 'agriculture' ? 'p2_agri' : domain,
      status: table ? 'MAPPED_ALIAS_TABLE' : (local ? local.status : 'MISSING_DOMAIN_TRIGGER_PATH'),
      conditionCodes: table ? keys(table.conditionCodes).sort() : [],
      diagnoses: table ? keys(table.diagnoses).sort() : [],
      conditionCount: table ? keys(table.conditionCodes).length : (local ? local.conditionCount : 0),
      diagnosisCount: table ? keys(table.diagnoses).length : (local ? local.diagnosisCount : 0),
      enumeration: table ? 'INLINE_ALIAS_TABLE' : (local ? 'LOCAL_BRAIN_AND_DOMAIN_JSON' : 'NONE'),
      pathway: (domain === 'agriculture' ? 'p2_agri/Agriculture' : domain) + ' feed evidence → ' + domain + ' condition classifier → ' + domain + ' diagnosis gate → ' + domain + ' brain activation/extinction',
      authority: 'AUTOMATIC_COMPUTED_NOT_MANUAL',
      source: table ? 'assets/data/' + domain + '-condition-trigger-aliases.json' : (local ? local.source : null)
    };
  });
}
function snapshot(env) {
  var names = unique(Registry.LINES.reduce(function (all, line) { return all.concat(line.hardGates); }, []).concat(EXTRA_ENV_CONTROLS));
  var envControls = names.map(function (name) {
    return Object.assign({
      id: 'env:' + name, name: name, scope: inferDomain(name), kind: kind(name),
      source: 'Vercel production environment', destination: inferDomain(name) + ' control boundary',
      authority: 'READ_ONLY_DEPLOYMENT_CONTROL', valuesExposed: false
    }, envState(name, env));
  });
  var triggers = triggerInventory();
  var domainCount = unique(Registry.LINES.map(function (line) { return line.productDomain; })).length;
  var conditionCount = triggers.reduce(function (n, x) { return n + x.conditionCount; }, 0);
  var diagnosisCount = triggers.reduce(function (n, x) { return n + x.diagnosisCount; }, 0);
  return {
    schemaVersion: 'civilization-control-inventory/1.0',
    summary: {
      runtimeMotorValves: Registry.LINES.length + 1,
      deploymentControls: envControls.length,
      cadencePumps: Crons.length,
      automaticConditionTriggers: conditionCount,
      diagnosisGates: diagnosisCount,
      missingDomainTriggerMaps: triggers.filter(function (x) { return x.status.indexOf('MAPPED_') !== 0; }).map(function (x) { return x.domain; }),
      brainBlocksPerDomain: BRAIN_BLOCKS.length,
      brainBlockInstances: BRAIN_BLOCKS.length * domainCount,
      phasesPerDomain: PhaseSpec.PHASES.length,
      phaseInstances: PhaseSpec.PHASES.length * domainCount
    },
    envControls: envControls,
    crons: Crons.map(function (row) { return { path: row.path, schedule: row.schedule, kind: cronKind(row.path), authority: 'VERSIONED_SCHEDULE_NOT_RUNTIME_TOGGLE' }; }),
    triggersByDomain: triggers,
    brainBlocks: BRAIN_BLOCKS,
    phases: PhaseSpec.PHASES.map(function (p) { return { code: p.code, title: p.title, state: p.state, authority: 'COMPUTED_NOT_MANUAL' }; })
  };
}

module.exports = { EXTRA_ENV_CONTROLS: EXTRA_ENV_CONTROLS, BRAIN_BLOCKS: BRAIN_BLOCKS, kind: kind, envState: envState, cronKind: cronKind, triggerInventory: triggerInventory, snapshot: snapshot };
