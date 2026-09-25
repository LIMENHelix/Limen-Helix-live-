'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const boundaryPath = require.resolve('../lib/paid-provider-boundary');
const adapterPath = require.resolve('../lib/relay-paid-provider');
const guardPath = require.resolve('../lib/civilization-adapter-guard');
const storePath = require.resolve('../lib/autofire-efference-store');
const savedBoundary = require.cache[boundaryPath];
const savedAdapter = require.cache[adapterPath];
const savedGuard = require.cache[guardPath];
const savedStore = require.cache[storePath];
const calls = [];

require.cache[boundaryPath] = {
  id: boundaryPath,
  filename: boundaryPath,
  loaded: true,
  exports: {
    reserve: async function (options) {
      calls.push({ kind: 'reserve', options: options });
      return { ok: true, id: 'r-' + calls.length, estUsd: options.costUsd };
    },
    settle: async function (reservation, actual) {
      calls.push({ kind: 'settle', reservation: reservation, actual: actual });
      return { ok: true };
    }
  }
};
require.cache[guardPath] = {
  id: guardPath,
  filename: guardPath,
  loaded: true,
  exports: {
    checkpoint: async function (store, valveId, effect) {
      calls.push({ kind: 'checkpoint', store: store, valveId: valveId, effect: effect });
      return { allowed: true, valveId: valveId };
    }
  }
};
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: { assertDurable: function () { return true; } }
};
delete require.cache[adapterPath];

(async function () {
  const adapter = require('../lib/relay-paid-provider');
  delete process.env.RELAY_PROVIDER_DAILY_CAP_USD;
  delete process.env.RELAY_XAI_IMAGE_COST_USD;
  delete process.env.RELAY_SEARCH_OPERATION_COST_USD;

  const image = await adapter.reserveImage('  Desk Organizer  ');
  const search = await adapter.reserveSearch('serpapi-shopping', 'Desk Organizer');
  await adapter.settle(search);

  assert.equal(image.ok, true);
  assert.equal(calls[0].kind, 'checkpoint');
  assert.equal(calls[0].valveId, 'trade:relay-sourcing');
  assert.equal(calls[1].options.scope, 'relay:paid-provider');
  assert.equal(calls[1].options.scopeDailyCapUsd, 1);
  assert.equal(calls[1].options.costUsd, 0.20);
  assert.equal(calls[3].options.costUsd, 0.02);
  assert.match(calls[1].options.idempotencyKey, /^relay:image:xai:[a-f0-9]{64}$/);
  assert.match(calls[3].options.idempotencyKey, /^relay:search:serpapi-shopping:[a-f0-9]{64}$/);
  assert.equal(calls[4].kind, 'settle');
  assert.equal(calls[4].actual.estimatedUsd, 0.02);

  const again = await adapter.reserveImage('desk organizer');
  assert.equal(calls[6].options.idempotencyKey, calls[1].options.idempotencyKey,
    'normalized provider identity must produce a stable idempotency key');
  assert.equal(again.ok, true);

  process.env.RELAY_PROVIDER_DAILY_CAP_USD = '3.5';
  process.env.RELAY_XAI_IMAGE_COST_USD = '0.31';
  process.env.RELAY_SEARCH_OPERATION_COST_USD = '0.07';
  await adapter.reserveImage('lamp');
  await adapter.reserveSearch('google-cse', 'lamp');
  assert.equal(calls[8].options.scopeDailyCapUsd, 3.5);
  assert.equal(calls[8].options.costUsd, 0.31);
  assert.equal(calls[10].options.costUsd, 0.07);

  const engineSource = fs.readFileSync(path.join(ROOT, 'lib/relay-engine.js'), 'utf8');
  const handlerSource = fs.readFileSync(path.join(ROOT, 'handlers/relay-autonomous-scraper.js'), 'utf8');
  const reverseSource = fs.readFileSync(path.join(ROOT, 'lib/relay-reverse-image.js'), 'utf8');
  const reconcileAt = engineSource.indexOf('const reconciledEarly = await _reconcileQuietly()');
  const motorAt = engineSource.indexOf('const motorAuthorization = opts.motorAuthorization');
  const discoveryAt = engineSource.indexOf('const discovery = await discoverAndList(opts)');
  assert(reconcileAt >= 0 && motorAt > reconcileAt && discoveryAt > motorAt,
    'reconciliation must remain before the local motor valve, and discovery after it');
  assert.match(handlerSource, /Valve\.authorize\('trade:relay-sourcing'\)/);
  assert.match(handlerSource, /heartbeat'\)\.wrap\('relay-autonomous-scraper'/);
  assert.match(reverseSource, /if \(e && e\.code === 'RELAY_PROVIDER_REFUSED'\) break/,
    'a global/budget refusal must stop provider fallback instead of attempting another paid call');

  console.log('relay paid provider: local valve ordering, heartbeat, global-boundary delegation, caps, costs, settlement and stable idempotency passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(function () {
  if (savedBoundary) require.cache[boundaryPath] = savedBoundary;
  else delete require.cache[boundaryPath];
  if (savedAdapter) require.cache[adapterPath] = savedAdapter;
  else delete require.cache[adapterPath];
  if (savedGuard) require.cache[guardPath] = savedGuard;
  else delete require.cache[guardPath];
  if (savedStore) require.cache[storePath] = savedStore;
  else delete require.cache[storePath];
});
