'use strict';

/** Authenticated, durable input boundary for independent research evaluations. */

var cronAuth = require('../lib/cron-auth.js');
var store = require('../lib/autofire-efference-store.js');
var Intake = require('../lib/research-evaluation-intake.js');

function readJson(req) {
  if (req && req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (chunk) { chunks.push(Buffer.from(chunk)); });
    req.on('end', function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (error) { reject(new Error('invalid-json')); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end(JSON.stringify({ ok: false, error: 'POST only' }));
  }
  if (!cronAuth.enforce(req, res)) return;
  try {
    var result = await Intake.persist(store, await readJson(req), Date.now());
    res.statusCode = result.ok ? (result.duplicate ? 200 : 201) : (result.error === 'evaluation-input-refused' ? 422 : 503);
    return res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = error && error.message === 'invalid-json' ? 400 : 503;
    return res.end(JSON.stringify({ ok: false, error: error && error.message || 'research-evaluation-intake-failed' }));
  }
};

