'use strict';

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EFFERENCE = require(path.join(ROOT, 'lib', 'autofire-efference.js'));

let checks = 0;
function ok(name, condition, detail) {
  checks++;
  if (!condition) throw new Error('FAIL ' + name + (detail ? ': ' + detail : ''));
  console.log('PASS ' + name);
}

// Logic double for the strict store interface. This proves ordering and state
// transitions only; strictStoreBoundaryProofs below exercises the real Redis
// transport and its refusal paths.
function strictStoreDouble() {
  const values = new Map();
  const lists = new Map();
  const operations = [];
  return {
    values, lists, operations,
    assertDurable() { return true; },
    async get(key) {
      operations.push({ op: 'get', key });
      return values.has(key) ? values.get(key) : null;
    },
    async set(key, value) {
      operations.push({ op: 'set', key, status: value && value.status });
      values.set(key, value);
      return true;
    },
    async del(key) {
      operations.push({ op: 'del', key });
      values.delete(key);
      return true;
    },
    async lpush(key, value) {
      operations.push({ op: 'lpush', key, type: value && value.type });
      const list = lists.get(key) || [];
      list.unshift(value);
      lists.set(key, list);
      return true;
    },
    async ltrim(key, start, stop) {
      operations.push({ op: 'ltrim', key });
      const list = lists.get(key) || [];
      lists.set(key, list.slice(start, stop + 1));
      return true;
    },
    async lrange(key, start, stop) {
      operations.push({ op: 'lrange', key });
      const list = lists.get(key) || [];
      const end = stop === -1 ? list.length : stop + 1;
      return list.slice(start, end);
    }
  };
}

function request(method, url, body) {
  return { method, url, headers: {}, body: body || null, on() {} };
}

async function invoke(handler, req) {
  let body = '';
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
    end(chunk) { if (chunk) body += chunk; }
  };
  await handler(req, res);
  let json = null;
  try { json = body ? JSON.parse(body) : null; } catch (_) {}
  return { code: res.statusCode, headers, body, json };
}

async function strictStoreBoundaryProofs() {
  console.log('\nT0: the real actuator store fails closed instead of using process memory');
  const storePath = require.resolve(path.join(ROOT, 'lib', 'autofire-efference-store.js'));
  const previous = require.cache[storePath];
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const oldFetch = global.fetch;
  delete require.cache[storePath];
  try {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const store = require(storePath);
    let missingRefused = false;
    try { await store.set('autofire_efference:probe', { status: 'COMMANDED' }, 60); }
    catch (err) { missingRefused = /not configured/.test(err.message); }
    ok('missing Redis credentials refuse the write', missingRefused);

    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';
    global.fetch = async function () {
      return { status: 200, async text() { return JSON.stringify({ error: 'write rejected' }); } };
    };
    let redisErrorRefused = false;
    try { await store.set('autofire_efference:probe', { status: 'COMMANDED' }, 60); }
    catch (err) { redisErrorRefused = /rejected by Redis/.test(err.message); }
    ok('a Redis protocol error refuses the write', redisErrorRefused);

    global.fetch = async function () {
      return { status: 200, async text() { return JSON.stringify({ result: null }); } };
    };
    let falseReceiptRefused = false;
    try { await store.set('autofire_efference:probe', { status: 'COMMANDED' }, 60); }
    catch (err) { falseReceiptRefused = /expected "OK"/.test(err.message); }
    ok('SET without an OK receipt refuses the write', falseReceiptRefused);

    let physicalCommand = null;
    global.fetch = async function (_url, options) {
      physicalCommand = JSON.parse(options.body);
      return { status: 200, async text() { return JSON.stringify({ result: 'OK' }); } };
    };
    const accepted = await store.set('autofire_efference:probe', { status: 'COMMANDED' }, 60);
    ok('confirmed Redis SET is accepted', accepted === true && physicalCommand[0] === 'SET');
    ok('the durable key remains in the limen actuator namespace', physicalCommand[1] === 'limen:autofire_efference:probe');

    let foreignRefused = false;
    try { await store.set('autoqueue', [], 60); }
    catch (err) { foreignRefused = /outside the actuator namespace/.test(err.message); }
    ok('the strict store cannot write the queue or another subsystem', foreignRefused);

    const forgiving = {
      async get() { return null; }, async set() { return true; },
      async lpush() { return true; }, async ltrim() { return true; }, async lrange() { return []; }
    };
    const refused = await EFFERENCE.command(forgiving, {
      lane: 'research', cik: '1', sourceIdentity: { kind: 'test', value: 'memory-only' }, emittedAt: 1
    });
    ok('the efference module refuses a store without a strict durability contract', !refused.ok && refused.error === 'durable-store-unavailable');
  } finally {
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
    if (previous) require.cache[storePath] = previous; else delete require.cache[storePath];
  }
}

async function moduleProofs() {
  console.log('\nT1: command boundary refuses unsupported or unidentified actions');
  const db = strictStoreDouble();
  let r = await EFFERENCE.command(db, { lane: 'patent', cik: '1', sourceIdentity: { kind: 'x', value: 'y' }, emittedAt: 1 });
  ok('retired lane cannot enter the motor path', !r.ok && r.error === 'lane-not-research-or-investment');
  r = await EFFERENCE.command(db, { lane: 'research', cik: '1', emittedAt: 1 });
  ok('command without source identity is refused', !r.ok && r.error === 'missing-source-identity');
  ok('a refused command writes no efference copy', Array.from(db.values.keys()).every(k => !k.startsWith('autofire_efference:')));

  console.log('\nT2: the receipt, not selection, licenses EXECUTED');
  r = await EFFERENCE.command(db, {
    lane: 'research', cik: '100',
    sourceIdentity: { kind: 'master-inbox-artifact', value: 'research:100:one' },
    emittedAt: 1000, attempt: 0
  });
  ok('command persists before resolution', r.ok && db.values.get(EFFERENCE.recordKey(r.copy.id)).status === 'COMMANDED');
  ok('cold model abstains instead of inventing a probability', r.copy.prediction.successProbability === null && r.copy.prediction.trusted === false);
  const resolved = await EFFERENCE.resolve(db, r.copy, { ok: true, outputId: 'eo_research_100', wordCount: 900 }, 1600);
  const saved = db.values.get(EFFERENCE.recordKey(r.copy.id));
  ok('persistence receipt makes the actuator record EXECUTED', resolved.status === 'EXECUTED' && saved.receipt.outputId === 'eo_research_100');
  ok('returned persistence is labelled self-caused, not independent evidence', /not independent evidence/.test(saved.supervised.attribution));
  ok('first command teaches the lane model once', db.values.get(EFFERENCE.modelKey('research')).n === 1);
  const duplicate = await EFFERENCE.resolve(db, r.copy.id, { ok: true, outputId: 'eo_research_100' }, 1700);
  ok('same efference copy cannot teach twice', duplicate.duplicate === true && db.values.get(EFFERENCE.modelKey('research')).n === 1);

  console.log('\nT3: failure is an observed consequence, not silence');
  const failedCommand = await EFFERENCE.command(db, {
    lane: 'investment', cik: '200',
    sourceIdentity: { kind: 'phase-transition-pattern', value: 'p6:p8:200' },
    emittedAt: 2000
  });
  const failed = await EFFERENCE.resolve(db, failedCommand.copy, {
    ok: false, reason: 'expand-error', errorCode: 'UND_ERR_HEADERS_TIMEOUT'
  }, 2600);
  const failedSaved = db.values.get(EFFERENCE.recordKey(failedCommand.copy.id));
  ok('failed command is durably FAILED rather than executed', failed.status === 'FAILED' && failedSaved.receipt.applied === false);
  ok('failure code remains attached to the returned consequence', failedSaved.receipt.errorCode === 'UND_ERR_HEADERS_TIMEOUT');
  ok('failure teaches actual zero to its own lane model', db.values.get(EFFERENCE.modelKey('investment')).n === 1 && db.values.get(EFFERENCE.modelKey('investment')).successes === 0);

  console.log('\nT3b: a serverless timeout abstains instead of becoming a false failure');
  const timeoutDb = strictStoreDouble();
  const source = { kind: 'master-inbox-artifact', value: 'research:timeout:one' };
  const hanging = await EFFERENCE.command(timeoutDb, {
    lane: 'research', cik: '250', sourceIdentity: source, emittedAt: 1000
  });
  const overlapping = await EFFERENCE.command(timeoutDb, {
    lane: 'research', cik: '250', sourceIdentity: source, emittedAt: 1000 + EFFERENCE.COMMAND_TIMEOUT_MS - 1
  });
  ok('same action cannot overlap while its command is in flight', !overlapping.ok && overlapping.error === 'command-already-in-flight');
  const earlySweep = await EFFERENCE.sweep(timeoutDb, 1000 + EFFERENCE.COMMAND_TIMEOUT_MS - 1);
  ok('sweep leaves a still-live command untouched', earlySweep.ok && earlySweep.retired === 0);
  const timeoutSweep = await EFFERENCE.sweep(timeoutDb, 1000 + EFFERENCE.COMMAND_TIMEOUT_MS + 1);
  const retired = timeoutDb.values.get(EFFERENCE.recordKey(hanging.copy.id));
  ok('natural sweep retires a stale command without a source retry', timeoutSweep.ok && timeoutSweep.retired === 1 && retired.status === 'UNRESOLVED' && retired.supervised.actual === null);
  ok('missing receipt does not teach a fabricated zero', timeoutDb.values.get(EFFERENCE.modelKey('research')) === undefined);
  const retry = await EFFERENCE.command(timeoutDb, {
    lane: 'research', cik: '250', sourceIdentity: source, emittedAt: 1000 + EFFERENCE.COMMAND_TIMEOUT_MS + 2,
    attempt: 1
  });
  ok('a swept command no longer blocks the later retry', retry.ok);

  console.log('\nT4: trust is earned from distinct resolved commands');
  const training = strictStoreDouble();
  for (let i = 0; i < EFFERENCE.TRUST_N; i++) {
    const c = await EFFERENCE.command(training, {
      lane: 'research', cik: String(300 + i),
      sourceIdentity: { kind: 'master-inbox-artifact', value: 'train:' + i },
      emittedAt: 3000 + i * 1000
    });
    await EFFERENCE.resolve(training, c.copy, { ok: true, outputId: 'eo_train_' + i }, 3500 + i * 1000);
  }
  const trusted = await EFFERENCE.command(training, {
    lane: 'research', cik: '999',
    sourceIdentity: { kind: 'master-inbox-artifact', value: 'train:next' },
    emittedAt: 20000
  });
  ok('eighth independent resolution opens the trust gate for the next command', trusted.copy.prediction.trusted === true && trusted.copy.prediction.modelN === EFFERENCE.TRUST_N);
  ok('trusted probability is derived from observed receipts', trusted.copy.prediction.successProbability === 1);
  ok('latency prediction is learned from observed command-to-receipt timing', trusted.copy.prediction.predictedLatencyMs === 500);
}

async function handlerProof() {
  console.log('\nT5: real autofire handler emits the copy before either network dispatch');
  const fakeDb = strictStoreDouble();
  const fakeEfferenceStore = strictStoreDouble();
  const stale = await EFFERENCE.command(fakeEfferenceStore, {
    lane: 'research', cik: 'stale-handler-proof',
    sourceIdentity: { kind: 'test', value: 'never-retried' }, emittedAt: 1
  });
  fakeDb.values.set('autoqueue', [{
    status: 'PENDING', source: 'master-inbox', autofireEligible: true,
    recommendedLane: 'research', cik: '320193', portalSlug: 'apple',
    domain: 'medicine',
    sourceArtifactRef: 'research:apple:structural', sourcePatternSig: 'sig-apple',
    masterGate: { confidence: 0.95, readiness: 0.95, salience: 0.90, completeness: 1 },
    salience: 'HIGH', from: 'P5', to: 'P6', direction: 'stabilizing'
  }]);

  const replacements = new Map();
  function mock(file, exports) {
    const resolved = require.resolve(file);
    replacements.set(resolved, require.cache[resolved]);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  }

  const dbPath = path.join(ROOT, 'lib', 'limen-db.js');
  const stagePath = path.join(ROOT, 'lib', 'limen-stage-classifier.js');
  const portalPath = path.join(ROOT, 'lib', 'portal-loader.js');
  const cronPath = path.join(ROOT, 'lib', 'cron-auth.js');
  const budgetPath = path.join(ROOT, 'lib', 'autonomy-budget.js');
  const killPath = path.join(ROOT, 'lib', 'ai-kill-switch.js');
  const efferenceStorePath = path.join(ROOT, 'lib', 'autofire-efference-store.js');
  const brainStorePath = path.join(ROOT, 'lib', 'brain-shadow-store.js');
  const tradierSandboxPath = path.join(ROOT, 'lib', 'tradier-sandbox.js');
  mock(dbPath, fakeDb);
  mock(efferenceStorePath, fakeEfferenceStore);
  mock(brainStorePath, {
    async readCycle(domain) { return {
      domain: domain, ok: true, startedAt: 10, finishedAt: 11, cursorAfter: 9,
      relationshipEvidence: null,
      domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true }, outwardConsumersDeclared: 1 }
    }; }
  });
  mock(stagePath, {
    classifyStage() { return { stage: 'mature-operating' }; },
    routeLaneForStage() { return { allowed: true }; }
  });
  mock(portalPath, { async loadPortal() { return { source: 'test', portal: {
    cik: '320193', slug: 'apple', name: 'Apple Inc.', industry: 'Technology', sic: '3571',
    financialHealth: { latestQuarter: '2026Q2' }
  } }; } });
  mock(cronPath, { enforce() { return true; } });
  mock(budgetPath, {
    async status() { return { armed: true, remainingUsd: 20 }; },
    async check() { return { allow: true, remainingUsd: 20 }; },
    async record() { return { spentUsd: 0.3 }; }
  });
  mock(killPath, { async spendDisabled() { return false; }, async setSpendPaused() {} });
  const tradierCalls = [];
  mock(tradierSandboxPath, {
    async accountSnapshot() {
      tradierCalls.push('account');
      return { accountId: 'VA60523798', accountType: 'cash', totalCash: 1000,
        pendingCash: 0, unclearedFunds: 0, totalEquity: 1000, positions: [], orders: [] };
    },
    async previewOrder(order) {
      tradierCalls.push({ op: 'preview', order: order });
      return { status: 'ok', result: true, cost: 501, commission: 1, fees: 0 };
    },
    async placeOrder() { throw new Error('worker must never place a Tradier order'); }
  });

  const handlerPath = require.resolve(path.join(ROOT, 'handlers', 'limen-worker-autofire.js'));
  const previousHandler = require.cache[handlerPath];
  delete require.cache[handlerPath];
  const oldFetch = global.fetch;
  const oldMaster = process.env.ADMIN_MASTER;
  process.env.ADMIN_MASTER = 'test-master';
  const network = [];
  let persistOutputId = 'eo_research_apple_1';
  try {
    global.fetch = async function (url, options) {
      const commandKeys = Array.from(fakeEfferenceStore.values.keys()).filter(k =>
        k.startsWith('autofire_efference:') && fakeEfferenceStore.values.get(k).status === 'COMMANDED');
      ok('strict-store COMMANDED copy exists before network call ' + (network.length + 1),
        commandKeys.length === 1);
      network.push({ url: String(url), body: JSON.parse(options.body) });
      if (String(url).includes('expand-artifact-claude')) {
        return { async json() { return {
          ok: true, model: 'test-model', usage: { output_tokens: 50 },
          draftBody: 'Measured research draft without placeholders.',
          structured: { title: 'Apple structural research', sections: [], openItems: [], readyToSignChecklist: [], readyToSign: true, evidenceCitationsUsed: [] }
        }; } };
      }
      if (String(url).includes('limen-engine-output')) {
        return { async json() { return persistOutputId
          ? { ok: true, outputId: persistOutputId }
          : { ok: true }; } };
      }
      throw new Error('unexpected fetch ' + url);
    };

    const handler = require(handlerPath);
    const response = await invoke(handler, request('GET', '/api/limen-worker-autofire'));
    ok('actual handler runs the timeout sweep without a same-source retry',
      response.json.efferenceSweep.retired === 1 &&
      fakeEfferenceStore.values.get(EFFERENCE.recordKey(stale.copy.id)).status === 'UNRESOLVED');
    ok('actual handler completes one bounded research fire', response.code === 200 && response.json.fired === 1 && response.json.errors === 0, response.body);
    ok('actual handler made exactly expand then persist calls', network.length === 2 && /expand-artifact/.test(network[0].url) && /limen-engine-output/.test(network[1].url));
    ok('persisted artifact carries the same command identity', network[1].body.payload.autofire.efferenceCopyId === response.json.results[0].efferenceCopyId);
    const effKey = EFFERENCE.recordKey(response.json.results[0].efferenceCopyId);
    const eff = fakeEfferenceStore.values.get(effKey);
    ok('actual handler closes the copy from the persistence receipt', eff.status === 'EXECUTED' && eff.receipt.outputId === 'eo_research_apple_1');
    ok('audit result exposes motor and model state', response.json.results[0].motorStatus === 'EXECUTED' && response.json.results[0].forwardModel.modelN === 1);
    ok('queue is FIRED only after the actuator receipt', fakeDb.values.get('autoqueue')[0].status === 'FIRED' && fakeDb.values.get('autoqueue')[0].autofireOutputId === 'eo_research_apple_1');

    console.log('\nT5b: an ok response without outputId is not an actuator receipt');
    fakeDb.values.set('autoqueue', [{
      status: 'PENDING', source: 'master-inbox', autofireEligible: true,
      recommendedLane: 'investment', cik: '789019', portalSlug: 'microsoft',
      domain: 'technology',
      sourceArtifactRef: 'investment:microsoft:structural', sourcePatternSig: 'sig-msft',
      tradeIntent: { symbol: 'SPY', side: 'buy', quantity: 1, limitPrice: 500,
        maxNotionalUsd: 510, horizonDays: [30, 60, 90],
        sourceArtifactId: 'investment:microsoft:structural' },
      masterGate: { confidence: 0.95, readiness: 0.95, salience: 0.90, completeness: 1 },
      salience: 'HIGH', from: 'P5', to: 'P6', direction: 'stabilizing'
    }]);
    persistOutputId = null;
    network.length = 0;
    process.env.TRADIER_SANDBOX_AUTONOMY_ENABLED = '1';
    const missingReceipt = await invoke(handler, request('GET', '/api/limen-worker-autofire'));
    ok('Finance queue entry creates a sandbox preview before artifact dispatch',
      missingReceipt.json.results[0].financeB14Preview.status === 'PREVIEWED' &&
      tradierCalls.join(',').indexOf('account') >= 0 && tradierCalls.some(c => c && c.op === 'preview'));
    ok('sandbox preview preserves the explicit trade identity',
      missingReceipt.json.results[0].financeB14Preview.preview.intent.sourceArtifactId === 'investment:microsoft:structural' &&
      /^sel_/.test(missingReceipt.json.results[0].financeB14Preview.preview.intent.selectionId));
    ok('missing outputId becomes a failed fire', missingReceipt.json.errors === 1 && missingReceipt.json.fired === 0 && missingReceipt.json.results[0].reason === 'persist-missing-receipt');
    ok('motor record refuses EXECUTED without the receipt identity', missingReceipt.json.results[0].motorStatus === 'FAILED');
    ok('queue remains retryable rather than falsely FIRED', fakeDb.values.get('autoqueue')[0].status === 'PENDING' && fakeDb.values.get('autoqueue')[0].autofireAttempts === 1);

    console.log('\nT5c: real handler refuses all dispatch when the strict store is unavailable');
    fakeEfferenceStore.assertDurable = function () { throw new Error('Redis unavailable'); };
    network.length = 0;
    const unavailable = await invoke(handler, request('GET', '/api/limen-worker-autofire'));
    ok('strict-store outage fails the cron closed', unavailable.code === 503 && unavailable.json.paused === 'efference-sweep-failed');
    ok('strict-store outage makes no provider or persistence request', network.length === 0);
  } finally {
    global.fetch = oldFetch;
    delete process.env.TRADIER_SANDBOX_AUTONOMY_ENABLED;
    if (oldMaster === undefined) delete process.env.ADMIN_MASTER; else process.env.ADMIN_MASTER = oldMaster;
    if (previousHandler) require.cache[handlerPath] = previousHandler; else delete require.cache[handlerPath];
    for (const [resolved, previous] of replacements) {
      if (previous) require.cache[resolved] = previous;
      else delete require.cache[resolved];
    }
  }
}

async function outcomeIdentityProof() {
  console.log('\nT6: later reward event recovers motor identity from the persisted artifact');
  const outcomePath = require.resolve(path.join(ROOT, 'handlers', 'limen-outcome.js'));
  const previous = require.cache[outcomePath];
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const oldOperator = process.env.LIMEN_OPERATOR_TOKEN;
  const oldCron = process.env.CRON_SECRET;
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-test-token';
  delete process.env.LIMEN_OPERATOR_TOKEN;
  process.env.CRON_SECRET = 'learning-test-secret';
  delete require.cache[outcomePath];
  const learningPath = require.resolve(path.join(ROOT, 'lib', 'autofire-learning.js'));
  const previousLearning = require.cache[learningPath];
  let learnedEvent = null;
  require.cache[learningPath] = { id: learningPath, filename: learningPath, loaded: true, exports: {
    async recordOutcome(_store, event) { learnedEvent = event; return { ok: true, b12Updated: false }; }
  } };
  const oldFetch = global.fetch;
  try {
    global.fetch = async function (_url, options) {
      const cmd = JSON.parse(options.body);
      if (cmd[0] === 'GET' && cmd[1] === 'limen:engine_output:eo_research_apple_1') {
        return { ok: true, async json() { return { result: JSON.stringify({
          outputId: 'eo_research_apple_1', lane: 'research', cik: '320193',
          payload: { autofire: { ownerDomain: 'health', efferenceCopyId: 'efx_trace_1', actionId: 'act_trace_1' } }
        }) }; } };
      }
      return { ok: true, async json() { return { result: 1 }; } };
    };
    const outcome = require(outcomePath);
    const outcomeReq = request('POST', '/api/limen-outcome', {
      outputId: 'eo_research_apple_1', eventType: 'OUTCOME_RESEARCH_PUBLISHED',
      actor: 'test'
    });
    outcomeReq.headers.authorization = 'Bearer learning-test-secret';
    const response = await invoke(outcome, outcomeReq);
    ok('real outcome handler accepts the later research event', response.code === 201 && response.json.ok, response.body);
    ok('later event derives efference and action identity from the artifact', response.json.event.efferenceCopyId === 'efx_trace_1' && response.json.event.actionId === 'act_trace_1');
    ok('later event carries the owning domain into B12/B13 learning', learnedEvent && learnedEvent.ownerDomain === 'health');
  } finally {
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
    if (oldOperator === undefined) delete process.env.LIMEN_OPERATOR_TOKEN; else process.env.LIMEN_OPERATOR_TOKEN = oldOperator;
    if (oldCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldCron;
    if (previous) require.cache[outcomePath] = previous; else delete require.cache[outcomePath];
    if (previousLearning) require.cache[learningPath] = previousLearning; else delete require.cache[learningPath];
  }
}

(async function main() {
  await strictStoreBoundaryProofs();
  await moduleProofs();
  await handlerProof();
  await outcomeIdentityProof();
  console.log('\n' + checks + '/' + checks + ' passed');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
