#!/usr/bin/env node
/**
 * detect-slug-aliases.mjs — surface orphan slugs that are the SAME real entity
 * as an existing portal under a different slug, so Tier-2 aliases them instead
 * of generating a duplicate portal (precise-not-equivalent; stop rather than
 * create issues). Read-only — writes only a candidate list for review.
 *
 * Two detectors:
 *   1) IDENTITY alias — orphan name ≈ an existing portal name (normalized token
 *      Jaccard ≥ 0.6, or exact normalized-name match, or a parenthetical-ticker
 *      token shared). e.g. tsmc "Taiwan Semiconductor Manufacturing Company
 *      Limited" ≈ taiwan_semiconductor "Taiwan Semiconductor (TSMC)".
 *   2) SEGMENT alias — orphan is a business unit of a parent that has a portal
 *      ("X Web Services / AWS", "X Cloud", "X Azure"). Flagged separately:
 *      these may warrant their OWN federation node rather than a hard alias —
 *      decision is left to review, not auto-applied.
 *
 * Output: scripts/_slug-alias-candidates.json (review, then hand-curate the
 * confirmed pairs into a canonical alias map). Nothing is auto-aliased.
 *
 *   node scripts/detect-slug-aliases.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const ORPHAN_PATH = path.join(ROOT, 'assets', 'data', 'orphan-stakeholders.json');
const OUT = path.join(__dirname, '_slug-alias-candidates.json');

const STOP = new Set(['the','inc','incorporated','corp','corporation','co','company','companies','ltd','limited','plc','llc','lp','sa','ag','nv','se','kgaa','holdings','holding','group','international','technologies','technology','systems','solutions','services','industries','enterprises','laboratories','labs','pharmaceuticals','pharma','and','of','de']);
const norm = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = s => norm(s).split(' ').filter(t => t && !STOP.has(t));
const tokenSet = s => new Set(tokens(s));
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
const parenTokens = s => { const m = String(s || '').match(/\(([^)]*)\)/g) || []; return m.flatMap(x => x.replace(/[()]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)); };
// strip trailing corporate-suffix tokens from a slug: corning_inc -> corning,
// schneider_electric_se -> schneider_electric. Structural (slug-only), so it
// can't fuse distinct companies the way name-token clustering did.
const SLUG_SUFFIX = new Set(['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'companies', 'ltd', 'limited', 'plc', 'llc', 'lp', 'sa', 'ag', 'nv', 'se', 'kgaa', 'holdings', 'holding', 'group', 'the', 'of']);
const baseSlug = slug => { const parts = String(slug || '').split('_'); while (parts.length > 1 && SLUG_SUFFIX.has(parts[parts.length - 1])) parts.pop(); return parts.join('_'); };

// index existing portals
const portals = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue;
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const slug = p.slug || f.replace(/\.json$/, '');
  portals.push({ slug, name: p.name || slug, ticker: (p.ticker || '').toLowerCase(), nameNorm: norm(p.name || slug), toks: tokenSet(p.name || slug), parenToks: parenTokens(p.name) });
}
const portalSlugSet = new Set(portals.map(p => p.slug));
const SEG_RE = /\b(web services|aws|azure|cloud platform|google cloud|gcp|cloud)\b/i;

// Build the raw orphan set DIRECTLY from portal functionalNetwork — NOT from
// the alias-collapsed orphan-stakeholders.json. Reading the collapsed registry
// would shrink the alias map every run (aliased orphans get collapsed out, so
// the next run can't re-derive them) — an unstable feedback loop that silently
// drops valid aliases.
const CAT_ARCH = { suppliers: 'company', customers: 'company', competitors: 'company', logisticsPartners: 'company', capitalProviders: 'capital', regulators: 'regulator', auditor: 'auditor', executiveTeam: 'executive', marketSignals: 'market-signal', model: 'company' };
const COMPANY_CATS = new Set(['suppliers', 'customers', 'competitors', 'logisticsPartners']);
const reg = {};
{
  const raw = {};
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
    const fn = p.functionalNetwork || {};
    for (const cat in fn) {
      const arr = Array.isArray(fn[cat]) ? fn[cat] : (fn[cat] && typeof fn[cat] === 'object' ? [fn[cat]] : []);
      for (const e of arr) {
        if (!e || typeof e !== 'object' || !e.slug || portalSlugSet.has(e.slug)) continue;
        const o = raw[e.slug] || (raw[e.slug] = { name: e.name || e.slug, refCount: 0, cats: {}, domains: {} });
        o.refCount++; o.cats[cat] = (o.cats[cat] || 0) + 1; if (p.domainId) o.domains[p.domainId] = (o.domains[p.domainId] || 0) + 1;
        if ((!o.name || o.name === e.slug) && e.name) o.name = e.name;
      }
    }
  }
  for (const slug in raw) {
    const o = raw[slug];
    const dominant = Object.keys(o.cats).sort((a, b) => o.cats[b] - o.cats[a])[0];
    reg[slug] = { name: o.name, refCount: o.refCount, archetype: COMPANY_CATS.has(dominant) ? 'company' : (CAT_ARCH[dominant] || 'other'), domains: Object.keys(o.domains) };
  }
}
const candidates = [];
const segments = [];
const unmatched = [];   // company orphans with no existing-portal match — candidates for intra-orphan dedup

for (const [slug, o] of Object.entries(reg)) {
  if (o.archetype !== 'company') continue;
  const oToks = tokenSet(o.name);
  const oParen = parenTokens(o.name);
  // segment detector
  if (SEG_RE.test(o.name)) {
    // parent = name with the segment phrase stripped
    const parentName = o.name.replace(/\(([^)]*)\)/g, '').replace(SEG_RE, '').replace(/,?\s*(inc|llc|corp|ltd)\.?/i, '').trim();
    const pToks = tokenSet(parentName);
    let best = null, bestScore = 0;
    for (const p of portals) { const sc = jaccard(pToks, p.toks); if (sc > bestScore) { bestScore = sc; best = p; } }
    segments.push({ orphanSlug: slug, orphanName: o.name, refCount: o.refCount, parentGuess: best ? best.slug : null, parentName: best ? best.name : null, parentScore: +bestScore.toFixed(2) });
    continue;
  }
  // identity detector
  let best = null, bestScore = 0, reason = '';
  for (const p of portals) {
    if (p.slug === slug) { best = p; bestScore = 1; reason = 'same-slug(already has portal)'; break; }
    // orphan-slug == ticker, or orphan slug appears in the portal's parenthetical.
    // DO NOT match the ticker against arbitrary tokens in the orphan's name —
    // common-word tickers (ServiceNow=NOW, Bio-Techne=TECH, private-co=PRIVATE)
    // collide with prose ("(now Coherent Corp)", "part of Tech Data"). That path
    // produced garbage matches and is removed.
    if (p.ticker && p.ticker.length >= 2 && (slug === p.ticker || p.parenToks.includes(slug))) { best = p; bestScore = 0.99; reason = 'ticker-match'; break; }
    if (p.nameNorm && p.nameNorm === norm(o.name)) { best = p; bestScore = 0.98; reason = 'exact-name'; break; }
    const sc = jaccard(oToks, p.toks);
    if (sc > bestScore) { bestScore = sc; best = p; reason = 'token-jaccard'; }
  }
  if (best && bestScore >= 0.6) candidates.push({ orphanSlug: slug, orphanName: o.name, refCount: o.refCount, canonicalSlug: best.slug, canonicalName: best.name, score: +bestScore.toFixed(2), reason });
  else unmatched.push({ slug, name: o.name, refCount: o.refCount, key: tokens(o.name).sort().join(' ') });
}

// intra-orphan dedup: cluster unmatched orphans by normalized token key; a
// cluster of >1 slug = the same not-yet-built entity referenced under multiple
// slugs (3x Google Cloud, 3x Mandiant). Canonical = highest refCount; rest alias.
const byKey = {};
for (const u of unmatched) { if (!u.key) continue; (byKey[u.key] = byKey[u.key] || []).push(u); }
const intraOrphanDups = [];
for (const key in byKey) {
  const grp = byKey[key];
  if (grp.length < 2) continue;
  grp.sort((a, b) => b.refCount - a.refCount || a.slug.length - b.slug.length);
  const canon = grp[0];
  intraOrphanDups.push({ canonicalSlug: canon.slug, canonicalName: canon.name, totalRefCount: grp.reduce((s, g) => s + g.refCount, 0), aliases: grp.slice(1).map(g => ({ slug: g.slug, name: g.name, refCount: g.refCount })) });
}

// SAFE intra-orphan dedup via slug morphology: group unmatched orphans by
// baseSlug; only when the bare base is itself a member (unambiguous canonical)
// and the variant's name shares the base token, alias the suffixed variant to
// the base. Catches corning_inc->corning, twilio_inc->twilio; will NOT merge
// distinct companies (purely structural + name-token sanity).
const unmatchedSlugSet = new Set(unmatched.map(u => u.slug));
const byBase = {};
for (const u of unmatched) { const b = baseSlug(u.slug); (byBase[b] = byBase[b] || []).push(u); }
const intraOrphanSafe = {};
for (const b in byBase) {
  const grp = byBase[b];
  if (grp.length < 2 || !unmatchedSlugSet.has(b)) continue;   // canonical must be the bare-base member
  const baseTok = b.split('_')[0];
  for (const u of grp) {
    if (u.slug === b) continue;
    if (u.slug.startsWith(b + '_') && (tokens(u.name).includes(baseTok) || baseTok.length >= 5)) intraOrphanSafe[u.slug] = b;
  }
}

candidates.sort((a, b) => b.refCount - a.refCount || b.score - a.score);
segments.sort((a, b) => b.refCount - a.refCount);
intraOrphanDups.sort((a, b) => b.totalRefCount - a.totalRefCount);

const out = { generatedAt: new Date().toISOString(), note: 'CANDIDATES ONLY — review before aliasing. identity = likely same entity as an existing portal (alias, do not regenerate). segments = business units; decide own-node vs alias per federation archetype. intraOrphanDups = same not-yet-built entity under multiple orphan slugs (alias to canonical, generate once).', identityCandidates: candidates, segmentCandidates: segments, intraOrphanDups };
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

// Emit the AUTO-SAFE production alias map: ONLY exact-name + ticker-match
// (high confidence the orphan IS an existing portal), excluding self-matches
// (same-slug = stale registry, not an alias). token-jaccard, intra-orphan
// clusters and segments are deliberately EXCLUDED — they need manual review.
const SAFE_OUT = path.join(ROOT, 'assets', 'data', 'company-aliases.json');
const aliases = {};
for (const c of candidates) {
  if ((c.reason === 'exact-name' || c.reason === 'ticker-match') && c.orphanSlug !== c.canonicalSlug && portalSlugSet.has(c.canonicalSlug)) {
    aliases[c.orphanSlug] = c.canonicalSlug;
  }
}
// merge safe intra-orphan slug-morphology aliases; if the canonical base itself
// aliases to a portal, point the variant straight at the portal (no chains).
let intraAdded = 0;
for (const variant in intraOrphanSafe) {
  if (aliases[variant]) continue;
  const base = intraOrphanSafe[variant];
  aliases[variant] = aliases[base] || base;
  intraAdded++;
}
// merge hand-curated aliases (segment dups + reviewed cases); manual wins.
let manualAdded = 0;
try {
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, '_alias-manual.json'), 'utf8')).aliases || {};
  for (const a in man) { if (aliases[a] !== man[a]) manualAdded++; aliases[a] = man[a]; }
} catch (e) {}
const aliasOut = { schemaVersion: 'company-aliases/1.0', generatedAt: new Date().toISOString(), note: 'aliasSlug -> canonical portal slug. Auto-safe tier only (exact normalized-name or exact ticker match to an existing portal). Consumed by build-orphan-registry (collapse), build-fractal-portals (skip in Tier-2), company-portal-ui (resolve on fetch-miss). Fuzzy/segment/intra-orphan candidates are NOT here — see scripts/_slug-alias-candidates.json.', count: Object.keys(aliases).length, aliases };
fs.writeFileSync(SAFE_OUT, JSON.stringify(aliasOut, null, 2));

const byReason = candidates.reduce((m, c) => { m[c.reason] = (m[c.reason] || 0) + 1; return m; }, {});
console.log('=== slug alias detection ===');
console.log('identity candidates (orphan ≈ existing portal):', candidates.length, JSON.stringify(byReason));
console.log('  top 25 by refCount:');
for (const c of candidates.slice(0, 25)) console.log(`   ${String(c.refCount).padStart(4)}  ${c.orphanSlug}  ->  ${c.canonicalSlug}   [${c.reason} ${c.score}]  "${c.orphanName}"`);
console.log('\nintra-orphan dup clusters (same entity, multiple orphan slugs):', intraOrphanDups.length);
for (const d of intraOrphanDups.slice(0, 12)) console.log(`   canon ${d.canonicalSlug} (${d.totalRefCount} total)  <-  ${d.aliases.map(a => a.slug).join(', ')}`);
console.log('\nsegment candidates (business units of a parent portal):', segments.length);
for (const s of segments.slice(0, 12)) console.log(`   ${String(s.refCount).padStart(4)}  ${s.orphanSlug}  parent? ${s.parentGuess} (${s.parentScore})  "${s.orphanName}"`);
console.log('\nsafe intra-orphan slug-morphology aliases added:', intraAdded);
for (const v of Object.keys(intraOrphanSafe).slice(0, 15)) console.log('   ', v, '->', aliases[v]);
console.log('manual curated aliases merged:', manualAdded);
console.log('\nalias map total (orphan->portal + intra-orphan + manual):', Object.keys(aliases).length, '->', SAFE_OUT);
console.log('written:', OUT);
