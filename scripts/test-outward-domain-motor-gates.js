#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

function source(path) { return fs.readFileSync(path, 'utf8'); }
var social = source('handlers/social-cron.js');
var socialExecutor = source('lib/communication-social-executor.js');
var subscriber = source('handlers/subscriber-digest.js');
var subscriberExecutor = source('lib/religion-subscriber-executor.js');
var financeSubscriberExecutor = source('lib/finance-subscriber-executor.js');
var stripeWebhook = source('handlers/stripe-webhook.js');
var religionRevenue = source('lib/religion-revenue-fulfillment.js');
var financeRevenue = source('lib/finance-revenue-fulfillment.js');
var image = source('handlers/hero-image.js');
var imageExecutor = source('lib/culture-hero-executor.js');
var autopilot = source('handlers/autopilot.js');
var intelligenceDecision = source('lib/intelligence-autopilot-decision.js');
var intelligenceExecutor = source('lib/intelligence-autopilot-executor.js');
var automail = source('handlers/homestead-automail.js');
var lawExecutor = source('lib/law-automail-executor.js');
var automailRunner = source('scripts/automail-run.js');

[
  [socialExecutor, "authorize.authorize(store, 'communication', 'social'", 'platform.postToBluesky', 'if (!authorization || authorization.authorized !== true)'],
  [subscriberExecutor, "authorize.authorize(store, 'religion', 'subscriber-email'", 'transport.send(spec.candidate.email', 'if (!motor || !motor.authorized)'],
  [imageExecutor, "authorize.authorize(store, 'culture', 'hero-image'", 'provider.generate(candidate)', 'if (!motor || !motor.authorized)']
].forEach(function (row) {
  assert(row[0].includes('product-domain-motor-authorization'));
  var gateAt = row[0].indexOf(row[1]);
  var effectAt = row[0].indexOf(row[2], gateAt);
  assert(gateAt >= 0, 'domain motor authorization missing');
  assert(effectAt > gateAt, 'outward effect appears before the domain motor gate');
  assert(row[0].slice(gateAt, effectAt).includes(row[3]));
});

assert(social.includes("require('../lib/communication-social-executor')"));
assert(social.includes("require('../lib/communication-social-decision')"));
var socialDecisionAt = social.indexOf('socialDecision.decide(motorStore');
var socialExecutorAt = social.indexOf('socialExecutor.execute({');
assert(socialDecisionAt >= 0 && socialExecutorAt > socialDecisionAt);
assert(social.slice(socialDecisionAt, socialExecutorAt).includes("decision.status !== 'RELEASED'"));
assert(social.indexOf('socialExecutor.execute({') < social.indexOf('preview.published = true'));
assert(image.includes("require('../lib/culture-hero-decision')"));
assert(image.includes("require('../lib/culture-hero-executor')"));
var imageDecisionAt = image.indexOf('heroDecision.decide(motorStore, candidate');
var imageExecutorAt = image.indexOf('heroExecutor.execute({');
assert(imageDecisionAt >= 0 && imageExecutorAt > imageDecisionAt);
assert(image.slice(imageDecisionAt, imageExecutorAt).includes("decision.status !== 'RELEASED'"));
assert(subscriber.includes("require('../lib/religion-subscriber-decision')"));
assert(subscriber.includes("require('../lib/religion-subscriber-executor')"));
assert(subscriber.includes("require('../lib/finance-subscriber-decision')"));
assert(subscriber.includes("require('../lib/finance-subscriber-executor')"));
var subscriberDecisionAt = subscriber.indexOf('motor.decision.decide(motorStore, candidate');
var subscriberExecutorAt = subscriber.indexOf('groupMotor.executor.execute({');
assert(subscriberDecisionAt >= 0 && subscriberExecutorAt > subscriberDecisionAt);
var financeSubscriberGateAt = financeSubscriberExecutor.indexOf("authorize.authorize(store, 'finance', 'subscriber-email'");
var financeSubscriberEffectAt = financeSubscriberExecutor.indexOf('transport.send(spec.candidate.email', financeSubscriberGateAt);
assert(financeSubscriberExecutor.includes("require('./finance-subscriber-motor-authorization.js')"));
assert(financeSubscriberGateAt >= 0 && financeSubscriberEffectAt > financeSubscriberGateAt);
assert(financeSubscriberExecutor.slice(financeSubscriberGateAt, financeSubscriberEffectAt).includes('if (!motor || !motor.authorized)'));
assert(stripeWebhook.includes("String(domain || '').toLowerCase() === 'finance' ? financeFulfillment : religionFulfillment"));
assert(stripeWebhook.includes('welcomeMotor.enqueueAndAttempt({'));
assert(stripeWebhook.includes('renewalMotor.enqueueAndAttempt({'));
assert(stripeWebhook.includes('subs.activateStrict({'));
assert(stripeWebhook.includes('subs.deactivateStrict('));
assert(!stripeWebhook.includes('crm.sendToLead'));
assert(religionRevenue.includes('Decision.decide(store, candidate'));
assert(religionRevenue.includes('Executor.execute({'));
assert(religionRevenue.indexOf('Decision.decide(store, candidate') < religionRevenue.indexOf('Executor.execute({'));
assert(financeRevenue.includes("require('./finance-subscriber-decision.js')"));
assert(financeRevenue.includes("require('./finance-subscriber-executor.js')"));
assert(financeRevenue.indexOf('Decision.decide(store, candidate') < financeRevenue.indexOf('Executor.execute({'));

console.log('outward domain motor gates: social, subscriber email, and hero image fail closed before effects');

assert(autopilot.includes("require('../lib/intelligence-autopilot-decision')"));
assert(autopilot.includes("require('../lib/intelligence-autopilot-executor')"));
assert(autopilot.includes("String(state.domain || '').toLowerCase() !== 'intelligence'"));
assert(autopilot.includes("state.consent !== true"));
assert(autopilot.includes('authorityReady: authorityReady'));
assert(autopilot.includes('authorityHeld: authorityHeld'));
assert(autopilot.includes('byDomain: byDomain'));
assert(intelligenceDecision.includes("domain !== 'intelligence'"));
assert(intelligenceDecision.includes('state.consent !== true'));
assert(autopilot.indexOf('intelligenceDecision.decide(motorStore, candidate') < autopilot.indexOf('intelligenceExecutor.execute({'));
var intelligenceGateAt = intelligenceExecutor.indexOf("authorize(store, 'intelligence', 'autopilot'");
var intelligenceEffectAt = intelligenceExecutor.indexOf('input.transport.send(v.email', intelligenceGateAt);
assert(intelligenceGateAt >= 0 && intelligenceEffectAt > intelligenceGateAt);
assert(intelligenceExecutor.slice(intelligenceGateAt, intelligenceEffectAt).includes('if (!auth || !auth.authorized)'));
assert(automail.includes("require('../lib/law-automail-decision')"));
assert(automail.includes("require('../lib/law-automail-executor')"));
assert(automail.indexOf('lawDecision.decide(motorStore, candidate') < automail.indexOf('lawExecutor.execute({'));
var mailGateAt = lawExecutor.indexOf("authorize(store, 'law', 'automail'");
var lobEffectAt = lawExecutor.indexOf('input.provider.create(candidate, idempotencyKey)', mailGateAt);
assert(mailGateAt >= 0 && lobEffectAt > mailGateAt);
assert(lawExecutor.slice(mailGateAt, lobEffectAt).includes('if (!motor || !motor.authorized)'));
assert(!automailRunner.includes('api.lob.com'));
assert(automailRunner.includes("action: 'send'"));

console.log('outward domain motor gates: autopilot and automail also inhibit execution while preserving plan/dry-run behavior');
