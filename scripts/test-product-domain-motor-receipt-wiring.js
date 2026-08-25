#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

var handler = fs.readFileSync('handlers/brain-cognition-refresh.js', 'utf8');
var store = fs.readFileSync('lib/autofire-efference-store.js', 'utf8');

assert(handler.includes("require('../lib/product-domain-motor-receipt.js')"));
assert(handler.includes('productDomainMotorReceipt.persist('));
assert(handler.includes('productDomainMotorCapabilityOverlay.apply('));
assert(handler.includes('motorReceiptsStored'));
assert(handler.includes('storedAndRestored'));
assert(store.includes('product_domain_motor_receipt_log'));
assert(store.includes("'product_domain_motor_receipt:'"));
assert(!handler.includes('productDomainMotorReceipt.execute'));
assert(handler.indexOf('productDomainMotorCapabilityOverlay.apply(') < handler.indexOf('productDomainMotorReceipt.persist('));

console.log('product domain motor receipt wiring: natural cognition cron, strict namespace, no executor passed');
