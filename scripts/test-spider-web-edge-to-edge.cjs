#!/usr/bin/env node
'use strict';

/*
 * The spider-web signal is allowed to move through the sovereign runtime, but
 * this test must never call a provider. It proves the live producer's Redis
 * handoff is the same stress state consumed by autofire, and that stale state
 * cannot be presented as current evidence.
 */

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

(async function main() {
  const dbPath = require.resolve(path.join(ROOT, 'lib', 'limen-db.js'));
  const store = new Map();
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async set(key, value) { store.set(key, value); return { ok: true }; },
      getBackend() { return 'test-memory'; }
    }
  };

  const efferencePath = require.resolve(path.join(ROOT, 'lib', 'autofire-efference-store.js'));
  require.cache[efferencePath] = {
    id: efferencePath,
    filename: efferencePath,
    loaded: true,
    exports: {
      assertDurable() { return true; },
      async get() { return null; },
      async set() { return true; },
      async del() { return 0; },
      async lpush() { return 1; },
      async ltrim() { return true; },
      async lrange() { return []; }
    }
  };

  process.env.CRON_SECRET = 'spider-web-test-secret';
  const portalLoaderPath = require.resolve(path.join(ROOT, 'lib', 'portal-loader.js'));
  require.cache[portalLoaderPath] = {
    id: portalLoaderPath,
    filename: portalLoaderPath,
    loaded: true,
    exports: {
      async listSlugs() { return { slugs: ['acme'] }; },
      async loadPortal() {
        return { portal: { slug: 'acme', cik: '000123', name: 'Acme Corporation' } };
      }
    }
  };
  const propagatorPath = require.resolve(path.join(ROOT, 'lib', 'limen-stress-propagator.js'));
  const producerGeneratedAt = new Date().toISOString();
  require.cache[propagatorPath] = {
    id: propagatorPath,
    filename: propagatorPath,
    loaded: true,
    exports: {
      runPropagation() { return { fixture: true }; },
      serializeResult() {
        return {
          generatedAt: producerGeneratedAt,
          stats: { totalNodes: 1 },
          propagated: [{
            slug: 'acme',
            inducedStress: 2.25,
            totalStress: 3.75,
            amplificationRank: 'MODERATE',
            isHub: false,
            networkPushed: true
          }]
        };
      }
    }
  };
  const refresh = require(path.join(ROOT, 'handlers', 'limen-worker-stress-refresh.js'));
  const autoqueue = require(path.join(ROOT, 'handlers', 'limen-worker-autoqueue.js'));
  const autofire = require(path.join(ROOT, 'handlers', 'limen-worker-autofire.js'));
  const portal = {
    slug: 'acme',
    cik: '000123',
    name: 'Acme Corporation',
    industry: 'Industrial systems',
    sic: '9999',
    financialHealth: {}
  };

  const refreshRes = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    end(value) { this.body = value == null ? '' : String(value); return this; }
  };
  await refresh({ method: 'GET', headers: { authorization: 'Bearer spider-web-test-secret' } }, refreshRes);
  let refreshJson = null;
  try { refreshJson = JSON.parse(refreshRes.body); } catch (_) {}
  const producedSlim = store.get('stress_slim');
  const producedMeta = store.get('stress_meta');
  const generatedAtMs = Number(producedMeta && producedMeta.generatedAtMs);
  assert('the live producer writes a versioned spider-web slim map',
    refreshRes.statusCode === 200 && refreshJson && refreshJson.ok === true &&
    producedSlim && producedSlim.schemaVersion === 'stress-slim/1.0' && producedSlim.byCik['123']);
  assert('the live producer writes a matching freshness receipt',
    producedMeta && producedMeta.schemaVersion === 'stress-slim/1.0' &&
    Number.isFinite(generatedAtMs) && producedMeta.withCik === 1);

  assert('autoqueue accepts the versioned live spider-web contract',
    autoqueue._freshStressFeed(store.get('stress_slim'), store.get('stress_meta'), generatedAtMs + 5 * 60 * 1000));
  assert('autoqueue rejects a future-dated spider-web receipt',
    !autoqueue._freshStressFeed(store.get('stress_slim'), store.get('stress_meta'), generatedAtMs - 1));

  const node = await autofire._loadStressNode(portal, generatedAtMs + 5 * 60 * 1000);
  assert('autofire receives the live spider-web row from Redis', node && node.source === 'redis' && node.fresh === true);
  assert('live spider-web metrics survive the autofire handoff',
    node && node.inducedStress === 2.25 && node.totalStress === 3.75 && node.amplificationRank === 'MODERATE');
  assert('autofire preserves the producer timestamp as its stress as-of',
    node && node.asOf === new Date(generatedAtMs).toISOString());
  assert('stale bundled causation is not paired with fresh live metrics',
    node && Array.isArray(node.topSources) && node.topSources.length === 0);

  const packet = await autofire._buildContextPacket(portal, 'research', generatedAtMs + 5 * 60 * 1000);
  assert('the live spider-web row reaches the downstream context packet',
    packet && packet.evidence && packet.evidence.networkStress &&
    packet.evidence.networkStress.source === 'redis' &&
    packet.evidence.networkStress.totalStress === 3.75);

  store.set('stress_meta', { schemaVersion: 'stress-slim/1.0', generatedAtMs: generatedAtMs - 61 * 60 * 1000 });
  const stale = await autofire._loadStressNode(portal, generatedAtMs + 5 * 60 * 1000);
  assert('autofire refuses a spider-web row outside the one-hour freshness window', stale === null);
  assert('autoqueue refuses the same stale spider-web receipt',
    !autoqueue._freshStressFeed(store.get('stress_slim'), store.get('stress_meta'), generatedAtMs + 5 * 60 * 1000));

  console.log('\n' + passed + ' spider-web edge-to-edge assertions passed');
  if (process.exitCode) process.exit(1);
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
