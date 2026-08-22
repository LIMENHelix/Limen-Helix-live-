#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function assert(name, condition, detail) {
  if (!condition) {
    console.error('FAIL ' + name + (detail ? ' — ' + detail : ''));
    process.exitCode = 1;
  } else {
    passed++;
    console.log('PASS ' + name);
  }
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    end(v) { this.body = v == null ? '' : String(v); return this; }
  };
}

function request(method, url, authorization, body, extraHeaders) {
  const headers = Object.assign({}, extraHeaders || {});
  if (authorization) headers.authorization = authorization;
  return { method, url: url || '/', headers, body };
}

async function invoke(handler, req) {
  const res = response();
  await handler(req, res);
  let json = null;
  try { json = res.body ? JSON.parse(res.body) : null; } catch (_) {}
  return { code: res.statusCode, headers: res.headers, body: res.body, json };
}

const savedEnv = {
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_MASTER: process.env.ADMIN_MASTER,
  ADMIN_MASTER_KEY: process.env.ADMIN_MASTER_KEY,
  LIMEN_OPERATOR_TOKEN: process.env.LIMEN_OPERATOR_TOKEN,
  LIMEN_AI_ENABLED: process.env.LIMEN_AI_ENABLED,
  LIMEN_AUTONOMY_ENABLED: process.env.LIMEN_AUTONOMY_ENABLED,
  LIMEN_AUTONOMY_DAILY_USD: process.env.LIMEN_AUTONOMY_DAILY_USD
};

function restoreEnv() {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

(async function main() {
  const dbPath = require.resolve(path.join(ROOT, 'lib', 'limen-db.js'));
  const store = new Map();
  let dbTouches = 0;
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
      async get(k) { dbTouches++; return store.has(k) ? store.get(k) : null; },
      async set(k, v) { dbTouches++; store.set(k, v); return { ok: true }; }
    }
  };
  const efferenceStorePath = require.resolve(path.join(ROOT, 'lib', 'autofire-efference-store.js'));
  require.cache[efferenceStorePath] = {
    id: efferenceStorePath, filename: efferenceStorePath, loaded: true,
    exports: { assertDurable() { return true; } }
  };

  process.env.CRON_SECRET = 'cron-test-secret';
  process.env.ADMIN_MASTER = 'master-test-secret';
  delete process.env.ADMIN_MASTER_KEY;
  delete process.env.LIMEN_OPERATOR_TOKEN;
  delete process.env.LIMEN_AI_ENABLED;
  process.env.LIMEN_AUTONOMY_ENABLED = '1';
  process.env.LIMEN_AUTONOMY_DAILY_USD = '2';

  const autoqueue = require(path.join(ROOT, 'handlers', 'limen-worker-autoqueue.js'));
  const autofire = require(path.join(ROOT, 'handlers', 'limen-worker-autofire.js'));
  const sleep = require(path.join(ROOT, 'handlers', 'limen-worker-sleep-cycle.js'));

  const beforeMissing = dbTouches;
  let r = await invoke(autoqueue, request('GET', '/api/limen-worker-autoqueue'));
  assert('autoqueue refuses a missing cron bearer', r.code === 401, r.code);
  assert('autoqueue refuses before touching state', dbTouches === beforeMissing, dbTouches - beforeMissing);

  const beforeWrong = dbTouches;
  r = await invoke(sleep, request('GET', '/api/limen-worker-sleep-cycle', 'Bearer wrong'));
  assert('sleep cycle refuses a wrong cron bearer', r.code === 401, r.code);
  assert('sleep cycle refuses before touching state', dbTouches === beforeWrong, dbTouches - beforeWrong);

  delete process.env.CRON_SECRET;
  const beforeUnset = dbTouches;
  r = await invoke(autofire, request('GET', '/api/limen-worker-autofire'));
  assert('autofire fails closed when CRON_SECRET is absent', r.code === 503, r.code);
  assert('autofire fails closed before touching state', dbTouches === beforeUnset, dbTouches - beforeUnset);

  process.env.CRON_SECRET = 'cron-test-secret';
  r = await invoke(autoqueue, request('GET', '/api/limen-worker-autoqueue', 'Bearer cron-test-secret'));
  assert('exact cron bearer executes autoqueue', r.code === 200 && r.json && r.json.ok, r.body);
  const seededQueue = store.get('autoqueue') || [];
  assert('autoqueue admits a bounded master-inbox batch', seededQueue.length === 10 && r.json.masterInbox.admitted === 10, seededQueue.length);
  assert('master-inbox candidates preserve their source identity and gate', seededQueue.every(q =>
    q.source === 'master-inbox' && q.sourceArtifactRef && q.sourcePatternSig && q.masterGate && q.autofireEligible === true));
  assert('master-inbox candidates remain research/investment only', seededQueue.every(q => ['research', 'investment'].includes(q.recommendedLane)));

  r = await invoke(sleep, request('GET', '/api/limen-worker-sleep-cycle', 'Bearer cron-test-secret'));
  assert('exact cron bearer executes sleep cycle', r.code === 200 && r.json && r.json.ok, r.body);

  r = await invoke(autofire, request('GET', '/api/limen-worker-autofire?probe=1', 'Bearer cron-test-secret'));
  assert('exact cron bearer reaches autofire paid-AI gate', r.code === 200 && r.json && r.json.paused === 'ai-spend-disabled', r.body);

  const enginePath = require.resolve(path.join(ROOT, 'handlers', 'limen-engine-output.js'));
  delete require.cache[enginePath];
  delete process.env.ADMIN_MASTER;
  delete process.env.ADMIN_MASTER_KEY;
  delete process.env.LIMEN_OPERATOR_TOKEN;
  let engine = require(enginePath);
  r = await invoke(engine, request('POST', '/api/limen-engine-output', null, {}));
  assert('engine-output mutation fails closed with no configured credential', r.code === 503, r.body);
  assert('engine-output reports fail-closed auth mode', r.headers['x-auth-mode'] === 'fail-closed', r.headers['x-auth-mode']);

  process.env.ADMIN_MASTER = 'master-test-secret';
  r = await invoke(engine, request('POST', '/api/limen-engine-output', null, {}, { 'x-limen-pass': 'wrong' }));
  assert('engine-output rejects a wrong master pass', r.code === 401, r.body);
  r = await invoke(engine, request('POST', '/api/limen-engine-output', null, {}, { 'x-limen-pass': 'master-test-secret' }));
  assert('engine-output accepts master auth before validating content', r.code === 400 && r.json && r.json.error === 'missing-engineId', r.body);

  r = await invoke(engine, request('POST', '/api/limen-engine-output', null, {
    cik: '62996',
    slug: 'mmc',
    engineId: 'engine-investment',
    lane: 'investment',
    sourcePatternSig: 'test-pattern',
    operator: 'autofire-worker',
    payload: { draftBody: 'Draft with [DATA_NEEDED: audited value].' }
  }, { 'x-limen-pass': 'master-test-secret' }));
  assert('a draft needing data is not recorded as ready-to-sign in its own history',
    r.code === 201 && r.json && r.json.status === 'DRAFT_NEEDS_DATA' &&
    r.json.record && r.json.record.history[0].status === 'DRAFT_NEEDS_DATA', r.body);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const cronPaths = vercel.crons.map(x => x.path);
  assert('autoqueue schedule is restored', cronPaths.includes('/api/limen-worker-autoqueue'));
  assert('autofire schedule is restored', cronPaths.includes('/api/limen-worker-autofire'));
  assert('sleep-cycle schedule is restored', cronPaths.includes('/api/limen-worker-sleep-cycle'));
  assert('obsolete multipass schedule stays retired', !cronPaths.includes('/api/limen-worker-multipass'));

  const autofireSource = fs.readFileSync(path.join(ROOT, 'handlers', 'limen-worker-autofire.js'), 'utf8');
  assert('autofire uses the shared autonomy budget', autofireSource.includes("require('../lib/autonomy-budget')"));
  assert('autofire checks the global paid-AI kill switch', autofireSource.includes("require('../lib/ai-kill-switch')"));
  assert('a lost budget debit pauses future paid calls', autofireSource.includes('await aiKillSwitch.setSpendPaused(true)'));
  assert('autofire sends the master pass only as a header', autofireSource.includes("h['x-limen-pass'] = master"));
  assert('autofire uses the public origin instead of a protected deployment hostname',
    autofireSource.includes("process.env.PUBLIC_BASE_URL || 'https://limenhelix.com'") &&
    !autofireSource.includes("process.env.VERCEL_URL ? 'https://'"));
  assert('autofire permits the measured long-form generation window', autofireSource.includes('AbortSignal.timeout(700000)'));
  assert('failed paid attempts back off instead of retrying every tick',
    autofireSource.includes('RETRY_BACKOFF_MS = 6 * 60 * 60 * 1000') &&
    autofireSource.includes("qFail[qfi].status = 'FAILED'"));
  assert('autofire lanes remain exactly research and investment', /new Set\(\['investment', 'research'\]\)/.test(autofireSource));
  assert('master-inbox readiness is explicit rather than relabelled HIGH',
    autofireSource.includes("q.source === 'master-inbox' && q.autofireEligible === true"));

  const logSource = fs.readFileSync(path.join(ROOT, 'handlers', 'limen-autofire-log.js'), 'utf8');
  assert('autofire log reports the shared autonomy budget', logSource.includes("require('../lib/autonomy-budget')"));
  assert('autofire log no longer reports the retired default-20 budget', !logSource.includes('AUTOFIRE_DAILY_BUDGET'));

  const ignored = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8');
  assert('the runtime master inbox is no longer excluded from deployment', !/^assets\/data\/_master-inbox\.json$/m.test(ignored));

  const expandSource = fs.readFileSync(path.join(ROOT, 'handlers', 'expand-artifact-claude.js'), 'utf8');
  assert('the provider timeout fits inside the 800-second function budget',
    expandSource.includes("process.env.ANTHROPIC_TIMEOUT_MS || '600000'"));

  restoreEnv();
  if (process.exitCode) process.exit(process.exitCode);
  console.log('\n' + passed + '/' + passed + ' passed');
})().catch(err => {
  restoreEnv();
  console.error(err && err.stack || err);
  process.exit(1);
});
