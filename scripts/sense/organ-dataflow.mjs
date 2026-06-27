// scripts/sense/organ-dataflow.mjs — end-to-end DATA-FLOW sensor.
//
// Every other organ reads LOCAL FILES — it checks that structure EXISTS
// (a handler is present, a field is referenced, a page returns 200). None of
// them check that real DATA actually reaches the screen. That blind spot is
// why the system reported HEALTHY for months while consoles showed 0 companies,
// the scorer produced 0 scores, and snapshots expired between cron runs —
// "empty" is indistinguishable from "full" at the structure level.
//
// This organ is the exception: it FETCHES the live endpoints the consoles
// actually read and asserts the payload is non-empty + fresh. When a pipe
// silently drains, this goes red on its own instead of waiting for a human to
// trip over it.

export const id = 'dataflow';
export const role = 'end-to-end data flow (does real data reach the screen?)';
export const order = 35;   // afferent, just after feeds/domains/nodes

const BASE = 'https://limenhelix.com';
const CRON_INTERVAL_SEC = 900;   // limen-worker-snapshot runs every 15 min

async function _getJSON(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms || 15000) });
  const t = await r.text();
  try { return JSON.parse(t); }
  catch (e) { throw new Error('non-JSON response (' + r.status + '): ' + t.slice(0, 60)); }
}

export async function sense() {
  const attention = [];
  const metrics = {};
  const probes = [];   // { name, score 0-100 }

  // ── Probe the console snapshot (what the domain brains actually read) ──
  let snap = null;
  try {
    snap = await _getJSON(BASE + '/api/limen-snapshot?type=console');
  } catch (e) {
    // Total failure to read the consoles' source — everything downstream is dark.
    return {
      score: 0, status: 'IN_PAIN',
      summary: 'cannot read console snapshot: ' + e.message,
      metrics: { error: e.message },
      attention: [{ issue: 'Data-flow: console snapshot unreadable (' + e.message + ')', severity: 'high', count: 1, action: 'check /api/limen-snapshot?type=console + limen-worker-snapshot cron', organ: id }]
    };
  }

  const cj = (snap && snap.domainCompanyJoin) || {};
  const keys = Object.keys(cj);
  let totalCompanies = 0, liveScored = 0, domainsWithCompanies = 0;
  for (const k of keys) {
    const n = ((cj[k] && cj[k].companies) || []).length;
    totalCompanies += n;
    liveScored += (cj[k] && cj[k].scored_count) || 0;
    if (n > 0) domainsWithCompanies++;
  }
  const ageSec = snap && snap.generatedAt ? Math.round((Date.now() - snap.generatedAt) / 1000) : null;
  metrics.totalCompanies = totalCompanies;
  metrics.domainsWithCompanies = domainsWithCompanies;
  metrics.liveScored = liveScored;
  metrics.snapshotAgeSec = ageSec;

  // PROBE A — companies reach the consoles (graded by domain coverage).
  const coScore = domainsWithCompanies >= 18 ? 100 : Math.round(domainsWithCompanies / 20 * 100);
  probes.push({ name: 'console-companies', score: coScore });
  if (domainsWithCompanies < 18) {
    attention.push({ issue: 'Console company starvation: ' + totalCompanies + ' companies across ' + domainsWithCompanies + '/20 domains (expected ~506 / 20)', severity: 'high', count: 20 - domainsWithCompanies, action: 'check companyScorer.buildDomainJoin() + command-board-data.json load', organ: id });
  }

  // PROBE B — the scorer is alive (live phase scores, not just static baseline).
  const scScore = liveScored > 0 ? 100 : 0;
  probes.push({ name: 'live-scoring', score: scScore });
  if (liveScored === 0) {
    attention.push({ issue: 'Company scorer produced 0 live scores — phases are frozen at the static baseline', severity: 'high', count: totalCompanies, action: 'check /api/limen/score reachability + SCORE_API_BASE must be the PUBLIC domain (not VERCEL_URL, which is auth-protected)', organ: id });
  }

  // PROBE C — the snapshot is fresh (TTL must outlive the cron interval).
  let frScore;
  if (ageSec === null) { frScore = 0; }
  else if (ageSec <= CRON_INTERVAL_SEC + 300) { frScore = 100; }     // within a cron + buffer
  else if (ageSec <= CRON_INTERVAL_SEC * 2) { frScore = 60; }
  else { frScore = 0; }
  probes.push({ name: 'snapshot-fresh', score: frScore });
  if (frScore < 100) {
    attention.push({ issue: 'Console snapshot stale: ' + (ageSec === null ? 'no generatedAt' : Math.round(ageSec / 60) + ' min old') + ' (cron is 15 min — TTL must exceed it)', severity: frScore === 0 ? 'high' : 'medium', count: 1, action: 'check limen-worker-snapshot cron health + console_snapshot TTL (>=1200s)', organ: id });
  }

  const score = Math.round(probes.reduce((a, p) => a + p.score, 0) / probes.length);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';
  metrics.probes = Object.fromEntries(probes.map(p => [p.name, p.score]));

  return {
    score, status,
    summary: probes.filter(p => p.score === 100).length + '/' + probes.length + ' data-flow probes green · ' + totalCompanies + ' companies · ' + liveScored + ' live-scored · ' + (ageSec === null ? '?' : Math.round(ageSec / 60) + 'm') + ' old',
    metrics, attention
  };
}
