/**
 * handlers/fitness-program-feed.js — ADMIN-ONLY live research feed per phase.
 *
 * GET /api/fitness-program-feed?phase=P4   (auth: x-limen-pass header or ?key=)
 *   → { ok:true, phase, query, papers:[{title,authors,journal,year,pmid,doi,url}] }
 *
 * Pulls the most recent papers matching the phase's exercise-science meaning from
 * Europe PMC (free REST API, no key). Server-side fetch so there is no CORS or
 * key exposure. Admin-gated like the rest of the fitness programming.
 */
const { reqKey, isMaster, hasDomain, deny } = require('../lib/admin-gate');

// Query per phase — tied to the phase's meaning (the exercise-science topic).
const FEED_QUERIES = {
  P0: 'exercise athlete readiness heart rate variability assessment',
  P1: 'circadian rhythm exercise performance time of day training',
  P2: 'nutrient timing carbohydrate periodization muscle protein synthesis',
  P3: 'exercise recovery tapering autophagy supercompensation sleep',
  P4: 'resistance training muscle hypertrophy mTOR mechanotransduction',
  P5: 'endurance training mitochondrial biogenesis PGC-1 polarized',
  P6: 'training periodization concurrent training interference block',
  P7: 'energy deficit fat loss lean mass preservation resistance training',
  P7b: 'overreaching overtraining syndrome athlete monitoring recovery',
  P8: 'autoregulation velocity based training HRV guided readiness',
  P9: 'tapering peaking athletic performance post-activation potentiation',
  P10: 'metabolic flexibility exercise fat carbohydrate oxidation reverse diet',
};

function pick(req, name) {
  try { if (req.query && req.query[name] != null) return String(req.query[name]); } catch (e) {}
  try { return new URL(req.url, 'http://x').searchParams.get(name) || ''; } catch (e) { return ''; }
}

module.exports = async function handler(req, res) {
  const pass = reqKey(req);
  if (!(isMaster(pass) || hasDomain(pass, 'fitness'))) return deny(res);

  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const phase = pick(req, 'phase');
  const query = FEED_QUERIES[phase];
  if (!query) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'Unknown phase.' }));
  }

  const url = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search'
    + '?query=' + encodeURIComponent(query)
    + '&resultType=lite&format=json&pageSize=6&sort=' + encodeURIComponent('P_PDATE_D desc');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: 'feed upstream ' + r.status })); }
    const data = await r.json().catch(() => ({}));
    const rows = (data && data.resultList && data.resultList.result) || [];
    const papers = rows.slice(0, 6).map((p) => {
      const doi = p.doi || '';
      const pmid = p.pmid || '';
      const url = doi ? ('https://doi.org/' + doi)
        : pmid ? ('https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/')
        : (p.id && p.source ? ('https://europepmc.org/article/' + p.source + '/' + p.id) : '');
      return {
        title: p.title || '',
        authors: p.authorString || '',
        journal: p.journalTitle || p.source || '',
        year: p.pubYear || '',
        pmid, doi, url,
      };
    }).filter((p) => p.title);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, phase, query, source: 'Europe PMC', papers }));
  } catch (e) {
    clearTimeout(t);
    res.statusCode = 504;
    return res.end(JSON.stringify({ ok: false, error: 'feed timeout/error' }));
  }
};
