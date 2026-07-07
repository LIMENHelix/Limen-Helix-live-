/**
 * handlers/fitness-evidence.js — PUBLIC per-phase citations for /fitness.
 *
 * GET /api/fitness-evidence   (no auth — the known science is free)
 *   → { ok:true, source:'PubMed', evidence:{ P0:[{ref,pmid,doi,find,url}], ... }, notes:{...} }
 *
 * Exposes ONLY the peer-reviewed citations + honesty caveats (the shared
 * lib/fitness-evidence source of truth). The paid programming — mesocycles,
 * molecular cascades, prescriptions — stays in the admin-gated fitness-program
 * endpoint and is never returned here.
 *
 * General fitness education, not medical advice. Findings are paraphrased;
 * every entry links to PubMed/DOI for verification.
 */
const { EVIDENCE, EVNOTES } = require('../lib/fitness-evidence');

// Attach a resolvable link to each citation (DOI preferred, PubMed fallback).
const withLinks = {};
for (const k of Object.keys(EVIDENCE)) {
  withLinks[k] = EVIDENCE[k].map((e) => Object.assign({}, e, {
    url: e.doi ? ('https://doi.org/' + e.doi)
      : e.pmid ? ('https://pubmed.ncbi.nlm.nih.gov/' + e.pmid + '/') : '',
  }));
}

module.exports = async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  // Public + cacheable: citations are static, safe to cache at the edge.
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.end(JSON.stringify({
    ok: true,
    source: 'PubMed',
    disclaimer: 'General fitness education, not medical advice. Findings are paraphrased one-liners; follow each link to the original study.',
    evidence: withLinks,
    notes: EVNOTES,
  }));
};
