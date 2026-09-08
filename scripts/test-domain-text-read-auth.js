#!/usr/bin/env node
'use strict';

/**
 * test-domain-text-read-auth.js — the spend path of /api/domain-text-read authenticates.
 *
 * The stored-read path stays open. The run path (?run=1) spends Anthropic budget and
 * writes a reading, so it must authenticate the CALLER: Vercel cron identity
 * (Authorization: Bearer <CRON_SECRET>) or the operator master key (x-limen-pass via
 * lib/admin-gate). A configured BRAIN_WEIGHTS_TOKEN alone authorizes nobody, and with
 * the token absent the run path refuses even a correctly authenticated cron. The dry
 * path reveals nothing but counts — no prompt text, no headlines — and spends nothing,
 * so it stays open.
 *
 * Anthropic is stubbed at the module boundary (require cache) so nothing here can
 * spend; the stub records calls, and a call happening at all is the proof the gate let
 * the request through. The snapshot fetch is stubbed at global.fetch and refuses every
 * other URL. limen-db runs on its real in-memory backend.
 */

const assert = require('assert');
const crypto = require('crypto');

const SAVED = {};
['BRAIN_WEIGHTS_TOKEN', 'CRON_SECRET', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY',
 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY'
].forEach(function (k) { SAVED[k] = process.env[k]; });

function restoreEnv() {
  Object.keys(SAVED).forEach(function (k) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  });
}

const HEADLINES = [
  'Vatican confirms synod assembly will open amid tightened security checks',
  'USCIRF report flags rising restrictions across twelve countries',
  'Pew survey finds weekly attendance still below pre-pandemic levels'
];

// Block everything except the snapshot URL the handler legitimately pulls.
const REAL_FETCH = global.fetch;
global.fetch = async function (url) {
  if (String(url).indexOf('/api/domain-snapshot') !== -1) {
    return {
      ok: true,
      json: async function () {
        return { domains: { religion: { sources: [{ name: 'Vatican News', headlines: HEADLINES }] } } };
      }
    };
  }
  throw new Error('BLOCKED: this suite must never make a real network request: ' + url);
};

// Stub the Anthropic seam BEFORE the handler is required, and record every call.
const anthropicPath = require.resolve('../lib/anthropic-call');
require(anthropicPath);
const anthropicCalls = [];
require.cache[anthropicPath].exports = {
  callAnthropic: async function (o) {
    anthropicCalls.push(o);
    return {
      ok: true,
      text: JSON.stringify({
        score: 0.42,
        confidence: 0.8,
        summary: 'Religion domain under moderate stress from policy shifts.',
        drivers: [{ index: 1, quote: 'USCIRF report flags rising restrictions', why: 'a named citation that verifies' }],
        abstain: false
      }),
      usage: { input_tokens: 300, output_tokens: 60 }
    };
  }
};

const db = require('../lib/limen-db');
const handler = require('../handlers/domain-text-read.js');
const authorizeSpend = handler._authorizeSpend;

let passed = 0;
function check(label, actual, expected) {
  assert.strictEqual(actual, expected, label);
  passed++;
}

/** Drive a handler the way Vercel does and capture what it sent. */
function invoke(req) {
  return new Promise(function (resolve) {
    const out = { status: 200, body: null, headers: {} };
    const res = {
      statusCode: 200,
      setHeader: function (k, v) { out.headers[k.toLowerCase()] = v; },
      status: function (c) { out.status = c; this.statusCode = c; return this; },
      json: function (o) { out.body = o; resolve(out); return this; },
      end: function (s) {
        out.status = res.statusCode || out.status;
        try { out.body = s ? JSON.parse(s) : null; } catch (e) { out.body = s; }
        resolve(out);
      }
    };
    Promise.resolve(handler(req, res)).catch(function (e) {
      out.status = 500; out.body = { error: e.message }; resolve(out);
    });
  });
}

function request(headers, url) {
  const normalized = {};
  for (const [k, v] of Object.entries(headers || {})) normalized[k.toLowerCase()] = v;
  return { headers: normalized, url: url || '/api/domain-text-read' };
}

async function main() {
  console.log('backend:', db.getBackend());
  assert.strictEqual(typeof authorizeSpend, 'function', 'auth seam exists');

  process.env.BRAIN_WEIGHTS_TOKEN = 'brain-token-abc';
  process.env.CRON_SECRET = 'cron-secret-123';
  process.env.ADMIN_MASTER = 'master-pass-xyz';
  delete process.env.ADMIN_MASTER_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  // ── stored-read path stays public and non-spending ─────────────────────────
  await db.set('domain:textread', {
    generatedAt: 1234567890,
    domains: { religion: { score: 0.3, summary: 'stored reading', drivers: [] } }
  });
  const readAll = await invoke(request({}, '/api/domain-text-read'));
  check('stored read is open (status)', readAll.status, 200);
  check('stored read returns the stored payload', readAll.body.stored.generatedAt, 1234567890);
  const readOne = await invoke(request({}, '/api/domain-text-read?domain=religion'));
  check('single stored read is open (status)', readOne.status, 200);
  check('single stored read returns the domain reading', readOne.body.reading.score, 0.3);
  check('stored read spent nothing', anthropicCalls.length, 0);

  // ── run path refuses without credentials ───────────────────────────────────
  let r = await invoke(request({}, '/api/domain-text-read?run=1'));
  check('run without auth refuses (status)', r.status, 403);
  check('run without auth is not ok', r.body.ok, false);
  check('run without auth spent nothing', anthropicCalls.length, 0);
  let stored = await db.get('domain:textread');
  check('run without auth overwrote nothing', stored.generatedAt, 1234567890);

  r = await invoke(request({ authorization: 'Bearer wrong' }, '/api/domain-text-read?run=1'));
  check('wrong cron bearer refuses (status)', r.status, 403);
  r = await invoke(request({ 'x-limen-pass': 'wrong' }, '/api/domain-text-read?run=1'));
  check('wrong operator pass refuses (status)', r.status, 403);
  check('wrong auth spent nothing', anthropicCalls.length, 0);

  // Query-string credentials are deliberately ignored: URLs are logged.
  r = await invoke(request({}, '/api/domain-text-read?run=1&key=master-pass-xyz'));
  check('query-string pass refuses (status)', r.status, 403);
  r = await invoke(request({}, '/api/domain-text-read?run=1&token=cron-secret-123'));
  check('query-string cron token refuses (status)', r.status, 403);
  check('query-string auth spent nothing', anthropicCalls.length, 0);

  // ── valid cron identity permits ────────────────────────────────────────────
  r = await invoke(request({ authorization: 'Bearer cron-secret-123' }, '/api/domain-text-read?run=1'));
  check('cron bearer runs (status)', r.status, 200);
  check('cron bearer runs ok', r.body.ok, true);
  check('cron bearer spends', anthropicCalls.length, 1);
  check('cron bearer wrote the reading', typeof (await db.get('domain:textread')).generatedAt, 'number');
  check('read result carries the model score', r.body.domains.religion.score, 0.42);
  check('usage is reported', r.body.usage.outputTokens, 60);

  // ── valid operator identity permits ────────────────────────────────────────
  anthropicCalls.length = 0;
  r = await invoke(request({ 'x-limen-pass': 'master-pass-xyz' }, '/api/domain-text-read?run=1'));
  check('operator pass runs (status)', r.status, 200);
  check('operator pass runs ok', r.body.ok, true);
  check('operator pass spends', anthropicCalls.length, 1);

  // ── dry path: open, non-spending, reveals nothing ──────────────────────────
  anthropicCalls.length = 0;
  r = await invoke(request({}, '/api/domain-text-read?run=1&dry=1'));
  check('dry run is open (status)', r.status, 200);
  check('dry run reports dry-run mode', r.body.mode, 'dry-run');
  check('dry run calls nothing', anthropicCalls.length, 0);
  check('dry run names a headline count', r.body.domains.religion.headlines, HEADLINES.length);
  check('dry run names a prompt size', typeof r.body.domains.religion.promptChars, 'number');
  const dryBlob = JSON.stringify(r.body);
  check('dry run leaks no headline text',
    HEADLINES.every(function (h) { return dryBlob.indexOf(h) === -1; }), true);

  // ── BRAIN_WEIGHTS_TOKEN absent fails closed even for cron ──────────────────
  delete process.env.BRAIN_WEIGHTS_TOKEN;
  r = await invoke(request({ authorization: 'Bearer cron-secret-123' }, '/api/domain-text-read?run=1'));
  check('token absent refuses cron (status)', r.status, 403);
  check('token absent names the reason', r.body.reason, 'brain-weights-token-unset');
  r = await invoke(request({ 'x-limen-pass': 'master-pass-xyz' }, '/api/domain-text-read?run=1'));
  check('token absent refuses operator (status)', r.status, 403);
  check('token absent spent nothing', anthropicCalls.length, 0);
  // Dry still works: it spends nothing and reveals nothing.
  r = await invoke(request({}, '/api/domain-text-read?run=1&dry=1'));
  check('token absent still allows dry (status)', r.status, 200);

  // ── the auth seam itself ───────────────────────────────────────────────────
  process.env.BRAIN_WEIGHTS_TOKEN = 'brain-token-abc';
  check('configured secrets alone do not authorize', authorizeSpend(request()).ok, false);
  check('correct cron bearer authorizes', authorizeSpend(request({ authorization: 'Bearer cron-secret-123' })).ok, true);
  check('bearer scheme is case-insensitive', authorizeSpend(request({ authorization: 'bearer cron-secret-123' })).ok, true);
  check('wrong cron bearer refuses', authorizeSpend(request({ authorization: 'Bearer wrong' })).ok, false);
  check('raw authorization value refuses', authorizeSpend(request({ authorization: 'cron-secret-123' })).ok, false);
  check('correct operator header authorizes', authorizeSpend(request({ 'x-limen-pass': 'master-pass-xyz' })).ok, true);
  check('wrong operator header refuses', authorizeSpend(request({ 'x-limen-pass': 'wrong' })).ok, false);
  check('cron check is length-guarded, no throw on junk',
    authorizeSpend(request({ authorization: 'Bearer x' })).ok, false);

  console.log(passed + '/' + passed + ' passed');
}

main().then(function () {
  global.fetch = REAL_FETCH;
  restoreEnv();
}).catch(function (e) {
  global.fetch = REAL_FETCH;
  restoreEnv();
  console.error(e && e.stack || e);
  process.exit(1);
});
