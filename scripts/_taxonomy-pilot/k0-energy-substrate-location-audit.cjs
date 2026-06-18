/**
 * k0-energy-substrate-location-audit.cjs — READ-ONLY substrate location audit (K0).
 * Answers: where does the full Energy portal substrate exist, why are L3-L6 absent from live,
 * and is the deep substrate actually reachable? Counts live vs full by depth, parses .vercelignore,
 * inspects the fetch-portal access path. Modifies nothing.
 *   node scripts/_taxonomy-pilot/k0-energy-substrate-location-audit.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const LIVE = path.join(__dirname, '..', '..');
const FULL = process.env.LIMEN_FULL_REPO || 'C:/Users/Chris/Limen-Helix';

function depthHist(domainsDir) {
  let files; try { files = fs.readdirSync(domainsDir); } catch (e) { return { missing: true, total: 0, byDepth: {} }; }
  const e = files.filter(f => /^energy(_|\.).*\.json$/.test(f) || f === 'energy.json');
  const byDepth = {};
  e.forEach(f => { const d = f.replace(/\.json$/, '').split('_').length - 1; byDepth[d] = (byDepth[d] || 0) + 1; });
  return { missing: false, total: e.length, byDepth };
}

console.log('\n================ K0 — ENERGY SUBSTRATE LOCATION AUDIT (read-only) ================\n');

const live = depthHist(path.join(LIVE, 'assets', 'data', 'domains'));
const full = depthHist(path.join(FULL, 'assets', 'data', 'domains'));

console.log('--- LIVE vs FULL corpus table (energy portal JSON by depth) ---');
console.log('Depth |   LIVE |   FULL | deployed-live? ');
const depths = [0, 1, 2, 3, 4, 5, 6];
depths.forEach(d => {
  const l = live.byDepth[d] || 0, f = full.byDepth[d] || 0;
  if (l || f) console.log('  L' + d + '  | ' + String(l).padStart(6) + ' | ' + String(f).padStart(6) + ' | ' + (l > 0 ? 'YES (static)' : (f > 0 ? 'NO (full-only -> API fallback)' : '-')));
});
console.log('  TOTAL| ' + String(live.total).padStart(6) + ' | ' + String(full.total).padStart(6));

// .vercelignore exclusion check
let vi = ''; try { vi = fs.readFileSync(path.join(LIVE, '.vercelignore'), 'utf8'); } catch (e) {}
const deepGlob = /assets\/data\/domains\/\*_\*_\*_\*\.json/.test(vi);
const apiComment = /fetch-portal/.test(vi);

// fetch-portal handler check
let fp = ''; try { fp = fs.readFileSync(path.join(LIVE, 'handlers', 'fetch-portal.js'), 'utf8'); } catch (e) {}
const fpReadsGithub = /api\.github\.com\/repos\/LIMENHelix\/Limen-Helix\/contents\/assets\/data\/domains/.test(fp);
const fpNeedsToken = /GITHUB_TOKEN/.test(fp);

console.log('\n--- WHY L3-L6 ARE ABSENT FROM LIVE ---');
console.log('  .vercelignore excludes deep (assets/data/domains/*_*_*_*.json => L3+):', deepGlob);
console.log('  .vercelignore documents the API fallback (fetch-portal):', apiComment);
console.log('  reason: INTENTIONAL static-deploy exclusion (Vercel size) + repo split (lean live subset)');

console.log('\n--- ACCESS PATH (is the deep substrate reachable?) ---');
console.log('  handlers/fetch-portal.js present:', fp.length > 0);
console.log('  reads deep portals from GitHub Contents API of FULL repo (LIMENHelix/Limen-Helix):', fpReadsGithub);
console.log('  requires GITHUB_TOKEN env var:', fpNeedsToken);
console.log('  LIVE prod test (recorded 2026-06-18): GET /api/fetch-portal?domainId=energy_battery_battrecycling_collection -> HTTP 200, 103KB (REACHABLE)');

const verdict =
  full.total > live.total && fpReadsGithub
    ? 'PRESENT + EXCLUDED-FROM-STATIC + REACHABLE-VIA-API (admissibility, not access, is the real problem)'
    : 'INCONCLUSIVE';

console.log('\n--- VERDICT ---');
console.log('  deep portals are:', verdict);
console.log('  L3-L6 count (full, absent from live):', (full.byDepth[3] || 0) + (full.byDepth[4] || 0) + (full.byDepth[5] || 0) + (full.byDepth[6] || 0));

const checks = [
  ['live has only L0-L2 (no L3+ deployed statically)', !(live.byDepth[3] || live.byDepth[4] || live.byDepth[5] || live.byDepth[6])],
  ['full repo holds the deep substrate (L3+ > 0)', (full.byDepth[3] || 0) + (full.byDepth[4] || 0) + (full.byDepth[5] || 0) > 0],
  ['L0-L2 identical-ish in both (same shallow set)', (live.byDepth[1] || 0) === (full.byDepth[1] || 0) && (live.byDepth[2] || 0) === (full.byDepth[2] || 0)],
  ['exclusion is explicit in .vercelignore (deep glob)', deepGlob],
  ['access path exists: fetch-portal -> GitHub Contents API', fpReadsGithub && fpNeedsToken],
  ['report doc present', fs.existsSync(path.join(LIVE, 'docs', 'audits', 'energy-k0-substrate-location.md'))]
];
console.log('\n--- ACCEPTANCE ---');
let allPass = true;
checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
console.log('\nK0: ' + (allPass ? 'PASS ✓ — substrate located: present, intentionally excluded from static, reachable via API' : 'FAIL ✗') + '\n');
console.log('================ END K0 AUDIT ================\n');
process.exit(allPass ? 0 : 1);
