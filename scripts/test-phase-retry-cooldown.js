#!/usr/bin/env node
'use strict';

/**
 * test-phase-retry-cooldown.js — refused and unvalidated companies cool off
 * instead of occupying the priority queue every tick.
 *
 * Retry state lives under a separate key, never as a phase. The queue skips a
 * cooling company without counting it as scored; expiry allows a retry; a
 * successful validated score clears the marker.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('../lib/limen-db');
const scorer = require('../lib/company-phase-scorer');

const ROOT = path.join(__dirname, '..');
const company = { cik: '123', ticker: 'T', domain: 'energy' };
const store = {};
const deleted = [];
let rejectDel = false;
let response = null;

const origGet = db.get;
const origSet = db.set;
const origDel = db.del;
const origFetch = global.fetch;

db.get = async (k) => (k in store ? store[k] : null);
db.set = async (k, v) => { store[k] = v; return true; };
db.del = async (k) => {
  deleted.push(k);
  if (rejectDel) return false;
  delete store[k];
  return true;
};
global.fetch = async () => response;

function reset() {
  for (const k of Object.keys(store)) delete store[k];
  deleted.length = 0;
  rejectDel = false;
}
function ok(payload) {
  return { ok: true, status: 200, json: async () => payload };
}
function refusal() {
  return ok({
    thing0_eligibility: { qualification_status: 'not_qualified', permits_thing1_use: false },
    dominant_phase: 'p4'
  });
}
function unvalidated() {
  return ok({
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
    validation_status: 'unvalidated_after_modification',
    kernel_id: 'limen_backtest.py',
    dominant_phase: 'p4'
  });
}
function validated() {
  return ok({
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
    validation_status: 'validated',
    kernel_id: 'limen_backtest.py',
    dominant_phase: 'p4',
    trajectory: 'STABLE'
  });
}

(async function () {
  try {
    assert.strictEqual(scorer.getConfig().COMPANY_PHASE_RETRY_COOLDOWN_MINUTES, 15);
    assert.ok(scorer.getConfig().COMPANY_PHASE_RETRY_KEY_PREFIX);

    // ── Thing Zero refusal records a cooldown, not a phase ────────────────
    reset();
    response = refusal();
    const refused = await scorer._scoreOne(company);
    assert.strictEqual(refused.scored, false);
    assert.strictEqual(refused.invalidated, true);
    const marker = store['company_phase_retry_123'];
    assert.ok(marker, 'refusal did not record retry state');
    assert.strictEqual(marker.cik, '123');
    assert.ok(marker.attemptedAt && marker.nextRetryAt);
    assert.ok(/not_permitted_by_thing0/.test(marker.reason), marker.reason);
    assert.strictEqual(marker.authoritative, false);
    assert.strictEqual(await scorer._retryCooling('123', Date.now()), true,
      'a refusal did not cool off on the next tick');
    assert.strictEqual(store['company_phase_123'], undefined,
      'refusal was written as an authoritative phase');

    // ── Unvalidated Thing One records a cooldown ─────────────────────────
    reset();
    response = unvalidated();
    const unval = await scorer._scoreOne(company);
    assert.strictEqual(unval.scored, false);
    const unvalMarker = store['company_phase_retry_123'];
    assert.ok(unvalMarker);
    assert.ok(/thing1_not_validated/.test(unvalMarker.reason), unvalMarker.reason);
    assert.strictEqual(await scorer._retryCooling('123', Date.now()), true);

    // ── Expiry allows another attempt ────────────────────────────────────
    reset();
    store['company_phase_retry_123'] = {
      cik: '123',
      attemptedAt: new Date(Date.now() - 3600000).toISOString(),
      nextRetryAt: new Date(Date.now() - 60000).toISOString(),
      reason: 'thing0_permission_missing',
      authoritative: false
    };
    assert.strictEqual(await scorer._retryCooling('123', Date.now()), false,
      'expired retry state still blocked the company');

    // ── One company does not block another ───────────────────────────────
    reset();
    await scorer._recordRetry('123', 'thing0_permission_missing');
    assert.strictEqual(await scorer._retryCooling('123', Date.now()), true);
    assert.strictEqual(await scorer._retryCooling('456', Date.now()), false,
      'one company retry state blocked another');

    // ── Successful validated scoring clears the marker ───────────────────
    reset();
    store['company_phase_retry_123'] = {
      cik: '123', attemptedAt: new Date().toISOString(),
      nextRetryAt: new Date(Date.now() + 900000).toISOString(),
      reason: 'thing1_not_validated:unvalidated_after_modification', authoritative: false
    };
    response = validated();
    const good = await scorer._scoreOne(company);
    assert.strictEqual(good.scored, true, JSON.stringify(good));
    assert.strictEqual(store['company_phase_retry_123'], undefined,
      'successful score did not clear the retry marker');
    assert.ok(deleted.includes('company_phase_retry_123'),
      'successful score did not delete the retry marker');

    // ── A retry marker is not a phase and not a domain diagnosis ─────────
    assert.strictEqual(scorer._cacheProvenanceValid(store['company_phase_retry_999'] || {}), false);
    const source = fs.readFileSync(path.join(ROOT, 'lib', 'company-phase-scorer.js'), 'utf8');
    const joinBody = source.slice(source.indexOf('async function buildDomainJoin'),
      source.indexOf('function evaluateConvergenceSignals'));
    assert.ok(!/company_phase_retry_|_retryKey|_retryCooling/.test(joinBody),
      'the domain join can consume retry state');
    assert.ok(source.includes('await _retryCooling(co.cik, now)'),
      'the priority queue does not honor the cooldown');
    assert.ok(source.includes('await _retryCooling(rrCo.cik, now)'),
      'the round-robin queue does not honor the cooldown');

    // ── Deletion failure stays explicit and does not record a cooldown ───
    reset();
    rejectDel = true;
    response = refusal();
    const delFail = await scorer._scoreOne(company);
    assert.strictEqual(delFail.scored, false);
    assert.strictEqual(delFail.invalidated, false);
    assert.strictEqual(delFail.invalidation_error, 'phase_delete_failed');
    assert.strictEqual(store['company_phase_retry_123'], undefined,
      'a deletion failure recorded a cooldown');

    // ── Provider failure is distinguishable and records no cooldown ──────
    reset();
    response = { ok: false, status: 503, json: async () => ({}) };
    const httpFail = await scorer._scoreOne(company);
    assert.strictEqual(httpFail.scored, false);
    assert.strictEqual(httpFail.invalidated, false);
    assert.strictEqual(httpFail.error, 'scorer_http_503');
    assert.strictEqual(store['company_phase_retry_123'], undefined,
      'a provider failure recorded a qualification cooldown');

    console.log('phase retry cooldown: refusal/unvalidated cool off for 15 minutes, expire, clear on success, never become phases');
  } finally {
    db.get = origGet;
    db.set = origSet;
    db.del = origDel;
    global.fetch = origFetch;
  }
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
