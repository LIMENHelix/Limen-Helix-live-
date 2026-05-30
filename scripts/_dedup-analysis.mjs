import fs from 'node:fs';
const DIR = 'assets/data/companies/';
// NOTE: do NOT strip "kgaa" — it distinguishes Merck KGaA (German) from Merck & Co (US).
const NS = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|sa|ag|nv|se|holdings?|group|the)\b/gi;
const nk = n => String(n || '').replace(NS, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const portals = {};
const refCount = {};
for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(DIR + f, 'utf8')); } catch (e) { continue; }
  const slug = f.replace(/\.json$/, '');
  let fn = 0; const fnet = p.functionalNetwork || {};
  for (const c in fnet) { const a = Array.isArray(fnet[c]) ? fnet[c] : [fnet[c]]; fn += a.length; for (const e of a) { if (e && e.slug) refCount[e.slug] = (refCount[e.slug] || 0) + 1; } }
  portals[slug] = { name: p.name || slug, ticker: (p.ticker || '').toLowerCase(), fn, cik: p.cik };
}

// CB wiring
let cbSlugs = new Set();
try { const cb = JSON.parse(fs.readFileSync('assets/data/command-board-data.json', 'utf8')).companies || []; for (const r of cb) if (r.s) cbSlugs.add(r.s); } catch (e) {}

// cluster by nameKey
const byName = {};
for (const slug in portals) { const k = nk(portals[slug].name); if (k) (byName[k] = byName[k] || []).push(slug); }

function score(slug) {
  const p = portals[slug];
  let s = 0;
  // refCount dominates (keep the slug the web actually points at — fewer edges
  // to re-resolve, and it's the one that earned references). CB-wiring is only a
  // tiebreaker (the CB row gets re-pointed to the canonical either way).
  s += (refCount[slug] || 0) * 100;
  s += p.fn;                                                // richer content
  if (cbSlugs.has(slug)) s += 3000;                         // strong: keep CB-wired correct-entity/Tier-1 portal (but _alt/_2 penalty below still overrides for artifacts)
  if (/(_alt|_meta|_\d+)$/.test(slug)) s -= 50000;          // collision/junk-suffix artifacts lose
  if (p.ticker && slug === p.ticker) s -= 5000;             // ticker-slug loses to name-slug
  return s;
}

const clusters = [];
for (const k in byName) {
  if (byName[k].length < 2) continue;
  const members = byName[k].slice().sort((a, b) => score(b) - score(a));
  clusters.push({ key: k, canonical: members[0], losers: members.slice(1), members });
}
clusters.sort((a, b) => a.canonical.localeCompare(b.canonical));

console.log('=== DEDUP PLAN (' + clusters.length + ' clusters) ===');
console.log('keep <- [delete] | per member: name | CB? | ref | fn\n');
for (const c of clusters) {
  console.log('KEEP ' + c.canonical + '  <-  delete: ' + c.losers.join(', '));
  for (const m of c.members) {
    const p = portals[m];
    console.log('   ' + (m === c.canonical ? '* ' : '  ') + m.padEnd(28) + ' | "' + p.name + '"' + (cbSlugs.has(m) ? ' | CB-WIRED' : '') + ' | ref=' + (refCount[m] || 0) + ' | fn=' + p.fn);
  }
  console.log('');
}
// emit alias proposals
const proposed = {};
for (const c of clusters) for (const l of c.losers) proposed[l] = c.canonical;
fs.writeFileSync('scripts/_dedup-proposed.json', JSON.stringify(proposed, null, 2));
console.log('proposed alias map (loser->canonical) written: scripts/_dedup-proposed.json  (' + Object.keys(proposed).length + ' entries)');
