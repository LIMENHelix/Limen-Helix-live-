/**
 * handlers/diagnosis-manifest.js — deployed paginated enumeration of the
 * per-domain diagnosis identity/route manifests (PR #386 acceptance).
 *
 * The manifests are committed to this repo but excluded from the deploy bundle
 * (~110 MB fleet). This endpoint fetches them from GitHub on demand (same token
 * pattern as fetch-portal), caches per domain in-process, and pages server-side.
 *
 *   GET /api/diagnosis-manifest?domain=finance&page=0&size=200
 *     -> { domain, count, page, pages, size, entries: [[id, slugSuffix, depth]...] }
 *   GET /api/diagnosis-manifest?domain=finance&id=FINANCE_..._CAPACITY_OVERLOAD
 *     -> { domain, found, entry, route }   (route = /api/fetch-portal?domainId=...)
 *
 * Domains are restricted to the 20 portal keys; ids are shape-gated.
 */
const PORTAL_KEYS = new Set([
  'p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
]);

const CACHE_TTL = 3600 * 1000;
const _cache = {};   // domain -> { t, manifest, ref }

async function loadManifest(domain, token) {
  const hit = _cache[domain];
  if (hit && (Date.now() - hit.t) < CACHE_TTL) return { manifest: hit.manifest, ref: hit.ref, status: 200 };

  // 1) Metadata call: the Contents API omits `content` for files >1 MiB (all 20
  // manifests are 3.7-6.9 MiB) — but it still returns the blob sha, which we
  // publish as `ref` so multi-page traversals can verify version consistency.
  const metaUrl = `https://api.github.com/repos/LIMENHelix/Limen-Helix-live-/contents/assets/data/deep/${domain}-diagnosis-manifest.json`;
  const metaRes = await fetch(metaUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LimenHelix-Manifest'
    }
  });
  if (metaRes.status === 404) return { status: 404 };
  if (!metaRes.ok) return { status: 502, upstream: metaRes.status };
  const meta = await metaRes.json();

  // 2) Raw content call: works for files of any size (base64 `content` is only
  // offered <1 MiB; requesting the raw media type returns the file itself).
  const rawRes = await fetch(metaUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.raw+json',
      'User-Agent': 'LimenHelix-Manifest'
    }
  });
  if (!rawRes.ok) return { status: 502, upstream: rawRes.status };
  const text = await rawRes.text();
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (e) {
    return { status: 502, upstream: 'malformed-manifest-json' };
  }
  _cache[domain] = { t: Date.now(), manifest, ref: meta.sha || null };
  return { manifest, ref: meta.sha || null, status: 200 };
}

module.exports = async function handler(req, res) {
  const { domain, id } = req.query;
  if (!domain || !PORTAL_KEYS.has(domain)) {
    return res.status(400).json({ error: 'Invalid domain', valid: [...PORTAL_KEYS] });
  }
  if (id !== undefined && !/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.VERCEL_GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured', hint: 'Set GITHUB_TOKEN env var' });
  }

  try {
    const result = await loadManifest(domain, token);
    if (result.status === 404) return res.status(404).json({ error: 'Manifest not found for domain', domain });
    if (result.status !== 200) {
      // Upstream failure propagates as 502 — never a fake empty-success 200.
      return res.status(502).json({ error: 'GitHub upstream error', status: result.upstream || result.status });
    }
    const manifest = result.manifest;

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

    if (id !== undefined) {
      const entry = (manifest.entries || []).find(e => e[0] === id) || null;
      // Route guard: the returned route may only address expected repository
      // content — a manifest slug suffix must be a plain slug, and the route is
      // always this site's fetch-portal handler (which shape-gates again).
      const safeSuffix = entry && /^[A-Za-z0-9_-]{1,160}$/.test(entry[1]);
      return res.status(200).json({
        domain,
        ref: result.ref,
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
      ref: result.ref,
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

// Test seam: isolated suites need a clean cache between scenarios (malformed
// bodies, upstream failures) without waiting out the TTL.
module.exports._clearCache = function () { for (const k in _cache) delete _cache[k]; };
