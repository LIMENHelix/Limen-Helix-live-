'use strict';

/** Convert the read-only stress-slim response into one ledger network row. */

function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

function assemble(payload, slug) {
  var generatedAt = payload && payload.generatedAt;
  var bySlug = payload && payload.bySlug;
  var row = bySlug && slug ? bySlug[String(slug)] : null;
  var at = null;
  if (typeof generatedAt === 'number' && Number.isFinite(generatedAt)) at = new Date(generatedAt);
  else if (typeof generatedAt === 'string' && generatedAt.trim()) at = new Date(generatedAt);
  if (!at || !Number.isFinite(at.getTime()) || !row || typeof row !== 'object') return null;
  if (!finite(row.total) && !finite(row.induced)) return null;
  return {
    asOf: at.toISOString(),
    sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' },
    slug: String(slug),
    value: finite(row.total) ? row.total : row.induced,
    inducedStress: finite(row.induced) ? row.induced : null,
    rank: text(row.rank) ? row.rank : null,
    isHub: row.hub === true,
    pushed: row.pushed === true
  };
}

module.exports = { assemble: assemble };
