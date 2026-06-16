/**
 * /api/operator-action — record an operator decision on an artifact.
 *
 * Operator clicks PRINT / REFRESH / DECLINE in the inbox or portal page.
 * The page POSTs { artifactRef, portalSlug, lane, patternId, action }
 * to this endpoint. The action lands in the queue and is processed by
 * the autonomic loop (process-operator-actions runs after vitals).
 *
 * GET returns the current queue summary for the UI to render status badges.
 */
const queue = require('../lib/operator-action-queue.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const all = await queue.listAll();
      const summary = {
        total: all.length,
        queued: all.filter(a => a.status === 'QUEUED').length,
        processing: all.filter(a => a.status === 'PROCESSING').length,
        completed: all.filter(a => a.status === 'COMPLETED').length,
        failed: all.filter(a => a.status === 'FAILED').length,
        recent: all.slice(0, 50)
      };
      return res.status(200).json(summary);
    }

    if (req.method === 'POST') {
      const body = (typeof req.body === 'object' && req.body) ? req.body : (req.body ? JSON.parse(req.body) : {});
      const action = String(body.action || '').toUpperCase();
      if (!['PRINT', 'REFRESH', 'DECLINE'].includes(action)) return res.status(400).json({ error: 'invalid action; expected PRINT | REFRESH | DECLINE' });
      if (!body.artifactRef) return res.status(400).json({ error: 'artifactRef required (portalSlug/lane/index)' });
      const recorded = await queue.recordAction({
        artifactRef: body.artifactRef,
        portalSlug: body.portalSlug || (body.artifactRef.split('/')[0]),
        lane: body.lane || (body.artifactRef.split('/')[1]),
        patternId: body.patternId || null,
        action,
        reason: body.reason || null
      });
      return res.status(200).json({ ok: true, action: recorded });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[operator-action]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
