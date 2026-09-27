/**
 * handlers/diagnosis-manifest.js — deployed paginated enumeration of the
 * per-domain diagnosis identity/route manifests (PR #386 acceptance).
 *
 * Snapshot consistency: every page response carries the manifest blob sha as
 * `ref`. Clients pin a traversal by passing ?ref=<sha> on subsequent calls —
 * the server then serves that EXACT immutable blob (fetched via the GitHub
 * blob API, cached by sha), so a manifest mutation upstream can never mix
 * versions mid-traversal. Without ?ref, the current sha is resolved once
 * (metadata call) and the same pinned path is used.
 *
 * Cache correctness: blobs are keyed by immutable sha (never by domain alone),
 * bounded (CACHE_MAX, FIFO), parsed before caching (malformed content cannot
 * poison the cache), and upstream failures propagate as 502 — never a fake
 * empty-success 200.
 *
 *   GET /api/diagnosis-manifest?domain=finance&page=0&size=200
 *     -> { domain, ref, count, page, pages, size, entries }
 *   GET /api/diagnosis-manifest?domain=finance&page=1&size=200&ref=<sha>
 *     -> same shape, pinned to <sha>
 *   GET /api/diagnosis-manifest?domain=finance&id=FINANCE_...&ref=<sha>
 *     -> { domain, ref, found, entry, route }
 *
 * Domains are restricted to the 20 portal keys; id and ref are shape-gated.
 */
const PORTAL_KEYS = new Set([
  'p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
]);

const META_TTL = 3600 * 1000;   // domain -> current sha (re-resolve hourly)
const CACHE_MAX = 50;           // bounded blob cache (immutable shas, FIFO)
const _metaCache = {};          // domain -> { t, sha }
const _blobCache = {};          // sha -> manifest (immutable)
const _blobOrder = [];          // FIFO eviction order

function cacheBlob(sha, manifest) {
  if (_blobCache[sha]) return;
  _blobCache[sha] = manifest;
  _blobOrder.push(sha);
  while (_blobOrder.length > CACHE_MAX) {
    const evict = _blobOrder.shift();
    delete _blobCache[evict];
  }
}

async function gh(url, token, raw) {
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': raw ? 'application/vnd.github.raw+json' : 'application/vnd.github.v3+json',
      'User-Agent': 'LimenHelix-Manifest'
    }
  });
}

async function blobBySha(sha, token) {
  if (_blobCache[sha]) return { manifest: _blobCache[sha], status: 200 };
  // The blob API serves any size with the raw media type (the Contents API
  // omits inline content >1 MiB — all manifests are 3.7-6.9 MiB).
  const res = await gh(`https://api.github.com/repos/LIMENHelix/Limen-Helix-live-/git/blobs/${sha}`, token, true);
  if (res.status === 404) return { status: 404 };
  if (!res.ok) return { status: 502, upstream: res.status };
  const text = await res.text();
  let manifest;
  try { manifest = JSON.parse(text); } catch (e) {
    return { status: 502, upstream: 'malformed-manifest-json' };   // never cached
  }
  // Schema gate BEFORE cache admission: an unauthenticated caller may pin any
  // 40-hex blob sha, so only structurally valid manifests may enter the shared
  // cache. Arbitrary/no-domain/oversized/inconsistent JSON is rejected uncached.
  const bad = validateManifest(manifest);
  if (bad) return { status: 422, upstream: bad };
  cacheBlob(sha, manifest);
  return { manifest, status: 200 };
}

const MAX_MANIFEST_ENTRIES = 1000000;
function validateManifest(m) {
  if (!m || typeof m !== 'object') return 'not-an-object';
  if (!PORTAL_KEYS.has(m.domain)) return 'manifest-domain-missing-or-invalid';
  if (!Array.isArray(m.entries)) return 'entries-not-array';
  if (m.entries.length > MAX_MANIFEST_ENTRIES) return 'entries-oversized';
  if (typeof m.count === 'number' && m.count !== m.entries.length) return 'count-mismatch';
  for (let i = 0; i < m.entries.length; i++) {
    const e = m.entries[i];
    if (!Array.isArray(e) || e.length < 2) return 'entry-shape@' + i;
    if (typeof e[0] !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(e[0])) return 'entry-id-shape@' + i;
    if (typeof e[1] !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(e[1])) return 'entry-slug-shape@' + i;
  }
  return null;
}

async function currentSha(domain, token) {
  const hit = _metaCache[domain];
  if (hit && (Date.now() - hit.t) < META_TTL) return { sha: hit.sha, status: 200 };
  const res = await gh(`https://api.github.com/repos/LIMENHelix/Limen-Helix-live-/contents/assets/data/deep/${domain}-diagnosis-manifest.json`, token, false);
  if (res.status === 404) return { status: 404 };
  if (!res.ok) return { status: 502, upstream: res.status };
  const meta = await res.json();
  if (!meta.sha) return { status: 502, upstream: 'missing-blob-sha' };
  _metaCache[domain] = { t: Date.now(), sha: meta.sha };
  return { sha: meta.sha, status: 200 };
}

module.exports = async function handler(req, res) {
  const { domain, id, ref } = req.query;
  if (!domain || !PORTAL_KEYS.has(domain)) {
    return res.status(400).json({ error: 'Invalid domain', valid: [...PORTAL_KEYS] });
  }
  if (id !== undefined && !/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  if (ref !== undefined && !/^[0-9a-f]{40}$/i.test(ref)) {
    return res.status(400).json({ error: 'Invalid ref (expected 40-char blob sha)' });
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.VERCEL_GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured', hint: 'Set GITHUB_TOKEN env var' });
  }

  try {
    // Resolve which immutable blob to serve: pinned ref, or current head sha.
    let sha = ref;
    if (!sha) {
      const cur = await currentSha(domain, token);
      if (cur.status === 404) return res.status(404).json({ error: 'Manifest not found for domain', domain });
      if (cur.status !== 200) return res.status(502).json({ error: 'GitHub upstream error', status: cur.upstream });
      sha = cur.sha;
    }
    const got = await blobBySha(sha, token);
    if (got.status === 404) return res.status(404).json({ error: 'Manifest blob not found', ref: sha });
    if (got.status === 422) return res.status(422).json({ error: 'Blob failed manifest schema validation', reason: got.upstream, ref: sha });
    if (got.status !== 200) return res.status(502).json({ error: 'GitHub upstream error', status: got.upstream });
    const manifest = got.manifest;

    // Domain cross-check is strict: the schema gate guarantees a valid domain
    // field, and it must equal the requested one.
    if (manifest.domain !== domain) {
      return res.status(409).json({ error: 'Ref/domain mismatch', domain, refDomain: manifest.domain });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

    if (id !== undefined) {
      const entry = (manifest.entries || []).find(e => e[0] === id) || null;
      // Route guard: the returned route may only address expected repository
      // content — a slug suffix must be a plain slug; the route is always this
      // site's fetch-portal handler (which shape-gates again). No host, no
      // traversal, no query escape is constructible.
      const safeSuffix = entry && /^[A-Za-z0-9_-]{1,160}$/.test(entry[1]);
      return res.status(200).json({
        domain,
        ref: sha,
        found: !!(entry && safeSuffix),
        entry: entry && safeSuffix ? entry : null,
        route: entry && safeSuffix ? `/api/fetch-portal?domainId=${domain}_${encodeURIComponent(entry[1])}` : null
      });
    }

    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 200, 1), 1000);
    const count = (manifest.entries || []).length;
    const pages = Math.max(1, Math.ceil(count / size));
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 0, 0), pages - 1);
    return res.status(200).json({
      domain,
      source: manifest.source || null,
      ref: sha,
      count,
      page,
      pages,
      size,
      entries: (manifest.entries || []).slice(page * size, (page + 1) * size)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
};

// Test seam: isolated suites need clean caches between scenarios.
module.exports._clearCache = function () {
  for (const k in _metaCache) delete _metaCache[k];
  for (const k in _blobCache) delete _blobCache[k];
  _blobOrder.length = 0;
};
