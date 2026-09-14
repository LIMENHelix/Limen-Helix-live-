#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Override = require('../lib/communication-social-operator-override.js');
var Strict = require('../lib/autofire-efference-store.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: value }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

(async function () {
  assert.equal(Strict.assertKey(Override.LOG_KEY), Override.LOG_KEY);
  assert.equal(Strict.assertKey(Override.receiptKey('economy')), Override.receiptKey('economy'));
  assert.equal(Strict.assertKey(Override.claimKey('x')), Override.claimKey('x'));
  assert.equal(Override.TTL_MS <= 60 * 60 * 1000, true);
  assert.equal(Override.ALLOWED_KEY_CLASSES.indexOf('CRON_SECRET') < 0, true);
  assert.equal(Override.isAllowedKeyClass('SOCIAL_CRON_KEY'), true);
  assert.equal(Override.isAllowedKeyClass('governor'), false);
  assert.equal(Override.blockersAreB10Overridable([
    'communication-b10-brake-held:brake-dampen', 'communication-b10-no-action-selected'
  ]), true);
  assert.equal(Override.blockersAreB10Overridable([
    'communication-b10-brake-held:brake-dampen', 'communication-immune-veto'
  ]), false);

  var now = 100000;
  assert.equal((await Override.mint(new Store(), {
    subjectDomain: 'law', operatorKeyClass: 'SOCIAL_CRON_KEY', now: now
  })).reason, 'economy-only');
  assert.equal((await Override.mint(new Store(), {
    subjectDomain: 'economy', operatorKeyClass: 'CRON_SECRET', now: now
  })).reason, 'admin-key-required');
  assert.equal((await Override.mint(new Store(), {
    subjectDomain: 'economy', operatorKeyClass: 'chat-governor', now: now
  })).reason, 'admin-key-required');
  assert.equal((await Override.mint(new Store(), {
    subjectDomain: 'economy', operatorKeyClass: 'SOCIAL_CRON_KEY', now: now,
    rateStatus: { ok: true, used: 8, cap: 8, remaining: 0 }
  })).reason, 'social-daily-rate-exhausted');
  assert.equal((await Override.mint(new Store(), {
    subjectDomain: 'economy', operatorKeyClass: 'SOCIAL_CRON_KEY', now: now,
    rateStatus: { ok: false, reason: 'rate ledger unreachable' }
  })).reason, 'social-rate-status-unavailable');

  var store = new Store();
  var minted = await Override.mint(store, {
    subjectDomain: 'economy', operatorKeyClass: 'ADMIN_MASTER', now: now,
    rateStatus: { ok: true, used: 1, cap: 8, remaining: 7 }
  });
  assert.equal(minted.ok, true);
  assert.equal(minted.status, 'ACTIVE');
  assert.equal(minted.subjectDomain, 'economy');
  assert.equal(minted.operatorKeyClass, 'ADMIN_MASTER');
  assert.equal(minted.reason, 'operator-go-economy-publish');
  assert.equal(minted.expiresAt, now + Override.TTL_MS);
  assert.equal(store.log[0].key, Override.LOG_KEY);

  var reused = await Override.mint(store, {
    subjectDomain: 'economy', operatorKeyClass: 'ADMIN_MASTER', now: now + 1000
  });
  assert.equal(reused.ok, true);
  assert.equal(reused.reused, true);
  assert.equal(reused.overrideReceiptId, minted.overrideReceiptId);

  var first = await Override.consume(store, {
    subjectDomain: 'economy', now: now + 2000, decisionReceiptId: 'csd_test_1'
  });
  assert.equal(first.ok, true);
  assert.equal(first.receipt.status, 'CONSUMED');
  assert.equal(first.receipt.decisionReceiptId, 'csd_test_1');
  assert.equal(first.receipt.operatorKeyClass, 'ADMIN_MASTER');
  assert.equal((await store.get(Override.receiptKey('economy'))).consumedAt, now + 2000);

  var second = await Override.consume(store, {
    subjectDomain: 'economy', now: now + 3000, decisionReceiptId: 'csd_test_2'
  });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'override-already-consumed');

  var expiredStore = new Store();
  var expiredMint = await Override.mint(expiredStore, {
    subjectDomain: 'economy', operatorKeyClass: 'LEAD_ADMIN_KEY', now: now
  });
  assert.equal(expiredMint.ok, true);
  var expired = await Override.consume(expiredStore, {
    subjectDomain: 'economy', now: now + Override.TTL_MS, decisionReceiptId: 'csd_late'
  });
  assert.equal(expired.reason, 'override-absent-or-expired');

  console.log('communication social operator override: economy-only admin-key receipt, TTL, single-use consume, rate cap, and no chat/cron grant passed');
})().catch(function (error) { console.error(error); process.exit(1); });
