// scripts/sense/organ-connectome.mjs — cross-domain transfer cortex.
//
// Connectome super-brain transfers pattern between domains via shared L1
// nodes. Memory marks this as historically a DEAD no-op due to an
// array-vs-object shape bug. The audit (2026-05-25) reports the bug is FIXED,
// but the organ stays under watch.
//
// Static checks:
//   - file exists, expected size
//   - PROPAGATE_FRACTION constant present (was 0 in dead state, should be > 0)
//   - DECAY_PER_CYCLE constant present
//   - the array-collapse fix block (line ~88-99) is present
//   - crossDomainAffinities export present (the load-bearing function)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CONNECTOME = path.join(ROOT, 'assets', 'js', 'limen', 'connectome-super-brain.js');

export const id = 'connectome';
export const role = 'cross-domain transfer (was dead — verify FIXED)';
export const order = 60;

export function sense() {
  if (!fs.existsSync(CONNECTOME)) {
    return { score: 0, status: 'IN_PAIN', summary: 'connectome-super-brain.js missing — cross-domain transfer dead', metrics: {}, attention: [{ issue: 'connectome-super-brain.js missing', severity: 'high', count: 1, action: 'restore from git history', organ: id }] };
  }
  const src = fs.readFileSync(CONNECTOME, 'utf8');
  const checks = {
    propagateFraction: /PROPAGATE_FRACTION\s*=\s*0\.0?[1-9]/.test(src),     // > 0
    propagateFractionZero: /PROPAGATE_FRACTION\s*=\s*0[^\.0-9]/.test(src),  // explicitly 0 = dead
    decayPerCycle: /DECAY_PER_CYCLE\s*=\s*0\.[0-9]/.test(src),
    crossDomainAffinities: /crossDomainAffinities/.test(src),
    arrayCollapseFix: /Array\.isArray\([^)]*\)|\.map\(.*=>.*\{.*domain.*role/.test(src),   // the shape-collapse pattern
    // pattern bus participation — file references the broker / sealing / publishing
    patternEnvelopeEmit: /broker|publish|sealEnvelope|sealed|envelope/i.test(src),
    activationsState: /this\._activations|_activations\s*=\s*\{/.test(src)
  };
  const size = fs.statSync(CONNECTOME).size;

  const attention = [];
  if (checks.propagateFractionZero) attention.push({ issue: 'PROPAGATE_FRACTION=0 — cross-domain transfer is dead', severity: 'high', count: 1, action: 'set PROPAGATE_FRACTION to 0.05 (canonical value per audit)', organ: id });
  if (!checks.propagateFraction && !checks.propagateFractionZero) attention.push({ issue: 'PROPAGATE_FRACTION constant not found', severity: 'med', count: 1, action: 'inspect connectome-super-brain.js — expected ~line 36', organ: id });
  if (!checks.crossDomainAffinities) attention.push({ issue: 'crossDomainAffinities export missing — load-bearing function gone', severity: 'high', count: 1, action: 'restore cross-domain transfer logic', organ: id });
  if (!checks.arrayCollapseFix) attention.push({ issue: 'Array-vs-object shape fix not detected — connectome may be dead again', severity: 'high', count: 1, action: 'verify lines ~88-99 collapse v[] domain bindings into {domain: role} map', organ: id });
  if (!checks.patternEnvelopeEmit) attention.push({ issue: 'No emit() call in connectome — not publishing to pattern bus', severity: 'high', count: 1, action: 'wire connectome to LIMENPatternBroker', organ: id });

  const passed = Object.entries(checks).filter(([k, v]) => k !== 'propagateFractionZero' && v).length;
  const total = Object.keys(checks).length - 1;
  const score = checks.propagateFractionZero ? 0 : Math.round(passed / total * 100);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${passed}/${total} structural markers present · size ${(size / 1024).toFixed(1)}KB` + (checks.propagateFractionZero ? ' · DEAD (PROPAGATE_FRACTION=0)' : ''),
    metrics: { checks, size },
    attention
  };
}
