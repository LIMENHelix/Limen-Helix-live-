#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

function source(path) { return fs.readFileSync(path, 'utf8'); }
var social = source('handlers/social-cron.js');
var socialExecutor = source('lib/communication-social-executor.js');
var subscriber = source('handlers/subscriber-digest.js');
var image = source('handlers/hero-image.js');
var autopilot = source('handlers/autopilot.js');
var automail = source('handlers/homestead-automail.js');

[
  [socialExecutor, "authorize.authorize(store, 'communication', 'social'", 'platform.postToBluesky', 'if (!authorization || authorization.authorized !== true)'],
  [subscriber, "authorize(motorStore, 'religion', 'subscriber-email'", 'sendToLead', 'if (!motorGate.authorized)'],
  [image, "authorize(motorStore, 'culture', 'hero-image'", 'generate(domain', 'if (!motorGate.authorized)']
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

console.log('outward domain motor gates: social, subscriber email, and hero image fail closed before effects');

assert(autopilot.includes("authorize(motorStore, 'intelligence', 'autopilot'"));
assert(autopilot.includes('motorGate && motorGate.authorized === true && cfg.mode'));
assert(autopilot.indexOf('motorGate && motorGate.authorized === true && cfg.mode') < autopilot.indexOf('send.sendToLead'));
assert(automail.includes("authorize(motorStore, 'law', 'automail'"));
var mailGateAt = automail.indexOf("authorize(motorStore, 'law', 'automail'");
var lobEffectAt = automail.indexOf('await lobSend(d, LOB', mailGateAt);
assert(lobEffectAt > mailGateAt);
assert(automail.slice(mailGateAt, lobEffectAt).includes('if (!motorGate.authorized) live = false'));

console.log('outward domain motor gates: autopilot and automail also inhibit execution while preserving plan/dry-run behavior');
