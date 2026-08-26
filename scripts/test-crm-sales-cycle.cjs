'use strict';

var assert = require('node:assert/strict');
var db = require('../lib/limen-db.js');
var Bridge = require('../lib/lead-pipeline-bridge.js');
var crm = require('../handlers/crm.js');

function Memory() { this.map = new Map(); }
Memory.prototype.get = async function (key) { return this.map.has(key) ? structuredClone(this.map.get(key)) : null; };
Memory.prototype.set = async function (key, value) { this.map.set(key, structuredClone(value)); return true; };
Memory.prototype.del = async function (key) { this.map.delete(key); };
Memory.prototype.lpush = async function (key, value) { var list = await this.get(key) || []; list.unshift(value); return this.set(key, list); };

function invoke(action, method, body) {
  return new Promise(function (resolve, reject) {
    var req = { method: method || 'GET', url: '/api/crm?action=' + encodeURIComponent(action) + '&key=cycle-test', query: {}, headers: {}, body: body };
    var output = '';
    var res = {
      statusCode: 200,
      setHeader: function () {},
      end: function (chunk) { output += chunk || ''; resolve({ status: res.statusCode, body: output ? JSON.parse(output) : null }); }
    };
    Promise.resolve(crm(req, res)).catch(reject);
  });
}

(async function () {
  var memory = new Memory();
  var originals = { get: db.get, set: db.set, del: db.del, lpush: db.lpush, getBackend: db.getBackend };
  var oldKey = process.env.SALES_ADMIN_KEY;
  db.get = memory.get.bind(memory); db.set = memory.set.bind(memory); db.del = memory.del.bind(memory); db.lpush = memory.lpush.bind(memory); db.getBackend = function () { return 'memory-test'; };
  process.env.SALES_ADMIN_KEY = 'cycle-test';
  try {
    var captured = await Bridge.capture({ eventId: 'cycle-lead-1', name: 'Taylor Customer', email: 'taylor@example.org', domain: 'energy', rung: 'watchlist', consent: true, recordAcquisition: false }, { db: db });
    assert.equal(captured.ok, true);
    assert.equal((await db.get('leadgen:lead:' + captured.leadId)).name, 'Taylor Customer');
    assert.equal((await db.get('crm:state:' + captured.leadId)).status, 'new');

    var premature = await invoke('close', 'POST', { leadId: captured.leadId, won: true, revenueCents: 1000 });
    assert.equal(premature.status, 409);
    assert.match(premature.body.error, /recorded show/);

    var booked = await invoke('appointment', 'POST', { leadId: captured.leadId, apptAt: '2026-09-01T10:00:00-05:00', channel: 'email' });
    assert.equal(booked.body.status, 'appointment');
    var confirmed = await invoke('confirm', 'POST', { leadId: captured.leadId, channel: 'confirm-email', note: 'customer confirmed' });
    assert.equal(confirmed.body.confirmations, 1);
    var showed = await invoke('show-outcome', 'POST', { leadId: captured.leadId, outcome: 'showed', channel: 'confirm-email' });
    assert.equal(showed.body.status, 'showed');

    var repeatedShow = await invoke('show-outcome', 'POST', { leadId: captured.leadId, outcome: 'showed' });
    assert.equal(repeatedShow.status, 409);

    var closed = await invoke('close', 'POST', { leadId: captured.leadId, won: true, dealSize: 'small', lever: 'rapport', revenueCents: 2500 });
    assert.equal(closed.body.status, 'enrolled');
    assert.equal(closed.body.revenueCents, 2500);

    var referred = await invoke('refer', 'POST', { leadId: captured.leadId, channel: 'email', referrals: [{ name: 'Jordan Referral', email: 'jordan@example.org' }] });
    assert.equal(referred.body.status, 'referred');
    assert.equal(referred.body.referralsAddedToLeads, 1);
    var index = await db.get('leadgen:index');
    var referral = null;
    for (var i = 0; i < index.length; i++) { var candidate = await db.get('leadgen:lead:' + index[i]); if (candidate && candidate.source === 'referral') { referral = candidate; break; } }
    assert(referral); assert.equal(referral.name, 'Jordan Referral'); assert.equal(referral.email, 'jordan@example.org');

    var metrics = await invoke('metrics', 'GET');
    assert.equal(metrics.body.pipeline.referred, 1);
    console.log('CRM sales cycle: identity-bound lead, appointment, show, enrollment, referral, and loop-back passed');
  } finally {
    Object.assign(db, originals);
    if (oldKey == null) delete process.env.SALES_ADMIN_KEY; else process.env.SALES_ADMIN_KEY = oldKey;
  }
})().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });
