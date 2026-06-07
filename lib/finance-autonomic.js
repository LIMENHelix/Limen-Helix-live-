/**
 * finance-autonomic.js — the self-running loop for the Finance Domain.
 *
 * tick() runs one cycle: AUDIT → HEAL → BUILD. It is the "run itself / audit itself /
 * heal itself / build itself" kernel for finance. It generates content and proposals
 * autonomously; it NEVER moves money (lending/fees are proposed and halt for sign-off).
 *
 * Operator-fired by design (consistent with build-drain-stays-manual): money movement
 * and live posting need a human; a cron may AUDIT + generate content drafts, but the
 * ceiling on autonomous BUILD per tick keeps the AI budget bounded.
 */
const fs = require('node:fs');
const path = require('node:path');
const ledger = require('./finance-ledger');
const ops = require('./stream-ops');
const stripe = require('./stripe-rail');
const db = require('./limen-db');

const CONTRACT = path.join(__dirname, '..', 'assets', 'data', 'capital-engine.json');
const HEALTH_KEY = 'finance:health';
const APPROVALS_KEY = 'finance:approvals';

function _contract() { try { return JSON.parse(fs.readFileSync(CONTRACT, 'utf8')); } catch (e) { return { streams: [], connectors: [] }; } }
function _now() { return new Date().toISOString(); }

async function tick(opts) {
  opts = opts || {};
  const buildCap = typeof opts.buildCap === 'number' ? opts.buildCap : 3;   // max content produced per tick (budget guard)
  const c = _contract();
  const report = { ts: _now(), audit: {}, heal: [], build: [], proposals: [], errors: [] };

  // ── AUDIT ──────────────────────────────────────────────────────
  const summary = await ledger.summary();
  const queue = await ops.queue(200);
  const queuedByStream = {};
  queue.forEach(function (a) { queuedByStream[a.streamId] = (queuedByStream[a.streamId] || 0) + 1; });

  // a stream is "operable now" if it's free (no sign-off) and either token-ready or content-only
  const operable = (c.streams || []).filter(function (s) {
    return !s.signoffRequired && ['needs-key', 'pre-revenue', 'setup', 'live'].indexOf(s.status) > -1;
  });
  report.audit = {
    health: summary.health, net: summary.net, lendableSurplus: summary.lendableSurplus,
    activeStreams: summary.activeStreams, queuedArtifacts: queue.length,
    operableStreams: operable.length, backend: summary.backend
  };

  // ── HEAL ───────────────────────────────────────────────────────
  // 1) operable streams with NO queued content → starved; flag + schedule build
  const starved = operable.filter(function (s) { return !queuedByStream[s.id]; });
  if (starved.length) report.heal.push({ issue: 'starved-streams', count: starved.length, streamIds: starved.map(function (s) { return s.id; }).slice(0, 20) });
  // 2) sign-off-required items with no open approval → open one
  const needSignoff = (c.streams || []).filter(function (s) { return s.signoffRequired; });
  if (needSignoff.length) {
    report.heal.push({ issue: 'awaiting-signoff', count: needSignoff.length });
  }
  // 3) negative net → raise burn alarm (no autonomous fix; informs operator)
  if (summary.net < 0) report.heal.push({ issue: 'negative-net', net: summary.net, action: 'reduce AI spend / pause non-earning builds' });

  // ── BUILD ──────────────────────────────────────────────────────
  // Produce content for the most starved operable streams, up to buildCap (budget-gated by orchestrator).
  const toBuild = starved.slice(0, buildCap);
  for (let i = 0; i < toBuild.length; i++) {
    try {
      const r = await ops.produce(toBuild[i], { name: 'LIMEN Helix', niche: opts.niche });
      if (r.ok) report.build.push({ streamId: toBuild[i].id, artifactId: r.artifact.id, tokenReady: r.artifact.tokenReady, provider: r.artifact.provider });
      else { report.errors.push({ streamId: toBuild[i].id, error: r.error }); if (r.error && /budget/.test(r.error)) break; }
    } catch (e) { report.errors.push({ streamId: toBuild[i].id, error: String(e.message || e) }); }
  }

  // ── PROPOSE (money movement — halts) ───────────────────────────
  if (summary.lendableSurplus > 0) {
    const routes = (c.capitalRouting && c.capitalRouting.proposedRoutes) || [];
    const target = routes[0];
    if (target) {
      const p = await stripe.proposeLending({ toDomain: target.to, amount: summary.lendableSurplus, reason: target.reason });
      report.proposals.push({ type: 'lend', toDomain: target.to, amount: summary.lendableSurplus, status: p.status });
    }
  }

  // persist health snapshot + approvals
  await db.set(HEALTH_KEY, { ts: report.ts, health: summary.health, net: summary.net, lendableSurplus: summary.lendableSurplus, activeStreams: summary.activeStreams });
  if (report.proposals.length) { for (const pr of report.proposals) await db.lpush(APPROVALS_KEY, Object.assign({ ts: report.ts }, pr)); await db.ltrim(APPROVALS_KEY, 0, 200); }

  await ledger.record({ type: 'audit', source: 'autonomic-tick', meta: { health: summary.health, built: report.build.length } });
  return report;
}

async function health() { return (await db.get(HEALTH_KEY)) || null; }
async function approvals(limit) { return await db.lrange(APPROVALS_KEY, 0, (limit || 50) - 1); }

module.exports = { tick, health, approvals };
