/**
 * handlers/orb-ledger.js — READ-ONLY view of the meeting ledger.
 *
 *   GET /api/orb-ledger              the recent entries
 *   GET /api/orb-ledger?limit=50     fewer
 *   GET /api/orb-ledger?from=energy&to=agriculture   one pair's thread
 *
 * WHY READ-ONLY, AND WHY THERE IS NO POST HERE. The record of what each manager asked for is
 * the one thing in this system that must not be forgeable — the whole point of it is that a
 * later meeting can be checked against it. A write endpoint reachable from a public page would
 * let anyone author history. Meetings are recorded by scripts/record-meeting.mjs instead.
 *
 * An empty ledger is a NORMAL response, not an error. Nothing has been recorded against this
 * backend until a run writes to it, and the meeting simply says nothing about the past when
 * there is nothing to say.
 */

var ledger = require('../lib/orb-ledger');

var DEFAULT_LIMIT = 300;
var MAX_LIMIT = 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  /* Short cache. A meeting that convenes twice in a minute may reuse it; one convened an hour
     later must see anything recorded since. */
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.status(405).json({ ok: false, error: 'GET only; this ledger is not writable over HTTP' });
    return;
  }

  var q = req.query || {};
  var limit = parseInt(q.limit, 10);
  if (!isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  var rows;
  try {
    rows = await ledger.readAll();
  } catch (e) {
    // Say it plainly rather than returning an empty list, which would read as "nothing was
    // ever asked" and quietly erase every thread.
    res.status(503).json({ ok: false, error: 'ledger unreadable', detail: String(e && e.message || e) });
    return;
  }
  if (!Array.isArray(rows)) rows = [];

  if (q.from) rows = rows.filter(function (r) { return r && r.from === q.from; });
  if (q.to)   rows = rows.filter(function (r) { return r && r.to === q.to; });

  // Newest last, so a caller taking the tail gets the most recent.
  rows.sort(function (a, b) { return String(a && a.t).localeCompare(String(b && b.t)); });
  var out = rows.slice(Math.max(0, rows.length - limit));

  res.status(200).json({
    ok: true,
    backend: ledger.backend(),
    total: rows.length,
    returned: out.length,
    entries: out
  });
};
