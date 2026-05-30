/**
 * /api/master-inbox — compute the phase-gated lane firing queue live.
 *
 * The static _master-inbox.json file is gitignored (runtime artifact), so
 * master-inbox.html no longer ships it in the Vercel deploy. This endpoint
 * computes the inbox on demand from the corpus + bridge-patterns.json +
 * approved patterns in Redis.
 *
 * GET → { schemaVersion, stats, queues, topPriority, generatedAt }
 *
 * Caching: edge-cached for 60s so rapid reloads don't recompute. Forces
 * recompute when ?fresh=1 is passed.
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildInbox } = require('./lib/master-brain-consumer.js');

const PORTALS_DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');

function _iterPortals() {
  const list = [];
  try {
    const files = fs.readdirSync(PORTALS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    for (const f of files) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(PORTALS_DIR, f), 'utf8'));
        if (!p.slug) p.slug = f.replace(/\.json$/, '');
        list.push(p);
      } catch (e) { /* skip unparseable */ }
    }
  } catch (e) {}
  return list;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  try {
    const portals = _iterPortals();
    const inbox = buildInbox(portals);
    return res.status(200).json(inbox);
  } catch (err) {
    console.error('[master-inbox]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
