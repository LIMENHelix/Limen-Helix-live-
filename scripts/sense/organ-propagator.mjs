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
  // ── CONSUMER CHECK · was a hardcoded string, now a measurement ──────────────────────────
  //
  // This used to push, unconditionally on every run:
  //   "Propagator output has NO downstream consumers (per [[limen_full_system_audit_2026_05_25]])"
  //   action: "wire stress-network-state into civilization-super-brain.js / Master Brain"
  //
  // That was never a sensor reading. It was a TODO from a May audit, re-emitted daily for two
  // months after the work it asked for had been done somewhere else, and its suggested remedy
  // would produce a DUPLICATE: lib/limen-policy.js recommendLane() already takes the propagator's
  // per-CIK map and applies it to lane salience (SEVERE +0.25, MODERATE +0.12, hubs explicitly
  // excluded because connectivity is not distress), and handlers/limen-worker-autoqueue.js feeds
  // it with a one-hour freshness guard. A false finding at MED severity is worse than no finding,
  // because it directs real work at a phantom.
  //
  // Replaced with an actual check of the two things that decide whether the output reaches anyone:
  //   ACTION consumers — handlers that read stress_slim / stress_meta, minus the writer and the
  //                      server, and whether each is actually SCHEDULED in vercel.json or sitting
  //                      in the paused-cron record.
  //   DISPLAY consumers — pages/scripts that fetch the endpoints (company-portal.html does).
  //
  // Inputs it needs are declared, and if they cannot be read this reports INPUT MISSING rather
  // than inferring a system property from an ENOENT. That inference is the exact bug that hid the
  // connectome outage and manufactured a HIGH finding in organ-dead-links.


  const consumers = { action: [], display: [], scheduled: [], paused: [], inputsMissing: [] };
  try {
    const hdir = path.join(ROOT, 'handlers');
    for (const f of fs.readdirSync(hdir)) {
      if (!f.endsWith('.js')) continue;
      const nm = f.replace(/\.js$/, '');
      if (nm === 'limen-worker-stress-refresh' || nm === 'limen-stress-slim' || nm === 'limen-stress-propagation') continue; // writer + servers
      let src = ''; try { src = fs.readFileSync(path.join(hdir, f), 'utf8'); } catch (e) { continue; }
      if (/stress_slim|stress_meta|stress-network-state/.test(src)) consumers.action.push(nm);
    }
  } catch (e) { consumers.inputsMissing.push('handlers/'); }

  let cronPaths = null;
  try { cronPaths = (JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).crons || []).map(c => String(c.path).split('?')[0]); }
  catch (e) { consumers.inputsMissing.push('vercel.json'); }

  let pausedPaths = null;
  try {
    const opsDir = path.join(ROOT, 'ops');
    const pf = fs.readdirSync(opsDir).find(f => /^crons-paused.*\.json$/.test(f));
    if (pf) pausedPaths = (JSON.parse(fs.readFileSync(path.join(opsDir, pf), 'utf8')).pausedCrons || []).map(c => String(c.path).split('?')[0]);
  } catch (e) { consumers.inputsMissing.push('ops/crons-paused*.json'); }

  if (cronPaths) for (const nm of consumers.action) if (cronPaths.includes('/api/' + nm)) consumers.scheduled.push(nm);
  if (pausedPaths) for (const nm of consumers.action) if (pausedPaths.includes('/api/' + nm)) consumers.paused.push(nm);

  try {
    for (const f of fs.readdirSync(ROOT)) {
      if (!f.endsWith('.html')) continue;
      let src = ''; try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
      if (/limen-stress-slim|limen-stress-propagation/.test(src)) consumers.display.push(f);
    }
  } catch (e) { consumers.inputsMissing.push('*.html'); }

  if (consumers.inputsMissing.length) {
    attention.push({ issue: 'Propagator consumer check could not run — inputs not readable', severity: 'low', count: consumers.inputsMissing.length,
      action: 'INPUT MISSING, not a system finding: ' + consumers.inputsMissing.join(', ') + '. Usually the sparse checkout in .github/workflows/immune-system.yml.', organ: id });
  } else if (consumers.action.length === 0 && consumers.display.length === 0) {
    attention.push({ issue: 'Propagator output has no readers at all', severity: 'med', count: 1,
      action: 'nothing reads stress_slim / stress_meta / stress-network-state — the hourly computation is discarded', organ: id });
  } else if (consumers.scheduled.length === 0 && consumers.paused.length > 0) {
    attention.push({ issue: 'Propagator drives no decisions — its consumer is PAUSED', severity: 'low', count: consumers.paused.length,
      action: 'WIRED, NOT MISSING: lib/limen-policy.js recommendLane() applies it to lane salience. ' + consumers.paused.join(', ') + ' is paused in ops/crons-paused-*.json pending Gate A. Do not build a second path; the lever is Gate A. Display consumers still live: ' + (consumers.display.join(', ') || 'none') + '.', organ: id });
  }

  // scoring
  const presenceScore = (present.propagator ? 50 : 0) + (present.snapshot ? 50 : 0);
  const freshScore = ageHours === null ? 50 : Math.max(0, 100 - Math.round(ageHours * 5));
  const sizeScore = nodeCount === 0 ? 0 : Math.min(100, Math.round(nodeCount / 5));

  /**
   * REGULATION — measured since the inhibitory primitive landed, and until 2026-07-31 excluded
   * from the score.
   *
   * The organ computed dampedCount, printed "0 damped" into its own summary string, and scored
   * 100/HEALTHY on presence + freshness + size. So for as long as the connectome was missing from
   * the CI checkout, the immune system had a sensor pointed exactly at the outage, read zero from
   * it every day, and reported perfect health. A vital sign that cannot move the diagnosis is not
   * a vital sign.
   *
   * What this term asks is "is inhibition FIRING", not "is there enough of it". The propagator is
   * additive by construction; damping is the only thing that lets stress regulate rather than only
   * accumulate. So zero damped nodes with edges loaded is the failure state and scores 0.
   *
   * REG_TARGET_SHARE is a STATED PRIOR [mark: prior], not a fitted value. There is no measured
   * basis for "the right share of portals to be damped" — damping requires both endpoints of an
   * inhibitory edge to be anchored in a portal's brainNodeMapping overrides, which is a coverage
   * property of the corpus, not a health target. 10% is set low deliberately: the question is
   * whether regulation operates at all, so the term saturates quickly and does not punish a
   * corpus for having fewer anchored portals. Live at time of writing: 354/795 = 44.5%.
   *
   * NULL, NOT ZERO, when it cannot be measured — the item #1 discipline. If the connectome failed
   * to load, that is an input gap already reported by inhibitoryLoadError, and scoring it as 0
   * would recreate the exact bug this term exists to catch, one level up.
   */
  const REG_TARGET_SHARE = 0.10;   // [mark: prior] — see above
  const snapStats = (snap && snap.stats) || {};
  const edgesLoaded = typeof snapStats.inhibitoryEdgesLoaded === 'number' ? snapStats.inhibitoryEdgesLoaded : null;
  let regulationScore = null;
  if (snapStats.inhibitoryLoadError) regulationScore = null;          // could not read the connectome
  else if (edgesLoaded === null) regulationScore = null;              // snapshot predates the stat
  else if (edgesLoaded === 0) regulationScore = null;                 // no edges to fire: unmeasurable, not unhealthy
  else if (nodeCount === 0) regulationScore = null;
  else regulationScore = dampedCount === 0 ? 0 : Math.min(100, Math.round((dampedCount / nodeCount) / REG_TARGET_SHARE * 100));

  const parts = [presenceScore, freshScore, sizeScore].concat(regulationScore === null ? [] : [regulationScore]);
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);

  // The state that hid for weeks: edges load, nothing damps, propagation is purely additive.
  if (regulationScore === 0) attention.push({ issue: 'Inhibition loaded but firing on ZERO portals — propagation is purely additive', severity: 'high', count: edgesLoaded || 0,
    action: 'the connectome parsed and ' + (edgesLoaded || 0) + ' inhibitory edges loaded, but no portal has both endpoints anchored in its brainNodeMapping overrides, so stress can only accumulate and never regulate. Inspect computeInhibitoryDamping() in lib/limen-stress-propagator.js and the node bindings on the portals.', organ: id });
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${nodeCount} nodes · ${edgeCount} edges · ${dampedCount} damped · ${pathCCount} pathC · ${alertCount} alert · snapshot ${ageHours === null ? 'missing' : ageHours.toFixed(1) + 'h old'}`,
    metrics: { present, ageHours, nodeCount, edgeCount, dampedCount, pathCCount, alertCount, networkPushedCount, consumers, scoreParts: { presence: presenceScore, fresh: freshScore, size: sizeScore, regulation: regulationScore } },
    attention
  };
}
