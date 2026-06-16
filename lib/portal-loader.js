/**
 * lib/portal-loader.js — shared company-portal loader (Hono-consolidation unbundle pilot).
 *
 * Goal: stop bundling assets/data/companies/*.json (~48 MB) into the single Node
 * function by reading each portal over HTTP from the statically-served copy. During
 * the pilot, includeFiles STILL bundles companies, so we keep an fs fallback — the
 * read is byte-identical whether it comes from fetch or fs. Once every reader uses
 * this and the fetch path is proven in prod, companies/*.json can leave includeFiles
 * (the fs fallback then goes inert).
 *
 * Base URL: PUBLIC_BASE_URL || 'https://limenhelix.com'. We deliberately do NOT use
 * VERCEL_URL — it points at the protected *.vercel.app deployment host, so a
 * server-side self-fetch 401s and would force fs-fallback forever (making the
 * eventual unbundle unsafe). The public custom domain serves /assets/** without
 * auth.
 *
 * loadPortal(slug) resolves to { portal, source } where:
 *   source === 'fetch'        portal came from the static HTTP copy (the goal path)
 *   source === 'fs-fallback'  fetch failed; portal came from the bundled file
 *   source === 'miss'         neither available (or slug invalid) -> portal: null
 * Callers preserve their existing "missing -> null" behavior by reading .portal.
 */
const fs = require('node:fs');
const path = require('node:path');

function baseUrl() {
  return process.env.PUBLIC_BASE_URL || 'https://limenhelix.com';
}

// fs fallback anchors — mirror the per-handler multi-anchor paths. lib/ is one level
// under the repo root (same depth as handlers/ and api/), so '..' resolves to root.
const FS_DIRS = [
  path.join(__dirname, '..', 'assets', 'data', 'companies'),
  '/var/task/assets/data/companies',
  path.join(process.cwd(), 'assets', 'data', 'companies')
];

// Defensive: company slugs are like "okta", "dhl_supply_chain". Reject anything that
// could escape the companies/ directory or isn't a plain slug.
function _validSlug(slug) {
  return typeof slug === 'string'
    && slug.length > 0
    && slug.indexOf('..') === -1
    && /^[A-Za-z0-9._-]+$/.test(slug);
}

async function loadPortal(slug, opts = {}) {
  if (!_validSlug(slug)) return { portal: null, source: 'miss' };

  // Preferred path: fetch the statically-served copy from the public domain.
  const base = opts.base || baseUrl();
  try {
    const url = base + '/assets/data/companies/' + encodeURIComponent(slug) + '.json';
    const r = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs || 15000) });
    if (r.ok) {
      const portal = await r.json();
      if (portal && typeof portal === 'object') return { portal: portal, source: 'fetch' };
    }
    // non-200 or non-object -> fall through to fs
  } catch (_) { /* network/parse error -> fall through to fs */ }

  // Fallback: bundled file (valid while includeFiles still ships companies/*.json).
  for (let i = 0; i < FS_DIRS.length; i++) {
    try {
      const fp = path.join(FS_DIRS[i], slug + '.json');
      if (fs.existsSync(fp)) {
        return { portal: JSON.parse(fs.readFileSync(fp, 'utf8')), source: 'fs-fallback' };
      }
    } catch (_) { /* try next anchor */ }
  }

  return { portal: null, source: 'miss' };
}

module.exports = { loadPortal };
