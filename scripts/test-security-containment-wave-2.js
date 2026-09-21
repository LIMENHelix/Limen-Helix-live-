#!/usr/bin/env node
'use strict';

/**
 * scripts/test-security-containment-wave-2.js — anonymous-sweep for PR-003.
 *
 * Every route secured in security containment wave 2 is invoked the way an
 * anonymous internet caller would invoke it, and must REFUSE. Run:
 *   node scripts/test-security-containment-wave-2.js
 *
 *   T1  6 cron workers: anonymous → 401, forged x-vercel-cron → 401,
 *       CRON_SECRET unset → 503 (fail closed, never header-trusting)
 *   T2  cron-repair-held / cron-rebuild-engine-outputs: the forgeable-header
 *       fallback is gone — forged x-vercel-cron no longer authorizes, even
 *       with CRON_SECRET unset (previously a free paid-Anthropic trigger)
 *   T3  redis-diag: admin-gated, and the response carries NO token material
 *   T4  relay-demand-dashboard: anonymous → 403 (customer PII + margins)
 *   T5  ingest bridges (realauction / industry / energy-distress): fail closed
 *       when LEAD_ADMIN_KEY is unset — an unconfigured endpoint rejects
 *   T6  LIMEN_OPERATOR_TOKEN endpoints: token unset → 503, token set +
 *       anonymous → 401, correct bearer → past auth
 *   T7  homestead-automail: the /control 'automail' valve actually vetoes,
 *       and the manual lobSend path carries a deterministic Idempotency-Key
 *       (same key → Lob replays → one physical letter)
 *   T8  structural: the admin desk no longer passes its key in a URL
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/* ── mocks ─────────────────────────────────────────────────────────────── */

function mkRes() {
  const out = { status: 200, body: null, headers: {} };
  const res = {
    statusCode: 200,
    setHeader: function (k, v) { out.headers[String(k).toLowerCase()] = v; },
    status: function (c) { out.status = c; res.statusCode = c; return res; },
    json: function (o) { out.body = o; out.status = res.statusCode; return res; },
    end: function (s) {
      out.status = res.statusCode;
      try { out.body = s ? JSON.parse(s) : null; } catch (e) { out.body = s; }
    }
  };
  return { out: out, res: res };
}

function mkReq(opts) {
  opts = opts || {};
  const headers = {};
  Object.keys(opts.headers || {}).forEach(function (k) { headers[k.toLowerCase()] = opts.headers[k]; });
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : null;
  const req = {
    method: opts.method || 'GET',
    url: opts.url || '/api/x',
    headers: headers,
    query: opts.query || {},
    body: bodyStr,
    on: function (ev, cb) {
      if (ev === 'data' && bodyStr) cb(bodyStr);
      if (ev === 'end') cb();
      return req;
    }
  };
  return req;
}

async function invoke(handler, opts) {
  const r = mkRes();
  const req = mkReq(opts);
  await handler(req, r.res);
  return r.out;
}

function freshRequire(rel) {
  const p = require.resolve(rel);
  delete require.cache[p];
  return require(p);
}

/* fetch stub: routes by URL, counts Lob letter creations, replays Idempotency-Key. */
const lobCalls = [];           // every api.lob.com call: { idempotencyKey, id }
const lobByKey = {};           // key -> first response (Lob replay semantics)
let lobCreations = 0;
const realFetch = global.fetch;
global.fetch = function (url, opts) {
  url = String(url);
  if (url.indexOf('api.lob.com') !== -1) {
    const key = opts && opts.headers && opts.headers['Idempotency-Key'];
    if (key && lobByKey[key]) {
      lobCalls.push({ idempotencyKey: key, id: lobByKey[key], replayed: true });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: lobByKey[key] }) });
    }
    lobCreations++;
    const id = 'ltr_' + lobCreations;
    if (key) lobByKey[key] = id;
    lobCalls.push({ idempotencyKey: key || null, id: id, replayed: false });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: id }) });
  }
  if (url.indexOf('upstash') !== -1 || url.indexOf('fake-db') !== -1) {
    return Promise.resolve({ status: 200, statusText: 'OK', text: async () => '{"result":"PONG"}' });
  }
  // every other URL (RSS, domain-snapshot): empty but valid
  return Promise.resolve({
    status: 200,
    json: async () => ({ domains: {} }),
    text: async () => ''
  });
};

/* in-memory limen-db stand-in, seeded into require.cache BEFORE any handler that
   uses it loads (pattern from scripts/test-automail-leadtime.js). */
const store = {};
const fakeDb = {
  get: async (k) => store[k],
  set: async (k, v) => { store[k] = v; return true; },
  del: async (k) => { delete store[k]; return true; },
  lpush: async (k, v) => { (store[k] = store[k] || []).unshift(v); return true; },
  ltrim: async () => true,
  lrange: async (k, a, b) => { const l = store[k] || []; return b < 0 ? l.slice(a) : l.slice(a, b + 1); },
  getBackend: () => 'memory'
};
const dbPath = require.resolve(path.join(ROOT, 'lib', 'limen-db.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

/* ── env ───────────────────────────────────────────────────────────────── */
process.env.CRON_SECRET = 'cw2-cron-secret';
process.env.ADMIN_MASTER = 'cw2-master';
process.env.LEAD_ADMIN_KEY = 'cw2-lead';
process.env.RELAY_ADMIN_KEY = 'cw2-relay';
delete process.env.LIMEN_OPERATOR_TOKEN;

const CRON = { authorization: 'Bearer cw2-cron-secret' };

(async function () {

  console.log('T1: cron workers refuse anonymous and forged-header callers');
  const workers = [
    ['limen-worker-ingest', {}],
    ['limen-worker-snapshot', {}],
    ['limen-worker-score', {}],
    ['limen-worker-stress-refresh', {}],
    ['feed-record', { url: '/api/feed-record' }],                 // write mode
    ['feed-resolve', { url: '/api/feed-resolve?emit=1' }]         // emit mode
  ];
  for (const [name, opts] of workers) {
    const h = freshRequire('../handlers/' + name + '.js');
    let r = await invoke(h, opts);
    assert(name + ': anonymous → 401', r.status === 401, r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
    r = await invoke(h, Object.assign({}, opts, { headers: { 'x-vercel-cron': '1' } }));
    assert(name + ': forged x-vercel-cron → 401', r.status === 401, String(r.status));
    r = await invoke(h, Object.assign({}, opts, { headers: { 'user-agent': 'vercel-cron/1.0' } }));
    assert(name + ': spoofed cron user-agent → 401', r.status === 401, String(r.status));
    delete process.env.CRON_SECRET;
    r = await invoke(h, Object.assign({}, opts, { headers: { 'x-vercel-cron': '1', authorization: 'Bearer anything' } }));
    assert(name + ': CRON_SECRET unset → 503 (fail closed)', r.status === 503, String(r.status));
    process.env.CRON_SECRET = 'cw2-cron-secret';
  }

  // Positive: the real cron bearer still runs the write paths.
  {
    const fr = freshRequire('../handlers/feed-record.js');
    delete store['feedhist:index'];
    const r = await invoke(fr, { url: '/api/feed-record', headers: CRON });
    assert('feed-record: cron bearer passes auth', r.status === 200 && r.body && r.body.ok === true,
      r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    const rz = freshRequire('../handlers/feed-resolve.js');
    await fakeDb.set('feedhist:index', []);
    const r2 = await invoke(rz, { url: '/api/feed-resolve?emit=1', headers: CRON });
    assert('feed-resolve emit: cron bearer passes auth', r2.status === 200 && r2.body && r2.body.ok === true,
      r2.status + ' ' + JSON.stringify(r2.body).slice(0, 160));
    // read paths stay open (low-sensitivity calibration state)
    const r3 = await invoke(fr, { url: '/api/feed-record?stats=1' });
    assert('feed-record: ?stats=1 read stays open', r3.status === 200, String(r3.status));
  }

  console.log('T2: forgeable-header fallback removed from repair/rebuild handlers');
  for (const name of ['cron-repair-held', 'cron-rebuild-engine-outputs']) {
    const h = freshRequire('../handlers/' + name + '.js');
    let r = await invoke(h, { headers: { 'x-vercel-cron': '1' } });
    assert(name + ': forged x-vercel-cron → 401', r.status === 401, String(r.status));
    delete process.env.CRON_SECRET;
    r = await invoke(h, { headers: { 'x-vercel-cron': '1' } });
    assert(name + ': forged header + unset secret → 503, NOT a free run', r.status === 503, String(r.status));
    process.env.CRON_SECRET = 'cw2-cron-secret';
    r = await invoke(h, { headers: CRON });
    assert(name + ': real cron bearer passes auth (503s later on missing Upstash, after auth)',
      r.status === 503 && /UPSTASH/i.test(JSON.stringify(r.body)), r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
    r = await invoke(h, { method: 'POST' });
    assert(name + ': anonymous operator POST → 403', r.status === 403, String(r.status));
  }

  console.log('T3: redis-diag gated, no token material in the response');
  {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-db.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'ABCDEF123456secretTOKENtail';
    const h = freshRequire('../handlers/redis-diag.js');
    let r = await invoke(h, { url: '/api/redis-diag?probe=1' });
    assert('redis-diag: anonymous → 403', r.status === 403, String(r.status));
    r = await invoke(h, { url: '/api/redis-diag?probe=1', headers: { 'x-limen-pass': 'wrong' } });
    assert('redis-diag: wrong pass → 403', r.status === 403, String(r.status));
    r = await invoke(h, { url: '/api/redis-diag?probe=1', headers: { 'x-limen-pass': 'cw2-master' } });
    assert('redis-diag: master pass → 200', r.status === 200, r.status + ' ' + JSON.stringify(r.body).slice(0, 100));
    const raw = JSON.stringify(r.body);
    assert('redis-diag: no token_prefix field', !r.body.env || r.body.env.token_prefix === undefined);
    assert('redis-diag: no token_suffix field', !r.body.env || r.body.env.token_suffix === undefined);
    assert('redis-diag: response contains no token characters',
      raw.indexOf('ABCDEF') === -1 && raw.indexOf('TOKENtail') === -1 && raw.indexOf('123456secret') === -1,
      raw.slice(0, 200));
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  console.log('T4: relay-demand-dashboard refuses anonymous callers');
  {
    const h = freshRequire('../handlers/relay-demand-dashboard.js');
    let r = await invoke(h, { query: { action: 'orders' } });
    assert('demand-dashboard: anonymous → 403', r.status === 403, String(r.status));
    delete process.env.RELAY_ADMIN_KEY;
    r = await invoke(h, { query: { action: 'status', key: 'cw2-relay' } });
    assert('demand-dashboard: RELAY_ADMIN_KEY unset → 403 even with a key supplied', r.status === 403, String(r.status));
    process.env.RELAY_ADMIN_KEY = 'cw2-relay';
    r = await invoke(h, { query: { action: 'orders' }, headers: { 'x-relay-key': 'cw2-relay' } });
    assert('demand-dashboard: x-relay-key header passes', r.status === 200 && r.body && Array.isArray(r.body.orders),
      r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
  }

  console.log('T5: ingest bridges fail closed when LEAD_ADMIN_KEY is unset');
  for (const name of ['realauction-ingest', 'industry-ingest', 'energy-distress-ingest']) {
    const h = freshRequire('../handlers/' + name + '.js');
    delete process.env.LEAD_ADMIN_KEY;
    let r = await invoke(h, {});
    assert(name + ': GET with key env unset → 403', r.status === 403, String(r.status));
    r = await invoke(h, { method: 'POST', body: { deals: [] } });
    assert(name + ': POST with key env unset → 403 (previously accepted!)', r.status === 403, String(r.status));
    process.env.LEAD_ADMIN_KEY = 'cw2-lead';
    r = await invoke(h, {});
    assert(name + ': anonymous GET → 403', r.status === 403, String(r.status));
    r = await invoke(h, { headers: { 'x-limen-pass': 'cw2-lead' } });
    assert(name + ': x-limen-pass header passes', r.status === 200, String(r.status));
    r = await invoke(h, { method: 'POST', body: { key: 'cw2-lead', deals: [{ state: 'FL', county: 'Test' }] } });
    assert(name + ': POST with body key still works (scraper pattern)', r.status === 200,
      r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
  }

  console.log('T6: LIMEN_OPERATOR_TOKEN endpoints fail closed when the token is unset');
  delete process.env.LIMEN_OPERATOR_TOKEN;
  {
    const postTargets = [
      ['limen-autoqueue', { method: 'PATCH', body: {} }],
      ['limen-iteration', { method: 'POST', body: {} }],
      ['limen-self-pulse', { method: 'POST', body: {} }],
      ['limen-operator-calibration', { method: 'POST', body: {} }]
    ];
    for (const [name, opts] of postTargets) {
      const h = freshRequire('../handlers/' + name + '.js');
      const r = await invoke(h, opts);
      assert(name + ': token unset → 503 mutation-auth-unconfigured',
        r.status === 503 && r.body && r.body.reason === 'mutation-auth-unconfigured',
        r.status + ' ' + JSON.stringify(r.body).slice(0, 140));
    }
    const sp = freshRequire('../handlers/limen-stress-propagation.js');
    let r = await invoke(sp, { url: '/api/limen-stress-propagation?compute=1' });
    assert('limen-stress-propagation: compute with token unset → 503',
      r.status === 503 && r.body && r.body.reason === 'mutation-auth-unconfigured',
      r.status + ' ' + JSON.stringify(r.body).slice(0, 140));
  }
  {
    // limen-outcome's documented credential is OPERATOR_TOKEN falling back to the
    // server-held CRON_SECRET; it fails closed only when NEITHER exists.
    const savedCron = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    let h = freshRequire('../handlers/limen-outcome.js');
    let r = await invoke(h, { method: 'POST', body: {} });
    assert('limen-outcome: no operator token AND no cron secret → 503',
      r.status === 503 && r.body && r.body.reason === 'mutation-auth-unconfigured',
      r.status + ' ' + JSON.stringify(r.body).slice(0, 140));
    process.env.CRON_SECRET = savedCron;
    h = freshRequire('../handlers/limen-outcome.js');
    r = await invoke(h, { method: 'POST', body: {} });
    assert('limen-outcome: cron-secret-only deployment still rejects anonymous → 401', r.status === 401, String(r.status));
    r = await invoke(h, { method: 'POST', body: {}, headers: { authorization: 'Bearer cw2-cron-secret' } });
    assert('limen-outcome: cron bearer passes in a cron-secret-only deployment (not 401/503)',
      r.status !== 401 && r.status !== 503, String(r.status) + ' ' + JSON.stringify(r.body).slice(0, 100));
  }
  {
    // reciprocity sits behind the AI kill switch first; stub that switch open so
    // the AUTH gate underneath is what answers (its own behavior is pinned elsewhere).
    const ksPath = require.resolve('../lib/ai-kill-switch.js');
    require.cache[ksPath] = { id: ksPath, filename: ksPath, loaded: true,
      exports: { spendDisabled: async () => false } };
    const h = freshRequire('../handlers/limen-reciprocity-prose-rewrite.js');
    const r = await invoke(h, { method: 'POST', body: {} });
    assert('limen-reciprocity-prose-rewrite: token unset → 503 mutation-auth-unconfigured',
      r.status === 503 && r.body && r.body.reason === 'mutation-auth-unconfigured',
      r.status + ' ' + JSON.stringify(r.body).slice(0, 140));
    delete require.cache[ksPath];
  }

  console.log('T6b: with the token set, anonymous is 401 and the bearer passes');
  process.env.LIMEN_OPERATOR_TOKEN = 'cw2-operator';
  {
    const postTargets = [
      ['limen-autoqueue', { method: 'PATCH', body: {} }],
      ['limen-iteration', { method: 'POST', body: {} }],
      ['limen-self-pulse', { method: 'POST', body: {} }],
      ['limen-operator-calibration', { method: 'POST', body: {} }]
    ];
    for (const [name, opts] of postTargets) {
      const h = freshRequire('../handlers/' + name + '.js');
      let r = await invoke(h, opts);
      assert(name + ': anonymous → 401', r.status === 401, String(r.status));
      r = await invoke(h, Object.assign({}, opts, { headers: { authorization: 'Bearer wrong' } }));
      assert(name + ': wrong bearer → 401', r.status === 401, String(r.status));
      r = await invoke(h, Object.assign({}, opts, { headers: { authorization: 'Bearer cw2-operator' } }));
      assert(name + ': correct bearer passes auth (400 on empty body, not 401/503)',
        r.status !== 401 && r.status !== 503, String(r.status) + ' ' + JSON.stringify(r.body).slice(0, 100));
    }
    {
      const h = freshRequire('../handlers/limen-outcome.js');
      let r = await invoke(h, { method: 'POST', body: {} });
      assert('limen-outcome: anonymous → 401', r.status === 401, String(r.status));
      r = await invoke(h, { method: 'POST', body: {}, headers: { authorization: 'Bearer cw2-cron-secret' } });
      assert('limen-outcome: cron secret does NOT pass once an operator token exists → 401', r.status === 401, String(r.status));
      r = await invoke(h, { method: 'POST', body: {}, headers: { authorization: 'Bearer cw2-operator' } });
      assert('limen-outcome: operator bearer passes (not 401/503)', r.status !== 401 && r.status !== 503, String(r.status));
    }
    const sp = freshRequire('../handlers/limen-stress-propagation.js');
    let r = await invoke(sp, { url: '/api/limen-stress-propagation?compute=1' });
    assert('limen-stress-propagation: anonymous compute → 401', r.status === 401, String(r.status));
    const ksPath = require.resolve('../lib/ai-kill-switch.js');
    require.cache[ksPath] = { id: ksPath, filename: ksPath, loaded: true,
      exports: { spendDisabled: async () => false } };
    const rw = freshRequire('../handlers/limen-reciprocity-prose-rewrite.js');
    r = await invoke(rw, { method: 'POST', body: {} });
    assert('limen-reciprocity-prose-rewrite: anonymous → 401', r.status === 401, String(r.status));
    r = await invoke(rw, { method: 'POST', body: {}, headers: { authorization: 'Bearer cw2-operator' } });
    assert('limen-reciprocity-prose-rewrite: correct bearer passes auth (400 on empty body)',
      r.status === 400, String(r.status));
    delete require.cache[ksPath];
    delete process.env.LIMEN_OPERATOR_TOKEN;
  }

  console.log('T7: automail valve vetoes; manual lobSend is idempotent per key');
  {
    process.env.LEAD_ADMIN_KEY = 'cw2-lead';
    process.env.LOB_API_KEY = 'test_lob_cw2';
    store['homestead:automail'] = { armed: true, cap: 20, states: ['FL'], mailedTotal: 0 };
    store['realauction:deals'] = [
      { parcel: 'P1', workFirst: true, equity: 50000, state: 'FL', saleDate: '08/15/2026',
        owner: { name: 'Test Owner', mailAddr: '1 Main St', mailCity: 'Tampa', mailState: 'FL', mailZip: '33601' } }
    ];
    store['homestead:mailconfig'] = { fromName: 'Op', fromLine1: '2 Oak St', fromCity: 'Tampa', fromState: 'FL', fromZip: '33602' };

    store['hb:valve:automail'] = { open: false, reason: 'shut from /control', at: Date.now() };
    const h = freshRequire('../handlers/homestead-automail.js');
    const lobBefore = lobCalls.length;
    let r = await invoke(h, { method: 'POST', body: { key: 'cw2-lead', action: 'send' } });
    assert('automail: shut valve vetoes the send (200 acted:false)',
      r.status === 200 && r.body && r.body.acted === false && r.body.vetoed === true && r.body.job === 'automail',
      r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    assert('automail: vetoed run placed zero Lob calls', lobCalls.length === lobBefore, String(lobCalls.length - lobBefore));

    store['hb:valve:automail'] = { open: true };
    const h2 = freshRequire('../handlers/homestead-automail.js');
    r = await invoke(h2, { method: 'POST', body: { key: 'cw2-lead', action: 'mailone', dealKey: 'P1' } });
    assert('automail: open valve lets mailone run', r.status === 200 && r.body && r.body.ok === true && r.body.mode === 'mailed-one',
      r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    const firstKey = lobCalls[lobCalls.length - 1] && lobCalls[lobCalls.length - 1].idempotencyKey;
    assert('automail: mailone carries the deterministic Idempotency-Key', firstKey === 'homestead-mailone-P1', String(firstKey));

    // crash-after-send: the mailed marker is gone, the operator clicks again.
    store['homestead:mailed'] = {};
    const creationsBefore = lobCreations;
    r = await invoke(h2, { method: 'POST', body: { key: 'cw2-lead', action: 'mailone', dealKey: 'P1' } });
    assert('automail: re-sent mailone reaches Lob with the SAME key (provider replays)',
      r.status === 200 && lobCalls[lobCalls.length - 1].idempotencyKey === 'homestead-mailone-P1'
        && lobCalls[lobCalls.length - 1].replayed === true,
      JSON.stringify(lobCalls[lobCalls.length - 1]));
    assert('automail: same key → one letter command (no second creation)', lobCreations === creationsBefore,
      'creations ' + creationsBefore + ' → ' + lobCreations);

    // handler-level dedupe still holds when the marker survives
    const before3 = lobCalls.length;
    r = await invoke(h2, { method: 'POST', body: { key: 'cw2-lead', action: 'mailone', dealKey: 'P1' } });
    assert('automail: mailed marker short-circuits a third click', r.body && r.body.already === true && lobCalls.length === before3);

    delete process.env.LOB_API_KEY;
  }

  console.log('T8: admin desk no longer passes its key in a URL');
  {
    const html = require('fs').readFileSync(path.join(ROOT, 'admin-homestead.html'), 'utf8');
    assert('admin-homestead: no homestead-automail?key= URL', html.indexOf('homestead-automail?key=') === -1);
    assert('admin-homestead: arm-state read uses the x-limen-pass header', html.indexOf("'x-limen-pass':KEY") !== -1);
  }

  global.fetch = realFetch;
  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})().catch(function (e) {
  global.fetch = realFetch;
  console.error(e && e.stack || e);
  process.exit(1);
});
