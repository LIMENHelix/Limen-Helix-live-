// Wire a REAL SEC EDGAR distress signal into operator-console.html (Finance meter).
// Server-side fetch (no CORS / UA restrictions). Re-run to refresh; cron-friendly.
//   node wire-finance-feed.mjs
import fs from 'fs';

const UA = { headers: { 'User-Agent': 'LIMEN Helix research chrishubbel72@gmail.com', 'Accept': 'application/json' } };
const FORMS = '8-K,10-Q,10-K';
const fmt = d => d.toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function search(phrase, startdt, enddt) {
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent('"' + phrase + '"')}&forms=${FORMS}&startdt=${startdt}&enddt=${enddt}`;
  const r = await fetch(url, UA);
  if (!r.ok) throw new Error('EDGAR ' + r.status + ' for "' + phrase + '"');
  const j = await r.json();
  return { total: j?.hits?.total?.value || 0, hits: j?.hits?.hits || [] };
}

function parseHit(h) {
  const dn = (h._source?.display_names || [])[0] || 'Unknown filer';
  const name = dn.replace(/\s*\(CIK.*$/, '').replace(/\s{2,}/g, ' ').trim();
  const cik = (dn.match(/CIK\s*(\d+)/) || [])[1]?.replace(/^0+/, '') || null;
  const form = h._source?.file_type || h._source?.root_form || 'filing';
  const date = h._source?.file_date || '';
  const [acc, doc] = String(h._id || '').split(':');
  let link = cik
    ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=&dateb=&owner=include&count=40`
    : 'https://efts.sec.gov/LATEST/search-index';
  if (cik && acc && doc) link = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/${doc}`;
  return { name, form, date, link };
}

const now = new Date();
const d7 = fmt(new Date(Date.now() - 7 * 864e5));
const d30 = fmt(new Date(Date.now() - 30 * 864e5));
const end = fmt(now);

// "substantial doubt" = the auditor going-concern trigger phrase (a real distress leading indicator)
const gc7 = await search('substantial doubt', d7, end);   await sleep(250);
const gc30 = await search('substantial doubt', d30, end);  await sleep(250);
const ch7 = await search('chapter 11', d7, end);

// Signal = how elevated the last 7 days are vs the 30-day weekly run-rate.
const runRateWeekly = gc30.total * (7 / 30);
const ratio = runRateWeekly > 0 ? gc7.total / runRateWeekly : 1;
let sev = Math.round(55 + (ratio - 1) * 60);
sev = Math.max(20, Math.min(98, sev));

// Evidence: most-recent distinct going-concern filers (dedup by name)
const src = gc7.hits.length ? gc7.hits : gc30.hits;
const seen = new Set(); const evidence = [];
for (const h of src) {
  const e = parseHit(h);
  if (!e.name || seen.has(e.name)) continue;
  seen.add(e.name); evidence.push(e);
  if (evidence.length >= 5) break;
}

const out = {
  sev, updated: end, window: '7d vs 30d run-rate',
  gc7: gc7.total, gc30: gc30.total, ch7: ch7.total,
  ratio: Number(ratio.toFixed(3)), evidence,
  source: 'SEC EDGAR full-text search (efts.sec.gov)'
};

fs.writeFileSync('finance-signal.json', JSON.stringify(out, null, 2));

const file = 'operator-console.html';
let html = fs.readFileSync(file, 'utf8');
const block = `/* FINANCE_LIVE_START */\nconst FINANCE_LIVE = ${JSON.stringify(out)};\n/* FINANCE_LIVE_END */`;
const re = /\/\* FINANCE_LIVE_START \*\/[\s\S]*?\/\* FINANCE_LIVE_END \*\//;
if (!re.test(html)) { console.error('marker block not found in ' + file); process.exit(1); }
html = html.replace(re, block);
fs.writeFileSync(file, html);

console.log('Finance signal wired ->', {
  sev, ratio: out.ratio, goingConcern_7d: gc7.total, goingConcern_30d: gc30.total,
  chapter11_7d: ch7.total, evidence: evidence.length, updated: end
});
