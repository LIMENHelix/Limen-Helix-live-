// scripts/sense/organ-propagator.mjs — spider-web stress propagator.
//
// Propagator computes per-portal intrinsic + induced stress via BFS over
// functionalNetwork edges. Snapshot persisted to stress-network-state.json
// and refreshed by limen-worker-stress-refresh (every 30min Vercel cron).
//
// Static checks:
//   - propagator file exists
//   - snapshot exists, freshness < 6h
//   - node + edge counts in expected range
//   - inhibitory-damped portal count (real signal of regulatory edges firing)
//   - path-C anomaly count (unbounded composites)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PROPAGATOR = path.join(ROOT, 'lib', 'limen-stress-propagator.js');
const SNAPSHOT = path.join(ROOT, 'assets', 'data', 'stress-network-state.json');

export const id = 'propagator';
export const role = 'spider-web stress propagator';
export const order = 90;

const STALE_HOURS = 6;

export function sense() {
  const present = { propagator: fs.existsSync(PROPAGATOR), snapshot: fs.existsSync(SNAPSHOT) };
  if (!present.propagator) {
    return { score: 0, status: 'IN_PAIN', summary: 'propagator file missing', metrics: { present }, attention: [{ issue: 'limen-stress-propagator.js missing', severity: 'high', count: 1, action: 'restore from git history', organ: id }] };
  }
  let snap = {}, ageHours = null, nodeCount = 0, edgeCount = 0, dampedCount = 0, pathCCount = 0, alertCount = 0, networkPushedCount = 0;
  if (present.snapshot) {
    try {
      const stat = fs.statSync(SNAPSHOT);
      ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
      snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
      // Real shape: { schemaVersion, generatedAt, stats: { totalNodes, totalEdges, ... }, propagated: [...] }
      const propagated = Array.isArray(snap.propagated) ? snap.propagated : (snap.nodes || []);
      const nodeList = Array.isArray(propagated) ? propagated : Object.values(propagated);
      nodeCount = (snap.stats && snap.stats.totalNodes) || nodeList.length;
      edgeCount = (snap.stats && snap.stats.totalEdges) || 0;
      for (const n of nodeList) {
        if (!n || typeof n !== 'object') continue;
        if (n.inhibitoryEdgesFunctional > 0) dampedCount++;
        if (n.pathCAnomaly) pathCCount++;
        if (n.alert) alertCount++;
        if (n.networkPushed) networkPushedCount++;
      }
      if (!edgeCount) for (const n of nodeList) edgeCount += ((n && n.inducedSources && n.inducedSources.length) || 0);
    } catch (e) { /* parse error */ }
  }

  const attention = [];
  if (!present.snapshot) attention.push({ issue: 'stress-network-state.json missing — propagator has never run or output lost', severity: 'high', count: 1, action: 'invoke api/limen-worker-stress-refresh', organ: id });
  else if (ageHours !== null && ageHours > STALE_HOURS) attention.push({ issue: 'stress-network snapshot stale (>6h)', severity: 'med', count: Math.round(ageHours), action: 'invoke api/limen-worker-stress-refresh OR investigate the cron', organ: id });
  if (nodeCount > 0 && nodeCount < 300) attention.push({ issue: 'Propagator node count low (<300)', severity: 'med', count: nodeCount, action: 'investigate — corpus has 767 portals; many should be in the stress graph', organ: id });
  if (pathCCount > 0) attention.push({ issue: 'path-C anomalies in propagator output (unbounded composites)', severity: 'med', count: pathCCount, action: 'inspect — kernel path C indicates outlier financial state, may be data error', organ: id });
  // No downstream consumers per memory — the propagator output has no readers
  attention.push({ issue: 'Propagator output has NO downstream consumers (per [[limen_full_system_audit_2026_05_25]])', severity: 'med', count: 1, action: 'wire stress-network-state into civilization-super-brain.js / Master Brain', organ: id });

  // scoring
  const presenceScore = (present.propagator ? 50 : 0) + (present.snapshot ? 50 : 0);
  const freshScore = ageHours === null ? 50 : Math.max(0, 100 - Math.round(ageHours * 5));
  const sizeScore = nodeCount === 0 ? 0 : Math.min(100, Math.round(nodeCount / 5));
  const score = Math.round((presenceScore + freshScore + sizeScore) / 3);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${nodeCount} nodes · ${edgeCount} edges · ${dampedCount} damped · ${pathCCount} pathC · ${alertCount} alert · snapshot ${ageHours === null ? 'missing' : ageHours.toFixed(1) + 'h old'}`,
    metrics: { present, ageHours, nodeCount, edgeCount, dampedCount, pathCCount, alertCount, networkPushedCount, scoreParts: { presence: presenceScore, fresh: freshScore, size: sizeScore } },
    attention
  };
}
