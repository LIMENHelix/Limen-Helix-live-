/**
 * /api/cron-rebuild-engine-outputs — Vercel-native engine-output rebuild.
 *
 * Replaces the GitHub immune cron's build-bridge-readings + build-engine-outputs
 * steps for the LIVE pipeline. Runs ON VERCEL (where Upstash already lives), so
 * no GitHub Actions, no GitHub secrets. For every portal it re-matches the
 * current bridge-patterns library (so newly-approved patterns count), regenerates
 * the engine-output artifacts, and writes them to Redis (limen:eo:<slug>) — which
 * is exactly what api/master-inbox.js now reads. That unfreezes master-inbox
 * without committing 461 portal files.
 *
 * Triggered by a Vercel cron (GET) or operator POST. Deterministic, no AI.
 */
const fs = require('node:fs');
const path = require('node:path');
const { matchPortal, loadPatterns, scorePattern, MATCH_THRESHOLD } = require('../lib/bridge-engine.js');
const { generateForPortal } = require('../lib/engine-output-generator.js');
const redisKv = require('../lib/redis-kv.js');

const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const PROPOSALS_KEY = 'limen:pattern-proposals';

/**
 * Inject Redis-APPROVED pattern proposals into the matcher WITHOUT a file merge.
 *
 * approveProposal() can't write bridge-patterns.json on Vercel's read-only fs,
 * so newly-approved patterns sit in Redis (status APPROVED, awaitingLocalSync).
 * loadPatterns() caches one mutable lib object that matchPortal() reuses — so we
 * push the approved patterns into it once per request, deduped by id (latest-wins,
 * LPUSH puts newest at the list head). This is what makes an approval in the UI
 * flow all the way to master-inbox on the next rebuild tick, with no GitHub.
 * Returns the number of patterns newly injected this request.
 */
async function injectApprovedPatterns() {
  let injected = 0;
  const lib = loadPatterns();
  if (!lib.patterns) lib.patterns = [];
  const existing = new Set(lib.patterns.map(p => p && p.id));
  const r = await redisKv.redisCmd(['LRANGE', PROPOSALS_KEY, '0', '500']);
  if (!r || !r.ok || !Array.isArray(r.result)) return { injected, available: 0 };
  const seen = new Set();
  let approved = 0;
  for (const s of r.result) {
    let prop; try { prop = JSON.parse(s); } catch (e) { continue; }
    const pat = prop && prop.pattern;
    const id = pat && pat.id;
    if (!id || seen.has(id)) continue;        // latest-wins dedup
    seen.add(id);
    if (prop.status !== 'APPROVED') continue;
    approved++;
    if (existing.has(id)) continue;           // already in the committed file
    lib.patterns.push(pat);
    existing.add(id);
    injected++;
  }
  return { injected, approvedInRedis: approved };
}

/**
 * Graduation pass — buckets are revisable (the brain reconsolidates).
 * Re-check every HELD_UNMATCHED proposal against its source portal. Any that
 * now fire at the production threshold move back to PENDING_REVIEW so they
 * reach the operator's review queue. This is the salience gate raising its
 * estimate, NOT approval — the human still decides approve/reject. We only
 * ever PROMOTE held→pending here; we never pull anything out of the operator's
 * active queue (that lane is theirs).
 */
async function graduateHeldPatterns() {
  let graduated = 0, heldChecked = 0;
  const r = await redisKv.redisCmd(['LRANGE', PROPOSALS_KEY, '0', '500']);
  if (!r || !r.ok || !Array.isArray(r.result)) return { graduated, heldChecked };
  const seen = new Set();
  const held = [];
  for (const s of r.result) {
    let p; try { p = JSON.parse(s); } catch (e) { continue; }
    const id = p.pattern && p.pattern.id;
    if (!id || seen.has(id)) continue;        // latest-wins
    seen.add(id);
    if (p.status === 'HELD_UNMATCHED') held.push(p);
  }
  for (const p of held) {
    heldChecked++;
    const slug = p.sourcePortal;
    if (!slug) continue;
    let portal; try { portal = JSON.parse(fs.readFileSync(path.join(DIR, slug + '.json'), 'utf8')); } catch (e) { continue; }
    let m = null; try { m = scorePattern(p.pattern, portal); } catch (e) { m = null; }
    if (!m) continue;                          // still doesn't fire — stays held
    const updated = Object.assign({}, p, {
      status: 'PENDING_REVIEW',
      graduatedAt: new Date().toISOString(),
      prefilter: { firesOnSource: true, threshold: MATCH_THRESHOLD, confidence: m.confidence, matchRate: m.matchRate, matchedIndicators: m.matchedIndicators, evaluatedAt: new Date().toISOString() }
    });
    await redisKv.redisCmd(['LPUSH', PROPOSALS_KEY, JSON.stringify(updated)]);
    graduated++;
  }
  if (graduated > 0) { try { await redisKv.redisCmd(['LTRIM', PROPOSALS_KEY, '0', '499']); } catch (e) {} }
  return { graduated, heldChecked };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // Vercel Cron fires GET; gate it so the rebuild can't be triggered casually.
  // Operator POST also allowed (manual rebuild).
  var isCron = req.method === 'GET' && (
    /vercel-cron/i.test(req.headers['user-agent'] || '') ||
    req.headers['x-vercel-cron'] != null ||
    (process.env.CRON_SECRET && req.headers['authorization'] === 'Bearer ' + process.env.CRON_SECRET)
  );
  if (req.method !== 'POST' && !isCron) return res.status(405).json({ error: 'Vercel cron GET or operator POST' });
  if (!redisKv.HAS_REDIS) return res.status(503).json({ error: 'UPSTASH_REDIS_REST_URL/_TOKEN not set in this Vercel project' });

  const startedAt = Date.now();
  try {
    let files;
    try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')); }
    catch (e) { return res.status(500).json({ error: 'cannot read portals dir: ' + e.message }); }

    // Graduate held patterns that now fire back into the review queue, then
    // pull approved-but-unmerged patterns from Redis into the matcher.
    let grad = { graduated: 0, heldChecked: 0 };
    try { grad = await graduateHeldPatterns(); } catch (e) { /* non-fatal */ }
    let inject = { injected: 0, approvedInRedis: 0 };
    try { inject = await injectApprovedPatterns(); } catch (e) { /* committed patterns only */ }

    let processed = 0, withMatches = 0, withOutputs = 0, totalArtifacts = 0, redisWrote = 0;
    const eo = [];
    for (const f of files) {
      let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
      processed++;
      const slug = p.slug || f.replace(/\.json$/, '');
      let readings; try { readings = matchPortal(p); } catch (e) { continue; }
      if (!readings || !readings.matched || !readings.matched.length) continue;
      withMatches++;
      p.bridgeReadings = readings;
      let outputs; try { outputs = generateForPortal(p); } catch (e) { continue; }
      if (!outputs || !outputs.totalArtifacts) continue;
      withOutputs++; totalArtifacts += outputs.totalArtifacts;
      eo.push({ slug: slug, outputs: outputs });
    }

    // Batched Redis writes (fresh engine-outputs master-inbox reads).
    for (let i = 0; i < eo.length; i += 25) {
      const batch = eo.slice(i, i + 25);
      const results = await Promise.all(batch.map(x => redisKv.redisSet('limen:eo:' + x.slug, x.outputs)));
      redisWrote += results.filter(r => r && r.ok).length;
    }

    return res.status(200).json({
      ok: true, processed, withMatches, withOutputs, totalArtifacts, redisWrote,
      patternsInjected: inject.injected, approvedInRedis: inject.approvedInRedis,
      heldGraduated: grad.graduated, heldChecked: grad.heldChecked,
      ms: Date.now() - startedAt
    });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e), ms: Date.now() - startedAt });
  }
};
