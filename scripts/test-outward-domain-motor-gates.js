#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

function source(path) { return fs.readFileSync(path, 'utf8'); }
var social = source('handlers/social-cron.js');
var subscriber = source('handlers/subscriber-digest.js');
var image = source('handlers/hero-image.js');

[
  [social, "authorize(motorStore, 'communication', 'social'", 'postToBluesky'],
  [subscriber, "authorize(motorStore, 'religion', 'subscriber-email'", 'sendToLead'],
  [image, "authorize(motorStore, 'culture', 'hero-image'", 'generate(domain']
].forEach(function (row) {
  assert(row[0].includes("require('../lib/product-domain-motor-authorization')"));
  var gateAt = row[0].indexOf(row[1]);
  var effectAt = row[0].indexOf(row[2], gateAt);
  assert(gateAt >= 0, 'domain motor authorization missing');
  assert(effectAt > gateAt, 'outward effect appears before the domain motor gate');
  assert(row[0].slice(gateAt, effectAt).includes('if (!motorGate.authorized)'));
});

console.log('outward domain motor gates: social, subscriber email, and hero image fail closed before effects');
