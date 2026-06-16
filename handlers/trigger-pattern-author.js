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
const { proposePattern } = require('../lib/pattern-author.js');
const orchestrator = require('../lib/ai-orchestrator.js');

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

// Rotating scan cursor — persisted so each cron tick resumes where the last
// run stopped, instead of always restarting at the alphabetical front of the
// portal list (which left the back of the corpus never scanned).
const CURSOR_KEY = 'limen:pattern-author-cursor';
async function _loadCursor() {
  if (_redisEnabled()) {
    try { const v = await _redisCmd(['GET', CURSOR_KEY]); const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; } catch (e) {}
  }
  return 0;
}
async function _saveCursor(n) {
  if (_redisEnabled()) {
    try { await _redisCmd(['SET', CURSOR_KEY, String(n)]); } catch (e) {}
  }
}

function _loadPortalsList() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')); } catch (e) {}
  return files;
}

function _readPortal(f) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return null; }
}

// Portals whose ingestion the pipeline already flagged as unreliable. Authoring
// from these (e.g. AGIG/abundia, classified only by a stale legacy SIC) produces
// cards built on bad data that never fit and never match. PRIVATE/FOREIGN_FILER
// are intentionally KEPT — K3 authoring is meant to reach off-EDGAR/private entities.
const SUSPECT_STATUSES = new Set(['INGESTION_SUSPECT', 'STALE', 'INSUFFICIENT_HISTORY', 'TERMINAL_DIVERGENCE']);

// Count DISTINCT non-rejected proposals per source portal across the full list.
// Replaces the old _alreadyProposedSlugs(), which called an UNDEFINED _redisCall
// (ReferenceError -> swallowed -> empty set every run), so the dedup NEVER worked
// on Vercel — the actual engine of the target over-density (7+ near-duplicate
// cards on one portal). The list LPUSHes a fresh copy on every status update, so
// raw entries double-count; dedup by pattern id, latest-wins (LPUSH = newest first).
async function _proposalCountsByPortal() {
  let raw = [];
  if (_redisEnabled()) {
    try { raw = (await _redisCmd(['LRANGE', 'limen:pattern-proposals', '0', '500'])) || []; } catch (e) {}
  }
  if (raw.length === 0) {
    try { const st = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8')); raw = (st.proposals || []).map(p => JSON.stringify(p)); } catch (e) {}
  }
  const seenIds = new Set(), counts = new Map();
  for (const s of raw) {
    let p; try { p = (typeof s === 'string') ? JSON.parse(s) : s; } catch (e) { continue; }
    const id = p && p.pattern && p.pattern.id;
    if (!id || seenIds.has(id)) continue;        // collapse status-update copies
    seenIds.add(id);
    if (p.status === 'REJECTED') continue;        // a rejected card frees the slot
    if (p.sourcePortal) counts.set(p.sourcePortal, (counts.get(p.sourcePortal) || 0) + 1);
  }
  return counts;
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
    // Per-target card cap — refuse an Nth card on a portal already covered, so
    // one target can't accumulate 6-7 near-duplicate cards (the over-density the
    // analyst flagged). Tunable; default 2 live (non-rejected) cards per portal.
    const maxPerTarget = Math.max(1, parseInt(body.maxPerTarget || 2, 10));

    // Build candidate list — K3 frontier = portals without a bridge match.
    // Kernel-signal requirement DROPPED: the whole point of K3 is to author
    // patterns for entities K1/K2 can't reach (private, pre-revenue, off-EDGAR).
    // Functional-network richness is the real eligibility signal.
    const proposalCounts = await _proposalCountsByPortal();
    const allFiles = _loadPortalsList();
    const total = allFiles.length;
    // Start this scan where the last one stopped (rotating cursor), so the cron
    // sweeps the whole corpus over successive ticks rather than re-scanning the
    // same alphabetical front every run. Force-slug runs ignore the cursor.
    const scanStart = (!forceSlug && total) ? (((await _loadCursor()) % total) + total) % total : 0;
    const files = scanStart ? allFiles.slice(scanStart).concat(allFiles.slice(0, scanStart)) : allFiles;
    const candidates = [];
    let examined = 0;
    let skippedAlreadyProposed = 0, skippedHasBridge = 0, skippedThinFn = 0, skippedUnreadable = 0, skippedSuspectData = 0;
    for (const f of files) {
      examined++;
      const slug = f.replace(/\.json$/, '');
      if (forceSlug && slug !== forceSlug) continue;
      // Per-target cap — skip portals already at the live-card limit.
      if (!forceSlug && (proposalCounts.get(slug) || 0) >= maxPerTarget) { skippedAlreadyProposed++; continue; }
      const p = _readPortal(f);
      if (!p) { skippedUnreadable++; continue; }
      // Data-quality gate — skip portals the ingestion pipeline flagged unreliable.
      if (!forceSlug && SUSPECT_STATUSES.has(p.kernelStatus)) { skippedSuspectData++; continue; }
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

    // Advance the rotating cursor past everything examined this run, so the
    // next tick resumes further along the corpus (full sweep over time).
    if (!forceSlug && total) {
      try { await _saveCursor((scanStart + examined) % total); } catch (e) {}
    }

    if (candidates.length === 0) return res.status(200).json({
      ok: true,
      message: 'no candidates after filters',
      proposed: [],
      failed: [],
      candidatesConsidered: 0,
      portalsScanned: files.length,
      scanStartIndex: scanStart,
      portalsExamined: examined,
      filterCounts: { skippedAlreadyProposed, skippedHasBridge, skippedThinFn, skippedUnreadable, skippedSuspectData },
      hint: skippedHasBridge >= files.length * 0.95
        ? 'ALL portals already have bridge matches — pass {"slug":"<portal>"} to force-author for a specific portal'
        : skippedAlreadyProposed > 0 && skippedAlreadyProposed >= (files.length - skippedHasBridge) * 0.9
          ? 'all eligible bridge-blind portals have pending proposals already — approve or reject them in the queue before authoring more'
          : 'try {"slug":"<specific_portal>"} to bypass filters and test on one portal',
      storage: _redisEnabled() ? 'upstash-redis' : 'file'
    });

    // Author up to `max` proposals. The salience pre-filter (in proposePattern)
    // routes each result: those that fire on their source portal land in the
    // active review queue (PENDING_REVIEW); those that don't are held (kept,
    // re-checked each rebuild tick). Reported separately so a run is honest
    // about how many actually reached the operator's queue.
    const proposed = [];   // reached PENDING_REVIEW — operator sees these
    const held = [];       // HELD_UNMATCHED — kept, didn't fire on source yet
    const failed = [];
    for (let i = 0; i < Math.min(max, candidates.length); i++) {
      const c = candidates[i];
      try {
        const r = await proposePattern(c, { targetDomain, reason: 'on-demand operator trigger' });
        if (r.ok && !r.refused && r.status === 'PENDING_REVIEW') proposed.push({ slug: c.slug, patternId: r.proposal.id, sourceConfidence: r.sourceConfidence, tokensUsed: r.tokensUsed });
        else if (r.ok && !r.refused && r.status === 'HELD_UNMATCHED') held.push({ slug: c.slug, patternId: r.proposal.id, reason: 'indicators did not fire on source portal (held for offline repair worker)', tokensUsed: r.tokensUsed });
        else if (r.ok && (r.refused || r.duplicate)) failed.push({ slug: c.slug, reason: r.reason || 'refused/duplicate' });
        else failed.push({ slug: c.slug, reason: r.error || r.reason || 'unknown' });
      } catch (e) {
        failed.push({ slug: c.slug, reason: String(e.message || e) });
      }
    }

    const finalStatus = orchestrator.status();
    return res.status(200).json({
      ok: true,
      proposed,
      held,
      failed,
      candidatesConsidered: candidates.length,
      portalsScanned: files.length,
      scanStartIndex: scanStart,
      portalsExamined: examined,
      nextCursor: total ? (scanStart + examined) % total : 0,
      corpusSize: total,
      budget: finalStatus.budget,
      storage: _redisEnabled() ? 'upstash-redis' : 'file (assets/data/_pattern-proposals.json)'
    });
  } catch (err) {
    console.error('[trigger-pattern-author]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
