/**
 * handlers/memory-promote.js — promote recurring consolidation findings into the SEMANTIC memory tier.
 *
 *   GET /api/memory-promote?run=1        → for each domain: tally its consolidation:hist proposals,
 *        promote recommendation kinds that recurred >= minRuns into semantic:<domain> (merged with
 *        existing), prune expired records. Records an audit-ledger provenance event per domain.
 *   GET /api/memory-promote?domain=energy → read the semantic store for one domain.
 *   GET /api/memory-promote?tiers=1       → return the five-tier map (documentation).
 *
 * Derives + stabilizes; it does NOT apply a weight, arm a layer, or act. A promoted pattern is
 * 'stabilized' (observational, reversible), NEVER 'validated'. Open GET (low-sensitivity memory state).
 */

var db = require('../lib/limen-db');
var mem = require('../lib/memory-tiers');
var audit = require('../lib/audit-ledger');

var DOMAIN_RE = /^[a-z][a-zA-Z]{1,23}$/;
var PHIST = 90;   // consolidation proposals to scan

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('content-type', 'application/json');
  var m = (req.method || 'GET').toUpperCase();
  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (m !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'method not allowed (read/derive-only)' })); }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  if (q.tiers) return res.end(JSON.stringify({ ok: true, tiers: mem.TIER_MAP }));

  if (!q.run) {
    var domain = String(q.domain || '');
    if (!DOMAIN_RE.test(domain)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad domain (or ?run=1 / ?tiers=1)' })); }
    try {
      var sem = (await db.get('semantic:' + domain)) || [];
      return res.end(JSON.stringify({ ok: true, domain: domain, semantic: sem, backend: db.getBackend() }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }

  try {
    var idx = (await db.get('feedhist:index')) || [];
    var now = Date.now(), out = [];
    for (var i = 0; i < idx.length; i++) {
      var dom = idx[i];
      if (!DOMAIN_RE.test(dom)) continue;
      var proposals = (await db.lrange('consolidation:hist:' + dom, 0, PHIST - 1)) || [];
      if (!proposals.length) continue;
      var candidates = mem.tallyCandidates(proposals);
      var existing = (await db.get('semantic:' + dom)) || [];
      var pr = mem.promote(dom, candidates, existing, {});
      var pruned = mem.pruneExpired(pr.semantic, now, {});
      await db.set('semantic:' + dom, pruned.kept);
      try {
        await audit.append(db, 'memory', { ts: now, type: 'memory.promote', actor: 'memory-promote',
          payload: { domain: dom, promoted: pr.promoted, held: pr.held.length, pruned: pruned.pruned.length, semanticCount: pruned.kept.length, validated: false } });
      } catch (ae) { /* provenance never blocks */ }
      out.push({ domain: dom, promoted: pr.promoted, pruned: pruned.pruned.length, semanticCount: pruned.kept.length });
    }
    return res.end(JSON.stringify({ ok: true, mode: 'run', domains: out.length, results: out, appliedAnything: false, backend: db.getBackend() }));
  } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
};
