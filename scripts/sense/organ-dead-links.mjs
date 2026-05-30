// scripts/sense/organ-dead-links.mjs — dead-link risk across surfaces.
//
// The portal organ only audits files on disk. But the body has many surfaces
// (domain command pages, opportunities pages, clarity-operator JS, etc.) that
// build links to /company-portal.html?company=<slug> WITHOUT checking whether
// the target portal exists. When the immune system deletes a placeholder
// portal (strip-placeholder-portals.mjs), those surfaces keep pointing at
// the dead slug — the operator clicks, hits "Company not found".
//
// Two distinct signals here:
//   (1) RISK = how many surfaces build company-portal links without an `hp`
//       gate. Each unguarded surface is a potential dead-link emitter.
//   (2) ACTUAL = how many CB rows are referenced by some surface but the
//       portal file doesn't exist. These ARE dead clicks waiting to happen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');

export const id = 'deadLinks';
export const role = 'surface link integrity (no dead-portal navigation)';
export const order = 45;

// Files we DON'T scan — backup dirs, the immune surface itself, registry/data
const SKIP_DIRS = new Set(['_pre-enrich', '_pre-redensify', 'node_modules', '.git', 'aggregated', 'companies']);

function* walk(dir, depth = 0) {
  if (depth > 4) return;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
      yield* walk(p, depth + 1);
    } else if (/\.(html|js|mjs)$/.test(ent.name)) {
      yield p;
    }
  }
}

export function sense() {
  // Pass 1: find every file that constructs company-portal links
  const LINK_RE = /company-portal\.html\?company=/g;
  const HP_GATE_RE = /\b(?:d\.hp|row\.hp|\.hp\b|hasPortal)/;
  const unguardedSurfaces = [];
  const guardedSurfaces = [];
  let totalEmitters = 0;
  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    let src; try { src = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const emitters = (src.match(LINK_RE) || []).length;
    if (emitters === 0) continue;
    totalEmitters += emitters;
    // Look at each line that builds the link — is there an hp check on the
    // same line or within ~5 lines above?
    const lines = src.split('\n');
    let hasAnyGate = false, gatedCount = 0, unguardedCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (LINK_RE.test(lines[i])) {
        const window = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
        if (HP_GATE_RE.test(window)) { gatedCount++; hasAnyGate = true; }
        else unguardedCount++;
      }
    }
    if (unguardedCount > 0) unguardedSurfaces.push({ file: rel, unguarded: unguardedCount, gated: gatedCount });
    else if (gatedCount > 0) guardedSurfaces.push({ file: rel, gated: gatedCount });
  }

  // Pass 2: how many CB rows currently link to a missing portal?
  // (intersection of "slug referenced by CB" and "portal file absent")
  let cbDeadCount = 0, cbDeadSample = [];
  const cbPaths = [
    path.join(ROOT, 'assets', 'data', 'command-board-data.json'),
    path.join(ROOT, 'assets', 'data', 'command-board-eligible.json')
  ];
  for (const cbp of cbPaths) {
    try {
      const cb = JSON.parse(fs.readFileSync(cbp, 'utf8'));
      for (const row of (cb.companies || [])) {
        if (!row.s) continue;
        if (!fs.existsSync(path.join(DIR, row.s + '.json'))) {
          cbDeadCount++;
          if (cbDeadSample.length < 10) cbDeadSample.push({ slug: row.s, name: row.n, hp: row.hp === true, source: path.basename(cbp) });
        }
      }
    } catch (e) {}
  }

  const attention = [];
  if (unguardedSurfaces.length > 0) attention.push({ issue: 'Surfaces build company-portal links without an hp gate', severity: 'high', count: unguardedSurfaces.length, action: 'add `if (d.hp)` guard before rendering link, OR rely on company-portal-ui.js graceful fallback (lands on absent-portal page, not a 404). Worst: ' + unguardedSurfaces.slice(0, 5).map(s => s.file).join(', '), organ: id });
  if (cbDeadCount > 0) attention.push({ issue: 'CB rows pointing to a portal slug with NO file on disk (dead clicks waiting)', severity: 'med', count: cbDeadCount, action: 'either build the missing portals (paused queue) or accept the absence — company-portal-ui.js now handles gracefully', organ: id });

  // Scoring: unguarded surfaces = main risk. cbDeadCount = realized risk.
  // Both drag the score down; the company-portal-ui.js fallback (committed
  // simultaneously) is what catches the realized risk so the user sees a
  // helpful page instead of a bare error.
  const surfaceScore = unguardedSurfaces.length === 0 ? 100 : Math.max(0, 100 - unguardedSurfaces.length * 5);
  const realizedScore = cbDeadCount === 0 ? 100 : Math.max(0, 100 - Math.round(cbDeadCount / 5));
  const score = Math.round((surfaceScore + realizedScore) / 2);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${unguardedSurfaces.length} unguarded surfaces · ${totalEmitters} total emitters · ${cbDeadCount} CB rows point at missing portals (fallback page now handles)`,
    metrics: { unguardedSurfaces: unguardedSurfaces.slice(0, 25), guardedSurfaces, totalEmitters, cbDeadCount, cbDeadSample, scoreParts: { surface: surfaceScore, realized: realizedScore } },
    attention
  };
}
