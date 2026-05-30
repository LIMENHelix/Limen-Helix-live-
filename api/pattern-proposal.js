/**
 * /api/pattern-proposal — operator review + approve pending pattern proposals.
 *
 * GET                       — list all pending proposals
 * POST  { id, approve:true }  — merge into bridge-patterns.json
 * POST  { id, reject:true  }  — mark REJECTED, leave out of library
 */
const author = require('./lib/pattern-author.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      const state = await author.listProposals();
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
      return res.status(400).json({ error: 'expected approve:true OR reject:true' });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('[pattern-proposal]', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
};
