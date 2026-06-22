/**
 * /api/pattern-proposal — operator review + approve pending pattern proposals.
 *
 * GET                        — list all proposals
 * GET   ?status=REJECTED      — list one bucket (e.g. to find cards to restore)
 * POST  { id, approve:true }  — merge into bridge-patterns.json
 * POST  { id, reject:true  }  — mark REJECTED, leave out of library
 * POST  { id, restore:true }  — un-reject: return a REJECTED card to the queue
 */
const author = require('../lib/pattern-author.js');

const adminGate = require('../lib/admin-gate');
module.exports = async (req, res) => {
  if ((req.method || 'GET').toUpperCase() !== 'OPTIONS' && !adminGate.isMaster(adminGate.reqKey(req))) return adminGate.deny(res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      const state = await author.listProposals();
      // Surface APPROVED patterns from the matching library (bridge-patterns.json) —
      // approved proposals graduate OUT of the queue into that file, so the review
      // page (which reads the queue) wouldn't show them otherwise.
      try {
        if (state && Array.isArray(state.proposals)) {
          const have = new Set(state.proposals.map(p => p.pattern && p.pattern.id).filter(Boolean));
          for (const lp of author.approvedLibraryAsProposals()) if (!have.has(lp.id)) state.proposals.push(lp);
        }
      } catch (e) { /* best-effort */ }
      // Optional ?status=REJECTED (etc.) to list a single bucket — used to find
      // rejected proposals to restore. Dedup latest-wins by pattern id first.
      const want = (req.query && req.query.status) ? String(req.query.status).toUpperCase() : null;
      if (want && state && Array.isArray(state.proposals)) {
        const seen = new Set();
        const filtered = state.proposals.filter(p => {
          const id = p.pattern && p.pattern.id; if (!id || seen.has(id)) return false; seen.add(id);
          return (p.status || '') === want;
        });
        return res.status(200).json({ status: want, count: filtered.length, proposals: filtered });
      }
      return res.status(200).json(state);
    }
    if (req.method === 'POST') {
      const body = (typeof req.body === 'object' && req.body) ? req.body : (req.body ? JSON.parse(req.body) : {});
      if (!body.id) return res.status(400).json({ error: 'id required' });
      if (body.approve) {
        const r = await author.approveProposal(body.id);
        return res.status(r.ok ? 200 : 400).json(r);
      }
      if (body.reject) {
        const r = await author.rejectProposal(body.id);
        return res.status(r.ok ? 200 : 400).json(r);
      }
      if (body.restore) {
        const r = await author.restoreProposal(body.id);
        return res.status(r.ok ? 200 : 400).json(r);
      }
      return res.status(400).json({ error: 'expected approve:true OR reject:true OR restore:true' });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('[pattern-proposal]', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
};
