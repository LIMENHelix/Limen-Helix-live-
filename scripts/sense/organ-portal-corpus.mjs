// scripts/sense/organ-portal-corpus.mjs — semantic memory organ.
//
// Thin wrapper: delegates to the existing audit-corpus-vitals.mjs which already
// produces a complete vitals snapshot for the 767-portal corpus. The system
// aggregator imports this organ and unpacks the snapshot into the body-wide
// _vitals.json. Keeping the canonical detector logic in one place (the existing
// script) means a single source of truth.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const VITALS_PATH = path.join(ROOT, 'assets', 'data', '_vitals.json');

export const id = 'portalCorpus';
export const role = 'semantic memory (767 portals)';
export const order = 40;   // mid-cortex

export function sense() {
  // run the dedicated audit (writes _vitals.json), then read it back
  const r = spawnSync('node', ['scripts/audit-corpus-vitals.mjs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    return { score: 0, status: 'IN_PAIN', summary: 'audit-corpus-vitals failed: ' + (r.stderr || r.stdout || 'unknown'), metrics: {}, attention: [{ issue: 'Portal-corpus audit script failed', severity: 'high', count: 1, action: 'run scripts/audit-corpus-vitals.mjs and read stderr' }] };
  }
  let snap; try { snap = JSON.parse(fs.readFileSync(VITALS_PATH, 'utf8')); } catch (e) { return { score: 0, status: 'IN_PAIN', summary: '_vitals.json unreadable', metrics: {}, attention: [{ issue: '_vitals.json corrupt or missing', severity: 'high', count: 1, action: 'inspect file' }] }; }
  // surface the existing snapshot as a single organ — preserve every detail
  // metric on the snapshot so the page can drill into placeholderBleed / brain /
  // kernel / prose / wiring / dup as before.
  return {
    score: snap.overall.score,
    status: snap.overall.status,
    summary: snap.overall.summary,
    metrics: snap.metrics,
    scores: snap.scores,
    attention: (snap.operatorAttention || []).map(a => ({ ...a, organ: id }))
  };
}
