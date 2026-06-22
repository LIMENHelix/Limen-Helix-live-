/**
 * handlers/civil-radar.js — Liz's infrastructure-opportunity radar.
 *
 * "Where's the work?" for a drafting & surveying firm. Pulls FEDERAL civil-infrastructure
 * awards (USAspending.gov, keyless) in her licensed states (CA/TN/KS) under the civil
 * construction NAICS — the big road/bridge/water/dam/levee projects whose primes hire
 * survey + drafting subs. Cached in ONE Redis doc (civil:radar, 12h) so a page view is
 * ~1 read (cost-safe). State DOT + SAM.gov live RFPs are the next feeds to layer on.
 *
 * GET /api/civil-radar            → { ok, updated, summary, states:{CA:[],TN:[],KS:[]} }
 * GET /api/civil-radar?refresh=1  → bypass cache
 */
const db = require('../lib/limen-db');

const STATES = (process.env.CIVIL_RADAR_STATES || 'CA,TN,KS').split(',');
const NAICS = ['237310', '237110', '237990', '237130']; // highway/bridge · water-sewer · heavy civil · power-comm line
const ENDPOINT = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
const TTL_MS = 12 * 60 * 60 * 1000;
const FLOOR = 1000000; // $1M+ — meaningful projects that carry survey/drafting scope
const LOOKBACK_DAYS = 540;

function iso(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { return iso(new Date(Date.now() - n * 86400000)); }

async function fetchState(st) {
  const body = {
    filters: {
      time_period: [{ start_date: daysAgo(LOOKBACK_DAYS), end_date: iso(new Date()) }],
      place_of_performance_locations: [{ country: 'USA', state: st }],
      naics_codes: NAICS,
      award_type_codes: ['A', 'B', 'C', 'D']
    },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Awarding Agency', 'Start Date'],
    limit: 25, sort: 'Award Amount', order: 'desc'
  };
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return [];
    const j = await r.json();
    const rows = (j && Array.isArray(j.results)) ? j.results : [];
    return rows.map(x => ({
      prime: (x['Recipient Name'] || '').slice(0, 80),
      amount: Number(x['Award Amount']) || 0,
      project: (x['Description'] || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      agency: (x['Awarding Agency'] || '').slice(0, 60),
      started: x['Start Date'] || '',
      awardId: x['Award ID'] || '',
      link: x.generated_internal_id ? ('https://www.usaspending.gov/award/' + x.generated_internal_id) : ''
    })).filter(o => o.amount >= FLOOR && o.prime);
  } catch (e) { return []; }
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=600');

  let fresh = false; try { fresh = new URL(req.url, 'http://x').searchParams.get('refresh') === '1'; } catch (e) {}
  let doc = null; try { doc = await db.get('civil:radar'); } catch (e) {}
  if (!fresh && doc && doc.updated && (Date.now() - doc.updated) < TTL_MS && doc.states) {
    res.statusCode = 200; return res.end(JSON.stringify(Object.assign({ ok: true, cached: true }, doc)));
  }

  const results = await Promise.all(STATES.map(fetchState));
  const states = {};
  let total = 0, count = 0; const primes = {};
  STATES.forEach((st, i) => {
    const rows = results[i] || [];
    states[st] = rows;
    rows.forEach(o => { total += o.amount; count++; primes[o.prime] = (primes[o.prime] || 0) + o.amount; });
  });
  const topPrimes = Object.keys(primes).map(p => ({ prime: p, total: primes[p] })).sort((a, b) => b.total - a.total).slice(0, 8);

  doc = { updated: Date.now(), states: states, summary: { totalAwarded: total, count: count, topPrimes: topPrimes, naics: NAICS, lookbackDays: LOOKBACK_DAYS } };
  if (count) { try { await db.set('civil:radar', doc); } catch (e) {} }

  res.statusCode = 200;
  return res.end(JSON.stringify(Object.assign({ ok: count > 0, cached: false }, doc)));
};
