#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var Handler = require('../handlers/social-cron.js');
var Override = require('../lib/communication-social-operator-override.js');

process.env.SOCIAL_CRON_KEY = 'test-social-key';
process.env.ADMIN_MASTER = 'test-admin-master';
process.env.CRON_SECRET = 'test-cron-secret';

function response() {
  return {
    statusCode: 0, headers: {}, body: null, json: null,
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (body) { this.body = body; this.json = JSON.parse(body); return this; }
  };
}

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: value }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

function economyPost() {
  return {
    ok: true, domain: 'economy', length: 40,
    text: 'Economy fact.\nhttps://limenhelix.com/economy',
    skipped: [],
    sourceIdentity: { kind: 'limen-live-tool-response', value: 'https://limenhelix.com/api/economy-tools',
      subjectDomain: 'economy', retrievedAt: new Date().toISOString(), responseHash: 'b'.repeat(64) }
  };
}

function lawPost() {
  var post = economyPost();
  post.domain = 'law';
  post.text = 'Law fact.\nhttps://limenhelix.com/law';
  post.sourceIdentity = Object.assign({}, post.sourceIdentity, {
    value: 'https://limenhelix.com/api/law-tools', subjectDomain: 'law'
  });
  return post;
}

function deps(overrides) {
  var calls = { decide: 0, execute: 0, mint: 0 };
  var store = new Store();
  var rate = { ok: true, used: 1, cap: 8, remaining: 7 };
  var base = {
    store: store,
    generate: async function () { return economyPost(); },
    previewAll: async function () { return [economyPost()]; },
    rateStatus: async function () { return rate; },
    dbGet: async function () { return null; },
    dbSet: async function () { return true; },
    buildFacets: function () { return [1]; },
    decide: async function () {
      calls.decide++;
      return { status: 'NO_ACTION', reason: 'communication-b10-held',
        blockers: ['communication-b10-brake-held:brake-dampen', 'communication-b10-no-action-selected'] };
    },
    execute: async function () { calls.execute++; throw new Error('execute must not run in these cases'); },
    operatorOverride: {
      mint: async function (s, input) {
        calls.mint++;
        return Override.mint(store, input);
      }
    }
  };
  return { deps: Object.assign(base, overrides || {}), calls: calls, store: store, rate: rate };
}

(async function () {
  var src = fs.readFileSync('handlers/social-cron.js', 'utf8');
  assert(src.includes("require('../lib/communication-social-operator-override')"));
  assert(src.includes('q.override === \'1\''));
  assert(src.includes('admin-key-required'));
  assert(src.includes('allowOperatorOverride'));
  assert(src.indexOf("preview.note = 'Preview only.") < src.indexOf('q.override === \'1\' && keyClass'));
  assert(src.includes('socialDecision.decide(motorStore'));
  assert(src.includes('socialExecutor.execute({'));
  assert(src.includes('store: motorStore'));

  var preview = deps();
  var res = response();
  await Handler.createHandler(preview.deps)({ method: 'GET', query: { key: 'test-social-key', domain: 'economy' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.published, false);
  assert.equal(res.json.domain, 'economy');
  assert.equal(res.json.note, 'Preview only. Add &post=1 to publish. Publishing is never the default.');
  assert.equal(res.json.brainHeld, undefined);
  assert.equal(res.json.operatorOverride, undefined);
  assert.equal(preview.calls.decide, 0);
  assert.equal(preview.calls.mint, 0);
  assert.equal(preview.calls.execute, 0);

  var previewOverride = deps();
  res = response();
  await Handler.createHandler(previewOverride.deps)({
    method: 'GET', query: { key: 'test-social-key', domain: 'economy', override: '1' }
  }, res);
  assert.equal(res.json.published, false);
  assert.equal(res.json.note, 'Preview only. Add &post=1 to publish. Publishing is never the default.');
  assert.equal(res.json.operatorOverride, undefined);
  assert.equal(previewOverride.calls.decide, 0);
  assert.equal(previewOverride.calls.mint, 0);

  var held = deps();
  res = response();
  await Handler.createHandler(held.deps)({
    method: 'GET', query: { key: 'test-social-key', domain: 'economy', post: '1' }
  }, res);
  assert.equal(res.json.published, false);
  assert.equal(res.json.brainHeld, true);
  assert.equal(res.json.reason, 'communication-b10-held');
  assert.deepEqual(res.json.decisionBlockers, [
    'communication-b10-brake-held:brake-dampen', 'communication-b10-no-action-selected'
  ]);
  assert.equal(res.json.operatorOverride, undefined);
  assert.equal(held.calls.decide, 1);
  assert.equal(held.calls.mint, 0);
  assert.equal(held.calls.execute, 0);

  var other = deps({ generate: async function () { return lawPost(); } });
  res = response();
  await Handler.createHandler(other.deps)({
    method: 'GET', query: { key: 'test-social-key', domain: 'law', post: '1', override: '1' }
  }, res);
  assert.equal(res.json.domain, 'law');
  assert.equal(res.json.brainHeld, true);
  assert.equal(res.json.operatorOverride.minted, false);
  assert.equal(res.json.operatorOverride.reason, 'economy-only');
  assert.equal(other.calls.mint, 0);

  var cronOnly = deps();
  res = response();
  await Handler.createHandler(cronOnly.deps)({
    method: 'GET',
    query: { domain: 'economy', post: '1', override: '1' },
    headers: { authorization: 'Bearer test-cron-secret' }
  }, res);
  assert.equal(res.json.brainHeld, true);
  assert.equal(res.json.operatorOverride.reason, 'admin-key-required');
  assert.equal(cronOnly.calls.mint, 0);
  assert.equal(cronOnly.calls.execute, 0);

  var released = deps({
    decide: async function (store, candidate, now, decisionDeps) {
      released.calls.decide++;
      assert.equal(candidate.subjectDomain, 'economy');
      assert.equal(decisionDeps.allowOperatorOverride, true);
      return {
        status: 'RELEASED', released: true, decisionReceiptId: 'csd_override_1',
        operatorOverride: { operatorKeyClass: 'SOCIAL_CRON_KEY', decisionReceiptId: 'csd_override_1' }
      };
    },
    execute: async function () {
      released.calls.execute++;
      return { ok: true, status: 'POSTED', commandId: 'csc_1', uri: 'at://did/app.bsky.feed.post/r1',
        url: 'https://bsky.app/post/r1', used: 2, cap: 8 };
    }
  });
  res = response();
  await Handler.createHandler(released.deps)({
    method: 'GET', query: { key: 'test-social-key', domain: 'economy', post: '1', override: '1' }
  }, res);
  assert.equal(res.json.published, true);
  assert.equal(res.json.operatorOverride.minted, true);
  assert.equal(res.json.operatorOverride.operatorKeyClass, 'SOCIAL_CRON_KEY');
  assert.equal(released.calls.mint, 1);
  assert.equal(released.calls.decide, 1);
  assert.equal(released.calls.execute, 1);
  assert.equal((await released.store.get(Override.receiptKey('economy'))).status, 'ACTIVE');

  var exhausted = deps({
    rateStatus: async function () { return { ok: true, used: 8, cap: 8, remaining: 0 }; }
  });
  res = response();
  await Handler.createHandler(exhausted.deps)({
    method: 'GET', query: { key: 'test-admin-master', domain: 'economy', post: '1', override: '1' }
  }, res);
  assert.equal(res.json.brainHeld, true);
  assert.equal(res.json.operatorOverride.minted, false);
  assert.equal(res.json.operatorOverride.reason, 'social-daily-rate-exhausted');
  assert.equal(exhausted.calls.execute, 0);

  console.log('social-cron economy override: preview unchanged, B10 hold without receipt, other-domain and cron-secret refused, admin-key economy RELEASE once, rate cap held');
})().catch(function (error) { console.error(error); process.exit(1); });
