#!/usr/bin/env node
'use strict';

const assert = require('assert');

const previousCron = process.env.CRON_SECRET;
const previousBrain = process.env.BRAIN_WEIGHTS_TOKEN;

function restoreEnv() {
  if (previousCron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousCron;
  if (previousBrain === undefined) delete process.env.BRAIN_WEIGHTS_TOKEN;
  else process.env.BRAIN_WEIGHTS_TOKEN = previousBrain;
}

function request(headers, url) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers || {})) normalized[key.toLowerCase()] = value;
  return { headers: normalized, url: url || '/api/brain-weights-cron' };
}

let passed = 0;
function check(label, actual, expected) {
  assert.strictEqual(actual, expected, label);
  passed++;
}

try {
  process.env.CRON_SECRET = 'cron-secret-123';
  process.env.BRAIN_WEIGHTS_TOKEN = 'brain-secret-456';

  const handler = require('../handlers/brain-weights-cron.js');
  const authorize = handler._authorizeWrite;
  check('auth seam exists', typeof authorize, 'function');

  check('configured secrets alone do not authorize', authorize(request()), false);
  check('correct cron bearer authorizes', authorize(request({ authorization: 'Bearer cron-secret-123' })), true);
  check('bearer scheme is case-insensitive', authorize(request({ authorization: 'bearer cron-secret-123' })), true);
  check('wrong cron bearer refuses', authorize(request({ authorization: 'Bearer wrong' })), false);
  check('empty bearer refuses', authorize(request({ authorization: 'Bearer ' })), false);
  check('raw authorization value refuses', authorize(request({ authorization: 'cron-secret-123' })), false);

  check('correct operator header authorizes',
    authorize(request({ 'x-brain-token': 'brain-secret-456' })), true);
  check('wrong operator header refuses',
    authorize(request({ 'x-brain-token': 'wrong' })), false);
  check('brain secret may use bearer',
    authorize(request({ authorization: 'Bearer brain-secret-456' })), true);

  check('query-string cron secret is ignored',
    authorize(request({}, '/api/brain-weights-cron?token=cron-secret-123')), false);
  check('query-string brain secret is ignored',
    authorize(request({}, '/api/brain-weights-cron?token=brain-secret-456')), false);

  delete process.env.CRON_SECRET;
  check('operator credential still works without cron secret',
    authorize(request({ 'x-brain-token': 'brain-secret-456' })), true);
  check('former cron credential refuses when cron secret absent',
    authorize(request({ authorization: 'Bearer cron-secret-123' })), false);

  delete process.env.BRAIN_WEIGHTS_TOKEN;
  check('all writes refuse when both secrets absent',
    authorize(request({ authorization: 'Bearer brain-secret-456' })), false);

  process.env.CRON_SECRET = 'cron-secret-123';
  const fetchHeaders = new Headers({ authorization: 'Bearer cron-secret-123' });
  check('Fetch Headers shape is supported', authorize({ headers: fetchHeaders }), true);

  console.log(passed + '/' + passed + ' passed');
} finally {
  restoreEnv();
}
