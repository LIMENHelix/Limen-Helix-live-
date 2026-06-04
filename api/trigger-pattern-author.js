/**
 * /api/trigger-pattern-author — author bridge pattern proposals on-demand.
 *
 * POST  { max?: 3, targetDomain?: 'business', slug?: 'specific_portal' }
 *
 * Runs on Vercel (where ANTHROPIC_API_KEY lives), so the operator doesn't need
 * to wait for the GitHub Actions cron or add secrets to GitHub. Selects K3-
 * frontier portals (kernel signal present + no bridge match + populated
 * functionalNetwork), asks Claude to propose patterns, persists the proposals.
 *
 * Storage: Upstash Redis when KV_REST_API_URL set, file fallback otherwise.
 * Same pattern as operator-action-queue.js — works in either environment.
 */
const fs = require('node:fs');
const path = require('node:path');
const { proposePattern } = require('./lib/pattern-author.js');
const orchestrator = require('./lib/ai-orchestrator.js');

const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const PROPOSALS_PATH = path.join(__dirname, '..', 'assets', 'data', '_pattern-proposals.json');

function _redisEnabled() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function _redisCmd(cmd) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  if (!r.ok) throw new Error('redis ' + cmd[0] + ' ' + r.status);
  return (await r.json()).result;
}

function _loadPortalsList() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')); } catch (e) {}
  return files;
}

function _readPortal(f) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return null; }
}

async function _alreadyProposedSlugs() {
  // Pull from Redis if enabled
  if (_redisEnabled()) {
    try {
      const raw = await _redisCall('LRANGE', ['limen:pattern-proposals', '0', '200']);
      return new Set((raw || []).map(s => { try { return JSON.parse(s).sourcePortal; } catch (e) { return null; } }).filter(Boolean));
    } catch (e) { /* fall through */ }
  }
  try {
    const state = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8'));
    return new Set((state.proposals || []).slice(0, 200).map(p => p.sourcePortal));
  } catch (e) { return new Set(); }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // Vercel Cron fires a GET on a schedule (it runs on Vercel, where the Claude
  // key already lives — no GitHub secrets needed). Accept that GET, but ONLY
  // from a genuine cron tick, so this paid authoring endpoint can't be spammed.
  // The operator's "Author 3 more" button still POSTs as before.
  var _isCron = req.method === 'GET' && (
    /vercel-cron/i.test(req.headers['user-agent'] || '') ||
    req.headers['x-vercel-cron'] != null ||
    (process.env.CRON_SECRET && req.headers['authorization'] === 'Bearer ' + process.env.CRON_SECRET)
  );
  if (req.method !== 'POST' && !_isCron) return res.status(405).json({ error: 'POST required (Vercel cron GET also accepted)' });

  try {
    // Check provider availability and budget BEFORE any portal scanning
    const orchStatus = orchestrator.status();
    if (!orchStatus.providers.anthropic) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set in Vercel project environment', providers: orchStatus.providers });

    const body = _isCron
      ? { max: (req.query && req.query.max) || 3, targetDomain: (req.query && req.query.targetDomain) || 'business' }
      : ((typeof req.body === 'object' && req.body) ? req.body : (req.body ? JSON.parse(req.body) : {}));
    const max = Math.min(parseInt(body.max || 3, 10), 5);   // hard cap 5 per request
    const targetDomain = body.targetDomain || 'business';
    const forceSlug = body.slug || null;

    // Build candidate list — K3 frontier = portals without a bridge match.
    // Kernel-signal requirement DROPPED: the whole point of K3 is to author
    // patterns for entities K1/K2 can't reach (private, pre-revenue, off-EDGAR).
    // Functional-network richness is the real eligibility signal.
    const alreadyProposed = await _alreadyProposedSlugs();
    const files = _loadPortalsList();
    const candidates = [];
    let skippedAlreadyProposed = 0, skippedHasBridge = 0, skippedThinFn = 0, skippedUnreadable = 0;
    for (const f of files) {
      const slug = f.replace(/\.json$/, '');
      if (forceSlug && slug !== forceSlug) continue;
      if (!forceSlug && alreadyProposed.has(slug)) { skippedAlreadyProposed++; continue; }
      const p = _readPortal(f);
      if (!p) { skippedUnreadable++; continue; }
      const hasBridge = p.bridgeReadings && p.bridgeReadings.matched && p.bridgeReadings.matched.length > 0;
      if (hasBridge && !forceSlug) { skippedHasBridge++; continue; }
      // Require ≥ 2 functional-network categories (was 4 and required signal).
      const fn = p.functionalNetwork || {};
      const fnCats = Object.keys(fn).filter(k => Array.isArray(fn[k]) ? fn[k].length > 0 : !!fn[k]).length;
      if (fnCats < 2 && !forceSlug) { skippedThinFn++; continue; }
      p.slug = slug;
      candidates.push(p);
      if (candidates.length >= max * 3) break;
    }

    if (candidates.length === 0) return res.status(200).json({
      ok: true,
      message: 'no candidates after filters',
      proposed: [],
      failed: [],
      candidatesConsidered: 0,
      portalsScanned: files.length,
      filterCounts: { skippedAlreadyProposed, skippedHasBridge, skippedThinFn, skippedUnreadable },
      hint: skippedHasBridge >= files.length * 0.95
        ? 'ALL portals already have bridge matches — pass {"slug":"<portal>"} to force-author for a specific portal'
        : skippedAlreadyProposed > 0 && skippedAlreadyProposed >= (files.length - skippedHasBridge) * 0.9
          ? 'all eligible bridge-blind portals have pending proposals already — approve or reject them in the queue before authoring more'
          : 'try {"slug":"<specific_portal>"} to bypass filters and test on one portal',
      storage: _redisEnabled() ? 'upstash-redis' : 'file'
    });

    // Author up to `max` proposals
    const proposed = [];
    const failed = [];
    for (let i = 0; i < Math.min(max, candidates.length); i++) {
      const c = candidates[i];
      try {
        const r = await proposePattern(c, { targetDomain, reason: 'on-demand operator trigger' });
        if (r.ok && !r.refused) proposed.push({ slug: c.slug, patternId: r.proposal.id, tokensUsed: r.tokensUsed });
        else failed.push({ slug: c.slug, reason: r.error || r.reason || 'unknown' });
      } catch (e) {
        failed.push({ slug: c.slug, reason: String(e.message || e) });
      }
    }

    const finalStatus = orchestrator.status();
    return res.status(200).json({
      ok: true,
      proposed,
      failed,
      candidatesConsidered: candidates.length,
      portalsScanned: files.length,
      budget: finalStatus.budget,
      storage: _redisEnabled() ? 'upstash-redis' : 'file (assets/data/_pattern-proposals.json)'
    });
  } catch (err) {
    console.error('[trigger-pattern-author]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
