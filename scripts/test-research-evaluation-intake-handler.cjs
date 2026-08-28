'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const HANDLER = path.join(ROOT, 'handlers', 'research-evaluation-intake.js');
const INTAKE = path.join(ROOT, 'lib', 'research-evaluation-intake.js');

function mock(file, exports, replacements) { const resolved = require.resolve(file); replacements.push([resolved, require.cache[resolved]]); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; }
function response() { return { statusCode: 200, body: '', setHeader() {}, end(value) { this.body = value || ''; } }; }
async function invoke(handler, headers, body) { const res = response(); await handler({ method: 'POST', url: '/api/research-evaluation-intake', headers: headers || {}, body: body || {} }, res); return { code: res.statusCode, json: JSON.parse(res.body || '{}') }; }

(async function () {
  const oldSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'evaluation-intake-secret';
  const replacements = [], calls = [];
  let result = { ok: true, admitted: true, duplicate: false, record: { intakeId: 'rei_1' } };
  mock(INTAKE, { async persist(_store, input) { calls.push(input); return result; } }, replacements);
  delete require.cache[require.resolve(HANDLER)];
  const handler = require(HANDLER);
  try {
    const unauthorized = await invoke(handler, {}, { evaluation: 'x' });
    assert.equal(unauthorized.code, 401);
    assert.equal(calls.length, 0);
    const admitted = await invoke(handler, { authorization: 'Bearer evaluation-intake-secret' }, { evaluation: 'x' });
    assert.equal(admitted.code, 201);
    assert.equal(calls.length, 1);
    result = { ok: false, admitted: false, error: 'evaluation-input-refused', blockers: ['source-separated-evidence-required'] };
    const refused = await invoke(handler, { authorization: 'Bearer evaluation-intake-secret' }, { evaluation: 'bad' });
    assert.equal(refused.code, 422);
    assert.deepEqual(refused.json.blockers, ['source-separated-evidence-required']);
    result = { ok: false, admitted: false, error: 'evaluation-input-not-durable' };
    const unavailable = await invoke(handler, { authorization: 'Bearer evaluation-intake-secret' }, { evaluation: 'x' });
    assert.equal(unavailable.code, 503);
    console.log('research evaluation intake handler: auth, admission, refusal, and durability failure passed');
  } finally {
    if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret;
    delete require.cache[require.resolve(HANDLER)];
    replacements.forEach(function (row) { if (row[1]) require.cache[row[0]] = row[1]; else delete require.cache[row[0]]; });
  }
})().catch(function (error) { console.error(error); process.exit(1); });
