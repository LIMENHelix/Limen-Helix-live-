'use strict';

/**
 * identity-quarantine.js — explicit, auditable identity quarantine.
 *
 * A portal record that mixes two issuers cannot be repaired without the missing
 * issuer's authorized scorer data. Quarantine removes the record from
 * navigation, scoring, propagation and relationship activation; it does not
 * rewrite the underlying identity data and does not resolve the finding.
 *
 * Contract: identity-quarantine-v1.
 */

const CONTRACT = 'identity-quarantine-v1';

const ENTRIES = [
  {
    slug: 'saia',
    ticker: 'SAIA',
    portalCik: '91142',
    authoritativeCik: '1177702',
    conflictingTicker: 'AOS',
    conflictingCik: '91142',
    reason: 'assets/data/companies/saia.json mixes Saia labels with A. O. Smith CIK, report URL and financialHealth',
    evidence: {
      authoritativeSource: 'scripts/kernel-validation/shadow_cache/company_tickers.json at commit 94275cb5 (SEC company_tickers.json)',
      saia: { ticker: 'SAIA', cik: '1177702' },
      aos: { ticker: 'AOS', cik: '91142' },
      portalLabelSic: 4213,
      portalFinancialSic: 3630
    },
    missingEvidence: 'Saia-scored financialHealth under CIK 1177702; the current financial block is A. O. Smith data'
  }
];

function normalizeCik(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const stripped = s.replace(/^0+/, '');
  return stripped === '' ? null : stripped;
}

const BY_SLUG = Object.create(null);
const BY_TICKER = Object.create(null);
for (const entry of ENTRIES) {
  BY_SLUG[entry.slug.toLowerCase()] = entry;
  BY_TICKER[String(entry.ticker).toUpperCase()] = entry;
}

function entryForSlug(slug) {
  if (slug === null || slug === undefined) return null;
  return BY_SLUG[String(slug).trim().toLowerCase()] || null;
}

function entryForTicker(ticker) {
  if (ticker === null || ticker === undefined) return null;
  return BY_TICKER[String(ticker).trim().toUpperCase()] || null;
}

function isQuarantinedSlug(slug) {
  return !!entryForSlug(slug);
}

/* A ticker is quarantined; the conflicting issuer's ticker (AOS) is not. */
function isQuarantinedTicker(ticker) {
  return !!entryForTicker(ticker);
}

/* A board row is quarantined when its slug is quarantined, or when its ticker
   is the quarantined ticker and its CIK is not the authoritative CIK. */
function boardRouteQuarantined(row) {
  if (!row) return false;
  if (isQuarantinedSlug(row.s)) return true;
  const entry = entryForTicker(row.t);
  if (!entry) return false;
  const cik = normalizeCik(row.c);
  return cik !== entry.authoritativeCik;
}

/* A portal record is quarantined by slug or by the quarantined ticker when its
   CIK is not the authoritative one. A correct future SAIA record with CIK
   1177702 is not quarantined. */
function isQuarantinedPortal(portal) {
  if (!portal) return false;
  if (isQuarantinedSlug(portal.slug)) return true;
  const entry = entryForTicker(portal.ticker);
  if (!entry) return false;
  return normalizeCik(portal.cik) !== entry.authoritativeCik;
}

/* A relationship edge, portal entry or route that names the quarantined issuer
   must be neutralised as a reference. Checking the name as well as the slug and
   ticker is intentional: stray CIKs on Saia edges (the corpus carries several)
   must never retarget the edge to another issuer. This is quarantine, not an
   identity inference. */
function referencesQuarantined(entity) {
  if (!entity || typeof entity !== 'object') return false;
  if (isQuarantinedSlug(entity.slug || entity.targetSlug)) return true;
  if (isQuarantinedTicker(entity.ticker || entity.targetTicker)) return true;
  const name = entity.name || entity.targetName;
  return !!(name && /\bsaia\b/i.test(String(name)));
}

function describe(slug) {
  const entry = entryForSlug(slug);
  if (!entry) return null;
  return {
    contract: CONTRACT,
    slug: entry.slug,
    ticker: entry.ticker,
    reason: entry.reason,
    authoritativeCik: entry.authoritativeCik,
    portalCik: entry.portalCik,
    missingEvidence: entry.missingEvidence
  };
}

module.exports = {
  CONTRACT,
  ENTRIES,
  normalizeCik,
  entryForSlug,
  entryForTicker,
  isQuarantinedSlug,
  isQuarantinedTicker,
  boardRouteQuarantined,
  isQuarantinedPortal,
  referencesQuarantined,
  describe
};
