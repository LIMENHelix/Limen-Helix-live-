#!/usr/bin/env node
'use strict';

/**
 * test-fetch-portal-containment.js — the GitHub quota proxy stays public for
 * the exact family public pages need, and nothing else.
 *
 * Dependency map (grep of assets/js, root *.html, pages/, portals/): every
 * call site requests /api/fetch-portal?domainId=<slug> and expects the domain
 * portal JSON — the clarity-operator family, domain-brains (base + console),
 * portal-ui.js, trade/infrastructure/agriculture operators and finance-console.html
 * all use the same shape. No call site requests any other repo path or file
 * family. So the proxy is constrained to exactly:
 *   repo  LIMENHelix/Limen-Helix
 *   path  assets/data/domains/<id>.json   with <id> = /^[A-Za-z0-9_-]{1,120}$/
 * In-family reads stay anonymous (they are the public fallback when the static
 * file is missing); every other shape is rejected before a token is spent.
 *
 * Properties under test:
 *   1. Anonymous in-family request → 200 with the decoded GitHub content, and
 *      the upstream URL is exactly the allowed repo + path prefix.
 *   2. Out-of-family / traversal / abuse shapes → 400 with ZERO upstream fetches.
 *   3. The server token is used upstream but never appears in the response.
 *   4. GitHub 404 → 404 passthrough; token unset → 500 fail closed.
 *
 * global.fetch is stubbed and records every URL; no network is touched.
 */

const assert = require('assert');

const SAVED = {};
['GITHUB_TOKEN', 'GH_TOKEN', 'VERCEL_GITHUB_TOKEN'].forEach(function (k) { SAVED[k] = process.env[k]; });

function restoreEnv() {
  Object.keys(SAVED).forEach(function (k) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  });
}

const TOKEN = 'ghp_fetchportaltesttoken0000';

const REAL_FETCH = global.fetch;
const fetchedUrls = [];
let githubStatus = 200;
global.fetch = async function (url, opts) {
  fetchedUrls.push(String(url));
  return {
    ok: githubStatus >= 200 && githubStatus < 300,
    status: githubStatus,
    json: async function () {
      return { content: Buffer.from(JSON.stringify({ activations: [] })).toString('base64') };
    }
  };
};

const handler = require('../handlers/fetch-portal.js');

let passed = 0;
function check(label, actual, expected) {
  assert.strictEqual(actual, expected, label);
  passed++;
}

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

function request(query) {
  return { headers: {}, query: query, url: '/api/fetch-portal' };
}

async function main() {
  process.env.GITHUB_TOKEN = TOKEN;
  delete process.env.GH_TOKEN;
  delete process.env.VERCEL_GITHUB_TOKEN;
  githubStatus = 200;

  // ── anonymous in-family read passes ────────────────────────────────────────
  let r = await invoke(request({ domainId: 'energy_battery_battrecycling_collection' }));
  check('in-family anonymous passes (status)', r.status, 200);
  check('decoded payload returned', JSON.stringify(r.body), JSON.stringify({ activations: [] }));
  check('exactly one upstream fetch', fetchedUrls.length, 1);
  check('upstream URL is the allowed repo + prefix',
    fetchedUrls[0],
    'https://api.github.com/repos/LIMENHelix/Limen-Helix/contents/assets/data/domains/energy_battery_battrecycling_collection.json');

  // ── server token used upstream, never in the response ─────────────────────
  const blob = JSON.stringify(r.body) + JSON.stringify(r.headers);
  check('token absent from response', blob.indexOf(TOKEN), -1);

  // ── out-of-family / traversal / abuse shapes never reach GitHub ────────────
  const BAD = [
    '../../secrets',
    '..%2f..%2fsecrets',
    'a/b',
    'a\\b',
    '..',
    'x y',
    'x.json',
    'x'.repeat(121),
    'x'.repeat(5000),
    '\x00etc',
    'domains/energy',
    'energy.json/../../x'
  ];
  for (const bad of BAD) {
    fetchedUrls.length = 0;
    r = await invoke(request({ domainId: bad }));
    check('abuse shape ' + JSON.stringify(String(bad).slice(0, 30)) + ' refuses (status)', r.status, 400);
    check('abuse shape performed zero upstream fetches', fetchedUrls.length, 0);
  }

  fetchedUrls.length = 0;
  r = await invoke(request({}));
  check('missing domainId refuses (status)', r.status, 400);
  check('missing domainId performed zero upstream fetches', fetchedUrls.length, 0);

  // ── boundary: 120-char slug still in family ────────────────────────────────
  fetchedUrls.length = 0;
  const maxSlug = 'a'.repeat(120);
  r = await invoke(request({ domainId: maxSlug }));
  check('120-char slug passes (status)', r.status, 200);
  check('120-char slug hit the allowed prefix',
    fetchedUrls[0].indexOf('assets/data/domains/' + maxSlug + '.json') !== -1, true);

  // ── GitHub 404 passthrough, token-missing fail closed ──────────────────────
  fetchedUrls.length = 0;
  githubStatus = 404;
  r = await invoke(request({ domainId: 'energy' }));
  check('github 404 passes through (status)', r.status, 404);
  githubStatus = 200;

  delete process.env.GITHUB_TOKEN;
  fetchedUrls.length = 0;
  r = await invoke(request({ domainId: 'energy' }));
  check('token unset fails closed (status)', r.status, 500);
  check('token unset performed zero upstream fetches', fetchedUrls.length, 0);
  process.env.GITHUB_TOKEN = TOKEN;

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
