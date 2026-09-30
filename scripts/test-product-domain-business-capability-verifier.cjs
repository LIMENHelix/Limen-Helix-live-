#!/usr/bin/env node
'use strict';
var assert = require('node:assert/strict');
var Verifier = require('../lib/product-domain-business-capability-verifier.js');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var VideoAudit = require('../lib/communication-video-capability-audit.js');
var VideoCommand = require('../lib/communication-video-command.js');
var VideoUpload = require('../lib/communication-video-upload-bridge.js');

function Store() { this.map = new Map(); this.lists = new Map(); this.writes = []; }
Store.prototype.assertDurable = function () {};
Store.prototype.get = async function (key) { return this.map.has(key) ? structuredClone(this.map.get(key)) : null; };
Store.prototype.set = async function (key, value) { this.writes.push(key); this.map.set(key, structuredClone(value)); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; this.map.set(key, structuredClone(value)); return true; };
Store.prototype.lrange = async function (key, start, stop) { return structuredClone((this.lists.get(key) || []).slice(start, stop < 0 ? undefined : stop + 1)); };
Store.prototype.lpush = async function (key, value) { var rows = this.lists.get(key) || []; rows.unshift(structuredClone(value)); this.lists.set(key, rows); return rows.length; };
Store.prototype.ltrim = async function () {};

function motor(domain, now) {
  var c = Verifier.config(domain);
  return { schemaVersion: Motor.SCHEMA, receiptId: domain + '-receipt', productDomain: c.productDomain, ownerDomain: c.ownerDomain,
    contractId: c.contractId, lane: c.lane, contracts: { decision: c.decision, budget: c.budget, receipt: c.receipt,
      independentOutcome: c.independentOutcome, rollback: c.rollback }, status: 'HELD', persistedAt: now };
}
function command(domain, commissioned) {
  var c = Verifier.config(domain), id = domain + '-cmd';
  var row = { schemaVersion: c.commandSchema, commandId: id, actionId: domain + '-action', productDomain: c.productDomain,
    ownerDomain: c.ownerDomain, lane: c.lane, status: c.success, providerCalls: 1, readbackVerified: true };
  row[c.providerId] = 'provider-' + domain;
  if (commissioned) row.capabilityEvidence = { commissioningOnly: true, irreversibleEffectDeclared: true,
    ownedDestinationVerified: true, recipientConsentVerified: true, permanentOneShotSlotVerified: true,
    businessStateTransitionSuppressed: true, futureSuppressionRecoveryVerified: true, verificationEffectExecuted: true,
    liveMoney: false, verificationSpendUsd: 0, authorizationReceiptId: domain + '-auth', suppressionReceiptId: domain + '-suppress' };
  return row;
}
function observation(domain) { var c = Verifier.config(domain); var row = { schemaVersion: c.observationSchema, status: 'OBSERVED',
  observationId: domain + '-obs', commandId: domain + '-cmd', actionId: domain + '-action', independentOfCreateResponse: true,
  independentOfSendResponse: true, sendEndpointCalled: false, createEndpointCalled: false }; return row; }

(async function () {
  var now = Date.now();
  for (var i = 0; i < Verifier.DOMAINS.length; i++) {
    var domain = Verifier.DOMAINS[i], c = Verifier.config(domain), store = new Store();
    store.map.set(Motor.receiptKey(domain), motor(domain, now));
    var held = await Verifier.verifyAndPersist(store, domain, now);
    assert.equal(held.status, 'HELD'); assert.equal(held.persisted, false); assert.deepEqual(store.writes, []);
    var cmd = command(domain, false), obs = observation(domain);
    store.lists.set(c.commandLog, [cmd]); store.lists.set(c.observationLog, [obs]);
    store.map.set(c.learningKey, { signals: [{ actionId: cmd.actionId, ownerDomain: domain, lane: c.lane, eventType: 'OUTCOME', sourceIdentity: { kind: 'test' } }] });
    var ordinary = await Verifier.verifyAndPersist(store, domain, now + 1);
    assert.equal(ordinary.status, 'HELD'); assert.equal(ordinary.persisted, false); assert.equal(store.writes.length, 0);
    store.lists.set(c.commandLog, [command(domain, true)]); var verified = await Verifier.verifyAndPersist(store, domain, now + 2);
    assert.equal(verified.status, 'VERIFIED', domain); assert.equal(verified.persisted, true, domain);
    assert.equal((await Cap.verifyPair(store, motor(domain, now), now + 3)).ok, true, domain);
  }
  var video = new Store(); video.lists.set(VideoCommand.LOG_KEY, [{ commandId: 'video-command' }]);
  video.lists.set(VideoUpload.RECEIPT_LOG, [{ schemaVersion: VideoUpload.RECEIPT_SCHEMA, receiptId: 'video-receipt', commandId: 'video-command', status: 'UPLOADED_PRIVATE', readbackVerified: true, providerCalled: true, publiclyVisible: false }]);
  var videoReport = await VideoAudit.audit(video, now); assert.equal(videoReport.status, 'HELD'); assert.equal(videoReport.executor.verified, true); assert.equal(videoReport.independentOutcomeObserver.verified, false);
  console.log('business capability promotion: Law, Infrastructure, Population require explicit owned-destination proof; Communication video remains separate and held without independent public outcome');
})().catch(function (error) { console.error(error); process.exit(1); });
