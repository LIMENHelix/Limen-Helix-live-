'use strict';

/**
 * Git-tracked topology for the twenty separate product-brain motor lines.
 * This is a control-plane manifest, not a shared brain.  It never creates a
 * candidate, changes stress, selects an action, or grants domain authority.
 */

function line(spec) {
  return Object.freeze(Object.assign({
    schemaVersion: 'civilization-valve-line/1.0',
    source: 'domain feeds and durable cognition packet',
    decision: 'owning-domain B10 decision',
    motor: 'owning-domain B14 command and efference copy',
    receipt: 'durable provider or broker receipt',
    learning: 'owning-domain outcome learning and recovery',
    hardGates: []
  }, spec));
}

var LINES = [
  line({ id: 'agriculture:homestead', productDomain: 'agriculture', ownerDomain: 'agriculture', lane: 'homestead', source: 'Agriculture feeds + exact homestead service request', actionRoute: 'agriculture-homestead-cycle', schedule: '37 14 * * *', destination: 'Resend service-request email', hardGates: ['AGRICULTURE_HOMESTEAD_ENABLED'], observerRoute: 'agriculture-homestead-inbound', recoveryRoute: 'agriculture-homestead-recovery' }),
  line({ id: 'communication:social', productDomain: 'communication', ownerDomain: 'communication', lane: 'social', source: 'Exact subject-domain stress artifact + subject-domain release + Communication channel release', actionRoute: 'social-cron', schedule: '0 0,2,12,14,16,18,20,22 * * *', destination: 'Bluesky PDS', hardGates: ['SOCIAL_POSTING_ENABLED'], observerRoute: 'communication-social-outcome-observer', recoveryRoute: 'communication-social-recovery' }),
  line({ id: 'communication:subscriber-email', productDomain: 'communication', ownerDomain: 'communication', lane: 'subscriber-email', source: 'Communication brain + active paid Communication entitlement + changed digest identity', actionRoute: 'communication-revenue-fulfillment', schedule: '4,24,44 * * * *', destination: 'Resend subscriber email', hardGates: ['COMMUNICATION_SUBSCRIBER_EMAIL_ENABLED', 'COMMUNICATION_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED', 'COMMUNICATION_SUBSCRIBER_MAX_SENDS', 'COMMUNICATION_SUBSCRIBER_EMAIL_USD', 'COMMUNICATION_SUBSCRIBER_DAILY_BUDGET_USD', 'COMMUNICATION_SUBSCRIBER_DAILY_SEND_CAP', 'RESEND_API_KEY'], observerRoute: 'communication-subscriber-outcome-observer', recoveryRoute: 'communication-subscriber-recovery' }),
  line({ id: 'culture:hero-image', productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image', source: 'Culture brain + hero asset candidate', actionRoute: 'hero-image', schedule: '*/5 * * * *', destination: 'xAI image generation', hardGates: ['LIMEN_AI_ENABLED', 'HERO_IMAGE_CAP', 'XAI_API_KEY'], observerRoute: 'culture-hero-outcome-observer', recoveryRoute: 'culture-hero-recovery' }),
  line({ id: 'culture:subscriber-email', productDomain: 'culture', ownerDomain: 'culture', lane: 'subscriber-email', source: 'Culture brain + active paid Culture entitlement + changed digest identity', actionRoute: 'culture-revenue-fulfillment', schedule: '2,22,42 * * * *', destination: 'Resend subscriber email', hardGates: ['CULTURE_SUBSCRIBER_EMAIL_ENABLED', 'CULTURE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED', 'CULTURE_SUBSCRIBER_MAX_SENDS', 'CULTURE_SUBSCRIBER_EMAIL_USD', 'CULTURE_SUBSCRIBER_DAILY_BUDGET_USD', 'CULTURE_SUBSCRIBER_DAILY_SEND_CAP', 'RESEND_API_KEY'], observerRoute: 'culture-subscriber-outcome-observer', recoveryRoute: 'culture-subscriber-recovery' }),
  line({ id: 'defense:publication', productDomain: 'defense', ownerDomain: 'defense', lane: 'publication', source: 'Defense feeds + selected publication candidate', actionRoute: 'defense-publication-cycle', schedule: '7 15 * * *', destination: 'LIMEN owned public article', hardGates: ['DEFENSE_PUBLICATION_ENABLED'], observerRoute: 'defense-publication-outcome-observer', recoveryRoute: 'defense-publication-recovery' }),
  line({ id: 'economy:investments', productDomain: 'economy', ownerDomain: 'economy', lane: 'investments', source: 'Economy feeds + exact paper-investment request', actionRoute: 'economy-investment-cycle', schedule: '19,49 * * * *', destination: 'Tradier sandbox', hardGates: ['ECONOMY_INVESTMENT_PAPER_ENABLED', 'ECONOMY_INVESTMENT_PAPER_ORDER_ENABLED'], observerRoute: 'economy-investment-outcome-observer', recoveryRoute: 'economy-investment-recovery' }),
  line({ id: 'education:research-papers', productDomain: 'education', ownerDomain: 'education', lane: 'research-papers', source: 'Education semantic packet evidence', actionRoute: 'limen-worker-autofire', schedule: '*/30 * * * * · owner rotation', destination: 'Internal research artifact store', hardGates: ['LIMEN_AUTONOMY_ENABLED', 'LIMEN_AI_ENABLED', 'LIMEN_EDUCATION_RESEARCH_DEVELOPMENTAL_ENABLED'], observerRoute: 'limen-research-evaluation-observer', recoveryRoute: 'research artifact withdrawal' }),
  line({ id: 'education:subscriber-email', productDomain: 'education', ownerDomain: 'education', lane: 'subscriber-email', source: 'Education brain + active paid Education entitlement + changed digest identity', actionRoute: 'education-revenue-fulfillment', schedule: '3,23,43 * * * *', destination: 'Resend subscriber email', hardGates: ['EDUCATION_SUBSCRIBER_EMAIL_ENABLED', 'EDUCATION_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED', 'EDUCATION_SUBSCRIBER_MAX_SENDS', 'EDUCATION_SUBSCRIBER_EMAIL_USD', 'EDUCATION_SUBSCRIBER_DAILY_BUDGET_USD', 'EDUCATION_SUBSCRIBER_DAILY_SEND_CAP', 'RESEND_API_KEY'], observerRoute: 'education-subscriber-outcome-observer', recoveryRoute: 'education-subscriber-recovery' }),
  line({ id: 'energy:investments', productDomain: 'energy', ownerDomain: 'energy', lane: 'investments', source: 'Energy feeds + exact paper-investment request', actionRoute: 'energy-investment-cycle', schedule: '22,52 * * * *', destination: 'Tradier sandbox', hardGates: ['ENERGY_INVESTMENT_PAPER_ENABLED', 'ENERGY_INVESTMENT_PAPER_ORDER_ENABLED'], observerRoute: 'energy-investment-outcome-observer', recoveryRoute: 'energy-investment-recovery' }),
  line({ id: 'environment:research-papers', productDomain: 'environment', ownerDomain: 'environment', lane: 'research-papers', source: 'Environment semantic packet evidence', actionRoute: 'limen-worker-autofire', schedule: '*/30 * * * * · owner rotation', destination: 'Internal research artifact store', hardGates: ['LIMEN_AUTONOMY_ENABLED', 'LIMEN_AI_ENABLED', 'LIMEN_ENVIRONMENT_RESEARCH_DEVELOPMENTAL_ENABLED'], observerRoute: 'limen-research-evaluation-observer', recoveryRoute: 'research artifact withdrawal' }),
  line({ id: 'finance:broker-order', productDomain: 'finance', ownerDomain: 'finance', lane: 'broker/order', source: 'Finance feeds, reporting, market history, Thing 0/1 and zero-weight Thing 2 context', actionRoute: 'finance-paper-cycle', schedule: '16,46 * * * *', destination: 'Tradier sandbox (live money separately impossible here)', hardGates: ['LIMEN_FINANCE_PREVIEW_ENABLED', 'LIMEN_FINANCE_TRADE_DECISION_ENABLED', 'TRADIER_SANDBOX_AUTONOMY_ENABLED', 'TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED'], observerRoute: 'limen-investment-outcome-observer', recoveryRoute: 'Finance cancel/exit recovery' }),
  line({ id: 'finance:subscriber-email', productDomain: 'finance', ownerDomain: 'finance', lane: 'subscriber-email', source: 'Finance Call Report feeds + active paid Finance entitlement + changed digest identity', actionRoute: 'finance-subscriber-cycle', schedule: '34 * * * *', destination: 'Resend subscriber email', hardGates: ['FINANCE_SUBSCRIBER_EMAIL_ENABLED', 'FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED', 'FINANCE_SUBSCRIBER_MAX_SENDS', 'FINANCE_SUBSCRIBER_EMAIL_USD', 'FINANCE_SUBSCRIBER_DAILY_BUDGET_USD', 'FINANCE_SUBSCRIBER_DAILY_SEND_CAP', 'RESEND_API_KEY'], observerRoute: 'finance-subscriber-outcome-observer', recoveryRoute: 'finance-subscriber-recovery' }),
  line({ id: 'governance:publication', productDomain: 'governance', ownerDomain: 'governance', lane: 'publication', source: 'Governance feeds + selected publication candidate', actionRoute: 'governance-publication-cycle', schedule: '17 15 * * *', destination: 'LIMEN owned public article', hardGates: ['GOVERNANCE_PUBLICATION_ENABLED'], observerRoute: 'governance-publication-outcome-observer', recoveryRoute: 'governance-publication-recovery' }),
  line({ id: 'industry:crm', productDomain: 'industry', ownerDomain: 'industry', lane: 'crm', source: 'Industry feeds + exact WARN/company task', actionRoute: 'industry-crm-cycle', schedule: '47 14 * * *', destination: 'HubSpot CRM', hardGates: ['INDUSTRY_CRM_ENABLED'], observerRoute: 'industry-crm-outcome-observer', recoveryRoute: 'industry-crm-recovery' }),
  line({ id: 'infrastructure:real-estate', productDomain: 'infrastructure', ownerDomain: 'infrastructure', lane: 'real-estate', source: 'Infrastructure feeds + exact owned outreach target', actionRoute: 'infrastructure-real-estate-cycle', schedule: '27 15 * * *', destination: 'Resend property outreach', hardGates: ['INFRASTRUCTURE_REAL_ESTATE_ENABLED'], observerRoute: 'infrastructure-real-estate-inbound', recoveryRoute: 'infrastructure-real-estate-recovery' }),
  line({ id: 'intelligence:autopilot', productDomain: 'intelligence', ownerDomain: 'intelligence', lane: 'autopilot', source: 'Intelligence brain + exact lead/email transition', actionRoute: 'autopilot', schedule: '7,37 * * * *', destination: 'Resend email', hardGates: ['INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD', 'INTELLIGENCE_AUTOPILOT_DAILY_EMAIL_CAP'], observerRoute: 'intelligence-autopilot-outcome-observer', recoveryRoute: 'intelligence-autopilot-recovery' }),
  line({ id: 'law:automail', productDomain: 'law', ownerDomain: 'law', lane: 'automail', source: 'Law brain + exact letter candidate', actionRoute: 'homestead-automail', schedule: 'operator/campaign cadence', destination: 'Lob physical mail', hardGates: ['LAW_AUTOMAIL_DAILY_BUDGET_USD', 'LOB_API_KEY'], observerRoute: 'law-automail-outcome-observer', recoveryRoute: 'law-automail-recovery' }),
  line({ id: 'medicine:research-papers', productDomain: 'medicine', ownerDomain: 'health', lane: 'research-papers', source: 'Medicine packet joined only to Health evidence', actionRoute: 'limen-worker-autofire', schedule: '*/30 * * * * · owner rotation', destination: 'Internal research artifact store', hardGates: ['LIMEN_AUTONOMY_ENABLED', 'LIMEN_AI_ENABLED', 'LIMEN_MEDICINE_RESEARCH_DEVELOPMENTAL_ENABLED'], observerRoute: 'limen-research-evaluation-observer', recoveryRoute: 'research artifact withdrawal' }),
  line({ id: 'medicine:subscriber-email', productDomain: 'medicine', ownerDomain: 'health', lane: 'subscriber-email', source: 'Medicine brain + active paid Medicine entitlement + changed digest identity', actionRoute: 'medicine-revenue-fulfillment', schedule: '6,26,46 * * * *', destination: 'Resend subscriber email', hardGates: ['MEDICINE_SUBSCRIBER_EMAIL_ENABLED', 'MEDICINE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED', 'MEDICINE_SUBSCRIBER_MAX_SENDS', 'MEDICINE_SUBSCRIBER_EMAIL_USD', 'MEDICINE_SUBSCRIBER_DAILY_BUDGET_USD', 'MEDICINE_SUBSCRIBER_DAILY_SEND_CAP', 'RESEND_API_KEY'], observerRoute: 'medicine-subscriber-outcome-observer', recoveryRoute: 'medicine-subscriber-recovery' }),
  line({ id: 'population:real-estate', productDomain: 'population', ownerDomain: 'population', lane: 'real-estate', source: 'Population feeds + exact owned outreach target', actionRoute: 'population-real-estate-cycle', schedule: '37 15 * * *', destination: 'Resend property outreach', hardGates: ['POPULATION_REAL_ESTATE_ENABLED'], observerRoute: 'population-real-estate-inbound', recoveryRoute: 'population-real-estate-recovery' }),
  line({ id: 'religion:subscriber-email', productDomain: 'religion', ownerDomain: 'religion', lane: 'subscriber-email', source: 'Religion brain + active paid 501(c)(3)-aligned subscriber entitlement', actionRoute: 'subscriber-digest', schedule: '30 * * * *', destination: 'Resend subscriber email', hardGates: ['SUBSCRIBER_DIGEST_MAX_SENDS', 'RESEND_API_KEY'], observerRoute: 'religion-subscriber-outcome-observer', recoveryRoute: 'religion-subscriber-recovery' }),
  line({ id: 'science:research-papers', productDomain: 'science', ownerDomain: 'research', lane: 'research-papers', source: 'Science packet joined only to Research evidence', actionRoute: 'limen-worker-autofire', schedule: '*/30 * * * * · owner rotation', destination: 'Internal research artifact store', hardGates: ['LIMEN_AUTONOMY_ENABLED', 'LIMEN_AI_ENABLED', 'LIMEN_SCIENCE_RESEARCH_DEVELOPMENTAL_ENABLED'], observerRoute: 'limen-research-evaluation-observer', recoveryRoute: 'research artifact withdrawal' }),
  line({ id: 'technology:investments', productDomain: 'technology', ownerDomain: 'technology', lane: 'investments', source: 'Technology feeds + exact paper-investment request', actionRoute: 'technology-investment-cycle', schedule: '25,55 * * * *', destination: 'Tradier sandbox', hardGates: ['TECHNOLOGY_INVESTMENT_PAPER_ENABLED', 'TECHNOLOGY_INVESTMENT_PAPER_ORDER_ENABLED'], observerRoute: 'technology-investment-outcome-observer', recoveryRoute: 'technology-investment-recovery' }),
  line({ id: 'trade:auction', productDomain: 'trade', ownerDomain: 'supplyChain', lane: 'auction', source: 'Trade packet joined only to Supply Chain + exact owned asset', actionRoute: 'trade-auction-cycle', schedule: '47 15 * * *', destination: 'LIMEN Relay marketplace listing', hardGates: ['TRADE_AUCTION_ENABLED'], observerRoute: 'trade-auction-outcome-observer', recoveryRoute: 'trade-auction-recovery' })
];

/* The remaining paid subscriber lines share only a clock and Resend transport.
 * Each named valve terminates in a separately-instantiated domain B10/B14
 * state machine with its own namespace, authority, budget and learning state. */
[
  ['agriculture', 'agriculture'], ['defense', 'defense'], ['economy', 'economy'],
  ['energy', 'energy'], ['environment', 'environment'], ['governance', 'governance'],
  ['industry', 'industry'], ['infrastructure', 'infrastructure'],
  ['intelligence', 'intelligence'], ['law', 'law'], ['population', 'population'],
  ['science', 'research'], ['technology', 'technology'], ['trade', 'supplyChain']
].forEach(function (identity) {
  var product = identity[0], owner = identity[1], stem = product.toUpperCase();
  LINES.push(line({
    id: product + ':subscriber-email',
    productDomain: product,
    ownerDomain: owner,
    lane: 'subscriber-email',
    source: product + ' brain + active paid ' + product + ' entitlement + fresh domain-commercial artifact',
    actionRoute: 'domain-subscriber-fulfillment',
    schedule: '*/10 * * * * · seven-domain transport rotation',
    destination: 'Resend subscriber email',
    hardGates: [stem + '_SUBSCRIBER_EMAIL_ENABLED', stem + '_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED',
      stem + '_SUBSCRIBER_MAX_SENDS', stem + '_SUBSCRIBER_EMAIL_USD', stem + '_SUBSCRIBER_DAILY_BUDGET_USD',
      stem + '_SUBSCRIBER_DAILY_SEND_CAP', 'RESEND_API_KEY'],
    observerRoute: 'domain-subscriber-outcome-observer',
    recoveryRoute: 'domain-subscriber-recovery'
  }));
});

var BY_ID = Object.create(null), BY_ROUTE = Object.create(null);
LINES.forEach(function (item) {
  BY_ID[item.id] = item;
  if (item.actionRoute !== 'limen-worker-autofire') {
    if (!BY_ROUTE[item.actionRoute]) BY_ROUTE[item.actionRoute] = [];
    BY_ROUTE[item.actionRoute].push(item.id);
  }
});
// Digest generation is a shared clock only. Mapping every subscriber-email
// line makes forRoute('subscriber-digest') deliberately ambiguous, so the API
// boundary cannot borrow Religion's valve for the other nineteen domains.
// Each grouped batch still crosses its own domain B10/B14, budget, capability,
// adapter guard, and local valve before Resend is called.
BY_ROUTE['subscriber-digest'] = LINES.filter(function (item) {
  return item.lane === 'subscriber-email';
}).map(function (item) { return item.id; });
[
  ['finance-position-owner', 'finance:broker-order'],
  ['finance-paper-executor', 'finance:broker-order'],
  ['finance-sandbox-commissioning', 'finance:broker-order'],
  ['finance-b14', 'finance:broker-order'],
  ['tradier-b14', 'finance:broker-order'],
  ['paper-trade', 'finance:broker-order'],
  ['finance-revenue-fulfillment', 'finance:subscriber-email'],
  ['religion-revenue-fulfillment', 'religion:subscriber-email']
].forEach(function (pair) { BY_ROUTE[pair[0]] = [pair[1]]; });

function get(id) { return BY_ID[String(id || '')] || null; }
function forRoute(route) {
  var matches = BY_ROUTE[String(route || '')] || [];
  return matches.length === 1 ? matches[0] : null;
}
function forRouteAll(route) { return (BY_ROUTE[String(route || '')] || []).slice(); }
function forCandidate(entry) {
  var domain = String(entry && entry.domain || '').toLowerCase();
  if (entry && entry.recommendedLane === 'investment') return 'finance:broker-order';
  if (entry && entry.recommendedLane === 'research') {
    if (domain === 'science' || domain === 'research') return 'science:research-papers';
    if (domain === 'medicine' || domain === 'health') return 'medicine:research-papers';
    if (domain === 'education') return 'education:research-papers';
    if (domain === 'environment') return 'environment:research-papers';
  }
  return null;
}

function buildState(item, proof) {
  proof = proof || {};
  var common = {
    measuredAt: '2026-08-26',
    evidence: 'product-domain-business-executor-audit/1.0',
    implementation: 'CLOSED_SOURCE_CHAIN',
    externalAutonomy: 'NOT_PROVEN',
    past: 'Separate source, decision, motor, receipt, independent observer, rollback, budget and switch chain implemented and source-audited.'
  };
  if (item.id === 'finance:broker-order') {
    var finance = proof.financeCommissioning || { status: 'UNOBSERVED', verified: false };
    return Object.assign({}, common, {
      sequence: 'JOB_7_CURRENT',
      present: finance.verified
        ? 'Finance paper-investment pilot: the zero-effect Tradier sandbox command, cancellation, and independent rollback read are verified; a mature independently graded position outcome is not complete.'
        : 'Finance paper-investment pilot: feed-confirmed selection and sandbox motor are active development; zero-effect rollback and a mature independently graded broker outcome are not complete.',
      future: 'Complete paper command → broker receipt → independent outcome → cohort learning proof, then require separate Job 8 live-account authorization.',
      durableProof: finance
    });
  }
  if (item.id === 'science:research-papers') {
    var science = proof.researchDevelopmental && proof.researchDevelopmental.science || { status: 'UNOBSERVED', artifactPersisted: false };
    return Object.assign({}, common, {
      sequence: 'JOB_7_CURRENT',
      present: science.artifactPersisted
        ? 'Science developmental research pilot: a bounded internal artifact/provider receipt is durably persisted; independent evaluation and learned recovery remain incomplete.'
        : 'Science developmental research pilot: the bounded lane exists; durable artifact/provider proof was not observed by this snapshot.',
      future: 'Collect source-separated evaluations, resolve the outcome cohort, and prove withdrawal/recovery before any publication or sale lane.',
      durableProof: science
    });
  }
  if (item.id === 'medicine:research-papers') {
    var medicine = proof.researchDevelopmental && proof.researchDevelopmental.medicine || { status: 'UNOBSERVED', artifactPersisted: false };
    return Object.assign({}, common, {
      sequence: 'JOB_7_CURRENT',
      present: medicine.artifactPersisted
        ? 'Medicine developmental research pilot: a bounded internal artifact/provider receipt is durably persisted; independent evaluation and learned recovery remain incomplete.'
        : 'Medicine developmental research pilot: the bounded lane and permanent one-attempt contract exist; durable artifact/provider proof was not observed by this snapshot.',
      future: medicine.artifactPersisted
        ? 'Collect source-separated evaluations, resolve the outcome cohort, and prove withdrawal/recovery before any publication or sale lane.'
        : 'Create the first genuine bounded artifact, collect independent evaluations, and prove recovery before any publication or sale lane.',
      durableProof: medicine
    });
  }
  return Object.assign({}, common, {
    sequence: 'JOB_9_AFTER_JOBS_7_8',
    present: 'Closed source chain exists in code; external commissioning is deliberately held while the Job 7 paper pilots and Job 8 Finance pilot establish the pattern.',
    future: 'Commission this lane alone with its own bounded create → external read → receipt → rollback → zero-residual proof, then observe outcomes before autonomy.'
  });
}

function hardGateState(item, env) {
  env = env || process.env;
  var gates = item.hardGates.map(function (name) {
    var raw = env[name];
    var configured = raw !== undefined && raw !== null && String(raw) !== '';
    var switchLike = /(?:ENABLED|ORDER_ENABLED)$/.test(name);
    var capLike = /(?:CAP|BUDGET_USD|MAX_SENDS)$/.test(name);
    var open = switchLike ? String(raw || '') === '1' : (capLike ? configured && Number(raw) > 0 : configured);
    return { name: name, configured: configured, open: open };
  });
  return { open: gates.length ? gates.every(function (g) { return g.open; }) : true, gates: gates };
}

module.exports = { LINES: LINES, get: get, forRoute: forRoute, forRouteAll: forRouteAll,
  forCandidate: forCandidate, buildState: buildState, hardGateState: hardGateState };
