/**
 * /api/cron-repair-held — OFFLINE repair worker (afferent enrichment).
 *
 * Brains generate fast and reconsolidate offline; they don't block authoring to
 * reality-test. So the author path stays fast (author → reality-test → route),
 * and REPAIR lives here, on the consolidation cadence — the same place as the
 * graduation pass.
 *
 * Each tick: drain a budget-capped batch of HELD_UNMATCHED proposals, re-author
 * their indicators against the source portal's real signals (repairPattern), and
 * route any that now fire to PENDING_REVIEW (reaching the operator's queue). The
 * rest stay HELD with an incremented attempt counter; after MAX_REPAIR_ATTEMPTS
 * we stop retrying and leave them to corpus-drift graduation. Nothing deleted.
 *
 * This NEVER approves and NEVER touches the operator's approve/reject gate — it
 * only moves held → pending (raising the salience estimate). Gated to Vercel
 * cron GET / operator POST. Budget-capped so it can't run hot.
 */
const fs = require('node:fs');
const path = require('node:path');
const { repairPattern } = require('../lib/pattern-author.js');
const redisKv = require('../lib/redis-kv.js');

const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const PROPOSALS_KEY = 'limen:pattern-proposals';
const MAX_PER_TICK = 3;          // bound model calls + wall-clock per invocation (< 300s)
const MAX_REPAIR_ATTEMPTS = 2;   // give up after N tries; leave to corpus-drift graduation

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  var isCron = req.method === 'GET' && (
    /vercel-cron/i.test(req.headers['user-agent'] || '') ||
    req.headers['x-vercel-cron'] != null ||
    (process.env.CRON_SECRET && req.headers['authorization'] === 'Bearer ' + process.env.CRON_SECRET)
  );
  if (req.method !== 'POST' && !isCron) return res.status(405).json({ error: 'Vercel cron GET or operator POST' });
  if (!redisKv.HAS_REDIS) return res.status(503).json({ error: 'UPSTASH not configured' });

  const startedAt = Date.now();
  try {
    const r = await redisKv.redisCmd(['LRANGE', PROPOSALS_KEY, '0', '500']);
    if (!r || !r.ok || !Array.isArray(r.result)) return res.status(200).json({ ok: true, heldEligible: 0, attempted: 0, repaired: 0, note: 'no proposals in redis' });

    // latest-wins dedup, then take HELD patterns still under the attempt cap
    const seen = new Set();
    const held = [];
    for (const s of r.result) {
      let p; try { p = JSON.parse(s); } catch (e) { continue; }
      const id = p.pattern && p.pattern.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (p.status === 'HELD_UNMATCHED' && (p.repairAttempts || 0) < MAX_REPAIR_ATTEMPTS) held.push(p);
    }

    let attempted = 0, repaired = 0, stillHeld = 0;
    const results = [];
    for (const p of held) {
      if (attempted >= MAX_PER_TICK) break;
      const slug = p.sourcePortal;
      if (!slug) continue;
      let portal; try { portal = JSON.parse(fs.readFileSync(path.join(DIR, slug + '.json'), 'utf8')); } catch (e) { continue; }
      attempted++;
      let rep; try { rep = await repairPattern(p.pattern, portal); } catch (e) { rep = { ok: false, error: String(e && e.message || e) }; }
      if (rep && rep.ok && rep.fired) {
        const updated = Object.assign({}, p, {
          status: 'PENDING_REVIEW',
          pattern: rep.repaired,
          repairedAt: new Date().toISOString(),
          repairAttempts: (p.repairAttempts || 0) + 1,
          prefilter: {
            firesOnSource: true, threshold: 0.15,
            confidence: rep.match.confidence, matchRate: rep.match.matchRate, matchedIndicators: rep.match.matchedIndicators,
            repairedBy: 'repair-worker', evaluatedAt: new Date().toISOString()
          }
        });
        await redisKv.redisCmd(['LPUSH', PROPOSALS_KEY, JSON.stringify(updated)]);
        repaired++;
        results.push({ patternId: p.pattern.id, outcome: 'RESCUED', confidence: rep.match.confidence });
      } else {
        const attempts = (p.repairAttempts || 0) + 1;
        const updated = Object.assign({}, p, { repairAttempts: attempts, lastRepairAt: new Date().toISOString(), lastRepairError: (rep && rep.error) || 'did not fire' });
        await redisKv.redisCmd(['LPUSH', PROPOSALS_KEY, JSON.stringify(updated)]);
        stillHeld++;
        results.push({ patternId: p.pattern.id, outcome: 'still-held', attempts });
      }
    }
    try { await redisKv.redisCmd(['LTRIM', PROPOSALS_KEY, '0', '499']); } catch (e) {}

    return res.status(200).json({
      ok: true, heldEligible: held.length, attempted, repaired, stillHeld, maxPerTick: MAX_PER_TICK, results,
      ms: Date.now() - startedAt
    });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e), ms: Date.now() - startedAt });
  }
};
