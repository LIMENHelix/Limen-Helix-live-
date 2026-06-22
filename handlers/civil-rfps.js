/**
 * handlers/civil-rfps.js — open bids (RFPs) for Liz's radar.
 *
 * The forward half of the radar: live federal SOLICITATIONS she can bid NOW
 * (SAM.gov Opportunities API) in her states (CA/TN/KS), filtered to civil construction
 * + surveying/engineering NAICS (237*, 5413*). This is the Design-phase work where her
 * survey/drafting demand peaks — vs civil-radar which shows already-awarded contracts.
 *
 * Needs a free SAM.gov / api.data.gov key in env (SAM_API_KEY | SAM_GOV_API_KEY |
 * SAMGOV_API_KEY). Until set, returns { ok:true, configured:false } so the page shows a
 * graceful "coming soon" instead of breaking. Cached in ONE Redis doc (civil:rfps, 6h).
 *
 * GET /api/civil-rfps[?refresh=1]
 */
const db = require('../lib/limen-db');

const SAM_KEY = process.env.SAM_API_KEY || process.env.SAM_GOV_API_KEY || process.env.SAMGOV_API_KEY || '';
const STATES = (process.env.CIVIL_RADAR_STATES || 'CA,TN,KS').split(',');
const BASE = 'https://api.sam.gov/opportunities/v2/search';
const TTL_MS = 6 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 90;
const NAICS_OK = /^(237|5413)/;          // civil construction + engineering/surveying services
const PTYPE = 'o,k,p,r';                  // solicitation, combined, presol, sources-sought

function mmddyyyy(d) { const m = d.getMonth() + 1, day = d.getDate(); return (m < 10 ? '0' + m : m) + '/' + (day < 10 ? '0' + day : day) + '/' + d.getFullYear(); }

async function fetchState(st) {
  const from = mmddyyyy(new Date(Date.now() - LOOKBACK_DAYS * 86400000));
  const to = mmddyyyy(new Date());
  const url = BASE + '?api_key=' + encodeURIComponent(SAM_KEY) +
    '&postedFrom=' + from + '&postedTo=' + to + '&state=' + st + '&ptype=' + encodeURIComponent(PTYPE) + '&limit=100';
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    const list = (j && Array.isArray(j.opportunitiesData)) ? j.opportunitiesData : [];
    const now = Date.now();
    return list.map(o => ({
      title: (o.title || '').replace(/\s+/g, ' ').trim().slice(0, 150),
      sol: o.solicitationNumber || '',
      agency: (o.fullParentPathName || '').split('.').slice(-1)[0].slice(0, 60) || (o.fullParentPathName || '').slice(0, 60),
      naics: o.naicsCode || (Array.isArray(o.naicsCodes) ? o.naicsCodes[0] : '') || '',
      type: o.type || '',
      posted: o.postedDate || '',
      deadline: o.responseDeadLine || '',
      setAside: o.typeOfSetAsideDescription || o.typeOfSetAside || '',
      link: o.uiLink || '',
      state: st
    })).filter(o => o.title && NAICS_OK.test(String(o.naics)) && (!o.deadline || Date.parse(o.deadline) >= now));
  } catch (e) { return []; }
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=900');

  if (!SAM_KEY) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, configured: false, states: {}, summary: { count: 0 }, note: 'Open-bid feed needs a free SAM.gov API key (SAM_API_KEY).' }));
  }

  let fresh = false; try { fresh = new URL(req.url, 'http://x').searchParams.get('refresh') === '1'; } catch (e) {}
  let doc = null; try { doc = await db.get('civil:rfps'); } catch (e) {}
  if (!fresh && doc && doc.updated && (Date.now() - doc.updated) < TTL_MS && doc.states) {
    res.statusCode = 200; return res.end(JSON.stringify(Object.assign({ ok: true, configured: true, cached: true }, doc)));
  }

  const results = await Promise.all(STATES.map(fetchState));
  const states = {}; let count = 0, setAsides = 0;
  STATES.forEach((st, i) => {
    const rows = (results[i] || []).sort((a, b) => (Date.parse(a.deadline || '2999') - Date.parse(b.deadline || '2999')));
    states[st] = rows; count += rows.length; setAsides += rows.filter(r => /small|sba|8\(a\)|wosb|hubzone|sdvosb|set.?aside/i.test(r.setAside)).length;
  });

  doc = { updated: Date.now(), states: states, summary: { count: count, setAsides: setAsides, naicsPrefixes: ['237', '5413'], lookbackDays: LOOKBACK_DAYS } };
  if (count) { try { await db.set('civil:rfps', doc); } catch (e) {} }

  res.statusCode = 200;
  return res.end(JSON.stringify(Object.assign({ ok: true, configured: true, cached: false }, doc)));
};
