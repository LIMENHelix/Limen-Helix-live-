#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const handler = require('../handlers/finance-preview.js');

function response() {
  return { statusCode: null, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    end(v) { this.body = v; } };
}

(async function () {
  const prior = process.env.BRAIN_SHADOW_TOKEN;
  process.env.BRAIN_SHADOW_TOKEN = 'preview-test-token';
  let res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, 'unauthorized');

  res = response();
  await handler({ method: 'POST', headers: { 'x-brain-token': 'preview-test-token' } }, res);
  assert.equal(res.statusCode, 405);

  res = response();
  await handler({ method: 'GET', headers: { 'x-brain-token': 'preview-test-token' } }, res);
  assert.equal(res.statusCode, 503);
  const failed = JSON.parse(res.body);
  assert.equal(failed.providerCalled, false);
  assert.equal(failed.brokerTouched, false);

  if (prior === undefined) delete process.env.BRAIN_SHADOW_TOKEN;
  else process.env.BRAIN_SHADOW_TOKEN = prior;
  console.log('finance preview handler: 6/6 passed');
}()).catch(function (e) { console.error(e); process.exitCode = 1; });
