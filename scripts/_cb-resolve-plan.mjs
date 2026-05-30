import fs from 'node:fs';
const D = 'assets/data/companies/';
const NS = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|sa|ag|nv|se|holdings?|group|the)\b/gi;
const nk = n => String(n || '').replace(NS, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const norm = c => String(c == null ? '' : c).replace(/^0+/, '') || '0';

// index existing portal FILES
const byCik = {}, byTicker = {}, byName = {};
for (const f of fs.readdirSync(D)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue;
  let p; try { p = JSON.parse(fs.readFileSync(D + f, 'utf8')); } catch (e) { continue; }
  const slug = f.replace(/\.json$/, '');
  if (p.cik) byCik[norm(p.cik)] = slug;
  if (p.ticker) (byTicker[p.ticker.toLowerCase()] = byTicker[p.ticker.toLowerCase()] || []).push(slug);
  const k = nk(p.name); if (k) (byName[k] = byName[k] || []).push({ slug, name: p.name });
}
const has = s => fs.existsSync(D + s + '.json');

const cb = JSON.parse(fs.readFileSync('assets/data/command-board-data.json', 'utf8')).companies || [];
const al = JSON.parse(fs.readFileSync('assets/data/company-aliases.json', 'utf8')).aliases || {};
const JUNK = new Set(['amwl', 'ccrn']);

const plan = { wire: [], cikError: [], generate: [], junk: [] };
for (const r of cb) {
  if (!r.s || has(al[r.s] || r.s)) continue;       // resolves already
  const cbNk = nk(r.n);
  if (JUNK.has(r.s) || !cbNk) { plan.junk.push(r); continue; }
  // 1. portal whose NAME matches this company (most reliable) -> WIRE
  const nameHit = (byName[cbNk] || [])[0];
  if (nameHit) { plan.wire.push({ r, to: nameHit.slug, via: 'name', portalName: nameHit.name }); continue; }
  // 2. ticker match -> WIRE
  const tHit = (byTicker[(r.t || '').toLowerCase()] || [])[0];
  if (r.t && tHit) { plan.wire.push({ r, to: tHit, via: 'ticker' }); continue; }
  // 3. cik match but name DIDN'T match -> likely cik-collision error
  const cHit = byCik[norm(r.c)];
  if (cHit) { plan.cikError.push({ r, cikTarget: cHit }); continue; }
  // 4. nothing -> needs generation
  plan.generate.push(r);
}

const dom = { neurology: 'medicine', addiction: 'medicine', health: 'medicine', contemplative: 'religion', p2_agri: 'agriculture', legal: 'law', research: 'science', supplyChain: 'trade' };
console.log('=== CB RESOLUTION PLAN ===');
console.log('\n[WIRE] portal exists, just point CB at it (' + plan.wire.length + '):');
for (const w of plan.wire) console.log('   ' + w.r.n + ': ' + w.r.s + ' -> ' + w.to + '  (' + w.via + (w.portalName ? ' "' + w.portalName + '"' : '') + ')');
console.log('\n[CIK-ERROR] cik maps to a different-name portal — do NOT wire (' + plan.cikError.length + '):');
for (const c of plan.cikError) console.log('   ' + c.r.n + ' (cik ' + c.r.c + ') -> ' + c.cikTarget + '  [verify]');
console.log('\n[GENERATE] no portal anywhere — needs a deep portal (' + plan.generate.length + '):');
for (const g of plan.generate) console.log('   ' + g.n + '  (ticker ' + g.t + ', cik ' + g.c + ', domain ' + (dom[g.d] || g.d) + ')');
console.log('\n[JUNK] (' + plan.junk.length + '):');
for (const j of plan.junk) console.log('   ' + j.n + ' (s=' + j.s + ')');

fs.writeFileSync('scripts/_cb-resolve-plan.json', JSON.stringify({
  wire: plan.wire.map(w => ({ name: w.r.n, cik: w.r.c, ticker: w.r.t, from: w.r.s, to: w.to, via: w.via })),
  cikError: plan.cikError.map(c => ({ name: c.r.n, cik: c.r.c, from: c.r.s, cikTarget: c.cikTarget })),
  generate: plan.generate.map(g => ({ name: g.n, ticker: g.t, cik: g.c, domain: dom[g.d] || g.d, slug: nk(g.n).length ? g.n.replace(/\([^)]*\)/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : g.s })),
  junk: plan.junk.map(j => ({ name: j.n, s: j.s }))
}, null, 2));
console.log('\nplan written: scripts/_cb-resolve-plan.json');
