#!/usr/bin/env node
/**
 * wire-ticker-aliases.mjs — make ticker-derived portal links resolve.
 *
 * WHY. Surfaces across the site build `company-portal.html?company=<ticker>` when they have a
 * ticker but no CIK — 15 `*-clarity-operator.js` files do it on one line each, plus the
 * opportunities pages and company-resolver.js. Measured 2026-07-31 against the live corpus:
 *
 *   703 portals carry a ticker
 *   190 (27.0%)  the ticker IS the portal slug          -> link works
 *    21 ( 3.0%)  the ticker resolves through the alias map -> link works
 *   492 (70.0%)  resolves to NOTHING                    -> graceful absent page
 *
 * So a labelled COMPANY PORTAL button failed seven times in ten. Not a 404 — company-portal-ui.js
 * tries the slug, then the alias map, then a graceful absent page — but a 70% miss rate on an
 * action button is a real defect, not a mitigated one.
 *
 * THE FIX IS THE ALIAS MAP, NOT THE 25 EMITTERS. company-portal-ui.js:1464 already consults
 * assets/data/company-aliases.json before giving up. The map simply never learned tickers. Filling
 * it fixes every emitter at once, including any written later, and touches no page.
 *
 * SAFETY. Only UNAMBIGUOUS tickers are written: a ticker held by exactly one portal. 8 tickers map
 * to several portals (abt -> abbott_diagnostics|abbott_laboratories|abbott_metabolic, googl ->
 * alphabet|google_cloud, amzn -> amazon|amazon_logistics, fdx -> fedex|fedex_logistics, ...). Those
 * are the intentional segment breakouts vitals already reports under "Segment breakouts sharing a
 * parent CIK", and guessing one would send the operator to the wrong subsidiary. They are skipped
 * and reported, and their links keep landing on the absent page, which is the honest outcome.
 *
 * Existing entries are never overwritten. Idempotent: re-run after each generation batch.
 *
 *   node scripts/wire-ticker-aliases.mjs --dry-run
 *   node scripts/wire-ticker-aliases.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const ALIAS_PATH = path.join(ROOT, 'assets', 'data', 'company-aliases.json');
const APPLY = process.argv.includes('--apply');

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const slugs = new Set(files.map(f => f.replace(/\.json$/, '')));

const doc = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'));
const aliases = doc.aliases || (doc.aliases = {});

// ticker -> [slug, ...]
const byTicker = {};
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  if (!p.ticker) continue;
  const t = String(p.ticker).toLowerCase().trim();
  if (!t) continue;
  (byTicker[t] = byTicker[t] || []).push(slug);
}

const added = [], ambiguous = [], alreadyOk = [], collision = [];
for (const t of Object.keys(byTicker).sort()) {
  // Already resolvable: the ticker is itself a portal filename, or the map already points somewhere real.
  if (slugs.has(t)) { alreadyOk.push(t); continue; }
  if (aliases[t]) { (slugs.has(aliases[t]) ? alreadyOk : collision).push(t); continue; }   // never overwrite
  if (byTicker[t].length > 1) { ambiguous.push(t + ' -> ' + byTicker[t].join(' | ')); continue; }
  aliases[t] = byTicker[t][0];
  added.push(t + ' -> ' + byTicker[t][0]);
}

const total = Object.keys(byTicker).length;
console.log('distinct tickers in corpus: ' + total);
console.log('  already resolved         : ' + alreadyOk.length);
console.log('  aliases ADDED            : ' + added.length);
console.log('  ambiguous (skipped)      : ' + ambiguous.length);
console.log('  map points at a missing portal (left alone): ' + collision.length);
if (ambiguous.length) { console.log('\nambiguous, deliberately not guessed:'); ambiguous.forEach(a => console.log('   ' + a)); }
if (collision.length) { console.log('\nexisting alias -> missing portal (pre-existing, not touched):'); collision.slice(0, 10).forEach(a => console.log('   ' + a + ' -> ' + aliases[a])); }

if (!APPLY) { console.log('\n(dry run — nothing written)'); process.exit(0); }

doc.count = Object.keys(aliases).length;
doc.generatedAt = new Date().toISOString();
fs.writeFileSync(ALIAS_PATH, JSON.stringify(doc, null, 2));
console.log('\nwrote ' + ALIAS_PATH + ' — ' + doc.count + ' aliases total');
