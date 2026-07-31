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
import { inputs } from './_inputs.mjs';
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
  /**
   * Separate NON-global copy for the per-line scan below. `.test()` on a /g regex is stateful:
   * it advances lastIndex and returns false on the next call even when the string matches, so
   * the old loop silently skipped every other hit while the /g copy was still needed for the
   * whole-file `.match()` count. Two regexes, one job each.
   */
  const LINK_LINE_RE = /company-portal\.html\?company=/;
  const HP_GATE_RE = /\b(?:d\.hp|row\.hp|\.hp\b|hasPortal)/;
  /**
   * Lines that only TALK about the link are not surfaces that BUILD it. Both entries this organ
   * reported as HIGH on the 2026-07-30 pulse were of this kind: score-companies.js:66 is a
   * comment explaining slug resolution, and the other hit was THIS FILE matching its own
   * LINK_RE literal and header comment. A detector that counts itself as a defect manufactures
   * work, and the finding sat at HIGH.
   */
  const COMMENT_LINE_RE = /^\s*(?:\/\/|\/\*|\*|#)/;
  const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/');
  const unguardedSurfaces = [];
  const guardedSurfaces = [];
  let totalEmitters = 0;
  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (rel === SELF) continue;                       // never report the scanner as a surface
    let src; try { src = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const emitters = (src.match(LINK_RE) || []).length;
    if (emitters === 0) continue;
    totalEmitters += emitters;
    // Look at each line that builds the link — is there an hp check on the
    // same line or within ~5 lines above?
    const lines = src.split('\n');
    let hasAnyGate = false, gatedCount = 0, unguardedCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (COMMENT_LINE_RE.test(lines[i])) continue;   // prose about the link, not a link
      if (LINK_LINE_RE.test(lines[i])) {
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
        // Only rows EXPECTED to have a portal (hp=true) can be a "dead click". hp=false rows are
        // CORRECTLY portal-less (private/non-EDGAR/not-built-by-design) and surfaces gate on hp,
        // so they never emit a link — counting them as dead clicks was a false over-count.
        if (row.hp !== true) continue;
        if (!fs.existsSync(path.join(DIR, row.s + '.json'))) {
          cbDeadCount++;
          if (cbDeadSample.length < 10) cbDeadSample.push({ slug: row.s, name: row.n, hp: row.hp === true, source: path.basename(cbp) });
        }
      }
    } catch (e) {}
  }

  // Is the canonical mitigation in place? company-portal-ui.js degrades gracefully
  // (cp-empty) when a portal is absent, so an unguarded link lands on a helpful page,
  // NOT a 404. When that fallback exists, an ungated surface is a hygiene RISK (ideally
  // the link wouldn't render at all), not a user-facing break — so it should not zero
  // the score. We still surface the count so the surfaces stay visible for a future
  // proper-gating pass; the realized dead-click count (cbDeadCount) carries the real harm.
  /**
   * THIS EXACT LINE manufactured a HIGH finding for weeks. fallbackPresent defaulted to false
   * on a read failure and fed the severity ternary below.
   * assets/js/company-portal-ui.js was not in the CI sparse checkout, so the read threw, the
   * flag went false, and the item was escalated to HIGH on every pulse. The file existed the
   * whole time and the fallback was present. Fixed in the cone AND here, because the cone can
   * change again and this line must not be able to invent a severity from an ENOENT.
   */
  const io = inputs();
  const cpuSrc = io.text(path.join(ROOT, 'assets', 'js', 'company-portal-ui.js'), 'assets/js/company-portal-ui.js');
  const fallbackKnown = cpuSrc !== null;
  const fallbackPresent = fallbackKnown ? /cp-empty/.test(cpuSrc) : null;

  const attention = [];
  if (unguardedSurfaces.length > 0) attention.push({ issue: 'Surfaces build company-portal links without an hp gate', severity: fallbackPresent === false ? 'high' : 'low', count: unguardedSurfaces.length, action: (fallbackPresent === true ? 'MITIGATED by company-portal-ui.js graceful fallback (lands on absent-portal page, not a 404). For best UX, thread `hp` to these emit points and gate the link. ' : fallbackPresent === false ? 'add `if (d.hp)` guard before rendering link. ' : 'SEVERITY UNKNOWN — company-portal-ui.js could not be read, so whether the graceful fallback exists is unmeasured. Held at LOW rather than guessing HIGH. ') + 'Worst: ' + unguardedSurfaces.slice(0, 5).map(s => s.file).join(', '), organ: id });
  const ioItem = io.attention(id); if (ioItem) attention.push(ioItem);
  if (cbDeadCount > 0) attention.push({ issue: 'CB rows pointing to a portal slug with NO file on disk (dead clicks waiting)', severity: 'med', count: cbDeadCount, action: 'either build the missing portals (paused queue) or accept the absence — company-portal-ui.js now handles gracefully', organ: id });

  const surfaceScore = unguardedSurfaces.length === 0
    ? 100
    : fallbackPresent
      ? Math.max(70, 100 - unguardedSurfaces.length)          // mitigated: 1pt/surface, floor 70
      : Math.max(0, 100 - unguardedSurfaces.length * 5);      // unmitigated: hard penalty
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
