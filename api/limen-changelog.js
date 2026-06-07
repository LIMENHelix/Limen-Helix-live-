/**
 * api/limen-changelog.js — Persistent Domain Change Log
 *
 * GET  /api/limen-changelog?domain=energy&page=STATE&limit=50&offset=0
 * POST /api/limen-changelog  { domain, type, severity, title, description, metadata, page_context }
 *
 * Redis-backed, append-only. Survives browser close.
 * Also written by snapshot worker when domain state changes between cycles.
 *
 * Event types: EVENT_CHANGE, HEALTH_CHANGE, DIAGNOSIS_CHANGE, TREATMENT_CHANGE,
 *              OPPORTUNITY_CHANGE, EXECUTION_CHANGE, OUTCOME_CHANGE,
 *              COMPANY_CHANGE, CONVERGENCE_CHANGE
 */

var db = require('../lib/limen-db');

var MAX_ENTRIES = 500; // per domain
var TTL_SECONDS = 604800; // 7 days

var PAGE_FILTERS = {
  STATE: ['EVENT_CHANGE', 'HEALTH_CHANGE'],
  INTELLIGENCE: ['DIAGNOSIS_CHANGE', 'TREATMENT_CHANGE'],
  EXECUTION: ['OPPORTUNITY_CHANGE', 'EXECUTION_CHANGE', 'OUTCOME_CHANGE'],
  COMMAND: ['EVENT_CHANGE', 'HEALTH_CHANGE', 'DIAGNOSIS_CHANGE', 'OPPORTUNITY_CHANGE', 'COMPANY_CHANGE', 'CONVERGENCE_CHANGE'],
  OPPORTUNITIES: ['OPPORTUNITY_CHANGE', 'EXECUTION_CHANGE', 'CONVERGENCE_CHANGE']
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // GET: read change log
  if (req.method === 'GET') {
    var domain = (req.query && req.query.domain) || 'energy';
    var page = (req.query && req.query.page) || null;
    var limit = parseInt(req.query && req.query.limit) || 50;
    var offset = parseInt(req.query && req.query.offset) || 0;

    var key = 'changelog_' + domain;
    var log = await db.get(key);
    var entries = (log && log.entries) ? log.entries : [];

    // Filter by page context if specified
    if (page && PAGE_FILTERS[page]) {
      var allowed = PAGE_FILTERS[page];
      entries = entries.filter(function(e) { return allowed.indexOf(e.type) !== -1; });
    }

    // Reverse chronological
    entries.reverse();

    // Paginate
    var total = entries.length;
    entries = entries.slice(offset, offset + limit);

    res.status(200).json({
      ok: true,
      domain: domain,
      total: total,
      offset: offset,
      limit: limit,
      entries: entries
    });
    return;
  }

  // POST: append change entry
  if (req.method === 'POST') {
    var body = req.body;
    if (!body || !body.domain || !body.type || !body.title) {
      res.status(400).json({ ok: false, error: 'Required: domain, type, title' });
      return;
    }

    var entry = {
      timestamp: Date.now(),
      domain: body.domain,
      page_context: body.page_context || null,
      type: body.type,
      severity: body.severity || 'LOW',
      title: body.title,
      description: body.description || '',
      metadata: body.metadata || {}
    };

    var key = 'changelog_' + body.domain;
    var log = await db.get(key);
    var entries = (log && log.entries) ? log.entries : [];

    // Dedupe: skip if identical title+type within last 60s
    var lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    if (lastEntry && lastEntry.title === entry.title && lastEntry.type === entry.type &&
        (entry.timestamp - lastEntry.timestamp) < 60000) {
      res.status(200).json({ ok: true, deduplicated: true });
      return;
    }

    entries.push(entry);

    // Trim to max
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);

    await db.set(key, { entries: entries, updatedAt: Date.now() }, TTL_SECONDS);

    res.status(200).json({ ok: true, count: entries.length });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
