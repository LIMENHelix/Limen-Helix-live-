export function resolveCompanyPortalSlug(slug, aliases, hasPortal) {
  const requested = String(slug || '').trim();
  if (!requested) return null;
  if (hasPortal(requested)) return requested;
  const canonical = aliases && aliases[requested];
  return canonical && hasPortal(canonical) ? canonical : null;
}
