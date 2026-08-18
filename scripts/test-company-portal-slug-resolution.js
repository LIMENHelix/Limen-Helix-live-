const assert = require('assert');

async function main() {
  const { resolveCompanyPortalSlug } = await import('./_resolve-company-portal-slug.mjs');

  const existing = new Set(['direct_portal', 'canonical_portal']);
  const hasPortal = (slug) => existing.has(slug);

  assert.strictEqual(
    resolveCompanyPortalSlug('direct_portal', { direct_portal: 'missing_alias_target' }, hasPortal),
    'direct_portal',
    'a stale alias must not shadow a valid requested portal'
  );
  assert.strictEqual(
    resolveCompanyPortalSlug('legacy_slug', { legacy_slug: 'canonical_portal' }, hasPortal),
    'canonical_portal',
    'a valid alias should resolve after the requested portal misses'
  );
  assert.strictEqual(
    resolveCompanyPortalSlug('missing_slug', { missing_slug: 'missing_alias_target' }, hasPortal),
    null,
    'resolution must fail when neither the requested portal nor alias target exists'
  );
  assert.strictEqual(resolveCompanyPortalSlug('', {}, hasPortal), null);

  console.log('company portal slug resolution: 4/4 passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
