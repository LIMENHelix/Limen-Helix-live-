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
const _cache = {};   // domain -> { t, manifest }

async function loadManifest(domain, token) {
  const hit = _cache[domain];
  if (hit && (Date.now() - hit.t) < CACHE_TTL) return hit.manifest;
  const url = `https://api.github.com/repos/LIMENHelix/Limen-Helix-live-/contents/assets/data/deep/${domain}-diagnosis-manifest.json`;
  const ghRes = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LimenHelix-Manifest'
    }
  });
  if (ghRes.status === 404) return null;
  if (!ghRes.ok) throw new Error('GitHub API error ' + ghRes.status);
  const data = await ghRes.json();
  if (!data.content) throw new Error('no content in GitHub response');
  const manifest = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
  _cache[domain] = { t: Date.now(), manifest };
  return manifest;
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
    const manifest = await loadManifest(domain, token);
    if (!manifest) return res.status(404).json({ error: 'Manifest not found for domain', domain });

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

    if (id !== undefined) {
      const entry = (manifest.entries || []).find(e => e[0] === id) || null;
      return res.status(200).json({
        domain,
        found: !!entry,
        entry,
        route: entry ? `/api/fetch-portal?domainId=${domain}_${entry[1]}` : null
      });
    }

    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 200, 1), 1000);
    const count = (manifest.entries || []).length;
    const pages = Math.max(1, Math.ceil(count / size));
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 0, 0), pages - 1);
    return res.status(200).json({
      domain,
      source: manifest.source || null,
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
