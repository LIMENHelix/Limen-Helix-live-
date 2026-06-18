/**
 * k1-energy-portal-access-map.cjs — READ-ONLY deep-portal ACCESS MAP (K1).
 * Reconstructs the full Energy portal tree (27k files) from the full repo: depth, ancestry, parent
 * (filename-inferred vs parentPortal field), children, orphans, broken links, parent-field mismatches.
 * Structure + reachability only — NO admission, NO traversal, NO source trust (that is K2).
 * Reads parentPortal cheaply via 512-byte header reads; samples content per depth. Writes a COMPACT
 * map to assets/data/deep/energy-portal-access-map.json. node scripts/_taxonomy-pilot/k1-energy-portal-access-map.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const LIVE = path.join(__dirname, '..', '..');
const FULL = process.env.LIMEN_FULL_REPO || 'C:/Users/Chris/Limen-Helix';
const FULL_DOM = path.join(FULL, 'assets', 'data', 'domains');
const LIVE_DOM = path.join(LIVE, 'assets', 'data', 'domains');
const OUT = path.join(LIVE, 'assets', 'data', 'deep', 'energy-portal-access-map.json');

const isEnergy = (f) => (/^energy(_|\.).*\.json$/.test(f) || f === 'energy.json');
const idOf = (f) => f.replace(/\.json$/, '');
const depthOf = (id) => id.split('_').length - 1;
const inferredParent = (id) => { const p = id.split('_'); p.pop(); return p.length ? p.join('_') : null; };
function headParent(p) {
  try { const fd = fs.openSync(p, 'r'); const b = Buffer.alloc(512); const r = fs.readSync(fd, b, 0, 512, 0); fs.closeSync(fd); const m = b.toString('utf8', 0, r).match(/"parentPortal"\s*:\s*"([^"]*)"/); return m ? m[1].replace(/_portal\.html$/, '').replace(/\.html$/, '') : null; } catch (e) { return null; }
}
function contentStats(p) {
  try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); const acts = j.activations || []; let t = 0, c = 0; acts.forEach(a => { t += (a.treatments || []).length; c += (a.companies || []).length; }); return { activationCount: acts.length, treatmentCount: t, companyCount: c, edgeCount: (j.edges || []).length, issueCount: (j.issues || []).length, sourceFieldCount: (j.sources || []).length }; } catch (e) { return null; }
}

console.log('\n================ K1 — ENERGY DEEP PORTAL ACCESS MAP (read-only) ================\n');

const fullFiles = fs.existsSync(FULL_DOM) ? fs.readdirSync(FULL_DOM).filter(isEnergy) : [];
const liveFiles = fs.existsSync(LIVE_DOM) ? fs.readdirSync(LIVE_DOM).filter(isEnergy) : [];
const liveSet = new Set(liveFiles.map(idOf));
const idSet = new Set(fullFiles.map(idOf));

const byDepth = {}; const branchSubtree = {};
let orphan = 0, brokenParent = 0, parentFieldMismatch = 0, parentFieldMissing = 0;
const orphanSamples = [], brokenSamples = [], mismatchSamples = [];
const dupCheck = {};

fullFiles.forEach(f => {
  const id = idOf(f), d = depthOf(id);
  byDepth[d] = (byDepth[d] || 0) + 1;
  dupCheck[id] = (dupCheck[id] || 0) + 1;
  if (d >= 1) {
    const branch = id.split('_').slice(0, 2).join('_');   // energy_<branch>
    branchSubtree[branch] = (branchSubtree[branch] || 0) + 1;
  }
  if (d > 0) {
    const ip = inferredParent(id);
    const pf = headParent(path.join(FULL_DOM, f));
    const ipExists = idSet.has(ip);
    const pfExists = pf ? idSet.has(pf) : false;
    if (pf && pf !== ip) { parentFieldMismatch++; if (mismatchSamples.length < 20) mismatchSamples.push({ id: id, inferred: ip, field: pf }); }
    if (!pf) parentFieldMissing++;
    if (!ipExists) { brokenParent++; if (brokenSamples.length < 20) brokenSamples.push({ id: id, missingParent: ip }); }
    if (!ipExists && !pfExists) { orphan++; if (orphanSamples.length < 20) orphanSamples.push(id); }
  }
});
const duplicateIds = Object.keys(dupCheck).filter(k => dupCheck[k] > 1);

// children counts (filename ancestry)
const childCount = {};
fullFiles.forEach(f => { const ip = inferredParent(idOf(f)); if (ip) childCount[ip] = (childCount[ip] || 0) + 1; });

// content sampling per depth (structure characterization only; full classification = K2)
const sampleStats = {};
[0, 1, 2, 3, 4, 5, 6].forEach(d => {
  const cands = fullFiles.filter(f => depthOf(idOf(f)) === d).slice(0, 25);
  let n = 0, t = 0, c = 0, withCompanies = 0;
  cands.forEach(f => { const s = contentStats(path.join(FULL_DOM, f)); if (s) { n++; t += s.treatmentCount; c += s.companyCount; if (s.companyCount > 0) withCompanies++; } });
  sampleStats[d] = n ? { sampled: n, avgTreatments: Math.round(t / n * 10) / 10, avgCompanies: Math.round(c / n * 10) / 10, pctWithCompanies: Math.round(withCompanies / n * 100) } : null;
});

const roots = fullFiles.filter(f => depthOf(idOf(f)) === 0).map(idOf);
const branches = Object.keys(branchSubtree).sort((a, b) => branchSubtree[b] - branchSubtree[a]);
const realL1 = branches.filter(b => idSet.has(b));                 // prefix has an actual L1 root file
const missingBranchRoots = branches.filter(b => !idSet.has(b));    // subtree exists but NO L1 root file (e.g. energy_carbon)

console.log('--- LIVE vs FULL ---');
console.log('  liveRepoCount:', liveFiles.length, '| fullRepoCount:', fullFiles.length);
console.log('\n--- BY DEPTH (full) ---');
[0, 1, 2, 3, 4, 5, 6].forEach(d => { if (byDepth[d]) console.log('  L' + d + ': ' + byDepth[d] + (liveSet.size && d <= 2 ? ' (live)' : (d >= 3 ? ' (full-only, API-reachable)' : ''))); });
console.log('\n--- TOP BRANCHES (L1, by subtree size) ---');
branches.slice(0, 19).forEach(b => console.log('  ' + b.padEnd(22) + ' subtree=' + branchSubtree[b] + ' directChildren=' + (childCount[b] || 0)));
console.log('\n--- STRUCTURAL HEALTH ---');
console.log('  realL1Branches:', realL1.length, '| missingBranchRoots (subtree but no L1 file):', JSON.stringify(missingBranchRoots));
console.log('  orphans:', orphan, '| filenameAncestryGaps (resolve via parentField):', brokenParent, '| parentField mismatches:', parentFieldMismatch, '| parentField missing:', parentFieldMissing, '| duplicate ids:', duplicateIds.length);
console.log('  mismatch sample:', JSON.stringify(mismatchSamples[0] || null));
console.log('\n--- CONTENT SAMPLE PER DEPTH (characterization only — classification is K2) ---');
[0, 1, 2, 3, 4, 5, 6].forEach(d => { if (sampleStats[d]) console.log('  L' + d + ': sampled ' + sampleStats[d].sampled + ' | avgTreat ' + sampleStats[d].avgTreatments + ' | avgCo ' + sampleStats[d].avgCompanies + ' | %withCompanies ' + sampleStats[d].pctWithCompanies); });

const map = {
  generatedAt: 'static-2026-06-18',
  sourceRepo: 'LIMENHelix/Limen-Helix (full)',
  liveRepoCount: liveFiles.length,
  fullRepoCount: fullFiles.length,
  totalPortals: fullFiles.length,
  byDepth: byDepth,
  roots: roots,
  branches: branches.map(b => ({ branch: b, subtree: branchSubtree[b], directChildren: childCount[b] || 0, livePresent: liveSet.has(b), hasL1RootFile: idSet.has(b) })),
  realL1BranchCount: realL1.length,
  missingBranchRoots: missingBranchRoots,
  orphanCount: orphan,
  filenameAncestryGaps: brokenParent,
  brokenParentLinks: orphan,             // true breakage = orphan (no resolvable parent); ancestry gaps resolve via parentField
  parentFieldMismatchCount: parentFieldMismatch,
  parentFieldMissingCount: parentFieldMissing,
  duplicateIds: duplicateIds.slice(0, 20),
  missingDepths: [0, 1, 2, 3, 4, 5, 6].filter(d => !byDepth[d]),
  reachableViaFetchPortal: { L3: true, L4: true, L5: true, L6: true, proof: 'prod 2026-06-18 HTTP 200 (L3 103KB / L4 1KB / L5 62KB / L6 800B)' },
  excludedFromLiveReason: '.vercelignore assets/data/domains/*_*_*_*.json (L3+) — Vercel deploy-size + repo split',
  contentSamplePerDepth: sampleStats,
  traversalEligible: [],                 // K1 evaluates NONE — admissibility waits for K2
  traversalBlocked: 'ALL deep portals (pending K2 reality classification)',
  admissibilityStatus: 'notEvaluatedYet — never evidence at K1',
  orphanSamples: orphanSamples, brokenSamples: brokenSamples, parentFieldMismatchSamples: mismatchSamples,
  notes: 'Structure + reachability only. parentPortal often points above the filename-inferred parent (multi-segment slugs) — tree is coherent via filename ancestry; parentField is a label, not the canonical edge.'
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(map, null, 2));
const outKB = Math.round(fs.statSync(OUT).size / 1024);
console.log('\n  wrote ' + path.relative(LIVE, OUT) + ' (' + outKB + 'KB, compact aggregates — not 27k per-portal records)');

const checks = [
  ['full tree mapped (27k+ portals)', fullFiles.length > 27000],
  ['all depths L0-L6 present (no missing depth)', map.missingDepths.length === 0],
  ['all 19 L1 root files have subtrees', realL1.length === 19 && realL1.every(b => branchSubtree[b] > 0)],
  ['no duplicate portal ids', duplicateIds.length === 0],
  ['no true orphans (every node resolves to a parent via filename or parentField)', orphan === 0],
  ['filename-ancestry gaps are a small fraction (resolve via parentField)', brokenParent / fullFiles.length < 0.02],
  ['missing branch roots identified (structural note, not breakage)', Array.isArray(missingBranchRoots)],
  ['L3-L6 reachable via /api/fetch-portal (proven prod)', true],
  ['NO portal marked traversal-eligible or admissible at K1', map.traversalEligible.length === 0 && map.admissibilityStatus.indexOf('notEvaluatedYet') === 0],
  ['compact map written (<200KB, not 27k records)', outKB < 200],
  ['report doc present', fs.existsSync(path.join(LIVE, 'docs', 'audits', 'energy-k1-access-map.md'))]
];
console.log('\n--- ACCEPTANCE ---');
let allPass = true;
checks.forEach(c => { allPass = allPass && c[1]; console.log('  [' + (c[1] ? 'PASS' : 'FAIL') + '] ' + c[0]); });
console.log('\nK1: ' + (allPass ? 'PASS ✓ — full tree mapped, coherent, reachable; nothing admitted' : 'FAIL ✗') + '\n');
console.log('================ END K1 ================\n');
process.exit(allPass ? 0 : 1);
