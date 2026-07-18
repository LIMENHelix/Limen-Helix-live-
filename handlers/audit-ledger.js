/**
 * handlers/audit-ledger.js — read + verify the tamper-evident provenance ledger (lib/audit-ledger).
 *
 *   GET /api/audit-ledger?stream=consolidation&verify=1  → { ok, verify:{ok,brokenAt,reason,head} }
 *   GET /api/audit-ledger?stream=consolidation&n=50       → newest-first entries (read)
 *
 * READ-ONLY. This endpoint cannot append, edit, or delete — appends happen inside the code paths that
 * generate auditable events (e.g. the consolidator). Verify recomputes the hash chain and reports any
 * tampering (edit/reorder/deletion of a past entry). Open GET: it exposes provenance metadata, not secrets.
 */

var db = require('../lib/limen-db');
var audit = require('../lib/audit-ledger');

var STREAM_RE = /^[a-zA-Z0-9:_-]{1,48}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('content-type', 'application/json');
  var m = (req.method || 'GET').toUpperCase();
  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (m !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'method not allowed (read-only)' })); }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var stream = String(q.stream || '');
  if (!STREAM_RE.test(stream)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad or missing stream' })); }

  try {
    if (q.verify) {
      var v = await audit.verify(db, stream);
      return res.end(JSON.stringify({ ok: true, stream: stream, verify: v, backend: db.getBackend() }));
    }
    var n = Math.max(1, Math.min(500, parseInt(q.n, 10) || 100));
    var entries = await audit.read(db, stream, n);
    return res.end(JSON.stringify({ ok: true, stream: stream, count: entries.length, entries: entries, backend: db.getBackend() }));
  } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
};
