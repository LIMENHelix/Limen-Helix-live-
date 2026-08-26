'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const now = Date.parse('2026-08-26T18:10:00Z');

function observation(domain, i) {
  return {
    sourceIdentity: { kind: 'headline-title', value: domain + ':feed:' + i },
    sourceRecordId: 'https://' + domain + '.example.test/item/' + i,
    aggregatorItemUrl: 'https://' + domain + '.example.test/item/' + i,
    canonicalUrl: null,
    recordedAt: new Date(now - i * 1000).toISOString(),
    sourceUpdatedAt: new Date(now - i * 2000).toISOString(),
    title: 'Observed ' + domain + ' item ' + i,
    publisher: domain + ' publisher ' + (i % 4),
    feedName: domain + ' feed ' + (i % 4)
  };
}

function cognition(domain, sourceDomain) {
  return {
    c: {
      serverPacket: {
        sourceType: 'server-cognition-refresh', domainId: domain,
        packetId: domain + ':3:packet', generatedAt: new Date(now).toISOString(),
        truth: {
          stressScore: 0.3, confidence: 0.54, phase: 'p0',
          semanticEvidence: Array.from({ length: 8 }, (_, i) => observation(sourceDomain, i)),
          semanticEvidenceMeta: { status: 'OBSERVED', ownerDomain: domain, sourceDomain }
        }
      },
      serverPacketPersistence: { ok: true }
    }
  };
}

const values = new Map();
const filler = Array.from({ length: 198 }, (_, i) => ({
  status: 'PENDING', source: 'phase-transition', recommendedLane: 'investment', cik: String(900000 + i)
}));
values.set('autoqueue', filler.concat([
  { status: 'PENDING', source: 'master-inbox', recommendedLane: 'research', cik: '1', sourceArtifactRef: 'old-research-one' },
  { status: 'PENDING', source: 'master-inbox', recommendedLane: 'research', cik: '2', sourceArtifactRef: 'old-research-two' }
]));

function mock(file, exports) {
  const resolved = require.resolve(file);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

mock(path.join(ROOT, 'lib', 'limen-db.js'), {
  async get(key) { return values.has(key) ? values.get(key) : null; },
  async set(key, value) { values.set(key, value); return true; }
});
mock(path.join(ROOT, 'lib', 'redis-kv.js'), {
  async redisGet(key) {
    if (key.endsWith(':science')) return cognition('science', 'research');
    if (key.endsWith(':medicine')) return cognition('medicine', 'health');
    return null;
  }
});
mock(path.join(ROOT, 'lib', 'cron-auth.js'), { enforce() { return true; } });

const realNow = Date.now;
Date.now = () => now;

function invoke(handler) {
  let body = '';
  const res = {
    statusCode: 200,
    setHeader() {},
    end(chunk) { body = chunk || ''; }
  };
  return handler({ method: 'GET', url: '/api/limen-worker-autoqueue', headers: {} }, res)
    .then(() => ({ code: res.statusCode, json: JSON.parse(body) }));
}

(async function () {
  try {
    const handler = require(path.join(ROOT, 'handlers', 'limen-worker-autoqueue.js'));
    const response = await invoke(handler);
    const queue = values.get('autoqueue');
    assert.equal(response.code, 200);
    assert.equal(response.json.domainResearch.ready, 2);
    assert.equal(response.json.domainResearch.admitted, 2);
    assert.equal(response.json.domainResearch.retiredMismatched.length, 2);
    assert.equal(queue.length, 200);
    assert.equal(queue.filter((row) => row.source === 'domain-packet-research').length, 2);
    assert.equal(queue.some((row) => row.sourceArtifactRef === 'old-research-one'), false);
    assert.equal(queue.some((row) => row.sourceArtifactRef === 'old-research-two'), false);
    assert.ok(queue.filter((row) => row.source === 'domain-packet-research')
      .every((row) => row.researchContext.evidence.news.length === 8 && row.cik == null));
    console.log('domain research autoqueue: two source-owned brains replaced two unjoined company-research schedule rows');
  } finally {
    Date.now = realNow;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
